import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlTimeFields, htmlTimeContext, htmlClocks } from '../src/phoneparse.js';

const example = `<div class="chat-timestamp" style="font-size:12px;color:var(--time-ink);">11.03, 11:03</div>
Mara reads the message and opens the ticket.
\`\`\`html
<!DOCTYPE html>
<html lang="en"><head><style>.status-bar { color: red; }</style></head>
<body><div class="status-bar"><span>03:03 CET</span><span>75%</span></div>
<div class="ticket"><span class="reservation-time">11.04, 18:30</span></div></body></html>
\`\`\`
The story continues.`;

test('outer chat time and a full fenced HTML screen keep original field names and exact values', () => {
    assert.deepEqual(htmlTimeFields(example), [
        { scope: 'outside', fields: [{ sourceTime: '11.03, 11:03', label: 'chat-timestamp' }] },
        { scope: 'fenced', block: 1, fields: [{ sourceTime: '03:03 CET', label: 'status-bar' }, { sourceTime: '11.04, 18:30', label: 'reservation-time' }] },
    ]);
    assert.equal(htmlTimeContext(example), '[첨부파일 (메시지 내부의 HTML)]\nstatus-bar: 03:03 CET\nreservation-time: 11.04, 18:30');
    assert.doesNotMatch(htmlTimeContext(example), /Timestamp|style|color|DOCTYPE|<|>/);
    // A separate descriptive path must not turn fenced screen fields into current-clock references.
    assert.deepEqual(htmlClocks(example), []);
});

test('labels retain original class/id/tag with no guesses about clock ownership or meaning', () => {
    for (const [source, label] of [
        ['<span id="reservation-time">18:30</span>', '#reservation-time'],
        ['<TiMe>18:30</TiMe>', 'TiMe'],
        ['<div class="screen"><span class="reservation-time">18:30</span></div>', 'reservation-time'],
        ['<div class="StatusBar"><span>18:30</span><span>50%</span></div>', 'StatusBar'],
        ['<span class="time selected" id="clock">18:30</span>', 'time selected #clock'],
        ['<span style="color:red" title="time">18:30</span>', 'span'],
        ['<span class="timer">18:30</span>', 'timer'],
    ]) assert.deepEqual(htmlTimeFields(source), [{ scope: 'html', fields: [{ sourceTime: '18:30', label }] }], source);
    assert.equal(htmlTimeContext('18:30 without HTML'), '');
    assert.equal(htmlTimeContext('<div class="message">Normal prose</div>'), '');
});

test('without a structural fence no outer or inner screen boundary is invented', () => {
    const raw = '<div class="chat-timestamp">11.03,11:03</div><div class="status-bar"><span>03:03 CET</span><span>50%</span></div>';
    assert.deepEqual(htmlTimeFields(raw), [{ scope: 'html', fields: [
        { sourceTime: '11.03,11:03', label: 'chat-timestamp' }, { sourceTime: '03:03 CET', label: 'status-bar' },
    ] }]);
    assert.equal(htmlTimeContext(raw), '');
    assert.equal(htmlTimeContext('<html><body><time>08:30</time></body></html>'), '');
});

test('multiple nested sources preserve separate equal time occurrences and matched fence lengths', () => {
    const raw = '<time>08:30</time>\n````html\n<div class="status-bar"><span>08:30</span></div>\n```\n````\n~~~html\n<span id="reservation-time">08:30</span>\n~~~~';
    const groups = htmlTimeFields(raw);
    assert.equal(groups.length, 3);
    assert.deepEqual(groups.map(x => x.scope), ['outside', 'fenced', 'fenced']);
    assert.deepEqual(groups.map(x => x.fields[0].label), ['time', 'status-bar', '#reservation-time']);
    assert.equal(groups[2].block, 2);
    assert.deepEqual(htmlTimeFields('```html\n<time>08:30</time>'), []);
    assert.deepEqual(htmlTimeFields('```js\nconst s = "<time>08:30</time>";\n```'), []);
});

test('hidden, inert, quoted, malformed, and inline-code regions supply no context fields', () => {
    for (const tag of ['script', 'style', 'think', 'thinking', 'reasoning', 'analysis', 'template', 'pre', 'code', 'blockquote']) {
        assert.deepEqual(htmlTimeFields(`<${tag}>\n\`\`\`html\n<time>08:30</time>\n\`\`\`\n</${tag}>`), [], tag);
    }
    for (const raw of [
        '<!--\n```html\n<time>08:30</time>\n```\n-->',
        '<div hidden>\n```html\n<time>08:30</time>\n```\n</div>',
        '<span title="<time>08:30</time>">Nothing</span>',
        '<time>08:30', '<div><time>08:30</time>',
        '> ```html\n> <time>08:30</time>\n> ```',
        '`<time>08:30</time>`', '&lt;time&gt;08:30&lt;/time&gt;',
    ]) assert.deepEqual(htmlTimeFields(raw), [], raw);
    assert.deepEqual(htmlTimeFields(null), []);
});

test('time fields preserve dates, zones and markers but do not join unrelated siblings', () => {
    for (const value of ['11.03,11:03', '11.03, 11:03', '03:03 CET', '8:30 PM', '오후 8:30', '2026-11-03T03:03 UTC+1', '0:30 AM', '08:30:00']) {
        assert.equal(htmlTimeFields(`<time>${value}</time>`)[0]?.fields[0].sourceTime, value);
    }
    const fields = htmlTimeFields('<div class="ticket"><time>08:30</time><time>09:30</time></div>')[0].fields;
    assert.deepEqual(fields.map(x => x.sourceTime), ['08:30', '09:30']);
    for (const value of ['25:70', '13:30 PM', '08:30 / 09:30', 'Meet at 08:30', '08<br>:30']) {
        assert.deepEqual(htmlTimeFields(`<time>${value}</time>`), [], value);
    }
});


test('inline or non-HTML code examples cannot hide following actual HTML fields', () => {
    for (const prefix of ['`<div hidden>`', '```js\nconst s = "<div hidden>";\n```', '`<script>`']) {
        assert.deepEqual(htmlTimeFields(`${prefix}\n<div class="chat-timestamp">11.03, 11:03</div>`), [
            { scope: 'html', fields: [{ sourceTime: '11.03, 11:03', label: 'chat-timestamp' }] },
        ]);
    }
    assert.equal(htmlTimeFields('<div class="chat-timestamp">11.03,\n11:03</div>')[0].fields[0].sourceTime, '11.03,\n11:03');
});


test('fenced closing tags cannot escape hidden outside ancestry', () => {
    assert.deepEqual(htmlTimeFields('<div hidden>\n```html\n</div><span class="secret">03:03 CET</span>\n```\n</div>'), []);
    for (const style of ['display:none', 'display: none !important;', 'visibility: hidden', 'visibility:collapse']) {
        assert.deepEqual(htmlTimeFields(`<span class="secret" style="${style}">12:34</span>`), []);
    }
});
