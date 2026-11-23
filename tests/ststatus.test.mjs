// 서버의 연결 확인(plugin/st/nastatus.js: 실리 1.19.1 getStatusOpen · getStatusTextgen · getStatusKobold를 옮긴 것 + 상태 답 캐시).
// 1) 기대값(tests/fixtures/ststatus-expected.json)은 실리 1.19.1 브라우저가 자기 연결 버튼으로 연결한 뒤 들고 있던 것과 그 뒤에 만든 요청이에요:
//    tools/st/oracle-status.mjs가 진짜 실리 · 가짜 공급자로 만들고 그 자리에서 서버 것과 대 봐요. 실리 서버가 준 답(calls)도 그때 것이에요. 지어낸 값이 아니에요.
// 2) 캐시 규칙: 가짜 다리(send)와 시계로. 예시 캐릭터만.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CASES, callKey } from './ststatus.cases.mjs';
import { runCase } from './ststatus.run.mjs';
import { naLoad } from '../plugin/st/naload.js';
import { naStatus, __naStatusReset, STATUS_OK_MS, STATUS_FAIL_MS } from '../plugin/st/nastatus.js';
import * as SCRIPT from '../plugin/st/public/script.js';
import * as OAI from '../plugin/st/public/scripts/openai.js';
import * as TG from '../plugin/st/public/scripts/textgen-settings.js';
import * as TGM from '../plugin/st/public/scripts/textgen-models.js';
import { __naSetFetch, naFetchFailures } from '../plugin/st/public/naFetch.js';

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
// a bridge to SillyTavern's own status handler, answering what answer(url, init, n) says
function bridge(answer) {
    const calls = [];
    const send = async (url, init) => {
        calls.push({ url, body: init?.body ?? null });
        const a = typeof answer === 'function' ? await answer(url, init, calls.length) : answer;
        if (a instanceof Error) throw a;
        return new Response(typeof a.body === 'string' ? a.body : JSON.stringify(a.body), { status: a.status ?? 200, headers: { 'Content-Type': 'application/json', ...(a.headers || {}) } });
    };
    return { send, calls };
}
const ccSettings = oai => ({ main_api: 'openai', oai_settings: { preset_settings_openai: 'Default', ...oai } });
const tgSettings = tg => ({ main_api: 'textgenerationwebui', textgenerationwebui_settings: tg });
// one worker job: settings.json read, then the connection (plugin/work.mjs withWorld)
async function job(settings, b, t, o = {}) {
    naLoad(structuredClone(settings));
    return naStatus({ send: b.send, now: () => t, ...o });
}
const MIN = 60 * 1000;

