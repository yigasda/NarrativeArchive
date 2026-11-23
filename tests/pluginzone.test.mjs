// 일꾼 스레드의 시간대 · 언어 (plugin/zone.mjs): 그 시간대 · 언어로 띄운 진짜 Node와 값이 같아요. 스레드마다 따로이고, 본체 스레드는 그대로예요.
// 비교 값은 tests/pluginzone.cases.mjs (Date의 getter · setter · 글 · parse, 로컬 칸 → 순간, moment, Intl, 기본 언어).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const CASES = fileURLToPath(new URL('./pluginzone.cases.mjs', import.meta.url));
const ZONE = new URL('../plugin/zone.mjs', import.meta.url).href;
const runCases = (env, args) => new Promise((ok, no) => execFile(process.execPath, [CASES, ...args], { env: { ...process.env, ...env }, maxBuffer: 1 << 28 }, (err, out, errText) => (err ? no(new Error(String(errText || err))) : ok(JSON.parse(out)))));
// (zone · its language · the server computer's zone and language, another one each time)
const PAIRS = [
    ['Asia/Seoul', 'ko-KR', 'America/Los_Angeles', 'de_DE.UTF-8'],
    ['America/New_York', 'en-US', 'Asia/Seoul', 'ko_KR.UTF-8'],
    ['Europe/Berlin', 'de-DE', 'UTC', 'en_US.UTF-8'],
    ['Australia/Lord_Howe', 'ja-JP', 'Europe/Berlin', 'de_DE.UTF-8'],
    ['Pacific/Apia', 'en-US', 'Asia/Seoul', 'ko_KR.UTF-8'],
    ['Pacific/Chatham', 'tr-TR', 'America/New_York', 'en_US.UTF-8'],
    ['America/St_Johns', 'fr-CA', 'Asia/Kolkata', 'hi_IN.UTF-8'],
    ['Asia/Kolkata', 'hi-IN', 'Pacific/Chatham', 'en_US.UTF-8'],
    ['America/Sao_Paulo', 'pt-BR', 'Australia/Lord_Howe', 'ja_JP.UTF-8'],
    ['UTC', 'ko-KR', 'Asia/Seoul', 'en_US.UTF-8'],
];
// 알려진 차이 (매크로 · 우리 코드가 쓰지 않는 것):
//  - toString 괄호 안의 시간대 이름: V8은 오늘의 이름, Intl은 그 시각의 이름. 이름이 바뀐 시간대에서 달라요 — 여기서는 Lord Howe의 1970년대
//    ("Lord Howe Standard Time" / 호주 동부 표준시). 다른 곳: Casablanca 2019년부터 · Nuuk 2023년 전 · Pyongyang 2015~2018년 · 옛 LMT 시각 (plugin/st/README.md)
const known = (zone, key) => zone === 'Australia/Lord_Howe' && /^(s|ds) /.test(key) && Number(key.split(' ')[1]) >= 0 && Number(key.split(' ')[1]) < Date.UTC(1981, 0, 1);
const differ = (zone, real, mine, ok = known) => {
    assert.equal(mine.length, real.length);
    const diffs = [];
    for (let i = 0; i < real.length; i++) {
        assert.equal(mine[i][0], real[i][0]);
        if (JSON.stringify(mine[i][1]) !== JSON.stringify(real[i][1]) && !ok(zone, real[i][0])) diffs.push(`${zone} ${real[i][0]}\n  real ${JSON.stringify(real[i][1])}\n  mine ${JSON.stringify(mine[i][1])}`);
    }
    return { zone, n: real.length, diffs };
};

test('작업 스레드의 시간대 · 언어: TZ · LC_ALL로 띄운 진짜 Node와 같아요 (DST 앞뒤 · 건너뛴 시각 · 하루를 건너뛴 Apia · 45분 Chatham · 30분 Lord Howe · 기본 언어)', { timeout: 120_000 }, async () => {
    const results = await Promise.all(PAIRS.map(async ([zone, locale, host, hostLocale]) => {
        const [real, mine] = await Promise.all([
            runCases({ TZ: zone, LC_ALL: `${locale.replace('-', '_')}.UTF-8`, LANG: '' }, ['native']),
            runCases({ TZ: host, LC_ALL: hostLocale, LANG: '' }, ['shim', zone, locale]),
        ]);
        return differ(zone, real, mine);
    }));
    for (const r of results) assert.ok(r.n > 8000, r.zone);
    assert.deepEqual(results.flatMap(r => r.diffs.slice(0, 5)), []);
});

