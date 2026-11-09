import { cleanMessageURL } from './cleanmessage.mjs';
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
const map = { './extract.js': cleanMessageURL,
    './phonesync.js': href('phonesync.js'), './phoneparse.js': href('phoneparse.js'), './phoneclock.js': href('phoneclock.js'), './phonemapcity.js': href('phonemapcity.js'), './phonesynclife.js': href('phonesynclife.js'), './phonesyncmoney.js': href('phonesyncmoney.js'), './finance.js': href('finance.js'),
    './phoneprofile.js': href('phoneprofile.js'),
    './phonestory.js': encoded(`export const phoneTarget=()=>({scope:phoneChatScope(),check(){}});export const phoneChatScope=()=>globalThis.__archTest.scope||'test';`),
    './wealth.js': encoded(`export const ensureWealth=async()=>null;export const wealthBlock=()=>'';export const wealthDate=()=> '2026-10-26';export const wealthCheck=()=>null;export const addWealthFX=()=>{};`),
    './ai.js': encoded(`import { reflectionFixture } from '${new URL('./reflectionfixture.mjs', import.meta.url).href}'; import { phoneMadeFixture as __pmf } from '${new URL('./reflectionfixture.mjs', import.meta.url).href}'; const askDraft0=async(input,o)=>{globalThis.__archTest.clockAuditCalls?.push({input,system:o.system});if(String(o.system).startsWith('GOAL\\nWrite the ordinary life')){(globalThis.__everydayIn||=[]).push(input);await globalThis.__archTest.beforeEveryday?.();const e=globalThis.__everyday;return JSON.stringify(typeof e==='function'?e(input):e||{});}if(String(o.system).startsWith('GOAL\\nWork out where')){(globalThis.__where||=[]).push(input);if(globalThis.__whereFail)throw new Error('quota');return JSON.stringify(globalThis.__whereAnswer||{people:[]});}const T=globalThis.__archTest;if(String(o.system).startsWith('STAGE: money')){T.moneyInput=input;T.moneySys=o.system;T.moneyCalls=(T.moneyCalls||0)+1;if(T.moneyAnswers&&T.moneyAnswers.length){const a=T.moneyAnswers.shift();return typeof a==='string'?a:JSON.stringify(a);}const core=(T.lastCore&&T.lastCore.events)||[];const out=[];for(const l of String(input).split('\\n')){const x=l.match(/^- (.+?): #(\\d+) .*?\\("(.*)"\\)(?: \\(changed\\))?$/)||l.match(/^- (.+?): #(\\d+) /);if(!x)continue;const e=core.find(e=>e&&e.money&&Number(String(e.at).replace('#',''))===Number(x[2])&&(x[3]===undefined||String(e.quote||'').slice(0,200)===x[3]));if(e)out.push({id:x[1],money:e.money});}return JSON.stringify({events:out});}T.sys=o.system;T.input=input;const a=T.answers.shift();T.lastCore=a&&typeof a==='object'?a:null;const r=typeof a==='string'?a:JSON.stringify(reflectionFixture(a,input));if(!String(o.system).includes('· RECORDS\\n')||globalThis.__everyday===undefined)return r;(globalThis.__everydayIn||=[]).push(input);await globalThis.__archTest.beforeEveryday?.();let e=globalThis.__everyday;e=typeof e==='function'?e(input):e;let j;try{j=JSON.parse(r);}catch{return r;}if(j&&typeof j==='object'&&j.everyday===undefined&&e&&e.everyday)j.everyday=e.everyday;return JSON.stringify(j);};;export const askDraft=async(i,o)=>__pmf(await askDraft0(i,o),i,o?.system);`),
    './core.js': encoded(`export const ctx=()=>({chat:globalThis.__archTest.chat,chatMetadata:globalThis.__archTest.meta,loadWorldInfo:async()=>null,characters:[]});export const globalSettings=()=>({});export const saveMeta=async()=>{};`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=()=>[];export const chatRows=()=>globalThis.__archTest.chat.map((x,i)=>({index:i,user:x.is_user,hidden:!!x.is_system,text:'[#'+i+'] '+x.name+': '+x.mes}));`),
    './inject.js': encoded(`export const applyInjection=()=>{};`),
    './knowledge.js': encoded(`export const knowledgeRows=()=>[];`),
    './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=(n,o={})=>{const T=globalThis.__archTest;const len=(o.chat||T.chat).length;(T.trackLens||=[]).push(len);return (T.trackers||[]).filter(t=>!Number.isInteger(t.i)||t.i<len);};`),
    './sections.js': encoded(`export const RANGE_HEAD=/^(?:(\\S{1,12})\\s)?#(\\d+)\\s*([–—~-])\\s*#?(\\d+)(.*)$/;export const parseSections=t=>[...String(t).matchAll(/^## (.+)\\n[^#]*/gm)].map(x=>({title:x[1],start:x.index,end:x.index+x[0].length,group:false}));export const sectionKey=s=>s.title;export const splitTail=s=>[s,''];`),
    './translate.js': encoded(`export const glossaryEntries=()=>[];export const glossaryPeople=()=>globalThis.__glossaryPeople||[];`), './world.js': encoded(`export const worldText=()=>'';`),
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


// ---- 시각: one place decides whose clock a status line shows; now is never before this round's status line
const frankfurtPhone = (c, { cities = true, here = 'Frankfurt am Main' } = {}) => {
    c.p.now = '10-26 03:00'; c.p.year = 2026; // Germany's summer time ended on 10-25: 8 hours
    c.p.where = { at: 1, people: [{ name: 'Ren', city: 'Frankfurt am Main', local: '', lives: 'DE', tz: 'Europe/Berlin' }, { name: 'Mara', city: 'Seoul', local: '서울', lives: 'KR', tz: 'Asia/Seoul' }] };
    if (cities) c.p.life = { at: '10-26 03:00', clock: { alarms: [], timers: [], running: null }, health: { usual: {}, days: [] }, files: { folders: [], items: [] },
        weather: { here: { place: here, date: '10-26', time: '03:00', cond: 'cloudy', temp: 4, hours: [], days: [], tiles: {} },
            cities: [{ name: 'Frankfurt am Main', tz: 'Europe/Berlin' }, { name: 'Seoul', tz: 'Asia/Seoul' }] } };
};
const trk = (i, time, place, weather = '맑음 14°C') => ({ i, date: '10.26', min: Number(time.slice(0, 2)) * 60 + Number(time.slice(3)), time, place, city: place.split(' · ')[0], weather });
const withTrackers = async (ts, fn) => { T.trackers = ts; try { await fn(); } finally { T.trackers = null; } };

test('a Seoul status line: OWNER\'S CLOCK gives it on the owner\'s clock, a now put before it is moved up, a few minutes after it stays', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Mara', 'lunch break, call?')]);
    frankfurtPhone(c);
    await withTrackers([trk(2, '12:50', "Seoul · Mara's room")], async () => {
        // run40 D3: the model paired the status line's 12:50 with the phone's 03:00 and wrote 03:52
        await run(c.m, { now: '10-26 03:52', events: [] });
        assert.ok(T.input.includes("The newest status line, 10-26 12:50 in Seoul, is 10-26 04:50 here."), T.input.slice(-500));
        assert.match(T.input, /\[WEATHER NOW\]\n\{"place":"Seoul","weather":"맑음 14°C"\}/);
        assert.equal(c.p.now, '10-26 04:50');
        assert.equal(c.p.life.weather.here.place, 'Frankfurt am Main');
        // run41: 04:52, the text two minutes after the status line, stays; the screen shows the later of the two
        await data.undoRound(c.m, c.p);
        await run(c.m, { now: '10-26 04:52', events: [] });
        assert.equal(c.p.now, '10-26 04:52');
        assert.equal(data.storyNow(c.p), '10-26 04:52');
    });
});

test('a scene the phone can\'t place: the model says whose clock for that round (never kept for the place); with nothing said its hour is no one\'s', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Mara', 'lunch break, call?')]);
    frankfurtPhone(c);
    await withTrackers([trk(2, '12:50', 'the cafe')], async () => {
        await run(c.m, { now: '10-26 04:52', statusCity: '', events: [] });
        assert.match(T.sys, /"statusCity"/);
        assert.equal(c.p.now, '10-26 04:52');
        // the screen doesn't show another city's 12:50 as the owner's
        assert.equal(data.storyNow(c.p), '10-26 04:52');
        assert.equal(c.p.life.weather.here.place, 'Frankfurt am Main');
        await data.undoRound(c.m, c.p);
        await run(c.m, { now: '10-26 03:52', statusCity: 'Mara', events: [] });
        assert.equal(c.p.now, '10-26 04:50');
        // for this round only: a place like "cafe" may be in either city next time, so nothing is kept for it
        assert.equal(c.p.placeZones, undefined);
        assert.equal(data.statusMoment(c.p).at, '');
    });
});

test('the owner\'s place not a city name, or no weather app: the zone still comes from where they were read to be', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Mara', 'lunch break, call?')]);
    frankfurtPhone(c, { here: "Ren's flat" });
    await withTrackers([trk(2, '12:50', 'Seoul')], async () => {
        assert.equal(data.statusMoment(c.p).at, '10-26 04:50');
        await run(c.m, { now: '10-26 04:52', events: [] });
        assert.equal(c.p.now, '10-26 04:52');
        assert.equal(c.p.life.weather.here.place, "Ren's flat");
        const bare = { owner: 'Ren', now: '10-26 03:00', year: 2026, where: c.p.where };
        assert.equal(data.storyNow(bare), '10-26 04:50');
        assert.match(data.clockBlock(bare, data.storyNow(bare)), /Location: Frankfurt am Main\nSaved phone time: 10-26 03:00\nClock reference time: 10-26 04:50/);
    });
});

test('an old status line doesn\'t hold the clock back; a new one sets back a now that ran ahead of it', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'still up')]);
    frankfurtPhone(c);
    await withTrackers([trk(0, '03:00', 'Frankfurt am Main · kitchen', '흐림')], async () => {
        await run(c.m, { now: '10-26 06:30', events: [] });
        assert.equal(c.p.now, '10-26 06:30');
    });
    // the model ran ahead to 23:55; the next status line says 21:45 and the model, reading it, 21:50
    c.p.now = '10-26 23:55';
    T.chat.push(say('Ren', 'late dinner'));
    await withTrackers([trk(3, '21:45', 'Frankfurt am Main · kitchen', '흐림')], async () => {
        await run(c.m, { now: '10-26 21:50', events: [] });
        assert.equal(c.p.now, '10-26 21:50');
    });
});

// ---- 2차 점검: the scene's zone from every place the phone knows of, Korean names, a shop named after a city, no time
test('another character\'s phone is a zone too: a scene the phone can\'t place is not the owner\'s hour', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Mara', 'lunch break, call?')]);
    c.p.now = '10-26 03:00'; c.p.year = 2026;
    c.p.where = { at: 1, people: [{ name: 'Ren', city: 'Frankfurt am Main', local: '', lives: 'DE', tz: 'Europe/Berlin' }] };
    c.m.phones.mara = { owner: 'Mara', country: 'KR' };
    await withTrackers([trk(2, '12:50', 'the cafe')], async () => {
        assert.match(data.clockBlock(c.p, c.p.now, c.m), /Mara \(South Korea\): \+8 hours/);
        assert.equal(data.statusMoment(c.p, null, null, c.m).at, '');
        await run(c.m, { now: '10-26 04:52', statusCity: '', events: [] });
        assert.equal(c.p.now, '10-26 04:52');
        assert.equal(data.storyNow(c.p, null, c.m), '10-26 04:52');
    });
});

test('someone\'s own place ("Mara\'s room", "소망의 방" for Somang Park): where that person is; a city no one is in by its zone\'s name: the owner gone there', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Mara', 'lunch break, call?')]);
    frankfurtPhone(c);
    c.p.where.people[1].aka = ['마라']; // (read with the names the chat calls her by)
    c.p.where.people.push({ name: 'Somang Park', aka: ['소망'], city: 'Seoul', names: ['Seoul'], lives: 'KR', tz: 'Asia/Seoul' });
    for (const place of ["Mara's room", '마라네 집', '소망의 방', "Somang's flat", 'Somang Park 방']) {
        await withTrackers([trk(2, '12:50', place)], async () => assert.equal(data.statusMoment(c.p).at, '10-26 04:50', place));
    }
    // (the owner's own room is the owner's; a word that only starts like a name is no one's)
    await withTrackers([trk(2, '12:50', "Ren's flat")], async () => assert.deepEqual([data.statusMoment(c.p).at, data.statusMoment(c.p).home], ['10-26 12:50', true]));
    await withTrackers([trk(2, '12:50', 'Marathon track')], async () => assert.equal(data.statusMoment(c.p).at, ''));
    // Tokyo: in no one's row, a real zone's city: the owner's own hour there, before a 반영 moves them
    await withTrackers([trk(2, '12:50', 'Tokyo · hotel')], async () => assert.deepEqual([data.statusMoment(c.p).at, data.statusMoment(c.p).city], ['10-26 12:50', 'Tokyo']));
});

test('a Korean status line in a Korean story: the owner\'s own city by its Korean name, nothing asked', async () => {
    const c = setup([say('Ren', '퇴근'), say('Mara', '수고'), say('Ren', '카페 도착')]);
    c.p.now = '10-26 18:00'; c.p.year = 2026; c.p.country = 'KR';
    c.p.where = { at: 1, people: [{ name: 'Ren', city: 'Seoul', local: '서울', lives: 'KR', tz: 'Asia/Seoul' }, { name: 'Ivo', city: 'New York', lives: 'US', tz: 'America/New_York' }] };
    await withTrackers([trk(2, '19:10', '서울 강남 · 카페')], async () => {
        assert.equal(data.statusMoment(c.p).at, '10-26 19:10');
        await run(c.m, { now: '10-26 18:30', events: [] });
        assert.ok(!/"statusCity"/.test(T.sys));
        assert.equal(c.p.now, '10-26 19:10');
    });
    // a shop named after a city in another zone is no proof the scene is there
    c.p.where.people.push({ name: 'Varo', city: 'Paris', lives: 'FR', tz: 'Europe/Paris' });
    await withTrackers([trk(2, '19:30', 'Paris Baguette 강남점 · 창가')], async () => {
        assert.notEqual(data.statusMoment(c.p).at, '10-27 03:30');
        assert.equal(data.statusMoment(c.p).at, '');
    });
});

test('a status line with no time from a scene elsewhere doesn\'t take over the owner\'s weather', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Mara', 'so hot here')]);
    frankfurtPhone(c);
    await withTrackers([{ i: 2, date: '', min: null, time: '', place: "Mara's room", city: "Mara's room", weather: '맑음 22°C' }], async () => {
        await run(c.m, { now: '10-26 04:00', statusCity: 'Mara', events: [] });
        assert.deepEqual([c.p.life.weather.here.place, c.p.life.weather.here.temp], ['Frankfurt am Main', 4]);
    });
});

