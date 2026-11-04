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
    './phonestory.js': encoded(`export const phoneChatScope=()=>'test';`),
    './wealth.js': encoded(`export const ensureWealth=async()=>null;export const wealthBlock=()=>'';export const wealthDate=()=> '2026-12-30';export const wealthCheck=()=>null;export const addWealthFX=()=>{};`),
    './ai.js': encoded(`export const askDraft=async(input,o)=>{globalThis.__menu.input=input;globalThis.__menu.sys=o.system;return globalThis.__menu.answer;};export const askAI=async()=>'';`),
    './core.js': encoded(`export const ctx=()=>({chat:[],chatMetadata:{},characters:[]});export const globalSettings=()=>({});export const saveMeta=async()=>{};export const getMeta=()=>({});`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=n=>(globalThis.__rows||[]).slice(-n).map(r=>r.text);export const chatRows=()=>globalThis.__rows||[];`),
    './inject.js': encoded(`export const applyInjection=()=>{};`), './knowledge.js': encoded(`export const knowledgeRows=()=>[];`),
    './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=()=>[];`),
    './sections.js': encoded(`export const RANGE_HEAD=/^(?:(\\S{1,12})\\s)?#(\\d+)\\s*([–—~-])\\s*#?(\\d+)(.*)$/;export const parseSections=t=>[...String(t).matchAll(/^## (.+)\\n[^#]*/gm)].map(x=>({title:x[1],start:x.index,end:x.index+x[0].length,group:false}));export const sectionKey=s=>s.title;export const splitTail=s=>[s,''];`),
    './translate.js': encoded(`export const glossaryEntries=()=>[];`), './world.js': encoded(`export const worldText=()=>'';`),
    './anniv.js': encoded(`export const datedRows=()=>[];`),
};
const real = ['phonesync.js', 'phoneparse.js', 'phonesynclife.js', 'phonesyncmoney.js', 'finance.js', 'phoneprofile.js', 'phonefood.js', 'phonescreen.js'];
const map = { ...stub, ...Object.fromEntries(real.map(f => [`./${f}`, href(f)])) };
const rewrite = async f => (await readFile(new URL(f, SRC), 'utf8')).replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || k}'`);
map['./phonedata.js'] = encoded(await rewrite('phonedata.js'));
const data = await import(map['./phonedata.js']);

const rows = n => Array.from({ length: n }, (_, i) => ({ index: i, user: i % 2 === 0, hidden: i <= 3, text: `[#${i}] Ren: ${'word '.repeat(40)}${i}` }));
const m = { text: '## #0–#3 — Arrival\n- Ren came home (#1).\n' };

test('the chat after the archive, whole and oldest first', async () => {
    globalThis.__rows = rows(12);
    assert.equal(data.archiveEnd(m), 3);
    const g = data.chatAfterArchive(m);
    assert.deepEqual([g.from, g.to, g.n, g.all, g.left], [4, 11, 8, true, 0]);
    assert.equal(data.readMark(g), null);
    const input = await data.sideRequest(m, 'Ren', []);
    assert.match(input, /\[RECENT CHAT\]\n\[#4\] Ren/);
    assert.ok(input.includes('[#11] Ren'));
});

test('past the budget: up to where it stops, the rest the reflection\'s', async () => {
    globalThis.__rows = rows(40);
    const g = data.chatAfterArchive(m, 300);
    assert.equal(g.from, 4);
    assert.ok(!g.all && g.to < 39 && g.left === 39 - g.to, JSON.stringify(g));
    assert.equal(data.readMark(g).index, g.to);
    // stopped short: the request's now is the message it stopped at
    assert.equal(data.nowAt(g), g.to);
    assert.equal(data.nowAt(data.chatAfterArchive(m)), null);
    const read = {};
    const input = await data.sideRequest(m, 'Ren', [], { read });
    assert.equal(read.gap.from, 4);
    // nothing in between left out: every message from #4 to where it stops
    for (let i = 4; i <= read.gap.to; i++) assert.ok(input.includes(`[#${i}] Ren`), String(i));
});

test('no archive: the chat as before', async () => {
    globalThis.__rows = rows(12);
    assert.equal(data.archiveEnd({ text: '' }), -1);
    const read = {};
    await data.sideRequest({ text: '' }, 'Ren', [], { read });
    assert.equal(read.gap, null);
});

test('a fill reads no further than the phone has read (its clock); the reflection reads on from there', async () => {
    globalThis.__rows = rows(14);
    const p = { owner: 'Ren', sync: { marks: { base: { index: 6 } }, done: [[7, 9]], hiddenRead: {} } };
    assert.equal(data.phoneAt(p), 9);
    const g = data.windowOf(m, p);
    assert.deepEqual([g.from, g.to, g.all, g.later], [4, 9, true, true]);
    assert.equal(data.nowAt(g), 9);
    assert.equal(data.readMark(g).index, 9);
    const input = await data.sideRequest({ ...m, phones: { ren: p } }, 'Ren', []);
    assert.ok(input.includes('[#9] Ren') && !input.includes('[#10] Ren'));
    assert.match(input, /the story so far ends at #9/);
    // a phone with no reading record reads to now, as before
    assert.equal(data.phoneAt({ owner: 'Ren' }), null);
    assert.equal(data.windowOf(m, { owner: 'Ren' }).to, 13);
});

test('no archive: the chat as before, but no further than the phone\'s clock', async () => {
    globalThis.__rows = rows(14);
    const p = { owner: 'Ren', sync: { marks: { base: { index: 8 } }, done: [] } };
    const read = {};
    const input = await data.sideRequest({ text: '', phones: { ren: p } }, 'Ren', [], { story: 30000, read });
    assert.equal(data.nowAt(read.gap), 8);
    assert.ok(input.includes('[#8] Ren') && !input.includes('[#9] Ren'));
});
