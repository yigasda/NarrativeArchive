# 디자인 인수인계 (휴대폰 · 확장 패널)

디자인 작업(캐릭터 휴대폰, 확장 패널 · 팝업)을 하는 세션이 시작 전에 다 읽는 문서예요. 1~5장은 휴대폰, 6장은 확장 패널이에요.

---

## 1. 소망과 일하는 법

### 대화
- 짧고 쉬운 한국어 존댓말로 답해요. 감정 이야기로 시작하지 않고, 묻지 않은 조언은 하지 않아요.
- **질문에는 답만 해요. 코드는 건드리지 않아요.** "이거 어케 돼?" 같은 건 질문이에요.
- "넹 · 굿 · 웅 · ㄱㄱ · ㅇㅋ"를 받으면 진행해요. 메인은 "메인 ㄱ"을 받고 올려요.
- 설명이 길면 "먼소리야"가 와요. 쉬운 말로 짧게 다시 해요.
- 지시가 두 가지로 읽히면 짧게 확인해요(이름 · 대상을 헷갈린 적이 많아요. 예: "파크"는 놀이공원이 아니라 경기장 이름이었어요).

### 작업 순서
1. **시안부터.** 새 화면이나 큰 변경은 서로 확실히 다른 시안 3~4개를 그려 보여주고 고르게 해요.
2. 고른 걸 코드로 옮겨요.
3. **실제 폰에서 찍어서** 보여줘요(8장). 내 눈으로 먼저 걸러서, 깨진 건 보내지 않아요.
4. 작업 브랜치에 커밋하고 올려요. 메인은 허락받고 올려요(10장).

### 소망이 정해 준 기준 (그대로 지켜요)
- 고르신 건 건드리지 않고, 안 고른 것만 다시 그려요.
- 동그라미 안 친 건 넣지 않아요.
- 기존 디자인의 "퀄리티를 맞추라"는 말은 "기법을 베끼라"는 뜻이 아니에요.
- 정해진 배치 · 디자인은 혼자 바꾸지 않아요. 바뀌는 건 시킨 것뿐이에요.
- **줄 원칙:** 줄은 넘기지 않고, 길면 "…"으로 줄여요. 단, 원래 그렇게 생긴 화면은 바꾸지 않아요.
- **광학 정렬(optical alignment):** 아이콘과 글자가 눈으로 봐서 가운데에 맞아야 해요. 숫자상으로만 가운데면 안 돼요.
- **은은한 입체감:** 흰 카드에는 그림자를 넣고, 둥근 버튼 위쪽에는 살짝 빛(inner highlight)을 넣어요. 평평한 흰 덩어리는 안 돼요.
- **페더링(feathered edge):** 무늬는 한쪽(보통 오른쪽)에 깔리고, 글자 쪽으로 길고 부드럽게 사라져요. 딱 끊긴 경계는 안 돼요.
- **피해야 할 것:** 클립아트 · PPT 도형(네모 · 원 · 삼각형 그대로) · 듬성듬성한 선 · 장식용 그라데이션 띠 · 엠보싱 마크 · 징그러운 반복(작은 칸 안에 또 칸이 있는 것) · 키보드처럼 보이는 격자
- **일러스트가 아니라 재질 · 표면(texture / surface, not illustration):** 퀼팅, 대리석, 다마스크, 뜨개, 필름 그레인, 홀로그램처럼 그 장소의 물성이에요. 마이크 · 바퀴 · 방패 같은 오브젝트나 무대 · 호텔 같은 장면은 안 돼요.
- **보라는 조심해요.** 파스텔(유치함)이나 네온 시티펑크로 빠지기 쉬워요. 화면 전체가 보라에 맞춰져 있지 않으면 쓰지 않아요.
- 숫자로 요청받은 값(속도 · 크기)은 정확히 그만큼만 바꿔요.
- AI에게 고르게 하는 필드를 늘리지 않아요. 그림 · 종류는 코드가 낱말로 추측해요(영 · 독 · 한 · 일 · 중). 새 필드가 꼭 필요하면 먼저 물어봐요.

---

## 2. 디자인 철칙

