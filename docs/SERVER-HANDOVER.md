# 서버 플러그인 인수인계 (2026-11-22, 3.230.0 · `b8a8342` 기준)

"실리를 닫아도 · 탭을 가려도 캐릭터가 먼저 말을 걸고 늦은 답장이 온다"를 맡는 세션이 맨 먼저 읽는 글이에요.
설계의 자세한 기록은 `docs/PHONE2-PLAN.md`의 "서버 플러그인" 3단계, 마리나라와의 대조는 `docs/MARINARA-PORT.md`에 있어요.
이 글은 "어디에 뭐가 있고, 왜 그렇게 했고, 뭘 건드리면 뭐가 깨지고, 다음에 뭘 해야 하는지"를 한 곳에 모은 거예요.

## 0. 일하는 규칙 (소망이 여러 번 말한 것)

- `CLAUDE.md` 맨 위부터 읽어요. 특히: 마리나라 코드는 **한 줄도 빠짐없이 끝까지 읽고** 그대로 가져와요. 읽지 않은 파일은 `MARINARA-PORT.md`에 "아니오"로 적어요.
- 실리 코드도 같아요. 소망: "실리코드 빠짐없이보고해 제발". 기대는 부분은 줄 번호까지 읽고 적어요.
- **반쪽짜리 금지.** 되는 것만 화면에 보여요. 안 되는 것은 숨기지 말고 이유를 알려요.
- 예시 하나를 받으면 그 종류 전체를 고쳐요.
- 질문에는 답만 해요. 코드는 "ㄱㄱ · 응 · 넹 · 웅 · 굿 · ㅇㅇ" 뒤에 고쳐요. 메인은 허락받고 올려요.
- 답은 짧고 쉬운 한국어(~요). 감정 이야기 · 묻지 않은 조언 없이. 한 번에 하나만 물어요.
- 화면 파일(`src/phone.js` · `phoneorbit*.js` · `phoneapps.js` · `panel*.js` · CSS · `tools/dev/`)은 디자인 세션 것이에요(브랜치 `ccr-f32236fa-8bawm7`). 메시지를 써서 소망이 전해요.
- 소망의 롤플 내용은 저장소에 넣지 않아요. 예시는 Mara · Ren · Ivo · Varo · Lio · Seraphina(실리 기본 캐릭터)만.
- 키를 묻거나 찍지 않아요. 키를 새로 저장하지 않아요("Api키는 실리 꺼랑 확장꺼 그대로").
- 진짜 모델(Vertex)은 시험 세션이 소망의 "ㄱㄱ" 뒤에만 불러요. 이 글의 확인은 전부 가짜 모델 서버로 한 거예요.

## 1. 한눈에 보기

```
브라우저 (실리 페이지)                         실리 서버 (터묵스의 Node)
────────────────────────                     ─────────────────────────────────────────────
src/phone2go.js  답장 코드 ◀── 같은 파일 ──▶  일꾼 스레드 (plugin/worker.mjs)
src/phone2keepon.js                            ├ plugin/screen.mjs   아무것도 안 하는 화면
  ├ 30초마다 "보고 있음" ──/auto/presence──▶   ├ plugin/work.mjs     실리의 것을 서버 것으로 + 답장 만들기
  ├ 서버가 쓴 것 받기 ◀──/store/rev·load──     ├ plugin/auto.mjs     마리나라 스케줄러가 부르는 app
  └ 저장 ──────────────/store/save────────▶    └ plugin/marinara/server-autonomous-scheduler.service.js
src/phone2kit.js  묶음(kit) 만들기                       │ 저장 부탁          │ fetch('/api/…')
src/phone2tick.js 30초 틱                       플러그인 본체 (plugin/index.mjs · host.mjs)
                                                ├ plugin/store.mjs    조각 저장 (rev)
                                                └ plugin/bridge.mjs   실리 자신의 처리기를 127.0.0.1에
```

- 마리나라의 "채팅" 하나 = 우리 **방** 하나. id는 `<세계 id>:<방 id>` (`phone2sched.js chatIdOf`). 브라우저와 서버가 같은 글자를 써요.
- 저장 하나 = 실리 채팅 하나의 Orbit (`m.live`). `<사용자 폴더>/NarrativeArchive/orbit/<저장 id>/`. 채팅 파일에는 `m.liveRef = { id }`만 있어요.

## 2. 파일마다 하는 일

### 서버 쪽 (`plugin/`)

