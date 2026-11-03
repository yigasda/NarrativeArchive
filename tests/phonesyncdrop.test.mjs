// 빼기 with sources: a whole reflection round against a fake chat and a fake model answer
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { migrateBank, cash } from '../src/finance.js';
import { makeMark, newSync } from '../src/phonesync.js';

const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const href = f => pathToFileURL(new URL(`../src/${f}`, import.meta.url).pathname).href;
const T = (globalThis.__dropTest = { chat: [], answers: [] });
const map = {
    './phonesync.js': href('phonesync.js'), './phoneparse.js': href('phoneparse.js'), './phonesynclife.js': href('phonesynclife.js'), './phonesyncmoney.js': href('phonesyncmoney.js'), './finance.js': href('finance.js'),
    './phoneprofile.js': href('phoneprofile.js'),
    './phonestory.js': encoded(`export const phoneChatScope=()=>globalThis.__dropTest.scope||'test';`),
    './wealth.js': encoded(`export const ensureWealth=async()=>null;export const wealthBlock=()=>'';export const wealthDate=()=> '2026-10-26';export const wealthCheck=()=>null;export const addWealthFX=()=>{};`),
    './ai.js': encoded(`export const askDraft=async(input,o)=>{globalThis.__dropTest.sys=o.system;globalThis.__dropTest.input=input;return JSON.stringify(globalThis.__dropTest.answers.shift());};`),
    './core.js': encoded(`export const ctx=()=>({chat:globalThis.__dropTest.chat,chatMetadata:globalThis.__dropTest.meta,loadWorldInfo:async()=>null,characters:[]});export const globalSettings=()=>({});export const saveMeta=async()=>{};`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=()=>[];export const chatRows=()=>globalThis.__dropTest.chat.map((x,i)=>({index:i,user:x.is_user,hidden:!!x.is_system,text:'[#'+i+'] '+x.name+': '+x.mes}));`),
    './inject.js': encoded(`export const applyInjection=()=>{};`),
    './knowledge.js': encoded(`export const knowledgeRows=()=>[];`),
    './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=()=>[];`),
    './sections.js': encoded(`export const parseSections=()=>[];export const RANGE_HEAD=/#(\\d+)–#(\\d+)/;export const sectionKey=()=>'';export const splitTail=s=>[s,''];`),
    './translate.js': encoded(`export const glossaryEntries=()=>[];`), './world.js': encoded(`export const worldText=()=>'';`),
};
const src = await readFile(new URL('../src/phonedata.js', import.meta.url), 'utf8');
const data = await import(encoded(src.replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || k}'`)));
// localStorage for the 복구 journal
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };

const say = (who, mes) => ({ is_user: who === 'Ren', is_system: false, name: who, mes });
function setup(chat) {
    T.chat = chat; T.answers = []; T.scope = 'test'; T.meta = { integrity: 'main-mark' };
    const p = { owner: 'Ren', now: '10-26 09:00', contacts: [], threads: [], calls: [], photos: [], notes: [], searches: [], events: [], posts: [], mails: [], diary: [], voice: [],
        money: { currency: 'KRW', asOf: '2026-10-20', bank: { accounts: [{ id: 'chk', kind: 'checking', name: '입출금', last4: '1111', currency: 'KRW', balance: 100000 }] }, tx: [], orders: [], passes: [] } };
    const m = { text: '', phones: { ren: p } };
    migrateBank(m, p);
    p.sync = newSync('test');
    p.sync.marks.base = makeMark(chat, 1);
    return { m, p, bank: () => cash(m.finance.accounts['chk:KRW']) };
}
const run = (m, answer) => { T.answers.push(answer); return data.makePhone(m, 'Ren', { update: true }); };
const texts = p => (p.threads.find(t => t.with === 'Mara')?.messages || []).map(x => x.text);
const msg = (text, time) => ({ from: 'Mara', text, time });
const book = (at, quote, messages, occurrence) => ({ id: 'book', at, quote, summary: '책을 샀다', date: '10-26', time: '12:00',
    phone: { threads: [{ with: 'Mara', messages }] }, money: { moves: [{ account: '1111', amount: -15000, who: '서점', occurrence }] } });

// the book example: #3–4 written again as #3–5; the old talk gave texts A and B, the new one B and C
async function bookCase() {
    const chat = [say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'going to the bookstore now'),
        say('Mara', 'I bought the book for 15000 won'), say('Ren', 'see you tomorrow at the cafe'), say('Mara', 'okay, bye for now')];
    const c = setup(chat);
    await run(c.m, { now: '10-26 13:00', events: [
        book(3, 'bought the book', [msg('A: 책 샀어?', '10-26 12:01'), msg('B: 응 샀어', '10-26 12:02')], 'new'),
        { id: 'cafe', at: 4, quote: 'see you tomorrow', summary: '내일 카페', date: '10-26', time: '12:30', phone: { threads: [{ with: 'Mara', messages: [msg('E: 내일 카페에서 봐', '10-26 12:30')] }] } },
    ] });
    return c;
}
async function rewrite(c) {
    T.chat.splice(3, 2, say('Mara', 'got the book, it was 15000 won'), say('Ren', 'how many pages is it'), say('Mara', 'three hundred pages'));
    await run(c.m, { now: '10-26 14:00', events: [
        book(3, 'got the book', [msg('B: 응 샀어', '10-26 12:02'), msg('C: 300쪽이야', '10-26 12:05')], 'again'),
    ] });
}

