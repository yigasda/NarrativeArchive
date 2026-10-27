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
export const EMBED_DEFAULT_MODEL = { palm: 'gemini-embedding-001', vertexai: 'gemini-embedding-001', openai: 'text-embedding-3-small', openrouter: 'openai/text-embedding-3-small', cohere: 'embed-multilingual-v3.0', ollama: 'bge-m3' };
// models offered per source: [name, what it is good at]; anything else can be typed in
export const EMBED_MODELS = {
    vertexai: [['gemini-embedding-001', '여러 언어 · 한국어 채팅에 좋아요 · 하나씩 보내서 처음 색인이 느려요'], ['text-multilingual-embedding-002', '여러 언어 · 빨라요'], ['text-embedding-005', '영어 위주 · 빨라요 · 채팅도 영어일 때']],
    palm: [['gemini-embedding-001', '여러 언어 · 한국어 채팅에 좋아요']],
    openai: [['text-embedding-3-small', '여러 언어 · 싸요'], ['text-embedding-3-large', '여러 언어 · 더 정확해요']],
    openrouter: [['openai/text-embedding-3-small', '여러 언어 · 싸요'], ['openai/text-embedding-3-large', '여러 언어 · 더 정확해요']],
    cohere: [['embed-multilingual-v3.0', '여러 언어'], ['embed-english-v3.0', '영어 위주']],
    ollama: [['bge-m3', '여러 언어'], ['nomic-embed-text', '영어 위주']],
};
const MODEL_FREE = new Set(['transformers', 'mistral', 'nomicai']); // the server picks the model itself

export function embedCfg() {
    const e = globalSettings().embed && typeof globalSettings().embed === 'object' ? globalSettings().embed : {};
    return { source: e.source in EMBED_SOURCES ? e.source : '', model: String(e.model || '').trim(), url: String(e.url || '').trim(), region: String(e.region || '').trim() };
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
            // the key and the auth mode are the ones saved in SillyTavern's Vertex AI connection, passed as they are
            // (an unset mode means SillyTavern's own default, the Express key). The region is that connection's too,
            // unless one is set for embeddings: the text-embedding models are not served on every region, "global" included
            b.model = String(pickModel('google_model')).replace(/^models\//, ''); b.api = 'vertexai';
            b.vertexai_auth_mode = oai.vertexai_auth_mode;
            b.vertexai_region = cfg.region || String(oai.vertexai_region || '').trim() || undefined;
            b.vertexai_express_project_id = oai.vertexai_express_project_id;
            break;
        }
        default: break;
    }
    return b;
}
// Vertex with no embedding region of our own and not already on us-central1
const regionCanMove = b => b.source === 'vertexai' && !embedCfg().region && b.vertexai_region !== 'us-central1';

// what the vectors were made with; a different one needs its own collection
const signature = b => `${b.source}|${MODEL_FREE.has(b.source) ? '' : b.model || ''}`;
export const embedLabel = () => { if (!embedOn()) return '끔'; const b = sourceBody(); return `${EMBED_SOURCES[b.source] || b.source}${b.model ? ` · ${b.model}` : ''}`; };

const sleep = ms => new Promise(r => setTimeout(r, ms));

