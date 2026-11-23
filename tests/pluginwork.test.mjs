// 서버 플러그인의 일꾼을 실제로 띄워서 끝까지 (plugin/host.mjs · worker.mjs · work.mjs · screen.mjs):
// 브라우저와 같은 답장 코드(src/)가 서버에서 돌아요. 모델은 가짜 HTTP 서버, 실리 서버는 가짜 다리, 저장은 임시 폴더. 예시 캐릭터만 써요.
process.env.NA_SCREEN_ANYWHERE = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore } from '../plugin/store.mjs';
import { startAuto } from '../plugin/host.mjs';
import { splitLive, joinLive } from '../src/phone2keep.js';
import { startFresh, startFromStory, putLivePhone, ensureRoom, sendLive, liveWorld, enqueueJob } from '../src/phone2store.js';
import { buildKit, putKit } from '../src/phone2kit.js';
import * as SP from '../src/stprofile.js';
import { fakeSt } from './stfake.mjs';
import { fakeBridge, stCard, chatFile, cardPng } from './stbridge.mjs';
// (the request template is made by the real ai.js, as the browser makes it: that file needs the do-nothing screen to load)
await import('../plugin/screen.mjs');
const AI = await import('../src/ai.js');

const listen = handler => new Promise(ok => { const s = http.createServer(handler); s.listen(0, '127.0.0.1', () => ok(s)); });
const bodyOf = req => new Promise(ok => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { ok(JSON.parse(b || 'null')); } catch { ok(b); } }); });
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const week = blocks => ({ weekStart: new Date(Date.now() - 86400000).toISOString(), days: Object.fromEntries(DAYS.map(d => [d, blocks.map(b => ({ ...b }))])), inactivityThresholdMinutes: 60, talkativeness: 50 });
const card = stCard;
const BROWSER = () => ({ name1: 'Ren', chatId: 'Mara - 2026-11-22', characterId: 0, characters: ['Mara', 'Ivo'].map(card), powerUserSettings: { persona_description: 'Ren is a student.' } });
const { VERSION } = await import('../src/core.js');
// (SillyTavern's chat file of the example chat: the role-play messages the server reads each reply)
const said = (name, mes, user = false) => ({ name, is_user: user, mes, send_date: '2026-11-22' });
const MESSAGES = () => [said('Mara', 'hello there'), said('Ren', 'hi', true), said('Mara', 'want bread?'), said('Mara', 'see you'), said('Mara', 'on my way'), said('Ren', 'ok', true)];
// (SillyTavern's settings.json: the persona Ren, and Varo for the tests that switch)
const PERSONAS = { personas: { 'ren.png': 'Ren', 'varo.png': 'Varo' }, persona_descriptions: { 'ren.png': { description: 'Ren is a student.' }, 'varo.png': { description: 'Varo is a pilot.' } } };

// 세계 하나: Ren(나)과 Mara의 방. Ren이 7시간 전에 말했고 Mara가 바로 답했어요. 먼저 말 걸기 켬
function world({ story = false, schedule = null, kit = true, st = null, pt = null, levels = null, members = ['Mara'], hoursAgo = 7, version = VERSION, browser = BROWSER() } = {}) {
    const m = {};
    if (story) { startFromStory(m, { persona: 'Ren', upto: 3, now: Date.now() - 10 * 3600_000 }); liveWorld(m).snap = { v: 1, at: 1, upto: 3, text: '## #0–#3 — start\n- they met at the bakery\n', recent: ['[#3] Mara: see you'], made: { from: 0, to: 3, count: 4, parts: 1 } }; }
    else startFresh(m, { persona: 'Ren', now: Date.now() - 10 * 3600_000 });
    for (const n of members) putLivePhone(m, { owner: n });
    const room = ensureRoom(m, members), w = liveWorld(m), at = Date.now() - hoursAgo * 3600_000;
    sendLive(m, room.id, 'hey', at);
    room.messages.push({ id: 't2', n: 2, from: members[0], text: 'hi', at: at + 60_000 });
    w.presence = { on: true, schedules: schedule ? { mara: schedule } : {}, overrides: {}, meta: {}, user: {} };
    if (kit) { const k = buildKit(browser, m, { version }); k.st = st || {}; if (pt) k.pt = pt; if (levels) k.levels = levels; putKit(m, k); }
    return { m, w, room, id: `${w.id}:${room.id}` };
}