// (the worker puts it in once and keeps it: before the browser's zone is known — null — and inside atServer it must be the engine's own)
test('끼운 채 null · atServer 안이면 서버 컴퓨터의 시간대 · 언어로 띄운 진짜 Node와 같아요 (다른 것 없이)', { timeout: 120_000 }, async () => {
    const HOSTS = [['Asia/Seoul', 'ko_KR.UTF-8', 'America/New_York', 'en-US'], ['America/St_Johns', 'fr_CA.UTF-8', 'Asia/Kolkata', 'hi-IN'], ['Australia/Lord_Howe', 'ja_JP.UTF-8', 'Pacific/Chatham', 'tr-TR']];
    const results = await Promise.all(HOSTS.flatMap(([host, hostLocale, zone, locale]) => {
        const env = { TZ: host, LC_ALL: hostLocale, LANG: '' }, real = runCases(env, ['native']);
        return [
            Promise.all([real, runCases(env, ['shim', '-', '-'])]).then(([r, m]) => differ(`${host} null`, r, m, () => false)),
            Promise.all([real, runCases(env, ['shim', zone, locale, 'server'])]).then(([r, m]) => differ(`${host} atServer (${zone})`, r, m, () => false)),
        ];
    }));
    for (const r of results) assert.ok(r.n > 8000, r.zone);
    assert.deepEqual(results.flatMap(r => r.diffs.slice(0, 5)), []);
});

// 작업 스레드 하나: zone.mjs로 그 시간대를 두고, 다른 스레드가 도는 사이사이 세 번 알려요
const SHOW = `
const { workerData, parentPort } = require('node:worker_threads');
(async () => {
    const Z = await import(workerData.zone);
    Z.setZone(workerData.tz);
    const T = ${Date.UTC(2026, 10, 23, 8, 5)};
    for (let i = 0; i < 3; i++) {
        parentPort.postMessage({ tz: workerData.tz, hours: new Date(T).getHours(), str: new Date(T).toString(), intl: Intl.DateTimeFormat().resolvedOptions().timeZone });
        let x = 0; for (let k = 0; k < 20000; k++) x += new Date(T + k * 6e4).getHours();
        await new Promise(r => setTimeout(r, 20));
    }
})();`;
const hourIn = (tz, t) => Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: 'numeric' }).format(t));

test('작업 스레드 넷이 같이 돌아도 저마다 자기 시간대예요. 본체 스레드는 그대로예요', async () => {
    const NativeDate = Date, before = new Date(Date.UTC(2026, 10, 23, 8, 5)).toString(), hostZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zones = ['Asia/Seoul', 'America/New_York', 'Pacific/Chatham', null];
    const got = await Promise.all(zones.map(tz => new Promise((ok, no) => {
        const w = new Worker(SHOW, { eval: true, workerData: { zone: ZONE, tz } });
        const seen = [];
        w.on('error', no);
        w.on('message', m => { seen.push(m); if (seen.length === 3) { w.terminate(); ok(seen); } });
    })));
    const T = Date.UTC(2026, 10, 23, 8, 5);
    for (const [i, tz] of zones.entries()) {
        for (const m of got[i]) {
            assert.equal(m.hours, hourIn(tz || hostZone, T), String(tz));
            assert.equal(m.intl, tz || hostZone);
            if (!tz) assert.equal(m.str, before);
        }
    }
    assert.equal(Date, NativeDate);
    assert.equal(new Date(T).toString(), before);
    assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, hostZone);
});

