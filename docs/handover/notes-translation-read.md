# 마리나라 번역 읽기 (staging cfc726e93, 2026-11-23) — 내가 직접 읽음
워크트리: $S/ref-marinara-new (packages/...)

## 끝까지 읽은 파일 (번역 전용)
- server/src/routes/translate.routes.ts (7) — POST /api/translate → translateText(db, body, fallback 알림)
- server/src/services/translation.service.ts (363) — translateText(스키마 zod: chatId?, debugMode?, text 1~50000, provider ai|deeplx|deepl|google, targetLanguage 1~100 trim, connectionId?, systemPrompt ≤5000?, deeplApiKey?, deeplxUrl url http/https), translateGeneratedMessage(저장된 마지막 스와이프를 서버에서 번역 → extra {translation, translationSource, translationHidden:false}; 먼저 automaticTranslationSource 표시; hidden/hiddenFromUser/commandOnly/이미 같은 source면 건너뜀; 빈 번역이면 오류), translateWithAI(연결 + 대체 연결, system = resolveTranslationSystemPrompt(systemPrompt?.trim() || DEFAULT, target), user = `Translate the following text to ${target}:\n\n${text}`, temperature 0.3, maxTokens = 연결 저장값 ?? override ?? 4096, 결과 trim), translateWithDeepLX(new URL('/translate', url), 로컬 주소는 DEEPLX_LOCAL_URLS_ENABLED일 때만, body {text, source_lang:'auto', target_lang: upper}, 15초, 1MB, data.data || alternatives[0]), resolveDeeplApiKey(보낸 키가 가린 값이 아니면 그것, 아니면 채팅 메타(암호화) · 채팅 없으면 번역 기본값), translateWithDeepL(:fx면 api-free, Authorization DeepL-Auth-Key, {text:[t], target_lang: upper}, 15초, translations[0].text), translateWithGoogle(5000자 넘으면 400 "Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts.", translate.googleapis.com/translate_a/single client=gtx sl=auto tl dt=t q, 15초, data[0] 조각의 [0] 이음)
  - 오류 글: "Connection ID is required for AI translation", "API connection not found", "No base URL configured for this connection", "DeepLX URL is required", "Invalid DeepLX URL", "DeepLX URL is not allowed", "DeepLX request timed out", "DeepLX returned <s>", "DeepL API key is required", "DeepL request timed out", "DeepL API returned <s>", "Google Translate request timed out", "Google Translate returned <s>", "Translation provider returned no text", 로그 "[translate] Automatic translation failed for message %s", 디버그 "[translate] system=%s user=%s"
- shared/src/constants/defaults.ts (147) 51~58: DEFAULT_TRANSLATION_SYSTEM_PROMPT =
  "You are a translator. Translate the given text accurately into {{targetLanguage}}, preserving formatting, markdown, and any special characters like *asterisks* for actions. Output ONLY the translated text, nothing else -- no explanations, no extra commentary."
  resolveTranslationSystemPrompt(p, lang) = p.replaceAll("{{targetLanguage}}", lang.trim())
