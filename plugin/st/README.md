# plugin/st — 실리 브라우저 코드를 서버로

서버 플러그인 일꾼이 실리 브라우저 없이, 실리 브라우저와 글자 하나까지 같은 요청을 만들게 실리 1.19.1 코드를 옮겨 둔 곳이에요.
`public/` 아래는 실리 `public/`과 같은 경로 · 같은 파일 이름이에요. SillyTavern, AGPL-3.0 (`NOTICE.md`).

## 규칙

- **통째로**: 글자 그대로 복사. 바꿔도 되는 것은 맨 위 머리 주석 두 줄, 서버에서 풀 수 없는 절대 경로 import(`'/scripts/x.js'` → 상대 경로)뿐. 그 밖에 바꾼 줄은 머리 주석 "바꾼 것"에 적어요.
- **일부**: 필요한 함수 · 상수만 글자 그대로. 옮긴 줄마다 바로 위에 `// 실리 <원래 경로> <시작줄>~<끝줄>`. 순서는 실리 파일 순서.
  전역 값은 같은 이름의 `export let`(실리가 `const` 객체로 둔 것은 그대로 `const`)이고, 파일마다 `__naSet(v)`로 일꾼이 채워요(v에 있는 키만).
  `const` 객체(`power_user` · `extension_settings` · `nai_settings`)는 실리가 설정을 불러올 때처럼 기본값 위에 `Object.assign`.
- **대역**: 브라우저에만 있는 것. 하는 일 없이 같은 이름만. 머리 주석에 "대역".
- 실리 코드를 다시 쓰거나 고치지 않아요. 실리 버그도 그대로.
- 확인: 통째로 옮긴 파일은 `diff <실리 원본> <우리 것>`이 머리 주석(+ 적은 줄)만 달라요. 일부 옮긴 파일은 `portcheck.mjs`(표시마다 실리 줄과 같은지)로 봐요.

## 쓰는 법 (매크로)

```js
// 순서 중요: 실리처럼 power-user.js를 script.js보다 먼저 (순환 import)
const PU = await import('./public/scripts/power-user.js');
const S = await import('./public/script.js');
const { variables } = await import('./public/scripts/st-context.js');
globalThis.SillyTavern = { getContext: () => ({ variables /* , ... */ }) }; // initMacros 전에
(await import('./public/scripts/macros.js')).initMacros(); // 한 번만, power_user를 채운 뒤
S.__naSet({ name1, name2, characters, this_chid, chat, chat_metadata, main_api });
S.substituteParams('{{char}} …', { /* 실리와 같은 옵션 */ });
```

## 파일

| 파일 | 실리 원본 | 어떻게 |
|---|---|---|
| `public/lib.js` | `public/lib.js` | 우리 것: 같은 이름(chevrotain · moment · seedrandom · droll · Handlebars · lodash)을 실리 서버 폴더 node_modules에서 먼저, 없으면 확장 node_modules에서 |
| `public/script.js` | `public/script.js` | 일부 (이름 · 캐릭터 · 채팅 전역 값, substituteParams · substituteParamsLegacy, 카드 칸, getMax*Tokens, getGeneratingModel …). 대역: saveSettingsDebounced |
| `public/scripts/macros.js` | 같음 | 통째로 (옛 엔진) |
| `public/scripts/macros/macro-system.js` | 같음 | 통째로 |
| `public/scripts/macros/engine/*.js` (MacroBrowser.js 빼고 9개) | 같음 | 통째로. MacroCstWalker · MacroEnvBuilder · MacroDiagnostics는 절대 경로 import만 상대 경로로 |
| `public/scripts/macros/definitions/*.js` (7개) | 같음 | 통째로. state-macros는 절대 경로 import만 상대 경로로 |
| `public/scripts/constants.js` | 같음 | 통째로 |
| `public/scripts/util/SimpleMutex.js` | 같음 | 통째로 |
| `public/scripts/power-user.js` | 같음 | 일부 (power_user 기본값, collapseNewlines). 대역: document · getComputedStyle(색 기본값은 빈 글자) |
| `public/scripts/group-chats.js` | 같음 | 일부 (groups, selected_group, getGroupNames, getGroupCharacterCardsLazy) |
| `public/scripts/instruct-mode.js` | 같음 | 일부 (names_behavior_types, formatInstructModeExamples, getInstructMacros) |
| `public/scripts/openai.js` | 같음 | 일부 (chat_completion_sources, parseExampleIntoIndividual, getChatCompletionModel). oai_settings는 기본값 없이 `__naSet`으로 |
| `public/scripts/nai-settings.js` | 같음 | 일부 (nai_settings, getKayraMaxContextTokens) |
| `public/scripts/textgen-settings.js` | 같음 | 일부 (textgenerationwebui_banned_in_macros) |
| `public/scripts/extensions.js` | 같음 | 일부 (extension_settings, extensionNames, findExtension). 대역: saveMetadataDebounced |
| `public/scripts/variables.js` | 같음 | 일부 (지역 · 전역 변수 get/set/add/inc/dec/has/del, getVariableMacros) |
| `public/scripts/st-context.js` | 같음 | 일부 (getContext()의 `variables` 객체만, `variables`로 내보냄) |
| `public/scripts/utils.js` | 같음 | 일부 (convertValueType, isDigitsOnly, getStringHash, isTrueBoolean · isFalseBoolean, timestampToMoment, escapeRegex, uuidv4, equalsIgnoreCaseAndAccents …) |
| `public/scripts/i18n.js` | 같음 | 일부 (t, translate, getCurrentLocale). 대역: localeFile(`__naSet`, 기본 `'en'`) |
| `public/scripts/events.js` | 같음 | 일부 (event_types). 대역: eventSource |
| `public/scripts/popup.js` | 같음 | 일부 (POPUP_RESULT). 대역: Popup(늘 취소) |
| `public/scripts/tokenizers.js` · `tags.js` · `reasoning.js` · `personas.js` · `autocomplete/AutoComplete.js` | 같음 | 일부 (power_user 기본값에 쓰는 상수만) |
| `public/scripts/util/AccountStorage.js` | 같음 | 대역 (getItem은 늘 null) |
| `public/scripts/RossAscends-mods.js` | 같음 | 대역 (isMobile은 늘 false) |
| `public/scripts/slash-commands/SlashCommandClosure.js` | 같음 | 대역 (빈 클래스, convertValueType의 instanceof에만) |

## 서버에서 다른 것

- `{{input}}` · `{{firstDisplayedMessageId}}`(새 엔진)와 옛 엔진의 `{{input}}`은 실리 코드가 `document` · `$`를 바로 불러요. 서버에 없으면 그 매크로는 그대로 남아요.
- `{{lastGenerationType}}`은 eventSource가 대역이라 늘 빈 글자예요. `{{outlet}}`은 `extension_prompts`를 채워야 나와요.
- 시각 매크로(`{{time}}` · `{{date}}` …)는 서버의 시간대와 moment 언어를 따라요.
- 변수는 서버에서 바꿔도 저장하지 않아요(saveMetadataDebounced · saveSettingsDebounced는 아무것도 안 함).