| 파일 | 줄 | 하는 일 |
|---|---|---|
| `index.mjs` | 84 | 실리가 부르는 들머리(`info` · `init(router)` · `exit`). 길: `/ping`, `/store/load·rev·save·fork·drop`, `/auto/presence`, `/auto/status`. `globalThis.DATA_ROOT`가 있을 때만(=실리 서버 안) 일꾼을 켜요. 실리를 켰을 때 `src/users.js`로 사용자를 찾아, Orbit 저장이 있는 사람의 일꾼을 미리 켜요. `VERSION = 2`는 플러그인의 길 버전(확장 버전과 다른 것) |
| `store.mjs` | 123 | 조각 저장. `rev`가 저장마다 1씩 올라가고, 보낸 쪽이 본 `rev`(base)가 다르면 409. `list()` · `generation()`(쓴 횟수). 실리 · 익스프레스를 몰라요 |
| `host.mjs` | 48 | 본체 쪽. 사용자마다 일꾼 스레드 하나를 띄우고 말을 주고받아요. 일꾼이 부탁하는 저장 일(`list` · `revOf` · `load` · `save`)을 대신 해요. `list` · `inject` · `sweep` · `unread`는 테스트와 손 확인용 |
| `worker.mjs` | 54 | 일꾼 스레드의 들머리. **순서가 중요해요**: `screen.mjs`를 먼저 불러야 해요. 전역 `fetch`를 바꿔서 `/`로 시작하는 주소를 다리로 넘겨요 |
| `screen.mjs` | 37 | 아무것도 안 하는 화면: `document` · `$` · `toastr` 등에 "뭘 시켜도 자기 자신을 돌려주는 것"을 둬요. `SillyTavern.getContext()`는 `setContext()`로 그때그때 바꿔 끼워요. 일꾼 스레드에서만 불러요(본체에서 부르면 오류. 테스트는 `NA_SCREEN_ANYWHERE=1`) |
| `work.mjs` | 266 | 핵심. 실리의 것을 서버 것으로(`contextOf`), 실리 연결 방식의 대역(`stStandIn`), 한 번에 한 세계(`withWorld`), 돌려도 되나(`blocked` · `cannot`), 먼저 건 말 만들기(`generate`), 늦은 답장(`sweepDue`), 화면용 상태(`status`), 보고 있음(`presence`) |
| `auto.mjs` | 151 | 마리나라 스케줄러가 아는 `app`을 플러그인 저장 위에 만들어요. `chats.list/getById/resolveConversationPresenceState/markAutonomousUnread`, `inject`(때가 됐나 · 답장 만들기), 읽어 둔 세계(`open`: rev가 그대로면 다시 안 읽음), 쓰기(`write`: 바뀐 조각만) |
| `bridge.mjs` | 52 | 127.0.0.1의 아무 포트에 실리 **자신의** 라우터를 붙여요. 실리를 켤 때마다 새로 만드는 토큰이 있어야 하고, 네 길만 열어요: `POST /api/backends/chat-completions/generate`, `POST /api/characters/merge-attributes`, `POST /api/worldinfo/get`, `GET /user/files/…` |
| `log.mjs` | 30 | 마리나라 파일이 부르는 `logger` · `logRateLimited` |
| `marinara/server-autonomous-scheduler.service.js` | 488 | 마리나라 파일 **통째**. 고친 것은 맨 위 머리말에 적힌 네 가지뿐. 다시 만들 때는 스크립트로(아래 8장) |
| `marinara/autonomous-candidates.js` | 40 | 마리나라 파일 통째. 지금 부르는 곳은 테스트뿐 |

### 브라우저 쪽 (`src/`, 서버 때문에 생기거나 바뀐 것)

| 파일 | 하는 일 |
|---|---|
| `phone2kit.js` (새) | 서버가 읽을 묶음. `buildKit(c, real, tail, { version })` · `putKit` · `kitOf` · `kitContext`. 실리 · 화면을 몰라요 |
| `phone2keep.js` | 원래의 조각 저장에 더해: `merge3`(셋 비교 합치기) · `settleRooms`(순서 · 번호) · `into`(제자리 맞추기) · `sync` · 저장이 409면 합쳐서 다시(세 번째는 오류) |
| `phone2keepon.js` | `keepBeat`(30초마다 · 다시 보일 때 · 채팅 열 때) · `keepPing` · `keepSync` · `keepServes` · `keepAutoStatus` · `keepKept` |
| `phone2tick.js` | 가려져 있고 일꾼이 돌면 쉬어요. 30초마다 `liveKitRefresh` |
| `phone2go.js` | `replyRoute` · `liveReplyPlan` · `liveKitRefresh` · `liveServerStatus` · `liveServerOn` · `liveAutonomousUnread`. 먼저 건 말에 `extra.autonomous` 표시와 `na-live-auto` 신호. `keepUpStory`는 `ctx().naServer`면 안 해요. `gatherJob`이 `job.user`를 넘겨요 |
| `phone2sched.js` | `checkProactive(…, { userStatus })` · `contextBlock(…, { user })` · `intentWhy` · `restoreFollowups` · `reseedActivity` |
| `phone2snap.js` | `liveChatTail`: `ctx().naTail`이 있으면 그걸 줘요(서버만) |
| `phone2store.js` | `readLive`: 페르소나가 읽으면 `autonomousUnread*` 세 칸을 지워요 |
| `ai.js` | `stSourceData`(요청 만들기와 보내기를 나눔) · `stTemplateKey` · `stSourceTemplate` · `ST_TEMPLATE_SECRETS` |
| `marinara/notification-sound.js` · `local-notifications.js` (새) | 마리나라 파일 통째. 부르는 곳은 `src/phone.js`(디자인) |

