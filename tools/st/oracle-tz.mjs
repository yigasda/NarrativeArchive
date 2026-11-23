// 시각 매크로 · 로컬 시각 · 기본 언어: 실리 1.19.1 브라우저 자신의 substituteParams가 만든 것 → tests/fixtures/stmacros-tz-expected.json,
// 그리고 서버 쪽(tests/sttz.run.mjs: 작업 스레드 + plugin/zone.mjs, 브라우저가 적을 device로)이 만든 것과 그 자리에서 대 봐요.
// 브라우저는 Chrome(Playwright)에 시간대 · 언어 · 시계를 고정해요. 실리는 임시 데이터 폴더(--dataRoot)로, 서버 시간대는 UTC로 띄워요.
// 쓰기: node tools/st/oracle-tz.mjs <실리 1.19.1 폴더>   (playwright가 없으면 NODE_PATH로)
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
const CASES = path.join(REPO, 'tests/sttz.cases.mjs');
const { CONFIGS } = await import(CASES);
const { runServer } = await import(path.join(REPO, 'tests/sttz.run.mjs'));
const casesSrc = fs.readFileSync(CASES, 'utf8');

const PORT = 8135, base = `http://127.0.0.1:${PORT}`, dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'na-oracle-tz-'));
// (a new data folder gets SillyTavern's default settings.json with firstRun: true: the page then waits in the onboarding popup)
fs.mkdirSync(path.join(dataRoot, 'default-user'), { recursive: true });
fs.writeFileSync(path.join(dataRoot, 'default-user', 'settings.json'), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(ST, 'default/content/settings.json'), 'utf8')), firstRun: false }, null, 4));
const st = spawn(process.execPath, ['server.js', '--port', String(PORT), '--listen', 'false', '--dataRoot', dataRoot], { cwd: ST, env: { ...process.env, TZ: 'UTC' } });
let out = ''; st.stdout.on('data', d => (out += d)); st.stderr.on('data', d => (out += d));
let browser, fail = 0;
const expected = { configs: [] };
try {
    let up = false;
    for (let i = 0; i < 360 && !up; i++) { try { up = (await fetch(`${base}/csrf-token`)).ok; } catch { /* not up */ } if (!up) await new Promise(r => setTimeout(r, 500)); }
    if (!up) throw new Error('ST did not start:\n' + out.slice(-3000));
    try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' }); }
    for (const cfg of CONFIGS) {
        const context = await browser.newContext({ locale: cfg.locale, timezoneId: cfg.timezoneId });
        if (cfg.language) await context.addInitScript(l => { try { localStorage.setItem('language', l); } catch { /* */ } }, cfg.language);
        const page = await context.newPage();
        await page.clock.setFixedTime(cfg.at);
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof window.SillyTavern?.getContext === 'function' && document.querySelector('#preloader') === null, null, { timeout: 180000 });
        await page.waitForTimeout(1500);
        const got = await page.evaluate(async src => {
            const C = await import(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
            const S = await import('/script.js'), PU = await import('/scripts/power-user.js'), L = await import('/lib.js'), I = await import('/scripts/i18n.js');
            const c = SillyTavern.getContext(), o = Intl.DateTimeFormat().resolvedOptions();
            // (what src/phone2keepon.js keepDevice writes on this page)
            const device = { timeZone: String(o.timeZone || ''), locale: String(c.getCurrentLocale?.() || ''), intl: String(o.locale || '') };
            const macros = C.macrosOf({ S, PU, setChat: chat => S.chat.splice(0, S.chat.length, ...chat), currentLocale: I.getCurrentLocale(), globalLocale: L.moment.locale() });
            return { device, env: C.envOf(), macros };
        }, casesSrc);
        await context.close();
        const mine = await runServer(got.device, cfg.at);
        const diffs = [];
        for (const part of ['env', 'macros']) for (const k of new Set([...Object.keys(got[part]), ...Object.keys(mine[part])])) if (JSON.stringify(got[part][k]) !== JSON.stringify(mine[part][k])) diffs.push(`${part}.${k}\n    browser ${JSON.stringify(got[part][k])}\n    server  ${JSON.stringify(mine[part][k])}`);
        // (today's server without the browser's values: the server computer's zone — UTC here)
        const before = await runServer(null, cfg.at);
        const off = Object.keys(got.macros).filter(k => JSON.stringify(got.macros[k]) !== JSON.stringify(before.macros[k])).sort((a, b) => (a === 'currentLocale') - (b === 'currentLocale'));
        fail += diffs.length;
        console.log(`${diffs.length ? 'DIFF' : 'OK  '} ${cfg.id}: ${Object.keys(got.macros).length} macros + ${Object.keys(got.env).length} env, device ${JSON.stringify(got.device)} | without device ${off.length} differ${off[0] ? `, e.g. ${off[0]}: ${JSON.stringify(before.macros[off[0]])} vs ${JSON.stringify(got.macros[off[0]])}` : ''}`);
        for (const d of diffs) console.log('  ' + d);
        expected.configs.push({ ...cfg, ...got });
    }
    fs.writeFileSync(path.join(REPO, 'tests/fixtures/stmacros-tz-expected.json'), JSON.stringify(expected, null, 1) + '\n');
} catch (e) { fail++; console.log('THREW', String(e?.stack || e).slice(0, 1500)); }
finally {
    await browser?.close(); st.kill('SIGTERM'); await new Promise(r => setTimeout(r, 1000));
    fs.rmSync(dataRoot, { recursive: true, force: true });
    console.log(fail ? `FAILED ${fail}` : 'ALL OK'); process.exit(fail ? 1 : 0);
}
