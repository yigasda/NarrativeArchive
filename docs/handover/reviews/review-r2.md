검토 대상은 커밋 2cb04a0이에요. 저장소는 고치지 않았어요. 사본에서 테스트와 재현 스크립트를 돌렸고, 실제 모델은 부르지 않았어요. 출시 전에 막아야 할 것 1개, 고쳐야 할 것 2개가 나왔어요.

## 발견

### 1. [blocker, 메인에 올리기 전] 버전을 안 올렸어요
- 어디: `manifest.json:10`, `src/core.js:15`. 둘 다 `3.232.24`이고, origin/main과 같아요.
- 왜 문제: `plugin/code.mjs:56,64`는 확장 버전이 바뀔 때만 일꾼을 다시 띄워요. 버전이 같으면 일꾼은 옛 코드로 계속 돌아요. 새 페이지가 설정을 방으로 옮겨 저장하면 Orbit의 `presence.on`과 `meta`가 지워져요. 그러면 옛 일꾼은 이렇게 돌아요:
  - 먼저 말 걸기 꺼짐
  - 번역 꺼짐
  - 단체방이 merged 방식으로 바뀜
- 증거: `oldcode.mjs`. 옛 일꾼의 스케줄러 방 줄이 `["r1",false,null,null]`이에요. 옮기기 전에는 `true, "individual", true`였어요.
- 고칠 것: 3.232.25로 올려요.

### 2. [should-fix, blocker에 가까움] 첫 옮기기가 겹치면 사용자가 바꾼 설정이 조용히 되돌아가요
- 어디: `src/phone2keep.js:258,266`(`syncNow`). base는 옮기기 전이라 `room.meta`가 없어요. merge3는 양쪽이 같은 meta를 "새로 더했다"고 보고, 열쇠마다 서버 것을 골라요.
- 일꾼이 다른 방(r2)만 건드려도 r1의 변경이 사라져요. 일꾼의 첫 저장이 모든 방 조각을 보내기 때문이에요. 오류도 나지 않아요.
- 재현: `race.mjs`. 아래 넷 다 원래 값으로 되돌아가요. 안 고친 코드 그대로 돌린 결과예요.

  | 경우 | 사용자가 바꾼 것 | 결과 |
  |---|---|---|
  | off | 먼저 말 걸기 끔 | 켜진 채로 남음 |
  | tr | 번역 언어 fr | ko로 남음 |
  | group | 단체방 방식 | individual로 남음 |
  | oldpage | 옛 탭에서 끔(옮긴 것이 저장되기 전) | 켜짐 |

- 생기는 때: 업데이트 뒤 일꾼이 처음 쓰고, 브라우저가 그걸 받기 전(틱 30초 안)이에요. 기기가 둘일 때도 생겨요.
- 결과: 먼저 말 걸기를 꺼도 계속 켜져 있어서 모델 비용이 나가요. 에이전트가 말한 "서버 값이 이길 수 있다"가 실제로 생기고, 드문 경우만도 아니에요.
- 고칠 것: `makeKeep({ prep })` 훅을 더해요. `syncNow`에서 `joinLive`로 읽은 base와 server에 `prep`을 먼저 해요. `phone2keepon.js`가 `x => { moveRoomMeta({ live: x }); return x; }`를 넘겨요. 이러면 `phone2keep.js`는 계속 sched를 몰라요.
  - 고친 사본(`phone2keep.js` 세 줄만 바꿈)에서 넷 다 맞게 나와요: `race-fix.mjs`.
  - 이 경우를 지키는 테스트도 더해요.

### 3. [should-fix] 새로 고치지 않은 탭과 옛 일꾼은 옮긴 뒤 설정이 다 기본값이 돼요
- 어디: `src/phone2sched.js:122-125`. 옮긴 뒤 Orbit 값을 지워요.
- 증거: `oldcode.mjs`. 옛 코드가 옮긴 저장을 읽으면 이렇게 나와요:
  - `on: false`
  - 단체방 `merged`, 순서 `sequential`
  - 주고받기 끔, 번역 끔
- 옛 탭이 보이는 동안에는 `/auto/presence` 때문에 서버도 그 저장의 모든 방을 75초씩 건너뛰어요. 그래서 먼저 말 걸기가 아예 멈추고, 옛 탭이 만드는 단체방 답장은 다른 지시문으로 가요. "새로 고치라고 하지 말 것"(SERVER-HANDOVER 3-4)과 어긋나요.
- 고칠 것: 옮긴 뒤에도 Orbit 값을 지우지 않아요. 표시(`metaPerRoom`)가 있으면 새 코드는 그 값을 안 읽어요(grep으로 확인: 새 코드에 그 열쇠를 읽는 곳이 없어요). 그러면 옛 탭은 옮길 때의 값 그대로 돌아요. `phone2roommeta.test.mjs` 첫 테스트의 기대 하나만 바꾸면 돼요.

