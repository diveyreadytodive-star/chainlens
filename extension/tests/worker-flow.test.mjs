import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interpretTransaction, REQUEST_TIMEOUT_MS } from '../core/api-client.js';
import { makeResultState } from '../core/state.js';
import { createTabStateSynchronizer, makeLocalInputErrorState, recoverStaleLoading, STALE_LOADING_MS } from '../sidepanel/tab-state.js';
import { createPanelOperationGate } from '../sidepanel/operation-gate.js';

const HASH = `0x${'a'.repeat(64)}`;

function eventSlot() {
  let listener = null;
  return { addListener(next) { listener = next; }, get listener() { return listener; } };
}

function createChromeMock() {
  const storage = new Map();
  const quickStates = [];
  let failFirstQuickMessage = true;
  const mock = {
    contextMenus: { removeAll: async () => undefined, create: () => undefined, onClicked: eventSlot() },
    sidePanel: { open: async () => undefined, setPanelBehavior: async () => undefined },
    action: { onClicked: eventSlot() },
    scripting: { executeScript: async () => undefined },
    tabs: {
      sendMessage: async (_tabId, message) => {
        if (failFirstQuickMessage) { failFirstQuickMessage = false; throw new Error('content script is not injected yet'); }
        quickStates.push(message.state);
      },
      onRemoved: eventSlot(),
      onUpdated: eventSlot()
    },
    runtime: { onInstalled: eventSlot(), onStartup: eventSlot(), onMessage: eventSlot() },
    storage: {
      session: {
        get: async key => ({ [key]: storage.get(key) }),
        set: async values => { for (const [key, value] of Object.entries(values)) storage.set(key, value); },
        remove: async key => storage.delete(key)
      }
    }
  };
  return {
    mock,
    quickStates,
    storage,
    failQuickMessageOnce: () => { failFirstQuickMessage = true; }
  };
}

const chromeMock = createChromeMock();
globalThis.chrome = chromeMock.mock;
const worker = await import(`../service-worker.js?worker-flow=${Date.now()}`);

function facts() {
  return { hash: HASH, status: 'success', summary: '검증된 거래', evidence: [], transfers: [], approvals: [], limitations: [], finality: { state: 'unknown', label: '포함 여부 미확인' } };
}

function validPayload(overrides = {}) {
  return {
    ...facts(),
    evidence: [{ id: 'transaction', label: '거래 원본', url: `https://etherscan.io/tx/${HASH}`, fields: ['transaction.from'] }],
    transfers: [{ type: 'native', from: `0x${'1'.repeat(40)}`, to: `0x${'2'.repeat(40)}`, amount: '1', amountUnit: 'ETH', rawAmount: '1000000000000000000', direction: '관측', metadataVerified: true }],
    limitations: ['지원 범위 안에서 확인한 결과입니다.'],
    explanation: { label: '거래 용어 해설', text: '설명입니다.', cached: false },
    ...overrides
  };
}

test('service worker refreshes quick receipt from loading to result and error', async () => {
  chromeMock.quickStates.length = 0;
  chromeMock.failQuickMessageOnce();
  worker.setInterpretationForTest(async () => facts());
  await worker.runInterpretation(7, HASH, 'context-menu', { showQuick: true });
  assert.deepEqual(chromeMock.quickStates.map(state => state.mode), ['loading', 'result']);

  chromeMock.quickStates.length = 0;
  worker.setInterpretationForTest(async () => { throw new Error('RPC unavailable'); });
  await worker.runInterpretation(7, HASH, 'context-menu', { showQuick: true });
  assert.deepEqual(chromeMock.quickStates.map(state => state.mode), ['loading', 'error']);
  worker.setInterpretationForTest(null);
});

test('context menu prefers a valid selection and otherwise falls back to its link', () => {
  const otherHash = `0x${'b'.repeat(64)}`;
  assert.equal(worker.contextMenuInput({ selectionText: HASH, linkUrl: `https://etherscan.io/tx/${otherHash}` }), HASH);
  assert.equal(worker.contextMenuInput({ selectionText: 'not a transaction', linkUrl: `https://eth.blockscout.com/tx/${HASH}` }), `https://eth.blockscout.com/tx/${HASH}`);
  assert.equal(worker.contextMenuInput({ selectionText: 'not a transaction', linkUrl: 'https://example.com/tx/nope' }), 'not a transaction');
});

test('unsafe evidence URLs are rejected before UI state is created', async () => {
  const payload = validPayload({ evidence: [{ id: 'transaction', label: '거래 원본', url: 'javascript:alert(1)', fields: [] }] });
  await assert.rejects(
    interpretTransaction(HASH, { fetchImpl: async () => new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }) }),
    /원본 근거 URL/
  );
});

test('client rejects null, oversized body, and oversized nested event fields', async () => {
  await assert.rejects(
    interpretTransaction(HASH, { fetchImpl: async () => new Response('null', { status: 200 }) }),
    /응답 형식/
  );
  await assert.rejects(
    interpretTransaction(HASH, { fetchImpl: async () => new Response('x'.repeat(1_000_001), { status: 200 }) }),
    /응답이 너무 큽니다/
  );
  await assert.rejects(
    interpretTransaction(HASH, { fetchImpl: async () => new Response(JSON.stringify(validPayload({ approvals: [null] })), { status: 200 }) }),
    /자산·권한/
  );
  await assert.rejects(
    interpretTransaction(HASH, { fetchImpl: async () => new Response(JSON.stringify(validPayload({ transfers: [{ ...validPayload().transfers[0], amount: '1'.repeat(97) }] })), { status: 200 }) }),
    /자산·권한/
  );
});

