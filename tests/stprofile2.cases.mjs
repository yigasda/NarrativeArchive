// 연결 프로필 요청(실리 ConnectionManagerRequestService.sendRequest)을 실리 브라우저와 대 보는 경우들 (tests/stprofile2.test.mjs · tools/st/oracle-profile.mjs가 같이 써요).
// 예시 캐릭터만. 키 · 진짜 연결 없음: 요청은 보내지 않고 잡아요(브라우저는 window.fetch, 서버는 __naSetFetch).
// settings: settings.json 모양. 실리 브라우저는 임시 데이터 폴더의 settings.json으로 페이지를 열어 읽고, 서버는 plugin/st/naload.js naLoad로 읽어요.
// PRESETS: 두 쪽이 같이 읽는 프리셋 파일(사용자 폴더의 폴더 이름 → 파일 이름 → 내용). 지시 틀 셋은 실리 1.19.1 default/content/presets/instruct의 것 그대로.
import fs from 'node:fs';
import path from 'node:path';

export const NAME1 = 'Ren', NAME2 = 'Mara';
export const PROXY_URL = 'https://proxy.example/v1';

const chatml = {
    input_sequence: '<|im_start|>user', output_sequence: '<|im_start|>assistant', last_output_sequence: '', system_sequence: '<|im_start|>system', stop_sequence: '<|im_end|>',
    wrap: true, macro: true, names_behavior: 'force', activation_regex: '', first_output_sequence: '', skip_examples: false, output_suffix: '<|im_end|>\n', input_suffix: '<|im_end|>\n',
    system_suffix: '<|im_end|>\n', user_alignment_message: '', system_same_as_user: false, last_system_sequence: '', first_input_sequence: '', last_input_sequence: '',
    sequences_as_stop_strings: true, story_string_prefix: '<|im_start|>system', story_string_suffix: '<|im_end|>\n', name: 'ChatML',
};
const llama3 = {
    input_sequence: '<|start_header_id|>user<|end_header_id|>\n\n', output_sequence: '<|start_header_id|>assistant<|end_header_id|>\n\n', last_output_sequence: '',
    system_sequence: '<|start_header_id|>system<|end_header_id|>\n\n', stop_sequence: '<|eot_id|>', wrap: false, macro: true, names_behavior: 'force', activation_regex: '',
    first_output_sequence: '', skip_examples: false, output_suffix: '<|eot_id|>', input_suffix: '<|eot_id|>', system_suffix: '<|eot_id|>', user_alignment_message: '',
    system_same_as_user: false, last_system_sequence: '', first_input_sequence: '', last_input_sequence: '', sequences_as_stop_strings: true,
    story_string_prefix: '<|start_header_id|>system<|end_header_id|>\n\n', story_string_suffix: '<|eot_id|>', name: 'Llama 3 Instruct',
};
const alpaca = {
    input_sequence: '### Instruction:', output_sequence: '### Response:', last_output_sequence: '', system_sequence: '### Input:', stop_sequence: '', wrap: true, macro: true,
    names_behavior: 'force', activation_regex: '', first_output_sequence: '', skip_examples: false, output_suffix: '\n\n', input_suffix: '\n\n', system_suffix: '\n\n',
    user_alignment_message: '', system_same_as_user: false, last_system_sequence: '', first_input_sequence: '', last_input_sequence: '', sequences_as_stop_strings: true,
    story_string_prefix: '', story_string_suffix: '\n\n', name: 'Alpaca',
};
const renTC = {
    temp: 0.8, top_p: 0.9, top_k: 20, min_p: 0.05, rep_pen: 1.1, rep_pen_range: 64, genamt: 250, max_length: 4096, seed: 3, typical_p: 0.95,
    sampler_priority: ['temperature', 'top_k', 'top_p'], samplers: ['top_k', 'temperature'], dry_sequence_breakers: '["\\n", "{{char}}:"]',
    negative_prompt: 'not {{user}}', not_a_setting: 1,
};
export const PRESETS = {
    'OpenAI Settings': {
        'Mara CC.json': { temperature: 0.4, top_p: 0.9, openai_max_tokens: 500, frequency_penalty: 0.1, presence_penalty: 0.2, reasoning_effort: 'medium', not_a_setting: 1 },
        'Mara CC Bias.json': { temperature: 0.7, bias_preset_selected: 'Ivo bias', bias_presets: { 'Default (none)': [], 'Ivo bias': [{ text: ' Ivo', value: -50 }, { text: '[15, 16]', value: 5 }] } },
        'Mara CC OR.json': { temperature: 1, openrouter_providers: ['Anthropic', 'Nope'], openrouter_allow_fallbacks: false, bias_preset_selected: 'Ivo bias' },
        'broken.json': '{ not json',
    },
    'TextGen Settings': {
        'Ren TC.json': renTC,
        'Ren TC Bias.json': { ...renTC, logit_bias: [{ text: 'hello', value: 5 }, { text: '[15, 16]', value: -2 }, { text: '{ world}', value: 3 }, { text: '', value: 9 }], banned_tokens: 'Lio\n"Varo"\n[42]\n[1, "x"]' },
        'Ren TC JSON.json': { ...renTC, json_schema: { type: 'object', properties: { a: { type: 'string' } } }, grammar_string: 'root ::= "x"' },
        'Ren TC Dyna.json': { ...renTC, dynatemp: true, min_temp: 0.5, max_temp: 1.5, epsilon_cutoff: 3, eta_cutoff: 2 },
        'Ren TC Seed.json': { ...renTC, seed: 5, top_p: 1.2 },
    },
    'instruct': { 'ChatML.json': chatml, 'Llama 3 Instruct.json': llama3, 'Alpaca.json': alpaca },
    'context': { 'Mara Story.json': { name: 'Mara Story', story_string: '{{description}}', chat_start: '***', example_separator: '***', use_stop_strings: true, names_as_stop_strings: true } },
    'sysprompt': { 'Mara Sys.json': { name: 'Mara Sys', content: 'You are {{char}}.' } },
    'reasoning': { 'Think XML.json': { name: 'Think XML', prefix: '<think>\n', suffix: '\n</think>', separator: '\n\n' } },
    'KoboldAI Settings': { 'Ivo Kobold.json': { temp: 0.7 } },
    'NovelAI Settings': { 'Ivo Novel.json': { temperature: 1 } },
};

