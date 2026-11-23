// 실리 1.19.1 public/scripts/textgen-settings.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움), 대역(localStorage · document(dynatemp_block_ooba) · toastr · sessionStorage(tokenizers.js의 대역을 같이 씀), 모델 목록 로더(실패를 실리 창에 적는 같은 이름의 함수)).
import { abortStatusCheck, getRequestHeaders, getStoppingStrings, main_api, max_context, online_status, resultCheckStatus, setOnlineStatus, substituteParams } from '../script.js';
import { t } from './i18n.js';
import { BIAS_CACHE, getLogitBiasListResult } from './logit-bias.js';
import { power_user } from './power-user.js';
import { getCurrentDreamGenModelTokenizer, getCurrentOpenRouterModelTokenizer } from './textgen-models.js';
import * as __naModels from './textgen-models.js';
import { ENCODE_TOKENIZERS, TEXTGEN_TOKENIZERS, TOKENIZER_SUPPORTED_KEY, getTextTokens, getTokenizerBestMatch, tokenizers, __naSessionStorage as sessionStorage } from './tokenizers.js';
import { onlyUnique, arraysEqual, isObject } from './utils.js';
import { naFetch as fetch } from '../naFetch.js';

// 우리 것: 실리 getStatusTextgen 691~726은 모델 목록 로더(async)를 await 없이 불러요. 로더 안의 오류(이름 없는 모델의 localeCompare 등)는
// 브라우저에서는 콘솔의 "Uncaught (in promise)" 한 줄뿐이고 페이지는 그대로 돌아요. Node에서는 처리 안 된 rejection이 일꾼 스레드를 끝내요.
// 그래서 같은 이름으로 감싸요: 로더는 그대로 부르고 돌려준 것을 그대로 돌려주되, Promise가 실패하면 실리 창에 적어요(같은 글은 한 번).
// 로더가 오류 전까지 바꾼 값은 실리처럼 그대로 남아요. async가 아닌 로더(loadGenericModels)의 오류는 실리처럼 그 자리에서 던져요(getStatusTextgen이 잡아요).
const __naTold = new Set();
/** 테스트용: 실리 창에 적은 글을 잊어요 (일꾼을 새로 띄운 것과 같아요) */
export const __naLooseReset = () => __naTold.clear();
const __naLoose = (name) => (...args) => {
    const p = __naModels[name](...args);
    if (typeof p?.catch !== 'function') return p;
    p.catch((err) => {
        const why = String(err?.message || err);
        if (__naTold.has(why)) return;
        if (__naTold.size >= 100) __naTold.delete(__naTold.values().next().value);
        __naTold.add(why);
        console.warn('[narrative-archive plugin]', `처리되지 않은 오류가 발생했습니다: ${why}`);
    });
    return p;
};
const loadAphroditeModels = __naLoose('loadAphroditeModels');
const loadDreamGenModels = __naLoose('loadDreamGenModels');
const loadFeatherlessModels = __naLoose('loadFeatherlessModels');
const loadGenericModels = __naLoose('loadGenericModels');
const loadInfermaticAIModels = __naLoose('loadInfermaticAIModels');
const loadLlamaCppModels = __naLoose('loadLlamaCppModels');
const loadMancerModels = __naLoose('loadMancerModels');
const loadOllamaModels = __naLoose('loadOllamaModels');
const loadOpenRouterModels = __naLoose('loadOpenRouterModels');
const loadTabbyModels = __naLoose('loadTabbyModels');
const loadTogetherAIModels = __naLoose('loadTogetherAIModels');
const loadVllmModels = __naLoose('loadVllmModels');

// 대역: 실리 localStorage(브라우저 저장). 실리 124줄 MANCER_SERVER는 거기 'mancer_server'(디버그 메뉴 'change-mancer-url'로만 바꿈)가 없으면
// 기본 주소예요. 서버에서는 그 브라우저 값을 읽을 수 없어서 늘 기본 주소(MANCER_SERVER_DEFAULT)예요.
const localStorage = { getItem: () => null };
// 대역: 실리 325줄 DYNATEMP_BLOCK은 화면의 #dynatemp_block_ooba예요. isDynamicTemperatureSupported는 그 data-tg-type만 읽어요.
// 그 값은 실리 index.html 1503줄 그대로: <div data-tg-type="ooba, mancer, koboldcpp, tabby, llamacpp, aphrodite" ... id="dynatemp_block_ooba">
const document = { getElementById: (id) => (id === 'dynatemp_block_ooba' ? { dataset: { tgType: 'ooba, mancer, koboldcpp, tabby, llamacpp, aphrodite' } } : null) };
// 대역: 실리 toastr(화면 알림). 서버는 실리 창 로그로만.
const toastr = { error: (...a) => console.warn('[narrative-archive plugin]', ...a) };

// 실리 public/scripts/textgen-settings.js 31~65
export const textgen_types = {
    OOBA: 'ooba',
    MANCER: 'mancer',
    VLLM: 'vllm',
    APHRODITE: 'aphrodite',
    TABBY: 'tabby',
    KOBOLDCPP: 'koboldcpp',
    TOGETHERAI: 'togetherai',
    LLAMACPP: 'llamacpp',
    OLLAMA: 'ollama',
    INFERMATICAI: 'infermaticai',
    DREAMGEN: 'dreamgen',
    OPENROUTER: 'openrouter',
    FEATHERLESS: 'featherless',
    HUGGINGFACE: 'huggingface',
    GENERIC: 'generic',
};

