// 압축 작업실: compress scene by scene in one conversation with the draft model, the way a chat site works. A correction
// the user makes stays in the conversation, so it holds for every later scene. Each turn sends the whole conversation;
// only the newest scene keeps its raw log (older scenes are left as the sections written for them). Kept in the chat's
// meta, so closing the window or the tab loses nothing that already came back.

import { aiLabel, askCompress, drLabel, draftReady, stripThink } from './ai.js';
import { openAppend } from './append.js';
import { ctx, getMeta, globalSettings, saveMeta } from './core.js';
import { activePrompt, archiveLang, auBlock, auFix, auOf, langBlock } from './prompts.js';
import { NOTE_PARTS, STATE_SYS, answerBlocks, noteInsert, chunksFromStarts, detectScenes, lastSections, openWorkNote, parseSceneAnswer, rulesText, sceneChunks, scenesText, startsFromText } from './scenes.js';
import { CITE_RE, headingRanges, lastRangeEnd, splitTail } from './sections.js';
import { openSource } from './source.js';
import { refreshStatus } from './status.js';
import { translateLines, trLineOk } from './translate.js';
import { svgA } from './theme.js';
import { confirm, esc, timeLabel } from './util.js';
import { nextRange, rangeRaw } from './wizard.js';

const STUDIO_SYS = `GOAL
Write the long-term-memory archive of a role-play together with its user, one scene at a time, in this conversation. You turn each scene the user sends into its section; the user reads every answer and corrects you. A correction holds for the rest of the conversation: apply it to every later scene too, not only the one it was about.

YOU GET
- <rules>: how sections are written. Follow them, except what they say about output parts, scene lists, change lists and section counts: those come from this conversation.
- <work_note> (sometimes): the user's own notes on this story: canon, lines to keep, past mistakes. Follow it.
- <recent_archive>: the archive's last sections, already written, ending right before the first scene. Style and continuity only; never repeat them.
- <current_state>: the archive's STATE and OPEN now. Context only: nothing in it goes into a section unless a raw log shows it happening.
- Scene requests: the scene's messages in <raw_log>, with its range. Only the newest scene keeps its raw log in the conversation; for earlier scenes you have the sections you wrote.
- Everything else the user writes: corrections and questions, often in Korean and casual.

STEPS
1. A scene request: write that scene's section. Usually one; two only when the story clearly turns inside the scene, together covering its range with no gap. Do not repeat what your earlier sections already hold; carry on from where they stop.
2. A correction: rewrite only the section(s) it is about, in full, with the same heading numbers. Change what was asked and keep the rest. Then apply the correction to every later scene.
3. A question, or a correction you cannot carry out from what you have (the raw log of an earlier scene is gone): answer in Korean, briefly, with no section. Never guess at a raw log you no longer have.
4. A request for the change lists: give them as asked.
5. An outline request: only the numbered outline, no section. When the user then asks for the section, follow the outline as they corrected it.
6. Sections the user approved are named at the end of a request. They are final: never rewrite them, even when a correction seems to reach them.

EXAMPLE
User: <raw_log range="#57–#69">…</raw_log> Scene 1/3: write the section for #57–#69.
You:
## #57–#69 — The north road (Spring 3, night, Varo)
PLOT:
- Mara came back the same night she had sworn to leave, unable to say why (#57, #59). Ren let her in without pressing and told her the north road was closed: "Then I'll wait. I'll wait as long as the road stays shut, and longer if I have to." She took it as an excuse handed to her. (#60, #63)
User: 대사 너무 길어. 그리고 핑계로 받아들였다는 건 원문에 없잖아
You:
## #57–#69 — The north road (Spring 3, night, Varo)
PLOT:
- Mara came back the same night she had sworn to leave, unable to say why (#57, #59). Ren let her in without pressing and told her the north road was closed, and she stayed: "Then I'll wait." (#60, #63)

OUTPUT
- A scene or a rewrite: only the section blocks, nothing before or after them. Each block is the heading line from <rules>, then "PLOT:", then "- " bullets.
- Anything else: plain Korean, short.`;

const STATE_ASK = `All scenes are written. Now list what they change in <current_state>, going by the latest version of each section in this conversation.\n\n${STATE_SYS.slice(STATE_SYS.indexOf('RULES'))}`;

const chatKey = () => String(ctx().getCurrentChatId?.() || ctx().chatId || '');
const short = l => String(l).replace(/^(커스텀|Vertex) · /, '');
const ICO = {
    book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM8 7h8M8 11h6',
    up: 'M12 19V5M5 12l7-7 7 7', down: 'M12 5v14M6 13l6 6 6-6', plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};