/** 프리셋 파일을 사용자 폴더에 써요(폴더 안의 다른 것은 지워요: 두 쪽이 같은 파일만 읽게). */
export function writePresets(userRoot) {
    for (const [folder, files] of Object.entries(PRESETS)) {
        const dir = path.join(userRoot, folder);
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });
        for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), typeof body === 'string' ? body : JSON.stringify(body, null, 4));
    }
}

const P = (id, more) => ({ id, name: `${id} profile`, mode: more.api && !['ooba', 'koboldcpp', 'llamacpp', 'ollama', 'vllm', 'tabby', 'openrouter-text', 'generic', 'mancer', 'huggingface', 'aphrodite'].includes(more.api) ? 'cc' : 'tc', ...more });
export const PROFILES = [
    P('cc-basic', { api: 'openai', model: 'gpt-4o' }),
    P('cc-preset', { api: 'openai', model: 'gpt-4o', preset: 'Mara CC' }),
    P('cc-missing-preset', { api: 'openai', model: 'gpt-4o', preset: 'Nope CC' }),
    P('cc-bias', { api: 'openai', model: 'gpt-4o', preset: 'Mara CC Bias' }),
    P('cc-proxy', { api: 'claude', model: 'claude-3-7-sonnet', preset: 'Mara CC', proxy: 'Lio proxy' }),
    P('cc-custom', { api: 'custom', model: 'm', 'api-url': 'http://127.0.0.1:9/v1', preset: 'Mara CC', 'prompt-post-processing': 'merge', 'secret-id': 'sec-1' }),
    P('cc-deepseek', { api: 'deepseek', model: 'deepseek-chat' }),
    P('cc-google', { api: 'google', model: 'gemini-2.5-pro', preset: 'Mara CC' }),
    P('cc-openrouter', { api: 'openrouter', model: 'openai/gpt-4o', preset: 'Mara CC OR' }),
    P('tc-ooba', { api: 'ooba', preset: 'Ren TC', instruct: 'ChatML', 'api-url': 'http://127.0.0.1:5000' }),
    P('tc-ooba-plain', { api: 'ooba', 'api-url': 'http://127.0.0.1:5000' }),
    P('tc-ooba-preset', { api: 'ooba', preset: 'Ren TC' }),
    P('tc-kcpp', { api: 'koboldcpp', preset: 'Ren TC', instruct: 'Llama 3 Instruct', 'api-url': 'http://127.0.0.1:5001' }),
    P('tc-kcpp-dyna', { api: 'kcpp', preset: 'Ren TC Dyna' }),
    P('tc-llamacpp', { api: 'llamacpp', preset: 'Ren TC Bias', instruct: 'Alpaca', 'api-url': 'http://127.0.0.1:8080' }),
    P('tc-ollama', { api: 'ollama', model: 'x-local-model', preset: 'Ren TC', 'api-url': 'http://127.0.0.1:11434' }),
    P('tc-ollama-nomodel', { api: 'ollama', preset: 'Ren TC' }),
    P('tc-vllm', { api: 'vllm', model: 'x-vllm-model', preset: 'Ren TC Dyna', instruct: 'ChatML' }),
    P('tc-tabby', { api: 'tabby', preset: 'Ren TC JSON', 'api-url': 'http://127.0.0.1:5005' }),
    P('tc-openrouter', { api: 'openrouter-text', model: 'x/y', preset: 'Ren TC' }),
    P('tc-generic', { api: 'generic', preset: 'Ren TC', instruct: 'ChatML', 'api-url': 'http://127.0.0.1:9000/v1' }),
    P('tc-mancer', { api: 'mancer', model: 'mytholite', preset: 'Ren TC Dyna' }),
    P('tc-hf', { api: 'huggingface', preset: 'Ren TC Seed', 'api-url': 'http://127.0.0.1:8081' }),
    P('tc-aphrodite', { api: 'aphrodite', preset: 'Ren TC JSON' }),
    P('tc-missing', { api: 'ooba', preset: 'Nope TC', instruct: 'Nope Instruct' }),
    P('x-novel', { api: 'novel' }),
    P('x-kobold', { api: 'kobold' }),
    P('x-noapi', {}),
];

