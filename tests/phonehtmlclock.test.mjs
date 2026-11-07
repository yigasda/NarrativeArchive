import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlClocks as readClocks } from '../src/phoneparse.js';
// Every existing parsing case must behave identically with optional source positions enabled.
const htmlClocks = raw => {
    const normal = readClocks(raw), positioned = readClocks(raw, { positions: true });
    assert.deepEqual(positioned.map(({ position, ...clock }) => clock), normal);
    for (const clock of positioned) {
        assert.ok(Number.isInteger(clock.position) && clock.position >= 0);
        assert.equal(String(raw)[clock.position], '<');
    }
    return normal;
};

const hint = (sourceTime, clock = sourceTime) => ({ sourceTime, clock });
const wrap = text => `<span class="chat-timestamp">${text}</span>`;

test('HTML clock hints use case-insensitive tag, class, or id names before tags disappear', () => {
    for (const source of [
        '<time>08:30</time>', '<TIME>08:30</TIME>', '<screen-time>08:30</screen-time>',
        '<span class="anything chat-timestamp selected">08:30</span>',
        "<div CLASS='myChatTIMEstamp'>08:30</div>", '<span id=screenTime>08:30</span>',
        '<span id="my-time-indicator">08:30</span>', '<span class="chat&#45;time">08:30</span>',
    ]) assert.deepEqual(htmlClocks(source), [hint('08:30')], source);
    for (const source of [
        '08:30', 'Meet at 08:30.', '<div>08:30</div>', '<span style="--time-ink:red">08:30</span>',
        '<span data-time="08:30">08:30</span>', '<span title="time">08:30</span>',
        '<span onclick="showTime()">08:30</span>', '<span class="clock" title="class=time">08:30</span>',
        '&lt;time&gt;08:30&lt;/time&gt;',
    ]) assert.deepEqual(htmlClocks(source), [], source);
});

test('HTML hints retain clock text only, without manufacturing a date or changing input', () => {
    const original = '<div class="chat-timestamp" style="font-size:12px;color:var(--me35-time-ink,var(--name-color,#636B76));opacity:var(--me35-time-opacity,.5);line-height:1;margin-bottom:5px;margin-left:2px;display:inline-flex;align-items:flex-end;gap:0;">11.05, 11:38</div>';
    assert.deepEqual(htmlClocks(original), []);
    assert.deepEqual(htmlClocks(original.replace('11.05, 11:38', '11:38')), [hint('11:38')]);
    assert.ok(original.includes('11.05, 11:38'));
    assert.deepEqual(htmlClocks('<time> \n 8 : 30 PM \n</time>'), [hint('8 : 30 PM', '20:30')]);
    assert.deepEqual(htmlClocks('<time>오후&nbsp;8&#58;30</time>'), [hint('오후\u00a08:30', '20:30')]);
    assert.deepEqual(htmlClocks('<time>&#x30;8&colon;30</time>'), [hint('08:30')]);
    for (const source of ['11.05, 11:38', '2026-11-05 11:38', 'November 5, 2026 11:38', '11월 5일 11:38']) {
        assert.deepEqual(htmlClocks(wrap(source)), [], source);
    }
});

test('HTML clock content must be exactly one valid minute clock', () => {
    for (const text of [
        '', 'sent at 08:30', '08:30 later', '08:30 (local)', '08:30 / 09:30',
        '08:30.50', '12:30 minutes', '12:30분', 'PT12M30S', '12분 30초',
        '-1:30', '+1:30', '24:00', '25:00', '23:60', '8:3', '008:30', '08:300',
        '오후에 8:30', '08:30 PMs', 'AM 8:30 PM', 'PM 8:30 PM',
        '08\n:30', '08:\n30', '08&unknown;:30', '08&#0;:30',
    ]) assert.deepEqual(htmlClocks(wrap(text)), [], text);
    for (const text of ['0:00', '00:00', '13:30', '23:59']) {
        assert.deepEqual(htmlClocks(wrap(text)), [hint(text, text.padStart(5, '0'))], text);
    }
    // (a field is the clock with only a label, a weekday, a zone or a mark beside it, as a status line's; its seconds, "7pm")
    for (const [text, clock] of [['시간: 08:30', '08:30'], ['⏰ 19:30', '19:30'], ['19:30 KST', '19:30'], ['Sat 19:30', '19:30'], ['11:38:00', '11:38'], ['7pm', '19:00'], ['오늘 19:30', '19:30']]) {
        assert.deepEqual(htmlClocks(wrap(text)), [hint(text, clock)], text);
    }
    // (since 한국어 시각: a Korean clock alone is one too; a length of time or seconds alone never)
    assert.deepEqual(htmlClocks(wrap('19시 30분')), [hint('19시 30분', '19:30')]);
    for (const text of ['2시간 30분', '30분', '19시 30분 전', '오후 19시 30분']) assert.deepEqual(htmlClocks(wrap(text)), [], text);
});

