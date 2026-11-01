# 디자인 인수인계 (휴대폰 화면)

이 문서는 NarrativeArchive 캐릭터 휴대폰의 **디자인 작업**을 넘겨받는 세션을 위한 것이에요.
메인 3.157.2 기준이고, 은행 · 지갑 · 쇼핑 · 날씨 · 건강 · 파일 · 배달 · 홈 2쪽을 다시 그린 세션이 썼어요.
처음부터 끝까지 한 번 읽고 시작해 주세요. 특히 **1. 소망과 일하는 법**, **3. 테마 충돌**, **6. 실제 폰에서 확인**은 꼭 읽어야 해요.

---

## 1. 소망(사용자)과 일하는 법

### 대화
- 사용자 이름은 소망이에요. 짧은 한국어 반말체로 말해요(ㅋㅋ, ㄱㄱ 같은 말을 써요). 답은 짧고 쉬운 한국어로, 존댓말(~요)로 해 왔어요.
- 답을 감정 이야기로 시작하지 않아요("놀라셨겠지만" 같은 말 금지).
- 묻지 않은 조언은 하지 않아요.
- **질문에는 답만 해요. 코드는 건드리지 않아요.** "이거 어케 돼?", "흠 어카지"는 질문이에요. 질문에 코드를 고쳤다가 크게 화낸 적이 있어요.
- "넹", "굿", "웅", "ㄱㄱ", "ㅇㅋ"는 진행해도 된다는 뜻이에요. 메인에 올릴 때는 꼭 이 말을 받고 올려요.
- 설명이 길거나 어려우면 "먼소리야"가 와요. 쉬운 말로 다시 짧게 해요.
- 지시가 두 가지로 읽히면 짧게 확인해요. 예: "저 보라 카드 지워"는 색을 빼라는 게 아니라 그 **카드 디자인(사선 줄무늬)**을 빼라는 말이었어요. 세 번을 헛짚었어요.

### 작업 순서
1. **시안부터.** 새 화면이나 큰 변경은 HTML 시안을 3~4개 그려 Playwright로 찍어 보여주고 고르게 해요. "시안 4개 더"도 자주 와요. 시안이 서로 확실히 달라야 해요.
2. 고른 걸 코드로 옮겨요.
3. **실제 폰에서 찍어서** 보여줘요(6장). 시안 그림만 보여주고 끝내지 않아요.
4. 작업 브랜치에 커밋하고 올려요. 메인은 허락받고 올려요(8장).

### 소망이 싫어하는 것 (실제로 지적받은 것)
- **이모지.** 폰 화면에는 구글 이모지 같은 게 절대 들어가면 안 돼요. ✈︎ 같은 글자도 이모지로 보일 수 있어 안 써요. 아이콘은 전부 SVG 선 아이콘(2장의 `AX`)이에요. 시안에도 넣지 않아요.
- **시키지 않은 폰트나 색 바꾸기.** 예: 겹쳐 보이는 문제를 풀려고 멤버십 카드 색을 바꾸자고 했다가 "기존의 골드 프라이빗 플래티넘 카드색은 바꾸면 안되지 뭐하니"를 들었어요. 색 말고 배치로 풀었어요(지갑에서 멤버십을 따로 빼기 → 결국 한 덱).
- **그림자 없는 흰 덩어리.** "css 덩어리 같다"는 말을 들었어요. 흰 카드 · 타일에는 그림자를 넣어요(4장).
- **누르는 척만 하는 버튼.** 보이는 버튼은 눌렀을 때 무언가 해야 해요. 할 게 없으면 빼요. 은행에 이런 버튼이 11개 있었고, 이번에 전부 살렸어요.
- **AI한테 고르게 하는 필드 늘리기.** "반영 지시문이 3500토큰에 고르는 게 ㅈㄴ 많다"고 했어요. 그림이나 종류는 **코드가 낱말로 추측해요**(who · memo · 한국어 ko 줄 포함, 영어 · 독일어 · 한국어 · 일본어 · 중국어). 새 필드가 꼭 필요하면 먼저 물어봐요.
- **은행처럼 생긴 화면, 답답한 화면.** 지갑 시안에서 "B는 은행같고 C는 답답하고"라는 평을 받았어요.
- **못생긴 보라.** 보라 계열 카드 · 아이콘 색은 피하는 게 안전해요.
- 홈 아이콘은 비슷한 색끼리 붙으면 안 되고, **노랑이 똥색**이 되면 안 돼요. 하나만 채도가 튀어도 안 돼요(지갑 아이콘이 그랬어요).

