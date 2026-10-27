// Search index over the raw chat (hidden messages too) and the archive's sections: BM25 on words. Korean words also
// count by their stem without the particle, so "세트가" still finds "세트는".
// Used by 회상 (relevant old lines injected before each reply), 질문하기 and the voice notes.
// Also here: 롤플 밖 메시지 (/comment, OOC, /sys). 꼭 남길 장면 come first among equal hits.

import { glossaryEntries } from './translate.js';
import { ctx, getMeta, globalSettings, hasChat, saveGlobal, saveMeta } from './core.js';
import { cleanMessage } from './extract.js';
import { currentInjection } from './inject.js';
import { isKeptAt, sectionKept } from './keeps.js';
import { mutedSet, parseSections, sectionKey, splitTail } from './sections.js';

export const RECALL_KEY = 'narrative_archive_recall';

// ---- 롤플 밖 메시지: what is not the story, by kind. Each kind is switched on its own in the settings.

export const OFF_KINDS = {
    comment: ['/comment 코멘트', '분석 QR처럼 /comment로 넣은 메모', '코멘트'],
    ooc: ['OOC 메모', 'OOC:, 사담: 으로 시작하는 메시지', 'OOC'],
    narrator: ['/sys 내레이터 메시지', '상태창이나 선택지를 /sys로 띄우는 경우', '/sys'],
};
// 3.69's single choice ('keep' | 'aside' | 'all') carries over the first time
export function offKinds() {
    const g = globalSettings();
    if (!g.offKinds || typeof g.offKinds !== 'object') {
        const old = g.offstage;
        g.offKinds = old === 'keep' || old === '' ? { comment: false, ooc: false, narrator: false } : { comment: true, ooc: true, narrator: old === 'all' };
    }
    return { comment: g.offKinds.comment !== false, ooc: g.offKinds.ooc !== false, narrator: g.offKinds.narrator === true };
}
export const setOffKind = (k, on) => { const g = globalSettings(); g.offKinds = { ...offKinds(), [k]: !!on }; saveGlobal(); };

const OOC_RE = /^\s*[([{【]?\s*(ooc|out of character|사담|잡담)\s*[:：)\]】]/i;

export function isOffstage(msg, prev = null) {
    if (!msg) return false;
    const k = offKinds(), extra = msg.extra || {}, text = String(msg.mes || '');
    if (k.comment && extra.type === 'comment') return true;
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
        const star = !!m && isKeptAt(m, i);
        for (const p of passages(text)) out.push({ kind: 'raw', i, name, star, text: p });
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
    return parseSections(body).filter(s => !s.group && !muted.has(sectionKey(s))).map(s => ({ kind: 'sec', s, title: s.title, star: sectionKept(m, s.title), text: body.slice(s.start, s.end) }));
}

// bullets of the sections that are not going in whole right now (faded, waiting for a keyword, picked out by the router)
export function bulletItems(m, injected) {
    const out = [];
    for (const x of sectionItems(m)) {
        const head = x.text.match(/^[^\n]*/)[0];
        if (injected.includes(x.text.trim())) continue;
        for (const line of x.text.slice(head.length).split('\n')) {
            const l = line.replace(/^\s*[-*•]\s+/, '').trim();
            if (l.length >= 25 && !/^[A-Z][A-Z ]*:\s*$/.test(l)) out.push({ kind: 'bullet', title: x.title, star: x.star, text: l });
        }
    }
    return out;
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

// ---- 회상: before each reply, find old lines that fit the newest messages

export function recallCfg(m) {
    const r = m?.recall && typeof m.recall === 'object' ? m.recall : {};
    const num = (v, d, lo, hi) => (Number.isFinite(+v) && v !== '' && v !== undefined ? Math.min(hi, Math.max(lo, +v)) : d);
    return { on: !!r.on, k: num(r.k, 4, 1, 12), budget: num(r.budget, 600, 100, 4000), depth: num(r.depth, 2, 0, 20), scan: num(r.scan, 3, 1, 10), secs: r.secs !== false };
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

// hits for a query: raw passages (and section bullets), 꼭 남길 장면 first among equals, at most one passage per message,
// within the token budget. minHits: how many different query words an item must share
export function pick(results, { k, budget, minHits = 2 }) {
    if (!results.length) return [];
    const top = results[0].score;
    const scored = results.map(r => ({ ...r, score: r.score * (r.item.star ? 1.5 : 1) })).sort((x, y) => y.score - x.score);
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

export const lastRecall = new Map(); // chat id → { at, lines, tokens }

export async function runRecall() {
    const c = ctx();
    if (!hasChat()) { c.setExtensionPrompt(RECALL_KEY, '', 1, 0); return null; }
    const m = getMeta();
    const cfg = recallCfg(m);
    if (!m.enabled || !cfg.on) { c.setExtensionPrompt(RECALL_KEY, '', 1, 0); return null; }
    const q = recallQuery(cfg.scan).map(x => ({ ...x, text: withGlossary(m, x.text) }));
    const injected = cfg.secs ? (await currentInjection()).text || '' : '';
    const items = [...rawItems({ only: 'hidden' }), ...(cfg.secs ? bulletItems(m, injected) : [])];
    const qn = new Set(q.flatMap(x => tokenize(x.text))).size;
    const hits = pick(bm25(items, q), { k: cfg.k, budget: cfg.budget, minHits: qn < 6 ? 1 : 2 })
        .sort((x, y) => (x.item.i ?? -1) - (y.item.i ?? -1));
    const id = String(c.getCurrentChatId?.() || c.chatId || '');
    if (!hits.length) { c.setExtensionPrompt(RECALL_KEY, '', 1, 0); lastRecall.set(id, { at: Date.now(), lines: [], tokens: 0 }); return null; }
    const lines = hits.map(recallLine);
    const text = `# FROM EARLIER IN THE STORY\n_Old moments that touch what is happening now, from the original messages and the archive. For consistency only: never quote, list or mention them._\n${lines.join('\n')}`;
    c.setExtensionPrompt(RECALL_KEY, text, 1, cfg.depth, false, 0);
    const st = { at: Date.now(), lines, tokens: estTok(text) };
    lastRecall.set(id, st);
    return st;
}

export async function setRecall(patch) {
    const m = getMeta();
    m.recall = { ...(m.recall && typeof m.recall === 'object' ? m.recall : {}), ...patch };
    await saveMeta();
    await runRecall();
}
