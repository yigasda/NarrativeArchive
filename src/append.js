// Adding new sections to the archive: the 아카이브에 추가 window, and 바로 넣기 (autoAppend) with its undo.
// The text work it leans on (placing, rewrites, numbering, STATE lines, checks) is appendtext.js.

import { aiHtml, askAI, askFix, stripThink, withSpinner } from './ai.js';
import { AI_SYS_CONFLICT, AI_SYS_DRAFTFIX, AI_SYS_GAPFILL, checkAppend, confirmWhole, cutSigns, findRewrites, fixTailNumber, looksWhole, placeAppend, restoreState, spliceChanged, stateLoss, stripRewrites, tailNumberGap } from './appendtext.js';
import { commitText, ctx, getMeta, globalSettings } from './core.js';
import { lineDiff, renderDiff } from './diff.js';
import { driftHtml } from './drift.js';
import { guessEndNumber } from './extract.js';
import { applyHide } from './hide.js';
import { nameNearMisses } from './keywords.js';
import { auDivider, auFix, auOf, langBlock } from './prompts.js';
import { rawFor } from './retitle.js';
import { citeIssues, headingRanges, parseSections, RANGE_HEAD, rangeIssues, splitTail, stripCites, tailBlocks, trimEnd } from './sections.js';
import { openSource } from './source.js';
import { hasChanges, resolveChanges } from './statechg.js';
import { ICO_A, SVG_B, svgA, svgB } from './theme.js';
import { translateButton } from './translate.js';
import { confirm, countTokens, esc, fmt } from './util.js';

