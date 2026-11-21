// 폰 2(실시간) 메신저의 말 고치기: 지우기 · 글 고치기 · 답장 넘기기(스와이프) · 한국어 다시 받기 (docs/PHONE2-PLAN.md "메신저의 말 고치기").
// 이 파일은 방의 말만 바꾸고, 요청 글과 답 읽기를 만들어요. 모델을 부르고 저장하는 건 부르는 쪽(답장을 돌리는 파일)이 해요.
//   지우기: 메신저에서만 지워요. 이미 캐릭터 폰에 반영된 것 · 롤플에 전한 것 · 줄여 둔 옛 대화(요약)는 그대로예요.
//           남은 말의 번호는 안 바뀌어요.
//   답장 넘기기(스와이프): 맨 끝 답장을 옆으로 넘겨 새로 받고, 받아 둔 답장들 사이를 오가요. 받아 둔 건 안 버려요.
//   한국어 다시 받기: 고른 말의 한국어만. 지시문은 폰 1의 번역 지시문 그대로(같은 칸 이름으로 보내요).
// 폰 1 · 아카이브는 읽지도 쓰지도 않아요. 폰 1은 이 파일을 부르지 않아요.

import { liveWorld, liveKey } from './phone2store.js';
import { liftReacts, putBack } from './phone2react.js';
import { koLike } from './phone2reply.js';

// lines · chars: 번역 요청 하나에 싣는 말의 수 · 글자 수; max: 한 번에 다시 번역하는 말의 수
export const EDIT = { lines: 60, chars: 9000, max: 240 };

const one = v => String(v ?? '').replace(/\s+/g, ' ').trim();
function roomOf(m, id) {
    const w = liveWorld(m), room = w?.messenger?.rooms?.[id];
    if (!w) throw new Error('아직 폰 2가 없어요');
    if (!room) throw new Error('없는 방이에요');
    return { w, room };
}
const idSet = ids => new Set((Array.isArray(ids) ? ids : [ids]).map(x => String(x ?? '')).filter(Boolean));

// 말 지우기 (ids: 말의 id 하나 또는 여럿) → 지운 수. 없는 id는 건너뛰어요
export function dropMessages(m, roomId, ids) {
    const { room } = roomOf(m, roomId), gone = idSet(ids), was = room.messages.length;
    if (!gone.size) return 0;
    room.messages = room.messages.filter(x => !gone.has(String(x.id)));
    // (the answers kept for a message of mine go with that message)
    for (const id of Object.keys(room.swipes || {})) if (gone.has(id)) delete room.swipes[id];
    if (room.swipes && !Object.keys(room.swipes).length) delete room.swipes;
    return was - room.messages.length;
}

// 말 고치기: 글을 바꿔요. 빈 글로는 못 바꿔요(지우기를 써요). 통화 · 말 없는 메시지는 못 고쳐요.
//   text: 새 원문. 원문이 바뀌면 그 말의 한국어는 지워요(안 맞게 되니까): ko를 같이 주면 그걸로 둬요
//   ko만 주면 한국어만 바꿔요 (''이면 지워요; 원문과 같으면 한국어 칸을 비워요)
// 번호 · 시간 · 반응 · 표시는 그대로예요. 고친 때를 x.edited에 적어요  → 바뀐 그 말, 바뀐 게 없으면 null
export function editMessage(m, roomId, msgId, { text, ko } = {}, at = Date.now()) {
    const { room } = roomOf(m, roomId), x = room.messages.find(y => String(y.id) === String(msgId));
    if (!x) throw new Error('없는 말이에요');
    if (x.act || x.call) throw new Error('고칠 수 없는 말이에요');
    const body = t => String(t ?? '').replace(/\r\n?/g, '\n').trim().slice(0, 4000);
    const next = text === undefined ? x.text : body(text);
    if (!one(next)) throw new Error('빈 글로는 바꿀 수 없어요. 지우기를 써 주세요');
    const said = next !== x.text, tr = ko === undefined ? (said ? '' : x.ko || '') : body(ko), kept = one(tr) && one(tr) !== one(next) ? tr : '';
    if (!said && kept === (x.ko || '')) return null;
    x.text = next;
    if (kept) x.ko = kept; else delete x.ko;
    x.edited = at;
    return x;
}