test('캐시: 설정이 그대로면 30분 동안 다시 묻지 않고, 30분이 지나면 다시 물어요. 정렬은 일마다 받아 둔 답으로', async () => {
    __naStatusReset();
    const b = bridge({ body: { data: OR } });
    const s = ccSettings({ chat_completion_source: 'openrouter', openrouter_model: 'ren/a' });
    await job(s, b, 0);
    assert.equal(b.calls.length, 1);
    assert.deepEqual(b.calls[0], { url: '/api/backends/chat-completions/status', body: JSON.stringify({ reverse_proxy: '', proxy_password: '', chat_completion_source: 'openrouter' }) });
    assert.deepEqual(OAI.model_list.map(m => m.id), ['ren/a', 'ren/b']);
    assert.equal(SCRIPT.online_status, 'Valid');
    await job(s, b, STATUS_OK_MS - 1);
    assert.equal(b.calls.length, 1);
    // (sort_models is not part of the key: the kept reply is sorted again — openai.js sortModelsBy)
    await job({ ...s, oai_settings: { ...s.oai_settings, sort_models: 'context_length' } }, b, 5 * MIN);
    assert.equal(b.calls.length, 1);
    assert.deepEqual(OAI.model_list.map(m => m.id), ['ren/b', 'ren/a']);
    await job(s, b, STATUS_OK_MS + 1);
    assert.equal(b.calls.length, 2);
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

test('캐시 열쇠: 그 사용자의 secrets.json이 바뀌면(키를 저장함) 다시 물어요', async () => {
    __naStatusReset();
    const root = tmpRoot();
    const b = bridge({ body: { data: OR } });
    const s = ccSettings({ chat_completion_source: 'openrouter' });
    await job(s, b, 0, { root });
    fs.writeFileSync(path.join(root, 'secrets.json'), JSON.stringify({ api_key_openrouter: [{ id: '1', value: 'na-test-not-a-key', active: true }] }));
    await job(s, b, 1, { root });
    await job(s, b, 2, { root });
    assert.equal(b.calls.length, 2);
    fs.writeFileSync(path.join(root, 'secrets.json.tmp'), JSON.stringify({ api_key_openrouter: [{ id: '2', value: 'na-test-other', active: true }] }));
    fs.renameSync(path.join(root, 'secrets.json.tmp'), path.join(root, 'secrets.json'));
    await job(s, b, 3, { root });
    assert.equal(b.calls.length, 3);
});

test('실패는 1분 뒤에 다시 물어요 (그 사이에는 묻지 않아요). 실리 창에는 한 번만', async () => {
    __naStatusReset();
    const logs = [];
    const b = bridge({ status: 500, body: 'Internal Server Error' });
    const s = ccSettings({ chat_completion_source: 'openrouter' });
    await job(s, b, 0, { log: t => logs.push(t) });
    assert.equal(SCRIPT.online_status, 'no_connection');
    await job(s, b, STATUS_FAIL_MS - 1, { log: t => logs.push(t) });
    assert.equal(b.calls.length, 1);
    await job(s, b, STATUS_FAIL_MS + 1, { log: t => logs.push(t) });
    assert.equal(b.calls.length, 2);
    assert.deepEqual(logs, ['상태를 가져오는 중 오류가 발생했습니다: /api/backends/chat-completions/status (500)']);
});

test('Azure는 성공하면 설정이 바뀔 때까지 다시 묻지 않아요 (상태 확인이 진짜 생성 요청이라 돈이 들어요). 모델은 목록의 것', async () => {
    __naStatusReset();
    const b = bridge({ body: { data: [{ id: 'ren-azure-4' }] } });
    const s = ccSettings({ chat_completion_source: 'azure_openai', azure_base_url: 'https://ren.example', azure_deployment_name: 'ren-dep', azure_api_version: '2024-10-21', azure_openai_model: 'ren-saved' });
    await job(s, b, 0);
    await job(s, b, 5 * 60 * MIN);
    assert.equal(b.calls.length, 1);
    assert.equal(OAI.oai_settings.azure_openai_model, 'ren-azure-4');
    await job({ ...s, oai_settings: { ...s.oai_settings, azure_deployment_name: 'ren-dep-2' } }, b, 5 * 60 * MIN + 1);
    assert.equal(b.calls.length, 2);
});

test('옛 다리(상태 길이 404): 실패와 같아요. 열쇠마다 실리 창에 한 번만, 요청은 지금처럼 만들어요(막지 않아요)', async () => {
    __naStatusReset();
    const logs = [];
    const b = bridge({ status: 404, body: 'Not Found' });
    const s = ccSettings({ chat_completion_source: 'openrouter', openrouter_model: 'ren/a' });
    for (let i = 0; i < 3; i++) await job(s, b, i * 2 * MIN, { log: t => logs.push(t) });
    await job(tgSettings({ type: 'ooba', server_urls: { ooba: 'http://127.0.0.1:5000' } }), b, 10 * MIN, { log: t => logs.push(t) });
    await job(tgSettings({ type: 'ooba', server_urls: { ooba: 'http://127.0.0.1:5000' } }), b, 13 * MIN, { log: t => logs.push(t) });
    assert.deepEqual(logs, [
        '실리 서버의 /api/backends/chat-completions/status를 쓸 수 없습니다. 서버 플러그인을 업데이트하고 실리를 다시 시작하세요.',
        '실리 서버의 /api/backends/text-completions/status를 쓸 수 없습니다. 서버 플러그인을 업데이트하고 실리를 다시 시작하세요.',
    ]);
    assert.equal(SCRIPT.online_status, 'no_connection');
    // (nothing of the failed status stays to stop the request: the same request as before)
    assert.deepEqual(naFetchFailures, []);
    await job(s, b, 14 * MIN, { log: t => logs.push(t) });
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
    const r = await job(s, b, STATUS_OK_MS + 1);
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
    assert.deepEqual(logs, ['상태를 가져오는 중 오류가 발생했습니다: 실리 서버에 연결할 수 없습니다.', '상태를 가져오는 중 오류가 발생했습니다: socket hang up', '상태를 확인할 주소가 없습니다.']);
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
