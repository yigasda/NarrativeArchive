# 디자인 세션에게: Orbit 번역을 마리나라 것으로 (반영 쪽, 2026-11-23)

소망: "마리나라 번역 기능 전부 한 글자도 다르지 않게, 끄기까지. DeepL · DeepLX만 빼고."
반영 쪽에서 코드는 다 넣었어요(`src/phone2translate.js`, `src/marinara/translation*.js` 등). 화면은 디자인 세션 몫이라, 아래를 그려 주세요.
화면 글은 마리나라 en.json을 옮긴 말이에요(소망 규칙: 풀어 쓰지 않기, 지어낸 말 금지). 이미 화면에 있는 한국어가 있으면 그대로 써도 돼요.

## 0. 바뀐 데이터 (먼저 읽어 주세요)

- **말의 `x.ko`는 없어졌어요.** 답장 지시문이 한국어를 같이 받던 것(ko)을 뺐어요. 옛 한국어는 그 말의 `x.extra.translation`(원문은 `x.extra.translationSource`)으로 옮겨져요(자동).
- 번역은 이제 말마다 마리나라의 번역 단추로 해요(번역 · 숨기기). 숨긴 것은 `x.extra.translationHidden: true`(번역은 남아요).
- **화면에서 번역을 읽을 때는 `x.extra`를 직접 읽지 말고 `liveTranslationView`를 써요** (마리나라의 보이기 규칙이 거기 있어요).
- `liveRetranslate`는 없어졌어요. `liveEditMessage`는 `{ ko }`를 안 받아요(한국어 고치기 없음: 마리나라에 없어요).
- `liveSwipeList`의 말풍선은 `{ text, translation }`이에요(전에는 `{ text, ko }`). 숨긴 번역은 `''`.

## 1. 반영 쪽이 이미 이은 것 (최소한만: 화면을 다시 그릴 때 바꿔도 돼요)

`src/phone.js` · `src/phoneorbitset.js`를 아주 조금 고쳤어요(git diff로 보세요):
- import에서 `liveRetranslate`를 빼고 번역 함수를 넣었어요(안 빼면 폰이 아예 안 떠요).
- 방을 그릴 때 `liveTranslationOpen(realM, r.id)`, 말마다 `liveTranslationView(realM, r.id, x)`:
  `text: tv.displayedContent`, `ko: tv.translationBlock?.text`, `open: true`, `wait: tv.isTranslating`. 고치는 중인 말은 원문만.
- 길게 누르기의 번역(`na_ob_mtr`) → `liveTranslate`(마리나라 단추: 번역 · 숨기기). 여러 개 번역(`na_ob_ptr`)도 지금은 같은 함수로 돌지만, 마리나라에 없는 기능이라 빼 주세요(3장).
- 고치기: 한국어 칸 · 고친 뒤 자동 재번역을 뺐어요.
- 보내기(`obSend`): 내 메시지 번역이 켜져 있으면 `livePrepareInput`으로 번역한 글을 보내요(실패하면 원문 + 알림은 함수가 해요).
- 찾기: 저장된 번역도 찾아요(숨긴 것 빼고).
- 채팅 설정 › 번역: 칸(trSvc · trIn · trOut · trConn · trInP · trOutP · trAuto · trMine · trBtn · trOnly)이 진짜 설정을 읽고 써요. 연결 고르기에 목록(`T.trConns`)을 넣었어요.

## 2. 채팅 설정 › 번역 (마리나라 TranslationSection)

값: `liveTranslationSettings(real)` → `{ provider ('google' | 'ai'), inputTargetLanguage, outputTargetLanguage, connectionId ('' = 선택 안 함), inputPrompt, outputPrompt ('' = 기본), autoTranslate, translateInput, showInputTranslateButton, translationDisplayOnly, defaultPrompt, connections: [{ id, name, model, provider }] }`
바꾸기: `await liveSetTranslation(real, { 열쇠: 값 })` → 같은 모양. 열쇠는 마리나라 것 그대로:
`translationProvider` · `translationInputTargetLang` · `translationOutputTargetLang` · `translationConnectionId` · `translationInputPrompt` · `translationOutputPrompt` · `autoTranslate` · `translateInput` · `showInputTranslateButton` · `translationDisplayOnly`.
틀린 값은 던져요(오류 글을 알림으로).

