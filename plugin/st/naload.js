// 우리 것: 실리 브라우저가 settings.json을 읽어 들고 있는 값을 서버의 옮긴 실리 코드(plugin/st/public)에 채워요.
// 실리 브라우저는 페이지를 열 때 한 번 읽고(script.js getSettings 7911~8048), 바꿀 때마다 settings.json에 저장해요. 서버는 일마다 그 파일을 새로 읽어서
// 같은 순서로 채워요. 화면(DOM) 줄은 빼고 값을 정하는 줄만 따라 했어요. 줄 번호는 실리 1.19.1이에요.
// (power-user.js 먼저: 실리 브라우저가 부르는 차례. script.js를 먼저 부르면 서로 부르는 import 때문에 power_user 기본값을 못 만들어요)
import * as PU from './public/scripts/power-user.js';
import * as ACC from './public/scripts/util/AccountStorage.js';
import * as SCRIPT from './public/script.js';
import * as OAI from './public/scripts/openai.js';
import * as SC from './public/scripts/st-context.js';
import { initMacros } from './public/scripts/macros.js';

const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);

// 매크로 등록 (실리 initMacros, macros.js 719~747: 페이지를 열 때 한 번, power_user를 읽은 뒤). 변수 매크로는 등록할 때
// SillyTavern.getContext()를 잡아 둬요(variable-macros.js 10): 그때만 변수 묶음을 주는 getContext를 끼워요.
// 실리는 옛 엔진(experimental_macro_engine 꺼짐)일 때만 옛 매크로 두 개(isMobile · lastGenerationType)를 더 등록해요. 서버도 처음 읽은
// 설정대로 한 번만 해요: 실리를 켜 둔 채 그 설정을 바꾼 것과 같아요(실리도 다시 열 때까지 그대로예요).
let inited = false;
export function naInit() {
    if (inited) return;
    inited = true;
    const had = globalThis.SillyTavern;
    globalThis.SillyTavern = { getContext: () => ({ variables: SC.variables }) };
    try { initMacros(); } finally { globalThis.SillyTavern = had; }
}

/**
 * settings.json(실리 /api/settings/get의 settings)을 옮긴 실리 코드에 채워요.
 * @param {object} settings settings.json을 읽은 것
 */
export function naLoad(settings) {
    settings = obj(settings) ? settings : {};
    // script.js 7935: accountStorage.init(settings?.accountStorage)
    ACC.__naSet({ accountStorage: settings.accountStorage });
    // script.js 7943~7945: amount_gen · max_context
    SCRIPT.__naSet({ amount_gen: settings.amount_gen, ...(settings.max_context !== undefined ? { max_context: parseInt(settings.max_context) } : {}) });

    // openai.js loadOpenAISettings(data, settings.oai_settings ?? settings) — script.js 7961. 값을 정하는 줄 (4338~4341):
    //   migrateChatCompletionSettings(settings); for (const key of Object.keys(default_settings)) oai_settings[key] = settings[key] ?? default_settings[key];
    // (실리의 oai_settings는 structuredClone(default_settings)로 시작해서 그 키만 채워요. 서버는 일마다 비우고 다시 채워요. 기본값은 일마다 새로 복사해요:
    //  실리는 기본값 객체를 그대로 넣지만, 서버는 여러 번 채워서 앞 일이 고친 것이 남지 않게)
    const s = structuredClone(settings.oai_settings ?? settings);
    OAI.migrateChatCompletionSettings(s);
    for (const key of Object.keys(OAI.oai_settings)) delete OAI.oai_settings[key];
    for (const key of Object.keys(OAI.default_settings)) OAI.oai_settings[key] = s[key] ?? structuredClone(OAI.default_settings[key]);
    // setContinuePostfixControls 4427~4451: 정해진 값이 아니면 SPACE ("Prevent preset value abuse")
    if (!Object.values(OAI.continue_postfix_types).includes(OAI.oai_settings.continue_postfix)) OAI.oai_settings.continue_postfix = OAI.continue_postfix_types.SPACE;
    // (로짓 바이어스 결과는 실리가 프리셋을 바꿀 때 비워요(biasCache = undefined). 서버는 일마다 새로)
    OAI.__naSet({ biasCache: undefined, model_list: [] });

    // script.js 7966: loadPowerUserSettings — 기본값 위에 저장된 값
    PU.__naSet({ power_user: obj(settings.power_user) ? settings.power_user : {} });
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
}
