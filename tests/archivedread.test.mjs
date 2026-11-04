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
    './ai.js': encoded(`export const askDraft=async(input,o)=>{if(String(o.system).startsWith('GOAL\\nWork out where')){(globalThis.__where||=[]).push(input);return '{"people":[]}';}const T=globalThis.__archTest;if(String(o.system).startsWith('STAGE: money')){T.moneyInput=input;T.moneySys=o.system;T.moneyCalls=(T.moneyCalls||0)+1;if(T.moneyAnswers&&T.moneyAnswers.length){const a=T.moneyAnswers.shift();return typeof a==='string'?a:JSON.stringify(a);}const core=(T.lastCore&&T.lastCore.events)||[];const out=[];for(const l of String(input).split('\\n')){const x=l.match(/^- (.+?): #(\\d+) .*?\\("(.*)"\\)(?: \\(changed\\))?$/)||l.match(/^- (.+?): #(\\d+) /);if(!x)continue;const e=core.find(e=>e&&e.money&&Number(String(e.at).replace('#',''))===Number(x[2])&&(x[3]===undefined||String(e.quote||'').slice(0,200)===x[3]));if(e)out.push({id:x[1],money:e.money});}return JSON.stringify({events:out});}T.sys=o.system;T.input=input;const a=T.answers.shift();T.lastCore=a&&typeof a==='object'?a:null;return typeof a==='string'?a:JSON.stringify(a);};`),
    './core.js': encoded(`export const ctx=()=>({chat:globalThis.__archTest.chat,chatMetadata:globalThis.__archTest.meta,loadWorldInfo:async()=>null,characters:[]});export const globalSettings=()=>({});export const saveMeta=async()=>{};`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=()=>[];export const chatRows=()=>globalThis.__archTest.chat.map((x,i)=>({index:i,user:x.is_user,hidden:!!x.is_system,text:'[#'+i+'] '+x.name+': '+x.mes}));`),
    './inject.js': encoded(`export const applyInjection=()=>{};`),
    './knowledge.js': encoded(`export const knowledgeRows=()=>[];`),
    './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=(n,o={})=>{const T=globalThis.__archTest;(T.trackLens||=[]).push((o.chat||T.chat).length);return T.trackers||[];};`),
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

test('a round behind the chat sees the status lines only up to its own last message', async () => {
    const chat = [say('Ren', 'start of the day'), say('Mara', 'morning')];
    for (let k = 0; k < 30; k++) chat.push(say(k % 2 ? 'Mara' : 'Ren', `line ${k} of the long afternoon`));
    const c = setup(chat);
    T.trackLens = [];
    await run(c.m, { now: '10-26 13:00', events: [] });
    const read = c.p.syncLast.checked, last = 1 + read;
    assert.ok(read > 0 && read < 30, String(read));
    // every status-line look this round stopped at the round's last message
    assert.ok(T.trackLens.length && T.trackLens.every(n => n === last + 1), JSON.stringify(T.trackLens));
});

test('a round that read an archived stretch, taken back: the stretch is unread again and read once more', async () => {
    const { m, p } = archived();
    await run(m, { now: '10-26 13:00', events: [note(3, 'bought the poetry book', 'Book'), note(6, 'see you at the cafe', 'Cafe')] });
    await data.undoRound(m, p);
    assert.equal(p.notes.length, 0);
    assert.equal(data.syncLeft(p, m), 2);
    await run(m, { now: '10-26 13:00', events: [note(3, 'bought the poetry book', 'Book')] });
    assert.deepEqual(p.notes.map(x => x.title), ['Book']);
});

