// 실리 1.19.1 public/scripts/nai-settings.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
// 실리 public/scripts/nai-settings.js 24~25
const default_preamble = '[ Style: chat, complex, sensory, visceral ]';
const default_order = [1, 5, 0, 2, 3, 4];

// 실리 public/scripts/nai-settings.js 36~62
export const nai_settings = {
    temperature: 1.5,
    repetition_penalty: 2.25,
    repetition_penalty_range: 2048,
    repetition_penalty_slope: 0.09,
    repetition_penalty_frequency: 0,
    repetition_penalty_presence: 0.005,
    tail_free_sampling: 0.975,
    top_k: 10,
    top_p: 0.75,
    top_a: 0.08,
    typical_p: 0.975,
    min_p: 0,
    math1_temp: 1,
    math1_quad: 0,
    math1_quad_entropy_scale: 0,
    min_length: 1,
    model_novel: 'clio-v1',
    preset_settings_novel: 'Talker-Chat-Clio',
    streaming_novel: false,
    preamble: default_preamble,
    prefix: '',
    banned_tokens: '',
    order: default_order,
    logit_bias: [],
    extensions: {},
};

// 실리 public/scripts/nai-settings.js 84~84
let novel_data = null;

// 실리 public/scripts/nai-settings.js 92~103
export function getKayraMaxContextTokens() {
    switch (novel_data?.tier) {
        case 1:
            return 4096;
        case 2:
            return 8192;
        case 3:
            return 8192;
    }

    return null;
}

const __naDefault_nai_settings = structuredClone(nai_settings);

/**
 * @param {{nai_settings?: object, novel_data?: object|null}} v
 */
export function __naSet(v) {
    if (Object.hasOwn(v, 'nai_settings')) {
        for (const key of Object.keys(nai_settings)) delete nai_settings[key];
        Object.assign(nai_settings, structuredClone(__naDefault_nai_settings), v.nai_settings);
    }
    if (Object.hasOwn(v, 'novel_data')) novel_data = v.novel_data;
}
