// 메신저 모양으로 쓴 채팅을 실시간 폰의 메신저로 통째로 가져오기 (docs/PHONE2-PLAN.md "채팅을 메신저로 가져오기").
// 채팅 메시지 하나가 말풍선 여러 개예요: 빈 줄마다 하나. 맨 위의 시간 칸(<div class="chat-timestamp">11.20, 16:28</div>)이
// 그 메시지의 시간이고, **그 칸이 있는 캐릭터 메시지만 메신저 메시지**예요: 보통 장면(지문 · 대사)은 안 가져와요.
// 내 메시지에는 시간 칸이 없어서, 바로 뒤 답장이 메신저 메시지일 때만 같이 가져와요. 말마다 "보낸 순간"(전 세계 공통의 한 순간)을 저장해서, 폰마다 자기 시계로 보여 줘요.
//   importRows: 채팅 → 가져올 말 (아무것도 안 바꿔요)
//   importInto: 가져올 말 → 실시간 폰의 방 (이미 읽은 것 · 롤플에 이미 전한 것으로 표시)
// 이 파일은 폰 2 저장 자리만 불러요. 채팅은 부르는 쪽이 건네줘요. 폰 1 · 아카이브는 읽지도 쓰지도 않아요.

import { liveWorld, liveKey, ensureRoom, liveNo } from './phone2store.js';

// 글의 시간이 보낸 순간과 이만큼 안에서 다르면 같은 순간으로 봐요 (모델이 쓰기 시작한 때와 다 쓴 때의 차이)
export const IMPORT = { near: 10 * 60_000, chars: 4000 };

const TIME_DIV = /<div\b[^>]*\bclass="[^"]*\bchat-timestamp\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
// a message's words without its markup (a <br> is a line break)
const plain = h => String(h ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39|#x27);/gi, (all, k) => ENT[k.toLowerCase()] ?? "'").replace(/\r\n?/g, '\n');
const flat = t => String(t ?? '').replace(/\s+/g, ' ').trim();
// one bubble a blank line; a line break inside one is a space
const bubbles = t => plain(t).split(/\n[ \t]*\n+/).map(flat).filter(Boolean);

// "11.20, 16:28" → { mo, d, h, mi }; order: 'md' (11.20 = Nov 20) or 'dm', used only when both readings are dates
export function stampOf(text, order = 'md') {
    const m = /(\d{1,2})\s*[./-]\s*(\d{1,2})\D{1,6}?(\d{1,2}):(\d{2})/.exec(plain(text));
    if (!m) return null;
    const a = Number(m[1]), b = Number(m[2]), h = Number(m[3]), mi = Number(m[4]);
    const [mo, d] = b > 12 ? [a, b] : a > 12 ? [b, a] : order === 'dm' ? [b, a] : [a, b];
    return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && h <= 23 && mi <= 59 ? { mo, d, h, mi } : null;
}
// the moment a message was sent, as the chat recorded it (ms): an ISO time, the older "2026-11-20@16h28m07s", a date in
// words; null when there is none to read
export function sentAt(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v ?? '').trim();
    if (!s) return null;
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})\s*@\s*(\d{1,2})h\s*(\d{1,2})m\s*(\d{1,2})s(?:\s*(\d{1,3})ms)?$/.exec(s);
    if (m) return new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6], +(m[7] || 0)).getTime();
    const t = Date.parse(s.replace(/(\d)\s*(am|pm)$/i, '$1 $2'));
    return Number.isFinite(t) ? t : null;
}
// the clock the written times are on: this browser's (the chat's times were written for the one reading them)
export const LOCAL = {
    wall: ms => { const d = new Date(ms); return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds() }; },
    at: (y, mo, d, h, mi, s = 0) => new Date(y, mo - 1, d, h, mi, s).getTime(),
};
// the moment a written time means, beside the moment `near` (when the message was sent, or the one before it): that date
// and time in the year nearest to it — a "01.01" written on Dec 31 is the next year's. Within IMPORT.near of the sent
// moment it is that moment itself (to the second)
function momentOf(st, near, clock, exact) {
    const w = clock.wall(near);
    let best = null;
    for (const y of [w.y - 1, w.y, w.y + 1]) { const t = clock.at(y, st.mo, st.d, st.h, st.mi, 0); if (Number.isFinite(t) && (best === null || Math.abs(t - near) < Math.abs(best - near))) best = t; }
    if (best === null) return near;
    return exact && Math.abs(best - near) <= IMPORT.near ? near : best + w.s * 1000;
}
// the Korean a translation add-on kept beside each bubble (extra.display_text: a pair of spans a paragraph), when it is
// there for every bubble and its original words are the bubble's; else none
function koOf(display, texts) {
    const pairs = [];
    for (const para of String(display ?? '').split(/\n[ \t]*\n+/)) {
        const m = /<span\b[^>]*\bclass="[^"]*\btranslated_text\b[^"]*"[^>]*>([\s\S]*)<\/span>\s*<br\s*\/?>\s*<span\b[^>]*\bclass="[^"]*\boriginal_text\b[^"]*"[^>]*>([\s\S]*)<\/span>\s*$/i.exec(para.trim());
        if (!m) continue;
        const orig = flat(plain(m[2].replace(TIME_DIV, '')));
        if (orig) pairs.push({ ko: flat(plain(m[1].replace(TIME_DIV, ''))), orig });
    }
    return pairs.length === texts.length && pairs.every((p, i) => p.orig === texts[i]) ? pairs.map((p, i) => (p.ko && p.ko !== texts[i] ? p.ko : '')) : texts.map(() => '');
}

