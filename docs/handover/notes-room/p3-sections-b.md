# 마리나라 채팅 설정: 설정마다 어디에 저장하고 어디서 읽는지

**결론:** 대화 모드에서 보이는 설정은 거의 다 채팅 한 개의 `chat.metadata`에 들어 있어요. 그러니 우리 방 하나를 마리나라 채팅 하나로 보면 그대로 맞아요.
채팅 메타데이터에 없는 건 넷뿐이에요.
- 페르소나: 채팅 줄(row) 칸 `personaId` · `personaCharacterId`
- 정규식 스크립트 켜기 · 끄기: 스크립트 줄 자체 (모든 채팅 공통)
- 일정 생성 선호: 앱 전체 설정
- 칸 펼침 상태: 앱 전체 설정

**읽은 범위:** 요청한 sections 11개와 4개 파일(ChatButtonLayoutSettings, ChatWindowFavoriteButton, PictureCheckFields, LocationBackgroundPins), `ChatSettingsDrawer.tsx`(2567줄)는 끝까지 읽었어요.
agents/ 폴더는 대화 모드에 쓰는 파일 10개를 끝까지 읽었어요.
- ConversationAgentsSection, ConversationCommandsSettings, agent-settings-renderers, IllustratorControls
- AgentLorebookAttachment, AgentPromptTemplateSelect, HapticSettings, HapticConnectionPanel
- LongTermMemorySettings, built-in-agent-cards, lib/conversation-command-toggles

**끝까지 못 읽은 파일 (`docs/MARINARA-PORT.md`에 "끝까지 읽음: 아니오"로 적어야 해요):**
- `use-chat-agents.ts`(2466줄): 1–900, 1085–1114, 1550–2058만 읽었어요. 900–1085, 1114–1550, 2058–2466은 안 읽었어요.
- `AgentAddModal.tsx`: 저장 코드만 grep으로 봤어요. 직접 쓰는 곳은 없었어요.
- 나머지 agents/ 파일(GameAgents, RoleplayAgents, RoleplayCommands, Storyboard, Beholder, Director, EchoChamber, ExpressionSprite, CardEvolution, LorebookKeeper, Spotify, Knowledge, HoldForRewrite, AgentSuiteModal, agents-section-parts, roleplay-agent-menu-icon, game-video-prompt-templates)은 롤플 · 게임용이라 안 읽었어요.

경로는 이렇게 줄여 써요. `C/` = `packages/client/src/features/chat-settings/`, `S/` = `packages/server/src/`.

---

## 0. 공통 규칙

- **모드 판정:** `chat.mode`가 conversation · roleplay · game 중 하나예요. 아니면 roleplay로 봐요 (`C/ChatSettingsDrawer.tsx:324-331`).
- **모드별로 보이는 칸:** `C/chat-settings-surfaces.ts:13-18`
  - 대화: profiles 보임, prompt는 "conversation", agents도 "conversation", group 보임.
- **메타 쓰기:** `useUpdateChatMetadata`가 `PATCH /chats/:id/metadata`를 보내요 (`client/src/hooks/use-chats.ts:1174-1175`).
  - 서버는 최상위 키만 얕게 합쳐요 (`S/routes/chats.routes.ts:1850~2036`).
  - 예외 1: `macroVariables`는 이름 단위로 합치고, 이 키만 따로 보내야 해요 (`:1935-2000`).
  - 예외 2: `agentLorebookAttachments`는 스키마로 검사한 뒤 합쳐요 (`:1880-1886`).
  - 예외 3: `illustrator(Video)RunInterval`은 0–100으로 잘라요 (`:2016-2023`).
- **새 채팅을 만들 때 서버가 넣는 값:** `S/services/storage/chats.storage.ts:1646-1656`
  - 번역 기본값(`translator-defaults`)
  - 즐겨찾기 배치(`chat-window-default-<mode>`)
  - `enableAgents: true`, `activeAgentIds: []`, `windowLayout: null`
