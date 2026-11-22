// NarrativeArchive의 실리 서버 플러그인. 실리 서버 안에서 돌아요(브라우저를 닫아도 돌아요).
// 지금 하는 일: Orbit(실시간 폰) 데이터를 실리 채팅 파일 밖에 조각으로 저장하기 (plugin/store.mjs).
// 깔기: 이 저장소를 실리의 plugins 폴더에 받고(git clone), 실리 config.yaml에서 enableServerPlugins: true.
// 길은 /api/plugins/narrative-archive/… 이고, 실리의 로그인 · CSRF 확인을 지난 요청만 와요(req.user가 그 사용자).

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { openStore, StoreError, STORE } from './store.mjs';

export const info = { id: 'narrative-archive', name: 'NarrativeArchive', description: 'Orbit 저장 · 스케줄 (NarrativeArchive 확장의 서버 쪽)' };
export const VERSION = 2;

const stores = new Map();
const storeAt = root => stores.get(root) || stores.set(root, openStore(root)).get(root);
const storeFor = req => { const root = req.user?.directories?.root; if (!root) throw new StoreError(401, '사용자 폴더를 알 수 없어요'); return storeAt(root); };
const run = job => async (req, res) => {
    try { res.json(await job(req.body || {}, storeFor(req), req)); }
    catch (err) {
        const code = err instanceof StoreError ? err.code : 500;
        if (code === 500) console.error('[narrative-archive plugin]', err);
        res.status(code).json({ error: String(err?.message || err), ...(err instanceof StoreError && err.rev !== undefined ? { rev: err.rev } : {}) });
    }
};

// ---- 실리를 닫아도 도는 것: 먼저 말 걸기 · 늦은 답장 (docs/PHONE2-PLAN.md "서버 플러그인" 3단계)
// 사용자마다 일꾼 스레드 하나 (plugin/host.mjs). 실리 서버 안에서만 켜요 (실리가 globalThis.DATA_ROOT를 둬요): 테스트에서는 안 켜져요.
const users = new Map(), autos = new Map();
let bridge = null, bridging = null, inside = false;
const userOf = root => users.get(root) || null;
async function bridgeOnce() {
    if (!bridging) bridging = import('./bridge.mjs').then(m => m.startBridge({ userOf })).then(b => { bridge = b; return b; }, err => { console.warn('[narrative-archive plugin] 실리 서버에 잇는 다리를 못 열었어요 (커스텀 API로 나가는 방만 돌아요):', String(err?.message || err)); return null; });
    return bridging;
}
// 그 사용자의 일꾼 (없으면 띄워요) → 일꾼 | null (실리 서버 안이 아니면)
async function autoFor(user) {
    const root = user?.directories?.root;
    if (!inside || !root) return null;
    users.set(root, user);
    const had = autos.get(root);
    if (had?.alive()) return had;
    const b = await bridgeOnce();
    const again = autos.get(root);
    if (again?.alive()) return again;
    const { startAuto } = await import('./host.mjs');
    const auto = startAuto({ root, store: storeAt(root), bridge: b ? { url: b.url, token: b.token } : null });
    autos.set(root, auto);
    auto.ready.then(() => console.log('[narrative-archive plugin] 먼저 말 걸기 일꾼을 켰어요:', path.basename(root)), err => console.error('[narrative-archive plugin] 일꾼을 못 켰어요', err));
    return auto;
}
const wrote = req => { const a = autos.get(req.user?.directories?.root); if (a?.alive()) a.wrote(); };
// 실리를 켰을 때: 브라우저가 한 번도 안 열려도 돌게, 실리의 사용자들을 찾아서 Orbit 저장이 있는 사람의 일꾼을 켜요
async function startAll() {
    try {
        const U = await import(pathToFileURL(path.join(process.cwd(), 'src', 'users.js')).href);
        for (const profile of await U.getAllEnabledUsers()) {
            const directories = U.getUserDirectories(profile.handle);
            if (!directories?.root) continue;
            if ((await storeAt(directories.root).list()).length) await autoFor({ profile, directories });
        }
    } catch (err) { console.warn('[narrative-archive plugin] 실리의 사용자를 못 읽었어요 (브라우저가 열리면 켜요):', String(err?.message || err)); }
}

export async function init(router) {
    router.get('/ping', (req, res) => { autoFor(req.user).catch(() => {}); res.json({ ok: true, version: VERSION, store: STORE.v, auto: inside }); });
    router.post('/store/load', run(async ({ id }, s) => { const got = await s.load(id); if (!got) throw new StoreError(404, '없는 저장이에요'); return got; }));
    router.post('/store/rev', run(async ({ id }, s) => ({ rev: await s.revOf(id) })));
    router.post('/store/save', run(async ({ id, base, parts, chat }, s, req) => { const out = await s.save(id, { base, parts, chat }); wrote(req); return out; }));
    router.post('/store/fork', run(async ({ from, to, chat }, s, req) => { const out = await s.fork(from, to, { chat }); wrote(req); return out; }));
    router.post('/store/drop', run(async ({ id }, s, req) => { const out = { dropped: await s.drop(id) }; wrote(req); return out; }));
    // 브라우저가 이 저장을 열어 두고 있어요 (30초마다): 그 방들은 서버가 75초 동안 안 건드려요 → { on: 일꾼이 도나, rooms }
    router.post('/auto/presence', run(async ({ id, status }, s, req) => { const a = await autoFor(req.user); if (!a) return { on: false, rooms: 0 }; await a.ready; return { on: true, rooms: await a.presence(String(id || ''), status) }; }));
    // 이 저장의 방마다 서버가 실리를 닫은 동안 돌릴 수 있나 → { on, rooms: [{ id, room, can, why }] }
    router.post('/auto/status', run(async ({ id }, s, req) => { const a = await autoFor(req.user); if (!a) return { on: false, rooms: [] }; await a.ready; return { on: true, rooms: await a.status(String(id || '')) }; }));
    inside = typeof globalThis.DATA_ROOT === 'string' && !!globalThis.DATA_ROOT;
    if (inside) startAll();
    console.log('[narrative-archive plugin] ready');
}
export async function exit() {
    const all = [...autos.values()];
    autos.clear();
    await Promise.all(all.map(a => a.stop().catch(() => {})));
    if (bridge) await bridge.close().catch(() => {});
    bridge = null; bridging = null;
}
