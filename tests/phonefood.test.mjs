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
    // a fill's base that isn't drawn falls back on the name, as an update's does
    assert.equal(dishPic({ base: 'nonsense' }, { name: '새우볶음밥' }, true).base, 'fried-rice');
    assert.equal(dishPic({ base: 'nonsense' }, { name: 'xyz' }, true).base, 'bowl');
});

test('감자튀김 · 감튀 draw fries, other 튀김 stay 튀김', async () => {
    for (const n of ['감자튀김', '감튀', 'french fries']) assert.equal(guessPic(n).base, 'fries', n);
    for (const n of ['새우튀김', '고구마튀김', '오징어튀김']) assert.equal(guessPic(n).base, 'twigim', n);
});

test('sizes and leaving out, as orders really say them', async () => {
    const { dishPic } = await import('../src/phonefood.js');
    const size = (name, option = '') => dishPic({ base: 'cola' }, { name, option }).size;
    for (const n of ['콜라 1.25L', '콜라 1.25 L', '사이다 500ml', 'Big Mac']) assert.equal(size(n), 'regular', n);
    for (const n of ['콜라 L', '치킨 (대)', 'Large fries']) assert.equal(size(n), 'large', n);
    const tops = option => dishPic({ base: 'fried rice', with: [] }, { name: '볶음밥', option }).with.join(',');
    for (const o of ['양파 넣지 마세요', '양파 안 넣어주세요', '양파 없음', '양파 없게', '양파 뺴주세요', '새우 알레르기 있어요', '새우 알러지', '새우, 양파 알레르기']) assert.equal(tops(o), '', o);
    assert.equal(tops('새우 많이, 양파 빼주세요'), 'shrimp');
    assert.equal(tops('양파 넣어주세요'), 'onion');
});

test('포테이토 · 바지락 · 해물 read from a name', async () => {
    const { dishPic } = await import('../src/phonefood.js');
    const w = (base, name, option) => dishPic({ base }, { name, option }).with.join(',');
    assert.equal(w('pizza', '포테이토 피자'), 'potato');
    assert.equal(w('kalguksu', '바지락 칼국수'), 'clam');
    assert.equal(w('jjamppong', '해물짬뽕'), 'shrimp,squid,mussel');
    assert.equal(w('jjamppong', '해물짬뽕', '오징어 빼고'), 'shrimp,mussel');
});

test('the new dishes: their own words stay off, the ingredients in their names go on', async () => {
    const { dishPic } = await import('../src/phonefood.js');
    const r = name => { const p = dishPic({ base: guessPic(name).base }, { name }); return [p.base, p.with.join(','), p.set.join(',')]; };
    const want = {
        '낙지볶음': ['stirfry-red', 'octopus', ''], '쭈꾸미볶음': ['stirfry-red', 'octopus', ''], '오징어볶음': ['stirfry-red', 'squid', ''],
        '순두부찌개': ['soup-red', 'tofu', ''], '마파두부': ['mapo-tofu', '', ''], '계란말이': ['gyeranmari', '', ''], '치킨텐더': ['chicken-tender', '', ''],
        '김치전': ['jeon', 'kimchi', ''], '해물파전': ['jeon', 'shrimp,squid,mussel', ''], '새우 텐동': ['tendon', 'shrimp', ''],
        '레몬에이드': ['iced-tea', 'lemon', ''], '바나나 스무디': ['smoothie', 'banana', ''], '오레오 쉐이크': ['smoothie', 'cookie-crumbs', ''],
        '생크림 와플': ['waffle', 'cream', ''], '아이스크림 와플': ['waffle', 'ice-cream-scoop', ''], '바닐라 아이스크림': ['ice-cream', '', ''], '생크림 케이크': ['cake', 'cream', ''],
        '까르보나라': ['pasta-cream', '', ''], '하와이안 피자': ['pizza', 'ham,pineapple', ''], '콤비네이션 피자': ['pizza', 'pepperoni,bell-pepper,olive', ''],
        '고구마피자': ['pizza', 'sweet-potato', ''], '라볶이': ['tteokbokki', 'noodles,fishcake', ''], '봉골레': ['pasta-oil', 'clam,garlic', ''], '마늘치킨': ['fried-chicken', 'garlic', ''],
        '치킨 + 치킨무': ['fried-chicken', '', 'radish-pickle'], '피자 + 피클': ['pizza', '', 'pickles'], '치즈버거 감자튀김 세트': ['burger', 'cheese', 'fries'],
        '새우튀김': ['twigim', 'shrimp', ''], '고구마튀김': ['twigim', 'sweet-potato', ''], 'Pepperoni Pizza': ['pizza', 'pepperoni', ''],
    };
    for (const [n, w] of Object.entries(want)) assert.deepEqual(r(n), w, n);
    assert.equal(dishPic({ base: 'burger', with: ['lettuce', 'cucumber'] }, { name: '치킨버거', option: '노 오이' }).with.join(','), 'chicken,lettuce');
});

