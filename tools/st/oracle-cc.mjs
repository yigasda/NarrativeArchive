// 채팅 완성 요청 몸통: 실리 1.19.1 브라우저 자신의 createGenerationParameters가 만든 것 → tests/fixtures/stopenai-expected.json,
// 그리고 서버 쪽(plugin/st, tests/stopenai.run.mjs)이 만든 것과 그 자리에서 대 봐요(로짓 바이어스는 실리 서버의 토크나이저가 있어야 해서 여기서만).
// 실리는 임시 데이터 폴더(--dataRoot)로 띄워요: 진짜 data/는 안 건드려요.
// 쓰기: node tools/st/oracle-cc.mjs <실리 1.19.1 폴더>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ST = path.resolve(process.argv[2] || '');
const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.join(here, '..', '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { CASES, NAME1, NAME2 } = await import(path.join(REPO, 'tests/stopenai.cases.mjs'));
// (the plugin runs with SillyTavern's folder as its working folder: the bias handler reads SillyTavern's own tokenizers from there)
process.chdir(ST);
const RUN = await import(path.join(REPO, 'tests/stopenai.run.mjs'));

const PORT = 8127, base = `http://127.0.0.1:${PORT}`, dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'na-oracle-'));
const st = spawn(process.execPath, ['server.js', '--port', String(PORT), '--listen', 'false', '--dataRoot', dataRoot], { cwd: ST });
let out = ''; st.stdout.on('data', d => (out += d)); st.stderr.on('data', d => (out += d));
let browser, fail = 0;
const expected = {};
try {
    let up = false;
    for (let i = 0; i < 360 && !up; i++) { try { up = (await fetch(`${base}/csrf-token`)).ok; } catch { /* not up */ } if (!up) await new Promise(r => setTimeout(r, 500)); }
    if (!up) throw new Error('ST did not start:\n' + out.slice(-3000));
    browser = await chromium.launch();
    const page = await browser.newPage();
    const open = async () => {
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof window.SillyTavern?.getContext === 'function' && document.querySelector('#preloader') === null, null, { timeout: 180000 });
        await page.waitForTimeout(1500);
    };
    await open();
    for (const c of CASES) {
        // (SillyTavern keeps the bias it worked out until the preset changes: a fresh page for each bias case)
        if (c.bias) await open();
        const { oai, pu } = RUN.loadCase(c);
        const acc = RUN.hashed(c).settings.accountStorage || {};
        const got = await page.evaluate(async ({ c, oai, pu, acc, NAME1, NAME2 }) => {
            const S = await import('/script.js'), O = await import('/scripts/openai.js'), PU = await import('/scripts/power-user.js'), A = await import('/scripts/util/AccountStorage.js'), P = await import('/scripts/popup.js');
            // (a proxy not confirmed yet: SillyTavern asks in a popup. Here nobody answers it — as the server, which cannot ask: cancelled)
            P.Popup.show.confirm = async () => P.POPUP_RESULT.CANCELLED;
            for (const k of Object.keys(O.oai_settings)) delete O.oai_settings[k];
            Object.assign(O.oai_settings, structuredClone(oai));
            for (const k of Object.keys(PU.power_user)) delete PU.power_user[k];
            Object.assign(PU.power_user, structuredClone(pu));
            for (const [k, v] of Object.entries(acc)) A.accountStorage.setItem(k, v);
            S.setUserName(NAME1, { toastPersonaNameChange: false });
            S.setCharacterName(NAME2);
            try { return JSON.parse(JSON.stringify(await O.createGenerationParameters(structuredClone(O.oai_settings), c.model, c.type, structuredClone(c.messages)))); }
            catch (err) { return { error: String(err?.message || err) }; }
        }, { c, oai, pu, acc, NAME1, NAME2 });
        // (the server's way to SillyTavern's own handlers — the bridge — here through the page, with its session)
        const send = async (url, init) => { const r = await page.evaluate(async ({ url, body }) => { const x = await fetch(url, { method: 'POST', headers: SillyTavern.getContext().getRequestHeaders(), body }); return { status: x.status, text: await x.text() }; }, { url, body: init?.body ?? null }); return new Response(r.text, { status: r.status, headers: { 'Content-Type': 'application/json' } }); };
        const mine = await RUN.runCase(c, send);
        // (an error thrown by the JavaScript engine itself — new URL('not a url') — is worded by Chrome in the browser and by Node on the server)
        const same = JSON.stringify(mine) === JSON.stringify(got) || (!!mine.error && !!got.error && c.id === 'proxy-bad-url');
        if (!same) fail++;
        console.log(same ? 'OK  ' : 'DIFF', c.id, same ? '' : `\n  browser ${JSON.stringify(got)}\n  server  ${JSON.stringify(mine)}`);
        if (!c.bias) expected[c.id] = got;
    }
    fs.writeFileSync(path.join(REPO, 'tests/fixtures/stopenai-expected.json'), JSON.stringify(expected, null, 1) + '\n');
} catch (e) { fail++; console.log('THREW', String(e?.stack || e).slice(0, 800)); }
finally {
    await browser?.close(); st.kill('SIGTERM'); await new Promise(r => setTimeout(r, 1000));
    fs.rmSync(dataRoot, { recursive: true, force: true });
    console.log(fail ? `FAILED ${fail}` : 'ALL OK'); process.exit(fail ? 1 : 0);
}
