// AI connections: the AI model, the draft model and the translation model (profile, custom OpenAI-compatible API, Vertex).

import { ctx, globalSettings, saveGlobal } from './core.js';
import { mdInline } from './reader.js';
import { esc } from './util.js';

// ---- own connections: an OpenAI-compatible URL, or Vertex AI with a service account.
// 'ai' is the AI 기능 model (mode 'st' = SillyTavern's connection or a profile); 'tr' is the translation model (mode 'same' = follow 'ai').

export function connSettings(which) {
    const g = globalSettings();
    const k = which === 'tr' ? 'tr' : which === 'dr' ? 'draftConn' : 'aiConn';
    g[k] ||= {};
    const t = g[k];
    t.mode ??= which === 'ai' ? 'st' : 'same';
    t.url ??= ''; t.key ??= ''; t.model ??= '';
    t.fmt ??= '';    // custom API wire format: '' = guess from the address, 'openai', 'anthropic'
    t.effort ??= ''; // thinking effort the user fixed for this connection: '' = whatever the job asks for
    t.vxLocation ??= ''; t.vxModel ??= 'gemini-2.5-flash';
    // mode 'source': any chat-completion source SillyTavern has, with SillyTavern's own keys and settings for it
    t.source ??= ''; t.stModel ??= '';
    delete t.vxJson; // keys now live in SillyTavern only
    // the old default was us-central1; move untouched settings to global once
    if (!t.vxLocV2) { if (t.vxLocation === 'us-central1') t.vxLocation = 'global'; t.vxLocV2 = true; }
    return t;
}
export const trSettings = () => connSettings('tr');

// a custom API speaks OpenAI's chat/completions unless it is Anthropic's own Messages API
export const apiFormat = t => t.fmt === 'anthropic' || t.fmt === 'openai' ? t.fmt : /anthropic\.com/i.test(String(t.url || '')) ? 'anthropic' : 'openai';

// effort: 'low' | 'medium' | 'high' — how hard a thinking model may think. The connection's own setting wins over the job's.
// Sent as output_config.effort (Anthropic format) or reasoning_effort (OpenAI format, and Vertex through SillyTavern).
// force: the job's effort wins over the connection's, '' then meaning the model's own (compression asks for its own level;
// the phone's jobs keep theirs whatever the connection says)
// signal: an AbortSignal that stops the request itself (생성 중지); temperature · topP: numbers for this request alone
// meta: an object the caller gives to learn about the request (the Orbit prompt viewer and model thoughts): filled with
//   { raw (the answer before thinking tags are taken out), thinking (the provider's own reasoning text), model, provider,
//     temperature, maxTokens, reasoningEffort, usage: { promptTokens, completionTokens, reasoningTokens, cachedPromptTokens }, finishReason, durationMs }
// (none: what each API used before — 0.3, or the API's own for the Anthropic format)
export async function callConn(t, system, prompt, maxTokens, effort = '', force = false, keepSystem = false, signal = null, temperature = null, topP = null, meta = null) {
    const began = Date.now(), note = raw => { if (meta) Object.assign(meta, { raw: String(raw ?? ''), model: String((t.mode === 'vertex' ? t.vxModel : t.mode === 'source' ? t.stModel : t.model) || meta.model || ''), provider: t.mode === 'vertex' ? 'vertex' : t.mode === 'source' ? String(t.source || '') : apiFormat(t) === 'anthropic' ? 'anthropic' : 'openai-compatible', temperature: typeof temperature === 'number' ? temperature : null, maxTokens, reasoningEffort: e || null, durationMs: Date.now() - began }); return raw; };
    const e = force ? effort : (t.effort || effort);
    if (t.mode === 'vertex') return stripThink(note(await callVertex(t, system, prompt, maxTokens, e, signal, temperature, topP, meta)));
    if (t.mode === 'source') return stripThink(note(await callStSource(t, system, prompt, maxTokens, e, signal, temperature, topP, meta)));
    // the instructions go at the top of the first message instead of the system part: some relays drop the system part
    // without a word, and the model then answers the bare request (a digest taken for "write the next section").
    // keepSystem: 규칙은 시스템 메시지로 is on, so the user asked for the real system part
    if (system && !keepSystem) {
        const turns = turnsOf(prompt);
        if (turns.length) { turns[0] = { ...turns[0], content: `[INSTRUCTIONS]\n${system}\n[/INSTRUCTIONS]\n\n${turns[0].content}` }; prompt = turns; system = ''; }
    }
    // (the levels SillyTavern names — auto · min · low · medium · high · max — in each API's own words)
    const own = apiFormat(t) === 'anthropic' ? ({ auto: '', min: 'low' }[e] ?? e) : ({ auto: '', min: 'minimal', max: 'high' }[e] ?? e);
    return stripThink(note(apiFormat(t) === 'anthropic' ? await callAnthropic(t, system, prompt, maxTokens, own, signal, temperature, topP, meta) : await callOpenAICompat(t, system, prompt, maxTokens, own, signal, temperature, topP, meta)));
}