## 3. 꼭 알아야 하는 설계 결정과 그 이유

### 3-1. 답장 코드를 서버용으로 다시 쓰지 않았어요
`src/phone2go.js`에서 딸려 오는 파일이 166개(화면 파일까지)예요. 서버용 대역을 하나하나 만들면 브라우저와 어긋나요.
그래서 **진짜 파일을 그대로** 일꾼 스레드에서 불러요. 화면을 찾는 줄은 `screen.mjs`의 "아무것도 안 하는 것"이 받아요.

- 확인한 것: 답장 길의 데이터 파일(`phonedata.js` · `drift.js` · `extract.js` · `phoneparse.js` …)에는 화면에서 값을 읽어 **계산**하는 코드가 없어요.
- **조심**: 화면에서 값을 읽는 코드가 답장 길에 새로 들어오면(예: `document.querySelectorAll(...)`의 결과로 뭔가 정하기) 서버에서는 조용히 빈 값이 돼요.
  지금 그런 곳: `ai.js`의 `vxModelList` · `stSourceList` · `stSourceModels`의 `fromPage`(서버에서는 빈 목록). 답장 길은 이 목록에 기대지 않아요.
- `document.hidden`은 일꾼 안에서 "참 같은 것"이에요. 일꾼 안에서 `document.hidden`을 보는 코드에 기대지 마세요(`phone2tick.js`는 일꾼에서 안 돌아요).

### 3-2. 서버가 줄 수 없는 실리 값은 읽는 순간 오류예요
`work.mjs contextOf`의 Proxy가, 주지 않은 칸을 읽으면 `서버에서는 실리의 이 값을 못 써요: <칸>`을 던져요.
`OPTIONAL`에 든 칸만 `undefined`를 줘요. **모자란 채로 답장을 지어내지 않으려는 것**이에요.
새 칸이 필요해지면: 그 값이 어디서 오는지 정하고(`kit` · `settings.json` · 다리) 넣어요. 함부로 `OPTIONAL`에 넣지 마세요.

지금 주는 칸: `naServer` · `naTail` · `chatMetadata` · `chatId` · `characters` · `characterId` · `groupId` · `groups` · `name1` ·
`powerUserSettings{personas, persona_descriptions, persona_description}` · `extensionSettings` · `ConnectionManagerRequestService.getSupportedProfiles` ·
`chatCompletionSettings` · `mainApi` · `saveMetadata` · `saveSettingsDebounced`(아무것도 안 함) · `setExtensionPrompt`(아무것도 안 함) ·
`getRequestHeaders` · `writeExtensionField` · `loadWorldInfo`.
**안 주는 칸**: `chat`(롤플 채팅). 서버에는 롤플 채팅이 없어요.

### 3-3. 묶음 (kit): 브라우저만 아는 것
`m.live.kit`에 있고 저장의 `live` 조각에 실려요. 브라우저가 30초마다 달라졌을 때만 다시 넣어요(`liveKitRefresh` → `putKit`).

```
kit = { v: 1, ver (확장 버전), name1, persona (지금 고른 페르소나의 설명),
        characters: [필요한 카드만, 실리 목록의 순서 그대로, 읽는 칸만],
        chat: { avatar, group: { id, members }, file: { group, dir, id } },
        tail: { lines, first, end }   // liveChatTail()이 그 순간 읽은 롤플 끝
        meta: { glossary, glossaryPeople, dateOrder, phoneScreenHolder },
        st: { 틀의 열쇠: { data, secrets } } }   // 실리 연결 방식의 요청 틀
```

- 카드는 **이름으로 찾을 때 같은 카드가 먼저 나오게** 실리 목록의 순서를 지켜요(이름이 같은 카드가 둘일 수 있어요).
- 담는 칸: `name` · `avatar` · `description` · `personality` · `scenario` · `first_mes` · `mes_example` · `extensions.talkativeness` · `extensions.narrative_archive_convo`. 답장 코드가 다른 칸을 읽게 되면 `phone2kit.js`의 `CARD_FIELDS` · `CARD_EXT`에 더해요.
- 키 · 아카이브 글 · 카드의 로어북은 안 담아요(테스트가 확인해요).

