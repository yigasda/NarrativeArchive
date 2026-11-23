# 서버 플러그인 인수인계 (2026-11-22, 3.230.0 · 연결 프로필 길까지. 2026-11-23: 늦은 답장을 마리나라처럼 · 실리의 것을 답장마다 새로)

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
src/phone2kit.js  묶음(kit): 어느 채팅인지                │ 저장 부탁          │ fetch('/api/…')
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
| `index.mjs` | 124 | 실리가 부르는 들머리(`info` · `init(router)` · `exit`). 길: `/ping`, `/store/load·rev·save·fork·drop`, `/auto/presence`, `/auto/status`, `/auto/claim` · `/auto/release`(방 자물쇠: 3-5), `/sound` · `/sound/upload` · `/sound/delete` · `/sound/file`(사용자 지정 알림음). 탭의 이름은 늘 `browser:…`로 바꿔요(탭이 일꾼 이름 `server`로 잡지 못하게). `globalThis.DATA_ROOT`가 있을 때만(=실리 서버 안) 일꾼을 켜요. 실리를 켰을 때 `src/users.js`로 사용자를 찾아, Orbit 저장이 있는 사람의 일꾼을 미리 켜요. `VERSION = 2`는 플러그인의 길 버전(확장 버전과 다른 것) |
| `store.mjs` | 123 | 조각 저장. `rev`가 저장마다 1씩 올라가고, 보낸 쪽이 본 `rev`(base)가 다르면 409. `list()` · `generation()`(쓴 횟수). 실리 · 익스프레스를 몰라요 |
| `code.mjs` (새, 2026-11-23) | 76 | 일꾼이 불러올 코드가 있는 곳. **실리의 확장 폴더**(사용자의 것 → 모든 사용자의 것, manifest의 이름 · 주소로 찾고 `plugin/worker.mjs`가 있어야 해요)를 먼저, 없으면 이 플러그인 폴더. `makeAutoFor`: 사용자마다 일꾼 하나, 확장의 버전이 바뀌면 다시 띄우고, 그 코드로 못 뜨면 그 판은 버리고 플러그인 폴더의 것으로. `WORKER_PROTO`: 일꾼과 본체가 주고받는 말의 판 |
| `host.mjs` | 52 | 본체 쪽. 사용자마다 일꾼 스레드 하나를 띄우고 말을 주고받아요(`code.dir`의 `plugin/worker.mjs`). 일꾼이 부탁하는 저장 일(`list` · `revOf` · `load` · `save`)을 대신 해요. `list` · `inject` · `sweep` · `unread`는 테스트와 손 확인용 |
| `worker.mjs` | 57 | 일꾼 스레드의 들머리. **순서가 중요해요**: `screen.mjs`를 먼저 불러야 해요. 전역 `fetch`를 바꿔서 `/`로 시작하는 주소를 다리로 넘겨요 |
| `screen.mjs` | 37 | 아무것도 안 하는 화면: `document` · `$` · `toastr` 등에 "뭘 시켜도 자기 자신을 돌려주는 것"을 둬요. `SillyTavern.getContext()`는 `setContext()`로 그때그때 바꿔 끼워요. 일꾼 스레드에서만 불러요(본체에서 부르면 오류. 테스트는 `NA_SCREEN_ANYWHERE=1`) |
| `stread.mjs` (새, 2026-11-23) | 236 | 실리 파일을 실리가 읽는 그대로(실리 코드를 옮긴 것): 채팅 파일(`getChatData`) · 헤더와 메시지(`getChat` · `getGroupChat`) · 그룹(`getGroups` · `validateGroup`) · 채팅을 열 때 고를 페르소나(`loadPersonaForCurrentChat`) · 그 페르소나의 이름과 설명(`selectCurrentPersona`). 다리가 없을 때: 카드 폴더(`readCards`: `character-card-parser.js read` · `getCharaCardV2` · `convertToV2` · `readFromV2` · `charaFormatData`, PNG 조각 읽기는 png-chunks-extract · png-chunk-text MIT) · 페르소나 그림 목록(`readImages`: `getImages`). 3-3 |
| `work.mjs` | 400 | 핵심. 실리의 것을 답장마다 새로(`stNow`, 3-3), 방 자물쇠(`claim` · `renew` · `release`, `liveGo`에 주는 `serverLock`), 실리의 것을 서버 것으로(`contextOf`), 연결 프로필 요청의 대역(`profileService`: `sendRequest`), 실리 연결 방식 · 추론 레벨의 대역(`stStandIn`), 한 번에 한 세계(`withWorld`), 돌려도 되나(`blocked` · `cannot`), 먼저 건 말 만들기(`generate`), 늦은 답장(`sweepDue`), 화면용 상태(`status`), 보고 있음(`presence`) |
| `sound.mjs` (새) | 184 | 사용자 지정 알림음(마리나라 `notification-sound.routes.ts`). `<사용자 폴더>/NarrativeArchive/notification-sounds/notification.<확장자>` 하나. 올리기는 실리의 multer가 `avatar` 칸을 받아 둔 임시 파일을 읽고 지워요(실리 `server-main.js` 269줄: 플러그인 길도 그 뒤에 붙어요) |
| `lock.mjs` (새) | 40 | 방 자물쇠 `makeLocks` · `lockKey(저장 id, 방 id)` (3-5) |
| `auto.mjs` | 151 | 마리나라 스케줄러가 아는 `app`을 플러그인 저장 위에 만들어요. `chats.list/getById/resolveConversationPresenceState/markAutonomousUnread`, `inject`(때가 됐나 · 답장 만들기), 읽어 둔 세계(`open`: rev가 그대로면 다시 안 읽음), 쓰기(`write`: 바뀐 조각만) |
| `bridge.mjs` | 58 | 127.0.0.1의 아무 포트에 실리 **자신의** 라우터를 붙여요. 실리를 켤 때마다 새로 만드는 토큰이 있어야 하고, 이 길만 열어요: `POST /api/backends/chat-completions/generate`, `POST /api/backends/text-completions/generate`, `POST /api/characters/all` · `/api/characters/get`(카드: 답장마다), `POST /api/characters/merge-attributes`, `POST /api/avatars/get`(페르소나 그림 목록), `POST /api/worldinfo/get`, `GET /user/files/…` |
| `log.mjs` | 30 | 마리나라 파일이 부르는 `logger` · `logRateLimited` |
| `marinara/server-autonomous-scheduler.service.js` | 488 | 마리나라 파일 **통째**. 고친 것은 맨 위 머리말에 적힌 네 가지뿐. 다시 만들 때는 스크립트로(아래 8장) |
| `marinara/autonomous-candidates.js` | 40 | 마리나라 파일 통째. 지금 부르는 곳은 테스트뿐 |

