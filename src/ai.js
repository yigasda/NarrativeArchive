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
    t.vxJson ??= ''; t.vxLocation ??= 'global'; t.vxModel ??= 'gemini-2.5-flash';
    // the old default was us-central1; move untouched settings to global once
    if (!t.vxLocV2) { if (t.vxLocation === 'us-central1') t.vxLocation = 'global'; t.vxLocV2 = true; }
    return t;
}
export const trSettings = () => connSettings('tr');

// a custom API speaks OpenAI's chat/completions unless it is Anthropic's own Messages API
export const apiFormat = t => t.fmt === 'anthropic' || t.fmt === 'openai' ? t.fmt : /anthropic\.com/i.test(String(t.url || '')) ? 'anthropic' : 'openai';

// effort: 'low' | 'medium' | 'high' — how hard a thinking model may think. The connection's own setting wins over the job's.
// Sent as output_config.effort (Anthropic format) or reasoning_effort (OpenAI format); Vertex ignores it.
export async function callConn(t, system, prompt, maxTokens, effort = '') {
    const e = t.effort || effort;
    if (t.mode === 'vertex') return stripThink(await callVertex(t, system, prompt, maxTokens));
    return stripThink(apiFormat(t) === 'anthropic' ? await callAnthropic(t, system, prompt, maxTokens, e) : await callOpenAICompat(t, system, prompt, maxTokens, e));
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
        catch (e) { if (isAnthropicHost(t)) throw e; }
    }
    const r = await fetch(url, { ...init, headers: anthropicHeaders(t, true) });
    if (!t.leanHeaders) { t.leanHeaders = true; saveGlobal(); }
    return r;
}

