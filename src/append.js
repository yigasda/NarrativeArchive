// Adding new sections to the archive: checks, preview and the append popup.

import { aiHtml, askAI, askCompress, draftReady, stripThink, withSpinner } from './ai.js';
import { commitText, ctx, getMeta, sectionChanges } from './core.js';
import { lineDiff, renderDiff } from './diff.js';
import { guessEndNumber } from './extract.js';
import { applyHide } from './hide.js';
import { driftHtml } from './drift.js';
import { nameNearMisses } from './keywords.js';
import { auDivider, auFix, auOf } from './prompts.js';
import { RANGE_HEAD, headingRanges, lastRangeEnd, parseSections, splitTail, tailBlocks, trimEnd } from './sections.js';
import { rawFor } from './retitle.js';
import { openSource } from './source.js';
import { ICO_A, SVG_B, svgA, svgB } from './theme.js';
import { translateButton } from './translate.js';
import { confirm, countTokens, esc, fmt } from './util.js';

export const AI_SYS_CONFLICT = `GOAL
Before NEW TEXT is added to the story archive, find places where it contradicts the EXISTING ARCHIVE.

YOU GET
- EXISTING ARCHIVE: the story so far. Its end (latest sections, STATE, OPEN) is what is true now.
- NEW TEXT: new section blocks to add. It may end with new STATE and OPEN blocks that will REPLACE the old ones.

HOW TO WORK
Step 1. Read the NEW TEXT one bullet at a time.
Step 2. For each bullet, check the EXISTING ARCHIVE for anything it clashes with.

REPORT ONLY THESE (each must clash with something the archive actually says)
1. NAME: the same person, place or thing spelled differently. e.g. "Mirabel" in the archive, "Mirabelle" in the new text.
2. TIME: dates or time of day going backwards compared with where the archive ended.
3. FACT: a fact that contradicts one already established (who did what, injuries, objects, relationships, places).
4. SETTLED: something the archive marks as resolved is reopened, or something open is treated as already resolved, with no reason given.
5. PLACE: a character in two places at once.

DO NOT REPORT
- New events, new people, new places: the story moving on is not a contradiction.
- The new STATE / OPEN being different from the old ones: they are meant to replace them. Only report it if they clash with the NEW sections themselves.
- Style, length, or anything that could be "added".
- Anything you are not sure about.

OUTPUT: Korean, one bullet per problem, exactly like this
- <무엇이 어긋나는지> — 근거 (<기존 아카이브의 섹션 제목>)
If there is no problem, write exactly: 없음`;

export const AI_SYS_DRAFTFIX = `GOAL
Revise a DRAFT of new story-archive sections (and its STATE / OPEN) the way the user asks — and nothing else.

YOU GET
- DRAFT: new section blocks ("## #from–#to — Title (date, place)", then bullets), maybe followed by "---" and STATE / OPEN.
- RAW LOG (sometimes): the messages the draft was made from, each starting with [number] and the speaker. It is the only source of new facts and quotes. Every message the bot writes carries the same name tag, even when another character speaks or acts; tell who does what from the content.
- EARLIER REQUESTS (sometimes): what the user already asked for. They are done; keep them done.
- REQUEST: what the user wants changed now. It may be in Korean. The user knows this story: where REQUEST and your reading of the raw log disagree, REQUEST wins.

STEPS
1. Do what REQUEST asks. Leave everything else word for word: the other sections and bullets, the headings' ranges, dates and places (unless asked), and STATE / OPEN (unless the change means they must say something different).
2. The sections must still cover the same message range with no gaps or overlaps. If you merge or split sections, renumber their headings from the RAW LOG.
3. New facts and quotes come only from DRAFT or RAW LOG. Never invent or paraphrase a line and present it as a quote.
4. Keep the archive's rules: one bullet = one event; the action that caused a reaction comes before it; a character's interpretation only as theirs; no commentary; same language as the DRAFT.
5. If part of the request cannot be done, do the rest and say what was not done on a last line that starts with "NOTE:", in Korean.

EXAMPLE
DRAFT:
## #12–#18 — The bridge (Spring 3, Varo)
PLOT:
- Ivo arrived while Ren was still hurt; Mara pulled Ren up from the broken plank.
REQUEST:
순서 틀렸어. 마라가 먼저 끌어올리고 그 다음에 이보가 왔어

Answer:
## #12–#18 — The bridge (Spring 3, Varo)
PLOT:
- Mara pulled Ren up from the broken plank; Ivo arrived afterward, while Ren was still hurt.

OUTPUT
The whole revised draft, then an optional NOTE line. No fences, no comments.`;

// Returns { text, placed, replaced: [keys], renumbered }
// Pasted sections whose numbers the archive already covers (a model rewriting the format sample, say).
// 'skip' leaves them out; 'replace' swaps an exact match (same prefix and range) in place of the old one.
export function findRewrites(eBody, pBody) {
    const existing = parseSections(eBody).filter(x => !x.group).map(x => ({ s: x, r: x.title.match(RANGE_HEAD) })).filter(x => x.r);
    const covered = new Map(); // prefix → highest number in the archive
    for (const { r } of existing) {
        const pre = (r[1] || '').trim(), to = Math.max(parseInt(r[2], 10), parseInt(r[4], 10));
        covered.set(pre, Math.max(covered.get(pre) ?? -1, to));
    }
    const groupTitles = new Set(parseSections(eBody).filter(x => x.group || x.level === 1).map(x => x.title.trim()));
    const out = [];
    for (const sec of parseSections(pBody)) {
        if (sec.title === '(머리말)' || sec.title === '(제목 없음)') continue;
        const r = sec.title.match(RANGE_HEAD);
        if (!r) {
            // a "# ── Y2 ──" divider (or the archive title) that the archive already has
            if (sec.level === 1 && groupTitles.has(sec.title.trim()) && !sec.note) out.push({ sec, kind: 'divider' });
            continue;
        }
        const pre = (r[1] || '').trim(), from = parseInt(r[2], 10), to = parseInt(r[4], 10);
        if (!covered.has(pre) || Math.min(from, to) > covered.get(pre)) continue;
        const same = existing.find(x => (x.r[1] || '').trim() === pre && parseInt(x.r[2], 10) === from && parseInt(x.r[4], 10) === to);
        out.push({ sec, kind: same ? 'exact' : 'overlap', old: same?.s });
    }
    return out;
}

