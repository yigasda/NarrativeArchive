# 마리나라 채팅 설정 저장 위치 조사 (cfc726e93)

결론부터: 마리나라는 설정 대부분을 채팅마다 `chat.metadata`에 둡니다. 채팅 행에 따로 있는 칸은 연결 · 프리셋 · 페르소나 · 캐릭터 · 이름뿐입니다. 앱 설정은 "새 채팅을 시작할 때 쓰는 값"만 들고 있습니다. 다만 겉으로는 채팅마다 있지만 실제로는 앱 전체 값인 것이 몇 개 있습니다(3번).

경로는 `.../scratchpad/ref-marinara-new/packages/`를 기준으로 줄여 썼습니다.

## 0. 읽은 범위

**끝까지 읽은 파일**
- `shared/src/types/chat-preset.ts`, `chat.ts`
- `ChatSettingsDrawer.tsx`, `ChatSettingsSection.tsx`, `chat-settings-surfaces.ts`, `lib/` 3개
- `SettingsProfilesSection.tsx`
- `chat-presets.storage.ts`, `app-settings.routes.ts`
- `chats.routes.ts`의 POST `/`, PATCH `/:id`, PUT `/:id/model`, PATCH `/:id/metadata` (1518–2103)
- 딸린 파일: `translator-defaults.ts`, `chat-window-defaults.ts`(shared · server), `chat-preset-apply.ts`, `chat-setup-draft.ts`, `chat-wizard-defaults.ts`, `use-chat-presets.ts`, `use-start-new-chat-mode.ts`

**일부만 읽은 파일 (끝까지 읽음: 아니오)**
- `ChatSetupWizard.tsx`: 650–870, 900–1300, 2230–2315
- `chats.storage.ts`: `create` 1620–1730
- 다른 `sections/*` · `agents/*`: 쓰는 키와 기본값만 grep으로 찾았습니다.
- `conversation.routes.ts`: 430–452

## 1. 설정 키 표

**약호**
- 저장: M=`chat.metadata`, R=채팅 행 칸, A=앱 설정, C=연결, K=캐릭터 카드, U=브라우저 UI 저장소
- 프로필: O=들어감, X=안 들어감(채팅 것), 시작값=손으로 적용할 때 복사만 됨
- 동기화: S=`CHAT_PROFILE_FOLLOWER_SYNC_KEYS`(chat-preset.ts 248–404)에 있음, `-`=없음

### 채팅 행 칸 (`Chat`, chat.ts 185–208)

| 키 | 프로필 | 동기화 | 기본값 | 고치는 곳 |
|---|---|---|---|---|
| name | X | - | "New {mode} chat"(use-start-new-chat-mode 52) | ChatNameSection (드로어 1818) |
| characterIds | X | - | [] | CharactersSection |
| personaId / personaCharacterId | 시작값(personaId만, storage 513–515) | - | 없음 | PersonaSection |
| connectionId | O (`INCLUDED_CHAT_KEYS` 423) | 안 함 (storage 510) | null=Main을 따름 (`followsMainModel`) | ConnectionSection (드로어 1848) |
| promptPresetId | O | 안 함 | 없으면 드로어가 "Marinara's Universal Preset"을 넣음 (드로어 365–380, 1373–1380) | ConversationPromptSection |
| connectedChatId · groupId · folderId · sortOrder | X | - | null | ConnectedChats / 사이드바 |

### metadata: 생성 · 문맥

