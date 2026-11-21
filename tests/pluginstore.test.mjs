// 서버 플러그인의 저장 (plugin/store.mjs · plugin/index.mjs): 조각 저장 · rev 확인 · 분기 복사 · 지우기. 임시 폴더에서 돌려요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore, StoreError } from '../plugin/store.mjs';
import * as plugin from '../plugin/index.mjs';

const fresh = async () => { const root = await mkdtemp(path.join(tmpdir(), 'na-store-')); return { root, s: openStore(root), done: () => rm(root, { recursive: true, force: true }) }; };
const code = async (fn, want) => { try { await fn(); } catch (err) { assert.ok(err instanceof StoreError, String(err)); assert.equal(err.code, want); return err; } assert.fail(`expected ${want}`); };

test('조각 저장: 처음엔 base 없이, 그 뒤엔 본 rev로. 바뀐 조각만 다시 쓰고, null은 그 조각을 지워요', async () => {
    const { root, s, done } = await fresh();
    try {
        assert.equal(await s.load('w1'), null); assert.equal(await s.revOf('w1'), null);
        assert.deepEqual(await s.save('w1', { parts: { core: { persona: 'Ren' }, 'room:r1': { messages: [{ text: 'hi' }] }, 'phone:mara': { owner: 'Mara' } }, chat: 'chat-A' }), { rev: 1 });
        assert.deepEqual(await s.load('w1'), { rev: 1, chat: 'chat-A', parts: { core: { persona: 'Ren' }, 'room:r1': { messages: [{ text: 'hi' }] }, 'phone:mara': { owner: 'Mara' } } });
        const dir = path.join(root, 'NarrativeArchive', 'orbit', 'w1'), stamp = async () => Object.fromEntries(await Promise.all((await readdir(dir)).map(async f => [f, await readFile(path.join(dir, f), 'utf8')])));
        const before = await stamp();
        // 방 하나만 바꿔요: 다른 조각의 파일은 그대로
        assert.deepEqual(await s.save('w1', { base: 1, parts: { 'room:r1': { messages: [{ text: 'hi' }, { text: 'yo' }] } } }), { rev: 2 });
        const after = await stamp(), changed = Object.keys(after).filter(f => after[f] !== before[f]);
        assert.equal(changed.length, 2); assert.ok(changed.includes('index.json'));
        assert.equal((await s.load('w1')).parts['room:r1'].messages.length, 2);
        assert.equal((await s.load('w1')).chat, 'chat-A');
        // 조각 지우기
        assert.deepEqual(await s.save('w1', { base: 2, parts: { 'phone:mara': null, 'nothing': null } }), { rev: 3 });
        assert.deepEqual(Object.keys((await s.load('w1')).parts).sort(), ['core', 'room:r1']);
        assert.equal((await readdir(dir)).filter(f => f.endsWith('.tmp')).length, 0);
        assert.equal((await readdir(dir)).length, 3);
        // 이름이 길거나 이상해도 파일 이름은 안전해요
        await s.save('w1', { base: 3, parts: { '../../etc/passwd': 1, '방:한글 이름/슬래시': 2 } });
        assert.ok((await readdir(dir)).every(f => /^(index|p_[0-9a-f]{24})\.json$/.test(f)));
        assert.equal((await s.load('w1')).parts['../../etc/passwd'], 1);
    } finally { await done(); }
});

test('그사이 다른 쪽이 저장했으면 거절해요(409, 지금 rev): 아무것도 안 바뀌어요', async () => {
    const { s, done } = await fresh();
    try {
        await s.save('w1', { parts: { core: 1 } });
        await s.save('w1', { base: 1, parts: { core: 2 } });
        const err = await code(() => s.save('w1', { base: 1, parts: { core: 3 } }), 409);
        assert.equal(err.rev, 2); assert.equal((await s.load('w1')).parts.core, 2);
        // 있는 저장에 base 없이(처음인 줄 알고) · 없는 저장에 base를 주고
        assert.equal((await code(() => s.save('w1', { parts: { core: 9 } }), 409)).rev, 2);
        assert.equal((await code(() => s.save('new', { base: 4, parts: { core: 9 } }), 409)).rev, null);
        assert.equal(await s.load('new'), null);
        // 한꺼번에 부른 저장: 하나만 되고 나머지는 거절 (같은 rev를 둘이 쓰지 않아요)
        const got = await Promise.allSettled([1, 2, 3].map(n => s.save('w1', { base: 2, parts: { core: `x${n}` } })));
        assert.deepEqual(got.map(r => r.status).sort(), ['fulfilled', 'rejected', 'rejected']);
        assert.equal(await s.revOf('w1'), 3);
    } finally { await done(); }
});

