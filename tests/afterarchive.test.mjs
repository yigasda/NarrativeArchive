import { cleanMessageURL } from './cleanmessage.mjs';
// 아카이브 뒤의 원문: what the archive doesn't cover yet goes along whole, oldest first; past the budget the request
// stops, its app marks where, and the reflection reads on from there
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SRC = new URL('../src/', import.meta.url);
const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const href = f => pathToFileURL(new URL(f, SRC).pathname).href;
const stub = {
    './phonestory.js': encoded(`export const phoneTarget=()=>({scope:phoneChatScope(),check(){}});export const phoneChatScope=()=>'test';`),
    './wealth.js': encoded(`export const ensureWealth=async()=>null;export const wealthBlock=()=>'';export const wealthDate=()=> '2026-12-30';export const wealthCheck=()=>null;export const addWealthFX=()=>{};export const investmentWealthRows=()=>[];`),
    './ai.js': encoded(`export const askDraft=async(input,o)=>{if(String(o.system).startsWith('GOAL\\nWrite the ordinary life')){(globalThis.__everydayIn||=[]).push(input);const e=globalThis.__everyday;return JSON.stringify(typeof e==='function'?e(input):e||{});}if(String(o.system).startsWith('GOAL\\nWork out where')){(globalThis.__where||=[]).push(input);return JSON.stringify(globalThis.__whereAnswer||{people:[]});}const M=globalThis.__menu;M.input=input;M.sys=o.system;(M.calls||=[]).push({input,sys:o.system});if(M.answers&&M.answers.length){const a=M.answers.shift();if(a instanceof Error)throw a;return typeof a==='function'?a(input,o):a;}return M.answer;};export const askAI=async()=>'';`),
    './core.js': encoded(`export const ctx=()=>globalThis.__ctx||({chat:[],chatMetadata:{},characters:[]});export const globalSettings=()=>({});export const saveMeta=async()=>{};export const getMeta=()=>({});`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=n=>(globalThis.__rows||[]).slice(-n).map(r=>r.text);export const chatRows=()=>globalThis.__rows||[];`),
    './inject.js': encoded(`export const applyInjection=()=>{};`), './knowledge.js': encoded(`export const knowledgeRows=()=>[];`),
    './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=()=>[];`),
    './sections.js': encoded(`export const RANGE_HEAD=/^(?:(\\S{1,12})\\s)?#(\\d+)\\s*([–—~-])\\s*#?(\\d+)(.*)$/;export const parseSections=t=>[...String(t).matchAll(/^## (.+)\\n[^#]*/gm)].map(x=>({title:x[1],start:x.index,end:x.index+x[0].length,group:false}));export const sectionKey=s=>s.title;export const splitTail=s=>[s,''];`),
    './translate.js': encoded(`export const glossaryEntries=()=>[];export const glossaryPeople=()=>globalThis.__glossaryPeople||[];`), './world.js': encoded(`export const worldText=()=>'';`),
    './anniv.js': encoded(`export const datedRows=()=>[];`),
};
const real = ['phonesync.js', 'phoneparse.js', 'phoneclock.js', 'phonesynclife.js', 'phonesyncmoney.js', 'finance.js', 'phoneprofile.js', 'phonefood.js', 'phonescreen.js'];
const map = { './extract.js': cleanMessageURL, ...stub, ...Object.fromEntries(real.map(f => [`./${f}`, href(f)])) };
const rewrite = async f => (await readFile(new URL(f, SRC), 'utf8')).replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || k}'`);
map['./phonedata.js'] = encoded(await rewrite('phonedata.js'));
const data = await import(map['./phonedata.js']);
const life = await import(encoded(await rewrite('phonelife.js')));
const invest = await import(encoded(await rewrite('investdata.js')));
const fin = await import(href('finance.js'));
globalThis.__menu = {};

const rows = n => Array.from({ length: n }, (_, i) => ({ index: i, user: i % 2 === 0, hidden: i <= 3, text: `[#${i}] Ren: ${'word '.repeat(40)}${i}` }));
const m = { text: '## #0–#3 — Arrival\n- Ren came home (#1).\n' };

