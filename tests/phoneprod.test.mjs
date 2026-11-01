import test from 'node:test';
import assert from 'node:assert/strict';
import { prodKind, prodSvg } from '../src/phoneprod.js';

test('a product is read from its words in German, English, Korean, Japanese and Chinese', () => {
    const k = item => prodKind({ item });
    assert.deepEqual(['Wollschal, Grau', 'Akkuschrauber', 'Parfüm', 'Laufschuhe', 'Ersatzschlüssel'].map(k), ['scarf', 'tool', 'perfume', 'shoes', 'key']);
    assert.deepEqual(['マフラー', 'スニーカー', '合鍵', '围巾', '运动鞋', '钥匙', '울 목도리'].map(k), ['scarf', 'shoes', 'key', 'scarf', 'shoes', 'key', 'scarf']);
    // words inside other words don't count: a monkey is no key, a steamed bun no bag
    assert.equal(k('Monkey toy'), 'toy');
    assert.equal(k('包子'), '');
    // the Korean line helps when the name is in a language the list doesn't know
    assert.equal(prodKind({ item: 'Écharpe-xyz', ko: '스카프' }), 'scarf');
    // most orders come from the update round, named in the owner's language with a Korean line: that line carries it
    assert.deepEqual([['Klaviernoten', '피아노 악보'], ['Monstera', '몬스테라 화분'], ['x', '마스크팩'], ['y', '컵라면'], ['Lederhandschuhe', ''], ['Over-Ear Kopfhörer', ''], ['Kaffeebohnen', '원두']].map(([item, ko]) => prodKind({ item, ko })), ['book', 'plant', 'cosmetics', 'snack', 'gloves', 'headphones', 'snack']);
});
test('the picture takes a colour only when the item names one', () => {
    assert.match(prodSvg({ item: 'Wollschal, Grau' }), /#8a9099/);
    assert.match(prodSvg({ item: '黑色运动鞋' }), /#3a3d42/);
    assert.match(prodSvg({ item: 'Rucksack' }), /#9aa3ae/);
    assert.equal(prodSvg({ item: 'Zahnbürste' }), '');
    // colour words inside other words don't colour: Bluetooth isn't blue, Brot isn't red
    assert.match(prodSvg({ item: 'Bluetooth Lautsprecher' }), /#9aa3ae/);
});
test('Korean names, the update round\'s usual line, find their picture (and the near misses stay apart)', () => {
    const k = ko => prodKind({ item: ko, ko });
    const want = { '아이폰 15 케이스': 'phonecase', '갤럭시 S24': 'smartphone', '갤럭시 탭 S9': 'laptop', '노트북 가방': 'backpack', '롱패딩': 'jacket', '어그 부츠': 'boots', '카드지갑': 'wallet',
        '피아노 악보': 'book', '책상': 'chair', '책가방': 'backpack', '수분크림': 'cosmetics', '아이스크림': 'snack', '쿠션': 'pillow', '쿠션팩트': 'cosmetics', '에어프라이어': 'pan', '막걸리': 'bottle',
        '통기타': 'guitar', '닌텐도 스위치': 'gamepad', '극세사 이불': 'pillow', '요가 매트': 'mat', '유산균': 'pills', '강아지 사료': 'snack', '포스트잇': 'pen', '상품권': 'giftbox' };
    for (const [ko, kind] of Object.entries(want)) assert.equal(k(ko), kind, ko);
    assert.equal(k('자동차 방향제'), '');
});
