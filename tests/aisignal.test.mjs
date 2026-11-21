// 생성 중지: 멈추라는 신호(AbortSignal)가 모델 요청까지 가서 요청 자체를 끊어요 (src/ai.js)
import test from 'node:test';
import assert from 'node:assert/strict';

import { readFile } from 'node:fs/promises';

// (ai.js as it is, with what it imports stood in for: nothing here needs the settings or the screen)
const src = (await readFile(new URL('../src/ai.js', import.meta.url), 'utf8')).replace(/^import [^;]+;\n/gm, '');
const stubs = `const ctx=()=>({getRequestHeaders:()=>({})});const globalSettings=()=>({});const saveGlobal=()=>{};const MODULE='x';const toastr={info(){},warning(){},error(){}};`;
const AI = await import('data:text/javascript;base64,' + Buffer.from(stubs + src).toString('base64'));

function fakeFetch() {
    const seen = [];
    globalThis.fetch = (url, init = {}) => new Promise((ok, no) => {
        seen.push({ url, signal: init.signal });
        if (init.signal?.aborted) return no(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        init.signal?.addEventListener('abort', () => no(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        if (!init.signal) ok({ ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'hi' } }], content: [{ type: 'text', text: 'hi' }] }), clone() { return this; }, json: async () => ({ choices: [{ message: { content: 'hi' } }] }) });
    });
    return seen;
}
for (const [name, t] of [['OpenAI 형식', { mode: 'custom', url: 'https://relay.example/v1', key: 'k', model: 'm' }], ['Anthropic 형식', { mode: 'custom', url: 'https://relay.example', key: 'k', model: 'm', fmt: 'anthropic', leanHeaders: true }], ['Vertex', { mode: 'vertex', vxModel: 'gemini-x' }]]) {
    test(`${name}: 신호가 요청에 실려 가고, 멈추면 요청이 끊겨요 (연결 오류 글로 바뀌지 않아요)`, async () => {
        const seen = fakeFetch(), stop = new AbortController();
        const call = AI.callConn(t, 'SYS', 'hello', 256, '', false, false, stop.signal);
        await new Promise(r => setTimeout(r, 5));
        assert.equal(seen.length, 1);
        assert.equal(seen[0].signal, stop.signal);
        stop.abort();
        const err = await call.catch(e => e);
        assert.equal(err.name, 'AbortError');
        assert.equal(seen.length, 1);                    // 다시 보내지 않아요
    });
}
test('온도: 요청마다 준 온도가 실려 가요. 안 주면 전과 같아요(0.3)', async () => {
    const bodies = [];
    globalThis.fetch = async (url, init = {}) => { bodies.push(JSON.parse(init.body)); return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'hi' } }], content: [{ type: 'text', text: 'hi' }] }), clone() { return this; }, json: async () => ({ choices: [{ message: { content: 'hi' } }] }) }; };
    const oa = { mode: 'custom', url: 'https://relay.example/v1', key: 'k', model: 'm' }, an = { mode: 'custom', url: 'https://relay.example', key: 'k', model: 'm', fmt: 'anthropic', leanHeaders: true };
    await AI.callConn(oa, 'S', 'hello', 256, '', true, false, null, 0.9);
    await AI.callConn(oa, 'S', 'hello', 256, '', true, false);
    await AI.callConn(an, 'S', 'hello', 256, '', true, false, null, 0.45);
    await AI.callConn(an, 'S', 'hello', 256, '', true, false);
    await AI.callConn(an, 'S', 'hello', 256, 'low', true, false, null, 0.45);      // (생각을 시키는 요청에는 온도를 안 실어요)
    assert.deepEqual(bodies.map(b => b.temperature), [0.9, 0.3, 0.45, undefined, undefined]);
});
test('topP: 준 값이 실려 가요 (1까지, 음수 · 안 준 것은 안 실어요). Anthropic에는 온도가 없고 1보다 작을 때만', async () => {
    const bodies = [];
    globalThis.fetch = async (url, init = {}) => { bodies.push(JSON.parse(init.body)); return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'hi' } }], content: [{ type: 'text', text: 'hi' }] }), clone() { return this; }, json: async () => ({ choices: [{ message: { content: 'hi' } }], content: [{ type: 'text', text: 'hi' }] }) }; };
    const oa = { mode: 'custom', url: 'https://relay.example/v1', key: 'k', model: 'm' }, an = { mode: 'custom', url: 'https://relay.example', key: 'k', model: 'm', fmt: 'anthropic', leanHeaders: true };
    await AI.callConn(oa, 'S', 'hello', 256, '', true, false, null, 0.2, 1);
    await AI.callConn(oa, 'S', 'hello', 256, '', true, false, null, 0.2, 1.7);
    await AI.callConn(oa, 'S', 'hello', 256, '', true, false, null, 0.2, -1);
    await AI.callConn(oa, 'S', 'hello', 256, '', true, false, null, 0.2);
    await AI.callConn(an, 'S', 'hello', 256, '', true, false, null, 0.2, 1);
    await AI.callConn(an, 'S', 'hello', 256, '', true, false, null, null, 0.8);
    await AI.callConn(an, 'S', 'hello', 256, '', true, false, null, 0.2, 0.8);
    assert.deepEqual(bodies.map(b => b.top_p), [1, 1, undefined, undefined, undefined, 0.8, undefined]);
});