### 브라우저 쪽 (`src/`, 서버 때문에 생기거나 바뀐 것)

| 파일 | 하는 일 |
|---|---|
| `phone2kit.js` (새) | 서버가 읽을 묶음: 이 Orbit이 실리의 어느 채팅인지만. `buildKit(c, real, { version })` · `putKit` · `kitOf`. 서버가 고를 카드: `cardsFor(목록, real, { own, members })`(전에 묶음이 고르던 것과 같은 규칙). 실리 · 화면을 몰라요 |
| `stprofile.js` (새) | 연결 프로필의 요청 틀. 브라우저: `profileTemplates`(실리 자신의 `sendRequest`가 보내려는 요청을 받아 두기). 서버: `fillProfileRequest` · `readProfileAnswer` · `profileSecret`. 실리에서 옮긴 `extractMessageFromData` · `extractReasoningFromData` · `trimTextCompletion`. 열쇠: `ptKey` · `ptFind` · `ptWhyKey` · `levelKey` (4장) |
| `phone2keep.js` | 원래의 조각 저장에 더해: `merge3`(셋 비교 합치기) · `settleRooms`(순서 · 번호) · `into`(제자리 맞추기) · `sync` · 저장이 409면 합쳐서 다시(세 번째는 오류) |
| `phone2keepon.js` | `keepPersona`: 이 채팅의 페르소나(아바타 파일 이름)를 `m.stPersona`에 적어요. 실리의 `PERSONA_CHANGED`(빠른 전환기) · `CHAT_CHANGED`(실리가 고른 뒤: 실리의 이벤트는 차례로 기다려요) · `keepBeat` 때, Orbit이 있는 채팅만, 달라졌을 때만. `keepBeat`(30초마다 · 다시 보일 때 · 채팅 열 때) · `keepPing` · `keepSync` · `keepServes` · `keepAutoStatus` · `keepKept` · `keepClaim(방)` · `keepRenew`(방 자물쇠) · 맞춘 뒤의 화면 신호(`synced`) · 요청마다 시간 제한(`KEEP_LIMIT`) |
| `phone2sound.js` (새) | 사용자 지정 알림음: `soundStatus` · `soundUpload(File)` · `soundRemove` · `soundStart`(index.js). 부를 때마다 `setCustomNotificationSoundUrl` |
| `phone2tick.js` | 가려져 있고 일꾼이 돌면 쉬어요. 무엇이든 판단하기 전에 `keepSync`(플러그인의 최신 것). 30초마다 `liveKitRefresh`(요청 틀). 답장이 기다리는 시각에 한 번 더(`tickAt`: `phone2go.js setDueHook`으로 받아요) |
| `phone2run.js` | `runLive`의 `enter(방)`: 방마다 처음 한 번 그 방의 자물쇠를 받아요. 못 받은 방의 일은 이번엔 건너뛰고 기다려요 |
| `phone2go.js` | `liveGo(real, { lock })` · `browserLock`(들어가면 `keepSync`) · `retrySoon` · 먼저 건 말을 줄 세운 뒤 그 방에 다른 쪽이 말했으면 버리기(`wroteSince`) · `liveAutonomous`는 방마다 자물쇠 → 받기 → 판단 · `liveDigest(…, { lock })`. `replyRoute` · `liveReplyPlan`(`profile` · `raw`) · `liveKitRefresh`(`kit.st` · `kit.pt` · `kit.ptWhy` · `kit.levels`) · `liveServerStatus` · `liveServerOn` · `liveAutonomousUnread`. Orbit의 모델 요청에 `profileNow`. 먼저 건 말에 `extra.autonomous` 표시와 `na-live-auto` 신호. `keepUpStory`는 `ctx().naServer`면 안 해요. `gatherJob`이 `job.user`를 넘겨요 |
| `phone2sched.js` | `checkProactive(…, { userStatus })` · `contextBlock(…, { user })` · `intentWhy` · `restoreFollowups` · `reseedActivity` |
| `phone2snap.js` | `liveChatTail`: 브라우저와 서버가 같은 코드(서버는 실리 채팅 파일을 `ctx().chat`으로 받아요). 전의 `naTail`은 없어졌어요 |
| `phone2store.js` | `readLive`: 페르소나가 읽으면 `autonomousUnread*` 세 칸을 지워요 |
| `ai.js` | `stSourceData`(요청 만들기와 보내기를 나눔) · `stTemplateKey` · `stSourceTemplate` · `ST_TEMPLATE_SECRETS` · `aiProfileFor` · `askAI`의 `profileNow` · `stLevelPayload`의 서버 대역 자리(`levelPayload`) |
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

