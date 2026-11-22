// src/stprofile.js: 실리가 연결 프로필로 보내려는 요청을 받아 두고(브라우저), 서버가 똑같이 채워 보내기. 예시 캐릭터만 써요.
import test from 'node:test';
import assert from 'node:assert/strict';
// (anything that is not the request being caught goes on as it is: counted here)
const passed = [];
globalThis.fetch = async (url, init) => { passed.push({ url, body: init?.body }); return new Response('{"choices":[{"message":{"content":"REAL"}}]}', { status: 200 }); };
const SP = await import('../src/stprofile.js');
const { fakeSt } = await import('./stfake.mjs');

const MSG = [{ role: 'system', content: 'GOAL\nYou are Mara.' }, { role: 'user', content: '[MESSENGER]\nRen: hey {{user}}' }];
const CC = { id: 'p1', name: 'My profile', api: 'openrouter', model: 'or/model', preset: 'Quiet', proxy: 'Home', 'secret-id': 'sec-1' };
const base = () => ({
    profiles: [CC],
    oai: { reverse_proxy: '', proxy_password: 'OAI-PW', custom_include_headers: '', chat_completion_source: 'openrouter', temp_openai: 1, openai_max_tokens: 300 },
    presets: { Quiet: { temp_openai: 0.7, openai_max_tokens: 900, chat_completion_source: 'openrouter', show_thoughts: true, reasoning_effort: 'low', reverse_proxy: 'https://preset.proxy', proxy_password: 'PRESET-PW' } },
    proxies: [{ name: 'Home', url: 'https://home.proxy', password: 'PROXY-PW' }],
});
const sendOf = (st, id, over = null) => (messages, max) => st.sendRequest(id, messages, max, { stream: false, extractData: true, includePreset: true, includeInstruct: true }, ...(over ? [over] : []));
const secretOf = (st, tpl) => key => SP.profileSecret(key, { proxy: tpl.proxy ? st.find.proxy(tpl.proxy) : null, preset: tpl.preset ? st.find.preset('openai', tpl.preset) : null, oai: st.find.oai });

test('채팅 완성 프로필: 실리가 만든 요청에서 메시지 · 비밀 칸만 빠진 틀. 서버가 채우면 실리가 보낼 것과 똑같아요. 진짜로는 안 보내요', async () => {
    const st = fakeSt(base()), over = { reasoning_effort: 'high', include_reasoning: true };
    passed.length = 0;
    const pt = await SP.profileTemplates({ send: sendOf(st, 'p1', over), profile: CC, over, find: st.find });
    assert.equal(passed.length, 0);                                                     // (모델에 아무것도 안 갔어요)
    assert.deepEqual(Object.keys(pt), [SP.ptKey('p1', over, '*')]);
    const tpl = Object.values(pt)[0];
    assert.deepEqual([tpl.api, tpl.url, tpl.proxy, tpl.preset, tpl.secrets, tpl.max], ['cc', SP.PT_URL.cc, 'Home', 'Quiet', ['proxy_password'], [['max_tokens']]]);
    assert.equal(tpl.data.messages, undefined);
    assert.doesNotMatch(JSON.stringify(pt), /PW/);                                       // (비밀번호는 안 담아요)
    assert.deepEqual(tpl.of, CC);
    assert.equal(SP.ptFind(pt, 'p1', over, MSG), tpl); assert.equal(SP.ptFind(pt, 'p1', null, MSG), null);
    // 서버: 진짜 메시지 · 답 길이 · 설정 파일의 비밀 칸 → 실리가 이 메시지로 보낼 몸통과 같아요
    const body = SP.fillProfileRequest(tpl, { messages: MSG, maxTokens: 4000, secret: secretOf(st, tpl) });
    assert.deepEqual(body, st.build('p1', MSG, 4000, over).body);
    assert.equal(JSON.stringify(body), JSON.stringify(st.build('p1', MSG, 4000, over).body));   // (같은 글: 칸의 순서까지)
    assert.equal(body.proxy_password, 'PROXY-PW');                                       // (프로필의 프록시가 이겨요)
    assert.equal(body.messages[1].content, '[MESSENGER]\nRen: hey {{user}}');           // (실리도 이 길에서는 매크로를 안 바꿔요)
    // 다른 요청은 그대로 나가요 (받아 두는 것은 자리표시가 든 요청뿐)
    await globalThis.fetch('/api/backends/chat-completions/generate', { method: 'POST', body: JSON.stringify({ messages: MSG }) });
    assert.equal(passed.length, 1);
});