test('set back over New Year: the year before', async () => {
    const c = setup([say('Ren', 'happy new year'), say('Mara', 'not yet here'), say('Ren', 'oh right')]);
    c.p.now = '01-01 00:30'; c.p.year = 2027;
    await withTrackers([{ i: 2, date: '12.31', min: 23 * 60 + 50, time: '23:50', place: 'Frankfurt am Main', city: 'Frankfurt am Main', weather: '' }], async () => {
        await run(c.m, { now: '12-31 23:55', events: [] });
        assert.deepEqual([c.p.now, c.p.year], ['12-31 23:55', 2026]);
    });
});

test('the owner travels: the reflection says so, their clock is the new city\'s; undo puts the old one back', async () => {
    const c = setup([say('Ren', 'boarding'), say('Mara', 'see you soon'), say('Ren', 'landed in Seoul!')]);
    frankfurtPhone(c);
    await withTrackers([trk(2, '20:00', 'Seoul · Incheon airport')], async () => {
        await run(c.m, { now: '10-26 20:00', ownerCity: { city: 'Seoul', local: '서울', tz: 'Asia/Seoul' }, events: [] });
        assert.equal(c.p.where.people.find(x => x.name === 'Ren').city, 'Seoul');
        assert.equal(c.p.now, '10-26 20:00');
        assert.equal(data.statusMoment(c.p).home, true);
        await data.undoRound(c.m, c.p);
        assert.equal(c.p.where.people.find(x => x.name === 'Ren').city, 'Frankfurt am Main');
    });
});

test('a where-reading that fails is noted and not asked again on the next round', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'coffee?')]);
    globalThis.__where = []; globalThis.__whereFail = true;
    try {
        await run(c.m, { now: '10-26 09:30', events: [] });
        T.chat.push(say('Mara', 'yes please'));
        await run(c.m, { now: '10-26 09:40', events: [] });
        assert.equal(globalThis.__where.length, 1);
        assert.equal(c.p.where.failed, true);
    } finally { globalThis.__whereFail = false; }
});

test('a where-reading from before the city\'s own name was kept is read once more', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'coffee?')]);
    c.p.where = { at: 1, people: [{ name: 'Ren', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }] };
    globalThis.__where = [];
    await run(c.m, { now: '10-26 09:30', events: [] });
    T.chat.push(say('Mara', 'yes please'));
    await run(c.m, { now: '10-26 09:40', events: [] });
    assert.equal(globalThis.__where.length, 1);
    // nothing new read: what was there stays
    assert.equal(c.p.where.people[0].city, 'Seoul');
});

test('an English chat with Korean status lines: the city by any of its names, as the chat writes it', async () => {
    const c = setup([say('Ren', 'morning'), say('Mara', 'hey'), say('Mara', 'just had lunch')]);
    frankfurtPhone(c, { cities: false });
    c.p.where.people = [{ name: 'Ren', city: 'Frankfurt am Main', names: ['Frankfurt am Main', '프랑크푸르트'], lives: 'DE', tz: 'Europe/Berlin' },
        { name: 'Mara', city: 'Seoul', names: ['Seoul', '서울'], lives: 'KR', tz: 'Asia/Seoul' }];
    await withTrackers([trk(2, '12:50', '서울 · 마라 방')], async () => {
        assert.deepEqual([data.statusMoment(c.p).at, data.statusMoment(c.p).city], ['10-26 04:50', 'Seoul']);
    });
    // an older reading with one "local" still counts
    c.p.where.people[1] = { name: 'Mara', city: 'Seoul', local: '서울', lives: 'KR', tz: 'Asia/Seoul' };
    await withTrackers([trk(2, '12:50', '서울 · 마라 방')], async () => assert.equal(data.statusMoment(c.p).at, '10-26 04:50'));
});

test('a fill reading up to the phone\'s clock goes by the phone\'s now, not an older status line', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'later')]);
    c.p.now = '10-24 08:00'; c.p.year = 2026;
    await withTrackers([{ i: 1, date: '10.20', min: 21 * 60 + 45, time: '21:45', place: 'Seoul', city: 'Seoul', weather: '' }], async () => {
        assert.equal(data.storyNow(c.p, data.phoneAt(c.p)), '10-24 08:00');
        assert.equal(data.storyNow(c.p), '10-24 08:00');
    });
});

// ---- 점검 3묶음: 시차 · 반영
test('dates written day first (26.10., 26/10/2026, Mo, 26.10.) read as October 26, not as month 26', async () => {
    for (const d of ['26.10.', '26.10.2026', '26/10/2026', 'Mo, 26.10.']) assert.deepEqual(data.monthDay(d), { mo: 10, d: 26 }, d);
    assert.deepEqual(data.monthDay('30. Januar'), { mo: 1, d: 30 });
    const c = setup([say('Ren', 'a'), say('Mara', 'b'), say('Ren', 'c')]);
    c.p.now = '10-26 20:00'; c.p.country = 'DE';
    await withTrackers([{ ...trk(2, '21:45', 'Frankfurt · Küche'), date: '26.10.' }], async () => assert.equal(data.statusMoment(c.p).at, '10-26 21:45'));
});

test('a city of two words ("New York · flat", "New York City") is the owner\'s; a station or a district alone is not guessed', async () => {
    const c = setup([say('Ren', 'a'), say('Mara', 'b'), say('Ren', 'c')]);
    c.p.now = '10-26 08:00'; c.p.year = 2026;
    c.p.where = { at: 1, people: [{ name: 'Ren', city: 'New York', names: ['New York', '뉴욕'], lives: 'US', tz: 'America/New_York' },
        { name: 'Mara', city: 'Seoul', names: ['Seoul', '서울'], lives: 'KR', tz: 'Asia/Seoul' }] };
    for (const [place, home] of [["New York · Ren's flat", true], ["New York City · Ren's flat", true], ['뉴욕 맨해튼 · 집', true], ['Seoul Station · platform', null]])
        await withTrackers([trk(2, '09:10', place)], async () => assert.equal(data.sceneHome(c.p, place, c.m), home, place));
    // the owner's city from the weather app alone: its first word in a status line is the owner's
    const q = { owner: 'Ren', now: '10-26 08:00', year: 2026, life: { weather: { here: { place: 'Frankfurt am Main' }, cities: [{ name: 'Frankfurt am Main', tz: 'Europe/Berlin' }, { name: 'Seoul', ko: '서울', tz: 'Asia/Seoul' }] } } };
    await withTrackers([trk(2, '09:10', 'Frankfurt · Küche')], async () => assert.deepEqual([data.statusMoment(q).at, data.statusMoment(q).home], ['10-26 09:10', true]));
});

test('another phone\'s place reading tells where its owner is (Mara in Frankfurt with Ren, her phone set to KR)', async () => {
    const c = setup([say('Ren', 'a'), say('Mara', 'b'), say('Ren', 'c')]);
    c.p.now = '10-26 20:00'; c.p.year = 2026; c.p.country = 'DE'; c.p.where = { at: 1, people: [], failed: true };
    c.m.phones.mara = { owner: 'Mara', country: 'KR', where: { at: 1, people: [{ name: 'Mara', city: 'Frankfurt am Main', names: ['Frankfurt am Main', 'Frankfurt'], lives: 'KR', tz: 'Europe/Berlin' }] } };
    assert.ok(!/^- Mara.*: [+-]/m.test(data.clockBlock(c.p, c.p.now, c.m)));
    await withTrackers([trk(2, '20:10', 'Frankfurt · Bar')], async () => assert.equal(data.statusMoment(c.p, null, null, c.m).at, '10-26 20:10'));
});

test('an old place reading whose re-read fails is asked once, not every round', async () => {
    const c = setup([say('Ren', 'a'), say('Mara', 'b'), say('Ren', 'c')]);
    c.p.where = { at: 1, people: [{ name: 'Ren', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }] };
    globalThis.__where = []; globalThis.__whereFail = true;
    const warn = console.warn; console.warn = () => {};
    try {
        await run(c.m, { now: '10-26 09:30', events: [] });
        T.chat.push(say('Mara', 'd')); await run(c.m, { now: '10-26 09:40', events: [] });
        T.chat.push(say('Ren', 'e')); await run(c.m, { now: '10-26 09:50', events: [] });
    } finally { console.warn = warn; globalThis.__whereFail = false; }
    assert.equal(globalThis.__where.length, 1);
    assert.equal(c.p.where.people[0].city, 'Seoul');
});

test('a scene in Paris (same hour as Frankfurt) is not the owner\'s: the weather app stays Frankfurt\'s', async () => {
    const c = setup([say('Ren', 'a'), say('Varo', 'b'), say('Varo', 'sunny here in Paris')]);
    c.p.now = '10-26 10:00'; c.p.year = 2026; c.p.country = 'DE';
    c.p.where = { at: 1, people: [{ name: 'Ren', city: 'Frankfurt am Main', names: ['Frankfurt am Main', 'Frankfurt'], lives: 'DE', tz: 'Europe/Berlin' }, { name: 'Varo', city: 'Paris', names: ['Paris', '파리'], lives: 'FR', tz: 'Europe/Paris' }] };
    c.p.life = { at: '10-26 10:00', clock: { alarms: [], timers: [], running: null }, health: { usual: {}, days: [] }, files: { folders: [], items: [] },
        weather: { here: { place: 'Frankfurt am Main', date: '10-26', time: '10:00', cond: 'rain', temp: 6, hours: [], days: [], tiles: {} }, cities: [] } };
    await withTrackers([trk(2, '10:30', "Paris · Varo's flat", '맑음 22°C')], async () => {
        assert.equal(data.sceneHome(c.p, "Paris · Varo's flat", c.m), false);
        await run(c.m, { now: '10-26 10:35', events: [] });
    });
    assert.deepEqual([c.p.life.weather.here.place, c.p.life.weather.here.cond], ['Frankfurt am Main', 'rain']);
});

test('a status line sets the clock back a day at most, not two', async () => {
    const c = setup([say('Ren', 'a'), say('Mara', 'b'), say('Ren', 'c')]);
    c.p.now = '10-27 23:50'; c.p.year = 2026; c.p.country = 'KR';
    await withTrackers([{ ...trk(2, '00:10', '서울 · 집'), date: '10.26' }], async () => run(c.m, { now: '10-26 00:15', events: [] }));
    assert.equal(c.p.now, '10-27 23:50');
    // within a day: set back
    T.chat.push(say('Mara', 'd'));
    await withTrackers([{ ...trk(3, '08:00', '서울 · 집'), date: '10.27' }], async () => run(c.m, { now: '10-27 08:00', events: [] }));
    assert.equal(c.p.now, '10-27 08:00');
});

test('an archive section after the read stretch is not sent as the story before it', async () => {
    const S1 = '## #2–#3 — Bookstore\n- Ren went to the bookstore and bought the poetry book for 15000 won (#3).\n';
    const S2 = '## #4–#5 — Cafe\n- Mara and Ren met at the cafe; Mara said she is moving to Busan (#5).\n';
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), hide(say('Ren', 'going to the bookstore')), hide(say('Mara', 'did you get it')), hide(say('Ren', 'at the cafe now')), hide(say('Mara', 'I am moving to Busan')), say('Ren', 'see you later')]);
    c.m.text = S1.replace('\n- ', '\n- ' + 'x'.repeat(33000) + ' ') + S2;
    await run(c.m, { now: '10-26 13:00', events: [] });
    const i = T.input.indexOf('[ARCHIVE BEFORE]'), bf = i < 0 ? '' : T.input.slice(i, T.input.indexOf('\n\n[', i + 1) >>> 0 || undefined);
    assert.ok(!bf.includes('Busan'));
    assert.equal(data.syncLeft(c.p, c.m), 1);
});

test('되돌리기 holds the screen clock where the phone was until the next 반영; otherwise it follows the newest status line', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'off to work'), say('Mara', 'have a good day')]);
    c.p.now = '10-26 08:00'; c.p.year = 2026; c.p.country = 'KR';
    await withTrackers([{ ...trk(3, '09:10', '서울 · 회사'), date: '10.26' }], async () => {
        assert.equal(data.storyNow(c.p), '10-26 09:10');
        await run(c.m, { now: '10-26 09:10', events: [] });
        assert.equal(data.storyNow(c.p), '10-26 09:10');
        await data.undoRound(c.m, c.p);
        assert.ok(data.clockHeld(c.p));
        assert.equal(data.storyNow(c.p), '10-26 08:00');
        await run(c.m, { now: '10-26 09:10', events: [] });
        assert.ok(!data.clockHeld(c.p));
        assert.equal(data.storyNow(c.p), '10-26 09:10');
    });
});

test('a city in the owner\'s zone that isn\'t theirs (Busan for Seoul) keeps its hour but not their weather; a shop named after a far city is no proof', async () => {
    const c = setup([say('Ren', 'a'), say('Ivo', 'b'), say('Ivo', 'c')]);
    c.p.now = '10-26 18:00'; c.p.year = 2026; c.p.country = 'KR';
    c.p.where = { at: 1, people: [{ name: 'Ren', city: 'Seoul', names: ['Seoul', '서울'], lives: 'KR', tz: 'Asia/Seoul' }, { name: 'Ivo', city: 'Busan', names: ['Busan', '부산'], lives: 'KR', tz: 'Asia/Seoul' },
        { name: 'Varo', city: 'New York', names: ['New York', '뉴욕'], lives: 'US', tz: 'America/New_York' }] };
    assert.equal(data.sceneHome(c.p, "부산 · Ivo's flat", c.m), false);
    assert.equal(data.sceneHome(c.p, '서울 강남 · 카페', c.m), true);
    await withTrackers([trk(2, '18:30', "부산 · Ivo's flat")], async () => assert.equal(data.statusMoment(c.p, null, null, c.m).at, '10-26 18:30'));
    await withTrackers([trk(2, '19:00', 'New York Bagels, Gangnam')], async () => assert.notEqual(data.statusMoment(c.p, null, null, c.m).at, '10-27 08:00'));
});

test('상태창 날짜 순서: asked once per chat, month first until then; a chat set to 일.월 reads "03.11." as November 3', async () => {
    const m = {};
    assert.ok(data.needsDateOrder(m));
    assert.equal(data.dateOrderOf(m), 'md');
    await data.setDateOrder(m, 'dm');
    assert.ok(!data.needsDateOrder(m));
    assert.equal(data.dateOrderOf(m), 'dm');
    T.meta = { narrative_archive: { dateOrder: 'dm' } };
    try {
        assert.deepEqual(data.monthDay('Di, 03.11. 18:10'), { mo: 11, d: 3 });
        T.meta = { narrative_archive: { dateOrder: 'md' } };
        assert.deepEqual(data.monthDay('11.03, 12:33'), { mo: 11, d: 3 });
        assert.deepEqual(data.monthDay('03.11.'), { mo: 3, d: 11 });
    } finally { T.meta = { integrity: 'main-mark' }; }
});