### 4. [note] 화면에 보이는 것 비교 (`same.mjs`)
- 무엇을 했나: 업데이트 전 모양의 Orbit을 만들었어요. 방 4개, 지운 방 1개, 스케줄, 손으로 준 상태, meta 열쇠 전부, 변형 4가지예요.
- 옛 코드와 새 코드로 아래를 다 비교했어요. 2692개 중 다른 것은 하나뿐이에요.
  - live* 읽는 함수 전부
  - 상태, 늦음, contextBlock, checkProactive
  - 일꾼의 방 줄, `resolveConversationPresenceState`
  - 틱이 도는 조건
  - 저장하고 다시 읽은 뒤의 값
- 다른 것 하나: 스케줄 있는 사람이 없는 방(Ren·Ivo 방 등)이에요. Orbit에 스케줄 스위치를 정한 적이 없으면, 그 방의 스케줄 스위치가 켬에서 끔으로 보여요(`phone2sched.js:146`). 그 방에 스케줄이 없어서 동작은 같고 화면만 달라요.

### 5. [note] 의도된 변화지만 업데이트 뒤 똑같지는 않은 것
- 하루 수와 쉬는 시간이 방마다예요. 방 둘에 있는 사람은 업데이트 직후부터 하루 두 배까지 먼저 말을 걸 수 있어요(비용이 늘어요).
- 저장해 둔 스케줄 생성 연결을 버려요. 영향은 셋이에요:
  - 매주 갱신(`phone2tick.js:40`)은 이제 기본 연결로 가요.
  - 편집 창의 처음 값은 그 방의 연결이에요.
  - 단체방 smart 고르기는 'ai' 칸으로 가요.
- 분기는 `autonomousMessages`까지 복사해요. 분기한 방에서도 바로 먼저 말을 걸어요.

### 6. [note] 새 세계에 표시가 없어요
- 어디: `src/phone2store.js:60-71`(`newWorld`)이 표시를 안 붙여요.
- 그래서 그 사이 옛 탭이 Orbit 값을 쓰면 첫 읽기 때 옮겨지거나, 방이 없으면 그냥 지워져요.
- 고칠 것: 만들 때 `metaPerRoom: 1`을 붙여요.

## 문제없던 것
- 조각: `room.meta`는 `room/<id>`에 들어가고, 지운 방은 머리 조각에 있어요.
- `store.mjs fork`는 통째로 복사해서 문제없어요.
- 일꾼 저장이 409면 읽어 둔 것을 버리고, 덮어쓰지 않아요.
- `resetLive('chats')`는 표시와 meta를 남겨요.
- `restoreRoom`, 보관한 세계(옛 모양 그대로, 아무도 안 읽음), 가져오기(`ensureRoom`이 먼저 옮김) 모두 괜찮아요.
- 옮기기를 두 번 해도 결과가 같아요.
- 옮긴 뒤 옛 탭이 Orbit 값을 써도, 새 탭에서 바꾼 방 설정은 안 없어져요.

## 테스트
| 무엇 | 결과 |
|---|---|
| `node --test tests/*.test.mjs` (그냥 · TZ=UTC) | 1710개 중 1709개 통과 |
| └ 실패 1개: plugincode "확장 폴더 찾기" | 사본 옆 폴더(`orc`)에 manifest가 있어서 생긴 것. 따로 떨어진 폴더에서는 3/3 통과 |
| fuzz | 5113 · 8663, problems 0 |
| POISON | 359개 통과 |
| `cmp.mjs` | checked 328 diff 0 |

## 파일
- 스크립트: `/tmp/claude-0/-home-user-NarrativeArchive/975737c5-a9a7-512f-9518-c3206c8f1a25/scratchpad/review-r2-scripts/` 폴더의 `race.mjs` · `race-fix.mjs` · `oldcode.mjs` · `same.mjs`
- 2번을 고친 사본: `/tmp/claude-0/-home-user-NarrativeArchive/975737c5-a9a7-512f-9518-c3206c8f1a25/scratchpad/review-r2-fix/src/phone2keep.js`
- 로그: `/tmp/claude-0/-home-user-NarrativeArchive/975737c5-a9a7-512f-9518-c3206c8f1a25/scratchpad/review-r2-tests.log` · `/tmp/claude-0/-home-user-NarrativeArchive/975737c5-a9a7-512f-9518-c3206c8f1a25/scratchpad/review-r2-tests-utc.log`