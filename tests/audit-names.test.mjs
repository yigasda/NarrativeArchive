import { cleanMessageURL } from './cleanmessage.mjs';
// 아카이브 뒤의 원문: what the archive doesn't cover yet goes along whole, oldest first; past the budget the request
// stops, its app marks where, and the reflection reads on from there
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SRC = new URL('../src/', import.meta.url);
const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const href = f => pathToFileURL(new URL(f, SRC).pathname).href;
const stub = {
    './phonestory.js': encoded(`export const phoneTarget=()=>({scope:phoneChatScope(),check(){}});export const phoneChatScope=()=>'test';`),
    './wealth.js': encoded(`export const ensureWealth=async()=>null;export const wealthBlock=()=>'';export const wealthDate=()=> '2026-12-30';export const wealthCheck=()=>null;export const addWealthFX=()=>{};export const investmentWealthRows=()=>[];`),
    './ai.js': encoded(`import { phoneMadeFixture as __pmf } from '${new URL('./reflectionfixture.mjs', import.meta.url).href}'; const askDraft0=async(input,o)=>{if(String(o.system).startsWith('GOAL\\nWrite the ordinary life')){(globalThis.__everydayIn||=[]).push(input);const e=globalThis.__everyday;return JSON.stringify(typeof e==='function'?e(input):e||{});}if(String(o.system).startsWith('GOAL\\nWork out where')){(globalThis.__where||=[]).push(input);return JSON.stringify(globalThis.__whereAnswer||{people:[]});}const M=globalThis.__menu;M.input=input;M.sys=o.system;(M.calls||=[]).push({input,sys:o.system});if(M.answers&&M.answers.length){const a=M.answers.shift();if(a instanceof Error)throw a;return typeof a==='function'?a(input,o):a;}return M.answer;};export const askAI=async()=>'';;export const askDraft=async(i,o)=>__pmf(await askDraft0(i,o),i,o?.system);`),
    './core.js': encoded(`export const ctx=()=>globalThis.__ctx||({chat:[],chatMetadata:{},characters:[]});export const globalSettings=()=>({});export const saveMeta=async()=>{};export const getMeta=()=>({});`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=n=>(globalThis.__rows||[]).slice(-n).map(r=>r.text);export const chatRows=()=>globalThis.__rows||[];`),
    './inject.js': encoded(`export const applyInjection=()=>{};`), './knowledge.js': encoded(`export const knowledgeRows=()=>[];`),
    './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=()=>globalThis.__trackers||[];`),
    './sections.js': encoded(`export const RANGE_HEAD=/^(?:(\\S{1,12})\\s)?#(\\d+)\\s*([–—~-])\\s*#?(\\d+)(.*)$/;export const parseSections=t=>[...String(t).matchAll(/^## (.+)\\n[^#]*/gm)].map(x=>({title:x[1],start:x.index,end:x.index+x[0].length,group:false}));export const sectionKey=s=>s.title;export const splitTail=s=>[s,''];`),
    './translate.js': encoded(`export const glossaryEntries=()=>globalThis.__glossaryEntries||[];export const glossaryPeople=()=>globalThis.__glossaryPeople||[];`), './world.js': encoded(`export const worldText=()=>'';`),
    './anniv.js': encoded(`export const datedRows=()=>[];`),
};
const real = ['phonesync.js', 'phoneparse.js', 'phoneclock.js', 'phonesynclife.js', 'phonesyncmoney.js', 'finance.js', 'phoneprofile.js', 'phonefood.js', 'phonescreen.js'];
const map = { './extract.js': cleanMessageURL, ...stub, ...Object.fromEntries(real.map(f => [`./${f}`, href(f)])) };
const rewrite = async f => (await readFile(new URL(f, SRC), 'utf8')).replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || k}'`);
map['./phonedata.js'] = encoded(await rewrite('phonedata.js') + '\nexport { mergePhone as __mergePhone, peopleMoved as __peopleMoved, scenesWith as __scenesWith, isOwnerName as __isOwnerName, glossAka as __glossAka, archiveClockBlock as __archiveClockBlock };');
const data = await import(map['./phonedata.js']);
const life = await import(encoded(await rewrite('phonelife.js')));

