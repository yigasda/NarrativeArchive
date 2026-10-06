// Branches: sections that belong after the branch point.

import { currentChatId, fetchOtherChat, listOtherChats } from './chats.js';
import { MODULE, commitText, ctx, getMeta } from './core.js';
import { openDiff } from './diff.js';
import { lastIndex } from './hide.js';
import { syncPanel } from './panel.js';
import { RANGE_HEAD, headingRanges, lastRangeEnd, parseSections } from './sections.js';
import { confirm, esc, fmt, timeLabel } from './util.js';

// SillyTavern copies the chat metadata (and so the archive) into a branch. If the branch starts before the
// archive's last section, the copy carries sections of a future this branch no longer has.

export function branchState(m) {
    const c = ctx();
    const parent = c.chatMetadata?.main_chat || null;
    const last = lastIndex();
    const ranges = headingRanges(m.text);
    const cur = ranges.length ? ranges[ranges.length - 1].prefix : '';
    const secs = parseSections(m.text).filter(x => !x.group);
    const ahead = !parent ? [] : secs.map(x => ({ s: x, r: x.title.match(RANGE_HEAD) }))
        .filter(x => x.r && (x.r[1] || '').trim() === cur && Math.min(+x.r[2], +x.r[4]) > last)
        .map(x => ({ s: x.s, from: Math.min(+x.r[2], +x.r[4]), to: Math.max(+x.r[2], +x.r[4]) }));
    // the newest restore point whose numbers stop inside this branch
    const fit = ahead.length ? (m.snapshots || []).find(sn => { const rr = headingRanges(sn.text).filter(x => x.prefix === cur); return rr.length && rr[rr.length - 1].to <= last; }) : null;
    return { parent, last, cur, ahead, fit };
}

