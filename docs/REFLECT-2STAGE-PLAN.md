# 반영 2단계 나누기: 상세 계획서 (인수인계용)

> ## 폰이 이야기를 읽는 원칙 (3.170.37~, 소망 확정 — 폰 · 채우기 · 반영 코드를 고치기 전에 꼭 지켜요)
>
> **폰은 "어디까지 읽었는지(폰 시계)"를 하나만 가지고, 모든 앱이 그 지점에 맞춰요.**
> 폰 시계 = 반영 기준점과 반영이 읽은 구간 중 가장 먼 메시지(`phoneAt`). 폰 만들기가 처음 정하고, 반영이 앞으로 옮겨요.
>
> | 작업 | 읽는 범위 |
> |---|---|
> | 폰 만들기 (새로) | 아카이브 + 그 뒤 원문을 지금까지. 읽은 마지막 메시지가 폰 시계 |
> | 채우기 (생활 · 배달 · 은행 · 투자 · 스크린타임 · 음성 메모) | 아카이브 + 그 뒤 원문을 **폰 시계까지** |
> | 다시 만들기 (앱 일부, 또는 읽기 기록을 남기는 폰 전체) | 채우기와 같아요. **폰 시계까지** |
> | 반영 | 폰 시계 다음부터 모든 앱을 같이, 설정 순서대로 |
>
> - 메시지 하나는 앱마다 한 번만: 아카이브된 건 섹션 글로, 안 된 건 원문으로. 반영 전에 아카이브돼 숨겨진 구간은 반영이 섹션 글로 읽어요(9장).
> - 원문이 7만 토큰을 넘으면 그 앞에서 멈추고 알려요. 그 앱의 읽음 표시 · 날짜 · 날씨 · 앱 시각 · 은행 기준일은 멈춘 지점 기준(`nowAt`). 나머지는 반영이 읽어요.
> - 반영도 라운드 끝 메시지까지의 상태창만 봐요. 생활이 이미 읽은 구간을 지나는 반영은 날씨를 안 건드려요.
> - 앱마다 읽음 표시(base · money · invest · life · delivery)는 메시지 삭제 · 끼움을 따라 옮겨져요(`syncState`).
> - 예: 아카이브 #1~#80. #150에서 폰 만들기 → 폰 시계 #150. 채팅이 #200이어도 생활 채우기는 #150까지. 반영으로 #200까지 오면 생활 다시 만들기도 #200까지.
> - 폰 시계까지 읽는데 원문이 7만을 넘으면(반영이 지나간 뒤 다시 만들기 · 채우기) **두 턴**이에요(`secondTurn`, 3.170.39~ 생활 · 배달, 3.170.41~ 기본 앱 · 은행). 1턴은 원문 7만으로 앱 전체, 2턴은 이어서 원문 3만으로 **더할 것만**(`… SO FAR` 블록에 1턴 답을 주고 같은 말투로). 그래도 남으면 반영 요약(TOLD SHORT)으로 보내고 "요약만 보고 채웠어요"라고 알려요. 2턴이 실패하면 1턴 것만 남아요. 호출은 최대 2번.
>   - 은행 2턴은 기록(카드 · 거래 · 티켓 · 주문)만 더해요. 계좌 · 잔액은 1턴 그대로고, 2턴 거래는 이미 잔액에 든 걸로 쳐요(`included`).
>   - 새로 만드는 폰은 2턴이 없어요. 못 읽은 건 폰 시계 뒤라 반영 몫이에요.
>   - 투자 2턴(3.170.41~, 소망 확정 2번): 새 거래 · 새 종목 · 지분 · 관심 종목을 더하고, **현금 · 보유도 그 거래만큼 바뀌어요**(시작 현금 · 기준 통화는 1턴 그대로). 평가일은 2턴이 읽은 날로 옮겨요. 현금이 모자라거나 날짜 · 통화가 안 맞으면 2턴 통째로 버리고 1턴만 남아요. 재력 규모 검사는 2턴엔 안 해요.
> - 모든 시각은 주인 폰 시계(주인이 있는 곳) 기준이에요(3.170.41~).
>   - 시차 계산은 코드가 해요: `[OWNER'S CLOCK]` 블록에 주인 도시 · 지금 시각 · 저장 도시마다 몇 시간 앞/뒤(그날 서머타임 반영, `zonesOf`). 다른 시간대 저장 도시가 없으면 블록 없음. 폰 만들기 · 반영 · 생활 · 배달 · 은행 · 음성 메모에 붙어요.
>   - 모델은 상대 화면 메신저 타임스탬프처럼 **다른 도시 사람의 화면 · 장면 시각만** 블록의 시간만큼 바꿔요(`OWN_CLOCK`). 같은 도시면 그대로. 상태창 시각은 손대지 않아요(앱 몫).
>   - 상태창 시각(3.170.43~, 한 곳에서 정해요: `statusMoment` · `sceneZone`):
>     - 장면 시간대(`sceneZone`): 상태창 장소의 장면 부분이 아는 도시 이름(영어 · 한국어 등)과 같거나 그 이름으로 시작하면 그 도시. 단 첫 단어만 맞고 주인과 다른 시간대면("Paris Baguette 강남점") 믿지 않고 모델에게 물어요. 시각 없는 상태창도 같은 판단으로 남의 장면이면 날씨를 안 덮어요(`sceneHome`).
>     - 상태창 시각은 늘 주인 시간으로 바꿔요. 장면을 모르면 반영 답에 `statusCity` 한 칸을 물어요(호출은 그대로 1번). 모델도 모르면 그 상태창 시각은 주인 시각으로 안 써요.
      - 3.170.56~: 다른 도시를 하나도 모르는 폰에서도, 상태창 장소가 주인 장소가 아니면 물어요(그 장면은 모델이 다른 도시라고 할 때까지 주인 것). 답은 OWNER'S CLOCK의 도시 · 사람, `"owner"`, 다른 도시 `{ "city", "tz" }`, 또는 `""`. 묻는 장면은 WEATHER NOW에 장소 · 날씨만 가요.
      - 다른 시간대 도시는 장면 이름 전체가 같을 때만 믿어요("New York Bagels, Gangnam"은 뉴욕이 아님). 주인과 같은 시간대의 다른 도시(서울 주인의 부산)는 시각은 그대로, 날씨는 주인 것이 아니에요(`sceneHome` false).
>     - 반영 폰 시계: 이번 메시지에 상태창이 있으면 그보다 이르게는 안 돼요(올림). 늦은 쪽은 모델 말대로. 새 상태창이 하루 안에서 앞서 간 시계를 되돌려요. 숫자 제한(1시간 등)은 없어요.
>     - 화면 시계(`storyNow`, 지금까지 읽을 때) = 바꾼 상태창 시각과 폰 시계 중 늦은 쪽. 반영 안 눌러도 최신 상태창을 따라가요.
      - 3.170.52~: **되돌리기 뒤에는 다음 반영(또는 복구) 전까지 반영 전 시점에 멈춰요**(`p.clockHold`, `clockHeld`). 날씨 위젯도 같은 기준(디자인 세션 `hereOwn`).
