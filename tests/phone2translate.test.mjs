// 마리나라의 번역 (src/marinara/translation.service.js · translation.store.js · use-translate.js · translate-text.js ·
// draft-translation.js · use-translator-defaults.js · translator-defaults.js · translation-prompt.js · quote-format.js)과
// 그것을 Orbit에 잇는 src/phone2translate.js. 모델 · 구글은 가짜 fetch예요 (진짜로는 아무것도 안 보내요).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import * as L from '../src/phone2store.js';
import { normalizeTranslatorSettings, getChatTranslationConfig, TRANSLATOR_SETTINGS_KEYS, TRANSLATOR_DEFAULTS_SETTINGS_KEY } from '../src/marinara/translator-defaults.js';
import { DEFAULT_TRANSLATION_SYSTEM_PROMPT, resolveTranslationSystemPrompt } from '../src/marinara/translation-prompt.js';
import { translateText, translateGeneratedMessage, validateTranslateInput } from '../src/marinara/translation.service.js';
import { formatTextQuotes } from '../src/marinara/quote-format.js';

// ---- the real src/ai.js (its imports stubbed, as tests/aiprofile.test.mjs does), and phone2translate.js on it
const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const href = f => pathToFileURL(new URL(`../src/${f}`, import.meta.url).pathname).href;
const aiSrc = (await readFile(new URL('../src/ai.js', import.meta.url), 'utf8')).replace(/^import [^;]+;\n/gm, '');
const AI_URL = encoded('const ctx=()=>globalThis.__TR.ctx;const globalSettings=()=>globalThis.__TR.g;const saveGlobal=()=>{};const MODULE="narrative_archive";const toastr={info(){},warning(){},error(){}};' + aiSrc);
const CORE_URL = encoded(`export const MODULE='narrative_archive';export const ctx=()=>globalThis.__TR.ctx;export const globalSettings=()=>globalThis.__TR.g;export const saveMeta=async()=>{const T=globalThis.__TR;T.saves=(T.saves||0)+1;if(T.saveFail){const e=T.saveFail;T.saveFail=null;throw e;}};`);
const map = { './core.js': CORE_URL, './ai.js': AI_URL, './phone2store.js': href('phone2store.js'), './phone2sched.js': href('phone2sched.js') };
for (const f of ['translation.service.js', 'translator-defaults.js', 'translation-prompt.js', 'translation.store.js', 'use-translate.js', 'translate-text.js', 'draft-translation.js', 'use-translator-defaults.js', 'quote-format.js', 'token-estimator.js']) map[`./marinara/${f}`] = href(`marinara/${f}`);
const TR = await import(encoded((await readFile(new URL('../src/phone2translate.js', import.meta.url), 'utf8')).replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || k}'`)));
const { useTranslationStore } = await import(href('marinara/translation.store.js'));
const UT = await import(href('marinara/use-translate.js'));

const T = (globalThis.__TR = { ctx: {}, g: {} });
// a fake fetch: Google answers its gtx shape, a custom API its chat/completions shape. Every request is kept
const sent = [];
const gtx = text => JSON.stringify([[[`<${text}>`, text, null, null, 10]], null, 'en']);
const DEFAULT_ANSWER = (url, init) => (String(url).startsWith('https://translate.googleapis.com/') ? new Response(gtx(new URL(url).searchParams.get('q'))) : new Response(JSON.stringify({ choices: [{ message: { content: '  번역된 글  ' }, finish_reason: 'stop' }] })));
let answer = DEFAULT_ANSWER;
globalThis.fetch = async (url, init = {}) => { sent.push({ url: String(url), init }); return answer(url, init); };
const toasts = [];
globalThis.toastr = { error: t => toasts.push(['error', t]), success: t => toasts.push(['success', t]), info() {}, warning() {} };

function setup({ meta = {}, g = {}, settings = {} } = {}) {
    const real = { phones: {} };
    T.ctx = { extensionSettings: { narrative_archive: { ...settings } }, saveSettingsDebounced: () => { T.settingsSaves = (T.settingsSaves || 0) + 1; }, chatMetadata: { narrative_archive: real }, ConnectionManagerRequestService: { getSupportedProfiles: () => [], sendRequest: async (...a) => { T.profileCalls = [...(T.profileCalls || []), a]; return { content: 'via profile' }; } } };
    T.g = { tr: { mode: 'same' }, draftConn: { mode: 'custom', url: 'https://relay.example/v1', key: 'k', model: 'draft-model' }, aiConn: { mode: 'st' }, aiMaxTokens: 8192, ...g };
    T.saves = 0; T.settingsSaves = 0; delete T.profileCalls;
    L.startFresh(real, { persona: 'Ren', scope: 'test' });
    const w = L.liveWorld(real);
    w.phones = { mara: { owner: 'Mara' } };
    w.presence = { meta: { ...meta } };
    const room = L.ensureRoom(real, ['Mara']);
    const say = (from, text, at, extra) => { const x = { id: `m${room.messages.length}`, n: L.liveNo(w), from, text, at, ...(extra ? { extra } : {}) }; room.messages.push(x); return x; };
    sent.length = 0; toasts.length = 0; answer = DEFAULT_ANSWER;
    useTranslationStore.getState().clearAll();
    useTranslationStore.getState().setConfig({ provider: 'google', inputTargetLanguage: 'en', outputTargetLanguage: 'en' });
    return { real, w, room, say };
}

// ---- 1. 설정 (translator-defaults.ts · defaults.ts): DeepL · DeepLX는 없어요
test('번역 설정 열쇠 · 고르기: 마리나라의 것에서 DeepL · DeepLX만 빠져요. 모르는 제공자(옛 deepl도)는 마리나라처럼 버려서 Google', () => {
    assert.deepEqual(TRANSLATOR_SETTINGS_KEYS, ['translationProvider', 'translationConnectionId', 'translationTargetLang', 'translationInputTargetLang', 'translationOutputTargetLang', 'translationPrompt', 'translationInputPrompt', 'translationOutputPrompt', 'autoTranslate', 'translateInput', 'showInputTranslateButton', 'translationDisplayOnly']);
    assert.equal(TRANSLATOR_DEFAULTS_SETTINGS_KEY, 'translator-defaults');
    for (const p of ['deepl', 'deeplx', 'bing', 1]) assert.equal(normalizeTranslatorSettings({ translationProvider: p }).translationProvider, undefined);
    assert.equal(getChatTranslationConfig('c', { translationProvider: 'deepl' }).provider, 'google');
    assert.deepEqual(normalizeTranslatorSettings({ translationProvider: 'ai', translationDeeplApiKey: 'k', translationDeeplxUrl: 'http://x', autoTranslate: 'yes', translateInput: false, translationPrompt: 'P', translationInputPrompt: null, translationTargetLang: 'ko', other: 1 }),
        { translationProvider: 'ai', translationTargetLang: 'ko', translationPrompt: 'P', translationInputPrompt: null, translateInput: false, translationInputTargetLang: 'ko', translationOutputTargetLang: 'ko', translationOutputPrompt: 'P' });
    assert.deepEqual(normalizeTranslatorSettings('{"autoTranslate":true}'), { autoTranslate: true });
    for (const bad of ['{', null, [], 7]) assert.deepEqual(normalizeTranslatorSettings(bad), {});
    // getChatTranslationConfig: 기본 google · en, 비운 칸은 옛 공용 값, 프롬프트 null은 기본
    assert.deepEqual(getChatTranslationConfig('c1', {}), { chatId: 'c1', provider: 'google', inputTargetLanguage: 'en', outputTargetLanguage: 'en', connectionId: undefined, inputSystemPrompt: undefined, outputSystemPrompt: undefined });
    assert.deepEqual(getChatTranslationConfig('c1', { translationTargetLang: ' ja ', translationOutputTargetLang: '  ', translationPrompt: 'X', translationInputPrompt: null, translationConnectionId: 'tr', translationProvider: 'ai' }),
        { chatId: 'c1', provider: 'ai', inputTargetLanguage: 'ja', outputTargetLanguage: 'ja', connectionId: 'tr', inputSystemPrompt: undefined, outputSystemPrompt: 'X' });
    assert.equal(DEFAULT_TRANSLATION_SYSTEM_PROMPT, 'You are a translator. Translate the given text accurately into {{targetLanguage}}, preserving formatting, markdown, and any special characters like *asterisks* for actions. Output ONLY the translated text, nothing else -- no explanations, no extra commentary.');
    assert.equal(resolveTranslationSystemPrompt('A {{targetLanguage}} B {{targetLanguage}}', ' Korean '), 'A Korean B Korean');
});

// ---- 2. translateText (translation.service.ts): 스키마 · Google · AI
test('translateText의 입력: 마리나라 스키마의 한도 그대로 (text 1~50000, 언어 trim 1~100, 프롬프트 5000 · null). 제공자는 ai · google만', () => {
    const ok = { text: 'hi', provider: 'google', targetLanguage: ' ko ' };
    assert.deepEqual(validateTranslateInput({ ...ok, chatId: 'c', debugMode: true, connectionId: 'tr', systemPrompt: null, deeplApiKey: 'gone', deeplxUrl: 'http://x' }), { chatId: 'c', debugMode: true, text: 'hi', provider: 'google', targetLanguage: 'ko', connectionId: 'tr', systemPrompt: null });
    const bad = (patch, path) => { try { validateTranslateInput({ ...ok, ...patch }); assert.fail('no error'); } catch (e) { assert.equal(e.message, '유효성 검사 오류'); assert.equal(e.statusCode, 400); assert.ok(e.details.some(d => d.path === path), JSON.stringify(e.details)); } };
    bad({ text: '' }, 'text'); bad({ text: 'x'.repeat(50001) }, 'text'); bad({ text: 3 }, 'text');
    bad({ provider: 'deepl' }, 'provider'); bad({ provider: 'deeplx' }, 'provider'); bad({ provider: undefined }, 'provider');
    bad({ targetLanguage: '   ' }, 'targetLanguage'); bad({ targetLanguage: 'x'.repeat(101) }, 'targetLanguage');
    bad({ systemPrompt: 'x'.repeat(5001) }, 'systemPrompt'); bad({ debugMode: 'yes' }, 'debugMode'); bad({ connectionId: 5 }, 'connectionId');
    assert.equal(validateTranslateInput({ ...ok, text: 'x'.repeat(50000), targetLanguage: 'y'.repeat(100), systemPrompt: 'z'.repeat(5000) }).text.length, 50000);
    assert.throws(() => validateTranslateInput(null), /유효성 검사 오류/);
});

test('Google: 마리나라와 같은 주소 하나(client=gtx · sl=auto · tl · dt=t · q), 15초, 조각을 이어 붙여요. 5000자 넘으면 · 오류 · 시간 초과는 마리나라의 글', async () => {
    sent.length = 0;
    const text = 'Hello there. How are you?\n*waves* & "quotes" 100%';
    const out = await translateText({ connections: {} }, { text, provider: 'google', targetLanguage: 'ko' });
    // (the address as Marinara's translateWithGoogle builds it, line for line)
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx'); url.searchParams.set('sl', 'auto'); url.searchParams.set('tl', 'ko'); url.searchParams.set('dt', 't'); url.searchParams.set('q', text);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, url.toString());
    assert.deepEqual(Object.keys(sent[0].init), ['signal']);
    assert.ok(sent[0].init.signal instanceof AbortSignal);
    assert.deepEqual(out, { translatedText: `<${text}>` });
    // (Google's answer in parts: joined; empty or missing parts are skipped)
    answer = () => new Response(JSON.stringify([[['안녕. ', 'Hello. '], ['잘 지내?', 'How are you?'], [null, 'x'], 'junk'], null, 'en']));
    assert.deepEqual(await translateText({}, { text: 'Hello. How are you?', provider: 'google', targetLanguage: 'ko' }), { translatedText: '안녕. 잘 지내?' });
    answer = () => new Response('{"no":"array"}');
    assert.deepEqual(await translateText({}, { text: 'x', provider: 'google', targetLanguage: 'ko' }), { translatedText: '' });
    answer = () => new Response('busy', { status: 429 });
    await assert.rejects(() => translateText({}, { text: 'x', provider: 'google', targetLanguage: 'ko' }), e => e.message === 'Google 번역이 429을(를) 반환했습니다' && e.statusCode === 502);
    answer = () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); };
    await assert.rejects(() => translateText({}, { text: 'x', provider: 'google', targetLanguage: 'ko' }), e => e.message === 'Google 번역 요청 시간이 초과되었습니다' && e.statusCode === 502);
    // (the body read past the time limit: the same timeout error — Marinara's safeFetch reads the body inside the fetch)
    answer = () => new Response(new ReadableStream({ pull(c) { c.error(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })); } }));
    await assert.rejects(() => translateText({}, { text: 'x', provider: 'google', targetLanguage: 'ko' }), e => e.message === 'Google 번역 요청 시간이 초과되었습니다' && e.statusCode === 502);
    answer = () => new Response('x'.repeat(1024 * 1024 + 1));
    await assert.rejects(() => translateText({}, { text: 'x', provider: 'google', targetLanguage: 'ko' }), /외부 응답이 1048576바이트를 초과했습니다/);
    const n = sent.length;
    await assert.rejects(() => translateText({}, { text: 'x'.repeat(5001), provider: 'google', targetLanguage: 'ko' }), e => e.message === 'Google 번역에는 텍스트가 너무 깁니다(최대 5000자). 더 긴 텍스트에는 AI 제공자를 사용하세요.' && e.statusCode === 400);
    assert.equal(sent.length, n);
    answer = DEFAULT_ANSWER;
});

