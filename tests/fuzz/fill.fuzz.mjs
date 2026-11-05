// 폰 만들기 and 채우기 against many broken model answers: the parsers must keep only sound records (no "[object Object]",
// no NaN, dates in their shape) and never crash. node tests/fuzz/fill.fuzz.mjs   (no model calls)
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SRC = new URL('../../src/', import.meta.url);
const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const href = f => pathToFileURL(new URL(f, SRC).pathname).href;
const stub = {
    './phonestory.js': encoded(`export const phoneTarget=()=>({scope:phoneChatScope(),check(){}});export const phoneChatScope=()=>'test';`),
    './wealth.js': encoded(`export const ensureWealth=async()=>null;export const wealthBlock=()=>'';export const wealthDate=()=> '2026-12-30';export const wealthCheck=()=>null;export const addWealthFX=()=>{};`),
    './ai.js': encoded(`export const askDraft=async()=>'';export const askAI=async()=>'';`),
    './core.js': encoded(`export const ctx=()=>({chat:[],chatMetadata:{},characters:[]});export const globalSettings=()=>({});export const saveMeta=async()=>{};export const getMeta=()=>({});`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=()=>[];export const chatRows=()=>[];`),
    './inject.js': encoded(`export const applyInjection=()=>{};`), './knowledge.js': encoded(`export const knowledgeRows=()=>[];`),
    './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=()=>[];`),
    './sections.js': encoded(`export const parseSections=()=>[];export const RANGE_HEAD=/#(\\d+)–#(\\d+)/;export const sectionKey=()=>'';export const splitTail=s=>[s,''];`),
    './translate.js': encoded(`export const glossaryEntries=()=>[];`), './world.js': encoded(`export const worldText=()=>'';`),
    './anniv.js': encoded(`export const datedRows=()=>[];`),
};
const real = ['phonesync.js', 'phoneparse.js', 'phonesynclife.js', 'phonesyncmoney.js', 'finance.js', 'phoneprofile.js', 'phonefood.js', 'phonescreen.js'];
const map = { ...stub, ...Object.fromEntries(real.map(f => [`./${f}`, href(f)])) };
const rewrite = async f => (await readFile(new URL(f, SRC), 'utf8')).replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || k}'`);
map['./phonedata.js'] = encoded(await rewrite('phonedata.js'));
const data = await import(map['./phonedata.js']);
const life = await import(encoded(await rewrite('phonelife.js')));