test('shops\' own names and dishes in other tongues find their base', () => {
    const want = {
        '뿌링클': 'fried-chicken', '황금올리브': 'fried-chicken', '허니콤보': 'fried-chicken', '고추바사삭': 'fried-chicken', '순살 후라이드': 'fried-chicken', 'Buffalo wings': 'fried-chicken', '炸鸡': 'fried-chicken',
        '레드콤보': 'yangnyeom-chicken', '볼케이노': 'yangnyeom-chicken', '갈비천왕': 'yangnyeom-chicken', '唐揚げ': 'dakgangjeong', '순살 닭강정': 'dakgangjeong', '반반족발': 'jokbal',
        '빅맥': 'burger', '콰트로치즈와퍼': 'burger', '싸이버거': 'burger', '쉐이크쉑 버거': 'burger', 'ハンバーガー': 'burger', '맥너겟': 'nuggets', '맥플러리': 'ice-cream',
        '에그마요': 'sandwich', '이탈리안 BMT': 'sandwich', 'Philly cheesesteak': 'sandwich', '트위스터': 'burrito', '엽떡': 'tteokbokki', '배떡': 'tteokbokki-rose', '배떡 로제': 'tteokbokki-rose',
        '에스프레소': 'coffee', 'Cappuccino': 'coffee', '拿铁': 'coffee', '자바칩 프라푸치노': 'smoothie', '흑당밀크티': 'bubble-tea', '珍珠奶茶': 'bubble-tea', '인절미설빙': 'bingsu',
        '牛丼': 'donburi', 'Gyudon': 'donburi', '天丼': 'tendon', '焼き鳥': 'skewer', '餃子': 'gunmandu', '小笼包': 'dimsum', '火锅': 'hotpot', '麻婆豆腐': 'mapo-tofu', 'チャーハン': 'fried-rice',
        'ラーメン': 'ramen', 'うどん': 'udon', '寿司': 'sushi', '刺身': 'sashimi', 'カレー': 'curry', '弁当': 'dosirak', 'たこ焼き': 'takoyaki', 'ハンバーグ': 'steak', '焼肉': 'galbi',
        'Mac and cheese': 'pasta-cream', '크림빵': 'croissant', 'Brezel': 'croissant', '레드벨벳': 'cake', '대창': 'gopchang', '목살': 'samgyeopsal', '비냉': 'naengmyeon', '바닐라 쉐이크': 'smoothie',
    };
    for (const [n, b] of Object.entries(want)) assert.equal(guessPic(n).base, b, n);
    assert.deepEqual(guessPic('통새우와퍼').with, ['shrimp', 'lettuce', 'tomato']);
    // the ones the art side said to draw with what's there
    const art = { '순두부찌개': 'soup-red', '육개장': 'soup-red', '똠얌꿍': 'soup-red', '갈비탕': 'soup-white', '설렁탕': 'soup-white', '해물파전': 'jeon', '쫄면': 'bibim-noodle',
        '라볶이': 'tteokbokki', '깐풍기': 'dakgangjeong', '양꼬치': 'skewer', '마라샹궈': 'stirfry-red', '훠궈': 'hotpot', '샤브샤브': 'hotpot', '규동': 'donburi', '나시고랭': 'fried-rice',
        '프렌치토스트': 'toast', '생크림케이크': 'cake', '쌀국수 비빔': 'bun-cha' };
    for (const [n, b] of Object.entries(art)) assert.equal(guessPic(n).base, b, n);
    assert.deepEqual(guessPic('나시고랭').with, ['fried-egg']);
});

test('Vertex run 21: a swapped drink, a bottle, a dish that is a side, two eggs', async () => {
    const { dishPic } = await import('../src/phonefood.js');
    const w = dishPic({ base: 'burger set', with: ['beef', 'shrimp'], set: ['fries', 'cider'] }, { name: '통새우와퍼 세트', option: '노 양파, 콜라→사이다 변경' });
    assert.deepEqual(w.set, ['soda', 'fries']);
    assert.deepEqual(dishPic({ base: 'burger' }, { name: '치즈버거 세트', option: '콜라에서 사이다로 변경' }).set, ['soda']);
    assert.equal(dishPic({ base: 'cola bottle', size: 'large' }, { name: '코카콜라 1.25L' }).size, 'regular');
    assert.equal(dishPic({ base: 'cola', size: 'large' }, { name: '콜라 (대)' }).size, 'large');
    assert.deepEqual(dishPic({ base: 'rice ball', with: ['seaweed'] }, { name: '주먹밥' }).set, []);
    assert.deepEqual(dishPic({ base: 'tteokbokki' }, { name: '떡볶이 + 주먹밥' }).set, ['jumeokbap']);
    assert.deepEqual(dishPic({ base: 'kimchi fried rice', with: ['kimchi', 'egg'] }, { name: '김치볶음밥', option: '계란후라이 추가' }).with, ['kimchi', 'fried-egg']);
    assert.deepEqual(dishPic({ base: 'tteokbokki', with: ['rice cake', 'cream', 'cheese'] }, { name: '로제떡볶이', option: '중간맛, 당면 추가, 치즈 추가' }).with, ['noodles', 'cheese', 'cream']);
});

