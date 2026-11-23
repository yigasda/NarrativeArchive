// 연결 확인: 실리 1.19.1 브라우저가 자기 연결 버튼(getStatusOpen · getStatusTextgen · getStatusKobold)으로 연결한 뒤 들고 있는 것
// (online_status · model_list · 고른 모델 · 글 완성 모델 목록 · API 토크나이저 표시 · Kobold 기능 · {{model}})과 그 뒤에 만드는 요청 →
// tests/fixtures/ststatus-expected.json, 그리고 서버 쪽(plugin/st/nastatus.js, tests/ststatus.run.mjs)이 같은 가짜 공급자 · 같은 실리 서버 길로 만든 것과 대 봐요.
// 실리는 임시 데이터 폴더(--dataRoot)로 띄워요: 진짜 data/는 안 건드려요. 공급자는 여기서 띄우는 가짜(127.0.0.1:8131)예요:
//   - 주소를 정할 수 있는 것(프록시 · 사용자 지정 주소 · Azure · 글 완성 · Kobold)은 그 주소로
//   - 실리 서버가 주소를 박아 둔 것(OpenRouter · ElectronHub · DreamGen)은 실리 서버의 node-fetch 앞에 끼운 것이 가짜로 돌려요(--import, 실리 코드는 그대로)
// 실리 서버의 secrets.json에는 가짜 글만 넣어요(연결 버튼은 키가 없으면 연결하지 않아요). 생성 요청은 보내지 않아요: 잡아요.
// 서버 쪽이 실리 서버에서 받은 답(상태 · 토크나이저 · 로짓 바이어스)은 기대값 파일에 같이 적어요: tests/ststatus.test.mjs가 실리 없이 그 답으로 다시 돌려요.
// 쓰기: node tools/st/oracle-status.mjs <실리 1.19.1 폴더>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ST = path.resolve(process.argv[2] || '');
const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.join(here, '..', '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const C = await import(path.join(REPO, 'tests/ststatus.cases.mjs'));
const { writePresets } = await import(path.join(REPO, 'tests/stprofile2.cases.mjs'));
process.chdir(ST);
const RUN = await import(path.join(REPO, 'tests/ststatus.run.mjs'));

const PORT = 8129, base = `http://127.0.0.1:${PORT}`, dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'na-oracle-status-'));
const userRoot = path.join(dataRoot, 'default-user');
fs.mkdirSync(userRoot, { recursive: true });
// (the key state comes from the server plugin's own bridge — plugin/bridge.mjs, on SillyTavern's handlers in this process, the same user folder —,
//  as the worker gets it: ids only, no masked key text in the fixture)
(await import(pathToFileURL(path.join(ST, 'src/util.js')).href)).setConfigFilePath(path.join(ST, 'config.yaml'));
const bridge = await (await import(pathToFileURL(path.join(REPO, 'plugin/bridge.mjs')).href)).startBridge({ stRoot: ST, userOf: r => (r === userRoot ? { profile: { handle: 'default-user' }, directories: { root: userRoot } } : null) });
fs.writeFileSync(path.join(userRoot, 'settings.json'), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(ST, 'default/content/settings.json'), 'utf8')), firstRun: false }, null, 4));

// ---- the fake provider ----
let routes = {};
const hits = [];
const fake = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const u = new URL(req.url, C.FAKE);
    hits.push(`${req.method} ${u.pathname}`);
    const r = routes[u.pathname];
    if (!r) { res.statusCode = 404; res.setHeader('content-type', 'application/json'); res.end('{"error":"not found"}'); return; }
    // (an answer made from the request: the custom header SillyTavern sent, as the model name — tests/ststatus.cases.mjs x-custom-header-macro)
    if (r === 'echo-who') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ data: [{ id: `who-${req.headers['x-who'] || 'none'}` }] })); return; }
    if (typeof r === 'string') {
        let j = {};
        try { j = JSON.parse(body || '{}'); } catch { /* none */ }
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(C.ENCODE[r](String(j.text ?? j.prompt ?? j.content ?? ''))));
        return;
    }
    res.statusCode = r.status ?? 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(r.body));
});
await new Promise((ok, no) => { fake.once('error', no); fake.listen(C.FAKE_PORT, '127.0.0.1', ok); });

