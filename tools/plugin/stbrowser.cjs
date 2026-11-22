// real SillyTavern 1.19.1 + real browser + the plugin: the browser leaves the kit (with a request template made by
// SillyTavern's own createGenerationParameters), the tab is hidden, the server's worker makes the character write first
// through SillyTavern's "custom" source, and the browser takes it in when the tab shows again
const http = require('node:http'), { spawn } = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const [,, ST] = process.argv;
const log = (...a) => console.log(...a);
(async () => {
    const asked = [];
    const model = http.createServer((req, res) => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { let body = null; try { body = JSON.parse(b); } catch { body = b; } asked.push({ url: req.url, body }); res.setHeader('content-type', 'application/json'); if (req.url.endsWith('/models')) { res.end(JSON.stringify({ data: [{ id: 'fake-model' }] })); return; } res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: ['written by the server while the tab was hidden'], status: '' }) }, finish_reason: 'stop' }] })); }); });
    await new Promise(r => model.listen(0, '127.0.0.1', r));
    const custom_url = `http://127.0.0.1:${model.address().port}/v1`, PORT = 8124, base = `http://127.0.0.1:${PORT}`;
    const st = spawn(process.execPath, ['server.js', '--port', String(PORT)], { cwd: ST });
    let out = ''; st.stdout.on('data', d => (out += d)); st.stderr.on('data', d => (out += d));
    for (let i = 0; i < 120; i++) { try { const r = await fetch(`${base}/csrf-token`); if (r.ok) break; } catch { /* not up */ } await new Promise(r => setTimeout(r, 500)); }
    let fail = 0; const ok = (name, cond, more = '') => { log(cond ? 'OK  ' : 'FAIL', name, more); if (!cond) fail++; };
    const browser = await chromium.launch(), page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
    const bad = [];
    page.on('response', async r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.request().method()} ${r.url().replace(base, '')} :: ${(await r.text().catch(() => '')).slice(0, 160)}`); });
    page.on('pageerror', e => errors.push('STACK ' + String(e?.stack || '').slice(0, 500)));
    page.on('console', m => { if (m.type() === 'error' && /narrative|phone2|Orbit/i.test(m.text())) errors.push(m.text().slice(0, 300)); });
    try {
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof window.SillyTavern?.getContext === 'function' && window.SillyTavern.getContext().characters?.length > 0, null, { timeout: 90000 });
        await page.waitForTimeout(4000);
        // open the default character's chat
        await page.evaluate(async () => { const c = SillyTavern.getContext(); await c.executeSlashCommandsWithOptions('/go Seraphina'); });
        await page.waitForFunction(() => !!SillyTavern.getContext().chatId, null, { timeout: 30000 });
        await page.waitForTimeout(1500);
        const r1 = await page.evaluate(async url => {
            const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
            const core = await import(B + 'core.js'), S = await import(B + 'phone2store.js'), G = await import(B + 'phone2go.js'), KO = await import(B + 'phone2keepon.js'), O = await import('/scripts/openai.js');
            const c = SillyTavern.getContext();
            // the draft model: SillyTavern's own "custom" source, pointed at the fake provider
            O.oai_settings.custom_url = url;
            (c.extensionSettings.narrative_archive ||= {}).draftConn = { mode: 'source', source: 'custom', stModel: 'fake-model' };
            c.saveSettingsDebounced();
            await KO.liveReady();
            const m = core.getMeta();
            S.startFresh(m, { persona: c.name1, now: Date.now() - 10 * 3600_000 });
            S.putLivePhone(m, { owner: 'Seraphina' });
            const room = S.ensureRoom(m, ['Seraphina']), w = S.liveWorld(m), at = Date.now() - 7 * 3600_000;
            S.sendLive(m, room.id, 'hey', at); room.messages.push({ id: 't2', n: 2, from: 'Seraphina', text: 'hi', at: at + 60_000 });
            w.presence = { on: false, schedules: {}, overrides: {}, meta: {}, user: {} };
            await core.saveMeta();
            await KO.keepBeat();
            const made = await G.liveKitRefresh(m);
            await core.saveMeta();
            const again = await G.liveKitRefresh(m);
            window.__na = { core, S, G, KO, m, room };
            const kit = m.live.kit, tpl = Object.values(kit?.st || {})[0];
            return { again, ver: kit?.ver, file: kit?.chat?.file, coreVer: core.VERSION, state: KO.keepState(), ref: m.liveRef?.id || '', serves: KO.keepServes(), made, kitChars: kit?.characters?.map(x => x.name), name1: kit?.name1, templates: Object.keys(kit?.st || {}).length, tplKeys: tpl ? Object.keys(tpl.data).sort() : [], tplSecrets: tpl?.secrets, hasPw: JSON.stringify(kit).includes('proxy_password'), status: await G.liveServerStatus(m) };
        }, custom_url);
        log(JSON.stringify(r1));
        ok('browser: Orbit kept in the plugin, worker on', r1.state === 'ok' && !!r1.ref && r1.serves === true);
        ok('browser: kit left, with one request template made by SillyTavern itself', r1.made === true && r1.templates === 1 && r1.kitChars?.includes('Seraphina'), JSON.stringify(r1.tplKeys));
        ok('browser: the template holds no messages', !r1.tplKeys.includes('messages'));
        ok('browser: the kit does not change when nothing changed (no save every 30 s)', r1.again === false);
        ok('browser: the kit names the version and the chat file, and that file is there', r1.ver === r1.coreVer && !!r1.file && fs.existsSync(path.join(ST, 'data', 'default-user', 'chats', r1.file.dir, r1.file.id + '.jsonl')), JSON.stringify(r1.file));
        await page.waitForTimeout(2500);   // (settings.json: SillyTavern saves a moment later)
        const status = await page.evaluate(async () => window.__na.G.liveServerStatus(window.__na.m));
        ok('server says this room can be served while SillyTavern is closed', Object.values(status.rooms)[0]?.can === true, JSON.stringify(status));
        const sj = JSON.parse(fs.readFileSync(path.join(ST, 'data', 'default-user', 'settings.json'), 'utf8'));
        ok('settings.json has the draft connection and the custom url', sj.extension_settings?.narrative_archive?.draftConn?.source === 'custom' && sj.oai_settings?.custom_url === custom_url);
        // the tab is hidden; characters may write first from now
        await page.evaluate(async () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); const { core, S, m } = window.__na; S.liveWorld(m).presence.on = true; await core.saveMeta(); });
        log('waiting for the server (75 s without the browser, then its next look) …');
        let got = false;
        for (let i = 0; i < 200 && !got; i++) { await page.waitForTimeout(1000); got = asked.some(a => a.url.endsWith('/chat/completions')); }
        ok('the server asked the provider through SillyTavern while the tab was hidden', got, out.split('\n').filter(l => /narrative-archive|autonomous/i.test(l)).slice(-6).join(' | '));
        const b = asked.find(a => a.url.endsWith('/chat/completions'))?.body;
        if (b) ok('the request: our messages on the template', b.model === 'fake-model' && b.messages?.[0]?.role === 'system' && /^GOAL\nYou are Seraphina/.test(b.messages[0].content) && /\[WHY NOW\]/.test(b.messages[1].content), JSON.stringify({ model: b.model, max_tokens: b.max_tokens, temperature: b.temperature, keys: Object.keys(b).sort() }));
        await page.waitForTimeout(2500);
        const r2 = await page.evaluate(async () => {
            const { G, KO, m, room } = window.__na, before = room.messages.length;
            delete document.hidden;
            await KO.keepBeat();
            const queued = await G.liveAutonomous(m);
            return { before, after: room.messages.map(x => [x.from, x.text, x.extra?.autonomous === true]), unread: G.liveAutonomousUnread(m), queued, budget: m.live.world.presence.meta.autonomousDailyBudget };
        });
        log(JSON.stringify(r2));
        ok('browser had not seen it while hidden', r2.before === 2);
        ok('browser took the server\'s message in when the tab showed again', r2.after.length === 3 && r2.after[2][0] === 'Seraphina' && r2.after[2][2] === true);
        ok('unread mark and today\'s count came too', r2.unread[0]?.count === 1 && Object.values(r2.budget?.counts || {})[0] === 1);
        ok('the browser does not write first again right away', r2.queued === 0);
        ok('no errors from the extension on the page', errors.filter(e => !/Internal S|^STACK\s*$/.test(e)).length === 0, errors.join(' || '));
        log('BAD RESPONSES', JSON.stringify(bad, null, 1));
    } catch (e) { fail++; log('THREW', String(e?.stack || e).slice(0, 600)); log(errors.join(' || ')); }
    finally { await browser.close(); st.kill('SIGTERM'); model.close(); await new Promise(r => setTimeout(r, 1500)); log(fail ? `FAILED ${fail}` : 'ALL OK'); process.exit(fail ? 1 : 0); }
})();
