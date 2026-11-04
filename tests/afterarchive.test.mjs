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
    './phonestory.js': encoded(`export const phoneChatScope=()=>'test';`),
    './wealth.js': encoded(`export const ensureWealth=async()=>null;export const wealthBlock=()=>'';export const wealthDate=()=> '2026-12-30';export const wealthCheck=()=>null;export const addWealthFX=()=>{};`),
    './ai.js': encoded(`export const askDraft=async(input,o)=>{const M=globalThis.__menu;M.input=input;M.sys=o.system;(M.calls||=[]).push({input,sys:o.system});if(M.answers&&M.answers.length){const a=M.answers.shift();if(a instanceof Error)throw a;return a;}return M.answer;};export const askAI=async()=>'';`),
    './core.js': encoded(`export const ctx=()=>({chat:[],chatMetadata:{},characters:[]});export const globalSettings=()=>({});export const saveMeta=async()=>{};export const getMeta=()=>({});`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=n=>(globalThis.__rows||[]).slice(-n).map(r=>r.text);export const chatRows=()=>globalThis.__rows||[];`),
    './inject.js': encoded(`export const applyInjection=()=>{};`), './knowledge.js': encoded(`export const knowledgeRows=()=>[];`),
    './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=()=>[];`),
    './sections.js': encoded(`export const RANGE_HEAD=/^(?:(\\S{1,12})\\s)?#(\\d+)\\s*([–—~-])\\s*#?(\\d+)(.*)$/;export const parseSections=t=>[...String(t).matchAll(/^## (.+)\\n[^#]*/gm)].map(x=>({title:x[1],start:x.index,end:x.index+x[0].length,group:false}));export const sectionKey=s=>s.title;export const splitTail=s=>[s,''];`),
    './translate.js': encoded(`export const glossaryEntries=()=>[];`), './world.js': encoded(`export const worldText=()=>'';`),
    './anniv.js': encoded(`export const datedRows=()=>[];`),
};
const real = ['phonesync.js', 'phoneparse.js', 'phonesynclife.js', 'phonesyncmoney.js', 'finance.js', 'phoneprofile.js', 'phonefood.js', 'phonescreen.js'];
const map = { ...stub, ...Object.fromEntries(real.map(f => [`./${f}`, href(f)])) };
const rewrite = async f => (await readFile(new URL(f, SRC), 'utf8')).replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || k}'`);
map['./phonedata.js'] = encoded(await rewrite('phonedata.js'));
const data = await import(map['./phonedata.js']);
const life = await import(encoded(await rewrite('phonelife.js')));
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

const lifeOf = (o = {}) => ({ clock: { alarms: [], timers: [], running: null }, health: { usual: {}, days: [] }, files: { folders: [], items: [] }, weather: null, ...o });
test('a second life turn keeps the first turn\'s weather, nights and story days; its running timer is its own', () => {
    const here = { place: 'Varo', date: '10-26', cond: 'snow' };
    const a = lifeOf({ clock: { alarms: [], timers: [], running: { label: 'tea', ends: '10-20 08:05' } },
        health: { usual: {}, days: [{ date: '10-24', from: 'story', ev: 'hike', steps: 21000, night: { bed: '01:00', sleep: '01:10', wake: '07:00' } }, { date: '10-25', from: 'pattern', steps: 6000, night: { bed: '23:00', sleep: '23:20', wake: '07:00' } }] },
        weather: { here, cities: [{ name: 'Ivo', tz: 'Europe/Berlin' }] } });
    const b = lifeOf({ health: { usual: {}, days: [{ date: '10-24', from: 'pattern', steps: 5000 }, { date: '10-25', from: 'pattern', steps: 7000, night: null }] }, weather: null });
    const c = life.mergeLife(a, b);
    assert.equal(c.weather.here.cond, 'snow');
    const d24 = c.health.days.find(d => d.date === '10-24'), d25 = c.health.days.find(d => d.date === '10-25');
    assert.deepEqual([d24.from, d24.steps, d24.ev], ['story', 21000, 'hike']);
    assert.deepEqual([d25.steps, d25.night?.wake], [7000, '07:00']);
    assert.equal(c.clock.running, null);
    // a second turn that says where they are now: its weather, the saved cities joined by name
    const e = life.mergeLife(a, lifeOf({ weather: { here: { place: 'Ivo', date: '10-27', cond: 'rain' }, cities: [{ name: 'ivo', tz: 'Europe/Berlin' }, { name: 'Mara Bay' }] } }));
    assert.equal(e.weather.here.place, 'Ivo');
    assert.deepEqual(e.weather.cities.map(x => x.name), ['ivo', 'Mara Bay']);
});

test('a second delivery turn: a shop by the fields it gives, a nearby shop ordered from moves up, an order by its event', () => {
    const a = { shops: [{ name: 'Uno', cuisine: 'pizza', rating: 4.6, menu: [{ name: 'Margherita' }] }, { name: 'Tre', cuisine: 'ramen', nearby: true, menu: [{ name: 'Shoyu' }] }],
        orders: [{ shop: 'Uno', time: '10-20 19:00', ev: 'pizza-night', items: [{ name: 'Margherita' }] }], cart: null };
    const b = { shops: [{ name: 'Uno', cuisine: 'pizza', rating: null, menu: [] }, { name: 'Tre', cuisine: 'ramen', menu: [] }],
        orders: [{ shop: 'Uno', time: '10-20 19:30', ev: 'pizza-night', items: [{ name: 'Margherita' }] }, { shop: 'Tre', time: '10-24 21:00', items: [{ name: 'Shoyu' }] }], cart: null };
    const c = life.mergeDelivery(a, b);
    assert.equal(c.shops.find(x => x.name === 'Uno').rating, 4.6);
    assert.ok(!c.shops.find(x => x.name === 'Tre').nearby);
    assert.deepEqual(c.shops.find(x => x.name === 'Tre').menu.map(x => x.name), ['Shoyu']);
    assert.deepEqual(c.orders.map(o => o.time), ['10-20 19:30', '10-24 21:00']);
});

test('screen time counts back from where the life app reached, when that is later than its own read point', async () => {
    globalThis.__rows = rows(12);
    const p = { owner: 'Ren', now: '10-20 12:00', life: { at: '10-26 09:00', health: { usual: {}, days: ['10-23', '10-24', '10-25'].map(date => ({ date, sleep: '23:00', wake: '07:00', steps: 5000 })) } } };
    globalThis.__menu = { calls: [], answer: '{}' };
    await life.fillScreen({ ...m, phones: { ren: p } }, p).catch(() => {});
    const sent = globalThis.__menu.calls.find(c => c.sys === life.AI_SYS_SCREEN).input;
    assert.ok(sent.includes('"date":"10-24"') && sent.includes('"date":"10-25"'), sent.slice(0, 300));
});
