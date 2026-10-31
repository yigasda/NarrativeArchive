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
    assert.equal(guessPic('Tiramisu').base, 'tiramisu');
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

test('a reflection describes a dish in plain words: they become drawn ids (beef fried rice with sesame)', async () => {
    const { picFromWords } = await import('../src/phonefood.js');
    assert.deepEqual(picFromWords({ base: 'fried rice', with: ['beef', 'sesame seeds', 'unicorn'] }, '소고기 볶음밥'), { base: 'fried-rice', with: ['beef', 'sesame'], size: 'regular', set: [] });
    assert.deepEqual(picFromWords({ base: 'pizza', with: ['Prawns', 'chilli'], size: 'large', set: ['Coke', 'French fries'] }), { base: 'pizza', with: ['shrimp', 'chili'], size: 'large', set: ['cola', 'fries'] });
    assert.equal(picFromWords({ base: 'something odd' }, '전복죽').base, 'juk');
    assert.equal(picFromWords(null), null);
});

test('Vertex run 17: ingredients and sides written as one string; a drink ordered on its own', async () => {
    const { picFromWords } = await import('../src/phonefood.js');
    assert.deepEqual(picFromWords({ base: 'fried rice', with: 'beef' }, '소고기 볶음밥').with, ['beef']);
    const pz = picFromWords({ base: 'pizza', with: 'shrimp', size: 'large', set: 'fries, cola' }, '새우 피자 세트');
    assert.deepEqual([pz.with, pz.size, pz.set], [['shrimp'], 'large', ['fries', 'cola']]);
    assert.deepEqual(picFromWords({ base: 'porridge', with: 'abalone' }, '전복죽'), { base: 'juk', with: ['abalone'], size: 'regular', set: [] });
    assert.deepEqual(picFromWords({ base: 'sushi', with: 'salmon and tuna' }, '연어 초밥 세트').with, ['salmon', 'tuna']);
    assert.equal(picFromWords({ base: 'cola' }, '콜라').base, 'cola');
});
test('toppings change the picture on every base, and flavours read from words', async () => {
    for (const base of FOOD_IDS.base) {
        const a = dishSvg({ base, with: [], size: 'regular', set: [] }), b = dishSvg({ base, with: ['shrimp', 'cheese'], size: 'regular', set: [] });
        if (!['sushi', 'sashimi', 'hoedeopbap'].includes(base)) assert.notEqual(a, b, base);
    }
    assert.equal(guessPic('돈코츠 라멘').base, 'ramen-tonkotsu');
    assert.equal(guessPic('Spaghetti aglio e olio').base, 'pasta-oil');
    assert.equal(guessPic('로제 떡볶이').base, 'tteokbokki-rose');
    assert.equal(guessPic('Green curry with chicken').base, 'curry-green');
});

test('a base given as an id still takes the finer kind its name points at', async () => {
    const { picFromWords } = await import('../src/phonefood.js');
    assert.equal(picFromWords({ base: 'juk' }, '단호박죽').base, 'juk-pumpkin');
    assert.deepEqual(picFromWords({ base: 'juk' }, '전복죽'), { base: 'juk', with: ['abalone', 'seaweed'], size: 'regular', set: [] });
    assert.deepEqual(picFromWords({ base: 'porridge' }, '전복죽'), { base: 'juk', with: ['abalone', 'seaweed'], size: 'regular', set: [] });
    assert.deepEqual(picFromWords({ base: 'congee' }, 'Abalone Porridge').with, ['abalone', 'seaweed']);
    assert.deepEqual(picFromWords({ base: 'porridge', with: ['beef'] }, '전복죽').with, ['beef']);
    assert.equal(picFromWords({ base: 'porridge' }, '단호박죽').base, 'juk-pumpkin');
    assert.equal(picFromWords({ base: 'pizza' }, '불고기 피자').base, 'pizza');
});

test('소고기죽 → 죽 + 소고기', async () => {
    const { picFromWords, guessPic } = await import('../src/phonefood.js');
    const w = n => picFromWords({ base: 'porridge' }, n);
    assert.deepEqual(w('소고기죽'), { base: 'juk', with: ['beef', 'carrot', 'scallion'], size: 'regular', set: [] });
    assert.deepEqual(picFromWords({ base: 'juk', with: ['egg'] }, '소고기죽').with, ['egg']);
    // 죽이 아닌 메뉴는 그대로
    assert.equal(guessPic('양념치킨').base, 'yangnyeom-chicken');
    assert.equal(guessPic('새우볶음밥').base, 'fried-rice');
    assert.equal(guessPic('김치찌개').base, 'kimchi-stew');
});
