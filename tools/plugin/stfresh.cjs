// real SillyTavern 1.19.1 + real browser + the plugin: what is changed in SillyTavern reaches the server's next reply at once.
// In the browser, the way a person does it: the persona switched (setUserAvatar, as the quick switcher does), the card's
// description typed into the editor (SillyTavern saves it a moment later), a role-play message sent (/send). Nothing of ours
// is refreshed by hand. Then the tab is hidden and the server's worker sends a reply for later: its request must carry the
// new persona, the new card and the new message.
// Usage: node tools/plugin/stfresh.cjs <SillyTavern folder>   (about 1 minute; backs up and restores settings.json and the
// Seraphina card, adds a persona picture and takes it away again)
const http = require('node:http'), { spawn } = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const [,, ST] = process.argv;
const log = (...a) => console.log(...a);
(async () => {
    const user = path.join(ST, 'data', 'default-user');
    const settingsFile = path.join(user, 'settings.json'), backup = fs.readFileSync(settingsFile);
    const cardFile = path.join(user, 'characters', 'default_Seraphina.png'), cardBackup = fs.readFileSync(cardFile);
    // (a second persona, Ren: a picture in User Avatars and its name and description in settings.json)
    const renPic = path.join(user, 'User Avatars', 'ren.png');
    fs.copyFileSync(path.join(user, 'User Avatars', 'user-default.png'), renPic);
    const s = JSON.parse(backup.toString());
    s.power_user.personas['ren.png'] = 'Ren';
    s.power_user.persona_descriptions['ren.png'] = { description: 'Ren is a student.', position: 0 };
    fs.writeFileSync(settingsFile, JSON.stringify(s, null, 4));
    const asked = [];
    const model = http.createServer((req, res) => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { let body = null; try { body = JSON.parse(b); } catch { body = b; } asked.push({ url: req.url, body }); res.setHeader('content-type', 'application/json'); if (req.url.endsWith('/models')) { res.end(JSON.stringify({ data: [{ id: 'fake-model' }] })); return; } res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: ['on it'], status: '' }) }, finish_reason: 'stop' }] })); }); });
    await new Promise(r => model.listen(0, '127.0.0.1', r));
    const custom_url = `http://127.0.0.1:${model.address().port}/v1`, PORT = 8126, base = `http://127.0.0.1:${PORT}`;
    const st = spawn(process.execPath, ['server.js', '--port', String(PORT)], { cwd: ST });
    let out = ''; st.stdout.on('data', d => (out += d)); st.stderr.on('data', d => (out += d));
    for (let i = 0; i < 120; i++) { try { const r = await fetch(`${base}/csrf-token`); if (r.ok) break; } catch { /* not up */ } await new Promise(r => setTimeout(r, 500)); }
    let fail = 0; const ok = (name, cond, more = '') => { log(cond ? 'OK  ' : 'FAIL', name, more); if (!cond) fail++; };
    const browser = await chromium.launch(), page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error' && /narrative|phone2|Orbit/i.test(m.text())) errors.push(m.text().slice(0, 300)); });
    const completions = () => asked.filter(a => a.url.endsWith('/chat/completions'));
    const textOf = body => (body?.messages || []).map(x => (typeof x.content === 'string' ? x.content : '')).join('\n');
    try {
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof window.SillyTavern?.getContext === 'function' && window.SillyTavern.getContext().characters?.length > 0, null, { timeout: 90000 });
        await page.waitForTimeout(4000);
        await page.evaluate(async () => { await SillyTavern.getContext().executeSlashCommandsWithOptions('/go Seraphina'); });
        await page.waitForFunction(() => !!SillyTavern.getContext().chatId, null, { timeout: 30000 });
        await page.waitForTimeout(1500);
        // an Orbit begun from the story (so a reply carries the role-play's last messages), kept in the plugin
        const r1 = await page.evaluate(async url => {
            const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
            const core = await import(B + 'core.js'), S = await import(B + 'phone2store.js'), G = await import(B + 'phone2go.js'), KO = await import(B + 'phone2keepon.js'), O = await import('/scripts/openai.js');
            const c = SillyTavern.getContext();
            O.oai_settings.custom_url = url;
            (c.extensionSettings.narrative_archive ||= {}).draftConn = { mode: 'source', source: 'custom', stModel: 'fake-model' };
            c.saveSettingsDebounced();
            await KO.liveReady();
            const m = core.getMeta(), upto = c.chat.length - 1;
            S.startFromStory(m, { persona: c.name1, upto, now: Date.now() - 10 * 3600_000 });
            const w = S.liveWorld(m);
            w.snap = { v: 1, at: 1, upto, text: '## #0–#0 — start\n- they met in the glade\n', recent: [], made: { from: 0, to: upto, count: 1, parts: 1 } };
            S.putLivePhone(m, { owner: 'Seraphina' });
            const room = S.ensureRoom(m, ['Seraphina']), at = Date.now() - 3600_000;
            S.sendLive(m, room.id, 'hey', at); room.messages.push({ id: 't2', n: upto + 2, from: 'Seraphina', text: 'hi', at: at + 60_000 });
            w.presence = { on: false, schedules: {}, overrides: {}, meta: {}, user: {} };
            await core.saveMeta();
            await KO.keepBeat();
            await G.liveKitRefresh(m); await core.saveMeta();
            window.__na = { core, S, G, KO, m, room };
            return { state: KO.keepState(), serves: KO.keepServes(), kit: m.live.kit };
        }, custom_url);
        ok('browser: Orbit kept in the plugin, worker on', r1.state === 'ok' && r1.serves === true, JSON.stringify(r1.state));
        ok('the kit says only which chat this is (nothing the server reads fresh)', !('characters' in r1.kit) && !('name1' in r1.kit) && !('tail' in r1.kit) && !('meta' in r1.kit), JSON.stringify(r1.kit).slice(0, 200));
        await page.waitForTimeout(2500);   // (settings.json: SillyTavern saves a moment later)
        // what a person does in SillyTavern: switch the persona, edit the card, send a role-play message
        const r2 = await page.evaluate(async () => {
            const P = await import('/scripts/personas.js');
            await P.setUserAvatar('ren.png');
            $('#description_textarea').val('Seraphina is a pilot now.').trigger('input');
            await SillyTavern.getContext().executeSlashCommandsWithOptions('/send at the door now');
            return { name1: SillyTavern.getContext().name1 };
        });
        ok('browser: the persona is Ren now', r2.name1 === 'Ren', JSON.stringify(r2));
        await page.waitForTimeout(3500);   // (SillyTavern saves the card, the chat and the settings a moment later)
        const header = JSON.parse(fs.readFileSync(path.join(user, 'chats', 'Seraphina', fs.readdirSync(path.join(user, 'chats', 'Seraphina')).sort().at(-1)), 'utf8').split('\n')[0]);
        ok('the chat file remembers this chat\'s persona (stPersona)', header.chat_metadata?.narrative_archive?.stPersona === 'ren.png', JSON.stringify(header.chat_metadata?.narrative_archive?.stPersona));
        // the tab is hidden; a reply for later (in 2 s): the server sends it
        await page.evaluate(async () => {
            const { core, S, m, room } = window.__na;
            S.sendLive(m, room.id, 'you there?');
            const job = S.enqueueJob(m, { kind: 'reply', owner: 'Seraphina', room: room.id });
            Object.assign(job, { timed: true, notBefore: Date.now() + 2000 });
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
            await core.saveMeta();
        });
        for (let i = 0; i < 60 && !completions().length; i++) await page.waitForTimeout(500);
        const text = textOf(completions()[0]?.body);
        ok('the server answered', completions().length === 1, out.split('\n').filter(l => /narrative-archive|due-replies/i.test(l)).slice(-6).join(' | '));
        ok('the server\'s request: the persona switched a moment ago', /\[PERSONA — Ren\]\nRen is a student\./.test(text) && /Ren is texting you/.test(text), (text.match(/\[PERSONA[^\n]*\n[^\n]*/) || [''])[0]);
        ok('the server\'s request: the card as edited a moment ago', /Seraphina is a pilot now\./.test(text), (text.match(/\[Seraphina's card\]\n[^\n]*\n[^\n]*/) || [''])[0]);
        ok('the server\'s request: the role-play message sent a moment ago', /\[LAST MESSAGES\][\s\S]*Ren: at the door now/.test(text), (text.match(/\[LAST MESSAGES\][\s\S]{0,300}/) || [''])[0]);
        ok('no errors from the extension on the page', errors.filter(e => !/Internal S/.test(e)).length === 0, errors.join(' || '));
    } catch (e) { fail++; log('THREW', String(e?.stack || e).slice(0, 600)); log(errors.join(' || ')); }
    finally {
        await browser.close(); st.kill('SIGTERM'); model.close(); await new Promise(r => setTimeout(r, 1500));
        fs.writeFileSync(settingsFile, backup); fs.writeFileSync(cardFile, cardBackup); fs.rmSync(renPic, { force: true });
        log(fail ? `FAILED ${fail}` : 'ALL OK'); process.exit(fail ? 1 : 0);
    }
})();
