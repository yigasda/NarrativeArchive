// 일꾼이 불러올 코드가 있는 곳 (plugin/code.mjs): 실리의 확장 폴더 → 없으면 이 플러그인 폴더. 판이 다른 일꾼은 안 써요 (plugin/host.mjs)
process.env.NA_SCREEN_ANYWHERE = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { codeFor, extensionCode, ownCode, OWN_DIR, WORKER_PROTO } from '../plugin/code.mjs';
import { startAuto } from '../plugin/host.mjs';
import { openStore } from '../plugin/store.mjs';

const mine = JSON.parse(await readFile(path.join(OWN_DIR, 'manifest.json'), 'utf8'));
async function ext(base, name, manifest, worker = true) {
    const dir = path.join(base, name);
    await mkdir(path.join(dir, 'plugin'), { recursive: true });
    await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
    if (worker) await writeFile(path.join(dir, 'plugin', 'worker.mjs'), '');
    return dir;
}

test('확장 폴더 찾기: 사용자의 것 → 모든 사용자의 것. 이름이 달라도 manifest(이름 · 주소)로, plugin/worker.mjs가 있어야 해요. 없으면 이 플러그인 폴더', async t => {
    const tmp = await mkdtemp(path.join(tmpdir(), 'na-code-')); t.after(() => rm(tmp, { recursive: true, force: true }));
    const st = path.join(tmp, 'st'), user = { directories: { root: path.join(tmp, 'u'), extensions: path.join(tmp, 'u', 'extensions') } };
    const global = path.join(st, 'public', 'scripts', 'extensions', 'third-party');
    // 아무것도 없으면 이 플러그인 폴더
    assert.deepEqual(await codeFor(user, { stRoot: st }), await ownCode());
    assert.equal((await ownCode()).version, mine.version);
    // 다른 확장 · 옛 확장(worker.mjs 없음)은 안 써요
    await ext(user.directories.extensions, 'Other', { ...mine, display_name: 'other' });
    await ext(user.directories.extensions, 'Old', { ...mine, version: '3.0.0' }, false);
    assert.equal((await codeFor(user, { stRoot: st })).from, 'plugin');
    // 모든 사용자의 것
    const g = await ext(global, 'NarrativeArchive', { ...mine, version: '9.9.1' });
    assert.deepEqual(await codeFor(user, { stRoot: st }), { dir: g, version: '9.9.1', from: 'extension' });
    // 사용자의 것이 먼저 (저장소 이름이 달라도)
    const u = await ext(user.directories.extensions, 'my-fork', { ...mine, version: '9.9.2' });
    assert.deepEqual(await codeFor(user, { stRoot: st }), { dir: u, version: '9.9.2', from: 'extension' });
    // 전에 못 뜬 판은 건너뛰어요
    assert.equal((await codeFor(user, { stRoot: st, skip: c => c.version === '9.9.2' })).from, 'plugin');
    // 이어 둔 폴더(ln -s)도 찾아요. 이 플러그인 폴더 자신은 확장으로 안 봐요
    assert.equal(await extensionCode([path.dirname(OWN_DIR)]), null);
    const linked = path.join(tmp, 'linked'); await mkdir(linked); await symlink(OWN_DIR, path.join(linked, 'NarrativeArchive'));
    assert.deepEqual(await extensionCode([linked]), { dir: OWN_DIR, version: mine.version, from: 'extension' });
});

test('일꾼: 확장 폴더의 코드로 떠요. 말의 판(WORKER_PROTO)이 다른 일꾼은 안 써요', async t => {
    const tmp = await mkdtemp(path.join(tmpdir(), 'na-code-')); t.after(() => rm(tmp, { recursive: true, force: true }));
    const store = openStore(path.join(tmp, 'root'));
    // 이 저장소를 확장 폴더로: 뜨고, 말을 주고받아요
    const a = startAuto({ root: path.join(tmp, 'root'), store, schedule: false, code: { dir: OWN_DIR, version: mine.version, from: 'extension' } });
    t.after(() => a.stop());
    assert.equal(await a.ready, true);
    assert.deepEqual(a.code, { dir: OWN_DIR, version: mine.version, from: 'extension' });
    assert.deepEqual(await a.list(), []);
    // 다른 판의 일꾼
    const odd = path.join(tmp, 'odd'); await mkdir(path.join(odd, 'plugin'), { recursive: true });
    await writeFile(path.join(odd, 'plugin', 'worker.mjs'), `import { parentPort } from 'node:worker_threads'; parentPort.postMessage({ ready: true, proto: ${WORKER_PROTO + 1} }); setInterval(() => {}, 1000);`);
    const b = startAuto({ root: path.join(tmp, 'root'), store, schedule: false, code: { dir: odd, version: 'x', from: 'extension' } });
    t.after(() => b.stop());
    await assert.rejects(b.ready, /판이 다릅니다/);
    assert.equal(b.alive(), false);
});

test('사용자마다 일꾼 하나: 확장의 버전이 바뀌면 다시 띄워요. 확장의 코드로 못 뜨면 그 판은 버리고 플러그인 폴더의 것으로. 같이 온 요청은 하나를 기다려요', async () => {
    const { makeAutoFor } = await import('../plugin/code.mjs');
    let code = { dir: '/ext', version: '1', from: 'extension' };
    const started = [], stopped = [];
    const mk = (c, ok = true) => { const a = { code: c, live: true, alive: () => a.live, stop: async () => { a.live = false; stopped.push(c.version); }, ready: ok ? Promise.resolve(true) : Promise.reject(new Error('no')) }; a.ready.catch(() => { a.live = false; }); return a; };
    const bad = new Set();
    const autoFor = makeAutoFor({ on: () => true, find: async (u, { skip }) => (skip(code) ? { dir: '/own', version: 'p', from: 'plugin' } : code), start: async (root, c) => { started.push(c.version); return mk(c, !bad.has(c.version)); } });
    const user = { directories: { root: '/u' } };
    assert.equal(await autoFor({ directories: {} }), null);
    const [a1, a2] = await Promise.all([autoFor(user), autoFor(user)]);
    assert.equal(a1, a2); assert.deepEqual(started, ['1']);
    assert.equal(await autoFor(user), a1);
    // 확장이 업데이트됨
    code = { dir: '/ext', version: '2', from: 'extension' };
    const b = await autoFor(user);
    assert.notEqual(b, a1); assert.deepEqual([started, stopped], [['1', '2'], ['1']]);
    // 새 판이 못 뜸 → 그 판은 버리고 플러그인 폴더의 것
    code = { dir: '/ext', version: '3', from: 'extension' }; bad.add('3');
    const c = await autoFor(user);
    await c.ready.catch(() => {}); await new Promise(r => setTimeout(r, 0));
    const d = await autoFor(user);
    assert.equal(d.code.from, 'plugin'); assert.deepEqual(started, ['1', '2', '3', 'p']);
    assert.equal(await autoFor(user), d);
    // 실리 서버 밖이면 없음
    assert.equal(await makeAutoFor({ on: () => false, start: async () => null })(user), null);
});
