# 체인렌즈 · ChainLens

온체인 거래를 근거 중심의 한국어 영수증으로 읽게 돕는 웹 데모와 Chrome Manifest V3 확장입니다. 현재 구현은 Ethereum Mainnet을 지원합니다. 수량·주소·수수료·실행 상태·전송·승인은 결정론적 코드가 확정하고, Groq는 제한된 범주형 사실만 받아 짧은 용어 설명을 생성합니다. Groq 호출이나 출력 검사가 실패하면 화면은 명시적으로 규칙 기반 설명으로 전환합니다.

현재 구현 범위는 Ethereum Mainnet입니다. 사기·안전성·가격·사용자 의도는 판단하지 않고, 지갑 연결·로그인·서명·거래 실행도 하지 않습니다.

## 현재 상태

- 웹 데모: [https://chainlens-lyart.vercel.app](https://chainlens-lyart.vercel.app)에 Vercel production 배포 완료. 로컬 실행도 유지한다.
- Groq 전용 서버 경로: 구현 및 mock/fallback 검사 완료. `openai/gpt-oss-20b`를 Groq API로 실제 호출해 `AI 용어 해설` 응답과 output guard 통과를 확인했다.
- Chrome MV3 확장: 우클릭 빠른 영수증, Side Panel, Etherscan·Ethereum Blockscout URL 인식, 입력 fallback, 탭별 상태 공유를 구현했고 실제 Chrome CUA E2E를 마쳤다.
- E2E 핵심 결과: Approval quick receipt의 당시 1 USDC·실행 성공·rules 설명, 같은 Side Panel 결과, Etherscan 실패의 이동 없음·0.0009579974022 ETH 수수료, Blockscout URL 인식을 확인했다. Blockscout metadata는 한 관측에서 raw units·부분 확인, 다른 재조회에서는 1607 USDC fallback으로 변동했다.
- 패키지: unpacked 확장 ID efpiaifkcfbiceamcbjaneckaegkmkhp로 설치를 확인했고 dist/chainlens-extension.zip을 생성·재검증했다. extension 검사 14/14 및 문법·ZIP 구조 검사를 통과했다.
- CUA 시각 검증은 완료했지만, OS 전면창 불일치로 생긴 잘못된 로컬 PNG는 모두 제거했다. 따라서 보존된 확장 PNG 파일은 없다.
- 최종 발표자료는 slides/의 PPTX와 PDF로 재생성됐다. 둘 다 정확히 10장/10쪽이며 모든 페이지를 개별 렌더 검수해 한글 깨짐·잘림·겹침이 없음을 확인했다. PowerPoint 데스크톱 실행은 검사하지 않았다.
- Chrome Web Store 등록, 시연 영상 촬영, 신청서 업로드·최종 제출은 수행하지 않았다.

## 로컬 실행

Node.js 22 이상이 필요하며 새 npm 의존성은 없다.

~~~sh
cd app
npm run check
npm start
~~~

웹 MVP는 http://127.0.0.1:4186 에서 열린다. GROQ_API_KEY가 없으면 모든 사실 해석은 계속 동작하고 설명만 규칙 기반 모드로 표시된다.

Groq 실제 연결은 서버 환경변수로만 설정한다. 키를 확장 폴더, ZIP, 브라우저 프런트엔드, 로그 또는 응답에 넣지 않는다.

~~~sh
cd app
GROQ_API_KEY='local-secret' GROQ_MODEL='openai/gpt-oss-20b' npm start
~~~

GROQ_MODEL은 선택값이며 기본값은 Groq가 기존 8B 모델의 대체 모델로 안내한 `openai/gpt-oss-20b`다. 이름에 `openai/`가 들어가지만 요청은 Groq API로만 전송된다. 이 저장소는 .env를 자동으로 읽지 않는다. ETHEREUM_RPC_URL로 Ethereum RPC를 바꿀 수 있고 PORT의 기본값은 4186이다.

## Chrome 확장 로드

1. 공개 웹 데모의 검증된 확장 ZIP을 내려받고 압축을 푼다.
2. Chrome에서 chrome://extensions 를 열고 개발자 모드를 켠다.
3. 압축해제된 확장 프로그램 로드를 선택하고 압축을 푼 폴더를 고른다.
4. 확장은 `https://chainlens-lyart.vercel.app` production API를 사용한다. 별도 로컬 서버는 필요하지 않다.

Web Store 등록 전 개발자 배포 방식이므로 일반 웹사이트에서 원클릭 설치할 수는 없다. 배포 API는 유효한 Chrome extension Origin만 CORS로 허용하고 사용자 자격증명이나 지갑 권한은 사용하지 않는다.

일반 웹페이지에서 정확히 0x로 시작하는 64자리 Ethereum 거래 해시를 선택하고 우클릭한 뒤 ChainLens로 Ethereum 거래 해석을 누른다. 빠른 영수증의 오른쪽에서 자세히 보기를 누르면 같은 거래를 Side Panel에서 연다. Etherscan 또는 Ethereum Blockscout의 /tx/{hash} URL에서는 확장 아이콘을 눌러 자동 인식을 시작한다. 지원하지 않는 페이지에서는 Side Panel 입력칸에 해시 또는 지원 URL을 붙여 넣는다.

해시만으로 체인을 추정하지 않는다. 일반 페이지 우클릭은 Ethereum Mainnet 거래로만 해석한다.

## 검증 명령

~~~sh
cd app
npm run check

cd ../extension
npm run check
npm run package
~~~

현재 확인한 결과:

- app: 28/28 통과. 해시·URL 파싱, BigInt, 전송/승인/실패, Groq mock 성공, HTTP 오류·timeout·잘못된 JSON·guard 실패 fallback, CORS, 메타데이터 fallback·시간 제한, Vercel handler 계약을 포함한다.
- extension: 14/14 및 모든 JavaScript 문법 검사 통과. 최소 권한, remote code/API-key literal/dynamic HTML sink 부재, stale operation·invalid input 상태를 포함한다.
- ZIP: dist/chainlens-extension.zip을 다시 열어 manifest와 로컬 리소스를 확인했다.

실제 Chrome 설치 E2E와 Groq live 호출을 완료했다. 키를 제거하거나 호출·출력 검사가 실패하면 규칙 기반 설명으로 복구되는 경로도 검증했다.

## 저장된 실제 예제

- ERC-20 전송: 0x90a8e0720a42cfd0e0293f5b1122bbee98018a094f46448504d78cdbf0ac02db
- ETH 전송: 0x797bbce143a771a99ad76a5bf35deddf2c92713da80cdfd6d80d9046e335d115
- USDC 승인: 0x7aead74bd22799ef23780f4abbe697dc7a87d0cc6d468cf8b6f50029e1ee51f0
- 실패 거래: 0x14259e02e6568e0c82cace2bca583a9d102ac62f76963ee340baf3f6ee587fa4

저장 예제는 출처와 시점이 있는 실제 RPC 스냅샷이다. 일반 입력은 live RPC를 다시 조회한다. 토큰 로그는 전체 잔액 변화와 같다고 보장하지 않으며, 과거 Approval 이벤트는 현재 allowance를 뜻하지 않는다.

## 구조와 산출물

| 위치 | 내용 |
|---|---|
| app/ | Vercel 웹 데모, 로컬 실행 어댑터, 결정론적 해석기, Groq 전용 서버 경로 |
| extension/ | unpacked로 로드하는 Manifest V3 확장 |
| dist/chainlens-extension.zip | 검증된 확장 ZIP |
| screenshots/ | 기존 웹 MVP 화면 5장. 확장 CUA 시각 검증은 완료했지만 보존된 확장 PNG는 없다. |
| evidence/extension-chrome-e2e.md | 실제 Chrome E2E 조작·관측 기록. |
| evidence/ | 기존 실제 RPC 및 웹 MVP 검증 근거 |
| verification.md | 현재 검증 결과와 남은 한계 |
| application-copy.md | 신청 폼용 최신 제품 문구 |
| slides/ | 최종 PPTX·PDF만 보관하는 안정 발표자료. 10장/10쪽 렌더 검수 완료 |
| deck-content.md | 최종 발표자료의 10장 원고 |
| demo-script.md | 확장 중심 시연 대본. 영상 자체는 아직 없다. |
| submission-checklist.md | 제출 전 확인 항목 |

## 지원 범위와 한계

지원하는 사실은 최상위 ETH 값, 표준 ERC-20 Transfer·Approval 이벤트, receipt 상태, 가스 비용, 블록·finality다. 내부 ETH 이동, 스왑 경로, NFT, 비표준 토큰, 현재 allowance, 가격·원화 환산은 해석하지 않는다.

AI는 숫자·주소·자산명·가격을 새로 만들 수 없도록 제한된 출력 검사를 거친다. 이는 전체 의미 오류가 없다는 증명은 아니다. 공개 RPC와 Groq의 가용성에 따라 live 조회·설명은 달라질 수 있다.

문서 원고와 최종 PPTX/PDF는 실제 Groq live 검증 상태로 갱신·검수했다. 확장 화면이 필요하면 전면창이 정확히 맞는 상태에서 새 캡처를 별도로 보존해야 한다.
