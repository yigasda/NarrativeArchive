// 새로 일어난 일 반영 · 생활과 배달: alarms, files, health days, weather, the clock moving on, and delivery orders with
// their payments; every change can be taken back and put back
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDays, applyLife, applyWeather, dlvClock, fillDays, lifeClock } from '../src/phonesynclife.js';
import { applyMoney, payOrders, replayEffects, revertEffects } from '../src/phonesyncmoney.js';
import { cash, migrateBank } from '../src/finance.js';

function setup() {
    const m = {}, p = {
        owner: 'Ren', now: '10-26 12:00',
        money: { currency: 'EUR', asOf: '2026-10-20', bank: { accounts: [
            { id: 'chk', kind: 'checking', name: 'Giro', last4: '1111', currency: 'EUR', balance: 1000 },
            { id: 'cc', kind: 'credit', name: 'Karte', last4: '2222', currency: 'EUR', balance: 0 }] }, tx: [], orders: [], passes: [] },
        life: {
            at: '10-20 08:00',
            clock: { alarms: [{ id: 'a1', time: '06:10', label: 'Aufstehen', days: ['mon', 'tue', 'wed', 'thu', 'fri'], date: '', on: true }], timers: [], running: null },
            health: { usual: { sleep: '23:30', wake: '06:30', steps: 7000 }, days: [{ id: 'h1', date: '10-25', sleep: '23:40', wake: '06:20', steps: 6800, from: 'pattern' }] },
            files: { folders: [], items: [{ id: 'f1', name: 'Mietvertrag.pdf', kind: 'pdf', folder: 'Downloads', time: '10-22 09:00' }] },
            weather: { here: { place: 'Varo', date: '10-26', time: '09:00', cond: 'clear', temp: 12, hours: [{ time: '09:00', cond: 'clear', temp: 12 }, { time: '18:00', cond: 'clear', temp: 14 }], days: [{ day: '10-25', cond: 'clear' }, { day: '10-26', cond: 'clear' }, { day: '10-27', cond: 'rain' }], tiles: {} },
                cities: [{ name: 'Lisboa', tz: 'Europe/Lisbon', cond: 'clear', temp: 20, note: 'trip' }] },
        },
        delivery: { shops: [], orders: [{ id: 'o1', shop: 'Pasta Nostra', items: [{ name: 'Ragù', qty: 1, price: 12 }], fee: 2, tip: 0, discount: 0, time: '10-18 20:10', status: 'delivered', account: 'card' }], cart: null },
    };
    migrateBank(m, p);
    return { m, p, bank: () => cash(m.finance.accounts['chk:EUR']) };
}
const ev = (id, at, date) => ({ id, at, date, time: '20:00' });
const opts = { year: '2026', marks: { base: { index: 0 }, money: { index: 0 }, invest: { index: 0 }, delivery: { index: 0 } } };

test('an alarm set, an alarm switched off, a file deleted: each can be taken back, and one the user changed since stays', () => {
    const { p } = setup();
    const r = applyLife(p, ev('trip', 5, '10-26'), { alarms: [{ time: '04:30', label: 'Flughafen', date: '10-30', on: true }, { change: 'a1', on: false }], files: [{ change: 'f1', deleted: true }] }, true);
    assert.equal(p.life.clock.alarms.length, 2);
    assert.equal(p.life.clock.alarms[0].on, false);
    assert.equal(p.life.files.items[0].trashed, '10-26');
    assert.deepEqual([...r.apps].sort(), ['시계', '파일']);
    // the user moves the new alarm by hand: 빼기 leaves it, and puts the rest back
    p.life.clock.alarms[1].time = '04:45';
    const left = revertEffects({}, p, r.effects);
    assert.equal(p.life.clock.alarms.length, 2);
    assert.equal(p.life.clock.alarms[0].on, true);
    assert.equal(p.life.files.items[0].trashed, undefined);
    assert.equal(left.length, 1);
});

test('the apps made after the message already hold it: nothing changes', () => {
    const { p } = setup();
    const r = applyLife(p, ev('x', 5, '10-26'), { alarms: [{ time: '04:30', label: 'Flughafen' }] }, false);
    assert.equal(r.effects.length, 0);
    assert.equal(p.life.clock.alarms.length, 1);
});