- **칸 펼침 상태:** UI 스토어 `chatSettingsExpandedSections[id]`에 둬요 (`C/ChatSettingsSection.tsx:69-86`).
  - 앱 설정 `ui`로 서버에 동기화돼요 (`stores/ui.store.ts:2020`, `hooks/use-settings-sync.ts:55-56`).
  - 채팅별이 아니라 전체 공통이에요. 단, 통화 카드 id에는 chatId가 들어가요 (`use-chat-agents.ts:327`).

---

## 1. 요청한 칸별 정리

### PersonaSection: 대화 모드에 보여요 (`!isGame`, Drawer:1978)
- 고르기 · 지우기: 채팅 줄 칸 `chat.personaId` · `chat.personaCharacterId`예요 (`PersonaSection.tsx:146, 197-203`, `db/schema/chats.ts:25-26`).
  - 페르소나 하나 또는 캐릭터 하나 중 하나만 들어가요. 기본은 둘 다 null이에요.
  - 서버는 `S/routes/generate.routes.ts:1730-1731, 2851-2852`에서 읽어요.
- 연필 버튼: 그 페르소나나 캐릭터 카드를 바로 고쳐요 (InlineChatCardEditor). 페르소나 · 캐릭터 자체를 고치는 거예요.
- 온보딩 템플릿 줄: 대화 모드에선 빈 목록이에요 (Drawer:748).
- 글 속 페르소나 이름 색: **롤플 전용**이에요 (`PersonaSection.tsx:264-279`).
  - 키는 `colorPersonaInlineNames`예요. 값이 없으면 `colorInlineNames`를 따라가요 (Drawer:441-445).
  - 서버에서 읽는 곳은 없어요.

### PersonaHistoryReassignDropdown: PersonaSection 안에 있어서 대화 모드에도 보여요
- 고를 수 있는 범위는 `unassigned` · `persona` · `all`이에요. 기본은 `unassigned`예요 (`:22`).
  - 이 범위는 화면 안 상태라 저장하지 않아요.
- 서버 경로 2개 (`S/routes/chats.routes.ts:3378, 3386`):
  - `GET /chats/:id/messages/persona-attributions`
  - `POST /chats/:id/messages/reassign-persona`
- 바꾸는 건 **메시지 줄**의 페르소나 기록이에요. 설정 값은 아니에요.

### LorebooksSection: 모든 모드에 보여요 (Drawer:2041)
- 메타 키 `activeLorebookIds`: 채팅에 고정한 로어북이에요 (`:60-74`). 기본은 `[]`예요.
- 메타 키 `excludedLorebookIds`: 자동으로 켜진 로어북을 이 채팅에서만 끄는 목록이에요 (`:78-84`). 서버가 중복을 없애요 (`chats.routes.ts:1926-1934`).
- 메타 키 `lorebookTokenBudget`: 기본 8192예요 (`:48-51, 98-101`, `shared/constants/defaults.ts:117`).
- 메타 키 `entryStateOverrides`: 항목별 켜기 · 끄기예요 (Drawer:2065, InlineLorebookEntriesEditor).
- 고를 수 있는 로어북은 로어북 줄의 `scope`로 정해요 (`client/src/lib/lorebook-scope.ts:21-26`). 이 값은 로어북 쪽에 저장돼요.
- 서버에서 읽는 곳:
  - `S/routes/generate.routes.ts:3550-3551, 3819-3820, 4247`
  - `S/services/lorebook/index.ts:294, 365-369, 400`
  - `S/services/generation/lorebook-generation-runtime.ts:72` (예산), `:84-116` (overrides)
  - `S/routes/chats.routes.ts:4279` (미리보기)

### MemoryRecallSection: 대화 모드용이 따로 하나 있어요 (Drawer:2246)
- 라이트 빌드(`VITE_MARINARA_LITE`)에선 숨겨요.
- 메타 키 `enableMemoryRecall`: **대화 모드 기본은 켜짐**이에요 (`:51-54, 148`).
- 메타 키 `enableMemoryRecallWholeChat`: 기본은 꺼짐이에요 (`:72-85`). 회상이 켜져 있을 때만 보여요.
- 고급 기억(`advancedMemory`)은 **롤플 · 게임 전용**이에요. `advancedMemoryAvailable = isRoleplayMode || isGame` (Drawer:1137).
- "이 채팅의 기억 보기" 버튼은 기본 조각 보기 창을 열어요 (MemoryRecallMemoriesModal, Drawer:2422).
- 서버에서 읽는 곳:
  - `S/routes/generate.routes.ts:6248-6263`: 기본값이 `chatMode === "conversation" || isSceneChat`예요.
  - `S/services/storage/chats.storage.ts:316-323`: 고급 기억과 동시에 켜지지 않게 막아요.
  - `S/routes/chats.routes.ts:2056`