### 3-4. 서버가 그 세계를 안 돌리는 때 (`work.mjs blocked`)
1. 묶음이 없음.
2. **확장과 플러그인의 버전이 다름** (`kit.ver !== src/core.js VERSION`). 플러그인은 실리 `plugins/` 폴더의 것, 확장은 확장 폴더의 것이라 따로 올라가요. 소망은 플러그인 자동 업데이트를 꺼 뒀어요: 확장을 올릴 때마다 `plugins/NarrativeArchive`에서 `git pull` 하고 실리를 다시 켜야 해요.
3. **실리의 그 채팅 파일이 없음** (`<root>/chats/<dir>/<id>.jsonl`, 그룹은 `<root>/group chats/<id>.jsonl`). 지운 채팅의 Orbit에 계속 말을 걸어 모델 비용이 나가지 않게.

방마다 안 되는 때는 `cannot`(4장)이에요. 이유는 `/auto/status`로 화면에 가요.

### 3-5. 브라우저와 서버가 번갈아 돌아요
둘이 같이 돌면 말이 두 번 나와요.

- 브라우저: 보이는 동안 30초마다 `/auto/presence`. 가려져 있어도 답장을 받는 중(`running` 줄이 있음)이면 알려요.
- 서버: 그 세계의 어느 방이든 75초 안에 알림이 있었으면 안 건드려요(마리나라의 값 `RECENT_CLIENT_PRESENCE_MS`).
- 가려진 탭: 일꾼이 돌면(`keepServes`) 브라우저 틱이 쉬어요. 일꾼이 없으면 전처럼 브라우저가 다 해요.
- 다시 보이면: 알리고 → 서버가 쓴 것을 받아요(`keepSync`).

### 3-6. 합치기 (`phone2keep.js merge3`)
"마지막으로 맞았던 것(base) · 서버 것 · 브라우저 것" 셋을 비교해요. base는 `st.texts`(조각마다의 JSON 글)에 있어요.

- 한쪽만 바꾼 것 → 그쪽 것. 양쪽이 바꾼 묶음 → 칸마다 다시. **id가 있는 목록(방의 말 · 답장 줄) → id로 합쳐요.** 그 밖의 충돌 → 서버 것.
- `settleRooms`: 말을 보낸 때 순서로, 번호(`n`)가 겹치면 브라우저에만 있던 말에 새 번호. **서버가 가진 말의 번호는 안 바꿔요**(반영 · 요약이 그 번호로 읽은 자리를 기억해요).
- `into`: `m.live`를 **제자리로** 맞춰요. 방 · 말의 객체가 그대로라 화면과 돌고 있는 답장이 쥔 것이 안 죽어요. `m.live = 새것`으로 바꾸면 안 돼요.
- 퍼즈 400판이 지키는 것: 어느 쪽 말도 안 없어짐, id · 번호 안 겹침, 때 순서, 서버 번호 그대로, 답장 줄 그대로.

### 3-7. 따라 묻기 수를 되살려요 (우리 것)
마리나라는 서버 한 곳이 "몇 번째 따라 묻기인지"를 메모리에 기억해요. 우리는 브라우저와 일꾼이 **따로** 기억해요.
그래서 먼저 건 말의 마지막 말풍선에 `extra.autonomous = true`를 남기고, 방을 처음 판단할 때(`restoreFollowups`) ·
다른 쪽이 방을 바꾼 뒤(`reseedActivity`) 그 표시로 `{ count, lastSentAt }`을 채워요.
이게 없으면 실리를 다시 열자마자 캐릭터가 한 번 더 말을 걸어요.
`reseedActivity`는 "브라우저가 보고 있음"(`clientPresence`)과 "걸고 있는 중"을 **남겨요**. `forgetActivity`를 대신 쓰면 서버가 브라우저가 떠난 줄 알고 끼어들어요.

## 4. 어느 연결이 서버에서 되나 (`phone2go.js liveReplyPlan` → `work.mjs cannot`)

| 방의 연결 | 서버 | 어떻게 |
|---|---|---|
| 커스텀 API (`mode: 'custom'`) | 됨 | 진짜 `ai.js`가 Node의 fetch로 바로 보내요. 키는 `settings.json`의 확장 설정 |
| Vertex (`mode: 'vertex'`) | 됨 | 다리로 실리의 처리기에. 키는 실리가 붙여요 |
| 실리 연결 방식 (`mode: 'source'`) | 됨 (틀이 있을 때) | 아래 |
| 연결 프로필 (`profile:<id>`) | **안 됨** | 다음 일 (6장) |
| 실리 자신의 연결 (`'ai'` 칸이 `st` 방식, 프로필도 없음) | **안 됨** | 다음 일 (6장) |

**실리 연결 방식의 요청 틀**: 요청을 실리의 **브라우저** 코드 `createGenerationParameters`(`public/scripts/openai.js` 2691~3128)가 만들어요.
서버에는 그 코드가 없어서, 브라우저가 미리 "메시지만 빠진 요청"을 만들어 `kit.st`에 남겨요(`ai.js stSourceTemplate`).

