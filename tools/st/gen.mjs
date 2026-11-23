// Builds REPO/plugin/st/public/ from SillyTavern 1.19.1 sources.
// Full copies: header + file with only listed import replacements.
// Partial copies: own lines + `// 실리 <path> <a>~<b>` blocks copied from ST lines a..b.
// 쓰기: node tools/st/gen.mjs <실리 1.19.1 폴더> <이 저장소 폴더>   (plugin/st/public을 다시 만들어요. 고칠 때는 이 파일을 고치고 다시 돌려요)
import fs from 'node:fs';
import path from 'node:path';

const [,, ST, REPO] = process.argv;
const OUT = path.join(REPO, 'plugin/st/public');
const why = '(서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).';
const stLines = new Map();
function lines(rel) {
    if (!stLines.has(rel)) stLines.set(rel, fs.readFileSync(path.join(ST, rel), 'utf8').split('\n'));
    return stLines.get(rel);
}
function write(rel, text) {
    const f = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
}

// ---------- full copies ----------
function full(rel, replaces = [], changed = '없음') {
    const src = fs.readFileSync(path.join(ST, 'public', rel), 'utf8');
    let out = src;
    for (const [from, to] of replaces) {
        const n = out.split(from).length - 1;
        if (n !== 1) throw new Error(`${rel}: "${from}" found ${n} times`);
        out = out.replace(from, to);
    }
    const head = `// 실리 1.19.1 public/${rel}를 그대로 옮긴 것 ${why}\n// 바꾼 것: ${changed}\n`;
    write(rel, head + out);
}
const absNote = (pairs) => `없음 (import 절대 경로 → 상대 경로만: ${pairs})`;

full('scripts/macros/macro-system.js');
full('scripts/macros/engine/MacroEngine.js');
full('scripts/macros/engine/MacroRegistry.js');
full('scripts/macros/engine/MacroEnvBuilder.js', [["from '/scripts/utils.js';", "from '../../utils.js';"]], absNote("실리 4줄 '/scripts/utils.js' → '../../utils.js'"));
full('scripts/macros/engine/MacroEnv.types.js');
full('scripts/macros/engine/MacroFlags.js');
full('scripts/macros/engine/MacroDiagnostics.js', [
    ["from '/scripts/i18n.js';", "from '../../i18n.js';"],
    ["from '/scripts/popup.js';", "from '../../popup.js';"],
    ["from '/scripts/power-user.js';", "from '../../power-user.js';"],
    ["from '/scripts/util/AccountStorage.js';", "from '../../util/AccountStorage.js';"],
    ["from '/scripts/util/SimpleMutex.js';", "from '../../util/SimpleMutex.js';"],
], absNote("실리 6~10줄 '/scripts/…' → '../../…'"));
full('scripts/macros/engine/MacroLexer.js');
full('scripts/macros/engine/MacroParser.js');
full('scripts/macros/engine/MacroCstWalker.js', [["from '/scripts/utils.js';", "from '../../utils.js';"]], absNote("실리 11줄 '/scripts/utils.js' → '../../utils.js'"));
for (const d of ['chat-macros', 'core-macros', 'env-macros', 'instruct-macros', 'time-macros', 'variable-macros']) full(`scripts/macros/definitions/${d}.js`);
full('scripts/macros/definitions/state-macros.js', [["from '/scripts/extensions.js';", "from '../../extensions.js';"]], absNote("실리 3줄 '/scripts/extensions.js' → '../../extensions.js'"));
full('scripts/macros.js');
full('scripts/constants.js');
full('scripts/util/SimpleMutex.js');

// ---------- partial copies ----------
// item: [a, b] = ST lines of the same file; string = our own lines
function partial(rel, items, { stub = '' } = {}) {
    const stRel = `public/${rel}`;
    const L = lines(stRel);
    const head = [
        `// 실리 1.19.1 public/${rel}의 일부를 그대로 옮긴 것 ${why}`,
        `// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 \`// 실리 <경로> <시작줄>~<끝줄>\`. 그 밖의 줄은 우리 것: import, \`__naSet\`(일꾼이 전역 값을 채움)${stub ? ', 대역(' + stub + ')' : ''}.`,
    ];
    const body = [];
    for (const it of items) {
        if (typeof it === 'string') { body.push(it); continue; }
        const [a, b, other] = it;
        const src = other ? lines(other) : L;
        const p = other ?? stRel;
        if (b > src.length || a < 1 || b < a) throw new Error(`${rel}: bad range ${a}~${b}`);
        body.push(`// 실리 ${p} ${a}~${b}`);
        body.push(...src.slice(a - 1, b));
    }
    write(rel, head.join('\n') + '\n' + body.join('\n') + '\n');
}

// helper for const objects: like SillyTavern's load (Object.assign over the defaults)
const resetAssign = (name) => `    if (Object.hasOwn(v, '${name}')) {
        for (const key of Object.keys(${name})) delete ${name}[key];
        Object.assign(${name}, structuredClone(__naDefault_${name}), v.${name});
    }`;
const rebind = (name) => `    if (Object.hasOwn(v, '${name}')) ${name} = v.${name};`;