순서와 글 (en.json → 한국어):
1. 섹션 "Translation" → **번역**. 도움말: "Configure translation for this chat here, including provider, target language, and automatic response translation for Game mode."에서 "for Game mode"만 빼고 옮겨요(게임 모드는 우리에게 없어요) → **"이 채팅의 번역을 여기서 설정합니다. 제공자, 대상 언어, 응답 자동 번역이 포함됩니다."** (지금 화면 글은 "응답 자동 번역"까지 빠져 있어요: 고쳐 주세요)
2. "Service" → **서비스**: 고르기 둘만 — "Google Translate" → **Google 번역**, "AI (via connection)" → **AI (연결 사용)**.
   **"DeepL API" · "DeepLX (self-hosted)"는 빼 주세요** (소망이 뺐어요). DeepL API 키 칸 · DeepLX URL 칸 · 그 도움말도 빼요. 지금 `phoneorbitset.js` 273줄에 DeepL 고르기가 남아 있어서 고르면 "번역 서비스는 google 또는 ai여야 합니다." 알림이 떠요.
3. "Model Language" → **모델 언어** / "My Language" → **내 언어** (글 칸).
   - 도움말(서비스가 ai일 때): "{설명} Use a language name such as English, Japanese, or Spanish." / 아니면: "{설명} Use a language code such as en, ja, es, de, fr, zh, or ko."
   - 설명: 모델 언어 "Your outgoing messages are translated into this language." → 내가 보내는 메시지는 이 언어로 번역됩니다. / 내 언어 "Incoming model responses are translated into this language." → 모델의 응답은 이 언어로 번역됩니다.
   - 빈칸 글(placeholder): ai면 "English", 아니면 "en".
4. 서비스가 ai일 때만:
   - "Connection" → **연결** (도움말 "Which AI connection to use for translation" → 번역에 사용할 AI 연결). 고르기는 select가 아니라 **마리나라 `ConnectionSelect`(components/connections/ConnectionSelect.tsx, picker 모양) 그대로**예요. TranslationSection은 `job="Translation"`, `scope="chat"`, `defaultLabel="Select connection…"`으로 써요(대체 연결 칸 없음):
     - **칸(단추 하나)**: 누르면 모델 고르기 창이 열려요. 오른쪽에 아래 화살표(ChevronDown).
       - 비었으면(`connectionId` '') 글은 **"연결 선택…"**("Select connection…")만.
       - 골랐으면 글은 그 줄의 `name`(없으면 `model`, 그것도 없으면 id: 마리나라 `choiceLabel`), 뒤에 작고 흐리게 **" · "** + [둘째 줄, 출처]를 " · "로 이은 것:
         - 둘째 줄: 그 모델이 든 계정 이름(빠른 전환기가 묶는 이름), 계정이 없으면 **"다른 모델"**("Other models"). 마리나라는 그 뒤에 "via {{service}}"(사용자 지정 연결이고 모델 id 앞부분이 아는 게이트웨이일 때만: connection-groups.ts `viaName`)도 붙여요. 그 표는 이제 있어요: `src/marinara/connection-groups.js`의 `viaName(provider, modelId)`(마리나라 그대로). 우리 '커스텀' 연결이 마리나라의 `custom`이라, 커스텀 연결일 때 `viaName('custom', 모델 id)`가 이름을 주면 그 줄을 붙여요.
         - 출처: **"이 채팅에 설정"**("Set for this chat", `connections.select.scope.chat`).
         - 예: "gpt-4o · 다른 모델 · 이 채팅에 설정".
       - 목록에 없는 id(지운 프로필 등)면 마리나라는 **"없음: {{id}}"**("Missing: {{id}}")를 보여요. id가 안쪽 값('profile:…')이라 그대로 낼지는 소망에게 물어봐 주세요.
       - 접근성 이름: "연결: {{지금 글}}"("{{label}}: {{value}}").
     - **고르기 창**: 마리나라 `ModelPicker` — 제목 **"번역 모델"**("Model for {{job}}", job "Translation"), 몸통은 빠른 전환기와 같은 `ConnectionSwitcherBody`(검색 · 즐겨찾기 · 계정별 목록이 그대로: 우리 `orbitSwitcher`). 맨 위에 기본 줄 **"연결 선택…"**(지금 비어 있으면 그 줄이 골라진 표시). 고르면 `liveSetTranslation(real, { translationConnectionId: id })`, 기본 줄이면 `''`.
       - 고른 뒤 성공 알림 8초: **"{{job}} now uses {{model}}"** → 예: "번역에 이제 gpt-4o를 사용합니다", 알림에 **"되돌리기"**("Undo") 단추(누르면 전 값으로 `liveSetTranslation`). 지금 값을 다시 고르면 아무것도 안 해요(알림 없음).
       - 고를 수 없는 연결(실리의 지금 API가 KoboldAI · NovelAI · Horde)은 `liveSetTranslation`이 이유를 던져요: 그 글을 오류 알림으로(바뀌지 않아요).
     - 보이는 값은 `connections`의 `name` · `model`이에요. id('tr' · 'dr' · 'ai' · 'profile:…')는 화면에 쓰지 않아요(위의 "없음" 빼고).
   - "Outgoing Message Prompt" → **보내는 메시지 프롬프트**, "Incoming Response Prompt" → **받는 응답 프롬프트** (여러 줄, 고정폭 글꼴, 5줄).
     - 칸에는 `inputPrompt || defaultPrompt`를 보여요(마리나라: 비었으면 기본 지시문을 칸에 보여 줘요). 고친 걸 내보낼 때(blur) `liveSetTranslation({ translationInputPrompt: 글 })` — 비었거나 기본과 같으면 함수가 '기본'으로 돌려요.
     - 내 프롬프트가 있을 때만 "Restore" → **복원** 단추(제목 "Restore default prompt" → 기본 프롬프트 복원): `liveSetTranslation({ translationInputPrompt: '' })`.
     - 도움말: "System prompt used by AI translation. {{targetLanguage}} resolves to the matching language above." → AI 번역이 쓰는 시스템 프롬프트입니다. {{targetLanguage}}는 위의 해당 언어로 바뀝니다.
     - 칸 아래 오른쪽(작게 · 흐리게): 토큰 어림 **"~N 토큰"** (en.json "~{{tokens}} tokens"). 값은 `liveTokenEstimate(글)`이 다 만들어요(마리나라 `estimateTextTokens`를 그대로 가져왔어요: 한글 0.5 · 한자 · 가나 0.67 · 나머지 0.25, 올림. 숫자는 `toLocaleString`). 글은 마리나라처럼: 칸에 초점이 있거나 치는 중이면 지금 칸의 글, 아니면 `inputPrompt || defaultPrompt`. (전에 적은 "글자 수 ÷ 4"는 틀렸어요)
