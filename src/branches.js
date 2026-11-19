// Branches: sections that belong after the branch point.

import { currentChatId, fetchOtherChat, listOtherChats } from './chats.js';
import { MODULE, commitText, ctx, getMeta, hasChat, saveMeta } from './core.js';
import { openDiff } from './diff.js';
import { lastIndex } from './hide.js';
import { syncPanel } from './panel.js';
import { RANGE_HEAD, headingRanges, lastRangeEnd, parseSections, sectionKey } from './sections.js';
import { confirm, esc, fmt, timeLabel } from './util.js';

// SillyTavern copies the chat metadata (and so the archive) into a branch. If the branch starts before the
// archive's last section, the copy carries sections of a future this branch no longer has. A section that runs
// past the branch point (#121–#131 when the branch is at #127) carries some of it too, so it goes as well and the
// boundary comes back to the section before it: its earlier messages are compressed again from this chat.

// The branch point is kept with the chat: the chat's own last message is only right until the branch goes on,
// and after that a parent's later sections would read as this branch's past. Found once by reading the parent:
// SillyTavern writes the branch's name on the parent message it was made from (extra.branches), which holds even
// after earlier parent messages are edited or swiped. A branch made before that list existed: the last message the
// two still share. When the parent can't be read, no number is guessed: the 분기 window asks for it.
// Only sections that are also in the parent's archive count as the parent's future: a section this branch wrote
// itself after going on past the branch point is its own story (keys: the parent's section titles, when it has any).
export const branchPointOf = (m, parent) => (parent && m.branchAt?.parent === parent && Number.isFinite(m.branchAt.at) ? m.branchAt.at : null);
let branchSeeking = '';
export async function findBranchPoint() {
    if (!hasChat()) return;
    const c = ctx(), m = getMeta(), parent = c.chatMetadata?.main_chat || null;
    if (!parent || branchPointOf(m, parent) !== null || branchSeeking === parent) return;
    branchSeeking = parent;
    const mine = c.chat || [];
    let at = mine.length - 1, how = 'end';
    let read = false, keys = null;
    try {
        const got = await fetchOtherChat(parent), theirs = got.messages || [];
        const ptext = String(got.meta?.[MODULE]?.text || '');
        if (ptext.trim()) keys = parseSections(ptext).filter(x => !x.group).map(sectionKey);
        // a chat that isn't there comes back empty rather than failing
        read = theirs.length > 0;
        const name = currentChatId();
        const marked = name ? theirs.findIndex(x => Array.isArray(x?.extra?.branches) && x.extra.branches.includes(name)) : -1;
        if (marked >= 0) { at = marked; how = 'mark'; }
        else {
            const same = (a, b) => a && b && String(a.mes ?? '') === String(b.mes ?? '') && !!a.is_user === !!b.is_user;
            let i = 0;
            while (i < mine.length && i < theirs.length && same(mine[i], theirs[i])) i++;
            if (i > 0) { at = i - 1; how = 'parent'; }
        }
    } catch (e) { console.warn('[NarrativeArchive] branch point: parent not read', e); }
    finally { branchSeeking = ''; }
    // the chat may have changed while the parent was read
    if (ctx().chatMetadata?.main_chat !== parent || getMeta() !== m) return;
    // not read (renamed or deleted): no number is guessed; the 분기 window asks for it, and the next open tries again
    m.branchAt = read ? { parent, at, how, ...(keys ? { keys } : {}) } : { parent, at: null, how: 'missing' };
    await saveMeta();
    syncPanel();
}
export const branchMissing = (m, parent) => !!parent && m.branchAt?.parent === parent && m.branchAt.how === 'missing';

// opening a branch whose archive carries what came after the branch point: say so once, in the middle of the
// chat, with the way to the 분기 window (where the sections are taken out)
export async function branchNotice() {
    await findBranchPoint();
    if (!hasChat()) return;
    const m = getMeta(), b = branchState(m);
    // the parent not found: whether sections are mixed in can't be told, so any section is reason enough to say so
    const has = b.missing ? parseSections(m.text).some(x => !x.group && RANGE_HEAD.test(x.title)) : b.ahead.length > 0;
    if (!b.parent || !has || m.branchNoticed === b.parent) return;
    m.branchNoticed = b.parent;
    await saveMeta();
    const text = b.missing ? '이 채팅은 분기인데 원본 채팅을 못 찾았어요. 몇 번에서 갈라졌는지 적으면 섞인 섹션을 찾아 줘요.'
        : `이 채팅은 #${b.last}에서 갈라졌는데, 아카이브에 그 뒤 이야기가 든 섹션 ${b.ahead.length}개가 있어요.`;
    if (await confirm('분기', text, '분기 정리', { no: '닫기' })) openBranches();
}

