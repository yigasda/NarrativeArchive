// 일꾼 스레드의 들머리 (docs/PHONE2-PLAN.md "서버 플러그인" 3-2b). plugin/host.mjs가 띄워요.
// 순서가 중요해요: 먼저 "아무것도 안 하는 화면"을 끼우고(screen.mjs), 그다음에 진짜 답장 코드를 불러요(work.mjs).
// 저장은 본체에 부탁해요 (저장이 한 곳에만 있어야 rev가 안 꼬여요). 실리 서버로 가는 요청(/api/… · /user/…)은 다리로 넘겨요.
import './screen.mjs';
import { parentPort, workerData } from 'node:worker_threads';

const { root, bridge = null, schedule = true, from = 'plugin' } = workerData;
// (a promise nobody waits for that fails — SillyTavern's own code starts some without await, as its getStatusTextgen does its model list
//  loaders —: in the browser that is one "Uncaught (in promise)" line in the console and the page goes on. Node would end this thread.
//  Written to SillyTavern's window instead, once for the same text, and the worker goes on. Only the first line: an error may carry a reply's body)
const uncaught = new Set();
process.on('unhandledRejection', err => {
    const why = String(err?.stack || err?.message || err).split('\n')[0];
    if (uncaught.has(why)) return;
    if (uncaught.size >= 100) uncaught.delete(uncaught.values().next().value);
    uncaught.add(why);
    console.error('[narrative-archive plugin]', `처리되지 않은 오류가 발생했습니다: ${why}`);
});
let seq = 0, writes = 0;
const waiting = new Map();
// 본체에 부탁하기 → 답
const call = (op, ...args) => new Promise((ok, no) => { const id = ++seq; waiting.set(id, { ok, no }); parentPort.postMessage({ id, op, args }); });
const store = {
    list: () => call('list'), revOf: id => call('revOf', id), load: id => call('load', id),
    save: async (id, o) => { const r = await call('save', id, o); writes += 1; return r; },
    // (how many times this store was written, by the server or the browser: the scheduler's "nothing changed since" gate)
    generation: () => writes,
};
// 주소가 '/'로 시작하는 요청은 실리 서버의 것: 다리로 (본체가 연 로컬 길, 이 사용자의 것으로). 나머지는 그대로 밖으로
const out = globalThis.fetch;
globalThis.fetch = (input, init) => {
    if (typeof input !== 'string' || !input.startsWith('/')) return out(input, init);
    if (!bridge) return Promise.reject(new Error('실리 서버에 연결할 수 없습니다.'));
    return out(bridge.url + input, { ...(init || {}), headers: { ...(init?.headers || {}), 'x-na-token': bridge.token, 'x-na-root': encodeURIComponent(root) } });
};
const st = bridge ? async (url, body) => {
    const r = await globalThis.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let json = null;
    try { json = await r.json(); } catch { /* not JSON */ }
    return { ok: r.ok, status: r.status, json };
} : null;

const work = await (await import('./work.mjs')).startWork({ root, store, st, schedule, from });
const cmds = {
    presence: ({ sid, status }) => work.presence(sid, status),
    status: ({ sid }) => work.status(sid),
    claim: ({ sid, room, by }) => work.claim(sid, room, by),
    renew: ({ sid, room, by }) => work.renew(sid, room, by),
    release: ({ sid, room, by }) => { work.release(sid, room, by); return true; },
    wrote: () => { writes += 1; work.poke(); return writes; },
    stop: () => work.stop(),
    // (for the tests and for checking by hand: one step at a time)
    list: () => work.app.chats.list(),
    inject: ({ url, payload }) => work.app.inject({ method: 'POST', url, payload }),
    sweep: () => work.sweepDue(),
    unread: ({ id, characterId }) => work.app.chats.markAutonomousUnread(id, { characterId }).then(() => true),
};
parentPort.on('message', async m => {
    if (m && m.id && waiting.has(m.id)) {
        const w = waiting.get(m.id); waiting.delete(m.id);
        if (m.ok) w.ok(m.value); else w.no(Object.assign(new Error(m.error?.message || 'store error'), { code: m.error?.code, rev: m.error?.rev }));
        return;
    }
    if (!m || !m.cmd) return;
    try { const value = await (cmds[m.cmd] ? cmds[m.cmd](m) : Promise.reject(new Error(`unknown command ${m.cmd}`))); if (m.rid) parentPort.postMessage({ reply: m.rid, ok: true, value }); }
    catch (err) { if (m.rid) parentPort.postMessage({ reply: m.rid, ok: false, error: { message: String(err?.message || err), statusCode: err?.statusCode } }); }
});
// (the version of these messages: plugin/code.mjs WORKER_PROTO. The host uses no worker of another one)
parentPort.postMessage({ ready: true, proto: 1 });
