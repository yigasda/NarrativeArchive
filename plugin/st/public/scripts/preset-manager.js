// 실리 1.19.1 public/scripts/preset-manager.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움), 대역(registerPresetManagers).
import { main_api } from '../script.js';
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

// 실리 public/scripts/preset-manager.js 44~44
const presetManagers = {};

// 실리 public/scripts/preset-manager.js 78~96
/**
 * Gets a preset manager by API id.
 * @param {string} apiId API id
 * @returns {PresetManager} Preset manager
 */
export function getPresetManager(apiId = '') {
    if (apiId === 'koboldhorde') {
        apiId = 'kobold';
    }
    if (!apiId) {
        apiId = main_api == 'koboldhorde' ? 'kobold' : main_api;
    }

    if (!Object.keys(presetManagers).includes(apiId)) {
        return null;
    }

    return presetManagers[apiId];
}

// 실리 public/scripts/preset-manager.js 111~116
class PresetManager {
    constructor(select, apiId) {
        this.select = select;
        this.apiId = apiId;
    }

    // (실리 117~525: 가져오기 · 내보내기 · 화면 고르기 · 저장 · 이름 바꾸기. 서버에서는 안 써요)

// 실리 public/scripts/preset-manager.js 526~602
    /**
     * Gets a list of presets for the API.
     * @param {string} [api] API ID. If not specified, uses the current API ID.
     * @returns {{presets: any[], preset_names: object, settings: object}}
     */
    getPresetList(api) {
        let presets = [];
        let preset_names = {};
        let settings = {};

        // If no API specified, use the current API
        if (api === undefined) {
            api = this.apiId;
        }

        switch (api) {
            case 'koboldhorde':
            case 'kobold':
                presets = koboldai_settings;
                preset_names = koboldai_setting_names;
                settings = kai_settings;
                break;
            case 'novel':
                presets = novelai_settings;
                preset_names = novelai_setting_names;
                settings = nai_settings;
                break;
            case 'textgenerationwebui':
                presets = textgenerationwebui_presets;
                preset_names = textgenerationwebui_preset_names;
                settings = textgen_settings;
                break;
            case 'openai':
                presets = openai_settings;
                preset_names = openai_setting_names;
                settings = oai_settings;
                break;
            case 'context':
                presets = context_presets;
                preset_names = context_presets.map(x => x.name);
                settings = power_user.context;
                break;
            case 'instruct':
                presets = instruct_presets;
                preset_names = instruct_presets.map(x => x.name);
                settings = power_user.instruct;
                break;
            case 'sysprompt':
                presets = system_prompts;
                preset_names = system_prompts.map(x => x.name);
                settings = power_user.sysprompt;
                break;
            case 'reasoning':
                presets = reasoning_templates;
                preset_names = reasoning_templates.map(x => x.name);
                settings = power_user.reasoning;
                break;
            default:
                console.warn(`Unknown API ID ${api}`);
        }

        return { presets, preset_names, settings };
    }

    /**
     * Returns true if the API is keyed, meaning it uses a name to identify presets.
     */
    isKeyedApi() {
        return this.apiId == 'textgenerationwebui' || this.isAdvancedFormatting();
    }

    /**
     * Returns true if the API is from Advanced Formatting group.
     */
    isAdvancedFormatting() {
        return ['context', 'instruct', 'sysprompt', 'reasoning'].includes(this.apiId);
    }

    // (실리 604~751: 화면 목록 · 저장할 값 만들기. 서버에서는 안 써요)

// 실리 public/scripts/preset-manager.js 752~779
    /**
     * Retrieves a completion preset by name.
     * @param {string} name Name of the preset to retrieve
     * @returns {any} Preset object if found, otherwise undefined
     */
    getCompletionPresetByName(name) {
        // Retrieve a completion preset by name. Return undefined if not found.
        let { presets, preset_names } = this.getPresetList();
        let preset;

        // Some APIs use an array of names, others use an object of {name: index}
        if (Array.isArray(preset_names)) {  // array of names
            if (preset_names.includes(name)) {
                preset = presets[preset_names.indexOf(name)];
            }
        } else {  // object of {names: index}
            if (preset_names[name] !== undefined) {
                preset = presets[preset_names[name]];
            }
        }

        if (preset === undefined) {
            console.error(`Preset ${name} not found`);
        }

        // if the preset isn't found, returns undefined
        return preset;
    }

    // (실리 780~908: 지우기 · 되돌리기 · 확장 칸. 서버에서는 안 써요)
// 실리 public/scripts/preset-manager.js 909~909
}

// 대역: 실리 registerPresetManagers(101~109)는 화면의 select[data-preset-manager-for]마다 new PresetManager($(select), apiId)를 만들어요.
// 실리 initPresetManager(991~)가 페이지를 열 때 한 번 불러요. 서버에는 화면이 없어서 index.html의 그 select들과 같은 차례 · 같은 apiId로 만들어요
// (index.html 110 kobold · 152 novel · 198 openai · 235 textgenerationwebui · 4139 context · 4278 instruct · 4461 sysprompt · 4597 reasoning). select 자리는 null.
export function __naRegisterPresetManagers() {
    for (const apiId of ['kobold', 'novel', 'openai', 'textgenerationwebui', 'context', 'instruct', 'sysprompt', 'reasoning']) {
        presetManagers[apiId] = new PresetManager(null, apiId);
    }
}
