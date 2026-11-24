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
import { fakeBridge, stCard, chatFile, stUserDirs } from './stbridge.mjs';
import { soundStore, SoundError } from '../plugin/sound.mjs';
const { setContext } = await import('../plugin/screen.mjs');
const page = { hidden: false, events: [], details: [], addEventListener() {}, dispatchEvent(e) { this.events.push(e?.type); if (e?.detail) this.details.push(e.detail); return true; }, querySelectorAll: () => [] };
globalThis.document = page;
const { startFresh, putLivePhone, ensureRoom, sendLive, liveWorld, enqueueJob } = await import('../src/phone2store.js');
const KO = await import('../src/phone2keepon.js');
const core = await import('../src/core.js');
const G = await import('../src/phone2go.js');
const TICK = await import('../src/phone2tick.js');
const SOUND = await import('../src/phone2sound.js');
const PING = await import('../src/marinara/notification-sound.js');
after(() => { setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

const listen = handler => new Promise(ok => { const s = http.createServer(handler); s.listen(0, '127.0.0.1', () => ok(s)); });
const bodyOf = req => new Promise(ok => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { ok(JSON.parse(b || 'null')); } catch { ok(b); } }); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, ms = 5000) => { const end = Date.now() + ms; while (!f()) { if (Date.now() > end) throw new Error('timed out'); await sleep(10); } };

