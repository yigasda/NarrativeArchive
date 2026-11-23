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
import { stProfileRequest, stGenerationParameters } from './stfake.mjs';
import { fakeBridge, stCard, chatFile, cardPng, stUserDirs } from './stbridge.mjs';
// (the same do-nothing screen the worker runs under: the expected requests — tests/stfake.mjs — are made in the same globals)
await import('../plugin/screen.mjs');

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
function world({ story = false, schedule = null, kit = true, members = ['Mara'], hoursAgo = 7, version = VERSION, browser = BROWSER() } = {}) {
    const m = {};
    if (story) { startFromStory(m, { persona: 'Ren', upto: 3, now: Date.now() - 10 * 3600_000 }); liveWorld(m).snap = { v: 1, at: 1, upto: 3, text: '## #0–#3 — start\n- they met at the bakery\n', recent: ['[#3] Mara: see you'], made: { from: 0, to: 3, count: 4, parts: 1 } }; }
    else startFresh(m, { persona: 'Ren', now: Date.now() - 10 * 3600_000 });
    for (const n of members) putLivePhone(m, { owner: n });
    const room = ensureRoom(m, members), w = liveWorld(m), at = Date.now() - hoursAgo * 3600_000;
    sendLive(m, room.id, 'hey', at);
    room.messages.push({ id: 't2', n: 2, from: members[0], text: 'hi', at: at + 60_000 });
    w.presence = { on: true, schedules: schedule ? { mara: schedule } : {}, overrides: {}, meta: {}, user: {} };
    if (kit) putKit(m, buildKit(browser, m, { version }));
    return { m, w, room, id: `${w.id}:${room.id}` };
}

// 한 판: 임시 사용자 폴더 + 저장 + 가짜 모델 + 가짜 다리 + 일꾼
//   routes(req, body, res) → true면 다리의 그 요청은 거기서 끝 (로짓 바이어스 · 토크나이저 같은 실리 서버의 길)
async function stage(t, { settings = {}, cm = null, more = {}, files = {}, reply = () => ({ reply: ['you there?'], status: '' }), bridge = true, schedule = false, code = null, merge = 200, oldBridge = false, avatarsStatus = 200, routes = null, ext = {} } = {}) {
    const root = await mkdtemp(path.join(tmpdir(), 'na-work-'));
    // (SillyTavern's user folders, as it makes them for a user: the worker reads the preset folders each job)
    await stUserDirs(root);
    const asked = [];
    const model = await listen(async (req, res) => { const body = await bodyOf(req); asked.push({ url: req.url, auth: req.headers.authorization, body }); const a = await reply(body); if (a?.httpStatus) { res.statusCode = a.httpStatus; res.end(JSON.stringify({ error: { message: a.error || 'no' } })); return; } res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: typeof a === 'string' ? a : JSON.stringify(a) }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } })); });
    const cards = [card('Mara'), card('Ivo')];
    const br = bridge ? await fakeBridge({ cards: () => cards, avatars: () => ['ren.png', 'varo.png'], more: async (req, body, res) => {
        if (routes && await routes(req, body, res)) return true;
        if (req.url === '/api/backends/chat-completions/generate') { res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(await reply(body)) }, finish_reason: 'stop' }] })); return true; }
        if (req.url === '/api/characters/merge-attributes' && merge !== 200) { res.statusCode = merge; res.end('{}'); return true; }
        if (req.url === '/api/avatars/get' && avatarsStatus !== 200) { res.statusCode = avatarsStatus; res.end('{}'); return true; }
        // (an older plugin's bridge: these ways are not open — plugin/bridge.mjs allowed() answers 404)
        if (oldBridge && ['/api/characters/all', '/api/characters/get', '/api/avatars/get'].includes(req.url)) { res.statusCode = 404; res.end('{}'); return true; }
        // (a text-completion backend that runs on past its answer: SillyTavern cuts the stop sequence off — custom-request.js 331–382)
        if (req.url === '/api/backends/text-completions/generate') { res.end(JSON.stringify({ choices: [{ text: tcText(await reply(body)) }] })); return true; }
        return false;
    } }) : null;
    const st = br ? br.seen : [];
    const url = `http://127.0.0.1:${model.address().port}/v1`;
    // (SillyTavern's settings.json: written again by a test that changes something in SillyTavern between two jobs)
    const stSettings = { main_api: 'openai', user_avatar: 'ren.png', power_user: { ...PERSONAS }, oai_settings: { reverse_proxy: 'https://proxy.example', proxy_password: 'PW-SECRET' }, extension_settings: { connectionManager: cm || { profiles: [{ id: 'p1', name: 'My profile', api: 'openai', model: 'x' }] }, narrative_archive: { draftConn: { mode: 'custom', url, key: 'MODEL-KEY', model: 'fake-model' }, ...settings }, ...ext }, ...more };
    const writeSettings = (v = stSettings) => writeFile(path.join(root, 'settings.json'), JSON.stringify(v, null, 4));
    await writeSettings();
    const writeFiles = async fs => { for (const [f, v] of Object.entries(fs)) { await mkdir(path.dirname(path.join(root, f)), { recursive: true }); if (v === null) await rm(path.join(root, f), { force: true }); else await writeFile(path.join(root, f), JSON.stringify(v, null, 4)); } };
    await writeFiles(files);
    // (SillyTavern's chat file of the example chat: the server runs an Orbit only while its chat is there)
    const chatAt = path.join(root, 'chats', 'mara', 'Mara - 2026-11-22.jsonl'), writeChat = (meta = {}, messages = MESSAGES()) => writeFile(chatAt, chatFile(meta, messages));
    await mkdir(path.join(root, 'chats', 'mara'), { recursive: true }); await writeChat();
    // (SillyTavern's persona pictures: the same as the bridge lists)
    await mkdir(path.join(root, 'User Avatars'), { recursive: true });
    for (const f of ['ren.png', 'varo.png']) await writeFile(path.join(root, 'User Avatars', f), 'x');
    const store = openStore(root);
    const auto = startAuto({ root, store, bridge: br ? { url: br.url, token: br.token } : null, schedule, code });
    t.after(async () => { await auto.stop(); model.close(); br?.close(); await rm(root, { recursive: true, force: true }); });
    await auto.ready;
    const put = (sid, m) => store.save(sid, { parts: JSON.parse(JSON.stringify(splitLive(m.live))), chat: 'chat-1' });
    const get = async sid => liveWorld({ live: joinLive((await store.load(sid)).parts) });
    const check = id => auto.inject('/api/conversation/autonomous/check', { chatId: id, userStatus: 'idle', maxFollowups: 2, source: 'server' });
    const gen = (id, more = {}) => auto.inject('/api/generate', { chatId: id, connectionId: null, forCharacterId: 'mara', streaming: false, userStatus: 'idle', userActivity: 'away or offline', autonomous: true, skipPresenceDelay: true, autonomousIntentKey: 'check_in', ...more });
    return { root, store, auto, asked, st, put, get, check, gen, url, cards, writeChat, stSettings, writeSettings, writeFiles, closeBridge: done => (br ? br.close(done) : done()) };
}
// (a text-completion backend that runs on past its answer, in ChatML: what follows the stop sequence is not JSON — left in, the reply could not be read)
const tcText = a => `${typeof a === 'string' ? a : JSON.stringify(a)}<|im_end|>\n<|im_start|>user\nand {more}`;
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

