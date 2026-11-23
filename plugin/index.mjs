// NarrativeArchive의 실리 서버 플러그인. 실리 서버 안에서 돌아요(브라우저를 닫아도 돌아요).
// 지금 하는 일: Orbit(실시간 폰) 데이터를 실리 채팅 파일 밖에 조각으로 저장하기 (plugin/store.mjs).
// 깔기: 이 저장소를 실리의 plugins 폴더에 받고(git clone), 실리 config.yaml에서 enableServerPlugins: true.
// 길은 /api/plugins/narrative-archive/… 이고, 실리의 로그인 · CSRF 확인을 지난 요청만 와요(req.user가 그 사용자).

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { openStore, StoreError, STORE } from './store.mjs';
import { soundStore, SoundError } from './sound.mjs';
import { makeAutoFor } from './code.mjs';

export const info = { id: 'narrative-archive', name: 'NarrativeArchive', description: 'Orbit 저장 · 스케줄 (NarrativeArchive 확장의 서버 쪽)' };
export const VERSION = 2;

const stores = new Map();
const storeAt = root => stores.get(root) || stores.set(root, openStore(root)).get(root);
const storeFor = req => { const root = req.user?.directories?.root; if (!root) throw new StoreError(401, '사용자 폴더를 찾을 수 없습니다.'); return storeAt(root); };
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
    if (!bridging) bridging = import('./bridge.mjs').then(m => m.startBridge({ userOf })).then(b => { bridge = b; return b; }, err => { console.warn('[narrative-archive plugin] 실리 서버 연결을 열지 못했습니다. 사용자 지정 API 방만 실행합니다:', String(err?.message || err)); return null; });
    return bridging;
}
// 그 사용자의 일꾼 (없으면 띄워요) → 일꾼 | null (실리 서버 안이 아니면)
const autoFor = makeAutoFor({
    on: () => inside, autos, users,
    start: async (root, code) => { const b = await bridgeOnce(); const { startAuto } = await import('./host.mjs'); return startAuto({ root, store: storeAt(root), bridge: b ? { url: b.url, token: b.token } : null, code }); },
    log: err => console.error('[narrative-archive plugin] 자율 메시지 스케줄러를 시작하지 못했습니다', err),
});
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
    } catch (err) { console.warn('[narrative-archive plugin] 실리 사용자를 읽지 못했습니다:', String(err?.message || err)); }
}

export async function init(router) {
    router.get('/ping', (req, res) => { autoFor(req.user).catch(() => {}); res.json({ ok: true, version: VERSION, store: STORE.v, auto: inside }); });
    router.post('/store/load', run(async ({ id }, s) => { const got = await s.load(id); if (!got) throw new StoreError(404, '저장을 찾을 수 없습니다.'); return got; }));
    router.post('/store/rev', run(async ({ id }, s) => ({ rev: await s.revOf(id) })));
    router.post('/store/save', run(async ({ id, base, parts, chat }, s, req) => { const out = await s.save(id, { base, parts, chat }); wrote(req); return out; }));
    router.post('/store/fork', run(async ({ from, to, chat }, s, req) => { const out = await s.fork(from, to, { chat }); wrote(req); return out; }));
    router.post('/store/drop', run(async ({ id }, s, req) => { const out = { dropped: await s.drop(id) }; wrote(req); return out; }));
    // 브라우저가 이 저장을 열어 두고 있어요 (30초마다): 그 방들은 서버가 75초 동안 안 건드려요 → { on: 일꾼이 도나, rooms }
    router.post('/auto/presence', run(async ({ id, status }, s, req) => { const a = await autoFor(req.user); if (!a) return { on: false, rooms: 0 }; await a.ready; return { on: true, rooms: await a.presence(String(id || ''), status) }; }));
    // 이 저장의 방마다 서버가 실리를 닫은 동안 돌릴 수 있나 → { on, rooms: [{ id, room, can, why }] }
    router.post('/auto/status', run(async ({ id }, s, req) => { const a = await autoFor(req.user); if (!a) return { on: false, rooms: [] }; await a.ready; return { on: true, rooms: await a.status(String(id || '')) }; }));
    // 방 자물쇠 (plugin/lock.mjs: 마리나라의 채팅마다 하나뿐인 생성 자물쇠): 이 탭이 이 저장의 그 방에서 답장을 만들어요 → { ok } | { ok: false, by }
    //   { id: 저장 id, room: 방 id, by: 탭 이름, renew: 이어 잡기만 }. 이름은 늘 'browser:…' — 일꾼의 것('server')은 여기서 못 잡아요.
    //   일꾼이 없으면 늘 { ok: true }: 그때는 브라우저가 다 해요
    const tab = by => `browser:${String(by || '').replace(/^browser:/, '').replace(/[^\w-]/g, '').slice(0, 40) || 'tab'}`;
    router.post('/auto/claim', run(async ({ id, room, by, renew }, s, req) => {
        const a = await autoFor(req.user);
        if (!a) return { ok: true };
        await a.ready;
        if (renew === true) return { ok: !!await a.renew(String(id || ''), String(room || ''), tab(by)) };
        return a.claim(String(id || ''), String(room || ''), tab(by));
    }));
    router.post('/auto/release', run(async ({ id, room, by }, s, req) => { const a = await autoFor(req.user); if (!a) return { ok: true }; await a.ready; await a.release(String(id || ''), String(room || ''), tab(by)); return { ok: true }; }));
    // 사용자 지정 알림음 (plugin/sound.mjs: 마리나라 notification-sound.routes.ts). 소리 파일 하나를 사용자 폴더에.
    //   GET /sound → { configured, url, updatedAt } · POST /sound/upload ('avatar' 칸의 파일: 실리의 multer가 받아 둔 것) → 같은 모양
    //   POST /sound/delete → 같은 모양(없음) · GET /sound/file → 그 소리 (마리나라는 DELETE / 와 204예요)
    const soundOf = req => { const root = req.user?.directories?.root; if (!root) throw new SoundError(401, '사용자 폴더를 찾을 수 없습니다.'); return soundStore(root); };
    const soundRun = job => async (req, res) => {
        try { res.json(await job(soundOf(req), req)); }
        catch (err) {
            const code = err instanceof SoundError ? err.code : 500;
            if (code === 500) console.error('[narrative-archive plugin]', err);
            res.status(code).json({ error: String(err?.message || err) });
        }
    };
    router.get('/sound', soundRun(s => s.status()));
    router.post('/sound/upload', soundRun((s, req) => {
        const f = req.file;
        return s.upload({ name: f?.originalname, tmp: f ? path.join(f.destination, f.filename) : '', size: f?.size });
    }));
    router.post('/sound/delete', soundRun(async s => { await s.remove(); return { configured: false, url: null, updatedAt: null }; }));
    router.get('/sound/file', async (req, res) => {
        let got = null;
        try { got = await soundOf(req).file(); } catch (err) { console.error('[narrative-archive plugin]', err); res.status(500).json({ error: '알림음을 읽을 수 없습니다.' }); return; }
        if (!got) { res.status(404).json({ error: '사용자 지정 알림음이 없습니다.' }); return; }
        res.set({ 'Content-Type': got.mimeType, 'Content-Length': String(got.size), 'Content-Disposition': 'inline', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
        const stream = got.handle.createReadStream();
        stream.on('error', () => { if (!res.headersSent) res.status(500).end(); else res.end(); });
        stream.pipe(res);
    });
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
