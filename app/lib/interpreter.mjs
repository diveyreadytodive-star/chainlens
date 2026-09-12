export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
const HASH = /^0x[0-9a-f]{64}$/i;
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const WORD = /^0x[0-9a-f]{64}$/i;
export const isAddress = value => typeof value === 'string' && ADDRESS.test(value);

export function parseInput(input) {
  if (typeof input !== 'string' || input.length > 600) throw new Error('거래 해시 또는 지원 탐색기 링크를 입력해 주세요.');
  const text = input.trim();
  if (HASH.test(text)) return text.toLowerCase();
  let url;
  try { url = new URL(text); } catch { throw new Error('0x로 시작하는 66자리 거래 해시가 필요합니다.'); }
  if (url.protocol !== 'https:' || !['etherscan.io', 'www.etherscan.io', 'eth.blockscout.com'].includes(url.hostname) || url.port || url.username || url.password) {
    throw new Error('Ethereum의 etherscan.io 또는 eth.blockscout.com 거래 링크만 지원합니다.');
  }
  const match = url.pathname.match(/^\/tx\/(0x[0-9a-f]{64})\/?$/i);
  if (!match) throw new Error('탐색기의 /tx/ 거래 상세 링크를 입력해 주세요.');
  return match[1].toLowerCase();
}

export function formatUnits(value, decimals = 18) {
  const n = BigInt(value);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error('Invalid decimals');
  const negative = n < 0n;
  const str = (negative ? -n : n).toString().padStart(decimals + 1, '0');
  const result = decimals ? `${str.slice(0, -decimals)}.${str.slice(-decimals).replace(/0+$/, '')}`.replace(/\.$/, '') : str;
  return `${negative ? '-' : ''}${result}`;
}

const short = value => `${value.slice(0, 6)}…${value.slice(-4)}`;
const topicAddress = value => {
  if (!WORD.test(value) || !/^0x0{24}/i.test(value)) throw new Error('Non-canonical address topic');
  return `0x${value.slice(-40)}`.toLowerCase();
};
const integer = value => {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) throw new Error('Invalid RPC quantity');
  return BigInt(value);
};

export function decodeLogs(logs = []) {
  const events = [];
  let unsupported = 0;
  for (const log of logs) {
    if (log.removed) continue;
    const topic = log.topics?.[0]?.toLowerCase();
    if (![TRANSFER_TOPIC, APPROVAL_TOPIC].includes(topic) || log.topics?.length !== 3 || !WORD.test(log.data) || !isAddress(log.address)) {
      unsupported++;
      continue;
    }
    try {
      events.push({type: topic === TRANSFER_TOPIC ? 'transfer' : 'approval', contract: log.address.toLowerCase(), from: topicAddress(log.topics[1]), to: topicAddress(log.topics[2]), rawAmount: BigInt(log.data).toString(), logIndex: Number(integer(log.logIndex ?? '0x0'))});
    } catch { unsupported++; }
  }
  return {events, unsupported};
}

function tokenFact(event, metadata, perspective) {
  const token = metadata[event.contract] || {};
  const decimals = Number.isInteger(token.decimals) && token.decimals >= 0 && token.decimals <= 255 ? token.decimals : null;
  const symbol = typeof token.symbol === 'string' ? token.symbol.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, 36) : null;
  return {...event, symbol: symbol || '토큰 이름 미확인', decimals, amount: decimals === null ? event.rawAmount : formatUnits(event.rawAmount, decimals), amountUnit: decimals === null ? '원시 단위' : symbol || '토큰', metadataVerified: decimals !== null, direction: !perspective ? '관측' : event.from === perspective && event.to === perspective ? '동일 주소' : event.from === perspective ? '나감' : event.to === perspective ? '들어옴' : '다른 주소', evidenceId: `log-${event.logIndex}`, unlimited: event.type === 'approval' && BigInt(event.rawAmount) === 2n ** 256n - 1n};
}

