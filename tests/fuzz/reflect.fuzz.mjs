import { cleanMessageURL } from '../cleanmessage.mjs';
// A reflection round against many broken model answers (fields missing, wrong types, odd dates): what the code must
// survive without a crash, without NaN in money, and without English error text in what the user is told.
// node tests/fuzz/reflect.fuzz.mjs   (no model calls)
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SRC = new URL('../../src/', import.meta.url);
const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const href = f => pathToFileURL(new URL(f, SRC).pathname).href;
const T = (globalThis.__dropTest = { chat: [], answers: [] });
const map = { './extract.js': cleanMessageURL,
    './phonesync.js': href('phonesync.js'), './phoneparse.js': href('phoneparse.js'), './phoneclock.js': href('phoneclock.js'), './phonemapcity.js': href('phonemapcity.js'), './phonesynclife.js': href('phonesynclife.js'), './phonesyncmoney.js': href('phonesyncmoney.js'), './finance.js': href('finance.js'),
    './phoneprofile.js': href('phoneprofile.js'), './phonefood.js': href('phonefood.js'),
    './phonestory.js': encoded(`export const phoneTarget=()=>({scope:phoneChatScope(),check(){}});export const phoneChatScope=()=>'test';`),
    './wealth.js': encoded(`export const ensureWealth=async()=>null;export const wealthBlock=()=>'';export const wealthDate=()=> '2026-12-30';export const wealthCheck=()=>null;export const addWealthFX=()=>{};`),
    './ai.js': encoded(`import { reflectionFixture } from '${new URL('../reflectionfixture.mjs', import.meta.url).href}'; export const askDraft=async(input,o)=>{if(String(o.system).includes('Write the ordinary life'))return '{}';if(String(o.system).startsWith('GOAL\\nWork out where')){(globalThis.__where||=[]).push(input);return '{"people":[]}';}const T=globalThis.__dropTest;if(String(o.system).startsWith('STAGE: money')){T.moneyInput=input;T.moneySys=o.system;T.moneyCalls=(T.moneyCalls||0)+1;if(T.moneyAnswers&&T.moneyAnswers.length){const a=T.moneyAnswers.shift();return typeof a==='string'?a:JSON.stringify(a);}const core=(T.lastCore&&T.lastCore.events)||[];const out=[];for(const l of String(input).split('\\n')){const x=l.match(/^- (.+?): #(\\d+) .*?\\("(.*)"\\)(?: \\(changed\\))?$/)||l.match(/^- (.+?): #(\\d+) /);if(!x)continue;const e=core.find(e=>e&&e.money&&Number(String(e.at).replace('#',''))===Number(x[2])&&(x[3]===undefined||String(e.quote||'').slice(0,200)===x[3]));if(e)out.push({id:x[1],money:e.money});}return JSON.stringify({events:out});}T.sys=o.system;T.input=input;const a=T.answers.shift();T.lastCore=a&&typeof a==='object'?a:null;return typeof a==='string'?a:JSON.stringify(reflectionFixture(a,input));};`),
    './core.js': encoded(`export const ctx=()=>({chat:globalThis.__dropTest.chat,chatMetadata:globalThis.__dropTest.meta,loadWorldInfo:async()=>null,characters:[]});export const globalSettings=()=>({});export const saveMeta=async()=>{};`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=()=>[];export const chatRows=()=>globalThis.__dropTest.chat.map((x,i)=>({index:i,user:x.is_user,hidden:!!x.is_system,text:'[#'+i+'] '+x.name+': '+x.mes}));`),
    './inject.js': encoded(`export const applyInjection=()=>{};`),
    './knowledge.js': encoded(`export const knowledgeRows=()=>[];`),
    './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=()=>[];`),
    './sections.js': encoded(`export const parseSections=()=>[];export const RANGE_HEAD=/#(\\d+)–#(\\d+)/;export const sectionKey=()=>'';export const splitTail=s=>[s,''];`),
    './translate.js': encoded(`export const glossaryEntries=()=>[];export const glossaryPeople=()=>globalThis.__glossaryPeople||[];`), './world.js': encoded(`export const worldText=()=>'';`),
};
const load = async f => import(encoded((await readFile(new URL(f, SRC), 'utf8')).replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || k}'`)));
const data = await load('phonedata.js');
const { migrateBank, cash, baseline } = await import(href('finance.js'));
const { makeMark, newSync } = await import(href('phonesync.js'));
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };
globalThis.performance ||= { timeOrigin: Date.now() };

