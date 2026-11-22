// 서버 플러그인의 일꾼을 실제로 띄워서 끝까지 (plugin/host.mjs · worker.mjs · work.mjs · screen.mjs):
// 브라우저와 같은 답장 코드(src/)가 서버에서 돌아요. 모델은 가짜 HTTP 서버, 실리 서버는 가짜 다리, 저장은 임시 폴더. 예시 캐릭터만 써요.
process.env.NA_SCREEN_ANYWHERE = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore } from '../plugin/store.mjs';
import { startAuto } from '../plugin/host.mjs';
import { splitLive, joinLive } from '../src/phone2keep.js';
import { startFresh, startFromStory, putLivePhone, ensureRoom, sendLive, liveWorld, enqueueJob } from '../src/phone2store.js';
import { buildKit, putKit } from '../src/phone2kit.js';
// (the request template is made by the real ai.js, as the browser makes it: that file needs the do-nothing screen to load)
await import('../plugin/screen.mjs');
const AI = await import('../src/ai.js');

const listen = handler => new Promise(ok => { const s = http.createServer(handler); s.listen(0, '127.0.0.1', () => ok(s)); });
const bodyOf = req => new Promise(ok => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { ok(JSON.parse(b || 'null')); } catch { ok(b); } }); });
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const week = blocks => ({ weekStart: new Date(Date.now() - 86400000).toISOString(), days: Object.fromEntries(DAYS.map(d => [d, blocks.map(b => ({ ...b }))])), inactivityThresholdMinutes: 60, talkativeness: 50 });
const card = name => ({ name, avatar: `${name.toLowerCase()}.png`, description: `${name} is a baker.`, data: { name, description: `${name} is a baker.`, personality: 'warm', extensions: { talkativeness: 0.5 } } });
const BROWSER = () => ({ name1: 'Ren', characterId: 0, characters: ['Mara', 'Ivo'].map(card), powerUserSettings: { persona_description: 'Ren is a student.' } });
const TAIL = { lines: ['[#4] Mara: on my way', '[#5 · USER] Ren: ok'], first: 4, end: 5 };

// 세계 하나: Ren(나)과 Mara의 방. Ren이 7시간 전에 말했고 Mara가 바로 답했어요. 먼저 말 걸기 켬
function world({ story = false, schedule = null, kit = true, st = null, members = ['Mara'], hoursAgo = 7 } = {}) {
    const m = {};
    if (story) { startFromStory(m, { persona: 'Ren', upto: 3, now: Date.now() - 10 * 3600_000 }); liveWorld(m).snap = { v: 1, at: 1, upto: 3, text: '## #0–#3 — start\n- they met at the bakery\n', recent: ['[#3] Mara: see you'], made: { from: 0, to: 3, count: 4, parts: 1 } }; }
    else startFresh(m, { persona: 'Ren', now: Date.now() - 10 * 3600_000 });
    for (const n of members) putLivePhone(m, { owner: n });
    const room = ensureRoom(m, members), w = liveWorld(m), at = Date.now() - hoursAgo * 3600_000;
    sendLive(m, room.id, 'hey', at);
    room.messages.push({ id: 't2', n: 2, from: members[0], text: 'hi', at: at + 60_000 });
    w.presence = { on: true, schedules: schedule ? { mara: schedule } : {}, overrides: {}, meta: {}, user: {} };
    if (kit) { const k = buildKit(BROWSER(), m, TAIL); k.st = st || {}; putKit(m, k); }
    return { m, w, room, id: `${w.id}:${room.id}` };
}