// prompt: one user message, or a whole conversation [{ role: 'user' | 'assistant', content }] (압축 작업실).
// Two turns of the same role in a row (a request that failed and was sent again) are joined, since the APIs want them to alternate.
export function turnsOf(prompt) {
    if (!Array.isArray(prompt)) return [{ role: 'user', content: String(prompt ?? '') }];
    const out = [];
    for (const t of prompt) {
        const role = t.role === 'assistant' ? 'assistant' : 'user', content = String(t.content ?? '');
        if (!content.trim()) continue;
        if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += `\n\n${content}`;
        else out.push({ role, content });
    }
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
}

// --- Anthropic Messages API, straight from the browser. Thinking on Claude Opus 5.5 can't be switched off;
// effort is the only lever, and thinking tokens are billed as output, so a low effort is what keeps a draft cheap.
export function anthropicBase(raw) {
    const u = String(raw || '').trim().replace(/\/+$/, '').replace(/\/messages$/, '').replace(/\/v1$/, '');
    return u || 'https://api.anthropic.com';
}
const isAnthropicHost = t => { try { return /(^|\.)anthropic\.com$/i.test(new URL(anthropicBase(t.url)).hostname); } catch { return false; } };

// Anthropic itself needs x-api-key and the browser-access header. A relay (new-api / one-api style) usually takes the key
// as a bearer token too; 'lean' drops the extra headers for a relay whose CORS check only lets the common ones through
function anthropicHeaders(t, lean = false) {
    const h = { 'Content-Type': 'application/json' };
    if (isAnthropicHost(t)) h['anthropic-dangerous-direct-browser-access'] = 'true';
    if (!lean) h['anthropic-version'] = '2023-06-01';
    if (t.key) {
        if (!lean || isAnthropicHost(t)) h['x-api-key'] = t.key;
        if (!isAnthropicHost(t)) h.Authorization = `Bearer ${t.key}`;
    }
    return h;
}

// a fetch that a relay's CORS check refused is tried once more with the lean headers, and that is remembered
async function anthropicFetch(t, url, init = {}) {
    if (!t.leanHeaders) {
        try { return await fetch(url, { ...init, headers: anthropicHeaders(t) }); }
        catch (e) { if (isAnthropicHost(t) || init.signal?.aborted) throw e; }
    }
    const r = await fetch(url, { ...init, headers: anthropicHeaders(t, true) });
    if (!t.leanHeaders) { t.leanHeaders = true; saveGlobal(); }
    return r;
}

export async function callAnthropic(t, system, prompt, maxTokens, effort = '', signal = null, temperature = null, topP = null, meta = null) {
    if (!t.model) throw new Error('모델 이름을 넣어 주세요 (⚙ 설정 → AI 모델)');
    const endpoint = `${anthropicBase(t.url)}/v1/messages`;
    const send = withEffort => anthropicFetch(t, endpoint, { method: 'POST', signal, body: JSON.stringify({
        model: t.model, max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: turnsOf(prompt),
        // (a temperature goes only with a request that asks for no thinking: the API refuses the two together)
        ...(withEffort ? { output_config: { effort } } : typeof temperature === 'number' ? { temperature: Math.max(0, Math.min(1, temperature)) } : {}),
        // (top_p 1 is the API's own default, and newer models refuse a top_p beside a temperature: only a real one is sent)
        ...(!withEffort && topPOf(topP) !== undefined && topPOf(topP) < 1 && typeof temperature !== 'number' ? { top_p: topPOf(topP) } : {}),
    }) });
    let r;
    try {
        const tryEffort = !!effort && !t.noEffort;
        r = await send(tryEffort);
        // an older model without effort gets the plain request, and is remembered
        if (tryEffort && r.status === 400 && /effort|output_config/i.test(await r.clone().text())) { t.noEffort = true; saveGlobal(); r = await send(false); }
    } catch (e) {
        if (signal?.aborted) throw e;
        throw new Error(`주소에 연결하지 못했어요. 주소가 맞는지, 이 주소가 Anthropic 형식(/v1/messages)을 받는지 확인해 주세요. (${e.message || e})`);
    }
    const body = await r.text();
    if (r.status === 401 || r.status === 403) throw new Error(`키가 맞지 않거나 권한이 없어요 (${r.status})`);
    if (r.status === 404 || r.status === 405) throw new Error(`이 주소는 Anthropic 형식(/v1/messages)을 안 받는 것 같아요 (${r.status}). 형식을 OpenAI 호환으로 바꿔 주세요.`);
    if (!r.ok) throw new Error(`API 오류 ${r.status}: ${body.slice(0, 200)}`);
    let j; try { j = JSON.parse(body); } catch { throw new Error('API 답을 읽지 못했어요 — 이 주소가 Anthropic 형식을 받는지 확인해 주세요'); }
    const out = (Array.isArray(j?.content) ? j.content : []).filter(b => b?.type === 'text').map(b => b.text || '').join('');
    if (meta) Object.assign(meta, { thinking: (Array.isArray(j?.content) ? j.content : []).filter(b => b?.type === 'thinking').map(b => b.thinking || '').join('\n\n'), finishReason: j?.stop_reason || null, usage: j?.usage ? { promptTokens: j.usage.input_tokens ?? null, completionTokens: j.usage.output_tokens ?? null, reasoningTokens: null, cachedPromptTokens: j.usage.cache_read_input_tokens ?? null } : null });
    if (j?.stop_reason === 'refusal') throw new Error('모델이 이 요청을 거절했어요 (refusal)');
    if (!out.trim() && j?.stop_reason === 'max_tokens') throw new Error(`답 길이 한도(${maxTokens} 토큰)를 생각하는 데 다 써서 빈 답이 왔어요 — 생각 강도를 낮추거나 최대 길이를 늘려 주세요`);
    if (j?.usage) console.info('[narrative-archive] tokens', t.model, `in ${j.usage.input_tokens} · out ${j.usage.output_tokens}`, effort ? `· effort ${effort}` : '');
    return out;
}

