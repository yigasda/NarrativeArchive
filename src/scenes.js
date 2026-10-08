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
function lastSections(text, n) {
    const t = splitTail(String(text || ''))[0];
    const secs = parseSections(t).filter(x => !x.group && RANGE_HEAD.test(x.title)).slice(-n);
    return secs.map(x => trimEnd(t.slice(x.start, x.end)).replace(/\n-{3,}\s*$/, '').trim());
}

// one scene → "Title (date, place)" + bullets, whatever wrapping the model put around them
export function parseSceneAnswer(out) {
    const t = String(out || '').replace(/^```[a-z]*\n?|```\s*$/g, '').trim();
    const lines = t.split('\n');
    let title = '';
    const ti = lines.findIndex(l => /^\s*(?:TITLE\s*:|#{1,3}\s)/i.test(l));
    if (ti >= 0) {
        title = lines[ti].replace(/^\s*TITLE\s*:\s*/i, '').replace(/^#{1,3}\s*/, '').trim();
        const r = title.match(RANGE_HEAD);
        if (r) title = r[5].replace(/^\s*[—–-]\s*/, '').trim();
    }
    const bullets = lines.filter(l => /^\s*[-*•]\s/.test(l)).map(l => `- ${l.replace(/^\s*[-*•]\s*/, '').trim()}`);
    return { title, bullets };
}

const SCENE_ASK = (from, to, prefix) => `[THIS REQUEST]
Write exactly ONE section for #${from}–#${to}, the raw log in <raw_log>, following <rules> (ignore what they say about output parts, change lists, scene lists and section counts: here you write one section and nothing else).
- <previous_section> is already written and ends right before #${from}: do not repeat its events; carry on from where it stops.
- <recent_archive> and <current_state> are context and style only: nothing in them goes into this section unless <raw_log> shows it happening.
- <work_note>, when present, is the user's own notes on this story (canon, lines to keep, past mistakes). Follow it.
- Do not write the heading numbers; the extension adds "## ${prefix ? `${prefix} ` : ''}#${from}–#${to} —".
Output only:
TITLE: <title> (<date>, <place>)
PLOT:
- <bullet>
- <bullet>`;

const STATE_SYS = `GOAL
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

// the whole run: sections scene by scene, then the change lists. Same shape as draftCompress's answer.
export async function sceneCompress({ m, g, p, items, onStep = () => {}, memo = '' }) {
    const chunks = sceneChunks(items);
    const au = auOf(m);
    const prefix = au.on ? au.name : (headingRanges(splitTail(m.text)[0]).pop()?.prefix || '');
    const tail = splitTail(m.text)[1].trim();
    const note = String(m.workNote || '').trim();
    // the archive's last sections for style; the very last one is also the first scene's <previous_section>
    const recentAll = lastSections(m.text, 4);
    const recentFor = k => (k === 0 ? recentAll.slice(0, -1) : recentAll.slice(-3)).join('\n\n');
    const rulesFor = (from, to) => fillPrompt(p.text, { raw: '(given above in <raw_log>)', state: '(given above in <current_state>)', from: String(from), to: String(to), last_section: '', archive: '', recent: '' })
        .replace(/<raw_log[^>]*>\s*\(given above in <raw_log>\)\s*<\/raw_log>\s*/, '').replace(/<current_state>\s*\(given above in <current_state>\)\s*<\/current_state>\s*/, '');
    const secs = [];
    let prev = recentAll[recentAll.length - 1] || '', doneTo = null, error = null;
    for (const [k, part] of chunks.entries()) {
        const from = part[0].i, to = part[part.length - 1].i;
        onStep(k, chunks.length, from, to, 'scenes');
        const prompt = `<raw_log range="#${from}–#${to}">\n${formatExtract(part, g)}\n</raw_log>\n\n<previous_section>\n${prev || '(none: this is the start of the archive)'}\n</previous_section>\n\n<recent_archive>\n${recentFor(k) || '(none)'}\n</recent_archive>\n\n<current_state>\n${tail || '(none)'}\n</current_state>${note ? `\n\n<work_note>\n${note}\n</work_note>` : ''}\n\n<rules>\n${rulesFor(from, to).trim()}\n</rules>${au.on ? `\n\n${auBlock(m).trim()}` : ''}${memoBlock(memo)}${langBlock(m.text)}\n\n${SCENE_ASK(from, to, prefix)}`;
        let got;
        try { got = parseSceneAnswer(await ask(sceneModel(), prompt)); }
        catch (e) { error = e; break; }
        if (!got.bullets.length) { error = new Error(`#${from}–#${to} 답에 불릿이 없어요`); break; }
        const block = `## ${prefix ? `${prefix} ` : ''}#${from}–#${to} — ${got.title || 'Untitled'}\nPLOT:\n${got.bullets.join('\n')}`;
        secs.push(block);
        prev = block;
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

// 작업 노트: the user's handover for this story (canon, lines to keep, past mistakes), sent with every scene.
// Kept with the chat and carried into the next one.
export async function openWorkNote() {
    const c = ctx(), m = getMeta();
    const $root = $(`
      <div class="na_popup na_v2 na_wn">
        <div class="na_v2_title"><b>작업 노트</b><small>장면별 압축에서 장면마다 같이 보내요 · 이 채팅에 저장되고 다음 채팅으로 이어져요</small></div>
        <small class="na_v2_note">이 이야기의 canon 요지, 꼭 살릴 줄, 이전 실수 목록처럼 요약할 때 알아야 할 것만. 리뷰 방식 같은 요약과 상관없는 건 빼는 게 좋아요.</small>
        <textarea class="text_pole na_wn_ta" spellcheck="false" placeholder="# canon 요지&#10;- …&#10;# 살린 줄&#10;- …&#10;# 이전 실수&#10;- …"></textarea>
        <div class="na_v2_row2"><button type="button" class="na_v2_btn na_wn_file_btn">.md · .txt 불러오기</button><button type="button" class="na_v2_btn na_wn_clear">지우기</button></div>
        <input type="file" class="na_wn_file" accept=".md,.txt,text/plain,text/markdown" hidden>
        <small class="na_v2_note na_wn_info"></small>
      </div>`);
    const $ta = $root.find('.na_wn_ta').val(String(m.workNote || ''));
    const info = () => { const v = String($ta.val() || ''); $root.find('.na_wn_info').text(v.trim() ? `약 ${v.length.toLocaleString()}자` : '비어 있어요'); };
    $ta.on('input', info); info();
    $root.find('.na_wn_file_btn').on('click', () => $root.find('.na_wn_file').val('').trigger('click'));
    $root.find('.na_wn_file').on('change', async function () {
        const f = this.files?.[0];
        if (!f) return;
        $ta.val((await f.text()).replace(/\r\n/g, '\n').trim()); info();
    });
    $root.find('.na_wn_clear').on('click', () => { $ta.val(''); info(); });
    const r = await c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', { wide: true, large: true, allowVerticalScrolling: true, okButton: '저장', cancelButton: '취소' });
    if (!(r === c.POPUP_RESULT.AFFIRMATIVE || r === true)) return;
    const v = String($ta.val() || '').trim();
    getMeta().workNote = v;
    await saveMeta();
    $('#na_worknote_sub').text(v ? `있음 · 약 ${v.length.toLocaleString()}자 · 장면마다 같이 보내요` : '이 이야기의 인수인계 · canon · 살린 줄 · 이전 실수 · 장면마다 같이 보내요');
    toastr.success(v ? '작업 노트를 저장했어요' : '작업 노트를 비웠어요');
}
