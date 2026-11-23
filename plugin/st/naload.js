// 우리 것: 실리 브라우저가 settings.json을 읽어 들고 있는 값을 서버의 옮긴 실리 코드(plugin/st/public)에 채워요.
// 실리 브라우저는 페이지를 열 때 한 번 읽고(script.js getSettings 7911~8048), 바꿀 때마다 settings.json에 저장해요. 서버는 일마다 그 파일을 새로 읽어서
// 같은 순서로 채워요. 화면(DOM) 줄은 빼고 값을 정하는 줄만 따라 했어요. 줄 번호는 실리 1.19.1이에요.
// (power-user.js 먼저: 실리 브라우저가 부르는 차례. script.js를 먼저 부르면 서로 부르는 import 때문에 power_user 기본값을 못 만들어요)
import fs from 'node:fs';
import path from 'node:path';
import * as PU from './public/scripts/power-user.js';
import * as ACC from './public/scripts/util/AccountStorage.js';
import * as SCRIPT from './public/script.js';
import * as OAI from './public/scripts/openai.js';
import * as SC from './public/scripts/st-context.js';
import * as TG from './public/scripts/textgen-settings.js';
import * as TGM from './public/scripts/textgen-models.js';
import * as KAI from './public/scripts/kai-settings.js';
import * as NAI from './public/scripts/nai-settings.js';
import * as INS from './public/scripts/instruct-mode.js';
import * as SYS from './public/scripts/sysprompt.js';
import * as REA from './public/scripts/reasoning.js';
import * as EXT from './public/scripts/extensions.js';
import * as TOK from './public/scripts/tokenizers.js';
import { BIAS_CACHE } from './public/scripts/logit-bias.js';
import { setupConnectAPIMap } from './public/scripts/slash-commands.js';
import { __naRegisterPresetManagers } from './public/scripts/preset-manager.js';
import { ConnectionManagerRequestService } from './public/scripts/extensions/shared.js';
import { NaAjaxWait, naAjaxFill, naFetchFailures } from './public/naFetch.js';
import { initMacros } from './public/scripts/macros.js';
import { uuidv4 } from './public/scripts/utils.js';

export { ConnectionManagerRequestService };

// script.js의 max_context 처음 값 (settings.json에 없을 때 실리 페이지가 쓰는 값)
const MAX_CONTEXT_START = SCRIPT.max_context;
const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);

// 페이지를 열 때 한 번 하는 것 (실리 script.js firstLoadInit 694~):
//  - 740 initDefaultSlashCommands → slash-commands.js 228 setupConnectAPIMap (CONNECT_API_MAP: 프로필의 api → 쓰는 API · 종류)
//  - 750 initPresetManager → preset-manager.js registerPresetManagers (화면 대역: preset-manager.js __naRegisterPresetManagers)
//  - 761 initTokenizers → tokenizers.js 1214~1221 TEXTGEN_TOKENIZERS 채우기 (그 뒤 줄은 이벤트 · 브라우저 캐시라 서버에 없음)
//  - 8019 initMacros (macros.js 719~747: power_user를 읽은 뒤). 변수 매크로는 등록할 때 SillyTavern.getContext()를 잡아 둬요(variable-macros.js 10):
//    그때만 변수 묶음을 주는 getContext를 끼워요. 실리는 옛 엔진(experimental_macro_engine 꺼짐)일 때만 옛 매크로 두 개(isMobile · lastGenerationType)를
//    더 등록해요. 서버도 처음 읽은 설정대로 한 번만 해요: 실리를 켜 둔 채 그 설정을 바꾼 것과 같아요(실리도 다시 열 때까지 그대로예요).
let inited = false;
export function naInit() {
    if (inited) return;
    inited = true;
    setupConnectAPIMap();
    __naRegisterPresetManagers();
    TOK.TEXTGEN_TOKENIZERS.push(
        TG.textgen_types.OOBA,
        TG.textgen_types.TABBY,
        TG.textgen_types.KOBOLDCPP,
        TG.textgen_types.LLAMACPP,
        TG.textgen_types.VLLM,
        TG.textgen_types.APHRODITE,
    );
    const had = globalThis.SillyTavern;
    globalThis.SillyTavern = { getContext: () => ({ variables: SC.variables }) };
    try { initMacros(); } finally { globalThis.SillyTavern = had; }
}