test('분기한 채팅의 몫: 통째로 복사하고 그 뒤로는 따로 가요; 지우기', async () => {
    const { s, done } = await fresh();
    try {
        await s.save('a', { parts: { core: { n: 1 }, 'room:r': [1, 2] }, chat: 'chat-A' });
        assert.deepEqual(await s.fork('a', 'b', { chat: 'chat-B' }), { rev: 1 });
        assert.deepEqual(await s.load('b'), { rev: 1, chat: 'chat-B', parts: { core: { n: 1 }, 'room:r': [1, 2] } });
        await s.save('b', { base: 1, parts: { core: { n: 2 } } });
        assert.equal((await s.load('a')).parts.core.n, 1); assert.equal((await s.load('a')).chat, 'chat-A');
        await code(() => s.fork('a', 'b'), 409); await code(() => s.fork('none', 'c'), 404); await code(() => s.fork('a', 'a'), 400);
        assert.equal(await s.drop('a'), true); assert.equal(await s.drop('a'), false);
        assert.equal(await s.load('a'), null); assert.equal((await s.load('b')).parts.core.n, 2);
    } finally { await done(); }
});

test('맞지 않는 이름 · 조각은 거절해요; 깨진 index는 없는 저장으로 봐요', async () => {
    const { root, s, done } = await fresh();
    try {
        for (const id of ['', '../x', 'a/b', 'a b', 'x'.repeat(81), null]) await code(() => s.save(id, { parts: { core: 1 } }), 400);
        await code(() => s.load('..'), 400);
        await code(() => s.save('w', { parts: [] }), 400); await code(() => s.save('w', { parts: null }), 400);
        await code(() => s.save('w', { parts: { '': 1 } }), 400); await code(() => s.save('w', { parts: { ['n'.repeat(201)]: 1 } }), 400);
        assert.equal(await s.load('w'), null);
        await s.save('w', { parts: { core: 1 } });
        await writeFile(path.join(root, 'NarrativeArchive', 'orbit', 'w', 'index.json'), '{ broken');
        await assert.rejects(() => s.load('w'));
        await writeFile(path.join(root, 'NarrativeArchive', 'orbit', 'w', 'index.json'), '{"v":99}');
        assert.equal(await s.load('w'), null);
    } finally { await done(); }
});

test('플러그인: 실리가 요구하는 모양(info · init)이고, 길마다 그 사용자의 폴더에만 써요', async () => {
    assert.deepEqual(Object.keys(plugin.info).sort(), ['description', 'id', 'name']);
    assert.match(plugin.info.id, /^[a-z0-9_-]+$/);
    const routes = {}, router = { get: (p, h) => { routes[`GET ${p}`] = h; }, post: (p, h) => { routes[`POST ${p}`] = h; } };
    const log = console.log; console.log = () => {};
    try { await plugin.init(router); } finally { console.log = log; }
    assert.deepEqual(Object.keys(routes).sort(), ['GET /ping', 'POST /store/drop', 'POST /store/fork', 'POST /store/load', 'POST /store/rev', 'POST /store/save']);
    const a = await fresh(), b = await fresh();
    const call = async (route, root, body) => { const res = { code: 200, status(c) { this.code = c; return this; }, json(v) { this.body = v; return this; } }; await routes[route]({ body, user: root ? { directories: { root } } : undefined }, res); return res; };
    try {
        assert.equal((await call('GET /ping', a.root)).body.ok, true);
        assert.deepEqual((await call('POST /store/save', a.root, { id: 'w', parts: { core: 'A' }, chat: 'c' })).body, { rev: 1 });
        assert.deepEqual((await call('POST /store/load', a.root, { id: 'w' })).body, { rev: 1, chat: 'c', parts: { core: 'A' } });
        // 다른 사용자는 못 봐요
        assert.equal((await call('POST /store/load', b.root, { id: 'w' })).code, 404);
        // 거절은 상태 코드와 이유로, rev도 같이
        const late = await call('POST /store/save', a.root, { id: 'w', base: 7, parts: { core: 'B' } });
        assert.deepEqual([late.code, late.body.rev], [409, 1]); assert.match(late.body.error, /다른 곳에서 저장/);
        assert.equal((await call('POST /store/save', a.root, { id: '../x', parts: {} })).code, 400);
        assert.equal((await call('POST /store/load', null, { id: 'w' })).code, 401);
        assert.deepEqual((await call('POST /store/rev', a.root, { id: 'w' })).body, { rev: 1 });
        assert.deepEqual((await call('POST /store/fork', a.root, { from: 'w', to: 'w2' })).body, { rev: 1 });
        assert.deepEqual((await call('POST /store/drop', a.root, { id: 'w' })).body, { dropped: true });
    } finally { await a.done(); await b.done(); }
});
