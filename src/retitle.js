// Asking the draft model to rework archive sections: new titles for many sections at once,
// and one section rewritten the way the user asks (with its raw messages when they can be found).

import { askCompress, askDraft, drLabel, draftReady, draftSettings, stripThink } from './ai.js';
import { fetchOtherChat } from './chats.js';
import { commitText, ctx, getMeta, globalSettings, saveMeta } from './core.js';
import { lineDiff, renderDiff } from './diff.js';
import { cleanMessage, extractToText } from './extract.js';
import { changedQuotes } from './fade.js';
import { mountSectionPicker } from './picker.js';
import { activePrompt, fillPrompt, langBlock } from './prompts.js';
import { RANGE_HEAD, groupLabel, keyAt, linkedMap, parseSections, renameKeys, sectionKey, trimEnd } from './sections.js';
import { sourceRange } from './source.js';
import { ICO_A, svgA } from './theme.js';
import { confirm, countTokens, esc, fmt } from './util.js';

export const AI_SYS_RETITLE = `GOAL
Give each section of a story archive a title that reads like a book's table of contents.

YOU GET
SECTIONS: numbered sections. Each shows its current title, then its text.

STEPS
1. Read each section.
2. Write its title: short and concrete. A title names the scene; it does not summarize it. No semicolons, no "X does this; Y does that."
3. Vary the shape; do not start every title with "The":
   - a place or object: The broken plank · Varo's market
   - two things joined: The bridge, the debt · Bread, and the oath he broke
   - one short plain sentence: Mara keeps the knife · The road closes
   - a "what" clause: What Ren didn't say
   - a number or pairing: One cloak · The two of them · The second night
   - a list: Ivo, the duke, and the toll
   - a line in quotation marks, copied exactly from the section: "Now you owe me"
4. Same language as the section. Titles in one batch should not repeat each other.
5. A current title that already follows these rules may stay as it is.

EXAMPLE
SECTIONS:
[1] current title: Ren and Mara cross the bridge; a plank breaks and Ren is hurt
PLOT:
- Halfway across, a plank broke. Ren cut his leg; Mara pulled him up and said, "Now you owe me."
[2] current title: Ivo waits with the horses and brings news about the road
PLOT:
- Ivo told them the duke had closed the south road, so they had to go through Varo's market.
[3] current title: The confession
PLOT:
- That night Ren admitted his sister is dead. Mara slept beside him without answering.

Answer:
1 | "Now you owe me"
2 | The road closes
3 | What Ren didn't say

OUTPUT
One line per section: its number | the new title. Only the title — no range, date or place. Nothing else.`;

export const AI_SYS_SECFIX = `GOAL
Rewrite ONE section of a story archive the way the user asks — and nothing else.

YOU GET
- SECTION: the section as it is now (heading line, then its text).
- RAW LOG (sometimes): the messages the section was made from, each starting with [number] and the speaker. It is the only source of new facts and quotes.
- EARLIER REQUESTS (sometimes): what the user already asked for in this window. They are done; keep them done.
- REQUEST: what the user wants changed now. It may be in Korean.

STEPS
1. Do what REQUEST asks. Change nothing else: other bullets stay word for word, the form stays the same (labels like PLOT:, bullets), and the heading keeps its range, date and place. Change the title only if asked.
2. New facts and quotes come only from SECTION or RAW LOG. A line in quotation marks is copied exactly from RAW LOG — every word, same order. Never invent or paraphrase a line and present it as a quote.
3. Keep the archive's rules: one bullet = one event; keep the action that caused a reaction before the reaction; a character's interpretation only as theirs ("In her own reckoning, …"); no commentary or verdicts.
4. Same language as the section.
5. If part of the request cannot be done (it needs something that is in neither SECTION nor RAW LOG), do the rest and say what was not done on a last line that starts with "NOTE:", in Korean.

EXAMPLE
SECTION:
## #12–#15 — The broken plank (Spring 3, Varo)
PLOT:
- Halfway across, a plank broke and Ren cut his leg. Mara pulled him up.
RAW LOG:
[13] Mara:
She hauled him up by the collar. "Now you owe me."
REQUEST:
마라 대사 원문 그대로 넣어줘

Answer:
## #12–#15 — The broken plank (Spring 3, Varo)
PLOT:
- Halfway across, a plank broke and Ren cut his leg. Mara pulled him up: "Now you owe me."

OUTPUT
The whole section, heading line first, then an optional NOTE line. No fences, no comments.`;