### 소망이 좋아한 것
- 은행의 **남색 머리**와 둥근 버튼 **위쪽에 살짝 들어간 빛**(`box-shadow: inset 0 1px 0 rgba(255,255,255,.18)`)이에요. "예전 CSS가 더 고급스러웠는데 위에 살짝 빛이 있는"이라고 했어요.
- 둥근 카드 아이콘이에요(`AX.card`, 지금 모든 앱 공통).
- 애플 지갑식 카드 덱이에요. 카드끼리 가장자리가 이어져 보이는 것("이렇게 이어지는 게 예쁜데"), 뒤 카드를 누르면 그 자리에서 펼쳐지는 것도 좋아했어요.
- 플랫한 음식 그림, 홈 1쪽의 먼지 낀 파스텔 젤 아이콘이에요.
- 조금씩 자주 다듬어요. 예: 구름 속도를 "절반" → "10% 빠르게" × 2 → "5% 느리게" → "2.5% 느리게"로 맞췄어요. 숫자 요청은 정확히 그만큼만 바꿔요.

---

## 2. 코드 지도

### 화면이 그려지는 방식
- 화면은 전부 **HTML 문자열을 돌려주는 함수**예요. 프레임워크는 없어요.
- 앱 화면은 390 × 844 보드 크기로 그리고, 실제 창에 맞춰 줄여요.
- 루트 클래스는 `.na_ph_scr.ax`이고, 앱 안에서는 `.ax`가 기준이에요.
- 눌러서 화면을 옮기는 건 `data-go="경로"`(+ `data-i="값"`)예요. `src/phone.js`의 `$root.on('click', '.na_ph_frame [data-go]', …)`가 받아서 `view = "경로:값"`으로 바꾸고 다시 그려요. `<button>`이 아니어도 `data-go`만 있으면 눌려요(예: 명세서 표의 `<tr>`).

### 주요 파일
| 파일 | 내용 |
|---|---|
| `src/phone.js` | 화면 고르기(`screen()`), 경로표, 클릭 처리, 스크롤 유지, 은행 환율 칸 처리 |
| `src/phoneapps.js` | 공용 도우미와 아이콘 `AX`, 앱별 색 `AXB` / `AXB_C`, 메시지 · 전화 · 사진 등 1쪽 앱들 |
| `src/phonehome.js` | 잠금 · 홈 1쪽 · 2쪽, 홈 아이콘(`CG_I` 모양, `CG_GEL` 색), 위젯 |
| `src/phonemoney.js` | 은행 · 고정 지출 · 알림 · 송금 · 명세서 · 확인증 · 더보기, 지갑(카드 · 멤버십 · 패스), 쇼핑, 음성 메모 |
| `src/phonelifeapps.js` | 시계 · 건강 · 파일 · 날씨 · 배달 · 홈 날씨 위젯 |
| `src/phonefood.js` | 음식 그림(바탕 159개, 토핑, 곁들임). 낱말로 그림 고르기(`GUESS`, `WORD`, `wordsPic`, `dishPic`) |
| `src/phoneprod.js` | 쇼핑 상품 실루엣 50종. 낱말로 종류 · 색 고르기(`prodKind`, `prodSvg`) |
| `src/phonedata.js` | 폰 데이터 모양, 채우기 프롬프트, `storyNow` |
| `src/phonelife.js` / `phonesync*.js` | 채우기 · 반영(데이터 쪽). **5장 참고, 건드리지 않아요** |
| `style.css` | 전부 한 파일(약 7000줄). 앱마다 주석 머리(`/* 은행 › … */`)로 묶여 있어요 |

