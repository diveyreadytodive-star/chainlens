import { interpretTransaction } from './core/api-client.js';
import { parseExplorerTransactionUrl, parseTransactionInput } from './core/input-parser.js';
import { clearTabState, makeErrorState, makeInputState, makeLoadingState, makeResultState, setTabState } from './core/state.js';

const MENU_ID = 'chainlens-interpret-ethereum';
const tabOperations = new Map();
let operationCounter = 0;

async function injectQuickReceipt(tabId, state) {
  if (!Number.isInteger(tabId)) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'chainlens:show-quick-receipt', state });
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content/quick-receipt.js'] });
      await chrome.tabs.sendMessage(tabId, { type: 'chainlens:show-quick-receipt', state });
    } catch {
      // Restricted Chrome pages cannot host a content-script receipt. The panel still retains state.
    }
  }
}

async function updateState(tabId, state, { showQuick = false } = {}) {
  await setTabState(tabId, state);
  if (showQuick) await injectQuickReceipt(tabId, state);
  return state;
}

function beginOperation(tabId, requestedId = null) {
  const operationId = typeof requestedId === 'string' && /^panel:[a-z0-9:-]{8,120}$/i.test(requestedId) ? requestedId : `${Date.now()}:${++operationCounter}`;
  tabOperations.set(tabId, operationId);
  return operationId;
}

function isCurrentOperation(tabId, operationId) {
  return tabOperations.get(tabId) === operationId;
}

let interpret = interpretTransaction;

export function setInterpretationForTest(nextInterpret) {
  interpret = typeof nextInterpret === 'function' ? nextInterpret : interpretTransaction;
}

export function contextMenuInput(info) {
  if (typeof info?.selectionText === 'string') {
    try {
      parseTransactionInput(info.selectionText);
      return info.selectionText;
    } catch {
      // A selected non-hash should not block a valid transaction link under the cursor.
    }
  }
  if (typeof info?.linkUrl === 'string') {
    try {
      parseTransactionInput(info.linkUrl);
      return info.linkUrl;
    } catch {
      // Return the original candidate below so runInterpretation can display its strict parser error.
    }
  }
  return typeof info?.selectionText === 'string' ? info.selectionText : info?.linkUrl || '';
}

export async function runInterpretation(tabId, input, source, { showQuick = false, operationId: requestedId = null } = {}) {
  const operationId = beginOperation(tabId, requestedId);
  let hash;
  try {
    hash = parseTransactionInput(input);
  } catch (error) {
    return updateState(tabId, makeErrorState(input, error.message, source, operationId), { showQuick });
  }

  await updateState(tabId, makeLoadingState(input, hash, source, operationId), { showQuick });
  try {
    const facts = await interpret(hash);
    if (!isCurrentOperation(tabId, operationId)) return null;
    return updateState(tabId, makeResultState(input, facts, source, operationId), { showQuick });
  } catch (error) {
    if (!isCurrentOperation(tabId, operationId)) return null;
    return updateState(tabId, makeErrorState(input, error.message, source, operationId), { showQuick });
  }
}

async function openSidePanel(tabId) {
  await chrome.sidePanel.open({ tabId });
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'ChainLens로 Ethereum 거래 해석',
    contexts: ['selection', 'link']
  });
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  const input = contextMenuInput(info);
  await runInterpretation(tab.id, input, 'context-menu', { showQuick: true });
});

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  try {
    const hash = parseExplorerTransactionUrl(tab.url || '');
    await openSidePanel(tab.id);
    await runInterpretation(tab.id, hash, 'toolbar');
  } catch {
    tabOperations.delete(tab.id);
    await setTabState(tab.id, makeInputState('이 페이지는 자동 인식을 지원하지 않습니다. Ethereum 거래 해시나 지원 탐색기 링크를 입력해 주세요.'));
    await openSidePanel(tab.id);
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  tabOperations.delete(tabId);
  clearTabState(tabId).catch(() => undefined);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'loading' && !changeInfo.url) return;
  tabOperations.delete(tabId);
  clearTabState(tabId).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id ?? message?.tabId;
  if (!message || !Number.isInteger(tabId)) return undefined;
  if (message.type === 'chainlens:open-side-panel') {
    openSidePanel(tabId).then(() => sendResponse({ ok: true })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'chainlens:interpret-input') {
    runInterpretation(tabId, message.input || '', 'side-panel', { operationId: message.operationId }).then(state => sendResponse({ ok: true, state })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return undefined;
});
