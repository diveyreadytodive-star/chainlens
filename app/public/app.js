const $ = selector => document.querySelector(selector);
const form = $('#interpret-form');
const input = $('#transaction-input');
const perspective = $('#perspective-input');
const submit = $('#interpret-button');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const short = address => address ? `${address.slice(0, 8)}…${address.slice(-6)}` : '확인 안 됨';
const address = (value, label) => `<div><span class="address-label">${escape(label)}</span>${value ? `<a class="address-link" href="https://etherscan.io/address/${encodeURIComponent(value)}" target="_blank" rel="noopener noreferrer" title="${escape(value)}">${escape(short(value))} ↗</a>` : '<span class="address-link">없음</span>'}</div>`;
const date = value => value ? new Date(value).toLocaleString('ko-KR', {timeZone:'Asia/Seoul',hour12:false}) + ' KST' : '시점 미확인';
let activeExample = null;
let busy = false;
let exampleList = [];

function evidenceLink(facts, id) {
  const entry = facts.evidence.find(x => x.id === id);
  return entry ? `<a class="evidence-link" href="${escape(entry.url)}" target="_blank" rel="noopener noreferrer">원본 근거 ${entry.id.startsWith('log-') ? `· 로그 ${escape(entry.id.slice(4))}` : ''} ↗</a>` : '';
}

