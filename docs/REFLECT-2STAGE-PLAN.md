# 반영 2단계 나누기: 상세 계획서 (인수인계용)

반영 담당 세션이 맡은 작업이에요. 이 문서만 읽고 이어서 할 수 있게 썼어요.
설계는 2026-11-03에 소망과 테스트 세션이 확정했어요. 코드는 아직 안 바꿨어요.

- 시작 기준: 메인 3.169.89 (`0f3ad7d`), 작업 브랜치 `ccr-7895cb93-30ms96`
- 진행 규칙: 소망이 "ㄱㄱ"를 주면 작업 2번(지시문 나누기)부터 시작해요. 메인은 허락받고 올려요.

> **설계 변경 (2026-11-03, 소망 확정): 생활은 core에 남기고 돈만 떼요.**
> 처음 설계는 life도 따로 떼는 거였어요. 그런데 날짜는 거의 매 반영마다 넘어가서(run28~32) life 요청이 거의 매번 가요.
> 게다가 life는 본문 전체가 필요해서(테스트 세션 1번), 본문이 core와 life에 두 번 들어가요. 그러면 평소 반영이 지금보다 무거워져요.
> 그래서 생활(알람·타이머·파일·건강·날씨)은 core에 그대로 두고, **돈(은행·카드·주문·티켓·투자·배달)만 2단계로 떼요.**
> 아래에서 "life 요청", "생활 다시 읽기", `s.owed.life`, `STAGE: life`가 나오면 **없는 걸로** 읽어요. 빚은 `s.owed.money`만 있어요.
>
> 실측 (3.169.90 작업 브랜치): 옛 반영 3,813 · core(생활+날씨) 2,626 · core(생활, 날씨 없음) 2,318 · core(생활 없는 폰) 1,562 · money(배달 포함) 1,582 · money(배달 없음) 1,201토큰.
> 돈 없는 반영은 약 1,200토큰 가벼워지고, 돈 있는 반영은 core + money = 약 4,200(옛보다 +400)이에요. money 머리말(GOAL·YOU GET)을 줄이면 더 내려갈 수 있어요.
> 코드: `coreSystem(opts)`는 `updateSystem({ ...opts, money: false, split: true })`예요. `split`이면 첫 줄 `STAGE: core`, money 표시(`"apps": [] or ["money"]`), 돈만 오가는 장면도 이벤트라는 줄이 붙어요. `moneySystem({ delivery })`는 따로 있어요.

---

## 1. 왜 하나

- 반영 지시문(`updateSystem`, `src/phonedata.js` 128줄 근처)이 앱 칸 설명 때문에 계속 커져요.
  - 3.169.89 기준, 앱이 다 있는 폰에서 약 3,813토큰(13.7k자)이에요. run30 11.5k자에서 run31 14.1k자로 늘어난 기록도 있어요.
  - 구성: 답 모양 약 1,170, 폰 앱 칸 약 890, 규칙 약 1,400, 시작·받는 자료 약 330토큰이에요.
- 앱을 하나 더 늘리면 그 칸 설명이 **모든** 반영에 붙어요. 그래서 앱을 늘리기가 어려워요.
- 지금은 인용 하나나 결제 하나가 어긋나면 그 장면 전체(문자·사진 포함)가 빠져요.
  - 예: run27 #65에서 계약서 파일이 이렇게 사라졌어요.
- 키워드 목록으로 앱을 고르는 방식(방법 1)은 소망이 거절했어요. 언어와 말투마다 새는 데가 생겨서예요.
  - 대신 모델이 이벤트에 표시를 붙이는 방식(방법 2)으로 가요.

## 2. 큰 그림

```
1단계 core (항상)  →  이벤트 + 기본 앱 + now + 이벤트마다 "apps" 표시
                       │
     코드가 표시·빚 목록·날짜 넘어감·날씨 조건으로 고름
                       │
2단계 (필요할 때만, 동시에 보냄)
   ├─ money : 은행·카드·주문·티켓·투자·배달 (한 요청에 같이)
   └─ life  : 알람·타이머·파일·건강(이벤트 + 하루 칸 + 습관)·날씨
```

