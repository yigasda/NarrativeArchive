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
    assert.equal(d.steps, 4820);
    // told at 02:15, before they usually wake: waking waits for the clock (Vertex run 11)
    assert.equal(d.wake, '');
    assert.equal(d.bed, '23:10');
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

test('Vertex run 11: a night still going at 02:20 gets its row now; waking is filled only once its usual time has come', () => {
    const { p } = setup();
    p.life.health.usual = { sleep: '23:30', wake: '06:30', steps: 7000 };
    applyLife(p, { id: 'cant-sleep', at: 7, date: '10-27', time: '02:15' }, { health: [{ date: '10-27', sleep: '02:15', from: 'story' }] }, true);
    const d = p.life.health.days.find(x => x.ev === 'cant-sleep');
    assert.ok(!d.wake);
    // Vertex run 12: no day's steps at two in the morning either
    assert.equal(d.steps, null);
    lifeClock(p, '10-27 02:25');
    assert.ok(!d.wake);
    const fx = lifeClock(p, '10-27 09:00');
    assert.equal(d.wake, '06:30');
    assert.equal(d.steps, null);
    lifeClock(p, '10-28 08:00');
    assert.equal(d.steps, 7000);
    revertEffects({}, p, fx);
    assert.ok(!d.wake);
});

test('review: a story day told again changes only what the new telling says', () => {
    const { p } = setup();
    p.life.health.usual = { sleep: '23:30', wake: '06:30', steps: 7000 };
    applyLife(p, { id: 'cant-sleep', at: 7, date: '10-27', time: '02:15' }, { health: [{ date: '10-27', sleep: '02:15', steps: 320 }] }, true);
    applyLife(p, { id: 'late-up', at: 9, date: '10-27', time: '07:20' }, { health: [{ date: '10-27', wake: '07:15', sleep: '', steps: null }] }, true);
    const d = p.life.health.days.find(x => x.date === '10-27');
    assert.equal(d.sleep, '02:15');
    assert.equal(d.wake, '07:15');
    assert.equal(d.steps, 320);
    assert.equal(d.ev, 'late-up');
});

test('review: a forecast the model leaves out stays; a one-time alarm is off once it has rung', () => {
    const { p } = setup();
    applyWeather(p, { place: 'Varo', date: '10-26', cond: 'rain', temp: 9, from: 'chat' }, null);
    assert.equal(p.life.weather.here.hours.length, 2);
    assert.equal(p.life.weather.here.days.length, 3);
    p.life.clock.alarms.push({ id: 'a2', time: '04:30', label: 'Flughafen', days: [], date: '10-30', on: true });
    lifeClock(p, '10-30 04:00');
    assert.equal(p.life.clock.alarms[1].on, true);
    lifeClock(p, '10-30 09:00');
    assert.equal(p.life.clock.alarms[1].on, false);
});

test('review: the bank filled first: an order pointing at the bank row it was paid with gets no second payment', () => {
    const { m, p } = setup();
    p.money.tx.push({ id: 'b7', account: '2222', who: 'Pasta Nostra', amount: -14, time: '10-18 20:10', kind: 'card' });
    p.delivery.orders[0].paidBy = 'b7';
    assert.equal(payOrders(m, p, '2026'), 0);
    assert.equal(p.money.tx.length, 1);
    assert.equal(p.money.tx[0].delivery, 'o1');
    // the order gone (the app filled again): the row is the bank's own again
    p.delivery.orders = [];
    payOrders(m, p, '2026');
    assert.equal(p.money.tx[0].delivery, undefined);
});

test('Vertex run 13: the card month counts the delivery payments right away; a number is no event tag', async () => {
    const { m, p } = setup();
    assert.equal(payOrders(m, p, '2026'), 1);
    assert.equal(p.money.bank.accounts[1].spent, 14);
    const { withEv } = await import('../src/phoneparse.js');
    assert.deepEqual(withEv({ a: 1 }, { ev: 1 }), { a: 1 });
    assert.deepEqual(withEv({ a: 1 }, { ev: 'pasta-night' }), { a: 1, ev: 'pasta-night' });
});

// 처음 채우기의 수면 날짜 (가짜 입력): the model writes a day and the night after it; the app keeps the waking day
import { nightsToDays } from '../src/phonesynclife.js';
const row = (date, night, extra = {}) => ({ date, steps: 7000, from: 'pattern', night, ...extra });
const nightOf = (sleep, wake = '08:00') => ({ bed: sleep, sleep, wake, woke: 1 });

