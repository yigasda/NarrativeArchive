회의 표 기준으로 보면 이번 변경(2cb04a0)은 거의 다 들어갔어요. 막는 문제(blocker)는 없고, 고칠 것 4개와 참고 몇 개가 있어요. 복사본에서 테스트를 돌렸어요: 1710개 중 1709개 통과예요. 실패 1개는 알고 있던 plugincode 테스트(scratchpad 안 복사본이라 생기는 것)예요. 레포는 건드리지 않았어요.

## 맞게 된 것
- **저장 · 옮기기 · 분기 · 저장 조각:** p4 1절 열쇠(먼저 말 걸기, 하루 상한, 단체방 3개, 캐릭터끼리 주고받기, 스케줄 켜기, 명령 2개, 그림 설명 3개, 번역 12개, 하루 수 · 쉬는 시간)가 모두 `ROOM_META_KEYS`(`src/phone2sched.js:97`)에 있어요.
  - 옛 값 옮기기는 지운 방과 표시까지 다 돼요. "Orbit 전체" 추론 레벨은 자기 값이 없는 방의 `chatParameters`로 가고, `scheduleConnectionId`는 버려요.
  - 분기는 `connectionId · model · chatParameters · meta`를 사본으로 넘겨요.
  - `room.meta`는 그 방의 저장 조각(`room/<id>`)에 들어가고, `merge3`가 열쇠마다 합쳐요(테스트 있음).
- **옛 자리를 읽는 곳:** grep으로 다 찾아봤어요. `presence.on`, `presence.meta`의 채팅 열쇠, `scheduleConnectionId`, Orbit 전체 `reasoningEffort`를 읽는 곳이 `src/`와 `plugin/`에 이제 없어요.
- **서버:** `auto.mjs:69 · 100`과 `work.mjs:312 · 421 · 424 · 577`이 모두 방을 넘겨요. 새 방(`ensureRoom`, 가져오기)도 번역 기본값과 카드 스케줄로 시작해요.

## 고칠 것 (should-fix)
1. **답장 말의 상태 글이 그 방의 스케줄 스위치를 안 봐요.** 화면에 장소와 끝나는 시각이 보일 수 있어요.
   - 자리: `src/phone2go.js:236`(`stateFor`), `:447`(Merged `stateOf`). 둘 다 `activeSchedule(real, owner)`를 방 없이 불러요.
   - 언제: 스케줄을 끈 방 A, 켠 방 B에 같은 캐릭터가 있을 때예요. A의 답장에 `stateNow().text`("장소 · 하는 일 · ~끝나는 시각")가 `x.state`로 붙어요. 머리줄(`phone.js:447`)은 A에서 스위치가 꺼져 있으니 `liveStatus` 대신 그 `x.state`를 보여 줘요.
   - 왜 문제: CLAUDE.md가 "화면엔 하는 일만, 장소가 붙은 안쪽 값은 안 쓴다"고 경계한 경우예요. 전에는 스위치가 Orbit에 하나라서 이렇게 될 수 없었어요.
   - 고칠 것: 두 곳 다 `activeSchedule(real, x, job.room)`과 `stateNow(..., { room: job.room })`로 바꿔요. `docs/MARINARA-PORT.md`의 "방 밖에서 쓰는 것" 목록에서 `stateFor`를 빼요.
2. **방 안 화면에 방 없이 `liveStatus`를 부르는 곳이 남았어요.**
   - `src/phone.js:467`: 머리줄 프사의 상태 점.
   - `src/phone.js:1174 · 1176 · 1177`: 대화 상태 카드의 고르기 · Esc · 하는 일 칸. 그 카드를 그리는 `presUi`(:449)는 `r.id`를 넘기는데, 이 처리기들은 방 밖 규칙으로 비교해요.
   - 고칠 것: `obRoomId()` 또는 `r.id`를 넘겨요.
3. **`liveSaveTranslatorDefaults(real, roomId = '')`가 방이 없으면 조용히 빈 기본값을 저장해요.**
   - 자리: `src/phone2translate.js:156`.
   - 무슨 일: 방 id 없이 부르면 `readChatMetadata`가 `{}`를 주고, `'{}'`가 저장되고, "저장했습니다" 알림까지 떠요. 원래 있던 기본값이 사라져요.
   - 지금은 화면에 연결이 안 돼 있어요(`phoneorbitset.js:282` 버튼이 `na_ob_soon`). 디자인 세션이 이으면 바로 걸려요.
   - 고칠 것: 기본값 `''`를 빼고, `real`이 있는데 방이 없으면 "채팅방을 찾을 수 없습니다." 오류를 내요.
