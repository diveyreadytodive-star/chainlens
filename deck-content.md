# 체인렌즈 기획제안서 원고

BLOCK AI✳26 · 1번 트랙 AI + 블록체인 융합서비스 · 2026-09-12

편집 규격: 16:9, 한국어, 표지 포함 총 10장. 이 원고는 Chrome 확장과 Groq 전용 제품 경로를 반영한 최신 원천이다. slides/의 PPTX/PDF는 이 원고로 재생성됐고, 각각 10장/10쪽을 개별 렌더 검수했다.

공통 사실 표기:

- Chrome Manifest V3 확장과 검증 ZIP은 구현됐다.
- app 검사 28/28, extension 검사 14/14·문법·ZIP 구조 검사는 통과했다.
- `openai/gpt-oss-20b`를 Groq API로 실제 호출해 AI 설명과 guard 통과를 확인했다. 키 없음·HTTP 오류·검사 실패의 rules fallback도 검증했다.
- 실제 Chrome unpacked 설치 E2E는 완료했다. OS 전면창 불일치로 생긴 잘못된 PNG는 제거했으므로 보존된 확장 PNG는 없다.

## 1. 체인렌즈 | ChainLens

**복잡한 거래 기록을, 이해할 수 있는 한국어 영수증으로.**

Ethereum 거래의 자산 이동·권한·수수료를 원본 근거와 연결해 보여주는 AI 거래 해석기.

- 일반 웹에서 거래 해시를 선택하고 우클릭하면 빠른 영수증
- 자세한 사실과 근거는 Chrome 오른쪽 Side Panel
- Etherscan·Ethereum Blockscout 거래 페이지에서는 아이콘 한 번으로 해석

하단 기술 문구: Chrome MV3 확장 · Ethereum 거래 해석 · AI API 설명 경로

하단 팀 정보: 팀 헐크호건 (아주대학교 박건, 가천대학교 서호)

발표 메모: 체인렌즈는 거래를 실행하거나 안전성을 판정하지 않는다. 이미 발생한 온체인 기록을 이해하게 돕는다.

## 2. 성공 표시만으로는, 무엇이 바뀌었는지 알기 어렵습니다

**사용 장면:** 처음 토큰 서비스를 이용한 사용자가 거래 링크를 열었다. 화면에는 Success, 주소, 이벤트 로그가 있지만 전송인지 Approval인지 알기 어렵다.

| 사용자가 알고 싶은 것 | 읽어야 하는 원본 |
|---|---|
| 어떤 자산이 어디로 이동했나? | 거래 value, Transfer 이벤트 |
| 돈을 보냈나, 사용 권한을 줬나? | Approval 이벤트 |
| 실행 결과와 수수료는 무엇인가? | receipt status, gasUsed, effectiveGasPrice |

제안하는 변화: 해시를 찾은 위치에서 먼저 짧은 영수증을 읽고, 필요할 때 원본 근거까지 내려간다.

하단 주석: 대표 이용 상황을 바탕으로 한 문제 가설. 사용자 인터뷰·이해도 실험은 아직 진행하지 않았다.

## 3. 거래 요약은 이미 있습니다. 체인렌즈는 이해와 확인을 연결합니다

| 기존 서비스 | 공식 문서에서 확인한 기능 |
|---|---|
| Etherscan Transaction Action | 선별된 거래 행위 표시, 해당 행위가 없는 거래의 AI 요약 |
| Blockscout Interpreter | 거래 데이터·디코딩·메타데이터 기반 요약, 규칙 분류와 LLM 보완 |
| Noves Translate | 거래를 표준 유형으로 분류하는 해석 API |

**차별화 가설**

- 자산·권한·수수료를 초보자의 질문 순서로 분리한 한국어 영수증
- 설명 항목마다 원본 근거와 확인 수준을 연결
- 선택 해시의 빠른 영수증과 오른쪽 근거 패널을 잇는 Chrome 경험

기대효과: 전송·승인 혼동과 원본 재탐색 부담 감소. 효과 크기는 아직 측정하지 않았다.