// ---------- 프리셋 파일 (실리 서버 src/endpoints/settings.js의 /api/settings/get 218~296) ----------
// 실리 서버 src/endpoints/settings.js 54~72 그대로 (instruct · context · sysprompt · reasoning: 파싱한 객체, 파일 이름 글자 차례, 깨진 JSON은 말없이 건너뜀)
function readAndParseFromDirectory(directoryPath, fileExtension = '.json') {
    const files = fs
        .readdirSync(directoryPath)
        .filter(x => path.parse(x).ext == fileExtension)
        .sort();

    const parsedFiles = [];

    files.forEach(item => {
        try {
            const file = fs.readFileSync(path.join(directoryPath, item), 'utf-8');
            parsedFiles.push(fileExtension == '.json' ? JSON.parse(file) : file);
        } catch {
            // skip
        }
    });

    return parsedFiles;
}

// 실리 서버 src/endpoints/settings.js 79~81 그대로
function sortByName(_) {
    return (a, b) => a.localeCompare(b);
}

// 실리 서버 src/endpoints/settings.js 92~116 그대로 (KoboldAI · NovelAI · OpenAI · TextGen: 파일 글 그대로, 이름 = 파일 이름에서 확장자 뺀 것,
// localeCompare 차례(실리 서버와 같은 Node), 깨진 JSON은 실리 창 로그를 남기고 건너뜀)
function readPresetsFromDirectory(directoryPath, options = {}) {
    const {
        sortFunction,
        removeFileExtension = false,
        fileExtension = '.json',
    } = options;

    const files = fs.readdirSync(directoryPath).sort(sortFunction).filter(x => path.parse(x).ext == fileExtension);
    const fileContents = [];
    const fileNames = [];

    files.forEach(item => {
        try {
            const file = fs.readFileSync(path.join(directoryPath, item), 'utf8');
            JSON.parse(file);
            fileContents.push(file);
            fileNames.push(removeFileExtension ? item.replace(/\.[^/.]+$/, '') : item);
        } catch {
            // skip
            console.warn(`${item} is not a valid JSON`);
        }
    });

    return { fileContents, fileNames };
}

/**
 * 실리 /api/settings/get(settings.js 218~296)의 프리셋 부분을 사용자 폴더에서 같은 방법으로 읽어요. 폴더 이름은 실리 src/constants.js 16~48
 * USER_DIRECTORY_TEMPLATE. 폴더가 없으면 실리 서버처럼 readdirSync가 오류를 내요(실리는 그때 /get이 500이라 페이지가 설정을 못 읽어요).
 * 돌려주는 것은 그 답의 같은 이름 칸(settings · 세계 · 테마 · 빠른 답장 · 설정 값 빼고): naLoad(settings, data)의 data.
 * @param {string} userRoot 사용자 폴더 (예: <실리 data>/default-user)
 */
