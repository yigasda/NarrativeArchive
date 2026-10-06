// Hiding already-compressed messages and showing them again.

import { ctx, getMeta, saveMeta } from './core.js';
import { buildExtract, extractToText, guessEndNumber } from './extract.js';
import { syncPanel } from './panel.js';
import { refreshStatus } from './status.js';
import { countTokens, fmt } from './util.js';

export const lastIndex = () => (ctx().chat?.length || 0) - 1;

// When tracking, pull the boundary to the archive's last heading number. Returns a reason string if it can't.
export function syncTrackedBoundary(m) {
    if (!m.track) return null;
    const n = guessEndNumber(m.text);
    if (n === null) return '아카이브 제목에서 #번호를 못 찾았어요';
    if (n > lastIndex()) return `아카이브 마지막 번호 #${n}가 채팅 마지막 #${lastIndex()}보다 커요 (다른 채팅 번호일 수 있어요)`;
    m.boundary = n;
    return null;
}

export const hiddenIndexes = () => (ctx().chat || []).flatMap((x, i) => x?.is_system ? [i] : []);

export async function openUnhide() {
    const c = ctx();
    const m = getMeta();
    const last = lastIndex();
    const hidden = hiddenIndexes();
    if (!hidden.length) return toastr.info('숨긴 메시지가 없어요.');
    const total = last + 1;
    const pct = i => `${(i / total * 100).toFixed(2)}%`;
    // runs of hidden messages for the bar
    const runs = [];
    for (const i of hidden) { const r = runs[runs.length - 1]; r && r[1] === i - 1 ? r[1] = i : runs.push([i, i]); }
    const bnd = m?.boundary >= 0 ? m.boundary : -1;
    const quick = [10, 20, 50].filter(n => n < hidden.length);
    const $root = $(`
      <div class="na_popup na_v2 na_uh2">
        <div class="na_v2_title"><b>숨김 해제</b><small>숨긴 메시지를 골라 다시 RP 모델이 보게 해요</small></div>
        <div class="na_v2_card na_uh2_map">
          <div class="na_uh2_count"><b>${fmt(hidden.length)}</b><span>개 숨김 · 전체 ${fmt(total)}개</span></div>
          <div class="na_uh2_bar">
            <div class="na_uh2_track">${runs.map(([a, b]) => `<span style="left:${pct(a)};width:${pct(b - a + 1)}"></span>`).join('')}</div>
            <div class="na_uh2_sel"></div>
          </div>
          <div class="na_uh2_axis"><span>#0</span>${bnd >= 0 && bnd < last ? `<span>경계선 #${bnd}</span>` : ''}<span>#${last}</span></div>
        </div>
        <div class="na_uh2_range">
          <label><small>부터</small><span><i>#</i><input type="number" class="text_pole na_uh_from" min="0" max="${last}" value="${hidden[0]}"></span></label>
          <svg class="na_uh2_arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          <label><small>까지</small><span><i>#</i><input type="number" class="text_pole na_uh_to" min="0" max="${last}" value="${hidden[hidden.length - 1]}"></span></label>
        </div>
        <div class="na_v2_chips na_uh2_quick">
          ${quick.map(n => `<button type="button" class="na_v2_pillbtn" data-n="${n}">마지막 ${n}개</button>`).join('')}
          <button type="button" class="na_v2_pillbtn" data-n="all">전부</button>
        </div>
        <div class="na_uh2_warn" hidden><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span></span></div>
        <button type="button" class="na_v2_btn primary wide na_uh2_go"></button>
      </div>`);
    const count = () => {
        let a = parseInt($root.find('.na_uh_from').val(), 10), b = parseInt($root.find('.na_uh_to').val(), 10);
        a = Number.isFinite(a) ? a : 0; b = Number.isFinite(b) ? b : last;
        if (a > b) [a, b] = [b, a];
        a = Math.max(0, Math.min(a, last)); b = Math.max(0, Math.min(b, last));
        const n = hidden.filter(i => i >= a && i <= b).length;
        return [a, b, n];
    };
    let tick = 0;
    const draw = () => {
        const [a, b, n] = count();
        $root.find('.na_uh2_sel').css({ left: pct(Math.max(0, a)), width: pct(Math.max(1, Math.min(b, last) - Math.max(0, a) + 1)) });
        $root.find('.na_uh2_go').prop('disabled', !n).text(n ? `#${a} – #${b} · ${fmt(n)}개 보이게` : '이 범위엔 숨긴 메시지가 없어요');
        // inside the compressed part: the archive already covers it, so the raw text would go in twice
        const dup = bnd >= 0 ? hidden.filter(i => i >= a && i <= Math.min(b, bnd)) : [];
        const $w = $root.find('.na_uh2_warn').prop('hidden', !dup.length);
        if (!dup.length) return;
        const my = ++tick;
        $w.find('span').text('이미 압축된 범위예요. 풀면 아카이브와 원문이 같이 들어가요.');
        const items = buildExtract(dup[0], dup[dup.length - 1]).filter(x => dup.includes(x.i));
        countTokens(extractToText(items)).then(t => { if (my === tick) $w.find('span').text(`이미 압축된 범위예요. 풀면 아카이브와 원문이 같이 들어가 토큰이 약 ${fmt(t)} 늘어요.`); });
    };
    $root.find('input').on('input change', draw);
    $root.find('.na_uh2_quick').on('click', 'button', function () {
        const n = this.dataset.n === 'all' ? hidden.length : Number(this.dataset.n);
        $root.find('.na_uh_from').val(hidden[hidden.length - n]);
        $root.find('.na_uh_to').val(hidden[hidden.length - 1]);
        draw();
    });
    $root.find('.na_uh2_go').on('click', async () => {
        const [a, b, n] = count();
        if (!n) return;
        await c.executeSlashCommandsWithOptions(`/unhide ${a}-${b}`, { handleParserErrors: true, handleExecutionErrors: true });
        toastr.success(`#${a} ~ #${b} 숨김 해제 (${n}개)`);
        refreshStatus();
        $root.closest('dialog').find('.popup-button-ok').trigger('click');
    });
    draw();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: false, okButton: '닫기' });
}

export async function applyHide({ silent = false } = {}) {
    const m = getMeta();
    if (!m) return;
    const problem = syncTrackedBoundary(m);
    if (problem) {
        if (!silent) toastr.warning(`${problem}. 숨기지 않았어요.`);
        return;
    }
    if (m.boundary < 0) {
        if (!silent) toastr.info('먼저 경계선(아카이브가 몇 번까지 다루는지)을 정해 주세요.');
        return;
    }
    await saveMeta();
    const hideEnd = m.boundary - Math.max(0, Number(m.keep) || 0);
    const last = lastIndex();
    const run = cmd => ctx().executeSlashCommandsWithOptions(cmd, { handleParserErrors: true, handleExecutionErrors: true });
    // only up to the boundary: everything after it is shown again
    if (hideEnd >= 0) await run(`/hide 0-${Math.min(hideEnd, last)}`);
    if (hideEnd + 1 <= last) await run(`/unhide ${Math.max(0, hideEnd + 1)}-${last}`);
    syncPanel();
    if (!silent) toastr.success(hideEnd >= 0 ? `#0 ~ #${hideEnd} 숨김 · #${hideEnd + 1}부터 보임 (마지막 ${m.keep}개 남김)` : '숨길 메시지가 없어서 모두 보이게 했어요');
}