const say = (who, mes) => ({ is_user: who === 'Ren', is_system: false, name: who, mes });
const CHAT = [say('Ren', 'start'), say('Mara', 'morning'), say('Ren', 'pizza tonight?'), say('Mara', 'yes, I ordered'), say('Ren', 'I ran 5 km'), say('Mara', 'see you at the airport on the 3rd')];
function setup() {
    T.chat = CHAT.map(x => ({ ...x })); T.meta = { integrity: 'x' };
    const p = { owner: 'Ren', now: '12-30 09:00', year: 2026, country: 'DE', contacts: [{ name: 'Mara' }], threads: [], calls: [], photos: [], notes: [], searches: [], events: [], posts: [{ id: 'po1', text: 'hi', time: '12-20 10:00', comments: [] }], mails: [], diary: [], voice: [],
        money: { currency: 'EUR', asOf: '2026-12-20', bank: { accounts: [{ id: 'chk', kind: 'checking', name: 'Giro', last4: '1111', currency: 'EUR', balance: 1000 }, { id: 'cc', kind: 'credit', name: 'Karte', last4: '2222', currency: 'EUR', balance: 0 }] }, cards: [], tx: [], orders: [], passes: [] },
        life: { at: '12-29 08:00', clock: { alarms: [{ id: 'a1', time: '06:10', label: 'Up', days: ['mon'], date: '', on: true, then: [] }], timers: [], running: null },
            health: { usual: { sleep: '23:30', wake: '06:30', steps: 7000, weight: 70, coffee: 2 }, days: [{ id: 'h1', date: '12-29', sleep: '23:40', wake: '06:20', steps: 6800, from: 'pattern' }] },
            files: { folders: [], items: [] }, weather: { here: { place: 'Varo', date: '12-29', time: '09:00', cond: 'clear', temp: 2, hours: [], days: [] }, cities: [] } },
        delivery: { shops: [{ name: 'Pizza Mara', menu: [] }], orders: [], cart: null, look: 'ubereats' } };
    const m = { text: '', phones: { ren: p } };
    p.investment = { base: 'EUR', date: '2026-12-20', accounts: [{ key: 'brk:EUR', currency: 'EUR' }], securities: [{ symbol: 'XETRA:SAP', name: 'SAP', currency: 'EUR' }], trades: [], watch: [], history: [], schedules: [], notes: [], generatedDates: [] };
    migrateBank(m, p);
    baseline(m, 'brk', 'EUR', 1000, '2026-12-01', 'Ren');
    p.sync = newSync('test');
    p.sync.marks.base = makeMark(T.chat, 1);
    for (const k of ['money', 'delivery', 'life', 'invest']) p.sync.marks[k] = { index: 0 };
    return { m, p };
}
// a full, plausible answer touching every part
const BASE = {
    clock: { basis: 'Resolved story time', finalViewpoint: 'Ren', elapsedTime: null, sceneTime: '01-02 21:10', messageSender: null },
    now: '01-02 21:10',
    events: [
        { id: 'pizza', at: 3, quote: 'I ordered', summary: 'pizza', date: '12-31', time: '19:40',
            phone: { threads: [{ with: 'Mara', messages: [{ from: 'Mara', text: 'ordered!', ko: '시켰어', time: '12-31 19:41' }] }], photos: [{ caption: 'pizza box', time: '12-31 20:20', mood: 'warm' }],
                notes: [{ title: 'NYE', text: '- buy sparklers', time: '12-31 10:00' }], usual: { weight: 69.5, coffee: 3, coffeeKind: 'Flat White', water: 2 } },
            money: { amountFrom: 'story', moves: [{ account: '1111', amount: -12.5, currency: 'EUR', who: 'Kiosk', memo: 'sparklers', kind: 'card', occurrence: 'new', already: '' }, { account: '1111', amount: -10.9, currency: 'EUR', who: 'Pizza Mara', kind: 'card', occurrence: 'new', already: '' }],
                trades: [{ kind: 'buy', symbol: 'XETRA:SAP', name: 'SAP', currency: 'EUR', quantity: 2, price: 180, fee: 1, occurrence: 'new', already: '' }, { kind: 'buy', symbol: 'NASDAQ:AAPL', name: 'Apple', ko: '애플', currency: 'EUR', quantity: 1, price: 200, occurrence: 'new', already: '' }, { kind: 'dividend', symbol: 'XETRA:SAP', currency: 'EUR', amount: 4.4, occurrence: 'new', already: '' }],
                orders: [{ shop: 'Zalando', item: 'Scarf', qty: 1, price: 30, status: 'shipped', eta: '01-04', occurrence: 'new', already: '' }],
                passes: [{ kind: 'flight', by: 'LH', from: 'BER', to: 'ICN', date: '01-03', time: '10:20', seat: '32A', status: 'confirmed', already: '' }],
                deliveries: [{ shop: 'Pizza Mara', items: [{ name: 'Margherita', ko: '마르게리타', option: 'no basil', optionKo: '바질 빼고', qty: 1, price: 9, pic: { base: 'pizza', with: ['tomato'], size: 'large', set: ['cola'] } }], fee: 1.9, tip: 1, discount: 0, mode: 'delivery', time: '12-31 19:40', arrived: '20:15', to: 'home', for: 2, status: 'delivered', account: '1111', occurrence: 'new', already: '', newShop: null }] } },
        { id: 'run', at: 4, quote: 'I ran 5 km', summary: 'run', date: '01-01', time: '10:00',
            phone: { health: [{ date: '01-01', sleep: '01:30', wake: '09:00', steps: 9000, km: 6.2, workout: { kind: 'Run', time: '10:00', min: 32, km: 5 }, hr: [60, 165], from: 'story' }],
                alarms: [{ change: 'a1', time: '06:40', label: 'Up', days: ['mon', 'tue'], on: true }], files: [{ name: 'ticket.pdf', kind: 'pdf', folder: 'Downloads', size: 220, time: '01-01 11:00', look: 'receipt' }, { name: 'IMG_2041.jpg', kind: 'image', folder: 'Camera', size: 3100, time: '01-01 10:50', look: 'Snow' }],
                events: [{ title: 'Flight to Seoul', date: '01-03', time: '10:20' }], diary: [{ date: '01-01', title: 'New year', text: 'ran.' }], voice: [{ title: 'memo', text: 'run felt good', time: '01-01 10:40', sec: 20 }] } },
        { id: 'air', at: 5, quote: 'airport', summary: 'airport plan', date: '01-02', time: '', phone: { calls: [{ with: 'Mara', type: 'in', time: '01-02 18:00', min: 4 }], mails: [{ from: 'LH', subject: 'Check-in', text: 'open', time: '01-02 10:00' }], searches: [{ q: 'BER terminal', time: '01-02 12:00' }], posts: [{ text: 'packing', time: '01-02 15:00', comments: [{ from: 'Mara', text: 'ㅋㅋ' }] }] } },
    ],
    days: [{ date: '12-30', steps: 4000, from: 'pattern' }, { date: '01-02', steps: 3000, from: 'pattern' }],
    weather: { place: 'Varo', date: '01-02', time: '21:00', from: 'chat', cond: 'snow', temp: -2, hi: 1, lo: -5, line: 'snow', ko: '눈', hours: [{ time: '22:00', cond: 'snow', temp: -3, rain: 40 }], days: [{ day: '01-03', cond: 'cloudy', lo: -4, hi: 2, rain: 20 }],
        tiles: { wind: 12, sunrise: '08:17', sunset: '16:02' }, cities: [{ name: 'Seoul', cond: 'clear', temp: -6, hi: -1, lo: -9 }] },
};
// what a slipping model writes instead of a value
const BAD = [null, '', 'abc', 0, -3, 1e12, '12,50', '€9.90', [], {}, true, '2026-12-31', '25:99', '1/2', 'MM-DD', NaN];
function* paths(o, path = []) {
    if (o && typeof o === 'object') { yield path; for (const [k, v] of Object.entries(o)) yield* paths(v, [...path, k]); }
    else yield path;
}
const setAt = (o, path, v) => { const c = structuredClone(o); if (!path.length) return v; let x = c; for (const k of path.slice(0, -1)) x = x[k]; if (v === undefined) delete x[path.at(-1)]; else x[path.at(-1)] = v; return c; };

