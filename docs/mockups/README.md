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
| `ext-knowledge/` | 누가 아는가(비어 있을 때): 시안 A~C(`sheet.png`, `mock.html`, A 채택 · 예시 인물은 Claude · Gemini · GPT, 점 이름표), 실제 화면(`real.png`) |
| `ext-quotes/` | 대사 은행(비어 있을 때): 시안 A+C(`mock.html`, 누가 아는가 환영 카드 + 말풍선 예시 · 예시 인물은 Claude · GPT · Gemini), 실제 화면 밝게 · 어둡게 · 섹션 고르기(`real.png`) |
| `ext-voice/` | 말투 지문(비어 있을 때): 시안 B+D(`mock.html`, 환영 카드 + 끄고 켜는 인물 칩 + 만들기 하나 · 만들 인물이 없으면 대사 모으러 가기, 예시는 Claude), 실제 화면(`real.png`: 밝게 · 칩 하나 끔 · 인물 없음 · 어둡게 둘) |
| `ext-drift/` | 이탈 감지 · 분기(비어 있을 때): 시안 D+F(`mock.html`, 카드 없이 가운데 · 위에 작은 그림(어긋남 비교 · 여기서 끝나는 타임라인)), 실제 화면 밝게 · 어둡게(`real.png`) |
| `dark-charcoal/` | 다크 테마 차콜(3.168): 고른 안(`choice.png` 오른쪽 세 개 · 차콜 + 크림 버튼 + 짐작 금색), 실제 팝업 · 패널(`real_popups.png`, `real_panel.png`) |
| `ext-merge/` | 제목 다시 짓기 · 섹션 합치기: 시안 C(`mock.html`, 체크칸 대신 켜지는 세로 띠 · 합치기는 고른 범위가 한 줄로 이어짐), 실제 화면 밝게 · 어둡게(`real.png`) |
| `ext-wizard/` | 압축 마법사: 첫 단계 시안 B(`mock.html`, 범위의 처음 · 끝 메시지) + 꾹 누르면 원문 시트 가(`mock_sheet.html`), 복사 · 채점 단계 시안 A(`mock_steps.html`, 주황은 화면마다 버튼 하나 · 진행 막대는 원래 색), 실제 화면(`real.png`, `real_steps.png`) |
| `ext-extract/` | 원문 뽑기: 시안 B(`mock.html`, 범위 카드 + 막대 + 복사될 글 미리보기, 테두리 없음 · 주황은 복사 버튼 하나), 실제 화면(`real.png`) |
| `ext-calendar/` | 이야기 달력: 지금 목록 그대로 + 위에 기념일 카드(다가오는 것 · 누른 날 것, 눌러서 전체) · 장면 있는 날 띠(누르면 그날로), 시안 `mock.html`, 실제 화면(`real.png`) |
| `ext-kwtest/` | 키워드 테스트: 시안 B(`mock.html`, 불려 와요 · 안 불려 와요 숫자 두 개 + 목록, 열쇠 이모지 없음), 실제 화면(`real.png`) |
| `ext-picker/` | 공용 섹션 고르기 칸(누가 아는가 · 제목 다시 짓기 · 다이제스트 · 합치기 · 대사 은행 등): 시안 A~C(`sheet.png`, `mock.html`, A 채택), 실제 화면(`real.png`) |
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
