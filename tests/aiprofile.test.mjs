// AI 기능 모델이 실리 쪽('st')일 때: Orbit의 요청(profileNow)은 실리에서 지금 고른 연결 프로필로 (src/ai.js askAI · aiProfileFor).
// 서버 플러그인이 실리를 닫은 동안에도 같은 요청을 보낼 수 있게 (docs/PHONE2-PLAN.md 3-2c). 그 밖의 요청은 전과 같아요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = (await readFile(new URL('../src/ai.js', import.meta.url), 'utf8')).replace(/^import [^;]+;\n/gm, '');
const stubs = 'const ctx=()=>globalThis.__T.ctx;const globalSettings=()=>globalThis.__T.g;const saveGlobal=()=>{};const MODULE="x";const toastr={info(){},warning(){},error(){}};';
const AI = await import('data:text/javascript;base64,' + Buffer.from(stubs + src).toString('base64'));

const P = [{ id: 'p1', name: 'One', api: 'openrouter' }, { id: 'p2', name: 'Two', api: 'claude' }];
function setup({ aiProfile = '', selected = null, server = false, fallback = '' } = {}) {
    const calls = [];
    const ctx = {
        ...(server ? { naServer: true } : {}),
        extensionSettings: { connectionManager: { profiles: P, selectedProfile: selected } },
        ConnectionManagerRequestService: { getSupportedProfiles: () => P, sendRequest: async (...a) => { calls.push(['profile', ...a]); return { content: `via ${a[0]}` }; } },
        ...(server ? {} : { generateRaw: async o => { calls.push(['raw', o]); return 'via raw'; } }),
    };
    globalThis.__T = { ctx, g: { aiConn: { mode: 'st' }, aiProfile, fallback, draftConn: { mode: 'custom', url: 'https://relay.example/v1', key: 'k', model: 'm' } } };
    return calls;
}

test('Orbit의 요청: 실리에서 지금 고른 프로필로. 그 밖의 요청은 전처럼 실리의 지금 연결로', async () => {
    let calls = setup({ selected: 'p2' });
    assert.equal(await AI.askAI('hello', { system: 'SYS', maxTokens: 4000, profileNow: true }), 'via p2');
    assert.deepEqual(calls[0], ['profile', 'p2', [{ role: 'system', content: 'SYS' }, { role: 'user', content: 'hello' }], 4000, { stream: false, extractData: true, includePreset: true, includeInstruct: true }]);
    assert.equal(await AI.askAI('hello', { system: 'SYS', maxTokens: 4000 }), 'via raw');
    assert.deepEqual(calls[1], ['raw', { prompt: 'hello', systemPrompt: 'SYS', responseLength: 4000 }]);
    assert.deepEqual(AI.aiProfileFor({ profileNow: true }), { id: 'p2', profile: P[1] }); assert.equal(AI.aiProfileFor(), null);
    // 고른 프로필이 없거나 목록에 없으면: 실리의 지금 연결
    for (const selected of [null, '', 'gone']) {
        calls = setup({ selected });
        assert.equal(await AI.askAI('hi', { profileNow: true }), 'via raw');
        assert.equal(AI.aiProfileFor({ profileNow: true }), null);
    }
    // 여기서(⚙ 설정) 고른 프로필은 전처럼 늘 먼저
    calls = setup({ aiProfile: 'p1', selected: 'p2' });
    assert.equal(await AI.askAI('hi', { profileNow: true }), 'via p1');
    assert.equal(await AI.askAI('hi'), 'via p1');
    setup({ aiProfile: 'gone', selected: 'p2' });
    await assert.rejects(AI.askAI('hi', { profileNow: true }), /고른 연결 프로필을 찾을 수 없어요/);
    assert.deepEqual(AI.aiProfileFor({ profileNow: true }), { id: 'gone', profile: null });
});

test('서버 플러그인: 고른 프로필이 있으면 그것으로, 없으면 실리의 지금 연결은 못 쓴다고 알려요', async () => {
    let calls = setup({ selected: 'p1', server: true });
    assert.equal(await AI.askAI('hi', { profileNow: true }), 'via p1');
    calls = setup({ server: true });
    await assert.rejects(AI.askAI('hi', { profileNow: true }), /실리의 연결 관리자에서 프로필을 하나 골라 주세요/);
    assert.equal(calls.length, 0);
});

test('초안 모델이 막혀 AI 기능 모델로 다시 보낼 때도 Orbit의 요청이면 지금 고른 프로필로 (askCompress · askDraft)', async () => {
    const calls = setup({ selected: 'p2', fallback: 'ai' });
    globalThis.fetch = async () => ({ ok: false, status: 400, text: async () => 'blocked by content policy', clone() { return this; } });
    const warn = console.warn; console.warn = () => {};
    try {
        assert.equal(await AI.askCompress('text', { system: 'S', profileNow: true }), 'via p2');
        assert.equal(await AI.askDraft('text', { system: 'S' }), 'via raw');
    } finally { console.warn = warn; }
    assert.deepEqual(calls.map(c => [c[0], c[1] === 'p2' ? 'p2' : '']), [['profile', 'p2'], ['raw', '']]);
});

test('프로필 요청에 얹는 추론 레벨: 서버에서는 브라우저가 실리 코드로 만든 값을 받아요 (levelPayload)', async () => {
    globalThis.__naStOpenai = { levelPayload: (s, m, e) => ({ reasoning_effort: `${s}/${m}/${e}`, include_reasoning: true }), createGenerationParameters: () => { throw new Error('not here'); } };
    try { assert.deepEqual(await AI.stLevelPayload('claude', 'c-1', 'high'), { reasoning_effort: 'claude/c-1/high', include_reasoning: true }); }
    finally { delete globalThis.__naStOpenai; }
});