test('HTML clocks support the existing English and Korean markers with strict twelve-hour bounds', () => {
    for (const [marker, expected] of [
        ['PM', '20:30'], ['p.m.', '20:30'], ['오후', '20:30'], ['저녁', '20:30'], ['밤', '20:30'],
        ['AM', '08:30'], ['a.m.', '08:30'], ['오전', '08:30'], ['새벽', '08:30'], ['아침', '08:30'],
    ]) {
        for (const text of [`${marker} 8:30`, `8:30 ${marker}`]) assert.deepEqual(htmlClocks(wrap(text)), [hint(text, expected)]);
        for (const hour of ['13', '23', '24']) {
            for (const text of [`${marker} ${hour}:30`, `${hour}:30 ${marker}`]) assert.deepEqual(htmlClocks(wrap(text)), [], text);
        }
        // (0 as the Korean clock reads it: 오전 · 새벽 · 밤 · AM 0 is midnight, 오후 · PM 0 noon, 아침 · 저녁 0 none)
        const zero = /^(?:PM|p\.m\.|오후)$/.test(marker) ? '12:30' : /^(?:AM|a\.m\.|오전|새벽|밤)$/.test(marker) ? '00:30' : '';
        for (const hour of ['0', '00']) {
            for (const text of [`${marker} ${hour}:30`, `${hour}:30 ${marker}`]) assert.deepEqual(htmlClocks(wrap(text)), zero ? [hint(text, zero)] : [], text);
        }
    }
    assert.deepEqual(htmlClocks('<time>12:30 AM</time><time>12:30 PM</time>'), [hint('12:30 AM', '00:30'), hint('12:30 PM', '12:30')]);
});

test('HTML hints do not read explicit durations or dates from datetime attributes', () => {
    for (const value of ['PT12M30S', 'P1DT12H', '2026-11-05T08:30', '11.05 08:30', 'not-a-time', '']) {
        assert.deepEqual(htmlClocks(`<time datetime="${value}">08:30</time>`), [], value);
        assert.deepEqual(htmlClocks(`<time datetime="${value}"><span class="time">08:30</span></time>`), [], value);
    }
    for (const cls of ['elapsed-time', 'timer', 'time duration', 'countdown-time', 'timerLabel', 'countdownTime', 'elapsedTime']) {
        assert.deepEqual(htmlClocks(`<span class="${cls}">12:30</span>`), [], cls);
    }
    assert.deepEqual(htmlClocks('<time datetime="08:30">08:30</time>'), [hint('08:30')]);
    assert.deepEqual(htmlClocks('<time datetime="08:30:00">08:30</time>'), [hint('08:30')]);
    // Without any duration evidence, a time-labelled 12:30 can only be a candidate, not proof of meaning.
    assert.deepEqual(htmlClocks(wrap('12:30')), [hint('12:30')]);
});

test('nested markup has no duplicate wrappers and preserves separate sibling hints', () => {
    assert.deepEqual(htmlClocks('<div class="time"><span id="time"><b>08:30</b></span></div>'), [hint('08:30')]);
    assert.deepEqual(htmlClocks('<time>PM <span class="time">8:30</span></time>'), [hint('PM 8:30', '20:30')]);
    assert.deepEqual(htmlClocks('<div class="timeline"><span class="date">11.05</span><span class="time">08:30</span><span class="time">09:30</span></div>'), [hint('08:30'), hint('09:30')]);
    for (const source of [
        '<time>11.05 <span class="time">08:30</span></time>',
        '<div class="chat-timestamp">11.05, <span class="time">08:30</span></div>',
        '<time>November 5, 2026 <span class="time">8:30 PM</span></time>',
    ]) assert.deepEqual(htmlClocks(source), [], source);
    assert.deepEqual(htmlClocks('<div><time>08:30</time><time>08:30</time></div>'), [hint('08:30'), hint('08:30')]);
    assert.deepEqual(htmlClocks('<time>08<!-- decorative -->:30</time>'), [hint('08:30')]);
    assert.deepEqual(htmlClocks('<time>08<br>:30</time>'), []);
});

