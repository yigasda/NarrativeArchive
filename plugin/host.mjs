// 플러그인 본체 쪽: 사용자 한 명의 일꾼 스레드를 띄우고 말을 주고받아요 (docs/PHONE2-PLAN.md "서버 플러그인" 3-2b).
// 일꾼(plugin/worker.mjs)이 마리나라의 스케줄러와 진짜 답장 코드를 돌려요. 본체는 저장을 대신 해 주고, 브라우저가 알린 것을 전해요.
//   startAuto({ root, store, bridge, schedule, code }) → { ready, presence(sid, status), status(sid), wrote(), stop(), alive(), code, … }
//   code: 일꾼이 불러올 코드 { dir, version, from } (plugin/code.mjs). 없으면 이 플러그인 폴더의 것
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { WORKER_PROTO } from './code.mjs';

export function startAuto({ root, store, bridge = null, schedule = true, code = null } = {}) {
    const url = code?.dir ? pathToFileURL(path.join(code.dir, 'plugin', 'worker.mjs')) : new URL('./worker.mjs', import.meta.url);
    const worker = new Worker(url, { workerData: { root, bridge, schedule, from: code?.from || 'plugin' } });
    let seq = 0, live = true, readyOk, readyNo;
    const pending = new Map();
    const ready = new Promise((ok, no) => { readyOk = ok; readyNo = no; });
    ready.catch(() => {});
    // 일꾼이 부탁하는 저장 일
    const ops = { list: () => store.list(), revOf: id => store.revOf(id), load: id => store.load(id), save: (id, o) => store.save(id, o) };
    worker.on('message', async m => {
        // (a worker that speaks another version of these messages is not used: plugin/code.mjs WORKER_PROTO)
        if (m?.ready) { if (m.proto === WORKER_PROTO) readyOk(true); else { const err = new Error(`작업 스레드의 판이 다릅니다 (${m.proto ?? '?'})`); gone(err); worker.terminate().catch(() => {}); } return; }
        if (m?.reply) {
            const p = pending.get(m.reply); pending.delete(m.reply);
            if (p) { if (m.ok) p.ok(m.value); else p.no(Object.assign(new Error(m.error?.message || 'worker error'), { statusCode: m.error?.statusCode })); }
            return;
        }
        if (!m?.id || !ops[m.op]) return;
        try { worker.postMessage({ id: m.id, ok: true, value: await ops[m.op](...(m.args || [])) }); }
        catch (err) { worker.postMessage({ id: m.id, ok: false, error: { message: String(err?.message || err), code: err?.code, rev: err?.rev } }); }
    });
    const gone = err => { live = false; readyNo(err); for (const p of pending.values()) p.no(err); pending.clear(); };
    worker.on('error', err => { console.error('[narrative-archive plugin] 작업 스레드 오류', err); gone(err instanceof Error ? err : new Error(String(err))); });
    worker.on('exit', code => { if (live) gone(new Error(`작업 스레드가 종료되었습니다 (${code})`)); });
    // 일꾼에 시키고 답을 기다려요
    const ask = (cmd, more = {}) => ready.then(() => new Promise((ok, no) => { if (!live) { no(new Error('작업 스레드가 없습니다.')); return; } const rid = ++seq; pending.set(rid, { ok, no }); worker.postMessage({ cmd, rid, ...more }); }));
    return {
        ready, code,
        alive: () => live,
        // 브라우저가 이 저장을 열어 두고 있어요
        presence: (sid, status) => ask('presence', { sid, status }),
        // 방마다 서버가 돌릴 수 있나
        status: sid => ask('status', { sid }),
        // 방 자물쇠: 브라우저 탭이 이 저장의 그 방에서 답장을 만들려고 해요 → { ok } | { ok: false, by } (일꾼이 쥐고 있어요) · 이어 잡기 · 다 했어요
        claim: (sid, room, by) => ask('claim', { sid, room, by }),
        renew: (sid, room, by) => ask('renew', { sid, room, by }),
        release: (sid, room, by) => ask('release', { sid, room, by }),
        // 브라우저가 저장했어요 (스케줄러의 "그사이 바뀐 것 없음" 판단이 따라가요)
        wrote: () => { if (live) worker.postMessage({ cmd: 'wrote' }); },
        // (one step at a time, for the tests and for checking by hand: what the scheduler does by itself)
        list: () => ask('list'), inject: (url, payload) => ask('inject', { url, payload }), sweep: () => ask('sweep'), unread: (id, characterId) => ask('unread', { id, characterId }),
        async stop() {
            if (!live) return;
            try { await Promise.race([ask('stop'), new Promise(r => setTimeout(r, 3000))]); } catch { /* going away anyway */ }
            live = false;
            await worker.terminate();
        },
    };
}
