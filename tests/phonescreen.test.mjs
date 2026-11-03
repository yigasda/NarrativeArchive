// 스크린타임: the model's numbers cleaned, a day it left out worked out, and the story changing their usual
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLife, screenChange, screenOf, usualScreenOf } from '../src/phonesynclife.js';
import { appOf, kindOfApp, SCREEN_LIST, screenView } from '../src/phonescreen.js';

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

test('a name written another way is the same app, with its icon', () => {
    assert.deepEqual(screenOf({ apps: { 인스타: 30, Instagram: 20, 카톡: 10 } }), { apps: { Instagram: 50, KakaoTalk: 10 } });
    assert.deepEqual(usualScreenOf({ apps: [{ app: '포켓몬 고', min: 40 }] }).apps, [{ app: 'Pokémon GO', kind: 'game', min: 40 }]);
    assert.equal(appOf('YouTube Music').id, 'youtubemusic');
    assert.equal(appOf('Some Indie Game'), null);
    assert.ok(SCREEN_LIST.includes('game: Brawl Stars') && !SCREEN_LIST.includes('전화'));
});

test('reflection: only the apps that changed, the rest kept, and it can be taken back', () => {
    const p = phone([]);
    const r = applyLife(p, { id: 'new-game', at: 3, date: '10-26', time: '20:00' }, { usual: { screen: { add: [{ app: 'Genshin', min: 120 }, { app: 'Signal', min: 30 }], drop: ['Mail'] } } }, true);
    const s = p.life.health.usual.screen;
    assert.deepEqual(s.apps.map(a => [a.app, a.kind, a.min]), [['Genshin Impact', 'game', 120], ['Brawl Arena', 'game', 90], ['Signal', 'chat', 30]]);
    assert.equal(s.pickups, 80);
    assert.equal(r.effects.find(e => e.path === 'life.health.usual.screen').from.apps.length, 3);
    // a whole list written anyway: what it left out stays
    applyLife(p, { id: 'quit', at: 4, date: '10-26', time: '21:00' }, { usual: { screen: { apps: [{ app: 'Brawl Arena', kind: 'game', min: 0 }] } } }, true);
    assert.deepEqual(p.life.health.usual.screen.apps.map(a => a.app), ['Genshin Impact', 'Signal']);
    assert.deepEqual(screenChange(null, { add: [{ app: 'Kindle', min: 20 }] }).apps, [{ app: 'Kindle', kind: 'reading', min: 20 }]);
    // a story day with its screen
    applyLife(p, { id: 'fight', at: 5, date: '10-26', time: '23:00' }, { health: [{ date: '10-26', sleep: '02:30', wake: '08:00', screen: { apps: { Signal: 240 }, late: '02:25' } }] }, true);
    assert.deepEqual(p.life.health.days.find(d => d.date === '10-26').screen, { apps: { Signal: 240 }, late: '02:25' });
});

test('screenView: the pickups a day, on average', () => {
    const p = phone([{ date: '10-24', screen: { apps: { Signal: 10 }, pickups: 60 } }, { date: '10-25', screen: { apps: { Signal: 10 }, pickups: 100 } }]);
    assert.equal(screenView(p, '10-26 12:00').pickupsAvg, 80);
});

test('screenView: a short sleeper is not up late every night, only on a night shorter than their own', () => {
    const p = phone([{ date: '10-23', sleep: '00:15', wake: '05:30' }, { date: '10-24', sleep: '03:10', wake: '05:30' }, { date: '10-25', sleep: '00:10', wake: '05:30' }]);
    p.life.health.usual = { sleep: '00:15', wake: '05:30', screen: { ...usual, late: '00:10' } };
    const late = Object.fromEntries(screenView(p, '10-26 12:00').days.filter(d => !d.today).map(d => [d.date, d.late]));
    assert.ok(late['10-23'] < '01:00' && late['10-25'] < '01:00', JSON.stringify(late));
    assert.ok(late['10-24'] >= '01:00', JSON.stringify(late));
});

test('what the phone holds that day shows as its apps: a told day keeps its own minutes, the rest is added', () => {
    const p = phone([{ date: '10-24', sleep: '23:40', wake: '07:00' }, { date: '10-25', sleep: '23:40', wake: '07:00', screen: { apps: { Signal: 100, 'Uber Eats': 30 } } }]);
    p.lives = 'DE';
    p.delivery = { look: 'ubereats', orders: [{ time: '10-24 20:00' }, { time: '10-25 19:00' }] };
    p.mails = [{ time: '10-25 09:00' }, { time: '10-25 10:00' }];
    p.searches = [{ time: '10-24 11:00' }];
    const [d24, d25] = screenView(p, '10-26 12:00').days;
    const a24 = Object.fromEntries(d24.apps), a25 = Object.fromEntries(d25.apps);
    assert.equal(a24['Uber Eats'], 8);
    assert.equal(a24.Google, 3);
    assert.equal(a25['Uber Eats'], 30);
    assert.equal(a25.Mail, 4); // their own mail app, not Gmail
    assert.equal(a25.Signal, 100);
});

test('apps they open now and then: kept apart, on some days only; one they now use daily moves up', () => {
    const u = usualScreenOf({ apps: [{ app: 'Signal', kind: 'chat', min: 60 }], sometimes: [{ app: 'DB Navigator', min: 10 }, { app: 'Signal', min: 5 }, { app: 'Zalando', min: 15 }] });
    assert.deepEqual(u.sometimes.map(a => [a.app, a.kind]), [['Zalando', 'shopping'], ['DB Navigator', 'other']]);
    const days = Array.from({ length: 20 }, (_, k) => ({ date: `10-${String(k + 1).padStart(2, '0')}`, sleep: '23:30', wake: '07:00' }));
    const p = phone(days); p.life.health.usual.screen = u;
    const seen = screenView(p, '10-26 12:00').days.filter(d => d.apps.some(([a]) => a === 'Zalando')).length;
    assert.ok(seen > 0 && seen < 20, String(seen));
    const ch = screenChange(u, { add: [{ app: 'Zalando', min: 40 }] });
    assert.deepEqual(ch.apps.map(a => a.app), ['Signal', 'Zalando']);
    assert.deepEqual(ch.sometimes.map(a => a.app), ['DB Navigator']);
    assert.deepEqual(screenChange(u, { drop: ['DB Navigator'] }).sometimes.map(a => a.app), ['Zalando']);
});

test('apps known by name and icon beyond the fill list: the phone\'s own, a day\'s, a bank under its own name', () => {
    assert.deepEqual(appOf('Notes'), { id: 'notes', name: '메모', kind: 'other' });
    assert.equal(appOf('구글맵').id, 'googlemaps');
    assert.equal(appOf('抖音').id, 'douyin');
    assert.equal(appOf('TikTok').id, 'tiktok');
    assert.deepEqual(appOf('Sparkasse'), { id: 'bank', name: 'Sparkasse', kind: 'other' });
    assert.equal(appOf('Blue Archive'), null);
    assert.ok(SCREEN_LIST.includes('Google Maps') && !SCREEN_LIST.includes('메모') && !SCREEN_LIST.includes('은행'));
    assert.deepEqual(screenOf({ apps: { '스벅': 5, Starbucks: 3 } }), { apps: { Starbucks: 8 } });
});