지금 주는 칸: `naServer` · `chat` · `chatMetadata` · `chatId` · `characters` · `characterId` · `groupId` · `groups` · `name1` ·
`powerUserSettings{personas, persona_descriptions, persona_description}` · `extensionSettings` · `ConnectionManagerRequestService.getSupportedProfiles` · `ConnectionManagerRequestService.sendRequest` ·
`chatCompletionSettings` · `mainApi` · `saveMetadata` · `saveSettingsDebounced`(아무것도 안 함) · `setExtensionPrompt`(아무것도 안 함) ·
`getRequestHeaders` · `writeExtensionField` · `loadWorldInfo`.
`chat` · `chatMetadata`(헤더의 것 + 우리 것) · `characters` · `characterId` · `groupId` · `groups` · `name1` · `persona_description`은 답장마다 실리에서 새로 읽어요(3-3).

### 3-3. 실리의 것은 답장마다 새로 · 묶음(kit)은 어느 채팅인지만 (2026-11-23)
소망: "실리에서 뭘 바꾸면 그게 마리나라처럼 바로 서버에 반영되어야 함, 무슨 경우든지". 전에는 브라우저가 30초마다 남긴 사본(카드 · 페르소나 · 롤플 끝 · 채팅 값)을 읽어서, 실리에서 고쳐도 그 채팅을 다시 열기 전에는 서버가 예전 것으로 답했어요.

지금은 `withWorld`마다(답장 · 먼저 말 걸기 판단 · 화면용 상태) `work.mjs stNow`가 실리 브라우저가 그 채팅을 열면 들고 있을 것을 새로 읽어요:

| 무엇 | 어디서 | 실리 코드 (1.19.1) |
|---|---|---|
| 롤플 메시지 → `ctx.chat` | 채팅 파일(`<root>/chats/<dir>/<id>.jsonl`, 그룹은 `<root>/group chats/<id>.jsonl`) | `chats.js getChatData` 577 · `script.js getChat` 7652~7660(첫 줄은 늘 헤더) · `group-chats.js getGroupChat` 265~272(`chat_metadata` 칸이 있을 때만 헤더) |
| 채팅 값 → `real.glossary` · `glossaryPeople` · `dateOrder` · `phoneScreenHolder` | 같은 파일 헤더의 `chat_metadata.narrative_archive` (실리는 1초 뒤 저장: `saveMetadataDebounced`) | `extensions.js` 89~113 |
| 카드 → `ctx.characters`(고른 것만) | 다리 `/api/characters/all`, 간단한 카드(`shallow`, `lazyLoadCharacters`)는 `/api/characters/get` | `characters.js` 1467 · 1481, `script.js getCharacters` 1294 · `getOneCharacter` 1223 |
| 그룹 → `ctx.groups` | `<root>/groups/<id>.json` | `group-chats.js getGroups` 758~790 · `validateGroup` 218~232(저장은 안 해요) |
| 페르소나 → `ctx.name1` · `persona_description` | 채팅에 적어 둔 `stPersona`, 없으면 실리 순서(채팅 잠금 → 연결 → 기본 페르소나 → `settings.json user_avatar`, 그림 목록은 다리 `/api/avatars/get`) + `settings.json`의 `personas` · `persona_descriptions` | `personas.js loadPersonaForCurrentChat` 1543~1640 · `getConnectedPersonas` 1674 · `selectCurrentPersona` 897~ · `script.js setUserName` 7873 |

- 카드 고르기는 전에 묶음이 고르던 것과 같아요(`phone2kit.js cardsFor`): 이 채팅의 캐릭터 · 그룹의 사람들 · 폰이 있거나 방에 있는 사람(이름으로) · 폰 프로필로 고른 카드, 실리 목록의 순서 그대로(이름이 같은 카드가 둘일 때 같은 카드가 먼저 나와요). 카드는 실리가 준 것 통째예요.
- `cardsOf`(마리나라 스케줄러의 수다 정도)도 `around` 안에서 지금 읽은 카드에서 찾아요.
- 페르소나 이름이 바뀌었으면 `withWorld`가 곧바로 `liveFollowPersona`: 실시간 폰의 "나"도 그 이름으로(브라우저는 폰을 열 때 해요).
- `writeExtensionField`는 실리 `extensions.js` 2070~2120 그대로: `UNSET_VALUE`면 지우기, `json_data`도 같이, 저장이 실패해도 던지지 않고 기록만(`확장 필드를 저장하지 못했습니다.`).
- 다리가 없거나 옛 다리라 그 길이 막혀 있으면(404: 플러그인 폴더를 안 받음) 카드와 페르소나 그림 목록은 실리 폴더에서 직접 읽어요(`stread.mjs readCards` · `readImages`: 실리 서버의 `/api/characters/all` · `/api/avatars/get`이 하는 것을 옮긴 것, PNG의 `ccv3` → `chara`). 그래서 커스텀 API 방은 다리 없이도 전처럼 돌고, 고친 카드도 바로 들어가요. 진짜 실리의 `/all`과 글자까지 같은지 대 봤어요(통계 칸 빼고).

**실리와 다른 점**
- 페르소나: 실리는 채팅을 **열 때 한 번** 고르고, 손으로 바꾼 페르소나(잠그지 않은 것)는 새로 고치면 기본 페르소나로 돌아가요. 우리 서버는 **그 채팅에서 마지막으로 쓴 페르소나**로 답해요(소망이 정함: 빠른 전환기로 자주 바꾸고, 그게 안 남으면 안 돼요). 브라우저가 `m.stPersona`에 적어 두고(`phone2keepon.js keepPersona`), 적어 둔 게 없는 옛 채팅만 실리 순서로 골라요.
- 한 캐릭터에 페르소나가 여럿 연결돼 있고 `persona_allow_multi_connections`가 켜져 있으면 실리는 묻는 창을 띄워요. 서버는 첫 번째를 써요(소망은 그렇게 안 써요).
- 실리 브라우저는 카드 이름에 `DOMPurify.sanitize`를 하고, 비어 있는 `chat` 칸을 채워요. 서버에는 DOMPurify가 없어서 이름을 그대로 써요(`chat` 칸은 답장 코드가 안 읽어요).
- 실리 브라우저는 메시지의 그림 칸을 목록으로 고쳐요(`ensureMessageMediaIsArray`). 답장 코드는 그림 칸을 안 읽어서 서버는 안 고쳐요.
- 읽기만 해요: 실리가 채팅을 열 때 하는 쓰기(잠금 풀기 · 없는 기본 페르소나 지우기 · 그룹에서 없는 사람 빼고 저장)는 안 해요.
- 실리가 1초 뒤에 저장하는 것(카드 편집 · 설정 · 그룹 · 채팅 값)은 그 1초 동안은 서버가 예전 것을 봐요.

