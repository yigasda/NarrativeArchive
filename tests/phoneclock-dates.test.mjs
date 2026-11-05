import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lifeClock, timerLeft } from '../src/phonesynclife.js';

// Load the complete screen module with the app shell stubbed, like the tracker tests.
// Date calculations, the timer renderer and storage cleanup remain production code.
const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const actualSync = new URL('../src/phonesynclife.js', import.meta.url).href;
const source = await readFile(new URL('../src/phonelifeapps.js', import.meta.url), 'utf8');
const stubs = {
    AX: '{}', filling: 'new Set()', storyNow: 'p=>p.now', decimalOf: '()=>"."', localeOf: '()=>"en-US"',
    pad: 'x=>String(x).padStart(2,"0")', esc: 'x=>String(x)', clockOf: '(p,x)=>String(x)',
};
const loaded = source.replace(/import \{([^}]+)\} from '([^']+)';/g, (_, names, path) => {
    if (path === './phonesynclife.js') return `import {${names}} from '${actualSync}';`;
    return names.split(',').map(s => {
        const [name, alias] = s.trim().split(/\s+as\s+/);
        return `const ${alias || name} = ${stubs[name] || '()=>""'};`;
    }).join('\n');
});
const { timerScreen, setStory, nextRing, weekday } = await import(encoded(loaded + '\nexport { nextRing, weekday };'));
const phone = (at, now, year = 2028) => ({ year, now, life: { at, clock: { running: { sec: 600, left: 600, at } } } });

for (const [at, now, year] of [
    ['11-01 23:58', '11-02 00:01', 2028], ['04-30 23:58', '05-01 00:01', 2028],
    ['12-31 23:58', '01-01 00:01', 2029], ['02-28 23:58', '02-29 00:01', 2028],
    ['02-29 23:58', '03-01 00:01', 2028], ['02-28 23:58', '03-01 00:01', 2027],
]) test(`timer retains seven minutes across ${at} to ${now} (${year})`, () => {
    const p = phone(at, now, year), r = structuredClone(p.life.clock.running);
    setStory(p);
    assert.equal(timerLeft(p, now), 420);
    assert.match(timerScreen(p, now), /<span>07<\/span><i>:<\/i><em>00<\/em>/);
    assert.deepEqual(lifeClock(p, now), []);
    assert.deepEqual(p.life.clock.running, r, 'cleanup must not reset the original time anchor');
    const end = now.slice(0, 6) + '00:08';
    assert.equal(timerLeft(p, end), 0);
    const effects = lifeClock(p, end);
    assert.equal(p.life.clock.running, null);
    assert.deepEqual(effects, [{ type: 'set', path: 'life.clock.running', from: r, to: null }]);
});

test('backwards and incomplete timestamps do not add time or discard a timer', () => {
    for (const [at, now] of [['11-02 00:01', '11-01 23:58'], ['11-02 12:00', '11-02 11:00'], ['01-01 00:01', '12-31 23:58'], ['', '11-02 00:01']]) {
        const p = phone(at, now); setStory(p);
        assert.equal(timerLeft(p, now), 600);
        assert.match(timerScreen(p, now), /<span>10<\/span><i>:<\/i><em>00<\/em>/);
        lifeClock(p, now);
        assert.ok(p.life.clock.running);
    }
});
test('a long forward jump expires the timer instead of inferring a future start year', () => {
    const p = phone('01-01 00:00', '08-01 00:00');
    setStory(p);
    assert.equal(timerLeft(p, p.now), 0);
    assert.match(timerScreen(p, p.now), /<b class="lf_dig">끝<\/b>/);
    const effects = lifeClock(p, p.now);
    assert.equal(p.life.clock.running, null);
    assert.equal(effects.length, 1);
    assert.equal(effects[0].path, 'life.clock.running');
});
test('legacy timer uses life.at; partial remaining seconds and repeated cleanup stay stable', () => {
    const p = phone('11-01 23:58', '11-02 00:01');
    delete p.life.clock.running.at; p.life.clock.running.left = 300;
    assert.equal(timerLeft(p, p.now), 120);
    lifeClock(p, p.now); lifeClock(p, p.now);
    assert.equal(timerLeft(p, p.now), 120);
});
const alarm = extra => ({ on: true, time: '07:00', days: [], ...extra });
test('a missing story year uses the same current-year fallback as the screen', t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2027-06-15T12:00:00Z') });
    const p = phone('02-28 23:58', '03-01 00:01');
    delete p.year;
    setStory(p);
    assert.equal(timerLeft(p, p.now), 420);
    assert.match(timerScreen(p, p.now), /<span>07<\/span><i>:<\/i><em>00<\/em>/);
    assert.deepEqual(lifeClock(p, p.now), []);
    assert.ok(p.life.clock.running);
});
test('one-time leap-day alarm is eight hours away on leap-day eve', () => {
    setStory(phone('', '02-28 23:00'));
    assert.deepEqual(nextRing(alarm({ date: '02-29' }), '02-28 23:00'), { day: '02-29', min: 480 });
    assert.equal(weekday('02-28'), 1);
    assert.equal(weekday('02-29'), 2);
    assert.equal(weekday('03-01'), 3);
});
test('weekly alarms follow real weekdays across leap day, ordinary February and New Year', () => {
    for (const [now, year, days, day, min] of [
        ['02-28 23:00', 2028, ['tue'], '02-29', 480],
        ['02-29 23:00', 2028, ['wed'], '03-01', 480],
        ['02-28 23:00', 2027, ['mon'], '03-01', 480],
        ['12-31 23:00', 2028, ['mon'], '01-01', 480],
        ['02-29 07:00', 2028, ['tue'], '03-07', 10080],
    ]) {
        setStory(phone('', now, year));
        assert.deepEqual(nextRing(alarm({ days }), now), { day, min });
    }
});
test('disabled and undated one-time alarm behavior stays unchanged', () => {
    setStory(phone('', '02-28 23:00'));
    assert.equal(nextRing(alarm({ on: false, date: '02-29' }), '02-28 23:00'), null);
    assert.deepEqual(nextRing(alarm({}), '02-28 23:00'), { day: '02-29', min: 480 });
    assert.deepEqual(nextRing(alarm({}), '02-28 06:00'), { day: '02-28', min: 60 });
});