test('sleep date 1–2: asleep 10-25 at 23:00 or 10-26 at 01:30, up on 10-26: both are the 10-26 row', () => {
    for (const sleep of ['23:00', '01:30']) {
        const days = nightsToDays([row('10-25', nightOf(sleep, '08:50'), { from: 'story', ev: 'pasta-night', steps: 9100 }), row('10-26', null)], { lastDay: '10-26', usual: { sleep: '23:30', wake: '06:30' } });
        const d26 = days.find(d => d.date === '10-26'), d25 = days.find(d => d.date === '10-25');
        assert.equal(d26.sleep, sleep);
        assert.equal(d26.wake, '08:50');
        assert.equal(d26.ev, 'pasta-night');
        assert.equal(d26.from, 'story');
        // the 25th keeps its own day (the pasta day's steps) and the night before it: here not told, so their usual
        assert.equal(d25.steps, 9100);
        assert.equal(d25.sleep, '23:30');
        // the night after the last day hasn't ended: no 10-27 row
        assert.ok(!days.some(d => d.date === '10-27'));
    }
});

test('sleep date 3: two nights with different things each land on their own waking day, once', () => {
    const days = nightsToDays([row('10-24', nightOf('23:20', '07:00')), row('10-25', nightOf('01:30', '08:50'), { from: 'story', ev: 'pasta-night' }),
        row('10-26', nightOf('00:40', '05:10'), { from: 'story', ev: 'flight-prep' }), row('10-27', null)], { lastDay: '10-27' });
    // 10-25 keeps the pasta day itself (its steps, its tag) with the plain night before it; the pasta night is 10-26
    assert.deepEqual(days.map(d => [d.date, d.sleep, d.ev || '']), [['10-24', '', ''], ['10-25', '23:20', 'pasta-night'], ['10-26', '01:30', 'pasta-night'], ['10-27', '00:40', 'flight-prep']]);
    assert.equal(new Set(days.map(d => d.date)).size, days.length);
});

test('sleep date 4: the end of a month and of a year', () => {
    let days = nightsToDays([row('10-31', nightOf('00:30')), row('11-01', null)], { lastDay: '11-01' });
    assert.equal(days.find(d => d.date === '11-01').sleep, '00:30');
    days = nightsToDays([row('12-30', nightOf('23:10')), row('12-31', nightOf('02:00', '11:00'), { from: 'story', ev: 'silvester' }), row('01-01', null)], { lastDay: '01-01' });
    assert.deepEqual(days.map(d => d.date), ['12-30', '12-31', '01-01']);
    assert.equal(days.at(-1).sleep, '02:00');
    assert.equal(days.at(-1).ev, 'silvester');
});

test('sleep date 5–6: an answer in the old shape stays as it was; a reflection later writes the same waking-day row', () => {
    const old = nightsToDays([{ date: '10-26', sleep: '01:30', wake: '08:50', steps: 5000, from: 'story', ev: 'x' }], { lastDay: '10-26' });
    assert.deepEqual([old[0].date, old[0].sleep], ['10-26', '01:30']);
    const { p } = setup();
    p.life.health.days = nightsToDays([row('10-25', nightOf('01:30', '08:50'), { from: 'story', ev: 'pasta-night' }), row('10-26', null)], { lastDay: '10-26' }).map((d, k) => ({ ...d, id: `h${k}` }));
    // the next morning's message says when they really got up: the same 10-26 row, only what it says
    applyLife(p, { id: 'late-up', at: 9, date: '10-26', time: '09:10' }, { health: [{ date: '10-26', wake: '09:05' }] }, true);
    const d26 = p.life.health.days.filter(d => d.date === '10-26');
    assert.equal(d26.length, 1);
    assert.deepEqual([d26[0].sleep, d26[0].wake], ['01:30', '09:05']);
});

test('Vertex run 16: a private file shows nothing of its inside, whatever the model wrote', async () => {
    const { fileOf } = await import('../src/phonesynclife.js');
    assert.equal(fileOf({ name: 'Gehaltsabrechnung.pdf', private: true, preview: 'Entgeltabrechnung September' }).preview, '');
    assert.equal(fileOf({ name: 'Mietvertrag.pdf', preview: 'Mietvertrag Westend' }).preview, 'Mietvertrag Westend');
});

