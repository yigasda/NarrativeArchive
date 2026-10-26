// Search index over the raw chat (hidden messages too) and the archive's sections: BM25 on words, and on two-letter
// pieces of Korean, Japanese and Chinese words (they take particles, so "세트가" still finds "세트는").
// Used by 회상 (relevant old lines injected before each reply), 질문하기 and the voice notes.
// Also here: ★ important scenes (a mark on the message itself) and off-story messages (/comment, /sys, QR asides, OOC).

import { ctx, getMeta, globalSettings, hasChat, saveMeta } from './core.js';
import { cleanMessage } from './extract.js';
import { currentInjection } from './inject.js';
import { RANGE_HEAD, mutedSet, parseSections, sectionKey, splitTail } from './sections.js';

export const RECALL_KEY = 'narrative_archive_recall';

// ---- off-story messages

// a QR that pauses the role-play for a side piece (a balance game, a what-if), or an OOC note
const ASIDE_RE = /\b(pause|stop|halt|suspend|interrupt)\b[^.\n]{0,40}\b(role-?play|rp|scenario|story|roleplay)\b|\bpause\s+rp\b|set aside all prior prompts|(롤플|역할극|RP)[^\n]{0,12}(멈|중단|정지|잠깐)/i;
const OOC_RE = /^\s*[([{【]?\s*(ooc|out of character|사담|잡담)\s*[:：)\]】]/i;

// '' = keep everything, 'aside' = comments, OOC and QR side pieces (default), 'all' = also /sys narrator lines
export const offstageMode = () => { const v = globalSettings().offstage; return v === '' || v === 'keep' ? 'keep' : v === 'all' ? 'all' : 'aside'; };
export function isOffstage(msg, prev = null) {
    if (!msg) return false;
    const mode = offstageMode();
    if (mode === 'keep') return false;
    const extra = msg.extra || {};
    if (extra.type === 'comment' || extra.na_aside) return true;
    const text = String(msg.mes || '');
    if (OOC_RE.test(text)) return true;
    if (msg.is_user && ASIDE_RE.test(text)) return true;
    // the answer to a side-piece request is a side piece too
    if (!msg.is_user && prev?.is_user && ASIDE_RE.test(String(prev.mes || ''))) return true;
    return mode === 'all' && (extra.type === 'narrator' || extra.model === 'slash command');
}
// indexes of off-story messages in the chat (or the given list)
export function offstageSet(chat = ctx().chat || []) {
    const out = new Set();
    chat.forEach((x, i) => { if (isOffstage(x, chat[i - 1])) out.add(i); });
    return out;
}

// ---- ★ important scenes: stored on the message, so deleting messages before it does not move the mark

export const isStarred = msg => !!msg?.extra?.na_star;
export const starredIndexes = (from = 0, to = Infinity) => (ctx().chat || []).flatMap((x, i) => (i >= from && i <= to && isStarred(x) ? [i] : []));
// one line for a compress request: which messages in the range the user marked
export function starNote(from, to) {
    const s = starredIndexes(from, to);
    return s.length ? `Messages the user marked as important scenes: ${s.map(i => `#${i}`).join(', ')}. Keep them in detail: what happened, who said what (their key lines word for word), and what it changed. Never fold them into a one-line summary.` : '';
}
// does a "#a–#b" section hold a starred message?
export function sectionStarred(title) {
    const r = String(title || '').match(RANGE_HEAD);
    if (!r) return false;
    const a = Math.min(+r[2], +r[4]), b = Math.max(+r[2], +r[4]);
    return starredIndexes(a, b).length > 0;
}

export async function toggleStar(id) {
    const c = ctx();
    const msg = c.chat?.[id];
    if (!msg) return;
    msg.extra ||= {};
    const on = !msg.extra.na_star;
    if (on) msg.extra.na_star = true; else delete msg.extra.na_star;
    await c.saveChat?.();
    decorateMessage(id);
    toastr.success(on ? '중요 장면으로 표시했어요. 압축할 때 자세히 남기고, 망각 곡선이 줄이지 않고, 회상할 때 먼저 꺼내요.' : '중요 표시를 지웠어요.', '서사 아카이브', { timeOut: 4000 });
}

export function decorateMessage(id) {
    const el = document.querySelector(`#chat .mes[mesid="${id}"]`);
    const msg = ctx().chat?.[id];
    if (!el || !msg) return;
    const extra = el.querySelector('.extraMesButtons');
    if (extra && !extra.querySelector('.na_mes_star')) {
        const b = document.createElement('div');
        b.className = 'mes_button na_mes_star fa-regular fa-star';
        b.title = '서사 아카이브: 중요 장면으로 표시';
        b.tabIndex = 0;
        extra.prepend(b);
    }
    const on = isStarred(msg);
    const btn = el.querySelector('.na_mes_star');
    if (btn) { btn.classList.toggle('fa-solid', on); btn.classList.toggle('fa-regular', !on); }
    let badge = el.querySelector('.na_star_badge');
    if (on && !badge) {
        badge = document.createElement('span');
        badge.className = 'na_star_badge fa-solid fa-star';
        badge.title = '중요 장면 · 누르면 표시를 지워요';
        el.querySelector('.name_text')?.after(badge);
    } else if (!on && badge) badge.remove();
}
export const decorateAll = () => document.querySelectorAll('#chat .mes[mesid]').forEach(el => decorateMessage(Number(el.getAttribute('mesid'))));
$(document).on('click', '.na_mes_star, .na_star_badge', function (e) {
    const id = Number(this.closest('.mes')?.getAttribute('mesid'));
    if (Number.isNaN(id)) return;
    e.stopPropagation();
    toggleStar(id);
});

// ---- tokens and BM25

const CJK = /[぀-ヿ㐀-鿿가-힯]/;
const STOP = new Set(('the a an and but or if then so of to in on at by for from with as is are was were be been it its this that these those he she they we you i '
    + 'his her their our your my me him them us not no do did does had has have will would could should can just very too also than there here what who when where why how '
    + 'said says into out up down over again all any some one only still even back now').split(' '));
export function tokenize(text) {
    const out = [];
    for (const w of String(text || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) {
        if (CJK.test(w)) {
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

// items: [{ text, ... }] → [{ item, score, hits }] best first; hits = distinct query words found
export function bm25(items, query, { k1 = 1.2, b = 0.75 } = {}) {
    const q = [...new Set(tokenize(query))];
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
            s += idf.get(t) * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / avg));
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
    const out = [];
    chat.forEach((x, i) => {
        if (!x || i > upto || off.has(i)) return;
        if (only === 'hidden' && !x.is_system) return;
        if (x.is_system && !x.is_user && !x.name) return;
        const text = cleanMessage(String(x.mes || ''), { stripTags: true });
        if (!text.trim()) return;
        const name = x.name || (x.is_user ? 'User' : 'Char');
        const star = isStarred(x);
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
    return parseSections(body).filter(s => !s.group && !muted.has(sectionKey(s))).map(s => ({ kind: 'sec', s, title: s.title, star: sectionStarred(s.title), text: body.slice(s.start, s.end) }));
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

// ---- 회상: before each reply, find old lines that fit the newest messages

export function recallCfg(m) {
    const r = m?.recall && typeof m.recall === 'object' ? m.recall : {};
    const num = (v, d, lo, hi) => (Number.isFinite(+v) && v !== '' && v !== undefined ? Math.min(hi, Math.max(lo, +v)) : d);
    return { on: !!r.on, k: num(r.k, 4, 1, 12), budget: num(r.budget, 600, 100, 4000), depth: num(r.depth, 2, 0, 20), scan: num(r.scan, 3, 1, 10), secs: r.secs !== false };
}

// the newest messages, the very last one counted twice
export function recallQuery(n) {
    const chat = ctx().chat || [];
    const off = offstageSet(chat);
    const out = [];
    for (let i = chat.length - 1; i >= 0 && out.length < n; i--) {
        const x = chat[i];
        if (!x || x.is_system || off.has(i)) continue;
        out.push(cleanMessage(String(x.mes || ''), { stripTags: true }).slice(-2000));
    }
    return out.length ? `${out[0]}\n${out.join('\n')}` : '';
}

// hits for a query: raw passages (and section bullets), stars first among equals, at most one passage per message,
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
    ? `- [#${r.item.i}${r.item.star ? ' ★' : ''} ${r.item.name}] ${r.item.text.replace(/\s*\n\s*/g, ' ')}`
    : `- [${r.item.title.replace(/\s*\(.*$/, '')}] ${r.item.text}`;

export const lastRecall = new Map(); // chat id → { at, lines, tokens }

export async function runRecall() {
    const c = ctx();
    if (!hasChat()) { c.setExtensionPrompt(RECALL_KEY, '', 1, 0); return null; }
    const m = getMeta();
    const cfg = recallCfg(m);
    if (!m.enabled || !cfg.on) { c.setExtensionPrompt(RECALL_KEY, '', 1, 0); return null; }
    const q = recallQuery(cfg.scan);
    const injected = cfg.secs ? (await currentInjection()).text || '' : '';
    const items = [...rawItems({ only: 'hidden' }), ...(cfg.secs ? bulletItems(m, injected) : [])];
    const qn = new Set(tokenize(q)).size;
    const hits = pick(bm25(items, q), { k: cfg.k, budget: cfg.budget, minHits: qn < 6 ? 1 : 2 })
        .sort((x, y) => (x.item.i ?? -1) - (y.item.i ?? -1));
    const id = String(c.getCurrentChatId?.() || c.chatId || '');
    if (!hits.length) { c.setExtensionPrompt(RECALL_KEY, '', 1, 0); lastRecall.set(id, { at: Date.now(), lines: [], tokens: 0 }); return null; }
    const lines = hits.map(recallLine);
    const text = `<recalled_memories>\nEarlier moments that may matter for the next reply, from the original messages and the archive. Background only: keep consistent with them, never quote, list or mention them.\n${lines.join('\n')}\n</recalled_memories>`;
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
