// 실리를 거쳐 가는 요청에서 추론 레벨이 실제로 무엇이 되나 (src/phone2stlevel.js: SillyTavern 1.19.1의 코드를 옮긴 표)
import test from 'node:test';
import assert from 'node:assert/strict';
import { stClientEffort, stServerEffort, stReach, stWord, REACH_NAME } from '../src/phone2stlevel.js';

const LV = ['none', 'low', 'medium', 'high', 'xhigh', 'max'];
const row = (via, model) => LV.map(level => stReach({ via, model, level }));

test('브라우저 쪽 (getReasoningEffort · createGenerationParameters): 연결 종류마다 낱말을 바꾸거나 지워요', () => {
    const c = (source, model, level, thoughts = true) => stClientEffort({ source, model, level, thoughts });
    assert.deepEqual(['auto', 'min', 'low', 'medium', 'high', 'max'].map(l => c('claude', 'claude-opus-4-8', l)), ['auto', 'min', 'low', 'medium', 'high', 'max']);   // (목록에 없는 연결: 그대로)
    assert.deepEqual(['auto', 'min', 'low', 'medium', 'high', 'max'].map(l => c('deepseek', 'deepseek-v4-pro', l)), [undefined, 'low', 'low', 'high', 'high', 'max']);
    assert.deepEqual(['auto', 'min', 'max'].map(l => c('fireworks', 'x', l)), [undefined, 'low', 'max']);
    assert.deepEqual(['auto', 'min', 'max'].map(l => c('custom', 'koboldcpp/x', l)), [undefined, 'minimal', 'xhigh']);
    assert.deepEqual([c('openai', 'gpt-5.5', 'min'), c('openai', 'gpt-5.2', 'min'), c('openai', 'o3', 'min'), c('custom', 'gpt-5.5', 'min')], ['none', 'min', 'low', 'low']);
    assert.deepEqual([c('openrouter', 'x', 'min', false), c('openrouter', 'x', 'min', true)], ['none', 'low']);
    assert.deepEqual([c('openai', 'gpt-6-astra', 'max'), c('openai', 'gpt-5.6-sol', 'max'), c('openai', 'gpt-5.5', 'max')], ['max', 'xhigh', 'high']);
    assert.deepEqual([c('azure_openai', 'gpt-4o', 'high'), c('xai', 'grok-4.5', 'high'), c('xai', 'grok-3-mini', 'high'), c('openrouter', 'anthropic/claude-opus-5', 'high'), c('claude', 'claude-opus-5', 'high')], [undefined, undefined, 'high', undefined, 'high']);
});

test('서버 쪽: 연결 종류 · 모델마다 그 API의 값으로', () => {
    const s = (source, model, value, thoughts = true) => stServerEffort({ source, model, value, thoughts });
    assert.deepEqual(['auto', 'min', 'low', 'medium', 'high', 'max'].map(v => s('claude', 'claude-opus-4-8', v)), [null, 'low', 'low', 'medium', 'high', 'max']);
    assert.deepEqual(['auto', 'min', 'max'].map(v => s('claude', 'claude-sonnet-4-5', v)), [null, 'b:min', 'b:max']);
    assert.equal(s('claude', 'claude-3-5-sonnet-latest', 'high'), null);
    assert.deepEqual(['auto', 'min', 'low', 'max'].map(v => s('makersuite', 'gemini-2.5-flash-lite', v)), [null, 'off', 'b:low', 'b:max']);
    assert.deepEqual(['min', 'low'].map(v => s('vertexai', 'gemini-3.7-flash', v)), ['low', 'low']);
    assert.equal(s('makersuite', 'gemini-2.5-flash-image', 'high'), null);
    assert.deepEqual([s('deepseek', 'x', 'high', true), s('deepseek', 'x', 'high', false), s('deepseek', 'x', undefined, true)], ['high', 'off', 'on']);
    assert.deepEqual([s('moonshot', 'kimi-k3', 'high', true), s('zai', 'glm-5.3', 'high', false)], ['on', 'off']);
    assert.deepEqual([s('xai', 'grok-3-mini', 'medium'), s('xai', 'grok-3-mini', 'high')], ['low', 'high']);
    assert.deepEqual(['min', 'low', 'medium', 'high', 'max'].map(v => s('nanogpt', 'x', v)), ['off', 'minimal', 'low', 'medium', 'high']);
    assert.deepEqual([s('openai', 'gpt-5.5', 'none'), s('openai', 'gpt-5', 'min'), s('openai', 'gpt-5.3-chat-latest', 'high'), s('openai', 'gpt-4o', 'high'), s('custom', 'whatever', 'high'), s('openrouter', 'x', 'none')], ['off', 'minimal', 'medium', null, null, 'off']);
    assert.equal(s('mistralai', 'mistral-large-4', 'high'), null); assert.equal(s('cohere', 'command-a', 'high'), null);
});

test('한 줄로: 길 · 모델 · 레벨 → 실제로 닿는 것 (칩은 여기서 나와요)', () => {
    assert.deepEqual(row('vertex', 'gemini-2.5-flash'), ['off', 'b:low', 'b:medium', 'b:high', 'b:max', 'b:max']);
    assert.deepEqual(row('vertex', 'gemini-2.5-pro'), ['b:min', 'b:low', 'b:medium', 'b:high', 'b:max', 'b:max']);
    assert.deepEqual(row('vertex', 'gemini-3.1-pro'), ['low', 'low', 'low', 'high', 'high', 'high']);
    assert.deepEqual(row('vertex', 'gemini-3.8-flash'), ['minimal', 'low', 'medium', 'high', 'high', 'high']);
    assert.deepEqual(row('vertex', 'gemini-4-neon'), [null, null, null, null, null, null]);
    assert.deepEqual(row('source:claude', 'claude-opus-4-8'), ['low', 'low', 'medium', 'high', 'max', 'max']);
    assert.deepEqual(row('source:claude', 'claude-haiku-5-5'), [null, null, null, null, null, null]);
    assert.deepEqual(row('source:openai', 'gpt-5.5'), ['off', 'low', 'medium', 'high', 'high', 'high']);
    assert.deepEqual(row('source:openai', 'gpt-4o'), [null, null, null, null, null, null]);
    assert.deepEqual(row('source:deepseek', 'deepseek-v4-pro'), ['off', 'low', 'high', 'high', 'max', 'max']);
    assert.deepEqual(row('profile:openrouter', 'openai/gpt-5.5'), ['off', 'low', 'medium', 'high', 'high', 'high']);
    assert.deepEqual(row('source:zai', 'glm-5.3'), ['off', 'on', 'on', 'on', 'on', 'on']);
    assert.deepEqual(row('', 'x'), [null, null, null, null, null, null]);
    assert.deepEqual(['', 'none', 'low', 'xhigh', 'maximum', 'max'].map(stWord), ['auto', 'min', 'low', 'max', 'max', 'max']);
    for (const r of ['off', 'on', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'b:min', 'b:max']) assert.ok(REACH_NAME[r], r);
});