// 이 방의 답장이 오는 중인가 (기다리는 중이거나 받는 중)
export const replyComing = (m, roomId) => !!liveWorld(m)?.queue?.jobs?.some(j => j.kind === 'reply' && j.room === roomId && (j.state === 'waiting' || j.state === 'running'));
// 이 방에서 답장할 수 있는 사람들 (폰이 있는 캐릭터)
const answerers = (w, room) => room.members.filter(n => liveKey(n) !== liveKey(w.persona) && w.phones?.[liveKey(n)]);

// ---- 답장 넘기기 (스와이프). 답장 = 방의 맨 끝에서 내 마지막 말 뒤에 온 말들(말풍선 여러 개가 한 묶음).
// 옆으로 넘기면 새 답장을 받고, 받아 둔 답장들 사이를 오갈 수 있어요. **받아 둔 답장은 버리지 않아요**: 내가 다음 말을
// 보낸 뒤에도 그 답장 자리에 남아 있고(그 뒤의 말을 지워서 다시 맨 끝이 되면 또 넘길 수 있어요), 지우는 건 사람이
// 보이는 답장을 하나씩 지울 때뿐이에요.
//   room.swipes[내 말의 id] = { list: [답장, 답장, …], at }  — list[at]은 null: 지금 방에 보이는 답장이 그 자리예요
// 내 말이 하나도 없는 방(가져온 말뿐 · 캐릭터가 먼저 건 말)은 넘길 답장이 없어요.
export const SWIPE = { max: 50 };
const lastMine = (w, room) => { const P = liveKey(w.persona), ms = room.messages; let i = ms.length - 1; while (i >= 0 && liveKey(ms[i].from) !== P) i--; return i; };
const recOk = r => !!r && typeof r === 'object' && Array.isArray(r.list) && r.list.length > 0 && Number.isInteger(r.at) && r.at >= 0 && r.at < r.list.length && r.list.every((v, k) => (k === r.at ? v === null : Array.isArray(v) && v.length > 0));
// the room's end as the swipes see it: the persona's last message (the anchor), what came after it, and its record
function endOf(m, roomId) {
    const { w, room } = roomOf(m, roomId), i = lastMine(w, room), anchor = i < 0 ? null : room.messages[i];
    let rec = anchor ? room.swipes?.[anchor.id] : null;
    if (rec && !recOk(rec)) { delete room.swipes[anchor.id]; rec = null; }
    return { w, room, i, anchor, tail: i < 0 ? [] : room.messages.slice(i + 1), rec };
}
// 맨 끝 답장 (내 마지막 말 뒤에 온 말들). 없으면 []
export const replyTail = (m, roomId) => endOf(m, roomId).tail;
// 보이는 답장이 비었는데 오는 답장도 없으면(새 답장을 못 받았거나, 보이던 답장의 말을 다 지웠으면) 그 자리를 없애고
// 앞의 답장(없으면 다음 것)을 다시 보여요 → 바뀌었으면 true
export function settleSwipes(m, roomId) {
    const { room, anchor, tail, rec } = endOf(m, roomId);
    if (!rec || tail.length || replyComing(m, roomId)) return false;
    rec.list.splice(rec.at, 1);
    if (!rec.list.length) { delete room.swipes[anchor.id]; if (!Object.keys(room.swipes).length) delete room.swipes; return true; }
    const k = Math.max(0, rec.at - 1);
    room.messages.push(...rec.list[k]); putBack(room, rec.list[k]); rec.list[k] = null; rec.at = k;
    return true;
}
// 맨 끝 답장의 넘기기 상태: 넘길 답장이 없으면 null
//   → { at (지금 몇 번째, 1부터), count (받아 둔 수), coming (답장이 오는 중), prev · next (그쪽으로 넘길 수 있는지: next는 새로 받기도) }
export function swipeInfo(m, roomId) {
    const w = liveWorld(m), room = w?.messenger?.rooms?.[roomId];
    if (!room) return null;
    const { tail, rec } = endOf(m, roomId), coming = replyComing(m, roomId);
    if (!tail.length && !rec) return null;
    const at = rec ? rec.at : 0, count = rec ? rec.list.length : 1, can = !coming && tail.length > 0;
    return { at: at + 1, count, coming, prev: can && at > 0, next: can && (at < count - 1 || (answerers(w, room).length > 0 && count < SWIPE.max)) };
}
// 넘기기 (dir: -1 앞 · +1 뒤). 맨 뒤에서 한 번 더 넘기면 새 답장 자리를 만들어요(fresh: true — 부르는 쪽이 답장을 줄 세워요).
// 못 넘길 때는 이유를 말하고 아무것도 안 바꿔요  → { at, count, fresh }
export function swipeTo(m, roomId, dir) {
    if (replyComing(m, roomId)) throw new Error('답장이 오는 중이에요. 온 뒤에 넘겨 주세요');
    const { w, room, i, anchor, tail, rec: had } = endOf(m, roomId);
    if (!tail.length) throw new Error('넘길 답장이 없어요');
    const rec = had || { list: [null], at: 0 }, k = rec.at + (Number(dir) < 0 ? -1 : 1), fresh = k >= rec.list.length;
    if (k < 0) throw new Error('첫 번째 답장이에요');
    if (fresh && !answerers(w, room).length) throw new Error('이 방에는 답장할 폰이 없어요');
    if (fresh && rec.list.length >= SWIPE.max) throw new Error(`받아 둔 답장이 ${SWIPE.max}개예요. 몇 개 지운 뒤 다시 받아 주세요`);
    rec.list[rec.at] = tail;
    // (the reactions that answer put on the others' messages go out with it, and the ones of the answer shown come back)
    liftReacts(room, tail);
    room.messages.length = i + 1;
    if (fresh) rec.list.push(null); else { room.messages.push(...rec.list[k]); putBack(room, rec.list[k]); rec.list[k] = null; }
    rec.at = k;
    (room.swipes ||= {})[anchor.id] = rec;
    return { at: k + 1, count: rec.list.length, fresh };
}
// 받아 둔 답장 목록 (아무것도 안 바꿔요): 번호순으로 [{ no (1부터, swipeInfo의 at과 같은 번호), now (지금 방에 보이는 것),
// bubbles: [{ text, ko }] }]. 넘길 답장이 없으면 []. 글이 없는 말(폰으로 한 일만 · 통화)은 말풍선에 안 넣어요
export function swipeList(m, roomId) {
    if (!liveWorld(m)?.messenger?.rooms?.[roomId]) return [];
    const { tail, rec } = endOf(m, roomId);
    if (!tail.length && !rec) return [];
    const at = rec ? rec.at : 0;
    return (rec ? rec.list.map((v, k) => (k === at ? tail : v)) : [tail]).map((v, k) => ({ no: k + 1, now: k === at,
        bubbles: v.filter(x => !x.call && !x.act && one(x.text)).map(x => ({ text: String(x.text), ko: String(x.ko || '') })) }));
}
// 고른 답장들 지우기 (nos: 번호 하나 또는 여럿, 1부터). 보이는 답장을 지우면 남은 것 중 앞의 것(없으면 다음 것)이 보여요.
// 전부 지우면 답장이 없어져요. 없는 번호는 건너뛰어요  → { dropped (지운 답장 수), at, count (남은 수: 0이면 답장이 없어요) }
export function dropSwipes(m, roomId, nos) {
    if (replyComing(m, roomId)) throw new Error('답장이 오는 중이에요. 온 뒤에 지워 주세요');
    const { room, i, anchor, tail, rec } = endOf(m, roomId);
    if (!tail.length) throw new Error('지울 답장이 없어요');
    const list = rec ? rec.list : [null], at = rec ? rec.at : 0;
    const gone = new Set((Array.isArray(nos) ? nos : [nos]).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= list.length).map(n => n - 1));
    if (!gone.size) return { dropped: 0, at: at + 1, count: list.length };
    const keep = list.map((v, k) => k).filter(k => !gone.has(k));
    // (the one to show: the one shown now when it stays; else the nearest kept before it, else the first kept after)
    const show = gone.has(at) ? (keep.filter(k => k < at).pop() ?? keep[0]) : at;
    if (gone.has(at)) { liftReacts(room, tail); room.messages.length = i + 1; if (show !== undefined) { room.messages.push(...list[show]); putBack(room, list[show]); } }
    if (keep.length > 1) (room.swipes ||= {})[anchor.id] = { list: keep.map(k => (k === show ? null : list[k])), at: keep.indexOf(show) };
    else if (room.swipes) { delete room.swipes[anchor.id]; if (!Object.keys(room.swipes).length) delete room.swipes; }
    return { dropped: gone.size, at: keep.length ? keep.indexOf(show) + 1 : 0, count: keep.length };
}
// 보이는 답장 하나 지우기  → { dropped, at, count }
export const dropSwipe = (m, roomId) => dropSwipes(m, roomId, [(endOf(m, roomId).rec?.at ?? 0) + 1]);
// 지금 보이는 답장만 남기고 받아 둔 다른 답장을 모두 지워요  → { dropped, at, count }
export function dropOtherSwipes(m, roomId) {
    if (replyComing(m, roomId)) throw new Error('답장이 오는 중이에요. 온 뒤에 지워 주세요');
    const { tail, rec } = endOf(m, roomId);
    if (!tail.length) throw new Error('남길 답장이 없어요');
    return dropSwipes(m, roomId, (rec ? rec.list : [null]).map((v, k) => k + 1).filter(n => n !== (rec ? rec.at : 0) + 1));
}