// 채팅에서 가져올 말. chat: 실리태번 채팅(메시지 목록); after: 이 번호 뒤의 메시지만; order: 날짜 순서('md' · 'dm');
// clock: 글의 시간이 적힌 시계 (기본: 이 브라우저의 시계); shift: 글의 시간이 하나도 없는 묶음을 옮길 만큼 (같은 채팅을
// 전에 가져올 때 옮긴 만큼: 그때와 같은 시계에 놓여요)
//   → [{ i (채팅의 번호), user, name, at (보낸 순간 ms), off (기록된 순간에서 옮긴 만큼 | null), bubbles: [{ text, ko }] }]
//     채팅 순서대로, 시간은 뒤로 가지 않아요.
// 숨긴 메시지 · 해설(시스템) 메시지 · 말이 없는 메시지는 안 가져와요. 메신저 메시지만 가져와요:
//   캐릭터 메시지는 시간 칸이 있는 것, 내 메시지는 바로 뒤 답장(없으면 바로 앞 캐릭터 메시지)이 메신저 메시지인 것.
//   gate false: 가리지 않고 전부 (채팅에 메시지가 있기는 한지 볼 때만 써요)
export function importRows(chat, { after = -1, order = 'md', clock = LOCAL, shift: shift0 = 0, gate = true } = {}) {
    let rows = [];
    (Array.isArray(chat) ? chat : []).forEach((x, i) => {
        if (!x || x.is_system || x.extra?.type === 'narrator') return;
        const mes = String(x.mes ?? ''), boxes = [...mes.matchAll(TIME_DIV)], stamps = boxes.map(m => stampOf(m[1], order)).filter(Boolean);
        const texts = bubbles(mes.replace(TIME_DIV, ''));
        if (!texts.length) return;
        const ko = x.is_user ? texts.map(() => '') : koOf(x.extra?.display_text, texts);
        rows.push({ i, user: !!x.is_user, name: flat(x.name), sent: sentAt(x.send_date), stamp: stamps[0] || null, timed: boxes.length > 0, bubbles: texts.map((t, k) => ({ text: t.slice(0, IMPORT.chars), ko: ko[k].slice(0, IMPORT.chars) })) });
    });
    // which of them are the messenger's: a character's message with the time box; the persona's by the answer after it
    // (the first character message that follows), or with none after it, by the character message before
    if (gate) {
        const mine = rows.map((r, k) => {
            if (!r.user) return r.timed;
            const next = rows.slice(k + 1).find(q => !q.user), prev = rows.slice(0, k).reverse().find(q => !q.user);
            return next ? next.timed : !!prev?.timed;
        });
        rows = rows.filter((r, k) => mine[k]);
    }
    rows = rows.filter(r => r.i > after);
    // each message's moment: its written time beside the moment it was sent; one with no written time goes by the
    // message after it (its answer), else the one before; one with no record of when it was sent, right after the last
    const shift = rows.map(r => (r.stamp && r.sent !== null ? momentOf(r.stamp, r.sent, clock, true) - r.sent : null));
    let last = null;
    rows.forEach((r, k) => {
        let at;
        if (r.sent !== null) {
            let off = shift[k];
            for (let j = k + 1; off === null && j < rows.length; j++) if (shift[j] !== null) off = shift[j];
            for (let j = k - 1; off === null && j >= 0; j--) if (shift[j] !== null) off = shift[j];
            r.off = off ?? (Number(shift0) || 0);
            at = r.sent + r.off;
        } else at = r.stamp && last !== null ? momentOf(r.stamp, last, clock, false) : last !== null ? last + 1000 : 0;
        r.at = last === null ? at : Math.max(at, last + 1);
        last = r.at + r.bubbles.length - 1;
    });
    return rows.map(({ i, user, name, at, off = null, bubbles: b }) => ({ i, user, name, at, off, bubbles: b }));
}