test('a phone that knows no other city: a scene not among the owner\'s places is asked about, and a named city keeps the owner\'s clock and weather', async () => {
    const c = setup([say('Ren', 'a'), say('Mara', 'b'), say('Mara', 'c')]);
    c.p.now = '10-26 10:50'; c.p.year = 2026; c.p.country = 'KR';
    c.p.where = { at: 1, people: [{ name: 'Ren', city: 'Seoul', names: ['Seoul', '서울'], lives: 'KR', tz: 'Asia/Seoul' }] };
    c.p.life = { at: '10-26 10:50', clock: { alarms: [], timers: [], running: null }, health: { usual: {}, days: [] }, files: { folders: [], items: [] },
        weather: { here: { place: 'Seoul', date: '10-26', time: '10:50', cond: 'clear', temp: 15, hours: [], days: [], tiles: {} }, cities: [] } };
    await withTrackers([trk(2, '03:00', "Frankfurt · Mara's hotel", '흐림 2°C')], async () => {
        await run(c.m, { now: '10-26 03:05', statusCity: { city: 'Frankfurt am Main', tz: 'Europe/Berlin' }, events: [] });
    });
    assert.ok(T.sys.includes('"statusCity"'));
    assert.equal(c.p.now, '10-26 11:00');
    assert.deepEqual([c.p.life.weather.here.place, c.p.life.weather.here.cond], ['Seoul', 'clear']);
});

test('the reflection says someone else is now in another city: their row moves there', async () => {
    const c = setup([say('Ren', 'a'), say('Mara', 'b'), say('Mara', 'I am staying in Frankfurt for a month now')]);
    c.p.where = { at: 1, people: [{ name: 'Ren', city: 'Frankfurt am Main', names: ['Frankfurt am Main', 'Frankfurt'], lives: 'DE', tz: 'Europe/Berlin' }, { name: 'Mara', city: 'Seoul', names: ['Seoul', '서울'], lives: 'KR', tz: 'Asia/Seoul' }] };
    await run(c.m, { now: '10-26 13:00', elsewhere: [{ name: 'Mara', city: 'Frankfurt am Main', names: ['Frankfurt', '프랑크푸르트'], tz: 'Europe/Berlin' }], events: [] });
    const mara = c.p.where.people.find(x => x.name === 'Mara');
    assert.deepEqual([mara.city, mara.tz, mara.lives], ['Frankfurt am Main', 'Europe/Berlin', 'KR']);
    assert.ok(T.sys.includes('"moved"'));
});

test('a scene the phone asks about (not yet placed) goes to the model with its place and weather only, no hour', async () => {
    const c = setup([say('Ren', 'a'), say('Mara', 'b'), say('Mara', 'c')]);
    c.p.now = '10-26 10:50'; c.p.year = 2026; c.p.country = 'KR';
    c.p.where = { at: 1, people: [{ name: 'Ren', city: 'Seoul', names: ['Seoul', '서울'], lives: 'KR', tz: 'Asia/Seoul' }] };
    c.p.life = { at: '10-26 10:50', clock: { alarms: [], timers: [], running: null }, health: { usual: {}, days: [] }, files: { folders: [], items: [] },
        weather: { here: { place: 'Seoul', date: '10-25', time: '10:50', cond: 'clear', temp: 15, hours: [], days: [], tiles: {} }, cities: [] } };
    await withTrackers([trk(2, '03:00', "Frankfurt · Mara's hotel", '흐림 2°C')], async () => run(c.m, { now: '10-26 11:00', events: [] }));
    const w = (T.input.match(/\[WEATHER NOW\]\n(.*)/) || [])[1] || '';
    assert.ok(w && !w.includes('"time"'), w);
});

test('the owner\'s scene at a place that is no city ("Mara\'s room", "Gangnam · cafe"): the weather app keeps its city, the line\'s sky goes in', async () => {
    for (const [place, said, want] of [["Mara's room", 'Seoul', 'Seoul'], ['Gangnam · cafe', 'Seoul', 'Seoul'], ['Rome · hotel', 'Rome', 'Rome'], ["Mara's room", "Mara's room", 'Seoul']]) {
        const c = setup([say('Ren', 'a'), say('Mara', 'b'), say('Mara', 'c')]);
        c.p.now = '10-26 10:50'; c.p.year = 2026; c.p.country = 'KR';
        c.p.where = { at: 1, people: [{ name: 'Ren', city: 'Seoul', names: ['Seoul', '서울'], lives: 'KR', tz: 'Asia/Seoul' }] };
        c.p.life = { at: '10-26 10:50', clock: { alarms: [], timers: [], running: null }, health: { usual: {}, days: [] }, files: { folders: [], items: [] },
            weather: { here: { place: 'Seoul', date: '10-26', time: '10:50', cond: 'clear', temp: 15, hours: [], days: [], tiles: {} }, cities: [] } };
        await withTrackers([trk(2, '11:20', place, '비 12°C')], async () => run(c.m, { now: '10-26 11:20', statusCity: 'owner', weather: { place: said, date: '10-26', time: '11:20', cond: 'rain', temp: 12, from: 'chat' }, events: [] }));
        assert.deepEqual([c.p.life.weather.here.place, c.p.life.weather.here.cond], [want, 'rain'], place + ' / ' + said);
    }
});

test('a status line\'s scene named by a person the same answer says is in another city ("Mara", elsewhere: Frankfurt) is placed there', async () => {
    const c = setup([say('Ren', 'a'), say('Mara', 'b'), say('Mara', 'c')]);
    c.p.now = '10-26 10:50'; c.p.year = 2026; c.p.country = 'KR';
    c.p.where = { at: 1, people: [{ name: 'Ren', city: 'Seoul', names: ['Seoul', '서울'], lives: 'KR', tz: 'Asia/Seoul' }] };
    await withTrackers([trk(2, '03:00', "Hotel Ivo · lobby", '흐림 2°C')], async () =>
        run(c.m, { now: '10-26 03:05', statusCity: 'Mara', elsewhere: [{ name: 'Mara', city: 'Frankfurt am Main', names: ['Frankfurt'], tz: 'Europe/Berlin' }], events: [] }));
    assert.equal(c.p.now, '10-26 11:00');
});

// ---- 점검 2차: statusCity · elsewhere · 날씨 앱 도시
const seoulPhone = c => {
    c.p.now = '10-26 10:50'; c.p.year = 2026; c.p.country = 'KR';
    c.p.where = { at: 1, failed: true, people: [{ name: 'Ren', city: 'Seoul', names: ['Seoul', '서울'], lives: 'KR', tz: 'Asia/Seoul' }, { name: 'Ivo', city: 'Busan', names: ['Busan', '부산'], lives: 'KR', tz: 'Asia/Seoul' }] };
    c.p.life = { at: '10-26 10:50', clock: { alarms: [], timers: [], running: null }, health: { usual: {}, days: [] }, files: { folders: [], items: [] },
        weather: { here: { place: 'Seoul', date: '10-26', time: '10:50', cond: 'clear', temp: 15, hours: [], days: [], tiles: {} }, cities: [{ name: 'New York City', tz: 'America/New_York' }] } };
};
test('statusCity: another person in the owner\'s zone (Ivo in Busan) is not the owner\'s weather; the owner\'s name is the owner; "New York" is the saved "New York City"', async () => {
    let c = setup([say('Ren', 'a'), say('Ivo', 'b'), say('Ivo', 'c')]); seoulPhone(c);
    await withTrackers([trk(2, '11:00', 'Haeundae beach', '비 12°C')], async () => run(c.m, { now: '10-26 11:00', statusCity: 'Ivo', weather: { place: 'Busan', cond: 'rain', temp: 12, from: 'chat' }, events: [] }));
    assert.deepEqual([c.p.life.weather.here.place, c.p.life.weather.here.cond], ['Seoul', 'clear']);
    c = setup([say('Ren', 'a'), say('Ivo', 'b'), say('Ren', 'c')]); seoulPhone(c);
    await withTrackers([trk(2, '11:40', 'Strange Place', '맑음')], async () => run(c.m, { now: '10-26 11:10', statusCity: 'Ren', events: [] }));
    assert.equal(c.p.now, '10-26 11:40');
    c = setup([say('Ren', 'a'), say('Ivo', 'b'), say('Varo', 'c')]); seoulPhone(c);
    await withTrackers([trk(2, '21:00', 'Somewhere Bar', '맑음')], async () => run(c.m, { now: '10-26 11:05', statusCity: 'New York', events: [] }));
    assert.equal(c.p.now, '10-27 10:00');
});

test('elsewhere takes only people (not "everyone" or "the courier") and keeps the place reading\'s failed mark; the owner gone to Bangkok gets "방콕" in the weather app', async () => {
    const c = setup([say('Ren', 'a'), say('Mara', 'b'), say('Mara', 'everyone landed in Paris, Varo too')]); seoulPhone(c);
    await run(c.m, { now: '10-26 11:00', elsewhere: [{ name: 'everyone', city: 'Paris', tz: 'Europe/Paris' }, { name: 'the courier', city: 'Paris', tz: 'Europe/Paris' }, { name: 'Varo', city: 'Paris', tz: 'Europe/Paris' }], events: [] });
    assert.deepEqual(c.p.where.people.map(x => x.name).sort(), ['Ivo', 'Ren', 'Varo']);
    assert.equal(c.p.where.failed, true);
    const d = setup([say('Ren', 'a'), say('Mara', 'b'), say('Ren', 'landed in Bangkok')]); seoulPhone(d);
    await withTrackers([trk(2, '13:00', '방콕 · 호텔', '맑음 31°C')], async () => run(d.m, { now: '10-26 13:00', ownerCity: { city: 'Bangkok', names: ['방콕', 'Bangkok'], tz: 'Asia/Bangkok' }, weather: { place: '방콕', cond: 'clear', temp: 31, from: 'chat' }, events: [] }));
    assert.equal(d.p.life.weather.here.place, '방콕');
});

test('"moved": one list for everyone these messages put in another city, the owner by name or as "owner"', async () => {
    for (const who of ['Ren', 'owner']) {
        const c = setup([say('Ren', 'a'), say('Mara', 'b'), say('Ren', 'we both landed in Rome')]);
        c.p.now = '10-26 10:00'; c.p.year = 2026;
        c.p.where = { at: 1, people: [{ name: 'Ren', city: 'Frankfurt am Main', names: ['Frankfurt am Main'], lives: 'DE', tz: 'Europe/Berlin' }, { name: 'Mara', city: 'Seoul', names: ['Seoul'], lives: 'KR', tz: 'Asia/Seoul' }] };
        await run(c.m, { now: '10-26 13:00', moved: [{ name: who, city: 'Rome', names: ['Rome', '로마'], tz: 'Europe/Rome' }, { name: 'Mara', city: 'Rome', names: ['Rome'], tz: 'Europe/Rome' }], events: [] });
        const by = Object.fromEntries(c.p.where.people.map(x => [x.name, [x.city, x.tz]]));
        assert.deepEqual(by, { Ren: ['Rome', 'Europe/Rome'], Mara: ['Rome', 'Europe/Rome'] }, who);
        assert.ok(!T.sys.includes('"ownerCity"') && !T.sys.includes('"elsewhere"'));
    }
});

test('what the user set in 위치 정보 a reflection doesn\'t undo: the owner\'s city by hand stays, someone taken off isn\'t put back', async () => {
    const c = setup([say('Ren', 'a'), say('Mara', 'b'), say('Mara', 'Ivo flew to Rome and I am in Rome too')]);
    c.p.where = { at: 1, removed: ['ivo'], people: [{ name: 'Ren', city: 'Frankfurt', names: ['Frankfurt'], lives: 'DE', tz: 'Europe/Berlin', manual: { city: true } }, { name: 'Mara', city: 'Seoul', names: ['Seoul'], lives: 'KR', tz: 'Asia/Seoul' }] };
    await run(c.m, { now: '10-26 13:00', ownerCity: { city: 'Rome', tz: 'Europe/Rome' }, elsewhere: [{ name: 'Ivo', city: 'Rome', tz: 'Europe/Rome' }, { name: 'Mara', city: 'Rome', tz: 'Europe/Rome' }], events: [] });
    const by = Object.fromEntries(c.p.where.people.map(x => [x.name, x.city]));
    assert.deepEqual(by, { Ren: 'Frankfurt', Mara: 'Rome' });
});

test('manual city lookup resolves known aliases without a country or owner-zone fallback', async () => {
    const { m, p } = setup([]);
    p.country = 'KR'; p.lives = 'US'; p.year = 2026;
    p.where = { at: 1, people: [{ name: 'Ren', city: 'Seoul', names: ['Seoul', '서울'], tz: 'Asia/Seoul', lives: 'US' },
        { name: 'Mara', city: 'Frankfurt am Main', names: ['Frankfurt', '프랑크푸르트'], tz: 'Europe/Berlin', lives: 'DE' }] };
    for (const [city, country, tz] of [['San Francisco', 'US', 'America/Los_Angeles'], ['샌프란시스코', 'US', 'America/Los_Angeles'],
        ['밴쿠버', 'CA', 'America/Vancouver'], ['Los Angeles', 'US', 'America/Los_Angeles'], ['Toronto', 'CA', 'America/Toronto'],
        ['프랑크푸르트', 'DE', 'Europe/Berlin'], ['서울', 'KR', 'Asia/Seoul'], ['America/Chicago', 'US', 'America/Chicago']]) {
        assert.equal(data.tzForCity(p, city, country), tz, city);
    }
    for (const country of ['US', 'CA', 'KR', '']) assert.equal(data.tzForCity(p, 'Unknown City', country), '');
    const before = structuredClone(p);
    await assert.rejects(() => data.setPlaceCity(m, p, 'New Person', 'Unknown City'), err => /어느 나라 도시인지/.test(err.message) && err.askCountry === true);
    assert.deepEqual(p, before, 'an unresolved city leaves no partial person or manual setting');
    await data.setPlaceCity(m, p, 'Ren', 'San Francisco');
    assert.equal(p.where.people[0].tz, 'America/Los_Angeles');
    assert.equal(p.where.people[0].manual.city, true);
    assert.equal(p.where.people[0].lives, 'US');
});

