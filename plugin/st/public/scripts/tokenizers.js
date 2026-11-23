// 실리 1.19.1 public/scripts/tokenizers.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움), 대역(jQuery.ajax · sessionStorage · getTokenCount).
import { main_api, online_status } from '../script.js';
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
// 대역: 실리 sessionStorage(브라우저 탭 저장: 페이지를 새로 열어도 그 탭에서는 남아요). 서버는 이 모듈 안에, 일꾼이 떠 있는 동안 둬요.
// getTokenizerBestMatch(연결됐을 때)가 읽고, textgen-settings.js getStatusTextgen(740~741, 연결 확인)이 TOKENIZER_SUPPORTED_KEY를 써요: 같은 것을 내보내요.
const __naSession = new Map();
const sessionStorage = {
    getItem: (k) => (__naSession.has(k) ? __naSession.get(k) : null),
    setItem: (k, v) => { __naSession.set(k, String(v)); },
    removeItem: (k) => { __naSession.delete(k); },
};
export { sessionStorage as __naSessionStorage };
// 대역: 실리 getTokenCount(492~546). apiFailureTokenCount가 부르는 것은 연결된 API 토크나이저가 best match인데 getTextTokens가 encode 길이 없는
// 토크나이저로 불렸을 때뿐이에요. 서버의 요청 길(textgen-settings.js getTokenizerForTokenIds)이 주는 토크나이저는 모두 encode 길이 있어서 닿지 않아요.
function getTokenCount() {
    throw new Error('getTokenCount: 서버에는 없습니다.');
}

// 실리 public/scripts/tokenizers.js 12~14
export const BYTES_PER_TOKEN = 3.35;
export const TOKENIZER_WARNING_KEY = 'tokenizationWarningShown';
export const TOKENIZER_SUPPORTED_KEY = 'tokenizationSupported';

// 실리 public/scripts/tokenizers.js 16~38
export const tokenizers = {
    NONE: 0,
    GPT2: 1,
    OPENAI: 2,
    LLAMA: 3,
    NERD: 4,
    NERD2: 5,
    API_CURRENT: 6,
    MISTRAL: 7,
    YI: 8,
    API_TEXTGENERATIONWEBUI: 9,
    API_KOBOLD: 10,
    CLAUDE: 11,
    LLAMA3: 12,
    GEMMA: 13,
    JAMBA: 14,
    QWEN2: 15,
    COMMAND_R: 16,
    NEMO: 17,
    DEEPSEEK: 18,
    COMMAND_A: 19,
    BEST_MATCH: 99,
};

// 실리 public/scripts/tokenizers.js 40~56
// A list of local tokenizers that support encoding and decoding token ids.
export const ENCODE_TOKENIZERS = [
    tokenizers.LLAMA,
    tokenizers.MISTRAL,
    tokenizers.YI,
    tokenizers.LLAMA3,
    tokenizers.GEMMA,
    tokenizers.JAMBA,
    tokenizers.QWEN2,
    tokenizers.COMMAND_R,
    tokenizers.COMMAND_A,
    tokenizers.NEMO,
    tokenizers.DEEPSEEK,
    // uncomment when NovelAI releases Kayra and Clio weights, lol
    //tokenizers.NERD,
    //tokenizers.NERD2,
];

// 실리 public/scripts/tokenizers.js 58~63
/**
 * A list of Text Completion sources that support remote tokenization.
 * Populated in initTokenziers due to circular dependencies.
 * @type {string[]}
 */
export const TEXTGEN_TOKENIZERS = [];

