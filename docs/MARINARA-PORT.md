# 마리나라 콘보 코드 가져오기: 파일마다의 상태

마리나라(Marinara Engine 2.5.2, fc0333c)의 콘보 모드 코드를 **파일 단위로 빠짐없이** 가져오기 위한 표예요.
디자인 세션이 달라는 것만 가져오다가 기능이 반쪽으로 들어간 일이 있어서(2026-11-21), 이 표를 기준으로 해요.

규칙
- 파일 하나를 가져올 때는 그 파일의 기능을 전부 가져와요. 코드와 지시문은 그대로, 우리 저장 모양에 맞게만 고쳐요.
- **답장 지시문(`src/phone2reply.js`)은 우리 것이에요. 마리나라 것으로 바꾸지 않아요.** 마리나라 기능을 답장에 붙일 때는 우리 지시문에 그 기능의 줄만 더해요(예: 상태 명령 한 줄).
- 못 가져온 부분이 있으면 "일부"로 두고 무엇이 빠졌는지 적어요. 빼기로 한 것은 소망이 정한 것만 "안 함"으로 적어요.
- 화면(React 컴포넌트)은 디자인 세션 몫이라 이 표에 없어요. 화면 안에 든 동작(예: 편집 창의 고친 답 넣기)은 여기서 가져와요.

상태: **다** · **일부** · **아직** · **안 함**(소망이 정한 것)

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
| client/hooks/use-autonomous-messaging.ts | 303 | 일부 | src/phone2tick.js · phone2go.js liveAutonomous | 순서 · 주기 · 늦음은 맞춤. 코드는 우리 줄(queue)에 맞춰 다시 짬 |
| client/hooks/use-background-autonomous.ts | 400 | 아직 | | 다른 방(안 보고 있는 방)에서도 먼저 말 걸기 |
| client/lib/user-status.ts · user-presence-activity.ts | 40 | 일부 | phone2sched.js setUserStatus | 내가 한동안 안 건드리면 저절로 "자리 비움" 되는 것 |
| services/conversation/server-autonomous-scheduler.service.ts | 507 | 아직 | | 실리 창을 닫아도 서버가 돌리기 (서버 플러그인) |
| routes/generate/conversation-context-block.ts | 162 | 다 | src/marinara/conversation-context-block.js | |
| routes/generate/conversation-presence-runtime.ts | 492 | 일부 | phone2go.js holdReplies | 늦음 · 오프라인 · @ 부름은 맞춤. 단체방에서 답할 사람 고르기, 답한 뒤 다른 사람 부르기(mentionResponderDelays)는 아직 |
| services/generation/smart-group-decision.ts | 104 | 아직 | | 단체방에서 누가 답할지 |
| services/generation/conversation-schedule-command-runtime.ts | 226 | 다 | src/marinara/schedule-command.js | (공유 방 갈래는 우리에게 없음) |

## 말 · 방

| 마리나라 파일 | 줄 | 상태 | 우리 쪽 | 빠진 것 |
|---|---|---|---|---|
| shared/utils/message-marks.ts | 172 | 일부 | src/marinara/message-marks.js | 메모를 한 캐릭터에게 보여 주기(privateNoteRecipientId) |
| routes/generate/generate-route-utils.ts (숨기기) | | 다 | src/marinara/message-hidden.js | |
| services/storage/message-trash.storage.ts | 547 | 일부 | src/phone2room.js (우리 코드) | 마리나라 코드는 그쪽 DB에 묶여 있음. 동작(되살리기 · 30일)만 맞춤 |
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
| services/generation/conversation-context-utils.ts | 80 | 아직 | | |
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

## 우리가 덧붙인 것 (마리나라에 없음)

- 스케줄 블록의 `place`(어디서): 폰 장소를 바꾸려고. 장소를 묻는 지시문 `placeSystem`은 우리 것.
- 끝 시각 `24:00`을 `00:00`으로 바꿔 저장.
- 지금 답장(`liveReplyNow`).
