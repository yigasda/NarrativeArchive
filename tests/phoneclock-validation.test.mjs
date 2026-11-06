import test from 'node:test';
import assert from 'node:assert/strict';
import { exactClockShift } from '../src/phoneclock.js';

test('exact clock validation uses the supplied date, half-hour offsets and year crossings', () => {
    assert.equal(exactClockShift('11-05 12:32','Asia/Seoul','Europe/Berlin',2026),'11-05 04:32');
    assert.equal(exactClockShift('07-05 12:32','Asia/Seoul','Europe/Berlin',2026),'07-05 05:32');
    assert.equal(exactClockShift('01-01 00:24','Asia/Seoul','Europe/Berlin',2027),'12-31 16:24');
    assert.equal(exactClockShift('11-05 12:32','Asia/Kolkata','UTC',2026),'11-05 07:02');
});

test('ambiguous or nonexistent DST clocks and unknown years do not invent a validation result', () => {
    assert.equal(exactClockShift('03-29 02:30','Europe/Berlin','Asia/Seoul',2026),null);
    assert.equal(exactClockShift('10-25 02:30','Europe/Berlin','Asia/Seoul',2026),null);
    assert.equal(exactClockShift('11-05 12:32','Asia/Seoul','Europe/Berlin',null),null);
    assert.equal(exactClockShift('02-30 12:32','Asia/Seoul','Europe/Berlin',2026),null);
    assert.equal(exactClockShift('11-05 12:32','Unknown','Europe/Berlin',2026),null);
});