const {
    GENERIC,
    MANCER,
    VLLM,
    APHRODITE,
    TABBY,
    TOGETHERAI,
    OOBA,
    OLLAMA,
    LLAMACPP,
    INFERMATICAI,
    DREAMGEN,
    OPENROUTER,
    KOBOLDCPP,
    HUGGINGFACE,
    FEATHERLESS,
} = textgen_types;

// 실리 public/scripts/textgen-settings.js 67~117
const LLAMACPP_DEFAULT_ORDER = [
    'penalties',
    'dry',
    'top_n_sigma',
    'top_k',
    'typ_p',
    'top_p',
    'min_p',
    'xtc',
    'temperature',
    'adaptive_p',
];
const OOBA_DEFAULT_ORDER = [
    'repetition_penalty',
    'presence_penalty',
    'frequency_penalty',
    'dry',
    'temperature',
    'dynamic_temperature',
    'quadratic_sampling',
    'top_n_sigma',
    'top_k',
    'top_p',
    'typical_p',
    'epsilon_cutoff',
    'eta_cutoff',
    'tfs',
    'top_a',
    'min_p',
    'adaptive_p',
    'mirostat',
    'xtc',
    'encoder_repetition_penalty',
    'no_repeat_ngram',
];
export const APHRODITE_DEFAULT_ORDER = [
    'dry',
    'penalties',
    'no_repeat_ngram',
    'temperature',
    'top_nsigma',
    'top_p_top_k',
    'top_a',
    'min_p',
    'tfs',
    'eta_cutoff',
    'epsilon_cutoff',
    'typical_p',
    'quadratic',
    'xtc',
];

// 실리 public/scripts/textgen-settings.js 118~130
const BIAS_KEY = '#textgenerationwebui_api-settings';

// Maybe let it be configurable in the future?
// (7 days later) The future has come.
const MANCER_SERVER_KEY = 'mancer_server';
const MANCER_SERVER_DEFAULT = 'https://neuro.mancer.tech';
export let MANCER_SERVER = localStorage.getItem(MANCER_SERVER_KEY) ?? MANCER_SERVER_DEFAULT;
export let TOGETHERAI_SERVER = 'https://api.together.xyz';
export let INFERMATICAI_SERVER = 'https://api.totalgpt.ai';
export let DREAMGEN_SERVER = 'https://dreamgen.com';
export let OPENROUTER_SERVER = 'https://openrouter.ai/api';
export let FEATHERLESS_SERVER = 'https://api.featherless.ai/v1';


// 실리 public/scripts/textgen-settings.js 131~141
export const SERVER_INPUTS = {
    [textgen_types.OOBA]: '#textgenerationwebui_api_url_text',
    [textgen_types.VLLM]: '#vllm_api_url_text',
    [textgen_types.APHRODITE]: '#aphrodite_api_url_text',
    [textgen_types.TABBY]: '#tabby_api_url_text',
    [textgen_types.KOBOLDCPP]: '#koboldcpp_api_url_text',
    [textgen_types.LLAMACPP]: '#llamacpp_api_url_text',
    [textgen_types.OLLAMA]: '#ollama_api_url_text',
    [textgen_types.HUGGINGFACE]: '#huggingface_api_url_text',
    [textgen_types.GENERIC]: '#generic_api_url_text',
};

// 실리 public/scripts/textgen-settings.js 143~237
const KOBOLDCPP_ORDER = [6, 0, 1, 3, 4, 2, 5];
export const textgenerationwebui_settings = {
    temp: 0.7,
    temperature_last: true,
    top_p: 0.5,
    top_k: 40,
    top_a: 0,
    tfs: 1,
    epsilon_cutoff: 0,
    eta_cutoff: 0,
    typical_p: 1,
    min_p: 0,
    rep_pen: 1.2,
    rep_pen_range: 0,
    rep_pen_decay: 0,
    rep_pen_slope: 1,
    no_repeat_ngram_size: 0,
    penalty_alpha: 0,
    num_beams: 1,
    length_penalty: 1,
    min_length: 0,
    encoder_rep_pen: 1,
    freq_pen: 0,
    presence_pen: 0,
    skew: 0,
    do_sample: true,
    early_stopping: false,
    dynatemp: false,
    min_temp: 0,
    max_temp: 2.0,
    dynatemp_exponent: 1.0,
    smoothing_factor: 0.0,
    smoothing_curve: 1.0,
    dry_allowed_length: 2,
    dry_multiplier: 0.0,
    dry_base: 1.75,
    dry_sequence_breakers: '["\\n", ":", "\\"", "*"]',
    dry_penalty_last_n: 0,
    max_tokens_second: 0,
    seed: -1,
    preset: 'Default',
    add_bos_token: true,
    stopping_strings: [],
    //truncation_length: 2048,
    ban_eos_token: false,
    skip_special_tokens: true,
    include_reasoning: true,
    streaming: false,
    mirostat_mode: 0,
    mirostat_tau: 5,
    mirostat_eta: 0.1,
    guidance_scale: 1,
    negative_prompt: '',
    grammar_string: '',
    json_schema: null,
    json_schema_allow_empty: false,
    banned_tokens: '',
    global_banned_tokens: '',
    send_banned_tokens: true,
    sampler_priority: OOBA_DEFAULT_ORDER,
    samplers: LLAMACPP_DEFAULT_ORDER,
    samplers_priorities: APHRODITE_DEFAULT_ORDER,
    ignore_eos_token: false,
    spaces_between_special_tokens: true,
    speculative_ngram: false,
    type: textgen_types.OOBA,
    mancer_model: 'mytholite',
    togetherai_model: 'Gryphe/MythoMax-L2-13b',
    infermaticai_model: '',
    ollama_model: '',
    openrouter_model: 'openrouter/auto',
    openrouter_providers: [],
    openrouter_quantizations: [],
    vllm_model: '',
    aphrodite_model: '',
    dreamgen_model: 'lucid-v1-extra-large/text',
    tabby_model: '',
    llamacpp_model: '',
    sampler_order: KOBOLDCPP_ORDER,
    logit_bias: [],
    n: 1,
    server_urls: {},
    custom_model: '',
    bypass_status_check: false,
    openrouter_allow_fallbacks: true,
    xtc_threshold: 0.1,
    xtc_probability: 0,
    nsigma: 0.0,
    min_keep: 0,
    featherless_model: '',
    generic_model: '',
    extensions: {},
    adaptive_target: -0.01,
    adaptive_decay: 0.9,
};