test('manual city lookup respects saved city zones and refuses conflicting saved aliases', () => {
    const p = { owner: 'Ren', country: 'US', life: { weather: { cities: [{ name: 'Vancouver', ko: '밴쿠버', tz: 'America/Vancouver' }] } },
        where: { people: [{ name: 'Ren', city: 'Springfield', tz: 'America/Chicago' }, { name: 'Mara', city: 'Springfield', tz: 'America/New_York' }] } };
    assert.equal(data.tzForCity(p, '밴쿠버', 'CA'), 'America/Vancouver');
    assert.equal(data.tzForCity(p, 'Springfield', 'US'), '');
    p.life.weather.cities = [{ name: 'Springfield', tz: 'America/Chicago' }, { name: 'Springfield', tz: 'America/New_York' }];
    p.where.people = [];
    assert.equal(data.tzForCity(p, 'Springfield'), '', 'weather cities must not choose the first conflicting match');
    p.life.weather.cities = [{ name: 'Berlin', tz: 'Europe/Berlin' }];
    assert.equal(data.tzForCity(p, 'Berlin, New Hampshire'), '', 'a place qualifier cannot be discarded');
    p.where.people = [{ name: 'Ren', city: 'Berlin', tz: 'America/New_York' }];
    assert.equal(data.tzForCity(p, 'Berlin'), '', 'conflicts across weather and people are ambiguous too');
    p.where.people = [{ name: 'Ren', city: 'Berlin', tz: 'Europe/Berlin' }];
    assert.equal(data.tzForCity(p, 'Berlin'), 'Europe/Berlin', 'agreement across sources is safe');
});

test('a slow day: each 반영 the same day writes today\'s totals so far, never lower than what was there; 되돌리기 takes it back', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'still at the office'), say('Mara', 'coffee?')]);
    c.p.now = '10-26 12:00'; c.p.year = 2026;
    const today = () => c.p.life.health.days.find(d => d.date === '10-26');
    c.p.life = { at: '10-26 12:00', clock: { alarms: [], timers: [], running: null }, files: { folders: [], items: [] }, weather: { here: { place: 'Frankfurt', date: '10-26', time: '12:00', cond: 'cloudy', temp: 9, hours: [], days: [], tiles: {} }, cities: [] },
        health: { usual: { steps: 7000 }, days: [{ id: 'h1', date: '10-26', steps: 3000, km: 2.2, coffee: 2, hr: [58, 120], screen: { apps: { WhatsApp: 60 }, pickups: 30 }, workout: { kind: 'Running', time: '07:00', min: 30, km: 5 }, from: 'pattern' }] } };
    await run(c.m, { now: '10-26 20:00', days: [{ date: '10-26', steps: 2500, coffee: 3, hr: [62, 140], workouts: [{ kind: 'Yoga', time: '19:00', min: 45 }], screen: { apps: { WhatsApp: 50, Instagram: 40 }, pickups: 45 } }], events: [] });
    // the morning run and the evening yoga both; the heart range only widens
    assert.deepEqual(today().workouts.map(w => `${w.kind} ${w.time} ${w.min}`), ['Running 07:00 30', 'Yoga 19:00 45']);
    assert.equal(today().workout.kind, 'Yoga');
    assert.deepEqual(today().hr, [58, 140]);
    assert.match(T.sys, /"workouts": \[\{ "kind", "time", "min", "km" \}\]/);
    assert.match(T.sys, /Today's row always, with totals so far \(steps, workouts, coffee, water, "screen"\)\./);
    assert.deepEqual([today().steps, today().coffee, today().screen.apps, today().screen.pickups], [3000, 3, { WhatsApp: 60, Instagram: 40 }, 45]);
    // (told in an event: more steps go in)
    T.chat.push(say('Ren', 'walked all the way home'));
    await run(c.m, { now: '10-26 21:00', events: [{ id: 'walk', at: 4, quote: 'walked all the way home', summary: 'walk', date: '10-26', time: '20:30', phone: { health: [{ date: '10-26', steps: 9100 }] } }] });
    assert.equal(today().steps, 9100);
    await data.undoRound(c.m, c.p);
    await data.undoRound(c.m, c.p);
    assert.deepEqual([today().steps, today().coffee, today().screen.apps, today().screen.pickups], [3000, 2, { WhatsApp: 60 }, 30]);
    assert.deepEqual([today().workout.kind, today().workouts, today().hr], ['Running', undefined, [58, 120]]);
});

test('반영\'s everyday records: so many an answer and a day in each app, texts and calls for each person; the story\'s own have no limit', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'off to work'), say('Mara', 'have a good one')]);
    c.p.now = '10-26 08:00'; c.p.year = 2026;
    c.p.around = { at: 1, people: [{ name: 'Ivo', aka: ['이보'], about: 'Ren\'s older brother; Ren resents him and answers his texts late.' }] };
    const note = (title, x = {}) => ({ title, text: title, time: '10-26 09:10', everyday: true, ...x });
    const txt = (who, n, h) => ({ with: who, messages: Array.from({ length: n }, (_, i) => ({ from: who, text: `${who} ${h}:${i}`, time: `10-26 ${h}:${String(10 + i).padStart(2, '0')}`, everyday: true })) });
    await run(c.m, { now: '10-26 09:30', events: [{ id: 'e2', at: 2, quote: 'off to work', summary: 'work', date: '10-26', time: '09:00', phone: {
        notes: [note('Einkaufsliste'), note('Zahnarzt anrufen')], threads: [txt('Ivo', 4, '09'), txt('Lena', 2, '09')],
        // (the story's own texts: all of them)
        searches: [{ q: 'Ren train times', time: '10-26 09:00' }] } }] });
    const guess = k => (k === 'threads' ? c.p.threads.flatMap(th => th.messages.filter(x => x.src === 'guess').map(x => x.text)) : c.p[k].filter(x => x.src === 'guess').map(x => x.title || x.caption || x.with));
    // (a day so far, not a reflection: at 09:30 one note of the day's two, each exchange whole)
    assert.deepEqual(guess('notes'), ['Einkaufsliste']);
    assert.deepEqual(guess('threads').sort(), ['Ivo 09:0', 'Ivo 09:1', 'Ivo 09:2', 'Ivo 09:3', 'Lena 09:0', 'Lena 09:1']);
    assert.ok(c.p.searches.some(x => x.q === 'Ren train times' && x.src !== 'guess'));
    // (the reflection writes them itself, in the same answer)
    assert.match(T.sys, /\nSTEP 3 · RECORDS\n/);
    assert.ok(!T.sys.includes('only when the archive or chat shows the owner recorded one'));
    assert.ok(data.AI_SYS_PHONE.includes('only when the archive or chat shows the owner recorded one'));
    // (making a phone: what happened in the chat after the archive counts too)
    assert.ok(data.AI_SYS_PHONE.includes('only if the archive, lorebook or chat has them') && data.AI_SYS_PHONE.includes('The diary holds only what the archive or chat shows happened'));
    assert.match(T.sys, /PEOPLE AROUND \(people in their life, where things stand\)/);
    assert.match(T.input, /\[PEOPLE AROUND\]\n- Ivo \(이보\): Ren's older brother/);
    // the rest of the day: Ivo up to 16 texts a day, notes up to 2
    for (const [i, h] of [[4, '11'], [5, '13'], [6, '15'], [7, '17']]) {
        T.chat.push(say('Ren', `later ${i}`));
        await run(c.m, { now: `10-26 ${h}:40`, events: [{ id: `e${i}`, at: i, quote: `later ${i}`, summary: 's', date: '10-26', time: `${h}:00`, phone: { threads: [txt('Ivo', 3, h)], notes: [note(`Notiz ${i}`, { time: `10-26 ${h}:05` })] } }] });
    }
    // (by 17:40 the day so far: 11 texts with Ivo, both notes)
    assert.equal(guess('threads').filter(x => x.startsWith('Ivo')).length, 11);
    assert.equal(guess('notes').length, 2);
    T.chat.push(say('Ren', 'late'));
    await run(c.m, { now: '10-26 23:10', events: [{ id: 'e8', at: 8, quote: 'late', summary: 's', date: '10-26', time: '23:00', phone: { threads: [txt('Ivo', 8, '23')], notes: [note('Notiz 8', { time: '10-26 23:05' })] } }] });
    assert.equal(guess('threads').filter(x => x.startsWith('Ivo')).length, 16);
    assert.equal(guess('notes').length, 2);
});

test('the answer\'s own "everyday": marked as everyday records, on the round\'s last event (되돌리기 takes them); a round with no event gets one', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'off to work'), say('Mara', 'have a good one')]);
    c.p.now = '10-26 08:00'; c.p.year = 2026;
    const guess = () => [...['notes', 'photos', 'diary', 'calls'].flatMap(k => c.p[k].filter(x => x.src === 'guess').map(x => `${k}:${x.title || x.caption || x.with}`)),
        ...c.p.threads.flatMap(th => th.messages.filter(x => x.src === 'guess').map(x => `text:${th.with}:${x.text}`))];
    await run(c.m, { now: '10-26 09:30', events: [{ id: 'work', at: 2, quote: 'off to work', summary: 'work', date: '10-26', time: '09:00', phone: {} }],
        everyday: { threads: [{ with: 'Ivo', messages: [{ from: 'Ivo', text: 'Mittag?', time: '10-26 09:20' }] }], notes: [{ title: 'Einkaufsliste', text: 'Milch', time: '10-26 09:10' }], photos: [{ caption: 'Himmel', time: '10-26 09:15' }] } });
    // (each app its own: a text, a note and a photo all go in)
    assert.equal(guess().length, 3);

    // a round with nothing but small talk: its last message carries them
    T.chat.push(say('Mara', 'just bored at my desk'));
    await run(c.m, { now: '10-26 19:00', events: [], everyday: { diary: [{ date: '10-26', title: 'Büro', text: 'Langweilig.' }] } });
    assert.ok(guess().includes('diary:Büro'));
    await data.undoRound(c.m, c.p);
    assert.ok(!guess().includes('diary:Büro'));
    assert.equal(guess().length, 3);
});

test('calls one after another from the same person (34 missed) are one row with its count; the shape says so', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'phone off all night'), say('Mara', 'Ivo called you like crazy')]);
    c.p.now = '10-26 08:00'; c.p.year = 2026;
    const missed = (t, x = {}) => ({ with: 'Ivo', type: 'missed', time: `10-26 ${t}`, ...x });
    await run(c.m, { now: '10-26 09:00', events: [{ id: 'calls', at: 3, quote: 'Ivo called you like crazy', summary: 'calls', date: '10-26', time: '08:30', phone: {
        calls: [missed('01:10'), missed('01:12'), missed('01:15', { count: 30 }), missed('01:40', { count: 2 }), { with: 'Ren', type: 'in', time: '10-26 07:00', min: 3 }, missed('07:30')] } }] });
    const ivo = c.p.calls.filter(x => x.with === 'Ivo');
    assert.deepEqual(ivo.map(x => [x.time, x.count]), [['10-26 01:40', 34], ['10-26 07:30', undefined]]);
    assert.match(T.sys, /"count": calls in a row/);
});

