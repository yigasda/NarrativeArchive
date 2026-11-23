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

## 쓰는 법 (연결 프로필 요청)

```js
import { naLoad, naLoadPresets, naSendRequest, ConnectionManagerRequestService } from './naload.js';
import * as S from './public/script.js';
import { __naSetFetch, naFetchFailures } from './public/naFetch.js';
naLoad(settings, await naLoadPresets(userRoot));   // 일마다: settings.json을 읽은 것 + 사용자 폴더의 프리셋 파일
S.__naSet({ name1, name2 /* , chat, characters, this_chid, chat_metadata … */ });
__naSetFetch(bridge);                              // (url, init) → Response: 실리 서버 자신의 처리기로
const out = await naSendRequest(profileId, messages, maxTokens, { stream: false, extractData: true, includePreset: true, includeInstruct: true }, overridePayload);
if (naFetchFailures.length) { /* 실리 서버 길 하나가 실패했어요(토큰 · 바이어스): 실리는 그 값 없이 보내요. 일꾼이 정해요 */ }
```

- 실리 브라우저의 동기 요청(토크나이저 jQuery.ajax async:false)은 `naAjax`가 받아 둔 답으로 대신해요. 답이 없으면 아무것도 보내지 않고 멈추고(`NaAjaxWait`),
  `naSendRequest`가 다리로 받아 온 뒤 다시 해요.
- 스트리밍(`stream: true`)은 서버에서 안 해요(오류).

## 쓰는 법 (연결 확인)

```js
import { naStatus } from './nastatus.js';
naLoad(settings, await naLoadPresets(userRoot));
await naStatus({ root: userRoot, send: bridge });   // 실리 브라우저의 연결 버튼과 같은 것: online_status · model_list · 글 완성 모델 목록 · 모델 보정
await naStatus({ skip: true });                     // 실리 연결을 쓰지 않는 세계: 묻지 않고 페이지를 연 그대로만
```

- 연결 확인은 옮긴 실리 함수 그대로예요(`openai.js getStatusOpen` · `textgen-settings.js getStatusTextgen` · `kai-settings.js getStatusKobold`, `main_api`의 것 하나).
  채팅 완성은 그 앞에 연결 버튼의 키 확인(`onConnectButtonClick` 6039~6093의 값 부분, `openai.js __naConnectGate`): 그 소스의 키가 없으면 연결하지 않아요.
  키가 있는지는 다리의 `/api/secrets/read`가 알려 줘요(키 글 없이 id · 쓰는 것만). 옛 다리(404)면 키 확인 없이 지금까지처럼.
- `nastatus.js`(우리 것)는 그 함수가 부르는 실리 서버의 상태 길 답을 캐시해요:
  - 열쇠 = 사용자 폴더 · `main_api` · 길 · 실리 코드가 만든 몸통(`custom_include_headers`는 매크로를 풀기 전의 글 + 그때의 `{{user}}`) · 그 소스의 키 상태
    (옛 다리면 secrets.json의 파일 번호 · 시각 · 크기. 없는 파일과 `{}`는 같아요).
  - 다시 묻는 때: 로컬 백엔드(글 완성의 집 백엔드 · Kobold · 사용자 지정 주소 · 프록시) 30분, 클라우드 목록 24시간, 실패는 1분부터 두 배씩 30분까지.
    Azure는 유료 확인까지 갔을 수 있는 답(2xx · 500 `Failed to connect to the Azure endpoint.`)이면 다시 묻지 않아요(진짜 생성 요청이라 돈이 들어요).
    그 답은 사용자 폴더의 `NarrativeArchive/status-azure.json`에 둬서 일꾼을 다시 띄워도 그대로예요. 그 앞에서 끝난 실패(설정 없음 · GET /models 실패 · 다리 오류)는 다른 실패처럼 다시 물어요.
    Azure 칸은 캐시에서 밀려나지 않아요(나머지는 오래 안 쓴 것부터 32개).
  - 열쇠의 키 상태: 채팅 완성은 그 소스의 키, 글 완성은 그 종류의 키(실리 서버 `src/additional-headers.js` 230~245의 표), Kobold는 없음.
  - 다시 물을 때는 기다리지 않아요: 그 일은 둔 답으로 하고 뒤에서 물어요. 처음 묻는 열쇠만 기다려요(시간 제한 15초, 열쇠마다 한 번).
    Azure는 15초가 지나도 다리 요청을 끊지 않아요: 그 일은 연결 안 됨으로 하고, 실리의 답이 오면 그 답을 둬요.