// 한 판: 실리 폴더 · 저장 · 일꾼 · 가짜 모델 · 브라우저의 채팅 하나 (Ren과 Mara, 먼저 말 걸기 꺼짐: 늦은 답장만 봐요)
async function stage(t, { hoursAgo = 1 } = {}) {
    const root = await mkdtemp(path.join(tmpdir(), 'na-wake-'));
    await stUserDirs(root);   // (SillyTavern's user folders: the worker reads the preset folders each job)
    const asked = [];
    let gate = null;
    const model = await listen(async (req, res) => {
        const body = await bodyOf(req);
        asked.push(body);
        if (gate) await gate;
        // (an automatic translation's request: held while a test holds translations — trGate)
        if (trGate && String(body?.messages?.[0]?.content || '').startsWith('You are a translator')) await trGate;
        const n = asked.length;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: [`answer ${n}`], status: '' }) }, finish_reason: 'stop' }] }));
    });
    const conn = { mode: 'custom', url: `http://127.0.0.1:${model.address().port}/v1`, key: 'K', model: 'fake-model' };
    // (SillyTavern's own: the persona in settings.json, the chat file, the card list through the bridge — read each reply)
    await writeFile(path.join(root, 'settings.json'), JSON.stringify({ user_avatar: 'ren.png', power_user: { personas: { 'ren.png': 'Ren' }, persona_descriptions: { 'ren.png': { description: 'Ren is a student.' } } }, extension_settings: { narrative_archive: { draftConn: conn } } }));
    await mkdir(path.join(root, 'chats', 'mara'), { recursive: true }); await writeFile(path.join(root, 'chats', 'mara', 'chat-1.jsonl'), chatFile());
    const br = await fakeBridge({ cards: () => [stCard('Mara')], avatars: () => ['ren.png'] });
    const store = openStore(root), auto = startAuto({ root, store, schedule: false, bridge: { url: br.url, token: br.token } }), sounds = soundStore(root);
    t.after(async () => { await auto.stop(); model.close(); br.close(); await rm(root, { recursive: true, force: true }); });
    await auto.ready;
    // 브라우저의 요청 → 플러그인의 길 (plugin/index.mjs가 하는 일 그대로. "보고 있어요"는 일꾼에 안 전해요: 화면이 꺼진 지 75초가 지난 것처럼)
    const calls = [];
    const routes = {
        '/ping': async () => ({ ok: true }), '/store/load': async ({ id }) => { const got = await store.load(id); if (!got) throw new StoreError(404, 'none'); return got; },
        '/store/rev': async ({ id }) => ({ rev: await store.revOf(id) }), '/store/save': async ({ id, base, parts, chat }) => { const out = await store.save(id, { base, parts, chat }); auto.wrote(); return out; },
        '/auto/presence': async () => ({ on: true, rooms: 1 }), '/auto/status': async ({ id }) => ({ on: true, rooms: await auto.status(id) }),
        '/auto/claim': async ({ id, room, by, renew }) => (renew ? { ok: !!await auto.renew(id, room, by) } : auto.claim(id, room, by)),
        '/auto/release': async ({ id, room, by }) => { await auto.release(id, room, by); return { ok: true }; },
        // (사용자 지정 알림음: plugin/index.mjs의 길 그대로. 올리기는 실리의 multer처럼 'avatar' 칸의 파일을 임시 파일로 받아요)
        '/sound': async () => sounds.status(),
        '/sound/upload': async form => { const f = form.get('avatar'); const tmp = path.join(root, `_up${Date.now()}`); await writeFile(tmp, Buffer.from(await f.arrayBuffer())); return sounds.upload({ name: f.name, tmp, size: f.size }); },
        '/sound/delete': async () => { await sounds.remove(); return { configured: false, url: null, updatedAt: null }; },
    };
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        if (typeof url !== 'string' || !url.startsWith('/api/plugins/narrative-archive')) return realFetch(url, init);
        const p = url.slice('/api/plugins/narrative-archive'.length), body = init.body instanceof FormData ? init.body : init.body ? JSON.parse(init.body) : {};
        calls.push([p, body, init.headers || {}]);
        try { const json = await routes[p](body); return { ok: true, status: 200, json: async () => json }; }
        catch (err) { const code = err instanceof StoreError || err instanceof SoundError ? err.code : 500; return { ok: false, status: code, json: async () => ({ error: String(err.message), rev: err.rev }) }; }
    };
    t.after(() => { globalThis.fetch = realFetch; });

    const m = {};
    startFresh(m, { persona: 'Ren', now: Date.now() - 10 * 3600_000 });
    putLivePhone(m, { owner: 'Mara' });
    const room = ensureRoom(m, ['Mara']), w = liveWorld(m), at = Date.now() - hoursAgo * 3600_000;
    sendLive(m, room.id, 'hey', at); room.messages.push({ id: 't2', n: 2, from: 'Mara', text: 'hi', at: at + 60_000 });
    w.presence = { on: false, schedules: {}, overrides: {}, meta: {}, user: {} };
    const ctx = { chatId: 'chat-1', chatMetadata: { narrative_archive: m, integrity: 'mark-1' }, chat: [], name1: 'Ren', characterId: 0, characters: [{ name: 'Mara', avatar: 'mara.png', description: 'Mara is a baker.', data: { name: 'Mara', description: 'Mara is a baker.' } }],
        powerUserSettings: { persona_description: 'Ren is a student.' }, extensionSettings: { narrative_archive: { draftConn: conn } }, saveMetadata: async () => {}, saveSettingsDebounced() {}, getRequestHeaders: ({ omitContentType = false } = {}) => (omitContentType ? { 'X-CSRF-Token': 't' } : { 'Content-Type': 'application/json', 'X-CSRF-Token': 't' }),
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
let trGate = null;

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
    // (화면에 다시 그리라는 신호가 갔어요. 서버가 쓴 늦은 답장이 끝났다는 신호도: 화면이 방울 · 알림음을 내요)
    assert.ok(page.events.includes('na-live-change'));
    assert.deepEqual(page.details.filter(d => d.room && 'regen' in d), [{ from: 'server', room: S.room.id, by: ['Mara'], auto: false, regen: false }]);
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
    page.details.length = 0;
    const out = await G.liveGo(S.m);
    // (서버가 먼저 건 말은 '답이 끝났다' 신호가 아니에요: 안 읽음 표시로 알려요. 버린 것에도 신호가 없어요)
    assert.deepEqual(page.details.filter(d => 'regen' in d), []);
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

test('사용자 지정 알림음: 상태 읽기 · 올리기 · 지우기 — 알림음이 그 소리로 바뀌고, 지우면 기본 소리로. 플러그인이 없으면 기본 소리', async t => {
    const S = await stage(t);
    const played = [], hadAudio = globalThis.Audio;
    globalThis.Audio = class { constructor(url) { played.push(url); } addEventListener() {} play() { return Promise.resolve(); } };
    t.after(() => { if (hadAudio === undefined) delete globalThis.Audio; else globalThis.Audio = hadAudio; });
    assert.deepEqual(await SOUND.soundStatus(), { configured: false, url: null, updatedAt: null });
    // 올리기 (10MB가 넘으면 보내지도 않아요)
    await assert.rejects(SOUND.soundUpload({ size: SOUND.SOUND_MAX_BYTES + 1, name: 'big.wav' }), /10MB/);
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(20, 1)]);
    const st = await SOUND.soundUpload(new File([wav], 'ding.wav', { type: 'audio/wav' }));
    assert.equal(st.configured, true);
    assert.match(st.url, /^\/api\/plugins\/narrative-archive\/sound\/file\?v=/);
    assert.deepEqual(SOUND.soundLast(), st);
    // (보낼 때 CSRF 머리는 있고, Content-Type은 브라우저가 정하게 비워요: 파일 칸의 경계를 브라우저가 붙여요)
    assert.deepEqual(S.calls.find(([p]) => p === '/sound/upload')[2], { 'X-CSRF-Token': 't' });
    PING.playNotificationPing();
    assert.deepEqual(played, [st.url]);
    // 앱을 다시 켜면 그 소리로
    PING.setCustomNotificationSoundUrl(null);
    assert.deepEqual(await SOUND.soundStart(), st);
    PING.playNotificationPing();
    assert.deepEqual(played, [st.url, st.url]);
    // 안 받는 파일: 그 이유
    await assert.rejects(SOUND.soundUpload(new File([wav], 'ding.mp3')), /지원되는 오디오 형식이 아닙니다/);
    // 지우기
    assert.deepEqual(await SOUND.soundRemove(), { configured: false, url: null, updatedAt: null });
    PING.playNotificationPing();
    assert.equal(played.length, 2);
    assert.deepEqual(await SOUND.soundStatus(), { configured: false, url: null, updatedAt: null });
    // 플러그인이 없으면 (길이 없음): 기본 소리, 올리기는 이유를 알려요
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => { throw new Error('html'); } });
    try {
        assert.deepEqual(await SOUND.soundStatus(), { configured: false, url: null, updatedAt: null });
        await assert.rejects(SOUND.soundUpload(new File([wav], 'ding.wav')), /서버 플러그인이 없습니다/);
    } finally { globalThis.fetch = realFetch; }
});