### 공용 도우미 (`src/phoneapps.js`)
- `ax(k, size=22, color='currentColor', strokeWidth=2, fill='none')`: `AX[k]` 경로로 선 아이콘 SVG를 만들어요.
- 새 아이콘은 쓰는 파일 위쪽에 `Object.assign(AX, { 이름: 'path d' })`로 더해요. 24×24 기준 선 아이콘이에요.
- **이름이 겹치면 덮어써요.** 먼저 `grep -n "이름:" src/*.js`로 확인해요.
- `axBar(p, now, color)`: 상태줄이에요.
- `axTop(left, right)`: 위쪽 줄이에요.
- `axCb(go)`: 둥근 뒤로 버튼이에요.
- `axH1(title, sub)`: 큰 제목이에요.
- `axInd(color)`: 아래 홈 막대예요.
- `axDay(p, now, 'MM-DD')`: "오늘" 또는 날짜예요.
- `axTint(name)`: 이름마다 고정된 아바타 색이에요.
- `axLetter(name, size)`: 글자 아바타예요.
- `axKp(p)`: 한국어 알약이에요.
- `busyHtml`: 도는 아이콘이에요.

### 새 화면을 더할 때 체크리스트
1. 화면 함수는 `export function xxxScreen(p, now, i)`예요. 앞뒤를 `axBar` … `axInd()`로 감싸요. 은행류는 `.ax_bk` 구조를 따라요(4장).
2. `src/phone.js`
   - import에 더해요.
   - `screen()`의 `v === '경로' ? …` 줄, 또는 `life` 맵에 더해요.
   - `data-i`를 **늘** 받는 경로면 클릭 처리의 `view = [ … ].includes(go)` 첫 목록에 더해요. **있을 때만** 받는 경로면 두 번째 목록(`['cal', …, 'wallet']`)에 더해요.
   - 같은 화면 안에서 고르기만 바뀌는 경로(고정 지출 · 송금 · 명세서 · 지갑)는 `const stay = [...]`에 더해요. 그래야 스크롤 위치가 남아요.
3. `src/phoneapps.js`의 `AXB`에 `경로: '색이름'`을 더해요. 앱 강조색이 `--axd` · `--axc`로 들어와요.
4. CSS를 `style.css`의 그 앱 묶음에 더해요(3장 규칙대로).
5. 테스트 → 실제 폰 확인 → 버전 → 커밋(6~8장).

### 함정
- **순환 import:** `phonehome.js`가 `phonelifeapps.js`를 import하면 "Cannot access 'AX' before initialization"이 나요. 홈 날씨 위젯은 `phone.js`가 만들어서 `homeScreen(p, now, m, 2, hereWidget(p, now))`로 넘겨요.
- **경로 값에 콜론:** `view.indexOf(':')`로 처음 콜론만 잘라요. 그래서 `data-i`에 콜론이 있어도 돼요.
- **테스트 스텁:** `tests/investment.test.mjs`는 `phonemoney.js`의 import를 손으로 이어 줘요. `phonemoney.js`에 새 import를 더하면 거기 맵에도 더해야 해요(예: `'./phoneprod.js'`).
- **은행 잔액:** `migrateBank(getMeta(), p)`가 장부(`finance.js`)에서 계좌 `balance`를 다시 써요. 테스트에서 `balance`를 직접 바꾸면 다음 화면에서 원래대로 돌아가요. 잔액을 바꾸려면 장부 `fin.finance(m).accounts["id:통화"].entries[id] = { amount, date }`에 넣어요.

---

## 3. 테마 충돌 (가장 많이 깨지는 곳)

