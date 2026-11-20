// 폰 2(실시간) 메신저의 말 고치기: 지우기 · 답장 다시 받기 · 한국어 다시 받기 (docs/PHONE2-PLAN.md "메신저의 말 고치기").
// 이 파일은 방의 말만 바꾸고, 요청 글과 답 읽기를 만들어요. 모델을 부르고 저장하는 건 부르는 쪽(답장을 돌리는 파일)이 해요.
//   지우기: 메신저에서만 지워요. 이미 캐릭터 폰에 반영된 것 · 롤플에 전한 것 · 줄여 둔 옛 대화(요약)는 그대로예요.
//           남은 말의 번호는 안 바뀌어요.
//   답장 다시 받기: 방의 맨 끝, 내 마지막 말 뒤에 온 말들을 지워요. 새 답장은 부르는 쪽이 줄을 세워요.
//   한국어 다시 받기: 고른 말의 한국어만. 지시문은 폰 1의 번역 지시문 그대로(같은 칸 이름으로 보내요).
// 폰 1 · 아카이브는 읽지도 쓰지도 않아요. 폰 1은 이 파일을 부르지 않아요.

import { liveWorld, liveKey } from './phone2store.js';

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
    return was - room.messages.length;
}

// 이 방의 답장이 오는 중인가 (기다리는 중이거나 받는 중)
export const replyComing = (m, roomId) => !!liveWorld(m)?.queue?.jobs?.some(j => j.kind === 'reply' && j.room === roomId && (j.state === 'waiting' || j.state === 'running'));
// 이 방에서 답장할 수 있는 사람들 (폰이 있는 캐릭터)
const answerers = (w, room) => room.members.filter(n => liveKey(n) !== liveKey(w.persona) && w.phones?.[liveKey(n)]);
// 다시 받을 답장: 방의 맨 끝에서, 내 마지막 말 뒤에 온 말들. 내 말이 하나도 없는 방 · 맨 끝이 내 말인 방은 없음([])
export function replyTail(m, roomId) {
    const { w, room } = roomOf(m, roomId), P = liveKey(w.persona), ms = room.messages;
    let i = ms.length;
    while (i > 0 && liveKey(ms[i - 1].from) !== P) i--;
    return i > 0 ? ms.slice(i) : [];
}
// 다시 받을 수 있는 말의 수 (0: 못 받아요 — 다시 받을 답장이 없거나, 답장이 오는 중이거나, 답장할 폰이 없어요)
export function redoCount(m, roomId) {
    const w = liveWorld(m), room = w?.messenger?.rooms?.[roomId];
    return !room || replyComing(m, roomId) || !answerers(w, room).length ? 0 : replyTail(m, roomId).length;
}
// 맨 끝 답장을 지워요 → 지운 수. 못 받는 때는 이유를 말하고 아무것도 안 바꿔요
export function dropReplyTail(m, roomId) {
    const { w, room } = roomOf(m, roomId);
    if (replyComing(m, roomId)) throw new Error('답장이 오는 중이에요. 온 뒤에 다시 받아 주세요');
    if (!answerers(w, room).length) throw new Error('이 방에는 답장할 폰이 없어요');
    const tail = replyTail(m, roomId);
    if (!tail.length) throw new Error('다시 받을 답장이 없어요');
    return dropMessages(m, roomId, tail.map(x => x.id));
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
// 한국어가 원문과 같으면(이미 한국어인 말) 한국어 칸을 비워요
export function takeKo(rows, got) {
    let n = 0;
    const seen = new Set();
    for (const r of Array.isArray(got?.lines) ? got.lines : []) {
        const row = rows[Number(r?.n) - 1], ko = String(r?.ko ?? '').trim().slice(0, 4000);
        if (!row || !ko || seen.has(row)) continue;
        seen.add(row);
        if (one(ko) === one(row.x.text)) delete row.x.ko; else row.x.ko = ko;
        n++;
    }
    return n;
}
