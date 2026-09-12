import {readFile} from 'node:fs/promises';
import {parseInput, decodeLogs, interpretFacts, isAddress} from './interpreter.mjs';
import {explain} from './ai.mjs';

const DEFAULT_RPC_ENDPOINTS = ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org', 'https://cloudflare-eth.com'];

export const extensionOriginPattern = /^chrome-extension:\/\/[a-p]{32}$/;

export function configuredExtensionOrigins(value = process.env.CHAINLENS_EXTENSION_ORIGINS || process.env.CHAINLENS_EXTENSION_ORIGIN || '') {
  return value.split(',').map(origin => origin.trim()).filter(origin => extensionOriginPattern.test(origin));
}

export function rpcProviderLabel(endpoint, configuredEndpoint = process.env.ETHEREUM_RPC_URL) {
  if (configuredEndpoint && endpoint === configuredEndpoint) return 'configured Ethereum RPC';
  try { return new URL(endpoint).hostname; } catch { return 'Ethereum RPC'; }
}

export async function loadExamples() {
  try {
    const data = JSON.parse(await readFile(new URL('../data/examples.json', import.meta.url), 'utf8'));
    return Array.isArray(data) ? data : data.examples || [];
  } catch { return []; }
}

function decodeSymbol(hex) {
  if (typeof hex !== 'string' || !/^0x[0-9a-f]+$/i.test(hex)) return null;
  const bytes = Buffer.from(hex.slice(2), 'hex');
  if (bytes.length === 32) return bytes.toString('utf8').replace(/\0+$/, '');
  if (bytes.length < 64) return null;
  const offset = Number(BigInt(`0x${bytes.subarray(0, 32).toString('hex')}`));
  if (!Number.isSafeInteger(offset) || offset + 32 > bytes.length) return null;
  const length = Number(BigInt(`0x${bytes.subarray(offset, offset + 32).toString('hex')}`));
  if (length < 0 || length > 128 || offset + 32 + length > bytes.length) return null;
  return bytes.subarray(offset + 32, offset + 32 + length).toString('utf8');
}

export async function tokenMetadata(metadataEndpoints, receipt, rpcCall, {timeoutMs = 5000} = {}) {
  const metadata = {};
  const addresses = [...new Set(decodeLogs(receipt?.logs || []).events.map(event => event.contract))].slice(0, 16);
  await Promise.allSettled(addresses.map(async address => {
    metadata[address] = {decimals: null, symbol: null};
    const startedAt = Date.now();
    const providerTasks = [...new Set(metadataEndpoints)].map(async endpoint => {
      const [decimalsResult, symbolResult] = await Promise.allSettled([
        rpcCall(endpoint, 'eth_call', [{to: address, data: '0x313ce567'}, receipt.blockNumber], {timeoutMs}),
        rpcCall(endpoint, 'eth_call', [{to: address, data: '0x95d89b41'}, receipt.blockNumber], {timeoutMs})
      ]);
      const decimals = decimalsResult.status === 'fulfilled' && /^0x[0-9a-f]{64}$/i.test(decimalsResult.value) && BigInt(decimalsResult.value) <= 255n ? Number(BigInt(decimalsResult.value)) : null;
      const symbol = symbolResult.status === 'fulfilled' ? decodeSymbol(symbolResult.value) : null;
      return {decimals, symbol};
    });
    const pending = providerTasks.map((promise, index) => ({index, promise: promise.then(value => ({index, value}))}));
    while (pending.length && (metadata[address].decimals === null || metadata[address].symbol === null)) {
      const remaining = timeoutMs - (Date.now() - startedAt);
      if (remaining <= 0) break;
      let timer;
      const next = await Promise.race([...pending.map(task => task.promise), new Promise(resolve => { timer = setTimeout(() => resolve({timeout: true}), remaining); })]);
      clearTimeout(timer);
      if (next.timeout) break;
      pending.splice(pending.findIndex(task => task.index === next.index), 1);
      if (metadata[address].decimals === null && next.value.decimals !== null) metadata[address].decimals = next.value.decimals;
      if (metadata[address].symbol === null && next.value.symbol !== null) metadata[address].symbol = next.value.symbol;
    }
  }));
  return metadata;
}

