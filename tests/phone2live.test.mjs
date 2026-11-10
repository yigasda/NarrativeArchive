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

test('PHONE NOW names the owner\'s bank and accounts (no money), so a bank mail names the right bank', () => {
    const base = { owner: 'Mara', now: '11-11 07:00', contacts: [], threads: [], calls: [], photos: [], notes: [], searches: [], events: [], posts: [], mails: [], diary: [] };
    assert.equal(data.phoneForModel(base).bank, undefined);
    const p = { ...base, money: { bank: { name: '신한', accounts: [{ id: 'a1', kind: 'checking', name: '입출금', last4: '4821', currency: 'KRW', balance: 900000 }, { id: 'a2', kind: 'credit', name: '카드', last4: '7712', currency: 'KRW' }] } } };
    assert.deepEqual(data.phoneForModel(p).bank, { name: '신한', accounts: [{ kind: 'checking', name: '입출금', last4: '4821' }, { kind: 'credit', name: '카드', last4: '7712' }] });
    assert.doesNotMatch(JSON.stringify(data.phoneForModel(p)), /900000|balance|currency/);
});

// 폰 2 답장 지시문: the persona by name (never "user"), the apps it lists each written by the reflection
test('폰 2 reply prompt: owner and persona by name, no "user", every listed app is one the reflection can write', async () => {
    const { phone2ReplySystem, PHONE2_APPS } = await import('../src/phone2reply.js');
    const s = phone2ReplySystem({ owner: 'Mara', persona: 'Ren' });
    assert.match(s, /^GOAL\nYou are Mara\. Ren is texting you on MESSENGER\./);
    assert.doesNotMatch(s, /\buser\b/i);
    assert.match(s, /No narration\. No \*actions\*\. No quotation marks\. No status lines or tags\./);
    assert.match(s, /"state": where you are, what you are doing and until when/);
    assert.match(s, /Your last status is only where you started; as the hours pass, your day moves on \(a nurse who began at home before a night shift is on the ward by 22:00\)\. Then the texts, from there\./);
    assert.match(s, /- LANGUAGES \(sometimes\): the languages you text in and those you know but seldom use, as set on the phone\./);
    assert.match(s, /\n- "reply" in the languages you text in, the way you would use them\. With no LANGUAGES, the language you really text Ren in\.\n- "ko": the same bubbles in Korean, the way VOICES says you sound; "" for a bubble already in Korean\.\n/);
    assert.match(s, /Most moments leave something small; \[\] only when truly nothing\. Look at RECENT ON THE PHONE: you seldom reach for the same app again so soon \(a third note within the hour\); the moment may call for another\./);
    assert.doesNotMatch(s, /Opening or checking/);
    // (run1 again: the apps' last times only; a list of what is on the phone drew more of the same)
    assert.match(s, /- RECENT ON THE PHONE: when you last used each app\./);
    assert.doesNotMatch(s, /watch list|a line added to a note/);
    assert.doesNotMatch(s, /ALREADY ON THE PHONE|go check|three or more|mix|very rarely/);
    assert.doesNotMatch(s, /mixed as|now and then/);
    assert.match(s, /- Mail: when you write, answer or forward an email, or open one you were waiting for or haven't read yet\./);
    // (no Korean in the prompt itself: a Korean example pulls the reply into Korean)
    assert.doesNotMatch(s, /[가-힣]/);
    assert.match(s, /Messages: when the talk makes you text someone else \(not Ren\)/);
    for (const app of PHONE2_APPS) assert.match(s, new RegExp(`\\n- ${app.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')}: when `), app);
    // each app → where the reflection writes it (core record kind, HEALTH, or the money stage)
    const kind = { Diary: '"diary"', 'Voice memo': '"voice"', Notes: '"note"', Search: '"search"', Photos: '"photo"', Messages: '"text"', Calls: '"call"', Calendar: '"calendar"', Posts: '"post"', Mail: '"mail"', Places: '"visit"', Alarms: '"alarm"', Files: '"file"', Health: 'HEALTH' };
    const money = { Delivery: 'delivery', Shopping: '"order"', 'Bank, cards & wallet': '"payment"', Investments: 'INVESTMENTS' };
    const core = data.coreRecordsSystem({ life: true, weather: true, wallet: true, split: true, live: 'Ren' }), ms = data.moneySystem({ delivery: true, invest: true, live: 'Ren' });
    for (const app of PHONE2_APPS) {
        assert.ok(kind[app] || money[app], `no place for ${app}`);
        if (kind[app]) assert.ok(core.includes(kind[app]), `${app} → ${kind[app]} not in core`);
        else assert.ok(ms.includes(money[app]), `${app} → ${money[app]} not in money`);
    }
});

test('mail: a mail the owner sends keeps "to", its Korean is the owner\'s voice to them, an answer finds its mail by subject', () => {
    const p = data.parsePhone(JSON.stringify({ owner: 'Mara', now: '11-07 10:00', mails: [
        { from: 'Lufthansa', subject: 'Booking LH 712', text: 'Your flight is booked.', time: '11-06 14:10' },
        { from: 'Mara', to: 'Lufthansa', subject: 'Re: Booking LH 712', text: 'Please add a window seat.', time: '11-07 09:00' },
        { from: 'Bank', subject: 'Statement', text: 'Your statement is ready.', time: '11-07 09:30' },
    ] }), 'Mara');
    assert.equal(p.mails[1].to, 'Lufthansa');
    assert.equal(p.mails[0].to, undefined);
    assert.equal(data.mailAnswered(p, p.mails[1]), p.mails[0]);
    assert.equal(data.mailAnswered(p, p.mails[0]), null);
    assert.equal(data.mailAnswered(p, p.mails[2]), null);
    const gaps = data.koGaps({ ...p, owner: 'Mara' }).filter(g => g.app === 'mail' || g.app === 'mail subject');
    const sent = gaps.find(g => g.f === 'text' && g.x.text === 'Please add a window seat.'), got = gaps.find(g => g.f === 'text' && g.x.text === 'Your flight is booked.');
    assert.deepEqual([sent?.who, sent?.to], ['Mara', 'Lufthansa']);
    assert.deepEqual([got?.who, got?.to], ['Lufthansa', 'Mara']);
    assert.match(JSON.stringify(data.phoneForModel(p).mails), /"to":"Lufthansa"/);
    // (폰 2 only: a mail only opened is one already there, by its id; phone 1's prompt has no such line)
    assert.match(data.coreRecordsSystem({ life: true, wallet: true, split: true, live: 'Ren' }), /"unread"; a PHONE NOW mail the owner only opens: "already": its id, nothing else\n/);
    assert.doesNotMatch(data.coreRecordsSystem({ life: true, wallet: true, split: true }), /only opens/);
    // (live: ids, and an unread mail older than the newest three; phone 1's PHONE NOW as it was)
    const many = data.parsePhone(JSON.stringify({ owner: 'Mara', now: '11-07 10:00', mails: [{ from: 'Air Lyon', subject: 'E-ticket', text: 'Seat 14A.', time: '11-01 09:00', unread: true },
        ...[1, 2, 3, 4].map(i => ({ from: 'Shop', subject: `News ${i}`, text: 'Hi.', time: `11-0${i + 1} 09:00`, unread: false }))] }), 'Mara');
    data.ensureIds(many);
    const live = data.phoneForModel(many, { live: true }).mails, one = data.phoneForModel(many).mails;
    assert.deepEqual(live.map(x => x.subject), ['E-ticket', 'News 2', 'News 3', 'News 4']);
    assert.ok(live.every(x => x.id) && live[0].unread === true && !('unread' in live[1]));
    assert.deepEqual(one.map(x => Object.keys(x)), [['from', 'subject', 'time'], ['from', 'subject', 'time'], ['from', 'subject', 'time']]);
    assert.match(data.coreRecordsSystem({ life: true, wallet: true, split: true }), /mail: "sender", "to": only on a mail the owner sends \("sender" is then the owner\), "subject" \("Re: …" for an answer\)/);
});

test('폰 2 ko: "" for a bubble already in Korean is that bubble; the others keep their Korean, in order', async () => {
    const { phone2Ko } = await import('../src/phone2reply.js');
    assert.deepEqual(phone2Ko(['Bin gleich da', '응 알았어', 'See you'], ['곧 도착해', '', '이따 봐']), ['곧 도착해', '응 알았어', '이따 봐']);
    assert.deepEqual(phone2Ko(['Ok', '좋아'], ['알겠어']), ['알겠어', '좋아']);
    assert.deepEqual(phone2Ko([], []), []);
});
