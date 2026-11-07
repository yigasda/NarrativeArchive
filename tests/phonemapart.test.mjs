// 다녀간 곳's drawings: a town looks the same every time, towns side by side never share a map, the city table picks
// maps that suit the town (and its neighbourhoods), the strip keeps its blocks inside the track
import test from 'node:test';
import assert from 'node:assert/strict';
import { pinSpots, stripSvg, townCandidates, townKinds, townSvg } from '../src/phonemapart.js';
import { TOWN_KINDS, TOWN_KO } from '../src/phonemaptowns.js';
import { CITY, CLUE, COMMON, HINT } from '../src/phonemapcity.js';

test('townSvg: every map draws, the same town draws the same, another town differently, a night map is dark', () => {
    assert.equal(TOWN_KINDS.length, 64);
    for (const k of TOWN_KINDS) {
        const a = townSvg(k, 390, 430, 'varo'), n = townSvg(k, 390, 430, 'varo', true);
        assert.ok(a.length > 2000 && a.length < 400000, `${k}: ${a.length}`);
        assert.equal(a, townSvg(k, 390, 430, 'varo'));
        assert.notEqual(a, n);
        assert.doesNotMatch(a, /NaN|undefined/, k);
    }
    assert.notEqual(townSvg('gridLake', 390, 430, 'varo'), townSvg('gridLake', 390, 430, 'sintra'));
});

test('the city table names real maps only', () => {
    for (const ks of [...CITY.map(r => r[1]), ...HINT.map(r => r[2]), ...CLUE.map(r => r[1]), COMMON]) for (const k of ks) assert.ok(TOWN_KO[k], k);
});

test('townCandidates: the town\'s own row, its neighbourhoods first, a neighbourhood written as the city', () => {
    assert.equal(townCandidates('Seoul')[0], 'bigRiver');
    assert.deepEqual(townCandidates('서울특별시').slice(0, 3), townCandidates('Seoul').slice(0, 3));
    assert.equal(townCandidates('서울', ['연남동 카페', '망원 시장', '홍대입구역'])[0], 'alleys');
    assert.equal(townCandidates('Seoul', ['코엑스', '삼성역'])[0], 'downtown');
    assert.equal(townCandidates('Hongdae', ['카페'])[0], 'alleys');
    assert.equal(townCandidates('Cairo', ['Khan el-Khalili'])[0], 'egypt');
    assert.equal(townCandidates('Brighton', ['beach hut'])[0], 'beachTown');
    // Korean, Japanese, Chinese, English and local names find the same town
    for (const n of ['東京', '东京', 'Tokyo', '도쿄']) assert.deepEqual(townCandidates(n).slice(0, 3), townCandidates('도쿄').slice(0, 3), n);
    for (const n of ['München', 'Munich', 'ミュンヘン', '慕尼黑']) assert.deepEqual(townCandidates(n).slice(0, 3), townCandidates('뮌헨').slice(0, 3), n);
    for (const n of ['Москва', '莫斯科', 'Moscow']) assert.deepEqual(townCandidates(n).slice(0, 3), townCandidates('모스크바').slice(0, 3), n);
    for (const n of ['القاهرة', 'カイロ', '开罗']) assert.equal(townCandidates(n)[0], 'egypt', n);
    assert.deepEqual(townCandidates('東京都').slice(0, 3), townCandidates('東京').slice(0, 3));
    assert.notDeepEqual(townCandidates('東京都').slice(0, 3), townCandidates('京都').slice(0, 3));
    // a short name only whole, a Korean name only from the start
    assert.notEqual(townCandidates('Laval')[0], townCandidates('LA')[0]);
    assert.notEqual(townCandidates('베니스')[0], townCandidates('니스')[0]);
    // a town nobody listed still gets everyday maps
    assert.ok(townCandidates('Hogwarts').length >= COMMON.length);
});

test('townKinds: towns never share a map, and an older town keeps its map', () => {
    const towns = ['Seoul', 'Busan', 'Seoul2', 'Varo', 'Paris'].map(c => ({ key: c.toLowerCase(), city: c, places: [] }));
    const a = townKinds(towns);
    assert.equal(new Set(a.values()).size, towns.length);
    assert.deepEqual([...a], [...townKinds(towns)]);
    assert.equal(townKinds([...towns, { key: 'tokyo', city: 'Tokyo', places: [] }]).get('seoul'), a.get('seoul'));
    // more towns than maps: still a map each
    const many = Array.from({ length: 70 }, (_, k) => ({ key: `t${k}`, city: `Town ${k}`, places: [] }));
    assert.equal(townKinds(many).size, 70);
});

test('pinSpots: stay on the map', () => {
    for (const [x, y] of pinSpots(['A', 'B', 'C'], 390, 150, 340)) { assert.ok(x >= 36 && x <= 390 - 134); assert.ok(y >= 150 && y <= 340); }
});

test('stripSvg: a one-day block is still wide enough to see, nothing runs past the track', () => {
    const { svg } = stripSvg({ days: 31, today: 25, blocks: [[31, 31, '#000']] });
    const [, x, w] = svg.match(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="15"/);
    assert.ok(Number(w) >= 326 / 31 * 1.6 - 0.2 || Number(x) + Number(w) <= 326.01);
    assert.ok(Number(x) + Number(w) <= 326.01);
});
