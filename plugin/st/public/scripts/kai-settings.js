// 실리 1.19.1 public/scripts/kai-settings.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
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

/**
 * koboldai_settings · koboldai_setting_names는 실리 loadKoboldSettings 98~110의 값(프리셋 객체 배열 · {이름: 번호}).
 * @param {{koboldai_settings?: object[], koboldai_setting_names?: object}} v
 */
export function __naSet(v) {
    if (Object.hasOwn(v, 'koboldai_settings')) koboldai_settings = v.koboldai_settings;
    if (Object.hasOwn(v, 'koboldai_setting_names')) koboldai_setting_names = v.koboldai_setting_names;
}
