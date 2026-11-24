# 마리나라 채팅 설정: 설정마다 저장 위치 (대화 모드 기준)

맡긴 19개 섹션 파일과 `chat-variables-rows.ts`는 끝까지 다 읽었어요. 아무것도 고치지 않았어요.

결론부터:
- 대화 모드 설정은 거의 다 **채팅 하나의 metadata**에 들어가요. 쓰는 길은 `PATCH /chats/:id/metadata`(`useUpdateChatMetadata`)예요.
- 이 길은 맨 위 키만 바꿔 끼워요(얕은 병합). 예외는 `macroVariables` 하나예요.
- 채팅 줄(row)에 들어가는 것은 `name` · `connectionId` · `promptPresetId` · `characterIds` · `connectedChatId`예요. 쓰는 길은 `PATCH /chats/:id`(`useUpdateChat`)예요.
- 채팅 하나에 묶이지 **않는** 것은 6가지예요(13번에 따로 모았어요).

## 0. 기준 경로와 쓰는 길

- 클라이언트 기준: `/tmp/claude-0/-home-user-NarrativeArchive/975737c5-a9a7-512f-9518-c3206c8f1a25/scratchpad/ref-marinara-new/packages/client/src/features/chat-settings/` (아래 `sections/…`, `Drawer:줄`은 이 아래)
- 서버 기준: `…/ref-marinara-new/packages/server/src/` (아래 `server:…`)
- `hooks/use-chats.ts`
  - 1171 `useUpdateChatMetadata` → `PATCH /chats/:id/metadata`
  - 1121 `useUpdateChat` → `PATCH /chats/:id`
  - 1106 `useSetChatModel` → `PUT /chats/:id/model`
- metadata 길: `server:routes/chats.routes.ts:1850~2100`
  - 맨 위 키 병합: 2063, 2096
  - `macroVariables`: 이것만 따로 보내야 해요. 이름 단위로 합치고, null이면 지워요(1935~2000).
  - `conversationSchedulesEnabled=false`가 오면 `characterSchedules` · `scheduleWeekStart`를 지워요(2005~2012).
  - 값 정리: `summaryMaxTokens` 범위 맞춤(2013), `groupChatMode` 정리(2001), 디스코드 주소 검사(1900~1907), `inactiveCharacterIds`는 이 채팅 캐릭터만 남김(1908~1925), `semanticSummary*` 검사(1887~1897).

## 1. 대화 모드에서 보이는 섹션 (`ChatSettingsDrawer.tsx`)

모드 판정은 `chat.mode`예요(Drawer:325~332). 보이는 칸 표는 `chat-settings-surfaces.ts:13~18`이에요(conversation: promptSettingsSurface="conversation", showGroupChatControls=true).

| 섹션 | 대화 모드 | 조건 (줄) |
|---|---|---|
| ChatName | 보임 | 조건 없음 (1818) |
| Connection | 보임 | 조건 없음 (1848) |
| ConversationPrompt | **대화 전용** | promptSettingsSurface==="conversation" (1889) |
| GameExtraPrompt | 안 보임 · **게임 전용** | (1901) |
| AdvancedParameters | 보임 | 조건 없음 (1946) |
| GameParty | 안 보임 · **게임 전용** | (1975) |
| Characters | 보임 | !isGame (1981) |
| CardFieldAlternatives | 보임 | 대체 필드가 있는 카드가 없으면 숨김 (1996, sections:71) |
| GroupChat | 보임 | 캐릭터 2명 이상 && showGroupChatControls (2001) |
| ChatVariables | 보임 | 조건 없음 (2022) |
| ConnectedChats (+DiscordMirror) | 보임 | 조건 없음 (2029) |
| ConversationNotes | **대화 모드에선 안 보임** | !isConversation && connectedChatId (2039) |
| CombatStyle · GameWidgets | 안 보임 · **게임 전용** | (2227, 2239) |
| FunctionCalling | 보임 | 게임 칸은 isGameMode일 때만 (2255) |
| AutonomousMessaging | **대화 전용** | isConversation (2325) |
| AutomaticSummarization | **대화 전용** | isConversation (2339) |

## 2. ChatNameSection (모든 모드)

