// real SillyTavern 1.19.1 with the plugin: the worker's scheduler makes a character write first, through SillyTavern's own
// chat-completions handler (source "custom" pointed at a fake model server), and writes the card through merge-attributes
process.env.NA_SCREEN_ANYWHERE = '1';
import http from 'node:http'; import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';
const [,, ST, REPO] = process.argv;
const log = (...a) => console.log(...a);
const asked = [];
const model = http.createServer((req, res) => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { asked.push({ url: req.url, body: JSON.parse(b) }); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: ['from the server, through SillyTavern'], status: { status: 'dnd', activity: 'reading', duration: '20m' } }) }, finish_reason: 'stop' }] })); }); });
await new Promise(r => model.listen(0, '127.0.0.1', r));
const custom_url = `http://127.0.0.1:${model.address().port}/v1`;
// settings.json: the draft model is SillyTavern's "custom" source
const userDir = path.join(ST, 'data', 'default-user'), sfile = path.join(userDir, 'settings.json');
const settings = JSON.parse(fs.readFileSync(sfile, 'utf8'));
settings.oai_settings = { ...(settings.oai_settings || {}), custom_url };
settings.extension_settings = { ...(settings.extension_settings || {}), narrative_archive: { draftConn: { mode: 'source', source: 'custom', stModel: 'fake-model' } } };
fs.writeFileSync(sfile, JSON.stringify(settings));
// the world, with the kit the browser would leave
const { startFresh, putLivePhone, ensureRoom, sendLive, liveWorld } = await import(`${REPO}/src/phone2store.js`);
const { buildKit, putKit } = await import(`${REPO}/src/phone2kit.js`);
const { splitLive, joinLive } = await import(`${REPO}/src/phone2keep.js`);
await import(`${REPO}/plugin/screen.mjs`);
const AI = await import(`${REPO}/src/ai.js`);
globalThis.__naStOpenai = { oai_settings: settings.oai_settings, createGenerationParameters: async (s, m, type, messages) => ({ generate_data: { type, messages, model: m, temperature: s.temp_openai, max_tokens: s.openai_max_tokens, stream: false, chat_completion_source: s.chat_completion_source, custom_url: s.custom_url, custom_include_body: '', custom_exclude_body: '', custom_include_headers: '', reasoning_effort: s.reasoning_effort, include_reasoning: s.show_thoughts } }) };
const tpl = await AI.stSourceTemplate({ mode: 'source', source: 'custom', stModel: 'fake-model' }, { maxTokens: 4000, effort: 'low', thoughts: true });
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const m = {}; startFresh(m, { persona: 'Ren', now: Date.now() - 10 * 3600_000 });
putLivePhone(m, { owner: 'Seraphina' });
const room = ensureRoom(m, ['Seraphina']), w = liveWorld(m), at = Date.now() - 7 * 3600_000;
sendLive(m, room.id, 'hey', at); room.messages.push({ id: 't2', n: 2, from: 'Seraphina', text: 'hi', at: at + 60_000 });
w.presence = { on: true, schedules: { seraphina: { weekStart: new Date(Date.now() - 86400000).toISOString(), days: Object.fromEntries(DAYS.map(d => [d, [{ time: '00:00-23:59', activity: 'free time', status: 'online' }]])), inactivityThresholdMinutes: 60, talkativeness: 50 } }, overrides: {}, meta: {}, user: {} };
const { VERSION } = await import(`${REPO}/src/core.js`);
const chatFile = fs.readdirSync(path.join(userDir, 'chats', 'default_Seraphina')).find(f => f.endsWith('.jsonl'));
const kit = buildKit({ name1: 'Ren', chatId: chatFile.replace(/\.jsonl$/, ''), characterId: 0, characters: [{ name: 'Seraphina', avatar: 'default_Seraphina.png', description: 'A guardian of the forest.', data: { name: 'Seraphina', description: 'A guardian of the forest.', extensions: {} } }], powerUserSettings: { persona_description: 'Ren is a traveller.' } }, m, { lines: [], first: null, end: 0 }, { version: VERSION });
kit.st = { [tpl.key]: { data: tpl.data, secrets: tpl.secrets } }; putKit(m, kit);
// boot SillyTavern
const PORT = 8123;
const st = spawn(process.execPath, ['server.js', '--port', String(PORT)], { cwd: ST, env: { ...process.env, NA_SCREEN_ANYWHERE: '' } });
let out = ''; st.stdout.on('data', d => (out += d)); st.stderr.on('data', d => (out += d));
const base = `http://127.0.0.1:${PORT}`;
for (let i = 0; i < 120; i++) { try { const r = await fetch(`${base}/csrf-token`); if (r.ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }
const tr = await fetch(`${base}/csrf-token`), cookie = (tr.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; '), token = (await tr.json()).token;
const H = { 'Content-Type': 'application/json', 'X-CSRF-Token': token, Cookie: cookie };
const call = async (p, body) => { const r = await fetch(`${base}/api/plugins/narrative-archive${p}`, body === undefined ? { headers: H } : { method: 'POST', headers: H, body: JSON.stringify(body) }); return { code: r.status, json: await r.json().catch(() => null) }; };
let fail = 0; const ok = (name, cond, more = '') => { log(cond ? 'OK  ' : 'FAIL', name, more); if (!cond) fail++; };
try {
    const ping = await call('/ping'); ok('ping: the worker is on inside SillyTavern', ping.json?.auto === true, JSON.stringify(ping.json));
    const saved = await call('/store/save', { id: 'smoke1', base: null, chat: 'smoke', parts: JSON.parse(JSON.stringify(splitLive(m.live))) });
    ok('store save', saved.json?.rev === 1);
    const stat = await call('/auto/status', { id: 'smoke1' }); ok('status: the room can be served', stat.json?.on === true && stat.json.rooms?.[0]?.can === true, JSON.stringify(stat.json));
    // the scheduler: first look 20 s after the worker started, then every 60 s
    let got = null;
    for (let i = 0; i < 180 && !got; i++) { await new Promise(r => setTimeout(r, 1000)); const l = await call('/store/load', { id: 'smoke1' }); const ww = liveWorld({ live: joinLive(l.json.parts) }); if (ww.messenger.rooms[room.id].messages.length > 2) got = ww; }
    ok('the character wrote first while no browser was there', !!got, got ? JSON.stringify(got.messenger.rooms[room.id].messages.map(x => [x.from, x.text])) : out.slice(-1500));
    ok('the request went through SillyTavern to the provider', asked.length >= 1 && asked[0].url.endsWith('/chat/completions'), JSON.stringify(asked.map(a => a.url)));
    if (asked[0]) { const b = asked[0].body; ok('provider got our messages and the model', b.model === 'fake-model' && b.messages?.[0]?.role === 'system' && /^GOAL\nYou are Seraphina/.test(b.messages[0].content) && /\[WHY NOW\]/.test(b.messages[1].content), JSON.stringify({ model: b.model, max: b.max_tokens, temp: b.temperature })); }
    if (got) {
        const r = got.messenger.rooms[room.id];
        ok('unread mark, daily count', r.autonomousUnreadCount === 1 && Object.values(got.presence.meta.autonomousDailyBudget.counts)[0] === 1, JSON.stringify([r.autonomousUnreadCount, got.presence.meta.autonomousDailyBudget]));
        // the card file: SillyTavern's merge-attributes wrote our extension field
        const png = fs.readFileSync(path.join(userDir, 'characters', 'default_Seraphina.png')).toString('latin1');
        const cardHas = /narrative_archive_convo/.test(Buffer.from((png.match(/chara\0([A-Za-z0-9+/=]+)/) || [])[1] || '', 'base64').toString('utf8')) || /narrative_archive_convo/.test(Buffer.from((png.match(/ccv3\0([A-Za-z0-9+/=]+)/) || [])[1] || '', 'base64').toString('utf8'));
        ok('the card file has the schedule/status (merge-attributes)', cardHas);
    }
    const pres = await call('/auto/presence', { id: 'smoke1', status: 'active' }); ok('presence', pres.json?.on === true && pres.json.rooms === 1, JSON.stringify(pres.json));
} finally {
    log(out.split('\n').filter(l => /narrative-archive|autonomous|Error|error/i.test(l)).slice(-25).join('\n'));
    st.kill('SIGTERM'); model.close();
    await new Promise(r => setTimeout(r, 1500));
    log(fail ? `FAILED ${fail}` : 'ALL OK'); process.exit(fail ? 1 : 0);
}