// public/script.js
partial('script.js', [
    `import { power_user, collapseNewlines } from './scripts/power-user.js';
import { groups, selected_group, getGroupCharacterCardsLazy } from './scripts/group-chats.js';
import { formatInstructModeExamples } from './scripts/instruct-mode.js';
import { evaluateMacros } from './scripts/macros.js';
import { MacroEnvBuilder } from './scripts/macros/engine/MacroEnvBuilder.js';
import { MacroEngine } from './scripts/macros/engine/MacroEngine.js';
import { onboardingExperimentalMacroEngine } from './scripts/macros/engine/MacroDiagnostics.js';
import { accountStorage } from './scripts/util/AccountStorage.js';
import { nai_settings, getKayraMaxContextTokens } from './scripts/nai-settings.js';
import { oai_settings, getChatCompletionModel, chat_completion_sources } from './scripts/openai.js';
import { event_types, eventSource } from './scripts/events.js';
import { getCustomStoppingStrings } from './scripts/power-user.js';
import { getInstructStoppingSequences } from './scripts/instruct-mode.js';
import { onlyUnique } from './scripts/utils.js';
import { removeReasoningFromString } from './scripts/reasoning.js';
import { CONNECT_API_MAP } from './scripts/slash-commands.js';

export { event_types, eventSource };
// (실리 script.js 321: slash-commands.js의 CONNECT_API_MAP을 다시 내보냄)
export { CONNECT_API_MAP };
`,
    [405, 405], [407, 411], '', [426, 432], '', [453, 454], '',
    `// 대역: 실리 saveSettingsDebounced(470줄)는 브라우저 설정을 저장해요. 서버는 변수를 저장하지 않아서 아무것도 안 해요.
export const saveSettingsDebounced = () => {};
// 대역: 실리 token(브라우저 세션의 CSRF 토큰)은 서버에 없어요. 서버가 보내는 요청은 다리가 자기 토큰을 붙여요(plugin/bridge.mjs).
let token;
`,
    [484, 498], '', [541, 547], '', [601, 601], '', [616, 617], '', [627, 627], '', [629, 629], '', [635, 635], '', [647, 658], '',
    [2831, 2961], '', [2981, 3015], '', [3018, 3066], '', [3341, 3352], '', [3375, 3393], '', [3402, 3468], '', [3476, 3494], '', [3501, 3515], '',
    [5929, 5960], '', [5966, 5974], '', [5981, 5987], '', [6166, 6185], '', [6270, 6300], '', [6302, 6366], '', [7050, 7070], '',
    `/**
 * 일꾼이 실리 전역 값을 채워요. v에 있는 키만 바꿔요.
 * @param {{name1?: string, name2?: string, chat?: object[], characters?: object[], this_chid?: string|number|undefined, chat_metadata?: object, online_status?: string, amount_gen?: number, max_context?: number, extension_prompts?: object, main_api?: string, kobold_horde_model?: string}} v
 */
export function __naSet(v) {
${['name1', 'name2', 'chat', 'characters', 'this_chid', 'chat_metadata', 'online_status', 'amount_gen', 'max_context', 'extension_prompts', 'main_api', 'kobold_horde_model'].map(rebind).join('\n')}
}`,
], { stub: 'saveSettingsDebounced' });

// public/scripts/power-user.js
partial('scripts/power-user.js', [
    `import { extension_prompt_types, extension_prompt_roles, substituteParams } from '../script.js';
import { names_behavior_types } from './instruct-mode.js';
import { tag_import_setting, tag_sort_mode } from './tags.js';
import { tokenizers } from './tokenizers.js';
import { AUTOCOMPLETE_SELECT_KEY, AUTOCOMPLETE_STATE, AUTOCOMPLETE_WIDTH } from './autocomplete/AutoComplete.js';
import { DEFAULT_REASONING_TEMPLATE } from './reasoning.js';
import { IMAGE_OVERSWIPE, MEDIA_DISPLAY } from './constants.js';
import { persona_description_positions as _persona_description_positions } from './personas.js';

// 대역: power_user의 색 기본값(실리 159~168줄)은 브라우저 CSS 변수를 읽어요. 서버에는 없어서 빈 글자가 돼요.
const document = { documentElement: null };
const getComputedStyle = () => ({ getPropertyValue: () => '' });
`,
    [90, 93], '', [95, 100], '', [102, 112], '', [114, 343], '',
    `const __naDefault_power_user = structuredClone(power_user);
`,
    [347, 348], '', [354, 369], '',
    [401, 410], '',
    `// (실리에서는 loadContextSettings(1944~) 안의 함수예요. 일꾼이 그 값 부분을 따라 하려고 같은 줄을 밖에 둬요: plugin/st/naload.js)`,
    [1949, 1981], '', [3011, 3011], '', [3078, 3120], '',
    `export { contextControls, autoFixStoryString };

/**
 * 일꾼이 실리 설정의 power_user를 채워요(실리 loadPowerUserSettings처럼 기본값 위에 Object.assign). v에 있는 키만 바꿔요.
 * context_presets는 실리 1613~1615(data.context, /api/settings/get의 context 폴더).
 * @param {{power_user?: object, context_presets?: object[]}} v
 */
export function __naSet(v) {
${resetAssign('power_user')}
${rebind('context_presets')}
}`,
], { stub: 'document · getComputedStyle' });

