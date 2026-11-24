// 업데이트 뒤 첫 옮기기가 겹칠 때 (2026-11-24 검토 r2 #2): 브라우저(phone2keepon.js의 keep)와 서버 일꾼(plugin/auto.mjs)이 같은 옛 저장에서
// 각자 메모리에서 옮기고, 일꾼이 먼저 써요(다른 방 r2의 하루 수). 그사이 사용자가 새 페이지에서 r1을 바꿨어요 → 저장할 때 합쳐도 사용자의 것이 남아요.
// 합치기 전에 서버 것 · base에도 같은 옮기기를 해서예요 (makeKeep의 prep). 진짜 플러그인 저장 · 일꾼의 app을 써요. 모델은 안 불러요.
process.env.NA_SCREEN_ANYWHERE = '1';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { openStore } from '../plugin/store.mjs';
import { makeAutoApp } from '../plugin/auto.mjs';
await import('../plugin/screen.mjs');
globalThis.document = { hidden: false, addEventListener() {}, dispatchEvent() { return true; }, querySelectorAll: () => [] };
const L = await import('../src/phone2store.js'), S = await import('../src/phone2sched.js'), K = await import('../src/phone2keep.js');
const KO = await import('../src/phone2keepon.js');
after(() => { setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

// 2026-11-24 전의 저장 (표시 없음, 채팅 설정은 Orbit에 하나)
function oldWorld() {
    const m = { phones: {} };
    L.startFresh(m, { persona: 'Ren', scope: 'test' });
    const w = L.liveWorld(m);
    delete w[L.ROOM_META_MARK];
    w.phones = { mara: { owner: 'Mara' }, ivo: { owner: 'Ivo' } };
    w.messenger.rooms = {
        r1: { id: 'r1', members: ['Ren', 'Mara'], messages: [{ id: 'a', n: 1, from: 'Ren', text: 'hi', at: 1 }] },
        r2: { id: 'r2', members: ['Ren', 'Ivo'], messages: [] },
    };
    w.presence = { on: true, schedules: {}, overrides: {}, user: {}, meta: { groupChatMode: 'individual', autoTranslate: true, translationOutputTargetLang: 'ko' } };
    return m;
}
async function race(variant, makeKeep = KO.makeOrbitKeep) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'na-race-'));
    try {
        const store = openStore(root), seed = oldWorld();
        await store.save('s1', { base: null, parts: K.splitLive(seed.live), chat: 'c1' });
        // (the browser's api over the same store: texts in, values out, as the plugin's routes do)
        const api = {
            ping: async () => ({ ok: true }), load: async id => store.load(id), rev: async id => store.revOf(id),
            save: async (id, { base, chat, parts }) => store.save(id, { base, chat, parts: Object.fromEntries(Object.entries(parts).map(([k, s]) => [k, s === null ? null : JSON.parse(s)])) }),
            fork: async (a, b, o) => store.fork(a, b, o), drop: async id => store.drop(id),
        };
        const m = { liveRef: { id: 's1' } }, keep = makeKeep(api, () => ({ m, mark: 'c1' }));
        await keep.open(m, 'c1');
        S.roomMeta(m, 'r1');                                                         // (the new page draws: reading moves the settings, in memory)
        if (variant === 'oldpage') {
            // (a tab not reloaded yet — old code, no move — turns "write first" off for the whole Orbit and saves before anyone saved the move)
            const got = await store.load('s1'), head = got.parts.live; head.world.presence.on = false;
            await store.save('s1', { base: got.rev, parts: { live: head } });
        } else {
            const app = makeAutoApp({ store }), e = await app.open('s1');
            S.noteProactive(e.real, 'r2', 'ivo', 'check_in', new Date());              // (the worker writes first: a count in the other room)
            await app.write(e);
        }
        if (variant === 'off') S.setAutonomous(m, 'r1', false);
        else if (variant === 'tr') S.roomMetaW(m, 'r1').translationOutputTargetLang = 'fr';
        else if (variant === 'group') S.setAutonomousOptions(m, 'r1', { groupChatMode: null });
        else if (variant === 'oldpage') S.roomMetaW(m, 'r2').autoTranslate = false;
        const r = await keep.onSave();
        const disk = K.joinLive((await store.load('s1')).parts).world.messenger.rooms;
        return { error: r?.error?.message || null, r1: disk.r1.meta, r2: disk.r2.meta };
    } finally { await fs.rm(root, { recursive: true, force: true }); }
}
test('첫 옮기기가 겹쳐도 새 페이지에서 바꾼 방 설정이 남아요 (먼저 말 걸기 · 번역 · 단체방 · 옛 탭이 끈 것)', async () => {
    const off = await race('off');
    assert.deepEqual([off.error, off.r1.autonomousMessages, !!off.r2.autonomousDailyBudget], [null, false, true]);   // (일꾼이 센 것도 남아요)
    const tr = await race('tr');
    assert.deepEqual([tr.error, tr.r1.translationOutputTargetLang], [null, 'fr']);
    const group = await race('group');
    assert.deepEqual([group.error, 'groupChatMode' in group.r1], [null, false]);
    // (옛 탭이 그 전에 Orbit 전체를 껐어요: 서버 것을 옮기면 꺼진 값이 방에 가요. 새 페이지에서 바꾼 r2의 번역도 남아요)
    const old = await race('oldpage');
    assert.deepEqual([old.error, old.r1.autonomousMessages, old.r2.autonomousMessages, old.r2.autoTranslate], [null, false, false, false]);
});
test('합치기 전 옮기기가 없으면 (prep 없이) 되돌아갔어요: 이 테스트가 그 경우를 지켜요', async () => {
    const bare = (io, at) => K.makeKeep({ api: io, now: at });
    assert.equal((await race('off', bare)).r1.autonomousMessages, true);
});
test('내 쪽만 옮기기 전이어도 (서버 · base는 옮긴 뒤) 합친 저장에 표시와 방 설정이 남아요 (내 쪽도 prep을 거쳐요)', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'na-race-'));
    try {
        const store = openStore(root), seed = oldWorld();
        await store.save('s1', { base: null, parts: K.splitLive(seed.live), chat: 'c1' });
        const api = {
            ping: async () => ({ ok: true }), load: async id => store.load(id), rev: async id => store.revOf(id),
            save: async (id, { base, chat, parts }) => store.save(id, { base, chat, parts: Object.fromEntries(Object.entries(parts).map(([k, s]) => [k, s === null ? null : JSON.parse(s)])) }),
            fork: async (a, b, o) => store.fork(a, b, o), drop: async id => store.drop(id),
        };
        // (the page opens the old save and has not read any room setting yet, so its copy is not moved; then the worker moves and
        //  writes; then the page saves a change elsewhere. base — what the page loaded — is moved by prep, so mine must be too, or
        //  the merge reads "mine took the mark and the room settings away")
        const m = { liveRef: { id: 's1' } }, keep = KO.makeOrbitKeep(api, () => ({ m, mark: 'c1' }));
        await keep.open(m, 'c1');
        const app = makeAutoApp({ store }), e = await app.open('s1');
        S.noteProactive(e.real, 'r2', 'ivo', 'check_in', new Date());
        await app.write(e);
        const w = m.live.world;
        assert.equal(w[L.ROOM_META_MARK], undefined);                                  // (still not moved here)
        w.messenger.rooms.r1.messages[0].text = 'hi there';
        const r = await keep.onSave();
        const world = K.joinLive((await store.load('s1')).parts).world;
        assert.deepEqual([r?.error?.message || null, world[L.ROOM_META_MARK], world.messenger.rooms.r1.meta?.autonomousMessages, !!world.messenger.rooms.r2.meta?.autonomousDailyBudget, world.messenger.rooms.r1.messages[0].text],
            [null, 1, true, true, 'hi there']);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('prep은 받은 것을 고치지 않고, 옮긴 저장은 그대로 돌려줘요', () => {
    const live = oldWorld().live, before = JSON.stringify(live);
    const out = S.moveRoomMetaCopy(live);
    assert.equal(JSON.stringify(live), before);
    assert.deepEqual([out.world[L.ROOM_META_MARK], out.world.messenger.rooms.r1.meta.autonomousMessages], [1, true]);
    assert.equal(S.moveRoomMetaCopy(out), out);
});