// 가져올 말을 실시간 폰의 방에 넣어요. 방은 그 채팅에서 말한 캐릭터들과 페르소나의 방 하나예요(없으면 만들어요).
// 넣는 말은: 채팅 순서대로, 원래 시간으로, 이미 롤플에 전한 것(told)으로. 있던 폰들은 그 말을 이미 읽은 것으로 표시하고,
// 나중에 만드는 폰은 그 말 뒤부터 읽어요(importTop). info: { chat (어느 채팅인지) }
//   → { room, count (말풍선 수), messages (채팅 메시지 수), from, to (채팅의 번호) }
export function importInto(m, rows, { now = Date.now(), chat = '' } = {}) {
    const w = liveWorld(m);
    if (!w) throw new Error('아직 폰 2가 없어요');
    const list = (Array.isArray(rows) ? rows : []).filter(r => r?.bubbles?.length);
    if (!list.length) throw new Error('가져올 메시지가 없어요');
    const P = liveKey(w.persona), names = [...new Map(list.filter(r => !r.user && r.name && liveKey(r.name) !== P).map(r => [liveKey(r.name), r.name])).values()];
    // (the room this chat was brought into before, when everyone speaking now is in it: a batch of the persona's own
    // words alone still has its room)
    const before = w.imported && String(w.imported.chat || '') === String(chat || '') ? w.messenger?.rooms?.[w.imported.room] : null;
    const fits = !!before && names.every(n => before.members.some(x => liveKey(x) === liveKey(n)));
    if (!names.length && !fits) throw new Error('캐릭터가 한 말이 없어서 방을 만들 수 없어요');
    const room = fits ? before : ensureRoom(m, names), msgs = room.messages;
    let first = null, top = null, count = 0;
    for (const r of list) r.bubbles.forEach((b, k) => {
        const n = liveNo(w), at = r.at + k;
        const msg = { id: `i${now.toString(36)}${n.toString(36)}${Math.random().toString(36).slice(2, 6)}`, n, from: r.user ? w.persona : r.name, text: b.text, at, ...(b.ko ? { ko: b.ko } : {}), told: now, imp: r.i };
        // (among the talk already there by its time; said at the same moment, after it)
        let at0 = msgs.length;
        while (at0 > 0 && (msgs[at0 - 1].at || 0) > at) at0--;
        msgs.splice(at0, 0, msg);
        first ??= n; top = n; count++;
    });
    const lastAt = Math.max(...msgs.map(x => x.at || 0));
    (room.read ||= {})[P] = Math.max(Number(room.read?.[P]) || 0, lastAt);
    // (the talk brought in is read: a phone that has a reading takes it as a stretch done; one that never read anything
    // begins its reading after it — as the talk kept by 대화만 남기기)
    for (const p of Object.values(w.phones || {})) {
        if (!p || typeof p !== 'object') continue;
        if (p.sync?.marks?.base) (p.sync.done ||= []).push([first, top]);
        else p.sync = { ...(p.sync || {}), marks: { ...(p.sync?.marks || {}), base: { index: top, user: -1, fp: '', tail: '' } } };
    }
    w.importTop = top;
    const off = [...list].reverse().find(r => Number.isFinite(r.off))?.off;
    w.imported = { chat: String(chat || ''), room: room.id, upto: list[list.length - 1].i, at: now, count: (Number(w.imported?.count) || 0) + count, shift: off ?? (before ? Number(w.imported.shift) || 0 : 0) };
    return { room: room.id, count, messages: list.length, from: list[0].i, to: list[list.length - 1].i };
}