출처: Etherscan, Blockscout Interpreter API, Noves Translate Introduction. 확인 2026-09-12.

## 4. 드래그·우클릭하면, 바로 거래 영수증을 봅니다

**해시 선택 → ChainLens로 Ethereum 거래 해석 → Shadow DOM 빠른 영수증 → 오른쪽 상세 패널**

- 일반 웹페이지에서 정확한 Ethereum 해시를 선택
- 단일 우클릭 메뉴로 해석 시작
- 빠른 영수증: 상태, 핵심 행동, 전송 또는 승인, 수수료, 설명 모드
- 오른쪽에서 자세히 보기: 같은 거래의 상세 Side Panel

시각 자료 지시: actual Chrome E2E는 완료됐지만 보존된 확장 PNG가 없다. 새로 캡처하기 전에는 기존 웹 MVP 화면을 확장 실제 화면이라고 쓰지 않는다.

하단 상태 문구: 확장 구현·Chrome CUA E2E 완료 · 보존용 확장 PNG 없음

## 5. 전송, 승인, 실패를 다르게 설명합니다

| 장면 | 사용자에게 보여줄 해석 | 근거·주의 |
|---|---|---|
| 전송 | 어떤 자산이 어느 주소로 이동했는지 | value 또는 Transfer 로그. 전체 잔액 변화와 구분 |
| 승인 | 어느 주소에 당시 사용 한도를 설정했는지 | Approval 로그. 현재 allowance로 단정하지 않음 |
| 실패 | 실행 실패와 발생한 수수료 | receipt 상태. 요청된 이동을 완료로 표시하지 않음 |

실제 저장 RPC 사례: USDC 전송, ETH 전송, 당시 USDC Approval, 실패 거래의 4건을 보관했다. 기존 웹 MVP 검증의 실시간 대조는 35/35 항목을 기록한다.

하단: 숫자·주소·실행 상태는 코드가 처리합니다. 확인한 사실 이상의 성공을 주장하지 않습니다.

## 6. 체인에서 사실을 읽고, Groq는 용어만 설명합니다

**Chrome 확장/웹 UI → Node.js 서버 → Ethereum JSON-RPC**

서버 처리 순서:

1. 해시·지원 탐색기 URL을 엄격히 검증
2. transaction·receipt·로그 조회
3. BigInt 수량·수수료 계산, Transfer·Approval 분리
4. safeFacts만 Groq에 전달해 짧은 한국어 용어 설명 요청
5. JSON·출력 guard 실패 시 규칙 기반 설명으로 전환
6. 영수증·원본 링크·근거·한계 표시

| 영역 | 기술·역할 |
|---|---|
| 웹·확장 UI | HTML/CSS/JavaScript, Chrome MV3, Side Panel, Shadow DOM |
| 데이터·서버 | Node.js HTTP, Ethereum JSON-RPC, JavaScript BigInt |
| AI 연결 | Groq Chat Completions, JSON 응답, timeout, safeFacts, output guard |
| 상태 연결 | Chrome storage.session, 명시적 extension Origin CORS |

도식 지시: API 키는 서버에만 있으며 확장·ZIP·UI에 없다는 경계를 표시한다. Groq live와 mock·fallback 검사를 완료로 라벨한다.

## 7. 블록체인은 사실의 출처, AI는 이해를 돕는 설명 계층입니다

| 코드·블록체인 데이터 | Groq 설명 |
|---|---|
| 수량·소수점·주소·방향 계산 | 전송·승인·실패 같은 용어 풀이 |
| 승인과 전송 분리 | 제한된 safeFacts 기반 짧은 한국어 설명 |
| 실행 상태·수수료 추출 | 숫자·주소·가격·안전성 판단을 추가하지 않음 |
| 원본 필드·로그 근거 보존 | guard 실패 시 규칙 기반 설명으로 교체 |

정확성 관리:

- AI에는 status, category, 전송/승인 존재 여부, 지원 밖 로그, finality만 전달
- 숫자·주소·일부 모순 표현·금지 주제를 제한하는 guard
- 호출·JSON·guard 실패 시 규칙 기반 설명 라벨
- AI 출력은 전체 의미 정확성을 증명하지 않음