// ---- 실리에 보내는 요청 (docs/SERVER-HANDOVER.md 3-3 · 4장): 일꾼은 옮긴 실리 코드(plugin/st)로 일마다 settings.json · 프리셋 파일을 새로 읽어 만들어요.
// 브라우저는 요청을 떠 두지 않아요(묶음은 어느 채팅인지만). 기대값은 같은 실리 코드를 이 프로세스에서 같은 상태로 돌린 것 (tests/stfake.mjs)
const PROFILE = { id: 'p1', name: 'My profile', api: 'openrouter', model: 'or/model', preset: 'Quiet', proxy: 'Home', 'secret-id': 'sec-1' };
// (SillyTavern's files: the preset file in "OpenAI Settings" — the keys SillyTavern saves a preset with —, the proxy presets and the
//  chat-completion settings in settings.json)
const QUIET = { temperature: 0.7, openai_max_tokens: 900, chat_completion_source: 'openrouter', show_thoughts: true, reasoning_effort: 'medium' };
const PROXIES = [{ name: 'None', url: '', password: '' }, { name: 'Home', url: 'https://home.proxy', password: 'PROXY-PW' }];
const OAI_SET = { chat_completion_source: 'openrouter', temp_openai: 1, openai_max_tokens: 300 };
const stageOf = (t, { profiles = [PROFILE], selected = null, oai = OAI_SET, files = {}, more = {}, ...rest } = {}) => stage(t, { cm: { profiles, ...(selected ? { selectedProfile: selected } : {}) }, more: { oai_settings: oai, proxies: PROXIES, ...more }, files: { 'OpenAI Settings/Quiet.json': QUIET, ...files }, ...rest });
// (this chat as SillyTavern's page holds it: Ren with Mara)
const ME = { name1: 'Ren', name2: 'Mara', persona: 'Ren is a student.' };
const CC = '/api/backends/chat-completions/generate', TC = '/api/backends/text-completions/generate';
const sentTo = (S, url = CC) => S.st.filter(x => x.url === url);
const lastText = async (S, sid, x) => (await S.get(sid)).messenger.rooms[x.room.id].messages.at(-1).text;
// (a different answer each time: the same words twice in a row are not saved again — a reply that only repeats is dropped)
const pings = () => { let n = 0; return () => ({ reply: [`ping ${++n}`], status: '' }); };
const useRoom = (x, more) => Object.assign(liveWorld(x.m).messenger.rooms[x.room.id], typeof more === 'string' ? { connectionId: more } : more);

test('일꾼 · 연결 프로필 방: 옮긴 실리 코드가 settings.json · 프리셋 파일 · 프록시로 만든 요청 그대로 다리로 실리 서버의 처리기에. 답은 방에', async t => {
    const S = await stageOf(t), a = world();
    useRoom(a, 'profile:p1');
    await S.put('sa', a.m); await S.auto.list();
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[true, '']]);
    const r = await S.gen(a.id);
    assert.match(r.payload, /"message_saved"/, r.payload);
    assert.equal(S.asked.length, 0);                                       // (초안 모델로는 안 갔어요)
    const sent = sentTo(S);
    assert.equal(sent.length, 1);
    assert.deepEqual([sent[0].token, sent[0].root], ['tok-123', S.root]);
    // 실리 코드가 이 메시지로 만드는 몸통 그대로 (답 길이: 답장 한 번의 값)
    const b = sent[0].body, want = await stProfileRequest(S.root, ME, { profileId: 'p1', messages: b.messages });
    assert.deepEqual(b, want.generate[0].body);
    assert.deepEqual(want.generate.length, 1);
    // (프로필 · 프리셋 파일 · 프로필의 프록시 · 이 채팅의 이름이 들어갔어요)
    assert.deepEqual([b.model, b.chat_completion_source, b.temperature, b.max_tokens, b.reverse_proxy, b.proxy_password, b.secret_id, b.user_name, b.char_name, b.stream], ['or/model', 'openrouter', 0.7, 4000, 'https://home.proxy', 'PROXY-PW', 'sec-1', 'Ren', 'Mara', false]);
    assert.deepEqual(b.messages.map(m => m.role), ['system', 'user']);
    assert.match(b.messages[0].content, /^GOAL\nYou are Mara\./);
    assert.match(b.messages[1].content, /\[WHY NOW\]/);
    assert.equal(await lastText(S, 'sa', a), 'you there?');
});