const PHONE = JSON.parse(await readFile(new URL('../../tests/fuzz/phone_answer.json', import.meta.url), 'utf8').catch(() => 'null')) || {
    country: 'DE', wallpaper: 'dusk', accent: 'blue', now: '12-30 21:00',
    contacts: [{ name: 'Mara', saved: 'Mara 🌙' }], threads: [{ with: 'Mara', messages: [{ from: 'Mara', text: 'hi', ko: '안녕', time: '12-30 20:00' }, { from: 'me', text: 'yo', time: '12-30 20:01' }] }],
    calls: [{ with: 'Mara', type: 'missed', time: '12-30 19:00', min: 0 }], photos: [{ caption: 'snow', time: '12-29 10:00', mood: 'cold' }], notes: [{ title: 'list', text: '- milk', time: '12-28 10:00' }],
    searches: [{ q: 'snow chains', time: '12-29 11:00' }], events: [{ title: 'Flight', date: '01-03', time: '10:20' }], profile: { handle: 'ren', bio: 'hi', followers: 120 },
    posts: [{ text: 'snow', time: '12-29 10:05', likes: 12, comments: [{ from: 'Mara', text: 'brr' }] }], mails: [{ from: 'LH', subject: 'Booking', text: 'ok', time: '12-20 10:00' }], diary: [{ date: '12-29', title: 'snow', text: 'cold' }],
};
const LIFE = {
    clock: { alarms: [{ time: '07:00', label: 'Work', days: ['mon', 'tue'], on: true, wake: true, then: ['07:10'], snooze: 9 }], timers: [{ label: 'Tea', sec: 240, last: '12-29' }], running: { label: 'Pasta', sec: 600, left: 200 } },
    health: { usual: { bed: '23:10', sleep: '23:30', wake: '06:30', steps: 7000, workouts: 3, rest: 62, water: 1.5, coffee: 2, coffeeKind: 'Latte', coffeeKo: '라떼', weight: 68, height: 175 },
        days: [{ date: '12-29', steps: 5000, km: 3.4, floors: 2, workout: { kind: 'Run', time: '18:30', min: 30, km: 5 }, hr: [55, 140], night: { bed: '23:00', sleep: '23:20', wake: '06:40', woke: 1 }, from: 'pattern' }] },
    files: { folders: [{ name: 'Work', count: 3, fav: true }], items: [{ name: 'plan.pdf', kind: 'pdf', folder: 'Work', size: 1240, time: '12-28 10:00', opened: '12-29 11:00', pages: 4 }], cloud: { used: 12, total: 50 } },
    weather: { here: { place: 'Berlin', date: '12-30', time: '21:00', from: 'guess', cond: 'snow', temp: -2, hi: 1, lo: -5, line: 'Snow', hours: [{ time: '22:00', cond: 'snow', temp: -2, rain: 40 }], days: [{ day: '12-31', cond: 'snow', lo: -5, hi: 2, rain: 30 }], tiles: { wind: 14, sunrise: '08:17', sunset: '16:02' } },
        cities: [{ name: 'Seoul', tz: 'Asia/Seoul', cond: 'clear', temp: -6, hi: -1, lo: -9 }] },
};
const DLV = {
    shops: [{ name: 'Pizza Mara', cuisine: 'Pizza', rating: 4.6, reviews: 812, fee: 1.9, minOrder: 12, eta: '25–35', fav: true, menu: [{ name: 'Margherita', ko: '마르게리타', price: 9, top: true, pic: { base: 'pizza', with: ['basil'], size: 'large', set: ['cola'] } }] }],
    orders: [{ shop: 'Pizza Mara', items: [{ name: 'Margherita', option: 'no basil', optionKo: '바질 빼고', qty: 1, price: 9, pic: { base: 'pizza' } }], fee: 1.9, tip: 1, discount: 0, mode: 'delivery', time: '12-29 19:40', arrived: '12-29 20:15', to: 'home', for: 2, status: 'delivered', account: '1111', paidBy: '', reviewed: false, gift: '' }],
    cart: { shop: 'Pizza Mara', items: [{ name: 'Margherita', qty: 1, price: 9 }], noteShop: 'crispy' },
};
const MONEY = {
    currency: 'EUR', basis: 'student', bank: { name: 'Sparkasse', accounts: [{ id: '', kind: 'checking', name: 'Giro', last4: '1111', currency: 'EUR', balance: 1200 }, { kind: 'credit', name: 'Visa', last4: '2222', balance: 0 }] },
    cards: [{ name: 'Visa', last4: '2222', kind: 'credit' }], tx: [{ account: '1111', who: 'Rewe', amount: -23.4, time: '12-29 18:00', kind: 'card' }],
    orders: [{ shop: 'Zalando', item: 'Scarf', price: 30, status: 'shipped', time: '12-27 10:00', eta: '01-04' }], passes: [{ kind: 'flight', by: 'LH', from: 'BER', to: 'ICN', date: '01-03', time: '10:20', seat: '32A' }],
};
const BAD = [undefined, null, '', 'abc', 0, -3, 1e12, '12,50', '€9.90', [], {}, true, '2026-12-31', '25:99', '1/2', [null], [1, 'x']];
function* paths(o, path = []) { if (o && typeof o === 'object') { yield path; for (const [k, v] of Object.entries(o)) yield* paths(v, [...path, k]); } else yield path; }
const setAt = (o, path, v) => { const c = structuredClone(o); let x = c; for (const k of path.slice(0, -1)) x = x[k]; if (v === undefined) delete x[path.at(-1)]; else x[path.at(-1)] = v; return c; };
const problems = new Map();
const note = (where, what) => { if (!problems.has(what)) problems.set(what, where); };
// every string and number a parser kept
function sweep(o, where, path = '') {
    if (Array.isArray(o)) { o.forEach((x, k) => { if (x === null || x === undefined) note(where, `null in list ${path}`); sweep(x, where, `${path}[]`); }); return; }
    if (o && typeof o === 'object') { for (const [k, v] of Object.entries(o)) sweep(v, where, `${path}.${k}`); return; }
    if (typeof o === 'number' && !Number.isFinite(o)) note(where, `${path} = ${o}`);
    if (typeof o === 'string' && /\[object Object\]|^(undefined|null|NaN)$/.test(o)) note(where, `${path} = "${o}"`);
    const clock = t => { const mt = /^(\d{2}):(\d{2})$/.exec(t); return !!mt && mt[1] < 24 && mt[2] < 60; }, day = t => { const mt = /^(\d{2})-(\d{2})$/.exec(t); return !!mt && mt[1] >= 1 && mt[1] <= 12 && mt[2] >= 1 && mt[2] <= 31; };
    if (typeof o === 'string' && o && /(^|\.)(time|opened|arrived|sleep|wake|bed|sunrise|sunset)$/.test(path) && !(clock(o) || day(o.slice(0, 5)) && (o.length === 5 || o[5] === ' ' && clock(o.slice(6))))) note(where, `${path} shape "${o}"`);
    if (typeof o === 'string' && o && /(^|\.)(date|day|trashed|last|made)$/.test(path) && !day(o)) note(where, `${path} shape "${o}"`);
    if (path.endsWith('passes[].eta') || path.endsWith('orders[].eta')) if (o && !day(String(o))) note(where, `${path} shape "${o}"`);
}
let runs = 0;
const tryParse = (name, fn, raw, path, v) => {
    runs++;
    let out;
    try { out = fn(raw); } catch (e) { if (e instanceof TypeError || e instanceof ReferenceError || !/[가-힣]/.test(e.message)) note(`${name} ${path.join('.')}=${JSON.stringify(v)}`, `${name} CRASH ${e.constructor.name}: ${e.message} @ ${String(e.stack).split('\n')[1]?.trim()}`); return; }
    sweep(out, `${name} ${path.join('.')}=${JSON.stringify(v)}`, name);
};
const P = [
    ['parsePhone', raw => data.parsePhone(JSON.stringify(raw)), PHONE],
    ['parseLife', raw => life.parseLife(raw, null, '12-29'), LIFE],
    ['parseDelivery', raw => life.parseDelivery(raw, [{ last4: '1111' }], [{ id: 't1', amount: -9, account: '1111' }], '12-30 21:00'), DLV],
    ['parseMoney', raw => data.parseMoney(raw, 'DE'), MONEY],
    ['nearbyShops', raw => life.nearbyShops(raw, [{ name: 'Pasta Nostra' }], false), { nearby: [{ name: 'Sushi Ya', ko: '스시야', cuisine: 'Sushi', dish: { name: 'Lachs Maki', ko: '연어 마키', price: 8.5, pic: { base: 'sushi', with: ['salmon'] } } }, { name: 'Pasta Nostra', dish: { name: 'x' } }] }],
];
for (const [name, fn, base] of P) {
    tryParse(name, fn, base, ['(base)'], null);
    for (const path of paths(base)) { if (!path.length) continue; for (const v of BAD) tryParse(name, fn, setAt(base, path, v), path, v); }
    for (const raw of [null, {}, [], 'x', { [Object.keys(base)[0]]: null }]) tryParse(name, fn, raw, ['(whole)'], raw);
}
console.log(`runs ${runs}, problems ${problems.size}`);
for (const [what, where] of problems) console.log(`- ${what}\n    at ${where}`);