// accepts ".../v1" or a full ".../chat/completions"
export function chatCompletionsUrl(raw) {
    const u = String(raw || '').trim().replace(/\/+$/, '');
    if (!u) return '';
    return /\/chat\/completions$/.test(u) ? u : `${u}/chat/completions`;
}

// the model list next to it: ".../v1" or ".../chat/completions" → ".../v1/models"
export function modelsUrl(raw) {
    const u = String(raw || '').trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
    return u ? `${u}/models` : '';
}

// asks an OpenAI-compatible API which models it has (GET /models): sorted ids
export async function listModels(t) {
    const { url, key } = t;
    if (apiFormat(t) === 'anthropic') {
        let r;
        try { r = await anthropicFetch(t, `${anthropicBase(url)}/v1/models?limit=100`); }
        catch (e) { throw new Error(`주소에 연결하지 못했어요. (${e.message || e})`); }
        const body = await r.text();
        if (r.status === 401 || r.status === 403) throw new Error(`키가 맞지 않거나 권한이 없어요 (${r.status})`);
        if (!r.ok) throw new Error(`API 오류 ${r.status}: ${body.slice(0, 200)}`);
        const ids = [...new Set((JSON.parse(body)?.data || []).map(x => x?.id).filter(Boolean))].sort();
        if (!ids.length) throw new Error('모델 목록이 비어 있어요');
        return ids;
    }
    const endpoint = modelsUrl(url);
    if (!endpoint) throw new Error('주소를 먼저 넣어 주세요');
    const headers = {};
    if (key) headers.Authorization = `Bearer ${key}`;
    let r;
    try { r = await fetch(endpoint, { headers }); }
    catch (e) { throw new Error(`주소에 연결하지 못했어요. 주소가 맞는지, 브라우저에서 바로 부를 수 있는(CORS) API인지 확인해 주세요. (${e.message || e})`); }
    const body = await r.text();
    if (r.status === 401 || r.status === 403) throw new Error(`키가 맞지 않거나 권한이 없어요 (${r.status})`);
    if (!r.ok) throw new Error(`API 오류 ${r.status}: ${body.slice(0, 200)}`);
    let j; try { j = JSON.parse(body); } catch { throw new Error('모델 목록을 읽지 못했어요. 주소가 .../v1 까지인지 확인해 주세요.'); }
    const arr = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : Array.isArray(j?.models) ? j.models : [];
    const ids = [...new Set(arr.map(x => typeof x === 'string' ? x : x?.id || x?.name).filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b));
    if (!ids.length) throw new Error('모델 목록이 비어 있어요');
    return ids;
}