test('일꾼 · 실리 쪽 방(AI 기능 모델이 실리): 실리에서 지금 고른 프로필로. 고른 프로필이 없거나 실리가 보낼 수 없는 종류면 이유를 알려요', async t => {
    const S = await stageOf(t, { selected: 'p1', settings: { aiConn: { mode: 'st' } } }), a = world();
    useRoom(a, 'ai');
    await S.put('sa', a.m); await S.auto.list();
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const b = sentTo(S)[0].body;
    assert.deepEqual(b, (await stProfileRequest(S.root, ME, { profileId: 'p1', messages: b.messages })).generate[0].body);
    // (고른 프로필이 없는 실리: 서버는 실리의 지금 연결로는 못 보내요)
    const S2 = await stageOf(t, { settings: { aiConn: { mode: 'st' } } }), c = world();
    useRoom(c, 'ai');
    await S2.put('sc', c.m); await S2.auto.list();
    assert.match((await S2.auto.status('sc'))[0].why, /선택된 연결 프로필이 없습니다/);
    assert.equal((await S2.gen(c.id)).statusCode, 400);
    // (실리가 보낼 수 없는 종류의 프로필을 골라 뒀으면 — 실리 getSupportedProfiles에 없어요 —: 브라우저처럼 "고른 프로필 없음")
    const S3 = await stageOf(t, { profiles: [PROFILE, { id: 'n1', name: 'Novel', api: 'novel', model: 'n-model' }], selected: 'n1', settings: { aiConn: { mode: 'st' } } }), d = world();
    useRoom(d, 'ai');
    await S3.put('sd', d.m);
    assert.match((await S3.auto.status('sd'))[0].why, /선택된 연결 프로필이 없습니다/);
    assert.equal(sentTo(S2).length + sentTo(S3).length + S2.asked.length + S3.asked.length, 0);
});

test('일꾼 · 방의 추론 레벨을 얹은 프로필 요청: 얹는 값도 실리 createGenerationParameters가 만들어요 (ai.js stLevelPayload) — 프리셋의 레벨 위에', async t => {
    const S = await stageOf(t), a = world(), plain = world();
    useRoom(a, { connectionId: 'profile:p1', chatParameters: { reasoningEffort: 'high' } });
    useRoom(plain, 'profile:p1');
    await S.put('sa', a.m); await S.put('sp', plain.m); await S.auto.list();
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[true, '']]);
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    assert.match((await S.gen(plain.id)).payload, /"message_saved"/);
    const [b, p] = sentTo(S).map(x => x.body);
    // (ai.js stLevelPayload: SillyTavern's createGenerationParameters for that source · model · level, nothing else of the room's)
    const lv = await stGenerationParameters(S.root, ME, { settingsOf: o => ({ ...o, chat_completion_source: 'openrouter', stream_openai: false, n: 1, bias_preset_selected: '', function_calling: false, reasoning_effort: 'high', show_thoughts: true }), model: 'or/model', messages: [] });
    const over = { reasoning_effort: lv.out.generate_data.reasoning_effort, include_reasoning: true };
    assert.deepEqual(b, (await stProfileRequest(S.root, ME, { profileId: 'p1', messages: b.messages, over })).generate[0].body);
    assert.deepEqual([b.reasoning_effort, b.include_reasoning], ['high', true]);
    // (레벨을 안 고른 방: 얹는 값 없이 — 프리셋의 레벨)
    assert.deepEqual(p, (await stProfileRequest(S.root, ME, { profileId: 'p1', messages: p.messages })).generate[0].body);
    assert.equal(p.reasoning_effort, 'medium');
});

// (SillyTavern 1.19.1's default instruct template ChatML — default/content/presets/instruct/ChatML.json — and a text-completion preset)
const CHATML = {
    input_sequence: '<|im_start|>user', output_sequence: '<|im_start|>assistant', last_output_sequence: '', system_sequence: '<|im_start|>system', stop_sequence: '<|im_end|>',
    wrap: true, macro: true, names_behavior: 'force', activation_regex: '', first_output_sequence: '', skip_examples: false, output_suffix: '<|im_end|>\n', input_suffix: '<|im_end|>\n',
    system_suffix: '<|im_end|>\n', user_alignment_message: '', system_same_as_user: false, last_system_sequence: '', first_input_sequence: '', last_input_sequence: '',
    sequences_as_stop_strings: true, story_string_prefix: '<|im_start|>system', story_string_suffix: '<|im_end|>\n', name: 'ChatML',
};
const REN_TC = { temp: 0.8, top_p: 0.9, top_k: 20, genamt: 250, rep_pen: 1.1 };

test('일꾼 · 글 완성 프로필 방: 지시 형식(instruct 폴더)이 감싼 글로 실리 서버의 글 완성 처리기에. 답은 실리처럼 멈춤 글에서 잘라요', async t => {
    const TCP = { id: 't1', name: 'Text', api: 'koboldcpp', model: 'k', 'api-url': 'http://127.0.0.1:5001', instruct: 'ChatML', preset: 'Ren TC' };
    const S = await stageOf(t, { profiles: [TCP], files: { 'instruct/ChatML.json': CHATML, 'TextGen Settings/Ren TC.json': REN_TC } }), a = world();
    useRoom(a, 'profile:t1');
    await S.put('sa', a.m); await S.auto.list();
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const sent = sentTo(S, TC);
    assert.deepEqual([sent.length, sentTo(S).length, S.asked.length], [1, 0, 0]);
    const b = sent[0].body;
    // (보낸 글에서 메시지 둘을 읽어 같은 실리 코드에 다시 넣어요: 지시 형식이 감싼 모양이 실리 것과 글자 그대로여야 같은 몸통이 나와요)
    const m = /^<\|im_start\|>system\n([\s\S]*)<\|im_end\|>\n<\|im_start\|>user\n([\s\S]*)<\|im_end\|>\n<\|im_start\|>assistant\n$/.exec(b.prompt);
    assert.ok(m, b.prompt.slice(0, 300));
    assert.match(m[1], /^GOAL\nYou are Mara\./); assert.match(m[2], /\[MESSENGER\]/);
    const answer = { reply: ['you there?'], status: '' };
    const want = await stProfileRequest(S.root, ME, { profileId: 't1', messages: [{ role: 'system', content: m[1] }, { role: 'user', content: m[2] }], reply: { choices: [{ text: tcText(answer) }] } });
    assert.deepEqual(b, want.generate[0].body);
    assert.deepEqual([b.max_tokens, b.temperature, b.top_k, b.api_server, b.stop], [4000, 0.8, 20, 'http://127.0.0.1:5001', ['\n<|im_end|>', '\n<|im_start|>user', '\n<|im_start|>assistant', '\n<|im_start|>system']]);
    // 실리는 답을 멈춤 글에서 잘라 돌려줘요 (custom-request.js processRequest): 그 답으로 방에
    assert.equal(want.out.content, JSON.stringify(answer));
    assert.equal(await lastText(S, 'sa', a), 'you there?');
});

