// 다녀간 곳's drawings: a town looks the same every time, towns side by side never share a street pattern, the strip
// keeps its blocks inside the track
import test from 'node:test';
import assert from 'node:assert/strict';
import { pinSpots, stripSvg, townKinds, townSvg } from '../src/phonemapart.js';

test('townSvg: the same town draws the same, another town draws differently', () => {
    assert.equal(townSvg('grid', 390, 430, 'varo'), townSvg('grid', 390, 430, 'varo'));
    assert.notEqual(townSvg('grid', 390, 430, 'varo'), townSvg('grid', 390, 430, 'sintra'));
    for (const k of ['old', 'grid', 'ring', 'coast']) assert.match(townSvg(k, 390, 430, 'x', true), /#1f2630/);
});

test('townKinds: up to four towns never share a pattern, and the answer does not move', () => {
    const towns = ['paris', 'chicago', 'varo', 'sintra'], a = townKinds(towns), b = townKinds(towns);
    assert.equal(new Set(a.values()).size, 4);
    assert.deepEqual([...a], [...b]);
});

test('pinSpots: stay on the map and keep a coast\'s pins off the sea', () => {
    const ps = pinSpots(['A', 'B', 'C'], 'coast', 390, 150, 340);
    for (const [x, y] of ps) { assert.ok(x >= 36 && x <= 390 - 134); assert.ok(y >= 150 && y <= 150 + 190 * 0.75 + 0.01); }
});

test('stripSvg: a one-day block is still wide enough to see, nothing runs past the track', () => {
    const { svg } = stripSvg({ days: 31, today: 25, blocks: [[31, 31, '#000']] });
    const [, x, w] = svg.match(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="15"/);
    assert.ok(Number(w) >= 326 / 31 * 1.6 - 0.2 || Number(x) + Number(w) <= 326.01);
    assert.ok(Number(x) + Number(w) <= 326.01);
});