test('가려진 탭은 "보고 있어요"를 안 알려요 — 답장을 받는 중이어도 (마리나라의 폴링은 가려지면 쉬어요). 보이면 알려요', async t => {
    const S = await stage(t);
    const job = enqueueJob(S.m, { kind: 'reply', owner: 'Mara', room: S.room.id }); job.state = 'running';
    page.hidden = true; S.calls.length = 0;
    await KO.keepBeat();
    assert.equal(S.calls.filter(c => c[0] === '/auto/presence').length, 0);
    page.hidden = false;
    await KO.keepBeat();
    assert.equal(S.calls.filter(c => c[0] === '/auto/presence').length, 1);
    job.state = 'done';
});

test('답장이 기다리는 시각에 틱이 한 번 더 돌아요 (30초를 기다리지 않아요). 줄 세울 때 그 시각을 알려 줘요', async t => {
    const S = await stage(t);
    let at = null;
    G.setDueHook(x => { at = x; });
    t.after(() => G.setDueHook(TICK.tickAt));
    sendLive(S.m, S.room.id, 'busy?');
    const job = enqueueJob(S.m, { kind: 'reply', owner: 'Mara', room: S.room.id });
    S.w.presence = { on: false, schedules: { mara: { weekStart: new Date(Date.now() - 86400000).toISOString(), days: Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => [d, [{ time: '00:00-00:00', activity: 'gym', status: 'dnd' }]])), inactivityThresholdMinutes: 60, talkativeness: 50, dndResponseDelayMinutes: 1 } }, overrides: {}, meta: {}, user: {} };
    G.holdReplies(S.m);
    assert.ok(job.notBefore > Date.now());
    assert.equal(at, job.notBefore);
    // (틱: 그 시각에 tickOnce)
    const realSet = globalThis.setTimeout, waits = [];
    globalThis.setTimeout = (fn, ms) => { waits.push(ms); return realSet(() => {}, 0); };
    try { TICK.tickAt(Date.now() + 4000); TICK.tickAt(Date.now() + 9000); TICK.tickAt(Date.now() + 2000); } finally { globalThis.setTimeout = realSet; }
    assert.equal(waits.length, 2);
    assert.ok(waits[0] >= 3900 && waits[0] <= 4100 && waits[1] >= 1900 && waits[1] <= 2100);
    job.state = 'done';
});