partial('scripts/tokenizers.js', [
    `import { main_api, online_status } from '../script.js';
import { power_user } from './power-user.js';
import { chat_completion_sources, model_list, oai_settings } from './openai.js';
import { nai_settings } from './nai-settings.js';
import { kai_flags, kai_settings } from './kai-settings.js';
import { textgen_types, textgenerationwebui_settings as textgen_settings, getTextGenServer, getTextGenModel } from './textgen-settings.js';
import { getCurrentDreamGenModelTokenizer, getCurrentOpenRouterModelTokenizer, openRouterModels } from './textgen-models.js';
import { naAjax } from '../naFetch.js';

// 대역: 실리는 jQuery.ajax({ async: false })로 실리 서버에 동기 요청(XHR)을 보내고 그 자리에서 답을 받아요(getTextTokensFromServer 등).
// Node에는 동기 요청이 없어요. naAjax(plugin/st/public/naFetch.js)는 미리 받아 둔 실리 서버의 답을 그 자리에서 돌려주고, 없으면 적어 둬요:
// 일꾼(plugin/st/naload.js naSendRequest)이 다리로 받아 온 뒤 같은 일을 다시 해요. 그래서 토큰 id는 실리 서버가 브라우저에 주는 것과 같아요.
const jQuery = { ajax: naAjax };
// 대역: 실리 sessionStorage(브라우저 탭 저장). 서버는 이 모듈 안에만 둬요. 서버는 백엔드에 연결 확인을 하지 않아서(online_status 'no_connection')
// getTokenizerBestMatch가 이 값을 묻는 갈래(연결됐을 때)에는 가지 않아요.
const __naSession = new Map();
const sessionStorage = {
    getItem: (k) => (__naSession.has(k) ? __naSession.get(k) : null),
    setItem: (k, v) => { __naSession.set(k, String(v)); },
    removeItem: (k) => { __naSession.delete(k); },
};
// 대역: 실리 getTokenCount(492~546). apiFailureTokenCount가 부르는 것은 API 토크나이저(연결됐을 때)를 쓰다 실패했을 때뿐이라 서버에서는 닿지 않아요.
function getTokenCount() {
    throw new Error('getTokenCount: 서버에는 없습니다.');
}
`,
    [12, 14], '', [16, 38], '', [40, 56], '', [58, 63], '', [65, 154], '', [156, 156], '', [161, 169], '', [280, 365], '', [367, 377], '',
    [569, 790], '', [979, 986], '', [1019, 1122], '', [1151, 1184],
], { stub: 'jQuery.ajax · sessionStorage · getTokenCount' });
partial('scripts/tags.js', [[245, 258]]);
partial('scripts/reasoning.js', [
    `import { main_api } from '../script.js';
import { chat_completion_sources, oai_settings } from './openai.js';
import { power_user } from './power-user.js';
import { textgen_types, textgenerationwebui_settings } from './textgen-settings.js';
import { escapeRegex, trimSpaces } from './utils.js';
`,
    [29, 32], '', [34, 34], '', [107, 168], '', [1424, 1436], '', [1450, 1490],
]);

// public/scripts/logit-bias.js
partial('scripts/logit-bias.js', [
    `import { getTextTokens } from './tokenizers.js';
`,
    [5, 5], '', [97, 142],
]);

// public/scripts/kai-settings.js (preset-manager.js getPresetList · tokenizers.js getTokenizerBestMatch가 묻는 것)
partial('scripts/kai-settings.js', [
    [25, 26], '', [28, 50], '', [52, 65], '',
    `/**
 * koboldai_settings · koboldai_setting_names는 실리 loadKoboldSettings 98~110의 값(프리셋 객체 배열 · {이름: 번호}).
 * @param {{koboldai_settings?: object[], koboldai_setting_names?: object}} v
 */
export function __naSet(v) {
${rebind('koboldai_settings')}
${rebind('koboldai_setting_names')}
}`,
]);

// public/scripts/sysprompt.js (preset-manager.js getPresetList가 묻는 것)
partial('scripts/sysprompt.js', [
    [15, 15], '',
    `/**
 * system_prompts는 실리 loadSystemPrompts 50~53(data.sysprompt, /api/settings/get의 sysprompt 폴더).
 * @param {{system_prompts?: object[]}} v
 */
export function __naSet(v) {
${rebind('system_prompts')}
}`,
]);

// public/scripts/slash-commands.js (CONNECT_API_MAP: 실리는 페이지를 열 때 initDefaultSlashCommands 228에서 만들어요. 일꾼은 naInit에서 한 번)
partial('scripts/slash-commands.js', [
    `import { chat_completion_sources } from './openai.js';
import { textgen_types } from './textgen-settings.js';
`,
    [133, 145], '', [147, 224], '',
    `export { setupConnectAPIMap };`,
]);