- **실제 앱의 문법:** 사람들이 아는 실제 앱의 배치 · 위계를 따라요(날씨는 애플 날씨, 지갑은 애플 지갑 덱, 배달은 배민 / Uber Eats, 은행은 국내 은행 앱). 상표 · 로고는 베끼지 않아요.
- **보드 크기:** 모든 앱은 390 × 844 기준 px로 그려요. 본문 14.5~15px, 보조 12~12.5px, 작은 라벨 10.5~11px, 큰 숫자 34~38px예요.
- **그 사람의 폰:** 사는 나라에 맞춰요(가게 이름, 통화, 계좌번호 · 택배사 · 날짜 모양). 한국어는 보조 줄(ko)로만 붙어요.
- **지어낸 세부는 늘 같게:** 번호 · 무늬 · 사진 장면은 이름 · id 해시로 정해요. 무작위는 쓰지 않아요.
- **색:** 채도 낮춘 차분한 색이에요. 앱마다 강조색 하나(`AXB_C`의 `--axd` 진한색 + `--axc` 옅은색)만 써요. 아이콘 타일은 같은 색의 옅은 바탕 + 진한 선이에요. 홈 아이콘끼리 비슷한 색이 붙거나 하나만 튀면 안 되고, 노랑은 크림 쪽으로 눌러요.
  - 돈 색: 들어온 돈 초록 `#3f7d50`, 나간 돈 · 급한 D-day `#b8573a`, 대기 노랑 `#8a6a1f` / `#f3e8c9`
  - 이미 정한 앱의 얼굴(은행 남색 `#1d3461`, 카드 등급 색)은 바꾸지 않아요.
- **깊이:** 떠 있는 건 그림자가 두 겹이에요(`0 1px 2px` 4~5% + `0 8~14px 24~30px` 5~18%). 어두운 면 위 버튼 · 카드는 `inset 0 1px 0 rgba(255,255,255,.14~.2)`. 테두리 대신 면과 아주 옅은 선(`#eef0f3`)으로 나눠요. 겹치는 건 실제처럼 겹쳐요(지갑 덱은 자르지 않아요).
- **그림:** 음식 · 하늘 · 사진 · 상품은 평평한 면을 겹친 SVG예요. 알아보는 데 필요한 모양만 또렷하게 하고, 그림 바탕은 주인공과 대비가 나게 해요. 글자 자리는 비워요. 같은 모양을 같은 굵기로 줄줄이 반복하지 않아요.
- **글자:** 본문은 시스템 글꼴, 숫자는 `'Inter Tight'`(`.cg_num`). 머리 영역은 "작은 회색 라벨 → 큰 숫자 → 작은 보조 줄" 세 줄이에요. 라벨은 짧게, 설명문은 길게 쓰지 않아요. 앱 안 말은 그 앱의 말로 써요(은행은 은행 말).
- **모양 · 여백:** 큰 카드 22px, 실물 카드 16~20px, 아이콘 타일 11~13px, 칩 999px. 좌우 14~16px, 줄 위아래 12px, 카드 사이 12~14px. 섹션은 "작은 회색 제목 → 흰 카드"이고, 카드 안에 카드를 넣지 않아요. 확장 창은 위아래 여백이 같아야 해요(16px).
- **상호작용:**
  - 보이는 버튼은 다 눌려야 해요. 할 게 없으면 버튼 모양을 빼요.
  - 비어도 휑하지 않게 해요. 빈 화면은 한 문장으로 무엇이 여기 모이는지 말해요.
  - 지난 것은 반투명이 아니라 회색조(`grayscale`)예요. 값 없는 칸은 라벨째 빼요.
  - 고르면 제자리에서 먼저 펼치고, 한 번 더 누르면 상세로 가요. 스크롤은 그대로 둬요.
  - 첫 자리에는 그 앱의 본론이 와요. 같은 걸 두 번 보여주지 않아요.
- **움직임:** 느리고 조용하게 해요. `prefers-reduced-motion`이면 멈춰요.
- **고르기:** 하나를 고르고 일부를 바꿔 달라고 하면, 고른 것의 장점은 두고 그 부분만 풀어요. 바꾼 것만 짧게 말하고 화면을 보여줘요.

---

## 3. 코드 지도

### 화면이 그려지는 방식
- 화면은 전부 HTML 문자열을 돌려주는 함수예요. 루트는 `.na_ph_scr.ax`예요.
- 화면 이동은 `data-go="경로"`(+ `data-i`)예요. `src/phone.js`가 받아 `view = "경로:값"`으로 다시 그려요. 처음 콜론만 잘라서 값에 콜론이 있어도 돼요.

