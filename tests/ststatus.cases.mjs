// 연결 확인(실리 getStatusOpen · getStatusTextgen · getStatusKobold)을 실리 브라우저와 대 보는 경우들 (tests/ststatus.test.mjs · tools/st/oracle-status.mjs가 같이 써요).
// 예시 캐릭터만. 키 없음: 실리 서버의 secrets.json에는 가짜 글만 넣어요(실리가 "키가 있다"고 보게). 공급자는 가짜(FAKE): oracle-status.mjs가 띄워요.
// settings: settings.json 모양. phases: 연결을 몇 번 하는지(at: 첫 연결에서 몇 ms 뒤, provider: 그때 가짜 공급자가 주는 답).
// request: 연결한 뒤 만드는 요청 — 'cc'(createGenerationParameters) · 'tc'(연결 프로필 tc-main의 sendRequest) · 'macro'({{model}}만).
// 모델 이름은 실리의 갈래가 그 글자를 볼 때만(OpenAI 기본 모델 · Google 고정 목록 · DreamGen 'lucid-v1-…' · OpenRouter 토크나이저) 실리의 것을 써요.

export const NAME1 = 'Ren', NAME2 = 'Mara';
// (a fixed address: the expected request bodies carry it)
export const FAKE_PORT = 8131;
export const FAKE = `http://127.0.0.1:${FAKE_PORT}`;
// SillyTavern's server asks these hosts itself (no setting points it elsewhere): oracle-status.mjs sends them to FAKE/h/<host>
export const FAKE_HOSTS = ['openrouter.ai', 'api.electronhub.ai', 'dreamgen.com', 'api.aimlapi.com', 'nano-gpt.com', 'llm.chutes.ai', 'gen.pollinations.ai', 'api.groq.com', 'api.siliconflow.com', 'api.fireworks.ai', 'api.cloudflare.com', 'api.together.xyz', 'api.totalgpt.ai', 'neuro.mancer.tech', 'api.featherless.ai', 'api.cometapi.com'];
// 실리 서버에 넣는 가짜 키 (실리 브라우저의 연결 버튼은 키가 없으면 연결하지 않아요: openai.js onConnectButtonClick 6087~6090)
// (OpenAI · Perplexity have none: the cases where the browser's button does not connect)
export const SECRETS = ['api_key_openrouter', 'api_key_electronhub', 'api_key_azure_openai', 'api_key_claude', 'api_key_aimlapi', 'api_key_nanogpt', 'api_key_chutes', 'api_key_groq', 'api_key_siliconflow', 'api_key_fireworks', 'api_key_workers_ai', 'api_key_pollinations', 'api_key_cometapi'];
export const SECRET_VALUE = 'na-test-not-a-key';
// (later than the server asks again — 24 hours for a cloud list, plugin/st/nastatus.js —: the browser connects again then)
const LATER = 25 * 60 * 60 * 1000;

// ---- 가짜 공급자의 답 ----
const ok = body => ({ status: 200, body });
const down = { status: 500, body: { error: 'Ivo unplugged it' } };
// (a tokenizer of the backend's own: one id per character)
export const ENCODE = {
    ooba: text => ({ tokens: [...text].map(ch => ch.codePointAt(0)), length: [...text].length }),
    koboldcpp: text => ({ value: [...text].length, ids: [...text].map(ch => ch.codePointAt(0)) }),
    llamacpp: text => ({ tokens: [...text].map(ch => ch.codePointAt(0)) }),
};

const PROXY = `${FAKE}/oai/v1`, GPROXY = `${FAKE}/google`;
const proxyOf = url => ({ proxies: [{ name: 'None', url: '', password: '' }, { name: 'Ren proxy', url, password: 'pw' }], selected_proxy: { name: 'Ren proxy', url, password: 'pw' }, accountStorage: { [`Proxy_SkipConfirm_#${url}`]: 'true' } });
const orModels = [
    { id: 'ren/model-l3', name: 'Ren L3', context_length: 8192, architecture: { tokenizer: 'Llama3' }, pricing: { prompt: '0.000001', completion: '0.000002' } },
    { id: 'ren/model-m', name: 'Ivo M', context_length: 32768, architecture: { tokenizer: 'Mistral' }, pricing: { prompt: '0.0000005', completion: '0.000001' } },
    { id: 'ren/model-q', name: 'Lio Q', context_length: 16384, architecture: { tokenizer: 'Qwen' }, pricing: { prompt: '0.000002', completion: '0.000003' } },
];
const ehModels = [
    { id: 'ren-eh-2', name: 'Varo EH', endpoints: ['/v1/chat/completions'], metadata: { supported_reasoning_efforts: ['low'] } },
    { id: 'ren-eh-1', name: 'Mara EH', endpoints: ['/v1/chat/completions'], metadata: { supported_reasoning_efforts: ['low', 'high'] } },
    { id: 'ren-eh-img', name: 'Aaa EH image', endpoints: ['/v1/images/generations'] },
];
const googleModels = { models: [{ name: 'models/ren-g-1', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] }, { name: 'models/ren-embed', supportedGenerationMethods: ['embedContent'] }] };

