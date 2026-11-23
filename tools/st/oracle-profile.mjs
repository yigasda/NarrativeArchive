// 연결 프로필 요청: 실리 1.19.1 브라우저 자신의 ConnectionManagerRequestService.sendRequest가 보내는 생성 요청과 돌려주는 값 → tests/fixtures/stprofile2-expected.json,
// 그리고 서버 쪽(plugin/st/naload.js naSendRequest, tests/stprofile2.run.mjs)이 만든 것과 그 자리에서 대 봐요.
// 실리는 임시 데이터 폴더(--dataRoot)로 띄워요: 진짜 data/는 안 건드려요. 경우마다 그 폴더의 default-user/settings.json을 쓰고 페이지를 새로 열어요
// (실리 브라우저가 자기 getSettings로 settings.json · 프리셋 파일을 읽어요. 서버는 같은 파일을 naLoad · naLoadPresets로).
// 생성 요청은 보내지 않아요: 페이지의 window.fetch(생성 길만)와 서버의 다리(__naSetFetch)가 잡고 같은 가짜 답을 줘요.
// 토크나이저 · 로짓 바이어스 길은 진짜 실리 서버로 가요(브라우저는 자기 동기 XHR · fetch, 서버는 페이지를 거쳐서). 서버 쪽이 받은 답은 기대값 파일에 같이 적어요:
// tests/stprofile2.test.mjs가 실리 없이 그 답으로 다시 돌려요.
// 쓰기: node tools/st/oracle-profile.mjs <실리 1.19.1 폴더>
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
const { CASES, NAME1, NAME2, GENERATE, writePresets, callKey } = await import(path.join(REPO, 'tests/stprofile2.cases.mjs'));
process.chdir(ST);
const RUN = await import(path.join(REPO, 'tests/stprofile2.run.mjs'));

const PORT = 8128, base = `http://127.0.0.1:${PORT}`, dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'na-oracle-profile-'));
const userRoot = path.join(dataRoot, 'default-user');
const st = spawn(process.execPath, ['server.js', '--port', String(PORT), '--listen', 'false', '--dataRoot', dataRoot], { cwd: ST });
let out = ''; st.stdout.on('data', d => (out += d)); st.stderr.on('data', d => (out += d));
let browser, fail = 0;
const expected = { cases: {}, calls: {} };
try {
    let up = false;
    for (let i = 0; i < 360 && !up; i++) { try { up = (await fetch(`${base}/csrf-token`)).ok; } catch { /* not up */ } if (!up) await new Promise(r => setTimeout(r, 500)); }
    if (!up) throw new Error('ST did not start:\n' + out.slice(-3000));
    // (SillyTavern copies its default content into a new user folder at start: the preset folders are replaced by the cases' files only)
    writePresets(userRoot);
    browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('  pageerror', String(e).slice(0, 300)));
    for (const c of CASES) {
        // (a fresh page for every case: SillyTavern keeps logit bias results and other state between requests)
        await page.goto('about:blank');
        await page.waitForTimeout(300);
        fs.writeFileSync(path.join(userRoot, 'settings.json'), JSON.stringify(RUN.settingsOf(c), null, 4));
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof window.SillyTavern?.getContext === 'function' && document.querySelector('#preloader') === null && !!window.SillyTavern.getContext().ConnectionManagerRequestService, null, { timeout: 180000 });
        const disabled = (RUN.settingsOf(c).extension_settings?.disabledExtensions || []).includes('connection-manager');
        if (!disabled) await page.waitForFunction(() => !!document.getElementById('connection_profiles'), null, { timeout: 60000 });
        await page.waitForTimeout(1500);
        const got = await page.evaluate(async ({ c, NAME1, NAME2, GENERATE }) => {
            const S = await import('/script.js'), P = await import('/scripts/popup.js');
            // (a proxy not confirmed yet: SillyTavern asks in a popup. Here nobody answers it — as the server, which cannot ask: cancelled)
            P.Popup.show.confirm = async () => P.POPUP_RESULT.CANCELLED;
            S.setUserName(NAME1, { toastPersonaNameChange: false });
            S.setCharacterName(NAME2);
            const gen = [], orig = window.fetch;
            window.fetch = async (url, init) => {
                const u = String(url);
                if (GENERATE.includes(u)) {
                    gen.push({ url: u, body: JSON.parse(init.body) });
                    return new Response(JSON.stringify(c.reply), { status: 200, headers: { 'Content-Type': 'application/json' } });
                }
                return orig(url, init);
            };
            const ctx = SillyTavern.getContext(), X = ctx.ConnectionManagerRequestService;
            let ret;
            try {
                if (c.kind === 'supported') {
                    const profiles = ctx.extensionSettings.connectionManager.profiles;
                    ret = { allowed: X.getAllowedTypes(), map: ctx.CONNECT_API_MAP, each: profiles.map(p => [p.id, X.isProfileSupported(p)]), supported: X.getSupportedProfiles().map(p => p.id) };
                } else if (c.kind === 'construct') {
                    ret = X.constructPrompt(structuredClone(c.prompt), c.profile);
                } else {
                    ret = await X.sendRequest(c.profile, structuredClone(c.prompt), c.maxTokens, structuredClone(c.custom), c.override === undefined ? undefined : structuredClone(c.override));
                }
                ret = JSON.parse(JSON.stringify(ret ?? null));
            } catch (err) {
                ret = { error: String(err?.message || err), cause: err?.cause ? String(err.cause?.message || err.cause) : null };
            } finally {
                window.fetch = orig;
            }
            return { gen, ret };
        }, { c, NAME1, NAME2, GENERATE });
        // (the server's way to SillyTavern's own handlers — the bridge — here through the page, with its session)
        const calls = [];
        const send = async (url, init) => {
            const r = await page.evaluate(async ({ url, method, body }) => { const x = await fetch(url, { method, headers: SillyTavern.getContext().getRequestHeaders(), body }); return { status: x.status, text: await x.text() }; }, { url, method: init?.method || 'POST', body: init?.body ?? null });
            calls.push({ key: callKey(url, init?.body), status: r.status, text: r.text });
            return new Response(r.text, { status: r.status, headers: { 'Content-Type': 'application/json' } });
        };
        const mine = await RUN.runCase(c, send);
        const same = JSON.stringify(mine) === JSON.stringify(got);
        if (!same) fail++;
        if (c.tok && !calls.length) { fail++; console.log('NOCALL', c.id, 'expected tokenizer/bias calls through the bridge'); }
        console.log(same ? 'OK  ' : 'DIFF', c.id, same ? `(${calls.length} calls)` : `\n  browser ${JSON.stringify(got)}\n  server  ${JSON.stringify(mine)}`);
        expected.cases[c.id] = got;
        if (calls.length) expected.calls[c.id] = calls;
    }
    if (!fail) fs.writeFileSync(path.join(REPO, 'tests/fixtures/stprofile2-expected.json'), JSON.stringify(expected, null, 1) + '\n');
} catch (e) { fail++; console.log('THREW', String(e?.stack || e).slice(0, 800)); }
finally {
    await browser?.close(); st.kill('SIGTERM'); await new Promise(r => setTimeout(r, 1000));
    fs.rmSync(dataRoot, { recursive: true, force: true });
    console.log(fail ? `FAILED ${fail} (of ${CASES.length})` : `ALL OK (${CASES.length} cases)`); process.exit(fail ? 1 : 0);
}
