# ChainLens Chrome Extension Goal Prompt

/goal 기존 ChainLens 웹 MVP를 보존하면서 DeepL형 Chrome Manifest V3 확장을 실제로 구현하라. 기획·아키텍처 판단은 GPT-5.6 Sol, 코드·테스트·문서·산출물 작업은 GPT-5.6 Terra를 사용한다. 상세 계획은 `/Users/blanco/Library/Mobile Documents/iCloud~md~obsidian/Documents/blancoresearch/2609/.omx/plans/chainlens-chrome-extension.md`를 따른다.

## 최종 사용자 경험

- 일반 웹페이지에서 `0x` + 64자리 Ethereum 거래 해시를 선택하고 우클릭한다.
- `ChainLens로 Ethereum 거래 해석`을 누르면 선택 위치 근처에 Shadow DOM 기반 빠른 영수증이 열린다.
- 빠른 영수증의 `오른쪽에서 자세히 보기`를 누르면 같은 거래와 결과가 Chrome Side Panel에 표시된다.
- Etherscan 또는 Ethereum Blockscout의 `/tx/{hash}` 페이지에서는 ChainLens 아이콘 클릭 한 번으로 URL을 자동 인식하고 Side Panel 해석을 시작한다.
- 지원하지 않는 페이지에서 아이콘을 누르면 Side Panel 안에 해시·지원 URL 입력 fallback을 제공한다.

## 제품 경계

- Ethereum Mainnet만 지원한다. 일반 페이지에서 선택한 해시는 다른 체인으로 추정하지 않는다.
- 금액·주소·수수료·상태·전송·승인은 기존 결정론적 해석 코드가 처리한다.
- Groq에는 상태·거래 분류·전송/승인 존재 여부·지원 밖 로그·finality 같은 제한된 safeFacts만 전달한다.
- Groq 설명이 실패하거나 검사를 통과하지 못하면 명시적으로 규칙 기반 설명을 보여준다.
- 사기·안전성·가격·사용자 의도는 판단하지 않는다.
- 지갑 연결, 로그인, 거래 서명·실행, OCR, 멀티체인, 스왑·NFT·internal trace는 구현하지 않는다.

## 구현 요구

1. `block-ai-interpreter-submission/extension/`에 설치 가능한 MV3 확장을 작성한다.
2. 권한은 `activeTab`, `contextMenus`, `scripting`, `sidePanel`, `storage`와 필요한 로컬 API host permission으로 최소화한다. `<all_urls>`, 지갑 접근, 원격 실행 코드를 사용하지 않는다.
3. 우클릭 메뉴·service worker·Shadow DOM quick receipt·Side Panel·탭별 `storage.session` 상태 공유를 구현한다.
4. 선택 문자열과 링크, 현재 탐색기 URL을 엄격히 검증한다. 잘못된 선택은 외부 요청 전에 거부한다.
5. quick receipt에는 상태·행동·핵심 이동 또는 승인·수수료·설명 모드·원본·상세 버튼만 표시한다.
6. Side Panel에는 전체 거래 요약, 전송·승인, 주소·수량·수수료·블록·finality, 근거·제한·원본 링크를 표시한다.
7. 페이지 주입 UI는 Shadow DOM과 DOM API·`textContent`를 사용하고 신뢰할 수 없는 문자열을 HTML로 실행하지 않는다.
8. 기존 로컬 API를 확장에서 호출할 수 있게 안전한 Origin/CORS 처리를 추가한다. 외부 Origin은 계속 거부한다.
9. `app/lib/ai.mjs`의 Codex CLI와 OpenAI 제품 경로를 제거하고 Groq 전용으로 정리한다. 환경변수는 `GROQ_API_KEY`, `GROQ_MODEL`을 사용한다. 기본은 Groq가 2026-08-16 종료된 `llama-3.1-8b-instant`의 대체 모델로 안내한 `openai/gpt-oss-20b`이며, JSON 응답, 짧은 timeout, 기존 output guard와 rules fallback을 유지한다.
10. API 키를 소스, 프런트엔드, 확장, ZIP, 로그나 응답에 포함하지 않는다. 사용자에게도 채팅으로 키를 요청하지 말고 로컬 환경변수 설정법만 안내한다.
11. 기존 웹 UI와 테스트를 퇴행시키지 않는다. 새 의존성은 추가하지 않는다.
12. `block-ai-interpreter-submission/dist/chainlens-extension.zip`을 만들고 다시 풀어 manifest와 로컬 리소스를 검증한다.
13. README, 신청 문구, 시연 대본, 검증 문서, 점검표와 발표자료의 Astra·확장 예정 표현을 실제 Groq·확장 구현 상태에 맞게 갱신한다. PPTX와 PDF를 다시 생성하고 전체 페이지를 렌더 검수한다.

## 검증 완료 조건

- 기존 `npm run check`와 새 unit/integration 검사가 모두 통과한다.
- Groq mock 성공·HTTP 오류·timeout·잘못된 JSON·guard 실패와 rules fallback을 확인한다.
- Origin/CORS preflight·허용·거부를 확인한다.
- 실제 Chrome에서 일반 페이지 해시 선택 → 우클릭 → 빠른 영수증 → Side Panel 전환을 확인한다.
- 실제 Chrome에서 Etherscan·Blockscout 거래 URL 자동 인식과 아이콘 동작을 확인한다.
- 실제 전송·Approval·실패 거래, invalid·not-found·RPC 장애·Groq 장애를 확인한다.
- 페이지 CSS 격리, 가로 넘침, 콘솔 오류, 키보드 닫기와 재시도 상태를 검사한다.
- manifest 권한, CSP, remote code 부재, secret pattern을 검사한다.
- ZIP 재설치 가능성과 최종 문서·화면·PPTX·PDF 일치를 확인한다.

`GROQ_API_KEY`가 환경에 없으면 live Groq 호출만 미검증으로 남기고 mock·fallback·확장 전체 개발과 검증은 완료한다. 키가 없다는 이유로 작업을 중단하지 않는다. 신규 공개 배포, Chrome Web Store 등록, Git 커밋·푸시·병합, 신청서 최종 제출은 하지 않는다.

모든 필수 조건이 실제 근거로 확인된 뒤에만 goal을 완료 처리한다. 최종 답변에는 확장 폴더·ZIP·실행 방법·테스트 증거·실제 Groq 여부·스크린샷·남은 한계를 정확히 보고한다.
