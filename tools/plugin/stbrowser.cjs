// real SillyTavern 1.19.1 + real browser + the plugin: the browser leaves the kit (which chat this is: nothing else), the tab
// is hidden, the server's worker makes the character write first through SillyTavern's "custom" source — the request built on
// the server by SillyTavern's own createGenerationParameters (plugin/st) from settings.json —, that request is the same as the
// one SillyTavern sends from the browser for the same messages, and the browser takes the message in when the tab shows again
const http = require('node:http'), { spawn } = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const [,, ST] = process.argv;
const log = (...a) => console.log(...a);
(async () => {
    const asked = [];
    const model = http.createServer((req, res) => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { let body = null; try { body = JSON.parse(b); } catch { body = b; } asked.push({ url: req.url, headers: req.headers, body }); res.setHeader('content-type', 'application/json'); if (req.url.endsWith('/models')) { res.end(JSON.stringify({ data: [{ id: 'fake-model' }] })); return; } res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: ['written by the server while the tab was hidden'], status: '' }) }, finish_reason: 'stop' }] })); }); });
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
            // (a SillyTavern macro in a field SillyTavern fills when it builds the request: the server fills it the same way)
            O.oai_settings.custom_include_headers = 'x-na-user: "{{user}}"';
            (c.extensionSettings.narrative_archive ||= {}).draftConn = { mode: 'source', source: 'custom', stModel: 'fake-model' };
            c.saveSettingsDebounced();
            await KO.liveReady();
            const m = core.getMeta();
            S.startFresh(m, { persona: c.name1, now: Date.now() - 10 * 3600_000 });
            S.putLivePhone(m, { owner: 'Seraphina' });
            const room = S.ensureRoom(m, ['Seraphina']), w = S.liveWorld(m), at = Date.now() - 7 * 3600_000;
            S.sendLive(m, room.id, 'hey', at); room.messages.push({ id: 't2', n: 2, from: 'Seraphina', text: 'hi', at: at + 60_000 });
            w.presence = { schedules: {}, overrides: {}, meta: {}, user: {} }; room.meta = { ...(room.meta || {}), autonomousMessages: false };   // (먼저 말 걸기는 방마다: room.meta)
            await core.saveMeta();
            await KO.keepBeat();
            const made = await G.liveKitRefresh(m);
            await core.saveMeta();
            const again = await G.liveKitRefresh(m);
            window.__na = { core, S, G, KO, m, room };
            const kit = m.live.kit;
            return { again, ver: kit?.ver, file: kit?.chat?.file, coreVer: core.VERSION, state: KO.keepState(), ref: m.liveRef?.id || '', serves: KO.keepServes(), made, kitAvatar: kit?.chat?.avatar, keys: Object.keys(kit || {}).sort(), name1: c.name1, status: await G.liveServerStatus(m) };
        }, custom_url);
        log(JSON.stringify(r1));
        ok('browser: Orbit kept in the plugin, worker on', r1.state === 'ok' && !!r1.ref && r1.serves === true);
        ok('browser: kit left — which chat this is, nothing else (no request templates: the server builds each request)', r1.made === true && JSON.stringify(r1.keys) === '["chat","v","ver"]' && /Seraphina/.test(String(r1.kitAvatar)), JSON.stringify(r1.keys));
        ok('browser: nothing reached the provider while the kit was made', asked.length === 0, JSON.stringify(asked.map(a => a.url)));
        ok('browser: the kit does not change when nothing changed (no save every 30 s)', r1.again === false);
        ok('browser: the kit names the version and the chat file, and that file is there', r1.ver === r1.coreVer && !!r1.file && fs.existsSync(path.join(ST, 'data', 'default-user', 'chats', r1.file.dir, r1.file.id + '.jsonl')), JSON.stringify(r1.file));
        await page.waitForTimeout(2500);   // (settings.json: SillyTavern saves a moment later)
        const status = await page.evaluate(async () => window.__na.G.liveServerStatus(window.__na.m));
        ok('server says this room can be served while SillyTavern is closed', Object.values(status.rooms)[0]?.can === true, JSON.stringify(status));
        const sj = JSON.parse(fs.readFileSync(path.join(ST, 'data', 'default-user', 'settings.json'), 'utf8'));
        ok('settings.json has the draft connection and the custom url', sj.extension_settings?.narrative_archive?.draftConn?.source === 'custom' && sj.oai_settings?.custom_url === custom_url);
        // the tab is hidden; characters may write first from now
        await page.evaluate(async () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); const { core, S, m, room } = window.__na, r = S.liveWorld(m).messenger.rooms[room.id]; r.meta = { ...(r.meta || {}), autonomousMessages: true }; await core.saveMeta(); });
        log('waiting for the server (75 s without the browser, then its next look) …');
        let got = false;
        for (let i = 0; i < 200 && !got; i++) { await page.waitForTimeout(1000); got = asked.some(a => a.url.endsWith('/chat/completions')); }
        ok('the server asked the provider through SillyTavern while the tab was hidden', got, out.split('\n').filter(l => /narrative-archive|autonomous/i.test(l)).slice(-6).join(' | '));
        const a0 = asked.find(a => a.url.endsWith('/chat/completions')), b = a0?.body;
        if (b) {
            ok('the request: our messages, the reply\'s values', b.model === 'fake-model' && b.messages?.[0]?.role === 'system' && /^GOAL\nYou are Seraphina/.test(b.messages[0].content) && /\[WHY NOW\]/.test(b.messages[1].content) && (b.max_tokens ?? b.max_completion_tokens) === 4000 && b.temperature === 0.3, JSON.stringify({ model: b.model, max_tokens: b.max_tokens, temperature: b.temperature, keys: Object.keys(b).sort() }));
            ok('the macro in the header field filled on the server with this chat\'s persona', a0.headers['x-na-user'] === r1.name1, JSON.stringify([a0.headers['x-na-user'], r1.name1]));
            // the same messages, sent by the browser itself (ai.js callConn → SillyTavern's createGenerationParameters there): the same request
            const at = asked.length;
            await page.evaluate(async ([sys, user]) => { const AI = await import('/scripts/extensions/third-party/NarrativeArchive/src/ai.js'); await AI.callConn({ mode: 'source', source: 'custom', stModel: 'fake-model' }, sys, user, 4000, 'low', true, false, null, null, null, {}); }, [b.messages[0].content, b.messages[1].content]);
            const fromBrowser = asked[at];
            const diff = fromBrowser ? Object.keys({ ...b, ...fromBrowser.body }).filter(k => JSON.stringify(b[k]) !== JSON.stringify(fromBrowser.body[k])) : ['none'];
            ok('the same request as the browser sends for the same messages (body and the macro header)', diff.length === 0 && fromBrowser.headers['x-na-user'] === a0.headers['x-na-user'], JSON.stringify(diff));
            asked.splice(at);
        }
        await page.waitForTimeout(2500);
        const r2 = await page.evaluate(async () => {
            const { G, KO, m, room } = window.__na, before = room.messages.length;
            delete document.hidden;
            await KO.keepBeat();
            const queued = await G.liveAutonomous(m);
            const toast = [...document.querySelectorAll('#toast-container .toast-message')].map(x => x.textContent);
            return { toast, before, after: room.messages.map(x => [x.from, x.text, x.extra?.autonomous === true]), unread: G.liveAutonomousUnread(m), queued, budget: m.live.world.messenger.rooms[room.id].meta?.autonomousDailyBudget };
        });
        log(JSON.stringify(r2));
        ok('browser had not seen it while hidden', r2.before === 2);
        ok('browser took the server\'s message in when the tab showed again', r2.after.length === 3 && r2.after[2][0] === 'Seraphina' && r2.after[2][2] === true);
        ok('unread mark and today\'s count came too', r2.unread[0]?.count === 1 && Object.values(r2.budget?.counts || {})[0] === 1);
        ok('the browser does not write first again right away', r2.queued === 0);
        ok('the screen told me: a toast for the message the server wrote', r2.toast.some(x => /Seraphina님이 메시지를 보냈습니다/.test(x)), JSON.stringify(r2.toast));
        ok('no errors from the extension on the page', errors.filter(e => !/Internal S|^STACK\s*$/.test(e)).length === 0, errors.join(' || '));
        log('BAD RESPONSES', JSON.stringify(bad, null, 1));
    } catch (e) { fail++; log('THREW', String(e?.stack || e).slice(0, 600)); log(errors.join(' || ')); }
    finally { await browser.close(); st.kill('SIGTERM'); model.close(); await new Promise(r => setTimeout(r, 1500)); log(fail ? `FAILED ${fail}` : 'ALL OK'); process.exit(fail ? 1 : 0); }
})();
