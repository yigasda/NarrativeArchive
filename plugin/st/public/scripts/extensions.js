// 실리 1.19.1 public/scripts/extensions.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움), 대역(saveMetadataDebounced).
import { equalsIgnoreCaseAndAccents } from './utils.js';

// 실리 public/scripts/extensions.js 21~21
export let extensionNames = [];

// 실리 public/scripts/extensions.js 62~62
const defaultUrl = 'http://localhost:5100';

// 대역: 실리 saveMetadataDebounced(89~113줄)는 채팅 메타데이터를 저장해요. 서버는 변수를 저장하지 않아서 아무것도 안 해요.
export function saveMetadataDebounced() {}

// 실리 public/scripts/extensions.js 141~226
export const extension_settings = {
    apiUrl: defaultUrl,
    apiKey: '',
    autoConnect: false,
    notifyUpdates: false,
    disabledExtensions: [],
    expressionOverrides: [],
    memory: {},
    note: {
        default: '',
        chara: [],
        wiAddition: [],
    },
    caption: {
        refine_mode: false,
    },
    expressions: {
        /** @type {number} see `EXPRESSION_API` */
        api: undefined,
        /** @type {string[]} */
        custom: [],
        showDefault: false,
        translate: false,
        /** @type {string} */
        fallback_expression: undefined,
        /** @type {string} */
        llmPrompt: undefined,
        allowMultiple: true,
        rerollIfSame: false,
        promptType: 'raw',
    },
    connectionManager: {
        selectedProfile: '',
        /** @type {import('./extensions/connection-manager/index.js').ConnectionProfile[]} */
        profiles: [],
    },
    dice: {},
    /** @type {import('./char-data.js').RegexScriptData[]} */
    regex: [],
    /** @type {import('./extensions/regex/index.js').RegexPreset[]} */
    regex_presets: [],
    /** @type {string[]} */
    character_allowed_regex: [],
    /** @type {Record<string, string[]>} */
    preset_allowed_regex: {},
    tts: {},
    sd: {
        prompts: {},
        character_prompts: {},
        character_negative_prompts: {},
    },
    chromadb: {},
    translate: {},
    objective: {},
    quickReply: {},
    randomizer: {
        controls: [],
        fluctuation: 0.1,
        enabled: false,
    },
    speech_recognition: {},
    rvc: {},
    hypebot: {},
    vectors: {},
    variables: {
        global: {},
    },
    /**
     * @type {import('./chats.js').FileAttachment[]}
     */
    attachments: [],
    /**
     * @type {Record<string, import('./chats.js').FileAttachment[]>}
     */
    character_attachments: {},
    /**
     * @type {string[]}
     */
    disabled_attachments: [],
    gallery: {
        /** @type {{[characterKey: string]: string}} */
        folders: {},
        /** @type {string} */
        sort: 'dateAsc',
    },
};

const __naDefault_extension_settings = structuredClone(extension_settings);

// 실리 public/scripts/extensions.js 502~515
/**
 * Finds an extension by name, allowing omission of the "third-party/" prefix.
 *
 * @param {string} name - The name of the extension to find
 * @returns {{name: string, enabled: boolean}|null} Object with name and enabled properties, or null if not found
 */
export function findExtension(name) {
    const internalExtensionName = extensionNames.find(extName => {
        return equalsIgnoreCaseAndAccents(extName, name) || equalsIgnoreCaseAndAccents(extName, `third-party/${name}`);
    });
    if (!internalExtensionName) return null;
    const isEnabled = !extension_settings.disabledExtensions.includes(internalExtensionName);
    return { name: internalExtensionName, enabled: isEnabled };
}

/**
 * 일꾼이 채워요. extension_settings는 실리 loadExtensionSettings처럼 기본값 위에 Object.assign.
 * @param {{extensionNames?: string[], extension_settings?: object}} v
 */
export function __naSet(v) {
    if (Object.hasOwn(v, 'extensionNames')) extensionNames = v.extensionNames;
    if (Object.hasOwn(v, 'extension_settings')) {
        for (const key of Object.keys(extension_settings)) delete extension_settings[key];
        Object.assign(extension_settings, structuredClone(__naDefault_extension_settings), v.extension_settings);
    }
}