// (as Marinara's normalizeTopP: none for a missing or negative one, 1 at most)
const topPOf = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, 1) : undefined);
export async function callOpenAICompat(t, system, prompt, maxTokens, effort = '', signal = null, temperature = null, topP = null, meta = null) {
    const { url, key, model } = t;
    const endpoint = chatCompletionsUrl(url);
    if (!endpoint || !model) throw new Error('커스텀 API의 URL과 모델 이름을 넣어 주세요 (⚙ 설정 → AI 모델)');
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers.Authorization = `Bearer ${key}`;
    let r;
    try {
        const send = withEffort => fetch(endpoint, { method: 'POST', headers, signal, body: JSON.stringify({
            model, max_tokens: maxTokens, temperature: typeof temperature === 'number' ? temperature : 0.3, ...(topPOf(topP) !== undefined ? { top_p: topPOf(topP) } : {}), stream: false,
            ...(withEffort ? { reasoning_effort: effort } : {}),
            messages: [...(system ? [{ role: 'system', content: system }] : []), ...turnsOf(prompt)],
        }) });
        // thinking models (Opus 5.5 can't switch thinking off) spend the answer limit thinking; a lower effort keeps short jobs short.
        // An API that doesn't take reasoning_effort (or this temperature with it) gets the plain request, and is remembered
        const tryEffort = !!effort && !t.noEffort;
        r = await send(tryEffort);
        if (tryEffort && r.status === 400) {
            const msg = await r.clone().text();
            if (/reasoning|effort|temperature|unknown|unrecognized|not supported|extra/i.test(msg)) { t.noEffort = true; saveGlobal(); r = await send(false); }
        }
    } catch (e) {
        if (signal?.aborted) throw e;
        throw new Error(`주소에 연결하지 못했어요. 브라우저에서 바로 부를 수 없는(CORS) API일 수 있어요. (${e.message || e})`);
    }
    const body = await r.text();
    if (!r.ok) throw new Error(`API 오류 ${r.status}: ${body.slice(0, 200)}`);
    let j; try { j = JSON.parse(body); } catch { throw new Error('API 답을 읽지 못했어요'); }
    const msg = j?.choices?.[0]?.message;
    const out = typeof msg?.content === 'string' ? msg.content
        : Array.isArray(msg?.content) ? msg.content.map(p => p?.text || '').join('') : (j?.choices?.[0]?.text || '');
    // say why an answer is empty: a length cut usually means the model spent the limit thinking
    const why = j?.choices?.[0]?.finish_reason;
    if (meta) Object.assign(meta, { thinking: [msg?.reasoning_content, msg?.reasoning].find(v => typeof v === 'string' && v.trim()) || '', finishReason: why || null, model: String(j?.model || model || ''), usage: j?.usage ? { promptTokens: j.usage.prompt_tokens ?? null, completionTokens: j.usage.completion_tokens ?? null, reasoningTokens: j.usage.completion_tokens_details?.reasoning_tokens ?? null, cachedPromptTokens: j.usage.prompt_tokens_details?.cached_tokens ?? null } : null });
    if (!String(out).trim() && why === 'length') throw new Error(`답 길이 한도(${maxTokens} 토큰)에 걸려 빈 답이 왔어요. 생각하는 데 다 쓴 것 같아요 — ⚙ 설정 → AI 모델에서 최대 길이를 늘려 주세요`);
    if (!String(out).trim() && why && why !== 'stop') throw new Error(`모델이 빈 답을 돌려줬어요 (멈춘 이유: ${why})`);
    return out;
}

// --- Vertex AI through SillyTavern's own server, with the service account JSON saved in SillyTavern
// (API 연결 → Vertex AI → 서비스 계정). The key never reaches the browser; the server signs and calls Google.

// the Vertex models SillyTavern lists in its own model picker
export function vxModelList() {
    const ids = [...document.querySelectorAll('#model_vertexai_select option')].map(o => o.value).filter(Boolean);
    return [...new Set(ids)];
}
export const vxRegion = t => String(t.vxLocation || '').trim() || ctx().chatCompletionSettings?.vertexai_region || 'global';

