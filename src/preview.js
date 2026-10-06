// Injection preview popup.

import { POSITIONS, ROLES, ctx, getMeta } from './core.js';
import { fadeCfg } from './fade.js';
import { currentInjection } from './inject.js';
import { keyLabel, linkWaiting, mutedSet, parseSections, pinnedSet, sectionKey } from './sections.js';
import { copyText, esc, fmt } from './util.js';
import { worldBooks, worldIsOn } from './world.js';

export async function openPreview() {
    const c = ctx();
    const m = getMeta();
    const b = await currentInjection();
    const where = Number(m.position) === 1 ? `채팅 안 · ${m.depth}` : POSITIONS[m.position];
    const titles = new Set(parseSections(m.text).map(sectionKey));
    const muted = [...mutedSet(m)].filter(t => titles.has(t));
    const waiting = [...linkWaiting(m)].filter(t => titles.has(t) && !muted.includes(t));
    const pinned = pinnedSet(m);
    const fadeN = { short: 0, line: 0 };
    for (const v of (b.faded || new Map()).values()) fadeN[v]++;
    const worldN = worldBooks().filter(w => String(w.text || '').trim() && worldIsOn(m, w)).length;
    const outN = muted.length + waiting.length + b.trimmed.length;
    const text = m.enabled ? b.text : '';
    // the injected text, headings marked with how each section goes in
    const tagOf = s => {
        const k = sectionKey(s), f = b.faded?.get(k);
        if (f) return `<span class="na_pv2_tag ${f}">${f === 'line' ? '한 줄' : '짧게'}</span>`;
        return pinned.has(k) ? '<span class="na_pv2_tag pin">고정</span>' : '';
    };
    const code = headsOnly => {
        if (!text.trim()) return `<span class="na_pv2_dimline">${m.enabled ? '들어갈 내용이 없어요.' : '주입이 꺼져 있어요. 켜면 여기 보이는 대로 들어가요.'}</span>`;
        const heads = new Map(parseSections(text).filter(s => !/^\((?:머리말|제목 없음)\)$/.test(s.title)).map(s => [s.start, s]));
        let pos = 0;
        return text.split('\n').map(line => {
            const s = heads.get(pos);
            pos += line.length + 1;
            if (s) return `<div class="na_pv2_h">${esc(line)} ${tagOf(s)}</div>`;
            if (headsOnly) return '';
            if (/^_.*_$/.test(line.trim())) return `<div class="na_pv2_dimline">${esc(line)}</div>`;
            return `<div>${esc(line) || '&nbsp;'}</div>`;
        }).join('');
    };
    const list = (arr, cls, why) => arr.map(t => `<div class="na_cp_row"><span class="na_pv2_dot ${cls}"></span><span class="na_cp_txt"><b>${esc(keyLabel(t))}</b></span><small class="na_v2_note">${why}</small></div>`).join('');
    const $root = $(`
      <div class="na_popup na_v2 na_pv2">
        <div class="na_v2_titlebar">
          <div class="na_v2_title"><b>주입 미리보기</b><small>다음 응답 때 실제로 들어가는 그대로</small></div>
          <button type="button" class="na_v2_btn primary na_pv_copy" ${text ? '' : 'disabled'}><svg class="na_c_svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>복사</button>
        </div>
        <div class="na_pv2_stats">
          <div class="${b.over ? 'over' : ''}"><small>분량</small><b>${m.enabled ? fmt(b.tokens) : '꺼짐'}</b>${b.cap ? `<small>상한 ${fmt(b.cap)}</small>` : ''}</div>
          <div><small>자리</small><b>${esc(where || '')}</b></div>
          <div><small>역할</small><b>${esc(ROLES[m.role] || '')}</b></div>
        </div>
        <div class="na_pv2_chips">
          <span class="world">세계관 ${worldN}</span>
          ${fadeCfg(m).on ? `<span class="fade">짧게 ${fadeN.short} · 한 줄 ${fadeN.line}</span>` : ''}
          <span class="wait">키워드 대기 ${waiting.length}</span>
          <span class="off">꺼 둠 ${muted.length}</span>
        </div>
        <div class="na_pv2_code"></div>
        <div class="na_pv2_out" hidden>
          <div class="na_v2_label">빠진 섹션</div>
          <div class="na_v2_card na_v2_list">${list(muted, 'off', '스위치로 끔')}${list(waiting, 'wait', '키워드 대기')}${list(b.trimmed, 'trim', '상한으로 뺌')}</div>
        </div>
        <div class="na_v2_row2">
          <button type="button" class="na_v2_btn na_pv2_showout" ${outN ? '' : 'disabled'}>${outN ? `빠진 섹션 ${outN}개 보기` : '빠진 섹션 없음'}</button>
          <button type="button" class="na_v2_btn na_pv2_heads">제목만 보기</button>
        </div>
        <textarea class="na_pv2_copybuf" readonly tabindex="-1" aria-hidden="true"></textarea>
      </div>`);
    let headsOnly = false;
    const draw = () => $root.find('.na_pv2_code').html(code(headsOnly));
    draw();
    $root.find('.na_pv2_copybuf').val(text);
    $root.find('.na_pv2_heads').on('click', function () {
        headsOnly = !headsOnly;
        $(this).toggleClass('active', headsOnly).text(headsOnly ? '전체 보기' : '제목만 보기');
        draw();
    });
    $root.find('.na_pv2_showout').on('click', function () {
        const $o = $root.find('.na_pv2_out');
        const show = $o.prop('hidden');
        $o.prop('hidden', !show);
        $(this).toggleClass('active', show).text(show ? '빠진 섹션 접기' : `빠진 섹션 ${outN}개 보기`);
    });
    $root.find('.na_pv_copy').on('click', async () => {
        const ok = await copyText(b.text, $root.find('.na_pv2_copybuf')[0]);
        ok ? toastr.success('복사됨') : toastr.warning('복사가 막혀 있어요.');
    });
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}