5. 스위치 넷 (제목 / 설명):
   - "Auto-Translate Responses" → **응답 자동 번역** / "Automatically translate AI responses after generation." → 생성 후 AI 응답을 자동으로 번역합니다.
   - "Translate My Messages" → **내 메시지 번역** / "Translate your messages to the target language before sending." → 보내기 전에 내 메시지를 대상 언어로 번역합니다.
   - "Show Draft Translate Button" → **초안 번역 버튼 표시** / "Add a Translate shortcut beside Send. In Conversation, Translate draft is always available in the Tools tab of the composer’s smiley menu, including on mobile." → 보내기 옆에 번역 바로가기를 추가합니다. 대화에서는 입력창 스마일 메뉴의 도구 탭에서 초안 번역을 늘 쓸 수 있습니다.
   - "Show Only Translation" → **번역만 표시** / "Once a message is translated, show just the translation in its place instead of both the original and the translation." → 메시지가 번역되면 원문과 번역을 함께 보여 주는 대신 번역만 그 자리에 보여 줍니다.
6. 기본값: 설명 "Saves these translation settings for new chats in every mode. Settings from the setup wizard and chat profiles come first. Existing chats keep theirs." (지금 화면 글 그대로 좋아요)
   - "Save translator defaults" → **번역기 기본값 저장**: `await liveSaveTranslatorDefaults(real)` (누르는 동안 "Saving…" → **저장 중…**, 두 단추 다 막기). 알림(저장됨 · 실패)은 함수가 띄워요.
   - "Forget saved defaults" → **저장한 기본값 잊기**: `await liveTranslatorDefaults()`가 true일 때만 보여요. `await liveSaveTranslatorDefaults(null)`.
   - 지금은 `soon(…)`(아직 연결되지 않았어요)이에요: 이어 주세요.

## 3. 메시지 (마리나라 ConversationMessage · ConversationMessageTranslation · 액션 줄)

- 방을 그리기 전에 한 번 `liveTranslationOpen(real, 방 id)` (방을 바꾸면 저장된 번역으로 다시 채워요).
- 말마다 `const v = liveTranslationView(real, 방 id, x)`:
  - 말풍선 글: `v.displayedContent` (번역만 표시가 켜져 있고 조건이 맞으면 번역이 그 자리에).
  - 번역 칸: `v.translationBlock`이 있으면 말풍선 안 원문 아래에 **위에 가는 선(테두리) 하나 + 번역 글**(줄바꿈 그대로). `translating`이면 글 대신 **"번역 중…"**("Translating…", 작게 · 기울여 · 흐리게).
  - 전의 "한국어 보기" 전체 토글(`koOn`)과 말마다 접기(`obOpen`)는 마리나라에 없어요: Orbit에서는 빼 주세요(지금은 `open: true`로 늘 보여요). 폰 1의 한국어 보기는 그대로예요.
