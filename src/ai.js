// AI connections: the AI model, the draft model and the translation model (profile, custom OpenAI-compatible API, Vertex).

import { ctx, globalSettings } from './core.js';
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
    t.vxJson ??= ''; t.vxLocation ??= 'global'; t.vxModel ??= 'gemini-2.5-flash';
    // the old default was us-central1; move untouched settings to global once
    if (!t.vxLocV2) { if (t.vxLocation === 'us-central1') t.vxLocation = 'global'; t.vxLocV2 = true; }
    return t;
}
export const trSettings = () => connSettings('tr');

export async function callConn(t, system, prompt, maxTokens) {
    return stripThink(t.mode === 'vertex' ? await callVertex(t, system, prompt, maxTokens) : await callOpenAICompat(t, system, prompt, maxTokens));
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
export async function listModels({ url, key }) {
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

export async function callOpenAICompat({ url, key, model }, system, prompt, maxTokens) {
    const endpoint = chatCompletionsUrl(url);
    if (!endpoint || !model) throw new Error('커스텀 API의 URL과 모델 이름을 넣어 주세요 (⚙ 설정 → AI · 번역)');
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers.Authorization = `Bearer ${key}`;
    let r;
    try {
        r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({
            model, max_tokens: maxTokens, temperature: 0.3, stream: false,
            messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
        }) });
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
export async function askDraft(prompt, { system = '', maxTokens = 0 } = {}) {
    const t = draftSettings();
    if (!draftReady()) throw new Error('초안 모델이 없어요. ⚙ 설정 → AI · 번역 → 초안 모델에서 정해 주세요.');
    const out = await callConn(t, system, prompt, Math.max(256, Number(maxTokens) || Number(t.max) || 16000));
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