const TG = { type: 'ooba', server_urls: { ooba: 'http://127.0.0.1:5000', koboldcpp: 'http://127.0.0.1:5001', llamacpp: 'http://127.0.0.1:8080', ollama: 'http://127.0.0.1:11434', vllm: 'http://127.0.0.1:8000', tabby: 'http://127.0.0.1:5005', generic: 'http://127.0.0.1:9000/v1', huggingface: 'http://127.0.0.1:8081', aphrodite: 'http://127.0.0.1:2242' } };
export const BASE = {
    firstRun: false,
    currentVersion: '1.19.1',
    username: NAME1,
    main_api: 'textgenerationwebui',
    max_context: 8192,
    amount_gen: 200,
    power_user: { auto_connect: false },
    textgenerationwebui_settings: TG,
    oai_settings: { chat_completion_source: 'openai', preset_settings_openai: 'Default' },
    proxies: [{ name: 'None', url: '', password: '' }, { name: 'Lio proxy', url: PROXY_URL, password: 'PW' }],
    selected_proxy: { name: 'None', url: '', password: '' },
    extension_settings: { connectionManager: { selectedProfile: null, profiles: PROFILES } },
};
const S = (more = {}) => ({ ...BASE, ...more });
const tg = (more) => ({ textgenerationwebui_settings: { ...TG, ...more } });
const msgs = [{ role: 'system', content: 'You are {{char}}. Talk to {{user}}.' }, { role: 'user', content: 'hi' }];
const all = { stream: false, extractData: true, includePreset: true, includeInstruct: true };
const ccReply = { choices: [{ message: { content: 'ok {{char}}  \n', reasoning_content: 'because' } }] };
const tcReply = { choices: [{ text: 'Hello there  \nRen: next<|im_end|>\n<|im_start|>user', reasoning: 'r1' }], thinking: 't1', response: 'resp' };