// (ai.js stSourceData: what a reply asks of SillyTavern's createGenerationParameters — the length LIVE_GO.replyTokens, temperature 0.3,
//  the room's level (low when none), thoughts on — over SillyTavern's chat-completion settings; then the role-play's own keys out)
const SOURCE = { mode: 'source', source: 'custom', stModel: 'mara-model' };
const SOURCE_OAI = { chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:9/v1', custom_include_headers: 'X-User: {{user}}\nX-Char: {{char}}' };
const sourceSettings = o => ({
    ...o, chat_completion_source: 'custom', stream_openai: false, n: 1, bias_preset_selected: '', seed: -1, temp_openai: 0.3, top_p_openai: 1, openai_max_tokens: 4000,
    freq_pen_openai: 0, pres_pen_openai: 0, top_k_openai: 0, min_p_openai: 0, top_a_openai: 0, repetition_penalty_openai: 1, reasoning_effort: 'low', show_thoughts: true,
    enable_web_search: false, request_images: false, function_calling: false, assistant_prefill: '', assistant_impersonation: '',
});
async function sourceBody(S, state, messages) {
    const d = (await stGenerationParameters(S.root, state, { settingsOf: sourceSettings, model: 'mara-model', messages })).out.generate_data;
    for (const k of ['stop', 'logit_bias', 'logprobs', 'top_logprobs', 'n', 'tools', 'tool_choice', 'seed']) delete d[k];
    d.stream = false;
    return JSON.parse(JSON.stringify(d));
}

test('일꾼 · 실리 연결 방식 방: 실리 createGenerationParameters가 답장의 값(길이 4000 · 온도 0.3 · 레벨 low · 생각 보기)과 settings.json으로 만든 요청 그대로. 매크로 칸도 실리처럼. 바꾸면 다음 답장부터', async t => {
    const S = await stage(t, { settings: { draftConn: SOURCE }, more: { oai_settings: SOURCE_OAI }, reply: pings() }), a = world();
    await S.put('sa', a.m); await S.auto.list();
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[true, '']]);
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    assert.equal(S.asked.length, 0);                                       // (우리 커스텀 API로는 안 갔어요)
    const sent = sentTo(S);
    assert.deepEqual([sent.length, sent[0].token, sent[0].root], [1, 'tok-123', S.root]);
    const b = sent[0].body;
    assert.deepEqual(b, await sourceBody(S, ME, b.messages));
    assert.deepEqual([b.chat_completion_source, b.model, b.custom_url, b.temperature, b.max_tokens ?? b.max_completion_tokens, b.reasoning_effort, b.include_reasoning, b.stream, b.user_name, b.char_name], ['custom', 'mara-model', 'http://127.0.0.1:9/v1', 0.3, 4000, 'low', true, false, 'Ren', 'Mara']);
    // (매크로가 든 칸: 실리 브라우저처럼 이 채팅의 이름으로 채워요)
    assert.equal(b.custom_include_headers, 'X-User: Ren\nX-Char: Mara');
    assert.deepEqual(b.messages.map(m => m.role), ['system', 'user']);
    assert.match(b.messages[0].content, /^GOAL\nYou are Mara\./);
    assert.equal(await lastText(S, 'sa', a), 'ping 1');
    // 실리에서 연결 설정을 바꾸면 다음 답장부터 (settings.json을 일마다 읽어요: 브라우저는 아무것도 안 했어요)
    S.stSettings.oai_settings = { ...SOURCE_OAI, custom_url: 'http://127.0.0.1:10/v1', custom_include_headers: 'X-Who: {{user}}' };
    await S.writeSettings();
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const b2 = sentTo(S)[1].body;
    assert.deepEqual(b2, await sourceBody(S, ME, b2.messages));
    assert.deepEqual([b2.custom_url, b2.custom_include_headers], ['http://127.0.0.1:10/v1', 'X-Who: Ren']);
    assert.equal(await lastText(S, 'sa', a), 'ping 2');
});

const BIAS = { id: 'b1', name: 'Bias', api: 'custom', model: 'mara-model', 'api-url': 'http://127.0.0.1:9/v1', preset: 'Mara Bias' };
// (bias_presets is not a preset key SillyTavern takes — settingsToUpdate —: the tokens asked for are the chat-completion settings' list's)
const BIAS_OAI = { chat_completion_source: 'custom', bias_preset_selected: 'Ivo bias', bias_presets: { 'Default (none)': [], 'Ivo bias': [{ text: ' Ivo', value: -50 }] } };
// (a preset takes its bias pick only with a bias list beside it — custom-request.js presetToGeneratePayload)
const BIAS_FILES = { 'OpenAI Settings/Mara Bias.json': { temperature: 0.6, bias_preset_selected: 'Ivo bias', bias_presets: { 'Ivo bias': [{ text: ' Ivo', value: -50 }] } } };
const isBias = url => String(url).startsWith('/api/backends/chat-completions/bias');

test('일꾼 · 로짓 바이어스 프리셋: 실리 서버의 /bias 길로 토큰을 받아 요청에. 그 길을 못 쓰면(옛 다리: 404) 모델 요청을 보내지 않아요 (실패로 알려요)', async t => {
    // 옛 다리: 그 길이 없어요 (plugin/bridge.mjs allowed → 404)
    const S = await stageOf(t, { profiles: [BIAS], oai: BIAS_OAI, files: BIAS_FILES }), a = world();
    useRoom(a, 'profile:b1');
    await S.put('sa', a.m); await S.auto.list();
    const r = await S.gen(a.id);
    assert.match(r.payload, /"type":"error"/, r.payload);
    assert.ok(S.st.some(x => isBias(x.url)));
    assert.equal(sentTo(S).length, 0);                                     // (모델 요청은 안 나갔어요: 바이어스 없는 요청은 실리 것과 달라요)
    assert.equal((await S.get('sa')).messenger.rooms[a.room.id].messages.length, 2);
    // 다리가 그 길을 열면: 실리 서버가 준 토큰으로
    const TOKENS = { 1234: -50 };
    const S2 = await stageOf(t, { profiles: [BIAS], oai: BIAS_OAI, files: BIAS_FILES, routes: async (req, body, res) => { if (!isBias(req.url)) return false; res.end(JSON.stringify(TOKENS)); return true; } }), b = world();
    useRoom(b, 'profile:b1');
    await S2.put('sb', b.m); await S2.auto.list();
    assert.match((await S2.gen(b.id)).payload, /"message_saved"/);
    const body = sentTo(S2)[0].body, want = await stProfileRequest(S2.root, ME, { profileId: 'b1', messages: body.messages, answer: async () => new Response(JSON.stringify(TOKENS), { status: 200 }) });
    assert.deepEqual(body, want.generate[0].body);
    assert.deepEqual(body.logit_bias, { 1234: -50 });
    // (실리 서버에 물은 것도 실리 코드가 물을 것 그대로. 항목의 id는 실리가 읽을 때 무작위로 채워요: 실리 서버는 안 써요)
    const noId = x => ({ url: x.url, body: x.body.map(({ id, ...rest }) => rest) });
    assert.deepEqual(noId(S2.st.find(x => isBias(x.url))), noId(want.sent.find(x => isBias(x.url))));
    assert.equal(await lastText(S2, 'sb', b), 'you there?');
});

