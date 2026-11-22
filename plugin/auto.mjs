// 먼저 말 걸기를 서버에서 돌리기 (docs/PHONE2-PLAN.md "서버 플러그인" 3단계).
// 마리나라의 서버 스케줄러(plugin/marinara/server-autonomous-scheduler.service.js)는 `app` 하나만 알아요. 여기서 그 `app`을
// 플러그인 저장(plugin/store.mjs) 위에 만들어요. 마리나라의 "채팅" 하나 = 우리 방 하나 (id: `<세계 id>:<방 id>`,
// 브라우저의 phone2sched.js chatIdOf와 같은 글자라서 마리나라가 기억하는 방의 움직임이 서로 맞아요).
//   app.chats.list()                              먼저 말 걸기를 볼 방들 [{ id, mode: 'conversation', metadata }]
//   app.chats.getById(id)                         그 방 하나 (지금 저장된 것)
//   app.chats.resolveConversationPresenceState(id) { schedules, statusOverrides }
//   app.chats.markAutonomousUnread(id, { characterId, count })   안 읽은 먼저 건 말 (마리나라의 열쇠 그대로, 방에 적어요)
//   app.inject({ url: '/api/conversation/autonomous/check', payload })  때가 됐나 (phone2sched.js checkProactive)
//   app.inject({ url: '/api/generate', payload })                      답장 만들기 (deps.generate: 아직 없으면 501)
//   app.presence(id, status)                      브라우저가 "이 방을 내가 보고 있어요" (마리나라의 /activity/presence)
// 이 파일은 실리 · 익스프레스를 몰라요: 테스트에서 임시 폴더로 그대로 돌려요.

import { joinLive, splitLive, sumOf } from '../src/phone2keep.js';
import { liveWorld, liveKey } from '../src/phone2store.js';
import { checkProactive, chatIdOf, schedulesOn, reseedActivity } from '../src/phone2sched.js';
import { recordAutonomousClientPresence } from '../src/marinara/autonomous.service.js';

const obj = v => v && typeof v === 'object' && !Array.isArray(v);
// (Marinara's chats.storage.ts readUnreadCount · readCharacterIds, as they are)
const readUnreadCount = value => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
const readCharacterIds = value => (Array.isArray(value) ? value.filter(id => typeof id === 'string' && id.trim().length > 0) : []);

