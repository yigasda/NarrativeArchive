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
