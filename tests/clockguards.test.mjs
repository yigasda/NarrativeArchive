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

test('evidence: a part of the story that only looks like a block stays; every block the code makes goes', () => {
    const input = ['[ARCHIVE]\n## #0–#3 — Start\n- Mara said hello.', '[RECENT CHAT]\n[#4] Ren opens the news app.',
        '[BREAKING NEWS]\nHanbit Corp shares closed at 81,200 won today.', '[A text from Mina]\nI bought 5% of Hanbit.', '[MEMO TO SHAREHOLDERS]\nA dividend of 300 won a share on 12-20.',
        "[OWNER'S CLOCK]\nPhone owner: Mara\nSaved phone time: 11-05 03:38", '[INVESTMENTS NOW]\n{"base":"KRW"}', '[EXISTING QUOTES]\n[]', '[EVALUATION DATE]\n2026-11-05',
        '[INVESTMENTS SO FAR — what you wrote]\n{}', '[NAMES]\n- Mina = 미나'].join('\n\n');
    const s = storyText(input);
    for (const kept of ['Mara said hello.', 'Ren opens the news app.', 'closed at 81,200 won today', 'I bought 5% of Hanbit.', 'A dividend of 300 won']) assert.ok(s.includes(kept), kept);
    for (const gone of ['Saved phone time', '"base":"KRW"', 'EXISTING QUOTES', '2026-11-05', 'what you wrote', '미나']) assert.ok(!s.includes(gone), gone);
});

test('evidence: the story\'s own bracket headers that start like a code block\'s name stay ([DATE NIGHT], [DIARY ENTRY], [BANK ALERT], [DAYS LATER]); the code\'s own go', () => {
    const story = ['[DATE NIGHT]\nRen and Mara at the bar.', '[DIARY ENTRY]\nToday I sold my Hanbit shares.', '[BANK ALERT]\nDividend 300 won received.', '[DAYS LATER]\nMara bought 10 shares.'];
    const code = ['[DATE]\n2026-11-05', '[DIARY]\n(none)', '[BANK — separate locked balances]\n{"x":1}', '[DAYS]\n["11-05"]', '[FINANCIAL SCALE]\n{"scale":9}', '[WEALTH]\n{"w":2}', '[REBUILD ACCOUNTS]\n{"r":3}', '[DEVICE — locked]\n{"d":4}'];
    const s = storyText(['[RECENT CHAT]\n[#4] Ren: hi', ...story, ...code, '[RECENT CHAT]\n[#9] Ren: after'].join('\n\n'));
    for (const kept of ['Ren and Mara at the bar.', 'sold my Hanbit shares', 'Dividend 300 won received.', 'Mara bought 10 shares.', '[#9] Ren: after']) assert.ok(s.includes(kept), kept);
    for (const gone of ['2026-11-05', '(none)', '"x":1', '["11-05"]', '"scale":9', '"w":2', '"r":3', '"d":4']) assert.ok(!s.includes(gone), gone);
});

test('evidence: the investment schedules the app sends ([EXISTING SCHEDULES — …]) are no story', () => {
    const s = storyText(['[RECENT CHAT]\n[#4] Ren: hi', '[EXISTING SCHEDULES — app data, not evidence]\n[{"pay":"12-20"}]'].join('\n\n'));
    assert.ok(s.includes('[#4] Ren: hi') && !s.includes('12-20'));
});