export async function naLoadPresets(userRoot) {
    const dir = (name) => path.join(userRoot, name);
    // NovelAI Settings (229~233)
    const { fileContents: novelai_settings, fileNames: novelai_setting_names }
        = readPresetsFromDirectory(dir('NovelAI Settings'), {
            sortFunction: sortByName(dir('NovelAI Settings')),
            removeFileExtension: true,
        });
    // OpenAI Settings (236~239)
    const { fileContents: openai_settings, fileNames: openai_setting_names }
        = readPresetsFromDirectory(dir('OpenAI Settings'), {
            sortFunction: sortByName(dir('OpenAI Settings')), removeFileExtension: true,
        });
    // TextGenerationWebUI Settings (242~245)
    const { fileContents: textgenerationwebui_presets, fileNames: textgenerationwebui_preset_names }
        = readPresetsFromDirectory(dir('TextGen Settings'), {
            sortFunction: sortByName(dir('TextGen Settings')), removeFileExtension: true,
        });
    // Kobold (248~251)
    const { fileContents: koboldai_settings, fileNames: koboldai_setting_names }
        = readPresetsFromDirectory(dir('KoboldAI Settings'), {
            sortFunction: sortByName(dir('KoboldAI Settings')), removeFileExtension: true,
        });
    // 263~266
    const instruct = readAndParseFromDirectory(dir('instruct'));
    const context = readAndParseFromDirectory(dir('context'));
    const sysprompt = readAndParseFromDirectory(dir('sysprompt'));
    const reasoning = readAndParseFromDirectory(dir('reasoning'));
    // 268~285의 같은 이름 · 같은 차례. 실리 브라우저는 이 답을 JSON으로 받아요: 같은 모양이 되게 한 번 JSON으로 거쳐요.
    return JSON.parse(JSON.stringify({
        koboldai_settings,
        koboldai_setting_names,
        novelai_settings,
        novelai_setting_names,
        openai_settings,
        openai_setting_names,
        textgenerationwebui_presets,
        textgenerationwebui_preset_names,
        instruct,
        context,
        sysprompt,
        reasoning,
    }));
}

// ---------- settings.json → 옮긴 실리 코드의 전역 값 ----------

// {이름: 번호} (실리 kai-settings.js 106~110 · nai-settings.js 224~228 · openai.js 4327~4335)
const nameIndex = (names) => {
    const out = {};
    names.forEach(function (item, i) {
        out[item] = i;
    });
    return out;
};

// jQuery 3의 <select multiple>에 .val(값)을 넣고 .val()로 읽은 것: 값은 글자로 바꿔 맞추고, 화면 옵션 차례로, 맞는 것이 없으면 [].
const multiSelectValue = (options, value) => {
    const values = value == null ? [''] : Array.isArray(value) ? value.map(x => (x == null ? '' : x + '')) : [typeof value === 'number' ? value + '' : value];
    return options.filter(o => values.includes(o));
};
// 실리 index.html 2504~2514 #openrouter_quantizations_text의 옵션 값 (화면에 박혀 있는 목록)
const OPENROUTER_QUANTIZATION_OPTIONS = ['int4', 'int8', 'fp4', 'fp6', 'fp8', 'fp16', 'bf16', 'fp32', 'unknown'];

// textgen-settings.js setSettingByName 1199~1280의 값 부분 (loadTextGenSettings 590은 trigger 없이 불러요: 숫자 · 글 칸은 화면에만 넣어요)
function setTextGenSettingValue(tg, setting, value) {
    if ('extensions' === setting) {
        value = value || {};
        tg.extensions = value;
        return;
    }
    if ('json_schema' === setting) {
        tg.json_schema = value ?? null;
        return;
    }
    if (value === null || value === undefined) {
        return;
    }
    if ('sampler_order' === setting) {
        value = Array.isArray(value) ? value : TG.KOBOLDCPP_ORDER;
        tg.sampler_order = value;
        return;
    }
    if ('sampler_priority' === setting) {
        value = Array.isArray(value) ? value : TG.OOBA_DEFAULT_ORDER;
        TG.insertMissingArrayItems(TG.OOBA_DEFAULT_ORDER, value);
        tg.sampler_priority = value;
        return;
    }
    if ('samplers_priorities' === setting) {
        value = Array.isArray(value) ? value : TG.APHRODITE_DEFAULT_ORDER;
        TG.insertMissingArrayItems(TG.APHRODITE_DEFAULT_ORDER, value);
        tg.samplers_priorities = value;
        return;
    }
    if ('samplers' === setting) {
        value = Array.isArray(value) ? value : TG.LLAMACPP_DEFAULT_ORDER;
        TG.insertMissingArrayItems(TG.LLAMACPP_DEFAULT_ORDER, value);
        tg.samplers = value;
        return;
    }
    if ('logit_bias' === setting) {
        tg.logit_bias = Array.isArray(value) ? value : [];
        return;
    }
    // 1254~1260: 체크칸(index.html 1661 #send_banned_tokens_textgenerationwebui)에 Boolean(value)를 넣고 change → 814~820
    // toggleBannedStringsKillSwitch(!!checked) → 509 settings.send_banned_tokens. 다른 칸은 화면에만 넣어요
    // (1267 ZenSlider는 power_user.enableZenSliders일 때만: 이때 power_user는 아직 기본값(false)이에요. script.js 7958이 7966보다 먼저)
    if ('send_banned_tokens' === setting) {
        tg.send_banned_tokens = Boolean(value);
    }
}

