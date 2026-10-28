// Before each reply: the AI router picks sections to inject, and keyword links are re-checked against the newest message.

import { askAI, connSettings } from './ai.js';
import { currentChatId } from './chats.js';
import { getMeta, globalSettings, hasChat } from './core.js';
import { recentForCheck } from './drift.js';
import { lastIndex } from './hide.js';
import { applyInjection, currentInjection, placeArchive } from './inject.js';
import { KW_STOP } from './keywords.js';
import { castNames } from './knowledge.js';
import { RANGE_HEAD, linkWaiting, linkedMap, mutedSet, parseSections, pinnedSet, sectionKey } from './sections.js';
import { bm25, recallQuery, tokenize, withGlossary } from './recall.js';
import { layersOf } from './fade.js';
import { sceneGuess } from './guess.js';
import { embedSearch } from './embed.js';
import { refreshStatusSoon } from './status.js';
import { shortHash } from './translate.js';

// SillyTavern emits GENERATION_STARTED before it adds the typed message to the chat, and MESSAGE_SENT
// (awaited) right after. So on a normal send the router and keyword links wait for MESSAGE_SENT,
// otherwise they would never see the message being answered.
export let genPending = null;
let genType = '';
export async function onGenerationStarted(type, opts, dryRun) {
    if (dryRun || type === 'quiet' || !hasChat()) return;
    genType = type || 'normal';
    const typed = String($('#send_textarea').val() || '').trim();
    if (typed && [undefined, 'normal'].includes(type) && !opts?.automatic_trigger) {
        placeArchive({ extra: 1 }); // the typed message is not in the chat yet
        // fallback in case no MESSAGE_SENT follows (e.g. a bias-only message sent as a system note)
        genPending = setTimeout(() => { genPending = null; prepareGeneration(); }, 3000);
        return;
    }
    await prepareGeneration();
}

export async function onMessageSent() {
    if (!genPending) return;
    clearTimeout(genPending);
    genPending = null;
    await prepareGeneration();
}

export async function prepareGeneration() {
    if (!hasChat()) return;
    const m = getMeta();
    if (routerCfg(m).mode !== 'off') {
        try { await runRouter(m); }
        catch (e) {
            console.warn('[narrative-archive] router', e);
            if (!routerWarned) { routerWarned = true; toastr.warning(`AI 라우터를 못 써서 키워드대로 넣었어요: ${e.message || e}`, '서사 아카이브'); }
        }
    }
    if (Object.keys(linkedMap(m)).length || routerCfg(m).mode !== 'off') { applyInjection(); refreshStatusSoon(); } // keyword links look at the latest messages
    await currentInjection();
    // how often each keyword-linked section actually went in, for the X-ray
    const links = Object.keys(linkedMap(m));
    if (m.enabled && links.length) {
        const st = (m.linkStats && typeof m.linkStats === 'object') ? m.linkStats : { gens: 0, on: {}, last: {} };
        st.gens = (st.gens || 0) + 1;
        st.on ||= {}; st.last ||= {};
        const waiting = linkWaiting(m);
        const muted = mutedSet(m);
        for (const k of links) if (!waiting.has(k) && !muted.has(k)) { st.on[k] = (st.on[k] || 0) + 1; st.last[k] = lastIndex(); }
        m.linkStats = st;
    }
    placeArchive({ skipLast: genType === 'swipe' });
}

// Right before a reply, a small model reads the recent chat and picks the sections it needs.

