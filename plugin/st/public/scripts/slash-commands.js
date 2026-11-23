// 실리 1.19.1 public/scripts/slash-commands.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
import { chat_completion_sources } from './openai.js';
import { textgen_types } from './textgen-settings.js';

// 실리 public/scripts/slash-commands.js 133~145
/**
 * @typedef {object} ConnectAPIMap
 * @property {string} selected - API name (e.g. "textgenerationwebui", "openai")
 * @property {string?} [button] - CSS selector for the API button
 * @property {string?} [type] - API type, mostly used by text completion. (e.g. "openrouter")
 * @property {string?} [source] - API source, mostly used by chat completion. (e.g. "openai")
 */

/** @type {Record<string, ConnectAPIMap>} */
export const CONNECT_API_MAP = {};

/** @type {string[]} */
export const UNIQUE_APIS = [];

// 실리 public/scripts/slash-commands.js 147~224
function setupConnectAPIMap() {
    /** @type {Record<string, ConnectAPIMap>} */
    const result = {
        // Default APIs not contained inside text gen / chat gen
        'kobold': {
            selected: 'kobold',
            button: '#api_button',
        },
        'horde': {
            selected: 'koboldhorde',
        },
        'novel': {
            selected: 'novel',
            button: '#api_button_novel',
        },
        'koboldcpp': {
            selected: 'textgenerationwebui',
            button: '#api_button_textgenerationwebui',
            type: textgen_types.KOBOLDCPP,
        },
        // KoboldCpp alias
        'kcpp': {
            selected: 'textgenerationwebui',
            button: '#api_button_textgenerationwebui',
            type: textgen_types.KOBOLDCPP,
        },
        'openai': {
            selected: 'openai',
            button: '#api_button_openai',
            source: chat_completion_sources.OPENAI,
        },
        // OpenAI alias
        'oai': {
            selected: 'openai',
            button: '#api_button_openai',
            source: chat_completion_sources.OPENAI,
        },
        // Google alias
        'google': {
            selected: 'openai',
            button: '#api_button_openai',
            source: chat_completion_sources.MAKERSUITE,
        },
        // OpenRouter special naming, to differentiate between chat comp and text comp
        'openrouter': {
            selected: 'openai',
            button: '#api_button_openai',
            source: chat_completion_sources.OPENROUTER,
        },
        'openrouter-text': {
            selected: 'textgenerationwebui',
            button: '#api_button_textgenerationwebui',
            type: textgen_types.OPENROUTER,
        },
    };

    // Fill connections map from textgen_types and chat_completion_sources
    for (const textGenType of Object.values(textgen_types)) {
        if (result[textGenType]) continue;
        result[textGenType] = {
            selected: 'textgenerationwebui',
            button: '#api_button_textgenerationwebui',
            type: textGenType,
        };
    }

    for (const chatCompletionSource of Object.values(chat_completion_sources)) {
        if (result[chatCompletionSource]) continue;
        result[chatCompletionSource] = {
            selected: 'openai',
            button: '#api_button_openai',
            source: chatCompletionSource,
        };
    }

    Object.assign(CONNECT_API_MAP, result);
    UNIQUE_APIS.push(...new Set(Object.values(CONNECT_API_MAP).map(x => x.selected)));
}

export { setupConnectAPIMap };