// store: plugin/store.mjs openStore(…)
// tzOf(real, 이름) → 그 사람의 시간대 | ''   ·   cardsOf(real, room) → { 폰 열쇠: 카드 데이터 } (스케줄이 없는 사람의 수다 정도)
// generate({ payload, entry, roomId, app }) → { statusCode, payload (마리나라의 SSE 글) }
// around(entry, fn) → fn의 답: 그 세계를 읽는 일을 감싸요. 일꾼은 여기서 그 세계의 실리 것을 끼워요 (시간대 · 카드를
//   브라우저와 같은 코드로 읽으려고). 감싸지 못하는 세계(서버가 읽을 묶음이 없음)는 목록에 안 나와요
export function makeAutoApp({ store, tzOf = () => '', cardsOf = () => ({}), generate = null, around = (entry, fn) => fn() } = {}) {
    const worlds = new Map(), rooms = new Map(), closers = [];

    // 저장 하나를 읽어요 (rev가 그대로면 읽어 둔 것) → { sid, rev, real: { live }, sums } | null
    async function open(sid) {
        const rev = await store.revOf(sid);
        if (rev === null) { worlds.delete(sid); return null; }
        const had = worlds.get(sid);
        if (had && had.rev === rev) return had;
        const got = await store.load(sid);
        if (!got) { worlds.delete(sid); return null; }
        let live;
        try { live = joinLive(got.parts); } catch { worlds.delete(sid); return null; }
        const e = { sid, rev: got.rev, real: { live }, sums: new Map(Object.entries(got.parts).map(([k, v]) => [k, sumOf(JSON.stringify(v))])) };
        // (read again because the browser saved: what Marinara's tracker remembers of its rooms is read from the rooms again —
        //  my new words, the messages the browser's characters wrote first. "The browser is watching" stays)
        if (had) for (const id of Object.keys(liveWorld(e.real)?.messenger?.rooms || {})) reseedActivity(e.real, id);
        worlds.set(sid, e);
        return e;
    }
    // 바뀐 조각만 써요. 그사이 다른 곳(브라우저)이 저장했으면 409 오류: 읽어 둔 것을 버리고, 쓰지 않아요
    async function write(e) {
        const send = {}, sums = new Map();
        for (const [name, v] of Object.entries(splitLive(e.real.live))) {
            const s = JSON.stringify(v), h = sumOf(s);
            sums.set(name, h);
            if (e.sums.get(name) !== h) send[name] = JSON.parse(s);
        }
        for (const name of e.sums.keys()) if (!sums.has(name)) send[name] = null;
        if (!Object.keys(send).length) return e.rev;
        try { e.rev = (await store.save(e.sid, { base: e.rev, parts: send })).rev; }
        catch (err) { worlds.delete(e.sid); throw err; }
        e.sums = sums;
        return e.rev;
    }
    const charsOf = (w, room) => { const P = liveKey(w.persona); return (room?.members || []).filter(n => liveKey(n) !== P && w.phones?.[liveKey(n)]); };
    const metaOf = (e, room) => {
        const w = liveWorld(e.real), p = obj(w.presence) ? w.presence : {}, meta = obj(p.meta) ? p.meta : {};
        const zone = tzOf(e.real, charsOf(w, room)[0]) || '';
        return { ...meta, autonomousMessages: p.on === true, ...(zone ? { conversationTimeZone: zone } : {}) };
    };
    const rowOf = (e, room) => ({ id: chatIdOf(e.real, room.id), mode: 'conversation', metadata: metaOf(e, room) });
    // 방 id → { e, w, room } (지금 저장된 것) | null
    async function at(id) {
        const where = rooms.get(String(id));
        if (!where) return null;
        const e = await open(where.sid), w = e && liveWorld(e.real), room = w?.messenger?.rooms?.[where.rid];
        return room && chatIdOf(e.real, room.id) === String(id) ? { e, w, room } : null;
    }

    const chats = {
        async list() {
            const out = [], seen = new Map();
            for (const sid of await store.list()) {
                const e = await open(sid), w = e && liveWorld(e.real);
                if (!w) continue;
                let rows;
                try { rows = await around(e, () => Object.values(w.messenger?.rooms || {}).filter(room => obj(room) && charsOf(w, room).length).map(room => [rowOf(e, room), room.id])); }
                catch { continue; }
                for (const [row, rid] of rows) { seen.set(row.id, { sid, rid }); out.push(row); }
            }
            rooms.clear();
            for (const [k, v] of seen) rooms.set(k, v);
            return out;
        },
        async getById(id) { const x = await at(id); return x ? around(x.e, () => rowOf(x.e, x.room)) : null; },
        async resolveConversationPresenceState(id) {
            const x = await at(id);
            if (!x) return { schedules: {}, statusOverrides: {} };
            return around(x.e, () => {
                const on = schedulesOn(x.e.real), p = obj(x.w.presence) ? x.w.presence : {}, ids = charsOf(x.w, x.room).map(liveKey);
                return {
                    schedules: on ? Object.fromEntries(ids.filter(k => p.schedules?.[k]).map(k => [k, p.schedules[k]])) : {},
                    statusOverrides: obj(p.overrides) ? p.overrides : {},
                };
            });
        },
        // (Marinara's chats.storage.ts markAutonomousUnread: the same three keys, on the room)
        async markAutonomousUnread(id, input) {
            const x = await at(id);
            if (!x) return null;
            const current = x.room, timestamp = new Date().toISOString();
            const increment = Math.max(1, Math.floor(input?.count ?? 1));
            const currentCount = readUnreadCount(current.autonomousUnreadCount);
            const characterIds = new Set(readCharacterIds(current.autonomousUnreadCharacterIds));
            if (input?.characterId) characterIds.add(input.characterId);
            Object.assign(current, { autonomousUnreadCount: currentCount + increment, autonomousUnreadCharacterIds: Array.from(characterIds), autonomousUnreadAt: timestamp });
            await write(x.e);
            return rowOf(x.e, x.room);
        },
    };

    const app = {
        chats, activeGenerations: new Map(),
        // (the scheduler's sweep gate: when nothing was written since a sweep that found nobody, it does not sweep again)
        db: { _fileStore: { getTableWriteGeneration: () => store.generation() } },
        addHook: (name, fn) => { if (name === 'onClose') closers.push(fn); },
        async close() { for (const fn of closers.splice(0)) await fn(); },
        presence: (id, status) => recordAutonomousClientPresence(String(id), status === 'idle' || status === 'dnd' ? status : 'active'),
        open, write, at,
        async inject({ url, payload }) {
            try {
                const x = await at(payload?.chatId);
                if (!x) return { statusCode: 404, payload: JSON.stringify({ error: 'Chat not found' }) };
                if (url === '/api/conversation/autonomous/check') {
                    const out = await around(x.e, () => checkProactive(x.e.real, x.room.id, {
                        now: new Date(), tzOf: name => tzOf(x.e.real, name) || '', cards: cardsOf(x.e.real, x.room) || {},
                        maxFollowups: payload.maxFollowups, source: payload.source === 'server' ? 'server' : 'client', userStatus: payload.userStatus,
                    }));
                    return { statusCode: 200, payload: JSON.stringify(out) };
                }
                if (url === '/api/generate') {
                    if (typeof generate !== 'function') return { statusCode: 501, payload: JSON.stringify({ error: 'no generator' }) };
                    return await generate({ payload, entry: x.e, roomId: x.room.id, app });
                }
                return { statusCode: 404, payload: JSON.stringify({ error: 'no such route' }) };
            } catch (err) {
                return { statusCode: 500, payload: JSON.stringify({ error: String(err?.message || err) }) };
            }
        },
    };
    return app;
}
