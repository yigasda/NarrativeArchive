// 실리 1.19.1 public/scripts/openai.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움), 대역(DOMPurify · toastr · renderTemplateAsync · updateFeatureSupportFlags · saveModelList(값 부분은 plugin/st/nastatus.js) · calculateOpenRouterCost · calculateElectronHubCost · calculateChutesCost · $(범위 칸 넷)).
import { name1, name2, substituteParams, getCurrentChatId, getRequestHeaders, abortStatusCheck, setOnlineStatus, resultCheckStatus, saveSettingsDebounced } from '../script.js';
import { SECRET_KEYS, secret_state } from './secrets.js';
import { getGroupNames, selected_group } from './group-chats.js';
import { chatCompletionDefaultPrompts, promptManagerDefaultPromptOrders } from './PromptManager.js';
import { getCustomStoppingStrings, power_user } from './power-user.js';
import { getTokenizerModel } from './tokenizers.js';
import { Popup } from './popup.js';
import { t } from './i18n.js';
import { ToolManager } from './tool-calling.js';
import { accountStorage } from './util/AccountStorage.js';
import { getStringHash, clamp, isValidUrl } from './utils.js';
import { naFetch as fetch } from '../naFetch.js';

// 대역: 브라우저 화면 것들 (validateReverseProxy · getStatusOpen이 불러요). 서버에는 화면이 없어요
const DOMPurify = { sanitize: x => x };
const toastr = { error: (...a) => console.warn('[narrative-archive plugin]', ...a) };
const renderTemplateAsync = async () => '';
// 대역: 실리 updateFeatureSupportFlags(6741~6755)는 화면의 data-cc-toggle 표시만 바꿔요. 서버에서는 아무것도 안 해요.
const updateFeatureSupportFlags = () => {};
// 대역: 실리 saveModelList(2025~2407)는 받은 모델 목록으로 화면의 모델 고르기 칸을 채우고, 그 칸의 change가 onModelChange(5472~)를 불러요.
// 값을 정하는 부분(목록 · 거르기 · 정렬 · 모델 보정)은 plugin/st/nastatus.js saveModelListValues예요(실리 줄 번호를 적어 따라 했어요).
// nastatus.js를 부르면 __naSet({ saveModelList })로 끼워요.
let saveModelList = () => { throw new Error('saveModelList: plugin/st/nastatus.js를 불러오지 않았습니다.'); };
// 실리 index.html 3068~3162 #model_openai_select · 3313~3362 #model_google_select의 <option value> (화면에 박혀 있는 고정 목록:
// saveModelList 2063 · 2239~2241이 이 칸의 옵션을 읽어요). tools/st/gen.mjs가 그 줄에서 뽑아요.
export const __naOpenAISelectOptions = ["gpt-6-astra","gpt-5.6","gpt-5.6-sol","gpt-5.6-terra","gpt-5.6-luna","gpt-5.5","gpt-5.5-2026-04-23","gpt-5.4","gpt-5.4-2026-03-05","gpt-5.4-mini","gpt-5.4-mini-2026-03-17","gpt-5.4-nano","gpt-5.4-nano-2026-03-17","gpt-5.3-chat-latest","gpt-5.2","gpt-5.2-2025-12-11","gpt-5.2-chat-latest","gpt-5.1","gpt-5.1-2025-11-13","gpt-5.1-chat-latest","gpt-5","gpt-5-2025-08-07","gpt-5-chat-latest","gpt-5-mini","gpt-5-mini-2025-08-07","gpt-5-nano","gpt-5-nano-2025-08-07","gpt-4.1","gpt-4.1-2025-04-14","gpt-4.1-mini","gpt-4.1-mini-2025-04-14","gpt-4.1-nano","gpt-4.1-nano-2025-04-14","o4-mini","o4-mini-2025-04-16","o3","o3-2025-04-16","o3-mini","o3-mini-2025-01-31","o1","o1-2024-12-17","gpt-4o","gpt-4o-2024-11-20","gpt-4o-2024-08-06","gpt-4o-2024-05-13","gpt-4o-mini","gpt-4o-mini-2024-07-18","gpt-4-turbo","gpt-4-turbo-2024-04-09","gpt-4","gpt-4-0613","gpt-3.5-turbo","gpt-3.5-turbo-0125","gpt-3.5-turbo-1106","gpt-3.5-turbo-instruct","babbage-002","davinci-002"];
export const __naGoogleSelectOptions = ["gemini-3.7-flash","gemini-3.6-flash","gemini-3.5-flash","gemini-3.5-flash-lite","gemini-3.1-pro-preview","gemini-3.1-flash-lite","gemini-3.1-flash-image","gemini-3-pro-image","gemini-3-flash-preview","gemini-2.5-pro","gemini-2.5-flash","gemini-2.5-flash-lite","gemini-2.5-flash-image","gemini-2.0-flash-001","gemini-2.0-flash","gemini-2.0-flash-lite-001","gemini-2.0-flash-lite","gemma-4-31b-it","gemma-4-26b-a4b-it","gemma-3n-e4b-it","gemma-3n-e2b-it","gemma-3-27b-it","gemma-3-12b-it","gemma-3-4b-it","gemma-3-1b-it","learnlm-2.0-flash-experimental","gemini-robotics-er-1.5-preview"];
// 실리 index.html 2922~2954 #chat_completion_source의 <option value> (주석 안의 것은 옵션이 아니에요). loadOpenAISettings 4404 → 6967~6969가
// 이 칸에서 고른 것을 다시 읽어요: plugin/st/naload.js
export const __naChatCompletionSourceOptions = ["openai","custom","ai21","aimlapi","azure_openai","chutes","claude","workers_ai","cohere","deepseek","electronhub","fireworks","groq","makersuite","vertexai","mistralai","minimax","moonshot","nanogpt","openrouter","perplexity","pollinations","siliconflow","xai","zai"];