**묶음 (kit)**: `m.live.kit`, 저장의 `live` 조각에 실려요. 브라우저가 30초마다 달라졌을 때만 다시 넣어요(`liveKitRefresh` → `putKit`).

```
kit = { v: 1, ver (확장 버전),
        chat: { avatar, group: { id }, file: { group, dir, id } },   // 이 Orbit이 실리의 어느 채팅인지
        st: { 틀의 열쇠: { data, secrets } },   // 실리 연결 방식의 요청 틀
        pt: { 틀의 열쇠: 틀 }, ptWhy: { [프로필, 얹는 값]: 못 만든 이유 },   // 연결 프로필의 요청 틀 (4장)
        levels: { [연결, 모델, 레벨]: 프로필 요청에 얹는 값 }, profiles: [실리가 보낼 수 있는 프로필 id] }
```
- 전의 `name1` · `persona` · `characters` · `tail` · `meta` · `chat.group.members`는 없어요(옛 묶음에 남아 있어도 서버가 안 읽어요).
- 요청 틀(`st` · `pt` · `levels`)은 아직 브라우저가 떠 둔 것이에요: 실리의 요청 만드는 코드가 브라우저 코드라서요. 이것도 서버에서 새로 만드는 것이 다음 일이에요(6~9).

### 3-4. 서버가 그 세계를 안 돌리는 때 (`work.mjs blocked`)
1. 묶음이 없음. 묶음에 있는 그룹 id · 채팅 이름이 이상함.
2. **플러그인 폴더의 코드로 돌 때만: 확장과 버전이 다름** (`kit.ver !== src/core.js VERSION`) → "서버 플러그인을 업데이트하고 실리를 다시 시작하세요". 2026-11-23부터 일꾼은 **실리의 확장 폴더의 코드**를 돌려요(`code.mjs`): 실리가 확장을 업데이트하면 일꾼도 그 버전으로 다시 떠요. 그 코드가 지금 설치된 확장이라, 페이지가 아직 옛것이어도 멈추지 않아요(소망: 새로 고치라고 하지 말 것).
   - 그 전에는 플러그인 폴더의 코드를 돌려서, 확장을 올릴 때마다(화면 파일만 바뀌어도) `plugins/NarrativeArchive`에서 `git pull` 하고 실리를 다시 켜야 했어요. 안 하면 서버가 아무것도 안 보냈어요(2026-11-23, 3.232.6).
   - 지금도 플러그인 폴더에서 `git pull`이 필요한 때: 본체 쪽 파일(`index.mjs` · `host.mjs` · `code.mjs` · `store.mjs` · `sound.mjs` · `bridge.mjs`)이 바뀌었을 때. **소망: 확장 업데이트만으로 돌아야 해요.** 그래서 다리에 새 길을 열면 일꾼은 옛 다리(그 길이 404)에서도 돌게 만들어요. 예: 3.232.11의 카드 목록 · 페르소나 그림 목록 길은 404면 실리 폴더에서 직접 읽어요(`work.mjs stNow`의 `viaSt`). 진짜 실리에서 플러그인 폴더만 3.232.10으로 끼우고 `stfresh.cjs`로 확인했어요. 일꾼과 본체의 말을 바꾸면 `WORKER_PROTO`를 올려요(다른 판의 일꾼은 안 써요).
3. **실리의 그 채팅 파일이 없음** (`<root>/chats/<dir>/<id>.jsonl`, 그룹은 `<root>/group chats/<id>.jsonl`) · 그룹 채팅인데 그룹 파일(`<root>/groups/<id>.json`)이 없음. 지운 채팅의 Orbit에 계속 말을 걸어 모델 비용이 나가지 않게.
4. 실리에서 읽지 못함(`stNow`: 다리가 없음 · 캐릭터 목록을 못 읽음). `/auto/status`는 그 이유를 방마다 돌려줘요.

방마다 안 되는 때는 `cannot`(4장)이에요. 이유는 `/auto/status`로 화면에 가요.

### 3-5. 브라우저와 서버가 번갈아 돌아요
둘이 같이 돌면 말이 두 번 나와요.

- 브라우저: 보이는 동안 30초마다 `/auto/presence`. 가려지면 안 알려요(마리나라의 폴링도 가려지면 쉬어요).
- 서버의 **먼저 말 걸기**(스케줄러): 75초 안에 알림이 있었던 방에는 안 걸어요(마리나라의 값 `RECENT_CLIENT_PRESENCE_MS`).
- 서버의 **늦은 답장**: 알림과 상관없이 때가 되면 바로 보내요(2026-11-23). 마리나라는 서버가 그 요청 안에서 늦음을 기다렸다가 만들고, 브라우저 연결이 끊겨도 계속해요(`conversation-presence-runtime.ts` 254~321 · `generate.routes.ts` 1924~1934). 전에는 여기에도 75초 규칙을 걸어서, 화면을 끄고 조금 뒤에 돌아오면 브라우저가 그때 만들기 시작해 "입력 중" 뒤에 왔어요.
- 가려진 탭: 일꾼이 돌면(`keepServes`) 브라우저 틱이 쉬어요. 일꾼이 없으면 전처럼 브라우저가 다 해요.
- 다시 보이면: 알리고 → 서버가 쓴 것을 받아요(`keepSync`).