- 열쇠(`stTemplateKey`): 연결 · 모델 · 길이 · 온도 · top_p · 레벨 · 생각 보기. **같은 요청일 때만** 그 틀을 써요. 값이 하나라도 다르면 틀을 못 찾고 오류(지어내지 않음).
- 틀을 만드는 값은 `liveReplyPlan` 하나에서 나와요: `maxTokens = LIVE_GO.replyTokens(4000)`, `effort = 방의 레벨 || 'low'`, `thoughts = effort !== 'none'`. `askRoom`도 같은 `replyRoute`를 봐요. **둘이 어긋나면 서버가 틀을 못 찾아요**: `tests/phone2go.test.mjs`의 "실리 연결 방식으로 나가는 방마다 요청 틀" 테스트가 실제 보낸 값과 대 봐요.
- 채워 넣은 메시지가 그대로 나오는지(`\u0001NA_SYSTEM\u0001` · `\u0001NA_USER\u0001`) 확인해요. 실리가 메시지를 고쳐 보내는 모델(o1: 시스템 → 유저)은 틀을 안 만들어요.
- 비밀 칸(`proxy_password` · `custom_include_headers`)은 틀에 안 담고, 서버가 보낼 때 `settings.json`의 `oai_settings`에서 읽어요. 그 값에 `{{`가 있으면 서버는 못 보내요(실리가 브라우저에서 매크로를 채우는 칸).
- 서버 쪽 대역: `work.mjs stStandIn`이 `globalThis.__naStOpenai`에 `{ oai_settings, createGenerationParameters }`를 둬요. 진짜 `ai.js`는 이 전역이 있으면 `/scripts/openai.js` 대신 이걸 써요(테스트도 같은 자리를 써요).

**프로필 방을 초안 모델로 답하지 않게**: `replyRoute`는 방의 `connectionId`가 목록에 없으면 "안 고른 방"으로 봐요. 서버에서는 프로필 목록이 비어서, 프로필 방이 초안 모델로 답할 뻔했어요. 그래서 `contextOf`가 `settings.json`의 `extension_settings.connectionManager.profiles`로 `getSupportedProfiles()`를 줘요. **이 줄을 빼면 다른 모델로 답해요**(테스트가 지켜요).

## 5. 일이 흘러가는 순서

### 먼저 건 말 (서버)
1. 스케줄러: 일꾼이 뜬 지 20초 뒤 첫 판, 그 뒤 60초마다. 한 번에 2방까지, 덜 본 방부터.
2. `app.chats.list()`: 저장을 전부 훑어요. 켠 세계(`w.presence.on`)만 스케줄러가 봐요. `blocked`인 세계는 목록에 없어요.
3. 75초 안에 브라우저 알림이 있던 방 · 답장을 만들고 있는 방은 건너뛰어요.
4. `/api/conversation/autonomous/check` → `auto.mjs inject` → `phone2sched.js checkProactive`(내 상태 `idle` · 후속 2번 · `source: 'server'`).
5. 오프라인이면 그만. 바쁘면 그 늦음만큼 타이머. 꺼 둔 이유 · 쉬는 시간이면 그만.
6. `/api/generate` → `work.mjs generate`: `cannot` 확인 → 방에 답장이 이미 줄 서 있거나 실패 뒤 쉬는 중이면 409 → 줄 세우기(`auto` · `timed` · `user: { status: 'idle', activity: 'away or offline' }` · `intent` · `why`) → `G.liveGo(real)` → 곧 나갈 주고받기 답장이 있으면 기다렸다가 한 번 더(`runSoon`).
7. 답: 말이 나왔으면 `message_saved` + `done`, 안 나왔으면 `generation_discarded` + `done`, 실패면 `error`. 서버가 못 돌리는 방은 400(스케줄러가 30분씩 쉼).
8. 스케줄러가 `markAutonomousUnread`: 방에 `autonomousUnreadCount` · `autonomousUnreadCharacterIds` · `autonomousUnreadAt`.

### 늦은 답장 (서버, 우리 것)
`work.mjs sweepDue`가 30초마다. 때가 된 `waiting` 답장이 있는 세계를 `liveGo`로 돌려요. 브라우저가 보고 있는 세계, 서버가 못 보내는 방의 답장이 낀 세계는 **통째로** 안 건드려요(실패한 답장으로 남기지 않으려고).

### 브라우저가 다시 보일 때
`keepBeat` → `keepPing` → `keepSync` → 바뀌었으면 방마다 `reseedActivity` → `na-live-change` → 안 읽음이 늘어난 방이 있으면 `na-live-auto`(`from: 'server'`).

## 6. 다음 일: 연결 프로필 · 실리 자신의 연결을 서버에서 되게 (소망: "이 루트를 제일 자주 씀")