4. **`tools/plugin/` 확인 도구들이 옛 자리를 써요.** (지시대로 돌리지는 않았어요.)
   - `stbrowser.cjs:71 · 95`, `stprofile.cjs:93`: `presence.on = true`를 써요. 표시가 생긴 뒤라 아무도 안 읽어서 먼저 말 걸기가 안 켜져요.
   - `stsmoke.mjs:73`, `stbrowser.cjs:95`: `presence.meta.autonomousDailyBudget`를 읽어요. 이제 그 값은 방에 있어서 비어 있어요.
   - 고칠 것: `room.meta.autonomousMessages`와 `room.meta.autonomousDailyBudget`로 바꿔요.

## 화면에만 있는 값 (`obSetUi.v`, `phone.js:292`, 시트를 닫으면 `:1322`에서 비워짐)
지금은 아래 값 어느 것도 아무 데나 저장되지 않아요. 누르면 "아직 연결되지 않았어요"만 떠요.

| 화면 열쇠 | 마리나라 열쇠 | 저장 자리 |
|---|---|---|
| `profile` | `appliedChatPresetId` (목록 · 별은 앱 전체) | room.meta |
| `presetSrc` | 채팅 줄 `promptPresetId` | `room.promptPresetId` (`connectionId`처럼 방의 칸) |
| `presetText` | `customSystemPrompt` (null이면 프리셋 글) | room.meta |
| `personaOff` | 채팅 줄 `personaId` | **결정상 Orbit 하나**: 방마다로 이으면 결정과 어긋나요 |
| `off:<이름>` | `inactiveCharacterIds` (폰 열쇠 목록) | room.meta |
| `cross` | `crossChatAwareness` (`!== false`) | room.meta |
| 롤플에 연결 | 채팅 줄 `connectedChatId` | `room.connectedChatId` |
| `loreBudget` | `lorebookTokenBudget` (8192) | room.meta |
| `cmd:<id>` (works false인 명령) | `conversationCommandToggles[id]` | room.meta. `liveSetCommands`가 이미 받아서 지금도 저장할 수 있어요 |
| `schedPrefs` | `scheduleGenerationPreferences` | **앱 전체**(확장 설정) |
| `recall` | `enableMemoryRecall` (대화 모드 기본 켜짐) | room.meta |
| `semOn` | `semanticSummaryRetrievalEnabled` | room.meta |
| `semRecent` · `semOlder` · `semMin` | `semanticSummaryRecentCount` (2) · `OlderCount` (3) · `MinSimilarity` (0.15) | room.meta |
| `sumConn` | `summaryConnectionId` | room.meta |
| `sumMax` | `summaryMaxTokens` (4096) | room.meta |
| `rollHour` | `dayRolloverHour` (4) | room.meta |
| `sumTail` | `summaryTailMessages` (10) | room.meta |

- **`schedPrefs`:** 지금은 생성 요청에 `guidance`로 실리지도 않아요(`na_os_regen`, `phone2tick` 매주 갱신 둘 다).
- **요약 숫자 칸의 기본값이 마리나라와 달라요:** 화면은 `4 · 4 · 0.30`(`phoneorbitset.js:302`)인데, 마리나라 원본 `semantic-summary-retrieval.ts`는 `2 · 3 · 0.15`예요. 디자인 세션에 보낼 거리예요.
- **화면에 칸이 없는 것:** `enableMemoryRecallWholeChat`.
- **저장이 필요 없는 화면 상태:** `reTarget`, `addOpen`, `linkPick`, `linkQ`, `lorePick`, `loreQ`, `connQ`, `galTab`, `galQ`.
- **나중 일:** 이을 때 `obSetUi.v`는 방마다가 아니라서 방의 저장으로 바로 가야 해요.

## 참고 (note)
- 스케줄 켜기의 기본값이 조금 달라졌어요. 전에는 "어디든 스케줄이 하나라도 있으면 켜짐"이었고, 지금은 "그 방의 캐릭터에게 스케줄이 있으면 켜짐"이에요. 스케줄이 없는 캐릭터만 있는 방은 스위치가 꺼짐으로 보여요. 동작은 같아요.
- 빠진 열쇠를 잡을 테스트가 약해요.
  - `MOVED`(`tests/phone2roommeta.test.mjs:35`)에는 번역 열쇠 8개가 없어요.
  - `ROOM_META_KEYS`를 하나씩 도는 옮기기 테스트를 넣는 게 좋아요.
  - `src/`에서 `presence.on`과 `presence.meta.<채팅 열쇠>`를 읽는 곳이 없는지 보는 grep 테스트도 넣는 게 좋아요.
  - 위 1(방 하나는 끄고 하나는 켬)과 3(방 없이 저장)을 잡는 테스트도 필요해요.
- `livePresence`는 아직 가져오기에 남아 있지만 아무도 안 써요.