test('빼기 takes only what the gone talk alone gave: A goes, B (in the new talk too) and C stay, the book is paid once', async () => {
    const c = await bookCase();
    assert.deepEqual(texts(c.p), ['A: 책 샀어?', 'B: 응 샀어', 'E: 내일 카페에서 봐']);
    assert.equal(c.bank(), 85000);
    await rewrite(c);
    assert.equal(c.bank(), 85000);
    const d = c.p.sync.dropped;
    assert.equal(d.length, 1);
    assert.deepEqual(d[0].events, ['cafe']);
    assert.equal(d[0].left, 2);
    const r = await data.dropStretch(c.m, c.p, 0);
    assert.deepEqual(texts(c.p), ['B: 응 샀어', 'C: 300쪽이야']);
    assert.equal(r.items, 2);
    assert.equal(c.bank(), 85000);
    assert.equal(c.p.money.tx.length, 1);
    assert.equal(c.p.sync.dropped.length, 0);
});

test('빼기 leaves an item the user changed on the phone, and a record another event still uses', async () => {
    const c = await bookCase();
    c.p.threads[0].messages.find(x => x.text.startsWith('E:')).text = 'E: 내일 카페에서 꼭 봐';
    await rewrite(c);
    await data.dropStretch(c.m, c.p, 0);
    assert.deepEqual(texts(c.p), ['B: 응 샀어', 'C: 300쪽이야', 'E: 내일 카페에서 꼭 봐']);
    // the book's payment belongs to the event the new talk took up again
    assert.equal(c.p.money.tx.length, 1);
    assert.equal(c.p.sync.events.book.at, 3);
});

test('a new message given an old number is not the old source', async () => {
    const c = await bookCase();
    await rewrite(c);
    const all = c.p.threads[0].messages, of = t => all.find(x => x.text.startsWith(t)).froms;
    // A came from the old #3: that number now belongs to new words, so A's source has no number
    assert.deepEqual(of('A').map(f => f.at), [null]);
    assert.equal(of('A')[0].was, 3);
    assert.deepEqual(of('C').map(f => f.at), [3]);
    assert.notEqual(of('A')[0].fp, of('C')[0].fp);
    assert.deepEqual(of('B').map(f => f.at).sort(), [3, null].sort());
});

test('two messages with the same words: the gone one is told apart by its place, and only its own item goes', async () => {
    const same = 'I will call you later tonight, okay';
    const chat = [say('Ren', 'start'), say('Mara', 'hi'), say('Mara', same), say('Ren', 'sure, talk then'), say('Mara', same), say('Ren', 'again? fine by me'), say('Mara', 'see you soon then')];
    const c = setup(chat);
    const call = (at, time) => ({ id: `call-${at}`, at, quote: 'call you later', summary: '통화 약속', date: '10-26', time,
        phone: { calls: [{ with: 'Mara', type: 'in', time: `10-26 ${time}`, min: 3 }], threads: [{ with: 'Mara', messages: [msg('같은 말', '10-26 20:00')] }] } });
    await run(c.m, { now: '10-26 22:00', events: [call(2, '20:10'), call(4, '21:10')] });
    assert.equal(c.p.calls.length, 2);
    assert.deepEqual(texts(c.p), ['같은 말']);
    // nothing new to read: the round only notices what is gone
    T.chat.splice(4, 1);
    await data.makePhone(c.m, 'Ren', { update: true });
    assert.equal(c.p.sync.dropped.length, 1);
    assert.deepEqual(c.p.sync.dropped[0].events, ['call-4']);
    await data.dropStretch(c.m, c.p, 0);
    assert.deepEqual(c.p.calls.map(x => x.time), ['10-26 20:10']);
    // the text both messages gave still has the one left
    assert.deepEqual(texts(c.p), ['같은 말']);
});

test('되돌리기 takes the round off as a source of what was already there', async () => {
    const c = await bookCase();
    T.chat.push(say('Ren', 'did you buy it? 책 샀어?'));
    await run(c.m, { now: '10-26 15:00', events: [{ id: 'ask', at: 6, quote: 'did you buy it', summary: '다시 물음', date: '10-26', time: '15:00', phone: { threads: [{ with: 'Mara', messages: [msg('A: 책 샀어?', '10-26 12:01')] }] } }] });
    const a = () => c.p.threads[0].messages.find(x => x.text.startsWith('A')).froms.map(f => f.at);
    assert.deepEqual(a(), [3, 6]);
    await data.undoRound(c.m, c.p);
    assert.deepEqual(a(), [3]);
});