소망은 SillyTavern **테마를 씌워서** 써요. 테마는 페이지의 모든 `button`, `label`, `input`, `select`에 배경 · 테두리 · 그림자 · 글꼴을 칠해요. 그래서 폰 안이 깨져요. 실제로 쇼핑 로고와 주문 탭이 소망 화면에서만 둥근 상자로 보였어요.

### 규칙
1. **폰 안 `button` / `label`에는 `background`를 직접 쓰지 않아요. `--axbg`를 써요.** 그림자는 `--axsh`예요.
   ```css
   .ax .ax_myrow { --axbg: #fff; --axsh: 0 1px 2px …; }   /* background: #fff 는 안 먹어요 */
   ```
   `style.css`의 큰 규칙(아래)이 모든 폰 버튼 배경을 `var(--axbg, transparent) !important`로 덮어써요. `background:`를 써도 소용없어요.
   ```css
   body:is(.na_darkui, :not(.na_darkui)) dialog.popup:has(.na_popup) .na_popup .ax :is(button, label) {
     background: var(--axbg, transparent) !important; background-image: none;
     box-shadow: var(--axsh, none) !important; border-color: transparent !important; }
   ```
2. **배경을 꼭 칠해야 하는 버튼이 아닌 것**(div, span)은 `background`를 그냥 써도 돼요. 버튼처럼 눌려야 하지만 테마를 피하고 싶으면 `<div role="button" tabindex="0" data-go=…>`도 돼요.
3. 테마를 이겨야 하는 글자 크기 · 둥글기 · 테두리는 `!important`를 붙여요(예: `.ax_kp` 한국어 알약, 쇼핑 탭 밑줄). 같은 우선순위로 이기려면 위의 긴 선택자(`body:is(.na_darkui, :not(.na_darkui)) dialog.popup:has(.na_popup) .na_popup …`)를 앞에 붙여요.
4. **`input` / `select`**(은행 환율 칸 등)는 테마가 모양을 크게 바꿔요. 실제 입력칸은 투명(`opacity: 0`)하게 덮고, 보이는 값은 따로 그려요. 은행 `displayTools`가 이렇게 해요. 날짜칸은 누르면 `showPicker()`를 불러요(`phone.js`).
5. 글꼴은 `.ax_canvas`에서 `-apple-system, 'SF Pro Text', 'Noto Sans KR', sans-serif`로 정해요. 숫자는 `'Inter Tight'`, 숫자 칸에는 `.cg_num`을 써요.
6. 다크 UI: SillyTavern 쪽 패널은 `body.na_darkui`가 붙으면 어두운 팔레트예요(`src/theme.js`). 폰 화면 자체는 다크 테마를 따로 그리지 않아요. 어두운 테마에서도 폰은 같은 밝은 화면으로 보여야 해요. 확인은 `probe.cjs dark`로 해요.

### 클래스 이름 충돌
- 클래스는 전부 전역이에요. 이름이 겹치면 엉뚱한 화면 규칙이 섞여요.
- 실제 사고: 은행 알림에 쓴 `.ax_ntb`가 메모 지우기 툴바의 `.ax .ax_ntb { width: 40px; height: 40px; display: grid }`와 겹쳐서 글자가 다 겹쳐 나왔어요. 지금은 은행 알림이 `ax_bnr` 줄을 써요.
- 새 이름은 `grep -n "\.새이름\b" style.css src/*.js`로 비어 있는지 먼저 봐요. 앱 앞글자를 붙이는 게 안전해요(`lf_` 생활 앱, `dv_` 배달, `cd_` 카드 상세, `ax_bk…` 은행, `iv_` 투자, `cg_` 홈).

### 홈은 다른 체계예요
- 잠금 · 홈 1쪽 · 2쪽은 `.na_ph_scr.cg`(`cg_gel` 컬러 젤 또는 `cg_mono` 화이트 그레이 테마 `p.theme === 'gray'`)이고 `.cg_canvas` 안에 그려요.
- 홈 아이콘은 `phonehome.js`의 `cgIcon`이에요. 색은 `CG_GEL[앱] = [밝은색, 진한색]`이고, 투명도는 `CG_ALPHA = 'd9'`예요.
- 날씨 위젯처럼 앱과 홈에 같이 쓰는 클래스는 `:is(.ax, .cg) .lf_city`처럼 둘 다에 걸어요.