test('이 채팅의 페르소나를 채팅에 적어 둬요 (서버가 실리를 닫은 동안 그 페르소나로 답해요): Orbit이 있는 채팅만, 달라졌을 때만', async t => {
    const S = await stage(t);
    assert.equal(await KO.keepPersona('varo.png'), true);
    assert.equal(S.m.stPersona, 'varo.png');
    assert.equal(await KO.keepPersona('varo.png'), false);
    assert.equal(await KO.keepPersona('ren.png'), true);
    assert.equal(S.m.stPersona, 'ren.png');
    // (Orbit이 없는 채팅에는 안 적어요: 그 채팅 파일을 건드리지 않아요)
    const other = { narrative_archive: {} };
    setContext({ ...globalThis.SillyTavern.getContext(), chatMetadata: other });
    assert.equal(await KO.keepPersona('varo.png'), false);
    assert.equal(other.narrative_archive.stPersona, undefined);
});

test('서버가 쓴 늦은 답장의 자동 번역: 브라우저의 "답이 끝났다" 신호는 서버의 번역이 끝나 저장된 뒤에 가요 (마리나라 waitForServerTranslationToSettle)', async t => {
    const S = await stage(t);
    const poll = KO.TRANSLATION_SETTLE.pollMs; KO.TRANSLATION_SETTLE.pollMs = 30;
    let open;
    trGate = new Promise(r => { open = r; });
    t.after(() => { KO.TRANSLATION_SETTLE.pollMs = poll; open?.(); trGate = null; });
    S.w.presence.meta = { autoTranslate: true, translationProvider: 'ai', translationConnectionId: 'dr', translationOutputTargetLang: 'Korean' };
    await busyReply(S, 'so tired');
    page.hidden = true;
    await sleep(350);
    assert.equal(await S.auto.sweep(), 1);
    page.hidden = false; page.details.length = 0;
    const ticking = TICK.tickOnce();
    // (the server's reply is in, marked for translation; the cue waits while the server still translates)
    await until(() => S.room.messages.some(x => x.text === 'answer 1'));
    await sleep(120);
    const reply = S.room.messages.find(x => x.text === 'answer 1');
    assert.deepEqual([reply.extra?.automaticTranslationSource, reply.extra?.translation], ['answer 1', undefined]);
    assert.deepEqual(page.details.filter(d => d.room && 'regen' in d), []);
    assert.equal((await S.auto.status(S.sid))[0].translating, true);
    open();
    await until(() => page.details.some(d => d.room && 'regen' in d));
    assert.deepEqual(page.details.filter(d => d.room && 'regen' in d), [{ from: 'server', room: S.room.id, by: ['Mara'], auto: false, regen: false }]);
    // (by then the browser has the translation the server saved)
    const now = S.room.messages.find(x => x.id === reply.id) || S.room.messages.find(x => x.text === 'answer 1');
    assert.equal(now.extra.translationSource, 'answer 1');
    assert.ok(now.extra.translation);
    await ticking;
});