test('a branch: talk cut off past the branch point is gone, even where a new message took its place; the main chat keeps all', async () => {
    const c = await bookCase();
    const main = structuredClone(c.m), mainChat = structuredClone(T.chat);
    // a branch from #2 (SillyTavern gives it a new mark and names the main chat): the book talk (#3) is written over by
    // other words, #4 happens to be said again the same way
    T.scope = 'branch'; T.meta = { integrity: 'branch-mark', main_chat: 'main' };
    T.chat.splice(3, 3, say('Mara', 'something else entirely happened'), say('Ren', 'see you tomorrow at the cafe'), say('Mara', 'a new last line'));
    await run(c.m, { now: '10-26 15:00', events: [] });
    const d = c.p.sync.dropped;
    assert.equal(d.length, 1);
    assert.equal(d[0].label, '#3');
    assert.deepEqual(d[0].events, ['book']);
    // B changed by hand stays; A goes, and so does the book's payment
    c.p.threads[0].messages.find(x => x.text.startsWith('B')).text = 'B: 응 샀어 (고침)';
    await data.dropStretch(c.m, c.p, 0);
    assert.deepEqual(texts(c.p), ['B: 응 샀어 (고침)', 'E: 내일 카페에서 봐']);
    assert.equal(c.bank(), 100000);
    // reading on in the branch, an edit there is an edit again
    T.chat[5].mes = 'a new last line, edited';
    await run(c.m, { now: '10-26 16:00', events: [] });
    assert.equal(c.p.sync.dropped.length, 0);
    // the main chat has its own copy: back there nothing is gone
    T.scope = 'test'; T.meta = { integrity: 'main-mark' }; T.chat = mainChat; c.m = main;
    await run(c.m, { now: '10-26 15:00', events: [] });
    assert.deepEqual(texts(main.phones.ren), ['A: 책 샀어?', 'B: 응 샀어', 'E: 내일 카페에서 봐']);
    assert.equal(main.phones.ren.sync.dropped?.length || 0, 0);
});

test('in the same chat, a message written over in its place is still an edit, read again', async () => {
    const c = await bookCase();
    T.chat[3] = say('Mara', 'something else entirely happened');
    await run(c.m, { now: '10-26 15:00', events: [] });
    assert.equal(c.p.sync.dropped?.length || 0, 0);
    assert.ok(c.p.syncLast.notes.some(n => /읽은 대화가 바뀌어서|바뀐 대화 1개/.test(n)));
});

test('a chat renamed or a backup imported keeps its mark: an edit made right after is still an edit, nothing is offered to take off', async () => {
    for (const meta of [{ integrity: 'main-mark' }, { integrity: 'main-mark', main_chat: 'older main' }]) {
        const c = await bookCase();
        T.scope = 'renamed or imported'; T.meta = meta;
        T.chat[3] = say('Mara', 'something else entirely happened');
        await run(c.m, { now: '10-26 15:00', events: [] });
        assert.equal(c.p.sync.dropped?.length || 0, 0);
    }
});

test('an older phone without a mark yet takes the chat it is in as its own: no guess that it is a branch', async () => {
    const c = await bookCase();
    delete c.p.sync.readChat;
    T.meta = { integrity: 'branch-mark', main_chat: 'main' };
    T.chat[3] = say('Mara', 'something else entirely happened');
    await run(c.m, { now: '10-26 15:00', events: [] });
    assert.equal(c.p.sync.dropped?.length || 0, 0);
});

// 3.140 phones: no mark, only the scope of the chat last read
const scopeOf = name => `narrativearchive:phone-owner:${JSON.stringify(['character', 'a.png', name])}`;
test('after the update, a phone that came into a branch from its main chat: the cut-off talk is told on the first round', async () => {
    const c = await bookCase();
    delete c.p.sync.readChat; c.p.sync.scope = scopeOf('Main');
    T.scope = scopeOf('Main - Branch #1'); T.meta = { integrity: 'branch-mark', main_chat: 'Main' };
    T.chat.splice(3, 3, say('Mara', 'something else entirely happened'), say('Ren', 'see you tomorrow at the cafe'), say('Mara', 'a new last line'));
    await run(c.m, { now: '10-26 15:00', events: [] });
    assert.deepEqual(c.p.sync.dropped.map(d => d.label), ['#3']);
    assert.equal(c.p.sync.readChat, 'branch-mark');
});

test('after the update, a phone already read in its branch, a renamed chat, or a backup: its own chat, edits stay edits', async () => {
    const cases = [
        [scopeOf('Main - Branch #1'), scopeOf('Main - Branch #1'), { integrity: 'branch-mark', main_chat: 'Main' }],
        [scopeOf('Old name'), scopeOf('New name'), { integrity: 'main-mark' }],
        [scopeOf('Main - Branch #1'), scopeOf('Main - Branch #1 renamed'), { integrity: 'branch-mark', main_chat: 'Main' }],
        [scopeOf('Main'), scopeOf('Main imported'), { integrity: 'main-mark' }],
    ];
    for (const [was, now, meta] of cases) {
        const c = await bookCase();
        delete c.p.sync.readChat; c.p.sync.scope = was;
        T.scope = now; T.meta = meta;
        T.chat[3] = say('Mara', 'something else entirely happened');
        await run(c.m, { now: '10-26 15:00', events: [] });
        assert.equal(c.p.sync.dropped?.length || 0, 0, now);
    }
});

test('a phone without the everyday or delivery apps gets the same request as before', async () => {
    const c = await bookCase();
    assert.equal(T.sys, data.AI_SYS_PHONE_UPDATE);
    assert.ok(!T.sys.includes('LIFE') && !T.sys.includes('deliveries'));
});

