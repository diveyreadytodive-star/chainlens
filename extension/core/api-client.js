import { isAddress, isTransactionHash, parseTransactionInput, trustedEvidenceUrl } from './input-parser.js';

export const API_BASE = 'https://chainlens-lyart.vercel.app';
export const REQUEST_TIMEOUT_MS = 22_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_EVENTS = 100;
const MAX_EVIDENCE = 120;
const MAX_LIMITATIONS = 30;

function errorFromResponse(status, payload) {
  if (typeof payload?.error === 'string' && payload.error.length <= 300) return payload.error;
  if (status === 404) return '거래를 찾지 못했습니다. 해시와 Ethereum Mainnet을 확인해 주세요.';
  if (status >= 500) return '해석 서버 또는 Ethereum RPC에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  return '거래를 해석하지 못했습니다.';
}

export function validateFactsPayload(payload, hash) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('해석 서버의 응답 형식을 확인할 수 없습니다.');
  }
  if (!isTransactionHash(payload.hash) || payload.hash.toLowerCase() !== hash) {
    throw new Error('해석 서버의 거래 해시 응답을 확인할 수 없습니다.');
  }
  if (!['success', 'failed', 'pending', 'unknown', 'not_found'].includes(payload.status) || typeof payload.summary !== 'string' || payload.summary.length > 800) {
    throw new Error('해석 서버의 거래 요약 응답을 확인할 수 없습니다.');
  }
  if ((payload.chain !== undefined && !boundedString(payload.chain, 80)) || (payload.confidence !== undefined && !['confirmed', 'partial', 'unknown'].includes(payload.confidence)) || (payload.category !== undefined && !boundedString(payload.category, 48)) || (payload.perspective !== undefined && payload.perspective !== null && !isAddress(payload.perspective)) || (payload.decodedLogCount !== undefined && (!Number.isInteger(payload.decodedLogCount) || payload.decodedLogCount < 0 || payload.decodedLogCount > MAX_EVENTS)) || (payload.unsupportedLogCount !== undefined && (!Number.isInteger(payload.unsupportedLogCount) || payload.unsupportedLogCount < 0 || payload.unsupportedLogCount > MAX_EVENTS))) {
    throw new Error('해석 서버의 거래 요약 응답을 확인할 수 없습니다.');
  }
  if (!Array.isArray(payload.evidence) || !Array.isArray(payload.transfers) || !Array.isArray(payload.approvals) || !Array.isArray(payload.limitations) || payload.evidence.length > MAX_EVIDENCE || payload.transfers.length > MAX_EVENTS || payload.approvals.length > MAX_EVENTS || payload.limitations.length > MAX_LIMITATIONS) {
    throw new Error('해석 서버의 거래 근거 응답을 확인할 수 없습니다.');
  }
  for (const evidence of payload.evidence) {
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) || !boundedString(evidence.id, 80) || !boundedString(evidence.label, 240) || !trustedEvidenceUrl(evidence.url, hash) || !Array.isArray(evidence.fields) || evidence.fields.length > 12 || evidence.fields.some(field => !boundedString(field, 200)) || (evidence.contract !== undefined && !isAddress(evidence.contract))) {
      throw new Error('해석 서버의 원본 근거 URL을 확인할 수 없습니다.');
    }
  }
  if (payload.transfers.some(item => !validEvent(item, false)) || payload.approvals.some(item => !validEvent(item, true)) || payload.limitations.some(item => !boundedString(item, 600))) {
    throw new Error('해석 서버의 자산·권한 응답을 확인할 수 없습니다.');
  }
  if (payload.from !== undefined && !isAddress(payload.from) || payload.to !== undefined && payload.to !== null && !isAddress(payload.to)) throw new Error('해석 서버의 거래 주소 응답을 확인할 수 없습니다.');
  if (payload.fee !== null && payload.fee !== undefined && !validFee(payload.fee)) throw new Error('해석 서버의 수수료 응답을 확인할 수 없습니다.');
  if (!validFinality(payload.finality)) throw new Error('해석 서버의 블록 상태 응답을 확인할 수 없습니다.');
  if (payload.explanation !== undefined && !validExplanation(payload.explanation)) throw new Error('해석 서버의 설명 응답을 확인할 수 없습니다.');
  return payload;
}