// 실리 public/scripts/textgen-settings.js 243~246
export let textgenerationwebui_banned_in_macros = [];

export let textgenerationwebui_presets = [];
export let textgenerationwebui_preset_names = [];

// 실리 public/scripts/textgen-settings.js 248~323
export const setting_names = [
    'temp',
    'temperature_last',
    'rep_pen',
    'rep_pen_range',
    'rep_pen_decay',
    'rep_pen_slope',
    'no_repeat_ngram_size',
    'top_k',
    'top_p',
    'top_a',
    'tfs',
    'epsilon_cutoff',
    'eta_cutoff',
    'typical_p',
    'min_p',
    'penalty_alpha',
    'num_beams',
    'length_penalty',
    'min_length',
    'dynatemp',
    'min_temp',
    'max_temp',
    'dynatemp_exponent',
    'smoothing_factor',
    'smoothing_curve',
    'dry_allowed_length',
    'dry_multiplier',
    'dry_base',
    'dry_sequence_breakers',
    'dry_penalty_last_n',
    'max_tokens_second',
    'encoder_rep_pen',
    'freq_pen',
    'presence_pen',
    'skew',
    'do_sample',
    'early_stopping',
    'seed',
    'add_bos_token',
    'ban_eos_token',
    'skip_special_tokens',
    'include_reasoning',
    'streaming',
    'mirostat_mode',
    'mirostat_tau',
    'mirostat_eta',
    'guidance_scale',
    'negative_prompt',
    'grammar_string',
    'json_schema',
    'banned_tokens',
    'global_banned_tokens',
    'send_banned_tokens',
    'ignore_eos_token',
    'spaces_between_special_tokens',
    'speculative_ngram',
    'sampler_order',
    'sampler_priority',
    'samplers',
    'samplers_priorities',
    'n',
    'logit_bias',
    'custom_model',
    'bypass_status_check',
    'openrouter_allow_fallbacks',
    'xtc_threshold',
    'xtc_probability',
    'nsigma',
    'min_keep',
    'generic_model',
    'extensions',
    'json_schema_allow_empty',
    'adaptive_target',
    'adaptive_decay',
];

// 실리 public/scripts/textgen-settings.js 325~325
const DYNATEMP_BLOCK = document.getElementById('dynatemp_block_ooba');

// 실리 public/scripts/textgen-settings.js 346~369
/**
 * Gets the API URL for the selected text generation type.
 * @param {string} type If it's set, ignores active type
 * @returns {string} API URL
 */
export function getTextGenServer(type = null) {
    const selectedType = type ?? textgenerationwebui_settings.type;
    switch (selectedType) {
        case FEATHERLESS:
            return FEATHERLESS_SERVER;
        case MANCER:
            return MANCER_SERVER;
        case TOGETHERAI:
            return TOGETHERAI_SERVER;
        case INFERMATICAI:
            return INFERMATICAI_SERVER;
        case DREAMGEN:
            return DREAMGEN_SERVER;
        case OPENROUTER:
            return OPENROUTER_SERVER;
        default:
            return textgenerationwebui_settings.server_urls[selectedType] ?? '';
    }
}

// 실리 public/scripts/textgen-settings.js 404~499
function convertPresets(presets) {
    return Array.isArray(presets) ? presets.map((p) => JSON.parse(p)) : [];
}

function getTokenizerForTokenIds() {
    const bestMatchTokenizer = getTokenizerBestMatch('textgenerationwebui');
    if (bestMatchTokenizer === tokenizers.API_TEXTGENERATIONWEBUI) {
        return tokenizers.API_CURRENT;
    }

    if (power_user.tokenizer === tokenizers.API_CURRENT && TEXTGEN_TOKENIZERS.includes(textgenerationwebui_settings.type)) {
        return tokenizers.API_CURRENT;
    }

    if (ENCODE_TOKENIZERS.includes(power_user.tokenizer)) {
        return power_user.tokenizer;
    }

    if (textgenerationwebui_settings.type === OPENROUTER) {
        return getCurrentOpenRouterModelTokenizer();
    }

    if (textgenerationwebui_settings.type === DREAMGEN) {
        return getCurrentDreamGenModelTokenizer();
    }

    return tokenizers.LLAMA;
}

/**
 * Gets the custom token bans from settings and macros.
 * @param {TextCompletionSettings} settings Text completion settings to use
 * @typedef {{banned_tokens: string, banned_strings: string[]}} TokenBanResult
 * @returns {TokenBanResult} String with comma-separated banned token IDs
 */
