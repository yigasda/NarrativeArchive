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
test('그림 · 파일: 한 차례에 실어 준 것이 연결 방식마다 그 API의 모양으로 가요 (마리나라의 제공자 코드와 같은 순서)', async () => {
    const bodies = [];
    globalThis.fetch = async (url, init = {}) => { bodies.push(JSON.parse(init.body)); return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'hi' } }], content: [{ type: 'text', text: 'hi' }] }), clone() { return this; }, json: async () => ({ choices: [{ message: { content: 'hi' } }], content: [{ type: 'text', text: 'hi' }] }) }; };
    const PNG = 'data:image/png;base64,iVBORw0KGgo=', PDF = 'data:application/pdf;base64,JVBERi0=';
    const turn = [{ role: 'user', content: 'hello', images: [PNG], files: [{ type: 'application/pdf', data: PDF, filename: 'doc.pdf' }] }];
    const oa = { mode: 'custom', url: 'https://relay.example/v1', key: 'k', model: 'm' }, an = { mode: 'custom', url: 'https://relay.example', key: 'k', model: 'm', fmt: 'anthropic', leanHeaders: true };
    await AI.callConn(oa, 'S', turn, 256, '', true, true);
    assert.deepEqual(bodies[0].messages, [{ role: 'system', content: 'S' }, { role: 'user', content: [{ type: 'file', file: { filename: 'doc.pdf', file_data: PDF } }, { type: 'text', text: 'hello' }, { type: 'image_url', image_url: { url: PNG } }] }]);
    await AI.callConn(an, 'S', turn, 256, '', true, true);
    assert.deepEqual(bodies[1].messages, [{ role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' }, title: 'doc.pdf' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } }, { type: 'text', text: 'hello' }] }]);
    // (규칙을 첫 말 위에 얹는 요청도 그림을 잃지 않아요; 그림 없는 요청은 전과 같이 글만)
    await AI.callConn(oa, 'S', turn, 256, '', true, false);
    assert.equal(bodies[2].messages[0].content[1].text, '[INSTRUCTIONS]\nS\n[/INSTRUCTIONS]\n\nhello'); assert.equal(bodies[2].messages[0].content[2].image_url.url, PNG);
    await AI.callConn(oa, 'S', 'hello', 256, '', true, true);
    assert.deepEqual(bodies[3].messages, [{ role: 'system', content: 'S' }, { role: 'user', content: 'hello' }]);
    // (글 없이 그림만 있는 차례도 가요; 이어지는 같은 쪽 차례는 하나로)
    assert.deepEqual(AI.turnsOf([{ role: 'user', content: '', images: [PNG] }, { role: 'user', content: '둘' }]), [{ role: 'user', content: '둘', images: [PNG] }]);
    assert.deepEqual(AI.openAiTurn({ role: 'user', content: 'x', images: [PNG], files: [{ data: PDF }] }, false).content, [{ type: 'text', text: 'x' }, { type: 'image_url', image_url: { url: PNG } }]);   // (실리 서버로 가는 길: 그림만)
});
test('실리 연결 방식: 실리가 만든 요청({ generate_data … })을 그대로 보내고, 이 요청이 정한 값은 설정으로 넣어요', async () => {
    const seen = [], bodies = [];
    globalThis.document = { querySelectorAll: () => [] };
    globalThis.__naStOpenai = {
        oai_settings: { temp_openai: 1.2, top_p_openai: 0.5, openai_max_tokens: 9, freq_pen_openai: 0.7, reverse_proxy: 'p', custom_url: 'u', stream_openai: true },
        // (실리 1.19: 통을 돌려줘요. 모델에 따라 실리가 값을 빼기도 해요)
        createGenerationParameters: async (settings, model, type, messages) => { seen.push({ settings, model, type }); return { generate_data: { chat_completion_source: settings.chat_completion_source, model, messages, max_completion_tokens: settings.openai_max_tokens, custom_url: settings.custom_url, stop: ['x'], logit_bias: { a: 1 }, reasoning_effort: settings.reasoning_effort, include_reasoning: settings.show_thoughts, stream: true }, stream: false, canMultiSwipe: false }; },
    };
    globalThis.fetch = async (url, init = {}) => { bodies.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'hi', reasoning_content: 'hm' }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 2 } }) }; };
    try {
        const meta = {};
        const out = await AI.callConn({ mode: 'source', source: 'custom', stModel: 'fake-mini' }, 'S', 'hello', 256, 'high', true, false, null, 0.9, null, meta);
        assert.equal(out, 'hi');
        const b = bodies[0].body, st = seen[0].settings;
        assert.equal(bodies[0].url, '/api/backends/chat-completions/generate');
        assert.deepEqual([b.chat_completion_source, b.model, b.custom_url, b.max_completion_tokens, b.reasoning_effort, b.include_reasoning, b.stream], ['custom', 'fake-mini', 'u', 256, 'high', true, false]);
        assert.deepEqual([b.stop, b.logit_bias, b.max_tokens, b.temperature], [undefined, undefined, undefined, undefined]);   // (실리가 뺀 값을 다시 넣지 않아요)
        assert.deepEqual([st.temp_openai, st.top_p_openai, st.openai_max_tokens, st.freq_pen_openai, st.stream_openai, st.reverse_proxy, seen[0].type], [0.9, 1, 256, 0, false, 'p', 'quiet']);
        assert.deepEqual([meta.model, meta.provider, meta.thinking, meta.finishReason, meta.usage.promptTokens], ['fake-mini', 'custom', 'hm', 'stop', 3]);
        // (옛 실리: 요청 자체를 돌려줘도 돼요; 요청을 못 만들면 알려요)
        globalThis.__naStOpenai.createGenerationParameters = async (settings, model, type, messages) => ({ chat_completion_source: settings.chat_completion_source, model, messages });
        assert.equal(await AI.callConn({ mode: 'source', source: 'claude', stModel: 'c' }, 'S', 'hello', 256, '', true, false), 'hi');
        assert.equal(bodies[1].body.chat_completion_source, 'claude');
        globalThis.__naStOpenai.createGenerationParameters = async () => ({ stream: false });
        await assert.rejects(AI.callConn({ mode: 'source', source: 'claude', stModel: 'c' }, 'S', 'hello', 256, '', true, false), /요청을 만들지 못했/);
    } finally { delete globalThis.__naStOpenai; delete globalThis.document; }
});