// 실리 public/scripts/tokenizers.js 65~154
const TOKENIZER_URLS = {
    [tokenizers.GPT2]: {
        encode: '/api/tokenizers/gpt2/encode',
        decode: '/api/tokenizers/gpt2/decode',
        count: '/api/tokenizers/gpt2/encode',
    },
    [tokenizers.OPENAI]: {
        encode: '/api/tokenizers/openai/encode',
        decode: '/api/tokenizers/openai/decode',
        count: '/api/tokenizers/openai/encode',
    },
    [tokenizers.LLAMA]: {
        encode: '/api/tokenizers/llama/encode',
        decode: '/api/tokenizers/llama/decode',
        count: '/api/tokenizers/llama/encode',
    },
    [tokenizers.NERD]: {
        encode: '/api/tokenizers/nerdstash/encode',
        decode: '/api/tokenizers/nerdstash/decode',
        count: '/api/tokenizers/nerdstash/encode',
    },
    [tokenizers.NERD2]: {
        encode: '/api/tokenizers/nerdstash_v2/encode',
        decode: '/api/tokenizers/nerdstash_v2/decode',
        count: '/api/tokenizers/nerdstash_v2/encode',
    },
    [tokenizers.API_KOBOLD]: {
        count: '/api/tokenizers/remote/kobold/count',
        encode: '/api/tokenizers/remote/kobold/count',
    },
    [tokenizers.MISTRAL]: {
        encode: '/api/tokenizers/mistral/encode',
        decode: '/api/tokenizers/mistral/decode',
        count: '/api/tokenizers/mistral/encode',
    },
    [tokenizers.YI]: {
        encode: '/api/tokenizers/yi/encode',
        decode: '/api/tokenizers/yi/decode',
        count: '/api/tokenizers/yi/encode',
    },
    [tokenizers.CLAUDE]: {
        encode: '/api/tokenizers/claude/encode',
        decode: '/api/tokenizers/claude/decode',
        count: '/api/tokenizers/claude/encode',
    },
    [tokenizers.LLAMA3]: {
        encode: '/api/tokenizers/llama3/encode',
        decode: '/api/tokenizers/llama3/decode',
        count: '/api/tokenizers/llama3/encode',
    },
    [tokenizers.GEMMA]: {
        encode: '/api/tokenizers/gemma/encode',
        decode: '/api/tokenizers/gemma/decode',
        count: '/api/tokenizers/gemma/encode',
    },
    [tokenizers.JAMBA]: {
        encode: '/api/tokenizers/jamba/encode',
        decode: '/api/tokenizers/jamba/decode',
        count: '/api/tokenizers/jamba/encode',
    },
    [tokenizers.QWEN2]: {
        encode: '/api/tokenizers/qwen2/encode',
        decode: '/api/tokenizers/qwen2/decode',
        count: '/api/tokenizers/qwen2/encode',
    },
    [tokenizers.COMMAND_R]: {
        encode: '/api/tokenizers/command-r/encode',
        decode: '/api/tokenizers/command-r/decode',
        count: '/api/tokenizers/command-r/encode',
    },
    [tokenizers.COMMAND_A]: {
        encode: '/api/tokenizers/command-a/encode',
        decode: '/api/tokenizers/command-a/decode',
        count: '/api/tokenizers/command-a/encode',
    },
    [tokenizers.NEMO]: {
        encode: '/api/tokenizers/nemo/encode',
        decode: '/api/tokenizers/nemo/decode',
        count: '/api/tokenizers/nemo/encode',
    },
    [tokenizers.DEEPSEEK]: {
        encode: '/api/tokenizers/deepseek/encode',
        decode: '/api/tokenizers/deepseek/decode',
        count: '/api/tokenizers/deepseek/encode',
    },
    [tokenizers.API_TEXTGENERATIONWEBUI]: {
        encode: '/api/tokenizers/remote/textgenerationwebui/encode',
        count: '/api/tokenizers/remote/textgenerationwebui/encode',
    },
};

// 실리 public/scripts/tokenizers.js 156~156
const textEncoder = new TextEncoder();

// 실리 public/scripts/tokenizers.js 161~169
/**
 * Guesstimates the token count for a string.
 * @param {string} str String to tokenize.
 * @returns {number} Token count.
 */
export function guesstimate(str) {
    const byteLength = textEncoder.encode(str).length;
    return Math.ceil(byteLength / BYTES_PER_TOKEN);
}

// 실리 public/scripts/tokenizers.js 280~365
/**
 * Gets the best tokenizer for the current API.
 * @param {string} forApi API to get the tokenizer for. Defaults to the main API.
 * @returns {number} Tokenizer type.
 */