test('AI: 지시문은 마리나라 기본(또는 내 것, {{targetLanguage}}를 바꿔서) + "Translate the following text to …", 온도 0.3, 최대 토큰은 연결의 것 → 4096. 답은 trim', async () => {
    const calls = [];
    const conn = (o = {}) => ({ id: 'c', baseUrl: 'https://x', model: 'm', storedMaxTokens: undefined, maxTokensOverride: null, chatComplete: async (messages, opts) => { calls.push({ messages, opts }); return { content: '  번역  ' }; }, ...o });
    const store = c => ({ connections: { getWithKey: async id => (id === 'c' ? c : null) } });
    assert.deepEqual(await translateText(store(conn()), { text: 'Hello', provider: 'ai', targetLanguage: 'Korean', connectionId: 'c' }), { translatedText: '번역' });
    assert.deepEqual(calls[0], { messages: [{ role: 'system', content: DEFAULT_TRANSLATION_SYSTEM_PROMPT.replace('{{targetLanguage}}', 'Korean') }, { role: 'user', content: 'Translate the following text to Korean:\n\nHello' }], opts: { model: 'm', debugMode: undefined, temperature: 0.3, maxTokens: 4096 } });
    await translateText(store(conn({ storedMaxTokens: 1000 })), { text: 'Hi', provider: 'ai', targetLanguage: 'ja', connectionId: 'c', systemPrompt: '  Into {{targetLanguage}}, kindly.  ' });
    assert.deepEqual([calls[1].messages[0].content, calls[1].opts.maxTokens], ['Into ja, kindly.', 1000]);
    await translateText(store(conn({ storedMaxTokens: 1000, maxTokensOverride: 2000 })), { text: 'Hi', provider: 'ai', targetLanguage: 'ja', connectionId: 'c' });
    assert.equal(calls.pop().opts.maxTokens, 1000);
    await translateText(store(conn({ maxTokensOverride: 2000 })), { text: 'Hi', provider: 'ai', targetLanguage: 'ja', connectionId: 'c', systemPrompt: '   ' });
    assert.deepEqual([calls[2].messages[0].content, calls[2].opts.maxTokens], [DEFAULT_TRANSLATION_SYSTEM_PROMPT.replace('{{targetLanguage}}', 'ja'), 2000]);
    await assert.rejects(() => translateText(store(conn()), { text: 'Hi', provider: 'ai', targetLanguage: 'ja' }), e => e.message === 'AI 번역에는 연결 ID가 필요합니다' && e.statusCode === 400);
    await assert.rejects(() => translateText(store(conn()), { text: 'Hi', provider: 'ai', targetLanguage: 'ja', connectionId: 'nope' }), e => e.message === 'API 연결을 찾을 수 없습니다' && e.statusCode === 400);
    await assert.rejects(() => translateText(store(conn({ baseUrl: '' })), { text: 'Hi', provider: 'ai', targetLanguage: 'ja', connectionId: 'c' }), e => e.message === '이 연결에 기본 URL이 설정되지 않았습니다' && e.statusCode === 400);
    assert.equal(calls.length, 3);
});

