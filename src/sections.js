// The archive text as sections: parsing "#"/"##" headings, keys, switches, pins, keyword links, numbering checks, the STATE/OPEN tail.

import { currentChatId } from './chats.js';
import { ctx, getMeta, saveMeta } from './core.js';
import { applyInjection } from './inject.js';
import { syncPanel } from './panel.js';
import { routerCandidates, routerCfg, routerState } from './router.js';
import { countTokens, esc, escRe, fmt } from './util.js';

export const pinnedSet = m => new Set(Array.isArray(m.pinned) ? m.pinned : []);

// Section headings: "# " and "## " lines outside ``` / ~~~ code fences.
// "### " and deeper stay inside their section as sub-headings.
export function headingLines(text) {
    const heads = [];
    let pos = 0, fence = null;
    for (const raw of String(text).split('\n')) {
        const line = raw.replace(/\r$/, '');
        const f = line.match(/^ {0,3}(`{3,}|~{3,})/);
        if (fence) {
            if (f && f[1][0] === fence[0] && f[1].length >= fence.length && !line.slice(f[0].length).trim()) fence = null;
        } else if (f) fence = f[1];
        else {
            const m = line.match(/^(#{1,2}) .*$/);
            if (m) heads.push({ start: pos, title: m[0], level: m[1].length });
        }
        pos += raw.length + 1;
    }
    return heads;
}

export function parseSections(text) {
    const heads = headingLines(text);
    const sections = [];
    if (!heads.length) {
        if (text.trim()) sections.push({ title: '(제목 없음)', start: 0, end: text.length, level: 1, group: false });
        return sections;
    }
    if (text.slice(0, heads[0].start).trim()) sections.push({ title: '(머리말)', start: 0, end: heads[0].start, level: 1, group: false });
    heads.forEach((h, idx) => {
        const next = heads[idx + 1];
        const end = next ? next.start : text.length;
        // A "# " heading directly followed by "## " ("# ── Y1 ──" → "## #0–#47") is a group divider, not a card.
        const group = !!next && next.level > h.level;
        const note = text.slice(h.start + h.title.length, end).replace(/^\s*-{3,}\s*$/gm, '').trim();
        sections.push({ title: h.title.replace(/^#+\s*/, ''), start: h.start, end, level: h.level, group, note });
    });
    // key = title, plus "\u0001n" from the 2nd section with the same title on, so switches, pins and links
    // stay on one section. The first one keeps the bare title, so settings saved before still match.
    const seen = new Map();
    for (const s of sections) {
        const n = (seen.get(s.title) || 0) + 1;
        seen.set(s.title, n);
        s.key = n === 1 ? s.title : `${s.title}\u0001${n}`;
    }
    return sections;
}

// "회상\u00012" → "회상 (2번째)"
export const keyLabel = k => { const [t, n] = String(k).split('\u0001'); return n ? `${t} (${n}번째)` : t; };

// key of the section at (or right after) `start` in `text`
export const keyAt = (text, start) => { const x = parseSections(text).find(y => y.start >= start); return x ? sectionKey(x) : null; };

export const groupLabel = title => title.replace(/^[\s─━—–=-]+|[\s─━—–=-]+$/g, '') || title;

export function highlight(text, query) {
    if (!query) return esc(text);
    // split the raw text first, so a search for "amp" or "39" can't land inside &amp; or &#39;
    return String(text).split(new RegExp(`(${escRe(query)})`, 'gi')).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join('');
}

// ---- muted sections: kept in the text, left out of the injection

export const sectionKey = s => s.key ?? s.title;
export const mutedSet = m => new Set(Array.isArray(m.muted) ? m.muted : []);

// ---- keyword-linked sections: left out until one of their keywords shows up in recent messages

export const linkedMap = m => (m.linked && typeof m.linked === 'object' && !Array.isArray(m.linked)) ? m.linked : {};

export function recentChatText(m, n = Math.max(1, Number(m.linkDepth) || 4)) {
    const chat = ctx().chat || [];
    const out = [];
    for (let i = chat.length - 1; i >= 0 && out.length < n; i--) {
        const x = chat[i];
        if (!x || x.is_system) continue;
        out.push(String(x.mes || ''));
    }
    return out.join('\n').toLowerCase();
}

// the keywords of `keys` that appear in `hay` (already lower-cased); plain substring match, any case
export const linkHits = (keys, hay) => keys.filter(w => w && hay.includes(String(w).toLowerCase()));

// titles of linked sections whose keywords are not in the recent messages right now
export function keywordWaiting(m) {
    const entries = Object.entries(linkedMap(m)).filter(([, k]) => Array.isArray(k) && k.length);
    if (!entries.length) return new Set();
    const hay = recentChatText(m);
    return new Set(entries.filter(([, keys]) => !linkHits(keys, hay).length).map(([t]) => t));
}

// ---- section links: "#217–#236", "(Y1 #346)", "since Y2 #506" inside a section's text point at the section holding that number.
// Unprefixed numbers belong to the unprefixed log if there is one (Y1 in "Y1 unprefixed" archives), else to the section's own log.
export let linkCache = { text: null, links: null };
export function sectionLinks(m) {
    const text = String(m?.text || '');
    if (linkCache.text === text) return linkCache.links;
    const secs = parseSections(text).filter(s => !s.group);
    const ranged = secs.map(s => { const r = s.title.match(RANGE_HEAD); return r ? { s, prefix: (r[1] || '').trim(), from: Math.min(+r[2], +r[4]), to: Math.max(+r[2], +r[4]) } : null; }).filter(Boolean);
    const hasBare = ranged.some(x => !x.prefix);
    const find = (prefix, n) => ranged.find(x => x.prefix === prefix && n >= x.from && n <= x.to)?.s;
    const out = new Map(), inn = new Map();
    for (const s of secs) {
        const own = (s.title.match(RANGE_HEAD)?.[1] || '').trim();
        const body = text.slice(s.start, s.end).replace(/^[^\n]*\n?/, '');
        const targets = new Set();
        // numbers the section's own heading already names ("STATE AT Y2 #604", "(Y1 #0–#590 · …)") are labels, not references
        const ownNums = new Set((s.title.match(/#\d+/g) || []).map(x => +x.slice(1)));
        for (const mt of body.matchAll(/(?:\b([A-Z]\w{0,10})\s+)?#(\d+)(?:\s*[–—~-]\s*#?(\d+))?/g)) {
            if (!RANGE_HEAD.test(s.title) && ownNums.has(+mt[2])) continue;
            const pre = mt[1] && ranged.some(x => x.prefix === mt[1]) ? mt[1] : (hasBare ? '' : own);
            const t = find(pre, +mt[2]);
            if (t && t !== s) targets.add(sectionKey(t));
        }
        if (targets.size) out.set(sectionKey(s), [...targets]);
        for (const t of targets) { if (!inn.has(t)) inn.set(t, []); inn.get(t).push(sectionKey(s)); }
    }
    const byKey = new Map(secs.map(s => [sectionKey(s), s]));
    linkCache = { text, links: { out, in: inn, byKey } };
    return linkCache.links;
}

// sections left out right now: keyword links that did not fire, and (with the AI router) the candidates it did not pick
export function linkWaiting(m) {
    const out = keywordWaiting(m);
    const cfg = routerCfg(m);
    if (cfg.mode === 'off') return out;
    const picks = new Set(routerState.get(currentChatId())?.picks || []);
    // a picked section brings the sections it points at (its "see #217" background), unless switched off
    if (cfg.follow !== false) { const { out: lk } = sectionLinks(m); for (const k of [...picks]) for (const t of lk.get(k) || []) picks.add(t); }
    const lm = linkedMap(m);
    for (const s of routerCandidates(m)) {
        const k = sectionKey(s);
        if (picks.has(k)) out.delete(k);
        else if (cfg.mode === 'old' && !(Array.isArray(lm[k]) && lm[k].length)) out.add(k);
    }
    return out;
}

export async function setLinked(title, keys) {
    const m = getMeta();
    const map = { ...linkedMap(m) };
    if (keys.length) map[title] = keys; else delete map[title];
    m.linked = map;
    await saveMeta();
    applyInjection();
    syncPanel();
}

export function filterMuted(m, text) {
    const muted = new Set([...mutedSet(m), ...linkWaiting(m)]);
    if (!muted.size) return text;
    let out = '';
    let skipLevel = 0;
    for (const s of parseSections(text)) {
        if (skipLevel && s.level > skipLevel) continue;
        skipLevel = 0;
        if (muted.has(sectionKey(s))) {
            if (s.group) skipLevel = s.level;
            continue;
        }
        out += text.slice(s.start, s.end);
    }
    return out;
}

export function mutedCount(m) {
    const muted = mutedSet(m);
    if (!muted.size) return 0;
    return parseSections(m.text).filter(s => muted.has(sectionKey(s))).length;
}

export async function setPinned(key, on) {
    const m = getMeta();
    const set = pinnedSet(m);
    on ? set.add(key) : set.delete(key);
    m.pinned = [...set];
    await saveMeta();
    applyInjection();
    syncPanel();
}

export async function setMuted(key, on) {
    const m = getMeta();
    const set = mutedSet(m);
    on ? set.add(key) : set.delete(key);
    m.muted = [...set];
    await saveMeta();
    applyInjection();
    syncPanel();
}

export const tokCache = new Map();
export async function cachedTokens(text) {
    if (tokCache.has(text)) return tokCache.get(text);
    const n = await countTokens(text);
    if (tokCache.size > 400) tokCache.clear();
    tokCache.set(text, n);
    return n;
}
export const shortNum = n => n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : fmt(n);

// ---- reorder / insert

export const trimEnd = t => t.replace(/\s+$/, '');

export function moveSectionText(text, s, dir) {
    const secs = parseSections(text);
    const i = secs.findIndex(x => x.start === s.start);
    const o = secs[i + dir];
    if (i < 0 || !o || o.group || s.group || o.level !== s.level || o.title === '(머리말)' || s.title === '(머리말)') return null;
    const [A, B] = dir > 0 ? [secs[i], o] : [o, secs[i]];
    const tail = text.slice(B.start, B.end).match(/\s*$/)[0] || '\n\n';
    const moved = trimEnd(text.slice(B.start, B.end)) + '\n\n' + trimEnd(text.slice(A.start, A.end)) + tail;
    return { text: text.slice(0, A.start) + moved + text.slice(B.end), start: dir > 0 ? A.start + trimEnd(text.slice(B.start, B.end)).length + 2 : A.start };
}

export function insertAfterText(text, s) {
    // the preamble has no heading of its own: take the next heading's level, so "#" doesn't turn into a group
    const untitled = s.title === '(머리말)' || s.title === '(제목 없음)';
    const level = untitled ? (parseSections(text).find(x => x.start >= s.end)?.level || 2) : s.level;
    const head = `${'#'.repeat(Math.max(1, level))} 새 섹션`;
    const before = trimEnd(text.slice(0, s.end));
    const after = text.slice(s.end);
    const block = `${head}\n\n- \n`;
    const start = before.length + 2;
    return { text: `${before}\n\n${block}${after ? '\n' : ''}${after}`, start };
}

// ---- heading format check: "## [prefix ]#from–#to — title", continuous numbering per prefix

export const RANGE_HEAD = /^(?:(\S{1,12})\s)?#(\d+)\s*([–—~-])\s*#?(\d+)(.*)$/;

export function checkHeadings(text) {
    const secs = parseSections(text).filter(s => !s.group && s.title !== '(머리말)' && s.title !== '(제목 없음)');
    const ranged = secs.map(s => ({ s, mt: s.title.match(RANGE_HEAD) })).filter(x => x.mt);
    const issues = [];
    const dashes = ranged.map(x => x.mt[3]);
    const mainDash = dashes.filter(d => d === '–').length >= dashes.length / 2 ? '–' : '-';
    const lastBy = new Map();
    const levelCount = {};
    ranged.forEach(x => { levelCount[x.s.level] = (levelCount[x.s.level] || 0) + 1; });
    const mainLevel = Number(Object.entries(levelCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 2);
    const span = (a, b) => a === b ? `#${a}` : `#${a}–#${b}`;
    for (const { s, mt } of ranged) {
        const prefix = (mt[1] || '').trim();
        const from = parseInt(mt[2], 10), to = parseInt(mt[4], 10);
        const rest = mt[5];
        const where = { start: s.start, title: s.title };
        if (from > to) issues.push({ ...where, msg: `시작 #${from}이 끝 #${to}보다 커요` });
        if (!/^\s+[—–-]\s+\S/.test(rest)) issues.push({ ...where, msg: '번호 뒤에 " — 제목"이 없어요' });
        if (mt[3] !== mainDash) issues.push({ ...where, msg: `번호 사이 대시가 "${mt[3]}"예요 (다른 제목은 "${mainDash}")` });
        const prev = lastBy.get(prefix);
        const lo = Math.min(from, to);
        if (prev) {
            if (lo > prev.to + 1) issues.push({ ...where, msg: `앞 섹션(#${prev.to}까지)과 사이 ${span(prev.to + 1, lo - 1)}가 빠졌어요` });
            else if (lo <= prev.to) issues.push({ ...where, msg: `앞 섹션(#${prev.from}–#${prev.to})과 번호가 겹쳐요` });
        }
        if (s.level !== mainLevel) issues.push({ ...where, msg: `제목 단계가 달라요 (${'#'.repeat(s.level)} — 다른 섹션은 ${'#'.repeat(mainLevel)})` });
        lastBy.set(prefix, { from: Math.min(from, to), to: Math.max(from, to) });
    }
    // duplicate titles are hard to tell apart (settings follow their order, not their text)
    const seen = new Map();
    for (const s of secs) {
        if (seen.has(s.title)) issues.push({ start: s.start, title: s.title, msg: '같은 제목이 또 있어요' });
        else seen.set(s.title, true);
    }
    return { issues: issues.sort((a, b) => a.start - b.start), ranged: ranged.length };
}

// muted / pinned / keyword links follow a renamed section
export function renameKeys(m, from, to) {
    const ren = arr => (arr || []).map(k => k === from ? to : k);
    m.muted = ren(m.muted);
    m.pinned = ren(m.pinned);
    const lm = { ...linkedMap(m) };
    if (lm[from]) { lm[to] = lm[from]; delete lm[from]; m.linked = lm; }
    if (m.layers?.[from]) { m.layers[to] = m.layers[from]; delete m.layers[from]; }
    if (Array.isArray(m.collapsed)) m.collapsed = ren(m.collapsed);
    if (Array.isArray(m.digests)) m.digests.forEach(d => { d.keys = ren(d.keys); });
}

// "[[## Y2 #48–#63 — …]]" → the section it names (exact heading, then same range)
export function findCited(secs, raw) {
    const n = raw.replace(/^#+\s*/, '').trim();
    const rangeOf = t => (t.match(/(?:\b[A-Za-z]+\d*\s+)?#\d+\s*[–—~-]\s*#?\d+/) || [''])[0].replace(/\s*[–—~-]\s*#?/, '–#').replace(/\s+/g, ' ');
    return secs.find(s => s.title === n)
        || secs.find(s => s.title.startsWith(n) || n.startsWith(s.title))
        || (rangeOf(n) && secs.find(s => rangeOf(s.title) === rangeOf(n)))
        || null;
}

// "## Y2 #574–#600 — ..." → { from: 574, to: 600 }
// "## Y2 #574–#600 — ..." → { prefix: 'Y2', from: 574, to: 600 }. A title line like
// "# Name — Archive (Y1 #0–#590 · Y2 #0–#573)" is not a section and is skipped.
export function headingRanges(text) {
    return headingLines(text).map(h => h.title).flatMap(line => {
        const title = line.replace(/^#+\s*/, '');
        const r = title.match(RANGE_HEAD);
        return r ? [{ title, prefix: (r[1] || '').trim(), from: parseInt(r[2], 10), to: parseInt(r[4], 10) }] : [];
    });
}

export function lastRangedSection(text) {
    const secs = parseSections(text).filter(s => !s.group && /#\d+\s*[–—~-]\s*#?\d+/.test(s.title));
    const s = secs[secs.length - 1];
    return s ? trimEnd(text.slice(s.start, s.end)) : '';
}

// ---- placing appended text: new sections go before "# STATE AT", pasted STATE/OPEN replace the old ones

export const TAIL_RE = /^# (STATE|OPEN)\b.*$/m;

// [body, tail] where tail starts at the first "# STATE…" / "# OPEN…" heading
export function splitTail(text) {
    const mt = TAIL_RE.exec(text);
    return mt ? [text.slice(0, mt.index), text.slice(mt.index)] : [text, ''];
}

// level-1 blocks of the tail, keyed by their first word (STATE / OPEN / other title)
export function tailBlocks(tail) {
    const out = [];
    const re = /^# .*$/gm;
    const heads = [];
    let mt;
    while ((mt = re.exec(tail)) !== null) heads.push({ at: mt.index, line: mt[0] });
    heads.forEach((h, i) => {
        const key = (h.line.match(/^# (STATE|OPEN)\b/) || [, h.line])[1];
        out.push({ key, text: trimEnd(tail.slice(h.at, heads[i + 1]?.at ?? tail.length)) });
    });
    return out;
}

export function lastRangeEnd(text) {
    const r = headingRanges(text);
    return r.length ? r[r.length - 1].to : null;
}

// ---- source marks: the model ends each sentence of a new section with "(#88)" / "(#88, #91)" so its claims can be
// checked against the raw log; they are taken out before anything is saved. Only bare numbers: "(Y2 #506)" is a reference, kept.
export const CITE_RE = /[ \t]*\(#\d+(?:\s*(?:[,–—~-]|and)\s*#?\d+)*\)/g;
const stripMarks = t => String(t || '').replace(CITE_RE, '').replace(/[ \t]+([.,;:!?])/g, '$1');
// sections only: STATE / OPEN lines keep whatever they say
export function stripCites(text) {
    const [body, tail] = splitTail(String(text || ''));
    return /\(#\d/.test(body) ? stripMarks(body) + tail : String(text || '');
}
// marks that point outside their own section's range, and bullets with none
export function citeIssues(text) {
    const body = splitTail(String(text || ''))[0];
    const secs = parseSections(body).filter(x => !x.group && RANGE_HEAD.test(x.title));
    const out = { marks: 0, outside: [], bare: [] };
    for (const s of secs) {
        const r = s.title.match(RANGE_HEAD), from = Math.min(+r[2], +r[4]), to = Math.max(+r[2], +r[4]);
        const lines = body.slice(s.start, s.end).split('\n').filter(l => /^\s*[-*•]\s/.test(l));
        for (const l of lines) {
            const ms = [...l.matchAll(new RegExp(CITE_RE.source, 'g'))];
            if (!ms.length) { out.bare.push({ title: s.title, line: l.trim() }); continue; }
            out.marks += ms.length;
            for (const mk of ms) {
                const ns = [...mk[0].matchAll(/#?(\d+)/g)].map(x => Number(x[1]));
                for (const n of ns) if (n < from || n > to) out.outside.push({ title: s.title, n, from, to, line: l.trim() });
            }
        }
    }
    return out;
}
