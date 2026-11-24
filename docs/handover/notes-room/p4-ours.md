# Orbit 채팅 설정을 방마다로 옮기기 위한 조사

코드는 하나도 고치지 않았어요. 마리나라 원본은 scratchpad의 `ref-marinara-stg`에서 확인했어요(`chat.ts` · `chat-preset.ts` · `CharacterScheduleEditorModal.tsx` · `chats.routes.ts`). 확인한 부분만 읽었고, 파일 전체를 읽지는 않았어요.

## 한눈에

- **지금 저장 자리:** 채팅 설정은 거의 다 Orbit에 하나뿐이에요(`w.presence.on` + `w.presence.meta`). 열쇠 이름은 마리나라의 채팅 메타 이름을 그대로 써요.
- **이미 방마다인 것:** 방의 모델(`room.connectionId` · `room.model`)과 추론 레벨의 "이 채팅" 값(`room.chatParameters`)이에요.
- **서버:** 스케줄러는 이미 방마다 줄을 받아요(`plugin/auto.mjs:70`). 다만 그 줄을 채울 때 Orbit 값을 읽어요(`auto.mjs:65-69`).
- **화면:** 모든 화면이 `realM`만 넘겨요. 방 id는 이미 있어요(`setUi` 안의 `r.id`, 그 밖에는 `obRoomId()`, `phone.js:1085`).

## 1. 열쇠마다: 어디에 있고, 누가 읽고, 방을 아는가

✓는 그 자리에서 방(job.room · roomId)을 이미 갖고 있다는 뜻이에요. ✗는 지금은 방 없이 읽는다는 뜻이에요.

