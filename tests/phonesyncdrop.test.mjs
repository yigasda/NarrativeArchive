import { cleanMessageURL } from './cleanmessage.mjs';
// 빼기 with sources: a whole reflection round against a fake chat and a fake model answer
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { migrateBank, cash, baseline, finance } from '../src/finance.js';
import { makeMark, newSync, journalRead, journalWrite } from '../src/phonesync.js';

const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const href = f => pathToFileURL(new URL(`../src/${f}`, import.meta.url).pathname).href;
const T = (globalThis.__dropTest = { chat: [], answers: [] });
const map = { './extract.js': cleanMessageURL,
    './phonesync.js': href('phonesync.js'), './phoneparse.js': href('phoneparse.js'), './phoneclock.js': href('phoneclock.js'), './phonesynclife.js': href('phonesynclife.js'), './phonesyncmoney.js': href('phonesyncmoney.js'), './finance.js': href('finance.js'),
    './phoneprofile.js': href('phoneprofile.js'),
    './phonestory.js': encoded(`export const phoneTarget=()=>({scope:phoneChatScope(),check(){}});export const phoneChatScope=()=>globalThis.__dropTest.scope||'test';`),
    './wealth.js': encoded(`export const ensureWealth=async()=>null;export const wealthBlock=()=>'';export const wealthDate=()=> '2026-10-26';export const wealthCheck=()=>null;export const addWealthFX=()=>{};`),
    './ai.js': encoded(`export const askDraft=async(input,o)=>{if(String(o.system).startsWith('GOAL\\nWrite the ordinary life')){(globalThis.__everydayIn||=[]).push(input);const e=globalThis.__everyday;return JSON.stringify(typeof e==='function'?e(input):e||{});}if(String(o.system).startsWith('GOAL\\nWork out where')){(globalThis.__where||=[]).push(input);await globalThis.__dropTest.beforeWhere?.();return '{"people":[]}';}const T=globalThis.__dropTest;if(String(o.system).startsWith('STAGE: money')){T.moneyInput=input;T.moneySys=o.system;T.moneyCalls=(T.moneyCalls||0)+1;if(T.moneyAnswers&&T.moneyAnswers.length){const a=T.moneyAnswers.shift();return typeof a==='string'?a:JSON.stringify(a);}const core=(T.lastCore&&T.lastCore.events)||[];const out=[];for(const l of String(input).split('\\n')){const x=l.match(/^- (.+?): #(\\d+) .*?\\("(.*)"\\)(?: \\(changed\\))?$/)||l.match(/^- (.+?): #(\\d+) /);if(!x)continue;const e=core.find(e=>e&&e.money&&Number(String(e.at).replace('#',''))===Number(x[2])&&(x[3]===undefined||String(e.quote||'').slice(0,200)===x[3]));if(e)out.push({id:x[1],money:e.money});}return JSON.stringify({events:out});}T.sys=o.system;T.input=input;await T.beforeCore?.();const a=T.answers.shift();T.lastCore=a&&typeof a==='object'?a:null;return typeof a==='string'?a:JSON.stringify(a);};`),
    './core.js': encoded(`export const ctx=()=>({chat:globalThis.__dropTest.chat,chatMetadata:globalThis.__dropTest.meta,loadWorldInfo:async()=>null,characters:[]});export const globalSettings=()=>({});export const saveMeta=async()=>{};`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=()=>[];export const chatRows=()=>globalThis.__dropTest.chat.map((x,i)=>({index:i,user:x.is_user,hidden:!!x.is_system,text:'[#'+i+'] '+x.name+': '+(globalThis.__dropTest.clean?globalThis.__dropTest.clean(x.mes):x.mes)}));`),
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
    globalThis.__everydayIn = [];
    await run(c.m, { now: '10-26 15:00', events: [] });
    assert.equal(c.p.sync.dropped?.length || 0, 0);
    assert.ok(c.p.syncLast.notes.some(n => /읽은 대화가 바뀌어서|바뀐 대화 1개/.test(n)));
    // (일상 gets the reflection's own input, all of it)
    assert.ok(globalThis.__everydayIn.at(-1).startsWith(T.input));
    // but never the block of messages read before and changed since
    assert.deepEqual(data.everydayParts(['[NEW MESSAGES]\n[#3] a', '[MESSAGES READ BEFORE, NOW CHANGED]\n- #3: book', '[PHONE NOW]\n{}']), ['[NEW MESSAGES]\n[#3] a', '[PHONE NOW]\n{}']);
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

test('a phone with a bank but without the everyday or delivery apps: core then money, each with only its own', async () => {
    const c = await bookCase();
    assert.equal(T.sys, data.coreSystem());
    assert.ok(!T.sys.includes('LIFE') && !T.sys.includes('deliveries'));
    assert.ok(!T.input.includes('[MONEY NOW]'));
    assert.equal(T.moneySys, data.moneySystem());
    assert.ok(T.moneyInput.includes('[MONEY NOW]') && T.moneyInput.includes('[EVENTS]'));
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
    assert.ok(T.sys.includes('LIFE\n') && !T.sys.includes('"deliveries"') && T.sys.includes('"weather"'));
    assert.ok(T.input.includes('[LIFE NOW]') && !T.input.includes('[DELIVERY SHOPS]'));
    assert.ok(T.moneySys.includes('"deliveries"') && T.moneyInput.includes('[DELIVERY SHOPS]'));
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

test('reflection in two steps: core keeps the life apps and marks money; money holds the money only; each names its step', () => {
    const core = data.coreSystem({ life: true, weather: true, tracker: true, invest: true }), money = data.moneySystem({ delivery: true, invest: true });
    assert.equal(core.split('\n')[0], 'STAGE: core');
    assert.equal(money.split('\n')[0], 'STAGE: money');
    assert.match(core, /"apps": \[\] or \["money", "invest"\]/);
    assert.match(core, /only touches these apps .*a share price mentioned.* is still an event/);
    assert.match(core, /its basket too/);
    assert.match(core, /a share price the story gives, a share they start watching, a stake/);
    for (const k of ['"alarms"', '"health"', '"days"', '"weather"', '"cities"', 'LIFE NOW']) assert.ok(core.includes(k), `core lacks ${k}`);
    for (const k of ['"moves"', '"deliveries"', 'MONEY NOW', 'a payment in them is that same payment']) assert.ok(!core.includes(k), `core holds ${k}`);
    for (const k of ['"moves"', '"deliveries"', '"newShop"', '"stakes"']) assert.ok(money.includes(k), `money lacks ${k}`);
    assert.ok(!data.moneySystem().includes('"deliveries"'));
    // the brokerage only when asked: a meal or a taxi doesn't carry trades, prices or stakes
    for (const k of ['"trades"', 'INVESTMENTS NOW', '"stakes"', 'broker']) assert.ok(!data.moneySystem({ delivery: true }).includes(k), `money without invest holds ${k}`);
    assert.ok(!data.coreSystem({ life: true }).includes('"invest"'));
    // the one-step instructions are unchanged
    assert.ok(!data.updateSystem({ money: true }).startsWith('STAGE'));
    assert.ok(!data.updateSystem({ money: true }).includes('"apps"'));
});

// ---- 반영 in two steps: money asked after core, owed when it can't go in (docs/REFLECT-2STAGE-PLAN.md)
function taxiSetup() {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Mara', 'I paid the taxi 12000 won'), say('Ren', 'thanks')]);
    T.moneyAnswers = []; T.moneyCalls = 0; T.lastCore = null;
    return c;
}
const taxiCore = () => ({ now: '10-26 13:00', events: [{ id: 'taxi', at: 2, quote: 'paid the taxi', summary: '택시', date: '10-26', time: '12:40', apps: ['money'],
    phone: { threads: [{ with: 'Mara', messages: [msg('택시비 냈어', '10-26 12:41')] }] } }] });
const taxiPaid = { events: [{ id: 'taxi', money: { moves: [{ account: '1111', amount: -12000, who: '택시', kind: 'card', occurrence: 'new' }] } }] };
const nextRound = async (c, words, answer = { now: '10-26 15:00', events: [] }) => { T.chat.push(say('Mara', words)); await run(c.m, answer); };

test('a scene where only money moves: core marks it, the money step pays it, the event keeps both', async () => {
    const c = taxiSetup();
    T.moneyAnswers.push(taxiPaid);
    await run(c.m, taxiCore());
    assert.equal(T.moneyCalls, 1);
    assert.match(T.moneyInput, /- taxi: #2 10-26 12:40 택시 \("paid the taxi"\)/);
    assert.match(T.moneyInput, /paid the taxi/);
    assert.equal(c.bank(), 88000);
    assert.deepEqual(texts(c.p), ['택시비 냈어']);
    assert.ok(c.p.sync.events.taxi.effects.some(x => x.path === 'money.tx'));
    assert.deepEqual(c.p.sync.owed.money, []);
});

test('the money step failing: core\'s texts stay, the money is owed and asked again next round though nothing is marked; 되돌리기 owes it again', async () => {
    const c = taxiSetup();
    T.moneyAnswers.push('not json at all');
    await run(c.m, taxiCore());
    assert.deepEqual(texts(c.p), ['택시비 냈어']);
    assert.equal(c.bank(), 100000);
    assert.deepEqual(c.p.sync.owed.money.map(x => [x.id, x.tries]), [['taxi', 1]]);
    assert.ok(c.p.syncLast.notes.some(n => n.includes('다음 반영 때 다시')));
    // the next round marks nothing; the owed money is asked for all the same, and goes on the same event
    T.moneyAnswers.push(taxiPaid);
    await nextRound(c, 'see you tomorrow');
    assert.equal(T.moneyCalls, 2);
    assert.equal(c.bank(), 88000);
    assert.deepEqual(c.p.sync.owed.money, []);
    assert.ok(c.p.sync.events.taxi.effects.some(x => x.path === 'money.tx'));
    // 되돌리기 of that round: the payment goes, and it is owed again (not lost); core's texts from the round before stay
    await data.undoRound(c.m, c.p);
    assert.equal(c.bank(), 100000);
    assert.deepEqual(c.p.sync.owed.money.map(x => [x.id, x.tries]), [['taxi', 1]]);
    assert.deepEqual(texts(c.p), ['택시비 냈어']);
});

test('money owed twice in a row is skipped and said so; a money answer for an event core never gave is left out', async () => {
    const c = taxiSetup();
    T.moneyAnswers.push('broken', { events: [{ id: 'lunch', money: { moves: [{ account: '1111', amount: -9000, who: 'Kantine', occurrence: 'new' }] } }] });
    await run(c.m, taxiCore());
    await nextRound(c, 'see you tomorrow');
    assert.deepEqual(c.p.sync.owed.money, []);
    assert.equal(c.bank(), 100000);
    assert.ok(c.p.syncLast.notes.some(n => n.includes('모르는 이벤트(lunch)')));
    // the second round's answer had nothing for taxi: no money, nothing owed (only a failed step is owed)
});

test('money that fails two rounds running is skipped, with a note', async () => {
    const c = taxiSetup();
    T.moneyAnswers.push('broken', 'broken again');
    await run(c.m, taxiCore());
    await nextRound(c, 'see you tomorrow');
    assert.deepEqual(c.p.sync.owed.money, []);
    assert.ok(c.p.syncLast.notes.some(n => n.includes('두 번 못 넣어서 건너뛰었어요')));
    assert.deepEqual(texts(c.p), ['택시비 냈어']);
});

test('빼기 of an event whose money came a round later takes its texts and its payment out together', async () => {
    const c = taxiSetup();
    T.moneyAnswers.push('broken', taxiPaid);
    await run(c.m, taxiCore());
    await nextRound(c, 'see you tomorrow');
    assert.equal(c.bank(), 88000);
    // the taxi message is deleted from the chat: its stretch can be taken out
    T.chat.splice(2, 1);
    await nextRound(c, 'good night');
    const d = c.p.sync.dropped;
    assert.equal(d.length, 1);
    assert.deepEqual(d[0].events, ['taxi']);
    await data.dropStretch(c.m, c.p, 0);
    assert.deepEqual(texts(c.p), []);
    assert.equal(c.bank(), 100000);
    assert.ok(!c.p.money.tx.some(t => t.who === '택시'));
});

test('복구 of a round whose money step failed brings back what it owes', async () => {
    const { journalWrite } = await import('../src/phonesync.js'); journalWrite('test', []);
    const c = taxiSetup();
    const was = structuredClone(c.p);
    T.moneyAnswers.push('broken');
    await run(c.m, taxiCore());
    c.m.phones.ren = was;
    const perf = globalThis.performance; globalThis.performance = { timeOrigin: Date.now() + 1e6 };
    try { assert.equal(await data.restoreRounds(c.m, 'test'), 1); } finally { globalThis.performance = perf; }
    assert.deepEqual(was.sync.owed.money.map(x => x.id), ['taxi']);
    assert.deepEqual(texts(was), ['택시비 냈어']);
});

test('결제 다시 읽기 puts the owed money on the same round: 되돌리기 then takes the texts and the payment back together', async () => {
    const c = taxiSetup();
    T.moneyAnswers.push('broken');
    await run(c.m, taxiCore());
    assert.equal(data.canRetryMoney(c.p), true);
    T.moneyAnswers.push(taxiPaid);
    const r = await data.retryMoney(c.m, 'Ren');
    assert.equal(r.paid, 1);
    assert.equal(c.bank(), 88000);
    assert.deepEqual(c.p.sync.owed.money, []);
    assert.equal(data.canRetryMoney(c.p), false);
    await data.undoRound(c.m, c.p);
    assert.equal(c.bank(), 100000);
    assert.deepEqual(texts(c.p), []);
    assert.deepEqual(c.p.sync.owed.money, []);
});

test('run35: a deleted text is not matched to an emoji-only text, nor to a short one inside it; the very same emoji is', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'hi'), say('Mara', 'thumbs')]);
    await run(c.m, { now: '10-26 15:00', events: [{ id: 'thumbs', at: 2, quote: 'thumbs', summary: '답장', date: '10-26', time: '15:00',
        phone: { threads: [{ with: 'Mara', messages: [msg('👍', '10-26 15:02'), msg('응', '10-26 15:03')] }] } }] });
    T.chat.push(say('Ren', 'late talk'), say('Ren', 'deleted it'));
    await run(c.m, { now: '10-26 22:00', events: [{ id: 'gone', at: 4, quote: 'deleted it', summary: '삭제', date: '10-26', time: '22:00',
        phone: { threads: [{ with: 'Mara', messages: [{ from: 'me', text: '오늘 치킨 고마워. 근데 나 사실 새 회사 너무 힘들어, 응', deleted: true }, { from: 'Mara', text: '👍', deleted: true }] }] } }] });
    const ms = c.p.threads.find(t => t.with === 'Mara').messages;
    // the long text was never on the phone: it goes in marked, and "응" stays as it was
    assert.equal(ms.find(x => x.text === '응').deleted, undefined);
    assert.equal(ms.find(x => x.text.startsWith('오늘 치킨')).deleted, true);
    // the very same 👍 is the one deleted
    assert.equal(ms.filter(x => x.text === '👍').length, 1);
    assert.equal(ms.find(x => x.text === '👍').deleted, true);
});

test('run35: a plan written as called off with the same plan new on another day is one plan moved', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'dinner saturday 7?'), say('Ren', 'sure')]);
    await run(c.m, { now: '02-01 13:00', events: [{ id: 'plan', at: 2, quote: 'dinner saturday', summary: '약속', date: '02-01', time: '12:00', phone: { events: [{ title: '루미 저녁', date: '02-06', time: '19:00' }] } }] });
    T.chat.push(say('Mara', 'can we do sunday instead'));
    await run(c.m, { now: '02-02 09:00', events: [{ id: 'move', at: 3, quote: 'sunday instead', summary: '옮김', date: '02-02', time: '08:00',
        phone: { events: [{ title: '루미 저녁', date: '02-06', cancelled: true }, { title: '루미에서 저녁', date: '02-07', time: '19:00' }] } }] });
    const live = c.p.events.filter(e => !e.cancelled);
    assert.equal(c.p.events.length, 1);
    assert.deepEqual(live.map(e => [e.date, e.time]), [['02-07', '19:00']]);
});

// ---- 점검 1묶음: 돈 · 기록
test('the same event told again in a later round: its new payment gets its own record, and undo takes back only that one', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'hi'), say('Mara', 'bought the book for 15000 won')]);
    const pay = (at, quote, amount, who, time) => ({ id: 'book', at, quote, summary: '책', date: '10-26', time, phone: {}, money: { moves: [{ account: '1111', amount, who, occurrence: 'new' }] } });
    await run(c.m, { now: '10-26 13:00', events: [pay(2, 'bought the book', -15000, '서점', '12:00')] });
    T.chat.push(say('Mara', 'and a bookmark for 2000 at the same shop'));
    await run(c.m, { now: '10-26 14:00', events: [pay(3, 'bookmark for 2000', -2000, '문구점', '12:10')] });
    assert.equal(c.bank(), 83000);
    assert.equal(new Set(c.p.money.tx.map(t => t.id)).size, 2);
    await data.undoRound(c.m, c.p);
    assert.equal(c.bank(), 85000);
    assert.deepEqual(c.p.money.tx.map(t => t.amount), [-15000]);
});

test('a message read again after a failure doesn\'t pay what its neighbour already paid (the money step too)', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'how much was the taxi ride'), say('Mara', 'I paid the taxi 12000 won'), say('Ren', 'ok and what about dinner later')]);
    const taxi = (id, at, quote) => ({ id, at, quote, summary: '택시', date: '10-26', time: '12:40', apps: ['money'], phone: {}, money: { moves: [{ account: '1111', amount: -12000, who: '택시', kind: 'card', occurrence: 'new' }] } });
    await run(c.m, { now: '10-26 13:00', events: [taxi('taxi', 3, 'paid the taxi'), { id: 'dinner', at: 4, quote: 'NOT IN TEXT', summary: 'x', date: '10-26', time: '13:00', phone: { notes: [{ title: 'd', text: 'd' }] } }] });
    T.chat.push(say('Mara', 'see you'));
    await run(c.m, { now: '10-26 14:00', events: [taxi('taxi-again', 4, 'what about dinner')] });
    assert.equal(c.bank(), 88000);
});

test('빼기 keeps an account another event still pays into, and the event that opened it', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Mara', 'I opened a savings account ending 2222 today'), say('Ren', 'nice'), say('Mara', 'I moved 50000 won into the savings account')]);
    c.p.sync.limit = 2;
    await run(c.m, { now: '10-26 10:00', events: [{ id: 'open', at: 2, quote: 'opened a savings account', summary: '적금 개설', date: '10-26', time: '09:00', apps: ['money'], phone: {}, money: { newAccount: { kind: 'savings', last4: '2222', currency: 'KRW', name: '적금', balance: 0 } } }] });
    await run(c.m, { now: '10-26 11:00', events: [{ id: 'move', at: 4, quote: 'moved 50000 won', summary: '적금 이체', date: '10-26', time: '10:30', apps: ['money'], phone: {}, money: { moves: [{ account: '1111', amount: -50000, who: '적금', kind: 'transfer', occurrence: 'new' }, { account: '2222', amount: 50000, who: '입출금', kind: 'transfer', occurrence: 'new' }] } }] });
    T.chat.splice(2, 1);
    await run(c.m, { now: '10-26 11:00', events: [] });
    const r = await data.dropStretch(c.m, c.p, 0);
    assert.deepEqual(r.kept, ['적금 개설']);
    assert.deepEqual(c.p.money.bank.accounts.map(a => a.last4), ['1111', '2222']);
});

test('a short read reply next to a hidden message is not taken for edited or deleted', async () => {
    const hide = x => ({ ...x, is_system: true });
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Mara', 'I paid the taxi 12000 won'), hide(say('Ren', '(OOC: brb, dinner)')), say('Ren', 'ok thanks!')]);
    await run(c.m, { now: '10-26 13:00', events: [{ id: 'thanks', at: 4, quote: 'ok thanks', summary: '고마워', date: '10-26', time: '12:45', phone: { notes: [{ title: 'thanks', text: '고마워' }] } }] });
    T.chat.push(say('Mara', 'see you tomorrow at nine then'));
    await run(c.m, { now: '10-26 14:00', events: [] });
    assert.ok(!T.input.split('[NEW MESSAGES]')[1].split('\n[')[0].includes('[#4] Ren: ok thanks!'));
    assert.ok(!T.input.includes('[#4] Ren: ok thanks!'));
    assert.deepEqual(c.p.syncLast.notes, []);
    assert.equal(c.p.sync.events.thanks.at, 4);
});

test('a message deleted earlier and the last round\'s message edited: numbers shift once, 빼기 of the payment\'s message still takes it', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'first talk long enough line here'), say('Mara', 'I paid the taxi 12000 won today')]);
    await run(c.m, { now: '10-26 13:00', events: [{ id: 'taxi', at: 3, quote: 'paid the taxi', summary: '택시', date: '10-26', time: '12:40', apps: ['money'], phone: { notes: [{ title: 'taxi', text: '택시비' }] }, money: { moves: [{ account: '1111', amount: -12000, who: '택시', kind: 'card', occurrence: 'new' }] } }] });
    T.chat.push(say('Ren', 'later line text here long enough'), say('Mara', 'see you at the cafe tomorrow ok'));
    await run(c.m, { now: '10-26 14:00', events: [{ id: 'cafe', at: 5, quote: 'see you at the cafe', summary: '카페', date: '10-26', time: '13:50', phone: { notes: [{ title: 'cafe', text: 'cafe tomorrow' }] } }] });
    T.chat.splice(2, 1);
    T.chat[3].mes = 'see you at the bakery tomorrow instead';
    await run(c.m, { now: '10-26 14:10', events: [] });
    assert.deepEqual([c.p.sync.events.taxi.at, c.p.money.tx[0].sourceIndex], [2, 2]);
    T.chat.splice(2, 1);
    await run(c.m, { now: '10-26 14:20', events: [] });
    await data.dropStretch(c.m, c.p, 0);
    assert.equal(c.bank(), 100000);
    assert.ok(!c.p.notes.some(n => n.title === 'taxi'));
});

test('a group chat: a reply deleted before the start moves the start with it, the next message is read', async () => {
    const c = setup([say('Ren', 'hello both of you'), say('Mara', 'hi Ren, long day'), say('Ivo', 'hey there, what is up')]);
    c.p.sync.marks.base = makeMark(T.chat, 2);
    T.chat.splice(1, 1);
    T.chat.push(say('Mara', 'I paid the taxi 12000 won'));
    await run(c.m, { now: '10-26 13:00', events: [] });
    assert.equal(c.p.syncLast.checked, 1);
    assert.ok(T.input.includes('[#2] Mara: I paid the taxi 12000 won'));
});

// ---- 점검 2묶음: 되돌리기 · 복구 · 빼기
test('되돌리기 puts back what a round changed on items already there: a plan moved, a text marked deleted, a contact\'s name, the profile, comments', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'dinner saturday 7?'), say('Ren', 'sure, and I texted Ivo')]);
    const post = { text: 'beach day', time: '10-25 10:00', comments: Array.from({ length: 7 }, (_, i) => ({ from: 'Ivo', text: `old comment ${i}` })) };
    await run(c.m, { now: '10-26 13:00', events: [{ id: 'plan', at: 2, quote: 'I texted Ivo', summary: '약속', date: '10-26', time: '12:00',
        phone: { events: [{ title: 'Dinner with Mara', date: '10-31', time: '19:00' }], threads: [{ with: 'Ivo', messages: [msg('see you', '10-26 12:00'), { from: 'me', text: 'I will be late tonight sorry', time: '10-26 12:05' }] }], posts: [post], contacts: [{ name: 'Varo', saved: 'Varo' }] } }] });
    const snap = JSON.stringify({ ev: c.p.events, th: c.p.threads, posts: c.p.posts, contacts: c.p.contacts, profile: c.p.profile });
    T.chat.push(say('Mara', 'can we do sunday instead? also delete that text, and new comments'));
    await run(c.m, { now: '10-26 15:00', events: [{ id: 'move', at: 3, quote: 'sunday instead', summary: '옮김', date: '10-26', time: '14:00',
        phone: { events: [{ title: 'Dinner with Mara', date: '11-01', was: '10-31', time: '19:00' }], threads: [{ with: 'Ivo', messages: [{ from: 'me', text: 'I will be late tonight sorry', deleted: true }] }],
            posts: [{ text: 'beach day', time: '10-25 10:00', comments: [{ from: 'Varo', text: 'new A' }, { from: 'Varo', text: 'new B' }] }], contacts: [{ name: 'Varo', saved: 'Varo 🏄' }], profile: { handle: 'ren.new', bio: 'changed bio' } } }] });
    assert.equal(c.p.events[0].date, '11-01');
    await data.undoRound(c.m, c.p);
    assert.equal(JSON.stringify({ ev: c.p.events, th: c.p.threads, posts: c.p.posts, contacts: c.p.contacts, profile: c.p.profile }), snap);
});

test('되돌리기 takes back a share price the story gave and the valuation day it moved', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'hi'), say('Mara', 'Varo Corp closed at 52000 today, I bought 2 shares')]);
    c.p.investment = { base: 'KRW', at: 1, date: '2026-10-20', accounts: [{ currency: 'KRW', key: 'brk:KRW' }], securities: [{ symbol: 'VARO', name: 'Varo Corp', currency: 'KRW' }], trades: [], watch: [] };
    baseline(c.m, 'brk', 'KRW', 500000, '2026-10-20', 'Ren');
    const before = JSON.stringify({ prices: finance(c.m).prices, date: c.p.investment.date });
    await run(c.m, { now: '10-26 15:00', events: [{ id: 'buy', at: 2, quote: 'closed at 52000', summary: '주식', date: '10-26', time: '14:00', apps: ['money'], phone: {},
        money: { quotes: [{ symbol: 'VARO', value: 52000, date: '10-26', evidence: 'closed at 52000' }], trades: [{ kind: 'buy', symbol: 'VARO', quantity: 2, price: 52000, fee: 0 }] } }] });
    assert.equal(c.p.investment.date, '2026-10-26');
    await data.undoRound(c.m, c.p);
    assert.equal(JSON.stringify({ prices: finance(c.m).prices, date: c.p.investment.date }), before);
});

const restoreLost = async m => { const perf = globalThis.performance; globalThis.performance = { timeOrigin: Date.now() + 1e6 }; try { return await data.restoreRounds(m, 'test'); } finally { globalThis.performance = perf; } };
test('복구 of a lost round: the event knows its payment again (빼기 takes it), a retried message is no longer failed, the deleted mark and the year come back', async () => {
    journalWrite('test', []);
    const c = setup([say('Ren', 'start'), say('Mara', 'hi'), say('Ren', 'I texted Ivo'), say('Mara', 'ok')]);
    c.p.year = 2026;
    await run(c.m, { now: '10-26 13:00', events: [{ id: 'plan', at: 2, quote: 'I texted Ivo', summary: '약속', date: '10-26', time: '12:00',
        phone: { threads: [{ with: 'Ivo', messages: [msg('see you', '10-26 12:00'), { from: 'me', text: 'I will be late tonight sorry', time: '10-26 12:05' }] }] } }, { id: 'bad', at: 3, quote: 'not in the text at all', summary: 'x', date: '10-26', time: '12:00', phone: { notes: [{ title: 'x', text: 'x' }] } }] });
    T.chat.push(say('Mara', 'taxi 12000; deleted that text'));
    const was = structuredClone(c.p), fin = structuredClone(c.m.finance);
    await run(c.m, { now: '10-26 15:00', events: [
        { id: 'taxi', at: 4, quote: 'taxi 12000', summary: '택시', date: '10-26', time: '14:30', phone: { threads: [{ with: 'Ivo', messages: [{ from: 'me', text: 'I will be late tonight sorry', deleted: true }] }] }, money: { moves: [{ account: '1111', amount: -12000, who: '택시', occurrence: 'new' }] } },
        { id: 'ok', at: 3, quote: 'ok', summary: 'ok', date: '10-26', time: '13:30', phone: { notes: [{ title: 'ok', text: 'ok note' }] } }] });
    c.m.phones.ren = was; c.m.finance = fin; // the save didn't land
    data.setStoryYear(c.m, was, 2030);
    assert.equal(await restoreLost(c.m), 1);
    assert.equal(was.year, 2030);
    assert.equal(was.sync.failed[3], undefined);
    assert.ok(was.threads.find(t => t.with === 'Ivo').messages.find(x => x.text.startsWith('I will be late')).deleted);
    assert.ok(was.sync.events.taxi.effects.length > 0);
    T.chat.splice(4, 1); T.chat.push(say('Ren', 'later on that night'), say('Mara', 'yes good night then'));
    T.answers.push({ now: '10-26 16:00', events: [] });
    await data.makePhone(c.m, 'Ren', { update: true });
    await data.dropStretch(c.m, was, was.sync.dropped.findIndex(d => d.events.includes('taxi')));
    assert.equal(cash(c.m.finance.accounts['chk:KRW']), 100000);
});

test('빼기 then 되돌리기: the event taken off stays off, and a new payment under its name later is paid', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Mara', 'I paid 12000 won for the taxi to the station'), say('Ren', 'thanks a lot for that')]);
    const taxi = (at, quote, time) => ({ id: 'taxi', at, quote, summary: '택시', date: '10-26', time, apps: ['money'], phone: {}, money: { moves: [{ account: '1111', amount: -12000, who: '택시', kind: 'card', occurrence: 'new' }] } });
    await run(c.m, { now: '10-26 10:00', events: [taxi(2, 'paid 12000 won for the taxi', '09:00')] });
    T.chat.splice(2, 1); T.chat.push(say('Mara', 'see you tomorrow at the cafe then'));
    await run(c.m, { now: '10-26 11:00', events: [] });
    await data.dropStretch(c.m, c.p, 0);
    await data.undoRound(c.m, c.p);
    assert.equal(c.p.sync.events.taxi, undefined);
    await run(c.m, { now: '10-26 12:00', events: [] });
    T.answers.length = 0; T.chat.push(say('Mara', 'I paid 12000 won for another taxi home'));
    await run(c.m, { now: '10-26 13:00', events: [taxi(T.chat.length - 1, 'paid 12000 won for another taxi', '12:30')] });
    assert.equal(c.p.money.tx.length, 1);
});

test('an order message rewritten and read again: the same event\'s delivery order is that one, not a second', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'I set an alarm for the airport tomorrow'),
        say('Mara', 'we ordered pasta from Pasta Nostra for 24.80'), say('Ren', 'it was really good pasta'), say('Mara', 'good night then, sleep well')]);
    c.p.sync.limit = 2;
    c.p.delivery = { shops: [], orders: [], cart: null };
    Object.assign(c.p.sync.marks, { delivery: { index: 1 }, money: { index: 1 } });
    const pasta = (at, quote) => ({ id: 'pasta', at, quote, summary: '파스타 배달', date: '10-26', time: '20:14', apps: ['money'], phone: {},
        money: { moves: [{ account: '1111', amount: -24.8, who: 'Pasta Nostra', kind: 'card', occurrence: 'new' }],
            deliveries: [{ shop: 'Pasta Nostra', items: [{ name: 'Tagliatelle', qty: 1, price: 13.9 }, { name: 'Penne', qty: 1, price: 11.5 }], fee: 1.99, discount: 2.59, status: 'delivered', occurrence: 'new' }] } });
    await run(c.m, { now: '10-26 21:00', events: [pasta(3, 'ordered pasta')] });
    await run(c.m, { now: '10-26 22:00', events: [] });
    T.chat.splice(2, 1);
    T.chat[2] = say('Mara', 'we ordered pasta from Pasta Nostra for 24.80, so tasty');
    await run(c.m, { now: '10-26 22:30', events: [pasta(2, 'ordered pasta')] });
    assert.equal(c.p.delivery.orders.length, 1);
    assert.equal(c.p.delivery.orders[0].sourceIndex, 2);
});

test('apps made again since the last round: its 되돌리기 is gone (it would put old records into the new apps)', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'hi'), say('Ren', 'coffee?')]);
    await run(c.m, { now: '10-26 13:00', events: [{ id: 'note', at: 2, quote: 'coffee', summary: '커피', date: '10-26', time: '12:00', phone: { notes: [{ title: 'coffee', text: 'coffee' }] } }] });
    assert.ok(data.canUndo(c.p));
    T.answers.push({ notes: [{ title: 'fresh', text: 'fresh note' }] });
    await data.makePhone(c.m, 'Ren', { apps: ['note'] });
    assert.equal(data.canUndo(c.p), false);
});

test('a phone whose reading starts anew: the old reading\'s unsaved rounds aren\'t offered for 복구', async () => {
    journalWrite('test', [{ round: 'old1', owner: 'Ren', at: 1, events: [], done: [] }]);
    const c = setup([say('Ren', 'start'), say('Mara', 'hi')]);
    delete c.m.phones.ren.money; c.m.phones.ren.sync = undefined;
    T.answers.push({ contacts: [], threads: [], now: '10-26 13:00' });
    await data.makePhone(c.m, 'Ren').catch(() => {});
    assert.deepEqual(journalRead('test').filter(r => r.owner === 'Ren'), []);
});

// ---- 점검 3묶음: 돈 단계
test('a phone with no story year: the money stage gets no made-up year either', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Mara', 'I paid the taxi 12000 won'), say('Ren', 'thanks a lot for that')]);
    c.p.noYear = true; T.moneyAnswers = [];
    await run(c.m, { now: '10-26 13:00', events: [{ id: 'taxi', at: 2, quote: 'paid the taxi', summary: '택시', date: '10-26', time: '12:40', apps: ['money'], phone: {}, money: { moves: [{ account: '1111', amount: -12000, who: '택시', kind: 'card', occurrence: 'new' }] } }] });
    assert.ok(!/\[STORY YEAR\]/.test(T.input));
    assert.ok(!/\[STORY YEAR\]/.test(T.moneyInput));
});

test('the money stage answering one event twice: both payments kept, not the last only', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Mara', 'dinner was 30000 won and the taxi home 12000 won'), say('Ren', 'thanks a lot for that')]);
    T.moneyAnswers = [{ events: [
        { id: 'night', money: { moves: [{ account: '1111', amount: -30000, who: '식당', kind: 'card', occurrence: 'new' }] } },
        { id: 'night', money: { moves: [{ account: '1111', amount: -12000, who: '택시', kind: 'card', occurrence: 'new' }] } }] }];
    await run(c.m, { now: '10-26 23:00', events: [{ id: 'night', at: 2, quote: 'dinner was 30000 won', summary: '저녁과 택시', date: '10-26', time: '22:00', apps: ['money'], phone: {} }] });
    assert.equal(c.bank(), 58000);
    assert.deepEqual(c.p.money.tx.map(t => t.amount).sort((a, b) => a - b), [-30000, -12000]);
});

test('the money stage sees two messages either side: the amount two messages after the event still counts', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'on my way'), say('Mara', 'Mara climbs out of a taxi and hurries over'), say('Ren', 'you made it'), say('Mara', 'I paid the taxi 12000 won'), say('Ren', 'thanks a lot for that')]);
    T.moneyAnswers = [];
    await run(c.m, { now: '10-26 13:00', events: [{ id: 'taxi', at: 3, quote: 'climbs out of a taxi', summary: '택시', date: '10-26', time: '12:40', apps: ['money'], phone: {}, money: { moves: [{ account: '1111', amount: -12000, who: '택시', kind: 'card', occurrence: 'new' }] } }] });
    assert.ok(T.moneyInput.includes('I paid the taxi 12000 won'));
});

// ---- 되돌리기 · 복구 점검
test('되돌리기 puts the weather back even when a newly saved city got its id after the round', async () => {
    const c = lifeSetup();
    c.p.life.weather.cities = [{ name: 'Seoul', ko: '서울', tz: 'Asia/Seoul', cond: 'clear', temp: 14 }];
    const ans = lifeAnswer(); ans.weather.cities = [{ name: 'Seoul', cond: 'rain', temp: 12 }, { name: 'Rome', tz: 'Europe/Rome', cond: 'clear', temp: 18, added: true, note: 'trip' }];
    await run(c.m, ans);
    assert.equal(c.p.life.weather.cities.length, 2);
    const kept = await data.undoRound(c.m, c.p);
    assert.deepEqual(kept, []);
    const w = c.p.life.weather;
    assert.deepEqual([w.here.cond, w.here.time, w.cities.length, w.cities[0].cond], ['clear', '09:00', 1, 'clear']);
});

test('되돌리기 says the weather stayed when the user changed it since', async () => {
    const c = lifeSetup();
    await run(c.m, lifeAnswer());
    c.p.life.weather.here.cond = 'snow';
    const kept = await data.undoRound(c.m, c.p);
    assert.ok(kept.includes('날씨'));
    assert.equal(c.p.life.weather.here.cond, 'snow');
});

test('되돌리기 keeps a record put on the phone without an id before the round (a news search)', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'lunch at the cafe')]);
    c.p.searches = [{ q: 'Varo Motors business news', time: '10-26 08:00' }];
    await run(c.m, { now: '10-26 13:00', events: [{ id: 'lunch', at: 2, quote: 'lunch at the cafe', summary: '점심', date: '10-26', time: '12:00', phone: { notes: [{ title: 'Lunch', text: 'cafe' }] } }] });
    await data.undoRound(c.m, c.p);
    assert.deepEqual(c.p.searches.map(x => x.q), ['Varo Motors business news']);
    assert.deepEqual(c.p.notes, []);
});

test('되돌리기 of an order marked delivered takes its arrival day back too', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'I ordered a lamp from Ivo Shop for 30000 won')]);
    await run(c.m, { now: '10-26 10:00', events: [{ id: 'lamp', at: 2, quote: 'ordered a lamp from Ivo Shop', summary: '램프 주문', date: '10-26', time: '09:30',
        money: { moves: [{ account: '1111', amount: -30000, who: 'Ivo Shop', occurrence: 'new' }], orders: [{ shop: 'Ivo Shop', item: 'lamp', price: 30000, status: 'shipped', occurrence: 'new' }] } }] });
    T.chat.push(say('Mara', 'Ren, your lamp from Ivo Shop was delivered today'));
    await run(c.m, { now: '10-28 18:00', events: [{ id: 'lamp', at: 3, quote: 'your lamp from Ivo Shop was delivered', summary: '램프 도착', date: '10-28', time: '17:00',
        money: { orders: [{ shop: 'Ivo Shop', item: 'lamp', price: 30000, status: 'delivered', occurrence: 'again', already: 'sync:lamp:o0' }] } }] });
    assert.equal(c.p.money.orders[0].arrived, '10-28');
    await data.undoRound(c.m, c.p);
    assert.equal(c.p.money.orders[0].status, 'shipped');
    assert.ok(!c.p.money.orders[0].arrived);
});

test('반영 with nothing new keeps the last result and its 되돌리기', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'lunch at the cafe')]);
    await run(c.m, { now: '10-26 13:00', events: [{ id: 'lunch', at: 2, quote: 'lunch at the cafe', summary: '점심', date: '10-26', time: '12:00', phone: { notes: [{ title: 'Lunch', text: 'cafe' }] } }] });
    await data.makePhone(c.m, 'Ren', { update: true });
    assert.ok(c.p.syncLast.checked > 0 && data.canUndo(c.p));
});

test('복구 adds no round whose talk 반영 already read again, and never sets the clock back within the day', async () => {
    journalWrite('test', []);
    const c = setup([say('Ren', 'start'), say('Mara', 'hi'), say('Mara', 'I paid the taxi 12000 won'), say('Ren', 'thanks')]);
    const was = structuredClone(c.p), fin = structuredClone(c.m.finance);
    await run(c.m, { now: '10-26 10:00', events: [{ id: 'taxi', at: 2, quote: 'paid the taxi', summary: '택시', date: '10-26', time: '09:30', money: { moves: [{ account: '1111', amount: -12000, who: '택시', occurrence: 'new' }] } }] });
    // the save didn't land; 반영 pressed again reads the same talk (the model names the event otherwise)
    c.m.phones.ren = was; c.m.finance = fin; c.p = was;
    T.answers.push({ now: '10-26 15:00', events: [{ id: 'taxi-ride', at: 2, quote: 'paid the taxi', summary: '택시', date: '10-26', time: '09:30', money: { moves: [{ account: '1111', amount: -12000, who: '택시', occurrence: 'new' }] } }] });
    await data.makePhone(c.m, 'Ren', { update: true });
    assert.equal(await restoreLost(c.m), 0);
    assert.equal(cash(c.m.finance.accounts['chk:KRW']), 88000);
    assert.equal(was.now, '10-26 15:00');
});

test('복구 never sets the clock back within the same day', async () => {
    journalWrite('test', []);
    const c = setup([say('Ren', 'start'), say('Mara', 'hi'), say('Ren', 'lunch at the cafe'), say('Mara', 'ok')]);
    const was = structuredClone(c.p), fin = structuredClone(c.m.finance);
    await run(c.m, { now: '10-26 10:00', events: [{ id: 'lunch', at: 2, quote: 'lunch at the cafe', summary: '점심', date: '10-26', time: '09:30', phone: { notes: [{ title: 'Lunch', text: 'cafe' }] } }] });
    c.m.phones.ren = was; c.m.finance = fin;
    was.now = '10-26 15:00';
    assert.equal(await restoreLost(c.m), 1);
    assert.equal(was.now, '10-26 15:00');
    assert.deepEqual(was.notes.map(x => x.title), ['Lunch']);
});

test('the money step sees no message the round hasn\'t read yet (the next round pays what it says)', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Ren', 'Mara and I got into a taxi to the station'), say('Mara', 'the driver took the long road'), say('Ren', 'I paid the taxi 12000 won by bank transfer'), say('Mara', 'thanks Ren, see you')]);
    c.p.sync.limit = 2;
    T.moneyAnswers = [{ events: [] }];
    await run(c.m, { now: '10-26 10:00', events: [{ id: 'taxi', at: 3, quote: 'the driver took the long road', summary: '택시', date: '10-26', time: '10:00', apps: ['money'], phone: {} }] });
    assert.ok(T.moneyInput.includes('the driver took the long road'));
    assert.ok(!T.moneyInput.includes('I paid the taxi 12000 won'));
});

test('빼기 of two events of the same talk (an account opened, money put in): both go, no empty account left', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Ren', 'I opened a savings account today'), say('Ren', 'and put 50000 won in it'), say('Mara', 'nice')]);
    await run(c.m, { now: '10-26 12:00', events: [
        { id: 'open', at: 2, quote: 'opened a savings account', summary: '적금 개설', date: '10-26', time: '11:00', money: { newAccount: { kind: 'savings', name: '적금', last4: '7777', currency: 'KRW', balance: 0 } } },
        { id: 'put', at: 3, quote: 'put 50000 won in it', summary: '적금 입금', date: '10-26', time: '11:05', money: { moves: [{ account: '7777', amount: 50000, who: '적금', kind: 'deposit', occurrence: 'new' }] } }] });
    assert.ok(c.p.money.bank.accounts.some(a => a.last4 === '7777'));
    T.chat.splice(2, 2); T.chat.push(say('Ren', 'what a long day it was'));
    T.answers.push({ now: '10-26 13:00', events: [] });
    await data.makePhone(c.m, 'Ren', { update: true });
    const k = c.p.sync.dropped.findIndex(d => d.events.includes('open'));
    assert.ok(k >= 0);
    const r = await data.dropStretch(c.m, c.p, k);
    assert.deepEqual(r.kept, []);
    assert.ok(!c.p.money.bank.accounts.some(a => a.last4 === '7777'));
});

// ---- 점검 높음 묶음
test('빼기 of a delivery the clock alone marked delivered: the order and its payment go together', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'hungry?'), say('Mara', 'I ordered tteokbokki from Ivo Snack for 18000 won, it is on the way'), say('Ren', 'save me some')]);
    c.p.delivery = { orders: [], shops: [] };
    await run(c.m, { now: '10-26 12:10', events: [{ id: 'food', at: 3, quote: 'I ordered tteokbokki', summary: '떡볶이 배달', date: '10-26', time: '12:00',
        money: { moves: [{ account: '1111', amount: -18000, who: 'Ivo Snack', occurrence: 'new' }], deliveries: [{ shop: 'Ivo Snack', items: [{ name: 'tteokbokki', qty: 1, price: 18000 }], status: 'on the way', occurrence: 'new' }] } }] });
    T.chat.push(say('Mara', 'it is three in the afternoon already, time flies'));
    await run(c.m, { now: '10-26 15:00', events: [] });
    assert.equal(c.p.delivery.orders[0].status, 'delivered');
    T.chat.splice(3, 1);
    T.answers.push({ now: '10-26 15:10', events: [] });
    await data.makePhone(c.m, 'Ren', { update: true });
    const r = await data.dropStretch(c.m, c.p, 0);
    assert.deepEqual([r.kept, c.p.delivery.orders.length, c.p.money.tx.length, c.bank()], [[], 0, 0, 100000]);
});

test('빼기 of a delivery the user reviewed since: the order stays with its payment, and it is said', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'hungry?'), say('Mara', 'I ordered tteokbokki from Ivo Snack for 18000 won, it is on the way'), say('Ren', 'save me some')]);
    c.p.delivery = { orders: [], shops: [] };
    await run(c.m, { now: '10-26 12:10', events: [{ id: 'food', at: 3, quote: 'I ordered tteokbokki', summary: '떡볶이 배달', date: '10-26', time: '12:00',
        money: { moves: [{ account: '1111', amount: -18000, who: 'Ivo Snack', occurrence: 'new' }], deliveries: [{ shop: 'Ivo Snack', items: [{ name: 'tteokbokki', qty: 1, price: 18000 }], status: 'on the way', occurrence: 'new' }] } }] });
    c.p.delivery.orders[0].review = { stars: 5 };
    T.chat.splice(3, 1);
    T.answers.push({ now: '10-26 12:20', events: [] });
    await data.makePhone(c.m, 'Ren', { update: true });
    const r = await data.dropStretch(c.m, c.p, 0);
    assert.deepEqual([r.kept, c.p.delivery.orders.length, c.p.money.tx.length, c.bank()], [['떡볶이 배달'], 1, 1, 82000]);
});

test('an event whose message number the model wrote as a range or one off is found by its quote, not lost', async () => {
    for (const at of ['#2–#3', '2, 3', 1]) {
        const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Mara', 'I paid the taxi 12000 won, text me later'), say('Ren', 'thanks a lot for that')]);
        T.moneyAnswers = [{ events: [{ id: 'taxi', money: { moves: [{ account: '1111', amount: -12000, who: '택시', kind: 'card', occurrence: 'new' }] } }] }];
        await run(c.m, { now: '10-26 13:00', events: [{ id: 'taxi', at, quote: 'I paid the taxi 12000 won', summary: '택시', date: '10-26', time: '12:40',
            phone: { threads: [{ with: 'Mara', messages: [{ from: 'Mara', text: 'text me later', time: '10-26 12:41' }] }] }, money: { moves: [{ account: '1111', amount: -12000, who: '택시', kind: 'card', occurrence: 'new' }] } }] });
        assert.equal(c.bank(), 88000, String(at));
        assert.equal(c.p.sync.events.taxi?.at, 2, String(at));
    }
});

test('a payment written "-₩12,000" is money out, not in', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Mara', 'I paid the taxi 12000 won'), say('Ren', 'thanks a lot for that')]);
    await run(c.m, { now: '10-26 13:00', events: [{ id: 'taxi', at: 2, quote: 'paid the taxi', summary: '택시', date: '10-26', time: '12:40', money: { moves: [{ account: '1111', amount: '-₩12,000', who: '택시', kind: 'transfer', occurrence: 'new' }] } }] });
    assert.equal(c.bank(), 88000);
});

test('money: an old event\'s name on the next day\'s new payment pays it; an owed payment left out is owed still; ids match whatever the case', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Ren', 'took a taxi to work for 12000 won')]);
    T.moneyAnswers = [{ events: [{ id: 'TAXI', money: { moves: [{ account: '1111', amount: -12000, who: '택시', kind: 'card', occurrence: 'new' }] } }] }];
    await run(c.m, { now: '10-26 10:00', events: [{ id: 'taxi', at: 2, quote: 'took a taxi to work', summary: '택시', date: '10-26', time: '09:30', apps: ['money'], phone: {} }] });
    assert.equal(c.bank(), 88000);
    T.chat.push(say('Ren', 'next day: a taxi again, 15000 won this time'));
    T.moneyAnswers = [{ events: [{ id: '#taxi', money: { moves: [{ account: '1111', amount: -15000, who: '택시', kind: 'card', occurrence: 'new' }] } }] }];
    await run(c.m, { now: '10-27 10:00', events: [{ id: 'taxi', at: 3, quote: 'a taxi again', summary: '택시', date: '10-27', time: '09:00', apps: ['money'], phone: {} }] });
    assert.equal(c.bank(), 73000);
    // owed (the money step failed), then left out of the next answer: still owed, then said
    T.chat.push(say('Ren', 'and a coffee for 4500 won'), say('Mara', 'nice'));
    T.moneyAnswers = ['not json at all'];
    await run(c.m, { now: '10-27 11:00', events: [{ id: 'coffee', at: 4, quote: 'a coffee for 4500 won', summary: '커피', date: '10-27', time: '10:30', apps: ['money'], phone: {} }] });
    assert.equal(c.p.sync.owed.money.length, 1);
    T.chat.push(say('Ren', 'lunch for 9000 won'));
    T.moneyAnswers = [{ events: [{ id: 'lunch', money: { moves: [{ account: '1111', amount: -9000, who: '점심', kind: 'card', occurrence: 'new' }] } }] }];
    await run(c.m, { now: '10-27 13:00', events: [{ id: 'lunch', at: 6, quote: 'lunch for 9000 won', summary: '점심', date: '10-27', time: '12:30', apps: ['money'], phone: {} }] });
    assert.ok(c.p.syncLast.notes.some(n => n.includes('커피')));
});

test('a delivery told again without its prices ("the chicken came") moves the order on, no second order', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Ren', 'I ordered Golden Olive chicken from BBQ for 28000 won'), say('Mara', 'save me a leg')]);
    c.p.delivery = { shops: [], orders: [], cart: null };
    T.moneyAnswers = [{ events: [{ id: 'chicken', money: { moves: [{ account: '1111', amount: -28000, who: 'BBQ', kind: 'card', occurrence: 'new' }], deliveries: [{ shop: 'BBQ', items: [{ name: 'Golden Olive', qty: 1, price: 28000 }], status: 'on the way', occurrence: 'new' }] } }] }];
    await run(c.m, { now: '10-26 19:00', events: [{ id: 'chicken', at: 2, quote: 'I ordered Golden Olive chicken', summary: '치킨', date: '10-26', time: '19:00', apps: ['money'], phone: {} }] });
    T.chat.push(say('Ren', 'the chicken arrived, come over'), say('Mara', 'on my way'));
    T.moneyAnswers = [{ events: [{ id: 'chicken-arrived', money: { deliveries: [{ shop: 'BBQ', items: [{ name: 'Golden Olive', qty: 1 }], status: 'delivered' }] } }] }];
    await run(c.m, { now: '10-26 19:30', events: [{ id: 'chicken-arrived', at: 4, quote: 'the chicken arrived', summary: '치킨 도착', date: '10-26', time: '19:30', apps: ['money'], phone: {} }] });
    assert.deepEqual(c.p.delivery.orders.map(o => o.status), ['delivered']);
    assert.equal(c.bank(), 72000);
});

test('빼기 leaves an order the talk still there tells again', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'did you get a present for Ivo'), say('Mara', 'I ordered a wool scarf from Varo Knits for 20000 won'), say('Ren', 'nice, when does it come'), say('Mara', 'the scarf from Varo Knits arrives on Thursday')]);
    const order = occ => ({ shop: 'Varo Knits', item: 'wool scarf', price: 20000, status: 'ordered', occurrence: occ });
    await run(c.m, { now: '10-26 13:00', events: [
        { id: 'buy', at: 3, quote: 'I ordered a wool scarf', summary: '목도리 주문', date: '10-26', time: '12:00', money: { moves: [{ account: '1111', amount: -20000, who: 'Varo Knits', occurrence: 'new' }], orders: [order('new')] } },
        { id: 'eta', at: 5, quote: 'the scarf from Varo Knits arrives on Thursday', summary: '목도리 도착', date: '10-26', time: '12:10', money: { orders: [order('again')] } }] });
    T.chat.splice(3, 1);
    T.answers.push({ now: '10-26 14:00', events: [] });
    await data.makePhone(c.m, 'Ren', { update: true });
    const r = await data.dropStretch(c.m, c.p, 0);
    assert.deepEqual([r.kept, c.p.money.orders.map(o => o.item)], [['목도리 주문'], ['wool scarf']]);
});

test('a round giving more than 40 events reads the rest\'s messages again, not lost', async () => {
    const chat = [say('Ren', 'start'), say('Mara', 'morning')];
    for (let i = 0; i < 44; i++) chat.push(say(i % 2 ? 'Mara' : 'Ren', `note number ${i} for the list today`));
    const c = setup(chat);
    c.p.sync.limit = 60;
    const events = Array.from({ length: 44 }, (_, i) => ({ id: `n${i}`, at: i + 2, quote: `note number ${i} for`, summary: `Item ${i}`, date: '10-26', time: '12:00', phone: { notes: [{ title: `Item ${i}`, text: `Item ${i}` }] } }));
    await run(c.m, { now: '10-26 13:00', events });
    assert.equal(c.p.notes.length, 40);
    assert.ok(c.p.syncLast.failed.some(f => f.at === 45));
});

test('빼기 of only the later message that moved an order on ("it arrived"): only what it gave goes, the order stays as it was', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'did you get a present for Ivo'), say('Mara', 'I ordered a wool scarf from Varo Knits for 20000 won')]);
    const order = (st, occ) => ({ shop: 'Varo Knits', item: 'wool scarf', price: 20000, status: st, occurrence: occ });
    await run(c.m, { now: '10-26 13:00', events: [{ id: 'scarf', at: 3, quote: 'I ordered a wool scarf', summary: '목도리 주문', date: '10-26', time: '12:00',
        money: { moves: [{ account: '1111', amount: -20000, who: 'Varo Knits', occurrence: 'new' }], orders: [order('ordered', 'new')] } }] });
    T.chat.push(say('Ren', 'any news on it'), say('Mara', 'the wool scarf from Varo Knits just arrived, so soft'));
    await run(c.m, { now: '10-27 18:00', events: [{ id: 'scarf', at: 5, quote: 'the wool scarf from Varo Knits just arrived', summary: '목도리 도착', date: '10-27', time: '18:00',
        phone: { threads: [{ with: 'Mara', messages: [{ from: 'Mara', text: '목도리 왔어!', time: '10-27 18:00' }] }] }, money: { orders: [order('delivered', 'again')] } }] });
    assert.equal(c.p.money.orders[0].status, 'delivered');
    T.chat.splice(5, 1);
    T.answers.push({ now: '10-27 18:10', events: [] });
    await data.makePhone(c.m, 'Ren', { update: true });
    await data.dropStretch(c.m, c.p, 0);
    assert.equal(c.p.money.orders[0].status, 'ordered');
    assert.equal(c.bank(), 80000);
    assert.ok(!c.p.threads.some(t => t.messages.some(x => x.text === '목도리 왔어!')));
    assert.equal(c.p.sync.events.scarf.at, 3);
});

// ---- 점검 2차
test('빼기 of a later message\'s part, then 되돌리기: what was taken off stays off; the order\'s own message taken off later takes it all', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Ren', 'ok'), say('Mara', 'I ordered a lamp for 30000 won'), say('Ren', 'nice'), say('Mara', 'the lamp arrived today')]);
    c.p.sync.limit = 2;
    const order = (status, occurrence) => ({ shop: '램프샵', item: 'Lamp', price: 30000, qty: 1, status, occurrence });
    await run(c.m, { now: '10-26 10:00', events: [{ id: 'lamp', at: 3, quote: 'ordered a lamp', summary: '램프 주문', date: '10-26', time: '09:00', phone: {}, money: { moves: [{ account: '1111', amount: -30000, who: '램프샵', occurrence: 'new' }], orders: [order('ordered', 'new')] } }] });
    await run(c.m, { now: '10-27 10:00', events: [{ id: 'lamp', at: 5, quote: 'lamp arrived', summary: '램프 도착', date: '10-27', time: '09:00', phone: {}, money: { orders: [order('delivered', 'again')] } }] });
    T.chat.push(say('Ren', 'great, enjoy the lamp tonight'));
    await run(c.m, { now: '10-27 10:30', events: [] });
    T.chat.splice(5, 1); T.chat.push(say('Ren', 'what a quiet evening at home'));
    await run(c.m, { now: '10-27 11:00', events: [] });
    await data.dropStretch(c.m, c.p, c.p.sync.dropped[0].key);
    assert.equal(c.p.money.orders[0].status, 'ordered');
    await data.undoRound(c.m, c.p);
    assert.deepEqual(c.p.sync.dropped, []);
    T.chat.splice(3, 1); T.chat.push(say('Ren', 'and a long night'));
    T.answers.push({ now: '10-27 12:00', events: [] });
    await data.makePhone(c.m, 'Ren', { update: true });
    const r = await data.dropStretch(c.m, c.p, c.p.sync.dropped.findIndex(d => d.events.includes('lamp')));
    assert.deepEqual([r.kept, c.p.money.orders.length, c.bank()], [[], 0, 100000]);
});

test('two messages both gone (an order and one telling it again): 빼기 in either order takes the order and its payment', async () => {
    for (const first of ['lamp', 'still']) {
        const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Ren', 'ok'), say('Mara', 'I ordered a lamp for 30000 won'), say('Ren', 'nice'), say('Mara', 'the lamp I ordered is still coming'), say('Ren', 'good night then')]);
        c.p.sync.limit = 2;
        const order = occurrence => ({ shop: '램프샵', item: 'Lamp', price: 30000, qty: 1, status: 'ordered', occurrence });
        await run(c.m, { now: '10-26 10:00', events: [{ id: 'lamp', at: 3, quote: 'ordered a lamp', summary: '램프 주문', date: '10-26', time: '09:00', phone: {}, money: { moves: [{ account: '1111', amount: -30000, who: '램프샵', occurrence: 'new' }], orders: [order('new')] } }] });
        await run(c.m, { now: '10-26 11:00', events: [{ id: 'still', at: 5, quote: 'still coming', summary: '램프 아직', date: '10-26', time: '10:30', phone: {}, money: { orders: [order('again')] } }] });
        T.chat.splice(5, 1); T.chat.splice(3, 1); T.chat.push(say('Ren', 'what a quiet evening at home'));
        T.answers.push({ now: '10-26 12:00', events: [] });
        await data.makePhone(c.m, 'Ren', { update: true });
        const keys = c.p.sync.dropped.map(d => [d.key, d.events]);
        const order2 = [keys.find(([, e]) => e.includes(first)), keys.find(([, e]) => !e.includes(first))];
        for (const [k] of order2) await data.dropStretch(c.m, c.p, k);
        assert.deepEqual([c.p.money.orders.length, c.p.money.tx.length, c.bank()], [0, 0, 100000], first);
    }
});

test('되돌리기 goes back round by round (up to 5): each undo brings the round before up, and all of them back to the start', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'morning')]);
    const was = JSON.stringify({ notes: c.p.notes, threads: c.p.threads, now: c.p.now }), bank0 = c.bank();
    const rounds = [['a note about the lunch', 'Lunch', -9000], ['a note about the taxi ride', 'Taxi', -12000], ['a note about the cinema', 'Cinema', -15000]];
    let k = 2;
    for (const [text, title, amount] of rounds) {
        T.chat.push(say('Ren', text));
        await run(c.m, { now: `10-26 1${k}:00`, events: [{ id: title.toLowerCase(), at: k, quote: text.slice(0, 20), summary: title, date: '10-26', time: `1${k}:00`, phone: { notes: [{ title, text: title }] },
            money: { moves: [{ account: '1111', amount, who: title, kind: 'card', occurrence: 'new' }] } }] });
        k++;
    }
    assert.equal(c.p.notes.length, 3);
    assert.equal(c.p.syncUndos.length, 2);
    for (const left of [2, 1, 0]) {
        assert.ok(data.canUndo(c.p));
        await data.undoRound(c.m, c.p);
        assert.equal(c.p.notes.length, left);
    }
    assert.ok(!data.canUndo(c.p));
    assert.equal(JSON.stringify({ notes: c.p.notes, threads: c.p.threads, now: c.p.now }), was);
    assert.equal(c.bank(), bank0);
});

test('a bank made again stops 되돌리기 there: the rounds before it can\'t be undone', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Ren', 'a note about lunch')]);
    await run(c.m, { now: '10-26 12:00', events: [{ id: 'lunch', at: 2, quote: 'a note about lunch', summary: 'Lunch', date: '10-26', time: '12:00', phone: { notes: [{ title: 'Lunch', text: 'Lunch' }] } }] });
    T.chat.push(say('Ren', 'a note about dinner'));
    await run(c.m, { now: '10-26 19:00', events: [{ id: 'dinner', at: 3, quote: 'a note about dinner', summary: 'Dinner', date: '10-26', time: '19:00', phone: { notes: [{ title: 'Dinner', text: 'Dinner' }] } }] });
    await data.undoRound(c.m, c.p);
    assert.ok(data.canUndo(c.p));
    c.p.money.at = Date.now() + 1;
    assert.ok(!data.canUndo(c.p));
});

test('a text to a name the phone has under another of that person\'s names goes in the thread there, not a new one', async () => {
    const chat = [say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'texting Somang'), say('Mara', 'and Ivo')];
    const c = setup(chat);
    c.p.threads = [{ with: 'Somang Park', messages: [] }, { with: 'Ivo Kim', messages: [] }, { with: 'Ivo Park', messages: [] }];
    c.p.contacts = [{ name: 'Somang Park' }];
    c.p.where = { at: 1, people: [{ name: 'Somang Park', aka: ['소망'], city: 'Seoul', names: ['Seoul'], lives: 'KR', tz: 'Asia/Seoul' }] };
    const ev = (id, at, w, text) => ({ id, at, quote: chat[at].mes, summary: id, date: '10-26', time: '12:00', phone: { threads: [{ with: w, messages: [{ from: 'me', text, time: '10-26 12:00' }] }], contacts: [{ name: w }] } });
    await run(c.m, { now: '10-26 13:00', events: [ev('a', 2, '소망', '안녕'), ev('b', 2, 'Somang', 'hi'), ev('c', 3, 'Ivo', 'hey Ivo')] });
    assert.deepEqual(c.p.threads.map(t => [t.with, t.messages.map(x => x.text)]).sort(),
        [['Ivo', ['hey Ivo']], ['Ivo Kim', []], ['Ivo Park', []], ['Somang Park', ['안녕', 'hi']]].sort());
    assert.deepEqual(c.p.contacts.map(x => x.name).sort(), ['Ivo', 'Somang Park']);
});

// Clock candidates use real parsers/conversion and the same reflection pipeline as the other tests.
function clockPhone(p) {
    p.country = 'DE'; p.year = 2026; p.now = '11-04 23:30';
    p.where = { at: 1, people: [
        { name: 'Ren', city: 'Berlin', tz: 'Europe/Berlin', names: ['Berlin'], aka: ['렌'] },
        { name: 'Mara', city: 'Seoul', tz: 'Asia/Seoul', names: ['Seoul'], aka: ['마라'] }
    ] };
}
test('clock candidates honor date order, aliases, DST and midnight without choosing a screen', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    const rows = [{index: 125, text: '마라 reads Ren’s message: 11.05, 08:30'}];
    const md = await data.reflectionClocks(p, rows, { dateOrder: 'md' });
    assert.equal(md.choices.find(x => x.names[0] === 'Mara').ownerTime, '11-05 00:30');
    assert.equal(md.choices.find(x => x.names[0] === 'Ren').ownerTime, '11-05 08:30');
    const dm = await data.reflectionClocks(p, rows, { dateOrder: 'dm' });
    assert.equal(dm.choices.find(x => x.names[0] === 'Mara').ownerTime, '05-11 01:30');
    const early = await data.reflectionClocks(p, [{index: 3, text:'Mara 11.05, 02:00'}], {dateOrder:'md'});
    assert.equal(early.choices.find(x => x.names[0] === 'Mara').ownerTime, '11-04 18:00');
    assert.match(md.text, /not proof of whose screen/);
    assert.equal((await data.reflectionClocks(p,[{index:2,text:'Mara at 08:30'}],{dateOrder:'md'})).choices.length,0);
    assert.equal((await data.reflectionClocks({owner:'Unknown'},[],{})).choices.length,0);
});
test('elapsed time after the source clock survives reflection, everyday and storage', async () => {
    const c=setup([say('Ren','start'),say('Mara','evening'),say('Mara','Mara reads Ren’s reply on her phone. 11.05, 08:30. Two hours pass.')]);
    clockPhone(c.p); c.m.dateOrder='md'; globalThis.__everydayIn=[];
    const oldVoice=structuredClone(c.p.voice), bankBefore=c.bank();
    await run(c.m,{clock:{basis:'Mara reads on her phone, then two hours pass',screen:{owner:'Mara',time:'11.05, 08:30'},messageSender:'Ren'},now:'11-05 02:30',events:[{id:'reply',at:2,quote:'Mara reads Ren’s reply',date:'11-05',time:'02:30',phone:{notes:[{title:'Reply',text:'Read it',time:'11-05 02:30'}]}}]});
    assert.match(T.input,/On Mara's clock → owner's time: 11-05 00:30/);
    assert.match(T.sys,/CLOCK FIRST/);
    assert.match(T.sys,/Viewpoint: use the default screen viewpoint in OWNER'S CLOCK when set\./);
    assert.match(globalThis.__everydayIn.at(-1),/Owner-local window: 11-04 23:30 to 11-05 02:30/);
    assert.equal(c.p.now,'11-05 02:30'); assert.equal(c.p.notes.at(-1).time,'11-05 02:30');
    assert.deepEqual(c.p.voice,oldVoice); assert.equal(c.bank(),bankBefore);
});
test('same-time scene without a new timestamp keeps the supplied moment', async()=>{
    const c=setup([say('Ren','start'),say('Mara','evening'),say('Ren','Meanwhile in Berlin, Ren sends a reply.')]);
    clockPhone(c.p);c.p.now='11-05 02:30';c.m.dateOrder='md';
    await run(c.m,{clock:{basis:'Meanwhile in Berlin',screen:{owner:'Ren',time:null},messageSender:'Ren'},now:'11-05 02:30',events:[]});
    assert.equal(c.p.now,'11-05 02:30');
});


test('screen default is explicit, chat-local, and independent of active persona or open phone', async () => {
    const m={phones:{ren:{owner:'Ren',where:{people:[{name:'Mara'},{name:'Ivo'}]}}}}, other={};
    const context={name1:'Mara',characterId:0,characters:[{name:'Ren'}]};
    assert.equal(data.screenHolderOf(m),'');
    assert.deepEqual(data.screenHolderChoices(m,context).map(x=>x.name),['Mara','Ren','Ivo']);
    await data.setScreenHolder(m,' Mara ');
    assert.equal(data.screenHolderOf(m),'Mara'); assert.equal(data.screenHolderOf(other),'');
    context.name1='Ivo'; data.screenHolderChoices(m,context);
    assert.equal(data.screenHolderOf(m),'Mara');
    await data.setScreenHolder(m,''); assert.equal(m.phoneScreenHolder,'');
});
test('unnamed default gets clock candidates, while unknown location gets no invented conversion', async () => {
    const p={owner:'Ren'}; clockPhone(p);
    const rows=[{index:125,text:'Ren: 11.05, 08:26. Are you okay?'}];
    const m={dateOrder:'md',phoneScreenHolder:'Mara'};
    const r=await data.reflectionClocks(p,rows,m);
    assert.equal(r.choices.find(x=>x.names[0]==='Mara').ownerTime,'11-05 00:26');
    assert.match(data.clockBlock(p,p.now,m),/Default screen viewpoint: Mara/);
    const unknown={dateOrder:'md',phoneScreenHolder:'Ivo'};
    assert.match(data.clockBlock(p,p.now,unknown),/Default screen viewpoint: Ivo/);
    assert.ok(!(await data.reflectionClocks(p,rows,unknown)).choices.some(x=>x.names[0]==='Ivo'));
    assert.equal(data.clockBlock({owner:'Unknown'},'',m),'[OWNER\'S CLOCK]\nPhone owner: Unknown\nDefault screen viewpoint: Mara');
});
test('default survives undo and reapply without preceding messages or their clock candidates', async () => {
    const c=setup([say('Ren','start'),say('Mara','Mara reads on her own phone. 11.05, 08:24.'),say('Ren','11.05, 08:26. Are you okay?')]);
    clockPhone(c.p); c.m.dateOrder='md'; await data.setScreenHolder(c.m,'Mara');
    const answer={clock:{basis:'Default screen viewpoint',screen:{owner:'Mara',time:'11.05, 08:26'},messageSender:'Ren'},now:'11-05 00:26',events:[{id:'reply',at:2,quote:'Are you okay',date:'11-05',time:'00:26',phone:{notes:[{title:'Reply',text:'Are you okay?',time:'11-05 00:26'}]}}]};
    await run(c.m,answer);
    const first=T.input;
    assert.ok(!first.includes('[SCENE BEFORE]'));
    assert.ok(!first.includes('Mara reads on her own phone'));
    assert.ok(!first.includes('08:24'));
    assert.ok(!T.sys.includes('SCENE BEFORE'));
    assert.ok(!data.everydaySystem().includes('SCENE BEFORE'));
    assert.match(first,/Default screen viewpoint: Mara/);
    assert.match(first,/On Mara's clock → owner's time: 11-05 00:26/);
    await data.undoRound(c.m,c.p);
    assert.equal(c.m.phoneScreenHolder,'Mara'); assert.equal(c.p.notes.length,0);
    await run(c.m,answer);
    assert.equal(c.m.phoneScreenHolder,'Mara'); assert.equal(c.p.notes.length,1);
    assert.equal(c.p.now,'11-05 00:26');
    assert.match(T.input,/Default screen viewpoint: Mara/);
    T.chat.push(say('Ren','A quiet evening continues.'));
    await run(c.m,{now:'11-05 00:30',events:[{id:'past',at:1,quote:'Mara reads on her own phone',date:'11-05',time:'00:24',phone:{notes:[{title:'Wrong background',text:'Not a new event'}]}}]});
    assert.ok(!c.p.notes.some(x=>x.title==='Wrong background'));
});


test('messenger time initializes once from the current persona, including an unavailable persona or explicit unset', async () => {
    const m={}, other={};
    await data.ensureScreenHolder(m,{name1:' Mara '});
    assert.equal(m.phoneScreenHolder,'Mara');
    await data.ensureScreenHolder(m,{name1:'Ivo'}); assert.equal(m.phoneScreenHolder,'Mara');
    await data.setScreenHolder(m,'Ren');
    await data.ensureScreenHolder(m,{name1:'Ivo'}); assert.equal(m.phoneScreenHolder,'Ren');
    await data.setScreenHolder(m,'');
    await data.ensureScreenHolder(m,{name1:'Ivo'}); assert.equal(m.phoneScreenHolder,'');
    await data.ensureScreenHolder(other,{}); assert.equal(other.phoneScreenHolder,'');
    await data.ensureScreenHolder(other,{name1:'Mara'}); assert.equal(other.phoneScreenHolder,'');
    const fresh={}; await data.ensureScreenHolder(fresh,{name1:'Ivo'}); assert.equal(fresh.phoneScreenHolder,'Ivo');
});


test('messenger choices reuse saved place aliases and unique short names, preserving an old selection', async () => {
    const p={owner:'Ren'};clockPhone(p);
    p.where.people[1]={name:'Mara Park',aka:['마라','Mara'],city:'Seoul',tz:'Asia/Seoul'};
    const m={phones:{ren:p},phoneProfiles:{Mara:{}},phoneScreenHolder:'Mara Park',dateOrder:'md'};
    const c={name1:'마라',characterId:0,characters:[{name:'Ren'}]};
    assert.deepEqual(data.screenHolderChoices(m,c).map(x=>x.name),['마라','Ren']);
    assert.equal(data.screenHolderLabel(m,c),'마라');
    assert.equal(m.phoneScreenHolder,'Mara Park');
    m.phoneScreenHolder='마라';
    const result=await data.reflectionClocks(p,[{index:2,text:'Ren: 11.05, 08:26'}],m);
    assert.equal(result.choices.find(x=>x.names[0]==='Mara Park').ownerTime,'11-05 00:26');
});
test('messenger choices do not combine two people with the same first name', () => {
    const m={phones:{ren:{owner:'Ren',where:{people:[{name:'Mara Park',city:'Seoul',tz:'Asia/Seoul'},{name:'Mara Kim',city:'Berlin',tz:'Europe/Berlin'}]}}}};
    assert.deepEqual(data.screenHolderChoices(m,{name1:'Mara'}).map(x=>x.name),['Mara','Ren','Mara Park','Mara Kim']);
});


test('clock display uses the selected alias without changing model data or other scene owners', () => {
    const m={phoneScreenHolder:'마라',phones:{ren:{owner:'Ren',where:{people:[{name:'Mara Park',aka:['마라','Mara'],city:'Seoul'},{name:'Ren',city:'Berlin'}]}}}};
    const c={name1:'마라'},raw={basis:'Default used',screen:{owner:'Mara Park',time:'11.05, 11:38'},messageSender:'Ren'};
    const before=structuredClone(raw),shown=data.clockForDisplay(raw,m,c);
    assert.equal(shown.screen.owner,'마라');assert.equal(shown.screen.time,raw.screen.time);
    assert.equal(shown.messageSender,'Ren');assert.equal(shown.basis,raw.basis);assert.deepEqual(raw,before);
    const switched={...raw,screen:{owner:'Ren',time:'11.05, 03:38'}};
    assert.equal(data.clockForDisplay(switched,m,c),switched);
    assert.equal(data.clockForDisplay(raw,{...m,phoneScreenHolder:''},c),raw);
    assert.equal(data.clockForDisplay(null,m,c),null);
    m.phones.ren.where.people.push({name:'Mara Kim',city:'Berlin'});
    m.phones.ren.where.people[0].aka=['마라'];
    const ambiguous={...raw,screen:{owner:'Mara',time:'11.05, 11:38'}};
    assert.equal(data.clockForDisplay(ambiguous,m,c),ambiguous);
});

test('same source clock resolves for either phone owner, with no extra conversion on the default owner phone',async()=>{
 const people=[{name:'Mara',aka:['Mara Park'],city:'Seoul',tz:'Asia/Seoul'},{name:'Ren',city:'Frankfurt',tz:'Europe/Berlin'}];
 const mara={owner:'Mara',year:2026,now:'11-05 11:00',where:{people}},ren={...structuredClone(mara),owner:'Ren',now:'11-05 03:00'};
 const m={dateOrder:'md',phoneScreenHolder:'Mara',phones:{mara,ren}};
 const rows=[{index:155,text:'Ren: 11.05, 11:38'}];
 const a=await data.reflectionClocks(mara,rows,m),b=await data.reflectionClocks(ren,rows,m);
 const from=(r,n)=>r.choices.find(c=>c.names.includes(n)).ownerTime;
 assert.equal(from(a,'Mara'),'11-05 11:38');assert.equal(from(b,'Mara'),'11-05 03:38');
 assert.equal(from(a,'Ren'),'11-05 19:38');assert.equal(from(b,'Ren'),'11-05 11:38');
 assert.match(a.text,/Phone being updated: "Mara" \(Seoul\)/);
 assert.match(a.text,/default screen times need no conversion/);
 assert.doesNotMatch(b.text,/default screen times need no conversion/);
 const absent=await data.reflectionClocks(mara,[{index:156,text:'A quiet moment.'}],m);
 assert.equal(absent.choices.length,0);assert.match(absent.text,/default screen times need no conversion/);
 assert.equal(from(await data.reflectionClocks(mara,rows,{...m,phoneScreenHolder:'Mara Park'}),'Mara'),'11-05 11:38');
});

test('reflection fallback uses the same OWNER\'S CLOCK labels without changing its candidate text', async () => {
    const p = { owner: 'Ren', year: 2026, country: 'KR', now: '11-05 11:00' };
    const m = { dateOrder: 'md', phoneScreenHolder: '', phones: { ren: p } };
    const rows = [{ index: 2, text: 'Ren: 11.05 11:38' }];
    assert.equal(data.clockBlock(p, p.now, m), '');
    const r = await data.reflectionClocks(p, rows, m);
    assert.equal(r.text, `Phone being updated: "Ren" (South Korea).
[OWNER'S CLOCK]
Phone owner: Ren
Location: South Korea
Saved phone time: 11-05 11:00
Time choices (not proof of whose screen, or which time is now). Date order: month.day.
Time text in #2: "11.05 11:38"
On Ren's clock → owner's time: 11-05 11:38`);
    assert.equal(r.choices[0].ownerTime, '11-05 11:38');
    assert.doesNotMatch(r.text, /Default screen viewpoint:|Time differences from|The owner is in/);
    delete p.now;
    const unknown = await data.reflectionClocks(p, rows, m);
    assert.match(unknown.text, /Saved phone time: unknown\nTime choices/);
    assert.deepEqual(unknown.choices, r.choices);
    assert.equal(unknown.text.split('Time choices')[1], r.text.split('Time choices')[1]);
    delete p.country;
    assert.deepEqual(await data.reflectionClocks(p, rows, m), { choices: [], text: '' });
});

test('reflection sends the matching owner identity and choices for both phones without rewriting model now',async()=>{
 for (const owner of ['Mara','Ren']) {
  const c=setup([say('Ren','Start'),say('Mara','Morning'),say('Ren','11.05, 11:38 Are you okay?')]);
  c.p.owner=owner;c.p.year=2026;c.p.now=owner==='Mara'?'11-05 11:00':'11-05 03:00';
  c.p.where={at:1,people:[{name:'Mara',city:'Seoul',names:['Seoul'],local:'Seoul',tz:'Asia/Seoul'},{name:'Ren',city:'Frankfurt',names:['Frankfurt'],local:'Frankfurt',tz:'Europe/Berlin'}]};
  delete c.p.money;delete c.m.finance;c.m.phones={[owner.toLowerCase()]:c.p};c.m.dateOrder='md';c.m.phoneScreenHolder='Mara';
  const now=owner==='Mara'?'11-05 11:38':'11-05 03:38';
  T.answers.push({clock:{basis:'Default used',screen:{owner:'Mara',time:'11.05, 11:38'},messageSender:'Ren'},now,events:[{id:'reply',at:2,quote:'Are you okay',date:'11-05',time:now.slice(6),phone:{notes:[{title:'Reply',text:'Are you okay?',time:now}]}}]});
  await data.makePhone(c.m,owner,{update:true});
  assert.match(T.input,new RegExp('Phone being updated: "'+owner+'"'));
  assert.ok(T.input.includes("On Mara's clock → owner's time: "+now));
  assert.match(T.sys,/without converting it again/);
  assert.equal(c.p.now,now);assert.equal(c.p.notes[0].time,now);
 }
});


test('reflection clock spans retain meridiem and accepted dated formats verbatim', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    const samples = [
        ['11.05, 8:30 PM', '11-05 20:30', '11-05 12:30'],
        ['11.05, 12:30 AM', '11-05 00:30', '11-04 16:30'],
        ['11.05 8:30 오후', '11-05 20:30', '11-05 12:30'],
        ['11.05 12:30 오전', '11-05 00:30', '11-04 16:30'],
        ['11.05 PM 8:30', '11-05 20:30', '11-05 12:30'],
        ['11.05 AM 12:30', '11-05 00:30', '11-04 16:30'],
        ['November 5, 2026 08:30', '11-05 08:30', '11-05 00:30'],
        ['2026-11-05T08:30', '11-05 08:30', '11-05 00:30'],
        ['11월 5일 08:30', '11-05 08:30', '11-05 00:30'],
        ['2026년 11월 5일 오후 8:30', '11-05 20:30', '11-05 12:30'],
        ['5. November 2026 08:30', '11-05 08:30', '11-05 00:30'],
    ];
    for (const [sourceTime, local, ownerTime] of samples) {
        const rows = [{ index: 2, text: `Mara: ${sourceTime}. Then the scene continues.` }];
        const before = structuredClone(rows);
        const result = await data.reflectionClocks(p, rows, { dateOrder: 'md' });
        const choice = result.choices.find(x => x.names[0] === 'Mara');
        assert.equal(choice?.sourceTime, sourceTime);
        assert.equal(choice.local, local);
        assert.equal(choice.ownerTime, ownerTime);
        assert.deepEqual(rows, before);
        assert.ok(result.text.includes(JSON.stringify(sourceTime)));
    }
});
test('reflection uses a trailing numeric year for the actual DST transition date', async () => {
    const p = { owner: 'Ren' }; clockPhone(p); // 2026 fallback must not replace explicit 2024.
    const result = await data.reflectionClocks(p, [{ index: 2, text: 'Mara: 31.03.2024 01:30' }], { dateOrder: 'dm' });
    assert.equal(result.choices.find(x => x.names[0] === 'Mara').ownerTime, '03-30 17:30');
});
test('reflection keeps the full PM source but converts only the latest source', async () => {
    const raw = 'Mara reads Ren’s reply on her phone. 11.05, 8:30 PM. Two hours pass.';
    const c = setup([say('Ren', 'start'), say('Mara', 'evening'), say('Mara', raw)]);
    clockPhone(c.p); c.m.dateOrder = 'md';
    await run(c.m, { clock: { basis: 'Mara reads, then two hours pass', screen: { owner: 'Mara', time: '11.05, 8:30 PM' } }, now: '11-05 14:30', events: [] });
    assert.ok(T.input.includes(raw));
    assert.match(T.input, /On Mara's clock → owner's time: 11-05 12:30/);
    assert.equal(c.p.now, '11-05 14:30');
    const rows = Array.from({ length: 14 }, (_, i) => ({ index: i, text: `Mara: November 5, 2026 ${String(i).padStart(2, '0')}:30` }));
    const result = await data.reflectionClocks(c.p, rows, c.m);
    assert.equal(result.choices.filter(x => x.names[0] === 'Mara').length, 1);
    assert.ok(result.choices.every(x => x.at === 13));
});

test('reflection offers no converted choices for malformed twelve-hour clocks', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    for (const clock of ['13:30 PM', '0:30 PM', 'PM 13:30', 'AM 0:30', '13:30 오후', '0:30 오전', '오후 13:30', '오전 0:30']) {
        const result = await data.reflectionClocks(p, [{ index: 2, text: `Mara: 11.05 ${clock}` }], { dateOrder: 'md' });
        assert.deepEqual(result.choices, [], clock);
    }
});

const { htmlClocks } = await import('../src/phoneparse.js');
const extractSrc = await readFile(new URL('../src/extract.js', import.meta.url), 'utf8');
const { cleanMessage } = await import(encoded(extractSrc.slice(extractSrc.indexOf('const REASONING ='), extractSrc.indexOf('export function formatExtract'))));
const htmlRow = (index, raw) => ({ index, text: cleanMessage(raw, { stripTags: true }), clockSource: raw });
test('bare HTML clocks supply date-free conditional reference information, not a dated answer', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    const row = htmlRow(2, 'Mara reads her phone. <div class="chat-timestamp">08:30</div>');
    const result = await data.reflectionClocks(p, [row], { phoneScreenHolder: 'Mara' });
    const choice = result.choices.find(c => c.names[0] === 'Mara');
    assert.equal(choice.date, null);
    assert.equal(choice.ownerTime, undefined);
    assert.equal(choice.local, undefined);
    assert.equal(choice.reference.ownerClock, '00:30');
    assert.equal(choice.reference.date, '2026-11-05');
    assert.match(result.text, /\(HTML time field\)\nNo date is shown; read the story to determine the date\./);
    assert.doesNotMatch(result.text, /calendar date unknown|\(reference/);
    assert.match(result.text, /On Mara's clock → owner's clock: 00:30\./);
    assert.doesNotMatch(result.text, /saved local|same-day|next-day|Reference date|Reference calculation only|If the story shows a time jump/);
    assert.doesNotMatch(result.text, /On Mara's clock → owner's time:/);
});
test('concise bare choices retain saved time, offsets, date order and candidates for earlier, equal and later clocks', async () => {
    const p = { owner: 'Ren' }; clockPhone(p); p.now = '11-05 00:30';
    const m = { phoneScreenHolder: 'Mara', dateOrder: 'dm' };
    for (const [clock, ownerClock, referenceDate, earlier] of [
        ['06:12', '22:12', '2026-11-06', true],
        ['08:30', '00:30', '2026-11-05', false],
        ['12:13', '04:13', '2026-11-05', false],
    ]) {
        const result = await data.reflectionClocks(p, [htmlRow(2, `Mara <time>${clock}</time>`)], m);
        assert.deepEqual(result.choices, [{ at: 2, sourceTime: clock, clock, names: ['Mara', '마라'], date: null,
            reference: { date: referenceDate, ownerClock, dayShift: earlier ? -1 : 0, localAnchor: '2026-11-05 08:30', earlier } }]);
        assert.equal([data.clockBlock(p, p.now, m), result.text].join('\n'), `[OWNER'S CLOCK]
Phone owner: Ren
Location: Berlin
Saved phone time: 11-05 00:30
Default screen viewpoint: Mara
Time differences from Berlin:
- Mara (Seoul): +8 hours
Phone being updated: "Ren" (Berlin).
Time choices (not proof of whose screen, or which time is now). Date order: day.month.
Time text in #2: "${clock}" (HTML time field)
No date is shown; read the story to determine the date.
On Mara's clock → owner's clock: ${ownerClock}${earlier ? ' (-1 day relative to screen)' : ''}.`);
        assert.equal(p.now, '11-05 00:30');
    }
});
test('concise bare references retain nonzero timezone day shifts without assigning a story date', async () => {
    for (const [ownerTz, ownerCity, screenTz, screenCity, now, clock, ownerClock, shift] of [
        ['Asia/Seoul', 'Seoul', 'Europe/Berlin', 'Berlin', '11-05 00:10', '16:30', '00:30', 1],
        ['Europe/Berlin', 'Berlin', 'Asia/Seoul', 'Seoul', '11-05 00:10', '06:30', '22:30', -1],
    ]) {
        const p = { owner: 'Ren', year: 2026, now, where: { at: 1, people: [
            { name: 'Ren', city: ownerCity, tz: ownerTz }, { name: 'Mara', city: screenCity, tz: screenTz },
        ] } };
        const result = await data.reflectionClocks(p, [htmlRow(2, `Mara <time>${clock}</time>`)], { phoneScreenHolder: 'Mara' });
        const [choice] = result.choices;
        assert.equal(choice.reference.dayShift, shift);
        assert.equal(choice.date, null);
        assert.equal(choice.ownerTime, undefined);
        assert.ok(result.text.endsWith(`On Mara's clock → owner's clock: ${ownerClock} (${shift > 0 ? '+' : ''}${shift} day relative to screen).`));
        assert.doesNotMatch(result.text, /\(reference|saved local|Reference date|same-day|next-day|0 days/);
    }
});
test('concise bare references still use DST at the calculated instant and omit gaps and folds', async () => {
    const p = { owner: 'Ren', year: 2026, where: { at: 1, people: [
        { name: 'Ren', city: 'Seoul', tz: 'Asia/Seoul' }, { name: 'Mara', city: 'Berlin', tz: 'Europe/Berlin' },
    ] } };
    for (const [now, ownerClock, savedOffset] of [
        ['03-29 06:30', '10:30', 8], ['10-25 06:30', '11:30', 7],
    ]) {
        p.now = now;
        const m = { phoneScreenHolder: 'Mara' };
        const result = await data.reflectionClocks(p, [htmlRow(2, 'Mara <time>03:30</time>')], m);
        assert.ok(data.clockBlock(p, p.now, m).includes(`-${savedOffset} hours`));
        assert.equal(result.choices[0].reference.ownerClock, ownerClock);
        assert.ok(result.text.endsWith(`On Mara's clock → owner's clock: ${ownerClock}.`));
        const ambiguous = await data.reflectionClocks(p, [htmlRow(2, 'Mara <time>02:30</time>')], m);
        assert.deepEqual(ambiguous.choices, []);
        assert.doesNotMatch(ambiguous.text, /Time text|owner's clock:/);
    }
});
test('a story jump across DST keeps the model date and time instead of pinning them to a bare reference', async () => {
    const raw = 'Several months later, in July. Mara reads <time>12:13</time>.';
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Mara', raw)]);
    clockPhone(c.p); c.p.now = '03-01 00:30'; c.m.phoneScreenHolder = 'Mara';
    const saved = c.p.now;
    T.clean = mes => cleanMessage(mes, { stripTags: true });
    // A canned answer checks request/output preservation, not an actual model's inference.
    try { await run(c.m, { now: '07-05 05:13', clock: { basis: 'Several months later, in July', screen: { owner: 'Mara', time: '12:13' } }, events: [] }); }
    finally { delete T.clean; }
    assert.ok(T.input.includes(`Location: Berlin\nSaved phone time: ${saved}`));
    assert.match(T.input, /On Mara's clock → owner's clock: 04:13\./);
    assert.match(T.input, /No date is shown; read the story to determine the date\./);
    assert.doesNotMatch(T.sys, /No date is shown; read the story to determine the date\./);
    assert.ok(T.input.includes(cleanMessage(raw, { stripTags: true })));
    assert.equal(c.p.now, '07-05 05:13');
    assert.equal(c.p.year, 2026);
});
test('dated HTML remains on the old path and cannot receive a duplicate bare hint', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    for (const raw of ['Mara <div class="chat-timestamp" style="font-size:12px;line-height:1;gap:0;">11.05, 11:38</div>',
        'Mara <span>11.05, </span><span class="chat-timestamp">11:38</span>']) {
        const result = await data.reflectionClocks(p, [htmlRow(2, raw)], {});
        assert.equal(result.choices.length, 2);
        assert.ok(result.choices.every(c => c.ownerTime && !c.reference));
        assert.doesNotMatch(result.text, /calendar date unknown|No date is shown/);
    }
});
test('an unusable latest bare source does not resurrect earlier dated choices', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    const rows = [htmlRow(1, 'Mara 11.05 08:30'), ...Array.from({ length: 15 }, (_, i) => htmlRow(i + 2, 'Mara <span class="time">09:00</span>'))];
    for (const bad of [{ ...p, year: undefined }, { ...p, now: '08:30' }, { ...p, noYear: true }]) {
        const r = await data.reflectionClocks(bad, rows, {});
        assert.equal(r.choices.length, 0);
        assert.doesNotMatch(r.text, /Time text in #/);
    }
    const plain = await data.reflectionClocks(p, [htmlRow(2, 'Mara ratio 12:30; video 12:30; <div style="--time:0">12:30</div>')], {});
    assert.equal(plain.choices.length, 0);
});
test('only the latest source generates alternatives, retaining the existing six-person bound', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    for (let i = 0; i < 8; i++) p.where.people.push({ name: `Person${i}`, city: 'Paris', tz: 'Europe/Paris' });
    const names = p.where.people.map(x => x.name).join(' ');
    const rows = Array.from({ length: 16 }, (_, i) => htmlRow(i, `${names} ${i % 2 ? '<time>08:30</time>' : '11.05 08:30'}`));
    const r = await data.reflectionClocks(p, rows, {});
    assert.equal(r.choices.length, 6);
    assert.ok(r.choices.every(x => x.at === 15));
});
test('real cleaned input retains vague months/days narrative and model dates are not pinned to references', async () => {
    // Stub answers intentionally choose dates not specified by "several". This tests preservation, not model inference.
    for (const [words, clock, answer, expectedYear, referenceDate] of [
        ['몇 달 뒤', '12:13', '02-05 12:13', 2027, '2026-11-05'],
        ['며칠 뒤', '05:21', '11-09 05:21', 2026, '2026-11-06'],
        ['하루가 지났다. 아침이 됐다.', '06:27', '11-06 06:27', 2026, '2026-11-06'],
    ]) {
        const raw = `${words}. Ren checks the current messenger screen. <div class="chat-timestamp">${clock}</div>`;
        const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Ren', raw)]);
        c.p.now = '11-05 08:12'; c.p.year = 2026; c.p.country = 'KR';
        c.p.where = { at: 1, people: [{ name: 'Ren', city: 'Seoul', tz: 'Asia/Seoul', names: ['Seoul'] }] };
        T.clean = mes => cleanMessage(mes, { stripTags: true });
        try { await run(c.m, { now: answer, clock: { basis: words, screen: { owner: 'Ren', time: clock } }, events: [] }); }
        finally { delete T.clean; }
        assert.equal(c.p.now, answer);
        assert.equal(c.p.year, expectedYear);
        assert.ok(T.input.includes(words));
        assert.match(T.input, /\(HTML time field\)\nNo date is shown; read the story to determine the date\./);
        assert.ok(T.input.includes(`On Ren's clock → owner's clock: ${clock}.`));
        assert.doesNotMatch(T.input, /saved local|same-day|next-day|Reference date|Reference calculation only|If the story shows a time jump/);
        const { choices: [choice] } = await data.reflectionClocks({ ...c.p, now: '11-05 08:12', year: 2026 }, [htmlRow(2, raw)], c.m);
        assert.equal(choice.reference.date, referenceDate);
        assert.equal(choice.date, null);
        const body = T.input.split('[NEW MESSAGES]\n')[1].split('\n\n[')[0];
        assert.ok(body.includes(cleanMessage(raw, { stripTags: true })));
        assert.doesNotMatch(body, /<div|style=/);
        assert.ok(body.includes(`chat-timestamp: ${clock}`));
    }
});
test('bare hints never set now themselves, and recent backwards model results keep the existing guard', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Ren', '<time>06:27</time>')]);
    c.p.now = '11-05 08:12'; c.p.year = 2026; c.p.country = 'KR';
    c.p.where = { at: 1, people: [{ name: 'Ren', city: 'Seoul', tz: 'Asia/Seoul', names: ['Seoul'] }] };
    await run(c.m, { now: '11-05 06:27', events: [] });
    assert.match(T.input, /On Ren's clock → owner's clock: 06:27\./);
    assert.doesNotMatch(T.input, /same-day|next-day|Reference date/);
    assert.equal(c.p.now, '11-05 08:12');
});
test('a separate dated clock does not hide a present bare clock with the same HH:mm', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    const raw = 'Mara recalls last month: 10.05 08:30. Three days later in the present she reads <time>08:30</time>.';
    const r = await data.reflectionClocks(p, [htmlRow(2, raw)], {});
    assert.ok(!r.choices.some(c => c.sourceTime === '10.05 08:30'));
    assert.ok(r.choices.some(c => c.sourceTime === '08:30' && c.date === null && c.reference));
});
test('source position decides between dated and bare clocks within one message', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    const bare = Array.from({ length: 12 }, (_, i) => `<time>${String(i).padStart(2, '0')}:00</time>`).join(' ');
    for (const raw of [`Mara ${bare} 11.05 23:59`, `Mara 11.05 23:59 ${bare}`]) {
        const r = await data.reflectionClocks(p, [htmlRow(2, raw)], {});
        assert.equal(r.choices.length, 2);
        const datedLast = raw.endsWith('11.05 23:59');
        assert.ok(r.choices.every(c => datedLast ? c.sourceTime === '11.05 23:59' && c.ownerTime : c.sourceTime === '11:00' && c.reference));
    }
});
test('HTML snapshots only come from this visible round, never another or hidden message', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), { ...say('Ren', '<time>08:31</time>'), is_system: true }, say('Ren', 'hello')]);
    clockPhone(c.p);
    await run(c.m, { now: c.p.now, events: [] });
    assert.doesNotMatch(T.input, /HTML time field/);
    T.chat.push(say('Ren', '<time>22:22</time>'));
    const r = await data.reflectionClocks(c.p, [{ index: 3, text: 'hello' }], c.m);
    assert.equal(r.choices.length, 0);
});
test('raw HTML metadata is captured with the cleaned round before awaited preparation', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Ren', '<time>08:30</time>')]);
    c.p.now = '11-05 08:12'; c.p.year = 2026; c.p.country = 'KR';
    T.clean = mes => cleanMessage(mes, { stripTags: true });
    T.beforeWhere = () => { T.chat[2].mes = '<time>20:00</time>'; };
    try { await assert.rejects(run(c.m, { now: '11-05 08:30', events: [] }), /대화가 바뀌었어요/); }
    finally { delete T.beforeWhere; delete T.clean; }
    assert.match(T.input, /Time text in #2: "08:30"/);
    assert.doesNotMatch(T.input, /Time text in #2: "20:00"/);
    assert.equal(c.p.now, '11-05 08:12');
});

test('configured screen holder still allows other people for the latest dated source', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    const m = { phoneScreenHolder: 'Mara', dateOrder: 'md', phones: { ren: p } };
    const rows = [htmlRow(1, 'Mara <span class="time">08:30</span>'),
        ...Array.from({ length: 4 }, (_, i) => htmlRow(i + 2, `Mara 11.05 ${String(i + 9).padStart(2, '0')}:00`))];
    const result = await data.reflectionClocks(p, rows, m);
    assert.deepEqual([...new Set(result.choices.map(c => c.at))], [5]);
    assert.deepEqual(result.choices.map(c => c.names[0]), ['Mara', 'Ren']);
    assert.equal(result.choices.length, 2);
    assert.ok(result.choices.every(c => c.ownerTime && !c.reference));
    const block = [data.clockBlock(p, p.now, m), result.text].filter(Boolean).join('\n');
    assert.equal((block.match(/\[OWNER'S CLOCK\]/g) || []).length, 1);
    assert.equal((block.match(/Time text in #/g) || []).length, 1);
});

test('bare screen references resolve aliases and do not substitute an unknown configured holder', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    const row = htmlRow(1, 'Mara 11.05 09:00 <time>08:30</time>');
    for (const holder of ['Mara', '마라']) {
        const result = await data.reflectionClocks(p, [row], { phoneScreenHolder: holder, phones: { ren: p } });
        assert.deepEqual(result.choices.filter(c => c.reference).map(c => c.names[0]), ['Mara']);
        assert.equal(result.choices.filter(c => c.ownerTime).length, 0);
    }
    const unknown = await data.reflectionClocks(p, [row], { phoneScreenHolder: 'Unknown', phones: { ren: p } });
    assert.equal(unknown.choices.filter(c => c.reference).length, 0);
    assert.equal(unknown.choices.filter(c => c.ownerTime).length, 0);
    const unset = await data.reflectionClocks(p, [row], { phoneScreenHolder: '', phones: { ren: p } });
    assert.equal(unset.choices.filter(c => c.reference).length, 2);
});

test('configured bare references use just the latest occurrence in the latest source message', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    const m = { phoneScreenHolder: 'Mara', phones: { ren: p } };
    const rows = Array.from({ length: 16 }, (_, i) => htmlRow(i, 'Mara <time>08:30</time><time>08:30</time>'));
    const result = await data.reflectionClocks(p, rows, m);
    assert.equal(result.choices.length, 1);
    assert.deepEqual(result.choices.map(c => c.at), [15]);
    assert.ok(result.choices.every(c => c.names[0] === 'Mara' && c.date === null));
});

test('configured screen references retain DST conversion and leave inferred elapsed days untouched', async () => {
    for (const [now, clock, ownerClock] of [['07-04 23:30', '08:30', '01:30'], ['11-04 23:30', '08:30', '00:30']]) {
        const p = { owner: 'Ren' }; clockPhone(p); p.now = now;
        const result = await data.reflectionClocks(p, [htmlRow(2, `Mara <time>${clock}</time>`)], { phoneScreenHolder: 'Mara', phones: { ren: p } });
        assert.equal(result.choices.length, 1);
        assert.equal(result.choices[0].reference.ownerClock, ownerClock);
    }
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Ren', 'Several days later. Mara reads <time>08:30</time>.')]);
    clockPhone(c.p); c.m.phoneScreenHolder = 'Mara';
    await run(c.m, { now: '11-09 00:30', clock: { basis: 'Several days later', screen: { owner: 'Mara', time: '08:30' } }, events: [] });
    assert.equal(c.p.now, '11-09 00:30');
    assert.match(T.input, /On Mara's clock → owner's clock: 00:30\./);
    assert.doesNotMatch(T.input, /On Ren's clock → owner's clock:/);
    assert.match(T.input, /Several days later/);
});

test('reflection keeps cleaned story and adds concise structural HTML time labels, with fixed prompts unchanged', async () => {
    const raw = '<div class="chat-timestamp" style="font-size:12px;color:red;">11.03, 11:03</div>\nMara opens a ticket.\n```html\n<!DOCTYPE html><html><head><style>.status-bar { color: red; }</style></head><body><div class="status-bar"><span>03:03 CET</span><span>50%</span></div><div class="ticket"><span class="reservation-time">18:30</span></div></body></html>\n```\nSeveral days later, the story continues.';
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Ren', raw)]);
    clockPhone(c.p); c.m.phoneScreenHolder = 'Mara';
    T.clean = mes => cleanMessage(mes, { stripTags: true });
    try { await run(c.m, { now: '11-09 08:30', events: [] }); }
    finally { delete T.clean; }
    const body = T.input.split('[NEW MESSAGES]\n')[1].split('\n\n[')[0];
    assert.ok(body.includes(cleanMessage(raw, { stripTags: true })));
    assert.match(body, /\[바깥 메시지의 HTML\]\nchat-timestamp: 11\.03, 11:03/);
    assert.match(body, /\[메시지 안쪽 HTML \(코드 블록 1\)\]\nstatus-bar: 03:03 CET\nreservation-time: 18:30/);
    assert.match(body, /Several days later, the story continues/);
    assert.doesNotMatch(body, /color:red|color: red|font-size|class=|<html|<div/);
    assert.doesNotMatch(T.input, /Timestamp in #/);
    assert.equal(c.p.now, '11-09 08:30');
});

test('the money reflection stage retains compact HTML labels on its selected source messages', async () => {
    const raw = 'I bought the book for 15000 won. <span class="reservation-time">11.03, 18:30</span>';
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Mara', raw)]);
    T.clean = mes => cleanMessage(mes, { stripTags: true });
    try { await run(c.m, { now: '11-03 19:00', events: [book(2, 'bought the book', [], 'new')] }); }
    finally { delete T.clean; }
    assert.match(T.moneyInput, /\[메시지의 HTML\]\nreservation-time: 11\.03, 18:30/);
    assert.doesNotMatch(T.moneyInput, /class=/);
    assert.equal(c.bank(), 85000);
});


test('core and money input share HTML labels even when only a class changes during the core await', async () => {
    const raw = 'I bought the book for 15000 won. <span class="reservation-time">11.03, 18:30</span>';
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Mara', raw)]);
    T.clean = mes => cleanMessage(mes, { stripTags: true });
    T.beforeCore = () => { T.chat[2].mes = raw.replace('reservation-time', 'status-bar'); };
    try { await run(c.m, { now: '11-03 19:00', events: [book(2, 'bought the book', [], 'new')] }); }
    finally { delete T.clean; delete T.beforeCore; }
    assert.match(T.input, /reservation-time: 11\.03, 18:30/);
    assert.match(T.moneyInput, /reservation-time: 11\.03, 18:30/);
    assert.doesNotMatch(T.moneyInput, /status-bar/);
});

for (let repeat = 1; repeat <= 5; repeat++) {
    test(`latest-source five-message request preserves saved 03:38 and every message, repeat ${repeat}`, async () => {
        const clocks = ['04:52', '06:34', '07:29', '08:36', '12:27'];
        for (const format of ['dated HTML', 'bare HTML', 'status', 'narrative']) {
            const raw = clocks.map((clock, i) => {
                const stamp = format === 'dated HTML' ? `<div class="chat-timestamp">11.05, ${clock}</div>`
                    : format === 'bare HTML' ? `<time>${clock}</time>`
                    : format === 'status' ? `【11.05 ${clock}｜Seoul｜Clear】` : `On November 5, 2026 ${clock}, Mara reads her phone.`;
                return `Mara: message ${i + 1} begins.\n${stamp}\nThe whole story for message ${i + 1} remains here.`;
            });
            const c = setup([say('Ren', 'start'), say('Mara', 'before reflection'), ...raw.map(x => say('Mara', x))]);
            clockPhone(c.p); c.p.now = '11-05 03:38'; c.m.dateOrder = 'md'; c.m.phoneScreenHolder = 'Mara';
            const before = structuredClone(c.p), rows = raw.map((x, i) => htmlRow(i + 2, x));
            const choices = await data.reflectionClocks(c.p, rows, c.m);
            assert.deepEqual(c.p, before, format);
            assert.ok(choices.choices.every(x => x.at === 6 && x.sourceTime.includes('12:27')), format);
            assert.equal(choices.choices.length, format === 'bare HTML' ? 1 : 2, format);
            assert.equal((choices.text.match(/Time text in #/g) || []).length, 1);
            for (const earlier of clocks.slice(0, -1)) assert.ok(!choices.text.includes(earlier), format);
            T.clean = mes => cleanMessage(mes, { stripTags: true });
            T.beforeCore = () => assert.equal(c.p.now, '11-05 03:38', 'saved clock must not be replaced before the model sees the request');
            try { await run(c.m, { now: '11-05 04:27', events: [] }); }
            finally { delete T.clean; delete T.beforeCore; }
            const body = T.input.split('[NEW MESSAGES]\n')[1];
            let previous = -1;
            for (const source of raw) {
                const cleaned = cleanMessage(source, { stripTags: true }), at = body.indexOf(cleaned);
                assert.ok(at > previous, `${format}: entire message remains in order`);
                previous = at;
            }
            assert.match(T.input, /Saved phone time: 11-05 03:38/);
            assert.equal((T.input.match(/Time text in #/g) || []).length, 1);
            assert.match(T.input, /Time text in #6:/);
            assert.match(globalThis.__everydayIn.at(-1), /Owner-local window: 11-05 03:38 to 11-05 04:27/);
            assert.equal(c.p.now, '11-05 04:27');
            assert.deepEqual(c.p.voice, before.voice);
            assert.equal(c.bank(), 100000);
        }
    });
}

test('mixed sources use actual original positions, including duplicate text, markup and omitted content', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    const huge = 'x'.repeat(2000);
    const cases = [
        ['Mara <time>08:30</time> 11.05 09:00 <time>08:30</time>', '08:30', true],
        ['Mara 11.05 08:30 <time>09:00</time> 11.05 08:30', '11.05 08:30', false],
        [`Mara <time title="${huge}">23:59</time> 11.05 01:00`, '11.05 01:00', false],
        ['Mara <time>23:59</time> <span>11</span>.05&nbsp;<b>01:00</b>', '11.05 01:00', false],
        [`<think>${huge} 11.05 23:59</think>Mara 11.05 09:00 <time>08&#58;30</time>`, '08:30', true],
        [`${huge}</think>Mara <time>08:30</time> 11.05 09:00`, '11.05 09:00', false],
        ['```html\n<time>23:59</time>\n```\nMara 11.05 09:00 <time>08:30</time>', '08:30', true],
        ['Mara <time>08:30</time>\n```html\n<span class="time">11.05 09:00</span>\n```', '11.05 09:00', false],
        ['Mara 11.05 09:00 <time>08:30</time> <time>08`not a clock`:59</time>', '08:30', true],
        ['Mara <span class="time">PM <span class="time">8:30</span></span> 11.05 09:00', '11.05 09:00', false],
        ['Mara 11.05 09:00 <span class="time">PM <span class="time">8:30</span></span>', 'PM 8:30', true],
    ];
    for (const [raw, expected, bare] of cases) {
        const result = await data.reflectionClocks(p, [htmlRow(2, raw)], { dateOrder: 'md' });
        assert.equal(result.choices.length, 2, raw.slice(-100));
        assert.ok(result.choices.every(c => c.sourceTime === expected && !!c.reference === bare), raw.slice(-100));
    }
});

test('source chronology is neither numeric clock order nor proof of narrative now', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    const rows = [htmlRow(9, 'Mara remembers 10.05 01:00. Several months later, the present continues.'),
        htmlRow(2, 'Mara 11.05 23:59'), htmlRow(10, 'No timestamp in this message.')];
    const r = await data.reflectionClocks(p, rows, { dateOrder: 'md' });
    assert.ok(r.choices.every(c => c.at === 9 && c.sourceTime === '10.05 01:00'));
    assert.match(r.text, /not proof of whose screen, or which time is now/);
    assert.equal(p.now, '11-04 23:30');
});