test('일상 comes in the reflection\'s own answer (no request of its own); who the owner had a scene with it reads from the messages itself', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'Varo gave me the cafe job at my desk'), say('Mara', 'then Ivo came by and we fought')]);
    c.p.now = '10-26 08:00'; c.p.year = 2026;
    c.p.around = { at: 1, people: [{ name: 'Ivo', aka: ['이보'], about: 'Ren\'s older brother; they fight and text short and sharp.' }, { name: 'Varo Lind', about: 'Ren\'s boss; texts only a file name and a date.' }, { name: 'Lio', about: 'ex; not in touch.' }] };
    globalThis.__everydayIn = [];
    globalThis.__everyday = { everyday: { threads: [{ with: 'Ivo', messages: [{ from: 'Ivo', text: 'you started it', time: '10-26 09:40' }, { from: 'me', text: 'whatever', time: '10-26 09:52' }] }], searches: [{ q: 'Mittagstisch Seongsu', time: '10-26 09:10' }] } };
    try {
        await run(c.m, { now: '10-26 09:45', events: [{ id: 'job', at: 2, quote: 'Varo gave me the cafe job', summary: 'Varo gave the cafe job', date: '10-26', time: '09:00', phone: { notes: [{ title: 'Cafe job', text: 'from Varo', time: '10-26 09:05' }] } }] });
    } finally { delete globalThis.__everyday; }
    // one request: the reflection's own, asked for its everyday too
    assert.equal(globalThis.__everydayIn.length, 1);
    const got = globalThis.__everydayIn.at(-1), sys = T.sys;
    for (const b of ['[NEW MESSAGES]', '[PHONE NOW]', '[PEOPLE AROUND]', '[OWNER]']) assert.ok(got.includes(b), b);
    // (점검 8: no list of names the code found in the text: the model reads the messages)
    assert.ok(!got.includes('[SCENES WITH]') && !got.includes('[PUT ON THE PHONE NOW]'));
    assert.ok(!sys.includes('SCENES WITH') && !sys.includes('PUT ON THE PHONE NOW'));
    // (no forced text after a scene: a text after a fight is part of the story's trail)
    assert.ok(!sys.includes('parted from'));
    assert.match(sys, /\nSTEP 3 · RECORDS\nGo through each scene's messages in order\. Write a record only in these cases, with "scene", "at", "said" \(the exact words it comes from\) and "situations":/);
    assert.match(sys, /A record says no more than its "said"\. Nothing else goes in "records"\./);
    assert.match(sys, /7\. Every record, in "records" or "everyday", lists in "situations" each situation it mentions or touches, and keeps to what each one's state allows\./);
    assert.match(sys, /c\. PEOPLE AROUND: contact both ways; group chats go on without the owner\./);
    assert.match(sys, /new plausible ones with local names \(each with a "contact"\)/);
    assert.match(sys, /no one they are no longer in touch with\./);
    assert.ok(!sys.includes("DO NOT CONTINUE THE STORY") && !sys.includes("SCENES AND RECORDS") && sys.indexOf("\nSTEP 1 · SCENES\n") > sys.indexOf("CLOCK FIRST"));
    assert.match(sys, /"everyday": \[\{ "date": "MM-DD", "records": \[/);
    const guess = [...c.p.threads.flatMap(th => th.messages.filter(x => x.src === 'guess').map(x => `${th.with}:${x.text}`)), ...c.p.searches.filter(x => x.src === 'guess').map(x => x.q)];
    assert.deepEqual(guess.sort(), ['Ivo:whatever', 'Ivo:you started it', 'Mittagstisch Seongsu']);
    // (a time after the round's now, 09:52 for 09:45, is the now)
    assert.equal(c.p.threads.find(th => th.with === 'Ivo').messages.find(x => x.text === 'whatever').time, '10-26 09:45');
    // an "everyday" of the wrong shape is left out; the round goes in
    T.chat.push(say('Ren', 'quiet afternoon'));
    await run(c.m, { now: '10-26 15:00', events: [], everyday: [{ title: 'x' }] });
    assert.ok(c.p.sync.done.flat().includes(4));
});

test('the reflection\'s own instructions: one list of records, the story\'s and the owner\'s own life; so many a day', () => {
    const on = data.coreSystem({ life: true }), plain = data.coreSystem(), onW = data.coreSystem({ life: true, weather: true });
    for (const k of ['STEP 1 · SCENES', 'STEP 2 · SITUATIONS', 'STEP 3 · RECORDS', 'STEP 4 · EVERYDAY', 'STEP 5 · EACH APP', 'HEALTH', 'SCREEN TIME', 'WEATHER', 'KEEPING IN STEP', 'LANGUAGE']) assert.ok(onW.includes(`\n${k}\n`), k);
    // (the steps in order, after CLOCK FIRST; nothing of the old sections left)
    const at = k => onW.indexOf(`\n${k}\n`);
    assert.ok(at('CLOCK FIRST') < at('STEP 1 · SCENES') && at('STEP 1 · SCENES') < at('STEP 2 · SITUATIONS') && at('STEP 2 · SITUATIONS') < at('STEP 3 · RECORDS') && at('STEP 3 · RECORDS') < at('STEP 4 · EVERYDAY') && at('STEP 4 · EVERYDAY') < at('STEP 5 · EACH APP'));
    for (const old of ['DO NOT CONTINUE THE STORY', 'SCENES AND RECORDS', 'THE APPS', 'IN THEIR OWN WORDS', '"advances"', 'role-play writer']) assert.ok(!onW.includes(old), old);
    // (the times in CLOCK FIRST; their own TIMES only when an archive-only round has no CLOCK FIRST)
    assert.ok(!on.includes('\nTIMES\n') && on.includes('Every record\'s time is on the owner\'s clock'));
    const arch = data.coreSystem({ life: true, archiveOnly: true });
    assert.ok(arch.includes('\nTIMES\n- Times are "MM-DD HH:MM"') && !arch.includes('CLOCK FIRST'));
    // (GOAL)
    assert.match(on, /^STAGE: core\nGOAL\nWrite what the owner's phone gains from NEW MESSAGES\. The story decides what happens; the phone only shows it\.\n\nYOU GET/);
    // (STEP 1)
    assert.match(on, /3\. "with": only people physically in the same place as the owner\. Not people mentioned, remembered, texted or called\./);
    // (STEP 2: where things stand, and what each state allows)
    assert.match(on, /"known": only what these give, in their words\. "open": what they leave unknown \(reasons, outcomes, amounts, durations, places, what really happened\)\. Anything in OWNER DOESN'T KNOW is "open"\./);
    assert.match(on, /Only NEW MESSAGES change it\. A passing date, an eta or a natural next step never does\./);
    assert.match(on, /   sent: tracking checks, waiting, asking when\. Not: arrival, opening, photos, wearing, thanks, even on or after the eta\./);
    assert.match(on, /   blocked: complaints, worry, living around it\. Not: any step to resolve it \(documents, visits, mails, inquiries, procedure searches, prep memos\)\./);
    assert.match(on, /Nothing in "open" is stated or guessed as fact: no text, memo, search, mail or diary fills it\. The owner may ask; no one answers\./);
    assert.ok(on.includes('PHONE NOW and ORDERS AND TICKETS') === false && data.coreSystem({ life: true, wallet: true }).includes('STORY NOW, PHONE NOW and ORDERS AND TICKETS: a parcel'));
    // (STEP 3: the cases)
    assert.match(on, /2\. A plan made → "calendar"\. A PHONE NOW plan the messages move → its calendar record again with "was"; called off or undone \(an order cancelled\) → "cancelled": true\. No booking, trip or purchase the story lacks\./);
    assert.match(on, /3\. Each scene where the owner is somewhere → one "visit"\./);
    assert.ok(on.includes('5. An alarm or file the messages set or change → that record.') && !plain.includes('5. An alarm or file'));
    // (STEP 4: hours, amount, sources; a later text is not forced)
    assert.match(on, /2\. Amount: about 15 records per full waking day, fewer for part of one\. A full day uses at least 8 of their apps \(texts, calls, photos, searches, notes, mails, posts, voice memos, alarms, files\)\. Who they talk to, and how much, follows their character and PEOPLE AROUND\./);
    assert.ok(plain.includes('A full day uses at least 6 of their apps (texts, calls, photos, searches, notes, mails, posts, voice memos).') && !on.includes('3 or more people') && on.includes('- Mail: whatever would really land in their inbox from their life, accounts, hobbies and habits.'));
    assert.match(on, /   a\. people the owner had a scene with may text later, if it fits;/);
    assert.ok(!on.includes('at least one later text exchange'));
    assert.match(on, /   b\. PHONE NOW's habits, LIFE NOW's usual, OWNER PROFILE: routines and interests that recur;/);
    assert.match(on, /   c\. PEOPLE AROUND: contact both ways; group chats go on without the owner\./);
    assert.match(on, /incoming texts and calls may arrive/);
    assert.match(on, /No new relative or partner; relationship labels only from the story;/);
    assert.equal(on.split('5. Diary: one entry for a day that ends in these hours or a scene that stays with them, on that day.').length, 2);
    // (STEP 5)
    assert.match(on, /- Search: what they would type\. About a situation: only words in its "known"\./);
    assert.match(on, /- Voice memo: spoken, not written: the way they talk in the chat/);
    assert.ok(on.includes('Post: only if they post. Alarm, file: change with their life.') && !plain.includes('Alarm, file:'));
    // (KEEPING IN STEP: a LIFE NOW alarm is not written again unless it changes)
    assert.match(on, /- A text in PHONE NOW: only its new messages\. A LIFE NOW alarm or file: not again unless it changes, then with its id in "already"\. A known scene: its id\. An edited message: the ids listed\./);
    assert.match(on, /Records of the owner's life fall between PHONE NOW's "now" and the answer's "now"\./);
    // (JSON: scenes, situations, records, everyday, then health and usual)
    const j = k => on.indexOf(`\n  "${k}": `);
    assert.ok(j('scenes') < j('situations') && j('situations') < j('records') && j('records') < j('everyday') && j('everyday') < j('health') && on.includes('\n  "usual": { "weight"'));
    assert.ok(on.includes('"with": [people physically there with the owner; otherwise []]') && on.includes('"situations": [{ "id": a short tag, "what", "state", "where", "when", "known", "open" }]') && on.includes('A "where" or "when" left "" stays unknown on the whole phone.'));
    assert.match(on, /"at": its message number, "scene": its scene id, "said": exact words, "situations": \[situation ids\] or \[\], "already": a LIFE NOW id or "",/);
    assert.match(on, /"everyday": \[\{ "date": "MM-DD", "records": \[\{ "type": one of the ITEMS types but "profile" and "visit", "situations": \[situation ids\] or \[\], and the fields of its type in ITEMS \}\] \}\] \(one entry a day, in order\)/);
    assert.match(on, /"type": "contact" \| "text" \| "call" \| "photo" \| "note" \| "search" \| "calendar" \| "post" \| "profile" \| "mail" \| "diary" \| "visit" \| "voice" \| "alarm" \| "timer" \| "file"/);
    assert.ok(!plain.includes('"alarm" | "timer"') && !plain.includes('LIFE NOW') && plain.includes('Write in this order. Numbers are plain JSON numbers.'));
    assert.match(on, /\nITEMS \(each with only the fields it needs\)\ncontact: "name"/);
    assert.match(on, /"group", "members": \[all but the owner, as in the contacts\]/);
    assert.ok(!data.coreSystem({ life: true }).includes('\nWEATHER\n'));
    assert.ok(!plain.includes('\nHEALTH\n') && !plain.includes('\nSCREEN TIME\n'));
    assert.ok(!on.includes('"events": [{') && !on.includes('Items in "phone"') && !on.includes('LOREBOOK') && on.includes('- Sometimes ARCHIVE BEFORE, STORY NOW'));
});

test('일상 on a phone with the everyday apps: an alarm, a timer and files too, as the reflection writes them', async () => {
    const sys = data.coreSystem({ life: true });
    assert.match(sys, /alarm: "time": "HH:MM", "label"/);
    assert.match(sys, /Post: only if they post\. Alarm, file: change with their life\./);
    assert.ok(!data.coreSystem().includes('alarm: "time"') && !data.coreSystem().includes('Alarms and files'));
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'long day tomorrow'), say('Mara', 'sleep early')]);
    c.p.now = '10-26 21:00'; c.p.year = 2026;
    c.p.life = { at: '10-26 21:00', clock: { alarms: [], timers: [], running: null }, files: { folders: [], items: [] }, health: { usual: {}, days: [] }, weather: { here: { place: 'Seoul', date: '10-26', time: '21:00', cond: 'clear', temp: 9, hours: [], days: [], tiles: {} }, cities: [] } };
    globalThis.__everydayIn = [];
    globalThis.__everyday = { everyday: { alarms: [{ time: '06:30', label: 'Gym', date: '10-27', days: [], on: true }, { time: '06:40', label: 'Snooze', date: '10-27', days: [], on: true }],
        files: [{ name: 'Screenshot 21-10.png', kind: 'image', folder: 'Downloads', time: '10-26 21:10' }, { name: 'a.pdf', folder: 'Downloads', time: '10-26 21:11' }, { name: 'b.pdf', folder: 'Downloads', time: '10-26 21:12' }] } };
    try { await run(c.m, { now: '10-26 21:30', events: [] }); } finally { delete globalThis.__everyday; }
    assert.deepEqual(c.p.life.clock.alarms.map(a => a.label), ['Gym']);
    assert.deepEqual(c.p.life.files.items.map(f => f.name), ['Screenshot 21-10.png', 'a.pdf']);
    assert.match(globalThis.__everydayIn.at(-1), /\[LIFE NOW\]/);
});

test('일상 texting someone not saved yet saves them too (only someone it texts or calls); 되돌리기 takes the contact back', async () => {
    assert.match(data.coreSystem(), /new plausible ones with local names \(each with a "contact"\)/);
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'thinking of Ivo'), say('Mara', 'call him')]);
    c.p.now = '10-26 09:00'; c.p.year = 2026;
    globalThis.__everyday = { everyday: { contacts: [{ name: 'Ivo', saved: 'Ivo 🙄' }, { name: 'Stranger', saved: 'x' }], threads: [{ with: 'Ivo', messages: [{ from: 'me', text: 'you up?', time: '10-26 09:20' }] }] } };
    try { await run(c.m, { now: '10-26 09:30', events: [] }); } finally { delete globalThis.__everyday; }
    assert.deepEqual(c.p.contacts.map(x => [x.name, x.saved]), [['Ivo', 'Ivo 🙄']]);
    await data.undoRound(c.m, c.p);
    assert.deepEqual(c.p.contacts, []);
});

test('일상 is not asked for when the reflection\'s own answer can\'t be read (the round fails; nothing paid for nothing)', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'hello')]);
    globalThis.__everydayIn = [];
    await assert.rejects(run(c.m, 'not json at all'));
    assert.equal(globalThis.__everydayIn.length, 0);
});