### PromptPresetSection: **롤플 전용**이에요 (surface "roleplay", Drawer:1858)
- 채팅 줄 칸 `chat.promptPresetId`예요 (Drawer:1093-1094).
- 대화 모드는 이 칸 대신 ConversationPromptSection을 써요 (요청 목록 밖이에요, Drawer:1889-1899).
  - 같은 `chat.promptPresetId`와 메타 `customSystemPrompt`를 써요.
  - 창을 열 때 프리셋이 없으면 "Marinara's Universal Preset"을 자동으로 넣어요 (Drawer:1373-1380).
  - 프리셋을 바꾸면 `customSystemPrompt: null`로 지워요 (:1392-1394).
  - 서버는 `generate.routes.ts:3836, 4532`에서 읽어요.
- 빠른 편집기의 펼침 상태는 UI 스토어 `chatSettingsExpandedSections["prompt-preset-editor"]`예요.
- 프리셋 변수 선택값은 메타 `presetChoices`예요. 롤플 전용이에요 (Drawer:2350-2355).

### SceneInstructionsSection: `metadata.sceneSystemPrompt`가 있을 때만 보여요. 모드는 상관없어요 (Drawer:2313)
- 메타 키 `sceneSystemPrompt`: 장면으로 만든 채팅에 들어 있어요. 포커스가 빠질 때 저장해요.
- 서버는 `S/services/generation/scene-context-runtime.ts:83-85`에서 읽어요.

### ScopedRegexSection: 모든 모드에 보여요. 채팅 캐릭터에게 전용 스크립트가 있을 때만요 (`:64`)
- 메타 키 `scopedRegexMode`: 값은 `"disabled" | "exclusive" | "chat"`, 또는 null(프리셋을 따름)이에요 (`:77-122`).
- 기본은 프리셋의 `scopedRegexMode`이고, 그것도 없으면 `"disabled"`예요 (`shared/utils/regex-scoping.ts:4-9`, Drawer:465-469).
  - 대화 모드도 프리셋이 자동으로 붙으니 그 프리셋 값을 따라가요.
- 스크립트마다 있는 켜기 · 끄기는 **regex 스크립트 줄의 `enabled`**를 바꿔요 (`:148`). 채팅별이 아니라 모든 채팅에 적용돼요.
- 서버는 이 채팅 키를 읽지 않아요. 클라이언트 표시에만 써요 (`client/src/hooks/use-apply-regex.ts`, `ConversationMessage.tsx`). 서버는 프리셋 쪽 값만 다뤄요 (`S/services/storage/prompts.storage.ts`).

### TranslationSection: 모든 모드에 보여요 (Drawer:2306)
쓰기는 순서대로 저장하는 메타 패치(`serialize: true`)로 해요 (Drawer:303).

| 메타 키 | 기본 | 줄 |
|---|---|---|
| `translationProvider` | `"google"` (google/deepl/deeplx/ai) | :83, 126 |
| `translationInputTargetLang` ("Model language") | `translationTargetLang` → `"en"` | :85, 138 |
| `translationOutputTargetLang` ("My language") | 같음 | :86, 148 |
| `translationConnectionId` (ai일 때) | `""` | :165-166 |
| `translationInputPrompt` · `translationOutputPrompt` (ai일 때) | null = 기본 지시문, 옛 키 `translationPrompt` | :87-103 |
| `translationDeeplApiKey` (deepl일 때, 서버가 암호화하고 마스크로 돌려줌) | `""` | :195-214 |
| `translationDeeplxUrl` (deeplx일 때) | `""` | :228-233 |
| `autoTranslate` · `translateInput` · `showInputTranslateButton` · `translationDisplayOnly` | false | :238-265 |