// public/scripts/preset-manager.js (getPresetManager → getCompletionPresetByName)
partial('scripts/preset-manager.js', [
    `import { main_api } from '../script.js';
import { instruct_presets } from './instruct-mode.js';
import { kai_settings, koboldai_settings, koboldai_setting_names } from './kai-settings.js';
import { nai_settings, novelai_settings, novelai_setting_names } from './nai-settings.js';
import { oai_settings, openai_setting_names, openai_settings } from './openai.js';
import { context_presets, power_user } from './power-user.js';
import { reasoning_templates } from './reasoning.js';
import { system_prompts } from './sysprompt.js';
import {
    textgenerationwebui_settings as textgen_settings,
    textgenerationwebui_preset_names,
    textgenerationwebui_presets,
} from './textgen-settings.js';
`,
    [44, 44], '', [78, 96], '',
    [111, 116],
    `    // (실리 117~525: 가져오기 · 내보내기 · 화면 고르기 · 저장 · 이름 바꾸기. 서버에서는 안 써요)
`,
    [526, 602],
    `
    // (실리 604~751: 화면 목록 · 저장할 값 만들기. 서버에서는 안 써요)
`,
    [752, 779],
    `
    // (실리 780~908: 지우기 · 되돌리기 · 확장 칸. 서버에서는 안 써요)`,
    [909, 909], '',
    `// 대역: 실리 registerPresetManagers(101~109)는 화면의 select[data-preset-manager-for]마다 new PresetManager($(select), apiId)를 만들어요.
// 실리 initPresetManager(991~)가 페이지를 열 때 한 번 불러요. 서버에는 화면이 없어서 index.html의 그 select들과 같은 차례 · 같은 apiId로 만들어요
// (index.html 110 kobold · 152 novel · 198 openai · 235 textgenerationwebui · 4139 context · 4278 instruct · 4461 sysprompt · 4597 reasoning). select 자리는 null.
export function __naRegisterPresetManagers() {
    for (const apiId of ['kobold', 'novel', 'openai', 'textgenerationwebui', 'context', 'instruct', 'sysprompt', 'reasoning']) {
        presetManagers[apiId] = new PresetManager(null, apiId);
    }
}`,
], { stub: 'registerPresetManagers' });

// public/scripts/custom-request.js (TextCompletionService · ChatCompletionService 통째로, 파일 머리 import만 우리 것)
partial('scripts/custom-request.js', [
    `import { getPresetManager } from './preset-manager.js';
import { extractJsonFromData, extractMessageFromData, getGenerateUrl, getRequestHeaders, name1, name2 } from '../script.js';
import { getTextGenServer, createTextGenGenerationData, setting_names, textgenerationwebui_settings } from './textgen-settings.js';
import { extractReasoningFromData } from './reasoning.js';
import { formatInstructModeChat, formatInstructModePrompt, getInstructStoppingSequences } from './instruct-mode.js';
import { createGenerationParameters, settingsToUpdate, oai_settings } from './openai.js';
import { naFetch as fetch } from '../naFetch.js';

// 대역: 스트리밍(stream: true) 갈래가 쓰는 것들(실리 openai.js getStreamingReply 3222~ · tryParseStreamingError 1648~, sse-stream.js EventSourceStream).
// 서버는 스트리밍 요청을 보내지 않아요(일꾼은 늘 stream: false). 닿으면 오류로 멈춰요.
const __naNoStream = () => { throw new Error('서버는 스트리밍 요청을 지원하지 않습니다.'); };
const getStreamingReply = __naNoStream;
const tryParseStreamingError = __naNoStream;
class EventSourceStream { constructor() { __naNoStream(); } }
`,
    [9, 607],
], { stub: 'getStreamingReply · tryParseStreamingError · EventSourceStream(스트리밍)' });

// public/scripts/extensions/shared.js (ConnectionManagerRequestService: 화면 것(getProfileIcon · handleDropdown) 빼고)
partial('scripts/extensions/shared.js', [
    `import { CONNECT_API_MAP } from '../../script.js';
import { extension_settings } from '../extensions.js';
import { t } from '../i18n.js';
import { proxies } from '../openai.js';
import { ChatCompletionService, TextCompletionService } from '../custom-request.js';

// 대역: 실리 SillyTavern.getContext()는 브라우저 전역(st-context.js getContext 115~)이에요. 이 클래스가 묻는 네 가지만 같은 값으로:
// st-context.js 201 extensionSettings: extension_settings · 285 CONNECT_API_MAP · 292 ChatCompletionService · 293 TextCompletionService.
const SillyTavern = {
    getContext: () => ({ extensionSettings: extension_settings, CONNECT_API_MAP, ChatCompletionService, TextCompletionService }),
};
`,
    [389, 550],
    `
    // (실리 552~573 getProfileIcon: 화면 아이콘. 서버에서는 안 써요)
`,
    [575, 623],
    `
    // (실리 625~787 handleDropdown: 화면 고르기 칸. 서버에서는 안 써요)`,
    [788, 788],
], { stub: 'SillyTavern.getContext' });
partial('scripts/personas.js', [[88, 98]]);
partial('scripts/autocomplete/AutoComplete.js', [[9, 30]]);