test('stored results discard raw RPC data', () => {
  const state = makeResultState(HASH, { ...facts(), raw: { transaction: { input: 'x'.repeat(100_000) }, receipt: {} } }, 'test');
  assert.equal('raw' in state.facts, false);
});

test('local invalid input state hides any prior facts without mutating stored tab data', () => {
  const previous = makeResultState(HASH, facts(), 'context-menu');
  const localError = makeLocalInputErrorState('유효하지 않은 거래 해시입니다.');
  assert.equal(localError.mode, 'input');
  assert.equal('facts' in localError, false);
  assert.equal(previous.mode, 'result');
  assert.equal(previous.facts.summary, '검증된 거래');
});

test('stale loading is recovered locally and requests finish before the MV3 fetch boundary', () => {
  const stale = recoverStaleLoading({ mode: 'loading', input: HASH, updatedAt: 1 }, STALE_LOADING_MS + 2);
  assert.equal(stale.mode, 'error');
  assert.match(stale.message, /다시 시도/);
  const fresh = { mode: 'loading', input: HASH, updatedAt: 10 };
  assert.equal(recoverStaleLoading(fresh, 10 + STALE_LOADING_MS), fresh);
  assert.ok(REQUEST_TIMEOUT_MS < STALE_LOADING_MS);
  assert.equal(REQUEST_TIMEOUT_MS, 22_000);
});

test('a slow earlier operation cannot overwrite the latest tab operation', async () => {
  const pending = [];
  worker.setInterpretationForTest(async () => new Promise(resolve => pending.push(resolve)));
  const first = worker.runInterpretation(42, HASH, 'first');
  await new Promise(resolve => setImmediate(resolve));
  const second = worker.runInterpretation(42, HASH, 'second');
  await new Promise(resolve => setImmediate(resolve));
  pending[1]({ ...facts(), summary: '두 번째 결과' });
  await second;
  pending[0]({ ...facts(), summary: '첫 번째 결과' });
  await first;
  const stored = chromeMock.storage.get('chainlens:tab:42');
  assert.equal(stored.source, 'second');
  assert.equal(stored.facts.summary, '두 번째 결과');
  worker.setInterpretationForTest(null);
});

test('panel state follows activation and only refreshes the currently active tab', async () => {
  let activated;
  let updated;
  const chromeApi = {
    tabs: {
      query: async () => [{ id: 1, windowId: 9 }],
      onActivated: { addListener(listener) { activated = listener; } },
      onUpdated: { addListener(listener) { updated = listener; } }
    }
  };
  const rendered = [];
  let clearCalls = 0;
  const synchronizer = createTabStateSynchronizer({
    chromeApi,
    loadState: async tabId => ({ mode: 'result', tabId }),
    clearState: async () => { clearCalls++; },
    render: state => rendered.push(state)
  });
  synchronizer.register();
  await synchronizer.initialize();
  activated({ tabId: 2, windowId: 9 });
  await new Promise(resolve => setImmediate(resolve));
  activated({ tabId: 3, windowId: 10 });
  updated(1, { status: 'loading' }, { id: 1, windowId: 9 });
  updated(2, { url: 'https://etherscan.io/tx/x' }, { id: 2, windowId: 9 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(synchronizer.activeTabId, 2);
  assert.equal(clearCalls, 1);
  assert.deepEqual(rendered.map(state => state.tabId), [1, 2, undefined]);
});

test('a stale tab-state read cannot render after a newer tab becomes active', async () => {
  const pending = new Map();
  const rendered = [];
  const synchronizer = createTabStateSynchronizer({
    chromeApi: { tabs: { query: async () => [], onActivated: eventSlot(), onUpdated: eventSlot() } },
    loadState: tabId => new Promise(resolve => pending.set(tabId, resolve)),
    render: state => rendered.push(state)
  });
  const first = synchronizer.refresh(1, 9);
  const second = synchronizer.refresh(2, 9);
  pending.get(2)({ mode: 'result', tabId: 2 });
  await second;
  pending.get(1)({ mode: 'result', tabId: 1 });
  await first;
  assert.deepEqual(rendered.map(state => state.tabId), [2]);
});

test('panel operation gate ignores stale storage while a newer local request is pending', () => {
  const rendered = [];
  const gate = createPanelOperationGate(state => rendered.push(state));
  gate.accept(7, { mode: 'result', operationId: 'old', facts: { summary: 'old' } });
  gate.begin(7, 'panel:new-operation');
  assert.equal(gate.accept(7, { mode: 'result', operationId: 'old', facts: { summary: 'old' } }), false);
  assert.equal(gate.accept(7, { mode: 'loading', operationId: 'panel:new-operation' }), true);
  assert.equal(gate.accept(7, { mode: 'result', operationId: 'panel:new-operation', facts: { summary: 'new' } }), true);
  assert.deepEqual(rendered.map(state => state.facts?.summary), ['old', undefined, 'new']);
  gate.invalidate();
  assert.equal(gate.accept(7, { mode: 'result', operationId: 'panel:new-operation', facts: { summary: 'late' } }), false);
});