// ---- SillyTavern's server, its node-fetch sending the hosts it fixes itself to the fake (SillyTavern's code is not touched) ----
const hookDir = fs.mkdtempSync(path.join(os.tmpdir(), 'na-oracle-status-hook-'));
const realFetch = pathToFileURL(path.join(ST, 'node_modules/node-fetch/src/index.js')).href;
if (!fs.existsSync(fileURLToPath(realFetch))) throw new Error('node-fetch not found in the SillyTavern folder');
const shimUrl = pathToFileURL(path.join(hookDir, 'shim.mjs')).href;
fs.writeFileSync(path.join(hookDir, 'shim.mjs'), `import realFetch from ${JSON.stringify(realFetch)};
export * from ${JSON.stringify(realFetch)};
const HOSTS = ${JSON.stringify(C.FAKE_HOSTS)}, FAKE = ${JSON.stringify(C.FAKE)};
export default function fetch(input, init) {
    try {
        const s = typeof input === 'string' ? input : input instanceof URL ? input.href : null;
        if (s) { const u = new URL(s); if (HOSTS.includes(u.host)) input = FAKE + '/h/' + u.host + u.pathname + u.search; }
    } catch { /* not a URL */ }
    return realFetch(input, init);
}
`);
fs.writeFileSync(path.join(hookDir, 'hooks.mjs'), `const SHIM = ${JSON.stringify(shimUrl)};
export async function resolve(specifier, context, next) {
    if (specifier === 'node-fetch' && context.parentURL !== SHIM) return { url: SHIM, shortCircuit: true };
    return next(specifier, context);
}
`);
fs.writeFileSync(path.join(hookDir, 'register.mjs'), `import { register } from 'node:module';
register(${JSON.stringify(pathToFileURL(path.join(hookDir, 'hooks.mjs')).href)});
`);
const st = spawn(process.execPath, ['--import', pathToFileURL(path.join(hookDir, 'register.mjs')).href, 'server.js', '--port', String(PORT), '--listen', 'false', '--dataRoot', dataRoot], { cwd: ST });
let out = ''; st.stdout.on('data', d => (out += d)); st.stderr.on('data', d => (out += d));

const ready = async (page) => {
    for (let i = 0; i < 360; i++) {
        const ok = await page.evaluate(async () => { try { const S = await import('/script.js'), T = await import('/scripts/tokenizers.js'); return S.settingsReady === true && T.TEXTGEN_TOKENIZERS.length > 0 && document.querySelector('#preloader') === null; } catch { return false; } });
        if (ok) return;
        await page.waitForTimeout(500);
    }
    throw new Error('the SillyTavern page did not finish loading');
};
// what the page holds (the same fields as tests/ststatus.run.mjs snapshot)
const snapshot = page => page.evaluate(async () => {
    const S = await import('/script.js'), O = await import('/scripts/openai.js'), TG = await import('/scripts/textgen-settings.js'), TGM = await import('/scripts/textgen-models.js'), K = await import('/scripts/kai-settings.js');
    const pickModels = o => Object.fromEntries(Object.keys(o).filter(k => /_model$/.test(k)).sort().map(k => [k, o[k]]));
    const pickNums = o => Object.fromEntries(['openai_max_context', 'temp_openai', 'freq_pen_openai', 'pres_pen_openai', 'nanogpt_provider'].map(k => [k, o[k]]));
    return JSON.parse(JSON.stringify({
        online_status: S.online_status, model_list: O.model_list, oai: pickModels(O.oai_settings), nums: pickNums(O.oai_settings), tg: pickModels(TG.textgenerationwebui_settings),
        openRouterModels: TGM.openRouterModels, tok: sessionStorage.getItem('tokenizationSupported'), kai_flags: K.kai_flags, model: S.substituteParams('{{model}}'),
    }));
});
// SillyTavern's own connect button for the main API, then wait for its status request and what follows it
const connect = page => page.evaluate(async () => {
    const S = await import('/script.js');
    const sel = S.main_api === 'openai' ? '#api_button_openai' : S.main_api === 'kobold' ? '#api_button' : '#api_button_textgenerationwebui';
    let n = 0, done = 0;
    const orig = window.fetch;
    window.fetch = async (u, i) => { const isStatus = String(u).endsWith('/status'); if (isStatus) n++; try { return await orig(u, i); } finally { if (isStatus) done++; } };
    try {
        $(sel).trigger('click');
        const t0 = Date.now();
        while (Date.now() - t0 < 30000) {
            await new Promise(r => setTimeout(r, 100));
            const busy = !!document.querySelector('.api_button.disabled');
            if (n > 0 && done === n && !busy) break;
            if (n === 0 && !busy && Date.now() - t0 > 2500) break;
        }
        await new Promise(r => setTimeout(r, 800));
        return { n, done };
    } finally { window.fetch = orig; }
});