// textgen-settings.js loadTextGenSettings 552~608의 값 부분 (script.js 7958: loadOpenAISettings보다 먼저)
function loadTextGenSettingsValues(data, loadedSettings) {
    // 553 loadApiSelectedSamplers: 화면에 보일 샘플러만 정해요(요청에 안 닿음)
    if (data) {
        TG.__naSet({
            textgenerationwebui_presets: TG.convertPresets(data.textgenerationwebui_presets),
            textgenerationwebui_preset_names: data.textgenerationwebui_preset_names ?? [],
        });
    }
    // 556: 기본값 위에 Object.assign (서버는 일마다 기본값에서 새로. 저장 값은 복사해서: 아래에서 고쳐도 일꾼의 settings가 바뀌지 않게)
    TG.__naSet({ textgenerationwebui_settings: structuredClone(loadedSettings.textgenerationwebui_settings ?? {}) });
    const tg = TG.textgenerationwebui_settings;
    // 558~563: 옛 주소 하나 → 종류마다 (실리는 loadedSettings에서 그 칸을 지워요. 서버는 저장하지 않아서 지우지 않아요)
    if (loadedSettings.api_server_textgenerationwebui) {
        for (const type of Object.keys(TG.SERVER_INPUTS)) {
            tg.server_urls[type] = loadedSettings.api_server_textgenerationwebui;
        }
    }
    // 565~571: 주소 칸은 사용자가 고칠 때만 값을 써요
    // 573~575
    if (loadedSettings.api_use_mancer_webui) {
        tg.type = TG.MANCER;
    }
    // 588~591
    for (const i of TG.setting_names) {
        const value = tg[i];
        setTextGenSettingValue(tg, i, value);
    }
    // 594~595: 화면의 여러 고르기 칸에 넣고 change → 1063~1092가 그 칸에서 고른 것을 다시 settings에 써요.
    // 공급자 칸의 옵션은 textgen-models.js initTextGenModels 1403~1409(OPENROUTER_PROVIDERS), 양자화 칸은 index.html 2504~2514.
    tg.openrouter_providers = multiSelectValue(TGM.OPENROUTER_PROVIDERS, tg.openrouter_providers);
    tg.openrouter_quantizations = multiSelectValue(OPENROUTER_QUANTIZATION_OPTIONS, tg.openrouter_quantizations);
    // 597 (그리고 598 displayLogitBias 49)
    BIAS_CACHE.delete(TG.BIAS_KEY);
    // 600~607: 디버그 메뉴 등록(localStorage의 Mancer 주소): 서버는 기본 주소
}