// kind: 'send' (sendRequest) · 'supported' (getSupportedProfiles 등) · 'construct' (constructPrompt)
export const CASES = [
    // ---- Chat Completion ----
    { id: 'cc-basic', profile: 'cc-basic' },
    { id: 'cc-preset', profile: 'cc-preset' },
    { id: 'cc-preset-not-included', profile: 'cc-preset', custom: { ...all, includePreset: false } },
    { id: 'cc-preset-missing', profile: 'cc-missing-preset' },
    { id: 'cc-bias-preset', profile: 'cc-bias', tok: true, settings: S({ oai_settings: { chat_completion_source: 'openai', bias_preset_selected: 'Ivo bias', bias_presets: { 'Default (none)': [], 'Ivo bias': [{ text: ' Ivo', value: -50 }] } } }) },
    // (bias_presets is not in settingsToUpdate: the preset's list is not used, the global one has no 'Ivo bias' → no bias)
    { id: 'cc-bias-unknown-selected', profile: 'cc-bias', settings: S({ oai_settings: { chat_completion_source: 'openai', bias_preset_selected: 'Gone', bias_presets: { 'Varo bias': [{ text: ' Varo', value: 7 }], 'Default (none)': [] } } }) },
    { id: 'cc-profile-proxy', profile: 'cc-proxy' },
    { id: 'cc-global-proxy-not-confirmed', profile: 'cc-proxy', settings: S({ selected_proxy: { name: 'Lio proxy', url: PROXY_URL, password: 'PW' } }) },
    { id: 'cc-global-proxy-confirmed', profile: 'cc-proxy', settings: S({ selected_proxy: { name: 'Lio proxy', url: PROXY_URL, password: 'PW' }, accountStorage: { 'Proxy_SkipConfirm_HASH': 'true' } }) },
    { id: 'cc-reasoning-override', profile: 'cc-preset', override: { reasoning_effort: 'high', include_reasoning: true } },
    { id: 'cc-image', profile: 'cc-preset', prompt: [{ role: 'system', content: 'Describe for {{user}}.' }, { role: 'user', content: [{ type: 'text', text: 'what is this' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' } }] }] },
    { id: 'cc-custom-url', profile: 'cc-custom' },
    { id: 'cc-deepseek-reasoning', profile: 'cc-deepseek', settings: S({ oai_settings: { chat_completion_source: 'deepseek' } }) },
    { id: 'cc-deepseek-global-openai', profile: 'cc-deepseek' },
    { id: 'cc-google-alias', profile: 'cc-google', reply: { choices: [{ message: { content: 'g' } }], responseContent: { parts: [{ thought: true, text: 'th' }] } } },
    { id: 'cc-openrouter-preset', profile: 'cc-openrouter', settings: S({ oai_settings: { chat_completion_source: 'openrouter', openrouter_providers: ['Zzz', 'Anthropic', 'AI21'], openrouter_quantizations: ['fp8', 'int4', 'bogus'], nanogpt_provider: 'nope' } }) },
    { id: 'cc-extract-false', profile: 'cc-basic', custom: { ...all, extractData: false } },
    { id: 'cc-error-reply', profile: 'cc-basic', reply: { error: { message: 'Lio says no' } } },
    { id: 'cc-string-prompt', profile: 'cc-basic', prompt: 'hi {{char}}' },
    { id: 'cc-max-tokens-preset-wins', profile: 'cc-preset', maxTokens: 77, override: { temperature: 0.11 } },
    // ---- Text Completion ----
    { id: 'tc-ooba-chatml', profile: 'tc-ooba' },
    { id: 'tc-ooba-plain', profile: 'tc-ooba-plain' },
    { id: 'tc-ooba-preset-names-stop', profile: 'tc-ooba-preset' },
    { id: 'tc-kcpp-llama3', profile: 'tc-kcpp', reply: { results: [{ text: 'x' }], choices: [{ text: 'Sure.<|eot_id|>more' }] } },
    { id: 'tc-kcpp-dyna', profile: 'tc-kcpp-dyna', settings: S(tg({ type: 'koboldcpp' })) },
    { id: 'tc-llamacpp-alpaca-bias', profile: 'tc-llamacpp', tok: true, settings: S(tg({ type: 'llamacpp' })), reply: { content: 'Hi ### Response: there\n### Instruction:\nwho' } },
    { id: 'tc-ollama', profile: 'tc-ollama', settings: S(tg({ type: 'ollama', ollama_model: 'x-ollama-global' })), reply: { response: 'from ollama', thinking: 'hmm' } },
    { id: 'tc-ollama-no-model', profile: 'tc-ollama-nomodel', settings: S(tg({ type: 'ollama' })) },
    { id: 'tc-vllm-chatml', profile: 'tc-vllm', settings: S(tg({ type: 'vllm', n: 3 })) },
    { id: 'tc-tabby-json', profile: 'tc-tabby', settings: S(tg({ type: 'tabby' })) },
    { id: 'tc-openrouter-global-type', profile: 'tc-openrouter', settings: S(tg({ type: 'openrouter', openrouter_providers: ['Zzz', 'Anthropic', 'AI21'], openrouter_quantizations: 'fp8' })) },
    { id: 'tc-openrouter-global-ooba', profile: 'tc-openrouter' },
    { id: 'tc-generic-chatml', profile: 'tc-generic', settings: S(tg({ type: 'generic', generic_model: 'x-gen' })) },
    { id: 'tc-mancer-dyna', profile: 'tc-mancer', settings: S(tg({ type: 'mancer' })) },
    { id: 'tc-hf-seed', profile: 'tc-hf', settings: S(tg({ type: 'huggingface' })) },
    { id: 'tc-aphrodite-json', profile: 'tc-aphrodite', settings: S(tg({ type: 'aphrodite' })) },
    { id: 'tc-custom-stops-macros', profile: 'tc-ooba-preset', settings: S({ power_user: { auto_connect: false, custom_stopping_strings: JSON.stringify(['{{char}} says', '\n{{user}}:', '', 5]), custom_stopping_strings_macro: true } }) },
    { id: 'tc-custom-stops-no-macros', profile: 'tc-ooba', settings: S({ power_user: { auto_connect: false, custom_stopping_strings: JSON.stringify(['{{char}} says']), custom_stopping_strings_macro: false } }) },
    { id: 'tc-single-line', profile: 'tc-ooba-preset', settings: S({ power_user: { auto_connect: false, single_line: true } }) },
    { id: 'tc-context-saved', profile: 'tc-ooba-preset', settings: S({ power_user: { auto_connect: false, context: { preset: 'Mara Story', story_string: '{{description}}', chat_start: '***', example_separator: '---', names_as_stop_strings: false } } }) },
    { id: 'tc-context-use-stop', profile: 'tc-ooba-preset', settings: S({ power_user: { auto_connect: false, context: { preset: 'Mara Story', story_string: '{{description}}', chat_start: '*** {{char}}', example_separator: '---', use_stop_strings: true, names_as_stop_strings: true, story_string_position: 7 } } }) },
    { id: 'tc-global-instruct', profile: 'tc-ooba-preset', settings: S({ power_user: { auto_connect: false, instruct: { ...chatml, enabled: true, preset: 'ChatML', names: true, separator_sequence: '<sep>', system_same_as_user: 1 } } }) },
    { id: 'tc-banned-global', profile: 'tc-ooba-preset', tok: true, settings: S(tg({ banned_tokens: 'Mara\n"Ren"\n{{char}}', global_banned_tokens: '[7, 8]\n[7, 8]', send_banned_tokens: 1 })) },
    { id: 'tc-banned-off', profile: 'tc-ooba-preset', settings: S(tg({ banned_tokens: 'Mara', send_banned_tokens: false })) },
    { id: 'tc-banned-tokenizer-llama3', profile: 'tc-ooba-preset', tok: true, settings: S({ ...tg({ banned_tokens: 'Mara' }), power_user: { auto_connect: false, tokenizer: 12 } }) },
    { id: 'tc-main-api-openai', profile: 'tc-ooba-preset', settings: S({ main_api: 'openai', power_user: { auto_connect: false, custom_stopping_strings: JSON.stringify(['END']) } }) },
    { id: 'tc-missing-instruct-preset', profile: 'tc-missing' },
    { id: 'tc-prefill', profile: 'tc-ooba', prompt: [...msgs, { role: 'assistant', content: 'Sure, {{user}}' }] },
    { id: 'tc-ignore-instruct-message', profile: 'tc-ooba', prompt: [{ role: 'system', content: 'raw', ignoreInstruct: true }, { role: 'user', content: 'hi', name: 'Ivo' }] },
    { id: 'tc-instruct-settings', profile: 'tc-ooba', custom: { ...all, instructSettings: { wrap: false, names_behavior: 'always' } } },
    { id: 'tc-include-instruct-false', profile: 'tc-ooba', custom: { ...all, includeInstruct: false } },
    { id: 'tc-legacy-server-url', profile: 'tc-ooba-preset', settings: S({ api_server_textgenerationwebui: 'http://127.0.0.1:7777', textgenerationwebui_settings: { type: 'ooba' } }) },
    { id: 'tc-sampler-arrays', profile: 'tc-ooba-preset', settings: S(tg({ sampler_priority: ['top_k'], samplers: 'bad', sampler_order: null, logit_bias: 'x', extensions: null, json_schema: undefined })) },
    { id: 'tc-string-prompt', profile: 'tc-ooba', prompt: 'just {{char}}' },
    { id: 'tc-error-reply', profile: 'tc-ooba-plain', reply: { error: { message: 'Varo is offline' } } },
    // ---- 프로필 고르기 · 오류 ----
    { id: 'x-novel-unsupported', profile: 'x-novel' },
    { id: 'x-kobold-unsupported', profile: 'x-kobold' },
    { id: 'x-missing-id', profile: 'no-such-id' },
    { id: 'x-no-api', profile: 'x-noapi' },
    { id: 'x-unknown-api', profile: 'x-bad', settings: S({ extension_settings: { connectionManager: { selectedProfile: null, profiles: [...PROFILES, P('x-bad', { api: 'nonsense' })] } } }) },
    { id: 'x-disabled', profile: 'cc-basic', settings: S({ extension_settings: { disabledExtensions: ['connection-manager'], connectionManager: { selectedProfile: null, profiles: PROFILES } } }) },
    { id: 'x-supported', kind: 'supported' },
    { id: 'x-supported-unknown-api', kind: 'supported', settings: S({ extension_settings: { connectionManager: { selectedProfile: null, profiles: [...PROFILES, P('x-bad', { api: 'nonsense' })] } } }) },
    { id: 'x-supported-disabled', kind: 'supported', settings: S({ extension_settings: { disabledExtensions: ['connection-manager'], connectionManager: { profiles: PROFILES } } }) },
    { id: 'x-construct-tc', kind: 'construct', profile: 'tc-kcpp' },
    { id: 'x-construct-cc', kind: 'construct', profile: 'cc-basic' },
].map(c => ({ kind: 'send', settings: BASE, prompt: msgs, maxTokens: 300, custom: all, reply: c.id.startsWith('cc') ? ccReply : tcReply, ...c }));

// (cc-global-proxy-confirmed: the key is SillyTavern's own — getStringHash of the proxy address)
export function withHash(settings, getStringHash) {
    if (!settings.accountStorage) return settings;
    return { ...settings, accountStorage: Object.fromEntries(Object.entries(settings.accountStorage).map(([k, v]) => [k.replace('HASH', String(getStringHash(PROXY_URL))), v])) };
}

// 생성 요청 길 (여기로 가는 것은 잡아요. 그 밖의 길(토크나이저 · 로짓 바이어스)은 실리 서버로)
export const GENERATE = ['/api/backends/chat-completions/generate', '/api/backends/text-completions/generate'];
// (the /bias request carries random ids SillyTavern backfills into bias entries on load; the server ignores them)
export const callKey = (url, body) => {
    let b = body ?? null;
    try { b = JSON.stringify(JSON.parse(body), (k, v) => (k === 'id' ? undefined : v)); } catch { /* not JSON */ }
    return `${url}\n${b}`;
};