>     - 모델에겐 OWNER'S CLOCK에 "The newest status line, 10-26 12:50 in Seoul, is 10-26 04:50 here."를 주고, 남의 장면이면 WEATHER NOW에서 날짜 · 시각을 빼요.
>   - 누가 어디 있는지(3.170.43~): **위치 판독 요청**(`AI_SYS_WHERE`, `readWhere`)이 캐릭터 카드 전체(설명 · 성격 · 상황 · 첫 메시지 · 예시 대화, 원문 그대로) · 페르소나 · (로어북일 때만) 폰 주인 프로필 · 아카이브 현재 상태 · 최근 메시지 8개 · 주인이 모르는 것으로, 주인과 폰 속 사람마다 지금 도시(영어 + 그 도시의 이름들 `names`: 채팅 · 상태창에 실제로 쓰인 이름은 무조건, 그리고 영어 · 한국어 이름) · 사는 나라 · 시간대를 읽어 `p.where`에 둬요. 주인이 위치를 모르는 사람은 빼요.
>     - 부르는 때: 폰 만들기 끝, 판독 없는 폰의 첫 반영(그리고 `names` · `local` 둘 다 없는 옛 판독은 한 번 더). 실패하면 `failed`로 남기고 다시 안 불러요. 다시 읽을 때 빠진 사람은 전 것을 지켜요. 폰 다시 만들기 · 되돌리기에도 따라가요.
>     - 주인이 이동하면 반영 답의 `ownerCity`(호출 그대로)로 주인 줄을 바로 고쳐요. "도시가 바뀌면 판독 다시 부르기"는 없어요.
    - 3.170.56~: 주인 말고 다른 사람이 다른 도시로 가면(여행 · 이사) 반영 답의 `elsewhere` `[{ name, city, names, tz }]`로 그 사람 줄을 고쳐요(사는 나라는 그대로, 새 사람이면 비어 있음). `elsewhere`를 `statusCity`보다 먼저 읽어서, statusCity가 그 사람 이름이어도 그 도시로 알아봐요.
    - 원문을 읽는 반영의 시각 검증: CLOCK FIRST와 ANSWER 모두 `clock.finalViewpoint`, `clock.elapsedTime`(계산에 사용한 명시적 경과 시간 문자열, 없으면 null), `clock.sceneTime`(경과 시간을 이미 포함한 변환 전 현재 시각), `now`(주인 현지 시각)를 사용해요. 경과 시간은 진단에 보존하며 코드에서 다시 더하지 않아요. 구형/누락된 clock과 검증 가능한 시차 불일치는 앱 적용 전에 오류로 돌려줘요. 모르는 위치·연도나 서머타임 중복 시각으로는 변환을 추측해 검사하지 않아요.
    - 아카이브만 반영(이번 회차 원문 0개): 3.171.16의 지시문·OWNER'S CLOCK 형식으로 보내요. CLOCK FIRST, `clock` 출력/검증, 시간 후보, 시간 판독 토스트는 없고 `now` 갱신은 유지해요. 일상은 요청하지 않아요. 원문이 함께 있으면 최신 클락 지시문을 쓰며, 시간 후보는 원문에서만 뽑아요. 확장 아카이브 생성·압축 지시문과는 별개예요.
    - 상태창 보정·역행 방지는 실제 폰을 바꾸지 않는 사본에서 먼저 계산해요. 그 적용 시각을 일상 요청의 종료 시각과 최종 폰 저장에 함께 쓰고, 사건에 명시된 시각은 그대로 유지해요. 모델 원본 시각과 적용 시각이 다르면 시간 판독 토스트에 `appliedNow`도 표시해요. 일상 요청 중 대화가 바뀌면 사본의 시각·위치는 저장하지 않아요.
    - 3.180~ 줄임: 본체 지시문을 약 5,000토큰에서 약 3,400토큰으로(칸: GOAL · YOU GET · CLOCK FIRST(그대로) + 시각 세 줄 · THE STORY · THE OWNER'S LIFE · THE APPS · IN THEIR OWN WORDS · HEALTH · SCREEN TIME · WEATHER · KEEPING IN STEP · LANGUAGE · JSON). 같은 말 여러 칸에 하던 걸 한 번으로, JSON은 칸은 그대로 두고 뻔한 설명만 지움. 입력도 줄임: ARCHIVE BEFORE는 바로 앞 구간 하나(5,000자까지, 전엔 30,000자), LOREBOOK 안 보냄(사람은 PEOPLE AROUND가 맡음), EVENTS ON THE PHONE은 최근 15개(전엔 40).
    - 3.180~ 시안 5: 칸 넷을 더했어요. ONE DAY ON EVERY APP(모든 앱이 같은 하루: 새벽 문자 → 늦은 late · 짧은 잠, 자는 동안엔 폰 기록 없음), THE APPS(앱마다 진짜 폰에서 생기는 모양, 예시는 "for instance"), IN THEIR OWN WORDS(메모 · 일기 · 음성 메모는 요약 말고 자기 말로 다 씀. 음성 메모 줄은 AI_SYS_VOICES에서), 생활 앱 폰은 HEALTH · SCREEN TIME(AI_SYS_LIFE · AI_SYS_SCREEN에서: 숫자가 그날을 따름, 잠은 일어난 날, 인정 안 할 습관, 다른 앱과 맞음, 숫자만).
      - 이야기 먼저: READING THE STORY 맨 앞에 "장면과 그 흔적을 생활 기록보다 먼저, 생활 기록은 이야기 기록을 대신하지 않음", "메시지에서 일어난 일은 모두 scene, 폰에 남을 장면은 그 기록까지". 답 아래 "records는 장면 · 이야기 기록 먼저, 그다음 생활".
      - 확인용: `p.syncLast.records = { scenes, story, life }`(records 답일 때, `recordCount`). 이야기가 생활에 밀리는지 시험에서 바로 세요.
    - 3.180~ 생활 기록 하루 제한 고침: (1) 이 메시지의 장면에 반응하는 생활 기록은 `scene`에 그 장면 id(일기는 나중에 제한을 모두 없앰: "이야기 날이 끝나거나 마음에 남는 장면이 있을 때 한 편". 지시문 THE OWNER'S LIFE 한 줄, +약 17토큰). `recordsCore`가 그 장면 사건에 붙이고 `onScene` 표시, `everydayOnly`는 하루 제한을 안 세요(문자는 한 묶음 8줄만, 하루 두 묶음은 안 셈). 표시는 그 회차에서 지워요. (2) 평범한 생활 기록은 now의 날이면 지난 시간만큼만(`capSoFar`: 07:00~23:00 중 지난 몫, 최소 1, 문자는 최소 8줄). 지난날은 하루 몫 그대로. 아침 회차가 하루 몫을 다 써서 저녁 큰 장면이 손해 보던 것.
    - 3.180~ 생활은 다시 앱마다 칸(옛 에브리데이 모양): run73에서 생활 기록이 일기 · 건강뿐(평범한 생활 0)이라. 답에 `"everyday": { "texts", "calls", "photos", "searches", "notes", "mails", "posts", "calendar", "diary", "voice", "contacts"(, "alarms", "timers", "files") }`, 항목은 records 모양에서 type · at 뺀 것, 장면에 반응하면 "scene". records는 장면 · 이야기 기록 · health · usual만(`from` 칸 없어짐). THE OWNER'S LIFE 둘째 줄은 옛 에브리데이 몸통("any app, a little in each as a real phone gets it"). `recordsCore`가 everyday 칸을 생활 기록(from life)으로 읽어요(옛 records 답의 from "life"도 그대로 읽음). `recordCount`도 everyday를 세요. 약 +50토큰. run74 뒤: everyday 항목 칸을 따로 적음("time" · 일기 "date" · "scene"), 시각 없이 온 건 빼고 `syncLast.records.untimed`에 셈(코드가 시각을 지어내지 않음; 일기 · 일정은 date, 연락처 · 알람 · 타이머 · 파일은 시각 없어도 됨), "everyday는 이야기가 따라가는 일 밖의 삶, 이야기 일은 records에 메시지가 보여준 만큼만" 한 줄(+약 45토큰).
    - 3.180~ 채우기처럼: THE STORY 앞에 ONE TEST FOR EVERY ITEM 칸(채우기 PHONE_FACT를 반영 입력에 맞게: messages and archive, 사건 예시에 "how something turned out or will go"). "First tell apart … NEVER …" 줄은 뺌. JSON의 time은 공통 줄이 아니라 타입별 줄마다(채우기 PHONE_ITEMS처럼), everyday는 "each item with its fields as above".
    - run75 뒤: 옛 최종 에브리데이(3.179.1)의 새 사실 줄을 글자 그대로 THE OWNER'S LIFE에 되돌림("Anything a later message could contradict is a new fact: … a task and its deadline, a thing done, a plan for later … No new facts, events, plans or secrets."). "everyday는 이야기가 따라가는 일 밖의 삶" 줄은 뺌(run75에서 안 먹힘).
    - 양도 옛 최종대로: 몸통 줄("it fills most lists as these hours call for, for example …"), 장면 사람과 문자 줄("at least one text between the two later these hours"), JSON everyday는 앱마다 항목 칸이 보이게(빈 [] 대신). 약 +150토큰.
    - run76 뒤: ONE TEST 칸을 빼고 CLOCK FIRST 바로 아래에 THE STORY IS CANON 칸("The story is canon. Never get ahead of anything tied to its events. Make up no future the story hasn't stated; what it has stated, only as far as it states. No exceptions. A made-up future belongs only to everyday life outside the story."). 폰 만들기의 ONE TEST는 그대로.
    - 본체 입력에 `[ORDERS AND TICKETS]`(`ordersBlock`): 돈 단계의 MONEY NOW 중 주문(가게 · 상품 · 옵션 · 선물 · 보낸 사람 · 상태 · 시각 · 도착 예정 eta)과 티켓(종류 · 곳 · 출발/도착 · 번호 · 날짜 · until · 상태)만, 돈 없이. 메일 · 문자 · 일정이 폰의 주문 · 예약과 맞게(run76: 러그 이름, 스카프 배송일, 체크아웃 날짜가 어긋남). YOU GET 한 줄(+약 25토큰), 입력은 주문 · 티켓 수만큼.
    - run79b 뒤: `atNum`은 빈 값을 0번 메시지로 읽지 않음(방문 셋이 다 scene-0에 붙던 것). at 없는 기록을 코드가 시각으로 장면에 붙이는 건 넣었다가 뺌(코드가 짐작하지 않음). 대신 JSON 공통 줄 "at": its message number (every record has one). 진짜 원인은 읽기 버그 둘: 장면 레코드가 이름을 "id" 대신 "scene" 칸에 씀(코드가 scene-<at>을 만들어 방문의 "scene"이 안 맞음) → 장면은 id 없으면 scene 칸을 이름으로. "with": "Ren"처럼 문자열 하나 → 그 이름 하나로(방문 with, 단톡 members).
    - run80(effort medium) 뒤: 생각을 켜도 앞서가기 그대로(다음 단계를 이어 씀: 은행 가기 · 서류 떼기 · 통화 · 끝나는 날). CANON 칸을 STORY NEXT로 바꿈: CLOCK FIRST처럼 단계(일 꼽기 → 메시지가 말한 마지막 것 → 기록은 거기서 멈춤) + WARNING(자연스러운 다음 단계 ≠ 말해진 것) + 답의 "story": [{ matter, stands, at }](now 다음, records 앞). 코드는 "story"를 판단에 안 쓰고 `syncLast.story`에만 남김. effort는 low 그대로.
    - run81 뒤(모델이 "story"는 맞게 적고 기록에서 넘음): STORY NEXT 4단계 — 일에 대한 기록은 "matter"(그 일) · "said"(기대는 메시지 원문 몇 마디, 그대로). 코드는 said가 이번 메시지 · 아카이브(이번 구간 · 바로 앞)에 있는지만 `quoted`로 봄. 없으면 저장 안 하고 `syncLast.unsaid`에 남김(종류 · 일 · 내용 앞 60자 · said). matter가 빈 기록은 검사 없음. 두 칸은 저장 안 함.
    - 줄이기(약 3,970 → 3,450토큰): JSON 앱 칸을 ITEMS 한 곳으로(records는 "and the fields of its type in ITEMS", everyday는 "each a list of ITEMS of that type"; 칸 이름 · time은 ITEMS 줄마다), YOU GET · STORY NEXT(4단계를 3단계에 합침) · THE OWNER'S LIFE(하루 개수 줄 뺌) · THE APPS · SCREEN TIME 압축.
    - "story" 목록 · "matter" 칸 뺌(효과 없음). 대신 이야기 기록마다 "said"(기대는 메시지 원문 몇 마디) · "made"(지어낸 것: 시각 · 말투 · 이름 …). STORY NEXT 3단계가 이걸 말함. 코드: said가 있으면 원문에 있는지 봄(없으면 저장 안 하고 `syncLast.unsaid`), said 없는 이야기 기록은 검사 없이 두고 `syncLast.records.nosaid`에 셈. everyday는 이야기에 대한 것일 때만 said · made. made는 저장 안 함(모델 답에서 봄).
    - run82 뒤: 근거 확인 · 빼기 코드를 없앰(소망: 코드로 잡지 말고 지시문으로). STORY NEXT 3단계: "A record tied to the story is written only when words of one message back it: copy them exactly in "said" … No words to back it: don't write it." said · made는 저장 안 함, said 없는 이야기 기록 수만 `nosaid`로 셈.
    - run83 뒤(records는 said가 다 원문에 있고 앞서간 것 1개, 지어낸 건 everyday에서): 장면 사람 문자는 "as a story record in "records" (with its "said")", everyday는 "outside the story"(몸통 줄 · JSON), everyday의 said · made 말은 뺌. 일기는 everyday 그대로.
    - run84 뒤(아스트라 안): STORY NEXT를 빼고 STORY AND PERSONAL LIFE(무엇에 관한 기록인지로 나눔: 이야기 사건에 관한 건 앱 상관없이 records, everyday는 기분 · 리듬만 이어받고 이야기 사건을 전하거나 끝내거나 잇지 않음) + STORY RECORDS(있는 사실 둘레만 채움, 안 끝난 일은 안 끝난 채로, 폰 데이터의 예정일은 일어난 근거가 아님, said는 출처). THE OWNER'S LIFE → EVERYDAY(하루씩 완성, 하루 11개쯤 시간만큼, 앱은 습관 · 그날 사정대로, 칸 채우려고 쓰지 않기). everyday 답은 날짜 묶음 [{ date, records: [{ type, … }] }](`edLists`가 앱별 목록으로 읽음, 옛 앱별 모양도 읽음). core의 made · "outside the story" · "everyday never replaces" 뺌.
    - run85 뒤(생활은 늘었는데 건너뛴 날에 이야기 일을 연쇄로 진행시킴: 문의 → 발송 → 해결, 스카프 도착): 아스트라 안 한 묶음. 순서를 everyday → records로(지시문 칸 EVERYDAY → THE STORY → STORY RECORDS, JSON everyday가 records 앞). EVERYDAY는 주인이 누구인지(PHONE NOW의 평소 폰 생활 · PEOPLE AROUND · OWNER PROFILE · LIFE NOW의 usual)에서 시작, 이야기 진행 중인 일은 소재가 아님, 하루는 다음 장이 아님. STORY RECORDS: 원문으로 돌아가기, said와 어긋나지 않기, 상황을 표현하되 완성하지 않기, 생성한 everyday는 사건의 근거가 아님. 약 3,530토큰.
    - run86 · run87(연쇄 0 · 스카프 도착 0이 두 번 꾸준) 뒤: 일기 · 음성 · 통화 0이라 EVERYDAY 개수 줄에 앱 예시를 되돌림, 일기 줄 끝에 "The diary is the owner's day: it goes in "everyday" on its day, and the story comes into it only as the messages tell it and as feelings."(일기가 records/everyday 사이에 끼어 안 쓰이던 것).
    - run88 뒤(일기 · 음성이 생겼는데 그 일기 줄의 "the story comes into it only as the messages tell it"을 허락으로 읽어 everyday에 신탁 · 보일러 · 스카프 도착이 들어감): 그 구절을 빼고, STORY AND PERSONAL LIFE 셋째 줄을 "A story matter comes into it only as a feeling. Never make up its next step, an arrival, a completion, a new fact, a secret or how it came about, building a new storyline the story's canon never told."로.
    - run89 뒤(아스트라: 소재로 나누는 방향 철회, 기록이 하는 일로): STORY AND PERSONAL LIFE를 WHAT A RECORD DOES로 — 이야기의 상황 · 사람 · 분위기는 모든 앱의 재료, 지금 상황을 표현하고 겪는 건 됨, 메시지가 정한 전개는 쓰되 폰 기록으로 새 전개(결정 · 약속 · 해결 단계 · 결과)는 발명하지 않음, 표현은 완성하되 상황은 다음 단계로 안 옮김(모든 앱), said로 한 메시지에 묶인 흔적은 records · 나머지 하루는 everyday · 중복 없음. EVERYDAY의 "ongoing matters are not subjects"와 STORY RECORDS의 "Complete how …" 줄은 뺌.
    - run90 뒤(됨 기록이 풍성해짐, 안 됨은 eta 날 스카프 도착 · 서류 일의 다음 단계, 이야기 기록 4개 · 방문 0): 예정일 줄을 WHAT A RECORD DOES로 옮김(everyday에도 걸리게), 해결 단계 예시 "(going somewhere about it, papers gathered or sent, a call or a reply about it)", THE STORY 첫 줄 "its trail in "records": where it happened (a "visit") and what the phone kept from it", 장면 사람 문자 줄의 "in "records"" 뺌. run91 뒤: 결과 예시 "(a parcel arriving, works finished, an answer received)" 붙임(eta 날 스카프 도착이 계속돼서, "됨" 예시의 기다리는 택배와 짝).
    - SCENES NEXT(장면 추출을 생활 생성 앞으로, CLOCK FIRST와 안 겹치게 NEXT): 답 순서 clock → now → moved → scenes → everyday → records → health → usual → weather. 장면은 records가 아니라 맨 위 "scenes"(id · at · quote · date · time · summary · place · city · with = 그 자리에 실제로 같이 있는 사람). THE STORY 첫 줄은 "Write each scene's phone trail in "records", linked by its "scene" id …". records의 scene 타입 · ITEMS의 scene 줄 · visit의 with는 뺌. 코드: `recordsCore`가 scenes를 장면 기록으로 읽고, 새 모양에서 visit.with는 연결된 scene.with를 그대로 씀(코드가 원문을 보고 판단하지 않음). 옛 모양(records 안의 scene, visit 자체의 with)도 읽음.
    - 다시 짬(약 3,870 → 3,140토큰): GOAL을 "Show how the owner lives through the story on their phone. Preserve what the story establishes, including what remains unresolved or unknown. Create the phone activity, wording and personal detail around that situation; do not supply what happens next to it."로. 흩어진 경계 칸(SCENES NEXT · WHAT A RECORD DOES · THE STORY · STORY RECORDS)을 SCENES AND RECORDS 하나로, EVERYDAY · THE APPS · IN THEIR OWN WORDS · HEALTH · SCREEN TIME도 짧은 새 글로. CLOCK FIRST · YOU GET · WEATHER · KEEPING IN STEP · LANGUAGE · JSON · ITEMS는 그대로(끝 줄만 "scenes" first, then "everyday" and "records").
    - CLOCK FIRST 바로 뒤에 DO NOT CONTINUE THE STORY 칸(소망 글: 너는 롤플 작가가 아니다, 이야기 사건을 진행 · 해결 · 완성하지 않기, 원인 · 숨은 사실 · 전말 지어내지 않기, 짝 예시 셋 — 택배 오는 중 → 도착, 막힌 일 → 해결 시도, 사건 → 말 안 한 이유 · 비밀 · 설명, 됨: 정해진 상황 안의 말 · 마음 · 반응 · 일상). SCENES AND RECORDS의 "Tell apart …" 묶음은 뺌(같은 말).
    - SCENES AND RECORDS를 네 줄로 줄임: "scenes"(동석자), "records"(흔적, 분명히 내비친 것까지, 근거보다 더 말하지 않기, 나머지 하루는 everyday, 중복 없음), 폰 데이터와 everyday는 이야기 사실 아님 · 예정일은 아직, 캘린더(계획은 계획, 옮김 · 취소 · 무름은 was · cancelled, 티켓은 지갑).
    - run95 뒤: DO NOT CONTINUE THE STORY 본문을 소망의 원래 글(순화 전)로: "You are NOT a role-play writer. Your problem is that you constantly try to get ahead of the story …", 예시마다 "acting as the author", 끝에 "You may create … You may not change that situation …".
    - run96(97) 뒤: 기록마다 "advances"(모델 자신의 판정: 이야기 상황을 제멋대로 진행시켰나 — 단계 · 도착 · 이유 · 결과). true면 저장 안 하고 `syncLast.advanced`(종류 · 칸 · 내용)와 `syncLast.records.advanced`에 셈. 코드는 모델 답만 따르고 판단하지 않음. 칸은 저장 안 함.
    - 같은 때: SCENES AND RECORDS를 줄임. records 줄은 연결 규칙만("scene" · "said", everyday와 겹치지 않기), "Phone data and everyday are not story facts…" 줄은 뺌(돌려도 도움 안 됨). 약 -40토큰.
    - run98 뒤(advances 28개 모두 false, 스카프 eta 날 도착): CLOCK FIRST · CORE_TIMES만 두고 지시문을 통째로 새로 씀. STEP 1 SCENES → STEP 2 SITUATIONS(끝나지 않은 일마다 state · known · open, 상태별로 써도 되는 것 / 안 되는 것, open은 아무도 채우지 않음) → STEP 3 RECORDS(경우 5개만) → STEP 4 EVERYDAY(시간 · 양 · 재료 순서, 장면 사람 문자는 강제 아님) → STEP 5 EACH APP. 답 순서는 scenes → situations → records → everyday. "advances"는 더 묻지 않음(코드는 옛 답을 그대로 읽음). "situations"와 기록의 "situation"은 저장하지 않음. 이름은 폰의 문자 "threads"와 겹치지 않게 situations. 약 +140토큰(≈3,490).
    - run99 뒤(지어내기 거의 0, 장면 문자 · 검색은 아직 everyday): records와 everyday를 한 칸으로 합침. "records": [{ date, records: [...] }], 장면 기록은 "scene" · "at" · "said", 주인 생활은 "scene": "". 코드(`splitDays`)는 scene이나 said가 있으면(visit · profile은 늘) 이야기 기록, 없으면 생활로 읽음(판단 없이 칸만). 옛 평평한 records와 everyday도 그대로 읽음. STEP 3 RECORDS + STEP 4 EACH APP. situations의 eta는 "주문의 예정일, 아니면 """(run99 보일러 eta 11-08). 약 -60토큰(≈3,435).
    - 같은 때: 하루 앱 줄에서 "texts with 3 or more people"을 뺌(아싸도 인싸가 됨). 누구와 얼마나 연락하는지는 성격과 PEOPLE AROUND를 따름. 메일 발신인 예시 넷을 빼고 "삶 · 계정 · 취미 · 습관 때문에 실제로 올 것이면 무엇이든"으로.
    - run100 뒤(생활 25 → 16, 앱 8 → 6, 지어낸 3개는 모두 situation 칸이 빔): 합치기를 되돌려 다시 records(장면 흔적) · everyday(날짜별 생활)로 나눔(합쳐서 아끼던 건 약 40토큰). 오늘 고친 앱 줄 · 메일 줄 · eta는 그대로. 기록의 situation은 여러 개: "situations": [ids]. EVERYDAY 7번에 "모든 기록은 언급하거나 건드리는 situation을 다 적고 그 상태를 지킴". 코드의 splitDays(날짜별 records)는 그대로 남겨 둠(옛 답도 읽음).
    - 같은 때: GOAL을 두 문장으로(단계 나열은 STEP 제목이 보여 줌), EVERYDAY 3-b "situations: only what STEP 2 allows"를 뺌(7번과 같은 말). 약 −50토큰(≈3,504).
    - 같은 때: 생활 하루 약 15개(LIFE_A_DAY 11 → 15), 온전한 하루 앱 8가지 이상(생활 앱 없는 폰은 6가지: 목록이 8개라 게시물까지 강제되지 않게). 앱별 하루 상한(EVERYDAY_CAP)은 그대로 넉넉함.
    - run101 뒤(호텔 위치 "여의도" · "9호선"을 지어냄): situations의 "open" 목록에 places를 넣음(이야기가 안 준 장소도 아무도 채우지 않음).
    - 같은 때: situations에 "where" · "when" 칸(이야기가 준 장소 · 날짜, 주문 예정일 포함, 아니면 ""). ""로 남은 칸은 폰 어디서도 채우지 않음. "eta" 칸은 when으로 합쳐 뺌(저장 안 하는 칸). 약 +35토큰(≈3,540).
    - 실제 채팅 반영 뒤(3.182.0): 사진 · 메모 · 음성에 한국어가 안 붙음(LANGUAGE가 "a text"라고만 해서 문자로 읽음) → 칸마다 짝(ko · kt · ks · pko)을 적음. 이야기가 이미 보여 준 문자 대화를 통째로 옮김 → 마지막 4개만.
    - 같은 때: "Texts short"를 빼고 "그 사람이 실제로 쓰는 길이로"(단답형도 장문형도 성격대로).
    - 실제 채팅 50개 반영에서도 한국어 칸을 거의 안 씀(출력 1만 토큰에 지침). core에서 한국어 칸(ko · kt · ks · pko)을 다 빼고 "No Korean translations: the app adds them." 반영(core + money)이 끝나면 `fillKo`(src/phonetr.js)가 한국어가 아니고 짝 칸이 빈 것(`koGaps`)만 번역기(translateLines, 캐시)로 한 번에 채움. 여러 줄 칸은 줄 단위로. 실패하면 보고에 "번역 못 함 · 다시 하기"(syncLast.trFailed), "가 한국어"를 눌러도 빈 것부터 채움. 채운 뒤 syncUndo.after를 다시 떠서 되돌리기가 그대로 됨. 지시문 약 −70토큰(≈3,520).
    - 번역 말투가 제각각(엄마한테 반말하던 애가 존댓말): fillKo가 아카이브 줄 번역기 대신 폰 전용 지시문 `AI_SYS_PHONE_KO`(src/phonetr.js)를 씀. 받는 것: [OWNER], [VOICES](폰의 말투표 p.koVoice, "A → B: style"), [EXAMPLES](같은 대화방에 이미 있는 한국어, 최근 4줄씩), [GLOSSARY], [LINES](줄마다 "[앱 · 화자 → 상대]", self는 주인 혼잣말). 답 { voices, lines }. 번역기가 새로 정한 쌍은 말투표에 더하고(by: model), 이미 있는 쌍(소망이 고친 것 포함)은 그대로. 말투표 편집 화면은 디자인 세션 몫.
    - 같은 때: 말투 고정 규칙(혼잣말 반말 · 서비스 존댓말 등)과 쌍(화자 → 상대)별 말투를 뺌. 목표는 "모든 번역이 한 사람이 쓴 것처럼, 사람마다 어디서나 같은 목소리". 말투표는 사람별 { who, style }(옛 { from, to }는 from을 사람으로 읽음).
    - 같은 때: "가 한국어"를 꾹 누르면(0.6초) 지금 보는 앱의 한국어를 지우고 전부 다시 번역(`redoKo`, `koAppOf(view)`로 앱을 고름, 홈 등 앱이 아닌 화면은 폰 전체). 실패하거나 빠진 줄은 원래 한국어로 되돌림. 짧게 누르기는 그대로.
    - 같은 때: [EXAMPLES](대화방에 이미 있는 한국어)를 뺌. 예전 반영이 들쭉날쭉하게 쓴 한국어를 따라 하게 됐음. 일관성은 말투표(VOICES)로만.
    - 일기가 "~함" 말투로 번역됨(메모 글투가 "어디서나 같은 목소리" · 말투표로 일기까지 번짐). 말투표는 남에게 하는 말(문자 · 댓글 · 메일 · 게시물)만, 혼자 쓰는 글(self)은 원문의 결대로. 번역기가 전에 정한 말투표 줄(by: model)은 한 번 비움(p.koVoiceV = 2), 소망이 쓴 줄은 그대로.
    - 말투표에 GitHub · Lufthansa · 회사가 들어가고, Oscar 말투가 "캘린더 일정에 맞춘 간결한 명사형"(묶음에 캘린더만 있던 때 정함). 말투표는 문자 · 댓글만: 그 요청에 그 사람의 문자 · 댓글이 있을 때만 받음(코드가 거름). 메일 · 게시물 · 캘린더 · 메모는 원문의 결대로. 번역기가 정한 옛 줄은 한 번 더 비움(koVoiceV = 3).
    - 같은 때: 번역 요청에 [PEOPLE AROUND](aroundBlock)를 같이 보냄. 말투표가 없는 사람은 원문과 관계로 정함(짐작이라 확실한 건 소망이 쓴 말투표).
    - 같은 때: 말투는 번역기가 곁다리로 정하지 않고 이야기에서 따로 뽑음(`learnVoices`, 지시문 `AI_SYS_PHONE_VOICE`, sideRequest로 ARCHIVE · RECENT CHAT 등 + [PEOPLE AROUND] + [WHO]). 번역 직전, 문자 · 댓글을 쓴 사람 중 말투표에 없는 사람만. 답 { people: [{ who, style, evidence: [이야기 원문] }] }, 근거가 없으면 안 넣고 다시 안 물음(koVoiceAsked). 줄을 지우면 다음에 다시 뽑음. 번역 지시문의 "voices" 답은 뺌. 버튼 없음.
    - 같은 때: 말투 뽑기에 캐릭터 카드 · 페르소나를 통째로(cardBlocks: description · personality · scenario · first_mes · mes_example). 근거는 이야기나 카드의 원문.
    - 같은 때: OWNER PROFILE은 소망이 고른 게 로어북 항목일 때만 같이(카드 · 페르소나를 골랐으면 이미 통째로 들어가 겹침).
    - 같은 때: 말투 뽑기에서 PEOPLE AROUND를 뺌(원문을 통째로 보내니 요약은 겹침). LOREBOOK(카드 없는 주변 인물)과 WHO는 남김. 번역 요청의 PEOPLE AROUND는 그대로.
    - 같은 때: OWNER PROFILE로 고른 로어북 항목은 [LOREBOOK]에서 자동으로 뺌(loreFor의 skip, sideRequest를 쓰는 모든 채우기에 해당).
    - 같은 때(소망 결정): 소망이 지운 말투 줄은 다시 뽑지 않음. `dropVoice(p, i)`가 줄을 지우고 이름을 koVoiceAsked에 넣음. 다시 넣으려면 "사람 추가". 말투 화면의 지우기는 디자인 세션이 dropVoice를 부르게.
    - 같은 때: 뽑기 `pickVoices(m, owner, p, names)`: 소망이 고른 사람을 이야기에서 바로 뽑음(지운 사람 · 직접 쓴 사람도). 찾으면 그 사람 줄을 바꾸고 not-asked에서 뺌, 못 찾으면 있던 줄 그대로. 돌려주는 값 { found, missing }. 버튼은 디자인 세션.
    - 같은 때: 뽑은 말투에 목록용 짧은 이름표 `label`("격식 존댓말 · 단호함" 식, 20자까지, 넘으면 버림)을 같이 받음. 번역 요청엔 안 넣음. style 자르기는 120 → 300자(문장 중간에 잘려서). 지시문에 길이 안내는 안 넣음(소망: 뽑은 문장 길이는 그대로).
    - 같은 때: 직접 쓴 말투 줄의 이름표 `labelVoices([{ who, style }])` → [label 또는 ""]. 번역 · 뽑기와 상관없는 따로 짧은 요청(지시문 `AI_SYS_VOICE_LABEL`, 받는 것 [NOTES]뿐, 이야기 · 카드 안 읽음). 20자 넘으면 "". 화면 연결은 디자인 세션.
    - 실제 반영에서 이미 있는 체크리스트 메모를 거의 그대로 또 씀: 통째로 새로 쓸 때 KEEPING IN STEP의 "PHONE NOW에 있는 건 무엇이든 다시 쓰지 않음"이 빠졌음(문자 · 알람 · 파일 · 장면만 남음). 되살리고 메모 · 메일 · 검색 · 사진 · 일기 · 게시물은 "새로운 내용일 때만 새로", 몇 마디만 바꾼 거의 같은 것도 안 됨(예: 메모 · 목록 · 메일 · 메시지).
    - 폰을 통째로 다시 만들면 말투표가 사라졌음 → koVoice · koVoiceAsked · koVoiceV도 옛 폰에서 넘김. 되돌리기 · 대화 빼기는 원래 말투표를 안 건드림.
    - 날씨 한 줄 "Clear and cold early morning in Westend"의 한국어가 "대체로 맑음": core JSON의 날씨 칸에 설명 없는 "ko"가 남아서 모델이 날씨 이름을 씀(LANGUAGE의 ko 설명은 앞서 뺐음). core에서 날씨 "ko"를 빼고, 날씨 한 줄도 fillKo(koGaps, app "weather")가 옮김.
    - 같은 때 전부 대조: core가 아직 묻던 한국어 칸은 usual의 coffeeKo 하나 → 뺌. 화면이 한국어를 보여 주는데 번역기 대상에 없던 곳: 파일 폴더 이름(life.files.folders name → ko), 커피 종류(usual coffeeKind → coffeeKo) → koGaps에 넣음. money · 배달 · 웹 페이지는 각자 요청이 한국어를 직접 써서 그대로.
    - 통째로 새로 쓰기 전 지시문(5aaad62)과 규칙을 하나씩 대조해서 빠진 것을 되살림:
      · YOU GET의 OWNER DOESN'T KNOW "(never on the phone as known)" (PROMPT-RULES 4번 규칙)
      · ORDERS AND TICKETS "a record about one keeps its item, dates and status"
      · 음성 메모 "in the archive and chat" (메모 · 음성의 "full personal content"는 되살렸다가 뺌: 다른 줄이 받쳐 줌, 소망 결정)
      · (일기 "안 보인 날은 삶에서"도 되살렸다가 뺌: STEP 4 · situations가 받쳐 줌, 소망 결정)
      · EVERYDAY 1번 "Late texts agree with screen time and sleep / a late night"
      · 복구로 돌아온 회차도 번역(koRun)
      일부러 뺀 것(소망 결정)은 그대로: DO NOT CONTINUE, "plainly implies", "not story facts", 장면 사람 문자 강제, 3명 이상, Texts short, 한국어 칸, advances. 약 3,640토큰.
    - 다시 번역을 셋으로 나눔(앱 전체 다시 번역은 입력이 계속 늘고 마음에 든 번역까지 지워서):
      · 화면 하나("가 한국어" 꾹): koScopeOf(p, view) — 대화방 하나 · 메모 · 일기 · 메일 · 일정 · 사진 · 게시물 · 음성 한 개, 검색 결과 하나(열어 본 페이지 빼고), 페이지 하나, 파일 · 폴더 · 알람 하나. 목록 화면은 그 앱의 최근 40줄만(koAppOf). 옮길 게 없으면 "이 화면엔 다시 번역할 게 없어요".
      · 이번 반영(보고의 "이번 반영 다시 번역"): roundScope = 되돌리기가 아는 그 회차의 새 기록(syncUndo items · msgs · push effects).
      · 폰 전체(설정에서 꾹): "폰 전체를 다시 번역할까요?" 확인 뒤.
      redoKo(p, pick, { max, newest })는 이제 줄 고르기(pick)를 받음.
    - 꾹 누르기 화면 대조: 한국어 버튼이 있는 화면을 전부 뽑아 맞춤(koAppOf). 날씨 도시 목록(wlist) → 날씨 한 줄, 웹(search · page · marks · tabs · history) → 검색어와 웹 전부(바로 답, 결과 제목 · 요약, 함께 찾은 질문, 열어 본 페이지의 제목 · 첫 단락 · 본문 · 인용 · 알림 · 댓글 · 섹션), 건강(health · hcmp) → 커피 종류, 배달 → 배달(가게 · 메뉴 · 주문 · 장바구니 이름, 옵션, 요청사항: 배달 채우기가 빠뜨린 것도 번역기가 채움, 배달 화면 한국어 버튼도 번역 전에 보임), 옮길 게 없는 화면은 "이 화면엔 다시 옮길 한국어가 없어요". 은행(거래 상대) · 쇼핑(주문 상품) · 투자(종목 이름 · 관심 메모)도 대상(각자 요청이 쓴 한국어가 빠졌을 때, 폰 전체 다시 번역 때). 화면이 한국어를 보여 주는 칸은 이로써 지도 검색(지명 자료, 우리 기록 아님)과 카메라 방금 찍은 사진(사진첩으로 감) 빼고 전부, 설정 → 폰 전체. 전엔 목록에 없는 화면이 다 폰 전체였음.
    - run77 뒤(생활 12개): THE STORY 첫 줄의 "before the owner's own life"를 뺌(옛 최종엔 없던 우선순위). 건강 · usual은 records에서 빼서 everyday 뒤 맨 위 칸 "health" · "usual"로(모델이 앞에서부터 쓰니 생활이 뒤로 밀려 짧아지지 않게). `recordsCore`가 둘을 읽어요. `applyDays`: 폰의 날이 짐작(pattern, 모델이 쓴 `:d` 줄 아님)이면 모델 값으로 바꿈(되돌리기 됨; run77 11-05가 pattern 8,050으로 남던 것).
    - THE STORY IS CANON(run78 뒤 세 줄로 압축하고 옛 따옴표 예시 — 마감 · 한 일 · 나중 계획 — 를 넷째 줄에 되돌림; 처음엔 할 일은 둘 중 하나: 이야기 안에서 쓰기 · 이야기 밖 일상 / 앞서가지 않기, 비밀 · 새 사실 · 이유와 전말 · 결과와 완료 · 계획 지어내지 않기 / 명시한 만큼만, 지어낸 미래는 일상만 / 이야기 사람 · 사건 기록에선 나중 메시지가 뒤집을 수 있는 건 새 사실). 겹치던 줄은 뺌: THE OWNER'S LIFE의 옛 새 사실 줄(예시 포함), 일기 · 음성 메모 끝의 "no new secrets or story events".
      - 지시문: 본체 15,553자(생활 앱 19,427, +날씨 20,484).
    - 3.180~: **반영 본체도 돈 단계처럼 기록 목록 하나(`records`)로 써요**(`coreRecordsSystem`, `AI_SYS` 칸: READING THE STORY · THE OWNER'S LIFE · KEEPING IN STEP · TIME PASSING · WHICH TYPE).
      - 기록마다 `type`(scene · contact · text · call · photo · note · search · calendar · post · profile · mail · diary · visit · voice, 생활 앱 폰은 alarm · timer · file · health · usual) · `at` · `from`("story" | "life") · `scene`(이야기 기록의 장면 id) · `made`.
      - 코드 어댑터 `recordsCore`가 옛 모양으로 바꿔요: scene → 사건, 이야기 기록 → 그 장면(없으면 그 메시지의 장면 하나, 없으면 `msg-<번호>` 사건, 따옴은 그 메시지 첫 40자), 생활 기록 → `everyday`(그대로 `everydayOn` · `everydayOnly`), 장면 없는 건강 → `days`, alarm · file의 `already` → `change`, call `kind` → `type`, mail `sender` → `from`. 생활 다녀간 곳은 버려요. 옛 `events` 답도 그대로 받아요.
      - 주인의 삶: 이야기가 말 안 해도 깨어 있는 내내 폰이 쓰여요(먼저 연락, 주변 사람의 소식 · 부탁, 단톡, 관심사, 기분, 습관). 생활 기록은 그 삶의 작은 일은 돼도 이야기를 움직이는 것(이야기 속 사람과의 결정 · 약속 · 계획 · 만남 · 비밀 · 변화)은 안 돼요. 사람은 주인 삶의 사람(동료 · 동기 · 이웃)을 지어내도 되고, 새 가족 · 애인은 안 돼요.
      - 개수: 깨어 있는 하루에 생활 기록 약 11개(`LIFE_A_DAY`), 건너뛴 날도 하루 약 11개, 모두 70개까지(`LIFE_MAX`). DAYS PASSED 블록은 본체에 안 보내요(본체가 now를 정하기 전이라 날을 셀 수 없어서). 지시문 숫자로 대신해요.
      - 하루 제한(생활 기록만, 반영 한 번 제한은 없앰): 문자 사람(또는 단톡)마다 대화 묶음 2개 · 묶음당 8줄 · 하루 16줄, 통화 사람당 2, 사진 5, 검색 5, 메모 2, 메일 3, 게시물 1, 일기 1, 음성 2, 일정 2, 알람 1 · 타이머 2 · 파일 2.
      - 단톡(디자인 3.179.2): `p.threads`에 `group: true`, `members`(주인 빼고). 방 이름(`with`)으로만 같은 방이고, 1:1 대화방과는 안 섞여요. 멤버는 합쳐져요. PHONE NOW에도 group · members가 가요.
      - 아카이브만 반영도 생활 기록을 받아요(전엔 일상 없음).
      - 지시문: 본체 12,100자(생활 앱 15,120, +날씨 16,177). 옛 본체 8,883 · 12,285자 + 따로 일상 요청(5,453 · 6,908자 + 본체 입력 전체)보다 요청 하나만큼 적어요.
    - 3.179.1: **일상을 반영 본체 답에 다시 합쳤어요**(3.180에서 records로 바뀜)(돈 단계가 이야기 결제와 일상 결제를 한 요청에 쓰는 것처럼). `AI_SYS_EVERYDAY` · `askEveryday` · `[PUT ON THE PHONE NOW]`는 없어졌고, 본체 지시문에 EVERYDAY 칸(따로 요청 때 줄 그대로: 목록 대부분 채우기, 장면 뒤 문자, PEOPLE AROUND, 새 사실 금지, 시각은 PHONE NOW의 now ~ 답의 now)과 답의 맨 위 `"everyday"`가 들어가요. 원문 있는 회차만(아카이브만 반영엔 없음). 코드는 그대로 `everydayOn`(마지막 사건에 붙이고 표시 · now 넘는 시각 자르기) · `everydayOnly`(앱마다 제한). 요청이 회차마다 하나 줄고(본체 입력 전체를 두 번 보내던 것), 본체 지시문은 +약 410토큰(생활 앱 폰도 같음).
    - 3.171.9~3.179.0: **일상은 따로 요청했어요**(`AI_SYS_EVERYDAY`, `askEveryday`): 반영 본체 답 바로 뒤, 사건 적용 전에. 반영 본체 입력 전부 + `[PUT ON THE PHONE NOW]`(본체가 뽑은 사건 한 줄씩) + `[SCENES WITH]`(이번 메시지에 이름이 나온, 폰이 아는 사람 — `scenesWith`). 답 `{"everyday": {…}}`는 지금처럼 마지막 사건에 붙고 앱마다 제한이 걸려요. 실패하면 일상만 빠져요. 본체 지시문에서 일상 줄 · 칸을 뺐어요: 본체 3,308 · 일상 1,376 · 생활 앱 있는 폰 1,780토큰(3.171.10: 알람 · 파일 · 타이머도 — 본체와 같은 줄 `LIFE_ALARMS` · `LIFE_FILES` · `LIFE_TIMERS` · `LIFE_ONCE` · `LIFE_CHANGE`, 한 번에 알람 1 · 타이머 1 · 파일 2. 건강 · usual은 본체가 오늘 줄을 매번 쓰니 본체만.  항목 모양을 본체와 같은 `PHONE_ITEMS`로 — 연락처 · 프로필 뺌 — , 사람 · 관계어 · 일기 · 예약 규칙도)(run51~53: 본체 안에서는 장면 뒤 문자가 세 번 다 안 생기고 새 사실이 계속 남았어요).
    - 3.171.8~: 장면 뒤 문자는 everyday 칸 설명으로 옮겼어요(run51 · 52 두 번 다 안 생겨서). "나중 메시지와 어긋날 수 있는 것(누가 정함 · 말함 · 원함, 시각, 결과)은 새 사실, 느낌과 주변 작은 것은 괜찮음" 한 줄(run52 R1: "rebrand" 한 단어로 덱 파일 · 마감 · 색 지어냄). 반영 1단계 3,563.
    - 3.171.7~: 일상 기록 제한은 앱마다 · 사람마다(`EVERYDAY_CAP`: 문자 사람당 한 번 3 · 하루 12, 통화 사람당 1 · 3, 사진 · 검색 2 · 8, 메모 · 메일 · 일기 1 · 3, SNS · 음성 1 · 2). 이야기 기록은 제한 없음. 통화는 이어진 부재중을 한 줄 + `count`로(`inARow`, 3시간 안, 사이에 다른 통화 없을 때).
    - 3.171.7~: 일상 기록은 답의 맨 위 `"everyday"` 칸에 따로 와요(run51: 사건 안에 넣으라고 했더니 표시 없이 섞여서 0개). 코드가 그 회차 마지막 사건에 붙이고 표시해요(`everydayOn`), 사건이 없으면 마지막 메시지로 하나 만들어요. 반영 1단계 3,464.
    - 3.171.6~: 반영도 일상 기록(EVERYDAY, `"everyday": true` → 재구성 `src: guess`): **반영마다**(같은 날에도) 그 메시지들이 지나간 시간만큼 0~2개, 하루 6개까지(`everydayOnly`). 모든 앱(메모 · 사진 · 검색 · 메일 · 캘린더 · SNS · 일기 · 음성 메모 · 문자 · 통화). 사람과 감정은 이야기와 PEOPLE AROUND 그대로, 새 사실 · 사건 · 약속 · 비밀은 안 돼요. 장면 뒤 문자(싸운 뒤 문자로 또 싸우기)도 한 줄. 지시문 약 +120토큰.
    - 3.171.6~: **PEOPLE AROUND**: 위치 판독이 카드 · 페르소나 · 폰 주인 프로필 · 로어북(새로 넣음) · 이야기가 주인과 엮어 가장 많이 쓴 5명(가깝든 아니든, "중요한 사람"으로 고르면 전 애인 같은 사연 있는 사람만 골라서)을 뽑아 `p.around`에 둬요. 사람마다 원문 표현을 압축해서 300토큰까지(요약 아님). 반영은 원문 대신 이 블록을 받아요(최대 약 1,500토큰). 압축본 끝에 지금 사이(같이 삶 · 헤어짐 · 연락 끊김)를 적고, 반영은 지금 연락 안 하는 사람과는 일상 문자 · 통화를 안 만들어요. 판독이 하나도 안 주면 있던 걸 지켜요. 자동 문자(인증번호 · 택배 알림)는 문자 목록이 지저분해져서 뺐어요. 그 뒤 지시문을 다듬어서(시차 · statusCity · 일상 줄) 반영 1단계 3,421(메인 3,217 대비 +204; 줄이다 빠진 뜻 — 누구 화면이면 그 사람 도시, "owner"는 주인 장면, 오늘 줄 목록 · 별일 없어도, 습관에서 · 그때 사건 · 감정 — 은 되살림). 위치 판독 지시문 약 +170토큰, 답 최대 4,500토큰.
    - 3.171.6~: 운동은 하루 목록(`workouts`, 같은 종류 · 시각은 한 번, `workout`은 제일 긴 것 — 옛 화면용). 심박 범위는 같은 날 안에서 넓어지기만. LIFE NOW에 오늘 줄은 층 · 운동 · 커피 · 물 · 스크린까지 보내요(+약 40토큰, 오늘 줄만).
    - 3.171.6~: 같은 날 안에서 느리게 가는 롤플: 반영할 때마다 **오늘('now'의 날) 줄을 지금까지 합계로 다시 써요**(지시문 한 문장, 약 +30토큰). 이벤트 `phone.health`로 오면 `applyLife`, 아니면 `days`로 오면 `applyDays`가 이미 있는 오늘 줄을 고쳐요. 하루에 쌓이는 값(걸음 · 거리 · 층 · 커피 · 물 · 앱별 분 · 집어든 횟수)은 같은 날 안에서 줄지 않아요(`soFar`). 지난 날은 그대로 고칠 수 있어요. 되돌리기는 다른 change처럼 돌아가요.
    - 3.170.71~: `ownerCity` + `elsewhere`를 **`moved` 한 칸**으로 합쳤어요(`[{ name, city, names, tz }]`, 주인은 이름 그대로 또는 `"owner"`). 코드는 주인 줄(`ownerMoved`)과 나머지(`peopleMoved`)로 나눠 써요. 옛 답의 `ownerCity` · `elsewhere`도 그대로 읽어요. 지시문 약 −45토큰.
      - `statusCity`는 그대로 "코드가 장면을 모를 때만" 물어요. 항상 묻게 해도 코드가 확실할 땐 코드가 이겨야 해서 조건이 안 줄어요.
    - 3.170.70~: 위치 판독이 사람마다 다른 이름(`aka`: "Somang Park" ↔ "소망")도 받아요. 상태창 장소가 누구의 방("Mara's room", "소망의 방", "마라네 집")이면 그 사람 도시예요. 아무도 없는 도시라도 시간대 이름(Rome, Tokyo)이면 반영 전에도 주인이 거기 간 걸로 봐요(`moved`, 시각은 상태창 그대로). 같은 도시의 "Somang Park" · "Somang"은 한 줄로 합쳐요(다른 도시면 두 사람).
  - 날씨 앱 현재 위치(3.170.56~): 주인 장면의 장소가 도시가 아니면("Mara's room", "Gangnam · cafe") 현재 위치는 모델이 말한 도시, 없으면 원래 도시로 두고 날씨 · 기온 · 시각만 상태창대로(`homeTracker`).
  - 날짜 읽기(3.170.54~): 두 숫자가 다 월이 될 수 있는 날짜(`03.11.`)는 **채팅방 설정 "상태창 날짜 순서"**(`m.dateOrder`: `md` 월.일 / `dm` 일.월)대로. 고르기 전엔 월.일이고, 처음 폰 만들기 · 반영 때 한 번 물어요(디자인 세션 팝업, `needsDateOrder` · `setDateOrder`). 점 · 슬래시 날짜에만 쓰고 `MM-DD`(대시)는 늘 월-일. 한쪽이 12보다 크면(`26.10.`) 설정과 상관없이 알아서 읽어요. 윤년 2월 29일은 그날 하루로 세요.
- 모델 답 읽기(3.170.50~):
  - 채우기(생활 · 스크린타임 · 배달 · 동네 가게 · 폰 만들기 · 음성 메모)는 JSON이 고쳐지지 않으면 조각별로 읽고 망가진 조각만 버려요(`salvageJson`). 숫자가 갈라진 것(`12,000`, `1 20`) · 잘못 닫은 괄호 · 빠진 쉼표는 그 칸을 버리고 값을 남기지 않아요. 배달 · 동네 가게 · 음성 메모는 칸 하나라도 망가진 기록을 통째로 빼요(`'whole'`).
  - 반영 답은 지금처럼 전부 아니면 없음(빠진 사건의 메시지가 읽은 걸로 남으면 안 돼서).
  - 생활 · 배달 채우기의 중간에 끊긴 답(`cutShort`)과 `{"error": …}` 같은 엉뚱한 답은 실패로 보고 있던 앱을 그대로 둬요.
- 반영 규칙 추가(3.170.50~56):
  - 돈 단계에는 사건 메시지 앞뒤 2개씩, 단 이미 읽었거나 이번에 읽는 메시지만.
  - 모델이 메시지 번호를 범위("#2–#3")나 하나 틀리게 써도 인용문으로 메시지를 찾아요. 한 번에 사건이 40개를 넘으면 나머지 메시지는 다음에 다시 읽어요.
  - 옛 사건 이름을 다음 날 새 결제에 다시 써도(날짜가 다르고 "new") 새로 결제해요. 돈 단계 id는 대소문자 · "#"와 상관없이 맞춰요. 밀린 결제를 답이 빼먹으면 다시 밀리고, 두 번째면 안내에 남아요.
  - 나중 메시지가 같은 사건을 다시 말해 준 것(배송 완료 등)에는 그 메시지 번호(`src`)를 달아요. 그 메시지만 지우면 그것만 빼기 목록에 떠요(`parts`).
- 되돌리기 · 복구(3.170.51~): 반영 뒤 붙은 번호(id)는 "바뀐 것"으로 안 봐요(날씨가 안 돌아가던 원인). 반영이 스스로 바꾼 것(날씨 · 건강 · 시계)도 남기면 안내해요. 복구는 반영으로 이미 다시 읽은 라운드를 다시 넣지 않아요.
>   - 시간대 주변(`placesAround`): 주인 → 저장 도시 → 판독된 사람 → 같은 채팅의 다른 폰(현재 위치, 없으면 나라). OWNER'S CLOCK · 상태창 판단이 다 이걸 써요.

> **점검 9 (돈 단계 재설계, 소망 확정)** — 아래 설계보다 이게 먼저예요.
> - core는 돈을 전혀 안 봐요. `"apps"` 표시 · 돈만 있는 장면 이벤트 · 처음 나온 주문 줄을 다 뺐어요(core 약 −130토큰).
> - money 요청은 **반영마다** 가요(은행이나 투자 앱이 있는 폰). 그 회차 메시지 전체 + 못 넣은 메시지(`s.owed.money = [{ at, tries, date?, time? }]`, 메시지 단위, 두 번 실패하면 건너뜀)를 읽어요.
> - 지시문(`moneySystem`)은 서사형: "이 장면들 뒤에 폰에 무엇이 보일까". 답은 `{"records": [...]}` 한 목록, 기록마다 `type`과 `at`(메시지 번호). `recordsMoney`가 옛 목록 모양으로 바꿔서 `applyMoney`가 그대로 받아요. 옛 `{"events":[{id, money}]}` 답도 읽어요.
> - 기록은 그 메시지의 core 이벤트가 하나면 거기, 아니면 `money-<번호>` 이벤트에 붙어요(되돌리기 · 빼기 · 복구가 메시지와 같이). 한 메시지에서 날짜가 다른 기록은 그날로 따로 넣어요.
> - 새 칸: 빚 `whose`, 주문 `sender` · `payer`, 표 `until` · `membership`, 자산 `blocked` · `receivable`(돌려받으면 줄고 `settled`) · `investment`, 계좌 기록(막힘 · 풀림 · 해지 · 카드 `billDay` · `paidFrom` · 이야기가 말하는 `balance` → 차이 한 줄 `adjust`), 정기 입출금 `regular`.
> - 시간 흐름(반영 시계, 되돌리기 됨): `regularClock`(정기 입출금을 그날마다, 들은 날부터, 손으로 낸 달은 빼고 · 카드 결제일에 그달 사용액), `orderClock`(도착일 지난 택배는 도착). money 입력에 `[DAYS PASSED]`(최근 7일 하루씩 · 그 앞은 구간, 끝난 메시지 번호), `[CALENDAR]`(전 DAYS), MONEY NOW에 정기 입출금 · `thisMonth`, INVESTMENTS NOW에 `date` · 보유 종목 `price`.
> - 값 합치기: 지어낸 값은 다시 말해도 안 바뀜(표류 방지), 자산 값 · 빚은 "바뀌었다"는 메시지(`new`)의 새 값으로.
> - 남은 것: 은행 채우기(폰 만들기)는 정기 기록을 아직 안 만들어요 — 첫 반영의 money 단계가 "빠진 정기 기록 쓰기" 줄로 채워요. 정기 기록을 빼기로 지우면 이미 자동으로 넣은 거래는 남아요.

> **메인 3.169.95에 들어갔어요.** run33~36(Vertex)으로 비교했어요. 품질은 같거나 B가 나았어요(사진·메모 지어내기 없음, 스카프 합계, 걸음 수, 인원, 메일). 입력 토큰은 돈 라운드에서 +31~54%였어요. 소망이 품질 우선으로 정했어요. 투자는 따로 `invest` 표시로, 돈 요청은 그때만 투자 자료를 받아요.

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
> run33(Vertex, 라운드 1 #60~#67): core가 장바구니(#63, 이벤트 자체 없음)·주가(#65)·관심 종목(#66)에 money를 안 붙였어요. 표시 정의가 결제·주문·거래만 말해서였어요. 그래서 정의를 은행·카드·주문·티켓·배달 앱(장바구니 포함)·증권(거래·주가·관심 종목·지분) 전부로 넓혔어요(core 2,626 → 2,667). 돈 단계 자체는 id를 그대로 썼고 적금은 B가 맞았어요(A는 같은 돈을 한 줄 더 넣음).
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

## 9. 아카이브와 반영이 만나는 곳 (3.170.31~)

- **채우기 · 폰 만들기**: 아카이브 + 아카이브 뒤 원문(오래된 순, 7만 토큰까지). 넘으면 #k에서 멈추고 그 앱의 읽음 표시를 #k에, 날짜 · 날씨 · 앱 시각도 #k 기준(`nowAt`, `storyNow(p, upto)`). 나머지는 반영이 이어서 읽어요.
- **반영 전에 아카이브된 구간**: 아카이브하면 메시지가 숨겨져서 반영이 못 읽었어요(구멍). 이제 `archivedUnread`가 "기준점 뒤, 아직 안 읽음, 메시지가 다 숨겨짐, 아직 안 쓴 섹션"을 골라 `ARCHIVE FOR THESE MESSAGES` 증거로 넣어요(한 라운드 섹션 글 8,000토큰까지, 섹션은 통째로 · 안 자름, 오래된 순 — 소망 결정. 250~280단어 섹션이면 20개쯤. 요약은 1천 토큰에 일 4~5개라 이벤트 40개 · 출력 16,000토큰 안에 들어가요. 넘는 섹션은 다음 라운드, 혼자 긴 섹션은 혼자). NEW MESSAGES가 비어도 라운드가 돌아요.
  - 그 섹션에서 나온 이벤트도 기준점 뒤 · 섹션 인용 검사를 그대로 받아요. 이미 읽은 메시지(`readBefore` = done 또는 hiddenRead)는 거절해요.
  - 읽은 숨김 메시지는 `s.hiddenRead`에 넣어요(`realign`이 done을 보이는 메시지로만 다시 만들기 때문에). 섹션 제목이 바뀌어 키가 달라져도 다시 안 읽어요.
  - 남은 수(`syncLeft(p, m)`, `syncLast.remaining`)에 이런 섹션도 하나씩 세요.
- core 지시문 YOU GET 한 줄 늘어남: 2,825 → 2,849토큰.
- 안 한 것: 끊긴 채우기 뒤에 반영이 이미 지나간 구간(다시 만들기)은 소망이 미뤘어요. 앱별 다시 읽기 목록(호출 · 상태가 늘어남)과 반영 이벤트로 대신 보내기 둘 다 보류.
