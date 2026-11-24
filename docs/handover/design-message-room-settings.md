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