test('latest visible message alone supplies candidates without falling back to earlier archive evidence', async () => {
    for (const visibleHasClock of [false, true]) {
        const c = archived();
        c.p.country = 'DE'; c.p.year = 2026; c.p.now = '11-05 03:38';
        c.p.where = { at: 1, people: [{ name: 'Ren', city: 'Berlin', tz: 'Europe/Berlin' }, { name: 'Mara', city: 'Seoul', tz: 'Asia/Seoul' }] };
        c.m.phoneScreenHolder = 'Mara'; c.m.dateOrder = 'md';
        c.m.text = SECTION.replace('- Ren', '- Mara: 11.05 12:27, then a flashback: 10.05 01:00.\n- Ren');
        for (const i of [2, 3, 4, 5]) T.chat[i].mes += ' <time>23:59</time>';
        if (visibleHasClock) T.chat[6].mes += ' Mara <span class="time">11.05 13:27</span>';
        await run(c.m, { now: '11-05 05:27', events: [] });
        assert.equal((T.input.match(/Time text in #/g) || []).length, 0);
        if (visibleHasClock) assert.match(T.input, /On Mara's clock → owner's time: 11-05 05:27/);
        else assert.doesNotMatch(T.input, /Time choices|On Mara's clock/);
        assert.doesNotMatch(T.input, /23:59/);
        assert.match(T.input, /Saved phone time: 11-05 03:38/);
        if (visibleHasClock) assert.match(T.input, /Time alone does not identify the viewpoint/);
    }
});


test('all 1152 reflection routing combinations select legacy archive-only or current visible-message clocks', async () => {
const result={runs:0,coreConflicts:0,everyday:0,money:0,archiveOnly:0,failures:[],samples:[]};
const bad=s=>s.includes('"screen": { "owner": "name", "time":');
try {
for(let bits=0;bits<16;bits++)for(const order of ['oldest','newest'])for(const source of ['visible','mixed','archive'])for(const style of ['dated','bare','narrative'])for(const tracker of ['none','own','other','unknown']){
 const label={bits,order,source,style,tracker};
 try{
  const stamp=style==='dated'?'<div class="chat-timestamp">10.26, 14:12</div>':style==='bare'?'<div class="chat-timestamp">14:12</div>':'Ren walks outside under a dark sky.';
  const chat=[say('Ren','start'),say('Mara','hello'),...Array.from({length:5},(_,i)=>say('Ren',`message ${i+2}: ${stamp} I paid for tea.`))];
  if(source!=='visible')for(let i=2;i<=5;i++)chat[i].is_system=true;
  if(source==='archive')chat.pop();
  const {m,p}=setup(chat);T.trackers=[];T.moneyAnswers=[];T.moneyCalls=0;T.clockAuditCalls=[];globalThis.__everyday={};store.clear();
  if(source!=='visible')m.text=`## #2–#5 — Tea\nRen paid for tea. ${style==='dated'?'10.26, 14:12':style==='bare'?'14:12':'A dark sky.'}\n`;
  if(!(bits&1))delete p.money;
  if(bits&2)p.investment={base:'KRW',at:1,date:'2026-10-20',accounts:[],securities:[],trades:[],watch:[]};
  if(bits&4)p.life={at:'10-26 03:38',clock:{alarms:[],timers:[],running:null},health:{usual:{},days:[]},files:{folders:[],items:[]},weather:{here:{place:'Berlin',date:'10-26',time:'03:38',cond:'clear',temp:10,hours:[],days:[],tiles:{}},cities:[]}};
  if(bits&8)p.delivery={shops:[],orders:[],cart:{items:[]}};
  p.now='10-26 03:38';p.year=2026;p.where={at:1,people:[{name:'Ren',city:'Berlin',local:'Berlin',lives:'DE',tz:'Europe/Berlin'},{name:'Mara',city:'Seoul',local:'Seoul',lives:'KR',tz:'Asia/Seoul'}]};
  await data.setScreenHolder(m,'Mara');p.sync.order=order;p.sync.limit=2;
  const end=source==='archive'?5:source==='mixed'?6:order==='oldest'?3:6;
  if(tracker!=='none')T.trackers=[{i:end,date:'10.26',min:480,time:'08:00',place:tracker==='own'?'Berlin':tracker==='other'?'Seoul':'Unknownburg',city:tracker==='own'?'Berlin':tracker==='other'?'Seoul':'Unknownburg',weather:'Clear 10°C'}];
  const answer={clock:{basis:'audit fixture',finalViewpoint:'Ren',elapsedTime: null,sceneTime:'10-26 12:00',messageSender:null},now:'10-26 12:00',events:[{id:'tea',at:end,quote:source==='archive'?'paid for tea':'I paid for tea',summary:'Tea',date:'10-26',time:'12:00',apps:[...(bits&1?['money']:[]),...(bits&2?['invest']:[])],invest:!!(bits&2),phone:{}}]};
  if(source==='archive')delete answer.clock;
  await run(m,source==='archive'?JSON.stringify(answer):answer);
  const calls=T.clockAuditCalls, core=calls.filter(x=>x.system.includes("· RECORDS\n"));assert.equal(core.length,1);
  assert.equal(core[0].system.startsWith('STAGE: core'),!!(bits&3));
  assert.ok(!bad(core[0].system));
  if(source==='archive') {
   assert.doesNotMatch(core[0].system,/CLOCK FIRST|finalViewpoint|elapsedTime|sceneTime/);
   assert.match(core[0].system,/"now": "MM-DD HH:MM" \(the moment of the newest message, never a time something is only planned for\)/);
   assert.doesNotMatch(core[0].input,/Time choices\.|Default screen viewpoint|Phone being updated/);
  } else {
   assert.ok(core[0].system.includes('"now": use the matching converted OWNER\'S CLOCK value as-is; otherwise convert "clock.sceneTime" to the owner\'s time zone.'));
   assert.ok(core[0].system.includes('"finalViewpoint": "name", "elapsedTime": null or "3 hours", "sceneTime": "MM-DD HH:MM"'));
   if(style==='dated')assert.ok(core[0].input.includes("On Mara's clock →"));
  }
  assert.equal(core[0].input.includes('[MONEY NOW]'),false);assert.ok(!core[0].input.includes("On Ren's clock →"));if(style==='narrative')assert.ok(!core[0].input.includes('Time choices.'));
  // (the owner's own life in the core answer, an archived stretch's too; no request of its own)
  assert.ok(!calls.some(x=>x.system.startsWith('GOAL\nWrite the ordinary life')));
  const ed=[core[0]];
  const mo=calls.filter(x=>x.system.startsWith('STAGE: money'));
  assert.equal(mo.length,!!(bits&3)?1:0);
  if(mo.length){assert.equal(mo[0].input.includes('[INVESTMENTS NOW]'),!!(bits&2));assert.equal(mo[0].input.includes('[DELIVERY SHOPS]'),!!((bits&1)&&(bits&8)));assert.ok(mo[0].input.includes('10-26 12:00'));assert.ok(!mo[0].system.includes('CLOCK FIRST'));}
  assert.equal(p.now,'10-26 12:00');
  result.runs++;result.coreConflicts+=Number(bad(core[0].system));result.everyday+=ed.length;result.money+=mo.length;result.archiveOnly+=Number(source==='archive');
  if(result.samples.length<4)result.samples.push({...label,split:core[0].system.startsWith('STAGE: core'),stages:calls.map(x=>x.system.split('\n')[0])});
 }catch(e){result.failures.push({...label,error:e.message.slice(0,400)});}
}

assert.deepEqual(result.failures,[]);assert.equal(result.runs,1152);assert.equal(result.coreConflicts,0);assert.equal(result.everyday,1152);assert.equal(result.money,864);assert.equal(result.archiveOnly,384);
} finally { T.clockAuditCalls=null;T.trackers=null;globalThis.__everyday={}; }
});

test('everyday and saved clock share the status-adjusted or guarded end; explicit event times stay intact', async () => {
    for (const kind of ['status','backwards','dateOnly']) {
        const c=setup([say('Ren','start'),say('Mara','hello'),say('Ren','Tea at eleven')]);
        frankfurtPhone(c,{cities:false});c.p.now=kind==='backwards'?'10-26 12:00':'10-26 03:00';
        const savedBefore=c.p.now;
        T.trackers=kind==='status'?[trk(2,'13:00','Frankfurt am Main')]:[];
        const modelNow=kind==='dateOnly'?'10-27':'10-26 11:24';
        const expected=kind==='status'?'10-26 13:00':kind==='backwards'?'10-26 12:00':'10-27 12:00';
        globalThis.__everydayIn=[];let during;
        T.beforeEveryday=()=>{during=c.p.now;};
        // (an everyday record past the round's end is at the end)
        globalThis.__everyday={everyday:{notes:[{title:'Late',text:'later',time:'10-28 23:00'}]}};
        try {
            await run(c.m,{now:modelNow,events:[{id:'tea',at:2,quote:'Tea at eleven',date:'10-26',time:'11:00',phone:{notes:[{title:'Tea',text:'Tea at eleven',time:'10-26 11:00'}]}}]});
            assert.equal(during,savedBefore,'clock must stay saved until all requests succeed');
            assert.equal(c.p.notes.find(x=>x.title==='Late').time,expected);
            assert.equal(c.p.now,expected);assert.equal(c.p.notes.find(x=>x.title==='Tea').time,'10-26 11:00');
            await data.undoRound(c.m,c.p);assert.equal(c.p.now,savedBefore);
        } finally {T.beforeEveryday=null;T.trackers=null;delete globalThis.__everyday;}
    }
});

test('a chat changed while the reflection is asked does not commit the clock or moved locations preview', async () => {
    const c=setup([say('Ren','start'),say('Mara','hello'),say('Ren','Leaving now')]);frankfurtPhone(c,{cities:false});globalThis.__everyday={};
    const before={now:c.p.now,year:c.p.year,where:structuredClone(c.p.where)};let during;
    T.beforeEveryday=()=>{during={now:c.p.now,where:structuredClone(c.p.where)};T.chat[2].mes='Changed while waiting';};
    try {
        await assert.rejects(()=>run(c.m,{clock:{finalViewpoint:'Ren',elapsedTime: null,sceneTime:'10-26 11:24'},now:'10-26 11:24',moved:[{name:'Ren',city:'Seoul',tz:'Asia/Seoul'}],events:[]}),/대화가 바뀌었어요/);
        assert.deepEqual(during,{now:before.now,where:before.where});
        assert.equal(c.p.now,before.now);assert.equal(c.p.year,before.year);assert.deepEqual(c.p.where,before.where);
    } finally {T.beforeEveryday=null;delete globalThis.__everyday;}
});

test('archive-only reflection accepts legacy now without clock metadata, updates the clock, and undoes it', async () => {
    const c=archived();T.chat.pop();frankfurtPhone(c,{cities:false});c.m.phoneScreenHolder='Mara';
    const before=c.p.now;T.clockAuditCalls=[];globalThis.__everydayIn=[];
    const previousToast=globalThis.toastr, toasts=[];globalThis.toastr={info:(...args)=>toasts.push(args)};
    try {
        await run(c.m,JSON.stringify({now:'10-26 13:00',events:[note(3,'bought the poetry book','Book')]}));
        const core=T.clockAuditCalls.find(x=>x.system.includes("· RECORDS\n"));
        assert.doesNotMatch(core.system,/CLOCK FIRST|finalViewpoint|elapsedTime|sceneTime/);
        assert.match(core.input,/The owner is in Frankfurt am Main, 10-26 03:00 now\./);
        assert.doesNotMatch(core.input,/Time choices\.|Default screen viewpoint/);
        assert.equal(c.p.now,'10-26 13:00');assert.equal(c.p.notes[0].time,'10-26 12:00');
        assert.equal(globalThis.__everydayIn.length,0);assert.equal(toasts.length,0);
        await data.undoRound(c.m,c.p);assert.equal(c.p.now,before);
    } finally {T.clockAuditCalls=null;globalThis.toastr=previousToast;}
});

test('archive-only missing event dates use the legacy model now, not the guarded phone date', async () => {
    for (const money of [false, true]) for (const modelNow of ['10-26 13:00', undefined]) {
        const c=archived();T.chat.pop();T.trackers=[];T.moneyAnswers=[];
        if (!money) delete c.p.money;
        c.p.now='10-27 09:00';
        const event=note(3,'bought the poetry book','Book');
        delete event.date;
        event.phone.notes[0].time='12:00';
        // Raw JSON exercises the archive contract without the clock fixture helper.
        await run(c.m,JSON.stringify({...(modelNow ? {now:modelNow} : {}),events:[event]}));
        assert.equal(c.p.now,'10-27 09:00');
        assert.equal(c.p.notes[0].time,modelNow ? '10-26 12:00' : '');
        assert.doesNotMatch(T.sys,/CLOCK FIRST|finalViewpoint|elapsedTime|sceneTime/);
        await data.undoRound(c.m,c.p);
        assert.equal(c.p.now,'10-27 09:00');
        assert.equal(c.p.notes.length,0);
    }
});

test('mixed archive and visible messages still require the new clock response', async () => {
    const c=archived();frankfurtPhone(c,{cities:false});const before=c.p.now;
    await assert.rejects(()=>run(c.m,JSON.stringify({now:'10-26 13:00',events:[]})),e=>e.code==='CLOCK_INVALID');
    assert.match(T.sys,/CLOCK FIRST/);assert.match(T.input,/\[ARCHIVE FOR THESE MESSAGES\]/);
    assert.equal(c.p.now,before);
});

test('되돌리기 after the place reading was asked again (AI로 연동) keeps the new reading; one the round itself moved is taken back', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'landed in Rome'), say('Mara', 'nice')]);
    c.p.now = '10-26 08:00'; c.p.year = 2026;
    const where0 = { at: 1, people: [{ name: 'Ren', city: 'Frankfurt am Main', names: ['Frankfurt am Main'], lives: 'DE', tz: 'Europe/Berlin' }, { name: 'Mara', city: 'Seoul', names: ['Seoul'], lives: 'KR', tz: 'Asia/Seoul' }] };
    c.p.where = structuredClone(where0);
    await run(c.m, { now: '10-26 13:00', moved: [{ name: 'Ren', city: 'Rome', names: ['Rome'], tz: 'Europe/Rome' }], events: [] });
    assert.equal(c.p.where.people.find(x => x.name === 'Ren').city, 'Rome');
    // undone right away: the round's move goes
    await data.undoRound(c.m, c.p);
    assert.equal(c.p.where.people.find(x => x.name === 'Ren').city, 'Frankfurt am Main');
    // read again after the round, then undone: the new reading stays
    T.chat.push(say('Ren', 'still in Rome'));
    await run(c.m, { now: '10-26 14:00', moved: [{ name: 'Ren', city: 'Rome', names: ['Rome'], tz: 'Europe/Rome' }], events: [] });
    globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Milan', lives: 'DE', tz: 'Europe/Rome' }] };
    try { await data.rereadPlaces(c.m, c.p, { all: true }); } finally { delete globalThis.__whereAnswer; }
    await data.undoRound(c.m, c.p);
    assert.equal(c.p.where.people.find(x => x.name === 'Ren').city, 'Milan');
    // (a phone with no reading before the round, read after it: not wiped)
    const d = setup([say('Ren', 'a'), say('Mara', 'b'), say('Ren', 'c')]);
    d.p.now = '10-26 08:00'; d.p.where = { at: 1, failed: true, people: [] };
    await run(d.m, { now: '10-26 09:00', events: [] });
    globalThis.__whereAnswer = { people: [{ name: 'Ren', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }] };
    try { await data.rereadPlaces(d.m, d.p); } finally { delete globalThis.__whereAnswer; }
    await data.undoRound(d.m, d.p);
    assert.equal(d.p.where.people[0].city, 'Seoul');
});

// ---- 반영 본체 3.180: one list of records, the story's and the owner's own life
test('a records answer: scenes are events, story records on their scene, the owner\'s own life marked apart; 되돌리기 takes it all', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'dinner with Mara at Pho 24'), say('Mara', 'that was nice')]);
    c.p.now = '10-26 18:00'; c.p.year = 2026;
    await run(c.m, { now: '10-26 22:00', story: [{ matter: 'dinner with Mara', stands: 'they ate at Pho 24', at: 2 }], records: [
        { type: 'scene', id: 'pho', at: 2, quote: 'dinner with Mara', date: '10-26', time: '19:00', summary: 'dinner with Mara' },
        { type: 'photo', at: 2, from: 'story', scene: 'pho', caption: 'pho bowls', time: '10-26 19:10', mood: 'warm' },
        // (a story record with no scene: the one scene of its message)
        { type: 'text', at: 2, from: 'story', with: 'Mara', messages: [{ from: 'Mara', text: 'loved it', time: '10-26 21:00' }] },
        { type: 'text', at: 3, from: 'life', with: 'Uni-Freunde', group: true, members: ['Ivo', 'Lio', 'Ren'], messages: [{ from: 'Ivo', text: 'who is up for Sunday?', time: '10-26 20:00' }, { from: 'Lio', text: 'me', time: '10-26 20:02' }] },
        { type: 'search', at: 3, from: 'life', q: 'pho recipe', time: '10-26 21:30' },
        { type: 'contact', at: 3, from: 'life', name: 'Lio', saved: 'Lio 🎸' },
        { type: 'nonsense', at: 3, from: 'life', q: 'x' },
    ] });
    assert.deepEqual(c.p.photos.map(x => [x.caption, x.src ?? '']), [['pho bowls', '']]);
    const mara = c.p.threads.find(t => t.with === 'Mara');
    assert.deepEqual(mara.messages.map(x => [x.text, x.src ?? '']), [['loved it', '']]);
    // (a group chat: its own room, its members without the owner, its texts the owner's own life)
    const uni = c.p.threads.find(t => t.with === 'Uni-Freunde');
    assert.equal(uni.group, true); assert.deepEqual(uni.members, ['Ivo', 'Lio']);
    assert.ok(uni.messages.every(x => x.src === 'guess'));
    assert.deepEqual(c.p.searches.map(x => [x.q, x.src]), [['pho recipe', 'guess']]);
    // (a contact only for someone texted or called: Lio only texted in the group, so none)
    assert.deepEqual(c.p.contacts.map(x => x.name), []);
    assert.ok(c.p.sync.done.flat().includes(3));
    // (the round says how many scenes, story and life records the answer had)
    assert.deepEqual(c.p.syncLast.records, { scenes: 1, story: 2, life: 4, nosaid: 2 });
    await data.undoRound(c.m, c.p);
    assert.equal(c.p.photos.length + c.p.searches.length, 0);
    assert.ok(!c.p.threads.some(t => t.messages.length));
});

test('a story record in a message with no scene gets an event for that message, its words the quote', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'I wrote the shopping list down')]);
    c.p.now = '10-26 09:00'; c.p.year = 2026;
    await run(c.m, { now: '10-26 09:30', records: [{ type: 'note', at: 2, from: 'story', title: 'Shopping', text: 'milk', time: '10-26 09:10' }] });
    assert.deepEqual(c.p.notes.map(x => [x.title, x.src ?? '']), [['Shopping', '']]);
    assert.ok(Object.keys(c.p.sync.events).includes('msg-2'));
    assert.equal(c.p.sync.events['msg-2'].summary, '메모');
    assert.deepEqual(c.p.syncLast?.notes || [], []);
});