// 한국어를 다시 받을 말: 고른 것 중 글이 있는 말(통화 · 폰으로 한 일만 있는 말은 빼요), 방에 있는 순서대로
//   → { owner (누구의 말투 표를 쓸지: 이 방의 폰 있는 캐릭터, 없으면 첫 캐릭터), rows: [{ x (그 말), who, to }], left (이번에 못 실은 수) }
export function koRows(m, roomId, ids) {
    const { w, room } = roomOf(m, roomId), want = idSet(ids), P = liveKey(w.persona);
    const others = room.members.filter(n => liveKey(n) !== P), owner = answerers(w, room)[0] || others[0] || '';
    const all = room.messages.filter(x => want.has(String(x.id)) && !x.call && !x.act && one(x.text));
    const rows = all.slice(0, EDIT.max).map(x => ({ x, who: one(x.from), to: room.members.filter(n => liveKey(n) !== liveKey(x.from)).map(one).join(', ') }));
    return { owner, rows, left: all.length - rows.length };
}
// 요청 하나에 실을 만큼씩 나눠요
export function koChunks(rows) {
    const out = [];
    for (let i = 0; i < rows.length;) {
        let j = i, size = 0;
        const len = r => String(r.x.text).length;
        while (j < rows.length && (j === i || (j - i < EDIT.lines && size + len(rows[j]) < EDIT.chars))) { size += len(rows[j]); j++; }
        out.push({ rows: rows.slice(i, j), size });
        i = j;
    }
    return out;
}
// 요청 글 (번역 지시문이 받는 칸 이름 그대로): owner 폰 주인; around: "[PEOPLE AROUND]…" 글 또는 '';
// voices: [{ who, style }]; gloss: [{ src, ko }]
export function koInput(rows, { owner = '', around = '', voices = [], gloss = [] } = {}) {
    return [
        `[OWNER]\n${one(owner) || 'me'}`,
        one(around) ? String(around).trim() : '',
        voices.length ? `[VOICES]\n${voices.map(v => `- ${one(v.who)}: ${one(v.style)}`).join('\n')}` : '',
        gloss.length ? `[GLOSSARY]\n${gloss.map(e => `- ${e.src} = ${e.ko}`).join('\n')}` : '',
        `[LINES]\n${rows.map((r, i) => `${i + 1}: [text · ${r.who} → ${r.to || 'self'}] ${JSON.stringify(String(r.x.text))}`).join('\n')}`,
    ].filter(Boolean).join('\n\n');
}
// 답을 그 말들에 넣어요 → 바뀐 수. got: { lines: [{ n, ko }] }. 답에 없는 줄은 그대로 둬요.
// 한국어가 원문과 같으면(이미 한국어인 말) 한국어 칸을 비워요. 원문에 없는 마침표 · 쉼표는 떼요
export function takeKo(rows, got) {
    let n = 0;
    const seen = new Set();
    for (const r of Array.isArray(got?.lines) ? got.lines : []) {
        const row = rows[Number(r?.n) - 1], ko = row ? koLike(row.x.text, String(r?.ko ?? '').trim()).slice(0, 4000) : '';
        if (!row || !ko || seen.has(row)) continue;
        seen.add(row);
        if (one(ko) === one(row.x.text)) delete row.x.ko; else row.x.ko = ko;
        n++;
    }
    return n;
}