---

## 4. 디자인 체계

### 공통 토큰
- 흰 카드: `.ax_card`(`margin: 0 14px 12px; border-radius: 22px; box-shadow: 0 1px 2px rgba(22,27,34,.04), 0 8px 24px rgba(22,27,34,.05)`)예요. **새 흰 블록에는 이 그림자를 꼭 넣어요.**
- 위로 떠 있는 종이(명세서 · 확인증 · 거래 영수증): `0 1px 2px rgba(22,27,34,.05), 0 10px 26px rgba(22,27,34,.1)`
- 실물 카드 · 패스: `0 10px 24px rgba(22,27,34,.16~.18), inset 0 1px 0 rgba(255,255,255,.18)`
- 줄 목록: `.ax_rw`(왼쪽 아이콘 `.ax_fi`, 가운데 `.ax_tx` > `b.ax_n` + `.ax_p`, 오른쪽 `.ax_amt` 또는 `.ax_fxv`)
- 섹션 제목: `.ax_sec`(작은 회색), `.ax_shd`(굵은 + 오른쪽 개수)
- 배지: `.ax_dd`(빨강 기본, `.ok` 초록, `.g` 회색), `.ax_pend`(노랑 "대기"), `.ax_lnk`(파랑 연결)
- 칩: `.ax_chips > button`(`.on`은 남색). 남색 머리 위에서는 `.ax_mch`로 색을 뒤집어요.

### 은행 (`.ax_bk`)
- 구조: `.ax_bkh`(남색 `#1d3461` 머리, 높은 건 `.ax_bkhs`, PRIVATE 더보기는 `.ax_bkpv` 검정) → `.ax_bks`(흰 시트가 머리 위로 28px 올라옴, 종이형은 `.ax_bkso`로 70px) → `.ax_scroll` → `tab('…')` 아래 탭
- 둥근 버튼 `.ax_bkc`(38px), 버튼 줄 `.ax_bkacts`(4칸, 계좌 화면은 `.ax_three`), 위쪽 빛 `inset 0 1px 0 rgba(255,255,255,.18)`
- 경로
  - `bank` 홈, `acct:i[.in|.out]` 계좌
  - `tx:id` 거래, `txdoc:id` 확인증(이체확인증 · 카드 매출전표 · 입금확인증, 도장)
  - `fixed[:a~key]` 고정 지출, `banksend[:a~key]` 송금, `stmt[:i.MM]` 명세서
  - `banknote` 알림, `bankmore` 더보기
- 고정 지출 찾기(`fixedCosts`)
  - `FIXED` 낱말 목록(월세 · 통신 · 영상 · 음악 · 보험 · 운동 · 공과금 · 구독 · 저축)
  - 낱말이 없으면 두 달에 걸쳐 같은 금액(3% 안)이 같은 날(±3일)에 나가고 송금이 아닐 때만 잡아요.
  - 처음엔 REWE 장보기가 잡혀서 이렇게 조였어요.
- 등급(`bankTier`)
  - 예금 합계를 유로로 환산해 정해요(`SCALE`). 4만 GOLD, 12만 PLATINUM, 40만 PRIVATE예요.
  - 은행 · 계좌 이름의 Gold, Platinum, Premium, Private, PB, Black 같은 말로도 정해져요.
  - 신용카드는 은행 등급 아래로 안 내려가요(`cardLook`의 `lv`).
  - 계좌번호(`acctNo`)는 나라 모양이에요(DE는 IBAN, KR은 3-3-6, JP · US · GB …). 은행 이름 + 끝 네 자리로 늘 같은 번호가 나와요.