// 한 판: 임시 사용자 폴더 + 저장 + 가짜 모델 + 가짜 다리 + 일꾼
async function stage(t, { settings = {}, cm = null, more = {}, files = {}, reply = () => ({ reply: ['you there?'], status: '' }), bridge = true, schedule = false, code = null, merge = 200, oldBridge = false } = {}) {
    const root = await mkdtemp(path.join(tmpdir(), 'na-work-'));
    const asked = [];
    const model = await listen(async (req, res) => { const body = await bodyOf(req); asked.push({ url: req.url, auth: req.headers.authorization, body }); const a = await reply(body); if (a?.httpStatus) { res.statusCode = a.httpStatus; res.end(JSON.stringify({ error: { message: a.error || 'no' } })); return; } res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: typeof a === 'string' ? a : JSON.stringify(a) }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } })); });
    const cards = [card('Mara'), card('Ivo')];
    const br = bridge ? await fakeBridge({ cards: () => cards, avatars: () => ['ren.png', 'varo.png'], more: async (req, body, res) => {
        if (req.url === '/api/backends/chat-completions/generate') { res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(await reply(body)) }, finish_reason: 'stop' }] })); return true; }
        if (req.url === '/api/characters/merge-attributes' && merge !== 200) { res.statusCode = merge; res.end('{}'); return true; }
        // (an older plugin's bridge: these ways are not open — plugin/bridge.mjs allowed() answers 404)
        if (oldBridge && ['/api/characters/all', '/api/characters/get', '/api/avatars/get'].includes(req.url)) { res.statusCode = 404; res.end('{}'); return true; }
        // (a text-completion backend that runs on past its answer: SillyTavern cuts the stop sequence off — custom-request.js 331–382)
        if (req.url === '/api/backends/text-completions/generate') { res.end(JSON.stringify({ choices: [{ text: `${JSON.stringify(await reply(body))}\n### Instruction: and more` }] })); return true; }
        return false;
    } }) : null;
    const st = br ? br.seen : [];
    const url = `http://127.0.0.1:${model.address().port}/v1`;
    await writeFile(path.join(root, 'settings.json'), JSON.stringify({ main_api: 'openai', user_avatar: 'ren.png', power_user: { ...PERSONAS }, oai_settings: { reverse_proxy: 'https://proxy.example', proxy_password: 'PW-SECRET' }, extension_settings: { connectionManager: cm || { profiles: [{ id: 'p1', name: 'My profile', api: 'openai', model: 'x' }] }, narrative_archive: { draftConn: { mode: 'custom', url, key: 'MODEL-KEY', model: 'fake-model' }, ...settings } }, ...more }));
    for (const [f, v] of Object.entries(files)) { await mkdir(path.dirname(path.join(root, f)), { recursive: true }); await writeFile(path.join(root, f), JSON.stringify(v)); }
    // (SillyTavern's chat file of the example chat: the server runs an Orbit only while its chat is there)
    const chatAt = path.join(root, 'chats', 'mara', 'Mara - 2026-11-22.jsonl'), writeChat = (meta = {}, messages = MESSAGES()) => writeFile(chatAt, chatFile(meta, messages));
    await mkdir(path.join(root, 'chats', 'mara'), { recursive: true }); await writeChat();
    const store = openStore(root);
    const auto = startAuto({ root, store, bridge: br ? { url: br.url, token: br.token } : null, schedule, code });
    t.after(async () => { await auto.stop(); model.close(); br?.close(); await rm(root, { recursive: true, force: true }); });
    await auto.ready;
    const put = (sid, m) => store.save(sid, { parts: JSON.parse(JSON.stringify(splitLive(m.live))), chat: 'chat-1' });
    const get = async sid => liveWorld({ live: joinLive((await store.load(sid)).parts) });
    const check = id => auto.inject('/api/conversation/autonomous/check', { chatId: id, userStatus: 'idle', maxFollowups: 2, source: 'server' });
    const gen = (id, more = {}) => auto.inject('/api/generate', { chatId: id, connectionId: null, forCharacterId: 'mara', streaming: false, userStatus: 'idle', userActivity: 'away or offline', autonomous: true, skipPresenceDelay: true, autonomousIntentKey: 'check_in', ...more });
    return { root, store, auto, asked, st, put, get, check, gen, url, cards, writeChat };
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

test('일꾼: 이야기에서 시작한 폰 — 이야기 요약본과 실리 채팅 파일의 롤플 끝 메시지가 들어가요 (요약본을 늘리지 않아요)', async t => {
    const S = await stage(t), a = world({ story: true });
    await S.put('sa', a.m); await S.auto.list();
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const text = textOf(S.asked[0].body);
    assert.match(text, /\[STORY\]\n## #0–#3 — start\n- they met at the bakery/);
    assert.match(text, /\[LAST MESSAGES\]\nMara: hello there\n\nRen: hi\n\nMara: want bread\?\n\nMara: see you\n\nMara: on my way\n\nRen: ok\n/);
    assert.equal(S.asked.length, 1);
    assert.deepEqual((await S.get('sa')).snap.upto, 3);
});

test('일꾼: 서버가 읽을 묶음이 없는 세계는 목록에 없고, 만들라고 해도 안 만들어요', async t => {
    const S = await stage(t), a = world({ kit: false }), b = world();
    await S.put('sa', a.m); await S.put('sb', b.m);
    assert.deepEqual((await S.auto.list()).map(r => r.id), [b.id]);
    assert.equal((await S.gen(a.id)).statusCode, 404);
    assert.equal(S.asked.length, 0);
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, /서버 데이터가 없습니다/.test(x.why)]), [[false, true]]);
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
    assert.equal(ra.statusCode, 400); assert.match(ra.payload, /요청 템플릿이 없습니다/);
    const rb = await S.gen(b.id);
    assert.equal(rb.statusCode, 400, rb.payload); assert.match(rb.payload, /연결 프로필의 요청 틀이 아직 없어요/);
    assert.match((await S.auto.status('sa'))[0].why, /요청 템플릿이 없습니다/);
    assert.equal(S.asked.length + S.st.filter(x => x.url.includes('generate')).length, 0);
    for (const [sid, x] of [['sa', a], ['sb', b]]) { const w = await S.get(sid); assert.equal(w.messenger.rooms[x.room.id].messages.length, 2); assert.equal(w.queue.jobs.length, 0); }
});

