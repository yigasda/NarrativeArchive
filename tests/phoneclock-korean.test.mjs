import test from 'node:test';
import assert from 'node:assert/strict';
import { datedClocks, koreanClocks, narrativeClockText, htmlClocks, htmlTimeContext, withDateOrder } from '../src/phoneparse.js';
import { cleanMessage } from './cleanmessage.mjs';

const bare = (raw, positions = false) => {
    const offsets = [], text = cleanMessage(narrativeClockText(raw), { stripTags: true }, offsets);
    return koreanClocks(text, { positions }).map(x => positions ? { ...x, position: offsets[x.position] } : x);
};
const hint = (sourceTime, clock) => ({ sourceTime, clock, narrative: true });

test('Korean plain clocks keep exact source text and normalize minute clocks only', () => {
    for (const [sourceTime, clock] of [
        ['16시 15분', '16:15'], ['오후 4시 15분', '16:15'], ['오전 12시 5분', '00:05'],
        ['오후 12시 05분', '12:05'], ['밤 11시 59분', '23:59'], ['새벽 1시 0분', '01:00'],
        ['16시15분', '16:15'], ['오후4시15분', '16:15'], ['4시 15분 PM', '16:15'], ['23 시 59 분', '23:59'],
    ]) {
        assert.deepEqual(bare(sourceTime), [hint(sourceTime, clock)], sourceTime);
        assert.deepEqual(bare(`그때 ${sourceTime}.`), [hint(sourceTime, clock)]);
        assert.deepEqual(bare(`<span>${sourceTime}</span>`), [hint(sourceTime, clock)]);
    }
    for (const tail of ['에 도착했다.', '부터 기다렸다.', '까지였다.', '쯤이었다.', '경이었다.', '이었다.', '이다.']) {
        assert.deepEqual(bare(`16시 15분${tail}`), [hint('16시 15분', '16:15')], tail);
    }
    for (const raw of ['16:15', 'ratio 16:15', 'video 16:15', '16시', '4pm']) assert.deepEqual(bare(raw), [], raw);
});

test('Korean source clocks reject durations, partial values, seconds and invalid meridiems', () => {
    for (const raw of [
        '3시간 15분', '3 시간 15 분', '15분 30초', '16시 15분간', '16시 15분동안',
        '16시 15분 30초', '16시 15분30초', '-16시 15분', '+16시 15분', '116시 15분',
        '16시 155분', '24시 15분', '16시 60분', '오후 16시 15분', '오전 0시 15분',
        'PM 4시 15분 AM', '16시\n15분', '16시 15분홍색', '16시 15분에러', '16시 15분경고', 'x16시 15분',
    ]) assert.deepEqual(bare(raw), [], raw);
});

test('dated Korean clocks preserve their dates and cannot become later bare duplicates', async () => {
    for (const [sourceTime, local] of [
        ['2026년 11월 5일 16시 15분', '11-05 16:15'], ['11월 5일 오후 4시 15분', '11-05 16:15'],
        ['2026-11-05 16시 15분', '11-05 16:15'], ['November 5, 2026 16시 15분', '11-05 16:15'],
    ]) {
        assert.deepEqual(datedClocks(sourceTime), [{ sourceTime, local }]);
        assert.deepEqual(bare(sourceTime), []);
        assert.deepEqual(datedClocks(`${sourceTime}에 도착했다.`), [{ sourceTime, local }]);
        assert.deepEqual(bare(`${sourceTime}에 도착했다.`), []);
    }
    await withDateOrder('dm', () => assert.deepEqual(datedClocks('11.05 16시 15분'), [{ sourceTime: '11.05 16시 15분', local: '05-11 16:15' }]));
    for (const raw of ['13월 5일 16시 15분', '11월 35일 16시 15분', '11월 5일 오후 16시 15분', '111월 5일 16시 15분', '11월 555일 16시 15분', 'November 555 16시 15분']) {
        assert.deepEqual(datedClocks(raw), [], raw);
        assert.deepEqual(bare(raw), [], raw);
    }
});