// a section as a card: range, title, (date, place) under it, bullets with quotes marked and source numbers small
function bulletHtml(b) {
    return esc(b)
        .replace(/\s*\((#\d+(?:\s*(?:[,–—~-]|and)\s*#?\d+)*)\)/g, (_, inner) => ` <span class="na_st_cite">${[...inner.matchAll(/\d+/g)].map(n => `<button type="button" class="na_st_msg" data-msg="${n[0]}">${n[0]}</button>`).join('·')}</span>`)
        .replace(/(&quot;|“)(.*?)(&quot;|”)/g, '<span class="na_st_qt">$1$2$3</span>');
}
// a card's pieces: title, (date, place), and each bullet split from its source numbers (what 한국어로 translates)
function cardParts(x) {
    const mt = String(x.title || '').match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    const bullets = x.bullets.map(b => {
        const t = b.replace(/^-\s*/, '');
        const nums = [...t.matchAll(new RegExp(CITE_RE.source, 'g'))].flatMap(mk => [...mk[0].matchAll(/\d+/g)].map(n => n[0]));
        return { raw: t, core: t.replace(new RegExp(CITE_RE.source, 'g'), '').trim(), nums };
    });
    return { name: (mt ? mt[1] : x.title) || 'Untitled', where: mt ? mt[2] : '', bullets };
}
// tr: English → Korean; the numbers then go at the end of each bullet
function cardHtml(x, tr = null) {
    const { name, where, bullets } = cardParts(x);
    const ko = t => tr?.get(t) || t;
    const li = b => (tr ? `${bulletHtml(ko(b.core))}${b.nums.length ? ` <span class="na_st_cite">${b.nums.map(n => `<button type="button" class="na_st_msg" data-msg="${n}">${n}</button>`).join('·')}</span>` : ''}` : bulletHtml(b.raw));
    return `<div class="na_st_card"><div class="na_st_ctop">${x.a !== null ? `<span class="na_st_rg">#${x.a}–#${x.b}</span>` : ''}<b>${esc(ko(name))}</b></div>${where ? `<div class="na_st_where">${esc(ko(where))}</div>` : ''}<ul>${bullets.map(b => `<li>${li(b)}</li>`).join('')}</ul></div>`;
}
// #141 in an answer opens that message (not the &#39; that esc writes)
const linkNums = h => h.replace(/(?<!&)#(\d+)(?!\d|;)/g, (_, n) => `<button type="button" class="na_st_msg" data-msg="${n}">#${n}</button>`);
// corrections that come up again and again: one tap sends them
const QUICK = ['대사 줄여', '무대 묘사 빼', '속마음은 인물 해석으로', '원문 다시 읽고 순서 확인', '더 짧게'];

let busy = false;   // one request at a time, across windows
let live = null;    // the open window's redraw, so an answer that lands later shows up

// ---- the session in meta: { from, to, keepUpTo, scenes: [{ a, b, note }], turns, secs, changes, auto, outline, locked, calls, at }
// turns: { role: 'user' | 'assistant', kind: 'scene' | 'write' | 'talk' | 'state', scene, outline, text, at, note }
// outline: a scene asked for its outline first ('write' then asks for the section); locked: scene indexes the user approved
const sessionOf = m => (m.studio && Array.isArray(m.studio.scenes) && m.studio.scenes.length ? m.studio : null);

function prefixOf(m) {
    const au = auOf(m);
    return au.on ? au.name : (headingRanges(splitTail(m.text)[0]).pop()?.prefix || '');
}
const sectionText = (x, prefix) => `## ${prefix ? `${prefix} ` : ''}#${x.a}–#${x.b} — ${x.title || 'Untitled'}\nPLOT:\n${x.bullets.join('\n')}`;

// new sections replace the ones they overlap; the rest stay
function mergeSecs(secs, got) {
    const keep = secs.filter(s => !got.some(n => n.a <= s.b && s.a <= n.b));
    return [...keep, ...got].sort((x, y) => x.a - y.a);
}
// messages of the answered scenes that no section covers: [[a, b], …]
function gapsOf(st) {
    // only scenes that have their answer: one still being written is not a gap yet
    const sent = st.turns.filter(t => t.role === 'assistant' && t.scene !== undefined).map(t => t.scene);
    if (!sent.length) return [];
    const top = st.scenes[Math.max(...sent)].b, out = [];
    let at = st.from;
    for (const s of st.secs) {
        if (s.a > at) out.push([at, Math.min(s.a - 1, top)]);
        at = Math.max(at, s.b + 1);
    }
    if (at <= top) out.push([at, top]);
    return out.filter(([a, b]) => a <= b && a <= top);
}
// the scene whose outline came back and whose section has not been asked for yet (-1: none)
function pendingWrite(st) {
    let last = null;
    for (const t of st.turns) if (t.role === 'user' && (t.kind === 'scene' || t.kind === 'write')) last = t;
    return last?.kind === 'scene' && last.outline ? last.scene : -1;
}
const lockedOf = st => (Array.isArray(st.locked) ? st.locked : []);
const lockedHit = (st, x) => lockedOf(st).some(k => { const sc = st.scenes[k]; return sc && x.a <= sc.b && sc.a <= x.b; });
// the scenes an answer's sections fall in
const scenesOfBlocks = (st, blocks, scene) => (scene !== undefined ? [scene] : st.scenes.map((sc, k) => (blocks.some(x => x.a !== null && x.a <= sc.b && sc.a <= x.b) ? k : -1)).filter(k => k >= 0));
const nextScene = st => { const sent = new Set(st.turns.filter(t => t.role === 'user' && t.kind === 'scene').map(t => t.scene)); return st.scenes.findIndex((_, k) => !sent.has(k)); };

// ---- what the model gets
function systemFor(m, st) {
    const g = globalSettings();
    const p = g.prompts.find(x => x.id === g.wizPrompt) || activePrompt(g);
    const tail = splitTail(m.text)[1].trim();
    const note = String(m.workNote || '').trim();
    const recent = lastSections(m.text, 3).join('\n\n');
    const au = auOf(m);
    return `${STUDIO_SYS}\n\n<rules>\n${rulesText(p, st.from, st.to).trim()}\n</rules>${note ? `\n\n<work_note>\n${note}\n</work_note>` : ''}\n\n<recent_archive>\n${recent || '(none: this is the start of the archive)'}\n</recent_archive>\n\n<current_state>\n${tail || '(none)'}\n</current_state>${au.on ? `\n\n${auBlock(m).trim()}` : ''}${langBlock(m.text)}`;
}
const rawOf = (st, a, b) => { const c = ctx(), g = globalSettings(); return rangeRaw(c, g, a, b, st.keepUpTo ?? -1).raw; };
function turnsFor(st) {
    let lastScene = -1;
    st.turns.forEach((t, i) => { if (t.role === 'user' && t.kind === 'scene') lastScene = i; });
    const out = st.turns.map((t, i) => {
        if (t.role === 'assistant') return { role: 'assistant', content: t.text };
        if (t.kind === 'scene') {
            const sc = st.scenes[t.scene];
            const raw = i === lastScene ? rawOf(st, sc.a, sc.b) : '(removed to save room; your section for this scene follows)';
            const ask = t.outline
                ? `Scene ${t.scene + 1}/${st.scenes.length}, #${sc.a}–#${sc.b}: first give only its outline, no section yet: 3–5 numbered lines, what happens in order and what causes what, each with its message numbers. The user checks it before you write.`
                : `Scene ${t.scene + 1}/${st.scenes.length}: write the section for #${sc.a}–#${sc.b}.`;
            return { role: 'user', content: `<raw_log range="#${sc.a}–#${sc.b}">\n${raw}\n</raw_log>\n\n${ask}${t.note ? `\n\nThe user's note for this scene: ${t.note}` : ''}` };
        }
        if (t.kind === 'write') { const sc = st.scenes[t.scene]; return { role: 'user', content: `Write the section for #${sc.a}–#${sc.b} now, following the outline as the user corrected it.${t.note ? `\n\nThe user's note: ${t.note}` : ''}` }; }
        if (t.kind === 'state') return { role: 'user', content: `${STATE_ASK}${t.note ? `\n\nThe user's note: ${t.note}` : ''}` };
        return { role: 'user', content: t.text };
    });
    // approved sections: said on the newest request, so it is never far back
    const locks = lockedOf(st).map(k => st.scenes[k]).filter(Boolean).map(sc => `#${sc.a}–#${sc.b}`);
    const lastU = out.map(x => x.role).lastIndexOf('user');
    if (locks.length && lastU >= 0) out[lastU] = { ...out[lastU], content: `${out[lastU].content}\n\n(Approved by the user, final: ${locks.join(', ')}. Never rewrite these.)` };
    return out;
}

// ---- checks shown under an answer
const HANGUL = /[가-힯]/;
const langOf = t => { const h = (String(t).match(/[가-힯]/g) || []).length, l = (String(t).match(/[A-Za-z]/g) || []).length; return h + l < 20 ? '' : h / (h + l) > 0.3 ? 'ko' : 'en'; };
const squash = t => String(t).toLowerCase().replace(/[\s"'“”‘’.,!?…~—–\-:;()[\]*]/g, '');
const words = t => (String(t).match(/\S+/g) || []).length;
function checkBlocks(blocks, { scene = null, st, archLang }) {
    const out = [];
    if (scene && blocks.length && blocks[0].a !== null) {
        const a = blocks[0].a, b = blocks[blocks.length - 1].b;
        if (a !== scene.a || b !== scene.b) out.push(`번호를 장면에 맞췄어요 (답은 #${a}–#${b})`);
    }
    for (const x of blocks) {
        // one section: its card already says which, so the tags go without the name
        const name = blocks.length === 1 ? '' : x.a !== null ? `#${x.a}–#${x.b}` : (x.title || '섹션');
        const body = x.bullets.join('\n').replace(CITE_RE, '');
        const n = words(body.replace(/^- /gm, ''));
        if (n > 250) out.push(`${name ? `${name} · ` : ''}${n}단어`);
        const dash = (body.match(/—/g) || []).length;
        if (dash > 1) out.push(`${name ? `${name} · ` : ''}em대쉬 ${dash}개`);
        if (x.bullets.length > 6) out.push(`${name ? `${name} · ` : ''}불릿 ${x.bullets.length}개`);
        if (x.a !== null) {
            const outside = [...new Set([...x.bullets.join('\n').matchAll(new RegExp(CITE_RE.source, 'g'))].flatMap(mk => [...mk[0].matchAll(/#?(\d+)/g)].map(y => Number(y[1]))).filter(k => k < x.a || k > x.b))];
            if (outside.length) out.push(`${name ? `${name} · ` : ''}범위 밖 번호 ${outside.slice(0, 4).map(k => `#${k}`).join(', ')}`);
        }
        let raw = null;
        for (const mt of body.matchAll(/"([^"\n]{2,})"|“([^”\n]{2,})”/g)) {
            const q = (mt[1] || mt[2]).trim();
            const head = q.split(/\s+/).slice(0, 5).join(' ');
            const qn = words(q);
            if (qn > 20) out.push(`${name ? `${name} · ` : ''}긴 인용 ${qn}단어 "${head}…"`);
            if (archLang === 'en' && HANGUL.test(q)) { out.push(`${name ? `${name} · ` : ''}한국어 대사 "${head}…"`); continue; }
            // copied lines can be checked only when the archive and the raw log share a language (a translated line can't)
            if (x.a === null || !st) continue;
            raw ??= rawOf(st, x.a, x.b);
            if (!archLang || langOf(raw) !== archLang || langOf(q) !== archLang) continue;
            const pieces = q.split(/…|\.\.\./).map(squash).filter(s => s.length >= 6);
            if (pieces.length && pieces.some(s => !squash(raw).includes(s))) out.push(`${name ? `${name} · ` : ''}원문에서 못 찾은 인용 "${head}…"`);
        }
    }
    return out;
}

// ---- one turn: send, read the answer, fold its sections in
async function send(turn, { onDone } = {}) {
    if (busy) { toastr.info('답을 기다리는 중이에요.', '압축 작업실'); return false; }
    const key = chatKey();
    let m = getMeta(), st = sessionOf(m);
    if (!st) return false;
    st.turns.push({ ...turn, role: 'user', at: Date.now() });
    await saveMeta();
    busy = true; live?.();
    let out = null, err = null;
    try { out = stripThink(await askCompress(turnsFor(st), { system: systemFor(m, st) })); }
    catch (e) { err = e; }
    finally { busy = false; }
    if (chatKey() !== key) { toastr.warning('그사이 채팅이 바뀌어서 답을 버렸어요.', '압축 작업실'); return false; }
    m = getMeta(); st = sessionOf(m);
    if (!st) return false;
    if (err || !String(out || '').trim()) {
        // the request did not go through: the turn comes off, a typed message goes back in the box
        const t = st.turns.pop();
        await saveMeta();
        toastr.error(String(err?.message || err || '빈 답이 왔어요'), '압축 작업실');
        live?.({ restore: t.kind === 'talk' ? t.text : t.note || '' });
        return false;
    }
    const a = { role: 'assistant', text: out, at: Date.now() };
    st.calls = (st.calls || 0) + 1;
    if ((turn.kind === 'scene' && !turn.outline) || turn.kind === 'write') {
        const sc = st.scenes[turn.scene];
        const got = parseSceneAnswer(out, sc.a, sc.b);
        if (got.length) { st.secs = mergeSecs(st.secs, got); a.scene = turn.scene; }
    } else if (turn.kind !== 'scene') {
        // a rewrite: sections with numbers inside the run replace what they overlap, except approved ones
        const all = answerBlocks(out).filter(x => x.a !== null && x.a >= st.from && x.b <= st.to);
        const got = all.filter(x => !lockedHit(st, x));
        if (got.length < all.length) a.kept = all.filter(x => lockedHit(st, x)).map(x => `#${x.a}–#${x.b}`);
        if (got.length) st.secs = mergeSecs(st.secs, got);
    }
    const ch = out.search(/^# (STATE|OPEN) CHANGES/m);
    if (ch >= 0) st.changes = out.slice(ch).trim();
    st.turns.push(a);
    st.at = Date.now();
    await saveMeta();
    live?.();
    onDone?.();
    return true;
}

// 자동 진행: the next scene after each answer, then the change lists, until it is switched off or a request fails
async function runAuto() {
    for (;;) {
        const st = sessionOf(getMeta());
        if (!st?.auto || busy) return;
        // auto never stops for an outline: one that is waiting gets its section, the rest go straight to sections
        const pw = pendingWrite(st);
        if (pw >= 0) { if (!await send({ kind: 'write', scene: pw })) return; continue; }
        const k = nextScene(st);
        if (k >= 0) { if (!await send({ kind: 'scene', scene: k })) return; continue; }
        if (splitTail(getMeta().text)[1].trim() && !st.changes && !st.turns.some(t => t.kind === 'state')) { await send({ kind: 'state' }); }
        st.auto = false; await saveMeta(); live?.();
        toastr.success('장면을 다 썼어요. 확인하고 추가 창으로 넘겨 주세요.', '압축 작업실');
        return;
    }
}

// the finished run, as the append window takes it
function finalText(m, st) {
    const prefix = prefixOf(m);
    const body = st.secs.map(x => sectionText(x, prefix)).join('\n\n');
    return auFix(`${body}${st.changes ? `\n\n---\n${st.changes}` : ''}`, m);
}

// ---- the window
// the popup's own box may clip it, and on a phone the visible screen is shorter than the page: shrink to whichever ends first
function fitStudio(el) {
    if (!el?.isConnected) return;
    el.style.height = '';
    const vh = window.visualViewport?.height || window.innerHeight;
    const r = el.getBoundingClientRect();
    let limit = vh - 10;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (/hidden|auto|scroll|clip/.test(cs.overflowY)) limit = Math.min(limit, p.getBoundingClientRect().bottom - (parseFloat(cs.paddingBottom) || 0) - (parseFloat(cs.borderBottomWidth) || 0));
        if (p.tagName === 'DIALOG') break;
    }
    if (r.bottom > limit) el.style.height = `${Math.max(300, Math.floor(limit - r.top - 2))}px`;
}
export async function openStudio() {
    const c = ctx();
    if (!draftReady()) return toastr.info('⚙ 설정 → AI · 번역 → 초안 모델을 먼저 정해 주세요.', '압축 작업실');
    let m = getMeta();
    let st = sessionOf(m);
    // a run that already went in is over
    if (st && (m.boundary ?? -1) >= st.to) { delete m.studio; await saveMeta(); st = null; }
    if (!st && !await setup()) return;
    let toAppend = false;
    const $root = $(`
      <div class="na_popup na_st">
        <div class="na_st_hd">
          <div class="na_st_hrow">
            <span class="na_st_av">${svgA(ICO.book, 20)}</span>
            <div class="na_st_ht"><b>압축 작업실</b><small class="na_st_sub"></small></div>
            <button type="button" class="na_st_add"></button>
            <button type="button" class="na_st_x" aria-label="닫기" title="닫기">${svgA(ICO.x, 18, 2.4)}</button>
          </div>
          <div class="na_st_seg"></div>
          <div class="na_st_gap" hidden></div>
        </div>
        <div class="na_st_logwrap">
          <div class="na_st_log"></div>
          <button type="button" class="na_st_float" hidden></button>
        </div>
        <div class="na_st_dock">
          <div class="na_st_quick">${QUICK.map(q => `<button type="button" class="na_st_qk">${esc(q)}</button>`).join('')}</div>
          <div class="na_st_inrow">
            <button type="button" class="na_st_plus" aria-label="더 보기">${svgA(ICO.plus, 18, 2.2)}<i hidden></i></button>
            <div class="na_st_field">
              <textarea class="na_st_q" rows="1" spellcheck="false" placeholder="고칠 점이나 질문"></textarea>
              <button type="button" class="na_st_send" aria-label="보내기" title="보내기">${svgA(ICO.up, 15, 2.6)}</button>
            </div>
          </div>
          <div class="na_st_menu" hidden>
            <label class="na_st_mi"><span><b>자동 진행</b><small>남은 장면을 끝까지 쭉 · 마지막에 STATE 쪽지</small></span><input type="checkbox" class="na_toggle na_st_autotg"></label>
            <label class="na_st_mi"><span><b>개요 먼저</b><small>흐름을 먼저 보고 본문 · 장면마다 1번 더</small></span><input type="checkbox" class="na_toggle na_st_outtg"></label>
            <button type="button" class="na_st_mi na_st_note"><span><b>작업 노트</b><small>매 턴 같이 가요</small></span></button>
            <button type="button" class="na_st_mi na_st_state"><span><b>STATE 쪽지 받기</b><small>지금까지 쓴 섹션으로</small></span></button>
            <button type="button" class="na_st_mi na_st_reset"><span><b>새로 시작</b><small>이 대화와 받은 섹션을 지워요</small></span></button>
          </div>
        </div>
      </div>`);
    const archLang = archiveLang(getMeta().text);
    // 한국어로: answers shown in Korean (this window only; the archive gets the English)
    const koOn = new Set(), koBusy = new Set(), koMap = new Map();
    const draw = ({ restore } = {}) => {
        const m2 = getMeta(), s = sessionOf(m2);
        if (!s) return;
        const k = nextScene(s), gaps = gapsOf(s), pw = pendingWrite(s);
        const locked = new Set(lockedOf(s));
        const hasTail = !!splitTail(m2.text)[1].trim();
        const answered = new Set(s.turns.filter(t => t.role === 'assistant' && t.scene !== undefined).map(t => t.scene));
        $root.find('.na_st_sub').text(`#${s.from}–#${s.to} · ${short(drLabel())} ${s.calls || 0}번`);
        $root.find('.na_st_add').text(k >= 0 && s.secs.length ? `여기까지 추가` : '추가하기').prop('disabled', busy || !s.secs.length);
        // the scene being written now, or the next one to go
        const cur = busy ? (s.turns[s.turns.length - 1]?.scene ?? -1) : pw >= 0 ? pw : k;
        $root.find('.na_st_seg').html(s.scenes.map((sc, i) => `<span class="${locked.has(i) ? 'l' : i === cur ? 'on' : answered.has(i) ? 'd' : ''}" title="#${sc.a}–#${sc.b}${sc.note ? ` · ${esc(sc.note)}` : ''}">${locked.has(i) ? '✓ ' : ''}${i + 1}</span>`).join(''));
        $root.find('.na_st_gap').prop('hidden', !gaps.length).text(gaps.length ? `빈 곳 ${gaps.map(([a, b]) => (a === b ? `#${a}` : `#${a}–#${b}`)).join(', ')}` : '');
        // the newest answer for each scene carries its 확정
        const latest = new Map();
        s.turns.forEach((t, i) => { if (t.role !== 'assistant') return; const bl = answerBlocks(t.text).filter(x => !t.kept?.includes(`#${x.a}–#${x.b}`)); if (!bl.length) return; for (const sk of scenesOfBlocks(s, bl, t.scene)) latest.set(sk, i); });
        const html = s.turns.map((t, i) => {
            if (t.role === 'user') {
                const note = t.note ? `<div class="na_st_me">${esc(t.note)}</div>` : '';
                if (t.kind === 'scene') { const sc = s.scenes[t.scene]; return `<div class="na_st_mark"><b>장면 ${t.scene + 1}${t.outline ? ' · 개요' : ''}</b> · #${sc.a}–#${sc.b}${sc.note ? ` · ${esc(sc.note)}` : ''}</div>${note}`; }
                if (t.kind === 'write') return `<div class="na_st_mark"><b>장면 ${t.scene + 1} 본문</b></div>${note}`;
                if (t.kind === 'state') return `<div class="na_st_mark"><b>STATE 쪽지</b></div>${note}`;
                return `<div class="na_st_me">${esc(t.text)}</div><button type="button" class="na_st_tonote" data-i="${i}">노트에 추가</button>`;
            }
            const blocks = answerBlocks(t.text);
            const ch = t.text.search(/^# (STATE|OPEN) CHANGES/m);
            if (!blocks.length) return `<div class="na_st_bub${ch >= 0 ? ' na_st_pre' : ''}">${linkNums(esc(ch >= 0 ? t.text.slice(ch) : t.text))}</div>`;
            const scene = t.scene !== undefined ? s.scenes[t.scene] : null;
            const issues = checkBlocks(blocks, { scene, st: s, archLang });
            const mine = [...latest].filter(([, at]) => at === i).map(([sk]) => sk);
            const tags = [
                ...issues.map(x => `<span class="na_st_tag">${esc(x)}</span>`),
                ...(issues.length ? [] : ['<span class="na_st_tag ok">검사 통과</span>']),
                ...(t.kept?.length ? [`<span class="na_st_tag">확정한 ${esc(t.kept.join(', '))}는 안 바꿈</span>`] : []),
            ].join('');
            const locks = mine.map(sk => `<button type="button" class="na_st_lk${locked.has(sk) ? ' on' : ''}" data-k="${sk}">${svgA(ICO.lock, 11, 2.6)}${mine.length > 1 ? `장면 ${sk + 1} ` : ''}${locked.has(sk) ? '확정됨' : '확정'}</button>`).join('');
            const ko = koOn.has(i);
            const koBtn = `<button type="button" class="na_st_ko${ko ? ' on' : ''}" data-i="${i}">${koBusy.has(i) ? '번역하는 중…' : ko ? '영어로' : '한국어로'}</button>`;
            return `<div class="na_st_bub">${blocks.map(x => cardHtml(x, ko ? koMap : null)).join('<hr>')}<div class="na_st_tags">${tags}<span class="na_st_lks">${koBtn}${locks}</span></div></div>`;
        }).join('') + (busy ? '<div class="na_st_bub na_st_typing"><i></i><i></i><i></i><small>쓰는 중 · 이 탭에 있어야 받아요</small></div>' : '');
        const $log = $root.find('.na_st_log');
        const atEnd = $log[0] ? $log[0].scrollHeight - $log[0].scrollTop - $log[0].clientHeight < 80 : true;
        $log.html(html || '<div class="na_st_mark">아직 보낸 장면이 없어요</div>');
        if (atEnd && $log[0]) $log[0].scrollTop = $log[0].scrollHeight;
        // the one thing to press next floats over the conversation
        const nx = k >= 0 ? s.scenes[k] : null;
        const fl = busy ? '' : pw >= 0 ? `장면 ${pw + 1} 본문 쓰기 ${svgA(ICO.down, 14, 2.6)}`
            : nx ? `다음 장면 ${k + 1}/${s.scenes.length}${s.outline ? ' 개요' : ''} <small>#${nx.a}–#${nx.b}</small>${svgA(ICO.down, 14, 2.6)}`
                : hasTail && !s.changes && s.secs.length ? `STATE 쪽지 받기 ${svgA(ICO.down, 14, 2.6)}` : '';
        $root.find('.na_st_float').prop('hidden', !fl).html(fl);
        $root.find('.na_st_send').prop('disabled', busy);
        $root.find('.na_st_qk').prop('disabled', busy || !s.turns.some(t => t.role === 'assistant'));
        $root.find('.na_st_autotg').prop('checked', !!s.auto);
        $root.find('.na_st_outtg').prop('checked', !!s.outline);
        $root.find('.na_st_plus i').prop('hidden', !s.auto && !s.outline);
        $root.find('.na_st_state').prop('hidden', !hasTail).prop('disabled', busy).find('b').text(s.changes ? 'STATE 쪽지 다시 받기' : 'STATE 쪽지 받기');
        if (restore) $root.find('.na_st_q').val(restore).trigger('input');
    };
    live = draw;
    const $q = $root.find('.na_st_q');
    const typed = () => String($q.val() || '').trim();
    const clearQ = () => $q.val('').trigger('input');
    // the box grows with what is typed, up to five lines
    $q.on('input', function () { this.style.height = 'auto'; this.style.height = `${Math.min(this.scrollHeight, 120)}px`; });
    const sendTalk = async () => {
        const q = typed();
        if (!q) return $q.trigger('focus');
        clearQ();
        await send({ kind: 'talk', text: q });
    };
    $root.find('.na_st_send').on('click', sendTalk);
    $q.on('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendTalk(); } });
    // the floating button: the next scene (a typed line goes with it), the section after an outline, or the change lists
    $root.find('.na_st_float').on('click', async () => {
        const s = sessionOf(getMeta());
        if (!s || busy) return;
        const pw = pendingWrite(s), k = nextScene(s), note = typed();
        clearQ();
        if (pw >= 0) return send({ kind: 'write', scene: pw, note });
        if (k >= 0) return send({ kind: 'scene', scene: k, note, outline: !!s.outline });
        return send({ kind: 'state', note });
    });
    $root.on('click', '.na_st_qk', function () { send({ kind: 'talk', text: $(this).text() }); });
    const $menu = $root.find('.na_st_menu');
    $root.find('.na_st_plus').on('click', e => { e.stopPropagation(); $menu.prop('hidden', !$menu.prop('hidden')); });
    $root.on('click', e => { if (!$(e.target).closest('.na_st_menu, .na_st_plus').length) $menu.prop('hidden', true); });
    $root.find('.na_st_outtg').on('change', async function () { const s = sessionOf(getMeta()); if (!s) return; s.outline = this.checked; await saveMeta(); draw(); });
    $root.find('.na_st_autotg').on('change', async function () {
        const s = sessionOf(getMeta());
        if (!s) return;
        s.auto = this.checked; await saveMeta(); draw();
        if (s.auto) { $menu.prop('hidden', true); runAuto(); }
    });
    $root.on('click', '.na_st_lk', async function () {
        const s = sessionOf(getMeta()), sk = Number(this.dataset.k);
        if (!s) return;
        const set = new Set(lockedOf(s));
        if (set.has(sk)) set.delete(sk); else set.add(sk);
        s.locked = [...set].sort((x, y) => x - y);
        await saveMeta(); draw();
    });
    $root.find('.na_st_state').on('click', async () => { $menu.prop('hidden', true); const note = typed(); clearQ(); await send({ kind: 'state', note }); });
    $root.on('click', '.na_st_tonote', async function () {
        const s = sessionOf(getMeta()), t = s?.turns[Number(this.dataset.i)];
        if (!t) return;
        await addToNote(t.text);
    });
    $root.find('.na_st_note').on('click', () => { $menu.prop('hidden', true); openWorkNote(); });
    $root.on('click', '.na_st_ko', async function () {
        const i = Number(this.dataset.i), t = sessionOf(getMeta())?.turns[i];
        if (!t || koBusy.has(i)) return;
        if (koOn.has(i)) { koOn.delete(i); return draw(); }
        const lines = [...new Set(answerBlocks(t.text).flatMap(x => { const p = cardParts(x); return [p.name, p.where, ...p.bullets.map(b => b.core)]; }).map(l => l.trim()).filter(trLineOk))];
        koBusy.add(i); draw();
        try {
            const ko = await translateLines(lines);
            lines.forEach((l, k) => { if (ko[k]) koMap.set(l, ko[k]); });
            koOn.add(i);
        } catch (e) {
            console.error('[NarrativeArchive] studio translate', e);
            toastr.error(String(e?.message || e), '번역');
        } finally { koBusy.delete(i); draw(); }
    });
    $root.on('click', '.na_st_msg', function () { const n = Number(this.dataset.msg); openSource(n, n, `#${n}`); });
    $root.find('.na_st_reset').on('click', async () => {
        $menu.prop('hidden', true);
        if (busy) return toastr.info('답을 기다리는 중이에요.', '압축 작업실');
        if (!await confirm('새로 시작', '이 작업실 대화와 받은 섹션을 지우고 처음부터 할까요?<br><small>아카이브에 이미 넣은 건 그대로예요.</small>')) return;
        delete getMeta().studio; await saveMeta();
        $root.closest('dialog').find('.popup-button-ok').trigger('click');
        setTimeout(openStudio, 50);
    });
    $root.find('.na_st_x').on('click', () => $root.closest('dialog').find('.popup-button-ok').trigger('click'));
    $root.find('.na_st_add').on('click', () => { toAppend = true; $root.closest('dialog').find('.popup-button-ok').trigger('click'); });
    draw();
    // a fresh run starts on its own
    st = sessionOf(getMeta());
    if (st && !st.turns.length) { if (st.auto) runAuto(); else send({ kind: 'scene', scene: 0, outline: !!st.outline }); }
    else if (st?.auto && !busy) runAuto();
    const shown = c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: false, leftAlign: true, okButton: '닫기' });
    // the conversation opens at its end
    // the window fits the screen it is on (phones: the browser bar and the keyboard), then opens at the end of the conversation
    const fit = () => fitStudio($root[0]);
    setTimeout(() => { fit(); const el = $root.find('.na_st_log')[0]; if (el) el.scrollTop = el.scrollHeight; }, 30);
    window.visualViewport?.addEventListener('resize', fit);
    window.addEventListener('resize', fit);
    await shown;
    window.visualViewport?.removeEventListener('resize', fit);
    window.removeEventListener('resize', fit);
    if (live === draw) live = null;
    if (!toAppend) return;
    m = getMeta(); st = sessionOf(m);
    if (!st?.secs.length) return;
    const text = finalText(m, st);
    const upto = st.secs[st.secs.length - 1].b;
    m.lastExport = { from: st.from, to: upto, at: Date.now(), how: 'draft' };
    await saveMeta();
    refreshStatus();
    await openAppend({ text, end: upto, expectTo: upto });
    // what went in leaves the run; the conversation stays, so the rest of the scenes still see it
    const m3 = getMeta(), s3 = sessionOf(m3), bd = m3.boundary ?? -1;
    if (!s3 || bd < s3.from) return;
    if (bd >= s3.to) delete m3.studio;
    else { s3.secs = s3.secs.filter(x => x.a > bd); s3.from = bd + 1; s3.changes = ''; }
    await saveMeta();
}

// a correction the user made, kept in the work note so the next run starts with it
async function addToNote(text) {
    const c = ctx();
    let part = NOTE_PARTS[2];
    const $d = $(`<div class="na_popup na_v2 na_st_nt">
        <div class="na_v2_title"><b>노트에 추가</b><small>작업 노트의 고른 칸에 한 줄로 넣어요 · 다음 압축에도 같이 가요 · 고쳐서 넣어도 돼요</small></div>
        <div class="na_v2_seg na_st_ntseg">${NOTE_PARTS.map(x => `<button type="button" data-p="${esc(x)}" class="${x === part ? 'on' : ''}">${esc(x)}</button>`).join('')}</div>
        <textarea class="text_pole na_st_ntta" rows="3" spellcheck="false"></textarea>
      </div>`);
    $d.find('.na_st_ntta').val(String(text || '').replace(/\s+/g, ' ').trim());
    $d.on('click', '.na_st_ntseg button', function () { part = this.dataset.p; $d.find('.na_st_ntseg button').removeClass('on'); $(this).addClass('on'); });
    const r = await c.callGenericPopup($d, c.POPUP_TYPE.CONFIRM, '', { okButton: '추가', cancelButton: '취소' });
    const v = String($d.find('.na_st_ntta').val() || '').trim();
    if (!(r === c.POPUP_RESULT.AFFIRMATIVE || r === true) || !v) return;
    const m = getMeta();
    m.workNote = noteInsert(m.workNote, part, `- ${v.replace(/^-\s*/, '')}`);
    await saveMeta();
    $('#na_worknote_sub').text(`있음 · 약 ${m.workNote.length.toLocaleString()}자 · 장면마다 같이 보내요`);
    toastr.success('작업 노트에 넣었어요', '압축 작업실');
}

// the start: the range after the boundary, its scenes (named by the AI 기능 모델, editable), then the first scene goes out
async function setup() {
    const c = ctx(), m = getMeta(), g = globalSettings();
    let { from, to, last, after } = nextRange(c, m, { afterExport: false });
    const covered = lastRangeEnd(m.text);
    let keepUpTo = -1;
    if (covered !== null && covered < m.boundary && covered + 1 <= last) {
        if (await confirm('빠진 구간', `경계선은 <b>#${m.boundary}</b>인데 아카이브 섹션은 <b>#${covered}</b>까지예요.<br>#${covered + 1}부터 할까요? (숨긴 메시지도 이 구간은 넣어요)<br><small>아니요를 누르면 경계선 다음(#${m.boundary + 1})부터 해요.</small>`)) {
            from = covered + 1; after = covered; keepUpTo = m.boundary; to = Math.max(to, from);
        }
    }
    if (after >= last || to < from) { toastr.info('압축할 메시지가 없어요.', '압축 작업실'); return false; }
    const { items } = rangeRaw(c, g, from, to, keepUpTo);
    if (!items.length) { toastr.info('이 범위에 메시지가 없어요.', '압축 작업실'); return false; }
    let list = null, notes = new Map(), by = 'ai';
    const t0 = toastr.info(`#${from}–#${to} 장면 나누는 중… (${short(aiLabel())})`, '압축 작업실', { timeOut: 0, extendedTimeOut: 0 });
    try { const found = await detectScenes(items, g); if (found) { notes = new Map(found.map(x => [x.start, x.note])); list = chunksFromStarts(items, found); } }
    catch (e) { console.warn('[NarrativeArchive] scene detection', e); }
    finally { toastr.clear(t0); }
    if (!list) { list = sceneChunks(items); by = 'tracker'; }
    const lines = scenesText(list, { get: k => notes.get(k) || notes.get(k + 1) || '' });
    const note = String(m.workNote || '').trim();
    const $d = $(`<div class="na_qc">
        <div class="na_qc_head"><b>#${from} – #${to}</b><small>메시지 ${items.length}개 · 장면 ${list.length}개 · ${by === 'ai' ? `${esc(short(aiLabel()))}가 나눔` : '트래커·메시지 수로 나눔'}</small></div>
        <small class="na_qc_note">장면마다 ${esc(short(drLabel()))}에게 한 번씩 보내요. 답을 보고 고칠 점을 말하면, 그 말은 뒤 장면까지 따라가요. 고치는 말도 한 번에 1번이에요.${note ? '' : ' 작업 노트가 비어 있어요.'}</small>
        <label class="na_qc_sclabel">장면 나누기 <small>한 줄에 장면 하나 · 앞 번호(시작)만 봐요 · 줄을 추가하면 나누고, 지우면 앞 장면에 합쳐요</small></label>
        <textarea class="text_pole na_st_scenes" rows="${Math.min(10, Math.max(3, list.length))}" spellcheck="false">${esc(lines)}</textarea>
        <label class="checkbox_label na_qc_check"><input type="checkbox" class="na_st_auto0"><span>자동 진행<small>첫 장면부터 끝까지 쭉 · 창에서 언제든 끌 수 있어요</small></span></label>
      </div>`);
    const r = await c.callGenericPopup($d, c.POPUP_TYPE.CONFIRM, '', { wide: true, okButton: '시작', cancelButton: '취소' });
    if (!(r === c.POPUP_RESULT.AFFIRMATIVE || r === true)) return false;
    const edited = String($d.find('.na_st_scenes').val() || '');
    if (edited.trim() !== lines.trim()) { const e = chunksFromStarts(items, startsFromText(edited), { exact: true }); if (e.length) list = e; }
    const noteOf = new Map(edited.split('\n').map(l => l.match(/^\s*#?(\d+)(?:\s*[–—~-]\s*#?\d+)?\s*(.*)$/)).filter(Boolean).map(mt => [Number(mt[1]), mt[2].trim()]));
    getMeta().studio = {
        from, to, keepUpTo, at: Date.now(), auto: !!$d.find('.na_st_auto0').prop('checked'),
        scenes: list.map(x => ({ a: x[0].i, b: x[x.length - 1].i, note: noteOf.get(x[0].i) || notes.get(x[0].i) || '' })),
        turns: [], secs: [], changes: '',
    };
    await saveMeta();
    return true;
}

export const studioLabel = () => { const st = sessionOf(getMeta()); return st ? `#${st.from}–#${st.to} 진행 중 · ${timeLabel(st.at)}` : `장면마다 ${short(drLabel())}와 대화하며 쓰기`; };
