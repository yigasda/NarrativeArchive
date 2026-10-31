import test from 'node:test';
import assert from 'node:assert/strict';
import { condOf, CONDS } from '../src/phonesynclife.js';

test('status-line words map to the new skies too', () => {
    assert.equal(condOf('구름 조금, 14°'), 'partly');
    assert.equal(condOf('Nieselregen'), 'drizzle');
    assert.equal(condOf('이슬비 내림'), 'drizzle');
    assert.equal(condOf('진눈깨비'), 'sleet');
    assert.equal(condOf('Schneeregen'), 'sleet');
    assert.equal(condOf('강풍 주의'), 'wind');
    assert.equal(condOf('heavy rain'), 'rain');
    assert.equal(condOf('흐림'), 'cloudy');
    assert.equal(condOf('맑음'), 'clear');
    for (const c of ['partly', 'drizzle', 'sleet', 'wind']) assert.ok(CONDS.includes(c));
});

test('Korean 비 and 눈 only as words of their own: no rain from an airplane, no snow from dazzling sun', () => {
    for (const [t, c] of [['비', 'rain'], ['비, 11°', 'rain'], ['비 옴', 'rain'], ['비가 내림', 'rain'], ['폭우', 'rain'], ['장대비', 'rain'], ['소나기', 'rain'],
        ['눈', 'snow'], ['눈 내림', 'snow'], ['눈이 펑펑', 'snow'], ['함박눈', 'snow'], ['폭설', 'snow'], ['이슬비', 'drizzle'], ['진눈깨비', 'sleet'],
        ['눈부시게 맑음', 'clear'], ['비행기 타기 좋은 맑은 날', 'clear'], ['비밀스럽게 흐림', 'cloudy'], ['눈부신 햇살', 'clear']]) assert.equal(condOf(t), c, t);
});
