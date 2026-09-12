import { isAddress, parseTransactionInput, explorerUrl, trustedEvidenceUrl } from '../core/input-parser.js';
import { clearTabState, getTabState, tabStateKey } from '../core/state.js';
import { createPanelOperationGate } from './operation-gate.js';
import { createTabStateSynchronizer, makeLocalInputErrorState, recoverStaleLoading } from './tab-state.js';

const $ = selector => document.querySelector(selector);
const form = $('#input-form');
const input = $('#transaction-input');
const result = $('#result');
const loading = $('#loading');
const empty = $('#empty');
const message = $('#message');
const dot = $('#state-dot');

function text(value, fallback = '확인되지 않음') { return typeof value === 'string' && value.trim() ? value : fallback; }
function short(value) { return typeof value === 'string' && value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : text(value); }
function add(parent, tag, value, className = '') { const node = document.createElement(tag); if (className) node.className = className; node.textContent = text(value, ''); parent.append(node); return node; }
function section(parent, title) { const node = document.createElement('section'); node.className = 'card'; add(node, 'h2', title); parent.append(node); return node; }
function link(url, label) { const node = document.createElement('a'); node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer'; node.textContent = label; return node; }
function copyButton(value) {
  const node = document.createElement('button');
  node.type = 'button'; node.className = 'copy-button'; node.textContent = '복사';
  node.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(value);
      node.textContent = '복사됨';
      setTimeout(() => { node.textContent = '복사'; }, 1400);
    } catch { node.textContent = '복사 실패'; }
  });
  return node;
}
function addAddress(parent, label, value) {
  if (!isAddress(value)) return;
  const row = document.createElement('div'); row.className = 'address-row';
  add(row, 'span', label, 'address-label');
  const code = document.createElement('code'); code.textContent = value; row.append(code, copyButton(value));
  parent.append(row);
}
function statusLabel(status) { return ({ success: '실행 성공', failed: '실행 실패', pending: '처리 중', not_found: '거래 없음', unknown: '실행 미확인' })[status] || '실행 미확인'; }
function confidenceLabel(confidence) { return ({ confirmed: '사실 확인됨', partial: '부분 확인', unknown: '해석 불가 / 대기' })[confidence] || '해석 불가 / 대기'; }
function resultDotClass(status) { return ({ success: 'success-dot', failed: 'error-dot', pending: 'pending-dot', not_found: 'unknown-dot', unknown: 'unknown-dot' })[status] || 'unknown-dot'; }

function showMessage(value = '', type = '') { message.hidden = !value; message.className = `message ${type}`; message.textContent = value; }
function resetView() { result.replaceChildren(); result.hidden = true; loading.hidden = true; empty.hidden = true; dot.className = ''; }

