// 폰 2 실제 시간 시계 (단계 4-1): the real wall clock where each person is, its date moved by the world's dayShift
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as C from '../src/phone2clock.js';

const at = s => Date.parse(s);

test('폰 2 시계: the file imports nothing, and nothing of 폰 1 imports it', async () => {
    const src = f => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(await src('phone2clock.js'), /^\s*import\b/m);
    for (const f of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.js') && f !== 'phone2clock.js'))
        assert.doesNotMatch(await src(f), /phone2clock/, f);
});

test('폰 2 시계: each place\'s real wall clock, weekday too; no shift is the real date', () => {
    const t = at('2026-11-06T05:40:00Z');
    assert.deepEqual(C.liveWall('Europe/Berlin', 0, t), { year: 2026, at: '11-06 06:40', wd: 'Fri' });
    assert.deepEqual(C.liveWall('Asia/Seoul', 0, t), { year: 2026, at: '11-06 14:40', wd: 'Fri' });
    assert.deepEqual(C.liveWall('America/New_York', 0, t), { year: 2026, at: '11-06 00:40', wd: 'Fri' });
    // (a zone that can't be read: UTC, never a throw)
    assert.deepEqual(C.liveWall('Nowhere/City', 0, t), { year: 2026, at: '11-06 05:40', wd: 'Fri' });
});

test('폰 2 시계: the shift moves the date only; hours and minutes stay the real clock\'s, over months, years and summer time', () => {
    const t = at('2026-12-31T22:30:00Z');
    assert.deepEqual(C.liveWall('Europe/Berlin', 2, t), { year: 2027, at: '01-02 23:30', wd: 'Sat' });
    assert.deepEqual(C.liveWall('Europe/Berlin', -1, t), { year: 2026, at: '12-30 23:30', wd: 'Wed' });
    // (summer time ends in Germany on 10-25: a shift across it keeps the real 10:00)
    assert.deepEqual(C.liveWall('Europe/Berlin', 3, at('2026-10-23T08:00:00Z')), { year: 2026, at: '10-26 10:00', wd: 'Mon' });
    // (a leap day)
    assert.deepEqual(C.liveWall('UTC', 1, at('2028-02-28T12:00:00Z')), { year: 2028, at: '02-29 12:00', wd: 'Tue' });
});

test('폰 2 이야기에서 시작: the story\'s date, the real clock; a real clock earlier than the story\'s goes to the next day', () => {
    // (real: Berlin 11-10 09:00; story 11-13 15:00 → 11-14 09:00, +4 days)
    const real = at('2026-11-10T08:00:00Z');
    const s = C.startShift({ storyAt: '11-13 15:00', storyYear: 2026, tz: 'Europe/Berlin', realMs: real });
    assert.equal(s, 4);
    assert.deepEqual(C.liveWall('Europe/Berlin', s, real), { year: 2026, at: '11-14 09:00', wd: 'Sat' });
    // (a real clock later in the day: the story's very date)
    assert.equal(C.startShift({ storyAt: '11-13 08:00', storyYear: 2026, tz: 'Europe/Berlin', realMs: real }), 3);
    // (the very minute: the same day)
    assert.equal(C.startShift({ storyAt: '11-13 09:00', storyYear: 2026, tz: 'Europe/Berlin', realMs: real }), 3);
    // (a story behind the real date, and one a year away)
    assert.equal(C.startShift({ storyAt: '11-01 07:00', storyYear: 2026, tz: 'Europe/Berlin', realMs: real }), -9);
    assert.equal(C.startShift({ storyAt: '01-02 07:00', storyYear: 2027, tz: 'Europe/Berlin', realMs: real }), 53);
    // (the owner's own zone decides the day: 08:00Z is 17:00 in Seoul, later than a 15:00 story)
    assert.equal(C.startShift({ storyAt: '11-13 15:00', storyYear: 2026, tz: 'Asia/Seoul', realMs: real }), 3);
    assert.throws(() => C.startShift({ storyAt: '11-13', storyYear: 2026, tz: 'UTC' }), /이야기 시각/);
    assert.throws(() => C.startShift({ storyAt: '11-13 15:00', tz: 'UTC' }), /연도/);
});

test('폰 2 시계: the small label, and the messenger time in the viewer\'s own zone with the same shift', () => {
    assert.equal(C.shiftLabel(0), '');
    assert.equal(C.shiftLabel(2), '현실보다 +2일');
    assert.equal(C.shiftLabel(-3), '현실보다 −3일');
    const t = at('2026-11-06T05:40:00Z');
    assert.deepEqual(C.viewerWall(t, 2, 'Asia/Seoul'), { year: 2026, at: '11-08 14:40', wd: 'Sun' });
});
