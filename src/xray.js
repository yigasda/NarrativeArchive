// Prompt X-ray: what the last prompt was made of.

import { gotoSection } from './ask.js';
import { currentChatId } from './chats.js';
import { PROMPT_KEY, ctx, getMeta } from './core.js';
import { applyHide } from './hide.js';
import { lastBuild } from './inject.js';
import { keywordStats, openKeywords, pct } from './keywords.js';
import { cachedTokens, linkWaiting, linkedMap, mutedSet, parseSections, sectionKey, setLinked } from './sections.js';
import { countTokens, esc, fmt, timeLabel } from './util.js';

// The last prompt actually sent (chat completion messages or the text-completion string), split into what we can recognize:
// this archive, other extensions' injections, world info entries, character card, persona, chat messages. Kept in memory only.
export let xrayArmed = false;
export let xrayWI = [];
export let xrayLast = null;

export const XRAY_CATS = {
    archive: { name: '서사 아카이브', color: 'var(--na-accent)' },
    chat: { name: '대화 기록', color: '#a99c92' },
    dup: { name: '압축됐는데 원문도 들어간 대화', color: '#d23b2c' },
    wi: { name: '월드인포', color: '#7b5bc4' },
    card: { name: '캐릭터 카드', color: '#3d6fb6' },
    ext: { name: '다른 확장', color: '#c99a1e' },
    other: { name: '그 외 (시스템 프롬프트 등)', color: '#d8ccc2' },
    persona: { name: '페르소나', color: '#2e9a7a' },
};

export function xrayArm(type, _opts, dryRun) {
    if (dryRun || type === 'quiet') return;
    xrayArmed = true; xrayWI = [];
}

export function xrayWorldInfo(entries) {
    if (!xrayArmed) return;
    const list = Array.isArray(entries) ? entries : Object.values(entries || {});
    for (const e of list) {
        const content = String(e?.content || '').trim();
        if (content) xrayWI.push({ label: String(e.comment || (Array.isArray(e.key) ? e.key.join(', ') : e.key) || '항목'), text: content });
    }
}

export function xrayCapture(data) {
    if (!xrayArmed || data?.dryRun) return;
    let messages;
    const flat = x => typeof x === 'string' ? x : Array.isArray(x) ? x.map(p => p?.text || '').join('\n') : '';
    if (Array.isArray(data?.chat)) messages = data.chat.map(x => ({ role: String(x?.role || ''), name: x?.name || '', content: flat(x?.content) }));
    else if (typeof data?.prompt === 'string') messages = [{ role: 'text', content: data.prompt }];
    else return;
    xrayArmed = false;
    const c = ctx();
    const m = getMeta();
    const sub = s => { try { return c.substituteParams ? c.substituteParams(String(s || '')) : String(s || ''); } catch { return String(s || ''); } };
    const ids = c.groupId ? (c.groups || []).find(g => g.id === c.groupId)?.members || [] : [];
    const chars = c.groupId ? (c.characters || []).filter(ch => ids.includes(ch.avatar)) : [c.characters?.[c.characterId]].filter(Boolean);
    const cards = [];
    for (const ch of chars) {
        for (const [f, label] of [['description', '설명'], ['personality', '성격'], ['scenario', '시나리오'], ['mes_example', '예시 대화']]) {
            const t = sub(ch[f] ?? ch.data?.[f]).trim();
            if (t) cards.push({ label: `${ch.name} ${label}`, text: t });
        }
        const sp = sub(ch.data?.system_prompt).trim(), ph = sub(ch.data?.post_history_instructions).trim();
        if (sp) cards.push({ label: `${ch.name} 카드 시스템 프롬프트`, text: sp });
        if (ph) cards.push({ label: `${ch.name} 카드 마지막 지시`, text: ph });
    }
    const ext = Object.entries(c.extensionPrompts || {}).filter(([k, v]) => k !== PROMPT_KEY && String(v?.value || '').trim()).map(([k, v]) => ({ label: k, text: String(v.value).trim() }));
    xrayLast = {
        at: Date.now(), chatId: currentChatId(), messages,
        archive: m?.enabled && lastBuild.text ? lastBuild.text.trim() : '',
        wi: xrayWI, ext, cards,
        persona: sub(c.powerUserSettings?.persona_description).trim(),
        chat: (c.chat || []).map((x, i) => ({ i, text: String(x?.mes || '').trim(), hidden: !!x?.is_system })),
        boundary: m?.boundary ?? -1, keep: Math.max(0, Number(m?.keep) || 0),
    };
    $('#na_tool_xray_sub').text(`마지막: ${timeLabel(xrayLast.at)} · 메시지 ${messages.length}개`);
}