/** HTTP-platform-neutral transaction service used by local and Vercel adapters. */
export function createInterpreterService({
  rpcEndpoints = process.env.ETHEREUM_RPC_URL ? [process.env.ETHEREUM_RPC_URL] : DEFAULT_RPC_ENDPOINTS,
  configuredRpc = process.env.ETHEREUM_RPC_URL,
  getExamples = loadExamples,
  fetchImpl = globalThis.fetch,
  maxConcurrent = 2
} = {}) {
  const cache = new Map();
  let requestId = 0;
  let activeInterpretations = 0;
  const rpc = async (endpoint, method, params = [], {timeoutMs = 6500} = {}) => {
    const response = await fetchImpl(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: ++requestId, method, params}), signal: AbortSignal.timeout(timeoutMs)});
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const data = await response.json();
    if (data.error || !Object.hasOwn(data, 'result')) throw new Error('RPC method unavailable');
    return data.result;
  };
  const fetchTransaction = async hash => {
    const cached = cache.get(hash);
    if (cached && Date.now() - cached.time < 15000) return {...cached.data, source: {...cached.data.source, cached: true}};
    let sawNull = false;
    for (const endpoint of rpcEndpoints) {
      try {
        const chain = await rpc(endpoint, 'eth_chainId');
        if (chain !== '0x1') throw new Error('RPC chain mismatch');
        const [transaction, receipt] = await Promise.all([rpc(endpoint, 'eth_getTransactionByHash', [hash]), rpc(endpoint, 'eth_getTransactionReceipt', [hash])]);
        if (!transaction) { sawNull = true; continue; }
        const metadataProviders = [endpoint, ...rpcEndpoints.filter(candidate => candidate !== endpoint)];
        const [block, finalized, metadata] = await Promise.allSettled([rpc(endpoint, 'eth_blockNumber'), rpc(endpoint, 'eth_getBlockByNumber', ['finalized', false]), tokenMetadata(metadataProviders, receipt, rpc)]);
        const data = {hash, transaction, receipt, metadata: metadata.status === 'fulfilled' ? metadata.value : {}, blockNumber: block.status === 'fulfilled' ? block.value : null, finalizedBlockNumber: finalized.status === 'fulfilled' ? finalized.value?.number : null, source: {mode: 'live', provider: rpcProviderLabel(endpoint, configuredRpc), fetchedAt: new Date().toISOString()}};
        if (cache.size > 80) cache.delete(cache.keys().next().value);
        cache.set(hash, {time: Date.now(), data});
        return data;
      } catch { /* Public RPC failures are isolated; configured secrets are never logged. */ }
    }
    if (sawNull) return {hash, transaction: null, receipt: null, source: {mode: 'live', provider: 'Ethereum RPC', fetchedAt: new Date().toISOString()}};
    throw new Error('RPC_UNAVAILABLE');
  };
  return {
    health() { return {ok: true, chain: 'ethereum', aiConfigured: Boolean(process.env.GROQ_API_KEY), aiMode: process.env.GROQ_API_KEY ? 'groq' : 'rules', rpcProviders: rpcEndpoints.map(endpoint => rpcProviderLabel(endpoint, configuredRpc)), version: '0.2.0'}; },
    async examples() { return (await getExamples()).map(({id, label, hash, kind, source, fetchedAt}) => ({id, label, hash, kind, source, fetchedAt})); },
    async interpret(input) {
      if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('JSON_OBJECT_REQUIRED');
      const hash = parseInput(input.input);
      if (input.perspective && !isAddress(input.perspective)) throw new Error('INVALID_PERSPECTIVE');
      if (activeInterpretations >= maxConcurrent) throw new Error('TOO_MANY_REQUESTS');
      activeInterpretations++;
      try {
        let data;
        if (input.exampleId) {
          const example = (await getExamples()).find(item => item.id === input.exampleId && item.hash?.toLowerCase() === hash);
          if (!example?.transaction) throw new Error('EXAMPLE_NOT_FOUND');
          data = {...example, hash, source: {mode: 'stored', provider: typeof example.source === 'string' ? example.source : example.source?.provider || '저장된 실제 RPC 응답', fetchedAt: example.fetchedAt || example.source?.fetchedAt, replayedAt: new Date().toISOString()}};
        } else data = await fetchTransaction(hash);
        const facts = interpretFacts({...data, perspective: input.perspective});
        facts.explanation = await explain(facts);
        return facts;
      } finally { activeInterpretations--; }
    }
  };
}

export function apiError(error) {
  const message = error?.message || '';
  if (message === 'RPC_UNAVAILABLE') return {status: 503, error: '현재 공개 RPC에 연결할 수 없습니다. 잠시 후 다시 조회하거나, 출처가 표시된 저장 예제를 이용해 주세요.'};
  if (message === 'JSON_OBJECT_REQUIRED') return {status: 400, error: 'JSON 객체 요청이 필요합니다.'};
  if (message === 'INVALID_PERSPECTIVE') return {status: 400, error: '관점 주소는 0x로 시작하는 42자리 주소여야 합니다.'};
  if (message === 'TOO_MANY_REQUESTS') return {status: 429, error: '다른 거래를 해석 중입니다. 잠시 후 다시 시도해 주세요.'};
  if (message === 'EXAMPLE_NOT_FOUND') return {status: 404, error: '저장된 예제 원본을 찾을 수 없습니다.'};
  const internal = /RPC 거래|RPC 영수증|Invalid RPC/.test(message);
  return {status: internal ? 502 : 400, error: internal ? '조회 자료의 일관성을 확인하지 못했습니다. 다시 조회해 주세요.' : message || '요청을 처리하지 못했습니다.'};
}
