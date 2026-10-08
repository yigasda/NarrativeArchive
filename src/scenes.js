// 장면별 압축: the range is cut into scenes of about 20–30 messages (at the tracker's date / place / time jumps, just
// before a user turn), and each scene gets its own request for exactly ONE section. The extension writes the heading
// numbers, so they can't gap or overlap. Each request sees: that scene's raw log on top, the section written just before
// it (so the same moment is not counted twice), the archive's last sections for style, STATE, and the work note.
// STATE · OPEN are updated once at the end, from the new sections, as change lists.

import { aiLabel, askAI, askCompress, drLabel } from './ai.js';
import { ctx, getMeta, globalSettings, saveMeta } from './core.js';
import { formatExtract } from './extract.js';
import { activePrompt, auBlock, auOf, fillPrompt, langBlock, memoBlock } from './prompts.js';
import { RANGE_HEAD, headingRanges, parseSections, splitTail, trimEnd } from './sections.js';
import { esc } from './util.js';

export const SCENE_SIZES = { 20: '작게 · 약 20개씩', 30: '보통 · 약 30개씩', 40: '크게 · 약 40개씩' };
export const sceneSize = () => { const v = Number(globalSettings().sceneSize); return v in SCENE_SIZES ? v : 30; };
export const SCENE_MODELS = { dr: '초안 모델', ai: 'AI 기능 모델' };
export const sceneModel = () => (globalSettings().sceneModel === 'ai' ? 'ai' : 'dr');
export const stateModel = () => (globalSettings().stateModel === 'ai' ? 'ai' : 'dr');
export const sceneModelLabel = k => (k === 'ai' ? aiLabel() : drLabel());
const ask = (which, prompt, system = '') => (which === 'ai' ? askAI(prompt, { system, maxTokens: 12000 }) : askCompress(prompt, { system }));

// "<tracker> 🌇 05:48 오후 | 하티르 여드렛날, 2년 | 옴보스 → 서쪽 별채 | ☀️ 맑음 </tracker>": time | date | place.
// Named groups time / date / place; an empty setting means no tracker (cut by message count only).
export const DEFAULT_TRACKER_RE = String.raw`<tracker>[^|]*?(?<time>\d{1,2}:\d{2}\s*(?:오전|오후|AM|PM|am|pm)?)?[^|]*\|\s*(?<date>[^|]+?)\s*\|\s*(?<place>[^|<]+?)\s*(?:\||</tracker>)`;
export const trackerRe = () => { const v = globalSettings().trackerRe; return v === undefined || v === null ? DEFAULT_TRACKER_RE : String(v); };
const minutes = t => {
    const mt = String(t || '').match(/(\d{1,2}):(\d{2})\s*(오전|오후|AM|PM|am|pm)?/);
    if (!mt) return null;
    let h = Number(mt[1]) % 12;
    if (/오후|PM|pm/.test(mt[3] || '')) h += 12; else if (!mt[3]) h = Number(mt[1]);
    return h * 60 + Number(mt[2]);
};
function readTracker(text, re) {
    if (!re) return null;
    const mt = String(text || '').match(re);
    if (!mt) return null;
    const gr = mt.groups || {};
    const parts = String(gr.place || '').split(/\s*(?:→|->|>|\/|·)\s*/).filter(Boolean);
    return { date: String(gr.date || '').trim(), city: parts[0] || '', room: parts[1] || '', min: minutes(gr.time) };
}
// how much the story moved between two trackers: 2 = new day, new place or a jump of 3+ hours; 1 = new room; 0 = same scene
function sceneJump(a, b) {
    if (!a || !b) return 0;
    if ((a.date && b.date && a.date !== b.date) || (a.city && b.city && a.city !== b.city)) return 2;
    if (a.min !== null && b.min !== null && Math.abs(b.min - a.min) >= 180) return 2;
    return a.room && b.room && a.room !== b.room ? 1 : 0;
}