### 주요 파일
| 파일 | 내용 |
|---|---|
| `src/phone.js` | `screen()`, 경로 · 클릭 처리, 스크롤 유지, 확인 창 `askSheet`, 그린 뒤 처리(`placeAsk`, `trPop`, `notchPasses`) |
| `src/phoneapps.js` | 공용 도우미, 아이콘 `AX`, 앱 색 `AXB` / `AXB_C`, 1쪽 앱들 |
| `src/phonehome.js` | 잠금 · 홈 1 · 2쪽(`.cg`, 아이콘 `CG_I`, 색 `CG_GEL`) |
| `src/phonemoney.js` | 은행 · 지갑 · 쇼핑 · 음성 메모 |
| `src/phonepassart.js` | 지갑 표 뒤 무늬 |
| `src/phonelifeapps.js` | 시계 · 건강 · 파일 · 날씨 · 배달 |
| `src/phonefood.js` · `src/phoneprod.js` | 음식 그림 · 상품 실루엣(낱말로 고르기) |
| `src/phonemap*.js` · `phoneflags.js` | 다녀간 곳 지도, 도시 찾기, 확대, 국기 |
| `src/phonestime.js` · `phoneicons.js` · `phonescreen.js` | 스크린타임, 앱 아이콘, 앱 목록(CATALOG) |
| `src/phonedata.js` | 폰 데이터 모양, 채우기 지시문, `storyNow` |
| `css/5*-phone-*.css` | 휴대폰 CSS(`style.css`가 `css/`를 `@import`) |

### 공용 도우미 (`src/phoneapps.js`)
- `ax(k, size, color, strokeWidth)`: `AX[k]`로 선 아이콘을 만들어요. 새 아이콘은 `Object.assign(AX, { 이름: 'path d' })`(24×24)이고, 이름이 겹치면 덮어써요(먼저 grep).
- `axBar` 상태줄 · `axTop` 위쪽 줄 · `axCb(go)` 뒤로 버튼 · `axH1` 큰 제목 · `axInd` 홈 막대 · `axDay` 날짜 · `axTint` · `axLetter` 아바타 · `axKp` 한국어 알약 · `busyHtml`

### 새 화면을 더할 때
1. `export function xxxScreen(p, now, i)`를 만들어요. `axBar` … `axInd()`로 감싸요.
2. `src/phone.js`에 import하고 `screen()`에 경로를 더해요. `data-i`를 늘 받으면 첫 목록, 있을 때만 받으면 두 번째 목록에 더해요. 같은 화면 안에서 고르기만 바뀌면 `stay`에 더해요.
3. `AXB`에 앱 색을 더해요.
4. CSS는 그 앱 묶음에 더해요(4장 규칙).
5. 테스트 → 실제 폰 → 버전 → 커밋(8~10장).

### 함정
- **DOM을 자주 바꾸지 않아요.** 테마 방패의 `:has()` 때문에 폰 안에서 스타일 · 속성을 한 번 바꿀 때마다 창 전체(약 765개)를 다시 계산해요(느린 폰에서 40ms). 손가락을 따라가는 건 canvas 하나에만 그리고, 끝날 때 한 번만 바꿔요(`phonemapzoom.js`). 그린 뒤 재는 일은 읽기를 다 하고 쓰기를 모아서 해요(`notchPasses`).
- **순환 import:** `phonehome.js`가 `phonelifeapps.js`를 import하면 안 돼요. 홈 날씨 위젯은 `phone.js`가 넘겨요.
- **테스트 스텁:** `tests/investment.test.mjs`가 `phonemoney.js`의 import를 손으로 이어 줘요. 새 import를 더하면 거기에도 더해요.
- **은행 잔액:** `migrateBank`가 장부(`finance.js`)에서 잔액을 다시 써요. 잔액을 바꾸려면 장부에 넣어요.
- **CSS 괄호:** 한 줄에 규칙을 이어 쓰다 `}`를 빠뜨리면 아래가 전부 깨져요. 고친 뒤 `{` · `}` 수를 세 봐요.

---

## 4. 테마 충돌 (가장 많이 깨지는 곳)