const plainPhone = (extra = {}) => ({ owner: 'Ren', now: '10-26 12:00', country: 'DE', contacts: [], threads: [], calls: [], photos: [], notes: [], searches: [], events: [], posts: [], mails: [], diary: [], voice: [], visits: [], ...extra });
const row = (name, city, tz, extra = {}) => ({ name, city, names: [city], lives: tz === 'Asia/Seoul' ? 'KR' : tz === 'Europe/Paris' ? 'FR' : 'DE', tz, ...extra });
const read = async (mm, p, people) => { globalThis.__where = []; globalThis.__whereAnswer = { people }; try { return await data.readWhere(mm, p); } finally { delete globalThis.__whereAnswer; } };
const gloss = (pairs, people = []) => { globalThis.__glossaryEntries = pairs.map(([src, ko]) => ({ src, ko })); globalThis.__glossaryPeople = people; };
const unGloss = () => { delete globalThis.__glossaryEntries; delete globalThis.__glossaryPeople; };
const mText = extra => ({ text: '## #0–#3 — Arrival\n- Ren came home.\n', glossary: '', ...extra });

test('다녀간 곳: the visit added is the very item kept (its sources, its 빼기), "with" by name, the owner never, "Ren Kim" kept', () => {
    gloss([['Ivo', '이보']], ['Ivo']);
    try {
        const p = plainPhone({ where: { at: 1, people: [row('Ren', 'Frankfurt', 'Europe/Berlin', { aka: ['렌'] }), row('Ivo', 'Paris', 'Europe/Paris')] } });
        const v = { place: 'Café Lumen', city: 'Frankfurt', time: '10-26 11:00', with: ['이보', 'Ivo', '렌', 'Ren Kim'], froms: [{ at: 4 }] };
        data.__mergePhone(p, { threads: [], posts: [], contacts: [], visits: [v] }, { m: mText({ glossary: 'Ivo = 이보' }) });
        assert.equal(p.visits[0], v);
        assert.deepEqual(p.visits[0].with, ['Ivo', 'Ren Kim']);
        assert.deepEqual(p.visits[0].froms, [{ at: 4 }]);
        // the same place told again, its clock a little off: the one there
        data.__mergePhone(p, { threads: [], posts: [], contacts: [], visits: [{ place: 'Café Lumen', city: 'Frankfurt', time: '10-26 11:40', with: [] }] });
        assert.equal(p.visits.length, 1);
        data.__mergePhone(p, { threads: [], posts: [], contacts: [], visits: [{ place: 'Café Lumen', city: 'Frankfurt', time: '10-26 15:00', with: [] }] });
        assert.equal(p.visits.length, 2);
    } finally { unGloss(); }
});

test('위치 정보: an aka two rows share is no one\'s (Ivo Kim and Ivo Park stay two); the owner by another name of theirs stays the owner\'s row', async () => {
    globalThis.__rows = [];
    const mm = mText();
    let p = plainPhone({ contacts: [{ name: 'Ivo Kim' }, { name: 'Ivo Park' }], where: { at: 1, people: [row('Ivo Kim', 'Paris', 'Europe/Paris', { aka: ['Ivo'] }), row('Ivo Park', 'Seoul', 'Asia/Seoul', { aka: ['Ivo'] })] } });
    await read(mm, p, [{ name: 'Ivo Kim', aka: ['Ivo'], city: 'Paris', lives: 'FR', tz: 'Europe/Paris' }]);
    assert.deepEqual(p.where.people.map(x => x.name).sort(), ['Ivo Kim', 'Ivo Park']);
    gloss([['Ren', '렌']], ['Ren']);
    try {
        p = plainPhone({ where: { at: 1, people: [row('Ren', 'Frankfurt', 'Europe/Berlin')] } });
        await read(mText({ glossary: 'Ren = 렌' }), p, [{ name: '렌', city: 'Berlin', lives: 'DE', tz: 'Europe/Berlin' }, { name: 'Ren', city: 'Berlin', lives: 'DE', tz: 'Europe/Berlin' }]);
        assert.deepEqual(p.where.people.map(x => x.name), ['Ren']);
        assert.ok(p.where.people[0].aka.includes('렌'));
        assert.equal(p.where.people[0].city, 'Berlin');
    } finally { unGloss(); }
});

