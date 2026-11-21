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