// ---- 연결 프로필 (docs/PHONE2-PLAN.md 3-2c): 브라우저가 실리 자신의 sendRequest로 떠 둔 틀 → 서버가 실리 서버의 처리기로
const PROFILE = { id: 'p1', name: 'My profile', api: 'openrouter', model: 'or/model', preset: 'Quiet', proxy: 'Home', 'secret-id': 'sec-1' };
const ST_SET = () => ({
    profiles: [PROFILE],
    oai: { reverse_proxy: '', proxy_password: 'OAI-PW', chat_completion_source: 'openrouter', temp_openai: 1, openai_max_tokens: 300 },
    presets: { Quiet: { temp_openai: 0.7, openai_max_tokens: 900, chat_completion_source: 'openrouter', show_thoughts: true, reverse_proxy: 'https://preset.proxy', proxy_password: 'PRESET-PW' } },
    proxies: [{ name: 'Home', url: 'https://home.proxy', password: 'PROXY-PW' }],
});
// (the browser's part: SillyTavern — here its stand-in, tests/stfake.mjs — builds the request; src/stprofile.js keeps it)
const templatesOf = async (st, profile, over = null) => SP.profileTemplates({ send: (messages, max) => st.sendRequest(profile.id, messages, max, { stream: false, extractData: true, includePreset: true, includeInstruct: true }, ...(over ? [over] : [])), profile, over, find: st.find });
// (SillyTavern's settings files as the browser left them: the profiles, the proxies, the preset file)
const stageOf = (t, set, more = {}) => stage(t, { cm: { profiles: set.profiles, ...(more.selected ? { selectedProfile: more.selected } : {}) }, more: { oai_settings: set.oai, proxies: set.proxies }, files: Object.fromEntries(Object.entries(set.presets).map(([n, v]) => [`OpenAI Settings/${n}.json`, v])), ...(more.stage || {}) });

test('일꾼: 연결 프로필 방 — 실리가 브라우저에서 보낼 것과 똑같은 요청을 실리 서버의 처리기로. 비밀번호는 실리 설정에서', async t => {
    const set = ST_SET(), st = fakeSt(set), pt = await templatesOf(st, PROFILE);
    assert.doesNotMatch(JSON.stringify(pt), /PW/);
    const S = await stageOf(t, set), a = world({ pt });
    liveWorld(a.m).messenger.rooms[a.room.id].connectionId = 'profile:p1';
    await S.put('sa', a.m); await S.auto.list();
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[true, '']]);
    const r = await S.gen(a.id);
    assert.match(r.payload, /"message_saved"/, r.payload);
    assert.equal(S.asked.length, 0);                                       // (초안 모델로는 안 갔어요)
    const sent = S.st.filter(x => x.url === '/api/backends/chat-completions/generate');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].token, 'tok-123');
    // 실리가 이 메시지로 보낼 몸통과 같아요 (답 길이: 답장 한 번의 값)
    assert.deepEqual(sent[0].body, st.build('p1', sent[0].body.messages, 4000).body);
    assert.equal(sent[0].body.proxy_password, 'PROXY-PW');
    assert.deepEqual(sent[0].body.messages.map(m => m.role), ['system', 'user']);
    assert.match(sent[0].body.messages[0].content, /^GOAL\nYou are Mara\./);
    assert.equal((await S.get('sa')).messenger.rooms[a.room.id].messages.at(-1).text, 'you there?');
});

test('일꾼: 실리 쪽 방(AI 기능 모델이 실리) — 실리에서 지금 고른 프로필로. 고른 프로필이 없으면 이유를 알려요', async t => {
    const set = ST_SET(), st = fakeSt(set), pt = await templatesOf(st, PROFILE);
    const S = await stageOf(t, set, { selected: 'p1', stage: { settings: { aiConn: { mode: 'st' } } } }), a = world({ pt });
    liveWorld(a.m).messenger.rooms[a.room.id].connectionId = 'ai';
    await S.put('sa', a.m); await S.auto.list();
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const sent = S.st.find(x => x.url === '/api/backends/chat-completions/generate');
    assert.deepEqual(sent.body, st.build('p1', sent.body.messages, 4000).body);
    // (고른 프로필이 없는 실리: 서버는 실리의 지금 연결로는 못 보내요)
    const S2 = await stageOf(t, set, { stage: { settings: { aiConn: { mode: 'st' } } } }), b = world({ pt });
    liveWorld(b.m).messenger.rooms[b.room.id].connectionId = 'ai';
    await S2.put('sb', b.m); await S2.auto.list();
    assert.match((await S2.auto.status('sb'))[0].why, /선택된 연결 프로필이 없습니다/);
    assert.equal((await S2.gen(b.id)).statusCode, 400);
    assert.equal(S2.st.filter(x => x.url.includes('generate')).length + S2.asked.length, 0);
    // (실리가 보낼 수 없는 종류의 프로필을 골라 뒀으면 — 브라우저가 남긴 목록에 없어요 — 브라우저처럼 "고른 프로필 없음")
    const c = world({ pt }), k = liveWorld(c.m) && c.m.live.kit; k.profiles = [];
    liveWorld(c.m).messenger.rooms[c.room.id].connectionId = 'ai';
    await S.put('sc', c.m);
    assert.match((await S.auto.status('sc'))[0].why, /선택된 연결 프로필이 없습니다/);
});