test('fill 2: 차돌 is the beef, 옥수수면 is noodles, a set\'s drink doesn\'t size the dish', async () => {
    const { dishPic } = await import('../src/phonefood.js');
    assert.deepEqual(dishPic({ base: 'salad', with: ['beef', 'cucumber', 'noodles'] }, { name: '우삼겹 메밀면 샐러디' }, true).with, ['beef-belly', 'noodles', 'cucumber']);
    assert.deepEqual(dishPic({ base: 'jjamppong', with: ['beef', 'squid', 'mussel'] }, { name: '차돌짬뽕' }, true).with, ['beef-belly', 'squid', 'mussel']);
    assert.deepEqual(dishPic({ base: 'malatang', with: ['beef', 'tofu-skin', 'mushroom'] }, { name: '셀프 마라탕', option: '2단계 / 소고기 100g 추가 / 옥수수면 / 푸주 / 청경채' }, true).with, ['beef', 'noodles', 'tofu-skin']);
    assert.equal(dishPic({ base: 'tteokbokki', with: ['rice-cake'], size: 'large', set: ['cola'] }, { name: '국물떡닭세트', option: '중간맛 / 순살치킨 / 콜라 500ml' }, true).size, 'large');
    assert.equal(dishPic({ base: 'cola', size: 'large' }, { name: '콜라 500ml' }, true).size, 'regular');
});

test('whole kinds of slips, not one menu at a time', async () => {
    const { dishPic } = await import('../src/phonefood.js');
    const d = (name, v, option = '', extra = {}) => dishPic(v, { name, option, ...extra });
    // a topping the base already is
    assert.deepEqual(d('후라이드 치킨', { base: 'fried chicken', with: ['chicken'] }).with, []);
    assert.deepEqual(d('김치찌개', { base: 'kimchi stew', with: ['kimchi', 'pork', 'tofu'] }).with, ['pork', 'tofu']);
    assert.deepEqual(d('치즈 떡볶이', { base: 'tteokbokki', with: ['rice cake', 'fish cake', 'cheese'] }).with, ['cheese', 'fishcake']);
    assert.deepEqual(d('계란말이', { base: 'rolled omelette', with: ['egg', 'scallion'] }).with, ['scallion']);
    // a plainer copy of another topping
    assert.deepEqual(d('Margherita', { base: 'pizza', with: ['tomato', 'mozzarella', 'cheese'] }).with, ['tomato', 'mozzarella']);
    // sizes the words say, small or middle as well as large
    for (const [n, size] of [['감자탕 (중)', 'regular'], ['포테이토 피자 M', 'regular'], ['꿔바로우 소', 'regular'], ['카페라떼 톨', 'regular'], ['탕수육 (대)', 'large'], ['아이스 아메리카노 (벤티)', 'large']])
        assert.equal(d(n, { base: 'pizza', size: 'large' }).size, size, n);
    // a swap for the same thing keeps it
    assert.deepEqual(d('치즈버거 세트', { base: 'burger', set: ['fries', 'cola'] }, '콜라 → 제로콜라').set, ['cola', 'fries']);
    // an option of only numbers and sizes hides nothing, so the name still fills in
    assert.deepEqual(d('새우볶음밥', { base: 'fried rice' }, '2 / L').with, ['shrimp']);
    // the base from the name before the model's loose words, unless the name only says 밥 or 탕
    assert.equal(d('닭강정', { base: 'fried chicken bites' }).base, 'dakgangjeong');
    assert.equal(d('참치마요 삼각김밥', { base: 'rice ball' }).base, 'gimbap');
    assert.equal(d('공기밥', { base: 'kimchi fried rice' }).base, 'fried-rice');
    // a fill's id the app doesn't draw falls back on the name
    assert.equal(dishPic({ base: 'mapo-tofu-rice' }, { name: '마파두부덮밥' }, true).base, 'mapo-tofu');
    // an English sauce in a name is the dish's, not a dip
    assert.deepEqual(d('Garlic Sauce Chicken', { base: 'fried chicken' }).set, []);
    assert.deepEqual(d('엽기떡볶이', { base: 'tteokbokki' }, '메추리알 추가').with, ['egg']);
});
