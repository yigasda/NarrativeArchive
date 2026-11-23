// 서버 플러그인의 일꾼을 실제로 띄워서 (plugin/host.mjs · worker.mjs · work.mjs): 실리가 initMacros 밖에서 등록하는 매크로가 일꾼의 실리 요청에서도
// 실리 페이지처럼 풀리는지 — 작가 노트(채팅에 노트가 없으면 기본 노트) · 요약(채팅 파일의 extra.memory) · {{hasExtension}}(다리의 /api/extensions/discover) · 추론.
// 서버에서 풀 수 없는 매크로는 글 그대로 보내요. 실리 서버는 가짜 다리, 실리 폴더는 임시 폴더(기본 확장의 manifest.json만), 저장은 임시 폴더. 예시 캐릭터만 써요.
// (tests/pluginwork.test.mjs의 한 판을 줄인 것이에요)
process.env.NA_SCREEN_ANYWHERE = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore } from '../plugin/store.mjs';
import { startAuto } from '../plugin/host.mjs';
import { splitLive } from '../src/phone2keep.js';
import { startFresh, putLivePhone, ensureRoom, sendLive, liveWorld } from '../src/phone2store.js';
import { buildKit, putKit } from '../src/phone2kit.js';
import { fakeBridge, stCard, chatFile, stUserDirs } from './stbridge.mjs';

// (the same do-nothing screen the worker runs under)
await import('../plugin/screen.mjs');
const { VERSION } = await import('../src/core.js');
// (SillyTavern's folder as the worker sees it — its working folder —: the built-in extensions' manifests, as SillyTavern 1.19.1 has them)
const ST = fs.mkdtempSync(path.join(tmpdir(), 'na-work-st-'));
for (const [name, display_name, loading_order] of [['expressions', 'Character Expressions', 6], ['memory', 'Summarize', 9], ['stable-diffusion', 'Image Generation', 10], ['regex', 'Regex', 1]]) {
    fs.mkdirSync(path.join(ST, 'public/scripts/extensions', name), { recursive: true });
    fs.writeFileSync(path.join(ST, 'public/scripts/extensions', name, 'manifest.json'), JSON.stringify({ display_name, loading_order, requires: [], optional: [], js: 'index.js', hooks: { activate: 'init' } }));
}
process.chdir(ST);
process.once('exit', () => fs.rmSync(ST, { recursive: true, force: true }));

const said = (name, mes, user = false, extra = {}) => ({ name, is_user: user, mes, send_date: '2026-11-22', extra });
const PERSONAS = { personas: { 'ren.png': 'Ren' }, persona_descriptions: { 'ren.png': { description: 'Ren is a student.' } } };
const PROFILE = { id: 'm1', name: 'Macros', api: 'custom', model: 'mara-model', 'api-url': 'http://127.0.0.1:9/v1', preset: 'Macros' };
const BODY = '{"note": "{{authorsNote}}", "def": "{{defaultAuthorsNote}}", "sum": "{{summary}}", "has": "{{hasExtension::memory}}/{{hasExtension::tts}}", "think": "{{reasoningPrefix}}", "exp": "{{defaultExpression}}", "other": "{{naThirdParty}}"}';
const pings = () => { let n = 0; return () => ({ reply: [`ping ${++n}`], status: '' }); };

