import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanMessage } from './cleanmessage.mjs';
import { datedClocks, htmlClocks } from '../src/phoneparse.js';

test('optional cleaner provenance keeps text unchanged and maps dates back through removed markup', () => {
    const samples = [
        ['  <span>11</span>.05&nbsp;<b>08:30</b>  ', '11.05 08:30', '11'],
        ['<think>ignored 10.04 23:59</think>\n<div>11.05 08:30</div>', '11.05 08:30', '11.05'],
        ['discarded 10.04 23:59</thinking>\n11.05 08:30', '11.05 08:30', '11.05'],
        ['<style>.x {color:red}</style><!-- 09.04 22:59 --><p>11.05 08:30</p>', '11.05 08:30', '11.05'],
        ['🙂 &amp; <em>11.05 08:30</em><br>after', '🙂 & 11.05 08:30\nafter', '11.05'],
        ['11.05 08:30\n  \n\n\n <p>after</p>', '11.05 08:30\n\nafter', '11.05'],
        ['data:image/png;base64,AA==<span>11.05 08:30</span>', '11.05 08:30', '11.05'],
    ];
    for (const [raw, expected, start] of samples) {
        const offsets = [999], text = cleanMessage(raw, { stripTags: true }, offsets);
        assert.equal(text, expected);
        assert.equal(text, cleanMessage(raw, { stripTags: true }));
        assert.equal(offsets.length, text.length);
        const [clock] = datedClocks(text, { positions: true });
        assert.equal(offsets[clock.position], raw.indexOf(start));
        assert.ok(offsets.every((n, i) => Number.isInteger(n) && (i === 0 || n >= offsets[i - 1])));
        const unstripped = [];
        assert.equal(cleanMessage(raw, { stripTags: false }, unstripped), raw);
        assert.deepEqual(unstripped, Array.from({ length: raw.length }, (_, i) => i));
    }
});

test('position-enabled HTML extraction preserves coordinates across omitted markdown', () => {
    const raw = '> <time>23:59</time>\n\n```html\n<time>22:59</time>\n```\n`<time>21:59</time>`\n<time>08:30</time>';
    assert.deepEqual(htmlClocks(raw, { positions: true }), [{ sourceTime: '08:30', clock: '08:30', position: raw.lastIndexOf('<time>') }]);
});

test('duplicate dated sources retain distinct positions without changing the default parser shape', () => {
    const raw = '11.05 08:30; 11.05 09:00; 11.05 08:30';
    const withPositions = datedClocks(raw, { positions: true });
    assert.deepEqual(withPositions.map(x => x.position), [0, 13, 26]);
    assert.deepEqual(withPositions.map(({ position, ...x }) => x), datedClocks(raw));
});