// a model that a region does not carry answers 404 "Publisher model … not found": try the other usual regions once,
// and keep the one that worked
export async function callVertex(t, system, prompt, maxTokens, effort = '', signal = null, temperature = null, topP = null, meta = null) {
    const first = vxRegion(t);
    const others = ['global', 'us-central1', 'us-east5', 'europe-west4'].filter(x => x !== first);
    try { return await callVertexAt(t, first, system, prompt, maxTokens, effort, signal, temperature, topP, meta); }
    catch (e) {
        if (!/Vertex 오류 404/.test(String(e?.message))) throw e;
        for (const loc of others) {
            try {
                const out = await callVertexAt(t, loc, system, prompt, maxTokens, effort, signal, temperature, topP, meta);
                t.vxLocation = loc; saveGlobal();
                toastr.info(`Vertex 지역 ${first}에 이 모델이 없어서 ${loc}로 바꿨어요`, '서사 아카이브');
                return out;
            } catch (e2) { if (!/Vertex 오류 404/.test(String(e2?.message))) throw e2; }
        }
        throw e;
    }
}
async function callVertexAt(t, loc, system, prompt, maxTokens, job = '', signal = null, temperature = null, topP = null, meta = null) {
    const model = String(t.vxModel || '').trim();
    if (!model) throw new Error('Vertex 모델을 골라 주세요 (예: gemini-2.5-flash)');
    // callConn already chose between the connection's setting and the job's; nothing chosen: the model decides
    const effort = ['low', 'medium', 'high'].find(x => x === job) || 'auto';
    const r = await fetch('/api/backends/chat-completions/generate', {
        method: 'POST', signal,
        headers: ctx().getRequestHeaders(),
        body: JSON.stringify({
            chat_completion_source: 'vertexai', vertexai_auth_mode: ctx().chatCompletionSettings?.vertexai_auth_mode || 'full', vertexai_express_project_id: ctx().chatCompletionSettings?.vertexai_express_project_id, vertexai_region: loc, model,
            messages: [...(system ? [{ role: 'system', content: system }] : []), ...turnsOf(prompt)],
            use_sysprompt: true, max_tokens: maxTokens, temperature: typeof temperature === 'number' ? temperature : 0.3, ...(topPOf(topP) !== undefined ? { top_p: topPOf(topP) } : {}), stream: false,
            reasoning_effort: effort, include_reasoning: false,
        }),
    });
    const body = await r.text();
    let j = null;
    try { j = JSON.parse(body); } catch { /* not JSON */ }
    const msg = j?.error?.message || j?.message || (typeof j?.error === 'string' ? j.error : '') || body.slice(0, 200);
    if (!r.ok || j?.error) {
        if (/service account|Service Account/i.test(msg)) throw new Error('실리에 Vertex 서비스 계정 JSON이 없어요. API 연결 → Chat Completion → Google Vertex AI → 서비스 계정에서 넣어 주세요.');
        if (/404|NOT_FOUND|not found/i.test(msg)) throw new Error(`Vertex 오류 404: ${msg.slice(0, 160)}`);
        if (/blocked|SAFETY|PROHIBITED|RECITATION|candidate/i.test(msg)) throw new Error(`Vertex가 답을 막았어요 (${msg.slice(0, 120)})`);
        throw new Error(`Vertex 오류 ${r.status}${msg && msg !== 'true' ? `: ${msg.slice(0, 200)}` : ' · 실리 서버 창에 자세한 내용이 있어요'}`);
    }
    if (meta) Object.assign(meta, { thinking: [j?.choices?.[0]?.message?.reasoning_content, j?.choices?.[0]?.message?.reasoning].find(v => typeof v === 'string' && v.trim()) || '', finishReason: j?.choices?.[0]?.finish_reason || null, usage: j?.usage ? { promptTokens: j.usage.prompt_tokens ?? null, completionTokens: j.usage.completion_tokens ?? null, reasoningTokens: j.usage.completion_tokens_details?.reasoning_tokens ?? null, cachedPromptTokens: null } : null });
    return String(j?.choices?.[0]?.message?.content || '');
}

// --- Any chat-completion source SillyTavern has (OpenAI, Claude, OpenRouter, Google AI Studio, DeepSeek, …), through
// SillyTavern's own server with the key and the settings SillyTavern holds for that source. Nothing is asked again here:
// the request is built by SillyTavern's own createGenerationParameters (its proxy, custom URL, Azure, Vertex and
// provider fields as they are set there), and only what this request decides is put over it.