// "## AU #8–#13 — Horus crosses …; … (Hathyr 8, late morning)" → { head: "## AU #8–#13 — ", name, tail: " (Hathyr 8, late morning)" }
export function splitTitle(line) {
    const mt = String(line).match(/^(#{1,3}\s+)(.*)$/);
    if (!mt) return null;
    const r = mt[2].match(RANGE_HEAD);
    if (!r) return null;
    const lead = mt[2].slice(0, mt[2].length - r[5].length);
    const rest = r[5].match(/^(\s*[—–-]\s*)?(.*)$/);
    const body = rest[2];
    const paren = body.match(/^(.*?)(\s*\([^()]*\))\s*$/);
    const name = (paren ? paren[1] : body).trim();
    return { head: `${mt[1]}${lead}${rest[1] || ' — '}`, name, tail: paren ? paren[2] : '' };
}

const headLine = (text, s) => text.slice(s.start).split('\n')[0];
// a section's text without the "---" rule that may close it (the rule before STATE belongs to the archive, not the section)
const ruleTail = /(?:\s*\n-{3,}[ \t]*)?\s*$/;
const sectionBody = t => String(t).replace(ruleTail, '');

// ---- 제목 다시 짓기: picked sections, a few thousand tokens at a time, then a before → after list to tick

// group: a "# ── AU ──" section to start with ticked; without one, the newest log is
export async function openRetitle(group = null, keys = null) {
    const c = ctx(), m = getMeta();
    if (!draftReady()) return toastr.info('⚙ 설정 → AI · 번역 → 초안 모델을 먼저 정해 주세요.', '제목 다시 짓기');
    m.retitled = Array.isArray(m.retitled) ? m.retitled : [];
    const ranged = x => RANGE_HEAD.test(x.title);
    // first opened: the given group, or the newest log (the group the last numbered section sits in)
    const startKeys = () => {
        const secs = parseSections(m.text);
        const last = [...secs].reverse().find(x => !x.group && ranged(x));
        const g = group ? secs.findIndex(x => x.group && x.start === group.start) : secs.reduce((a, x, i) => (x.group && last && x.start <= last.start ? i : a), -1);
        const next = secs.findIndex((x, i) => i > g && x.group && x.level <= (secs[g]?.level ?? 1));
        return secs.filter((x, i) => !x.group && ranged(x) && i > g && (next < 0 || i < next)).map(sectionKey);
    };
    const $root = $(`
      <div class="na_popup na_v2 na_rt">
        <div class="na_v2_title"><b>제목 다시 짓기</b><small>책 목차처럼 짧고 구체적인 제목으로 · 번호·날짜·장소는 그대로</small></div>
        <div class="na_rt_pick"></div>
        <div class="na_rt_res" hidden>
          <div class="na_rt_head"><b>바뀌는 제목</b><span class="na_rt_quick"><button type="button" class="na_pchip" data-all="1">모두</button><button type="button" class="na_pchip" data-all="0">비우기</button></span></div>
          <div class="na_rt_list"></div>
          <button type="button" class="na_v2_btn primary wide na_rt_apply"></button>
        </div>
      </div>`);
    let results = []; // [{ key, start, old, next }]
    const drawResults = () => {
        $root.find('.na_rt_res').prop('hidden', !results.length);
        $root.find('.na_rt_list').html(results.map((x, i) => `
          <label class="na_rt_row ${x.same ? 'same' : ''}">
            <input type="checkbox" data-i="${i}" ${x.on ? 'checked' : ''} ${x.same ? 'disabled' : ''}>
            <span class="na_rt_txt">
              <small>${esc(x.range)}${x.same ? ' · 그대로' : ''}</small>
              <s class="na_rt_old">${esc(x.old)}</s>
              <input type="text" class="text_pole na_rt_new" data-i="${i}" value="${esc(x.next)}" spellcheck="false">
            </span>
          </label>`).join(''));
        const n = results.filter(x => x.on && !x.same).length;
        $root.find('.na_rt_apply').text(n ? `${n}개 바꾸기` : '바꿀 제목을 골라 주세요').prop('disabled', !n);
    };
    $root.on('change', '.na_rt_row input[type=checkbox]', function () { results[this.dataset.i].on = this.checked; drawResults(); });
    $root.on('input', '.na_rt_new', function () { const x = results[this.dataset.i]; x.next = this.value; x.on = !!this.value.trim(); $root.find(`.na_rt_row input[type=checkbox][data-i="${this.dataset.i}"]`).prop('checked', x.on); const n = results.filter(y => y.on && !y.same).length; $root.find('.na_rt_apply').text(n ? `${n}개 바꾸기` : '바꿀 제목을 골라 주세요').prop('disabled', !n); });
    $root.on('click', '.na_rt_quick .na_pchip', function () { const on = this.dataset.all === '1'; results.forEach(x => { if (!x.same) x.on = on; }); drawResults(); });
    const picker = mountSectionPicker($root.find('.na_rt_pick'), {
        m, title: '다시 지을 섹션', goLabel: `초안 모델로 짓기`, doneLabel: '다시 지음', newLabel: '안 한 것',
        filter: ranged, initial: keys ? () => keys : startKeys,
        doneKeys: () => new Set(m.retitled),
        onGo: async (parts, step) => {
            results = [];
            for (const [i, part] of parts.entries()) {
                await step(part, i, `짓는 중… ${i + 1}/${parts.length}`);
                const body = part.map((x, k) => {
                    const sp = splitTitle(headLine(m.text, x));
                    return `[${k + 1}] current title: ${sp?.name || x.title}\n${trimEnd(m.text.slice(x.start, x.end)).split('\n').slice(1).join('\n').trim()}`;
                }).join('\n\n');
                const out = stripThink(await askDraft(`SECTIONS:\n${body}`, { system: AI_SYS_RETITLE, maxTokens: 4000, effort: 'low' }));
                const got = new Map();
                for (const line of out.split('\n')) {
                    const mt = line.replace(/^\s*[-*]\s*/, '').match(/^\[?(\d+)\]?\s*[|:.)]\s*(.+)$/);
                    if (mt) got.set(Number(mt[1]), mt[2].trim().replace(/^\*\*(.*)\*\*$/, '$1').replace(/^#+\s*/, ''));
                }
                part.forEach((x, k) => {
                    const sp = splitTitle(headLine(m.text, x));
                    const next = got.get(k + 1);
                    if (!sp || !next) return;
                    const r = x.title.match(RANGE_HEAD);
                    results.push({ key: sectionKey(x), start: x.start, old: sp.name, next, same: next === sp.name, on: next !== sp.name, range: `${r[1] ? `${r[1]} ` : ''}#${r[2]}–#${r[4]}` });
                });
            }
            if (!results.length) return toastr.warning('초안 모델이 제목을 돌려주지 않았어요. 다시 해 보세요.', '제목 다시 짓기');
            drawResults();
            $root.find('.na_rt_res')[0].scrollIntoView({ block: 'nearest' });
        },
    });
    picker.toggle(true);
    $root.find('.na_rt_apply').on('click', async () => {
        const cur = getMeta();
        const pick = results.filter(x => x.on && !x.same && x.next.trim());
        if (!pick.length) return;
        // still the same archive? every picked heading must sit where it was read
        const secs = parseSections(cur.text);
        const byKey = new Map(secs.map(x => [sectionKey(x), x]));
        if (pick.some(x => byKey.get(x.key)?.start !== x.start)) return toastr.warning('아카이브가 그사이 바뀌었어요. 창을 닫고 다시 해 주세요.', '제목 다시 짓기');
        let next = cur.text;
        for (const x of [...pick].sort((a, b) => b.start - a.start)) {
            const line = headLine(next, { start: x.start });
            const sp = splitTitle(line);
            if (!sp) continue;
            next = next.slice(0, x.start) + `${sp.head}${x.next.trim()}${sp.tail}` + next.slice(x.start + line.length);
        }
        // switches, pins, keyword links and short versions follow the renamed sections (same order before and after)
        const after = parseSections(next);
        secs.forEach((x, i) => { const nk = after[i] && sectionKey(after[i]); if (nk && nk !== sectionKey(x)) renameKeys(cur, sectionKey(x), nk); });
        const idx = new Map(secs.map((x, i) => [sectionKey(x), i]));
        const newKeys = pick.map(x => after[idx.get(x.key)]).filter(Boolean).map(sectionKey);
        cur.retitled = [...new Set([...(cur.retitled || []).filter(k => !pick.some(x => x.key === k)), ...newKeys])];
        await commitText(next, `제목 다시 짓기 전 (${pick.length}개)`);
        await saveMeta();
        toastr.success(`제목 ${pick.length}개를 바꿨어요`, '제목 다시 짓기');
        results = []; drawResults(); picker.toggle(true);
    });
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// ---- 고쳐 달라고 하기: one section, a request, the raw messages when we can find them, a diff to apply

export async function rawFor(m, s) {
    const r = sourceRange(m, s.title);
    if (!r) return { raw: '', why: '제목에 번호 범위가 없어요' };
    if (!r.ok) return { raw: '', why: r.why };
    if (r.needLink) return { raw: '', why: `${r.label} 원문이 있는 채팅이 연결돼 있지 않아요 (섹션의 원문 버튼으로 한 번 연결하면 돼요)` };
    let chat = ctx().chat || [];
    if (r.chat) {
        try { chat = (await fetchOtherChat(r.chat)).messages; }
        catch (e) { return { raw: '', why: `원문 채팅을 못 열었어요: ${e.message || e}` }; }
    }
    const items = [];
    for (let i = r.from; i <= r.to && i < chat.length; i++) {
        const x = chat[i];
        if (!x) continue;
        const text = cleanMessage(String(x.mes || ''), { stripTags: true });
        if (text) items.push({ i, name: x.name || '', text });
    }
    return items.length ? { raw: extractToText(items), why: '', label: r.label, from: r.chat ? '이전 채팅' : '이 채팅', n: items.length } : { raw: '', why: '그 번호의 메시지가 없어요' };
}

export async function openSectionFix(s) {
    const c = ctx(), m = getMeta();
    if (!draftReady()) return toastr.info('⚙ 설정 → AI · 번역 → 초안 모델을 먼저 정해 주세요.', '고쳐 달라고 하기');
    const original = sectionBody(m.text.slice(s.start, s.end));
    let draft = original;
    const asked = [];
    const src = await rawFor(m, s);
    const rawTok = src.raw ? await countTokens(src.raw) : 0;
    const $root = $(`
      <div class="na_popup na_v2 na_sf">
        <div class="na_v2_title"><b>고쳐 달라고 하기</b><small>${esc(s.title)}</small></div>
        <label class="na_v2_card na_v2_switchrow na_sf_raw ${src.raw ? '' : 'off'}">
          <span class="na_cp_txt"><span>원문 같이 보내기</span><small>${src.raw ? `${esc(src.label)} · ${esc(src.from)} · 메시지 ${src.n}개 · 약 ${fmt(rawTok)} 토큰` : esc(src.why)}</small></span>
          <input type="checkbox" class="na_toggle na_sf_rawon" ${src.raw ? 'checked' : 'disabled'}>
        </label>
        <div class="na_sf_log"></div>
        <div class="na_v2_card na_sf_view"><div class="na_diff na_sf_diff"></div></div>
        <div class="na_sf_note" hidden></div>
        <div class="na_ly_ask na_sf_ask"><input type="text" class="na_ly_askq na_sf_q" placeholder="고칠 것 (예: 소망 대사 원문 그대로 넣어줘)" aria-label="고칠 것" enterkeyhint="send"><button type="button" class="na_ly_askgo na_sf_go" aria-label="보내기" title="초안 모델에게 보내기">${svgA('M22 2L11 13M22 2l-7 20-4-9-9-4z', 17)}</button></div>
        <div class="na_v2_row2"><button type="button" class="na_v2_btn na_sf_undo" disabled>처음으로</button><button type="button" class="na_v2_btn primary na_sf_apply" disabled>적용</button></div>
      </div>`);
    const draw = () => {
        const changed = draft !== original;
        $root.find('.na_sf_diff').html(changed ? renderDiff(lineDiff(original, draft), 2, { src: false }) : `<div class="na_sf_plain">${esc(original)}</div>`);
        $root.find('.na_sf_apply, .na_sf_undo').prop('disabled', !changed);
        $root.find('.na_sf_log').html(asked.map(q => `<div class="na_sf_bubble">${esc(q)}</div>`).join(''));
    };
    let busy = false;
    const send = async () => {
        const q = String($root.find('.na_sf_q').val() || '').trim();
        if (!q || busy) return;
        busy = true;
        const $b = $root.find('.na_sf_go').prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i>');
        try {
            const useRaw = src.raw && $root.find('.na_sf_rawon').prop('checked');
            const prompt = `SECTION:\n${draft}\n\n${useRaw ? `RAW LOG:\n${src.raw}\n\n` : ''}${asked.length ? `EARLIER REQUESTS:\n${asked.map(x => `- ${x}`).join('\n')}\n\n` : ''}REQUEST:\n${q}${langBlock(m.text)}`;
            const out = stripThink(await askDraft(prompt, { system: AI_SYS_SECFIX, maxTokens: 8000, effort: 'low' })).replace(/^```[a-z]*\n?|```\s*$/g, '').trim();
            const note = (out.match(/^NOTE:\s*(.+)$/m) || [])[1] || '';
            const body = trimEnd(out.replace(/^NOTE:.*$/m, '').trim());
            if (!/^#{1,3}\s/.test(body)) throw new Error('초안 모델이 섹션 형태로 답하지 않았어요');
            draft = body;
            asked.push(q);
            $root.find('.na_sf_q').val('');
            $root.find('.na_sf_note').prop('hidden', !note).text(note ? `못 한 것: ${note}` : '');
            draw();
        } catch (e) {
            console.error('[NarrativeArchive] section fix', e);
            toastr.error(String(e?.message || e), '고쳐 달라고 하기');
        } finally { busy = false; $b.prop('disabled', false).html(svgA('M22 2L11 13M22 2l-7 20-4-9-9-4z', 17)); }
    };
    $root.find('.na_sf_go').on('click', send);
    $root.find('.na_sf_q').on('keydown', e => { if (e.key === 'Enter' && !e.originalEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); send(); } });
    $root.find('.na_sf_undo').on('click', () => { draft = original; asked.length = 0; $root.find('.na_sf_note').prop('hidden', true); draw(); });
    let applied = false;
    const apply = async () => {
        const cur = getMeta();
        if (sectionBody(cur.text.slice(s.start, s.end)) !== original) { toastr.warning('아카이브가 그사이 바뀌어서 적용하지 않았어요. 다시 열어 주세요.'); return false; }
        const trail = cur.text.slice(s.start, s.end).slice(original.length) || '\n\n';
        const next = cur.text.slice(0, s.start) + draft + trail + cur.text.slice(s.end);
        const nk = keyAt(next, s.start);
        if (nk && nk !== sectionKey(s)) renameKeys(cur, sectionKey(s), nk);
        await commitText(next, `고쳐 달라고 하기 전: ${s.title.slice(0, 40)}`);
        applied = true;
        toastr.success('섹션을 고쳤어요 · 이전 상태는 복구 지점에 있어요', '고쳐 달라고 하기');
        return true;
    };
    $root.find('.na_sf_apply').on('click', async () => { if (await apply()) $root.closest('dialog').find('.popup-button-ok').trigger('click'); });
    draw();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
    // closed with a draft not applied: ask instead of dropping it
    if (!applied && draft !== original && await confirm('적용 안 한 수정', '고친 내용을 아직 적용하지 않았어요. 적용할까요?')) await apply();
}


// ---- 섹션 합치기: a run of consecutive sections in one group; the model decides where the new sections start

export const AI_SYS_MERGE = `GOAL
Merge a run of consecutive sections of a story archive into fewer, larger sections. Combine them — do not summarize.

YOU GET
- SECTIONS: the sections in order, each with its heading line and its text.
- REQUEST (sometimes): how the user wants them merged. It may be in Korean.

STEPS
1. Decide where the new sections start. A section is a chapter, not a beat: start a new one only where something turns (a relationship shifts, the situation changes, a secret comes out, a decision is made). Keep an event together with its cause and its result. A turning point may stay short; stretches where little changes go together. Follow REQUEST if there is one. Make fewer sections than you were given.
2. Never split a given section: every new section is made of whole given sections, in order.
3. Numbers: each new section covers one continuous range, and together they cover the given sections' first to last number with no gaps and no overlaps. Keep the prefix the headings use (for example "AU").
4. Heading: "## <prefix> #from–#to — Title (date, place)". Take the date and place from the merged headings; if they differ, give the first and the last ("Hathyr 8, late morning → night").
5. Title: like a book's table of contents — short and concrete; it names the scene, it does not summarize it. No semicolons. Vary the shape; do not start every title with "The":
   - a place or object: The broken plank · Varo's market
   - two things joined: The bridge, the debt · Bread, and the oath he broke
   - one short plain sentence: Mara keeps the knife · The road closes
   - a "what" clause: What Ren didn't say
   - a number or pairing: One cloak · The two of them · The second night
   - a list: Ivo, the duke, and the toll
   - a line in quotation marks, copied exactly from the section: "Now you owe me"
6. Text: keep the form (labels such as PLOT:, then "- " bullets). Put the merged sections' bullets together in their order. Merge two bullets only when they say the same thing. Keep every fact. Keep every quotation word for word. Do not shorten, explain or add anything.

EXAMPLE
SECTIONS:
## #12–#13 — Ren and Mara reach the bridge (Spring 3, dusk, Varo)
PLOT:
- Ren and Mara reached the old bridge at dusk. Mara is afraid of heights.
## #14–#15 — A plank breaks; Ren is hurt (Spring 3, dusk, Varo)
PLOT:
- Halfway across, a plank broke and Ren cut his leg. Mara pulled him up: "Now you owe me."
## #16–#18 — Ivo and the closed road (Spring 3, night, Varo)
PLOT:
- Ivo told them the duke had closed the south road, so they had to go through Varo's market.

Answer:
## #12–#15 — "Now you owe me" (Spring 3, dusk, Varo)
PLOT:
- Ren and Mara reached the old bridge at dusk. Mara is afraid of heights.
- Halfway across, a plank broke and Ren cut his leg. Mara pulled him up: "Now you owe me."
## #16–#18 — The road closes (Spring 3, night, Varo)
PLOT:
- Ivo told them the duke had closed the south road, so they had to go through Varo's market.

OUTPUT
Only the new sections, in order, heading line first. No fences, no comments.`;

const MERGE_MAX_TOK = 12000;
const rangeOf = title => { const r = String(title).match(RANGE_HEAD); return r ? { prefix: (r[1] || '').trim(), from: Math.min(+r[2], +r[4]), to: Math.max(+r[2], +r[4]) } : null; };

// group: a "# ── AU ──" section to open on; without one, the newest log's group
export async function openMerge(group = null, keys = null) {
    const c = ctx(), m = getMeta();
    if (!draftReady()) return toastr.info('⚙ 설정 → AI · 번역 → 초안 모델을 먼저 정해 주세요.', '섹션 합치기');
    // the archive's groups that hold numbered sections: [{ start, label, secs }]
    const groups = () => {
        const secs = parseSections(m.text), out = [];
        let cur = { start: -1, label: '(묶음 밖)', level: 0, secs: [] };
        for (const x of secs) {
            if (x.group) { if (cur.secs.length) out.push(cur); cur = { start: x.start, label: groupLabel(x.title), level: x.level, secs: [] }; continue; }
            if (x.level === 1 && cur.start >= 0) { if (cur.secs.length) out.push(cur); cur = { start: -1, label: '(묶음 밖)', level: 0, secs: [] }; }
            if (RANGE_HEAD.test(x.title)) cur.secs.push(x);
        }
        if (cur.secs.length) out.push(cur);
        return out;
    };
    let gs = groups();
    if (!gs.length) return toastr.info('번호가 있는 섹션이 없어요.', '섹션 합치기');
    let gi = group ? Math.max(0, gs.findIndex(g => g.start === group.start)) : gs.length - 1;
    const $root = $(`
      <div class="na_popup na_v2 na_mg">
        <div class="na_v2_title"><b>섹션 합치기</b><small>이어진 섹션을 고르면 초안 모델이 어디서 끊을지 정해서 합쳐요 · 요약이 아니라 합치기</small></div>
        <select class="text_pole na_mg_group">${gs.map((g, i) => `<option value="${i}">${esc(g.label)} · 섹션 ${g.secs.length}개</option>`).join('')}</select>
        <div class="na_mg_pickhead"><small class="na_dim">두 섹션을 누르면 그 사이가 모두 골라져요</small><span class="na_rt_quick"><button type="button" class="na_pchip" data-all="1">전체</button><button type="button" class="na_pchip" data-all="0">비우기</button></span></div>
        <div class="na_mg_list"></div>
        <small class="na_v2_note na_mg_info"></small>
        <label class="na_v2_card na_v2_switchrow na_mg_rawrow"><span class="na_cp_txt"><span>원문 보고 다시 쓰기</span><small class="na_mg_rawinfo">순서나 번호가 틀렸을 때 · 고른 범위의 원문으로 처음부터 다시 써요</small></span><input type="checkbox" class="na_toggle na_mg_raw"></label>
        <button type="button" class="na_linkbtn na_mg_rawview" hidden>보낼 원문 보기 · 모델이 읽는 그대로</button>
        <div class="na_ly_ask na_mg_ask"><input type="text" class="na_ly_askq na_mg_q" placeholder="요청 (선택 · 예: 3개 정도로, 장면 단위로)" aria-label="요청" enterkeyhint="go"><button type="button" class="na_ly_askgo na_mg_go" aria-label="합치기" title="초안 모델로 합치기">${svgA(ICO_A.check, 17, 2.4)}</button></div>
        <div class="na_mg_res" hidden>
          <div class="na_rt_head"><b class="na_mg_restitle"></b></div>
          <div class="na_mg_warn" hidden></div>
          <div class="na_mg_out"></div>
          <button type="button" class="na_v2_btn primary wide na_mg_apply">이대로 합치기</button>
        </div>
      </div>`);
    // picked in the archive tab: open on their group with them ticked
    const fromKeys = () => {
        if (!keys?.length) return new Set();
        const g = gs.findIndex(x => x.secs.some(y => sectionKey(y) === keys[0]));
        if (g < 0) return new Set();
        gi = g;
        const idx = gs[g].secs.map((y, i) => (keys.includes(sectionKey(y)) ? i : -1)).filter(i => i >= 0);
        if (idx.length < keys.filter(k => gs.some(x => x.secs.some(y => sectionKey(y) === k))).length) toastr.info('고른 섹션이 여러 묶음에 걸쳐 있어서 첫 묶음 것만 골랐어요.', '섹션 합치기');
        return new Set(idx);
    };
    let picked = fromKeys(); // indexes into gs[gi].secs
    $root.find('.na_mg_group').val(String(gi));
    let result = null;      // { text, secs: [{ range, title, body, members }], first, last, issues }
    const secsNow = () => gs[gi].secs;
    const tokOf = x => Math.ceil(m.text.slice(x.start, x.end).length / 3.6);
    const rewrite = () => $root.find('.na_mg_raw').prop('checked');
    let rawSrc = null, rawFor_ = ''; // { raw, why, n, label, from } for the picked range
    const pickedRange = () => {
        const idx = [...picked].sort((a, b) => a - b);
        if (!idx.length) return null;
        const a = rangeOf(secsNow()[idx[0]].title), b = rangeOf(secsNow()[idx[idx.length - 1]].title);
        return { prefix: a.prefix, from: a.from, to: b.to, label: `${a.prefix ? `${a.prefix} ` : ''}#${a.from}–#${b.to}` };
    };
    const loadRaw = async () => {
        const r = pickedRange();
        const tag = r ? r.label : '';
        if (!rewrite() || !r || rawFor_ === tag) return;
        rawFor_ = tag; rawSrc = null;
        $root.find('.na_mg_rawinfo').text('원문 찾는 중…');
        const got = await rawFor(m, { title: `${r.prefix ? `${r.prefix} ` : ''}#${r.from}–#${r.to} — range` });
        if (rawFor_ !== tag) return;
        rawSrc = got.raw ? { ...got, tok: await countTokens(got.raw) } : got;
        drawList();
    };
    const contiguous = () => { const a = [...picked].sort((x, y) => x - y); return a.every((v, i) => !i || v === a[i - 1] + 1); };
    const drawList = () => {
        $root.find('.na_mg_list').html(secsNow().map((x, i) => {
            const r = rangeOf(x.title), sp = splitTitle(headLine(m.text, x));
            return `<label class="na_mg_row ${picked.has(i) ? 'on' : ''}"><input type="checkbox" data-i="${i}" ${picked.has(i) ? 'checked' : ''}>
              <span class="na_rt_txt"><small>${esc(`${r.prefix ? `${r.prefix} ` : ''}#${r.from}–#${r.to}`)}${sp?.tail ? ` · ${esc(sp.tail.trim().replace(/^\(|\)$/g, ''))}` : ''}</small><span>${esc(sp?.name || x.title)}</span></span></label>`;
        }).join(''));
        const sel = [...picked].map(i => secsNow()[i]);
        const tok = sel.reduce((a, x) => a + tokOf(x), 0);
        const rw = rewrite();
        const need = rw ? 1 : 2;
        const ok = picked.size >= need && contiguous() && tok <= MERGE_MAX_TOK && (!rw || !!rawSrc?.raw);
        $root.find('.na_mg_rawinfo').text(!rw ? '순서나 번호가 틀렸을 때 · 고른 범위의 원문으로 처음부터 다시 써요'
            : !picked.size ? '다시 쓸 섹션을 골라 주세요' : !rawSrc ? '원문 찾는 중…'
            : rawSrc.raw ? `원문 ${rawSrc.label} · ${rawSrc.from} · 메시지 ${rawSrc.n}개 · 약 ${fmt(rawSrc.tok)} 토큰${rawSrc.tok > 30000 ? ' · 길어요: 섹션을 나눠 골라 여러 번 하면 더 정확해요' : ''}` : `원문을 못 찾았어요 · ${rawSrc.why}`);
        $root.find('.na_mg_rawrow').toggleClass('warn', rw && !!rawSrc && (!rawSrc.raw || rawSrc.tok > 30000));
        $root.find('.na_mg_rawview').prop('hidden', !(rw && rawSrc?.raw));
        $root.find('.na_mg_go').attr('title', rw ? '초안 모델로 원문 보고 다시 쓰기' : '초안 모델로 합치기');
        if (rw && picked.size && contiguous()) loadRaw();
        $root.find('.na_mg_info').text(picked.size < need ? (rw ? '다시 쓸 섹션을 골라 주세요' : '이어진 섹션을 두 개 이상 골라 주세요')
            : !contiguous() ? '골라진 섹션 사이에 빠진 섹션이 있어요 · 이어진 섹션만 합칠 수 있어요'
            : tok > MERGE_MAX_TOK ? `너무 많아요 (약 ${fmt(tok)} 토큰) · 약 ${fmt(MERGE_MAX_TOK)} 토큰까지 한 번에 합쳐요`
            : `섹션 ${picked.size}개 · 약 ${fmt(tok)} 토큰 · ${esc(drLabel())}`).toggleClass('warn', picked.size >= need && !ok && !(rw && !rawSrc));
        $root.find('.na_mg_go').prop('disabled', !ok);
    };
    $root.on('change', '.na_mg_row input', function () {
        const i = Number(this.dataset.i);
        if (this.checked) {
            // a second tap fills the gap to the nearest picked section
            const others = [...picked];
            picked.add(i);
            if (others.length && !others.some(o => Math.abs(o - i) === 1)) {
                const near = others.reduce((a, o) => (Math.abs(o - i) < Math.abs(a - i) ? o : a), others[0]);
                for (let k = Math.min(near, i); k <= Math.max(near, i); k++) picked.add(k);
            }
        } else picked.delete(i);
        result = null; $root.find('.na_mg_res').prop('hidden', true);
        drawList();
    });
    $root.on('click', '.na_mg_pickhead .na_pchip', function () { picked = this.dataset.all === '1' ? new Set(secsNow().map((x, i) => i)) : new Set(); result = null; $root.find('.na_mg_res').prop('hidden', true); drawList(); });
    // the raw log as it will be sent (tags stripped by 압축 → 설정), to see what the model reads
    $root.find('.na_mg_rawview').on('click', () => {
        if (!rawSrc?.raw) return;
        c.callGenericPopup($(`<div class="na_popup na_v2"><div class="na_v2_title"><b>보낼 원문</b><small>${esc(rawSrc.label)} · 메시지 ${rawSrc.n}개 · 태그는 지우고, 압축 → 설정의 지울 태그 목록(scene_plan 등)을 따라요</small></div><pre class="na_mg_rawpre">${esc(rawSrc.raw)}</pre></div>`), c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
    });
    $root.find('.na_mg_raw').on('change', () => { result = null; $root.find('.na_mg_res').prop('hidden', true); $root.find('.na_mg_q').attr('placeholder', rewrite() ? '요청 (선택 · 예: 세트가 들어온 건 끝난 뒤야)' : '요청 (선택 · 예: 3개 정도로, 장면 단위로)'); drawList(); });
    $root.find('.na_mg_group').on('change', function () { gi = Number(this.value); picked = new Set(); result = null; $root.find('.na_mg_res').prop('hidden', true); drawList(); });
    const drawResult = () => {
        const $r = $root.find('.na_mg_res').prop('hidden', !result);
        if (!result) return;
        $root.find('.na_mg_restitle').text(`${result.rw ? '원문으로 다시 씀 · ' : ''}섹션 ${result.n}개 → ${result.secs.length}개`);
        $root.find('.na_mg_warn').prop('hidden', !result.issues.length).html(result.issues.map(x => `<div>! ${esc(x)}</div>`).join(''));
        $root.find('.na_mg_out').html(result.secs.map(x => `
          <details class="na_mg_card">
            <summary><span class="na_rt_txt"><small>${esc(x.range)}${x.paren ? ` · ${esc(x.paren)}` : ''}</small><b>${esc(x.name)}</b><small class="na_mg_members">${x.members.map(esc).join(' + ') || '들어간 섹션을 못 찾았어요'}</small></span></summary>
            <div class="na_mg_body">${esc(x.body.split('\n').slice(1).join('\n').trim())}</div>
          </details>`).join(''));
        const verb = result.rw ? '바꾸기' : '합치기';
        $root.find('.na_mg_apply').text(result.issues.length ? `확인했어요 · 이대로 ${verb}` : `이대로 ${verb}`);
        $r[0].scrollIntoView({ block: 'nearest' });
    };
    let busy = false;
    const go = async () => {
        if (busy || $root.find('.na_mg_go').prop('disabled')) return;
        const idx = [...picked].sort((a, b) => a - b), sel = idx.map(i => secsNow()[i]);
        const req = String($root.find('.na_mg_q').val() || '').trim();
        const src = sel.map(x => sectionBody(m.text.slice(x.start, x.end))).join('\n\n');
        busy = true;
        const $b = $root.find('.na_mg_go').prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i>');
        try {
            const est = Math.ceil(src.length / 3.6);
            const cap = Number(draftSettings().max) || 16000;
            const rw = rewrite() && rawSrc?.raw;
            let out;
            if (rw) {
                // the user's own compress instruction, told to redo this stretch from the raw log (no STATE / OPEN)
                const g = globalSettings(), r = pickedRange();
                const prev = secsNow()[idx[0] - 1];
                const head = `[REWRITE — read this first]
The archive's sections for ${r.label} were wrong (events out of order, numbers on the wrong events, or split too finely) and are being replaced. Write this stretch again from the raw log alone: new section blocks that cover #${r.from}–#${r.to} exactly, numbered by message, in the raw log's order${r.prefix ? `, each heading with the prefix "${r.prefix}" ("## ${r.prefix} #from–#to — …")` : ''}.
Every message the bot writes carries the same name tag, even when another character is the one speaking or acting. Decide who is present and who does what from the content, message by message.
Output only the section blocks. No "---", no STATE, no OPEN.

`;
                // the archive for context, minus the wrong sections being replaced (they would pull the model back to them)
                const withoutSel = m.text.slice(0, sel[0].start) + m.text.slice(sel[sel.length - 1].end);
                const body = fillPrompt(activePrompt(g).text, { raw: rawSrc.raw, from: String(r.from), to: String(r.to), last_section: prev ? `(Format sample only. Already in the archive — do not output it.)\n${sectionBody(m.text.slice(prev.start, prev.end))}` : '(없음)', state: '(Not needed here — do not output STATE or OPEN.)', archive: withoutSel });
                // the user's correction goes last, where it is read as the final word
                const tail = req ? `\n\n[USER'S CORRECTION — the user knows this story; this overrides any reading of the raw log that disagrees]\n${req}` : '';
                out = await askCompress(head + body + tail + langBlock(m.text));
            } else out = await askDraft(`SECTIONS:\n${src}${req ? `\n\nREQUEST:\n${req}` : ''}`, { system: AI_SYS_MERGE, maxTokens: Math.min(cap, Math.max(4000, Math.ceil(est * 1.5) + 2000)), effort: 'low' });
            out = stripThink(out).replace(/^```[a-z]*\n?|```\s*$/g, '').trim().split(/\n-{3,}\s*\n/)[0].replace(/\n# (STATE|OPEN)\b[\s\S]*$/, '').trim();
            const parts = parseSections(out).filter(x => !x.group && RANGE_HEAD.test(x.title));
            if (!parts.length) throw new Error('초안 모델이 섹션 형태로 답하지 않았어요');
            const olds = sel.map(x => ({ x, r: rangeOf(x.title) }));
            const first = olds[0].r, last = olds[olds.length - 1].r;
            const bounds = new Set(olds.map(o => o.r.from));
            const secs = parts.map(p => {
                const r = rangeOf(p.title), sp = splitTitle(`## ${p.title}`);
                const members = olds.filter(o => rw ? o.r.from <= r.to && o.r.to >= r.from : o.r.from >= r.from && o.r.to <= r.to).map(o => `#${o.r.from}–#${o.r.to}`);
                return { r, range: `${r.prefix ? `${r.prefix} ` : ''}#${r.from}–#${r.to}`, name: sp?.name || p.title, paren: (sp?.tail || '').trim().replace(/^\(|\)$/g, ''), body: trimEnd(out.slice(p.start, p.end)), members };
            });
            // checks: same prefix, exact cover, cuts on old boundaries, quotes copied from the sections
            const issues = [];
            if (secs.some(s => s.r.prefix !== first.prefix)) issues.push(`번호 앞글자가 바뀐 섹션이 있어요 (원래 "${first.prefix || '없음'}")`);
            if (secs[0].r.from !== first.from || secs[secs.length - 1].r.to !== last.to) issues.push(`합친 범위가 #${first.from}–#${last.to}와 달라요 (#${secs[0].r.from}–#${secs[secs.length - 1].r.to})`);
            secs.forEach((s, i) => { if (i && s.r.from !== secs[i - 1].r.to + 1) issues.push(`#${secs[i - 1].r.to}와 #${s.r.from} 사이가 ${s.r.from > secs[i - 1].r.to + 1 ? '비었어요' : '겹쳐요'}`); });
            if (!rw) secs.forEach(s => { if (!bounds.has(s.r.from)) issues.push(`${s.range}가 원래 섹션 중간에서 시작해요`); });
            if (!rw && secs.length >= sel.length) issues.push('섹션 수가 줄지 않았어요');
            const bad = changedQuotes(rw ? `${src}\n${rawSrc.raw}` : src, out);
            if (bad.length) issues.push(`원래 섹션에 없거나 바뀐 대사 ${bad.length}개: ${bad.slice(0, 3).map(q => `"${q.slice(0, 40)}"`).join(', ')}`);
            const origTok = Math.ceil(src.length / 3.6), newTok = Math.ceil(secs.reduce((a, s) => a + s.body.length, 0) / 3.6);
            if (!rw && newTok < origTok * 0.7) issues.push(`내용이 꽤 줄었어요 (약 ${fmt(origTok)} → ${fmt(newTok)} 토큰) · 빠진 게 없는지 봐 주세요`);
            result = { secs, sel, n: sel.length, issues, rw: !!rw };
            drawResult();
        } catch (e) {
            console.error('[NarrativeArchive] merge', e);
            toastr.error(String(e?.message || e), '섹션 합치기');
        } finally { busy = false; $b.html(svgA(ICO_A.check, 17, 2.4)); drawList(); }
    };
    $root.find('.na_mg_go').on('click', go);
    $root.find('.na_mg_q').on('keydown', e => { if (e.key === 'Enter' && !e.originalEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); go(); } });
    $root.find('.na_mg_apply').on('click', async () => {
        if (!result) return;
        const cur = getMeta();
        const { sel, secs } = result;
        // still where they were read?
        const now = new Map(parseSections(cur.text).map(x => [sectionKey(x), x.start]));
        if (sel.some(x => now.get(sectionKey(x)) !== x.start)) return toastr.warning('아카이브가 그사이 바뀌었어요. 창을 닫고 다시 해 주세요.', '섹션 합치기');
        const a = sel[0].start, b = sel[sel.length - 1].end;
        const trail = cur.text.slice(a, b).match(ruleTail)[0] || '\n\n';
        const block = secs.map(s => s.body).join('\n\n');
        const next = cur.text.slice(0, a) + block + trail + cur.text.slice(b);
        // settings follow: pinned if any part was, muted if every part was, keywords pooled; short versions are dropped
        const fresh = parseSections(next).filter(x => !x.group && x.start >= a && x.start < a + block.length);
        const muted = new Set(cur.muted || []), pinned = new Set(cur.pinned || []), linked = { ...linkedMap(cur) };
        fresh.forEach((f, i) => {
            const r = secs[i]?.r;
            const parts = r ? sel.filter(x => { const o = rangeOf(x.title); return result.rw ? o.from <= r.to && o.to >= r.from : o.from >= r.from && o.to <= r.to; }) : [];
            const keys = parts.map(sectionKey), nk = sectionKey(f);
            if (keys.length && keys.every(k => muted.has(k))) muted.add(nk);
            if (keys.some(k => pinned.has(k))) pinned.add(nk);
            const kw = [...new Set(keys.flatMap(k => linked[k] || []))];
            if (kw.length) linked[nk] = kw;
        });
        for (const x of sel) {
            const k = sectionKey(x);
            if (fresh.some(f => sectionKey(f) === k)) continue;
            muted.delete(k); pinned.delete(k); delete linked[k];
            if (cur.layers) delete cur.layers[k];
        }
        cur.muted = [...muted]; cur.pinned = [...pinned]; cur.linked = linked;
        cur.retitled = [...new Set([...(cur.retitled || []), ...fresh.map(sectionKey)])];
        await commitText(next, `${result.rw ? '원문으로 다시 쓰기' : '섹션 합치기'} 전 (${sel.length}개 → ${secs.length}개)`);
        toastr.success(`섹션 ${sel.length}개를 ${secs.length}개로 ${result.rw ? '다시 썼어요' : '합쳤어요'} · 이전 상태는 복구 지점에 있어요`, '섹션 합치기');
        rawFor_ = ''; rawSrc = null;
        gs = groups(); gi = Math.min(gi, gs.length - 1); picked = new Set(); result = null;
        $root.find('.na_mg_group').html(gs.map((g, i) => `<option value="${i}">${esc(g.label)} · 섹션 ${g.secs.length}개</option>`).join('')).val(String(gi));
        drawResult(); drawList();
    });
    drawList();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}
