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
    './ai.js': encoded(`import { phoneMadeFixture as __pmf } from '${new URL('./reflectionfixture.mjs', import.meta.url).href}'; const askDraft0=async(input,o)=>{if(String(o.system).startsWith('GOAL\\nWrite the ordinary life')){(globalThis.__everydayIn||=[]).push(input);const e=globalThis.__everyday;return JSON.stringify(typeof e==='function'?e(input):e||{});}if(String(o.system).startsWith('GOAL\\nWork out where')){(globalThis.__where||=[]).push(input);if(globalThis.__whereWait)await globalThis.__whereWait;return JSON.stringify(globalThis.__whereAnswer||{people:[]});}const M=globalThis.__menu;M.input=input;M.sys=o.system;(M.calls||=[]).push({input,sys:o.system});if(M.answers&&M.answers.length){const a=M.answers.shift();if(a instanceof Error)throw a;return typeof a==='function'?a(input,o):a;}return M.answer;};export const askAI=async()=>'';;export const askDraft=async(i,o)=>__pmf(await askDraft0(i,o),i,o?.system);`),
    './core.js': encoded(`export const ctx=()=>globalThis.__ctx||({chat:[],chatMetadata:{},characters:[]});export const globalSettings=()=>({});export const saveMeta=async()=>{};export const getMeta=()=>({});`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=n=>(globalThis.__rows||[]).slice(-n).map(r=>r.text);export const chatRows=()=>globalThis.__rows||[];`),
    './inject.js': encoded(`export const applyInjection=()=>{};`), './knowledge.js': encoded(`export const knowledgeRows=()=>[];`),
    './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=()=>globalThis.__trackers||[];`),
    './sections.js': encoded(`export const RANGE_HEAD=/^(?:(\\S{1,12})\\s)?#(\\d+)\\s*([–—~-])\\s*#?(\\d+)(.*)$/;export const parseSections=t=>[...String(t).matchAll(/^## (.+)\\n[^#]*/gm)].map(x=>({title:x[1],start:x.index,end:x.index+x[0].length,group:false}));export const sectionKey=s=>s.title;export const splitTail=s=>[s,''];`),
    './translate.js': encoded(`export const glossaryEntries=()=>globalThis.__glossaryEntries||[];export const glossaryPeople=()=>globalThis.__glossaryPeople||[];`), './world.js': encoded(`export const worldText=()=>'';`),
    './anniv.js': encoded(`export const datedRows=()=>[];`),
};
const real = ['phonesync.js', 'phoneparse.js', 'phoneclock.js', 'phonemapcity.js', 'placehoods.js', 'phonesynclife.js', 'phonesyncmoney.js', 'finance.js', 'phoneprofile.js', 'phonefood.js', 'phonescreen.js'];
const map = { './extract.js': cleanMessageURL, ...stub, ...Object.fromEntries(real.map(f => [`./${f}`, href(f)])) };
const rewrite = async f => (await readFile(new URL(f, SRC), 'utf8')).replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || k}'`);
map['./phonedata.js'] = encoded(await rewrite('phonedata.js'));
const data = (await import('./phone2poison.mjs')).maybePoison(await import(map['./phonedata.js']));
// (a meta as 폰 1 sees it: the 폰 2 trap run (PHONE2_POISON) puts m.live beside it, which these checks leave out)
const no2 = m => { const { live: _, ...rest } = m; return rest; };
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
    const turns = globalThis.__menu.calls.filter(c => c.sys === data.AI_SYS_PHONE_APPS);
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

test('폰 만들기 under way: the same phone made again (the phone shut and opened mid-make) waits; another chat or person does not', async () => {
    globalThis.__rows = bigRows(4);
    globalThis.__menu = { calls: [], answers: [notesAnswer('A'), notesAnswer('B'), notesAnswer('C')], answer: '{}' };
    const fresh = { ...m, phones: {} }, other = { ...m, phones: {} };
    const first = data.makePhone(fresh, 'Ren');
    assert.equal(data.phoneMaking(fresh, 'ren'), true);
    assert.equal(data.phoneMaking(other, 'Ren'), false);
    await assert.rejects(data.makePhone(fresh, 'Ren'), /만드는 중/);
    const elsewhere = data.makePhone(other, 'Ren');
    await first; await elsewhere;
    assert.equal(data.phoneMaking(fresh, 'Ren'), false);
    assert.equal(globalThis.__menu.calls.filter(c => c.sys === data.AI_SYS_PHONE).length, 2);
    // (done: it lets go, and can be made again; one that throws lets go too)
    globalThis.__menu = { calls: [], answers: [notesAnswer('D')], answer: '{}' };
    await data.makePhone(fresh, 'Ren', { apps: ['note'] });
    assert.equal(data.phoneMaking(fresh, 'Ren'), false);
    await assert.rejects(data.makePhone(null, 'Ren'));
    assert.equal(data.phoneMaking(null, 'Ren'), false);
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
    assert.equal(data.clockBlock(zonePhone('11-03 04:33')), "[OWNER'S CLOCK]\nPhone owner: Ren\nLocation: Frankfurt am Main\nSaved phone time: 11-03 04:33\n\nTime differences from Frankfurt am Main:\n- Seoul: +8 hours\n- London: -1 hour\n- New York: -6 hours (DST: -5 hours before 11-01 07:00)");
    // (no change of summer time within a week either way: the hours alone)
    assert.match(data.clockBlock(zonePhone('12-10 12:00')), /- Seoul: \+8 hours\n- London: -1 hour\n- New York: -6 hours$/);
    // October: Germany on summer time, Korea never
    assert.match(data.clockBlock(zonePhone('10-20 12:00')), /Seoul: \+7 hours/);
    // all in one zone, or no saved city of its own: no block, nothing to move
    const one = zonePhone('11-03 04:33'); one.life.weather.cities = one.life.weather.cities.slice(0, 1);
    assert.equal(data.clockBlock(one), '');
    assert.equal(data.clockBlock({ now: '11-03 04:33' }), '');
});

