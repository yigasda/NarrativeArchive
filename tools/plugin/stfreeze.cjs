// real SillyTavern 1.19.1 + real browser + the plugin: the tab left open in the background, as a phone does it — hidden, then frozen
// (Chrome stops its timers: Page.setWebLifecycleState). A reply for later; the server sends it at its time while the tab is frozen.
// Then the tab wakes the way a phone wakes it (resumed, shown, its timers fire): the server's reply must show, and nothing is asked again.
// Usage: node tools/plugin/stfreeze.cjs <SillyTavern folder>   (about 2 minutes; backs up and restores settings.json)
//
//
// Usage: node tools/plugin/stwake.cjs <SillyTavern folder>   (about 3 minutes; backs up and restores settings.json)
const http = require('node:http'), { spawn } = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const [,, ST] = process.argv;
const log = (...a) => console.log(...a);
(async () => {
    const settingsFile = path.join(ST, 'data', 'default-user', 'settings.json'), backup = fs.readFileSync(settingsFile);
    const asked = [];
    const model = http.createServer((req, res) => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { let body = null; try { body = JSON.parse(b); } catch { body = b; } asked.push({ url: req.url, body }); res.setHeader('content-type', 'application/json'); if (req.url.endsWith('/models')) { res.end(JSON.stringify({ data: [{ id: 'fake-model' }] })); return; } const n = asked.filter(a => a.url.endsWith('/chat/completions')).length; res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: [`answer ${n}`], status: '' }) }, finish_reason: 'stop' }] })); }); });
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
    const completions = () => asked.filter(a => a.url.endsWith('/chat/completions')).length;
    try {
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof window.SillyTavern?.getContext === 'function' && window.SillyTavern.getContext().characters?.length > 0, null, { timeout: 90000 });
        await page.waitForTimeout(4000);
        await page.evaluate(async () => { await SillyTavern.getContext().executeSlashCommandsWithOptions('/go Seraphina'); });
        await page.waitForFunction(() => !!SillyTavern.getContext().chatId, null, { timeout: 30000 });
        await page.waitForTimeout(1500);
        const r1 = await page.evaluate(async url => {
            const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
            const core = await import(B + 'core.js'), S = await import(B + 'phone2store.js'), G = await import(B + 'phone2go.js'), KO = await import(B + 'phone2keepon.js'), TICK = await import(B + 'phone2tick.js'), O = await import('/scripts/openai.js');
            const c = SillyTavern.getContext();
            O.oai_settings.custom_url = url;
            (c.extensionSettings.narrative_archive ||= {}).draftConn = { mode: 'source', source: 'custom', stModel: 'fake-model' };
            c.saveSettingsDebounced();
            await KO.liveReady();
            const m = core.getMeta();
            S.startFresh(m, { persona: c.name1, now: Date.now() - 10 * 3600_000 });
            S.putLivePhone(m, { owner: 'Seraphina' });
            const room = S.ensureRoom(m, ['Seraphina']), w = S.liveWorld(m), at = Date.now() - 3600_000;
            S.sendLive(m, room.id, 'hey', at); room.messages.push({ id: 't2', n: 2, from: 'Seraphina', text: 'hi', at: at + 60_000 });
            w.presence = { on: false, schedules: {}, overrides: {}, meta: {}, user: {} };
            await core.saveMeta();
            await KO.keepBeat();
            await G.liveKitRefresh(m); await core.saveMeta();
            window.__na = { core, S, G, KO, TICK, m, room };
            window.__naReplies = [];
            document.addEventListener('na-live-reply', e => window.__naReplies.push(e.detail));
            return { state: KO.keepState(), ref: m.liveRef?.id || '', serves: KO.keepServes() };
        }, custom_url);
        ok('browser: Orbit kept in the plugin, worker on', r1.state === 'ok' && !!r1.ref && r1.serves === true, JSON.stringify(r1));
        // I send a message; the character is busy: a reply for later (in 8 s), the browser's own timer set for it as liveGo sets it
        const r2 = await page.evaluate(async () => {
            const { core, S, TICK, m, room } = window.__na;
            S.sendLive(m, room.id, 'so tired');
            const job = S.enqueueJob(m, { kind: 'reply', owner: 'Seraphina', room: room.id });
            Object.assign(job, { timed: true, notBefore: Date.now() + 8000 });
            await core.saveMeta();
            TICK.tickAt(job.notBefore);
            window.__na.job = job;
            // hidden, as a phone hides a tab it puts away
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
            document.dispatchEvent(new Event('visibilitychange'));
            return { jobs: S.liveWorld(m).queue.jobs.filter(j => j.state === 'waiting').length };
        });
        ok('a reply for later is queued and saved', r2.jobs === 1);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
        log('frozen; waiting for the server (the reply is due in 8 s) …');
        const t0 = Date.now();
        let got = false;
        for (let i = 0; i < 80 && !got; i++) { await new Promise(r => setTimeout(r, 500)); got = completions() >= 1; }
        ok('the server sent the reply while the tab was frozen', got, `${Date.now() - t0} ms · ` + out.split('\n').filter(l => /narrative-archive|due-replies/i.test(l)).slice(-6).join(' | '));
        await new Promise(r => setTimeout(r, 40000));   // (a while later, as on the phone: the tab's 30-second tick and due timer are overdue)
        // the phone wakes the tab: resumed, then shown
        await cdp.send('Page.setWebLifecycleState', { state: 'active' });
        await page.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
        const seen = [];
        for (let i = 0; i < 30; i++) {
            await page.waitForTimeout(500);
            seen.push(await page.evaluate(() => { const { S, m, room, job } = window.__na, w = S.liveWorld(m), j = w.queue.jobs.find(x => x.id === job.id); return `${room.messages.length}:${j?.state}:${window.__naReplies.length}`; }));
        }
        log('after waking (messages:job state:replies heard), every 0.5 s:', seen.join(' '));
        const r3 = await page.evaluate(() => { const { S, m, room, job } = window.__na; return { shown: room.messages.map(x => [x.from, x.text]), state: S.liveWorld(m).queue.jobs.find(j => j.id === job.id)?.state, replies: window.__naReplies }; });
        log(JSON.stringify(r3));
        ok('woken: the server\'s reply is there', r3.shown.length === 4 && r3.shown[3][1] === 'answer 1');
        ok('woken: nothing asked again', completions() === 1, `asked ${completions()}`);
        ok('woken: the job is done in the browser too', r3.state === 'done');
        ok('no errors from the extension on the page', errors.filter(e => !/Internal S/.test(e)).length === 0, errors.join(' || '));
    } catch (e) { fail++; log('THREW', String(e?.stack || e).slice(0, 600)); log(errors.join(' || ')); }
    finally {
        await browser.close(); st.kill('SIGTERM'); model.close(); await new Promise(r => setTimeout(r, 1500));
        fs.writeFileSync(settingsFile, backup);
        log(fail ? `FAILED ${fail}` : 'ALL OK'); process.exit(fail ? 1 : 0);
    }
})();
