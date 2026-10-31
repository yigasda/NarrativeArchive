// 뜻으로 찾기: sections also go into SillyTavern's vector store, so the router can
// find a moment by meaning ("all those lights" → a section about paper lanterns), and a Korean chat finds an
// English archive. Uses the server's /api/vector endpoints; vectors stay in SillyTavern's own data folder.

import { currentChatId } from './chats.js';
import { ctx, getMeta, globalSettings, hasChat, saveGlobal } from './core.js';
import { sectionItems } from './recall.js';
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

// one call to the server's vector API; the error carries the HTTP status
async function vec(path, body, ms = 30_000) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    try {
        const r = await fetch(`/api/vector/${path}`, { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify(body), signal: ctl.signal });
        if (!r.ok) {
            const txt = (await r.text().catch(() => '')).slice(0, 200);
            const e = new Error(`임베딩 ${r.status}${txt && !/^<!doctype/i.test(txt) ? `: ${txt}` : ''}`);
            e.status = r.status;
            throw e;
        }
        return path === 'list' || path === 'query' ? r.json() : null;
    } catch (e) {
        if (e.name === 'AbortError') { const t = new Error(`임베딩이 ${Math.round(ms / 1000)}초 안에 답이 없었어요`); t.status = 0; throw t; }
        throw e;
    } finally { clearTimeout(timer); }
}
// SillyTavern's server hands a provider's "too many requests" back as a 5xx; a timeout or a dropped connection
// is as likely to be load. Those are worth waiting out; any other 4xx is a request the service will never take
const busyError = e => !e.status || e.status === 429 || e.status >= 500;

// ---- request meter: how many embedding requests one model may take per minute, learned as we go.
// Nothing is assumed up front. When the service says it is busy, the number sent in the last minute (a bit less)
// becomes the ceiling for that model and region, remembered for next time; later requests are spread under it,
// and a long quiet run lets the ceiling creep back up.
const meters = new Map();
function meterFor(b) {
    const key = `${b.source}|${b.model || ''}|${b.vertexai_region || ''}`;
    if (!meters.has(key)) {
        const saved = Number(globalSettings().embedLimits?.[key]) || 0;
        meters.set(key, { key, stamps: [], limit: saved, calm: 0, coolUntil: 0 });
    }
    return meters.get(key);
}
function saveLimit(mt) {
    const g = globalSettings();
    g.embedLimits = { ...(g.embedLimits || {}), [mt.key]: mt.limit };
    saveGlobal();
}
// wait until one more request fits under the ceiling; onWait(seconds) while waiting
async function meterTake(mt, stop, onWait) {
    for (;;) {
        const now = Date.now();
        mt.stamps = mt.stamps.filter(t => now - t < 60_000);
        let until = mt.coolUntil || 0;
        if (mt.limit && until <= now) {
            if (mt.stamps.length >= mt.limit) until = mt.stamps[0] + 60_000 + 250;
            else if (mt.stamps.length) until = mt.stamps[mt.stamps.length - 1] + Math.floor(60_000 / mt.limit);
        }
        if (until <= now) break;
        if (stop?.()) throw new Error('채팅이 바뀌어서 멈췄어요');
        if (until - now > 1500) onWait?.(Math.ceil((until - now) / 1000));
        await sleep(Math.min(500, until - now));
    }
    mt.stamps.push(Date.now());
}
function meterBusy(mt) {
    const recent = mt.stamps.filter(t => Date.now() - t < 60_000).length;
    // too few of ours to learn from (the quota went to something else, e.g. another extension): sit out the minute
    if (recent < 3) { mt.coolUntil = Date.now() + 61_000; return; }
    const next = Math.max(2, Math.floor(recent * 0.75));
    mt.limit = mt.limit ? Math.min(mt.limit, next) : next;
    mt.calm = 0;
    saveLimit(mt);
}
function meterOk(mt) {
    if (!mt.limit) return;
    if (++mt.calm >= 30) { mt.limit += 1; mt.calm = 0; saveLimit(mt); }
}
// list / delete are local to SillyTavern; one more try after a short pause covers a hiccup
async function vecOnce(path, body) {
    try { return await vec(path, body); }
    catch (e) { if (!busyError(e)) throw e; await sleep(3000); return vec(path, body); }
}

const REMOTE = new Set(['palm', 'vertexai', 'openai', 'openrouter', 'cohere', 'mistral', 'nomicai', 'togetherai', 'electronhub', 'chutes', 'nanogpt', 'siliconflow', 'workers_ai']);
const MAX_TEXT = 2000; // characters per embedded text; gemini-embedding reads about 2,000 tokens at most

// a positive 32-bit number per text, the kind of hash the vector store keys items by
const numHash = s => { let h = 0x811c9dc5 ^ 0x5bd1; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0) || 1; };

// what goes in: every numbered section in pieces of about 900 characters, each with its title in front,
// (hidden raw passages went in too while 회상 was there; since 3.88.0 only the router searches, by section)
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
    return out;
}

const state = new Map(); // chat id → { sig, coll, items: Map(hash → item), synced, at, busy, key }

