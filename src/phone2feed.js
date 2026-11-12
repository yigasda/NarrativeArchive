// 폰 2 반영이 받는 메신저 대화 (docs/PHONE2-PLAN.md 단계 6 · "반영(폰 2)"). 아무 데서도 아직 안 불러요(7단계에서 반영에
// 연결). 폰 1은 이 파일을 부르지 않아요. 메신저는 읽기만 해요(번호 없는 메시지에 번호를 주는 것만 빼고).
//
// 반영의 NEW MESSAGES 자리에 들어가는 모양: 롤플 메시지 + 상태창처럼. 방이 바뀌면 방 줄, 장면 줄(그 메시지 번호 · 주인의
// 그때 시각 · 주인 이름 — 주인이 답하며 적은 상태), 메시지마다 [#번호] 말한 사람: 말. 주인이 답하며 폰으로 한 일은 그
// 메시지 번호로 "주인 [App]: 한 일". 페르소나도 이름으로 써요("나"라고 쓰면 주인의 말로 헷갈려요).
//   [Orbit · Lio]
//   #12 · 10-26 19:20 · Ren — 집 · 소파 · 저녁
//   [#12] Lio: 오늘 왜 그랬어?
//   [#13] Ren: …됐어. 나중에 얘기해.
//   [#13] Ren [Diary]: 방금 들은 말 때문에 속상한 마음을 적음
// 메시지 하나: { id, n, from, text, at (ms), ko?, state?, does?: [{ app, what }], call?: { min, summary } }

import { liveKey, liveWorld, numberLive } from './phone2store.js';
import { liveWall } from './phone2clock.js';

const same = (a, b) => !!liveKey(a) && liveKey(a) === liveKey(b);
const one = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const appName = a => one(a).replace(/^./, c => c.toUpperCase());
// a room as the owner sees it: its name, else the others in it
const titleOf = (room, owner) => one(room.name) || room.members.filter(n => !same(n, owner)).join(', ');

// the owner's messenger messages numbered past `after`, up to `upto`, in the order they were said:
// [{ n, at, room, from, text, state, does, call }]
export function feedRows(m, owner, { after = 0, upto = Infinity } = {}) {
    const w = liveWorld(m);
    if (!w || !one(owner)) return [];
    numberLive(w);
    const out = [];
    for (const room of Object.values(w.messenger?.rooms || {})) {
        if (!room.members.some(n => same(n, owner))) continue;
        for (const x of room.messages || []) if (x.n > after && x.n <= upto) out.push({ ...x, room });
    }
    return out.sort((a, b) => a.n - b.n);
}

// the rows as the reflection reads them (NEW MESSAGES): tz is where the owner is (their clock on the scene lines),
// state the owner's state before the first row (their last one), else none
export function feedText(m, owner, rows, { tz = 'UTC', state = '' } = {}) {
    const w = liveWorld(m);
    if (!w || !rows.length) return '';
    const lines = [];
    let room = null, now = one(state);
    const head = x => { const t = liveWall(tz, w.dayShift, x.at); lines.push(`#${x.n} · ${t.at} · ${owner}${now ? ` — ${now}` : ''}`); };
    for (const x of rows) {
        const fresh = x.room !== room, says = same(x.from, owner) && one(x.state) && one(x.state) !== now;
        if (fresh) { room = x.room; lines.push(`[Orbit · ${titleOf(room, owner)}]`); }
        if (says) now = one(x.state);
        if (fresh || says) head(x);
        if (x.call) lines.push(`[#${x.n}] ${x.from} [Call]: ${Math.max(0, Math.round(Number(x.call.min) || 0))} min${one(x.call.summary) ? ` — ${one(x.call.summary)}` : ''}`);
        else lines.push(`[#${x.n}] ${x.from}: ${one(x.text)}`);
        if (same(x.from, owner)) for (const d of Array.isArray(x.does) ? x.does : []) if (one(d?.what)) lines.push(`[#${x.n}] ${owner} [${appName(d.app) || 'Phone'}]: ${one(d.what)}`);
    }
    return lines.join('\n');
}

// what the owner's phone already shows of the messenger (PHONE NOW's MESSENGER, already said): the newest lines of each
// room, oldest first; the reflection reads it, never writes it again
export function messengerNow(m, owner, { tz = 'UTC', per = 6 } = {}) {
    const w = liveWorld(m);
    if (!w) return '';
    numberLive(w);
    const out = [];
    for (const room of Object.values(w.messenger?.rooms || {})) {
        if (!room.members.some(n => same(n, owner)) || !(room.messages || []).length) continue;
        out.push(`[Orbit · ${titleOf(room, owner)}]`, ...room.messages.slice(-per).map(x => `${liveWall(tz, w.dayShift, x.at).at} ${x.from}: ${x.call ? `(call ${Math.round(Number(x.call.min) || 0)} min)` : one(x.text)}`));
    }
    return out.join('\n');
}

// the owner talks with the persona on the messenger only: a text or call to the persona the reflection wrote into the
// phone's own apps goes (the very name only, as the contact holds it; a group thread stays). answer: the reflection's
// { events: [{ phone: { threads, calls } }] } (or one phone). Returns how many went
export function dropPersonaTalk(answer, persona) {
    let n = 0;
    const phones = [answer?.phone, ...(Array.isArray(answer?.events) ? answer.events.map(e => e?.phone) : [])].filter(x => x && typeof x === 'object');
    for (const ph of phones) for (const k of ['threads', 'calls']) if (Array.isArray(ph[k])) ph[k] = ph[k].filter(x => { if (!(same(x?.with, persona) && !x?.group)) return true; n++; return false; });
    return n;
}
// the persona among the owner's contacts, marked: reached on the messenger only (added when not there)
export function markPersona(p, persona) {
    const name = one(persona);
    if (!p || !name) return null;
    p.contacts ||= [];
    const c = p.contacts.find(x => same(x?.name, name)) || (p.contacts.push({ name }), p.contacts.at(-1));
    c.messenger = true;
    return c;
}
