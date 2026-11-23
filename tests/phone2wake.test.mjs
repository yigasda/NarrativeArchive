// 2026-11-22에 실제로 생긴 일을 그대로: 화면이 꺼진 동안 서버 일꾼이 늦은 답장을 보냈는데, 화면을 켜자마자 브라우저의 30초 틱이
// 아직 서버 것을 받기 전의 사본으로 같은 말에 또 답했어요. 브라우저 쪽(src/phone2keepon.js · phone2tick.js · phone2go.js)과
// 서버 일꾼(plugin/)을 한 저장에 같이 붙여서, 그 순서대로 해 봐요. 모델은 가짜 HTTP 서버. 예시 캐릭터만 써요.
process.env.NA_SCREEN_ANYWHERE = '1';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore, StoreError } from '../plugin/store.mjs';
import { startAuto } from '../plugin/host.mjs';
const { setContext } = await import('../plugin/screen.mjs');
const page = { hidden: false, events: [], details: [], addEventListener() {}, dispatchEvent(e) { this.events.push(e?.type); if (e?.detail) this.details.push(e.detail); return true; }, querySelectorAll: () => [] };
globalThis.document = page;
const { startFresh, putLivePhone, ensureRoom, sendLive, liveWorld, enqueueJob } = await import('../src/phone2store.js');
const KO = await import('../src/phone2keepon.js');
const core = await import('../src/core.js');
const G = await import('../src/phone2go.js');
const TICK = await import('../src/phone2tick.js');
after(() => { setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

const listen = handler => new Promise(ok => { const s = http.createServer(handler); s.listen(0, '127.0.0.1', () => ok(s)); });
const bodyOf = req => new Promise(ok => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { ok(JSON.parse(b || 'null')); } catch { ok(b); } }); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, ms = 5000) => { const end = Date.now() + ms; while (!f()) { if (Date.now() > end) throw new Error('timed out'); await sleep(10); } };