// the sources SillyTavern lists in its own API picker → [{ id, name }]
export function stSourceList() {
    return [...document.querySelectorAll('#chat_completion_source option')].map(o => ({ id: o.value, name: String(o.textContent || o.value).trim() })).filter(x => x.id);
}
export const stSourceName = id => stSourceList().find(x => x.id === id)?.name || String(id || '');
// what SillyTavern's own status call sends for a source (openai.js getStatusOpen)
function stStatusBody(source, o) {
    const data = { reverse_proxy: o.reverse_proxy, proxy_password: o.proxy_password, chat_completion_source: source };
    if (source === 'custom') { data.custom_url = o.custom_url; data.custom_include_headers = o.custom_include_headers; }
    if (source === 'azure_openai') { data.azure_base_url = o.azure_base_url; data.azure_deployment_name = o.azure_deployment_name; data.azure_api_version = o.azure_api_version; }
    if (source === 'siliconflow') data.siliconflow_endpoint = o.siliconflow_endpoint;
    if (source === 'minimax') data.minimax_endpoint = o.minimax_endpoint;
    if (source === 'workers_ai') data.workers_ai_account_id = o.workers_ai_account_id;
    if (source === 'pollinations') data.pollinations_endpoint = o.pollinations_endpoint;
    return data;
}
// the models of a source → [{ id, name }]: asked from the provider through SillyTavern (its /status call); a source that
// has no list call (Claude, Vertex, …) gives the models SillyTavern lists in its own picker for it
const ST_SELECT = { makersuite: 'google' };
export async function stSourceModels(source) {
    const src = String(source || '');
    if (!src) throw new Error('연결 종류를 골라 주세요');
    const fromPage = () => [...document.querySelectorAll(`#model_${ST_SELECT[src] || src}_select option`)].map(o => ({ id: o.value, name: String(o.textContent || o.value).trim() })).filter(x => x.id);
    const noList = ['claude', 'ai21', 'vertexai', 'perplexity', 'zai', 'minimax'];
    let rows = [];
    if (!noList.includes(src)) {
        try {
            const r = await fetch('/api/backends/chat-completions/status', { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify(stStatusBody(src, ctx().chatCompletionSettings || {})) });
            const j = r.ok ? await r.json() : null, list = Array.isArray(j?.data) ? j.data : Array.isArray(j?.data?.data) ? j.data.data : [];
            rows = list.map(m => ({ id: String(m?.id || ''), name: String(m?.name || m?.id || '') })).filter(x => x.id);
        } catch { /* the picker's own list below */ }
    }
    if (!rows.length) rows = fromPage();
    if (!rows.length) throw new Error('모델 목록을 받지 못했어요. 실리의 API 연결에서 이 연결의 키를 넣었는지 확인해 주세요');
    return [...new Map(rows.map(x => [x.id, x])).values()];
}
// one request to a source. effort: '' (the source's own default) | min | low | medium | high | max
export async function callStSource(t, system, prompt, maxTokens, effort = '', signal = null, temperature = null, topP = null, meta = null) {
    const source = String(t.source || ''), model = String(t.stModel || '').trim();
    if (!source) throw new Error('연결 종류를 골라 주세요 (⚙ 설정 → AI 모델)');
    if (!model) throw new Error('모델을 골라 주세요 (⚙ 설정 → AI 모델 → 모델 불러오기)');
    const O = await import('/scripts/openai.js');
    if (typeof O.createGenerationParameters !== 'function') throw new Error('이 실리 버전에서는 이 연결 방식을 쓸 수 없어요 (실리를 최신으로 올려 주세요)');
    const messages = [...(system ? [{ role: 'system', content: system }] : []), ...turnsOf(prompt)];
    const data = await O.createGenerationParameters({ ...O.oai_settings, chat_completion_source: source, stream_openai: false, n: 1, bias_preset_selected: '', enable_web_search: false, request_images: false, function_calling: false }, model, 'quiet', messages);
    // (what the role-play preset tunes is not this request's: only the connection's own fields stay)
    for (const k of ['frequency_penalty', 'presence_penalty', 'top_k', 'min_p', 'repetition_penalty', 'top_a', 'stop', 'logit_bias', 'logprobs', 'assistant_prefill', 'n', 'tools', 'tool_choice', 'verbosity', 'seed', 'top_p']) delete data[k];
    Object.assign(data, { stream: false, max_tokens: maxTokens, temperature: typeof temperature === 'number' ? temperature : 0.3, reasoning_effort: effort || 'auto', include_reasoning: !!meta, ...(topPOf(topP) !== undefined ? { top_p: topPOf(topP) } : {}) });
    const r = await fetch('/api/backends/chat-completions/generate', { method: 'POST', headers: ctx().getRequestHeaders(), signal, body: JSON.stringify(data) });
    const body = await r.text();
    let j = null;
    try { j = JSON.parse(body); } catch { /* not JSON */ }
    const msg = j?.error?.message || j?.message || (typeof j?.error === 'string' ? j.error : '') || body.slice(0, 200);
    if (!r.ok || j?.error) throw new Error(`${stSourceName(source)} 오류 ${r.status}${msg && msg !== 'true' ? `: ${String(msg).slice(0, 200)}` : ' · 실리 서버 창에 자세한 내용이 있어요'}`);
    // (SillyTavern's server hands most sources back in the OpenAI shape; Claude's own and Google's own are read too)
    const m = j?.choices?.[0]?.message, parts = Array.isArray(j?.content) ? j.content : [];
    const out = typeof m?.content === 'string' ? m.content : Array.isArray(m?.content) ? m.content.map(p => p?.text || '').join('')
        : parts.length ? parts.filter(b => b?.type === 'text').map(b => b.text || '').join('')
            : String(j?.candidates?.[0]?.content?.parts?.filter(p => !p?.thought).map(p => p?.text || '').join('') || j?.choices?.[0]?.text || '');
    if (meta) Object.assign(meta, { thinking: [m?.reasoning_content, m?.reasoning, parts.filter(b => b?.type === 'thinking').map(b => b.thinking || '').join('\n\n')].find(v => typeof v === 'string' && v.trim()) || '', finishReason: j?.choices?.[0]?.finish_reason || j?.stop_reason || null, usage: j?.usage ? { promptTokens: j.usage.prompt_tokens ?? j.usage.input_tokens ?? null, completionTokens: j.usage.completion_tokens ?? j.usage.output_tokens ?? null, reasoningTokens: j.usage.completion_tokens_details?.reasoning_tokens ?? null, cachedPromptTokens: null } : null });
    if (!String(out).trim()) throw new Error('모델이 빈 답을 돌려줬어요');
    return String(out);
}

// ---- refusals and blocks: a refusal is never saved as a section; a blocked request goes to the stand-in model