// power-user.js loadPowerUserSettings 1554~1819 중 요청에 닿는 값 부분 (power_user 자체는 PU.__naSet: 1566 Object.assign).
// 뺀 것: 1555~1602 stscript · 1604~1611 테마 · 1617~1627 화면 · 1633~1637 태그 (요청에 안 닿음).
function loadPowerUserValues(data) {
    const power_user = PU.power_user;
    // 1613~1615
    if (data && data.context !== undefined) {
        PU.__naSet({ context_presets: data.context });
    }
    // 1629~1631 (실리 1.19.1 tokenizers에는 LEGACY가 없어요: undefined와 비교. 그대로)
    if (power_user.tokenizer === TOK.tokenizers.LEGACY) {
        power_user.tokenizer = TOK.tokenizers.GPT2;
    }
    // 1639~1642
    if (power_user?.instruct?.derived === true) {
        power_user.instruct_derived = true;
        delete power_user.instruct.derived;
    }
    // 1645
    power_user.chat_template_hash = '';

    // 1808 instruct-mode.js loadInstructMode 111~157
    if (data && data.instruct !== undefined) {
        INS.__naSet({ instruct_presets: data.instruct });
    }
    INS.migrateInstructModeSettings(power_user.instruct);
    // 123~147: 칸마다 화면에 넣어요. trigger가 있는 것(46 system_same_as_user, 체크칸)만 다시 읽어서 써요: 137 !!checked
    power_user.instruct.system_same_as_user = !!power_user.instruct.system_same_as_user;

    // 1809 loadContextSettings 1944~2026
    PU.autoFixStoryString(power_user.context);
    for (const control of PU.contextControls) {
        if (control.isGlobalSetting) {
            continue;
        }
        if (control.defaultValue !== undefined && power_user.context[control.property] === undefined) {
            power_user.context[control.property] = control.defaultValue;
        }
        // 2023~2025 → 2006~2015: trigger가 있는 것은 context_story_string_position 하나(index.html 4164~4167 고르기 칸, 옵션 '0' · '1').
        // 칸에 넣고(맞는 옵션이 없으면 아무것도 안 골라져서 .val()이 null) 다시 읽어 숫자로(defaultValue가 숫자)
        if (control.trigger) {
            const v = power_user.context[control.property];
            const s = v == null ? '' : (typeof v === 'number' ? v + '' : v);
            let value = ['0', '1'].includes(s) ? s : null;
            if (typeof control.defaultValue === 'number') {
                value = Number(value);
            }
            power_user.context[control.property] = value;
        }
    }

    // 1810 sysprompt.js loadSystemPrompts 50~69 · migrateSystemPromptFromInstructMode 23~45
    if (data && data.sysprompt !== undefined) {
        SYS.__naSet({ system_prompts: data.sysprompt });
    }
    if ('system_prompt' in power_user.instruct) {
        const prompt = String(power_user.instruct.system_prompt);
        delete power_user.instruct.system_prompt;
        power_user.sysprompt.enabled = power_user.instruct.enabled;
        power_user.sysprompt.content = prompt;
        power_user.sysprompt.post_history = '';
        const existingPromptName = SYS.system_prompts.find(x => x.content === prompt)?.name;
        // (실리는 없으면 그 이름으로 sysprompt 프리셋 파일을 저장해요(savePreset). 서버는 파일을 쓰지 않아요)
        power_user.sysprompt.name = existingPromptName ? existingPromptName : `[Migrated] ${power_user.instruct.preset}`;
    }

    // 1811 reasoning.js loadReasoningTemplates 1655~1689
    if (data && data.reasoning !== undefined) {
        REA.reasoning_templates.splice(0, REA.reasoning_templates.length, ...data.reasoning);
    }
    if (power_user.reasoning.name === undefined) {
        const defaultTemplate = REA.reasoning_templates.find(p => p.name === REA.DEFAULT_REASONING_TEMPLATE);
        if (defaultTemplate) {
            if (power_user.reasoning.prefix !== defaultTemplate.prefix || power_user.reasoning.suffix !== defaultTemplate.suffix || power_user.reasoning.separator !== defaultTemplate.separator) {
                // (실리는 이 이름으로 reasoning 프리셋 파일을 저장해요. 서버는 파일을 쓰지 않아요)
                power_user.reasoning.name = '[Migrated] Custom';
            } else {
                power_user.reasoning.name = defaultTemplate.name;
            }
        } else {
            power_user.reasoning.name = '';
        }
    }
}