- shared/src/utils/translator-defaults.ts (95): 키 목록(string 7 · prompt 3 · boolean 4), normalizeTranslatorSettings(옛 공용 값 → 입·출력 값), TranslationConfig, getChatTranslationConfig(provider 기본 google, 언어 기본 'en', 프롬프트 null=기본)
- client/src/lib/translate-text.ts (20): translateText(text, 'input'|'output') → POST /translate (입력이면 input 언어 · 프롬프트)
- client/src/lib/draft-translation.ts (20): 입력창 번역 버튼 — 빈 결과 "Translation returned an empty message.", 실패 "Failed to translate draft"
- client/src/hooks/use-translator-defaults.ts (38): 새 채팅용 번역 기본값 저장 · 잊기 (app-settings translator-defaults, fromChatId로 키 가린 값 풀기)
- client/src/stores/translation.store.ts (99): config · translations · translationSources · hiddenTranslationIds · translating, seedFromMessages(extra.translation · translationHidden · translationSource 없으면 content)
- client/src/hooks/use-translate.ts (172): translateMessage(같은 글이면 기다리던 것, 다르면 줄 세움, 저장 PATCH extra 줄 세움 → 그다음 화면), useTranslate().translate(이미 번역 + 같은 원문이면 숨기기 → extra translationHidden:true, 아니면 번역; 실패 토스트 "Translation failed")
- client/src/features/chat-settings/sections/TranslationSection.tsx (429): 화면(제공자 · 모델 언어(보내는 것) · 내 언어(받는 것) · ai면 연결 · 보내는 프롬프트 · 받는 프롬프트(기본과 같거나 비면 null) · deepl 키(가린 값) · deeplx URL · 토글 4: autoTranslate · translateInput · showInputTranslateButton · translationDisplayOnly · 기본값 저장 · 잊기)
## 큰 파일의 번역 부분 (그 부분 끝까지)
- generate.routes.ts: 1334 pendingTranslations(채팅마다 수), 1990~2029 dispatchAutomaticTranslations(autoTranslate면, 생성이 멈추면(실패 뒤 아니면) 안 함, 저장된 답 순서대로 translateGeneratedMessage, 실패는 경고 로그만), 11862~11873(답 저장 뒤: 나뉜 답은 앞 조각부터, 그 메시지에 automaticTranslationSource 먼저), 12265(나뉜 조각 extra에도), 16238(done 전에 dispatch), 16266~16278(실패해도 저장된 답은 번역), 16352 /generate/status의 translating
- use-generate.ts 1126~1141 waitForServerTranslationToSettle(상태 translating이 끝날 때까지 기다렸다가 메시지 다시 읽고 → 그다음 완료 알림), 3894~3906
- ChatArea.tsx 2118~2142: 채팅 메타 → store config, 채팅 바뀌면 clearAll, 메시지마다 seed
- ConversationMessage.tsx 217~221, 489~495(translationDisplayOnly && 번역 있음 && 번역 중 아님 && 원문이 지금 글이면 번역만), 664~700(번역만 바뀌면 단체 조각 다시 다 보임), 802~805 handleTranslate(renderedContent, 별칭 [message.content])
- ConversationMessageShared.tsx 648~668 ConversationMessageTranslation(번역 중이면 "Translating…" 글, 아니면 줄 위 테두리 + 번역 글), Bubble 326 · Grouped 417 · Line 248(번역만 보일 땐 아래 칸 안 보임), Actions 154~160(번역 버튼: 있으면 "Hide translation" 아니면 "Translate")
- ConversationView.tsx 1444 · 1471 · 1503: translationDisplayOnly 넘김
- chat-macros.ts 477~527 prepareUserInputMessage: 정규식 → (translateInput면) 입력 번역 → 실패면 onTranslationError(원문 보냄 토스트 failedToTranslateMessageSendingOriginal/PostingOriginal) → 매크로
- ConversationInput.tsx 1857~1885 · 1946~1962 · 2350~2363, ChatInput 1733~1753 · 2126~2139: 입력창 번역 버튼(showInputTranslateButton), 번역 뒤 formatTextQuotes
- chats.routes.ts 1850~ 메타 PATCH(키 가린 값 처리) · 3241~ 메시지 extra PATCH
- app-settings.routes.ts 102~105 · 233~269 translator-defaults(가린 키, fromChatId)
- chat-presets.storage.ts 423~471: 프로필 적용 때 번역 설정은 프로필 것 그대로, 기본값 위에
- chat-preset.ts 386~400 · 432~433, chat-setup-draft.ts 49~59, ChatProfileBuilder 97~103 (번역 키는 프로필 · 설정 마법사에 들어감)
## 우리 쪽
- 화면 있음: src/phoneorbitset.js 271~281 (trSvc · trConn · trInP · trOutP? · trKey · trUrl · trAuto · trMine …) — 디자인 세션이 만든 것
- 지금 번역: 답장 지시문(src/phone2reply.js)이 ko를 같이 받음, liveRetranslate(phone2go 1015, AI_SYS_PHONE_KO) · askTranslator('tr' 연결)
- 규칙 충돌 후보: "새 키 저장 금지(실리 · 확장에 있는 키만)" ↔ 마리나라 DeepL 키 칸. 실리에는 DeepL 키(secrets 'deepl')와 DeepLX 주소(extension_settings.translate.deeplx_url)가 있음.
