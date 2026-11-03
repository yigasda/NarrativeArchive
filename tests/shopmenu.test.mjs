// 동네 가게 메뉴: asked once for a shop nearby, its known dish kept first
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SRC = new URL('../src/', import.meta.url);
const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const href = f => pathToFileURL(new URL(f, SRC).pathname).href;
const stub = {
    './phonestory.js': encoded(`export const phoneChatScope=()=>'test';`),
    './wealth.js': encoded(`export const ensureWealth=async()=>null;export const wealthBlock=()=>'';export const wealthDate=()=> '2026-12-30';export const wealthCheck=()=>null;export const addWealthFX=()=>{};`),
    './ai.js': encoded(`export const askDraft=async(input,o)=>{globalThis.__menu.input=input;globalThis.__menu.sys=o.system;return globalThis.__menu.answer;};export const askAI=async()=>'';`),
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
const life = await import(encoded(await rewrite('phonelife.js')));


globalThis.__menu = {};
const shop = (id, name, dish) => ({ id, name, cuisine: 'x', nearby: true, menu: [{ name: dish, ko: '', desc: '', price: 9000, top: true, pic: { base: 'soup' } }] });
const phone = () => ({ owner: 'Ren', country: 'KR', lives: 'KR', money: { currency: 'KRW' }, delivery: { shops: [shop('s1', '발산 마라탕', '마라탕'), shop('s2', '곱창 이야기', '곱창'), { id: 's0', name: '단골집', menu: [{ name: 'a' }, { name: 'b' }] }], orders: [] } });

test('the shops nearby get all their menus in one request (only the shops, no story), each known dish kept first; not asked again', async () => {
    const p = phone();
    globalThis.__menu.answer = JSON.stringify({ shops: [
        { name: '발산 마라탕', menu: [{ name: '꿔바로우', price: 18000, top: true, desc: '찹쌀 탕수육', pic: { base: 'fried' } }, { name: '마라탕', price: 9500, top: true }, { name: '마라샹궈', price: 22000 }] },
        { name: '곱창 이야기', menu: [{ name: '막창', price: 16000 }, { name: '곱창전골', price: 28000 }] },
        { name: '모르는 가게', menu: [{ name: 'x', price: 1 }] }] });
    assert.equal(await life.fillShopMenus({}, p), 2);
    const [a, b, c] = p.delivery.shops;
    assert.deepEqual(a.menu.map(x => [x.name, x.top]), [['마라탕', true], ['꿔바로우', false], ['마라샹궈', false]]);
    assert.equal(a.menu[0].price, 9000);
    assert.deepEqual(b.menu.map(x => x.name), ['곱창', '막창', '곱창전골']);
    assert.equal(c.menu.length, 2);
    assert.match(globalThis.__menu.input, /\[SHOPS\]/);
    assert.ok(globalThis.__menu.input.includes('발산 마라탕') && globalThis.__menu.input.includes('곱창 이야기') && !globalThis.__menu.input.includes('단골집'));
    assert.match(globalThis.__menu.input, /\[CURRENCY\]\nKRW/);
    assert.ok(!/ARCHIVE|RECENT CHAT/.test(globalThis.__menu.input));
    assert.equal(await life.fillShopMenus({}, p), 0);
});
test('a shop the user orders from, or one already asked, is never asked; an answer with no menus is an error', async () => {
    assert.equal(life.menuWanted({ ...shop('s', 'n', 'd'), nearby: false }), false);
    assert.equal(life.menuWanted({ ...shop('s', 'n', 'd'), menuAt: 1 }), false);
    globalThis.__menu.answer = '{}';
    await assert.rejects(life.fillShopMenus({}, phone()));
});

// ---- 동네 가게 새로 고침
const dlvPhone = () => ({ owner: 'Ren', country: 'DE', lives: 'DE', now: '10-26 20:00', money: { currency: 'EUR' },
    life: { weather: { here: { place: 'Frankfurt, Westend' }, cities: [{ name: 'Frankfurt' }, { name: 'Berlin' }] } },
    delivery: { nearbyAt: '10-23', nearbyRounds: 3, city: 'Frankfurt', orders: [{ shop: 'Pasta Nostra', time: '10-20 19:00' }, { shop: 'Old Diner', time: '08-01 19:00' }],
        shops: [{ id: 'a', name: 'Pasta Nostra', menu: [] }, { id: 'b', name: 'Old Diner', menu: [] }, { id: 'c', name: 'Sushi Ya', nearby: true, menu: [] }, { id: 'd', name: 'Döner Eck', nearby: true, menu: [] }] } });
const newShop = name => ({ name, cuisine: 'x', menu: [{ name: `${name} dish`, price: 9, top: true, pic: { base: 'pizza' } }, { name: `${name} 2`, price: 10 }] });

test('nearby shops: a phone with no day kept starts counting, nothing asked', async () => {
    const p = dlvPhone(); delete p.delivery.nearbyAt;
    globalThis.__menu.input = '';
    assert.equal(await life.refreshNearby({}, p), 0);
    assert.equal(p.delivery.nearbyAt, '10-26');
    assert.equal(globalThis.__menu.input, '');
});
test('nearby shops wait for 3 story days and 3 reflections both', async () => {
    const p = dlvPhone(); p.delivery.nearbyRounds = 1;
    globalThis.__menu.input = '';
    assert.equal(await life.refreshNearby({}, p, { read: true }), 0);
    assert.equal(p.delivery.nearbyRounds, 2);
    assert.equal(globalThis.__menu.input, '');
    p.delivery.nearbyAt = '10-25'; p.delivery.nearbyRounds = 9;
    assert.equal(life.nearbyDue(p), '');
});
test('nearby shops after 3 story days: new ones open, a nearby one goes, a shop ordered from lately never goes', async () => {
    const p = dlvPhone();
    assert.equal(life.nearbyDue(p), 'days');
    globalThis.__menu.answer = JSON.stringify({ new: [newShop('Bao Bar'), newShop('Pasta Nostra')], gone: ['Sushi Ya', 'Pasta Nostra'] });
    assert.equal(await life.refreshNearby({}, p), 1);
    const names = p.delivery.shops.map(s => s.name);
    assert.ok(names.includes('Pasta Nostra') && names.includes('Bao Bar') && names.includes('Döner Eck') && names.includes('Old Diner'));
    assert.ok(!names.includes('Sushi Ya'));
    const bao = p.delivery.shops.find(s => s.name === 'Bao Bar');
    assert.equal(bao.nearby, true); assert.equal(bao.menu.length, 2); assert.ok(bao.menuAt); assert.ok(bao.rating);
    // the old diner (not ordered in 30 days) was offered as nearby; the one ordered lately was not
    assert.match(globalThis.__menu.input, /Old Diner/);
    assert.ok(!/\[NEARBY\][^[]*Pasta Nostra/.test(globalThis.__menu.input));
    assert.equal(p.delivery.nearbyAt, '10-26');
    assert.equal(p.delivery.nearbyRounds, 0);
    assert.equal(life.nearbyDue(p), '');
});
test('nearby shops when the owner is in another saved city: that city\'s shops, the old nearby ones all gone', async () => {
    const p = dlvPhone(); p.delivery.nearbyAt = '10-26'; p.life.weather.here.place = 'Berlin Mitte';
    assert.equal(life.nearbyDue(p), 'moved');
    globalThis.__menu.answer = JSON.stringify({ new: [newShop('Curry 36'), newShop('Mustafa')], gone: [] });
    await life.refreshNearby({}, p);
    assert.match(globalThis.__menu.input, /\[MOVED\]\ntrue/);
    const names = p.delivery.shops.map(s => s.name);
    assert.deepEqual(names.sort(), ['Curry 36', 'Mustafa', 'Pasta Nostra']);
    assert.equal(p.delivery.city, 'Berlin');
});

test('스크린타임만 채우기: the usual and the last days without one; health days untouched, a told day kept', async () => {
    const p = { owner: 'Ren', country: 'DE', now: '10-26 12:00', life: { health: { usual: { sleep: '23:30' }, days: [
        { date: '10-23', sleep: '23:40', wake: '07:00', steps: 5000 }, { date: '10-24', sleep: '01:10', wake: '07:00', steps: 3000, ev: 'fight' },
        { date: '10-25', sleep: '23:00', wake: '07:00', screen: { apps: { Signal: 20 } } }, { date: '10-26', sleep: '23:00', wake: '07:00' }] } } };
    globalThis.__menu.answer = JSON.stringify({ usual: { apps: [{ app: '인스타', kind: 'social', min: 80 }, { app: 'Signal', kind: 'chat', min: 40 }], pickups: 90, late: '00:20' },
        days: [{ date: '10-23', apps: { Instagram: 70 }, pickups: 80 }, { date: '10-24', apps: { Signal: 200 }, late: '01:05' }, { date: '10-25', apps: { Signal: 999 } }, { date: '10-26', apps: { X: 1 } }] });
    assert.equal(await life.fillScreen({}, p), 3);
    const h = p.life.health;
    assert.deepEqual(h.usual.screen.apps.map(a => a.app), ['Instagram', 'Signal']);
    assert.equal(h.usual.sleep, '23:30');
    assert.deepEqual(h.days.map(d => d.screen || null), [{ apps: { Instagram: 70 }, pickups: 80 }, { apps: { Signal: 200 }, late: '01:05' }, { apps: { Signal: 20 } }, null]);
    assert.equal(h.days[1].steps, 3000);
    // only the days without one, today left to count as it goes
    assert.match(globalThis.__menu.input, /\[DAYS\]\n\[\{"date":"10-23".*"ev":"fight"\}\]/);
    assert.ok(globalThis.__menu.sys.includes('game: Brawl Stars'));
    globalThis.__menu.answer = '{}';
    await assert.rejects(life.fillScreen({}, p), /스크린타임/);
});

test('스크린타임 다시 만들기: the usual and the week anew, a day a reflection wrote kept', async () => {
    const p = { owner: 'Ren', country: 'DE', now: '10-26 12:00', life: { health: { usual: { screen: { apps: [{ app: 'Signal', kind: 'chat', min: 60 }] } }, days: [
        { id: 'h1', date: '10-10', sleep: '23:00', wake: '07:00', screen: { apps: { Signal: 50 } } },
        { id: 'h2', date: '10-23', sleep: '23:00', wake: '07:00', screen: { apps: { Signal: 55 } } },
        { id: 'sync:fight:h0', date: '10-24', sleep: '03:00', wake: '07:00', ev: 'fight', screen: { apps: { Signal: 240 }, late: '02:55' } },
        { id: 'h4', date: '10-25', sleep: '23:00', wake: '07:00' }] } } };
    globalThis.__menu.answer = JSON.stringify({ usual: { apps: [{ app: 'TikTok', kind: 'social', min: 90 }] }, days: [{ date: '10-23', apps: { TikTok: 80 } }, { date: '10-24', apps: { TikTok: 1 } }, { date: '10-25', apps: { TikTok: 70 } }] });
    await life.fillScreen({}, p, { again: true });
    const h = p.life.health, by = Object.fromEntries(h.days.map(d => [d.date, d.screen || null]));
    assert.deepEqual(h.usual.screen.apps.map(a => a.app), ['TikTok']);
    assert.deepEqual(by['10-23'], { apps: { TikTok: 80 } });
    assert.deepEqual(by['10-24'], { apps: { Signal: 240 }, late: '02:55' });
    assert.deepEqual(by['10-25'], { apps: { TikTok: 70 } });
    assert.ok(!globalThis.__menu.input.includes('"10-24"'));
    // the week before the asked days: written by the fill, worked out from the new usual now
    assert.equal(by['10-10'], null);
    // a failed call changes nothing
    globalThis.__menu.answer = '{}';
    await assert.rejects(life.fillScreen({}, p, { again: true }));
    assert.deepEqual(h.days.find(d => d.date === '10-25').screen, { apps: { TikTok: 70 } });
});

test('생활 채우기 asks no screen time; the screen time fill follows on its own request', async () => {
    assert.ok(!life.AI_SYS_LIFE.includes('"screen"') && !life.AI_SYS_LIFE.includes('Brawl Stars'));
    assert.ok(life.AI_SYS_SCREEN.includes('Google Maps') && life.AI_SYS_SCREEN.includes('4 to 8'));
});
