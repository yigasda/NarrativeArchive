// 반영 전에 아카이브된 구간: its messages are hidden, so the round reads the archive section in their place
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { migrateBank, cash } from '../src/finance.js';
import { makeMark, newSync, readBefore, bodyMark } from '../src/phonesync.js';

const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const href = f => pathToFileURL(new URL(`../src/${f}`, import.meta.url).pathname).href;
const T = (globalThis.__archTest = { chat: [], answers: [] });
const map = {
    './phonesync.js': href('phonesync.js'), './phoneparse.js': href('phoneparse.js'), './phonesynclife.js': href('phonesynclife.js'), './phonesyncmoney.js': href('phonesyncmoney.js'), './finance.js': href('finance.js'),
    './phoneprofile.js': href('phoneprofile.js'),
    './phonestory.js': encoded(`export const phoneChatScope=()=>globalThis.__archTest.scope||'test';`),
    './wealth.js': encoded(`export const ensureWealth=async()=>null;export const wealthBlock=()=>'';export const wealthDate=()=> '2026-10-26';export const wealthCheck=()=>null;export const addWealthFX=()=>{};`),
    './ai.js': encoded(`export const askDraft=async(input,o)=>{const T=globalThis.__archTest;if(String(o.system).startsWith('STAGE: money')){T.moneyInput=input;T.moneySys=o.system;T.moneyCalls=(T.moneyCalls||0)+1;if(T.moneyAnswers&&T.moneyAnswers.length){const a=T.moneyAnswers.shift();return typeof a==='string'?a:JSON.stringify(a);}const core=(T.lastCore&&T.lastCore.events)||[];const out=[];for(const l of String(input).split('\\n')){const x=l.match(/^- (.+?): #(\\d+) .*?\\("(.*)"\\)(?: \\(changed\\))?$/)||l.match(/^- (.+?): #(\\d+) /);if(!x)continue;const e=core.find(e=>e&&e.money&&Number(String(e.at).replace('#',''))===Number(x[2])&&(x[3]===undefined||String(e.quote||'').slice(0,200)===x[3]));if(e)out.push({id:x[1],money:e.money});}return JSON.stringify({events:out});}T.sys=o.system;T.input=input;const a=T.answers.shift();T.lastCore=a&&typeof a==='object'?a:null;return typeof a==='string'?a:JSON.stringify(a);};`),
    './core.js': encoded(`export const ctx=()=>({chat:globalThis.__archTest.chat,chatMetadata:globalThis.__archTest.meta,loadWorldInfo:async()=>null,characters:[]});export const globalSettings=()=>({});export const saveMeta=async()=>{};`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=()=>[];export const chatRows=()=>globalThis.__archTest.chat.map((x,i)=>({index:i,user:x.is_user,hidden:!!x.is_system,text:'[#'+i+'] '+x.name+': '+x.mes}));`),
    './inject.js': encoded(`export const applyInjection=()=>{};`),
    './knowledge.js': encoded(`export const knowledgeRows=()=>[];`),
    './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=()=>[];`),
    './sections.js': encoded(`export const RANGE_HEAD=/^(?:(\\S{1,12})\\s)?#(\\d+)\\s*([–—~-])\\s*#?(\\d+)(.*)$/;export const parseSections=t=>[...String(t).matchAll(/^## (.+)\\n[^#]*/gm)].map(x=>({title:x[1],start:x.index,end:x.index+x[0].length,group:false}));export const sectionKey=s=>s.title;export const splitTail=s=>[s,''];`),
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
const hide = x => ({ ...x, is_system: true });
const SECTION = '## #2–#5 — Bookstore\n- Ren went to the bookstore and bought the poetry book for 15000 won (#3).\n';

function archived() {
    const chat = [say('Ren', 'start of the day'), say('Mara', 'morning'), hide(say('Ren', 'going to the bookstore')), hide(say('Mara', 'did you get it')),
        hide(say('Ren', 'yes the poetry one')), hide(say('Mara', 'nice')), say('Ren', 'see you at the cafe later')];
    const c = setup(chat);
    c.m.text = SECTION;
    return c;
}
const note = (at, quote, title) => ({ id: title.toLowerCase(), at, quote, summary: title, date: '10-26', time: '12:00', phone: { notes: [{ title, text: title, time: '10-26 12:00' }] } });

test('a stretch archived before the phone read it comes in from its section, once', async () => {
    const { m, p } = archived();
    assert.equal(data.syncLeft(p, m), 2); // #6, and the archived #2–#5
    await run(m, { now: '10-26 13:00', events: [note(3, 'bought the poetry book', 'Book'), note(6, 'see you at the cafe', 'Cafe')] });
    assert.deepEqual(p.notes.map(x => x.title).sort(), ['Book', 'Cafe']);
    const s = p.sync;
    assert.ok(Object.keys(s.arch).length === 1);
    for (const i of [2, 3, 4, 5, 6]) assert.ok(readBefore(s, i), String(i));
    assert.equal(data.syncLeft(p, m), 0);
    // read again: nothing left, nothing twice
    await run(m, { now: '10-26 13:00', events: [note(3, 'bought the poetry book', 'Book')] });
    assert.equal(p.notes.filter(x => x.title === 'Book').length, 1);
    // the section retitled (a new key): its messages stay read
    m.text = SECTION.replace('Bookstore', 'The bookstore trip');
    assert.equal(data.syncLeft(p, m), 0);
});

test('a section message the phone read before it was archived is not taken again', async () => {
    const { m, p } = archived();
    data.syncLeft(p, m);
    // #2–#3 were read before the archive hid them
    p.sync.hiddenRead = { 2: bodyMark('[#2] Ren: going to the bookstore'), 3: bodyMark('[#3] Mara: did you get it') };
    await run(m, { now: '10-26 13:00', events: [note(3, 'bought the poetry book', 'Book'), note(4, 'Ren went to the bookstore', 'Shelf')] });
    assert.deepEqual(p.notes.map(x => x.title), ['Shelf']);
});

test('whole sections only: past the limit a section waits for the next round, never cut', async () => {
    const chat = [say('Ren', 'start of the day'), say('Mara', 'morning')];
    let text = '';
    for (let k = 0; k < 30; k++) { chat.push(hide(say('Ren', `stretch ${k} one`)), hide(say('Mara', `stretch ${k} two`))); text += `## #${2 + 2 * k}–#${3 + 2 * k} — Part ${k}\n- ${'Ren did a thing. '.repeat(150)}(#${2 + 2 * k}).\n`; }
    const c = setup(chat);
    c.m.text = text;
    await run(c.m, { now: '10-26 13:00', events: [] });
    const first = Object.keys(c.p.sync.arch).length;
    assert.ok(first > 1 && first < 30, String(first));
    // every section read whole: the next round starts where this one stopped
    assert.equal(data.syncLeft(c.p, c.m), 30 - first);
    await run(c.m, { now: '10-26 13:00', events: [] });
    assert.ok(Object.keys(c.p.sync.arch).length > first);
});
