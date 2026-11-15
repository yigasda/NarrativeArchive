// 섹션 제목의 장소 (people.js headingPlaces): what the archive's heading names as places, never a span of hours or two
// places at once (the archive calendar shows them; no model)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const calSrc = await readFile(new URL('../src/calendar.js', import.meta.url), 'utf8');
const TIME = calSrc.match(/export const TIME_WORDS = \[[\s\S]*?\n\];/)[0];
const map = {
    './ai.js': encoded('export const aiLabel=()=>"";export const askAI=async()=>"";export const withSpinner=async(a,b,f)=>f();'),
    './ask.js': encoded('export const gotoSection=()=>{};'),
    './calendar.js': encoded(`${TIME}\nexport const headingDate=()=>({});`),
    './core.js': encoded('export const ctx=()=>({});export const getMeta=()=>({});export const globalSettings=()=>({});export const saveGlobal=async()=>{};export const saveMeta=async()=>{};export const textHash=s=>s;'),
    './knowledge.js': encoded('export const castNames=()=>[];'),
    './picker.js': encoded('export const PICK_CHUNK_TOK=1;export const estTok=s=>s.length;'),
    './peek.js': encoded('export const sectionPeek=()=>"";'),
    './phone.js': encoded('export const openPhone=()=>{};'),
    './sections.js': encoded('export const RANGE_HEAD=/x/;export const parseSections=()=>[];export const sectionKey=()=>"";export const splitTail=s=>[s,""];export const tailBlocks=()=>[];'),
    './util.js': encoded('export const confirm=async()=>true;export const esc=s=>s;export const escRe=s=>s;'),
};
// (people.js listens for broken face pictures on the page: nothing to listen to here)
globalThis.document ||= { addEventListener() {} };
const src = await readFile(new URL('../src/people.js', import.meta.url), 'utf8');
const { headingPlaces } = await import(encoded(src.replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || pathToFileURL(new URL(`../src/${k}`, import.meta.url).pathname).href}'`)));
const at = t => headingPlaces(`## #101–#156 — Calls (${t})`, {});

test('섹션 제목의 장소: a span of hours, however long, is no place', () => {
    assert.deepEqual(at('night to next afternoon, Seoul and Frankfurt'), []);
    assert.deepEqual(at('early morning until late evening, Westend apartment'), ['Westend apartment']);
    assert.deepEqual(at('morning → midday, Sinclair Group headquarters'), ['Sinclair Group headquarters']);
    assert.deepEqual(at('afternoon'), []);
});

test('섹션 제목의 장소: two places at once ("A and B", "A & B") is no place; one place, or a move, stays', () => {
    assert.deepEqual(at('Seoul & Frankfurt'), []);
    assert.deepEqual(at('Lyon, Hôtel des Terreaux'), ['Lyon', 'Hôtel des Terreaux']);
    assert.deepEqual(at('the office → home'), ['office', 'home']);
    assert.deepEqual(at('Café Mandarin, Westend'), ['Café Mandarin', 'Westend']);
});

test('섹션 제목의 장소: 이름에 and · &가 든 가게나 건물은 장소예요. 두 도시를 이은 것만 뺍니다', () => {
    assert.deepEqual(at('Barnes & Noble'), ['Barnes & Noble']);
    assert.deepEqual(at('Bread and Butter Café'), ['Bread and Butter Café']);
    assert.deepEqual(at('Marks & Spencer, Westend'), ['Marks & Spencer', 'Westend']);
    assert.deepEqual(at('Rose & Crown pub → home'), ['Rose & Crown pub', 'home']);
    assert.deepEqual(at('Seoul and Frankfurt'), []);
    assert.deepEqual(at('서울 & 도쿄'), []);
    assert.deepEqual(at('Seoul, Berlin and Tokyo'), ['Seoul']);
});
