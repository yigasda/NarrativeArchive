// 실리 1.19.1 public/scripts/extensions/expressions/index.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
import { characters, getRequestHeaders, saveSettingsDebounced, system_message_types, this_chid } from '../../../script.js';
import { getContext, getApiUrl, modules, extension_settings, doExtrasFetch } from '../../extensions.js';
import { power_user } from '../../power-user.js';
import { onlyUnique, getCharaFilename, findChar } from '../../utils.js';
import { selected_group } from '../../group-chats.js';
import { t } from '../../i18n.js';
import { macros } from '../../macros/macro-system.js';
import { MacrosParser } from '../../macros.js';
import { naFetch as fetch } from '../../../naFetch.js';

// 실리 public/scripts/extensions/expressions/index.js 44~79
const DEFAULT_FALLBACK_EXPRESSION = 'joy';
const DEFAULT_LLM_PROMPT = 'Ignore previous instructions. Classify the emotion of the last message. Output just one word, e.g. "joy" or "anger". Choose only one of the following labels: {{labels}}';
const DEFAULT_EXPRESSIONS = [
    'admiration',
    'amusement',
    'anger',
    'annoyance',
    'approval',
    'caring',
    'confusion',
    'curiosity',
    'desire',
    'disappointment',
    'disapproval',
    'disgust',
    'embarrassment',
    'excitement',
    'fear',
    'gratitude',
    'grief',
    'joy',
    'love',
    'nervousness',
    'optimism',
    'pride',
    'realization',
    'relief',
    'remorse',
    'sadness',
    'surprise',
    'neutral',
];

const OPTION_NO_FALLBACK = '#none';
const OPTION_EMOJI_FALLBACK = '#emoji';
const RESET_SPRITE_LABEL = '#reset';

// 실리 public/scripts/extensions/expressions/index.js 82~95
/** @enum {number} */
const EXPRESSION_API = {
    local: 0,
    extras: 1,
    llm: 2,
    webllm: 3,
    none: 99,
};

/** @enum {string} */
const PROMPT_TYPE = {
    raw: 'raw',
    full: 'full',
};

// 실리 public/scripts/extensions/expressions/index.js 97~101
let expressionsList = null;
let lastCharacter = undefined;
let lastMessage = null;
/** @type {{[characterKey: string]: Expression[]}} */
let spriteCache = {};

// 실리 public/scripts/extensions/expressions/index.js 105~106
/** @type {{[characterName: string]: string}} */
export let lastExpression = {};

// 실리 public/scripts/extensions/expressions/index.js 108~120
/**
 * Gets the current fallback expression, including the labels for when it is not set
 * @returns {string|null}
 */
function getCurrentFallbackExpression() {
    const expression = extension_settings?.expressions.fallback_expression;
    const showEmojis = extension_settings?.expressions?.showDefault;

    if (!expression && showEmojis) return OPTION_EMOJI_FALLBACK;
    if (!expression) return OPTION_NO_FALLBACK;

    return expression;
}

// 실리 public/scripts/extensions/expressions/index.js 625~655
function getSpriteFolderName(characterMessage = null, characterName = null) {
    const context = getContext();
    let spriteFolderName = characterName ?? context.name2;
    const message = characterMessage ?? getLastCharacterMessage();
    const avatarFileName = getFolderNameByMessage(message);
    const expressionOverride = extension_settings.expressionOverrides.find(e => e.name == avatarFileName);

    if (expressionOverride && expressionOverride.path) {
        spriteFolderName = expressionOverride.path;
    }

    return spriteFolderName;
}

function getFolderNameByMessage(message) {
    const context = getContext();
    let avatarPath = '';

    if (context.groupId) {
        avatarPath = message.original_avatar || context.characters.find(x => message.force_avatar && message.force_avatar.includes(encodeURIComponent(x.avatar)))?.avatar;
    } else if (context.characterId !== undefined) {
        avatarPath = getCharaFilename();
    }

    if (!avatarPath) {
        return '';
    }

    const folderName = avatarPath.replace(/\.[^/.]+$/, '');
    return folderName;
}

// 실리 public/scripts/extensions/expressions/index.js 1204~1226
/**
 * @param {Object} [options]
 * @param {string} [options.characterName] Filters last message to the one of the target character
 */
