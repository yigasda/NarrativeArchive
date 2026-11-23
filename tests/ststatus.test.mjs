// 서버의 연결 확인(plugin/st/nastatus.js: 실리 1.19.1 getStatusOpen · getStatusTextgen · getStatusKobold를 옮긴 것 + 상태 답 캐시).
// 1) 기대값(tests/fixtures/ststatus-expected.json)은 실리 1.19.1 브라우저가 자기 연결 버튼으로 연결한 뒤 들고 있던 것과 그 뒤에 만든 요청이에요:
//    tools/st/oracle-status.mjs가 진짜 실리 · 가짜 공급자로 만들고 그 자리에서 서버 것과 대 봐요. 실리 서버가 준 답(calls)도 그때 것이에요. 지어낸 값이 아니에요.
// 2) 캐시 · 키 확인 · 로그 규칙: 가짜 다리(send)와 시계로. 예시 캐릭터만. 고친 것마다 그것을 깨면 실패하는 테스트예요(검토 st1 · st2, 2026-11-23).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CASES, callKey } from './ststatus.cases.mjs';
import { runCase } from './ststatus.run.mjs';
import { naLoad } from '../plugin/st/naload.js';
import { naStatus, __naStatusReset, __naStatusIdle, STATUS_OK_MS, STATUS_CLOUD_MS, STATUS_FAIL_MS, STATUS_FAIL_MAX_MS } from '../plugin/st/nastatus.js';
import * as SCRIPT from '../plugin/st/public/script.js';
import * as OAI from '../plugin/st/public/scripts/openai.js';
import * as TG from '../plugin/st/public/scripts/textgen-settings.js';
import * as TGM from '../plugin/st/public/scripts/textgen-models.js';
import { __naSetFetch, naFetchFailures } from '../plugin/st/public/naFetch.js';
import { getStringHash } from '../plugin/st/public/scripts/utils.js';

const EXPECTED = JSON.parse(fs.readFileSync(new URL('./fixtures/ststatus-expected.json', import.meta.url), 'utf8'));
const tmpRoot = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'na-ststatus-root-')); process.once('exit', () => fs.rmSync(d, { recursive: true, force: true })); return d; };

test('기대값의 경우가 15개 넘게 있어요 (채팅 완성 · 글 완성 · Kobold · 꺼진 백엔드 · 목록에 없는 모델)', () => {
    assert.ok(CASES.length >= 15);
    for (const c of CASES) assert.ok(EXPECTED.cases[c.id], `기대값이 없어요: ${c.id} (tools/st/oracle-status.mjs를 다시 돌려요)`);
});

for (const c of CASES) {
    test(`연결한 뒤 = 실리 브라우저: ${c.id}`, async () => {
        const calls = EXPECTED.calls[c.id] || [];
        const used = new Set();
        // (SillyTavern's server's replies, as they came then: each one once, in order)
        const replay = async (url, init) => {
            const key = callKey(url, init?.body);
            const i = calls.findIndex((x, n) => !used.has(n) && x.key === key);
            assert.ok(i >= 0, `실리 서버 답이 기록에 없어요: ${key}`);
            used.add(i);
            const hit = calls[i];
            return new Response(hit.text, { status: hit.status, statusText: hit.statusText, headers: hit.headers });
        };
        const got = await runCase(c, replay, { root: tmpRoot() });
        assert.equal(JSON.stringify(got), JSON.stringify(EXPECTED.cases[c.id]));
        assert.equal(used.size, calls.length, '기록된 실리 서버 답을 다 써야 해요');
    });
}