// the everyday apps and the delivery app, through a whole reflection: in, 되돌리기, and 빼기
function lifeSetup() {
    const chat = [say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'I set an alarm for the airport'),
        say('Mara', 'we ordered pasta from Pasta Nostra for 24.80'), say('Ren', 'it was good'), say('Mara', 'good night then')];
    const c = setup(chat);
    c.p.life = { at: '10-26 09:00', clock: { alarms: [{ id: 'a1', time: '06:10', label: 'Aufstehen', days: ['mon'], date: '', on: true }], timers: [], running: null },
        health: { usual: {}, days: [] }, files: { folders: [], items: [] },
        weather: { here: { place: 'Varo', date: '10-26', time: '09:00', cond: 'clear', temp: 12, hours: [], days: [], tiles: {} }, cities: [] } };
    c.p.delivery = { shops: [], orders: [], cart: null };
    Object.assign(c.p.sync.marks, { life: { index: 1 }, delivery: { index: 1 }, money: { index: 1 } });
    return c;
}
const lifeAnswer = () => ({ now: '10-26 22:00', days: [{ date: '10-26', sleep: '23:40', wake: '06:20', steps: 9100 }],
    weather: { place: 'Varo', date: '10-26', time: '21:00', cond: 'rain', temp: 9, from: 'chat' },
    events: [
        { id: 'airport-alarm', at: 2, quote: 'set an alarm', summary: '공항 알람', date: '10-26', time: '20:00', phone: { alarms: [{ time: '04:30', label: 'Flughafen', date: '10-30', on: true }] } },
        { id: 'pasta', at: 3, quote: 'ordered pasta', summary: '파스타 배달', date: '10-26', time: '20:14', phone: {},
            money: { moves: [{ account: '1111', amount: -24.8, who: 'Pasta Nostra', kind: 'card', occurrence: 'new' }],
                deliveries: [{ shop: 'Pasta Nostra', items: [{ name: 'Tagliatelle', qty: 1, price: 13.9 }, { name: 'Penne', qty: 1, price: 11.5 }], fee: 1.99, discount: 2.59, status: 'delivered', occurrence: 'new' }] } },
    ] });

test('the everyday and delivery apps through a reflection: asked for, put in, and taken back by 되돌리기', async () => {
    const c = lifeSetup();
    await run(c.m, lifeAnswer());
    assert.ok(T.sys.includes('LIFE\n') && T.sys.includes('"deliveries"') && T.sys.includes('"weather"'));
    assert.ok(T.input.includes('[LIFE NOW]'));
    const L = c.p.life;
    assert.deepEqual(L.clock.alarms.map(a => a.label), ['Aufstehen', 'Flughafen']);
    assert.equal(L.health.days.length, 1);
    assert.equal(L.weather.here.cond, 'rain');
    const o = c.p.delivery.orders[0], t = c.p.money.tx.at(-1);
    assert.equal(t.delivery, o.id);
    assert.equal(c.bank(), 100000 - 24.8);
    assert.ok(c.p.syncLast.apps.includes('시계') && c.p.syncLast.apps.includes('배달') && c.p.syncLast.apps.includes('건강') && c.p.syncLast.apps.includes('날씨'));
    await data.undoRound(c.m, c.p);
    assert.deepEqual(L.clock.alarms.map(a => a.label), ['Aufstehen']);
    assert.equal(L.health.days.length, 0);
    assert.equal(L.weather.here.cond, 'clear');
    assert.equal(c.p.delivery.orders.length, 0);
    assert.equal(c.bank(), 100000);
});

test('the talk with the order deleted: 빼기 takes the order, its payment and the alarm from the same talk', async () => {
    const c = lifeSetup();
    await run(c.m, lifeAnswer());
    T.chat.splice(2, 2, say('Ren', 'nothing happened today at all'), say('Mara', 'nothing at all, really'), say('Ren', 'quiet evening'));
    await run(c.m, { now: '10-26 22:30', events: [] });
    assert.deepEqual(c.p.sync.dropped.map(d => d.label), ['#2–3']);
    await data.dropStretch(c.m, c.p, 0);
    assert.deepEqual(c.p.life.clock.alarms.map(a => a.label), ['Aufstehen']);
    assert.equal(c.p.delivery.orders.length, 0);
    assert.equal(c.bank(), 100000);
    // what nobody told stays: the day and the weather are the round's, not the talk's
    assert.equal(c.p.life.health.days.length, 1);
});

test('the request names the days ahead with their weekdays, so "on Friday" has a date', async () => {
    const c = await bookCase();
    assert.match(T.input, /\[DAYS\]\n10-26 Mon\n10-27 Tue\n10-28 Wed\n10-29 Thu\n10-30 Fri/);
});

test('a phone made with everyday records: they stay apart from the story (not sent back, not in the role-play)', () => {
    const got = data.parsePhone(JSON.stringify({ notes: [{ title: 'Einkaufsliste', text: 'Milch, Brot', everyday: true }, { title: 'Flug', text: 'BER 07:00' }], searches: [{ q: 'Rezept Linsensuppe', everyday: true }] }));
    assert.equal(got.notes[0].src, 'guess');
    assert.equal(got.notes[1].src, undefined);
    assert.equal(got.searches[0].src, 'guess');
});

test('a model\'s JSON with a slip is mended: a bracket of the wrong kind, a trailing comma, a missing end', async () => {
    const { mendJson, jsonOf } = await import('../src/phoneparse.js');
    const bad = '{ "profile": { "handle": "mara", "followers": 142 ], "posts": [ { "text": "a ] b }" }, ], "x": 1 }';
    assert.deepEqual(JSON.parse(mendJson(bad)), { profile: { handle: 'mara', followers: 142 }, posts: [{ text: 'a ] b }' }], x: 1 });
    assert.deepEqual(jsonOf('```json\n{ "a": [1, 2 }\n```'), { a: [1, 2] });
    assert.deepEqual(JSON.parse(mendJson('{ "a": { "b": "c"')), { a: { b: 'c' } });
    assert.equal(jsonOf('no json here'), null);
});

