// Before each reply: the AI router picks sections to inject, and keyword links are re-checked against the newest message.

import { askAI, connSettings } from './ai.js';
import { currentChatId } from './chats.js';
import { getMeta, globalSettings, hasChat } from './core.js';
import { recentForCheck } from './drift.js';
import { lastIndex } from './hide.js';
import { applyInjection, currentInjection } from './inject.js';
import { KW_STOP } from './keywords.js';
import { castNames } from './knowledge.js';
import { RANGE_HEAD, linkWaiting, linkedMap, mutedSet, parseSections, pinnedSet, sectionKey } from './sections.js';
import { refreshStatusSoon } from './status.js';
import { shortHash } from './translate.js';

// SillyTavern emits GENERATION_STARTED before it adds the typed message to the chat, and MESSAGE_SENT
// (awaited) right after. So on a normal send the router and keyword links wait for MESSAGE_SENT,
// otherwise they would never see the message being answered.
export let genPending = null;
export async function onGenerationStarted(type, opts, dryRun) {
    if (dryRun || type === 'quiet' || !hasChat()) return;
    const typed = String($('#send_textarea').val() || '').trim();
    if (typed && [undefined, 'normal'].includes(type) && !opts?.automatic_trigger) {
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
}

// Right before a reply, a small model reads the recent chat and picks the sections it needs.

export const AI_SYS_ROUTER = `GOAL
A role-play model is about to write its NEXT reply. It cannot see the whole story archive, only the sections you pick.
Pick the sections it needs so it does not forget or contradict something.

YOU GET
- MAIN CAST: characters who are in almost every section. Their names alone are NOT a reason to pick a section.
- RECENT CHAT: the last messages. The one marked LATEST is what the next reply answers.
- SECTIONS: numbered. Each has a title, the other names in it (people, places, things), its keywords, and how it begins.

PICK A SECTION IF ANY OF THESE IS TRUE
1. Something from it is named or clearly meant in the recent chat: a person who is not main cast, a place, an object, an event.
   Watch for hints, not only exact names: "that night", "the cliff", "what you promised me", "your old life", a nickname.
2. The chat is about a promise, secret, wound, fight, rule or wish that started or changed in that section.
3. The next reply has to stay consistent with it: the chat goes back to a place, a habit, or a relationship moment described there.

DO NOT PICK
- A section just because a main cast character is in it.
- Sections that are only loosely related.
- More than the limit you are given.

HOW TO WORK
Step 1. Read the LATEST message first, then the others. List for yourself the people, places, objects, past events and promises they mention or hint at.
Step 2. Go through the sections one by one and match them against that list.
Step 3. Put the most important first. Fewer is better than wrong.

OUTPUT: exactly one line, nothing else
PICK: 3, 12, 7
If no section is needed:
PICK: none`;

export const routerState = new Map(); // chat id → { key, picks: Set, titles, at, ms, cands }
export let routerWarned = false;

export function routerCfg(m) {
    const r = m?.router && typeof m.router === 'object' ? m.router : {};
    return { mode: ['linked', 'old'].includes(r.mode) ? r.mode : 'off', max: Number(r.max) || 4, keep: Number.isFinite(Number(r.keep)) && r.keep !== undefined ? Number(r.keep) : 3, follow: r.follow !== false };
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
        if (linked || (cfg.mode === 'old' && RANGE_HEAD.test(s.title) && !recent.has(key) && !safe)) out.push(s);
    }
    return out;
}

export function routerReady() {
    const a = connSettings('ai');
    return a.mode === 'custom' || a.mode === 'vertex' || !!globalSettings().aiProfile;
}

export async function runRouter(m, { force = false } = {}) {
    const cfg = routerCfg(m);
    if (cfg.mode === 'off') return null;
    if (!routerReady()) throw new Error('라우터는 RP와 따로 연결한 모델이 필요해요 (⚙ 설정 → AI · 번역 → 모델에서 프로필·커스텀 API·Vertex)');
    const cands = routerCandidates(m);
    const id = currentChatId();
    const msgs = recentForCheck(4);
    if (msgs.length) msgs[msgs.length - 1] = msgs[msgs.length - 1].replace(/^\[#(\d+)/, '[#$1 · LATEST');
    const recent = msgs.join('\n\n').slice(-6000);
    const key = shortHash(`${recent}|${cands.map(sectionKey).join('|')}|${cfg.max}`);
    const prev = routerState.get(id);
    if (!force && prev?.key === key) return prev; // a swipe or regenerate on the same chat
    if (!cands.length) { const st = { key, picks: new Set(), titles: [], at: Date.now(), ms: 0, cands: 0 }; routerState.set(id, st); return st; }
    // each candidate: title, the names in it other than the main cast, its keywords, and how it begins
    const main = castNames(m);
    const mainSet = new Set(main.flatMap(n => n.split(/\s+/)));
    const lm = linkedMap(m);
    const list = cands.map((s, i) => {
        const body = m.text.slice(s.start, s.end).replace(/^#{1,3} [^\n]*\n?/, '');
        const counts = new Map();
        // capitalised words in mid-sentence only, so sentence openers ("Inside", "Asked") don't pass as names
        [...body.matchAll(/[a-z0-9,;:]\s+([A-Z][a-z][A-Za-z'’]*)/g)].map(x => x[1].replace(/['’]s$/, ''))
            .filter(w => w.length > 2 && !KW_STOP.has(w) && !mainSet.has(w)).forEach(w => counts.set(w, (counts.get(w) || 0) + 1));
        const names = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0]);
        const keys = Array.isArray(lm[sectionKey(s)]) ? lm[sectionKey(s)] : [];
        const flat = body.replace(/\s+/g, ' ').trim();
        return `${i + 1}. ${s.title}${names.length ? `\n   names: ${names.join(', ')}` : ''}${keys.length ? `\n   keywords: ${keys.join(', ')}` : ''}\n   begins: ${flat.slice(0, 220)}${flat.length > 220 ? '…' : ''}`;
    }).join('\n');
    const t0 = Date.now();
    const out = await Promise.race([
        askAI(`${main.length ? `[MAIN CAST]\n${main.join(', ')}\n\n` : ''}[RECENT CHAT]\n${recent}\n\n[SECTIONS]\n${list}\n\nPick at most ${cfg.max}.`, { system: AI_SYS_ROUTER, maxTokens: 1024 }),
        new Promise((_, no) => setTimeout(() => no(new Error('20초 안에 답이 없었어요')), 20_000)),
    ]);
    // read the "PICK:" line if there is one (so numbers in any reasoning are ignored), else the whole answer
    const pickLine = (out.match(/PICK\s*:\s*(.*)$/im) || [null, out])[1];
    const nums = /^\s*none\b/i.test(pickLine) ? [] : [...new Set((pickLine.match(/\d+/g) || []).map(Number))].filter(n => n >= 1 && n <= cands.length).slice(0, cfg.max);
    const picked = nums.map(n => cands[n - 1]);
    const st = { key, picks: new Set(picked.map(sectionKey)), titles: picked.map(s => s.title), at: Date.now(), ms: Date.now() - t0, cands: cands.length };
    routerState.set(id, st);
    return st;
}