test('markup inside inert, reasoning, and comment regions cannot become clocks', () => {
    const clock = wrap('08:30');
    for (const tag of ['style', 'script', 'template', 'think', 'thinking', 'thought', 'reasoning', 'analysis', 'scene_plan', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes']) {
        assert.deepEqual(htmlClocks(`<${tag} class="time">${clock}</${tag}>${wrap('09:30')}`), [hint('09:30')], tag);
    }
    for (const attribute of ['hidden', 'hidden="until-found"']) {
        assert.deepEqual(htmlClocks(`<span class="time" ${attribute}>08:30</span>${wrap('09:30')}`), [hint('09:30')], attribute);
        assert.deepEqual(htmlClocks(`<div ${attribute}>${clock}</div>${wrap('09:30')}`), [hint('09:30')], attribute);
    }
    assert.deepEqual(htmlClocks('<time aria-hidden="false">08:30</time>'), [hint('08:30')]);
    // (aria-hidden is for screen readers: the screen shows it, so its clock is read)
    assert.deepEqual(htmlClocks('<span class="time" aria-hidden="true">08:30</span>'), [hint('08:30')]);
    assert.deepEqual(htmlClocks(`<template><template>${clock}</template>${clock}</template>${wrap('09:30')}`), [hint('09:30')]);
    assert.deepEqual(htmlClocks(`<!-- ${clock} -->${wrap('09:30')}`), [hint('09:30')]);
    assert.deepEqual(htmlClocks(`<![CDATA[${clock}]]>${wrap('09:30')}`), [hint('09:30')]);
    assert.deepEqual(htmlClocks(`<script>const x = '<time>08:30</time>'; globalThis.__clockExecuted = true;</script>${wrap('09:30')}`), [hint('09:30')]);
    assert.equal(globalThis.__clockExecuted, undefined);
    assert.deepEqual(htmlClocks('<time>08<script>ignored</script>:30</time>'), []);
    for (const tag of ['think', 'thinking', 'thought', 'reasoning', 'analysis']) {
        assert.deepEqual(htmlClocks(`${clock}</${tag}>${wrap('09:30')}`), [hint('09:30')], tag);
    }
});

test('quoted tag-like attributes are inert and malformed or unfinished elements fail closed', () => {
    assert.deepEqual(htmlClocks('<span title="<time>08:30</time>">nothing</span>'), []);
    assert.deepEqual(htmlClocks('<span title=">" class="time">08:30</span>'), [hint('08:30')]);
    assert.deepEqual(htmlClocks("<span class='time' title='08:30 > 09:30'>10:30</span>"), [hint('10:30')]);
    for (const source of [
        '<time>08:30', '<time>08:30</span>', '<time><b>08:30</time>', '<span><time>08:30</time>',
        '<span title="<time>08:30</time>', '<script><time>08:30</time>', '<!-- <time>08:30</time>',
        '<template><time>08:30</time>', '<time/>08:30',
    ]) assert.deepEqual(htmlClocks(source), [], source);
    assert.deepEqual(htmlClocks(null), []);
    assert.deepEqual(htmlClocks(undefined), []);
});


test('quoted HTML and code samples never supply a current-clock hint', () => {
    for (const tag of ['blockquote', 'q', 'pre', 'code']) {
        assert.deepEqual(htmlClocks(`<${tag}>${wrap('08:30')}</${tag}>${wrap('09:30')}`), [hint('09:30')], tag);
        assert.deepEqual(htmlClocks(`<${tag} class="time">08:30</${tag}>`), [], tag);
    }
    assert.deepEqual(htmlClocks(`<blockquote><q>${wrap('08:30')}</q></blockquote>${wrap('09:30')}`), [hint('09:30')]);
    assert.deepEqual(htmlClocks('<time>08<q>old text</q>:30</time>'), []);
});

test('Markdown backtick and tilde fences hide sample markup and resume at their matching closer', () => {
    for (const fence of ['```', '````', '~~~', '~~~~']) {
        for (const indent of ['', '  ', '    ']) {
            const sample = `${indent}${fence}html\n${wrap('08:30')}\n${indent}${fence}\n${wrap('09:30')}`;
            assert.deepEqual(htmlClocks(sample), [hint('09:30')], sample);
        }
        assert.deepEqual(htmlClocks(`${wrap('07:30')}\n${fence}html\n${wrap('08:30')}`), [hint('07:30')]);
    }
    assert.deepEqual(htmlClocks('````html\n<time>08:30</time>\n```\n<time>09:30</time>\n````\n<time>10:30</time>'), [hint('10:30')]);
    assert.deepEqual(htmlClocks('~~~html\n<time>08:30</time>\n```\n<time>09:30</time>\n~~~~\n<time>10:30</time>'), [hint('10:30')]);
    assert.deepEqual(htmlClocks('```html\r\n<time>08:30</time>\r\n```\r\n<time>09:30</time>'), [hint('09:30')]);
    assert.deepEqual(htmlClocks('<time>08\n```html\nignored\n```\n:30</time>'), []);
});


test('inline Markdown code excludes embedded HTML without losing nearby real timestamps', () => {
    for (const ticks of ['`', '``', '```', '````']) {
        const source = `Example: ${ticks}<time>08:30</time>${ticks} then <time>09:30</time>`;
        assert.deepEqual(htmlClocks(source), [hint('09:30')], source);
    }
    assert.deepEqual(htmlClocks('Sample: ``<time>08:30</time> ` inner`` <time>09:30</time>'), [hint('09:30')]);
    assert.deepEqual(htmlClocks('Sample: `<time>08:30</time>\ncontinued`\n<time>09:30</time>'), [hint('09:30')]);
    assert.deepEqual(htmlClocks('Sample: `<time>08:30</time>\\` <time>09:30</time>'), [hint('09:30')]);
    assert.deepEqual(htmlClocks('Escaped: \\`<time>08:30</time>\\` <time>09:30</time>'), [hint('08:30'), hint('09:30')]);
    assert.deepEqual(htmlClocks('Unmatched: `<time>08:30</time>'), [hint('08:30')]);
    assert.deepEqual(htmlClocks('Unmatched: `<time>08:30</time>``'), [hint('08:30')]);
    assert.deepEqual(htmlClocks('Unmatched: `\n\n<time>08:30</time>\n`'), [hint('08:30')]);
    assert.deepEqual(htmlClocks('<time>08`example`:30</time>'), []);
});

test('explicit Markdown blockquote lines cannot supply HTML clocks', () => {
    for (const prefix of ['> ', '>', '>> ', '> > ', '  > ', '\t> ']) {
        assert.deepEqual(htmlClocks(`${prefix}<time>08:30</time>\n\n<time>09:30</time>`), [hint('09:30')], prefix);
    }
    assert.deepEqual(htmlClocks('> ```html\n> <time>08:30</time>\n> ```\n\n<time>09:30</time>'), [hint('09:30')]);
    assert.deepEqual(htmlClocks('<div>\n> <time>08:30</time>\n<time>09:30</time>\n</div>'), [hint('09:30')]);
    assert.deepEqual(htmlClocks('A comparison > <time>08:30</time>'), [hint('08:30')]);
    assert.deepEqual(htmlClocks('\\> <time>08:30</time>'), [hint('08:30')]);
    assert.deepEqual(htmlClocks('<time>08\n> quoted text\n:30</time>'), []);
});


test('only an adjacent inline dated span owns the same HTML clock occurrence', () => {
    for (const source of [
        '<span>11.05, </span><span class="time">08:30</span>',
        '<span>11.05, </span><span class="time"><b>08:30</b></span>',
        '<div><span>11.05, </span><span class="time">08:30</span></div>',
        '<span>11.05, </span><span class="time">08:30\n</span>',
        '<span>11.05, </span><!-- gap --><span class="time">08:30</span>',
        '<span>11.05, </span><script>ignored</script><span class="time">08:30</span>',
        '<span>11.05, </span><think>ignored</think><span class="time">08:30</span>',
        '<span>11.05, </span><span class="time">8:30&nbsp;PM</span>',
    ]) assert.deepEqual(htmlClocks(source), [], source);
    for (const source of [
        'Mara recalls last month: 10.05 08:30. Three days later she reads <time>08:30</time>.',
        'Mara recalls last month: 10.05 08:30. Three days later she reads <span class="time">08:30</span>.',
        '<span>11.05, </span><time>08:30</time>',
        '<div>11.05, </div><span class="time">08:30</span>',
        '<span>11.05, </span><div class="time">08:30</div>',
        '<span>11.05, </span><br><span class="time">08:30</span>',
        '<span>11.05, </span>\n<span class="time">08:30</span>',
        '<span>11&#46;05, </span><span class="time">08:30</span>',
        '<span>11.05, </span><span class="time">&#x30;8:30</span>',
    ]) assert.deepEqual(htmlClocks(source), [hint('08:30')], source);
    assert.deepEqual(htmlClocks('<span>11.05, </span><span class="time">08:30</span> then <span class="time">08:30</span>'), [hint('08:30')]);
});
