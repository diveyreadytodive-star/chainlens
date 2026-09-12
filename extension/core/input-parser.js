export const HASH_PATTERN = /^0x[0-9a-f]{64}$/i;
export const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/i;
const EXPLORER_HOSTS = new Set(['etherscan.io', 'www.etherscan.io', 'eth.blockscout.com']);

export function isTransactionHash(value) {
  return typeof value === 'string' && HASH_PATTERN.test(value);
}

export function isAddress(value) {
  return typeof value === 'string' && ADDRESS_PATTERN.test(value);
}

export function parseTransactionInput(value) {
  if (typeof value !== 'string' || value.length > 600) {
    throw new Error('0x로 시작하는 66자리 Ethereum 거래 해시나 지원 탐색기 링크가 필요합니다.');
  }

  const input = value.trim();
  if (isTransactionHash(input)) return input.toLowerCase();

  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error('0x로 시작하는 66자리 Ethereum 거래 해시나 지원 탐색기 링크가 필요합니다.');
  }

  if (url.protocol !== 'https:' || !EXPLORER_HOSTS.has(url.hostname) || url.port || url.username || url.password) {
    throw new Error('etherscan.io 또는 eth.blockscout.com의 Ethereum 거래 링크만 지원합니다.');
  }
  const match = url.pathname.match(/^\/tx\/(0x[0-9a-f]{64})\/?$/i);
  if (!match) throw new Error('탐색기의 /tx/{거래 해시} 상세 링크를 입력해 주세요.');
  return match[1].toLowerCase();
}

export function parseExplorerTransactionUrl(value) {
  return parseTransactionInput(value);
}

export function explorerUrl(hash) {
  if (!isTransactionHash(hash)) throw new Error('유효하지 않은 거래 해시입니다.');
  return `https://etherscan.io/tx/${hash.toLowerCase()}`;
}

export function trustedEvidenceUrl(value, hash) {
  if (!isTransactionHash(hash) || typeof value !== 'string' || value.length > 800) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  const expectedPath = `/tx/${hash.toLowerCase()}`;
  if (
    url.protocol !== 'https:' ||
    !EXPLORER_HOSTS.has(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    (url.pathname !== expectedPath && url.pathname !== `${expectedPath}/`) ||
    url.search
  ) return null;
  return url.href;
}
