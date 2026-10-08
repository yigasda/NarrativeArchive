// Compression wizard.

import { aiLabel, askAI, askCompress, askDraft, compressEffort, drLabel, draftReady, withSpinner } from './ai.js';
import { openAppend } from './append.js';
import { commitText, ctx, getMeta, globalSettings, saveGlobal, saveMeta, textHash } from './core.js';
import { driftHtml } from './drift.js';
import { castNames } from './knowledge.js';
import { hasChanges, resolveChanges } from './statechg.js';
import { buildExtract, cleanMessage, formatExtract, guessEndNumber } from './extract.js';
import { BASIC_PROMPT, LANG_NAME, activePrompt, answerLangOk, archiveLang, auFix, auOf, compressPrompt, dropReproduced, eventsNote, eventsSystem, hasAuDivider, referenceSection, renderPromptSettings, sizeBlock } from './prompts.js';
import { RANGE_HEAD, headingRanges, lastRangeEnd, parseSections, splitTail, trimEnd } from './sections.js';
import { openSource } from './source.js';
import { refreshStatus } from './status.js';
import { ICO_A, svgA } from './theme.js';
import { chatLabel, confirm, copyText, countTokens, download, esc, fmt, timeLabel } from './util.js';

// The whole routine in one place; the last step hands the pasted text to "아카이브에 추가" with its checks.

export const AI_SYS_GRADE = `GOAL
Check a SUMMARY of a role-play log against the RAW LOG it was made from, so nothing wrong goes into the story archive.

YOU GET
- RAW LOG: the original messages. Each starts with its number in brackets, like [512], and the speaker's name.
- SUMMARY: section blocks ("## #from–#to — title" with bullet points). It may end with STATE and OPEN blocks.

HOW TO WORK
Step 1. Read the whole RAW LOG, to the last message.
Step 2. Go through the SUMMARY one bullet at a time. For each bullet, find the messages it is based on.
Step 3. Then go through the RAW LOG again and look for important things the SUMMARY never mentions.

REPORT ONLY THESE
1. 지어냄 (made up): a fact, event, line or detail in the SUMMARY that is not in the RAW LOG.
    e.g. the summary says Ren cried; in the log she only went quiet.
2. 틀림 (wrong): it is in the log but the summary gets it wrong: wrong person, wrong speaker of a quote, wrong order, wrong place or time, a quote with changed words, or a heading whose #from–#to does not match the messages.
    e.g. the summary says Ivo said "…", but in the log Mara said it.
3. 빠짐 (missing): an important event, decision, promise, confession, secret revealed, injury, or change in a relationship that the SUMMARY leaves out.
    Small talk, repeated actions and atmosphere are NOT important.

DO NOT REPORT
- wording, style, length, or how something could be phrased better
- the summary being shorter than the log: shortening is its job
- STATE and OPEN facts that come from before this log (they carry over from the archive); only check what they say about events in this log
- anything you are not sure about

OUTPUT: Korean, one bullet per problem, most serious first, exactly like this
- 지어냄: <what is wrong> (#<message number>)
- 틀림: <what is wrong, and what the log really says> (#<message number>)
- 빠짐: <what is missing> (#<message number>)
Always give the message number(s) you checked. If the summary is faithful, write exactly: 문제 없음`;

const cleanDraft = out => String(out || '').replace(/^```[a-z]*\n?|```\s*$/g, '').trim();