- "기본값으로 저장" 버튼은 앱 설정 `translator-defaults`에 써요 (`hooks/use-translator-defaults.ts:22-37`). 새 채팅을 만들 때 이 값을 복사해요 (`chats.storage.ts:1648`).
- 서버에서 읽는 곳:
  - `S/routes/generate.routes.ts:1992`: `autoTranslate`가 켜져 있으면 `getChatTranslationConfig`를 불러요.
  - `S/services/translation.service.ts:270-282`: DeepL 키를 읽어요.
  - 나머지 불리언 3개는 클라이언트만 읽어요 (`ConversationInput.tsx`, `ConversationMessage.tsx`, `ConversationView.tsx`).
- 값을 정리하는 함수는 `shared/utils/translator-defaults.ts:17-95`에 있어요.

### ImpersonateSection · ImpersonatePromptTemplateField: **롤플 전용**이에요 (`!isConversation && !isGame`, Drawer:2241)
여기는 채팅별이 아니라 **전부 앱 전체 설정**이에요.
- 브라우저에만 저장(localStorage `marinara-engine-ui`, 서버 동기화 안 함): `impersonatePromptTemplate`, `activeImpersonatePromptTemplateId` (`ui.store.ts:2415-2416`)
- 앱 설정 `ui`로 동기화: `impersonateCyoaChoices`, `impersonatePresetId`, `impersonateBlockAgents`, `impersonatePublicFaces` (`ui.store.ts:2127-2131`). 기본은 false · null이에요 (:2781-2787).
- 템플릿 목록: 앱 설정 `impersonate-prompt-templates`
- 연결: 앱 설정 `feature-model-connections.impersonateConnectionId`

### PictureCheckFields: 대화 모드에선 일러스트레이터 카드 안에 있어요 (`ConversationAgentsSection.tsx:309`, `illustrator` prop 없음)
- 메타 키 `pictureCheck`: `"off" | "retry" | "best_of_two"`, 기본 `"off"` (`:32, 53`)
- 메타 키 `pictureCheckLines`: 최대 1500자, 포커스가 빠질 때 저장 (`:93`)
- `illustratorSkipShownScene` · `illustratorReuseByLooking`: illustrator prop이 있을 때만 보여요. 롤플 · 게임용이에요 (`:62-79`).
- 서버에서 읽는 곳:
  - `S/services/generation/conversation-selfie-command-runtime.ts:438-447`
  - `generate.routes.ts:15220`, `14747`, `14832`
  - `retry-agents-route.ts`

### LocationBackgroundPins: **롤플 전용**이에요 (Drawer:2200-2208)
- 메타 키 `locationBackgroundPins`: 목록 `{id, names[], placeId, background}` (`:265-283`)
- 메타 키 `locationBackgroundPinShown` (`shared/utils/location-backgrounds.ts:12,14`)
- 기본 배경은 UI 스토어 `defaultRoleplayBackground`(앱 전체)예요.

### ChatButtonLayoutSettings: 모든 모드에 보여요. 데스크톱에서만요 (`md:block`, Drawer:1772)
- 값은 `"free" | "horizontal" | "vertical"`이고 기본은 free(undefined)예요.
- floating-window 스토어 `buttonLayout`에 두고, **채팅 메타 `windowLayout.buttonLayout`**에 저장해요 (`hooks/use-chat-window-layout.ts:46,54`, `stores/floating-window.store.ts:233,246-256`).

### ChatWindowFavoriteButton: 모든 모드의 창 머리에 있어요 (Drawer:1568)
- 앱 설정 `chat-window-default-<mode>`에 저장해요. 대화 모드는 `chat-window-default-conversation`이에요.
  - 들어가는 값: `{windowLayout, chatSettingsHintDismissed, scopedRegexMode?}` (`:36-38, 97-107`, `shared/utils/chat-window-defaults.ts:36-45`)
- 새 채팅을 만들 때 서버가 이 값을 새 메타에 펼쳐 넣어요 (`chats.storage.ts:1646, 1655`, `S/services/storage/chat-window-defaults.ts`).
- 같이 쓰는 메타 키 `chatSettingsHintDismissed`: 안내 닫기 버튼이 써요 (Drawer:1761).