// a stop by the provider shows in the errors our own calls throw (Vertex's finish or block reason, Anthropic's refusal,
// an OpenAI-style content_filter finish), or as policy words in an API error body
const BLOCK_HINTS = [
    /막았어요|거절했어요/,
    /멈춘 이유: content_filter/,
    /\b(PROHIBITED_CONTENT|BLOCKLIST|SPII|IMAGE_SAFETY)\b/,
    /\b(content[ _]?policy|usage polic(?:y|ies)|safety (?:system|settings|filters?)|harm_category)\b/i,
];
// a refusal opens with an apology or a "can't do this", or points at a policy
const REFUSAL_HINTS = [
    /\b(sorry|apologi[sz]e)\b/i,
    /\b(can ?not|can't|unable to|won't|will not|not able to)\b.{0,40}\b(help|assist|continue|comply|provide|write|create|produce|do that)\b/i,
    /\b(against|violat\w*)\b.{0,30}\b(polic\w*|guidelines?)\b/i,
    /\bas an ai\b/i,
    /죄송|할 수 없|드릴 수 없|어렵습니다|정책/,
    /申し訳|できません|お応えでき/,
    /抱歉|无法|不能/,
];
// guard: what a real answer has (a section heading); a short answer without it whose opening reads like a refusal is one
export const looksRefused = (out, guard) => {
    const t = String(out || '').trim();
    if (!guard || t.length >= 1200 || guard.test(t)) return false;
    const head = t.slice(0, 300);
    return REFUSAL_HINTS.some(re => re.test(head));
};
export const isBlocked = e => !!e?.refused || BLOCK_HINTS.some(re => re.test(String(e?.message || e || '')));
const refusedError = who => Object.assign(new Error(`${who}이 요청을 거절했어요. 거절한 답은 넣지 않았어요`), { refused: true });

// the stand-in for a refused or blocked request: '' none, 'ai' the AI 기능 모델, 'dr' the draft model
export const fallbackOf = () => { const v = globalSettings().fallback; return v === 'ai' || v === 'dr' ? v : ''; };
async function viaFallback(e, from, prompt, opts) {
    const fb = fallbackOf();
    if (!isBlocked(e) || !fb || fb === from || opts.noFallback) throw e;
    if (fb === 'dr' && !draftReady()) throw e;
    console.warn(`[narrative-archive] ${from} refused or blocked, asking the ${fb} model`, e);
    toastr.info(`${from === 'dr' ? '초안 모델' : 'AI 기능 모델'}이 거절해서 ${fb === 'dr' ? '초안 모델' : 'AI 기능 모델'}로 다시 보내요`, '서사 아카이브', { timeOut: 4000 });
    const o = { ...opts, noFallback: true };
    return fb === 'dr' ? askDraft(prompt, o) : askAI(prompt, o);
}

// the draft model writes text that may go into the archive (compression drafts); 'same' = not set
export const draftSettings = () => connSettings('dr');
export const OWN_MODES = ['custom', 'vertex', 'source'];
export const draftReady = () => OWN_MODES.includes(draftSettings().mode);
// timeout (ms, optional): a request that hasn't answered by then is given up (its late answer is not used), so a stuck call
// doesn't hold the phone's work for good. Not passed by compression, which may think for long
export async function askDraft(prompt, opts = {}) {
    const { system = '', maxTokens = 0, effort = '', force = false, guard = null, keepSystem = false, timeout = 0, signal = null, temperature = null, topP = null, meta = null } = opts;
    const t = draftSettings();
    if (!draftReady()) throw new Error('초안 모델이 없어요. ⚙ 설정 → AI 모델 → 초안 모델에서 정해 주세요.');
    try {
        const call = callConn(t, system, prompt, Math.max(256, Number(maxTokens) || Number(t.max) || 16000), effort, force, keepSystem, signal, temperature, topP, meta);
        const out = timeout > 0 ? await Promise.race([call, new Promise((_, no) => setTimeout(() => no(Object.assign(new Error(`모델이 ${Math.round(timeout / 60000)}분 넘게 답하지 않아서 멈췄어요. 다시 해 주세요`), { timedOut: true })), timeout))]) : await call;
        if (!out) throw new Error('초안 모델이 빈 답을 돌려줬어요');
        if (looksRefused(out, guard)) throw refusedError('초안 모델');
        return out;
    } catch (e) { if (e?.timedOut || signal?.aborted) throw e; return viaFallback(e, 'dr', prompt, opts); }
}
// Compression reads a long raw log and ties causes together: it gets its own thinking level (default high) and
// room for that thinking (32,000 tokens, or the draft limit if that is larger). 'conn' = the connection's own setting.
export const compressEffort = () => { const v = draftSettings().cEffort; return v === undefined || v === null || v === '' ? 'high' : v; };
export const SECTION_GUARD = /^#{1,3} |^\s*[-*•] |PLOT:/m;
export const askCompress = (prompt, { system = '', guard = null, keepSystem = false } = {}) => {
    const e = compressEffort(), t = draftSettings();
    return askDraft(prompt, { system, guard, keepSystem, maxTokens: Math.max(32000, Number(t.max) || 0), effort: e === 'conn' ? '' : e, force: e !== 'conn' });
};
export const drLabel = () => { const t = draftSettings(); return t.mode === 'source' ? (t.stModel || stSourceName(t.source)) : t.mode === 'custom' ? (t.model || '커스텀 API') : t.mode === 'vertex' ? (t.vxModel || 'Vertex') : '없음'; };

