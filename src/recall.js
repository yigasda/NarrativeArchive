// Search index over the raw chat (hidden messages too) and the archive's sections: BM25 on words. Korean words also
// count by their stem without the particle, so "세트가" still finds "세트는".
// Used by 질문하기, the AI router and the voice notes.
// Also here: OOC 빼기 (OOC, 나레이터; /comment always).

import { glossaryEntries } from './translate.js';
import { ctx, getMeta, globalSettings, hasChat, saveGlobal } from './core.js';
import { cleanMessage } from './extract.js';
import { mutedSet, parseSections, sectionKey, splitTail } from './sections.js';

// 회상 went in 3.88.0; the key is still cleared so an old chat keeps no stale block
export const RECALL_KEY = 'narrative_archive_recall';

// ---- OOC 빼기: what is not the story, by kind. Each kind is switched on its own in the settings.

// a /comment message is never the story, so it is always left out (no switch)
export const OFF_KINDS = {
    ooc: ['OOC 메모', 'OOC:, 사담: 으로 시작하는 메시지', 'OOC 메모'],
    narrator: ['나레이터 메시지', '상태창이나 선택지를 나레이터로 띄우는 경우 (/sys)', '나레이터'],
};
// 3.69's single choice ('keep' | 'aside' | 'all') carries over the first time
export function offKinds() {
    const g = globalSettings();
    if (!g.offKinds || typeof g.offKinds !== 'object') {
        const old = g.offstage;
        g.offKinds = old === 'keep' || old === '' ? { comment: false, ooc: false, narrator: false } : { comment: true, ooc: true, narrator: old === 'all' };
    }
    return { ooc: g.offKinds.ooc !== false, narrator: g.offKinds.narrator === true };
}
export const setOffKind = (k, on) => { const g = globalSettings(); g.offKinds = { ...offKinds(), [k]: !!on }; saveGlobal(); };

const OOC_RE = /^\s*[([{【]?\s*(ooc|out of character|사담|잡담)\s*[:：)\]】]/i;

export function isOffstage(msg, prev = null) {
    if (!msg) return false;
    const k = offKinds(), extra = msg.extra || {}, text = String(msg.mes || '');
    if (extra.type === 'comment') return true;
    if (k.ooc && OOC_RE.test(text)) return true;
    return k.narrator && extra.type === 'narrator';
}
// indexes of off-story messages in the chat (or the given list)
export function offstageSet(chat = ctx().chat || []) {
    const out = new Set();
    chat.forEach((x, i) => { if (isOffstage(x, chat[i - 1])) out.add(i); });
    return out;
}

// ---- tokens and BM25

// Korean words are matched by their stem: the particle at the end comes off and both forms are kept ("세트가" → 세트가, 세트).
// Japanese and Chinese have no spaces, so they go in two-letter pieces.
const HANGUL = /[가-힯]/, KANA_HAN = /[぀-ヿ㐀-鿿]/;
const KO_TAIL = /(?:에서부터|으로부터|에게서|한테서|으로서|으로써|이라고|이라는|에서|에게|한테|께서|까지|부터|처럼|보다|이랑|이나|이며|으로|랑|나|며|로|은|는|이|가|을|를|의|에|와|과|도|만|야|아|요)$/;
const STOP = new Set(('the a an and but or if then so of to in on at by for from with as is are was were be been it its this that these those he she they we you i '
    + 'his her their our your my me him them us not no do did does had has have will would could should can just very too also than there here what who when where why how '
    + 'said says into out up down over again all any some one only still even back now').split(' '));
export function tokenize(text) {
    const out = [];
    for (const w of String(text || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) {
        if (HANGUL.test(w)) {
            if (w.length < 2) continue;
            out.push(w);
            const stem = w.replace(KO_TAIL, '');
            if (stem && stem !== w) out.push(stem);
        } else if (KANA_HAN.test(w)) {
            if (w.length <= 2) out.push(w);
            else for (let i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2));
        } else if (w.length >= 2 && !STOP.has(w)) out.push(w);
    }
    return out;
}

export const estTok = t => { const s = String(t), h = (s.match(/[ᄀ-ᇿ㄰-㆏가-힯]/g) || []).length; return Math.ceil(h + (s.length - h) / 3.6); };

const tokCache = new Map(); // text → term counts
function termsOf(text) {
    let hit = tokCache.get(text);
    if (hit) return hit;
    hit = new Map();
    for (const t of tokenize(text)) hit.set(t, (hit.get(t) || 0) + 1);
    hit.len = [...hit.values()].reduce((a, b) => a + b, 0);
    if (tokCache.size > 20000) tokCache.clear();
    tokCache.set(text, hit);
    return hit;
}

// items: [{ text, ... }] → [{ item, score, hits }] best first; hits = distinct query words found.
// query: a string, or [{ text, w }] where each part's words count w times (a word in several parts keeps its largest w)
export function bm25(items, query, { k1 = 1.2, b = 0.75 } = {}) {
    const wt = new Map();
    for (const part of Array.isArray(query) ? query : [{ text: query, w: 1 }]) for (const t of tokenize(part.text)) wt.set(t, Math.max(wt.get(t) || 0, part.w));
    const q = [...wt.keys()];
    if (!q.length || !items.length) return [];
    const docs = items.map(x => termsOf(x.text));
    const avg = docs.reduce((a, d) => a + d.len, 0) / docs.length || 1;
    const n = docs.length;
    const idf = new Map(q.map(t => { const df = docs.reduce((a, d) => a + (d.has(t) ? 1 : 0), 0); return [t, Math.log(1 + (n - df + 0.5) / (df + 0.5))]; }));
    const out = [];
    docs.forEach((d, i) => {
        let s = 0, hits = 0;
        for (const t of q) {
            const f = d.get(t);
            if (!f) continue;
            hits++;
            s += wt.get(t) * idf.get(t) * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / avg));
        }
        if (s > 0) out.push({ item: items[i], score: s, hits });
    });
    return out.sort((x, y) => y.score - x.score);
}