// public/scripts/events.js
partial('scripts/events.js', [
    [3, 111], '',
    `// 대역: 실리 eventSource(113줄, lib/eventemitter.js)는 브라우저 localStorage를 써요. 서버에서는 이벤트를 받지도 보내지도 않아요.
export const eventSource = {
    on() {},
    once() {},
    makeFirst() {},
    makeLast() {},
    removeListener() {},
    async emit() {},
    async emitAndWait() {},
};`,
], { stub: 'eventSource' });

// public/scripts/i18n.js
partial('scripts/i18n.js', [
    `// 대역: 실리 localeFile(6줄)은 브라우저 localStorage · navigator.language에서 와요. 서버는 \`__naSet({ localeFile })\`로 채워요.
let localeFile = 'en';
`,
    [10, 10], '', [13, 13], '', [15, 15], '', [63, 111], '',
    `/**
 * @param {{localeFile?: string}} v
 */
export function __naSet(v) {
${rebind('localeFile')}
}`,
], { stub: 'localeFile' });

// public/scripts/popup.js
partial('scripts/popup.js', [
    [24, 37], '',
    `// 대역: 실리 Popup(149줄~)은 브라우저 창이에요. 서버에서는 띄우지 않고 '취소'로 끝나요.
export class Popup {
    static show = {
        input: async () => null,
        confirm: async () => POPUP_RESULT.CANCELLED,
        text: async () => POPUP_RESULT.CANCELLED,
    };
}`,
], { stub: 'Popup' });

// public/scripts/util/AccountStorage.js — stub only
partial('scripts/util/AccountStorage.js', [
    [1, 140], '',
    `// 우리 것: 실리 145줄 \`export const accountStorage = new AccountStorage();\`을 일마다 새로 만들게 let으로 둬요.
// 일꾼이 settings.json의 accountStorage로 init해요(실리 script.js 7935 \`accountStorage.init(settings?.accountStorage)\`).
// 실리는 처음 한 번 브라우저 localStorage의 값을 옮겨 와요(#migrateLocalStorage). 서버에는 그 localStorage가 없어서, 옮긴 표시가 없으면 표시만 붙여요.
export let accountStorage = new AccountStorage();
accountStorage.init({ [MIGRATED_MARKER]: '1' });

/**
 * @param {{accountStorage?: object}} v
 */
export function __naSet(v) {
    if (!Object.hasOwn(v, 'accountStorage')) return;
    const state = v.accountStorage && typeof v.accountStorage === 'object' ? { ...v.accountStorage } : {};
    if (!Object.hasOwn(state, MIGRATED_MARKER)) state[MIGRATED_MARKER] = '1';
    accountStorage = new AccountStorage();
    accountStorage.init(state);
}`,
])

// public/scripts/RossAscends-mods.js — stub only
write('scripts/RossAscends-mods.js', `// 실리 1.19.1 public/scripts/RossAscends-mods.js 대역 ${why}
// 바꾼 것: 통째로 대역. 실리 isMobile(143~147줄)은 브라우저 UA를 봐요. 서버에서는 늘 false.
export function isMobile() {
    return false;
}
`);

// public/scripts/slash-commands/SlashCommandClosure.js — stub only
write('scripts/slash-commands/SlashCommandClosure.js', `// 실리 1.19.1 public/scripts/slash-commands/SlashCommandClosure.js 대역 ${why}
// 바꾼 것: 통째로 대역. utils.js convertValueType의 instanceof 검사에만 쓰여요. 서버에는 STscript가 없어서 빈 클래스.
export class SlashCommandClosure {}
`);

// public/scripts/utils.js
partial('scripts/utils.js', [
    `import { moment } from '../lib.js';
import { SlashCommandClosure } from './slash-commands/SlashCommandClosure.js';
import { getCurrentLocale } from './i18n.js';
import { power_user } from './power-user.js';
`,
    [104, 111], '', [202, 268], '', [301, 310], '', [346, 356], '', [512, 539], '', [868, 873], '', [1005, 1021], '', [1070, 1146], '', [1370, 1379], '', [1954, 1969], '',
    [2234, 2252], '', [2266, 2276], '', [2767, 2782], '', [3056, 3056],
]);

// public/scripts/group-chats.js
partial('scripts/group-chats.js', [
    `import { characters, chat_metadata, baseChatReplace, createLazyFields } from '../script.js';
`,
    [113, 116], '', [129, 133], '', [333, 345], '', [490, 571], '',
    `export { groups, selected_group };

/**
 * @param {{groups?: object[], selected_group?: string|null}} v
 */
export function __naSet(v) {
${rebind('groups')}
${rebind('selected_group')}
}`,
]);

// public/scripts/instruct-mode.js
partial('scripts/instruct-mode.js', [
    `import { name1, name2, substituteParams } from '../script.js';
import { selected_group } from './group-chats.js';
import { parseExampleIntoIndividual } from './openai.js';
import { power_user } from './power-user.js';
import { onlyUnique } from './utils.js';
`,
    [12, 15], '', [17, 21], '', [50, 105], '', [294, 372], '', [374, 468], '', [504, 579], '', [581, 651], '', [667, 785], '',
    `export { migrateInstructModeSettings };

/**
 * 일꾼이 채워요. instruct_presets는 실리 loadInstructMode 112~114(data.instruct, /api/settings/get의 instruct 폴더).
 * @param {{instruct_presets?: object[]}} v
 */
export function __naSet(v) {
${rebind('instruct_presets')}
}`,
]);

