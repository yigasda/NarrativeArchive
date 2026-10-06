// The token meter and the compress tab summary.

import { currentChatId } from './chats.js';
import { ctx, getMeta, globalSettings, hasChat } from './core.js';
import { buildExtract, extractToText } from './extract.js';
import { healthChecks } from './health.js';
import { hiddenIndexes } from './hide.js';
import { currentInjection } from './inject.js';
import { renderNext } from './panel.js';
import { activePrompt } from './prompts.js';
import { routerCfg, routerState } from './router.js';
import { ICO_A, svgA } from './theme.js';
import { linkWaiting, mutedCount } from './sections.js';
import { countTokens, esc, fmt, timeLabel } from './util.js';

export let statusTimer = null;
export function refreshStatusSoon() {
    clearTimeout(statusTimer);
    statusTimer = setTimeout(refreshStatus, 400);
}

export async function refreshStatus() {
    if (!$('#na_meter').length) return;
    if (!hasChat()) {
        $('#na_meter_total').text('채팅 없음');
        $('#na_meter_state, #na_meter_stats, #na_meter_legend, #na_since, #na_head_badge').text('');
        $('#na_meter .na_seg_arc, #na_meter .na_seg_raw').css('width', 0);
        return;
    }
    const m = getMeta();
    const chat = ctx().chat || [];
    const last = chat.length - 1;
    const build = await currentInjection();
    const archiveTok = m.enabled ? build.tokens : 0;
    const after = m.boundary >= 0 ? buildExtract(m.boundary + 1, last) : [];
    const afterTok = await countTokens(extractToText(after));
    const total = archiveTok + afterTok;

    $('#na_meter_total').text(fmt(total));
    // "토큰" over the state word, next to the number
    let state = '';
    if (!m.enabled) state = '<b class="off">주입 꺼짐</b>';
    else if (m.backupEvery > 0 && m.sinceBackup >= m.backupEvery) state = '<b class="warn">백업할 때예요</b>';
    else if (m.text.trim()) state = '<b class="on">주입 중</b>';
    $('#na_meter_state').html(`<div>토큰</div>${state}`);
    const waitN = linkWaiting(m).size;
    $('#na_meter_stats').html(`
      <div><span>아카이브</span><b>${fmt(archiveTok)}</b></div>
      <div title="${after.length ? `메시지 ${after.length}개` : ''}"><span>${m.boundary >= 0 ? `원문 #${m.boundary + 1}~` : '경계선 없음'}</span><b>${fmt(afterTok)}</b></div>
      <div><span>키워드 대기</span><b>${waitN}</b></div>`);

    const pct = total ? Math.round(archiveTok / total * 100) : 0;
    $('#na_meter .na_seg_arc').css('width', `${pct}%`);
    $('#na_meter .na_seg_raw').css('width', `${total ? 100 - pct : 0}%`).removeClass('na_over');
    // small line under the tiles: the router, and anything that cuts what goes in
    $('#na_meter_legend').html(`
      ${routerCfg(m).mode !== 'off' ? `<span class="na_router_st">${svgA(ICO_A.compass, 13)} 라우터 · ${routerState.get(currentChatId()) ? `${routerState.get(currentChatId()).titles.length}개 고름` : '답할 때 골라요'}</span>` : ''}
      ${mutedCount(m) ? `<span class="na_warn_txt"><i class="fa-solid fa-toggle-off"></i> 섹션 ${mutedCount(m)}개 꺼짐</span>` : ''}
      ${build.trimmed.length ? `<span class="na_warn_txt"><i class="fa-solid fa-scissors"></i> 상한 ${fmt(build.cap)}에 맞춰 ${build.trimmed.length}개 뺌</span>` : ''}
      ${build.over ? `<span class="na_warn_txt"><i class="fa-solid fa-triangle-exclamation"></i> 상한 ${fmt(build.cap)} 넘음</span>` : ''}`);
    $('#na_head_badge').text(m.text.trim() ? fmt(archiveTok) : '');
    let h = null;
    if (m.text.trim()) {
        h = await healthChecks(m, { build, afterTok, after });
        const n = h.items.filter(x => x.level === 'bad' || x.level === 'warn').length;
        $('#na_health').toggleClass('na_health_warn', h.score < 80).attr('title', `건강 ${h.score}점${n ? ` · 확인할 것 ${n}개` : ''}`).find('span').text(h.score);
        $('#na_tool_health_sub').text(`${h.score}점${n ? ` · 확인할 것 ${n}개` : ' · 괜찮아요'}`);
    } else { $('#na_health span').text('-'); $('#na_tool_health_sub').text('번호·숨기기·키워드·백업을 AI 없이 살펴봐요'); }
    renderNext(m, { afterTok, health: h });

    const lx = m.lastExport;
    const lxNote = lx ? `<small class="na_v2_note">최근 내보냄 #${lx.from}–#${lx.to} · ${esc(timeLabel(lx.at))}</small>` : '';
    const hn = hiddenIndexes().length;
    $('#na_hidden_n').text(hn ? `지금 숨긴 메시지 ${hn}개` : '숨긴 메시지 없음');
    { const gs = globalSettings(), ap = activePrompt(gs); $('#na_plib_sum').text(`${gs.prompts.length}개 · ${ap.fav ? '즐겨찾기 ★' : '지금'} ${ap.name}`); }
    $('#na_since').html(m.boundary >= 0 ? `
      <div class="na_cp_hhead"><span>경계선 #${m.boundary} 뒤에 쌓인 원문</span><span>마지막 #${last}</span></div>
      <div class="na_cp_big"><b>${fmt(afterTok)}</b><span>토큰 · 메시지 ${after.length}개</span></div>
      <div class="na_cp_bar"><span class="hid" style="flex:${Math.max(1, m.boundary + 1)}"></span><span class="raw" style="flex:${Math.max(1, last - m.boundary)}"></span></div>
      <div class="na_cp_hhead"><small>#0 – #${m.boundary} 숨김 (압축됨)</small><small>${last > m.boundary ? `#${m.boundary + 1} – #${last} 원문` : '원문 없음'}</small></div>
      ${lxNote}` : '<div class="na_cp_hhead"><span>경계선이 아직 없어요</span></div><small class="na_v2_note">직접 적거나 "아카이브에 추가"를 쓰면 자동으로 정해져요.</small>');
}
