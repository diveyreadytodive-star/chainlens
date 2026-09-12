# ChainLens 검증 기록

기준일: 2026-09-12. 이 문서는 실제로 확인한 근거와 아직 확인하지 못한 항목을 분리한다. 과거 웹 MVP의 RPC 기록은 evidence/rpc-examples.json, interpret-live-*.json, verification-live.json에 보관한다. 현재 AI 제품 경로는 Groq 전용이다.

## 확인 완료

### 앱과 Groq 경로

app에서 npm run check를 실행해 26/26 테스트와 문법 검사를 통과했다.

| 검사 범위 | 결과 |
|---|---|
| 정확한 Ethereum 해시·지원 탐색기 URL 파싱, 임의 URL 거부 | 통과 |
| BigInt 수량, 최상위 ETH, ERC-20 Transfer·Approval, 실패·대기 상태, 수수료 | 통과 |
| safeFacts만을 Groq 요청에 전달하는 mock 성공 경로 | 통과 |
| Groq HTTP 오류, timeout, 잘못된 JSON, output guard 실패 → 규칙 기반 설명 | 통과 |
| 로컬 preview 및 명시적으로 설정한 chrome-extension Origin만 CORS 허용 | 통과 |
| 잘못된 확장 Origin 설정 거부 | 통과 |
| RPC 메타데이터 보조 공급자 fallback, 전체 시간 예산, URL credential 비노출 | 통과 |

2026-09-12에 서버 프로세스 메모리에만 GROQ_API_KEY를 주입하고 실제 Groq Chat Completions를 호출했다. 기존 기본 모델은 Groq free/developer tier에서 2026-08-16 종료되어 HTTP 404와 rules fallback을 반환했다. 공식 대체 모델 `openai/gpt-oss-20b`로 기본값을 바꾼 뒤 같은 실제 거래가 `provider=Groq`, `mode=ai`, `AI 용어 해설`, guard 통과로 응답했다. 비밀값은 파일·확장·ZIP·응답·앱 로그에 기록하지 않았다. 비밀정보를 제외한 결과는 evidence/groq-live-verification.json에 보관한다.

### Manifest V3 확장과 패키지

extension에서 npm run check를 실행해 14/14 테스트와 문법 검사를 통과했다.

| 검사 범위 | 결과 |
|---|---|
| 해시·지원 탐색기 URL 파서 | 통과 |
| manifest 최소 권한: activeTab, contextMenus, scripting, sidePanel, storage 및 localhost API host | 통과 |
| source의 dynamic HTML sink, API-key literal, 원격 실행 source 부재 | 통과 |
| service worker·core·content·side panel JavaScript 문법 검사 | 통과 |
| loading→result/error, selection/link 우선순위, stale operation 차단, invalid 입력 시 이전 결과 숨김 | 통과 |

extension은 우클릭 메뉴, service worker, Shadow DOM 빠른 영수증, Side Panel, storage.session 탭 상태, Etherscan·Ethereum Blockscout /tx/{hash} URL 인식, 일반 페이지 입력 fallback을 포함한다.

extension에서 npm run package를 실행해 dist/chainlens-extension.zip을 생성했고, ZIP을 다시 열어 manifest와 포함된 모든 로컬 리소스를 확인했다. ZIP에는 .env나 API 키가 없다.

### 실제 Chrome E2E

2026-09-12에 unpacked 확장 ID efpiaifkcfbiceamcbjaneckaegkmkhp를 실제 Chrome에 설치해 CUA 시각 검증을 마쳤다. 상세 조작·관측은 evidence/extension-chrome-e2e.md에 기록한다.

| 흐름 | 실제 관측 결과 |
|---|---|
| 일반 localhost 페이지 Approval hash | native 우클릭 메뉴 ChainLens로 Ethereum 거래 해석 표시 → loading → 빠른 영수증에 당시 1 USDC, 실행 성공, 규칙 기반 설명 |
| 빠른 영수증 → Side Panel | 오른쪽에서 자세히 보기를 눌러 같은 거래·결과가 사용자 제스처로 Side Panel에 표시 |
| Etherscan 실패 거래 | toolbar 아이콘이 URL을 인식. 실행 실패, 이동 없음, 0.0009579974022 ETH 수수료 표시 |
| Ethereum Blockscout 전송 | toolbar 아이콘 URL 인식 확인. 한 관측은 archive token metadata 실패로 1607000000 raw units·부분 확인, 다른 실제 재조회·quick은 fallback 성공으로 1607 USDC 표시 |
| 입력·주소·UI 상태 | invalid 입력은 이전 결과를 숨김. 주소 복사 후 전체 from address가 clipboard paste됨. quick host 존재, horizontalOverflow false, Escape 닫기, ChainLens extension ID 필터 console warn/error 0 |
| not-found | 0으로만 구성된 미존재 hash 입력 시 `이 거래를 찾지 못했습니다.`와 거래 없음 상태 표시 |
| RPC 장애와 복구 | 도달 불가능한 RPC로 서버를 잠시 재시작해 공개 RPC 연결 오류 안내를 확인한 뒤, 정상 서버로 복구해 같은 거래가 1607 USDC로 다시 해석됨 |

OS 전면창 불일치로 저장된 PNG가 실제 확장 화면을 담지 못했다. 잘못 생성된 로컬 PNG는 전부 제거했다. 그러므로 CUA 시각 검증은 완료됐지만 보존된 extension PNG는 없다.

