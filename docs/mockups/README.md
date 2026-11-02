# 시안 모음

지금까지 소망과 고른 시안 원본(HTML)과 실제 폰 확인 화면이에요. 새 시안을 그릴 때 질감 · 크기 · 색을 여기서 가져와요.
HTML은 브라우저로 바로 열려요(Playwright로 찍을 때는 `file://` 주소).

| 폴더 | 내용 |
|---|---|
| `panel/` | 확장 패널 보드(`*.dc.html`, 아티팩트 "서사 아카이브 UI 정리 시안"): 시작하기 A~F, 설정 A~O, 압축 B · C, 세계관 A~D, 휴대폰 `Main`. 소망의 디자인 도구에서 온 보드라 `./support.js`가 없으면 일부만 보일 수 있어요 |
| `panel-new/` | 새 기능 UI 시안 보드 47개(아티팩트 "서사 아카이브 새 기능 UI 시안"): 관계 온도 A~C · A+C 1~4, X-ray A · B, 인물 도감 A · B, 관계도 A · B, 이야기 달력, 이동 경로, 섹션 연결망, 말투 지문, 망각 곡선, 세계관 공유, 아카이브 A · B, 압축 탭, 설정, 압축 마법사 A · B, 원문 뽑기, 아카이브에 추가, 건강 점검, 이탈 감지, 누가 아는가 1~3, 대사 은행, 아카이브에 질문, 주입 미리보기, 분기, 숨김 해제, 키워드 연동, 두 버전 비교, 홈 1~8 |
| `phone-glass/` | 클리어 글래스 폰 홈(아티팩트 "클리어 글래스 폰"): 화이트 그레이 `Main`, 컬러 젤 `Gel` |
| `phone-home2-wx/` | 홈 2쪽 빈 날씨 위젯 시안 A~D(`sheet.png`, A 채택). `mock.cjs`가 실제 폰 홈 2쪽 위젯 자리에 시안을 끼워 찍어요(`node mock.cjs 출력폴더`, 로컬 SillyTavern 필요) |
| `phone-confirm/` | 폰 안 확인 창 시안 A~D(`sheet.png`, B 채택): iOS 알림 · 액션 시트 · 바텀 시트 · 가운데 카드. `mock.cjs`가 실제 폰 설정 화면 위에 끼워 찍어요. B의 질감 시안 A~D는 `quality_*.png`(A 채택)(`quality.cjs`가 CSS를 덮어 찍어요) |
| `ext-confirm/` | 확장 확인 창 시안 A~D(`choice.png` 고르기 창, `plain.png` 보통 확인 창, B 채택). `mock.cjs`가 실제 SillyTavern에 창을 띄우고 CSS를 덮어 찍어요. 확장의 확인 창 42개 전부를 찍은 건 `all_1~4.png`(`capture_all.cjs`) |
| `ext-choice/` | "이 이야기의 휴대폰" 고르기 창 시안 A~D(`sheet.png`): 카드 두 장 · 나란히 타일 · 목록 카드 · 분할 버튼. B 모양 + C 질문을 섞은 안은 `sheet_BC.png` |
| `ext-append/` | 아카이브에 추가 창: 적용한 실제 화면(`real_light.png`, `real_dark.png`), 바탕이 된 시안(`sheet19.png`, `mock19.html`), 예전 모양(`before.png`, `before_preview.png`) |
| `ext-ask/` | 아카이브에 질문 창: 시안 A~C(`sheet.png`, `mock.html`, 처음엔 B · 질문하면 A 채택), 적용한 실제 화면(`real.png`) |
| `ext-secfix/` | 고쳐 달라고 하기(섹션 하나) 창: 시안 A~C(`sheet.png`, `mock.html`, A 채택), 적용한 실제 화면(`real.png`) |
| `ext-layers/` | 섹션 버전(망각 곡선) 창: 시안 A~C(`sheet.png`, `mock.html`, A 채택), 적용한 실제 화면(`real.png`) |
| `ext-fadepick/` | 섹션별 버전(망각 곡선 고르기) 창: 시안 A~C(`sheet.png`, `mock.html`, C 채택 · 줄의 점은 빼고 꺼짐은 흐리게), 적용한 실제 화면(`real.png`) |
| `ext-chatpick/` | 다른 채팅에서 가져오기 창: 시안 A~C(`sheet.png`, `mock.html`, B 채택), 적용한 실제 화면(`real.png`) |
| `panel-s1` ~ `panel-s5`, `panel-worldmap` | 패널 하위 화면 시안 묶음 |
| `phone-home/` | 홈 · 잠금(컬러 젤 · 화이트 그레이) |
| `phone-life/` | 시계 · 건강 · 파일 · 날씨(`wx.html`) · 브라우저 등 생활 앱 첫 시안들 |
| `phone-health/` | 건강 홈 4안(`home4.html`), 팔레트(`pal.html`) |
| `phone-files/` | 파일 썸네일 · 문서 첫 장 |
| `phone-delivery/` | 배달의민족(`bm.html`) · Uber Eats(`ue.html`) |
| `phone-food/` | 음식 그림 바탕 · 토핑 · 곁들임 시트(`all.html`, `bases.html` 등) |
| `phone-shop/` | 쇼핑 상품 그림 · 주문 화면 |
| `phone-wallet-old/` | 지갑 카드 · 패스 1차 개편(프리미엄 카드 `plat.html`) |
| `phone-bank-wallet/` | 은행 고정 지출(`mock.html`), 은행 나머지 버튼(`mock2.html`), 지갑 홈 시안 A~C(`wal.html`) · D~G(`wal2.html`, D 채택) |
| `shots/panel`, `shots/panel-new`, `shots/phone-glass` | 위 보드들을 찍은 그림(PNG). 보드 HTML은 `./support.js`(디자인 도구 런타임)가 있어야 제대로 그려져서, 바로 볼 수 있게 찍어 뒀어요 |
| `shots/` | 실제 폰에서 찍은 결과: 날씨 40가지(`WXMAIN`), 은행(`BK_fx`, `BKA` · `BKB` · `BKC`), 등급 올라가기(`TIER`), 지갑 덱(`D6`), 지갑 시안(`WAL_mock`, `WAL_mock2`), 은행 시안(`BK_more`) |

claude.ai 아티팩트로 남은 시안은 `docs/DESIGN.md` › 9. 시안 그리기에 링크가 있어요.
