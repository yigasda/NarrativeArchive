import { cleanMessageURL } from './cleanmessage.mjs';
// 빼기 with sources: a whole reflection round against a fake chat and a fake model answer
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { migrateBank, cash, baseline, finance } from '../src/finance.js';
import { makeMark, newSync, journalRead, journalWrite } from '../src/phonesync.js';

const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const href = f => pathToFileURL(new URL(`../src/${f}`, import.meta.url).pathname).href;
const T = (globalThis.__dropTest = { chat: [], answers: [] });
const map = { './extract.js': cleanMessageURL,
    './phonesync.js': href('phonesync.js'), './phoneparse.js': href('phoneparse.js'), './phoneclock.js': href('phoneclock.js'), './phonemapcity.js': href('phonemapcity.js'), './phonesynclife.js': href('phonesynclife.js'), './phonesyncmoney.js': href('phonesyncmoney.js'), './finance.js': href('finance.js'),
    './phoneprofile.js': href('phoneprofile.js'),
    './phonestory.js': encoded(`export const phoneTarget=()=>({scope:phoneChatScope(),check(){}});export const phoneChatScope=()=>globalThis.__dropTest.scope||'test';`),
    './wealth.js': encoded(`export const ensureWealth=async()=>null;export const wealthBlock=()=>'';export const wealthDate=()=> '2026-10-26';export const wealthCheck=()=>null;export const addWealthFX=()=>{};`),
    './ai.js': encoded(`import { reflectionFixture } from '${new URL('./reflectionfixture.mjs', import.meta.url).href}'; import { phoneMadeFixture as __pmf } from '${new URL('./reflectionfixture.mjs', import.meta.url).href}'; const askDraft0=async(input,o)=>{if(String(o.system).startsWith('GOAL\\nWrite the ordinary life')){(globalThis.__everydayIn||=[]).push(input);const e=globalThis.__everyday;return JSON.stringify(typeof e==='function'?e(input):e||{});}if(String(o.system).startsWith('GOAL\\nWork out where')){(globalThis.__where||=[]).push(input);await globalThis.__dropTest.beforeWhere?.();return '{"people":[]}';}const T=globalThis.__dropTest;if(String(o.system).startsWith('STAGE: money')){T.moneyInput=input;T.moneySys=o.system;T.moneyCalls=(T.moneyCalls||0)+1;if(T.moneyAnswers&&T.moneyAnswers.length){const a=T.moneyAnswers.shift();return typeof a==='string'?a:JSON.stringify(a);}const core=(T.lastCore&&T.lastCore.events)||[];const out=[];for(const l of String(input).split('\\n')){const x=l.match(/^- (.+?): #(\\d+) .*?\\("(.*)"\\)(?: \\(changed\\))?$/)||l.match(/^- (.+?): #(\\d+) /);if(!x)continue;const e=core.find(e=>e&&e.money&&Number(String(e.at).replace('#',''))===Number(x[2])&&(x[3]===undefined||String(e.quote||'').slice(0,200)===x[3]));if(e)out.push({id:x[1],money:e.money});}return JSON.stringify({events:out});}T.sys=o.system;T.input=input;await T.beforeCore?.();const a=T.answers.shift();T.lastCore=a&&typeof a==='object'?a:null;const r=typeof a==='string'?a:JSON.stringify(reflectionFixture(a,input));if(!String(o.system).includes('· RECORDS\\n')||globalThis.__everyday===undefined)return r;(globalThis.__everydayIn||=[]).push(input);let e=globalThis.__everyday;e=typeof e==='function'?e(input):e;let j;try{j=JSON.parse(r);}catch{return r;}if(j&&typeof j==='object'&&j.everyday===undefined&&e&&e.everyday)j.everyday=e.everyday;return JSON.stringify(j);};;export const askDraft=async(i,o)=>__pmf(await askDraft0(i,o),i,o?.system);`),
    './core.js': encoded(`export const ctx=()=>({chat:globalThis.__dropTest.chat,chatMetadata:globalThis.__dropTest.meta,loadWorldInfo:async()=>null,characters:[]});export const globalSettings=()=>({});export const saveMeta=async()=>{};`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=()=>[];export const chatRows=()=>globalThis.__dropTest.chat.map((x,i)=>({index:i,user:x.is_user,hidden:!!x.is_system,text:'[#'+i+'] '+x.name+': '+(globalThis.__dropTest.clean?globalThis.__dropTest.clean(x.mes):x.mes)}));`),
    './inject.js': encoded(`export const applyInjection=()=>{};`),
    './knowledge.js': encoded(`export const knowledgeRows=()=>[];`),
    './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=()=>[];`),
    './sections.js': encoded(`export const parseSections=()=>[];export const RANGE_HEAD=/#(\\d+)–#(\\d+)/;export const sectionKey=()=>'';export const splitTail=s=>[s,''];`),
    './translate.js': encoded(`export const glossaryEntries=()=>globalThis.__glossaryEntries||[];export const glossaryPeople=()=>globalThis.__glossaryPeople||[];`), './world.js': encoded(`export const worldText=()=>'';`),
};
const src = await readFile(new URL('../src/phonedata.js', import.meta.url), 'utf8');
const data = await import(encoded(src.replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || k}'`)));

// 폰 2(실시간): live gives the core and money prompts the messenger lines; without it they are the story phone's
test('폰 2 live: core · money prompts read the MESSENGER chat and its action lines; without live nothing changes', () => {
    const o = { life: true, weather: true, tracker: true, zone: true, wallet: true, split: true };
    const story = data.coreRecordsSystem(o), live = data.coreRecordsSystem({ ...o, live: 'Ren' });
    assert.doesNotMatch(story, /MESSENGER|\[App\]/);
    assert.match(story, /A text exchange the messages already show: only its last 4 messages\./);
    assert.match(live, /the owner's MESSENGER chat with Ren, scene by scene under status lines; "<owner's name> \[App\]: …" lines are what the owner did on the phone then\./);
    assert.match(live, /1\. Each "<owner's name> \[App\]: …" line → its records in every app it touches, "said" that line:\n/);
    assert.match(live, /booked a flight → .*\n.*couldn't sleep → a short night in health, late screen time, a search for how to fall asleep\n.*cooked dinner from a recipe → the recipe saved in notes, a photo of the dish\n/);
    assert.doesNotMatch(live, /long run|call to mum|soaked|cold coming/);
    assert.match(live, /The owner–Ren chat itself is never a text or call; a text or call with anyone else it tells of is \("I called Dad" → a call to Dad\)\./);
    assert.doesNotMatch(live, /only its last 4 messages/);
    assert.equal(data.coreSystem({ ...o, live: 'Ren' }), live);
    const ms = data.moneySystem({ delivery: true, invest: true }), ml = data.moneySystem({ delivery: true, invest: true, live: 'Ren' });
    assert.match(ms, /- MESSAGES: every message of this round, numbered\. Messages marked \(changed\) were edited\./);
    assert.doesNotMatch(ms, /MESSENGER/);
    assert.match(ml, /- MESSAGES: the owner's MESSENGER chat with Ren this round, numbered, under status lines\. A line "<owner's name> \[App\]: …" is something the owner did on the phone right then; money the talk only promises has not moved\. Messages marked \(changed\) were edited\./);
});

test('money: a payment in another currency always carries its rate; names EVENTS gave are kept', () => {
    for (const live of ['', 'Ren']) {
        const m = data.moneySystem({ delivery: true, invest: true, live });
        assert.match(m, /"rate": always when "currency" is not the account's: the account's money for one unit of it \(1 EUR = 1480 KRW → 1480\)/);
        assert.match(m, /- A name EVENTS already gives \(a shop, a dish, a hotel, an airline\) is written the same way\./);
    }
});
