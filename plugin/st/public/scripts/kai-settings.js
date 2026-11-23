// 실리 1.19.1 public/scripts/kai-settings.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
import { abortStatusCheck, getRequestHeaders, main_api, resultCheckStatus, setOnlineStatus } from '../script.js';
import { versionCompare } from './utils.js';
import { naFetch as fetch } from '../naFetch.js';

// 실리 public/scripts/kai-settings.js 25~26
export let koboldai_settings;
export let koboldai_setting_names;

// 실리 public/scripts/kai-settings.js 28~50
export const kai_settings = {
    temp: 1,
    rep_pen: 1,
    rep_pen_range: 0,
    top_p: 1,
    min_p: 0,
    top_a: 1,
    top_k: 0,
    typical: 1,
    tfs: 1,
    rep_pen_slope: 0.9,
    streaming_kobold: false,
    sampler_order: [0, 1, 2, 3, 4, 5, 6],
    mirostat: 0,
    mirostat_tau: 5.0,
    mirostat_eta: 0.1,
    use_default_badwordsids: false,
    grammar: '',
    seed: -1,
    api_server: '',
    preset_settings: 'gui',
    extensions: {},
};

// 실리 public/scripts/kai-settings.js 52~65
/**
 * Stable version of KoboldAI has a nasty payload validation.
 * It will reject any payload that has a key that is not in the whitelist.
 * @typedef {Object.<string, boolean>} kai_flags
 */
export const kai_flags = {
    can_use_tokenization: false,
    can_use_stop_sequence: false,
    can_use_streaming: false,
    can_use_default_badwordsids: false,
    can_use_mirostat: false,
    can_use_grammar: false,
    can_use_min_p: false,
};

// 실리 public/scripts/kai-settings.js 69~75
const MIN_STOP_SEQUENCE_VERSION = '1.2.2';
const MIN_UNBAN_VERSION = '1.2.4';
const MIN_STREAMING_KCPPVERSION = '1.30';
const MIN_TOKENIZATION_KCPPVERSION = '1.41';
const MIN_MIROSTAT_KCPPVERSION = '1.35';
const MIN_GRAMMAR_KCPPVERSION = '1.44';
const MIN_MIN_P_KCPPVERSION = '1.48';

// 실리 public/scripts/kai-settings.js 379~387
export function setKoboldFlags(koboldUnitedVersion, koboldCppVersion) {
    kai_flags.can_use_stop_sequence = versionCompare(koboldUnitedVersion, MIN_STOP_SEQUENCE_VERSION);
    kai_flags.can_use_streaming = versionCompare(koboldCppVersion, MIN_STREAMING_KCPPVERSION);
    kai_flags.can_use_tokenization = versionCompare(koboldCppVersion, MIN_TOKENIZATION_KCPPVERSION);
    kai_flags.can_use_default_badwordsids = versionCompare(koboldUnitedVersion, MIN_UNBAN_VERSION);
    kai_flags.can_use_mirostat = versionCompare(koboldCppVersion, MIN_MIROSTAT_KCPPVERSION);
    kai_flags.can_use_grammar = versionCompare(koboldCppVersion, MIN_GRAMMAR_KCPPVERSION);
    kai_flags.can_use_min_p = versionCompare(koboldCppVersion, MIN_MIN_P_KCPPVERSION);
    const isKoboldCpp = versionCompare(koboldCppVersion, '1.0.0');
    // (실리 388: 화면의 koboldcpp 안내)
}

// 실리 public/scripts/kai-settings.js 406~409
export async function getStatusKobold() {
    let endpoint = kai_settings.api_server;

    if (!endpoint) {
        // (실리 410 console.warn('No endpoint for status check'): 서버는 plugin/st/nastatus.js가 한 번만 "상태를 확인할 주소가 없습니다.")
// 실리 public/scripts/kai-settings.js 411~433
        setOnlineStatus('no_connection');
        return resultCheckStatus();
    }

    try {
        const response = await fetch('/api/backends/kobold/status', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                main_api,
                api_server: endpoint,
            }),
            signal: abortStatusCheck.signal,
        });

        const data = await response.json();

        setOnlineStatus(data?.model ?? 'no_connection');

        if (!data.koboldUnitedVersion) {
            throw new Error(`Missing mandatory Kobold version in data: ${JSON.stringify(data)}`);
        }

        // (실리 434~435 autoSelectInstructPreset: 지시 형식 · 문맥 프리셋 자동 고르기. 브라우저가 고르고 settings.json에 저장해요. 서버는 그 값을 써요)
// 실리 public/scripts/kai-settings.js 436~439

        // determine if we can use stop sequence and streaming
        setKoboldFlags(data.koboldUnitedVersion, data.koboldCppVersion);

        // (실리 440~443: 화면 알림)
// 실리 public/scripts/kai-settings.js 444~444
    } catch (err) {
        // (실리 445 console.error: 서버는 plugin/st/nastatus.js가 한 번만 "상태를 가져오는 중 오류가 발생했습니다.")
// 실리 public/scripts/kai-settings.js 446~450
        setOnlineStatus('no_connection');
    }

    return resultCheckStatus();
}

const __naDefault_kai_flags = structuredClone(kai_flags);

/**
 * koboldai_settings · koboldai_setting_names는 실리 loadKoboldSettings 98~110의 값(프리셋 객체 배열 · {이름: 번호}).
 * kai_flags: 실리 57~65(페이지를 열면 모두 false, getStatusKobold → setKoboldFlags가 정해요). 기본값 위에 Object.assign.
 * @param {{koboldai_settings?: object[], koboldai_setting_names?: object, kai_flags?: object}} v
 */
export function __naSet(v) {
    if (Object.hasOwn(v, 'koboldai_settings')) koboldai_settings = v.koboldai_settings;
    if (Object.hasOwn(v, 'koboldai_setting_names')) koboldai_setting_names = v.koboldai_setting_names;
    if (Object.hasOwn(v, 'kai_flags')) {
        for (const key of Object.keys(kai_flags)) delete kai_flags[key];
        Object.assign(kai_flags, structuredClone(__naDefault_kai_flags), v.kai_flags);
    }
}
