// The archive tab: section cards (list and timeline).

import { commitText, getMeta, globalSettings, saveGlobal, saveMeta } from './core.js';
import { layersOf, openLayers } from './fade.js';
import { lastBuild } from './inject.js';
import { openKeywords } from './keywords.js';
import { showArchiveView } from './panel.js';
import { mdInline } from './reader.js';
import { RANGE_HEAD, cachedTokens, checkHeadings, groupLabel, highlight, insertAfterText, keyAt, linkWaiting, linkedMap, moveSectionText, mutedSet, parseSections, pinnedSet, renameKeys, sectionKey, sectionLinks, setLinked, setMuted, setPinned, shortNum, trimEnd } from './sections.js';
import { srcButton } from './source.js';
import { ICO_A, darkUI, svgA } from './theme.js';
import { confirm, esc, escRe, fmt } from './util.js';

// a timeline card's three-line preview: prose, without "PLOT:" style labels and bullet marks
export const tlPreview = body => body.replace(/^#{1,2} [^\n]*\n?/, '').split('\n')
    .map(l => l.trim()).filter(l => l && !/^[A-Z][A-Z /&'’-]{1,30}:$/.test(l) && !/^-{3,}$/.test(l))
    .map(l => l.replace(/^[-*•]\s+/, '')).join(' ');

export function mountSectionBrowser($host) {
    const g0 = globalSettings();
    const $root = $(`
      <div class="na_browser ${g0.archLayout === 'tl' ? 'na_tl' : ''}">
        <div class="na_br_top">
          <div class="na_search_wrap">
            <i class="fa-solid fa-magnifying-glass"></i>
            <svg class="na_tlb_mag" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
            <input type="search" class="text_pole na_search" placeholder="이름, 장소, 대사로 찾기">
            <button type="button" class="na_rp_open" title="아카이브 전체에서 찾아 바꾸기">찾아 바꾸기</button>
          </div>
          <div class="na_br_view" role="group" aria-label="보기">
            <button type="button" data-v="list" title="카드 목록" aria-label="카드 목록">${svgA(ICO_A.list, 16)}</button>
            <button type="button" data-v="tl" title="타임라인으로 보기" aria-label="타임라인">${svgA(ICO_A.tl, 16)}</button>
          </div>
          <button type="button" class="na_tlb_sq na_tlb_raw" title="원문 편집" aria-label="원문 편집"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button>
          <button type="button" class="na_tlb_sq na_tlb_more" title="더 보기" aria-label="더 보기"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
        </div>
        <div class="na_tlb_menu">
          <button type="button" class="na_v2_pillbtn na_tlb_list">${svgA(ICO_A.list, 14)}목록으로 보기</button>
          <button type="button" class="na_v2_pillbtn na_rp_open" title="아카이브 전체에서 찾아 바꾸기">찾아 바꾸기</button>
          <span class="na_tlb_hc"></span>
        </div>
        <div class="na_arch_tools"></div>
        <div class="na_br_filters"></div>
        <div class="na_tl_legend" aria-hidden="true"><span><i class="st-long"></i>원문</span><span><i class="st-short"></i>짧게</span><span><i class="st-line"></i>한 줄</span><span><i class="st-key"></i>키워드 대기</span><span><i class="st-off"></i>꺼짐</span></div>
        <div class="na_search_info"></div>
        <div class="na_list"></div>
      </div>`);
    $host.empty().append($root);
    // find & replace and the heading check sit as two pills under the search
    $root.find('.na_arch_tools').append($('#na_replace'), $('#na_hcheck'));
    // list ↔ timeline switch: a small icon at the end of the "섹션 카드 / 원문 편집" tabs (the list mockup has no room for it)
    const $view = $root.find('.na_br_view');
    $view.find('button').on('click', function () { setLayout(this.dataset.v === 'tl'); });
    const $seg = $host.closest('.na_tab_pane').find('.na_seg');
    if ($seg.length) $seg.append($view);
    // list mode: "찾아 바꾸기" sits inside the search field and opens its panel under it
    $root.on('click', '.na_rp_open', () => {
        const d = document.getElementById('na_replace');
        if (!d) return;
        d.open = !d.open;
        if (d.open) $('#na_rp_find').trigger('focus');
    });
    $root.on('click', '.na_hc_status', () => { const d = document.getElementById('na_hcheck'); if (d) d.open = !d.open; });
    const syncView = () => {
        const tl = $root.hasClass('na_tl');
        $view.find('button').each(function () { $(this).toggleClass('on', (this.dataset.v === 'tl') === tl); });
        $root.find('.na_search').attr('placeholder', tl ? '찾기' : '이름, 장소, 대사로 찾기');
        // the timeline has its own pencil button, so the "섹션 카드 / 원문 편집" tabs step aside
        $root.closest('.na_tab_pane').toggleClass('na_tl_on', tl);
    };
    syncView();
    const setLayout = tl => {
        $root.toggleClass('na_tl', tl).removeClass('na_tlb_open');
        const g = globalSettings(); g.archLayout = tl ? 'tl' : 'list'; saveGlobal();
        syncView();
        render();
    };
    $root.on('click', '.na_tlb_list', () => setLayout(false));
    $root.on('click', '.na_tlb_raw', () => showArchiveView('editor'));
    $root.on('click', '.na_tlb_more', function () { $root.toggleClass('na_tlb_open'); $(this).toggleClass('on', $root.hasClass('na_tlb_open')); });
    let filter = 'all';
    $root.on('click', '.na_br_filters button[data-f]', function () { filter = filter === this.dataset.f ? 'all' : this.dataset.f; render(); });
    const $list = $root.find('.na_list');
    const $search = $root.find('.na_search');
    const $info = $root.find('.na_search_info');
    // folded groups are kept per chat, so they stay folded after a reload
    const collapsedSet = () => new Set(Array.isArray(getMeta()?.collapsed) ? getMeta().collapsed : []);
    const setCollapsed = set => { const m = getMeta(); if (!m) return; m.collapsed = [...set]; saveMeta(); };
    const openCards = new Set();
    let pendingEdit = -1;
    let renderId = 0;

    const editSection = ($card, s) => {
        const m = getMeta();
        const original = m.text.slice(s.start, s.end);
        const $body = $card.find('.na_card_body').first().prop('hidden', false).empty();
        const $ta = $('<textarea class="text_pole na_sec_edit" spellcheck="false"></textarea>').val(trimEnd(original));
        const $btns = $(`<div class="na_card_actions">
            <span class="na_spacer"></span>
            <button type="button" class="na_btn na_small na_cancel">취소</button>
            <button type="button" class="na_btn na_small na_save na_primary"><i class="fa-solid fa-check"></i> 섹션 저장</button></div>`);
        $body.append($ta, $btns);
        $ta.trigger('focus');
        $ta.on('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); $btns.find('.na_save').trigger('click'); }
        });
        $btns.find('.na_cancel').on('click', () => render(true));
        $btns.find('.na_save').on('click', async () => {
            const cur = getMeta();
            if (cur.text.slice(s.start, s.end) !== original) {
                toastr.warning('아카이브가 그사이 바뀌어서 저장하지 않았어요. 다시 열어 주세요.');
                return;
            }
            const trail = original.match(/\s*$/)[0] || '\n\n';
            const edited = trimEnd($ta.val());
            const newTitle = (edited.match(/^#{1,2} (.*)$/m) || [])[1];
            const next = cur.text.slice(0, s.start) + edited + trail + cur.text.slice(s.end);
            // keep switches, pins and keyword links attached when the title is renamed
            const nk = newTitle && newTitle.trim() !== s.title ? keyAt(next, s.start) : null;
            if (nk) {
                renameKeys(cur, sectionKey(s), nk);
                if (openCards.has(sectionKey(s))) openCards.add(nk);
            }
            await commitText(next, `섹션 편집 전: ${s.title.slice(0, 40)}`);
            render(true);
            toastr.success('섹션 저장됨');
        });
    };

    let moving = false;
    const move = async (s0, dir) => {
        if (moving) return;
        const m = getMeta();
        // the card may be stale: look the section up again by key
        const s = parseSections(m.text).find(x => sectionKey(x) === sectionKey(s0));
        if (!s) return render();
        const r = moveSectionText(m.text, s, dir);
        if (!r) return toastr.info(dir < 0 ? '맨 위예요 (같은 묶음 안에서만 옮겨요)' : '맨 아래예요 (같은 묶음 안에서만 옮겨요)');
        moving = true;
        try { await commitText(r.text, `순서 이동 전: ${s.title.slice(0, 40)}`); } finally { moving = false; }
        render();
    };

    const remove = async s => {
        if (!await confirm('섹션 삭제', `<b>${esc(s.title)}</b><br>이 섹션을 지울까요? 지우기 전 상태는 도구 탭 복구 지점에 남아요.`)) return;
        const cur = getMeta();
        if (!parseSections(cur.text).some(x => x.start === s.start && x.end === s.end && sectionKey(x) === sectionKey(s))) {
            toastr.warning('아카이브가 그사이 바뀌어서 지우지 않았어요. 다시 해 주세요.');
            return render();
        }
        const key = sectionKey(s);
        cur.muted = (cur.muted || []).filter(k => k !== key);
        cur.pinned = (cur.pinned || []).filter(k => k !== key);
        const lm = { ...linkedMap(cur) };
        if (lm[key]) { delete lm[key]; cur.linked = lm; }
        openCards.delete(key);
        const before = cur.text.slice(0, s.start), after = cur.text.slice(s.end);
        await commitText(after.trim() ? before + after : trimEnd(before) + (before.trim() ? '\n' : ''), `섹션 삭제 전: ${s.title.slice(0, 40)}`);
        render();
        toastr.success('섹션을 지웠어요');
    };

    const insertAfter = async s => {
        const m = getMeta();
        const r = insertAfterText(m.text, s);
        await commitText(r.text, '새 섹션 추가 전');
        pendingEdit = r.start; // set after commit so only this final render opens the editor
        render();
    };

    const sw = (on, title) => `<button type="button" class="na_sw ${on ? 'on' : ''}" title="${title}" aria-pressed="${on}"><span></span></button>`;
    const pinBtn = (on, what) => `<button type="button" class="na_icon na_icon_sm na_pin ${on ? 'on' : ''}" title="${on ? '고정 풀기' : `${what} 망각 곡선에서도 늘 원문으로 고정`}">${svgA(ICO_A.pin, 16)}</button>`;

    // "→ #217–#236 · ← Y2 #424" chips under a card: sections it points at, and sections that point at it
    const refChips = (key, short = false) => {
        const lk = sectionLinks(getMeta());
        const chip = k => { const t = lk.byKey.get(k); if (!t) return ''; let r = (t.title.match(/^(?:\S{1,12}\s)?#\d+\s*[–—~-]\s*#?\d+/) || [t.title.slice(0, 24)])[0]; if (short) r = r.replace(/\s*[–—~-]\s*#?\d+$/, ''); return `<button type="button" class="na_ref_chip" data-start="${t.start}" title="${esc(t.title)}">${esc(r)}</button>`; };
        const o = (lk.out.get(key) || []).map(chip).join(''), i = (lk.in.get(key) || []).map(chip).join('');
        if (!o && !i) return '';
        return `<div class="na_card_refs">${o ? `<span class="na_ref_grp" title="이 섹션이 가리키는 섹션"><span class="na_ref_arr">→</span>${o}</span>` : ''}${i ? `<span class="na_ref_grp" title="이 섹션을 가리키는 섹션"><span class="na_ref_arr">←</span>${i}</span>` : ''}</div>`;
    };
    $list.on('click', '.na_ref_chip', function (e) { e.stopPropagation(); focus(Number(this.dataset.start)); });

    // force: from the editor's own save/cancel. Anything else (a reply arriving, keyword links, the router)
    // waits while a section editor is open, so unsaved typing isn't thrown away.
    function render(force = false) {
        const m = getMeta();
        if (!m) return;
        if (force !== true && $list.find('.na_sec_edit').length) return;
        const myId = ++renderId;
        // each group's card box scrolls on its own; keep where it was across re-renders
        const keepScroll = new Map();
        $list.find('.na_group').each((_, el) => keepScroll.set(el.dataset.key, el.querySelector(':scope > .na_group_items')?.scrollTop || 0));
        const q = $search.val().trim();
        const sections = parseSections(m.text);
        const muted = mutedSet(m);
        const pinned = pinnedSet(m);
        const links = linkedMap(m);
        const waiting = linkWaiting(m);
        const cardCount = sections.filter(x => !x.group).length;
        let shown = 0, hits = 0, editTarget = null;
        // filter chips: off / keyword / pinned / shortened, counted over cards
        const stateOf = s => {
            const k = sectionKey(s);
            return { off: muted.has(k), key: !!links[k]?.length, pin: pinned.has(k), fade: !!lastBuild.faded?.get(k) };
        };
        const cnt = { off: 0, key: 0, pin: 0, fade: 0 };
        for (const x of sections) if (!x.group) { const st = stateOf(x); for (const f in cnt) if (st[f]) cnt[f]++; }
        const fname = { off: '꺼짐', key: '키워드', pin: '고정', fade: '짧게 들어감' };
        const tl = $root.hasClass('na_tl');
        // list mode: off / keyword / pinned always show (even at 0); "짧게 들어감" only when there is any
        const showF = f => cnt[f] || filter === f || (!tl && f !== 'fade');
        // the heading check reads as one line: at the end of the chips (list), or in the ⋯ menu (timeline)
        let hc = '';
        {
            const { issues, ranged } = checkHeadings(m.text);
            if (issues.length) hc = `<button type="button" class="na_hc_status bad" title="제목 검사 열기">제목 문제 ${issues.length}곳</button>`;
            else if (ranged) hc = `<button type="button" class="na_hc_status ok" title="번호 제목 ${ranged}개 모두 형식·순서가 맞아요">${svgA(ICO_A.check, 14, 2.4)}제목 문제 없음</button>`;
        }
        $root.find('.na_tlb_hc').html(tl ? hc : '');
        if (tl) hc = '';
        $root.find('.na_br_filters').html(`<button type="button" data-f="all" class="${filter === 'all' ? 'on' : ''}">전체 ${cardCount}</button>${Object.keys(cnt).filter(showF).map(f => `<button type="button" data-f="${f}" class="${filter === f ? 'on' : ''}">${fname[f]} ${cnt[f]}</button>`).join('')}${hc ? `<span class="na_spacer"></span>${hc}` : ''}`);
        const allGroups = [];
        const allJobs = [];
        $list.empty();
        const groupStack = [];
        $root.toggleClass('na_darkui', darkUI());
        const hasOpen = sections.some(x => !x.group && /^OPEN\b/.test(x.title));
        sections.forEach((s, idx) => {
            // on the timeline, "# OPEN AT …" sits inside the STATE group ("STATE · OPEN")
            const joinState = tl && !s.group && /^OPEN\b/.test(s.title) && groupStack.length && /^STATE\b/.test(groupStack[0].title);
            while (!joinState && groupStack.length && groupStack[groupStack.length - 1].level >= s.level) groupStack.pop();
            while (joinState && groupStack.length > 1) groupStack.pop();
            const $parent = groupStack.length ? groupStack[groupStack.length - 1].$items : $list;
            const parentOff = groupStack.some(g => g.off);
            const off = muted.has(sectionKey(s));
            const body = m.text.slice(s.start, s.end);
            let count = 0;
            if (q) {
                count = (body.match(new RegExp(escRe(q), 'gi')) || []).length;
                hits += count;
            }
            if (s.group) {
                const key = sectionKey(s);
                const isOpen = q || !collapsedSet().has(key);
                const isState = /^STATE\b/.test(s.title);
                const gTitle = tl && isState ? (hasOpen ? 'STATE · OPEN' : 'STATE') : groupLabel(s.title);
                const $g = $(tl ? `
                  <div class="na_group na_lv${s.level} ${isOpen ? 'na_g_open' : ''} ${off ? 'na_off' : ''} ${parentOff ? 'na_off_parent' : ''}">
                    <div class="na_group_head">
                      <div class="na_head_main">
                        <span class="na_group_title">${highlight(gTitle, q)}</span>
                        <span class="na_group_meta"></span>
                      </div>
                      <i class="fa-solid fa-chevron-${isOpen ? 'down' : 'right'} na_group_chev"></i>
                    </div>
                    <div class="na_card_body" hidden></div>
                    <div class="na_group_items" ${isOpen ? '' : 'hidden'}></div>
                  </div>` : `
                  <div class="na_group na_lv${s.level} ${isOpen ? 'na_g_open' : ''} ${off ? 'na_off' : ''} ${parentOff ? 'na_off_parent' : ''}">
                    <div class="na_group_head">
                      <span class="na_group_chev">${svgA(isOpen ? ICO_A.down : ICO_A.right, 14, 2.4)}</span>
                      <div class="na_head_main">
                        <span class="na_group_title">${highlight(groupLabel(s.title), q)}</span>
                        <span class="na_group_meta"></span>
                      </div>
                      <div class="na_head_ctrl">
                        ${s.note ? `<button type="button" class="na_icon na_icon_sm na_group_edit" title="머리글 편집">${svgA(ICO_A.pen, 14)}</button>` : ''}
                        ${pinBtn(pinned.has(key), '이 묶음을')}
                        ${sw(!off, off ? '이 묶음 주입 켜기' : '이 묶음 통째로 주입에서 빼기')}
                      </div>
                    </div>
                    <div class="na_group_bar"><i></i></div>
                    ${s.note ? `<div class="na_group_note">${q ? highlight(s.note, q) : s.note.split('\n').map(mdInline).join('<br>')}</div>` : ''}
                    <div class="na_card_body" hidden></div>
                    <div class="na_group_items" ${isOpen ? '' : 'hidden'}></div>
                  </div>`);
                $g.find('> .na_group_head').on('click', () => {
                    if (q) return;
                    const set = collapsedSet();
                    set.has(key) ? set.delete(key) : set.add(key);
                    setCollapsed(set);
                    render();
                });
                $g.find('> .na_group_head .na_sw').on('click', e => { e.stopPropagation(); setMuted(key, !off); });
                $g.find('> .na_group_head .na_pin').on('click', e => { e.stopPropagation(); setPinned(key, !pinned.has(key)); });
                $g.find('> .na_group_head .na_group_edit').on('click', e => {
                    e.stopPropagation();
                    $g.find('> .na_group_note').prop('hidden', true);
                    editSection($g, s);
                });
                $g[0].dataset.key = key;
                $parent.append($g);
                const g = { level: s.level, title: s.title, state: isState, $items: $g.children('.na_group_items'), $el: $g, off: off || parentOff, tok: [] };
                groupStack.push(g);
                allGroups.push(g);
                return;
            }
            if (q && !count) return;
            if (filter !== 'all' && !stateOf(s)[filter]) return;
            shown++;
            const isOpen = !!q || openCards.has(sectionKey(s));
            const key = sectionKey(s);
            const rm = s.title.match(RANGE_HEAD);
            const rangeTxt = rm ? (s.title.match(/^(?:\S{1,12}\s)?#\d+\s*[–—~-]\s*#?\d+/) || [''])[0] : '';
            const rest = rm ? rm[5].replace(/^\s*[—–-]\s*/, '') : s.title;
            const paren = (rest.match(/\(([^()]*)\)\s*(?:\[[^\]]*\])?\s*$/) || [])[1] || '';
            const name = rest.replace(/\s*\([^()]*\)\s*(\[[^\]]*\])?\s*$/, '').replace(/\s*\[WI:[^\]]*\]\s*$/, '').trim() || rest;
            const fade = lastBuild.faded?.get(key);
            const isWait = waiting.has(key), isPin = pinned.has(key), hasKeys = !!links[key]?.length;
            const dot = off || parentOff ? 'off' : isPin ? 'pin' : hasKeys && isWait ? 'key' : fade || 'long';
            const tags = [
                fade && !off ? `<span class="na_tag fade" title="망각 곡선">${fade === 'line' ? '한 줄' : '짧게'}</span>` : '',
                hasKeys && !off ? `<span class="na_tag key" title="${isWait ? '키워드 대기' : '키워드 켜짐'}: ${esc(links[key].join(', '))}">키워드</span>` : '',
                isPin ? '<span class="na_tag pin">고정</span>' : '',
                count ? `<span class="na_tag hit">${count}건</span>` : '',
            ].join('');
            // list card: the section label ("PLOT:") on the first line is drawn as a small caption over the preview
            const lcLabel = tl ? '' : ((body.replace(/^#{1,2} [^\n]*\n?/, '').trim().split('\n')[0] || '').trim().match(/^([A-Z][A-Z /&'’-]{1,30}):$/) || [])[1] || '';
            const status = off || parentOff ? '꺼 둠' : isPin ? '고정' : hasKeys ? (isWait ? `키워드 대기 (${esc(links[key][0])})` : '키워드 켜짐') : fade === 'line' ? '한 줄' : fade === 'short' ? '짧게' : '원문';
            const $card = $(tl ? `
              <div class="na_card ${off ? 'na_off' : ''} ${parentOff ? 'na_off_parent' : ''} ${isWait && !off ? 'na_waiting' : ''}" data-start="${s.start}" ${rm ? `data-a="${Math.min(+rm[2], +rm[4])}" data-b="${Math.max(+rm[2], +rm[4])}" data-p="${esc(rm[1] || '')}"` : ''}>
                <div class="na_rail" aria-hidden="true">${rm ? `<span>#${rm[2]}</span><span>#${rm[4]}</span>` : ''}</div>
                <i class="na_dot st-${dot}" aria-hidden="true"></i>
                <div class="na_tlb_box">
                  <div class="na_card_head">
                    <div class="na_head_main">
                      <span class="na_card_title" title="${esc(s.title)}">${highlight(name, q)}</span>
                      <span class="na_tlb_meta"><span class="na_tok">${fmt(body.length)}자</span> · ${status}${count ? ` · ${count}건` : ''}</span>
                    </div>
                    ${sw(!off, off ? '주입 켜기' : '이 섹션만 주입에서 빼기 (본문은 그대로)')}
                  </div>
                  <div class="na_card_body" ${isOpen ? '' : 'hidden'}>
                    <div class="na_tlb_chips">
                      <span class="na_tlb_chip"><span class="na_tok">${fmt(body.length)}자</span></span>
                      ${fade && !off ? `<span class="na_tlb_chip fade">${fade === 'line' ? '한 줄로' : '짧게'} 들어감</span>` : ''}
                      ${hasKeys && !off ? `<span class="na_tlb_chip key" title="${esc(links[key].join(', '))}">${isWait ? '키워드 대기' : '키워드 켜짐'}</span>` : ''}
                      ${isPin ? '<span class="na_tlb_chip pin">고정</span>' : ''}
                      ${paren ? `<span class="na_tlb_chip">${esc(paren)}</span>` : ''}
                      ${refChips(key, true)}
                    </div>
                    <div class="na_card_text na_tlb_text" title="눌러서 전체 보기">${highlight(tlPreview(body), q) || '<span class="na_dim">(비어 있음)</span>'}</div>
                    <div class="na_card_text na_tlb_full" hidden>${highlight(body.replace(/^#{1,2} [^\n]*\n?/, '').trim(), q)}</div>
                    <div class="na_tlb_tools">
                      <button type="button" class="na_edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>편집</button>
                      <button type="button" class="na_keys ${hasKeys ? 'active' : ''}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7a4 4 0 1 1-3.9 5H3v4M7 12v3"/></svg>키워드</button>
                      ${RANGE_HEAD.test(s.title) ? `<button type="button" class="na_layers_btn ${layersOf(m)[key] ? 'active' : ''}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l9 5-9 5-9-5zM3 12l9 5 9-5"/></svg>버전</button>` : ''}
                      <button type="button" class="na_tlb_more2"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>더 보기</button>
                    </div>
                    <div class="na_card_actions na_tlb_extra" hidden>
                      <button type="button" class="na_icon na_up" title="위로" aria-label="위로"><i class="fa-solid fa-arrow-up"></i></button>
                      <button type="button" class="na_icon na_down" title="아래로" aria-label="아래로"><i class="fa-solid fa-arrow-down"></i></button>
                      <button type="button" class="na_icon na_ins" title="아래에 새 섹션" aria-label="아래에 새 섹션"><i class="fa-solid fa-plus"></i></button>
                      <button type="button" class="na_icon na_pin_t ${isPin ? 'active' : ''}" title="${isPin ? '고정 풀기' : '망각 곡선에서도 늘 원문으로 고정'}" aria-label="고정"><i class="fa-solid fa-thumbtack"></i></button>
                      <button type="button" class="na_icon na_del na_danger" title="섹션 삭제" aria-label="섹션 삭제"><i class="fa-solid fa-trash-can"></i></button>
                      <span class="na_spacer"></span>
                      ${srcButton(m, s.title, 'icon')}
                    </div>
                  </div>
                </div>
              </div>` : `
              <div class="na_card ${rm ? '' : 'na_norange'} ${off ? 'na_off' : ''} ${parentOff ? 'na_off_parent' : ''} ${isWait && !off ? 'na_waiting' : ''}" data-start="${s.start}">
                <div class="na_rail" aria-hidden="true">${rm ? `<span>${esc(rm[1] ? `${rm[1]} ` : '')}#${rm[2]}</span><span>#${rm[4]}</span>` : ''}</div>
                <i class="na_dot st-${dot}" aria-hidden="true"></i>
                <div class="na_card_head">
                  <div class="na_head_main">
                    ${rm ? `<span class="na_card_range">${rangeTxt ? `<span class="na_cr_range">${esc(rangeTxt)}</span>` : ''}${paren ? `<span class="na_cr_paren">${esc(paren)}</span>` : ''}<span class="na_cr_tok"> · <span class="na_tokm"></span></span></span>` : ''}
                    <span class="na_card_title" title="${esc(s.title)}">${highlight(name, q)}</span>
                    ${rm ? '' : `<span class="na_card_sub">${groupStack.length ? (paren ? `${esc(paren)} · ` : '') : '머리말 · '}<span class="na_tokm"></span></span>`}
                  </div>
                  <span class="na_card_tags">${tags}</span>
                  <span class="na_tok"></span>
                  ${sw(!off, off ? '주입 켜기' : '이 섹션만 주입에서 빼기 (본문은 그대로)')}
                </div>
                <div class="na_card_body" ${isOpen ? '' : 'hidden'}>
                  <div class="na_card_text na_lc_prev" title="눌러서 전체 보기" ${q ? 'hidden' : ''}>${lcLabel ? `<span class="na_lbl">${esc(lcLabel)}</span>` : ''}<span class="na_lc_txt">${tlPreview(body) ? highlight(tlPreview(body), q) : '<span class="na_dim">(비어 있음)</span>'}</span></div>
                  <div class="na_card_text na_lc_full" ${q ? '' : 'hidden'}>${highlight(body.replace(/^#{1,2} [^\n]*\n?/, '').trim(), q) || '<span class="na_dim">(비어 있음)</span>'}</div>
                  ${refChips(key)}
                  <div class="na_card_actions">
                    <button type="button" class="na_icon na_up" title="위로" aria-label="위로">${svgA(ICO_A.up, 17)}</button>
                    <button type="button" class="na_icon na_down" title="아래로" aria-label="아래로">${svgA(ICO_A.dn, 17)}</button>
                    <button type="button" class="na_icon na_ins" title="아래에 새 섹션" aria-label="아래에 새 섹션">${svgA(ICO_A.plus, 17)}</button>
                    <button type="button" class="na_icon na_keys ${hasKeys ? 'active' : ''}" title="키워드 연동" aria-label="키워드 연동">${svgA(ICO_A.key, 17)}</button>
                    ${RANGE_HEAD.test(s.title) ? `<button type="button" class="na_icon na_layers_btn ${layersOf(m)[key] ? 'active' : ''}" title="짧은 버전 · 한 줄 (망각 곡선)" aria-label="짧은 버전">${svgA(ICO_A.layers, 17)}</button>` : ''}
                    <button type="button" class="na_icon na_edit" title="편집" aria-label="편집">${svgA(ICO_A.pen, 17)}</button>
                    <button type="button" class="na_icon na_del na_danger" title="섹션 삭제" aria-label="섹션 삭제">${svgA(ICO_A.trash, 17)}</button>
                    <span class="na_spacer"></span>
                    <button type="button" class="na_icon na_pin_t ${isPin ? 'active' : ''}" title="${isPin ? '고정 풀기' : '망각 곡선에서도 늘 원문으로 고정'}" aria-label="고정">${svgA(ICO_A.pin, 17)}</button>
                    ${srcButton(m, s.title, 'icon')}
                  </div>
                </div>
              </div>`);
            $card.find('.na_card_head').on('click', () => {
                const $b = $card.find('.na_card_body').first();
                $card.toggleClass('open', !!$b.prop('hidden'));
                const willOpen = $b.prop('hidden');
                $b.prop('hidden', !willOpen);
                willOpen ? openCards.add(sectionKey(s)) : openCards.delete(sectionKey(s));
            });
            $card.find('.na_card_head .na_sw').on('click', e => { e.stopPropagation(); setMuted(sectionKey(s), !off); });
            $card.find('.na_pin_t').on('click', () => setPinned(key, !pinned.has(key)));
            if (isOpen) $card.addClass('open');
            $card.find('.na_edit').on('click', e => { e.stopPropagation(); editSection($card, s); });
            $card.find('.na_tlb_more2').on('click', function () { const $x = $card.find('.na_tlb_extra'); $x.prop('hidden', !$x.prop('hidden')); $(this).toggleClass('active', !$x.prop('hidden')); });
            $card.find('.na_lc_prev, .na_lc_full').on('click', () => { if (getSelection()?.toString()) return; const $p = $card.find('.na_lc_prev'), $f = $card.find('.na_lc_full'); const full = $f.prop('hidden'); $f.prop('hidden', !full); $p.prop('hidden', full); });
            $card.find('.na_tlb_text, .na_tlb_full').on('click', () => { const $p = $card.find('.na_tlb_text'), $f = $card.find('.na_tlb_full'); const full = $f.prop('hidden'); $f.prop('hidden', !full); $p.prop('hidden', full); });
            $card.find('.na_up').on('click', () => move(s, -1));
            $card.find('.na_down').on('click', () => move(s, 1));
            $card.find('.na_ins').on('click', () => insertAfter(s));
            $card.find('.na_keys').on('click', async () => {
                const keys = await openKeywords(s, body, links[sectionKey(s)] || []);
                if (keys) await setLinked(sectionKey(s), keys);
            });
            $card.find('.na_layers_btn').on('click', () => openLayers(s));
            $card.find('.na_del').on('click', () => remove(s));
            $parent.append($card);
            if (s.start === pendingEdit) editTarget = [$card, s];
            const job = cachedTokens(body).then(n => {
                if (myId !== renderId) return;
                $card.find('.na_tok').text(tl ? `${shortNum(n)} 토큰` : shortNum(n)).attr('title', tl ? `${fmt(body.length)}자` : `${fmt(n)} 토큰 · ${fmt(body.length)}자`);
                $card.find('.na_tokm').text(`${shortNum(n)} 토큰`);
                return n;
            });
            groupStack.forEach(g => g.tok.push(job));
            allJobs.push(job);
        });
        // group badges: card count, then card count · token sum
        allGroups.forEach(g => {
            const n = g.$el.find('.na_card').length;
            // timeline: "#0 – #590 · 섹션 24 · 9,340 토큰", STATE: "Y2 #604 기준 · 섹션 6 · …"
            let lead = '';
            if (tl) {
                const rs = g.$el.find('.na_card[data-a]').toArray();
                const sm = g.state && g.title.match(/((?:\S{1,12}\s)?#\d+)/);
                if (sm) lead = `${sm[1]} 기준 · `;
                else if (rs.length) lead = `#${Math.min(...rs.map(e => +e.dataset.a))} – #${Math.max(...rs.map(e => +e.dataset.b))} · `;
            }
            const unit = '';
            const $meta = g.$el.find('> .na_group_head .na_group_meta').text(`${lead}섹션 ${n}${unit}`);
            if ((q || filter !== 'all') && !n && !(q && g.$el.find('> .na_group_head mark, > .na_group_note mark').length)) { g.$el.remove(); return; }
            Promise.all(g.tok).then(ns => {
                const sum = ns.reduce((x, y) => x + (y || 0), 0);
                if (myId === renderId) $meta.text(`${lead}섹션 ${n}${unit} · ${tl && sum < 10000 ? fmt(sum) : shortNum(sum)} 토큰`);
                // list mode: a thin bar under the group head, its share of all tokens
                if (!tl) Promise.all(allJobs).then(all => {
                    const total = all.reduce((x, y) => x + (y || 0), 0);
                    if (myId !== renderId || !total) return;
                    const pct = Math.round(sum / total * 100);
                    g.$el.find('> .na_group_bar').attr('title', `전체 토큰의 ${pct}%`).children('i').css('width', `${pct}%`);
                });
            });
        });
        $info.html(q
            ? `"${esc(q)}" — 섹션 ${shown}개에서 ${hits}건`
            : filter !== 'all' ? `${fname[filter]} 섹션 ${shown}개` : '');
        if (!sections.length) $list.html('<div class="na_empty">아카이브가 비어 있어요.<br>원문 편집에 붙여넣거나 도구 탭에서 불러오세요.</div>');
        $list.find('.na_group').each((_, el) => {
            const box = el.querySelector(':scope > .na_group_items');
            if (box && keepScroll.has(el.dataset.key)) box.scrollTop = keepScroll.get(el.dataset.key);
        });
        if (editTarget) { pendingEdit = -1; editSection(...editTarget); editTarget[0][0].scrollIntoView({ block: 'center' }); }
    }

    function focus(start) {
        const s = parseSections(getMeta().text).find(x => x.start === start);
        if (!s) return;
        $search.val('');
        filter = 'all';
        openCards.add(sectionKey(s));
        // open the groups on the way so the card is visible; other folded groups stay folded
        const set = collapsedSet();
        const stack = [];
        for (const x of parseSections(getMeta().text)) {
            if (x.start > start) break;
            while (stack.length && stack[stack.length - 1].level >= x.level) stack.pop();
            if (x.group) stack.push(x);
        }
        if (stack.some(g => set.delete(sectionKey(g)))) setCollapsed(set);
        render();
        const el = $list.find(`.na_card[data-start="${start}"]`)[0];
        if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('na_flash'); setTimeout(() => el.classList.remove('na_flash'), 1400); }
    }

    let t;
    $search.on('input', () => { clearTimeout(t); t = setTimeout(render, 200); });
    render();
    return { render, focus };
}
