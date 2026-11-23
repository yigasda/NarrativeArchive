# 마리나라 콘보 코드 가져오기: 파일마다의 상태

마리나라(Marinara Engine 2.5.2, fc0333c)의 콘보 모드 코드를 **파일 단위로 빠짐없이** 가져오기 위한 표예요.
디자인 세션이 달라는 것만 가져오다가 기능이 반쪽으로 들어간 일이 있어서(2026-11-21), 이 표를 기준으로 해요.

규칙
- 파일 하나를 가져올 때는 그 파일의 기능을 전부 가져와요. 코드와 지시문은 그대로, 우리 저장 모양에 맞게만 고쳐요.
- **답장 지시문(`src/phone2reply.js`)은 우리 것이에요. 마리나라 것으로 바꾸지 않아요.** 마리나라 기능을 답장에 붙일 때는 우리 지시문에 그 기능의 줄만 더해요(예: 상태 명령 한 줄).
- 못 가져온 부분이 있으면 "일부"로 두고 무엇이 빠졌는지 적어요. 빼기로 한 것은 소망이 정한 것만 "안 함"으로 적어요.
- 화면(React 컴포넌트)은 디자인 세션 몫이라 이 표에 없어요. 화면 안에 든 동작(예: 편집 창의 고친 답 넣기)은 여기서 가져와요.

상태: **다** · **일부** · **아직** · **안 함**(소망이 정한 것)

## 끝까지 읽었나 (2026-11-21 기준, 사실대로)

"다"라고 적힌 파일도 처음에는 필요한 줄만 골라 읽고 가져왔어요. 그래서 빠진 것이 뒤늦게 나왔어요.
아래 "아니오"인 파일은 **가져온 코드는 원문 그대로지만, 그 파일이 하는 일을 우리 쪽에 전부 이었는지는 아직 확인하지 못한 것**이에요. 끝까지 읽고 대 본 뒤에 "예"로 바꿔요.