function getCustomTokenBans(settings = null) {
    settings = settings ?? textgenerationwebui_settings;
    if (!settings.send_banned_tokens || (!settings.banned_tokens && !settings.global_banned_tokens && !textgenerationwebui_banned_in_macros.length)) {
        return {
            banned_tokens: '',
            banned_strings: [],
        };
    }

    const tokenizer = getTokenizerForTokenIds();
    const banned_tokens = [];
    const banned_strings = [];
    const sequences = []
        .concat(settings.banned_tokens.split('\n'))
        .concat(settings.global_banned_tokens.split('\n'))
        .concat(textgenerationwebui_banned_in_macros)
        .filter(x => x.length > 0)
        .filter(onlyUnique)
        .map(x => substituteParams(x));

    //debug
    if (textgenerationwebui_banned_in_macros.length) {
        console.log('=== Found banned word sequences in the macros:', textgenerationwebui_banned_in_macros, 'Resulting array of banned sequences (will be used this generation turn):', sequences);
    }

    //clean old temporary bans found in macros before, for the next generation turn.
    textgenerationwebui_banned_in_macros = [];

    for (const line of sequences) {
        // Raw token ids, JSON serialized
        if (line.startsWith('[') && line.endsWith(']')) {
            try {
                const tokens = JSON.parse(line);

                if (Array.isArray(tokens) && tokens.every(t => Number.isInteger(t))) {
                    banned_tokens.push(...tokens);
                } else {
                    throw new Error('Not an array of integers');
                }
            } catch (err) {
                console.log(`Failed to parse bad word token list: ${line}`, err);
            }
        } else if (line.startsWith('"') && line.endsWith('"')) {
            // Remove the enclosing quotes

            banned_strings.push(line.slice(1, -1));
        } else {
            try {
                const tokens = getTextTokens(tokenizer, line);
                banned_tokens.push(...tokens);
            } catch {
                console.log(`Could not tokenize raw text: ${line}`);
            }
        }
    }

    return {
        banned_tokens: banned_tokens.filter(onlyUnique).map(x => String(x)).join(','),
        banned_strings: banned_strings,
    };
}

// 실리 public/scripts/textgen-settings.js 513~550
/**
 * Calculates logit bias object from the logit bias list.
 * @param {TextCompletionSettings} settings Text completion settings
 * @returns {object} Logit bias object
 */
function calculateLogitBias(settings = null) {
    settings = settings ?? textgenerationwebui_settings;

    if (!Array.isArray(settings.logit_bias) || settings.logit_bias.length === 0) {
        return {};
    }

    const tokenizer = getTokenizerForTokenIds();
    const result = {};

    /**
     * Adds bias to the logit bias object.
     * @param {number} bias
     * @param {number[]} sequence
     * @returns {object} Accumulated logit bias object
     */
    function addBias(bias, sequence) {
        if (sequence.length === 0) {
            return;
        }

        for (const logit of sequence) {
            const key = String(logit);
            result[key] = bias;
        }

        return result;
    }

    getLogitBiasListResult(settings.logit_bias, tokenizer, addBias);

    return result;
}

// 실리 public/scripts/textgen-settings.js 659~664
async function getStatusTextgen() {
    const url = '/api/backends/text-completions/status';

    const endpoint = getTextGenServer();

    if (!endpoint) {
        // (실리 665 console.warn('No endpoint for status check'): 서버는 plugin/st/nastatus.js가 한 번만 "상태를 확인할 주소가 없습니다.")
// 실리 public/scripts/textgen-settings.js 666~736
        setOnlineStatus('no_connection');
        return resultCheckStatus();
    }

    // Clear logit bias cache
    BIAS_CACHE.delete(BIAS_KEY);

    if ([textgen_types.GENERIC, textgen_types.OOBA].includes(textgenerationwebui_settings.type) && textgenerationwebui_settings.bypass_status_check) {
        setOnlineStatus(t`Status check bypassed`);
        return resultCheckStatus();
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                api_server: endpoint,
                api_type: textgenerationwebui_settings.type,
            }),
            signal: abortStatusCheck.signal,
        });

        const data = await response.json();

        if (textgenerationwebui_settings.type === textgen_types.MANCER) {
            loadMancerModels(data?.data);
            setOnlineStatus(textgenerationwebui_settings.mancer_model);
        } else if (textgenerationwebui_settings.type === textgen_types.TOGETHERAI) {
            loadTogetherAIModels(data?.data);
            setOnlineStatus(textgenerationwebui_settings.togetherai_model);
        } else if (textgenerationwebui_settings.type === textgen_types.OLLAMA) {
            loadOllamaModels(data?.data);
            setOnlineStatus(textgenerationwebui_settings.ollama_model || t`Connected`);
        } else if (textgenerationwebui_settings.type === textgen_types.INFERMATICAI) {
            loadInfermaticAIModels(data?.data);
            setOnlineStatus(textgenerationwebui_settings.infermaticai_model);
        } else if (textgenerationwebui_settings.type === textgen_types.DREAMGEN) {
            loadDreamGenModels(data?.data);
            setOnlineStatus(textgenerationwebui_settings.dreamgen_model);
        } else if (textgenerationwebui_settings.type === textgen_types.OPENROUTER) {
            loadOpenRouterModels(data?.data);
            setOnlineStatus(textgenerationwebui_settings.openrouter_model);
        } else if (textgenerationwebui_settings.type === textgen_types.VLLM) {
            loadVllmModels(data?.data);
            setOnlineStatus(textgenerationwebui_settings.vllm_model);
        } else if (textgenerationwebui_settings.type === textgen_types.APHRODITE) {
            loadAphroditeModels(data?.data);
            setOnlineStatus(textgenerationwebui_settings.aphrodite_model);
        } else if (textgenerationwebui_settings.type === textgen_types.FEATHERLESS) {
            loadFeatherlessModels(data?.data);
            setOnlineStatus(textgenerationwebui_settings.featherless_model);
        } else if (textgenerationwebui_settings.type === textgen_types.TABBY) {
            loadTabbyModels(data?.data);
            setOnlineStatus(textgenerationwebui_settings.tabby_model || data?.result);
        } else if (textgenerationwebui_settings.type === textgen_types.LLAMACPP) {
            loadLlamaCppModels(data?.data);
            setOnlineStatus(textgenerationwebui_settings.llamacpp_model || data?.result || t`Connected`);
        } else if (textgenerationwebui_settings.type === textgen_types.GENERIC) {
            loadGenericModels(data?.data);
            setOnlineStatus(textgenerationwebui_settings.generic_model || data?.result || t`Connected`);
        } else {
            setOnlineStatus(data?.result);
        }

        if (!online_status) {
            setOnlineStatus('no_connection');
        }

        power_user.chat_template_hash = '';

        // (실리 737~738 autoSelectInstructPreset: 지시 형식 · 문맥 프리셋 자동 고르기. 브라우저가 고르고 settings.json에 저장해요. 서버는 그 값을 써요)
