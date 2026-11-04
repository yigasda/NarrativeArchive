// 용어집 › AI로 이름 찾기: what the request holds, and how the answer is read
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const map = {
    './ai.js': encoded('export const askAI=async()=>"";export const callConn=async()=>"";export const trSettings=()=>({});export const withSpinner=async(b,t,f)=>f();'),
    './core.js': encoded('export const ctx=()=>({});export const getMeta=()=>({});export const hasChat=()=>true;export const saveMeta=async()=>{};'),
    './diff.js': encoded('export const diffPairs=()=>[];export const markedPair=()=>null;'),
    './util.js': encoded('export const esc=s=>String(s);'),
};
const src = await readFile(new URL('../src/translate.js', import.meta.url), 'utf8');
const tr = await import(encoded(src.replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || k}'`)));

const say = (name, mes, hidden = false) => ({ name, mes, is_user: name === 'Ren', is_system: hidden });
const c = (chat, extra = {}) => ({ chat, characterId: 0, characters: [{ name: 'Mara', data: { description: 'Mara keeps the lighthouse at Varo Point.', first_mes: 'The veil is thin tonight.' } }],
    powerUserSettings: { persona_description: 'Ren, a courier from Ivo Harbor.' }, name1: 'Ren', substituteParams: s => s.replace(/\{\{char\}\}/g, 'Mara'), ...extra });

test('AI로 이름 찾기 sends every block its instruction names: the card, the persona, the archive, the chat not archived, what is listed', () => {
    const input = tr.glossaryFindInput(c([say('Ren', 'archived talk about Oldbridge', true), say('Mara', 'Meet me at <b>Saltmarsh</b> by {{char}}'), say('Ren', 'okay')]), { text: '## #0–#1 — Start\n- Mara met Ren.' }, ['Varo Point']);
    for (const b of ['[CHARACTER CARD — Mara]', '[PERSONA — Ren]', '[ARCHIVE]', '[RECENT CHAT]', '[IN THE GLOSSARY]\nVaro Point']) assert.ok(input.includes(b), b);
    // (the instruction lists the same blocks)
    for (const b of ['CHARACTER CARD', 'PERSONA', 'ARCHIVE', 'RECENT CHAT', 'IN THE GLOSSARY']) assert.ok(tr.AI_SYS_GLOSSARY_FIND.includes(`- ${b}`), b);
    // archived (hidden) messages come in by the archive only; tags out, names filled in
    assert.ok(!input.includes('Oldbridge'));
    assert.match(input, /Mara: Meet me at Saltmarsh by Mara/);
    assert.ok(input.indexOf('[RECENT CHAT]') < input.indexOf('[IN THE GLOSSARY]'));
});

test('AI로 이름 찾기 stays within 20,000 tokens: a long chat keeps its newest messages, a long archive its start and end', () => {
    const chat = Array.from({ length: 3000 }, (_, i) => say(i % 2 ? 'Mara' : 'Ren', `message ${i} ${'word '.repeat(40)}`));
    const input = tr.glossaryFindInput(c(chat), { text: `FIRSTNAME ${'x '.repeat(60000)} LASTNAME` });
    assert.ok(input.length / 3.6 <= 20000, String(input.length / 3.6));
    assert.match(input, /message 2999 /);
    assert.ok(!input.includes('message 0 '));
    assert.ok(input.includes('FIRSTNAME') && input.includes('LASTNAME'));
    // (no persona, no archive: those blocks are left out)
    const bare = tr.glossaryFindInput(c([say('Mara', 'hi')], { powerUserSettings: {} }), { text: '' });
    assert.ok(!bare.includes('[PERSONA') && !bare.includes('[ARCHIVE]') && !bare.includes('[IN THE GLOSSARY]'));
});

test('the answer is read a line at a time, "Name = 한국어", a list mark in front or not', () => {
    assert.deepEqual(tr.glossaryLines('Avalon = 아발론\n- Lighthouse Keeper = 등대지기\nnot a line\n* the veil → 베일'),
        [{ src: 'Avalon', ko: '아발론' }, { src: 'Lighthouse Keeper', ko: '등대지기' }, { src: 'the veil', ko: '베일' }]);
});

test('a name the story writes once only (a street passed, a shop in passing) is left out; one it comes back to stays', () => {
    const text = 'Mara walked down Mainzer Landstraße to the Cafe Eifler. Later Mara and Ren met Ivo at the Cafe Eifler.';
    assert.deepEqual(tr.glossaryKeep([{ src: 'Mara' }, { src: 'Mainzer Landstraße' }, { src: 'cafe eifler' }, { src: 'Ivo' }, { src: 'Varo' }], text).map(x => x.src), ['Mara', 'cafe eifler']);
    assert.match(tr.AI_SYS_GLOSSARY_FIND, /only these kinds; anything else stays out/);
});

test('a place in Korea is never put in (a Korean reader knows it); a name that only ends alike stays', () => {
    const kr = ['Gangseo-gu = 강서구', 'Seoul = 서울', 'Incheon = 인천', 'Yeouido = 여의도', 'Teheran-ro = 테헤란로', 'Yeoksamdong = 역삼동', 'Jeju-do = 제주도'];
    const not = ['Pedro = 페드로', 'Toledo = 톨레도', 'Frankfurt = 프랑크푸르트', 'Oscar Weber = 오스카 베버', 'Doug = 더그', 'Hongkong = 홍콩'];
    assert.deepEqual(tr.glossaryLines(kr.join('\n')).filter(x => !tr.krPlace(x)), []);
    assert.deepEqual(tr.glossaryLines(not.join('\n')).filter(x => tr.krPlace(x)), []);
    // (and the instruction asks for full names, and leaves out what general knowledge knows)
    assert.match(tr.AI_SYS_GLOSSARY_FIND, /full name when the cards or story give one/);
    assert.match(tr.AI_SYS_GLOSSARY_FIND, /Add nothing from general knowledge/);
});