export function getTokenizerBestMatch(forApi) {
    if (!forApi) {
        forApi = main_api;
    }

    if (forApi === 'novel') {
        if (nai_settings.model_novel.includes('clio')) {
            return tokenizers.NERD;
        }
        if (nai_settings.model_novel.includes('kayra')) {
            return tokenizers.NERD2;
        }
        if (nai_settings.model_novel.includes('erato')) {
            return tokenizers.LLAMA3;
        }
    }
    if (forApi === 'kobold' || forApi === 'textgenerationwebui' || forApi === 'koboldhorde') {
        // Try to use the API tokenizer if possible:
        // - API must be connected
        // - Kobold must pass a version check
        // - Tokenizer haven't reported an error previously
        const hasTokenizerError = sessionStorage.getItem(TOKENIZER_WARNING_KEY);
        const hasValidEndpoint = sessionStorage.getItem(TOKENIZER_SUPPORTED_KEY);
        const isConnected = online_status !== 'no_connection';
        const isTokenizerSupported = TEXTGEN_TOKENIZERS.includes(textgen_settings.type) && (textgen_settings.type !== textgen_types.OOBA || hasValidEndpoint);

        if (!hasTokenizerError && isConnected) {
            if (forApi === 'kobold' && kai_flags.can_use_tokenization) {
                return tokenizers.API_KOBOLD;
            }

            if (forApi === 'textgenerationwebui' && isTokenizerSupported) {
                return tokenizers.API_TEXTGENERATIONWEBUI;
            }
            if (forApi === 'textgenerationwebui' && textgen_settings.type === textgen_types.OPENROUTER) {
                return getCurrentOpenRouterModelTokenizer();
            }
            if (forApi === 'textgenerationwebui' && textgen_settings.type === textgen_types.DREAMGEN) {
                return getCurrentDreamGenModelTokenizer();
            }
        }

        if (forApi === 'textgenerationwebui') {
            const model = String(getTextGenModel() || online_status).toLowerCase();
            if (model.includes('llama3') || model.includes('llama-3')) {
                return tokenizers.LLAMA3;
            }
            if (model.includes('mistral') || model.includes('mixtral')) {
                return tokenizers.MISTRAL;
            }
            if (model.includes('gemma')) {
                return tokenizers.GEMMA;
            }
            if (model.includes('nemo') || model.includes('pixtral')) {
                return tokenizers.NEMO;
            }
            if (model.includes('deepseek')) {
                return tokenizers.DEEPSEEK;
            }
            if (model.includes('yi')) {
                return tokenizers.YI;
            }
            if (model.includes('jamba')) {
                return tokenizers.JAMBA;
            }
            if (model.includes('command-r')) {
                return tokenizers.COMMAND_R;
            }
            if (model.includes('command-a')) {
                return tokenizers.COMMAND_A;
            }
            if (model.includes('qwen2')) {
                return tokenizers.QWEN2;
            }
        }

        return tokenizers.LLAMA;
    }

    return tokenizers.NONE;
}

// 실리 public/scripts/tokenizers.js 367~377
// Get the current remote tokenizer API based on the current text generation API.
function currentRemoteTokenizerAPI() {
    switch (main_api) {
        case 'kobold':
            return tokenizers.API_KOBOLD;
        case 'textgenerationwebui':
            return tokenizers.API_TEXTGENERATIONWEBUI;
        default:
            return tokenizers.NONE;
    }
}