| 우리 열쇠 | 지금 저장 | 읽는 곳 (파일:줄) | 방을 아나 | 마리나라 |
|---|---|---|---|---|
| `presence.on` (자율 메시지) | Orbit | 쓰기 `phone2sched.js:124`<br>`checkProactive` :200 ✓, `autonomousOptions` :405 (화면)<br>`phone2go.js:703` `liveAutonomous` 입구 ✗ (그 아래 :707부터 방마다 돎)<br>`phone2tick.js:31` 틱 입구 ✗<br>서버: `plugin/auto.mjs:68` ✓, `server-autonomous-scheduler.service.js:68` ✓ | 대부분 ✓ | `autonomousMessages` (채팅마다) |
| `meta.autonomousDailyCapOverride` | Orbit | 쓰기 `phone2sched.js:390-394`<br>`checkProactive` :200 · `groupCandidates` :513 · `groupHandoff` :541-548 ✓<br>화면 `phone.js:406, 1170, 1454` | ✓ | 같은 열쇠 |
| `meta.groupChatMode` | Orbit | 쓰기 `phone2sched.js:396`, `groupMode` :491<br>→ `phone2go.js:343` (`pickResponders`, 방마다 돎) ✓<br>→ `phone2go.js:1116` (프롬프트 보기) ✓<br>화면 `phone.js:406, 1168, 1379` | ✓ | 같은 열쇠 |
| `meta.groupResponseOrder` | Orbit | 쓰기 `phone2sched.js:398-401`, `groupOrder` :488<br>→ `phone2go.js:348, 352`, `phone2sched.js:521` ✓<br>화면 `phone.js:421, 1382` | ✓ | 같은 열쇠 |
| `meta.groupTurnPromptEnabled` | Orbit | 쓰기 `phone2sched.js:402`, `groupTurnPrompt` :489<br>→ `phone2go.js:384` ✓<br>화면 `phone.js:421, 1383` | ✓ | 같은 열쇠 |
| `meta.characterExchanges` | Orbit | 쓰기 `phone2sched.js:397`<br>`phone2go.js:687` `exchangeAfter` ✓<br>`marinara/autonomous-check.js:341` (`checkExchangeFor` :414로) ✓<br>화면 `phone.js:1167` | ✓ | 같은 열쇠 |
| `meta.conversationSchedulesEnabled` | Orbit | `schedulesOn` `phone2sched.js:87` → `activeSchedule` :90을 거쳐 아래 모두가 읽어요 | 섞임 | 같은 열쇠 (채팅마다) |
| ↳ 방을 아는 곳 | | `contextBlock` :159 · `checkProactive` :201 · `checkExchangeFor` :415 · `groupCandidates` :510 · `groupHandoff` :544 · `auto.mjs:99` | ✓ | |
| ↳ 일(job)에 방은 있는데 안 넘기는 곳 | | `replyDelay` :138 (`phone2go.js:507`) · `stateFor` :235 · `gatherJob` :385 · Merged :446 · `takeStatus` :312 | ✓로 바꿀 수 있음 | |
| ↳ 방이 없는 곳 | | `statusNow` :128 (`liveStatus` `phone2go.js:529`) · `followSchedule` `phone2go.js:549-555` (폰 상태가 스케줄을 따름: 폰마다) · `phone2tick.js:31` | ✗ | |
| `meta.characterCommands` · `conversationCommandToggles` | Orbit | `commandOn` `phone2go.js:1308`<br>→ :385 `gatherJob` ✓<br>→ :211 답 읽기(`parse`) ✗: `runLive`가 parse에 일을 안 넘겨요 (`phone2run.js:136`)<br>`liveCommands` · `liveSetCommands` :1309-1324 | :211만 ✗ | 같은 열쇠 |
| `meta.imageCaptioningEnabled` · `…ConnectionId` · `…Prompt` | Orbit | `phone2go.js:1363-1378`<br>`captioningOf(real, roomId)` :1382 ← :1402 ✓<br>서버 `plugin/work.mjs:424` `usesSt` ✗ | 거의 ✓ | 같은 열쇠 (`chat-preset.ts:255-257`) |
| 번역 열쇠 10개 + 옛 2개 (`translationTargetLang` · `translationPrompt`) | Orbit (`phone2translate.js:36` `metaOf`) | `translationConfigOf(real, roomId)` :79 ← `phone2go.js:218` · `work.mjs:312` · :285 · :339 · :429 · :462 · :542 · :556 ✓<br>`liveTranslationView` :481 ✓ · `livePrepareInput` :540 ✓ · `phone.js:1819` ✓<br>`autoTranslateOn(real)` :81 — 부르는 곳(:218 · :402 안쪽 · :428)은 방을 앎<br>`autoTranslationConnection` :436 ✗ (`work.mjs:417`)<br>기본값 저장 `liveSaveTranslatorDefaults` :145-155 ✗<br>새 Orbit 기본값 `setWorldSeed` :157-162 | 대부분 ✓ | 같은 열쇠 (채팅마다) |
| `meta.reasoningEffort` ("Orbit 전체") | Orbit | `liveReasoning(real, roomId)` `phone2go.js:1458` · 쓰기 :1515 | ✓ | **없음.** 마리나라는 `chatParameters` 하나(채팅마다)뿐이라, 이건 우리가 더한 값이에요 |
| `room.chatParameters.reasoningEffort` ("이 채팅") | 방 | `phone2go.js:1458, 1513` | ✓ | `chatParameters` |
| `room.connectionId` · `room.model` | 방 | `phone2go.js:1151-1183` · `replyRoute` :1223 · `takesFiles` :1396 · `roomKind` :1443 | ✓ | `connectionId` · 모델 고르기 |
| `meta.scheduleConnectionId` | Orbit | `phone2go.js:570-579`<br>`askVia` :582 — 쓰는 곳: 스케줄 초안 · 요약 · 갱신 · 장소(:663) · **smart 단체방 고르기 :349**<br>서버 `work.mjs:424`<br>화면 `phone.js:455, 1237, 1456` | ✗ | **저장하지 않아요.** 편집 창의 상태로만 두고, 기본은 그 채팅의 `connectionId`예요 (`CharacterScheduleEditorModal.tsx:360, 387-391`) |
| `meta.autonomousDailyBudget` · `meta.intentCooldowns` (돌면서 생기는 값) | Orbit (캐릭터별) | `noteProactive` `phone2sched.js:214-215` ✓ · :508 · :545 · `checkAutonomous` ✓ | ✓ | 채팅마다 (`chat.ts:696, 700`) |
| `meta.conversationTimeZone` + 확장 설정 `conversationTimeZone` | 확장 설정이 먼저, 메타는 사본 | `phone2sched.js:335-344` · `phone2go.js:318-323` (`zoneOf`를 모든 곳이 씀) · `auto.mjs:67` | 상관없음 | 채팅 열쇠이지만 `rememberConversationTimeZone`으로 모든 채팅에 하나 |

