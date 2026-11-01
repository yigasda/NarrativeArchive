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
    assert.deepEqual([['Klaviernoten', '피아노 악보'], ['Monstera', '몬스테라 화분'], ['x', '마스크팩'], ['y', '컵라면']].map(([item, ko]) => prodKind({ item, ko })), ['book', 'plant', 'cosmetics', '']);
});
test('the picture takes a colour only when the item names one', () => {
    assert.match(prodSvg({ item: 'Wollschal, Grau' }), /#8a9099/);
    assert.match(prodSvg({ item: '黑色运动鞋' }), /#3a3d42/);
    assert.match(prodSvg({ item: 'Rucksack' }), /#9aa3ae/);
    assert.equal(prodSvg({ item: 'Zahnbürste' }), '');
});