test('일꾼: 방의 추론 레벨을 얹은 프로필 요청 — 브라우저가 실리 코드로 만든 값 그대로. 그 값이 없으면 안 보내요', async t => {
    const set = ST_SET(), st = fakeSt(set), over = { reasoning_effort: 'high', include_reasoning: true }, pt = await templatesOf(st, PROFILE, over);
    const levels = { [SP.levelKey('openrouter', 'or/model', 'high')]: over };
    const S = await stageOf(t, set), a = world({ pt, levels }), b = world({ pt });
    for (const x of [a, b]) { const room = liveWorld(x.m).messenger.rooms[x.room.id]; room.connectionId = 'profile:p1'; room.chatParameters = { reasoningEffort: 'high' }; }
    await S.put('sa', a.m); await S.put('sb', b.m); await S.auto.list();
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const sent = S.st.find(x => x.url === '/api/backends/chat-completions/generate');
    assert.deepEqual(sent.body, st.build('p1', sent.body.messages, 4000, over).body);
    assert.equal(sent.body.reasoning_effort, 'high');
    assert.match((await S.auto.status('sb'))[0].why, /추론 레벨의 요청 값이 없습니다/);
    // (브라우저에서 실리 코드가 그 레벨을 못 만들었으면: 그 이유가 그대로)
    const c = world({ pt, levels: { [SP.levelKey('openrouter', 'or/model', 'high')]: { why: '이 실리 버전에서는 연결 프로필에 추론 레벨을 적용할 수 없습니다. 실리를 업데이트하세요.' } } });
    Object.assign(liveWorld(c.m).messenger.rooms[c.room.id], { connectionId: 'profile:p1', chatParameters: { reasoningEffort: 'high' } });
    await S.put('sc', c.m);
    assert.match((await S.auto.status('sc'))[0].why, /이 실리 버전에서는 연결 프로필에 추론 레벨을 적용할 수 없습니다\. 실리를 업데이트하세요/);
});

test('일꾼: 실리에서 프로필이 바뀌었거나 프리셋 파일이 없으면 예전 틀로 보내지 않아요', async t => {
    const set = ST_SET(), pt = await templatesOf(fakeSt(set), PROFILE);
    const changed = { ...set, profiles: [{ ...PROFILE, model: 'or/other' }] };
    const S = await stageOf(t, changed), a = world({ pt });
    liveWorld(a.m).messenger.rooms[a.room.id].connectionId = 'profile:p1';
    await S.put('sa', a.m); await S.auto.list();
    assert.match((await S.auto.status('sa'))[0].why, /연결 프로필이 변경되었습니다/);
    assert.equal((await S.gen(a.id)).statusCode, 400);
    const S2 = await stageOf(t, { ...set, presets: {} }), b = world({ pt });
    liveWorld(b.m).messenger.rooms[b.room.id].connectionId = 'profile:p1';
    await S2.put('sb', b.m); await S2.auto.list();
    const r = await S2.gen(b.id);
    assert.match(r.payload, /"type":"error"[^\n]*프리셋을 찾을 수 없습니다: Quiet/);
    assert.equal([...S.st, ...S2.st].filter(x => x.url.includes('generate')).length, 0);
});