function getLastCharacterMessage({ characterName = '' } = {}) {
    const context = getContext();
    const reversedChat = context.chat.slice().reverse();
    const ignoreCharName = !characterName;

    for (let mes of reversedChat) {
        if (mes.is_user || mes.is_system || mes.extra?.type === system_message_types.NARRATOR) {
            continue;
        }

        if (!ignoreCharName && mes.name !== characterName) {
            continue;
        }

        return { mes: mes.mes, name: mes.name, original_avatar: mes.original_avatar, force_avatar: mes.force_avatar };
    }

    return { mes: '', name: null, original_avatar: null, force_avatar: null };
}

// 실리 public/scripts/extensions/expressions/index.js 1448~1454
function getCachedExpressions() {
    if (!Array.isArray(expressionsList)) {
        return [];
    }

    return [...expressionsList, ...extension_settings.expressions.custom].filter(onlyUnique);
}

// 실리 public/scripts/extensions/expressions/index.js 1456~1523
export async function getExpressionsList({ filterAvailable = false } = {}) {
    // If there is no cached list, load and cache it
    if (!Array.isArray(expressionsList)) {
        expressionsList = await resolveExpressionsList();
    }

    const expressions = getCachedExpressions();

    // Filtering is only available for llm and webllm APIs
    if (!filterAvailable || ![EXPRESSION_API.llm, EXPRESSION_API.webllm].includes(extension_settings.expressions.api)) {
        return expressions;
    }

    // Get expressions with available sprites
    const currentLastMessage = selected_group ? getLastCharacterMessage() : null;
    const spriteFolderName = getSpriteFolderName(currentLastMessage, currentLastMessage?.name);

    return expressions.filter(label => {
        const expression = spriteCache[spriteFolderName]?.find(x => x.label === label);
        return (expression?.files.length ?? 0) > 0;
    });

    /**
     * Returns the list of expressions from the API or fallback in offline mode.
     * @returns {Promise<string[]>}
     */
    async function resolveExpressionsList() {
        // See if we can retrieve a specific expression list from the API
        try {
            // Check Extras api first, if enabled and that module active
            if (extension_settings.expressions.api == EXPRESSION_API.extras && modules.includes('classify')) {
                const url = new URL(getApiUrl());
                url.pathname = '/api/classify/labels';

                const apiResult = await doExtrasFetch(url, {
                    method: 'GET',
                    headers: { 'Bypass-Tunnel-Reminder': 'bypass' },
                });

                if (apiResult.ok) {
                    const data = await apiResult.json();
                    expressionsList = data.labels;
                    return expressionsList;
                }
            }

            // If running the local classify model (not using the LLM), we ask that one
            if (extension_settings.expressions.api == EXPRESSION_API.local) {
                const apiResult = await fetch('/api/extra/classify/labels', {
                    method: 'POST',
                    headers: getRequestHeaders({ omitContentType: true }),
                });

                if (apiResult.ok) {
                    const data = await apiResult.json();
                    expressionsList = data.labels;
                    return expressionsList;
                }
            }
        } catch (error) {
            console.log(error);
        }

        // If there was no specific list, or an error, just return the default expressions
        expressionsList = DEFAULT_EXPRESSIONS.slice();
        return expressionsList;
    }
}

// 실리 public/scripts/extensions/expressions/index.js 1525~1547
/**
 * Gets the last expression used in the chat by the active character.
 * @param {Object} [options]
 * @param {string} [options.characterName] Filters last expression to the one of the target character instead
 * @returns {string}
 */
function getLastExpression({ characterName = '' } = {}) {
    if (typeof characterName !== 'string') throw new Error('Character name must be a string');

    if (!characterName) {
        characterName = characters[this_chid]?.avatar || '';
    }

    const char = findChar({ name: characterName, quiet: true });

    const currentLastMessage = getLastCharacterMessage({ characterName });
    const finalCharacterName = currentLastMessage?.name ?? char?.name ?? characterName;

    const spriteFolderName = getSpriteFolderName(currentLastMessage, finalCharacterName);
    const sprite = lastExpression[spriteFolderName.split('/')[0]] ?? '';

    return sprite;
}