test('AI의 실제 요청 몸통 (커스텀 OpenAI 형식 연결): 마리나라 openai.provider의 몸통과 같아요 (model · messages(system · user) · stream false · max_tokens · temperature 0.3)', async () => {
    setup({ g: { tr: { mode: 'custom', url: 'https://relay.example/v1', key: 'secret', model: 'tr-model' } } });
    sent.length = 0;
    const out = await TR.translationConnections.getWithKey('tr').then(c => translateText({ connections: TR.translationConnections }, { text: 'Hello *waves*', provider: 'ai', targetLanguage: 'Korean', connectionId: 'tr' }));
    assert.deepEqual(out, { translatedText: '번역된 글' });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, 'https://relay.example/v1/chat/completions');
    // (Marinara's chatCompleteOnce for a plain chat model: body = { model, messages }, then stream, max_tokens, temperature — nothing else set)
    const system = DEFAULT_TRANSLATION_SYSTEM_PROMPT.replace('{{targetLanguage}}', 'Korean'), user = 'Translate the following text to Korean:\n\nHello *waves*';
    const marinara = { model: 'tr-model', messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
    marinara.stream = false; marinara.max_tokens = 4096; marinara.temperature = 0.3;
    assert.deepEqual(JSON.parse(sent[0].init.body), marinara);
    // (the translation model's own max tokens, when set: Marinara's saved maxTokens; the AI 기능 모델's aiMaxTokens)
    T.g.tr.max = 1234; sent.length = 0;
    await translateText({ connections: TR.translationConnections }, { text: 'x', provider: 'ai', targetLanguage: 'ko', connectionId: 'tr' });
    assert.equal(JSON.parse(sent[0].init.body).max_tokens, 1234);
    T.g.aiConn = { mode: 'custom', url: 'https://relay.example/v1', key: 'k', model: 'ai-model' }; sent.length = 0;
    await translateText({ connections: TR.translationConnections }, { text: 'x', provider: 'ai', targetLanguage: 'ko', connectionId: 'ai' });
    assert.deepEqual([JSON.parse(sent[0].init.body).model, JSON.parse(sent[0].init.body).max_tokens], ['ai-model', 8192]);
});

test('AI 연결 목록 · 찾기: 번역 모델(자기 연결이 있을 때) · 초안 · AI 기능 · 실리 프로필. 프로필은 온도 0.3을 얹어 보내요', async () => {
    const P = [{ id: 'p1', name: 'One', api: 'openrouter', model: 'pm' }];
    setup();
    TR.setTranslationConnectionList(() => [{ id: 'dr', name: 'draft-model', model: 'draft-model', provider: 'custom' }, { id: 'profile:p1', name: 'One', model: 'pm', provider: 'openrouter' }]);
    assert.deepEqual(TR.liveTranslationConnections().map(c => c.id), ['dr', 'profile:p1']);
    T.g.tr = { mode: 'vertex', vxModel: 'gemini-x' };
    assert.deepEqual(TR.liveTranslationConnections()[0], { id: 'tr', name: 'gemini-x', model: 'gemini-x', provider: 'google_vertex' });
    T.ctx.ConnectionManagerRequestService.getSupportedProfiles = () => P;
    const c = await TR.translationConnections.getWithKey('profile:p1');
    assert.equal((await c.chatComplete([{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }], { temperature: 0.3, maxTokens: 4096 })).content, 'via profile');
    assert.deepEqual(T.profileCalls[0], ['p1', [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }], 4096, { stream: false, extractData: true, includePreset: true, includeInstruct: true }, { temperature: 0.3 }]);
    assert.equal(await TR.translationConnections.getWithKey('profile:gone'), null);
    assert.equal(await TR.translationConnections.getWithKey('weird'), null);
    T.g.draftConn = { mode: 'same' };
    assert.equal(await TR.translationConnections.getWithKey('dr'), null);
    TR.setTranslationConnectionList(() => []);
});

// (SillyTavern's own connection with no profile picked — 'ai' with the AI 기능 모델 on SillyTavern's side —: the same request in the
//  browser and on the server, not generateRaw — which is a browser function and takes no temperature)
test('AI · 실리의 지금 연결(고른 프로필 없음): 채팅 완성은 그 소스 · 모델로 실리 createGenerationParameters에 system + user, 온도 0.3, 최대 토큰. 글 완성은 TextCompletionService + 지시 형식. 그 밖의 API는 이유와 함께 거절', async () => {
    const { real } = setup({ meta: { autoTranslate: true, translationProvider: 'ai', translationConnectionId: 'ai', translationOutputTargetLang: 'Korean' } });
    TR.setTranslationConnectionList(() => [{ id: 'ai', name: 'x' }]);
    T.ctx.generateRaw = async () => assert.fail('generateRaw is not used');
    // 채팅 완성 (main_api 'openai')
    const built = [];
    globalThis.__naStOpenai = { oai_settings: { chat_completion_source: 'openrouter', temp_openai: 1, openai_max_tokens: 300 }, createGenerationParameters: async (settings, model, type, messages) => { built.push({ settings, model, type, messages }); return { generate_data: { chat_completion_source: settings.chat_completion_source, model, messages, temperature: settings.temp_openai, max_tokens: settings.openai_max_tokens, stop: ['x'] } }; } };
    Object.assign(T.ctx, { mainApi: 'openai', chatCompletionSettings: { chat_completion_source: 'openrouter', openrouter_model: 'or/m' }, getChatCompletionModel: o => o.openrouter_model, getRequestHeaders: () => ({ 'Content-Type': 'application/json' }) });
    try {
        sent.length = 0;
        const out = await translateText({ connections: TR.translationConnections }, { text: 'Hello', provider: 'ai', targetLanguage: 'Korean', connectionId: 'ai' });
        assert.deepEqual(out, { translatedText: '번역된 글' });
        assert.equal(sent.length, 1);
        assert.equal(sent[0].url, '/api/backends/chat-completions/generate');
        const system = DEFAULT_TRANSLATION_SYSTEM_PROMPT.replace('{{targetLanguage}}', 'Korean');
        assert.deepEqual(JSON.parse(sent[0].init.body), { chat_completion_source: 'openrouter', model: 'or/m', messages: [{ role: 'system', content: system }, { role: 'user', content: 'Translate the following text to Korean:\n\nHello' }], temperature: 0.3, max_tokens: 8192, stream: false });
        assert.deepEqual([built[0].settings.temp_openai, built[0].settings.openai_max_tokens, built[0].type], [0.3, 8192, 'quiet']);
        assert.equal(await TR.translationCannot(real, L.liveWorld(real).messenger.rooms[Object.keys(L.liveWorld(real).messenger.rooms)[0]].id), '');
        // 글 완성 (main_api 'textgenerationwebui'): 실리의 TextCompletionService.processRequest (연결 프로필이 보내는 길과 같은 것)
        const calls = [];
        globalThis.__naStTextgen = { TextCompletionService: { processRequest: async (...a) => { calls.push(a); return { content: ' 글 완성 번역 ', reasoning: '' }; } }, getTextGenModel: tg => tg.koboldcpp_model, getTextGenServer: type => `server-of-${type}`, settings: () => ({ type: 'koboldcpp', koboldcpp_model: 'k-model' }), powerUser: () => ({ instruct: { enabled: true, preset: 'ChatML' } }) };
        T.ctx.mainApi = 'textgenerationwebui';
        assert.deepEqual(await translateText({ connections: TR.translationConnections }, { text: 'Hi', provider: 'ai', targetLanguage: 'ja', connectionId: 'ai' }), { translatedText: '글 완성 번역' });
        assert.deepEqual(calls[0], [{ stream: false, prompt: [{ role: 'system', content: DEFAULT_TRANSLATION_SYSTEM_PROMPT.replace('{{targetLanguage}}', 'ja') }, { role: 'user', content: 'Translate the following text to ja:\n\nHi' }], max_tokens: 8192, model: 'k-model', api_type: 'koboldcpp', api_server: 'server-of-koboldcpp', temperature: 0.3 }, { instructName: 'ChatML' }, true, null]);
        globalThis.__naStTextgen.powerUser = () => ({ instruct: { enabled: false, preset: 'ChatML' } });
        await translateText({ connections: TR.translationConnections }, { text: 'Hi', provider: 'ai', targetLanguage: 'ja', connectionId: 'ai' });
        assert.deepEqual(calls[1][1], { instructName: undefined });
        // 그 밖의 API (KoboldAI · NovelAI · Horde): 보내지 않고 이유를. 화면의 설정에서도, 서버 상태에서도
        T.ctx.mainApi = 'novel';
        const why = '실리의 지금 API(novel)로는 AI 번역을 할 수 없습니다. 다른 연결을 선택하세요.';
        await assert.rejects(() => translateText({ connections: TR.translationConnections }, { text: 'Hi', provider: 'ai', targetLanguage: 'ja', connectionId: 'ai' }), e => e.message === why);
        const roomId = Object.keys(L.liveWorld(real).messenger.rooms)[0];
        assert.equal(await TR.translationCannot(real, roomId), why);
        const meta = L.liveWorld(real).presence.meta;
        meta.translationConnectionId = 'dr'; meta.translationProvider = 'google';
        await assert.rejects(() => TR.liveSetTranslation(real, { translationProvider: 'ai', translationConnectionId: 'ai' }), e => e.message === why);
        assert.deepEqual([meta.translationProvider, meta.translationConnectionId], ['google', 'dr']);
        assert.equal(T.saves, 0);
        // (Google, or another connection: nothing to refuse)
        await TR.liveSetTranslation(real, { translationConnectionId: 'ai' });
        assert.equal(meta.translationConnectionId, 'ai');
        await TR.liveSetTranslation(real, { autoTranslate: false });
        assert.equal(await TR.translationCannot(real, roomId), '');
    } finally { delete globalThis.__naStOpenai; delete globalThis.__naStTextgen; TR.setTranslationConnectionList(() => []); }
});