- 이름 → 채팅 줄 `name`. `updateChat({name: trim})`, 바뀌었을 때만 써요(Drawer:1459~1464).
- 채팅 ID 복사 버튼은 저장하지 않아요(sections:62~82).
- 서버 쪽 리더는 따로 없어요. 화면에만 써요.

## 3. ConnectionSection (모든 모드)

- 모델 고르기(`ConnectionSwitcherBody` → `useChatModelPick.apply`) → `PUT /chats/:id/model`(server:chats.routes.ts:1769~1838).
  - 채팅 줄: `connectionId`
  - metadata: `modelOverride`(같은 계정의 다른 모델일 때만), `recentModels`(최근 목록), `followsMainModel`(기본값 따라가기면 true), `modelDeleted`→null
  - 키 이름 상수: `shared/src/schemas/connection-account.schema.ts:114~118`
- "기본값 따라가기" → 같은 길로 `connectionId: null`.
- "무작위" → `onConnectionChange("random")` → `updateChat({connectionId:"random"})`(sections:185, Drawer:1125).
- "메인으로 만들기"는 토스트 버튼이에요. 연결 자체의 `isDefault`를 바꿔요. 채팅 밖 설정이에요.
- 서버 리더:
  - `connectionId`: generate 전체.
  - `modelOverride`: `server:services/storage/connections.storage.ts:427`, `services/connections/model-stars.ts:37`.
- 기본값: `connectionId` 없음 = 메인 모델을 따라가요.

## 4. ConversationPromptSection (대화 전용)

- 프롬프트 프리셋 → 채팅 줄 `promptPresetId`.
  - `handleModePromptPresetChange`(Drawer:1386~1394)가 `setPreset`을 하고, 같이 `customSystemPrompt:null`도 써요.
  - 창을 열 때 프리셋이 없고 직접 쓴 프롬프트도 없으면 대체 프리셋을 **자동으로 저장**해요(Drawer:1373~1380). 대체 프리셋 순서: "Marinara's Universal Preset" → 기본 프리셋 → `isDefault` 프리셋(Drawer:373~387).
- 대화 프롬프트 글 → metadata `customSystemPrompt`(Drawer:1896).
  - 프리셋 글과 같거나 비면 null을 써요(sections:40~43).
  - 되돌리기 버튼도 null을 써요(sections:45~48).
- 기본 글: 프리셋의 `conversationPrompt`, 없으면 `DEFAULT_CONVERSATION_PROMPT`(sections:31).
- 서버 리더: `server:routes/generate.routes.ts:3834~3840`. `customSystemPrompt`가 있으면 그 글, 없으면 프리셋 대화 프롬프트를 써요. 그 밖에 chats.routes.ts:4217, 4286, `routes/generate/dry-run-route.ts`.

## 5. AdvancedParametersSection (모든 모드)

- 기본값: 대화 모드면 `CHAT_PARAMETER_DEFAULTS`(sections:98).
  - 값: temp 1, maxTokens 4096, topP 1, topK 0, reasoningEffort "maximum", verbosity "high", strictRoleFormatting true, singleUserMessage false…
  - 정의: `client/src/components/ui/GenerationParametersEditor.tsx:79~98`
  - 위에 연결의 `defaultParameters`가 덮여요(sections:116~119).
- 생성 파라미터 → metadata `chatParameters`(Drawer:1963).
  - 기본값과 다른 키만 저장해요(sparse, sections:184~218).
  - `enabledParameters`(보내기 스위치)는 바꾼 것만 남겨요(199~207).
  - strictRoleFormatting과 singleUserMessage는 둘을 같이 저장해요(208~216).
  - "기본값으로 되돌리기" → `chatParameters: {}`(458).
- 문맥 메시지 수 제한 → `contextMessageLimit`. 켜면 50, 끄면 null, 범위 1~9999(sections:267, 284).
- 과거 추론 빼기 → `excludePastReasoning`. 없으면 켜짐이에요(`!== false`, sections:122).
- 과거 추론 개수 → `pastReasoningLimit`. 기본 1, 범위 0~9999(323~324). 빼기를 끈 경우에만 보여요.
- 이미지 설명 → `imageCaptioningEnabled` · `imageCaptioningConnectionId` · `imageCaptioningPrompt`(Drawer:1971).
  - 기본값은 연결의 기본값을 따라요(sections:123~126, 154~157).
  - 프롬프트가 비거나 엔진 기본 글과 같으면 null을 써요(418~424).
