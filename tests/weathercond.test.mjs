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