// (실리의 sendRequest는 오류를 "API request failed"로 감싸요: 삼킨 실패가 모델 요청을 막았으면 그 실패가 이유예요)
test('일꾼 · 바이어스 길을 못 쓰면 이유는 그 길: "실리 서버의 /api/backends/chat-completions/bias를 쓸 수 없습니다. …" ("API request failed"가 아니라)', async t => {
    const S = await stageOf(t, { profiles: [BIAS], oai: BIAS_OAI, files: BIAS_FILES }), a = world();
    useRoom(a, 'profile:b1');
    await S.put('sa', a.m); await S.auto.list();
    const r = await S.gen(a.id);
    assert.match(r.payload, /"type":"error","data":"실리 서버의 \/api\/backends\/chat-completions\/bias를 쓸 수 없습니다\. 서버 플러그인을 업데이트하고 실리를 다시 시작하세요\."/, r.payload);
});

test('일꾼 · 실리에서 연결 관리자를 끄거나 고른 프로필이 없어지면: 프로필로 보내지 않고 이유를 알려요 (프로필 방은 실리처럼 고른 연결이 없는 방)', async t => {
    const off = { disabledExtensions: ['connection-manager'] };
    const S = await stageOf(t, { settings: { aiConn: { mode: 'st' }, aiProfile: 'p1' }, ext: off }), a = world(), b = world();
    useRoom(a, 'ai'); useRoom(b, 'profile:p1');
    await S.put('sa', a.m); await S.put('sb', b.m); await S.auto.list();
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[false, '선택한 연결을 사용할 수 없습니다. 다른 연결을 선택하세요.']]);
    assert.equal((await S.gen(a.id)).statusCode, 400);
    // (실리가 프로필 목록을 주지 않아요 — getSupportedProfiles: "Connection Manager is not available" —: 그 방은 브라우저처럼 초안 모델로)
    assert.match((await S.gen(b.id)).payload, /"message_saved"/);
    assert.deepEqual([S.asked.length, sentTo(S).length], [1, 0]);
    // 다시 켜면 그 프로필로 (settings.json을 일마다 읽어요)
    S.stSettings.extension_settings.disabledExtensions = [];
    await S.writeSettings();
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[true, '']]);
    // 없는 프로필을 골라 뒀으면 (실리에서 지웠어요)
    S.stSettings.extension_settings.narrative_archive.aiProfile = 'gone';
    await S.writeSettings();
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[false, '선택한 연결을 사용할 수 없습니다. 다른 연결을 선택하세요.']]);
    assert.equal((await S.gen(a.id)).statusCode, 400);
    assert.equal(sentTo(S).length, 0);
});

test('일꾼 · 실리에서 바꾸면 바로 (브라우저 없이): settings.json의 프록시 · 프리셋 파일의 온도를 바꾸면 다음 요청이 새 값으로. 프리셋 파일을 지우면 실리처럼 프리셋 없이', async t => {
    const S = await stageOf(t, { reply: pings() }), a = world();
    useRoom(a, 'profile:p1');
    await S.put('sa', a.m); await S.auto.list();
    const kitNow = async () => JSON.stringify(joinLive((await S.store.load('sa')).parts).kit), kit = await kitNow();
    assert.ok(kit.includes('"file"'));
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const b1 = sentTo(S)[0].body;
    assert.deepEqual([b1.temperature, b1.reverse_proxy, b1.proxy_password], [0.7, 'https://home.proxy', 'PROXY-PW']);
    // 실리에서: 프록시 주소 · 비밀번호, 프리셋의 온도를 바꿔요 (브라우저는 아무것도 안 했어요: 저장은 그대로)
    S.stSettings.proxies = [PROXIES[0], { name: 'Home', url: 'https://home2.proxy', password: 'PROXY-PW2' }];
    await S.writeSettings();
    await S.writeFiles({ 'OpenAI Settings/Quiet.json': { ...QUIET, temperature: 0.2 } });
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const b2 = sentTo(S)[1].body;
    assert.deepEqual(b2, (await stProfileRequest(S.root, ME, { profileId: 'p1', messages: b2.messages })).generate[0].body);
    assert.deepEqual([b2.temperature, b2.reverse_proxy, b2.proxy_password], [0.2, 'https://home2.proxy', 'PROXY-PW2']);
    // 프리셋 파일을 지우면: 실리는 그 프리셋 없이 보내요 (custom-request.js: "Preset ... not found, continuing with default settings")
    await S.writeFiles({ 'OpenAI Settings/Quiet.json': null });
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const b3 = sentTo(S)[2].body;
    assert.deepEqual(b3, (await stProfileRequest(S.root, ME, { profileId: 'p1', messages: b3.messages })).generate[0].body);
    assert.deepEqual([b3.temperature, b3.reasoning_effort, b3.reverse_proxy], [undefined, undefined, 'https://home2.proxy']);
    assert.equal(await lastText(S, 'sa', a), 'ping 3');
    // (그동안 묶음은 그대로예요: 바뀐 것은 실리 파일뿐)
    assert.equal(await kitNow(), kit);
});