| 키 | 프로필 | 동기화 | 기본값 | 섹션 |
|---|---|---|---|---|
| presetChoices | X(91). 대신 `presetVariables`로 따로 저장되고, 같은 프리셋일 때만 적용 (chat-preset.ts 45–57) | - | {} | PromptPreset (롤플레이) |
| customSystemPrompt | O | - | null=프리셋의 conversationPrompt | ConversationPromptSection (드로어 1896) |
| chatParameters | O | S, 같은 연결일 때만 (storage 57, 140) | 없음=연결 기본값 (AdvParams 120–121) | AdvancedParameters |
| contextMessageLimit | O | S | 없음=끔, 켜면 50 (AdvParams 267) | AdvancedParameters |
| excludePastReasoning / pastReasoningLimit | O | S | true / 1 (chat.ts 948–951) | AdvancedParameters |
| imageCaptioningEnabled / ConnectionId | O | S, 같은 연결일 때만 | 연결 기본값 | AdvancedParameters |
| imageCaptioningPrompt | O | S | 앱의 Image reading 지시문 | AdvancedParameters |
| enableTools / forceToolCall / activeToolIds | O | S | false / false / [] (빈 목록=켜진 도구 전부) | FunctionCalling |
| cardCssMode | O | S | disabled (드로어 438) | Characters 안 |
| scopedRegexMode | O | S | null=프리셋을 따름 (드로어 465–469) | ScopedRegex |
| customEmojiSelection | O | - | - | 스티커 설정 |

### metadata: 그룹

| 키 | 프로필 | 동기화 | 기본값 |
|---|---|---|---|
| groupChatMode | O | S | merged (chat.ts 36) |
| groupResponseOrder | O | S | sequential (Group 200) |
| groupTurnPromptEnabled | O | S | true |
| groupSpeakerColors · groupSpeakerNamesInHistory · groupPublicFacesEnabled | O | S | false |
| autoActiveCharacters | O | S | off |
| groupScenarioText · inactiveCharacterIds · autoActiveCharacterPins | X (102, 181–182) | - | - |

### metadata: 대화 기능

| 키 | 프로필 | 동기화 | 기본값 | 섹션 |
|---|---|---|---|---|
| crossChatAwareness | O | S | true (`!== false`) | ConnectedChats 89 |
| autonomousMessages | O | S | 드로어는 false (Autonomous 181). 마법사는 true로 시작해서 Start 때 저장 (wizard 907) | AutonomousMessaging |
| autonomousDailyCapOverride | O | S | null=말수 기준 | AutonomousMessaging |
| characterExchanges | O | S | false | AutonomousMessaging (2명 이상) |
| conversationSchedulesEnabled | O | S, 프로필에 값이 있을 때만 (storage 143) | 카드에 일정이 있으면 생성 때 true (chats.storage 1659–1660) | AutonomousMessaging |
| characterSchedules · scheduleWeekStart | X (103–104). 원본은 K | - | 카드에서 복사 | 일정 편집기 |
| conversationStatusOverrides · conversationCharacterStatuses | X. 원본은 K (chats.storage 1690–) | - | - | - |
| conversationTimeZone | O (제외 목록에 없음) | - | 3번 참고 | Autonomous 안 시간대 선택 (321) |
| characterCommands | O | S | true (chat.ts 715) | ConversationCommandsSettings |
| conversationCommandToggles | O | S | 전부 켬, video만 끔 (chat.ts 127–130) | 같은 곳 |
| imageGenConnectionId · selfieResolution · selfie*Avatar/Appearance · selfieVideo* · sceneVideoConnectionId · sceneVideoFirstFrame | O | S | - | ConversationAgentsSection |
| selfiePrompt / Positive / Negative | O | - | - | - |
| conversationCallsEnabled / CallVoiceCues / CallSummaryConnectionId | O | S | false / true / null | 통화 패키지 |
| conversationCharactersCanCall | O | - | 통화가 켜져 있으면 true | 통화 패키지 |
| slurp2ActivityContextEnabled | O | S | false | ConnectedChats |
| noodleTimelineContextEnabled | O | - (일부러 뺌, 235–236) | false | ConnectedChats |
| discordWebhookUrl | O. 이 기기에만 두고 내보내지 않음 (430–436) | - | - | ConnectedChats → DiscordMirror |
| conversationAboutMeInject | O | - | true | - |
| conversationAboutMeOverrides · conversationSetupComplete | X (187, 207) | - | - | - |

### metadata: 에이전트 · 음악 · 햅틱