test('the owner by a name of theirs only: "Ren Kim" for an owner Ren is asked about, kept on its own, and named in a scene', async () => {
    globalThis.__rows = [];
    const p = plainPhone({ contacts: [{ name: 'Ren Kim' }, { name: 'Mara' }], where: { at: 1, people: [row('Ren', 'Seoul', 'Asia/Seoul')] } });
    await read(mText(), p, [{ name: 'Ren', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }, { name: 'Ren Kim', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }]);
    assert.deepEqual(globalThis.__where.at(-1).split('[PEOPLE]\n')[1].split('\n\n')[0].split('\n').sort(), ['Mara', 'Ren Kim']);
    assert.deepEqual(p.where.people.map(x => x.name).sort(), ['Ren', 'Ren Kim']);
    assert.ok(!arr0(p.where.people.find(x => x.name === 'Ren').aka).includes('Ren Kim'));
    assert.deepEqual(data.__scenesWith(p, 'Ren met Ren Kim at the station.', [], mText()), ['Ren Kim']);
    assert.ok(data.__isOwnerName(p, null, 'ren') && !data.__isOwnerName(p, null, 'Ren Kim'));
});
const arr0 = v => (Array.isArray(v) ? v : []);

test('사람 이동: one moved by any name of theirs is their row; one taken off by another form stays off; the owner by a name of theirs is not "someone else"', () => {
    gloss([['Ivo', '이보'], ['Ren', '렌']], ['Ivo', 'Ren']);
    try {
        const mm = mText({ glossary: 'Ivo = 이보\nRen = 렌' });
        let p = plainPhone({ where: { at: 1, people: [row('Ren', 'Frankfurt', 'Europe/Berlin'), row('Ivo', 'Paris', 'Europe/Paris')] } });
        assert.equal(data.__peopleMoved(p, [{ name: '이보', city: 'Seoul', tz: 'Asia/Seoul' }, { name: '렌', city: 'Seoul', tz: 'Asia/Seoul' }], '', mm), true);
        assert.deepEqual(p.where.people.map(x => [x.name, x.city]).sort(), [['Ivo', 'Seoul'], ['Ren', 'Frankfurt']]);
        p = plainPhone({ where: { at: 1, removed: ['ivo'], people: [row('Ren', 'Frankfurt', 'Europe/Berlin')] } });
        assert.equal(data.__peopleMoved(p, [{ name: '이보', city: 'Seoul', tz: 'Asia/Seoul' }], '이보가 서울에 갔다.', mm), false);
        // someone new, named in the messages by a 용어집 form of theirs
        p = plainPhone({ where: { at: 1, people: [row('Ren', 'Frankfurt', 'Europe/Berlin')] } });
        assert.equal(data.__peopleMoved(p, [{ name: 'Ivo', city: 'Seoul', tz: 'Asia/Seoul' }], '이보가 서울로 떠났다.', mm), true);
    } finally { unGloss(); }
});

test('time choices: a 용어집 other form is searched for only when 용어집 marks it a person', async () => {
    gloss([['Rose', '장미']], []);
    try {
        const mm = mText({ glossary: 'Rose = 장미' });
        const p = plainPhone({ now: '11-05 12:00', year: 2026, where: { at: 1, people: [row('Ren', 'Seoul', 'Asia/Seoul'), row('Rose', 'Paris', 'Europe/Paris', { aka: ['장미'] })] } });
        const rows = r => [{ index: 2, text: r, clockSource: `${r} <span class="time">11.05 12:38</span>` }];
        const of = async t => (await data.reflectionClocks(p, rows(t), mm)).text;
        assert.ok(!(await of('장미를 한 송이 샀다.')).includes('Rose'));
        assert.ok((await of('Rose texted at noon.')).includes('Rose'));
        // (a row with both forms is still searched for by its own name: SCENES WITH too)
        assert.deepEqual(data.__scenesWith(p, 'Rose came by.', [], mm), ['Rose']);
        assert.deepEqual(data.__scenesWith(p, '장미를 샀다.', [], mm), []);
        globalThis.__glossaryPeople = ['Rose']; mm.glossaryPeople = ['Rose'];
        assert.ok((await of('장미가 문자를 보냈다.')).includes('Rose'));
    } finally { unGloss(); }
});