test('the story\'s year comes only from a date, never from a bare number', async () => {
    const { yearIn } = await import('../src/phoneparse.js');
    for (const t of ['2050원짜리 커피', '2019년에 헤어졌다', '제국력 1247년', '2026년 겨울', '10-26 2026', 'price 2000-01']) assert.equal(yearIn(t), '', t);
    for (const [t, y] of [['## #0–#3 (2026-11-07)', '2026'], ['2026년 11월 7일', '2026'], ['Nov 7, 2026', '2026'], ['7. November 2026', '2026'], ['2026.11.07', '2026'], ['2025-12-31 … 2026-01-02', '2026']]) assert.equal(yearIn(t), y, t);
});

test('a new story year moves every dated record with it, in every phone of the chat', () => {
    const m = { finance: { accounts: { 'chk:EUR': { amount: 100, asOf: '2026-10-20', entries: { a: { amount: -5, date: '2026-12-31' }, b: { amount: -6, date: '2027-01-01' } } } }, prices: { 'FX:EUR/KRW': { '2026-10-20': { rows: [] } } } },
        phones: { ren: { owner: 'Ren', year: 2027, money: { asOf: '2026-10-20', tx: [{ time: '12-31 20:00' }] }, investment: { date: '2027-01-01', trades: [{ date: '2024-02-29' }] }, syncUndo: { year: 2027, effects: [{ type: 'push', path: 'investment.trades', item: { id: 't1', date: '2027-01-01' } }] }, sync: { events: { e1: { effects: [{ type: 'push', item: { date: '2026-12-31' } }] } } } }, mara: { owner: 'Mara', year: 2027 }, ivo: { owner: 'Ivo', noYear: true } } };
    const n = data.setStoryYear(m, m.phones.ren, 2026);
    assert.equal(n, -1);
    assert.deepEqual(Object.values(m.finance.accounts['chk:EUR'].entries).map(e => e.date), ['2025-12-31', '2026-01-01']);
    assert.equal(m.finance.accounts['chk:EUR'].asOf, '2025-10-20');
    assert.deepEqual(Object.keys(m.finance.prices['FX:EUR/KRW']), ['2025-10-20']);
    assert.equal(m.phones.ren.money.asOf, '2025-10-20');
    assert.equal(m.phones.ren.money.tx[0].time, '12-31 20:00');
    assert.equal(m.phones.ren.investment.trades[0].date, '2023-02-28');
    assert.deepEqual([m.phones.ren.year, m.phones.mara.year, m.phones.ivo.year, m.phones.ivo.noYear], [2026, 2026, undefined, true]);
    // 되돌리기 and 빼기 compare against copies that moved too, and undo goes back to the moved year
    assert.deepEqual([m.phones.ren.syncUndo.year, m.phones.ren.syncUndo.effects[0].item.date, m.phones.ren.sync.events.e1.effects[0].item.date], [2026, '2026-01-01', '2025-12-31']);
    // a phone with no year yet just takes it: nothing to move
    const q = { phones: { a: { owner: 'A', noYear: true, money: { asOf: '2026-01-01' } } } };
    assert.equal(data.setStoryYear(q, q.phones.a, 2030), 0);
    assert.deepEqual([q.phones.a.year, q.phones.a.noYear, q.phones.a.money.asOf], [2030, false, '2026-01-01']);
});

test('story days sort and count across New Year, not as text', async () => {
    const { byStory, gapDays, storyMin } = await import('../src/phoneparse.js');
    assert.equal(gapDays('12-31', '01-01'), 1);
    assert.equal(gapDays('01-02', '12-30'), -3);
    const rows = [{ time: '01-02 09:00' }, { time: '12-30 22:00' }, { time: '12-31 08:00' }, { time: '01-01 00:10' }];
    assert.deepEqual([...rows].sort(byStory('01-02 12:00')).map(r => r.time), ['12-30 22:00', '12-31 08:00', '01-01 00:10', '01-02 09:00']);
    // an order due tomorrow stays ahead; something from March is last year's when now is February
    assert.ok(storyMin('01-03 10:00', '01-02 12:00') > storyMin('01-02 09:00', '01-02 12:00'));
    assert.ok(storyMin('03-10 10:00', '02-01 12:00') < storyMin('01-20 10:00', '02-01 12:00'));
    assert.deepEqual([{ opened: '01-01 10:00' }, { opened: '12-31 10:00' }].sort(byStory('01-01 12:00', f => f.opened)).map(f => f.opened), ['12-31 10:00', '01-01 10:00']);
});

test('a gift field the model fills with false or "no" is no gift', async () => {
    const { giftOf } = await import('../src/phoneparse.js');
    for (const v of [false, 'false', 'no', 'None', '', null, undefined, '없음', 'true']) assert.equal(giftOf(v), '', String(v));
    assert.equal(giftOf(true), '선물');
    assert.equal(giftOf('Ren'), 'Ren');
});