test('missing and unrecognized dates do not fabricate a source or overwrite the saved phone clock', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    for (const raw of ['Mara at 12:27', 'November 5, 2026', '<time>25:99</time>', '<time>13:30 PM</time>', '11.05 25:99', 'No clock.']) {
        const result = await data.reflectionClocks(p, [htmlRow(2, raw)], {});
        assert.equal(result.choices.length, 0, raw);
        assert.equal(p.now, '11-04 23:30');
    }
    const earlier = htmlRow(2, 'Mara 11.05 08:30');
    for (const raw of ['No clock.', '<time>25:99</time>', 'November 6, 2026']) {
        const result = await data.reflectionClocks(p, [earlier, htmlRow(3, raw)], {});
        assert.ok(result.choices.every(c => c.at === 2));
        assert.equal(result.choices.length, 2);
    }
});

test('a latest source with unknown screen location or ambiguous DST fallback never revives older candidates', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    const rows = [htmlRow(2, 'Mara 11.05 08:30'), htmlRow(3, 'Mara <time>09:00</time>')];
    assert.deepEqual((await data.reflectionClocks(p, rows, { phoneScreenHolder: 'Unknown' })).choices, []);
    assert.deepEqual((await data.reflectionClocks({ ...p, country: '', where: {} }, rows, {})).choices, []);
    for (const now of ['03-29 01:30', '10-25 01:30']) {
        p.now = now;
        const result = await data.reflectionClocks(p, [htmlRow(2, 'Ren 03.28 20:00'), htmlRow(3, 'Ren <time>02:30</time>')], { phoneScreenHolder: 'Ren' });
        assert.deepEqual(result.choices, [], now);
    }
});

test('archive hint ordering retains the existing supplied first-index convention', async () => {
    const p = { owner: 'Ren' }; clockPhone(p);
    // updatePhone supplies this summary as index=section.first, not an invented per-stamp message index.
    const archive = { index: 10, text: '## #10–#20\nMara at 11.05 23:59.' };
    const raw = htmlRow(15, 'Mara at 11.05 08:30');
    const r = await data.reflectionClocks(p, [raw, archive], {});
    assert.ok(r.choices.every(c => c.at === 15 && c.sourceTime === '11.05 08:30'));
    assert.equal(r.choices.length, 2);
});