const problems = new Map();
const note = (kind, path, v, extra) => { const key = `${kind}: ${String(extra).slice(0, 160)}`; if (!problems.has(key)) problems.set(key, `${path.join('.')} = ${JSON.stringify(v)}`); };
const ENGLISH = /Cannot|undefined|is not|null|NaN|TypeError|ReferenceError|of undefined/;
function check(p, m, path, v) {
    const bad = [];
    for (const t of p.money?.tx || []) { if (!Number.isFinite(t.amount)) bad.push(`tx amount ${t.amount}`); if (!/^\d{2}-\d{2}/.test(String(t.time))) bad.push(`tx time ${t.time}`); }
    for (const a of p.money?.bank?.accounts || []) if (a.balance !== null && !Number.isFinite(a.balance)) bad.push(`balance ${a.balance}`);
    for (const L of Object.values(m.finance?.accounts || {})) for (const [id, e] of Object.entries(L.entries || {})) { if (!Number.isFinite(e.amount)) bad.push(`ledger ${id} ${e.amount}`); if (e.date && !/^\d{4}-\d{2}-\d{2}/.test(e.date)) bad.push(`ledger date ${e.date}`); }
    if (!/^\d{2}-\d{2} \d{2}:\d{2}$/.test(p.now || '')) bad.push(`now ${p.now}`);
    if (!Number.isFinite(p.year)) bad.push(`year ${p.year}`);
    for (const o of p.delivery?.orders || []) { if (!o.items?.length) bad.push('order without items'); for (const x of o.items || []) if (!Number.isFinite(x.price) || !Number.isFinite(x.qty)) bad.push(`order item ${x.price}x${x.qty}`); }
    for (const d of p.life?.health?.days || []) if (!/^\d{2}-\d{2}$/.test(d.date)) bad.push(`health date ${d.date}`);
    const u = p.life?.health?.usual || {};
    for (const k of ['weight', 'coffee', 'water']) if (u[k] !== undefined && u[k] !== null && !Number.isFinite(u[k])) bad.push(`usual ${k} ${u[k]}`);
    for (const k of ['threads', 'calls', 'photos', 'notes', 'searches', 'events', 'mails', 'diary', 'voice']) for (const x of p[k] || []) for (const [f, val] of Object.entries(x)) if (typeof val === 'string' && /^(undefined|null|NaN|\[object Object\])$/.test(val)) bad.push(`${k}.${f} = ${val}`);
    const told = JSON.stringify([p.syncLast?.notes, p.sync?.failed]);
    if (ENGLISH.test(told.replace(/"failed":null/g, ''))) { const mt = told.match(/[^"]*(Cannot|undefined|is not|TypeError|ReferenceError)[^"]*/); if (mt) bad.push(`user told: ${mt[0]}`); }
    // every kept string and number on the phone (the sync bookkeeping aside)
    const clock = t => { const mt = /^(\d{2}):(\d{2})$/.exec(t); return !!mt && mt[1] < 24 && mt[2] < 60; }, day = t => { const mt = /^(\d{2})-(\d{2})$/.exec(t); return !!mt && mt[1] >= 1 && mt[1] <= 12 && mt[2] >= 1 && mt[2] <= 31; };
    const sweep = (o, at) => {
        if (Array.isArray(o)) return o.forEach(x => { if (x === null || x === undefined) bad.push(`null in ${at}`); else sweep(x, `${at}[]`); });
        if (o && typeof o === 'object') return Object.entries(o).forEach(([k, x]) => sweep(x, `${at}.${k}`));
        if (typeof o === 'number' && !Number.isFinite(o)) bad.push(`${at} = ${o}`);
        if (typeof o !== 'string' || !o) return;
        if (/\[object Object\]|^(undefined|null|NaN)$/.test(o)) bad.push(`${at} = "${o}"`);
        if (/\.(time|opened|arrived|sleep|wake|bed|sunrise|sunset)$/.test(at) && !(clock(o) || day(o.slice(0, 5)) && (o.length === 5 || o[5] === ' ' && clock(o.slice(6))))) bad.push(`${at} shape "${o}"`);
        if (/\.(date|day|trashed|eta)$/.test(at) && !/money\.orders|passes/.test('') && !day(o) && !/^\d{4}-\d{2}-\d{2}/.test(o) && !/shops/.test(at)) bad.push(`${at} shape "${o}"`);
    };
    const { sync, syncLast, syncUndo, ...rest } = p;
    sweep(rest, 'p'); sweep(m.finance, 'finance');
    for (const b of bad) note('BAD', path, v, b);
}
let runs = 0;
async function one(answer, path, v) {
    const { m, p } = setup();
    T.answers = [answer];
    runs++;
    try { await data.makePhone(m, 'Ren', { update: true }); }
    catch (e) { if (!/[가-힣]/.test(String(e?.message)) || e instanceof TypeError || e instanceof ReferenceError) note('CRASH', path, v, `${e?.constructor?.name}: ${e?.message} @ ${String(e?.stack || '').split('\n')[1]?.trim()}`); return; }
    check(p, m, path, v);
}
// the base answer must go through clean, with every part landing
{
    const { m, p } = setup(); T.answers = [BASE]; await data.makePhone(m, 'Ren', { update: true });
    const got = { failed: p.sync.failed, notes: p.syncLast?.notes, trades: p.investment.trades.length, tx: p.money.tx.length, orders: p.money.orders.length, passes: p.money.passes.length, dlv: p.delivery.orders.length, health: p.life.health.days.length, files: p.life.files.items.length, looks: p.life.files.items.map(f => f.look).join(','), weight: p.life.health.usual.weight, now: p.now, year: p.year, weather: p.life.weather.here.cond, texts: p.threads.length, voice: p.voice.length, dlvAccount: p.delivery.orders[0]?.account };
    if (process.env.SHOW) console.log(JSON.stringify(got));
    if (Object.keys(got.failed || {}).length || got.trades !== 3 || got.dlv !== 1 || got.dlvAccount !== '1111' || got.looks !== 'receipt,snow' || got.notes?.length || got.now !== '01-02 21:10' || got.year !== 2027) throw new Error('BASE DID NOT LAND ' + JSON.stringify(got));
}
await one(BASE, ['(base)'], null);
for (const path of paths(BASE)) {
    if (!path.length) continue;
    for (const v of [undefined, ...BAD]) await one(setAt(BASE, path, v), path, v);
}
// whole answers that are broken
for (const raw of ['', 'no json', '{"now": "01-02 21:10"}', '{"events": {}}', '{"events": [null, 1, "x"]}', '[]', 'null', '{"events":[{"id":"a","at":3,"phone":null,"money":"x"}]}']) await one(raw, ['(answer)'], raw);
console.log(`runs ${runs}, problems ${problems.size}`);
for (const [k, where] of problems) console.log(`- ${k}\n    at ${where}`);
