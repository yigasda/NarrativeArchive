import test from 'node:test';
import assert from 'node:assert/strict';
// host globals only, as in modules.test.mjs
globalThis.document = { documentElement: {}, addEventListener() {} };
globalThis.MutationObserver = class { observe() {} };
globalThis.$ = () => ({ on() { return this; } });
test('달마다 접기 reads the month and place from a title, and only real month words', async () => {
    const { monthIn, placeIn } = await import('../src/browser.js');
    assert.equal(monthIn('#0–#9 — The garage (November 12–17, Seoul)'), 11);
    assert.equal(monthIn('#0–#9 — Sat (January, morning, Kronberg)'), 1);
    assert.equal(monthIn('#0–#9 — x (Sept 3, Varo)'), 9);
    assert.equal(monthIn('#0–#9 — x (11월 3일, 서울)'), 11);
    // places and words that only start like a month
    assert.equal(monthIn('#0–#9 — x (evening, Marseille)'), 0);
    assert.equal(monthIn('#0–#9 — x (night, Augsburg)'), 0);
    assert.equal(monthIn('#0–#9 — x (Novosibirsk, dawn)'), 0);
    assert.equal(monthIn('#0–#9 — x (she may stay, Varo)'), 0);
    assert.equal(monthIn('#0–#9 — no parentheses'), 0);
    assert.equal(placeIn('#0–#9 — x (November 12–17, Seoul)'), 'Seoul');
    assert.equal(placeIn('#0–#9 — x (January, afternoon)'), '');
    assert.equal(placeIn('#0–#9 — x (Hathyr 8, Varo → Eastgate)'), 'Varo');
});
