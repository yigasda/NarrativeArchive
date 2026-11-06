// 한국어 시각: one reader for the app's answers, status lines, time choices and HTML time fields
import test from 'node:test';
import assert from 'node:assert/strict';
import { clockQuiet, datedClocks, hhmm, htmlClocks, koClockText } from '../src/phoneparse.js';

test('a Korean clock in its many shapes, with what a sentence puts after it', () => {
    for (const [s, want] of [
        ['16시 15분', '16:15'], ['16시15분', '16:15'], ['오후 4시 15분', '16:15'], ['오후에 4시 15분', '16:15'], ['4시 15분 PM', '16:15'], ['4시 15분 PM에', '16:15'],
        ['4시 반', '04:30'], ['오후 4시 반', '16:30'], ['밤 11시', '23:00'], ['밤 1시', '01:00'], ['낮 2시', '14:00'], ['새벽 12시', '00:00'], ['오전 12시 5분', '00:05'], ['오후 12시', '12:00'],
        ['아침 7시 30분', '07:30'], ['저녁 6시', '18:00'], ['16시', '16:00'], ['16시 15분 30초', '16:15'], ['16시 15분', '16:15'],
        ['16시 15분을 가리켰다', '16:15'], ['16시 15분으로 바뀌었다', '16:15'], ['16시 15분이야', '16:15'], ['16시 15분이었다', '16:15'], ['16시 15분쯤', '16:15'], ['16시 15분경', '16:15'], ['16시에', '16:00'],
        ['16시 15분 전화가 왔다', '16:15'],
    ]) assert.equal(koClockText(s), want, s);
});

test('never a length of time, a time before or after, or an hour no twelve-hour clock has', () => {
    for (const s of ['2시간 15분', '15분 뒤', '30분 후에', '3시 15분 전', '16시 15분 전에', '16시 15분 후로', '16시 15분 뒤에', '16시 15분 동안', '3시간', '오후 16시', '오전 13시 5분', '25시', '16시 75분', '1.5시']) assert.equal(koClockText(s), '', s);
});

test('the app\'s answers: a colon clock reads as before, a Korean one now whole', () => {
    for (const [s, want] of [['7:00 PM', '19:00'], ['오후 7:00', '19:00'], ['7pm', '19:00'], ['19시', '19:00'], ['19시 30분', '19:30'], ['오후 4시 15분', '16:15'], ['4시 반', '04:30']]) assert.equal(hhmm(s), want, s);
});

test('time choices: a date with a Korean clock (with its year, a weekday, a comma, 에); a day no calendar has, or a length of time, none', () => {
    for (const [s, want] of [
        ['2026년 11월 5일 16시 15분', '11-05 16:15'], ['11월 5일 오후 4시 15분', '11-05 16:15'], ['11월 5일(목) 16시 15분', '11-05 16:15'], ['11월 5일,16시 15분', '11-05 16:15'],
        ['11월 5일에 16시 15분', '11-05 16:15'], ['11월 5일(목) 16:15', '11-05 16:15'], ['Nov 5 16시 15분', '11-05 16:15'], ['11.05 오후 4시', '11-05 16:00'],
    ]) assert.deepEqual(datedClocks(s).map(x => x.local), [want], s);
    for (const s of ['13월 5일(목) 16시 15분', '2026년 2월 30일 16시 15분', '2026년 2월 29일 16시 15분', '11월 5일 2시간 15분', '11월 5일 16시 15분 전에']) assert.deepEqual(datedClocks(s), [], s);
    // (the colon readings are as they were)
    assert.deepEqual(datedClocks('11.05 16:15 and 2026-11-05 9:00 PM').map(x => x.local), ['11-05 16:15', '11-05 21:00']);
    // (two on one line: both, in order)
    assert.deepEqual(datedClocks('11월 5일 9시, 그리고 11월 5일 16시 15분', { positions: true }).map(x => x.local), ['11-05 09:00', '11-05 16:15']);
});

test('HTML time fields: a Korean clock counts only by what is shown (a hidden part is left out); a timer never', () => {
    const at = html => htmlClocks(html).map(x => x.clock);
    assert.deepEqual(at('<span class="time">16시 15분</span>'), ['16:15']);
    assert.deepEqual(at('<span class="time">16시&nbsp;15분</span>'), ['16:15']);
    assert.deepEqual(at('<div class="time"><span style="display:none">16시 15분</span></div>'), []);
    assert.deepEqual(at('<div class="time"><span style="display:none">오후</span> 4시 15분</div>'), ['04:15']);
    assert.deepEqual(at('<span class="time"><span hidden>오후 </span>4시 15분</span>'), ['04:15']);
    assert.deepEqual(at('<span class="timer">16시 15분</span>'), []);
    // (a colon clock in the same places reads as before)
    assert.deepEqual(at('<span class="time">16:15</span>'), ['16:15']);
});

test('the text\'s own dated readings: never in a timer, a hidden part or an HTML quote; a no-break space, a class with "time" in it, split spans, a fenced block of HTML as before', () => {
    const strip = t => t.replace(/<\/?([a-z][\w-]*)\b[^>]*>/gi, (all, n) => /^(?:span|b|i|em|strong|a|small|font)$/i.test(n) ? '' : '\n');
    const at = raw => { const q = clockQuiet(raw); assert.equal(q.length, raw.length); return datedClocks(strip(q).replace(/&nbsp;/g, ' ')).map(x => x.local); };
    for (const raw of ['<span class="timer">11월 5일 16시 15분</span>', '<span class="countdown">11.05 16:15</span>', '<span style="display:none">11월 5일 16시 15분</span> 보이는 글',
        '<span hidden>11.05 16:15</span>', '<span aria-hidden="true">11.05 16:15</span>', '<blockquote>11.05 16:15</blockquote>', '<q>11월 5일 16시 15분</q>', '11월 5일<blockquote>x</blockquote>16시 15분']) assert.deepEqual(at(raw), [], raw);
    for (const [raw, want] of [['<div class="timeline">11월 5일 16시 15분, 그는 문을 열었다.</div>', '11-05 16:15'], ['<div class="sometimes">11월 5일 16시 15분, 그는 문을 열었다.</div>', '11-05 16:15'],
        ['<span>11월 5일 </span><span>16시 15분</span>', '11-05 16:15'], ['<span class="time">11월&nbsp;5일&nbsp;16시&nbsp;15분</span>', '11-05 16:15'], ['11월\u00a05일\u00a016시\u00a015분', '11-05 16:15'],
        ['11.05\u00a016:15', '11-05 16:15'], ['11월 5일 <span hidden>x</span>16시 15분', '11-05 16:15'], ['<time datetime="2026-11-05T16:15">11월 5일 16시 15분</time>', '11-05 16:15'],
        ['```html\n<span class="time">11.05 09:00</span>\n```', '11-05 09:00'], ['> 11.05 16:15 인용', '11-05 16:15'], ['😀 <span hidden>a</span> 11.05 16:15', '11-05 16:15']]) assert.deepEqual(at(raw), [want], raw);
    // (the archive's text, plain: the same)
    assert.deepEqual(datedClocks('11월 5일 16시 15분').map(x => x.local), ['11-05 16:15']);
});