// items (in order) → [[items], …]; cuts only just before a user turn, so a reply stays with the turn it answers
export function sceneChunks(items, { size = sceneSize(), re = trackerRe(), chat = ctx().chat || [] } = {}) {
    let rx = null;
    try { rx = re ? new RegExp(re, 's') : null; } catch { rx = null; }
    const min = Math.max(6, Math.round(size * 0.5)), mid = Math.round(size * 0.75), max = Math.round(size * 1.3);
    const trk = items.map(x => readTracker(chat[x.i]?.mes, rx));
    const isUser = k => !!chat[items[k].i]?.is_user;
    // the last tracker before k, and the first from k on
    const before = k => { for (let j = k - 1; j >= 0; j--) if (trk[j]) return trk[j]; return null; };
    const after = k => { for (let j = k; j < items.length; j++) if (trk[j]) return trk[j]; return null; };
    const jumps = items.map((_, k) => (k && isUser(k) ? sceneJump(before(k), after(k)) : 0));
    // a real scene change a little further on (still within the hard cap) is a better place to cut than the size mark
    const changeAhead = (k, start) => { for (let j = k + 1; j < items.length && j - start <= max; j++) if (jumps[j] === 2) return true; return false; };
    const out = [];
    let start = 0, lastUserCut = -1;
    for (let k = 1; k < items.length; k++) {
        const len = k - start;
        if (isUser(k) && len >= min) lastUserCut = k;
        if (!isUser(k)) {
            if (len >= max) { const at = lastUserCut > start ? lastUserCut : k; out.push(items.slice(start, at)); start = at; lastUserCut = -1; }
            continue;
        }
        const jump = jumps[k];
        if ((jump === 2 && len >= min) || (jump === 1 && len >= mid) || (len >= size && !changeAhead(k, start))) { out.push(items.slice(start, k)); start = k; lastUserCut = -1; }
    }
    out.push(items.slice(start));
    // a last scrap folds into the scene before it
    if (out.length > 1 && out[out.length - 1].length < min && out[out.length - 2].length + out[out.length - 1].length <= max) {
        const tail = out.pop(); out[out.length - 1] = out[out.length - 1].concat(tail);
    }
    return out.filter(x => x.length);
}

// the archive's last few numbered sections, whole (style and continuity; marked as already written)
export function lastSections(text, n) {
    const t = splitTail(String(text || ''))[0];
    const secs = parseSections(t).filter(x => !x.group && RANGE_HEAD.test(x.title)).slice(-n);
    return secs.map(x => trimEnd(t.slice(x.start, x.end)).replace(/\n-{3,}\s*$/, '').trim());
}

