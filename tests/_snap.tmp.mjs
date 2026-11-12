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
    './phonesync.js': href('phonesync.js'), './phoneparse.js': href('phoneparse.js'), './phoneclock.js': href('phoneclock.js'), './phonemapcity.js': href('phonemapcity.js'), './placehoods.js': href('placehoods.js'), './phonesynclife.js': href('phonesynclife.js'), './phonesyncmoney.js': href('phonesyncmoney.js'), './finance.js': href('finance.js'),
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
import { writeFileSync } from 'node:fs'; const o={}; for (const life of [0,1]) for (const w of [0,1]) for (const t of [0,1]) o[''+life+w+t]=data.updateSystem({money:false,life:!!life,weather:!!w,tracker:!!t,split:true,everyday:true}); writeFileSync(process.argv[2], JSON.stringify(o));
