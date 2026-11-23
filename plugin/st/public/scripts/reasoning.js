// 실리 1.19.1 public/scripts/reasoning.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
import { main_api } from '../script.js';
import { chat_completion_sources, oai_settings } from './openai.js';
import { power_user } from './power-user.js';
import { textgen_types, textgenerationwebui_settings } from './textgen-settings.js';
import { escapeRegex, trimSpaces } from './utils.js';

// 실리 public/scripts/reasoning.js 29~32
/**
 * @type {ReasoningTemplate[]} List of reasoning templates
 */
export const reasoning_templates = [];

// 실리 public/scripts/reasoning.js 34~34
export const DEFAULT_REASONING_TEMPLATE = 'Think XML';

// 실리 public/scripts/reasoning.js 107~168
/**
 * Extracts the reasoning from the response data.
 * @param {object} data Response data
 * @returns {string} Extracted reasoning
 */
export function extractReasoningFromData(data, {
    mainApi = null,
    ignoreShowThoughts = false,
    textGenType = null,
    chatCompletionSource = null,
} = {}) {
    switch (mainApi ?? main_api) {
        case 'textgenerationwebui':
            switch (textGenType ?? textgenerationwebui_settings.type) {
                case textgen_types.OPENROUTER:
                    return data?.choices?.[0]?.reasoning ?? '';
                case textgen_types.OLLAMA:
                    return data?.thinking ?? '';
            }
            break;

        case 'openai':
            if (!ignoreShowThoughts && !oai_settings.show_thoughts) break;

            switch (chatCompletionSource ?? oai_settings.chat_completion_source) {
                case chat_completion_sources.DEEPSEEK:
                    return data?.choices?.[0]?.message?.reasoning_content ?? '';
                case chat_completion_sources.XAI:
                    return data?.choices?.[0]?.message?.reasoning_content ?? '';
                case chat_completion_sources.OPENROUTER:
                    return data?.choices?.[0]?.message?.reasoning
                        ?? data?.choices?.[0]?.message?.reasoning_content
                        ?? '';
                case chat_completion_sources.MAKERSUITE:
                case chat_completion_sources.VERTEXAI:
                    return data?.responseContent?.parts?.filter(part => part.thought)?.map(part => part.text)?.join('\n\n') ?? '';
                case chat_completion_sources.CLAUDE:
                    return data?.content?.filter(part => part.type === 'thinking')?.map(part => part.thinking)?.join('\n\n') ?? '';
                case chat_completion_sources.MISTRALAI:
                    return data?.choices?.[0]?.message?.content?.[0]?.thinking?.map(part => part.text)?.filter(x => x)?.join('\n\n') ?? '';
                case chat_completion_sources.AIMLAPI:
                case chat_completion_sources.POLLINATIONS:
                case chat_completion_sources.MOONSHOT:
                case chat_completion_sources.COMETAPI:
                case chat_completion_sources.CHUTES:
                case chat_completion_sources.ELECTRONHUB:
                case chat_completion_sources.NANOGPT:
                case chat_completion_sources.SILICONFLOW:
                case chat_completion_sources.ZAI:
                case chat_completion_sources.WORKERS_AI:
                case chat_completion_sources.FIREWORKS:
                case chat_completion_sources.CUSTOM: {
                    return data?.choices?.[0]?.message?.reasoning_content
                        ?? data?.choices?.[0]?.message?.reasoning
                        ?? '';
                }
            }
            break;
    }

    return '';
}

// 실리 public/scripts/reasoning.js 1424~1436
/**
 * Removes reasoning from a string if auto-parsing is enabled.
 * @param {string} str Input string
 * @returns {string} Output string
 */
export function removeReasoningFromString(str) {
    if (!power_user.reasoning.auto_parse) {
        return str;
    }

    const parsedReasoning = parseReasoningFromString(str);
    return parsedReasoning?.content ?? str;
}

// 실리 public/scripts/reasoning.js 1450~1490
/**
 * Parses reasoning from a string using the power user reasoning settings or optional template.
 * @typedef {Object} ParsedReasoning
 * @property {string} reasoning Reasoning block
 * @property {string} content Message content
 * @param {string} str Content of the message
 * @param {Object} options Optional arguments
 * @param {boolean} [options.strict=true] Whether the reasoning block **has** to be at the beginning of the provided string (excluding whitespaces), or can be anywhere in it
 * @param {ReasoningTemplate} template Optional reasoning template to use instead of power_user.reasoning
 * @returns {ParsedReasoning|null} Parsed reasoning block and message content
 */
export function parseReasoningFromString(str, { strict = true } = {}, template = null) {
    template = template ?? power_user.reasoning;  // if no template given, use the currently selected template

    // Both prefix and suffix must be defined
    if (!template.prefix || !template.suffix) {
        return null;
    }

    try {
        const regex = new RegExp(`${(strict ? '^\\s*?' : '')}${escapeRegex(template.prefix)}(.*?)${escapeRegex(template.suffix)}`, 's');

        let didReplace = false;
        let reasoning = '';
        let content = String(str).replace(regex, (_match, captureGroup) => {
            didReplace = true;
            reasoning = captureGroup;
            return '';
        });

        if (didReplace) {
            reasoning = trimSpaces(reasoning);
            content = trimSpaces(content);
        }

        return { reasoning, content };
    } catch (error) {
        console.error('[Reasoning] Error parsing reasoning block', error);
        return null;
    }
}