- "연결 기본값으로 저장" → **연결** `defaultParameters`(`useSaveConnectionDefaults`, 435~449). 채팅 밖이에요.
- 서버 리더:
  - `chatParameters`: `services/generation/provider-generation-runtime.ts:121`, generate.routes.ts:3641, 5012
  - `contextMessageLimit`: generate.routes.ts:2514, chats.routes.ts:3023, `routes/generate/conversation-presence-runtime.ts`
  - `excludePastReasoning` · `pastReasoningLimit`: `services/generation/generation-parameters.ts:139~193`, generate.routes.ts:1885
  - 이미지 설명 세 키: `services/generation/image-captioning-runtime.ts:164~188, 294`

## 6. CharactersSection (대화 · 롤플레이)

- 캐릭터 추가 · 삭제 · 순서 → 채팅 줄 `characterIds`.
  - 추가 · 삭제: Drawer:981~1023, 순서: sections:127, 그룹 한 번에 추가: 322
  - 대화 모드는 첫 인사를 넣지 않아요(Drawer:1007).
- 삭제할 때 metadata에서도 같이 빼요: `spriteCharacterIds` · `spritePlacements` · `inactiveCharacterIds`(Drawer:944~963).
- 눈 버튼(켜기 · 끄기) → metadata `inactiveCharacterIds`.
  - 캐릭터 2명 이상이고 게임이 아니면 보여요(Drawer:492). 대화 그룹에서도 보여요.
  - 마지막 한 명은 끌 수 없어요(sections:98~117).
  - 서버 리더: `services/generation/roleplay-commands.ts:755`, `services/advanced-memory.ts:2967`, generate.routes.ts, `routes/generate/generate-route-utils.ts`
- 고정 핀 → `autoActiveCharacterPins`. 대화 모드에선 안 보여요. `autoActiveCharactersMode`가 롤플레이 merged에서만 "off"가 아니기 때문이에요(Drawer:594~599). 서버 리더: generate.routes.ts:3210.
- 카드 CSS 모드 → metadata `cardCssMode`.
  - 대화 모드에서도 캐릭터 카드에 CSS가 있으면 보여요(Drawer:1589~1658).
  - 저장 안 했을 때 기본값은 "disabled"예요(Drawer:438~439).
  - 서버 리더는 없어요. 클라이언트 `ChatArea.tsx`만 읽어요.
- 이름 색칠 → `colorInlineNames`. **롤플레이 전용**이에요(Drawer:1592).
- 연필(카드 바로 고치기) → **캐릭터 · 페르소나 카드 자체**를 고쳐요(`inline-editors/InlineChatCardEditor.tsx:246, 270`). 모든 채팅에 같이 적용돼요.
- 질문지 버튼은 카드 질문지를 열어요. 답한 변수는 `macroVariables`에 들어가요(Drawer:1346).

## 7. CardFieldAlternativesSection (모든 모드, 대체 필드가 있을 때만)

- 필드마다 고르는 대체 값 → **카드 쪽**에 저장돼요. 고른 대체 항목의 `chatIds`에 이 채팅 ID를 넣어요(sections:44, 76).
  - 캐릭터: `data.extensions.cardFieldAlternatives`(81~85)
  - 페르소나: `cardFieldAlternatives`(79)
- 채팅 metadata에는 아무것도 쓰지 않아요.
- 기본값 "" = 원래 글이에요(124).

## 8. GroupChatSection (대화에서는 캐릭터 2명 이상일 때)

대화 모드에서 보이는 칸:
- 방식 → `groupChatMode`: "merged"(대화에선 "Grouped") 또는 "individual".
  - 줄 차례대로 저장돼요(`serialize:true`, sections:47, 82, 97).
  - "individual"로 바꿀 때 `groupResponseOrder`가 "manual"이면 "sequential"로 같이 바꾸고, 토큰 경고를 띄워요(100~111).
  - 없으면 Grouped예요(Drawer:1998 주석, `normalizeGroupChatMode`).