// one call to the server's vector API. A remote embedding service that is over its per-minute quota or briefly down
// comes back as a 5xx (SillyTavern's server turns Vertex's 429 into a 500), so those are tried again after a pause;
// a 4xx is a real mistake and is not
async function vec(path, body, ms = 30_000, { retries = 0, stop = null, waits = [4000, 12000, 30000], onWait = null } = {}) {
    let last = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        if (attempt) {
            const wait = waits[attempt - 1] ?? waits[waits.length - 1];
            for (let t = 0; t < wait; t += 500) { if (stop?.()) throw new Error('채팅이 바뀌어서 멈췄어요'); onWait?.(Math.ceil((wait - t) / 1000)); await sleep(500); }
        }
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), ms);
        try {
            const r = await fetch(`/api/vector/${path}`, { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify(body), signal: ctl.signal });
            if (!r.ok) {
                const txt = (await r.text().catch(() => '')).slice(0, 200);
                last = new Error(`임베딩 ${r.status}${txt && !/^<!doctype/i.test(txt) ? `: ${txt}` : ''}`);
                last.status = r.status;
                if (r.status >= 400 && r.status < 500 && r.status !== 429) break;
                continue;
            }
            return path === 'list' || path === 'query' ? r.json() : null;
        } catch (e) {
            last = e.name === 'AbortError' ? new Error(`임베딩이 ${Math.round(ms / 1000)}초 안에 답이 없었어요`) : e;
        } finally { clearTimeout(timer); }
    }
    throw last;
}
const REMOTE = new Set(['palm', 'vertexai', 'openai', 'openrouter', 'cohere', 'mistral', 'nomicai', 'togetherai', 'electronhub', 'chutes', 'nanogpt', 'siliconflow', 'workers_ai']);
const MAX_TEXT = 2000; // characters per embedded text; gemini-embedding reads about 2,000 tokens at most

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
        const have = new Set((await vec('list', { ...b, collectionId: st.coll }, 30_000, { retries: 1 })).map(Number));
        const add = all.filter(x => !have.has(x.hash));
        const gone = [...have].filter(h => !want.has(h));
        if (gone.length) await vec('delete', { ...b, collectionId: st.coll, hashes: gone }, 30_000, { retries: 1 });
        // Vertex counts requests per minute per model family (the text-embedding models share one "textembedding-gecko"
        // quota, often small), and the server sends each insert as one request — so texts go in as few requests as
        // the model allows: gemini-embedding one per request, the others up to 40 texts / about 9,000 characters.
        // A remote service also gets a pause between requests, longer once it has said "too many"
        const google = b.source === 'vertexai' || b.source === 'palm';
        const one = google && /^gemini-embedding/.test(b.model || '');
        const maxN = one ? 1 : ['transformers', 'ollama'].includes(b.source) ? 8 : 40;
        const maxChars = google && !one ? 9000 : Infinity;
        const batches = [];
        for (const x of add) {
            const cur = batches[batches.length - 1];
            const len = Math.min(MAX_TEXT, x.text.length);
            if (cur && cur.n < maxN && cur.chars + len <= maxChars) { cur.items.push(x); cur.n++; cur.chars += len; }
            else batches.push({ items: [x], n: 1, chars: len });
        }
        let pace = REMOTE.has(b.source) ? 400 : 0;
        // a quota is per minute: wait out a whole minute (and a bit) before trying again
        const quotaWaits = REMOTE.has(b.source) ? [15_000, 65_000, 65_000, 65_000, 65_000] : [4000, 12000, 30000];
        const stop = () => currentChatId() !== id;
        let skipped = 0, failRun = 0, regionMoved = '', done = 0, slowed = false;
        for (let bi = 0; bi < batches.length; bi++) {
            const k = bi; // first batch = k 0 (region fallback below looks at it)
            if (stop()) throw new Error('채팅이 바뀌어서 멈췄어요');
            const items = batches[bi].items.map((x, j) => ({ hash: x.hash, text: x.text.slice(0, MAX_TEXT), index: done + j }));
            const onWait = sec => { slowed = true; onProgress?.(done, add.length, `한도에 걸려 쉬는 중… ${sec}초`); };
            try {
                try {
                    await vec('insert', { ...b, collectionId: st.coll, items }, 120_000, k === 0 && regionCanMove(b) ? { retries: 1, stop } : { retries: quotaWaits.length, waits: quotaWaits, stop, onWait });
                } catch (e) {
                    // the first text failing on Vertex with no region chosen for embeddings: try us-central1 once,
                    // where every Vertex embedding model is served, and keep it if that works
                    if (k !== 0 || !regionCanMove(b) || !(e.status >= 500)) throw e;
                    const moved = { ...b, vertexai_region: 'us-central1' };
                    await vec('insert', { ...moved, collectionId: st.coll, items }, 120_000, { retries: quotaWaits.length, waits: quotaWaits, stop, onWait });
                    Object.assign(b, moved);
                    globalSettings().embed = { ...embedCfg(), region: 'us-central1' }; saveGlobal();
                    regionMoved = `${e.status}`;
                }
                failRun = 0;
            } catch (e) {
                // one text the service keeps refusing is skipped (it is tried again on the next build);
                // several in a row means the service itself is down, so stop and say so
                if (stop() || ++failRun >= 3 || items.length > 1) throw e;
                skipped += items.length;
                console.warn('[narrative-archive] embed skip', e);
            }
            done += items.length;
            onProgress?.(done, add.length);
            // after a "too many", keep well under the quota for the rest of the run
            if (slowed && pace) { pace = Math.max(pace, 3000); slowed = false; }
            if (pace && bi + 1 < batches.length) await sleep(pace);
        }
        st.skipped = skipped;
        st.regionMoved = regionMoved;
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
