import {ruleExplanation} from './interpreter.mjs';

const explanationCache = new Map();
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';
const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';

export function validateExplanation(text, facts) {
  if (!(typeof text === 'string' && text.length >= 12 && text.length <= 700 && !/[0-9０-９<>]|0x|무제한|확실히 안전|사기가 아|현재.{0,15}(한도|허용량)|잔액이.{0,8}(증가|감소)|스왑|교환|수익|원화|달러|[一二三四五六七八九十百千万億兆]/i.test(text))) return false;
  if (facts?.status === 'failed' && /성공|완료|이동했|전송됐|전송되었|설정됐|설정되었/.test(text)) return false;
  if (facts?.status === 'pending' && /성공|완료|실패했|이동했|설정됐|설정되었|확정됐|확정되었/.test(text)) return false;
  if (facts?.category === 'approval' && !facts.transfers?.length && /전송했|전송됐|전송되었|이동했|이동됐|이동되었/.test(text)) return false;
  return true;
}

function fallback(facts, reason) {
  return {mode: 'rules', label: '거래 용어 해설', text: ruleExplanation(facts), reason};
}

function safeFactsFor(facts) {
  return {
    status: facts.status,
    category: facts.category,
    hasTransfers: facts.transfers.length > 0,
    hasApprovals: facts.approvals.length > 0,
    hasUnsupportedLogs: facts.unsupportedLogCount > 0,
    finality: facts.finality.state
  };
}

function promptFor(safeFacts) {
  return [
    {role: 'system', content: '너는 초보자용 한국어 블록체인 용어 설명기다. 주어진 분류와 상태만 근거로 짧은 두 문장의 교육적 해설을 작성한다. 사실 요약과 숫자는 별도 화면이 담당한다. 숫자, 수량, 가격, 주소, 토큰 이름을 절대로 생성하지 않는다. 자금 안전성, 의도 달성, 현재 승인 한도, 전체 잔액 변화를 판단하지 않는다. approve는 전송과 구분하며 당시 한도 설정임을 설명한다. 실패는 상태 변경이 되돌려진 것으로 설명한다. 스왑을 추정하지 않는다. 출력 JSON은 {"text":"한국어 해설"}만 허용한다.'},
    {role: 'user', content: JSON.stringify(safeFacts)}
  ];
}

/**
 * `adapter` and `fetch` are test seams. Production requests always use Groq.
 */
export async function explain(facts, {adapter, fetch: fetchImpl = globalThis.fetch, timeoutMs = 18000} = {}) {
  if (facts.status === 'not_found' || facts.status === 'unknown') return fallback(facts, '해석할 수 있는 사실이 충분하지 않습니다.');

  const key = process.env.GROQ_API_KEY;
  if (!key && !adapter) return fallback(facts, 'LLM 연결이 설정되지 않아 검증된 규칙으로 설명합니다.');

  const safeFacts = safeFactsFor(facts);
  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const useCache = !adapter && fetchImpl === globalThis.fetch;
  const cacheKey = JSON.stringify({facts: safeFacts, model});
  const cached = explanationCache.get(cacheKey);
  if (useCache && cached && Date.now() - cached.time < 600000) return {...cached.explanation, cached: true};

  try {
    let output;
    if (adapter) {
      output = await adapter({messages: promptFor(safeFacts), facts: safeFacts});
    } else {
      const response = await fetchImpl(GROQ_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${key}`},
        body: JSON.stringify({model, messages: promptFor(safeFacts), temperature: 0.2, max_tokens: 350, response_format: {type: 'json_object'}}),
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) return fallback(facts, `AI 응답을 사용할 수 없어 규칙 설명을 표시합니다 (HTTP ${response.status}).`);
      const result = await response.json();
      output = JSON.parse(result.choices?.[0]?.message?.content || '{}');
    }
    const text = typeof output === 'string' ? output : output?.text;
    if (!validateExplanation(text, facts)) return fallback(facts, 'AI 설명이 사실 보호 검사를 통과하지 못해 규칙 설명을 표시합니다.');
    const explanation = {
      mode: 'ai',
      label: 'AI 용어 해설',
      text,
      provider: adapter ? 'test-adapter' : 'Groq',
      guard: '수치·주소·일부 모순 표현 제한; 전체 의미 정확성을 증명하지 않음',
      generatedAt: new Date().toISOString(),
      cached: false
    };
    if (useCache) {
      if (explanationCache.size >= 32) explanationCache.delete(explanationCache.keys().next().value);
      explanationCache.set(cacheKey, {time: Date.now(), explanation});
    }
    return explanation;
  } catch {
    return fallback(facts, 'AI 연결 또는 응답 검증에 실패해 규칙 설명을 표시합니다.');
  }
}