export function branchState(m) {
    const c = ctx();
    const parent = c.chatMetadata?.main_chat || null;
    const missing = branchMissing(m, parent);
    const last = branchPointOf(m, parent) ?? lastIndex();
    const ranges = headingRanges(m.text);
    const cur = ranges.length ? ranges[ranges.length - 1].prefix : '';
    const secs = parseSections(m.text).filter(x => !x.group);
    const fromParent = m.branchAt?.parent === parent && Array.isArray(m.branchAt.keys) ? new Set(m.branchAt.keys) : null;
    const ahead = !parent || missing ? [] : secs.map(x => ({ s: x, r: x.title.match(RANGE_HEAD) }))
        .filter(x => x.r && (x.r[1] || '').trim() === cur && Math.max(+x.r[2], +x.r[4]) > last && (!fromParent || fromParent.has(sectionKey(x.s))))
        .map(x => ({ s: x.s, from: Math.min(+x.r[2], +x.r[4]), to: Math.max(+x.r[2], +x.r[4]) }));
    // the newest restore point whose numbers stop inside this branch
    const fit = ahead.length ? (m.snapshots || []).find(sn => { const rr = headingRanges(sn.text).filter(x => x.prefix === cur); return rr.length && rr[rr.length - 1].to <= last; }) : null;
    const keepTo = ahead.length ? Math.min(last, Math.min(...ahead.map(x => x.from)) - 1) : last;
    // this branch's own sections after the ones that go (it went on and compressed): the first one's start
    const gone = new Set(ahead.map(x => x.s.start));
    const own = ahead.length ? secs.map(x => ({ x, r: x.title.match(RANGE_HEAD) })).filter(({ x, r }) => r && !gone.has(x.start) && (r[1] || '').trim() === cur && Math.min(+r[2], +r[4]) > keepTo).map(({ r }) => Math.min(+r[2], +r[4])) : [];
    const ownFrom = own.length ? Math.min(...own) : null;
    return { parent, last, cur, ahead, fit, keepTo, ownFrom, missing, typed: m.branchAt?.parent === parent && m.branchAt.how === 'user' };
}