test('일꾼 · 세계마다 실리 상태를 새로: 다른 캐릭터 · 페르소나의 채팅을 번갈아 돌려도 이름 · {{user}} · {{char}}가 그 일의 것 (앞 일의 것이 안 남아요)', async t => {
    const S = await stage(t, { settings: { draftConn: SOURCE }, more: { oai_settings: SOURCE_OAI }, reply: pings() });
    // (Ivo의 채팅: 이 채팅에서 마지막으로 쓴 페르소나는 Varo)
    await mkdir(path.join(S.root, 'chats', 'ivo'), { recursive: true });
    await writeFile(path.join(S.root, 'chats', 'ivo', 'Ivo - 2026-11-22.jsonl'), chatFile({ narrative_archive: { stPersona: 'varo.png' } }, [said('Ivo', 'yo'), said('Varo', 'hey', true)]));
    const a = world(), b = world({ browser: { ...BROWSER(), characterId: 1, chatId: 'Ivo - 2026-11-22' }, members: ['Ivo'] });
    await S.put('sa', a.m); await S.put('sb', b.m); await S.auto.list();
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    assert.match((await S.gen(b.id, { forCharacterId: 'ivo' })).payload, /"message_saved"/);
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const bodies = sentTo(S).map(x => x.body);
    assert.deepEqual(bodies.map(x => [x.user_name, x.char_name, x.custom_include_headers]), [['Ren', 'Mara', 'X-User: Ren\nX-Char: Mara'], ['Varo', 'Ivo', 'X-User: Varo\nX-Char: Ivo'], ['Ren', 'Mara', 'X-User: Ren\nX-Char: Mara']]);
    assert.match(bodies[1].messages[0].content, /^GOAL\nYou are Ivo\./);
    assert.match(textOf(bodies[1]), /\[PERSONA — Varo\]\nVaro is a pilot\./);
    // (하나하나 실리 코드가 그 채팅의 상태로 만드는 것 그대로)
    assert.deepEqual(bodies[1], await sourceBody(S, { name1: 'Varo', name2: 'Ivo', persona: 'Varo is a pilot.' }, bodies[1].messages));
    assert.deepEqual(bodies[2], await sourceBody(S, ME, bodies[2].messages));
});

