// 뜻으로 찾기: sections and hidden raw passages also go into SillyTavern's vector store, so the router and 회상
// find a moment by meaning ("all those lights" → a section about paper lanterns), and a Korean chat finds an
// English archive. Uses the server's /api/vector endpoints; vectors stay in SillyTavern's own data folder.

import { currentChatId } from './chats.js';
import { ctx, getMeta, globalSettings, hasChat, saveGlobal } from './core.js';
import { rawItems, sectionItems } from './recall.js';
import { shortHash } from './translate.js';

// '' = off, 'st' = whatever the Vector Storage extension is set to, else a source of our own
export const EMBED_SOURCES = {
    '': '끄기',
    st: '실리태번 설정 따라',
    transformers: '로컬 (실리태번 안에서)',
    palm: 'Gemini · AI Studio',
    vertexai: 'Gemini · Vertex AI',
    openai: 'OpenAI',
    openrouter: 'OpenRouter',
    cohere: 'Cohere',
    mistral: 'Mistral',
    nomicai: 'Nomic',
    ollama: 'Ollama',
};
// the model a source uses when none is typed
export const EMBED_DEFAULT_MODEL = { palm: 'gemini-embedding-001', vertexai: 'text-multilingual-embedding-002', openai: 'text-embedding-3-small', openrouter: 'openai/text-embedding-3-small', cohere: 'embed-multilingual-v3.0', ollama: 'bge-m3' };
const MODEL_FREE = new Set(['transformers', 'mistral', 'nomicai']); // the server picks the model itself

export function embedCfg() {
    const e = globalSettings().embed && typeof globalSettings().embed === 'object' ? globalSettings().embed : {};
    return { source: e.source in EMBED_SOURCES ? e.source : '', model: String(e.model || '').trim(), url: String(e.url || '').trim() };
}
export const embedOn = () => !!embedCfg().source;
export function setEmbed(patch) {
    const g = globalSettings();
    g.embed = { ...embedCfg(), ...patch };
    saveGlobal();
    state.clear(); broken = '';
}

// the source and its fields for a request, the same way the Vector Storage extension fills them in
function sourceBody() {
    const c = ctx();
    const cfg = embedCfg();
    const vs = c.extensionSettings?.vectors || {};
    const oai = c.chatCompletionSettings || {};
    const tg = c.textCompletionSettings || {};
    const own = cfg.source !== 'st';
    const source = own ? cfg.source : (vs.source || 'transformers');
    const pickModel = stKey => (own ? cfg.model || EMBED_DEFAULT_MODEL[source] || '' : vs[stKey] || EMBED_DEFAULT_MODEL[source] || '');
    const b = { source };
    const altUrl = kind => (own ? cfg.url : (vs.use_alt_endpoint ? vs.alt_endpoint_url : tg.server_urls?.[kind])) || '';
    switch (source) {
        case 'openai': b.model = pickModel('openai_model'); break;
        case 'openrouter': b.model = pickModel('openrouter_model'); break;
        case 'cohere': b.model = pickModel('cohere_model'); break;
        case 'togetherai': b.model = vs.togetherai_model; break;
        case 'electronhub': b.model = vs.electronhub_model; break;
        case 'chutes': b.model = vs.chutes_model; break;
        case 'nanogpt': b.model = vs.nanogpt_model; break;
        case 'webllm': b.model = vs.webllm_model; break;
        case 'siliconflow': b.model = vs.siliconflow_model; b.siliconflow_endpoint = oai.siliconflow_endpoint; break;
        case 'workers_ai': b.model = vs.workers_ai_model || '@cf/baai/bge-m3'; b.workers_ai_account_id = oai.workers_ai_account_id; break;
        case 'extras': b.extrasUrl = c.extensionSettings?.apiUrl; b.extrasKey = c.extensionSettings?.apiKey; break;
        case 'ollama': b.model = pickModel('ollama_model'); b.apiUrl = altUrl('ollama'); b.keep = !!vs.ollama_keep; break;
        case 'llamacpp': b.apiUrl = altUrl('llamacpp'); break;
        case 'vllm': b.model = vs.vllm_model; b.apiUrl = altUrl('vllm'); break;
        case 'palm': b.model = pickModel('google_model'); b.api = 'makersuite'; break;
        case 'vertexai': {
            // our own pick always uses the service account JSON saved in SillyTavern; embedding models are not
            // served from the 'global' endpoint, so that one becomes us-central1
            b.model = pickModel('google_model'); b.api = 'vertexai';
            b.vertexai_auth_mode = own ? 'full' : oai.vertexai_auth_mode;
            const region = String(oai.vertexai_region || '').trim();
            b.vertexai_region = !region || region === 'global' ? 'us-central1' : region;
            b.vertexai_express_project_id = oai.vertexai_express_project_id;
            break;
        }
        default: break;
    }
    return b;
}
// what the vectors were made with; a different one needs its own collection
const signature = b => `${b.source}|${MODEL_FREE.has(b.source) ? '' : b.model || ''}`;
export const embedLabel = () => { if (!embedOn()) return '끔'; const b = sourceBody(); return `${EMBED_SOURCES[b.source] || b.source}${b.model ? ` · ${b.model}` : ''}`; };