### 지갑 (`walletScreen(p, now, sel)`)
- 한 덱이에요. 순서는 PRIVATE 멤버 카드 → 카드들 → 다가올 패스(가장 가까운 게 맨 앞)예요.
- 펼쳐진 하나(`.ax_wlb.on`) 말고는 윗줄 60px만 보여요(`.sh`).
- 뒤 카드를 누르면 `wallet:키`로 그 자리에서 펼쳐져요(`m`, `c0`, `p<id>`, 지난 패스 `o<id>`). 펼쳐진 걸 누르면 상세로 가요.
- 펼친 카드 뒤쪽 카드들은 `.ax_dtail`에 담아요. 덱 끝 밑으로 삐져나오는 것만 잘려요. 카드 사이 가장자리는 **자르지 않아요**(소망이 이어지는 모습을 원해요).
- 지난 패스는 아래에 회색 덱(`.ax_psold`)으로 따로 둬요. "패스가 없을 때 보이는 좋은 소품"이라 늘 보여요.
- 카드 그림
  - `cardArt` / `cardLook`예요. 은행 색은 `BANK_C`(은행 이름 해시로 고름)예요. **목록에서 하나를 빼면 다른 은행 색이 전부 밀려요.** 빼지 말고 자리에 다른 색을 넣어요.
  - 무늬 `PATS`도 같아요. 사선 줄무늬는 빼고 그 자리에 물결을 넣었어요.
- 패스 그림은 `passArt`예요. 종류는 `passKind`(항공 · 기차 · 버스 · 공연 · 영화 · 경기 · 박물관 …)예요.

### 날씨
- 하늘
  - `scene(cond, phase)`이고, 날씨 10가지 × 새벽 · 낮 · 저녁 · 밤이에요(`pal()` 팔레트).
  - 시간대는 `phaseOf(time, sunrise, sunset)`예요.
  - 도시 카드는 `cardSky`, 홈 위젯은 `widgetSky`(340×150, 그림은 가운데)예요.
- 구름(`puffSvg(x, y, w, color, 초당px)`)
  - 전부 오른쪽으로만 흘러요. 나가면 왼쪽에서 다시 들어와요.
  - 속도는 소망이 맞춘 값이에요. 보통 2.24~3.9, 강풍 32~40. 바꿀 때는 요청한 비율만큼만 바꿔요.
- 안개: 움직이지 않아요. 위로 갈수록 얇고 흐린 줄 3개(오른쪽으로 비켜서)가 있고, 아래는 원래 안개 띠예요.
- 움직임은 `prefers-reduced-motion`이면 멈춰요.

### 그 밖의 앱
- **건강**
  - 화면: 걸음 · 수면 · 운동 · 심박 · 물 · 체중 · 비교
  - 팔레트는 `HC`(진한색) / `HB`(옅은 바탕)이고, 피치 · 민트 · 라벤더블루 계열이에요. 주황 · 초록 · 보라 원색은 "못생김"이라고 했어요.
- **파일**
  - 사진은 `photoScene`(바다 · 도시 · 밤 · 음식 · 언덕 …), 문서 첫 장은 `docSvg`(티켓 포함)예요.
  - 종류는 `look`이나 낱말로 정해요(`lookOf`).
- **쇼핑**
  - 상품 그림은 `phoneprod.js` 실루엣이에요. 로고 · 탭은 테마 방지가 돼 있어요.
  - 맨 위 종 · 장바구니 아이콘은 아직 **눌러도 아무것도 안 돼요**(남은 일).
- **배달:** 배달의민족(한국 거주) / Uber Eats(그 외) 두 모양이에요. 한국어 알약은 `dvKp`예요. 음식은 전부 `phonefood.js` 그림이에요.
- **홈 2쪽:** 아이콘 색은 `CG_GEL`이고, 맨 위 위젯은 지금 있는 곳의 날씨예요(날씨를 안 채웠으면 지갑 위젯).

---

## 5. 데이터 쪽 경계 (반영 담당 세션)