// 한 판: 실리 폴더 · 저장 · 일꾼 · 가짜 모델 · 브라우저의 채팅 하나 (Ren과 Mara, 먼저 말 걸기 꺼짐: 늦은 답장만 봐요)
async function stage(t, { hoursAgo = 1 } = {}) {
    const root = await mkdtemp(path.join(tmpdir(), 'na-wake-'));
    const asked = [];
    let gate = null;
    const model = await listen(async (req, res) => {
        const body = await bodyOf(req);
        asked.push(body);
        if (gate) await gate;
        const n = asked.length;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: [`answer ${n}`], status: '' }) }, finish_reason: 'stop' }] }));
    });
    const conn = { mode: 'custom', url: `http://127.0.0.1:${model.address().port}/v1`, key: 'K', model: 'fake-model' };
    await writeFile(path.join(root, 'settings.json'), JSON.stringify({ power_user: {}, extension_settings: { narrative_archive: { draftConn: conn } } }));
    await mkdir(path.join(root, 'chats', 'mara'), { recursive: true }); await writeFile(path.join(root, 'chats', 'mara', 'chat-1.jsonl'), '{}\n');
    const store = openStore(root), auto = startAuto({ root, store, schedule: false });
    t.after(async () => { await auto.stop(); model.close(); await rm(root, { recursive: true, force: true }); });
    await auto.ready;
    // 브라우저의 요청 → 플러그인의 길 (plugin/index.mjs가 하는 일 그대로. "보고 있어요"는 일꾼에 안 전해요: 화면이 꺼진 지 75초가 지난 것처럼)
    const calls = [];
    const routes = {
        '/ping': async () => ({ ok: true }), '/store/load': async ({ id }) => { const got = await store.load(id); if (!got) throw new StoreError(404, 'none'); return got; },
        '/store/rev': async ({ id }) => ({ rev: await store.revOf(id) }), '/store/save': async ({ id, base, parts, chat }) => { const out = await store.save(id, { base, parts, chat }); auto.wrote(); return out; },
        '/auto/presence': async () => ({ on: true, rooms: 1 }), '/auto/status': async ({ id }) => ({ on: true, rooms: await auto.status(id) }),
        '/auto/claim': async ({ id, room, by, renew }) => (renew ? { ok: !!await auto.renew(id, room, by) } : auto.claim(id, room, by)),
        '/auto/release': async ({ id, room, by }) => { await auto.release(id, room, by); return { ok: true }; },
    };
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        if (typeof url !== 'string' || !url.startsWith('/api/plugins/narrative-archive')) return realFetch(url, init);
        const p = url.slice('/api/plugins/narrative-archive'.length), body = init.body ? JSON.parse(init.body) : {};
        calls.push([p, body]);
        try { const json = await routes[p](body); return { ok: true, status: 200, json: async () => json }; }
        catch (err) { const code = err instanceof StoreError ? err.code : 500; return { ok: false, status: code, json: async () => ({ error: String(err.message), rev: err.rev }) }; }
    };
    t.after(() => { globalThis.fetch = realFetch; });

    const m = {};
    startFresh(m, { persona: 'Ren', now: Date.now() - 10 * 3600_000 });
    putLivePhone(m, { owner: 'Mara' });
    const room = ensureRoom(m, ['Mara']), w = liveWorld(m), at = Date.now() - hoursAgo * 3600_000;
    sendLive(m, room.id, 'hey', at); room.messages.push({ id: 't2', n: 2, from: 'Mara', text: 'hi', at: at + 60_000 });
    w.presence = { on: false, schedules: {}, overrides: {}, meta: {}, user: {} };
    const ctx = { chatId: 'chat-1', chatMetadata: { narrative_archive: m, integrity: 'mark-1' }, chat: [], name1: 'Ren', characterId: 0, characters: [{ name: 'Mara', avatar: 'mara.png', description: 'Mara is a baker.', data: { name: 'Mara', description: 'Mara is a baker.' } }],
        powerUserSettings: { persona_description: 'Ren is a student.' }, extensionSettings: { narrative_archive: { draftConn: conn } }, saveMetadata: async () => {}, saveSettingsDebounced() {}, getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
        eventSource: { on() {} }, eventTypes: { CHAT_CHANGED: 'chat' }, setExtensionPrompt() {} };
    setContext(ctx);
    KO.keepStart();
    await KO.liveReady();
    await core.saveMeta();
    const sid = m.liveRef.id;
    await KO.keepBeat();
    assert.ok(await G.liveKitRefresh(m)); await core.saveMeta();
    assert.equal((await auto.status(sid))[0].can, true);
    return { store, auto, asked, calls, m, w, room, sid, open: () => { gate = null; }, hold: () => { let go; gate = new Promise(r => { go = r; }); return () => { gate = null; go(); }; } };
}
// 내가 말을 보냈고 Mara는 바빠서 조금 뒤에 답해요 (늦은 답장): 브라우저가 줄 세우고 저장했어요
async function busyReply(S, text, ms = 300) {
    sendLive(S.m, S.room.id, text);
    const job = enqueueJob(S.m, { kind: 'reply', owner: 'Mara', room: S.room.id });
    Object.assign(job, { timed: true, notBefore: Date.now() + ms });
    await core.saveMeta();
    return job;
}
const texts = room => room.messages.map(x => [x.from, x.text]);

