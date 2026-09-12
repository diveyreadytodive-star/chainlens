# ChainLens Chrome 확장 CUA E2E 기록

검증일: 2026-09-12  
브라우저: 실제 Google Chrome  
설치 방식: unpacked extension/  
확장 ID: efpiaifkcfbiceamcbjaneckaegkmkhp  
설명 모드: Chrome CUA 당시 GROQ_API_KEY 미설정으로 rules fallback  

이 기록은 실제 Chrome UI에서 수행한 CUA 시각 검증의 관측값이다. 자동 단위·정적 검사를 대체하지 않는다. 이후 같은 날 로컬 API에서 Groq live 성공을 별도로 확인했으며 `groq-live-verification.json`에 비밀정보 없이 기록했다.

## 확인한 흐름

| 번호 | 조작 | 관측 결과 |
|---:|---|---|
| 1 | 일반 localhost 테스트 페이지에서 Approval hash를 선택 | Chrome native 우클릭 메뉴에 ChainLens로 Ethereum 거래 해석이 표시됐다. |
| 2 | 해당 메뉴 실행 | loading 뒤 Shadow DOM quick receipt가 표시됐다. 당시 1 USDC, 실행 성공, 규칙 기반 설명 라벨을 확인했다. |
| 3 | quick receipt의 오른쪽에서 자세히 보기 | 사용자 제스처로 Side Panel이 열렸고 같은 거래와 결과가 표시됐다. |
| 4 | Etherscan 실패 거래 페이지에서 확장 toolbar 아이콘 실행 | URL을 자동 인식했다. Side Panel에 실행 실패, 이동 없음, 수수료 0.0009579974022 ETH가 표시됐다. |
| 5 | Ethereum Blockscout 전송 페이지에서 확장 toolbar 아이콘 실행 | URL 자동 인식 동작을 확인했다. 한 관측은 archive token metadata 실패로 1607000000 raw units와 부분 확인으로 표시됐다. 다른 실제 재조회·quick 흐름에서는 보조 RPC fallback이 성공해 1607 USDC로 표시됐다. 이 차이를 일반화하지 않는다. |
| 6 | invalid input 입력 | 기존 거래 결과가 숨겨졌다. |
| 7 | 주소 복사 버튼 실행 후 paste | 전체 from address가 clipboard에서 붙여넣어졌다. |
| 8 | quick receipt UI 검사 | quick host가 존재했고 horizontalOverflow는 false였다. Escape로 닫혔다. ChainLens extension ID 필터 기준 console warn/error는 0건이었다. |
| 9 | 0으로만 구성된 미존재 transaction hash 입력 | Side Panel에 `이 거래를 찾지 못했습니다.`와 거래 없음 상태, 확인 가능한 원본 근거 없음이 표시됐다. |
| 10 | 로컬 서버를 도달 불가능한 RPC(`127.0.0.1:9`)로 잠시 재시작한 뒤 유효한 hash 입력 | Side Panel에 `현재 공개 RPC에 연결할 수 없습니다.` 안내가 표시됐다. 정상 RPC 서버로 복구한 뒤 같은 거래가 다시 1607 USDC로 해석됐다. |

## 화면 파일 상태

CUA 시각 검증은 완료했다. 그러나 로컬 PNG 저장 시 OS 전면창이 일치하지 않아 실제 확장 화면이 아닌 이미지가 생성됐다. 그 PNG는 모두 제거했다. 따라서 이 저장소에는 보존된 extension PNG 파일이 없다.

향후 발표자료나 영상에 확장 화면이 필요하면, 정확한 Chrome 전면창을 확인한 뒤 새 캡처를 저장하고 이 문서의 관측과 대조해야 한다.

## 남은 항목

- GROQ_API_KEY가 있는 환경의 실제 Groq 장애·복구 UI 재현. 키 없는 환경의 rules fallback과 mock 오류 경로는 검증했다.
- 필요 시 올바른 전면창의 보존용 extension PNG 캡처
- 공개 배포, Chrome Web Store 등록, 영상 촬영·업로드, 신청서 최종 제출은 수행하지 않음