test('비밀 칸을 채우는 순서: 프로필의 프록시 → 프리셋 → 실리 설정 (실리 코드의 순서 그대로)', async () => {
    const proxy = { url: 'u', password: 'X' };
    assert.equal(SP.profileSecret('proxy_password', { proxy, preset: { proxy_password: 'P' }, oai: { proxy_password: 'O' } }), 'X');
    assert.equal(SP.profileSecret('proxy_password', { proxy: { url: 'u' }, preset: { proxy_password: 'P' }, oai: { proxy_password: 'O' } }), 'P');
    assert.equal(SP.profileSecret('proxy_password', { proxy: null, preset: {}, oai: { proxy_password: 'O' } }), 'O');
    assert.equal(SP.profileSecret('custom_include_headers', { proxy, preset: null, oai: { custom_include_headers: 'H' } }), 'H');
    // 프록시 없는 프로필 · 프리셋의 프록시: 프리셋 비밀번호로
    const b = base(); b.profiles = [{ ...CC, proxy: undefined }];
    const st = fakeSt(b), pt = await SP.profileTemplates({ send: sendOf(st, 'p1'), profile: b.profiles[0], find: st.find }), tpl = Object.values(pt)[0];
    assert.equal(tpl.proxy, null);
    assert.equal(SP.fillProfileRequest(tpl, { messages: MSG, maxTokens: 10, secret: secretOf(st, tpl) }).proxy_password, 'PRESET-PW');
    assert.deepEqual(SP.fillProfileRequest(tpl, { messages: MSG, maxTokens: 10, secret: secretOf(st, tpl) }), st.build('p1', MSG, 10).body);
    // 프리셋도 프록시도 없으면: 비밀 칸이 없어요
    const c = base(); c.profiles = [{ id: 'p2', api: 'openrouter', model: 'm' }];
    const st2 = fakeSt(c), tpl2 = Object.values(await SP.profileTemplates({ send: sendOf(st2, 'p2'), profile: c.profiles[0], find: st2.find }))[0];
    assert.deepEqual([tpl2.secrets, tpl2.preset], [[], null]);
    assert.deepEqual(SP.fillProfileRequest(tpl2, { messages: MSG, maxTokens: 77, secret: () => 'nope' }), st2.build('p2', MSG, 77).body);
});

test('틀을 안 만드는 때: 요청마다 값이 달라짐 · 실리가 메시지를 고침 · 사용자 헤더의 매크로 · 요청을 못 만듦 (이유를 알려요)', async () => {
    const run = async (more, profile = CC) => { const st = fakeSt({ ...base(), ...more }); return SP.profileTemplates({ send: sendOf(st, profile.id), profile, find: st.find }); };
    await assert.rejects(run({ random: true }), e => e.refusal && /요청마다 값이 달라져서/.test(e.message));
    await assert.rejects(run({ mangle: true }), e => e.refusal && /메시지를 고쳐 보내서/.test(e.message));
    const custom = { id: 'c1', api: 'custom', model: 'm', preset: 'Custom' };
    await assert.rejects(run({ profiles: [custom], presets: { Custom: { chat_completion_source: 'custom', custom_url: 'http://x', custom_include_headers: 'X-Who: {{user}}' } } }, custom), e => e.refusal && /custom_include_headers에 매크로/.test(e.message));
    // (매크로가 없는 사용자 헤더는 틀에서 빼고 서버가 채워요)
    const st = fakeSt({ ...base(), profiles: [custom], presets: { Custom: { chat_completion_source: 'custom', custom_url: 'http://x', custom_include_headers: 'X-Key: SECRET' } } });
    const tpl = Object.values(await SP.profileTemplates({ send: sendOf(st, 'c1'), profile: custom, find: st.find }))[0];
    assert.deepEqual(tpl.secrets, ['custom_include_headers']); assert.doesNotMatch(JSON.stringify(tpl), /SECRET/);
    assert.deepEqual(SP.fillProfileRequest(tpl, { messages: MSG, maxTokens: 5, secret: secretOf(st, tpl) }), st.build('c1', MSG, 5).body);
    assert.throws(() => SP.fillProfileRequest(tpl, { messages: MSG, maxTokens: 5, secret: () => 'X: {{char}}' }), /매크로/);
    await assert.rejects(SP.profileTemplates({ send: async () => { throw new Error('API request failed', { cause: new Error('Preset broke') }); }, profile: CC, find: {} }), e => e.refusal && /요청을 만들지 못했어요 \(Preset broke\)/.test(e.message));
    await assert.rejects(SP.profileTemplates({ send: async () => 'nothing sent', profile: CC, find: {} }), e => e.refusal && /요청을 보내지 않았어요/.test(e.message));
});