- 답하는 순서 → `groupResponseOrder`: sequential(기본) · smart · manual(sections:197~229). individual일 때만 보여요.
- 차례 지시 넣기 → `groupTurnPromptEnabled`. 없으면 켜짐이에요(`!== false`, 243~267). individual일 때만 보여요.

롤플레이 전용(대화에선 숨김):
- `groupSpeakerColors`(126~145)
- `autoActiveCharacters`, "off"로 바꾸면 `autoActiveCharacterPins:[]`도 같이 씀(148~187, 51~60)
- `groupSpeakerNamesInHistory`(268~287)
- `groupPublicFacesEnabled`(288~307)
- `groupScenarioText`(312~338)

서버 리더:
- `groupChatMode`: generate.routes.ts:1445 → 6436
- `groupResponseOrder`: generate.routes.ts:3285, 6435, 8937, `services/multiplayer/service.ts:408`
- `groupTurnPromptEnabled`: generate.routes.ts:6439, 12591(대화 모드 멘션 처리)
- `groupChatMode`는 그 밖에 `services/conversation/autonomous.service.ts`에서도 읽어요.

## 9. ChatVariablesSection + chat-variables-rows.ts (모든 모드)

- 변수 → metadata `macroVariables`({이름: 문자열}).
  - 바뀐 이름만 보내요. 이름을 바꾸면 `{옛이름:null, 새이름:값}`, 지우면 `{이름:null}`(rows:108~119).
  - `trackChatMetadataSave`로 줄 세워 보내요(sections:107~118).
  - 서버는 합치고, 개수 상한 `MAX_CHAT_VARIABLES`를 넘거나 이름 규칙이 틀리면 400을 돌려요(chats.routes.ts:1935~2000).
  - `{{setvar}}`도 같은 묶음에 써요.
- 이름 규칙은 `validateChatVariableName`이에요. 예전 이름은 그대로 둬요(rows:32~39).
- 변수 상태 편집 버튼은 `chat-variables-editor` 창만 열어요(sections:252).
- 서버 리더: `services/prompt/assembler.ts:240, 897`, chats.routes.ts:4106, generate.routes.ts, `services/storage/chats.storage.ts`

## 10. ConnectedChatsSection + DiscordMirrorControls (모든 모드)

- 다른 채팅 알기 → `crossChatAwareness`. **대화 전용**이고, 없으면 켜짐이에요(`!== false`, sections:85~100).
  - 서버 리더: generate.routes.ts:4688("on by default")
- 캐릭터 DM 허용 → `roleplayCommandToggles.dm`(+켜면 `roleplayCommandsEnabled:true`). **롤플레이 전용**이에요(101~117).
- 채팅 연결:
  - 연결: `POST /chats/:id/connect`(server:chats.routes.ts:2617) → 채팅 줄 `connectedChatId`
  - 끊기: `POST /chats/:id/disconnect`(2635)
  - 대화 모드는 롤플레이 · 게임 채팅만 고를 수 있어요(sections:19~23, 172~173).
- Noodle 참조 → `noodleTimelineContextEnabled`. 패키지가 설치됐을 때만 보여요(199~214).
- Slurp 활동 → `slurp2ActivityContextEnabled`. 패키지가 설치됐을 때만 보여요(215~230).
  - 두 키 모두 서버는 chats.routes.ts:2025~2035에서 boolean 검사만 해요. server/src 안에 다른 리더는 없어요(패키지 쪽에서 읽는 걸로 보여요).
- 디스코드 미러 → `discordWebhookUrl`(231~234).
  - 서버가 암호화해서 저장하고, 화면에는 가린 값으로 돌려줘요(DiscordMirrorSection.tsx:19~21).
  - ""를 보내면 지워져요(48).
  - 서버 리더: generate.routes.ts:1607, 2882, 12434(`readChatMetadataSecret`), game.routes.ts:2997

## 11. FunctionCallingSection (모든 모드)