test('그날 그대로: 화면이 꺼진 동안 서버가 늦은 답장을 보냈어요 → 화면을 켜자마자 틱이 먼저 돌아도 또 답하지 않아요. 서버의 답장은 바로 보여요', async t => {
    const S = await stage(t);
    const job = await busyReply(S, 'so tired');
    page.hidden = true;
    await sleep(350);
    // 서버: 때가 된 늦은 답장
    assert.equal(await S.auto.sweep(), 1);
    assert.equal(S.asked.length, 1);
    // 브라우저는 아직 몰라요 (그 일이 아직 기다리는 줄 알아요)
    assert.equal(job.state, 'waiting');
    assert.deepEqual(texts(S.room), [['Ren', 'hey'], ['Mara', 'hi'], ['Ren', 'so tired']]);
    // 화면을 켰어요: 알리기(keepBeat)보다 30초 틱이 먼저 돌았어요 — 그날의 순서
    page.hidden = false; page.events.length = 0;
    await TICK.tickOnce();
    assert.equal(S.asked.length, 1, '같은 말에 두 번 답하면 안 돼요');
    assert.deepEqual(texts(S.room), [['Ren', 'hey'], ['Mara', 'hi'], ['Ren', 'so tired'], ['Mara', 'answer 1']]);
    assert.equal(liveWorld(S.m).queue.jobs.find(j => j.id === job.id).state, 'done');
    // (화면에 다시 그리라는 신호가 갔어요)
    assert.ok(page.events.includes('na-live-change'));
    // 그 뒤로도 또 답하지 않아요
    await G.liveGo(S.m);
    await TICK.tickOnce();
    assert.equal(S.asked.length, 1);
    const stored = await S.store.load(S.sid);
    assert.deepEqual(stored.parts[`room/${S.room.id}/0`].map(x => x.text), ['hey', 'hi', 'so tired', 'answer 1']);
});

test('화면을 켰을 때 서버가 그 답장을 만드는 중이면: 브라우저는 그 방을 기다렸다가, 서버 것을 받고 끝내요 (또 답하지 않아요)', async t => {
    const S = await stage(t);
    const live = G.LIVE_GO.retryMs;
    G.LIVE_GO.retryMs = 30;
    t.after(() => { G.LIVE_GO.retryMs = live; });
    const job = await busyReply(S, 'so tired');
    page.hidden = true;
    await sleep(350);
    // 서버가 만드는 중 (모델이 아직 답하지 않았어요)
    const go = S.hold();
    const sweeping = S.auto.sweep();
    await until(() => S.asked.length === 1);
    // 화면을 켰어요: 틱이 돌아요
    page.hidden = false; page.events.length = 0;
    await TICK.tickOnce();
    assert.equal(S.asked.length, 1);
    assert.equal(job.state, 'waiting');
    // (서버가 그 방을 쥐고 있다고 들었어요)
    assert.ok(S.calls.some(([p, b]) => p === '/auto/claim' && b.room === S.room.id));
    // 서버가 끝내요 → 브라우저가 조금 뒤에 다시 해 보고, 서버 것을 받아요
    go();
    assert.equal(await sweeping, 1);
    await until(() => S.room.messages.length === 4);
    await sleep(100);
    assert.equal(S.asked.length, 1);
    assert.deepEqual(texts(S.room), [['Ren', 'hey'], ['Mara', 'hi'], ['Ren', 'so tired'], ['Mara', 'answer 1']]);
    assert.equal(liveWorld(S.m).queue.jobs.find(j => j.id === job.id).state, 'done');
    // (놓았어요: 서버가 다시 잡을 수 있어요)
    assert.deepEqual(await S.auto.claim(S.sid, S.room.id, 'server'), { ok: true });
    await S.auto.release(S.sid, S.room.id, 'server');
});

test('브라우저가 그 방에서 답장을 만드는 동안 서버는 그 방을 건드리지 않아요. 브라우저가 끝내면 놓아요', async t => {
    const S = await stage(t);
    await busyReply(S, 'so tired', 0);
    const go = S.hold();
    const going = G.liveGo(S.m);
    await until(() => S.asked.length === 1);
    // 그사이 서버가 늦은 답장을 돌려 보아요 (브라우저가 쥐고 있어요)
    assert.equal(await S.auto.sweep(), 0);
    assert.equal((await S.auto.claim(S.sid, S.room.id, 'server')).ok, false);
    go();
    const out = await going;
    assert.equal(out.ran, 1);
    assert.equal(S.asked.length, 1);
    await until(() => S.calls.some(([p]) => p === '/auto/release'));
    await sleep(50);
    assert.deepEqual(await S.auto.claim(S.sid, S.room.id, 'server'), { ok: true });
    await S.auto.release(S.sid, S.room.id, 'server');
    // (이어 잡기: 답장 하나마다)
    assert.ok(S.calls.some(([p, b]) => p === '/auto/claim' && b.renew === true && b.room === S.room.id));
});