test('texts of the owner\'s own life: an exchange keeps its first 8, two exchanges a person a day, 16 texts a day; a group chat is a room of its own', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'boring day')]);
    c.p.now = '10-26 08:00'; c.p.year = 2026;
    const ex = (h, n, extra = {}) => ({ type: 'text', at: 2, from: 'life', with: 'Ivo', ...extra, messages: Array.from({ length: n }, (_, i) => ({ from: i % 2 ? 'me' : 'Ivo', text: `${h}:${i}`, time: `10-26 ${h}:${String(10 + i).padStart(2, '0')}` })) });
    await run(c.m, { now: '10-26 23:00', records: [ex('09', 10), ex('13', 3), ex('18', 3), ex('20', 2, { with: 'Ivo', group: true, members: ['Ivo', 'Nele'] })] });
    const ivo = c.p.threads.filter(t => t.with === 'Ivo' && !t.group), room = c.p.threads.find(t => t.group);
    assert.equal(ivo.length, 1);
    // (8 of the first, all 3 of the second, none of the third)
    assert.deepEqual(ivo[0].messages.map(x => x.text), ['09:0', '09:1', '09:2', '09:3', '09:4', '09:5', '09:6', '09:7', '13:0', '13:1', '13:2']);
    // (the group chat named "Ivo" is not Ivo's own chat; its exchange counts for the room)
    assert.deepEqual(room.messages.map(x => x.text), ['20:0', '20:1']);
    assert.deepEqual(room.members, ['Ivo', 'Nele']);
    // (another round that day: up to 16 texts with Ivo in all)
    T.chat.push(say('Ren', 'still boring'));
    await run(c.m, { now: '10-26 23:50', records: [ex('23', 8)] });
    assert.equal(c.p.threads.find(t => t.with === 'Ivo' && !t.group).messages.length, 16);
});

test('life records that answer a scene ("scene" its id) go on it and the day\'s count leaves them out; the morning leaves the day its own', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'a quiet morning'), say('Mara', 'later')]);
    c.p.now = '10-26 07:30'; c.p.year = 2026;
    const srch = (q, h, x = {}) => ({ type: 'search', at: 2, from: 'life', q, time: `10-26 ${h}`, ...x });
    // (09:00: one search of the day's five so far)
    await run(c.m, { now: '10-26 09:00', records: [srch('weather', '08:10'), srch('bus', '08:20'), srch('news', '08:30'),
        // (the diary: as many as the answer writes, any time)
        { type: 'diary', at: 2, from: 'life', date: '10-26', title: 'morning diary', text: 'x' }, { type: 'diary', at: 2, from: 'life', date: '10-25', title: 'yesterday', text: 'x' }] });
    assert.deepEqual(c.p.searches.map(x => x.q), ['weather']);
    assert.deepEqual(c.p.diary.map(x => x.title), ['morning diary', 'yesterday']);
    T.chat.push(say('Ren', 'Ivo and Ren have it out at the bar'));
    const ex = (h, n) => ({ type: 'text', at: 4, from: 'life', scene: 'bar', with: 'Lio', messages: Array.from({ length: n }, (_, i) => ({ from: i % 2 ? 'me' : 'Lio', text: `${h}:${i}`, time: `10-26 ${h}:${String(10 + i).padStart(2, '0')}` })) });
    await run(c.m, { now: '10-26 23:40', records: [
        { type: 'scene', id: 'bar', at: 4, quote: 'Ivo and Ren have it out', date: '10-26', time: '22:00', summary: 'the fight' },
        ...['a', 'b', 'c', 'd', 'e', 'f'].map((q, i) => srch(`after ${q}`, `23:0${i}`, { at: 4, scene: 'bar' })),
        srch('plain', '23:20', { at: 4 }),
        ex('22', 10), ex('23', 3), { ...ex('21', 2), scene: '' },
        ...['d1', 'd2'].map(title => ({ type: 'diary', at: 4, from: 'life', scene: 'bar', date: '10-26', title, text: 'x' }))] });
    assert.deepEqual(c.p.diary.map(x => x.title), ['morning diary', 'yesterday', 'd1', 'd2']);
    const s = c.p.searches.filter(x => x.src === 'guess').map(x => x.q);
    // (all six of the scene's, and the plain one: the day's count is the plain ones' only)
    assert.deepEqual(s, ['weather', 'after a', 'after b', 'after c', 'after d', 'after e', 'after f', 'plain']);
    assert.ok(c.p.searches.every(x => !('onScene' in x)));
    // (the scene's exchanges: 8 of the first, all 3 of the second, never one of the day's two; the plain one too)
    const lio = c.p.threads.find(t => t.with === 'Lio');
    assert.equal(lio.messages.length, 8 + 3 + 2);
    assert.ok(lio.messages.every(x => x.src === 'guess' && !('onScene' in x)));
    // (they are the scene's: on its event)
    assert.ok(c.p.sync.events.bar);
    assert.match(T.sys, /"everyday": \[\{ "date": "MM-DD", "records": \[\{ "type": one of the ITEMS types but "profile" and "visit", "situations": \[situation ids\] or \[\]/);
    assert.match(T.sys, /a\. people the owner had a scene with may text later, if it fits;/);
});

test('the answer\'s "everyday" lists: each app the owner\'s own life, on its scene when it answers one; counted as life', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'dinner with Mara at Pho 24')]);
    c.p.now = '10-26 18:00'; c.p.year = 2026;
    await run(c.m, { now: '10-26 22:00', records: [
        { type: 'scene', id: 'pho', at: 2, quote: 'dinner with Mara', date: '10-26', time: '19:00', summary: 'dinner with Mara' },
        { type: 'photo', at: 2, scene: 'pho', caption: 'pho bowls', time: '10-26 19:10', mood: 'warm' }],
    everyday: {
        texts: [{ with: 'Lio', messages: [{ from: 'Lio', text: 'how was it?', time: '10-26 21:00' }], scene: 'pho' }],
        searches: Array.from({ length: 7 }, (_, i) => ({ q: `q${i}`, time: `10-26 20:0${i}` })),
        calendar: [{ title: 'Dentist', date: '10-28', time: '09:00' }], calls: [{ with: 'Ivo', kind: 'missed', time: '10-26 20:30' }],
        mails: [{ sender: 'Stadtwerke', subject: 'Rechnung', text: 'x', time: '10-26 20:40' }], diary: [{ title: 'Pho', text: 'good night' }],
        voice: [{ title: 'idea', text: 'hm… a song', sec: 30 }, { title: 'later', text: 'ok', sec: 20, time: '10-26 21:50' }],
        notes: [{ title: 'no time', text: 'x' }] } });
    // (written without its time or date: left out, the app never makes one up; counted)
    assert.deepEqual(c.p.voice.map(x => x.title), ['later']);
    assert.deepEqual(c.p.diary, []);
    assert.equal(c.p.notes.length, 0);
    assert.deepEqual(c.p.photos.map(x => [x.caption, x.src ?? '']), [['pho bowls', '']]);
    assert.ok(c.p.threads.find(t => t.with === 'Lio').messages.every(x => x.src === 'guess'));
    // (plain searches: the day's five)
    assert.equal(c.p.searches.filter(x => x.src === 'guess').length, 5);
    assert.deepEqual(c.p.events.map(x => [x.title, x.src]), [['Dentist', 'guess']]);
    assert.deepEqual(c.p.calls.map(x => [x.with, x.type, x.src]), [['Ivo', 'missed', 'guess']]);
    assert.deepEqual(c.p.mails.map(x => [x.from, x.src]), [['Stadtwerke', 'guess']]);
    assert.deepEqual(c.p.syncLast.records, { scenes: 1, story: 1, life: 15, untimed: 3, nosaid: 1 });
});

test('the owner\'s own life a day, not a reflection: a skipped week fills each day, photos 5 a day, the diary as many as written', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'morning'), say('Ren', 'a week later, back home')]);
    c.p.now = '10-20 09:00'; c.p.year = 2026;
    const recs = [];
    for (let d = 20; d <= 26; d++) for (let i = 0; i < 7; i++) recs.push({ type: 'photo', at: 2, from: 'life', caption: `p${d}-${i}`, time: `10-${d} ${String(9 + i).padStart(2, '0')}:00` });
    for (let d = 20; d <= 26; d++) for (let i = 0; i < 2; i++) recs.push({ type: 'diary', at: 2, from: 'life', date: `10-${d}`, title: `d${d}-${i}`, text: 'x' });
    await run(c.m, { now: '10-26 20:00', records: recs });
    const by = k => c.p[k].filter(x => x.src === 'guess').reduce((m, x) => (m[String(x.date || x.time).slice(0, 5)] = (m[String(x.date || x.time).slice(0, 5)] || 0) + 1, m), {});
    assert.deepEqual(Object.values(by('photos')), [5, 5, 5, 5, 5, 5, 5].slice(0, Object.keys(by('photos')).length));
    assert.ok(Object.keys(by('photos')).length >= 6);
    assert.ok(Object.values(by('diary')).every(n => n === 2));
});

test('recordsCore: the old answer as it is; health of a story day on its scene, the others in "days"; a habit on its scene', () => {
    const old = { now: '10-26 12:00', events: [{ id: 'a', at: 1 }] };
    assert.equal(data.recordsCore(old), old);
    const got = data.recordsCore({ now: '10-26 22:00', weather: null, records: [
        { type: 'scene', id: 'run', at: 4, quote: 'ran', summary: 'run' },
        { type: 'health', at: 4, from: 'story', scene: 'run', date: '10-26', steps: 9000 },
        { type: 'health', at: 4, from: 'life', date: '10-25', steps: 3000 },
        { type: 'usual', at: 4, from: 'story', scene: 'run', coffee: 1 },
        { type: 'call', at: 4, from: 'life', with: 'Ivo', kind: 'missed', time: '10-26 13:00' },
        { type: 'mail', at: 4, from: 'life', sender: 'Zalando', subject: 'Sale', time: '10-26 10:00' },
        { type: 'alarm', at: 4, from: 'story', scene: 'run', already: 'al1', on: false },
        null, 'x', [],
    ] }, () => 'ran');
    assert.deepEqual(got.events.map(e => e.id), ['run']);
    assert.deepEqual(got.events[0].phone.health.map(x => x.steps), [9000]);
    assert.deepEqual(got.days.map(x => x.steps), [3000]);
    assert.deepEqual(got.events[0].phone.usual, { coffee: 1 });
    assert.deepEqual(got.events[0].phone.alarms, [{ change: 'al1', on: false }]);
    assert.deepEqual(got.everyday.calls, [{ with: 'Ivo', type: 'missed', time: '10-26 13:00' }]);
    assert.deepEqual(got.everyday.mails, [{ from: 'Zalando', subject: 'Sale', time: '10-26 10:00' }]);
    assert.ok(!('records' in got));
});

test('no app only Korea has on the screen time of an owner who lives elsewhere: a day\'s minutes to their usual app of that kind, a new one left out', () => {
    const usual = { apps: [{ app: 'WhatsApp', kind: 'chat', min: 60 }, { app: 'YouTube', kind: 'video', min: 40 }] };
    const raw = { events: [{ id: 'a', phone: { health: [{ date: '10-26', screen: { apps: { KakaoTalk: 90, YouTube: 30, '카톡': 10 }, pickups: 80 } }], usual: { screen: { add: [{ app: 'KakaoTalk', kind: 'chat', min: 30 }, { app: 'Duolingo', kind: 'other', min: 10 }] } } } }],
        days: [{ date: '10-25', screen: { apps: { 'Naver Map': 20, WhatsApp: 15 } } }] };
    const ko = structuredClone(raw);
    data.homeScreens(raw, true, usual);
    assert.deepEqual(raw.events[0].phone.health[0].screen.apps, { WhatsApp: 100, YouTube: 30 });
    assert.equal(raw.events[0].phone.health[0].screen.pickups, 80);
    assert.deepEqual(raw.events[0].phone.usual.screen.add.map(a => a.app), ['Duolingo']);
    // (a map app with no map app in their usual: its minutes go nowhere)
    assert.deepEqual(raw.days[0].screen.apps, { WhatsApp: 15 });
    // an owner in Korea keeps them all
    const same = structuredClone(ko); data.homeScreens(same, false, usual);
    assert.deepEqual(same, ko);
    assert.ok(!data.coreSystem({ life: true }).includes('more than 10 apps'));
    assert.match(data.coreSystem({ life: true }), /the apps they really use, including ones they would not admit, varied by day and by that day's events\./);
    assert.match(data.coreSystem({ life: true }), /A new app the story or their life justifies → "usual"\."screen"\."add"\./);
    assert.match(data.coreSystem({ life: true }), /Real app names where they live; another country's apps only when the story shows them\./);
});

test('the reflection reads less around it: its 15 latest scenes, no lorebook', async () => {
    const c = setup([say('Ren', 'start'), say('Mara', 'hello'), say('Ren', 'tea')]);
    c.p.now = '10-26 09:00'; c.p.year = 2026;
    await run(c.m, { now: '10-26 09:30', records: [] });
    for (let i = 0; i < 30; i++) c.p.sync.events[`old-${i}`] = { at: null, summary: `old ${i}` };
    T.chat.push(say('Mara', 'more tea'));
    await run(c.m, { now: '10-26 10:00', records: [] });
    const block = T.input.split('[EVENTS ON THE PHONE]\n')[1].split('\n\n')[0];
    assert.equal(block.split('\n').length, 15);
    assert.ok(block.includes('old-29') && !block.includes('old-10:'));
    assert.ok(!T.input.includes('[LOREBOOK]') && !T.sys.includes('LOREBOOK'));
});

test('recordsCore: a health day already on the phone ("already") is rewritten on an event, never left to "days"', () => {
    const got = data.recordsCore({ now: '11-06 09:20', records: [
        { type: 'scene', id: 'hotel', at: 5, quote: 'hotel', summary: 'hotel' },
        { type: 'health', at: 3, from: 'life', already: 'd1', date: '11-03', steps: 7450 },
        { type: 'health', at: 5, from: 'life', date: '11-04', steps: 6800 },
    ] }, i => (i === 3 ? '[#3] Mara: late night' : ''));
    const onEvent = got.events.flatMap(e => e.phone.health || []).map(x => x.date);
    assert.deepEqual(onEvent, ['11-03']);
    assert.deepEqual(got.days.map(x => x.date), ['11-04']);
});

test('recordsCore: a text record\'s times alone take its own day, not its scene\'s', () => {
    const got = data.recordsCore({ now: '11-06 09:20', records: [
        { type: 'scene', id: 'studio', at: 8, quote: 'studio', date: '11-06', summary: 'studio' },
        { type: 'text', at: 8, from: 'life', with: '엄마', time: '11-04 17:40', messages: [{ from: '엄마', text: '지낼만하니?', time: '17:35' }, { from: 'me', text: '응', time: '17:40' }, { from: 'me', text: 'x', time: '11-05 08:00' }] },
    ] });
    assert.deepEqual(got.everyday.threads[0].messages.map(m => m.time), ['11-04 17:35', '11-04 17:40', '11-05 08:00']);
});

test('반영 본체 gets the orders and tickets (no money), so a mail or text about one agrees with the phone', () => {
    const got = data.ordersBlock({ orders: [{ id: 'o1', shop: 'Wohnwerk', item: 'wool rug 160x230', price: 189, status: 'cancelled', time: '10-28 20:00' }], passes: [{ id: 't1', kind: 'hotel', by: 'Hotel Lio', no: 'HB-2231', date: '11-02', until: '11-08', status: 'booked' }] });
    assert.equal(got, '[ORDERS AND TICKETS]\n{"orders":[{"shop":"Wohnwerk","item":"wool rug 160x230","status":"cancelled","time":"10-28 20:00"}],"tickets":[{"kind":"hotel","by":"Hotel Lio","no":"HB-2231","date":"11-02","until":"11-08","status":"booked"}]}');
    assert.equal(data.ordersBlock({ orders: [], passes: [] }), '');
    // (an order's arrival day, from the phone's own order)
    assert.match(data.ordersBlock({ orders: [{ id: 'o2', shop: 'Lio Shop', item: 'scarf', status: 'on the way', time: '11-03 14:00' }] }, { money: { orders: [{ id: 'o2', eta: '11-05' }] } }), /"status":"on the way","time":"11-03 14:00","eta":"11-05"/);
    assert.match(data.coreSystem({ wallet: true }), /ORDERS AND TICKETS \(orders and tickets with their status and eta\)/);
    assert.ok(!data.coreSystem().includes('ORDERS AND TICKETS'));
});

test('"health" after "everyday": a past day guessed from their usual becomes the one written; 되돌리기 takes it back', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'two quiet days later')]);
    c.p.now = '10-24 09:00'; c.p.year = 2026;
    c.p.life = { at: '10-24 09:00', clock: { alarms: [], timers: [], running: null }, files: { folders: [], items: [] },
        health: { usual: { steps: 8000 }, days: [{ id: 'sync:r1:g0', date: '10-25', steps: 8050, km: 5.8, hr: [], from: 'pattern' }, { id: 'h0', date: '10-24', steps: 4000, km: 2.9, hr: [], from: 'story' }] } };
    await run(c.m, { now: '10-26 20:00', records: [], everyday: { searches: [{ q: 'soup', time: '10-26 12:00' }] },
        health: [{ date: '10-25', steps: 6100 }, { date: '10-24', steps: 9999 }, { date: '10-26', steps: 3000 }] });
    const day = d => c.p.life.health.days.find(x => x.date === d);
    // (the guessed day: what the model wrote; a told day stays; a new day goes in)
    assert.deepEqual([day('10-25').steps, day('10-24').steps, day('10-26')?.steps], [6100, 4000, 3000]);
    await data.undoRound(c.m, c.p);
    assert.equal(day('10-25').steps, 8050);
});

