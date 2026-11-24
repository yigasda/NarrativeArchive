# 디자인 세션에: 채팅 설정이 방마다가 됐어요 (반영 쪽, 2026-11-24)

소망이 정한 것: 마리나라처럼 **우리 방 하나 = 마리나라 채팅 하나**예요. 채팅 설정은 이제 Orbit에 하나가 아니라 **방마다** 있어요(마리나라의 `chat.metadata` → `room.meta`).
그래서 **채팅 설정 화면은 이제 열린 방의 설정을 고쳐요.** 다른 방은 따로예요(방 A에서 번역을 켜도 방 B는 꺼진 그대로).
옛 저장은 반영 쪽이 한 번 옮겨요(Orbit의 값을 모든 방에 복사). 업데이트한 뒤에도 지금 화면에 보이는 값은 그대로예요.

그대로 남는 것(앱 · 폰 전체): 알림 · 알림음, 번역 기본값, 시간대, 메인/기능 모델 · 실리 연결, 카드의 스케줄 · 손으로 준 상태 · 매주 갱신, 내 상태, 페르소나, 빠른 전환기 즐겨찾기.

## 1. 함수가 방을 받아요

| 전 | 지금 |
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
| `liveSaveTranslatorDefaults(real)` | `liveSaveTranslatorDefaults(real, roomId)` (잊기는 그대로 `liveSaveTranslatorDefaults(null)`) |
| `liveSetReasoning(real, roomId \| '', v)` | `liveSetReasoning(real, roomId, v)`: 방이 꼭 있어야 해요 (`''`이면 "채팅방을 찾을 수 없습니다.") |
| `liveReasoning(real, roomId)` → `{ …, all, allChoices }` | `all` · `allChoices`가 없어요 (아래 3) |
| `liveScheduleConnection(real)` · `liveSetScheduleConnection(real, id)` | `liveScheduleConnection(real, roomId)`: 편집 창의 **처음 값**만 줘요. `liveSetScheduleConnection`은 없어요 (아래 4) |
| `livePresence(real).on` | 없어요. `liveAutonomousOptions(real, roomId).on` |
| `liveStatus(real, 이름)` | `liveStatus(real, 이름, roomId?)`: 방 안(그 방의 대화 상태 카드 · 머리줄의 하는 일)에서는 방을 주세요. 빼면 방 밖(연락처 · 프로필) |
| `liveDraftSchedule(real, 이름, opts)` · `liveScheduleSummary(real, 이름, opts)` | opts에 `connectionId`(편집 창에서 고른 것) · `roomId`(편집 창을 연 방)를 실어요 |
| `liveSetSchedule(real, 이름, schedule)` | `liveSetSchedule(real, 이름, schedule, { connectionId })`: 장소를 물을 연결(편집 창의 생성 연결) |
| `liveRenewSchedules(real, { owners, forceRefresh })` | `{ …, roomId }`를 주면 그 방의 연결로 묻고, 만든 것이 있으면 그 방의 스케줄을 켜요(마리나라 /schedule/generate). `connectionId`를 주면 그 연결 |

그대로인 것: `liveRoomModel` · `liveSetRoomModel` · `liveReasoning(real, roomId)`의 나머지 칸 · `liveTranslationView(real, roomId, x)` · `livePrepareInput(real, roomId, …)` · `liveTranslateDraft(real, roomId, …)` · `liveConnections()` · `liveTranslationConnections()` · `liveTranslatorDefaults()`.

## 2. 반영 쪽이 이미 이은 곳 (최소한으로, 보시고 맞게 고쳐 주세요)

화면이 이미 가진 방 id만 넘겼어요(`setUi` 안의 `r.id`, 그 밖에는 `obRoomId()`). 화면 모양 · 글은 안 바꿨어요. 고치기 전 사본: scratch의 `phone.before-room.js` · `phoneorbitset.before-room.js`.
- `src/phone.js` (지금 줄 번호): 94(가져오기에서 `liveSetScheduleConnection` 뺌) · 406 · 412 · 418 · 420 · 424 · 447~449 · 455 · 1161 · 1165~1168 · 1170 · 1212~1213(`schConn`) · 1217 · 1222 · 1238 · 1247 · 1372 · 1377 · 1380 · 1384~1385 · 1449 · 1451~1455 · 1457 · 1820.
- 방 안의 상태 (검토 뒤 더 이은 것): 467(머리줄 프사의 상태 점 `st`: `liveStatus(realM, os[0], r.id)`) · 1175 · 1177 · 1178(대화 상태 카드의 상태 고르기 · Esc · 하는 일 칸: `liveStatus(realM, n, obRoomId())`). 전에는 이 넷이 방 밖 규칙이라, 스케줄을 끈 방에서 점 색과 하는 일 글이 서로 달라질 수 있었어요.
- 화면에만 있던 칸의 값 (아래 6): 94(가져오기) · 412(`t.v = { ...obRoomVals(r), ...obSetUi.v }`) · 420(번역 화면도 그 위에) · 691(`setViewingRoom`) · 1376~1392(`OB_ROOM` · `obRoomVals` · `obRoomSet`) · 1393 · 1395 · 1397(누르기 · 고르기 · 입력칸이 먼저 `obRoomSet`).
- `src/phoneorbitset.js` 195: 추론 레벨의 "Orbit 전체" 줄(`rsAll`)을 뺐어요(아래 3).
- `livePresence`는 가져오기에 남아 있지만 이제 안 써요.

