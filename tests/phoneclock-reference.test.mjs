import test from 'node:test';
import assert from 'node:assert/strict';
import { clockFallback } from '../src/phoneclock.js';

const p = (now, year = 2026) => ({ now, year });
test('clock reference uses the screen local date, not the owner date', () => {
    const r = clockFallback(p('11-05 00:10'), 'Asia/Seoul', 'Europe/Berlin', '16:30');
    assert.equal(r.local, '11-04 16:30');
    assert.equal(r.ownerTime, '11-05 00:30');
    assert.equal(r.rolled, false);
});
test('an earlier clock supplies only a next-day reference, with equality staying on that day', () => {
    const r = clockFallback(p('11-05 08:30'), 'Asia/Seoul', 'Asia/Seoul', '06:27');
    assert.equal(r.local, '11-06 06:27');
    assert.equal(r.rolled, true);
    assert.equal(clockFallback(p('11-05 08:30'), 'Asia/Seoul', 'Asia/Seoul', '08:30').local, '11-05 08:30');
});
test('reference conversions retain both full years at New Year in either direction', () => {
    let r = clockFallback(p('01-01 00:10', 2027), 'Asia/Seoul', 'America/Los_Angeles', '07:30');
    assert.equal(r.assumedDate, '2026-12-31');
    assert.equal(r.ownerTime, '01-01 00:30');
    assert.equal(r.ownerYear, 2027);
    r = clockFallback(p('12-31 23:30'), 'America/Los_Angeles', 'Asia/Seoul', '17:00');
    assert.equal(r.assumedDate, '2027-01-01');
    assert.equal(r.ownerTime, '01-01 00:00');
    assert.equal(r.ownerYear, 2027);
});
test('month ends and leap days stay real calendar dates', () => {
    assert.equal(clockFallback(p('02-28 23:50', 2028), 'UTC', 'UTC', '00:10').assumedDate, '2028-02-29');
    assert.equal(clockFallback(p('02-28 23:50', 2027), 'UTC', 'UTC', '00:10').assumedDate, '2027-03-01');
    assert.equal(clockFallback(p('04-30 23:50'), 'UTC', 'UTC', '00:10').assumedDate, '2026-05-01');
});
test('a reference needs a complete valid saved timestamp and a saved year', () => {
    for (const saved of [{ now: '11-05 08:30' }, p('11-05'), p('08:30'), p('02-29', 2027), p('02-31 08:30'),
        p('13-01 08:30'), p('00-01 08:30'), p('11-05 24:30'), p('11-05 08:99'), p('11-05 08:30', 0),
        { ...p('11-05 08:30'), noYear: true }]) assert.equal(clockFallback(saved, 'UTC', 'UTC', '09:00'), null);
    for (const clock of ['25:00', '12:99', '1:00', '', '13:30 PM']) assert.equal(clockFallback(p('11-05 08:30'), 'UTC', 'UTC', clock), null);
    assert.equal(clockFallback(p('11-05 08:30'), 'invalid', 'UTC', '09:00'), null);
});
test('DST gaps and folds are omitted rather than guessed, including the saved anchor', () => {
    assert.equal(clockFallback(p('03-29 00:30'), 'Europe/Berlin', 'Europe/Berlin', '02:30'), null);
    assert.equal(clockFallback(p('10-25 00:30'), 'Europe/Berlin', 'Europe/Berlin', '02:30'), null);
    assert.equal(clockFallback(p('03-29 02:30'), 'Europe/Berlin', 'Asia/Seoul', '12:00'), null);
    assert.equal(clockFallback(p('10-25 02:30'), 'Europe/Berlin', 'Asia/Seoul', '12:00'), null);
    assert.equal(clockFallback(p('04-05 00:30'), 'Australia/Lord_Howe', 'Australia/Lord_Howe', '01:45'), null);
});
test('valid DST and fractional-offset references retain exact minutes', () => {
    const r = clockFallback(p('03-29 06:30'), 'Asia/Seoul', 'Europe/Berlin', '03:30');
    assert.equal(r.assumedDate, '2026-03-29');
    assert.equal(r.ownerTime, '03-29 10:30');
    assert.equal(clockFallback(p('11-05 20:00'), 'Asia/Kathmandu', 'America/New_York', '13:00').ownerTime, '11-05 23:45');
});