// ---- 설정 ----
const P = (id, more) => ({ id, name: `${id} profile`, mode: 'tc', ...more });
const BASE = {
    firstRun: false,
    currentVersion: '1.19.1',
    username: NAME1,
    max_context: 8192,
    amount_gen: 200,
    power_user: { auto_connect: false, custom_stopping_strings: JSON.stringify(['{{model}}', 'END']), custom_stopping_strings_macro: true },
};
const cc = (oai, more = {}) => ({ ...BASE, main_api: 'openai', oai_settings: { preset_settings_openai: 'Default', ...oai }, ...more });
const tc = (type, tg, profile) => ({
    ...BASE, main_api: 'textgenerationwebui',
    textgenerationwebui_settings: { type, banned_tokens: 'Mara\n"Ren"', send_banned_tokens: true, ...tg },
    oai_settings: { chat_completion_source: 'openai', preset_settings_openai: 'Default' },
    // (a preset on the profile: SillyTavern builds the text completion body — banned tokens included — only from a preset,
    //  custom-request.js presetToGeneratePayload. 'Ren TC' is tests/stprofile2.cases.mjs PRESETS', written for both sides)
    extension_settings: { connectionManager: { selectedProfile: null, profiles: [P('tc-main', { preset: 'Ren TC', ...profile })] } },
});
const pxy = (p) => proxyOf(`${FAKE}/${p}/v1`);
const L = (...ids) => ({ data: ids.map(id => ({ id })) });
const ccBias = { bias_preset_selected: 'Ivo bias', bias_presets: { 'Default (none)': [], 'Ivo bias': [{ text: ' Ivo', value: -50 }] } };

