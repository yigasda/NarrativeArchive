// Orbit 데이터를 서버 플러그인에 두기 (src/phone2keep.js + plugin/store.mjs를 같이 돌려요: 요청만 함수 호출로 바꿔서)
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore } from '../plugin/store.mjs';
import { makeKeep, splitLive, joinLive, KEEP, merge3, into, settleRooms } from '../src/phone2keep.js';

const copy = v => JSON.parse(JSON.stringify(v));
const msgs = (n, from = 0) => Array.from({ length: n }, (_, i) => ({ id: `x${from + i}`, n: from + i, from: i % 2 ? 'Mara' : 'Ren', text: `말 ${from + i}`, at: 1000 + from + i }));
const liveOf = (n = 450) => ({ v: 1, mode: 'live', archive: [{ world: { id: 'old' } }], world: {
    id: 'w1', persona: 'Ren', queue: { round: 3, jobs: [] },
    phones: { mara: { owner: 'Mara', apps: { memo: [{ t: 'a' }] } }, ivo: { owner: 'Ivo' } },
    messenger: { accounts: { mara: { name: 'Mara' } }, reactRecent: ['❤️'], rooms: { r1: { id: 'r1', members: ['Ren', 'Mara'], read: { ren: 3 }, messages: msgs(n) }, r2: { id: 'r2', members: ['Ren', 'Ivo'], messages: [] } } },
} });
// 가짜 서버: 진짜 저장(plugin/store.mjs)에 바로 이어요. calls에 부른 것을 적어요
async function rig(t, { plugin = true } = {}) {
    const dir = await mkdtemp(path.join(tmpdir(), 'na-keep-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const store = openStore(dir), o = { store, calls: [], on: plugin, at: null, fail: false };
    const api = {
        ping: async () => { if (!o.on) throw new Error('404'); return { ok: true }; },
        load: async id => { o.calls.push(['load', id]); return store.load(id); },
        rev: async id => { o.calls.push(['rev', id]); return store.revOf(id); },
        save: async (id, { base, chat, parts }) => {
            const sent = Object.fromEntries(Object.entries(parts).map(([k, s]) => [k, s === null ? null : JSON.parse(s)]));
            o.calls.push(['save', id, Object.keys(parts).sort()]);
            if (o.fail) throw new Error('끊겼어요');
            return store.save(id, { base, chat, parts: sent });
        },
        fork: async (from, to, { chat }) => { o.calls.push(['fork', from, to]); return store.fork(from, to, { chat }); },
        drop: async id => { o.calls.push(['drop', id]); return store.drop(id); },
    };
    o.keep = makeKeep({ api, now: () => o.at });
    // 실리 저장 흉내: core.js saveMeta가 하는 순서 그대로. file = 채팅 파일에 든 우리 메타
    o.file = null; o.stSaves = 0;
    o.save = async () => {
        const kept = await o.keep.onSave();
        if (!kept?.skip) { o.file = JSON.stringify(o.at.m); o.stSaves++; kept?.saved?.(); }
        if (kept?.error) throw kept.error;
    };
    // 채팅 열기: 파일에서 읽은 메타로
    o.openChat = async (m, mark = 'A') => { o.at = { m, mark }; await o.keep.open(m, mark); return m; };
    o.reopen = (mark = o.at.mark) => o.openChat(JSON.parse(o.file), mark);
    return o;
}

test('나눴다 붙이면 그대로예요 (방 · 폰의 순서도)', () => {
    for (const live of [liveOf(450), liveOf(0), liveOf(KEEP.chunk), { v: 1, mode: 'story', world: null, archive: [] }, { v: 1, mode: 'story', world: { id: 'w' } }, { v: 1, mode: 'live', world: { messenger: { rooms: { a: { id: 'a' } } }, phones: {} } }]) {
        const back = joinLive(copy(splitLive(live)));
        assert.deepEqual(back, live);
        assert.equal(JSON.stringify(Object.keys(back.world?.messenger?.rooms || {})), JSON.stringify(Object.keys(live.world?.messenger?.rooms || {})));
        assert.equal(JSON.stringify(Object.keys(back.world?.phones || {})), JSON.stringify(Object.keys(live.world?.phones || {})));
    }
    const parts = splitLive(liveOf(450));
    assert.deepEqual(Object.keys(parts).filter(k => k.startsWith('room/r1/')), ['room/r1/0', 'room/r1/1', 'room/r1/2']);
    assert.equal(parts['room/r1/2'].length, 50);
});
test('조각이 하나 빠지면 모자란 채로 붙이지 않아요', () => {
    for (const gone of ['room/r1/1', 'room/r1', 'phone/ivo', 'archive', 'live']) {
        const parts = copy(splitLive(liveOf(450)));
        delete parts[gone];
        assert.throws(() => joinLive(parts), /Orbit 저장/, gone);
    }
});

test('채팅 파일에 든 것을 플러그인으로 옮기고, 채팅 파일에는 liveRef만 남아요', async t => {
    const o = await rig(t), want = liveOf();
    const m = await o.openChat({ text: '아카이브', live: copy(want) });
    assert.equal(o.keep.state(), 'ok');
    assert.deepEqual(m.live, want);                      // 읽고 쓰는 것은 그대로
    assert.ok(m.liveRef?.id);
    await o.save();
    assert.equal(o.stSaves, 1);
    assert.deepEqual(JSON.parse(o.file), { text: '아카이브', liveRef: m.liveRef });
    assert.deepEqual(joinLive((await o.store.load(m.liveRef.id)).parts), want);
    // 다시 열면 플러그인에서 읽어 와요
    const again = await o.reopen();
    assert.deepEqual(again.live, want);
    assert.equal(Object.keys(again).includes('live'), false);
});
test('말 하나를 더하면 그 방의 마지막 조각만 보내고, 실리 저장은 안 해요', async t => {
    const o = await rig(t);
    const m = await o.openChat({ text: 't', live: liveOf() });
    await o.save();
    o.calls.length = 0; const before = o.stSaves;
    m.live.world.messenger.rooms.r1.messages.push(...msgs(1, 450));
    await o.save();
    assert.deepEqual(o.calls, [['save', m.liveRef.id, ['room/r1/2']]]);
    assert.equal(o.stSaves, before);
    // 아무것도 안 바뀌었으면 아무것도 안 보내요
    o.calls.length = 0;
    await o.save();
    assert.deepEqual(o.calls, []);
    assert.equal(o.stSaves, before);
    // 다시 열면 그 말이 있어요
    assert.equal((await o.reopen()).live.world.messenger.rooms.r1.messages.length, 451);
});
test('Orbit 밖의 것이 바뀌면 실리 저장도 해요', async t => {
    const o = await rig(t);
    const m = await o.openChat({ text: 't', live: liveOf() });
    await o.save();
    const before = o.stSaves;
    m.text = '바뀐 아카이브';
    await o.save();
    assert.equal(o.stSaves, before + 1);
    assert.equal(JSON.parse(o.file).text, '바뀐 아카이브');
    await o.save();
    assert.equal(o.stSaves, before + 1);
});
test('방이 없어지거나 말이 줄면 남은 조각을 지워요', async t => {
    const o = await rig(t);
    const m = await o.openChat({ live: liveOf() });
    await o.save();
    m.live.world.messenger.rooms.r1.messages.splice(150);
    delete m.live.world.messenger.rooms.r2;
    await o.save();
    const got = await o.store.load(m.liveRef.id);
    assert.deepEqual(Object.keys(got.parts).filter(k => k.startsWith('room/')).sort(), ['room/r1', 'room/r1/0']);
    assert.equal((await o.reopen()).live.world.messenger.rooms.r1.messages.length, 150);
});
test('플러그인이 없으면 지금 그대로: 채팅 파일에 들어가요', async t => {
    const o = await rig(t, { plugin: false }), want = liveOf();
    const m = await o.openChat({ live: copy(want) });
    assert.equal(o.keep.state(), 'none');
    await o.save();
    assert.deepEqual(JSON.parse(o.file), { live: want });
    assert.equal(m.liveRef, undefined);
    m.live.mode = 'story';
    await o.save();
    assert.equal(JSON.parse(o.file).live.mode, 'story');
    assert.deepEqual(o.calls, []);
});
test('플러그인에 둔 채팅을 플러그인 없이 열면 비어 있고(off), 다시 켜면 돌아와요', async t => {
    const o = await rig(t), want = liveOf();
    await o.openChat({ live: copy(want) });
    await o.save();
    o.on = false;
    const m = await o.reopen();
    assert.equal(o.keep.state(), 'off');
    assert.equal(m.live, undefined);
    await o.save();                                    // (다른 것을 저장해도 liveRef는 그대로)
    assert.ok(JSON.parse(o.file).liveRef?.id);
    o.on = true;
    assert.deepEqual((await o.reopen()).live, want);
});
test('분기한 채팅은 제 몫을 따로 가져요', async t => {
    const o = await rig(t);
    const m = await o.openChat({ live: liveOf() }, 'A');
    await o.save();
    const parent = m.liveRef.id, file = o.file;
    // 분기: 같은 메타, 다른 표시
    const b = await o.openChat(JSON.parse(file), 'B');
    assert.notEqual(b.liveRef.id, parent);
    b.live.world.messenger.rooms.r1.messages.push(...msgs(1, 450));
    await o.save();
    assert.equal(JSON.parse(o.file).liveRef.id, b.liveRef.id);
    assert.equal(joinLive((await o.store.load(parent)).parts).world.messenger.rooms.r1.messages.length, 450);
    assert.equal(joinLive((await o.store.load(b.liveRef.id)).parts).world.messenger.rooms.r1.messages.length, 451);
    // 분기를 다시 열면 또 가르지 않아요
    o.calls.length = 0;
    await o.reopen('B');
    assert.equal(o.calls.some(c => c[0] === 'fork'), false);
    // 원래 채팅은 원래 것을 그대로
    const a = await o.openChat(JSON.parse(file), 'A');
    assert.equal(a.liveRef.id, parent);
    assert.equal(a.live.world.messenger.rooms.r1.messages.length, 450);
});
test('폰 2를 통째로 지우면 플러그인의 것도 지워요', async t => {
    const o = await rig(t);
    const m = await o.openChat({ live: liveOf() });
    await o.save();
    const id = m.liveRef.id;
    delete m.live;
    await o.save();
    assert.equal(await o.store.load(id), null);
    assert.deepEqual(JSON.parse(o.file), {});
    // 새로 만들면 다시 옮겨요
    m.live = liveOf(3);
    await o.save();
    assert.ok(m.liveRef.id && m.liveRef.id !== id);
    assert.deepEqual(JSON.parse(o.file), { liveRef: m.liveRef });
});
test('지웠다 다시 넣은 m.live도 채팅 파일에 안 들어가요', async t => {
    const o = await rig(t);
    const m = await o.openChat({ live: liveOf() });
    await o.save();
    const had = m.live; delete m.live; m.live = had;      // (phone2go.js의 되돌리기가 이렇게 해요)
    had.mode = 'story';
    await o.save();
    assert.deepEqual(JSON.parse(o.file), { liveRef: m.liveRef });
    assert.equal((await o.reopen()).live.mode, 'story');
});
test('보내기가 실패하면 오류가 나고, 다음 저장에 다시 보내요', async t => {
    const o = await rig(t);
    const m = await o.openChat({ live: liveOf() });
    await o.save();
    o.fail = true;
    m.live.world.queue.round = 9;
    await assert.rejects(o.save(), /끊겼어요/);
    assert.equal('live' in JSON.parse(o.file), false);
    o.fail = false;
    await o.save();
    assert.equal((await o.reopen()).live.world.queue.round, 9);
});
// ---- 서버 플러그인이 쓴 것과 맞추기 (실리를 닫은 동안 · 탭을 가려 둔 동안 서버가 답장을 넣어요)
// 서버가 한 것처럼: 저장에서 읽어서 고치고 저장해요
const serverDoes = async (o, id, change) => { const got = await o.store.load(id), live = joinLive(got.parts); change(live.world, live); await o.store.save(id, { base: got.rev, parts: copy(splitLive(live)) }); };
const stored = async (o, id) => joinLive((await o.store.load(id)).parts).world;

test('맞추기: 서버가 넣은 말을 받아요. 있던 방 · 말의 객체는 그대로예요(화면이 쥐고 있는 것이 안 죽어요). 바뀐 게 없으면 안 읽어요', async t => {
    const o = await rig(t), m = await o.openChat({ live: liveOf(3) });
    await o.save();
    const id = m.liveRef.id, room = m.live.world.messenger.rooms.r1, first = room.messages[0], list = room.messages, world = m.live.world;
    o.calls.length = 0;
    assert.equal(await o.keep.sync(), false);
    assert.deepEqual(o.calls.map(c => c[0]), ['rev']);
    await serverDoes(o, id, w => { w.messenger.rooms.r1.messages.push({ id: 's1', n: 3, from: 'Mara', text: 'you there?', at: 5000, extra: { autonomous: true } }); w.presence = { meta: { autonomousDailyBudget: { date: 'd', counts: { mara: 1 } } } }; w.messenger.rooms.r1.autonomousUnreadCount = 1; });
    assert.equal(await o.keep.sync(), true);
    assert.equal(m.live.world, world); assert.equal(world.messenger.rooms.r1, room); assert.equal(room.messages, list); assert.equal(room.messages[0], first);
    assert.deepEqual(room.messages.map(x => x.id), ['x0', 'x1', 'x2', 's1']);
    assert.equal(room.autonomousUnreadCount, 1); assert.equal(world.presence.meta.autonomousDailyBudget.counts.mara, 1);
    // 받은 뒤의 저장: 보낼 것이 없어요 (서버 것과 같아요)
    o.calls.length = 0;
    await o.save();
    assert.equal(o.calls.filter(c => c[0] === 'save').length, 0);
});

test('맞추기: 서버가 답장을 넣는 사이에 내가 말을 보냈어도 둘 다 남아요. 내 말의 번호는 겹치지 않게 새로 받아요', async t => {
    const o = await rig(t), m = await o.openChat({ live: liveOf(3) });
    await o.save();
    const id = m.liveRef.id, w = m.live.world;
    await serverDoes(o, id, sw => { sw.messenger.rooms.r1.messages.push({ id: 's1', n: 3, from: 'Mara', text: 'you there?', at: 5000 }); sw.messenger.seq = 3; sw.presence = { meta: { count: 1 } }; });
    // 브라우저(아직 서버 것을 모름): 내가 말을 보내고 답장이 줄을 섰어요
    w.messenger.rooms.r1.messages.push({ id: 'u1', n: 3, from: 'Ren', text: 'im back', at: 6000 });
    w.messenger.seq = 3; w.queue.jobs.push({ id: 'j1', kind: 'reply', owner: 'Mara', room: 'r1', state: 'waiting' });
    (w.messenger.rooms.r1.read ||= {}).ren = 6000;
    await o.save();
    const sw = await stored(o, id);
    assert.deepEqual(sw.messenger.rooms.r1.messages.map(x => [x.id, x.n]), [['x0', 0], ['x1', 1], ['x2', 2], ['s1', 3], ['u1', 4]]);
    assert.equal(sw.messenger.seq, 4);
    assert.deepEqual(sw.queue.jobs.map(j => j.id), ['j1']);
    assert.equal(sw.presence.meta.count, 1); assert.equal(sw.messenger.rooms.r1.read.ren, 6000);
    // 브라우저의 것도 같아요
    assert.deepEqual(m.live.world.messenger.rooms.r1.messages.map(x => x.id), ['x0', 'x1', 'x2', 's1', 'u1']);
    assert.deepEqual(copy(m.live.world), sw);
});

test('맞추기: 한쪽만 바꾼 것은 그쪽 것, 같은 것을 양쪽이 고쳤으면 서버 것. 내가 지운 말은 지워진 채로', async t => {
    const o = await rig(t), m = await o.openChat({ live: liveOf(4) });
    await o.save();
    const id = m.liveRef.id, w = m.live.world;
    await serverDoes(o, id, sw => { sw.messenger.rooms.r1.messages[1].text = '서버가 고침'; sw.messenger.rooms.r1.autoFail = { attempts: 1 }; sw.phones.mara.schedState = { text: 's' }; });
    w.messenger.rooms.r1.messages[1].text = '내가 고침';
    w.messenger.rooms.r1.messages.splice(3, 1);            // (x3을 지움: 서버는 안 건드렸어요)
    w.messenger.rooms.r1.name = '새 이름';
    w.phones.ivo.note = 'mine';
    await o.save();
    const sw = await stored(o, id), r = sw.messenger.rooms.r1;
    assert.deepEqual(r.messages.map(x => [x.id, x.text]), [['x0', '말 0'], ['x1', '서버가 고침'], ['x2', '말 2']]);
    assert.deepEqual([r.name, r.autoFail.attempts, sw.phones.mara.schedState.text, sw.phones.ivo.note], ['새 이름', 1, 's', 'mine']);
});

test('맞추기: 그사이 내가 새 Orbit을 시작했으면 내 것이 통째로 올라가요', async t => {
    const o = await rig(t), m = await o.openChat({ live: liveOf(2) });
    await o.save();
    const id = m.liveRef.id;
    await serverDoes(o, id, sw => { sw.messenger.rooms.r1.messages.push({ id: 's1', n: 2, from: 'Mara', text: 'x', at: 9 }); });
    m.live.world = { id: 'w2', persona: 'Ren', queue: { round: 0, jobs: [] }, phones: {}, messenger: { accounts: {}, rooms: {} } };
    await o.save();
    const sw = await stored(o, id);
    assert.equal(sw.id, 'w2'); assert.deepEqual(sw.messenger.rooms, {});
});

test('맞추기: 계속 부딪히면(세 번째) 오류로 알려요. 서버 것은 그대로예요', async t => {
    const o = await rig(t), m = await o.openChat({ live: liveOf(2) });
    await o.save();
    const id = m.liveRef.id, save = o.keep, real = o.store.save;
    let n = 0;
    // (저장하려 할 때마다 서버가 먼저 써요)
    o.store.save = async (sid, body) => { if (body.base !== undefined && n < 5 && !body.__server) { n++; const got = await o.store.load(sid), live = joinLive(got.parts); live.world.queue.round += 100; await real.call(o.store, sid, { base: got.rev, parts: copy(splitLive(live)) }); } return real.call(o.store, sid, body); };
    m.live.world.messenger.rooms.r1.name = 'mine';
    await assert.rejects(o.save(), /다시 열어/);
    o.store.save = real; void save;
    assert.equal((await stored(o, id)).messenger.rooms.r1.name, undefined);
    // 그다음엔 돼요
    await o.save();
    assert.equal((await stored(o, id)).messenger.rooms.r1.name, 'mine');
});

test('플러그인의 저장이 없어졌으면 liveRef를 떼요 (새로 만들 수 있어요)', async t => {
    const o = await rig(t);
    const m = await o.openChat({ text: 't', liveRef: { id: 'gone1' } });
    assert.equal(o.keep.state(), 'ok');
    assert.equal(m.liveRef, undefined);
    await o.save();
    assert.deepEqual(JSON.parse(o.file), { text: 't' });
});
test('저장을 부를 때 채팅이 바뀌어 있으면 그 채팅을 먼저 읽어요', async t => {
    const o = await rig(t);
    await o.openChat({ live: liveOf() });
    await o.save();
    o.at = { m: JSON.parse(o.file), mark: 'A' };          // (열었다는 소식 없이 메타만 바뀜)
    await o.keep.ready();
    assert.equal(o.at.m.live.world.id, 'w1');
});
test('다시 연 뒤 안 바뀌었으면 아무것도 안 보내고 실리 저장도 안 해요', async t => {
    const o = await rig(t);
    await o.openChat({ text: 't', live: liveOf() });
    await o.save();
    o.calls.length = 0;
    const m = await o.reopen(), before = o.stSaves;
    await o.save();
    assert.deepEqual(o.calls, [['load', m.liveRef.id]]);
    assert.equal(o.stSaves, before);
});
test('보내기가 실패해도, 플러그인에 둔 채팅의 m.live는 채팅 파일에 안 들어가요', async t => {
    const o = await rig(t);
    const m = await o.openChat({ live: liveOf() });
    await o.save();
    const had = m.live; delete m.live; m.live = had; had.mode = 'story';
    o.fail = true;
    await assert.rejects(o.save(), /끊겼어요/);
    assert.equal('live' in JSON.parse(o.file), false);
});
test('못 읽는 m.live는 그대로 둬요 (채팅 파일에 남아요)', async t => {
    const o = await rig(t);
    await o.openChat({ live: { v: 2, something: 1 } });
    await o.save();
    assert.deepEqual(JSON.parse(o.file), { live: { v: 2, something: 1 } });
    assert.deepEqual(o.calls, []);
});
test('열었다는 소식 없이 채팅이 바뀌어도, 저장은 그 채팅의 것을 그 채팅의 자리에 해요', async t => {
    const o = await rig(t);
    const a = await o.openChat({ live: liveOf() }, 'A');
    await o.save();
    const m = { live: liveOf(3) };
    o.at = { m, mark: 'C' };
    await o.save();
    assert.ok(m.liveRef?.id && m.liveRef.id !== a.liveRef.id);
    assert.deepEqual(JSON.parse(o.file), { liveRef: m.liveRef });
    assert.equal(joinLive((await o.store.load(a.liveRef.id)).parts).world.messenger.rooms.r1.messages.length, 450);
});

test('합치기(merge3): 묶음은 칸마다, id 목록은 id로. 지운 것 · 더한 것이 양쪽 다 살아요', () => {
    const base = { a: 1, b: { x: 1, y: 2 }, list: [{ id: 'p', v: 1 }, { id: 'q', v: 1 }, { id: 'r', v: 1 }], plain: [1, 2], gone: 1, both: 1 };
    const server = { a: 2, b: { x: 1, y: 3 }, list: [{ id: 'p', v: 1 }, { id: 'q', v: 2 }, { id: 'r', v: 1 }, { id: 's', v: 9 }], plain: [1, 2, 3], gone: 1, both: 5, sNew: 's' };
    const local = { a: 1, b: { x: 7, y: 2 }, list: [{ id: 'p', v: 1 }, { id: 'q', v: 3 }, { id: 'l', v: 8 }], plain: [0], both: 6, lNew: 'l' };
    assert.deepEqual(merge3(base, server, local), { a: 2, b: { x: 7, y: 3 }, list: [{ id: 'p', v: 1 }, { id: 'q', v: 2 }, { id: 's', v: 9 }, { id: 'l', v: 8 }], plain: [1, 2, 3], both: 5, sNew: 's', lNew: 'l' });
    // 한쪽만 바꿨으면 그쪽 것 그대로
    assert.equal(merge3(base, base, local), local); assert.equal(merge3(base, server, copy(base)), server);
    // 한쪽이 지우고 다른 쪽이 고친 것은 고친 것으로 남아요
    assert.deepEqual(merge3({ k: { v: 1 } }, {}, { k: { v: 2 } }), { k: { v: 2 } });
    assert.deepEqual(merge3({ k: { v: 1 } }, { k: { v: 2 } }, {}), { k: { v: 2 } });
});

test('제자리 맞추기(into): 값은 같아지고 있던 객체는 그대로. id 목록은 같은 id의 객체를 다시 써요', () => {
    const a = { id: 'a', t: 1 }, b = { id: 'b', t: 2 }, target = { list: [a, b], keep: { deep: [1, 2] }, gone: 1, kind: [1] }, list = target.list, keep = target.keep;
    const source = { list: [{ id: 'z', t: 0 }, { id: 'b', t: 22 }, { id: 'a', t: 11 }], keep: { deep: [3] }, kind: { now: 'object' }, fresh: true };
    assert.equal(into(target, source), target);
    assert.deepEqual(target, source);
    assert.equal(target.list, list); assert.equal(target.keep, keep);
    assert.equal(target.list[2], a); assert.equal(target.list[1], b); assert.equal(a.t, 11);
    // (새로 들어온 것은 사본이에요: 준 것과 객체를 같이 쓰지 않아요)
    assert.notEqual(target.list[0], source.list[0]); assert.notEqual(target.kind, source.kind);
});

test('합치기 퍼즈: 서버와 브라우저가 따로 말을 더하고 고쳐도 — 어느 쪽 말도 안 없어지고, id · 번호가 안 겹치고, 때 순서예요', () => {
    let seed = 12345; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    for (let round = 0; round < 400; round++) {
        const base = liveOf(3 + rnd(5));
        base.world.messenger.seq = Math.max(...base.world.messenger.rooms.r1.messages.map(x => x.n));
        const server = copy(base), local = copy(base), added = { s: [], l: [] }, removed = new Set(), made = { s: 0, l: 0 };
        const act = (live, who) => {
            const w = live.world, rooms = Object.values(w.messenger.rooms), r = rooms[rnd(rooms.length)], k = rnd(who === 's' ? 3 : 6);
            const all = () => rooms.flatMap(x => x.messages);
            const nextN = () => Math.max(-1, w.messenger.seq ?? -1, ...all().map(x => x.n)) + 1;
            if (k === 0 || k === 1) { const id = `${who}${round}_${made[who]++}`; const n = nextN(); r.messages.push({ id, n, from: who === 's' ? 'Mara' : 'Ren', text: id, at: 2000 + rnd(50) + (who === 'l' ? 100 : 0) }); w.messenger.seq = n; added[who].push(id); }
            else if (k === 2) { w.presence = { meta: { count: ((w.presence?.meta?.count) || 0) + 1 } }; }
            else if (k === 3 && r.messages.length) { const x = r.messages[rnd(r.messages.length)]; x.text += '!'; }
            else if (k === 4 && r.messages.length) { const i = rnd(r.messages.length), x = r.messages[i]; if (!added.l.includes(x.id)) removed.add(x.id); r.messages.splice(i, 1); const at = added.l.indexOf(x.id); if (at >= 0) added.l.splice(at, 1); }
            else if (k === 5) { w.queue.jobs.push({ id: `j${round}_${w.queue.jobs.length}`, kind: 'reply', room: r.id, state: 'waiting' }); }
        };
        for (let i = 1 + rnd(4); i > 0; i--) act(server, 's');
        for (let i = 1 + rnd(5); i > 0; i--) act(local, 'l');
        const out = settleRooms(merge3(base, server, copy(local)), server), msgs = Object.values(out.world.messenger.rooms).flatMap(x => x.messages), ids = msgs.map(x => x.id);
        assert.equal(new Set(ids).size, ids.length, `round ${round}: 같은 id가 두 번`);
        for (const id of [...added.s, ...added.l]) assert.ok(ids.includes(id), `round ${round}: ${id}가 없어졌어요`);
        for (const id of removed) assert.ok(!ids.includes(id), `round ${round}: 지운 ${id}가 돌아왔어요`);
        assert.equal(new Set(msgs.map(x => x.n)).size, msgs.length, `round ${round}: 번호가 겹쳐요`);
        assert.ok(out.world.messenger.seq >= Math.max(-1, ...msgs.map(x => x.n)), `round ${round}: seq`);
        for (const r of Object.values(out.world.messenger.rooms)) for (let i = 1; i < r.messages.length; i++) assert.ok(r.messages[i - 1].at <= r.messages[i].at, `round ${round}: 순서`);
        // 서버가 가진 말의 번호는 그대로예요
        const sn = new Map(Object.values(server.world.messenger.rooms).flatMap(x => x.messages).map(x => [x.id, x.n]));
        for (const x of msgs) if (sn.has(x.id)) assert.equal(x.n, sn.get(x.id), `round ${round}: 서버 번호`);
        assert.deepEqual(out.world.queue.jobs.map(j => j.id), local.world.queue.jobs.map(j => j.id));
        // 다시 합쳐도 그대로 (서버가 합친 것을 받은 뒤)
        assert.deepEqual(merge3(out, out, copy(out)), out);
    }
});