// ---- 3. 화면이 쓰는 설정 (TranslationSection.tsx)
test('채팅 설정 › 번역: 값 읽기 (마리나라 화면의 규칙) · 바꾸기 (준 열쇠만, 프롬프트는 비었거나 기본과 같으면 null)', async () => {
    const { real, w } = setup({ meta: { translationTargetLang: 'fr', translationPrompt: 'Old {{targetLanguage}}', translationOutputPrompt: null } });
    TR.setTranslationConnectionList(() => [{ id: 'dr', name: 'draft-model' }]);
    let S = TR.liveTranslationSettings(real);
    assert.deepEqual({ ...S, connections: S.connections.map(c => c.id) }, { provider: 'google', inputTargetLanguage: 'fr', outputTargetLanguage: 'fr', connectionId: '', inputPrompt: 'Old {{targetLanguage}}', outputPrompt: '', autoTranslate: false, translateInput: false, showInputTranslateButton: false, translationDisplayOnly: false, defaultPrompt: DEFAULT_TRANSLATION_SYSTEM_PROMPT, connections: ['dr'] });
    S = await TR.liveSetTranslation(real, { translationProvider: 'ai', translationConnectionId: 'dr', translationInputTargetLang: 'English', translationOutputTargetLang: 'Korean', translationInputPrompt: DEFAULT_TRANSLATION_SYSTEM_PROMPT + '  ', translationOutputPrompt: 'Mine', autoTranslate: true, translateInput: true, showInputTranslateButton: true, translationDisplayOnly: true });
    assert.deepEqual(w.presence.meta, { translationTargetLang: 'fr', translationPrompt: 'Old {{targetLanguage}}', translationOutputPrompt: 'Mine', translationProvider: 'ai', translationConnectionId: 'dr', translationInputTargetLang: 'English', translationOutputTargetLang: 'Korean', translationInputPrompt: null, autoTranslate: true, translateInput: true, showInputTranslateButton: true, translationDisplayOnly: true });
    assert.equal(T.saves, 1);
    assert.deepEqual([S.inputPrompt, S.outputPrompt], ['', 'Mine']);
    await TR.liveSetTranslation(real, { translationOutputPrompt: '   ' });
    assert.equal(w.presence.meta.translationOutputPrompt, null);
    for (const [patch, why] of [[{ translationProvider: 'deepl' }, /google 또는 ai/], [{ translationProvider: 'deeplx' }, /google 또는 ai/], [{ translationDeeplApiKey: 'x' }, /알 수 없는 번역 설정입니다/], [{ translationConnectionId: 'nope' }, /연결을 찾을 수 없습니다/]])
        await assert.rejects(() => TR.liveSetTranslation(real, patch), why);
    await TR.liveSetTranslation(real, { translationConnectionId: '' });
    assert.equal(w.presence.meta.translationConnectionId, '');
    TR.setTranslationConnectionList(() => []);
});

test('새 채팅의 번역 기본값: 이 채팅의 설정을 저장 · 잊기 (마리나라의 알림 글), 새 Orbit은 기본값으로 시작. 프로필은 기본값 위에 자기 것', async () => {
    const { real } = setup({ meta: { translationProvider: 'ai', autoTranslate: true, conversationSchedulesEnabled: true, translationTargetLang: 'ja' } });
    assert.equal(await TR.liveTranslatorDefaults(), false);
    assert.equal(await TR.liveSaveTranslatorDefaults(real), true);
    const saved = T.ctx.extensionSettings.narrative_archive['translator-defaults'];
    assert.deepEqual(JSON.parse(saved), { translationProvider: 'ai', translationTargetLang: 'ja', autoTranslate: true, translationInputTargetLang: 'ja', translationOutputTargetLang: 'ja' });
    assert.deepEqual(toasts.pop(), ['success', '새 채팅용 번역기 기본값을 저장했습니다.']);
    assert.equal(await TR.liveTranslatorDefaults(), true);
    // (a new Orbit — Marinara's new chat — starts from them)
    const fresh = { phones: {} };
    L.startFresh(fresh, { persona: 'Ren' });
    assert.deepEqual(L.liveWorld(fresh).presence.meta, JSON.parse(saved));
    // 잊기
    assert.equal(await TR.liveSaveTranslatorDefaults(null), true);
    assert.equal(T.ctx.extensionSettings.narrative_archive['translator-defaults'], undefined);
    assert.deepEqual(toasts.pop(), ['success', '저장한 번역기 기본값을 지웠습니다. 기존 채팅은 설정을 그대로 유지합니다.']);
    assert.equal(await TR.liveTranslatorDefaults(), false);
    const fresh2 = { phones: {} };
    L.startFresh(fresh2, { persona: 'Ren' });
    assert.equal(L.liveWorld(fresh2).presence, undefined);
    // (a failure: Marinara's failure toast)
    const es = T.ctx.extensionSettings; T.ctx.extensionSettings = null;
    assert.equal(await TR.liveSaveTranslatorDefaults(real), false);
    assert.deepEqual(toasts.pop(), ['error', '번역기 기본값을 바꾸지 못했습니다. 다시 시도해 주세요.']);
    T.ctx.extensionSettings = es;
    // 프로필: 기본값 위에 프로필의 번역 설정 (채팅의 것은 남지 않아요)
    assert.deepEqual(TR.profileTranslatorSettings({ translationProvider: 'google', autoTranslate: false }, JSON.stringify({ translationProvider: 'ai', translateInput: true })), { translationProvider: 'google', translateInput: true, autoTranslate: false });
});