| 키 | 프로필 | 동기화 | 기본값 |
|---|---|---|---|
| enableAgents | O | S | true (생성 때) |
| activeAgentIds | O | S. 각 채팅이 따로 세팅한 4개 에이전트는 채팅 것 유지 (storage 49, 148–151) | [] |
| agentPromptTemplateIds | O | S, 일부만 | - |
| agentOverrides | O | - | {} |
| customAgentImageSettings | O | S | - |
| enableHapticFeedback · hapticSensitivity · hapticIncidentalContact · hapticIntifaceUrl | O (주소는 이 기기에만) | S | - |
| spotifySourceType · PlaylistId · PlaylistName · Artist | O | S | - |
| longTermMemory* | O | S | - |
| customMusicExternalFolder · customMusicGameAssetsFolder | X (212–213) | - | - |

### metadata: 기억 · 요약

| 키 | 프로필 | 동기화 | 기본값 | 섹션 |
|---|---|---|---|---|
| enableMemoryRecall | O | S | 대화 모드는 true (chat.ts 608) | MemoryRecall |
| enableMemoryRecallWholeChat | O | S | false | MemoryRecall |
| advancedMemory | O. 단 knowledgeStarts · knowledgeConfirmed · narratorCharacterId는 채팅 것 (storage 42, 444–447) | S | - | - |
| summaryConnectionId | O | S | null | AutomaticSummarization |
| summaryMaxTokens | O | S | 4096 (chat.ts 334) | 같은 곳 |
| summaryTailMessages | O | S | 10 | 같은 곳 |
| dayRolloverHour | O | S | 4 | 같은 곳 |
| semanticSummary* | O | S | Enabled=false | 같은 곳 |
| hideSummarisedMessages · summaryContextSize · summaryRunInterval · automaticSummaryEnabled · summaryPromptTemplates · activeSummaryPromptTemplateId | O | - | - | - |
| summary · summaryEntries · daySummaries · weekSummaries · lastAutomaticSummaryMessageId · conversationSummaryFailures | X | - | - | - |

### metadata: 로어북

| 키 | 프로필 | 동기화 | 기본값 |
|---|---|---|---|
| activeLorebookIds | X (125). 프로필의 lorebookIds는 시작값으로, 손으로 적용할 때 합쳐짐 (storage 476–482) | - | [] |
| excludedLorebookIds | O (제외 목록에 없음) | - | [] |
| lorebookTokenBudget | O | S | `LIMITS.DEFAULT_LOREBOOK_TOKEN_BUDGET` (Lorebooks 48–51) |
| entryStateOverrides · entryTimingStates · agentLorebookAttachments | X | - | - |

### metadata: 번역 (`TRANSLATOR_SETTINGS_KEYS` 14개, translator-defaults.ts 3–14)
- 프로필 O, 동기화 S.
- 기본값: 앱 설정 `translator-defaults`. 없으면 google, "en" (62–94).
- DeepL 키 · DeepLX 주소는 암호화해서 이 기기에만 둡니다.
- 고치는 곳: TranslationSection. "기본값으로 저장"은 A에 씁니다 (use-translator-defaults 22–37).

### metadata: 화면 · 모델

| 키 | 프로필 | 동기화 | 기본값 |
|---|---|---|---|
| windowLayout | O | S | null. 창 기본값(A)이 덮음 |
| chatSettingsHintDismissed | O | S | false |
| background | 시작값 (storage 449–457) | - | - |
| followsMainModel | 적용할 때마다 다시 계산 (storage 505) | - | - |
| modelOverride · recentModels · deletedModel | 제외 목록에 없어서 프로필에 같이 저장됨 | - | - |

**그 밖에 채팅 것 (X)**
- 이름으로 적힌 것: tags, appliedChatPresetId, branch*, agentVariables, macroVariables, authorNotes, sprite*, autonomousUnread*, autonomousDailyBudget, intentCooldowns, spotifyRecentTracks, metadataWriteOrdinals, pixelforge (chat-preset.ts 76–224)
- `scene`으로 시작하는 키 전부: sceneVideoConnectionId · sceneVideoFirstFrame만 예외
- `multiplayer`로 시작하는 키 전부 (storage 59–66)