- **반영 코드는 다른 세션(반영 쪽 오푸스) 담당이에요.** `src/phonesync.js`, `phonesyncmoney.js`, `phonesynclife.js`의 반영 부분, `src/phonedata.js`의 반영 지시문(약 199~213줄)이에요.
- 디자인 때문에 거기를 고쳐야 하면 직접 고치지 말고, 소망에게 **그쪽에 보낼 메시지**를 써 줘요. 무엇이 왜 필요한지, 지시문 토큰을 늘리지 않는 방법을 같이 적어요.
- 채우기(폰 처음 만들 때 한 번)와 반영(대화가 진행될 때마다, 지시문이 붐빔)은 달라요. 채우기에만 있는 것이 있어요(예: 지갑의 "지난 패스" 2~4개는 채우기에서만 지어내요).
- 날짜: 화면의 "오늘"은 `storyNow(p)`예요. 상태창(status tracker)의 날짜를 먼저 보고, 없으면 반영이 갱신하는 `p.now`를 써요.
- 화면은 이미 있는 필드만 읽는 게 원칙이에요. 낱말 추측은 화면 쪽 코드에서 해요.

---

## 6. 실제 폰에서 확인

### 준비 (한 번)
1. SillyTavern을 받아요. 이 문서를 쓸 때는 1.19.0이었어요.
   ```bash
   git clone https://github.com/SillyTavern/SillyTavern ~/sillytavern && cd ~/sillytavern && npm install
   node server.js   # :8000 (config.yaml이 처음 생겨요. whitelistMode 기본값으로 127.0.0.1 접속 가능)
   ```
2. 확장을 넣어요(바꿀 때마다 다시 복사).
   ```bash
   mkdir -p ~/sillytavern/data/default-user/extensions/NarrativeArchive
   cp -r manifest.json index.js src style.css assets ~/sillytavern/data/default-user/extensions/NarrativeArchive/
   ```
   `src`랑 `style.css`만 바뀌었으면 그 둘만 복사해요. 브라우저를 새로 열면 반영돼요.
3. 테스트 채팅을 넣어요. 기본 캐릭터 Seraphina가 0번이어야 해요.
   ```bash
   mkdir -p ~/sillytavern/data/default-user/chats/default_Seraphina
   cp tools/dev/na_test.jsonl ~/sillytavern/data/default-user/chats/default_Seraphina/
   ```
4. 가짜 모델을 켜요: `node tools/dev/fakeph.mjs`(:5555). 폰 만들기 · 채우기 · 반영에 정해진 답을 줘요. 마지막 요청은 `$TMPDIR/na_fakeph_last_req.json`에 남아요(프롬프트 확인용).
5. Playwright: 클라우드 세션에는 Chromium이 미리 깔려 있어요. `playwright install`은 하지 않아요.

### 찍기
```bash
node tools/dev/probe.cjs light   # 또는 dark → ./shots/home_light.png, home2, bank, wallet
```
모듈로 쓰면 원하는 화면을 찍을 수 있어요.
```js
const { open, SAMPLE_MONEY } = require('./tools/dev/probe.cjs');
const s = await open('light');              // 채팅 열기 → 폰 만들기(가짜 모델) → 잠금 해제
await s.run(SAMPLE_MONEY);                  // 은행 · 지갑 예시 데이터
await s.run(async ({ ph }) => { ph.life.weather.here.cond = 'fog'; });  // 데이터 직접 바꾸기
await s.to('bank'); await s.shot('bank');   // data-go 그대로
await s.p.click('.ax_bkacts [data-go=stmt]');  // 진짜로 눌러 보기
await s.scroll(); await s.shot('bank_bottom');
console.log(await s.overflow(), s.errors());   // 옆으로 삐져나온 것, 페이지 오류
await s.close();
```
- 여러 장을 한 장으로 붙일 때: `ffmpeg -i a.png -i b.png -i c.png -filter_complex "hstack=inputs=3,scale=iw/2:-1" sheet.png` (PIL은 없어요)
- 움직이는 화면(날씨 등)은 `open(theme, { video: 'dir' })`로 녹화해요. 장면마다 폰 프레임 안에 분홍 라벨 div를 붙이고, 그 라벨이 처음 나온 프레임부터 `ffmpeg -ss`로 잘라요. 녹화 시간과 실제 시간이 어긋나서 시간 계산으로 자르면 틀려요.
- 보여줄 땐 실제 폰 화면을 보내요. 확인 못 한 것은 확인 못 했다고 말해요.