function boundedString(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function decimal(value, max = 96) {
  return boundedString(value, max) && /^\d+(?:\.\d+)?$/.test(value);
}

function validEvent(item, approval) {
  if (!item || typeof item !== 'object' || Array.isArray(item) || !isAddress(item.from) || !isAddress(item.to) || !boundedString(item.amount, 96) || !boundedString(item.amountUnit, 48) || !boundedString(item.rawAmount, 80) || !/^\d+$/.test(item.rawAmount) || !boundedString(item.direction, 20) || (item.symbol !== undefined && !boundedString(item.symbol, 48)) || (item.contract !== undefined && !isAddress(item.contract))) return false;
  if (item.type !== 'native' && !isAddress(item.contract)) return false;
  if (approval && item.type !== 'approval') return false;
  return typeof item.metadataVerified === 'boolean' && (!approval || typeof item.unlimited === 'boolean');
}

function validFee(fee) {
  return fee && typeof fee === 'object' && !Array.isArray(fee) && decimal(fee.amount) && fee.unit === 'ETH' && boundedString(fee.gasUsed, 80) && /^\d+$/.test(fee.gasUsed) && isAddress(fee.payer) && typeof fee.complete === 'boolean';
}

function validFinality(finality) {
  return finality && typeof finality === 'object' && !Array.isArray(finality) && ['unknown', 'included', 'finalized'].includes(finality.state) && boundedString(finality.label, 160) && (finality.blockNumber === null || finality.blockNumber === undefined || (boundedString(finality.blockNumber, 32) && /^\d+$/.test(finality.blockNumber))) && (finality.confirmations === null || finality.confirmations === undefined || (boundedString(finality.confirmations, 32) && /^\d+$/.test(finality.confirmations)));
}

function validExplanation(explanation) {
  return explanation && typeof explanation === 'object' && !Array.isArray(explanation) && boundedString(explanation.label, 80) && boundedString(explanation.text, 800) && (explanation.reason === undefined || explanation.reason === null || boundedString(explanation.reason, 240)) && (explanation.cached === undefined || typeof explanation.cached === 'boolean') && (explanation.mode === undefined || boundedString(explanation.mode, 32)) && (explanation.provider === undefined || boundedString(explanation.provider, 80)) && (explanation.guard === undefined || boundedString(explanation.guard, 400)) && (explanation.generatedAt === undefined || boundedString(explanation.generatedAt, 64));
}

async function readResponseBody(response) {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) throw new Error('해석 서버 응답이 너무 큽니다.');
  const reader = response.body?.getReader?.();
  if (!reader) {
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) throw new Error('해석 서버 응답이 너무 큽니다.');
    return body;
  }
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('해석 서버 응답이 너무 큽니다.');
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

export async function interpretTransaction(input, { fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const hash = parseTransactionInput(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${API_BASE}/api/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: hash }),
      signal: controller.signal
    });
    let payload = null;
    try { payload = JSON.parse(await readResponseBody(response)); } catch (error) {
      if (error instanceof Error && error.message === '해석 서버 응답이 너무 큽니다.') throw error;
      throw new Error('해석 서버가 읽을 수 없는 응답을 반환했습니다.');
    }
    if (!response.ok) throw new Error(errorFromResponse(response.status, payload));
    return validateFactsPayload(payload, hash);
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('해석 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.');
    throw error instanceof Error ? error : new Error('거래를 해석하지 못했습니다.');
  } finally {
    clearTimeout(timer);
  }
}