## 2. 규칙

### 새 채팅의 시작값 순서
1. **클라이언트:** 이 모드에서 별 표시된 프로필을 찾습니다 (`isActive && !isDefault`). 그 프로필의 connectionId · promptPresetId를 넣어 생성을 요청합니다 (use-start-new-chat-mode 45–57).
2. **서버 `create`** (chats.storage 1645–1665)
   - 번역 기본값(A)
   - 그 위에 `summary:null, tags:[], enableAgents:true, agentOverrides:{}, activeAgentIds:[], activeToolIds:[], windowLayout:null`
   - 그 위에 창 기본값(A, 모드별: windowLayout · chatSettingsHintDismissed · scopedRegexMode)
   - 카드에 일정이 있으면 conversationSchedulesEnabled=true, characterSchedules, scheduleWeekStart
   - conversationTimeZone은 가장 최근 대화 채팅에서 복사
3. **POST 라우트** (chats.routes 1538–1557)
   - 연결이 없으면 followsMainModel=true
   - 롤플레이는 트래커 기본값을 넣음
   - 카드 질문 기본값을 macroVariables에 넣음
4. **별 표시 프로필 적용** (비동기, 66–71). 마법사는 이 적용이 끝날 때까지 기다립니다 (wizard 662–664).
   - `applyToChat` 순서 (storage 459–474): baseDefaults(번역 기본값 + summary · tags · enableAgents · activeToolIds · hint=false) → 프로필 metadata → 프로필 번역 설정 → 채팅 것 → appliedChatPresetId
   - 프로필에 없는 설정 키는 지워집니다. 즉 기본값으로 돌아갑니다.
   - 예외 1: activeAgentIds · agentOverrides · agentPromptTemplateIds · customAgentImageSettings는 프로필에 없으면 채팅 것을 둡니다 (432–443).
   - 예외 2: windowLayout · background · 장면 영상 키 2개도 프로필에 없으면 채팅 것을 둡니다 (450–457).
5. **마법사 저장 기본값** (U의 `chatWizardDefaults[mode]`): 자동으로 적용됩니다 (wizard 784–800). 채팅 행 칸과 metadata를 둘 다 씁니다 (743–776). 생성된 상태 키는 뺍니다 (chat-wizard-defaults 23–37).
6. **마법사에서 고른 값** (대화 모드 Start): autonomousMessages · conversationSchedulesEnabled · characterCommands · conversationCommandToggles · conversationSetupComplete=true · chatParameters · customSystemPrompt · imageGenConnectionId를 씁니다. 마법사 안에서 프로필을 고르면 keepPersona로 적용합니다 (2297–2301).

### 프로필 적용 · 따라가기
- **드롭다운에서 고름** = 손으로 적용 (Profiles 92–95). connection · prompt preset · persona(있고 keepPersona가 아닐 때)까지 바꿉니다.
  - presetChoices는 같은 프리셋일 때만 바뀝니다.
  - "요약된 메시지 숨기기"에 따라 메시지를 숨기거나 다시 보이게 합니다 (497–501).
- **Default 프로필:** 설정이 비어 있고 저장 · 이름 바꾸기 · 삭제가 안 됩니다 (306, 561–566). 고르면 전부 시스템 기본값으로 돌아갑니다.
- **적용 중인 프로필을 지우면** Default를 다시 적용합니다 (Profiles 205–207).
- **"프로필에 저장"** (102–152)
  - 담는 것: connectionId, promptPresetId, presetVariables, metadata(+지금 창 배치) (79–90)
  - 프로필의 persona · background는 프로필 것을 그대로 둡니다. lorebookIds는 채팅 것으로 바꿉니다 (chat-preset-apply 35–48).
  - 서버가 채팅 것 키를 지웁니다 (storage 189–223).