async function stage(t, { ext = {}, discover = 'new' } = {}) {
    const root = await mkdtemp(path.join(tmpdir(), 'na-work-'));
    await stUserDirs(root);
    const reply = pings();
    const br = await fakeBridge({ cards: () => [stCard('Mara')], avatars: () => ['ren.png'], more: async (req, body, res) => {
        // (SillyTavern's own /api/extensions/discover through the bridge — the bridge's mark on its answer; an older bridge: 404 with none)
        if (req.url === '/api/extensions/discover') {
            if (discover === 'old') { res.statusCode = 404; res.end('{}'); return true; }
            res.setHeader('x-na-bridge', '1');
            if (discover === 'off') { res.statusCode = 404; res.end('Not Found'); return true; }
            res.end(JSON.stringify([{ type: 'system', name: 'expressions' }, { type: 'system', name: 'memory' }, { type: 'system', name: 'regex' }, { type: 'system', name: 'stable-diffusion' }]));
            return true;
        }
        if (req.url === '/api/backends/chat-completions/generate') { res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply(body)) }, finish_reason: 'stop' }] })); return true; }
        return false;
    } });
    const settings = { main_api: 'openai', user_avatar: 'ren.png', power_user: { ...PERSONAS, reasoning: { name: 'Na', prefix: '<think-na>', suffix: '</think-na>', separator: '\n' } }, oai_settings: { chat_completion_source: 'custom' }, extension_settings: { connectionManager: { profiles: [PROFILE] }, note: { default: 'Default note for {{char}}', chara: [], wiAddition: [] }, expressions: { api: 99, fallback_expression: 'joy', custom: [] }, ...ext } };
    await writeFile(path.join(root, 'settings.json'), JSON.stringify(settings, null, 4));
    await writeFile(path.join(root, 'OpenAI Settings', 'Macros.json'), JSON.stringify({ temperature: 0.5, chat_completion_source: 'custom', custom_include_body: BODY }, null, 4));
    await mkdir(path.join(root, 'chats', 'mara'), { recursive: true });
    await writeFile(path.join(root, 'chats', 'mara', 'Mara - 2026-11-22.jsonl'), chatFile({}, [said('Mara', 'hello there'), said('Ren', 'hi', true, { memory: 'Mara met Ren at the bakery.' }), said('Mara', 'see you')]));
    await mkdir(path.join(root, 'User Avatars'), { recursive: true });
    await writeFile(path.join(root, 'User Avatars', 'ren.png'), 'x');
    const store = openStore(root);
    const auto = startAuto({ root, store, bridge: { url: br.url, token: br.token }, schedule: false });
    t.after(async () => { await auto.stop(); br.close(); await rm(root, { recursive: true, force: true }); });
    await auto.ready;
    // (one Orbit: Ren with Mara, the room sends through the profile)
    const m = {};
    startFresh(m, { persona: 'Ren', now: Date.now() - 10 * 3600_000 });
    putLivePhone(m, { owner: 'Mara' });
    const room = ensureRoom(m, ['Mara']), w = liveWorld(m), at = Date.now() - 7 * 3600_000;
    sendLive(m, room.id, 'hey', at);
    room.messages.push({ id: 't2', n: 2, from: 'Mara', text: 'hi', at: at + 60_000 });
    w.presence = { on: true, schedules: {}, overrides: {}, meta: {}, user: {} };
    Object.assign(w.messenger.rooms[room.id], { connectionId: 'profile:m1' });
    putKit(m, buildKit({ name1: 'Ren', chatId: 'Mara - 2026-11-22', characterId: 0, characters: ['Mara'].map(stCard), powerUserSettings: { persona_description: 'Ren is a student.' } }, m, { version: VERSION }));
    await store.save('sa', { parts: JSON.parse(JSON.stringify(splitLive(m.live))), chat: 'chat-1' });
    await auto.list();
    const gen = () => auto.inject('/api/generate', { chatId: `${w.id}:${room.id}`, connectionId: null, forCharacterId: 'mara', streaming: false, userStatus: 'idle', userActivity: 'away or offline', autonomous: true, skipPresenceDelay: true, autonomousIntentKey: 'check_in' });
    const sent = () => br.seen.filter(x => x.url === '/api/backends/chat-completions/generate').map(x => JSON.parse(x.body.custom_include_body));
    return { gen, sent, seen: br.seen };
}

test('일꾼 · initMacros 밖의 매크로: 작가 노트(노트 없는 채팅은 기본 노트) · 요약 · {{hasExtension}} · 추론 · 표정 — 실리 페이지처럼. 다른 확장의 매크로는 글 그대로', async t => {
    const S = await stage(t);
    assert.match((await S.gen()).payload, /"message_saved"/);
    assert.deepEqual(S.sent()[0], { note: 'Default note for {{char}}', def: 'Default note for {{char}}', sum: 'Mara met Ren at the bakery.', has: 'true/false', think: '<think-na>', exp: 'joy', other: '{{naThirdParty}}' });
    assert.ok(S.seen.some(x => x.url === '/api/extensions/discover'));
});

test('일꾼 · 실리에서 요약을 끄면 {{summary}}는 실리처럼 글 그대로 · {{hasExtension::memory}}는 false', async t => {
    const S = await stage(t, { ext: { disabledExtensions: ['memory'] } });
    assert.match((await S.gen()).payload, /"message_saved"/);
    const b = S.sent()[0];
    assert.deepEqual([b.sum, b.has, b.note], ['{{summary}}', 'false/false', 'Default note for {{char}}']);
});

test('일꾼 · config.yaml에서 확장을 끈 실리(다리의 /discover가 실리의 404): 확장의 매크로 없이 · 옛 다리(표시 없는 404)면 실리 폴더를 직접 읽어요', async t => {
    const off = await stage(t, { discover: 'off' });
    assert.match((await off.gen()).payload, /"message_saved"/);
    assert.deepEqual([off.sent()[0].sum, off.sent()[0].has, off.sent()[0].exp, off.sent()[0].note], ['{{summary}}', 'false/false', '{{defaultExpression}}', 'Default note for {{char}}']);
    const old = await stage(t, { discover: 'old' });
    assert.match((await old.gen()).payload, /"message_saved"/);
    assert.deepEqual([old.sent()[0].sum, old.sent()[0].has], ['Mara met Ren at the bakery.', 'true/false']);
});
