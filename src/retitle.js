// Asking the draft model to rework archive sections: new titles for many sections at once,
// and one section rewritten the way the user asks (with its raw messages when they can be found).

import { askDraft, drLabel, draftReady, stripThink } from './ai.js';
import { fetchOtherChat } from './chats.js';
import { commitText, ctx, getMeta, saveMeta } from './core.js';
import { lineDiff, renderDiff } from './diff.js';
import { cleanMessage, extractToText } from './extract.js';
import { mountSectionPicker } from './picker.js';
import { RANGE_HEAD, keyAt, parseSections, renameKeys, sectionKey, trimEnd } from './sections.js';
import { sourceRange } from './source.js';
import { ICO_A, svgA } from './theme.js';
import { confirm, countTokens, esc, fmt } from './util.js';

export const AI_SYS_RETITLE = `GOAL
Give each section of a story archive a title that reads like a book's table of contents.

YOU GET
SECTIONS: numbered sections. Each shows its current title, then its text.

STEPS
1. Read each section.
2. Write its title: two to six words, concrete and evocative — the scene's key object, place or act, or a defining line in quotation marks copied exactly from the section.
3. A title names the scene; it does not summarize it. No semicolons, no "X does this; Y does that."
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
2 | The closed road
3 | The confession

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

// ---- 제목 다시 짓기: picked sections, a few thousand tokens at a time, then a before → after list to tick

// group: a "# ── AU ──" section to start with ticked; without one, the newest log is
export async function openRetitle(group = null) {
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
        filter: ranged, initial: startKeys,
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

async function rawFor(m, s) {
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
    const original = trimEnd(m.text.slice(s.start, s.end));
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
            const prompt = `SECTION:\n${draft}\n\n${useRaw ? `RAW LOG:\n${src.raw}\n\n` : ''}${asked.length ? `EARLIER REQUESTS:\n${asked.map(x => `- ${x}`).join('\n')}\n\n` : ''}REQUEST:\n${q}`;
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
        if (trimEnd(cur.text.slice(s.start, s.end)) !== original) { toastr.warning('아카이브가 그사이 바뀌어서 적용하지 않았어요. 다시 열어 주세요.'); return false; }
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