### cast-shared.tsx
- 화면 조각뿐이에요. 저장하는 값은 없어요.

---

## 2. 대화 모드 에이전트 칸 (`ConversationAgentsSection`, Drawer:2108)

모두 채팅 메타에 저장해요.

**명령 (`ConversationCommandsSettings.tsx`)**
- `characterCommands`: 기본 켜짐(`!== false`) (`use-chat-agents.ts:368`)
  - 서버: `generate.routes.ts:3488`, `conversation-video-runtime.ts:92`
- `conversationCommandToggles{명령: bool}`: video만 기본 꺼짐, 나머지는 기본 켜짐 (`shared/types/chat.ts:128-130`)
  - 명령 목록: `lib/conversation-command-toggles.ts:18-113`. 설치된 패키지에 따라 걸러요 (:120-143).
  - 서버: `conversation-command-runtime.ts:46`, `conversation-video-runtime.ts:90`

**일러스트레이터 카드 (illustrator 패키지가 설치돼 있을 때)**
- 셀카 켜기 · 끄기: `conversationCommandToggles.selfie`와 `characterCommands`를 바꿔요 (`use-chat-agents.ts:374-384`). `selfie === true`이거나 연결이 있어야 열려요 (:371-373).
- 메타 키와 서버에서 읽는 곳:

| 메타 키 | 기본 | 서버에서 읽는 곳 |
|---|---|---|
| `imageGenConnectionId` (셀카 연결) | `""` | `conversation-selfie-command-runtime.ts:143` |
| `illustratorPromptConnectionId` (null이면 에이전트 기본) | `""` | `illustrator-prompt-runtime.ts:65`, `agent-resolution.ts:132` |
| `imageStyleProfileId` | null | `conversation-selfie-command-runtime.ts:227-228` |
| `illustratorImagesPerGeneration` | 1 (1–4) | `conversation-selfie-command-runtime.ts:465` |
| `selfieResolution` (예: `"896x1152"`) | 없으면 앱 설정 `imageSelfieWidth/Height`(896×1152, `ui` 동기화) | `conversation-selfie-command-runtime.ts:394` |
| 영상 메시지: `conversationCommandToggles.video` (켜면 `characterCommands: true`도 같이) | 꺼짐 | 위와 같음 |
| `illustratorVideoRunInterval` (null이면 에이전트 기본 → 5) | — | `S/services/generation/agent-cadence.ts:103` |
| `sceneVideoConnectionId` | null(메인을 따름) | `S/services/video/chat-video-messages.ts:35` |
| `sceneVideoFirstFrame` | normalize 기본 | `conversation-video-runtime.ts:408` |
| `selfieUseAvatarReferences` · `selfieVideoUseAvatarReferences` | false | `conversation-selfie-command-runtime.ts:329`, `conversation-video-runtime.ts:410` |
| `selfieIncludeCharacterAppearance` · `selfieVideoIncludeCharacterAppearance` | false | `conversation-selfie-command-runtime.ts:330`, `conversation-video-runtime.ts:200,273` |
| 사진 확인 `pictureCheck` · `pictureCheckLines` | 위 표 참고 | 위 참고 |

- 이미지 생성 설정 링크는 앱 설정 화면을 열어줄 뿐이에요.
- 로어북 붙이기(`renderAgentLorebookAttachment`)는 커스텀 · writer · tracker 에이전트에만 나와요. 기본 제공 에이전트인 일러스트레이터에선 null이 돼요 (`agent-settings-renderers.tsx:267-281`).

**통화 (conversation-calls 패키지)**
- 외부 패키지의 `CapabilityElement`예요. `updateMetadata(patch)`로 채팅 메타에 바로 써요 (`ConversationAgentsSection.tsx:314-329`).
- 키 이름은 패키지 코드에 있어서 이 저장소에선 확인할 수 없어요.

**장기 기억 (long-term-memory 패키지)**
- 켜기: `enableAgents: true`와 `activeAgentIds`에 패키지 id를 더해요 (`use-chat-agents.ts:455-468`).
- 메타 키 `longTermMemoryRecallStyle` · `longTermMemoryBudgetTokens` · `longTermMemoryMaxChunks` (`LongTermMemorySettings.tsx:77-85`).
  - server/src에는 이 키를 읽는 곳이 없어요. 패키지가 읽어요.

