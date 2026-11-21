// 폰 2(실시간) 메신저의 이모지 반응 (docs/PHONE2-PLAN.md "이모지 반응").
// 방의 말마다 x.reacts = [{ by: 이름, e: 이모지, at: 시각, via?: [답장 말 id] }]. 한 사람은 한 말에 하나만 달아요.
//   이모지는 아무거나 돼요. 다만 이모지 한 덩어리만(피부색 · 합친 이모지 · 국기 포함): 글자나 여러 개는 버려요.
//   via: 캐릭터가 답장과 같이 단 반응이면 그 답장의 말 id들. 답장을 넘기면 그 답장이 단 반응도 같이 빠졌다 돌아와요
//   (phone2edit.js). 말 없이 반응만 했으면 via가 없어요: 넘기기 · 버리기 대상이 아니에요.
// 이 파일은 방의 말만 바꿔요. 저장은 부르는 쪽이 해요. 폰 1 · 아카이브는 읽지도 쓰지도 않아요. 폰 1은 이 파일을 부르지 않아요.

import { liveWorld, liveKey } from './phone2store.js';

// quick: 처음 바로 누르는 줄 (최근에 쓴 것이 없을 때); recent: 바로 누르는 줄의 수; kept: 기억해 두는 최근 것의 수
export const REACT = { quick: ['❤️', '😂', '😮', '😢', '😡', '👍'], recent: 6, kept: 24 };

const one = v => String(v ?? '').replace(/\s+/g, ' ').trim();
// one emoji: a keycap, a flag, or a pictograph with its skin tone / presentation mark, joined ones (ZWJ) and tag letters
const EMOJI = /^(?:[#*0-9]️?⃣|\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})*(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})*)*[\u{E0020}-\u{E007F}]*)$/u;
// 이모지 한 덩어리면 그 이모지, 아니면 '' (EMOJI는 처음부터 끝까지 한 덩어리만 맞아요: 두 개 · 글자가 붙으면 안 맞아요)
export function emojiOf(v) {
    const t = String(v ?? '').trim();
    return t && t.length <= 40 && EMOJI.test(t) ? t : '';
}

// 이 말에 who가 단 반응 (없으면 null)
export const reactOf = (x, who) => (Array.isArray(x?.reacts) ? x.reacts.find(r => liveKey(r?.by) === liveKey(who)) : null) || null;
// who의 반응을 e로 (''이면 지우기): 그 사람의 예전 반응은 바뀌어요. → 바뀌었으면 true
export function putReact(x, who, e, { at = Date.now(), via = null } = {}) {
    const k = liveKey(who), had = reactOf(x, who);
    const rest = (Array.isArray(x.reacts) ? x.reacts : []).filter(r => liveKey(r?.by) !== k);
    if (e) rest.push({ by: one(who), e, at, ...(Array.isArray(via) && via.length ? { via: [...via] } : {}) });
    if (rest.length) x.reacts = rest; else delete x.reacts;
    return (had?.e || '') !== (e || '');
}
// 답장 요청의 MESSENGER 줄 끝에 붙는 글: "Ren ❤️, Ivo 😂 (new)" ('' 없으면)
// fresh(r): a reaction to mark as new (put there since the owner last texted): "Ren 😡 (new)"
export const reactLine = (x, fresh = null) => (Array.isArray(x?.reacts) ? x.reacts : []).filter(r => one(r?.by) && emojiOf(r?.e)).map(r => `${one(r.by)} ${r.e}${fresh?.(r) ? ' (new)' : ''}`).join(', ');

// 바로 누르는 줄: 페르소나가 최근에 쓴 것부터, 모자라면 처음 줄로 채워서 REACT.recent개
export function quickReacts(w) {
    const mine = (Array.isArray(w?.messenger?.reactRecent) ? w.messenger.reactRecent : []).map(emojiOf).filter(Boolean);
    return [...new Set([...mine, ...REACT.quick])].slice(0, REACT.recent);
}
// 페르소나가 e를 썼어요: 최근 것 맨 앞으로
export function noteRecent(w, e) {
    if (!w?.messenger || !emojiOf(e)) return;
    const was = Array.isArray(w.messenger.reactRecent) ? w.messenger.reactRecent : [];
    w.messenger.reactRecent = [e, ...was.filter(x => x !== e)].slice(0, REACT.kept);
}

// 답장 하나를 방에서 뺄 때: 그 답장이 단 반응(via가 그 답장의 말)을 방의 다른 말에서 떼어 그 답장의 첫 말에 맡겨 둬요
// (x.reactsOut = [{ on: 말 id, by, e, at, via }]). 돌려 넣을 때는 putBack. tail: 빼는 답장의 말들
export function liftReacts(room, tail) {
    if (!tail?.length) return 0;
    const ids = new Set(tail.map(x => String(x.id))), keep = [];
    for (const x of room.messages) {
        if (ids.has(String(x.id)) || !Array.isArray(x.reacts)) continue;
        const mine = x.reacts.filter(r => Array.isArray(r?.via) && r.via.some(v => ids.has(String(v))));
        if (!mine.length) continue;
        x.reacts = x.reacts.filter(r => !mine.includes(r));
        if (!x.reacts.length) delete x.reacts;
        keep.push(...mine.map(r => ({ on: x.id, ...r })));
    }
    if (keep.length) tail[0].reactsOut = [...(Array.isArray(tail[0].reactsOut) ? tail[0].reactsOut : []), ...keep];
    return keep.length;
}
// 답장을 다시 보일 때: 맡겨 둔 반응을 그 말에 다시 달아요 (그 말이 없어졌으면 버려요; 그 사이 그 사람이 단 반응은 바뀌어요)
export function putBack(room, tail) {
    const held = Array.isArray(tail?.[0]?.reactsOut) ? tail[0].reactsOut : [];
    if (!tail?.length) return 0;
    delete tail[0].reactsOut;
    let n = 0;
    for (const { on, ...r } of held) {
        const x = room.messages.find(m => String(m.id) === String(on));
        if (x && emojiOf(r.e)) { putReact(x, r.by, r.e, { at: r.at, via: r.via }); n++; }
    }
    return n;
}

// 캐릭터의 반응 (답장의 "react": { "to": 누구의 말, "emoji": … } 또는 이모지 글 하나 = 페르소나의 말에):
// 그 사람이 방에서 마지막으로 한 말(글이 있는 말)에 달아요. 자기 말 · 방에 없는 사람 · 이모지가 아닌 것은 버려요
//   → { on (그 말), e } | null. messages: 답장을 넣기 전의 방의 말들
export function replyReact(raw, { owner, persona, members = [], messages = [] } = {}) {
    const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { emoji: raw };
    const e = emojiOf(o.emoji ?? o.e), to = one(o.to) || one(persona), k = liveKey(to);
    if (!e || !k || k === liveKey(owner) || !members.some(n => liveKey(n) === k)) return null;
    const on = [...messages].reverse().find(x => liveKey(x?.from) === k && !x.act && one(x.text));
    return on ? { on, e } : null;
}

// 방의 말 하나 (없는 방 · 없는 말이면 오류)
export function messageOf(m, roomId, msgId) {
    const w = liveWorld(m), room = w?.messenger?.rooms?.[roomId];
    if (!w) throw new Error('아직 폰 2가 없어요');
    if (!room) throw new Error('없는 방이에요');
    const x = room.messages.find(y => String(y.id) === String(msgId));
    if (!x) throw new Error('없는 말이에요');
    return { w, room, x };
}