export async function callAnthropic(t, system, prompt, maxTokens, effort = '') {
    if (!t.model) throw new Error('모델 이름을 넣어 주세요 (⚙ 설정 → AI · 번역)');
    const endpoint = `${anthropicBase(t.url)}/v1/messages`;
    const send = withEffort => anthropicFetch(t, endpoint, { method: 'POST', body: JSON.stringify({
        model: t.model, max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: [{ role: 'user', content: prompt }],
        ...(withEffort ? { output_config: { effort } } : {}),
    }) });
    let r;
    try {
        const tryEffort = !!effort && !t.noEffort;
        r = await send(tryEffort);
        // an older model without effort gets the plain request, and is remembered
        if (tryEffort && r.status === 400 && /effort|output_config/i.test(await r.clone().text())) { t.noEffort = true; saveGlobal(); r = await send(false); }
    } catch (e) {
        throw new Error(`주소에 연결하지 못했어요. 주소가 맞는지, 이 주소가 Anthropic 형식(/v1/messages)을 받는지 확인해 주세요. (${e.message || e})`);
    }
    const body = await r.text();
    if (r.status === 401 || r.status === 403) throw new Error(`키가 맞지 않거나 권한이 없어요 (${r.status})`);
    if (r.status === 404 || r.status === 405) throw new Error(`이 주소는 Anthropic 형식(/v1/messages)을 안 받는 것 같아요 (${r.status}). 형식을 OpenAI 호환으로 바꿔 주세요.`);
    if (!r.ok) throw new Error(`API 오류 ${r.status}: ${body.slice(0, 200)}`);
    let j; try { j = JSON.parse(body); } catch { throw new Error('API 답을 읽지 못했어요 — 이 주소가 Anthropic 형식을 받는지 확인해 주세요'); }
    const out = (Array.isArray(j?.content) ? j.content : []).filter(b => b?.type === 'text').map(b => b.text || '').join('');
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

export async function callOpenAICompat(t, system, prompt, maxTokens, effort = '') {
    const { url, key, model } = t;
    const endpoint = chatCompletionsUrl(url);
    if (!endpoint || !model) throw new Error('커스텀 API의 URL과 모델 이름을 넣어 주세요 (⚙ 설정 → AI · 번역)');
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers.Authorization = `Bearer ${key}`;
    let r;
    try {
        const send = withEffort => fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({
            model, max_tokens: maxTokens, temperature: 0.3, stream: false,
            ...(withEffort ? { reasoning_effort: effort } : {}),
            messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
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
    if (!String(out).trim() && why === 'length') throw new Error(`답 길이 한도(${maxTokens} 토큰)에 걸려 빈 답이 왔어요. 생각하는 데 다 쓴 것 같아요 — ⚙ 설정 → AI · 번역에서 최대 길이를 늘려 주세요`);
    if (!String(out).trim() && why && why !== 'stop') throw new Error(`모델이 빈 답을 돌려줬어요 (멈춘 이유: ${why})`);
    return out;
}

// --- Vertex AI: sign a JWT with the service account key in the browser, trade it for an access token

export const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const b64urlText = s => b64url(new TextEncoder().encode(s));
export const vxTokens = new Map(); // client_email → { token, exp }

export function parseServiceAccount(raw) {
    let sa;
    try { sa = JSON.parse(String(raw || '')); } catch { throw new Error('서비스 계정 JSON을 읽지 못했어요. 파일 내용을 통째로 붙여넣어 주세요.'); }
    if (!sa?.private_key || !sa?.client_email || !sa?.project_id) throw new Error('서비스 계정 JSON에 private_key, client_email, project_id가 있어야 해요.');
    return sa;
}

export async function vertexToken(sa) {
    const hit = vxTokens.get(sa.client_email);
    if (hit && hit.exp > Date.now() + 60_000) return hit.token;
    const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const der = Uint8Array.from(atob(pem), ch => ch.charCodeAt(0));
    const key = await crypto.subtle.importKey('pkcs8', der.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const now = Math.floor(Date.now() / 1000);
    const aud = sa.token_uri || 'https://oauth2.googleapis.com/token';
    const unsigned = `${b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64urlText(JSON.stringify({
        iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud, iat: now, exp: now + 3600,
    }))}`;
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
    const r = await fetch(aud, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(sig)}` }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(`Vertex 인증 실패 ${r.status}: ${j.error_description || j.error || '토큰을 못 받았어요'}`);
    vxTokens.set(sa.client_email, { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 });
    return j.access_token;
}

export async function callVertex({ vxJson, vxLocation, vxModel }, system, prompt, maxTokens) {
    const sa = parseServiceAccount(vxJson);
    const loc = String(vxLocation || 'global').trim();
    const model = String(vxModel || '').trim();
    if (!model) throw new Error('Vertex 모델 이름을 넣어 주세요 (예: gemini-2.5-flash)');
    const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`;
    const url = `https://${host}/v1/projects/${encodeURIComponent(sa.project_id)}/locations/${encodeURIComponent(loc)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
    const token = await vertexToken(sa);
    const cats = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'];
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
            safetySettings: cats.map(category => ({ category, threshold: 'BLOCK_NONE' })),
        }),
    });
    const body = await r.text();
    if (!r.ok) throw new Error(`Vertex 오류 ${r.status}: ${body.slice(0, 200)}`);
    const j = JSON.parse(body);
    const cand = j?.candidates?.[0];
    const out = (cand?.content?.parts || []).map(p => p.text || '').join('');
    if (!out && cand?.finishReason) throw new Error(`Vertex가 답을 막았어요 (${cand.finishReason})`);
    if (!out && j?.promptFeedback?.blockReason) throw new Error(`Vertex가 요청을 막았어요 (${j.promptFeedback.blockReason})`);
    return out;
}

// the draft model writes text that may go into the archive (compression drafts); 'same' = not set
export const draftSettings = () => connSettings('dr');
export const draftReady = () => ['custom', 'vertex'].includes(draftSettings().mode);
export async function askDraft(prompt, { system = '', maxTokens = 0, effort = '' } = {}) {
    const t = draftSettings();
    if (!draftReady()) throw new Error('초안 모델이 없어요. ⚙ 설정 → AI · 번역 → 초안 모델에서 정해 주세요.');
    const out = await callConn(t, system, prompt, Math.max(256, Number(maxTokens) || Number(t.max) || 16000), effort);
    if (!out) throw new Error('초안 모델이 빈 답을 돌려줬어요');
    return out;
}
export const drLabel = () => { const t = draftSettings(); return t.mode === 'custom' ? (t.model || '커스텀 API') : t.mode === 'vertex' ? (t.vxModel || 'Vertex') : '없음'; };

export const trLabel = () => {
    const t = trSettings();
    return t.mode === 'custom' ? `커스텀 · ${t.model || '모델 없음'}` : t.mode === 'vertex' ? `Vertex · ${t.vxModel || '모델 없음'}` : aiLabel();
};

// Everything AI here only drafts or checks: results land in a box or a form, never straight in the archive.

// Connection Manager profiles that can send a request (empty if the extension is off)
export function aiProfiles() {
    try { return ctx().ConnectionManagerRequestService?.getSupportedProfiles?.() || []; } catch { return []; }
}

export const stripThink = t => String(t ?? '').replace(/<(think|thinking|reasoning)[^>]*>[\s\S]*?<\/\1>/gi, '').trim();

// Sends one request: to the chosen Connection Manager profile, or to whatever is connected now.
export async function askAI(prompt, { system = '', maxTokens = 0 } = {}) {
    const c = ctx();
    const g = globalSettings();
    const max = Math.max(64, Number(maxTokens) || Number(g.aiMaxTokens) || 8192);
    let out;
    const a = connSettings('ai');
    if (a.mode === 'custom' || a.mode === 'vertex') {
        out = await callConn(a, system, prompt, max);
    } else if (g.aiProfile) {
        const p = aiProfiles().find(x => x.id === g.aiProfile);
        if (!p) throw new Error('고른 연결 프로필을 찾을 수 없어요. ⚙ 설정 → AI · 번역에서 다시 골라 주세요.');
        const msgs = [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }];
        const r = await c.ConnectionManagerRequestService.sendRequest(p.id, msgs, max, { stream: false, extractData: true, includePreset: true, includeInstruct: true });
        out = typeof r === 'string' ? r : r?.content;
    } else {
        if (typeof c.generateRaw !== 'function') throw new Error('이 실리태번 버전에서는 AI 호출을 쓸 수 없어요');
        out = await c.generateRaw({ prompt, systemPrompt: system, responseLength: max });
    }
    out = stripThink(out);
    if (!out) throw new Error('모델이 빈 답을 돌려줬어요');
    return out;
}

export const aiLabel = () => {
    const g = globalSettings();
    const a = connSettings('ai');
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