test('글 안 이름: "하고" as a verb is no name; 로 · 에 · 에서 · 보다 · 였 after a name are', () => {
    assert.equal(data.namedIn('나는 소망하고 싶다', '소망'), false);
    assert.equal(data.namedIn('소망하고 있었다', '소망'), false);
    assert.equal(data.namedIn('소망하고 밥을 먹었다', '소망'), true);
    // (after a name of three letters or more; a short Korean name may be that word, "가을에", "하늘로")
    for (const t of ['마리아로 정했다', '마리아에 맞췄다', '마리아에서 끝났다', '마리아보다 크다', '마리아였다', '마리아으로 했다', 'Ivo에서 만났다']) assert.equal(data.namedIn(t, t.startsWith('Ivo') ? 'Ivo' : '마리아'), true, t);
    for (const [t, n] of [['가을에 단풍', '가을'], ['하늘로 날아갔다', '하늘'], ['바다에서 수영', '바다'], ['하나였다', '하나'], ['나라보다 크다', '나라'], ['유리로 만든 컵', '유리']]) assert.equal(data.namedIn(t, n), false, t);
    assert.equal(data.namedIn('소망에게 줬다', '소망'), true);
    assert.equal(data.namedIn('이보다 크다', '이보'), false);
});

test('용어집 forms on 위치 정보 rows: an empty row skipped, a full aka list no change', async () => {
    gloss([['Ivo', '이보']], ['Ivo']);
    try {
        const full = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'];
        const p = plainPhone({ where: { at: 1, people: [null, row('Ren', 'Seoul', 'Asia/Seoul'), row('Ivo', 'Paris', 'Europe/Paris', { aka: full })] }, syncUndo: { whereAfter: '{"people":[]}' } });
        const undo = p.syncUndo.whereAfter;
        assert.doesNotThrow(() => data.__glossAka(mText({ glossary: 'Ivo = 이보' }), p));
        assert.deepEqual(p.where.people[2].aka, full);
        // (nothing added: the 되돌리기 copies are left as they were)
        assert.equal(p.syncUndo.whereAfter, undo);
        assert.deepEqual(p.where.people[1].aka, undefined);
    } finally { unGloss(); }
});

test('02-29 with no year: converted in a leap year, never the 1st of March', async () => {
    const p = plainPhone({ owner: 'Ren', now: '02-29 05:00', noYear: true, where: { at: 1, people: [row('Ren', 'Frankfurt', 'Europe/Berlin'), row('Mara', 'Seoul', 'Asia/Seoul')] } });
    const r = 'Mara texted.', got = await data.reflectionClocks(p, [{ index: 2, text: r, clockSource: `${r} <span class="time">02.29 12:00</span>` }], mText());
    assert.deepEqual(got.choices.map(c => [c.names[0], c.ownerTime]).sort(), [['Mara', '02-29 04:00'], ['Ren', '02-29 12:00']]);
});

