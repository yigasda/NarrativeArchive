## 리뷰 결과: 2cb04a0 (채팅 설정을 방마다로)

결론: 막을 문제(blocker)는 없어요. 고칠 것 3개, 참고 4개가 있어요. 레포는 건드리지 않았고, 모델도 부르지 않았어요.

테스트는 scratchpad 사본에 node_modules를 링크해서 돌렸어요. 1709개 통과, 1개 실패예요. 실패한 `tests/plugincode.test.mjs`는 0ebbd21에서도 똑같이 실패해요(scratch 경로 탓).

### 고칠 것 (should-fix)

**1. 새 방의 첫 값이 마리나라와 달라요 (끝까지 안 읽은 ChatSetupWizard.tsx 때문이에요)**
- 마리나라는 새 대화 채팅을 만들면 언제나 마법사를 열어요.
  - 여는 곳: `use-start-new-chat-mode.ts:58-65`, `use-start-chat-from-character.ts:56`, `ChatSidebar.tsx:779`, `NewChatConnectionGate.tsx:89`
  - 마법사를 닫으면 그 채팅을 지워요(`ChatSetupWizard.tsx:645-660`, `use-discard-new-chat-setup`).
- 그래서 실제 첫 값은 create(`chats.storage.ts:1645-1665`)가 아니라 마법사의 Start가 써요(`ChatSetupWizard.tsx:1264-1273`).
  - `autonomousMessages`: 기본 켜짐 (907, `!== false`)
  - `conversationSchedulesEnabled`: true/false를 꼭 적어요 (909)
  - `characterCommands`: 저장한 기본값이 없는 새 채팅이면 false (1020-1026)
  - 둘 다 켜져 있으면 바로 `/schedule/generate`를 불러요 (1282-1293)
- 우리 것(`src/phone2store.js:315-330`, `src/phone2sched.js:144`)은 먼저 말 걸기가 꺼짐, 명령이 켜짐, 스케줄 스위치는 비어 있음이에요.
  - 전에 Orbit 전체에서 먼저 말 걸기를 켜 둔 사용자는 이제 새 방에서만 캐릭터가 조용해져요.
- `docs/MARINARA-PORT.md:59`의 "이번 일은 이 파일들에 기대지 않아요"는 틀려요.
- 고치는 법: 소망에게 둘 중 하나를 물어요.
  - (가) `setRoomSeed`에 마법사 Start 값을 넣기
  - (나) 지금대로 두고 "마리나라와 다른 것"에 적기
- 어느 쪽이든 ChatSetupWizard.tsx를 끝까지 읽은 뒤 표를 고쳐요.

**2. 방 안의 상태 점 · 상태 메뉴가 방 id를 안 넘겨요**
- 해당 줄: `src/phone.js:467` (머리줄 상태 점 `st:`), `1174` · `1176` · `1177` (대화 상태 카드의 상태 고르기 · 하는 일 고치기)
- 같은 머리줄의 하는 일(447)만 그 방의 규칙이에요. 그래서 스케줄을 끈 방에서 점 색과 하는 일 글이 서로 달라질 수 있어요.
- 디자인 메시지에도 이 줄들이 없어요.
- 고치는 법: `liveStatus(realM, n, r.id)` 또는 `obRoomId()`를 넘기고, 디자인 메시지 2번 목록에 넣어요.

**3. 매주 갱신이 방의 연결을 안 써요**
- 우리: `src/phone2tick.js:40` → `src/phone2go.js:641`은 방이 없어서 기본 연결로 물어요.
- 마리나라: 자동 갱신은 연 채팅의 상태 카드가 그 채팅 id를 실어 불러요(`ConversationPresenceCard.tsx:313-360`). 그래서 연결이 `chat.connectionId ?? 기본`이에요(`conversation.routes.ts:706-709`, 273-292).
- 고치는 법: 갱신할 사람마다 스케줄이 켜진 방을 하나 골라요(열린 방이 먼저, 없으면 첫 방). 그 방 id로 `liveRenewSchedules`를 불러요. 문서 269줄도 고쳐요.

### 참고 (note)

- **smart 고르기:** 마리나라는 `getDefaultForAgents() ?? conn`이 맞아요(`generate.routes.ts:8820`, `connections.storage.ts:645-660`). 다만 우리 `agentsReady`(`src/phone2go.js:601`)는 브라우저에서 언제나 true예요. 그래서 AI 기능 모델이 실리 쪽이고 프로필이 없으면, 같은 방에서도 브라우저는 실리 연결로, 서버는 방 연결로 물어요. 이 차이를 문서에 적어요.
- **추론 레벨 옮기기:** 옛 규칙은 방 값이 지금 연결에서 안 될 때 Orbit 전체 값으로 넘어갔어요(`mine_ || all`). 지금 `moveRoomMeta`(`src/phone2sched.js:120`)는 방 값이 있으면 덮지 않아서, 그런 방은 "안 정함"이 돼요. 드문 경우라 적어만 둬요.
- **번역 기본값 저장:** `liveSaveTranslatorDefaults(real)`에 방 id를 빼면(`src/phone2translate.js:149`, `156`) 빈 값 `"{}"`를 저장하고 "저장했습니다" 알림이 떠요. 방 id가 없으면 오류를 내는 게 좋아요.
- **비교할 것이 없는 키:** `crossChatAwareness`는 우리에게 없어요. 그림 설명의 "꺼짐 = 키 지움"이 마리나라에서는 자동 모드인 것은 이번 변경 전부터예요.

### 맞는 것 (확인함)

- **기본값:** 키마다 마리나라와 대 봤고 다 같아요.
  - `autonomousMessages`: `=== true` (scheduler 85)
  - `characterCommands`: `!== false` (generate.routes 3488)
  - `conversationCommandToggles`: video만 기본 꺼짐 (chat.ts 128-130)
  - `groupTurnPromptEnabled`: `!== false`
  - `groupResponseOrder`: sequential
  - `groupChatMode`: individual이 아니면 merged
  - 번역: `autoTranslate === true`
- **`conversationSchedulesEnabled`의 두 규칙:** `chats.storage.ts:557`의 `!== false`는 카드에서 사본을 채울지 정하는 문이에요. 그래서 실제로는 "값이 없으면 그 채팅 캐릭터에게 스케줄이 있을 때 켜짐"(conversation-context-utils 71-73)과 같고, 우리 `roomHasSchedules`와 맞아요.
- **분기:** `updateMetadata`가 메타를 통째로 바꿔요(chats.storage 1900-1918). 요약 열쇠 다섯과 게임 열쇠만 빼요(chats.routes 5732-5737). 우리와 같아요.
- **스케줄 만들기:** 그 채팅을 켜요(conversation.routes 843-860). manual 저장은 안 켜요(ChatArea 1609-1630). 우리와 같아요. 마리나라의 "shared" 상태는 우리 port에 없어서 생길 수 없어요.
- **하루 상한:** `dailyCapForCharacter`(autonomous.service 119-133)와 방마다 세는 것이 맞아요.
- **use-chat-agents.ts의 안 읽은 줄:** 이번 키를 쓰는 곳이 없어요.
- **시간대:** 앱 전체 하나로 두는 것이 마리나라와 같은 효과예요.

### 디자인 메시지

- en.json 글은 7개 모두 줄 번호까지 맞아요(10298 · 10299 · 10323 · 10334 · 10346 · 2807 · 18797).
- 지어낸 화면 글은 없어요.
- 빠진 것: 위 2번(`phone.js` 467 · 1174 · 1176 · 1177)이에요.