// public/scripts/openai.js (keep ST line order)
partial('scripts/openai.js', [
    `import { name1, name2, substituteParams, getCurrentChatId, getRequestHeaders } from '../script.js';
import { getGroupNames, selected_group } from './group-chats.js';
import { chatCompletionDefaultPrompts, promptManagerDefaultPromptOrders } from './PromptManager.js';
import { getCustomStoppingStrings, power_user } from './power-user.js';
import { getTokenizerModel } from './tokenizers.js';
import { Popup } from './popup.js';
import { t } from './i18n.js';
import { ToolManager } from './tool-calling.js';
import { accountStorage } from './util/AccountStorage.js';
import { getStringHash, clamp } from './utils.js';
import { naFetch as fetch } from '../naFetch.js';

// 대역: 브라우저 화면 것들 (validateReverseProxy가 불러요). 서버에는 화면이 없어요
const DOMPurify = { sanitize: x => x };
const toastr = { error: (...a) => console.warn('[narrative-archive plugin]', ...a) };
const setOnlineStatus = () => {};
const resultCheckStatus = () => {};
const renderTemplateAsync = async () => '';
`,
    [102, 124], '', [126, 144], '',
    [174, 175], '', [177, 204], '', [206, 218], '', [220, 237], '', [239, 253], '', [255, 259], '', [267, 285], '',
    [305, 409], '', [411, 518], '', [520, 520], '', [522, 529], '', [531, 532], '',
    [537, 563], '',
    [723, 787], '', [1717, 1782], '',
    [2545, 2664], '', [2671, 2680], '', [2691, 3127], '',
    [3401, 3418], '',
    [4274, 4313], '',
    `export { oai_settings, default_settings, migrateChatCompletionSettings, continue_postfix_types };

/**
 * 일꾼이 모듈 전역 값을 채워요. v에 있는 키만 바꿔요.
 * openai_settings · openai_setting_names는 실리 loadOpenAISettings 4321~4336의 값(프리셋 객체 배열 · {이름: 번호}).
 * @param {{model_list?: object[], proxies?: object[], selected_proxy?: object, biasCache?: object, openai_settings?: object[], openai_setting_names?: object}} v
 */
export function __naSet(v) {
${rebind('model_list')}
${rebind('proxies')}
${rebind('selected_proxy')}
${rebind('biasCache')}
${rebind('openai_settings')}
${rebind('openai_setting_names')}
}`,
], { stub: 'DOMPurify · toastr · setOnlineStatus · resultCheckStatus · renderTemplateAsync' });

// public/scripts/PromptManager.js (default_settings의 기본 지시문)
partial('scripts/PromptManager.js', [
    [2001, 2081], '', [2083, 2085], '',
    `export { chatCompletionDefaultPrompts, promptManagerDefaultPromptOrders };`,
]);

// public/scripts/tool-calling.js (createGenerationParameters가 묻는 것만. 서버에는 등록된 도구가 없어요)
partial('scripts/tool-calling.js', [
    `import { main_api } from '../script.js';
import { chat_completion_sources, custom_prompt_post_processing_types, getChatCompletionModel, model_list, oai_settings } from './openai.js';
`,
    [242, 248], '', [256, 263], '',
    [400, 418], '',
    [614, 685], '',
    [694, 700],
    `}`,
]);

// public/scripts/textgen-models.js
partial('scripts/textgen-models.js', [
    `import { textgenerationwebui_settings as textgen_settings } from './textgen-settings.js';
import { tokenizers } from './tokenizers.js';
`,
    [15, 15], '', [21, 21], '', [23, 113], '', [1347, 1385], '',
    `// (실리 initTextGenModels 1403~1409가 이 목록으로 화면의 공급자 칸(.openrouter_providers)을 채워요. 일꾼이 loadTextGenSettings 594의 값 부분에 써요)
export { OPENROUTER_PROVIDERS };

/**
 * @param {{openRouterModels?: object[]}} v
 */
export function __naSet(v) {
${rebind('openRouterModels')}
}`,
]);

// public/scripts/nai-settings.js
partial('scripts/nai-settings.js', [
    [24, 25], '', [33, 34], '', [36, 62], '', [84, 84], '', [92, 103], '',
    `const __naDefault_nai_settings = structuredClone(nai_settings);

/**
 * novelai_settings · novelai_setting_names는 실리 loadNovelSettings 216~229의 값(프리셋 객체 배열 · {이름: 번호}).
 * @param {{nai_settings?: object, novel_data?: object|null, novelai_settings?: object[], novelai_setting_names?: object}} v
 */
export function __naSet(v) {
${resetAssign('nai_settings')}
${rebind('novel_data')}
${rebind('novelai_settings')}
${rebind('novelai_setting_names')}
}`,
]);