// 실리 public/scripts/textgen-settings.js 739~742

        const supportsTokenization = response.headers.get('x-supports-tokenization') === 'true';
        supportsTokenization ? sessionStorage.setItem(TOKENIZER_SUPPORTED_KEY, 'true') : sessionStorage.removeItem(TOKENIZER_SUPPORTED_KEY);

        // (실리 743~795: koboldcpp · llama.cpp의 /props로 채팅 틀 · 문맥 크기 · 프리셋 고르기. 브라우저가 settings.json에 저장해요. 서버는 그 값을 써요)
        // (실리 797~800: 화면 알림)
// 실리 public/scripts/textgen-settings.js 801~801
    } catch (err) {
        // (실리 802~806 console.info · console.error: 서버는 plugin/st/nastatus.js가 한 번만 "상태를 가져오는 중 오류가 발생했습니다.")
// 실리 public/scripts/textgen-settings.js 807~811
        setOnlineStatus('no_connection');
    }

    return resultCheckStatus();
}

// 실리 public/scripts/textgen-settings.js 1180~1197
/**
 * Inserts missing items from the source array into the target array.
 * @param {any[]} source - Source array
 * @param {any[]} target - Target array
 * @returns {void}
 */
function insertMissingArrayItems(source, target) {
    if (source === target || !Array.isArray(source) || !Array.isArray(target)) {
        return;
    }

    for (const item of source) {
        if (!target.includes(item)) {
            const index = source.indexOf(item);
            target.splice(index, 0, item);
        }
    }
}

// 실리 public/scripts/textgen-settings.js 1447~1458
/**
 * Converts a string of comma-separated integers to an array of integers.
 * @param {string} string Input string
 * @returns {number[]} Array of integers
 */
function toIntArray(string) {
    if (!string) {
        return [];
    }

    return string.split(',').map(x => parseInt(x)).filter(x => !isNaN(x));
}

// 실리 public/scripts/textgen-settings.js 1460~1545
/**
 * Gets the text generation model specified by the given text completion settings
 * @param {TextCompletionSettings} settings Text completion settings to use
 * @returns {string} model name
 */
export function getTextGenModel(settings = null) {
    settings = settings ?? textgenerationwebui_settings;
    switch (settings.type) {
        case OOBA:
            if (settings.custom_model) {
                return settings.custom_model;
            }
            break;
        case GENERIC:
            if (settings.generic_model) {
                return settings.generic_model;
            }
            break;
        case MANCER:
            return settings.mancer_model;
        case TOGETHERAI:
            return settings.togetherai_model;
        case INFERMATICAI:
            return settings.infermaticai_model;
        case DREAMGEN:
            return settings.dreamgen_model;
        case OPENROUTER:
            return settings.openrouter_model;
        case VLLM:
            return settings.vllm_model;
        case APHRODITE:
            return settings.aphrodite_model;
        case OLLAMA:
            if (!settings.ollama_model) {
                toastr.error(t`No Ollama model selected.`, 'Text Completion API');
                throw new Error('No Ollama model selected');
            }
            return settings.ollama_model;
        case FEATHERLESS:
            return settings.featherless_model;
        case HUGGINGFACE:
            return 'tgi';
        case TABBY:
            if (settings.tabby_model) {
                return settings.tabby_model;
            }
            break;
        case LLAMACPP:
            if (settings.llamacpp_model) {
                return settings.llamacpp_model;
            }
            break;
        default:
            return undefined;
    }

    return undefined;
}

export function isJsonSchemaSupported() {
    return [TABBY, LLAMACPP].includes(textgenerationwebui_settings.type) && main_api === 'textgenerationwebui';
}

/**
 * Returns whether dynamic temperature is supported by the given text completion settings
 * @param {TextCompletionSettings} settings Text completion settings to use
 * @returns {boolean} Whether dynamic temperature supported
 */
function isDynamicTemperatureSupported(settings = null) {
    settings = settings ?? textgenerationwebui_settings;
    return settings.dynatemp && DYNATEMP_BLOCK?.dataset?.tgType?.includes(settings.type);
}

