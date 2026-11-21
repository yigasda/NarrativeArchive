// Orbit 데이터를 서버 플러그인에 두기 (src/phone2keep.js + plugin/store.mjs를 같이 돌려요: 요청만 함수 호출로 바꿔서)
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore } from '../plugin/store.mjs';
import { makeKeep, splitLive, joinLive, KEEP } from '../src/phone2keep.js';

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
test('다른 곳에서 먼저 저장했으면 덮어쓰지 않아요', async t => {
    const o = await rig(t);
    const m = await o.openChat({ live: liveOf() });
    await o.save();
    await o.store.save(m.liveRef.id, { base: (await o.store.revOf(m.liveRef.id)), parts: { other: 1 } });
    m.live.world.queue.round = 9;
    await assert.rejects(o.save(), /다시 열어/);
    await assert.rejects(o.save(), /다시 열어/);
    assert.equal(joinLive((await o.store.load(m.liveRef.id)).parts).world.queue.round, 3);
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