export async function openAppend(prefill = {}) {
    const c = ctx();
    const m = getMeta();
    const last = (c.chat?.length || 0) - 1;
    const pre = prefill && typeof prefill === 'object' && 'text' in prefill ? prefill : {};

    const $root = $(`
      <div class="na_popup na_v2 na_ap2">
        <div class="na_v2_titlebar">
          <div class="na_v2_title"><b>아카이브에 추가</b><small>STATE·OPEN 앞에 넣고, 새 STATE로 바꿔요</small></div>
        </div>
        <textarea class="text_pole na_append_ta" spellcheck="false" placeholder="## Y2 #574–#600 — 제목 (날짜, 장소)&#10;PLOT:&#10;- …"></textarea>
        <div class="na_wz2_chips na_ap_outinfo"></div>
        <div class="na_v2_row2 na_ap_tools">
          <button type="button" class="na_v2_btn na_append_file_btn">${svgA('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>', 15)}파일 불러오기</button>
          <button type="button" class="na_v2_btn na_ap_style" title="문장 결만 아카이브처럼 다듬어요 · 내용 · 출처 번호 · 인용 · 불릿 수는 그대로 · 원문 없이 섹션만 보내요 · AI 기능 모델">${svgA('<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>', 15)}문체 다듬기</button>
          ${pre.grade || pre.gradeLater ? '' : `<button type="button" class="na_v2_btn na_ap_grade" title="붙여넣은 섹션을 그 번호의 원문과 맞춰 봐요 · AI 기능 모델">${svgA('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14l2 2 4-4"/>', 15)}원문 대조</button>`}
        </div>
        <input type="file" class="na_append_file" accept=".txt,.md,.markdown,text/plain,text/markdown" hidden>
        ${true ? `<div class="na_apf" hidden>
          <div class="na_sf_log na_apf_log"></div>
          <div class="na_sf_note na_apf_note" hidden></div>
          <div class="na_apf_scope"><div class="na_apf_chips" role="group" aria-label="고칠 섹션"></div></div>
          <div class="na_ly_ask"><input type="text" class="na_ly_askq na_apf_q" placeholder="초안 고쳐 달라고 하기 (예: #60 이후 더 줄여줘)" aria-label="초안 고쳐 달라고 하기" enterkeyhint="send"><button type="button" class="na_ly_askgo na_apf_go" aria-label="보내기" title="초안 모델에게 보내기">${svgA('M22 2L11 13M22 2l-7 20-4-9-9-4z', 17)}</button></div>
          <div class="na_apf_foot"><label class="checkbox_label"><input type="checkbox" class="na_apf_raw" checked><span>원문 같이 보내기 <small class="na_apf_rawinfo"></small></span></label><button type="button" class="na_linkbtn na_apf_undo" hidden>되돌리기</button></div>
        </div>` : ''}
        <div class="na_v2_card na_v2_list na_ap2_checks">
          <div class="na_ap2_label"><span>붙여넣은 글 검사</span><small class="na_append_info"></small></div>
          <div class="na_check na_aucheck" hidden></div>
          <div class="na_check na_numcheck" hidden></div>
          <div class="na_check na_statecheck" hidden></div>
          <div class="na_check na_check_warn na_statelost" hidden></div>
          <div class="na_stchg" hidden></div>
          <div class="na_check na_cites" hidden></div>
          <div class="na_check na_check_warn na_bullets" hidden></div>
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
        renderPreview(lastPlan || placeAppend(m.text, stripCites(auFix($ta.val(), m)), { renumber: $root.find('.na_do_renum').prop('checked'), rewrites: rwMode() }));
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
    let lossNow = null;
    $root.on('click', '.na_bullets_fix', function () { $root.find('.na_apf_q').val(this.dataset.ask); $root.find('.na_apf_go').trigger('click'); });
    $root.on('click', '.na_sl_fix', () => {
        if (!lossNow) return;
        const pick = new Set($root.find('.na_sl_row input:checked').map((i, el) => Number(el.dataset.k)).get());
        $ta.val(restoreState(auFix(String($ta.val() || ''), m), lossNow, pick)).trigger('input');
        toastr.success(`STATE를 되살렸어요${pick.size ? ` · 줄 ${pick.size}개` : ''}${lossNow.renames.length ? ' · 제목' : ''}`);
    });
    $root.on('click', '.na_tailfix', () => {
        const v = $ta.val(), gap = tailNumberGap(auFix(v, m));
        if (!gap) return;
        $ta.val(fixTailNumber(auFix(v, m), gap)).trigger('input');
        toastr.success(`STATE·OPEN 번호를 #${gap.end}로 맞췄어요`);
    });
    // a gap between two pasted sections: stretch the section before it, or have the gap's messages written in
    const headWithEnd = (title, to) => title.replace(RANGE_HEAD, (all, pre, a, dash, b, rest) => `${pre ? `${pre} ` : ''}#${a}${dash}#${to}${rest}`);
    const sectionOf = (v, title) => parseSections(v).find(x => !x.group && x.title === title);
    $root.on('click', '.na_gap_join', () => {
        const v = auFix(String($ta.val() || ''), m), gp = checkAppend(m, stripRewrites(m.text, v), last).gaps?.[0];
        const s = gp && sectionOf(v, gp.before.title);
        if (!s) return;
        const nl = v.indexOf('\n', s.start);
        const head = v.slice(s.start, nl < 0 ? v.length : nl);
        $ta.val(v.slice(0, s.start) + head.replace(gp.before.title, headWithEnd(gp.before.title, gp.to)) + v.slice(s.start + head.length)).trigger('input');
        toastr.success(`앞 섹션을 #${gp.to}까지로 늘렸어요`);
    });
    let gapBusy = false;
    $root.on('click', '.na_gap_fill', async function () {
        if (gapBusy) return;
        const v = auFix(String($ta.val() || ''), m), gp = checkAppend(m, stripRewrites(m.text, v), last).gaps?.[0];
        const s = gp && sectionOf(v, gp.before.title);
        if (!s) return;
        const label = `${gp.prefix ? `${gp.prefix} ` : ''}#${gp.from}–#${gp.to}`;
        const src = await rawFor(m, { title: `${label} — gap` }, { here: true });
        if (!src.raw) return toastr.warning(src.why || '원문을 못 찾았어요', '빠진 구간');
        gapBusy = true;
        const $b = $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i>');
        try {
            const before = trimEnd(v.slice(s.start, s.end)).replace(/\n-{3,}\s*$/, '');
            const prompt = `SECTION BEFORE THE GAP:\n${before}\n\nSECTION AFTER THE GAP (heading only — do not output it):\n## ${gp.after.title}\n\nGAP: ${label}\n\nRAW LOG ${label}:\n${src.raw}${langBlock(m.text, { tail: false })}`;
            const out = auFix(stripThink(await askFix(prompt, { system: AI_SYS_GAPFILL })).replace(/^```[a-z]*\n?|```\s*$/g, '').trim(), m);
            const rs = headingRanges(out);
            if (!rs.length) throw new Error('모델이 섹션 형태로 답하지 않았어요');
            if (rs[0].from !== gp.before.from || rs[rs.length - 1].to !== gp.to) throw new Error(`받은 섹션이 #${rs[0].from}–#${rs[rs.length - 1].to}라서 넣지 않았어요 (#${gp.before.from}–#${gp.to}여야 해요)`);
            if (apf.original === null) apf.original = String($ta.val() || '');
            apf.steps.push(String($ta.val() || ''));
            $root.find('.na_apf_undo').prop('hidden', false);
            const rest = v.slice(s.start + before.length);
            $ta.val(`${v.slice(0, s.start)}${out}${/^\s*\n/.test(rest) ? '' : '\n\n'}${rest}`).trigger('input');
            toastr.success(`${label}를 넣었어요 · 섹션 ${rs.length === 1 ? '앞 섹션에 합침' : `${rs.length - 1}개 새로`}`, '빠진 구간');
        } catch (e) {
            console.error('[NarrativeArchive] gap fill', e);
            toastr.error(String(e?.message || e), '빠진 구간');
            $b.prop('disabled', false).text('다시 받기');
        } finally { gapBusy = false; }
    });
    // STATE · OPEN changes the model listed: risky ones start unticked; ticking rebuilds the tail from the archive's own
    let chg = null;
    const OPK = { ADD: '추가', EDIT: '수정', DROP: '삭제' };
    function renderChg() {
        const $c = $root.find('.na_stchg');
        if (!chg?.plan?.length) { $c.prop('hidden', true).empty(); return; }
        const off = chg.plan.filter(c => !c.on).length;
        $c.prop('hidden', false).html(`<div class="na_chg_head"><b>STATE · OPEN 바뀌는 것 · ${chg.plan.length}개</b><small>${off ? `${off}개는 꺼 뒀어요 (STATE 줄 삭제 · 크게 줄임 · 새 제목 · 못 찾음) · 켜야 들어가요` : '모두 들어가요'} · 목록에 없는 줄은 그대로예요</small></div>
            ${chg.plan.map((c, k) => `<label class="na_chg_row${c.on ? '' : ' off'}"><input type="checkbox" data-k="${k}" ${c.on ? 'checked' : ''} ${c.op === 'DROP' && !c.found ? 'disabled' : ''}>
              <span class="na_chg_txt"><span class="na_chg_meta"><b class="na_chg_op na_chg_${c.op.toLowerCase()}">${OPK[c.op]}</b>${[c.kind === 'OPEN' ? 'OPEN' : '', c.head ? esc(c.head) : ''].filter(Boolean).join(' · ')}${c.why ? ` <i>${esc(c.why)}</i>` : ''}</span>
              ${c.op === 'EDIT' ? `<s>${esc(bareLine(c.found || c.old))}</s><span>${esc(bareLine(c.neu))}</span>` : c.op === 'DROP' ? `<s>${esc(bareLine(c.found || c.old))}</s>` : `<span>${esc(bareLine(c.neu))}</span>`}</span></label>`).join('')}`);
    }
    const bareLine = l => String(l || '').replace(/^\s*[-*•]\s*/, '');
    $root.on('change', '.na_chg_row input', function () {
        if (!chg) return;
        chg.pick[Number(this.dataset.k)] = this.checked;
        const body = splitTail(auFix(String($ta.val() || ''), m))[0];
        const r = resolveChanges(m.text, `${trimEnd(body).replace(/\n-{3,}\s*$/, '')}\n\n---\n${chg.tail}`, chg.pick);
        chg.plan = r.plan;
        $ta.val(r.text).trigger('input');
    });
    // source marks: kept in the box so they can be checked, taken out when it is saved
    function renderCites(v) {
        const $c = $root.find('.na_cites');
        const ci = citeIssues(v);
        if (!ci.marks) { $c.prop('hidden', true).empty(); return; }
        const chip = n => `<button type="button" class="na_cite_msg" data-msg="${n}">#${n}</button>`;
        const cut = l => esc(l.replace(/^\s*[-*•]\s*/, '').slice(0, 90)) + (l.length > 92 ? '…' : '');
        const warn = ci.outside.length || ci.bare.length;
        ckRow($c, warn ? 'warn' : 'ok', warn ? `출처 번호 확인 · ${[ci.outside.length && `섹션 범위 밖 ${ci.outside.length}개`, ci.bare.length && `번호 없는 불릿 ${ci.bare.length}개`].filter(Boolean).join(' · ')}` : `출처 번호 ${ci.marks}개 · 모두 섹션 범위 안`,
            `${ci.outside.map(x => `${chip(x.n)} <b>${esc(x.title.split(' — ')[0])}</b> 범위 밖 · ${cut(x.line)}`).join('<br>')}${ci.outside.length && ci.bare.length ? '<br>' : ''}${ci.bare.map(x => `번호 없음 · ${cut(x.line)}`).join('<br>')}${warn ? '<br>' : ''}번호를 누르면 원문이 떠요 · 번호는 추가할 때 지워져요`);
    }
    $root.on('click', '.na_cites .na_cite_msg', function () { const n = Number(this.dataset.msg); openSource(n, n, `#${n}`); });
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
            // an answer that lists STATE · OPEN changes: written out in full against the archive's own, and listed to tick
            const rawNow = String($ta.val() || '');
            if (hasChanges(rawNow)) {
                const fixed = auFix(rawNow, m);
                chg = { tail: splitTail(fixed)[1], pick: {} };
                const r = resolveChanges(m.text, fixed);
                chg.plan = r.plan;
                $ta.val(r.text);
            } else if (!rawNow.trim()) chg = null;
            renderChg();
            const withCites = auFix($ta.val(), m), val = stripCites(withCites);
            renderCites(withCites);
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
                const gp = lastCheck.gaps?.[0], gl = gp && `#${gp.from}${gp.to > gp.from ? `–#${gp.to}` : ''}`;
                ckRow($check, lastCheck.soft ? 'soft' : 'warn', lastCheck.soft ? '번호 검사를 건너뛰어요' : `번호를 확인해 주세요 · ${lastCheck.issues.length}개`, lastCheck.issues.map(esc).join('<br>'),
                    gp ? `<span class="na_ck_btns">${true ? `<button type="button" class="na_ck_btn na_gap_fill" title="${esc(gl)} 원문만 AI 기능 모델에 보내서 앞 섹션에 넣거나 새 섹션으로 받아요">${esc(gl)} 요약 받기</button>` : ''}<button type="button" class="na_ck_btn na_gap_join" title="앞 섹션 끝 번호를 #${gp.to}로 늘려요 · 그 메시지 내용이 앞 섹션에 이미 들어가 있을 때">번호만 잇기</button></span>` : '');
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
            // lines of the archive's STATE the new one dropped, and headings it renamed
            // with a change list, a missing line is one the user ticked to drop, not one the model lost
            lossNow = has && !chg?.plan?.length ? stateLoss(m.text, val) : null;
            const $sl = $root.find('.na_statelost');
            if (!lossNow) $sl.prop('hidden', true).empty();
            else {
                const ren = lossNow.renames.map(r => `<b>${esc(r.from)}</b> → 원래 <b>${esc(r.to)}</b>`).join(', ');
                ckRow($sl, 'warn', `기존 STATE에서 ${lossNow.missing.length ? `사라진 줄 ${lossNow.missing.length}개` : ''}${lossNow.missing.length && ren ? ' · ' : ''}${ren ? '바뀐 제목' : ''}`,
                    `${ren ? `제목: ${ren}<br>` : ''}${lossNow.missing.length ? '이번 구간이 바꾼 게 아니면 되살리세요 (고쳐 쓴 줄은 여기 안 나와요)' : ''}`);
                $sl.find('.na_cp_txt').append(`<div class="na_sl_list">${lossNow.missing.map((x, k) => `<label class="na_sl_row"><input type="checkbox" data-k="${k}" checked><span>${x.head ? `<small>${esc(x.head)}</small>` : ''}${esc(x.line.replace(/^\s*[-*]\s*/, ''))}</span></label>`).join('')}</div>
                    <button type="button" class="na_ck_btn na_sl_fix">${lossNow.missing.length ? '고른 줄 되살리기' : ''}${lossNow.missing.length && ren ? ' · ' : ''}${ren ? '제목 되돌리기' : ''}</button>`);
            }
            // sections that grew past 6 bullets (the instruction's ceiling)
            const longs = has ? parseSections(splitTail(val)[0]).filter(x => !x.group && RANGE_HEAD.test(x.title))
                .map(x => ({ x, n: (val.slice(x.start, x.end).match(/^\s*[-*•]\s/gm) || []).length })).filter(y => y.n > 6) : [];
            const $bl = $root.find('.na_bullets');
            if (!longs.length) $bl.prop('hidden', true).empty();
            else ckRow($bl, 'warn', `불릿이 많은 섹션 ${longs.length}개`, longs.map(y => `${esc(y.x.title.split(' — ')[0])} · 불릿 ${y.n}개`).join('<br>'),
                $root.find('.na_apf').length ? `<button type="button" class="na_ck_btn na_bullets_fix" data-ask="${esc(`${longs.map(y => `${y.x.title.split(' — ')[0]}(불릿 ${y.n}개)`).join(', ')}: 섹션마다 불릿 6개 이하로. 원인이나 결과가 같은 불릿은 합치고, 안 바뀌어도 되는 장면 묘사는 빼줘. 내용이 정말 많으면 전환점에서 섹션을 나눠줘.`)}">6개 이하로 줄여 달라고 하기</button>` : '');
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
            // sections and STATE · OPEN apart: the tail is rewritten in full each time, so the total alone overstates the new summary
            const [body, tl] = splitTail(val), all = has ? await countTokens(val) : 0, tt = tl.trim() ? await countTokens(tl) : 0;
            $root.find('.na_append_info').text(has ? `약 ${fmt(all)} 토큰${tt ? ` (섹션 ${fmt(all - tt)} · STATE·OPEN ${fmt(tt)})` : ''} · 섹션 ${parseSections(body).filter(x => !x.group).length}개` : '');
            // the same chips as the wizard's paste step: how many sections, whether their numbers follow on, STATE · OPEN, tokens
            const secsN = parseSections(body).filter(x => !x.group && RANGE_HEAD.test(x.title)).length;
            const rs = headingRanges(body).map(x => ({ a: Math.min(x.from, x.to), b: Math.max(x.from, x.to) })).sort((x, y) => x.a - y.a);
            const joined = rs.length && rs.every((x, i) => !i || x.a === rs[i - 1].b + 1);
            const okc = secsN && (!rs.length || joined);
            const chk = svgA(ICO_A.check, 12, 3);
            $root.find('.na_ap_outinfo').html(has ? `<span class="${okc ? 'ok' : secsN ? 'warn' : ''}">${okc ? chk : ''}섹션 ${secsN}개${rs.length ? ` · #${rs[0].a}–#${Math.max(...rs.map(x => x.b))}${joined ? ' 이어짐' : ` · ${rangeIssues(rs)}`}` : ''}</span>${tl.trim() ? `<span class="ok">${chk}STATE·OPEN</span>` : ''}<span>${fmt(all)} 토큰</span>` : '');
            $root.find('.na_apf').prop('hidden', !has);
            drawApfChips();
            if (apf.raw) apfRawInfo();
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
    const apf = { original: null, asked: [], steps: [], rawKey: '', raw: null, busy: false, pick: new Set() };
    // the draft's numbered sections, with where each one sits in the draft text
    const draftSecs = () => {
        const t = String($ta.val() || ''), body = splitTail(t)[0];
        return parseSections(body).filter(x => !x.group && RANGE_HEAD.test(x.title)).map(x => {
            const r = x.title.match(RANGE_HEAD);
            const pre = (r[1] || '').trim(), from = Math.min(+r[2], +r[4]), to = Math.max(+r[2], +r[4]);
            return { key: `${pre}|${from}|${to}`, pre, from, to, start: x.start, end: x.end, text: trimEnd(body.slice(x.start, x.end)).replace(/\n-{3,}\s*$/, '').trim() };
        });
    };
    // 고칠 섹션 chips: tap to send only those sections and their raw log
    const drawApfChips = () => {
        const secs = draftSecs();
        apf.pick = new Set([...apf.pick].filter(k => secs.some(x => x.key === k)));
        $root.find('.na_apf_chips').html(secs.length > 1 ? secs.map(x => `<button type="button" class="na_pchip${apf.pick.has(x.key) ? ' on' : ''}" data-k="${esc(x.key)}">${esc(`${x.pre ? `${x.pre} ` : ''}#${x.from}–#${x.to}`)}</button>`).join('') : '');
    };
    $root.on('click', '.na_apf_chips .na_pchip', function () {
        const k = this.dataset.k;
        apf.pick.has(k) ? apf.pick.delete(k) : apf.pick.add(k);
        $(this).toggleClass('on', apf.pick.has(k));
        apfRawInfo();
    });
    // the sections a request names: "#40" → the one holding it, "#40–#55" → the ones it overlaps, "#60 이후" → from there on
    const namedSecs = (q, secs) => {
        const out = new Set();
        for (const mt of String(q).matchAll(/#(\d+)(?:\s*[–—~-]\s*#?(\d+))?(\s*(?:이후|부터|뒤|after|onward))?/gi)) {
            const a = +mt[1], b = mt[2] ? +mt[2] : mt[3] ? Infinity : a;
            for (const x of secs) if (x.from <= b && x.to >= a) out.add(x.key);
        }
        return out;
    };
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
        const got = await rawFor(m, { title: `${r.prefix ? `${r.prefix} ` : ''}#${r.from}–#${r.to} — draft` }, { here: true });
        apf.raw = got.raw ? { ...got, tok: await countTokens(got.raw) } : got;
        $root.find('.na_apf_rawinfo').text(apf.raw.raw ? `· ${apf.raw.label} · 메시지 ${apf.raw.n}개 · 약 ${fmt(apf.raw.tok)} 토큰` : `· ${apf.raw.why}`);
        return apf.raw;
    };
    // the sections this request goes to: the picked chips and the numbers it names ([] = the whole draft)
    const apfPart = q => {
        const secs = draftSecs(), pick = new Set([...apf.pick, ...namedSecs(q, secs)]);
        return pick.size && pick.size < secs.length ? secs.filter(x => pick.has(x.key)) : null;
    };
    // the raw log of those sections only, cut out of the draft's whole raw log
    const partRaw = (raw, part) => String(raw || '').split(/\n\n(?=\[\d+\] )/)
        .filter(b => { const n = +(b.match(/^\[(\d+)\]/) || [])[1]; return part.some(x => n >= x.from && n <= x.to); });
    // the line under the input says what will actually go: the picked sections' raw log, or the whole one
    let infoSeq = 0;
    const apfRawInfo = async () => {
        const seq = ++infoSeq;
        const full = await loadApfRaw();
        const part = apfPart(String($root.find('.na_apf_q').val() || ''));
        if (seq !== infoSeq || !full?.raw) return;
        if (!part) { $root.find('.na_apf_rawinfo').text(`· ${full.label} · 메시지 ${full.n}개 · 약 ${fmt(full.tok)} 토큰`); return; }
        const blocks = partRaw(full.raw, part);
        const tok = await countTokens(blocks.join('\n\n'));
        if (seq !== infoSeq) return;
        $root.find('.na_apf_rawinfo').text(`· 고른 섹션 ${part.length}개 · ${part.map(x => `#${x.from}–#${x.to}`).join(', ')} · 메시지 ${blocks.length}개 · 약 ${fmt(tok)} 토큰`);
    };
    let infoT = null;
    $root.find('.na_apf_q').one('focus', () => { apfRawInfo(); }).on('input', () => { clearTimeout(infoT); infoT = setTimeout(apfRawInfo, 300); });
    const apfSend = async () => {
        const q = String($root.find('.na_apf_q').val() || '').trim();
        const draft = String($ta.val() || '').trim();
        if (!q || apf.busy) return;
        if (!draft) return toastr.info('먼저 고칠 초안이 있어야 해요.');
        apf.busy = true;
        const $b = $root.find('.na_apf_go').prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i>');
        try {
            const withRaw = $root.find('.na_apf_raw').prop('checked');
            // 고른 섹션 (chips, or the numbers in the request): only those sections and their raw log
            const part = apfPart(q);
            let src = withRaw ? await loadApfRaw() : null;
            if (src?.raw && part) src = { raw: partRaw(src.raw, part).join('\n\n') };
            const given = part ? part.map(x => x.text).join('\n\n') : draft;
            const prompt = `DRAFT:\n${given}\n\n${src?.raw ? `RAW LOG:\n${src.raw}\n\n` : ''}${apf.asked.length ? `EARLIER REQUESTS:\n${apf.asked.map(x => `- ${x}`).join('\n')}\n\n` : ''}REQUEST:\n${q}${langBlock(m.text)}`;
            const out = stripThink(await askFix(prompt, { system: AI_SYS_DRAFTFIX })).replace(/^```[a-z]*\n?|```\s*$/g, '').trim();
            const note = (out.match(/^NOTE:\s*(.+)$/m) || [])[1] || '';
            const body = out.replace(/^NOTE:.*$/m, '').trim();
            if (!/^#{1,3}\s/m.test(body)) throw new Error('모델이 초안 형태로 답하지 않았어요');
            const next = spliceChanged(draft, body);
            // nothing usable, or an answer that would wipe the draft: the draft stays exactly as it was
            if (!next) throw new Error('모델 답에서 고친 섹션을 못 찾았어요 · 초안은 그대로예요');
            if (next.refused) throw new Error(`${next.refused} · 초안은 그대로예요`);
            if (apf.original === null) apf.original = draft;
            apf.steps.push(draft);
            apf.asked.push(part ? `[${part.map(x => `#${x.from}–#${x.to}`).join(', ')}] ${q}` : q);
            $ta.val(next).trigger('input');
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
        // one step back each press; the first press after one change is the original
        const back = apf.steps.pop();
        if (back !== undefined && apf.steps.length) { $ta.val(back).trigger('input'); apf.asked.pop(); $root.find('.na_apf_log').html(apf.asked.map(x => `<div class="na_sf_bubble">${esc(x)}</div>`).join('')); toastr.info('한 단계 되돌렸어요'); return; }
        $ta.val(apf.original).trigger('input');
        apf.original = null; apf.asked = []; apf.steps = [];
        $root.find('.na_apf_log').empty(); $root.find('.na_apf_note').prop('hidden', true); $root.find('.na_apf_undo').prop('hidden', true);
    });
    // 문체 다듬기: the sentences only; a section that comes back with other bullets, numbers or quotes stays as it was
    $root.find('.na_ap_style').on('click', async function () {
        const draft = String($ta.val() || '').trim();
        if (!draft) return toastr.info('먼저 다듬을 초안이 있어야 해요.');
        if (apf.busy) return;
        apf.busy = true;
        try {
            const { polishStyle, styleSummary, keptSummary } = await import('./style.js');
            const r = await withSpinner($(this), '다듬는 중', () => polishStyle(draft, m));
            if (!r) return;
            const why = keptSummary(r);
            if (!r.changed) return toastr.info(`바꾼 섹션이 없어요${why}`, '문체 다듬기', { timeOut: 6000 });
            if (apf.original === null) apf.original = draft;
            apf.steps.push(draft);
            apf.asked.push('문체 다듬기');
            $ta.val(r.text).trigger('input');
            $root.find('.na_apf_log').html(apf.asked.map(x => `<div class="na_sf_bubble">${esc(x)}</div>`).join(''));
            $root.find('.na_apf_undo').prop('hidden', false);
            toastr.success(`섹션 ${r.changed}개를 다듬었어요${styleSummary(r)}${r.countFixed ? ` · 세는 규칙 ${r.countFixed}개 다시 맞춤` : ''}${why} · 되돌리기로 앞 모양으로`, '문체 다듬기', { timeOut: 9000 });
        } catch (e) {
            console.error('[NarrativeArchive] style pass', e);
            toastr.error(String(e?.message || e), '문체 다듬기');
        } finally { apf.busy = false; }
    });
    // [이대로 고쳐 줘] under a verdict with problems: the problems go to 초안 고쳐 달라고 하기 as the request
    // (their #numbers pick the sections they are in), with the raw log, and the draft changes in place
    const gradeFix = out => $root.find('.na_apf').length ? `<button type="button" class="na_ck_btn na_grade_fix" data-ask="${esc(`원문 대조에서 짚은 것만 원문대로 고쳐 줘, 나머지는 그대로: ${String(out).split('\n').map(l => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean).join(' / ')}`)}">이대로 고쳐 줘</button>` : '';
    $root.on('click', '.na_grade_fix', function () {
        $root.find('.na_apf_raw').prop('checked', true);
        $root.find('.na_apf_q').val(this.dataset.ask);
        $root.find('.na_apf_go').trigger('click');
        $(this).prop('disabled', true).text('고쳐 달라고 보냈어요');
    });
    // 원문 대조 for pasted text: the numbers its headings cover, hidden messages included
    $root.find('.na_ap_grade').on('click', async function () {
        const v = $ta.val().trim();
        const rs = headingRanges(splitTail(v)[0]);
        if (!rs.length) return toastr.info('번호가 붙은 섹션(## #시작–#끝)이 있어야 원문과 맞춰 볼 수 있어요.');
        const from = Math.min(...rs.map(x => Math.min(x.from, x.to))), to = Math.max(...rs.map(x => Math.max(x.from, x.to)));
        const { rangeRaw, AI_SYS_GRADE } = await import('./wizard.js');
        const raw = rangeRaw(c, { ...globalSettings(), skipHidden: false }, from, Math.min(to, last)).raw;
        if (!raw) return toastr.info(`#${from}–#${to} 원문이 이 채팅에 없어요.`);
        const out = await withSpinner($(this), '대조하는 중', () => askAI(`[RAW LOG]\n${raw}\n\n[SUMMARY]\n${v}`, { system: AI_SYS_GRADE, maxTokens: 6000 }));
        if (out === null) return;
        const ok = /^\s*문제 없음\.?\s*$/.test(out);
        $root.find('.na_grade_out').prop('hidden', false).toggleClass('na_ai_ok', ok)
            .html(ok ? '<i class="fa-solid fa-circle-check"></i> 원문 대조: 잘 맞아요' : `<div class="na_ai_box_head"><i class="fa-solid fa-clipboard-check"></i> 원문 대조 <span class="na_dim">· 참고용</span></div>${driftHtml(out, m)}${gradeFix(out)}`);
    });
    $root.on('click', '.na_grade_out .na_cite_msg', function () { const n = Number(this.dataset.msg); openSource(n, n, `#${n}`); });
    // 한 번에 압축 with 채점: the grader's verdict on the summary, message numbers open the raw log
    const showGrade = (grade, error) => {
        const ok = /^\s*문제 없음\.?\s*$/.test(grade);
        $root.find('.na_grade_out').prop('hidden', false).toggleClass('na_ai_ok', !error && ok)
            .html(error ? `<div class="na_ai_box_head"><i class="fa-solid fa-clipboard-check"></i> 채점 못 했어요</div>${esc(grade)}`
                : ok ? '<i class="fa-solid fa-circle-check"></i> 채점: 원문과 잘 맞아요'
                : `<div class="na_ai_box_head"><i class="fa-solid fa-clipboard-check"></i> 채점 <span class="na_dim">· 참고용</span></div>${driftHtml(grade, m)}${gradeFix(grade)}`);
    };
    if (pre.grade) showGrade(pre.grade, pre.gradeError);
    // still running when the window opens: the box says so and fills in when the verdict comes
    if (pre.gradeLater) {
        $root.find('.na_grade_out').prop('hidden', false).removeClass('na_ai_ok')
            .html('<div class="na_ai_box_head"><i class="fa-solid fa-spinner fa-spin"></i> 원문과 대조하는 중 <span class="na_dim">· 기다리지 않고 추가해도 돼요</span></div>');
        pre.gradeLater.then(r => { if ($root.closest('body').length) showGrade(r.grade, r.gradeError); });
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
        const whole = stripCites(String($ta.val() || '').replace(/\r\n/g, '\n').trim());
        const end = parseInt($end.val(), 10);
        const cut = cutSigns(m.text, whole);
        if (cut.length && !await confirm('답이 끊긴 것 같아요', `${cut.map(esc).join('<br>')}<br><br>그래도 바꿀까요?`)) return;
        if (!await confirmWhole(m.text, whole)) return;
        await commitText(whole, '통째로 바꾸기 전', Number.isFinite(end) && end >= 0 ? { boundary: end } : {});
        if ($root.find('.na_do_hide').prop('checked')) await applyHide({ silent: true });
        return toastr.success(Number.isFinite(end) && end >= 0 ? `아카이브를 통째로 바꿨어요 · 경계선 #${end}` : '아카이브를 통째로 바꿨어요');
    }
    if (result !== c.POPUP_RESULT.AFFIRMATIVE && result !== true) return;

    const add = stripCites(auFix(String($ta.val() || '').replace(/\r\n/g, '\n').trim(), m));
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

// 바로 넣기: what 추가하기 does, without the window, when nothing in the answer needs a look. Anything that would show a
// warning in the window (numbers, a STATE change to tick, a cut-off answer, rewritten sections, near-miss names, lost
// STATE headings, the grader's findings) sends it to the window instead. Returns { ok, why: [] }
export async function autoAppend({ text, end, expectTo = null, grade = '' }) {
    const m = getMeta();
    const last = (ctx().chat?.length || 0) - 1;
    const why = [];
    let raw = auFix(String(text || '').replace(/\r\n/g, '\n').trim(), m);
    if (!raw) return { ok: false, why: ['빈 답이에요'] };
    const listed = hasChanges(raw);
    if (listed) {
        const r = resolveChanges(m.text, raw);
        const off = r.plan.filter(c => !c.on);
        if (off.length) why.push(`STATE·OPEN 바꿀 줄 중 ${off.length}개는 직접 골라야 해요`);
        raw = r.text;
    } else if (splitTail(m.text)[1].trim() && !splitTail(raw)[1].trim()) why.push('STATE·OPEN 바뀌는 목록이 없어요');
    const add = stripCites(raw);
    if (cutSigns(m.text, add).length) why.push('답이 중간에 끊긴 것 같아요');
    const check = checkAppend(m, stripRewrites(m.text, add), last);
    if (check.issues.length) why.push(check.soft ? '섹션 번호를 못 읽었어요' : '섹션 번호를 확인해야 해요');
    if (Number.isFinite(expectTo)) {
        const rs = headingRanges(splitTail(add)[0]);
        const e = rs.length ? Math.max(rs[rs.length - 1].from, rs[rs.length - 1].to) : null;
        if (e !== null && e < expectTo) why.push(`#${e + 1}–#${expectTo}가 요약에 없어요`);
    }
    if (findRewrites(splitTail(m.text)[0], splitTail(add)[0]).some(f => f.kind !== 'divider')) why.push('이미 있는 섹션을 다시 썼어요');
    if (nameNearMisses(m.text, add).length) why.push('철자가 비슷한 이름이 있어요');
    if (!listed && stateLoss(m.text, add)) why.push('STATE의 제목이 빠졌어요');
    if (grade && !/^\s*문제 없음\.?\s*$/.test(grade)) why.push('원문 대조에서 짚은 게 있어요');
    if (!Number.isFinite(end) || end < 0 || end > last) why.push('끝 번호를 확인해야 해요');
    if (why.length) return { ok: false, why };
    const plan = placeAppend(m.text, add, { renumber: true, rewrites: 'skip' });
    if (!plan.text.trim() || plan.text === `${trimEnd(m.text)}\n`) return { ok: false, why: ['새로 추가할 섹션이 없어요'] };
    await commitText(plan.text, '바로 넣기 전', { boundary: end });
    await applyHide({ silent: true });
    return { ok: true, why: [], snapAt: getMeta().snapshots[0]?.at ?? null, end };
}

// 되돌리기 after 바로 넣기: the archive and its boundary as they were, and the hiding redone for that boundary
export async function undoAutoAppend(snapAt) {
    const m = getMeta();
    const snap = m.snapshots.find(s => s.at === snapAt);
    if (!snap) return toastr.warning('되돌릴 복구 지점을 못 찾았어요. 도구 탭 › 복구 지점에서 골라 주세요.');
    await commitText(snap.text, '되돌리기 전', { boundary: snap.boundary });
    await applyHide({ silent: true });
    toastr.success(`방금 넣은 요약을 되돌렸어요 · 경계선 #${snap.boundary}`);
}
$(document).on('click', '.na_undo_auto', function (e) {
    e.stopPropagation();
    const at = Number(this.dataset.at);
    $(this).closest('.toast').remove();
    undoAutoAppend(at);
});