test('run27: a quote with one word slipped in still counts; a file kind written as its extension; a Korean text gets no copy as ko', async () => {
    const { quoted } = await import('../src/phonesync.js');
    const t = 'Mara는 축하한다고 답하며 계약 연장 서류를 받은 이야기를 했다.';
    assert.equal(quoted('집주인에게서 계약 연장 서류를 받은 이야기를 했다', t), true);
    assert.equal(quoted('전혀 다른 문장으로 적어 둔 말', t), false);
    assert.equal(quoted('이야기를 받은 서류를 연장 계약 했다', t), false, 'words out of order are not the quote');
    const { fileOf } = await import('../src/phonesynclife.js');
    assert.deepEqual(['png', '', 'xyz'].map((k, i) => fileOf({ name: ['shot.png', 'clip.MOV', 'notes'][i], kind: k }).kind), ['image', 'video', 'other']);
    const ph = data.parsePhone(JSON.stringify({ notes: [{ title: '월요일 7시', text: '월요일 7시 한강', ko: '월요일 7시 한강', time: '01-30 21:35' }], threads: [{ with: 'Ren', messages: [{ from: 'me', text: 'Hi', ko: '안녕', time: '01-30 22:00' }] }] }));
    assert.equal(ph.notes[0].ko, '');
    assert.equal(ph.threads[0].messages[0].ko, '안녕');
});

test('an answer giving two new events one id pays both; an event with no date takes the day before it; "#4" is message 4', async () => {
    const chat = [say('Ren', 'start'), say('Mara', 'morning'), say('Mara', 'coffee at the kiosk'), say('Ren', 'and another coffee later'), say('Mara', 'paid the taxi')];
    const c = setup(chat);
    await run(c.m, { now: '10-26 18:00', events: [
        { id: 'coffee', at: 2, quote: 'coffee at the kiosk', date: '10-26', time: '09:00', summary: 'coffee', money: { moves: [{ account: '1111', amount: -5000, who: 'Kiosk', occurrence: 'new' }] } },
        { id: 'coffee', at: 3, quote: 'another coffee later', date: '10-26', time: '15:00', summary: 'coffee', money: { moves: [{ account: '1111', amount: -5000, who: 'Cafe', occurrence: 'new' }] } },
        { id: 'taxi', at: '#4', quote: 'paid the taxi', summary: 'taxi', money: { moves: [{ account: '1111', amount: -12000, who: 'Taxi', occurrence: 'new' }] } },
    ] });
    assert.deepEqual(c.p.money.tx.map(t => [t.who, t.amount, t.time.slice(0, 5)]), [['Kiosk', -5000, '10-26'], ['Cafe', -5000, '10-26'], ['Taxi', -12000, '10-26']]);
    assert.equal(c.bank(), 100000 - 22000);
});

test('making a phone: the owner by name is "me", a country by name, counts like "1.2k", flags written as words', () => {
    const ph = data.parsePhone(JSON.stringify({ country: 'Germany', profile: { handle: 'ren', followers: '1.2k', following: '3.4만' },
        threads: [{ with: 'Mara', messages: [{ from: 'Ren', text: 'hi', time: '10-26 10:00' }, { from: 'Mara', text: 'yo', time: '10-26 10:01' }] }, { with: 'Ren', messages: [{ from: 'Ren', text: 'note to self', time: '10-26 11:00' }] }],
        calls: [{ with: 'Mara', type: 'in', time: '10-26 12:00', min: '4분' }], mails: [{ from: 'LH', subject: 'x', time: '10-26 09:00', unread: 'false' }],
        searches: [{ q: 'snow', time: '10-26 08:00', tab: 'false', mark: 'true' }], posts: [{ text: 'snow', time: '10-26 08:30', likes: '2.5k' }] }), 'Ren');
    assert.equal(ph.country, 'DE');
    assert.deepEqual([ph.profile.followers, ph.profile.following], [1200, 34000]);
    assert.deepEqual(ph.threads.map(t => t.with), ['Mara']);
    assert.deepEqual(ph.threads[0].messages.map(x => x.from), ['me', 'Mara']);
    assert.equal(ph.calls[0].min, 4);
    assert.equal(ph.mails[0].unread, false);
    assert.deepEqual([ph.searches[0].tab, ph.searches[0].mark], [undefined, true]);
    assert.equal(ph.posts[0].likes, 2500);
});

test('dates with a month name: only a real month ("Mar 3", "Sept 5", "5. Mai"), never a name that starts like one ("Mara 3"); a year after the day keeps the clock', async () => {
    const { when } = await import('../src/phoneparse.js');
    assert.equal(when('Mara 3'), '');
    assert.equal(when('Flight 12'), '');
    assert.equal(when('Mar 3 15:00'), '03-03 15:00');
    assert.equal(when('Sept 5'), '09-05');
    assert.equal(when('5. Mai 2027 09:30'), '05-05 09:30');
    assert.equal(when('25.10.2026 21:00'), '10-25 21:00');
    assert.equal(when('10/25/2026 9:05'), '10-25 09:05');
    assert.equal(when('2026-10-25 21:00'), '10-25 21:00');
});
test('a memo length written in minutes ("1분 20초", "2 min", "1m30s") is read as seconds', async () => {
    const { secOf } = data;
    assert.equal(secOf('1:20'), 80);
    assert.equal(secOf('1분 20초'), 80);
    assert.equal(secOf('2 min'), 120);
    assert.equal(secOf('1m30s'), 90);
    assert.equal(secOf('45s'), 45);
    assert.equal(secOf(90), 90);
});