- 화면이 섞인 `saveModelList`의 값 부분을 실리 줄 번호를 적어 따라 해요. 고르기 칸의 change가 부르는 `onModelChange`는 모델 값 · 가드를 따라 하고,
  가드를 지나면 그 뒷부분(문맥 · 온도 · 벌점 칸 고치기, 5695~6011)을 옮긴 그대로 불러요(`openai.js __naModelChangeRest`, 범위 칸 대역 `$`가 브라우저처럼 min · max · step으로 값을 고쳐요).
  NanoGPT는 그 모델의 공급자 고르기(`syncNanoGptProvidersForModel` 417~460의 값 부분, 다리의 `/api/nanogpt/models/providers`)도.
- 실패(꺼진 백엔드 · 옛 다리의 404 · 시간 초과 · 200 `{ error: true }`)는 던지지 않아요: 상태는 `no_connection`, 목록은 그 열쇠로 전에 받은 좋은 답의 것(실리 브라우저처럼).
  실리 창에는 열쇠마다 이유마다 한 번, 실리가 주는 이유(Azure의 message 등)를 옮겨서.
- 실리 로더(`getStatusTextgen`이 await 없이 부르는 모델 목록 로더)의 처리 안 된 오류는 브라우저 콘솔처럼 실리 창에 한 번 적고 계속해요(`textgen-settings.js`의 같은 이름 함수). 일꾼(`plugin/worker.mjs`)도 처리 안 된 오류에 멈추지 않아요.
- 옮기지 않은 것: 지시 형식 · 문맥 프리셋 자동 고르기(`autoSelectInstructPreset`), koboldcpp · llama.cpp `/props` — 브라우저가 그 자리에서 settings.json에 저장해서 서버는 그 값을 써요.

## 파일