/**
 * Gets the number of logprobs to request based on the selected type.
 * @param {string} type If it's set, ignores active type
 * @returns {number} Number of logprobs to request
 */
export function getLogprobsNumber(type = null) {
    const selectedType = type ?? textgenerationwebui_settings.type;
    if (selectedType === VLLM || selectedType === INFERMATICAI) {
        return 5;
    }

    return 10;
}

// 실리 public/scripts/textgen-settings.js 1547~1842
/**
 * Replaces {{macro}} in a comma-separated or serialized JSON array string.
 * @param {string} str Input string
 * @returns {string} Output string
 */
export function replaceMacrosInList(str) {
    if (!str || typeof str !== 'string') {
        return str;
    }

    try {
        const array = JSON.parse(str);
        if (!Array.isArray(array)) {
            throw new Error('Not an array');
        }
        for (let i = 0; i < array.length; i++) {
            array[i] = substituteParams(array[i]);
        }
        return JSON.stringify(array);
    } catch {
        const array = str.split(',');
        for (let i = 0; i < array.length; i++) {
            array[i] = substituteParams(array[i]);
        }
        return array.join(',');
    }
}

/**
 * Build the generation parameter object for an text completion request
 * @param {TextCompletionSettings} settings Text completion settings to use
 * @param {string} model Model to use
 * @param {string} finalPrompt The final prompt to send
 * @param {number} maxTokens Max allowed generation tokens
 * @param {boolean} isImpersonate Whether this is for an impersonation
 * @param {boolean} isContinue Whether this is for a continue
 * @param {object} cfgValues Additional parameters (guidanceScale, negativePrompt)
 * @param {string} type Request type (impersonate, quiet, continue, etc)
 * @returns {object} Final generation parameters object appropriate for the text completion source
 */