// openai.js loadOpenAISettings 4340~4404 중 화면 칸을 거쳐 값이 바뀌는 것. 4340~4367은 settingsToUpdate의 칸마다 값을 넣기만 하고,
// 4378~4394 · 4401~4403이 칸 몇 개에 change를 일으켜서 그 칸에서 고른 것을 다시 oai_settings에 써요.
function loadOpenAISettingsValues(oai_settings) {
    // 4378~4393: 바이어스 항목에 id가 없으면 채우고(무작위: 실리 서버의 /bias는 id를 안 써요), 옵션마다 selected = (이름 === 고른 이름)
    for (const preset of Object.keys(oai_settings.bias_presets)) {
        if (Array.isArray(oai_settings.bias_presets[preset])) {
            oai_settings.bias_presets[preset].forEach((bias) => {
                if (bias && !bias.id) {
                    bias.id = uuidv4();
                }
            });
        }
    }
    // 4394 → onLogitBiasPresetChange 4634~4643: 고른 옵션의 값. 고른 옵션이 없으면 브라우저는 하나 고르기 칸의 첫 옵션을 골라요(옵션이 없으면 'undefined')
    const biasNames = Object.keys(oai_settings.bias_presets);
    const value = String(biasNames.includes(oai_settings.bias_preset_selected) ? oai_settings.bias_preset_selected : biasNames[0]);
    if (!Array.isArray(oai_settings.bias_presets[value])) {
        console.error('Preset not found');
    } else {
        oai_settings.bias_preset_selected = value;
    }
    // 4401~4402 → 7263~7286: 여러 고르기 칸(공급자: index.html 3242, 옵션은 textgen-models.js 1403~1409 OPENROUTER_PROVIDERS · 양자화: index.html 3255~3265)
    oai_settings.openrouter_providers = multiSelectValue(TGM.OPENROUTER_PROVIDERS, oai_settings.openrouter_providers);
    oai_settings.openrouter_quantizations = multiSelectValue(OPENROUTER_QUANTIZATION_OPTIONS, oai_settings.openrouter_quantizations);
    // 4403 → 7290~7294: 하나 고르기 칸(index.html 3662 'Auto' = '' 다음에 textgen-models.js 1411~1416 NANOGPT_PROVIDERS의 id). 맞는 옵션이 없으면 .val()이 null → ''
    const nanoValue = oai_settings.nanogpt_provider;
    const nanoText = nanoValue == null ? '' : (typeof nanoValue === 'number' ? nanoValue + '' : nanoValue);
    oai_settings.nanogpt_provider = String(['', ...TGM.NANOGPT_PROVIDERS.map(p => p.id)].includes(nanoText) ? nanoText : '');
    // 4404 → 6967~6977: #chat_completion_source의 고른 값(저장된 소스가 옵션에 있으면 그대로). 그 밖의 줄은 화면 · 상태 확인
}

// 실리 extensions/connection-manager/index.js 27~30의 DEFAULT_SETTINGS
const CONNECTION_MANAGER_DEFAULT_SETTINGS = {
    profiles: [],
    selectedProfile: null,
};

/**
 * settings.json(실리 /api/settings/get의 settings)과 프리셋 목록(naLoadPresets)을 옮긴 실리 코드에 채워요.
 * data가 없으면 프리셋 목록(OpenAI · TextGen · instruct · context · sysprompt · reasoning · Kobold · NovelAI)은 건드리지 않아요.
 * @param {object} settings settings.json을 읽은 것
 * @param {object} [data] naLoadPresets(사용자 폴더)가 돌려준 것
 */
