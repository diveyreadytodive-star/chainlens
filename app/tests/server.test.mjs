import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {TRANSFER_TOPIC} from '../lib/interpreter.mjs';
import {createServer, configuredExtensionOrigins, rpcProviderLabel, tokenMetadata} from '../server.mjs';
import {createInterpreterService} from '../lib/service.mjs';

function start(service) {
  return new Promise((resolve, reject) => {
    service.once('error', reject);
    service.listen(0, '127.0.0.1', () => {
      service.off('error', reject);
      resolve(service.address().port);
    });
  });
}

function request(port, {method = 'GET', path = '/api/health', headers = {}, body} = {}) {
  return new Promise((resolve, reject) => {
    const client = http.request({hostname: '127.0.0.1', port, method, path, headers}, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => resolve({status: response.statusCode, headers: response.headers, body: text}));
    });
    client.on('error', reject);
    if (body) client.write(body);
    client.end();
  });
}

test('ephemeral HTTP server permits only local and configured extension CORS requests', async () => {
  const extensionOrigin = `chrome-extension://${'a'.repeat(32)}`;
  const service = createServer({extensionOrigins: [extensionOrigin]});
  const serverPort = await start(service);
  try {
    const options = await request(serverPort, {method: 'OPTIONS', path: '/api/interpret', headers: {Origin: extensionOrigin, 'Access-Control-Request-Method': 'POST'}});
    assert.equal(options.status, 204);assert.equal(options.headers['access-control-allow-origin'], extensionOrigin);assert.equal(options.headers.vary, 'Origin');assert.equal(options.headers['access-control-allow-methods'], 'POST, OPTIONS');

    const post = await request(serverPort, {method: 'POST', path: '/api/interpret', headers: {Origin: extensionOrigin, 'Content-Type': 'application/json'}, body: JSON.stringify({input: 'not-a-transaction-hash'})});
    assert.equal(post.status, 400);assert.equal(post.headers['access-control-allow-origin'], extensionOrigin);assert.equal(post.headers.vary, 'Origin');

    const localOrigin = `http://127.0.0.1:${serverPort}`;
    const localOptions = await request(serverPort, {method: 'OPTIONS', path: '/api/interpret', headers: {Origin: localOrigin, 'Access-Control-Request-Method': 'POST'}});
    assert.equal(localOptions.status, 204);assert.equal(localOptions.headers['access-control-allow-origin'], localOrigin);

    const rejected = await request(serverPort, {method: 'OPTIONS', path: '/api/interpret', headers: {Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST'}});
    assert.equal(rejected.status, 403);assert.equal(rejected.headers['access-control-allow-origin'], undefined);

    const noOriginHealth = await request(serverPort);
    assert.equal(noOriginHealth.status, 200);assert.equal(noOriginHealth.headers['access-control-allow-origin'], undefined);
    const noOriginPost = await request(serverPort, {method: 'POST', path: '/api/interpret', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({input: 'not-a-transaction-hash'})});
    assert.equal(noOriginPost.status, 400);assert.equal(noOriginPost.headers['access-control-allow-origin'], undefined);
  } finally { await new Promise((resolve, reject) => service.close(error => error ? reject(error) : resolve())); }
});

test('ephemeral HTTP server rejects malformed interpret requests before RPC lookup', async () => {
  const service = createServer();
  const serverPort = await start(service);
  try {
    const contentType = await request(serverPort, {method: 'POST', path: '/api/interpret', headers: {'Content-Type': 'text/plain'}, body: '{}'});
    assert.equal(contentType.status, 415);assert.match(contentType.body, /JSON 요청/);
    const malformed = await request(serverPort, {method: 'POST', path: '/api/interpret', headers: {'Content-Type': 'application/json'}, body: '{'});
    assert.equal(malformed.status, 400);assert.match(malformed.body, /요청 형식/);
    for (const payload of ['null', '[]']) {
      const nonObject = await request(serverPort, {method: 'POST', path: '/api/interpret', headers: {'Content-Type': 'application/json'}, body: payload});
      assert.equal(nonObject.status, 400);assert.match(nonObject.body, /JSON 객체 요청/);assert.doesNotMatch(nonObject.body, /TypeError/);
    }
    const tooLarge = await request(serverPort, {method: 'POST', path: '/api/interpret', headers: {'Content-Type': 'application/json'}, body: 'x'.repeat(8193)});
    assert.equal(tooLarge.status, 400);assert.match(tooLarge.body, /입력이 너무 큽니다/);
  } finally { await new Promise((resolve, reject) => service.close(error => error ? reject(error) : resolve())); }
});

test('extension origin configuration rejects malformed and untrusted schemes', () => {
  const valid = `chrome-extension://${'b'.repeat(32)}`;
  assert.deepEqual(configuredExtensionOrigins(`${valid}, https://evil.example, chrome-extension://too-short`), [valid]);
});

test('configured RPC labels do not expose configured URL credentials', async () => {
  const configured = 'https://example-api-key@private-rpc.example/path';
  const service = createServer({rpcEndpoints: [configured], configuredRpc: configured});
  const serverPort = await start(service);
  try {
    const health = await request(serverPort);
    assert.equal(health.status, 200);assert.deepEqual(JSON.parse(health.body).rpcProviders, ['configured Ethereum RPC']);assert.doesNotMatch(health.body, /example-api-key|private-rpc/);
    assert.equal(rpcProviderLabel('https://ethereum-rpc.publicnode.com', null), 'ethereum-rpc.publicnode.com');
    assert.equal(rpcProviderLabel(configured, configured), 'configured Ethereum RPC');
  } finally { await new Promise((resolve, reject) => service.close(error => error ? reject(error) : resolve())); }
});

test('historical token metadata falls back from the transaction RPC to another provider', async () => {
  const token = `0x${'3'.repeat(40)}`;
  const addressTopic = address => `0x${'0'.repeat(24)}${address.slice(2)}`;
  const receipt = {blockNumber: '0x1234', logs: [{address: token, topics: [TRANSFER_TOPIC, addressTopic(`0x${'1'.repeat(40)}`), addressTopic(`0x${'2'.repeat(40)}`)], data: `0x${'0'.repeat(63)}1`, logIndex: '0x0'}]};
  const providers = ['https://transaction-rpc.example', 'https://metadata-rpc.example'];
  const calls = [];
  const metadata = await tokenMetadata(providers, receipt, async (endpoint, method, params) => {
    calls.push({endpoint, method, params});
    if (endpoint === providers[0]) throw new Error('archive state unavailable');
    if (params[0].data === '0x313ce567') return `0x${'0'.repeat(63)}6`;
    return `0x${Buffer.from('USDC').toString('hex').padEnd(64, '0')}`;
  });
  assert.deepEqual(metadata[token], {decimals: 6, symbol: 'USDC'});
  assert.ok(calls.some(call => call.endpoint === providers[0]));assert.ok(calls.some(call => call.endpoint === providers[1]));
  assert.ok(calls.every(call => call.method === 'eth_call' && call.params[1] === receipt.blockNumber));
});

test('historical token metadata preserves null values when every provider fails', async () => {
  const token = `0x${'4'.repeat(40)}`;
  const addressTopic = address => `0x${'0'.repeat(24)}${address.slice(2)}`;
  const receipt = {blockNumber: '0x99', logs: [{address: token, topics: [TRANSFER_TOPIC, addressTopic(`0x${'1'.repeat(40)}`), addressTopic(`0x${'2'.repeat(40)}`)], data: `0x${'0'.repeat(63)}1`, logIndex: '0x0'}]};
  const metadata = await tokenMetadata(['https://first.example', 'https://second.example'], receipt, async () => { throw new Error('unavailable'); });
  assert.deepEqual(metadata[token], {decimals: null, symbol: null});
});

test('metadata uses parallel providers and returns within its total time budget', async () => {
  const token = `0x${'5'.repeat(40)}`;
  const addressTopic = address => `0x${'0'.repeat(24)}${address.slice(2)}`;
  const receipt = {blockNumber: '0x77', logs: [{address: token, topics: [TRANSFER_TOPIC, addressTopic(`0x${'1'.repeat(40)}`), addressTopic(`0x${'2'.repeat(40)}`)], data: `0x${'0'.repeat(63)}1`, logIndex: '0x0'}]};
  const startedAt = Date.now();
  const metadata = await tokenMetadata(['https://slow.example', 'https://fast.example'], receipt, async (endpoint, _method, params) => {
    if (endpoint === 'https://slow.example') return new Promise(() => {});
    return params[0].data === '0x313ce567' ? `0x${'0'.repeat(63)}6` : `0x${Buffer.from('USDC').toString('hex').padEnd(64, '0')}`;
  }, {timeoutMs: 1000});
  assert.deepEqual(metadata[token], {decimals: 6, symbol: 'USDC'});assert.ok(Date.now() - startedAt < 250);

  const exhaustedAt = Date.now();
  const exhausted = await tokenMetadata(['https://slow.example'], receipt, async () => new Promise(() => {}), {timeoutMs: 25});
  assert.deepEqual(exhausted[token], {decimals: null, symbol: null});assert.ok(Date.now() - exhaustedAt < 100);
});

test('mined transactions with a missing receipt fall back to another RPC', async () => {
  const hash = `0x${'7'.repeat(64)}`;
  const first = 'https://first.example';
  const second = 'https://second.example';
  const transaction = {hash, from: `0x${'1'.repeat(40)}`, to: `0x${'2'.repeat(40)}`, value: '0x1', input: '0x', blockNumber: '0x10'};
  const receipt = {transactionHash: hash, status: '0x1', blockNumber: '0x10', gasUsed: '0x5208', effectiveGasPrice: '0x1', logs: []};
  const fetchImpl = async (endpoint, options) => {
    const {method} = JSON.parse(options.body);
    let result;
    if (method === 'eth_chainId') result = '0x1';
    else if (method === 'eth_getTransactionByHash') result = transaction;
    else if (method === 'eth_getTransactionReceipt') result = endpoint === first ? null : receipt;
    else if (method === 'eth_blockNumber') result = '0x20';
    else if (method === 'eth_getBlockByNumber') result = {number: '0x10'};
    else throw new Error(`unexpected method ${method}`);
    return new Response(JSON.stringify({jsonrpc: '2.0', id: 1, result}), {status: 200, headers: {'content-type': 'application/json'}});
  };
  const service = createInterpreterService({rpcEndpoints: [first, second], fetchImpl});
  const facts = await service.interpret({input: hash});
  assert.equal(facts.status, 'success');
  assert.equal(facts.source.provider, 'second.example');
});