| 파일 | 실리 원본 | 어떻게 |
|---|---|---|
| `public/lib.js` | `public/lib.js` | 우리 것: 같은 이름(chevrotain · moment · seedrandom · droll · Handlebars · lodash)을 실리 서버 폴더 node_modules에서 먼저, 없으면 확장 node_modules에서 |
| `public/script.js` | `public/script.js` | 일부 (이름 · 캐릭터 · 채팅 전역 값, substituteParams · substituteParamsLegacy, 카드 칸, getMax*Tokens, getGeneratingModel, setOnlineStatus · resultCheckStatus · abortStatusCheck …). 대역: saveSettingsDebounced · displayOnlineStatus · stopStatusLoading |
| `public/scripts/macros.js` | 같음 | 통째로 (옛 엔진) |
| `public/scripts/macros/macro-system.js` | 같음 | 통째로 |
| `public/scripts/macros/engine/*.js` (MacroBrowser.js 빼고 9개) | 같음 | 통째로. MacroCstWalker · MacroEnvBuilder · MacroDiagnostics는 절대 경로 import만 상대 경로로 |
| `public/scripts/macros/definitions/*.js` (7개) | 같음 | 통째로. state-macros는 절대 경로 import만 상대 경로로 |
| `public/scripts/constants.js` | 같음 | 통째로 |
| `public/scripts/util/SimpleMutex.js` | 같음 | 통째로 |
| `public/scripts/power-user.js` | 같음 | 일부 (power_user 기본값, collapseNewlines). 대역: document · getComputedStyle(색 기본값은 빈 글자) |
| `public/scripts/group-chats.js` | 같음 | 일부 (groups, selected_group, getGroupNames, getGroupCharacterCardsLazy) |
| `public/scripts/instruct-mode.js` | 같음 | 일부 (instruct_presets, migrateInstructModeSettings, getInstructStoppingSequences, formatInstructModeChat · Prompt · SystemPrompt · Examples, getInstructMacros) |
| `public/scripts/openai.js` | 같음 | 일부 (chat_completion_sources, parseExampleIntoIndividual, getChatCompletionModel, 연결 확인 getStatusOpen(화면 · 로그 줄 빼고) · sortModelsBy · groupModelsByVendor, 모델의 최대 문맥 · 온도(5083~5470), onModelChange 뒷부분(5695~6011) · 연결 버튼의 키 확인(6039~6093) · 범위 칸 input 처리기(6776~6831)를 우리 함수로 감싼 것). oai_settings는 기본값 없이 `__naSet`으로. 대역: updateFeatureSupportFlags · saveModelList(값 부분은 `nastatus.js`) · 가격 글 셋 · `$`(범위 칸 넷: 브라우저의 값 고치기를 10진수로). index.html의 고정 모델 칸 옵션(#model_openai_select · #model_google_select)과 #chat_completion_source의 옵션(주석 안의 것 빼고)을 gen.mjs가 뽑아 둬요 |
| `public/scripts/nai-settings.js` | 같음 | 일부 (nai_settings, getKayraMaxContextTokens) |
| `public/scripts/textgen-settings.js` | 같음 | 일부 (createTextGenGenerationData와 딸린 것 · 금지 토큰 · 로짓 바이어스 · 서버 주소 · 연결 확인 getStatusTextgen(프리셋 자동 고르기 · /props · 화면 · 로그 줄 빼고)). 대역: localStorage(Mancer 기본 주소) · document(index.html 1503 dynatemp 종류) · toastr · sessionStorage(tokenizers.js의 것) · 모델 목록 로더(실리 것을 그대로 부르고, 처리 안 된 실패를 실리 창에 한 번) |
| `public/scripts/secrets.js` | 같음 | 일부 (SECRET_KEYS, secret_state: 키 확인에 씀. 값은 일꾼이 다리의 /api/secrets/read로 채워요 — 키 글 없이) |
| `public/scripts/extensions.js` | 같음 | 일부 (extension_settings, extensionNames, findExtension). 대역: saveMetadataDebounced |
| `public/scripts/variables.js` | 같음 | 일부 (지역 · 전역 변수 get/set/add/inc/dec/has/del, getVariableMacros) |
| `public/scripts/st-context.js` | 같음 | 일부 (getContext()의 `variables` 객체만, `variables`로 내보냄) |
| `public/scripts/utils.js` | 같음 | 일부 (convertValueType, isDigitsOnly, getStringHash, isTrueBoolean · isFalseBoolean, timestampToMoment, escapeRegex, uuidv4, equalsIgnoreCaseAndAccents …) |
| `public/scripts/i18n.js` | 같음 | 일부 (t, translate, getCurrentLocale). 대역: localeFile(`__naSet`, 기본 `'en'`) |
| `public/scripts/events.js` | 같음 | 일부 (event_types). 대역: eventSource |
| `public/scripts/popup.js` | 같음 | 일부 (POPUP_RESULT). 대역: Popup(늘 취소) |
| `public/scripts/tokenizers.js` | 같음 | 일부 (getTokenizerModel, getTokenizerBestMatch, getTextTokens와 서버 길). 대역: jQuery.ajax(naAjax) · sessionStorage · getTokenCount(닿지 않음) |
| `public/scripts/reasoning.js` | 같음 | 일부 (reasoning_templates, extractReasoningFromData, removeReasoningFromString · parseReasoningFromString) |
| `public/scripts/tags.js` · `personas.js` · `autocomplete/AutoComplete.js` | 같음 | 일부 (power_user 기본값에 쓰는 상수만) |
| `public/scripts/extensions/shared.js` | 같음 | 일부 (ConnectionManagerRequestService: getProfileIcon · handleDropdown 빼고). 대역: SillyTavern.getContext |
| `public/scripts/custom-request.js` | 같음 | 일부 (9~607 통째로, import만 우리 것). 대역: 스트리밍 셋(닿으면 오류) |
| `public/scripts/preset-manager.js` | 같음 | 일부 (getPresetManager, PresetManager의 getPresetList · getCompletionPresetByName). 대역: registerPresetManagers(index.html의 select 차례) |
| `public/scripts/slash-commands.js` | 같음 | 일부 (CONNECT_API_MAP · setupConnectAPIMap) |
| `public/scripts/logit-bias.js` · `kai-settings.js` · `sysprompt.js` | 같음 | 일부 (BIAS_CACHE · getLogitBiasListResult / 프리셋 목록 · kai_flags · 연결 확인 getStatusKobold · setKoboldFlags(화면 · 로그 줄 빼고) / system_prompts) |
| `public/scripts/textgen-models.js` | 같음 | 일부 (공급자 목록, 모델 목록 전역 10개, 연결 확인이 부르는 로더의 값 줄(목록 · 정렬 · 목록에 없으면 첫 모델), 토크나이저 고르기) |
| `nastatus.js` | 우리 것 | 연결 확인의 상태 답 캐시 · 키 확인 · `saveModelList` 값 부분 · NanoGPT 공급자 · 실리 창 한 줄 (위 "연결 확인") |
| `public/scripts/util/AccountStorage.js` | 같음 | 일부 (1~140 그대로. 145 `accountStorage`는 let으로 두고 일꾼이 settings.json의 accountStorage로 init — 실리 script.js 7935. `Proxy_SkipConfirm_*`이 읽혀서 프록시 연결이 돼요) |
| `public/scripts/RossAscends-mods.js` | 같음 | 대역 (isMobile은 늘 false) |
| `public/scripts/slash-commands/SlashCommandClosure.js` | 같음 | 대역 (빈 클래스, convertValueType의 instanceof에만) |

## 서버에서 다른 것

- `{{input}}` · `{{firstDisplayedMessageId}}`(새 엔진)와 옛 엔진의 `{{input}}`은 실리 코드가 `document` · `$`를 바로 불러요. 서버에 없으면 그 매크로는 그대로 남아요.
- `{{lastGenerationType}}`은 eventSource가 대역이라 늘 빈 글자예요. `{{outlet}}`은 `extension_prompts`를 채워야 나와요.
- 시각 매크로(`{{time}}` · `{{date}}` …)는 서버의 시간대와 moment 언어를 따라요.
- 변수는 서버에서 바꿔도 저장하지 않아요(saveMetadataDebounced · saveSettingsDebounced는 아무것도 안 함).
- 연결 확인 (실리 브라우저와 남는 차이):
  - 실리 브라우저는 페이지를 열 때(자동 연결) · 연결 버튼을 누를 때 한 번 받아 두고 다시 묻지 않아요. 서버는 위의 때마다 다시 묻고, 다시 물은 답은 그다음 일부터 써요
    (다시 묻는 일 자체는 둔 답으로 해요). 자동 연결이 꺼져 있고 버튼을 누르지 않은 브라우저는 연결 안 됨이지만, 서버는 늘 지금 설정으로 연결한 것처럼 해요.
  - 처음 묻는 열쇠는 15초까지 기다리고, 그래도 답이 없으면 실패로 봐요(연결 안 됨). 브라우저는 답이 올 때까지 전 상태를 들고 있어요.
  - 정렬의 `localeCompare`는 서버 Node의 언어(LANG)를 따라요. 브라우저는 그 브라우저 언어예요: 한글 · 악센트가 든 모델 이름이면 "첫 모델"이 다를 수 있어요(ASCII id는 같아요).
  - Mancer 서버 주소는 늘 기본 주소예요(실리는 브라우저 localStorage의 `mancer_server`).
  - 페이지를 열 때 화면이 모델 칸에 change를 일으켜 고치는 문맥 · 온도(소스를 바꿨을 때 · 처음 열 때의 `onModelChange`)는 서버가 하지 않아요. 연결할 때의 것만 해요.
  - `online_status` 글은 영어예요(브라우저는 그 언어로 번역).
  - 서버는 일마다 모델에 맞춰 문맥 · 온도를 깎아요(`onModelChange` 뒷부분). 연결한 뒤 프리셋을 불러온 브라우저(`bind_preset_to_connection` 꺼짐 · 연결 프로필)는 깎지 않은 값을 그대로 보내요.
  - 소스 목록은 실리 1.19.1의 것이에요. 더 새 실리의 새 소스는 서버에서 `'undefined'`가 돼요(연결 · `{{model}}`). 'source' 방 · 프로필 요청은 자기 소스를 넣어서 괜찮아요.