검증 상태: Groq mock 성공·HTTP 오류·timeout·잘못된 JSON·guard 실패 fallback, metadata fallback과 Vercel handler를 포함한 app 28/28 테스트 통과. `openai/gpt-oss-20b` 실제 Groq 호출에서 AI 모드·guard 통과 확인.

## 8. 첫 목표는 사용자가 거래를 정확히 설명하게 만드는 것입니다

**사용자 검증 계획 — 아직 모집·측정 전**

- 블록체인 입문자 8–12명을 대상으로 탐색기 단독/체인렌즈 조건 비교
- 전송·승인·실패 사례를 순서를 바꿔 제시
- 자산 이동·승인 의미·수수료·상태 정답률, 답변 시간, 근거 찾기 성공률 측정
- 목표 가설: 정답률 20%p 개선 또는 답변 시간 30% 감소

**사업 가설**

- 초기 유입: 대학 블록체인 교육·커뮤니티의 거래 읽기 실습
- 초기 고객 후보: 지갑·교육 서비스의 온보딩 담당자
- 수익 후보: B2B 해설 위젯/API, 사용량 기반 요금 검토

하단: 모집 수·개선율은 계획이며 현재 사용자 수·성과·매출이 아니다.

## 9. 웹 MVP에서 DeepL형 확장 경험까지, 2인이 단계별로 완성합니다

| 시점 | 개발 목표·완료 기준 |
|---|---|
| 현재 | Vercel 웹 데모, Groq 전용 서버 경로, MV3 확장, ZIP, app 28/28·extension 14/14, Chrome CUA E2E |
| 다음 검증 | 키 있는 Groq 장애의 실제 Chrome UI, 필요 시 정확한 전면창 확장 화면 캡처 |
| 사용자 검증 | 초보자 이해도 비교와 원본 근거 찾기 성공률 측정 |
| 공개 전 | 영상·신청 여부 별도 확인 |

| 역할 | 담당 범위·사용 스택 |
|---|---|
| A · 데이터·정확성 | Ethereum JSON-RPC, Node.js, BigInt, 이벤트 디코딩·검증 |
| B · 서비스·AI·UX | Chrome MV3, HTML/CSS/JavaScript, Groq 연동, 사용자 실험·시연 |

하단: 역할 A/B는 제안 역할이며 실명·학교·개인별 경험은 제출 전에 사실 확인 후 입력한다.

## 10. 구현·검증·남은 검증을 구분해 제출합니다

| 확인 항목 | 현재 근거 |
|---|---|
| 웹 앱 해석·Groq fallback | app 28/28 테스트, 기존 실제 RPC 4건 기록 |
| 확장 구조·권한·보안 경계 | extension 14/14, 문법·ZIP 검사 |
| 확장 배포물 | dist/chainlens-extension.zip 생성 및 구조 검사 |
| Groq live | `openai/gpt-oss-20b` 실제 호출, AI 모드·guard 통과 확인 |
| 실제 Chrome E2E | unpacked 설치·우클릭·Side Panel·Etherscan·Blockscout 자동 인식 CUA 확인 |
| 실제 화면 | screenshots/는 기존 웹 MVP 5장. CUA E2E는 완료했지만 보존된 확장 PNG 없음 |
| 공개 링크 | https://chainlens-lyart.vercel.app 배포·비로그인 확인 |
| 영상·신청 | 미실행 |

레퍼런스:

1. BLOCK AI✳26 공식 참가안내문 및 공식 홈페이지
2. Chrome contextMenus, activeTab, Side Panel 공식 문서
3. Groq Models 공식 문서
4. Etherscan Experimental Feature, Blockscout Interpreter API, Noves Translate Introduction

하단: 정적·단위 검사와 CUA E2E는 공개 배포·전체 거래 정확도를 뜻하지 않는다. PPTX/PDF는 10장/10쪽 개별 렌더 검수를 마쳤으며 PowerPoint 데스크톱은 미검사다. 확장 화면을 새로 넣으려면 올바른 전면창의 PNG를 따로 보존해야 한다.
