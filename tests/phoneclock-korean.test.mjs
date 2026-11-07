// 한국어 시각: one reader for the app's answers, status lines, time choices and HTML time fields
import test from 'node:test';
import assert from 'node:assert/strict';
import { datedClocks, hhmm, htmlClocks, htmlDatedClocks, koClockText } from '../src/phoneparse.js';

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

test('dated readings (an HTML time field\'s): a date with a Korean clock (with its year, a weekday, a comma, 에); a day no calendar has, or a length of time, none', () => {
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

test('a dated choice only as the screen shows it, an HTML time field: never the story\'s text, a timer, a hidden part, a quote or a fenced block', () => {
    const at = raw => htmlDatedClocks(raw).map(x => x.local);
    for (const [raw, want] of [['<span class="time">11.05 16:15</span>', '11-05 16:15'], ['<span class="time">11월 5일 16시 15분</span>', '11-05 16:15'], ['<div class="chat-timestamp">11월 5일(목) 오후 4시 15분</div>', '11-05 16:15'],
        ['<span class="time">11월&nbsp;5일&nbsp;16시&nbsp;15분</span>', '11-05 16:15'], ['<span class="time">11.05,\u00a016:15</span>', '11-05 16:15'], ['<time datetime="2026-11-05T16:15">11월 5일 16시 15분</time>', '11-05 16:15'],
        ['<span>11월 5일 </span><span class="time">16:15</span>', '11-05 16:15'], ['<span class="time">11월 5일 <span hidden>x</span>16시 15분</span>', '11-05 16:15']]) assert.deepEqual(at(raw), [want], raw);
    for (const raw of ['11월 5일 16시 15분', 'Mara 11.05 16:15', '<div class="timeline">11월 5일 16시 15분, 그는 문을 열었다.</div>', '<span>11월 5일 16시 15분</span>',
        '<span class="timer">11월 5일 16시 15분</span>', '<span class="time" style="display:none">11.05 16:15</span>', '<span class="time" hidden>11.05 16:15</span>', '<blockquote><span class="time">11.05 16:15</span></blockquote>',
        '```html\n<span class="time">11.05 16:15</span>\n```', '<span class="time">13월 5일 16시 15분</span>', '<span class="time">11월 5일 16시 15분 전</span>']) assert.deepEqual(at(raw), [], raw);
    // (a clock alone stays htmlClocks', as before)
    assert.deepEqual(htmlDatedClocks('<span class="time">16:15</span>'), []);
    assert.deepEqual(htmlClocks('<span class="time">11.05 16:15</span>'), []);
});

test('a PM after the clock with whatever follows it; a Korean meridiem never as the start of a word', () => {
    for (const [s, want] of [['4시 PM이야', '16:00'], ['4시 PM쯤', '16:00'], ['4시 pm쯤', '16:00'], ['4시에 pm', '16:00'], ['4시 p.m.', '16:00'], ['4시 오후에', '16:00'], ['4시 낮잠', '04:00'], ['7시 저녁밥', '07:00']]) {
        assert.equal(hhmm(s), want, s);
        assert.equal(koClockText(s), want, s);
    }
});

test('HTML: a hidden date never dates a clock; a quote, code or timer keeps Korean apart; a <time datetime> shows its stamp; one stamp once', () => {
    const at = raw => [htmlDatedClocks(raw).map(x => x.local), htmlClocks(raw).map(x => x.clock)];
    assert.deepEqual(at('<span style="display:none">11월 5일 </span><span class="time">16시 15분</span>'), [[], ['16:15']]);
    assert.deepEqual(at('<span style="display:none">11.05, </span><span class="time">08:30</span>'), [[], ['08:30']]);
    assert.deepEqual(at('<div style="display:none"><span>11월 5일 </span><span class="time">16:15</span></div>'), [[], []]);
    assert.deepEqual(at('<span>11.05, </span><span class="time">08:30</span>'), [['11-05 08:30'], []]);
    for (const raw of ['<span class="time">16시 <q>2시간</q> 15분</span>', '<span class="time">오후<blockquote>인용</blockquote> 4시</span>', '<span class="time">16시<code>x</code> 15분</span>', '<span class="time">11월 5일<code>코드</code> 16:15</span>']) assert.deepEqual(at(raw), [[], []], raw);
    assert.deepEqual(at('<span class="time"><span hidden>오후 </span>4시 15분</span>'), [[], ['04:15']]);
    for (const raw of ['<time datetime="2026-11-05"><b>11월 5일</b> <i>16:15</i></time>', '<time datetime="2026-11-05">11월 5일 16:15</time>']) assert.deepEqual(at(raw), [['11-05 16:15'], []], raw);
    assert.deepEqual(at('<time datetime="2026-11-05"><span class="time">11월 5일 16시</span></time>'), [['11-05 16:00'], []]);
    for (const raw of ['<div class="time"><span class="time">11월 5일 16시 15분</span></div>', '<div class="timeinfo"><span class="date">11월 5일</span> <span class="time">16:15</span></div>']) assert.deepEqual(at(raw), [['11-05 16:15'], []], raw);
    // (two equal fields side by side stay two)
    assert.equal(htmlDatedClocks('<span class="time">11.05 08:30</span> <time>09:00</time> <span class="time">11.05 08:30</span>').length, 2);
});

test('a long message with many dates is read in a moment', () => {
    const t0 = performance.now();
    datedClocks('11월 5일 '.repeat(28571));
    htmlClocks(`<span class="time">${'11월 5일 '.repeat(28571)}</span>`);
    htmlDatedClocks(`<div><div><ul>${Array.from({ length: 2000 }, (_, i) => `<li><span class="date">${i % 12 + 1}월 ${i % 28 + 1}일</span> 메모</li>`).join('\n')}</ul></div></div>`);
    assert.ok(performance.now() - t0 < 3000, `${Math.round(performance.now() - t0)} ms`);
});

test('never a time before or after one in any wording, nor a direction; a clock with a word after it still is one', () => {
    for (const s of ['3시 이후', '5시 이전', '그건 3시 전이었다', '3시 전이다', '3시쯤 전', '3시 반쯤 전', '3시 넘어서', '3시 직전', '3시 직후', '3시 방향', '3시 방향으로', '3시 경 이후', '3시 이후에', '3시 이후로', '3시 전엔', '3시 후에도', '3시 전부터'])
        assert.equal(koClockText(s), '', s);
    for (const [s, want] of [['16시 15분 전화가 왔다', '16:15'], ['3시 무렵', '03:00'], ['3시쯤', '03:00'], ['3시경', '03:00'], ['3시까지 와', '03:00'], ['3시에 갔다', '03:00']]) assert.equal(koClockText(s), want, s);
    assert.deepEqual(datedClocks('11월 5일 3시 방향'), []);
});

test('the app\'s answers: a Korean clock the reader turns down is no time (never its first numbers); a colon clock and "7pm" as before', () => {
    for (const s of ['3시 이후', '3시 이전', '3시 15분 전', '2시간 15분', '12시간', '오후 16시', '3시 방향']) assert.equal(hhmm(s), '', s);
    for (const [s, want] of [['7:00 PM', '19:00'], ['7pm', '19:00'], ['19시', '19:00'], ['오후 3시', '15:00'], ['3시쯤', '03:00'], ['15:00 이후', '15:00']]) assert.equal(hhmm(s), want, s);
});