- 번역 단추(액션 줄, 아이콘 Languages): 제목은 `v.buttonTitle` — 번역이 보이면 **"번역 숨기기"**("Hide translation"), 아니면 **"번역"**("Translate"). 누르면 `liveTranslate(real, 방 id, x.id, { onChange: 다시 그리기 })`. 실패 알림은 함수가 해요.
- **여러 개 골라 번역(`na_ob_ptr`, 옛 "재번역")은 메신저에서 빼 주세요** (마리나라에 없는 기능이에요: 메신저 번역은 마리나라와 한 글자도 다르지 않게). 고르기 줄의 번역 단추(`phoneorbit.js` 192 · 294줄)와 `phone.js`의 `.na_ob_ptr` 처리를 없애요. 말마다의 번역 단추(`na_ob_mtr`)는 그대로예요.
- 고치기 칸: 한국어 칸을 빼 주세요(`ob_fk`).
- 받아 둔 답장 목록: 말풍선의 `translation`을 전의 `ko` 자리에. (반영 쪽이 `phone.js` 469줄에서 `ko: b.translation`으로 이어 두어서 지금도 보여요. 다시 그릴 때 `translation`을 직접 읽어도 돼요)
- 복사(`na_ob_mcopy`): 마리나라처럼 **보이는 글**을 복사해요(번역만 표시일 때는 번역: `liveTranslationView(…).displayedContent`). 반영 쪽이 `phone.js`에 이어 두었어요.
- 번역 상태가 바뀌면 다시 그리기: `liveTranslationSubscribe(fn)` → 끊는 함수.

## 4. 입력창 (마리나라 ConversationInput)

- 보내기: 이미 이었어요(`livePrepareInput`). 번역하는 동안 보내기 막기(지금 `obSending`).
- 초안 번역 단추 (보내기 옆의 것은 마리나라에서 `hidden … sm:flex`예요 — ConversationInput.tsx 2350~2355: **좁은 화면(폰)에서는 안 보이고**, 넓은 화면에서만 보여요. 도구 탭의 "초안 번역" 줄은 늘 보여요):
  - `liveTranslationSettings(real).showInputTranslateButton`이 켜져 있으면 보내기 옆에 아이콘 단추(Languages, 제목 "Translate draft" → **초안 번역**).
  - 스마일 메뉴에 "Tools" → **도구** 탭이 있으면 거기에 늘 "초안 번역" 줄(마리나라: 켜기와 상관없이).
  - 입력이 비었거나 번역 중이면 막기, 번역 중에는 돌아가는 표시.
  - 누르면 `const t = await liveTranslateDraft(real, 방 id, 입력 글)`; `t`가 있으면 입력칸 글을 `t`로 바꾸고 초안 저장(`draftSet`), 초점. null이면 그대로(빈 결과 · 실패 알림은 함수가 해요).

## 4-2. 말투 표 (소망, 2026-11-24)

- 설정 › 말투 표(`p.koVoice`, `src/phoneapps.js` 725~760)는 **메신저 번역에 쓰지 않아요**(마리나라처럼: 번역 요청은 마리나라의 것 그대로). 폰 안의 다른 앱 번역에는 전처럼 써요.
- 그 화면에 한 줄: **"메신저 번역에는 쓰지 않습니다."**

## 4-3. 번역이 안 되는 이유 (`translateWhy`)

- `/auto/status`의 방 줄에 `translateWhy`(서버가 그 방의 답장을 자동 번역할 수 없는 이유)가 있지만 **화면 요소로 내지 않아요**(마리나라에 없어요).
- 마리나라가 번역 실패를 보여 주는 방법은 하나예요: 번역 단추를 눌렀다 실패하면 **오류 알림(그 오류 글)**. 이건 `liveTranslate`가 이미 해요(예: "실리의 지금 API(novel)로는 AI 번역을 할 수 없습니다. 다른 연결을 선택하세요.", "모델을 선택하세요."). 화면이 따로 할 것은 없어요.
- 설정에서 그런 연결을 고르면 `liveSetTranslation`이 같은 글로 던져요(오류 알림).

## 5. 알림 신호

- 'na-live-reply'(답이 끝났다)는 자동 번역이 켜져 있으면 **번역이 끝나 저장된 뒤**에 와요(마리나라 그대로). 서버가 쓴 답도 같아요.
- 서버 번역을 기다리는 동안 다른 채팅을 열어도, 그 답의 'na-live-reply'는 번역이 끝나면 와요(마리나라는 완료 알림을 늘 보내요). `detail.room`은 그 답의 방(지금 열린 Orbit의 방이 아닐 수 있어요)이에요.

## 6. 문서

- `docs/design/orbit.md` 39줄(한국어 `ko` 줄 · 접기), `orbit-marinara.md` 233 · 289줄("재번역")은 디자인 세션 문서라 손대지 않았어요. 고쳐 주세요.