// the pasted text minus sections the archive already has (what the number check should look at)
export function stripRewrites(archive, add) {
    const [eBody] = splitTail(archive);
    const [pBody, pTail] = splitTail(add);
    const p = trimEnd(pBody).replace(/\n-{3,}\s*$/, '');
    const drop = new Set(findRewrites(trimEnd(eBody).replace(/\n-{3,}\s*$/, ''), p).map(f => f.sec.start));
    if (!drop.size) return add;
    return `${trimEnd(parseSections(p).filter(x => !drop.has(x.start)).map(x => p.slice(x.start, x.end)).join(''))}${pTail ? `\n\n${pTail}` : ''}`;
}

export function placeAppend(archive, add, { renumber, rewrites = 'skip' } = {}) {
    const [eBody, eTail] = splitTail(archive);
    const [pBody, pTail] = splitTail(add);
    const sep = /\n-{3,}\s*$/.test(trimEnd(eBody));
    let body = trimEnd(eBody).replace(/\n-{3,}\s*$/, '');
    let pClean = trimEnd(pBody).replace(/\n-{3,}\s*$/, '');
    const found = findRewrites(body, pClean);
    const skipped = [], swapped = [];
    if (found.length) {
        const drop = new Set(found.map(f => f.sec.start));
        // replace exact matches in place (from the end so earlier offsets stay valid)
        if (rewrites === 'replace') {
            const exact = found.filter(f => f.kind === 'exact').sort((x, y) => y.old.start - x.old.start);
            for (const f of exact) {
                const oldTrail = body.slice(f.old.start, f.old.end).match(/\s*$/)[0] || '\n\n';
                body = body.slice(0, f.old.start) + trimEnd(pClean.slice(f.sec.start, f.sec.end)) + oldTrail + body.slice(f.old.end);
                swapped.push(f.sec.title);
            }
        }
        found.filter(f => !(rewrites === 'replace' && f.kind === 'exact') && f.kind !== 'divider').forEach(f => skipped.push(f.sec.title));
        pClean = trimEnd(parseSections(pClean).filter(x => !drop.has(x.start)).map(x => pClean.slice(x.start, x.end)).join(''));
        body = trimEnd(body);
    }
    if (pClean.trim()) body = `${trimEnd(body)}${body.trim() ? '\n\n' : ''}${pClean}`;

    const eBlocks = tailBlocks(eTail), pBlocks = tailBlocks(pTail);
    const replaced = [];
    const blocks = eBlocks.map(b => {
        const nb = pBlocks.find(x => x.key === b.key);
        if (nb) replaced.push(b.key);
        return nb || b;
    });
    pBlocks.filter(x => !eBlocks.some(b => b.key === x.key)).forEach(x => blocks.push(x));

    let renumbered = null;
    const oldEnd = lastRangeEnd(eBody), newEnd = lastRangeEnd(pBody);
    // only within one log: an AU's #40 says nothing about the main story's #604 in the title
    const samePrefix = (headingRanges(eBody).pop()?.prefix ?? '') === (headingRanges(pBody).pop()?.prefix ?? '');
    if (renumber && samePrefix && oldEnd !== null && newEnd !== null && newEnd > oldEnd) {
        const swap = line => line.replace(new RegExp(`#${oldEnd}(?!\\d)`, 'g'), `#${newEnd}`);
        // a top "# " title line and the intro lines under it, up to the next heading
        const lines = body.split('\n');
        if (/^# /.test(lines[0] || '')) {
            for (let i = 0; i < lines.length; i++) {
                if (i > 0 && /^#{1,3} /.test(lines[i])) break;
                lines[i] = swap(lines[i]);
            }
        }
        body = lines.join('\n');
        // STATE/OPEN headings + their first note line, unless just replaced
        blocks.forEach((b, i) => {
            if (replaced.includes(b.key) || pBlocks.includes(b)) return;
            const ls = b.text.split('\n');
            for (let k = 0; k < Math.min(ls.length, 4); k++) if (k === 0 || /^_.*_$/.test(ls[k].trim())) ls[k] = swap(ls[k]);
            blocks[i] = { ...b, text: ls.join('\n') };
        });
        renumbered = { from: oldEnd, to: newEnd };
    }

    let text = trimEnd(body);
    if (blocks.length) text += `${sep || eTail ? '\n\n---\n\n' : '\n\n'}${blocks.map(b => b.text).join('\n\n')}`;
    return { text: `${text}\n`, placed: !!eTail && !!pClean.trim(), replaced, renumbered, skipped, swapped, rewriteCount: found.filter(f => f.kind !== 'divider').length, exactCount: found.filter(f => f.kind === 'exact').length };
}

// Signs that a pasted (AI) answer stopped early. Display strings, empty if it looks complete.
export function cutSigns(archive, add) {
    const out = [];
    const [, eTail] = splitTail(archive);
    const [, pTail] = splitTail(add);
    const hasBlocks = k => new RegExp(`^# ${k}\\b`, 'm');
    const missing = ['STATE', 'OPEN'].filter(k => hasBlocks(k).test(eTail) && !hasBlocks(k).test(pTail));
    if (missing.length) out.push(`${missing.join('·')} 블록이 없어요. 이대로 추가하면 예전 ${missing.join('·')} 블록이 그대로 남아요.`);
    const lastLine = (add.trim().split('\n').filter(l => l.trim()).pop() || '').trim();
    const ends = /[.!?。…"'”’)\]_*~」』>]$|[다요음함임됨짐]$|^#{1,3} |^-{3,}$/;
    if (lastLine && !ends.test(lastLine)) out.push(`마지막 줄이 문장 중간에서 끝나요: "…${lastLine.slice(-40)}"`);
    return out;
}

// "# STATE AT AU #145" over sections that end at #143: the number the STATE / OPEN headings carry vs the sections' end
export function tailNumberGap(text) {
    const rs = headingRanges(splitTail(text)[0]);
    const end = rs.length ? Math.max(rs[rs.length - 1].from, rs[rs.length - 1].to) : null;
    const mt = splitTail(text)[1].match(/^# (?:STATE|OPEN) AT\s+(?:(\S{1,12})\s+)?#(\d+)/m);
    if (end === null || !mt) return null;
    const at = Number(mt[2]);
    return at === end ? null : { at, end, prefix: rs[rs.length - 1].prefix };
}
// STATE / OPEN headings and their "_True at #n_" lines moved to the sections' end
export function fixTailNumber(text, gap) {
    const [body, tail] = splitTail(text);
    const re = new RegExp(`((?:STATE|OPEN) AT\\s+(?:\\S{1,12}\\s+)?#|(?:True|Unresolved) at\\s+(?:\\S{1,12}\\s+)?#)${gap.at}(?!\\d)`, 'g');
    return body + tail.replace(re, `$1${gap.end}`);
}

// Problems with the numbering of pasted sections, as display strings.
export function checkAppend(m, add, last) {
    const ranges = headingRanges(add);
    const issues = [];
    if (!ranges.length) return { ranges, issues: ['제목에서 "#시작–#끝" 번호를 못 찾았어요. 번호 검사는 건너뛰어요.'], soft: true };
    const label = r => `${r.prefix ? `${r.prefix} ` : ''}#`;
    // continues the archive: compare with the archive's last numbered section of the same prefix
    const mine = headingRanges(m.text);
    const lastA = mine[mine.length - 1];
    if (lastA) {
        const first = ranges.find(r => r.prefix === lastA.prefix);
        const want = lastA.to + 1;
        if (first && first.from > want) issues.push(`첫 섹션이 ${label(first)}${first.from}부터예요. ${label(first)}${want}${first.from - 1 > want ? `–#${first.from - 1}` : ''} (${first.from - want}개)가 빠졌어요.`);
        else if (first && first.from < want) issues.push(`첫 섹션 ${label(first)}${first.from}가 아카이브에 이미 있는 ${label(lastA)}${lastA.to}까지와 겹쳐요.`);
    }
    // numbering restarts per prefix (Y1, Y2 …), so check continuity within each
    const lastBy = new Map();
    for (const r of ranges) {
        if (r.from > r.to) issues.push(`"${r.title}" — 시작 #${r.from}이 끝 #${r.to}보다 커요.`);
        const prev = lastBy.get(r.prefix);
        if (prev) {
            if (r.from > prev.to + 1) issues.push(`${label(r)}${prev.to}와 #${r.from} 사이 #${prev.to + 1}${r.from - 1 > prev.to + 1 ? `–#${r.from - 1}` : ''}가 빠졌어요.`);
            else if (r.from <= prev.to) issues.push(`"${r.title}"가 앞 섹션(${label(prev)}${prev.to}까지)과 겹쳐요.`);
        }
        lastBy.set(r.prefix, r);
    }
    const end = ranges[ranges.length - 1];
    if (end.to > last) issues.push(`끝 ${label(end)}${end.to}가 채팅 마지막 #${last}보다 커요.`);
    return { ranges, issues, soft: false };
}

// a paste that carries most of the archive's numbered sections is a whole new version, not new sections
export function looksWhole(archive, add) {
    const [eBody] = splitTail(archive);
    const eb = trimEnd(eBody).replace(/\n-{3,}\s*$/, '');
    const n = parseSections(eb).filter(x => !x.group && RANGE_HEAD.test(x.title)).length;
    if (n < 3) return false;
    const pb = trimEnd(splitTail(add)[0]).replace(/\n-{3,}\s*$/, '');
    return findRewrites(eb, pb).filter(f => f.kind !== 'divider').length >= Math.ceil(n * 0.8);
}

// shows what a whole-archive swap changes; true once confirmed
export async function confirmWhole(oldText, newText) {
    const c = ctx();
    const ch = sectionChanges(oldText, newText);
    const rows = lineDiff(oldText, newText);
    const add = rows.filter(r => r.t === '+').length, del = rows.filter(r => r.t === '-').length;
    const list = (label, xs) => xs.length ? `<div class="na_whole_sum"><b>${label} ${xs.length}개</b><ul>${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    const counts = [['새', ch.added], ['바뀜', ch.changed], ['제목', ch.renamed], ['없어짐', ch.removed]].filter(([, xs]) => xs.length).map(([k, xs]) => `${k} ${xs.length}`);
    const $v = $(`
      <div class="na_popup na_popup_fill">
        <div class="na_diff_head">
          <b>아카이브를 통째로 바꿔요</b>
          <span class="na_chip na_chip_add">+${fmt(add)}줄</span><span class="na_chip na_chip_del">−${fmt(del)}줄</span>
        </div>
        ${counts.length ? `<details class="na_whole_sums"><summary>섹션 변화 · ${counts.join(' · ')}</summary>
          ${list('새 섹션', ch.added)}${list('내용이 바뀐 섹션', ch.changed)}${list('제목이 바뀐 섹션', ch.renamed)}${list('없어지는 섹션', ch.removed)}
        </details>` : '<div class="na_empty">섹션은 그대로예요.</div>'}
        <small class="na_dim">지금 아카이브는 "통째로 바꾸기 전" 복구 지점으로 남아요.</small>
        <div class="na_diff">${add || del ? renderDiff(rows) : '<div class="na_empty">내용이 똑같아요.</div>'}</div>
      </div>`);
    if (add || del) $v.find('.na_diff_head').append(translateButton($v.find('.na_diff')));
    const r = await c.callGenericPopup($v, c.POPUP_TYPE.CONFIRM, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '통째로 바꾸기', cancelButton: '취소' });
    return r === c.POPUP_RESULT.AFFIRMATIVE || r === true;
}

export async function openAppend(prefill = {}) {
    const c = ctx();
    const m = getMeta();
    const last = (c.chat?.length || 0) - 1;
    const pre = prefill && typeof prefill === 'object' && 'text' in prefill ? prefill : {};

    const $root = $(`
      <div class="na_popup na_v2 na_ap2">
        <div class="na_v2_titlebar">
          <div class="na_v2_title"><b>아카이브에 추가</b><small>STATE·OPEN 앞에 넣고, 새 STATE로 바꿔요</small></div>
          <button type="button" class="na_v2_pillbtn na_append_file_btn" title="파일에서 불러오기">.txt</button>
          <input type="file" class="na_append_file" accept=".txt,.md,text/plain" hidden>
        </div>
        <textarea class="text_pole na_append_ta" spellcheck="false" placeholder="## Y2 #574–#600 — 제목 (날짜, 장소)&#10;PLOT:&#10;- …"></textarea>
        ${draftReady() ? `<div class="na_apf">
          <div class="na_sf_log na_apf_log"></div>
          <div class="na_sf_note na_apf_note" hidden></div>
          <div class="na_ly_ask"><input type="text" class="na_ly_askq na_apf_q" placeholder="초안 고쳐 달라고 하기 (예: #60 이후 더 줄여줘)" aria-label="초안 고쳐 달라고 하기" enterkeyhint="send"><button type="button" class="na_ly_askgo na_apf_go" aria-label="보내기" title="초안 모델에게 보내기">${svgA('M22 2L11 13M22 2l-7 20-4-9-9-4z', 17)}</button></div>
          <div class="na_apf_foot"><label class="checkbox_label"><input type="checkbox" class="na_apf_raw" checked><span>원문 같이 보내기 <small class="na_apf_rawinfo"></small></span></label><button type="button" class="na_linkbtn na_apf_undo" hidden>처음으로</button></div>
        </div>` : ''}
        <div class="na_v2_card na_v2_list na_ap2_checks">
          <div class="na_ap2_label"><span>붙여넣은 글 검사</span><small class="na_append_info"></small></div>
          <div class="na_check na_aucheck" hidden></div>
          <div class="na_check na_numcheck" hidden></div>
          <div class="na_check na_statecheck" hidden></div>
          <div class="na_check na_check_warn na_whole" hidden><span class="na_ck_ic">!</span><div>
            <b>아카이브 전체본 같아요</b> — 이미 있는 섹션이 거의 다 들어 있어요. 새 섹션만 붙이려면 그대로 <b>추가</b>, 이 내용으로 아카이브를 바꾸려면:
            <div class="na_whole_row"><button type="button" class="na_btn na_small na_whole_btn"><i class="fa-solid fa-right-left"></i> 통째로 바꾸기</button></div>
          </div></div>
          <div class="na_check na_check_warn na_rw" hidden></div>
          <div class="na_check na_check_warn na_names" hidden></div>
          <div class="na_check na_cut" hidden></div>
          <div class="na_ai_box na_grade_out" hidden></div>
          <button type="button" class="na_cp_row na_ai_conflict" title="기존 아카이브와 어긋나는 이름·날짜·사실·해결된 떡밥을 AI가 찾아요">${svgB(SVG_B.star, 14)} AI로 충돌 검사 · 날짜·사실·해결된 떡밥</button>
          <div class="na_ai_box na_conflict_out" hidden></div>
        </div>
        <div class="na_v2_card na_v2_list">
          <label class="na_cp_row"><span class="na_cp_txt"><span>이번에 압축한 끝 번호</span><small class="na_end_hint"></small></span><span class="na_ap2_end">#<input type="number" class="na_end" min="0" max="${last}" value="${Math.max(0, last)}"></span></label>
          <label class="na_cp_row"><span class="na_cp_txt"><span>추가한 뒤 숨기기</span><small class="na_hide_hint">마지막 ${m.keep}개는 남겨요</small></span><input type="checkbox" class="na_toggle na_do_hide" checked></label>
          <label class="na_cp_row na_renum_row"><span class="na_cp_txt"><span class="na_renum_label">제목·안내문의 끝 번호도 바꾸기</span></span><input type="checkbox" class="na_toggle na_do_renum" checked></label>
        </div>
        <details class="na_v2_card na_v2_more na_ap_preview" hidden>
          <summary>추가하면 바뀌는 부분 <span class="na_chip na_chip_add na_ap_add"></span><span class="na_chip na_chip_del na_ap_del"></span></summary>
          <div><div class="na_ap_tr_row"></div><div class="na_diff na_ap_diff"></div></div>
        </details>
        <div class="na_ap2_btns">
          <button type="button" class="na_ap2_pv">미리보기</button>
          <button type="button" class="na_ap2_go">추가하기</button>
        </div>
      </div>`);

    const $ta = $root.find('.na_append_ta');
    // 한 번에 압축 asked for #from–#to: say so when the sections stop short of it
    const shortOf = v => {
        if (!Number.isFinite(pre.expectTo)) return [];
        const rs = headingRanges(splitTail(v)[0]);
        const end = rs.length ? Math.max(rs[rs.length - 1].from, rs[rs.length - 1].to) : null;
        return end !== null && end < pre.expectTo ? [`압축한 범위는 #${pre.expectTo}까지인데 섹션은 #${end}까지예요 · #${end + 1}–#${pre.expectTo}가 빠졌어요 (추가하면 경계선은 #${end}, 빠진 건 다음 압축에서 이어져요)`] : [];
    };
    const $end = $root.find('.na_end');
    $root.find('.na_append_file_btn').on('click', () => $root.find('.na_append_file').val('').trigger('click'));
    $root.find('.na_append_file').on('change', async function () {
        const file = this.files?.[0];
        if (!file) return;
        const text = (await file.text()).replace(/\r\n/g, '\n').trim();
        if ($ta.val().trim() && !await confirm('불러오기', '붙여넣은 내용을 이 파일 내용으로 바꿀까요?')) return;
        $ta.val(text).trigger('input');
        toastr.success(`불러옴: ${file.name}`);
    });
    const $check = $root.find('.na_numcheck');
    $root.find('.na_renum_row').hide();
    let lastPlan = null;
    const $pv = $root.find('.na_ap_preview');
    const apTr = translateButton($root.find('.na_ap_diff'));
    $root.find('.na_ap_tr_row').append(apTr);
    let pvWanted = false; // the preview card shows once 미리보기 is pressed
    function renderPreview(plan) {
        lastPlan = plan;
        if (!plan || !$ta.val().trim() || !pvWanted) { $pv.prop('hidden', true); return; }
        const rows = lineDiff(m.text, plan.text);
        const add = rows.filter(r => r.t === '+').length, del = rows.filter(r => r.t === '-').length;
        $pv.prop('hidden', false);
        $root.find('.na_ap_add').text(`+${fmt(add)}줄`);
        $root.find('.na_ap_del').text(`−${fmt(del)}줄`).toggle(!!del);
        apTr.reset();
        if ($pv.prop('open')) $root.find('.na_ap_diff').html(add || del ? renderDiff(rows) : '<div class="na_empty">바뀌는 게 없어요.</div>');
        else $root.find('.na_ap_diff').empty();
    }
    $pv.on('toggle', () => renderPreview(lastPlan));
    $root.find('.na_ap2_pv').on('click', () => {
        if (!$ta.val().trim()) return toastr.info('먼저 추가할 내용을 붙여넣어 주세요.');
        pvWanted = true;
        $pv.prop('open', true);
        renderPreview(lastPlan || placeAppend(m.text, auFix($ta.val(), m), { renumber: $root.find('.na_do_renum').prop('checked'), rewrites: rwMode() }));
        $pv[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    $root.find('.na_ap2_go').on('click', () => $root.closest('dialog').find('.popup-button-ok').trigger('click'));
    // one check row: round ✓ / ! mark, title, sub line, optional button
    const ckRow = ($el, tone, title, sub = '', btn = '') => $el.prop('hidden', false)
        .attr('class', `${$el.attr('class').replace(/\bna_check_(ok|warn|soft)\b/g, '').replace(/\s+/g, ' ').trim()} na_check_${tone}`)
        .html(`<span class="na_ck_ic">${tone === 'ok' ? '✓' : '!'}</span><span class="na_cp_txt"><span>${title}</span>${sub ? `<small>${sub}</small>` : ''}</span>${btn}`);
    const hideHint = () => {
        const end = parseInt($end.val(), 10), keep = Math.max(0, Number(m.keep) || 0);
        const to = end - keep;
        $root.find('.na_hide_hint').text(Number.isFinite(end) && to >= 0 ? `#0 – #${to} 숨김 · 마지막 ${keep}개 남김` : `마지막 ${keep}개는 남겨요`);
    };
    $end.on('input change', hideHint);
    let nearMiss = [];
    $root.on('click', '.na_tailfix', () => {
        const v = $ta.val(), gap = tailNumberGap(auFix(v, m));
        if (!gap) return;
        $ta.val(fixTailNumber(auFix(v, m), gap)).trigger('input');
        toastr.success(`STATE·OPEN 번호를 #${gap.end}로 맞췄어요`);
    });
    $root.on('click', '.na_names_fix', () => {
        let v = $ta.val();
        nearMiss.forEach(x => { v = v.replace(new RegExp(`\\b${x.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), x.like); });
        $ta.val(v).trigger('input');
        toastr.success(nearMiss.map(x => `${x.word} → ${x.like}`).join(', '));
    });
    $root.find('.na_do_renum').on('change', () => $ta.trigger('input'));
    let rwReplace = false;
    const rwMode = () => rwReplace ? 'replace' : 'skip';
    $root.on('change', '.na_rw_replace', function () { rwReplace = this.checked; $ta.trigger('input'); });
    let wantWhole = false;
    $root.find('.na_whole_btn').on('click', () => { wantWhole = true; $root.closest('dialog').find('.popup-button-cancel').trigger('click'); });
    let endTouched = false;
    let lastCheck = { issues: [] };
    $end.on('input', () => { endTouched = true; $root.find('.na_end_hint').text(''); });
    hideHint();
    let t;
    $ta.on('input', () => {
        $root.find('.na_conflict_out').addClass('na_stale'); // checked text changed since
        clearTimeout(t);
        t = setTimeout(async () => {
            const val = auFix($ta.val(), m);
            // an AU chat's sections go in as their own log; say so, and what the paste was missing
            const au = auOf(m);
            if (au.on && val.trim()) {
                const added = [val !== $ta.val() && `${au.name} #번호`, val.includes(auDivider(au.name)) && !$ta.val().includes(auDivider(au.name)) && auDivider(au.name)].filter(Boolean);
                ckRow($root.find('.na_aucheck'), 'ok', `${esc(au.name)} 묶음으로 넣어요`, added.length ? `빠진 ${added.map(x => `<b>${esc(x)}</b>`).join(' · ')}는 추가할 때 붙여요` : '');
            } else $root.find('.na_aucheck').prop('hidden', true);
            const guess = guessEndNumber(val);
            if (guess !== null && !endTouched) {
                $end.val(guess);
                $root.find('.na_end_hint').text('붙여넣은 마지막 제목에서 읽었어요');
            } else if (guess !== null && guess === parseInt($end.val(), 10)) $root.find('.na_end_hint').text('붙여넣은 마지막 제목에서 읽었어요');
            hideHint();
            const has = !!val.trim();
            lastCheck = has ? checkAppend(m, stripRewrites(m.text, val), last) : { issues: [] };
            if (has) lastCheck.issues.push(...shortOf(val));
            if (!has) $check.prop('hidden', true);
            else if (!lastCheck.issues.length) {
                const r = lastCheck.ranges;
                ckRow($check, 'ok', '번호가 이어져요', `${m.boundary >= 0 ? `경계선 #${m.boundary} 다음 ` : ''}#${r[0].from}부터 #${r[r.length - 1].to}까지 빈틈 없음`);
            } else {
                ckRow($check, lastCheck.soft ? 'soft' : 'warn', lastCheck.soft ? '번호 검사를 건너뛰어요' : `번호를 확인해 주세요 · ${lastCheck.issues.length}개`, lastCheck.issues.map(esc).join('<br>'));
            }
            const near = has ? nameNearMisses(m.text, val) : [];
            nearMiss = near;
            if (near.length) ckRow($root.find('.na_names'), 'warn', `철자가 비슷한 이름 ${near.length}개`, near.map(x => `${esc(x.word)} ↔ ${esc(x.like)}`).join(', '), '<button type="button" class="na_ck_btn na_names_fix" title="붙여넣은 글의 이름을 아카이브 철자로 바꿔요">고치기</button>');
            else $root.find('.na_names').prop('hidden', true).empty();
            const plan = placeAppend(m.text, val, { renumber: $root.find('.na_do_renum').prop('checked'), rewrites: rwMode() });
            renderPreview(plan);
            const cut = has ? cutSigns(m.text, val) : [];
            // a missing STATE/OPEN block is reported on the STATE row, the rest on the "cut" row
            const cutBlocks = cut.filter(x => /블록이 없어요/.test(x)), cutLine = cut.filter(x => !cutBlocks.includes(x));
            const eTail = splitTail(m.text)[1], pTail = splitTail(val)[1];
            const pKeys = tailBlocks(pTail).map(b => b.key).filter(k => k === 'STATE' || k === 'OPEN');
            const $st = $root.find('.na_statecheck');
            const josa = (w, a, b) => (/OPEN$/.test(w) ? a : b);
            if (!has || (!pKeys.length && !cutBlocks.length && !plan.placed)) $st.prop('hidden', true).empty();
            else if (cutBlocks.length) {
                const miss = cutBlocks[0].split(' 블록')[0];
                ckRow($st, 'warn', `${miss.replace('·', ' · ')}${josa(miss, '이', '가')} 없어요`, `이대로 추가하면 예전 ${esc(miss)} 블록이 그대로 남아요`);
            } else if (!pKeys.length) ckRow($st, 'ok', '새 섹션은 STATE 앞에 들어가요');
            else {
                const at = (eTail.match(/^# STATE AT\b[^\n]*?(#\d+)/m) || [])[1];
                const olds = plan.replaced.map(k => (k === 'STATE' && at ? `STATE AT ${at}` : k)).join('·');
                const sub = plan.replaced.length ? `기존 ${esc(olds)}${josa(olds, '을', '를')} 바꿔요` : `${pKeys.join('·')} 블록을 새로 붙여요`;
                const gap = tailNumberGap(val);
                if (gap) ckRow($st, 'warn', `STATE 번호가 #${gap.at}인데 섹션은 #${gap.end}까지예요`, `${sub} · 섹션 끝에 맞추면 #${gap.end} 기준이 돼요`, `<button type="button" class="na_ck_btn na_tailfix" title="STATE·OPEN 제목과 안내문의 번호를 섹션 끝 번호로 바꿔요">#${gap.end}로 맞추기</button>`);
                else ckRow($st, 'ok', `${pKeys.join(' · ')}${josa(pKeys.join(''), '이', '가')} 있어요`, sub);
            }
            if (!has) $root.find('.na_cut').prop('hidden', true).empty();
            else if (cutLine.length) ckRow($root.find('.na_cut'), 'warn', '답이 중간에 끊긴 것 같아요', `${cutLine.map(esc).join('<br>')}<br>다른 모델로 압축했다면 그쪽 답 길이(최대 토큰)를 늘리고 다시 받아 보세요.`);
            else ckRow($root.find('.na_cut'), 'ok', '마지막 줄이 끊기지 않았어요');
            const whole = !!val.trim() && looksWhole(m.text, val);
            $root.find('.na_whole').prop('hidden', !whole);
            const rwN = plan.rewriteCount;
            const items = [...plan.skipped.map(x => `<li>${esc(x)} <span class="na_dim">→ 빼고 추가</span></li>`), ...plan.swapped.map(x => `<li>${esc(x)} <span class="na_dim">→ 기존 섹션을 이걸로 바꿈</span></li>`)];
            const rwOpen = $root.find('.na_rw details').prop('open');
            $root.find('.na_rw').attr('class', `na_check ${whole ? 'na_check_soft' : 'na_check_warn'} na_rw`).prop('hidden', !rwN).html(rwN ? `<span class="na_ck_ic">!</span><div>
                ${whole ? `그대로 <b>추가</b>하면 이미 있는 섹션 ${rwN}개는 빼고 새 섹션만 붙여요.`
                    : `<b>이미 아카이브에 있는 섹션 ${rwN}개가 섞여 있어요</b> — 모델이 형식 참고용 섹션을 다시 쓴 것 같아요. 그건 빼고 추가해요.`}
                ${items.length > 3 ? `<details class="na_rw_list"${rwOpen ? ' open' : ''}><summary>섹션 ${items.length}개 보기</summary><ul>${items.join('')}</ul></details>` : items.length ? `<ul>${items.join('')}</ul>` : ''}
                ${plan.exactCount ? `<label class="checkbox_label na_rw_opt"><input type="checkbox" class="na_rw_replace" ${rwMode() === 'replace' ? 'checked' : ''}><span>번호가 똑같은 섹션은 기존 걸 붙여넣은 걸로 바꾸기 (일부러 고쳐 쓴 경우만)</span></label>` : ''}
            </div>` : '');
            // whether renumbering applies at all, independent of the checkbox (unchecking must not hide its own row)
            const renum = plan.renumbered || placeAppend(m.text, val, { renumber: true, rewrites: rwMode() }).renumbered;
            $root.find('.na_renum_row').toggle(!!renum);
            if (renum) $root.find('.na_renum_label').html(`제목·안내문의 끝 번호도 바꾸기 (<b>#${renum.from} → #${renum.to}</b>)`);
            $root.find('.na_append_info').text(has ? `약 ${fmt(await countTokens(val))} 토큰 · 섹션 ${parseSections(val).filter(x => !x.group).length}개` : '');
        }, 400);
    });

    $root.find('.na_ai_conflict').on('click', async function () {
        const add = $ta.val().trim();
        if (!add) return toastr.info('먼저 추가할 내용을 붙여넣어 주세요.');
        const out = await withSpinner($(this), '검사하는 중…', () => askAI(`[EXISTING ARCHIVE]\n${m.text}\n\n[NEW TEXT]\n${add}`, { system: AI_SYS_CONFLICT, maxTokens: 1500 }));
        if (out === null) return;
        const none = /^\s*(없음|none)\.?\s*$/i.test(out);
        $root.find('.na_conflict_out').prop('hidden', false).removeClass('na_stale').toggleClass('na_ai_ok', none)
            .html(none ? '<i class="fa-solid fa-circle-check"></i> AI가 찾은 충돌 없음' : `<div class="na_ai_box_head"><i class="fa-solid fa-wand-magic-sparkles"></i> AI 충돌 검사 <span class="na_dim">· 참고용이에요</span></div>${aiHtml(out)}`);
    });
    // 이어서 고치기: the whole draft revised by the draft model, with the raw log of its range when it can be found
    const apf = { original: null, asked: [], rawKey: '', raw: null, busy: false };
    const draftRange = () => {
        const rs = headingRanges(auFix(String($ta.val() || ''), m));
        if (!rs.length) return null;
        const from = Math.min(...rs.map(r => Math.min(r.from, r.to))), to = Math.max(...rs.map(r => Math.max(r.from, r.to)));
        return { prefix: rs[0].prefix, from, to, key: `${rs[0].prefix}|${from}|${to}` };
    };
    const loadApfRaw = async () => {
        const r = draftRange();
        if (!r) { $root.find('.na_apf_rawinfo').text('· 제목에 #번호가 없어요'); apf.raw = null; apf.rawKey = ''; return null; }
        if (apf.rawKey === r.key && apf.raw) return apf.raw;
        apf.rawKey = r.key;
        $root.find('.na_apf_rawinfo').text('· 원문 찾는 중…');
        const got = await rawFor(m, { title: `${r.prefix ? `${r.prefix} ` : ''}#${r.from}–#${r.to} — draft` });
        apf.raw = got.raw ? { ...got, tok: await countTokens(got.raw) } : got;
        $root.find('.na_apf_rawinfo').text(apf.raw.raw ? `· ${apf.raw.label} · 메시지 ${apf.raw.n}개 · 약 ${fmt(apf.raw.tok)} 토큰` : `· ${apf.raw.why}`);
        return apf.raw;
    };
    $root.find('.na_apf_q').one('focus', () => { loadApfRaw(); });
    const apfSend = async () => {
        const q = String($root.find('.na_apf_q').val() || '').trim();
        const draft = String($ta.val() || '').trim();
        if (!q || apf.busy) return;
        if (!draft) return toastr.info('먼저 고칠 초안이 있어야 해요.');
        apf.busy = true;
        const $b = $root.find('.na_apf_go').prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i>');
        try {
            const src = $root.find('.na_apf_raw').prop('checked') ? await loadApfRaw() : null;
            const prompt = `DRAFT:\n${draft}\n\n${src?.raw ? `RAW LOG:\n${src.raw}\n\n` : ''}${apf.asked.length ? `EARLIER REQUESTS:\n${apf.asked.map(x => `- ${x}`).join('\n')}\n\n` : ''}REQUEST:\n${q}`;
            const out = stripThink(await askCompress(prompt, { system: AI_SYS_DRAFTFIX })).replace(/^```[a-z]*\n?|```\s*$/g, '').trim();
            const note = (out.match(/^NOTE:\s*(.+)$/m) || [])[1] || '';
            const body = out.replace(/^NOTE:.*$/m, '').trim();
            if (!/^#{1,3}\s/m.test(body)) throw new Error('초안 모델이 초안 형태로 답하지 않았어요');
            if (apf.original === null) apf.original = draft;
            apf.asked.push(q);
            $ta.val(body).trigger('input');
            $root.find('.na_apf_q').val('');
            $root.find('.na_apf_log').html(apf.asked.map(x => `<div class="na_sf_bubble">${esc(x)}</div>`).join(''));
            $root.find('.na_apf_note').prop('hidden', !note).text(note ? `못 한 것: ${note}` : '');
            $root.find('.na_apf_undo').prop('hidden', false);
            toastr.success('초안을 고쳤어요 · 아래 검사를 다시 봐 주세요', '이어서 고치기');
        } catch (e) {
            console.error('[NarrativeArchive] draft fix', e);
            toastr.error(String(e?.message || e), '이어서 고치기');
        } finally { apf.busy = false; $b.prop('disabled', false).html(svgA('M22 2L11 13M22 2l-7 20-4-9-9-4z', 17)); }
    };
    $root.find('.na_apf_go').on('click', apfSend);
    $root.find('.na_apf_q').on('keydown', e => { if (e.key === 'Enter' && !e.originalEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); apfSend(); } });
    $root.find('.na_apf_undo').on('click', () => {
        if (apf.original === null) return;
        $ta.val(apf.original).trigger('input');
        apf.original = null; apf.asked = [];
        $root.find('.na_apf_log').empty(); $root.find('.na_apf_note').prop('hidden', true); $root.find('.na_apf_undo').prop('hidden', true);
    });
    // 한 번에 압축 with 채점: the grader's verdict on the summary, message numbers open the raw log
    if (pre.grade) {
        const ok = /^\s*문제 없음\.?\s*$/.test(pre.grade);
        $root.find('.na_grade_out').prop('hidden', false).toggleClass('na_ai_ok', ok)
            .html(pre.gradeError ? `<div class="na_ai_box_head"><i class="fa-solid fa-clipboard-check"></i> 채점 못 했어요</div>${esc(pre.grade)}`
                : ok ? '<i class="fa-solid fa-circle-check"></i> 채점: 원문과 잘 맞아요'
                : `<div class="na_ai_box_head"><i class="fa-solid fa-clipboard-check"></i> 채점 <span class="na_dim">· 참고용 · 고치려면 위 글을 직접 고치세요</span></div>${driftHtml(pre.grade, m)}`);
        $root.on('click', '.na_grade_out .na_cite_msg', function () { const n = Number(this.dataset.msg); openSource(n, n, `#${n}`); });
    }
    if (pre.text) {
        if (Number.isFinite(pre.end)) { $end.val(pre.end); endTouched = true; hideHint(); }
        $ta.val(pre.text).trigger('input');
    }
    // 추가하기 sits in the page (mockup); the popup's own OK button would repeat it
    setTimeout(() => $root.closest('dialog').find('.popup-button-ok').addClass('na_ap2_okhide'), 0);
    const result = await c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', {
        wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '추가하기', cancelButton: '취소',
    });

    if (wantWhole) {
        const whole = String($ta.val() || '').replace(/\r\n/g, '\n').trim();
        const end = parseInt($end.val(), 10);
        const cut = cutSigns(m.text, whole);
        if (cut.length && !await confirm('답이 끊긴 것 같아요', `${cut.map(esc).join('<br>')}<br><br>그래도 바꿀까요?`)) return;
        if (!await confirmWhole(m.text, whole)) return;
        await commitText(whole, '통째로 바꾸기 전', Number.isFinite(end) && end >= 0 ? { boundary: end } : {});
        if ($root.find('.na_do_hide').prop('checked')) await applyHide({ silent: true });
        return toastr.success(Number.isFinite(end) && end >= 0 ? `아카이브를 통째로 바꿨어요 · 경계선 #${end}` : '아카이브를 통째로 바꿨어요');
    }
    if (result !== c.POPUP_RESULT.AFFIRMATIVE && result !== true) return;

    const add = auFix(String($ta.val() || '').replace(/\r\n/g, '\n').trim(), m);
    if (!add) return toastr.info('붙여넣은 내용이 없어요.');
    const end = parseInt($root.find('.na_end').val(), 10);
    if (!Number.isFinite(end) || end < 0) return toastr.warning('끝 번호를 확인해 주세요.');
    const cut = cutSigns(m.text, add);
    if (cut.length && !await confirm('답이 끊긴 것 같아요', `${cut.map(esc).join('<br>')}<br><br>그래도 추가할까요?`)) return;
    const check = checkAppend(m, stripRewrites(m.text, add), last);
    check.issues.push(...shortOf(add));
    if (check.issues.length && !check.soft) {
        if (!await confirm('번호 확인', `${check.issues.map(esc).join('<br>')}<br><br>그래도 추가할까요?`)) return;
    } else if (m.boundary >= 0 && end <= m.boundary) {
        if (!await confirm('경계선 확인', `끝 번호 #${end}가 기존 경계선 #${m.boundary}보다 앞이에요. 그래도 저장할까요?`)) return;
    }

    const plan = placeAppend(m.text, add, { renumber: $root.find('.na_do_renum').prop('checked'), rewrites: rwMode() });
    if (!plan.text.trim() || plan.text === `${trimEnd(m.text)}\n`) return toastr.info('새로 추가할 섹션이 없어요.');
    await commitText(plan.text, '추가 전', { boundary: end });
    if ($root.find('.na_do_hide').prop('checked')) await applyHide({ silent: true });
    toastr.success(`아카이브에 추가됨 · 경계선 #${end}`);
}
