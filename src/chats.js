// Other chats: carrying the archive into a new chat, reading other chat files, bundle import.

import { PHONE_STORY_KEYS, phoneChatScope, choosePhoneStory, resetPhoneStory, adoptPhoneStory, clearPhoneSelection } from './phonestory.js';
import { MODULE, SETTING_KEYS, commitText, ctx, getMeta, hasChat, saveMeta } from './core.js';
import { applyInjection } from './inject.js';
import { setEditorDirty, syncPanel } from './panel.js';
import { headingRanges, parseSections, RANGE_HEAD } from './sections.js';
import { ICO_A, svgA } from './theme.js';
import { confirm, countTokens, esc, fmt } from './util.js';

export let lastSeen = null;   // the most recent chat that had an archive, kept in memory
export let carryOffer = null; // shown when we land in an empty chat right after one with an archive
export function setCarryOffer(v) { carryOffer = v; }

export const currentChatId = () => String(ctx().getCurrentChatId?.() || ctx().chatId || '');
export const pickSettings = m => Object.fromEntries(SETTING_KEYS.map(k => [k, structuredClone(m[k])]));

export function rememberArchive() {
    if (!hasChat()) return;
    const m = getMeta();
    if (m.text.trim()) lastSeen = { chatId: currentChatId(), text: m.text, settings: pickSettings(m) };
}

export async function importArchive(src, label, fromChat = null) {
    const m = getMeta();
    if (m.text.trim() && !await confirm('아카이브 가져오기', `이 채팅의 아카이브를 "${esc(label)}"의 것으로 바꿀까요? 지금 내용은 복구 지점에 남아요.`, '바꾸기')) return false;
    const scope=phoneChatScope(ctx());
    const hasSource=!!Object.keys(src.settings?.phones || {}).length || !!Object.keys(src.settings?.phoneProfiles || {}).length;
    const hasCurrent=!!Object.keys(m.phones || {}).length || !!Object.keys(m.phoneProfiles || {}).length || !!m.finance;
    const phoneChoice=hasSource || hasCurrent ? await choosePhoneStory({importing:true,hasSource}) : 'fresh';
    if(!phoneChoice || getMeta()!==m || phoneChatScope(ctx())!==scope) return false;
    for (const k of SETTING_KEYS) if (!PHONE_STORY_KEYS.includes(k) && src.settings && Object.hasOwn(src.settings,k)) m[k]=structuredClone(src.settings[k]);
    if(phoneChoice==='fresh') resetPhoneStory(m,scope);
    else {
        if(hasSource) {
            for(const k of PHONE_STORY_KEYS) {
                if(Object.hasOwn(src.settings,k)) m[k]=structuredClone(src.settings[k]);else delete m[k];
            }
        }
        adoptPhoneStory(m,scope);clearPhoneSelection(scope);
    }
    // the numbers that chat's archive ended on live in that chat: "원문" on those sections opens it
    if (fromChat) {
        const r = headingRanges(src.text);
        if (r.length) m.logLinks = { ...(m.logLinks || {}), [r[r.length - 1].prefix]: fromChat };
    }
    setEditorDirty(false);
    carryOffer = null;
    // a new chat restarts numbering, so the boundary is cleared and tracking turned off
    m.track = false;
    if (!await commitText(src.text, '가져오기 전', { boundary: -1 })) { await saveMeta(); applyInjection(); syncPanel(); }
    toastr.success(`가져옴: ${label}`);
    return true;
}

export async function fetchJson(url, body) {
    const c = ctx();
    const headers = c.getRequestHeaders ? c.getRequestHeaders() : { 'Content-Type': 'application/json' };
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return r.json();
}

