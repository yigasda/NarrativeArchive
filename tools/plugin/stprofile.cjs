// real SillyTavern 1.19.1 + real browser + the plugin, with real connection profiles (docs/SERVER-HANDOVER.md 3-3 · 4장):
//   1) the browser leaves the kit — which chat this is, nothing else — and sends nothing doing it: the server builds each request
//      itself with SillyTavern's own code (plugin/st: ConnectionManagerRequestService.sendRequest) from settings.json and the
//      preset files, read for every job
//   2) the tab is hidden: the server's worker writes first through a chat-completion profile (SillyTavern's "openai" source on a
//      proxy preset: the proxy password comes from settings.json), then the proxy password is changed in SillyTavern (its settings
//      saved by the page) and the server answers late through the profile picked in SillyTavern now (the room follows the AI 기능
//      model, which is SillyTavern's) with the new password, and through a text-completion profile (generic, Alpaca instruct)
//   3) each request the provider got from the server is the same as the one SillyTavern itself sends from the browser for the
//      same messages
// Run: node tools/plugin/stprofile.cjs <SillyTavern folder>. It backs up and puts back settings.json and the Seraphina card,
// and removes the Orbit store it made. No real model is called: the provider is a fake server here.
const http = require('node:http'), { spawn } = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const [,, ST] = process.argv;
const log = (...a) => console.log(...a);
const user = path.join(ST, 'data', 'default-user'), sfile = path.join(user, 'settings.json'), card = path.join(user, 'characters', 'default_Seraphina.png'), orbit = path.join(user, 'NarrativeArchive', 'orbit');
const keep = { settings: fs.readFileSync(sfile), card: fs.readFileSync(card) };
const restore = () => { fs.writeFileSync(sfile, keep.settings); fs.writeFileSync(card, keep.card); fs.rmSync(orbit, { recursive: true, force: true }); };
(async () => {
    const asked = [];
    let n = 0;
    const model = http.createServer((req, res) => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => {
        let body = null; try { body = JSON.parse(b); } catch { body = b; }
        asked.push({ url: req.url, auth: req.headers.authorization || '', body });
        res.setHeader('content-type', 'application/json');
        const reply = JSON.stringify({ reply: [`answer ${++n}`], status: '' });
        if (req.url.endsWith('/models')) { res.end(JSON.stringify({ data: [{ id: 'gpt-4o-mini' }, { id: 'fake-tc' }] })); return; }
        // (a text-completion backend running on past its answer: SillyTavern cuts the instruct sequence off)
        if (req.url.endsWith('/completions') && !req.url.endsWith('/chat/completions')) { res.end(JSON.stringify({ choices: [{ text: `${reply}\n### Instruction:\nmore`, finish_reason: 'stop' }] })); return; }
        res.end(JSON.stringify({ choices: [{ message: { content: reply }, finish_reason: 'stop' }] }));
    }); });
    await new Promise(r => model.listen(0, '127.0.0.1', r));
    const fake = `http://127.0.0.1:${model.address().port}`;
    // SillyTavern's settings: two profiles, one picked; a proxy preset; our AI 기능 model on SillyTavern's side
    const s = JSON.parse(keep.settings.toString('utf8'));
    s.proxies = [...(s.proxies || []).filter(p => p.name !== 'NA proxy'), { name: 'NA proxy', url: `${fake}/v1`, password: 'NA-PROXY-PW' }];
    const CC = { id: 'na-cc', mode: 'cc', name: 'NA CC', api: 'openai', model: 'gpt-4o-mini', preset: 'Default', proxy: 'NA proxy', exclude: [] };
    const TC = { id: 'na-tc', mode: 'tc', name: 'NA TC', api: 'generic', model: 'fake-tc', 'api-url': fake, preset: 'Default', instruct: 'Alpaca', exclude: [] };
    s.extension_settings = { ...(s.extension_settings || {}), connectionManager: { profiles: [CC, TC], selectedProfile: 'na-cc' }, narrative_archive: { ...(s.extension_settings?.narrative_archive || {}), aiConn: { mode: 'st' }, draftConn: { mode: 'custom', url: `${fake}/v1`, key: 'k', model: 'draft' } } };
    fs.writeFileSync(sfile, JSON.stringify(s));
    fs.rmSync(orbit, { recursive: true, force: true });
    const PORT = 8125, base = `http://127.0.0.1:${PORT}`;
    const st = spawn(process.execPath, ['server.js', '--port', String(PORT)], { cwd: ST });
    let out = ''; st.stdout.on('data', d => (out += d)); st.stderr.on('data', d => (out += d));
    for (let i = 0; i < 120; i++) { try { const r = await fetch(`${base}/csrf-token`); if (r.ok) break; } catch { /* not up */ } await new Promise(r => setTimeout(r, 500)); }
    let fail = 0; const ok = (name, cond, more = '') => { log(cond ? 'OK  ' : 'FAIL', name, more); if (!cond) fail++; };
    const browser = await chromium.launch(), page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error' && /narrative|phone2|Orbit/i.test(m.text())) errors.push(m.text().slice(0, 300)); });
    const fromServer = () => asked.filter(a => !a.browser);
    // wait for the provider to get a request from the server (75 s without the browser, then the worker's next look)
    const waitServer = async (since, test) => { for (let i = 0; i < 240; i++) { const got = asked.slice(since).find(a => !a.browser && test(a)); if (got) return got; await page.waitForTimeout(1000); } return null; };
    // the same messages, sent by SillyTavern itself from the browser → what the provider got
    const browserSends = async (profileId, messages) => { const at = asked.length; await page.evaluate(async ([id, msgs]) => SillyTavern.getContext().ConnectionManagerRequestService.sendRequest(id, msgs, 4000, { stream: false, extractData: true, includePreset: true, includeInstruct: true }), [profileId, messages]); const got = asked[at]; if (got) got.browser = true; return got; };
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    try {
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof window.SillyTavern?.getContext === 'function' && window.SillyTavern.getContext().characters?.length > 0, null, { timeout: 90000 });
        await page.waitForTimeout(4000);
        await page.evaluate(async () => { await SillyTavern.getContext().executeSlashCommandsWithOptions('/go Seraphina'); });
        await page.waitForFunction(() => !!SillyTavern.getContext().chatId, null, { timeout: 30000 });
        await page.waitForTimeout(1500);
        const r1 = await page.evaluate(async () => {
            const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
            const core = await import(B + 'core.js'), S = await import(B + 'phone2store.js'), G = await import(B + 'phone2go.js'), KO = await import(B + 'phone2keepon.js');
            const c = SillyTavern.getContext();
            await KO.liveReady();
            const m = core.getMeta();
            S.startFresh(m, { persona: c.name1, now: Date.now() - 10 * 3600_000 });
            S.putLivePhone(m, { owner: 'Seraphina' });
            const room = S.ensureRoom(m, ['Seraphina']), w = S.liveWorld(m), at = Date.now() - 7 * 3600_000;
            S.sendLive(m, room.id, 'hey', at); room.messages.push({ id: 't2', n: 2, from: 'Seraphina', text: 'hi', at: at + 60_000 });
            w.presence = { schedules: {}, overrides: {}, meta: {}, user: {} }; room.meta = { ...(room.meta || {}), autonomousMessages: false };   // (먼저 말 걸기는 방마다: room.meta)
            room.connectionId = 'profile:na-cc';
            await core.saveMeta();
            await KO.keepBeat();
            const made = await G.liveKitRefresh(m); await core.saveMeta();
            window.__na = { core, S, G, KO, m, room };
            const kit = m.live.kit;
            return { made, serves: KO.keepServes(), keys: Object.keys(kit).sort(), hasPw: JSON.stringify(kit).includes('NA-PROXY-PW'), plan: G.liveReplyPlan(m, room.id).profile };
        });
        log(JSON.stringify(r1));
        ok('browser: the worker is on, the kit is left — which chat this is, no request templates', r1.serves === true && r1.made === true && JSON.stringify(r1.keys) === '["chat","v","ver"]', JSON.stringify(r1.keys));
        ok('browser: no request reached the provider while the kit was made', asked.length === 0, JSON.stringify(asked.map(a => a.url)));
        ok('browser: the kit holds no proxy password', r1.hasPw === false);
        ok('browser: the room goes through the profile picked for it', r1.plan?.id === 'na-cc' && r1.plan.missing === false, JSON.stringify(r1.plan));
        await page.waitForTimeout(2500);
        const status = await page.evaluate(async () => window.__na.G.liveServerStatus(window.__na.m));
        ok('server: the profile room can be served while SillyTavern is closed', Object.values(status.rooms)[0]?.can === true, JSON.stringify(status));

        // ── 1) the chat-completion profile: the character writes first
        await page.evaluate(async () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); const { core, S, m, room } = window.__na, r = S.liveWorld(m).messenger.rooms[room.id]; r.meta = { ...(r.meta || {}), autonomousMessages: true }; await core.saveMeta(); });
        log('waiting for the server (chat-completion profile) …');
        const a1 = await waitServer(0, a => a.url.endsWith('/chat/completions') && /\[WHY NOW\]/.test(JSON.stringify(a.body)));
        ok('server: wrote first through the profile, on its proxy', !!a1 && a1.url === '/v1/chat/completions' && a1.body.model === 'gpt-4o-mini', a1 ? JSON.stringify({ url: a1.url, model: a1.body.model, keys: Object.keys(a1.body).sort() }) : out.split('\n').filter(l => /narrative-archive|autonomous/i.test(l)).slice(-6).join(' | '));
        if (a1) {
            ok('server: the proxy password came from SillyTavern\'s settings', a1.auth === 'Bearer NA-PROXY-PW', a1.auth);
            const b1 = await browserSends('na-cc', a1.body.messages);
            ok('the same request as SillyTavern sends from the browser', !!b1 && same(a1.body, b1.body) && a1.auth === b1.auth, b1 ? JSON.stringify(Object.keys(a1.body).filter(k => !same(a1.body[k], b1.body[k]))) : 'none');
        }

        // ── 2) the proxy password changed in SillyTavern (the page saves its settings), and a late reply in a room that follows the
        //       AI 기능 model (SillyTavern's side): the profile picked in SillyTavern now, with the new password — no browser part
        const r2 = await page.evaluate(async () => {
            const { core, S, G, KO, m, room } = window.__na;
            const O = await import('/scripts/openai.js'), main = await import('/script.js');
            O.proxies.find(p => p.name === 'NA proxy').password = 'NA-PROXY-PW2';
            await main.saveSettings();
            await KO.keepSync();
            room.connectionId = 'ai';
            const job = S.enqueueJob(m, { kind: 'reply', owner: 'Seraphina', room: room.id, at: Date.now() - 600_000 }); Object.assign(job, { timed: true, notBefore: Date.now() + 1000 });
            await G.liveKitRefresh(m); await core.saveMeta();
            return { plan: G.liveReplyPlan(m, room.id).profile };
        });
        ok('browser: the room goes through the profile picked in SillyTavern now', r2.plan?.id === 'na-cc', JSON.stringify(r2.plan));
        const since2 = asked.length;
        log('waiting for the server (the profile picked now) …');
        const a2 = await waitServer(since2, a => a.url.endsWith('/chat/completions'));
        ok('server: the late reply went through the picked profile, with the password changed in SillyTavern', !!a2 && a2.body.model === 'gpt-4o-mini' && a2.auth === 'Bearer NA-PROXY-PW2', a2 ? a2.auth : '');
        if (a2) { const b2 = await browserSends('na-cc', a2.body.messages); ok('the same request as SillyTavern sends from the browser (picked profile)', !!b2 && same(a2.body, b2.body) && a2.auth === b2.auth); }

        // ── 3) a late reply through the text-completion profile
        const r3 = await page.evaluate(async () => {
            const { core, S, G, KO, m, room } = window.__na;
            await KO.keepSync();
            room.connectionId = 'profile:na-tc';
            const job = S.enqueueJob(m, { kind: 'reply', owner: 'Seraphina', room: room.id, at: Date.now() - 600_000 }); Object.assign(job, { timed: true, notBefore: Date.now() + 1000 });
            await G.liveKitRefresh(m); await core.saveMeta();
            // (how SillyTavern's own code wraps a system part and a text for this profile: only to read the server's prompt back)
            const prompt = SillyTavern.getContext().ConnectionManagerRequestService.constructPrompt([{ role: 'system', content: '\u0001NA_SYSTEM\u0001' }, { role: 'user', content: '\u0001NA_USER\u0001' }], 'na-tc');
            return { plan: G.liveReplyPlan(m, room.id).profile, tc: { prompt } };
        });
        ok('browser: SillyTavern wraps the text-completion profile\'s request in its instruct format', r3.plan?.id === 'na-tc' && r3.tc.prompt.includes('\u0001NA_USER\u0001') && /### Instruction/.test(r3.tc.prompt), JSON.stringify(r3));
        const since3 = asked.length;
        log('waiting for the server (text-completion profile) …');
        const a3 = await waitServer(since3, a => /\/completions$/.test(a.url) && !a.url.endsWith('/chat/completions'));
        ok('server: the late reply went through the text-completion profile', !!a3 && a3.body.model === 'fake-tc', a3 ? JSON.stringify({ url: a3.url, keys: Object.keys(a3.body).sort() }) : '');
        if (a3 && r3.tc) {
            // (the system part and the texts the server put in, read back from the prompt through SillyTavern's format)
            const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), re = new RegExp(`^${r3.tc.prompt.split(/(\u0001NA_SYSTEM\u0001|\u0001NA_USER\u0001)/).map(p => (p === '\u0001NA_SYSTEM\u0001' || p === '\u0001NA_USER\u0001' ? '([\\s\\S]*)' : esc(p))).join('')}$`);
            const m3 = re.exec(a3.body.prompt), hasSys = r3.tc.prompt.includes('\u0001NA_SYSTEM\u0001');
            ok('server: the prompt is in SillyTavern\'s instruct format with our texts in it', !!m3);
            if (m3) { const msgs = [...(hasSys ? [{ role: 'system', content: m3[1] }] : []), { role: 'user', content: m3[hasSys ? 2 : 1] }]; const b3 = await browserSends('na-tc', msgs); ok('the same request as SillyTavern sends from the browser (text completion)', !!b3 && same(a3.body, b3.body), b3 ? JSON.stringify(Object.keys(a3.body).filter(k => !same(a3.body[k], b3.body[k]))) : 'none'); }
        }
        // the browser takes the three in
        const r4 = await page.evaluate(async () => { const { KO, room } = window.__na; delete document.hidden; await KO.keepBeat(); return room.messages.map(x => [x.from, x.text]); });
        log(JSON.stringify(r4));
        ok('browser: the server\'s three messages came in', r4.filter(x => x[0] === 'Seraphina' && /^answer \d+$/.test(x[1])).length === 3, JSON.stringify(r4.slice(2)));
        ok('no errors from the extension on the page', errors.filter(e => !/Internal S/.test(e)).length === 0, errors.join(' || '));
    } catch (e) { fail++; log('THREW', String(e?.stack || e).slice(0, 600)); log(errors.join(' || ')); }
    finally {
        await browser.close(); st.kill('SIGTERM'); model.close(); await new Promise(r => setTimeout(r, 1500));
        restore();
        log(fail ? `FAILED ${fail}` : 'ALL OK'); process.exit(fail ? 1 : 0);
    }
})();