**화면만 있고 아직 동작이 없는 칸:** 프리셋 · 로어 예산 · 기억 · 요약 · 연결된 채팅 · 프로필 · `schedPrefs`예요. 값은 `obSetUi.v`에만 있어요(`phone.js:1372-1376`). 이으려면 처음부터 방마다로 넣으면 돼요. 단 `schedPrefs`는 마리나라에서도 앱 전체 값이에요(`ui.store.ts:1270`).

## 2. 방마다가 아니라 폰 · Orbit · 전체에 하나인 것

마리나라 기준으로 봐도 채팅마다가 아닌 것들이에요.

- **알림:** `orbitNotify`, 확장 설정(`phone.js:26, 1418-1422`). 마리나라도 앱 설정(`ui.store`)이에요.
- **알림음 파일:** 사용자 하나에 하나(`plugin/sound.mjs`).
- **알림 위치:** 실리의 칸(`phone.js:1437`)이에요.
- **빠른 전환기 즐겨찾기:** `orbitStars`, 확장 설정(`phone2go.js:1275-1288`).
- **번역 기본값:** `translator-defaults`, 확장 설정(`phone2translate.js:141-162`). 마리나라도 앱 설정이에요.
- **스케줄 시간대:** 확장 설정 하나(`phone2go.js:318-321`). 마리나라도 모든 채팅에 하나예요.
- **메인 · 기능 모델 칸과 실리 API 연결:** `connSettings('dr' | 'ai')`(`phone.js:1385-1416`), `stconn`은 실리 것이에요.
- **스케줄 · 손으로 준 상태 · 매주 갱신 · 카드의 상태:** 캐릭터 카드(`narrative_archive_convo`, `phone2sched.js:38-76`)에 있고, `w.presence.schedules` 등은 사본이에요.
- **내 상태:** `presence.user`(`phone2sched.js:116-122`, `phone2keepon.js:120`, `contextBlock` :165). 마리나라도 앱 전체(`ui.store`의 `userStatus`)예요.
- **페르소나:** `w.persona`, Orbit에 하나. 마리나라는 채팅마다(`personaId`)예요. 우리는 "나"가 Orbit 하나라서(`renamePersona`, `phone2store.js:326`) 폰 쪽 것으로 남겨야 해요.
- **폰이 스케줄을 따라가는 것:** `followSchedule`, 폰마다(우리 것). 그래서 `conversationSchedulesEnabled`를 방마다로 옮기면 이 부분은 방 없이 정해야 해요(아래 3-6).

## 3. 방마다로 옮기면 건드릴 것

### 3-1. 저장 모양
- 방에 `room.meta`(마리나라의 `chat.metadata`)를 둬요.
- 옮길 열쇠: `autonomousMessages`(지금의 `presence.on`), 하루 상한, 단체방 넷, 캐릭터끼리 주고받기, 스케줄 켜기, 명령 둘, 그림 설명 셋, 번역 12, `autonomousDailyBudget` · `intentCooldowns`.
- `connectionId` · `model` · `chatParameters`는 지금 자리 그대로 둬요.
- 저장 조각도 바뀌어요. 지금은 Orbit 머리(`live`)에 있는데, 방 조각(`room/<id>`)으로 가요(`phone2keep.js:28-56`). 합치기(`merge3`)도 방마다가 돼요.