// Other chats of the current character / group, newest first: [{ id, label, when, load() }]
export async function listOtherChats() {
    const c = ctx();
    const here = currentChatId();
    if (c.groupId) {
        const g = (c.groups || []).find(x => x.id === c.groupId);
        return (g?.chats || []).filter(id => id !== here).reverse().map(id => ({
            id, label: id, when: '',
            load: async () => (await fetchJson('/api/chats/group/get', { id }))?.[0]?.chat_metadata?.[MODULE],
        }));
    }
    const ch = c.characters?.[c.characterId];
    if (!ch) return [];
    const data = await fetchJson('/api/characters/chats', { avatar_url: ch.avatar });
    const arr = (Array.isArray(data) ? data : Object.values(data || {})).filter(x => x?.file_name);
    return arr
        .map(x => ({ id: String(x.file_name).replace(/\.jsonl$/, ''), when: x.last_mes || '', count: x.chat_items }))
        .filter(x => x.id !== here)
        .sort((a, b) => (Date.parse(b.when) || 0) - (Date.parse(a.when) || 0))
        .map(x => ({
            ...x, label: x.id,
            load: async () => (await fetchJson('/api/chats/get', { ch_name: ch.name, file_name: x.id, avatar_url: ch.avatar }))?.[0]?.chat_metadata?.[MODULE],
        }));
}

// the whole file of another chat of this character / group: { meta, messages }
export const otherChatCache = new Map();
export async function fetchOtherChat(id) {
    if (otherChatCache.has(id)) return otherChatCache.get(id);
    const c = ctx();
    let arr;
    if (c.groupId) arr = await fetchJson('/api/chats/group/get', { id });
    else {
        const ch = c.characters?.[c.characterId];
        if (!ch) throw new Error('캐릭터를 못 찾았어요');
        arr = await fetchJson('/api/chats/get', { ch_name: ch.name, file_name: id, avatar_url: ch.avatar });
    }
    arr = Array.isArray(arr) ? arr : [];
    const hasHeader = arr[0] && !('mes' in arr[0]);
    const out = { meta: hasHeader ? (arr[0].chat_metadata || {}) : {}, messages: hasHeader ? arr.slice(1) : arr };
    otherChatCache.set(id, out);
    return out;
}