// 실리 public/scripts/extensions/expressions/index.js 2218~2252
function migrateSettings() {
    if (extension_settings.expressions.api === undefined) {
        extension_settings.expressions.api = EXPRESSION_API.none;
        saveSettingsDebounced();
    }

    if (Object.keys(extension_settings.expressions).includes('local')) {
        if (extension_settings.expressions.local) {
            extension_settings.expressions.api = EXPRESSION_API.local;
        }

        delete extension_settings.expressions.local;
        saveSettingsDebounced();
    }

    if (extension_settings.expressions.llmPrompt === undefined) {
        extension_settings.expressions.llmPrompt = DEFAULT_LLM_PROMPT;
        saveSettingsDebounced();
    }

    if (extension_settings.expressions.allowMultiple === undefined) {
        extension_settings.expressions.allowMultiple = true;
        saveSettingsDebounced();
    }

    if (extension_settings.expressions.showDefault && extension_settings.expressions.fallback_expression) {
        extension_settings.expressions.showDefault = false;
        saveSettingsDebounced();
    }

    if (extension_settings.expressions.promptType === undefined) {
        extension_settings.expressions.promptType = PROMPT_TYPE.raw;
        saveSettingsDebounced();
    }
}

// 우리 것: 실리 init(2254~2721, 확장을 켤 때 activate) 중 매크로 등록만. 그 앞의 migrateSettings(2338) · 표정 목록(2339 addSettings → getExpressionsList)은
// 일꾼이 plugin/st/namacros.js에서 불러요
export function __naRegister() {
// 실리 public/scripts/extensions/expressions/index.js 2653~2720
    if (power_user.experimental_macro_engine) {
        macros.register('defaultExpression', {
            handler: getCurrentFallbackExpression,
            category: macros.category.MISC,
            description: 'Returns the global fallback expression.',
            returns: 'Expression label',
            exampleUsage: '{{defaultExpression}}',
        });

        macros.register('lastExpression', {
            handler: function ({ args: [name = '{{char}}'], resolve }) {
                try {
                    return getLastExpression({ characterName: resolve(name || '') });
                } catch (error) {
                    console.error(error);
                    return '';
                }
            },
            unnamedArgs: [{
                name: 'name',
                description: 'The name of the target character',
                defaultValue: '{{char}}',
                optional: true,
                type: macros.valueType.STRING,
            }],
            delayArgResolution: true,
            category: macros.category.MISC,
            description: 'Returns the last expression used by the selected character. The currently active character is used if no character name is provided.',
            returns: 'Expression label',
            exampleUsage: [
                '{{lastExpression}}',
                '{{lastExpression::John}}',
                '{{lastExpression::{{char}}}}',
            ],
        });

        macros.register('availableExpressions', {
            handler: function () {
                return getCachedExpressions().join(', ');
            },
            category: macros.category.MISC,
            description: 'Returns a list with all the available expressions provided by the Classifier API.',
            returns: 'Expression label list',
            exampleUsage: '{{availableExpressions}}',
        });
    } else {
        MacrosParser.registerMacro('defaultExpression',
            getCurrentFallbackExpression,
            t`Returns the global fallback expression.`,
        );

        MacrosParser.registerMacro('lastExpression',
            () => {
                try {
                    return getLastExpression();
                } catch (error) {
                    console.error(error);
                    return '';
                }
            },
            t`Returns the last expression used.`,
        );

        MacrosParser.registerMacro('availableExpressions',
            () => getCachedExpressions().join(', '),
            t`Returns a list with all the available expressions provided by the Classifier API.`,
        );
    }
}

export { EXPRESSION_API, migrateSettings };

/**
 * 일꾼이 채워요. lastExpression: 실리는 채팅을 열 때 {}로 비워요(2349). expressionsList: null이면 getExpressionsList가 다시 받아요(실리는 표정 API를 바꿀 때 null, 1835).
 * @param {{lastExpression?: object, expressionsList?: string[]|null}} v
 */
export function __naSet(v) {
    if (Object.hasOwn(v, 'lastExpression')) lastExpression = v.lastExpression;
    if (Object.hasOwn(v, 'expressionsList')) expressionsList = v.expressionsList;
}
