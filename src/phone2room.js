// 폰 2(실시간) 메신저의 말 · 방 다루기 (docs/PHONE2-PLAN.md "말 · 방 다루기").
// 말의 표시는 마리나라의 것을 그대로 써요 (src/marinara/message-marks.js · message-hidden.js). 말마다 x.extra에 둬요:
//   hiddenFromAI: true               AI에게 숨김: 답장 · 대화 요약 · 폰 반영 · 롤플에 전하기가 이 말을 안 읽어요 (화면에는 보여요)
//   hiddenFromAICharacterIds: [이름]  그 사람에게만 숨김 (이름은 liveKey로)
//   pinnedToContext: true            고정: 요약으로 넘어간 뒤에도 답장 요청의 MESSENGER에 들어가요 (방마다 MAX_PINNED_CONTEXT_MESSAGES개)
//   bookmark: { label, createdAt }   북마크
//   privateNote: 글                   혼자 보는 메모. AI에게는 안 가요
// 휴지통 (마리나라처럼 MESSAGE_TRASH_RETENTION_DAYS일 뒤에 비워요; 마리나라의 휴지통 코드는 그쪽 DB에 묶여 있어 우리 저장 모양으로 썼어요)
//   room.trash = [{ x: 지운 말, at: 지운 때, swipes?: 그 말에 받아 둔 답장 }] (방마다 ROOM.trash개까지)
//   w.messenger.trash = [{ room: 지운 방, at }] (ROOM.rooms개까지)
// 사람: 방에 넣고 빼기. 페르소나는 못 빼요. 같은 사람들의 방이 이미 있으면 안 해요 (방은 사람들로 찾으니까)
// 이 파일은 방의 것만 바꿔요. 저장은 부르는 쪽이 해요. 폰 1 · 아카이브는 읽지도 쓰지도 않아요. 폰 1은 이 파일을 부르지 않아요.

import { liveWorld, liveKey, ensureAccount } from './phone2store.js';
import { MAX_PINNED_CONTEXT_MESSAGES, MESSAGE_TRASH_RETENTION_DAYS, MESSAGE_MARK_EXTRA_KEYS, normalizeMessageMarkPatch, applyContextMessageLimitWithPins, isMessagePinnedToContext, readMessageBookmark, readMessagePrivateNote } from './marinara/message-marks.js';
import { isMessageHiddenFromAI, getMessageHiddenFromAICharacterIds, isMessageHiddenFromAIForCharacter } from './marinara/message-hidden.js';

export const ROOM = { trash: 100, rooms: 5, keep: MESSAGE_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000 };

const idSet = ids => new Set((Array.isArray(ids) ? ids : [ids]).map(x => String(x ?? '')).filter(Boolean));
function roomOf(m, id) {
    const w = liveWorld(m), room = w?.messenger?.rooms?.[id];
    if (!w) throw new Error('아직 폰 2가 없어요');
    if (!room) throw new Error('없는 방이에요');
    return { w, room };
}
const setKey = names => names.map(liveKey).sort().join('|');

// owner가 읽는 말인가 (모두에게 숨긴 말 · 그 사람에게 숨긴 말이 아니에요)
export const aiReads = (x, owner) => !!x && !isMessageHiddenFromAIForCharacter(x, liveKey(owner));
// 방의 누구에게도 숨기지 않은 말인가 (대화 요약 · 롤플에 전하기처럼 여럿이 같이 읽는 글에 들어가도 되는 말)
export const allRead = x => !!x && !isMessageHiddenFromAI(x) && !getMessageHiddenFromAICharacterIds(x).length;
// 답장 요청의 MESSENGER에 들어갈 말: owner에게 숨긴 말은 빼고, 요약으로 넘어가지 않은 끝의 max개 + 그 앞의 고정한 말
// (고정한 말의 글 앞에는 마리나라의 표시 줄이 붙어요)
export function askRows(room, max, owner) {
    const all = (room?.messages || []).filter(x => aiReads(x, owner)), upto = room?.digest?.upto ?? -1;
    const n = all.filter(x => !(x.n <= upto)).slice(-max).length;
    if (!n) return [];
    return applyContextMessageLimitWithPins(all.map(x => ({ x, content: x.text, extra: x.extra })), n).map(r => (r.content === r.x.text ? r.x : { ...r.x, text: r.content }));
}

