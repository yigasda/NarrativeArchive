// 테스트용 실리 대역: 연결 프로필의 요청을 실리 코드가 만드는 순서 그대로 만들어요 (실리 1.19.1:
//   shared.js ConnectionManagerRequestService.sendRequest 423–492 → custom-request.js createRequestData · processRequest ·
//   presetToGeneratePayload → openai.js createGenerationParameters의 일부 · instruct-mode.js formatInstructModeChat · formatInstructModePrompt).
// 진짜 실리 코드로는 tools/plugin/stbrowser.cjs가 확인해요. 여기서는 src/stprofile.js가 받아 두는 것 · 서버가 채우는 것을 대 봐요.
//   random: 요청마다 달라지는 값 · mangle: 실리가 메시지를 고쳐 보내는 모델 (o1) · counted: 글의 길이가 들어간 글 완성 요청
import { PT_URL, extractMessageFromData } from '../src/stprofile.js';

const clean = o => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };
const SRC = { openrouter: 'openrouter', custom: 'custom', claude: 'claude', deepseek: 'deepseek' };

export function fakeSt({ profiles = [], oai = {}, presets = {}, tcPresets = {}, instructs = {}, proxies = [], name1 = 'Ren', name2 = 'Mara', random = false, mangle = false, counted = false } = {}) {
    const sub = s => String(s ?? '').replaceAll('{{user}}', name1).replaceAll('{{char}}', name2);
    // (instruct-mode.js formatInstructModeChat · formatInstructModePrompt, for wrap: true, names never, no macros)
    const chat = (role, mes, ins) => { const pre = role === 'system' ? ins.system_sequence : role === 'user' ? ins.input_sequence : ins.output_sequence; const suf = (role === 'system' ? ins.system_suffix : role === 'user' ? ins.input_suffix : ins.output_suffix) || '\n'; return [pre, mes + suf].filter(x => x).join('\n'); };
    const last = ins => `${ins.output_sequence}\n`;
    function build(profileId, prompt, maxTokens, over = {}) {
        const profile = profiles.find(p => p.id === profileId);
        if (!profile) throw new Error(`Profile not found (ID: ${profileId})`);
        if (profile.mode !== 'tc') {
            const proxy = proxies.find(p => p.name === profile.proxy);
            const messages = Array.isArray(prompt) ? prompt : [{ role: 'user', content: prompt }];
            let req = clean({ stream: false, messages, max_tokens: maxTokens, model: profile.model, chat_completion_source: SRC[profile.api], secret_id: profile['secret-id'], custom_url: profile['api-url'], reverse_proxy: proxy?.url, proxy_password: proxy?.password, custom_prompt_post_processing: profile['prompt-post-processing'], ...over });
            req = clean({ use_sysprompt: true, ...req });
            const preset = profile.preset ? presets[profile.preset] : undefined;
            if (preset) {
                const s = { ...oai, ...preset };
                for (const f of ['custom_url', 'vertexai_region']) req[f] = req[f] || s[f] || oai[f];
                const gd = { type: 'quiet', messages: req.messages, model: req.model, temperature: Number(s.temp_openai), max_tokens: s.openai_max_tokens, stream: false, chat_completion_source: s.chat_completion_source, user_name: name1, char_name: name2, include_reasoning: !!s.show_thoughts, reasoning_effort: s.reasoning_effort };
                if (s.reverse_proxy) { gd.reverse_proxy = s.reverse_proxy; gd.proxy_password = s.proxy_password; }
                if (s.chat_completion_source === 'custom') { gd.custom_url = s.custom_url; gd.custom_include_headers = sub(s.custom_include_headers); }
                if (random) gd.seed = Math.floor(Math.random() * 1e9);
                if (mangle) gd.messages = gd.messages.map(m => (m.role === 'system' ? { ...m, role: 'user' } : m));
                req = clean({ use_sysprompt: true, ...gd, ...req, messages: gd.messages });
            }
            return { url: PT_URL.cc, body: req };
        }
        const ins = profile.instruct ? instructs[profile.instruct] : undefined;
        let text = prompt, stops;
        if (Array.isArray(prompt)) {
            if (ins) { text = prompt.map(m => chat(m.role, m.content, ins)).join('') + last(ins); stops = [`\n${ins.stop_sequence}`, `\n${ins.input_sequence}`]; }
            else text = prompt.map(x => x.content).join('\n\n');
        }
        if (counted) text = `[${text.length} chars]\n${text}`;   // (a prompt that changes with the text's length)
        let req = clean({ stream: false, prompt: text, max_tokens: maxTokens, max_new_tokens: maxTokens, model: profile.model, api_type: profile.api, api_server: profile['api-url'], secret_id: profile['secret-id'], ...over });
        if (stops) { req.stop = stops; req.stopping_strings = stops; }
        const preset = profile.preset ? tcPresets[profile.preset] : undefined;
        if (preset) req = clean({ prompt: text, model: req.model, max_new_tokens: preset.genamt, max_tokens: preset.genamt, temperature: preset.temp, stopping_strings: [`\n${name1}:`], stop: [`\n${name1}:`], n_predict: preset.genamt, truncation_length: 8192, api_type: profile.api, ...(random ? { seed: Math.random() } : {}), ...req });
        return { url: PT_URL.tc, body: req };
    }
    // SillyTavern's sendRequest, non-streaming, extractData (what our code calls)
    async function sendRequest(profileId, prompt, maxTokens, custom = {}, over = {}) {
        const { url, body } = build(profileId, prompt, maxTokens, over);
        try {
            const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-cache', body: JSON.stringify(body), signal: custom.signal ?? new AbortController().signal });
            const json = await r.json();
            if (!r.ok || json.error) throw new Error(String(json.error?.message || 'Response not OK'));
            return { content: extractMessageFromData(json, url === PT_URL.cc ? 'openai' : 'textgenerationwebui'), reasoning: '' };
        } catch (error) { throw new Error('API request failed', { cause: error }); }
    }
    const find = { proxy: name => proxies.find(p => p.name === name) || null, preset: (api, name) => (api === 'openai' ? presets : tcPresets)[name], instruct: name => instructs[name], oai };
    return { build, sendRequest, find };
}