**방 자물쇠 (2026-11-22, `plugin/lock.mjs`).** 그날 생긴 일: 화면이 꺼진 동안 서버가 07:18에 늦은 답장을 보냈는데, 화면을 켜자마자 브라우저의 30초 틱이 서버 것을 받기 전의 사본으로 같은 말에 또 답했어요(07:26). 알림(`presence`)만으로는 깨어나는 순간을 못 막아요.
- 마리나라: 답장을 만드는 곳이 서버 하나. 채팅마다 자물쇠 하나(`generate.routes.ts activeGenerations`: 만들기 시작할 때 걸고, 끝나면 자기 것일 때만 풀고, 걸려 있으면 둘째 요청은 409). 스케줄러는 자물쇠가 걸린 채팅을 건너뛰고, 409는 실패로 안 세요. 시간 제한은 없어요.
- 우리: 브라우저도 답장을 만들어서, 자물쇠를 일꾼 안에 두고 **둘 다** 받아요. 열쇠는 `저장 id/방 id`(마리나라의 채팅 하나 = 우리 방 하나).
  - 일꾼: 먼저 건 말(`generate`)은 그 방을 먼저 잡고(못 잡으면 409), 잡은 뒤 저장을 다시 읽어요. `liveGo`에는 `serverLock`을 줘서 늦은 답장 · 주고받기 · 오래된 대화 요약도 방마다 잡아요. 브라우저가 쥔 방은 이번엔 건너뛰어요(그 일은 기다려요).
  - 브라우저: `liveGo`의 `browserLock` → `runLive`의 `enter(방)`: 방마다 처음 한 번 `/auto/claim`, 받으면 곧바로 `keepSync`(일꾼이 그사이 쓴 것이 먼저 들어와요), 못 받으면 그 방은 건너뛰고 `LIVE_GO.retryMs`(1초) 뒤 다시(일꾼이 끝내면 곧 보이게). 답장 하나마다 `renew`. 끝나면 다 놓아요. 먼저 말 걸기 판단(`liveAutonomous`)도 방마다 잡고 → 받고 → 판단하고 → 줄 세운 것을 저장한 뒤에 놓아요. 30초 틱은 무엇이든 판단하기 전에 `keepSync`.
  - 먼저 건 말을 줄 세운 뒤 그 방을 기다리는 사이에 다른 쪽이 먼저 걸었으면(그 방에 캐릭터의 말이 `job.at` 뒤에 있으면) 버려요(`wroteSince`). 마리나라는 판단하는 순간 서버 한 곳에 "만드는 중" 표시를 남겨서 둘째가 아예 안 생기지만, 우리는 그 표시가 브라우저와 일꾼에 **따로** 있어서 서로 안 보여요.
  - **마리나라와 다른 점**: 탭이 쥔 자물쇠는 5분 동안 소식(잡기 · 이어 잡기)이 없으면 풀려요. 탭은 일하다 닫힐 수 있어서예요(5분은 마리나라의 "만드는 중" 표시가 풀리는 시간 `GENERATION_TIMEOUT_MS`). 일꾼의 것은 마리나라처럼 시간 제한이 없어요(일꾼이 멈추면 같이 사라져요).
  - 플러그인이 없거나 옛것이거나 답하지 않으면 `keepClaim`은 늘 받은 것으로 해요: 전처럼 브라우저가 다 하고, 저장의 rev가 부딪힘을 막아요.
- 플러그인 요청마다 시간 제한(`KEEP_LIMIT`: 15초, 저장 조각은 60초). 화면이 꺼질 때 걸린 요청이 남아서 다시 켰을 때 받기 · 알리기를 막지 않게요.
- 저장하다 부딪혀 합친 경우에도(`pushNow` → `syncNow`) 받은 경우와 같이 화면 신호(`na-live-change`, 늘어난 먼저 건 말이 있으면 `na-live-auto`)가 가요(`phone2keepon.js synced`).
- 서버가 쓴 늦은 답장(먼저 건 말이 아닌 것)을 받으면 `na-live-reply`(`from: 'server'`)도 가요. 브라우저가 만든 답에도 같은 신호(`from: 'browser'`, 3-4는 `PHONE2-PLAN.md`).

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
| 연결 프로필 (`profile:<id>`) | 됨 (틀이 있을 때) | 아래 "연결 프로필의 요청 틀" |
| 실리 쪽 (`'ai'` 칸이 `st` 방식) | 됨 (실리에서 고른 프로필이 있을 때) | ⚙ 설정에서 고른 프로필, 없으면 실리의 연결 관리자에서 지금 고른 프로필로 보내요 (`ai.js aiProfileFor`). 고른 프로필이 하나도 없으면 안 됨: 실리의 `generateRaw`는 브라우저 코드예요 |

**실리 연결 방식의 요청 틀**: 요청을 실리의 **브라우저** 코드 `createGenerationParameters`(`public/scripts/openai.js` 2691~3128)가 만들어요.
서버에는 그 코드가 없어서, 브라우저가 미리 "메시지만 빠진 요청"을 만들어 `kit.st`에 남겨요(`ai.js stSourceTemplate`).

