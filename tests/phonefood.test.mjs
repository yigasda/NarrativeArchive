import test from 'node:test';
import assert from 'node:assert/strict';
import { dishSvg, FOOD_IDS, guessPic, picOf } from '../src/phonefood.js';

test('a dish picture: known ids stay, unknown ones drop out', () => {
    assert.deepEqual(picOf({ base: 'juk', with: ['abalone', 'nope', 'seaweed'], size: 'large', set: ['kimchi', 'x'] }), { base: 'juk', with: ['abalone', 'seaweed'], size: 'large', set: ['kimchi'] });
    assert.equal(picOf({ base: 'nothing' }), null);
    assert.equal(picOf(null), null);
});
test('words find a base', () => {
    assert.equal(guessPic('전복죽').base, 'juk');
    assert.deepEqual(guessPic('전복죽').with, ['abalone', 'seaweed']);
    assert.equal(guessPic('Tagliatelle al ragù').base, 'pasta-tomato');
    assert.equal(guessPic('Penne alla panna').base, 'pasta-cream');
    assert.equal(guessPic('Tiramisu').base, 'cake');
    assert.equal(guessPic('짜장면').base, 'jajangmyeon');
    assert.equal(guessPic('something odd').base, 'bowl');
});
test('every base draws in all three frames', () => {
    for (const base of FOOD_IDS.base) for (const mode of ['thumb', 'hero', 'item']) {
        const svg = dishSvg({ base, with: [], size: 'regular', set: [] }, mode);
        assert.match(svg, /^<svg viewBox="[-\d. ]+"/);
        assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${base} ${mode}`);
    }
    assert.ok(dishSvg({ base: 'sushi', with: ['salmon'], size: 'large', set: [] }, 'hero', '특대').includes('특대'));
    assert.ok(dishSvg({ base: 'udon', with: [], size: 'regular', set: ['dumplings', 'danmuji'] }).includes('scale(.72)'));
});
