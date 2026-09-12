# BLOCK AI✳26 체인렌즈 제출 점검표

기준일: 2026-09-12. 이 점검표는 실제 제출을 실행하지 않는다. 완료 표시는 현재 파일과 검사 근거가 있는 항목만 뜻한다. Goal의 구현·패키지·Chrome E2E·Groq live·발표자료 검수 조건은 충족했다.

## 구현 산출물

| 항목 | 위치 | 현재 상태 |
|---|---|---|
| 공개 웹 데모 | https://chainlens-lyart.vercel.app | Vercel production 배포; npm run check 28/28 통과 |
| Groq 전용 AI 경로 | app/lib/ai.mjs | 구현됨; mock·fallback 및 `openai/gpt-oss-20b` live API 성공 확인 |
| unpacked MV3 확장 | extension/ | 구현됨; 실제 Chrome CUA E2E 완료 |
| 검증 ZIP | dist/chainlens-extension.zip | 생성 및 ZIP 구조 검사 완료 |
| 확장 정적·문법 검사 | extension/ | 14/14 통과 및 JavaScript 문법 검사 완료 |
| 확장 실제 Chrome 근거 | evidence/extension-chrome-e2e.md | CUA E2E 완료. 잘못된 전면창 PNG는 제거되어 보존된 확장 PNG 없음 |
| 웹 MVP 실제 RPC 근거 | evidence/, screenshots/ | 보관됨; screenshots/는 웹 MVP 5장이며 확장 PNG는 아님 |
| 신청 문구·시연 대본·검증 문서 | application-copy.md, demo-script.md, verification.md | 현재 구현 상태로 갱신 |
| 발표 원고 | deck-content.md | 현재 구현 상태로 갱신 |
| 최종 PPTX/PDF | slides/ | 재생성·개별 렌더 검수 완료. 정확히 10장/10쪽, 한글 깨짐·잘림·겹침 없음. PowerPoint 데스크톱 미검사 |

## 출시 전 기술 확인

- [x] 확장 manifest가 activeTab, contextMenus, scripting, sidePanel, storage와 정확한 production API host만 요청한다.
- [x] <all_urls>, 지갑 접근, 원격 실행 코드가 없다.
- [x] API 키 literal, dynamic HTML sink, 원격 executable source 부재를 정적 검사했다.
- [x] 선택 텍스트·링크·탐색기 URL을 엄격히 검증하는 코드를 구현했다.
- [x] Groq에는 safeFacts만 보내고 오류·timeout·출력 guard 실패 시 rules fallback을 구현·검사했다.
- [x] 로컬 CORS와 production의 same-origin·유효 Chrome extension Origin 처리를 구현·검사했다.
- [x] ZIP을 다시 열어 manifest와 모든 로컬 리소스를 확인했다.
- [x] Chrome에서 extension/을 unpacked로 로드했다. 검증 ID는 efpiaifkcfbiceamcbjaneckaegkmkhp다.
- [x] 확장 ID Origin을 넣은 서버와 CORS 경로를 실제 E2E에 사용했다.
- [x] 일반 페이지 Approval hash 선택 → native 우클릭 → loading → 빠른 영수증을 CUA로 확인했다.
- [x] 빠른 영수증의 상세 버튼 → 같은 결과가 있는 Side Panel을 CUA로 확인했다.
- [x] Etherscan 실패와 Ethereum Blockscout 전송 /tx/{hash}에서 아이콘 URL 인식을 각각 확인했다.
- [x] invalid 입력의 이전 결과 숨김, 주소 clipboard 복사, quick host, horizontal overflow 없음, Escape 닫기, console warn/error 0을 확인했다.
- [x] not-found 화면과 RPC 장애 안내를 실제 Chrome에서 재현하고, 정상 RPC 복구 뒤 같은 거래가 다시 해석되는지 확인했다.
- [x] 종료된 기본 모델의 HTTP 404 rules fallback과 대체 모델의 Groq live 복구를 확인했다.
- [ ] 보존용 extension PNG는 없다. 전면창을 확인한 새 캡처가 발표자료에 필요하면 별도 저장한다.
- [x] GROQ_API_KEY를 서버 프로세스에만 주입해 live 설명을 실행하고 AI 모드·guard 통과와 키 비저장을 확인했다.

## 발표자료와 제출 파일

- [x] deck-content.md와 신청·시연·검증 문서는 Groq 전용·확장 구현 상태·미검증 항목을 구분한다.
- [x] PPTX/PDF를 최신 원고로 재생성했다. 안정 최종 파일은 slides/에만 둔다.
- [x] PPTX와 PDF의 모든 페이지를 렌더링해 한글 깨짐·잘림·겹침·가독성을 확인했다. 정확히 10장/10쪽이며 PowerPoint 데스크톱은 미검사다.
- [x] PPTX/PDF의 이전 AI 연결·확장 예정 표현을 제거하고 실제 Groq·확장 상태와 맞췄다.
- [ ] 보존용 확장 PNG를 정확한 전면창에서 새로 확보한 뒤에만 PPTX/PDF의 실제 구현 화면으로 사용한다.
- [ ] 공식 폼의 페이지 수, 파일 형식·크기, 글자 수, 링크 조건을 제출 직전에 재확인한다.
- [ ] 팀 실명·소속·연락처·역할·개별 경험을 실제 정보로 입력한다.
- [ ] 선택 개발증빙 링크를 하나 쓸 경우 비로그인 외부 접근을 확인한다.

## 명시적으로 수행하지 않는 작업

- [x] Vercel 공개 배포
- [ ] Chrome Web Store 등록
- [ ] Git 커밋·푸시·병합
- [ ] 시연 영상 촬영·업로드
- [ ] 온라인 신청서 업로드·최종 제출

위 항목은 현재 Goal의 금지 또는 사용자 후속 행동 범위다. 체크되지 않았다는 사실은 구현 실패가 아니라 아직 실행하지 않았다는 뜻이다.