test('글 완성 프로필: 지시 형식이 감싼 글 속 자리 · 모양마다 틀. 답은 실리처럼 멈춤 글을 잘라요', async () => {
    const ins = { system_sequence: '### System:', input_sequence: '### Instruction:', output_sequence: '### Response:', stop_sequence: '</s>', last_output_sequence: '' };
    const TC = { id: 't1', mode: 'tc', api: 'koboldcpp', model: 'k', 'api-url': 'http://127.0.0.1:5001', preset: 'Kobold', instruct: 'Alpaca' };
    const st = fakeSt({ profiles: [TC], instructs: { Alpaca: ins }, tcPresets: { Kobold: { genamt: 350, temp: 0.8 } } });
    passed.length = 0;
    const pt = await SP.profileTemplates({ send: sendOf(st, 't1'), profile: TC, find: st.find });
    assert.equal(passed.length, 0);
    assert.deepEqual(Object.keys(pt).sort(), [SP.ptKey('t1', null, 'su'), SP.ptKey('t1', null, 'u')].sort());
    const su = pt[SP.ptKey('t1', null, 'su')], u = pt[SP.ptKey('t1', null, 'u')];
    assert.equal(su.api, 'tc'); assert.ok(su.prompt.includes(SP.PT_TOKEN.system) && su.prompt.includes(SP.PT_TOKEN.user)); assert.ok(!u.prompt.includes(SP.PT_TOKEN.system));
    assert.deepEqual(su.max.map(p => p.join('.')).sort(), ['max_new_tokens', 'max_tokens']);
    assert.deepEqual(su.instruct, { stop_sequence: '</s>', input_sequence: '### Instruction:', output_sequence: '### Response:', last_output_sequence: '' });
    assert.deepEqual(SP.fillProfileRequest(su, { messages: MSG, maxTokens: 4000 }), st.build('t1', MSG, 4000).body);
    assert.equal(JSON.stringify(SP.fillProfileRequest(su, { messages: MSG, maxTokens: 4000 })), JSON.stringify(st.build('t1', MSG, 4000).body));
    const one = [{ role: 'user', content: 'just text $& $1' }];
    assert.equal(SP.ptFind(pt, 't1', null, one), u);
    assert.deepEqual(SP.fillProfileRequest(u, { messages: one, maxTokens: 9 }), st.build('t1', one, 9).body);
    assert.equal(SP.ptFind(pt, 't1', null, [{ role: 'user', content: [{ type: 'text', text: 'x' }] }]), null);   // (그림이 든 요청은 글 완성 틀이 없어요)
    // 답 읽기 (실리의 custom-request.js 331–382)
    const body = SP.fillProfileRequest(su, { messages: MSG, maxTokens: 4000 });
    const read = text => SP.readProfileAnswer(su, body, { choices: [{ text }] }).content;
    assert.equal(read('{"reply":["hi"]}   \n### Instruction: more'), '{"reply":["hi"]}\n');
    assert.equal(read('{"reply":["hi"]}\n###'), '{"reply":["hi"]}');                     // (끝에 걸린 멈춤 글의 앞부분)
    assert.equal(read('### Response:\n{"a":1}</s>tail'), '\n{"a":1}');
    assert.throws(() => SP.readProfileAnswer(su, body, { error: { message: 'busy' } }), /busy/);
    assert.throws(() => SP.readProfileAnswer(su, body, {}, { ok: false }), /Response not OK/);
    // (글의 길이가 요청에 들어가는 연결: 서버가 다른 길이의 글로 채우면 달라지니 틀을 안 만들어요)
    const st2 = fakeSt({ profiles: [TC], instructs: { Alpaca: ins }, counted: true });
    await assert.rejects(SP.profileTemplates({ send: sendOf(st2, 't1'), profile: TC, find: st2.find }), e => e.refusal && /글의 길이에 따라/.test(e.message));
});

test('실리에서 옮긴 답 읽기: 채팅 완성 · 글 완성의 모양, 생각 글은 실리의 지금 연결의 모양으로', () => {
    assert.equal(SP.extractMessageFromData({ choices: [{ message: { content: 'a' } }] }, 'openai'), 'a');
    assert.equal(SP.extractMessageFromData({ content: [{ type: 'thinking', thinking: 't' }, { type: 'text', text: 'b' }, { type: 'text', text: 'c' }] }, 'openai'), 'b\n\nc');
    assert.equal(SP.extractMessageFromData({ choices: [{ text: 'tc' }] }, 'textgenerationwebui'), 'tc');
    assert.equal(SP.extractMessageFromData({ content: 'llama' }, 'textgenerationwebui'), 'llama');
    assert.equal(SP.extractReasoningFromData({ choices: [{ message: { reasoning: 'r' } }] }, { mainApi: 'openai', chatCompletionSource: 'openrouter', ignoreShowThoughts: true }), 'r');
    assert.equal(SP.extractReasoningFromData({ choices: [{ message: { reasoning: 'r' } }] }, { mainApi: 'openai', chatCompletionSource: 'openrouter' }), '');
    assert.equal(SP.extractReasoningFromData({ thinking: 'o' }, { mainApi: 'textgenerationwebui', textGenType: 'ollama' }), 'o');
    const tpl = { api: 'cc' };
    assert.deepEqual(SP.readProfileAnswer(tpl, { chat_completion_source: 'openrouter' }, { choices: [{ message: { content: 'x', reasoning_content: 'why' } }] }, { oaiSource: 'deepseek' }), { content: 'x', reasoning: 'why' });
});