export function createTextGenGenerationData(settings, model, finalPrompt = null, maxTokens = null, isImpersonate = false, isContinue = false, cfgValues = null, type = 'quiet') {
    settings = settings ?? textgenerationwebui_settings;
    model = model ?? getTextGenModel(settings);

    const canMultiSwipe = !isContinue && !isImpersonate && type !== 'quiet';
    const dynatemp = isDynamicTemperatureSupported(settings);
    const { banned_tokens, banned_strings } = getCustomTokenBans(settings);
    const jsonSchema = isObject(settings.json_schema)
        ? settings.json_schema_allow_empty
            ? settings.json_schema
            : Object.keys(settings.json_schema).length > 0 ? settings.json_schema : undefined
        : undefined;

    let params = {
        'prompt': finalPrompt,
        'model': model,
        'max_new_tokens': maxTokens,
        'max_tokens': maxTokens,
        'logprobs': power_user.request_token_probabilities ? getLogprobsNumber(settings.type) : undefined,
        'temperature': dynatemp ? (settings.min_temp + settings.max_temp) / 2 : settings.temp,
        'top_p': settings.top_p,
        'typical_p': settings.typical_p,
        'typical': settings.typical_p,
        'sampler_seed': settings.seed >= 0 ? settings.seed : undefined,
        'min_p': settings.min_p,
        'repetition_penalty': settings.rep_pen,
        'frequency_penalty': settings.freq_pen,
        'presence_penalty': settings.presence_pen,
        'top_k': settings.top_k,
        'skew': settings.skew,
        'min_length': settings.type === OOBA ? settings.min_length : undefined,
        'minimum_message_content_tokens': settings.type === DREAMGEN ? settings.min_length : undefined,
        'min_tokens': settings.min_length,
        'num_beams': settings.type === OOBA ? settings.num_beams : undefined,
        'length_penalty': settings.type === OOBA ? settings.length_penalty : undefined,
        'early_stopping': settings.type === OOBA ? settings.early_stopping : undefined,
        'add_bos_token': settings.add_bos_token,
        'dynamic_temperature': dynatemp ? true : undefined,
        'dynatemp_low': dynatemp ? settings.min_temp : undefined,
        'dynatemp_high': dynatemp ? settings.max_temp : undefined,
        'dynatemp_range': dynatemp ? (settings.max_temp - settings.min_temp) / 2 : undefined,
        'dynatemp_exponent': dynatemp ? settings.dynatemp_exponent : undefined,
        'smoothing_factor': settings.smoothing_factor,
        'smoothing_curve': settings.smoothing_curve,
        'dry_allowed_length': settings.dry_allowed_length,
        'dry_multiplier': settings.dry_multiplier,
        'dry_base': settings.dry_base,
        'dry_sequence_breakers': replaceMacrosInList(settings.dry_sequence_breakers),
        'dry_penalty_last_n': settings.dry_penalty_last_n,
        'max_tokens_second': settings.max_tokens_second,
        'sampler_priority': settings.type === OOBA ? settings.sampler_priority : undefined,
        'samplers': settings.type === LLAMACPP ? settings.samplers : undefined,
        'stopping_strings': getStoppingStrings(isImpersonate, isContinue),
        'stop': getStoppingStrings(isImpersonate, isContinue),
        'truncation_length': max_context,
        'ban_eos_token': settings.ban_eos_token,
        'skip_special_tokens': settings.skip_special_tokens,
        'include_reasoning': settings.include_reasoning,
        'top_a': settings.top_a,
        'tfs': settings.tfs,
        'epsilon_cutoff': [OOBA, MANCER].includes(settings.type) ? settings.epsilon_cutoff : undefined,
        'eta_cutoff': [OOBA, MANCER].includes(settings.type) ? settings.eta_cutoff : undefined,
        'mirostat_mode': settings.mirostat_mode,
        'mirostat_tau': settings.mirostat_tau,
        'mirostat_eta': settings.mirostat_eta,
        'custom_token_bans': [APHRODITE, MANCER].includes(settings.type) ?
            toIntArray(banned_tokens) :
            banned_tokens,
        'banned_strings': banned_strings,
        'api_type': settings.type,
        'api_server': getTextGenServer(settings.type),
        'sampler_order': settings.type === textgen_types.KOBOLDCPP ? settings.sampler_order : undefined,
        'xtc_threshold': settings.xtc_threshold,
        'xtc_probability': settings.xtc_probability,
        'nsigma': settings.nsigma,
        'top_n_sigma': settings.nsigma,
        'min_keep': settings.min_keep,
        'adaptive_target': settings.adaptive_target,
        'adaptive_decay': settings.adaptive_decay,
        parseSequenceBreakers: function () {
            try {
                return JSON.parse(this.dry_sequence_breakers);
            } catch {
                if (typeof this.dry_sequence_breakers === 'string') {
                    return this.dry_sequence_breakers.split(',');
                }
                return undefined;
            }
        },
    };
    const nonAphroditeParams = {
        'rep_pen': settings.rep_pen,
        'rep_pen_range': settings.rep_pen_range,
        'repetition_decay': settings.type === TABBY ? settings.rep_pen_decay : undefined,
        'repetition_penalty_range': settings.rep_pen_range,
        'encoder_repetition_penalty': settings.type === OOBA ? settings.encoder_rep_pen : undefined,
        'no_repeat_ngram_size': settings.type === OOBA ? settings.no_repeat_ngram_size : undefined,
        'penalty_alpha': settings.type === OOBA ? settings.penalty_alpha : undefined,
        'temperature_last': (settings.type === OOBA || settings.type === APHRODITE || settings.type == TABBY) ? settings.temperature_last : undefined,
        'speculative_ngram': settings.type === TABBY ? settings.speculative_ngram : undefined,
        'do_sample': settings.type === OOBA ? settings.do_sample : undefined,
        'seed': settings.seed >= 0 ? settings.seed : undefined,
        'guidance_scale': cfgValues?.guidanceScale?.value ?? settings.guidance_scale ?? 1,
        'negative_prompt': cfgValues?.negativePrompt ?? substituteParams(settings.negative_prompt) ?? '',
        'grammar_string': settings.grammar_string || undefined,
        'json_schema': [TABBY, LLAMACPP].includes(settings.type) ? jsonSchema : undefined,
        // llama.cpp aliases. In case someone wants to use LM Studio as Text Completion API
        'repeat_penalty': settings.rep_pen,
        'repeat_last_n': settings.rep_pen_range,
        'n_predict': maxTokens,
        'num_predict': maxTokens,
        'num_ctx': max_context,
        'mirostat': settings.mirostat_mode,
        'ignore_eos': settings.ban_eos_token,
        'n_probs': power_user.request_token_probabilities ? 10 : undefined,
        'rep_pen_slope': settings.rep_pen_slope,
    };
    const vllmParams = {
        'n': canMultiSwipe ? settings.n : 1,
        'ignore_eos': settings.ignore_eos_token,
        'spaces_between_special_tokens': settings.spaces_between_special_tokens,
        'seed': settings.seed >= 0 ? settings.seed : undefined,
    };
    const aphroditeParams = {
        'n': canMultiSwipe ? settings.n : 1,
        'frequency_penalty': settings.freq_pen,
        'presence_penalty': settings.presence_pen,
        'repetition_penalty': settings.rep_pen,
        'seed': settings.seed >= 0 ? settings.seed : undefined,
        'stop': getStoppingStrings(isImpersonate, isContinue),
        'temperature': dynatemp ? (settings.min_temp + settings.max_temp) / 2 : settings.temp,
        'temperature_last': settings.temperature_last,
        'top_p': settings.top_p,
        'top_k': settings.top_k,
        'top_a': settings.top_a,
        'min_p': settings.min_p,
        'tfs': settings.tfs,
        'eta_cutoff': settings.eta_cutoff,
        'epsilon_cutoff': settings.epsilon_cutoff,
        'typical_p': settings.typical_p,
        'smoothing_factor': settings.smoothing_factor,
        'smoothing_curve': settings.smoothing_curve,
        'ignore_eos': settings.ignore_eos_token,
        'min_tokens': settings.min_length,
        'skip_special_tokens': settings.skip_special_tokens,
        'spaces_between_special_tokens': settings.spaces_between_special_tokens,
        'guided_grammar': settings.grammar_string || undefined,
        'guided_json': jsonSchema || undefined,
        'early_stopping': false, // hacks
        'include_stop_str_in_output': false,
        'dynatemp_min': dynatemp ? settings.min_temp : undefined,
        'dynatemp_max': dynatemp ? settings.max_temp : undefined,
        'dynatemp_exponent': dynatemp ? settings.dynatemp_exponent : undefined,
        'xtc_threshold': settings.xtc_threshold,
        'xtc_probability': settings.xtc_probability,
        'nsigma': settings.nsigma,
        'custom_token_bans': toIntArray(banned_tokens),
        'no_repeat_ngram_size': settings.no_repeat_ngram_size,
        'sampler_priority': settings.type === APHRODITE && !arraysEqual(
            settings.samplers_priorities,
            APHRODITE_DEFAULT_ORDER)
            ? settings.samplers_priorities
            : undefined,
    };

    if (settings.type === OPENROUTER) {
        params.provider = settings.openrouter_providers;
        params.quantizations = settings.openrouter_quantizations;
        params.allow_fallbacks = settings.openrouter_allow_fallbacks;
    }

    if (settings.type === KOBOLDCPP) {
        params.grammar = settings.grammar_string || undefined;
        params.grammar_retain_state = (settings.grammar_string && !!isContinue) ? true : undefined;
        params.trim_stop = true;
        params.dry_sequence_breakers = params.parseSequenceBreakers();
    }

    if (settings.type === HUGGINGFACE) {
        params.top_p = Math.min(Math.max(Number(params.top_p), 0.0), 0.999);
        params.stop = Array.isArray(params.stop) ? params.stop.slice(0, 4) : [];
        nonAphroditeParams.seed = settings.seed >= 0 ? settings.seed : Math.floor(Math.random() * Math.pow(2, 32));
    }

    if (settings.type === MANCER) {
        params.n = canMultiSwipe ? settings.n : 1;
        params.epsilon_cutoff /= 1000;
        params.eta_cutoff /= 1000;
        params.dynatemp_mode = params.dynamic_temperature ? 1 : 0;
        params.dynatemp_min = params.dynatemp_low;
        params.dynatemp_max = params.dynatemp_high;
        delete params.dynatemp_low;
        delete params.dynatemp_high;
        params.dry_sequence_breakers = params.parseSequenceBreakers();
    }

    if (settings.type === TABBY || settings.type === LLAMACPP) {
        params.n = canMultiSwipe ? settings.n : 1;
    }

    switch (settings.type) {
        case VLLM:
        case INFERMATICAI:
            params = Object.assign(params, vllmParams);
            break;

        case APHRODITE:
            // set params to aphroditeParams
            params = Object.assign(params, aphroditeParams);
            break;

        default:
            params = Object.assign(params, nonAphroditeParams);
            break;
    }

    if (Array.isArray(settings.logit_bias) && settings.logit_bias.length) {
        const logitBias = BIAS_CACHE.get(BIAS_KEY) || calculateLogitBias(settings);
        BIAS_CACHE.set(BIAS_KEY, logitBias);
        params.logit_bias = logitBias;
    }

    if (settings.type === LLAMACPP || settings.type === OLLAMA) {
        // Convert bias and token bans to array of arrays
        const logitBiasArray = (params.logit_bias && typeof params.logit_bias === 'object' && Object.keys(params.logit_bias).length > 0)
            ? Object.entries(params.logit_bias).map(([key, value]) => [Number(key), value])
            : [];
        const tokenBans = toIntArray(banned_tokens);
        logitBiasArray.push(...tokenBans.map(x => [Number(x), false]));
        const sequenceBreakers = params.parseSequenceBreakers();
        const llamaCppParams = {
            'logit_bias': logitBiasArray,
            // Conflicts with ooba's grammar_string
            'grammar': settings.grammar_string,
            'cache_prompt': true,
            'dry_sequence_breakers': sequenceBreakers,
        };
        params = Object.assign(params, llamaCppParams);
        if (!Array.isArray(sequenceBreakers) || sequenceBreakers.length === 0) {
            delete params.dry_sequence_breakers;
        }
    }

    // Grammar conflicts with with json_schema
    if ([LLAMACPP, APHRODITE].includes(settings.type)) {
        if (jsonSchema) {
            delete params.grammar_string;
            delete params.grammar;
            delete params.guided_grammar;
        } else {
            delete params.json_schema;
            delete params.guided_json;
        }
    }
    return params;
}

