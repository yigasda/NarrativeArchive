// 실리 1.19.1 public/scripts/tool-calling.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
import { main_api } from '../script.js';
import { chat_completion_sources, custom_prompt_post_processing_types, getChatCompletionModel, model_list, oai_settings } from './openai.js';

// 실리 public/scripts/tool-calling.js 242~248
export class ToolManager {
    /**
     * A map of tool names to tool definitions.
     * @type {Map<string, ToolDefinition>}
     */
    static #tools = new Map();


// 실리 public/scripts/tool-calling.js 256~263

    /**
     * Returns an Array of all tools that have been registered.
     * @type {ToolDefinition[]}
     */
    static get tools() {
        return Array.from(this.#tools.values());
    }

// 실리 public/scripts/tool-calling.js 400~418
    static async registerFunctionToolsOpenAI(data) {
        const tools = [];

        for (const tool of ToolManager.tools) {
            const register = await tool.shouldRegister();
            if (!register) {
                console.log('[ToolManager] Skipping tool registration:', tool);
                continue;
            }
            tools.push(tool.toFunctionOpenAI());
        }

        if (tools.length) {
            console.log('[ToolManager] Registered function tools:', tools);

            data.tools = tools;
            data.tool_choice = 'auto';
        }
    }

// 실리 public/scripts/tool-calling.js 614~685
    static isToolCallingSupported(settings = null, model = null) {
        settings = settings ?? oai_settings;
        model = model ?? getChatCompletionModel(settings);

        if (main_api !== 'openai' || !settings.function_calling) {
            return false;
        }

        // GPT-6 Astra supports tool calling only through the Responses API.
        if ([chat_completion_sources.OPENAI, chat_completion_sources.AZURE_OPENAI].includes(settings.chat_completion_source)
            && /^gpt-6-astra/.test(model)) {
            return false;
        }

        // Post-processing will forcefully remove past tool calls from the prompt, making them useless
        const { NONE, MERGE_TOOLS, SEMI_TOOLS, STRICT_TOOLS } = custom_prompt_post_processing_types;
        const allowedPromptPostProcessing = [NONE, MERGE_TOOLS, SEMI_TOOLS, STRICT_TOOLS];
        if (!allowedPromptPostProcessing.includes(settings.custom_prompt_post_processing)) {
            return false;
        }

        const currentModel = Array.isArray(model_list) ? model_list.find(m => m.id === model) : null;
        if (currentModel) {
            switch (settings.chat_completion_source) {
                case chat_completion_sources.POLLINATIONS:
                    return currentModel.tools;
                case chat_completion_sources.FIREWORKS:
                    return currentModel.supports_tools;
                case chat_completion_sources.OPENROUTER:
                    return currentModel.supported_parameters?.includes('tools');
                case chat_completion_sources.MISTRALAI:
                    return currentModel.capabilities?.function_calling;
                case chat_completion_sources.AIMLAPI:
                    return currentModel.features?.includes('openai/chat-completion.function');
                case chat_completion_sources.CHUTES:
                    return currentModel.supported_features?.includes('tools');
                case chat_completion_sources.ELECTRONHUB:
                    return currentModel.metadata?.function_call;
                case chat_completion_sources.WORKERS_AI:
                    return Array.isArray(currentModel.properties) && currentModel.properties.some(p => p.property_id === 'function_calling' && p.value === 'true');
            }
        }

        const supportedSources = [
            chat_completion_sources.OPENAI,
            chat_completion_sources.CUSTOM,
            chat_completion_sources.MISTRALAI,
            chat_completion_sources.CLAUDE,
            chat_completion_sources.OPENROUTER,
            chat_completion_sources.AIMLAPI,
            chat_completion_sources.GROQ,
            chat_completion_sources.COHERE,
            chat_completion_sources.DEEPSEEK,
            chat_completion_sources.MAKERSUITE,
            chat_completion_sources.VERTEXAI,
            chat_completion_sources.AI21,
            chat_completion_sources.XAI,
            chat_completion_sources.POLLINATIONS,
            chat_completion_sources.MOONSHOT,
            chat_completion_sources.FIREWORKS,
            chat_completion_sources.COMETAPI,
            chat_completion_sources.CHUTES,
            chat_completion_sources.ELECTRONHUB,
            chat_completion_sources.AZURE_OPENAI,
            chat_completion_sources.ZAI,
            chat_completion_sources.SILICONFLOW,
            chat_completion_sources.NANOGPT,
            chat_completion_sources.WORKERS_AI,
            chat_completion_sources.MINIMAX,
        ];
        return supportedSources.includes(settings.chat_completion_source);
    }

// 실리 public/scripts/tool-calling.js 694~700
    static canPerformToolCalls(type, settings = null, model = null) {
        settings = settings ?? oai_settings;
        model = model ?? getChatCompletionModel(settings);
        const noToolCallTypes = ['impersonate', 'quiet', 'continue'];
        const isSupported = ToolManager.isToolCallingSupported(settings, model);
        return isSupported && !noToolCallTypes.includes(type);
    }
}