test('recordsCore: a scene named in "scene" (no "id") is that scene; a record pointing at it goes on it; "with" as one name', async () => {
    const got = data.recordsCore({ now: '11-06 21:00', records: [
        { type: 'scene', scene: 'pho-dinner', at: 0, quote: 'dinner', date: '11-03', time: '19:00' }, { type: 'scene', scene: 'hotel-night', at: 5, quote: 'hotel', date: '11-03', time: '21:30' },
        { type: 'visit', place: 'Pho 24', with: 'Ren', time: '11-03 19:10', scene: 'pho-dinner' }, { type: 'visit', place: 'Hotel Lio', time: '11-03 21:40', scene: 'hotel-night' }] });
    assert.deepEqual(got.events.map(e => [e.id, (e.phone.visits || []).map(v => v.place)]), [['pho-dinner', ['Pho 24']], ['hotel-night', ['Hotel Lio']]]);
    const ph = data.parsePhone(JSON.stringify({ visits: [{ place: 'Pho 24', with: 'Ren', time: '11-03 19:10' }], threads: [{ with: 'Uni', group: true, members: 'Ivo', messages: [{ from: 'Ivo', text: 'hi', time: '11-03 20:00' }] }] }), 'Mara');
    assert.deepEqual(ph.visits[0].with, ['Ren']);
    assert.deepEqual(ph.threads[0].members, ['Ivo']);
});

test('a story record\'s "said" and "made" are the answer\'s only: what the model wrote goes in as it is, nothing checked by the app', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'the boiler broke, so I am at the hotel this week')]);
    c.p.now = '10-26 18:00'; c.p.year = 2026;
    await run(c.m, { now: '10-26 22:00', records: [
        { type: 'scene', id: 'hotel', at: 2, quote: 'the boiler broke', date: '10-26', time: '20:00' },
        { type: 'search', at: 2, scene: 'hotel', said: 'the boiler broke', made: ['the wording'], q: 'boiler repair how long', time: '10-26 20:10' }],
    everyday: { notes: [{ title: 'Boiler', text: 'call the landlord', time: '10-26 21:00', said: 'not in the messages' }] } });
    assert.deepEqual(c.p.searches.map(x => x.q), ['boiler repair how long']);
    assert.deepEqual(c.p.notes.map(x => x.title), ['Boiler']);
    assert.ok([...c.p.searches, ...c.p.notes].every(x => !('said' in x) && !Array.isArray(x.made)));
    assert.equal(c.p.syncLast.unsaid, undefined);
    assert.ok(T.sys.indexOf('\nCLOCK FIRST\n') < T.sys.indexOf('\nSTEP 2 · SITUATIONS\n') && !T.sys.includes('DO NOT CONTINUE THE STORY') && !T.sys.includes('Tell apart what you may make up'));
    assert.match(T.sys, /sent: tracking checks, waiting, asking when\. Not: arrival, opening, photos, wearing, thanks, even on or after the eta\./);
});

test('"everyday" as days ([{ date, records }]): each day\'s records read as the owner\'s own life, as the lists by app were', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'two quiet days')]);
    c.p.now = '10-25 08:00'; c.p.year = 2026;
    await run(c.m, { now: '10-26 20:00', records: [], everyday: [
        { date: '10-25', records: [{ type: 'photo', caption: 'sunday sky', time: '10-25 10:00', mood: 'cool' }, { type: 'diary', title: 'Sunday', text: 'slow day' }, { type: 'text', with: 'Lio', messages: [{ from: 'Lio', text: 'brunch?', time: '10-25 11:00' }] }] },
        { date: '10-26', records: [{ type: 'search', q: 'soup recipe', time: '10-26 12:00' }, { type: 'calendar', title: 'Dentist', date: '10-28', time: '09:00' }, { type: 'scene', id: 'x' }] }] });
    assert.deepEqual(c.p.photos.map(x => [x.caption, x.src]), [['sunday sky', 'guess']]);
    // (a diary without its date is its day's)
    assert.deepEqual(c.p.diary.map(x => [x.title, x.date, x.src]), [['Sunday', '10-25', 'guess']]);
    assert.deepEqual(c.p.threads.find(t => t.with === 'Lio').messages.map(x => [x.text, x.src]), [['brunch?', 'guess']]);
    assert.deepEqual(c.p.searches.map(x => x.q), ['soup recipe']);
    assert.deepEqual(c.p.events.map(x => [x.title, x.src]), [['Dentist', 'guess']]);
    assert.deepEqual(c.p.syncLast.records, { scenes: 0, story: 0, life: 5 });
});

test('"scenes" first: each a scene on the phone; a visit on one is with that scene\'s companions; the old answer (a scene in "records", a visit\'s own "with") still read', async () => {
    const got = data.recordsCore({ now: '11-06 21:00', scenes: [
        { id: 'pho', at: 0, quote: 'dinner', date: '11-03', time: '19:00', summary: 'dinner', place: 'Pho 24', city: 'Seoul', with: ['Ren'] },
        { id: 'hotel', at: 5, quote: 'hotel', date: '11-03', time: '21:30', summary: 'hotel', place: 'Hotel Lio', city: 'Seoul', with: [] }],
    records: [{ type: 'visit', at: 0, scene: 'pho', place: 'Pho 24', time: '11-03 19:10', with: ['Ivo'] }, { type: 'visit', at: 5, scene: 'hotel', place: 'Hotel Lio', time: '11-03 21:40' }, { type: 'photo', at: 5, scene: 'hotel', caption: 'chicken', time: '11-03 22:00' }] });
    assert.deepEqual(got.events.map(e => e.id), ['pho', 'hotel']);
    assert.deepEqual(got.events.map(e => (e.phone.visits || []).map(v => [v.place, v.with])), [[['Pho 24', ['Ren']]], [['Hotel Lio', []]]]);
    assert.deepEqual(got.events[1].phone.photos.map(x => x.caption), ['chicken']);
    // (the old answer: its visit keeps its own "with")
    const old = data.recordsCore({ now: '11-06 21:00', records: [{ type: 'scene', id: 'pho', at: 0, quote: 'dinner', date: '11-03', time: '19:00' }, { type: 'visit', at: 0, scene: 'pho', place: 'Pho 24', time: '11-03 19:10', with: ['Ren'] }] });
    assert.deepEqual(old.events[0].phone.visits.map(v => v.with), [['Ren']]);
    assert.equal(got.scenes, undefined);
});

test('a record the model itself marks "advances": true (moves a story situation on by itself) is left out and shown; false or none goes in', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'I sent you a scarf')]);
    c.p.now = '10-26 18:00'; c.p.year = 2026;
    await run(c.m, { now: '10-26 22:00', scenes: [{ id: 'scarf', at: 2, quote: 'I sent you a scarf', date: '10-26', time: '20:00', summary: 'scarf', place: '', city: '', with: [] }],
        records: [{ type: 'text', at: 2, scene: 'scarf', said: 'I sent you a scarf', advances: false, with: 'Lio', messages: [{ from: 'me', text: 'thank you!!', time: '10-26 20:10' }] }],
        everyday: [{ date: '10-26', records: [{ type: 'photo', caption: 'the scarf arrived', time: '10-26 21:00', advances: true }, { type: 'search', q: 'soup recipe', time: '10-26 19:00', advances: 'false' }] }] });
    assert.deepEqual(c.p.photos, []);
    assert.deepEqual(c.p.searches.map(x => x.q), ['soup recipe']);
    assert.deepEqual(c.p.threads.find(t => t.with === 'Lio').messages.map(x => x.text), ['thank you!!']);
    assert.deepEqual(c.p.syncLast.advanced, [{ type: 'photo', from: 'everyday', what: 'the scarf arrived' }]);
    assert.equal(c.p.syncLast.records.advanced, 1);
    assert.ok([...c.p.searches, ...c.p.threads.flatMap(t => t.messages)].every(x => !('advances' in x)));
    // (no longer asked: the situations do that work now; an answer that still has it is read as before)
    assert.ok(!T.sys.includes('"advances"'));
});

test('"records" as one day list: a record with its scene or its words is the story\'s, on its scene; the rest is the owner\'s own day', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'I sent you a scarf')]);
    c.p.now = '10-26 18:00'; c.p.year = 2026;
    await run(c.m, { now: '10-26 22:00', scenes: [{ id: 'scarf', at: 2, quote: 'I sent you a scarf', date: '10-26', time: '20:00', summary: 'scarf', place: 'Cafe Lune', city: 'Seoul', with: ['Ren'] }],
        records: [{ date: '10-26', records: [
            { type: 'visit', scene: 'scarf', at: 2, said: 'I sent you a scarf', place: 'Cafe Lune', city: 'Seoul', time: '10-26 20:00' },
            { type: 'search', scene: 'scarf', at: 2, said: 'I sent you a scarf', q: 'parcel tracking', time: '10-26 20:30' },
            { type: 'search', scene: '', q: 'soup recipe', time: '10-26 19:00' },
            { type: 'diary', scene: '', title: 'a long day', text: 'tired.' }] }] });
    assert.deepEqual(c.p.searches.map(x => x.q).sort(), ['parcel tracking', 'soup recipe']);
    assert.notEqual(c.p.searches.find(x => x.q === 'parcel tracking').src, 'guess');
    assert.equal(c.p.searches.find(x => x.q === 'soup recipe').src, 'guess');
    assert.equal(c.p.diary.find(x => x.title === 'a long day').date, '10-26');
    const got = data.recordsCore({ now: '11-06 21:00', scenes: [{ id: 'pho', at: 0, quote: 'dinner', date: '11-03', time: '19:00', summary: 'dinner', place: 'Pho 24', city: 'Seoul', with: ['Ren'] }],
        records: [{ date: '11-03', records: [{ type: 'visit', scene: 'pho', at: 0, said: 'dinner', place: 'Pho 24', time: '11-03 19:10' }, { type: 'photo', scene: '', caption: 'sky', time: '11-03 08:00' }] }] });
    assert.deepEqual(got.events[0].phone.visits.map(v => [v.place, v.with]), [['Pho 24', ['Ren']]]);
    assert.deepEqual(got.everyday.photos.map(x => x.caption), ['sky']);
    assert.deepEqual({ scenes: c.p.syncLast.records.scenes, story: c.p.syncLast.records.story, life: c.p.syncLast.records.life }, { scenes: 1, story: 2, life: 2 });
});

test('"situations" and each record\'s "situation" are the model\'s own notes: read, never stored', async () => {
    const c = setup([say('Ren', 'start of the day'), say('Mara', 'morning'), say('Ren', 'I sent you a scarf')]);
    c.p.now = '10-26 18:00'; c.p.year = 2026;
    await run(c.m, { now: '10-26 22:00', scenes: [{ id: 'scarf', at: 2, quote: 'I sent you a scarf', date: '10-26', time: '20:00', summary: 'scarf', place: '', city: '', with: [] }],
        situations: [{ id: 'sc1', what: 'the scarf Ren sent', state: 'sent', where: '', when: '', known: 'I sent you a scarf', open: 'when it comes' }],
        records: [{ type: 'text', at: 2, scene: 'scarf', said: 'I sent you a scarf', situations: ['sc1'], with: 'Lio', messages: [{ from: 'me', text: 'can\'t wait!!', time: '10-26 20:10' }] }],
        everyday: [{ date: '10-26', records: [{ type: 'search', q: 'parcel tracking', time: '10-26 21:00', situations: ['sc1'] }] }] });
    assert.deepEqual(c.p.searches.map(x => x.q), ['parcel tracking']);
    assert.deepEqual(c.p.threads.find(t => t.with === 'Lio').messages.map(x => x.text), ['can\'t wait!!']);
    assert.ok([...c.p.searches, ...c.p.threads.flatMap(t => t.messages), ...c.p.threads].every(x => !('situation' in x) && !('situations' in x)));
    assert.ok(!('situations' in c.p) && !JSON.stringify(c.p).includes('the scarf Ren sent'));
});