### 3-2. 옛 값 옮기기
- Orbit 값을 모든 방에 복사해요. 대상은 `messenger.rooms`와 지운 방(`messenger.trash`, `phone2room.js:130`)이에요.
- `migrateKo`처럼 한 번만 해요(`phone2translate.js:57`). 브라우저와 일꾼이 같은 코드로 해요(`auto.mjs:33-48`의 `open`).
- 끝났다는 표시를 남기고, 그 뒤로는 Orbit 값을 안 읽어요. 그래야 새로 고치지 않은 옛 탭이 Orbit 값을 다시 써도 되살아나지 않아요.
- 하루 수 · 쉬는 시간: 그대로 복사할지 새로 셀지 정해야 해요. 방마다가 되면, 한 캐릭터가 방 둘에 있을 때 하루에 두 배까지 말을 걸 수 있어요. 마리나라도 그래요.

### 3-3. 새 방 · 분기 · 복사
- **새 방의 번역 기본값:** `newWorld`(`setWorldSeed`)가 아니라 방을 만들 때 넣어요. 방을 만드는 곳은 `ensureRoom`(`phone2store.js:309-321`)과 가져오기(`phone2import.js:147`)예요. 마리나라 `chats.storage.ts 1648`과 같은 자리예요.
- **분기 `branchRoom`:** 지금은 `connectionId` · `model` · `chatParameters`도 안 옮겨요(`phone2room.js:255-261`). 마리나라는 연결 · 페르소나 · 프리셋을 옮기고(`chats.routes.ts:5677-5692`), 메타도 요약 넷만 빼고 다 옮겨요(:5708-5713). `room.meta`도 같이 옮겨야 해요.
- **그대로 되는 것:** 지운 방 되살리기(`phone2room.js:139-144`), 보관(`phone2store.js:102-114`), 실리 분기 복사(`plugin/store.mjs:95` fork)는 방을 통째로 옮겨서 따로 할 일이 없어요.
- **`resetLive('chats')`:** 이건 오히려 좋아져요(`phone2store.js:122-134`). 지금은 메신저는 남기고 `presence`를 버려서 설정이 사라지는데, 방마다로 옮기면 방과 함께 남아요.

### 3-4. 반영 쪽 함수 (방을 받게)

`phone2sched.js`:
- `schedulesOn` · `activeSchedule` · `statusNow` · `replyDelay` · `mergedDelay` · `groupMode` · `groupOrder` · `groupTurnPrompt` · `autonomousOptions` · `setAutonomousOptions` · `setAutonomous` · `setSchedulesOn`
- `checkProactive` · `noteProactive` · `groupCandidates` · `groupHandoff` · `checkExchangeFor`는 이미 방을 받으니, 방의 메타를 읽게만 바꾸면 돼요.
- `draftSchedule` :349와 `renewSchedules` :375는 마리나라에서 그 채팅의 요약(`weekSummaries` · `daySummaries` · `summary`)을 읽어요(`schedule-routes.js:103-121`). 방을 넘기면 그 방의 것을 줄 수 있어요. 매주 자동 갱신(`phone2tick.js:38`)은 방이 없어요.

`phone2go.js`:
- `commandOn`: 그리고 `runLive`의 `parse`에 일(job)을 넘겨야 해요(`phone2run.js:136`).
- `liveAutonomous` 입구 :703은 방마다 도는 :707 안으로 옮겨요.
- `exchangeAfter` :687, `liveCaptioning` · `liveSetCaptioning`, `liveCommands` · `liveSetCommands`, `liveAutonomousOptions` · `liveSetAutonomous*` · `liveSchedulesOn` · `liveSetSchedulesOn`.

`phone2translate.js`:
- `metaOf(real, roomId)`, `autoTranslateOn(real, roomId)`, `liveTranslationSettings` · `liveSetTranslation` · `liveSaveTranslatorDefaults`(`readChatMetadata` :145), `autoTranslationConnection`.