## 3. 추론 레벨의 "Orbit 전체" 줄은 없어요

마리나라에는 채팅마다 하나(`chatParameters`)뿐이에요. 우리가 더한 "Orbit 전체" 값은 자기 값이 없는 방으로 옮겼어요.
- 남은 줄: "이 채팅"(`T.rs.room` · `T.rs.roomChoices`). 맨 앞 칩(값 `''`)의 글이 지금 "전체 값 따름"인데, 따를 전체 값이 이제 없어요. 우리 칩이라 마리나라 글이 없어요(마리나라 화면은 안 정함 칩이 없어요). 전에 'Orbit 전체' 줄에 쓰던 "안 정함"이 맞아 보여요. 칸 이름 "추론 레벨"은 마리나라 en.json `ui.ui.generationparametersfields.reasoningEffort` "Reasoning Effort"의 우리 말이에요(그대로).
- 줄이 하나라 "이 채팅" 꼬리표가 필요 없을 수 있어요(디자인 결정).

## 4. 스케줄 생성 연결은 저장하지 않아요 (마리나라처럼)

마리나라 `CharacterScheduleEditorModal.tsx`: 생성 연결은 편집 창의 상태예요(`generationConnectionId`, 창을 열 때 비움). 처음 값은 그 채팅의 연결, 없으면 기본 연결(Main).
- 반영 쪽: `liveScheduleConnection(real, roomId)` = 그 방의 연결(목록 `liveConnections()`의 id), 방에 고른 연결이 없거나 목록에 없으면 `''`(기본 연결 = 초안 모델).
- 화면: 편집 창 상태에 `S.conn`(처음 `undefined`)을 두고 `S.conn ?? liveScheduleConnection(realM, obRoomId())`를 그려요. 고르면 `S.conn`만 바뀌고 저장하지 않아요. 만들기 · 요약 · 저장(장소 묻기)에 그 값을 `connectionId`로 실어요. 이렇게 이어 두었어요(`schConn`). **창을 닫았다 열면 다시 방의 연결이에요.** 전처럼 "고른 것이 남아요"가 아니에요.
- 글 (마리나라 en.json): 칸 이름 `ui.chat.characterscheduleeditormodal.generationConnection` "Generation model", 안 골랐을 때 `chooseConnection` "Choose a language provider", 도움말 `chooseConnectionHint` "Choose a language provider for schedule generation. You can add one in Connections.", 고른 줄 `selectedModel` "{{provider}} · {{model}}", 모델이 비면 `providerDefaultModel` "Provider default model". 연결 고르기 머리의 일 이름 `connections.picker.job.schedule` "Schedule". 지금 화면 글에 "바로 저장" 같은 말이 있으면 빼야 해요(phone.js 1230 주석의 "생성 연결(바로 저장)").

## 5. 그 밖에 화면이 알아 둘 것

- **smart 단체방 고르기**의 모델이 바뀌었어요: 전에는 스케줄 생성 연결로 물었고, 이제는 마리나라처럼 AI 기능 모델(우리의 Agents 자리)로 물어요. 화면에서 고를 것은 없어요.
- 대화 상태 카드의 "꺼짐 · 활성화됨" 배지(`presUi`의 `on`)는 이제 그 방의 먼저 말 걸기예요.
- 방 밖(연락처 · 프로필)의 상태: 그 사람이 있는 방 가운데 하나라도 스케줄을 켰으면 스케줄을 따라요(소망 (가)). 방이 없는 사람은 스케줄이 있으면 따라요.
- 새 방은 번역 기본값부터 시작해요(마리나라의 새 채팅). 분기한 방은 원래 방의 설정 · 모델 · 추론 레벨을 그대로 받아요.
- 화면만 있고 동작이 없는 칸(프리셋 · 로어 예산 · 기억 · 요약 · 연결된 채팅 · 프로필 …)은 이을 때 방마다예요. `schedPrefs`(일정 생성 선호)만 앱 전체예요(마리나라 ui.store).

## 6. 화면에만 있던 칸의 값이 이제 그 방에 저장돼요 (동작은 아직 없어요)