// ---- 4. 번역 단추 · 보이기 (use-translate.ts · translation.store.ts · ConversationMessage.tsx)
test('번역 단추: 번역해서 그 말에 저장(번역 · 원문 · 숨김 false), 다시 누르면 숨기기(숨김만 저장, 번역은 남아요). 원문을 고치면 다시 번역', async () => {
    const { real, room, say } = setup({ meta: { translationOutputTargetLang: 'ko' } });
    const x = say('Mara', 'Hello', 1);
    let draws = 0;
    TR.liveTranslationOpen(real, room.id);
    const p = TR.liveTranslate(real, room.id, x.id, { onChange: () => draws++ });
    assert.equal(TR.liveTranslationView(real, room.id, x).isTranslating, true);
    assert.deepEqual(TR.liveTranslationView(real, room.id, x).translationBlock, { text: '', translating: true });
    await p;
    assert.deepEqual(x.extra, { translation: '<Hello>', translationSource: 'Hello', translationHidden: false });
    assert.equal(new URL(sent[0].url).searchParams.get('tl'), 'ko');
    assert.equal(T.saves, 1); assert.ok(draws >= 2);
    let v = TR.liveTranslationView(real, room.id, x);
    assert.deepEqual([v.translatedText, v.isTranslating, v.showTranslationOnly, v.displayedContent, v.buttonTitle], ['<Hello>', false, false, 'Hello', '번역 숨기기']);
    assert.deepEqual(v.translationBlock, { text: '<Hello>', translating: false });
    // 숨기기: 요청 없이, 숨김을 저장하고 번역은 남겨요
    sent.length = 0;
    await TR.liveTranslate(real, room.id, x.id);
    await new Promise(r => setTimeout(r, 5));
    assert.equal(sent.length, 0);
    assert.deepEqual(x.extra, { translation: '<Hello>', translationSource: 'Hello', translationHidden: true });
    v = TR.liveTranslationView(real, room.id, x);
    assert.deepEqual([v.translatedText, v.translationBlock, v.buttonTitle], [null, null, '번역']);
    // (a reload: a hidden translation is not seeded again)
    useTranslationStore.getState().clearAll(); TR.liveTranslationOpen(real, room.id);
    assert.equal(TR.liveTranslationView(real, room.id, x).translatedText, null);
    // 다시 누르면 다시 번역 (저장된 것을 보이는 게 아니라 마리나라처럼 새로 물어요)
    await TR.liveTranslate(real, room.id, x.id);
    assert.equal(sent.length, 1); assert.equal(x.extra.translationHidden, false);
    // 원문을 고쳤으면: 번역은 남아 보이고(마리나라의 대화 모드), 단추는 숨기기가 아니라 다시 번역
    x.text = 'Hello again';
    assert.equal(TR.liveTranslationView(real, room.id, x).translatedText, '<Hello>');
    await TR.liveTranslate(real, room.id, x.id);
    assert.equal(sent.length, 2);
    assert.deepEqual(x.extra, { translation: '<Hello again>', translationSource: 'Hello again', translationHidden: false });
    // 실패: 마리나라의 알림(오류 글), 저장은 그대로
    answer = () => new Response('no', { status: 503 });
    const warn = console.error; console.error = () => {};
    try { x.text = 'Bye'; await TR.liveTranslate(real, room.id, x.id); } finally { console.error = warn; answer = DEFAULT_ANSWER; }
    assert.deepEqual(toasts.pop(), ['error', 'Google 번역이 503을(를) 반환했습니다']);
    assert.equal(x.extra.translation, '<Hello again>');
    assert.equal(TR.liveTranslationView(real, room.id, x).isTranslating, false);
});

test('번역 단추 + 화면처럼 다시 그리기 (phone.js: onChange가 방을 그려요 → liveTranslationOpen · liveTranslationView): 끝없이 돌지 않고 바로 끝나요. 그리기는 틱마다 한 번', async () => {
    const { real, room, say } = setup({ meta: { translationOutputTargetLang: 'ko' } });
    const x = say('Mara', 'Hello', 1), y = say('Mara', 'Saved', 2, { translation: '저장됨', translationSource: 'Saved' });
    let draws = 0, depth = 0, maxDepth = 0, writes = 0;
    const off = useTranslationStore.subscribe(() => { writes++; });
    // (drawing the room as the screen does — and, once, something else on the screen writing to the store while it draws)
    const redraw = () => { draws++; depth++; maxDepth = Math.max(maxDepth, depth); try { TR.liveTranslationOpen(real, room.id); TR.liveTranslationView(real, room.id, x); TR.liveTranslationView(real, room.id, y); if (draws === 1) useTranslationStore.getState().setTranslating('other', false); } finally { depth--; } };
    TR.liveTranslationOpen(real, room.id);
    // (drawing again with nothing changed writes nothing: Marinara does this in effects, when something changed)
    const w0 = writes;
    for (let i = 0; i < 5; i++) TR.liveTranslationOpen(real, room.id);
    assert.equal(writes, w0);
    const t0 = Date.now();
    await Promise.race([TR.liveTranslate(real, room.id, x.id, { onChange: redraw }), new Promise((_, no) => setTimeout(() => no(new Error('the translate button did not finish')), 3000))]);
    await new Promise(r => setTimeout(r, 5));
    off();
    assert.ok(Date.now() - t0 < 1000);
    assert.deepEqual(x.extra, { translation: '<Hello>', translationSource: 'Hello', translationHidden: false });
    // (translating on · the translation and translating off in one tick · the screen's own write: each tick drawn once, never inside a draw)
    assert.equal(maxDepth, 1);
    assert.ok(draws >= 2 && draws <= 3, String(draws));
    assert.deepEqual(TR.liveTranslationView(real, room.id, x).translationBlock, { text: '<Hello>', translating: false });
    // (a translation saved since — the server's — is seeded in the next draw)
    y.extra = { ...y.extra, translation: '서버 것' };
    TR.liveTranslationOpen(real, room.id);
    assert.equal(TR.liveTranslationView(real, room.id, y).translatedText, '서버 것');
});

test('번역만 보이기 (translationDisplayOnly): 번역이 있고 · 번역 중이 아니고 · 그 번역의 원문이 지금 글일 때만 말풍선에 번역만', async () => {
    const { real, room, say } = setup({ meta: { translationDisplayOnly: true } });
    const x = say('Mara', 'Hi', 1, { translation: '안녕', translationSource: 'Hi' }), y = say('Mara', 'Edited', 2, { translation: '옛 번역', translationSource: 'Before' }), z = say('Mara', 'No source', 3, { translation: '출처 없음' });
    TR.liveTranslationOpen(real, room.id);
    let v = TR.liveTranslationView(real, room.id, x);
    assert.deepEqual([v.showTranslationOnly, v.displayedContent, v.translationBlock], [true, '안녕', null]);
    v = TR.liveTranslationView(real, room.id, y);
    assert.deepEqual([v.showTranslationOnly, v.displayedContent, v.translationBlock], [false, 'Edited', { text: '옛 번역', translating: false }]);
    // (no saved source: Marinara seeds the message's own text as it)
    assert.equal(TR.liveTranslationView(real, room.id, z).showTranslationOnly, true);
    useTranslationStore.getState().setTranslating(x.id, true);
    v = TR.liveTranslationView(real, room.id, x);
    assert.deepEqual([v.showTranslationOnly, v.displayedContent, v.translationBlock], [false, 'Hi', { text: '', translating: true }]);
    // 꺼져 있으면 늘 원문 + 아래 칸
    await TR.liveSetTranslation(real, { translationDisplayOnly: false });
    useTranslationStore.getState().setTranslating(x.id, false);
    assert.equal(TR.liveTranslationView(real, room.id, x).showTranslationOnly, false);
    // (another room: the store is cleared, as on Marinara's chat switch)
    const other = L.ensureRoom(real, ['Mara', 'Ivo']);
    TR.liveTranslationOpen(real, other.id);
    assert.deepEqual(useTranslationStore.getState().translations, {});
});

test('store (translation.store.ts): 저장된 번역으로 채우기 · 숨긴 것 · 번역 중인 것은 안 채워요. 숨기기 · 다시 보이기 · 무효로', () => {
    const s = () => useTranslationStore.getState();
    s().clearAll();
    s().seedFromMessages([{ id: 'a', content: 'A', extra: { translation: 'ㄱ', translationSource: 'A0' } }, { id: 'b', content: 'B', extra: '{"translation":"ㄴ"}' }, { id: 'c', extra: { translation: 'ㄷ', translationHidden: true } }, { id: 'd', extra: '{bad' }, { id: 'e', extra: null }]);
    assert.deepEqual([s().translations, s().translationSources], [{ a: 'ㄱ', b: 'ㄴ' }, { a: 'A0', b: 'B' }]);
    s().removeTranslation('a');
    assert.deepEqual([s().translations, s().hiddenTranslationIds], [{ b: 'ㄴ' }, { a: true }]);
    s().seedFromMessages([{ id: 'a', content: 'A', extra: { translation: 'ㄱ' } }]);
    assert.equal(s().translations.a, undefined);
    s().setTranslation('a', '새', 'A');
    assert.deepEqual([s().translations.a, s().translationSources.a, s().hiddenTranslationIds], ['새', 'A', {}]);
    s().setTranslating('b', true);
    s().seedFromMessages([{ id: 'b', content: 'B', extra: { translation: '서버 것' } }]);
    assert.equal(s().translations.b, 'ㄴ');
    s().invalidateTranslation('b');
    assert.deepEqual([s().translations.b, s().translationSources.b, s().hiddenTranslationIds.b], [undefined, undefined, undefined]);
    s().clearAll();
    assert.deepEqual([s().translations, s().translationSources, s().translating, s().hiddenTranslationIds], [{}, {}, {}, {}]);
});