export function interpretFacts({hash, transaction: tx, receipt, blockNumber, finalizedBlockNumber, metadata = {}, source, perspective = null}) {
  if (!tx) return {hash, chain: 'Ethereum Mainnet', status: 'not_found', confidence: 'unknown', category: 'unknown', summary: '이 거래를 찾지 못했습니다.', transfers: [], approvals: [], evidence: [], fee: null, finality: {state: 'unknown', label: '포함 여부 미확인'}, limitations: ['해시와 네트워크를 확인해 주세요. 전파 중인 거래는 나중에 조회될 수 있습니다.'], source};
  if (tx.hash && tx.hash.toLowerCase() !== hash) throw new Error('RPC 거래 해시 불일치');
  if (receipt?.transactionHash && receipt.transactionHash.toLowerCase() !== hash) throw new Error('RPC 영수증 해시 불일치');
  if (perspective && !isAddress(perspective)) throw new Error('관점 주소는 0x로 시작하는 42자리 주소여야 합니다.');
  perspective = perspective?.toLowerCase() || null;
  const status = !receipt ? 'pending' : receipt.status === '0x1' ? 'success' : receipt.status === '0x0' ? 'failed' : 'unknown';
  const base = `https://etherscan.io/tx/${hash}`;
  const evidence = [{id: 'transaction', label: '거래 원본 · 보낸 주소 / 받는 주소 / ETH 값', url: base, fields: ['transaction.from', 'transaction.to', 'transaction.value', 'transaction.input']}, {id: 'receipt', label: '실행 영수증 · 실행 상태 / 수수료', url: base, fields: ['receipt.status', 'receipt.gasUsed', 'receipt.effectiveGasPrice']}];
  const decoded = status === 'success' ? decodeLogs(receipt.logs) : {events: [], unsupported: 0};
  const events = decoded.events.map(event => tokenFact(event, metadata, perspective));
  const transfers = events.filter(event => event.type === 'transfer');
  const approvals = events.filter(event => event.type === 'approval');
  const limitations = ['표시한 토큰 이동은 영수증의 표준 이벤트를 해석한 값입니다. 모든 자산의 실제 잔액 변화나 토큰의 정상 동작을 보장하지 않습니다.', '내부 ETH 이동·스왑 경로·가격·NFT·비표준 토큰은 해석 범위에 포함되지 않습니다.'];
  const value = integer(tx.value || '0x0');
  const basic = Boolean(tx.to) && (!tx.input || tx.input === '0x');
  if (status === 'success' && value > 0n && tx.to) {
    const from = tx.from.toLowerCase(); const to = tx.to.toLowerCase();
    transfers.unshift({type: 'native', symbol: 'ETH', amount: formatUnits(value), amountUnit: 'ETH', rawAmount: value.toString(), decimals: 18, from, to, direction: !perspective ? '관측' : from === perspective && to === perspective ? '동일 주소' : from === perspective ? '나감' : to === perspective ? '들어옴' : '다른 주소', evidenceId: 'transaction', metadataVerified: true});
    limitations.push('ETH 값은 최상위 호출에 보낸 금액입니다. 입력 데이터가 없어도 내부 반환·재전송이 있을 수 있으며, 표시 값은 실제 잔액의 순변화가 아닙니다.');
  }
  for (const event of events) evidence.push({id: event.evidenceId, label: `${event.type === 'approval' ? 'Approval' : 'Transfer'} 이벤트 · 로그 ${event.logIndex}`, url: `${base}#eventlog`, fields: [`receipt.logs[logIndex=${event.logIndex}].topics`, `receipt.logs[logIndex=${event.logIndex}].data`], contract: event.contract});
  if (approvals.length) limitations.push('승인은 해당 거래 시점에 설정된 토큰 사용 한도입니다. 현재 허용량이나 실제 사용 여부는 별도로 조회해야 합니다.');
  if (decoded.unsupported) limitations.push(`이 영수증의 ${decoded.unsupported}개 로그는 지원 범위 밖이므로 의미를 추정하지 않았습니다.`);
  if (events.some(event => !event.metadataVerified)) limitations.push('소수점 정보를 확인하지 못한 토큰은 원시 정수 단위로 표시합니다.');
  if (status === 'failed') limitations.unshift('거래 실행이 되돌려졌습니다. 의도한 자산 이동이나 권한 설정이 완료된 것으로 표시하지 않습니다. 네트워크 수수료는 발생할 수 있습니다.');
  if (status === 'pending') limitations.unshift('블록에 포함된 실행 영수증이 아직 없습니다. 자산 이동과 최종 실행 결과는 확인할 수 없습니다.');
  let fee = null;
  const price = receipt?.effectiveGasPrice || ((!tx.type || tx.type === '0x0' || tx.type === '0x1') ? tx.gasPrice : null);
  if (receipt?.gasUsed && price) {
    const execution = integer(receipt.gasUsed) * integer(price);
    const hasBlob = tx.type === '0x3';
    const blobKnown = receipt.blobGasUsed && receipt.blobGasPrice;
    const blob = blobKnown ? integer(receipt.blobGasUsed) * integer(receipt.blobGasPrice) : 0n;
    fee = {amount: formatUnits(execution + blob), executionAmount: formatUnits(execution), blobAmount: blobKnown ? formatUnits(blob) : null, unit: 'ETH', gasUsed: integer(receipt.gasUsed).toString(), effectiveGasPriceWei: integer(price).toString(), payer: tx.from.toLowerCase(), complete: !hasBlob || Boolean(blobKnown), evidenceId: 'receipt'};
    if (!fee.complete) limitations.push('Blob 수수료 자료가 없어 표시한 수수료는 실행 가스 비용만 포함합니다.');
  }
  const category = approvals.length ? 'approval' : transfers.some(x => x.type === 'transfer') ? 'token_transfer' : basic && status === 'success' ? 'eth_transfer' : 'contract_interaction';
  const supported = status === 'success' && (events.length > 0 || basic);
  const confidence = status === 'pending' || status === 'unknown' ? 'unknown' : status === 'failed' ? 'confirmed' : supported && !decoded.unsupported && !events.some(x => !x.metadataVerified) && (basic || events.length > 0) ? 'confirmed' : 'partial';
  let summary = status === 'pending' ? '아직 처리 중입니다. 실행 결과를 기다리고 있습니다.' : status === 'failed' ? '거래 실행이 실패했습니다. 수수료와 원본 오류를 확인하세요.' : status === 'unknown' ? '영수증은 조회했지만 실행 상태를 확인할 수 없습니다.' : approvals.length && transfers.length ? '토큰 이동과 사용 권한 설정이 함께 관측되었습니다.' : approvals.length ? '토큰을 보낸 것이 아니라, 사용 권한을 설정한 거래입니다.' : transfers.length ? `${transfers.length === 1 ? `${transfers[0].amount} ${transfers[0].amountUnit}` : `${transfers.length}건의 자산 이동`}이 관측되었습니다.` : basic ? 'ETH 전송 형식의 거래가 실행되었습니다. 전송 값은 0 ETH입니다.' : '컨트랙트 실행은 확인했습니다. 지원 범위 안에서 행동을 특정할 수 없습니다.';
  const receiptBlock = receipt?.blockNumber ? integer(receipt.blockNumber) : null;
  const head = blockNumber ? integer(blockNumber) : null;
  const finalized = finalizedBlockNumber ? integer(finalizedBlockNumber) : null;
  const isFinalized = receiptBlock !== null && finalized !== null && finalized >= receiptBlock;
  const finality = {state: receiptBlock === null ? 'unknown' : isFinalized ? 'finalized' : 'included', label: receiptBlock === null ? '포함 여부 미확인' : isFinalized ? '최종 확정 블록에 포함' : '블록 포함 · 최종 확정 미확인', blockNumber: receiptBlock?.toString() || null, confirmations: receiptBlock !== null && head !== null && head >= receiptBlock ? (head - receiptBlock + 1n).toString() : null};
  return {hash, chain: 'Ethereum Mainnet', status, confidence, category, summary, perspective, from: tx.from, to: tx.to, transfers, approvals, fee, evidence, limitations, finality, source, decodedLogCount: events.length, unsupportedLogCount: decoded.unsupported, raw: {transaction: tx, receipt}};
}

