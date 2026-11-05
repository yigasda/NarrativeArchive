import test from 'node:test';
import assert from 'node:assert/strict';
import { datedClocks, yearIn, withDateOrder } from '../src/phoneparse.js';

test('dated clock extraction is bounded to adjacent dates and clocks', () => {
    for (const text of ['08:30 PM', 'Mara 5 08:30', '11.05\n08:30', '11.05. Later 08:30',
        '111.05 08:30', 'x11.05 08:30', '11.05 008:30', '11.05 08:300', '11.05 08:30:59',
        '11.05 25:30', '11.05 08:99', 'November 555 08:30', 'Notnovember 5 08:30']) {
        assert.deepEqual(datedClocks(text), [], text);
    }
    assert.deepEqual(datedClocks('11.05 08:30 AM; 11.05 08:30 PM'), [
        { sourceTime: '11.05 08:30 AM', local: '11-05 08:30' },
        { sourceTime: '11.05 08:30 PM', local: '11-05 20:30' },
    ]);
});
test('dated clocks preserve per-request date order and explicit year-first order', async () => {
    await withDateOrder('dm', () => {
        assert.equal(datedClocks('11.05, 8:30 PM')[0].local, '05-11 20:30');
        assert.equal(datedClocks('2026/11/05T08:30')[0].local, '11-05 08:30');
        assert.equal(datedClocks('November 5th, 2026 08:30')[0].local, '11-05 08:30');
    });
});
test('years in numeric trailing-year dates are retained without accepting bare years', () => {
    for (const text of ['31.03.2024 01:30', '03/31/2024 01:30', '03-31-2024', '31.03. 2024']) assert.equal(yearIn(text), '2024', text);
    assert.equal(yearIn('31.03.2024 then 2025-04-01'), '2025');
    assert.equal(yearIn('2025-04-01 then 31.03.2024'), '2024');
    for (const text of ['2024', '2019년에 헤어졌다', '2050원', '11.05 2024', '131.03.2024', '31.03.20245', '31.31.2024']) assert.equal(yearIn(text), '', text);
});

test('dated clocks keep dotted meridiems and month abbreviations', () => {
    assert.deepEqual(datedClocks('5. Nov. 2026 12:30 p.m.'), [{ sourceTime: '5. Nov. 2026 12:30 p.m.', local: '11-05 12:30' }]);
});

test('dated clocks bind English and Korean meridiem before or after the clock', () => {
    for (const [marker, time, expected] of [
        ['PM', '8:30', '20:30'], ['p.m.', '8:30', '20:30'], ['오후', '8:30', '20:30'],
        ['저녁', '8:30', '20:30'], ['밤', '8:30', '20:30'],
        ['AM', '12:30', '00:30'], ['a.m.', '12:30', '00:30'], ['오전', '12:30', '00:30'],
        ['새벽', '12:30', '00:30'], ['아침', '12:30', '00:30'],
    ]) for (const clock of [`${marker} ${time}`, `${time} ${marker}`]) {
        const sourceTime = `11.05 ${clock}`;
        assert.deepEqual(datedClocks(sourceTime), [{ sourceTime, local: `11-05 ${expected}` }], sourceTime);
    }
    for (const text of ['11.05 PM\n8:30', '11.05 오후\n8:30', '11.05 PMs 8:30', '11.05 오후에 8:30']) {
        assert.deepEqual(datedClocks(text), [], text);
    }
    for (const tail of ['\nPM', '\n오후', '. PM', '. 오후', ' PMs', ' 오후에']) {
        assert.deepEqual(datedClocks(`11.05 8:30${tail}`), [{ sourceTime: '11.05 8:30', local: '11-05 08:30' }]);
    }
});

test('meridiem clocks require twelve-hour values without restricting plain 24-hour clocks', () => {
    for (const marker of ['AM', 'PM', 'a.m.', 'p.m.', '오전', '오후', '새벽', '아침', '저녁', '밤']) {
        for (const hour of ['0', '00', '13', '23', '24']) {
            for (const clock of [`${marker} ${hour}:30`, `${hour}:30 ${marker}`]) {
                assert.deepEqual(datedClocks(`11.05 ${clock}`), [], clock);
            }
        }
    }
    for (const hour of ['00', '13', '23']) {
        const sourceTime = `11.05 ${hour}:30`;
        assert.deepEqual(datedClocks(sourceTime), [{ sourceTime, local: `11-05 ${hour}:30` }]);
    }
});