test('the chat after the archive, whole and oldest first', async () => {
    globalThis.__rows = rows(12);
    assert.equal(data.archiveEnd(m), 3);
    const g = data.chatAfterArchive(m);
    assert.deepEqual([g.from, g.to, g.n, g.all, g.left], [4, 11, 8, true, 0]);
    assert.equal(data.readMark(g), null);
    const input = await data.sideRequest(m, 'Ren', []);
    assert.match(input, /\[RECENT CHAT\]\n\[#4\] Ren/);
    assert.ok(input.includes('[#11] Ren'));
});

test('past the budget: up to where it stops, the rest the reflection\'s', async () => {
    globalThis.__rows = rows(40);
    const g = data.chatAfterArchive(m, 300);
    assert.equal(g.from, 4);
    assert.ok(!g.all && g.to < 39 && g.left === 39 - g.to, JSON.stringify(g));
    assert.equal(data.readMark(g).index, g.to);
    // stopped short: the request's now is the message it stopped at
    assert.equal(data.nowAt(g), g.to);
    assert.equal(data.nowAt(data.chatAfterArchive(m)), null);
    const read = {};
    const input = await data.sideRequest(m, 'Ren', [], { read });
    assert.equal(read.gap.from, 4);
    // nothing in between left out: every message from #4 to where it stops
    for (let i = 4; i <= read.gap.to; i++) assert.ok(input.includes(`[#${i}] Ren`), String(i));
});

test('no archive: the chat as before', async () => {
    globalThis.__rows = rows(12);
    assert.equal(data.archiveEnd({ text: '' }), -1);
    const read = {};
    await data.sideRequest({ text: '' }, 'Ren', [], { read });
    assert.equal(read.gap, null);
});

test('a fill reads no further than the phone has read (its clock); the reflection reads on from there', async () => {
    globalThis.__rows = rows(14);
    const p = { owner: 'Ren', sync: { marks: { base: { index: 6 } }, done: [[7, 9]], hiddenRead: {} } };
    assert.equal(data.phoneAt(p), 9);
    const g = data.windowOf(m, p);
    assert.deepEqual([g.from, g.to, g.all, g.later], [4, 9, true, true]);
    assert.equal(data.nowAt(g), 9);
    assert.equal(data.readMark(g).index, 9);
    const input = await data.sideRequest({ ...m, phones: { ren: p } }, 'Ren', []);
    assert.ok(input.includes('[#9] Ren') && !input.includes('[#10] Ren'));
    assert.match(input, /the story so far ends at #9/);
    // a phone with no reading record reads to now, as before
    assert.equal(data.phoneAt({ owner: 'Ren' }), null);
    assert.equal(data.windowOf(m, { owner: 'Ren' }).to, 13);
});

test('no archive: the chat as before, but no further than the phone\'s clock', async () => {
    globalThis.__rows = rows(14);
    const p = { owner: 'Ren', sync: { marks: { base: { index: 8 } }, done: [] } };
    const read = {};
    const input = await data.sideRequest({ text: '', phones: { ren: p } }, 'Ren', [], { story: 30000, read });
    assert.equal(data.nowAt(read.gap), 8);
    assert.ok(input.includes('[#8] Ren') && !input.includes('[#9] Ren'));
});

// rows long enough that the after-archive stretch takes several 70,000-token turns
const bigRows = n => Array.from({ length: n }, (_, i) => ({ index: i, user: i % 2 === 0, hidden: i <= 3, text: `[#${i}] Ren: ${'word '.repeat(4000)}${i}` }));
const lifeAnswer = tag => JSON.stringify({ clock: { alarms: [{ time: '07:00', label: tag, days: ['mon'], on: true }] }, health: { usual: {}, days: [] }, files: { items: [] }, weather: null });

const nums = input => [...input.matchAll(/^\[#(\d+)\] Ren/gm)].map(x => Number(x[1]));
const longPhone = () => ({ owner: 'Ren', now: '10-26 12:00', country: 'DE', lives: 'DE', sync: { marks: { base: { index: 6 } }, done: [[7, 39]], hiddenRead: {},
    events: { 'late-call': { at: 30, summary: 'Ren called Mara until three', quote: 'it is three already', effects: [] }, 'new-alarm': { at: 36, summary: 'Ren set a 6:30 alarm', quote: 'six thirty from tomorrow', effects: [] } } } });

test('a long stretch: 70,000 tokens word for word, then 30,000 more adding only what is new, then the reflection\'s summaries', async () => {
    globalThis.__rows = bigRows(40);
    const p = longPhone(), mm = { ...m, phones: { ren: p } };
    globalThis.__menu = { calls: [], answers: [lifeAnswer('A'), lifeAnswer('B')], answer: '{}' };
    await life.fillLife(mm, p);
    const turns = globalThis.__menu.calls.filter(c => c.sys === life.AI_SYS_LIFE);
    assert.equal(turns.length, 2);
    const a = nums(turns[0].input), b = nums(turns[1].input);
    // word for word: one run from #4, no message twice, none skipped
    assert.equal(a[0], 4);
    assert.deepEqual([...a, ...b], Array.from({ length: a.length + b.length }, (_, i) => i + 4));
    assert.ok(b.length && b.length < a.length);
    // the rest up to the phone's clock: the reflection's summaries
    const rest = b.at(-1) + 1;
    assert.ok(turns[1].input.includes(`[TOLD SHORT — messages #${rest}–#39`));
    assert.ok(turns[1].input.includes('#30 · Ren called Mara until three — "it is three already"') && turns[1].input.includes('#36 · Ren set a 6:30 alarm'));
    assert.ok(turns[1].input.includes('[LIFE SO FAR') && turns[1].input.includes('only what RECENT CHAT and TOLD SHORT add'));
    // what the second added put in with what the first wrote
    assert.deepEqual(p.life.clock.alarms.map(x => x.label), ['A', 'B']);
    assert.equal(p.sync.marks.life.index, 39);
});

test('a second turn that fails keeps what the first wrote, marked where it stopped', async () => {
    globalThis.__rows = bigRows(40);
    const p = longPhone(), mm = { ...m, phones: { ren: p } };
    globalThis.__menu = { calls: [], answers: [lifeAnswer('A'), new Error('quota')], answer: '{}' };
    await life.fillLife(mm, p);
    assert.deepEqual(p.life.clock.alarms.map(x => x.label), ['A']);
    assert.equal(p.sync.marks.life.index, Math.max(...nums(globalThis.__menu.calls[0].input)));
});

test('the delivery app the same way: two turns, the second adding to the first', async () => {
    globalThis.__rows = bigRows(40);
    const p = longPhone(), mm = { ...m, phones: { ren: p } };
    const dlv = (shop, time) => JSON.stringify({ shops: [{ name: shop, cuisine: 'pizza', menu: [{ name: 'Margherita', price: 9 }] }], orders: [{ shop, items: [{ name: 'Margherita', price: 9 }], time, status: 'delivered' }], cart: null });
    globalThis.__menu = { calls: [], answers: [dlv('Uno', '10-20 19:00'), dlv('Due', '10-24 20:00')], answer: '{}' };
    await life.fillDelivery(mm, p);
    const turns = globalThis.__menu.calls.filter(c => c.sys === life.AI_SYS_DELIVERY);
    assert.equal(turns.length, 2);
    assert.ok(turns[1].input.includes('[DELIVERY SO FAR'));
    assert.deepEqual(p.delivery.orders.map(o => o.shop), ['Uno', 'Due']);
    assert.deepEqual(p.delivery.shops.map(x => x.name).slice(0, 2), ['Uno', 'Due']);
    assert.equal(p.sync.marks.delivery.index, 39);
});

// ---- 점검에서 나온 버그들
test('a section archived past the phone\'s clock stays out of a fill: the reflection reads it', async () => {
    globalThis.__rows = rows(14).map(r => ({ ...r, hidden: r.index <= 3 || (r.index >= 8 && r.index <= 10) }));
    const mm = { text: '## #0–#3 — Arrival\n- Ren came home.\n## #8–#10 — Later\n- Ren left town.\n' };
    const p = { owner: 'Ren', sync: { marks: { base: { index: 6 } }, done: [], hiddenRead: {} } };
    assert.equal(data.archiveEnd(mm, 6), 3);
    const g = data.windowOf(mm, p);
    assert.deepEqual([g.from, g.to, g.upto], [4, 6, 6]);
    const input = await data.sideRequest({ ...mm, phones: { ren: p } }, 'Ren', []);
    assert.ok(input.includes('Ren came home') && !input.includes('Ren left town'));
    // a section that begins before the clock and runs past it is read whole: the read point moves to its end
    const span = { text: '## #0–#3 — Arrival\n- Ren came home.\n## #5–#9 — The trip\n- Ren took the train.\n' };
    const g2 = data.windowOf(span, p);
    assert.equal(data.nowAt(g2), 9);
    assert.equal(data.readMark(g2).index, 9);
    assert.ok((await data.sideRequest({ ...span, phones: { ren: p } }, 'Ren', [])).includes('Ren took the train'));
});

test('told short only for messages a reflection read: otherwise there is nothing to tell them', async () => {
    globalThis.__rows = rows(30);
    const p = { owner: 'Ren', sync: { marks: { base: { index: 6 } }, done: [[7, 20]], hiddenRead: {}, events: { a: { at: 12, summary: 'Ren cooked' } } } };
    assert.ok(data.toldShort(p, 10, 20)?.text.includes('#12 · Ren cooked'));
    // #21–#25 never read by a reflection
    assert.equal(data.toldShort(p, 10, 25), null);
    // #4–#6: only the making read them
    assert.equal(data.toldShort(p, 3, 20), null);
});

// a turn as the app has it: the model's answer (raw) parsed the way the fill parses it
const lifeTurn = (raw, now, lastDay) => ({ raw, now, got: life.parseLife(raw, now, lastDay) });
const usual = { bed: '23:00', sleep: '23:20', wake: '07:00' };
test('a second life turn keeps the nights, heart rates and story days the first wrote, where it wrote none of its own', () => {
    const one = lifeTurn({ clock: { running: { label: 'tea', sec: 300, left: 120 } }, health: { usual, days: [
        { date: '10-23', from: 'story', ev: 'party', steps: 9000, night: { bed: '02:30', sleep: '03:00', wake: '10:00' } },
        { date: '10-24', from: 'pattern', steps: 3000, hr: [60, 120] }] } }, null, '10-24');
    const two = lifeTurn({ health: { usual, days: [{ date: '10-24', from: 'pattern', steps: 3100 }, { date: '10-25', from: 'pattern', steps: 6000 }] } }, null, '10-25');
    const c = life.mergeLife(one.got, two.got, two);
    const d24 = c.health.days.find(d => d.date === '10-24');
    // the night after the party is 10-24's: 03:00 to 10:00, a story night, never their usual
    assert.deepEqual([d24.sleep, d24.wake, d24.from, d24.ev], ['03:00', '10:00', 'story', 'party']);
    assert.deepEqual(d24.hr, [60, 120]);
    assert.equal(d24.steps, 3000); // a story day: its own steps stay, not the second's guess
    assert.ok(c.health.days.some(d => d.date === '10-25'));
    // the timer running is the second's: none
    assert.equal(c.clock.running, null);
    // the same, both days guessed, or both told by the story: what the second left out stays the first's
    const p1 = lifeTurn({ health: { usual, days: [{ date: '10-23', steps: 8000, night: { bed: '00:40', sleep: '01:00', wake: '08:30' } }, { date: '10-24', steps: 3000, hr: [60, 120] }] } }, null, '10-24');
    const p2 = lifeTurn({ health: { usual, days: [{ date: '10-24', steps: 3100 }] } }, null, '10-25');
    const q = life.mergeLife(p1.got, p2.got, p2).health.days.find(d => d.date === '10-24');
    assert.deepEqual([q.sleep, q.wake, q.steps, q.hr], ['01:00', '08:30', 3100, [60, 120]]);
    const s2 = lifeTurn({ health: { usual, days: [{ date: '10-24', from: 'story', ev: 'hangover', steps: 2500 }] } }, null, '10-25');
    const r = life.mergeLife(one.got, s2.got, s2).health.days.find(d => d.date === '10-24');
    assert.deepEqual([r.sleep, r.wake, r.steps, r.ev], ['03:00', '10:00', 2500, 'hangover']);
    // a second turn that gives the night itself: that one
    const three = lifeTurn({ health: { usual, days: [{ date: '10-24', from: 'pattern', steps: 3100, night: { bed: '00:10', sleep: '00:30', wake: '08:00' } }] } }, null, '10-25');
    const e = life.mergeLife(one.got, three.got, three);
    assert.equal(e.health.days.find(d => d.date === '10-25').sleep, '00:30');
});

test('a second life turn that wrote no weather keeps the first\'s forecast, moved to its status line', () => {
    const now1 = { date: '10-24', time: '09:00', place: 'Varo', weather: 'snow -2°C' }, now2 = { date: '10-26', time: '21:00', place: 'Varo', weather: 'snow -4°C' };
    const one = lifeTurn({ weather: { here: { place: 'Varo', cond: 'snow', temp: -2, hi: 0, lo: -6, hours: [{ time: '10:00', cond: 'snow', temp: -1 }, { time: '11:00', cond: 'snow', temp: 0 }] }, cities: [{ name: 'Ivo', tz: 'Europe/Berlin' }] } }, now1, '10-24');
    const two = lifeTurn({}, now2, '10-26');
    const c = life.mergeLife(one.got, two.got, two);
    assert.equal(c.weather.here.hours.length, 2);
    assert.ok(Number.isFinite(c.weather.here.hi) && Number.isFinite(c.weather.here.lo));
    assert.deepEqual([c.weather.here.date, c.weather.here.time, c.weather.here.temp], ['10-26', '21:00', -4]);
    assert.deepEqual(c.weather.cities.map(x => x.name), ['Ivo']);
    // one that wrote its own: that one, the cities joined by name
    const three = lifeTurn({ weather: { here: { place: 'Ivo', cond: 'rain', temp: 8, hours: [{ time: '22:00', cond: 'rain', temp: 7 }] }, cities: [{ name: 'ivo', tz: 'Europe/Berlin' }, { name: 'Mara Bay' }] } }, null, '10-26');
    const e = life.mergeLife(one.got, three.got, three);
    assert.deepEqual([e.weather.here.place, e.weather.here.cond], ['Ivo', 'rain']);
    assert.deepEqual(e.weather.cities.map(x => x.name), ['ivo', 'Mara Bay']);
});

test('a second delivery turn: only the shop fields it wrote, both orders of one scene kept, one order told twice is one', () => {
    const turn = raw => ({ raw, got: life.parseDelivery(raw, [], [], '10-30 12:00') });
    const it = name => [{ name, price: 9 }];
    const one = turn({ shops: [{ name: 'Uno', cuisine: 'pizza', rating: 4.6, fee: 3000, fav: true, menu: it('Margherita') }, { name: 'Due', cuisine: 'chicken', menu: it('Wings') }],
        orders: [{ shop: 'Uno', time: '10-20 19:00', ev: 'party', items: it('Margherita') }, { shop: 'Due', time: '10-20 19:05', ev: 'party', items: it('Wings') },
            { shop: 'Uno', time: '10-22 12:00', items: it('Margherita') }] });
    one.got.shops.push({ name: 'Tre', cuisine: 'ramen', nearby: true, menu: [{ name: 'Shoyu' }] }, { name: 'Quattro', cuisine: 'kebab', nearby: true, menu: [{ name: 'Doner' }] });
    const two = turn({ shops: [{ name: 'Uno', rating: 4.7 }, { name: 'Tre', cuisine: 'ramen' }, { name: 'Quattro', cuisine: 'kebab' }],
        orders: [{ shop: 'Due', time: '10-20 19:10', ev: 'party', items: it('Wings') }, { shop: 'Uno', time: '10-22 12:00', ev: 'lunch', items: it('Margherita') },
            { shop: 'Tre', time: '10-24 21:00', items: it('Shoyu') }] });
    const c = life.mergeDelivery(one.got, two.got, two);
    const uno = c.shops.find(x => x.name === 'Uno');
    assert.deepEqual([uno.rating, uno.fee, uno.fav, uno.cuisine], [4.7, 3000, true, 'pizza']);
    assert.deepEqual(uno.menu.map(x => x.name), ['Margherita']);
    // Tre was ordered from: no longer nearby; Quattro only listed again: still nearby, after the ones ordered from
    assert.ok(!c.shops.find(x => x.name === 'Tre').nearby && c.shops.find(x => x.name === 'Quattro').nearby);
    assert.equal(c.shops.at(-1).name, 'Quattro');
    assert.deepEqual(c.orders.map(o => `${o.shop}@${o.time}`), ['Uno@10-20 19:00', 'Due@10-20 19:10', 'Uno@10-22 12:00', 'Tre@10-24 21:00']);
});

test('screen time counts back from where the life app reached, when that is later than its own read point', async () => {
    globalThis.__rows = rows(12);
    const p = { owner: 'Ren', now: '10-20 12:00', life: { at: '10-26 09:00', health: { usual: {}, days: ['10-23', '10-24', '10-25'].map(date => ({ date, sleep: '23:00', wake: '07:00', steps: 5000 })) } } };
    globalThis.__menu = { calls: [], answer: '{}' };
    await life.fillScreen({ ...m, phones: { ren: p } }, p).catch(() => {});
    const sent = globalThis.__menu.calls.find(c => c.sys === life.AI_SYS_SCREEN).input;
    assert.ok(sent.includes('"date":"10-24"') && sent.includes('"date":"10-25"'), sent.slice(0, 300));
});

test('screen time: a life app filled months back in the story is no today', async () => {
    globalThis.__rows = rows(12);
    const p = { owner: 'Ren', now: '10-01 12:00', life: { at: '03-01 09:00', health: { usual: {}, days: ['02-27', '02-28', '09-29', '09-30'].map(date => ({ date, sleep: '23:00', wake: '07:00', steps: 5000 })) } } };
    globalThis.__menu = { calls: [], answer: '{}' };
    await life.fillScreen({ ...m, phones: { ren: p } }, p).catch(() => {});
    const sent = globalThis.__menu.calls.find(c => c.sys === life.AI_SYS_SCREEN).input;
    assert.ok(sent.includes('"date":"09-30"') && !sent.includes('"date":"02-28"'), sent.slice(0, 300));
});

test('an archive longer than the chat (a branch, messages deleted) never moves the clock past the chat', async () => {
    globalThis.__rows = rows(4).map(r => ({ ...r, hidden: false }));
    const mm = { text: '## #0–#9 — Before the branch\n- Ren came home.\n' };
    const p = { owner: 'Ren', sync: { marks: { base: { index: 2 } }, done: [], hiddenRead: {} } };
    const g = data.windowOf(mm, p);
    assert.equal(data.nowAt(g), 3);
});

// ---- 기본 앱 다시 만들기도 두 턴
const phoneOf = () => ({ ...longPhone(), contacts: [], threads: [], calls: [], photos: [], notes: [], searches: [], events: [], posts: [], mails: [], diary: [], voice: [] });
const notesAnswer = title => JSON.stringify({ notes: [{ title, text: `${title} text`, time: '10-25 10:00' }] });
test('an app made again over a long stretch: 70,000 tokens, then 30,000 more adding only what is new, then the summaries', async () => {
    globalThis.__rows = bigRows(40);
    const p = phoneOf(), mm = { ...m, phones: { ren: p } };
    globalThis.__menu = { calls: [], answers: [notesAnswer('Shopping'), notesAnswer('Train times')], answer: '{}' };
    await data.makePhone(mm, 'Ren', { apps: ['note'] });
    const turns = globalThis.__menu.calls.filter(c => c.sys === data.AI_SYS_PHONE);
    assert.equal(turns.length, 2);
    const a = nums(turns[0].input), b = nums(turns[1].input);
    assert.deepEqual([...a, ...b], Array.from({ length: a.length + b.length }, (_, i) => i + 4));
    assert.ok(turns[1].input.includes('[PHONE SO FAR') && turns[1].input.includes('"Shopping"') && turns[1].input.includes('[TOLD SHORT'));
    assert.ok(turns[1].input.includes('[ONLY THESE]'));
    assert.deepEqual(p.notes.map(x => x.title), ['Shopping', 'Train times']);
});

test('a second turn that fails keeps the first; a phone made anew has none (the rest is the reflection\'s)', async () => {
    globalThis.__rows = bigRows(40);
    const p = phoneOf(), mm = { ...m, phones: { ren: p } };
    globalThis.__menu = { calls: [], answers: [notesAnswer('Shopping'), new Error('quota')], answer: '{}' };
    await data.makePhone(mm, 'Ren', { apps: ['note'] });
    assert.deepEqual(p.notes.map(x => x.title), ['Shopping']);
    globalThis.__menu = { calls: [], answers: [notesAnswer('Fresh')], answer: '{}' };
    const fresh = { ...m, phones: {} };
    await data.makePhone(fresh, 'Ren');
    assert.equal(globalThis.__menu.calls.filter(c => c.sys === data.AI_SYS_PHONE).length, 1);
});

// ---- 은행 채우기도 두 턴: 두 번째는 기록만, 잔액은 첫 번째 그대로
const moneyAnswer = (who, balance, time) => JSON.stringify({ currency: 'EUR', bank: { name: 'Varo Bank', accounts: [{ id: '', kind: 'checking', name: 'Main', last4: '1111', currency: 'EUR', balance }] },
    cards: [{ account: '1111', exp: '09/29' }], tx: [{ account: '1111', who, amount: -12, time, kind: 'card' }], passes: [], orders: [{ shop: 'Ivo Books', item: who, price: 12, time, status: 'delivered' }] });
test('the bank over a long stretch: the second turn adds history only, the balances stay the first\'s', async () => {
    globalThis.__rows = bigRows(40);
    const p = longPhone(), mm = { ...m, phones: { ren: p } };
    globalThis.__menu = { calls: [], answers: [moneyAnswer('Bakery', 500, '10-20 09:00'), moneyAnswer('Cinema', 99999, '10-24 20:00')], answer: '{}' };
    await data.fillMoney(mm, p);
    const turns = globalThis.__menu.calls.filter(c => c.sys === data.AI_SYS_MONEY);
    assert.equal(turns.length, 2);
    assert.ok(turns[1].input.includes('[MONEY SO FAR') && turns[1].input.includes('leave "bank" and "fx" out') && turns[1].input.includes('[TOLD SHORT'));
    assert.deepEqual(p.money.tx.map(t => t.who), ['Bakery', 'Cinema']);
    assert.deepEqual(p.money.orders.map(o => o.item), ['Bakery', 'Cinema']);
    assert.equal(p.money.cards.length, 1);
    assert.equal(p.money.bank.accounts[0].balance, 500);
    const a = p.money.bank.accounts[0], ledger = mm.finance.accounts[`${a.id}:${a.currency}`];
    assert.equal(ledger.amount, 500);
    assert.ok(p.money.tx.every(t => ledger.included.includes(t.id)));
    assert.equal(p.sync.marks.money.index, 39);
});

test('every prompt that writes times has the owner\'s own clock (a messenger timestamp from another time zone is moved)', () => {
    const prompts = { phone: data.AI_SYS_PHONE, update: data.AI_SYS_PHONE_UPDATE, core: data.updateSystem({ split: true, life: true, delivery: true }), money: data.AI_SYS_MONEY, voices: data.AI_SYS_VOICES, life: life.AI_SYS_LIFE, delivery: life.AI_SYS_DELIVERY };
    for (const [k, s] of Object.entries(prompts)) assert.ok(s.includes("on the owner's phone clock") && s.includes("OWNER'S CLOCK (sometimes)") && s.includes("A status line's time is the clock of the city its scene is in") && s.includes("whoever's screen or scene it is") && !s.includes('undefined'), k);
});

// the hours are the code's (summer time counted); the model only adds or takes them off
const zonePhone = now => ({ owner: 'Ren', year: 2026, now, life: { weather: { here: { place: 'Frankfurt am Main' }, cities: [{ name: 'Frankfurt am Main', tz: 'Europe/Berlin' },
    { name: 'Seoul', ko: '서울', tz: 'Asia/Seoul' }, { name: 'London', tz: 'Europe/London' }, { name: 'New York', tz: 'America/New_York' }] } } });
test('OWNER\'S CLOCK: where the owner is, their time, and the other saved cities\' hours on that day', () => {
    assert.equal(data.clockBlock(zonePhone('11-03 04:33')), "[OWNER'S CLOCK]\nPhone owner: Ren\nLocation: Frankfurt am Main\nSaved phone time: 11-03 04:33\n\nTime differences from Frankfurt am Main:\n- Seoul: +8 hours\n- London: -1 hour\n- New York: -6 hours");
    // October: Germany on summer time, Korea never
    assert.match(data.clockBlock(zonePhone('10-20 12:00')), /Seoul: \+7 hours/);
    // all in one zone, or no saved city of its own: no block, nothing to move
    const one = zonePhone('11-03 04:33'); one.life.weather.cities = one.life.weather.cities.slice(0, 1);
    assert.equal(data.clockBlock(one), '');
    assert.equal(data.clockBlock({ now: '11-03 04:33' }), '');
});

test('OWNER\'S CLOCK labels keep cities, people, viewpoint aliases and status conversion', () => {
    const p = zonePhone('11-05 03:38');
    p.where = { people: [{ name: 'Mara Park', aka: ['마라'], city: 'Seoul', tz: 'Asia/Seoul' }] };
    const m = { phoneScreenHolder: '마라', phones: { ren: p } };
    const st = { known: true, raw: '11-05 12:50', city: 'Seoul', at: '11-05 04:50' };
    const before = structuredClone({ p, m, st });
    assert.equal(data.clockBlock(p, p.now, m, st), `[OWNER'S CLOCK]
Phone owner: Ren
Location: Frankfurt am Main
Saved phone time: 11-05 03:38
Default screen viewpoint: 마라

Time differences from Frankfurt am Main:
- London: -1 hour
- New York: -6 hours
- Mara Park (Seoul): +8 hours
The newest status line, 11-05 12:50 in Seoul, is 11-05 04:50 here.`);
    assert.deepEqual({ p, m, st }, before);
    for (const status of [null, { ...st, known: false }, { ...st, at: st.raw }]) {
        assert.doesNotMatch(data.clockBlock(p, p.now, m, status), /The newest status line/);
    }
});

test('OWNER\'S CLOCK combines a city with its people only in the output, keeping every person and their aliases', async () => {
    const p = zonePhone('11-05 03:38');
    p.where = { people: [
        { name: 'Somang Park', aka: ['소망'], city: '서울', names: ['Seoul', '서울'], tz: 'Asia/Seoul' },
        { name: 'Ivo Kim', city: 'Seoul', tz: 'Asia/Seoul' },
        { name: 'Ivo Park', city: 'Seoul', tz: 'Asia/Seoul' },
    ] };
    const m = { phoneScreenHolder: '소망', phones: { ren: p } };
    const rows = [{ index: 2, text: 'Somang Park, Ivo Kim and Ivo Park: 11.05 12:38' }];
    const before = structuredClone({ p, m });
    const candidates = await data.reflectionClocks(p, rows, m);
    const offsets = data.zonesOf(p, p.now, m);
    const block = data.clockBlock(p, p.now, m);
    assert.doesNotMatch(block, /^- Seoul:/m);
    for (const label of ['Somang Park (서울)', 'Ivo Kim (Seoul)', 'Ivo Park (Seoul)']) assert.ok(block.includes(`- ${label}: +8 hours`));
    assert.match(block, /Default screen viewpoint: 소망/);
    assert.ok(offsets.others.some(x => x.name === 'Seoul' && x.hours === 8));
    assert.deepEqual(data.zonesOf(p, p.now, m), offsets);
    assert.deepEqual(await data.reflectionClocks(p, rows, m), candidates);
    assert.ok(candidates.choices.some(x => x.names.includes('소망') && x.ownerTime === '11-05 04:38'));
    assert.deepEqual({ p, m }, before);
    assert.equal(data.sceneZone(p, 'Seoul', m).tz, 'Asia/Seoul');
});

test('OWNER\'S CLOCK keeps different cities with the same zone or current offset, and requires whole city names', () => {
    const p = zonePhone('11-05 03:38');
    p.life.weather.cities.push({ name: 'Busan', tz: 'Asia/Seoul' }, { name: 'Tokyo', tz: 'Asia/Tokyo' });
    p.where = { people: [{ name: 'Somang Park', city: 'Seoul', tz: 'Asia/Seoul' }] };
    const block = data.clockBlock(p);
    assert.doesNotMatch(block, /^- Seoul:/m);
    for (const name of ['Busan', 'Tokyo', 'Somang Park (Seoul)']) assert.ok(block.includes(`- ${name}: +8 hours`));
    p.where.people.push({ name: 'Mara', city: 'New York City', tz: 'America/New_York' });
    assert.match(data.clockBlock(p), /^- New York: -6 hours$/m);
    assert.match(data.clockBlock(p), /^- Mara \(New York City\): -6 hours$/m);
    // An explicitly saved alias, unlike a shared first word, establishes that these are the same city.
    p.where.people.at(-1).names = ['New York'];
    assert.doesNotMatch(data.clockBlock(p), /^- New York:/m);
    assert.match(data.clockBlock(p), /^- Mara \(New York City\): -6 hours$/m);
});

test('OWNER\'S CLOCK does not merge unknown or conflicting locations even when their hours agree', () => {
    const p = zonePhone('11-05 03:38');
    p.life.weather.cities.push({ name: 'South Korea', tz: 'Asia/Seoul' });
    p.where = { people: [
        { name: 'Somang Park', city: 'Seoul', tz: 'Asia/Tokyo' },
        { name: 'Ivo', lives: 'KR' },
        { name: 'Unknown' },
    ] };
    const block = data.clockBlock(p);
    for (const name of ['Seoul', 'South Korea', 'Somang Park (Seoul)', 'Ivo (South Korea)']) assert.ok(block.includes(`- ${name}: +8 hours`));
    assert.doesNotMatch(block, /Unknown/);
    // The same saved name with conflicting zones cannot identify which city the display row came from.
    p.where.people[0].tz = 'Asia/Seoul';
    p.life.weather.cities.push({ name: 'Seoul', tz: 'Asia/Tokyo' });
    assert.match(data.clockBlock(p), /^- Seoul: \+8 hours$/m);
});

test('OWNER\'S CLOCK recognizes equivalent zone aliases only for the same saved city', () => {
    const p = zonePhone('11-05 03:38');
    p.life.weather.cities.push({ name: 'Kolkata', tz: 'Asia/Kolkata' }, { name: 'Mumbai', tz: 'Asia/Calcutta' });
    p.where = { people: [{ name: 'Mara', city: 'Kolkata', tz: 'Asia/Calcutta' }] };
    const block = data.clockBlock(p);
    assert.doesNotMatch(block, /^- Kolkata:/m);
    assert.match(block, /^- Mara \(Kolkata\): \+4\.5 hours$/m);
    assert.match(block, /^- Mumbai: \+4\.5 hours$/m);
});

test('OWNER\'S CLOCK combines known cities from other phones without losing their owners or inventing cities', () => {
    const p = zonePhone('11-05 03:38');
    const m = { phones: { ren: p,
        somang: { owner: 'Somang Park', life: { weather: { here: { place: 'Seoul' }, cities: [{ name: 'Seoul', ko: '서울', tz: 'Asia/Seoul' }] } } },
        mara: { owner: 'Mara', where: { people: [{ name: 'Mara', city: '서울', names: ['Seoul'], tz: 'Asia/Seoul' }] } },
        ivo: { owner: 'Ivo', country: 'KR' },
    } };
    const block = data.clockBlock(p, p.now, m);
    assert.doesNotMatch(block, /^- Seoul:/m);
    for (const label of ['Somang Park (Seoul)', 'Mara (서울)', 'Ivo (South Korea)']) assert.ok(block.includes(`- ${label}: +8 hours`));
});

test('OWNER\'S CLOCK city merging preserves DST, supplied reference dates and standalone cities', () => {
    const p = zonePhone('10-20 12:00');
    p.where = { people: [{ name: 'Somang Park', city: 'Seoul', tz: 'Asia/Seoul' }] };
    assert.match(data.clockBlock(p), /^- Somang Park \(Seoul\): \+7 hours$/m);
    assert.doesNotMatch(data.clockBlock(p), /^- Seoul:/m);
    const november = data.clockBlock(p, '11-05 03:38');
    assert.match(november, /Saved phone time: 10-20 12:00\nClock reference time: 11-05 03:38/);
    assert.match(november, /^- Somang Park \(Seoul\): \+8 hours$/m);
    assert.match(november, /^- London: -1 hour$/m);
    assert.match(november, /^- New York: -6 hours$/m);
    delete p.where;
    assert.match(data.clockBlock(p), /^- Seoul: \+7 hours$/m);
});

test('OWNER\'S CLOCK never invents missing names, locations, saved times or viewpoints', () => {
    const m = { phoneScreenHolder: 'Mara' };
    assert.equal(data.clockBlock(undefined, undefined, m), "[OWNER'S CLOCK]\nDefault screen viewpoint: Mara");
    assert.equal(data.clockBlock({ owner: 'Ren' }, '', m), "[OWNER'S CLOCK]\nPhone owner: Ren\nDefault screen viewpoint: Mara");
    assert.equal(data.clockBlock({ owner: 'Ren', now: '11-05 03:38' }, undefined, m),
        "[OWNER'S CLOCK]\nPhone owner: Ren\nSaved phone time: 11-05 03:38\nDefault screen viewpoint: Mara");
    const p = zonePhone('11-05 03:38'); delete p.owner;
    assert.doesNotMatch(data.clockBlock(p, p.now, { phoneScreenHolder: '' }), /Phone owner:|Default screen viewpoint:|undefined|null/);
    p.life.weather.cities = p.life.weather.cities.slice(0, 1);
    assert.equal(data.clockBlock(p, p.now, { phoneScreenHolder: '' }), '');
    assert.equal(data.clockBlock(p, p.now, m), "[OWNER'S CLOCK]\nLocation: Frankfurt am Main\nSaved phone time: 11-05 03:38\nDefault screen viewpoint: Mara");
});

test('OWNER\'S CLOCK separates a supplied clock reference from the saved phone time', () => {
    const p = zonePhone('10-20 12:00');
    const block = data.clockBlock(p, '11-05 03:38', {});
    assert.match(block, /Saved phone time: 10-20 12:00\nClock reference time: 11-05 03:38/);
    assert.match(block, /- Seoul: \+8 hours/); // offsets still use the supplied instant, including DST
    assert.doesNotMatch(data.clockBlock(p, p.now, {}), /Clock reference time:/);
    delete p.now;
    const missing = data.clockBlock(p, '11-05 03:38', {});
    assert.doesNotMatch(missing, /Saved phone time:/);
    assert.match(missing, /Clock reference time: 11-05 03:38/);
});

test('OWNER\'S CLOCK preserves fractional offsets and quotes multiline labels losslessly', () => {
    const p = zonePhone('11-05 03:38');
    p.owner = 'Ren\nKim';
    p.life.weather.cities.push({ name: 'Kathmandu', tz: 'Asia/Kathmandu' }, { name: 'Kolkata', tz: 'Asia/Kolkata' });
    const block = data.clockBlock(p, p.now, { phoneScreenHolder: 'Mara "M" Park' });
    assert.match(block, /Phone owner: "Ren\\nKim"/);
    assert.match(block, /Default screen viewpoint: Mara "M" Park/);
    assert.match(block, /- Kathmandu: \+4.75 hours/);
    assert.match(block, /- Kolkata: \+4.5 hours/);
    assert.doesNotMatch(block, /NaN|undefined|null/);
});


// ---- 투자 채우기도 두 턴: 두 번째 거래는 현금 · 보유도 같이 움직여요
test('investments over a long stretch: the second turn\'s trades move the cash and the holdings, the opening cash stays', async () => {
    globalThis.__rows = bigRows(40);
    const p = longPhone(), mm = { ...m, phones: { ren: p } };
    const one = { base: 'EUR', cash: [{ currency: 'EUR', amount: 10000 }], securities: [{ symbol: 'XETRA:SAP', name: 'SAP', currency: 'EUR' }],
        trades: [{ kind: 'buy', symbol: 'XETRA:SAP', currency: 'EUR', date: '2026-10-10', quantity: 10, price: 100, fee: 0 }], watch: [], stakes: [], quotes: [], fx: [] };
    const two = { securities: [{ symbol: 'XETRA:BMW', name: 'BMW', currency: 'EUR' }], trades: [{ kind: 'buy', symbol: 'XETRA:SAP', currency: 'EUR', date: '2026-10-10', quantity: 10, price: 100, fee: 0 },
        { kind: 'buy', symbol: 'XETRA:BMW', currency: 'EUR', date: '2026-10-25', quantity: 5, price: 80, fee: 0 }], watch: [{ symbol: 'XETRA:BMW', note: 'after the test drive' }], stakes: [],
        quotes: [{ symbol: 'XETRA:SAP', date: '2026-10-26', value: 104, source: 'guess' }, { symbol: 'XETRA:BMW', date: '2026-10-26', value: 81, source: 'guess' }], fx: [] };
    globalThis.__menu = { calls: [], answers: [JSON.stringify(one), JSON.stringify(two)], answer: '{}' };
    await invest.fillInvestment(mm, p, '2026-10-20');
    const turns = globalThis.__menu.calls.filter(c => c.sys === invest.INVEST_SYS);
    assert.equal(turns.length, 2);
    assert.ok(turns[1].input.includes('[INVESTMENTS SO FAR') && turns[1].input.includes('leave "cash" and "base" out') && turns[1].input.includes('[DATE]\n2026-10-26'));
    const inv = p.investment;
    assert.deepEqual(inv.trades.map(t => t.symbol), ['XETRA:SAP', 'XETRA:BMW']);
    assert.deepEqual(inv.securities.map(s => s.symbol), ['XETRA:SAP', 'XETRA:BMW']);
    assert.equal(inv.date, '2026-10-26');
    const acct = mm.finance.accounts[inv.accounts[0].key];
    assert.equal(acct.amount, 10000);
    assert.equal(fin.cash(acct), 10000 - 1000 - 400);
    assert.deepEqual(fin.positions(inv.trades).map(h => [h.symbol, h.quantity]), [['XETRA:SAP', 10], ['XETRA:BMW', 5]]);
    assert.deepEqual(inv.watch.map(w => w.symbol), ['XETRA:BMW']);
    assert.equal(p.sync.marks.invest.index, 39);
});

test('a second investment turn that can\'t pay for its trades changes nothing: the first stays', async () => {
    globalThis.__rows = bigRows(40);
    const p = longPhone(), mm = { ...m, phones: { ren: p } };
    const one = { base: 'EUR', cash: [{ currency: 'EUR', amount: 1000 }], securities: [{ symbol: 'XETRA:SAP', name: 'SAP', currency: 'EUR' }], trades: [], watch: [], stakes: [], quotes: [], fx: [] };
    const two = { securities: [], trades: [{ kind: 'buy', symbol: 'XETRA:SAP', currency: 'EUR', date: '2026-10-25', quantity: 100, price: 100, fee: 0 }], watch: [], stakes: [], quotes: [], fx: [] };
    globalThis.__menu = { calls: [], answers: [JSON.stringify(one), JSON.stringify(two)], answer: '{}' };
    await invest.fillInvestment(mm, p, '2026-10-20');
    assert.equal(p.investment.trades.length, 0);
    assert.equal(fin.cash(mm.finance.accounts[p.investment.accounts[0].key]), 1000);
    assert.equal(p.investment.date, '2026-10-20');
});

// ---- 위치 판독: the cards word for word, then OWNER'S CLOCK goes by what it read first
test('where everyone is: the whole card and the persona as they are, only known people kept, the clock goes by it', async () => {
    globalThis.__rows = rows(12);
    const card = { name: 'Ren', avatar: 'ren.png', data: { description: 'Ren, a cook.', personality: 'calm', scenario: 'Ren works in Frankfurt.', first_mes: 'Born in Germany, moved to Seoul at ten.', mes_example: '<START> hi' } };
    globalThis.__ctx = { chat: [], chatMetadata: {}, characters: [card], characterId: 0, name1: 'Mara', powerUserSettings: { persona_description: 'Mara lives in Seoul with her cat.' } };
    const p = { owner: 'Ren', now: '11-03 04:33', year: 2026, threads: [{ with: 'Mara', messages: [] }], contacts: [{ name: 'Ivo' }], sync: { marks: { base: { index: 11 } }, done: [] } };
    const mm = { text: '## #0–#3 — Arrival\n- Ren came home.\n', phones: { ren: p } };
    globalThis.__where = [];
    const answer = { people: [{ name: 'Ren', city: 'Frankfurt am Main', lives: 'DE', tz: 'Europe/Berlin' }, { name: 'Mara', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' },
        { name: 'Ivo', lives: 'GB', tz: 'Mars/Base' }, { name: 'Varo', city: 'Paris', lives: 'FR', tz: 'Europe/Paris' }] };
    globalThis.__menu = { calls: [], answers: [], answer: '{}' };
    // the test model answers where-reads apart; this one gives the answer above
    const stub = globalThis.__where;
    try {
        globalThis.__whereAnswer = answer;
        const got = await data.readWhere(mm, p);
        const input = stub.at(-1);
        for (const v of Object.values(card.data)) assert.ok(input.includes(v), v);
        assert.ok(input.includes('[CHARACTER CARD — Ren]') && input.includes('[PERSONA — Mara]\nMara lives in Seoul with her cat.') && input.includes('[PEOPLE]\nMara\nIvo') && !input.includes('[OWNER PROFILE'));
        // Varo is on nobody's phone; Ivo's zone isn't one, but his country gives one
        assert.deepEqual(got.map(x => [x.name, x.tz || x.lives]), [['Ren', 'Europe/Berlin'], ['Mara', 'Asia/Seoul'], ['Ivo', 'GB']]);
        assert.equal(data.clockBlock(p, p.now, mm), "[OWNER'S CLOCK]\nPhone owner: Ren\nLocation: Frankfurt am Main\nSaved phone time: 11-03 04:33\n\nTime differences from Frankfurt am Main:\n- Mara (Seoul): +8 hours\n- Ivo (United Kingdom): -1 hour");
    } finally { globalThis.__ctx = null; globalThis.__whereAnswer = null; }
});

test('a second investment turn that moves the day but gives no prices for it is dropped: the first stays, nothing blank on screen', async () => {
    globalThis.__rows = bigRows(40);
    const p = longPhone(), mm = { ...m, phones: { ren: p } };
    const one = { base: 'EUR', cash: [{ currency: 'EUR', amount: 10000 }], securities: [{ symbol: 'XETRA:SAP', name: 'SAP', currency: 'EUR' }],
        trades: [{ kind: 'buy', symbol: 'XETRA:SAP', currency: 'EUR', date: '2026-10-10', quantity: 10, price: 100, fee: 0 }], watch: [], stakes: [], quotes: [{ symbol: 'XETRA:SAP', date: '2026-10-20', value: 101, source: 'guess' }], fx: [] };
    const two = { securities: [], trades: [{ kind: 'buy', symbol: 'XETRA:SAP', currency: 'EUR', date: '2026-10-25', quantity: 2, price: 100, fee: 0 }], watch: [], stakes: [], quotes: [], fx: [] };
    globalThis.__menu = { calls: [], answers: [JSON.stringify(one), JSON.stringify(two)], answer: '{}' };
    await invest.fillInvestment(mm, p, '2026-10-20');
    assert.equal(p.investment.date, '2026-10-20');
    assert.equal(p.investment.trades.length, 1);
    assert.equal(fin.cash(mm.finance.accounts[p.investment.accounts[0].key]), 9000);
});

test('a payment told again a few minutes off in the bank\'s second turn is the one there', async () => {
    globalThis.__rows = bigRows(40);
    const p = longPhone(), mm = { ...m, phones: { ren: p } };
    globalThis.__menu = { calls: [], answers: [moneyAnswer('Bakery', 500, '10-20 09:00'), moneyAnswer('Bakery', 500, '10-20 09:05')], answer: '{}' };
    await data.fillMoney(mm, p);
    assert.deepEqual(p.money.tx.map(t => t.who), ['Bakery']);
    assert.equal(p.money.orders.length, 1);
    assert.ok(data.AI_SYS_WHERE.includes("OWNER DOESN'T KNOW (sometimes)") && data.AI_SYS_WHERE.includes('Someone whose whereabouts are in OWNER DOESN\'T KNOW: leave them out.'));
});

test('the bank\'s second turn cut off before its end counts as not read: the mark stays where the first turn stopped', async () => {
    globalThis.__rows = bigRows(40);
    const p = longPhone(), mm = { ...m, phones: { ren: p } };
    globalThis.__menu = { calls: [], answers: [moneyAnswer('Bakery', 500, '10-20 09:00'), '{"cards": [ {"account": "1111", "exp": "09/29" }, {"tx": [ cut off here'], answer: '{}' };
    await data.fillMoney(mm, p);
    const first = globalThis.__menu.calls.filter(c => c.sys === data.AI_SYS_MONEY)[0];
    assert.equal(p.sync.marks.money.index, Math.max(...nums(first.input)));
    assert.deepEqual(p.money.tx.map(t => t.who), ['Bakery']);
});

// ---- 점검 3묶음: 채우기
const syncMod = await import(href('phonesync.js'));
const plainPhone = (extra = {}) => ({ owner: 'Ren', now: '10-26 12:00', country: 'DE', contacts: [], threads: [], calls: [], photos: [], notes: [], searches: [], events: [], posts: [], mails: [], diary: [], voice: [], ...extra });
const emptyLife = () => JSON.stringify({ clock: { alarms: [] }, health: { usual: {}, days: [] }, files: { items: [] }, weather: null });

test('an old phone with no reading record: the life fill leaves one, so the reflection doesn\'t read its talk again', async () => {
    globalThis.__rows = rows(12);
    const p = plainPhone(), mm = { ...m, phones: { ren: p } };
    globalThis.__menu = { calls: [], answers: [emptyLife(), '{}'], answer: '{}' };
    await life.fillLife(mm, p);
    assert.equal(p.sync?.marks?.life?.index, 11);
});

test('a message written while a fill waits for its answer is not marked read', async () => {
    for (const kind of ['life', 'delivery']) {
        globalThis.__rows = rows(12);
        const p = plainPhone(), mm = { ...m, phones: { ren: p } };
        syncMod.syncOf(p, 'test');
        const ans = kind === 'life' ? emptyLife() : JSON.stringify({ shops: [], orders: [], cart: null });
        globalThis.__menu = { calls: [], answers: [() => { globalThis.__rows.push({ index: 12, user: true, hidden: false, text: '[#12] Ren: ordering pizza now' }); return ans; }], answer: '{}' };
        await (kind === 'life' ? life.fillLife(mm, p) : life.fillDelivery(mm, p));
        assert.equal(p.sync.marks[kind].index, 11, kind);
    }
});

test('다시 만들기 on a phone with a clock reads no further than the clock, even across an archived section', async () => {
    globalThis.__rows = rows(12).map(r => ({ ...r, hidden: r.index <= 3 || (r.index >= 5 && r.index <= 9) }));
    const mm = { text: '## #0–#3 — Arrival\n- Ren came home.\n## #5–#9 — The trip\n- Ren wrote down the RE 7 at 08:12 (#8).\n' };
    const p = plainPhone({ now: '10-26 08:00', sync: { ...syncMod.newSync('test'), marks: { base: data.markAfter(6) } } });
    mm.phones = { ren: p };
    globalThis.__menu = { calls: [], answers: [JSON.stringify({ notes: [{ title: 'RE 7 departure', text: 'train 08:12', time: '10-26 09:00' }] })], answer: '{}' };
    await data.makePhone(mm, 'Ren', { apps: ['note'] });
    assert.ok(!globalThis.__menu.calls[0].input.includes('Ren wrote down the RE 7'));
});

test('the delivery\'s second turn: "cart": null keeps the basket (no telling); an order from that shop empties it', async () => {
    globalThis.__rows = bigRows(40);
    const basket = { shop: 'Uno', items: [{ name: 'Margherita', qty: 1 }] };
    const dlv = (cart, orders = []) => JSON.stringify({ shops: [{ name: 'Uno', cuisine: 'pizza', menu: [{ name: 'Margherita', price: 9 }] }], orders, ...(cart === undefined ? {} : { cart }) });
    const order = [{ shop: 'Uno', items: [{ name: 'Margherita', price: 9 }], time: '10-24 20:00', status: 'delivered', account: 'cash' }];
    for (const [second, kept] of [[dlv(null), true], [dlv(undefined), true], [dlv(null, order), false]]) {
        const p = longPhone(), mm = { ...m, phones: { ren: p } };
        globalThis.__menu = { calls: [], answers: [dlv(basket), second], answer: '{}' };
        await life.fillDelivery(mm, p);
        assert.equal(!!p.delivery.cart?.items?.length, kept, second);
    }
});

test('voice memos with a slip: quotes inside a text kept, a broken memo left out, the others go in', async () => {
    globalThis.__rows = rows(8);
    const p = plainPhone(), mm = { ...m, phones: { ren: p } };
    globalThis.__menu = { calls: [], answers: ['{"memos":[{"title":"Groceries","text":"milk, eggs","time":"10-26 09:00","sec":12},'
        + '{"title":"Idea","text":"call Mara about "the trip"", "time":"10-26 10:00"},{"title":"Broken","text":"He said "no", then left","time":"10-26 10:30"},{"title":"Train","text":"RE 7 at 08:12","time":"10-26 11:00","sec":8}]}'], answer: '{}' };
    const warn = console.warn; console.warn = () => {};
    try { await data.fillVoice(mm, p); } finally { console.warn = warn; }
    assert.deepEqual(p.voice.map(x => x.title).sort(), ['Groceries', 'Idea', 'Train']);
    assert.equal(p.voice.find(x => x.title === 'Idea').text, 'call Mara about "the trip"');
});

test('a fill answered with an error or a refusal leaves the apps as they were and reads nothing', async () => {
    for (const answer of ['Sorry, I can\'t write that {policy}.', '{"error":{"code":529,"message":"Overloaded"}}']) {
        globalThis.__rows = rows(12);
        const p = plainPhone({ delivery: { shops: [{ id: 's1', name: 'Uno', cuisine: 'pizza', menu: [] }], orders: [{ id: 'o1', shop: 'Uno', items: [{ name: 'Margherita', qty: 1, price: 9 }], time: '10-20 19:00', status: 'delivered', account: 'cash' }], cart: null },
            life: { clock: { alarms: [{ id: 'a1', time: '07:00', label: 'Work', days: ['mon'], on: true }], timers: [], running: null }, health: { usual: {}, days: [] }, files: { folders: [], items: [] }, weather: null } });
        const mm = { ...m, phones: { ren: p } };
        globalThis.__menu = { calls: [], answers: [answer, answer], answer: '{}' };
        const warn = console.warn; console.warn = () => {};
        try {
            await assert.rejects(life.fillDelivery(mm, p));
            await assert.rejects(life.fillLife(mm, p));
        } finally { console.warn = warn; }
        assert.deepEqual([p.delivery.orders.length, p.life.clock.alarms.length, p.sync?.marks?.delivery, p.sync?.marks?.life], [1, 1, undefined, undefined]);
    }
});

test('the bank\'s second turn with a line after its JSON is read (only a JSON cut short is not)', async () => {
    globalThis.__rows = bigRows(40);
    const p = longPhone(), mm = { ...m, phones: { ren: p } };
    globalThis.__menu = { calls: [], answers: [moneyAnswer('Bakery', 500, '10-20 09:00'), moneyAnswer('Kiosk', 500, '10-24 09:00') + '\nAll payments in the story are included.'], answer: '{}' };
    await data.fillMoney(mm, p);
    assert.deepEqual(p.money.tx.map(t => t.who).sort(), ['Bakery', 'Kiosk']);
    assert.equal(p.sync.marks.money.index, 39);
});

test('the delivery\'s second turn telling an order a few minutes off is the same order; a fill keeps another meal of the same shop and day', async () => {
    globalThis.__rows = bigRows(40);
    const p = longPhone(), mm = { ...m, phones: { ren: p } };
    const dlv = time => JSON.stringify({ shops: [{ name: 'Uno', cuisine: 'pizza', menu: [{ name: 'Margherita', price: 9 }] }], orders: [{ shop: 'Uno', items: [{ name: 'Margherita', price: 9, qty: 2 }], time, status: 'delivered', account: 'cash' }], cart: null });
    globalThis.__menu = { calls: [], answers: [dlv('10-20 19:00'), dlv('10-20 19:10')], answer: '{}' };
    await life.fillDelivery(mm, p);
    assert.equal(p.delivery.orders.filter(o => o.shop === 'Uno').length, 1);
    globalThis.__rows = rows(12);
    const q = plainPhone({ delivery: { shops: [{ name: 'Uno', cuisine: 'pizza', menu: [] }], orders: [{ id: 'o1', shop: 'Uno', items: [{ name: 'Margherita', qty: 1, price: 9 }], time: '10-22 12:00', status: 'delivered', sync: true, ev: 'lunch' }], cart: null } });
    const answer = JSON.stringify({ shops: [{ name: 'Uno', cuisine: 'pizza', menu: [{ name: 'Calzone', price: 11 }] }],
        orders: [{ shop: 'Uno', items: [{ name: 'Margherita', price: 9 }], time: '10-22 12:00', status: 'delivered', ev: 'lunch' }, { shop: 'Uno', items: [{ name: 'Calzone', price: 11 }], time: '10-22 21:30', status: 'delivered', ev: 'late-night' }], cart: null });
    globalThis.__menu = { calls: [], answers: [answer], answer: '{}' };
    await life.fillDelivery({ ...m, phones: { ren: q } }, q);
    assert.deepEqual(q.delivery.orders.map(o => o.items[0].name).sort(), ['Calzone', 'Margherita']);
});

test('a life or delivery turn cut off before its end is not taken: the mark stays where the read stopped', async () => {
    for (const kind of ['life', 'delivery']) {
        globalThis.__rows = bigRows(40);
        const p = longPhone(), mm = { ...m, phones: { ren: p } };
        const first = kind === 'life' ? lifeAnswer('A') : JSON.stringify({ shops: [{ name: 'Uno', cuisine: 'pizza', menu: [] }], orders: [{ shop: 'Uno', items: [{ name: 'Margherita', price: 9 }], time: '10-20 19:00', status: 'delivered', account: 'cash' }], cart: null });
        const cut = kind === 'life' ? '{"clock": {"alarms": [{"time": "08:00", "label": "B"}]}, "health": {"days": [{"date": "10-2' : '{"shops": [{"name": "Due"}], "orders": [{"shop": "Due", "items": [{"name": "Pasta", "price": 8}], "time": "10-24 20:00"}, {"shop": "Tre", "items": [{"na';
        globalThis.__menu = { calls: [], answers: [first, cut], answer: '{}' };
        const warn = console.warn; console.warn = () => {};
        try { await (kind === 'life' ? life.fillLife(mm, p) : life.fillDelivery(mm, p)); } finally { console.warn = warn; }
        const turn1 = globalThis.__menu.calls[0];
        assert.equal(p.sync.marks[kind].index, Math.max(...nums(turn1.input)), kind);
    }
});

test('voice memos filled again: one the story already put there is not written twice', async () => {
    globalThis.__rows = rows(8);
    const p = plainPhone({ voice: [{ id: 'v1', title: 'Train times', text: 'RE 7 at 08:12', time: '10-24 08:00', sec: 12, src: 'story' }] }), mm = { ...m, phones: { ren: p } };
    globalThis.__menu = { calls: [], answers: ['{"memos":[{"title":"Train times","text":"RE 7 at 08:12","time":"10-24 08:00","sec":12},{"title":"Late thought","text":"call Ivo","time":"10-25 23:00","sec":8}]}'], answer: '{}' };
    await data.fillVoice(mm, p);
    assert.deepEqual(p.voice.map(x => x.title).sort(), ['Late thought', 'Train times']);
});

test('a life fill that stops short of a stretch the reflection read ahead keeps what the reflection put in from there', async () => {
    globalThis.__rows = bigRows(40);
    const p = { owner: 'Ren', now: '10-26 12:00', country: 'DE', lives: 'DE',
        life: { clock: { alarms: [{ id: 'sync:new-alarm:a0', time: '06:30', label: 'Gym with Ivo', days: ['mon'], on: true, ev: 'new-alarm', sourceIndex: 30 }], timers: [], running: null }, health: { usual: {}, days: [] }, files: { folders: [], items: [] }, weather: null },
        sync: { order: 'newest', marks: { base: { index: 6 }, life: { index: 6 } }, done: [[7, 20], [25, 39]], hiddenRead: {}, failed: {}, events: { 'new-alarm': { at: 30, summary: 'gym alarm', quote: 'six thirty', effects: [] } } } };
    const ans = JSON.stringify({ clock: { alarms: [{ time: '07:00', label: 'Work', days: ['mon'], on: true }] }, health: { usual: {}, days: [] }, files: { items: [] }, weather: null });
    globalThis.__menu = { calls: [], answers: [ans, ans], answer: '{}' };
    const warn = console.warn; console.warn = () => {};
    try { await life.fillLife({ ...m, phones: { ren: p } }, p); } finally { console.warn = warn; }
    assert.deepEqual(p.life.clock.alarms.map(a => a.label).sort(), ['Gym with Ivo', 'Work']);
});

test('다시 만들기 keeps what a reflection put in from a section running past the clock (the remake can\'t see it)', async () => {
    globalThis.__rows = rows(14).map(r => ({ ...r, hidden: r.index <= 9 }));
    const mm = { text: '## #0–#4 — Arrival\n- Ren came home.\n## #5–#9 — The trip\n- Ren wrote the train times to Ivo in a note (#6). Ren met Varo (#9).\n' };
    const p = plainPhone({ notes: [{ id: 'n1', title: 'Train times', text: '8:10 to Ivo', time: '10-24 07:50', ev: 'trip' }],
        sync: { marks: { base: { index: 4 } }, done: [[5, 7]], hiddenRead: { 5: 'x', 6: 'y', 7: 'z' }, events: { trip: { at: 6, summary: 'train times', effects: [] } } } });
    mm.phones = { ren: p };
    globalThis.__menu = { calls: [], answers: [JSON.stringify({ notes: [{ title: 'Groceries', text: 'milk', time: '10-20 10:00' }] })], answer: '{}' };
    await data.makePhone(mm, 'Ren', { apps: ['note'] });
    assert.deepEqual(p.notes.map(n => n.title).sort(), ['Groceries', 'Train times']);
});

test('위치 정보: the owner\'s country and city by hand, a person taken off or moved; the reading asked again keeps all of it', async () => {
    globalThis.__rows = rows(8);
    const p = plainPhone({ country: 'KR', where: { at: 1, people: [{ name: 'Ren', city: 'Seoul', names: ['Seoul'], lives: 'KR', tz: 'Asia/Seoul' }, { name: 'Mara', city: 'Seoul', names: ['Seoul'], lives: 'KR', tz: 'Asia/Seoul' }, { name: 'Ivo', city: 'Paris', names: ['Paris'], lives: 'FR', tz: 'Europe/Paris' }] }, contacts: [{ name: 'Mara' }, { name: 'Ivo' }] });
    const mm = { ...m, phones: { ren: p } };
    await data.setOwnerLives(mm, p, 'de');
    await data.setPlaceCity(mm, p, 'Ren', 'Frankfurt');
    await data.setPlaceCity(mm, p, 'Mara', 'Berlin');
    await data.dropPlacePerson(mm, p, 'Ivo');
    let info = data.placeInfo(p);
    assert.deepEqual([info.owner.lives, info.owner.city, info.owner.tz, info.owner.livesManual, info.owner.cityManual], ['DE', 'Frankfurt', 'Europe/Berlin', true, true]);
    assert.deepEqual(info.people.map(x => [x.name, x.city, x.tz]), [['Mara', 'Berlin', 'Europe/Berlin']]);
    globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }, { name: 'Mara', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }, { name: 'Ivo', city: 'Paris', lives: 'FR', tz: 'Europe/Paris' }] };
    try { info = await data.rereadPlaces(mm, p); } finally { delete globalThis.__whereAnswer; }
    assert.deepEqual([info.owner.lives, info.owner.city], ['DE', 'Frankfurt']);
    assert.deepEqual(info.people.map(x => [x.name, x.city]), [['Mara', 'Berlin']]);
    assert.equal(p.lives, 'DE');
});

test('위치 정보 › AI로 다시 읽기 › 전부 새로: what was set by hand and the people taken off are read anew too', async () => {
    globalThis.__rows = rows(8);
    const p = plainPhone({ country: 'KR', where: { at: 1, removed: ['ivo'], people: [{ name: 'Ren', city: 'Frankfurt', names: ['Frankfurt'], lives: 'DE', tz: 'Europe/Berlin', manual: { city: true, lives: true } }] }, lives: 'DE', livesManual: true, contacts: [{ name: 'Ivo' }] });
    globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }, { name: 'Ivo', city: 'Paris', lives: 'FR', tz: 'Europe/Paris' }] };
    let info;
    try { info = await data.rereadPlaces({ ...m, phones: { ren: p } }, p, { all: true }); } finally { delete globalThis.__whereAnswer; }
    assert.deepEqual([info.owner.city, info.owner.lives, info.owner.cityManual, info.owner.livesManual], ['Seoul', 'KR', false, false]);
    assert.deepEqual(info.people.map(x => x.name), ['Ivo']);
});

test('위치 정보: one person by two names ("Somang Park" in the contacts, "Somang" in a thread) in one city is kept once; in two cities, two people', async () => {
    globalThis.__rows = rows(8);
    const phone = () => plainPhone({ country: 'DE', threads: [{ with: 'Somang', messages: [] }, { with: 'Ivo Kim', messages: [] }], contacts: [{ name: 'Somang Park' }, { name: 'Ivo Park' }],
        where: { at: 1, people: [{ name: 'Somang', city: 'Seoul', names: ['Seoul'], lives: 'KR', tz: 'Asia/Seoul' }, { name: 'Somang Park', city: 'Seoul', names: ['Seoul'], lives: 'KR', tz: 'Asia/Seoul' }] } });
    const ask = async (p, people) => { globalThis.__where = []; globalThis.__whereAnswer = { people }; try { return await data.rereadPlaces({ ...m, phones: { ren: p } }, p, { all: true }); } finally { delete globalThis.__whereAnswer; } };
    let p = phone();
    let info = await ask(p, [{ name: 'Somang Park', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }, { name: 'Somang', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' },
        { name: 'Ivo Kim', city: 'Paris', lives: 'FR', tz: 'Europe/Paris' }, { name: 'Ivo Park', city: 'Paris', lives: 'FR', tz: 'Europe/Paris' }]);
    // (every name is asked as the phone has it; the owner Ren is not)
    assert.deepEqual(globalThis.__where.at(-1).split('[PEOPLE]\n')[1].split('\n\n')[0].split('\n').sort(), ['Ivo Kim', 'Ivo Park', 'Somang', 'Somang Park']);
    assert.deepEqual(info.people.map(x => x.name), ['Somang Park', 'Ivo Kim', 'Ivo Park']);
    // (the short name is kept as another name the same person goes by)
    assert.ok(p.where.people[0].aka.includes('Somang'));
    // the model leaves the short name out: the old row in the same city goes too
    p = phone(); info = await ask(p, [{ name: 'Somang Park', aka: ['소망', 'Somang Park', ''], city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }]);
    assert.deepEqual(p.where.people[0].aka, ['소망']);
    assert.deepEqual(info.people.map(x => x.name), ['Somang Park']);
    // two cities: two people named alike
    p = phone(); info = await ask(p, [{ name: 'Somang Park', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }, { name: 'Somang', city: 'Tokyo', lives: 'JP', tz: 'Asia/Tokyo' }]);
    assert.deepEqual(info.people.map(x => [x.name, x.city]), [['Somang Park', 'Seoul'], ['Somang', 'Tokyo']]);
});

test('사는 나라: the bank, the money and the web go by where the owner lives (by hand or read), the phone\'s 국적 only when that is unknown', () => {
    const p = plainPhone({ country: 'KR' });
    assert.equal(data.homeCountry(p), 'KR');
    p.where = { at: 1, people: [{ name: 'Ren', city: 'Frankfurt', lives: 'de', tz: 'Europe/Berlin' }] };
    assert.equal(data.homeCountry(p), 'DE');
    p.lives = 'FR';
    assert.equal(data.homeCountry(p), 'FR');
});

test('위치 판독 also gives the people closest to the owner, from the cards and the rest, in the texts\' own words; none given keeps the ones there', async () => {
    globalThis.__rows = rows(8);
    const p = plainPhone({ country: 'DE', where: { at: 1, people: [] } });
    const about = 'Ren\'s father and boss at the bank. '.repeat(3);
    globalThis.__whereAnswer = { people: [], around: [{ name: 'Albrecht Sinclair', aka: ['Albrecht', 'Albrecht Sinclair'], about }, { name: 'Ren', about: 'the owner' }, { name: 'Nobody', about: '' },
        ...['A1', 'A2', 'A3', 'A4', 'A5'].map(n => ({ name: n, about: `${n} is close` }))] };
    try { await data.rereadPlaces({ ...m, phones: { ren: p } }, p); } finally { delete globalThis.__whereAnswer; }
    assert.deepEqual(p.around.people.map(x => x.name), ['Albrecht Sinclair', 'A1', 'A2', 'A3', 'A4']);
    assert.deepEqual(p.around.people[0].aka, ['Albrecht']);
    assert.equal(p.around.people[0].about, about.trim());
    assert.match(data.aroundBlock(p), /^\[PEOPLE AROUND\]\n- Albrecht Sinclair \(Albrecht\): Ren's father/);
    globalThis.__whereAnswer = { people: [] };
    try { await data.rereadPlaces({ ...m, phones: { ren: p } }, p); } finally { delete globalThis.__whereAnswer; }
    assert.equal(p.around.people.length, 5);
    assert.match(data.AI_SYS_WHERE, /- LOREBOOK \(sometimes\)/);
    assert.match(data.AI_SYS_WHERE, /Compress the texts' own words and keep their details; do not sum up\. At most 300 tokens/);
    // (everyone the texts tell of with the owner, not only the closest or the most written about; all of what they say)
    assert.match(data.AI_SYS_WHERE, /the people in the owner's life these texts tell of \(family, people at work, friends, past partners, anyone with a part in it\), never the owner; up to 5/);
    assert.match(data.AI_SYS_WHERE, /everything these texts say of that person and the owner, wherever it is in them/);
});

// HTML context is shared by phone creation, app fills and direct phone writing, not sync identities.
const htmlExtractSource = await readFile(new URL('extract.js', SRC), 'utf8');
const { cleanMessage: htmlClean } = await import(encoded(htmlExtractSource.slice(htmlExtractSource.indexOf('const REASONING ='), htmlExtractSource.indexOf('export function formatExtract'))));
const htmlStory = '<div class="chat-timestamp" style="font-size:12px;color:red;">11.03, 11:03</div>\nMara opens a ticket.\n```html\n<!DOCTYPE html><html><head><style>.status-bar{color:red}</style></head><body><div class="status-bar"><span>03:03 CET</span><span>50%</span></div><span class="reservation-time">18:30</span></body></html>\n```\nThe story continues.';
function htmlPhoneFixture(archive = true) {
    const chat = Array.from({ length: 7 }, (_, i) => ({ name: 'Ren', is_user: false, is_system: i < 4,
        mes: i < 4 ? '<time class="hidden-clock">07:07</time>' : i === 4 ? htmlStory : i === 5 ? 'An ordinary message without HTML.' : '<time id="future-clock">22:59</time>' }));
    globalThis.__ctx = { chat, chatMetadata: {}, characters: [] };
    globalThis.__rows = chat.map((x, index) => ({ index, hidden: x.is_system, user: false, text: `[#${index}] Ren: ${htmlClean(x.mes, { stripTags: true })}` }));
    const p = plainPhone({ year: 2026, now: '11-03 03:03', sync: { marks: { base: { index: 5 } }, done: [], hiddenRead: {} } });
    return { p, m: { text: archive ? m.text : '', phoneScreenHolder: 'Mara', phones: { ren: p } } };
}
const assertHtmlPhoneInput = input => {
    assert.ok(input.includes(htmlClean(htmlStory, { stripTags: true })));
    assert.doesNotMatch(input, /바깥 메시지의 HTML|chat-timestamp:/);
    assert.match(input, /\[첨부파일 \(메시지 내부의 HTML\)\]\nstatus-bar: 03:03 CET\nreservation-time: 18:30/);
    assert.doesNotMatch(input, /font-size|color:red|class=|hidden-clock/);
};

test('initial phone creation sends the same compact HTML context with and without an archive', async () => {
    try {
        for (const archived of [true, false]) {
            const { m: mm } = htmlPhoneFixture(archived); mm.phones = {};
            globalThis.__menu = { calls: [], answer: notesAnswer('Ticket') };
            await data.makePhone(mm, 'Ren');
            const call = globalThis.__menu.calls.find(x => x.sys === data.AI_SYS_PHONE);
            assertHtmlPhoneInput(call.input);
            assert.equal((call.input.match(/chat-timestamp: 11\.03, 11:03/g) || []).length, 0);
            assert.match(call.input, /\[OWNER'S CLOCK\]\nPhone owner: Ren\nDefault screen viewpoint: Mara\n\n/);
            assert.doesNotMatch(call.input, /Location:|Saved phone time:|Time differences from|The owner is in/);
        }
    } finally { delete globalThis.__ctx; }
});

test('side requests keep HTML context in recent-only, full-story and after-archive inputs within the phone clock', async () => {
    try {
        for (const [archived, story] of [[true, 0], [false, 0], [false, data.CHAT_TOKENS.apps]]) {
            const { m: mm } = htmlPhoneFixture(archived);
            const input = await data.sideRequest(mm, 'Ren', [], { story });
            assertHtmlPhoneInput(input);
            assert.doesNotMatch(input, /future-clock|22:59/);
        }
    } finally { delete globalThis.__ctx; }
});

test('app fills and app regeneration receive compact HTML labels through their real request paths', async () => {
    const cases = [
        ['life', (mm, p) => life.fillLife(mm, p), lifeAnswer('Wake'), life.AI_SYS_LIFE],
        ['delivery', (mm, p) => life.fillDelivery(mm, p), '{}', life.AI_SYS_DELIVERY],
        ['screen', (mm, p) => { p.life = { at: p.now, health: { usual: {}, days: [{ date: '11-03', sleep: '23:00', wake: '07:00', steps: 5000 }] } }; return life.fillScreen(mm, p); }, '{}', life.AI_SYS_SCREEN],
        ['money', (mm, p) => data.fillMoney(mm, p), moneyAnswer('Ticket', 500, '11-03 03:03'), data.AI_SYS_MONEY],
        ['voice', (mm, p) => data.fillVoice(mm, p), '{"memos":[]}', data.AI_SYS_VOICES],
        ['device', (mm, p) => data.fillDevice(mm, p), '{"model":"Example Phone"}', data.AI_SYS_DEVICE],
        ['app remake', (mm, p) => data.makePhone(mm, p.owner, { apps: ['note'] }), notesAnswer('Ticket'), data.AI_SYS_PHONE],
        ['investment', (mm, p) => invest.fillInvestment(mm, p, '2026-11-03'), '{}', null],
    ];
    try {
        for (const [name, run, answer, system] of cases) {
            const { p, m: mm } = htmlPhoneFixture();
            globalThis.__menu = { calls: [], answer };
            // Some intentionally minimal replies are rejected after capture; this test checks their actual inputs.
            try { await run(mm, p); } catch { /* reply validation is covered by each app's tests */ }
            const call = system ? globalThis.__menu.calls.find(x => x.sys === system) : globalThis.__menu.calls[0];
            assert.ok(call, `${name} must reach its model request`);
            assertHtmlPhoneInput(call.input);
            assert.doesNotMatch(call.input, /future-clock|22:59/, name);
            if (['life', 'delivery', 'money', 'voice', 'app remake'].includes(name)) {
                assert.match(call.input, /\[OWNER'S CLOCK\]\nPhone owner: Ren\n/);
                assert.match(call.input, /Saved phone time: 11-03 03:03\n/);
                assert.match(call.input, /Default screen viewpoint: Mara/);
                assert.doesNotMatch(call.input, /The owner is in/);
            }
        }
    } finally { delete globalThis.__ctx; }
});

test('HTML metadata counts toward archive window budgets and never changes sync rows or archived evidence', async () => {
    try {
        const { m: mm } = htmlPhoneFixture(), before = structuredClone(globalThis.__rows);
        const plainSize = globalThis.__rows[4].text.length / 4;
        const window = data.chatAfterArchive(mm, plainSize + 5, 5);
        assert.equal(window.to, 4);
        assert.equal(window.left, 1);
        assertHtmlPhoneInput(window.text);
        assert.deepEqual(data.syncRows(), before.filter(r => !r.hidden).map(({ index, text }) => ({ index, text })));
        assert.deepEqual(globalThis.__rows, before);
        const ar = { ...mm, text: '## #0–#6 — Archived\n- The ticket was recorded.\n' };
        // Archived/hidden raw messages must not be reopened for labels, even when old recent fallback text exists.
        globalThis.__ctx.chat.forEach(x => { x.is_system = true; });
        globalThis.__rows.forEach(x => { x.hidden = true; });
        const input = await data.sideRequest(ar, 'Ren', []);
        assert.doesNotMatch(input, /chat-timestamp|status-bar|reservation-time|hidden-clock|future-clock/);
    } finally { delete globalThis.__ctx; }
});

test('recent phone input clips only story text, never detached HTML labels', () => {
    try {
        htmlPhoneFixture(false);
        const original = globalThis.__rows[4].text;
        const short = data.recentPhoneText(1, { upto: 4, maxChars: 80 });
        assert.equal(short, original.slice(-80));
        assert.doesNotMatch(short, /메시지의 HTML|바깥 메시지의 HTML|코드 블록/);
        const full = data.recentPhoneText(1, { upto: 4, maxChars: 6000 });
        assert.ok(full.startsWith('[#4] Ren: '));
        assertHtmlPhoneInput(full);
        assert.doesNotMatch(full, /future-clock|22:59/);
    } finally { delete globalThis.__ctx; }
});

test('location reading and all four direct phone writing paths share the same compact context', async () => {
    const overrides = { ...map,
        './ai.js': encoded(`export const askAI=async(input,o)=>{globalThis.__htmlDirect.push({input,system:o.system});return JSON.stringify({title:'Today',text:'A quiet moment.',caption:'A room'});};`),
        './people.js': encoded(`export const headingPlaces=()=>[];export const nameKey=s=>String(s).toLowerCase();export const peopleList=()=>[];`),
    };
    const direct = await import(encoded((await readFile(new URL('phoneai.js', SRC), 'utf8')).replace(/from '([^']+)'/g, (_, k) => `from '${overrides[k] || k}'`)));
    try {
        const { p, m: mm } = htmlPhoneFixture(); p.threads = [{ with: 'Mara', messages: [] }];
        globalThis.__where = [];
        await data.readWhere(mm, p);
        assertHtmlPhoneInput(globalThis.__where.at(-1));
        globalThis.__htmlDirect = [];
        for (const run of [() => direct.takePhoto(mm, p), () => direct.writeEntry(mm, p, 'note'), () => direct.makeDraft(mm, p, 0), () => direct.recordVoice(mm, p)]) {
            await run();
            assertHtmlPhoneInput(globalThis.__htmlDirect.at(-1).input);
        }
    } finally { delete globalThis.__ctx; delete globalThis.__htmlDirect; }
});
