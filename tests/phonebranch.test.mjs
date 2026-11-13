import { cleanMessageURL } from './cleanmessage.mjs';
// 분기한 방: the phone settles the branch when it opens (settleBranch), the same reading a reflection does, then 빼기 by itself
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
    './phonesync.js': href('phonesync.js'), './phoneparse.js': href('phoneparse.js'), './phoneclock.js': href('phoneclock.js'), './phonemapcity.js': href('phonemapcity.js'), './placehoods.js': href('placehoods.js'), './phonesynclife.js': href('phonesynclife.js'), './phonesyncmoney.js': href('phonesyncmoney.js'), './finance.js': href('finance.js'),
    './phoneprofile.js': href('phoneprofile.js'),
    './phonestory.js': encoded(`export const phoneTarget=()=>({scope:phoneChatScope(),check(){}});export const phoneChatScope=()=>globalThis.__dropTest.scope||'test';`),
    './wealth.js': encoded(`export const ensureWealth=async()=>null;export const wealthBlock=()=>'';export const wealthDate=()=> '2026-10-26';export const wealthCheck=()=>null;export const addWealthFX=()=>{};`),
    './ai.js': encoded(`import { reflectionFixture } from '${new URL('./reflectionfixture.mjs', import.meta.url).href}'; import { phoneMadeFixture as __pmf } from '${new URL('./reflectionfixture.mjs', import.meta.url).href}'; const askDraft0=async(input,o)=>{if(String(o.system).startsWith('GOAL\\nWrite the ordinary life')){(globalThis.__everydayIn||=[]).push(input);const e=globalThis.__everyday;return JSON.stringify(typeof e==='function'?e(input):e||{});}if(String(o.system).startsWith('GOAL\\nWork out where')){(globalThis.__where||=[]).push(input);await globalThis.__dropTest.beforeWhere?.();return '{"people":[]}';}const T=globalThis.__dropTest;if(String(o.system).startsWith('STAGE: money')){T.moneyInput=input;T.moneySys=o.system;T.moneyCalls=(T.moneyCalls||0)+1;if(T.moneyAnswers&&T.moneyAnswers.length){const a=T.moneyAnswers.shift();return typeof a==='string'?a:JSON.stringify(a);}const core=(T.lastCore&&T.lastCore.events)||[];const out=[];for(const l of String(input).split('\\n')){const x=l.match(/^- (.+?): #(\\d+) .*?\\("(.*)"\\)(?: \\(changed\\))?$/)||l.match(/^- (.+?): #(\\d+) /);if(!x)continue;const e=core.find(e=>e&&e.money&&Number(String(e.at).replace('#',''))===Number(x[2])&&(x[3]===undefined||String(e.quote||'').slice(0,200)===x[3]));if(e)out.push({id:x[1],money:e.money});}return JSON.stringify({events:out});}T.sys=o.system;T.input=input;await T.beforeCore?.();const a=T.answers.shift();T.lastCore=a&&typeof a==='object'?a:null;const r=typeof a==='string'?a:JSON.stringify(reflectionFixture(a,input));if(!String(o.system).includes('· RECORDS\\n')||globalThis.__everyday===undefined)return r;(globalThis.__everydayIn||=[]).push(input);let e=globalThis.__everyday;e=typeof e==='function'?e(input):e;let j;try{j=JSON.parse(r);}catch{return r;}if(j&&typeof j==='object'&&j.everyday===undefined&&e&&e.everyday)j.everyday=e.everyday;return JSON.stringify(j);};;export const askDraft=async(i,o)=>__pmf(await askDraft0(i,o),i,o?.system);`),
    './core.js': encoded(`export const ctx=()=>({chat:globalThis.__dropTest.chat,chatMetadata:globalThis.__dropTest.meta,loadWorldInfo:async()=>null,characters:[]});export const globalSettings=()=>({});export const saveMeta=async()=>{};`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=()=>[];export const chatRows=()=>globalThis.__dropTest.chat.map((x,i)=>({index:i,user:x.is_user,hidden:!!x.is_system,text:'[#'+i+'] '+x.name+': '+(globalThis.__dropTest.clean?globalThis.__dropTest.clean(x.mes):x.mes)}));`),
    './inject.js': encoded(`export const applyInjection=()=>{};`),
    './knowledge.js': encoded(`export const knowledgeRows=()=>[];`),
    './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=()=>globalThis.__dropTest.trackers||[];`),
    './sections.js': encoded(`export const parseSections=()=>[];export const RANGE_HEAD=/#(\\d+)–#(\\d+)/;export const sectionKey=()=>'';export const splitTail=s=>[s,''];`),
    './translate.js': encoded(`export const glossaryEntries=()=>globalThis.__glossaryEntries||[];export const glossaryPeople=()=>globalThis.__glossaryPeople||[];`), './world.js': encoded(`export const worldText=()=>'';`),
};
const src = await readFile(new URL('../src/phonedata.js', import.meta.url), 'utf8');
const data = (await import('./phone2poison.mjs')).maybePoison(await import(encoded(src.replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || k}'`))));
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


const branchAt = (c, keep) => {
    const main = structuredClone(c.m), mainChat = structuredClone(T.chat);
    T.scope = 'branch'; T.meta = { integrity: 'branch-mark', main_chat: 'main' };
    T.chat = T.chat.slice(0, keep + 1);
    return { main, mainChat };
};

test('분기한 방에서 폰을 열면: 분기한 곳 뒤의 대화가 준 것은 반영 없이 바로 빠지고, 읽은 표시도 같이 빠져요', async () => {
    const c = await bookCase();
    const { main } = branchAt(c, 2);
    const r = await data.settleBranch(c.m, c.p);
    assert.ok(r);
    assert.deepEqual(texts(c.p), []);
    assert.equal(c.bank(), 100000);
    assert.equal(c.p.sync.dropped?.length || 0, 0);
    assert.equal(c.p.sync.readChat, 'branch-mark');
    assert.ok(!(c.p.sync.done || []).some(([a, b]) => b > 2));
    assert.equal(c.p.syncUndo, undefined);
    // (원래 방의 폰은 그대로)
    assert.deepEqual(texts(main.phones.ren), ['A: 책 샀어?', 'B: 응 샀어', 'E: 내일 카페에서 봐']);
    // (다시 열면 할 일이 없어요)
    assert.equal(await data.settleBranch(c.m, c.p), null);
});

test('분기한 방: 반영을 누를 때 하던 것과 결과가 같아요 (손으로 고친 B는 남음)', async () => {
    const a = await bookCase(), b = await bookCase();
    for (const c of [a, b]) c.p.threads[0].messages.find(x => x.text.startsWith('B')).text = 'B: 응 샀어 (고침)';
    // a: 반영으로 알아챈 뒤 빼기를 누름 (지금까지의 길)
    branchAt(a, 3); T.chat.splice(3, 1, say('Mara', 'something else entirely happened'));
    await run(a.m, { now: '10-26 15:00', events: [] });
    await data.dropStretch(a.m, a.p, 0);
    // b: 폰을 열 때 알아서
    T.scope = 'test'; T.meta = { integrity: 'main-mark' };
    T.chat = [say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'going to the bookstore now'), say('Mara', 'I bought the book for 15000 won'), say('Ren', 'see you tomorrow at the cafe'), say('Mara', 'okay, bye for now')];
    branchAt(b, 3); T.chat.splice(3, 1, say('Mara', 'something else entirely happened'));
    await data.settleBranch(b.m, b.p);
    assert.deepEqual(texts(b.p), texts(a.p));
    assert.equal(b.bank(), a.bank());
});

test('분기가 아닌 방(같은 채팅, 이름만 바꿈, 백업)에서는 아무것도 안 해요', async () => {
    for (const meta of [{ integrity: 'main-mark' }, { integrity: 'main-mark', main_chat: 'older main' }]) {
        const c = await bookCase(), before = JSON.stringify(c.m);
        T.meta = meta; T.chat.splice(3, 1, say('Mara', 'something else entirely happened'));
        assert.equal(await data.settleBranch(c.m, c.p), null);
        assert.equal(JSON.stringify(c.m), before);
    }
});

// a phone made past the branch point: what it was made with, dated past the story's time at the branch point, goes
function madeCase() {
    const chat = [say('Ren', 'monday morning'), say('Mara', 'hi'), say('Ren', 'monday noon'), say('Mara', 'tuesday'), say('Ren', 'wednesday'), say('Mara', 'wednesday night')];
    const c = setup(chat);
    const p = c.p;
    p.sync.marks.base = makeMark(chat, 5);
    // (made and opened in the main chat: it knows that chat as the one it was read in)
    assert.equal(data.syncState(p), 'ok');
    assert.equal(p.sync.readChat, 'main-mark');
    p.now = '10-28 22:00';
    p.photos = [{ id: 'p1', caption: 'monday photo', time: '10-26 10:00' }, { id: 'p2', caption: 'tuesday photo', time: '10-27 09:00' }];
    p.diary = [{ id: 'd1', date: '10-26', title: 'mon', text: 'mon' }, { id: 'd2', date: '10-28', title: 'wed', text: 'wed' }];
    p.events = [{ id: 'e1', title: 'dentist', date: '10-30', time: '10:00' }];
    p.threads = [{ id: 't1', with: 'Mara', messages: [{ from: 'Mara', text: 'mon text', time: '10-26 09:00' }, { from: 'Mara', text: 'wed text', time: '10-28 20:00' }] },
        { id: 't2', with: 'Ivo', messages: [{ from: 'Ivo', text: 'tue only', time: '10-27 12:00' }] }];
    return c;
}
test('분기한 곳보다 뒤에 만든 폰: 분기 장면 시각보다 뒤에 적힌 기록만 빠지고, 폰 시각도 그때로 (일정은 그대로)', async () => {
    const c = madeCase();
    T.trackers = [{ date: '10-26', min: 12 * 60, place: '', i: 2 }];
    branchAt(c, 2);
    const r = await data.settleBranch(c.m, c.p);
    T.trackers = null;
    assert.equal(r.rebased, true);
    assert.equal(r.at, '10-26 12:00');
    assert.deepEqual(c.p.photos.map(x => x.id), ['p1']);
    assert.deepEqual(c.p.diary.map(x => x.id), ['d1']);
    assert.deepEqual(c.p.events.map(x => x.id), ['e1']);
    assert.deepEqual(c.p.threads.map(t => [t.with, t.messages.map(x => x.text)]), [['Mara', ['mon text']]]);
    assert.equal(c.p.now, '10-26 12:00');
    assert.equal(c.p.sync.marks.base.index, 2);
    assert.equal(c.p.sync.readChat, 'branch-mark');
});
test('분기 장면 시각을 모르면(상태창 없음, 대화에서 온 기록도 없음) 만든 기록은 그대로 두고 그렇다고 알려요', async () => {
    const c = madeCase();
    branchAt(c, 2);
    const r = await data.settleBranch(c.m, c.p);
    assert.equal(r.at, '');
    assert.equal(r.cut, 0);
    assert.equal(c.p.photos.length, 2);
    assert.equal(c.p.now, '10-28 22:00');
});
test('분기한 곳 전에 만든 폰: 만든 기록은 하나도 안 빠져요 (분기 장면보다 앞이라서)', async () => {
    const c = await bookCase();
    c.p.photos = [{ id: 'old', caption: 'made', time: '10-26 08:00' }];
    T.trackers = [{ date: '10-26', min: 10 * 60, place: '', i: 2 }];
    branchAt(c, 2);
    const r = await data.settleBranch(c.m, c.p);
    T.trackers = null;
    assert.equal(r.cut, 0);
    assert.deepEqual(c.p.photos.map(x => x.id), ['old']);
});

// made with app fills past the branch point: the bank (its opening balance already counted the payments), a card, shopping,
// the everyday and delivery apps, investments (each trade its own ledger entry)
test('분기한 곳보다 뒤에 만든 은행 · 생활 · 배달 · 투자: 뒤의 것만 빠지고 잔액 · 보유가 그때로', async () => {
    const c = madeCase(), p = c.p, m = c.m;
    p.year = 2026;
    p.money.bank.accounts.push({ id: 'crd', kind: 'credit', name: '카드', last4: '2222', currency: 'KRW', balance: 0 });
    p.money.tx = [
        { id: 'x1', account: '1111', amount: -5000, who: 'cafe mon', time: '10-26 09:30' },
        { id: 'x2', account: '1111', amount: -20000, who: 'shop tue', time: '10-27 15:00' },
        { id: 'x3', account: '2222', amount: -7000, who: 'card wed', time: '10-28 19:00', kind: 'card' },
        { id: 'x4', account: '1111', amount: -3000, who: 'from a message', time: '10-28 08:00', sourceIndex: 1 },
    ];
    p.money.orders = [{ id: 'o1', shop: 'S', item: 'mon', time: '10-26 08:00' }, { id: 'o2', shop: 'S', item: 'wed', time: '10-28 08:00' }];
    p.money.passes = [{ id: 't1', kind: 'train', by: 'DB', date: '10-29', time: '09:00' }];
    // (the fill's history is in the opening balance: 100000 is the balance after x1 and x2)
    migrateBank(m, p);
    const L = m.finance.accounts['chk:KRW'];
    L.included.push('x1', 'x2');
    assert.equal(c.bank(), 100000);
    p.life = { health: { days: [{ id: 'h1', date: '10-26', steps: 100 }, { id: 'h2', date: '10-27', steps: 200 }] }, files: { folders: [], items: [{ id: 'f1', name: 'a', time: '10-26 07:00' }, { id: 'f2', name: 'b', time: '10-28 07:00' }] }, clock: { alarms: [{ id: 'a1', time: '07:00' }] } };
    p.delivery = { shops: [], orders: [{ id: 'dv1', shop: 'Pho', time: '10-26 11:00' }, { id: 'dv2', shop: 'Pho', time: '10-27 19:00' }] };
    m.finance.accounts['brk:EUR'] = { id: 'brk', currency: 'EUR', amount: 1000, asOf: '2026-10-01', owner: 'Ren', entries: { tr1: { amount: -100, date: '2026-10-20' }, tr2: { amount: -200, date: '2026-10-27' } }, included: [] };
    p.investment = { base: 'EUR', accounts: [{ key: 'brk:EUR', currency: 'EUR' }], securities: [{ symbol: 'X', currency: 'EUR' }],
        trades: [{ id: 'tr1', kind: 'buy', symbol: 'X', currency: 'EUR', date: '2026-10-20', quantity: 1, price: 100, fee: 0 }, { id: 'tr2', kind: 'buy', symbol: 'X', currency: 'EUR', date: '2026-10-27', quantity: 2, price: 100, fee: 0 }] };
    T.trackers = [{ date: '10-26', min: 12 * 60, place: '', i: 2 }];
    branchAt(c, 2);
    const r = await data.settleBranch(m, p);
    T.trackers = null;
    assert.ok(r.cut >= 8, String(r.cut));
    assert.deepEqual(p.money.tx.map(x => x.id), ['x1', 'x4']);
    // (x2 was in the opening balance: it gives its 20000 back; x4 came from a message the branch still has: stays)
    assert.equal(c.bank(), 120000);
    assert.deepEqual(L.included, ['x1']);
    assert.ok(m.finance.revisions.some(v => v.reason === '분기한 곳으로 되돌림' && v.before === 100000 && v.after === 120000));
    assert.equal(p.money.bank.accounts.find(a => a.last4 === '2222').spent || 0, 0);
    assert.deepEqual(p.money.orders.map(x => x.id), ['o1']);
    assert.deepEqual(p.money.passes.map(x => x.id), ['t1']);
    assert.deepEqual(p.life.health.days.map(x => x.id), ['h1']);
    assert.deepEqual(p.life.files.items.map(x => x.id), ['f1']);
    assert.deepEqual(p.life.clock.alarms.map(x => x.id), ['a1']);
    assert.deepEqual(p.delivery.orders.map(x => x.id), ['dv1']);
    assert.deepEqual(p.investment.trades.map(x => x.id), ['tr1']);
    assert.deepEqual(Object.keys(m.finance.accounts['brk:EUR'].entries), ['tr1']);
    assert.equal(cash(m.finance.accounts['brk:EUR']), 900);
});
test('읽는 표시(은행 · 투자 · 생활 · 배달)도 분기한 곳을 넘지 않아요', async () => {
    const c = madeCase();
    for (const g of ['money', 'invest', 'life', 'delivery']) c.p.sync.marks[g] = makeMark(T.chat, 5);
    c.p.sync.marks.life = makeMark(T.chat, 1);
    T.trackers = [{ date: '10-26', min: 12 * 60, place: '', i: 2 }];
    branchAt(c, 2);
    await data.settleBranch(c.m, c.p);
    T.trackers = null;
    assert.deepEqual(['money', 'invest', 'delivery'].map(g => c.p.sync.marks[g].index), [2, 2, 2]);
    assert.equal(c.p.sync.marks.life.index, 1);
});

// 점검에서 나온 것: 분기가 폰이 아는 것을 다 갖고 있으면 아무것도 빼지 않고 표시도 안 옮겨요
test('채팅 맨 끝에서 통째로 분기: 뺄 대화가 없으면 만든 기록 · 폰 시각 · 되돌리기를 건드리지 않아요', async () => {
    const c = await bookCase();
    // (records a 다시 만들기 wrote, dated after the newest message's record; no status line anywhere)
    c.p.photos.push({ id: 'made1', caption: 'remade photo', time: '10-26 12:50' });
    c.p.notes = [{ id: 'n1', title: 'remade note', text: 'x', time: '10-26 12:55' }];
    const now = c.p.now, undo = JSON.stringify(c.p.syncUndo), tx = JSON.stringify(c.p.money.tx), bank = c.bank();
    branchAt(c, 5);
    const r = await data.settleBranch(c.m, c.p);
    assert.deepEqual([r.dropped, r.items, r.cut, r.at, r.rebased, r.point], [0, 0, 0, '', false, 5]);
    assert.ok(c.p.photos.some(x => x.id === 'made1')); assert.deepEqual(c.p.notes.map(x => x.id), ['n1']);
    assert.equal(c.p.now, now); assert.equal(JSON.stringify(c.p.syncUndo), undo);
    assert.equal(JSON.stringify(c.p.money.tx), tx); assert.equal(c.bank(), bank);
    assert.equal(c.p.sync.readChat, 'branch-mark');
    // (a status line there changes nothing either: there is still nothing past the branch)
    const d = await bookCase();
    d.p.photos.push({ id: 'made1', caption: 'remade photo', time: '10-26 12:50' });
    T.trackers = [{ date: '10-26', min: 12 * 60 + 30, place: '', i: 5 }];
    branchAt(d, 5);
    const r2 = await data.settleBranch(d.m, d.p);
    T.trackers = null;
    assert.equal(r2.cut, 0); assert.ok(d.p.photos.some(x => x.id === 'made1'));
});

test('통째로 분기한 뒤 반영해도 은행이 이미 잔액에 든 결제를 또 넣지 않아요 (읽는 표시를 뒤로 안 당겨요)', async () => {
    const chat = [say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'going to the bookstore now'), say('Mara', 'I bought the book for 15000 won')];
    const c = setup(chat);
    await run(c.m, { now: '10-26 13:00', events: [book(3, 'bought the book', [msg('A: 책 샀어', '10-26 12:01')], 'new')] });
    assert.equal(c.bank(), 85000);
    // two more messages; the bank is made again at #5: its balance already holds the taxi of #4
    T.chat.push(say('Ren', 'paid the taxi 9000 won'), say('Mara', 'ok'));
    c.p.sync.marks.money = makeMark(T.chat, 5);
    branchAt(c, 5);
    const r = await data.settleBranch(c.m, c.p);
    assert.equal(r.cut, 0); assert.equal(c.p.sync.marks.money.index, 5);
    await run(c.m, { now: '10-26 15:00', events: [{ id: 'taxi', at: 4, quote: 'paid the taxi', summary: '택시', date: '10-26', time: '14:00', phone: {}, money: { moves: [{ account: '1111', amount: -9000, who: '택시', occurrence: 'new' }] } }] });
    assert.equal(c.bank(), 85000);
});