// a scene's answer → one or two sections; their numbers are checked against the scene: the first starts at its first
// message, the last ends at its last, no gap or overlap between. A split the model numbered wrong is put back to one section.
export function parseSceneAnswer(out, from, to) {
    const secs = answerBlocks(out).slice(0, 2);
    if (!secs.length) return [];
    if (secs.length === 2) {
        const cut = secs[1].a;
        // the split must fall inside the scene; anything else goes back to one section
        if (Number.isFinite(cut) && cut > from && cut <= to) return [{ ...secs[0], a: from, b: cut - 1 }, { ...secs[1], a: cut, b: to }];
        return [{ title: secs[0].title, a: from, b: to, bullets: [...secs[0].bullets, ...secs[1].bullets].slice(0, 6) }];
    }
    return [{ ...secs[0], a: from, b: to }];
}
// an answer's section blocks: [{ title, a, b, bullets }] (a / b null when the heading has no numbers); blocks without bullets are left out
export function answerBlocks(out) {
    // line breaks some relays send as \r or U+2028, and a heading glued to the end of the bullet before it
    const t = String(out || '').replace(/\r\n?|[\u2028\u2029]/g, '\n')
        .replace(/([^\n])[ \t]*(#{2,3}[ \t]+(?:\S{1,12}[ \t])?#\d+[ \t]*[–—~-][ \t]*#?\d+)/g, '$1\n$2')
        .replace(/^```[a-z]*\n?|```\s*$/g, '').trim();
    const blocks = [];
    let cur = null;
    for (const line of t.split('\n')) {
        const h = line.match(/^\s*(?:TITLE\s*:|#{1,3})\s*(.*)$/i);
        if (h && !/^\s*[-*•]\s/.test(line)) {
            let title = h[1].trim(), a = null, b = null;
            const r = title.match(RANGE_HEAD);
            if (r) { a = Math.min(+r[2], +r[4]); b = Math.max(+r[2], +r[4]); title = r[5].replace(/^\s*[—–-]\s*/, '').trim(); }
            cur = { title, a, b, bullets: [] };
            blocks.push(cur);
            continue;
        }
        if (/^\s*[-*•]\s/.test(line)) {
            if (!cur) { cur = { title: '', a: null, b: null, bullets: [] }; blocks.push(cur); }
            cur.bullets.push(`- ${line.replace(/^\s*[-*•]\s*/, '').trim()}`);
        }
    }
    return blocks.filter(x => x.bullets.length);
}

const SCENE_ASK = (from, to, prefix) => `[THIS REQUEST]
Write the section for #${from}–#${to}, the raw log in <raw_log>, following <rules> (ignore what they say about output parts, change lists, scene lists and section counts: here you write the section for this scene and nothing else).
- Usually ONE section. Write TWO only when the story clearly turns inside this scene; then the first covers #${from} up to the turn and the second from the turn to #${to}, with no gap.
- <previous_section> is already written and ends right before #${from}: do not repeat its events; carry on from where it stops.
- Title: a quoted-line title only if no title in <previous_section> is one; otherwise pick another shape.
- <recent_archive> and <current_state> are context only: nothing in them goes into this section unless <raw_log> shows it happening.
- <style_sample>, when present, is the voice to write in: how long its sentences run, how it quotes, how it names feelings. Take its voice, never its events. Without it, follow the voice of <recent_archive>.
- The line that turns a scene is quoted, not referred to. Vary sentence shape: a short sentence after a long one, no chain of "-ing" clauses.
- <work_note>, when present, is the user's own notes on this story (canon, lines to keep, past mistakes). Follow it.
Output only, for each section:
## #<first>–#<last> — <title> (<date>, <place>)
PLOT:
- <bullet>
- <bullet>
(The extension adds the log prefix${prefix ? ` "${prefix}"` : ''} and checks that the sections cover #${from}–#${to} exactly.)`;

// 장면 나누기: the AI 기능 모델 reads the whole stretch once and names where the story turns
const SCENES_SYS = `GOAL
Find where the story turns in a stretch of role-play, so it can be summarized scene by scene.

YOU GET
MESSAGES: each starts with [number] and the speaker. The bot plays every non-user character under one name tag.

STEPS
1. Read to the end.
2. A new scene starts where the story turns: time or place changes, the mood flips, a conflict breaks out or settles, someone arrives or leaves, a decision is made, a secret comes out. Not every exchange: a scene usually runs 10–40 messages, but a sharp turn can be 3–5.
3. When a change begins with a user's message, the scene starts at that message.

OUTPUT
One line per scene, in order: "#<its first message> <what the scene is, under 10 words>". The first line starts at the first message. Nothing else.`;

// "#23 Set leaves Ombos" lines → [{ start, note }] inside the range, first at its start
export function parseScenes(out, from, to) {
    const seen = new Map();
    for (const line of String(out || '').split('\n')) {
        const mt = line.match(/^\s*[-*•]?\s*#?(\d+)(?:\s*[–—~-]\s*#?\d+)?\s*[:.)·|-]?\s*(.*)$/);
        if (!mt) continue;
        const n = Number(mt[1]);
        if (n < from || n > to || seen.has(n)) continue;
        seen.set(n, mt[2].trim());
    }
    if (!seen.has(from)) seen.set(from, '');
    return [...seen.entries()].sort((x, y) => x[0] - y[0]).map(([start, note]) => ({ start, note }));
}
export async function detectScenes(items, g) {
    const from = items[0].i, to = items[items.length - 1].i;
    const out = await askAI(`MESSAGES #${from}–#${to}:\n${formatExtract(items, g)}`, { system: SCENES_SYS, maxTokens: 4000 });
    const list = parseScenes(out, from, to);
    return list.length > 1 || items.length <= sceneSize() * 1.5 ? list : null;
}
// scene starts → item groups: a start on a bot reply moves back to the user turn it answers, a scrap of a few messages
// joins the scene before it (the section writer can still split it off), a scene far over the size is cut at a user turn
export function chunksFromStarts(items, starts, { size = sceneSize(), exact = false, chat = ctx().chat || [] } = {}) {
    const idx = new Map(items.map((x, k) => [x.i, k]));
    let ks = [...new Set(starts.map(s => idx.get(s.start ?? s)).filter(k => k !== undefined))].sort((a, b) => a - b);
    if (!exact) ks = ks.map(k => (k > 0 && !chat[items[k].i]?.is_user && chat[items[k - 1].i]?.is_user ? k - 1 : k));
    ks = [...new Set([0, ...ks])].sort((a, b) => a - b);
    let groups = ks.map((k, j) => items.slice(k, ks[j + 1] ?? items.length)).filter(x => x.length);
    if (exact) return groups;
    const max = Math.round(size * 1.5);
    const merged = [];
    for (const gr of groups) {
        if (merged.length && gr.length < 5 && merged[merged.length - 1].length + gr.length <= max) merged[merged.length - 1] = merged[merged.length - 1].concat(gr);
        else merged.push(gr);
    }
    const out = [];
    for (const gr of merged) {
        if (gr.length <= max) { out.push(gr); continue; }
        // over the cap: the same size cutter, inside this scene
        out.push(...sceneChunks(gr, { size, re: '', chat }));
    }
    return out;
}
// the editable list in the confirm dialog: "#4–#22  Somang locks the door"
export const scenesText = (chunks, notes = new Map()) => chunks.map(c => `#${c[0].i}–#${c[c.length - 1].i}  ${notes.get(c[0].i) || ''}`.trimEnd()).join('\n');
export const startsFromText = text => String(text || '').split('\n').map(l => l.match(/^\s*#?(\d+)/)).filter(Boolean).map(mt => ({ start: Number(mt[1]) }));

export const STATE_SYS = `GOAL
Update the archive's STATE and OPEN for the new sections, as two change lists. You do not rewrite them: the extension applies your lists, and every line you do not list stays exactly as it is.

YOU GET
- <current_state>: the archive's STATE and OPEN now.
- <new_sections>: what happened since, already summarized, with message numbers.
- <work_note> (sometimes): the user's own notes on this story. Follow it.

RULES
- EDIT a STATE line only when the new sections make it untrue or outdated, so an old behavior a later arc changed does not stay in the present tense. Change only what changed and keep the rest of the line word for word; never shorten a line to save space, never merge lines.
- DROP a STATE line only when the story itself has overturned it. What a character realized or resolved not to do stays until the story overturns it. Keep safety lines that lock the current state.
- New and edited lines: per character + relationships + current life. Only changes and tendencies the sections alone do not capture, briefly; do not restate events. Scope principles narrowly ("no commands" ✗ → "no longer dictates her choices or movements" ✓); use "tends to" or "since #n" instead of "now".
- "## Heading" / "## Group" is the one the line sits under, spelled exactly as in <current_state>; leave it out when OPEN has no groups. Do not invent headings.
- OPEN: drop only threads the new sections closed; add threads they opened, short; do not prescribe future actions.
- Copy old lines exactly in EDIT and DROP.

OUTPUT
# STATE CHANGES
ADD ## Heading :: - the new line
EDIT ## Heading :: - the old line ==> - the new line
DROP ## Heading :: - the old line
# OPEN CHANGES
ADD ## Group :: - a new thread
DROP ## Group :: - a closed thread
A list with nothing in it is (none). Nothing else.`;

// the compress instruction as <rules>: the raw log and STATE are sent apart from it
export const rulesText = (p, from, to) => fillPrompt(p.text, { raw: '(given above in <raw_log>)', state: '(given above in <current_state>)', from: String(from), to: String(to), last_section: '', archive: '', recent: '' })
    .replace(/<raw_log[^>]*>\s*\(given above in <raw_log>\)\s*<\/raw_log>\s*/, '').replace(/<current_state>\s*\(given above in <current_state>\)\s*<\/current_state>\s*/, '');

// the whole run: sections scene by scene, then the change lists. Same shape as draftCompress's answer.
export async function sceneCompress({ m, g, p, items, onStep = () => {}, memo = '', chunks: given = null }) {
    const chunks = given?.length ? given : sceneChunks(items);
    const au = auOf(m);
    const prefix = au.on ? au.name : (headingRanges(splitTail(m.text)[0]).pop()?.prefix || '');
    const tail = splitTail(m.text)[1].trim();
    const note = String(m.workNote || '').trim();
    // the archive's last sections for style; the very last one is also the first scene's <previous_section>
    const recentAll = lastSections(m.text, 4);
    const recentFor = k => (k === 0 ? recentAll.slice(0, -1) : recentAll.slice(-3)).join('\n\n');
    const rulesFor = (from, to) => rulesText(p, from, to);
    const secs = [];
    let prev = recentAll[recentAll.length - 1] || '', doneTo = null, error = null;
    for (const [k, part] of chunks.entries()) {
        const from = part[0].i, to = part[part.length - 1].i;
        onStep(k, chunks.length, from, to, 'scenes');
        const prompt = `<raw_log range="#${from}–#${to}">\n${formatExtract(part, g)}\n</raw_log>\n\n<previous_section>\n${prev || '(none: this is the start of the archive)'}\n</previous_section>\n\n<recent_archive>\n${recentFor(k) || '(none)'}\n</recent_archive>${styleBlock(m)}\n\n<current_state>\n${tail || '(none)'}\n</current_state>${note ? `\n\n<work_note>\n${note}\n</work_note>` : ''}\n\n<rules>\n${rulesFor(from, to).trim()}\n</rules>${au.on ? `\n\n${auBlock(m).trim()}` : ''}${memoBlock(memo)}${langBlock(m.text, { tail: false })}\n\n${SCENE_ASK(from, to, prefix)}`;
        let got;
        try { got = parseSceneAnswer(await ask(sceneModel(), prompt), from, to); }
        catch (e) { error = e; break; }
        if (!got.length) { error = new Error(`#${from}–#${to} 답에 불릿이 없어요`); break; }
        const blocks = got.map(x => `## ${prefix ? `${prefix} ` : ''}#${x.a}–#${x.b} — ${x.title || 'Untitled'}\nPLOT:\n${x.bullets.join('\n')}`);
        secs.push(...blocks);
        prev = blocks.join('\n\n');
        doneTo = to;
    }
    if (!secs.length) return { text: '', dropped: 0, parts: chunks.length, done: 0, doneTo: null, error, grades: [] };
    // STATE · OPEN once, from the new sections (skipped when the archive has none, or when a scene failed)
    let changes = '';
    if (tail && !error) {
        onStep(chunks.length, chunks.length, items[0].i, doneTo, 'state');
        try {
            const out = await ask(stateModel(), `<current_state>\n${tail}\n</current_state>\n\n<new_sections>\n${secs.join('\n\n')}\n</new_sections>${note ? `\n\n<work_note>\n${note}\n</work_note>` : ''}${langBlock(m.text)}`, STATE_SYS);
            changes = String(out || '').replace(/^```[a-z]*\n?|```\s*$/g, '').trim();
            const at = changes.search(/^# (STATE|OPEN) CHANGES/m);
            changes = at >= 0 ? changes.slice(at) : '';
        } catch (e) { console.error('[NarrativeArchive] state changes', e); toastr.warning(`STATE·OPEN 변경을 못 받았어요 (${e?.message || e}) · 섹션만 넣고, STATE는 추가 창에서 그대로 남아요`, '장면별 압축'); }
    }
    const text = `${secs.join('\n\n')}${changes ? `\n\n---\n${changes}` : ''}`;
    return { text, dropped: 0, parts: chunks.length, done: secs.length, doneTo, error, grades: [], scenes: chunks.map(c => [c[0].i, c[c.length - 1].i]) };
}

// 문체 견본: one or two sections the user picked as the voice to write in. Kept as text, so they stay put
// however the archive grows; sent with every scene, after <recent_archive>
export const STYLE_MAX = 2;
export const styleSamples = m => (Array.isArray(m?.styleSamples) ? m.styleSamples.filter(x => x?.text) : []);
export const styleBlock = m => { const xs = styleSamples(m); return xs.length ? `\n\n<style_sample>\n${xs.map(x => x.text).join('\n\n')}\n</style_sample>` : ''; };
export async function openStyleSamples() {
    const c = ctx(), m = getMeta();
    const t = splitTail(String(m.text || ''))[0];
    const secs = parseSections(t).filter(x => !x.group && RANGE_HEAD.test(x.title)).reverse();
    const textOf = x => trimEnd(t.slice(x.start, x.end)).replace(/\n-{3,}\s*$/, '').trim();
    const picked = new Set(styleSamples(m).map(x => x.title));
    const $root = $(`
      <div class="na_popup na_v2 na_ss">
        <div class="na_v2_title"><b>문체 견본</b><small>마음에 드는 섹션을 ${STYLE_MAX}개까지 · 압축할 때마다 "이 목소리로" 같이 보내요 · 새 요약이 쌓여도 안 바뀌어요</small></div>
        <input type="search" class="text_pole na_ss_find" placeholder="제목으로 찾기">
        <div class="na_ss_list"></div>
        <small class="na_v2_note na_ss_info"></small>
      </div>`);
    const draw = () => {
        const q = String($root.find('.na_ss_find').val() || '').trim().toLowerCase();
        $root.find('.na_ss_list').html(secs.filter(x => !q || x.title.toLowerCase().includes(q)).map(x => {
            const first = (textOf(x).split('\n').find(l => /^\s*-\s/.test(l)) || '').replace(/^\s*-\s*/, '');
            return `<label class="na_ss_row${picked.has(x.title) ? ' on' : ''}"><input type="checkbox" data-t="${esc(x.title)}" ${picked.has(x.title) ? 'checked' : ''}><span><b>${esc(x.title)}</b><small>${esc(first.slice(0, 120))}</small></span></label>`;
        }).join('') || '<small class="na_v2_note">섹션이 없어요</small>');
        $root.find('.na_ss_info').text(picked.size ? `${picked.size}개 골랐어요` : '안 골랐어요 · 그동안은 최근 섹션 문체를 따라가요');
    };
    $root.on('input', '.na_ss_find', draw);
    $root.on('change', '.na_ss_row input', function () {
        const k = this.dataset.t;
        if (this.checked) {
            if (picked.size >= STYLE_MAX) { this.checked = false; return toastr.info(`${STYLE_MAX}개까지예요. 하나를 먼저 빼 주세요.`, '문체 견본'); }
            picked.add(k);
        } else picked.delete(k);
        draw();
    });
    draw();
    const r = await c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', { wide: true, large: true, allowVerticalScrolling: true, okButton: '저장', cancelButton: '취소' });
    if (!(r === c.POPUP_RESULT.AFFIRMATIVE || r === true)) return;
    // the old sample's text stays when its section is no longer in the archive
    const old = new Map(styleSamples(m).map(x => [x.title, x.text]));
    getMeta().styleSamples = [...picked].map(k => { const x = secs.find(y => y.title === k); return { title: k, text: x ? textOf(x) : old.get(k) || '' }; }).filter(x => x.text);
    await saveMeta();
    $('#na_style_sub').text(styleLabel(getMeta()));
    toastr.success(picked.size ? '문체 견본을 저장했어요' : '문체 견본을 비웠어요', '문체 견본');
}
export const styleLabel = m => { const xs = styleSamples(m); return xs.length ? xs.map(x => x.title.replace(RANGE_HEAD, '$5').replace(/^\s*[—–-]\s*/, '').replace(/\s*\([^()]*\)\s*$/, '')).join(' · ') : '마음에 드는 섹션 1–2개 · 새 요약이 쌓여도 문체가 안 떠내려가요'; };

// the work note's parts; a line added from the 압축 작업실 goes under one of them
export const NOTE_PARTS = ['Canon', '살린 줄', '실수 목록', '문체'];
// older names a heading may still carry
const NOTE_ALIAS = { 'canon 요지': 'Canon' };
export function noteInsert(note, part, line) {
    const n = noteParts(note);
    n.parts[part] = n.parts[part] ? `${n.parts[part]}\n${line}` : line;
    return noteJoin(n);
}

// 작업 노트: the user's handover for this story (canon, lines to keep, past mistakes), sent with every scene.
// Kept with the chat and carried into the next one.
// the note as its four parts (plus whatever sits outside them); headings that are not a part stay inside the part they are in
export function noteParts(note) {
    const acc = Object.fromEntries(NOTE_PARTS.map(x => [x, []])), other = [];
    let cur = null;
    for (const l of String(note || '').split('\n')) {
        const h = l.match(/^#{1,3}\s*(.+?)\s*$/);
        const k = h && (NOTE_PARTS.find(x => x.toLowerCase() === h[1].toLowerCase()) || NOTE_ALIAS[h[1].toLowerCase()]);
        if (k) { cur = k; continue; }
        (cur ? acc[cur] : other).push(l);
    }
    const trim = arr => arr.join('\n').replace(/^\s+|\s+$/g, '');
    return { parts: Object.fromEntries(NOTE_PARTS.map(x => [x, trim(acc[x])])), other: trim(other) };
}
export const noteJoin = ({ parts, other }) => [...(other ? [other] : []), ...NOTE_PARTS.filter(x => parts[x]).map(x => `# ${x}\n${parts[x]}`)].join('\n\n');
const NOTE_HINT = {
    'Canon': '- 이 이야기에서 절대 틀리면 안 되는 사실을 한 줄씩\n- 예: Ren은 Mara보다 열 살 많다',
    '살린 줄': '- 원문 그대로 남길 대사\n- 예: #63 Mara "Then I\'ll wait."',
    '실수 목록': '- 요약이 틀렸던 것과 바른 쪽',
    '문체': '- 섹션 길이, 대사 길이, 제목 모양\n- 예: 대사는 섹션당 한두 개, 짧게',
    '기타': '- 네 칸 밖에 있던 내용',
};

// 작업 노트: the user's handover for this story, in four parts picked from the row on top. Sent with every scene;
// kept with the chat and carried into the next one.
export async function openWorkNote() {
    const c = ctx(), m = getMeta();
    const note = noteParts(m.workNote);
    const tabs = () => [...NOTE_PARTS, ...(note.other ? ['기타'] : [])];
    let cur = NOTE_PARTS[0];
    const $root = $(`
      <div class="na_popup na_v2 na_wn">
        <div class="na_v2_title"><b>작업 노트</b><small>장면별 압축 · 작업실에서 장면마다 같이 보내요 · 이 채팅에 저장되고 다음 채팅으로 이어져요</small></div>
        <div class="na_v2_seg na_wn_seg"></div>
        <textarea class="text_pole na_wn_ta" spellcheck="false"></textarea>
        <div class="na_v2_row2"><button type="button" class="na_v2_btn na_wn_file_btn">.md · .txt 불러오기</button><button type="button" class="na_v2_btn na_wn_clear">이 칸 비우기</button></div>
        <input type="file" class="na_wn_file" accept=".md,.txt,text/plain,text/markdown" hidden>
        <small class="na_v2_note na_wn_info"></small>
      </div>`);
    const $ta = $root.find('.na_wn_ta');
    const get = k => (k === '기타' ? note.other : note.parts[k]);
    const set = (k, v) => { if (k === '기타') note.other = v; else note.parts[k] = v; };
    const lines = v => String(v || '').split('\n').filter(l => l.trim()).length;
    const drawTabs = () => $root.find('.na_wn_seg').html(tabs().map(k => `<button type="button" data-k="${k}" class="${k === cur ? 'on' : ''}">${k}${lines(get(k)) ? `<small>${lines(get(k))}</small>` : ''}</button>`).join(''));
    const info = () => { const v = noteJoin(note); $root.find('.na_wn_info').text(v.trim() ? `전체 약 ${v.length.toLocaleString()}자` : '비어 있어요'); };
    const show = k => { cur = k; $ta.val(get(k)).attr('placeholder', NOTE_HINT[k] || ''); drawTabs(); };
    $ta.on('input', () => { set(cur, String($ta.val() || '').replace(/\s+$/, '')); drawTabs(); info(); });
    $root.on('click', '.na_wn_seg button', function () { show(this.dataset.k); $ta.trigger('focus'); });
    $root.find('.na_wn_file_btn').on('click', () => $root.find('.na_wn_file').val('').trigger('click'));
    $root.find('.na_wn_file').on('change', async function () {
        const f = this.files?.[0];
        if (!f) return;
        // a whole note: its "# Canon" … headings fill the parts, the rest goes to 기타
        const got = noteParts((await f.text()).replace(/\r\n/g, '\n'));
        Object.assign(note.parts, got.parts); note.other = got.other;
        show(tabs().includes(cur) ? cur : NOTE_PARTS[0]); info();
    });
    $root.find('.na_wn_clear').on('click', () => { set(cur, ''); show(cur); info(); });
    show(cur); info();
    const r = await c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', { wide: true, large: true, allowVerticalScrolling: true, okButton: '저장', cancelButton: '취소' });
    if (!(r === c.POPUP_RESULT.AFFIRMATIVE || r === true)) return;
    const v = noteJoin(note).trim();
    getMeta().workNote = v;
    await saveMeta();
    $('#na_worknote_sub').text(v ? `있음 · 약 ${v.length.toLocaleString()}자 · 장면마다 같이 보내요` : '이 이야기의 인수인계 · canon · 살린 줄 · 이전 실수 · 장면마다 같이 보내요');
    toastr.success(v ? '작업 노트를 저장했어요' : '작업 노트를 비웠어요');
}