test('일꾼 · 변수 매크로: 실리 채팅 파일의 chat_metadata.variables({{getvar::x}} · {{.x}})와 settings.json의 전역 변수({{$x}})로 — 멈춤 글 · 몸통 칸에. 채팅 파일이 바뀌면 다음 요청에', async t => {
    const VAR = { id: 'v1', name: 'Vars', api: 'custom', model: 'mara-model', 'api-url': 'http://127.0.0.1:9/v1', preset: 'Vars' };
    const files = { 'OpenAI Settings/Vars.json': { temperature: 0.5, chat_completion_source: 'custom', custom_include_body: '{"mood": "{{getvar::mood}}", "place": "{{.place}}", "season": "{{$season}}"}' } };
    const power = { ...PERSONAS, custom_stopping_strings: '["{{getvar::mood}}", "{{.place}}!"]', custom_stopping_strings_macro: true };
    const S = await stageOf(t, { profiles: [VAR], oai: { chat_completion_source: 'custom' }, files, ext: { variables: { global: { season: 'winter' } } }, more: { power_user: power }, reply: pings() }), a = world();
    useRoom(a, 'profile:v1');
    await S.put('sa', a.m); await S.auto.list();
    const vars = { mood: 'sleepy', place: 'bakery' };
    await S.writeChat({ variables: vars });
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const b = sentTo(S)[0].body;
    assert.deepEqual(b, (await stProfileRequest(S.root, { ...ME, chat_metadata: { variables: vars } }, { profileId: 'v1', messages: b.messages })).generate[0].body);
    assert.deepEqual(b.stop, ['sleepy', 'bakery!']);
    assert.deepEqual(JSON.parse(b.custom_include_body), { mood: 'sleepy', place: 'bakery', season: 'winter' });
    // (실리에서 변수가 바뀌었어요: 채팅 파일의 것)
    await S.writeChat({ variables: { mood: 'awake', place: 'park' } });
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const b2 = sentTo(S)[1].body;
    assert.deepEqual([b2.stop, JSON.parse(b2.custom_include_body)], [['awake', 'park!'], { mood: 'awake', place: 'park', season: 'winter' }]);
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

test('일꾼: 늦은 답장을 못 보내면 실리 창에 이유를 한 번 적어요 (30초마다 또 적지 않아요). 보내면 보냈다고 적어요', async t => {
    const S = await stage(t, { reply: () => ({ reply: ['sorry, was busy'], status: '' }) });
    // (the worker is a thread: what it writes comes through this process's stdout · stderr)
    const lines = [], keep = { out: process.stdout.write, err: process.stderr.write };
    process.stdout.write = function (c, ...a) { lines.push(String(c)); return keep.out.call(this, c, ...a); };
    process.stderr.write = function (c, ...a) { lines.push(String(c)); return keep.err.call(this, c, ...a); };
    t.after(() => { process.stdout.write = keep.out; process.stderr.write = keep.err; });
    const mk = more => { const x = world({ hoursAgo: 0.2 }); const j = enqueueJob(x.m, { kind: 'reply', owner: 'Mara', room: x.room.id, at: Date.now() - 600_000 }); Object.assign(j, { timed: true, notBefore: Date.now() - 1000 }); more?.(x); return x; };
    // (noProfile: 실리 쪽 방인데 실리에서 고른 프로필이 없어요 — 서버는 실리의 지금 연결로 못 보내요)
    const held = mk(), noProfile = mk(x => { liveWorld(x.m).messenger.rooms[x.room.id].connectionId = 'ai'; }), old = world({ version: '0.0.1' }), fine = mk();
    { const j = enqueueJob(old.m, { kind: 'reply', owner: 'Mara', room: old.room.id, at: Date.now() - 600_000 }); Object.assign(j, { timed: true, notBefore: Date.now() - 1000 }); }
    for (const [sid, x] of [['sh', held], ['sn', noProfile], ['so', old], ['sf', fine]]) await S.put(sid, x.m);
    assert.deepEqual(await S.auto.claim('sh', held.room.id, 'browser:tab1'), { ok: true });
    await S.auto.sweep(); await S.auto.sweep();
    const why = id => lines.filter(l => l.includes(`[due-replies] Mara (${id}): 늦은 답장을 보내지 않았습니다.`));
    assert.equal(why(held.room.id).length, 1, lines.join('\n')); assert.match(why(held.room.id)[0], /브라우저 탭이 이 방에서 답장을 만들고 있습니다\./);
    assert.equal(why(noProfile.room.id).length, 1); assert.match(why(noProfile.room.id)[0], /선택된 연결 프로필이 없습니다\. 실리의 연결 관리자에서 프로필을 선택하세요\./);
    assert.equal(why(old.room.id).length, 1); assert.match(why(old.room.id)[0], /버전이 다릅니다/);
    assert.equal(lines.filter(l => l.includes(`[due-replies] Mara (${fine.room.id}): 늦은 답장을 보냈습니다.`)).length, 1);
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
    const a = mk(), b = mk(), c = mk(x => { liveWorld(x.m).messenger.rooms[x.room.id].connectionId = 'ai'; }), d = mk((x, j) => { j.notBefore = Date.now() + 3600_000; });
    await S.put('sa', a.m); await S.put('sb', b.m); await S.put('sc', c.m); await S.put('sd', d.m);
    await S.auto.presence('sb', 'active');
    assert.equal(await S.auto.sweep(), 2);
    for (const [sid, x] of [['sa', a], ['sb', b]]) assert.equal((await S.get(sid)).messenger.rooms[x.room.id].messages.at(-1).text, 'sorry, was busy', sid);
    for (const [sid, x] of [['sc', c], ['sd', d]]) { const w = await S.get(sid); assert.equal(w.messenger.rooms[x.room.id].messages.length, 2, sid); assert.equal(w.queue.jobs.filter(j => j.state === 'waiting').length, 1, sid); }
    assert.equal(S.asked.length, 2);
    // (실리 쪽 방인데 실리에서 고른 프로필이 없으면, 초안 모델이 커스텀 API여도 서버가 대신 답하지 않아요: 다른 모델로 답하게 돼요)
    await S.auto.list();
    const rc = await S.gen(c.id);
    assert.equal(rc.statusCode, 400); assert.match(rc.payload, /선택된 연결 프로필이 없습니다/);
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
    liveWorld(a.m).messenger.rooms[other.id].connectionId = 'ai';
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
    // (적어 둔 페르소나를 실리에서 지웠으면: 실리 순서로 — 여기서는 settings.json의 지금 페르소나)
    const d = world(); await S.put('sd', d.m); await S.auto.list();
    await S.writeChat({ narrative_archive: { stPersona: 'gone.png' } });
    assert.match((await S.gen(d.id)).payload, /"message_saved"/);
    assert.match(textOf(S.asked.at(-1).body), /\[PERSONA — Ren\]\nRen is a student\./);
    // (잠금도 없으면 settings.json의 지금 페르소나)
    await S.writeChat({});
    assert.match((await S.gen(c.id)).payload, /"message_saved"/);
    text = textOf(S.asked.at(-1).body);
    assert.match(text, /\[PERSONA — Ren\]\nRen is a student\./);
});

test('일꾼 · 실리에서 바로: 그룹 채팅 — 그룹 파일의 사람들 · 그룹에 연결한 페르소나. 실리에서 그룹을 지우면 안 돌려요', async t => {
    const browser = { ...BROWSER(), characterId: undefined, groupId: 'g1', groups: [{ id: 'g1', members: ['mara.png'] }], chatId: 'grp-1' };
    // (그룹 파일에는 Ivo도 있어요: 방에도 없고 폰도 없어요. 그룹에 연결한 페르소나는 Varo)
    const varo = { description: 'Varo is a pilot.', connections: [{ type: 'group', id: 'g1' }] };
    const S = await stage(t, { more: { power_user: { ...PERSONAS, persona_descriptions: { ...PERSONAS.persona_descriptions, 'varo.png': varo } } }, files: { 'groups/g1.json': { id: 'g1', members: ['mara.png', 'ivo.png', 'gone.png'], chat_id: 'grp-1', chats: ['grp-1'] } } }), a = world({ browser });
    S.cards[1].shallow = true;
    await mkdir(path.join(S.root, 'group chats'), { recursive: true }); await writeFile(path.join(S.root, 'group chats', 'grp-1.jsonl'), chatFile({}, MESSAGES()));
    assert.deepEqual(a.m.live.kit.chat, { avatar: null, group: { id: 'g1' }, file: { group: true, dir: null, id: 'grp-1' } });
    await S.put('sa', a.m); await S.auto.list();
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[true, '']]);
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const text = textOf(S.asked[0].body);
    assert.match(text, /\[Mara's card\]\n\[description\]\nMara is a baker\./);
    assert.match(text, /\[PERSONA — Varo\]\nVaro is a pilot\./);
    // (그룹 파일의 사람이라서 Ivo의 간단한 카드를 통째로 읽었어요: 실리가 그룹 채팅을 열 때처럼)
    assert.ok(S.st.some(x => x.url === '/api/characters/get' && x.body.avatar_url === 'ivo.png'));
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

test('일꾼 · 실리에서 바로: 간단한 카드는 실리처럼 이 채팅의 캐릭터 · 그룹 사람만 통째로 읽어요 (나머지는 목록의 것 그대로)', async t => {
    const S = await stage(t), a = world({ members: ['Mara', 'Ivo'] });
    S.cards[0].shallow = true; S.cards[1].shallow = true;
    await S.put('sa', a.m); await S.auto.list();
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    const got = S.st.filter(x => x.url === '/api/characters/get').map(x => x.body.avatar_url);
    assert.ok(got.includes('mara.png')); assert.ok(!got.includes('ivo.png'));
});

test('일꾼 · 실리에서 바로: 카드 폴더 · 채팅 파일이 그대로면 다시 안 읽어요. 바뀌면 바로 다시', async t => {
    const S = await stage(t), a = world(), b = world();
    await mkdir(path.join(S.root, 'characters'), { recursive: true });
    await writeFile(path.join(S.root, 'characters', 'mara.png'), 'x');
    await S.put('sa', a.m); await S.put('sb', b.m);
    const all = () => S.st.filter(x => x.url === '/api/characters/all').length;
    await S.auto.list(); const once = all();
    await S.auto.status('sa'); await S.auto.status('sb'); await S.auto.list();
    assert.equal(all(), once);
    // (실리에서 카드를 고쳤어요: 그 파일의 시각이 바뀌어요)
    Object.assign(S.cards[0], { description: 'Mara is a pilot now.', data: { ...S.cards[0].data, description: 'Mara is a pilot now.' } });
    await new Promise(r => setTimeout(r, 20));
    await writeFile(path.join(S.root, 'characters', 'mara.png'), 'xy');
    assert.match((await S.gen(a.id)).payload, /"message_saved"/);
    assert.equal(all(), once + 1);
    assert.match(textOf(S.asked[0].body), /Mara is a pilot now\./);
    // (롤플에 새 메시지: 채팅 파일이 바뀌어서 다시 읽어요)
    await S.writeChat({}, [...MESSAGES(), said('Mara', 'at the door now')]);
    const c = world({ story: true }); await S.put('sc', c.m); await S.auto.list();
    assert.match((await S.gen(c.id)).payload, /"message_saved"/);
    assert.match(textOf(S.asked.at(-1).body), /Mara: at the door now/);
});

test('일꾼 · 실리에서 못 읽으면 답하지 않아요 (지어내지 않아요): 채팅 파일을 못 읽음 · 페르소나 목록을 못 받음', async t => {
    const S = await stage(t, { avatarsStatus: 500 }), a = world();
    await S.put('sa', a.m);
    // (적어 둔 페르소나가 없는 채팅: 실리 순서로 고르려면 그림 목록이 있어야 해요)
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[false, '페르소나 목록을 읽을 수 없습니다.']]);
    const at = path.join(S.root, 'chats', 'mara', 'Mara - 2026-11-22.jsonl');
    await rm(at); await mkdir(at);
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[false, '채팅 파일을 읽을 수 없습니다.']]);
    assert.equal(S.asked.length, 0);
});