test('점검 수정 2: "Ren Kim" moving or read never moves the owner Ren nor takes the city the owner set by hand; the owner\'s full name, given as their aka, is the owner everywhere; a name two rows share moves no one and makes no third row', async () => {
    globalThis.__rows = [];
    // moved: the owner stays
    let p = plainPhone({ contacts: [{ name: 'Ren Kim' }], where: { at: 1, people: [row('Ren', 'Frankfurt', 'Europe/Berlin')] } });
    assert.equal(data.__peopleMoved(p, [{ name: 'Ren Kim', city: 'Seoul', tz: 'Asia/Seoul' }], '', mText()), true);
    assert.deepEqual(p.where.people.map(x => [x.name, x.city]).sort(), [['Ren Kim', 'Seoul'], ['Ren', 'Frankfurt']]);
    // read: no city of the owner's
    p = plainPhone({ contacts: [{ name: 'Ren Kim' }], where: { at: 1, people: [row('Ren', 'Frankfurt', 'Europe/Berlin', { manual: { city: true } })] } });
    await read(mText(), p, [{ name: 'Ren Kim', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }]);
    const kim = p.where.people.find(x => x.name === 'Ren Kim');
    assert.deepEqual([kim.city, kim.tz, kim.manual], ['Seoul', 'Asia/Seoul', undefined]);
    assert.equal(p.where.people.find(x => x.name === 'Ren').city, 'Frankfurt');
    // the owner's full name in the contacts, the reading giving it as the owner's aka (and a row of its own too)
    p = plainPhone({ contacts: [{ name: 'Ren Park' }, { name: 'Mara' }], where: { at: 1, people: [row('Ren', 'Frankfurt', 'Europe/Berlin')] } });
    globalThis.__where = []; globalThis.__whereAnswer = { people: [{ name: 'Ren', aka: ['Ren Park'], city: 'Frankfurt', lives: 'DE', tz: 'Europe/Berlin' }, { name: 'Ren Park', city: 'Frankfurt', lives: 'DE', tz: 'Europe/Berlin' }, { name: 'Mara', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }],
        around: [{ name: 'Ren Park', about: 'the owner' }, { name: 'Mara', about: 'Ren\'s mother' }] };
    try { await data.readWhere(mText(), p); } finally { delete globalThis.__whereAnswer; }
    assert.deepEqual(p.where.people.map(x => x.name).sort(), ['Mara', 'Ren']);
    assert.deepEqual(p.around.people.map(x => x.name), ['Mara']);
    assert.deepEqual(data.__scenesWith(p, 'Ren Park met Mara.', [], mText()), ['Mara']);
    // a name two rows share
    p = plainPhone({ where: { at: 1, people: [row('Ren', 'Frankfurt', 'Europe/Berlin'), row('Ivo Kim', 'Paris', 'Europe/Paris', { aka: ['Ivo'] }), row('Ivo Park', 'Seoul', 'Asia/Seoul', { aka: ['Ivo'] })] } });
    assert.equal(data.__peopleMoved(p, [{ name: 'Ivo', city: 'Tokyo', tz: 'Asia/Tokyo' }], '', mText()), false);
    await read(mText(), p, [{ name: 'Ivo', city: 'Tokyo', lives: 'JP', tz: 'Asia/Tokyo' }]);
    assert.deepEqual(p.where.people.map(x => [x.name, x.city]).sort(), [['Ivo Kim', 'Paris'], ['Ivo Park', 'Seoul'], ['Ren', 'Frankfurt']]);
});

test('점검 수정 2: new endings after a name only end a word ("소망에너지", "이보로봇" are no name); one cafe twice two hours apart, or in two cities, is two visits', () => {
    for (const t of ['소망에너지 주식', '이보로봇', '이보에스프레소']) assert.equal(data.namedIn(t, t.slice(0, 2)), false, t);
    for (const t of ['마리아에서는', '마리아로는', '마리아였는데', '마리아보다도']) assert.equal(data.namedIn(t, '마리아'), true, t);
    for (const t of ['마리아에너지', '마리아로봇']) assert.equal(data.namedIn(t, '마리아'), false, t);
    const p = plainPhone({ where: { at: 1, people: [row('Ren', 'Frankfurt', 'Europe/Berlin')] } });
    const visit = (time, city = 'Frankfurt') => data.__mergePhone(p, { threads: [], posts: [], contacts: [], visits: [{ place: 'Bar X', city, time, with: [] }] });
    visit('10-26 11:00'); visit('10-26 11:40'); visit('10-26 13:00'); visit('10-26 13:10', 'Paris');
    assert.deepEqual(p.visits.map(x => [x.time, x.city]), [['10-26 11:00', 'Frankfurt'], ['10-26 13:00', 'Frankfurt'], ['10-26 13:10', 'Paris']]);
});

test('점검 수정 2: 02-29 in a year with none is converted in the next leap year, its hours and its summer-time notes alike', () => {
    const p = plainPhone({ now: '02-29 12:00', year: 2026, where: { at: 1, people: [row('Ren', 'Berlin', 'Europe/Berlin'), row('Mara', 'New York', 'America/New_York')] } });
    const z = data.zonesOf(p, p.now, mText());
    assert.deepEqual(z.others.map(o => [o.name, o.hours, o.dst]), [['Mara', -6, undefined]]);
});