소망은 SillyTavern 테마를 씌워 써요. 테마가 `button` · `label` · `input` · `select`를 칠해서 폰 안이 깨져요.

1. **폰 안 `button` / `label`은 `background` 대신 `--axbg`, 그림자는 `--axsh`예요.** 큰 규칙이 `var(--axbg, transparent) !important`로 덮어써요.
2. div · span은 `background`를 그냥 써도 돼요. 눌려야 하는데 테마를 피하려면 `<div role="button" tabindex="0" data-go=…>`를 써요.
3. 글자 크기 · 둥글기는 `--axfs` · `--axr` 같은 변수와 같이 써요. 새 `!important`는 더하지 않아요.
4. `input` / `select`는 투명하게 덮고 보이는 값은 따로 그려요. 글 쓰는 칸은 `contenteditable` div를 감싼 칸이 그려요.
5. 폰 화면은 어두운 테마에서도 같은 밝은 화면이에요. 확인은 `probe.cjs dark`로 해요.
- **클래스는 전역이에요.** 새 이름은 grep으로 비어 있는지 보고, 앱 앞글자를 붙여요(`lf_` `dv_` `cd_` `ax_bk` `iv_` `cg_` `mq_` `mp_`).
- 홈은 다른 체계예요(`.na_ph_scr.cg`, `.cg_canvas`). 앱과 홈에 같이 쓰는 건 `:is(.ax, .cg)`로 걸어요.

---

## 5. 디자인 체계

### 공통 토큰
- 흰 카드 `.ax_card`(22px, 두 겹 그림자) · 종이(명세서 · 확인증) · 실물 카드 · 패스 그림자 단계
- 줄 `.ax_rw`(`.ax_fi` 아이콘, `.ax_tx` > `b.ax_n` + `.ax_p`, 오른쪽 `.ax_amt` / `.ax_fxv`), 섹션 제목 `.ax_sec` · `.ax_shd`
- 배지 `.ax_dd`(`.ok` `.g`) · `.ax_pend` · `.ax_lnk`, 칩 `.ax_chips`(남색 머리 위는 `.ax_mch`)
- 확인 창: `askSheet(제목, 설명, 버튼, safe)` → 아래에서 올라오는 유리 카드(`.pcf`). 번역 실패 · 도시 고르기 팝업도 같은 카드예요.

### 은행 (`.ax_bk`)
- 남색 머리 `.ax_bkh` → 머리 위로 올라오는 흰 시트 `.ax_bks` → `.ax_scroll` → 아래 탭. 둥근 버튼 `.ax_bkc`, 버튼 줄 `.ax_bkacts`.
- 경로: `bank` · `acct:i` · `tx:id` · `txdoc:id` · `fixed` · `banksend` · `stmt` · `banknote` · `bankmore`
- 고정 지출 `fixedCosts`(낱말 목록 + 두 달 같은 금액 · 같은 날), 등급 `bankTier`(예금 합계 + 이름), 계좌번호 `acctNo`(나라 모양)
- 반영이 넣는 기록: 자동이체 `tx.auto`, 잔액 조정 `tx.adjust`(이름은 은행 나라 말, 사유는 상세에만), 카드 대금 `tx.cardBill`, 정기 입출금 `p.money.regulars`, 자산 · 부채(더보기 안, 첫 화면엔 자산 한 줄만)

### 지갑 (`walletScreen`)
- 한 덱: PRIVATE 멤버 카드 → 카드 → 다가올 패스. 펼친 하나만 다 보이고 나머지는 윗줄 60px(`.sh`, 윗줄 + 26px까지만 그려요). 뒤 카드를 누르면 `wallet:키`로 그 자리에서 펼쳐져요. 지난 패스는 아래 회색 덱 `.ax_psold`.
- 카드 그림 `cardArt` / `cardLook`. 은행 색 `BANK_C`와 무늬 `PATS`는 해시로 고르니 **목록에서 빼지 말고 자리를 바꿔요**(빼면 다른 은행 색이 다 밀려요).
- 표 `passArt`: 종류 `passKind`(낱말, 12종). **모든 표의 배치는 같고**, 종류마다 색(`PASS`)과 뒤 무늬(`phonepassart.js`, 종류마다 둘, id로 골라요)만 달라요. QR 상세 표에는 무늬가 없어요.
- 노치: 떼어 쓰는 표 양옆에 반원 홈(`.ax_psnt` + `notchPasses`가 `--ny`를 재서 바탕 · 무늬를 뚫어요, 그림자는 `drop-shadow`). 호텔 · 회원권 · 공연 · 영화는 없어요(`NOTCHED`).
- 표가 끝났는지 `PASS_OVER`, 날짜 모름 `dayUnknown`, 기간 `until`. 캘린더는 표를 복사하지 않고 읽어요.

