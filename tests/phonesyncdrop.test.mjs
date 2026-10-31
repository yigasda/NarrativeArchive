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
    assert.deepEqual(texts(c.p), ['B: 응 샀어', 'E: 내일 카페에서 꼭 봐', 'C: 300쪽이야']);
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