function render(facts) {
  const states = {success: ['실행 성공', 'success'], failed: ['실행 실패', 'failed'], pending: ['처리 중', 'pending'], unknown: ['실행 미확인', 'partial'], not_found: ['거래 없음', 'partial']};
  const confidence = {confirmed:'사실 확인됨', partial:'부분 확인', unknown:'해석 불가 / 대기'};
  const [statusLabel, stateClass] = states[facts.status] || states.unknown;
  const stored = facts.source.mode === 'stored';
  $('#result-mode').textContent = stored ? 'STORED REPLAY' : 'LIVE RPC';
  $('#results').innerHTML = `<div class="receipt-top"><span class="badge ${stateClass}">${facts.status === 'success' ? '✓' : facts.status === 'failed' ? '×' : '·'} ${statusLabel}</span><span class="badge ${facts.confidence === 'partial' ? 'partial' : ''}">${confidence[facts.confidence]}</span><span class="badge stored">${stored ? '저장된 실제 거래' : '실시간 RPC 조회'}</span></div>
    <h3 class="summary-title">${escape(facts.summary)}</h3>
    <div class="ai-explanation"><div class="ai-heading">✧ ${escape(facts.explanation.label)}${facts.explanation.cached ? ' · 검증된 해설 재사용' : ''}</div><p>${escape(facts.explanation.text)}</p></div>
    ${facts.perspective ? `<p class="small-note">관점 주소: <span class="address-link" title="${escape(facts.perspective)}">${escape(short(facts.perspective))}</span> · 소유권 미확인</p>` : ''}
    <section class="fact-section"><h3>관측한 자산 이동 <span>수수료 별도</span></h3>${facts.transfers.length ? facts.transfers.map(t => `<article class="transfer-card"><div class="amount-row"><div class="asset-amount">${escape(t.amount)}<span>${escape(t.amountUnit)}</span></div><span class="direction">${escape(t.direction)}</span></div><div class="address-flow">${address(t.from,'보낸 주소')}<span class="flow-arrow" aria-label="에서 받는 주소로">→</span>${address(t.to,'받는 주소')}</div>${t.contract ? `<p class="small-note">토큰 컨트랙트 <a class="address-link" href="https://etherscan.io/token/${escape(t.contract)}" target="_blank" rel="noopener noreferrer" title="${escape(t.contract)}">${escape(short(t.contract))} ↗</a></p>` : ''}${!t.metadataVerified ? '<p class="small-note">소수점 정보를 확인하지 못해 원시 단위로 표시합니다.</p>' : ''}${evidenceLink(facts,t.evidenceId)}</article>`).join('') : `<p class="empty-fact">${facts.status === 'failed' ? '실패한 실행의 이동은 완료로 표시하지 않습니다.' : '지원 범위 안에서 확인한 자산 이동이 없습니다.'}</p>`}</section>
    ${facts.approvals.length ? `<section class="fact-section"><h3>토큰 사용 권한 <span>전송과 별개</span></h3>${facts.approvals.map(a => `<article class="approval-card"><p class="approval-label">이 거래 시점에 설정한 한도</p><div class="approval-amount">${a.unlimited ? '최대 정수 한도 (uint256 max)' : `${escape(a.amount)} ${escape(a.amountUnit)}`}</div><div class="address-flow">${address(a.from,'권한을 준 주소')}<span class="flow-arrow">→</span>${address(a.to,'사용할 수 있는 주소')}</div><p class="small-note">토큰 컨트랙트 <a class="address-link" href="https://etherscan.io/token/${escape(a.contract)}" target="_blank" rel="noopener noreferrer" title="${escape(a.contract)}">${escape(short(a.contract))} ↗</a></p><div class="approval-warning">현재 허용량이나 실제 토큰 전송을 뜻하지 않습니다.</div>${evidenceLink(facts,a.evidenceId)}</article>`).join('')}</section>` : ''}
    <div class="metrics"><div class="metric"><div class="metric-label">네트워크 수수료${facts.fee?.complete === false ? ' · 일부' : ''}</div><div class="metric-value">${facts.fee ? `${escape(facts.fee.amount)} ETH` : '확인되지 않음'}</div><div class="metric-sub">${facts.fee ? `보낸 주소가 부담 · ${escape(facts.fee.gasUsed)} gas` : '영수증과 가스 가격 자료가 필요합니다.'}</div></div><div class="metric"><div class="metric-label">블록 확정 상태</div><div class="metric-value">${escape(facts.finality.label)}</div><div class="metric-sub">${facts.finality.blockNumber ? `블록 #${escape(facts.finality.blockNumber)}` : '실행 성공과 최종 확정은 구분됩니다.'}${facts.finality.confirmations ? ` · 확인 ${escape(facts.finality.confirmations)}회` : ''}</div></div></div>
    <details class="raw-details"><summary>설명에 사용한 원본 근거 <span>↗</span></summary><ul class="evidence-list">${facts.evidence.map(e => `<li><a href="${escape(e.url)}" target="_blank" rel="noopener noreferrer">${escape(e.label)} ↗</a><span class="evidence-fields">${escape(e.fields.join(' · '))}</span></li>`).join('')}</ul><details><summary>조회한 거래 · 영수증 JSON</summary><pre>${escape(JSON.stringify(facts.raw || {}, null, 2))}</pre></details></details>
    <details class="limitations"><summary>해석 범위와 주의사항</summary><ul>${facts.limitations.map(x=>`<li>${escape(x)}</li>`).join('')}</ul></details>
    <div class="source-row"><strong>${stored ? '저장 예제 재생' : '실시간 RPC'} · ${escape(facts.source.provider)}</strong><br>원본 조회: ${escape(date(facts.source.fetchedAt))}${facts.source.cached ? ' · 최근 응답 캐시' : ''}<br>거래 해시: <a href="https://etherscan.io/tx/${escape(facts.hash)}" target="_blank" rel="noopener noreferrer" title="${escape(facts.hash)}">${escape(short(facts.hash))} ↗</a></div>`;
}

async function run(exampleId = null) {
  if (busy) return;
  busy = true; submit.disabled = true;
  document.querySelectorAll('.example-button').forEach(button => {button.disabled = true; button.classList.toggle('selected', button.dataset.id === exampleId);});
  $('#form-error').hidden = true; $('#empty-state').hidden = true; $('#results').hidden = true; $('#loading-state').hidden = false;
  try {
    const response = await fetch('/api/interpret', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({input:input.value,perspective:perspective.value.trim() || undefined,exampleId:exampleId || undefined}),signal:AbortSignal.timeout(90000)});
    const facts = await response.json();
    if (!response.ok) throw new Error(facts.error || '거래를 해석하지 못했습니다.');
    render(facts); $('#results').hidden = false;
  } catch (error) { $('#form-error').textContent = error.name === 'TimeoutError' ? '응답 시간이 길어지고 있습니다. 저장 예제를 이용하거나 다시 조회해 주세요.' : error.message; $('#form-error').hidden = false; $('#empty-state').hidden = false; }
  finally { busy = false; submit.disabled = false; document.querySelectorAll('.example-button').forEach(button => button.disabled = false); $('#loading-state').hidden = true; }
}
form.addEventListener('submit', event => {event.preventDefault(); activeExample=null; run();});
input.addEventListener('input', () => {activeExample=null;document.querySelectorAll('.example-button').forEach(button=>button.classList.remove('selected'));});
input.addEventListener('keydown', event => {if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {event.preventDefault();form.requestSubmit();}});
perspective.addEventListener('change', () => {if (activeExample && !busy) run(activeExample);});

async function loadExamples() {
  try {
    const response = await fetch('/api/examples');
    exampleList = (await response.json()).examples || [];
    const icons = {'eth-transfer':'↗','erc20-transfer':'⇄','approval':'⚿','failed':'×'};
    $('#examples').innerHTML = exampleList.length ? exampleList.map(e => `<button type="button" class="example-button" data-id="${escape(e.id)}"><span class="example-icon" aria-hidden="true">${icons[e.kind] || '↗'}</span><span>${escape(e.label)}</span><span class="arrow" aria-hidden="true">→</span></button>`).join('') : '<p class="field-hint">아직 등록된 저장 예제가 없습니다.</p>';
    $('#examples').addEventListener('click', event => {const button=event.target.closest('[data-id]'); if (!button || busy) return; const ex=exampleList.find(e=>e.id===button.dataset.id);if(!ex)return;input.value=ex.hash;activeExample=ex.id;run(ex.id);});
    const requested = new URLSearchParams(location.search).get('example');
    const ex = exampleList.find(e=>e.id === requested);
    if (ex) {input.value=ex.hash;activeExample=ex.id;run(ex.id);}
  } catch { $('#examples').innerHTML='<p class="field-hint">예제를 불러오지 못했습니다. 해시로 조회할 수 있습니다.</p>'; }
}
loadExamples();
