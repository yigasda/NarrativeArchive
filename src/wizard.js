// Compression wizard.

import { askAI, askDraft, drLabel, draftReady, withSpinner } from './ai.js';
import { openAppend } from './append.js';
import { commitText, ctx, getMeta, globalSettings, saveGlobal, saveMeta } from './core.js';
import { driftHtml } from './drift.js';
import { buildExtract, cleanMessage, formatExtract, guessEndNumber } from './extract.js';
import { activePrompt, auFix, auOf, compressPrompt, hasAuDivider, referenceSection, renderPromptSettings } from './prompts.js';
import { RANGE_HEAD, headingRanges, parseSections, splitTail } from './sections.js';
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

// what to compress next: after the boundary (or the last extract), up to the messages that stay visible
export function nextRange(c = ctx(), m = getMeta()) {
    const last = (c.chat?.length || 0) - 1;
    const le = m.lastExport;
    const after = Math.max(m.boundary, le && le.to <= last ? le.to : -1);
    const from = Math.min(after + 1, Math.max(0, last));
    return { from, to: Math.max(from, last - Math.max(0, Number(m.keep) || 0)), last, after };
}

// the raw log of a range, as the wizard and 원문 뽑기 build it
function rangeRaw(c, g, from, to) {
    const items = buildExtract(from, to).filter(x => !(g.skipHidden && c.chat[x.i]?.is_system)).map(x => ({ ...x, text: cleanMessage(x.text, g) })).filter(x => x.text);
    return { items, raw: formatExtract(items, g) };
}

// One button: the next range → the draft model (with the wizard's instruction, and the AU block in an AU chat)
// → 아카이브에 추가 with the summary filled in. Its checks, the boundary and the hide step stay.
let quickBusy = false;
export async function quickCompress() {
    if (quickBusy) return toastr.info('요약을 받는 중이에요.');
    const c = ctx(), m = getMeta(), g = globalSettings();
    if (!draftReady()) return toastr.info('⚙ 설정 → AI · 번역 → 초안 모델을 먼저 정해 주세요.', '한 번에 압축');
    const { from, to, last, after } = nextRange(c, m);
    if (after >= last || to < from || after + 1 > last - Math.max(0, Number(m.keep) || 0)) return toastr.info(`경계선 #${m.boundary} 뒤에 압축할 메시지가 없어요 (마지막 ${m.keep}개는 남겨요).`, '한 번에 압축');
    const { items, raw } = rangeRaw(c, g, from, to);
    if (!raw) return toastr.info('이 범위에 메시지가 없어요.', '한 번에 압축');
    const p = g.prompts.find(x => x.id === g.wizPrompt) || activePrompt(g);
    const prompt = compressPrompt(p.text, { raw, from: String(from), to: String(to), last_section: referenceSection(m.text), state: splitTail(m.text)[1].trim() || '(없음)', archive: m.text }, m);
    const au = auOf(m);
    if (!await confirm('한 번에 압축', `<b>#${from} – #${to}</b> · 메시지 ${items.length}개 · 약 ${fmt(await countTokens(prompt))} 토큰<br>초안 모델(${esc(drLabel())})이 요약하면 <b>아카이브에 추가</b> 창이 떠요.<br><small>지시문: ${esc(p.name)}</small>${au.on ? `<br><small>AU 켜짐 · 요약이 본편 뒤 <b>${esc(au.name)}</b> 묶음으로 이어져요</small>` : ''}`)) return;
    quickBusy = true;
    const toast = toastr.info(`#${from}–#${to} 요약하는 중… 창을 닫아도 돼요`, '한 번에 압축', { timeOut: 0, extendedTimeOut: 0, tapToDismiss: false });
    let out = null;
    try { out = await askDraft(prompt); }
    catch (e) { console.error('[NarrativeArchive] quick compress', e); toastr.error(String(e?.message || e), '한 번에 압축 실패'); }
    finally { quickBusy = false; toastr.clear(toast); }
    if (out === null) return;
    const text = auFix(cleanDraft(out), m);
    if (!text) return toastr.warning('초안 모델이 빈 답을 줬어요.', '한 번에 압축');
    m.lastExport = { from, to, at: Date.now(), how: 'draft' };
    await saveMeta();
    refreshStatus();
    openAppend({ text, end: guessEndNumber(text) ?? to });
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
    let raw = '', full = '';
    const vars = () => { const { from, to } = range(); return { raw, from: String(from), to: String(to), last_section: referenceSection(m.text), state: splitTail(m.text)[1].trim() || '(없음)', archive: m.text }; };
    const build = async () => {
        const { from, to } = range();
        const all = buildExtract(from, to);
        const hiddenOut = g.skipHidden ? all.filter(x => c.chat[x.i]?.is_system).length : 0;
        const items = all.filter(x => !(g.skipHidden && c.chat[x.i]?.is_system)).map(x => ({ ...x, text: cleanMessage(x.text, g) })).filter(x => x.text);
        raw = formatExtract(items, g);
        const pid = $root.find('.na_wz_prompt').val();
        const p = pid === '__none' ? null : (g.prompts.find(x => x.id === pid) || activePrompt(g));
        full = p ? compressPrompt(p.text, vars(), m) : raw;
        $root.find('.na_wz_copy span').text(p ? '지시문과 함께 복사' : '원문만 복사');
        $root.find('.na_wz_info').text(items.length ? `메시지 ${items.length}개${hiddenOut ? ` (숨긴 ${hiddenOut}개 뺌)` : ''} · 원문 약 ${fmt(await countTokens(raw))} 토큰${p ? ` · 지시문까지 약 ${fmt(await countTokens(full))} 토큰` : ''}` : '이 범위에 메시지가 없어요.');
    };
    // the draft always carries an instruction: the chosen one, or the active one when "raw only" is picked
    const draftPrompt = () => {
        const pid = $root.find('.na_wz_prompt').val();
        return compressPrompt((g.prompts.find(x => x.id === pid) || activePrompt(g)).text, vars(), m);
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
        const out = await withSpinner($(this), '쓰는 중… 창을 닫지 마세요', () => askDraft(draftPrompt()));
        if (out === null) return;
        $out.val(auFix(cleanDraft(out), m)).trigger('input');
        await remember('draft');
        toastr.success('초안을 채웠어요. 확인하고 다음으로 넘어가세요.');
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
