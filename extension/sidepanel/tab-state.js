export const STALE_LOADING_MS = 30_000;

export function recoverStaleLoading(state, now = Date.now()) {
  if (state?.mode !== 'loading' || !Number.isFinite(state.updatedAt) || now - state.updatedAt <= STALE_LOADING_MS) return state;
  return {
    mode: 'error',
    input: state.input || '',
    message: '이전 해석 요청이 완료되지 않았습니다. 거래 해시를 확인한 뒤 다시 시도해 주세요.',
    staleLoading: true
  };
}

export function makeLocalInputErrorState(message) {
  return { mode: 'input', message, localError: true };
}

export function createTabStateSynchronizer({ chromeApi = chrome, loadState, clearState = async () => undefined, render }) {
  let activeTabId = null;
  let activeWindowId = null;
  let generation = 0;

  async function refresh(tabId, windowId = null) {
    const requestGeneration = ++generation;
    activeTabId = Number.isInteger(tabId) ? tabId : null;
    activeWindowId = Number.isInteger(windowId) ? windowId : activeWindowId;
    if (activeTabId === null) return render({ mode: 'input', message: '활성 탭을 찾지 못했습니다.' });
    const state = await loadState(activeTabId);
    if (requestGeneration !== generation || tabId !== activeTabId) return undefined;
    return render(state);
  }

  async function initialize() {
    const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
    return refresh(tab?.id, tab?.windowId);
  }

  function register() {
    chromeApi.tabs.onActivated.addListener(info => {
      if (activeWindowId !== null && info.windowId !== activeWindowId) return;
      void refresh(info.tabId, info.windowId);
    });
    chromeApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      const windowId = tab?.windowId ?? activeWindowId;
      if (tabId !== activeTabId || (activeWindowId !== null && windowId !== activeWindowId)) return;
      if (changeInfo.url || changeInfo.status === 'loading') {
        const requestGeneration = ++generation;
        void clearState(tabId).finally(() => {
          if (requestGeneration === generation && tabId === activeTabId) render({ mode: 'input', message: '페이지가 바뀌었습니다. 거래 해시 또는 지원 탐색기 링크를 입력해 주세요.' });
        });
        return;
      }
      if (changeInfo.status === 'complete') void refresh(tabId, windowId);
    });
  }

  return {
    initialize,
    register,
    refresh,
    get activeTabId() { return activeTabId; },
    get activeWindowId() { return activeWindowId; }
  };
}