function renderFacts(facts) {
  result.replaceChildren();
  const overview = section(result, facts.summary);
  add(overview, 'span', statusLabel(facts.status), `badge ${facts.status || 'unknown'}`);
  add(overview, 'p', `${facts.chain || 'Ethereum Mainnet'} · ${confidenceLabel(facts.confidence)}`, 'muted');
  addAddress(overview, '보낸 주소', facts.from);
  addAddress(overview, '받는 주소', facts.to);
  if (facts.explanation?.text) {
    const ai = document.createElement('div'); ai.className = 'explanation';
    add(ai, 'strong', text(facts.explanation.label, '규칙 기반 설명'));
    add(ai, 'p', facts.explanation.text);
    if (facts.explanation.reason) add(ai, 'p', facts.explanation.reason, 'muted');
    overview.append(ai);
  }
  const movements = section(result, '관측한 자산 이동');
  if (!facts.transfers?.length) add(movements, 'p', facts.status === 'failed' ? '실패한 실행의 이동은 완료로 표시하지 않습니다.' : '지원 범위 안에서 확인한 이동이 없습니다.', 'muted');
  for (const item of facts.transfers || []) {
    const card = document.createElement('article'); card.className = 'event';
    add(card, 'strong', `${text(item.amount)} ${text(item.amountUnit)}`);
    add(card, 'p', `${short(item.from)} → ${short(item.to)}`);
    addAddress(card, '보낸 주소', item.from);
    addAddress(card, '받는 주소', item.to);
    addAddress(card, '토큰 컨트랙트', item.contract);
    add(card, 'p', `분류: ${text(item.direction)}`, 'muted'); movements.append(card);
  }
  const approvals = section(result, '토큰 사용 권한');
  if (!facts.approvals?.length) add(approvals, 'p', '이 거래에서 표준 Approval 이벤트는 확인되지 않았습니다.', 'muted');
  for (const item of facts.approvals || []) {
    const card = document.createElement('article'); card.className = 'event approval';
    add(card, 'strong', item.unlimited ? '최대 정수 한도 (uint256 max)' : `${text(item.amount)} ${text(item.amountUnit)}`);
    add(card, 'p', `${short(item.from)} → ${short(item.to)}`);
    addAddress(card, '권한을 준 주소', item.from);
    addAddress(card, '사용 가능 주소', item.to);
    addAddress(card, '토큰 컨트랙트', item.contract);
    add(card, 'p', '당시 설정한 한도이며, 현재 허용량이나 실제 전송을 뜻하지 않습니다.', 'muted'); approvals.append(card);
  }
  const details = section(result, '수수료와 블록 상태');
  add(details, 'p', `네트워크 수수료: ${facts.fee ? `${facts.fee.amount} ETH · ${facts.fee.gasUsed} gas` : '확인되지 않음'}`);
  add(details, 'p', `${text(facts.finality?.label)}${facts.finality?.blockNumber ? ` · 블록 #${facts.finality.blockNumber}` : ''}`);
  const evidence = section(result, '설명의 원본 근거');
  if (!facts.evidence?.length) add(evidence, 'p', '표시할 원본 근거가 없습니다.', 'muted');
  for (const item of facts.evidence || []) {
    const url = trustedEvidenceUrl(item?.url, facts.hash);
    if (!url) continue;
    const row = document.createElement('p'); row.append(link(url, `${text(item.label)} ↗`)); evidence.append(row);
  }
  const limits = section(result, '해석 범위와 주의사항');
  const list = document.createElement('ul');
  for (const item of facts.limitations || []) add(list, 'li', item);
  limits.append(list);
  const sourceUrl = trustedEvidenceUrl(explorerUrl(facts.hash), facts.hash);
  if (sourceUrl) {
    const source = document.createElement('p'); source.className = 'source'; source.append(link(sourceUrl, `Etherscan 원본 ${short(facts.hash)} ↗`)); result.append(source);
  }
  result.hidden = false;
}

function render(state) {
  state = recoverStaleLoading(state);
  resetView(); showMessage('');
  if (!state || state.mode === 'input') { empty.hidden = false; if (state?.message) showMessage(state.message, state.localError ? 'error' : ''); return; }
  if (state.input) input.value = state.input;
  if (state.mode === 'loading') { loading.hidden = false; dot.className = 'loading-dot'; return; }
  if (state.mode === 'error') { empty.hidden = false; showMessage(state.message, 'error'); dot.className = 'error-dot'; return; }
  if (state.mode === 'result') { dot.className = resultDotClass(state.facts.status); renderFacts(state.facts); }
}

let operationCounter = 0;
const nextOperationId = () => `panel:${Date.now().toString(36)}:${(++operationCounter).toString(36)}`;
const operationGate = createPanelOperationGate(render);
function renderExternal(state) {
  if (state?.mode === 'input' && state.message?.startsWith('페이지가')) {
    operationGate.invalidate();
    render(state);
    return;
  }
  operationGate.accept(tabState.activeTabId, state);
}
const tabState = createTabStateSynchronizer({ chromeApi: chrome, loadState: getTabState, clearState: clearTabState, render: renderExternal });

form.addEventListener('submit', async event => {
  event.preventDefault();
  let hash;
  try { hash = parseTransactionInput(input.value); } catch (error) { operationGate.invalidate(); render(makeLocalInputErrorState(error.message)); return; }
  if (tabState.activeTabId === null) { showMessage('활성 탭을 찾지 못했습니다.', 'error'); return; }
  const operationId = nextOperationId();
  operationGate.begin(tabState.activeTabId, operationId);
  showMessage(''); render({ mode: 'loading', input: hash, operationId });
  try {
    const response = await chrome.runtime.sendMessage({ type: 'chainlens:interpret-input', tabId: tabState.activeTabId, input: hash, operationId });
    if (!response?.ok) {
      operationGate.invalidate();
      render({ mode: 'error', input: hash, message: response?.error || '해석을 시작하지 못했습니다.' });
    } else if (response.state) renderExternal(response.state);
  } catch {
    operationGate.invalidate();
    render({ mode: 'error', input: hash, message: '확장 프로그램과 통신하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.' });
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'session' || tabState.activeTabId === null) return;
  const change = changes[tabStateKey(tabState.activeTabId)];
  if (change?.newValue) renderExternal(change.newValue);
});

tabState.register();
tabState.initialize().catch(error => render({ mode: 'input', message: error.message }));