const KEEP = `
const { workerData, parentPort } = require('node:worker_threads');
(async () => {
    const kept = () => ({ Date: globalThis.Date, proto: Object.getOwnPropertyNames(Date.prototype).map(k => [k, Object.getOwnPropertyDescriptor(Date.prototype, k)]),
        intl: Object.getOwnPropertyNames(Intl).map(k => [k, Intl[k]]), lc: String.prototype.localeCompare, nl: Number.prototype.toLocaleString, bl: BigInt.prototype.toLocaleString });
    const same = (a, b) => a.Date === b.Date && a.lc === b.lc && a.nl === b.nl && a.bl === b.bl && a.intl.every(([k, v], i) => b.intl[i][0] === k && b.intl[i][1] === v)
        && a.proto.every(([k, d], i) => b.proto[i][0] === k && ['value', 'writable', 'enumerable', 'configurable'].every(x => d[x] === b.proto[i][1][x]));
    const T = ${Date.UTC(2026, 10, 23, 20, 0)}, sort = () => ['b', '가', 'a'].sort((x, y) => x.localeCompare(y)).join('');
    const was = kept(), wasHours = new Date(T).getHours(), wasSorted = sort();
    const Z = await import(workerData.zone);
    const out = { loaded: !same(was, kept()), loadedSame: [Z.getZone(), Z.getLocale(), new Date(T).getHours() === wasHours, sort() === wasSorted] };
    const inst = kept();
    // (a subclass made after the import, before any zone: it follows the zone set later)
    class Later extends Date {}
    out.names = [Z.setZone('asia/seoul'), Z.setLocale('ko-kr'), Z.getZone(), Z.getLocale()];
    out.hours = new Date(T).getHours();
    out.sorted = sort();
    out.later = new Later(2026, 10, 24, 5).getTime() === T;
    for (const bad of [() => Z.setZone('Mars/Base'), () => Z.setLocale('not a locale!')]) { try { bad(); out.bad = (out.bad || '') + 'none,'; } catch (e) { out.bad = (out.bad || '') + e.constructor.name + ','; } }
    out.afterBad = [Z.getZone(), Z.getLocale(), new Date(T).getHours()];
    // (the server's own, only inside: its value back, and the thread's again after — a throw too)
    out.server = Z.atServer(() => [Z.getZone(), Z.getLocale(), new Date(T).getHours() === wasHours, sort() === wasSorted, new Intl.DateTimeFormat().resolvedOptions().timeZone]);
    try { Z.atServer(() => { throw new Error('x'); }); } catch { /* thrown on */ }
    out.afterServer = [Z.getZone(), Z.getLocale(), new Date(T).getHours(), sort()];
    Z.setZone(null);
    out.localeOnly = [new Date(T).getHours() === wasHours, sort()];
    Z.setLocale(null);
    // (both null: still in — never taken out —, giving the engine's own values)
    out.back = [same(inst, kept()), new Date(T).getHours() === wasHours, sort() === wasSorted, new Intl.DateTimeFormat().resolvedOptions().timeZone];
    out.hostZone = Intl.DateTimeFormat('en-US', {}).resolvedOptions().timeZone;
    parentPort.postMessage(out);
})();`;

test('작업 스레드: 불러오면 끼우고 되돌리지 않아요(null이면 원래 값). setZone · setLocale은 이름을 정리하고, 잘못된 것은 RangeError(그대로 둬요). atServer 안에서만 서버의 것', async () => {
    const out = await new Promise((ok, no) => { const w = new Worker(KEEP, { eval: true, workerData: { zone: ZONE }, env: { ...process.env, LC_ALL: 'en_US.UTF-8' } }); w.on('error', no); w.on('message', m => { w.terminate(); ok(m); }); });
    assert.equal(out.loaded, true);                    // (불러오면 끼워요)
    assert.deepEqual(out.loadedSame, [null, null, true, true]);   // (아직 null: 원래 값)
    assert.deepEqual(out.names, ['Asia/Seoul', 'ko-KR', 'Asia/Seoul', 'ko-KR']);
    assert.equal(out.hours, 5);                        // (20:00Z = 서울 05:00)
    assert.equal(out.sorted, '가ab');                  // (한국어 정렬: 한글이 먼저)
    assert.equal(out.later, true);
    assert.equal(out.bad, 'RangeError,RangeError,');
    assert.deepEqual(out.afterBad, ['Asia/Seoul', 'ko-KR', 5]);
    assert.deepEqual(out.server, [null, null, true, true, out.hostZone]);
    assert.deepEqual(out.afterServer, ['Asia/Seoul', 'ko-KR', 5, '가ab']);
    assert.deepEqual(out.localeOnly, [true, '가ab']);
    assert.deepEqual(out.back, [true, true, true, out.hostZone]);
});

test('본체 스레드에서는 시간대 · 언어를 바꾸지 않아요 (실리 서버 자신의 것): 오류이고 그대로예요', async () => {
    const NativeDate = Date;
    const Z = await import(ZONE);
    assert.throws(() => Z.setZone('Asia/Seoul'), /작업 스레드에서만/);
    assert.throws(() => Z.setLocale('ko-KR'), /작업 스레드에서만/);
    assert.throws(() => Z.setZone('Mars/Base'), RangeError);
    assert.equal(Date, NativeDate);
    Z.setZone(null); Z.setLocale(null);
    assert.equal(Date, NativeDate);
});