test('a delivery a reflection puts in keeps the picture it described in words', () => {
    const { m, p } = setup();
    applyMoney(m, p, { id: 'beef-rice', at: 9, date: '10-26', time: '20:00', money: { deliveries: [{ shop: '반점', items: [{ name: '소고기 볶음밥', qty: 1, price: 9000, pic: { base: 'fried rice', with: ['beef', 'sesame'] } }, { name: '짜장면', qty: 1, price: 7000 }], status: 'delivered', occurrence: 'new' }] } }, opts);
    const o = p.delivery.orders.at(-1);
    assert.deepEqual(o.items[0].pic, { base: 'fried-rice', with: ['beef', 'sesame'], size: 'regular', set: [] });
    assert.equal(o.items[1].pic, undefined);
});

test('a delivery from a shop the app never had: the shop joins the list with its dishes drawn; taken back with the order', async () => {
    const { FOOD_IDS } = await import('../src/phonefood.js');
    const { m, p } = setup();
    p.delivery.shops = [{ id: 's1', name: 'Pasta Nostra', fav: true, menu: [] }];
    const money = (shop, newShop) => ({ moves: [{ account: '2222', amount: -19.5, who: shop, kind: 'card', occurrence: 'new' }],
        deliveries: [{ shop, items: [{ name: '새우 볶음밥', qty: 1, price: 12, pic: { base: 'fried rice', with: ['shrimp'] } }, { name: '짜장면', qty: 1, price: 7.5 }], status: 'delivered', occurrence: 'new', newShop }] });
    const r = applyMoney(m, p, { ...ev('chinese', 9, '10-26'), money: money('홍콩반점', { name: '홍콩반점', ko: '홍콩반점', cuisine: 'chinese', fee: 3, eta: '25–35',
        menu: [{ name: '새우 볶음밥', price: 12, top: true, pic: { base: 'fried rice', with: ['shrimp'] } }, { name: '짬뽕', price: 9, pic: { base: 'jjamppong', with: ['mussel', 'squid'] } }, { name: '탕수육', price: 18, pic: { base: 'tangsuyuk' } }] }) }, opts);
    const s = p.delivery.shops.find(x => x.name === '홍콩반점');
    assert.ok(s);
    assert.equal(s.menu.length, 3);
    assert.ok(s.menu.every(d => d.pic && FOOD_IDS.base.includes(d.pic.base)));
    assert.deepEqual(s.menu[0].pic.with, ['shrimp']);
    // the same shop again: no second one
    applyMoney(m, p, { ...ev('chinese-2', 11, '10-27'), money: money('홍콩반점', null) }, opts);
    assert.equal(p.delivery.shops.filter(x => x.name === '홍콩반점').length, 1);
    // no "newShop" from the model: the dishes ordered make its menu
    applyMoney(m, p, { ...ev('sushi', 12, '10-27'), money: money('Sushi Haru', null) }, opts);
    const haru = p.delivery.shops.find(x => x.name === 'Sushi Haru');
    assert.deepEqual(haru.menu.map(d => d.name), ['새우 볶음밥', '짜장면']);
    // what the screen shows (★ rating (reviews), minimum order) is never empty
    assert.ok(haru.rating >= 4.3 && haru.rating <= 4.9 && haru.reviews > 0 && haru.minOrder > 0 && haru.eta);
    assert.equal(s.fee, 3);
    // 빼기 of the first event: its order and its shop go
    revertEffects(m, p, r.effects);
    assert.ok(!p.delivery.shops.some(x => x.name === '홍콩반점'));
});

test('the shop list stays at ten: the oldest one not kept as a favourite makes room, and comes back if the order is taken back', () => {
    const { m, p } = setup();
    p.delivery.shops = ['A', 'B', 'C', 'D', 'E', 'G', 'H', 'I', 'J', 'K'].map((n, k) => ({ id: `s${k}`, name: n, fav: k === 0, menu: [] }));
    const r = applyMoney(m, p, { ...ev('new-shop', 9, '10-26'), money: { deliveries: [{ shop: 'F', items: [{ name: 'Pho', qty: 1, price: 10 }], status: 'delivered', occurrence: 'new' }] } }, opts);
    assert.deepEqual(p.delivery.shops.map(x => x.name), ['A', 'C', 'D', 'E', 'G', 'H', 'I', 'J', 'K', 'F']);
    revertEffects(m, p, r.effects);
    assert.deepEqual(p.delivery.shops.map(x => x.name).sort(), ['A', 'B', 'C', 'D', 'E', 'G', 'H', 'I', 'J', 'K']);
});

