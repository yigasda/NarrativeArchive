// Raw message extraction ("[number] name:" format) and the extract popup.

import { ctx, getMeta, globalSettings, saveGlobal, saveMeta } from './core.js';
import { activePrompt, fillPrompt, referenceSection, renderPromptSettings } from './prompts.js';
import { headingLines, splitTail } from './sections.js';
import { refreshStatus } from './status.js';
import { ICO_A, svgA } from './theme.js';
import { chatLabel, copyText, countTokens, download, esc, escRe, fmt, timeLabel } from './util.js';

export function buildExtract(start, end) {
    const chat = ctx().chat || [];
    const out = [];
    for (let i = Math.max(0, start); i <= Math.min(end, chat.length - 1); i++) {
        const msg = chat[i];
        if (!msg) continue;
        const text = String(msg.mes ?? '').trim();
        if (!text) continue;
        out.push({ i, name: msg.name || (msg.is_user ? 'User' : 'Char'), text });
    }
    return out;
}

// "## Y2 #574–#600 — ..." → 600 (largest #number in the last numbered heading)
export function guessEndNumber(text) {
    const heads = headingLines(text).map(h => h.title);
    for (let i = heads.length - 1; i >= 0; i--) {
        const nums = [...heads[i].matchAll(/#(\d+)/g)].map(x => parseInt(x[1], 10));
        if (nums.length) return Math.max(...nums);
    }
    return null;
}

export const extractToText = items => items.map(x => `[${x.i}] ${x.name}:\n${x.text}`).join('\n\n');

// "지울 것" lines → RegExps. A bare tag name (scene_plan or <scene_plan>) removes that whole block,
// /…/flags is a regular expression, anything else is removed as plain text.
export function stripPatterns(src) {
    const out = [], bad = [];
    for (const raw of String(src || '').split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        const rx = line.match(/^\/(.+)\/([a-z]*)$/s);
        try {
            if (rx) out.push(new RegExp(rx[1], rx[2].includes('g') ? rx[2] : `${rx[2]}g`));
            else {
                const tag = line.match(/^<?\/?([A-Za-z][\w:.-]*)\/?>?$/);
                if (tag) {
                    const n = escRe(tag[1]);
                    out.push(new RegExp(`<${n}\\b[^>]*>[\\s\\S]*?<\\/${n}\\s*>|<${n}\\b[^>]*\\/>`, 'gi'));
                } else out.push(new RegExp(escRe(line), 'g'));
            }
        } catch { bad.push(line); }
    }
    return { list: out, bad };
}

export function cleanMessage(text, g) {
    if (!g.stripTags) return text;
    for (const re of stripPatterns(globalSettings().stripCustom).list) text = text.replace(re, '');
    return text
        .replace(/<(think|thinking|details)[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<[^>\n]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function formatExtract(items, g) {
    return items.map(x => {
        const head = `[${x.i}] ${x.name}:`;
        return `${head}\n${x.text}`;
    }).join('\n\n');
}

export async function openExtract() {
    const c = ctx();
    const m = getMeta();
    const g = globalSettings();
    const last = (c.chat?.length || 0) - 1;
    // continue after whichever is further: the boundary or the last range exported
    const le = m.lastExport;
    const after = Math.max(m.boundary, le && le.to <= last ? le.to : -1);
    const defStart = Math.min(after + 1, Math.max(0, last));
    const fromLast = !!le && le.to <= last && le.to > m.boundary;

    const $root = $(`
      <div class="na_popup na_v2 na_ex2">
        <div class="na_v2_title"><b>원문 뽑기</b><small>압축할 메시지를 골라 복사하거나 .txt로 저장해요</small></div>
        <div class="na_v2_card na_ex2_card">
          <div class="na_wz2_range">
            <label><small>부터</small><span>#<input type="number" class="text_pole na_from" min="0" max="${last}" value="${Math.max(0, defStart)}"></span></label>
            <span class="na_wz2_arr">${svgA('M5 12h14M13 6l6 6-6 6', 18)}</span>
            <label><small>까지</small><span>#<input type="number" class="text_pole na_to" min="0" max="${last}" value="${Math.max(0, last)}"></span></label>
          </div>
          <div class="na_v2_chips">
            ${m.boundary >= 0 ? `<button type="button" class="na_ex2_quick" data-a="${m.boundary + 1}" data-b="${last}">경계선 다음부터 끝까지</button>` : ''}
            <button type="button" class="na_lastex_again" ${le ? '' : 'hidden'}></button>
          </div>
          <div class="na_cp_bar"><span class="hid na_ex2_b1"></span><span class="raw na_ex2_b2"></span><span class="hid na_ex2_b3"></span></div>
          <div class="na_ex2_info na_ex_info"></div>
          <small class="na_v2_note na_lastex"><span class="na_lastex_text"></span></small>
        </div>
        <div class="na_v2_card na_v2_list">
          <label class="na_cp_row"><span class="na_cp_txt"><span>지시문 붙이기</span><small>다른 모델에 그대로 붙여넣기용</small></span><input type="checkbox" class="na_toggle na_opt_prompt"></label>
          <div class="na_ex_prow"><span class="na_ex_pchips"></span><select class="text_pole na_psel_quick" hidden></select></div>
          <button type="button" class="na_cp_row na_ex_toset"><span class="na_cp_txt"><span>뽑기 옵션</span><small class="na_ex_optsum"></small></span>${svgA(ICO_A.right, 15, 2.2)}</button>
        </div>
        <pre class="na_ex2_preview"></pre>
        <div class="na_v2_row2 na_ex2_btns">
          <button type="button" class="na_v2_btn na_save_txt">.txt 저장</button>
          <button type="button" class="na_v2_btn primary na_copy">${svgA('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', 16)}<span class="na_copy_label">전체 복사</span></button>
        </div>
        <textarea class="na_ex_hidden" readonly></textarea>
      </div>`);
    $root.find('.na_opt_prompt').prop('checked', g.usePrompt);
    // instruction picker: chips for the starred ones (and the one in use), the rest behind "다른 지시문…"
    const fillQuick = () => {
        const cur = activePrompt(g);
        const shown = g.prompts.filter(p => p.fav || p.id === cur.id).sort((a, b) => b.fav - a.fav);
        const rest = g.prompts.length > shown.length;
        $root.find('.na_ex_pchips').html(shown.map(p => `<button type="button" class="na_ex_pchip ${p.id === cur.id ? 'on' : ''}" data-id="${esc(p.id)}">${p.fav ? '★ ' : ''}${esc(p.name)}</button>`).join('')
            + (rest ? '<button type="button" class="na_ex_pchip na_ex_pmore">다른 지시문…</button>' : ''));
        $root.find('.na_psel_quick')
            .html([...g.prompts].sort((a, b) => b.fav - a.fav).map(p => `<option value="${esc(p.id)}">${p.fav ? '★ ' : ''}${esc(p.name)}</option>`).join(''))
            .val(cur.id);
    };
    $root.on('click', '.na_ex_pchip[data-id]', function () { $root.find('.na_psel_quick').val(this.dataset.id).trigger('change'); });
    $root.on('click', '.na_ex_pmore', function () { const $s = $root.find('.na_psel_quick'); $s.prop('hidden', !$s.prop('hidden')); $(this).toggleClass('open', !$s.prop('hidden')); if (!$s.prop('hidden')) $s.trigger('focus'); });
    const showProw = () => $root.find('.na_ex_prow').toggle(!!g.usePrompt);
    showProw();
    fillQuick();
    $root.find('.na_ex_optsum').text(`${[g.skipHidden ? '숨긴 메시지 뺌' : '숨긴 메시지 포함', g.stripTags ? `태그 지움${stripPatterns(g.stripCustom).list.length ? ` (+${stripPatterns(g.stripCustom).list.length})` : ''}` : '', '[번호] 이름:'].filter(Boolean).join(' · ')}`);
    $root.find('.na_ex_toset').on('click', () => { $root.closest('dialog').find('.popup-button-ok').trigger('click'); gotoCompressSettings(); });

    let current = '';
    let output = '';
    let withPrompt = '';
    const range = () => {
        const from = parseInt($root.find('.na_from').val(), 10) || 0;
        const to = parseInt($root.find('.na_to').val(), 10);
        return { from, to: Number.isFinite(to) ? to : last };
    };
    const render = async () => {
        const { from, to } = range();
        const all = buildExtract(from, to);
        const items = all
            .filter(x => !(g.skipHidden && c.chat[x.i]?.is_system))
            .map(x => ({ ...x, text: cleanMessage(x.text, g) }))
            .filter(x => x.text);
        current = formatExtract(items, g);
        withPrompt = fillPrompt(activePrompt(g).text, { raw: current, from: String(from), to: String(to), last_section: referenceSection(m.text), state: splitTail(m.text)[1].trim() || '(없음)', archive: m.text });
        output = g.usePrompt ? withPrompt : current;
        $root.find('.na_ex_hidden').val(output);
        $root.find('.na_prompt_state').text(g.usePrompt ? activePrompt(g).name : '안 붙임').toggleClass('na_chip_on', g.usePrompt);
        $root.find('.na_copy_label').text(g.usePrompt ? '지시문과 함께 복사' : '전체 복사');
        const hiddenOut = g.skipHidden ? all.filter(x => c.chat[x.i]?.is_system).length : 0;
        const emptyOut = all.length - items.length - hiddenOut;
        const tk = items.length ? await countTokens(output) : 0;
        $root.find('.na_ex_info').html(items.length
            ? `<span>메시지 ${items.length}개 · ${g.skipHidden ? `숨긴 것 ${hiddenOut}개` : '숨긴 것 포함'}${emptyOut > 0 ? ` · 빈 것 ${emptyOut}개 뺌` : ''}</span><b>약 ${fmt(tk)} 토큰</b>`
            : '<span>이 범위에 메시지가 없어요</span>');
        // the quick chip that matches the range reads as selected
        const lx = getMeta().lastExport;
        $root.find('.na_ex2_quick').each(function () { $(this).toggleClass('on', from === +this.dataset.a && to === +this.dataset.b); });
        $root.find('.na_lastex_again').toggleClass('on', !!lx && from === lx.from && to === Math.min(lx.to, last));
        const tot = Math.max(1, last + 1), a0 = Math.max(0, Math.min(from, last)), b0 = Math.max(a0, Math.min(to, last));
        $root.find('.na_ex2_b1').css('flex', a0).toggle(a0 > 0); $root.find('.na_ex2_b2').css('flex', b0 - a0 + 1); $root.find('.na_ex2_b3').css('flex', tot - b0 - 1).toggle(tot - b0 - 1 > 0);
        $root.find('.na_ex2_preview').text(current ? current.split('\n').slice(0, 6).join('\n') + (current.split('\n').length > 6 ? '\n…' : '') : '').prop('hidden', !current);
    };

    $root.find('.na_from, .na_to').on('change', render);
    $root.find('.na_opt_prompt').on('change', function () { g.usePrompt = this.checked; saveGlobal(); fillQuick(); showProw(); render(); renderPromptSettings(); });
    $root.find('.na_psel_quick').on('change', function () { g.activePrompt = this.value; saveGlobal(); $(this).prop('hidden', true); fillQuick(); render(); renderPromptSettings(); });
    const showLast = () => {
        const x = getMeta().lastExport;
        $root.find('.na_lastex').prop('hidden', !x);
        if (x) {
            $root.find('.na_lastex_text').html(`최근 내보냄 #${x.from}–#${x.to} · ${esc(timeLabel(x.at))} · ${x.how === 'txt' ? '.txt 저장' : x.how === 'draft' ? 'AI 초안' : '복사'}${fromLast && x === le ? ' → 그 다음부터 채웠어요' : ''}`);
            $root.find('.na_lastex_again').prop('hidden', false).text(`지난번 범위 #${x.from}–#${x.to}`).attr('title', `${timeLabel(x.at)} · ${x.how === 'txt' ? '.txt 저장' : x.how === 'draft' ? 'AI 초안' : '복사'}`);
        }
    };
    const remember = async how => {
        const { from, to } = range();
        getMeta().lastExport = { from, to, at: Date.now(), how };
        await saveMeta();
        showLast();
        refreshStatus();
    };
    showLast();
    $root.find('.na_ex2_quick').on('click', function () { $root.find('.na_from').val(this.dataset.a); $root.find('.na_to').val(this.dataset.b); render(); });
    $root.find('.na_lastex_again').on('click', () => {
        const x = getMeta().lastExport;
        if (!x) return;
        $root.find('.na_from').val(x.from); $root.find('.na_to').val(Math.min(x.to, last));
        render();
    });
    $root.find('.na_copy').on('click', async () => {
        if (!current) return;
        const ok = await copyText(output, $root.find('.na_ex_hidden')[0]);
        if (ok) await remember('copy');
        ok ? toastr.success('복사됨') : toastr.warning('복사가 막혀 있어요. .txt 저장을 써 주세요.');
    });
    $root.find('.na_save_txt').on('click', () => {
        if (!current) return;
        const { from, to } = range();
        download(`원문_${chatLabel()}_${from}-${to}.txt`, output);
        remember('txt');
    });

    await render();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

export function showStripInfo() {
    const { list, bad } = stripPatterns(globalSettings().stripCustom);
    $('.na_strip_box').toggleClass('na_off', !globalSettings().stripTags);
    $('#na_strip_info').toggleClass('na_warn_txt', !!bad.length)
        .text(bad.length ? `정규식이 잘못된 줄: ${bad.join(' / ')}` : '');
    // the count of hand-added tags reads in the row's caption
    $('#na_strip_sub').text(`<think> 통째로 · 나머지 태그는 글자만${list.length ? ` · 직접 추가 ${list.length}개` : ''}`);
}

// Open the compress tab with its settings fold open
export function gotoCompressSettings() {
    const $p = $('#na_settings');
    $p.find('.na_nav_btn[data-tab="compress"]').trigger('click');
    const d = document.getElementById('na_cmp_settings');
    if (!d) return;
    d.open = true;
    renderPromptSettings();
    setTimeout(() => d.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50);
}
