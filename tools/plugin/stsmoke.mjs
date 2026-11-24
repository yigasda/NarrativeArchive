// real SillyTavern 1.19.1 with the plugin, no browser: the worker's scheduler makes a character write first through SillyTavern's
// own chat-completions handler (source "custom" pointed at a fake model server). The request is built on the server by
// SillyTavern's own code (plugin/st: createGenerationParameters) from settings.json — nothing left by a browser —, so
// SillyTavern's macros in the custom header · body fields come out filled. Then settings.json is changed (as SillyTavern does
// when its settings are changed) and a late reply goes out with the new values. The card is written through merge-attributes.
// Run: node tools/plugin/stsmoke.mjs <SillyTavern folder> <this repo>. It changes settings.json and the Seraphina card and
// leaves an Orbit store: put them back after (docs/SERVER-HANDOVER.md 7장).
process.env.NA_SCREEN_ANYWHERE = '1';
import http from 'node:http'; import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';
const [,, ST, REPO] = process.argv;
const log = (...a) => console.log(...a);
const asked = [];
let n = 0;
const model = http.createServer((req, res) => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { asked.push({ url: req.url, headers: req.headers, body: JSON.parse(b) }); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: [`from the server, through SillyTavern ${++n}`], status: { status: 'dnd', activity: 'reading', duration: '20m' } }) }, finish_reason: 'stop' }] })); }); });
await new Promise(r => model.listen(0, '127.0.0.1', r));
const custom_url = `http://127.0.0.1:${model.address().port}/v1`;
// settings.json: the draft model is SillyTavern's "custom" source; its header · body fields carry SillyTavern macros
const userDir = path.join(ST, 'data', 'default-user'), sfile = path.join(userDir, 'settings.json');
const settings = JSON.parse(fs.readFileSync(sfile, 'utf8'));
settings.oai_settings = { ...(settings.oai_settings || {}), custom_url, custom_include_headers: 'x-na-user: "{{user}}"', custom_include_body: 'na_char: "{{char}}"' };
settings.extension_settings = { ...(settings.extension_settings || {}), narrative_archive: { draftConn: { mode: 'source', source: 'custom', stModel: 'fake-model' } } };
fs.writeFileSync(sfile, JSON.stringify(settings, null, 4));
// the world, with the kit the browser would leave (which chat this is: nothing else)
const { startFresh, putLivePhone, ensureRoom, sendLive, liveWorld, enqueueJob } = await import(`${REPO}/src/phone2store.js`);
const { buildKit, putKit } = await import(`${REPO}/src/phone2kit.js`);
const { splitLive, joinLive } = await import(`${REPO}/src/phone2keep.js`);
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const m = {}; startFresh(m, { persona: 'Ren', now: Date.now() - 10 * 3600_000 });
putLivePhone(m, { owner: 'Seraphina' });
const room = ensureRoom(m, ['Seraphina']), w = liveWorld(m), at = Date.now() - 7 * 3600_000;
sendLive(m, room.id, 'hey', at); room.messages.push({ id: 't2', n: 2, from: 'Seraphina', text: 'hi', at: at + 60_000 });
room.meta = { ...(room.meta || {}), autonomousMessages: true, conversationSchedulesEnabled: true };   // (먼저 말 걸기 · 스케줄 켜기는 방마다: room.meta. 새 방은 마법사 시작 값으로 스케줄 꺼짐을 적어요; 앱에서는 그 방에서 스케줄을 만들면 켜져요)
w.presence = { schedules: { seraphina: { weekStart: new Date(Date.now() - 86400000).toISOString(), days: Object.fromEntries(DAYS.map(d => [d, [{ time: '00:00-23:59', activity: 'free time', status: 'online' }]])), inactivityThresholdMinutes: 60, talkativeness: 50 } }, overrides: {}, meta: {}, user: {} };
// (core.js reads the screen when it loads: the worker's do-nothing one)
await import(`${REPO}/plugin/screen.mjs`);
const { VERSION } = await import(`${REPO}/src/core.js`);
const chatFile = fs.readdirSync(path.join(userDir, 'chats', 'default_Seraphina')).find(f => f.endsWith('.jsonl'));
const kit = buildKit({ chatId: chatFile.replace(/\.jsonl$/, ''), characterId: 0, characters: [{ name: 'Seraphina', avatar: 'default_Seraphina.png' }] }, m, { version: VERSION });
putKit(m, kit);
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
let me = '';   // (the persona the server answered as: SillyTavern's own, read from settings.json)
const load = async () => liveWorld({ live: joinLive((await call('/store/load', { id: 'smoke1' })).json.parts) });
try {
    const ping = await call('/ping'); ok('ping: the worker is on inside SillyTavern', ping.json?.auto === true, JSON.stringify(ping.json));
    ok('the kit says only which chat this is (no request templates)', JSON.stringify(Object.keys(kit).sort()) === '["chat","v","ver"]', JSON.stringify(kit));
    const saved = await call('/store/save', { id: 'smoke1', base: null, chat: 'smoke', parts: JSON.parse(JSON.stringify(splitLive(m.live))) });
    ok('store save', saved.json?.rev === 1);
    const stat = await call('/auto/status', { id: 'smoke1' }); ok('status: the room can be served', stat.json?.on === true && stat.json.rooms?.[0]?.can === true, JSON.stringify(stat.json));
    // the scheduler: first look 20 s after the worker started, then every 60 s
    let got = null;
    for (let i = 0; i < 180 && !got; i++) { await new Promise(r => setTimeout(r, 1000)); const ww = await load(); if (ww.messenger.rooms[room.id].messages.length > 2) got = ww; }
    ok('the character wrote first while no browser was there', !!got, got ? JSON.stringify(got.messenger.rooms[room.id].messages.map(x => [x.from, x.text])) : out.slice(-1500));
    ok('the request went through SillyTavern to the provider', asked.length >= 1 && asked[0].url.endsWith('/chat/completions'), JSON.stringify(asked.map(a => a.url)));
    if (asked[0]) {
        const b = asked[0].body;
        me = /You are Seraphina\. (.+?) is texting you on MESSENGER/.exec(b.messages?.[0]?.content || '')?.[1] || '';
        ok('provider got our messages and the model', b.model === 'fake-model' && b.messages?.[0]?.role === 'system' && /^GOAL\nYou are Seraphina/.test(b.messages[0].content) && /\[WHY NOW\]/.test(b.messages[1].content), JSON.stringify({ model: b.model, max: b.max_tokens ?? b.max_completion_tokens, temp: b.temperature }));
        ok('the reply\'s values: length 4000, temperature 0.3', (b.max_tokens ?? b.max_completion_tokens) === 4000 && b.temperature === 0.3, JSON.stringify({ max: b.max_tokens ?? b.max_completion_tokens, temp: b.temperature }));
        // (SillyTavern's macros, filled on the server by SillyTavern's own code with this chat's names — then SillyTavern's server
        //  put the header and the body field on the provider's request)
        ok('SillyTavern macros filled on the server: {{user}} in the header, {{char}} in the body', !!me && asked[0].headers['x-na-user'] === me && b.na_char === 'Seraphina', JSON.stringify({ header: asked[0].headers['x-na-user'], persona: me, na_char: b.na_char }));
    }
    if (got) {
        const r = got.messenger.rooms[room.id];
        ok('unread mark, daily count', r.autonomousUnreadCount === 1 && Object.values(r.meta?.autonomousDailyBudget?.counts || {})[0] === 1, JSON.stringify([r.autonomousUnreadCount, r.meta?.autonomousDailyBudget]));
        // the card file: SillyTavern's merge-attributes wrote our extension field
        const png = fs.readFileSync(path.join(userDir, 'characters', 'default_Seraphina.png')).toString('latin1');
        const cardHas = /narrative_archive_convo/.test(Buffer.from((png.match(/chara\0([A-Za-z0-9+/=]+)/) || [])[1] || '', 'base64').toString('utf8')) || /narrative_archive_convo/.test(Buffer.from((png.match(/ccv3\0([A-Za-z0-9+/=]+)/) || [])[1] || '', 'base64').toString('utf8'));
        ok('the card file has the schedule/status (merge-attributes)', cardHas);
        // SillyTavern's settings change (here: settings.json as SillyTavern writes it), and a late reply is due: the next request
        // has the new values, with no browser — the server reads settings.json for every job
        const now2 = JSON.parse(fs.readFileSync(sfile, 'utf8'));
        now2.oai_settings = { ...now2.oai_settings, custom_include_body: 'na_char: "{{char}} (changed)"\nna_where: "{{user}} at home"' };
        fs.writeFileSync(sfile, JSON.stringify(now2, null, 4));
        const l = await call('/store/load', { id: 'smoke1' }), live = joinLive(l.json.parts), real = { live };
        const job = enqueueJob(real, { kind: 'reply', owner: 'Seraphina', room: room.id, at: Date.now() - 60_000 }); Object.assign(job, { timed: true, notBefore: Date.now() - 1000 });
        const since = asked.length;
        const put = await call('/store/save', { id: 'smoke1', base: l.json.rev, chat: 'smoke', parts: JSON.parse(JSON.stringify(splitLive(live))) });
        ok('store save (a late reply due)', !!put.json?.rev, JSON.stringify(put.json));
        for (let i = 0; i < 60 && asked.length === since; i++) await new Promise(r => setTimeout(r, 1000));
        const b2 = asked[since]?.body;
        ok('settings.json changed → the next request has the new body field, with no browser', !!b2 && b2.na_char === 'Seraphina (changed)' && !!me && b2.na_where === `${me} at home`, JSON.stringify({ na_char: b2?.na_char, na_where: b2?.na_where }));
        let w3 = null;
        for (let i = 0; i < 20 && !w3; i++) { await new Promise(r => setTimeout(r, 500)); const ww = await load(); if (ww.messenger.rooms[room.id].messages.at(-1)?.text === 'from the server, through SillyTavern 2') w3 = ww; }
        ok('the late reply is in the room', !!w3);
    }
    const pres = await call('/auto/presence', { id: 'smoke1', status: 'active' }); ok('presence', pres.json?.on === true && pres.json.rooms === 1, JSON.stringify(pres.json));
} finally {
    log(out.split('\n').filter(l => /narrative-archive|autonomous|due-replies|Error|error/i.test(l)).slice(-25).join('\n'));
    st.kill('SIGTERM'); model.close();
    await new Promise(r => setTimeout(r, 1500));
    log(fail ? `FAILED ${fail}` : 'ALL OK'); process.exit(fail ? 1 : 0);
}
