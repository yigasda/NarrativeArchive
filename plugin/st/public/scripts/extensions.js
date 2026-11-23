// 실리 1.19.1 public/scripts/extensions.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움), 대역(saveMetadataDebounced · doExtrasFetch).
import { equalsIgnoreCaseAndAccents } from './utils.js';
import { getContext } from './st-context.js';
import { SimpleMutex } from './util/SimpleMutex.js';

// 실리 public/scripts/extensions.js 14~18
export {
    getContext,
    getApiUrl,
    SimpleMutex as ModuleWorkerWrapper,
};

// 실리 public/scripts/extensions.js 21~21
export let extensionNames = [];

// 실리 public/scripts/extensions.js 34~34
export let modules = [];

// 실리 public/scripts/extensions.js 48~49
const getApiUrl = () => extension_settings.apiUrl;
const sortManifestsByOrder = (a, b) => parseInt(a.loading_order) - parseInt(b.loading_order) || String(a.display_name).localeCompare(String(b.display_name));

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

// 대역: 실리 doExtrasFetch(260~280)는 Extras 서버에 요청을 보내요. 서버는 Extras에 연결하지 않아서(connectToApi를 안 옮김) modules가 늘 비어 있고,
// 옮긴 코드(표정 목록)는 modules에 'classify'가 있을 때만 불러요: 닿지 않아요.
export async function doExtrasFetch() {
    throw new Error('서버는 Extras API에 연결하지 않습니다.');
}

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

// (실리 activateExtensions 568~의 확장 차례: plugin/st/namacros.js가 써요)
export { sortManifestsByOrder };

/**
 * 일꾼이 채워요. extension_settings는 실리 loadExtensionSettings처럼 기본값 위에 Object.assign.
 * extensionNames는 실리 loadExtensionSettings 1793~1803의 값(찾은 확장 중 manifest.json을 읽을 수 있는 것: plugin/st/namacros.js).
 * @param {{extensionNames?: string[], extension_settings?: object}} v
 */
export function __naSet(v) {
    if (Object.hasOwn(v, 'extensionNames')) extensionNames = v.extensionNames;
    if (Object.hasOwn(v, 'extension_settings')) {
        for (const key of Object.keys(extension_settings)) delete extension_settings[key];
        Object.assign(extension_settings, structuredClone(__naDefault_extension_settings), v.extension_settings);
    }
}
