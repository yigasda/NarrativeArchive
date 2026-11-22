// 브라우저 쪽(src/phone2keepon.js · phone2tick.js · phone2go.js)과 서버 일꾼(plugin/)을 한 저장에 같이 붙여서:
// 브라우저가 묶음을 남기고 → 가려진 동안 서버가 먼저 건 말을 넣고 → 다시 보이면 브라우저가 받고 → 또 걸지 않아요.
// 브라우저의 파일들은 "아무것도 안 하는 화면"으로 불러요 (plugin/screen.mjs). 모델은 가짜 HTTP 서버. 예시 캐릭터만 써요.
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
// (the browser's page: whether the tab is hidden is ours to say here)
const page = { hidden: false, events: [], details: [], addEventListener() {}, dispatchEvent(e) { this.events.push(e?.type); if (e?.detail) this.details.push(e.detail); return true; }, querySelectorAll: () => [] };
globalThis.document = page;
const { startFresh, putLivePhone, ensureRoom, sendLive, readLive, liveWorld } = await import('../src/phone2store.js');
const KO = await import('../src/phone2keepon.js');
const core = await import('../src/core.js');
const G = await import('../src/phone2go.js');
const TICK = await import('../src/phone2tick.js');

// (the browser's own files leave timers running — fine on a page, but they would keep this process up after the tests are done)
after(() => { setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

const listen = handler => new Promise(ok => { const s = http.createServer(handler); s.listen(0, '127.0.0.1', () => ok(s)); });
const bodyOf = req => new Promise(ok => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { ok(JSON.parse(b || 'null')); } catch { ok(b); } }); });

