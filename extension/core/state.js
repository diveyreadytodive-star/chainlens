const PREFIX = 'chainlens:tab:';

function key(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) throw new Error('유효하지 않은 탭입니다.');
  return `${PREFIX}${tabId}`;
}

export function makeInputState(message = null) {
  return { version: 1, mode: 'input', message, updatedAt: Date.now() };
}

export function makeLoadingState(input, hash, source, operationId = null) {
  return { version: 1, mode: 'loading', input, hash, source, operationId, updatedAt: Date.now() };
}

export function makeResultState(input, facts, source, operationId = null) {
  const safeFacts = compactFacts(facts);
  return { version: 1, mode: 'result', input, hash: safeFacts.hash, facts: safeFacts, source, operationId, updatedAt: Date.now() };
}

function compactFacts(facts) {
  const sourceFacts = facts || {};
  const result = {};
  for (const key of ['hash', 'chain', 'status', 'confidence', 'category', 'summary', 'perspective', 'from', 'to', 'decodedLogCount', 'unsupportedLogCount']) {
    if (sourceFacts[key] !== undefined) result[key] = sourceFacts[key];
  }
  result.transfers = compactEvents(sourceFacts.transfers);
  result.approvals = compactEvents(sourceFacts.approvals);
  result.evidence = Array.isArray(sourceFacts.evidence) ? sourceFacts.evidence.map(({ id, label, url, fields, contract }) => ({ id, label, url, fields, ...(contract === undefined ? {} : { contract }) })) : [];
  result.limitations = Array.isArray(sourceFacts.limitations) ? [...sourceFacts.limitations] : [];
  result.fee = sourceFacts.fee ? compactObject(sourceFacts.fee, ['amount', 'unit', 'gasUsed', 'payer', 'complete']) : sourceFacts.fee ?? null;
  result.finality = sourceFacts.finality ? compactObject(sourceFacts.finality, ['state', 'label', 'blockNumber', 'confirmations']) : null;
  result.explanation = sourceFacts.explanation ? compactObject(sourceFacts.explanation, ['label', 'text', 'reason', 'cached']) : null;
  return result;
}

function compactEvents(events) {
  return Array.isArray(events) ? events.map(event => compactObject(event, ['type', 'contract', 'from', 'to', 'rawAmount', 'amount', 'amountUnit', 'symbol', 'direction', 'evidenceId', 'metadataVerified', 'unlimited'])) : [];
}

function compactObject(value, keys) {
  const result = {};
  for (const key of keys) if (value?.[key] !== undefined) result[key] = value[key];
  return result;
}

export function makeErrorState(input, message, source, operationId = null) {
  return { version: 1, mode: 'error', input, message, source, operationId, updatedAt: Date.now() };
}

export async function getTabState(tabId) {
  const stored = await chrome.storage.session.get(key(tabId));
  return stored[key(tabId)] || null;
}

export async function setTabState(tabId, state) {
  await chrome.storage.session.set({ [key(tabId)]: state });
  return state;
}

export async function clearTabState(tabId) {
  await chrome.storage.session.remove(key(tabId));
}

export function tabStateKey(tabId) {
  return key(tabId);
}