// 말의 표시 바꾸기. patch: 마리나라의 표시 열쇠 가운데 준 것만
//   { hiddenFromAI: true|false, hiddenFromAICharacterIds: [이름] | null, pinnedToContext: true|false, bookmark: true | { label } | null, privateNote: 글 | null }
// → 바뀐 말의 수
const KEYS = ['hiddenFromAI', 'hiddenFromAICharacterIds', ...MESSAGE_MARK_EXTRA_KEYS.filter(k => k !== 'privateNoteRecipientId')];
export function markMessages(m, roomId, ids, patch = {}) {
    const { room } = roomOf(m, roomId), want = idSet(ids), given = {};
    for (const k of KEYS) if (Object.hasOwn(patch || {}, k)) given[k] = patch[k];
    if (Object.hasOwn(given, 'hiddenFromAI') && typeof given.hiddenFromAI !== 'boolean') throw new Error('hiddenFromAI는 true 또는 false예요');
    if (Object.hasOwn(given, 'hiddenFromAICharacterIds')) given.hiddenFromAICharacterIds = [...new Set((Array.isArray(given.hiddenFromAICharacterIds) ? given.hiddenFromAICharacterIds : []).map(liveKey).filter(Boolean))];
    const got = normalizeMessageMarkPatch(given);
    if (got.error) throw new Error(got.error);
    const hits = room.messages.filter(x => want.has(String(x.id)));
    if (got.patch.pinnedToContext === true) {
        const pinned = room.messages.filter(x => isMessagePinnedToContext(x.extra) || hits.includes(x)).length;
        if (pinned > MAX_PINNED_CONTEXT_MESSAGES) throw new Error(`고정은 방마다 ${MAX_PINNED_CONTEXT_MESSAGES}개까지예요`);
    }
    let n = 0;
    for (const x of hits) {
        const was = JSON.stringify(x.extra || {}), next = { ...(x.extra || {}) };
        for (const [k, v] of Object.entries(got.patch)) {
            // (a bookmark already there keeps the time it was made)
            if (k === 'bookmark' && v && next.bookmark && patch.bookmark === true) continue;
            if (v === null || v === false || (Array.isArray(v) && !v.length)) delete next[k]; else next[k] = v;
        }
        if (JSON.stringify(next) === was) continue;
        if (Object.keys(next).length) x.extra = next; else delete x.extra;
        n++;
    }
    return n;
}
// 북마크하거나 메모를 단 말 모아 보기 (roomId를 안 주면 모든 방) → [{ room, x, bookmark, note }] 말한 순서대로
export function markedMessages(m, roomId = '') {
    const w = liveWorld(m);
    if (!w) return [];
    const rooms = roomId ? [roomOf(m, roomId).room] : Object.values(w.messenger?.rooms || {});
    return rooms.flatMap(room => (room.messages || []).map(x => ({ room, x, bookmark: readMessageBookmark(x.extra), note: readMessagePrivateNote(x.extra) })).filter(t => t.bookmark || t.note))
        .sort((a, b) => (a.x.at || 0) - (b.x.at || 0) || (a.x.n || 0) - (b.x.n || 0));
}

// 지운 말을 휴지통에 (phone2edit.js dropMessages가 불러요). gone: 지운 말들; swipes: { 말 id: 받아 둔 답장 }
export function toTrash(room, gone, swipes = {}, at = Date.now()) {
    if (!gone.length) return;
    const list = Array.isArray(room.trash) ? room.trash : [];
    for (const x of gone) list.push({ x, at, ...(swipes[String(x.id)] ? { swipes: swipes[String(x.id)] } : {}) });
    room.trash = list.filter(t => at - (t.at || 0) < ROOM.keep).slice(-ROOM.trash);
}
// 휴지통 (나중에 지운 것이 앞) → [{ x, at }]
export const trashOf = (m, roomId, now = Date.now()) => [...(roomOf(m, roomId).room.trash || [])].filter(t => now - (t.at || 0) < ROOM.keep).reverse().map(t => ({ x: t.x, at: t.at, until: (t.at || 0) + ROOM.keep }));
// 되살리기: 제자리(번호 순서, 번호가 없으면 시간 순서)로 → 되살린 수
export function restoreMessages(m, roomId, ids) {
    const { room } = roomOf(m, roomId), want = idSet(ids), list = Array.isArray(room.trash) ? room.trash : [];
    const back = list.filter(t => want.has(String(t.x?.id)) && !room.messages.some(y => String(y.id) === String(t.x.id)));
    if (!back.length) return 0;
    const before = (a, b) => (Number.isInteger(a.n) && Number.isInteger(b.n) ? a.n < b.n : (a.at || 0) < (b.at || 0));
    for (const t of back) {
        const i = room.messages.findIndex(y => before(t.x, y));
        room.messages.splice(i < 0 ? room.messages.length : i, 0, t.x);
        if (t.swipes) (room.swipes ||= {})[String(t.x.id)] = t.swipes;
    }
    room.trash = list.filter(t => !back.includes(t));
    if (!room.trash.length) delete room.trash;
    return back.length;
}
// 휴지통 비우기 (ids를 안 주면 전부) → 버린 수
export function emptyTrash(m, roomId, ids = null) {
    const { room } = roomOf(m, roomId), list = Array.isArray(room.trash) ? room.trash : [], want = ids === null ? null : idSet(ids);
    const keep = want ? list.filter(t => !want.has(String(t.x?.id))) : [];
    if (keep.length) room.trash = keep; else delete room.trash;
    return list.length - keep.length;
}

