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
    './ai.js': encoded(`export const askDraft=async(input,o)=>{if(String(o.system).startsWith('GOAL\\nWork out where')){(globalThis.__where||=[]).push(input);if(globalThis.__whereFail)throw new Error('quota');return '{"people":[]}';}const T=globalThis.__archTest;if(String(o.system).startsWith('STAGE: money')){T.moneyInput=input;T.moneySys=o.system;T.moneyCalls=(T.moneyCalls||0)+1;if(T.moneyAnswers&&T.moneyAnswers.length){const a=T.moneyAnswers.shift();return typeof a==='string'?a:JSON.stringify(a);}const core=(T.lastCore&&T.lastCore.events)||[];const out=[];for(const l of String(input).split('\\n')){const x=l.match(/^- (.+?): #(\\d+) .*?\\("(.*)"\\)(?: \\(changed\\))?$/)||l.match(/^- (.+?): #(\\d+) /);if(!x)continue;const e=core.find(e=>e&&e.money&&Number(String(e.at).replace('#',''))===Number(x[2])&&(x[3]===undefined||String(e.quote||'').slice(0,200)===x[3]));if(e)out.push({id:x[1],money:e.money});}return JSON.stringify({events:out});}T.sys=o.system;T.input=input;const a=T.answers.shift();T.lastCore=a&&typeof a==='object'?a:null;return typeof a==='string'?a:JSON.stringify(a);};`),
    './core.js': encoded(`export const ctx=()=>({chat:globalThis.__archTest.chat,chatMetadata:globalThis.__archTest.meta,loadWorldInfo:async()=>null,characters:[]});export const globalSettings=()=>({});export const saveMeta=async()=>{};`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=()=>[];export const chatRows=()=>globalThis.__archTest.chat.map((x,i)=>({index:i,user:x.is_user,hidden:!!x.is_system,text:'[#'+i+'] '+x.name+': '+x.mes}));`),
    './inject.js': encoded(`export const applyInjection=()=>{};`),
    './knowledge.js': encoded(`export const knowledgeRows=()=>[];`),
    './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=(n,o={})=>{const T=globalThis.__archTest;const len=(o.chat||T.chat).length;(T.trackLens||=[]).push(len);return (T.trackers||[]).filter(t=>!Number.isInteger(t.i)||t.i<len);};`),
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
    await withTrackers([trk(2, '12:50', "Mara's room")], async () => {
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
        assert.match(data.clockBlock(bare, data.storyNow(bare)), /The owner is in Frankfurt am Main, 10-26 04:50 now/);
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
    await withTrackers([trk(2, '12:50', "Mara's room")], async () => {
        assert.match(data.clockBlock(c.p, c.p.now, c.m), /Mara \(in South Korea\) is 8 hours ahead/);
        assert.equal(data.statusMoment(c.p, null, null, c.m).at, '');
        await run(c.m, { now: '10-26 04:52', statusCity: '', events: [] });
        assert.equal(c.p.now, '10-26 04:52');
        assert.equal(data.storyNow(c.p, null, c.m), '10-26 04:52');
    });
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
    assert.ok(!/Mara.*ahead/.test(data.clockBlock(c.p, c.p.now, c.m)));
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