test('먼저 건 말: 브라우저가 줄 세운 뒤 그 방을 기다리는 사이 서버가 먼저 걸었으면, 브라우저는 또 걸지 않아요', async t => {
    const S = await stage(t);
    // 브라우저: 먼저 걸 때라고 보고 줄 세웠어요 (아직 저장 전)
    const job = enqueueJob(S.m, { kind: 'reply', owner: 'Mara', room: S.room.id });
    job.auto = true;
    // 서버: 같은 때에 먼저 걸었어요
    await S.auto.list();
    const made = await S.auto.inject('/api/generate', { chatId: `${S.w.id}:${S.room.id}`, forCharacterId: 'mara', userStatus: 'idle', userActivity: 'away or offline', autonomous: true, skipPresenceDelay: true, autonomousIntentKey: 'check_in' });
    assert.match(made.payload, /"message_saved"/);
    assert.equal(S.asked.length, 1);
    // 브라우저가 그 방에 들어가요: 서버 것을 받고, 줄 세운 것은 버려요 (모델에 안 물어요)
    const out = await G.liveGo(S.m);
    assert.equal(S.asked.length, 1);
    assert.equal(out.ran, 1);
    assert.deepEqual(texts(S.room), [['Ren', 'hey'], ['Mara', 'hi'], ['Mara', 'answer 1']]);
});

test('먼저 말 걸기 판단도 그 방을 잡고 최신 것을 받은 뒤에: 서버가 그 방을 쥐고 있으면 이번엔 안 보고, 서버가 그사이 먼저 걸었으면 또 걸지 않아요', async t => {
    const S = await stage(t, { hoursAgo: 7 });
    S.w.presence.on = true;
    await core.saveMeta();
    // 서버가 그 방을 쥐고 있어요: 줄 세우지 않아요
    assert.deepEqual(await S.auto.claim(S.sid, S.room.id, 'server'), { ok: true });
    assert.equal(await G.liveAutonomous(S.m), 0);
    assert.equal(S.w.queue.jobs.length, 0);
    await S.auto.release(S.sid, S.room.id, 'server');
    // 서버가 그사이 먼저 걸었어요 (브라우저는 아직 몰라요)
    await S.auto.list();
    const made = await S.auto.inject('/api/generate', { chatId: `${S.w.id}:${S.room.id}`, forCharacterId: 'mara', userStatus: 'idle', userActivity: 'away or offline', autonomous: true, skipPresenceDelay: true, autonomousIntentKey: 'check_in' });
    assert.match(made.payload, /"message_saved"/);
    assert.equal(S.room.messages.length, 2);
    // 그 방을 잡고 받은 뒤에 봐요: 방금 걸었으니 또 걸지 않아요
    assert.equal(await G.liveAutonomous(S.m), 0);
    assert.equal(S.room.messages.length, 3);
    assert.equal(S.w.queue.jobs.filter(j => j.state === 'waiting').length, 0);
    assert.equal(S.asked.length, 1);
});

test('플러그인 요청이 끝나지 않고 걸려도 시간이 지나면 풀려요 (다음 받기 · 알리기를 막지 않아요)', async t => {
    assert.deepEqual(KO.KEEP_LIMIT, { short: 15_000, store: 60_000 });
    const realFetch = globalThis.fetch, seen = [];
    globalThis.fetch = (url, init = {}) => { seen.push(init.signal); return new Promise((ok, no) => { init.signal?.addEventListener('abort', () => no(init.signal.reason)); }); };
    t.after(() => { globalThis.fetch = realFetch; });
    const real = AbortSignal.timeout;
    AbortSignal.timeout = ms => real.call(AbortSignal, Math.min(ms, 30));
    t.after(() => { AbortSignal.timeout = real; });
    const t0 = Date.now();
    assert.deepEqual(await KO.keepAutoStatus(), { on: false, rooms: [] });
    assert.ok(Date.now() - t0 < 2000);
    assert.ok(seen.length >= 1 && seen.every(s => s instanceof AbortSignal));
});