export const AI_SYS_ROUTER = `GOAL
A role-play model is about to write its NEXT reply. It cannot see the whole story archive, only the sections you pick.
Pick the sections it needs so it does not forget or contradict something.

YOU GET
- MAIN CAST: characters who are in almost every section. Their names alone are NOT a reason to pick a section.
- NOW: the title of the newest archived section, so you know where the story stands (date, place).
- RECENT CHAT: the last messages. The one marked LATEST is what the next reply answers.
- GUESS (sometimes): a helper's picture of the earlier moment the chat points back at. It may be wrong; use it as a lead.
- LIKELY SECTIONS: numbered. A word search found these closest to the chat. Each has a title, the other names in it,
  its keywords, and the lines that fit the chat best (or how it begins).
- OTHER SECTIONS: the rest of the archive, title only (sometimes with a one-line summary). Titles carry the story date,
  the place and what happened. The word search cannot see hints, so this list is where hints get solved.

PICK A SECTION IF ANY OF THESE IS TRUE
1. Something from it is named or clearly meant in the recent chat: a person who is not main cast, a place, an object, an event.
   Watch for hints, not only exact names: "that night", "the cliff", "what you promised me", "your old life", a nickname.
   For a hint, look through OTHER SECTIONS: match the time ("three days ago", "last winter" against NOW and the dates
   in the titles), the place, or the event the hint points at.
2. The chat is about a promise, secret, wound, fight, rule or wish that started or changed in that section.
3. The next reply has to stay consistent with it: the chat goes back to a place, a habit, or a relationship moment described there.

DO NOT PICK
- A section just because a main cast character is in it.
- Sections that are only loosely related.
- More than the limit you are given.

HOW TO WORK
Step 1. Read the LATEST message first, then the others. List for yourself the people, places, objects, past events and promises they mention or hint at.
Step 2. Match that list against LIKELY SECTIONS first, then scan the titles of OTHER SECTIONS for anything hinted at.
Step 3. Put the most important first. Fewer is better than wrong.

OUTPUT: exactly one line, nothing else
PICK: 3, 12, 7
If no section is needed:
PICK: none`;

export const routerState = new Map(); // chat id → { key, picks: Set, titles, at, ms, cands, via: 'ai' | 'index', why }

const DETAIL_N = 18; // candidates that get a full card; the rest go in as a title line
const ALL_DETAIL = 24; // with this few candidates every one gets a card
const MEAN_N = 6; // cards added by the meaning search on top of the word search

// the word search over the candidates: whole sections against the newest messages (glossary spellings added)
function rankCandidates(m, cands, guess = '') {
    const q = recallQuery(4).map(p => ({ ...p, text: withGlossary(m, p.text) }));
    if (guess) q.push({ text: guess, w: 0.8 });
    const items = cands.map((s, i) => ({ i, s, text: m.text.slice(s.start, s.end) }));
    return { q, ranked: bm25(items, q) };
}

// the 1–2 lines of a section that share the most words with the chat
function fitLines(body, q) {
    const lines = body.split('\n').map(l => l.replace(/^\s*[-*•]\s+/, '').trim()).filter(l => l.length >= 20);
    return bm25(lines.map(text => ({ text })), q).filter(r => r.hits >= 2).slice(0, 2).map(r => r.item.text.length > 200 ? `${r.item.text.slice(0, 199)}…` : r.item.text);
}

export let routerWarned = false;

export function routerCfg(m) {
    const r = m?.router && typeof m.router === 'object' ? m.router : {};
    return { mode: ['linked', 'old', 'lift'].includes(r.mode) ? r.mode : 'off', max: Number(r.max) || 4, keep: Number.isFinite(Number(r.keep)) && r.keep !== undefined ? Number(r.keep) : 3, follow: r.follow !== false };
}

// sections the router may switch on: keyword-linked ones, and in 'old' mode every numbered section except the newest few and pinned ones
export function routerCandidates(m) {
    const cfg = routerCfg(m);
    if (cfg.mode === 'off') return [];
    const secs = parseSections(m.text);
    const muted = mutedSet(m), pinned = pinnedSet(m), lm = linkedMap(m);
    const ranged = secs.filter(x => !x.group && RANGE_HEAD.test(x.title));
    const recent = new Set(ranged.slice(Math.max(0, ranged.length - cfg.keep)).map(sectionKey));
    const out = [], stack = [];
    for (const s of secs) {
        while (stack.length && stack[stack.length - 1].level >= s.level) stack.pop();
        if (s.group) { stack.push(s); continue; }
        const key = sectionKey(s);
        if (muted.has(key) || stack.some(g => muted.has(sectionKey(g)))) continue;
        const linked = Array.isArray(lm[key]) && lm[key].length;
        const safe = pinned.has(key) || stack.some(g => pinned.has(sectionKey(g)));
        if (linked || (['old', 'lift'].includes(cfg.mode) && RANGE_HEAD.test(s.title) && !recent.has(key) && !safe)) out.push(s);
    }
    return out;
}