// Turning AU on in a chat whose main-story sections sit under no divider: offer "# ── 본편 ──" above them,
// so the reader and the timeline show the main story and the AU as two parts
async function offerMainDivider(m) {
    const a = auOf(m);
    const [body] = splitTail(m.text);
    if (/^#\s*──.*──\s*$/m.test(body) || hasAuDivider(m.text, a.name)) return;
    const first = parseSections(body).find(x => !x.group && RANGE_HEAD.test(x.title));
    if (!first) return;
    if (!await confirm('본편 구분선', '아카이브의 본편 섹션 위에 <code># ── 본편 ──</code> 구분선을 넣을까요?<br><small>읽기·타임라인에서 본편과 AU가 두 묶음으로 나뉘어 보여요. 안 넣어도 AU 요약은 이어져요.</small>')) return;
    await commitText(`${m.text.slice(0, first.start)}# ── 본편 ──\n\n${m.text.slice(first.start)}`, '본편 구분선 넣기 전');
    refreshStatus();
    toastr.success('본편 구분선을 넣었어요');
}

// 도구 → AU 채팅: on/off, the log's name and a one-line premise. Saved as it changes.
export async function openAuSettings() {
    const c = ctx(), m = getMeta(), a = auOf(m);
    const $root = $(`
      <div class="na_popup na_v2 na_au_pop">
        <div class="na_v2_title"><b>AU 채팅</b><small>본편 아카이브를 들고 새 채팅에서 AU를 할 때 켜요</small></div>
        <div class="na_v2_card na_au_box">
          <label class="na_au_on"><span class="na_cp_txt"><span>이 채팅은 AU</span><small>요약이 본편 뒤에 AU 묶음으로 이어져요</small></span><input type="checkbox" class="na_toggle na_au_tg"></label>
          <label><small>묶음 이름</small><input type="text" class="text_pole na_au_name" maxlength="12" placeholder="AU" spellcheck="false"></label>
          <label><small>AU 설정 · 뭐가 다르고 뭘 기억하는지</small><textarea class="text_pole na_au_note" rows="3" placeholder="예: 현대 AU, 둘 다 대학생. 본편 기억은 그대로"></textarea></label>
        </div>
        <small class="na_v2_note">켜 두면 압축할 때(한 번에 압축 · 마법사 · 원문 뽑기) 지시문 맨 위에 AU 안내가 붙어요. STATE·OPEN은 AU 기준으로 다시 쓰고, 모델이 AU 표시를 빼먹으면 아카이브에 추가할 때 붙여요. 다음 채팅으로 이어가면 이 설정도 같이 가요.</small>
      </div>`);
    $root.find('.na_au_tg').prop('checked', a.on);
    $root.find('.na_au_name').val(m.au?.name || '');
    $root.find('.na_au_note').val(a.note);
    const save = async () => {
        m.au = { on: $root.find('.na_au_tg').prop('checked'), name: String($root.find('.na_au_name').val() || '').trim().replace(/\s+/g, ''), note: String($root.find('.na_au_note').val() || '').trim() };
        await saveMeta();
    };
    $root.find('.na_au_tg').on('change', async function () { await save(); if (this.checked) await offerMainDivider(m); });
    $root.find('.na_au_name, .na_au_note').on('change', save);
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: false, large: false, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
    await save();
    refreshStatus();
}

// 을/를 after a number read in Korean (…3을, …4를)
export const josaA = n => ('2459'.includes(String(n).slice(-1)) ? '를' : '을');

// what to compress next: after the boundary, up to the messages that stay visible.
// The wizard also skips past the last copied extract (it may be with another model); 한 번에 압축 goes by the boundary only.
export function nextRange(c = ctx(), m = getMeta(), { afterExport = true } = {}) {
    const last = (c.chat?.length || 0) - 1;
    const le = afterExport ? m.lastExport : null;
    const after = Math.max(m.boundary, le && le.to <= last ? le.to : -1);
    const from = Math.min(after + 1, Math.max(0, last));
    return { from, to: Math.max(from, last - Math.max(0, Number(m.keep) || 0)), last, after };
}

// the raw log of a range, as the wizard and 원문 뽑기 build it
// keepUpTo: messages up to here stay even when hidden (they were hidden by the boundary, not by hand)
function rangeRaw(c, g, from, to, keepUpTo = -1) {
    const items = buildExtract(from, to).filter(x => !(g.skipHidden && c.chat[x.i]?.is_system && x.i > keepUpTo)).map(x => ({ ...x, text: cleanMessage(x.text, g) })).filter(x => x.text);
    return { items, raw: formatExtract(items, g) };
}

// Long ranges go to the model in parts of about this many tokens: one 145-message log in one request comes back
// as a skim (quotes picked off the surface, events out of order). Each part continues from the one before it.
// 압축 → 설정 → 나눠 보내기: 0 = one request for the whole range
export const CHUNK_CHOICES = { 0: '안 나눔', 40000: '크게 · 약 4만 토큰씩', 20000: '작게 · 약 2만 토큰씩' };
export const chunkTok = () => { const v = globalSettings().chunkTok; return v === undefined || v === null || !(String(v) in CHUNK_CHOICES) ? 40000 : Number(v); };
const estTok = t => { const s = String(t), h = (s.match(/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g) || []).length; return Math.ceil(h + (s.length - h) / 3.6); };
// parts of even size (no lone message left at the end): as many parts as the size needs, then equal shares
export function chunkItems(items) {
    const sizes = items.map(x => estTok(x.text) + 8);
    const total = sizes.reduce((a, t) => a + t, 0);
    const size = chunkTok();
    const n = size ? Math.max(1, Math.ceil(total / size)) : 1;
    const target = total / n;
    const out = [];
    let cur = [], tok = 0;
    items.forEach((x, i) => {
        if (cur.length && out.length < n - 1 && tok + sizes[i] / 2 > target) { out.push(cur); cur = []; tok = 0; }
        cur.push(x); tok += sizes[i];
    });
    if (cur.length) out.push(cur);
    return out;
}

// The draft model compresses items part by part. Each part sees the archive plus what the parts before it wrote
// (their last section as the format sample, their STATE · OPEN as the current one). Returns the joined answer;
// on a failure partway, what was done so far and where it stopped.
export async function draftCompress({ m, g, p, items, onStep = () => {}, grade = false, memo = '', events = '' }) {
    const parts = events ? [items] : chunkItems(items);
    const acc = [];
    let tail = '', lastChg = '', doneTo = null, error = null, dropped = 0;
    const grades = [];
    for (const [k, part] of parts.entries()) {
        const from = part[0].i, to = part[part.length - 1].i;
        onStep(k, parts.length, from, to);
        const raw = events || formatExtract(part, g);
        const shadow = acc.length ? `${m.text}\n\n${acc.join('\n\n')}` : m.text;
        const state = tail || splitTail(m.text)[1].trim() || '(없음)';
        const prompt = compressPrompt(p.text, { raw, from: String(from), to: String(to), last_section: referenceSection(shadow), state, archive: shadow }, { ...m, text: shadow }, memo,
            sizeBlock({ k, n: parts.length, count: part.length, total: items.length, from: items[0].i, to: items[items.length - 1].i, partFrom: from, partTo: to }));
        let out;
        try { out = cleanDraft(await askCompress(prompt)); }
        catch (e) { error = e; break; }
        if (!out) { error = new Error('초안 모델이 빈 답을 줬어요'); break; }
        // answered in the wrong language (Korean for an English archive): ask before paying for another try
        if (!answerLangOk(shadow, out)) {
            const want = LANG_NAME[archiveLang(shadow)];
            if (await confirm('답 언어가 달라요', `#${from}–#${to} 요약을 모델이 아카이브(${want})와 다른 언어로 썼어요.<br><b>${want}로 다시 받을까요?</b> (요청 1번 더)<br><small>아니요를 누르면 이 답 그대로 써요.</small>`)) {
                try { out = cleanDraft(await askCompress(`[Your previous answer to this request was not in ${want}. Answer in ${want} only.]\n\n${prompt}`)) || out; }
                catch (e) { error = e; break; }
            }
        }
        const [body0, t] = splitTail(out);
        // sections copied out of the archive (it is in the prompt as context) are not this stretch
        const { text: body, dropped: dr } = dropReproduced(body0, shadow, from);
        dropped += dr;
        const b = trimEnd(body).replace(/\n-{3,}\s*$/, '').trim();
        if (b) acc.push(b);
        if (t.trim() && hasChanges(t)) {
            // a list of changes: the next part reads STATE with the safe ones in; one part keeps the list for the append window
            lastChg = t.trim();
            tail = splitTail(resolveChanges(tail || splitTail(m.text)[1], `${b}\n\n---\n${t}`).text)[1].trim();
        } else if (t.trim()) { tail = t.trim(); lastChg = ''; }
        doneTo = to;
        if (grade) {
            try { grades.push({ from, to, text: String(await askAI(`[RAW LOG]\n${events ? formatExtract(part, g) : raw}\n\n[SUMMARY]\n${out}`, { system: AI_SYS_GRADE, maxTokens: 2500 }) || '').trim() }); }
            catch (e) { grades.push({ from, to, text: String(e?.message || e), error: true }); }
        }
    }
    const outTail = parts.length === 1 && lastChg ? lastChg : tail;
    const text = acc.length ? `${acc.join('\n\n')}${outTail ? `\n\n---\n${outTail}` : ''}` : '';
    return { text, dropped, parts: parts.length, done: error ? parts.findIndex(x => x[x.length - 1].i === doneTo) + 1 : parts.length, doneTo, error, grades };
}

// 2단계 압축: step 1 (정리 모델) writes one line per message, a few messages at a time, marking re-tellings;
// step 2 (초안 모델) writes the sections from that list in one request. 'raw' = the old way, the raw log itself.
export const COMPRESS_MODES = { events: '2단계', raw: '원문 그대로' };
export const compressMode = () => (globalSettings().compressMode === 'raw' ? 'raw' : 'events');
export const EVENTS_MODELS = { ai: 'AI 기능 모델', dr: '초안 모델' };
export const eventsModel = () => (globalSettings().eventsModel === 'dr' ? 'dr' : 'ai');
export const evLabel = () => (eventsModel() === 'dr' ? drLabel() : aiLabel());
const askEvents = (prompt, system) => (eventsModel() === 'dr' ? askDraft(prompt, { system, maxTokens: 8000 }) : askAI(prompt, { system, maxTokens: 8000 }));
// a few messages per request, so each one gets read
export function eventBatches(items, n = 15, cap = 12000) {
    const out = [];
    let cur = [], tok = 0;
    for (const x of items) {
        const t = estTok(x.text) + 8;
        if (cur.length && (cur.length >= n || tok + t > cap)) { out.push(cur); cur = []; tok = 0; }
        cur.push(x); tok += t;
    }
    if (cur.length) out.push(cur);
    return out;
}
// letters and digits only: a quote still counts when the model wrote "..." for "……" or dropped a space or a comma
const normQ = s => String(s).normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
// "[58] = #57; Mara …" + '  "Then give me a reason."' → lines by message number (a message may get two);
// a quote is kept only when that message really has it
export function parseEvents(out, batch) {
    const want = new Map(batch.map(x => [x.i, x]));
    const got = new Map();
    let cur = null;
    for (const line of String(out || '').split('\n')) {
        const h = line.match(/^\s*\[#?(\d+)\]\s*(.*)$/);
        if (h) {
            const n = Number(h[1]);
            if (!want.has(n)) { cur = null; continue; }
            if (!got.has(n)) got.set(n, { n, lines: [], badQ: 0 });
            cur = { text: h[2].trim(), quotes: [] };
            got.get(n).lines.push(cur);
            continue;
        }
        const q = line.match(/^\s+["“「『](.*?)["”」』]?\s*[.,;]?\s*$/);
        if (q && cur) {
            const n = [...got.values()].find(e => e.lines.includes(cur)).n;
            if (normQ(q[1]) && normQ(want.get(n).text).includes(normQ(q[1]))) cur.quotes.push(q[1].trim());
            else got.get(n).badQ++;
        }
    }
    return got;
}
// entries → the list step 2 reads. Out: "—" lines and bare "= #N" lines (a re-telling with nothing new) unless they
// carry a quote; "= #N; what is new" stays as it is, so step 2 sees which moment it adds to
export function eventLines(entries) {
    const out = [];
    let recaps = 0, empty = 0;
    for (const e of entries) {
        for (const l of e.lines) {
            const blank = /^[—–-]*\s*$/.test(l.text), bare = /^=\s*#?\d+\s*[;,:]?\s*$/.test(l.text);
            if ((blank || bare) && !l.quotes.length) { if (bare) recaps++; else empty++; continue; }
            out.push(`[${e.n}] ${blank ? '(no new event)' : l.text}`, ...l.quotes.map(q => `  "${q}"`));
        }
    }
    return { text: out.join('\n'), recaps, empty };
}
// who the story's characters are, so step 1 names them instead of "the god"
const knownNames = (m, items) => {
    const names = castNames(m);
    return names.length ? names.join(', ') : [...new Set(items.map(x => x.name).filter(Boolean))].join(', ') || '(take them from the messages)';
};
export async function eventList({ m, g, items, onStep = () => {} }) {
    const batches = eventBatches(items);
    const system = eventsSystem(LANG_NAME[archiveLang(m.text)]);
    const names = knownNames(m, items);
    const linesOf = es => es.flatMap(e => e.lines.map(l => `[${e.n}] ${l.text}`));
    // a run cut off partway (the tab went to sleep, the connection dropped) picks up after its last finished batch
    const key = evKey(items, g), from = items[0].i, to = items[items.length - 1].i;
    const prog = m.evProgress?.hash === key && m.evProgress.from === from && m.evProgress.to === to ? m.evProgress : null;
    const all = prog ? prog.all : [];
    let badQ = prog ? prog.badQ : 0;
    const missing = prog ? prog.missing : [];
    let earlier = linesOf(all).slice(-15).join('\n');
    for (const [k, b] of batches.entries()) {
        if (prog && k < prog.done) continue;
        onStep(k, batches.length, b[0].i, b[b.length - 1].i);
        const ask = async (part, before) => parseEvents(await askEvents(`KNOWN NAMES: ${names}\n\nEARLIER LINES:\n${before || '(none — this is the start)'}\n\nMESSAGES:\n${formatExtract(part, g)}`, system), part);
        const got = await ask(b, earlier);
        // a message the model skipped: asked for once more on its own (with what this batch has so far), then passed on as it is
        const skip = b.filter(x => !got.has(x.i));
        if (skip.length) {
            const so = [earlier, ...linesOf([...got.values()].sort((x, y) => x.n - y.n))].filter(Boolean).join('\n');
            try { for (const [n, e] of await ask(skip, so)) got.set(n, e); } catch { /* keep what we have */ }
        }
        for (const x of b) {
            const e = got.get(x.i);
            if (e) { all.push(e); badQ += e.badQ; continue; }
            missing.push(x.i);
            all.push({ n: x.i, lines: [{ text: `(not condensed) ${x.name}: ${x.text}`, quotes: [] }], badQ: 0 });
        }
        earlier = linesOf(all).slice(-15).join('\n');
        m.evProgress = { hash: key, from, to, done: k + 1, all, badQ, missing };
        await saveMeta();
    }
    delete m.evProgress;
    const { text, recaps, empty } = eventLines(all);
    return { text, recaps, empty, badQ, missing, n: items.length, batches: batches.length };
}
// step 1's list is kept with the chat for its range, so step 2 can run again without paying for step 1
const evKey = (items, g) => textHash(formatExtract(items, g));
export function savedEvents(m, items, g) {
    const e = m.lastEvents;
    return e && items.length && e.from === items[0].i && e.to === items[items.length - 1].i && e.hash === evKey(items, g) && e.text ? e : null;
}
// step 2 alone: the sections from a list
export function sectionsFromEvents(args, ev) {
    return draftCompress({ ...args, onStep: () => {}, events: eventsNote() + ev.text });
}
// the one entry for both buttons: 2단계 by default, the raw log when 압축 → 설정 says so.
// reuse: a saved step-1 list for this exact range (same messages) is used instead of making a new one
export async function compressDraft(args, { reuse = false } = {}) {
    if (compressMode() === 'raw') return draftCompress(args);
    const { m, g, items, onStep = () => {} } = args;
    let ev = reuse ? savedEvents(m, items, g) : null;
    if (!ev) {
        try { ev = await eventList({ m, g, items, onStep: (k, total, a, b) => onStep(k, total, a, b, 'events') }); }
        catch (e) { return { text: '', dropped: 0, parts: 1, done: 0, doneTo: null, error: e, grades: [] }; }
        m.lastEvents = { ...ev, from: items[0].i, to: items[items.length - 1].i, hash: evKey(items, g), at: Date.now() };
        await saveMeta();
    }
    onStep(0, 1, items[0].i, items[items.length - 1].i, 'sections');
    const r = await sectionsFromEvents(args, ev);
    return { ...r, events: ev };
}

// several parts' grades in one box: "#0–#40" headings above each part's lines
const joinGrades = gs => {
    if (!gs.length) return { grade: '', gradeError: false };
    if (gs.length === 1) return { grade: gs[0].text, gradeError: !!gs[0].error };
    const bad = gs.filter(x => !/^\s*문제 없음\.?\s*$/.test(x.text));
    return { grade: bad.length ? bad.map(x => `[#${x.from}–#${x.to}]${x.error ? ' 채점 못 함:' : ''}\n${x.text}`).join('\n\n') : '문제 없음', gradeError: false };
};

// One button: the next range → the draft model (with the wizard's instruction, and the AU block in an AU chat)
// → 아카이브에 추가 with the summary filled in. Its checks, the boundary and the hide step stay.
let quickBusy = false, quickBound = false, quickMemo = '', quickReuse = false;
export async function quickCompress() {
    if (quickBusy) return toastr.info('요약을 받는 중이에요.');
    const c = ctx(), m = getMeta(), g = globalSettings();
    if (!draftReady()) return toastr.info('⚙ 설정 → AI · 번역 → 초안 모델을 먼저 정해 주세요.', '한 번에 압축');
    let { from, to, last, after } = nextRange(c, m, { afterExport: false });
    // the archive's sections stop before the boundary (a summary that fell short): offer to pick up the gap
    const covered = lastRangeEnd(m.text);
    let gapTo = -1;
    if (covered !== null && covered < m.boundary && covered + 1 <= last) {
        if (await confirm('빠진 구간', `경계선은 <b>#${m.boundary}</b>인데 아카이브 섹션은 <b>#${covered}</b>까지예요. <b>#${covered + 1}–#${m.boundary}</b>가 요약에 없어요.<br>#${covered + 1}부터 압축할까요? (숨긴 메시지도 이 구간은 넣어요)<br><small>아니요를 누르면 경계선 다음(#${m.boundary + 1})부터 해요.</small>`)) {
            from = covered + 1; after = covered; gapTo = m.boundary;
            to = Math.max(to, from);
        }
    }
    if (after >= last || to < from || after + 1 > last - Math.max(0, Number(m.keep) || 0)) return toastr.info(`${m.boundary >= 0 ? `경계선 #${m.boundary} 뒤에` : '이 채팅에'} 압축할 메시지가 없어요 (메시지 ${last + 1}개 · 마지막 ${m.keep}개는 남겨요).`, '한 번에 압축');
    // a summary that came back but never went in (the tab slept, the window was closed): offer it before paying again
    const pend = m.pendingDraft;
    if (pend?.text && pend.from === from) {
        if (await confirm('받아 둔 요약', `<b>#${pend.from}–#${pend.to}</b> 요약을 ${esc(timeLabel(pend.at))}에 받아 놓고 아직 안 넣었어요.<br><b>이걸로 아카이브에 추가 창을 열까요?</b><br><small>아니요를 누르면 새로 받아요 (초안 모델 1번)</small>`)) {
            await openAppend({ text: pend.text, end: guessEndNumber(pend.text) ?? pend.to, expectTo: pend.to, events: pend.events });
            if ((getMeta().boundary ?? -1) >= pend.to) { delete getMeta().pendingDraft; await saveMeta(); }
            return;
        }
    }
    const { items, raw } = rangeRaw(c, g, from, to, gapTo);
    if (!raw) return toastr.info('이 범위에 메시지가 없어요.', '한 번에 압축');
    const p = g.prompts.find(x => x.id === g.wizPrompt) || activePrompt(g);
    const au = auOf(m);
    const two = compressMode() === 'events';
    const saved = two ? savedEvents(m, items, g) : null;
    const n = two ? eventBatches(items).length : chunkItems(items).length;
    const ce = compressEffort();
    // the 채점 box lives in the confirm dialog; its state is remembered as soon as it changes
    if (!quickBound) {
        quickBound = true;
        $(document).on('change', '.na_qc_grade', function () { const gg = globalSettings(); gg.quickGrade = this.checked; saveGlobal(); });
        $(document).on('input', '.na_qc_memo', function () { quickMemo = this.value; });
        $(document).on('change', '.na_qc_reuse', function () { quickReuse = this.checked; });
    }
    quickMemo = ''; quickReuse = !!saved;
    const short = l => String(l).replace(/^(커스텀|Vertex) · /, '');
    const effort = ce === 'conn' ? '연결 설정' : { high: '높게', medium: '보통', low: '낮게' }[ce] || ce;
    const row = (k, v, sub = '') => `<div class="na_qc_row"><span>${k}</span><b>${v}${sub ? `<small>${sub}</small>` : ''}</b></div>`;
    const rows = [
        ...(two ? [
            saved && quickReuse ? row('1단계 정리', '저장된 목록', esc(timeLabel(saved.at))) : row('1단계 정리', esc(short(evLabel())), `15개씩 ${n}번`),
            row('2단계 요약', esc(short(drLabel())), '한 번'),
        ] : [row('요약', esc(short(drLabel())), n > 1 ? `${n}번에 나눠 · 약 ${fmt(chunkTok())} 토큰씩` : '한 번에')]),
        row('지시문', esc(p.name), `생각 ${effort}${p.id === 'basic' && p.text !== BASIC_PROMPT ? ' · <span class="na_qc_warn">고친 버전이라 최신 기본 규칙이 안 들어가 있어요</span>' : ''}`),
        ...(au.on ? [row('AU', esc(au.name), '본편 뒤에 이어서')] : []),
    ];
    if (!await confirm('한 번에 압축', `<div class="na_qc">
        <div class="na_qc_head"><b>#${from} – #${to}</b><small>메시지 ${items.length}개 · 원문 약 ${fmt(estTok(raw))} 토큰</small></div>
        <div class="na_qc_rows">${rows.join('')}</div>
        ${to < last ? `<small class="na_qc_note">마지막 ${last - to}개(${last === to + 1 ? `#${last}` : `#${to + 1}–#${last}`})는 지금 장면이라 남겨요</small>` : ''}
        ${!two && n <= 1 && estTok(raw) > 60000 ? '<small class="na_qc_note">원문이 길어서 중간을 훑을 수 있어요 · 압축 → 설정 → 나눠 보내기</small>' : ''}
        <textarea class="text_pole na_qc_memo" rows="2" placeholder="이번 압축 메모 (선택) · 예: #40–#140은 정사 파트, 관계 변화만 한두 줄로"></textarea>
        ${saved ? `<label class="checkbox_label na_qc_check"><input type="checkbox" class="na_qc_reuse" checked><span>저장된 1단계 목록 쓰기<small>메시지가 그대로라 2단계만 다시 해요</small></span></label>` : ''}
        <label class="checkbox_label na_qc_check"><input type="checkbox" class="na_qc_grade" ${g.quickGrade ? 'checked' : ''}><span>채점도 같이<small>${esc(short(aiLabel()))}가 원문과 대조 · 비용 추가</small></span></label>
      </div>`)) return;
    quickBusy = true;
    const runMemo = quickMemo;
    const toast = toastr.info(`#${from}–#${to} 요약하는 중… 이 탭에 있어야 끝까지 받아요`, '한 번에 압축', { timeOut: 0, extendedTimeOut: 0, tapToDismiss: false });
    let r;
    try {
        // a held Web Lock keeps Chrome from freezing the tab while it waits (it can still be discarded)
        const held = fn => (navigator.locks?.request ? navigator.locks.request('na-compress', fn) : fn());
        r = await held(() => compressDraft({ m, g, p, items, grade: !!globalSettings().quickGrade, memo: runMemo,
            onStep: (k, total, a, b, stage) => {
                const msg = stage === 'events' ? `1단계 정리 #${a}–#${b} (${k + 1}/${total})` : stage === 'sections' ? `2단계 섹션 쓰는 중 #${a}–#${b}` : total > 1 ? `#${a}–#${b} 요약하는 중… (${k + 1}/${total})` : '';
                if (msg) $(toast).find('.toast-message').text(`${msg} · 이 탭에 있어야 끝까지 받아요 (다른 탭·앱으로 가면 끊길 수 있어요)`);
            } }, { reuse: quickReuse }));
    } finally { quickBusy = false; toastr.clear(toast); }
    if (r.error) {
        console.error('[NarrativeArchive] quick compress', r.error);
        toastr.error(String(r.error?.message || r.error), r.doneTo === null ? '한 번에 압축 실패' : `${r.done}/${r.parts}까지 하고 멈췄어요 · #${r.doneTo}까지만 추가 창에 넣어요`);
        if (r.doneTo === null) return;
    }
    const text = auFix(r.text, m);
    if (r.dropped) toastr.info(`모델이 아카이브에 이미 있는 섹션 ${r.dropped}개를 다시 써 와서 뺐어요.`, '한 번에 압축');
    if (!text) return toastr.warning('초안 모델이 빈 답을 줬어요.', '한 번에 압축');
    const upto = r.error ? r.doneTo : to;
    m.lastExport = { from, to: upto, at: Date.now(), how: 'draft' };
    // kept until it goes in, so a lost tab does not cost another request
    m.pendingDraft = { text, from, to: upto, at: Date.now(), events: r.events || null };
    await saveMeta();
    refreshStatus();
    // 2단계만 다시: the same list, prompt and note, a new answer from the draft model
    const rerun = r.events && !r.error ? async () => {
        const r2 = await sectionsFromEvents({ m: getMeta(), g, p, items, memo: runMemo }, r.events);
        if (r2.error) throw r2.error;
        return auFix(r2.text, getMeta());
    } : null;
    await openAppend({ text, end: guessEndNumber(text) ?? upto, expectTo: upto, events: r.events, rerun, ...joinGrades(r.grades) });
    if ((getMeta().boundary ?? -1) >= upto) { delete getMeta().pendingDraft; await saveMeta(); }
}

export async function openWizard() {
    const c = ctx();
    const m = getMeta();
    const g = globalSettings();
    const last = (c.chat?.length || 0) - 1;
    const { from: defFrom, to: defTo } = nextRange(c, m);
    const STEPS = [
        { name: '범위', title: '어디부터 어디까지<br>압축할까요?', sub: '경계선 다음부터 자동으로 채웠어요' },
        { name: '복사', title: '압축할 모델에<br>넘겨 주세요', sub: '지시문과 함께 복사하거나 .txt로 저장해요' },
        { name: '붙여넣기', title: '모델이 준 섹션을<br>붙여넣어 주세요', sub: '파일(.txt·.md)도 돼요' },
        { name: '채점', title: '원문과 맞는지<br>볼까요?', sub: '선택 · 지어낸 것·빠진 것·틀린 것을 찾아요' },
        { name: '추가', title: '검사하고<br>아카이브에 넣어요', sub: '번호 검사 · 미리보기를 거쳐 추가하고 끝 번호까지 숨겨요' },
    ];
    let step = 0;
    const $root = $(`
      <div class="na_popup na_v2 na_wiz2">
        <div class="na_wz2_top"><b>압축 마법사</b><span class="na_wz2_count"></span></div>
        <div class="na_wz2_progress">${STEPS.map((x, i) => `<button type="button" data-s="${i}"><i></i><span>${x.name}</span></button>`).join('')}</div>
        <div class="na_wz2_head"><b class="na_wz2_title"></b><small class="na_wz2_sub"></small></div>
        <div class="na_wz2_pane" data-s="0">
          <div class="na_wz2_range">
            <label><small>부터</small><span>#<input type="number" class="text_pole na_wz_from" min="0" max="${last}" value="${defFrom}"></span></label>
            <span class="na_wz2_arr">${svgA('M5 12h14M13 6l6 6-6 6', 18)}</span>
            <label><small>까지</small><span>#<input type="number" class="text_pole na_wz_to" min="0" max="${last}" value="${defTo}"></span></label>
          </div>
          <label class="na_v2_card na_v2_switchrow"><span>숨긴 메시지 빼기</span><input type="checkbox" class="na_toggle na_wz_hidden"></label>
          <small class="na_v2_note na_wz_info"></small>
          ${auOf(m).on ? `<small class="na_v2_note na_wz_austate">${svgA(ICO_A.check, 12, 3)} <b>AU 채팅</b> · 요약이 본편 뒤 <b>${esc(auOf(m).name)}</b> 묶음으로 이어져요 (도구 → AU 채팅)</small>` : ''}
        </div>
        <div class="na_wz2_pane" data-s="1">
          <select class="text_pole na_wz_prompt"></select>
          <div class="na_v2_row2"><button type="button" class="na_v2_btn na_wz_save">.txt 저장</button><button type="button" class="na_v2_btn primary na_wz_copy">${svgA('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', 16)}<span>복사</span></button></div>
          <small class="na_v2_note na_wz_copied"></small>
        </div>
        <div class="na_wz2_pane" data-s="2">
          <textarea class="text_pole na_wz_out" rows="10" spellcheck="false" placeholder="## #시작–#끝 — 제목 (날짜, 장소)&#10;PLOT:&#10;- …"></textarea>
          <div class="na_wz2_chips na_wz_outinfo"></div>
          <div class="na_v2_row2">
            <button type="button" class="na_v2_btn na_wz_file_btn">${svgA('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>', 15)}파일 불러오기</button>
            ${draftReady() ? `<button type="button" class="na_v2_btn na_wz_draftbtn" title="${esc(drLabel())}">${svgA('M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z', 15)}초안 모델로 받기</button>` : ''}
          </div>
          <input type="file" class="na_wz_file" accept=".txt,.md,.markdown,text/plain,text/markdown" hidden>
        </div>
        <div class="na_wz2_pane" data-s="3">
          <button type="button" class="na_v2_btn wide na_wz_grade">${svgA('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14l2 2 4-4"/>', 16)}AI로 채점</button>
          <div class="na_ai_box na_wz_gradeout" hidden></div>
        </div>
        <div class="na_wz2_pane" data-s="4">
          <div class="na_v2_card na_wz2_sum"></div>
        </div>
        <span class="na_wz2_fill"></span>
        <div class="na_wz2_nav">
          <button type="button" class="na_v2_btn na_wz2_prev">이전</button>
          <button type="button" class="na_v2_btn primary na_wz2_next"></button>
        </div>
        <button type="button" class="na_linkbtn na_wz2_skip">채점 건너뛰고 바로 추가</button>
      </div>`);
    const nextLabel = ['다음 · 복사', '다음 · 붙여넣기', '다음 · 채점', '다음 · 추가', '아카이브에 추가 창 열기'];
    const show = () => {
        $root.find('.na_wz2_count').text(`${step + 1} / ${STEPS.length}`);
        $root.find('.na_wz2_progress button').each(function () { const i = Number(this.dataset.s); $(this).toggleClass('done', i < step).toggleClass('on', i === step); });
        $root.find('.na_wz2_title').html(STEPS[step].title);
        // the paste step names the range it is for: "#35–#58을 압축한 결과 · …"
        const r0 = range();
        $root.find('.na_wz2_sub').text(step === 2 ? `#${r0.from}–#${r0.to}${josaA(r0.to)} 압축한 결과 · ${STEPS[step].sub}` : STEPS[step].sub);
        $root.find('.na_wz2_pane').each(function () { this.hidden = Number(this.dataset.s) !== step; });
        $root.find('.na_wz2_prev').prop('hidden', step === 0);
        $root.find('.na_wz2_next').text(nextLabel[step]);
        $root.find('.na_wz2_skip').prop('hidden', step !== 2 && step !== 3);
        if (step === 4) {
            const v = $root.find('.na_wz_out').val().trim(), n = guessEndNumber(v), r = range();
            $root.find('.na_wz2_sum').html(`<div class="na_wz2_sumrow"><span>범위</span><b>#${r.from} – #${r.to}</b></div><div class="na_wz2_sumrow"><span>새 섹션</span><b>${parseSections(v).filter(x => !x.group && !/^(?:STATE|OPEN)\b/.test(x.title)).length}개</b></div><div class="na_wz2_sumrow"><span>끝 번호</span><b>${n !== null ? `#${n}` : '추가 창에서 정해요'}</b></div>`);
        }
    };
    const go = to => {
        if (to > 2 && !$root.find('.na_wz_out').val().trim()) { step = 2; show(); return toastr.info('먼저 모델이 준 결과를 붙여넣어 주세요.'); }
        step = Math.max(0, Math.min(STEPS.length - 1, to)); show();
    };
    $root.on('click', '.na_wz2_progress button', function () { go(Number(this.dataset.s)); });
    $root.find('.na_wz2_prev').on('click', () => go(step - 1));
    $root.find('.na_wz2_next').on('click', () => { if (step === STEPS.length - 1) $root.find('.na_wz_add').trigger('click'); else go(step + 1); });
    $root.find('.na_wz2_skip').on('click', () => go(4));
    $root.append('<button type="button" class="na_wz_add" hidden></button>');
    // last choice is remembered; "__none" copies the raw log only
    $root.find('.na_wz_prompt').html(`<option value="__none">지시문 없이 (원문만)</option>${g.prompts.map(p => `<option value="${esc(p.id)}">지시문: ${esc(p.name)}${p.fav ? ' ★' : ''}</option>`).join('')}`)
        .val(g.prompts.some(p => p.id === g.wizPrompt) ? g.wizPrompt : '__none'); // default: raw only
    $root.find('.na_wz_prompt').on('change', function () { g.wizPrompt = this.value; saveGlobal(); });
    // shared with 압축 → 설정 → 원문 뽑기
    $root.find('.na_wz_hidden').prop('checked', !!g.skipHidden).on('change', function () { g.skipHidden = this.checked; saveGlobal(); renderPromptSettings(); build(); });
    const range = () => {
        const from = Math.max(0, parseInt($root.find('.na_wz_from').val(), 10) || 0);
        const to = Math.min(last, parseInt($root.find('.na_wz_to').val(), 10));
        return { from, to: Number.isFinite(to) ? to : last };
    };
    let raw = '', full = '', items = [];
    const vars = () => { const { from, to } = range(); return { raw, from: String(from), to: String(to), last_section: referenceSection(m.text), state: splitTail(m.text)[1].trim() || '(없음)', archive: m.text }; };
    const build = async () => {
        const { from, to } = range();
        const all = buildExtract(from, to);
        const hiddenOut = g.skipHidden ? all.filter(x => c.chat[x.i]?.is_system).length : 0;
        items = all.filter(x => !(g.skipHidden && c.chat[x.i]?.is_system)).map(x => ({ ...x, text: cleanMessage(x.text, g) })).filter(x => x.text);
        raw = formatExtract(items, g);
        const pid = $root.find('.na_wz_prompt').val();
        const p = pid === '__none' ? null : (g.prompts.find(x => x.id === pid) || activePrompt(g));
        full = p ? compressPrompt(p.text, vars(), m) : raw;
        $root.find('.na_wz_copy span').text(p ? '지시문과 함께 복사' : '원문만 복사');
        $root.find('.na_wz_info').text(items.length ? `메시지 ${items.length}개${hiddenOut ? ` (숨긴 ${hiddenOut}개 뺌)` : ''} · 원문 약 ${fmt(await countTokens(raw))} 토큰${p ? ` · 지시문까지 약 ${fmt(await countTokens(full))} 토큰` : ''}` : '이 범위에 메시지가 없어요.');
    };
    let t;
    $root.find('.na_wz_from, .na_wz_to, .na_wz_prompt').on('input change', () => { clearTimeout(t); t = setTimeout(build, 250); });
    const remember = async how => { const { from, to } = range(); m.lastExport = { from, to, at: Date.now(), how }; await saveMeta(); refreshStatus(); };
    $root.find('.na_wz_copy').on('click', async () => {
        await build();
        if (!raw) return toastr.info('범위에 메시지가 없어요.');
        const ok = await copyText(full, $root.find('.na_wz_out')[0]);
        if (ok) { await remember('copy'); $root.find('.na_wz_copied').text(`복사했어요 · ${timeLabel(Date.now())}`); toastr.success('복사됨 · 압축할 모델에 붙여넣으세요'); } else toastr.warning('복사가 막혀 있어요. .txt 저장을 써 주세요.');
    });
    $root.find('.na_wz_draftbtn').on('click', async function () {
        await build();
        if (!raw) return toastr.info('범위에 메시지가 없어요.');
        const $out = $root.find('.na_wz_out');
        if ($out.val().trim() && !await confirm('초안 모델로 받기', '붙여넣은 내용을 새 초안으로 바꿀까요?')) return;
        // long ranges go in parts, like 한 번에 압축
        const pid = $root.find('.na_wz_prompt').val();
        const p = g.prompts.find(x => x.id === pid) || activePrompt(g);
        const $b = $(this);
        const r = await withSpinner($b, '쓰는 중… 창을 닫지 마세요', () => compressDraft({ m, g, p, items,
            onStep: (k, total, a, b, stage) => {
                const msg = stage === 'events' ? `1단계 정리 ${k + 1}/${total}` : stage === 'sections' ? '2단계 섹션 쓰는 중' : total > 1 ? `쓰는 중… ${k + 1}/${total}` : '';
                if (msg) $b.html(`<i class="fa-solid fa-spinner fa-spin"></i> ${msg}`);
            } }));
        if (!r) return;
        if (r.error) toastr.error(String(r.error?.message || r.error), r.doneTo === null ? '초안 모델 실패' : `${r.done}/${r.parts}까지 하고 멈췄어요 · #${r.doneTo}까지만 채웠어요`);
        if (!r.text) return;
        if (r.dropped) toastr.info(`모델이 아카이브에 이미 있는 섹션 ${r.dropped}개를 다시 써 와서 뺐어요.`);
        $out.val(auFix(r.text, m)).trigger('input');
        await remember('draft');
        toastr.success(r.parts > 1 ? `${r.parts}번에 나눠 받은 초안을 채웠어요. 확인하고 다음으로 넘어가세요.` : '초안을 채웠어요. 확인하고 다음으로 넘어가세요.');
    });
    $root.find('.na_wz_save').on('click', async () => { await build(); if (!raw) return; const { from, to } = range(); download(`원문_${chatLabel()}_${from}-${to}.txt`, full); remember('txt'); });
    $root.find('.na_wz_file_btn').on('click', () => $root.find('.na_wz_file').val('').trigger('click'));
    $root.find('.na_wz_file').on('change', async function () {
        const file = this.files?.[0];
        if (!file) return;
        const text = (await file.text()).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
        if (!text) return toastr.warning('빈 파일이에요.');
        const $out = $root.find('.na_wz_out');
        if ($out.val().trim() && !await confirm('불러오기', '붙여넣은 내용을 이 파일 내용으로 바꿀까요?')) return;
        $out.val(text).trigger('input');
        toastr.success(`불러옴: ${file.name}`);
    });
    $root.find('.na_wz_out').on('input', function () {
        const v = this.value.trim();
        const n = guessEndNumber(v);
        const secsN = parseSections(v).filter(x => !x.group && !/^(?:STATE|OPEN)\b/.test(x.title)).length, hasState = /^# STATE\b/m.test(v);
        // "섹션 2개 · #35–#58 이어짐": the numbered headings' span, and whether they follow on without a gap
        const rs = headingRanges(v).map(x => ({ a: Math.min(x.from, x.to), b: Math.max(x.from, x.to) })).sort((x, y) => x.a - y.a);
        const joined = rs.length && rs.every((x, i) => !i || x.a === rs[i - 1].b + 1);
        const span = rs.length ? ` · #${rs[0].a}–#${Math.max(...rs.map(x => x.b))}${joined ? ' 이어짐' : ' · 사이가 빔'}` : n !== null ? ` · 끝 #${n}` : '';
        const ok = secsN && (!rs.length || joined);
        const chk = svgA(ICO_A.check, 12, 3);
        countTokens(v).then(tk => $root.find('.na_wz_outinfo').html(v ? `<span class="${ok ? 'ok' : secsN ? 'warn' : ''}">${ok ? chk : ''}섹션 ${secsN}개${span}</span>${hasState ? `<span class="ok">${chk}STATE·OPEN</span>` : ''}<span>${fmt(tk)} 토큰</span>` : ''));
        $root.find('.na_wz_gradeout').prop('hidden', true);
    });
    $root.find('.na_wz_grade').on('click', async function () {
        const sum = $root.find('.na_wz_out').val().trim();
        if (!sum) return toastr.info('먼저 결과를 붙여넣어 주세요.');
        await build();
        const out = await withSpinner($(this), '채점하는 중…', () => askAI(`[RAW LOG]\n${raw}\n\n[SUMMARY]\n${sum}`, { system: AI_SYS_GRADE, maxTokens: 2500 }));
        if (out === null) return;
        const ok = /^\s*문제 없음\.?\s*$/.test(out);
        $root.find('.na_wz_gradeout').prop('hidden', false).toggleClass('na_ai_ok', ok)
            .html(ok ? '<i class="fa-solid fa-circle-check"></i> 원문과 잘 맞아요' : `<div class="na_ai_box_head"><i class="fa-solid fa-clipboard-check"></i> 채점 <span class="na_dim">· 참고용</span></div>${driftHtml(out, m)}`);
    });
    $root.on('click', '.na_cite_msg', function () { const n = Number(this.dataset.msg); openSource(n, n, `#${n}`); });
    $root.find('.na_wz_add').on('click', () => {
        const text = $root.find('.na_wz_out').val().trim();
        if (!text) { go(2); return toastr.info('먼저 결과를 붙여넣어 주세요.'); }
        const n = guessEndNumber(text);
        $root.closest('dialog').find('.popup-button-ok').trigger('click');
        setTimeout(() => openAppend({ text, end: n ?? range().to }), 50);
    });
    show();
    await build();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}