// 폰 2: the same block on the time now, each place's time beside its hours (the model adds nothing up), no time choices
test('폰 2 OWNER\'S CLOCK: the time now with its weekday, every place\'s time now worked out, a day over midnight too', () => {
    const p = zonePhone('11-06 06:40');
    p.where = { people: [{ name: 'Mara', city: 'Seoul', tz: 'Asia/Seoul' }] };
    const b = data.phone2Clock(p, '11-06 06:40');
    assert.match(b, /^\[OWNER'S CLOCK\]\nPhone owner: Ren\nLocation: Frankfurt am Main\nTime now: 11-06 06:40 \(Fri\)\n\nTime differences from Frankfurt am Main:\n/);
    assert.match(b, /- Mara \(Seoul\): \+8 hours, now 11-06 14:40 \(Fri\)/);
    assert.match(b, /- New York: -6 hours, now 11-06 00:40 \(Fri\)/);
    assert.doesNotMatch(b, /Saved phone time|Default screen viewpoint|Time choices/);
    assert.match(data.phone2Clock(p, '11-06 23:10'), /- Mara \(Seoul\): \+8 hours, now 11-07 07:10 \(Sat\)/);
    assert.match(data.phone2Clock(p, '12-31 20:00'), /now 01-01 04:00 \(Fri\)/);
    // (one zone: the owner's own time all the same; no time: nothing)
    const one = zonePhone('11-06 06:40'); one.life.weather.cities = one.life.weather.cities.slice(0, 1);
    assert.equal(data.phone2Clock(one, '11-06 06:40'), "[OWNER'S CLOCK]\nPhone owner: Ren\nLocation: Frankfurt am Main\nTime now: 11-06 06:40 (Fri)");
    assert.equal(data.phone2Clock(p, ''), '');
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
- New York: -6 hours (DST: -5 hours before 11-01 07:00)
- Mara Park (Seoul): +8 hours
The newest status line, 11-05 12:50 in Seoul, is 11-05 04:50 here.`);
    assert.deepEqual({ p, m: no2(m), st }, before);
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
    const rows = [{ index: 2, text: 'Somang Park, Ivo Kim and Ivo Park: 11.05 12:38', clockSource: 'Somang Park, Ivo Kim and Ivo Park: <span class="time">11.05 12:38</span>' }];
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
    assert.deepEqual({ p, m: no2(m) }, before);
    assert.equal(data.sceneZone(p, 'Seoul', m).tz, 'Asia/Seoul');
});

// a status line's place with its country first ("대한민국 서울 강서구"): the city after it, when the place as written is found nowhere
test('a scene\'s city with its country before it is still that city; a place found as written stays as it was', () => {
    const p = zonePhone('11-05 03:38');
    for (const place of ['대한민국 서울', 'South Korea, Seoul', '대한민국 서울 → 본가', 'Korea Seoul']) assert.equal(data.sceneZone(p, place)?.tz, 'Asia/Seoul', place);
    assert.equal(data.sceneZone(p, 'Germany Frankfurt am Main')?.tz, 'Europe/Berlin');
    assert.equal(data.sceneZone(p, 'Deutschland Frankfurt am Main Westend')?.tz, 'Europe/Berlin');
    // (another zone's city from the start of a longer name stays unknown, country or not: "New York Bagels, Gangnam")
    assert.equal(data.sceneZone(p, '서울 강서구'), null);
    assert.equal(data.sceneZone(p, '대한민국 서울 강서구'), null);
    // (an owner in Seoul: the district of their own city is theirs, the country before it too)
    const s = { ...zonePhone('11-05 03:38'), life: { weather: { here: { place: 'Seoul' }, cities: [{ name: 'Seoul', ko: '서울', tz: 'Asia/Seoul' }, { name: 'Frankfurt am Main', tz: 'Europe/Berlin' }] } } };
    assert.equal(data.sceneZone(s, '대한민국 서울 강서구')?.tz, 'Asia/Seoul');
    assert.equal(data.sceneZone(s, '대한민국 서울 강서구')?.own, true);
    // (as written first: Seoul is Seoul; a country alone is no city)
    assert.deepEqual(data.sceneZone(p, '대한민국 서울'), data.sceneZone(p, '서울'));
    assert.equal(data.sceneZone(p, '대한민국'), null);
    assert.equal(data.sceneZone(p, 'South Korea'), null);
});

// a neighbourhood only (src/placehoods.js): its city, when the phone knows that city and only one; never a shop's name
test('a scene at a neighbourhood ("시부야 사거리", "Kreuzberg") is its city\'s when the phone knows that city; a shop named after one is not', () => {
    const p = zonePhone('11-05 03:38');
    // (Tokyo known to no one here: unknown, never a move guessed)
    assert.equal(data.sceneZone(p, '시부야 사거리'), null);
    p.life.weather.cities.push({ name: 'Tokyo', ko: '도쿄', tz: 'Asia/Tokyo' });
    for (const place of ['시부야 사거리', 'Shibuya Crossing', '시부야역', '渋谷駅', '시부야사거리 · 카페']) {
        const z = data.sceneZone(p, place);
        assert.deepEqual([z?.tz, z?.name, z?.hood], ['Asia/Tokyo', 'Tokyo', true], place);
    }
    assert.equal(data.sceneZone(p, 'Shibuya Coffee'), null);
    assert.equal(data.sceneZone(p, 'Manhattan · 집')?.tz, 'America/New_York');
    assert.equal(data.sceneZone(p, 'Westend · Küche')?.own, true);
    // (Chelsea is London's and New York's, both known: no guess)
    assert.equal(data.sceneZone(p, 'Chelsea'), null);
    // (a city's own name is found as before, not as a neighbourhood)
    assert.equal(data.sceneZone(p, 'Tokyo · 호텔')?.hood, undefined);
});

test('OWNER\'S CLOCK keeps different cities with the same zone or current offset, and requires whole city names', () => {
    const p = zonePhone('11-05 03:38');
    p.life.weather.cities.push({ name: 'Busan', tz: 'Asia/Seoul' }, { name: 'Tokyo', tz: 'Asia/Tokyo' });
    p.where = { people: [{ name: 'Somang Park', city: 'Seoul', tz: 'Asia/Seoul' }] };
    const block = data.clockBlock(p);
    assert.doesNotMatch(block, /^- Seoul:/m);
    for (const name of ['Busan', 'Tokyo', 'Somang Park (Seoul)']) assert.ok(block.includes(`- ${name}: +8 hours`));
    p.where.people.push({ name: 'Mara', city: 'New York City', tz: 'America/New_York' });
    assert.match(data.clockBlock(p), /^- New York: -6 hours \(DST: -5 hours before 11-01 07:00\)$/m);
    assert.match(data.clockBlock(p), /^- Mara \(New York City\): -6 hours \(DST: -5 hours before 11-01 07:00\)$/m);
    // An explicitly saved alias, unlike a shared first word, establishes that these are the same city.
    p.where.people.at(-1).names = ['New York'];
    assert.doesNotMatch(data.clockBlock(p), /^- New York:/m);
    assert.match(data.clockBlock(p), /^- Mara \(New York City\): -6 hours \(DST: -5 hours before 11-01 07:00\)$/m);
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
    assert.match(data.clockBlock(p), /^- Somang Park \(Seoul\): \+7 hours \(DST: \+8 hours from 10-25 03:00→02:00\)$/m);
    assert.doesNotMatch(data.clockBlock(p), /^- Seoul:/m);
    const november = data.clockBlock(p, '11-05 03:38');
    assert.match(november, /Saved phone time: 10-20 12:00\nClock reference time: 11-05 03:38/);
    assert.match(november, /^- Somang Park \(Seoul\): \+8 hours$/m);
    assert.match(november, /^- London: -1 hour$/m);
    assert.match(november, /^- New York: -6 hours \(DST: -5 hours before 11-01 07:00\)$/m);
    delete p.where;
    assert.match(data.clockBlock(p), /^- Seoul: \+7 hours \(DST: \+8 hours from 10-25 03:00→02:00\)$/m);
});

test('OWNER\'S CLOCK names a summer-time change within a week of its time, on the owner\'s clock, either place\'s', () => {
    // (Frankfurt's ends 10-25 at 03:00 its own time; New York's 11-01 at 02:00 there, 07:00 in Frankfurt; London's with Frankfurt's)
    const block = at => data.clockBlock(zonePhone(at), at);
    assert.match(block('10-24 12:00'), /- Seoul: \+7 hours \(DST: \+8 hours from 10-25 03:00→02:00\)\n- London: -1 hour\n- New York: -6 hours \(DST: -5 hours from 10-25 03:00→02:00\)$/);
    assert.match(block('10-26 12:00'), /- Seoul: \+8 hours \(DST: \+7 hours before 10-25 03:00→02:00\)\n- London: -1 hour\n- New York: -5 hours \(DST: -6 hours before 10-25 03:00→02:00; -6 hours from 11-01 07:00\)$/);
    assert.match(block('11-08 06:00'), /- New York: -6 hours \(DST: -5 hours before 11-01 07:00\)$/);
    assert.match(block('11-08 08:00'), /- New York: -6 hours$/);
    // (spring: Frankfurt's begins 03-29 at 02:00, New York's 03-08)
    assert.match(block('03-27 12:00'), /- Seoul: \+8 hours \(DST: \+7 hours from 03-29 02:00→03:00\)\n- London: -1 hour\n- New York: -5 hours \(DST: -6 hours from 03-29 02:00→03:00\)$/);
    assert.deepEqual(data.dstNear('10-26 12:00', 'Europe/Berlin', 'Europe/London', 2026), []);
    // (a place on the owner's hours now, but not in a week: its row stays, with the change; never in the archive's block)
    const lagos = { owner: 'Ren', year: 2026, now: '10-24 12:00', life: { weather: { here: { place: 'London' }, cities: [{ name: 'London', tz: 'Europe/London' }, { name: 'Lagos', tz: 'Africa/Lagos' }, { name: 'Seoul', tz: 'Asia/Seoul' }] } } };
    assert.match(data.clockBlock(lagos, lagos.now), /- Lagos: 0 hours \(DST: \+1 hour from 10-25 02:00→01:00\)/);
    // (a saved city in the owner's own zone is a row too, "0 hours"; the city the owner is in never is)
    const munich = { owner: 'Ren', year: 2026, now: '11-09 05:16', life: { weather: { here: { place: 'Frankfurt' }, cities: [{ name: 'Frankfurt', tz: 'Europe/Berlin' }, { name: 'Seoul', tz: 'Asia/Seoul' }, { name: 'Munich', tz: 'Europe/Berlin' }] } } };
    const mb = data.clockBlock(munich, munich.now);
    assert.match(mb, /- Seoul: \+8 hours\n- Munich: 0 hours$/);
    assert.doesNotMatch(mb, /- Frankfurt/);
    // (two changes an hour apart, one while the owner's clock repeats an hour: told apart)
    const ny = { owner: 'Ren', year: 2026, now: '10-30 12:00', life: { weather: { here: { place: 'New York' }, cities: [{ name: 'New York', tz: 'America/New_York' }, { name: 'Chicago', tz: 'America/Chicago' }, { name: 'Seoul', tz: 'Asia/Seoul' }] } } };
    assert.match(data.clockBlock(ny, ny.now), /- Chicago: -1 hour \(DST: 0 hours from 11-01 02:00→01:00; -1 hour from 11-01 02:00\)/);
    // (a time the change skips or repeats: the line never contradicts the hours it gives)
    for (const at of ['03-29 02:30', '10-25 02:30']) {
        const line = data.clockBlock(zonePhone(at), at).split('\n').find(l => l.startsWith('- Seoul'));
        const [, now, then] = /: ([+-]?[\d.]+) hours?(?: \(DST: ([+-]?[\d.]+))?/.exec(line);
        assert.ok(then === undefined || then !== now, line);
    }
    // (the same day gives the same line, whatever its minute)
    const adelaide = mm => { const x = { owner: 'Ren', year: 2026, now: `10-02 12:${mm}`, life: { weather: { here: { place: 'Sydney' }, cities: [{ name: 'Sydney', tz: 'Australia/Sydney' }, { name: 'Adelaide', tz: 'Australia/Adelaide' }, { name: 'Seoul', tz: 'Asia/Seoul' }] } } }; return data.clockBlock(x, x.now).split('\n').find(l => l.startsWith('- Adelaide')); };
    assert.equal(adelaide('15'), adelaide('45'));
    assert.deepEqual(data.dstNear('nonsense', 'Europe/Berlin', 'Asia/Seoul', 2026), []);
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

test('다시 만들기 (the whole phone) keeps the voice table: the rows, who not to ask the story again, its tidy mark', async () => {
    globalThis.__rows = rows(8);
    const koVoice = [{ who: 'Ren', style: '엄마한테도 반말', by: 'user' }, { who: 'Mara', style: '다정한 반말', label: '다정한 반말', by: 'model', evidence: ['hey'] }];
    const langs = { texts: ['한국어'], knows: ['English'], by: 'user' };
    const p = plainPhone({ koVoice: structuredClone(koVoice), koVoiceAsked: ['Ivo'], koVoiceV: 3, langs: structuredClone(langs) });
    const mm = { ...m, phones: { ren: p } };
    globalThis.__menu = { calls: [], answers: [JSON.stringify({ now: '10-26 09:00', notes: [{ title: 'Groceries', text: 'milk', time: '10-26 08:00' }] })], answer: '{}' };
    const warn = console.warn; console.warn = () => {};
    try { await data.makePhone(mm, 'Ren'); } finally { console.warn = warn; }
    const q = mm.phones.ren;
    assert.notEqual(q, p);
    assert.deepEqual([q.koVoice, q.koVoiceAsked, q.koVoiceV], [koVoice, ['Ivo'], 3]);
    // the languages the owner writes in (말투 › 언어) stay too
    assert.deepEqual(q.langs, langs);
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
    globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }, { name: 'Mara', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }, { name: 'Ivo', city: 'Paris', lives: 'FR', tz: 'Europe/Paris' }], year: 2026 };
    try { info = await data.rereadPlaces(mm, p); } finally { delete globalThis.__whereAnswer; }
    assert.deepEqual([info.owner.lives, info.owner.city], ['DE', 'Frankfurt']);
    assert.deepEqual(info.people.map(x => [x.name, x.city]), [['Mara', 'Berlin']]);
    assert.equal(p.lives, 'DE');
});

test('위치 정보 › AI로 다시 읽기 › 전부 새로: what was set by hand and the people taken off are read anew too', async () => {
    globalThis.__rows = rows(8);
    const p = plainPhone({ country: 'KR', where: { at: 1, removed: ['ivo'], people: [{ name: 'Ren', city: 'Frankfurt', names: ['Frankfurt'], lives: 'DE', tz: 'Europe/Berlin', manual: { city: true, lives: true } }] }, lives: 'DE', livesManual: true, contacts: [{ name: 'Ivo' }] });
    globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }, { name: 'Ivo', city: 'Paris', lives: 'FR', tz: 'Europe/Paris' }], year: 2026 };
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
    globalThis.__whereAnswer = { people: [], year: 2026 };
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
        ['app remake', (mm, p) => data.makePhone(mm, p.owner, { apps: ['note'] }), notesAnswer('Ticket'), data.AI_SYS_PHONE_APPS],
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

// ---- OWNER'S CLOCK, one for every request: the hours and the time choices from the same time, the newest message read
const clockFixture = (newest, { system = false, now = '11-03 03:03' } = {}) => {
    const chat = Array.from({ length: 7 }, (_, i) => ({ name: 'Ren', is_user: false, is_system: i === 5 ? system : i < 4,
        mes: i < 4 ? 'Earlier.' : i === 4 ? 'Mara texts. <span class="time">11월 2일 09시 00분</span>' : i === 5 ? newest : '<time id="future-clock">22:59</time>' }));
    globalThis.__ctx = { chat, chatMetadata: {}, characters: [] };
    globalThis.__rows = chat.map((x, index) => ({ index, hidden: x.is_system, user: false, text: `[#${index}] Ren: ${htmlClean(x.mes, { stripTags: true })}` }));
    const p = plainPhone({ year: 2026, now, where: { at: 1, people: [{ name: 'Ren', city: 'Frankfurt am Main', tz: 'Europe/Berlin', names: ['Frankfurt'] }, { name: 'Mara', city: 'Seoul', tz: 'Asia/Seoul', names: ['Seoul'] }] },
        sync: { marks: { base: { index: 5 } }, done: [], hiddenRead: {} } });
    return { p, m: { text: m.text, phoneScreenHolder: 'Mara', phones: { ren: p } } };
};

test('every fill, making a phone again and its apps get the time choices of the newest message they read, as the reflection does', async () => {
    const cases = [
        ['life', (mm, p) => life.fillLife(mm, p), lifeAnswer('Wake'), life.AI_SYS_LIFE],
        ['delivery', (mm, p) => life.fillDelivery(mm, p), '{}', life.AI_SYS_DELIVERY],
        ['money', (mm, p) => data.fillMoney(mm, p), moneyAnswer('Ticket', 500, '11-03 03:03'), data.AI_SYS_MONEY],
        ['voice', (mm, p) => data.fillVoice(mm, p), '{"memos":[]}', data.AI_SYS_VOICES],
        ['app remake', (mm, p) => data.makePhone(mm, p.owner, { apps: ['note'] }), notesAnswer('Ticket'), data.AI_SYS_PHONE_APPS],
    ];
    try {
        for (const [name, run, answer, system] of cases) {
            const { p, m: mm } = clockFixture('Mara looks at her phone. <span class="time">11월 3일 오후 4시 15분</span>');
            globalThis.__menu = { calls: [], answer };
            try { await run(mm, p); } catch { /* the inputs are what this checks */ }
            const call = globalThis.__menu.calls.find(x => x.sys === system);
            assert.ok(call, name);
            assert.match(call.input, /\[OWNER'S CLOCK\]\nPhone owner: Ren\n[\s\S]*Time differences from Frankfurt am Main:\n- Mara \(Seoul\): \+8 hours[\s\S]*Time choices\./, name);
            // (11-03 16:15 in Seoul is 08:15 in Frankfurt; never the older message's, never one past the phone's clock)
            assert.match(call.input, /On Mara's clock → owner's time: 11-03 08:15/, name);
            assert.doesNotMatch(call.input, /11-02 01:00|22:59 →/, name);
            assert.equal((call.input.match(/\[OWNER'S CLOCK\]/g) || []).length, 1, name);
        }
        // the reflection's own request: the same block, the same choice
        const { p, m: mm } = clockFixture('Mara looks at her phone. <span class="time">11월 3일 오후 4시 15분</span>');
        const rowsNow = [{ index: 5, text: globalThis.__rows[5].text, clockSource: globalThis.__ctx.chat[5].mes }];
        assert.equal(data.ownerClock(p, p.now, mm, null, rowsNow), [data.clockBlock(p, p.now, mm), (await data.reflectionClocks(p, rowsNow, mm)).text].join('\n\n'));
        assert.equal(data.fillClock(mm, p, p.now, null, data.windowOf(mm, p)), data.ownerClock(p, p.now, mm, null, rowsNow));
    } finally { delete globalThis.__ctx; }
});

test('a fill\'s choices are worked out from the time its hours are (Frankfurt\'s summer time ends between the saved clock and the read one)', () => {
    try {
        const { p, m: mm } = clockFixture('Mara looks at her phone. <span class="time">16시 15분</span>', { now: '10-24 03:38' });
        const g = data.windowOf(mm, p), late = data.fillClock(mm, p, '10-26 03:38', null, g), early = data.fillClock(mm, p, '10-24 03:38', null, g);
        assert.match(late, /Clock reference time: 10-26 03:38[\s\S]*- Mara \(Seoul\): \+8 hours[\s\S]*owner's clock: 08:15/);
        assert.match(early, /- Mara \(Seoul\): \+7 hours[\s\S]*owner's clock: 09:15/);
    } finally { delete globalThis.__ctx; }
});

test('a fill\'s choices: never a system message\'s HTML, a timer, a hidden part or a quote; with TOLD SHORT its last lines, the later of one number', () => {
    try {
        for (const [newest, system] of [['<span class="timer">16시 15분</span>', true], ['<span class="timer">16시 15분</span>', false], ['<span class="timer">11월 3일 16시 15분</span>', false],
            ['<span style="display:none">11월 3일 16시 15분</span> Mara waits.', false], ['<blockquote>11.03 16:15</blockquote> Mara waits.', false], ['Mara waits. 16시 15분', false],
            ['11월 3일 16시 15분, Mara waits.', false], ['Mara waits. 11.03 16:15', false], ['<span class="time" style="display:none">11월 3일 16시 15분</span>', false]]) {
            const { p, m: mm } = clockFixture(newest, { system });
            const text = data.fillClock(mm, p, p.now, null, data.windowOf(mm, p));
            // (a system message isn't read: the newest one read is #4, and its clock is the one)
            if (system) assert.match(text, /owner's time: 11-02 01:00/, newest);
            else assert.doesNotMatch(text, /Time choices|On .*clock/, newest);
            assert.doesNotMatch(text, /08:15/, newest);
        }
        const { p, m: mm } = clockFixture('No clock.');
        const short = { text: '[TOLD SHORT — messages #6–#9, after RECENT CHAT: …]\n#7 · lunch — "11.03 12:00"\n#9 · met — "11.03 12:30"\n#9 · left — "11.03 16:15"' };
        assert.deepEqual(data.fillClockRows(mm, p, data.windowOf(mm, p), short).map(r => r.index), [7, 9, 9]);
        // (summaries are the story's text, never a screen: no choice, and never the older message's either)
        assert.doesNotMatch(data.fillClock(mm, p, p.now, null, data.windowOf(mm, p), short), /Time choices|On .*clock/);
    } finally { delete globalThis.__ctx; }
});

test('two rows of one number (two summaries of one message): the later one\'s clock is the newest', async () => {
    const { p, m: mm } = clockFixture('No clock.');
    try {
        const tf = s => `<span class="time">${s}</span>`;
        const r = await data.reflectionClocks(p, [{ index: 5, text: '', clockSource: tf('11.03 12:00') }, { index: 5, text: '', clockSource: tf('11.03 16:15') }, { index: 4, text: '', clockSource: tf('11.03 23:00') }], mm);
        assert.ok(r.choices.length && r.choices.every(c => c.sourceTime === '11.03 16:15'));
    } finally { delete globalThis.__ctx; }
});

test('every request sends OWNER\'S CLOCK alike: the block, the phone\'s name in it, then the choices when there are any', async () => {
    try {
        for (const [newest, choices] of [['No clock.', false], ['Mara looks. <span class="time">11월 3일 오후 4시 15분</span>', true]]) {
            const { p, m: mm } = clockFixture(newest);
            globalThis.__menu = { calls: [], answer: '{"memos":[]}' };
            try { await data.fillVoice(mm, p); } catch { /* the input is what this checks */ }
            const input = globalThis.__menu.calls.find(x => x.sys === data.AI_SYS_VOICES).input;
            assert.equal((input.match(/Phone being updated/g) || []).length, 1, newest);
            assert.match(input, /\[OWNER'S CLOCK\]\n[^[]*\n\nPhone being updated: "Ren" \(Frankfurt am Main\)\./, newest);
            if (choices) assert.match(input, /Phone being updated: "Ren" \(Frankfurt am Main\)\.\n\nTime choices\./);
            else assert.doesNotMatch(input, /Time choices/);
            // (the reflection's the same)
            const rows = [{ index: 5, text: globalThis.__rows[5].text, clockSource: globalThis.__ctx.chat[5].mes }];
            assert.ok(input.includes(data.ownerClock(p, p.now, mm, null, rows)), newest);
        }
        // a phone with no other place and no screen of its own: the block's first lines, then its name (never a line alone)
        const solo = { owner: 'Ren', year: 2026, now: '11-03 03:03', country: 'KR' };
        assert.equal(data.ownerClock(solo, solo.now, {}, null, []), "[OWNER'S CLOCK]\nPhone owner: Ren\nLocation: South Korea\nSaved phone time: 11-03 03:03\n\nPhone being updated: \"Ren\" (South Korea).");
        // (no place at all: nothing, as before)
        assert.equal(data.ownerClock({ owner: 'Ren' }, '', {}, null, []), '');
    } finally { delete globalThis.__ctx; }
});

test('a long newest message the request shows whole (no archive: the chat in its place) still gives its choices', async () => {
    try {
        const long = `${'Mara waits. '.repeat(600)}<span class="time">11월 3일 오후 4시 15분</span>`;
        const { p, m: mm } = clockFixture(long);
        mm.text = '';
        globalThis.__menu = { calls: [], answer: '{"memos":[]}' };
        try { await data.fillVoice(mm, p); } catch { /* the input is what this checks */ }
        const input = globalThis.__menu.calls.find(x => x.sys === data.AI_SYS_VOICES).input;
        assert.ok(input.includes('Mara waits. Mara waits.') && long.length > 6000);
        assert.match(input, /On Mara's clock → owner's time: 11-03 08:15/);
    } finally { delete globalThis.__ctx; }
});

test('a 02-29 with no year of its own is no choice in a story year without one', async () => {
    try {
        const { p, m: mm } = clockFixture('No clock.');
        const row = [{ index: 5, text: '', clockSource: '<span class="time">02-29 10:00</span>' }];
        assert.deepEqual((await data.reflectionClocks({ ...p, year: 2027 }, row, mm)).choices, []);
        assert.ok((await data.reflectionClocks({ ...p, year: 2028 }, row, mm)).choices.length > 0);
    } finally { delete globalThis.__ctx; }
});

test('making a phone sets its clock as a reflection does (CLOCK FIRST, "clock", the same check); making some apps again and the fills read times by its rules', async () => {
    assert.ok(data.AI_SYS_PHONE.includes('CLOCK FIRST') && data.AI_SYS_PHONE.includes('"clock": { "basis"'));
    for (const [name, s] of [['apps', data.AI_SYS_PHONE_APPS], ['money', data.AI_SYS_MONEY], ['voices', data.AI_SYS_VOICES], ['life', life.AI_SYS_LIFE], ['delivery', life.AI_SYS_DELIVERY]]) {
        assert.ok(!s.includes('CLOCK FIRST') && !s.includes('finalViewpoint'), name);
        assert.ok(s.includes(data.FILL_CLOCK) && s.includes(data.FILL_CLOCK_GET), name);
        assert.ok(s.includes('Attachments keep their own clocks.') && s.includes('use the matching converted OWNER\'S CLOCK value as-is'), name);
    }
    // (the reflection's own wording, unchanged: its viewpoint line is the one the fills share)
    assert.ok(data.updateSystem({ split: true }).includes(data.FILL_CLOCK.split('\n')[0]));
});

test('making a phone for the first time: where everyone is first (the people the chat already names, each once), then the phone, its OWNER\'S CLOCK and PEOPLE AROUND from it; the clock checked as a reflection\'s', async () => {
    const setup = () => {
        const { m: mm } = htmlPhoneFixture();
        globalThis.__ctx.characters = [{ name: 'Mara' }]; globalThis.__ctx.characterId = 0; globalThis.__ctx.name1 = '소망';
        mm.phones = { lio: { owner: 'Lio', country: 'KR' } }; mm.phoneScreenHolder = 'Mara';
        globalThis.__glossaryPeople = ['Ivo', '마라'];
        mm.text = '## #0–#3 — Arrival\n- Ren came home on 2026-11-02 (#1).\n';
        globalThis.__where = [];
        globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Frankfurt am Main', tz: 'Europe/Berlin', lives: 'DE' }, { name: 'Mara', city: 'Seoul', tz: 'Asia/Seoul', lives: 'KR' }],
            around: [{ name: 'Mara', about: 'Ren\'s mother, in Seoul; they text every day.' }], year: 2026 };
        return mm;
    };
    const made = (now, clock, contacts = ['Mara']) => JSON.stringify({ country: 'DE', now, clock, contacts: contacts.map(name => ({ name })), notes: [] });
    const at = { basis: 'Default used', finalViewpoint: 'Mara', elapsedTime: null, sceneTime: '11-03 11:10', messageSender: null };
    try {
        let mm = setup(), seenWhere = -1;
        globalThis.__menu = { calls: [], answers: [() => { seenWhere = globalThis.__where.length; return made('11-03 03:10', at); }] };
        const p = await data.makePhone(mm, 'Ren');
        assert.equal(seenWhere, 1, 'where is read before the phone');
        const people = globalThis.__where[0].split('[PEOPLE]\n')[1].split('\n\n')[0].split('\n');
        assert.deepEqual([...people].sort(), ['Ivo', 'Lio', 'Mara', '마라', '소망'].sort());
        const input = globalThis.__menu.calls[0].input;
        assert.match(input, /Time differences from Frankfurt am Main:\n[^[]*- Mara \(Seoul\): \+8 hours/);
        assert.match(input, /\[PEOPLE AROUND\]\n- Mara: Ren's mother/);
        assert.equal(p.now, '11-03 03:10');
        assert.equal(p.where.people.find(x => x.name === 'Mara').tz, 'Asia/Seoul');
        assert.equal(p.around.people[0].name, 'Mara');
        // (its year from the start: the phone keeps the one the check went by)
        assert.equal(p.year, 2026);
        assert.equal(globalThis.__where.length, 1, 'no second reading: no one new on it');
        // someone new on it: read again for them
        mm = setup();
        globalThis.__menu = { calls: [], answers: [made('11-03 03:10', at, ['Mara', 'Varo'])] };
        await data.makePhone(mm, 'Ren');
        assert.equal(globalThis.__where.length, 2);
        // a "now" its scene's time doesn't give, or no "clock": not saved, as a reflection's
        for (const answer of [made('11-03 11:10', at), made('11-03 03:10', null)]) {
            mm = setup();
            globalThis.__menu = { calls: [], answers: [answer] };
            await assert.rejects(data.makePhone(mm, 'Ren'), /시간 판독 답이 맞지 않아요/);
            assert.equal(mm.phones.ren, undefined);
        }
    } finally { delete globalThis.__ctx; delete globalThis.__whereAnswer; delete globalThis.__glossaryPeople; }
});

test('위치 정보 before a phone is made: read once and kept, checked and set by the user (a city, the year), then the phone made from it, a make asked again reading nothing again', async () => {
    try {
        const { m: mm } = htmlPhoneFixture(); mm.phones = {};
        globalThis.__ctx.characters = [{ name: 'Mara' }]; globalThis.__ctx.characterId = 0; globalThis.__ctx.name1 = '소망';
        mm.phoneScreenHolder = 'Mara';
        globalThis.__where = [];
        globalThis.__whereAnswer = { people: [{ name: 'Mara', city: 'Seoul', tz: 'Asia/Seoul', lives: 'KR' }], around: [{ name: 'Mara', about: 'Ren\'s mother.' }], year: 2026 };
        const pre = await data.preparePhone(mm, 'Ren');
        assert.equal(globalThis.__where.length, 1);
        assert.equal(await data.preparePhone(mm, 'Ren'), pre, 'kept: not read again');
        // (참고 로어북 changed after it was read: read again; back as it was: the new reading stays)
        mm.phoneLore = ['Atlas'];
        const again = await data.preparePhone(mm, 'Ren');
        assert.notEqual(again, pre); assert.equal(globalThis.__where.length, 2);
        mm.phoneLore = [];
        const pre2 = await data.preparePhone(mm, 'Ren');
        assert.equal(globalThis.__where.length, 3);
        assert.equal(await data.preparePhone(mm, 'Ren'), pre2);
        // the reading didn't place the owner: the user does, and the year
        assert.equal(data.placeInfo(pre).owner.city, '');
        await data.setPlaceCity(mm, pre2, 'Ren', 'Frankfurt');
        await data.setOwnerLives(mm, pre2, 'DE');
        await data.setPreYear(mm, 'Ren', 2026);
        assert.equal(data.placeInfo(pre2).people.find(x => x.name === 'Mara').hours, 8);
        const at = { basis: 'Default used', finalViewpoint: 'Mara', elapsedTime: null, sceneTime: '11-03 11:10', messageSender: null };
        const made = now => JSON.stringify({ country: 'KR', now, clock: at, contacts: [{ name: 'Mara' }], notes: [] });
        // a clock its check doesn't pass: not made, and asked again reads no place again
        globalThis.__menu = { calls: [], answers: [made('11-03 11:10')] };
        await assert.rejects(data.makePhone(mm, 'Ren'), /시간 판독 답이 맞지 않아요/);
        assert.ok(data.phonePre(mm, 'Ren'));
        globalThis.__menu = { calls: [], answers: [made('11-03 03:10')] };
        const p = await data.makePhone(mm, 'Ren');
        assert.equal(globalThis.__where.length, 3, 'no reading but those before');
        assert.match(globalThis.__menu.calls[0].input, /Location: Frankfurt\n[\s\S]*- Mara \(Seoul\): \+8 hours/);
        assert.equal(p.year, 2026);
        assert.equal(p.country, 'DE', 'the country it lives in, as checked');
        assert.equal(p.where.people.find(x => x.name === 'Ren').city, 'Frankfurt');
        assert.equal(data.phonePre(mm, 'Ren'), null, 'gone once the phone is made');
        assert.ok(!('making' in p) && !('asked' in p));
    } finally { delete globalThis.__ctx; delete globalThis.__whereAnswer; }
});

test('making a phone (and some apps again): people from the story, PEOPLE AROUND or new plausible ones, as the reflection\'s everyday; no new relative or partner', () => {
    for (const s of [data.AI_SYS_PHONE, data.AI_SYS_PHONE_APPS]) {
        assert.ok(s.includes('- People: from the story, PEOPLE AROUND, or new plausible ones with local names (a colleague, a neighbour, a shop); no new relative or partner. A relationship word (girlfriend, ex, husband, boss) only if the archive or chat uses it for them.'), s.slice(0, 40));
        // (the owner's ordinary life around the story fills the lists, to about so many each; never "an empty list is fine")
        assert.ok(s.includes("- Around the story, the owner's ordinary life before its newest moment fills the rest:") && s.includes('Never a new event, relationship or secret.'));
        assert.ok(s.includes('Fill each list to about: 10 threads of 6 to 15 messages, 20 calls, 15 photos, 10 notes, 15 searches (3 open at most), 10 events, 6 posts with up to 4 comments,\n10 mails, 8 diary entries, the 30 newest visits. Who they talk to, and how much, follows their character and PEOPLE AROUND.'));
        assert.doesNotMatch(s, /an empty list is fine|At most 6 threads/);
    }
    assert.ok(data.updateSystem({ split: true }).includes('- People: only people the story or PEOPLE AROUND has.'));
});

test('the bank and voice memo fills get PEOPLE AROUND, and take their people from the story or it; life and delivery do not', async () => {
    for (const s of [data.AI_SYS_MONEY, data.AI_SYS_VOICES]) assert.ok(s.includes('- PEOPLE AROUND (sometimes):') && s.includes('only people the story or PEOPLE AROUND has'), s.slice(0, 60));
    for (const s of [life.AI_SYS_LIFE, life.AI_SYS_DELIVERY]) assert.ok(!s.includes('PEOPLE AROUND'));
    try {
        for (const [name, run, answer, system] of [['money', (mm, p) => data.fillMoney(mm, p), moneyAnswer('Ticket', 500, '11-03 03:03'), data.AI_SYS_MONEY], ['voice', (mm, p) => data.fillVoice(mm, p), '{"memos":[]}', data.AI_SYS_VOICES]]) {
            const { p, m: mm } = clockFixture('No clock.');
            p.around = { at: 1, people: [{ name: 'Mara', aka: [], about: 'Ren sends her money every month.' }] };
            globalThis.__menu = { calls: [], answer };
            try { await run(mm, p); } catch { /* the input is what this checks */ }
            assert.match(globalThis.__menu.calls.find(x => x.sys === system).input, /\[PEOPLE AROUND\]\n- Mara: Ren sends her money every month\./, name);
        }
    } finally { delete globalThis.__ctx; }
});

test('a name and its other form in 용어집 ("Ivo = 이보") are one person: asked once, never read again for it, its row keeping both forms', async () => {
    try {
        const { m: mm } = htmlPhoneFixture(); mm.phones = {};
        globalThis.__ctx.characters = [{ name: 'Mara' }]; globalThis.__ctx.characterId = 0; globalThis.__ctx.name1 = 'Lio';
        mm.phoneScreenHolder = 'Mara';
        globalThis.__glossaryPeople = ['Ivo']; globalThis.__glossaryEntries = [{ src: 'Ivo', ko: '이보' }];
        globalThis.__where = [];
        globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Frankfurt am Main', tz: 'Europe/Berlin', lives: 'DE' }, { name: '이보', city: 'Frankfurt am Main', tz: 'Europe/Berlin', lives: 'DE' }], year: 2026 };
        const at = { basis: 'Ren', finalViewpoint: 'Ren', elapsedTime: null, sceneTime: '11-03 03:10', messageSender: null };
        globalThis.__menu = { calls: [], answers: [JSON.stringify({ country: 'DE', now: '11-03 03:10', clock: at, contacts: [{ name: '이보' }], threads: [{ with: '이보', messages: [{ from: '이보', text: 'Hallo', time: '11-03 03:00' }] }], notes: [] })] };
        const p = await data.makePhone(mm, 'Ren');
        const people = globalThis.__where[0].split('[PEOPLE]\n')[1].split('\n\n')[0].split('\n');
        assert.equal(people.filter(n => n === 'Ivo' || n === '이보').length, 1, 'asked once');
        assert.equal(globalThis.__where.length, 1, 'not read again for 이보');
        const row = p.where.people.find(x => x.name === '이보');
        assert.ok(row && row.aka.includes('Ivo'));
    } finally { delete globalThis.__ctx; delete globalThis.__whereAnswer; delete globalThis.__glossaryPeople; delete globalThis.__glossaryEntries; }
});

test('PEOPLE AROUND goes by the name 위치 정보 has for a person (용어집 other form or aka): one person, one name', async () => {
    try {
        const { m: mm } = htmlPhoneFixture(); mm.phones = {};
        globalThis.__ctx.characters = [{ name: 'Mara' }]; globalThis.__ctx.characterId = 0;
        globalThis.__glossaryPeople = ['Ivo']; globalThis.__glossaryEntries = [{ src: 'Ivo', ko: '이보' }];
        globalThis.__where = [];
        globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Frankfurt am Main', tz: 'Europe/Berlin', lives: 'DE' }, { name: '이보', city: 'Frankfurt am Main', tz: 'Europe/Berlin', lives: 'DE' }],
            around: [{ name: 'Ivo', about: 'Ren\'s friend from university.' }] };
        const pre = await data.preparePhone(mm, 'Ren');
        assert.deepEqual(pre.around.people.map(x => [x.name, x.aka]), [['이보', ['Ivo']]]);
        assert.ok(pre.where.people.find(x => x.name === '이보').aka.includes('Ivo'));
    } finally { delete globalThis.__ctx; delete globalThis.__whereAnswer; delete globalThis.__glossaryPeople; delete globalThis.__glossaryEntries; }
});

test('reading where everyone is again: a person read back by the other form of their name is one row (its city set by hand kept); one taken off stays off by either form; two around entries of one person are one', async () => {
    const base = () => {
        const { m: mm } = htmlPhoneFixture();
        globalThis.__glossaryEntries = [{ src: 'Ivo', ko: '이보' }, { src: 'Yu', ko: '유우' }];
        const p = mm.phones.ren;
        p.contacts = [{ name: 'Ivo' }, { name: 'Yu' }];
        p.where = { at: 1, people: [{ name: 'Ren', city: 'Frankfurt am Main', names: ['Frankfurt am Main'], tz: 'Europe/Berlin' },
            { name: 'Ivo', city: 'Seoul', names: ['Seoul'], tz: 'Asia/Seoul', aka: ['이보'], manual: { city: true } }] };
        return { mm, p };
    };
    try {
        let { mm, p } = base();
        globalThis.__whereAnswer = { people: [{ name: '이보', city: 'Rome', tz: 'Europe/Rome' }, { name: 'Yu', city: 'Tokyo', tz: 'Asia/Tokyo' }, { name: '유우', city: 'Tokyo', tz: 'Asia/Tokyo' }],
            around: [{ name: 'Ivo', about: 'brother' }, { name: '이보', about: 'coworker' }] };
        await data.rereadPlaces(mm, p);
        const ivo = p.where.people.filter(x => ['Ivo', '이보'].includes(x.name));
        assert.equal(ivo.length, 1, JSON.stringify(p.where.people));
        assert.equal(ivo[0].city, 'Seoul', 'the city set by hand stays');
        assert.equal(p.where.people.filter(x => ['Yu', '유우'].includes(x.name)).length, 1, 'two forms the same length: one row');
        for (const r of p.where.people) assert.ok(!arr(r.aka).some(a => a.toLowerCase() === r.name.toLowerCase()), 'no row has its own name as an aka');
        assert.equal(p.around.people.length, 1);
        ({ mm, p } = base());
        p.where.people = p.where.people.filter(x => x.name !== 'Ivo'); p.where.removed = ['ivo'];
        globalThis.__whereAnswer = { people: [{ name: '이보', city: 'Rome', tz: 'Europe/Rome' }], year: 2026 };
        await data.rereadPlaces(mm, p);
        assert.ok(!p.where.people.some(x => ['Ivo', '이보'].includes(x.name)), 'taken off as Ivo, stays off as 이보');
    } finally { delete globalThis.__ctx; delete globalThis.__whereAnswer; delete globalThis.__glossaryEntries; }
});
const arr = v => (Array.isArray(v) ? v : []);

test('making a phone for the first time (점검 수정): its hours on the story\'s day, the year checked before, an old phone\'s own year and country, a failed reading not asked again, a reading kept for a make asked again', async () => {
    const setup = (text, extra = {}) => {
        const { m: mm } = htmlPhoneFixture();
        globalThis.__ctx.characters = [{ name: 'Mara' }]; globalThis.__ctx.characterId = 0;
        mm.phones = {}; mm.phoneScreenHolder = 'Mara'; mm.text = text; Object.assign(mm, extra);
        globalThis.__where = [];
        globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Frankfurt am Main', tz: 'Europe/Berlin', lives: 'DE' }, { name: 'Mara', city: 'Seoul', tz: 'Asia/Seoul', lives: 'KR' }], year: 2026 };
        return mm;
    };
    const made = (now, scene, year = 2026) => JSON.stringify({ country: 'DE', now, clock: { basis: 'Default used', finalViewpoint: 'Mara', elapsedTime: null, sceneTime: scene, messageSender: null }, contacts: [{ name: 'Mara' }], notes: [] });
    const input = () => globalThis.__menu.calls.find(x => x.sys === data.AI_SYS_PHONE).input;
    try {
        // a July story with no status line: a date in the archive may be a memory ("first met on 2025-07-01"), so the hours
        // go with every change in the year, and the answer worked out by July's (+7) holds
        let mm = setup('## #0–#3 — Summer\n- Ren came home on 2026-07-10 (#1). They first met on 2026-01-03, and Ren came home on 2026-07-10 again.\n');
        globalThis.__menu = { calls: [], answers: [made('07-10 04:10', '07-10 11:10')] };
        let p = await data.makePhone(mm, 'Ren');
        assert.match(input(), /- Mara \(Seoul\): \+[78] hours \(DST: \+7 hours from 03-29 02:00→03:00; \+8 hours from 10-25 03:00→02:00\)/);
        assert.doesNotMatch(input(), /Clock reference time/);
        assert.equal(p.now, '07-10 04:10');
        // no day at all: the hours with every change in the year
        mm = setup('## #0–#3 — Arrival\n- Ren came home.\n');
        globalThis.__menu = { calls: [], answers: [made('07-10 04:10', '07-10 11:10')] };
        await data.makePhone(mm, 'Ren').catch(() => null);
        assert.match(input(), /- Mara \(Seoul\): \+[78] hours \(DST: \+7 hours from 03-\d\d 02:00→03:00; \+8 hours from 10-\d\d 03:00→02:00\)/);
        // the year set before the make is the one the request has
        mm = setup('## #0–#3 — Summer\n- Ren came home on 2026-07-10 (#1).\n');
        await data.preparePhone(mm, 'Ren');
        await data.setPreYear(mm, 'Ren', 2019);
        globalThis.__menu = { calls: [], answers: [made('07-10 04:10', '07-10 11:10')] };
        p = await data.makePhone(mm, 'Ren');
        assert.match(input(), /\[STORY YEAR\]\n2019/);
        assert.equal(p.year, 2019);
        // an old phone with no 위치 정보, made again whole: its own year and where it lives
        mm = setup('## #0–#3 — Summer\n- Ren came home on 2026-07-10 (#1).\n');
        mm.phones = { ren: plainPhone({ year: 2019, lives: 'DE', livesManual: true }) };
        globalThis.__menu = { calls: [], answers: [made('07-10 04:10', '07-10 11:10')] };
        p = await data.makePhone(mm, 'Ren');
        assert.match(input(), /\[STORY YEAR\]\n2019/);
        assert.deepEqual([p.year, p.lives, p.livesManual], [2019, 'DE', true]);
        // a reading that failed: the phone is made without it, and it is not asked again after
        mm = setup('## #0–#3 — Summer\n- Ren came home on 2026-07-10 (#1).\n');
        globalThis.__whereAnswer = { toJSON() { throw new Error('no answer'); } };
        globalThis.__menu = { calls: [], answers: [JSON.stringify({ country: 'DE', now: '07-10 11:10', clock: { basis: 'Default used', finalViewpoint: 'Mara', elapsedTime: null, sceneTime: '07-10 11:10', messageSender: null }, contacts: [{ name: 'Mara' }, { name: 'Varo' }], notes: [] })] };
        p = await data.makePhone(mm, 'Ren');
        assert.ok(p.where.failed);
        assert.equal(globalThis.__where.length, 1);
        // a make whose clock check fails keeps what it read: asked again, it reads none of it again
        mm = setup('## #0–#3 — Summer\n- Ren came home on 2026-07-10 (#1).\n');
        globalThis.__menu = { calls: [], answers: [made('07-10 11:10', '07-10 11:10')] };
        await assert.rejects(data.makePhone(mm, 'Ren'));
        assert.ok(data.phonePre(mm, 'Ren')?.where?.people?.length);
        globalThis.__menu = { calls: [], answers: [made('07-10 04:10', '07-10 11:10')] };
        await data.makePhone(mm, 'Ren');
        assert.equal(globalThis.__where.length, 1);
        assert.equal(data.phonePre(mm, 'Ren'), null);
    } finally { delete globalThis.__ctx; delete globalThis.__whereAnswer; }
});

test('점검 수정 2: a failed reading is read again on the next make; "Mara Lee" for a Mara read before needs no second reading; a reading kept for a phone gone since is not used; the year it read moves with 날짜 및 시간; a second turn with no "now" keeps its records', async () => {
    const setup = text => {
        const { m: mm } = htmlPhoneFixture();
        globalThis.__ctx.characters = [{ name: 'Mara' }]; globalThis.__ctx.characterId = 0;
        mm.phones = {}; mm.phoneScreenHolder = 'Mara'; mm.text = text;
        globalThis.__where = [];
        globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Frankfurt am Main', tz: 'Europe/Berlin', lives: 'DE' }, { name: 'Mara', city: 'Seoul', tz: 'Asia/Seoul', lives: 'KR' }], year: 2026 };
        return mm;
    };
    const cl = scene => ({ basis: 'Default used', finalViewpoint: 'Mara', elapsedTime: null, sceneTime: scene, messageSender: null });
    const made = (now, scene, contacts = ['Mara']) => JSON.stringify({ country: 'DE', now, clock: cl(scene), contacts: contacts.map(name => ({ name })), notes: [] });
    const text = '## #0–#3 — Arrival\n- Ren came home on 2026-11-02 (#1).\n';
    try {
        // the reading fails, the make fails too; asked again (the network back), it is read again
        let mm = setup(text);
        const good = globalThis.__whereAnswer;
        globalThis.__whereAnswer = { toJSON() { throw new Error('offline'); } };
        globalThis.__menu = { calls: [], answers: [new Error('quota')] };
        await assert.rejects(data.makePhone(mm, 'Ren'));
        assert.ok(data.phonePre(mm, 'Ren').where.failed);
        globalThis.__whereAnswer = good;
        globalThis.__menu = { calls: [], answers: [made('11-03 03:10', '11-03 11:10')] };
        let p = await data.makePhone(mm, 'Ren');
        assert.equal(globalThis.__where.length, 2);
        assert.ok(!p.where.failed && p.where.people.some(x => x.name === 'Mara'));
        // "Mara Lee" on the phone, Mara read before: no second reading
        mm = setup(text);
        globalThis.__menu = { calls: [], answers: [made('11-03 03:10', '11-03 11:10', ['Mara Lee'])] };
        await data.makePhone(mm, 'Ren');
        assert.equal(globalThis.__where.length, 1);
        // read for an old phone, then the phone is gone: a new one reads anew; the year read moves with 날짜 및 시간
        mm = setup(text);
        mm.phones = { ren: plainPhone({ year: 2019 }) };
        await data.preparePhone(mm, 'Ren');
        data.setStoryYear(mm, mm.phones.ren, 2024);
        assert.equal(data.phonePre(mm, 'Ren').year, 2024);
        delete mm.phones.ren;
        globalThis.__menu = { calls: [], answers: [made('11-03 03:10', '11-03 11:10')] };
        p = await data.makePhone(mm, 'Ren');
        assert.equal(globalThis.__where.length, 2);
        assert.equal(p.year, 2026);
        assert.equal(data.phonePre(mm, 'Ren'), null);
    } finally { delete globalThis.__ctx; delete globalThis.__whereAnswer; }
    // a phone made again whole with its reading kept, in two turns: a second answer with no "now" is added, not dropped
    const bigRows = n => Array.from({ length: n }, (_, i) => ({ index: i, user: i % 2 === 0, hidden: i <= 3, text: `[#${i}] Ren: ${'word '.repeat(4000)}${i}` }));
    const ans = o => JSON.stringify({ country: 'DE', contacts: [{ name: 'Mara' }], ...o });
    try {
        globalThis.__rows = bigRows(40); globalThis.__ctx = { chat: [], chatMetadata: {}, characters: [{ name: 'Mara' }], characterId: 0 };
        const cur = plainPhone({ now: '10-26 12:00', year: 2026, life: { clock: { alarms: [] } }, sync: { marks: { base: { index: 6 }, life: { index: 30 } }, done: [[7, 39]], hiddenRead: {}, events: { a: { at: 30, summary: 'Ren called Mara' } } } });
        const mm = { text: '## #0–#3 — Arrival\n- Ren came home (#1).\n', phones: { ren: cur }, phoneScreenHolder: 'Mara' };
        globalThis.__where = [];
        globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Frankfurt am Main', tz: 'Europe/Berlin', lives: 'DE' }, { name: 'Mara', city: 'Seoul', tz: 'Asia/Seoul', lives: 'KR' }], year: 2026 };
        globalThis.__menu = { calls: [], answers: [ans({ now: '10-26 03:10', clock: cl('10-26 11:10'), notes: [{ title: 'First', text: 'a', time: '10-25 10:00' }] }), ans({ clock: cl('10-27 11:10'), notes: [{ title: 'Second', text: 'b', time: '10-27 10:00' }] })] };
        const p = await data.makePhone(mm, 'Ren');
        assert.equal(globalThis.__menu.calls.filter(c => c.sys === data.AI_SYS_PHONE).length, 2);
        assert.deepEqual(p.notes.map(x => x.title), ['First', 'Second']);
        assert.equal(p.now, '10-26 03:10');
    } finally { delete globalThis.__ctx; delete globalThis.__whereAnswer; }
});

test('the story\'s year for a phone being made: a status line\'s, else the one the reading of where everyone is tells; none read, no year (never a guess from the dates); one the user set stays through a reading again', async () => {
    const setup = (year, text = '## #0–#3 — Arrival\n- Ren came home on 2026-11-02 (#1). The wedding is set for 2027-05-01.\n') => {
        const { m: mm } = htmlPhoneFixture();
        globalThis.__ctx.characters = [{ name: 'Mara' }]; globalThis.__ctx.characterId = 0;
        mm.phones = {}; mm.phoneScreenHolder = 'Mara'; mm.text = text;
        globalThis.__where = [];
        globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Frankfurt am Main', tz: 'Europe/Berlin', lives: 'DE' }], year };
        return mm;
    };
    try {
        let mm = setup(2026);
        assert.equal((await data.preparePhone(mm, 'Ren')).year, 2026);
        // none read: no year (the dates "2026-11-02", "2027-05-01" say nothing of which is now); the user sets it
        mm = setup(null);
        let pre = await data.preparePhone(mm, 'Ren');
        assert.deepEqual([pre.year, pre.noYear], [undefined, true]);
        // a status line that writes a year: that one, before the reading's
        mm = setup(2019);
        globalThis.__trackers = [{ i: 5, date: '2026-11-02', min: 600, place: 'Frankfurt' }];
        assert.equal((await data.preparePhone(mm, 'Ren')).year, 2026);
        delete globalThis.__trackers;
        // read again (다시 연동): the year with it, unless the user set it
        mm = setup(null);
        pre = await data.preparePhone(mm, 'Ren');
        globalThis.__whereAnswer.year = 2026;
        await data.rereadPlaces(mm, pre);
        assert.equal(pre.year, 2026);
        await data.setPreYear(mm, 'Ren', 2019);
        globalThis.__whereAnswer.year = 2031;
        await data.rereadPlaces(mm, pre);
        assert.equal(pre.year, 2019);
        // the request goes by it
        mm = setup(2026);
        globalThis.__menu = { calls: [], answers: [JSON.stringify({ country: 'DE', now: '11-03 03:10', clock: { basis: 'Default used', finalViewpoint: 'Mara', elapsedTime: null, sceneTime: '11-03 03:10', messageSender: null }, contacts: [], notes: [] })] };
        const p = await data.makePhone(mm, 'Ren');
        assert.match(globalThis.__menu.calls.find(x => x.sys === data.AI_SYS_PHONE).input, /\[STORY YEAR\]\n2026/);
        assert.equal(p.year, 2026);
        assert.equal(p.readYear, undefined);
    } finally { delete globalThis.__ctx; delete globalThis.__whereAnswer; delete globalThis.__trackers; }
});

test('점검 3: making a phone — a status line\'s year on the owner\'s clock across New Year, its time as the owner\'s; an old phone made anew goes by the story, not its old saved time; an owner placed nowhere is checked by no zone; 다시 연동 and a pre for a phone gone since keep what the user set', async () => {
    const setup = (text = '## #0–#3 — Arrival\n- Ren came home (#1).\n') => {
        const { m: mm } = htmlPhoneFixture();
        globalThis.__ctx.characters = [{ name: 'Mara' }]; globalThis.__ctx.characterId = 0;
        mm.phones = {}; mm.phoneScreenHolder = 'Mara'; mm.text = text;
        globalThis.__where = [];
        globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Frankfurt am Main', tz: 'Europe/Berlin', lives: 'DE' }, { name: 'Mara', city: 'Seoul', tz: 'Asia/Seoul', lives: 'KR' }], year: 2026 };
        return mm;
    };
    const made = (now, scene, country = 'DE') => JSON.stringify({ country, now, clock: { basis: 'Default used', finalViewpoint: 'Mara', elapsedTime: null, sceneTime: scene, messageSender: null }, contacts: [{ name: 'Mara' }], notes: [] });
    const input = () => globalThis.__menu.calls.find(x => x.sys === data.AI_SYS_PHONE).input;
    try {
        // New Year's Day in Seoul is still 12-31 in Frankfurt: the old year; the reference time is the owner's
        let mm = setup();
        globalThis.__trackers = [{ i: 5, date: '2027-01-01', min: 30, place: 'Seoul' }, { i: 3, date: '2026-12-31', min: 1300, place: 'Seoul' }];
        globalThis.__menu = { calls: [], answers: [made('12-31 16:30', '01-01 00:30')] };
        let p = await data.makePhone(mm, 'Ren');
        assert.match(input(), /Clock reference time: 12-31 16:30/);
        assert.deepEqual([p.now, p.year], ['12-31 16:30', 2026]);
        delete globalThis.__trackers;
        // an old phone (saved in March) made anew in a July story: no March clock, the hours with every change in the year
        mm = setup('## #0–#3 — Summer\n- Ren came home (#1).\n');
        mm.phones = { ren: plainPhone({ now: '03-20 12:00', year: 2026, where: { at: 1, people: [{ name: 'Ren', city: 'Frankfurt am Main', names: ['Frankfurt am Main'], lives: 'DE', tz: 'Europe/Berlin' }, { name: 'Mara', city: 'Seoul', names: ['Seoul'], lives: 'KR', tz: 'Asia/Seoul' }] } }) };
        globalThis.__menu = { calls: [], answers: [made('07-10 04:10', '07-10 11:10')] };
        p = await data.makePhone(mm, 'Ren');
        assert.doesNotMatch(input(), /Saved phone time: 03-20 12:00/);
        assert.match(input(), /- Mara \(Seoul\): \+[78] hours \(DST: \+7 hours from 03-29/);
        assert.equal(p.now, '07-10 04:10');
        // the reading places only Mara: the request shows no hours, and an answer for an owner in LA is not checked by New York
        mm = setup();
        globalThis.__whereAnswer = { people: [{ name: 'Mara', city: 'Seoul', tz: 'Asia/Seoul', lives: 'KR' }], year: 2026 };
        globalThis.__menu = { calls: [], answers: [made('07-09 19:10', '07-10 11:10', 'US')] };
        p = await data.makePhone(mm, 'Ren');
        assert.equal(p.now, '07-09 19:10');
        // 다시 연동 before making: a city set by hand and the year chosen stay
        mm = setup();
        let pre = await data.preparePhone(mm, 'Ren');
        await data.setPlaceCity(mm, pre, 'Mara', 'Tokyo');
        await data.setPreYear(mm, 'Ren', 2019);
        pre = await data.preparePhone(mm, 'Ren', { again: true });
        assert.equal(globalThis.__where.length, 2);
        assert.deepEqual([pre.where.people.find(x => x.name === 'Mara').city, pre.year], ['Tokyo', 2019]);
        // read for an old phone, changed by the user, the phone gone since: theirs all the same, not read again
        mm = setup();
        mm.phones = { ren: plainPhone({ year: 2019 }) };
        await data.preparePhone(mm, 'Ren');
        await data.setPreYear(mm, 'Ren', 2021);
        delete mm.phones.ren;
        pre = await data.preparePhone(mm, 'Ren');
        assert.equal(globalThis.__where.length, 1);
        assert.equal(pre.year, 2021);
    } finally { delete globalThis.__ctx; delete globalThis.__whereAnswer; delete globalThis.__trackers; }
});

test('점검 4: an owner the reading placed nowhere is checked by no zone (the answer\'s country is where they live; away in Paris they are still right); a pre read for a phone gone since keeps the user\'s change, its year worked out anew', async () => {
    const setup = () => {
        const { m: mm } = htmlPhoneFixture();
        globalThis.__ctx.characters = [{ name: 'Mara' }]; globalThis.__ctx.characterId = 0;
        mm.phones = {}; mm.phoneScreenHolder = 'Mara'; mm.text = '## #0–#3 — Summer\n- 2026-07-10 Ren came home (#1).\n';
        globalThis.__where = [];
        globalThis.__whereAnswer = { people: [{ name: 'Mara', city: 'Seoul', tz: 'Asia/Seoul', lives: 'KR' }], year: 2026 };
        return mm;
    };
    const made = (now, country) => JSON.stringify({ country, now, clock: { basis: 'Default used', finalViewpoint: 'Mara', elapsedTime: null, sceneTime: '07-10 11:10', messageSender: null }, contacts: [{ name: 'Mara' }], notes: [] });
    try {
        let mm = setup();
        // (lives in Korea, in Paris now: Paris's time for Mara's 11:10 in Seoul)
        globalThis.__menu = { calls: [], answers: [made('07-10 04:10', 'KR')] };
        assert.equal((await data.makePhone(mm, 'Ren')).now, '07-10 04:10');
        mm = setup();
        globalThis.__menu = { calls: [], answers: [made('07-09 19:10', 'US')] };
        assert.equal((await data.makePhone(mm, 'Ren')).now, '07-09 19:10');
        // read for an old phone (2019), a city changed by hand, the phone gone since: the change stays, the year is the story's
        mm = setup();
        globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Frankfurt am Main', tz: 'Europe/Berlin', lives: 'DE' }, { name: 'Mara', city: 'Seoul', tz: 'Asia/Seoul', lives: 'KR' }], year: 2026 };
        mm.phones = { ren: plainPhone({ year: 2019 }) };
        let pre = await data.preparePhone(mm, 'Ren');
        await data.setPlaceCity(mm, pre, 'Mara', 'Tokyo');
        delete mm.phones.ren;
        pre = await data.preparePhone(mm, 'Ren');
        assert.deepEqual([pre.where.people.find(x => x.name === 'Mara').city, pre.year], ['Tokyo', 2026]);
        assert.equal(globalThis.__where.length, 1);
    } finally { delete globalThis.__ctx; delete globalThis.__whereAnswer; }
});

test('점검 6 (폰 만들기): read anew after 인물 정보 or 로어북 changed, what the user set stays; 새로 시작 clears it; a status line\'s year at the make goes over one read before; a remake keeping its reading keeps its time; the request has the phone\'s year; 날짜 및 시간 moves a pre\'s year', async () => {
    const setup = () => {
        const { m: mm } = htmlPhoneFixture();
        globalThis.__ctx.characters = [{ name: 'Mara' }]; globalThis.__ctx.characterId = 0;
        mm.phones = {}; mm.phoneScreenHolder = 'Mara'; mm.text = '## #0–#3 — Arrival\n- Ren came home (#1).\n';
        globalThis.__where = [];
        globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Frankfurt am Main', tz: 'Europe/Berlin', lives: 'DE' }, { name: 'Mara', city: 'Seoul', tz: 'Asia/Seoul', lives: 'KR' }], year: 2026 };
        return mm;
    };
    const made = (now, scene) => JSON.stringify({ country: 'DE', now, clock: { basis: 'Default used', finalViewpoint: 'Mara', elapsedTime: null, sceneTime: scene, messageSender: null }, contacts: [{ name: 'Mara' }], notes: [] });
    const input = () => globalThis.__menu.calls.find(x => x.sys === data.AI_SYS_PHONE).input;
    try {
        // a city and the year set, then a 로어북 turned on: read anew, both kept
        let mm = setup();
        let pre = await data.preparePhone(mm, 'Ren');
        await data.setPlaceCity(mm, pre, 'Mara', 'Tokyo');
        await data.setPreYear(mm, 'Ren', 2019);
        mm.phoneLore = ['Book A'];
        pre = await data.preparePhone(mm, 'Ren');
        assert.equal(globalThis.__where.length, 2);
        assert.deepEqual([pre.where.people.find(x => x.name === 'Mara').city, pre.year], ['Tokyo', 2019]);
        // 날짜 및 시간 on another phone: a pre's year set by the user stays; one read moves
        mm = setup();
        mm.phones = { ivo: plainPhone({ owner: 'Ivo', year: 2026 }) };
        pre = await data.preparePhone(mm, 'Ren');
        data.setStoryYear(mm, mm.phones.ivo, 2024);
        assert.equal(data.phonePre(mm, 'Ren').year, 2024);
        // a status line crossing New Year after the reading: its year at the make, the request's too
        mm = setup();
        globalThis.__trackers = [{ i: 5, date: '2026-12-31', min: 1200, place: 'Frankfurt' }];
        await data.preparePhone(mm, 'Ren');
        globalThis.__trackers = [{ i: 6, date: '2027-01-01', min: 540, place: 'Frankfurt' }];
        globalThis.__menu = { calls: [], answers: [made('01-01 09:00', '01-01 17:00')] };
        let p = await data.makePhone(mm, 'Ren');
        assert.match(input(), /\[STORY YEAR\]\n2027/);
        assert.equal(p.year, 2027);
        delete globalThis.__trackers;
        // a phone with 위치 정보 made again whole: its own year in the request
        mm = setup();
        mm.phones = { ren: plainPhone({ year: 2019, where: { at: 1, people: [{ name: 'Ren', city: 'Frankfurt am Main', names: ['Frankfurt am Main'], lives: 'DE', tz: 'Europe/Berlin' }, { name: 'Mara', city: 'Seoul', names: ['Seoul'], lives: 'KR', tz: 'Asia/Seoul' }] } }) };
        globalThis.__menu = { calls: [], answers: [made('11-03 03:10', '11-03 11:10')] };
        p = await data.makePhone(mm, 'Ren');
        assert.match(input(), /\[STORY YEAR\]\n2019/);
    } finally { delete globalThis.__ctx; delete globalThis.__whereAnswer; delete globalThis.__trackers; }
});

test('점검 7 (폰 만들기): 날짜 및 시간 on another phone moves the year the phone is made in; 새로 시작 while the reading waits puts nothing in; a remake whole keeps PEOPLE AROUND and where they live set by hand', async () => {
    const setup = () => {
        const { m: mm } = htmlPhoneFixture();
        globalThis.__ctx.characters = [{ name: 'Mara' }]; globalThis.__ctx.characterId = 0;
        mm.phones = {}; mm.phoneScreenHolder = 'Mara'; mm.text = '## #0–#3 — Arrival\n- Ren came home (#1).\n';
        globalThis.__where = [];
        globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Frankfurt am Main', tz: 'Europe/Berlin', lives: 'DE' }, { name: 'Mara', city: 'Seoul', tz: 'Asia/Seoul', lives: 'KR' }], year: 2026 };
        return mm;
    };
    const made = (now, scene) => JSON.stringify({ country: 'DE', now, clock: { basis: 'Default used', finalViewpoint: 'Mara', elapsedTime: null, sceneTime: scene, messageSender: null }, contacts: [{ name: 'Mara' }], notes: [] });
    const input = () => globalThis.__menu.calls.find(x => x.sys === data.AI_SYS_PHONE).input;
    try {
        // Ivo's phone moved to 2024 while Ren's is being readied: Ren's is made in 2024, its request too
        let mm = setup();
        mm.phones = { ivo: plainPhone({ owner: 'Ivo', year: 2026 }) };
        await data.preparePhone(mm, 'Ren');
        data.setStoryYear(mm, mm.phones.ivo, 2024);
        globalThis.__menu = { calls: [], answers: [made('11-03 03:10', '11-03 11:10')] };
        let p = await data.makePhone(mm, 'Ren');
        assert.match(input(), /\[STORY YEAR\]\n2024/);
        assert.equal(p.year, 2024);
        // 새로 시작 while the reading waits: nothing of the old story put in
        mm = setup();
        const was = globalThis.__whereAnswer;
        let release;
        globalThis.__whereWait = new Promise(r => { release = r; });
        const going = data.preparePhone(mm, 'Ren').catch(e => e);
        await new Promise(r => setTimeout(r, 0));
        mm.phones = {}; delete mm.phonePre; mm.phoneStoryRun = (mm.phoneStoryRun || 0) + 1;
        release(); delete globalThis.__whereWait;
        const end = await going;
        assert.ok(end instanceof Error || !mm.phonePre?.ren, 'the old reading is not kept');
        assert.equal(mm.phonePre?.ren, undefined);
        globalThis.__whereAnswer = was;
        // made again whole: PEOPLE AROUND and where they live set by hand stay when the reading gives none
        mm = setup();
        globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Frankfurt am Main', tz: 'Europe/Berlin', lives: 'DE' }], year: 2026 };
        mm.phones = { ren: plainPhone({ year: 2026, lives: 'FR', livesManual: true, around: { at: 1, people: [{ name: 'Mara', about: 'Ren\'s sister' }] }, where: { at: 1, people: [{ name: 'Ren', city: 'Frankfurt am Main', names: ['Frankfurt am Main'], lives: 'DE', tz: 'Europe/Berlin' }] } }) };
        globalThis.__menu = { calls: [], answers: [made('11-03 03:10', '11-03 11:10')] };
        p = await data.makePhone(mm, 'Ren');
        assert.deepEqual(p.around?.people?.map(x => x.name), ['Mara']);
        assert.equal(p.livesManual, true);
    } finally { delete globalThis.__ctx; delete globalThis.__whereAnswer; delete globalThis.__whereWait; }
});

test('다시 만들기 › 지도: the visits are written again from the story, the other apps stay', async () => {
    globalThis.__rows = bigRows(4);
    const p = { ...phoneOf(), notes: [{ title: 'Keep me', text: 'x', time: '10-24 09:00' }], visits: [{ place: 'Old cafe', city: 'Varo', time: '10-20 10:00' }] }, mm = { ...m, phones: { ren: p } };
    globalThis.__menu = { calls: [], answers: [JSON.stringify({ visits: [{ place: 'Harbour office', city: 'Varo', time: '10-25 09:00' }, { place: 'Central station', city: 'Varo', time: '10-25 12:00' }], notes: [{ title: 'Not asked', text: 'y', time: '10-25 10:00' }] })], answer: '{}' };
    await data.makePhone(mm, 'Ren', { apps: ['map'] });
    const turn = globalThis.__menu.calls.find(c => c.sys === data.AI_SYS_PHONE_APPS);
    assert.match(turn.input, /\[ONLY THESE\][^\n]*\n[^\n]*: visits\./);
    assert.deepEqual(p.visits.map(x => x.place), ['Harbour office', 'Central station']);
    assert.deepEqual(p.notes.map(x => x.title), ['Keep me']);
});