test('일꾼 · 실리에서 바로: 이 채팅의 캐릭터 카드를 지웠으면(채팅 파일은 남음) 답하지 않아요 · 다리 없이 카드 폴더를 못 읽어도', async t => {
    const S = await stage(t), a = world();
    await S.put('sa', a.m);
    S.cards.splice(0, 1);   // (Mara를 지웠어요)
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[false, '이 채팅의 캐릭터를 더 이상 사용할 수 없습니다.']]);
    await S.auto.list();
    assert.equal((await S.gen(a.id)).statusCode, 404);
    const N = await stage(t, { bridge: false }), b = world();
    await rm(path.join(N.root, 'characters'), { recursive: true });   // (카드 폴더를 못 읽어요)
    await N.put('sb', b.m);
    assert.deepEqual((await N.auto.status('sb')).map(x => [x.can, x.why]), [[false, '캐릭터 목록을 읽을 수 없습니다.']]);
    assert.equal(S.asked.length + N.asked.length, 0);
});

test('일꾼 · 실리에서 바로: 간단한 카드(lazyLoadCharacters)를 실리에서 고치면 다음 답장에 새 카드로 (통째로 읽어 둔 것을 버려요)', async t => {
    const S = await stage(t), a = world({ hoursAgo: 0.2 }), b = world({ hoursAgo: 0.2 });
    await mkdir(path.join(S.root, 'characters'), { recursive: true });
    await writeFile(path.join(S.root, 'characters', 'mara.png'), 'x');
    S.cards[0].shallow = true;
    for (const x of [a, b]) { const j = enqueueJob(x.m, { kind: 'reply', owner: 'Mara', room: x.room.id, at: Date.now() - 600_000 }); Object.assign(j, { timed: true, notBefore: Date.now() - 1000 }); }
    await S.put('sa', a.m);
    assert.equal(await S.auto.sweep(), 1);
    assert.match(textOf(S.asked[0].body), /Mara is a baker\./);
    // (실리에서 고쳤어요: 카드 파일이 바뀌어요)
    Object.assign(S.cards[0], { description: 'Mara is a pilot now.', data: { ...S.cards[0].data, description: 'Mara is a pilot now.' } });
    await new Promise(r => setTimeout(r, 20));
    await writeFile(path.join(S.root, 'characters', 'mara.png'), 'xy');
    await S.put('sb', b.m);
    assert.equal(await S.auto.sweep(), 1);
    assert.match(textOf(S.asked[1].body), /Mara is a pilot now\./);
});

test('일꾼 · 실리 서버에 아예 닿지 않으면(다리가 끊김): 화면에 이유를 알리고 답하지 않아요', async t => {
    const S = await stage(t), a = world();
    await S.put('sa', a.m);
    assert.deepEqual((await S.auto.status('sa')).map(x => x.can), [true]);
    await new Promise(r => S.closeBridge(r));
    assert.deepEqual((await S.auto.status('sa')).map(x => [x.can, x.why]), [[false, '캐릭터 목록을 읽을 수 없습니다.']]);
    assert.equal(S.asked.length, 0);
});

// (SillyTavern's connection check — plugin/st/nastatus.js — through the bridge: /api/secrets/read and the status way of the main API)
const STATUS_WAYS = ['/api/secrets/read', '/api/backends/chat-completions/status', '/api/backends/text-completions/status', '/api/backends/kobold/status'];
const statusSeen = S => S.st.filter(x => STATUS_WAYS.includes(x.url)).map(x => x.url);

test('일꾼 · 연결 확인은 실리 연결을 쓰는 세계만: 커스텀 API로만 보내는 세계는 묻지 않아요(공급자 호출 · 기다림 없이). 프로필 방이 있으면 묻고, 같은 설정이면 다시 묻지 않아요', async t => {
    const S = await stage(t), a = world();
    await S.put('sa', a.m);
    for (let i = 0; i < 2; i++) assert.deepEqual((await S.auto.status('sa')).map(x => x.can), [true]);
    assert.deepEqual(statusSeen(S), []);
    // (a room that sends through a connection profile — SillyTavern's own request code reads the connection then)
    const P = await stageOf(t), b = world();
    useRoom(b, 'profile:p1');
    await P.put('sb', b.m);
    for (let i = 0; i < 3; i++) assert.deepEqual((await P.auto.status('sb')).map(x => x.can), [true]);
    // (this fake bridge is an older one: no key state — 404 —, so the status way is asked as before. Once: the same settings)
    assert.deepEqual(statusSeen(P), ['/api/secrets/read', '/api/backends/chat-completions/status']);
    // (the AI 기능 모델 on SillyTavern's side with a profile picked there: its digests go through SillyTavern's code too)
    const Q = await stageOf(t, { selected: 'p1', settings: { aiConn: { mode: 'st' } } }), c = world();
    await Q.put('sc', c.m);
    await Q.auto.status('sc');
    assert.deepEqual(statusSeen(Q), ['/api/secrets/read', '/api/backends/chat-completions/status']);
});