export function naLoad(settings, data) {
    settings = obj(settings) ? settings : {};
    data = obj(data) ? data : undefined;
    // script.js 7935: accountStorage.init(settings?.accountStorage)
    ACC.__naSet({ accountStorage: settings.accountStorage });
    // script.js 7943~7945: amount_gen · max_context
    // (max_context: kept as it was when settings.json has none — on the server, as the page starts: SillyTavern's own starting value, not the last job's)
    SCRIPT.__naSet({ amount_gen: settings.amount_gen, max_context: settings.max_context !== undefined ? parseInt(settings.max_context) : MAX_CONTEXT_START });

    if (data) {
        // script.js 7952 loadKoboldSettings · 7955 loadNovelSettings의 프리셋 목록 부분 (kai-settings.js 98~110, nai-settings.js 216~229)
        KAI.__naSet({ koboldai_settings: data.koboldai_settings.map(item => JSON.parse(item)), koboldai_setting_names: nameIndex(data.koboldai_setting_names) });
        NAI.__naSet({ novelai_settings: data.novelai_settings.map(item => JSON.parse(item)), novelai_setting_names: nameIndex(data.novelai_setting_names) });
    }

    // script.js 7958 loadTextGenSettings(data, settings)
    loadTextGenSettingsValues(data, settings);
    // ({{banned "…"}} words: SillyTavern empties the list after each generation — a page starts with none. A job starts with none too)
    TG.__naSet({ textgenerationwebui_banned_in_macros: [] });

    // openai.js loadOpenAISettings(data, settings.oai_settings ?? settings) — script.js 7961. 프리셋 목록(4321~4336), 그리고 값을 정하는 줄 (4338~4341):
    //   migrateChatCompletionSettings(settings); for (const key of Object.keys(default_settings)) oai_settings[key] = settings[key] ?? default_settings[key];
    // (실리의 oai_settings는 structuredClone(default_settings)로 시작해서 그 키만 채워요. 서버는 일마다 비우고 다시 채워요. 기본값은 일마다 새로 복사해요:
    //  실리는 기본값 객체를 그대로 넣지만, 서버는 여러 번 채워서 앞 일이 고친 것이 남지 않게)
    if (data) {
        OAI.__naSet({ openai_settings: data.openai_settings.map(item => JSON.parse(item)), openai_setting_names: nameIndex(data.openai_setting_names) });
    }
    const s = structuredClone(settings.oai_settings ?? settings);
    OAI.migrateChatCompletionSettings(s);
    for (const key of Object.keys(OAI.oai_settings)) delete OAI.oai_settings[key];
    for (const key of Object.keys(OAI.default_settings)) OAI.oai_settings[key] = s[key] ?? structuredClone(OAI.default_settings[key]);
    // setContinuePostfixControls 4427~4451: 정해진 값이 아니면 SPACE ("Prevent preset value abuse")
    if (!Object.values(OAI.continue_postfix_types).includes(OAI.oai_settings.continue_postfix)) OAI.oai_settings.continue_postfix = OAI.continue_postfix_types.SPACE;
    loadOpenAISettingsValues(OAI.oai_settings);
    // (로짓 바이어스 결과는 실리가 프리셋을 바꿀 때 비워요(biasCache = undefined). 서버는 일마다 새로)
    OAI.__naSet({ biasCache: undefined, model_list: [] });

    // script.js 7966: loadPowerUserSettings — 기본값 위에 저장된 값, 그리고 요청에 닿는 값 부분
    PU.__naSet({ power_user: obj(settings.power_user) ? structuredClone(settings.power_user) : {} });
    loadPowerUserValues(data);
    naInit();

    // openai.js loadProxyPresets(settings) 6487~6507 · setProxyPreset 6509~6527 — script.js 7979 (loadOpenAISettings 뒤)
    let proxies = [{ name: 'None', url: '', password: '' }];
    let selected = settings.selected_proxy || proxies[0];
    let presets = settings.proxies;
    if (!Array.isArray(presets) || presets.length === 0) presets = proxies;
    else proxies = structuredClone(presets);
    const preset = proxies.find(p => p.name === selected.name);
    if (preset) {
        preset.url = selected.url;
        preset.password = selected.password;
        selected = preset;
    } else {
        const added = { name: selected.name, url: selected.url, password: selected.password };
        proxies.push(added);
        selected = added;
    }
    OAI.oai_settings.reverse_proxy = selected.url;
    OAI.oai_settings.proxy_password = selected.password;
    OAI.__naSet({ proxies, selected_proxy: selected });

    // script.js 7992~8000: 쓰는 API (없으면 kobold, 옛 poe는 openai)
    let api = settings.main_api;
    if (api == undefined) api = 'kobold';
    if (api == 'poe') api = 'openai';
    SCRIPT.__naSet({ main_api: api });

    // script.js 8021~8031 · extensions.js loadExtensionSettings 1783~1786: 기본값 위에 Object.assign
    // (data.enable_extensions = 실리 config.yaml extensions.enabled, 기본 true. 서버는 켜진 것으로 봐요)
    EXT.__naSet({ extension_settings: structuredClone(settings.extension_settings ?? {}) });
    // 그 뒤 activateExtensions: 꺼진 확장 목록에 없으면 connection-manager/index.js init 698~714의 값 부분
    const extension_settings = EXT.extension_settings;
    if (!extension_settings.disabledExtensions.includes('connection-manager')) {
        extension_settings.connectionManager = extension_settings.connectionManager || structuredClone(CONNECTION_MANAGER_DEFAULT_SETTINGS);
        for (const key of Object.keys(CONNECTION_MANAGER_DEFAULT_SETTINGS)) {
            if (extension_settings.connectionManager[key] === undefined) {
                extension_settings.connectionManager[key] = structuredClone(CONNECTION_MANAGER_DEFAULT_SETTINGS[key]);
            }
        }
        // 714 renderConnectionProfiles 449: 화면 목록을 만들면서 프로필 배열 자체를 이름 차례로 정렬해요(getSupportedProfiles 차례가 이것)
        extension_settings.connectionManager.profiles.sort((a, b) => a.name.localeCompare(b.name));
    }
}