export function ruleExplanation(facts) {
  if (facts.status === 'not_found') return '입력한 거래 해시가 Ethereum에 존재하는지 탐색기에서 확인할 수 있습니다.';
  if (facts.status === 'failed') return '실패한 실행은 상태 변경이 되돌려집니다. 실행에 사용한 가스 비용은 자산 이동과 별도로 확인해야 합니다.';
  if (facts.status === 'pending') return '보낸 거래가 네트워크에 알려져도 블록에 포함되기 전까지 실행 결과는 정해지지 않습니다.';
  if (facts.category === 'approval') return '사용 권한 설정은 지정된 주소가 토큰을 사용할 수 있는 한도를 기록합니다. 설정 자체가 토큰 전송을 뜻하지는 않습니다.';
  if (facts.category === 'token_transfer') return '토큰 컨트랙트가 남긴 전송 이벤트에서 보낸 주소와 받는 주소를 읽었습니다. 이벤트만으로 모든 잔액 변화를 알 수는 없습니다.';
  if (facts.category === 'eth_transfer') return 'ETH 전송 값과 네트워크 수수료를 구분해서 표시합니다. 수수료는 거래를 보낸 주소가 네트워크 실행 비용으로 부담합니다.';
  return '실행 영수증으로 처리 결과는 확인할 수 있지만, 지원하지 않는 컨트랙트의 전체 동작이나 사용자 의도까지 단정할 수는 없습니다.';
}