export async function openBranches() {
    const c = ctx();
    const m = getMeta();
    const here = currentChatId();
    const $root = $(`<div class="na_popup na_v2 na_bn2"><div class="na_v2_title"><b>분기</b><small>갈라질 때 아카이브도 같이 복사돼요. 분기 지점 뒤 섹션을 정리해요</small></div><div class="na_bn2_body"></div></div>`);
    const icon = (cls, svg) => `<span class="na_bn2_icon ${cls}">${svg}</span>`;
    const SVG = d => `<svg class="na_c_svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    const ICON_CHAT = SVG('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>');
    const ICON_BRANCH = SVG('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="9" r="3"/><path d="M6 9v6M18 12c0 4-6 3-9 6"/>');
    const ICON_WARN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
    const ICON_OK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    const nWord = n => n === 1 ? '이 섹션' : n <= 4 ? `${['', '', '두', '세', '네'][n]} 섹션` : `섹션 ${n}개`;
    const render = () => {
        const b = branchState(m);
        const parentName = b.parent ? esc(String(b.parent).replace(/\s*-\s*\d{4}-\d{1,2}-\d{1,2}.*$/, '') || b.parent) : '';
        const rng = x => `${b.cur ? `${esc(b.cur)} ` : ''}#${x.from}–#${x.to}`;
        const name = x => esc(x.s.title.replace(RANGE_HEAD, '$5').replace(/^\s*[—–-]\s*/, '').trim() || x.s.title);
        const hereName = String(here || '').replace(/\s*-\s*\d{4}-\d{1,2}-\d{1,2}.*$/, '') || String(here || '');
        const fitTo = b.fit ? (headingRanges(b.fit.text).filter(x => x.prefix === b.cur).pop()?.to ?? b.last) : b.last;
        $root.find('.na_bn2_body').html(`
          ${b.parent ? `
          <div class="na_v2_card na_bn2_map">
            <div class="na_bn2_flow">
              <div class="na_bn2_node">${icon('', ICON_CHAT)}<b>원본</b><small title="${esc(b.parent)}">${esc(String(b.parent).replace(/@[^@]*$/, '').replace(/ - /, ' – '))}</small></div>
              <div class="na_bn2_link"><b>#${b.last}에서 갈라짐</b><span></span></div>
              <div class="na_bn2_node">${icon('here', ICON_BRANCH)}<b>이 채팅</b><small title="${esc(String(here || ''))} · 메시지 ${fmt(b.last + 1)}개">${esc(hereName) || `메시지 ${fmt(b.last + 1)}개`}</small></div>
            </div>
            ${b.ahead.length ? `<div class="na_bn2_warn">${ICON_WARN}<span>분기 지점 뒤 이야기가 섹션 ${b.ahead.length}개에 섞여 있어요. 이 채팅에선 일어나지 않은 일이에요.</span></div>`
              : `<div class="na_bn2_ok">${ICON_OK}<span>분기 지점 뒤에 쓴 섹션이 없어요.</span></div>`}
            <button type="button" class="na_v2_pillbtn na_br_cmp_parent" title="원본 채팅의 아카이브와 나란히 비교해요">원본(${parentName}) 아카이브와 비교</button>
          </div>` : '<div class="na_v2_card na_v2_note">이 채팅은 분기가 아니에요 (원본 채팅 정보가 없어요).</div>'}
          ${b.ahead.length ? `
          <div class="na_v2_label">#${b.last} 뒤에 쓴 섹션</div>
          <div class="na_v2_card na_v2_list">${b.ahead.map((x, i) => `
            <div class="na_cp_row"><span class="na_cp_txt"><small>${rng(x)}</small><b>${name(x)}</b></span>
              <button type="button" class="na_v2_pillbtn danger na_bn2_drop" data-i="${i}">빼기</button></div>`).join('')}
          </div>
          <div class="na_bn2_acts">
            <button type="button" class="na_v2_btn primary na_br_cut">${nWord(b.ahead.length)} 빼고 #${b.last}까지로 맞추기</button>
            ${b.fit ? `<button type="button" class="na_v2_btn na_br_restore" title="${esc(timeLabel(b.fit.at))} · ${esc(b.fit.reason)}">#${fitTo} 무렵 복구 지점으로 되돌리기</button>` : ''}
          </div>
          <div class="na_v2_note na_bn2_note">STATE·OPEN도 원본의 마지막 시점 기준일 수 있어요. 맞추고 나서 확인해 주세요.</div>` : ''}
          <div class="na_bn2_find">
            <div class="na_bn2_findrow"><span class="na_cp_txt"><b>이 채팅에서 갈라진 분기</b><small>같은 캐릭터 채팅을 열어 찾아요</small></span>
              <button type="button" class="na_v2_btn na_br_find">찾기</button></div>
            <div class="na_br_kids"></div>
          </div>`);
    };
    const cutSections = async (drop, n) => {
        const b = branchState(m);
        const secs = parseSections(m.text);
        const next = secs.filter(x => !drop.has(x.start)).map(x => m.text.slice(x.start, x.end)).join('');
        const end = lastRangeEnd(next);
        await commitText(next, '분기 정리 전', { boundary: m.boundary >= 0 ? Math.min(m.boundary, end ?? b.last, b.last) : m.boundary });
        toastr.success(`${n}개 뺐어요. STATE·OPEN이 맞는지 확인해 주세요.`); render();
    };
    $root.on('click', '.na_bn2_drop', async function () {
        const x = branchState(m).ahead[Number(this.dataset.i)];
        if (!x || !await confirm('섹션 빼기', `"${esc(x.s.title)}"을 뺄까요? 지금 내용은 복구 지점에 남아요.`)) return;
        await cutSections(new Set([x.s.start]), 1);
    });
    render();
    const compareWith = async (id, label) => {
        try {
            const other = (await fetchOtherChat(id)).meta?.[MODULE];
            if (!other?.text?.trim()) return toastr.info('그 채팅엔 아카이브가 없어요.');
            await openDiff({ at: Date.now(), reason: label, text: other.text }, { text: m.text, label: '이 채팅' });
        } catch (e) { toastr.error(`못 열었어요: ${e.message || e}`); }
    };
    $root.on('click', '.na_br_cmp_parent', () => compareWith(branchState(m).parent, '원본 채팅'));
    $root.on('click', '.na_br_restore', async () => {
        const b = branchState(m);
        if (!b.fit || !await confirm('복구 지점으로', `${timeLabel(b.fit.at)} · ${esc(b.fit.reason)} 버전으로 되돌릴까요? 지금 내용은 복구 지점에 남아요.`)) return;
        await commitText(b.fit.text, '분기 정리 전', { boundary: Math.min(b.fit.boundary ?? -1, b.last) });
        toastr.success('되돌렸어요'); render();
    });
    $root.on('click', '.na_br_cut', async () => {
        const b = branchState(m);
        if (!await confirm('섹션 빼기', `분기 지점 뒤의 섹션 ${b.ahead.length}개를 뺄까요? 지금 내용은 복구 지점에 남아요.`)) return;
        await cutSections(new Set(b.ahead.map(x => x.s.start)), b.ahead.length);
    });
    $root.on('click', '.na_br_find', async function () {
        const $kids = $root.find('.na_br_kids').html('<div class="na_dim">찾는 중…</div>');
        $(this).prop('disabled', true);
        try {
            const chats = await listOtherChats();
            const kids = [];
            for (const [i, x] of chats.entries()) {
                $kids.html(`<div class="na_dim">찾는 중… ${i + 1}/${chats.length}</div>`);
                try { const f = await fetchOtherChat(x.id); if (f.meta?.main_chat === here) kids.push({ ...x, arc: f.meta?.[MODULE], n: f.messages.length }); } catch { /* skip unreadable */ }
            }
            $kids.html(kids.length ? `<div class="na_v2_list">${kids.map(k => `
              <div class="na_cp_row"><span class="na_cp_txt"><b>${esc(k.label)}</b>
                <small>메시지 ${fmt(k.n)}개${k.arc?.text?.trim() ? ` · 아카이브 #${lastRangeEnd(k.arc.text) ?? '?'}까지` : ' · 아카이브 없음'}</small></span>
                ${k.arc?.text?.trim() ? `<button type="button" class="na_v2_pillbtn na_br_cmp" data-id="${esc(k.id)}">비교</button>` : ''}</div>`).join('')}</div>` : '<div class="na_v2_note">이 채팅에서 갈라진 분기가 없어요.</div>');
        } catch (e) { $kids.html('<div class="na_dim">채팅 목록을 못 불러왔어요.</div>'); }
        $(this).prop('disabled', false);
    });
    $root.on('click', '.na_br_cmp', function () { compareWith(String(this.dataset.id), '분기'); });
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
    syncPanel();
}