// pick one of this character's other chats; resolves to its id or null
export async function pickOtherChat(title, desc) {
    const c = ctx();
    let chosen = null;
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div><h4>${esc(title)}</h4><p>${desc}</p></div></div>
        <input type="search" class="text_pole na_pc_q" placeholder="채팅 이름으로 찾기">
        <div class="na_pick_list"><div class="na_empty">불러오는 중…</div></div>
      </div>`);
    const popup = c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: false, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
    try {
        const chats = await listOtherChats();
        const render = () => {
            const q = $root.find('.na_pc_q').val().trim().toLowerCase();
            const list = chats.filter(x => !q || x.label.toLowerCase().includes(q));
            $root.find('.na_pick_list').html(list.length ? list.map(x => `
              <div class="na_pick">
                <div class="na_pick_main"><span class="na_pick_name">${esc(x.label)}</span><span class="na_pick_meta">${x.when ? esc(String(x.when)) : ''}${x.count ? ` · 메시지 ${fmt(x.count)}개` : ''}</span></div>
                <button type="button" class="na_btn na_small na_pc_go" data-id="${esc(x.id)}">고르기</button>
              </div>`).join('') : '<div class="na_empty">다른 채팅이 없어요.</div>');
        };
        render();
        $root.find('.na_pc_q').on('input', render);
        $root.on('click', '.na_pc_go', function () { chosen = String(this.dataset.id); $root.closest('dialog').find('.popup-button-ok').trigger('click'); });
    } catch (e) {
        $root.find('.na_pick_list').html('<div class="na_empty">채팅 목록을 못 불러왔어요.</div>');
    }
    await popup;
    return chosen;
}

export async function openChatPicker() {
    // (v3, docs/mockups/ext-chatpick B): the chats are checked as soon as the window opens; the ones with an archive come
    // first, one picked shows its numbers and its last section, and the bottom button brings that one in
    const c = ctx();
    const $root = $(`
      <div class="na_popup na_v2 na_cp3">
        <div class="na_v2_title"><b>다른 채팅에서 가져오기</b><small>같은 캐릭터의 다른 채팅 아카이브를 이 채팅으로 가져와요</small></div>
        <div class="na_cp3_sect na_cp3_hashead">아카이브가 있는 채팅 찾는 중…</div>
        <div class="na_v2_card na_cp3_list na_cp3_has" hidden></div>
        <div class="na_v2_card na_cp3_view" hidden></div>
        <button type="button" class="na_cp3_sect na_cp3_nohead" hidden></button>
        <div class="na_v2_card na_cp3_list na_cp3_no" hidden></div>
        <small class="na_cp3_note">가져오면 지금 아카이브는 복구 지점에 남고, 경계선은 비워져요</small>
      </div>`);
    // "Seraphina - 2023-5-12 @21h 32m 29s 224ms" → "Seraphina", and the time as a date
    const nice = id => String(id).replace(/\s*-\s*\d{4}-\d{1,2}-\d{1,2}\s*@\d+h\s*\d+m\s*\d+s\s*\d*ms\s*$/, '').trim() || String(id);
    const day = w => { const d = new Date(w); if (isNaN(d)) return ''; const now = new Date(), p = n => String(n).padStart(2, '0'); const same = d.toDateString() === now.toDateString(); return same ? `오늘 ${p(d.getHours())}:${p(d.getMinutes())}` : `${d.getMonth() + 1}월 ${d.getDate()}일`; };
    let found = [], none = [], picked = null, showNone = false, done = false;
    const draw = () => {
        $root.find('.na_cp3_hashead').text(done ? (found.length ? `아카이브가 있는 채팅 ${found.length}` : '아카이브가 있는 채팅이 없어요') : `아카이브가 있는 채팅 찾는 중… ${found.length ? found.length : ''}`);
        $root.find('.na_cp3_has').prop('hidden', !found.length).html(found.map((x, i) => `<button type="button" class="na_cp3_row${picked === i ? ' on' : ''}" data-i="${i}"><span class="na_cp3_av">${svgA(ICO_A.check, 14, 3)}</span><span class="na_cp3_tt"><b>${esc(nice(x.chat.label))}</b><small>${esc([day(x.chat.when), x.chat.count ? `메시지 ${fmt(x.chat.count)}개` : ''].filter(Boolean).join(' · '))}</small></span><span class="na_cp3_tok">${fmt(x.tok)} 토큰</span></button>`).join(''));
        const v = found[picked];
        $root.find('.na_cp3_view').prop('hidden', !v).html(v ? `<div class="na_cp3_vh"><b>${esc(nice(v.chat.label))}</b><small>${esc([day(v.chat.when), v.chat.count ? `메시지 ${fmt(v.chat.count)}개` : ''].filter(Boolean).join(' · '))}</small></div>
          <div class="na_cp3_stats"><div><b>${fmt(v.secs)}</b><small>섹션</small></div><div><b>${fmt(v.tok)}</b><small>토큰</small></div><div><b>${v.last !== null ? `#${v.last}` : '—'}</b><small>마지막 번호</small></div></div>
          ${v.lastText ? `<div class="na_cp3_prev">${esc(v.lastText)}</div>` : ''}` : '');
        $root.find('.na_cp3_nohead').prop('hidden', !none.length).html(`아카이브 없는 채팅 ${none.length} <small>${showNone ? '접기 ▴' : '펼치기 ▾'}</small>`);
        $root.find('.na_cp3_no').prop('hidden', !none.length || !showNone).html(none.map(x => `<div class="na_cp3_row off"><span class="na_cp3_av off">–</span><span class="na_cp3_tt"><b>${esc(nice(x.chat.label))}</b><small>${esc(x.why || [day(x.chat.when), x.chat.count ? `메시지 ${fmt(x.chat.count)}개` : ''].filter(Boolean).join(' · '))}</small></span></div>`).join(''));
        const $ok = $root.closest('dialog').find('.popup-button-ok');
        $ok.text(v ? `${nice(v.chat.label)} 가져오기` : '가져오기').prop('disabled', !v).toggleClass('disabled', !v);
    };
    $root.on('click', '.na_cp3_has .na_cp3_row', function () { picked = Number(this.dataset.i); draw(); });
    $root.on('click', '.na_cp3_nohead', () => { showNone = !showNone; draw(); });
    const popup = c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', { wide: true, large: false, allowVerticalScrolling: true, leftAlign: true, okButton: '가져오기', cancelButton: '닫기',
        onClosing: async p => {
            if (p.result !== c.POPUP_RESULT.AFFIRMATIVE) return true;
            const v = found[picked];
            if (!v) return false;
            return !!(await importArchive({ text: v.meta.text, settings: v.meta }, v.chat.label, v.chat.id));
        } });
    setTimeout(draw, 0);

    let chats = [];
    try { chats = await listOtherChats(); }
    catch (e) {
        console.warn('[narrative-archive] chat list', e);
        done = true;
        $root.find('.na_cp3_hashead').text('채팅 목록을 못 불러왔어요 · 이전 채팅에서 .json 백업 → 여기서 불러오기를 써 주세요');
        return popup;
    }
    // the ten most recent are read right away, the rest stay listed without a look
    for (const [i, chat] of chats.entries()) {
        if (i >= 10) { none.push({ chat, why: '열어 보지 않았어요 (최근 10개만 확인)' }); continue; }
        try {
            const meta = await chat.load();
            if (!meta?.text?.trim()) { none.push({ chat }); draw(); continue; }
            const secs = parseSections(meta.text).filter(x => !x.group);
            const rs = headingRanges(meta.text);
            const lastSec = secs.filter(x => RANGE_HEAD.test(x.title)).pop();
            found.push({ chat, meta, tok: await countTokens(meta.text), secs: secs.length,
                last: rs.length ? Math.max(...rs.map(r => Math.max(r.from, r.to))) : null,
                lastText: lastSec ? meta.text.slice(lastSec.start, lastSec.end).trim().split('\n').filter(l => !/^-{3,}\s*$/.test(l)).slice(0, 6).join('\n').trim() : '' });
            if (picked === null) picked = 0;
        } catch (e) { console.warn('[narrative-archive] chat load', e); none.push({ chat, why: '못 열었어요' }); }
        draw();
    }
    done = true;
    draw();
    return popup;
}

// pick one archive out of a "모두 백업" bundle file
export async function pickFromBundle(bundle) {
    const c = ctx();
    const list = (bundle.items || []).filter(x => typeof x?.data?.text === 'string');
    if (!list.length) { toastr.error('묶음 파일에 아카이브가 없어요.'); return null; }
    const $root = $(`<div class="na_popup"><div class="na_block_head"><div><h4>묶음에서 고르기</h4><p>이 채팅에 넣을 아카이브를 고르고 닫기를 누르세요.</p></div></div><div class="na_pick_list"></div></div>`);
    let chosen = null;
    list.forEach(it => {
        const $row = $(`<div class="na_pick"><div class="na_pick_main"><span class="na_pick_name">${esc(it.owner)} · ${esc(it.chat)}</span><span class="na_pick_meta">${fmt(it.data.text.length)}자</span></div>
            <div class="na_pick_state"><button type="button" class="na_btn na_small">이걸로</button></div></div>`);
        $row.find('button').on('click', () => {
            chosen = it;
            $root.find('.na_pick button').removeClass('na_primary').text('이걸로');
            $row.find('button').addClass('na_primary').text('✓ 골랐어요');
        });
        $root.find('.na_pick_list').append($row);
    });
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
    return chosen;
}

export function onChatChanged() {
    const phoneDialog=document.getElementById('na_phl');
    if(phoneDialog?.open) phoneDialog.close();
    setEditorDirty(false);
    setCarryOffer(hasChat() && lastSeen && lastSeen.chatId !== currentChatId() && !getMeta().text.trim() ? lastSeen : null);
    applyInjection();
    syncPanel();
}