- 평소엔 호출 1번, 많아야 3번이에요.
- 체감 시간은 "1단계 + 5~10초" 정도예요. 지금 기다리는 시간은 대부분 1단계 출력(문자 원문 옮기기, 출력 3~7k토큰, 15~45초)이라서요.

## 3. 각 요청에 들어가는 것

### 3-1. core (1단계)

- **지시문 첫 줄:** `STAGE: core` (테스트 하네스가 로그를 나눠 저장해요)
- **남기는 부분:** GOAL, YOU GET, WHAT IS NEW, WHERE IT COMES FROM, PHONE_STYLE(LANGUAGE·TIMES), PHONE_ITEMS(문자·연락처·통화·사진·메모·검색·캘린더·SNS·메일·일기·음성 메모)
- **함께 남기는 것:**
  - 일정 이동·취소(`was`, `cancelled`)와 삭제 문자(`deleted`) 줄
  - 예약 세부 줄("a booking the story has carries the details…")
- **빼는 부분:** LIFE, MONEY 규칙 전부, 답 모양의 `money`·`days`·`weather`·생활 칸(`alarms`, `files`, `health`, `timers`, `usual`), "Also in money…" 줄
- **새로 넣는 것:**
  1. 이벤트마다 `"apps": ["money", "life"]`
     - 문구 예: `"apps": which other apps this event touches: "money" (a payment, transfer, refund, order, ticket, booking, delivery or trade), "life" (an alarm, timer, file, sleep, steps, workout, coffee or a habit); when unsure, include it`
  2. **돈만 오가는 일도 이벤트예요** (테스트 세션 요청, 꼭 넣기)
     - 문구 예: `A scene where only money moves (a taxi, paying the bill) is still an event, with "apps": ["money"].`
     - run32의 택시 12,000원처럼 문자·사진 없이 결제만 있는 장면이 있어요. 이게 없으면 이벤트 자체가 안 생겨서 표시도 못 붙여요.
- **입력:** 지금과 같아요. NEW MESSAGES, ARCHIVE FOR/BEFORE, STORY NOW, EVENTS ON THE PHONE, STORY YEAR, DAYS, MESSAGES READ BEFORE, PHONE NOW, WORLD, LOREBOOK, OWNER, 프로필, 모르는 것, 이름표.
  - **빼는 입력:** MONEY NOW, INVESTMENTS NOW, DELIVERY SHOPS, LIFE NOW, WEATHER NOW, WEALTH. 1단계가 이걸 볼 필요가 없어요.
- **예상 크기:** 지시문 약 2,000토큰

### 3-2. money (2단계 A)

- **지시문 첫 줄:** `STAGE: money`
- **보내는 조건 (하나라도):**
  - 1단계 이벤트 중 `apps`에 money가 있음
  - `s.owed.money`가 비어 있지 않음 (빚, 4장 참고)
- **지시문:** 지금의 MONEY 규칙 전부, 배달 규칙, 돈 답 모양(moves/trades/orders/passes/deliveries/newShop), "Also in money" 줄(newAccount/newCard/cart/watch/quotes/stakes), 관계 단어 규칙, LANGUAGE
  - 3.169.85~89에서 넣은 것 유지: 팁 문화, 남의 돈(회사·가족 돈, 아직 안 받은 상속), 놓고 간 곳·수저·인원, 메뉴 설명·대표