// public/scripts/textgen-settings.js
partial('scripts/textgen-settings.js', [
    `import { getStoppingStrings, main_api, max_context, substituteParams } from '../script.js';
import { t } from './i18n.js';
import { BIAS_CACHE, getLogitBiasListResult } from './logit-bias.js';
import { power_user } from './power-user.js';
import { getCurrentDreamGenModelTokenizer, getCurrentOpenRouterModelTokenizer } from './textgen-models.js';
import { ENCODE_TOKENIZERS, TEXTGEN_TOKENIZERS, getTextTokens, getTokenizerBestMatch, tokenizers } from './tokenizers.js';
import { onlyUnique, arraysEqual, isObject } from './utils.js';

// 대역: 실리 localStorage(브라우저 저장). 실리 124줄 MANCER_SERVER는 거기 'mancer_server'(디버그 메뉴 'change-mancer-url'로만 바꿈)가 없으면
// 기본 주소예요. 서버에서는 그 브라우저 값을 읽을 수 없어서 늘 기본 주소(MANCER_SERVER_DEFAULT)예요.
const localStorage = { getItem: () => null };
// 대역: 실리 325줄 DYNATEMP_BLOCK은 화면의 #dynatemp_block_ooba예요. isDynamicTemperatureSupported는 그 data-tg-type만 읽어요.
// 그 값은 실리 index.html 1503줄 그대로: <div data-tg-type="ooba, mancer, koboldcpp, tabby, llamacpp, aphrodite" ... id="dynatemp_block_ooba">
const document = { getElementById: (id) => (id === 'dynatemp_block_ooba' ? { dataset: { tgType: 'ooba, mancer, koboldcpp, tabby, llamacpp, aphrodite' } } : null) };
// 대역: 실리 toastr(화면 알림). 서버는 실리 창 로그로만.
const toastr = { error: (...a) => console.warn('[narrative-archive plugin]', ...a) };
`,
    [31, 65], '', [67, 117], '', [118, 130], '', [131, 141], '', [143, 237], '', [243, 246], '', [248, 323], '', [325, 325], '',
    [346, 369], '', [404, 499], '', [513, 550], '', [1180, 1197], '', [1447, 1458], '', [1460, 1545], '', [1547, 1842], '',
    `// (실리 파일 안에서만 쓰는 이름들: 일꾼이 loadTextGenSettings 552~608의 값 부분을 따라 할 때 써요, plugin/st/naload.js)
export { KOBOLDCPP_ORDER, OOBA_DEFAULT_ORDER, LLAMACPP_DEFAULT_ORDER, BIAS_KEY, MANCER, convertPresets, insertMissingArrayItems };

const __naDefault_textgenerationwebui_settings = structuredClone(textgenerationwebui_settings);

/**
 * textgenerationwebui_presets · textgenerationwebui_preset_names는 실리 loadTextGenSettings 554~555의 값(프리셋 객체 배열 · 이름 배열).
 * @param {{textgenerationwebui_banned_in_macros?: string[], textgenerationwebui_settings?: object, textgenerationwebui_presets?: object[], textgenerationwebui_preset_names?: string[]}} v
 */
export function __naSet(v) {
${rebind('textgenerationwebui_banned_in_macros')}
${resetAssign('textgenerationwebui_settings')}
${rebind('textgenerationwebui_presets')}
${rebind('textgenerationwebui_preset_names')}
}`,
], { stub: 'localStorage · document(dynatemp_block_ooba) · toastr' });

// public/scripts/extensions.js
partial('scripts/extensions.js', [
    `import { equalsIgnoreCaseAndAccents } from './utils.js';
`,
    [21, 21], '', [62, 62], '',
    `// 대역: 실리 saveMetadataDebounced(89~113줄)는 채팅 메타데이터를 저장해요. 서버는 변수를 저장하지 않아서 아무것도 안 해요.
export function saveMetadataDebounced() {}
`,
    [141, 226], '',
    `const __naDefault_extension_settings = structuredClone(extension_settings);
`,
    [502, 515], '',
    `/**
 * 일꾼이 채워요. extension_settings는 실리 loadExtensionSettings처럼 기본값 위에 Object.assign.
 * @param {{extensionNames?: string[], extension_settings?: object}} v
 */
export function __naSet(v) {
${rebind('extensionNames')}
${resetAssign('extension_settings')}
}`,
], { stub: 'saveMetadataDebounced' });

// public/scripts/variables.js
partial('scripts/variables.js', [
    `import { chat_metadata, saveSettingsDebounced } from '../script.js';
import { extension_settings, saveMetadataDebounced } from './extensions.js';
import { convertValueType } from './utils.js';
`,
    [22, 210], '', [234, 261], '', [417, 433], '', [587, 617],
]);

// public/scripts/st-context.js — only the `variables` object of getContext()
partial('scripts/st-context.js', [
    [106, 106], '',
    `// 실리 getContext()가 돌려주는 객체 중 variables만. 일꾼이 globalThis.SillyTavern.getContext()에 넣어요.
const __naContext = {`,
    [258, 277],
    `};

export const variables = __naContext.variables;`,
]);