**일정 생성 선호**
- **앱 전체 설정**이에요: UI 스토어 `scheduleGenerationPreferences`를 앱 설정 `ui`로 동기화해요 (`ui.store.ts:2125`, `use-chat-agents.ts:313-314`).
- 서버로는 요청 본문에 실어서만 가요 (`S/routes/conversation.routes.ts:682-692`).

**커스텀 에이전트**
- 추가: `enableAgents: true`, `activeAgentIds`, `buildAgentAddMetadataPatch` 결과를 써요 (`use-chat-agents.ts:2016-2032`).
  - 에이전트 설정 자체(contextSize, maxTokens 등)는 **에이전트 config 줄**에 저장해요 (:2002-2014).
- 빼기: `activeAgentIds`에서 지우고, `agentPromptTemplateIds[id]`와 `customAgentImageSettings[id]`도 지워요 (:1555-1638).
- 지시문 고르기: 메타 `agentPromptTemplateIds{agentId}`. 기본값을 고르면 키를 지워요 (:1659-1670). 서버: `generate.routes.ts:2623`
- 이미지 연결 · 스타일: 메타 `customAgentImageSettings{agentId:{imageConnectionId,styleProfileId}}`. 150ms 모아서 저장해요 (:1765-1808). 서버: `S/services/generation/custom-agent-image-settings.ts:40`
- 백필 설정: **에이전트 config 줄**의 settings예요 (:1690-1706).

**햅틱 카드 (`enableAgents`이고 haptic이 active일 때)**
- 메타 키 `enableHapticFeedback`, `hapticSensitivity` (기본 `"standard"`), `hapticIncidentalContact`, `hapticIntifaceUrl` (`HapticSettings.tsx:16-63`)
- Intiface URL은 localStorage(`HAPTIC_INTIFACE_URL_STORAGE_KEY`, 브라우저 전체)에도 저장해요 (`HapticConnectionPanel.tsx:27-47`).
- 서버: `conversation-command-runtime.ts:445`, `S/services/generation/haptic-runtime.ts:24-37`

**에이전트 칸에 있지만 대화 모드에서 안 보이는 것**
- `agentWriteApprovalRequired` 토글(`renderReviewAgentOutputsToggle`)은 대화 칸에서 부르지 않아요.

---

## 3. 한 방 = 한 채팅으로 옮길 때 볼 것

1. **채팅 메타에 넣을 것:** 위 표의 메타 키 전부를 방마다 두면 마리나라와 같아요.
2. **채팅 줄 칸으로 둘 것:** `personaId`, `personaCharacterId`, `promptPresetId`, `connectionId`, `name`, `characterIds`
3. **방마다가 아니라 전체 공통으로 둘 것:**
   - `scheduleGenerationPreferences`, `imageSelfieWidth/Height`, 칸 펼침 상태 (`ui` 설정)
   - regex 스크립트 `enabled`
   - 로어북 `scope`
   - 에이전트 config
   - 번역 기본값 · 창 즐겨찾기 (앱 설정)
4. **새 방을 만들 때 넣을 기본값:** `translator-defaults`와 `chat-window-default-conversation`을 복사하고, `enableAgents: true`, `activeAgentIds: []`를 넣어요 (`chats.storage.ts:1646-1656`).
5. **화면에 넣지 않을 것 (롤플 · 게임 전용):** ImpersonateSection, PromptPresetSection, LocationBackgroundPins, 페르소나 이름 색, 고급 기억, PictureCheck의 일러스트레이터 전용 스위치 2개
6. **이번 범위 밖이지만 대화 모드에 보이는 칸 (따로 봐야 해요):** SettingsProfiles, ChatName, Connection, ConversationPrompt, AdvancedParameters, Characters(+cardCssMode), GroupChat, ChatVariables, ConnectedChats, FunctionCalling, AutonomousMessaging, AutomaticSummarization
   - 설정 프로필이 복사하는 키 목록은 `shared/types/chat-preset.ts:76, 248, 423`에 있어요.