export function routerReady() {
    const a = connSettings('ai');
    return a.mode === 'custom' || a.mode === 'vertex' || !!globalSettings().aiProfile;
}

// 'lift' (AI 없이 빠르게): no model call before a reply. The word search and the meaning search (when 임베딩 is on) each
// rank the older sections against the newest messages; the best few go in whole, the rest stay as the forgetting curve
// has them (nothing is left out). The AI modes fall back to the same picks when the model fails.
// Whatever mode picked it, a section called in stays for HOLD more replies, so it does not flicker in and out.
const HOLD = 3;
// the words a section shares with the chat, for the home tab's "why" (longest first, a few)
function sharedWords(q, text) {
    const mine = new Set(tokenize(text));
    const seen = new Set();
    return q.flatMap(p => tokenize(p.text)).filter(w => mine.has(w) && w.length >= 2 && !seen.has(w) && seen.add(w)).sort((a, b) => b.length - a.length).slice(0, 3);
}
// the word search and the meaning search, fused: [{ key, why }] best first, at most `max`
async function fastPicks(m, cands, q, ranked, max) {
    const score = new Map(), why = new Map();
    const top = ranked[0]?.score || 0;
    ranked.forEach((r, n) => {
        if (r.hits < 2 || r.score < top * 0.5) return;
        const k = sectionKey(r.item.s);
        score.set(k, (score.get(k) || 0) + 1 / (4 + n));
        const w = sharedWords(q, r.item.text);
        if (w.length) why.set(k, w.join(', '));
    });
    const byTitle = new Map(cands.map(s => [s.title, s]));
    let n = 0;
    for (const h of await embedSearch(q.slice(0, 2).map(p => p.text).join('\n'), { topK: 20 })) {
        const s = h.kind === 'sec' ? byTitle.get(h.title) : null;
        if (!s) continue;
        const k = sectionKey(s);
        if (n < 4 && !score.has(k)) why.set(k, '뜻이 비슷함');
        if (n++ < 4 || score.has(k)) score.set(k, (score.get(k) || 0) + 1 / (4 + h.rank));
    }
    return [...score].sort((a, b) => b[1] - a[1]).slice(0, max).map(([key]) => ({ key, why: why.get(key) || '' }));
}
// this reply's picks plus what the last replies called in and still holds: new first, then held, up to the limit
function finish(id, key, cands, prev, fresh, max, extra) {
    const inCands = new Set(cands.map(sectionKey));
    const hold = new Map();
    for (const [k, left] of prev?.hold || []) if (left > 1 && inCands.has(k)) hold.set(k, left - 1);
    const freshKeys = fresh.map(x => x.key);
    for (const k of freshKeys) hold.set(k, HOLD);
    const keys = [...freshKeys, ...[...hold.keys()].filter(k => !freshKeys.includes(k)).sort((a, b) => hold.get(b) - hold.get(a))].slice(0, max);
    for (const k of [...hold.keys()]) if (!keys.includes(k)) hold.delete(k);
    const picked = keys.map(k => cands.find(s => sectionKey(s) === k)).filter(Boolean);
    const whyBy = {};
    for (const k of keys) whyBy[k] = fresh.find(x => x.key === k)?.why ?? prev?.whyBy?.[k] ?? '';
    const st = { key, picks: new Set(keys), titles: picked.map(s => s.title), at: Date.now(), ms: 0, cands: cands.length, hold, whyBy, fresh: new Set(freshKeys), ...extra };
    routerState.set(id, st);
    return st;
}
// the last messages, the newest marked LATEST, and a key that stays the same on a swipe or regenerate
function recentFor(cands, cfg, tag) {
    const msgs = recentForCheck(4);
    if (msgs.length) msgs[msgs.length - 1] = msgs[msgs.length - 1].replace(/^\[#(\d+)/, '[#$1 · LATEST');
    const recent = msgs.join('\n\n').slice(-6000);
    return { recent, key: shortHash(`${tag}|${recent}|${cands.map(sectionKey).join('|')}|${cfg.max}`) };
}

export async function runRouter(m, { force = false } = {}) {
    const cfg = routerCfg(m);
    if (cfg.mode === 'off') return null;
    const cands = routerCandidates(m);
    const id = currentChatId();
    const { recent, key } = recentFor(cands, cfg, cfg.mode === 'lift' ? 'lift' : 'ai');
    const prev = routerState.get(id);
    if (!force && prev?.key === key) return prev; // a swipe or regenerate on the same chat
    if (!cands.length) return finish(id, key, cands, prev, [], cfg.max, { via: cfg.mode === 'lift' ? 'lift' : 'ai' });
    const t0 = Date.now();
    if (cfg.mode === 'lift') {
        const { q, ranked } = rankCandidates(m, cands);
        return finish(id, key, cands, prev, await fastPicks(m, cands, q, ranked, cfg.max), cfg.max, { via: 'lift', ms: Date.now() - t0 });
    }
    const guess = await sceneGuess(m, routerReady());
    const { q, ranked } = rankCandidates(m, cands, guess);
    // no model, or it failed: the fast picks instead, and why
    const fallback = async why => finish(id, key, cands, prev, await fastPicks(m, cands, q, ranked, cfg.max), cfg.max, { via: 'index', why, ms: Date.now() - t0 });
    if (!routerReady()) {
        if (force) throw new Error('라우터는 RP와 따로 연결한 모델이 필요해요 (⚙ 설정 → AI 모델 → 모델에서 프로필·커스텀 API·Vertex)');
        return fallback('따로 연결한 모델이 없어요');
    }
    // which candidates get a full card: the best word-search hits, and what the last replies called in
    const many = cands.length > ALL_DETAIL;
    const top = ranked[0]?.score || 0;
    const hits = ranked.filter(r => r.hits >= 2 && r.score >= top * 0.2).slice(0, DETAIL_N).map(r => r.item.i);
    const detail = new Set(many ? hits : cands.map((_, i) => i));
    if (many && prev?.picks) cands.forEach((s, i) => { if (prev.picks.has(sectionKey(s))) detail.add(i); });
    // 뜻으로 찾기: sections close in meaning get a card too, even with no word in common
    const meanFit = new Map(); // candidate → the piece the meaning search matched
    if (many) {
        const byTitle = new Map(cands.map((s, i) => [s.title, i]));
        const q2 = [...recallQuery(2).map(p => p.text), guess].filter(Boolean).join('\n');
        let added = 0;
        for (const h of await embedSearch(q2, { topK: 30 })) {
            const i = h.kind === 'sec' ? byTitle.get(h.title) : undefined;
            if (i === undefined || meanFit.has(i)) continue;
            meanFit.set(i, h.text.split('\n').slice(1).join(' ').trim());
            if (!detail.has(i) && added < MEAN_N) { detail.add(i); added++; }
        }
    }
    // each card: title, the names in it other than the main cast, its keywords, and the lines that fit the chat (else how it begins)
    const main = castNames(m);
    const mainSet = new Set(main.flatMap(n => n.split(/\s+/)));
    const lm = linkedMap(m);
    const layers = layersOf(m);
    const order = many ? [...detail] : [...detail].sort((x, y) => x - y);
    const rest = cands.map((_, i) => i).filter(i => !detail.has(i));
    const card = (s, n, i) => {
        const body = m.text.slice(s.start, s.end).replace(/^#{1,3} [^\n]*\n?/, '');
        const counts = new Map();
        // capitalised words in mid-sentence only, so sentence openers ("Inside", "Asked") don't pass as names
        [...body.matchAll(/[a-z0-9,;:]\s+([A-Z][a-z][A-Za-z'’]*)/g)].map(x => x[1].replace(/['’]s$/, ''))
            .filter(w => w.length > 2 && !KW_STOP.has(w) && !mainSet.has(w)).forEach(w => counts.set(w, (counts.get(w) || 0) + 1));
        const names = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0]);
        const keys = Array.isArray(lm[sectionKey(s)]) ? lm[sectionKey(s)] : [];
        let fits = fitLines(body, q);
        if (!fits.length && meanFit.get(i)) { const f = meanFit.get(i); fits = [f.length > 200 ? `${f.slice(0, 199)}…` : f]; }
        const flat = body.replace(/\s+/g, ' ').trim();
        return `${n}. ${s.title}${names.length ? `\n   names: ${names.join(', ')}` : ''}${keys.length ? `\n   keywords: ${keys.join(', ')}` : ''}`
            + (fits.length ? fits.map(f => `\n   fits: ${f}`).join('') : `\n   begins: ${flat.slice(0, 220)}${flat.length > 220 ? '…' : ''}`);
    };
    const line = (s, n) => { const one = String(layers[sectionKey(s)]?.line || '').replace(/\s+/g, ' ').trim(); return `${n}. ${s.title}${one ? ` — ${one.slice(0, 140)}` : ''}`; };
    const listed = [...order, ...rest]; // the number shown to the model → candidate
    const likely = order.map((i, k) => card(cands[i], k + 1, i)).join('\n');
    const other = rest.map((i, k) => line(cands[i], order.length + k + 1)).join('\n');
    const ranged = parseSections(m.text).filter(x => !x.group && RANGE_HEAD.test(x.title));
    const now = ranged.length ? ranged[ranged.length - 1].title : '';
    let out;
    try {
        out = await Promise.race([
            askAI(`${main.length ? `[MAIN CAST]\n${main.join(', ')}\n\n` : ''}${now ? `[NOW]\n${now}\n\n` : ''}[RECENT CHAT]\n${recent}\n\n${guess ? `[GUESS]\n${guess}\n\n` : ''}[LIKELY SECTIONS]\n${likely || '(none)'}${other ? `\n\n[OTHER SECTIONS]\n${other}` : ''}\n\nPick at most ${cfg.max}.`, { system: AI_SYS_ROUTER, maxTokens: 1024 }),
            new Promise((_, no) => setTimeout(() => no(new Error('20초 안에 답이 없었어요')), 20_000)),
        ]);
    } catch (e) {
        // the model failed: go with the fast picks, and say why
        if (force) throw e;
        const st = await fallback(e.message || String(e));
        if (!routerWarned) { routerWarned = true; toastr.warning(`AI 라우터가 안 돼서 빠른 방식으로 골랐어요: ${e.message || e}`, '서사 아카이브'); }
        return st;
    }
    // read the "PICK:" line if there is one (so numbers in any reasoning are ignored); a word in parentheses after a number is kept as the why
    const pickLine = (out.match(/PICK\s*:\s*(.*)$/im) || [null, out])[1];
    const fresh = [];
    if (!/^\s*none\b/i.test(pickLine)) {
        for (const mt of pickLine.matchAll(/(\d+)\s*(?:\(([^)]*)\))?/g)) {
            const n = Number(mt[1]);
            const s = cands[listed[n - 1]];
            if (!s || fresh.some(x => x.key === sectionKey(s))) continue;
            fresh.push({ key: sectionKey(s), why: String(mt[2] || '').trim().slice(0, 40) });
            if (fresh.length >= cfg.max) break;
        }
    }
    return finish(id, key, cands, prev, fresh, cfg.max, { via: 'ai', ms: Date.now() - t0, short: order.length, guess, raw: out.trim().slice(-600) }); // raw: the model's answer, shown by 라우터 시험 when nothing was read from it
}
