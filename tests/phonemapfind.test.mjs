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
    const ber = findTowns('베르').towns.map(ko), starts = ber.map(n => n.startsWith('베르'));
    assert.equal(ber[0], '베르겐'); assert.ok(ber.includes('베르히테스가덴'));
    assert.ok(starts.indexOf(false) === -1 || starts.lastIndexOf(true) < starts.indexOf(false), ber.join(','));
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

test('findCountries: a country by its Korean, English, Japanese, Chinese or own name, then its towns and neighbourhoods', async () => {
    const { findCountries, countryTowns, countryHoods } = await import('../src/phonemapfind.js');
    for (const q of ['일본', 'Japan', '日本', 'japan']) assert.deepEqual(findCountries(q)[0], { cc: 'jp', exact: true }, q);
    for (const [q, cc] of [['Deutschland', 'de'], ['ドイツ', 'de'], ['美国', 'us'], ['England', 'gb'], ['Россия', 'ru'], ['مصر', 'eg'], ['노르웨이', 'no']]) assert.equal(findCountries(q)[0]?.cc, cc, q);
    assert.equal(findCountries('일')[0]?.exact, false);
    assert.equal(findCountries('Hogwarts').length, 0);
    // every country a town is in can be found, and shows towns
    const { PLACE } = await import('../src/phonemapcity.js');
    for (const cc of new Set(PLACE.map(x => x[3]))) { assert.ok(findCountries(FLAG_NAME[cc]).some(c => c.cc === cc && c.exact), cc); assert.ok(countryTowns(cc).length, cc); }
    assert.ok(countryHoods('jp').length >= 10);
    assert.equal(new Set(countryTowns('jp').map(i => PLACE[i][2])).size, countryTowns('jp').length);
});