| 마리나라 파일 | 끝까지 읽음 |
|---|---|
| shared/utils/conversation-presence.ts | 예 |
| shared/utils/message-marks.ts | 예 |
| client/lib/character-schedule-transfer.ts | 예 |
| routes/generate/conversation-context-block.ts | 예 |
| client/lib/user-status.ts · user-presence-activity.ts | 예 |
| client/hooks/use-idle-detection.ts | 예 (src/marinara/idle-detection.js로 가져옴) |
| services/conversation/schedule.service.ts | 예 (읽다가 찾은 것: 요청마다의 온도 · 생각 정도가 모델에 안 가고 있었음 → 넣음) |
| services/conversation/autonomous.service.ts | 예 (읽다가 찾은 것: 판단할 때마다 기억을 지워서 따라 묻기 수 · 반응한 때가 늘 0이었음 → 마리나라처럼 기억해 두고, 마리나라가 적는 때에 적게 고침) |
| services/conversation/intent.service.ts | 예 |
| services/conversation/timezone.ts | 예 |
| routes/conversation.routes.ts | 예 (읽다가 찾은 것: 아래 "아직 마리나라와 다른 것"에 적음) |
| client/hooks/use-autonomous-messaging.ts | 예. 찾은 것: 탭이 가려져 있으면 먼저 말 걸기 검사를 건너뜀, 실패하면 "걸고 있는 중" 표시를 풂 → 둘 다 넣음 |
| services/generation/conversation-schedule-command-runtime.ts | 예. 빠진 것 없음 (공유 방 갈래는 우리에게 없음) |
| routes/generate/conversation-presence-runtime.ts | 예. 늦음이 짧은 사람부터 답하기 · 답한 뒤 부르기는 넣음. 없는 것: 장면 · 게임 중인 사람 빼기(그 기능이 우리에게 없음), 상태를 채팅에 적어 두기(`conversationCharacterStatuses`: 우리는 볼 때마다 계산) |
| services/generation/smart-group-decision.ts | 예 |
| shared/utils/speaker-segments.ts | 예 |
| services/generation/message-reply.ts | 예 |
| client/components/chat/MessageReplyPreview.tsx | 예 |
| shared/constants/conversation-prompt.ts | 예 |
| 답장 달기에 딸린 줄 (chat.schema.ts 54~58 · 82, types/chat.ts 954~961 · 987, chat.store.ts 274 · 809~815, slash-commands.ts 110~140, ConversationInput.tsx · ChatInput.tsx · use-generate.ts의 replyTo 줄, generate.routes.ts 1625~1665 · 2655~2670 · 8273~8300 · 12110~12140) | 예 (그 줄들만) |
| Merged에 딸린 줄 (generate.routes.ts 4440~4500 · 6215~6262 · 9045~9068 · 12056~12060 · 12317~12372, conversation-prompt-formatting.ts 1~35, generate-route-utils.ts 131~137 · 1417~1425, types/chat.ts 31~37) | 예 (그 줄들만) |
| services/generation/conversation-context-utils.ts | 예 |
| routes/generate.routes.ts 의 단체방 고르기 (3210~3221, 5165~5170, 6215~6260, 8273~8715, 12062~12290줄) | 예 (그 줄들만. 파일 전체 13000줄은 아니오) |
| services/storage/message-trash.storage.ts | 예. 찾은 것: 마리나라는 휴지통 수를 안 막음(우리는 100개로 막았음) → 막던 것 뺌. 목록에 받아 둔 답장 수(`swipeCount`) → 넣음. 로어 · 기억 조각 · 게임 · 변수 되돌리기는 그 기능이 우리에게 없음 |
| services/conversation/server-autonomous-scheduler.service.ts | 예 (507줄, 2026-11-22 staging 32c47a1에서 처음부터 끝까지 다시 읽음). `plugin/marinara/server-autonomous-scheduler.service.js`로 통째로 가져옴 |
| 먼저 말 걸기 — 안 보는 방 · 서버 (2026-11-22, staging 32c47a1): client/hooks/use-background-autonomous.ts(400줄) · use-autonomous-messaging.ts(303줄) · services/conversation/autonomous.service.ts(591줄) · intent.service.ts(153줄) · autonomous-candidates.ts(35줄) · routes/conversation.routes.ts(1354줄) · client/components/chat/ConversationAutonomousEffects.tsx(113줄) · client/lib/user-status.ts(11줄) · user-presence-activity.ts(29줄) · local-notifications.ts(177줄) · notification-sound.ts(106줄) | 예 (열한 파일 모두 처음부터 끝까지). fc0333c와 달라진 것은 conversation.routes.ts의 404 답 모양 11줄뿐이라, 이미 가져온 파일은 그대로 맞아요 |
| 먼저 말 걸기에 딸린 줄: chats.routes.ts(1240~1262 후보 목록 · 2103~2110 · 2160~2166 안 읽음 표시), chats.storage.ts(2085~2122 markAutonomousUnread · clearAutonomousUnread), chat.schema.ts(155~158), app.ts(400~406 스케줄러 켜기), AppShell.tsx(284~285 · 796~881 안 읽음 지우기), use-chats.ts(1317~1338), generate.routes.ts(1450~1455 · 1936~1959 · 11297~11305 세기 · 쉬는 시간 적기) | 아니오 (그 줄만. 파일 전체는 아니오) |
| 첨부 보내기 (2026-11-22, 마리나라 staging 32c47a1): client/lib/chat-attachment-images.ts(284줄) · services/generation/prompt-attachments.ts(194줄) · shared/constants/image-captioning-prompt.ts · services/generation/image-captioning-runtime.ts(712줄) · routes/generate/conversation-prompt-formatting.ts(317줄) | 예 (다섯 파일 모두 처음부터 끝까지) |
| 첨부 보내기에 딸린 줄: ConversationInput.tsx(87~140 · 262~296 · 560~572 · 655~830 · 855~950 · 1027~1245 · 1356~1452 · 1804~1830 · 2168~2200 · 2242~2254), generate.routes.ts(1376~1385 · 1595~1697 · 2118~2198 · 2629~2759 · 12094~12095), generate-route-utils.ts(1204~1228), chat.schema.ts(123~133), types/chat.ts(969~984), slash-commands.ts(115~148), base-provider.ts(302~321 · 362~376), openai.provider.ts(492~512 · 2045~2082 · 2881~2890), anthropic.provider.ts(362~390 · 893~912), google.provider.ts(502~530), ConversationMessage.tsx(497~530), ConversationMessageShared.tsx(558~645), use-generate.ts(1321 · 1359~1360 · 1426 · 1517), chat-resource-drag.ts(141~143) | 예 (그 줄들만. 파일 전체는 아니오) |
| 먼저 건 말의 알림 — 화면 (2026-11-23, 압축 뒤 처음부터 다시, staging 32c47a1): hooks/use-presence-clock.ts(52줄) · components/chat/ConversationAutonomousEffects.tsx(113줄) · components/chat/ChatNotificationBubbles.tsx(328줄) · hooks/use-background-autonomous.ts(400줄) · hooks/use-autonomous-messaging.ts(303줄) · lib/notification-sound.ts(106줄) · lib/local-notifications.ts(177줄) · components/panels/settings/SettingControls.tsx(740줄) · stores/chat.store.ts(1140줄) · components/layout/ChatSidebar.tsx(2471줄) · hooks/use-custom-notification-sound.ts(46줄) · server routes/notification-sound.routes.ts(217줄) | 예 (전부) |
| 알림에 딸린 줄 (그 줄들만): SettingsPanel.tsx(2246~2420 알림 칸 · 알림 위치), App.tsx(485~600 · 1325~1389 토스트 위치 · 사용자 지정 소리), AppShell.tsx(250~262 · 1495~1520), ChatArea.tsx(1215~1330 1분 시계), ConversationView.tsx(1085~1260 열린 방 알림음 · 1555~1575), ChatRoleplaySurface.tsx(1525~1545), use-generate.ts(475~495 · 1350~1380 · 2490~2545 · 3620~3700 · 3785~3840), ui.store.ts(1150~1165 · 1540~1551 · 2420~2432 알림 설정 기본값), localization/locales/en.json의 알림 글 | 예 (그 줄들만. 파일 전체는 아니오: SettingsPanel 8324줄 · ChatArea 4550줄 · use-generate 4644줄 · ui.store 4345줄 · ConversationView 1654줄 · ChatRoleplaySurface 2473줄 · AppShell 1707줄 · App 1389줄) |
| 서버 · 늦은 답장 대 보기 (2026-11-23, staging 32c47a1): routes/generate/conversation-presence-runtime.ts(492줄) · services/conversation/server-autonomous-scheduler.service.ts(507줄) · services/conversation/autonomous.service.ts(591줄) · routes/conversation.routes.ts(1354줄) · client/hooks/use-autonomous-messaging.ts(303줄) · use-background-autonomous.ts(400줄) | 예 (여섯 파일 모두 처음부터 끝까지). 우리 쪽 plugin/*.mjs 전부 · phone2tick.js · phone2keepon.js · src/marinara/autonomous-check.js · phone2go.js 150~280 · 400~680 · phone2sched.js 160~490도 끝까지 읽고 대 봄. 결과는 아래 "서버 · 늦은 답장: 마리나라와 다른 것" |
| 위에 딸린 generate.routes.ts 줄: 1505~1544(생성 자물쇠) · 1915~1954(연결이 끊겨도 계속) · 4325~4384(늦음 기다리기 부르는 곳) | 아니오 (그 줄만. 파일 전체 16262줄은 아니오) |
| 나머지 "아직" 파일 전부 | 아니오 |

## 서버 · 늦은 답장: 마리나라와 다른 것 (2026-11-23, 대 본 결과)

가져온 파일 두 개는 마리나라와 같아요(타입을 지우고 대 봄: `plugin/marinara/server-autonomous-scheduler.service.js`는 `app.chats` 한 줄 · 안드로이드 머리 한 줄, `src/marinara/autonomous.service.js`는 다른 줄 없음). 다른 것은 우리가 새로 짠 곳에 있어요.

**고침 (2026-11-23, 소망 "똑같이")**: 1 · 2 · 3 · 5 · 6 · 8 · 10은 마리나라처럼 고쳤어요. 4는 그 방만 건너뛰게(서버가 못 보내는 연결이 있어서 완전히 같게는 못 해요). 7은 다시 보니 같아요(아래). 9는 마리나라도 같아요(아래). 줄마다 "지금"에 적었어요.

| # | 무엇 | 마리나라 | 우리 | 어디 |
|---|---|---|---|---|
| 1 | 내 메시지에 대한 늦은 답장(바쁨 · 자리 비움) | 서버가 그 요청 안에서 기다렸다가 때가 되면 바로 만듦(`conversation-presence-runtime.ts` 254~321). 브라우저 연결이 끊겨도 계속함(`generate.routes.ts` 1924~1934: "A closed stream is not a Stop"). 브라우저가 보고 있는지는 안 봄 | 답장을 줄에 넣고, 브라우저(보일 때만)나 서버가 돌림. 서버는 브라우저가 75초 안에 "보고 있어요"를 알렸으면 안 돌림(`sweepDue`의 `watched`). 그래서 화면을 끄고 조금 뒤에 돌아오면 그때 브라우저가 만들기 시작해서 "입력 중" 뒤에 옴 | plugin/work.mjs `watched` · `sweepDue`. **지금: 고침.** `watched`를 뺐어요. 때가 되면 일꾼이 바로 보내요(브라우저가 보고 있어도). 브라우저도 그 시각에 돌아요(아래 2). 한 방에 둘이 같이 쓰지 않게 방 자물쇠. 일꾼이 쥐고 만드는 동안 브라우저는 1초마다 다시 봐서(`LIVE_GO.retryMs`), 끝나면 곧 보여요 |
| 2 | 때가 된 뒤 도는 시각 | 정확히 그 시각(`setTimeout`) | 30초마다 봐서 최대 30초 늦음 | plugin/work.mjs `DUE_MS` · phone2tick.js `TICK_MS`. **지금: 고침.** 일꾼은 기다리는 답장 가운데 가장 이른 시각에 다시 보고(`nextDue`), 브라우저가 저장하면 1초 뒤에 봐요(`poke`). 브라우저는 줄 세울 때 그 시각을 알려(`phone2go.js dueAt` → `setDueHook`) 그 시각에 틱이 한 번 더 돌아요(`phone2tick.js tickAt`). @ 부름 · 주고받기(2~5초)도 같아요 |
| 3 | 가려진 탭의 "보고 있어요" | 가려지면 안 알림(`use-autonomous-messaging.ts` 98~101) | 가려져 있어도 답장을 받는 중이면 알림 | phone2keepon.js `keepBeat`의 `busy`. **지금: 고침.** 가려지면 안 알려요 |
| 4 | 서버가 보낼 수 없는 방 | 없음(서버가 다 보냄) | 그런 방이 하나라도 있으면 그 저장의 늦은 답장을 전부 안 돌림 | plugin/work.mjs `sweepDue`의 `cannot` → `throw`. **지금: 그 방만 건너뛰어요**(그 방은 브라우저가 보내요). 나머지 방은 보내요 |
| 5 | 캐릭터끼리 주고받기 | 브라우저에서 먼저 건 말 뒤에만(`use-autonomous-messaging.ts` 232~262). 서버 스케줄러는 안 함 | 서버에서 먼저 건 말 뒤에도 함 | plugin/work.mjs `runSoon` · phone2go.js `exchangeAfter`(서버도 같은 코드). **지금: 고침.** 일꾼은 `liveGo(…, { server: true })`로 돌려서 주고받기를 줄 세우지 않아요. `runSoon`은 뺐어요 |
| 6 | 먼저 건 말이 실패한 뒤 쉬기 | 서버 스케줄러만, 메모리에(`failureBackoffByChat`) | 방에 적어 두고(`room.autoFail`) 브라우저 · 서버 둘 다 봄 | phone2go.js 232~241 · 656 · plugin/work.mjs `generate`. **지금: 고침.** `room.autoFail`을 안 써요. 브라우저: 실패하면 마리나라 브라우저처럼 `/activity/assistant`(`noteAssistant`). 서버: "걸고 있는 중" 표시만 풀고 오류를 스케줄러에 돌려줘요(`autoError` → `SSE.error`): 쉬는 것은 스케줄러의 `recordFailureBackoff` |
| 7 | 서버의 먼저 건 말 요청을 거절(409)하는 때 | 그 채팅이 생성 중일 때만(`activeGenerations`) | 그 방에 답장이 줄 서 있을 때 · 실패 뒤 쉬는 중일 때도 | plugin/work.mjs `generate`. **지금: 같아요.** 다시 보니 마리나라는 답장을 달라는 순간부터 늦음을 기다리는 동안까지 생성 자물쇠를 쥐고 있어요(`generate.routes.ts` 1514~1536 · `conversation-presence-runtime.ts` 254~265): 줄 서 있는 답장 = 생성 중이에요. "실패 뒤 쉬는 중"은 6과 함께 뺐어요 |
| 8 | `/autonomous/check`에서 카드의 상태 맞추기 | 함(`conversation.routes.ts` 1040~1053) | 안 함. 가져온 파일 머리에도 안 적혀 있었음 | src/marinara/autonomous-check.js. **지금: 고침.** 같은 줄을 넣었어요. 카드는 우리 칸(`narrative_archive_convo`의 `conversationStatus`)이에요 |
| 9 | 늦음을 기다리는 동안 새 메시지를 보낼 때 | 늦음을 기다리는 동안 보낸 말은 저장만 하고 새로 만들지 않아요. 기다리던 요청이 이어지면 그 말까지 다 읽어요(`ConversationInput.tsx` 1187~1198, 2026-11-23 읽음) | 그 사람의 답장이 이미 줄에 있으면 새로 안 서고, 처음 정한 때 그대로 | phone2run.js `enqueueReplies`. **같아요** |
| 10 | 틀린 기록 | — | `phone2keepon.js` 51~52 주석 "Marinara has no such reply: its server answers only while the page asks"는 틀림. 이 표의 75줄 ⑤ "마리나라에 없는 것: 늦은 답장을 서버가 보내요"도 틀림(마리나라 서버도 보냄) | phone2keepon.js · 이 파일. **지금: 고침** |

## 스케줄 · 상태 · 먼저 말 걸기

| 마리나라 파일 | 줄 | 상태 | 우리 쪽 | 빠진 것 |
|---|---|---|---|---|
| shared/utils/conversation-presence.ts | 247 | 다 | src/marinara/conversation-presence.js | |
| services/conversation/schedule.service.ts | 638 | 다 | src/marinara/schedule.service.js | |
| services/conversation/timezone.ts | 161 | 다 | src/marinara/timezone.js | |
| services/conversation/intent.service.ts | 153 | 다 | src/marinara/intent.service.js | |
| services/conversation/autonomous.service.ts | 591 | 다 | src/marinara/autonomous.service.js | |
| services/conversation/autonomous-candidates.ts | 35 | 다 (코드). 부르는 곳은 아직 | plugin/marinara/autonomous-candidates.js | 다른 채팅의 후보 목록 길(`/chats/autonomous-candidates`)은 아직 |
| routes/conversation.routes.ts | 1353 | 일부 | src/marinara/autonomous-check.js · schedule-routes.js | /status(마지막 연락 · 상태 맞추기), /activity/* 는 우리 방의 말에서 다시 읽는 것으로 대신함. /busy-delay는 replyDelay('auto')로. 나머지 길은 가져옴 |
| client/lib/character-schedule-transfer.ts | 171 | 다 | src/marinara/character-schedule-transfer.js | (스케줄 내보내기 · 가져오기 함수도 들어 있음: 화면에서 부르면 됨) |
| client/hooks/use-autonomous-messaging.ts | 303 | 일부 | src/phone2tick.js · phone2go.js liveAutonomous | 순서 · 주기(30초) · 늦음 · 주고받기(2~5초 뒤, 그 시각에) · 세는 때(말이 실제로 나온 뒤) · 가려지면 쉬기는 맞춤. 실패하면 마리나라처럼 `/activity/assistant`만(쉬기는 없어요: 2026-11-23에 뺐어요, 위 "서버 · 늦은 답장" 6). 코드는 우리 줄(queue)에 맞춰 다시 짬 |
| client/hooks/use-background-autonomous.ts | 400 | 일부 (끝까지 읽음. 코드는 안 가져옴: 아래 이유) | plugin/ (서버 일꾼) · src/phone2keepon.js | 마리나라의 "채팅"은 우리 방 하나예요. **지금 열린 실리 채팅 안의 방은 안 보고 있어도 브라우저가 다 봐요**(`liveAutonomous`가 방마다 물어요). **다른 실리 채팅의 Orbit**은 브라우저가 못 읽어요(그 채팅의 데이터는 그 채팅을 열어야 메모리에 있어요): 마리나라처럼 브라우저가 돌리지 않고, **서버 일꾼이 돌려요**(먼저 말 걸기는 브라우저가 그 채팅을 안 보고 있으면 75초 뒤부터 서버 몫. 늦은 답장은 때가 되면 늘 서버가: 위 "서버 · 늦은 답장" 1). 그래서 다른 것: 그런 방은 서버의 값으로 돌아요(후속 2번까지 · 내 상태는 `idle` · 연결 프로필 방은 안 됨). **아직 없는 것: 알림**(소리 · 떠 있는 알림 · 브라우저 알림 · 다른 채팅의 안 읽음 수 올리기). 안 읽은 먼저 건 말은 방에 적혀 있고(`liveAutonomousUnread`) 방을 읽으면 지워져요 |
| client/lib/notification-sound.ts | 106 | 다 (코드). 부르는 곳은 화면(디자인 세션) | src/marinara/notification-sound.js | 알림 소리(합성음 · 내 소리 파일 · 창이 앞에 있을 때는 안 울리기) |
| server/routes/notification-sound.routes.ts | 212 | 다 (2026-11-23, 끝까지 읽음) | plugin/sound.mjs · plugin/index.mjs `/sound*` | 형식 알아보기 · 10MB · 확장자 · 한 줄 세우기 · 가장 새 파일 · 파일 주기 머리 그대로. **다른 것**: 둘 곳은 실리 사용자 폴더, 올리기는 실리의 multer(`avatar` 칸) 임시 파일, 지우기는 `POST /sound/delete`(마리나라 `DELETE /`, 204), 오류 글은 한국어(뜻은 그대로). 백업에는 안 들어가요(마리나라는 `backup.routes.ts` 122줄에서 넣어요: 우리 백업은 채팅마다의 아카이브라 이 파일이 들어갈 자리가 없음) |
| client/hooks/use-custom-notification-sound.ts | 46 | 다 (2026-11-23, 끝까지 읽음) | src/phone2sound.js | 상태 · 올리기 · 지우기와 `setCustomNotificationSoundUrl`(App.tsx 545 · 573~575 · SettingControls.tsx 380~420) 그대로. react-query의 30초 기억 대신 부를 때마다 물어요 |
| client/hooks/use-generate.ts (알림 부분) | 4694 | 끝까지 읽음 (2026-11-23). 알림 줄만 가져옴 | phone2go.js `replied` · phone2keepon.js `synced` → `na-live-reply` | `completedReply`(3840~3846) · 안 보는 방의 안 읽음 · 방울 · 알림음(2535~2565 · 3670~3720) · `replyNotificationTitle`(487) · 알림 토글(3866~3879)의 때를 신호로 줘요. 띄우는 것은 화면. 번역을 기다렸다가 알리기(`waitForServerTranslationToSettle`)는 우리 번역이 답에 같이 와서 없음. 나머지(스트리밍 · 에이전트 · 게임 등)는 이 기능이 아니라 안 가져옴 |
| client/lib/local-notifications.ts | 177 | 다 (코드). 부르는 곳은 화면(디자인 세션) | src/marinara/local-notifications.js | 브라우저 알림(권한 묻기 · 띄우기). 알림의 글 · 그림만 실리 것으로(`MESSAGE_NOTIFICATION`). 마리나라 안드로이드 앱의 다리는 우리에게 없어서 늘 "unsupported" |
| client/components/chat/ConversationAutonomousEffects.tsx | 113 | 일부 | phone2go.js · phone2keepon.js의 `na-live-auto` 신호 | 캐릭터가 먼저 건 말이 들어오면 화면에 신호를 보내요(브라우저가 만든 것 · 서버가 만든 것 둘 다). 소리 · "○○ messaged you" 띠 · 안 읽음 수는 화면 몫(디자인 세션) |
| client/lib/user-status.ts · user-presence-activity.ts · hooks/use-idle-detection.ts | 110 | 다 | src/marinara/idle-detection.js · phone2sched.js userStore | |
| services/conversation/server-autonomous-scheduler.service.ts | 507 | 다 (작업 브랜치. 브라우저 쪽 3-3이 될 때까지 메인에 안 올려요) | plugin/marinara/server-autonomous-scheduler.service.js · plugin/auto.mjs · work.mjs · worker.mjs · host.mjs · bridge.mjs · screen.mjs · log.mjs · src/phone2kit.js | 파일은 통째로 가져왔고, 부르는 두 길(때가 됐나 · 답장 만들기)을 서버에서 브라우저와 같은 코드로 돌려요. **마리나라와 다른 것**: ① 연결 프로필 · 실리 쪽 방(실리에서 지금 고른 프로필)은 브라우저가 실리 자신의 코드로 떠 둔 요청 틀로 서버가 보내요. 실리에서 프로필을 하나도 안 고른 방은 서버가 못 돌려요(실리의 `generateRaw`는 브라우저 코드라서). ② 실리 연결 방식 · 연결 프로필은 브라우저가 미리 남긴 요청 틀이 있어야 해요(그 채팅을 한 번 열어 두면 생겨요). ③ 서버는 이야기 요약본을 늘리지 않아요. ④ 카드 · 페르소나 · 롤플 끝 메시지는 브라우저가 마지막으로 남긴 것을 읽어요(그 뒤에 실리에서 고쳤어도 그 채팅을 다시 열기 전에는 예전 것). ⑤ 늦은 답장: 마리나라도 서버가 보내요(그 요청 안에서 기다렸다가. 2026-11-23에 고침: 전에 "마리나라에 없는 것"이라고 틀리게 적었어요). 우리는 줄에 있는 답장을 때가 되면 일꾼이 보내요. 자세한 것은 `docs/PHONE2-PLAN.md` 3-2b |
| routes/generate/conversation-context-block.ts | 162 | 다 | src/marinara/conversation-context-block.js | |
| routes/generate/conversation-presence-runtime.ts | 492 | 다 | phone2go.js holdReplies · pickResponders · handOff | 늦음 · 오프라인 · @ 부름 · 늦음이 짧은 사람부터 · 답한 뒤 부른 사람의 늦음(mentionResponderDelays). 장면 · 게임 중인 사람 빼기는 그 기능이 없어서 없음 |
| services/generation/smart-group-decision.ts | 104 | 일부 | src/marinara/group-responders.js | `smartOrderQuestions` · `chooseSmartResponders`는 그대로. `smartOrderState`와 그걸 부르는 길(Decision 모델로 고르기)은 아직: 마리나라의 Decision 모델(`services/decision/`)이 우리에게 없음. 그래서 smart는 항상 채팅 모델에게 물음(마리나라에서 Decision 모델을 꺼 둔 것과 같음) |
| routes/generate.routes.ts (단체방에서 누가 답하나) | 그 줄들 | 일부 | src/marinara/group-responders.js · phone2sched.js groupResponders · groupHandoff · phone2go.js pickResponders · handOff | 답하는 순서 3가지(sequential · smart · manual), @으로 부르면 그 사람만, smart 고르기 지시문 그대로(temperature 0.2), 못 고르면 한 사람, 늦음이 짧은 사람부터, 답에서 @이름으로 부른 사람이 다음 차례(한 차례에 한 번, 먼저 건 말이면 하루 상한 안에서), "@Name으로 부를 수 있다" 알림 글 그대로 + 끄기(`groupTurnPromptEnabled`). 말에 답장을 달면 그 사람을 부른 것(`replyTo`), topP 1. **없는 것**: 고르기 전용 연결 · 예비 연결("꼭 할 것"의 연결 일과 같이). 저장된 연결 프로필(실리 Connection Manager)로 보낼 때는 topP가 안 실림 |
| Merged 단체방 (generate.routes.ts · conversation-prompt.ts · conversation-prompt-formatting.ts · speaker-segments.ts) | | 일부 | src/marinara/merged-conversation.js · speaker-segments.js · phone2go.js mergeTurn · gatherMerged · phone2run.js takeMerged | 마리나라의 기본 단체방 방식. `groupChatMode`가 `individual`이 아니면 Merged(마리나라의 읽기 그대로). 한 요청이 답할 수 있는 사람 모두의 말을 `Name: 말`로 쓰고, 마리나라의 나누기(`parseGroupedSpeakerSegments`)로 사람마다의 말로 넣음. 지시문은 마리나라의 것 그대로(기본 Conversation 지시문 + 단체방 줄 + 되풀이 금지 + 끝에 Output Format, 오프라인이 있으면 "Only … may respond this turn", @으로 부르면 "Respond ONLY as …"). 늦음은 마리나라의 계산(가장 늦는 사람 · 부르면 가장 바쁜 사람의 부름 늦음). 다시 받기는 모두(오프라인도)에게 한 번에. **다른 것**: 입력은 우리 블록(MESSENGER · CHAT SUMMARY · CONTEXT · 카드 · PERSONA · STORY · LAST MESSAGES)이고 마리나라의 프로필 블록이 아님. 한 답을 한 말로 두지 않고 사람마다의 말로 나눠 저장함(우리 저장 모양). 먼저 건 말(자율)은 Merged 방에서도 한 사람이 우리 지시문으로 씀(마리나라는 그것도 Merged 요청). **지금 없는 것(우리 지시문으로 바꿀 때 채울 것)**: 번역(ko) · 폰에서 한 일(does) · 상태 줄 · 반응 · 상태 명령 |
| services/generation/conversation-schedule-command-runtime.ts | 226 | 다 | src/marinara/schedule-command.js | (공유 방 갈래는 우리에게 없음) |

## 말 · 방

| 마리나라 파일 | 줄 | 상태 | 우리 쪽 | 빠진 것 |
|---|---|---|---|---|
| shared/utils/message-marks.ts | 172 | 다 | src/marinara/message-marks.js · src/phone2room.js | (메모를 한 사람에게 보여 주기: 글은 마리나라의 appendRoleplayMessageNotes 그대로) |
| routes/generate/generate-route-utils.ts (숨기기) | | 다 | src/marinara/message-hidden.js | |
| services/generation/message-reply.ts · MessageReplyPreview.tsx · chat.schema.ts(messageReplySchema) | 13 · 77 | 다 (코드). 화면은 디자인 세션 | src/marinara/message-reply.js · phone2room.js replyTexts · replyDraftOf · repliedTo · phone2store.js sendLive(…, { replyTo }) · phone2go.js liveReplyTo · liveReplyDraft · liveCancelReply | 말에 답장 달기: 초안(방마다 하나, 창이 열려 있는 동안), 골라 둔 글만 인용, 글 없는 말에는 못 닮, 보낸 내 말에 그때의 글을 담아 둠(원래 말이 고쳐지거나 지워져도 남음), 답장 요청에는 내 마지막 말에만 `Replying to 이름:` 인용, 캐릭터의 말에 달면 그 사람을 부른 것. 슬래시 명령과 붙는 부분(`withComposerReplyAndAttachments`)은 슬래시 명령이 없어서 없음 |
| services/storage/message-trash.storage.ts | 547 | 다 | src/phone2room.js (우리 코드) | 마리나라 코드는 그쪽 DB에 묶여 있어 코드는 우리 것. 동작은 맞춤: 되살리기(제자리 · 받아 둔 답장 · 고정 10개 넘으면 막기), 30일 뒤 비우기(타이머), 골라서/전부 아주 버리기. 안 맞춘 것: 지울 때 딸려 지워진 로어 되살리기(우리에게 없음) |
| services/generation/prompt-message-scope.ts | 456 | 아직 | | 말마다 누구에게 보일지 정하기 |
| routes/generate/conversation-history-runtime.ts | 763 | 아직 | | 요청에 넣을 대화 기록 다듬기 |
| services/conversation/transcript-sanitize.ts | 102 | 아직 | | |

## 첨부 보내기 (2026-11-22)

| 마리나라 파일 | 줄 | 상태 | 우리 쪽 | 빠진 것 |
|---|---|---|---|---|
| client/lib/chat-attachment-images.ts | 284 | 다 | src/marinara/chat-attachment-images.js | (그림 줄이기: 긴 변 1536px, GIF는 멈춘 그림으로) |
| services/generation/prompt-attachments.ts | 194 | 다 | src/marinara/prompt-attachments.js | Node의 Buffer만 브라우저 것으로 바꿈 |
| shared/constants/image-captioning-prompt.ts | 6 | 다 | src/marinara/image-captioning-prompt.js | 지시문 글자 그대로 |
| services/generation/image-captioning-runtime.ts | 712 | 일부 | src/marinara/image-captioning.js · phone2go.js captioningOf | 가져온 것: 설명 만들기 · 저장한 설명 다시 쓰기 · 요청에 넣기(`resolvePromptAttachmentInputs`). **안 가져온 것**: ① "자동" (채팅 모델이 그림을 못 읽을 때만 설명): 마리나라의 모델 목록(그림을 읽는 모델인지)이 우리에게 없어요. 우리는 스위치를 켠 채팅만 설명해요. ② 모델이 그림을 거절하면 설명으로 다시 보내기(`withImageCaptionFallback`): "그림 읽기 기본 모델"이 우리에게 없어요. ③ 캐릭터가 보낸 셀카 설명(`captionSentSelfies`): 캐릭터가 그림을 보내는 기능이 없어요. ④ 무작위 연결 · 실패 시 다른 연결 |
| ConversationInput.tsx (첨부 부분) | | 일부 | src/marinara/conversation-attachments.js | 가져온 것: 받는 종류 · 20MB · 읽는 순서 · 보낼 모양. 안 가져온 것: 채팅마다 첨부 초안을 따로 두기 · 보내기 실패 때 입력창 되돌리기(화면 몫: 디자인 세션) · GIF 고르기 · 명령어에 첨부 싣기(`withComposerReplyAndAttachments`) |
| generate.routes.ts (첨부 부분) | | 일부 | src/phone2attach.js · phone2store.js sendLive · phone2go.js roomAttachments | 가져온 것: 말에 첨부 남기기 · 글 없이 첨부만 보내기 · 대화의 모든 말의 첨부를 요청에 넣기 · 새 설명을 말에 저장. 안 가져온 것: 내 말 다시 쓰기(regenerate)의 첨부 · 게임 방 |
| conversation-prompt-formatting.ts (`appendSentMediaNotes` 등) | 317 | 안 함 | | 캐릭터가 보낸 사진 · 셀카 · 영상을 다음 요청에 적는 줄: 캐릭터가 파일을 보내는 기능이 없어서 쓸 곳이 없어요 |
| 제공자 코드 (openai · anthropic · google .provider.ts 의 그림 · 파일) | | 일부 | src/ai.js openAiTurn · anthropicTurn | 커스텀 API(OpenAI 형식 · Anthropic 형식)는 마리나라와 같은 모양 · 순서로 보내요. **실리 서버로 가는 길(Vertex · 실리 연결 방식 · 연결 프로필)은 그림만 가요: 실리 서버가 PDF 조각을 안 받아요.** 그 길에서는 PDF를 안 보내고 그 말에 "this connection cannot read it"이라고 적어요 |
| ConversationMessage*.tsx (보낸 첨부 그리기 · 빼기) | | 코드 다. 화면은 디자인 세션 | phone2go.js liveRemoveAttachment | |

**우리 저장 모양에 맞춘 것** (소망 허락, 2026-11-22):
- 마리나라는 파일을 말 안에 통째로 저장해요. 우리는 실리의 파일 저장소(`/api/files/upload`)에 올리고 말에는 주소만 남겨요(`extra.attachments[].url`). 채팅 파일이 그림마다 몇 MB씩 커지지 않게요.
- 마리나라는 그림이 그 말에 붙어서 가요. 우리 답장 요청은 대화가 MESSENGER 블록 하나라서, 그 말의 줄 아래에 마리나라의 꼬리표 모양으로 `(image 1 attached to this request)`처럼 적어요.
- 요약 · 롤플에 전하기 · 폰 반영은 말의 글만 읽어요. 첨부는 답장 요청에만 들어가요.
- 말을 지우거나 방을 지워도 실리 저장소의 파일은 남아요. 말에서 첨부를 뺄 때(`liveRemoveAttachment`)만 지워요.
- 진짜 모델로는 아직 안 돌려 봤어요(그림을 보고 답하는지, 실리 서버가 그림 조각을 연결 종류마다 잘 넘기는지).

## 답장 지시문 · 명령

| 마리나라 파일 | 줄 | 상태 | 우리 쪽 | 빠진 것 |
|---|---|---|---|---|
| routes/generate/conversation-prompt-formatting.ts | 317 | 안 함 | src/phone2reply.js (우리 것) | **답장 지시문은 우리 것을 써요. 바꾸지 않아요(소망, 2026-11-21).** 가져오는 지시문은 마리나라 기능이 쓰는 것만이에요(스케줄 · 루틴 요약 · 셀카 등) |
| services/generation/conversation-command-runtime.ts | 440 | 일부 | src/marinara/schedule-command.js | 상태 명령의 지시문 줄만. 나머지 명령 줄과 명령 처리는 아직 |
| services/conversation/character-commands.ts | 1682 | 일부 | | 상태 명령(schedule_update)만. react · selfie · cross_post · memory · call · spotify · youtube · scene 등은 아직 |
| services/generation/conversation-react-command-runtime.ts | 258 | 아직 | (우리 반응: src/phone2react.js) | |
| services/generation/conversation-side-effect-command-runtime.ts | 216 | 아직 | | |
| services/generation/conversation-cross-post-command-runtime.ts | 67 | 아직 | | 다른 방에 말 보내기 |
| services/generation/conversation-memory-context.ts | 80 | 아직 | | 기억 |
| services/generation/conversation-context-utils.ts | 80 | 일부 | src/marinara/group-responders.js | `formatSmartGroupCandidates`는 그대로. 나머지(스케줄 켜짐 읽기 · 상태 읽기)는 phone2sched.js가 같은 일을 함. `parsePromptPresetChoices`는 프리셋 기능이라 없음 |
| services/conversation/impersonate-prompt.ts | 107 | 아직 | | 내 답 대신 써 주기 |
| services/conversation/conversation-profiles.ts | 186 | 아직 | | 표시 이름 · 소개글 · 메신저 말투 |
| services/conversation/awareness.service.ts | 349 | 아직 | | 다른 방 일 알기 |
| services/conversation/auto-summary.service.ts | 593 | 아직 | (우리 대화 요약: src/phone2digest.js) | |
| routes/generate/conversation-connected-context.ts | 246 | 아직 | (우리: 롤플에 전하기 src/phone2back.js) | 롤플 채팅과 잇기 |

## 그림 · 소리 · 스티커

| 마리나라 파일 | 줄 | 상태 | 우리 쪽 | 빠진 것 |
|---|---|---|---|---|
| services/conversation/selfie-prompt.ts | 54 | 아직 | | |
| services/generation/conversation-selfie-command-runtime.ts | 530 | 아직 | | 셀카 (그림은 오토픽으로) |
| services/prompt-overrides/registry/conversation.ts | 195 | 아직 | | 셀카 · 영상 지시문 |
| services/generation/conversation-video-runtime.ts | 740 | 아직 | | 영상 |
| services/conversation/call-character-videos.service.ts | 190 | 아직 | | |
| services/prompt-overrides/registry/conversation-call-videos.ts | 177 | 아직 | | |
| services/generation/conversation-call-command-runtime.ts | 31 | 아직 | | 통화 |
| services/generation/conversation-music-command-runtime.ts | 110 | 아직 | | 음악 |
| routes/custom-stickers.routes.ts | 310 | 아직 | | 스티커 |
| routes/generate/conversation-custom-assets.ts | 694 | 아직 | | 내 이모지 · 스티커를 캐릭터가 쓰기 |

## 2026-11-21에 다시 대 보고 채운 것

- 메모를 한 사람에게 보여 주기, 되살릴 때 고정 수 막기, 날짜 지난 휴지통 비우기
- 스케줄 쓰기 켜고 끄기(`conversationSchedulesEnabled`), 스케줄 내보내기 · 가져오기
- 먼저 건 말을 세는 때 · 이유의 쉬는 시간(말이 실제로 나온 뒤). 실패하면 쉬는 것은 서버 스케줄러만(2026-11-23)
- 상황 글(CONTEXT)을 마리나라처럼 항상 넣기: 스케줄이 없는 사람은 "online". 내 상태 · @ 부름 · 먼저 거는 차례 줄이 스케줄 없는 사람에게도 가요
- 따라 묻기가 마리나라처럼 점점 뜸해지고(두 배, 네 배) 세 번에서 멈추기, 이모지만 달면 첫 번째가 빨라지기: 방의 움직임을 기억해 두고(`syncUser` · `noteAssistant` · `noteReaction` · `forgetActivity`) 마리나라가 적는 때에 적어요
- 스케줄의 주인을 캐릭터 카드로(마리나라처럼, 소망 2026-11-21): 스케줄 · 손으로 준 상태 · 매주 갱신이 실리 카드의 `data.extensions.narrative_archive_convo`에 있고 그 캐릭터가 나오는 모든 채팅에서 같아요. 채팅의 `w.presence`는 사본. 실리에 카드가 없는 사람은 채팅의 것만 써요. 예전에 채팅에만 있던 것은 카드로 올라가요
- 시간대를 모든 채팅에 하나로(마리나라의 `rememberConversationTimeZone`): 확장 설정의 `conversationTimeZone`. 안 정했을 때는 그 사람 폰의 시간대(마리나라는 기기 시간)
- 말 거는 이유 글의 "the user"는 페르소나 이름으로 바꿔 넣어요(소망 2026-11-21). 마리나라 파일의 글은 그대로 두고, 넣을 때만 바꿔요
- 저절로 "자리 비움"(마리나라의 idle detection: 10분) · 자리 비움 중에 말을 보내면 활동 중으로
- 스케줄을 만들 때 카드의 설명 · 성격 칸을 마리나라처럼 따로 넘기기(실리 카드의 description · personality)
- 스케줄 요청의 온도(수리 0.45 · 조정 0.7 · 새로 0.8 · 변주 0.9, 요약 0.55)와 요약의 낮은 생각 정도가 모델에 가게 (`src/ai.js`가 `temperature`를 받아요)
- 생성 연결 고르기, 생성 중지가 요청을 끊기, 방 전체 설정(하루 상한 · 상한 같이 쓰기 · 캐릭터끼리 주고받기)

## 꼭 할 것 (소망이 "나중에 꼭 하셈"이라고 한 것, 2026-11-21)

- [ ] **실리태번의 연결 종류를 그대로 쓰는 방식을 확장의 모든 모델 칸에 넣기 (화면).** (소망, 2026-11-22: "지금 실리연결이 뭐든간에 그대로 가져오되 모델 불러오고 연결하는 기능 이 확장의 모든 모델관련 구간에 넣으셈 폰이든 아카이브든".) 코드는 됐어요(`src/ai.js`: 연결 방식 `source` — `stSourceList` · `stSourceModels` · `callStSource`, 키와 설정은 실리태번 것 그대로). 남은 것은 화면이에요: 확장 패널 · 폰 설정의 AI 모델 · 초안 모델 · 번역 모델 칸에 "연결 종류 고르기 + 모델 불러오기"를 붙이는 것(디자인 세션). 실제 실리태번에서 종류마다 돌려 보는 것도 남았어요.
- [x] **추론 레벨을 폰에서 정하기.** (소망, 2026-11-22.) `liveReasoning` · `liveSetReasoning`: 방마다 또는 Orbit 전체. 화면은 디자인 세션.
- [x] **캐릭터가 하는 일을 바꾸면 스케줄 표의 지금 칸이 고쳐져요.** (소망, 2026-11-22: "캐릭터 방에서도 되게 하면 안 돼?" · "지금 칸만 고치기 … 일단 이거만".) 마리나라의 `conversation-schedule-command-runtime.ts`(226줄, 끝까지 읽음)에서 표를 고치는 부분을 그대로 가져왔어요: `updateCurrentScheduleBlock`(글자 그대로) · `handleConversationScheduleCommand`의 updateSchedule 단계(`applyRoomScheduleCommand`). `src/marinara/schedule-command.js`, 부르는 곳은 `src/phone2sched.js` takeStatus.
  - 하는 일 · 상태가 지금 시간에 걸린 칸에 적혀요. 시간을 줬고 그게 칸이 끝나기 전이면 칸을 둘로 쪼개요(뒤는 free time · online). 표에 남아요.
  - **마리나라와 다른 것**: 마리나라는 이걸 여럿이 쓰는 공유 방에서만 하고(방마다 표의 사본이 따로 있어요), 캐릭터 방에서는 임시 상태만 써요. 우리는 캐릭터 방에서 해요. 우리 표의 주인은 캐릭터 카드라서, 고친 칸은 그 캐릭터가 나오는 모든 채팅에 보이고 다음 주에도 남아요(매주 갱신을 켜 두면 새 표로 바뀌어요).
  - 지금 시간에 걸린 칸이 없으면(스케줄이 없거나, 자정을 넘어가는 칸) 마리나라의 캐릭터 방 그대로 임시 상태로 둬요. 자정을 넘는 칸을 못 고치는 건 마리나라 코드가 그래요(끝 시각이 시작보다 작은 칸을 안 봐요).
  - 내가 손으로 준 상태가 있으면 표도 안 고쳐요(마리나라의 캐릭터 방 규칙을 여기에도). 표를 고치면 전에 걸려 있던 임시 상태는 풀어요.
  - 나중 일정을 넣거나 옮기는 것은 없어요(마리나라에도 없어요).
- [x] **캐릭터 명령 스위치 (마리나라의 Commands).** (소망, 2026-11-22: 화면의 "스케줄 갱신" 스위치가 "아직 연결되지 않았어요".) `src/marinara/conversation-command-toggles.js`: `shared/types/chat.ts`의 명령 열쇠 · 읽기(81~147줄) + `client/features/chat-settings/lib/conversation-command-toggles.ts`(144줄, 끝까지) + 서버의 `isConversationCommandEnabled` · 전체 스위치(`characterCommands !== false`). 마리나라의 채팅 설정 이름 그대로 `presence.meta`에 둬요. `liveCommands` · `liveSetCommands`(src/phone2go.js). 끄면 답장 지시문에서 그 명령이 빠지고 답에 있어도 안 받아요(마리나라의 `filterEnabledConversationCommands`). **이 확장에 있는 명령은 둘뿐이에요: `schedule_update` · `react`.** 교차 게시 · 기억 · 장면 · 영향 · 노트는 명령 자체를 아직 안 가져와서 `works: false`로 알려 줘요(화면에 안 그리는 게 맞아요).
- [x] **캐릭터가 방금 들은 자기 상태를 되돌려 쓴 것은 "바꾼 것"으로 안 받아요 (우리 것. 소망, 2026-11-22: "스케줄이 반영이 안 됨").** 마리나라에서 `schedule_update`는 캐릭터가 바꿀 때만 붙이는 꼬리표예요. 우리는 답장 JSON의 `"status"` 칸이라, 모델이 요청의 CONTEXT에서 읽은 지금 상태를 답장마다 그대로 채워 넣어요. 그걸 새 명령으로 받아서 임시 상태가 답장마다 다시 걸렸고, 밤에 쓴 상태가 다음 날 낮까지 남아 스케줄이 안 보였어요. `takeStatus`(src/phone2sched.js): 지금 상태와 같으면 안 바꾸고, 하는 일은 그대로인데 상태만 다르면 상태만 바꾸고 끝나는 때는 그대로 둬요. 다시 읽은 마리나라 파일(11월 20일 것): `conversation-schedule-command-runtime.ts`(226줄, 끝까지) · `ConversationPresenceCard.tsx`(918줄, 끝까지) · `character-commands.ts`의 schedule_update 부분(1~20 · 58~63 · 444~452 · 1190~1215 · 1665~1682줄; 파일 전체 1682줄은 아니오) · `conversation-command-runtime.ts`의 명령 줄 만드는 부분(165~290 · 440~477줄; 전체 477줄은 아니오) · `generate.routes.ts` 15640~15700줄.
  - **더 큰 원인 (같은 날 고침)**: 스케줄이 있는 사람의 답장 형식에서 `"status"`가 JSON의 첫 칸이고 예시가 채워져 있어서, 모델이 답장마다 새 상태를 지어 썼어요(되돌려 쓰기만이 아니라). 맨 끝 칸으로 옮기고 기본을 `""`로 했어요(`src/phone2reply.js`, 기록은 `docs/PROMPT-RULES.md`). 진짜 모델로는 아직 안 봤어요.
  - 같이 고친 것: 손으로 준 상태를 저장할 때 `expiresAt: null` · `place: null`을 적어 넣어요(마리나라의 카드 저장과 같게). 실리 서버는 카드의 확장 칸을 열쇠마다 합쳐서, 빠진 열쇠는 앞 상태의 끝나는 때 · 장소가 그대로 남았어요.
  - **알아둘 것 (마리나라와 같아요)**: 캐릭터가 바꿀 수 있는 것은 "임시 상태"예요(끝나는 때가 있고, 지나면 스케줄로 돌아가요). 스케줄 블록 자체를 고치는 코드(`updateCurrentScheduleBlock`)는 마리나라에서도 여럿이 쓰는 공유 방에서만 돌아요. 그리고 **내가 손으로 준 상태(끝나는 때 없음)는 캐릭터가 못 바꿔요**(마리나라: "A status the user set by hand has no end time, and it stays in charge"). 휴지통을 눌러야 스케줄로 돌아가요.
- [x] **추론 레벨 칩은 "실제로 되는 것"만 보여요 (마리나라와 다른 것. 소망, 2026-11-22: "끔 기능이 진짜 꺼지는 기능이 되는 거 아니면 싹 다 고쳐야" · "되는 칩만 보여줘야").** 마리나라는 자기 제공자 코드로 직접 보내서 칩과 요청이 늘 맞아요. 우리는 보내는 길이 넷이고 길마다 달라요. `liveReasoning`이 길마다 따로 만들어요.
  - **우리 커스텀 API 호출**(OpenAI 형식 · Anthropic 형식): 칩은 마리나라의 규칙 그대로. 끔 칩만 없어요: 우리 호출은 끔이면 레벨을 아예 안 보내서 모델이 기본대로 생각해요.
  - **실리를 거치는 길**(Vertex 방식 · 실리 연결 방식 · 연결 프로필): 실리가 연결 종류와 모델에 따라 레벨을 두 번 바꾸거나 빼요. 그 두 단계를 `src/phone2stlevel.js`에 옮겨서(SillyTavern 1.19.1), 칩은 실제로 닿는 것만, 같은 것이 되는 레벨은 칩 하나로 보여 줘요. 마리나라의 규칙은 이 길에서는 안 써요(실리가 정해요).
    - 읽은 실리 코드(전부 끝까지): `public/scripts/openai.js` getReasoningEffort(2545~2665) · createGenerationParameters(2691~3128) · `public/scripts/extensions/shared.js` ConnectionManagerRequestService.sendRequest · validateProfile · `public/scripts/custom-request.js` ChatCompletionService(421~607) · `src/endpoints/backends/chat-completions.js` sendClaudeRequest(230~420) · sendMakerSuiteRequest의 생각 설정(486~621) · 연결 종류마다 reasoning 이 나오는 줄 전부(1122~1137 · 1215 · 1321 · 1421 · 1560 · 1730 · 2348 · 2427 · 2459 · 2500 · 2521 · 2536 · 2548 · 2559 · 2600~2607) · `src/prompt-converters.js` calculateClaudeBudgetTokens · calculateGoogleBudgetTokens(1124~1322) · `src/constants.js` 461~515.
    - 예: Gemini 2.5 Flash는 끔 · 낮게 · 보통 · 높게 · 최대, Gemini 3 Pro는 낮게 · 높게 둘, Claude Opus 4.8은 낮게 · 보통 · 높게 · 최대, DeepSeek은 끔 · 낮게 · 높게 · 최대. Gemini 4 · xAI의 grok-4 · Mistral · Claude Haiku 5.5는 실리가 레벨을 안 보내서 칩이 없어요(`why: 'st'`).
    - 끔은 실리의 "생각 보기"도 꺼서 보내요. DeepSeek · Z.AI · Moonshot · OpenRouter는 그래야 꺼져요.
  - **연결 프로필**: 전에는 고른 레벨이 안 갔어요(프리셋의 레벨만 감). 이제 실리의 프로필 요청에 얹어 보내요(`sendRequest`의 overridePayload). 값은 실리 자신의 `createGenerationParameters`로 만들어서 실리 버전을 따라가요(`stLevelPayload`). 안 고르면 전처럼 프리셋 그대로.
  - **실리의 지금 연결을 그대로 쓰는 방**: 값을 실을 자리가 없어서 칩이 없어요(`why: 'main'`).
  - 이 연결에 칩이 없는 값이 저장돼 있으면 안 정함으로 다뤄요(저장한 값은 그대로).
  - 같이 고친 것: Vertex 방식은 낮게 · 보통 · 높게만 가고 끔 · 최대는 '자동'으로 떨어지고 있었어요(`callVertexAt`).
  - **확인 못 한 것**: 표는 실리 1.19.1의 코드예요. 소망의 실리가 더 새 버전이면 다를 수 있어요(예: 새 실리는 Gemini 4를 알 수도 있어요). 진짜 요청으로는 아직 안 돌려 봤어요.
- [x] **추론 레벨 규칙을 마리나라 11월 20일 것(staging, 32c47a1)으로 통째로 바꿨어요.** (소망, 2026-11-22: "1글자도 빠짐없이 읽고 가져와".) 전 것(11월 6일, fc0333c)에는 Gemini 4 Carbon · Hydrogen · Neon이 없었어요. 네 파일을 처음부터 끝까지 읽었어요: `shared/constants/model-lists.ts`(1935줄) · `generation-parameter-relevance.ts`(506줄) · `providers.ts`(334줄) · `client/components/ui/GenerationParametersEditor.tsx`(1072줄) + `client/lib/generation-level-label.ts`(12줄). 앞의 세 파일은 `src/marinara/`에 통째로 있어요(타입 표기만 뺌). 화면 파일에서는 추론 레벨 칩 부분만 가져왔어요(`liveReasoning`의 `choices[].name` · `title`). 달라진 것: 끌 수 없는 모델은 끔 칩이 없어요(Gemini 3.5~3.8 Flash · 4, GPT-6.1/6.2, Claude Opus 5.5 · Fable 등). 끔 대신 '기본' 칩이 나오는 모델이 있어요(Gemini 3.5 Flash-Lite 등). **마리나라와 다른 것**: 화면 파일의 다른 설정 칸(온도 · top-p · 말 길이 · 보내기 스위치 등)은 가져오지 않았어요. 마리나라가 제공자한테서 실시간으로 받는 레벨 정보(`capabilities`)도 없어요. 우리 '커스텀' 연결은 마리나라의 `custom`으로 보기 때문에, 커스텀 주소로 Gemini를 쓰면 일반 규칙(끔 · 낮게 · 보통 · 높게)이 나와요.
- [x] **추론 레벨 칩은 마리나라 화면이 그리는 대로.** (소망, 2026-11-22: "마리나라처럼 되는 칩만 보여줘야".) `client/src/components/ui/GenerationParametersEditor.tsx`의 추론 레벨 칩 부분(289 · 295~298 · 306~319 · 588~621줄)과 `client/src/lib/generation-level-label.ts`(12줄, 끝까지 읽음)를 가져왔어요. 칩 글자는 `label`(그 모델에 실제로 보내는 레벨)로 만들고, Claude Opus 5.5는 끔 칩이 없고, 줄마다 `selected`를 넘겨요. `liveReasoning`의 `choices[].name` · `roomChoices` · `allChoices`. 전에는 화면이 `value`로 글자를 만들어서 DeepSeek에 '보통' 칩이 보였어요(틀린 것). `GenerationParametersEditor.tsx`의 나머지(1070줄 가운데 다른 설정 칸)는 읽지 않았고 가져오지 않았어요. 화면 고치기는 디자인 세션 몫이에요.
- [x] **추론 레벨은 모델마다 받는 것만 보여 줘요 (마리나라의 규칙 그대로).** (소망, 2026-11-22: "모델별로 그대로 긁어오면 될 듯".) 마리나라 파일을 통째로 가져왔어요: `shared/constants/generation-parameter-relevance.ts`(428줄, 끝까지 읽음) · `model-lists.ts`(1688줄: 1~300 · 1400~1565줄은 읽음, 모델 표와 그림 · 영상 부분 302~1400 · 1566~1688줄은 복사만 하고 읽지 않음) · `providers.ts`(333줄: 복사만, 읽지 않음). `liveReasoning`이 방의 모델 기준으로 `choices`를 줘요. 요청에는 마리나라의 `resolveProviderReasoningEffort`가 정한 이름으로 가요. **마리나라와 다른 것**: 마리나라는 자기 제공자 코드로 보내고, 우리는 실리 서버나 우리 호출 코드로 보내요. 그래서 마지막에 그 길의 말로 한 번 바꿔요(실리 길: 끔 → min, xhigh → max). 마리나라가 제공자한테서 실시간으로 받는 레벨 정보(OpenRouter의 supported_parameters 등)는 안 가져왔어요. **주의**: 마리나라의 모델 표(fc0333c, 2026-11-06)에 없는 Google · OpenAI 모델은 레벨을 안 받는 것으로 나와요(마리나라의 `shouldSuppressUnknownModelParameters`). 새 모델이 나오면 표를 다시 가져와야 해요.

- [x] **연결 목록에 우리 확장의 칸 이름("초안 모델" · "AI 기능 모델")을 내지 않아요. 이름은 모델 이름이에요.** (소망, 2026-11-21.) 키는 새로 받지 않고 확장에 넣어 둔 것과 실리태번의 것을 그대로 써요(소망: "Api키는 실리 꺼랑 확장꺼 그대로"). 빠른 전환기의 "이 방이 쓸 모델 · 기본값으로 · 최근 두 개 · 즐겨찾기(순서)"는 마리나라의 `PUT /chats/:id/model` · `readChatModelOverride` · `applyChatModelOverride` · `reorderStars`를 그대로 써요(`src/marinara/chat-model.js`). 스케줄의 "생성 연결 고르기"도 같은 목록이에요. **마리나라와 다른 것**: 연결을 추가 · 삭제하는 화면, 모델 목록(catalog) 받아 오기, 저장한 모델 · 기본 모델 바꾸기는 없어요(연결은 확장 설정과 실리태번에서 정해요).

- [ ] **Merged 단체방의 지시문을 우리 지시문으로 바꾸기.** (소망, 2026-11-21: "일단 merged만 마리나라꺼 쓰셈", "꼭 우리 지시문으로 수정해야할 걸로 기록해두셈".) 지금 Merged 단체방은 마리나라의 Conversation 지시문을 그대로 써요(`src/marinara/merged-conversation.js`, 잇는 곳은 `src/phone2merged.js` · `phone2go.js gatherMerged`). 그래서 Merged 방의 답에는 번역(ko) · 폰에서 한 일(does) · 상태 줄 · 반응 · 상태 명령이 없어요. 우리 답장 지시문(`src/phone2reply.js`)에 "여럿의 말을 한꺼번에 쓰는" 모양을 만들어 바꿔야 해요. 바꿀 때 `docs/PROMPT-RULES.md`를 읽고, 답을 나누는 것은 `takeMerged` 자리에서 해요.

- [ ] **예비 연결.** 마리나라는 연결이 실패하면 예비 연결(fallback)로 한 번 더 해요. 아직 없어요. (무작위 연결은 안 쓰는 기능이라 뺐어요 — 소망, 2026-11-21: "무작위 연결은 안 쓸 기능이야 빼".)
- [x] **꺼 둔 이유(`disabledAutonomousIntents`) 지키기.** (2026-11-22, 작업 브랜치.) 마리나라는 서버가 돌릴 때(`server-autonomous-scheduler.service.ts`의 `resolveAvailableIntent`)만 이걸 봐요. 그 파일을 통째로 가져와서 서버 일꾼이 돌릴 때 지켜요(`tests/pluginauto.test.mjs`). 브라우저가 돌릴 때는 마리나라처럼 안 봐요.

## 아직 마리나라와 다른 것 (이미 넣은 기능 안에서)

- 캐릭터 명령 켜고 끄기(방마다): 명령을 더 가져올 때 같이 넣어요(`conversation-command-runtime.ts`).
- 연결: 마리나라는 실패했을 때 쓸 예비 연결이 있어요. 우리는 없어요. 무작위 연결("random")은 안 쓰는 기능이라 가져오지 않아요(소망, 2026-11-21).
- 꺼 둔 이유(`disabledAutonomousIntents`): 마리나라는 서버가 돌릴 때(`server-autonomous-scheduler`)만 봐요. 창이 열려 있을 때의 길에는 그 검사가 없어요. 우리도 같아요: 서버 일꾼이 돌릴 때만 봐요.
- 방에 사람 넣고 빼기: 마리나라는 들어오고 나갈 때 카드 변수를 채우고 지워요. 우리에게는 카드 변수가 없어서 그 처리가 없어요.
- 대화 요약: 마리나라는 요약한 말을 `hiddenFromAI`로 바꿔요. 우리는 우리 요약(`phone2digest.js`)을 써요. 아직 안 대 봤어요.

- 한 채팅에 답장을 만드는 것은 하나(`generate.routes.ts activeGenerations`, 2026-11-22에 1331 · 1505–1560 · 1895 · 16197–16262줄과 이 자물쇠를 보는 `chats.routes.ts` · `turn-games.routes.ts` · `index.ts` · `server-autonomous-scheduler.service.ts` 342~343줄을 읽음. generate.routes.ts 16,262줄 전체는 아니오): 우리는 `plugin/lock.mjs` 방 자물쇠(마리나라의 채팅 하나 = 우리 방 하나, 열쇠는 저장 id/방 id). 마리나라는 서버만 답장을 만들어서 서버 안의 Map 하나로 돼요. 우리는 브라우저 탭도 만들어서 탭도 같은 자물쇠를 받아요(`/auto/claim`). **다른 점**: ① 탭이 쥔 것은 5분 동안 소식이 없으면 풀려요(탭은 일하다 닫힐 수 있어서. 5분은 먼저 말 걸기 "만드는 중" 표시의 `GENERATION_TIMEOUT_MS`). 일꾼의 것은 마리나라처럼 시간 제한이 없어요. ② 같은 쪽은 겹쳐 잡을 수 있어요(일꾼의 `generate`가 잡은 방을 그 안의 `liveGo`가 또 잡아요). ③ 멈춘 생성이 놓을 때까지 10초 기다리기(`STOPPED_GENERATION_RELEASE_WAIT_MS`)는 없어요: 우리에게는 생성 멈추기(`/abort`)가 없어요.
- "만드는 중" 표시(`markGenerationInProgress`): 마리나라는 서버 한 곳에 있어서 브라우저 · 스케줄러 둘 다 봐요. 우리는 브라우저와 일꾼에 **따로** 있어서 서로 안 보여요. 그래서 판단(`liveAutonomous`)을 방 자물쇠 안에서 최신 것을 받은 뒤에 하고, 줄 세운 먼저 건 말이 그 방을 기다리는 사이 다른 쪽이 먼저 걸었으면 버려요(`phone2go.js wroteSince`).

## 우리가 덧붙인 것 (마리나라에 없음)

- 지운 방 되살리기(방 휴지통).

- 스케줄 블록의 `place`(어디서): 폰 장소를 바꾸려고. 장소를 묻는 지시문 `placeSystem`은 우리 것.
- 끝 시각 `24:00`을 `00:00`으로 바꿔 저장.
- 지금 답장(`liveReplyNow`).

## 채팅 설정 화면 (client/components/chat/ChatSettingsDrawer.tsx, 11,524줄, 대화 모드)

2026-11-21에 네 구간으로 나눠 끝까지 읽고 조작 목록을 뽑았어요(3.220.0). 게임 모드에 딸린 것(낱말 포함)은 넣지 않아요(소망). 화면은 `src/phoneorbitset.js`(우리 디자인, 레이아웃 · 이름은 마리나라). "화면"은 조작이 화면에 있는지, "동작"은 눌렀을 때 실제로 되는지예요. 동작이 없는 조작은 누르면 "아직 연결되지 않았어요"가 떠요.

| 마리나라 섹션 (줄) | 화면 | 동작 | 빠진 것 · 다른 데 |
|---|---|---|---|
| 창 머리 5526–5547 (도움말 · 보기 초기화 · 즐겨찾기 레이아웃 · 잠금 · 닫기) | 다 | 닫기만 | 고정(pin)은 폰 시트에서 마리나라도 숨김 |
| 팁 줄 5549 · 채팅 버튼 레이아웃 5575 | 없음 | | 마리나라도 폰에서는 숨김(데스크톱 전용) |
| 설정 프로필 5592–5768 | 다 | 없음 | 프로필 만들기 창(ChatProfileBuilder: 슬롯 · 적용할 채팅 고르기)은 단추만 |
| 메시지 검색 5770 (검색 · 북마크 · 휴지통) | 다 | 다 | |
| 채팅 제목 5786 | 다 | 다 | |
| 채팅 분기 5801 | 다 | 없음 | 분기 그래프 창 · 통계 창 · 범위 내보내기 흐름은 단추만 |
| 연결 5819 | 일부 | 없음 | 지금 답장에 쓰는 모델을 모델 이름 + 제공자로 보여 줘요(우리 설정의 칸 이름은 화면에 안 써요, 소망). 모델 고르는 창(ConnectionSwitcherBody 1,740줄)은 머리 · 검색 · 모델 줄(별표) · 계정 추가만. 폴더 · 계정 목록은 없고, 무작위(주사위 · 무작위 풀)는 소망이 빼라고 함. 여기서 골라도 바뀌지 않아요 |
| 프롬프트 프리셋(대화) 5864 | 다 | 없음 | 확장 편집기 · 매크로 참조 창은 단추만 |
| 고급 매개변수 10274 | 없음 | | 소망이 빼라고 함 |
| 페르소나 6132 | 다 | 없음 | 페르소나 고르는 창 · 카드 편집 칸(InlineChatCardEditor)은 단추만 |
| 캐릭터 6337 | 다 | 추가 · 제거(단체방) | 카드 편집 칸은 단추만. 끌어서 순서 바꾸기 없음. 카드 CSS 3단 고르기(카드에 CSS가 있을 때만 뜸) 없음 |
| 단체 채팅 6661 (둘 이상일 때) | 다 | 없음 | |
| 범위 지정 정규식 6530 | 없음 | | 캐릭터에 정규식 스크립트가 있을 때만 뜸. 우리에겐 그 스크립트가 없음 |
| 채팅 변수 6652 | 없음 | | 소망이 빼라고 함 |
| 연결된 채팅(대화) 7535 | 일부 | 없음 | Discord 미러와 게임 연결은 소망이 빼라고 함(롤플레이 연결만). Noodle · Slurp 토글은 그 패키지가 있을 때만 떠서 없음 |
| 로어북 7831 | 일부 | 없음 | 로어북 줄 · 항목 편집 칸(InlineLorebookEntriesEditor · LorebookEntryRow 2,092줄)은 로어북이 있어야 뜨는 것이라 빈 상태 · 추가 창만 |
| 활성 컨텍스트 7891 | 다 | 없음 | 항목 줄(상태 점 · CONST/SELECT/NORMAL · 벡터 · 위치 · #순서 · 열기 · 키 · 일치 · 펼친 내용) · 예산 안내 줄까지 그려요. 채울 값(`T.ctx`)을 줄 함수가 아직 없어서 실제로는 빈 상태만 떠요 |
| 에이전트(대화) 7130 | 일부 | 없음 | 명령 카드(패키지 없이 뜨는 7개) · 스케줄 생성 환경설정은 다. 패키지가 있어야 뜨는 것은 없음: 명령 11개(셀카 · 동영상 · 음악 · 햅틱 · 통화 · UNO · 체스 · 포커 · 8볼 · 틱택토 · 가위바위보), 일러스트레이터 설정 카드, 통화 패키지 설정, 장기 기억 카드, 사용자 지정 에이전트 고르기 · 설정 카드, 햅틱 카드 |
| 갤러리 7921 | 일부 | 없음 | 단추 줄 · 검색 · 선택 · 탭 · 올리기 · 빈 상태는 다. 그림 줄의 단추(고정 · 내려받기 · 움직이게 · 프롬프트 복사 · 삭제), 크게 보기, 검색 결과 줄은 그림이 있어야 뜨는 것이라 없음 |
| 기억 회상(대화) 9995 + 기억 창 10855 | 다 | 없음 | 기억 줄(잊기 단추)은 기억이 있어야 뜸 |
| 기능 호출 10177 | 없음 | | 소망이 빼라고 함(2026-11-21) |
| 번역 10266 | 다 | 없음 | |
| 자율 메시지 6921 | 다 | 켜기 · 체크인 제한 · 캐릭터 간 대화 · 재생성 · 시간대 · 기기 설정 사용 · 스케줄 편집 | "스케줄" 토글은 동작 없음(반영 쪽에 스케줄을 통째로 끄는 함수가 없음) |
| 자동 요약 10009 + 요약 편집 창 | 다 | 없음 | 요약 줄(펼쳐서 요약 · 핵심 세부 고치기)은 요약이 있어야 뜸. 의미 기반 검색의 세 값은 막대(슬라이더) 대신 숫자 칸 |
| 섹션 머리마다: 도움말 · 새 창으로 열기 | 도움말만 | 없음 | 도움말은 화면 맨 위에 글로 늘 보임(마리나라는 ? 를 눌러야 뜸). 새 창으로 열기는 소망이 빼라고 함 |
| 캐릭터 추가할 때 인사말 고르기 창 10705 · 에이전트 추가 창 10395 | 없음 | | |

한국어 낱말: 마리나라 저장소에는 영어(en.json)만 있어요. 소망이 보내 준 화면의 낱말은 그대로 쓰고, 나머지는 같은 말투로 옮겼어요.

## 빠른 전환기 (입력칸의 ^, 3.221.0)

2026-11-21에 아래 파일을 끝까지 읽고 만들었어요. 화면은 `src/phoneorbitset.js`의 `orbitSwitcher`, 누르기는 `src/phone.js`의 `na_ow_*`.

| 마리나라 파일 | 줄 | 화면 | 동작 | 빠진 것 · 다른 데 |
|---|---|---|---|---|
| components/chat/QuickSwitcherMobile.tsx | 172 | 다 | 열기 · 닫기 · 탭 | ^ 단추 둘레의 컨텍스트 고리, 탭 위 컨텍스트 막대는 값을 줄 함수가 없어 안 떠요(`W.ctx`가 오면 그려요) |
| components/connections/ConnectionSwitcherBody.tsx | 1740 | 일부 | 검색 · 목록 오가기 · 순서 편집 | 지금 줄, 검색(즐겨찾기 → 계정별 → 친 글자를 ID로, 계정 안에서만 찾기 · 모든 계정 검색), 맨 화면(즐겨찾기가 맨 위 · 계정 · 계정 추가: 즐겨찾기만 따로 여는 화면은 소망이 뺌), 계정 화면(계정 머리 · 새로 고침 · 즐겨찾기 · 모든 모델), 모델 줄(역할 알약 · ✓ · 설정 · 즐겨찾기 · ↑↓)은 다 있어요. 고르기 · 즐겨찾기는 저장되지 않아요(누르면 알림, 즐겨찾기는 시트가 열린 동안만). 없는 것: 무작위(소망이 뺌), 폴더 묶음 · 내장 모델 줄 · 계정의 켜기/키 추가 단추 · 사용량 막대 · 한도 도달 알약 · 값(비용) 알약 · 곧 없어질 모델 안내(우리에겐 그 정보가 없음), "기본값 사용" 단추(메인을 안 따를 때만 뜨는데 우리는 늘 메인을 따름), 고른 뒤의 되돌리기 · "메인 모델로 만들기" 알림 |
| components/characters/CharacterPickerList.tsx | 652 | 일부 | 검색 · 더 보기 | 검색 · 없음 줄 · 페르소나 줄(사진 · 제목 · ✓) · 50개씩 더 보기 · 빈 상태 · 안 맞을 때 "검색 지우기"는 다 있어요. 고르기는 저장되지 않아요. 없는 것: 페르소나 폴더, "캐릭터로 플레이" 묶음(실리태번에 그 개념이 없음) |
| components/connections/ModelRow.tsx · ServiceRow.tsx · ListFrame.tsx · chat/ContextBudgetIndicator.tsx | 334 · 177 · 183 · 70 | (위 화면의 부품) | | 제공자 타일은 없음(소망이 뺌) |

역할 알약: 답장에 쓰는 칸은 "메인", AI 기능에 쓰는 칸은 "기능"으로 적었어요(마리나라의 Main · Agents 자리. "기능"은 소망이 정한 이름).

## 말 하나에 하는 일 · 입력칸의 클립 (3.222.0)

2026-11-21에 읽은 파일: ConversationMessageActions · MessageActionButton · MessageReplyPreview · MessageThinkingModal · ReactionAddButton · MessageMarks · ConversationMessageShared(직접), ConversationMessage · Bubble · Line · Grouped · SwipeJumpControl · MessageReactions · PeekPromptModal · GenerationReplayDetailsModal · ConversationInput(나눠 읽힘). 우리 쪽은 길게 누르면 뜨는 판이 마리나라의 액션 줄이에요(마리나라는 폰에서 한 번 누르면 떠요).

| 마리나라 액션 (순서) | 화면 | 동작 | 빠진 것 · 다른 데 |
|---|---|---|---|
| 복사 | 다 | 다 | |
| 답장 (MessageReplyPreview) | 다 | 다 | `liveReplyTo` · `liveReplyDraft` · `liveCancelReply` · `sendLive(..., { replyTo })`. 글이 없는 말에는 단추가 꺼져요. 입력칸 위 미리 보기(✕ 취소), 보낸 내 말 위 인용 |
| 반응 추가 | 다 | 다 | 사용자 지정 이모지 탭 없음 |
| 북마크 · 고정 · 메모 (MessageMarks) | 다 | 다 | 북마크 이름 칸, 고정 설명 글(최대 10개), 비공개 메모(저장 · 제거)까지. 메모는 그 메뉴 안이 아니라 아래 시트에서 써요. 메모를 캐릭터 하나에게 보여 주기(롤플레이용)는 없음. 말의 메모 아이콘을 눌러 메모 보기 없음 |
| 번역 | 다 | 다 | 우리 것은 "재번역"(한국어 줄 다시 받기) |
| 편집 | 다 | 다 | |
| 재생성 | 다 | 다 | 터치에서 "새 스와이프로 재생성할까요?" 확인 창 없음. 입력칸 글을 지침으로 쓰는 "재생성(지침)" 없음 |
| AI에게 숨기기 | 다 | 다 | 숨긴 말을 접어 두는 설정(접힌 줄 "AI에게 숨김 · 표시") 없음 |
| 프롬프트 보기 (PeekPromptModal 1,063줄) | 일부 | 없음 | 마지막 캐릭터 말에만 떠요(마리나라와 같음). 창: 제목 · 출처 알약 · 섹션/토큰 수 · 복사 · 찾기(이전 · 다음, 찾은 글 표시) · 생성 정보 알약 · 섹션(접힘) · 채팅 기록. 시스템 역할 메시지는 화면에서 빼요(목록 · 찾기 · 복사 모두, 소망). 없는 것: "보낸 그대로"라는 참고 글과 알약, 결정 진단, 응답 점검 줄, "현재 컨텍스트 보기" 전환. 말에 저장된 프롬프트(`extra.cachedPrompt`)가 없어서 지금은 누르면 "이 차례에는 저장된 프롬프트가 없습니다"만 떠요 |
| 여기서 분기 | 다 | 없음 | 확인 창까지. 분기를 만드는 함수가 없음 |
| 저장된 지침 | 없음 | | 소망이 필요 없다고 함 |
| 모델 생각 보기 (MessageThinkingModal) | 다 | 없음 | 캐릭터 말에만 떠요. 말에 저장된 생각(`extra.thinking`)이 없어서 지금은 "저장된 생각이 없습니다"만 떠요. 마리나라는 생각이 있는 말에만 단추가 뜨는데 우리는 늘 떠요 |
| 삭제 (삭제 창) | 일부 | 다 | 우리는 바로 확인 창. 마리나라의 "이 스와이프만 삭제 · 다른 스와이프 모두 삭제 · 더 삭제" 고르기는 없음(스와이프는 받아 둔 답장 창에서, 여러 개는 "선택"으로) |
| (우리 것) 선택 | | 다 | 마리나라는 삭제 창의 "더 삭제"로 들어감. 위/아래 모두 선택 · 모두 해제 단추 없음 |
| 입력칸 클립 (ConversationInput 864–958, 2177–2274) | 다 | 고르기 · 거르기 · 빼기 | 고르기 창이 바로 열림, 받는 종류 · 여러 개 · 20MB 제한 · 못 쓰는 종류 알림, 붙여넣기 · 끌어다 놓기, 입력칸 위 줄(이름 · ✕, "파일 읽는 중..."). 보내기는 안 돼요(받는 함수가 없음): 붙어 있으면 보내기를 막고 알려요. 그림 줄이기(prepareImageAttachment), 보낸 말의 첨부 표시 · 크게 보기 · 말에서 빼기 없음 |

말 자체에서 아직 없는 것(마리나라에 있음): 얼굴 · 이름을 눌러 뜨는 About Me 창(채팅별 소개 고치기), 반응 알약에 올리면 누가 눌렀는지, 캐릭터 반응 지우기, 말마다 스와이프 조작(‹ n/m ›, 번호로 가기), 실패한 답장 줄("실패 · 다시 시도"), 대체 연결 표시, 장면 초대, 위 화살표로 마지막 말 고치기, 옆으로 밀어 스와이프.

### 3.223.0에 이은 것 (반영 쪽 3a6658b)

- 프롬프트 보기: `livePeekPrompt(real, 방, { messageId })`. 생성 정보(제공자 / 모델, Max Output Tokens, Reasoning, Temperature) 알약. 시스템 메시지는 화면에서 빼요. "현재 컨텍스트 보기"(current: true)는 아직 화면에 없어요.
- 모델 생각: `x.extra.thinking`. 없으면 안내만.
- 여기서 분기: `liveBranchRoom` → 새 방으로 옮겨요. 방 목록에 분기 이름(New Branch)을 보여 주는 것은 아직 없어요.
- 채팅 설정 › 자율 메시지의 스케줄 스위치: `liveSchedulesOn` · `liveSetSchedulesOn`.
- 빠른 전환기: 목록 `liveModelConnections`, 지금 것 `liveRoomModel`, 고르기 · 기본값 사용 `liveSetRoomModel`(고르면 닫히고 알림), 친 글자를 모델 ID로 쓰기(커스텀 API · Vertex만), 즐겨찾기 `liveStars` · `liveToggleStar` · `liveMoveStar`(확장 설정에 저장), 페르소나 `liveSwitchPersona`("없음"은 함수가 없어 그대로).
- 없는 것: 고른 뒤 알림의 "되돌리기" · "메인 모델로 만들기", 최근 쓴 모델(`recent`) 줄, 모델을 따로 고른 즐겨찾기(connectionId + model) 표시.
- 첨부 보내기: 반영 쪽이 줬어요(2026-11-22). 화면을 잇는 일이 남았어요: `liveReadFiles` → `liveStoreAttachments` → `sendLive(…, { attachments })`, 보낸 첨부 그리기 · 빼기, 그림 설명 설정(`liveCaptioning` · `liveSetCaptioning`).



## 첨부 보내기 (3.229.0, 반영 f560248의 함수에 화면을 붙임)

| 마리나라 기능 | 우리 화면 | 상태 |
|---|---|---|
| 파일 고르기 · 붙여넣기 · 끌어 놓기 (그림 · PDF · 글 파일, 20MB) | 입력칸의 클립 · 붙여넣기 · 끌어 놓기 → `liveReadFiles` | 됨. 못 받는 종류 · 큰 파일 · 못 읽은 파일은 알림 |
| 읽는 동안 "Still reading attached files" | 입력칸 위 "파일 읽는 중...", 보내기를 누르면 "아직 첨부 파일을 읽는 중입니다" | 됨 |
| 입력칸 위의 첨부 조각 (이름 · 빼기) | `ob_at` · `ob_ap` (그림은 작은 그림도) | 됨 |
| 글 없이 첨부만 보내기 | 됨 | 됨 |
| 보낸 말의 첨부: 그림은 보이고 누르면 크게, 그 밖은 파일 이름 | 말 바로 아래 `ob_atr`(말풍선 밖, 마리나라처럼) · 크게 보기 `ob_iv` | 됨. 3.229.0에는 말풍선 안에 넣었다가 소망이 못생겼다고 해서 3.229.1에 밖으로 뺐어요 |
| 말에서 첨부 하나 빼기 | 그 말을 길게 눌러 들었을 때만 첨부마다 ✕ → `liveRemoveAttachment` | 됨 (3.229.1에는 늘 보이게 했다가, 소망: 늘 보이면 안 돼요 → 3.229.2) |
| 방 목록 미리보기 | 글이 없으면 "사진" · "파일" (여럿이면 "사진 2개") | 됨 |
| Image captioning 설정 (켜기 · 연결 · 지시문) | 채팅 설정 › 그림 설명 | 됨 |

확인(가짜 모델, 실제 폰 틀): 못 받는 종류 알림, 그림 + 글 파일을 글과 같이 보내기, 글 없이 그림만 보내기, 답장이 옴, 크게 보기, 첨부 하나 빼기, 방 목록 미리보기, 그림 설명 켜기 · 연결 고르기 · 지시문 저장.
확인 못 함: 붙여넣기 · 끌어 놓기, PDF, 20MB 넘는 파일, 진짜 모델이 그림을 읽는지, 그림 설명이 실제로 만들어지는지.


## 캐릭터 명령 스위치 (3.229.4, 반영 5470ed6의 함수에 화면을 붙임)

채팅 설정 › 에이전트 › 명령. 맨 위 "명령" 전체 스위치 + 명령마다의 스위치. `liveCommands` · `liveSetCommands`에 이었고, id는 마리나라의 이름(schedule_update · cross_post · memory · scene · influence · note · react)이에요.
일곱 줄을 다 그려요. 반영이 `works: false`로 주는 줄(교차 게시 · 기억 · 장면 · 영향 · 노트: 이 확장에 그 명령이 아직 없어요)은 누르면 "아직 연결되지 않았어요"이고 저장하지 않아요. 명령을 가져오면 works가 true가 되어 저절로 이어져요. (3.229.4에는 works가 false인 줄을 안 그렸다가, 소망: "누가 멋대로 지금 안 되는 기능들 삭제하래" → 3.230.1에 되돌림)
확인(실제 폰 틀): 반응 끄기 · 켜기, 전체 스위치를 끄면 아래 줄이 사라지고 켜면 다시 뜸, "아직 연결되지 않았어요" 알림이 안 뜸.


## 먼저 건 말의 알림 (3.230.0, 반영 23dec1b의 신호 · 함수에 화면을 붙임 · 3.231.2에 다시 읽고 채움)

읽은 마리나라 코드: 위 "끝까지 읽었나" 표의 "먼저 건 말의 알림 — 화면" 두 줄. 3.230.0 때 이 칸에 "끝까지 읽은 코드"로 적었던 것 중 `SettingControls.tsx` · `chat.store.ts` · `ChatSidebar.tsx`는 사실 일부만 읽었어요(소망이 잡음). 2026-11-23에 처음부터 끝까지 다시 읽고 빠진 것을 넣었어요.

| 마리나라 | 우리 화면 | 상태 |
|---|---|---|
| 알림음 (playConfiguredNotificationPing) | 'na-live-auto'가 오면 `src/phone.js` 맨 위에서. 폰이 닫혀 있어도 울려요 | 됨 |
| 열린 방에 새 말이 나타나면 알림음 (ConversationView: 처음 불러온 말 · 이미 본 말 · 15초보다 오래된 말은 소리 없이) | 방을 그릴 때 이미 본 말(`obSeen`)과 대 봐요 | 됨 (3.231.2) |
| 지금 보는 방의 띠 "○○ messaged you" (5초, ✕) | 방 안 오른쪽 위 `ob_band` "○○님이 메시지를 보냈습니다" | 됨 |
| 다른 방의 프사 방울 (누르면 그 방으로, ✕, 수) | 오른쪽 가장자리 `ob_nb` (Orbit의 목록 · 방 화면에서) | 됨 |
| 방울이 8초 뒤 저절로 사라짐 (이 화면 몫만, NOTIFICATION_AUTODISMISS_MS) | `src/phone.js` 맨 위 `obNb` · `nbAdd` | 됨 (3.231.2) |
| ✕로 지운 방은 그 방을 열 때까지 다시 안 뜸 (dismissedNotifications), 방을 열면 방울 · 지운 표시를 지움 (setActiveChatId) | `nbDismiss` · `nbOpen` (방을 여는 모든 길: 목록 · 방울 · 새 대화 · 분기 · 가져오기 · 주인 방) | 됨 (3.231.2) |
| 서버 몫 방울 (hydrateUnread: 실리를 닫은 동안 온 말, 저절로 안 사라짐, 이 화면 몫이 있으면 그것이 먼저) | `liveAutonomousUnread`를 그릴 때마다 더해요 | 됨 (3.231.2) |
| 방울이 여럿이면 하나로 묶기 (모바일: 프사 3개 겹침 + 합계, 누르면 펼침, 하나 남으면 다시 접힘) | 없음: 방울을 하나씩 세로로 넷까지 | 소망이 뺐어요(3.231.4): 하나씩 보이는 모양으로. 3.231.2에 넣었다가 되돌림 |
| 떠 있는 글 "○○ sent you a message" | 없음 | 소망이 뺐어요(3.231.3): 메시지마다 하나씩 떠서 화면을 가려요. 방울 · 안 읽음 수 · 알림음으로 알아요 |
| 브라우저 알림 (showLocalMessageNotification) | 설정에서 켜고 권한을 받은 뒤. 제목 "○○님의 새 메시지" | 됨 (권한을 받은 상태는 확인 못 함) |
| 안 읽음 수 (incrementUnread · hydrateUnread) | 우리 방 목록의 안 읽음 수는 읽은 자리로 세서 그대로 늘어요 | 됨(따로 만들지 않음) |
| 목록 줄의 둘째 줄 (Row liveness): 입력 중 > 생성 중 > "○○ replied" > "Unsent draft", 입력 중 · 생성 중은 도는 아이콘 | 마지막 말 미리보기 자리에: "○○님이 입력 중…"(답장 일이 도는 중) · "생성 중…"(차례가 된 일) · "보내지 않은 초안" | 됨 (3.231.2). 다른 것: "○○ replied"는 소망이 뺐어요(3.231.3): 그 자리엔 받은 말을 그대로 보이고 옆에 안 읽음 수. 마리나라는 미리보기 줄이 없고 이 줄만 있어요 |
| 방마다 보내지 않은 초안 (inputDrafts, localStorage) | `draftGet` · `draftSet` (열쇠 '세계 id\|방 id'), 방을 열면 되돌림, 보내면 지움 | 됨 (3.231.2). 전에는 방을 바꾸면 사라졌어요 |
| 1분 시계 (usePresenceClock) | `obClock` (3.231.1) | 됨. 다른 것: 마리나라는 바뀐 게 없으면 안 그리고, 우리는 폰을 통째로 다시 그려요 |
| 알림 설정: 대화 모드 알림음(켜면 한 번 들려줌) · Only when unfocused(우리 글: "백그라운드에서만") · 이 화면의 글은 3.232.3부터 마리나라 en.json을 그대로 옮긴 말(소망: 풀어 쓰거나 지어내지 말고 마리나라 설정 글처럼) · 미리 듣기 | 채팅 설정 › 알림 | 됨 |
| 알림 설정: 브라우저 (권한 흐름 · 도움말 넷 · 성공/실패 알림) | 채팅 설정 › 알림 › 백그라운드 알림 | 됨 |
| 알림 위치 (위 · 아래, "오류 메시지와 다른 알림이 뜨는 곳") | 채팅 설정 › 알림 맨 위. 실리의 알림 위치(`#toastr_position`)에 넣고 실리가 저장해요(위 = 위 가운데, 아래 = 아래 가운데). 폰 안으로 옮겨 둔 알림 칸도 그 자리로 | 됨 (3.231.2). 실리에서 왼쪽 · 오른쪽을 골라 두었으면 위 · 아래만 보여요 |
| 모바일 앱 (백그라운드 · 생성 완료) | 없음 | 소망이 뺐어요(3.232.1): 마리나라 안드로이드 앱이 여기엔 없어요. 3.231.2까지는 흐리게 막아 두었어요 |
| 사용자 지정 알림음 카드 (이름 · 기본/사용자 지정/확인 중 · 설명 · 형식 · 미리 듣기 · 고르기/바꾸기 · 지우기, 10MB 넘으면 알림, 올리면 알림 + 한 번 들려줌) | 채팅 설정 › 알림. 반영 `src/phone2sound.js`(soundStatus · soundUpload · soundRemove, 서버 플러그인 `plugin/sound.mjs`) | 됨 (3.232.0). 다른 것: 실패 알림 뒤에 이유를 덧붙여요(예: 플러그인이 없음). 백업에는 안 들어가서 "백업에 포함" 글은 없어요 |
| 생성 완료 알림 (손으로 보낸 답이 끝났을 때 창이 뒤에 있으면 브라우저 알림. 제목 "New message from ○○"/"New message is ready") · 다른 방에서 끝나면 안 읽음 · 방울 · 알림음 (use-generate) | 반영의 'na-live-reply'를 `src/phone.js` 맨 위에서 들어요: 보고 있는 방이 아니면 방울 + 알림음, 브라우저 알림은 '생성 완료 알림 › 브라우저'(권한 흐름은 백그라운드와 같음). 먼저 건 말(auto)은 'na-live-auto'가 해서 건너뜀 | 됨 (3.232.0). 서버가 실리를 닫은 동안 보낸 늦은 답장(from: 'server')도 같아요 |
| 롤플레이 모드 알림음 | 없음 | 소망이 뺐어요(3.232.1): Orbit에 롤플레이 모드 방이 없어요 |
| 게임 모드 알림음 | 없음 | 소망이 게임 관련을 다 뺐어요 |
| 전화 알림 (addCallNotification · 방울의 받기/거절) | 없음 | 안 가져옴 (전화 기능이 없어요) |
| 여러 조각 말을 1.5초마다 하나씩 보이며 조각마다 알림음 (ConversationView) | 없음 | 우리 답장은 조각마다 따로 된 말이라 한꺼번에 보여요. 새 말이 생기면 한 번 울려요 |

"실리를 닫아도 와요" 표시: 채팅 설정 › 자율 메시지에 한 줄. `liveServerStatus`의 on이 false면 아무 표시도 없고, 그 방의 can이 true면 "실리를 닫아도 옵니다", false면 why를 보여 줘요. 답이 늦을 수 있어서 화면을 막지 않고 오면 다시 그려요.
확인(실제 폰 틀, 신호를 손으로 쏨): 띠가 뜨고 5초 뒤 사라짐, 목록에서 방울 + 떠 있는 글, 방울을 누르면 그 방으로 · ✕로 지움, 알림음 켬/끔 · 창이 뒤에 있을 때만 · 미리 듣기, 브라우저 알림이 막힌 환경에서 안 켜지고 이유가 뜸, 플러그인이 없을 때 서버 줄이 안 뜸.
확인 못 함: 서버 플러그인이 도는 상태(can true / false 줄), 진짜로 먼저 건 말, 브라우저 알림 권한을 받은 상태, 폰이 닫혀 있을 때의 떠 있는 글.
3.232.0 확인(실제 폰 틀, 시험용 실리에서 서버 플러그인을 켬): 답장 신호 → 목록에서 방울 + 알림음 · 떠 있는 글 없음, auto 신호는 아무것도 안 함, 보고 있는 방은 방울 없이 알림음 한 번, 알림음 올리기 → "사용자 지정" · 바꾸기 · 지우기 · 그 소리로 미리 듣기, 지우기 → "기본" · 내장 소리로 미리 듣기, 생성 완료 브라우저 토글이 막힌 환경에서 안 켜지고 이유가 뜸.
3.231.2 확인(실제 폰 틀, 신호를 손으로 쏨): 보는 방에는 띠만 · 방울 없음, 방울 하나씩(3.231.4부터 묶음 없음), ✕ 하나 지우면 하나만, 지운 방은 다시 와도 안 뜸, 8초 뒤 사라짐(목록의 "답장했습니다"도 같이), 그 방을 열고 나오면 다시 뜸, 서버 몫은 8초 뒤에도 남음, 목록 줄 "보내지 않은 초안" · "Lio님이 입력 중…", 방에 돌아가면 초안이 되돌아옴, 열린 방의 새 말에 알림음 한 번 · 1분 지난 말은 소리 없음, 알림 위치 아래 → 실리 칸 · 알림 칸이 아래 가운데로, 위로 되돌림, 모바일 앱 줄은 눌러도 아무 일 없음.
