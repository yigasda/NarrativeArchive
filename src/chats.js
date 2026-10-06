// Other chats: carrying the archive into a new chat, reading other chat files, bundle import.

import { MODULE, SETTING_KEYS, commitText, ctx, getMeta, hasChat, saveMeta } from './core.js';
import { applyInjection } from './inject.js';
import { setEditorDirty, syncPanel } from './panel.js';
import { headingRanges } from './sections.js';
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
    if (m.text.trim() && !await confirm('아카이브 가져오기', `이 채팅의 아카이브를 "${esc(label)}"의 것으로 바꿀까요? 지금 내용은 복구 지점에 남아요.`)) return false;
    for (const k of SETTING_KEYS) if (src.settings && Object.hasOwn(src.settings, k)) m[k] = structuredClone(src.settings[k]);
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
    const popup = c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
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
    const c = ctx();
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div>
          <h4>다른 채팅에서 가져오기</h4>
          <p>같은 캐릭터(또는 그룹)의 다른 채팅이에요. <b>확인</b>을 누르면 그 채팅에 아카이브가 있는지 열어 봐요. 가져오면 경계선은 비워져요.</p>
        </div></div>
        <div class="na_row"><button type="button" class="na_btn na_small na_check_all"><i class="fa-solid fa-magnifying-glass"></i> 최근 10개 모두 확인</button></div>
        <div class="na_pick_list"><div class="na_empty">불러오는 중…</div></div>
      </div>`);
    const popup = c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });

    let chats = [];
    try { chats = await listOtherChats(); }
    catch (e) {
        console.warn('[narrative-archive] chat list', e);
        $root.find('.na_pick_list').html('<div class="na_empty">채팅 목록을 못 불러왔어요. 이전 채팅에서 .json 백업 → 여기서 불러오기를 써 주세요.</div>');
        return popup;
    }
    const $list = $root.find('.na_pick_list').empty();
    if (!chats.length) $list.html('<div class="na_empty">다른 채팅이 없어요.</div>');
    const checkers = chats.map(chat => {
        const $row = $(`
          <div class="na_pick">
            <div class="na_pick_main">
              <span class="na_pick_name">${esc(chat.label)}</span>
              <span class="na_pick_meta">${chat.when ? esc(String(chat.when)) : ''}${chat.count ? ` · 메시지 ${fmt(chat.count)}개` : ''}</span>
            </div>
            <div class="na_pick_state"><button type="button" class="na_btn na_small na_pick_check">확인</button></div>
          </div>`);
        const check = async () => {
            const $st = $row.find('.na_pick_state').html('<span class="na_dim">여는 중…</span>');
            try {
                const meta = await chat.load();
                if (!meta?.text?.trim()) { $st.html('<span class="na_dim">아카이브 없음</span>'); return; }
                const tok = await countTokens(meta.text);
                $st.html(`<span class="na_chip">${fmt(tok)} 토큰</span><button type="button" class="na_btn na_small na_primary na_pick_go">가져오기</button>`);
                $st.find('.na_pick_go').on('click', async () => {
                    if (await importArchive({ text: meta.text, settings: meta }, chat.label, chat.id)) $st.html('<span class="na_chip na_chip_on">가져옴</span>');
                });
            } catch (e) {
                console.warn('[narrative-archive] chat load', e);
                $st.html('<span class="na_warn_txt">못 열었어요</span>');
            }
        };
        $row.find('.na_pick_check').on('click', check);
        $list.append($row);
        return check;
    });
    $root.find('.na_check_all').on('click', async () => {
        for (const check of checkers.slice(0, 10)) await check();
    });
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
    setEditorDirty(false);
    setCarryOffer(hasChat() && lastSeen && lastSeen.chatId !== currentChatId() && !getMeta().text.trim() ? lastSeen : null);
    applyInjection();
    syncPanel();
}