// (실리 파일 안에서만 쓰는 이름들: 일꾼이 loadTextGenSettings 552~608의 값 부분을 따라 할 때 써요, plugin/st/naload.js. getStatusTextgen은 plugin/st/nastatus.js가 불러요)
export { KOBOLDCPP_ORDER, OOBA_DEFAULT_ORDER, LLAMACPP_DEFAULT_ORDER, BIAS_KEY, MANCER, convertPresets, insertMissingArrayItems, getStatusTextgen };

const __naDefault_textgenerationwebui_settings = structuredClone(textgenerationwebui_settings);

/**
 * textgenerationwebui_presets · textgenerationwebui_preset_names는 실리 loadTextGenSettings 554~555의 값(프리셋 객체 배열 · 이름 배열).
 * @param {{textgenerationwebui_banned_in_macros?: string[], textgenerationwebui_settings?: object, textgenerationwebui_presets?: object[], textgenerationwebui_preset_names?: string[]}} v
 */
export function __naSet(v) {
    if (Object.hasOwn(v, 'textgenerationwebui_banned_in_macros')) textgenerationwebui_banned_in_macros = v.textgenerationwebui_banned_in_macros;
    if (Object.hasOwn(v, 'textgenerationwebui_settings')) {
        for (const key of Object.keys(textgenerationwebui_settings)) delete textgenerationwebui_settings[key];
        Object.assign(textgenerationwebui_settings, structuredClone(__naDefault_textgenerationwebui_settings), v.textgenerationwebui_settings);
    }
    if (Object.hasOwn(v, 'textgenerationwebui_presets')) textgenerationwebui_presets = v.textgenerationwebui_presets;
    if (Object.hasOwn(v, 'textgenerationwebui_preset_names')) textgenerationwebui_preset_names = v.textgenerationwebui_preset_names;
}