test('Korean HTML clocks and labels use the same strict syntax without plain duplicates', () => {
    for (const [sourceTime, clock] of [['16시 15분', '16:15'], ['오후 4시 15분', '16:15'], ['19시 30분', '19:30']]) {
        const raw = `<span class="time">${sourceTime}</span>`;
        assert.deepEqual(htmlClocks(raw), [{ sourceTime, clock }]);
        assert.deepEqual(bare(raw), []);
        assert.equal(htmlTimeContext(raw), `[메시지의 HTML]\ntime: ${sourceTime}`);
    }
    for (const raw of [
        '<span class="time">2026년 11월 5일 16시 15분</span>',
        '<span>2026년 11월 5일 </span><span class="time">16시 15분</span>',
        '<time>2026년 11월 5일 <span class="time">16시 15분</span></time>',
    ]) {
        assert.deepEqual(htmlClocks(raw), []);
        assert.deepEqual(bare(raw), []);
        assert.deepEqual(datedClocks(cleanMessage(raw, { stripTags: true })), [{ sourceTime: '2026년 11월 5일 16시 15분', local: '11-05 16:15' }]);
    }
    for (const text of ['3시간 15분', '16시 15분간', '16시 15분 30초', '오후 16시 15분']) {
        assert.deepEqual(htmlClocks(`<span class="time">${text}</span>`), [], text);
    }
});

test('plain Korean clocks cannot leak through hidden, quoted, duration or sample markup', () => {
    const clock = '16시 15분';
    for (const tag of ['script', 'style', 'template', 'think', 'analysis', 'textarea', 'title', 'blockquote', 'q', 'pre', 'code']) {
        assert.deepEqual(bare(`<${tag}>${clock}</${tag}>`), [], tag);
    }
    for (const attrs of ['hidden', 'aria-hidden="true"', 'style="display:none"', 'style="visibility:hidden"', 'class="elapsed-time"', 'class="timer"', 'datetime="PT16H15M"']) {
        assert.deepEqual(bare(`<span ${attrs}>${clock}</span>`), [], attrs);
    }
    for (const raw of [
        `> ${clock}`, `\`\`\`html\n${clock}\n\`\`\``, `~~~\n${clock}\n~~~`, `\`${clock}\``,
        `<!-- ${clock} -->`, `<![CDATA[${clock}]]>`, `<span title="a > ${clock}">nothing</span>`,
        `<span title="${clock}">nothing</span>`, `<span>${clock}`, `<span>${clock}</div>`,
    ]) assert.deepEqual(bare(raw), [], raw);
    assert.deepEqual(bare(`<span hidden>${clock}</span> 그 뒤 17시 25분`), [hint('17시 25분', '17:25')]);
});

test('Korean original source positions survive markup, emoji and duplicate clocks', () => {
    const raw = '🙂 <span hidden>22시 22분</span> <b>16시 15분</b> 뒤에 16시 15분';
    assert.deepEqual(bare(raw, true), [
        { ...hint('16시 15분', '16:15'), position: raw.indexOf('16시 15분') },
        { ...hint('16시 15분', '16:15'), position: raw.lastIndexOf('16시 15분') },
    ]);
});

test('adding Korean expressions preserves legacy colon evidence, including permissive edge cases', () => {
    for (const [source, sourceTime, local] of [
        ['11.05 AM 8:30 PM', '11.05 AM 8:30 PM', '11-05 20:30'],
        ['11.05 PM 8:30 PM', '11.05 PM 8:30 PM', '11-05 20:30'],
        ['11.05 8:30 30초', '11.05 8:30', '11-05 08:30'],
        ['11.05 8:30 PM 30초', '11.05 8:30 PM', '11-05 20:30'],
    ]) assert.deepEqual(datedClocks(source), [{ sourceTime, local }], source);
    for (const style of ['display:none', 'visibility:hidden']) {
        // Historical colon behavior stays as it was; new Korean recognition does not broaden it.
        assert.deepEqual(htmlClocks(`<time style="${style}">08:30</time>`), [{ sourceTime: '08:30', clock: '08:30' }]);
        assert.deepEqual(htmlClocks(`<time style="${style}">16시 15분</time>`), []);
    }
});