test('서버 번역을 기다리는 동안 다른 채팅을 열면: 묻는 저장은 시작할 때의 것 그대로 끝까지 묻고, 끝나도 새 채팅의 것을 받지 않아요 (false)', async t => {
    const S = await stage(t);
    const poll = KO.TRANSLATION_SETTLE.pollMs; KO.TRANSLATION_SETTLE.pollMs = 20;
    let open;
    trGate = new Promise(r => { open = r; });
    const was = globalThis.SillyTavern.getContext();
    t.after(() => { KO.TRANSLATION_SETTLE.pollMs = poll; open?.(); trGate = null; setContext(was); });
    S.w.presence.meta = { autoTranslate: true, translationProvider: 'ai', translationConnectionId: 'dr', translationOutputTargetLang: 'Korean' };
    await busyReply(S, 'so tired');
    page.hidden = true;
    await sleep(350);
    assert.equal(await S.auto.sweep(), 1);
    assert.equal((await S.auto.status(S.sid))[0].translating, true);
    S.calls.length = 0;
    let n = 0;
    // (another chat is opened while it waits: one with an Orbit of its own, not in the plugin yet)
    const waiting = KO.waitForServerTranslationToSettle(S.room.id, { wait: async ms => { if (++n === 2) setContext({ ...was, chatMetadata: { narrative_archive: { other: true } } }); if (n === 4) open(); await sleep(ms); } });
    assert.equal(await waiting, false);
    const asked = S.calls.filter(c => c[0] === '/auto/status').map(c => c[1].id);
    assert.ok(asked.length >= 1);
    assert.deepEqual([...new Set(asked)], [S.sid]);
    assert.deepEqual(S.calls.filter(c => c[0] !== '/auto/status'), []);
    page.hidden = false;
});

test('서버 번역을 기다리는 동안 다른 채팅을 열어도 그 답의 "답이 끝났다" 신호는 번역이 끝난 뒤 가요 (마리나라: 완료 알림은 기다림이 끝나면 늘 — finally)', async t => {
    const S = await stage(t);
    const poll = KO.TRANSLATION_SETTLE.pollMs; KO.TRANSLATION_SETTLE.pollMs = 30;
    let open;
    trGate = new Promise(r => { open = r; });
    const was = globalThis.SillyTavern.getContext();
    t.after(() => { KO.TRANSLATION_SETTLE.pollMs = poll; open?.(); trGate = null; setContext(was); });
    S.w.presence.meta = { autoTranslate: true, translationProvider: 'ai', translationConnectionId: 'dr', translationOutputTargetLang: 'Korean' };
    await busyReply(S, 'so tired');
    page.hidden = true;
    await sleep(350);
    assert.equal(await S.auto.sweep(), 1);
    page.hidden = false; page.details.length = 0;
    const ticking = TICK.tickOnce();
    await until(() => S.room.messages.some(x => x.text === 'answer 1'));
    await sleep(120);
    assert.deepEqual(page.details.filter(d => d.room && 'regen' in d), []);
    // (another chat is opened while the server still translates)
    setContext({ ...was, chatMetadata: { narrative_archive: { other: true } } });
    await sleep(100);
    assert.deepEqual(page.details.filter(d => d.room && 'regen' in d), []);
    open();
    await until(() => page.details.some(d => d.room && 'regen' in d));
    assert.deepEqual(page.details.filter(d => d.room && 'regen' in d), [{ from: 'server', room: S.room.id, by: ['Mara'], auto: false, regen: false }]);
    await ticking;
});