소망에게 한 말: "실리 연결 방식에 쓴 것과 같은 방법이에요. 브라우저가 열려 있을 때 실리 자신의 코드로 메시지 자리만 비운 요청을 미리 만들어 두고, 서버는 메시지만 채워 보내요. 실리 코드를 흉내 내지 않아요. 아직 안 해 봤어요." 소망의 "할까요?"에 대한 답은 아직 없어요(인수인계를 먼저 달라고 했어요). **시작하기 전에 소망에게 진행해도 되는지 확인하세요.**

### 지금 브라우저가 보내는 길
- 연결 프로필: `phone2go.js askRoom`(1154줄 근처) · `askVia`(493줄 근처) · `ai.js askAIOnce`(528줄)가 `ctx().ConnectionManagerRequestService.sendRequest(profileId, messages, maxTokens, { stream: false, extractData: true, includePreset: true, includeInstruct: true, signal? }, overridePayload?)`를 불러요. 방에 추론 레벨을 골랐으면 `stLevelPayload`로 만든 값을 `overridePayload`로 얹어요.
- 실리 자신의 연결: `ai.js askAIOnce`(531~532줄)가 `ctx().generateRaw({ prompt, systemPrompt, responseLength })`를 불러요.

### 읽어야 하는 실리 코드 (실리 1.19.1, `<scratch>/ref-st/SillyTavern`. 한 줄도 빠짐없이)
- `public/scripts/extensions/shared.js` (788줄): `ConnectionManagerRequestService` 392줄~ — `getAllowedTypes` 402, `sendRequest` 423, `isProfileSupported` 579, `validateProfile` 605.
- `public/scripts/custom-request.js` (607줄): `TextCompletionService` 79줄~(`createRequestData` 86, `sendRequest` 118: `fetch(getGenerateUrl(...))` 120 · `fetch('/api/backends/text-completions/generate')` 147, `processRequest` 283), `ChatCompletionService` 421줄~(`createRequestData` 428, `sendRequest` 462: `fetch('/api/backends/chat-completions/generate')` 463, `processRequest` 544, `presetToGeneratePayload` 575).
- `public/script.js`: `generateRawData` 4000, `generateRaw` 4122. 여기서 불리는 것 전부(메인 API마다 갈라져요).
- `public/scripts/openai.js`: `sendOpenAIRequest` 3138, `createGenerationParameters` 2691~3128, `getReasoningEffort` 2545~2665.
- 서버: `src/endpoints/backends/chat-completions.js`(`/generate` 2242줄~), `src/endpoints/backends/text-completions.js`. 다리에 길을 더하려면 `src/server-startup.js` 176줄(`/api/backends/text-completions`).
- 전에 읽은 기록은 `docs/MARINARA-PORT.md`의 "추론 레벨 칩" 항목에 있어요. **그래도 다시 읽으세요**: 그때는 레벨만 봤어요.

### 생각해 둔 방법 (아직 해 보지 않았어요. 읽고 나서 틀리면 버리세요)
실리 자신의 코드를 끝까지 태우되, **보내는 순간만 가로채서** 요청을 받아 두는 것:
1. 브라우저에서 `liveKitRefresh` 때, 프로필 방이면 `ConnectionManagerRequestService.sendRequest`를, 실리 자신의 연결이면 `generateRaw`를 **자리표시 글**(지금의 `\u0001NA_SYSTEM\u0001` · `\u0001NA_USER\u0001` 같은 것)로 부르고, 그동안만 `window.fetch`를 감싸서 `/api/backends/.../generate`로 가는 요청의 주소와 몸통을 받아 두고 가짜 답을 돌려줘요. 진짜로는 안 보내요.
2. 받은 몸통에서 자리표시 글이 든 곳을 찾아 틀로 남겨요. 채팅 완성은 `messages` 안에, 텍스트 완성은 `prompt` 글 안에(지시 형식이 감싼 채로) 들어 있을 거예요. **자리표시 글이 그대로 한 번씩 안 나오면 틀을 만들지 않아요**(지금의 o1 처리와 같은 원칙).
3. 서버는 자리표시 글을 진짜 시스템 글 · 입력 글로 바꿔 넣어 같은 주소로 다리에 보내요.