test('an event told again from a later message (its order delivered) stays where it happened: deleting that message offers all it gave', async () => {
    const chat = [say('Ren', 'start'), say('Mara', 'morning'), say('Ren', 'ok'), say('Mara', 'I ordered a lamp for 30000 won'), say('Ren', 'nice'), say('Mara', 'the lamp arrived today')];
    const c = setup(chat); c.p.sync.limit = 2;
    const order = (status, occurrence) => ({ shop: '램프샵', item: 'Lamp', price: 30000, qty: 1, status, occurrence });
    await run(c.m, { now: '10-26 10:00', events: [{ id: 'lamp', at: 3, quote: 'ordered a lamp', summary: '램프 주문', date: '10-26', time: '09:00', phone: {}, money: { moves: [{ account: '1111', amount: -30000, who: '램프샵', occurrence: 'new' }], orders: [order('ordered', 'new')] } }] });
    await run(c.m, { now: '10-27 10:00', events: [{ id: 'lamp', at: 5, quote: 'lamp arrived', summary: '램프 도착', date: '10-27', time: '09:00', phone: {}, money: { orders: [order('delivered', 'again')] } }] });
    assert.equal(c.p.sync.events.lamp.at, 3);
    assert.equal(c.p.money.orders[0].status, 'delivered');
    T.chat.splice(3, 1);
    await run(c.m, { now: '10-27 10:00', events: [] });
    assert.equal(c.p.sync.dropped.length, 1);
    const r = await data.dropStretch(c.m, c.p, c.p.sync.dropped[0].key);
    assert.equal(r.gone, 1);
    assert.equal(c.p.money.orders.length, 0);
    assert.equal(c.p.money.tx.length, 0);
    assert.equal(c.bank(), 100000);
});

test('the whole phone made again with its bank kept: a message the bank had not read yet is still read on the next round', async () => {
    const chat = [say('Ren', 'start'), say('Mara', 'morning'), say('Ren', 'ok'), say('Mara', 'coffee 4500 on the card'), say('Ren', 'and'), say('Mara', 'bread 3000 on the card')];
    const c = setup(chat); c.p.sync.limit = 2; c.p.sync.marks.money = { ...c.p.sync.marks.base };
    await run(c.m, { now: '10-26 10:00', events: [{ id: 'coffee', at: 3, quote: 'coffee 4500', summary: '커피', date: '10-26', time: '09:00', phone: {}, money: { moves: [{ account: '1111', amount: -4500, who: '카페', occurrence: 'new' }] } }] });
    T.answers.push({ country: 'KR', now: '10-26 10:00', threads: [], calls: [], photos: [], notes: [], events: [], posts: [], mails: [], diary: [] });
    const q = await data.makePhone(c.m, 'Ren');
    assert.equal(q.money.tx.length, 1);
    await run(c.m, { now: '10-26 11:00', events: [{ id: 'bread', at: 5, quote: 'bread 3000', summary: '빵', date: '10-26', time: '10:30', phone: {}, money: { moves: [{ account: '1111', amount: -3000, who: '빵집', occurrence: 'new' }] } }] });
    assert.equal(q.money.tx.length, 2);
    assert.equal(c.bank(), 92500);
});

test('복구 brings back the story clock the lost round had moved on, with its year across New Year', async () => {
    const chat = [say('Ren', 'start'), say('Mara', 'morning'), say('Ren', 'ok'), say('Mara', 'coffee 4500 on the card')];
    const { journalWrite } = await import('../src/phonesync.js'); journalWrite('test', []);
    const c = setup(chat); c.p.now = '12-31 20:00'; c.p.year = 2026;
    const was = structuredClone(c.p);
    await run(c.m, { now: '01-01 10:00', events: [{ id: 'coffee', at: 3, quote: 'coffee 4500', summary: '커피', date: '01-01', time: '09:00', phone: {}, money: { moves: [{ account: '1111', amount: -4500, who: '카페', occurrence: 'new' }] } }] });
    assert.equal(c.p.now, '01-01 10:00'); assert.equal(c.p.year, 2027);
    c.m.phones.ren = was; c.m.finance = structuredClone(c.m.finance);
    const perf = globalThis.performance; globalThis.performance = { timeOrigin: Date.now() + 1e6 };
    try { assert.equal(await data.restoreRounds(c.m, 'test'), 1); } finally { globalThis.performance = perf; }
    assert.equal(was.now, '01-01 10:00'); assert.equal(was.year, 2027);
    assert.equal(was.money.tx.length, 1);
});

test('a record told again with its clock a little off is the one there (a text at 21:00 then 21:02, a call, a mail); a call back an hour later is a second call', async () => {
    const chat = [say('Ren', 'start'), say('Mara', 'hi'), say('Mara', 'texted mum, called her'), say('Ren', 'ok'), say('Mara', 'she replied; called again an hour later')];
    const c = setup(chat); c.p.sync.limit = 2;
    const ph = (t1, t2, more = []) => ({ threads: [{ with: 'Mum', messages: [{ from: 'me', text: 'coming home late tonight, dont wait up', time: t1 }, ...more] }], calls: [{ with: 'Mum', type: 'out', time: t2, min: 5 }], mails: [{ from: 'Bank', subject: 'Statement', text: 'x', time: '10-26 09:00' }] });
    await run(c.m, { now: '10-26 22:00', events: [{ id: 'late', at: 2, quote: 'texted mum', summary: '문자', date: '10-26', time: '21:00', phone: ph('10-26 21:00', '10-26 21:05') }] });
    await run(c.m, { now: '10-26 23:00', events: [{ id: 'late', at: 4, quote: 'she replied', summary: '답장', date: '10-26', time: '22:30', phone: { ...ph('10-26 21:02', '10-26 21:07', [{ from: 'Mum', text: 'ok sweetie', time: '10-26 21:10' }]), calls: [{ with: 'Mum', type: 'out', time: '10-26 21:07', min: 5 }, { with: 'Mum', type: 'out', time: '10-26 22:10', min: 2 }], mails: [{ from: 'Bank', subject: 'Statement', text: 'x', time: '10-26 09:30' }] } }] });
    const t = c.p.threads.find(x => x.with === 'Mum');
    assert.deepEqual(t.messages.map(x => x.text), ['coming home late tonight, dont wait up', 'ok sweetie']);
    assert.deepEqual(c.p.calls.map(x => x.time), ['10-26 21:05', '10-26 22:10']);
    assert.equal(c.p.mails.length, 1);
});