test('일꾼: 글 완성 프로필 방 — 지시 형식이 감싼 글로 실리 서버의 글 완성 처리기에, 답은 실리처럼 멈춤 글을 잘라서', async t => {
    const ins = { system_sequence: '### System:', input_sequence: '### Instruction:', output_sequence: '### Response:', stop_sequence: '</s>', last_output_sequence: '' };
    const TC = { id: 't1', mode: 'tc', api: 'koboldcpp', model: 'k', 'api-url': 'http://127.0.0.1:5001', instruct: 'Alpaca' };
    const set = { ...ST_SET(), profiles: [TC], instructs: { Alpaca: ins } }, st = fakeSt(set), pt = await templatesOf(st, TC);
    const S = await stageOf(t, set), a = world({ pt });
    liveWorld(a.m).messenger.rooms[a.room.id].connectionId = 'profile:t1';
    await S.put('sa', a.m); await S.auto.list();
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const sent = S.st.find(x => x.url === '/api/backends/text-completions/generate');
    assert.ok(sent);
    assert.match(sent.body.prompt, /^### System:\nGOAL\nYou are Mara\.[\s\S]*\n### Instruction:\n\[MESSENGER\][\s\S]*### Response:\n$/);
    assert.equal(sent.body.max_tokens, 4000);
    assert.equal((await S.get('sa')).messenger.rooms[a.room.id].messages.at(-1).text, 'you there?');
});

test('일꾼: 모델이 실패하면 말이 안 들어가고, 실패로 알려요. 쉬는 것은 스케줄러가 해요 (마리나라처럼: 방에는 안 적어요)', async t => {
    const S = await stage(t, { reply: () => ({ httpStatus: 500, error: 'boom' }) }), a = world();
    await S.put('sa', a.m); await S.auto.list();
    const r = await S.gen(a.id);
    assert.equal(r.statusCode, 200); assert.match(r.payload, /"type":"error"/);
    const w = await S.get('sa'), room = w.messenger.rooms[a.room.id];
    assert.equal(room.messages.length, 2); assert.equal(room.autoFail, undefined);
    assert.equal(w.presence.meta.autonomousDailyBudget, undefined);
    assert.equal(w.queue.jobs.length, 0);
    // (다시 시키면 다시 만들어요: 그 채팅을 쉬게 하는 것은 스케줄러의 recordFailureBackoff — tests/pluginauto.test.mjs)
    assert.match((await S.gen(a.id)).payload, /"type":"error"/);
    assert.equal(S.asked.length, 2);
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

test('일꾼 · 방 자물쇠: 브라우저 탭이 그 방을 쥐고 있으면 먼저 건 말을 안 만들어요(409: 스케줄러는 실패로 안 세요). 놓으면 만들어요', async t => {
    const S = await stage(t), a = world();
    await S.put('sa', a.m); await S.auto.list();
    assert.deepEqual(await S.auto.claim('sa', a.room.id, 'browser:tab1'), { ok: true });
    const r = await S.gen(a.id);
    assert.deepEqual([r.statusCode, r.payload], [409, 'the browser is writing in this room now']);
    assert.equal(S.asked.length, 0);
    assert.equal((await S.get('sa')).messenger.rooms[a.room.id].messages.length, 2);
    // (다른 저장의 같은 방 id는 따로예요)
    assert.deepEqual(await S.auto.claim('other', a.room.id, 'server'), { ok: true });
    await S.auto.release('other', a.room.id, 'server');
    // 놓으면
    await S.auto.release('sa', a.room.id, 'browser:tab1');
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    assert.equal(S.asked.length, 1);
});

test('일꾼 · 방 자물쇠: 일꾼이 만드는 동안 브라우저 탭은 그 방을 못 잡아요(일꾼이 쥔 것을 알려요). 끝나면 놓아서 잡을 수 있어요', async t => {
    let hold; const gate = new Promise(r => { hold = r; });
    const S = await stage(t, { reply: async () => { await gate; return { reply: ['you there?'], status: '' }; } }), a = world();
    await S.put('sa', a.m); await S.auto.list();
    const going = S.gen(a.id);
    while (!S.asked.length) await new Promise(r => setTimeout(r, 10));
    assert.deepEqual(await S.auto.claim('sa', a.room.id, 'browser:tab1'), { ok: false, by: 'server', at: (await S.auto.claim('sa', a.room.id, 'browser:tab1')).at });
    assert.equal((await S.auto.claim('sa', a.room.id, 'browser:tab1')).by, 'server');
    // (이어 잡기도 안 돼요: 쥔 게 아니에요)
    assert.equal(await S.auto.renew('sa', a.room.id, 'browser:tab1'), false);
    hold();
    assert.match((await going).payload, /"message_saved"/);
    assert.deepEqual(await S.auto.claim('sa', a.room.id, 'browser:tab1'), { ok: true });
    assert.equal(await S.auto.renew('sa', a.room.id, 'browser:tab1'), true);
});

test('일꾼 · 방 자물쇠: 늦은 답장을 돌릴 때 브라우저가 쥔 방은 이번엔 건너뛰고(그 일은 기다려요), 같은 Orbit의 다른 방은 돌려요', async t => {
    const S = await stage(t, { reply: () => ({ reply: ['sorry, was busy'], status: '' }) });
    const a = world({ hoursAgo: 0.2 }), other = ensureRoom(a.m, ['Mara', 'Ivo']);
    putLivePhone(a.m, { owner: 'Ivo' });
    sendLive(a.m, other.id, 'anyone?', Date.now() - 600_000);
    for (const room of [a.room.id, other.id]) { const j = enqueueJob(a.m, { kind: 'reply', owner: 'Mara', room, at: Date.now() - 600_000 }); Object.assign(j, { timed: true, notBefore: Date.now() - 1000 }); }
    await S.put('sa', a.m);
    assert.deepEqual(await S.auto.claim('sa', a.room.id, 'browser:tab1'), { ok: true });
    assert.equal(await S.auto.sweep(), 1);
    const w = await S.get('sa');
    assert.equal(w.messenger.rooms[a.room.id].messages.at(-1).text, 'hi');
    assert.equal(w.messenger.rooms[other.id].messages.at(-1).text, 'sorry, was busy');
    assert.deepEqual(w.queue.jobs.filter(j => j.state === 'waiting').map(j => j.room), [a.room.id]);
    // 놓으면 다음 번에 돌아요
    await S.auto.release('sa', a.room.id, 'browser:tab1');
    assert.equal(await S.auto.sweep(), 1);
    assert.equal((await S.get('sa')).messenger.rooms[a.room.id].messages.at(-1).text, 'sorry, was busy');
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

test('일꾼: 때가 된 늦은 답장을 보내요 — 브라우저가 보고 있어도(마리나라처럼). 서버가 못 보내는 방 · 아직 때가 아닌 것은 기다려요', async t => {
    const S = await stage(t, { reply: () => ({ reply: ['sorry, was busy'], status: '' }) });
    const mk = (more = () => {}) => { const x = world({ hoursAgo: 0.2 }); const j = enqueueJob(x.m, { kind: 'reply', owner: 'Mara', room: x.room.id, at: Date.now() - 600_000 }); Object.assign(j, { timed: true, notBefore: Date.now() - 1000 }); more(x, j); return x; };
    const a = mk(), b = mk(), c = mk(x => { liveWorld(x.m).messenger.rooms[x.room.id].connectionId = 'profile:p1'; }), d = mk((x, j) => { j.notBefore = Date.now() + 3600_000; });
    await S.put('sa', a.m); await S.put('sb', b.m); await S.put('sc', c.m); await S.put('sd', d.m);
    await S.auto.presence('sb', 'active');
    assert.equal(await S.auto.sweep(), 2);
    for (const [sid, x] of [['sa', a], ['sb', b]]) assert.equal((await S.get(sid)).messenger.rooms[x.room.id].messages.at(-1).text, 'sorry, was busy', sid);
    for (const [sid, x] of [['sc', c], ['sd', d]]) { const w = await S.get(sid); assert.equal(w.messenger.rooms[x.room.id].messages.length, 2, sid); assert.equal(w.queue.jobs.filter(j => j.state === 'waiting').length, 1, sid); }
    assert.equal(S.asked.length, 2);
    // (연결 프로필을 고른 방은 그 요청 틀이 없으면, 초안 모델이 커스텀 API여도 서버가 대신 답하지 않아요: 다른 모델로 답하게 돼요)
    await S.auto.list();
    const rc = await S.gen(c.id);
    assert.equal(rc.statusCode, 400); assert.match(rc.payload, /연결 프로필/);
    assert.equal(S.asked.length, 2);
    // (늦은 답장은 내가 자리에 없다고 적지 않아요: 먼저 건 말이 아니에요)
    assert.doesNotMatch(textOf(S.asked[0].body), /away or offline|\[WHY NOW\]\n/);
});

test('일꾼: 확장과 플러그인의 버전이 다르면 · 실리에서 그 채팅을 지웠으면 안 돌려요 (이유를 알려요)', async t => {
    const S = await stage(t), old = world({ version: '0.0.1' }), gone = world({ browser: { ...BROWSER(), chatId: 'Mara - deleted' } }), odd = world({ browser: { ...BROWSER(), chatId: '../../settings' } }), fine = world();
    await S.put('s1', old.m); await S.put('s2', gone.m); await S.put('s3', odd.m); await S.put('s4', fine.m);
    assert.deepEqual((await S.auto.list()).map(r => r.id), [fine.id]);
    assert.match((await S.auto.status('s1'))[0].why, /버전이 다릅니다\. 서버 플러그인을 업데이트하고 실리를 다시 시작하세요/);
    assert.match((await S.auto.status('s2'))[0].why, /^채팅을 찾을 수 없습니다\.$/);
    assert.match((await S.auto.status('s3'))[0].why, /연결된 실리 채팅을 찾을 수 없습니다/);
    assert.equal((await S.auto.status('s4'))[0].can, true);
    // 늦은 답장도 안 보내요
    for (const x of [old, gone]) { const j = enqueueJob(x.m, { kind: 'reply', owner: 'Mara', room: x.room.id, at: Date.now() - 600_000 }); Object.assign(j, { timed: true, notBefore: Date.now() - 1000 }); }
    await S.put('s5', old.m); await S.put('s6', gone.m);
    assert.equal(await S.auto.sweep(), 0);
    assert.equal(S.asked.length, 0);
});

test('일꾼: 늦은 답장은 그 시각에 바로 보내요 (마리나라의 setTimeout). 브라우저가 새로 저장한 것도 곧 봐요', async t => {
    const S = await stage(t, { reply: () => ({ reply: ['sorry, was busy'], status: '' }), schedule: true });
    const x = world({ hoursAgo: 0.2 }), j = enqueueJob(x.m, { kind: 'reply', owner: 'Mara', room: x.room.id, at: Date.now() - 600_000 });
    Object.assign(j, { timed: true, notBefore: Date.now() + 60_000 });
    await S.put('sa', x.m);
    S.auto.wrote();
    // (브라우저가 저장한 뒤 1초 안에 보고, 그때는 아직 아니라서 그 시각을 기억해요)
    await new Promise(r => setTimeout(r, 1600));
    assert.equal(S.asked.length, 0);
    // 브라우저가 시각을 당겨 저장해요: 저장 뒤 1초에 한 번 보고(아직 아님), 그 시각에 다시 봐요. 30초를 기다리지 않아요
    const again = await S.store.load('sa'), live = joinLive(again.parts), due = Date.now() + 3000;
    live.world.queue.jobs[0].notBefore = due;
    await S.store.save('sa', { base: again.rev, parts: JSON.parse(JSON.stringify(splitLive(live))) });
    S.auto.wrote();
    const until = Date.now() + 9000;
    while (!S.asked.length && Date.now() < until) await new Promise(r => setTimeout(r, 50));
    assert.equal(S.asked.length, 1);
    assert.ok(Date.now() >= due - 100 && Date.now() < due + 3000, String(Date.now() - due));
    while (Date.now() < until && (await S.get('sa')).messenger.rooms[x.room.id].messages.at(-1).text !== 'sorry, was busy') await new Promise(r => setTimeout(r, 100));
    assert.equal((await S.get('sa')).messenger.rooms[x.room.id].messages.at(-1).text, 'sorry, was busy');
});

test('일꾼: 서버가 못 보내는 방은 그 방만 건너뛰고, 같은 Orbit의 다른 방은 보내요', async t => {
    const S = await stage(t, { reply: () => ({ reply: ['sorry, was busy'], status: '' }) });
    const a = world({ hoursAgo: 0.2 }), other = ensureRoom(a.m, ['Mara', 'Ivo']);
    putLivePhone(a.m, { owner: 'Ivo' });
    sendLive(a.m, other.id, 'anyone?', Date.now() - 600_000);
    liveWorld(a.m).messenger.rooms[other.id].connectionId = 'profile:p1';
    for (const room of [a.room.id, other.id]) { const j = enqueueJob(a.m, { kind: 'reply', owner: 'Mara', room, at: Date.now() - 600_000 }); Object.assign(j, { timed: true, notBefore: Date.now() - 1000 }); }
    await S.put('sa', a.m);
    assert.equal(await S.auto.sweep(), 1);
    const w = await S.get('sa');
    assert.equal(w.messenger.rooms[a.room.id].messages.at(-1).text, 'sorry, was busy');
    assert.equal(w.messenger.rooms[other.id].messages.at(-1).text, 'anyone?');
    assert.deepEqual(w.queue.jobs.filter(j => j.state === 'waiting').map(j => j.room), [other.id]);
});

test('일꾼: 먼저 건 말 뒤에 캐릭터끼리 주고받기를 안 해요 (마리나라의 서버 스케줄러처럼: 주고받기는 브라우저만)', async t => {
    const S = await stage(t, { reply: () => ({ reply: ['hey all'], status: '' }) });
    const a = world({ members: ['Mara', 'Ivo'] });
    liveWorld(a.m).presence.meta.characterExchanges = true;
    await S.put('sa', a.m); await S.auto.list();
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const w = await S.get('sa');
    assert.equal(w.queue.jobs.filter(j => j.state === 'waiting').length, 0);
    assert.equal(S.asked.length, 1);
});

test('일꾼: 확장 폴더의 코드로 돌 때는 페이지가 옛 버전이어도 멈추지 않아요 (그 코드가 지금 설치된 확장)', async t => {
    const { OWN_DIR } = await import('../plugin/code.mjs');
    const S = await stage(t, { reply: () => ({ reply: ['sorry, was busy'], status: '' }), code: { dir: OWN_DIR, version: VERSION, from: 'extension' } }), old = world({ version: '0.0.1', hoursAgo: 0.2 });
    const j = enqueueJob(old.m, { kind: 'reply', owner: 'Mara', room: old.room.id, at: Date.now() - 600_000 }); Object.assign(j, { timed: true, notBefore: Date.now() - 1000 });
    await S.put('s1', old.m);
    assert.deepEqual((await S.auto.status('s1')).map(r => [r.can, r.why]), [[true, '']]);
    assert.equal(await S.auto.sweep(), 1);
    assert.equal((await S.get('s1')).messenger.rooms[old.room.id].messages.at(-1).text, 'sorry, was busy');
});

// ---- 실리에서 고친 것이 바로 (docs/SERVER-HANDOVER.md): 서버는 답장마다 실리 파일과 실리 서버의 처리기에서 새로 읽어요
test('일꾼 · 실리에서 바로: 카드를 고치면 다음 답장부터 새 카드로. 간단한 카드로 온 것은 그 카드를 따로 읽어요', async t => {
    const S = await stage(t), a = world({ hoursAgo: 0.2 });
    const j = enqueueJob(a.m, { kind: 'reply', owner: 'Mara', room: a.room.id, at: Date.now() - 600_000 }); Object.assign(j, { timed: true, notBefore: Date.now() - 1000 });
    await S.put('sa', a.m);
    // (실리에서 카드를 고쳤어요: 브라우저는 아무것도 안 했어요)
    Object.assign(S.cards[0], { description: 'Mara is a pilot now.', data: { ...S.cards[0].data, description: 'Mara is a pilot now.' } });
    assert.equal(await S.auto.sweep(), 1);
    assert.match(textOf(S.asked[0].body), /\[Mara's card\]\n\[description\]\nMara is a pilot now\./);
    // (실리가 목록을 간단한 카드로 줄 때 — lazyLoadCharacters —: 그 카드를 /api/characters/get으로 통째로)
    S.cards[0].shallow = true;
    const b = world();
    await S.put('sb', b.m); await S.auto.list();
    assert.match((await S.gen(b.id)).payload, /"message_saved"/);
    assert.match(textOf(S.asked[1].body), /Mara is a pilot now\./);
    assert.ok(S.st.some(x => x.url === '/api/characters/get' && x.body.avatar_url === 'mara.png'));
});

test('일꾼 · 실리에서 바로: 롤플에 새 메시지가 생기면 다음 답장의 LAST MESSAGES에', async t => {
    const S = await stage(t), a = world({ story: true });
    await S.put('sa', a.m); await S.auto.list();
    await S.writeChat({}, [...MESSAGES(), said('Mara', 'at the door now')]);
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    assert.match(textOf(S.asked[0].body), /\[LAST MESSAGES\]\n[\s\S]*Ren: ok\n\nMara: at the door now\n/);
});

test('일꾼 · 실리에서 바로: 페르소나 — 그 채팅에서 마지막으로 쓴 것, 없으면 실리가 그 채팅을 열 때 고를 것(채팅 잠금 · 연결 · 기본 페르소나)', async t => {
    const S = await stage(t), a = world(), b = world(), c = world();
    await S.put('sa', a.m); await S.put('sb', b.m); await S.put('sc', c.m); await S.auto.list();
    // (브라우저가 이 채팅에 적어 둔 페르소나: 빠른 전환기로 Varo로 바꿨어요)
    await S.writeChat({ narrative_archive: { stPersona: 'varo.png' } });
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    let text = textOf(S.asked[0].body);
    assert.match(text, /\[PERSONA — Varo\]\nVaro is a pilot\./);
    assert.match(text, /Varo is texting you on MESSENGER/);
    // (먼저 거는 까닭도 그 이름으로: 무엇이든 정하기 전에 "나"가 따라가요)
    assert.match(text, /\[WHY NOW\]\nYou have a free moment and Varo has been quiet\./);
    // (적어 둔 게 없는 옛 채팅: 실리 순서 — 채팅에 잠근 페르소나)
    // (실시간 폰의 "나"도 그 이름으로: 브라우저에서 페르소나를 바꿨을 때처럼)
    assert.equal((await S.get('sa')).persona, 'Varo');
    await S.writeChat({ persona: 'varo.png' });
    assert.match((await S.gen(b.id)).payload, /"message_saved"/);
    assert.match(textOf(S.asked[1].body), /\[PERSONA — Varo\]\nVaro is a pilot\./);
    // (잠금도 없으면 settings.json의 지금 페르소나)
    await S.writeChat({});
    assert.match((await S.gen(c.id)).payload, /"message_saved"/);
    text = textOf(S.asked[2].body);
    assert.match(text, /\[PERSONA — Ren\]\nRen is a student\./);
});

test('일꾼 · 실리에서 바로: 그룹 채팅 — 그룹 파일의 사람들로. 실리에서 그룹을 지우면 안 돌려요', async t => {
    const browser = { ...BROWSER(), characterId: undefined, groupId: 'g1', groups: [{ id: 'g1', members: ['mara.png'] }], chatId: 'grp-1' };
    const S = await stage(t, { files: { 'groups/g1.json': { id: 'g1', members: ['mara.png', 'gone.png'], chat_id: 'grp-1', chats: ['grp-1'] } } }), a = world({ browser });
    await mkdir(path.join(S.root, 'group chats'), { recursive: true }); await writeFile(path.join(S.root, 'group chats', 'grp-1.jsonl'), chatFile({}, MESSAGES()));
    assert.deepEqual(a.m.live.kit.chat, { avatar: null, group: { id: 'g1' }, file: { group: true, dir: null, id: 'grp-1' } });
    await S.put('sa', a.m); await S.auto.list();
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[true, '']]);
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    assert.match(textOf(S.asked[0].body), /\[Mara's card\]\n\[description\]\nMara is a baker\./);
    await rm(path.join(S.root, 'groups', 'g1.json'));
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[false, '채팅을 찾을 수 없습니다.']]);
});

test('일꾼 · 실리에서 바로: 카드의 확장 칸 쓰기는 실리처럼 — 저장이 실패해도 답장은 그대로(기록만 남겨요)', async t => {
    const S = await stage(t, { merge: 500, reply: () => ({ reply: ['brb'], status: { status: 'dnd', activity: 'in a meeting', duration: '30m' } }) });
    const a = world({ schedule: week([{ time: '00:00-23:59', activity: 'free time', status: 'online' }]) });
    await S.put('sa', a.m); await S.auto.list();
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    assert.ok(S.st.some(x => x.url === '/api/characters/merge-attributes'));
    assert.equal((await S.get('sa')).messenger.rooms[a.room.id].messages.at(-1).text, 'brb');
});

test('일꾼 · 다리가 없어도(실리 버전이 달라 실리 서버의 처리기를 못 붙임): 커스텀 API 방은 돌아요 — 카드는 카드 폴더에서 직접, 고친 것도 바로', async t => {
    const S = await stage(t, { bridge: false }), a = world({ hoursAgo: 0.2 }), b = world({ hoursAgo: 0.2 });
    await mkdir(path.join(S.root, 'characters'), { recursive: true });
    const save = desc => writeFile(path.join(S.root, 'characters', 'mara.png'), cardPng({ chara: { spec: 'chara_card_v2', spec_version: '2.0', name: 'Mara', data: { name: 'Mara', description: desc, personality: 'warm', extensions: { talkativeness: 0.5 } } } }));
    await save('Mara is a baker.');
    for (const x of [a, b]) { const j = enqueueJob(x.m, { kind: 'reply', owner: 'Mara', room: x.room.id, at: Date.now() - 600_000 }); Object.assign(j, { timed: true, notBefore: Date.now() - 1000 }); }
    await S.put('sa', a.m);
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[true, '']]);
    assert.equal(await S.auto.sweep(), 1);
    let text = textOf(S.asked[0].body);
    assert.match(text, /\[Mara's card\]\n\[description\]\nMara is a baker\./);
    assert.match(text, /\[PERSONA — Ren\]\nRen is a student\./);
    // (실리에서 카드를 고쳤어요)
    await save('Mara is a pilot now.');
    await S.put('sb', b.m);
    assert.equal(await S.auto.sweep(), 1);
    text = textOf(S.asked[1].body);
    assert.match(text, /Mara is a pilot now\./);
    assert.equal(S.asked.length, 2);
});

test('일꾼 · 플러그인을 안 받은 옛 다리(카드 길이 막혀 있음)여도: 카드를 카드 폴더에서 읽어 답해요 — 확장 업데이트만으로 돼요', async t => {
    const S = await stage(t, { oldBridge: true }), a = world({ hoursAgo: 0.2 });
    await mkdir(path.join(S.root, 'characters'), { recursive: true });
    await writeFile(path.join(S.root, 'characters', 'mara.png'), cardPng({ chara: { spec: 'chara_card_v2', spec_version: '2.0', name: 'Mara', data: { name: 'Mara', description: 'Mara from the folder.', extensions: {} } } }));
    const j = enqueueJob(a.m, { kind: 'reply', owner: 'Mara', room: a.room.id, at: Date.now() - 600_000 }); Object.assign(j, { timed: true, notBefore: Date.now() - 1000 });
    await S.put('sa', a.m);
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[true, '']]);
    assert.equal(await S.auto.sweep(), 1);
    const text = textOf(S.asked[0].body);
    assert.match(text, /\[Mara's card\]\n\[description\]\nMara from the folder\./);
    assert.match(text, /\[PERSONA — Ren\]\nRen is a student\./);
    assert.ok(S.st.some(x => x.url === '/api/characters/all'));
});
