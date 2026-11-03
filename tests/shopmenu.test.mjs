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
const real = ['phonesync.js', 'phoneparse.js', 'phonesynclife.js', 'phonesyncmoney.js', 'finance.js', 'phoneprofile.js', 'phonefood.js'];
const map = { ...stub, ...Object.fromEntries(real.map(f => [`./${f}`, href(f)])) };
const rewrite = async f => (await readFile(new URL(f, SRC), 'utf8')).replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || k}'`);
map['./phonedata.js'] = encoded(await rewrite('phonedata.js'));
const life = await import(encoded(await rewrite('phonelife.js')));


globalThis.__menu = {};
const shop = () => ({ id: 's1', name: '발산 마라탕', cuisine: '마라탕', nearby: true, menu: [{ name: '마라탕', ko: '', desc: '', price: 9000, top: true, pic: { base: 'soup' } }] });
const phone = () => ({ owner: 'Ren', country: 'KR', lives: 'KR', money: { currency: 'KRW' }, delivery: { shops: [shop()], orders: [] } });

test('a shop nearby: its menu is asked the first time, with only the shop (no story), its known dish kept first; not again', async () => {
    const p = phone();
    assert.equal(life.menuWanted(p.delivery.shops[0]), true);
    globalThis.__menu.answer = JSON.stringify({ menu: [{ name: '꿔바로우', price: 18000, top: true, desc: '찹쌀 탕수육', pic: { base: 'fried' } }, { name: '마라탕', price: 9500, top: true }, { name: '마라샹궈', price: 22000, desc: '볶음', pic: { base: 'stirfry' } }] });
    assert.equal(await life.fillShopMenu({}, p, 's1'), true);
    const s = p.delivery.shops[0];
    assert.deepEqual(s.menu.map(x => [x.name, x.top]), [['마라탕', true], ['꿔바로우', false], ['마라샹궈', false]]);
    assert.equal(s.menu[0].price, 9000);
    assert.match(globalThis.__menu.input, /\[SHOP\]/);
    assert.match(globalThis.__menu.input, /\[CURRENCY\]\nKRW/);
    assert.ok(!/ARCHIVE|RECENT CHAT/.test(globalThis.__menu.input));
    assert.equal(life.menuWanted(s), false);
    assert.equal(await life.fillShopMenu({}, p, 's1'), false);
});
test('a shop the user orders from, or one already asked, is never asked', () => {
    assert.equal(life.menuWanted({ ...shop(), nearby: false }), false);
    assert.equal(life.menuWanted({ ...shop(), menuAt: 1 }), false);
});
