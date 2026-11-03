// 스크린타임: the model's numbers cleaned, a day it left out worked out, and the story changing their usual
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLife, screenOf, usualScreenOf } from '../src/phonesynclife.js';
import { kindOfApp, screenView } from '../src/phonescreen.js';

const usual = { apps: [{ app: 'Signal', kind: 'chat', min: 60 }, { app: 'Brawl Arena', kind: 'game', min: 90 }, { app: 'Mail', kind: 'work', min: 40 }], pickups: 80, late: '00:30' };
function phone(days) {
    return { owner: 'Mara', now: '10-26 12:00', threads: [], calls: [], photos: [], life: { health: { usual: { sleep: '23:30', wake: '07:00', screen: usual }, days } } };
}

test('screenOf: object or list, minutes kept inside the day, nothing given is none', () => {
    assert.deepEqual(screenOf({ apps: { Signal: 50, 'Brawl Arena': 120, Nope: -3 }, pickups: 70, late: '01:15' }), { apps: { 'Brawl Arena': 120, Signal: 50 }, pickups: 70, late: '01:15' });
    assert.deepEqual(screenOf({ apps: [{ app: 'Signal', min: 30 }, { name: 'Signal', min: 10 }] }), { apps: { Signal: 40 } });
    const big = screenOf({ apps: { A: 1000, B: 1000 } });
    assert.ok(Object.values(big.apps).reduce((a, b) => a + b, 0) <= 1440);
    assert.equal(screenOf({}), null);
    assert.equal(screenOf('lots'), null);
});

test('usualScreenOf: a kind it does not know is other', () => {
    const u = usualScreenOf({ apps: [{ app: 'Signal', kind: 'Chat', min: 60 }, { app: 'Odd', kind: 'weird', min: 5 }, { app: '', min: 9 }], pickups: 90, late: '23:50' });
    assert.deepEqual(u, { apps: [{ app: 'Signal', kind: 'chat', min: 60 }, { app: 'Odd', kind: 'other', min: 5 }], pickups: 90, late: '23:50' });
    assert.equal(usualScreenOf({ apps: [] }), null);
});

test('kindOfApp: the usual first, then the name', () => {
    assert.equal(kindOfApp('Brawl Arena', usual.apps), 'game');
    assert.equal(kindOfApp('YouTube'), 'video');
    assert.equal(kindOfApp('카카오톡'), 'chat');
    assert.equal(kindOfApp('Something'), 'other');
});

test('screenView: a story day as told, a day left out worked out, today only so far', () => {
    const p = phone([
        { date: '10-24', sleep: '23:40', wake: '07:00' },
        { date: '10-25', sleep: '03:10', wake: '07:00', screen: { apps: { Signal: 200, 'Brawl Arena': 10 }, pickups: 150, late: '03:05' } },
        { date: '10-26', sleep: '23:30', wake: '07:00' },
    ]);
    p.threads = [{ messages: [{ time: '10-24 10:00' }, { time: '10-24 10:05' }, { time: '10-24 11:00' }] }];
    const v = screenView(p, '10-26 12:00');
    assert.equal(v.days.length, 3);
    const [d24, d25, d26] = v.days;
    assert.equal(d24.from, 'worked');
    assert.ok(d24.apps.some(([a]) => a === 'Signal') && d24.total > 0);
    assert.equal(d25.from, 'story');
    assert.equal(d25.total, 210);
    assert.equal(d25.byKind.chat, 200);
    assert.equal(d25.late, '03:05');
    assert.ok(d26.today && d26.late === '');
    // the same day worked out twice is the same day
    assert.deepEqual(screenView(p, '10-26 12:00').days[0], d24);
    assert.ok(v.lines.some(l => l.includes('새벽 03:05')));
    assert.ok(v.lines[0].startsWith('일평균'));
});

test('screenView: no screen anywhere is nothing to show', () => {
    const p = phone([{ date: '10-25', sleep: '23:40', wake: '07:00' }]);
    delete p.life.health.usual.screen;
    assert.equal(screenView(p, '10-26 12:00'), null);
});

test('reflection: the story changes their usual phone use, and it can be taken back', () => {
    const p = phone([]);
    const r = applyLife(p, { id: 'quit-game', at: 3, date: '10-26', time: '20:00' }, { usual: { screen: { apps: [{ app: 'Signal', kind: 'chat', min: 70 }, { app: 'Kindle', kind: 'reading', min: 50 }] } } }, true);
    const s = p.life.health.usual.screen;
    assert.deepEqual(s.apps.map(a => a.app), ['Signal', 'Kindle']);
    assert.equal(s.pickups, 80);
    const fx = r.effects.find(e => e.path === 'life.health.usual.screen');
    assert.equal(fx.from.apps[1].app, 'Brawl Arena');
    // a story day with its screen
    applyLife(p, { id: 'fight', at: 4, date: '10-26', time: '23:00' }, { health: [{ date: '10-26', sleep: '02:30', wake: '08:00', screen: { apps: { Signal: 240 }, late: '02:25' } }] }, true);
    assert.deepEqual(p.life.health.days.find(d => d.date === '10-26').screen, { apps: { Signal: 240 }, late: '02:25' });
});