// 대역: 실리 calculateOpenRouterCost(1803~) · calculateElectronHubCost(1861~) · calculateChutesCost(1922~)는 화면의 가격 글만 바꿔요. 서버에서는 아무것도 안 해요.
const calculateOpenRouterCost = () => {};
const calculateElectronHubCost = () => {};
const calculateChutesCost = () => {};
// 대역: jQuery $. 옮긴 onModelChange 뒷부분(5695~6011)과 그 슬라이더의 input 처리기(6776~6792 · 6824~6831)가 만지는 칸만 있어요:
// index.html 640 #openai_max_context · 706 #temp_openai · 719 #freq_pen_openai · 732 #pres_pen_openai (<input type="range">, 그 줄의 min · max · step).
// 브라우저는 범위 칸에 넣은 값을 그 칸의 min · max · step으로 고쳐요(HTML 범위 입력의 값 고치기: 숫자가 아니면 가운데 값, min~max 안으로,
// min에서 step 단위로 가장 가까운 값 — 반이면 큰 쪽, 그게 max를 넘으면 한 step 아래). 크롬처럼 10진수 그대로 셈해요(0.705 → 0.71).
// 다른 칸(글 칸 · #openai_reverse_proxy의 placeholder)은 아무것도 안 해요.
const __naRangeAttrs = { openai_max_context: { min: '512', max: '4095', step: '1' }, temp_openai: { min: '0', max: '2.0', step: '0.01' }, freq_pen_openai: { min: '-2', max: '2', step: '0.01' }, pres_pen_openai: { min: '-2', max: '2', step: '0.01' } };
// 10진수: { n: BigInt, s: 소수 자리 } (값 = n / 10^s). HTML의 "올바른 부동소수점 수"가 아니면 null
const __naDec = (text) => {
    const m = /^(-?)(\d*)(?:\.(\d+))?(?:[eE]([-+]?\d+))?$/.exec(String(text));
    if (!m || (m[2] === '' && m[3] === undefined)) return null;
    const frac = m[3] ?? '', e = Number(m[4] ?? 0);
    let n = BigInt((m[2] || '0') + frac) * (m[1] ? -1n : 1n), s = frac.length - e;
    if (s < 0) { n *= 10n ** BigInt(-s); s = 0; }
    return { n, s };
};
const __naAt = (d, s) => d.n * 10n ** BigInt(s - d.s);
const __naDecText = (n, s) => {
    const neg = n < 0n, digits = (neg ? -n : n).toString().padStart(s + 1, '0');
    const text = s ? `${digits.slice(0, -s)}.${digits.slice(-s)}` : digits;
    return (neg ? '-' : '') + text;
};
// (Chrome RangeInputType::SanitizeValue → StepRange::ClampValue · RoundByStep, Decimal::Round: 반이면 0에서 먼 쪽)
function __naRangeClean(attrs, raw) {
    const min = __naDec(attrs.min) ?? { n: 0n, s: 0 };
    const max = __naDec(attrs.max) ?? { n: 100n, s: 0 };
    const step = __naDec(attrs.step), got = __naDec(raw);
    const S = Math.max(min.s, max.s, step?.s ?? 0, got?.s ?? 0) + 1;
    const lo = __naAt(min, S);
    let hi = __naAt(max, S), st = step ? __naAt(step, S) : 0n;
    if (hi < lo) hi = lo;
    if (!(st > 0n)) st = 10n ** BigInt(S);
    const v = got ? __naAt(got, S) : lo + (hi - lo) / 2n;
    const inRange = v < lo ? lo : v > hi ? hi : v;
    const q = inRange - lo;
    let r = lo + ((2n * q + st) / (2n * st)) * st;
    if (r > hi) r -= st; else if (r < lo) r += st;
    if (r < lo || r > hi) r = inRange;
    return __naDecText(r, S);
}
class __NaRange {
    constructor(attrs) { this.attrs = { ...attrs }; this.handlers = {}; this.value = __naRangeClean(this.attrs, ''); }
}
let __naRanges = new Map();
const __naQuiet = { attr() { return __naQuiet; }, prop() { return __naQuiet; }, val() { return __naQuiet; }, trigger() { return __naQuiet; }, on() { return __naQuiet; } };
const $ = (x) => {
    const el = x instanceof __NaRange ? x : __naRanges.get(String(x).replace(/^#/, ''));
    if (!el) return __naQuiet;
    const self = {
        attr(name, v) { if (v === undefined) return el.attrs[name]; el.attrs[name] = String(v); el.value = __naRangeClean(el.attrs, el.value); return self; },
        prop(name, v) { return self.attr(name, v); },
        val(v) { if (v === undefined) return el.value; el.value = __naRangeClean(el.attrs, v == null ? '' : String(v)); return self; },
        trigger(type) { for (const fn of el.handlers[type] || []) fn.call(el); return self; },
        on(type, fn) { (el.handlers[type] ||= []).push(fn); return self; },
    };
    return self;
};

// 실리 public/scripts/openai.js 102~124
const default_main_prompt = 'Write {{char}}\'s next reply in a fictional chat between {{charIfNotGroup}} and {{user}}.';
const default_nsfw_prompt = '';
const default_jailbreak_prompt = '';
const default_impersonation_prompt = '[Write your next reply from the point of view of {{user}}, using the chat history so far as a guideline for the writing style of {{user}}. Don\'t write as {{char}} or system. Don\'t describe actions of {{char}}.]';
const default_enhance_definitions_prompt = 'If you have more knowledge of {{char}}, add to the character\'s lore and personality to enhance them but keep the Character Sheet\'s definitions absolute.';
const default_wi_format = '{0}';
const default_new_chat_prompt = '[Start a new Chat]';
const default_new_group_chat_prompt = '[Start a new group chat. Group members: {{group}}]';
const default_new_example_chat_prompt = '[Example Chat]';
const default_continue_nudge_prompt = '[Continue your last message without repeating its original content.]';
const default_bias = 'Default (none)';
const default_personality_format = '{{personality}}';
const default_scenario_format = '{{scenario}}';
const default_group_nudge_prompt = '[Write the next reply only as {{char}}.]';
const default_bias_presets = {
    [default_bias]: [],
    'Anti-bond': [
        { id: '22154f79-dd98-41bc-8e34-87015d6a0eaf', text: ' bond', value: -50 },
        { id: '8ad2d5c4-d8ef-49e4-bc5e-13e7f4690e0f', text: ' future', value: -50 },
        { id: '52a4b280-0956-4940-ac52-4111f83e4046', text: ' bonding', value: -50 },
        { id: 'e63037c7-c9d1-4724-ab2d-7756008b433b', text: ' connection', value: -25 },
    ],
};

// 실리 public/scripts/openai.js 126~144
const max_2k = 2047;
const max_4k = 4095;
const max_8k = 8191;
const max_16k = 16383;
const max_32k = 32767;
const max_64k = 65535;
const max_128k = 128 * 1000;
const max_200k = 200 * 1000;
const max_256k = 256 * 1000;
const max_400k = 400 * 1000;
const max_1mil = 1000 * 1000;
const max_1050k = 1050 * 1000;
const max_2mil = 2000 * 1000;
const unlocked_max = max_2mil;
const oai_max_temp = 2.0;
const claude_max_temp = 1.0;
const mistral_max_temp = 1.5;
const openrouter_website_model = 'OR_Website';
const openai_max_stop_strings = 4;

// 실리 public/scripts/openai.js 174~175
let biasCache = undefined;
export let model_list = [];

// 실리 public/scripts/openai.js 177~204
export const chat_completion_sources = {
    OPENAI: 'openai',
    CLAUDE: 'claude',
    OPENROUTER: 'openrouter',
    AI21: 'ai21',
    MAKERSUITE: 'makersuite',
    VERTEXAI: 'vertexai',
    MISTRALAI: 'mistralai',
    CUSTOM: 'custom',
    COHERE: 'cohere',
    PERPLEXITY: 'perplexity',
    GROQ: 'groq',
    ELECTRONHUB: 'electronhub',
    CHUTES: 'chutes',
    NANOGPT: 'nanogpt',
    DEEPSEEK: 'deepseek',
    AIMLAPI: 'aimlapi',
    XAI: 'xai',
    POLLINATIONS: 'pollinations',
    MOONSHOT: 'moonshot',
    FIREWORKS: 'fireworks',
    COMETAPI: 'cometapi',
    AZURE_OPENAI: 'azure_openai',
    ZAI: 'zai',
    SILICONFLOW: 'siliconflow',
    WORKERS_AI: 'workers_ai',
    MINIMAX: 'minimax',
};

// 실리 public/scripts/openai.js 206~218
const character_names_behavior = {
    NONE: -1,
    DEFAULT: 0,
    COMPLETION: 1,
    CONTENT: 2,
};

const continue_postfix_types = {
    NONE: '',
    SPACE: ' ',
    NEWLINE: '\n',
    DOUBLE_NEWLINE: '\n\n',
};

// 실리 public/scripts/openai.js 220~237
export const custom_prompt_post_processing_types = {
    NONE: '',
    /** @deprecated Use MERGE instead. */
    CLAUDE: 'claude',
    MERGE: 'merge',
    MERGE_TOOLS: 'merge_tools',
    SEMI: 'semi',
    SEMI_TOOLS: 'semi_tools',
    STRICT: 'strict',
    STRICT_TOOLS: 'strict_tools',
    SINGLE: 'single',
};

const openrouter_middleout_types = {
    AUTO: 'auto',
    ON: 'on',
    OFF: 'off',
};

// 실리 public/scripts/openai.js 239~253
export const reasoning_effort_types = {
    auto: 'auto',
    low: 'low',
    medium: 'medium',
    high: 'high',
    min: 'min',
    max: 'max',
};

export const verbosity_levels = {
    auto: 'auto',
    low: 'low',
    medium: 'medium',
    high: 'high',
};

// 실리 public/scripts/openai.js 255~259
export const tool_reasoning_modes = {
    DISABLED: 'disabled',
    SINCE_LAST_USER: 'since_last_user',
    ACTIVE_CHAIN: 'active_chain',
};

// 실리 public/scripts/openai.js 267~285
export const ZAI_ENDPOINT = {
    COMMON: 'common',
    CODING: 'coding',
};

export const POLLINATIONS_ENDPOINT = {
    AUTHENTICATED: 'authenticated',
    ANONYMOUS: 'anonymous',
};

export const SILICONFLOW_ENDPOINT = {
    GLOBAL: 'global',
    CN: 'cn',
};

export const MINIMAX_ENDPOINT = {
    GLOBAL: 'global',
    CN: 'cn',
};

// 실리 public/scripts/openai.js 305~409
export const settingsToUpdate = {
    chat_completion_source: ['#chat_completion_source', 'chat_completion_source', false, true],
    temperature: ['#temp_openai', 'temp_openai', false, false],
    frequency_penalty: ['#freq_pen_openai', 'freq_pen_openai', false, false],
    presence_penalty: ['#pres_pen_openai', 'pres_pen_openai', false, false],
    top_p: ['#top_p_openai', 'top_p_openai', false, false],
    top_k: ['#top_k_openai', 'top_k_openai', false, false],
    top_a: ['#top_a_openai', 'top_a_openai', false, false],
    min_p: ['#min_p_openai', 'min_p_openai', false, false],
    repetition_penalty: ['#repetition_penalty_openai', 'repetition_penalty_openai', false, false],
    max_context_unlocked: ['#oai_max_context_unlocked', 'max_context_unlocked', true, false],
    group_models: ['#cc_group_models', 'group_models', true, true],
    sort_models: ['#cc_sort_models', 'sort_models', false, true],
    openai_model: ['#model_openai_select', 'openai_model', false, true],
    claude_model: ['#model_claude_select', 'claude_model', false, true],
    openrouter_model: ['#model_openrouter_select', 'openrouter_model', false, true],
    openrouter_use_fallback: ['#openrouter_use_fallback', 'openrouter_use_fallback', true, true],
    openrouter_providers: ['#openrouter_providers_chat', 'openrouter_providers', false, true],
    openrouter_quantizations: ['#openrouter_quantizations_chat', 'openrouter_quantizations', false, true],
    openrouter_allow_fallbacks: ['#openrouter_allow_fallbacks', 'openrouter_allow_fallbacks', true, true],
    openrouter_middleout: ['#openrouter_middleout', 'openrouter_middleout', false, true],
    tool_reasoning_mode: ['#tool_reasoning_mode', 'tool_reasoning_mode', false, false],
    ai21_model: ['#model_ai21_select', 'ai21_model', false, true],
    mistralai_model: ['#model_mistralai_select', 'mistralai_model', false, true],
    cohere_model: ['#model_cohere_select', 'cohere_model', false, true],
    perplexity_model: ['#model_perplexity_select', 'perplexity_model', false, true],
    groq_model: ['#model_groq_select', 'groq_model', false, true],
    chutes_model: ['#model_chutes_select', 'chutes_model', false, true],
    siliconflow_model: ['#model_siliconflow_select', 'siliconflow_model', false, true],
    siliconflow_endpoint: ['#siliconflow_endpoint', 'siliconflow_endpoint', false, true],
    minimax_model: ['#model_minimax_select', 'minimax_model', false, true],
    minimax_endpoint: ['#minimax_endpoint', 'minimax_endpoint', false, true],
    electronhub_model: ['#model_electronhub_select', 'electronhub_model', false, true],
    nanogpt_model: ['#model_nanogpt_select', 'nanogpt_model', false, true],
    nanogpt_provider: ['#nanogpt_provider', 'nanogpt_provider', false, true],
    nanogpt_payg_override: ['#nanogpt_payg_override', 'nanogpt_payg_override', true, true],
    deepseek_model: ['#model_deepseek_select', 'deepseek_model', false, true],
    aimlapi_model: ['#model_aimlapi_select', 'aimlapi_model', false, true],
    xai_model: ['#model_xai_select', 'xai_model', false, true],
    pollinations_model: ['#model_pollinations_select', 'pollinations_model', false, true],
    pollinations_endpoint: ['#pollinations_endpoint', 'pollinations_endpoint', false, true],
    moonshot_model: ['#model_moonshot_select', 'moonshot_model', false, true],
    fireworks_model: ['#model_fireworks_select', 'fireworks_model', false, true],
    cometapi_model: ['#model_cometapi_select', 'cometapi_model', false, true],
    custom_model: ['#custom_model_id', 'custom_model', false, true],
    custom_url: ['#custom_api_url_text', 'custom_url', false, true],
    custom_include_body: ['#custom_include_body', 'custom_include_body', false, true],
    custom_exclude_body: ['#custom_exclude_body', 'custom_exclude_body', false, true],
    custom_include_headers: ['#custom_include_headers', 'custom_include_headers', false, true],
    custom_prompt_post_processing: ['#custom_prompt_post_processing', 'custom_prompt_post_processing', false, true],
    google_model: ['#model_google_select', 'google_model', false, true],
    vertexai_model: ['#model_vertexai_select', 'vertexai_model', false, true],
    zai_model: ['#model_zai_select', 'zai_model', false, true],
    zai_endpoint: ['#zai_endpoint', 'zai_endpoint', false, true],
    workers_ai_model: ['#model_workers_ai_select', 'workers_ai_model', false, true],
    workers_ai_account_id: ['#workers_ai_account_id', 'workers_ai_account_id', false, true],
    openai_max_context: ['#openai_max_context', 'openai_max_context', false, false],
    openai_max_tokens: ['#openai_max_tokens', 'openai_max_tokens', false, false],
    names_behavior: ['#names_behavior', 'names_behavior', false, false],
    send_if_empty: ['#send_if_empty_textarea', 'send_if_empty', false, false],
    impersonation_prompt: ['#impersonation_prompt_textarea', 'impersonation_prompt', false, false],
    new_chat_prompt: ['#newchat_prompt_textarea', 'new_chat_prompt', false, false],
    new_group_chat_prompt: ['#newgroupchat_prompt_textarea', 'new_group_chat_prompt', false, false],
    new_example_chat_prompt: ['#newexamplechat_prompt_textarea', 'new_example_chat_prompt', false, false],
    continue_nudge_prompt: ['#continue_nudge_prompt_textarea', 'continue_nudge_prompt', false, false],
    bias_preset_selected: ['#openai_logit_bias_preset', 'bias_preset_selected', false, false],
    reverse_proxy: ['#openai_reverse_proxy', 'reverse_proxy', false, true],
    wi_format: ['#wi_format_textarea', 'wi_format', false, false],
    scenario_format: ['#scenario_format_textarea', 'scenario_format', false, false],
    personality_format: ['#personality_format_textarea', 'personality_format', false, false],
    group_nudge_prompt: ['#group_nudge_prompt_textarea', 'group_nudge_prompt', false, false],
    stream_openai: ['#stream_toggle', 'stream_openai', true, false],
    prompts: ['', 'prompts', false, false],
    prompt_order: ['', 'prompt_order', false, false],
    show_external_models: ['#openai_show_external_models', 'show_external_models', true, true],
    proxy_password: ['#openai_proxy_access_key', 'proxy_password', false, true],
    assistant_prefill: ['#claude_assistant_prefill', 'assistant_prefill', false, false],
    assistant_impersonation: ['#claude_assistant_impersonation', 'assistant_impersonation', false, false],
    use_sysprompt: ['#use_sysprompt', 'use_sysprompt', true, false],
    vertexai_auth_mode: ['#vertexai_auth_mode', 'vertexai_auth_mode', false, true],
    vertexai_region: ['#vertexai_region', 'vertexai_region', false, true],
    vertexai_express_project_id: ['#vertexai_express_project_id', 'vertexai_express_project_id', false, true],
    squash_system_messages: ['#squash_system_messages', 'squash_system_messages', true, false],
    media_inlining: ['#openai_media_inlining', 'media_inlining', true, false],
    inline_image_quality: ['#openai_inline_image_quality', 'inline_image_quality', false, false],
    continue_prefill: ['#continue_prefill', 'continue_prefill', true, false],
    continue_postfix: ['#continue_postfix', 'continue_postfix', false, false],
    function_calling: ['#openai_function_calling', 'function_calling', true, false],
    tool_call_recurse_limit: ['#tool_call_recurse_limit', 'tool_call_recurse_limit', false, false],
    show_thoughts: ['#openai_show_thoughts', 'show_thoughts', true, false],
    reasoning_effort: ['#openai_reasoning_effort', 'reasoning_effort', false, false],
    verbosity: ['#openai_verbosity', 'verbosity', false, false],
    enable_web_search: ['#openai_enable_web_search', 'enable_web_search', true, false],
    seed: ['#seed_openai', 'seed', false, false],
    n: ['#n_openai', 'n', false, false],
    bypass_status_check: ['#openai_bypass_status_check', 'bypass_status_check', true, true],
    request_images: ['#openai_request_images', 'request_images', true, false],
    request_image_aspect_ratio: ['#request_image_aspect_ratio', 'request_image_aspect_ratio', false, false],
    request_image_resolution: ['#request_image_resolution', 'request_image_resolution', false, false],
    azure_base_url: ['#azure_base_url', 'azure_base_url', false, true],
    azure_deployment_name: ['#azure_deployment_name', 'azure_deployment_name', false, true],
    azure_api_version: ['#azure_api_version', 'azure_api_version', false, true],
    azure_openai_model: ['#azure_openai_model', 'azure_openai_model', false, true],
    extensions: ['#NULL_SELECTOR', 'extensions', false, false],
};

// 실리 public/scripts/openai.js 411~518
const default_settings = {
    preset_settings_openai: 'Default',
    temp_openai: 1.0,
    freq_pen_openai: 0,
    pres_pen_openai: 0,
    top_p_openai: 1.0,
    top_k_openai: 0,
    min_p_openai: 0,
    top_a_openai: 0,
    repetition_penalty_openai: 1,
    stream_openai: false,
    openai_max_context: max_4k,
    openai_max_tokens: 300,
    ...chatCompletionDefaultPrompts,
    ...promptManagerDefaultPromptOrders,
    send_if_empty: '',
    impersonation_prompt: default_impersonation_prompt,
    new_chat_prompt: default_new_chat_prompt,
    new_group_chat_prompt: default_new_group_chat_prompt,
    new_example_chat_prompt: default_new_example_chat_prompt,
    continue_nudge_prompt: default_continue_nudge_prompt,
    bias_preset_selected: default_bias,
    bias_presets: default_bias_presets,
    wi_format: default_wi_format,
    group_nudge_prompt: default_group_nudge_prompt,
    scenario_format: default_scenario_format,
    personality_format: default_personality_format,
    sort_models: 'alphabetically',
    group_models: false,
    openai_model: 'gpt-5.6-terra',
    claude_model: 'claude-sonnet-5',
    google_model: 'gemini-3.7-flash',
    vertexai_model: 'gemini-3.7-flash',
    ai21_model: 'jamba-large',
    mistralai_model: 'mistral-large-latest',
    cohere_model: 'command-r-plus',
    perplexity_model: 'sonar-pro',
    groq_model: 'llama-3.3-70b-versatile',
    chutes_model: 'deepseek-ai/DeepSeek-V3-0324',
    siliconflow_model: 'deepseek-ai/DeepSeek-V3',
    siliconflow_endpoint: SILICONFLOW_ENDPOINT.GLOBAL,
    minimax_model: 'MiniMax-M2.7',
    minimax_endpoint: MINIMAX_ENDPOINT.GLOBAL,
    electronhub_model: 'gpt-4o-mini',
    nanogpt_model: 'gpt-4o-mini',
    nanogpt_provider: '',
    nanogpt_payg_override: false,
    deepseek_model: 'deepseek-v4-flash',
    aimlapi_model: 'chatgpt-4o-latest',
    xai_model: 'grok-3-beta',
    pollinations_model: 'openai',
    pollinations_endpoint: POLLINATIONS_ENDPOINT.AUTHENTICATED,
    cometapi_model: 'gpt-4o',
    moonshot_model: 'kimi-latest',
    fireworks_model: 'accounts/fireworks/models/kimi-k2-instruct',
    zai_model: 'glm-4.6',
    zai_endpoint: ZAI_ENDPOINT.COMMON,
    workers_ai_model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    workers_ai_account_id: '',
    azure_base_url: '',
    azure_deployment_name: '',
    azure_api_version: '2024-02-15-preview',
    azure_openai_model: '',
    custom_model: '',
    custom_url: '',
    custom_include_body: '',
    custom_exclude_body: '',
    custom_include_headers: '',
    openrouter_model: openrouter_website_model,
    openrouter_use_fallback: false,
    openrouter_providers: [],
    openrouter_quantizations: [],
    openrouter_allow_fallbacks: true,
    openrouter_middleout: openrouter_middleout_types.ON,
    tool_reasoning_mode: tool_reasoning_modes.DISABLED,
    reverse_proxy: '',
    chat_completion_source: chat_completion_sources.OPENAI,
    max_context_unlocked: false,
    show_external_models: false,
    proxy_password: '',
    assistant_prefill: '',
    assistant_impersonation: '',
    use_sysprompt: false,
    vertexai_auth_mode: 'express',
    vertexai_region: 'us-central1',
    vertexai_express_project_id: '',
    squash_system_messages: false,
    media_inlining: true,
    inline_image_quality: 'auto',
    bypass_status_check: false,
    continue_prefill: false,
    function_calling: false,
    tool_call_recurse_limit: 5,
    names_behavior: character_names_behavior.DEFAULT,
    continue_postfix: continue_postfix_types.SPACE,
    custom_prompt_post_processing: custom_prompt_post_processing_types.NONE,
    show_thoughts: true,
    reasoning_effort: reasoning_effort_types.auto,
    verbosity: verbosity_levels.auto,
    enable_web_search: false,
    request_images: false,
    request_image_aspect_ratio: '',
    request_image_resolution: '',
    seed: -1,
    n: 1,
    bind_preset_to_connection: true,
    extensions: {},
};

// 실리 public/scripts/openai.js 520~520
const oai_settings = structuredClone(default_settings);

// 실리 public/scripts/openai.js 522~529
export let proxies = [
    {
        name: 'None',
        url: '',
        password: '',
    },
];
export let selected_proxy = proxies[0];

// 실리 public/scripts/openai.js 531~532
export let openai_setting_names;
export let openai_settings;

// 실리 public/scripts/openai.js 537~563
async function validateReverseProxy() {
    if (!oai_settings.reverse_proxy) {
        return;
    }

    try {
        new URL(oai_settings.reverse_proxy);
    } catch (err) {
        toastr.error(t`Entered reverse proxy address is not a valid URL`);
        setOnlineStatus('no_connection');
        resultCheckStatus();
        throw err;
    }
    const rememberKey = `Proxy_SkipConfirm_${getStringHash(oai_settings.reverse_proxy)}`;
    const skipConfirm = accountStorage.getItem(rememberKey) === 'true';

    const confirmation = skipConfirm || await Popup.show.confirm(t`Connecting To Proxy`, await renderTemplateAsync('proxyConnectionWarning', { proxyURL: DOMPurify.sanitize(oai_settings.reverse_proxy) }));

    if (!confirmation) {
        toastr.error(t`Update or remove your reverse proxy settings.`);
        setOnlineStatus('no_connection');
        resultCheckStatus();
        throw new Error('Proxy connection denied.');
    }

    accountStorage.setItem(rememberKey, String(true));
}

// 실리 public/scripts/openai.js 723~787
/**
 * Parses the example messages into individual messages.
 * @param {string} messageExampleString - The string containing the example messages
 * @param {boolean} appendNamesForGroup - Whether to append the character name for group chats
 * @returns {Message[]} Array of message objects
 */
export function parseExampleIntoIndividual(messageExampleString, appendNamesForGroup = true) {
    const groupBotNames = getGroupNames().map(name => `${name}:`);

    let result = []; // array of msgs
    let tmp = messageExampleString.split('\n');
    let cur_msg_lines = [];
    let in_user = false;
    let in_bot = false;
    let botName = name2;

    // DRY my cock and balls :)
    function add_msg(name, role, system_name) {
        // join different newlines (we split them by \n and join by \n)
        // remove char name
        // strip to remove extra spaces
        let parsed_msg = cur_msg_lines.join('\n').replace(name + ':', '').trim();

        if (appendNamesForGroup && selected_group && ['example_user', 'example_assistant'].includes(system_name)) {
            parsed_msg = `${name}: ${parsed_msg}`;
        }

        result.push({ 'role': role, 'content': parsed_msg, 'name': system_name });
        cur_msg_lines = [];
    }
    // skip first line as it'll always be "This is how {bot name} should talk"
    for (let i = 1; i < tmp.length; i++) {
        let cur_str = tmp[i];
        // if it's the user message, switch into user mode and out of bot mode
        // yes, repeated code, but I don't care
        if (cur_str.startsWith(name1 + ':')) {
            in_user = true;
            // we were in the bot mode previously, add the message
            if (in_bot) {
                add_msg(botName, 'system', 'example_assistant');
            }
            in_bot = false;
        } else if (cur_str.startsWith(name2 + ':') || groupBotNames.some(n => cur_str.startsWith(n))) {
            if (!cur_str.startsWith(name2 + ':') && groupBotNames.length) {
                botName = cur_str.split(':')[0];
            }

            in_bot = true;
            // we were in the user mode previously, add the message
            if (in_user) {
                add_msg(name1, 'system', 'example_user');
            }
            in_user = false;
        }
        // push the current line into the current message array only after checking for presence of user/bot
        cur_msg_lines.push(cur_str);
    }
    // Special case for last message in a block because we don't have a new message to trigger the switch
    if (in_user) {
        add_msg(name1, 'system', 'example_user');
    } else if (in_bot) {
        add_msg(botName, 'system', 'example_assistant');
    }
    return result;
}

// 실리 public/scripts/openai.js 1717~1782
/**
 * Gets the API model for the selected chat completion source.
 * @param {ChatCompletionSettings} settings Chat completion settings
 * @returns {string} API model
 */
export function getChatCompletionModel(settings = null) {
    settings = settings ?? oai_settings;
    const source = settings.chat_completion_source;
    switch (source) {
        case chat_completion_sources.CLAUDE:
            return settings.claude_model;
        case chat_completion_sources.OPENAI:
            return settings.openai_model;
        case chat_completion_sources.MAKERSUITE:
            return settings.google_model;
        case chat_completion_sources.VERTEXAI:
            return settings.vertexai_model;
        case chat_completion_sources.OPENROUTER:
            return settings.openrouter_model !== openrouter_website_model ? settings.openrouter_model : null;
        case chat_completion_sources.AI21:
            return settings.ai21_model;
        case chat_completion_sources.MISTRALAI:
            return settings.mistralai_model;
        case chat_completion_sources.CUSTOM:
            return settings.custom_model;
        case chat_completion_sources.COHERE:
            return settings.cohere_model;
        case chat_completion_sources.PERPLEXITY:
            return settings.perplexity_model;
        case chat_completion_sources.GROQ:
            return settings.groq_model;
        case chat_completion_sources.SILICONFLOW:
            return settings.siliconflow_model;
        case chat_completion_sources.MINIMAX:
            return settings.minimax_model;
        case chat_completion_sources.ELECTRONHUB:
            return settings.electronhub_model;
        case chat_completion_sources.CHUTES:
            return settings.chutes_model;
        case chat_completion_sources.NANOGPT:
            return settings.nanogpt_model;
        case chat_completion_sources.DEEPSEEK:
            return settings.deepseek_model;
        case chat_completion_sources.AIMLAPI:
            return settings.aimlapi_model;
        case chat_completion_sources.XAI:
            return settings.xai_model;
        case chat_completion_sources.POLLINATIONS:
            return settings.pollinations_model;
        case chat_completion_sources.COMETAPI:
            return settings.cometapi_model;
        case chat_completion_sources.MOONSHOT:
            return settings.moonshot_model;
        case chat_completion_sources.FIREWORKS:
            return settings.fireworks_model;
        case chat_completion_sources.AZURE_OPENAI:
            return settings.azure_openai_model;
        case chat_completion_sources.ZAI:
            return settings.zai_model;
        case chat_completion_sources.WORKERS_AI:
            return settings.workers_ai_model;
        default:
            console.error(`Unknown chat completion source: ${source}`);
            return '';
    }
}

// 실리 public/scripts/openai.js 2409~2478
/**
 * Sorts models by the specified property for the given source.
 * @param {object[]} data - Array of model objects
 * @param {string} property - Sort property ('alphabetically', 'context_length', 'pricing.prompt', 'pricing.completion')
 * @param {string} source - Chat Completion source (e.g., 'openrouter', 'chutes', 'electronhub', 'nanogpt')
 * @returns {object[]} Sorted array of model objects
 */
function sortModelsBy(data, property, source) {
    switch (source) {
        case chat_completion_sources.OPENROUTER:
            return data.sort((a, b) => {
                if (property === 'context_length') {
                    return (b.context_length || 0) - (a.context_length || 0);
                } else if (property === 'pricing.input' || property === 'pricing.prompt') {
                    return parseFloat(a.pricing?.prompt || 0) - parseFloat(b.pricing?.prompt || 0);
                } else if (property === 'pricing.output' || property === 'pricing.completion') {
                    return parseFloat(a.pricing?.completion || 0) - parseFloat(b.pricing?.completion || 0);
                } else {
                    return a?.name && b?.name ? a.name.localeCompare(b.name) : 0;
                }
            });
        case chat_completion_sources.CHUTES:
            return data.sort((a, b) => {
                if (property === 'context_length') {
                    return (b.context_length || 0) - (a.context_length || 0);
                } else if (property === 'pricing.input' || property === 'pricing.prompt') {
                    return parseFloat(a.pricing?.input || 0) - parseFloat(b.pricing?.input || 0);
                } else if (property === 'pricing.output' || property === 'pricing.completion') {
                    return parseFloat(a.pricing?.output || 0) - parseFloat(b.pricing?.output || 0);
                } else {
                    return a?.id && b?.id ? a.id.localeCompare(b.id) : 0;
                }
            });
        case chat_completion_sources.ELECTRONHUB:
            return data.sort((a, b) => {
                if (property === 'context_length') {
                    return (b.tokens || 0) - (a.tokens || 0);
                } else if (property === 'pricing.input' || property === 'pricing.prompt') {
                    return parseFloat(a.pricing?.input || 0) - parseFloat(b.pricing?.input || 0);
                } else if (property === 'pricing.output' || property === 'pricing.completion') {
                    return parseFloat(a.pricing?.output || 0) - parseFloat(b.pricing?.output || 0);
                } else {
                    return a?.name && b?.name ? a.name.localeCompare(b.name) : 0;
                }
            });
        case chat_completion_sources.NANOGPT:
            return data.sort((a, b) => {
                if (property === 'context_length') {
                    return (b.context_length || 0) - (a.context_length || 0);
                } else if (property === 'pricing.input' || property === 'pricing.prompt') {
                    return parseFloat(a.pricing?.prompt || 0) - parseFloat(b.pricing?.prompt || 0);
                } else if (property === 'pricing.output' || property === 'pricing.completion') {
                    return parseFloat(a.pricing?.completion || 0) - parseFloat(b.pricing?.completion || 0);
                } else {
                    return a?.name && b?.name ? a.name.localeCompare(b.name) : 0;
                }
            });
        case chat_completion_sources.AIMLAPI:
            return data.sort((a, b) => {
                if (property === 'context_length') {
                    return (b.info?.contextLength || 0) - (a.info?.contextLength || 0);
                } else {
                    // No pricing information on the API. Sort alphabetically by name.
                    return a?.info?.name && b?.info?.name ? a.info.name.localeCompare(b.info.name) : 0;
                }
            });
        default:
            return data;
    }
}

// 실리 public/scripts/openai.js 2480~2537
/**
 * Groups models by vendor for the given source. If not supported, returns a map with a single entry containing all models.
 * @param {object[]} array Array of model objects
 * @param {string} source Chat Completion source (e.g., 'openrouter')
 * @returns {Map<string, object[]>} Map of vendor to array of models
 */
function groupModelsByVendor(array, source) {
    switch (source) {
        case chat_completion_sources.OPENROUTER:
            return array.reduce((acc, curr) => {
                const vendor = curr.id.split('/')[0];
                if (!acc.has(vendor)) {
                    acc.set(vendor, []);
                }
                acc.get(vendor).push(curr);
                return acc;
            }, new Map());
        case chat_completion_sources.ELECTRONHUB:
            return array.reduce((acc, curr) => {
                const vendor = String(curr?.name || curr?.id || 'Other').split(':')[0].trim() || 'Other';
                if (!acc.has(vendor)) {
                    acc.set(vendor, []);
                }
                acc.get(vendor).push(curr);
                return acc;
            }, new Map());
        case chat_completion_sources.NANOGPT:
            return array.reduce((acc, curr) => {
                const vendorPart = /\//.test(curr.id) ? curr.id.split('/')[0] : curr.id.split('-')[0];
                const vendor = String(vendorPart?.trim()?.toLowerCase() || 'Other');
                if (!acc.has(vendor)) {
                    acc.set(vendor, []);
                }
                acc.get(vendor).push(curr);
                return acc;
            }, new Map());
        case chat_completion_sources.CHUTES:
            return array.reduce((acc, curr) => {
                const vendor = curr.id.split('/')[0];
                if (!acc.has(vendor)) {
                    acc.set(vendor, []);
                }
                acc.get(vendor).push(curr);
                return acc;
            }, new Map());
        case chat_completion_sources.AIMLAPI:
            return array.reduce((acc, curr) => {
                const vendor = curr.info?.developer || 'Other';
                if (!acc.has(vendor)) {
                    acc.set(vendor, []);
                }
                acc.get(vendor).push(curr);
                return acc;
            }, new Map());
        default:
            return new Map([['', array]]);
    }
}

// 실리 public/scripts/openai.js 2545~2664
function getReasoningEffort(settings = null, model = null) {
    settings = settings ?? oai_settings;
    model = model ?? getChatCompletionModel(settings);

    // These sources expect the effort as string.
    const reasoningEffortSources = [
        chat_completion_sources.OPENAI,
        chat_completion_sources.AZURE_OPENAI,
        chat_completion_sources.CUSTOM,
        chat_completion_sources.XAI,
        chat_completion_sources.AIMLAPI,
        chat_completion_sources.OPENROUTER,
        chat_completion_sources.POLLINATIONS,
        chat_completion_sources.PERPLEXITY,
        chat_completion_sources.COMETAPI,
        chat_completion_sources.ELECTRONHUB,
        chat_completion_sources.CHUTES,
        chat_completion_sources.DEEPSEEK,
        chat_completion_sources.FIREWORKS,
    ];

    if (!reasoningEffortSources.includes(settings.chat_completion_source)) {
        return settings.reasoning_effort;
    }

    function resolveReasoningEffort() {
        if (settings.chat_completion_source === chat_completion_sources.DEEPSEEK) {
            switch (settings.reasoning_effort) {
                case reasoning_effort_types.auto:
                    return undefined;
                case reasoning_effort_types.min:
                case reasoning_effort_types.low:
                    return reasoning_effort_types.low;
                case reasoning_effort_types.max:
                    return reasoning_effort_types.max;
                default:
                    return reasoning_effort_types.high;
            }
        }

        if (settings.chat_completion_source === chat_completion_sources.FIREWORKS) {
            switch (settings.reasoning_effort) {
                case reasoning_effort_types.auto:
                    return undefined;
                case reasoning_effort_types.min:
                    return reasoning_effort_types.low;
                default:
                    return settings.reasoning_effort;
            }
        }

        if (settings.chat_completion_source === chat_completion_sources.CUSTOM && /^koboldcpp\/(.+)$/.test(model)) {
            switch (settings.reasoning_effort) {
                case reasoning_effort_types.auto:
                    return undefined;
                case reasoning_effort_types.min:
                    return 'minimal';
                case reasoning_effort_types.low:
                    return 'low';
                case reasoning_effort_types.medium:
                    return 'medium';
                case reasoning_effort_types.high:
                    return 'high';
                case reasoning_effort_types.max:
                    return 'xhigh';
                default:
                    return settings.reasoning_effort;
            }
        }

        switch (settings.reasoning_effort) {
            case reasoning_effort_types.auto:
                return undefined;
            case reasoning_effort_types.min:
                if (chat_completion_sources.OPENROUTER === settings.chat_completion_source && !settings.show_thoughts) {
                    return 'none';
                }

                if ([chat_completion_sources.OPENAI, chat_completion_sources.AZURE_OPENAI].includes(settings.chat_completion_source)) {
                    if (/^gpt-5\.(4|5|6)/.test(model)) {
                        return 'none';
                    }
                    if (/^gpt-5/.test(model)) {
                        return reasoning_effort_types.min;
                    }
                }

                return reasoning_effort_types.low;
            case reasoning_effort_types.max:
                if ([chat_completion_sources.OPENAI, chat_completion_sources.AZURE_OPENAI].includes(settings.chat_completion_source)
                    && /^gpt-6-astra/.test(model)) {
                    return reasoning_effort_types.max;
                }
                if ([chat_completion_sources.OPENAI, chat_completion_sources.AZURE_OPENAI].includes(settings.chat_completion_source)
                    && /^gpt-5\.6/.test(model)) {
                    // GPT-5.6 reserves "max" effort for the Responses API.
                    return 'xhigh';
                }
                return reasoning_effort_types.high;
            default:
                return settings.reasoning_effort;
        }
    }

    const reasoningEffort = resolveReasoningEffort();

    // Check if the resolved effort supported by the model
    if (settings.chat_completion_source === chat_completion_sources.ELECTRONHUB) {
        if (Array.isArray(model_list) && reasoningEffort) {
            const currentModel = model_list.find(m => m.id === model);
            const supportedEfforts = currentModel?.metadata?.supported_reasoning_efforts;
            if (Array.isArray(supportedEfforts) && supportedEfforts.includes(reasoningEffort)) {
                return reasoningEffort;
            }
            return undefined;
        }
    }

    return reasoningEffort;
}

// 실리 public/scripts/openai.js 2671~2680
function getVerbosity(settings = null) {
    settings = settings ?? oai_settings;

    if (settings.verbosity === verbosity_levels.auto) {
        return undefined;
    }

    // TODO: Adjust verbosity based on model capabilities
    return settings.verbosity;
}

// 실리 public/scripts/openai.js 2691~3127
export async function createGenerationParameters(settings, model, type, messages, { jsonSchema = null } = {}) {
    // HACK: Filter out null and non-object messages
    if (!Array.isArray(messages)) {
        throw new Error('messages must be an array');
    }
    messages = messages.filter(msg => msg && typeof msg === 'object');

    // DeepSeek only accepts image blocks in user messages. Media can also be
    // attached to system and assistant messages by the shared inlining path.
    const isDeepSeekVisionModel = typeof model === 'string' && model.toLowerCase().includes('deepseek-v4-flash-vision-exp');
    if (isDeepSeekVisionModel) {
        messages = messages.flatMap((message) => {
            if (!['system', 'assistant'].includes(message.role) || !Array.isArray(message.content)) {
                return [message];
            }

            const content = message.content.filter(block => block?.type !== 'image_url');
            return content.length > 0 ? [{ ...message, content }] : [];
        });
    }

    // "OpenAI-like" sources
    const gptSources = [
        chat_completion_sources.OPENAI,
        chat_completion_sources.AZURE_OPENAI,
        chat_completion_sources.OPENROUTER,
    ];

    // Sources that support the "seed" parameter
    const seedSupportedSources = [
        chat_completion_sources.OPENAI,
        chat_completion_sources.AZURE_OPENAI,
        chat_completion_sources.OPENROUTER,
        chat_completion_sources.MISTRALAI,
        chat_completion_sources.CUSTOM,
        chat_completion_sources.COHERE,
        chat_completion_sources.GROQ,
        chat_completion_sources.ELECTRONHUB,
        chat_completion_sources.NANOGPT,
        chat_completion_sources.XAI,
        chat_completion_sources.POLLINATIONS,
        chat_completion_sources.AIMLAPI,
        chat_completion_sources.VERTEXAI,
        chat_completion_sources.MAKERSUITE,
        chat_completion_sources.CHUTES,
    ];

    // Sources that support proxying
    const proxySupportedSources = [
        chat_completion_sources.CLAUDE,
        chat_completion_sources.OPENAI,
        chat_completion_sources.MISTRALAI,
        chat_completion_sources.MAKERSUITE,
        chat_completion_sources.VERTEXAI,
        chat_completion_sources.DEEPSEEK,
        chat_completion_sources.XAI,
        chat_completion_sources.ZAI,
        chat_completion_sources.MOONSHOT,
    ];

    // Sources that support logprobs
    const logprobsSupportedSources = [
        chat_completion_sources.OPENAI,
        chat_completion_sources.AZURE_OPENAI,
        chat_completion_sources.OPENROUTER,
        chat_completion_sources.CUSTOM,
        chat_completion_sources.DEEPSEEK,
        chat_completion_sources.XAI,
        chat_completion_sources.AIMLAPI,
        chat_completion_sources.CHUTES,
    ];

    // Sources that support logit bias
    const logitBiasSources = [
        chat_completion_sources.OPENAI,
        chat_completion_sources.AZURE_OPENAI,
        chat_completion_sources.OPENROUTER,
        chat_completion_sources.ELECTRONHUB,
        chat_completion_sources.CHUTES,
        chat_completion_sources.CUSTOM,
    ];

    // Sources that support "n" parameter for multi-swipe
    const multiswipeSources = [
        chat_completion_sources.OPENAI,
        chat_completion_sources.AZURE_OPENAI,
        chat_completion_sources.CUSTOM,
        chat_completion_sources.XAI,
        chat_completion_sources.AIMLAPI,
        chat_completion_sources.MOONSHOT,
    ];

    const isO1 = gptSources.includes(settings.chat_completion_source) && ['o1-2024-12-17', 'o1'].includes(model);
    const isWorkersAIJsonMode = settings.chat_completion_source === chat_completion_sources.WORKERS_AI && jsonSchema;
    const stream = settings.stream_openai && type !== 'quiet' && !isO1 && !isWorkersAIJsonMode;

    const noMultiSwipeTypes = ['quiet', 'impersonate', 'continue'];
    const canMultiSwipe = settings.n > 1 && !noMultiSwipeTypes.includes(type) && multiswipeSources.includes(settings.chat_completion_source);

    let logit_bias = {};
    if (settings.bias_preset_selected
        && logitBiasSources.includes(settings.chat_completion_source)
        && Array.isArray(settings.bias_presets[settings.bias_preset_selected])
        && settings.bias_presets[settings.bias_preset_selected].length) {
        logit_bias = biasCache || await calculateLogitBias();
        biasCache = logit_bias;
    }

    if (Object.keys(logit_bias).length === 0) {
        logit_bias = undefined;
    }

    const generate_data = {
        'type': type,
        'messages': messages,
        'model': model,
        'temperature': Number(settings.temp_openai),
        'frequency_penalty': Number(settings.freq_pen_openai),
        'presence_penalty': Number(settings.pres_pen_openai),
        'top_p': Number(settings.top_p_openai),
        'max_tokens': settings.openai_max_tokens,
        'stream': stream,
        'logit_bias': logit_bias,
        'stop': getCustomStoppingStrings(openai_max_stop_strings),
        'chat_completion_source': settings.chat_completion_source,
        'n': canMultiSwipe ? settings.n : undefined,
        'user_name': name1,
        'char_name': name2,
        'group_names': getGroupNames(),
        'include_reasoning': Boolean(settings.show_thoughts),
        'reasoning_effort': getReasoningEffort(settings, model),
        'enable_web_search': Boolean(settings.enable_web_search),
        'request_images': Boolean(settings.request_images),
        'request_image_resolution': String(settings.request_image_resolution),
        'request_image_aspect_ratio': String(settings.request_image_aspect_ratio),
        'custom_prompt_post_processing': settings.custom_prompt_post_processing,
        'verbosity': getVerbosity(settings),
    };

    if (settings.chat_completion_source === chat_completion_sources.AZURE_OPENAI) {
        generate_data.azure_base_url = settings.azure_base_url;
        generate_data.azure_deployment_name = settings.azure_deployment_name;
        generate_data.azure_api_version = settings.azure_api_version;
        // Reasoning effort is not supported on some Azure models (e.g. GPT-3.x, GPT-4.x)
        if (/^gpt-[34]/.test(model)) {
            delete generate_data.reasoning_effort;
        }
    }

    if (!canMultiSwipe && ToolManager.canPerformToolCalls(type, settings, model)) {
        await ToolManager.registerFunctionToolsOpenAI(generate_data);
    }

    // Empty array will produce a validation error
    if (!Array.isArray(generate_data.stop) || !generate_data.stop.length) {
        delete generate_data.stop;
    }

    if (settings.reverse_proxy && proxySupportedSources.includes(settings.chat_completion_source)) {
        await validateReverseProxy();
        generate_data.reverse_proxy = settings.reverse_proxy;
        generate_data.proxy_password = settings.proxy_password;
    }

    // Add logprobs request (max 5 per OpenAI docs)
    const useLogprobs = !!power_user.request_token_probabilities;
    if (useLogprobs && logprobsSupportedSources.includes(settings.chat_completion_source)) {
        generate_data.logprobs = 5;
    }

    // Remove logit bias/logprobs/stop-strings if not supported by the model
    const isVision = (m) => ['gpt', 'vision'].every(x => typeof m === 'string' && m.includes(x));
    if (gptSources.includes(settings.chat_completion_source) && isVision(model)) {
        delete generate_data.logit_bias;
        delete generate_data.stop;
        delete generate_data.logprobs;
    }
    if (gptSources.includes(settings.chat_completion_source) && /gpt-4.5/.test(model)) {
        delete generate_data.logprobs;
    }

    if (settings.chat_completion_source === chat_completion_sources.CLAUDE) {
        generate_data.top_k = Number(settings.top_k_openai);
        generate_data.use_sysprompt = settings.use_sysprompt;
        generate_data.stop = getCustomStoppingStrings(); // Claude shouldn't have limits on stop strings.
        // Don't add a prefill on quiet gens (summarization) and when using continue prefill.
        if (type !== 'quiet' && !(type === 'continue' && settings.continue_prefill)) {
            generate_data.assistant_prefill = type === 'impersonate'
                ? substituteParams(settings.assistant_impersonation)
                : substituteParams(settings.assistant_prefill);
        }
    }

    if (settings.chat_completion_source === chat_completion_sources.OPENROUTER) {
        generate_data.top_k = Number(settings.top_k_openai);
        generate_data.min_p = Number(settings.min_p_openai);
        generate_data.repetition_penalty = Number(settings.repetition_penalty_openai);
        generate_data.top_a = Number(settings.top_a_openai);
        generate_data.use_fallback = settings.openrouter_use_fallback;
        generate_data.provider = settings.openrouter_providers;
        generate_data.quantizations = settings.openrouter_quantizations;
        generate_data.allow_fallbacks = settings.openrouter_allow_fallbacks;
        generate_data.middleout = settings.openrouter_middleout;
    }

    if (settings.chat_completion_source === chat_completion_sources.NANOGPT) {
        generate_data.nanogpt_provider = settings.nanogpt_provider;
        generate_data.nanogpt_payg_override = settings.nanogpt_payg_override;
    }

    if (settings.chat_completion_source === chat_completion_sources.FIREWORKS && type !== 'quiet') {
        generate_data.chat_id = getCurrentChatId();
    }

    if ([chat_completion_sources.MAKERSUITE, chat_completion_sources.VERTEXAI].includes(settings.chat_completion_source)) {
        const stopStringsLimit = 5;
        generate_data.top_k = Number(settings.top_k_openai);
        generate_data.stop = getCustomStoppingStrings(stopStringsLimit).slice(0, stopStringsLimit).filter(x => x.length >= 1 && x.length <= 16);
        generate_data.use_sysprompt = settings.use_sysprompt;
        if (settings.chat_completion_source === chat_completion_sources.VERTEXAI) {
            generate_data.vertexai_auth_mode = settings.vertexai_auth_mode;
            generate_data.vertexai_region = settings.vertexai_region;
            generate_data.vertexai_express_project_id = settings.vertexai_express_project_id;
        }
    }

    if (settings.chat_completion_source === chat_completion_sources.MISTRALAI) {
        generate_data.safe_prompt = false; // already defaults to false, but just incase they change that in the future.
        generate_data.stop = getCustomStoppingStrings(); // Mistral shouldn't have limits on stop strings.
    }

    if (settings.chat_completion_source === chat_completion_sources.CUSTOM) {
        generate_data.custom_url = settings.custom_url;
        generate_data.custom_include_body = substituteParams(settings.custom_include_body);
        generate_data.custom_exclude_body = substituteParams(settings.custom_exclude_body);
        generate_data.custom_include_headers = substituteParams(settings.custom_include_headers);
    }

    if (settings.chat_completion_source === chat_completion_sources.COHERE) {
        // Clamp to 0.01 -> 0.99
        generate_data.top_p = Math.min(Math.max(Number(settings.top_p_openai), 0.01), 0.99);
        generate_data.top_k = Number(settings.top_k_openai);
        // Clamp to 0 -> 1
        generate_data.frequency_penalty = Math.min(Math.max(Number(settings.freq_pen_openai), 0), 1);
        generate_data.presence_penalty = Math.min(Math.max(Number(settings.pres_pen_openai), 0), 1);
        generate_data.stop = getCustomStoppingStrings(5);
    }

    if (settings.chat_completion_source === chat_completion_sources.PERPLEXITY) {
        generate_data.top_k = Number(settings.top_k_openai);
        generate_data.frequency_penalty = Number(settings.freq_pen_openai);
        generate_data.presence_penalty = Number(settings.pres_pen_openai);
        delete generate_data.stop;
    }

    // https://console.groq.com/docs/openai
    if (settings.chat_completion_source === chat_completion_sources.GROQ) {
        delete generate_data.logprobs;
        delete generate_data.logit_bias;
        delete generate_data.top_logprobs;
        delete generate_data.n;
    }

    // https://api-docs.deepseek.com/api/create-chat-completion
    if (settings.chat_completion_source === chat_completion_sources.DEEPSEEK) {
        generate_data.top_p = generate_data.top_p || Number.EPSILON;
    }

    if (settings.chat_completion_source === chat_completion_sources.XAI) {
        if (model.includes('grok-3-mini')) {
            delete generate_data.presence_penalty;
            delete generate_data.frequency_penalty;
            delete generate_data.stop;
        } else {
            // As of 2025/09/21, only grok-3-mini accepts reasoning_effort
            delete generate_data.reasoning_effort;
        }

        if (model.includes('grok-4') || model.includes('grok-code')) {
            delete generate_data.presence_penalty;
            delete generate_data.frequency_penalty;

            // grok-4-fast-non-reasoning accepts stop
            if (!model.includes('grok-4-fast-non-reasoning')) {
                delete generate_data.stop;
            }
        }
    }

    // https://docs.electronhub.ai/api-reference/chat/completions
    if (settings.chat_completion_source === chat_completion_sources.ELECTRONHUB) {
        generate_data.top_k = Number(settings.top_k_openai);
    }

    if (settings.chat_completion_source === chat_completion_sources.CHUTES) {
        generate_data.min_p = Number(settings.min_p_openai);
        generate_data.top_k = settings.top_k_openai > 0 ? Number(settings.top_k_openai) : undefined;
        generate_data.repetition_penalty = Number(settings.repetition_penalty_openai);
        generate_data.stop = getCustomStoppingStrings();
    }

    // https://docs.z.ai/api-reference/llm/chat-completion
    if (settings.chat_completion_source === chat_completion_sources.ZAI) {
        generate_data.top_p = generate_data.top_p || 0.01;
        generate_data.stop = getCustomStoppingStrings(1);
        generate_data.zai_endpoint = settings.zai_endpoint || ZAI_ENDPOINT.COMMON;
        delete generate_data.presence_penalty;
        delete generate_data.frequency_penalty;
    }

    if (settings.chat_completion_source === chat_completion_sources.POLLINATIONS) {
        generate_data.pollinations_endpoint = settings.pollinations_endpoint || POLLINATIONS_ENDPOINT.AUTHENTICATED;
    }

    if (settings.chat_completion_source === chat_completion_sources.SILICONFLOW) {
        generate_data.siliconflow_endpoint = settings.siliconflow_endpoint || SILICONFLOW_ENDPOINT.GLOBAL;
    }

    if (settings.chat_completion_source === chat_completion_sources.MINIMAX) {
        generate_data.minimax_endpoint = settings.minimax_endpoint || MINIMAX_ENDPOINT.GLOBAL;
        // MiniMax requires temperature in (0.0, 1.0]; zero is rejected.
        if (Number.isFinite(generate_data.temperature)) {
            generate_data.temperature = clamp(generate_data.temperature, Number.EPSILON, 1.0);
        }
    }

    if (settings.chat_completion_source === chat_completion_sources.WORKERS_AI) {
        generate_data.workers_ai_account_id = settings.workers_ai_account_id;
        generate_data.top_k = settings.top_k_openai > 0 ? Math.min(Number(settings.top_k_openai), 50) : undefined;
        generate_data.repetition_penalty = Number(settings.repetition_penalty_openai);
        generate_data.seed = settings.seed >= 1 ? Number(settings.seed) : undefined;
        generate_data.top_p = Math.max(Number(settings.top_p_openai), 0.001);
        delete generate_data.n;
        delete generate_data.logit_bias;
    }

    // https://docs.nano-gpt.com/api-reference/endpoint/chat-completion#temperature-&-nucleus
    if (settings.chat_completion_source === chat_completion_sources.NANOGPT) {
        generate_data.top_k = Number(settings.top_k_openai);
        generate_data.min_p = Number(settings.min_p_openai);
        generate_data.repetition_penalty = Number(settings.repetition_penalty_openai);
        generate_data.top_a = Number(settings.top_a_openai);
    }

    // https://platform.moonshot.ai/docs/api/chat#public-service-address
    if (settings.chat_completion_source === chat_completion_sources.MOONSHOT) {
        // >Kimi API is fully compatible with OpenAI's API format
        if (/kimi-k2.5/.test(model)) {
            delete generate_data.temperature;
            delete generate_data.top_p;
            delete generate_data.frequency_penalty;
            delete generate_data.presence_penalty;
        }
    }

    if (seedSupportedSources.includes(settings.chat_completion_source) && settings.seed >= 0) {
        generate_data.seed = settings.seed;
    }

    if ([chat_completion_sources.OPENAI, chat_completion_sources.AZURE_OPENAI].includes(settings.chat_completion_source) && /^(o1|o3|o4)/.test(model) ||
        (chat_completion_sources.OPENROUTER === settings.chat_completion_source && /^openai\/(o1|o3|o4)/.test(model))) {
        generate_data.max_completion_tokens = generate_data.max_tokens;
        delete generate_data.max_tokens;
        delete generate_data.logprobs;
        delete generate_data.top_logprobs;
        delete generate_data.stop;
        delete generate_data.logit_bias;
        delete generate_data.temperature;
        delete generate_data.top_p;
        delete generate_data.frequency_penalty;
        delete generate_data.presence_penalty;
        if (/^(openai\/)?(o1)/.test(model)) {
            generate_data.messages.forEach((msg) => {
                if (msg.role === 'system') {
                    msg.role = 'user';
                }
            });
            delete generate_data.n;
            delete generate_data.tools;
            delete generate_data.tool_choice;
        }
    }

    if (gptSources.includes(settings.chat_completion_source) && /gpt-5/.test(model)) {
        generate_data.max_completion_tokens = generate_data.max_tokens;
        delete generate_data.max_tokens;
        delete generate_data.logprobs;
        delete generate_data.top_logprobs;
        if (/gpt-5-chat-latest/.test(model)) {
            delete generate_data.tools;
            delete generate_data.tool_choice;
        } else if (/gpt-5\.(1|2|3|4)/.test(model) && !/chat-latest/.test(model) && !generate_data.reasoning_effort) {
            delete generate_data.frequency_penalty;
            delete generate_data.presence_penalty;
            delete generate_data.logit_bias;
            delete generate_data.stop;
        } else {
            delete generate_data.temperature;
            delete generate_data.top_p;
            delete generate_data.frequency_penalty;
            delete generate_data.presence_penalty;
            delete generate_data.logit_bias;
            delete generate_data.stop;
        }
    }

    if (gptSources.includes(settings.chat_completion_source) && /gpt-6-astra/.test(model)) {
        generate_data.max_completion_tokens = generate_data.max_tokens;
        delete generate_data.max_tokens;
        delete generate_data.temperature;
        delete generate_data.top_p;
        delete generate_data.logprobs;
        delete generate_data.top_logprobs;
    }

    // Claude Fable / Claude 5 models removed sampling parameters and reject them with HTTP 400,
    // including via OpenAI-compatible proxies. Unanchored to also match prefixed ids
    // like 'anthropic/claude-fable-5' or 'anthropic/claude-opus-5'.
    if (/claude-(fable|opus-5|sonnet-5)/.test(model)) {
        delete generate_data.temperature;
        delete generate_data.top_p;
        delete generate_data.top_k;
        delete generate_data.frequency_penalty;
        delete generate_data.presence_penalty;
        // Keep reasoning_effort for the native Claude source, where the backend maps it to
        // adaptive thinking; proxies may translate it into a thinking budget that these models reject.
        if (settings.chat_completion_source !== chat_completion_sources.CLAUDE) {
            delete generate_data.reasoning_effort;
        }
    }

    if (jsonSchema) {
        generate_data.json_schema = jsonSchema;
    }

    return { generate_data, stream, canMultiSwipe };
}

// 실리 public/scripts/openai.js 3401~3418
async function calculateLogitBias() {
    const body = JSON.stringify(oai_settings.bias_presets[oai_settings.bias_preset_selected]);
    let result = {};

    try {
        const reply = await fetch(`/api/backends/chat-completions/bias?model=${getTokenizerModel()}`, {
            method: 'POST',
            headers: getRequestHeaders(),
            body,
        });

        result = await reply.json();
    } catch (err) {
        result = {};
        console.error(err);
    }
    return result;
}

// 실리 public/scripts/openai.js 4274~4313
function migrateChatCompletionSettings(settings) {
    const migrateMap = [
        { oldKey: 'names_in_completion', oldValue: true, newKey: 'names_behavior', newValue: character_names_behavior.COMPLETION },
        { oldKey: 'chat_completion_source', oldValue: 'palm', newKey: 'chat_completion_source', newValue: chat_completion_sources.MAKERSUITE },
        { oldKey: 'custom_prompt_post_processing', oldValue: custom_prompt_post_processing_types.CLAUDE, newKey: 'custom_prompt_post_processing', newValue: custom_prompt_post_processing_types.MERGE },
        { oldKey: 'ai21_model', oldValue: /^j2-/, newKey: 'ai21_model', newValue: 'jamba-large' },
        { oldKey: 'google_model', oldValue: 'gemini-3.1-flash-lite-preview', newKey: 'google_model', newValue: 'gemini-3.1-flash-lite' },
        { oldKey: 'vertexai_model', oldValue: 'gemini-3.1-flash-lite-preview', newKey: 'vertexai_model', newValue: 'gemini-3.1-flash-lite' },
        { oldKey: 'google_model', oldValue: 'gemini-3.1-flash-image-preview', newKey: 'google_model', newValue: 'gemini-3.1-flash-image' },
        { oldKey: 'vertexai_model', oldValue: 'gemini-3.1-flash-image-preview', newKey: 'vertexai_model', newValue: 'gemini-3.1-flash-image' },
        { oldKey: 'google_model', oldValue: 'gemini-3-pro-image-preview', newKey: 'google_model', newValue: 'gemini-3-pro-image' },
        { oldKey: 'vertexai_model', oldValue: 'gemini-3-pro-image-preview', newKey: 'vertexai_model', newValue: 'gemini-3-pro-image' },
        { oldKey: 'image_inlining', oldValue: false, newKey: 'media_inlining', newValue: false },
        { oldKey: 'image_inlining', oldValue: true, newKey: 'media_inlining', newValue: true },
        { oldKey: 'video_inlining', oldValue: true, newKey: 'media_inlining', newValue: true },
        { oldKey: 'audio_inlining', oldValue: true, newKey: 'media_inlining', newValue: true },
        { oldKey: 'claude_use_sysprompt', oldValue: true, newKey: 'use_sysprompt', newValue: true },
        { oldKey: 'use_makersuite_sysprompt', oldValue: true, newKey: 'use_sysprompt', newValue: true },
        { oldKey: 'mistralai_model', oldValue: /^(mistral-medium|mistral-small)$/, newKey: 'mistralai_model', newValue: (settings.mistralai_model + '-latest') },
        { oldKey: 'deepseek_model', oldValue: /^deepseek-(chat|reasoner|coder)$/, newKey: 'deepseek_model', newValue: 'deepseek-v4-flash' },
        { oldKey: 'openrouter_sort_models', oldValue: 'alphabetically', newKey: 'sort_models', newValue: 'alphabetically' },
        { oldKey: 'openrouter_sort_models', oldValue: 'pricing.prompt', newKey: 'sort_models', newValue: 'pricing.prompt' },
        { oldKey: 'openrouter_sort_models', oldValue: 'context_length', newKey: 'sort_models', newValue: 'context_length' },
        { oldKey: 'openrouter_group_models', oldValue: true, newKey: 'group_models', newValue: true },
    ];

    for (const migration of migrateMap) {
        if (Object.hasOwn(settings, migration.oldKey)) {
            const shouldMigrate = migration.oldValue instanceof RegExp
                ? migration.oldValue.test(settings[migration.oldKey])
                : settings[migration.oldKey] === migration.oldValue;
            if (shouldMigrate) {
                settings[migration.newKey] = migration.newValue;
            }
            if (migration.oldKey !== migration.newKey) {
                delete settings[migration.oldKey];
            }
        }
    }
}

// 실리 public/scripts/openai.js 4459~4475
async function getStatusOpen() {
    const noValidateSources = [
        chat_completion_sources.CLAUDE,
        chat_completion_sources.AI21,
        chat_completion_sources.VERTEXAI,
        chat_completion_sources.PERPLEXITY,
        chat_completion_sources.ZAI,
        chat_completion_sources.MINIMAX,
    ];
    if (noValidateSources.includes(oai_settings.chat_completion_source)) {
        let status = t`Key saved; press \"Test Message\" to verify.`;
        setOnlineStatus(status);
        updateFeatureSupportFlags();
        return resultCheckStatus();
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.CUSTOM && !isValidUrl(oai_settings.custom_url)) {
        // (실리 4476 console.debug: 서버는 남기지 않아요)
// 실리 public/scripts/openai.js 4477~4481
        setOnlineStatus(t`Invalid endpoint URL. Requests may fail.`);
        return resultCheckStatus();
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.AZURE_OPENAI && !isValidUrl(oai_settings.azure_base_url)) {
        // (실리 4482 console.debug: 서버는 남기지 않아요)
// 실리 public/scripts/openai.js 4483~4508
        setOnlineStatus(t`Invalid Azure endpoint URL. Requests may fail.`);
        return resultCheckStatus();
    }

    let data = {
        reverse_proxy: oai_settings.reverse_proxy,
        proxy_password: oai_settings.proxy_password,
        chat_completion_source: oai_settings.chat_completion_source,
    };

    const validateProxySources = [
        chat_completion_sources.CLAUDE,
        chat_completion_sources.OPENAI,
        chat_completion_sources.MISTRALAI,
        chat_completion_sources.MAKERSUITE,
        chat_completion_sources.VERTEXAI,
        chat_completion_sources.DEEPSEEK,
        chat_completion_sources.XAI,
        chat_completion_sources.ZAI,
        chat_completion_sources.MOONSHOT,
    ];
    if (oai_settings.reverse_proxy && validateProxySources.includes(oai_settings.chat_completion_source)) {
        await validateReverseProxy();
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.CUSTOM) {
        // (실리 4509: 화면의 .model_custom_select 비우기)
// 실리 public/scripts/openai.js 4510~4565
        data.custom_url = oai_settings.custom_url;
        data.custom_include_headers = substituteParams(oai_settings.custom_include_headers);
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.AZURE_OPENAI) {
        data.azure_base_url = oai_settings.azure_base_url;
        data.azure_deployment_name = oai_settings.azure_deployment_name;
        data.azure_api_version = oai_settings.azure_api_version;
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.SILICONFLOW) {
        data.siliconflow_endpoint = oai_settings.siliconflow_endpoint;
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.MINIMAX) {
        data.minimax_endpoint = oai_settings.minimax_endpoint;
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.WORKERS_AI) {
        data.workers_ai_account_id = oai_settings.workers_ai_account_id;
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.POLLINATIONS) {
        data.pollinations_endpoint = oai_settings.pollinations_endpoint || POLLINATIONS_ENDPOINT.AUTHENTICATED;
    }

    const canBypass = (oai_settings.chat_completion_source === chat_completion_sources.OPENAI && oai_settings.bypass_status_check) || oai_settings.chat_completion_source === chat_completion_sources.CUSTOM;
    if (canBypass) {
        setOnlineStatus(t`Status check bypassed`);
    }

    try {
        const response = await fetch('/api/backends/chat-completions/status', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(data),
            signal: abortStatusCheck.signal,
            cache: 'no-cache',
        });

        if (!response.ok) {
            throw new Error(response.statusText);
        }

        const responseData = await response.json();

        if ('data' in responseData && Array.isArray(responseData.data)) {
            saveModelList(responseData.data);
        }
        if (!('error' in responseData)) {
            setOnlineStatus(t`Valid`);
        }
        if (responseData.bypass) {
            setOnlineStatus(t`Status check bypassed`);
        }
    } catch (error) {
        // (실리 4566 console.error(error): 서버는 plugin/st/nastatus.js가 한 번만 "상태를 가져오는 중 오류가 발생했습니다.")
// 실리 public/scripts/openai.js 4567~4575

        if (!canBypass) {
            setOnlineStatus('no_connection');
        }
    }

    updateFeatureSupportFlags();
    return resultCheckStatus();
}

// 실리 public/scripts/openai.js 5083~5470
/**
 * Get the maximum context size for the OpenAI model
 * @param {string} value Model identifier
 * @returns {number} Maximum context size in tokens
 */
function getMaxContextOpenAI(value) {
    if (oai_settings.max_context_unlocked) {
        return unlocked_max;
    }

    /** @type {[RegExp, number][]} */
    const contextMap = [
        [/^gpt-6-astra/, max_1050k],
        [/^gpt-5\.6/, max_1050k],
        [/^gpt-5\.[45]/, max_1mil],
        [/^gpt-5/, max_400k],
        [/gpt-4\.1/, max_1mil],
        [/gpt-audio/, max_128k],
        [/^o1/, max_128k],
        [/^o[34]/, max_200k],
        [/chatgpt-4o-latest|gpt-4-turbo|gpt-4o|gpt-4-1106|gpt-4-0125|gpt-4-vision/, max_128k],
        [/gpt-3\.5-turbo-1106/, max_16k],
        [/^(gpt-4|gpt-4-0314|gpt-4-0613)$/, max_8k],
        [/^(gpt-4-32k|gpt-4-32k-0314|gpt-4-32k-0613)$/, max_32k],
        [/gpt-realtime/, max_32k],
        [/^(gpt-3\.5-turbo-16k|gpt-3\.5-turbo-16k-0613)$/, max_16k],
        [/^code-davinci-002$/, max_8k],
        [/^(text-curie-001|text-babbage-001|text-ada-001)$/, max_2k],
        [/gpt-3/, max_4k],
    ];

    for (const [regex, max] of contextMap) {
        if (regex.test(value)) {
            return max;
        }
    }

    // Safe default for most modern models
    return max_128k;
}

/**
 * Get the maximum context size for Gemini models based on model identifier and optional model list.
 * @param {string} model Model identifier
 * @param {boolean} isUnlocked Whether context limits are unlocked
 * @returns {number} Maximum context size in tokens
 */
function getGeminiMaxContext(model, isUnlocked) {
    if (isUnlocked) {
        return unlocked_max;
    }

    if (Array.isArray(model_list) && model_list.length > 0) {
        const contextLength = model_list.find((record) => record.id === model)?.inputTokenLimit;
        if (Number.isFinite(contextLength) && contextLength > 0) {
            return contextLength;
        }
    }

    /** @type {[RegExp, number][]} */
    const contextMap = [
        [/gemini-2\.5-flash-image/, max_32k],
        [/gemini-3\.1-flash-image/, max_128k],
        [/gemini-3-pro-image/, max_64k],
        [/gemini-(?:3[.\d]*|2\.(?:5|0))-(pro|flash)/, max_1mil],
        [/(gemini-exp|learnlm-2\.0-flash|gemini-robotics)/, max_1mil],
        [/gemma-3-27b-it/, max_128k],
        [/gemma-3n-e4b-it/, max_8k],
        [/gemma-3/, max_32k],
        [/gemma-4/, max_256k],
    ];

    for (const [regex, max] of contextMap) {
        if (regex.test(model)) {
            return max;
        }
    }

    return max_128k;
}

/**
 * Get the maximum temperature for Gemini models based on model identifier and optional model list.
 * @param {string} model Model identifier
 * @returns {number} Maximum temperature for Gemini models
 */
function getGeminiMaxTemp(model) {
    if (Array.isArray(model_list) && model_list.length > 0) {
        const temp = model_list.find((record) => record.id === model)?.maxTemperature;
        if (Number.isFinite(temp) && temp > 0) {
            return temp;
        }
    }

    if (/(vision|ultra|gemma)/.test(model)) {
        return 1.0;
    }

    return 2.0;
}

/**
 * Get the maximum context size for the Mistral model
 * @param {string} model Model identifier
 * @param {boolean} isUnlocked Whether context limits are unlocked
 * @returns {number} Maximum context size in tokens
 */
function getMistralMaxContext(model, isUnlocked) {
    if (isUnlocked) {
        return unlocked_max;
    }

    if (Array.isArray(model_list) && model_list.length > 0) {
        const contextLength = model_list.find((record) => record.id === model)?.max_context_length;
        if (contextLength) {
            return contextLength;
        }
    }

    // Return context size if model found, otherwise default to 32k
    return max_32k;
}

/**
 * Get the maximum context size for the Groq model
 * @param {string} model Model identifier
 * @param {boolean} isUnlocked Whether context limits are unlocked
 * @returns {number} Maximum context size in tokens
 */
function getGroqMaxContext(model, isUnlocked) {
    if (isUnlocked) {
        return unlocked_max;
    }

    if (Array.isArray(model_list) && model_list.length > 0) {
        const contextLength = model_list.find((record) => record.id === model)?.context_window;
        if (contextLength) {
            return contextLength;
        }
    }

    const contextMap = {
        'gemma2-9b-it': max_8k,
        'llama-3.3-70b-versatile': max_128k,
        'llama-3.1-8b-instant': max_128k,
        'llama3-70b-8192': max_8k,
        'llama3-8b-8192': max_8k,
        'llama-guard-3-8b': max_8k,
        'mixtral-8x7b-32768': max_32k,
        'deepseek-r1-distill-llama-70b': max_128k,
        'llama-3.3-70b-specdec': max_8k,
        'llama-3.2-1b-preview': max_128k,
        'llama-3.2-3b-preview': max_128k,
        'llama-3.2-11b-vision-preview': max_128k,
        'llama-3.2-90b-vision-preview': max_128k,
        'qwen-2.5-32b': max_128k,
        'deepseek-r1-distill-qwen-32b': max_128k,
        'deepseek-r1-distill-llama-70b-specdec': max_128k,
        'mistral-saba-24b': max_32k,
        'meta-llama/llama-4-scout-17b-16e-instruct': max_128k,
        'meta-llama/llama-4-maverick-17b-128e-instruct': max_128k,
        'compound-beta': max_128k,
        'compound-beta-mini': max_128k,
        'qwen/qwen3-32b': max_128k,
    };

    // Return context size if model found, otherwise default to 128k
    return Object.entries(contextMap).find(([key]) => model.includes(key))?.[1] || max_128k;
}

/**
 * Get the maximum context size for the Z.AI model
 * @param {string} model Model identifier
 * @param {boolean} isUnlocked If context limits are unlocked
 * @returns {number} Maximum context size in tokens
 */
function getZaiMaxContext(model, isUnlocked) {
    if (isUnlocked) {
        return unlocked_max;
    }

    const contextMap = {
        'glm-5.2': max_1mil,
        'glm-5.1': max_200k,
        'glm-5-turbo': max_200k,
        'glm-5v-turbo': max_200k,
        'glm-5': max_200k,
        'glm-4.7': max_200k,
        'glm-4.7-flash': max_200k,
        'glm-4.7-flashx': max_200k,
        'glm-4.6v': max_128k,
        'glm-4.6v-flash': max_128k,
        'glm-4.6v-flashx': max_128k,
        'glm-4.6': max_200k,
        'glm-4.5': max_128k,
        'glm-4-32b-0414-128k': max_128k,
        'glm-4.5-air': max_128k,
        'glm-4.5v': max_64k,
        'autoglm-phone-multilingual': max_64k,
    };

    // Return context size if model found, otherwise default to 128k
    return Object.entries(contextMap).find(([key]) => model.includes(key))?.[1] || max_128k;
}

/**
 * Get the maximum context size for the SiliconFlow model
 * @param {string} model Model identifier
 * @param {boolean} isUnlocked Whether context limits are unlocked
 * @returns {number} Maximum context size in tokens
 */
function getSiliconflowMaxContext(model, isUnlocked) {
    if (isUnlocked) {
        return unlocked_max;
    }

    const contextMap = {
        'baidu/ERNIE-4.5-300B-A47B': max_128k,
        'ByteDance-Seed/Seed-OSS-36B-Instruct': max_256k,
        'deepseek-ai/DeepSeek-R1': max_128k,
        'deepseek-ai/DeepSeek-V3': max_128k,
        'deepseek-ai/DeepSeek-V3.1': max_128k,
        'deepseek-ai/DeepSeek-V3.1-Terminus': max_128k,
        'deepseek-ai/DeepSeek-V3.2-Exp': max_128k,
        'deepseek-ai/deepseek-vl2': max_4k,
        'inclusionAI/Ling-1T': max_128k,
        'inclusionAI/Ling-flash-2.0': max_128k,
        'inclusionAI/Ling-mini-2.0': max_128k,
        'inclusionAI/Ring-1T': max_128k,
        'inclusionAI/Ring-flash-2.0': max_128k,
        'meta-llama/Llama-3.3-70B-Instruct': max_32k,
        'meta-llama/Meta-Llama-3.1-8B-Instruct': max_32k,
        'MiniMaxAI/MiniMax-M1-80k': max_128k,
        'MiniMaxAI/MiniMax-M2': max_128k,
        'moonshotai/Kimi-K2-Instruct': max_128k,
        'moonshotai/Kimi-K2-Instruct-0905': max_256k,
        'moonshotai/Kimi-K2-Thinking': max_256k,
        'openai/gpt-oss-120b': max_128k,
        'openai/gpt-oss-20b': max_128k,
        'Qwen/Qwen3-235B-A22B-Instruct-2507': max_256k,
        'Qwen/Qwen3-235B-A22B-Thinking-2507': max_256k,
        'Qwen/Qwen3-30B-A3B-Instruct-2507': max_256k,
        'Qwen/Qwen3-30B-A3B-Thinking-2507': max_256k,
        'Qwen/Qwen3-VL-235B-A22B-Instruct': max_256k,
        'Qwen/Qwen3-VL-235B-A22B-Thinking': max_256k,
        'Qwen/Qwen3-VL-30B-A3B-Instruct': max_256k,
        'Qwen/Qwen3-VL-30B-A3B-Thinking': max_256k,
        'Qwen/Qwen3-VL-32B-Instruct': max_256k,
        'Qwen/Qwen3-VL-32B-Thinking': max_256k,
        'Qwen/Qwen3-VL-8B-Instruct': max_256k,
        'Qwen/Qwen3-VL-8B-Thinking': max_256k,
        'stepfun-ai/step3': max_64k,
        'tencent/Hunyuan-A13B-Instruct': max_128k,
        'zai-org/GLM-4.5': max_128k,
        'zai-org/GLM-4.5-Air': max_128k,
        'zai-org/GLM-4.5V': max_64k,
        'zai-org/GLM-4.6': max_200k,
    };

    // Return context size if model found, otherwise default to 32k
    return Object.entries(contextMap).find(([key]) => model.includes(key))?.[1] || max_32k;
}

/**
 * Get the maximum context size for the Moonshot model
 * @param {string} model Model identifier
 * @param {boolean} isUnlocked If context limits are unlocked
 * @returns {number} Maximum context size in tokens
 */
function getMoonshotMaxContext(model, isUnlocked) {
    if (isUnlocked) {
        return unlocked_max;
    }

    if (Array.isArray(model_list) && model_list.length > 0) {
        const modelInfo = model_list.find((record) => record.id === model);
        if (modelInfo?.context_length) {
            return modelInfo.context_length;
        }
    }

    const contextMap = {
        'moonshot-v1-8k': max_8k,
        'moonshot-v1-32k': max_32k,
        'moonshot-v1-128k': max_128k,
        'moonshot-v1-auto': max_128k,
        'moonshot-v1-8k-vision-preview': max_8k,
        'moonshot-v1-32k-vision-preview': max_32k,
        'moonshot-v1-128k-vision-preview': max_128k,
        'kimi-k2-0711-preview': max_32k,
        'kimi-latest': max_256k,
        'kimi-thinking-preview': max_32k,
        'kimi-k2.5': max_256k,
        'kimi-k2-0905-preview': max_256k,
        'kimi-k2-turbo-preview': max_256k,
        'kimi-k2-thinking': max_256k,
        'kimi-k2-thinking-turbo': max_256k,
    };

    // Return context size if model found, otherwise default to 32k
    return Object.entries(contextMap).find(([key]) => model.includes(key))?.[1] || max_32k;
}

/**
 * Get the maximum context size for the Fireworks model
 * @param {string} model Model identifier
 * @param {boolean} isUnlocked Whether context limits are unlocked
 * @returns {number} Maximum context size in tokens
 */
function getFireworksMaxContext(model, isUnlocked) {
    if (isUnlocked) {
        return unlocked_max;
    }

    // First check if model info is available from model_list
    if (Array.isArray(model_list) && model_list.length > 0) {
        const modelInfo = model_list.find((record) => record.id === model);
        if (modelInfo?.context_length) {
            return modelInfo.context_length;
        }
        if (modelInfo?.context_window) {
            return modelInfo.context_window;
        }
    }

    return max_32k;
}

/**
 * Get the maximum context size for the Chutes model
 * @param {string} model Model identifier
 * @param {boolean} isUnlocked Whether context limits are unlocked
 * @returns {number} Maximum context size in tokens
 */
function getChutesMaxContext(model, isUnlocked) {
    if (isUnlocked) {
        return unlocked_max;
    }

    if (Array.isArray(model_list)) {
        const modelInfo = model_list.find(m => m.id === model);
        if (modelInfo?.context_length) {
            return modelInfo.context_length;
        }
    }
    return max_8k;
}

/**
 * Get the maximum context size for the ElectronHub model
 * @param {string} model Model identifier
 * @param {boolean} isUnlocked Whether context limits are unlocked
 * @returns {number} Maximum context size in tokens
 */
function getElectronHubMaxContext(model, isUnlocked) {
    if (isUnlocked) {
        return unlocked_max;
    }

    if (Array.isArray(model_list)) {
        const modelInfo = model_list.find(m => m.id === model);
        if (modelInfo?.tokens) {
            return modelInfo.tokens;
        }
    }
    return max_128k;
}

/**
 * Get the maximum context size for the NanoGPT model
 * @param {string} model Model identifier
 * @param {boolean} isUnlocked Whether context limits are unlocked
 * @returns {number} Maximum context size in tokens
 */
function getNanoGptMaxContext(model, isUnlocked) {
    if (isUnlocked) {
        return unlocked_max;
    }

    if (Array.isArray(model_list)) {
        const modelInfo = model_list.find(m => m.id === model);
        if (modelInfo?.context_length) {
            return modelInfo.context_length;
        }
    }

    return max_128k;
}

/**
 * 우리 것: 실리 onModelChange(5472~6018)의 뒷부분. 앞부분(고른 칸마다 모델 값 · 가드)은 plugin/st/nastatus.js saveModelListValues가 따라 해요:
 * 가드를 지나면(실리가 return하지 않으면) 이것을 불러요. value: 5474 `String($(this).val() || '')`.
 * 문맥 · 온도 · 벌점 칸의 최대값과 그 칸의 값 고치기(대역 $: 브라우저의 범위 칸, 그 칸의 input 처리기가 oai_settings에 써요)는 실리 그대로.
 * 칸은 일마다 index.html 그대로 새로 만들어요(실리의 이 줄들은 쓰기 전에 그 칸의 최대값을 늘 다시 정해요).
 * 5473 biasCache = undefined: 서버는 일마다 naLoad가 비워요. 6013~6017(화면 · 저장 · 기능 표시 · 이벤트)은 빼요.
 * 5941 console.log(AI/ML 문맥 크기)는 남기지 않아요: 서버는 일마다 다시 돌아서 같은 줄이 계속 나와요.
 */
export function __naModelChangeRest(value) {
    __naRanges = new Map(Object.entries(__naRangeAttrs).map(([id, attrs]) => [id, new __NaRange(attrs)]));
    __naRangeInputs();
    const console = Object.assign(Object.create(globalThis.console), { log: () => {} });
// 실리 public/scripts/openai.js 5695~6011
    if ([chat_completion_sources.MAKERSUITE, chat_completion_sources.VERTEXAI].includes(oai_settings.chat_completion_source)) {
        const contextSize = getGeminiMaxContext(value, oai_settings.max_context_unlocked);
        const maxTemp = getGeminiMaxTemp(value);
        $('#openai_max_context').attr('max', contextSize);
        oai_settings.temp_openai = Math.min(maxTemp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', maxTemp).val(oai_settings.temp_openai).trigger('input');
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.OPENROUTER) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        } else {
            const model = model_list.find(m => m.id == oai_settings.openrouter_model);
            if (model?.context_length) {
                $('#openai_max_context').attr('max', model.context_length);
            } else {
                $('#openai_max_context').attr('max', max_128k);
            }
        }
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');

        if (value && (value.includes('claude') || value.includes('palm-2'))) {
            oai_settings.temp_openai = Math.min(claude_max_temp, oai_settings.temp_openai);
            $('#temp_openai').attr('max', claude_max_temp).val(oai_settings.temp_openai).trigger('input');
        } else {
            oai_settings.temp_openai = Math.min(oai_max_temp, oai_settings.temp_openai);
            $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
        }

        calculateOpenRouterCost();
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.CLAUDE) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        } else if (/^claude-(sonnet-4-5|sonnet-4-6|sonnet-5|opus-4-6|opus-4-7|opus-4-8|opus-5|fable)/.test(value)) {
            $('#openai_max_context').attr('max', max_1mil);
        } else if (/^claude-(3|opus|haiku|sonnet)/.test(value)) {
            $('#openai_max_context').attr('max', max_200k);
        } else {
            $('#openai_max_context').attr('max', max_200k);
        }

        oai_settings.openai_max_context = Math.min(oai_settings.openai_max_context, Number($('#openai_max_context').attr('max')));
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');

        $('#openai_reverse_proxy').attr('placeholder', 'https://api.anthropic.com/v1');

        oai_settings.temp_openai = Math.min(claude_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', claude_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if ([chat_completion_sources.AZURE_OPENAI, chat_completion_sources.OPENAI].includes(oai_settings.chat_completion_source)) {
        $('#openai_max_context').attr('max', getMaxContextOpenAI(value));
        oai_settings.openai_max_context = Math.min(oai_settings.openai_max_context, Number($('#openai_max_context').attr('max')));
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');

        $('#openai_reverse_proxy').attr('placeholder', 'https://api.openai.com/v1');

        oai_settings.temp_openai = Math.min(oai_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.MISTRALAI) {
        const maxContext = getMistralMaxContext(oai_settings.mistralai_model, oai_settings.max_context_unlocked);
        $('#openai_max_context').attr('max', maxContext);
        oai_settings.openai_max_context = Math.min(oai_settings.openai_max_context, Number($('#openai_max_context').attr('max')));
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        oai_settings.temp_openai = Math.min(mistral_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', mistral_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.COHERE) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        } else if (['command-light-nightly', 'command-light', 'command'].includes(oai_settings.cohere_model)) {
            $('#openai_max_context').attr('max', max_4k);
        } else if (oai_settings.cohere_model.includes('command-r') || ['c4ai-aya-23', 'c4ai-aya-expanse-32b', 'command-nightly', 'command-a-vision-07-2025'].includes(oai_settings.cohere_model)) {
            $('#openai_max_context').attr('max', max_128k);
        } else if (['command-a-03-2025'].includes(oai_settings.cohere_model)) {
            $('#openai_max_context').attr('max', max_256k);
        } else if (['c4ai-aya-23-8b', 'c4ai-aya-expanse-8b'].includes(oai_settings.cohere_model)) {
            $('#openai_max_context').attr('max', max_8k);
        } else if (['c4ai-aya-vision-8b', 'c4ai-aya-vision-32b'].includes(oai_settings.cohere_model)) {
            $('#openai_max_context').attr('max', max_16k);
        } else {
            $('#openai_max_context').attr('max', max_4k);
        }
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        $('#temp_openai').attr('max', claude_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.PERPLEXITY) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        } else if (['sonar', 'sonar-reasoning', 'sonar-reasoning-pro', 'r1-1776'].includes(oai_settings.perplexity_model)) {
            $('#openai_max_context').attr('max', 127000);
        } else if (['sonar-pro'].includes(oai_settings.perplexity_model)) {
            $('#openai_max_context').attr('max', 200000);
        } else if (oai_settings.perplexity_model.includes('llama-3.1')) {
            const isOnline = oai_settings.perplexity_model.includes('online');
            const contextSize = isOnline ? 128 * 1024 - 4000 : 128 * 1024;
            $('#openai_max_context').attr('max', contextSize);
        } else {
            $('#openai_max_context').attr('max', max_128k);
        }
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        oai_settings.temp_openai = Math.min(oai_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.GROQ) {
        const maxContext = getGroqMaxContext(oai_settings.groq_model, oai_settings.max_context_unlocked);
        $('#openai_max_context').attr('max', maxContext);
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        oai_settings.temp_openai = Math.min(oai_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.AI21) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        } else if (oai_settings.ai21_model.startsWith('jamba-')) {
            $('#openai_max_context').attr('max', max_256k);
        }

        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.CUSTOM) {
        $('#openai_max_context').attr('max', unlocked_max);
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.CHUTES) {
        const maxContext = getChutesMaxContext(oai_settings.chutes_model, oai_settings.max_context_unlocked);
        $('#openai_max_context').attr('max', maxContext);
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        oai_settings.temp_openai = Math.min(oai_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');

        calculateChutesCost();
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.ELECTRONHUB) {
        const maxContext = getElectronHubMaxContext(oai_settings.electronhub_model, oai_settings.max_context_unlocked);
        $('#openai_max_context').attr('max', maxContext);
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        oai_settings.temp_openai = Math.min(oai_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');

        calculateElectronHubCost();
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.NANOGPT) {
        const maxContext = getNanoGptMaxContext(oai_settings.nanogpt_model, oai_settings.max_context_unlocked);
        $('#openai_max_context').attr('max', maxContext);
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        oai_settings.temp_openai = Math.min(oai_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.POLLINATIONS) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        } else {
            $('#openai_max_context').attr('max', max_128k);
        }

        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.DEEPSEEK) {
        const maxContext = oai_settings.max_context_unlocked ? unlocked_max : max_1mil;
        $('#openai_max_context').attr('max', maxContext);
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.WORKERS_AI) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        } else {
            const model = model_list.find(m => m.id === oai_settings.workers_ai_model);
            const ctxProp = Array.isArray(model?.properties) && model.properties.find(p => p.property_id === 'context_window');
            const contextLength = ctxProp ? Number(ctxProp.value) : max_8k;
            $('#openai_max_context').attr('max', contextLength || max_8k);
        }
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        const workersAiMaxTemp = 5.0;
        oai_settings.temp_openai = Math.min(workersAiMaxTemp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', workersAiMaxTemp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.COMETAPI) {
        $('#openai_max_context').attr('max', oai_settings.max_context_unlocked ? unlocked_max : max_128k);
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.XAI) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        } else if (oai_settings.xai_model.includes('grok-2-vision')) {
            $('#openai_max_context').attr('max', max_32k);
        } else if (oai_settings.xai_model.includes('grok-4-fast')) {
            $('#openai_max_context').attr('max', max_2mil);
        } else if (oai_settings.xai_model.includes('grok-4')) {
            $('#openai_max_context').attr('max', max_256k);
        } else if (oai_settings.xai_model.includes('grok-code')) {
            $('#openai_max_context').attr('max', max_256k);
        } else {
            // grok 2 and grok 3
            $('#openai_max_context').attr('max', max_128k);
        }

        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.AIMLAPI) {
        let maxContext;
        if (oai_settings.max_context_unlocked) {
            maxContext = unlocked_max;
        } else {
            const model = model_list.find(m => m.id === oai_settings.aimlapi_model);
            maxContext = (model?.info?.contextLength ?? model?.context_length) || max_32k;
            console.log('[AI/ML API] Model CTX:', model?.info?.contextLength);
        }

        $('#openai_max_context')
            .prop('max', maxContext)
            .val(Math.min(Number(oai_settings.openai_max_context), maxContext))
            .trigger('input');

        $('#temp_openai')
            .prop('max', oai_max_temp)
            .val(Number(oai_settings.temp_openai))
            .trigger('input');

        oai_settings.openai_max_context = Number($('#openai_max_context').val());
        oai_settings.temp_openai = Number($('#temp_openai').val());
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.COHERE) {
        oai_settings.pres_pen_openai = Math.min(Math.max(0, oai_settings.pres_pen_openai), 1);
        $('#pres_pen_openai').attr('max', 1).attr('min', 0).val(oai_settings.pres_pen_openai).trigger('input');
        oai_settings.freq_pen_openai = Math.min(Math.max(0, oai_settings.freq_pen_openai), 1);
        $('#freq_pen_openai').attr('max', 1).attr('min', 0).val(oai_settings.freq_pen_openai).trigger('input');
    } else {
        $('#pres_pen_openai').attr('max', 2).attr('min', -2).val(oai_settings.pres_pen_openai).trigger('input');
        $('#freq_pen_openai').attr('max', 2).attr('min', -2).val(oai_settings.freq_pen_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.MOONSHOT) {
        const maxContext = getMoonshotMaxContext(oai_settings.moonshot_model, oai_settings.max_context_unlocked);
        $('#openai_max_context').attr('max', maxContext);
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        oai_settings.temp_openai = Math.min(claude_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', claude_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.FIREWORKS) {
        const maxContext = getFireworksMaxContext(oai_settings.fireworks_model, oai_settings.max_context_unlocked);
        $('#openai_max_context').attr('max', maxContext);
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        oai_settings.temp_openai = Math.min(oai_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.SILICONFLOW) {
        const maxContext = getSiliconflowMaxContext(oai_settings.siliconflow_model, oai_settings.max_context_unlocked);
        $('#openai_max_context').attr('max', maxContext);
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        oai_settings.temp_openai = Math.min(oai_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.MINIMAX) {
        const maxContext = oai_settings.minimax_model === 'M2-her' ? 65536 : 204800;
        $('#openai_max_context').attr('max', maxContext);
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        oai_settings.temp_openai = Math.min(claude_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', claude_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.ZAI) {
        const maxContext = getZaiMaxContext(oai_settings.zai_model, oai_settings.max_context_unlocked);
        $('#openai_max_context').attr('max', maxContext);
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        oai_settings.temp_openai = Math.min(claude_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', claude_max_temp).val(oai_settings.temp_openai).trigger('input');
    }
}

/**
 * 우리 것: 실리 onConnectButtonClick(6036~6098)의 값 부분 → { key: 그 소스의 키 이름 | null }: 연결 버튼이 getStatusOpen까지 가요(6095~6097) ·
 * null: 키가 없어서 가지 않아요(상태는 페이지 그대로).
 * 6037(화면 이벤트), 6076 toastr · 6090 console.log(서버는 plugin/st/nastatus.js가 한 번만), 6084~6087(입력 칸에 쓴 키 저장: 서버에는 입력 칸이 없어요.
 * 키는 실리가 secrets.json에 둔 것만: secret_state)은 빼요.
 */
export function __naConnectGate() {
// 실리 public/scripts/openai.js 6039~6075
    /** @type {Object.<string, {key: string, selector: string, proxy?: boolean, keyless?: boolean}>} */
    const apiSourceConfig = {
        [chat_completion_sources.OPENROUTER]: { key: SECRET_KEYS.OPENROUTER, selector: '#api_key_openrouter', proxy: false },
        [chat_completion_sources.MAKERSUITE]: { key: SECRET_KEYS.MAKERSUITE, selector: '#api_key_makersuite', proxy: true },
        [chat_completion_sources.CLAUDE]: { key: SECRET_KEYS.CLAUDE, selector: '#api_key_claude', proxy: true },
        [chat_completion_sources.OPENAI]: { key: SECRET_KEYS.OPENAI, selector: '#api_key_openai', proxy: true },
        [chat_completion_sources.AI21]: { key: SECRET_KEYS.AI21, selector: '#api_key_ai21', proxy: false },
        [chat_completion_sources.MISTRALAI]: { key: SECRET_KEYS.MISTRALAI, selector: '#api_key_mistralai', proxy: true },
        [chat_completion_sources.CUSTOM]: { key: SECRET_KEYS.CUSTOM, selector: '#api_key_custom', proxy: false, keyless: true },
        [chat_completion_sources.COHERE]: { key: SECRET_KEYS.COHERE, selector: '#api_key_cohere', proxy: false },
        [chat_completion_sources.PERPLEXITY]: { key: SECRET_KEYS.PERPLEXITY, selector: '#api_key_perplexity', proxy: false },
        [chat_completion_sources.GROQ]: { key: SECRET_KEYS.GROQ, selector: '#api_key_groq', proxy: false },
        [chat_completion_sources.SILICONFLOW]: { key: SECRET_KEYS.SILICONFLOW, selector: '#api_key_siliconflow', proxy: false },
        [chat_completion_sources.ELECTRONHUB]: { key: SECRET_KEYS.ELECTRONHUB, selector: '#api_key_electronhub', proxy: false },
        [chat_completion_sources.NANOGPT]: { key: SECRET_KEYS.NANOGPT, selector: '#api_key_nanogpt', proxy: false },
        [chat_completion_sources.DEEPSEEK]: { key: SECRET_KEYS.DEEPSEEK, selector: '#api_key_deepseek', proxy: true },
        [chat_completion_sources.XAI]: { key: SECRET_KEYS.XAI, selector: '#api_key_xai', proxy: true },
        [chat_completion_sources.AIMLAPI]: { key: SECRET_KEYS.AIMLAPI, selector: '#api_key_aimlapi', proxy: false },
        [chat_completion_sources.MOONSHOT]: { key: SECRET_KEYS.MOONSHOT, selector: '#api_key_moonshot', proxy: true },
        [chat_completion_sources.FIREWORKS]: { key: SECRET_KEYS.FIREWORKS, selector: '#api_key_fireworks', proxy: false },
        [chat_completion_sources.COMETAPI]: { key: SECRET_KEYS.COMETAPI, selector: '#api_key_cometapi', proxy: false },
        [chat_completion_sources.AZURE_OPENAI]: { key: SECRET_KEYS.AZURE_OPENAI, selector: '#api_key_azure_openai', proxy: false },
        [chat_completion_sources.ZAI]: { key: SECRET_KEYS.ZAI, selector: '#api_key_zai', proxy: true },
        [chat_completion_sources.CHUTES]: { key: SECRET_KEYS.CHUTES, selector: '#api_key_chutes', proxy: false },
        [chat_completion_sources.POLLINATIONS]: { key: SECRET_KEYS.POLLINATIONS, selector: '#api_key_pollinations', proxy: false, keyless: oai_settings.pollinations_endpoint === POLLINATIONS_ENDPOINT.ANONYMOUS },
        [chat_completion_sources.WORKERS_AI]: { key: SECRET_KEYS.WORKERS_AI, selector: '#api_key_workers_ai', proxy: false },
        [chat_completion_sources.MINIMAX]: { key: SECRET_KEYS.MINIMAX, selector: '#api_key_minimax', proxy: false },
    };

    // Vertex AI Express version - use API key
    if (oai_settings.vertexai_auth_mode === 'express') {
        apiSourceConfig[chat_completion_sources.VERTEXAI] = { key: SECRET_KEYS.VERTEXAI, selector: '#api_key_vertexai', proxy: true };
    }

    // Vertex AI Full version - use service account
    if (oai_settings.chat_completion_source === chat_completion_sources.VERTEXAI && oai_settings.vertexai_auth_mode === 'full') {
        if (!secret_state[SECRET_KEYS.VERTEXAI_SERVICE_ACCOUNT]) {
            // (실리 6076 toastr.error: 서비스 계정 JSON이 없어요)
            return null;
// 실리 public/scripts/openai.js 6078~6083
        }
    }

    // Other generic configs
    const config = apiSourceConfig[oai_settings.chat_completion_source];
    if (config) {
        // (실리 6084~6087: 입력 칸에 쓴 키 저장)
// 실리 public/scripts/openai.js 6088~6089

        if (!secret_state[config.key] && (!config.proxy || !oai_settings.reverse_proxy) && !config.keyless) {
            // (실리 6090 console.log: 그 소스의 키가 없어요)
            return null;
// 실리 public/scripts/openai.js 6092~6093
        }
    }

    return { key: config?.key ?? null };
}

// 우리 것: 실리 openai.js 초기화의 범위 칸 input 처리기(6776~6792 · 6824~6831)를 대역 $의 칸에 붙여요 (__naModelChangeRest가 칸을 새로 만들 때마다)
function __naRangeInputs() {
// 실리 public/scripts/openai.js 6776~6792
    $('#temp_openai').on('input', function () {
        oai_settings.temp_openai = Number($(this).val());
        $('#temp_counter_openai').val(Number($(this).val()).toFixed(2));
        saveSettingsDebounced();
    });

    $('#freq_pen_openai').on('input', function () {
        oai_settings.freq_pen_openai = Number($(this).val());
        $('#freq_pen_counter_openai').val(Number($(this).val()).toFixed(2));
        saveSettingsDebounced();
    });

    $('#pres_pen_openai').on('input', function () {
        oai_settings.pres_pen_openai = Number($(this).val());
        $('#pres_pen_counter_openai').val(Number($(this).val()).toFixed(2));
        saveSettingsDebounced();
    });
// 실리 public/scripts/openai.js 6824~6831
    $('#openai_max_context').on('input', function () {
        oai_settings.openai_max_context = Number($(this).val());
        $('#openai_max_context_counter').val(`${$(this).val()}`);
        calculateOpenRouterCost();
        calculateElectronHubCost();
        calculateChutesCost();
        saveSettingsDebounced();
    });
}

export { oai_settings, default_settings, migrateChatCompletionSettings, continue_postfix_types, biasCache, getStatusOpen, sortModelsBy, groupModelsByVendor, openrouter_website_model };

/**
 * 일꾼이 모듈 전역 값을 채워요. v에 있는 키만 바꿔요.
 * openai_settings · openai_setting_names는 실리 loadOpenAISettings 4321~4336의 값(프리셋 객체 배열 · {이름: 번호}).
 * saveModelList는 plugin/st/nastatus.js의 saveModelListValues(실리 saveModelList의 값 부분).
 * @param {{model_list?: object[], proxies?: object[], selected_proxy?: object, biasCache?: object, openai_settings?: object[], openai_setting_names?: object, saveModelList?: function}} v
 */
export function __naSet(v) {
    if (Object.hasOwn(v, 'model_list')) model_list = v.model_list;
    if (Object.hasOwn(v, 'proxies')) proxies = v.proxies;
    if (Object.hasOwn(v, 'selected_proxy')) selected_proxy = v.selected_proxy;
    if (Object.hasOwn(v, 'biasCache')) biasCache = v.biasCache;
    if (Object.hasOwn(v, 'openai_settings')) openai_settings = v.openai_settings;
    if (Object.hasOwn(v, 'openai_setting_names')) openai_setting_names = v.openai_setting_names;
    if (Object.hasOwn(v, 'saveModelList')) saveModelList = v.saveModelList;
}