`phone2tick.js:31`:
- 켠 방이 하나라도 있으면 돌게 바꿔요.

### 3-5. 서버
- `auto.mjs:65-69` `metaOf`: `room.meta`에 시간대를 더해서 줘요.
- `auto.mjs:99`: 방의 `conversationSchedulesEnabled`를 읽어요.
- `work.mjs:413-426` `usesSt`: 번역 연결 · 그림 설명 연결 · 스케줄 연결을 방마다 돌며 봐요.
- `work.mjs:312, 576`은 이미 방마다라서 그대로예요.
- 본체 쪽 파일은 안 바뀌어서, 확장 업데이트만으로 돼요.

### 3-6. 소망에게 물어볼 것
- **스케줄 켜기가 방마다가 되면:** 방 밖에서 쓰는 폰 상태(`followSchedule`)와 상태 보기(`liveStatus`)는 무엇을 따를까요? 예를 들면 "켠 방이 하나라도 있으면"이에요.
- **추론 레벨의 "Orbit 전체" 줄:** 남길까요, 뺄까요? 마리나라에는 없어요.
- **스케줄 생성 연결(`scheduleConnectionId`):** 지금처럼 저장할까요, 아니면 마리나라처럼 저장하지 않고 그 방의 연결을 따를까요?
- **smart 단체방 고르기 :349:** 지금은 스케줄 연결로 물어요. 같이 정해야 해요.

### 3-7. 화면 (디자인 세션에 보낼 것)

함수가 방을 받게 바뀌어요.

| 지금 | 바뀐 뒤 |
|---|---|
| `liveAutonomousOptions(real)` | `liveAutonomousOptions(real, roomId)` |
| `liveSetAutonomous(real, on)` | `liveSetAutonomous(real, roomId, on)` |
| `liveSetAutonomousOptions(real, o)` | `liveSetAutonomousOptions(real, roomId, o)` |
| `liveSchedulesOn(real)` | `liveSchedulesOn(real, roomId)` |
| `liveSetSchedulesOn(real, on)` | `liveSetSchedulesOn(real, roomId, on)` |
| `liveCommands(real)` | `liveCommands(real, roomId)` |
| `liveSetCommands(real, o)` | `liveSetCommands(real, roomId, o)` |
| `liveCaptioning(real)` | `liveCaptioning(real, roomId)` |
| `liveSetCaptioning(real, patch)` | `liveSetCaptioning(real, roomId, patch)` |
| `liveTranslationSettings(real)` | `liveTranslationSettings(real, roomId)` |
| `liveSetTranslation(real, patch)` | `liveSetTranslation(real, roomId, patch)` |
| `liveSaveTranslatorDefaults(real)` | `liveSaveTranslatorDefaults(real, roomId)` |
| `liveScheduleConnection` · `liveSetScheduleConnection` | 3-6 결정을 따라요 |

- `liveReasoning` · `liveSetReasoning` · `liveRoomModel` · `liveSetRoomModel`은 그대로예요.
- 고칠 곳(`phone.js`): 406 · 412 · 418 · 420 · 423-424 · 455 · 1165-1170 · 1237 · 1371 · 1376 · 1379-1384 · 1448-1454 · 1456 · 1819.
- 맨 화면의 값은 `phoneorbit.js:232-233`(`T.caption` · `T.autoOn`)에 있어요. `setUi`가 방의 값을 주면 그대로 맞아요.

### 3-8. 테스트 · 글 고칠 곳
- **테스트:** `phone2go` · `phone2sched` · `phone2translate` · `phone2keep` · `phone2beat` · `phone2wake` · `pluginauto` · `pluginwork`.
- **문서:**
  - `docs/MARINARA-PORT.md` 192 · 198줄 ("방마다가 아니라 Orbit 전체")
  - `docs/SERVER-HANDOVER.md` 5장 2번 ("켠 세계(`w.presence.on`)만")
  - `phone2sched.js:3-9`와 `phone2store.js` 머리 주석