### 그 밖의 앱
- **날씨:** `scene(cond, phase)` 10가지 × 시간대 4, 도시 카드 `cardSky`, 홈 위젯 `widgetSky`. 구름은 오른쪽으로만, 안개는 멈춰 있어요. 속도는 정해진 값 그대로예요.
- **건강:** 팔레트 `HC` / `HB`(피치 · 민트 · 라벤더블루).
- **파일:** 사진 `photoScene`, 문서 `docSvg`, 종류 `lookOf`.
- **쇼핑:** 상품은 `phoneprod.js` 실루엣이에요.
- **배달:** 한국 거주는 배민, 그 외는 Uber Eats 모양이에요. 음식은 `phonefood.js`예요.
- **스크린타임**(`phonestime.js`, `stime[:MM-DD]`): 7일 쌓은 막대이고, 많이 쓴 종류 셋만 색, 나머지는 회색이에요. 누른 날만 진하게 보여요. 세로 눈금은 많아야 4개예요. 평균 점선 옆 숫자는 가까운 눈금이 비켜요. 앱 아이콘은 `phoneicons.js`(키는 CATALOG id)예요.
- **메시지:**
  - 꾹 누르기(0.48초)는 복사 · 재번역 · 선택 · 삭제예요. 재번역은 `AI_SYS_RETRANSLATE`, 삭제는 `deleted: true`예요.
  - 단톡은 `group: true`이고, 목록 미리보기는 원문 한 줄 + 한국어 한 줄이에요.
- **다녀간 곳**(`mapScreen`, `map[:도시]`):
  - 지도 위에 시트가 올라와요(날짜 띠 → 목록 → 다른 곳).
  - 지도 64장(`phonemaptowns.js`)이고, 어느 지도를 쓸지는 도시 표 `citytable.md` → `gencity.py` → `phonemapcity.js`로 정해요.
  - 찾기 버튼은 두 군데 늘 보여요(`mapFindBtn` · `mapFindRow`).
  - 확대는 `phonemapzoom.js`예요(3장 함정).
- **도시 찾기**(`phonemapsearch.js` · `phonemapfind.js`, `mapq` · `mapc`): 도시 · 동네 · 지도 종류 · 나라(`findCountries`)를 여러 언어 이름으로 찾아요.
- **홈 2쪽:** 맨 위는 지금 있는 곳 날씨 위젯(`hereWidget`)이에요. 날씨가 비면 유리 카드 `.cg_wxe`예요.

---

## 6. 확장 패널 · 팝업 (휴대폰 바깥)

패널(홈 · 아카이브 · 압축 · 도구 · 설정 탭)과 거기서 여는 팝업이에요. 분위기는 **크림색 종이 노트**예요.

### 분위기
- 밝게: 크림 바탕 + 갈색 글자 + 탄 주황 강조. 어둡게: 차콜 바탕 + 크림 버튼 + 금색 작은 강조. 설정 › 테마로 고르고 `body.na_darkui`가 붙어요(`src/theme.js`).
- 내용은 둥근 카드(`--na-card`), 고르기는 알약 칩 · 분할 탭(`.na_v2_tabs` `.na_v2_seg` `.na_v2_chips`)이에요.
- 숫자는 고정폭(`tabular-nums`), 원문 · 편집칸은 `--monoFontFamily`예요. 아이콘은 `svgA(ICO_A.이름)`예요.

