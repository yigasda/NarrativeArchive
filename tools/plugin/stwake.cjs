// real SillyTavern 1.19.1 + real browser + the plugin: what happened on 2026-11-22, in that order.
// I sent a message and the character was busy (a reply for later). The tab is hidden; the server's worker sends that reply
// when its time comes (as Marinara's server does: it waits out the delay itself, watched or not). Then the tab shows again
// and the browser's 30-second tick runs before anything else: it must not answer the same message a second time, and the
// server's reply must show at once. Then the same with the tab shown all along: one reply, there soon after its time.
// Then: the room lock over SillyTavern's real router (/api/plugins/narrative-archive/auto/claim · release).
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
    const custom_url = `http://127.0.0.1:${model.address().port}/v1`, PORT = 8125, base = `http://127.0.0.1:${PORT}`;
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
        await page.waitForTimeout(2500);   // (settings.json: SillyTavern saves a moment later)
        // the room lock over SillyTavern's own router: taken, refused to the server, let go
        const lk = await page.evaluate(async () => {
            const { m, room } = window.__na, h = SillyTavern.getContext().getRequestHeaders(), P = '/api/plugins/narrative-archive';
            const post = async (p, b) => (await fetch(P + p, { method: 'POST', headers: h, body: JSON.stringify(b) })).json();
            const a = await post('/auto/claim', { id: m.liveRef.id, room: room.id, by: 'browser:check' });
            const again = await post('/auto/claim', { id: m.liveRef.id, room: room.id, by: 'browser:other' });
            const renew = await post('/auto/claim', { id: m.liveRef.id, room: room.id, by: 'browser:check', renew: true });
            const asServer = await post('/auto/claim', { id: m.liveRef.id, room: room.id, by: 'server' });
            const rel = await post('/auto/release', { id: m.liveRef.id, room: room.id, by: 'browser:check' });
            const after = await post('/auto/claim', { id: m.liveRef.id, room: room.id, by: 'browser:other' });
            await post('/auto/release', { id: m.liveRef.id, room: room.id, by: 'browser:other' });
            // (claiming as 'server' gives the name browser:server: the same holder as browser:server, never the worker)
            const named = await post('/auto/claim', { id: m.liveRef.id, room: room.id, by: 'server' });
            const same = await post('/auto/claim', { id: m.liveRef.id, room: room.id, by: 'browser:server' });
            const blocked = await post('/auto/claim', { id: m.liveRef.id, room: room.id, by: 'browser:x' });
            await post('/auto/release', { id: m.liveRef.id, room: room.id, by: 'server' }); await post('/auto/release', { id: m.liveRef.id, room: room.id, by: 'browser:server' });
            return { a, again, renew, asServer, rel, after, named, same, blocked };
        });
        ok('room lock through SillyTavern: taken, refused to another tab, renewed, let go', lk.a.ok === true && lk.again.ok === false && /^browser:check$/.test(lk.again.by) && lk.renew.ok === true && lk.rel.ok === true && lk.after.ok === true, JSON.stringify(lk));
        ok('room lock: a tab cannot claim as the server (the name is always browser:…)', lk.named.ok === true && lk.same.ok === true && lk.blocked.ok === false && lk.blocked.by === 'browser:server', JSON.stringify([lk.named, lk.same, lk.blocked]));
        // the custom notification sound through SillyTavern's own upload (its multer takes the 'avatar' field for every route)
        const snd = await page.evaluate(async () => {
            const SOUND = await import('/scripts/extensions/third-party/NarrativeArchive/src/phone2sound.js');
            const before = await SOUND.soundStatus();
            const wav = new Uint8Array([...new TextEncoder().encode('RIFF'), 0, 0, 0, 0, ...new TextEncoder().encode('WAVE'), ...new Array(40).fill(7)]);
            const up = await SOUND.soundUpload(new File([wav], 'ding.wav', { type: 'audio/wav' }));
            const r = await fetch(up.url);
            const bytes = new Uint8Array(await r.arrayBuffer());
            let bad = '';
            try { await SOUND.soundUpload(new File([wav], 'ding.mp3')); } catch (e) { bad = String(e.message); }
            const after = await SOUND.soundStatus();
            const gone = await SOUND.soundRemove();
            const last = await SOUND.soundStatus();
            return { before, up, type: r.headers.get('content-type'), same: bytes.length === wav.length && bytes.every((b, i) => b === wav[i]), bad, after, gone, last };
        });
        ok('sound: uploaded through SillyTavern, served back the same bytes as audio/wav', snd.before.configured === false && snd.up.configured === true && snd.type === 'audio/wav' && snd.same && snd.after.url === snd.up.url, JSON.stringify(snd));
        ok('sound: a wrong file is refused with its reason, then removed back to the default', /업로드한 파일은 지원되는 오디오 형식이 아닙니다/.test(snd.bad) && snd.gone.configured === false && snd.last.configured === false, snd.bad);
        const leftUploads = fs.readdirSync(path.join(ST, 'data', '_uploads')).length;
        ok('sound: SillyTavern\'s temp upload files are gone', leftUploads === 0, String(leftUploads));
        // I send a message; the character is busy: a reply for later (in 5 s). Then the tab is hidden
        const r2 = await page.evaluate(async () => {
            const { core, S, m, room } = window.__na;
            S.sendLive(m, room.id, 'so tired');
            const job = S.enqueueJob(m, { kind: 'reply', owner: 'Seraphina', room: room.id });
            Object.assign(job, { timed: true, notBefore: Date.now() + 5000 });
            await core.saveMeta();
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
            window.__na.job = job;
            return { jobs: S.liveWorld(m).queue.jobs.filter(j => j.state === 'waiting').length };
        });
        ok('a reply for later is queued and saved', r2.jobs === 1);
        log('waiting for the server (the reply is due in 5 s) …');
        const t0 = Date.now();
        let got = false;
        for (let i = 0; i < 60 && !got; i++) { await page.waitForTimeout(500); got = completions() >= 1; }
        ok('the server sent the reply while the tab was hidden, at its time (not 75 s later)', got && Date.now() - t0 < 15000, `${Date.now() - t0} ms · ` + out.split('\n').filter(l => /narrative-archive|due-replies/i.test(l)).slice(-6).join(' | '));
        await page.waitForTimeout(3000);
        const before = await page.evaluate(() => ({ n: window.__na.room.messages.length, state: window.__na.job.state }));
        ok('the browser has not seen it yet (an old copy: the reply still waits there)', before.n === 3 && before.state === 'waiting', JSON.stringify(before));
        // the tab shows: the 30-second tick runs first — the order of that day
        const r3 = await page.evaluate(async () => {
            const { TICK, G, S, m, room, job } = window.__na;
            delete document.hidden;
            await TICK.tickOnce();
            const shown = room.messages.map(x => [x.from, x.text]);
            await G.liveGo(m);
            await TICK.tickOnce();
            return { shown, state: S.liveWorld(m).queue.jobs.find(j => j.id === job.id)?.state, after: room.messages.map(x => [x.from, x.text]), replies: window.__naReplies };
        });
        log(JSON.stringify(r3));
        ok('woken: the server\'s reply is there at once', r3.shown.length === 4 && r3.shown[3][0] === 'Seraphina' && r3.shown[3][1] === 'answer 1');
        ok('woken: the same message is not answered twice', completions() === 1 && r3.after.length === 4, `asked ${completions()}`);
        ok('woken: the job is done in the browser too', r3.state === 'done');
        ok('woken: the screen heard that the server\'s reply finished (na-live-reply from the server)', JSON.stringify(r3.replies) === JSON.stringify([{ from: 'server', room: r3.replies[0]?.room, by: ['Seraphina'], auto: false, regen: false }]) && !!r3.replies[0]?.room, JSON.stringify(r3.replies));
        // the tab shown all along: a reply for later (in 5 s). The server sends it at its time though the browser is watching
        // (Marinara's server waits out the delay in the request), or the browser's own timer does: one of them, once
        const r4 = await page.evaluate(async () => {
            const { core, S, TICK, m, room } = window.__na;
            S.sendLive(m, room.id, 'still there?');
            const job = S.enqueueJob(m, { kind: 'reply', owner: 'Seraphina', room: room.id });
            Object.assign(job, { timed: true, notBefore: Date.now() + 5000 });
            await core.saveMeta();
            TICK.tickAt(job.notBefore);
            window.__na.job2 = job;
            return { at: job.notBefore };
        });
        let seen = null;
        for (let i = 0; i < 60 && !seen; i++) { await page.waitForTimeout(500); seen = await page.evaluate(() => { const r = window.__na.room.messages.at(-1); return r.from === 'Seraphina' ? Date.now() : null; }); }
        ok('shown: the reply came soon after its time', !!seen && seen - r4.at < 15000, seen ? `${seen - r4.at} ms after its time` : 'not seen');
        ok('shown: once', completions() === 2, `asked ${completions()}`);
        ok('no errors from the extension on the page', errors.filter(e => !/Internal S/.test(e)).length === 0, errors.join(' || '));
    } catch (e) { fail++; log('THREW', String(e?.stack || e).slice(0, 600)); log(errors.join(' || ')); }
    finally {
        await browser.close(); st.kill('SIGTERM'); model.close(); await new Promise(r => setTimeout(r, 1500));
        fs.writeFileSync(settingsFile, backup);
        log(fail ? `FAILED ${fail}` : 'ALL OK'); process.exit(fail ? 1 : 0);
    }
})();