test('점검 3: a first name stands for a person only when it is theirs alone, never the owner\'s; an old phone\'s owner row by their full name is the owner\'s', () => {
    let p = plainPhone({ around: { people: [{ name: 'Ren Kim', about: 'x' }, { name: 'Mara Lee', about: 'y' }] }, where: { at: 1, people: [row('Ren', 'Frankfurt', 'Europe/Berlin')] } });
    assert.deepEqual(data.__scenesWith(p, 'Ren went home alone.', [], mText()), []);
    assert.deepEqual(data.__scenesWith(p, 'Mara called.', [], mText()), ['Mara Lee']);
    // an old reading: the owner's row as "Ren Park", "Ren" its aka
    for (const aka of [['Ren']]) {
        p = plainPhone({ where: { at: 1, people: [row('Ren Park', 'Seoul', 'Asia/Seoul', aka ? { aka } : {}), row('Mara', 'Paris', 'Europe/Paris')] } });
        assert.equal(data.ownerZone(p).tz, 'Asia/Seoul');
        assert.ok(data.__isOwnerName(p, null, 'Ren Park'));
        assert.deepEqual(data.__scenesWith(p, 'Ren Park met Mara.', [], mText()), ['Mara']);
        const v = { place: 'Cafe', city: 'Seoul', time: '10-26 11:00', with: ['Ren Park', 'Mara'] };
        data.__mergePhone(p, { threads: [], posts: [], contacts: [], visits: [v] });
        assert.deepEqual(p.visits[0].with, ['Mara']);
    }
    // a row that only shares the owner's first name is someone else's, in the contacts or not ("Ren Kim", the father)
    for (const contacts of [[{ name: 'Ren Kim' }], []]) {
        p = plainPhone({ contacts, where: { at: 1, people: [row('Ren Kim', 'New York', 'America/New_York'), row('Mara', 'Seoul', 'Asia/Seoul')] } });
        assert.notEqual(data.ownerZone(p)?.tz, 'America/New_York');
        assert.ok(!data.__isOwnerName(p, null, 'Ren Kim'));
    }
});

test('점검 3: a place at 0 hours with a summer-time change near is a line; a city typed by its Korean, German or Japanese name has its zone', () => {
    const p = plainPhone({ owner: 'Ren', year: 2026, where: { at: 1, people: [row('Ren', 'Sydney', 'Australia/Sydney'), row('Mara', 'Brisbane', 'Australia/Brisbane')] } });
    const z = data.zonesOf(p, '04-06 12:00', mText());
    assert.deepEqual(z.others.map(o => [o.name, o.hours, !!o.dst?.length]), [['Mara', 0, true]]);
    for (const [c, tz] of [['부산', 'Asia/Seoul'], ['Busan', 'Asia/Seoul'], ['München', 'Europe/Berlin'], ['뮌헨', 'Europe/Berlin'], ['오사카', 'Asia/Tokyo'], ['인천', 'Asia/Seoul'], ['Lord Howe Island', 'Australia/Lord_Howe'], ['서울', 'Asia/Seoul']]) assert.equal(data.tzForCity(plainPhone(), c), tz, c);
});

test('점검 4: one person in PEOPLE AROUND and in the events is one for their first name; an old owner row by the full name is shown once in 위치 정보', () => {
    let p = plainPhone({ around: { people: [{ name: 'Mara Lee', about: 'x' }] }, where: { at: 1, people: [row('Ren', 'Frankfurt', 'Europe/Berlin')] } });
    assert.deepEqual(data.__scenesWith(p, 'Mara called.', ['Mara Lee'], mText()), ['Mara Lee']);
    // two people by that first name: neither by it alone
    p = plainPhone({ around: { people: [{ name: 'Mara Lee', about: 'x' }, { name: 'Mara Kim', about: 'y' }] }, where: { at: 1, people: [row('Ren', 'Frankfurt', 'Europe/Berlin')] } });
    assert.deepEqual(data.__scenesWith(p, 'Mara called.', [], mText()), []);
    assert.deepEqual(data.__scenesWith(p, 'Mara Kim called.', [], mText()), ['Mara Kim']);
    p = plainPhone({ where: { at: 1, people: [row('Ren Park', 'Seoul', 'Asia/Seoul', { aka: ['Ren'] }), row('Mara', 'Paris', 'Europe/Paris')] } });
    const info = data.placeInfo(p);
    assert.equal(info.owner.city, 'Seoul');
    assert.deepEqual(info.people.map(x => x.name), ['Mara']);
});