export const CASES = [
    // ---- 채팅 완성 ----
    { id: 'cc-openai-proxy-default', request: 'cc', settings: cc({ chat_completion_source: 'openai', show_external_models: true, openai_model: 'ren-old-model' }, proxyOf(PROXY)),
        phases: [{ at: 0, provider: { '/oai/v1/models': ok({ data: [{ id: 'ren-model-b' }, { id: 'ren-model-a' }] }) } }] },
    { id: 'cc-openai-proxy-kept', request: 'cc', settings: cc({ chat_completion_source: 'openai', show_external_models: true, openai_model: 'ren-model-b' }, proxyOf(PROXY)),
        phases: [{ at: 0, provider: { '/oai/v1/models': ok({ data: [{ id: 'ren-model-b' }, { id: 'ren-model-a' }] }) } }] },
    { id: 'cc-openai-no-external', request: 'cc', settings: cc({ chat_completion_source: 'openai', show_external_models: false, openai_model: 'gpt-5.6-terra' }, proxyOf(PROXY)),
        phases: [{ at: 0, provider: { '/oai/v1/models': ok({ data: [{ id: 'ren-model-a' }] }) } }] },
    { id: 'cc-openai-bypass-down', request: 'cc', settings: cc({ chat_completion_source: 'openai', bypass_status_check: true, openai_model: 'gpt-5.6-terra' }, proxyOf(PROXY)),
        phases: [{ at: 0, provider: { '/oai/v1/models': down } }] },
    { id: 'cc-openrouter-llama3-bias', request: 'cc', settings: cc({ chat_completion_source: 'openrouter', openrouter_model: 'ren/model-l3', ...ccBias }),
        phases: [{ at: 0, provider: { '/h/openrouter.ai/api/v1/models': ok({ data: orModels }) } }] },
    { id: 'cc-openrouter-not-in-list-grouped', request: 'cc', settings: cc({ chat_completion_source: 'openrouter', openrouter_model: 'ren/gone', group_models: true, sort_models: 'context_length' }),
        phases: [{ at: 0, provider: { '/h/openrouter.ai/api/v1/models': ok({ data: orModels }) } }] },
    { id: 'cc-electronhub-reasoning', request: 'cc', settings: cc({ chat_completion_source: 'electronhub', electronhub_model: 'ren-eh-1', reasoning_effort: 'high' }),
        phases: [{ at: 0, provider: { '/h/api.electronhub.ai/v1/models': ok({ data: ehModels }) } }] },
    { id: 'cc-electronhub-first', request: 'cc', settings: cc({ chat_completion_source: 'electronhub', electronhub_model: 'ren-gone', reasoning_effort: 'low' }),
        phases: [{ at: 0, provider: { '/h/api.electronhub.ai/v1/models': ok({ data: ehModels }) } }] },
    { id: 'cc-azure-model', request: 'cc', settings: cc({ chat_completion_source: 'azure_openai', azure_base_url: FAKE, azure_deployment_name: 'ren-dep', azure_api_version: '2024-10-21', azure_openai_model: 'ren-saved' }),
        phases: [{ at: 0, provider: { '/openai/models': ok({ data: [] }), '/openai/deployments/ren-dep/chat/completions': ok({ model: 'ren-azure-4', choices: [{ message: { content: 'Hi' } }] }) } }] },
    { id: 'cc-makersuite-static-kept', request: 'cc', settings: cc({ chat_completion_source: 'makersuite', google_model: 'gemini-2.5-flash' }, proxyOf(GPROXY)),
        phases: [{ at: 0, provider: { '/google/v1beta/models': ok(googleModels) } }] },
    { id: 'cc-makersuite-replaced', request: 'cc', settings: cc({ chat_completion_source: 'makersuite', google_model: 'ren-gone' }, proxyOf(GPROXY)),
        phases: [{ at: 0, provider: { '/google/v1beta/models': ok(googleModels) } }] },
    { id: 'cc-custom-first', request: 'cc', settings: cc({ chat_completion_source: 'custom', custom_url: `${FAKE}/custom/v1`, custom_model: '' }),
        phases: [{ at: 0, provider: { '/custom/v1/models': ok({ data: [{ id: 'ren-c-2' }, { id: 'ren-c-1' }] }) } }] },
    { id: 'cc-backend-down', request: 'cc', settings: cc({ chat_completion_source: 'openrouter', openrouter_model: 'ren/model-l3', ...ccBias }),
        phases: [{ at: 0, provider: { '/h/openrouter.ai/api/v1/models': down } }] },
    { id: 'cc-down-after-good', request: 'cc', settings: cc({ chat_completion_source: 'electronhub', electronhub_model: 'ren-gone', reasoning_effort: 'high' }),
        phases: [{ at: 0, provider: { '/h/api.electronhub.ai/v1/models': ok({ data: ehModels }) } }, { at: LATER, provider: { '/h/api.electronhub.ai/v1/models': down } }] },
    { id: 'cc-claude-no-check', request: 'cc', settings: cc({ chat_completion_source: 'claude' }), phases: [{ at: 0, provider: {} }] },
    // ---- 글 완성 (연결 프로필 tc-main: 금지 토큰 · 멈춤 글의 {{model}}) ----
    { id: 'tc-ooba-api-tokenizer', request: 'tc', settings: tc('ooba', { server_urls: { ooba: `${FAKE}/ooba` } }, { api: 'ooba', 'api-url': `${FAKE}/ooba` }),
        phases: [{ at: 0, provider: { '/ooba/v1/models': ok({ data: [{ id: 'ren-ooba-a' }] }), '/ooba/v1/internal/model/info': ok({ model_name: 'ren-ooba-loaded' }), '/ooba/v1/internal/encode': 'ooba' } }] },
    { id: 'tc-ooba-no-info', request: 'tc', settings: tc('ooba', { server_urls: { ooba: `${FAKE}/ooba` } }, { api: 'ooba', 'api-url': `${FAKE}/ooba` }),
        phases: [{ at: 0, provider: { '/ooba/v1/models': ok({ data: [{ id: 'ren-llama-3-8b' }, { id: 'ren-b' }] }) } }] },
    { id: 'tc-ooba-bypass', request: 'tc', settings: tc('ooba', { server_urls: { ooba: `${FAKE}/ooba` }, bypass_status_check: true }, { api: 'ooba', 'api-url': `${FAKE}/ooba` }),
        phases: [{ at: 0, provider: {} }] },
    { id: 'tc-koboldcpp-api-tokenizer', request: 'tc', settings: tc('koboldcpp', { server_urls: { koboldcpp: `${FAKE}/kcpp` } }, { api: 'koboldcpp', 'api-url': `${FAKE}/kcpp` }),
        phases: [{ at: 0, provider: { '/kcpp/v1/models': ok({ data: [{ id: 'koboldcpp/ren-k' }] }), '/kcpp/api/extra/tokencount': 'koboldcpp' } }] },
    { id: 'tc-llamacpp-not-in-list', request: 'tc', settings: tc('llamacpp', { server_urls: { llamacpp: `${FAKE}/llama` }, llamacpp_model: 'ren-gone' }, { api: 'llamacpp', 'api-url': `${FAKE}/llama` }),
        phases: [{ at: 0, provider: { '/llama/v1/models': ok({ data: [{ id: 'ren-l-b' }, { id: 'ren-l-a' }] }), '/llama/tokenize': 'llamacpp' } }] },
    { id: 'tc-openrouter-tokenizer', request: 'tc', settings: tc('openrouter', { openrouter_model: 'ren/gone' }, { api: 'openrouter-text' }),
        phases: [{ at: 0, provider: { '/h/openrouter.ai/api/v1/models': ok({ data: orModels }) } }] },
    { id: 'tc-dreamgen', request: 'tc', settings: tc('dreamgen', { dreamgen_model: 'lucid-v1-extra-large-ren' }, { api: 'dreamgen' }),
        phases: [{ at: 0, provider: { '/h/dreamgen.com/api/openai/v1/models': ok({ data: [{ id: 'lucid-v1-medium-ren' }, { id: 'lucid-v1-extra-large-ren' }] }) } }] },
    { id: 'tc-generic-kept', request: 'tc', settings: tc('generic', { server_urls: { generic: `${FAKE}/generic/v1` }, generic_model: 'ren-free-text' }, { api: 'generic', 'api-url': `${FAKE}/generic/v1` }),
        phases: [{ at: 0, provider: { '/generic/v1/models': ok({ data: [{ id: 'ren-g-b' }, { id: 'ren-g-a' }] }) } }] },
    { id: 'tc-backend-down', request: 'tc', settings: tc('ooba', { server_urls: { ooba: `${FAKE}/ooba` } }, { api: 'ooba', 'api-url': `${FAKE}/ooba` }),
        phases: [{ at: 0, provider: { '/ooba/v1/models': down } }] },
    { id: 'tc-down-after-good', request: 'tc', settings: tc('openrouter', { openrouter_model: 'ren/gone' }, { api: 'openrouter-text' }),
        phases: [{ at: 0, provider: { '/h/openrouter.ai/api/v1/models': ok({ data: orModels }) } }, { at: LATER, provider: { '/h/openrouter.ai/api/v1/models': down } }] },
    // ---- Kobold ({{model}} · Kobold 기능 표시) ----
    { id: 'kobold-model', request: 'macro', settings: { ...BASE, main_api: 'kobold', api_server: `${FAKE}/api` },
        phases: [{ at: 0, provider: { '/api/v1/info/version': ok({ result: '1.2.5' }), '/api/extra/version': ok({ result: 'KoboldCpp', version: '1.80' }), '/api/v1/model': ok({ result: 'koboldcpp/ren-kai' }) } }] },
    // ---- 검토자 경우 (리뷰 st1, 2026-11-23: 진짜 실리 1.19.1과 대 본 것) ----
    // ---- OpenAI ----
    { id: 'x-openai-fixed-not-in-list', request: 'cc', settings: cc({ chat_completion_source: 'openai', show_external_models: true, openai_model: 'gpt-4o' }, pxy('oai')),
        phases: [{ at: 0, provider: { '/oai/v1/models': ok(L('ren-b', 'ren-a')) } }] },
    { id: 'x-openai-nokey-bypass', request: 'cc', settings: cc({ chat_completion_source: 'openai', bypass_status_check: true, openai_model: 'gpt-4o' }),
        phases: [{ at: 0, provider: {} }] },
    // ---- OpenRouter ----
    { id: 'x-or-website', request: 'cc', settings: cc({ chat_completion_source: 'openrouter', openrouter_model: 'OR_Website' }),
        phases: [{ at: 0, provider: { '/h/openrouter.ai/api/v1/models': ok({ data: orModels }) } }] },
    { id: 'x-or-sort-price-out', request: 'cc', settings: cc({ chat_completion_source: 'openrouter', openrouter_model: '', sort_models: 'pricing.completion' }),
        phases: [{ at: 0, provider: { '/h/openrouter.ai/api/v1/models': ok({ data: orModels }) } }] },
    { id: 'x-or-group-alpha-gone', request: 'cc', settings: cc({ chat_completion_source: 'openrouter', openrouter_model: 'ren/gone', group_models: true, sort_models: 'alphabetically' }),
        phases: [{ at: 0, provider: { '/h/openrouter.ai/api/v1/models': ok({ data: orModels }) } }] },
    // ---- ElectronHub ----
    { id: 'x-eh-no-efforts-group', request: 'cc', settings: cc({ chat_completion_source: 'electronhub', electronhub_model: 'ren-eh-3', reasoning_effort: 'high', group_models: true, sort_models: 'pricing.output' }),
        phases: [{ at: 0, provider: { '/h/api.electronhub.ai/v1/models': ok({ data: [...ehModels, { id: 'ren-eh-3', name: 'Lio: EH', endpoints: ['/v1/chat/completions'], pricing: { output: '3' } }, { id: 'ren-eh-4', name: 'Ivo: EH', endpoints: ['/v1/chat/completions'], pricing: { output: '1' } }] }) } }] },
    // ---- Azure ----
    { id: 'x-azure-no-model', request: 'cc', settings: cc({ chat_completion_source: 'azure_openai', azure_base_url: FAKE, azure_deployment_name: 'ren-dep', azure_api_version: '2024-10-21', azure_openai_model: 'ren-saved' }),
        phases: [{ at: 0, provider: { '/openai/models': ok({ data: [] }), '/openai/deployments/ren-dep/chat/completions': ok({ choices: [] }) } }] },
    { id: 'x-azure-models-401', request: 'cc', settings: cc({ chat_completion_source: 'azure_openai', azure_base_url: FAKE, azure_deployment_name: 'ren-dep', azure_api_version: '2024-10-21', azure_openai_model: 'ren-saved' }),
        phases: [{ at: 0, provider: { '/openai/models': { status: 401, body: { error: 'no' } } } }] },
    // ---- Mistral (proxy) ----
    { id: 'x-mistral-gone', request: 'cc', settings: cc({ chat_completion_source: 'mistralai', mistralai_model: 'ren-gone' }, pxy('mis')),
        phases: [{ at: 0, provider: { '/mis/v1/models': ok({ data: [{ id: 'ren-m-emb', capabilities: { completion_chat: false } }, { id: 'ren-m-b', capabilities: { completion_chat: true } }, { id: 'ren-m-a', capabilities: { completion_chat: true } }] }) } }] },
    { id: 'x-mistral-saved-not-chat', request: 'cc', settings: cc({ chat_completion_source: 'mistralai', mistralai_model: 'ren-m-emb' }, pxy('mis')),
        phases: [{ at: 0, provider: { '/mis/v1/models': ok({ data: [{ id: 'ren-m-emb', capabilities: { completion_chat: false } }, { id: 'ren-m-b', capabilities: { completion_chat: true } }] }) } }] },
    { id: 'x-mistral-none-chat', request: 'cc', settings: cc({ chat_completion_source: 'mistralai', mistralai_model: 'ren-gone' }, pxy('mis')),
        phases: [{ at: 0, provider: { '/mis/v1/models': ok({ data: [{ id: 'ren-m-emb', capabilities: {} }] }) } }] },
    // ---- AIMLAPI ----
    { id: 'x-aiml-empty-first', request: 'cc', settings: cc({ chat_completion_source: 'aimlapi', aimlapi_model: '', sort_models: 'context_length', group_models: true }),
        phases: [{ at: 0, provider: { '/h/api.aimlapi.com/v1/models': ok({ data: [{ id: 'ren/a1', type: 'chat-completion', info: { name: 'Ren A', contextLength: 100 } }, { id: 'ivo/a2', type: 'chat-completion', info: { name: 'Ivo A', contextLength: 900 } }, { id: 'ren/img', type: 'image', info: { name: 'Img', contextLength: 5000 } }] }) } }] },
    { id: 'x-aiml-gone-kept', request: 'cc', settings: cc({ chat_completion_source: 'aimlapi', aimlapi_model: 'ren/gone' }),
        phases: [{ at: 0, provider: { '/h/api.aimlapi.com/v1/models': ok({ data: [{ id: 'ren/a1', type: 'chat-completion', info: { name: 'Ren A' } }] }) } }] },
    // ---- NanoGPT ----
    { id: 'x-nano-gone-sort', request: 'cc', settings: cc({ chat_completion_source: 'nanogpt', nanogpt_model: 'ren-gone', sort_models: 'pricing.prompt', group_models: true }),
        phases: [{ at: 0, provider: { '/h/nano-gpt.com/api/v1/models': ok({ data: [{ id: 'ren-n-1', name: 'Zed', pricing: { prompt: 5 } }, { id: 'ivo/n-2', name: 'Ann', pricing: { prompt: 1 } }] }) } }] },
    // ---- Chutes ----
    { id: 'x-chutes-gone-affine', request: 'cc', settings: cc({ chat_completion_source: 'chutes', chutes_model: 'ren-gone', sort_models: 'pricing.input' }),
        phases: [{ at: 0, provider: { '/h/llm.chutes.ai/v1/models': ok({ data: [{ id: 'ren/Affine-x', pricing: { prompt: 0, completion: 0 } }, { id: 'ren/c-b', pricing: { prompt: 2, completion: 1 } }, { id: 'ren/c-a', pricing: { prompt: 3, completion: 1 } }] }) } }] },
    // ---- DeepSeek · xAI · Moonshot (proxy) ----
    { id: 'x-deepseek-gone', request: 'cc', settings: cc({ chat_completion_source: 'deepseek', deepseek_model: 'ren-gone' }, pxy('ds')),
        phases: [{ at: 0, provider: { '/ds/v1/models': ok(L('ren-d-b', 'ren-d-a')) } }] },
    { id: 'x-xai-gone', request: 'cc', settings: cc({ chat_completion_source: 'xai', xai_model: 'ren-gone' }, pxy('xai')),
        phases: [{ at: 0, provider: { '/xai/v1/models': ok(L('ren-x-b', 'ren-x-a')) } }] },
    { id: 'x-moonshot-gone', request: 'cc', settings: cc({ chat_completion_source: 'moonshot', moonshot_model: 'ren-gone' }, pxy('ms')),
        phases: [{ at: 0, provider: { '/ms/v1/models': ok(L('ren-k-b', 'ren-k-a')) } }] },
    // ---- Pollinations · Groq · SiliconFlow · Fireworks · Workers AI · CometAPI ----
    { id: 'x-poll-gone', request: 'cc', settings: cc({ chat_completion_source: 'pollinations', pollinations_model: 'ren-gone' }),
        phases: [{ at: 0, provider: { '/h/gen.pollinations.ai/text/models': ok([{ name: 'ren-p-b' }, { name: 'ren-p-a' }]) } }] },
    { id: 'x-groq-gone', request: 'cc', settings: cc({ chat_completion_source: 'groq', groq_model: 'ren-gone' }),
        phases: [{ at: 0, provider: { '/h/api.groq.com/openai/v1/models': ok(L('ren-g-b', 'ren-g-a')) } }] },
    { id: 'x-silicon-gone', request: 'cc', settings: cc({ chat_completion_source: 'siliconflow', siliconflow_model: 'ren-gone' }),
        phases: [{ at: 0, provider: { '/h/api.siliconflow.com/v1/models': ok(L('ren-s-b', 'ren-s-a')) } }] },
    { id: 'x-fireworks-gone', request: 'cc', settings: cc({ chat_completion_source: 'fireworks', fireworks_model: 'ren-gone' }),
        phases: [{ at: 0, provider: { '/h/api.fireworks.ai/v1/accounts/fireworks/models': ok({ models: [{ name: 'accounts/fireworks/models/ren-f-a', displayName: 'Zeta F', contextLength: 1000 }, { name: 'accounts/fireworks/models/ren-f-b', displayName: 'Alpha F', contextLength: 2000 }, { name: 'accounts/fireworks/models/emb', displayName: 'E', contextLength: 10, kind: 'EMBEDDING_MODEL' }] }) } }] },
    { id: 'x-workers-gone', request: 'cc', settings: cc({ chat_completion_source: 'workers_ai', workers_ai_model: 'ren-gone', workers_ai_account_id: 'ren-acct' }),
        phases: [{ at: 0, provider: { '/h/api.cloudflare.com/client/v4/accounts/ren-acct/ai/models/search': ok({ result: [{ name: '@cf/ren/w-b', properties: [{ property_id: 'context_window', value: '4096' }] }, { name: '@cf/ren/w-a' }] }) } }] },
    { id: 'x-comet', request: 'cc', settings: cc({ chat_completion_source: 'cometapi', cometapi_model: 'ren-gone' }), phases: [{ at: 0, provider: {} }] },
    // ---- Custom ----
    { id: 'x-custom-gone-kept', request: 'cc', settings: cc({ chat_completion_source: 'custom', custom_url: `${FAKE}/custom/v1`, custom_model: 'ren-gone' }),
        phases: [{ at: 0, provider: { '/custom/v1/models': ok(L('ren-c-2', 'ren-c-1')) } }] },
    { id: 'x-custom-header-macro', request: 'cc', settings: cc({ chat_completion_source: 'custom', custom_url: `${FAKE}/custom/v1`, custom_model: '', custom_include_headers: 'X-Who: "{{user}}"' }),
        phases: [{ at: 0, provider: { '/custom/v1/models': 'echo-who' } }] },
    { id: 'x-nano-provider-unsupported', request: 'cc', settings: cc({ chat_completion_source: 'nanogpt', nanogpt_model: 'ren-n-1', nanogpt_provider: 'akash' }),
        phases: [{ at: 0, provider: { '/h/nano-gpt.com/api/v1/models': ok({ data: [{ id: 'ren-n-1', name: 'Zed' }] }) } }] },
    { id: 'x-nano-provider-supported', request: 'cc', settings: cc({ chat_completion_source: 'nanogpt', nanogpt_model: 'ren-n-1', nanogpt_provider: 'akash' }),
        phases: [{ at: 0, provider: { '/h/nano-gpt.com/api/v1/models': ok({ data: [{ id: 'ren-n-1', name: 'Zed' }] }), '/h/nano-gpt.com/api/models/ren-n-1/providers': ok({ supportsProviderSelection: true, providers: [{ provider: 'akash' }] }) } }] },
    { id: 'x-tc-mancer-noname', request: 'macro', settings: tc('mancer', { mancer_model: 'ren-gone' }, { api: 'mancer' }),
        phases: [{ at: 0, provider: { '/h/neuro.mancer.tech/oai/v1/models': ok({ data: [{ id: 'ren-mc-1', name: 'Zed' }, { id: 'ren-mc-2' }] }) } }] },
    // ---- no key: the browser's button does not connect ----
    { id: 'x-perplexity-nokey', request: 'cc', settings: cc({ chat_completion_source: 'perplexity' }), phases: [{ at: 0, provider: {} }] },
    // ---- Text completion ----
    { id: 'x-tc-tabby-gone', request: 'macro', settings: tc('tabby', { server_urls: { tabby: `${FAKE}/tabby` }, tabby_model: 'ren-gone' }, { api: 'tabby' }),
        phases: [{ at: 0, provider: { '/tabby/v1/model/list': ok(L('ren-t-b', 'ren-t-a')), '/tabby/v1/model': ok({ id: 'ren-t-a' }) } }] },
    { id: 'x-tc-vllm-gone', request: 'macro', settings: tc('vllm', { server_urls: { vllm: `${FAKE}/vllm` }, vllm_model: 'ren-gone' }, { api: 'vllm' }),
        phases: [{ at: 0, provider: { '/vllm/v1/models': ok(L('ren-v-b', 'ren-v-a')) } }] },
    { id: 'x-tc-aphro-gone', request: 'macro', settings: tc('aphrodite', { server_urls: { aphrodite: `${FAKE}/aph` }, aphrodite_model: 'ren-gone' }, { api: 'aphrodite' }),
        phases: [{ at: 0, provider: { '/aph/v1/models': ok(L('ren-a-b', 'ren-a-a')) } }] },
    { id: 'x-tc-ollama-gone', request: 'macro', settings: tc('ollama', { server_urls: { ollama: `${FAKE}/oll` }, ollama_model: 'ren-gone' }, { api: 'ollama' }),
        phases: [{ at: 0, provider: { '/oll/api/tags': ok({ models: [{ name: 'ren-o-b' }, { name: 'ren-o-a' }] }) } }] },
    { id: 'x-tc-together-gone', request: 'macro', settings: tc('togetherai', { togetherai_model: 'ren-gone' }, { api: 'togetherai' }),
        phases: [{ at: 0, provider: { '/h/api.together.xyz/api/models': ok([{ name: 'ren/tg-b', display_name: 'B', type: 'chat' }, { name: 'ren/tg-a', display_name: 'A', type: 'image' }]) } }] },
    { id: 'x-tc-infermatic-gone', request: 'macro', settings: tc('infermaticai', { infermaticai_model: 'ren-gone' }, { api: 'infermaticai' }),
        phases: [{ at: 0, provider: { '/h/api.totalgpt.ai/v1/models': ok(L('ren-i-b', 'ren-i-a')) } }] },
    { id: 'x-tc-mancer-gone', request: 'macro', settings: tc('mancer', { mancer_model: 'ren-gone' }, { api: 'mancer' }),
        phases: [{ at: 0, provider: { '/h/neuro.mancer.tech/oai/v1/models': ok({ data: [{ id: 'ren-mc-1', name: 'Zed' }, { id: 'ren-mc-2', name: 'Ann' }] }) } }] },
    { id: 'x-tc-featherless-gone', request: 'macro', settings: tc('featherless', { featherless_model: 'ren-gone' }, { api: 'featherless' }),
        phases: [{ at: 0, provider: { '/h/api.featherless.ai/v1/models': ok({ data: [{ id: 'ren/fl-b', model_class: 'x', context_length: 4096, created: 2 }, { id: 'ren/fl-a', model_class: 'y', context_length: 8192, created: 1 }] }) } }] },
    { id: 'x-tc-hf', request: 'macro', settings: tc('huggingface', { server_urls: { huggingface: `${FAKE}/hf` } }, { api: 'huggingface' }),
        phases: [{ at: 0, provider: { '/hf/info': ok({ model_id: 'ren-hf' }) } }] },
    { id: 'x-tc-dreamgen-gone', request: 'macro', settings: tc('dreamgen', { dreamgen_model: 'ren-gone' }, { api: 'dreamgen' }),
        phases: [{ at: 0, provider: { '/h/dreamgen.com/api/openai/v1/models': ok(L('lucid-v1-medium-ren', 'lucid-v1-max-ren')) } }] },
    { id: 'x-tc-generic-empty', request: 'macro', settings: tc('generic', { server_urls: { generic: `${FAKE}/gen/v1` }, generic_model: '' }, { api: 'generic' }),
        phases: [{ at: 0, provider: { '/gen/v1/models': ok(L('ren-g-b', 'ren-g-a')) } }] },
    { id: 'x-tc-orouter-present', request: 'macro', settings: tc('openrouter', { openrouter_model: 'ren/model-m' }, { api: 'openrouter-text' }),
        phases: [{ at: 0, provider: { '/h/openrouter.ai/api/v1/models': ok({ data: orModels }) } }] },
    { id: 'x-tc-koboldcpp', request: 'macro', settings: tc('koboldcpp', { server_urls: { koboldcpp: `${FAKE}/kc` } }, { api: 'koboldcpp' }),
        phases: [{ at: 0, provider: { '/kc/v1/models': ok(L('koboldcpp/ren-z')) } }] },
    { id: 'x-tc-ooba-noinfo', request: 'macro', settings: tc('ooba', { server_urls: { ooba: `${FAKE}/ob` } }, { api: 'ooba' }),
        phases: [{ at: 0, provider: { '/ob/v1/models': ok(L('ren-ob')) } }] },
    { id: 'x-tc-llamacpp-empty', request: 'macro', settings: tc('llamacpp', { server_urls: { llamacpp: `${FAKE}/lc` }, llamacpp_model: '' }, { api: 'llamacpp' }),
        phases: [{ at: 0, provider: { '/lc/v1/models': ok(L('ren-lc-b', 'ren-lc-a')) } }] },
    // ---- onModelChange의 문맥 · 온도 칸 (모델을 첫 모델로 바꿀 때: openai.js 5695~6011, 범위 칸이 값을 고쳐요) ----
    { id: 'x-clamp-workers-ctx', request: 'cc', settings: cc({ chat_completion_source: 'workers_ai', workers_ai_model: 'ren-gone', workers_ai_account_id: 'ren-acct', openai_max_context: 8000, temp_openai: 4.7 }),
        phases: [{ at: 0, provider: { '/h/api.cloudflare.com/client/v4/accounts/ren-acct/ai/models/search': ok({ result: [{ name: '@cf/ren/w-a', properties: [{ property_id: 'context_window', value: '4096' }] }, { name: '@cf/ren/w-b' }] }) } }] },
    { id: 'x-clamp-aiml-round', request: 'cc', settings: cc({ chat_completion_source: 'aimlapi', aimlapi_model: '', openai_max_context: 4000, temp_openai: 0.705, freq_pen_openai: 0.125, pres_pen_openai: -0.375 }),
        phases: [{ at: 0, provider: { '/h/api.aimlapi.com/v1/models': ok({ data: [{ id: 'ren/a1', type: 'chat-completion', info: { name: 'Ren A', contextLength: 900 } }] }) } }] },
    { id: 'x-clamp-custom-min', request: 'cc', settings: cc({ chat_completion_source: 'custom', custom_url: `${FAKE}/custom/v1`, custom_model: '', openai_max_context: 300, temp_openai: 2.5 }),
        phases: [{ at: 0, provider: { '/custom/v1/models': ok(L('ren-c-1')) } }] },
    { id: 'x-clamp-openai-default', request: 'cc', settings: cc({ chat_completion_source: 'openai', show_external_models: true, openai_model: 'ren-gone', openai_max_context: 3000000, temp_openai: 1.995 }, pxy('oai')),
        phases: [{ at: 0, provider: { '/oai/v1/models': ok(L('ren-b', 'ren-a')) } }] },
    { id: 'x-clamp-mistral-ctx', request: 'cc', settings: cc({ chat_completion_source: 'mistralai', mistralai_model: 'ren-gone', openai_max_context: 64000, temp_openai: 1.8 }, pxy('mis')),
        phases: [{ at: 0, provider: { '/mis/v1/models': ok({ data: [{ id: 'ren-m-a', max_context_length: 16000, capabilities: { completion_chat: true } }] }) } }] },
];