test('translateMessage (use-translate.ts): 같은 글이면 기다리던 요청을 같이 기다려요, 다른 글이면 앞의 것(저장까지) 뒤에 줄 서요. 무효가 된 것은 저장 · 표시하지 않아요', async () => {
    const order = [], had = { ...UT.translateIO() };
    let gate;
    const replies = [];
    UT.setTranslateIO({ translate: async body => { order.push(`ask:${body.text}`); await new Promise(r => replies.push(r)); return { translatedText: `T(${body.text})` }; }, patchExtra: async (chat, id, extra) => { order.push(`save:${extra.translation}`); await gate; } });
    const s = () => useTranslationStore.getState();
    s().clearAll(); s().setConfig({ chatId: 'c', provider: 'google', inputTargetLanguage: 'en', outputTargetLanguage: 'ko' });
    const config = s().config;
    const a1 = UT.translateMessage('m', 'one', config, 'c'), a2 = UT.translateMessage('m', 'one', config, 'c');
    assert.equal(a1, a2);
    const b = UT.translateMessage('m', 'two', config, 'c');
    await new Promise(r => setTimeout(r, 5));
    assert.deepEqual(order, ['ask:one']);
    replies.shift()();
    await a1;
    await new Promise(r => setTimeout(r, 5));
    // (the first one's save comes before the second is asked, and before the screen shows it)
    assert.deepEqual(order, ['ask:one', 'save:T(one)', 'ask:two']);
    assert.equal(s().translations.m, 'T(one)');
    UT.invalidateTranslation('m');
    replies.shift()();
    await b;
    assert.deepEqual(order, ['ask:one', 'save:T(one)', 'ask:two']);
    assert.equal(s().translations.m, undefined);
    // (another chat is open now: nothing shown here, but the save still goes to the chat it was for)
    s().setConfig({ chatId: 'other', provider: 'google', inputTargetLanguage: 'en', outputTargetLanguage: 'ko' });
    const c = UT.translateMessage('n', 'three', config, 'c');
    replies.shift()(); await c;
    assert.deepEqual(order.at(-1), 'save:T(three)');
    assert.equal(s().translations.n, undefined);
    // (Marinara's enqueueTranslationPersistence: valid is asked again after the save, before the cached copy is updated)
    const cached = [];
    let valid = true;
    UT.setTranslateIO({ patchExtra: async (chat, id, extra) => { order.push(`save:${JSON.stringify(extra)}`); valid = false; }, cacheExtra: (chat, id, extra) => cached.push(extra) });
    await UT.enqueueTranslationPersistence('c', 'm', { translationHidden: true }, () => valid);
    assert.deepEqual(cached, []);
    UT.setTranslateIO({ patchExtra: async () => {} });
    await UT.enqueueTranslationPersistence('c', 'm', { translationHidden: true }, () => true);
    assert.deepEqual(cached, [{ translationHidden: true }]);
    // (the screen's own io again)
    UT.setTranslateIO(had);
});

// ---- 5. 보내는 말 · 입력창 번역 단추 (chat-macros.ts · ConversationInput.tsx · draft-translation.ts)
test('내 메시지 번역: 켜져 있으면 모델 언어로 (입력 쪽 언어 · 프롬프트), 실패하면 원문 + 알림. 꺼져 있으면 그대로', async () => {
    const { real, room } = setup({ meta: { translationInputTargetLang: 'fr', translationOutputTargetLang: 'ko' } });
    TR.setTranslationConnectionList(() => []);
    assert.equal(await TR.livePrepareInput(real, room.id, 'hello'), 'hello');
    assert.equal(sent.length, 0);
    await TR.liveSetTranslation(real, { translateInput: true });
    assert.equal(await TR.livePrepareInput(real, room.id, 'hello'), '<hello>');
    assert.equal(new URL(sent[0].url).searchParams.get('tl'), 'fr');
    assert.equal(await TR.livePrepareInput(real, room.id, '   '), '   ');
    answer = () => new Response('', { status: 500 });
    try {
        assert.equal(await TR.livePrepareInput(real, room.id, 'hello'), 'hello');
        assert.deepEqual(toasts.pop(), ['error', '메시지를 번역하지 못했습니다 — 원문을 보냅니다']);
        let told = 0;
        assert.equal(await TR.livePrepareInput(real, room.id, 'hello', { onTranslationError: () => told++ }), 'hello');
        assert.equal(told, 1);
    } finally { answer = DEFAULT_ANSWER; }
    // (an empty translation: the original goes)
    answer = () => new Response(JSON.stringify([[['   ', 'x']]]));
    try { assert.equal(await TR.livePrepareInput(real, room.id, 'hello'), 'hello'); } finally { answer = DEFAULT_ANSWER; }
});

test('입력창 번역 단추: 초안을 trim해서 입력 쪽 언어로, 따옴표는 마리나라 기본(straight)으로. 빈 결과 · 실패는 마리나라의 알림', async () => {
    const { real, room } = setup({ meta: { translationInputTargetLang: 'de' } });
    answer = () => new Response(JSON.stringify([[['“Hallo” – it’s me ', 'x']]]));
    try {
        assert.equal(await TR.liveTranslateDraft(real, room.id, '  "hi"  '), '"Hallo" – it\'s me');
        assert.equal(new URL(sent[0].url).searchParams.get('q'), '"hi"');
        assert.equal(new URL(sent[0].url).searchParams.get('tl'), 'de');
        assert.equal(await TR.liveTranslateDraft(real, room.id, '   '), null);
        answer = () => new Response(JSON.stringify([[['  ', 'x']]]));
        assert.equal(await TR.liveTranslateDraft(real, room.id, 'x'), null);
        assert.deepEqual(toasts.pop(), ['error', '번역 결과가 빈 메시지입니다.']);
        answer = () => new Response('', { status: 404 });
        assert.equal(await TR.liveTranslateDraft(real, room.id, 'x'), null);
        assert.deepEqual(toasts.pop(), ['error', 'Google 번역이 404을(를) 반환했습니다']);
    } finally { answer = DEFAULT_ANSWER; }
    assert.equal(formatTextQuotes('`“code”` “a” <b title="“x”">', 'straight'), '`“code”` "a" <b title="“x”">');
});

// ---- 6. 자동 번역 (generate.routes.ts dispatchAutomaticTranslations · translation.service.ts translateGeneratedMessage)
test('자동 번역: 켜져 있을 때만 표시(답과 같은 저장). 말마다 차례로, 저장된 글을 번역해 그 말에. 숨긴 것 · 보이지 않는 것 · 명령만 · 빈 글 · 이미 같은 원문의 번역은 건너뛰어요', async () => {
    const { real, room, say } = setup({ meta: { translationOutputTargetLang: 'ko' } });
    const a = say('Mara', 'one', 1), b = say('Mara', 'two', 2), mine = say('Ren', 'mine', 3);
    assert.deepEqual(TR.markAutomaticTranslation(real, room.id, [a.id, b.id]), []);
    assert.equal(a.extra, undefined);
    await TR.liveSetTranslation(real, { autoTranslate: true });
    assert.deepEqual(TR.markAutomaticTranslation(real, room.id, [a.id, b.id, 'gone']), [a.id, b.id]);
    assert.deepEqual([a.extra, b.extra], [{ automaticTranslationSource: 'one' }, { automaticTranslationSource: 'two' }]);
    const saves = T.saves;
    await TR.browserAutoTranslate(real, room.id, [a.id, b.id]);
    assert.deepEqual(sent.map(r => new URL(r.url).searchParams.get('q')), ['one', 'two']);
    assert.deepEqual(a.extra, { automaticTranslationSource: 'one', translation: '<one>', translationSource: 'one', translationHidden: false });
    assert.equal(T.saves, saves + 2);
    // 건너뛰기: 같은 원문의 번역이 이미 있음 · 숨김 · 보이지 않음 · 명령만 · 빈 글 · 내 말
    sent.length = 0;
    const hid = say('Mara', 'h', 4, { translationHidden: true }), unseen = say('Mara', 'u', 5, { hiddenFromUser: true }), cmd = say('Mara', 'c', 6, { commandOnly: true }), empty = say('Mara', '  ', 7);
    await TR.browserAutoTranslate(real, room.id, [a.id, hid.id, unseen.id, cmd.id, empty.id, mine.id]);
    assert.equal(sent.length, 0);
    // (an edited message gets a new translation: its source differs)
    a.text = 'one!';
    await TR.browserAutoTranslate(real, room.id, [a.id]);
    assert.equal(a.extra.translation, '<one!>');
});