전에는 `obSetUi.v`에만 있어서 시트를 닫으면 사라졌어요. 이제 마리나라 열쇠 그대로 그 방에 저장하고, 화면은 저장된 값을 받아요(`t.v`). 누르면 전처럼 "아직 연결되지 않았어요"도 떠요(동작이 없는 기능이라서).

| 화면 열쇠 | 저장 (마리나라 열쇠) | 화면이 받는 값 |
|---|---|---|
| `profile` | `room.meta.appliedChatPresetId` (`''` → null) | `''` · 고른 id |
| `presetSrc` | 방의 칸 `promptPresetId`. 바꾸면 `customSystemPrompt`를 지워요(마리나라처럼) | `''` · id |
| `presetText` | `customSystemPrompt` (비면 null) | 글 · `''` |
| `off:<이름>` | `inactiveCharacterIds` (폰 열쇠). 마지막 한 명은 못 꺼요: "채팅에 응답할 캐릭터가 있도록 캐릭터를 하나 이상 활성 상태로 두어야 합니다." (마리나라 CharactersSection의 알림 글) | true · false |
| `cross` | `crossChatAwareness` (기본 켜짐) | true · false |
| `loreBudget` | `lorebookTokenBudget` (기본 8192, 0 이상 정수) | `'8192'` 같은 글 |
| `cmd:<명령>` (works false) | `conversationCommandToggles[명령]` (`liveSetCommands`) | `c.on` 그대로 |
| `recall` | `enableMemoryRecall` (대화 모드 기본 켜짐) | true · false |
| `semOn` · `semRecent` · `semOlder` · `semMin` | `semanticSummaryRetrievalEnabled` · `…RecentCount`(2) · `…OlderCount`(3) · `…MinSimilarity`(0.15). 범위 밖이면 "의미 기반 요약 검색 설정이 올바르지 않습니다." | bool · `'2'` · `'3'` · `'0.15'` |
| `sumConn` | `summaryConnectionId` (`''` → null) | `''` · id |
| `sumMax` | `summaryMaxTokens` (기본 4096, 1~32768로 자름) | `'4096'` |
| `rollHour` | `dayRolloverHour` (기본 4) | `'4'` |
| `sumTail` | `summaryTailMessages` (기본 10) | `'10'` |
| `schedPrefs` | **앱 전체** 확장 설정 `scheduleGenerationPreferences` (마리나라 ui.store). 이제 스케줄 생성 · 매주 갱신에 실려요(이건 동작이 있어요) | 글 |

- **화면의 기본값이 마리나라와 달라요:** `phoneorbitset.js` 302의 요약 숫자 칸 기본 `4 · 4 · 0.30`은 마리나라 `semantic-summary-retrieval.ts`의 `2 · 3 · 0.15`예요. 지금은 반영 쪽이 늘 값을 주니까 화면에 2 · 3 · 0.15가 보이지만, 화면 코드의 기본값도 고쳐 주세요. 로어 예산 칸도 이제 빈 칸("기본값") 대신 8192가 보여요(마리나라 화면도 8192를 보여 줘요).
- **페르소나 제거(`personaOff`)는 그대로 화면 상태예요:** 페르소나는 Orbit에 하나라서(소망 결정) 방마다로 저장하지 않았어요.
- **연결된 채팅(`connectedChatId`)**: 저장 함수는 있지만(`liveSetChatSettings(real, 방 id, { connectedChatId })`) 화면에 고를 목록이 없어서 아직 안 이었어요.
- 함수: `liveChatSettings(real, 방 id)` → 위 값 전부(기본값 포함) · `liveSetChatSettings(real, 방 id, { 마리나라 열쇠: 값 })`(준 것만) · `liveScheduleGenerationPreferences()` · `liveSetScheduleGenerationPreferences(글)`.
- 매주 갱신이 그 사람의 "스케줄을 켠 방" 하나의 연결로 물어요: 보고 있는 방이 먼저예요. 그래서 `drawPhone`에서 `setViewingRoom(() => obNb.viewing)`을 불러요(파일 맨 위에서는 phone2go.js와 서로 불러서 못 불러요).

## 7. 새 방은 마리나라의 설정 마법사를 Start한 값으로 시작해요 (소망 2026-11-24)

- 새 방(새 채팅 · 가져오기): 먼저 말 걸기 **켜짐**, 명령 **꺼짐**, 스케줄 스위치는 그 방 사람의 카드에 스케줄이 있으면 켜짐 · 없으면 꺼짐(꼭 적어요), 대화 프롬프트 없음.
- 그래서 새 방의 자율 메시지 화면은 켜진 채로, 에이전트 화면의 명령 스위치는 꺼진 채로 보여요. 마법사 화면 자체는 없어요("꼭 할 것").