// ---- what can be found

// raw messages as passages of a few paragraphs; only: 'hidden' (compressed, out of the AI's sight) or 'all'
export function rawItems({ only = 'all', upto = Infinity } = {}) {
    const chat = ctx().chat || [];
    const off = offstageSet(chat);
    const m = hasChat() ? getMeta() : null;
    const out = [];
    chat.forEach((x, i) => {
        if (!x || i > upto || off.has(i)) return;
        if (only === 'hidden' && !x.is_system) return;
        if (x.is_system && !x.is_user && !x.name) return;
        const text = cleanMessage(String(x.mes || ''), { stripTags: true });
        if (!text.trim()) return;
        const name = x.name || (x.is_user ? 'User' : 'Char');
        for (const p of passages(text)) out.push({ kind: 'raw', i, name, text: p });
    });
    return out;
}
// paragraphs joined up to about 700 characters, a long paragraph cut at sentence ends
function passages(text, max = 700) {
    const parts = [];
    for (const para of text.split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean)) {
        if (para.length <= max) { parts.push(para); continue; }
        let cur = '';
        for (const s of para.split(/(?<=[.!?。…"”])\s+/)) {
            if (cur && cur.length + s.length > max) { parts.push(cur); cur = ''; }
            cur += (cur ? ' ' : '') + s;
        }
        if (cur) parts.push(cur);
    }
    const out = [];
    let cur = '';
    for (const p of parts) {
        if (cur && cur.length + p.length > max) { out.push(cur); cur = ''; }
        cur += (cur ? '\n' : '') + p;
    }
    if (cur) out.push(cur);
    return out;
}

// numbered sections, whole (질문하기) — the heading counts as part of the text
export function sectionItems(m) {
    const [body] = splitTail(m.text);
    const muted = mutedSet(m);
    return parseSections(body).filter(s => !s.group && !muted.has(sectionKey(s))).map(s => ({ kind: 'sec', s, title: s.title, text: body.slice(s.start, s.end) }));
}

// the glossary's name pairs (Set = 세트) join a query in both spellings, so a Korean chat still finds an English archive
export function withGlossary(m, q) {
    const low = String(q || '').toLowerCase();
    const add = [];
    for (const e of glossaryEntries(m)) {
        const a = e.src.toLowerCase(), b = e.ko.toLowerCase();
        if (low.includes(a) && !low.includes(b)) add.push(e.ko);
        else if (low.includes(b) && !low.includes(a)) add.push(e.src);
    }
    return add.length ? `${q}\n${add.join(' ')}` : q;
}

// the newest messages as a weighted query: the one being answered counts most, each older one a little less
export function recallQuery(n) {
    const chat = ctx().chat || [];
    const off = offstageSet(chat);
    const out = [];
    for (let i = chat.length - 1; i >= 0 && out.length < n; i--) {
        const x = chat[i];
        if (!x || x.is_system || off.has(i)) continue;
        out.push(cleanMessage(String(x.mes || ''), { stripTags: true }).slice(-2000));
    }
    return out.map((text, k) => ({ text, w: Math.max(0.3, 1 - k * 0.25) }));
}

// hits for a query: raw passages (and section bullets), at most one passage per message,
// within the token budget. minHits: how many different query words an item must share
export function pick(results, { k, budget, minHits = 2 }) {
    if (!results.length) return [];
    const top = results[0].score;
    const scored = [...results].sort((x, y) => y.score - x.score);
    const out = [], seen = new Set();
    let tok = 0;
    for (const r of scored) {
        if (out.length >= k) break;
        if (r.hits < minHits || r.score < top * 0.3) continue;
        const key = r.item.kind === 'raw' ? `r${r.item.i}` : `b${r.item.title}|${r.item.text.slice(0, 40)}`;
        if (seen.has(key)) continue;
        const t = estTok(r.item.text) + 12;
        if (tok + t > budget) continue;
        seen.add(key);
        tok += t;
        out.push(r);
    }
    return out;
}

export const recallLine = r => r.item.kind === 'raw'
    ? `- [#${r.item.i} ${r.item.name}] ${r.item.text.replace(/\s*\n\s*/g, ' ')}`
    : `- [${r.item.title.replace(/\s*\(.*$/, '')}] ${r.item.text}`;
