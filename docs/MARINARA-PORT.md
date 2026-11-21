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
| services/conversation/server-autonomous-scheduler.service.ts | 예 (읽기만. 가져오기는 아직: "꼭 할 것"). 가져올 때 챙길 것: 60초마다(처음 20초 뒤), 창이 75초 안에 살아 있었으면 서버는 쉼, 오프라인 후속 2번까지, 한 번에 2방까지, 4xx 실패는 30분 쉼, 꺼 둔 이유 지키기, 안 읽음 표시 |
| 나머지 "아직" 파일 전부 | 아니오 |

## 스케줄 · 상태 · 먼저 말 걸기

| 마리나라 파일 | 줄 | 상태 | 우리 쪽 | 빠진 것 |
|---|---|---|---|---|
| shared/utils/conversation-presence.ts | 247 | 다 | src/marinara/conversation-presence.js | |
| services/conversation/schedule.service.ts | 638 | 다 | src/marinara/schedule.service.js | |
| services/conversation/timezone.ts | 161 | 다 | src/marinara/timezone.js | |
| services/conversation/intent.service.ts | 153 | 다 | src/marinara/intent.service.js | |
| services/conversation/autonomous.service.ts | 591 | 다 | src/marinara/autonomous.service.js | |
| services/conversation/autonomous-candidates.ts | 35 | 아직 | | |
| routes/conversation.routes.ts | 1353 | 일부 | src/marinara/autonomous-check.js · schedule-routes.js | /status(마지막 연락 · 상태 맞추기), /activity/* 는 우리 방의 말에서 다시 읽는 것으로 대신함. /busy-delay는 replyDelay('auto')로. 나머지 길은 가져옴 |
| client/lib/character-schedule-transfer.ts | 171 | 다 | src/marinara/character-schedule-transfer.js | (스케줄 내보내기 · 가져오기 함수도 들어 있음: 화면에서 부르면 됨) |
| client/hooks/use-autonomous-messaging.ts | 303 | 일부 | src/phone2tick.js · phone2go.js liveAutonomous | 순서 · 주기(30초) · 늦음 · 주고받기(2~5초 뒤) · 세는 때(말이 실제로 나온 뒤) · 실패하면 쉬었다 다시(5분부터 두 배, 1시간까지)는 맞춤. 코드는 우리 줄(queue)에 맞춰 다시 짬. 안 맞춘 것: 실패 종류에 따라 더 길게 쉬기(hard failure) |
| client/hooks/use-background-autonomous.ts | 400 | 아직 | | 다른 방(안 보고 있는 방)에서도 먼저 말 걸기 |
| client/lib/user-status.ts · user-presence-activity.ts · hooks/use-idle-detection.ts | 110 | 다 | src/marinara/idle-detection.js · phone2sched.js userStore | |
| services/conversation/server-autonomous-scheduler.service.ts | 507 | 아직 | | 실리 창을 닫아도 서버가 돌리기 (서버 플러그인) |
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
- 먼저 건 말을 세는 때 · 이유의 쉬는 시간(말이 실제로 나온 뒤), 실패하면 쉬었다 다시
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

- [ ] **연결 · 모델 고르기는 마리나라의 함수를 그대로 가져와요. 우리 확장의 칸 이름("초안 모델" · "AI 기능 모델")에 끼워 맞추지 않아요.** (소망, 2026-11-21: "초안모델 기능모델 ㅇㅈㄹ하면 죽여버린다 함수 그대로 가져오랬다".) 빠른 전환기의 "이 방이 쓸 모델 · 기본값으로 · 즐겨찾기(순서)"를 우리 칸에 맞춰 새로 썼다가 걷어냈어요. 마리나라의 연결 코드를 끝까지 읽고 그대로 가져온 뒤에 붙여요: `shared/types/connection.ts`(396) · `shared/schemas/connection.schema.ts`(223) · `connection-account.schema.ts`(164) · `server/services/storage/connections.storage.ts`(1562) · `connection-accounts.storage.ts`(844) · `server/routes/connections.routes.ts`(2723) · `connection-accounts.routes.ts`(432) · `server/services/connections/model-catalog.ts` · `model-stars.ts` · `client/hooks/use-connections.ts`(845) · `use-connection-accounts.ts`(256) · `use-model-star.ts`(168) · `client/lib/connection-groups.ts` · `connection-filters.ts` · `connection-jobs.ts` · `ConnectionSwitcherBody.tsx`(1740) · `chats.routes.ts`의 `PUT /:id/model` · `connection-resolution.ts`. 이 일에 무작위 연결 · 예비 연결(아래 줄)도 같이 들어가요. **지금 스케줄 "생성 연결 고르기"(`liveConnections`)도 칸 이름으로 되어 있어요: 같이 바꿔요.**

- [ ] **Merged 단체방의 지시문을 우리 지시문으로 바꾸기.** (소망, 2026-11-21: "일단 merged만 마리나라꺼 쓰셈", "꼭 우리 지시문으로 수정해야할 걸로 기록해두셈".) 지금 Merged 단체방은 마리나라의 Conversation 지시문을 그대로 써요(`src/marinara/merged-conversation.js`, 잇는 곳은 `src/phone2merged.js` · `phone2go.js gatherMerged`). 그래서 Merged 방의 답에는 번역(ko) · 폰에서 한 일(does) · 상태 줄 · 반응 · 상태 명령이 없어요. 우리 답장 지시문(`src/phone2reply.js`)에 "여럿의 말을 한꺼번에 쓰는" 모양을 만들어 바꿔야 해요. 바꿀 때 `docs/PROMPT-RULES.md`를 읽고, 답을 나누는 것은 `takeMerged` 자리에서 해요.

- [ ] **무작위 연결과 예비 연결.** 마리나라는 연결을 "random"으로 두면 무작위 묶음에서 하나를 고르고, 연결이 실패하면 예비 연결로 다시 보내요(`resolveConversationScheduleConnection`, `withConnectionFallbackProvider`, `connections.listRandomPool` · `getFallbackForAgents`). 우리 확장에는 그런 연결 설정이 없어요. 연결 설정을 만들고 스케줄 요청이 그걸 쓰게 해요.
- [ ] **꺼 둔 이유(`disabledAutonomousIntents`) 지키기.** 마리나라는 서버가 돌릴 때(`server-autonomous-scheduler.service.ts`의 `resolveAvailableIntent`)만 이걸 봐요. 서버 플러그인으로 그 파일을 가져올 때 같이 넣어요. 그 전까지는 꺼 둔 이유가 안 먹어요.

## 아직 마리나라와 다른 것 (이미 넣은 기능 안에서)

- 캐릭터 명령 켜고 끄기(방마다): 명령을 더 가져올 때 같이 넣어요(`conversation-command-runtime.ts`).
- 연결: 마리나라는 "random"(무작위 묶음에서 하나)과 실패했을 때 쓸 예비 연결이 있어요. 우리는 없어요.
- 꺼 둔 이유(`disabledAutonomousIntents`): 마리나라는 서버가 돌릴 때(`server-autonomous-scheduler`)만 봐요. 창이 열려 있을 때의 길에는 그 검사가 없어요. 우리도 지금은 안 봐요: 서버 쪽을 가져올 때 같이 넣어요.
- 방에 사람 넣고 빼기: 마리나라는 들어오고 나갈 때 카드 변수를 채우고 지워요. 우리에게는 카드 변수가 없어서 그 처리가 없어요.
- 대화 요약: 마리나라는 요약한 말을 `hiddenFromAI`로 바꿔요. 우리는 우리 요약(`phone2digest.js`)을 써요. 아직 안 대 봤어요.

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

