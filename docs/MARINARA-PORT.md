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
| 섹션 머리마다: 도움말 · 새 창으로 열기 | 다 | 없음 | 도움말은 화면 맨 위에 글로 늘 보임(마리나라는 ? 를 눌러야 뜸) |
| 캐릭터 추가할 때 인사말 고르기 창 10705 · 에이전트 추가 창 10395 | 없음 | | |

한국어 낱말: 마리나라 저장소에는 영어(en.json)만 있어요. 소망이 보내 준 화면의 낱말은 그대로 쓰고, 나머지는 같은 말투로 옮겼어요.

