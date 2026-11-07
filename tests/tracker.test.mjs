// the status line reader: the weather field reaches the phone (a <tracker>, any other tracker shape, a bracketed status line)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const T = (globalThis.__trackerTest = { chat: [], settings: {} });
const map = {
    './util.js': encoded('export const esc=s=>String(s);'), './sections.js': encoded('export const RANGE_HEAD=/#(\\d+)–#(\\d+)/;export const headingRanges=()=>[];export const parseSections=()=>[];export const splitTail=s=>[s,""];export const trimEnd=s=>s;'),
    './lore.js': encoded('export const loreBlock=async()=>"";'),
    './phoneparse.js': new URL('../src/phoneparse.js', import.meta.url).href,
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
test('a fourth field that is not the weather (a mood) is passed over for the field that names the sky', () => {
    T.chat = [say('<tracker> 21:00 | 2월 2일 | 서울, 집 | 기분: 차분 | ☁ 흐림, -2°C </tracker>')];
    const [t] = recentTrackers(1);
    assert.equal(t.weather, '☁ 흐림, -2°C');
    T.chat = [say('<tracker> 21:00 | 2월 2일 | 서울, 집 | 기분: 차분 </tracker>')];
    assert.equal(recentTrackers(1)[0].weather, '');
});

test('phone status ignores hidden messages while preserving source indices and archive reads', () => {
    T.settings={};
    T.chat=[say('🕗 08:00 AM | November 5, Thursday, 2026 | Frankfurt → Kitchen | ☀️ Clear, 9°C'),
        {...say('🕗 08:28 AM | November 5, Thursday, 2026 | Frankfurt → Kitchen | 🌧️ Light Rain, 7°C'),is_system:true}];
    assert.equal(recentTrackers(1)[0].i,1);
    const [visible]=recentTrackers(1,{visibleOnly:true});
    assert.equal(visible.i,0);assert.equal(visible.time,'08:00 AM');assert.match(visible.weather,/Clear/);
    T.chat[0].is_system=true;assert.deepEqual(recentTrackers(1,{visibleOnly:true}),[]);
    T.chat[1].is_system=false;assert.equal(recentTrackers(1,{visibleOnly:true})[0].i,1);
});

test('phone status uses edited body immediately and forgets deleted messages', () => {
    T.settings={};
    T.chat=[say('<tracker> 11:00 | November 5, 2026 | Seoul → Home | Clear, 9°C </tracker>'),
        say('<tracker> 16:28 | November 5, 2026 | Seoul → Home | Rain, 7°C </tracker>')];
    assert.equal(recentTrackers(1,{visibleOnly:true})[0].time,'16:28');
    T.chat[1].mes='<tracker> 12:10 | November 5, 2026 | Seoul → Home | Snow, -2°C </tracker>';
    const [edited]=recentTrackers(1,{visibleOnly:true});assert.equal(edited.time,'12:10');assert.match(edited.weather,/Snow/);
    T.chat.pop();assert.equal(recentTrackers(1,{visibleOnly:true})[0].time,'11:00');
    T.chat.length=0;assert.deepEqual(recentTrackers(1,{visibleOnly:true}),[]);
});

test('tracker clocks honor prefix and suffix AM/PM including midnight and noon', () => {
    T.settings = {};
    for (const [clock, min] of [
        ['오전 12:30', 30], ['12:30 오전', 30], ['AM 12:30', 30], ['12:30 am', 30],
        ['오후 12:30', 750], ['12:30 오후', 750], ['pm 12:30', 750], ['12:30 PM', 750],
        ['오전 1:15', 75], ['AM 1:15', 75], ['오후 1:15', 795], ['1:15 pM', 795],
        ['12:30AM', 30], ['PM12:30', 750], ['1:15PM', 795], ['00:30', 30], ['23:59', 1439], ['저녁 8:15', 1215],
    ]) {
        for (const body of [
            `<tracker> ${clock} | 3월 2일 | 집 | 맑음 </tracker>`,
            `시간: ${clock}\n장소: 집\n날씨: 맑음`,
            `[ ${clock} · 3월 2일 · 집 · 맑음 ]`,
        ]) {
            const [t] = recentTrackers(1, { chat: [say(body)] });
            assert.equal(t.min, min, body);
            assert.equal(t.place, '집');
            assert.equal(t.weather, '맑음');
        }
    }
});

test('invalid clocks and nonnumeric time labels remain safe without invented minutes', () => {
    T.settings = {};
    for (const clock of ['24:00', '25:10', '12:60', '13:30 PM', '오전 0:30', '123:45', '12:345', '-1:30', '저녁', '미정']) {
        for (const body of [
            `<tracker> ${clock} | 3월 2일 | 집 | 흐림 </tracker>`,
            `시간: ${clock}\n장소: 집\n날씨: 흐림`,
        ]) {
            const [t] = recentTrackers(1, { chat: [say(body)] });
            assert.equal(t.min, null, body);
            assert.equal(t.place, '집');
            assert.equal(t.weather, '흐림');
        }
    }
    const [t] = recentTrackers(1, { chat: [say('시간: 저녁\n장소: 집')] });
    assert.equal(t.time, '저녁');
    assert.equal(t.min, null);
});

test('custom tracker regex keeps its named fields while reading prefix midnight', () => {
    const re = String.raw`Clock=(?<time>[^;]+);Date=(?<date>[^;]+);Place=(?<place>[^;]+);Weather=(?<weather>.+)`;
    const [t] = recentTrackers(1, { re, chat: [say('Clock=AM 12:30;Date=3월 2일;Place=집;Weather=맑음')] });
    assert.equal(t.min, 30);
    assert.equal(t.date, '3월 2일');
    assert.equal(t.place, '집');
    assert.equal(t.weather, '맑음');
});
test('a status line reads a Korean clock, never a time before or after one or a length of time', () => {
    for (const [line, min] of [['[ 오후 4시 15분 · 12월 9일 · 집 ]', 16 * 60 + 15], ['[ 16시 15분 · 12월 9일 · 집 ]', 16 * 60 + 15], ['[ 4시 반 · 12월 9일 · 집 ]', 4 * 60 + 30]]) {
        T.chat = [say(`${line}\n\n본문`)];
        assert.equal(recentTrackers(1)[0]?.min, min, line);
    }
    for (const line of ['[ 3시 15분 전 · 12월 9일 · 집 ]', '[ 16시 15분 전에 · 12월 9일 · 집 ]', '[ 10시 반 뒤 · 12월 9일 · 집 ]', '[ 약속 2시 30분 후 · 12월 9일 · 집 ]',
        '[ 16시 15분 동안 · 12월 9일 · 집 ]', '[ 1시 15분 만에 · 12월 9일 · 집 ]', '[ 오후 3시 15분 전 · 12월 9일 · 집 ]']) {
        T.chat = [say(`${line}\n\n본문`)];
        assert.equal(recentTrackers(1)[0]?.min ?? null, null, line);
    }
});