- **따라가는 채팅** = `appliedChatPresetId`가 같고 멀티플레이가 아닌 채팅 (chat-preset.ts 410–420).
  - 저장할 때 "프로필만" / "N개 채팅도 갱신" 중 고릅니다.
  - 갱신하면 S 키만 바꾸고, 프로필에 없는 S 키는 지웁니다 (`syncFollowerMetadata` 133–157).
  - connection · prompt preset · persona는 건드리지 않습니다.
- **별 표시** = 모드마다 하나인 `setActive` (345–360).
- **PATCH metadata** (chats.routes 1850–2103): 맨 위 키를 그냥 합칩니다. 예외는 아래와 같습니다.
  - 비밀 값은 가려진 값을 보내면 기존 값을 유지합니다. 새로 적용한 프로필의 값이 이깁니다 (1859–1869).
  - macroVariables는 혼자만 보내야 하고, 이름 단위로 합칩니다.
  - conversationSchedulesEnabled=false면 characterSchedules를 지웁니다 (2005–2012).
  - groupChatMode를 정리하고, summaryMaxTokens는 범위 안으로 자릅니다.
  - windowLayout · hint만 바뀌면 updatedAt을 건드리지 않습니다 (2091–2099).

## 3. "전부 채팅마다"로 하면 틀리는 것 (앱 전체 값)
- **앱 설정** (`ALLOWED_KEYS` 66–77): 번역 기본값, 모드별 창 기본값, Chat Summary 지시문 틀, 사용자 생성 매개변수, 영상 생성 설정. 그 밖에 기능별 모델(vision · impersonate · mari), Image reading 지시문, 기본 임베딩 연결. 번역 기본값과 창 기본값은 새 채팅의 첫 값으로만 쓰입니다.
- **프로필:** 모드마다 목록 하나와 별 하나입니다. 채팅마다 따로 있지 않습니다. 채팅에는 `appliedChatPresetId`만 있습니다.
- **conversationTimeZone:** 채팅마다 들어 있습니다. 하지만 시간대를 바꾸면 모든 대화 채팅에 한 번에 씁니다 (conversation.routes 438–449). 원본은 U입니다. 실제로는 앱 전체 값입니다.
- **일정 · 상태 수동 설정:** 원본은 캐릭터 카드입니다. 채팅은 복사본만 갖습니다. 일정 생성 선호(`scheduleGenerationPreferences`)는 U입니다.
- **소개(about me) 기본값:** 카드 · 페르소나에 있습니다. 채팅에는 덮어쓴 값만 있습니다.
- **마법사 기본값:** U에 모드별로 있습니다.
- **Impersonate:** U와 기능별 모델에 있습니다 (ImpersonateSection 17–30). 채팅 것이 아닙니다.
- **고급 매개변수 기본값:** 연결 행에 있습니다 ("연결 기본값으로 저장", AdvParams 437–453).
- **Main 모델:** 앱 기본 연결입니다. connectionId가 null인 채팅은 Main을 따릅니다.
- **로어북 자동 켜짐:** global · 캐릭터 · 페르소나에 묶인 것은 로어북 쪽 값입니다. 채팅에는 activeLorebookIds · excludedLorebookIds만 있습니다.
- **U에만 있는 것:** colorInlineNames 옛 전역 값(드로어 441–443), 섹션 열림 상태(`chatSettingsExpandedSections`, 채팅이 아니라 섹션 id 기준), 트래커 패널 설정.

## 4. 코드상 눈에 띈 점 (그대로 둘지 우리가 정해야 함)
- 창 기본값으로 들어온 scopedRegexMode는, 그 키가 없는 프로필을 적용하면 지워집니다.
- conversationTimeZone도 같습니다. 그 키가 없는 프로필을 적용하면 지워집니다.
- modelOverride · recentModels · deletedModel은 제외 목록에 없어서 프로필에 같이 저장됩니다.

`docs/MARINARA-PORT.md`의 "끝까지 읽음" 칸에는 0번 끝의 파일들을 "아니오"로 적어야 합니다. 이번엔 읽기만 해서 고치지는 않았습니다.