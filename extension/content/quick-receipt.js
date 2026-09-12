const HOST_ID = 'chainlens-quick-receipt-host';
let host;
let root;
let receipt;
let activeState;
let cssReady;
const HASH = /^0x[0-9a-f]{64}$/i;
const EXPLORER_HOSTS = new Set(['etherscan.io', 'www.etherscan.io', 'eth.blockscout.com']);

function text(value, fallback = '확인되지 않음') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function shortAddress(value) {
  return typeof value === 'string' && value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : text(value);
}

function statusLabel(status) {
  return ({ success: '실행 성공', failed: '실행 실패', pending: '처리 중', not_found: '거래 없음', unknown: '실행 미확인' })[status] || '실행 미확인';
}

function append(parent, tag, value, className = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text(value, '');
  parent.append(node);
  return node;
}

function button(label, className, onClick) {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = label;
  node.addEventListener('click', onClick);
  return node;
}

function sourceLink(facts) {
  const url = safeEvidenceUrl(facts?.evidence?.find(item => item.id === 'transaction')?.url, facts?.hash) || safeEvidenceUrl(facts?.hash ? `https://etherscan.io/tx/${facts.hash}` : null, facts?.hash);
  if (!url) return null;
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'chainlens-link';
  link.textContent = '원본 보기 ↗';
  return link;
}

function safeEvidenceUrl(value, hash) {
  if (typeof value !== 'string' || typeof hash !== 'string' || !HASH.test(hash)) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  const expectedPath = `/tx/${hash.toLowerCase()}`;
  if (url.protocol !== 'https:' || !EXPLORER_HOSTS.has(url.hostname) || url.port || url.username || url.password || (url.pathname !== expectedPath && url.pathname !== `${expectedPath}/`) || url.search) return null;
  return url.href;
}

async function ensureRoot() {
  if (root && host?.isConnected) return;
  if (root) { root = undefined; receipt = undefined; }
  host = document.createElement('div');
  host.id = HOST_ID;
  if (!host.isConnected) document.documentElement.append(host);
  root = host.shadowRoot || host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = await getCss();
  root.append(style);
  receipt = document.createElement('section');
  receipt.className = 'chainlens-receipt';
  receipt.setAttribute('role', 'dialog');
  receipt.setAttribute('aria-label', 'ChainLens 빠른 영수증');
  root.append(receipt);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && host?.isConnected) close();
  });
}

function getCss() {
  cssReady ||= fetch(chrome.runtime.getURL('content/quick-receipt.css')).then(response => {
    if (!response.ok) throw new Error('빠른 영수증 스타일을 불러오지 못했습니다.');
    return response.text();
  });
  return cssReady;
}

function positionReceipt() {
  const range = window.getSelection?.()?.rangeCount ? window.getSelection().getRangeAt(0) : null;
  const rect = range?.getBoundingClientRect?.();
  const left = rect && rect.width + rect.height > 0 ? Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - 388)) : Math.max(12, window.innerWidth - 404);
  const top = rect && rect.width + rect.height > 0 ? Math.min(Math.max(12, rect.bottom + 12), Math.max(12, window.innerHeight - 420)) : 20;
  receipt.style.left = `${left}px`;
  receipt.style.top = `${top}px`;
}

function close() {
  host?.remove();
  host = undefined;
  root = undefined;
  receipt = undefined;
}

function render(state) {
  activeState = state;
  receipt.replaceChildren();
  positionReceipt();
  const header = document.createElement('header');
  append(header, 'strong', 'ChainLens');
  header.append(button('닫기', 'chainlens-close', close));
  receipt.append(header);

  if (state.mode === 'loading') {
    append(receipt, 'p', 'Ethereum 거래 원본을 확인하고 있습니다.', 'chainlens-loading');
    append(receipt, 'p', shortAddress(state.hash), 'chainlens-hash');
    return;
  }
  if (state.mode === 'error') {
    append(receipt, 'p', '해석을 시작하지 못했습니다.', 'chainlens-title');
    append(receipt, 'p', text(state.message), 'chainlens-error');
    receipt.append(button('오른쪽에서 입력하기', 'chainlens-primary', () => chrome.runtime.sendMessage({ type: 'chainlens:open-side-panel' })));
    return;
  }

  const facts = state.facts;
  if (!facts) return;
  const status = append(receipt, 'span', statusLabel(facts.status), `chainlens-status ${facts.status || 'unknown'}`);
  status.setAttribute('aria-live', 'polite');
  append(receipt, 'h2', facts.summary, 'chainlens-title');
  const mainFact = facts.approvals?.[0] || facts.transfers?.[0];
  if (mainFact) {
    const fact = document.createElement('div');
    fact.className = 'chainlens-fact';
    append(fact, 'span', facts.approvals?.length ? '사용 권한 설정' : '관측한 자산 이동', 'chainlens-label');
    append(fact, 'strong', `${text(mainFact.amount)} ${text(mainFact.amountUnit)}`);
    append(fact, 'small', `${shortAddress(mainFact.from)} → ${shortAddress(mainFact.to)}`);
    receipt.append(fact);
  }
  if (facts.fee) append(receipt, 'p', `네트워크 수수료 ${facts.fee.amount} ETH`, 'chainlens-metric');
  const explanation = facts.explanation;
  if (explanation?.text) {
    const explanationBox = document.createElement('div');
    explanationBox.className = 'chainlens-explanation';
    append(explanationBox, 'span', text(explanation.label, '규칙 기반 설명'), 'chainlens-label');
    append(explanationBox, 'p', explanation.text);
    receipt.append(explanationBox);
  }
  const footer = document.createElement('footer');
  const original = sourceLink(facts);
  if (original) footer.append(original);
  footer.append(button('오른쪽에서 자세히 보기', 'chainlens-primary', () => chrome.runtime.sendMessage({ type: 'chainlens:open-side-panel' })));
  receipt.append(footer);
}

chrome.runtime.onMessage.addListener(message => {
  if (message?.type !== 'chainlens:show-quick-receipt') return;
  ensureRoot().then(() => render(message.state)).catch(() => undefined);
});