// 한 번의 요청 사이에 실리 코드가 바꾸는 전역 값 (naSendRequest가 다시 할 때 되돌려요)
function naKeep() {
    return {
        banned: [...TG.textgenerationwebui_banned_in_macros],
        bias: [...BIAS_CACHE.entries()],
        oaiBias: OAI.biasCache,
        chatMetadata: structuredClone(SCRIPT.chat_metadata),
        variables: structuredClone(EXT.extension_settings.variables),
    };
}
function naRestore(k) {
    TG.__naSet({ textgenerationwebui_banned_in_macros: k.banned });
    BIAS_CACHE.clear();
    for (const [key, value] of k.bias) BIAS_CACHE.set(key, value);
    OAI.__naSet({ biasCache: k.oaiBias });
    const meta = SCRIPT.chat_metadata;
    for (const key of Object.keys(meta)) delete meta[key];
    Object.assign(meta, k.chatMetadata);
    EXT.extension_settings.variables = k.variables;
}

/**
 * 실리 ConnectionManagerRequestService.sendRequest(extensions/shared.js 423~492)를 서버에서 불러요. 인자는 실리와 같아요.
 * 실리 브라우저가 동기 요청(XHR)으로 받는 토큰 답(금지 토큰 · 로짓 바이어스, tokenizers.js)이 필요하면: 처음 해 보고(아무것도 보내지 않고 멈춤),
 * 그 답을 다리로 받아 둔 뒤(naAjaxFill) 바뀐 전역 값을 되돌리고 다시 해요. 필요 없으면 한 번에 보내요. 세 번째에도 모자라면(매크로가 할 때마다 다른
 * 글을 만드는 등) 보내지 않고 오류예요.
 * 먼저: naLoad(settings, await naLoadPresets(사용자 폴더)), SCRIPT.__naSet({ name1, name2, … }), __naSetFetch(다리).
 */
export async function naSendRequest(profileId, prompt, maxTokens, custom, overridePayload) {
    const pristine = structuredClone(prompt);
    for (let pass = 1; ; pass++) {
        const keep = naKeep();
        try {
            return await ConnectionManagerRequestService.sendRequest(profileId, pass === 1 ? prompt : structuredClone(pristine), maxTokens, custom, overridePayload);
        } catch (err) {
            const wait = err instanceof NaAjaxWait || err?.cause instanceof NaAjaxWait;
            if (!wait || pass >= 3) throw err;
            // (기다림은 실패가 아니에요: 다시 하기 전에 그 표시를 지워요. 세 번째에도 기다리면 남겨요)
            for (let i = naFetchFailures.length - 1; i >= 0; i--) if (naFetchFailures[i].reason === 'wait') naFetchFailures.splice(i, 1);
            naRestore(keep);
            await naAjaxFill();
        }
    }
}