- **입력:**
  - 대상 이벤트 목록(id, at, date, time, summary, quote). money 표시 이벤트와 빚 이벤트를 합친 거예요.
  - 대상 이벤트의 메시지 원문 **+ 앞뒤 메시지 하나씩** (테스트 세션 3번: 주문 #69와 송금이 다른 메시지에 있는 경우)
  - 그 범위의 아카이브
  - MONEY NOW, INVESTMENTS NOW, DELIVERY SHOPS + 지금 장바구니(CART), WEALTH, STORY YEAR, DAYS, OWNER, 프로필, 이름표
- **답:** `{ "events": [{ "id": 1단계 id, "money": { …지금과 같은 모양… } }] }`
  - 처리는 지금 `applyMoney`를 그대로 써요.
  - 1단계에 없는 id는 버리고 알림에 남겨요.
- **배달·투자는 꼭 같은 요청에 둬요.** run31에서 치킨 주문, −28,000 결제, Ren의 +28,000 입금이 한 장면에 엮여 있었어요. 나누면 이중 결제나 누락이 생겨요.
- **예상 크기:** 지시문 약 1,300토큰 + 원문 일부

### 3-3. life (2단계 B)

- **지시문 첫 줄:** `STAGE: life`
- **보내는 조건 (하나라도):**
  - 1단계 이벤트 중 `apps`에 life가 있음
  - `s.owed.life`가 비어 있지 않음
  - 이야기 날짜가 넘어감 (새 now의 날짜가 지금 `p.now`보다 뒤, 또는 건강 하루 칸이 필요함)
  - 날씨를 써야 함 (지금의 `askWeather` 조건 그대로)
- **입력 (테스트 세션 1번, 꼭 지키기):**
  - **이번 범위의 새 메시지 원문 전체**와 그 범위 아카이브를 넣어요. 표시된 이벤트만으로는 모자라요.
    - run31의 01-31 기상 06:00은 "주말에도 6시면 깨"에서, 수면 시각은 "열한 시 반이면 누워"에서 나왔어요. 이런 문장엔 표시가 안 붙어요.
    - 상태창이 없을 때 날씨도 본문 전체에서 읽어요 (run28 "창밖이 흐리네").
  - 1단계 이벤트 목록(id, at, date, time, summary), LIFE NOW, WEATHER NOW(있으면), DAYS, STORY YEAR, OWNER, 프로필
  - **돈 자료는 안 넣어요.**
- **지시문:** 지금의 LIFE 규칙, 생활 답 모양(alarms/files/health/timers/usual), 최상위 days, weather(cities, 새 도시 added 포함), LANGUAGE
- **답:** `{ "events": [{ "id", "phone": { "alarms", "files", "health", "timers", "usual" } }], "days": [...], "weather": {...} or null }`
  - 처리는 지금 `applyLife`, `applyDays`, `fillDays`, `applyWeather`를 그대로 써요.
- **예상 크기:** 지시문 약 1,100토큰 + **원문 전체** (run31 라운드 1은 32k자 중 원문이 16k자였어요)
- 날짜가 넘어가는 반영은 거의 매번이라(run28~32 모두), life 요청은 자주 가요.

## 4. 실패와 빚(owed) 규칙

### 4-1. 빚 목록

- 반영 기록에 `s.owed = { money: [eventId…], life: [eventId…] }`를 둬요.
- 2단계 요청이 실패하면, 그 요청이 맡았던 이벤트 id를 빚에 넣어요.
- 한 이벤트의 결제만 못 넣었을 때(지금은 `applyMoney`가 throw해서 이벤트 전체가 빠짐)도 그 이벤트의 money만 실패로 봐요. 문자·사진은 남겨요.
- 각 빚 항목은 시도 횟수를 가져요. 예: `{ id, tries }`. 두 번 연속 실패하면 건너뛰고 알림에 남겨요. 지금 실패 메시지 규칙(`s.failed[at].tries >= 2`)과 같아요.

### 4-2. 다시 읽기 버튼

- "돈 다시 읽기", "생활 다시 읽기" 버튼이 떠요. **그 라운드가 가장 최근일 때만**이에요.
- 다시 읽기 결과는 **같은 라운드**에 붙여요.
  - `p.syncUndo.effects`와 `byEvent`에 추가
  - `s.events[id].effects`에 덧붙임
  - 복구 기록(journal)의 그 라운드 항목도 갱신
- 그래서 "방금 반영 되돌리기"는 문자와 나중에 들어온 돈을 한 번에 되돌려요.

### 4-3. 다음 라운드로 넘어가기

- 다시 읽기 전에 다음 라운드가 돌면 버튼은 사라져요. 그 라운드는 빚이 있으면 **표시와 상관없이** 해당 요청을 보내요 (테스트 세션 1번).
- 빚 이벤트의 메시지 원문(앞뒤 하나씩 포함)도 입력에 넣어요.
- 넘어온 결과는 **원래 이벤트 id**의 `s.events[id].effects`에 붙여요 (테스트 세션 2번).
  - 그래서 그 이벤트를 빼면(`dropStretch`) 두 라운드에 나뉜 기록이 다 빠져요.
- 복구할 때 같은 id가 두 라운드에 나오면 effects를 합쳐요(`restoreRounds`).

### 4-4. 되돌리기

- `undoRound`는 `u.sync` 스냅샷(`done`, `failed`, `arch`, `events`, `seen`)으로 반영 기록을 되돌려요. **`owed`도 이 스냅샷에 넣어요.**
  - 그러면 다음 라운드를 되돌릴 때 빚 목록도 그 전으로 돌아가요. 넘어왔던 돈은 다시 "빠진 돈"이 되고, 잃지 않아요.
  - 앞 라운드 이벤트의 effects도 스냅샷의 `events`로 돌아가서, 앞 라운드 몫은 그대로 남아요.
- `canUndo`는 안 막혀요. 테스트 세션이 메인 `0f3ad7d`에서 따로 확인했어요.
  - `money.at`은 `makeMoney`, `investment.at`은 `fillInvestment`에서만 바뀌어요.
  - 반영이나 다시 읽기로는 안 바뀌어요.

### 4-5. 실패 표

| 상황 | 결과 |
|---|---|
| core 실패 | 이번 반영 실패. 지금과 같아요. |
| money 요청 실패 | core 내용은 저장. 대상 이벤트를 빚에 넣고 "돈 다시 읽기" 버튼. 다음 라운드가 먼저 돌면 자동으로 같이 해요. |
| 이벤트 하나의 결제를 못 넣음 | 그 이벤트의 돈만 실패(빚). 문자·사진은 남아요. 알림에 이유를 띄워요. |
| life 요청 실패 | core 내용은 저장. 표시된 이벤트(알람·타이머·파일·건강)를 빚에 넣고 "생활 다시 읽기" 버튼. |
| life 실패 중 이벤트 밖 부분 (하루 칸·날씨) | 빚으로 안 남겨요. 건강 하루 칸은 코드(`fillDays`)가 평소 패턴으로 채우고, 날씨는 상태창이 있으면 코드(`applyWeather(p, null, tracker)`)가 덮어써요. 다음 life 요청 때 모델이 새로 써요. |
| 돈은 성공, 생활만 실패 (또는 반대) | 각자 따로. 성공한 쪽은 저장해요. |
| 2단계 답에 1단계에 없는 id | 버리고 알림에 남겨요. |

## 5. 지금 코드 지도 (3.169.89 기준)

- `src/phonedata.js`
  - `updateSystem()` 약 128줄: 반영 지시문. `money/delivery/life/weather/tracker` 플래그로 조각을 붙여요.
  - `PHONE_FACT`, `PHONE_STYLE`, `PHONE_ITEMS` 약 52~83줄: 채우기와 반영이 같이 써요.
    - 반영에선 `PHONE_STYLE.replace('; "now" is the newest moment of the story.', '.')`로 now 중복을 빼요.
  - `updatePhone()` 약 632~816줄. 흐름은 이래요.
    1. `realign` · `settleDropped` · `renumber` · 바뀐 메시지면 `undoRound`
    2. `pickRound`로 이번 범위 고르기, `archiveRound`로 아카이브 증거/배경 나누기
    3. `moneyNow` · `investNow` · `lifeNow`, 상태창 날씨 `trackerWeather`, `askWeather` 조건
    4. 입력 조립 → `askDraft(input, { system: updateSystem(...), maxTokens: 16000, effort: 'low' })`
    5. 채팅·폰·은행·생활이 바뀌었는지 검사
    6. 이벤트마다: at·인용 확인 → `parsePhone` → `applyMoney` (throw하면 그 이벤트 전체 실패) → `applyLife` → `mergePhone` → `tagItems` → `s.events[id]`에 effects 저장
    7. `settleRound`, now 갱신(상태창 시각이 상한), `applyDays` + `fillDays`, `applyWeather`, `lifeClock` · `dlvClock` · `cardClock` (= `roundFx`)
    8. `p.syncUndo`(되돌리기용), `journalAdd`(복구용), `saveMeta`
  - `undoRound` 약 933줄, `dropStretch`(빼기) 약 878줄, `restoreRounds`(복구) 약 823줄, `canUndo` 약 916줄
- `src/phonesync.js`: `syncOf`, `newSync`, `pickRound`, `settleRound`, `journalRead/Write/Add`
- `src/phonesyncmoney.js`: `applyMoney`, `payOrders`, `revertEffects`, `replayEffects`, `moneyNow`, `investNow`
- `src/phonesynclife.js`: `applyLife`, `applyDays`, `fillDays`, `applyWeather`, `lifeClock`, `dlvClock`, `cardClock`, `lifeNow`, `lifeRevert`, `lifeReplay`
- `src/phoneparse.js`: `parseJson`이 모든 모델 답에서 `tidyKo`(겹친 번역 지우기)를 돌려요.

## 6. 작업 순서

1. ~~설계 확정~~ (끝)
2. **지시문 나누기** — 끝 (설계 변경 뒤: `coreSystem`(생활 포함, money 표시)과 `moneySystem`. 아직 `updatePhone`에 연결 안 함. 실측은 맨 위 상자)
   - `coreSystem()`, `moneySystem({ delivery, invest })`, `lifeSystem({ weather, tracker })`
   - 문장은 지금 것을 옮겨요. 새로 쓰는 건 최소로 하고, 3장의 새 문장 두 개(apps 표시, 돈만 오가는 일)만 추가해요.
   - 각 지시문 첫 줄에 `STAGE: core|money|life`
   - 길이 확인: `$S/plen.mjs`처럼 셋 각각 재기
   - 채우기 지시문은 안 건드려요.
3. **`updatePhone` 바꾸기** — 끝 (3.169.90 작업 브랜치 `5aaa382`). `moneyStage()`(돈 단계), `split`(돈 앱 있는 폰만 두 단계), `wants`(core의 money 표시, core 답에 money가 남아 있어도 표시로 봄), `s.owed.money`(빚, `{ id, at, date, time, tries }`, 2번이면 건너뜀), `byEvent()`, 되돌리기 스냅샷·journal·`restoreRounds`에 owed, `retryMoney()`/`canRetryMoney()`(같은 라운드에 붙임), 반영 알림에 넘긴 결제 수. **남은 것: 설정 > 반영 화면의 "결제 다시 읽기" 버튼 줄**(`src/phonesyncui.js`의 되돌리기 버튼 옆, 창 HTML이라 소망 허락·css 세션 알림 후)
   - core 호출 → 이벤트 처리(돈·생활 빼고) → 2단계 조건 계산 → money/life를 `Promise.all`로 동시에
   - 2단계 결과를 이벤트 id별로 `applyMoney`/`applyLife`, `applyDays`/`applyWeather`
   - 빚(`s.owed`), 시도 횟수, 다시 읽기 버튼, 실패 알림
   - `u.sync` 스냅샷에 `owed` 추가, journal 갱신, `restoreRounds`의 같은 id 합치기
   - 2단계 전후에도 채팅·폰 바뀜 검사
4. **테스트·퍼즈·화면** — 끝 (292 통과, 퍼즈 problems 0, 화면 82개. 테스트 가짜 모델은 `STAGE: money`면 `T.moneyAnswers`를, 없으면 core 답의 money를 그 이벤트 id로 돌려줘요)
   - `node --test tests/*.test.mjs`, `node tests/fuzz/reflect.fuzz.mjs`, `node tests/fuzz/fill.fuzz.mjs` (problems 0)
   - 꼭 넣을 테스트
     - 앞 라운드 이벤트의 돈이 다음 라운드에 들어온 뒤 그 이벤트를 빼면 문자와 돈이 다 빠짐
     - 다음 라운드를 되돌리면 그 돈이 다시 빚에 들어감
     - money 표시 없는 다음 라운드라도 빚이 있으면 money 요청이 감
     - money 실패: core 항목은 남고 빚이 생김. 두 번 실패하면 건너뜀
     - life 실패: 하루 칸은 `fillDays`, 날씨는 상태창으로 채워짐
     - 2단계 답의 모르는 id는 버림
     - 돈만 오가는 장면(택시)도 이벤트가 되고 결제가 들어감
   - 퍼즈 하네스(`tests/fuzz/reflect.fuzz.mjs`)가 호출 하나를 가정하면 단계별 가짜 답을 주게 바꿔요.
   - 실리태번 화면 확인: `$S/h/crawl2.mjs rich KR` (VISITS 82)
5. **Vertex 비교 실행**
   - 다른 세션(b8d418f0…)에 보낼 메시지를 소망에게 써 줘요. 키는 그 세션 환경변수에 있어요. 키 값은 절대 출력하지 말고, 키를 붙여 달라고 하지 않아요.
   - 그 세션 규칙: 파일·로그를 지우지 말고, 새 폴더(`log_runN`)만 만들고, 키를 출력하지 않아요. 호출은 최소로 하고, 묻지 않고 다시 돌리지 않아요.
   - run31 본문으로 지금 방식(3.169.89)과 2단계 방식을 한 번씩 돌려요. 타이머·장바구니·주가·관심 종목·적금·일정 이동·삭제 문자가 다 들어 있어서예요.
   - 비교 항목: 호출 수, 단계별 입력·출력 토큰, 시간, 저장값 차이
6. 버전 올리기(`manifest.json` + `src/core.js` `VERSION`), 메인은 허락받고

## 7. 테스트 세션 하네스와 맞출 것

- 요청마다 지시문 첫 줄의 `STAGE: …`로 로그를 `r1-core`, `r1-money`, `r1-life`로 나눠 저장해요.
- replay는 단계 이름으로 답을 찾아요. 지금은 호출 순서 번호(`1-response.txt`)라서, 2단계 두 요청을 동시에 보내면 순서가 섞여요.
- 호출 수와 단계별 입력·출력 토큰, 시간을 나란히 적어요.

## 8. 지켜야 할 것 (이 세션에서 쌓인 규칙)

- 짧고 쉬운 한국어로 답해요. 질문엔 답만 하고, "ㄱㄱ · 넹 · 굿 · 웅 · ㄱ · 메인 ㄱ" 같은 말을 받은 뒤 코드를 바꿔요.
- 메인 올리는 순서
  1. `git fetch origin main`
  2. 메인에 새 커밋이 있으면(css 세션이 올림) 작업 브랜치에 `git merge --no-edit origin/main`, 메인의 버전 줄을 받은 뒤 다음 번호로 올려요.
  3. 테스트
  4. `git push -u origin ccr-7895cb93-30ms96 && git fetch origin main && git checkout main && git reset --hard origin/main && git merge --ff-only ccr-7895cb93-30ms96 && git push origin main && git checkout ccr-7895cb93-30ms96`
- 커밋 제목은 한국어로 쓰고, 모델 이름은 넣지 않아요.
- 소망의 롤플 내용은 레포에 넣지 않아요. 예시 인물은 Mara / Ren / Ivo / Varo를 써요.
- css 세션과의 약속
  - `~/sillytavern/data/default-user/extensions/NarrativeArchive/`에 복사 금지 (캡처 폴더)
  - `style.css`·`css/`나 창 HTML 구조(클래스·요소 배치)는 먼저 말하고 건드려요.
  - `css-cleanup` 브랜치는 건드리지 않아요.
- 모델 필드를 빼기 전에는 모델이 거기 뭘 쓸 수 있는지 먼저 다 따져요(currency 사건). 위험한 건 싫어해요.
- 지시문은 토큰에 민감해요. 늘어나는 토큰은 항상 숫자로 보고해요.
- 그리기 전에 쓰는 도구: scratchpad(`$S=/tmp/claude-0/-home-user-NarrativeArchive/975737c5-a9a7-512f-9518-c3206c8f1a25/scratchpad`) 아래 `plen.mjs`(반영 지시문 길이), `pdump.mjs`(지시문 덤프), `h/crawl2.mjs <variant> <country>`(전 화면 순회), `h/shots2.mjs`, `h/wxshare.mjs`
  - 로컬 실리태번: `cd $S/st && node server.js --port 8000` (백그라운드, 2시간 제한)
  - 세션이 바뀌면 scratchpad가 없을 수 있어요. 그러면 다시 만들어야 해요.