### 색 토큰 (`style.css` › `/* mockup palette */`)
| 토큰 | 밝게 | 어둡게 | 쓰임 |
|---|---|---|---|
| `--na-ink` | `#463428` | `#ECEAE6` | 본문 |
| `--na-accent` / `-ink` / `-soft` | `#B8541F` / `#A84A17` / `#F6E1D3` | `#E9DFCF` / `#F0CF8E` / `#3A3222` | 강조 · 주요 버튼 |
| `--na-card` / `--na-card2` / `--na-paper` | `#F7EEE7` / `#F1E6DD` / `#F7EEE7` | `#3A2F28` / `#44382F` / `#3A2F28` | 카드 · 탭 |
| `--na-line` / `--na-line2` | `#E5D5C9` / `#F1E6DD` | `#54463D` / `#44382F` | 선 |
| `--na-dim` / `--na-mute` / `--na-sub` | `#8A7A70` / `#6B5A50` / `#7A6A60` | `#B3A396` / `#CABBAE` / `#BFB0A3` | 보조 글자 |
| `--na-fill` / `--na-onfill` | `#6E5D52` / `#F7EEE7` | `#5E4C41` / `#F7ECE2` | 선택된 칩 |
| `--na-ok` `--na-bad` `--na-warn` `--na-amber` `--na-purple` (+ `-soft`) | 상태색 | 밝게 올린 같은 색 | 상태 |
| 패널 바탕 | `#F0E4DB` | `#1C1C20` | 고정 |

- 다크: 팝업 바탕 `#17171A`, 카드 `#232328`, 칸 `#2E2E34`. 색을 반투명하게 깐 바탕(셀로판지)은 쓰지 않고, 색은 아이콘 · 글자 · 얇은 선에만 넣어요. 크림 위 글자는 `--na-onaccent`예요.
- **밝은 테마 규칙을 쓰면 바로 뒤에 `body.na_darkui` 짝을 써요.** 토큰을 쓰면 짝이 필요 없어요.

### 테마 방어 (패널 쪽)
- 팝업 바탕 · 글자를 `dialog.popup:has(.na_popup, #na_settings)`에 고정해요. SillyTavern 테마 변수(`--SmartTheme*`)를 우리 값으로 덮어써요.
- 버튼은 `.na_btn`(`.na_primary` `.na_small`), 스위치는 `.na_tgl_ui`예요. 입력칸은 겉 상자가 그리고 `input`은 납작하게 둬요. `small`은 `opacity: 1`이에요.
- 확인 창은 `util.confirm(제목, 설명, 버튼, { danger, no })`예요. 이길 때는 `:not(#na_x)`를 붙여요.
- 창 크기: 내용만큼, 최소 높이는 화면의 55%예요. 닫기는 아래 "닫기" 하나예요(`src/popupchrome.js`).
- 빈 창 예시 인물은 Claude · GPT · Gemini(`exFace`, 색 고정)예요.
- 새 화면은 아주 화려한 테마를 씌워 한 번 확인해요.

### 코드 위치
| 파일 | 내용 |
|---|---|
| `src/panelhtml.js` · `panelbind.js` · `panel.js` · `panelcfg.js` | 패널 HTML · 이벤트 · 설정 탭 |
| `src/theme.js` | 확장 테마, 아이콘 `svgA` · `ICO_A` |
| `src/studio.js` · `wizard.js` · `browser.js` · `append.js` | 압축 작업실 · 마법사 · 섹션 둘러보기 · 아카이브에 추가 |
| `src/people.js` · `calendar.js` · `xray.js` · `worldmap.js` · `drift.js` 등 | 이야기 도구 |
- 팝업은 `callGenericPopup($root, POPUP_TYPE.TEXT, '', { wide, large, … })`로 열고 루트에 `.na_popup`(새 화면은 `.na_v2`도)을 붙여요.

### 패널 원칙
- 한 화면에 한 가지 일이에요. 긴 설정은 묶음 카드로 접고, 순서가 있는 건 한 단계씩 보여줘요.
- 탭 머리는 "방법 고르기 + 한 줄 설명 + 큰 실행 버튼 하나"예요.
- 기능을 더할 때 먼저 빼거나 합칠 걸 찾아요.
- 결과 · 원문 · 차이는 고정폭 종이 칸에 두고, 바뀐 곳만 색으로 짚어요.
- 이야기 도구는 데이터가 그림이 되게 해요(얼굴 · 막대 · 달력 · 연결망).
- 시안은 밝게 · 어둡게 둘 다 찍어요.

---

## 7. 데이터 쪽 경계 (반영 담당 세션)