- 열쇠(`stTemplateKey`): 연결 · 모델 · 길이 · 온도 · top_p · 레벨 · 생각 보기. **같은 요청일 때만** 그 틀을 써요. 값이 하나라도 다르면 틀을 못 찾고 오류(지어내지 않음).
- 틀을 만드는 값은 `liveReplyPlan` 하나에서 나와요: `maxTokens = LIVE_GO.replyTokens(4000)`, `effort = 방의 레벨 || 'low'`, `thoughts = effort !== 'none'`. `askRoom`도 같은 `replyRoute`를 봐요. **둘이 어긋나면 서버가 틀을 못 찾아요**: `tests/phone2go.test.mjs`의 "실리 연결 방식으로 나가는 방마다 요청 틀" 테스트가 실제 보낸 값과 대 봐요.
- 채워 넣은 메시지가 그대로 나오는지(`\u0001NA_SYSTEM\u0001` · `\u0001NA_USER\u0001`) 확인해요. 실리가 메시지를 고쳐 보내는 모델(o1: 시스템 → 유저)은 틀을 안 만들어요.
- 비밀 칸(`proxy_password` · `custom_include_headers`)은 틀에 안 담고, 서버가 보낼 때 `settings.json`의 `oai_settings`에서 읽어요. 그 값에 `{{`가 있으면 서버는 못 보내요(실리가 브라우저에서 매크로를 채우는 칸).
- 서버 쪽 대역: `work.mjs stStandIn`이 `globalThis.__naStOpenai`에 `{ oai_settings, createGenerationParameters }`를 둬요. 진짜 `ai.js`는 이 전역이 있으면 `/scripts/openai.js` 대신 이걸 써요(테스트도 같은 자리를 써요).

**연결 프로필의 요청 틀** (`src/stprofile.js`, `PHONE2-PLAN.md` 3-2c에 자세히):
- 브라우저(`liveKitRefresh` → `profileTemplates`)가 실리 자신의 `ConnectionManagerRequestService.sendRequest`를 답장 코드와 **같은 인자**로, 메시지 · 답 길이만 자리표시로 바꿔 불러요. `fetch`를 한 번 감싸 두고(풀지 않아요) 몸통에 자리표시의 표시가 든 요청만 받아 두고 빈 답을 돌려줘요. 실리의 다른 요청은 그대로 나가요.
- 두 번 떠서 비교해요(자리표시 · 그 길이 · 답 길이를 바꿔서). 답 길이만 다른 칸은 자리를 적고(`max`), 다른 것이 다르면 틀을 안 만들어요(이유는 `kit.ptWhy` → `cannot`).
- 비밀 칸(`PT_SECRETS`)은 빼고, 브라우저에서 실리 설정의 값과 같은지 확인해요(다르면 매크로: 안 만들어요). 서버는 `profileSecret`(프로필의 프록시 → 프리셋 → `oai_settings`, 실리 코드의 순서)으로 `settings.json` · `OpenAI Settings/<프리셋>.json`에서 읽어요.
- 틀에 그때의 프로필(`of`)이 있어요. 서버는 `settings.json`의 프로필이 그것과 다르면 안 보내요.
- 서버의 프로필 목록은 브라우저가 남긴 `kit.profiles`(실리의 `getSupportedProfiles`: 실리가 보낼 수 있는 종류만)로 걸러요. 브라우저와 같은 목록이라 "고른 프로필 없음"도 같아요.
- 열쇠는 `[프로필 id, 얹는 값(JSON), 모양]`. 채팅 완성은 모양 `'*'`(메시지를 통째로 바꿔 넣어요), 글 완성은 `'su'` · `'u'`(지시 형식이 역할마다 감싸요).
- 방의 추론 레벨을 얹는 프로필 요청: `askRoom`이 `stLevelPayload`를 불러요. 서버에는 `createGenerationParameters`가 없어서 브라우저가 만든 값(`kit.levels`)을 `stStandIn.levelPayload`가 돌려줘요.
- 서버의 `sendRequest` 대역은 실리 것처럼 프로필을 찾고(`Profile not found`), 보낸 뒤의 오류는 `API request failed`로 감싸요(원인은 `cause`). 틀이 없거나 프로필이 바뀐 것은 감싸지 않고 이유 그대로 던져요.

**프로필 방을 초안 모델로 답하지 않게**: `replyRoute`는 방의 `connectionId`가 목록에 없으면 "안 고른 방"으로 봐요. 서버에서는 프로필 목록이 비어서, 프로필 방이 초안 모델로 답할 뻔했어요. 그래서 `contextOf`가 `settings.json`의 `extension_settings.connectionManager.profiles`로 `getSupportedProfiles()`를 줘요. **이 줄을 빼면 다른 모델로 답해요**(테스트가 지켜요).

## 5. 일이 흘러가는 순서

### 먼저 건 말 (서버)
1. 스케줄러: 일꾼이 뜬 지 20초 뒤 첫 판, 그 뒤 60초마다. 한 번에 2방까지, 덜 본 방부터.
2. `app.chats.list()`: 저장을 전부 훑어요. 켠 세계(`w.presence.on`)만 스케줄러가 봐요. `blocked`인 세계는 목록에 없어요.
3. 75초 안에 브라우저 알림이 있던 방 · 답장을 만들고 있는 방은 건너뛰어요.
4. `/api/conversation/autonomous/check` → `auto.mjs inject` → `phone2sched.js checkProactive`(내 상태 `idle` · 후속 2번 · `source: 'server'`).
5. 오프라인이면 그만. 바쁘면 그 늦음만큼 타이머. 꺼 둔 이유 · 쉬는 시간이면 그만.
6. `/api/generate` → `work.mjs generate`: 그 방의 자물쇠(브라우저가 쥐고 있으면 409) → 저장을 다시 읽기 → `cannot` 확인 → 방에 답장이 이미 줄 서 있으면 409(마리나라의 생성 자물쇠는 늦음을 기다리는 동안에도 걸려 있어요) → 줄 세우기(`auto` · `timed` · `user: { status: 'idle', activity: 'away or offline' }` · `intent` · `why`) → `G.liveGo(real, { server: true })`. 서버는 캐릭터끼리 주고받기를 안 해요(마리나라의 서버 스케줄러도 안 해요: 브라우저만).
7. 답: 말이 나왔으면 `message_saved` + `done`, 안 나왔으면 `generation_discarded` + `done`, 실패면 `error`(`liveGo`의 `autoError`). 쉬는 것은 스케줄러가 해요(`recordFailureBackoff`: 5분부터 두 배 · 4xx는 30분씩). 서버가 못 돌리는 방은 400.
8. 스케줄러가 `markAutonomousUnread`: 방에 `autonomousUnreadCount` · `autonomousUnreadCharacterIds` · `autonomousUnreadAt`.

