# BLOCK AI✳26 신청 폼 입력 문구

작성 기준: 2026-09-12. 구현물은 로컬 웹 MVP와 Chrome Manifest V3 확장이다. 신청서 업로드·제출, 공개 배포, Chrome Web Store 등록은 하지 않았다.

## 바로 복사할 항목

| 항목 | 입력 문구 |
|---|---|
| 프로젝트명(국문) | 체인렌즈 |
| 프로젝트명(영문) | ChainLens |
| 한 줄 소개 | 복잡한 Ethereum 거래의 자산 이동·권한·수수료를 원본 근거와 연결한 한국어 영수증으로 보여주는 AI 거래 해석기. |
| 제출 트랙 | 1번 트랙 — AI + 블록체인 융합서비스 |
| 주요 기술 스택 | Ethereum JSON-RPC, Node.js, JavaScript BigInt, ERC-20 이벤트 디코딩, Groq API, Chrome Manifest V3, Side Panel, Shadow DOM |
| 발표자료(PPTX) | slides/ChainLens-BLOCK-AI26-Proposal.pptx — 10장, 모든 페이지 렌더 검수 완료 |
| 발표자료(PDF) | slides/ChainLens-BLOCK-AI26-Proposal.pdf — 10쪽, 모든 페이지 렌더 검수 완료 |
| GitHub 또는 서비스 데모 링크 | 미정 — 공개 주소가 확인되기 전에는 입력하지 않음 |
| 링크 접근 확인 상태 | 외부에서 접근 가능한 공개 링크 미확보. localhost와 unpacked 확장은 심사위원용 공개 링크가 아님. |

## 제품 소개 보충 문구

체인렌즈는 블록체인을 처음 이용하는 사람이 거래 이후의 자산 이동, 토큰 사용 권한, 수수료와 실행 상태를 이해하도록 돕는 AI 거래 해석기입니다. 해시 또는 지원 탐색기 링크를 입력하면 Ethereum 원본 데이터를 조회하고, 코드로 추출한 사실에 짧은 한국어 설명과 원본 근거를 연결합니다.

Chrome 확장에서는 일반 웹페이지의 Ethereum 거래 해시를 선택해 우클릭하면 선택 위치 근처에 빠른 영수증을 띄웁니다. 오른쪽에서 자세히 보기를 누르면 Chrome Side Panel에 동일한 거래의 전송·승인·수수료·블록·근거를 표시합니다. Etherscan과 Ethereum Blockscout의 거래 상세 URL에서는 확장 아이콘 한 번으로 해시를 인식합니다. 지원하지 않는 페이지에서는 패널 입력칸에 해시 또는 지원 URL을 붙여 넣을 수 있습니다.

수량·주소·수수료·실행 상태·전송·승인은 코드와 원본 RPC가 처리합니다. Groq에는 상태·거래 분류·전송/승인 존재 여부·지원 밖 로그·finality의 제한된 safeFacts만 전달해 용어 설명을 생성합니다. AI 호출 또는 출력 검사가 실패하면 규칙 기반 설명을 명시적으로 보여줍니다. 사기·안전성·가격·사용자 의도는 판단하지 않으며 지갑 연결·회원가입·서명·거래 실행도 하지 않습니다.

## 기술 스택과 구현 상태 구분

| 구분 | 내용 | 현재 근거 |
|---|---|---|
| 웹 MVP | Node.js HTTP, HTML/CSS/JavaScript UI, Ethereum JSON-RPC, BigInt 수량·수수료 계산 | app 검사 26/26 통과 |
| 사실 추출 | 기본 ETH 전송, 표준 ERC-20 Transfer·Approval, receipt 실행 상태, 원본 근거 | 실제 ETH·ERC-20 전송·승인·실패 4건의 기존 RPC 근거 보관 |
| 제품 AI | Groq Chat Completions, `openai/gpt-oss-20b`, JSON 응답, safeFacts, 출력 guard, rules fallback | mock 오류 경로 검사 통과; 실제 Groq 호출에서 AI 모드·guard 통과 확인 |
| Chrome 확장 | Manifest V3, context menu, Side Panel, storage.session, Shadow DOM quick receipt, 탐색기 URL 인식 | 구현됨; 검사 14/14·문법·ZIP 구조 검사 통과 |
| 실제 Chrome E2E | unpacked 설치, 우클릭→빠른 영수증→Side Panel, 탐색기 아이콘, 오류 상태, 주소 복사 | CUA 시각 검증 완료. Approval은 1 USDC·성공·rules, Etherscan 실패는 이동 없음·0.0009579974022 ETH 수수료. Blockscout metadata는 raw units 부분 확인/1607 USDC fallback 변동을 기록 |
| 범위 밖 | 멀티체인, 스왑, NFT, internal trace, 로그인·지갑·서명·실행 | 구현하지 않음 |

확장에는 API 키가 포함되지 않는다. 로컬 서버에서 GROQ_API_KEY와 선택값 GROQ_MODEL을 설정하며, 실제 설치된 확장의 Origin만 CHAINLENS_EXTENSION_ORIGINS로 CORS 허용한다.

## 제출 형식 확인

공식 참가안내문이 요구하는 실제 업로드 파일 형식·글자 수·파일 크기는 제출 직전에 다시 확인한다. slides/의 최종 PPTX/PDF는 현재 구현 상태로 재생성됐다. 정확히 10장/10쪽을 개별 렌더 검수해 한글 깨짐·잘림·겹침이 없음을 확인했으며, PowerPoint 데스크톱 실행은 검사하지 않았다.

선택 개발증빙은 GitHub·시연 영상·프로토타입 링크 중 최대 1건이다. 공개 링크, 영상, Web Store 등록은 현재 없다. 로컬 실행·테스트 통과·unpacked 확장 폴더는 공개 배포나 제출 완료를 뜻하지 않는다.

## 사용자 정보 필요

- 팀명과 대표자·팀원 2명의 실명
- 학교·전공·학적 등 신청 화면이 요구하는 소속·자격 정보
- 대표 연락처와 이메일
- 역할 A/B의 실제 담당자 매핑, 개인별 사용 가능 기술과 대표 프로젝트·수행 경험
- 공개 개발증빙 1건의 최종 URL과 비로그인 접근 확인
- 확장 이미지가 필요하면 올바른 전면창 상태에서 새로 보존
- 폼의 실제 글자 수·파일 크기·확장자 제한 및 필수 동의 사항

이름·학교·수상·고객·사용자 수·성능 수치는 제공되거나 검증된 사실만 입력한다.
