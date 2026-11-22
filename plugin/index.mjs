// NarrativeArchive의 실리 서버 플러그인. 실리 서버 안에서 돌아요(브라우저를 닫아도 돌아요).
// 지금 하는 일: Orbit(실시간 폰) 데이터를 실리 채팅 파일 밖에 조각으로 저장하기 (plugin/store.mjs).
// 깔기: 이 저장소를 실리의 plugins 폴더에 받고(git clone), 실리 config.yaml에서 enableServerPlugins: true.
// 길은 /api/plugins/narrative-archive/… 이고, 실리의 로그인 · CSRF 확인을 지난 요청만 와요(req.user가 그 사용자).

import { openStore, StoreError, STORE } from './store.mjs';

export const info = { id: 'narrative-archive', name: 'NarrativeArchive', description: 'Orbit 저장 · 스케줄 (NarrativeArchive 확장의 서버 쪽)' };
export const VERSION = 1;

const stores = new Map();
const storeFor = req => { const root = req.user?.directories?.root; if (!root) throw new StoreError(401, '사용자 폴더를 알 수 없어요'); return stores.get(root) || stores.set(root, openStore(root)).get(root); };
const run = job => async (req, res) => {
    try { res.json(await job(req.body || {}, storeFor(req), req)); }
    catch (err) {
        const code = err instanceof StoreError ? err.code : 500;
        if (code === 500) console.error('[narrative-archive plugin]', err);
        res.status(code).json({ error: String(err?.message || err), ...(err instanceof StoreError && err.rev !== undefined ? { rev: err.rev } : {}) });
    }
};

export async function init(router) {
    router.get('/ping', (req, res) => res.json({ ok: true, version: VERSION, store: STORE.v }));
    router.post('/store/load', run(async ({ id }, s) => { const got = await s.load(id); if (!got) throw new StoreError(404, '없는 저장이에요'); return got; }));
    router.post('/store/rev', run(async ({ id }, s) => ({ rev: await s.revOf(id) })));
    router.post('/store/save', run(async ({ id, base, parts, chat }, s) => s.save(id, { base, parts, chat })));
    router.post('/store/fork', run(async ({ from, to, chat }, s) => s.fork(from, to, { chat })));
    router.post('/store/drop', run(async ({ id }, s) => ({ dropped: await s.drop(id) })));
    console.log('[narrative-archive plugin] ready');
}
export async function exit() { /* (nothing running yet) */ }
