export function createPanelOperationGate(render) {
  let pending = null;
  let lastRenderedOperationId = null;
  const ignored = new Set();

  function ignore(operationId) {
    if (!operationId) return;
    ignored.add(operationId);
    if (ignored.size > 32) ignored.delete(ignored.values().next().value);
  }

  function begin(tabId, operationId) {
    if (pending) ignore(pending.operationId);
    ignore(lastRenderedOperationId);
    pending = { tabId, operationId };
  }

  function invalidate() {
    if (pending) ignore(pending.operationId);
    ignore(lastRenderedOperationId);
    pending = null;
  }

  function accept(tabId, state) {
    const operationId = state?.operationId || null;
    if (operationId && ignored.has(operationId)) return false;
    if (pending) {
      if (tabId !== pending.tabId || operationId !== pending.operationId) return false;
      if (state.mode === 'result' || state.mode === 'error') {
        lastRenderedOperationId = operationId;
        pending = null;
      }
    } else if (operationId) {
      lastRenderedOperationId = operationId;
    }
    render(state);
    return true;
  }

  return { begin, invalidate, accept, get pendingOperationId() { return pending?.operationId || null; } };
}