test('a plan moved or called off changes the item there; a text the owner deleted leaves the screen but stays for 되돌리기', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'dinner friday?'), say('Ren', 'sure, friday 7pm')]);
    await run(c.m, { now: '10-26 13:00', events: [
        { id: 'plans', at: 2, quote: 'friday 7pm', summary: '약속', date: '10-26', time: '12:00', phone: { events: [{ title: '저녁 약속', date: '10-30', time: '19:00' }, { title: '점심', date: '10-28', time: '12:30' }], threads: [{ with: 'Mara', messages: [msg('A: 금요일 저녁?', '10-26 12:01'), msg('B: 삭제할 문자', '10-26 12:02')] }] } },
    ] });
    assert.equal(c.p.events.length, 2);
    T.chat.push(say('Mara', 'actually saturday'), say('Ren', 'and the lunch is off'), say('Mara', 'ok, deleted my text'));
    await run(c.m, { now: '10-26 14:00', events: [
        { id: 'moved', at: 3, quote: 'actually saturday', summary: '옮김', date: '10-26', time: '13:00', phone: { events: [{ title: '저녁 약속', date: '10-31', was: '10-30' }, { title: '점심', date: '10-28', cancelled: true }], threads: [{ with: 'Mara', messages: [{ text: '삭제할 문자', deleted: true }] }] } },
    ] });
    assert.equal(c.p.events.length, 2);
    assert.equal(c.p.events.find(e => e.title === '저녁 약속').date, '10-31'); assert.equal(c.p.events.find(e => e.title === '저녁 약속').time, '19:00');
    assert.equal(c.p.events.find(e => e.title === '점심').cancelled, true);
    const t = c.p.threads.find(x => x.with === 'Mara');
    assert.equal(t.messages.length, 2); assert.equal(t.messages.filter(x => x.deleted).length, 1);
    assert.equal(data.lastTime(t), '10-26 12:01');
});

test('a plan moved with its title reworded is the one on its old day; a deleted text in a thread new this round is kept, marked', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'dinner saturday?'), say('Ren', 'sure')]);
    await run(c.m, { now: '10-26 13:00', events: [{ id: 'plan', at: 2, quote: 'sure', summary: '약속', date: '10-26', time: '12:00', phone: { events: [{ title: '토요일 저녁 약속 — 루체, Ren', date: '10-31', time: '19:00' }] } }] });
    T.chat.push(say('Mara', 'make it sunday'), say('Ren', 'deleted that text'));
    await run(c.m, { now: '10-26 14:00', events: [{ id: 'moved', at: 3, quote: 'sunday', summary: '옮김', date: '10-26', time: '13:00', phone: { events: [{ title: '일요일 저녁 약속 — 루체, Ren', date: '11-01', time: '19:00', was: '10-31' }], threads: [{ with: 'Mara', messages: [msg('A: 내일 봐', '10-26 13:01'), { from: 'me', text: '사실 힘들어', time: '10-26 13:02', deleted: true }] }] } }] });
    assert.equal(c.p.events.length, 1); assert.equal(c.p.events[0].date, '11-01'); assert.equal(c.p.events[0].title, '일요일 저녁 약속 — 루체, Ren');
    const t = c.p.threads.find(x => x.with === 'Mara');
    assert.equal(t.messages.length, 2); assert.equal(t.messages.find(x => x.deleted)?.text, '사실 힘들어');
});

test('a Korean line that only says its original again is not drawn twice; a real translation stays', () => {
    const p = { delivery: { orders: [{ noteShop: '케이크 흐트러지지 않게 조심히 배달 부탁드려요♡', noteShopKo: '케이크 흐트러지지 않게 조심히 배달 부탁드려요♡', noteRider: 'Bitte klingeln', noteRiderKo: '벨 눌러 주세요' }] },
        threads: [{ messages: [{ who: 'Mara', text: 'See you soon!', ko: 'See you soon' }, { who: 'Mara', text: 'Bis gleich', ko: '곧 봐' }] }],
        notes: [{ title: '장보기', kt: '장 보기 목록', text: 'Milch, Brot', ko: '우유, 빵' }], events: [{ title: '치과 예약', ko: '치과 예약 (오후)' }] };
    data.tidyKo(p);
    const o = p.delivery.orders[0];
    assert.equal(o.noteShopKo, '');
    assert.equal(o.noteRiderKo, '벨 눌러 주세요');
    assert.deepEqual(p.threads[0].messages.map(x => x.ko), ['', '곧 봐']);
    assert.equal(p.notes[0].kt, '');
    assert.equal(p.notes[0].ko, '우유, 빵');
    assert.equal(p.events[0].ko, '');
});