test('점검 5: a city name two places go by is asked, which one; a city the app doesn\'t know, which country, then that country\'s zones; the zone picked is the one kept', async () => {
    for (const c of ['Cambridge', 'Portland', '케임브리지']) assert.equal(data.tzForCity(plainPhone(), c), '', c);
    assert.equal(data.tzForCity(plainPhone(), 'LA'), 'America/Los_Angeles');
    assert.deepEqual(data.cityChoices(plainPhone(), 'Cambridge'), { choices: [{ tz: 'Europe/London', label: '영국 케임브리지' }, { tz: 'America/New_York', label: '미국 케임브리지 (매사추세츠)' }] });
    assert.deepEqual(data.cityChoices(plainPhone(), 'Busan'), { tz: 'Asia/Seoul' });
    assert.deepEqual(data.cityChoices(plainPhone(), 'Gimhae-si Daedong'), { askCountry: true });
    assert.deepEqual(data.countryZones('DE'), [{ tz: 'Europe/Berlin', label: data.COUNTRIES.DE }]);
    assert.ok(data.countryZones('US').some(z => z.tz === 'America/Chicago') && data.countryZones('US').length === 7);
    assert.deepEqual(data.countryZones(''), []);
    // a saved Cambridge (a weather city of the phone's) is that one, not asked
    assert.equal(data.tzForCity(plainPhone({ life: { weather: { cities: [{ name: 'Cambridge', tz: 'America/New_York' }] } } }), 'Cambridge'), 'America/New_York');
    // asked, then picked
    const p = plainPhone({ where: { at: 1, people: [row('Ren', 'Seoul', 'Asia/Seoul'), row('Mara', 'Paris', 'Europe/Paris')] } });
    await assert.rejects(data.setPlaceCity(mText(), p, 'Mara', 'Portland'), err => err.choices?.length === 2);
    await data.setPlaceCity(mText(), p, 'Mara', 'Portland', 'America/New_York');
    assert.deepEqual([p.where.people[1].city, p.where.people[1].tz, p.where.people[1].manual.city], ['Portland', 'America/New_York', true]);
    await data.setPlaceCity(mText(), p, 'Mara', '김해', 'Asia/Seoul');
    assert.equal(p.where.people[1].tz, 'Asia/Seoul');
});

test('점검 6 (사람 이름): a name read again keeps the aka it had (the owner\'s full name too); an aka the reading gives that is the owner\'s on someone else, or another row\'s name, takes no row; the owner moved takes their row by a name of theirs', async () => {
    globalThis.__rows = [];
    // read again with only Mara asked: Ren's "Ren Park" and Mara's "Mars" stay
    let p = plainPhone({ contacts: [{ name: 'Ren Park' }, { name: 'Mara' }], where: { at: 1, people: [row('Ren', 'Frankfurt', 'Europe/Berlin', { aka: ['Ren Park'] }), row('Mara', 'Seoul', 'Asia/Seoul', { aka: ['Mars'] })] } });
    await read(mText(), p, [{ name: 'Ren', city: 'Paris', lives: 'DE', tz: 'Europe/Paris' }, { name: 'Mara', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }]);
    assert.deepEqual(p.where.people.map(x => [x.name, x.aka]), [['Ren', ['Ren Park']], ['Mara', ['Mars']]]);
    assert.ok(data.__isOwnerName(p, null, 'Ren Park'));
    // "Ren" given as Ren Kim's aka: no owner's row, no owner's city set by hand
    p = plainPhone({ contacts: [{ name: 'Ren Kim' }], where: { at: 1, people: [row('Ren', 'Frankfurt', 'Europe/Berlin', { manual: { city: true } })] } });
    await read(mText(), p, [{ name: 'Ren Kim', aka: ['Ren'], city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }]);
    assert.deepEqual(p.where.people.map(x => [x.name, x.city, !!x.manual]).sort(), [['Ren Kim', 'Seoul', false], ['Ren', 'Frankfurt', true]]);
    // "Mara" given as Mara Kim's aka while Mara has a row of her own: two people
    p = plainPhone({ contacts: [{ name: 'Mara' }, { name: 'Mara Kim' }], where: { at: 1, people: [row('Ren', 'Seoul', 'Asia/Seoul'), row('Mara', 'Paris', 'Europe/Paris', { manual: { city: true } })] } });
    await read(mText(), p, [{ name: 'Mara', city: 'Seoul', lives: 'KR', tz: 'Asia/Seoul' }, { name: 'Mara Kim', aka: ['Mara'], city: 'Busan', lives: 'KR', tz: 'Asia/Seoul' }]);
    assert.deepEqual(p.where.people.map(x => [x.name, x.city]).sort(), [['Mara Kim', 'Busan'], ['Mara', 'Paris'], ['Ren', 'Seoul']]);
});

