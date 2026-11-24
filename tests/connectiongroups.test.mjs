// src/marinara/connection-groups.js — the "via {{service}}" helpers of Marinara's connection-groups.ts (connection picker)
import test from 'node:test';
import assert from 'node:assert/strict';
import { upstreamOf, knownPrefixName, viaName } from '../src/marinara/connection-groups.js';

test('upstreamOf: everything before the first "/", none when there is no prefix', () => {
    assert.equal(upstreamOf('nanogpt/zai-org/glm'), 'nanogpt');
    assert.equal(upstreamOf('  zai-org/glm  '), 'zai-org');
    assert.equal(upstreamOf('glm'), null);
    assert.equal(upstreamOf('/glm'), null);
    assert.equal(upstreamOf(null), null);
    assert.equal(upstreamOf(undefined), null);
});

test('knownPrefixName: a Marinara service name first, then the maker names, any letter case', () => {
    assert.equal(knownPrefixName('nanogpt'), 'NanoGPT');
    assert.equal(knownPrefixName('X-AI'), 'xAI');
    assert.equal(knownPrefixName('zai-org'), 'Z.AI');
    assert.equal(knownPrefixName('nousresearch'), 'Nous Research');
    assert.equal(knownPrefixName('somebody'), undefined);
});

test('viaName: only for a custom (gateway) connection whose model id starts with a known prefix', () => {
    assert.equal(viaName('custom', 'nanogpt/zai-org/glm'), 'NanoGPT');
    assert.equal(viaName('custom', 'meta-llama/llama-3'), 'Meta');
    assert.equal(viaName('custom', 'somebody/model'), null);
    assert.equal(viaName('custom', 'glm'), null);
    assert.equal(viaName('openai', 'zai-org/glm'), null);
    assert.equal(viaName(null, 'zai-org/glm'), null);
});
