// 실리가 initMacros 밖에서 등록하는 매크로(작가 노트 · 추론 · 요약 · 그림 생성 · 표정)와 {{hasExtension}}: 실리 1.19.1 브라우저 자신의
// substituteParams가 만든 글 → tests/fixtures/stmacros2-expected.json, 그리고 서버 쪽(plugin/st, tests/stmacros2.run.mjs)이 만든 것과 그 자리에서 대 봐요.
// 실리는 임시 데이터 폴더(--dataRoot)로 띄워요: 진짜 data/는 안 건드려요. variant마다 settings.json을 쓰고 페이지를 새로 열어요(실리는 열 때 등록해요).
// 열린 페이지에서 첫 실행 창이 없는지(firstRun false), 작가 노트 · 추론 · 켜진 확장의 매크로가 등록됐는지 먼저 봐요.
// 채팅은 그 값을 페이지에 넣고 CHAT_CHANGED를 보내요(실리가 채팅을 열 때처럼: 작가 노트 · 요약 · 표정이 그때 채워요).
// 확장 찾기: 서버 쪽 naDiscover(다리 = 페이지를 거친 실리의 /api/extensions/discover, 옛 다리면 폴더를 직접)가 페이지의 extensionNames와 같은지도 봐요.
// config.yaml extensions.enabled 꺼짐은 실리를 SILLYTAVERN_EXTENSIONS_ENABLED=false로 한 번 더 띄워서.
// 쓰기: node tools/st/oracle-macros.mjs <실리 1.19.1 폴더>   (모두 같을 때만 기대값 파일을 써요)
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
const C = await import(path.join(REPO, 'tests/stmacros2.cases.mjs'));
process.chdir(ST);
const RUN = await import(path.join(REPO, 'tests/stmacros2.run.mjs'));
const { naDiscover, __naDiscoverReset } = await import(path.join(REPO, 'plugin/st/namacros.js'));
const { __naLeftReset } = await import(path.join(REPO, 'plugin/st/naleft.js'));

async function startSt(port, env = {}) {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'na-oracle-macros-'));
    // (a new data folder gets SillyTavern's default settings.json with firstRun: true: the page then waits in the onboarding popup and never
    //  runs initAuthorsNote · initReasoning. A settings.json with firstRun: false is written first; SillyTavern does not copy over a file that is there)
    fs.mkdirSync(path.join(dataRoot, 'default-user'), { recursive: true });
    fs.writeFileSync(path.join(dataRoot, 'default-user', 'settings.json'), JSON.stringify(C.VARIANTS[0].settings, null, 4));
    const proc = spawn(process.execPath, ['server.js', '--port', String(port), '--listen', 'false', '--dataRoot', dataRoot], { cwd: ST, env: { ...process.env, ...env } });
    let out = ''; proc.stdout.on('data', d => (out += d)); proc.stderr.on('data', d => (out += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 360 && !up; i++) { try { up = (await fetch(`${base}/csrf-token`)).ok; } catch { /* not up */ } if (!up) await new Promise(r => setTimeout(r, 500)); }
    if (!up) throw new Error('ST did not start:\n' + out.slice(-3000));
    return { base, dataRoot, userRoot: path.join(dataRoot, 'default-user'), stop: async () => { proc.kill('SIGTERM'); await new Promise(r => setTimeout(r, 1000)); fs.rmSync(dataRoot, { recursive: true, force: true }); } };
}

