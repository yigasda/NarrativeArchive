import test from 'node:test';
import assert from 'node:assert/strict';
// host globals only, as in modules.test.mjs
globalThis.document = { documentElement: {}, addEventListener() {} };
globalThis.MutationObserver = class { observe() {} };
globalThis.$ = () => ({ on() { return this; } });
test('near-miss names: days and months are not names, a real drift still shows', async () => {
    const { selfNearMissesRaw } = await import('../src/health.js');
    const text = [
        'On Thursday, Mara met Ren. By Thursday night they had argued. Thursday ended badly.',
        'Then on Tuesday, Mara left. In June and in July she wrote. Later in June, Mara called Ren.',
        'At dusk, Marra waited by the door.',
    ].join('\n');
    const out = selfNearMissesRaw(text);
    assert.ok(!out.some(x => /day$|^(June|July)$/.test(x.word) || /day$|^(June|July)$/.test(x.like)), JSON.stringify(out));
    assert.ok(out.some(x => x.word === 'Marra' && x.like === 'Mara'), JSON.stringify(out));
});