// (Proxy_SkipConfirm_<hash>: the key is SillyTavern's own — getStringHash of the proxy address)
export function settingsOf(c, getStringHash) {
    const s = structuredClone(c.settings);
    if (s.accountStorage) s.accountStorage = Object.fromEntries(Object.entries(s.accountStorage).map(([k, v]) => [k.replace(/#(.*)$/, (_, url) => String(getStringHash(url))), v]));
    return s;
}

export const MESSAGES = [{ role: 'system', content: 'You are {{char}}. Talk to {{user}}.' }, { role: 'user', content: 'hi' }];
export const TC_CUSTOM = { stream: false, extractData: true, includePreset: true, includeInstruct: true };
export const TC_REPLY = { choices: [{ text: 'Hello there' }] };
export const GENERATE = ['/api/backends/chat-completions/generate', '/api/backends/text-completions/generate'];
// (the /bias request carries random ids SillyTavern backfills into bias entries on load; the server ignores them)
export const callKey = (url, body) => {
    let b = body ?? null;
    try { b = JSON.stringify(JSON.parse(body), (k, v) => (k === 'id' ? undefined : v)); } catch { /* not JSON */ }
    return `${url}\n${b}`;
};
// what a page holds after connecting (the same on both sides: tools/st/oracle-status.mjs · tests/ststatus.run.mjs)
export const pickModels = o => Object.fromEntries(Object.keys(o).filter(k => /_model$/.test(k)).sort().map(k => [k, o[k]]));
// (and what onModelChange's context · temperature lines and the NanoGPT provider change: openai.js 5695~6011, textgen-models.js 417~460)
export const pickNums = o => Object.fromEntries(['openai_max_context', 'temp_openai', 'freq_pen_openai', 'pres_pen_openai', 'nanogpt_provider'].map(k => [k, o[k]]));
