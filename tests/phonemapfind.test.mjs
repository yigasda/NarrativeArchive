// 다녀간 곳 › 도시 찾기: any name finds the town, neighbourhoods and kinds of map are found too, a town knows its country,
// names, maps and neighbourhoods, every country has a flag
import test from 'node:test';
import assert from 'node:assert/strict';
import { findTowns, kindTowns, placeNames, placeView } from '../src/phonemapfind.js';
import { PLACE } from '../src/phonemapcity.js';
import { FLAG_NAME, flagSvg } from '../src/phoneflags.js';
import { TOWN_KO } from '../src/phonemaptowns.js';

const ko = i => placeNames(i).ko, first = q => ko(findTowns(q).towns[0]);

test('a town by its Korean, English, Japanese, Chinese or local name', () => {
    for (const q of ['도쿄', 'Tokyo', '東京', '东京']) assert.equal(first(q), '도쿄', q);
    for (const q of ['뮌헨', 'Munich', 'München', 'ミュンヘン']) assert.equal(first(q), '뮌헨', q);
    for (const q of ['카이로', 'cairo', 'القاهرة']) assert.equal(first(q), '카이로', q);
    assert.equal(first('Москва'), '모스크바');
    // the start of a name first, then a word's start, then inside it
    assert.deepEqual(findTowns('베르').towns.slice(0, 2).map(ko), ['베르겐', '베르히테스가덴']);
    assert.deepEqual(findTowns(''), { towns: [], hoods: [], kinds: [] });
});

test('neighbourhoods and kinds of map are found, and a neighbourhood leads its own maps', () => {
    assert.ok(findTowns('홍대').hoods.length);
    assert.ok(findTowns('kreuz').hoods.length);
    assert.deepEqual(findTowns('눈').kinds, ['noSnow']);
    const seoul = findTowns('서울').towns[0], v = placeView(seoul);
    assert.equal(v.cc, 'kr'); assert.equal(v.country, '한국');
    assert.ok(v.hoods.length >= 10);
    const h = placeView(seoul, findTowns('홍대').hoods[0]);
    assert.equal(h.hood.label, '홍대 · 연남'); assert.equal(h.maps[0], 'alleys');
    assert.ok(kindTowns('egypt').map(ko).includes('카이로'));
    for (const k of Object.keys(TOWN_KO)) assert.ok(Array.isArray(kindTowns(k)));
});

test('every town has a country with a flag, and the names show capitalised', () => {
    for (const [n, , , cc] of PLACE) { assert.ok(FLAG_NAME[cc], `${n}: ${cc}`); assert.match(flagSvg(cc), /^<svg/); }
    assert.equal(placeNames(findTowns('뉘른').towns[0]).lat, 'Nürnberg');
});