대화 모드에서 보이는 칸:
- 도구 쓰기 → `enableTools`(Drawer:2300). 없으면 꺼짐이에요.
- 도구 호출 강제 → `forceToolCall`(2301). 도구 쓰기가 켜졌을 때만 보여요.
- 켤 도구 목록 → `activeToolIds`(2302). 비어 있으면 기본으로 켜진 도구를 써요(server:tool-resolution-runtime.ts:229).
  - `update_about_me` 도구는 대화 모드에서만 나와요(sections:105).
- 새 사용자 도구 버튼은 도구 편집 화면으로 가요(Drawer:1030).
- 서버 리더: `services/generation/tool-resolution-runtime.ts:234, 248~249, 294`, generate.routes.ts:9934

**게임 전용**(isGameMode일 때만, sections:159~276):
- `gameGmToolConnectionId`, `gameOneRequestDice`(기본 켜짐), `gameDicePoolMode`, `gameDicePoolWindow`, `gameDicePoolAgeTurns`, `gameDiceOutcomeNarration`(기본 켜짐), `gameLorebookSearch`(Drawer:2271~2296)

## 12. AutonomousMessagingSection (대화 전용)

- 먼저 말 걸기 → `autonomousMessages`. 없으면 꺼짐이에요(sections:180~181).
  - 서버 리더: `services/conversation/server-autonomous-scheduler.service.ts:85`(`=== true`, 장면이 진행 중이면 빼요), `services/conversation/autonomous-candidates.ts:34`, `routes/conversation.routes.ts`
- 하루 연락 상한 → `autonomousDailyCapOverride`. null이면 기본값(말 많은 정도 기준), 숫자를 고르면 8에서 시작하고 1 이상이에요(198~233).
  - 서버: `services/conversation/autonomous.service.ts:119~133`
  - 캐릭터 상한과 채팅 상한이 둘 다 있으면 작은 쪽을 써요.
  - 둘 다 없으면 말 많은 정도로 정해요: 80↑8, 60↑6, 40↑5, 20↑3, 그 밖 2.
- 캐릭터끼리 대화 → `characterExchanges`. 캐릭터 2명 이상일 때만 보이고, 없으면 꺼짐이에요(244~259).
  - 서버: `routes/conversation.routes.ts:1299`(`/autonomous/exchange`)
- 일정 → `conversationSchedulesEnabled`(262~275).
  - 화면 기본: 값이 없으면 `characterSchedules`가 있을 때 켜짐이에요(54~56). 서버 `services/generation/conversation-context-utils.ts:71~73`도 같은 규칙이에요.
  - **주의:** `services/storage/chats.storage.ts:557`은 `!== false`예요. 새 채팅을 만들 때 쓰는 함수로 보여요. 기본값 규칙이 둘이에요.
- 일정 만들기 · 다시 만들기 → `POST /conversation/schedule/generate`(sections:82~92, server:conversation.routes.ts:685~856).
  - 채팅 metadata에 `characterSchedules[charId]`(캐릭터마다) · `conversationSchedulesEnabled:true` · `scheduleWeekStart`를 써요(843~856).
  - 일정은 **캐릭터 카드에도** 저장돼요. 다른 채팅이 같이 써요(854~855 주석).
  - 요청에 같이 보내는 `scheduleGenerationPreferences`는 UI store(앱 설정)예요(sections:80).
- 시간대(`ConversationTimeZoneSelect`) → UI store `conversationTimeZone`(앱 전체) + `PUT /conversation/schedule/timezone`.
  - 서버는 **모든 대화 채팅**의 metadata `conversationTimeZone`에 같은 값을 써요(conversation.routes.ts:439~450, 536~543).
  - 서버 리더: generate.routes.ts:1863~1865, `services/conversation/timezone.ts:41`
- 일정 편집 버튼은 `onOpenScheduleEditor(charId)`로 다른 화면을 열어요.

## 13. AutomaticSummarizationSection (대화 전용)

- 요약 고치기 버튼은 SummariesEditorModal을 열어요(`daySummaries` · `weekSummaries`). 이번에는 읽지 않았어요.
- 의미 검색 요약 → `semanticSummaryRetrievalEnabled`. Lite 판에선 숨겨요(sections:73~92).
  - 하위 값: `semanticSummaryRecentCount`(기본 2) · `semanticSummaryOlderCount`(기본 3) · `semanticSummaryMinSimilarity`(기본 0.15)
  - 정의: `shared/src/types/semantic-summary-retrieval.ts:4~6`
  - 서버 리더: `routes/generate/conversation-history-runtime.ts`, `services/generation/roleplay-summary-retrieval.ts:55`