export const trLabel = () => {
    const t = trSettings();
    return t.mode === 'source' ? `${stSourceName(t.source)} · ${t.stModel || '모델 없음'}` : t.mode === 'custom' ? `커스텀 · ${t.model || '모델 없음'}` : t.mode === 'vertex' ? `Vertex · ${t.vxModel || '모델 없음'}` : aiLabel();
};

// Everything AI here only drafts or checks: results land in a box or a form, never straight in the archive.

// Connection Manager profiles that can send a request (empty if the extension is off)
export function aiProfiles() {
    try { return ctx().ConnectionManagerRequestService?.getSupportedProfiles?.() || []; } catch { return []; }
}

// thinking a model writes out, and the <scenes> list the compress instruction asks for before the sections
export const stripThink = t => String(t ?? '').replace(/<(think|thinking|reasoning|scenes)[^>]*>[\s\S]*?<\/\1>/gi, '').trim();

// Sends one request: to the chosen Connection Manager profile, or to whatever is connected now.
export async function askAI(prompt, opts = {}) {
    try { return await askAIOnce(prompt, opts); }
    catch (e) { if (opts.signal?.aborted) throw e; return viaFallback(e, 'ai', prompt, opts); }
}
async function askAIOnce(prompt, { system = '', maxTokens = 0, effort = '', force = false, guard = null, keepSystem = false, signal = null, temperature = null, topP = null, meta = null } = {}) {
    const c = ctx();
    const g = globalSettings();
    const max = Math.max(64, Number(maxTokens) || Number(g.aiMaxTokens) || 8192);
    let out;
    const a = connSettings('ai');
    if (OWN_MODES.includes(a.mode)) {
        out = await callConn(a, system, prompt, max, effort, force, keepSystem, signal, temperature, topP, meta);
    } else if (g.aiProfile) {
        const p = aiProfiles().find(x => x.id === g.aiProfile);
        if (!p) throw new Error('고른 연결 프로필을 찾을 수 없어요. ⚙ 설정 → AI 모델에서 다시 골라 주세요.');
        const msgs = [...(system ? [{ role: 'system', content: system }] : []), ...turnsOf(prompt)];
        const r = await c.ConnectionManagerRequestService.sendRequest(p.id, msgs, max, { stream: false, extractData: true, includePreset: true, includeInstruct: true, ...(signal ? { signal } : {}) });
        out = typeof r === 'string' ? r : r?.content;
    } else {
        if (typeof c.generateRaw !== 'function') throw new Error('이 실리 버전에서는 AI 호출을 쓸 수 없어요');
        out = await c.generateRaw({ prompt: Array.isArray(prompt) ? turnsOf(prompt).map(x => x.content).join('\n\n') : prompt, systemPrompt: system, responseLength: max });
    }
    out = stripThink(out);
    if (!out) throw new Error('모델이 빈 답을 돌려줬어요');
    if (looksRefused(out, guard)) throw refusedError('AI 기능 모델');
    return out;
}

// 고치기 (이어서 고치기 · 고쳐 달라고 하기 · 빠진 구간 · 제목 · 합치기): the AI 기능 모델 — editing is a smaller job than
// writing a stretch, and it is asked for again and again
export const askFix = (prompt, { system = '', maxTokens = 16000 } = {}) => askAI(prompt, { system, maxTokens });

export const aiLabel = () => {
    const g = globalSettings();
    const a = connSettings('ai');
    if (a.mode === 'source') return `${stSourceName(a.source)} · ${a.stModel || '모델 없음'}`;
    if (a.mode === 'custom') return `커스텀 · ${a.model || '모델 없음'}`;
    if (a.mode === 'vertex') return `Vertex · ${a.vxModel || '모델 없음'}`;
    const p = g.aiProfile && aiProfiles().find(x => x.id === g.aiProfile);
    return p ? p.name : '지금 연결된 모델';
};

// Runs fn while the button shows a spinner; errors become a toast. Returns fn's result or null.
export async function withSpinner($btn, busyText, fn) {
    const html = $btn.html();
    $btn.prop('disabled', true).html(`<i class="fa-solid fa-spinner fa-spin"></i> ${esc(busyText)}`);
    try { return await fn(); }
    catch (e) { console.error('[NarrativeArchive] AI', e); toastr.error(String(e?.message || e), 'AI 요청 실패'); return null; }
    finally { $btn.prop('disabled', false).html(html); }
}

// Plain text from the model → safe HTML with line breaks and **bold**
export const aiHtml = t => String(t).split('\n').map(mdInline).join('<br>');