// public/lib.js — our loader
write('naFetch.js', `// 우리 것 (실리 파일 아님): 옮긴 실리 코드의 fetch('/api/...') 자리. 서버 플러그인 일꾼이 \`__naSetFetch\`로 실리 서버에 보내는 길(다리)을 줘요.
// 실리 브라우저가 그 길로 보내는 것과 같은 요청이 실리 서버 자신의 처리기로 가요(예: 로짓 바이어스의 /api/backends/chat-completions/bias).
// 실리 코드가 실패를 삼키는 자리가 있어서(openai.js calculateLogitBias는 실패하면 바이어스 없이 보내요) 실패한 길은 적어 둬요: 일꾼이 그 요청을 보내지 않고 이유를 알려요.
let send = null;
export const naFetchFailures = [];
export function __naSetFetch(fn) { send = typeof fn === 'function' ? fn : null; naFetchFailures.length = 0; ajaxAnswers.clear(); naAjaxPending.length = 0; }
export async function naFetch(url, init = {}) {
    const u = String(url);
    // (실리 브라우저가 동기로 받았을 답(naAjax)이 아직 없으면 아무것도 보내지 않아요: 그 답 없이 만든 요청은 실리 것과 달라요)
    if (naAjaxPending.length) throw new NaAjaxWait();
    if (!send) { naFetchFailures.push({ url: u, status: 0 }); throw new Error('실리 서버에 연결할 수 없습니다.'); }
    const r = await send(u, init);
    if (!r.ok) naFetchFailures.push({ url: u, status: r.status });
    return r;
}

// 실리 tokenizers.js의 jQuery.ajax({ async: false, type, url, data, dataType: 'json', contentType, success }) 자리.
// 실리 브라우저는 그 자리에서 실리 서버에 동기 요청(XHR)을 보내고, 성공하면 success(답)를 그 자리에서 불러요(실패면 부르지 않아요).
// Node에는 동기 요청이 없어요: 처음에는 필요한 요청을 naAjaxPending에 적기만 하고(success를 부르지 않음), 그 뒤 naFetch는 NaAjaxWait로 멈춰요.
// 일꾼(plugin/st/naload.js naSendRequest)이 naAjaxFill()로 다리를 거쳐 실리 서버의 답을 받아 두고 같은 일을 다시 하면, 이번에는 받아 둔 답으로
// success를 그 자리에서 불러요. 실리 서버가 같은 요청에 주는 같은 답이라 결과가 실리 브라우저와 같아요.
export class NaAjaxWait extends Error {
    constructor() { super('실리 서버의 토큰 답을 기다립니다.'); this.name = 'NaAjaxWait'; }
}
const ajaxAnswers = new Map();
export const naAjaxPending = [];
const ajaxKey = (o) => JSON.stringify([String(o.type ?? 'GET'), String(o.url), o.data ?? null]);
export function naAjax(o) {
    const key = ajaxKey(o);
    if (ajaxAnswers.has(key)) {
        const a = ajaxAnswers.get(key);
        if (a.ok) o.success?.(a.data);
        return;
    }
    if (!naAjaxPending.some(p => p.key === key)) naAjaxPending.push({ key, type: String(o.type ?? 'GET'), url: String(o.url), data: o.data ?? null, contentType: o.contentType });
}
export async function naAjaxFill() {
    const todo = naAjaxPending.splice(0);
    for (const p of todo) {
        let ok = false, data = null;
        try {
            const r = await naFetch(p.url, { method: p.type, headers: { 'Content-Type': p.contentType || 'application/json' }, body: p.data });
            // (jQuery dataType 'json': 2xx이고 JSON으로 읽혀야 success)
            if (r.ok) { data = JSON.parse(await r.text()); ok = true; }
        } catch { ok = false; }
        ajaxAnswers.set(p.key, { ok, data });
    }
}
`);

write('lib.js', `// 실리 1.19.1 public/lib.js 자리 ${why}
// 바꾼 것: 실리 것은 webpack 묶음이라 옮기지 않음. 매크로가 쓰는 라이브러리를 실리 public/lib.js와 같은 이름으로 내보냄.
// 실리 서버 폴더(process.cwd())의 node_modules에서 먼저, 없으면 확장의 node_modules(테스트용 devDependencies)에서 불러와요.
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function load(name) {
    try {
        const require = createRequire(path.join(process.cwd(), 'package.json'));
        return await import(pathToFileURL(require.resolve(name)).href);
    } catch {
        return await import(name);
    }
}

// 실리 public/lib.js 5~25줄과 같은 꼴: 기본 내보내기(import x from) 또는 이름공간(import * as x from)
const lodash = (await load('lodash')).default;
const Handlebars = (await load('handlebars')).default;
const moment = (await load('moment')).default;
const seedrandom = (await load('seedrandom')).default;
const droll = (await load('droll')).default;
const chevrotain = await load('chevrotain');

export default {
    lodash,
    Handlebars,
    moment,
    seedrandom,
    droll,
    chevrotain,
};

export {
    lodash,
    Handlebars,
    moment,
    seedrandom,
    droll,
    chevrotain,
};
`);

console.log('ok');