test('점검 6 (글 안 이름 · 용어집 · 다녀간 곳): what Korean puts after a name ending in a vowel; a 용어집 pair gone takes its form off; away from home the city is a visit; one cafe by two names of its city is one visit; "with" by a first name; a visit with no time is on its day', async () => {
    for (const [t, n] of [['"민지라고, 우리 과 동기."', '민지'], ['민지로부터 문자가 왔다', '민지'], ['마리아조차 몰랐다', '마리아'], ['마리아라면 알 거야', '마리아'], ['민지마저 떠났다', '민지'], ['민지밖에 없어', '민지'], ['민지뿐이야', '민지'], ['지훈으로부터 전화', '지훈'], ['서준인데', '서준']]) assert.equal(data.namedIn(t, n), true, t);
    // 용어집 "Rose = 장미" changed to "Rose = 로즈": "장미" goes
    gloss([['Rose', '장미']], ['Rose']);
    let p = plainPhone({ where: { at: 1, people: [row('Ren', 'Seoul', 'Asia/Seoul'), row('Rose', 'Paris', 'Europe/Paris')] } });
    data.__glossAka(mText({ glossary: 'Rose = 장미' }), p);
    assert.deepEqual(p.where.people[1].aka, ['장미']);
    gloss([['Rose', '로즈']], ['Rose']);
    data.__glossAka(mText({ glossary: 'Rose = 로즈' }), p);
    assert.deepEqual(p.where.people[1].aka, ['로즈']);
    assert.deepEqual(data.__scenesWith(p, '꽃집에서 장미 한 다발을 샀다', [], mText({ glossary: 'Rose = 로즈' })), []);
    unGloss();
    // living in Korea, in Tokyo now: Tokyo is a visit
    p = plainPhone({ lives: 'KR', where: { at: 1, people: [row('Ren', 'Tokyo', 'Asia/Tokyo', { lives: 'KR' })] } });
    data.__mergePhone(p, { threads: [], posts: [], contacts: [], visits: [{ place: '도쿄', city: '도쿄', time: '10-26 11:00', with: [] }] });
    assert.equal(p.visits.length, 1);
    // the same cafe as "부산", "Busan" and no city, minutes apart: one visit; another city's same-named cafe: another
    p = plainPhone({ where: { at: 1, people: [row('Ren', 'Seoul', 'Asia/Seoul'), row('Mara Lee', 'Seoul', 'Asia/Seoul')] } });
    for (const [city, time] of [['부산', '10-26 11:00'], ['Busan', '10-26 11:20'], ['', '10-26 11:30'], ['Paris', '10-26 11:40']]) data.__mergePhone(p, { threads: [], posts: [], contacts: [], visits: [{ place: '카페 루멘', city, time, with: ['Mara'] }] });
    assert.deepEqual(p.visits.map(x => x.city), ['부산', 'Paris']);
    assert.deepEqual(p.visits[0].with, ['Mara Lee']);
});

test('점검 6 (시차): only a city on the owner\'s hours, its summer-time change near, is no other clock: no old-style block, an unnamed place is the owner\'s', () => {
    const p = plainPhone({ owner: 'Ren', now: '04-06 09:00', year: 2026, where: { at: 1, people: [row('Ren', 'Sydney', 'Australia/Sydney'), row('Mara', 'Brisbane', 'Australia/Brisbane')] } });
    assert.equal(data.__archiveClockBlock(p, p.now, mText()), '');
    assert.equal(data.sceneHome(p, 'Cafe Luna', mText()), true);
    // a day with other hours: the block, as before
    assert.match(data.__archiveClockBlock({ ...p, now: '04-03 09:00' }, '04-03 09:00', mText()), /Mara \(in Brisbane\) is 1 hour behind/);
});
