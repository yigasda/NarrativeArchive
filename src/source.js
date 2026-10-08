// Opening the raw messages a section was made from.

import { currentChatId, fetchOtherChat, pickOtherChat } from './chats.js';
import { ctx, getMeta, hasChat, saveMeta } from './core.js';
import { cleanMessage } from './extract.js';
import { sectionPanel } from './panel.js';
import { mdBlock } from './reader.js';
import { RANGE_HEAD, headingRanges } from './sections.js';
import { esc } from './util.js';

// A section titled "Y2 #564–#567 — ..." opens messages #564–#567 of this chat. Only the newest log's prefix
// (the one the last numbered section uses) is this chat; older logs live in other chats.

export function sourceRange(m, title) {
    const r = String(title || '').replace(/^#{1,3}\s+/, '').match(RANGE_HEAD); // "## " marks only, not "#0"
    if (!r) return null;
    const prefix = (r[1] || '').trim();
    const from = Math.min(+r[2], +r[4]), to = Math.max(+r[2], +r[4]);
    const ranges = headingRanges(m.text);
    const cur = ranges.length ? ranges[ranges.length - 1].prefix : '';
    const label = `${prefix ? `${prefix} ` : ''}#${from}–#${to}`;
    const linked = (m.logLinks || {})[prefix] || null;
    // in an AU chat the AU's numbers are this chat's, whatever the archive's last log or a carried-over link says
    const au = m?.au?.on ? String(m.au.name || '').trim().replace(/\s+/g, '') || 'AU' : null;
    const here = au !== null && prefix === au;
    // carried over from another chat: even the newest log's numbers live in that chat
    if (!here && prefix === cur && linked && linked !== currentChatId()) return { prefix, from, to, ok: true, chat: linked, needLink: false, why: '', label };
    if (!here && prefix !== cur) {
        // an older log: open it from the chat it was linked to, or ask which chat that is
        const chat = linked;
        return { prefix, from, to, ok: true, chat, needLink: !chat, why: '', label };
    }
    const n = (ctx().chat || []).length;
    const why = from >= n ? '이 채팅에 아직 없는 번호예요' : '';
    return { prefix, from, to: Math.min(to, n - 1), ok: !why, why, label };
}

// 'icon' for card toolbars, 'chip' for the reader and diffs; '' when the title has no range
export function srcButton(m, title, kind) {
    const r = sourceRange(m, title);
    if (!r) return '';
    const data = `data-from="${r.from}" data-to="${r.to}" data-label="${esc(r.label)}" data-prefix="${esc(r.prefix)}"${r.chat ? ` data-chat="${esc(r.chat)}"` : ''}${r.needLink ? ' data-link="1"' : ''}`;
    const tip = !r.ok ? r.why : r.needLink ? '이전 채팅의 번호예요 · 누르면 어느 채팅인지 골라서 열어요' : r.chat ? `이전 채팅에서 열어요: ${r.chat}` : '이 섹션의 원문 메시지 보기';
    const cls = r.needLink ? ' na_src_link' : '';
    if (kind === 'icon') return `<button type="button" class="na_btn na_small na_src_btn${cls}" ${data} ${r.ok ? '' : 'disabled'} title="${esc(tip)}"><i class="fa-solid fa-arrow-up-right-from-square"></i> 원문</button>`;
    return `<button type="button" class="na_src_chip na_src_btn${cls}" ${data} ${r.ok ? '' : 'disabled'} title="${esc(tip)}"><i class="fa-solid fa-arrow-up-right-from-square"></i> 원문 ${esc(r.label)}</button>`;
}

export async function openSource(from, to, label, otherChat = null, prefix = '') {
    const c = ctx();
    let chat = c.chat || [];
    if (otherChat) {
        try { chat = (await fetchOtherChat(otherChat)).messages; }
        catch (e) { toastr.error(`이전 채팅을 못 열었어요: ${e.message || e}`); return; }
    }
    const items = [];
    for (let i = from; i <= to && i < chat.length; i++) {
        const x = chat[i];
        if (!x) continue;
        const text = cleanMessage(String(x.mes || ''), { stripTags: true });
        items.push(`<div class="na_src_msg ${x.is_user ? 'na_src_user' : ''}" data-id="${i}">
            <div class="na_src_head"><b>#${i}</b> <span>${esc(x.name || '')}</span>${x.is_system ? '<span class="na_chip">숨김</span>' : ''}
              ${otherChat ? '' : '<button type="button" class="na_linkbtn na_src_goto">채팅에서 보기</button>'}</div>
            <div class="na_src_body">${mdBlock(text) || '<span class="na_dim">(비어 있음)</span>'}</div>
          </div>`);
    }
    const $v = $(`
      <div class="na_popup na_popup_fill">
        <div class="na_diff_head"><b>원문 ${esc(label)}</b><span class="na_dim">메시지 ${items.length}개</span></div>
        ${otherChat ? `<div class="na_src_from na_dim"><i class="fa-solid fa-link"></i> ${esc(otherChat)} <button type="button" class="na_linkbtn na_src_relink">다른 채팅으로 바꾸기</button></div>` : ''}
        <div class="na_src_list">${items.join('') || `<div class="na_empty">${otherChat ? '그 채팅에 이 번호의 메시지가 없어요. 다른 채팅을 골라 보세요.' : '이 채팅에 그 번호의 메시지가 없어요.'}</div>`}</div>
      </div>`);
    $v.data('prefix', prefix).data('range', { from, to, label });
    $v.on('click', '.na_src_goto', function () {
        const id = $(this).closest('.na_src_msg').data('id');
        const $mes = $(`#chat .mes[mesid="${id}"]`);
        if (!$mes.length) return toastr.info('채팅 화면에 아직 불러오지 않은 메시지예요. 위로 스크롤해 더 불러온 뒤 다시 눌러 주세요.');
        // close this and any read-only popups under it (never one with a 취소 that would drop someone's input)
        $('dialog').filter((i, d) => d.open && $(d).find('.na_popup').length && !$(d).find('.popup-button-cancel').filter(':visible').length)
            .get().reverse().forEach(d => $(d).find('.popup-button-ok').first().trigger('click'));
        setTimeout(() => $mes[0].scrollIntoView({ block: 'start', behavior: 'smooth' }), 150);
    });
    await c.callGenericPopup($v, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// which chat holds an older log's numbers; saved in the archive's settings so it follows the archive
export async function linkLog(prefix) {
    const id = await pickOtherChat(`${prefix || '앞 번호'} 로그는 어느 채팅이에요?`,
        `<b>${esc(prefix || '앞 번호(접두어 없음)')}</b> 섹션의 원문이 있는 채팅을 골라 주세요. 한 번 고르면 기억하고, 아카이브를 다음 채팅에 가져가도 따라가요.`);
    if (!id) return null;
    const m = getMeta();
    m.logLinks = { ...(m.logLinks || {}), [prefix]: id };
    await saveMeta();
    sectionPanel?.render();
    return id;
}

$(document).on('click', '.na_src_btn', async function (e) {
    e.stopPropagation();
    if (this.disabled || !hasChat()) return;
    const d = this.dataset;
    let chat = d.chat || null;
    if (d.link) { chat = await linkLog(d.prefix || ''); if (!chat) return; }
    openSource(Number(d.from), Number(d.to), d.label || '', chat, d.prefix || '');
});

$(document).on('click', '.na_src_relink', async function () {
    const $pop = $(this).closest('.na_popup');
    const prefix = String($pop.data('prefix') ?? '');
    const range = $pop.data('range');
    const id = await linkLog(prefix);
    if (!id || !range) return;
    $pop.closest('dialog').find('.popup-button-ok').trigger('click');
    openSource(range.from, range.to, range.label, id, prefix);
});