// 방 지우기: 방을 휴지통으로. 그 방에 줄 서 있던 답장은 없어져요. 답장을 받는 중이면 못 지워요 → 지운 방
export function dropRoom(m, roomId, at = Date.now()) {
    const { w, room } = roomOf(m, roomId);
    if (w.queue?.jobs?.some(j => j.room === roomId && j.state === 'running')) throw new Error('답장을 받는 중이에요. 끝난 뒤에 지워 주세요');
    if (w.queue?.jobs) w.queue.jobs = w.queue.jobs.filter(j => !(j.room === roomId && j.state === 'waiting'));
    delete w.messenger.rooms[roomId];
    w.messenger.trash = [...(Array.isArray(w.messenger.trash) ? w.messenger.trash : []), { room, at }].filter(t => at - (t.at || 0) < ROOM.keep).slice(-ROOM.rooms);
    return room;
}
// 지운 방들 (나중에 지운 것이 앞) → [{ room, at }]
export const roomTrash = (m, now = Date.now()) => [...(liveWorld(m)?.messenger?.trash || [])].filter(t => now - (t.at || 0) < ROOM.keep).reverse();
// 방 되살리기. 그사이 같은 사람들의 방이 새로 생겼으면 못 해요 → 되살린 방
export function restoreRoom(m, roomId) {
    const w = liveWorld(m);
    if (!w) throw new Error('아직 폰 2가 없어요');
    const list = Array.isArray(w.messenger.trash) ? w.messenger.trash : [], t = list.find(y => y.room?.id === roomId);
    if (!t) throw new Error('휴지통에 없는 방이에요');
    if (w.messenger.rooms[roomId] || Object.values(w.messenger.rooms).some(r => setKey(r.members) === setKey(t.room.members))) throw new Error('같은 사람들의 방이 이미 있어요');
    w.messenger.rooms[roomId] = t.room;
    w.messenger.trash = list.filter(y => y !== t);
    if (!w.messenger.trash.length) delete w.messenger.trash;
    return t.room;
}
// 지운 방을 아주 버리기 (roomId를 안 주면 전부) → 버린 수
export function emptyRoomTrash(m, roomId = '') {
    const w = liveWorld(m), list = Array.isArray(w?.messenger?.trash) ? w.messenger.trash : [];
    const keep = roomId ? list.filter(y => y.room?.id !== roomId) : [];
    if (w?.messenger) { if (keep.length) w.messenger.trash = keep; else delete w.messenger.trash; }
    return list.length - keep.length;
}

// 방에 사람 넣기 → 방
export function addMember(m, roomId, name) {
    const { w, room } = roomOf(m, roomId), n = String(name || '').trim();
    if (!n) throw new Error('이름이 필요해요');
    if (room.members.some(x => liveKey(x) === liveKey(n))) return room;
    const next = [...room.members, n];
    if (Object.values(w.messenger.rooms).some(r => r !== room && setKey(r.members) === setKey(next))) throw new Error('같은 사람들의 방이 이미 있어요');
    ensureAccount(m, n);
    room.members = next;
    return room;
}
// 방에서 사람 빼기: 페르소나는 못 빼요. 둘만 남은 방에서는 못 빼요. 그 사람에게 줄 서 있던 답장은 없어져요 → 방
export function removeMember(m, roomId, name) {
    const { w, room } = roomOf(m, roomId), k = liveKey(name);
    if (!room.members.some(x => liveKey(x) === k)) return room;
    if (k === liveKey(w.persona)) throw new Error('나는 방에서 뺄 수 없어요');
    if (room.members.length <= 2) throw new Error('둘만 있는 방이에요. 방을 지워 주세요');
    if (w.queue?.jobs?.some(j => j.room === roomId && liveKey(j.owner) === k && j.state === 'running')) throw new Error('그 사람의 답장을 받는 중이에요. 끝난 뒤에 빼 주세요');
    const next = room.members.filter(x => liveKey(x) !== k);
    if (Object.values(w.messenger.rooms).some(r => r !== room && setKey(r.members) === setKey(next))) throw new Error('같은 사람들의 방이 이미 있어요');
    room.members = next;
    if (room.read) delete room.read[k];
    if (w.queue?.jobs) w.queue.jobs = w.queue.jobs.filter(j => !(j.room === roomId && liveKey(j.owner) === k && j.state === 'waiting'));
    return room;
}