### 테스트
```bash
node --test tests/*.test.mjs   # 지금 232개 통과
```
낱말 추측 목록(음식 · 상품 등)을 바꾸면 `tests/phonefood.test.mjs`, `tests/phoneprod.test.mjs` 기대값도 같이 봐요. 낱말끼리 잘못 걸리는 경우가 많았어요. 예: Monkey→key, Bluetooth→blue, Brot→red, 책상→book, 아이스크림→화장품, 컵라면→머그. 좁은 낱말을 앞에 두거나 막는 조건을 넣어요.

---

## 7. 시안 그리기
- HTML 한 파일에 폰 프레임(390 × 844, 둥근 44px, 검정 테두리)을 나란히 그리고, 위에 "A. …" 라벨을 달아요. Playwright로 `fullPage` 찍어서 보내요.
- 시안 아이콘도 SVG 선 아이콘으로 그려요(이모지 금지).
- 버튼 위쪽 빛, 그림자 같은 지금 앱의 질감을 시안에도 넣어요. 빠지면 "예전 CSS가 더 고급스러웠다"는 말이 나와요.
- 실제 데이터 모양(독일어 상점 이름 + 한국어)으로 채우면 판단하기 쉬워요.

---

## 8. 브랜치 · 버전 · 커밋
- 작업은 세션에 정해진 브랜치에서 해요. **메인은 소망이 OK한 뒤에만** 올려요.
  ```bash
  git fetch origin main && git rev-list --count HEAD..origin/main   # 0이어야 그대로 올릴 수 있어요
  git push origin HEAD:main
  ```
  0이 아니면 메인을 먼저 받아서 합쳐요. 반영 쪽 세션도 메인에 올려요.
- 버전은 두 곳을 같이 올려요: `manifest.json`의 `"version"`과 `src/core.js`의 `export const VERSION`. 새 기능이면 가운데, 다듬기면 끝자리를 올려요.
- 커밋 메시지는 영어 한 줄 요약(화면에서 무엇이 어떻게 보이게 됐는지)이에요. 끝에 세션이 주는 Co-Authored-By 줄을 붙여요.
- 강제 푸시는 막혀 있어요.
- 큰 기능은 `README.md`의 해당 절(`## 캐릭터 휴대폰 · 투자`)에도 한두 줄 적어요.

---

## 9. 남은 일 · 아이디어
- **쇼핑:** 맨 위 종 · 장바구니가 눌러도 아무것도 안 돼요. 살리거나 빼야 해요.
- **파일:** `look` 목록 대신 사진 · 영상은 한 줄 설명을 코드가 낱말로 읽게 바꾸자고 미뤄 둔 게 있어요("이따 하자"). 옛 `look` 값은 계속 읽고, 바꾼 뒤 반영 쪽에 `look` 목록을 지시문에서 빼라고 메시지를 줘요.
- **은행 송금 화면:** 사람을 누르면 아래에 그 사람과 주고받은 돈이 떠요. 위 동그라미는 이름이 7글자에서 잘려요.
- **1쪽 앱들**(메시지 · 전화 · 사진 · 카메라 · 캘린더 · 메모 · 지도 · 메일 · SNS · 일기 · 검색 · 설정): 이번 작업에서는 안 건드렸어요. 누르는 척 버튼이 남아 있는지 훑어볼 만해요.
- **투자 · 시계 · 음성 메모:** 2쪽에서 아직 다시 그리지 않은 앱이에요.
