// the status line reader: the weather field reaches the phone (a <tracker>, any other tracker shape, a bracketed status line)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const T = (globalThis.__trackerTest = { chat: [], settings: {} });
const map = {
    './util.js': encoded('export const esc=s=>String(s);'), './sections.js': encoded('export const RANGE_HEAD=/#(\\d+)–#(\\d+)/;export const headingRanges=()=>[];export const parseSections=()=>[];export const splitTail=s=>[s,""];export const trimEnd=s=>s;'),
    './lore.js': encoded('export const loreBlock=async()=>"";'),
    './ai.js': encoded('export const SECTION_GUARD="";export const aiLabel=()=>"";export const askAI=async()=>"";export const askCompress=async()=>"";export const drLabel=()=>"";'),
    './core.js': encoded('export const ctx=()=>({chat:globalThis.__trackerTest.chat});export const getMeta=()=>({});export const globalSettings=()=>globalThis.__trackerTest.settings;export const saveMeta=async()=>{};'),
    './extract.js': encoded('export const formatExtract=()=>"";'),
    './prompts.js': encoded('export const activePrompt=()=>({});export const auBlock=()=>"";export const auOf=()=>null;export const fillPrompt=()=>"";export const langBlock=()=>"";export const memoBlock=()=>"";export const rulesInSystem=()=>"";'),
};
const src = await readFile(new URL('../src/scenes.js', import.meta.url), 'utf8');
const { recentTrackers, DEFAULT_TRACKER_RE } = await import(encoded(src.replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || k}'`)));
const say = mes => ({ is_user: false, is_system: false, name: 'Mara', mes });

test('a <tracker> line: its fourth field is the weather, emoji and temperature kept', () => {
    T.chat = [say('<tracker> 🌇 05:48 오후 | 1월 30일 (토) | 옴보스 → 서쪽 별채 | ☀️ 맑음 / 3°C </tracker>\n본문')];
    const [t] = recentTrackers(1);
    assert.equal(t.place, '옴보스 → 서쪽 별채');
    assert.equal(t.weather, '☀ 맑음 / 3°C');
    assert.equal(t.min, 17 * 60 + 48);
});
test('a tracker with no weather field, and one whose weather is an emoji alone', () => {
    T.chat = [say('<tracker> 08:10 | 1월 31일 | 집 </tracker>')];
    assert.equal(recentTrackers(1)[0].weather, '');
    T.chat = [say('<tracker> 08:10 | 1월 31일 | 집 | 🌧 </tracker>')];
    assert.equal(recentTrackers(1)[0].weather, '🌧');
});
test('a saved regex without a weather group still finds the field that names the sky', () => {
    T.settings = { trackerRe: String.raw`<tracker>\s*(?<time>\d{1,2}:\d{2})\s*\|\s*(?<date>[^|]+?)\s*\|\s*(?<place>[^|<]+?)\s*\|` };
    T.chat = [say('<tracker> 21:00 | 2월 2일 | 서울, 집 | 눈 그치고 흐림, -2°C | 기분: 차분 </tracker>')];
    const [t] = recentTrackers(1);
    assert.equal(t.place, '서울, 집');
    assert.equal(t.weather, '눈 그치고 흐림, -2°C');
    T.settings = {};
});
test('a bracketed status line and label lines: every weather part is kept together', () => {
    T.chat = [say('[ 🌙 오후 8:15 · 12월 9일 (목) · 성 → 병동 · ❄️ -1°C · 눈 ]\n본문')];
    let [t] = recentTrackers(1);
    assert.equal(t.place, '성 → 병동');
    assert.equal(t.weather, '❄ -1°C, 눈');
    T.chat = [say('📅 날짜: 3월 2일\n📍 장소: 베를린 호텔\n🌤 날씨: 구름 조금, 8℃\n\n본문')];
    [t] = recentTrackers(1);
    assert.equal(t.place, '베를린 호텔');
    assert.equal(t.weather, '🌤 날씨: 구름 조금, 8℃'.replace('🌤 날씨: ', ''));
});
test('the default regex still cuts at the old three fields', () => {
    assert.match('<tracker> 05:48 | 1월 30일 | 집 </tracker>', new RegExp(DEFAULT_TRACKER_RE, 's'));
});