// 한 판: 임시 사용자 폴더 + 저장 + 가짜 모델 + 가짜 다리 + 일꾼
async function stage(t, { settings = {}, reply = () => ({ reply: ['you there?'], status: '' }), bridge = true } = {}) {
    const root = await mkdtemp(path.join(tmpdir(), 'na-work-'));
    const asked = [], st = [];
    const model = await listen(async (req, res) => { const body = await bodyOf(req); asked.push({ url: req.url, auth: req.headers.authorization, body }); const a = await reply(body); if (a?.httpStatus) { res.statusCode = a.httpStatus; res.end(JSON.stringify({ error: { message: a.error || 'no' } })); return; } res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: typeof a === 'string' ? a : JSON.stringify(a) }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } })); });
    const TOKEN = 'tok-123';
    const br = bridge ? await listen(async (req, res) => {
        const body = await bodyOf(req);
        st.push({ url: req.url, token: req.headers['x-na-token'], root: decodeURIComponent(String(req.headers['x-na-root'] || '')), body });
        if (req.headers['x-na-token'] !== TOKEN) { res.statusCode = 403; res.end('{}'); return; }
        res.setHeader('content-type', 'application/json');
        if (req.url === '/api/backends/chat-completions/generate') { res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(await reply(body)) }, finish_reason: 'stop' }] })); return; }
        if (req.url === '/api/characters/merge-attributes') { res.end('{}'); return; }
        res.statusCode = 404; res.end('{}');
    }) : null;
    const url = `http://127.0.0.1:${model.address().port}/v1`;
    await writeFile(path.join(root, 'settings.json'), JSON.stringify({ main_api: 'openai', power_user: {}, oai_settings: { reverse_proxy: 'https://proxy.example', proxy_password: 'PW-SECRET' }, extension_settings: { connectionManager: { profiles: [{ id: 'p1', name: 'My profile', api: 'openai', model: 'x' }] }, narrative_archive: { draftConn: { mode: 'custom', url, key: 'MODEL-KEY', model: 'fake-model' }, ...settings } } }));
    const store = openStore(root);
    const auto = startAuto({ root, store, bridge: br ? { url: `http://127.0.0.1:${br.address().port}`, token: TOKEN } : null, schedule: false });
    t.after(async () => { await auto.stop(); model.close(); br?.close(); await rm(root, { recursive: true, force: true }); });
    await auto.ready;
    const put = (sid, m) => store.save(sid, { parts: JSON.parse(JSON.stringify(splitLive(m.live))), chat: 'chat-1' });
    const get = async sid => liveWorld({ live: joinLive((await store.load(sid)).parts) });
    const check = id => auto.inject('/api/conversation/autonomous/check', { chatId: id, userStatus: 'idle', maxFollowups: 2, source: 'server' });
    const gen = (id, more = {}) => auto.inject('/api/generate', { chatId: id, connectionId: null, forCharacterId: 'mara', streaming: false, userStatus: 'idle', userActivity: 'away or offline', autonomous: true, skipPresenceDelay: true, autonomousIntentKey: 'check_in', ...more });
    return { root, store, auto, asked, st, put, get, check, gen, url };
}
const textOf = body => body.messages.map(x => (typeof x.content === 'string' ? x.content : x.content.map(p => p.text || '').join(''))).join('\n');

