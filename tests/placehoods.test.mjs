// 동네 표: its own rows and the map's HINT words (phonemapcity.js), read together
import test from 'node:test';
import assert from 'node:assert/strict';
import { hoodCities } from '../src/placehoods.js';
import { HINT } from '../src/phonemapcity.js';

const names = p => hoodCities(p).map(c => c.names[0]);

test('지도 표의 동네도 찾아요 (내 표에 없던 것)', () => {
    assert.deepEqual(names('경리단길'), ['서울']);
    assert.deepEqual(names('자갈치 시장'), ['부산']);
    assert.deepEqual(names('동탄역'), ['화성']);
    assert.deepEqual(names('우도'), ['서귀포']);
    assert.equal(hoodCities('동탄').every(c => c.tz === 'Asia/Seoul'), true);
});
test('지도와 내 표가 이름을 다르게 써도 한 도시 (호찌민 = 호치민, 방갈로르 = 벵갈루루)', () => {
    assert.deepEqual(names('District 1'), ['호치민']);
    assert.deepEqual(names('Bui Vien'), ['호치민']);
    assert.deepEqual(names('Koramangala'), ['벵갈루루']);
});
test('두 도시가 같이 적힌 지도 줄은 둘 다 후보 (고르는 건 폰이 아는 도시로)', () => {
    assert.deepEqual(names('Königsallee').sort(), ['뒤셀도르프', '쾰른'].sort());
});
test('어디에나 있는 말은 동네가 아니에요', () => {
    for (const w of ['공항', '교외', 'Central', '두오모', '시청', 'Loop']) assert.deepEqual(hoodCities(w), [], w);
    assert.deepEqual(hoodCities('Shibuya Coffee'), []);
});
test('지도 표의 동네는 (어디에나 있는 말 말고) 다 찾아요', () => {
    const lost = HINT.flatMap(([, ws]) => ws).filter(w => !hoodCities(w).length);
    assert.ok(lost.length < 45, `${lost.length}: ${lost.join(',')}`);
});