async function vec(path, body, ms = 30_000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
        const r = await fetch(`/api/vector/${path}`, { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify(body), signal: ctl.signal });
        if (!r.ok) {
            const txt = (await r.text().catch(() => '')).slice(0, 200);
            throw new Error(`임베딩 ${r.status}${txt && !/^<!doctype/i.test(txt) ? `: ${txt}` : ''}`);
        }
        return path === 'list' || path === 'query' ? r.json() : null;
    } catch (e) {
        if (e.name === 'AbortError') throw new Error(`임베딩이 ${Math.round(ms / 1000)}초 안에 답이 없었어요`);
        throw e;
    } finally { clearTimeout(t); }
}

// a positive 32-bit number per text, the kind of hash the vector store keys items by
const numHash = s => { let h = 0x811c9dc5 ^ 0x5bd1; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0) || 1; };

// what goes in: every numbered section in pieces of about 900 characters, each with its title in front,
// and every hidden raw passage (회상 finds old lines from those)
const PIECE = 900;
function corpus(m) {
    const out = [];
    for (const x of sectionItems(m)) {
        const head = x.text.match(/^[^\n]*/)[0];
        const body = x.text.slice(head.length).trim();
        const title = x.title.replace(/^#+\s*/, '');
        let cur = '';
        const pieces = [];
        for (const line of body.split('\n')) {
            if (cur && cur.length + line.length > PIECE) { pieces.push(cur); cur = ''; }
            cur += (cur ? '\n' : '') + line;
        }
        if (cur || !pieces.length) pieces.push(cur);
        for (const p of pieces) { const text = `${title}\n${p}`.trim(); out.push({ kind: 'sec', title: x.title, text, hash: numHash(`s|${text}`) }); }
    }
    for (const r of rawItems({ only: 'hidden' })) { const text = `${r.name}: ${r.text}`; out.push({ kind: 'raw', i: r.i, text, hash: numHash(`r|${r.i}|${text}`) }); }
    return out;
}

const state = new Map(); // chat id → { sig, coll, items: Map(hash → item), synced, at, busy }
let broken = ''; // last error; searching stops until 다시 만들기 or a settings change
export const embedError = () => broken;
export const embedState = () => state.get(currentChatId()) || null;

function collId(b) { return `narrarch_${shortHash(String(currentChatId()))}_${shortHash(signature(b))}`; }

// bring the vector store in line with the archive and the hidden messages: add what is new, drop what is gone
export async function syncEmbed({ onProgress = null, force = false } = {}) {
    if (!embedOn() || !hasChat()) return null;
    const id = currentChatId();
    const b = sourceBody();
    const sig = signature(b);
    let st = state.get(id);
    if (st?.busy) return st;
    if (!st || st.sig !== sig) { st = { sig, coll: collId(b), items: new Map(), synced: false, at: 0 }; state.set(id, st); }
    if (force) broken = '';
    st.busy = true;
    try {
        const all = corpus(getMeta());
        const want = new Map(all.map(x => [x.hash, x]));
        const have = new Set((await vec('list', { ...b, collectionId: st.coll })).map(Number));
        const add = all.filter(x => !have.has(x.hash));
        const gone = [...have].filter(h => !want.has(h));
        if (gone.length) await vec('delete', { ...b, collectionId: st.coll, hashes: gone });
        // gemini-embedding on Vertex takes one text per request, and the server sends what it gets in one go
        const step = b.source === 'vertexai' && /^gemini-embedding/.test(b.model || '') ? 1 : ['transformers', 'ollama'].includes(b.source) ? 8 : 40;
        for (let k = 0; k < add.length; k += step) {
            if (currentChatId() !== id) throw new Error('채팅이 바뀌어서 멈췄어요');
            await vec('insert', { ...b, collectionId: st.coll, items: add.slice(k, k + step).map((x, j) => ({ hash: x.hash, text: x.text, index: k + j })) }, 120_000);
            onProgress?.(Math.min(add.length, k + step), add.length);
        }
        st.items = want;
        st.synced = true;
        st.at = Date.now();
        st.secs = all.filter(x => x.kind === 'sec').length;
        st.raws = all.length - st.secs;
        broken = '';
        return st;
    } catch (e) {
        broken = e.message || String(e);
        throw e;
    } finally { st.busy = false; }
}

// texts closest in meaning to the query, best first: [{ kind, title | i, text, rank }]
export async function embedSearch(query, { topK = 24, ms = 8000 } = {}) {
    if (!embedOn() || broken || !hasChat() || !String(query || '').trim()) return [];
    const st = embedState();
    if (!st?.synced) { syncEmbed().catch(() => {}); return []; } // build in the background, search from the next reply on
    const b = sourceBody();
    if (signature(b) !== st.sig) { state.delete(currentChatId()); return []; }
    try {
        const r = await vec('query', { ...b, collectionId: st.coll, searchText: String(query).slice(-1500), topK }, ms);
        return (r?.hashes || []).map((h, rank) => ({ ...st.items.get(Number(h)), rank })).filter(x => x.kind);
    } catch (e) {
        console.warn('[narrative-archive] embed search', e);
        return [];
    }
}

// after the archive or the hidden messages change: catch up quietly a moment later
let soon = null;
export function embedSoon() {
    if (!embedOn() || broken) return;
    clearTimeout(soon);
    soon = setTimeout(() => syncEmbed().catch(e => console.warn('[narrative-archive] embed sync', e)), 4000);
}