export async function openBranches() {
    const c = ctx();
    const m = getMeta();
    const here = currentChatId();
    const $root = $(`<div class="na_popup na_v2 na_bn2"><div class="na_v2_title"><b>분기</b><small>갈라질 때 복사된 아카이브를 정리해요</small></div><div class="na_bn2_body"></div></div>`);
    const icon = (cls, svg) => `<span class="na_bn2_icon ${cls}">${svg}</span>`;
    const SVG = d => `<svg class="na_c_svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    const ICON_CHAT = SVG('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>');
    const ICON_BRANCH = SVG('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="9" r="3"/><path d="M6 9v6M18 12c0 4-6 3-9 6"/>');
    const ICON_WARN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
    const ICON_OK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    const nWord = n => n === 1 ? '이 섹션' : n <= 4 ? `${['', '', '두', '세', '네'][n]} 섹션` : `섹션 ${n}개`;
    await findBranchPoint();
    const render = () => {
        const b = branchState(m);
        const parentName = b.parent ? esc(String(b.parent).replace(/\s*-\s*\d{4}-\d{1,2}-\d{1,2}.*$/, '') || b.parent) : '';
        const rng = x => `${b.cur ? `${esc(b.cur)} ` : ''}#${x.from}–#${x.to}`;
        const name = x => esc(x.s.title.replace(RANGE_HEAD, '$5').replace(/^\s*[—–-]\s*/, '').trim() || x.s.title);
        const hereName = String(here || '').replace(/\s*-\s*\d{4}-\d{1,2}-\d{1,2}.*$/, '') || String(here || '');
        const fitTo = b.fit ? (headingRanges(b.fit.text).filter(x => x.prefix === b.cur).pop()?.to ?? b.last) : b.last;
        // not a branch (docs/mockups/ext-drift D+F): a centred timeline ending here, one 찾기 button; results land below it
        $root.toggleClass('na_bn3_new', !b.parent);
        $root.find('.na_bn2_body').html(`
          ${b.parent ? `
          <div class="na_v2_card na_bn2_map">
            <div class="na_bn2_flow">
              <div class="na_bn2_node">${icon('', ICON_CHAT)}<b>원본</b><small title="${esc(b.parent)}">${esc(String(b.parent).replace(/@[^@]*$/, '').replace(/ - /, ' – '))}</small></div>
              <div class="na_bn2_link"><b>${b.missing ? '?' : `#${b.last}`}에서 갈라짐</b><span></span></div>
              <div class="na_bn2_node">${icon('here', ICON_BRANCH)}<b>이 채팅</b><small title="${esc(String(here || ''))} · 메시지 ${fmt(lastIndex() + 1)}개">${esc(hereName) || `메시지 ${fmt(lastIndex() + 1)}개`}</small></div>
            </div>
            ${b.missing || b.typed ? `<div class="na_cp_row na_cp_keep_row na_cp_to na_bn2_at"><span class="na_cp_txt"><span>원본 채팅을 못 찾았어요</span><small>몇 번에서 갈라졌나요?</small></span><span class="na_cp_tostep"><button type="button" class="na_fd_btn na_bn2_atbtn" data-d="-1" aria-label="줄이기">−</button><span class="na_cp_toval">#<span class="na_cp_tonum">${b.last}</span><input type="number" id="na_bn_at" class="text_pole" min="0" max="${lastIndex()}" value="${b.last}" aria-label="분기 번호" inputmode="numeric"></span><button type="button" class="na_fd_btn na_bn2_atbtn" data-d="1" aria-label="늘리기">+</button></span></div>
            ${b.missing ? `<button type="button" class="na_v2_pillbtn na_bn2_atok">#${b.last}에서 갈라졌어요</button>` : ''}` : ''}
            ${b.missing ? '' : b.ahead.length ? `<div class="na_bn2_warn">${ICON_WARN}<span>분기 뒤 이야기가 섹션 ${b.ahead.length}개에 섞여 있어요 · 이 채팅에선 없던 일이에요</span></div>`
              : `<div class="na_bn2_ok">${ICON_OK}<span>분기 지점 뒤에 쓴 섹션이 없어요.</span></div>`}
            ${b.missing || b.typed ? '' : `<button type="button" class="na_v2_pillbtn na_br_cmp_parent" title="원본 채팅의 아카이브와 나란히 비교해요">원본(${parentName}) 아카이브와 비교</button>`}
          </div>` : `
          <div class="na_bn3_hello">
            <div class="na_bn3_tl">
              <div><b>#0–#${Math.max(0, b.last - 1)}</b><small>지금까지 쓴 이야기</small></div>
              <div class="here"><b>#${b.last} · 이 채팅</b><small>여기가 끝이에요 · 갈라진 적 없음</small></div>
              <div class="dim"><b>분기</b><small>여기서 갈라진 채팅이 있으면 이어서 보여요</small></div>
            </div>
            <b>이 채팅은 분기가 아니에요</b><small>여기서 갈라진 분기가 있으면<br>아카이브를 나란히 비교할 수 있어요</small>
            <button type="button" class="na_bn3_find">갈라진 분기 찾기</button>
          </div>`}
          ${b.ahead.length ? `
          <div class="na_v2_label">#${b.last} 뒤에 쓴 섹션</div>
          <div class="na_v2_card na_v2_list">${b.ahead.map((x, i) => `
            <div class="na_cp_row"><span class="na_cp_txt"><small>${rng(x)}</small><b>${name(x)}</b></span>
              <button type="button" class="na_v2_pillbtn danger na_bn2_drop" data-i="${i}">빼기</button></div>`).join('')}
          </div>
          <div class="na_bn2_acts">
            <button type="button" class="na_v2_btn primary na_br_cut">${b.ownFrom !== null ? `${nWord(b.ahead.length)} 빼기` : `${nWord(b.ahead.length)} 빼고 #${b.keepTo}까지로 맞추기`}</button>
            ${b.fit ? `<button type="button" class="na_v2_btn na_br_restore" title="${esc(timeLabel(b.fit.at))} · ${esc(b.fit.reason)}">#${fitTo} 무렵 복구 지점으로 되돌리기</button>` : ''}
          </div>
          <div class="na_v2_note na_bn2_note">맞춘 뒤 STATE · OPEN도 확인해 주세요</div>` : ''}
          <div class="na_bn2_find">
            <div class="na_bn2_findrow"><span class="na_cp_txt"><b>이 채팅에서 갈라진 분기</b><small>같은 캐릭터 채팅을 열어 찾아요</small></span>
              <button type="button" class="na_v2_btn na_br_find">찾기</button></div>
            <div class="na_br_kids"></div>
          </div>`);
    };
    // the branch point typed by hand (the parent wasn't found)
    const setAt = async v => {
        const p = branchState(m).parent;
        if (!p) return;
        m.branchAt = { parent: p, at: Math.min(lastIndex(), Math.max(0, Number.isFinite(v) ? v : lastIndex())), how: 'user' };
        await saveMeta(); syncPanel(); render();
    };
    $root.on('change', '#na_bn_at', function () { setAt(parseInt(this.value, 10)); });
    $root.on('input', '#na_bn_at', function () { $root.find('.na_bn2_at .na_cp_tonum').text(this.value || ' '); });
    $root.on('click', '.na_bn2_atbtn', function () { setAt((parseInt($root.find('#na_bn_at').val(), 10) || 0) + Number(this.dataset.d)); });
    $root.on('click', '.na_bn2_atok', () => setAt(parseInt($root.find('#na_bn_at').val(), 10)));
    const cutSections = async (drop, n) => {
        const b = branchState(m);
        const secs = parseSections(m.text);
        const next = secs.filter(x => !drop.has(x.start)).map(x => m.text.slice(x.start, x.end)).join('');
        const end = lastRangeEnd(next);
        await commitText(next, '분기 정리 전', { boundary: m.boundary >= 0 ? Math.min(m.boundary, end ?? b.keepTo) : m.boundary });
        // this branch's own sections further on keep the boundary there; the messages in between had the parent's
        // sections and now have none (압축 › 빠진 구간 doesn't see a hole in the middle)
        const hole = b.ownFrom !== null && b.ownFrom > b.keepTo + 1 ? ` · #${b.keepTo + 1}–#${b.ownFrom - 1} 구간은 마법사로 다시 압축해 주세요` : '';
        toastr.success(hole ? `${n}개 뺐어요${hole}` : `${n}개 뺐어요. STATE·OPEN이 맞는지 확인해 주세요.`, '', hole ? { timeOut: 10000 } : {}); render();
    };
    $root.on('click', '.na_bn2_drop', async function () {
        const x = branchState(m).ahead[Number(this.dataset.i)];
        if (!x || !await confirm('섹션 빼기', `"${esc(x.s.title)}"을 뺄까요? 지금 내용은 복구 지점에 남아요.`, '빼기', { danger: true })) return;
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
        if (!b.fit || !await confirm('복구 지점으로', `${timeLabel(b.fit.at)} · ${esc(b.fit.reason)} 버전으로 되돌릴까요? 지금 내용은 복구 지점에 남아요.`, '되돌리기')) return;
        await commitText(b.fit.text, '분기 정리 전', { boundary: Math.min(b.fit.boundary ?? -1, b.last) });
        toastr.success('되돌렸어요'); render();
    });
    $root.on('click', '.na_br_cut', async () => {
        const b = branchState(m);
        if (!await confirm('섹션 빼기', `분기 지점 뒤의 섹션 ${b.ahead.length}개를 뺄까요? 지금 내용은 복구 지점에 남아요.`, '빼기', { danger: true })) return;
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
    $root.on('click', '.na_bn3_find', () => $root.find('.na_br_find').trigger('click'));
    $root.on('click', '.na_br_cmp', function () { compareWith(String(this.dataset.id), '분기'); });
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: false, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
    syncPanel();
}
