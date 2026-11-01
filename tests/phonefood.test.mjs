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
    assert.deepEqual(picFromWords({ base: 'porridge', with: 'abalone' }, '전복죽'), { base: 'juk', with: ['abalone', 'seaweed'], size: 'regular', set: [] });
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
    // the name's own words first, then the model's, then what the dish usually has
    assert.deepEqual(picFromWords({ base: 'porridge', with: ['beef'] }, '전복죽').with, ['abalone', 'beef', 'seaweed']);
    assert.equal(picFromWords({ base: 'porridge' }, '단호박죽').base, 'juk-pumpkin');
    assert.equal(picFromWords({ base: 'pizza' }, '불고기 피자').base, 'pizza');
});

test('소고기죽 → 죽 + 소고기', async () => {
    const { picFromWords, guessPic } = await import('../src/phonefood.js');
    const w = n => picFromWords({ base: 'porridge' }, n);
    assert.deepEqual(w('소고기죽'), { base: 'juk', with: ['beef', 'carrot', 'scallion'], size: 'regular', set: [] });
    assert.deepEqual(picFromWords({ base: 'juk', with: ['egg'] }, '소고기죽').with, ['beef', 'egg', 'carrot']);
    // 죽이 아닌 메뉴는 그대로
    assert.equal(guessPic('양념치킨').base, 'yangnyeom-chicken');
    assert.equal(guessPic('새우볶음밥').base, 'fried-rice');
    assert.equal(guessPic('김치찌개').base, 'kimchi-stew');
});

test('a dish picture: the name and option fill in what the model left out', async () => {
    const { dishPic } = await import('../src/phonefood.js');
    const p = (v, x, ids) => { const r = dishPic(v, x, ids); return [r.base, r.with.join(','), r.set.join(','), r.size]; };
    // the name's words come first and aren't cut off by the model's
    assert.deepEqual(p({ base: 'fried rice', with: ['cheese'] }, { name: '새우치즈볶음밥' }), ['fried-rice', 'shrimp,cheese', '', 'regular']);
    assert.deepEqual(p({ base: 'fried rice', with: ['cheese', 'egg', 'scallion'] }, { name: '새우볶음밥' })[1], 'shrimp,cheese,egg');
    assert.deepEqual(p({ base: 'pizza', with: ['tomato', 'mozzarella'] }, { name: 'Margherita', ko: '마르게리타' })[1], 'tomato,mozzarella');
    // what an option leaves out stays out, even when the model or the name has it
    assert.equal(p({ base: 'pizza', with: ['cheese'] }, { name: '치즈피자', option: '치즈 빼고' })[1], '');
    assert.equal(p({ base: 'burger', with: ['onion', 'cheese'] }, { name: '불고기버거', option: '양파, 마늘 빼고' })[1], 'beef,cheese');
    assert.equal(p({ base: 'fried rice', with: ['cheese'] }, { name: '치즈볶음밥', option: '치즈 빼고 새우 추가' })[1], 'shrimp');
    assert.equal(p({ base: 'fried rice', with: ['shrimp'] }, { name: '볶음밥', option: '새우 대신 닭고기' })[1], 'chicken');
    for (const option of ['노 양파', '노양파', '양파X', '양파 x']) assert.equal(p({ base: 'burger', with: ['onion'] }, { name: '치즈버거', option })[1], 'cheese', option);
    assert.equal(p({ base: 'gukbap', with: ['scallion', 'pork'] }, { name: '돼지국밥', option: '파 빼고' })[1], 'pork');
    assert.equal(p({ base: 'fried rice', with: ['cheese'] }, { name: '치즈볶음밥', option: '치즈 x2' })[1], 'cheese');
    // an option in another tongue: read through its translation, or else left to the model
    assert.equal(p({ base: 'pizza', with: ['tomato', 'cheese'] }, { name: 'Käsepizza', ko: '치즈피자', option: 'ohne Käse', optionKo: '치즈 빼고' })[1], 'tomato');
    assert.equal(p({ base: 'pizza', with: ['tomato'] }, { name: 'チーズピザ', ko: '치즈피자', option: 'チーズ抜き' })[1], 'tomato');
    assert.equal(p({ base: 'pizza', with: [] }, { name: 'チーズピザ', ko: '치즈피자', option: 'チーズ抜き' })[1], '');
    assert.equal(p({ base: 'fried rice', with: [] }, { name: '새우볶음밥', option: '맵기 보통' })[1], 'shrimp');
    assert.equal(p({ base: 'fried rice', with: ['shrimp'] }, { name: '海老チャーハン' })[1], 'shrimp');
    // the words that name the base aren't toppings on it
    assert.deepEqual(p({ base: 'cheese ball' }, { name: '치즈볼' }).slice(0, 2), ['cheese-ball', '']);
    assert.equal(p({ base: 'cheese ball' }, { name: '새우 치즈볼' })[1], 'shrimp');
    assert.deepEqual(p({ base: 'juk' }, { name: '김치죽' }).slice(0, 2), ['juk-kimchi', '']);
    assert.equal(p({ base: 'yangnyeom chicken' }, { name: '양념치킨' })[1], '');
    assert.equal(p({ base: 'fried chicken' }, { name: '눈꽃치즈 치킨' })[1], 'snow-cheese');
    assert.equal(p({ base: 'fried rice' }, { name: '김치볶음밥' })[1], 'kimchi');
    // one-letter words and words inside other words don't count in a name
    for (const name of ['김가네 볶음밥', '햄버거', 'Veggie Burger', '닭죽']) assert.equal(p({ base: 'fried rice' }, { name })[1], '', name);
    // sides: the name's, less what the option leaves out, never the base itself
    assert.equal(p({ base: 'burger' }, { name: '치즈버거 감자튀김 세트' })[2], 'fries');
    assert.equal(p({ base: 'burger', set: ['fries', 'cola'] }, { name: '치즈버거 세트', option: '콜라 빼고' })[2], 'fries');
    assert.equal(p({ base: 'cola', set: ['cola'] }, { name: '콜라' })[2], '');
    // size
    assert.equal(p({ base: 'jajangmyeon' }, { name: '짜장면 곱빼기' })[3], 'large');
    assert.equal(p({ base: 'fried chicken' }, { name: '후라이드 치킨', option: '(대)' })[3], 'large');
    assert.equal(p({ base: 'donburi' }, { name: '대패삼겹 덮밥' })[3], 'regular');
    // a fill's ids take the same rules
    assert.deepEqual(p({ base: 'fried-rice', with: ['cheese'] }, { name: '새우치즈볶음밥' }, true)[1], 'shrimp,cheese');
    assert.equal(dishPic({ base: 'nonsense' }, { name: '새우볶음밥' }, true), null);
});

test('감자튀김 · 감튀 draw fries, other 튀김 stay 튀김', async () => {
    for (const n of ['감자튀김', '감튀', 'french fries']) assert.equal(guessPic(n).base, 'fries', n);
    for (const n of ['새우튀김', '고구마튀김', '오징어튀김']) assert.equal(guessPic(n).base, 'twigim', n);
});