test('a day the story shows is written over the pattern day; new days nobody told come in once and never over a told one', () => {
    const { p } = setup();
    applyLife(p, ev('night-out', 7, '10-25'), { health: [{ date: '10-25', sleep: '02:40', wake: '04:54', steps: 18412 }] }, true);
    const day = p.life.health.days.find(d => d.date === '10-25');
    assert.equal(day.from, 'story');
    assert.equal(day.steps, 18412);
    assert.equal(day.ev, 'night-out');
    const fx = applyDays(p, [{ date: '10-25', steps: 5000 }, { date: '10-26', steps: 6100, sleep: '23:50', wake: '06:40' }], 'r1');
    assert.equal(fx.length, 1);
    assert.equal(p.life.health.days.find(d => d.date === '10-25').steps, 18412);
    assert.equal(p.life.health.days.find(d => d.date === '10-26').from, 'pattern');
});

test('weather: the status line stands over the model; nothing to go on keeps it; a city keeps its time zone', () => {
    const { p } = setup();
    assert.deepEqual(applyWeather(p, null, null), []);
    const fx = applyWeather(p, { place: 'Varo', date: '10-27', cond: 'clear', temp: 18, hi: 19, lo: 9, from: 'guess', cities: [{ name: 'Lisboa', cond: 'rain', temp: 16 }] }, { date: '10-27', time: '17:40', place: 'Rathaus', weather: '비, 11°' });
    assert.equal(fx.length, 1);
    assert.equal(p.life.weather.here.cond, 'rain');
    assert.equal(p.life.weather.here.temp, 11);
    assert.equal(p.life.weather.here.place, 'Rathaus');
    assert.equal(p.life.weather.here.from, 'tracker');
    assert.equal(p.life.weather.cities[0].tz, 'Europe/Lisbon');
    assert.equal(p.life.weather.cities[0].cond, 'rain');
    revertEffects({}, p, fx);
    assert.equal(p.life.weather.here.cond, 'clear');
});

test('the clock moving on: a one-time alarm past its day goes off, old trash and old days go, past forecast hours fall away', () => {
    const { p } = setup();
    p.life.clock.alarms.push({ id: 'a2', time: '04:30', label: 'Flughafen', days: [], date: '10-20', on: true });
    p.life.files.items.push({ id: 'f2', name: 'alt.zip', trashed: '09-20' });
    p.life.health.days.unshift({ id: 'h0', date: '08-01', steps: 1 });
    const fx = lifeClock(p, '10-26 17:00');
    assert.equal(p.life.clock.alarms[1].on, false);
    assert.equal(p.life.clock.alarms[0].on, true);
    assert.ok(!p.life.files.items.some(x => x.id === 'f2'));
    assert.ok(!p.life.health.days.some(x => x.id === 'h0'));
    assert.deepEqual(p.life.weather.here.hours.map(x => x.time), ['18:00']);
    assert.deepEqual(p.life.weather.here.days.map(x => x.day), ['10-26', '10-27']);
    // 되돌리기 puts it all back; 복구 does it again
    const before = JSON.stringify(p.life);
    revertEffects({}, p, fx);
    assert.equal(p.life.clock.alarms[1].on, true);
    assert.ok(p.life.files.items.some(x => x.id === 'f2'));
    replayEffects({}, p, fx);
    assert.equal(JSON.stringify(p.life.clock.alarms), JSON.stringify(JSON.parse(before).clock.alarms));
    // across New Year the short way round
    p.life.clock.alarms[1].on = true; p.life.clock.alarms[1].date = '12-30';
    lifeClock(p, '01-02 08:00');
    assert.equal(p.life.clock.alarms[1].on, false);
});

test('a delivery ordered in the story: its card payment goes in once, tied to the order; read again it is not added twice', () => {
    const { m, p } = setup();
    const money = occurrence => ({ moves: [{ account: '2222', amount: -24.8, who: 'Pasta Nostra', kind: 'card', occurrence }],
        deliveries: [{ shop: 'Pasta Nostra', items: [{ name: 'Tagliatelle al ragù', qty: 1, price: 13.9 }, { name: 'Penne arrabbiata', qty: 1, price: 11.5 }], fee: 1.99, discount: 2.59, status: 'on the way', occurrence }] });
    const r = applyMoney(m, p, { ...ev('dinner', 9, '10-26'), money: money('new') }, opts);
    const o = p.delivery.orders.at(-1), t = p.money.tx.at(-1);
    assert.equal(o.sync, true);
    assert.equal(t.delivery, o.id);
    assert.equal(o.account, '2222');
    assert.equal(r.effects.find(x => x.path === 'money.tx').item.delivery, o.id);
    // the same order told again later: nothing new, but it moves forward
    applyMoney(m, p, { ...ev('dinner-2', 11, '10-26'), money: { ...money('again'), deliveries: [{ ...money('again').deliveries[0], status: 'delivered' }] } }, opts);
    assert.equal(p.delivery.orders.length, 2);
    assert.equal(p.money.tx.length, 1);
    assert.equal(p.delivery.orders.at(-1).status, 'delivered');
    // the delivery app's own payments leave a reflection's order to its own row
    assert.equal(payOrders(m, p, '2026'), 1);
    assert.equal(p.money.tx.filter(x => x.delivery === o.id).length, 1);
    // taking the first event back: the order a later message moved on stays (빼기 keeps the whole event for it)
    const left = revertEffects(m, p, r.effects);
    assert.equal(p.delivery.orders.find(x => x.id === o.id).status, 'delivered');
    assert.ok(left.some(x => x.path === 'delivery.orders'));
});

