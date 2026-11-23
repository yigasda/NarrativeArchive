// 채팅 완성 요청 몸통을 실리 브라우저와 대 보는 경우들 (tests/stopenai.test.mjs · tools/st/oracle-cc.mjs가 같이 써요). 예시 캐릭터만.
// settings: settings.json 모양(oai_settings · power_user · proxies · selected_proxy · accountStorage). 서버는 plugin/st/naload.js로 채우고,
// 실리 브라우저에는 그렇게 채워진 oai_settings · power_user를 그대로 넣어요. 그래서 대 보는 것은 createGenerationParameters 하나예요.
export const NAME1 = 'Ren', NAME2 = 'Mara';
const msgs = [{ role: 'system', content: 'You are {{char}}.' }, { role: 'user', content: 'hi' }];
const src = (chat_completion_source, more = {}) => ({ main_api: 'openai', oai_settings: { chat_completion_source, ...more } });
const proxyHash = 'Proxy_SkipConfirm_';

export const CASES = [
    { id: 'openai-basic', settings: src('openai', { openai_model: 'gpt-4o', temp_openai: 0.3, openai_max_tokens: 4000 }), model: 'gpt-4o' },
    { id: 'openai-o3', settings: src('openai', { reasoning_effort: 'max' }), model: 'o3' },
    { id: 'openai-o1-system', settings: src('openai'), model: 'o1' },
    { id: 'openai-gpt5-min', settings: src('openai', { reasoning_effort: 'min' }), model: 'gpt-5' },
    { id: 'openai-gpt5.4-min', settings: src('openai', { reasoning_effort: 'min' }), model: 'gpt-5.4' },
    { id: 'openai-gpt5.6-max', settings: src('openai', { reasoning_effort: 'max' }), model: 'gpt-5.6' },
    { id: 'openai-gpt5.2-auto', settings: src('openai', { reasoning_effort: 'auto' }), model: 'gpt-5.2' },
    { id: 'openai-vision', settings: src('openai', { bias_preset_selected: 'Default (none)' }), model: 'gpt-4-vision-preview' },
    { id: 'openai-n', settings: src('openai', { n: 3 }), model: 'gpt-4o', type: 'normal' },
    { id: 'openai-stream-quiet', settings: src('openai', { stream_openai: true }), model: 'gpt-4o' },
    { id: 'openai-stream-normal', settings: src('openai', { stream_openai: true }), model: 'gpt-4o', type: 'normal' },
    { id: 'claude-prefill-quiet', settings: src('claude', { assistant_prefill: 'Sure, {{char}}:' }), model: 'claude-3-7-sonnet' },
    { id: 'claude-prefill-normal', settings: src('claude', { assistant_prefill: 'Sure, {{char}}:', use_sysprompt: true, top_k_openai: 40 }), model: 'claude-3-7-sonnet', type: 'normal' },
    { id: 'claude-impersonate', settings: src('claude', { assistant_impersonation: 'As {{user}}:' }), model: 'claude-3-7-sonnet', type: 'impersonate' },
    { id: 'claude5', settings: src('claude', { reasoning_effort: 'high' }), model: 'claude-opus-5' },
    { id: 'makersuite', settings: src('makersuite', { reasoning_effort: 'low', show_thoughts: true }), model: 'gemini-2.5-pro' },
    { id: 'vertexai', settings: src('vertexai', { vertexai_auth_mode: 'express', vertexai_region: 'us-central1', reasoning_effort: 'medium' }), model: 'gemini-2.5-flash' },
    { id: 'openrouter', settings: src('openrouter', { openrouter_providers: ['A'], reasoning_effort: 'min', show_thoughts: false }), model: 'openai/o3' },
    { id: 'openrouter-thoughts', settings: src('openrouter', { reasoning_effort: 'min', show_thoughts: true }), model: 'anthropic/claude-sonnet-5' },
    { id: 'custom-macros', settings: src('custom', { custom_url: 'http://127.0.0.1:9/v1', custom_include_body: 'who: {{char}}', custom_exclude_body: '', custom_include_headers: 'X-User: {{user}}' }), model: 'm' },
    { id: 'custom-kobold-max', settings: src('custom', { reasoning_effort: 'max' }), model: 'koboldcpp/x' },
    { id: 'deepseek', settings: src('deepseek', { reasoning_effort: 'medium', top_p_openai: 0 }), model: 'deepseek-v4-flash' },
    { id: 'xai-mini', settings: src('xai', { reasoning_effort: 'high' }), model: 'grok-3-mini' },
    { id: 'xai-4', settings: src('xai'), model: 'grok-4' },
    { id: 'mistral', settings: src('mistralai'), model: 'mistral-large-latest' },
    { id: 'cohere', settings: src('cohere', { top_p_openai: 1, freq_pen_openai: 2 }), model: 'command-a' },
    { id: 'groq', settings: src('groq', { n: 2 }), model: 'llama-3.3-70b' },
    { id: 'zai', settings: src('zai'), model: 'glm-4.6' },
    { id: 'minimax-temp0', settings: src('minimax', { temp_openai: 0 }), model: 'MiniMax-M2' },
    { id: 'seed', settings: src('openai', { seed: 7 }), model: 'gpt-4o' },
    { id: 'verbosity', settings: src('openai', { verbosity: 'low' }), model: 'gpt-4o' },
    { id: 'stops', settings: { ...src('openai'), power_user: { custom_stopping_strings: JSON.stringify(['\nRen:', '{{char}}:', '', 'x', 'y', 'z']), custom_stopping_strings_macro: true } }, model: 'gpt-4o' },
    { id: 'stops-claude', settings: { ...src('claude'), power_user: { custom_stopping_strings: JSON.stringify(['a', 'b', 'c', 'd', 'e', 'f']), custom_stopping_strings_macro: false } }, model: 'claude-3-7-sonnet' },
    { id: 'stops-gemini', settings: { ...src('makersuite'), power_user: { custom_stopping_strings: JSON.stringify(['short', 'this one is far too long for gemini', 'c', 'd', 'e', 'f']) } }, model: 'gemini-2.5-pro' },
    { id: 'logprobs', settings: { ...src('openai'), power_user: { request_token_probabilities: true } }, model: 'gpt-4o' },
    { id: 'tools-quiet', settings: src('openai', { function_calling: true }), model: 'gpt-4o' },
    { id: 'tools-normal', settings: src('openai', { function_calling: true }), model: 'gpt-4o', type: 'normal' },
    { id: 'proxy-confirmed', settings: { ...src('openai'), proxies: [{ name: 'None', url: '', password: '' }, { name: 'P', url: 'https://proxy.example/v1', password: 'PW' }], selected_proxy: { name: 'P', url: 'https://proxy.example/v1', password: 'PW' }, accountStorage: { [`${proxyHash}HASH`]: 'true' } }, model: 'gpt-4o' },
    { id: 'proxy-not-confirmed', settings: { ...src('claude'), proxies: [{ name: 'None', url: '', password: '' }, { name: 'Q', url: 'https://other.example/v1', password: 'PW2' }], selected_proxy: { name: 'Q', url: 'https://other.example/v1', password: 'PW2' } }, model: 'claude-3-7-sonnet' },
    { id: 'proxy-bad-url', settings: { ...src('openai'), proxies: [{ name: 'B', url: 'not a url', password: '' }], selected_proxy: { name: 'B', url: 'not a url', password: '' } }, model: 'gpt-4o' },
    { id: 'proxy-unsupported-source', settings: { ...src('openrouter'), selected_proxy: { name: 'P', url: 'https://proxy.example/v1', password: 'PW' } }, model: 'openai/gpt-4o' },
    { id: 'bias', bias: true, settings: src('openai', { bias_preset_selected: 'Anti-bond' }), model: 'gpt-4o' },
    { id: 'bias-custom-ids', bias: true, settings: src('custom', { bias_preset_selected: 'P', bias_presets: { 'Default (none)': [], P: [{ text: '[15, 16]', value: 5 }, { text: ' hello', value: -100 }] }, custom_model: 'gpt-4o' }), model: 'gpt-4o' },
].map(c => ({ type: 'quiet', messages: msgs, ...c }));

// (proxy-confirmed: the key is SillyTavern's own — getStringHash of the proxy address)
export function withHash(c, getStringHash) {
    if (!c.settings.accountStorage) return c;
    const url = c.settings.selected_proxy?.url || '';
    return { ...c, settings: { ...c.settings, accountStorage: Object.fromEntries(Object.entries(c.settings.accountStorage).map(([k, v]) => [k.replace('HASH', String(getStringHash(url))), v])) } };
}