// ---------- 캐시 규칙 ----------
const OR = [{ id: 'ren/b', name: 'B Ren', context_length: 99 }, { id: 'ren/a', name: 'A Ren', context_length: 10 }];
const SECRETS_ROUTE = '/api/secrets/read';
// a bridge to SillyTavern's own handlers, answering what answer(url, init, n) says. The key state (/api/secrets/read): `secrets` (a value or a
// function), or 404 when not given — an older bridge: no key check, as before
function bridge(answer, { secrets } = {}) {
    const calls = [], secretCalls = [];
    const json = (body, status = 200, headers = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
    const send = async (url, init) => {
        if (url === SECRETS_ROUTE) {
            secretCalls.push(url);
            return secrets === undefined ? json('Not Found', 404) : json(typeof secrets === 'function' ? secrets() : secrets);
        }
        calls.push({ url, body: init?.body ?? null });
        const a = typeof answer === 'function' ? await answer(url, init, calls.length) : answer;
        if (a instanceof Error) throw a;
        return json(a.body, a.status ?? 200, a.headers);
    };
    return { send, calls, secretCalls };
}
const ccSettings = (oai, more = {}) => ({ main_api: 'openai', ...more, oai_settings: { preset_settings_openai: 'Default', ...oai } });
const tgSettings = tg => ({ main_api: 'textgenerationwebui', textgenerationwebui_settings: tg });
// one worker job: settings.json read, then the connection (plugin/work.mjs withWorld)
async function job(settings, b, t, o = {}) {
    naLoad(structuredClone(settings));
    return naStatus({ send: b.send, now: () => t, ...o });
}
const MIN = 60 * 1000, HOUR = 60 * MIN;
const AZ = { chat_completion_source: 'azure_openai', azure_base_url: 'https://ren.example', azure_deployment_name: 'ren-dep', azure_api_version: '2024-10-21', azure_openai_model: 'ren-saved' };
// (a promise that never settles unless let go: a backend that hangs)
const hanging = () => { let release; const p = new Promise(ok => { release = ok; }); return { p, release }; };
const within = (p, ms, what) => Promise.race([p, new Promise((_, no) => { const t = setTimeout(() => no(new Error(`${what}: ${ms}ms 넘게 걸렸어요`)), ms); t.unref?.(); })]);

test('캐시: 설정이 그대로면 다시 묻지 않아요 — 클라우드 목록은 24시간, 로컬 백엔드(사용자 지정 주소)는 30분. 정렬은 일마다 받아 둔 답으로', async () => {
    __naStatusReset();
    const b = bridge({ body: { data: OR } });
    const s = ccSettings({ chat_completion_source: 'openrouter', openrouter_model: 'ren/a' });
    await job(s, b, 0);
    assert.equal(b.calls.length, 1);
    assert.deepEqual(b.calls[0], { url: '/api/backends/chat-completions/status', body: JSON.stringify({ reverse_proxy: '', proxy_password: '', chat_completion_source: 'openrouter' }) });
    assert.deepEqual(OAI.model_list.map(m => m.id), ['ren/a', 'ren/b']);
    assert.equal(SCRIPT.online_status, 'Valid');
    await job(s, b, STATUS_CLOUD_MS - 1);
    assert.equal(b.calls.length, 1);
    // (sort_models is not part of the key: the kept reply is sorted again — openai.js sortModelsBy)
    await job({ ...s, oai_settings: { ...s.oai_settings, sort_models: 'context_length' } }, b, 5 * MIN);
    assert.equal(b.calls.length, 1);
    assert.deepEqual(OAI.model_list.map(m => m.id), ['ren/b', 'ren/a']);
    await job(s, b, STATUS_CLOUD_MS + 1);
    await __naStatusIdle();
    assert.equal(b.calls.length, 2);
    // (a backend of one's own: it can change its models without a settings change)
    const c = ccSettings({ chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:9/v1' });
    await job(c, b, 0);
    await job(c, b, STATUS_OK_MS - 1);
    assert.equal(b.calls.length, 3);
    await job(c, b, STATUS_OK_MS + 1);
    await __naStatusIdle();
    assert.equal(b.calls.length, 4);
});

test('캐시 열쇠: 상태 몸통이 바뀌면(주소 · 소스) 다시 묻고, 전의 것으로 돌아가면 그 답을 다시 써요. main_api를 바꾸면 그 API의 길로', async () => {
    __naStatusReset();
    const b = bridge((url, init) => ({ body: { data: [{ id: JSON.parse(init.body).custom_url ? 'ren-c' : 'x' }] } }));
    const A = ccSettings({ chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:9/a' }), B = ccSettings({ chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:9/b' });
    await job(A, b, 0);
    await job(B, b, 1);
    await job(A, b, 2);
    assert.equal(b.calls.length, 2);
    // (custom_model was empty: the first model — saveModelList 2079~2081)
    assert.equal(OAI.oai_settings.custom_model, 'ren-c');
    await job(tgSettings({ type: 'ooba', server_urls: { ooba: 'http://127.0.0.1:5000' } }), b, 3);
    assert.equal(b.calls.at(-1).url, '/api/backends/text-completions/status');
    assert.equal(b.calls.at(-1).body, JSON.stringify({ api_server: 'http://127.0.0.1:5000', api_type: 'ooba' }));
});

test('캐시 열쇠(옛 다리: 키 상태를 못 읽어요): secrets.json이 바뀌면(키를 저장함) 다시 물어요. 실리가 빈 파일({})을 만든 것은 바뀐 게 아니에요', async () => {
    __naStatusReset();
    const root = tmpRoot();
    const b = bridge({ body: { data: OR } });
    const s = ccSettings({ chat_completion_source: 'openrouter' });
    await job(s, b, 0, { root });
    // (SillyTavern makes an empty secrets.json the first time it reads one — secrets.js 127~130)
    fs.writeFileSync(path.join(root, 'secrets.json'), '{}');
    await job(s, b, 1, { root });
    assert.equal(b.calls.length, 1);
    fs.writeFileSync(path.join(root, 'secrets.json'), JSON.stringify({ api_key_openrouter: [{ id: '1', value: 'na-test-not-a-key', active: true }] }));
    await job(s, b, 2, { root });
    await job(s, b, 3, { root });
    assert.equal(b.calls.length, 2);
    fs.writeFileSync(path.join(root, 'secrets.json.tmp'), JSON.stringify({ api_key_openrouter: [{ id: '2', value: 'na-test-other', active: true }] }));
    fs.renameSync(path.join(root, 'secrets.json.tmp'), path.join(root, 'secrets.json'));
    await job(s, b, 4, { root });
    assert.equal(b.calls.length, 3);
});

test('캐시 열쇠(다리가 키 상태를 줘요): 그 소스의 키를 바꾸면 다시 묻고, 다른 공급자의 키를 저장한 것으로는 다시 묻지 않아요 (Azure의 돈)', async () => {
    __naStatusReset();
    const root = tmpRoot();
    let state = { api_key_openrouter: [{ id: 'k1', active: true }], api_key_claude: null };
    const b = bridge({ body: { data: OR } }, { secrets: () => state });
    const save = () => fs.writeFileSync(path.join(root, 'secrets.json'), JSON.stringify({ n: b.secretCalls.length, pad: 'x'.repeat(b.secretCalls.length + 3) }));
    const s = ccSettings({ chat_completion_source: 'openrouter' });
    save();
    await job(s, b, 0, { root });
    state = { ...state, api_key_claude: [{ id: 'c1', active: true }] };
    save();
    await job(s, b, 1, { root });
    assert.equal(b.calls.length, 1);
    assert.equal(b.secretCalls.length, 2);
    state = { ...state, api_key_openrouter: [{ id: 'k1', active: false }, { id: 'k2', active: true }] };
    save();
    await job(s, b, 2, { root });
    assert.equal(b.calls.length, 2);
    // (the key state is read again only when secrets.json changed)
    await job(s, b, 3, { root });
    assert.equal(b.secretCalls.length, 3);
});

test('캐시 열쇠(글 완성 · Kobold): 그 종류가 쓰는 키만 (실리 서버 additional-headers.js 230~245의 표). 다른 공급자의 키를 저장해도 다시 묻지 않아요', async () => {
    __naStatusReset();
    const root = tmpRoot();
    let state = { api_key_ooba: [{ id: 'o1', active: true }], api_key_openrouter: null, api_key_mancer: null };
    const b = bridge({ body: { result: 'ren-tg' } }, { secrets: () => state });
    const save = () => fs.writeFileSync(path.join(root, 'secrets.json'), JSON.stringify({ n: b.secretCalls.length, pad: 'x'.repeat(b.secretCalls.length + 3) }));
    const ooba = tgSettings({ type: 'ooba', server_urls: { ooba: 'http://127.0.0.1:5000' } });
    const ollama = tgSettings({ type: 'ollama', server_urls: { ollama: 'http://127.0.0.1:11434' } });
    const kobold = { main_api: 'kobold', api_server: 'http://127.0.0.1:5001/api' };
    const all = async t => { for (const s of [ooba, ollama, kobold]) await job(s, b, t, { root }); };
    save();
    await all(0);
    const n = b.calls.length;
    assert.ok(n >= 3, String(n));
    state = { ...state, api_key_openrouter: [{ id: 'r1', active: true }], api_key_mancer: [{ id: 'm1', active: true }] };
    save();
    await all(1);
    assert.equal(b.calls.length, n);
    // (the key ooba uses: asked again — ollama and Kobold read no key)
    state = { ...state, api_key_ooba: [{ id: 'o1', active: false }, { id: 'o2', active: true }] };
    save();
    await all(2);
    assert.equal(b.calls.length, n + 1);
    assert.equal(b.calls.at(-1).url, '/api/backends/text-completions/status');
});

test('실패는 1분 · 2분 · 4분 … 30분 뒤에 다시 물어요 (꺼진 백엔드를 매분 두드리지 않아요). 실리 창에는 한 번만', async () => {
    __naStatusReset();
    const logs = [];
    const b = bridge({ status: 500, body: 'Internal Server Error' });
    const s = ccSettings({ chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:9/v1' });
    const at = [];
    for (let m = 0; m <= 240; m++) {
        const before = b.calls.length;
        await job(s, b, m * MIN, { log: t => logs.push(t) });
        await __naStatusIdle();
        if (b.calls.length > before) at.push(m);
    }
    // (Custom: the browser writes "Status check bypassed" even when it fails — getStatusOpen 4539~4542, 4568~4570)
    assert.equal(SCRIPT.online_status, 'Status check bypassed');
    const gaps = at.slice(1).map((m, i) => m - at[i]);
    assert.deepEqual(gaps.slice(0, 6), [1, 2, 4, 8, 16, 30]);
    assert.ok(gaps.every(g => g <= STATUS_FAIL_MAX_MS / MIN), JSON.stringify(gaps));
    assert.deepEqual(logs, ['상태를 가져오는 중 오류가 발생했습니다: /api/backends/chat-completions/status (500)']);
    assert.equal(at[1] - at[0], STATUS_FAIL_MS / MIN);
});

test('다시 물을 때는 기다리지 않아요: 백엔드가 멈춰도 일은 둔 답으로 바로 해요 (뒤에서 물어요). 처음 묻는 열쇠만 답을 기다려요', async () => {
    __naStatusReset();
    let hang = null;
    const b = bridge(() => (hang ? hang.p.then(() => ({ body: { data: [{ id: 'ren-new' }] } })) : { body: { data: [{ id: 'ren-old' }] } }));
    const s = ccSettings({ chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:9/v1' });
    const first = await job(s, b, 0);
    assert.equal(first.waited, true);
    hang = hanging();
    const r = await within(job(s, b, STATUS_OK_MS + 1), 2000, '멈춘 백엔드를 기다렸어요');
    assert.deepEqual([r.fetched, r.waited, r.refreshed, r.ok], [true, false, true, true]);
    assert.equal(SCRIPT.online_status, 'Valid');
    assert.deepEqual(OAI.model_list.map(m => m.id), ['ren-old']);
    // (another job while it is still asking: no second call)
    await within(job(s, b, STATUS_OK_MS + 2), 2000, '멈춘 백엔드를 기다렸어요');
    assert.equal(b.calls.length, 2);
    hang.release();
    await __naStatusIdle();
    await job(s, b, STATUS_OK_MS + 3);
    assert.deepEqual(OAI.model_list.map(m => m.id), ['ren-new']);
});

test('Azure는 설정이 바뀔 때만 한 번 물어요 — 성공이든, 유료 확인 뒤의 500이든 (상태 확인이 진짜 생성 요청이라 돈이 들어요). 모델은 목록의 것', async () => {
    __naStatusReset();
    const b = bridge({ body: { data: [{ id: 'ren-azure-4' }] } });
    const s = ccSettings(AZ);
    await job(s, b, 0);
    await job(s, b, 5 * 24 * HOUR);
    await __naStatusIdle();
    assert.equal(b.calls.length, 1);
    assert.equal(OAI.oai_settings.azure_openai_model, 'ren-azure-4');
    await job(ccSettings({ ...AZ, azure_deployment_name: 'ren-dep-2' }), b, 5 * 24 * HOUR + 1);
    assert.equal(b.calls.length, 2);
    // (SillyTavern answers 500 from the catch after the paid probe — chat-completions.js 2008~2011)
    __naStatusReset();
    const root = tmpRoot();
    const logs = [];
    const f = bridge({ status: 500, body: { error: true, message: 'Failed to connect to the Azure endpoint.' } });
    for (let i = 0; i < 5; i++) { await job(s, f, i * 3 * HOUR, { root, log: t => logs.push(t) }); await __naStatusIdle(); }
    assert.equal(f.calls.length, 1);
    assert.deepEqual(logs, ['상태를 가져오는 중 오류가 발생했습니다: Azure 엔드포인트에 연결하지 못했습니다.']);
    __naStatusReset();
    await job(s, f, 0, { root });
    assert.equal(f.calls.length, 1, '디스크에 둔 답');
});

test('Azure: 15초가 지나도 다리 요청을 끊지 않아요. 일은 연결 안 됨으로 하고, 실리의 답이 오면 그 답을 둬요(디스크에도). 그동안 다시 묻지 않아요', async () => {
    __naStatusReset();
    const root = tmpRoot();
    const hang = hanging();
    let aborted = false;
    const b = bridge((url, init) => { init.signal?.addEventListener('abort', () => { aborted = true; }); return hang.p.then(() => ({ body: { data: [{ id: 'ren-late' }] } })); });
    const s = ccSettings(AZ);
    const logs = [];
    const r = await within(job(s, b, 0, { root, timeoutMs: 20, log: t => logs.push(t) }), 2000, 'Azure를 끝까지 기다렸어요');
    assert.deepEqual([r.waited, r.ok], [true, false]);
    assert.equal(SCRIPT.online_status, 'no_connection');
    assert.deepEqual(logs, ['상태를 가져오는 중 오류가 발생했습니다: 시간이 초과되었습니다.']);
    // (still asking: no second paid check)
    for (let m = 1; m <= 90; m += 7) await within(job(s, b, m * MIN, { root, timeoutMs: 20 }), 2000, '묻는 중인 Azure를 기다렸어요');
    assert.equal(b.calls.length, 1);
    hang.release();
    await __naStatusIdle();
    assert.equal(aborted, false, '다리 요청을 끊었어요');
    await job(s, b, 2 * HOUR, { root });
    assert.equal(SCRIPT.online_status, 'Valid');
    assert.equal(OAI.oai_settings.azure_openai_model, 'ren-late');
    await job(s, b, 5 * 24 * HOUR, { root });
    await __naStatusIdle();
    assert.equal(b.calls.length, 1);
    // (a new worker: the late answer is on disk)
    __naStatusReset();
    await job(s, b, 0, { root });
    assert.equal(b.calls.length, 1);
    assert.equal(OAI.oai_settings.azure_openai_model, 'ren-late');
});

test('Azure: 유료 확인 앞에서 끝난 실패(설정 없음 · GET /models의 401 · 429 · 503 · 200 {error} · 다리 오류)는 다른 실패처럼 1분 · 2분 · 4분 … 뒤에 다시 물어요. 디스크에 두지 않아요', async () => {
    const FREE = [
        ['400 설정 없음', { status: 400, body: { error: true, message: 'Azure configuration is incomplete.' } }],
        ['401', { status: 401, body: { error: true, message: 'Invalid API key or insufficient permissions.' } }],
        ['429', { status: 429, body: { error: true, message: 'Azure Models endpoint error: Too Many Requests' } }],
        ['503', { status: 503, body: { error: true, message: 'Azure Models endpoint error: Service Unavailable' } }],
        ['200 {error}', { body: { error: true } }],
        ['다리 오류', new Error('fetch failed')],
    ];
    for (const [what, fail] of FREE) {
        __naStatusReset();
        const root = tmpRoot();
        let up = false;
        const b = bridge(() => (up ? { body: { data: [{ id: 'ren-azure-ok' }] } } : fail));
        const at = [];
        for (let m = 0; m <= 40; m++) {
            const before = b.calls.length;
            await job(ccSettings(AZ), b, m * MIN, { root, log: () => {} });
            await __naStatusIdle();
            if (b.calls.length > before) at.push(m);
        }
        assert.deepEqual(at, [0, 1, 3, 7, 15, 31], what);
        assert.ok(!fs.existsSync(path.join(root, 'NarrativeArchive', 'status-azure.json')), `${what}: 디스크에 뒀어요`);
        // (a new worker asks again too)
        __naStatusReset();
        await job(ccSettings(AZ), b, 0, { root, log: () => {} });
        assert.equal(b.calls.length, at.length + 1, what);
        // (then it answers: kept for good)
        up = true;
        await job(ccSettings(AZ), b, 2 * MIN, { root });
        await __naStatusIdle();
        await job(ccSettings(AZ), b, 3 * MIN, { root });
        assert.equal(SCRIPT.online_status, 'Valid', what);
        const n = b.calls.length;
        for (let d = 1; d <= 3; d++) { await job(ccSettings(AZ), b, d * 24 * HOUR, { root }); await __naStatusIdle(); }
        assert.equal(b.calls.length, n, what);
    }
    // (a free failure that comes behind a timed-out job: asked again later too)
    __naStatusReset();
    const hang = hanging();
    let late = true;
    const b = bridge(() => (late ? hang.p.then(() => FREE[3][1]) : { body: { data: [{ id: 'ren-azure-ok' }] } }));
    await job(ccSettings(AZ), b, 0, { timeoutMs: 20, log: () => {} });
    hang.release();
    await __naStatusIdle();
    late = false;
    await job(ccSettings(AZ), b, 1, { log: () => {} });
    await job(ccSettings(AZ), b, 30 * MIN, { log: () => {} });
    await __naStatusIdle();
    assert.equal(b.calls.length, 2);
});

test('Azure 디스크: 전 버전이 둔 돈 안 든 실패는 쓰지 않고 다시 물어요. 저장 전에 파일을 다시 읽어서 다른 일꾼이 넣은 칸을 지우지 않아요', async () => {
    __naStatusReset();
    const root = tmpRoot();
    const file = path.join(root, 'NarrativeArchive', 'status-azure.json');
    const b = bridge(() => ({ body: { data: [{ id: 'ren-x' }] } }));
    const az = n => ccSettings({ ...AZ, azure_deployment_name: `d${n}` });
    await job(az(1), b, 0, { root });
    // (the file an older version wrote: a free 503 kept as if for good)
    const one = JSON.parse(fs.readFileSync(file, 'utf8'));
    const [id] = Object.keys(one.entries);
    fs.writeFileSync(file, JSON.stringify({ v: 1, entries: { [id]: { reply: { status: 503, statusText: '', headers: { 'content-type': 'application/json' }, text: JSON.stringify({ error: true, message: 'Azure Models endpoint error: Service Unavailable' }) } } } }));
    __naStatusReset();
    await job(az(1), b, 0, { root });
    assert.equal(b.calls.length, 2);
    assert.equal(SCRIPT.online_status, 'Valid');
    const kept1 = fs.readFileSync(file, 'utf8');
    // (two workers of one SillyTavern, the next starting while the last stops: this one read the file before the other wrote d2)
    __naStatusReset();
    await job(az(2), b, 0, { root });
    const kept12 = fs.readFileSync(file, 'utf8');
    __naStatusReset();
    fs.writeFileSync(file, kept1);
    await job(ccSettings({ chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:9/v1' }), b, 0, { root });
    fs.writeFileSync(file, kept12);
    await job(az(3), b, 1, { root });
    assert.equal(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')).entries).length, 3);
    assert.deepEqual(fs.readdirSync(path.dirname(file)), ['status-azure.json']);
    __naStatusReset();
    const n = b.calls.length;
    for (const k of [1, 2, 3]) await job(az(k), b, 0, { root });
    assert.equal(b.calls.length, n);
});

test('Azure 답은 밀려나지 않고(다른 열쇠가 많아도), 일꾼을 다시 띄워도 다시 묻지 않아요 (사용자 폴더에 둬요). 자주 쓰는 열쇠도 밀려나지 않아요', async () => {
    __naStatusReset();
    const root = tmpRoot();
    const b = bridge(() => ({ body: { data: [{ id: 'ren-x' }] } }));
    const az = ccSettings({ chat_completion_source: 'azure_openai', azure_base_url: 'https://ren.example', azure_deployment_name: 'd', azure_api_version: '2024-10-21' });
    const hot = ccSettings({ chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:9/hot' });
    // (no user folder here: only the memory cache keeps it)
    await job(az, b, 0);
    await job(hot, b, 0);
    for (let i = 0; i < 40; i++) {
        await job(ccSettings({ chat_completion_source: 'custom', custom_url: `http://127.0.0.1:9/${i}` }), b, 1 + i);
        await job(hot, b, 1 + i);
    }
    let n = b.calls.length;
    assert.equal(n, 42);
    await job(az, b, 100);
    await job(hot, b, 100);
    assert.equal(b.calls.length, n);
    // (a new worker — SillyTavern restarted, or the extension updated —: the answer kept in the user folder)
    __naStatusReset();
    await job(az, b, 0, { root });
    n += 1;
    assert.equal(b.calls.length, n);
    __naStatusReset();
    await job(az, b, 0, { root });
    assert.equal(b.calls.length, n);
    assert.equal(OAI.oai_settings.azure_openai_model, 'ren-x');
    assert.ok(!fs.readFileSync(path.join(root, 'NarrativeArchive', 'status-azure.json'), 'utf8').includes('ren.example'), '열쇠 글은 해시로만');
});

test('옛 다리(상태 길이 404): 실패와 같아요. 열쇠마다 실리 창에 한 번만, 요청은 지금처럼 만들어요(막지 않아요)', async () => {
    __naStatusReset();
    const logs = [];
    const b = bridge({ status: 404, body: 'Not Found' });
    const s = ccSettings({ chat_completion_source: 'openrouter', openrouter_model: 'ren/a' });
    for (let i = 0; i < 3; i++) { await job(s, b, i * 2 * HOUR, { log: t => logs.push(t) }); await __naStatusIdle(); }
    await job(tgSettings({ type: 'ooba', server_urls: { ooba: 'http://127.0.0.1:5000' } }), b, 10 * HOUR, { log: t => logs.push(t) });
    await job(tgSettings({ type: 'ooba', server_urls: { ooba: 'http://127.0.0.1:5000' } }), b, 13 * HOUR, { log: t => logs.push(t) });
    assert.deepEqual(logs, [
        '실리 서버의 /api/backends/chat-completions/status를 쓸 수 없습니다. 서버 플러그인을 업데이트하고 실리를 다시 시작하세요.',
        '실리 서버의 /api/backends/text-completions/status를 쓸 수 없습니다. 서버 플러그인을 업데이트하고 실리를 다시 시작하세요.',
    ]);
    assert.equal(SCRIPT.online_status, 'no_connection');
    // (nothing of the failed status stays to stop the request: the same request as before)
    assert.deepEqual(naFetchFailures, []);
    await job(s, b, 14 * HOUR, { log: t => logs.push(t) });
    assert.deepEqual(OAI.model_list, []);
    __naSetFetch(async () => new Response('{}', { status: 200 }));
    const body = await OAI.createGenerationParameters(structuredClone(OAI.oai_settings), OAI.getChatCompletionModel(), 'quiet', [{ role: 'user', content: 'hi' }]);
    __naSetFetch(null);
    assert.equal(body.generate_data.model, 'ren/a');
});

test('백엔드가 꺼지면: 상태는 no_connection, 목록 · 고친 모델은 그 열쇠로 전에 받은 것 (실리 브라우저는 전 목록을 버리지 않아요)', async () => {
    __naStatusReset();
    let up = true;
    const b = bridge(() => (up ? { body: { result: 'ren/b', data: OR } } : { status: 400, body: 'Bad Request' }));
    const s = tgSettings({ type: 'openrouter', openrouter_model: 'ren/gone' });
    await job(s, b, 0);
    assert.equal(SCRIPT.online_status, 'ren/a');
    assert.deepEqual(TGM.openRouterModels.map(m => m.id), ['ren/a', 'ren/b']);
    up = false;
    // (that job still uses the kept answer — asked behind it —, the next one has the failed one)
    await job(s, b, STATUS_CLOUD_MS + 1);
    await __naStatusIdle();
    const r = await job(s, b, STATUS_CLOUD_MS + 2);
    assert.equal(b.calls.length, 2);
    assert.equal(r.replayed, true);
    assert.equal(SCRIPT.online_status, 'no_connection');
    assert.deepEqual(TGM.openRouterModels.map(m => m.id), ['ren/a', 'ren/b']);
    // (textgen-models.js loadOpenRouterModels 705~707: the saved model was not in the list — the first one)
    assert.equal(TG.textgenerationwebui_settings.openrouter_model, 'ren/a');
    // (never had a good one: nothing — the page as it starts)
    __naStatusReset();
    await job(s, b, 0);
    assert.equal(SCRIPT.online_status, 'no_connection');
    assert.deepEqual(TGM.openRouterModels, []);
    assert.equal(TG.textgenerationwebui_settings.openrouter_model, 'ren/gone');
});

test('모델 보정: 고른 모델이 공급자 목록에 없으면 실리처럼 첫 모델로 (ElectronHub: 채팅 길이 있는 것만, 이름 차례)', async () => {
    __naStatusReset();
    const b = bridge({ body: { data: [{ id: 'ren-2', name: 'Varo', endpoints: ['/v1/chat/completions'] }, { id: 'ren-1', name: 'Mara', endpoints: ['/v1/chat/completions'] }, { id: 'ren-img', name: 'Aaa', endpoints: ['/v1/images/generations'] }] } });
    await job(ccSettings({ chat_completion_source: 'electronhub', electronhub_model: 'ren-gone' }), b, 0);
    assert.deepEqual(OAI.model_list.map(m => m.id), ['ren-1', 'ren-2']);
    assert.equal(OAI.oai_settings.electronhub_model, 'ren-1');
    await job(ccSettings({ chat_completion_source: 'electronhub', electronhub_model: 'ren-2' }), b, 1);
    assert.equal(OAI.oai_settings.electronhub_model, 'ren-2');
});

test('모델 보정의 문맥 · 온도 칸: onModelChange 뒷부분 그대로 (첫 모델의 문맥 크기로 깎고, 범위 칸이 값을 step 단위로 고쳐요: 0.705 → 0.71)', async () => {
    __naStatusReset();
    const w = bridge({ body: { data: [{ id: '@cf/ren/w-a', properties: [{ property_id: 'context_window', value: '4096' }] }, { id: '@cf/ren/w-b' }] } });
    await job(ccSettings({ chat_completion_source: 'workers_ai', workers_ai_model: 'ren-gone', workers_ai_account_id: 'ren-acct', openai_max_context: 8000, temp_openai: 4.7 }), w, 0);
    assert.deepEqual([OAI.oai_settings.workers_ai_model, OAI.oai_settings.openai_max_context, OAI.oai_settings.temp_openai], ['@cf/ren/w-a', 4096, 4.7]);
    const a = bridge({ body: { data: [{ id: 'ren/a1', type: 'chat-completion', info: { name: 'Ren A', contextLength: 900 } }] } });
    await job(ccSettings({ chat_completion_source: 'aimlapi', aimlapi_model: '', openai_max_context: 4000, temp_openai: 0.705, freq_pen_openai: 0.125, pres_pen_openai: -0.375 }), a, 0);
    assert.deepEqual([OAI.oai_settings.aimlapi_model, OAI.oai_settings.openai_max_context, OAI.oai_settings.temp_openai, OAI.oai_settings.freq_pen_openai, OAI.oai_settings.pres_pen_openai], ['ren/a1', 900, 0.71, 0.13, -0.37]);
    // (the slider's min: 512 — index.html 640)
    const c = bridge({ body: { data: [{ id: 'ren-c-1' }] } });
    await job(ccSettings({ chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:9/v1', custom_model: '', openai_max_context: 300, temp_openai: 2.5 }), c, 0);
    assert.deepEqual([OAI.oai_settings.openai_max_context, OAI.oai_settings.temp_openai], [512, 2]);
    // (OpenRouter's guard: a model not in the list is not taken — onModelChange returns before these lines)
    await job(ccSettings({ chat_completion_source: 'openrouter', openrouter_model: 'ren/gone', openai_max_context: 300 }), bridge({ body: { data: OR } }), 0);
    assert.equal(OAI.oai_settings.openai_max_context, 300);
});

test('NanoGPT 공급자: 그 모델이 공급자 고르기를 못 하면 실리처럼 비워요. 하면 그대로. 그 길이 없는 옛 다리면 그대로', async () => {
    __naStatusReset();
    const nano = (providers) => bridge((url) => (url === '/api/nanogpt/models/providers' ? (providers ? { body: providers } : { status: 404, body: 'Not Found' }) : { body: { data: [{ id: 'ren-n-1', name: 'Zed' }] } }));
    const s = ccSettings({ chat_completion_source: 'nanogpt', nanogpt_model: 'ren-n-1', nanogpt_provider: 'akash' });
    const no = nano({ supportsProviderSelection: false, providers: [] });
    await job(s, no, 0);
    assert.equal(OAI.oai_settings.nanogpt_provider, '');
    assert.deepEqual(no.calls.at(-1), { url: '/api/nanogpt/models/providers', body: JSON.stringify({ model: 'ren-n-1' }) });
    // (kept: asked once for the same model)
    await job(s, no, 1);
    assert.equal(no.calls.length, 2);
    assert.equal(OAI.oai_settings.nanogpt_provider, '');
    __naStatusReset();
    await job(s, nano({ supportsProviderSelection: true, providers: ['akash'] }), 0);
    assert.equal(OAI.oai_settings.nanogpt_provider, 'akash');
    __naStatusReset();
    await job(s, nano(null), 0);
    assert.equal(OAI.oai_settings.nanogpt_provider, 'akash');
});

test('키 확인: 그 소스의 키가 저장돼 있지 않으면 실리 연결 버튼처럼 연결하지 않아요(묻지 않음, 실리 창에 한 번). 키가 생기면 연결해요', async () => {
    __naStatusReset();
    const root = tmpRoot();
    const logs = [];
    let state = { api_key_openrouter: null };
    const b = bridge({ body: { data: OR } }, { secrets: () => state });
    const s = ccSettings({ chat_completion_source: 'openrouter', openrouter_model: 'ren/a' });
    for (let i = 0; i < 3; i++) { const r = await job(s, b, i, { root, log: t => logs.push(t) }); assert.equal(r.noKey, true); }
    assert.equal(b.calls.length, 0);
    assert.equal(SCRIPT.online_status, 'no_connection');
    assert.deepEqual(OAI.model_list, []);
    assert.deepEqual(logs, ['openrouter에 저장된 키가 없습니다.']);
    // (keyless: Custom · Pollinations anonymous. A proxy source with a proxy address — onConnectButtonClick 6089)
    await job(ccSettings({ chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:9/v1' }), b, 3, { root });
    await job(ccSettings({ chat_completion_source: 'pollinations', pollinations_endpoint: 'anonymous' }), b, 4, { root });
    await job(ccSettings({ chat_completion_source: 'openai', reverse_proxy: 'http://127.0.0.1:9/p' }, { proxies: [{ name: 'P', url: 'http://127.0.0.1:9/p', password: '' }], selected_proxy: { name: 'P', url: 'http://127.0.0.1:9/p', password: '' }, accountStorage: { [`Proxy_SkipConfirm_${getStringHash('http://127.0.0.1:9/p')}`]: 'true' } }), b, 5, { root });
    assert.equal(b.calls.length, 3);
    state = { api_key_openrouter: [{ id: 'k1', active: true }] };
    fs.writeFileSync(path.join(root, 'secrets.json'), JSON.stringify({ x: 'a key now' }));
    await job(s, b, 6, { root, log: t => logs.push(t) });
    assert.equal(b.calls.length, 4);
    assert.equal(SCRIPT.online_status, 'Valid');
    // (an older bridge — no key state —: checked as before)
    __naStatusReset();
    const old = bridge({ body: { data: OR } });
    await job(s, old, 0);
    assert.equal(old.calls.length, 1);
});

test('연결할 때의 {{user}}: 실리 페이지처럼 settings.json의 username (채팅을 열기 전이에요). 열쇠는 매크로를 풀기 전의 글이라 {{random}}이 있어도 다시 묻지 않아요', async () => {
    __naStatusReset();
    const b = bridge({ body: { data: [{ id: 'ren-c' }] } });
    const s = ccSettings({ chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:9/v1', custom_include_headers: 'X-Who: "{{user}}"\nX-Req: {{random:1,2,3,4,5,6,7,8,9}}{{random:a,b,c,d,e,f,g}}' }, { username: 'Ren' });
    for (let i = 0; i < 10; i++) await job(s, b, i * 1000);
    assert.equal(b.calls.length, 1);
    assert.match(JSON.parse(b.calls[0].body).custom_include_headers, /^X-Who: "Ren"\nX-Req: \d[a-g]$/);
    // (the user name is part of what the page connects with: changed, asked again)
    await job({ ...s, username: 'Varo' }, b, 11 * 1000);
    assert.equal(b.calls.length, 2);
    assert.match(JSON.parse(b.calls[1].body).custom_include_headers, /^X-Who: "Varo"/);
});

test('실리 창 로그: 열쇠마다 이유마다 한 번, 실리가 주는 이유로 — 200 {error:true}(키가 틀렸거나 공급자가 꺼짐) · Azure의 message · JSON이 아닌 답', async () => {
    __naStatusReset();
    const logs = [];
    const e1 = bridge({ body: { error: true, data: { data: [] } } });
    for (let i = 0; i < 6; i++) { await job(ccSettings({ chat_completion_source: 'openrouter' }), e1, i * HOUR, { log: t => logs.push(t) }); await __naStatusIdle(); }
    assert.ok(e1.calls.length > 1);
    const e2 = bridge({ status: 401, body: { error: true, message: 'Invalid API key or insufficient permissions.' } });
    await job(ccSettings({ chat_completion_source: 'azure_openai', azure_base_url: 'https://ren.example', azure_deployment_name: 'd', azure_api_version: '2024-10-21' }), e2, 0, { log: t => logs.push(t) });
    const e3 = bridge({ body: '<html>proxy error</html>' });
    await job(ccSettings({ chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:9/v1' }), e3, 0, { log: t => logs.push(t) });
    assert.deepEqual(logs, [
        '상태를 가져오는 중 오류가 발생했습니다: 채팅 완성 상태 확인에 실패했습니다. 액세스 토큰이 올바르지 않거나 API 엔드포인트가 꺼져 있습니다.',
        '상태를 가져오는 중 오류가 발생했습니다: API 키가 올바르지 않거나 권한이 부족합니다.',
        '상태를 가져오는 중 오류가 발생했습니다: 응답을 읽을 수 없습니다.',
    ]);
});

test('실리 로더의 처리 안 된 오류(이름 없는 모델)가 일꾼을 죽이지 않아요: 브라우저 콘솔처럼 실리 창에 한 번 적고, 값은 실리와 같아요', async () => {
    __naStatusReset();
    const unhandled = [], warned = [];
    const onRejection = err => unhandled.push(err);
    process.on('unhandledRejection', onRejection);
    const warn = console.warn;
    console.warn = (...a) => warned.push(a.join(' '));
    try {
        const b = bridge({ body: { data: [{ id: 'ren-mc-1', name: 'Zed' }, { id: 'ren-mc-2' }] } });
        const s = tgSettings({ type: 'mancer', mancer_model: 'ren-gone' });
        await job(s, b, 0);
        await job(s, b, 1);
        await new Promise(r => setImmediate(r));
        await new Promise(r => setTimeout(r, 20));
    } finally {
        console.warn = warn;
        process.off('unhandledRejection', onRejection);
    }
    assert.deepEqual(unhandled, []);
    assert.equal(warned.filter(x => x.includes('처리되지 않은 오류가 발생했습니다') && x.includes('localeCompare')).length, 1);
    // (getStatusTextgen 694: the status is the saved model, as in the browser)
    assert.equal(SCRIPT.online_status, 'ren-gone');
    // (a loader that is not async — loadGenericModels 607 —: given back as it is, the status as the browser's)
    __naStatusReset();
    await job(tgSettings({ type: 'generic', server_urls: { generic: 'http://127.0.0.1:9/v1' }, generic_model: 'ren-free-text' }), bridge({ body: { data: [{ id: 'ren-g-a' }] } }), 0);
    assert.equal(SCRIPT.online_status, 'ren-free-text');
});

test('시간 제한: 다리가 답하지 않으면 끊고 실패로 (1분 뒤에 다시)', async () => {
    __naStatusReset();
    const logs = [];
    const b = bridge((url, init) => new Promise((ok, no) => init.signal.addEventListener('abort', () => no(new Error('aborted')))));
    const r = await job(ccSettings({ chat_completion_source: 'openrouter' }), b, 0, { timeoutMs: 30, log: t => logs.push(t) });
    assert.equal(r.ok, false);
    assert.equal(SCRIPT.online_status, 'no_connection');
    assert.deepEqual(logs, ['상태를 가져오는 중 오류가 발생했습니다: 시간이 초과되었습니다.']);
});

test('던지지 않아요: 다리가 없어도 · 다리가 던져도. 주소가 없으면 묻지 않고 한 번만 알려요', async () => {
    __naStatusReset();
    const logs = [];
    await job(ccSettings({ chat_completion_source: 'openrouter' }), { send: null }, 0, { log: t => logs.push(t) });
    await job(ccSettings({ chat_completion_source: 'deepseek' }), bridge(new Error('socket hang up')), 0, { log: t => logs.push(t) });
    const b = bridge({ body: {} });
    for (let i = 0; i < 2; i++) await job(tgSettings({ type: 'ooba', server_urls: {} }), b, i, { log: t => logs.push(t) });
    assert.equal(b.calls.length, 0);
    assert.deepEqual(logs, ['상태를 가져오는 중 오류가 발생했습니다: 실리 서버에 연결할 수 없습니다.', '상태를 가져오는 중 오류가 발생했습니다: 실리 서버에 연결할 수 없습니다.', '상태를 확인할 주소가 없습니다.']);
    assert.equal(SCRIPT.online_status, 'no_connection');
});

test('채팅 완성 · 글 완성 · Kobold가 아닌 API(NovelAI)는 연결 확인을 하지 않아요: 페이지를 연 그대로', async () => {
    __naStatusReset();
    const b = bridge({ body: {} });
    const r = await job({ main_api: 'novel' }, b, 0);
    assert.equal(r.key, null);
    assert.equal(b.calls.length, 0);
    assert.equal(SCRIPT.online_status, 'no_connection');
});

test('실리 연결을 쓰지 않는 세계(skip): 묻지 않고 페이지를 연 그대로 — 앞 일의 연결이 남지 않아요', async () => {
    __naStatusReset();
    const b = bridge({ body: { data: OR } });
    const s = ccSettings({ chat_completion_source: 'openrouter' });
    await job(s, b, 0);
    assert.equal(SCRIPT.online_status, 'Valid');
    const r = await job(s, b, 1, { skip: true });
    assert.equal(r.skipped, true);
    assert.equal(b.calls.length, 1);
    assert.equal(b.secretCalls.length, 1);
    assert.equal(SCRIPT.online_status, 'no_connection');
    assert.deepEqual(OAI.model_list, []);
});

test('CometAPI(실리 화면에서 주석 처리된 소스): 실리처럼 소스가 "undefined"가 돼요 (loadOpenAISettings 4404 → 6969)', () => {
    naLoad(ccSettings({ chat_completion_source: 'cometapi' }));
    assert.equal(OAI.oai_settings.chat_completion_source, 'undefined');
    naLoad(ccSettings({ chat_completion_source: 'openrouter' }));
    assert.equal(OAI.oai_settings.chat_completion_source, 'openrouter');
});
