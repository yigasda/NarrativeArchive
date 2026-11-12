// 타일 지도(phonetilemap.js): 어느 곳을 가운데로 할지, 특수 색, 장소 고르기(지도 룰: 4개 · 120px · 볼거리 먼저), 명소 아이콘
import test from 'node:test';
import assert from 'node:assert/strict';
import { spotIn, palette, choosePlaces, kindOf } from '../src/phonetilemap.js';
import { SPOTS } from '../src/phonemapspots.js';

const at = (c, w = []) => spotIn(SPOTS, c, w)?.[0] || null;
test('a visit finds its spot: the neighbourhood a place names, else the town (or the town that is a spot itself)', () => {
    assert.equal(at('서울', ['홍대입구역 카페']), 'seoul-hongdae');
    assert.equal(at('Tokyo', ['Shibuya Crossing']), 'tokyo-shibuya');
    assert.equal(at('New York', ['Times Square']), 'ny-midtown');
    assert.equal(at('Frankfurt', ['Café am Fluss']), 'frankfurt-altstadt');
    assert.equal(at('Reine'), 'reine');
    assert.equal(at('Varo', ['Werkstatt Ivo']), null);   // a made-up town: the drawn map stays
});
test('special colours: sand in deserts, snow up north (deep sea past 66°), emerald on coral seas', () => {
    const gc = spotIn(SPOTS, 'Grand Canyon Village'), rn = spotIn(SPOTS, 'Reine');
    assert.equal(palette(gc[2], gc[3]).land, '#f4e8d2');
    assert.equal(palette(rn[2], rn[3]).land, '#f6f8fa'); assert.equal(palette(rn[2], rn[3]).water, '#8ec7dd');
    assert.equal(palette('바다', 21.3).water, '#7fd9cf'); assert.equal(palette('도심', 50).water, '#a7e4ee');
});
test('places: at most 4, sights first, one to eat, more than 120px apart', () => {
    const c = (t, x, y, r = 1) => ({ t, r, xy: { x, y } });
    const out = choosePlaces([c(1, 10, 10), c(1, 300, 300), c(0, 50, 50), c(0, 60, 60), c(2, 200, 10), c(0, 400, 400), c(0, 10, 400), c(3, 400, 10)], 4);
    assert.equal(out.length, 4); assert.equal(out.filter(x => x.t === 1).length, 1);
    for (const a of out) for (const b of out) if (a !== b) assert.ok(Math.hypot(a.xy.x - b.xy.x, a.xy.y - b.xy.y) >= 120);
});
test('an attraction by its name, a viewpoint is the telescope', () => {
    assert.equal(kindOf({ class: 'attraction', subclass: 'attraction', name: 'Brandenburger Tor' }), 'gate');
    assert.equal(kindOf({ class: 'attraction', subclass: 'attraction', name: 'Charging Bull' }), 'landmark');
    assert.equal(kindOf({ class: 'attraction', subclass: 'viewpoint', name: 'Aussicht' }), 'view');
    assert.equal(kindOf({ class: 'cafe', subclass: 'cafe', name: 'X' }), 'cafe');
});