미리 따져 볼 것:
- **가로채는 동안 다른 요청이 섞이지 않게.** 실리가 그사이 자기 요청을 보낼 수 있어요. 가로채는 범위를 그 호출로만 좁히는 방법을 실리 코드에서 찾으세요(예: `signal`, 호출 안에서만 켜는 표시). 못 좁히면 이 방법은 위험해요.
- **부작용.** `generateRaw`가 화면 · 이벤트 · 토큰 계산 · 로그를 건드리는지. 30초마다 불러도 되는지. 안 되면 "설정이 바뀌었을 때만" 다시 만들 방법이 필요해요(프리셋 · 프로필 · 메인 API가 바뀐 것을 뭘로 아는지).
- **비밀 칸.** 프로필 요청에 프록시 비밀번호(`proxy_password`), 사용자 헤더가 들어가요. 틀에 담지 말고 서버가 `settings.json`에서 읽어야 해요. 프로필의 프록시는 `settings.json`의 `proxies` · `selected_proxy`와 프로필의 `proxy` 칸에서 올 거예요: 실리 코드로 확인하세요.
- **텍스트 완성.** 주소가 `/api/backends/text-completions/generate`예요. 다리(`bridge.mjs`의 `POSTS`)에 길을 더하고, 답 읽기(`extractData`가 하는 일)를 서버에서 어떻게 할지 정해야 해요. 지금 `ai.js`는 `ctx().extractMessageFromData`가 없으면 채팅 완성 모양만 손으로 읽어요.
- **그림 첨부.** 프로필 길은 `profileTurn`이 그림을 `image_url`로 실어요. 자리표시 글만으로는 그림이 든 요청의 틀이 안 나와요.
- **`maxTokens` · 레벨.** 답장 한 번의 값은 `liveReplyPlan`에서. 프로필은 `Math.max(256, Number(how.maxTokens) || 8192)`예요(`askRoom`). 틀의 열쇠에 이 값들을 넣어 "같은 요청일 때만" 쓰게 하세요.
- **서버에서의 호출 자리.** 지금 서버는 `plan.t`가 null이면 400이에요. 틀이 있으면 `ctx().ConnectionManagerRequestService.sendRequest` · `ctx().generateRaw`의 서버 대역을 `contextOf`에 넣는 방법이 진짜 `askRoom` · `askAIOnce`를 안 고치는 길이에요(지금 `getSupportedProfiles`만 주고 있어요).
- 되는 것만 보이게: 틀이 없는 프로필 방은 지금처럼 이유를 알려요. `cannot`의 글을 바꿔야 해요.

### 끝났다고 말하기 전에
- `tests/pluginwork.test.mjs`에 프로필 방 · 실리 자신의 연결 방 테스트(지금은 "안 돌려요"를 확인하는 테스트가 있어요: 바꾸세요).
- `tools/plugin/stbrowser.cjs`를 프로필로도 돌려요. 진짜 실리가 만든 틀로 서버가 보내는 것까지 봐야 해요.
- `docs/MARINARA-PORT.md`의 스케줄러 줄 "마리나라와 다른 것 ①"과 `PHONE2-PLAN.md` 3-2b를 고쳐요.
- 디자인 세션에 줄 메시지: `why` 글이 바뀌는 것, 화면은 그대로인 것.

## 7. 확인하는 법

S = 이 세션의 scratch 폴더(세션마다 달라요. 없어졌으면 다시 만들어야 해요: 아래).

```
timeout 580 node --test tests/*.test.mjs                 # 1264개. "# fail 0"과 "# cancelled 0"
for f in tests/fuzz/*.mjs; do node $f | tail -1; done     # runs 5113 / 8663, problems 0
PHONE2_POISON=1 node --test tests/phonesyncdrop.test.mjs tests/archivedread.test.mjs tests/afterarchive.test.mjs tests/phonebranch.test.mjs   # 359
node $S/cmp.mjs                                           # "checked 328 diff 0" (scratch에 있어요)
npx eslint --no-config-lookup -c $S/lint/eslint.config.mjs src/phone2*.js src/ai.js
```

서버 쪽 테스트:
- `tests/pluginstore.test.mjs` 저장 · 길.
- `tests/pluginauto.test.mjs` 스케줄러(가짜 app 13개) + 진짜 저장 위의 app 5개.
- `tests/pluginwork.test.mjs` **일꾼을 실제로 띄워서** 10개(가짜 모델 HTTP 서버 · 가짜 다리).
- `tests/phone2beat.test.mjs` 브라우저 쪽 진짜 파일 + 진짜 일꾼을 한 저장에.
- `tests/phone2keep.test.mjs` 합치기 · 퍼즈. `tests/phone2kit.test.mjs` 묶음.

진짜 실리에서 (가짜 모델 서버를 스스로 띄워요. 진짜 모델을 안 불러요):
```
node tools/plugin/stsmoke.mjs <실리 폴더> <이 저장소>     # 브라우저 없이, 약 30초
node tools/plugin/stbrowser.cjs <실리 폴더>               # 진짜 브라우저(Playwright)까지, 약 3분
```
준비: 실리 1.19.1을 받아 `npm install`, `config.yaml`에서 `enableServerPlugins: true`,
`plugins/NarrativeArchive`와 `data/default-user/extensions/NarrativeArchive`를 이 저장소로 잇기(`ln -s`).
둘 다 `settings.json`과 `default_Seraphina.png`를 바꿔요: 돌리기 전에 복사해 두고 끝나면 되돌려요. `data/default-user/NarrativeArchive/orbit`도 지워요.
`stbrowser.cjs`의 페이지 오류 가운데 `Internal S…`는 실리의 Horde 요청(인터넷이 없어서)이라 걸러요.

