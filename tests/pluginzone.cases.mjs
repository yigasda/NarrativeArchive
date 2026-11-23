// tests/pluginzone.test.mjs가 띄우는 것: Date · moment · Intl 값 목록을 JSON으로 써요.
//   node pluginzone.cases.mjs native              → 이 프로세스의 TZ · LC_ALL 그대로 (진짜 Node)
//   node pluginzone.cases.mjs shim <zone> <locale> → 작업 스레드에서 plugin/zone.mjs로 그 시간대 · 언어 (프로세스의 TZ · LC_ALL은 다른 것)
import { Worker, isMainThread, workerData, parentPort } from 'node:worker_threads';
import { createRequire } from 'node:module';

const [mode, zoneArg, localeArg] = isMainThread ? process.argv.slice(2) : [workerData.mode, workerData.zone, workerData.locale];
if (isMainThread && mode === 'shim') {
    const w = new Worker(new URL(import.meta.url), { workerData: { mode, zone: zoneArg, locale: localeArg } });
    w.on('message', m => { process.stdout.write(m); });
    w.on('error', e => { console.error(e); process.exit(1); });
} else {
    if (mode === 'shim') { const Z = await import('../plugin/zone.mjs'); Z.setZone(zoneArg); if (localeArg && localeArg !== '-') Z.setLocale(localeArg); }
    const out = JSON.stringify(run());
    if (isMainThread) process.stdout.write(out); else parentPort.postMessage(out);
}