export const xrayNorm = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// spans [{msg, a, b, cat, label}] for every recognized piece, then sentences that appear more than once
export function xrayAnalyze(x) {
    const spans = [];
    const free = (mi, a, b) => !spans.some(s => s.msg === mi && a < s.b && b > s.a);
    const place = (part, from = { msg: 0, pos: 0 }) => {
        const t = part.text;
        if (t.length < 12) return null;
        const head = t.length > 160 ? t.slice(0, 120) : t;
        for (let mi = from.msg; mi < x.messages.length; mi++) {
            const content = x.messages[mi].content;
            let p = content.indexOf(t, mi === from.msg ? from.pos : 0), len = t.length;
            if (p < 0 && head !== t) { p = content.indexOf(head, mi === from.msg ? from.pos : 0); len = Math.min(t.length, content.length - p); }
            if (p >= 0 && free(mi, p, p + len)) { const s = { msg: mi, a: p, b: p + len, cat: part.cat, label: part.label, i: part.i }; spans.push(s); return s; }
        }
        return null;
    };
    if (x.archive) place({ cat: 'archive', label: '서사 아카이브', text: x.archive });
    for (const p of x.ext) place({ cat: 'ext', label: `확장 · ${p.label}`, text: p.text });
    for (const p of x.wi) place({ cat: 'wi', label: `월드인포 · ${p.label}`, text: p.text });
    for (const p of x.cards) place({ cat: 'card', label: p.label, text: p.text });
    if (x.persona) place({ cat: 'persona', label: '페르소나', text: x.persona });
    // chat messages keep their order, so each search starts after the previous hit
    let cur = { msg: 0, pos: 0 };
    const dupEnd = x.boundary - x.keep;
    for (const ch of x.chat) {
        if (ch.hidden || !ch.text) continue;
        const s = place({ cat: x.boundary >= 0 && ch.i <= dupEnd ? 'dup' : 'chat', label: `대화 #${ch.i}`, text: ch.text, i: ch.i }, cur);
        if (s) cur = { msg: s.msg, pos: s.b };
    }
    spans.sort((p, q) => p.msg - q.msg || p.a - q.a);
    // sentences seen in two or more places
    const seen = new Map();
    x.messages.forEach((msg, mi) => {
        for (const mt of msg.content.matchAll(/[^\n.!?。]+[.!?。]?/g)) {
            const raw = mt[0].trim();
            const n = xrayNorm(raw);
            if (n.length < 30 || n.split(' ').length < 5) continue;
            const pos = mt.index;
            const sp = spans.find(s => s.msg === mi && pos >= s.a && pos < s.b);
            const where = sp ? sp.label : `메시지 ${mi + 1} (그 외)`;
            if (!seen.has(n)) seen.set(n, { text: raw, at: [] });
            seen.get(n).at.push({ where, cat: sp ? sp.cat : 'other', msg: mi });
        }
    });
    const groups = new Map();
    for (const d of seen.values()) {
        if (d.at.length < 2) continue;
        const places = [...new Set(d.at.map(a => a.where.replace(/^대화 #\d+$/, '대화 기록')))];
        if (places.length === 1 && places[0] === '대화 기록') continue; // the chat repeating itself is normal
        const key = places.sort().join(' ↔ ');
        if (!groups.has(key)) groups.set(key, { places, items: [], chars: 0 });
        const g = groups.get(key);
        g.items.push(d.text); g.chars += d.text.length * (d.at.length - 1);
    }
    return { spans, dups: [...groups.values()].sort((a, b) => b.chars - a.chars) };
}

// keyword-linked sections: how often each actually went in (measured per generation, or estimated from the chat), and what to look at
export async function keywordBlock(m) {
    const lm = linkedMap(m);
    const keys = Object.keys(lm).filter(k => Array.isArray(lm[k]) && lm[k].length);
    const secs = parseSections(m.text).filter(x => !x.group);
    const byKey = new Map(secs.map(x => [sectionKey(x), x]));
    const big = [];
    for (const x of secs) { const t = await cachedTokens(m.text.slice(x.start, x.end)); if (t > 2500) big.push({ x, t }); }
    if (!keys.length && !big.length) return '';
    const st = m.linkStats || { gens: 0, on: {} };
    const kstat = keywordStats(m);
    const waiting = linkWaiting(m), muted = mutedSet(m);
    const rows = [];
    for (const k of keys) {
        const x = byKey.get(k);
        if (!x || muted.has(k)) continue;
        const measured = st.gens >= 10;
        const rate = measured ? (st.on?.[k] || 0) / st.gens : kstat.fireRate(lm[k]);
        const flag = rate >= 0.6 ? '너무 자주 켜져요 — 키워드가 넓어요' : measured && st.gens >= 30 && rate === 0 ? '한 번도 안 켜졌어요 — 키워드를 봐 주세요' : '';
        rows.push({ x, k, rate, measured, flag, tok: await cachedTokens(m.text.slice(x.start, x.end)), now: !waiting.has(k) });
    }
    rows.sort((a, b) => (!!b.flag - !!a.flag) || b.rate - a.rate);
    const short = x => (x.title.match(/^(?:\S{1,12}\s)?#\d+\s*[–—~-]\s*#?\d+/) || [x.title.slice(0, 30)])[0];
    return `
      ${rows.length ? `<div class="na_v2_label">키워드 섹션 <small>${st.gens >= 10 ? `생성 ${fmt(st.gens)}번 기록` : '채팅으로 추정'}</small></div>
      <div class="na_v2_card na_v2_list na_xr_kw">${rows.map(r => `
        <button type="button" class="na_xr_kwrow ${r.flag ? 'flag' : ''}" data-start="${r.x.start}" data-k="${esc(r.k)}">
          <span class="na_xr_kwtxt"><span>${esc(short(r.x))}</span><small>${r.flag ? esc(r.flag) : `${fmt(r.tok)} 토큰 · 지금 ${r.now ? '켜짐' : '대기'}`}</small></span>
          <span class="na_xr_kwbar"><i style="width:${Math.max(2, Math.round(r.rate * 100))}%"></i></span>
          <b>${pct(r.rate)}</b>
        </button>`).join('')}</div>` : ''}
      ${big.length ? `<div class="na_v2_label">아주 큰 섹션 <small>다시 압축하거나 나누면 좋아요</small></div>
      <div class="na_v2_card na_v2_list">${big.sort((a, b) => b.t - a.t).map(b => `<button type="button" class="na_cal_item" data-start="${b.x.start}"><span class="na_cal_txt"><span>${esc(b.x.title)}</span><small>${fmt(b.t)} 토큰</small></span></button>`).join('')}</div>` : ''}`;
}

export async function openXray() {
    const c = ctx();
    const x = xrayLast && xrayLast.chatId === currentChatId() ? xrayLast : null;
    const $root = $(`
      <div class="na_popup na_v2 na_xray">
        <div class="na_v2_title"><b>프롬프트 X-ray</b><small>${x ? `마지막으로 보낸 프롬프트 · ${esc(timeLabel(x.at))}` : '마지막으로 보낸 프롬프트'}</small></div>
        <div class="na_xray_body">${x ? '<div class="na_empty">살펴보는 중…</div>' : '<div class="na_empty">아직 기록된 프롬프트가 없어요. 이 채팅에서 응답을 한 번 받으면 여기 보여요. (실리태번을 새로 고치면 기록이 지워져요)</div>'}</div>
      </div>`);
    const popup = c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
    const m = getMeta();
    $root.append('<div class="na_v2 na_xr_kwhost"></div>');
    keywordBlock(m).then(html => $root.find('.na_xr_kwhost').html(html));
    $root.on('click', '.na_xr_kwrow', async function () {
        const k = String($(this).data('k')), x0 = parseSections(m.text).find(y => sectionKey(y) === k);
        if (!x0) return;
        const ks = await openKeywords(x0, m.text.slice(x0.start, x0.end), linkedMap(m)[k] || []);
        if (ks) { await setLinked(k, ks); keywordBlock(m).then(html => $root.find('.na_xr_kwhost').html(html)); }
    });
    $root.on('click', '.na_xr_kwhost .na_cal_item', function () { const st = Number(this.dataset.start); $root.closest('dialog').find('.popup-button-ok').trigger('click'); gotoSection(st); });
    if (!x) return popup;
    const { spans, dups } = xrayAnalyze(x);
    // tokens per category: recognized spans, and the rest of each message as "other"
    const byCat = Object.fromEntries(Object.keys(XRAY_CATS).map(k => [k, []]));
    x.messages.forEach((msg, mi) => {
        let at = 0;
        for (const s of spans.filter(s => s.msg === mi)) { if (s.a > at) byCat.other.push(msg.content.slice(at, s.a)); byCat[s.cat].push(msg.content.slice(s.a, s.b)); at = s.b; }
        if (at < msg.content.length) byCat.other.push(msg.content.slice(at));
    });
    const tok = {};
    for (const [k, list] of Object.entries(byCat)) tok[k] = list.join('').trim() ? await countTokens(list.join('\n')) : 0;
    const total = Object.values(tok).reduce((a, b) => a + b, 0) || 1;
    const dupChats = spans.filter(s => s.cat === 'dup').map(s => s.i);
    const order = Object.keys(XRAY_CATS).filter(k => tok[k]).sort((a, b) => tok[b] - tok[a]);
    const pct = k => Math.max(1, Math.round(tok[k] / total * 100));
    $root.find('.na_xray_body').html(`
      <div class="na_v2_card na_xr_card">
        <div class="na_xr_total"><span><b>${fmt(total)}</b>토큰</span><small>메시지 ${x.messages.length}${x.wi.length ? ` · 월드인포 ${x.wi.length}` : ''}</small></div>
        <div class="na_xr_bar">${order.map(k => `<span style="flex:${tok[k]} 1 0;background:${XRAY_CATS[k].color}" title="${esc(XRAY_CATS[k].name)} ${fmt(tok[k])}"></span>`).join('')}</div>
        <div class="na_xr_rows">${order.map(k => `
          <div class="na_xr_row ${k === 'dup' ? 'bad' : ''}"><i style="background:${XRAY_CATS[k].color}"></i><span>${esc(XRAY_CATS[k].name)}</span><b>${fmt(tok[k])}</b><small>${pct(k)}%</small></div>`).join('')}
        </div>
      </div>
      ${dupChats.length ? `
      <div class="na_xr_warn na_xr_dupwarn">
        <svg class="na_xr_warnico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
        <div>
          <span class="na_xr_warntxt"><b>압축한 대화 ${dupChats.length}개가 원문으로도 들어갔어요</b><br><span>#${Math.min(...dupChats)}–#${Math.max(...dupChats)} · 약 ${fmt(tok.dup)} 토큰이 아카이브와 겹쳐요</span></span>
          <button type="button" class="na_v2_btn danger na_xray_hide"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10 10 0 0 1 12 20c-7 0-10-8-10-8a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.2M1 1l22 22"/></svg> 경계선까지 숨기기</button>
        </div>
      </div>` : ''}
      <div class="na_v2_label">겹치는 문장 <small>${dups.length ? `${dups.length}묶음 · ${fmt(dups.reduce((a, d) => a + d.chars, 0))}자` : '없음'}</small></div>
      ${dups.length ? dups.slice(0, 12).map(d => `
        <div class="na_v2_card na_xr_dup">
          <div class="na_xr_places">${d.places.map(p => `<span class="na_xr_place ${/^월드인포/.test(p) ? 'wi' : /^서사 아카이브/.test(p) ? 'arc' : ''}">${esc(p)}</span>`).join('<svg class="na_xr_sep" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h13l-4-4M17 17H4l4 4"/></svg>')}</div>
          ${d.items.slice(0, 2).map(t => `<q>${esc(t.length > 220 ? t.slice(0, 220) + '…' : t)}</q>`).join('')}
          ${d.items.length > 2 ? `<details class="na_v2_more"><summary>${d.items.length - 2}문장 더</summary>${d.items.slice(2, 12).map(t => `<q>${esc(t.length > 220 ? t.slice(0, 220) + '…' : t)}</q>`).join('')}</details>` : ''}
        </div>`).join('') : '<small class="na_v2_note">두 군데 이상 들어간 문장이 없어요.</small>'}`);
    $root.on('click', '.na_xray_hide', async function () { await applyHide(); $(this).prop('disabled', true).text('숨겼어요 · 다음 응답부터 빠져요'); });
    return popup;
}