test('일꾼: 먼저 건 말 하나가 끝까지 — 브라우저와 같은 요청, 방에 들어가고 저장되고, 하루 수 · 이유의 쉬는 시간이 적혀요', async t => {
    const S = await stage(t), a = world();
    await S.put('sa', a.m);
    assert.deepEqual((await S.auto.list()).map(r => [r.id, r.metadata.autonomousMessages]), [[a.id, true]]);
    const due = JSON.parse((await S.check(a.id)).payload);
    assert.deepEqual([due.shouldTrigger, due.characterIds, due.autonomousIntentKey], [true, ['mara'], 'check_in']);
    const r = await S.gen(a.id);
    assert.equal(r.statusCode, 200);
    assert.match(r.payload, /"message_saved"[\s\S]*"done"/);
    // 모델에 간 요청: 초안 모델(커스텀 API)로, 실리 폴더의 설정에 있는 키로
    assert.equal(S.asked.length, 1);
    assert.equal(S.asked[0].auth, 'Bearer MODEL-KEY'); assert.equal(S.asked[0].body.model, 'fake-model');
    const text = textOf(S.asked[0].body);
    assert.match(text, /^\[INSTRUCTIONS\]\nGOAL\nYou are Mara\. Ren is texting you on MESSENGER\./);
    assert.match(text, /\[MESSENGER\]\n[^\n]*Ren: hey\n[^\n]*Mara: hi/);
    // (마리나라의 서버가 보내는 값: 나는 자리에 없어요)
    assert.match(text, /\[CONTEXT\]\nYour current status: online\.\nRen's status: idle \/ away from the computer - away or offline\./);
    assert.match(text, /\[Mara's card\]\n\[description\]\nMara is a baker\./);
    assert.match(text, /\[PERSONA — Ren\]\nRen is a student\./);
    assert.match(text, /\[WHY NOW\]\nYou have a free moment and Ren has been quiet\./);
    // 저장된 것
    const w = await S.get('sa'), room = w.messenger.rooms[a.room.id];
    assert.deepEqual(room.messages.map(x => [x.from, x.text]), [['Ren', 'hey'], ['Mara', 'hi'], ['Mara', 'you there?']]);
    assert.equal(Object.values(w.presence.meta.autonomousDailyBudget.counts)[0], 1);
    assert.ok(w.presence.meta.intentCooldowns.mara.check_in);
    assert.equal(w.queue.jobs.filter(j => j.state === 'waiting' || j.state === 'running').length, 0);
    // (폰에 적힌 내 상태는 안 바뀌어요)
    assert.notEqual(w.presence.user?.status, 'idle');
    // 방금 걸었으니 다시 물으면 아직 때가 아니에요 (따라 묻기는 한참 뒤)
    assert.equal(JSON.parse((await S.check(a.id)).payload).shouldTrigger, false);
});

test('일꾼: 이야기에서 시작한 폰 — 이야기 요약본과 브라우저가 남긴 롤플 끝 메시지가 들어가요 (요약본을 늘리지 않아요)', async t => {
    const S = await stage(t), a = world({ story: true });
    await S.put('sa', a.m); await S.auto.list();
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const text = textOf(S.asked[0].body);
    assert.match(text, /\[STORY\]\n## #0–#3 — start\n- they met at the bakery/);
    assert.match(text, /\[LAST MESSAGES\]\nMara: on my way\n\nRen: ok/);
    assert.equal(S.asked.length, 1);
    assert.deepEqual((await S.get('sa')).snap.upto, 3);
});

test('일꾼: 서버가 읽을 묶음이 없는 세계는 목록에 없고, 만들라고 해도 안 만들어요', async t => {
    const S = await stage(t), a = world({ kit: false }), b = world();
    await S.put('sa', a.m); await S.put('sb', b.m);
    assert.deepEqual((await S.auto.list()).map(r => r.id), [b.id]);
    assert.equal((await S.gen(a.id)).statusCode, 404);
    assert.equal(S.asked.length, 0);
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[false, '서버가 읽을 묶음이 아직 없어요']]);
    assert.deepEqual((await S.auto.status('sb')).map(x => [x.id, x.can, x.why]), [[b.id, true, '']]);
});

test('일꾼: 실리 연결 방식 — 브라우저가 남긴 요청 틀에 메시지와 비밀 칸을 채워서 실리 서버의 처리기로 보내요', async t => {
    // (the browser's part: SillyTavern's own builder makes the request; here a stand-in for it)
    globalThis.__naStOpenai = { oai_settings: { reverse_proxy: 'https://proxy.example', proxy_password: 'PW-SECRET' }, createGenerationParameters: async (s, model, type, messages) => ({ generate_data: { chat_completion_source: s.chat_completion_source, model, messages, max_tokens: s.openai_max_tokens, temperature: s.temp_openai, reasoning_effort: s.reasoning_effort, include_reasoning: s.show_thoughts, reverse_proxy: s.reverse_proxy, proxy_password: s.proxy_password, user_name: 'Ren', stream: true } }) };
    const slot = { mode: 'source', source: 'openrouter', stModel: 'fake/model' };
    const tpl = await AI.stSourceTemplate(slot, { maxTokens: 4000, effort: 'low', thoughts: true });
    delete globalThis.__naStOpenai;
    assert.ok(!JSON.stringify(tpl).includes('PW-SECRET'));
    const S = await stage(t, { settings: { draftConn: slot } }), a = world({ st: { [tpl.key]: { data: tpl.data, secrets: tpl.secrets } } });
    await S.put('sa', a.m); await S.auto.list();
    assert.deepEqual((await S.auto.status('sa')).map(x => x.can), [true]);
    const r = await S.gen(a.id);
    assert.match(r.payload, /"message_saved"/);
    assert.equal(S.asked.length, 0);   // (우리 커스텀 API로는 안 갔어요)
    const sent = S.st.find(x => x.url === '/api/backends/chat-completions/generate');
    assert.equal(sent.token, 'tok-123'); assert.equal(sent.root, S.root);
    assert.deepEqual([sent.body.chat_completion_source, sent.body.model, sent.body.max_tokens, sent.body.temperature, sent.body.reasoning_effort, sent.body.include_reasoning, sent.body.stream, sent.body.user_name], ['openrouter', 'fake/model', 4000, 0.3, 'low', true, false, 'Ren']);
    // (비밀 칸은 실리의 settings.json에서)
    assert.equal(sent.body.proxy_password, 'PW-SECRET');
    assert.deepEqual(sent.body.messages.map(m => m.role), ['system', 'user']);
    assert.match(sent.body.messages[0].content, /^GOAL\nYou are Mara\./);
    assert.match(sent.body.messages[1].content, /\[WHY NOW\]/);
    assert.equal((await S.get('sa')).messenger.rooms[a.room.id].messages.at(-1).text, 'you there?');
});

test('일꾼: 요청 틀이 없는 실리 연결 방식 · 연결 프로필 방은 안 돌려요 (이유를 알려요). 지어내지 않아요', async t => {
    const S = await stage(t, { settings: { draftConn: { mode: 'source', source: 'claude', stModel: 'c-1' } } }), a = world(), b = world();
    liveWorld(b.m).messenger.rooms[b.room.id].connectionId = 'profile:p1';
    await S.put('sa', a.m); await S.put('sb', b.m); await S.auto.list();
    const ra = await S.gen(a.id);
    assert.equal(ra.statusCode, 400); assert.match(ra.payload, /요청 틀이 없어요/);
    const rb = await S.gen(b.id);
    assert.equal(rb.statusCode, 400, rb.payload); assert.match(rb.payload, /연결 프로필/);
    assert.match((await S.auto.status('sa'))[0].why, /요청 틀이 없어요/);
    assert.equal(S.asked.length + S.st.filter(x => x.url.includes('generate')).length, 0);
    for (const [sid, x] of [['sa', a], ['sb', b]]) { const w = await S.get(sid); assert.equal(w.messenger.rooms[x.room.id].messages.length, 2); assert.equal(w.queue.jobs.length, 0); }
});

test('일꾼: 모델이 실패하면 말이 안 들어가고, 실패로 알려요. 그 방은 쉬어요', async t => {
    const S = await stage(t, { reply: () => ({ httpStatus: 500, error: 'boom' }) }), a = world();
    await S.put('sa', a.m); await S.auto.list();
    const r = await S.gen(a.id);
    assert.equal(r.statusCode, 200); assert.match(r.payload, /"type":"error"/);
    const w = await S.get('sa'), room = w.messenger.rooms[a.room.id];
    assert.equal(room.messages.length, 2); assert.equal(room.autoFail.attempts, 1);
    assert.equal(w.presence.meta.autonomousDailyBudget, undefined);
    // 쉬는 동안 다시 시키면 안 만들어요 (409: 스케줄러는 이걸 실패로 세지 않아요)
    assert.equal((await S.gen(a.id)).statusCode, 409);
    assert.equal(S.asked.length, 1);
});

test('일꾼: 그사이 브라우저가 저장했으면 덮어쓰지 않아요', async t => {
    let hold; const gate = new Promise(r => { hold = r; });
    const S = await stage(t, { reply: async () => { await gate; return { reply: ['late'], status: '' }; } }), a = world();
    await S.put('sa', a.m); await S.auto.list();
    const going = S.gen(a.id);
    while (!S.asked.length) await new Promise(r => setTimeout(r, 10));
    // 브라우저가 그 방에 말을 하나 더 저장
    const now = await S.store.load('sa'), key = `room/${a.room.id}/0`;
    await S.store.save('sa', { base: now.rev, parts: { [key]: [...now.parts[key], { id: 'u9', n: 9, from: 'Ren', text: 'im back', at: Date.now() }] } });
    hold();
    const r = await going;
    assert.match(r.payload, /"type":"error"/);
    assert.deepEqual((await S.get('sa')).messenger.rooms[a.room.id].messages.map(x => x.text), ['hey', 'hi', 'im back']);
});

test('일꾼: 캐릭터가 상태를 바꾸면 카드에도 써요 (실리의 merge-attributes로)', async t => {
    const S = await stage(t, { reply: () => ({ reply: ['brb'], status: { status: 'dnd', activity: 'in a meeting', duration: '30m' } }) });
    const a = world({ schedule: week([{ time: '00:00-23:59', activity: 'free time', status: 'online' }]) });
    await S.put('sa', a.m); await S.auto.list();
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const writes = S.st.filter(x => x.url === '/api/characters/merge-attributes');
    assert.ok(writes.length >= 1);
    assert.ok(writes.every(x => x.body.avatar === 'mara.png' && x.body.data.extensions.narrative_archive_convo));
    const last = writes.at(-1).body.data.extensions.narrative_archive_convo;
    assert.ok(last.conversationSchedule || last.conversationStatusOverride);
    const w = await S.get('sa');
    assert.equal(w.messenger.rooms[a.room.id].messages.at(-1).text, 'brb');
});

test('일꾼: 때가 된 늦은 답장을 보내요. 브라우저가 열어 둔 세계 · 서버가 못 보내는 방이 낀 세계는 안 건드려요', async t => {
    const S = await stage(t, { reply: () => ({ reply: ['sorry, was busy'], status: '' }) });
    const mk = (more = () => {}) => { const x = world({ hoursAgo: 0.2 }); const j = enqueueJob(x.m, { kind: 'reply', owner: 'Mara', room: x.room.id, at: Date.now() - 600_000 }); Object.assign(j, { timed: true, notBefore: Date.now() - 1000 }); more(x, j); return x; };
    const a = mk(), b = mk(), c = mk(x => { liveWorld(x.m).messenger.rooms[x.room.id].connectionId = 'profile:p1'; }), d = mk((x, j) => { j.notBefore = Date.now() + 3600_000; });
    await S.put('sa', a.m); await S.put('sb', b.m); await S.put('sc', c.m); await S.put('sd', d.m);
    await S.auto.presence('sb', 'active');
    assert.equal(await S.auto.sweep(), 1);
    assert.equal((await S.get('sa')).messenger.rooms[a.room.id].messages.at(-1).text, 'sorry, was busy');
    for (const [sid, x] of [['sb', b], ['sc', c], ['sd', d]]) { const w = await S.get(sid); assert.equal(w.messenger.rooms[x.room.id].messages.length, 2, sid); assert.equal(w.queue.jobs.filter(j => j.state === 'waiting').length, 1, sid); }
    assert.equal(S.asked.length, 1);
    // (연결 프로필을 고른 방은 초안 모델이 커스텀 API여도 서버가 대신 답하지 않아요: 다른 모델로 답하게 돼요)
    await S.auto.list();
    const rc = await S.gen(c.id);
    assert.equal(rc.statusCode, 400); assert.match(rc.payload, /연결 프로필/);
    assert.equal(S.asked.length, 1);
    // (늦은 답장은 내가 자리에 없다고 적지 않아요: 먼저 건 말이 아니에요)
    assert.doesNotMatch(textOf(S.asked[0].body), /away or offline|\[WHY NOW\]\n/);
});