test('a reflected dish keeps its option in Korean, and the picture follows it', () => {
    const { m, p } = setup();
    applyMoney(m, p, { ...ev('lunch', 9, '10-26'), money: { deliveries: [{ shop: 'Kumo Sushi', items: [{ name: 'チーズピザ', ko: '치즈피자', option: 'チーズ抜き', optionKo: '치즈 빼고', qty: 1, price: 12, pic: { base: 'pizza', with: ['cheese', 'tomato'] } }], status: 'delivered', occurrence: 'new' }] } }, opts);
    const it = p.delivery.orders.at(-1).items[0];
    assert.equal(it.optionKo, '치즈 빼고');
    assert.deepEqual(it.pic.with, ['tomato']);
});

test('reflection look-over: an arrival time without its day, and a twin order across New Year', () => {
    const p = { delivery: { orders: [{ id: 'o1', shop: 'A', items: [], status: 'on the way', time: '10-26 19:00', arrived: '19:40' }] } };
    assert.equal(dlvClock(p, '10-26 20:00').length, 0);
    assert.equal(dlvClock(p, '10-26 21:20').length, 1);
    assert.equal(p.delivery.orders[0].status, 'delivered');
    // a shop order told again on 01-01 is the one placed on 12-31 (a day apart), not months away
    const { m, p: q } = setup();
    applyMoney(m, q, { ...ev('nye', 9, '12-31'), money: { orders: [{ shop: 'Shop', item: 'Lamp', qty: 1, price: 30, status: 'ordered', paid: false, occurrence: 'new' }] } }, opts);
    applyMoney(m, q, { ...ev('nyd', 11, '01-01'), money: { orders: [{ shop: 'Shop', item: 'Lamp', qty: 1, price: 30, status: 'shipped', paid: false, occurrence: 'again' }] } }, opts);
    assert.equal(q.money.orders.filter(o => o.item === 'Lamp').length, 1);
    assert.equal(q.money.orders.find(o => o.item === 'Lamp').status, 'shipped');
});

test('a payment in January after a December now is booked in the next year; a delivery without a day is refused', () => {
    const { m, p } = setup();
    applyMoney(m, p, { ...ev('nyd', 9, '01-02'), money: { moves: [{ account: '1111', amount: -10, who: 'Bakery', kind: 'card', occurrence: 'new' }] } }, { ...opts, anchor: '2026-12-30' });
    assert.equal(m.finance.accounts['chk:EUR'].entries['sync:nyd:m0'].date, '2027-01-02');
    applyMoney(m, p, { ...ev('dec', 10, '12-29'), money: { moves: [{ account: '1111', amount: -5, who: 'Bakery', kind: 'card', occurrence: 'new' }] } }, { ...opts, anchor: '2026-12-30' });
    assert.equal(m.finance.accounts['chk:EUR'].entries['sync:dec:m0'].date, '2026-12-29');
    assert.throws(() => applyMoney(m, p, { id: 'x', at: 11, date: '', time: '', money: { deliveries: [{ shop: 'A', items: [{ name: 'B', qty: 1, price: 1 }] }] } }, opts), /날짜/);
});

test('the story changes their usual (lost weight, quit coffee): each field set on its own, and taken back', () => {
    const { m, p } = setup();
    p.life.health.usual = { ...p.life.health.usual, weight: 72, coffee: 3, water: 1.5 };
    const r = applyLife(p, { id: 'diet', at: 9, date: '10-26', time: '20:00' }, { usual: { weight: 68.4, coffee: 0, water: 'lots', coffeeKind: '' } }, true);
    assert.deepEqual([p.life.health.usual.weight, p.life.health.usual.coffee, p.life.health.usual.water], [68.4, 0, 1.5]);
    assert.equal(r.effects.length, 2);
    assert.ok(r.apps.has('건강'));
    revertEffects(m, p, r.effects);
    assert.deepEqual([p.life.health.usual.weight, p.life.health.usual.coffee], [72, 3]);
    // nothing changed: nothing written
    assert.equal(applyLife(p, { id: 'x', at: 10, date: '10-26' }, { usual: { weight: 72 } }, true).effects.length, 0);
});

test('a delivery paid from last December goes in the ledger in the year before', () => {
    const { m, p } = setup();
    p.now = '01-02 12:00'; p.year = 2027;
    p.delivery.orders = [{ id: 'o9', shop: 'Pasta Nostra', items: [{ name: 'Ragù', qty: 1, price: 12 }], fee: 2, tip: 0, discount: 0, time: '12-30 20:10', status: 'delivered', account: '1111' }, { id: 'o10', shop: 'Pasta Nostra', items: [{ name: 'Ragù', qty: 1, price: 12 }], fee: 0, tip: 0, discount: 0, time: '01-01 19:00', status: 'delivered', account: '1111' }];
    payOrders(m, p, '2027');
    const dates = Object.values(m.finance.accounts['chk:EUR'].entries).map(e => e.date).sort();
    assert.deepEqual(dates, ['2026-12-30', '2027-01-01']);
    // the bank lists them in story order: December first
    assert.deepEqual(p.money.tx.map(t => t.time.slice(0, 5)), ['12-30', '01-01']);
});