let browser, fail = 0;
const expected = { cases: {}, calls: {} };
try {
    let up = false;
    for (let i = 0; i < 360 && !up; i++) { try { up = (await fetch(`${base}/csrf-token`)).ok; } catch { /* not up */ } if (!up) await new Promise(r => setTimeout(r, 500)); }
    if (!up) throw new Error('ST did not start:\n' + out.slice(-3000));
    writePresets(userRoot);
    browser = await chromium.launch();
    {
        // (the fake keys, written by SillyTavern itself: /api/secrets/write)
        const page = await browser.newPage();
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof window.SillyTavern?.getContext === 'function', null, { timeout: 180000 });
        for (const key of C.SECRETS) {
            const status = await page.evaluate(async ({ key, value }) => (await fetch('/api/secrets/write', { method: 'POST', headers: SillyTavern.getContext().getRequestHeaders(), body: JSON.stringify({ key, value }) })).status, { key, value: C.SECRET_VALUE });
            if (status !== 200) throw new Error(`secret ${key}: ${status}`);
        }
        await page.close();
    }
    // (NA_ORACLE_ONLY=a,b: those cases only — the fixture is not written then)
    const only = process.env.NA_ORACLE_ONLY ? process.env.NA_ORACLE_ONLY.split(',') : null;
    for (const c of C.CASES.filter(x => !only || only.includes(x.id))) {
        // (a new browser context for every case: SillyTavern keeps the tab's sessionStorage — the API tokenizer mark — across reloads)
        const context = await browser.newContext();
        const page = await context.newPage();
        page.on('pageerror', e => console.log('  pageerror', c.id, String(e).slice(0, 300)));
        const settings = RUN.settingsOf(c);
        fs.writeFileSync(path.join(userRoot, 'settings.json'), JSON.stringify(settings, null, 4));
        routes = c.phases[0].provider;
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof window.SillyTavern?.getContext === 'function' && document.querySelector('#preloader') === null && !!window.SillyTavern.getContext().ConnectionManagerRequestService, null, { timeout: 180000 });
        await ready(page);
        if (c.request === 'tc') await page.waitForFunction(() => !!document.getElementById('connection_profiles'), null, { timeout: 60000 });
        await page.waitForTimeout(1000);
        const got = { phases: [], request: null };
        for (const ph of c.phases) {
            routes = ph.provider;
            await connect(page);
            got.phases.push(await snapshot(page));
        }
        got.request = await page.evaluate(async ({ c, NAME1, NAME2, GENERATE, MESSAGES, TC_CUSTOM, TC_REPLY }) => {
            const S = await import('/script.js'), O = await import('/scripts/openai.js'), P = await import('/scripts/popup.js');
            P.Popup.show.confirm = async () => P.POPUP_RESULT.CANCELLED;
            S.setUserName(NAME1, { toastPersonaNameChange: false });
            S.setCharacterName(NAME2);
            const gen = [], orig = window.fetch;
            window.fetch = async (url, init) => {
                const u = String(url);
                if (GENERATE.includes(u)) {
                    gen.push({ url: u, body: JSON.parse(init.body) });
                    return new Response(JSON.stringify(TC_REPLY), { status: 200, headers: { 'Content-Type': 'application/json' } });
                }
                return orig(url, init);
            };
            try {
                if (c.request === 'cc') return JSON.parse(JSON.stringify(await O.createGenerationParameters(structuredClone(O.oai_settings), O.getChatCompletionModel(), 'quiet', structuredClone(MESSAGES))));
                if (c.request === 'tc') { await SillyTavern.getContext().ConnectionManagerRequestService.sendRequest('tc-main', structuredClone(MESSAGES), 300, structuredClone(TC_CUSTOM)); return JSON.parse(JSON.stringify(gen)); }
                return JSON.parse(JSON.stringify({ model: S.substituteParams('{{model}}') }));
            } catch (err) {
                return { error: String(err?.message || err) };
            } finally {
                window.fetch = orig;
            }
        }, { c, NAME1: C.NAME1, NAME2: C.NAME2, GENERATE: C.GENERATE, MESSAGES: C.MESSAGES, TC_CUSTOM: C.TC_CUSTOM, TC_REPLY: C.TC_REPLY });

        // (the server's way to SillyTavern's own handlers — the bridge — here through the page, with its session, to the same fake provider)
        const calls = [];
        const viaBridge = async (url, init) => {
            const x = await fetch(bridge.url + url, { method: init?.method || 'POST', headers: { 'Content-Type': 'application/json', 'x-na-token': bridge.token, 'x-na-root': encodeURIComponent(userRoot) }, body: init?.body ?? null });
            const headers = {};
            for (const h of ['content-type', 'x-supports-tokenization']) { const v = x.headers.get(h); if (v != null) headers[h] = v; }
            return { status: x.status, statusText: x.statusText, headers, text: await x.text() };
        };
        const send = async (url, init) => {
            const r = url === '/api/secrets/read' ? await viaBridge(url, init) : await page.evaluate(async ({ url, method, body }) => {
                const x = await fetch(url, { method, headers: SillyTavern.getContext().getRequestHeaders(), body });
                const headers = {};
                for (const h of ['content-type', 'x-supports-tokenization']) { const v = x.headers.get(h); if (v != null) headers[h] = v; }
                return { status: x.status, statusText: x.statusText, headers, text: await x.text() };
            }, { url, method: init?.method || 'POST', body: init?.body ?? null });
            calls.push({ key: C.callKey(url, init?.body), ...r });
            return new Response(r.text, { status: r.status, statusText: r.statusText, headers: r.headers });
        };
        const logs = [];
        const mine = await RUN.runCase(c, send, { root: userRoot, phase: i => { routes = c.phases[i].provider; }, logs });
        const same = JSON.stringify(mine) === JSON.stringify(got);
        if (!same) fail++;
        console.log(same ? 'OK  ' : 'DIFF', c.id, same ? `(${calls.length} calls${logs.length ? '; ' + logs.join(' | ') : ''})` : `\n  browser ${JSON.stringify(got)}\n  server  ${JSON.stringify(mine)}`);
        if (process.env.NA_ORACLE_DUMP) fs.appendFileSync(process.env.NA_ORACLE_DUMP, JSON.stringify({ id: c.id, got, mine, calls }) + '\n');
        expected.cases[c.id] = got;
        expected.calls[c.id] = calls;
        await context.close();
    }
    if (!fail && !only) fs.writeFileSync(path.join(REPO, 'tests/fixtures/ststatus-expected.json'), JSON.stringify(expected, null, 1) + '\n');
} catch (e) { fail++; console.log('THREW', String(e?.stack || e).slice(0, 1500)); }
finally {
    await browser?.close(); st.kill('SIGTERM'); await new Promise(r => setTimeout(r, 1000));
    fake.close(); fake.closeAllConnections?.();
    bridge.close();
    fs.rmSync(dataRoot, { recursive: true, force: true });
    fs.rmSync(hookDir, { recursive: true, force: true });
    console.log(fail ? `FAILED ${fail} (of ${C.CASES.length})` : `ALL OK (${C.CASES.length} cases)`); process.exit(fail ? 1 : 0);
}