test('cash at the door: no payment, the order says cash; a cancelled one moves nothing', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, { ...ev('lunch', 9, '10-26'), money: { deliveries: [{ shop: 'Kumo Sushi', items: [{ name: 'Maki', qty: 2, price: 6 }], status: 'delivered', occurrence: 'new' }] } }, opts);
    assert.equal(p.delivery.orders.at(-1).account, 'cash');
    assert.equal(p.money.tx.length, 0);
    assert.equal(bank(), 1000);
});

test('a delivery still on the way an hour and a half after its time has arrived; the next day, surely', () => {
    const { p } = setup();
    p.delivery.orders.push({ id: 'o2', shop: 'A', items: [], time: '10-26 19:00', status: 'on the way' }, { id: 'o3', shop: 'B', items: [], time: '10-26 20:00', status: 'on the way' });
    const fx = dlvClock(p, '10-26 20:40');
    assert.deepEqual(p.delivery.orders.map(o => o.status), ['delivered', 'delivered', 'on the way']);
    revertEffects({}, p, fx);
    assert.equal(p.delivery.orders[1].status, 'on the way');
    dlvClock(p, '10-27 08:00');
    assert.ok(p.delivery.orders.every(o => o.status === 'delivered'));
});

test('Vertex run 9: a night that started after midnight is the day they woke up; what the story leaves out is their usual', () => {
    const { p } = setup();
    p.life.health.usual = { bed: '23:10', sleep: '23:30', wake: '06:30', steps: 7000, rest: 61 };
    applyLife(p, { id: 'sleepless-night', at: 7, date: '10-27', time: '02:15' }, { health: [{ date: '10-26', sleep: '02:15', wake: '', steps: 4820, from: 'story' }] }, true);
    const d = p.life.health.days.find(x => x.ev === 'sleepless-night');
    assert.equal(d.date, '10-27');
    assert.equal(d.wake, '06:30');
    assert.equal(d.sleep, '02:15');
    assert.equal(d.steps, 4820);
});

test('Vertex run 9: days the model left out are filled from their usual up to the story now, each a little different', () => {
    const { p } = setup();
    p.life.health.usual = { bed: '23:10', sleep: '23:30', wake: '06:30', steps: 7000, rest: 61 };
    // 10-25 is there; now is 10-28 at 05:00, before they usually get up: 10-26 and 10-27 come in, 10-28 not yet
    const fx = fillDays(p, '10-28 05:00', 'r9');
    assert.deepEqual(p.life.health.days.map(x => x.date), ['10-25', '10-26', '10-27']);
    assert.ok(p.life.health.days.slice(1).every(x => x.from === 'pattern' && x.steps > 3000 && x.steps < 11000));
    assert.notEqual(p.life.health.days[1].steps, p.life.health.days[2].steps);
    assert.equal(fx.length, 2);
    // a day already there is never written over; after waking, today comes in
    fillDays(p, '10-28 09:00', 'r10');
    assert.deepEqual(p.life.health.days.map(x => x.date), ['10-25', '10-26', '10-27', '10-28']);
    revertEffects({}, p, fx);
    assert.deepEqual(p.life.health.days.map(x => x.date), ['10-25', '10-28']);
});

test('a story that jumped three months ahead gets only its last two weeks of days', () => {
    const { p } = setup();
    p.life.health.usual = { sleep: '23:30', wake: '06:30', steps: 7000 };
    fillDays(p, '01-20 10:00', 'r');
    const days = p.life.health.days.map(x => x.date);
    assert.equal(days.length, 15);
    assert.equal(days[1], '01-07');
    assert.equal(days.at(-1), '01-20');
});

test('Vertex run 10: weather said to come from an archive the request never carried came from the chat', () => {
    const { p } = setup();
    applyWeather(p, { place: 'Berlin', date: '10-27', cond: 'rain', temp: 9, from: 'archive' }, null, { archive: false });
    assert.equal(p.life.weather.here.from, 'chat');
    applyWeather(p, { place: 'Berlin', date: '10-27', cond: 'snow', temp: 1, from: 'archive' }, null, { archive: true });
    assert.equal(p.life.weather.here.from, 'archive');
});