// 실리 public/scripts/tokenizers.js 569~790
export function getTokenizerModel() {
    // OpenAI models always provide their own tokenizer
    if (oai_settings.chat_completion_source == chat_completion_sources.OPENAI) {
        return oai_settings.openai_model;
    }

    const turboTokenizer = 'gpt-3.5-turbo';
    const gpt4Tokenizer = 'gpt-4';
    const gpt4oTokenizer = 'gpt-4o';
    const gpt2Tokenizer = 'gpt2';
    const claudeTokenizer = 'claude';
    const llamaTokenizer = 'llama';
    const llama3Tokenizer = 'llama3';
    const mistralTokenizer = 'mistral';
    const yiTokenizer = 'yi';
    const gemmaTokenizer = 'gemma';
    const jambaTokenizer = 'jamba';
    const qwen2Tokenizer = 'qwen2';
    const commandRTokenizer = 'command-r';
    const commandATokenizer = 'command-a';
    const nemoTokenizer = 'nemo';
    const deepseekTokenizer = 'deepseek';

    if (oai_settings.chat_completion_source == chat_completion_sources.AZURE_OPENAI) {
        return oai_settings.azure_openai_model || turboTokenizer;
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.DEEPSEEK) {
        return deepseekTokenizer;
    }

    // And for OpenRouter (if not a site model, then it's impossible to determine the tokenizer)
    if (main_api == 'openai' && oai_settings.chat_completion_source == chat_completion_sources.OPENROUTER && oai_settings.openrouter_model ||
        main_api == 'textgenerationwebui' && textgen_settings.type === textgen_types.OPENROUTER && textgen_settings.openrouter_model) {
        const model = main_api == 'openai'
            ? model_list.find(x => x.id === oai_settings.openrouter_model)
            : openRouterModels.find(x => x.id === textgen_settings.openrouter_model);

        if (model?.architecture?.tokenizer === 'Llama2') {
            return llamaTokenizer;
        } else if (model?.architecture?.tokenizer === 'Llama3') {
            return llama3Tokenizer;
        } else if (model?.architecture?.tokenizer === 'Mistral') {
            return mistralTokenizer;
        } else if (model?.architecture?.tokenizer === 'Yi') {
            return yiTokenizer;
        } else if (model?.architecture?.tokenizer === 'Gemini') {
            return gemmaTokenizer;
        } else if (model?.architecture?.tokenizer === 'Qwen') {
            return qwen2Tokenizer;
        } else if (model?.architecture?.tokenizer === 'Cohere') {
            if (model?.id && model?.id.includes('command-a')) {
                return commandATokenizer;
            }
            return commandRTokenizer;
        } else if (oai_settings.openrouter_model.includes('gpt-4o')) {
            return gpt4oTokenizer;
        } else if (oai_settings.openrouter_model.includes('gpt-4')) {
            return gpt4Tokenizer;
        } else if (oai_settings.openrouter_model.includes('gpt-3.5-turbo')) {
            return turboTokenizer;
        } else if (oai_settings.openrouter_model.includes('claude')) {
            return claudeTokenizer;
        } else if (oai_settings.openrouter_model.includes('GPT-NeoXT')) {
            return gpt2Tokenizer;
        } else if (oai_settings.openrouter_model.includes('jamba')) {
            return jambaTokenizer;
        } else if (oai_settings.openrouter_model.includes('deepseek')) {
            return deepseekTokenizer;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.ELECTRONHUB && oai_settings.electronhub_model) {
        if (oai_settings.electronhub_model.includes('gpt-4o') || oai_settings.electronhub_model.includes('gpt-5') || oai_settings.electronhub_model.includes('gpt-6-astra')) {
            return gpt4oTokenizer;
        } else if (oai_settings.electronhub_model.includes('gpt-4.1') || oai_settings.electronhub_model.includes('gpt-4.5')) {
            return gpt4oTokenizer;
        } else if (oai_settings.electronhub_model.includes('gpt-4')) {
            return gpt4Tokenizer;
        } else if (oai_settings.electronhub_model.includes('gpt-3.5-turbo')) {
            return turboTokenizer;
        } else if (oai_settings.electronhub_model.includes('claude')) {
            return claudeTokenizer;
        } else if (oai_settings.electronhub_model.includes('jamba')) {
            return jambaTokenizer;
        } else if (oai_settings.electronhub_model.includes('deepseek') || oai_settings.electronhub_model.includes('sonar-reasoning') || oai_settings.electronhub_model.includes('r1')) {
            return deepseekTokenizer;
        } else if (oai_settings.electronhub_model.includes('qwen')) {
            return qwen2Tokenizer;
        } else if (oai_settings.electronhub_model.includes('gemma')) {
            return gemmaTokenizer;
        } else if (oai_settings.electronhub_model.includes('mistral')) {
            return mistralTokenizer;
        } else if (oai_settings.electronhub_model.includes('yi')) {
            return yiTokenizer;
        } else if (oai_settings.electronhub_model.includes('llama3') || oai_settings.electronhub_model.includes('llama-3') || oai_settings.electronhub_model.startsWith('l3')) {
            return llama3Tokenizer;
        } else if (oai_settings.electronhub_model.includes('llama')) {
            return llamaTokenizer;
        } else if (oai_settings.electronhub_model.includes('command-a')) {
            return commandATokenizer;
        } else if (oai_settings.electronhub_model.includes('command-r')) {
            return commandRTokenizer;
        } else if (oai_settings.electronhub_model.includes('nemo')) {
            return nemoTokenizer;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.CHUTES && oai_settings.chutes_model) {
        const model = oai_settings.chutes_model.toLowerCase();

        if (model.includes('deepseek') || model.includes('mai-ds')) {
            return deepseekTokenizer;
        } else if (model.includes('qwen') || model.includes('qwq') || model.includes('tongyi') || model.includes('kimi')) {
            return qwen2Tokenizer;
        } else if (model.includes('llama') || model.includes('longcat') || model.includes('hermes')) {
            return llama3Tokenizer;
        } else if (model.includes('gemma')) {
            return gemmaTokenizer;
        } else if (model.includes('nemo')) {
            return nemoTokenizer;
        } else if (model.includes('mistral')) {
            return mistralTokenizer;
        } else if (model.includes('gpt-oss')) {
            return gpt4oTokenizer;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.MINIMAX) {
        // MiniMax uses a proprietary tokenizer; fall back to a coarse OpenAI estimation.
        return 'gpt-3.5-turbo';
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.WORKERS_AI && oai_settings.workers_ai_model) {
        const model = oai_settings.workers_ai_model.toLowerCase();

        if (model.includes('deepseek')) {
            return deepseekTokenizer;
        } else if (model.includes('qwen') || model.includes('qwq') || model.includes('kimi')) {
            return qwen2Tokenizer;
        } else if (model.includes('llama-3') || model.includes('llama-4')) {
            return llama3Tokenizer;
        } else if (model.includes('llama')) {
            return llamaTokenizer;
        } else if (model.includes('gemma')) {
            return gemmaTokenizer;
        } else if (model.includes('mistral')) {
            return mistralTokenizer;
        } else if (model.includes('phi')) {
            return turboTokenizer;
        } else if (model.includes('gpt-oss')) {
            return gpt4oTokenizer;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.COHERE) {
        if (oai_settings.cohere_model.includes('command-a')) {
            return commandATokenizer;
        }
        return commandRTokenizer;
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.MAKERSUITE) {
        return gemmaTokenizer;
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.VERTEXAI) {
        return gemmaTokenizer;
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.AI21) {
        return jambaTokenizer;
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.CLAUDE) {
        return claudeTokenizer;
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.MISTRALAI) {
        if (oai_settings.mistralai_model.includes('nemo') || oai_settings.mistralai_model.includes('pixtral')) {
            return nemoTokenizer;
        }
        return mistralTokenizer;
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.CUSTOM) {
        return oai_settings.custom_model;
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.PERPLEXITY) {
        if (oai_settings.perplexity_model.includes('sonar-reasoning') || oai_settings.perplexity_model.includes('r1-1776')) {
            return deepseekTokenizer;
        }
        if (oai_settings.perplexity_model.includes('llama-3') || oai_settings.perplexity_model.includes('llama3')) {
            return llama3Tokenizer;
        }
        if (oai_settings.perplexity_model.includes('llama')) {
            return llamaTokenizer;
        }
        if (oai_settings.perplexity_model.includes('mistral') || oai_settings.perplexity_model.includes('mixtral')) {
            return mistralTokenizer;
        }
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.GROQ) {
        if (oai_settings.groq_model.includes('qwen')) {
            return qwen2Tokenizer;
        }
        if (oai_settings.groq_model.includes('llama-3') || oai_settings.groq_model.includes('llama3')) {
            return llama3Tokenizer;
        }
        if (oai_settings.groq_model.includes('mistral') || oai_settings.groq_model.includes('mixtral')) {
            return mistralTokenizer;
        }
        if (oai_settings.groq_model.includes('gemma')) {
            return gemmaTokenizer;
        }
    }

    // Default to Turbo 3.5
    return turboTokenizer;
}

// 실리 public/scripts/tokenizers.js 979~986
function getTextgenAPITokenizationParams(str) {
    return {
        text: str,
        api_type: textgen_settings.type,
        url: getTextGenServer(),
        model: getTextGenModel(),
    };
}

// 실리 public/scripts/tokenizers.js 1019~1122
function apiFailureTokenCount(str) {
    console.error('Error counting tokens');
    let shouldTryAgain = false;

    if (!sessionStorage.getItem(TOKENIZER_WARNING_KEY)) {
        const bestMatchBefore = getTokenizerBestMatch(main_api);
        sessionStorage.setItem(TOKENIZER_WARNING_KEY, String(true));
        const bestMatchAfter = getTokenizerBestMatch(main_api);
        if ([tokenizers.API_TEXTGENERATIONWEBUI, tokenizers.API_KOBOLD].includes(bestMatchBefore) && bestMatchBefore !== bestMatchAfter) {
            shouldTryAgain = true;
        }
    }

    // Only try again if we guarantee not to be looped by the same error
    if (shouldTryAgain && power_user.tokenizer === tokenizers.BEST_MATCH) {
        return getTokenCount(str);
    }

    return guesstimate(str);
}

/**
 * Calls the underlying tokenizer model to encode a string to tokens.
 * @param {string} endpoint API endpoint.
 * @param {string} str String to tokenize.
 * @param {function} [resolve] Promise resolve function.
 * @returns {number[]} Array of token ids.
 */
function getTextTokensFromServer(endpoint, str, resolve) {
    const isAsync = typeof resolve === 'function';
    let ids = [];
    jQuery.ajax({
        async: isAsync,
        type: 'POST',
        url: endpoint,
        data: JSON.stringify({ text: str }),
        dataType: 'json',
        contentType: 'application/json',
        success: function (data) {
            ids = data.ids;

            // Don't want to break reverse compatibility, so sprinkle in some of the JS magic
            if (Array.isArray(data.chunks)) {
                Object.defineProperty(ids, 'chunks', { value: data.chunks });
            }

            isAsync && resolve(ids);
        },
    });
    return ids;
}

/**
 * Calls the AI provider's tokenize API to encode a string to tokens.
 * @param {string} str String to tokenize.
 * @param {function} [resolve] Promise resolve function.
 * @returns {number[]} Array of token ids.
 */
function getTextTokensFromTextgenAPI(str, resolve) {
    const isAsync = typeof resolve === 'function';
    let ids = [];
    jQuery.ajax({
        async: isAsync,
        type: 'POST',
        url: TOKENIZER_URLS[tokenizers.API_TEXTGENERATIONWEBUI].encode,
        data: JSON.stringify(getTextgenAPITokenizationParams(str)),
        dataType: 'json',
        contentType: 'application/json',
        success: function (data) {
            ids = data.ids;
            isAsync && resolve(ids);
        },
    });
    return ids;
}

/**
 * Calls the AI provider's tokenize API to encode a string to tokens.
 * @param {string} str String to tokenize.
 * @param {function} [resolve] Promise resolve function.
 * @returns {number[]} Array of token ids.
 */
function getTextTokensFromKoboldAPI(str, resolve) {
    const isAsync = typeof resolve === 'function';
    let ids = [];

    jQuery.ajax({
        async: isAsync,
        type: 'POST',
        url: TOKENIZER_URLS[tokenizers.API_KOBOLD].encode,
        data: JSON.stringify({
            text: str,
            url: kai_settings.api_server,
        }),
        dataType: 'json',
        contentType: 'application/json',
        success: function (data) {
            ids = data.ids;
            isAsync && resolve(ids);
        },
    });

    return ids;
}

// 실리 public/scripts/tokenizers.js 1151~1184
/**
 * Encodes a string to tokens using the server API.
 * @param {number} tokenizerType Tokenizer type.
 * @param {string} str String to tokenize.
 * @returns {number[]} Array of token ids.
 */
export function getTextTokens(tokenizerType, str) {
    switch (tokenizerType) {
        case tokenizers.API_CURRENT:
            return getTextTokens(currentRemoteTokenizerAPI(), str);
        case tokenizers.API_TEXTGENERATIONWEBUI:
            return getTextTokensFromTextgenAPI(str);
        case tokenizers.API_KOBOLD:
            return getTextTokensFromKoboldAPI(str);
        default: {
            const tokenizerEndpoints = TOKENIZER_URLS[tokenizerType];
            if (!tokenizerEndpoints) {
                apiFailureTokenCount(str);
                console.warn('Unknown tokenizer type', tokenizerType);
                return [];
            }
            let endpointUrl = tokenizerEndpoints.encode;
            if (!endpointUrl) {
                apiFailureTokenCount(str);
                console.warn('This tokenizer type does not support encoding', tokenizerType);
                return [];
            }
            if (tokenizerType === tokenizers.OPENAI) {
                endpointUrl += `?model=${getTokenizerModel()}`;
            }
            return getTextTokensFromServer(endpointUrl, str);
        }
    }
}