### 늦은 답장 (서버)
마리나라: 서버가 그 요청 안에서 늦음을 기다렸다가 그 시각에 바로 만들어요. 브라우저가 보고 있는지는 안 봐요. 우리: 답장이 줄에 있어서 일꾼이 그 줄을 돌려요.
`work.mjs sweepDue`: 30초마다, 기다리는 답장이 있으면 가장 이른 그 시각에(`nextDue`), 브라우저가 저장하면 1초 뒤에(`poke`: `/store/save` → `wrote`). 때가 된 `waiting` 답장이 있는 세계를 `liveGo`(`serverLock`, `server: true`)로 돌려요. 브라우저가 쥔 방 · 서버가 못 보내는 방(`cannot`)은 그 방만 건너뛰어요(그 방은 브라우저가 보내요).
브라우저도 그 시각에 틱을 한 번 더 돌려요(`phone2tick.js tickAt`). 둘 중 방을 먼저 잡은 쪽이 만들고, 다른 쪽은 1초마다 다시 봐서 끝나면 받아요.

### 브라우저가 다시 보일 때
`keepBeat` → `keepPing` → `keepSync` → 바뀌었으면 방마다 `reseedActivity` → `na-live-change` → 안 읽음이 늘어난 방이 있으면 `na-live-auto`(`from: 'server'`).
틱이 알림보다 먼저 돌아도(그날의 순서) 틱이 먼저 `keepSync`하고, 방마다 자물쇠를 받은 뒤 또 받아요(3-5). 서버가 그 방에서 만드는 중이면 브라우저는 5초 뒤 다시 해요.

## 6. (됐어요, 2026-11-22) 연결 프로필 · 실리 쪽 방을 서버에서 되게 (소망: "이 루트를 제일 자주 씀")