test('자동 번역: 묻는 사이에 글을 고쳤거나 번역을 숨겼으면 안 넣어요 (마리나라 updateMessageExtraForSwipe의 확인). 실패는 경고 줄만, 다음 말은 그대로 해요', async () => {
    const { real, room, say } = setup({ meta: { autoTranslate: true } });
    const a = say('Mara', 'one', 1), b = say('Mara', 'two', 2);
    const config = TR.translationConfigOf(real, room.id), chatId = `${L.liveWorld(real).id}:${room.id}`;
    answer = (u) => { a.text = 'changed'; return new Response(gtx(new URL(u).searchParams.get('q'))); };
    try { assert.equal(await TR.translateGenerated(real, chatId, a.id, config, { save: async () => {} }), null); } finally { answer = DEFAULT_ANSWER; }
    assert.deepEqual(a.extra, { automaticTranslationSource: 'one' });
    answer = (u) => { b.extra = { ...(b.extra || {}), translationHidden: true }; return new Response(gtx(new URL(u).searchParams.get('q'))); };
    try { assert.equal(await TR.translateGenerated(real, chatId, b.id, config, { save: async () => {} }), null); } finally { answer = DEFAULT_ANSWER; }
    assert.equal(b.extra.translation, undefined);
    // (a message of another chat · a user's message: nothing)
    assert.equal(await TR.translateGenerated(real, 'x:y', a.id, config, { save: async () => {} }), null);
    // 실패: "[translate] 메시지 %s의 자동 번역에 실패했습니다" 한 줄, 다음 말은 해요. 빈 번역도 실패
    const c = say('Mara', 'three', 3), d = say('Mara', 'four', 4), logs = [];
    let n = 0;
    answer = (u) => (n++ === 0 ? new Response(JSON.stringify([[['  ', 'x']]])) : new Response(gtx(new URL(u).searchParams.get('q'))));
    try { await TR.dispatchAutomaticTranslations({ chatId, ids: [c.id, d.id], config, run: id => TR.translateGenerated(real, chatId, id, config, { save: async () => {} }), log: (...x) => logs.push(x) }); }
    finally { answer = DEFAULT_ANSWER; }
    assert.equal(logs.length, 1);
    assert.deepEqual([logs[0][0], logs[0][1], logs[0][2].message], ['[translate] 메시지 %s의 자동 번역에 실패했습니다', c.id, '번역 제공자가 텍스트를 반환하지 않았습니다']);
    assert.equal(c.extra.translation, undefined); assert.equal(d.extra.translation, '<four>');
    // (cached: the server's retry after a save conflict puts the translation it got, asking nothing)
    sent.length = 0;
    const e = say('Mara', 'five', 5);
    assert.ok(await TR.translateGenerated(real, chatId, e.id, config, { save: async () => {}, cached: '다섯' }));
    assert.deepEqual([sent.length, e.extra.translation], [0, '다섯']);
});

test('자동 번역 중 표시 (마리나라 /generate/status의 translating): 방마다 센 수, 다 끝나면 false', async () => {
    const { real, room } = setup({ meta: { autoTranslate: true } });
    const chatId = `${L.liveWorld(real).id}:${room.id}`;
    let open;
    const gate = new Promise(r => { open = r; });
    const one = TR.dispatchAutomaticTranslations({ chatId, ids: ['a'], config: {}, run: () => gate, log: () => {} });
    const two = TR.dispatchAutomaticTranslations({ chatId, ids: ['b'], config: {}, run: async () => {}, log: () => {} });
    assert.equal(TR.liveTranslating(real, room.id), true);
    await two;
    assert.equal(TR.liveTranslating(real, room.id), true);
    open(); await one;
    assert.equal(TR.liveTranslating(real, room.id), false);
    assert.equal(TR.liveTranslating(real, 'other'), false);
    // (nothing to translate or no config: nothing counted)
    await TR.dispatchAutomaticTranslations({ chatId, ids: [], config: {}, run: () => assert.fail() });
    await TR.dispatchAutomaticTranslations({ chatId, ids: ['a'], config: null, run: () => assert.fail() });
});

test('translateGeneratedMessage 그대로: 표시 먼저(묻기 전), 번역 뒤 같은 글 확인. 저장 모양은 마리나라 extra 그대로', async () => {
    const log = [];
    const msg = { id: 'm1', chatId: 'c', role: 'assistant', content: 'Hi', extra: {} };
    const chats = { getMessage: async id => (id === 'm1' ? msg : null), updateMessageExtraForSwipe: async (id, idx, partial, expected) => { log.push([id, idx, partial, expected]); msg.extra = { ...msg.extra, ...partial }; return msg; } };
    const store = { chats, translateText: async (s, body) => { log.push(['ask', body]); return { translatedText: '안녕' }; } };
    const config = { provider: 'ai', inputTargetLanguage: 'en', outputTargetLanguage: 'Korean', connectionId: 'tr', outputSystemPrompt: 'S' };
    assert.equal(await translateGeneratedMessage(store, { chatId: 'c', messageId: 'm1', swipeIndex: 0, mode: 'conversation', config }), msg);
    assert.deepEqual(log, [['m1', 0, { automaticTranslationSource: 'Hi' }, 'Hi'], ['ask', { chatId: 'c', text: 'Hi', provider: 'ai', targetLanguage: 'Korean', connectionId: 'tr', systemPrompt: 'S', debugMode: undefined }], ['m1', 0, { translation: '안녕', translationSource: 'Hi', translationHidden: false }, 'Hi']]);
    log.length = 0;
    assert.equal(await translateGeneratedMessage(store, { chatId: 'c', messageId: 'm1', swipeIndex: 0, mode: 'conversation', config }), null);
    assert.deepEqual(log, []);
    // (a translation the user hid: nothing, not even the mark)
    msg.extra = { translationHidden: true }; msg.content = 'Other';
    assert.equal(await translateGeneratedMessage(store, { chatId: 'c', messageId: 'm1', swipeIndex: 0, mode: 'conversation', config }), null);
    assert.deepEqual(log, []);
    msg.role = 'user';
    assert.equal(await translateGeneratedMessage(store, { chatId: 'c', messageId: 'm1', swipeIndex: 0, mode: 'conversation', config }), null);
});

test('자동 번역: 설정은 답을 만들기 시작할 때 잡은 것 하나로 표시와 보내기 (마리나라 outputTranslationConfig). 글이 없는 말은 표시하지 않아요', async () => {
    const { real, room, say } = setup({ meta: { autoTranslate: true, translationOutputTargetLang: 'ko' } });
    const a = say('Mara', 'one', 1), act = say('Mara', '', 2), b = say('Mara', 'two', 3);
    const config = TR.translationConfigOf(real, room.id);
    // (turned off in between: the job began with it on, so its messages are still marked and translated with that config)
    await TR.liveSetTranslation(real, { autoTranslate: false, translationOutputTargetLang: 'fr' });
    assert.deepEqual(TR.markAutomaticTranslation(real, room.id, [a.id, act.id, b.id], config), [a.id, b.id]);
    assert.equal(act.extra, undefined);
    sent.length = 0;
    await TR.browserAutoTranslate(real, room.id, [a.id, b.id], config);
    assert.deepEqual(sent.map(r => new URL(r.url).searchParams.get('tl')), ['ko', 'ko']);
    assert.deepEqual([a.extra.translation, b.extra.translation], ['<one>', '<two>']);
    // (begun with it off: nothing)
    assert.deepEqual(TR.markAutomaticTranslation(real, room.id, [a.id], null), []);
});