test('폰은 분기 전까지만 읽었고 은행만 분기 뒤에 만들었으면: 은행의 뒤 기록만 빠지고, 폰이 만든 기록 · 폰 시각은 그대로', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'monday talk'), say('Mara', 'ok')]);
    // (the phone read Monday; Tuesday and Wednesday were said after and never read)
    await run(c.m, { now: '10-26 12:00', events: [] });
    T.chat.push(say('Ren', 'tuesday talk'), say('Mara', 'fine'), say('Ren', 'wednesday talk'), say('Mara', 'bye'));
    c.p.now = '10-26 12:00';
    c.p.photos = [{ id: 'made', caption: 'made with the phone', time: '10-26 11:00' }];
    // the bank was made on Wednesday (#7): its history has a Monday and a Wednesday payment, both in its opening balance
    c.p.sync.marks.money = makeMark(T.chat, 7);
    c.p.money.tx = [{ id: 'mon', account: '1111', amount: -1000, who: '월요일 가게', time: '10-26 10:00' }, { id: 'wed', account: '1111', amount: -3000, who: '수요일 가게', time: '10-28 10:00' }];
    c.m.finance.accounts['chk:KRW'].included = ['mon', 'wed'];
    T.trackers = [{ date: '10-27', min: 9 * 60, place: '', i: 5 }];
    branchAt(c, 5);      // branched on Tuesday
    const r = await data.settleBranch(c.m, c.p);
    T.trackers = null;
    assert.deepEqual([r.dropped, r.cut, r.at, r.point], [0, 1, '10-27 09:00', 5]);
    assert.deepEqual(c.p.money.tx.map(t => t.id), ['mon']);
    assert.equal(c.bank(), 103000);
    assert.equal(c.p.sync.marks.money.index, 5);
    assert.deepEqual(c.p.photos.map(x => x.id), ['made']); assert.equal(c.p.now, '10-26 12:00');
});