고친 줄이 테스트에 잡히는지: 핵심 줄을 하나씩 빼고 테스트가 실패하는지 봐요. 고치던 파일은 `git checkout`으로 되돌리지 말고 복사해 두었다가 되돌려요.

## 8. 걸리기 쉬운 곳

- **테스트 로더**(`tests/phone2reflect.load.mjs`)는 `phone2go.js`의 이웃을 가짜로 바꿔 끼워요. `phone2go.js`가 새 파일을 불러오거나 `ai.js` · `core.js`에서 새 것을 가져오면 로더의 가짜에도 넣어야 해요(안 넣으면 `phone2go.test.mjs`가 통째로 안 불러져요).
- **격리 테스트**: `phone2go`라는 글자는 `phone2go.js` · `phone2tick.js` · `phone.js`에만 있어야 해요(주석도). `phone2store`를 부르는 파일은 `tests/phone2store.test.mjs`의 목록에 있어야 해요.
- **브라우저 쪽 진짜 파일을 Node에서 부르는 테스트**는 타이머가 남아 안 끝나요. `tests/phone2beat.test.mjs`처럼 `after(() => setTimeout(() => process.exit(…), 200).unref())`.
- **가짜 타이머 + 진짜 파일 읽기**가 섞인 테스트는 `performance.now()`로 기다려요(`Date` · `setTimeout`은 가짜).
- 마리나라 파일을 다시 가져올 때: scratch의 `port12.mjs`(스케줄러) · `port13.mjs`(알림) 방식. `node:module`의 `stripTypeScriptTypes`로 타입만 떼고, 바꾼 것은 `must(…)`로 한 줄씩 바꿔서 머리말에 적어요. 마리나라는 staging `32c47a1`(2026-11-20)이에요.
- `plugin/index.mjs`의 `/ping`이 일꾼을 켜요. 테스트에서 일꾼이 안 켜지는 것은 `globalThis.DATA_ROOT`가 없어서예요.
- 일꾼은 한 번에 한 세계만 돌려요(`withWorld`의 줄). `withWorld` 안에서 `withWorld`를 다시 부르면 멈춰요. `/auto/status`는 서버가 답장을 만드는 중이면 1분쯤 늦을 수 있어요.
- `auto.mjs open()`은 rev가 바뀌었을 때(브라우저가 저장) 그 세계의 방을 `reseedActivity`해요.
- 서버는 `settings.json`에 쓰지 않아요. 브라우저에서 설정을 바꾼 직후 1초쯤은 서버가 예전 설정을 봐요(실리가 늦게 저장해요).

## 9. 아직 확인 못 한 것 · 알려진 한계

- **진짜 모델로 안 돌렸어요.** 시험 세션의 일이에요.
- **폰(터묵스)에서 안 돌렸어요**: 속도, 메모리, 화면이 꺼졌을 때 안드로이드가 터묵스를 재우는지.
- 폰 화면 안의 띠 · 프사 방울 · "실리를 닫아도 옵니다" 줄은 코드만 읽었어요(디자인 세션도 플러그인이 도는 상태로는 못 봤어요).
- 다른 실리 채팅의 알림을 지금 채팅에서 띄우는 것은 없어요. 그 채팅을 열었을 때 떠요.
- 화면이 꺼진 폰을 깨우는 푸시 알림은 없어요.
- 카드 · 페르소나 · 롤플 끝은 브라우저가 마지막으로 남긴 것이에요.
- 서버는 이야기 요약본을 늘리지 않고, 스케줄 매주 갱신도 안 해요.
- 실리 버전이 올라가 `src/endpoints/…`의 자리가 바뀌면 다리가 안 열려요. 그때는 커스텀 API 방만 돌고, 실리 서버 창에 한 줄이 찍혀요.
- 실리 연결 방식의 답 읽기: 서버에는 실리의 `extractMessageFromData`가 없어서 `ai.js`가 OpenAI · Claude · Google 모양을 손으로 읽어요.
- PDF 첨부는 커스텀 API 길로만 가요(전부터).

## 10. 그 밖에 남은 일 (서버와 무관, `docs/MARINARA-PORT.md` "꼭 할 것")

- Merged 단체방의 지시문을 우리 것(`phone2reply.js`)으로.
- 대체 연결(fallback).
- 실리 연결 방식을 확장의 모든 모델 칸에(화면).
- "아직"인 마리나라 파일들: 캐릭터 명령(react · cross_post · memory …), 셀카, 영상 · 통화 · 음악, 스티커, 자동 요약, impersonate 등.
