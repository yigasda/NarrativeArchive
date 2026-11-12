import { cleanMessageURL } from './cleanmessage.mjs';
// 다른 통화로 낸 돈: 계좌 통화로 바꿔 넣을 때 그 통화의 가장 작은 단위로 (원 밑 소수 없음)
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
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=()=>[];`),
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


test('유로로 낸 카드 결제를 원화 계좌에 넣으면 원 단위로 반올림 (메모엔 원래 금액)', async () => {
    const chat = [say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'ordered a poke bowl, 18.89 euros')];
    const c = setup(chat);
    await run(c.m, { now: '10-26 13:00', events: [{ id: 'poke', at: 2, quote: 'ordered a poke bowl', summary: '포케 주문', date: '10-26', time: '12:00',
        money: { moves: [{ account: '1111', amount: -18.89, currency: 'EUR', rate: 1480, who: 'Pokawa', occurrence: 'new' }] } }] });
    const tx = c.p.money.tx.find(x => x.who === 'Pokawa');
    assert.ok(tx, JSON.stringify(c.p.money.tx));
    assert.equal(tx.amount, -27957);
    assert.match(tx.memo || '', /EUR 18\.89/);
    assert.equal(c.bank(), 100000 - 27957);
    assert.ok(Number.isInteger(c.bank()));
});