test('브라우저의 자동 번역: 그 채팅이 열려 있지 않으면 묻지 않아요(모델 비용 없이). 표시만 남은 말은 그 Orbit이 다시 돌 때 이어서 해요 (한 페이지에 한 번, 서버가 번역 중인 방은 빼고)', async () => {
    const { real, room, say } = setup({ meta: { autoTranslate: true, translationOutputTargetLang: 'ko' } });
    const a = say('Mara', 'one', 1, { automaticTranslationSource: 'one' }), b = say('Mara', 'two', 2, { automaticTranslationSource: 'two' });
    const warns = [], warn = console.warn; console.warn = (...x) => warns.push(x);
    // (another chat is open)
    const md = T.ctx.chatMetadata; T.ctx.chatMetadata = { narrative_archive: { other: true } };
    sent.length = 0;
    try { await TR.browserAutoTranslate(real, room.id, [a.id, b.id]); } finally { console.warn = warn; T.ctx.chatMetadata = md; }
    assert.equal(sent.length, 0);
    assert.equal(a.extra.translation, undefined);
    // (the console's format string first: %s is the message id)
    assert.deepEqual(warns.map(x => [x[0], x[1], x[2]?.message]), [['[narrative-archive] [translate] 메시지 %s의 자동 번역에 실패했습니다', a.id, '이 채팅이 열려 있지 않습니다.'], ['[narrative-archive] [translate] 메시지 %s의 자동 번역에 실패했습니다', b.id, '이 채팅이 열려 있지 않습니다.']]);
    // 이어서 하기: 표시의 원문이 지금 글 · 번역 없음 · 숨기지 않은 캐릭터의 말
    const done = say('Mara', 'three', 3, { automaticTranslationSource: 'three', translation: '셋', translationSource: 'three' }), hid = say('Mara', 'four', 4, { automaticTranslationSource: 'four', translationHidden: true });
    const edited = say('Mara', 'five!', 5, { automaticTranslationSource: 'five' }), mine = say('Ren', 'six', 6, { automaticTranslationSource: 'six' });
    assert.deepEqual(TR.owedTranslations(real), [{ roomId: room.id, ids: [a.id, b.id] }]);
    void done; void hid; void edited; void mine;
    // (a room the server's worker is translating is left to it)
    const asked = [];
    await TR.resumeAutomaticTranslations(real, { busy: async () => new Set([room.id]), translate: (r, ids) => asked.push([r, ids]) });
    assert.deepEqual(asked, []);
    // (the same messages were sent by this page before — the failed run above —: not again. A message whose text is new is)
    await TR.resumeAutomaticTranslations(real, { translate: (r, ids) => asked.push([r, ids]) });
    assert.deepEqual(asked, []);
    a.text = 'one again'; a.extra.automaticTranslationSource = 'one again';
    await TR.resumeAutomaticTranslations(real);
    assert.deepEqual([a.extra.translation, a.extra.translationSource], ['<one again>', 'one again']);
    assert.deepEqual(TR.owedTranslations(real), [{ roomId: room.id, ids: [b.id] }]);
});

test('자동 번역 보내기의 wrap (서버 일꾼이 답 하나를 줄 한 번에): 말들을 다 도는 일을 감싸요. 감싸기가 실패하면 남은 말마다 경고 줄', async () => {
    const order = [], logs = [];
    await TR.dispatchAutomaticTranslations({ chatId: 'c', ids: ['a', 'b'], config: {}, run: async id => order.push(`run:${id}`), wrap: async fn => { order.push('in'); await fn(); order.push('out'); }, log: () => {} });
    assert.deepEqual(order, ['in', 'run:a', 'run:b', 'out']);
    await TR.dispatchAutomaticTranslations({ chatId: 'c', ids: ['a', 'b'], config: {}, run: async () => assert.fail(), wrap: async () => { throw new Error('blocked'); }, log: (...x) => logs.push(x) });
    assert.deepEqual(logs.map(x => [x[1], x[2].message]), [['a', 'blocked'], ['b', 'blocked']]);
    assert.equal(TR.liveTranslating({}, 'c'), false);
});

test('translateGenerated의 detached: 말의 사본에만 (원래 말 · 저장은 그대로) — 번역을 받아 오기만. 그 번역을 cached로 넣어요', async () => {
    const { real, room, say } = setup({ meta: { autoTranslate: true, translationOutputTargetLang: 'ko' } });
    const a = say('Mara', 'one', 1);
    const chatId = `${L.liveWorld(real).id}:${room.id}`, config = TR.translationConfigOf(real, room.id);
    let got = null, saves = 0;
    assert.ok(await TR.translateGenerated(real, chatId, a.id, config, { detached: true, save: async () => { saves++; }, keep: t => { got = t; } }));
    assert.deepEqual([got, a.extra, saves], ['<one>', undefined, 0]);
    sent.length = 0;
    await TR.translateGenerated(real, chatId, a.id, config, { cached: got, save: async () => { saves++; } });
    assert.deepEqual([sent.length, a.extra.translation, saves > 0], [0, '<one>', true]);
});

test('토큰 어림 (마리나라 estimateTextTokens: 한글 0.5 · 한자 · 가나 0.67 · 나머지 0.25, 올림) → "~N 토큰" (숫자는 toLocaleString)', async () => {
    const { estimateTextTokens, sliceTextToTokenBudget } = await import(href('marinara/token-estimator.js'));
    assert.deepEqual([estimateTextTokens(''), estimateTextTokens('abcd'), estimateTextTokens('abcde'), estimateTextTokens('안녕'), estimateTextTokens('漢字'), estimateTextTokens('かな'), estimateTextTokens('😀')], [0, 1, 2, 1, 2, 2, 1]);
    assert.equal(sliceTextToTokenBudget('안녕하세요', 1), '안녕');
    assert.equal(TR.liveTokenEstimate(DEFAULT_TRANSLATION_SYSTEM_PROMPT), `~${Math.ceil(DEFAULT_TRANSLATION_SYSTEM_PROMPT.length * 25 / 100)} 토큰`);
    assert.equal(TR.liveTokenEstimate('a'.repeat(4000 * 4)), `~${(4000).toLocaleString()} 토큰`);
});

// ---- 7. 옛 한국어 옮기기
test('옛 한국어(ko) 옮기기: 방의 말 · 받아 둔 답장 · 휴지통의 말, 원문은 그때의 글. 이미 번역이 있으면 그것을 남겨요. 빈 ko는 지우기만', () => {
    const { real, room, say } = setup();
    const a = say('Mara', 'Hi', 1); a.ko = '안녕';
    const b = say('Mara', '응', 2); b.ko = '';
    const c = say('Mara', 'Yo', 3, { translation: '요', translationSource: 'Yo' }); c.ko = '다른 것';
    room.swipes = { [a.id]: { list: [[{ id: 's', text: 'Later', ko: '나중에' }], null], at: 1 } };
    room.trash = [{ x: { id: 't', text: 'Bye', ko: '잘 가' }, at: 1, swipes: { list: [[{ id: 'ts', text: 'Old', ko: '옛' }], null], at: 1 } }];
    assert.equal(TR.migrateKo(real), 6);
    assert.deepEqual([a.extra, b.extra, c.extra], [{ translation: '안녕', translationSource: 'Hi' }, undefined, { translation: '요', translationSource: 'Yo' }]);
    assert.deepEqual(room.swipes[a.id].list[0][0].extra, { translation: '나중에', translationSource: 'Later' });
    assert.deepEqual(room.trash[0].x.extra, { translation: '잘 가', translationSource: 'Bye' });
    assert.deepEqual(room.trash[0].swipes.list[0][0].extra, { translation: '옛', translationSource: 'Old' });
    assert.ok(!JSON.stringify(real.live).includes('"ko"'));
    assert.equal(TR.migrateKo(real), 0);
    assert.equal(TR.migrateKo({ phones: {} }), 0);
    // (a world looked through once is not looked through again — each draw and liveMeta call this —, until old data may have
    //  come in: a sync from the plugin clears the mark — 'na-live-change' — and the next call moves it)
    const late = say('Mara', 'Late', 4); late.ko = '늦게';
    assert.equal(TR.migrateKo(real), 0);
    assert.equal(late.ko, '늦게');
    TR.forgetKoMoved();
    assert.equal(TR.migrateKo(real), 1);
    assert.deepEqual(late.extra, { translation: '늦게', translationSource: 'Late' });
});

test('파일마다 어디서 왔고 무엇을 바꿨는지 적혀 있어요 (AGPL). DeepL · DeepLX 코드는 없어요', async () => {
    for (const f of ['translation.service.js', 'translator-defaults.js', 'translation-prompt.js', 'translation.store.js', 'use-translate.js', 'translate-text.js', 'draft-translation.js', 'use-translator-defaults.js', 'quote-format.js', 'token-estimator.js']) {
        const s = await readFile(new URL(`../src/marinara/${f}`, import.meta.url), 'utf8');
        assert.match(s, /^\/\/ Ported from Marinara Engine \(https:\/\/github\.com\/Pasta-Devs\/Marinara-Engine\), at cfc726e93/, f);
        assert.match(s, /GNU Affero General Public License v3\.0/, f);
        assert.match(s, /Changes for NarrativeArchive/, f);
        const code = s.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
        assert.doesNotMatch(code, /deepl/i, f);
    }
});