// a cheap fingerprint of what corpus() would read: the archive text, and which messages are hidden and how long they are
function corpusKey(m) {
    const chat = ctx().chat || [];
    let n = 0, len = 0, last = -1;
    for (let i = 0; i < chat.length; i++) { const x = chat[i]; if (x?.is_system) { n++; len += String(x.mes || '').length; last = i; } }
    return `${shortHash(String(m?.text || ''))}|${n}|${len}|${last}`; // a new, visible message changes none of it
}
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
    // nothing to do when the archive and the hidden messages are as they were at the last finished sync: this check
    // is a few milliseconds, cutting and hashing every hidden message again is not (it froze phones on every reply)
    const key = corpusKey(getMeta());
    if (!force && st.synced && st.key === key) return st;
    st.busy = true;
    try {
        const all = corpus(getMeta());
        const want = new Map(all.map(x => [x.hash, x]));
        const have = new Set((await vecOnce('list', { ...b, collectionId: st.coll })).map(Number));
        const add = all.filter(x => !have.has(x.hash));
        const gone = [...have].filter(h => !want.has(h));
        if (gone.length) await vecOnce('delete', { ...b, collectionId: st.coll, hashes: gone });
        // Each insert is one request to the provider, and providers count requests per minute (on Vertex the
        // text-embedding models share one quota), so texts are packed into as few inserts as the model takes:
        // gemini-embedding one text per request, the text-embedding models many (we stay well under their per-request
        // token cap), local models a handful so the server isn't swamped
        const google = b.source === 'vertexai' || b.source === 'palm';
        const one = google && /^gemini-embedding/.test(b.model || '');
        const maxN = one ? 1 : ['transformers', 'ollama'].includes(b.source) ? 8 : 40;
        const maxChars = google && !one ? 15000 : Infinity;
        const batches = [];
        for (const x of add) {
            const cur = batches[batches.length - 1];
            const len = Math.min(MAX_TEXT, x.text.length);
            if (cur && cur.n < maxN && cur.chars + len <= maxChars) { cur.items.push(x); cur.n++; cur.chars += len; }
            else batches.push({ items: [x], n: 1, chars: len });
        }
        const stop = () => currentChatId() !== id;
        const remote = REMOTE.has(b.source);
        let mt = meterFor(b);
        let skipped = 0, failRun = 0, regionMoved = '', done = 0;
        const onWait = sec => onProgress?.(done, add.length, `한도에 맞춰 기다리는 중… ${sec}초`);
        for (let bi = 0; bi < batches.length; bi++) {
            if (stop()) throw new Error('채팅이 바뀌어서 멈췄어요');
            const items = batches[bi].items.map((x, j) => ({ hash: x.hash, text: x.text.slice(0, MAX_TEXT), index: done + j }));
            let tries = 0, sent = false;
            while (!sent) {
                if (remote) await meterTake(mt, stop, onWait);
                try {
                    await vec('insert', { ...b, collectionId: st.coll, items }, 120_000);
                    sent = true;
                    if (remote) meterOk(mt);
                } catch (e) {
                    if (stop()) throw e;
                    // Vertex with no embedding region of its own: the first refusal moves it to us-central1 once
                    if (bi === 0 && tries === 0 && regionCanMove(b) && e.status >= 500) {
                        b.vertexai_region = 'us-central1';
                        globalSettings().embed = { ...embedCfg(), region: 'us-central1' }; saveGlobal();
                        regionMoved = `${e.status}`;
                        mt = meterFor(b);
                        tries++;
                        continue;
                    }
                    if (!busyError(e) || ++tries >= 6) {
                        // a text the service will not take is left for the next build; several in a row means it is down
                        if (++failRun >= 3 || items.length > 1) throw e;
                        skipped += items.length;
                        console.warn('[narrative-archive] embed skip', e);
                        break;
                    }
                    if (remote) meterBusy(mt); else await sleep(2000 * tries);
                }
            }
            if (sent) failRun = 0;
            done += items.length;
            onProgress?.(done, add.length);
        }
        st.skipped = skipped;
        st.regionMoved = regionMoved;
        st.items = want;
        st.key = key;
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
        // a raw piece comes back as the passages it holds, each with the piece's rank
        return (r?.hashes || []).flatMap((h, rank) => {
            const x = st.items.get(Number(h));
            if (!x?.kind) return [];
            return x.kind === 'raw' && x.parts ? x.parts.map(p => ({ kind: 'raw', i: p.i, text: `${p.name}: ${p.text}`, rank })) : [{ ...x, rank }];
        });
    } catch (e) {
        console.warn('[narrative-archive] embed search', e);
        return [];
    }
}

// after the archive or the hidden messages change: catch up quietly a moment later
let soon = null;
// only the AI router searches the index, so with the router off nothing is built (the 만들기 button still builds)
export const routerUsesEmbed = m => ['linked', 'old', 'lift'].includes(m?.router?.mode);
export function embedSoon() {
    if (!embedOn() || broken || !hasChat() || !routerUsesEmbed(getMeta())) return;
    clearTimeout(soon);
    soon = setTimeout(() => syncEmbed().catch(e => console.warn('[narrative-archive] embed sync', e)), 4000);
}