test('a file saved again takes the new time (a clock alone is that day), and an unreadable value blanks nothing', () => {
    const { p } = setup();
    applyLife(p, { id: 'cv', at: 5, date: '10-26', time: '16:00' }, { files: [{ change: 'f1', time: '16:00' }] }, true);
    assert.equal(p.life.files.items[0].time, '10-26 16:00');
    applyLife(p, { id: 'cv2', at: 6, date: '10-26', time: '17:00' }, { files: [{ change: 'f1', time: 'soon', look: 'Contract' }] }, true);
    assert.equal(p.life.files.items[0].time, '10-26 16:00');
    assert.equal(p.life.files.items[0].look, 'contract');
});

test('a story day told ahead of the day before it: the day between is filled too', () => {
    const { p } = setup();
    p.life.health.days = [{ id: 'h0', date: '01-11', sleep: '00:20', wake: '07:20', steps: 6000, from: 'pattern' }, { id: 'h2', date: '01-13', sleep: '03:00', wake: '10:00', steps: 1200, from: 'story' }];
    fillDays(p, '01-13 15:05', 'r');
    assert.deepEqual(p.life.health.days.map(d => d.date), ['01-11', '01-12', '01-13']);
    assert.equal(p.life.health.days[2].from, 'story');
});

test('line by line: day names, "false", sizes, degrees, twins without ids, units, bed before sleep, no Feb 29, cities, hours past midnight', async () => {
    const { alarmOf, fileOf } = await import('../src/phonesynclife.js');
    assert.deepEqual(alarmOf({ time: '07:00', days: ['월', '화', '수'] }).days, ['mon', 'tue', 'wed']);
    assert.deepEqual(alarmOf({ time: '07:00', days: '평일' }).days, ['mon', 'tue', 'wed', 'thu', 'fri']);
    assert.deepEqual(alarmOf({ time: '07:00', days: ['Mo', 'Fr'] }).days, ['mon', 'fri']);
    assert.equal(alarmOf({ time: '07:00', on: 'false' }).on, false);
    assert.deepEqual(['1.2 MB', '800 KB', 245, '2 GB'].map(v => fileOf({ name: 'a.pdf', size: v }).size), [1229, 800, 245, 2097152]);
    const { p } = setup();
    // the same alarm again without its id switches it off; the same file again without its id is that file
    applyLife(p, { id: 'a', at: 5, date: '10-26' }, { alarms: [{ time: '06:10', label: 'Aufstehen', on: false }], files: [{ name: 'Mietvertrag.pdf', folder: 'Downloads', deleted: true }] }, true);
    assert.equal(p.life.clock.alarms.length, 1);
    assert.equal(p.life.clock.alarms[0].on, false);
    assert.equal(p.life.files.items.length, 1);
    assert.equal(p.life.files.items[0].trashed, '10-26');
    applyLife(p, { id: 'b', at: 6, date: '10-27' }, { usual: { water: '2L', weight: '68 kg' }, health: [{ date: '10-27', sleep: '23:00', wake: '06:30' }] }, true);
    assert.deepEqual([p.life.health.usual.water, p.life.health.usual.weight], [2, 68]);
    const d = p.life.health.days.find(x => x.date === '10-27');
    assert.ok(!d.bed || d.bed <= d.sleep || d.bed > '12:00', `in bed ${d.bed} before asleep ${d.sleep}`);
    // a common year has no February 29
    p.year = 2027; p.life.health.days = [{ id: 'x', date: '02-27', sleep: '00:30', wake: '07:30', from: 'pattern' }];
    fillDays(p, '03-02 20:00', 'r');
    assert.deepEqual(p.life.health.days.map(x => x.date), ['02-27', '02-28', '03-01', '03-02']);
    // the forecast's hours after midnight are still to come
    p.life.weather.here = { ...p.life.weather.here, date: '10-26', hours: [{ time: '22:00' }, { time: '00:00' }, { time: '02:00' }], days: [] };
    lifeClock(p, '10-26 21:30');
    assert.deepEqual(p.life.weather.here.hours.map(h => h.time), ['22:00', '00:00', '02:00']);
});