**한 것**: 4장의 표와 "연결 프로필의 요청 틀", `PHONE2-PLAN.md` 3-2c. 소망과 정한 것: 실리 쪽 방은 "실리에서 지금 고른 프로필"로 보내요(브라우저도 서버도). 아래는 시작할 때 적어 둔 계획이에요(기록으로 남겨 둬요).

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
timeout 580 node --test tests/*.test.mjs                 # 1327개. "# fail 0"과 "# cancelled 0"
for f in tests/fuzz/*.mjs; do node $f | tail -1; done     # runs 5113 / 8663, problems 0
PHONE2_POISON=1 node --test tests/phonesyncdrop.test.mjs tests/archivedread.test.mjs tests/afterarchive.test.mjs tests/phonebranch.test.mjs   # 359
node $S/cmp.mjs                                           # "checked 328 diff 0" (scratch에 있어요)
npx eslint --no-config-lookup -c $S/lint/eslint.config.mjs src/phone2*.js src/ai.js
```

서버 쪽 테스트:
- `tests/pluginstore.test.mjs` 저장 · 길. `tests/plugincode.test.mjs` 일꾼이 불러올 코드(확장 폴더 찾기 · 판 · 버전이 바뀌면 다시 띄우기).
- `tests/pluginauto.test.mjs` 스케줄러(가짜 app 13개) + 진짜 저장 위의 app 5개.
- `tests/pluginwork.test.mjs` **일꾼을 실제로 띄워서** 29개(가짜 모델 HTTP 서버 · 가짜 다리 `tests/stbridge.mjs`: 카드 목록 · 카드 하나 · 페르소나 그림 목록). "실리에서 바로" 다섯 개가 카드 고침 · 간단한 카드 · 롤플 새 메시지 · 페르소나(적어 둔 것 · 채팅 잠금 · 지금 것) · 그룹 · 확장 칸 쓰기 실패를 봐요. 연결 프로필은 `tests/stfake.mjs`(실리의 `sendRequest`를 실리 코드의 순서대로 흉내 낸 것)로 틀을 떠요.
- `tests/pluginstread.test.mjs` 실리 파일 읽기(채팅 파일 · 헤더 · 그룹 · 페르소나 고르기 · 이름과 설명 · 다리가 없을 때의 카드 PNG · 페르소나 그림 목록).
- `tests/stprofile.test.mjs` 프로필 틀 · 채우기 · 답 읽기. `tests/aiprofile.test.mjs` 지금 고른 프로필.
- `tests/phone2beat.test.mjs` 브라우저 쪽 진짜 파일 + 진짜 일꾼을 한 저장에.
- `tests/phone2wake.test.mjs` 2026-11-22에 생긴 일 그대로(화면이 꺼진 동안 서버가 답함 → 켜자마자 틱 → 또 답하지 않음), 서버가 만드는 중에 깨어남, 브라우저가 만드는 중의 서버, 먼저 건 말이 겹침, 걸린 요청의 시간 제한.
- `tests/pluginlock.test.mjs` 방 자물쇠. `tests/pluginsound.test.mjs` 알림음 저장 · 길. `tests/phone2run.test.mjs`의 `enter`.
- `tests/phone2keep.test.mjs` 합치기 · 퍼즈. `tests/phone2kit.test.mjs` 묶음 · 카드 고르기. `tests/phone2wake.test.mjs` 끝의 `keepPersona`.

진짜 실리에서 (가짜 모델 서버를 스스로 띄워요. 진짜 모델을 안 불러요):
```
node tools/plugin/stsmoke.mjs <실리 폴더> <이 저장소>     # 브라우저 없이, 약 30초
node tools/plugin/stbrowser.cjs <실리 폴더>               # 진짜 브라우저(Playwright)까지, 약 3분
node tools/plugin/stprofile.cjs <실리 폴더>               # 진짜 연결 프로필 셋(채팅 완성 + 프록시 · 지금 고른 프로필 · 글 완성), 약 5분
node tools/plugin/stfresh.cjs <실리 폴더>                 # 실리에서 사람이 하듯 페르소나 바꾸기(setUserAvatar) · 카드 설명 고치기(편집 칸) · 롤플 메시지(/send) → 가린 탭에서 서버의 다음 답장 요청에 셋 다 들어가는지, 약 1분. 설정 · 카드 · 채팅 파일 · 페르소나 그림을 스스로 되돌려요
node tools/plugin/stwake.cjs <실리 폴더>                  # 그날의 순서 그대로(가려진 동안 서버의 늦은 답장이 그 시각에 → 보이자마자 틱) + 보이는 동안의 늦은 답장(한 번, 그 시각 바로 뒤) + 실리 라우터를 거친 방 자물쇠 · 알림음 올리기(실리의 multer) · 서버 답장 신호 · 일꾼이 확장 폴더의 코드로 도는지, 약 1분
```
`stprofile.cjs`는 `settings.json` · 카드를 스스로 복사해 두고 되돌려요. 서버가 보낸 요청과 실리가 브라우저에서 같은 메시지로 보낸 요청이 글자까지 같은지 봐요.
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
- 일꾼은 확장 폴더의 코드로 떠요(`code.mjs`). 일꾼 쪽 파일(`worker.mjs` · `work.mjs` · `auto.mjs` · `screen.mjs` · `lock.mjs` · `log.mjs` · `marinara/` · `src/`)은 확장 업데이트로 바뀌어요. 본체 쪽 파일과 말이 안 맞게 바꾸지 마세요(바꾸면 `WORKER_PROTO`).
- 방 자물쇠는 일꾼 안에 있어요: 일꾼이 다시 뜨면 비어요. `generate`가 잡은 방을 `liveGo`의 `serverLock`이 또 잡아요(같은 쪽이라 겹쳐 잡기: 센 만큼 놓아요).
- 일꾼은 한 번에 한 세계만 돌려요(`withWorld`의 줄). `withWorld` 안에서 `withWorld`를 다시 부르면 멈춰요. `/auto/status`는 서버가 답장을 만드는 중이면 1분쯤 늦을 수 있어요.
- `auto.mjs open()`은 rev가 바뀌었을 때(브라우저가 저장) 그 세계의 방을 `reseedActivity`해요.
- 서버는 `settings.json`에 쓰지 않아요. 브라우저에서 설정을 바꾼 직후 1초쯤은 서버가 예전 설정을 봐요(실리가 늦게 저장해요).

## 9. 아직 확인 못 한 것 · 알려진 한계

- **진짜 모델로 안 돌렸어요.** 시험 세션의 일이에요.
- **폰(터묵스)에서 안 돌렸어요**: 속도, 메모리, 화면이 꺼졌을 때 안드로이드가 터묵스를 재우는지.
- 폰 화면 안의 띠 · 프사 방울 · "실리를 닫아도 옵니다" 줄은 코드만 읽었어요(디자인 세션도 플러그인이 도는 상태로는 못 봤어요).
- 다른 실리 채팅의 알림을 지금 채팅에서 띄우는 것은 없어요. 그 채팅을 열었을 때 떠요.
- 화면이 꺼진 폰을 깨우는 푸시 알림은 없어요.
- 서버는 이야기 요약본을 늘리지 않고(롤플 메시지는 읽지만, 요약을 얹을 아카이브 글은 안 읽어요), 스케줄 매주 갱신도 안 해요.
- 요청 틀(실리 연결 방식 · 연결 프로필 · 추론 레벨)은 아직 브라우저가 떠 둔 것이에요. 프리셋 · 실리의 채팅 완성 설정을 바꾸고 곧바로 실리를 닫으면 예전 틀로 가요(6~9에서 서버가 직접 만들게 할 일).
- 실리 버전이 올라가 `src/endpoints/…`의 자리가 바뀌면 다리가 안 열려요. 그때는 커스텀 API 방만 돌고(카드는 카드 폴더에서 직접 읽어요), 실리 서버 창에 한 줄이 찍혀요.
- 실리 연결 방식의 답 읽기: 서버에는 실리의 `extractMessageFromData`가 없어서 `ai.js`가 OpenAI · Claude · Google 모양을 손으로 읽어요. (연결 프로필 길은 `stprofile.js`에 옮겨 둔 실리 것을 써요.)
- 연결 프로필: 틀을 뜬 뒤 30초 안에 프리셋 · 실리의 채팅 완성 설정을 바꾸고 곧바로 실리를 닫으면 서버는 예전 틀로 보내요(프로필 자체가 바뀐 것은 알아채요). 실리가 메시지를 고쳐 보내는 모델 · 요청마다 값이 달라지는 연결 · 글 완성 프로필로 그림이 든 요청 · 사용자 헤더의 매크로는 서버에서 못 보내요(이유를 알려요).
- 실리 쪽 방이 실리에서 고른 프로필로 가면서, 실리의 `generateRaw`가 하던 것(우리 글의 `{{char}}` 같은 매크로 바꾸기, 정규식 확장 등으로 답 고치기)은 Orbit의 요청에서 빠졌어요. 방에 프로필을 고른 방은 원래 이랬어요.
- PDF 첨부는 커스텀 API 길로만 가요(전부터).

## 10. 그 밖에 남은 일 (서버와 무관, `docs/MARINARA-PORT.md` "꼭 할 것")

- Merged 단체방의 지시문을 우리 것(`phone2reply.js`)으로.
- 대체 연결(fallback).
- 실리 연결 방식을 확장의 모든 모델 칸에(화면).
- "아직"인 마리나라 파일들: 캐릭터 명령(react · cross_post · memory …), 셀카, 영상 · 통화 · 음악, 스티커, 자동 요약, impersonate 등.