- 요약 연결 → `summaryConnectionId`. 비면 에이전트 기본 연결을 써요(113~121).
  - 서버: `services/chat-summary/connection-resolution.ts:99`
- 요약 최대 길이 → `summaryMaxTokens`. 기본 4096, 범위 1~32768(`shared/src/types/chat.ts:334`).
  - 서버: chats.routes.ts:2572, 6218
- 하루가 바뀌는 시각 → `dayRolloverHour`. 0~11, 기본 4(153~161).
  - 서버: chats.routes.ts:2571, `routes/generate/conversation-history-runtime.ts:243`
- 남길 최근 메시지 수 → `summaryTailMessages`. 기본 10, 최소 0(chat.ts:325).
  - 서버: `routes/generate/conversation-history-runtime.ts:395`, chats.routes.ts:1052

## 14. 채팅 하나에 묶이지 않는 것

방 = 채팅으로 옮길 때 이 6가지는 채팅마다 나누면 안 돼요.

1. 시간대: 앱 설정이에요. 다만 서버가 모든 대화 채팅 metadata에 복사해요.
2. `scheduleGenerationPreferences`: 앱 설정(UI store)이에요.
3. 캐릭터 일정: 카드에도 있어요. 채팅에는 복사본(`characterSchedules`)이 있어요.
4. 대체 필드 선택: 카드 쪽 `chatIds`에 저장돼요.
5. 카드 바로 고치기: 카드 자체를 고쳐요.
6. "연결 기본값으로 저장" · "메인으로 만들기": 연결을 고쳐요.

## 15. 대화 모드에서 안 보이는 섹션

- **게임 전용:** GameExtraPrompt, GameParty, CombatStyle, GameWidgets, FunctionCalling의 게임 칸.
  - GameExtraPrompt 키: `gameSystemPrompt` · `gameSpecialInstructions` · `gameGmPromptTemplateId` · `gameSetupConfig.{ratingGuidelines, storyStyle, violence, contentBoundaries}`(Drawer:1902~1942)
  - GameParty 키: 채팅 줄 `personaId` · `personaCharacterId`, metadata `gamePartyCharacterIds`
  - CombatStyle 키: `gameCombatStyle` · `gameTacticalTurnOrder`
  - GameWidgets: `useUpdateGameWidgets`로 `gameWidgetState`
- **롤플레이 전용:** 8번의 롤플레이 칸, `colorInlineNames`, 캐릭터 DM(`roleplayCommandToggles.dm`).
- **ConversationNotes:** 대화와 연결된 롤플레이 · 게임 채팅에서만 보여요. 대화 캐릭터가 `<note>`로 저장한 메모를 보여줘요.
  - 저장은 metadata가 아니고 따로 있는 길이에요: `GET · DELETE /chats/:id/notes`(chats.routes.ts:2650~2661).

## 16. 끝까지 못 읽은 파일 ("끝까지 읽음: 아니오")

| 파일 | 상태 |
|---|---|
| `ChatSettingsDrawer.tsx` | 240~730, 918~1189, 1340~2379줄만 읽음. 1~239, 731~917, 1190~1339, 2380~2567은 안 읽음 |
| `inline-editors/InlineChatCardEditor.tsx` | 1~300줄만 읽음(저장하는 곳은 다 봄) |
| `InlineLorebookEntriesEditor.tsx` | 안 읽음. 맡긴 섹션은 쓰지 않음 |
| `lib/conversation-command-toggles.ts` | 안 읽음. 맡긴 섹션이 가져오지 않음 |
| `lib/memory-format.ts` | 다 읽음 |

맡긴 파일 말고, 대화 모드에서도 보이는 다른 섹션이 있어요. Lorebooks · MemoryRecall · Translation · SettingsProfiles · ConversationAgents · SceneInstructions예요. 이번 조사 범위가 아니라 아직 안 읽었어요.