function run() {
    const moment = createRequire(import.meta.url)('moment');
    moment.suppressDeprecationWarnings = true;
    const out = [];
    const put = (k, f) => { let v; try { v = f(); } catch (e) { v = 'THROW ' + e.constructor.name; } out.push([k, typeof v === 'number' && Number.isNaN(v) ? 'NaN' : v]); };
    // instants: years 1900~2040, and every half hour around the offset changes of the zones tested
    const inst = [];
    for (let y = 1900; y <= 2040; y += 7) for (const mo of [0, 2, 3, 5, 9, 10, 11]) inst.push(Date.UTC(y, mo, 9, 13, 7, 11, 250));
    for (const [y, m, d] of [[2026, 2, 8], [2026, 2, 29], [2026, 9, 25], [2026, 10, 1], [2026, 3, 5], [2026, 9, 4], [2026, 8, 27], [1987, 4, 10], [1988, 9, 9], [2011, 11, 29], [2011, 11, 30], [1908, 3, 1]])
        for (let h = -30; h <= 30; h++) inst.push(Date.UTC(y, m, d) + h * 1800e3);
    inst.push(-62198755200000, -8.64e15, 8.64e15, 0, -1);
    for (const t of inst) {
        const d = new Date(t);
        put(`g ${t}`, () => [d.getFullYear(), d.getMonth(), d.getDate(), d.getDay(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds(), d.getTimezoneOffset(), d.getYear()].join(','));
        put(`s ${t}`, () => d.toString());
        put(`ds ${t}`, () => d.toDateString() + ' | ' + d.toTimeString());
        put(`ls ${t}`, () => d.toLocaleString('en-US') + ' | ' + d.toLocaleDateString('en-US') + ' | ' + d.toLocaleTimeString('en-US', { hour: 'numeric' }));
        put(`dl ${t}`, () => d.toLocaleString() + ' | ' + new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' }).format(d));
        put(`dtf ${t}`, () => new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'long' }).format(d) + ' ' + Intl.DateTimeFormat().resolvedOptions().timeZone);
        put(`m ${t}`, () => { const m = moment(t); return [m.format('LT'), m.format('LL'), m.format('dddd'), m.format('HH:mm'), m.format('YYYY-MM-DD'), m.format('LLLL Z ZZ'), m.clone().startOf('day').valueOf(), m.clone().endOf('month').valueOf(), m.clone().add(1, 'day').valueOf(), m.utcOffset(), m.isDST()].join('|'); });
    }
    // local fields → instant (also the skipped and the repeated local times)
    for (const [y, m, d] of [[2026, 2, 8], [2026, 2, 29], [2026, 9, 25], [2026, 10, 1], [2026, 3, 5], [2026, 9, 4], [2026, 8, 27], [1987, 4, 10], [2011, 11, 29], [2011, 11, 30], [1908, 3, 1]]) {
        for (let mi = 0; mi < 24 * 60; mi += 15) {
            put(`c ${y},${m},${d},0,${mi}`, () => new Date(y, m, d, 0, mi).getTime());
            put(`mc ${y},${m},${d},${mi}`, () => moment([y, m, d, Math.floor(mi / 60), mi % 60]).valueOf());
        }
    }
    for (const a of [[99, 0, 1], [0, 0], [2024, 13, 40, 25, 61, 61, 1001], [-5, 0, 1], [275760, 8, 13], [NaN, 0], ['2026', '3']]) put(`c ${a}`, () => new Date(...a).getTime());
    // setters
    for (const t of inst.slice(0, 160)) {
        const one = f => { const d = new Date(t); const r = f(d); return [r, d.getTime()].join('/'); };
        put(`set ${t}`, () => [one(d => d.setHours(2, 30)), one(d => d.setDate(0)), one(d => d.setMonth(2, 29)), one(d => d.setFullYear(2026, 2, 8)), one(d => d.setMinutes(-1)), one(d => d.setSeconds(3600)), one(d => d.setMilliseconds(-1)), one(d => d.setYear(95))].join(' '));
    }
    put('setNaN', () => { const d = new Date(NaN); return [d.setFullYear(2020), d.getTime(), new Date(NaN).setHours(1)].join(','); });
    // texts
    for (const s of ['2024-01-01', '2024-01', '2024', '+002024-01-01T00:00:00', '2024-01-01T10:00', '2024-01-01T10:00:00.123', '2024-01-01T10:00Z', '2024-01-01T10:00:00+09:00',
        '2026-03-08T02:30:00', '2026-11-01T01:30:00', '2026-03-29T02:30:00', '2026-10-25T02:30:00', '2026-04-05T02:30:00', '2024-01-01 10:00:00', '2024-01-01 10:00:00Z', '2024-01-01 10:00:00 GMT', '2024-01-01 10:00:00 +0300',
        'June 19, 2023 2:20 pm', 'June 19, 2023 14:20', 'Jan 1 2024 10:00 GMT+0100', 'Jan 1 2024 10:00 UTC', 'Jan 1 2024 10:00 EST', '1 January 2024', '1 January 2024 10:00 pm', '2024/01/01 10:00', '2024/1/1',
        'Thu Jan 15 2026 13:00:00 GMT+0100 (Central European Standard Time)', 'Thu Jan 15 2026 13:00:00', 'Mon, 23 Nov 2026 17:52:34 GMT', 'Mon, 23 Nov 2026 17:52:34', '12/31/2024', '12/31/2024 23:59', 'Nov 1 2026 1:30', 'Mar 8 2026 2:30',
        '2023-01-01 12:00:00', 'yesterday', '', '10:00', 'Sat Dec 31 1910', '1950-06-01T00:00:00', '2024-07-12T01:31:37', '2024-07-12T01:31:37.123Z', '2026-3-7@21h10m00s000ms', 'March 7, 2026 9:10pm']) {
        put(`p ${s}`, () => [Date.parse(s), new Date(s).getTime()].join(','));
        put(`mp ${s}`, () => { const m = moment(s); return m.isValid() ? m.valueOf() : 'invalid'; });
    }
    // what the time macros do
    for (const t of [Date.UTC(2026, 10, 23, 8, 5), Date.UTC(2026, 2, 8, 6, 59), Date.UTC(2026, 2, 8, 7, 1)]) {
        put(`macro ${t}`, () => { const m = moment(t); return [m.format('LT'), m.format('LL'), m.format('dddd'), m.format('HH:mm'), m.format('YYYY-MM-DD'), m.format('YYYY-MM-DD HH:mm:ss'), moment(t).utc().utcOffset(9).format('LT')].join('|'); });
    }
    put('timeDiff', () => moment.duration(moment('2026-03-08 01:00:00').diff(moment('2026-03-08 04:00:00'))).humanize(true));
    put('Date()', () => typeof Date() + ' ' + (Date() === new Date().toString()));
    put('kind', () => [new Date() instanceof Date, Object.prototype.toString.call(new Date()), structuredClone(new Date(5)).getTime(), JSON.stringify(new Date(5)), Date.length, Date.name, new Date(new Date(7)).getTime(), new Date({ valueOf: () => 9 }).getTime(), new Date({ [Symbol.toPrimitive]: () => '2024-01-01T10:00' }).getTime(), `${new Date(0)}` === new Date(0).toString()].join(','));
    put('throws', () => [() => new Date(1n), () => new Date(Symbol('x')), () => Date.prototype.getHours.call({}), () => new Date(0).toLocaleString('en', null)].map(f => { try { f(); return 'ok'; } catch (e) { return e.constructor.name; } }).join(','));
    // the default language
    const words = ['b', 'a', 'ä', 'z', '가', 'Z', 'ö', 'o', 'ch', 'c', 'h', 'i', 'ı', 'İ', 'é', 'e', '日', 'あ', 'ア'];
    put('collate', () => [[...words].sort((a, b) => a.localeCompare(b)).join(''), [...words].sort(new Intl.Collator().compare).join(''), [...words].sort(Intl.Collator().compare).join(''), 'a'.localeCompare('B', undefined, { sensitivity: 'base' })].join(' | '));
    put('number', () => [(1234567.891).toLocaleString(), (1234567.891).toLocaleString(undefined, { style: 'currency', currency: 'EUR' }), new Intl.NumberFormat().format(0.5), 12345678901234567890n.toLocaleString(), [1234.5, new Date(0)].toLocaleString()].join(' | '));
    put('words', () => [new Intl.PluralRules().select(1), new Intl.RelativeTimeFormat().format(-2, 'day'), new Intl.ListFormat().format(['a', 'b', 'c']), new Intl.DisplayNames(undefined, { type: 'region' }).of('US'), 'i'.toLocaleUpperCase(), 'I'.toLocaleLowerCase(), [...new Intl.Segmenter().segment('ab')].length].join(' | '));
    // (not Collator's · PluralRules': V8 writes the default language there as it is — tr-TR —, and one given by name as its data has
    //  it — tr. Only resolvedOptions shows it: what they sort and pick is the same, above)
    put('resolved', () => [Intl.DateTimeFormat().resolvedOptions().locale, new Intl.NumberFormat().resolvedOptions().locale].join(','));
    put('dates', () => { const d = new Date(Date.UTC(2026, 10, 23, 8, 5, 9)); return [d.toLocaleString(), d.toLocaleDateString(), d.toLocaleTimeString(), d.toLocaleDateString(undefined, { weekday: 'long', month: 'long' }), new Intl.DateTimeFormat().format(d), d.toString()].join(' | '); });
    return out;
}