## 기존 웹 MVP 근거

이전 웹 MVP 검증은 실제 Ethereum 전송·승인·실패 4건의 RPC 조회와 지정 항목 35/35 대조를 기록한다. 이는 ChainLens 사실 추출 범위의 근거다. 현재 Chrome 확장 E2E는 위 표와 evidence/extension-chrome-e2e.md로 별도 확인했고, Groq live 성공은 evidence/groq-live-verification.json에 기록했다.

| 사례 | 해시 | 기록된 결과 |
|---|---|---|
| ERC-20 전송 | 0x90a8e0720a42cfd0e0293f5b1122bbee98018a094f46448504d78cdbf0ac02db | 성공, USDC Transfer 이벤트 |
| ETH 전송 | 0x797bbce143a771a99ad76a5bf35deddf2c92713da80cdfd6d80d9046e335d115 | 성공, 최상위 ETH 값 |
| 승인 | 0x7aead74bd22799ef23780f4abbe697dc7a87d0cc6d468cf8b6f50029e1ee51f0 | 성공, 당시 USDC Approval |
| 실패 | 0x14259e02e6568e0c82cace2bca583a9d102ac62f76963ee340baf3f6ee587fa4 | 실패, 요청한 이동을 완료로 표시하지 않음 |

기존 screenshots/ 5장은 입력형 웹 MVP 화면이다. 현재 확장의 실제 Chrome 화면 증거로 사용하지 않는다.

## 아직 미완료 또는 재검증 필요

| 항목 | 완료 상태 | 완료 근거가 되려면 필요한 것 |
|---|---|---|
| 실제 Chrome unpacked 설치 | 완료 | ID efpiaifkcfbiceamcbjaneckaegkmkhp 설치 및 CUA 관측 |
| 일반 페이지 우클릭 → 빠른 영수증 | 완료 | Approval 메뉴·loading·1 USDC·성공·rules 관측 |
| 빠른 영수증 → Side Panel 상태 전달 | 완료 | 같은 결과를 사용자 제스처로 표시 |
| Etherscan·Ethereum Blockscout 아이콘 자동 인식 | 완료 | 실패·전송 URL에서 toolbar 동작 관측 |
| invalid 입력·주소 복사·기본 UI 상태 | 완료 | 이전 결과 숨김, clipboard 전체 주소, host·overflow·Escape·console 확인 |
| RPC 장애 확장 UI | 완료 | 실제 Chrome에서 장애 안내를 확인하고 정상 RPC 복구 후 같은 거래 재해석 |
| Groq 장애 확장 UI | 일부 완료 | HTTP 404와 키 없음 rules fallback, mock 오류 경로, 이후 live 복구를 확인. 실제 Chrome에서 키 있는 Groq 장애 화면은 별도 미재현 |
| 보존된 확장 PNG | 없음 | CUA 시각 검증 완료. 전면창 오류 PNG는 제거됨 |
| Groq live | 완료 | `openai/gpt-oss-20b` 실제 호출에서 AI 모드·guard 통과·키 비저장 확인 |
| PPTX/PDF 최신 상태 | 완료 | slides/의 최종 파일 10장/10쪽을 개별 렌더 검수. 한글 깨짐·잘림·겹침 없음. PowerPoint 데스크톱은 미검사 |
| 공개 배포·Web Store·영상·신청 | 미실행 | 이 목표의 범위 밖; 수행하지 않음 |

## 해석과 보안의 한계

- Ethereum Mainnet의 최상위 ETH 값, 표준 ERC-20 Transfer·Approval, receipt 상태·수수료·블록/finality만 다룬다.
- 토큰 이벤트는 전체 잔액 변화와 같지 않고, Approval은 당시 이벤트이지 현재 allowance가 아니다.
- internal trace, 스왑 경로, NFT, 비표준 토큰, 가격·원화 환산, 사용자 의도는 미지원이다.
- Groq는 safeFacts만 받지만, 출력 guard는 모든 의미 오류를 증명하지 않는다.
- 로컬 API는 확장 ID를 명시한 Origin만 CORS 허용해야 한다. API 키는 서버 환경변수에만 두고 확장·ZIP·응답·로그에 넣지 않는다.
- 테스트·정적 검사·ZIP 구조 통과는 실사용 안전성, 공개 배포, Web Store 승인, 전체 거래 정확도를 보장하지 않는다.

## 최종 발표자료 검수

- 안정 최종 파일은 slides/에만 둔다.
- PPTX와 PDF는 각각 정확히 10장/10쪽이며 모든 페이지를 개별 렌더했다. 한글 깨짐·잘림·겹침은 발견하지 못했다.
- 슬라이드 3·8·9의 표와 슬라이드 6의 아키텍처는 native 편집 객체다.
- PowerPoint 데스크톱에서 여는 검사는 수행하지 않았다.
- PPTX SHA-256: f43c79471a33c4e3a71591bfc7cea6f163a022a567c5cc404e2896468babd912
- PDF SHA-256: 15064a6a3ea33af807c22cee4045a60ce6d2d0ef3c5a105d9295cfdcb17ad0ed
- 번들 LibreOffice가 새 PPTX의 Apple SD Gothic Neo를 잘못 대체해 한글이 누락된 PDF는 폐기했다. 최종 PDF는 검증된 1920×1080 슬라이드 렌더를 960×540pt 10쪽에 배치해 PPTX와 시각적으로 일치시켰다.