test('a round behind the life apps (filled further on) leaves their weather', async () => {
    const chat = [say('Ren', 'start of the day'), say('Mara', 'morning')];
    for (let k = 0; k < 30; k++) chat.push(say(k % 2 ? 'Mara' : 'Ren', `line ${k} of the long afternoon`));
    const c = setup(chat);
    c.p.life = { at: '10-27 09:00', clock: { alarms: [], timers: [], running: null }, health: { usual: {}, days: [] }, files: { folders: [], items: [] },
        weather: { here: { place: 'Varo', date: '10-27', time: '09:00', cond: 'snow', temp: -2, hours: [], days: [], tiles: {} }, cities: [] } };
    c.p.sync.marks.life = makeMark(chat, 31);
    await run(c.m, { now: '10-26 13:00', events: [], weather: { place: 'Varo', date: '10-26', time: '13:00', cond: 'clear', temp: 20 } });
    assert.equal(c.p.life.weather.here.cond, 'snow');
});

test('the life and delivery marks follow a message deleted before them, like the bank\'s', async () => {
    const chat = [say('Ren', 'start of the day'), say('Mara', 'morning')];
    for (let k = 0; k < 12; k++) chat.push(say(k % 2 ? 'Mara' : 'Ren', `line ${k} of the long afternoon`));
    const c = setup(chat);
    c.p.sync.marks.life = makeMark(chat, 10);
    c.p.sync.marks.delivery = makeMark(chat, 9);
    T.chat.splice(3, 1); // #3 gone: everything after moves up one
    assert.equal(data.syncState(c.p), 'ok');
    assert.equal(c.p.sync.marks.life.index, 9);
    assert.equal(c.p.sync.marks.delivery.index, 8);
});

// ---- 점검에서 나온 버그들
test('a round that reads only an archived stretch behind the phone\'s clock leaves the life app\'s weather', async () => {
    const chat = [say('Ren', 'start of the day'), say('Mara', 'morning'), hide(say('Ren', 'going to the bookstore')), hide(say('Mara', 'did you get it')),
        hide(say('Ren', 'yes the poetry one')), hide(say('Mara', 'nice'))];
    for (let k = 0; k < 6; k++) chat.push(say(k % 2 ? 'Mara' : 'Ren', `line ${k} later on`));
    const c = setup(chat);
    c.m.text = SECTION;
    c.p.sync.done = [[6, 11]];
    c.p.life = { at: '10-27 09:00', clock: { alarms: [], timers: [], running: null }, health: { usual: {}, days: [] }, files: { folders: [], items: [] },
        weather: { here: { place: 'Varo', date: '10-27', time: '09:00', cond: 'snow', temp: -2, hours: [], days: [], tiles: {} }, cities: [] } };
    c.p.sync.marks.life = makeMark(chat, 1);
    await run(c.m, { now: '10-26 13:00', events: [note(3, 'bought the poetry book', 'Book')], weather: { place: 'Varo', date: '10-26', time: '13:00', cond: 'clear', temp: 20 } });
    assert.ok(readBefore(c.p.sync, 3));
    assert.equal(c.p.life.weather.here.cond, 'snow');
});

test('a section read with its visible messages: its hidden ones count as read too, retitled or not', async () => {
    const chat = [say('Ren', 'start of the day'), say('Mara', 'morning'), hide(say('Ren', 'going to the bookstore')), hide(say('Mara', 'did you get it')),
        hide(say('Ren', 'yes the poetry one')), say('Mara', 'nice'), say('Ren', 'see you at the cafe later')];
    const c = setup(chat);
    c.m.text = SECTION;
    await run(c.m, { now: '10-26 13:00', events: [note(5, 'nice', 'Nice'), note(6, 'see you at the cafe', 'Cafe')] });
    for (const i of [2, 3, 4]) assert.ok(readBefore(c.p.sync, i), String(i));
    c.m.text = SECTION.replace('Bookstore', 'The bookstore trip');
    assert.equal(data.syncLeft(c.p, c.m), 0);
});