- 반영 코드(`src/phonesync*.js`, `src/phonedata.js`의 반영 지시문, `phonetr.js`)는 반영 세션 몫이에요. 고쳐야 하면 **그쪽에 보낼 메시지**를 코드블럭으로 써 줘요(무엇이 왜 필요한지, 지시문 토큰을 늘리지 않는 법).
- 채우기(처음 한 번)와 반영(대화마다)은 달라요.
- 화면의 "오늘"은 `storyNow(p)`예요. 화면은 있는 필드만 읽고, 낱말 추측은 화면 쪽에서 해요.

---

## 8. 실제 폰에서 확인

### 준비 (한 번)
1. SillyTavern을 받아 `node server.js`(:8000)로 켜요. 처음 뜨는 환영 창은 한 번 저장해 넘기고, `settings.json`의 `"main_api"`를 `"openai"`로 바꿔요(Horde는 접속이 안 돼요).
2. 확장을 복사해요(바꿀 때마다).
   ```bash
   cp -r manifest.json index.js src style.css css assets ~/sillytavern/data/default-user/extensions/NarrativeArchive/
   ```
   `css`를 빼먹으면 스타일이 하나도 안 먹어요.
3. 테스트 채팅 `tools/dev/na_test.jsonl`을 `chats/default_Seraphina/`에 넣어요.
4. 가짜 모델을 켜요: `node tools/dev/fakeph.mjs`(:5555).
5. Playwright는 미리 깔려 있어요. `playwright install`은 하지 않아요.

### 찍기
```js
const { open, SAMPLE_MONEY } = require('./tools/dev/probe.cjs');
const s = await open('light');            // 또는 'dark'
await s.run(SAMPLE_MONEY);                // 은행 · 지갑 예시 데이터
await s.run(async ({ ph }) => { /* 데이터 직접 바꾸기 */ });
await s.to('bank'); await s.shot('bank'); // data-go 그대로
await s.scroll(); console.log(await s.overflow(), s.errors());
await s.close();
```
- 움직이는 화면은 `open(theme, { video: 'dir' })`로 녹화해요.
- 확인 못 한 건 확인 못 했다고 말해요.

### 테스트
```bash
node --test tests/*.test.mjs
```
CSS 줄 수 한도는 `tests/css.budget.json`이에요. 새 기능 몫만큼만 늘려요. 낱말 추측 목록을 바꾸면 `phonefood` · `phoneprod` 테스트 기대값도 같이 봐요. 낱말끼리 잘못 걸리기 쉬워서, 좁은 낱말을 앞에 둬요.

---

## 9. 시안
- HTML 한 파일에 폰 프레임(390 × 844)을 나란히 두고 "A. …" 라벨을 달아요. 실제 데이터 모양으로 채우고, 지금 앱의 질감(그림자 · 위쪽 빛)을 넣어요.
- 고른 시안은 `docs/mockups/`에 넣어요(세션 임시 폴더는 사라져요). 목록은 `docs/mockups/README.md`예요.
- claude.ai 아티팩트 시안은 Artifact 도구의 `read`로 읽어요.

---

## 10. 브랜치 · 버전 · 커밋
- 작업은 세션 브랜치에서 해요. 메인은 허락받은 뒤에만 올려요.
  ```bash
  git fetch origin main && git rev-list --count HEAD..origin/main   # 0이 아니면 먼저 합쳐요
  git push origin HEAD:main
  ```
- 버전은 `manifest.json`의 `"version"`과 `src/core.js`의 `VERSION`을 같이 올려요. 합칠 때 버전이 겹치면 둘보다 높게 올려요.
- 커밋 메시지는 영어 한 줄 요약 + 세션이 주는 Co-Authored-By 줄이에요. 강제 푸시는 막혀 있어요.

---

## 11. 남은 일
- **쇼핑:** 맨 위 종 · 장바구니, 아래 탭이 눌러도 아무것도 안 돼요. 살리거나 빼야 해요.
- **파일:** 사진 · 영상 종류를 `look` 대신 낱말로 읽게 바꾸기로 미뤄 뒀어요. 바꾼 뒤 반영 쪽에 `look` 목록을 빼라고 메시지를 줘요.
- **1쪽 앱들:** 누르는 척 버튼이 남아 있는지 훑어볼 만해요.
- **투자 · 시계 · 음성 메모:** 아직 다시 그리지 않았어요.