test('브라우저와 서버 일꾼이 번갈아: 가려진 동안 서버가 건 말을 다시 보일 때 받고, 또 걸지 않아요. 읽으면 안 읽음 표시가 지워져요', async t => {
    const root = await mkdtemp(path.join(tmpdir(), 'na-beat-'));
    const asked = [];
    const model = await listen(async (req, res) => { asked.push(await bodyOf(req)); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: ['you there?'], status: '' }) }, finish_reason: 'stop' }] })); });
    const conn = { mode: 'custom', url: `http://127.0.0.1:${model.address().port}/v1`, key: 'K', model: 'fake-model' };
    await writeFile(path.join(root, 'settings.json'), JSON.stringify({ power_user: {}, extension_settings: { narrative_archive: { draftConn: conn } } }));
    await mkdir(path.join(root, 'chats', 'mara'), { recursive: true }); await writeFile(path.join(root, 'chats', 'mara', 'chat-1.jsonl'), '{}\n');
    const store = openStore(root), auto = startAuto({ root, store, schedule: false });
    t.after(async () => { await auto.stop(); model.close(); await rm(root, { recursive: true, force: true }); });
    await auto.ready;
    // 브라우저의 요청 → 플러그인의 길 (plugin/index.mjs가 하는 일 그대로)
    const routes = {
        '/ping': async () => ({ ok: true }), '/store/load': async ({ id }) => { const got = await store.load(id); if (!got) throw new StoreError(404, 'none'); return got; },
        '/store/rev': async ({ id }) => ({ rev: await store.revOf(id) }), '/store/save': async ({ id, base, parts, chat }) => { const out = await store.save(id, { base, parts, chat }); auto.wrote(); return out; },
        '/auto/presence': async ({ id, status }) => ({ on: true, rooms: await auto.presence(id, status) }), '/auto/status': async ({ id }) => ({ on: true, rooms: await auto.status(id) }),
    };
    const pings = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        if (typeof url !== 'string' || !url.startsWith('/api/plugins/narrative-archive')) return realFetch(url, init);
        const p = url.slice('/api/plugins/narrative-archive'.length), body = init.body ? JSON.parse(init.body) : {};
        if (p === '/auto/presence') pings.push(body);
        try { const json = await routes[p](body); return { ok: true, status: 200, json: async () => json }; }
        catch (err) { const code = err instanceof StoreError ? err.code : 500; return { ok: false, status: code, json: async () => ({ error: String(err.message), rev: err.rev }) }; }
    };
    t.after(() => { globalThis.fetch = realFetch; });

    // ---- 브라우저: 채팅 하나. Ren(나)과 Mara, 7시간 전에 말했고, 먼저 말 걸기 켬
    const m = {};
    startFresh(m, { persona: 'Ren', now: Date.now() - 10 * 3600_000 });
    putLivePhone(m, { owner: 'Mara' });
    const room = ensureRoom(m, ['Mara']), w = liveWorld(m), at = Date.now() - 7 * 3600_000;
    sendLive(m, room.id, 'hey', at); room.messages.push({ id: 't2', n: 2, from: 'Mara', text: 'hi', at: at + 60_000 });
    w.presence = { on: true, schedules: {}, overrides: {}, meta: {}, user: {} };
    let stSaves = 0;
    const ctx = { chatId: 'chat-1', chatMetadata: { narrative_archive: m, integrity: 'mark-1' }, chat: [], name1: 'Ren', characterId: 0, characters: [{ name: 'Mara', avatar: 'mara.png', description: 'Mara is a baker.', data: { name: 'Mara', description: 'Mara is a baker.' } }],
        powerUserSettings: { persona_description: 'Ren is a student.' }, extensionSettings: { narrative_archive: { draftConn: conn } }, saveMetadata: async () => { stSaves++; }, saveSettingsDebounced() {}, getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
        eventSource: { on() {} }, eventTypes: { CHAT_CHANGED: 'chat' }, setExtensionPrompt() {} };
    setContext(ctx);
    KO.keepStart();
    await KO.liveReady();
    await core.saveMeta();
    assert.equal(KO.keepState(), 'ok'); assert.ok(m.liveRef.id);
    const sid = m.liveRef.id;
    // 30초 틱: 서버가 읽을 묶음을 남겨요. (브라우저가 보고 있으니 먼저 말 걸기도 여기서 봐요: 가짜 모델이 답해요)
    await KO.keepBeat();
    assert.equal(KO.keepServes(), true);
    assert.deepEqual(pings.at(-1), { id: sid, status: 'active' });
    assert.ok(await G.liveKitRefresh(m)); await core.saveMeta();
    assert.equal((await auto.status(sid))[0].can, true);

    // ---- 탭을 가렸어요: 브라우저의 틱은 쉬고, 알리지도 않아요
    page.hidden = true;
    const before = pings.length;
    assert.equal(await TICK.tickOnce(), 0);
    await KO.keepBeat();
    assert.equal(pings.length, before);
    assert.equal(asked.length, 0);
    // (75초가 지난 것처럼: 서버가 이 방을 맡아요. 일꾼의 기억에서 "보고 있음"을 지우는 대신, 스케줄러가 부르는 두 길을 바로 불러요)
    await auto.list();
    const chatId = `${w.id}:${room.id}`;
    const due = JSON.parse((await auto.inject('/api/conversation/autonomous/check', { chatId, userStatus: 'idle', maxFollowups: 2, source: 'server' })).payload);
    assert.equal(due.shouldTrigger, true);
    const made = await auto.inject('/api/generate', { chatId, forCharacterId: 'mara', userStatus: 'idle', userActivity: 'away or offline', autonomous: true, skipPresenceDelay: true, autonomousIntentKey: due.autonomousIntentKey });
    assert.match(made.payload, /"message_saved"/);
    assert.equal(asked.length, 1);
    // (스케줄러가 말이 나온 뒤에 하는 안 읽음 표시)
    await auto.unread(chatId, 'mara');
    // 브라우저는 아직 몰라요
    assert.equal(room.messages.length, 2);

    // ---- 다시 보여요: 알리고, 서버가 쓴 것을 받아요. 방 · 말의 객체는 그대로예요
    page.hidden = false; page.events.length = 0;
    const list = room.messages, first = room.messages[0];
    await KO.keepBeat();
    assert.equal(pings.length, before + 1);
    assert.equal(liveWorld(m).messenger.rooms[room.id], room); assert.equal(room.messages, list); assert.equal(room.messages[0], first);
    assert.deepEqual(room.messages.map(x => [x.from, x.text, x.extra?.autonomous]), [['Ren', 'hey', undefined], ['Mara', 'hi', undefined], ['Mara', 'you there?', true]]);
    assert.ok(page.events.includes('na-live-change'));
    // (알림을 띄울 신호: 서버가 그사이 건 말)
    assert.deepEqual(page.details.filter(d => d.from === 'server'), [{ from: 'server', rooms: [{ room: room.id, by: ['Mara'], added: 1, count: 1 }] }]);
    assert.equal(Object.values(w.presence.meta.autonomousDailyBudget.counts)[0], 1);
    // 브라우저의 판단: 서버가 방금 걸었으니 또 걸지 않아요 (표시로 알아요)
    assert.equal(await G.liveAutonomous(m), 0);
    assert.equal(asked.length, 1);
    assert.deepEqual(G.liveAutonomousUnread(m), [{ room: room.id, count: 1, by: ['Mara'], at: room.autonomousUnreadAt }]);
    // 받은 뒤의 저장은 부딪히지 않아요. 내가 방을 읽고(안 읽음 표시가 지워져요) 답하면 그대로 올라가요
    readLive(m, room.id, 'Ren');
    assert.deepEqual(G.liveAutonomousUnread(m), []);
    sendLive(m, room.id, 'im here');
    await core.saveMeta();
    const got = await store.load(sid);
    assert.equal(got.parts[`room/${room.id}/0`].at(-1).text, 'im here');
    assert.equal(got.parts[`room/${room.id}`].room.autonomousUnreadCount, undefined);

    // ---- 가려져 있는 동안 때가 된 늦은 답장: 브라우저의 틱은 안 돌려요 (일꾼의 몫). 일꾼이 없으면(알렸을 때 꺼져 있었으면) 전처럼 브라우저가 돌려요
    const { enqueueJob } = await import('../src/phone2store.js');
    const job = enqueueJob(m, { kind: 'reply', owner: 'Mara', room: room.id, at: Date.now() - 600_000 });
    Object.assign(job, { timed: true, notBefore: Date.now() - 1000 });
    page.hidden = true;
    const n = asked.length;
    await TICK.tickOnce();
    assert.equal(asked.length, n); assert.equal(job.state, 'waiting');
    routes['/auto/presence'] = async () => ({ on: false, rooms: 0 });
    page.hidden = false; await KO.keepBeat(); page.hidden = true;
    assert.equal(KO.keepServes(), false);
    await TICK.tickOnce();
    assert.equal(asked.length, n + 1);
});
