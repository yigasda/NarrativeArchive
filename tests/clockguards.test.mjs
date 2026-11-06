// 시각 판독 손보기 1단계: what was already wrong, made right before anything new is read
import test from 'node:test';
import assert from 'node:assert/strict';
import { datedClocks, dayFirstChat, dateOrderSource, storyText, when, withDateOrder } from '../src/phoneparse.js';

test('overlapping runs each read by their own order; when they are all done, the chat\'s own setting is back (never a finished run\'s)', async () => {
    let setting = 'dm';
    dateOrderSource(() => setting);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    // a fill begins under 일.월, a second one too; the user then switches the chat to 월.일
    const a = withDateOrder('dm', async () => { await wait(20); return when('11.05'); });
    const b = withDateOrder('dm', async () => { await wait(5); return when('11.05'); });
    assert.deepEqual(await Promise.all([a, b]), ['05-11', '05-11']);
    setting = 'md';
    assert.equal(dayFirstChat(), false);
    assert.equal(when('11.05'), '11-05');
    // the first to begin ending first used to leave its order behind: the chat set to 일.월 afterwards still read 월.일
    const c = withDateOrder('md', async () => { await wait(5); return when('11.05'); });
    const d = withDateOrder('dm', async () => { await wait(20); return 'x'; });
    await Promise.all([c, d]);
    setting = 'dm';
    assert.equal(when('11.05'), '05-11');
    dateOrderSource(() => '');
});

test('the story\'s own words in a request are its story blocks only: never the OWNER\'S CLOCK, the app\'s records or time choices', () => {
    const input = ['[ARCHIVE]\n## #0–#3 — Start\n- Mara said hello.', '[RECENT CHAT]\n[#4] Mara: Varo Bank paid 3 euros a share today', "[OWNER'S CLOCK]\nPhone owner: Mara\nSaved phone time: 11-05 03:38",
        '[PHONE NOW]\n{"money":"Dividend 11-20"}', '[EXISTING QUOTES]\n[{"value":12}]', '[OWNER PROFILE — chosen by the user for Mara]\nMara holds 5% of Ivo Werkstatt', '[OWNER]\nMara'].join('\n\n');
    const s = storyText(input);
    for (const ok of ['Mara said hello.', 'Varo Bank paid 3 euros a share today', 'Mara holds 5% of Ivo Werkstatt']) assert.ok(s.includes(ok), ok);
    for (const no of ['Saved phone time: 11-05 03:38', 'Dividend 11-20', '"value":12']) assert.ok(!s.includes(no), no);
    // (a message line "[#4] …" is no block of its own)
    assert.ok(s.includes('[#4] Mara'));
});

test('a day no calendar has is no clock reading (02-30, 04-31, 02-29 of a year that isn\'t a leap year); a real leap day is', () => {
    assert.deepEqual(datedClocks('2026-02-30 16:15 / 04.31 16:15 / 2026-02-29 16:15').map(x => x.local), []);
    assert.deepEqual(datedClocks('2028-02-29 16:15 · 02-29 16:15 · 11-05 16:15').map(x => x.local), ['02-29 16:15', '02-29 16:15', '11-05 16:15']);
});