let browser, fail = 0;
const sts = {};
const expected = { variants: {} };
try {
    browser = await chromium.launch();
    for (const v of C.VARIANTS) {
        const key = v.config === 'off' ? 'off' : 'on';
        sts[key] ||= await startSt(key === 'off' ? 8133 : 8132, key === 'off' ? { SILLYTAVERN_EXTENSIONS_ENABLED: 'false' } : {});
        const st = sts[key];
        fs.writeFileSync(path.join(st.userRoot, 'settings.json'), JSON.stringify(v.settings, null, 4));
        const page = await browser.newPage();
        page.on('pageerror', e => console.log('  pageerror', v.id, String(e).slice(0, 200)));
        if (v.labels) await page.route('**/api/extra/classify/labels', r => r.fulfill({ status: v.labels.status, contentType: 'application/json', body: typeof v.labels.body === 'string' ? v.labels.body : JSON.stringify(v.labels.body) }));
        await page.goto(st.base, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof window.SillyTavern?.getContext === 'function' && document.querySelector('#preloader') === null, null, { timeout: 180000 });
        // (registered: the author's note's and reasoning's always, the enabled built-in extensions' — they register when SillyTavern turns them on)
        const want = ['authorsNote', 'reasoningPrefix'];
        const offExt = v.config === 'off' ? ['memory', 'expressions', 'stable-diffusion'] : (v.settings.extension_settings.disabledExtensions || []);
        if (!offExt.includes('memory')) want.push('summary');
        if (!offExt.includes('expressions')) want.push('availableExpressions');
        if (!offExt.includes('stable-diffusion')) want.push('charPrefix');
        await page.waitForFunction(async (want) => {
            try {
                const S = await import('/script.js'), M = await import('/scripts/macros.js'), MS = await import('/scripts/macros/macro-system.js');
                if (S.settingsReady !== true) return false;
                const have = new Set([...M.MacrosParser].map(x => String(x.key).toLowerCase()));
                return want.every(n => MS.macros.registry.hasMacro(n) || have.has(n.toLowerCase()));
            } catch { return false; }
        }, want, { timeout: 120000, polling: 500 });
        await page.waitForTimeout(1500);
        const got = await page.evaluate(async (C) => {
            const S = await import('/script.js'), G = await import('/scripts/group-chats.js'), E = await import('/scripts/extensions.js');
            const out = {};
            S.characters.splice(0, S.characters.length, ...structuredClone(C.CHARACTERS));
            S.setUserName(C.NAME1, { toastPersonaNameChange: false });
            for (const s of C.STATES) {
                if (s.group) {
                    if (!G.groups.find(x => x.id === C.GROUP.id)) G.groups.push(structuredClone(C.GROUP));
                    if (G.selected_group !== C.GROUP.id) await G.openGroupById(C.GROUP.id);
                    S.setCharacterId(undefined);
                    S.setCharacterName('');
                } else {
                    G.resetSelectedGroup();
                    S.setCharacterId(s.character);
                    S.setCharacterName(C.CHARACTERS[s.character].name);
                }
                S.updateChatMetadata(structuredClone(s.meta), true);
                S.chat.splice(0, S.chat.length, ...structuredClone(s.chat));
                // (what SillyTavern does once a chat is loaded: its CHAT_CHANGED handlers — the author's note's loadSettings, the summary box, no last expression)
                await S.eventSource.emit(S.event_types.CHAT_CHANGED, S.getCurrentChatId());
                await new Promise(r => setTimeout(r, 300));
                for (const t of C.TEXTS) out[`${s.id}:${t.id}`] = S.substituteParams(t.text, {});
            }
            G.resetSelectedGroup();
            return { out, extensionNames: [...E.extensionNames] };
        }, { NAME1: C.NAME1, CHARACTERS: C.CHARACTERS, GROUP: C.GROUP, STATES: C.STATES, TEXTS: C.TEXTS });
        // (the server's way to SillyTavern's own handlers — the bridge — here through the page, with its session. An older bridge answers 404 without its mark)
        const answers = {};
        const send = async (url, init = {}) => {
            const method = init.method || 'POST';
            const u = String(url).split('?')[0];
            if (v.bridge === 'old') { answers[u] = { status: 404, body: 'Not Found' }; return new Response('Not Found', { status: 404 }); }
            const r = await page.evaluate(async ({ url, method, body }) => { const x = await fetch(url, { method, headers: SillyTavern.getContext().getRequestHeaders(), body: method === 'GET' ? undefined : body }); return { status: x.status, text: await x.text() }; }, { url, method, body: init.body ?? null });
            let body = r.text; try { body = JSON.parse(r.text); } catch { /* text */ }
            answers[u] = { status: r.status, body };
            return new Response(r.text, { status: r.status, headers: { 'Content-Type': 'application/json', 'x-na-bridge': '1' } });
        };
        __naDiscoverReset();
        const ext = await naDiscover({ root: st.userRoot, stRoot: ST, send });
        __naDiscoverReset();
        const own = await naDiscover({ root: st.userRoot, stRoot: ST, send: null });
        __naDiscoverReset();
        const browserNames = v.config === 'off' ? [] : got.extensionNames;
        const namesOk = JSON.stringify(ext.enabled ? ext.names : []) === JSON.stringify(got.extensionNames) && (v.config === 'off' || JSON.stringify(own.names) === JSON.stringify(got.extensionNames));
        if (!namesOk) { fail++; console.log('DIFF', v.id, 'extensionNames', `\n  browser ${JSON.stringify(got.extensionNames)}\n  server  ${JSON.stringify(ext)}\n  folders ${JSON.stringify(own.names)}`); }
        __naLeftReset();
        const mine = await RUN.runVariant(v, { ext, send });
        delete answers['/api/extensions/discover'];
        let same = 0;
        for (const k of Object.keys(got.out)) {
            if (got.out[k] === mine[k]) { same++; continue; }
            fail++;
            console.log('DIFF', v.id, k, `\n  browser ${JSON.stringify(got.out[k])}\n  server  ${JSON.stringify(mine[k])}`);
        }
        console.log(same === Object.keys(got.out).length && namesOk ? 'OK  ' : 'DIFF', v.id, `(${same}/${Object.keys(got.out).length}, extensions ${browserNames.length})`);
        expected.variants[v.id] = { ext, answers, browserNames, out: got.out };
        await page.close();
    }
    if (!fail) fs.writeFileSync(path.join(REPO, 'tests/fixtures/stmacros2-expected.json'), JSON.stringify(expected, null, 1) + '\n');
} catch (e) { fail++; console.log('THREW', String(e?.stack || e).slice(0, 1500)); }
finally {
    await browser?.close();
    for (const st of Object.values(sts)) await st.stop();
    console.log(fail ? `FAILED ${fail}` : `ALL OK (${C.VARIANTS.length} variants)`); process.exit(fail ? 1 : 0);
}