test('a phone made when everything after the archive is hidden: its clock is the archive\'s end', async () => {
    const chat = [say('Ren', 'start of the day'), say('Mara', 'morning'), hide(say('Ren', 'going to the bookstore')), hide(say('Mara', 'did you get it')),
        hide(say('Ren', 'yes the poetry one')), hide(say('Mara', 'nice'))];
    const c = setup(chat);
    c.m.text = SECTION;
    delete c.m.phones.ren;
    T.answers.push({ contacts: [], threads: [], now: '10-26 13:00' });
    await data.makePhone(c.m, 'Ren').catch(() => {});
    assert.equal(c.m.phones.ren?.sync?.marks?.base?.index, 5);
});

test('a phone made on a chat shorter than its archive (a branch): its clock is the chat\'s last message', async () => {
    const chat = [say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'off to work'), say('Mara', 'see you')];
    const c = setup(chat);
    c.m.text = '## #0–#9 — Before the branch\n- Ren went to work and came home late.\n';
    delete c.m.phones.ren;
    T.answers.push({ contacts: [], threads: [], now: '10-26 13:00' });
    await data.makePhone(c.m, 'Ren').catch(() => {});
    assert.equal(c.m.phones.ren?.sync?.marks?.base?.index, 3);
    T.chat.push(say('Ren', 'back home'), say('Mara', 'welcome back'));
    assert.equal(data.syncLeft(c.m.phones.ren, c.m), 2);
});

test('a status line with no saved city doesn\'t set the phone\'s time when it keeps other zones; the model gets OWNER\'S CLOCK', async () => {
    const chat = [say('Ren', 'start of the day'), say('Mara', 'morning'), say('Mara', '[11.03, 12:33] are you up?'), say('Ren', 'just woke up')];
    const c = setup(chat);
    c.p.now = '10-26 03:00'; c.p.year = 2026; // Germany's summer time ended on 10-25: 8 hours
    c.p.life = { at: '10-26 03:00', clock: { alarms: [], timers: [], running: null }, health: { usual: {}, days: [] }, files: { folders: [], items: [] },
        weather: { here: { place: 'Frankfurt am Main', date: '10-26', time: '03:00', cond: 'clear', temp: 5, hours: [], days: [], tiles: {} },
            cities: [{ name: 'Frankfurt am Main', tz: 'Europe/Berlin' }, { name: 'Seoul', tz: 'Asia/Seoul' }] } };
    T.trackers = [{ i: 2, date: '10.26', min: 12 * 60 + 33, time: '12:33', place: "Mara's room", city: "Mara's room", weather: '' }];
    try {
        await run(c.m, { now: '10-26 05:33', events: [] });
        assert.ok(T.input.includes("[OWNER'S CLOCK]\nThe owner is in Frankfurt am Main, 10-26 03:00 now.\nSeoul is 8 hours ahead."), T.input.slice(-600));
        assert.equal(c.p.now, '10-26 05:33');
        // the far scene's status line is no weather or clock of the owner's
        assert.deepEqual([c.p.life.weather.here.place, c.p.life.weather.here.time], ['Frankfurt am Main', '03:00']);
        // the same line in Seoul, a saved city: read in the owner's zone, it caps a later guess
        T.trackers = [{ i: 3, date: '10.26', min: 14 * 60, time: '14:00', place: 'Seoul', city: 'Seoul', weather: '' }];
        T.chat.push(say('Ren', 'coffee first'));
        await run(c.m, { now: '10-26 12:00', events: [] });
        assert.equal(c.p.now, '10-26 06:00');
    } finally { T.trackers = null; }
});

test('where everyone is: read once on the first round of a phone that never had it, not every round', async () => {
    const chat = [say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'coffee?')];
    const c = setup(chat);
    globalThis.__where = [];
    await run(c.m, { now: '10-26 09:30', events: [] });
    assert.equal(globalThis.__where.length, 1);
    assert.ok(c.p.where && Array.isArray(c.p.where.people));
    T.chat.push(say('Mara', 'yes please'));
    await run(c.m, { now: '10-26 09:40', events: [] });
    assert.equal(globalThis.__where.length, 1);
});
