// 일꾼 스레드의 시각 · 언어를 그 사용자의 브라우저와 같게 (실리 매크로 {{time}} · {{date}} …, 우리 코드의 로컬 시각, 정렬 · 숫자 글의 기본 언어).
// 브라우저가 확장 설정에 적은 값(src/phone2keepon.js keepDevice → extension_settings.narrative_archive.device)을 work.mjs withWorld가 일마다 넣어요.
// 이 스레드의 Date · Intl만 바꿔요: 실리 서버 본체(본체 스레드)와 다른 사용자의 일꾼은 그대로예요(스레드마다 전역이 따로예요).
//   setZone('Asia/Seoul') → ICU가 쓰는 이름 · setZone(null): 서버 컴퓨터의 시간대. 모르는 시간대는 RangeError
//   setLocale('ko-KR') → 정리한 이름 · setLocale(null): 서버의 기본 언어. 잘못된 이름은 RangeError
//   atServer(fn): fn이 도는 동안만(동기로) 서버 컴퓨터의 시간대 · 언어 — 실리 서버의 코드를 옮긴 것(plugin/work.mjs)
// 오프셋은 Intl의 tz 데이터(ICU)로 계산해요: DST · 하루를 건너뛴 날까지. 건너뛴 · 겹친 로컬 시각은 ECMAScript 규칙(바뀌기 전 오프셋)대로.
// moment는 Date의 로컬 메서드만 써서 그대로 따라와요.
// 규칙: 작업 스레드에서는 불러온 때 한 번 끼우고(worker.mjs가 맨 먼저 불러요) 되돌리지 않아요. 그 뒤에 만든 Date 하위 클래스도 이 Date를 따라요.
//   null이면 끼운 것이 원래 것과 같은 값을 줘요. 시간대 · 언어는 알게 되면 스레드 내내 그 값이에요: 일과 일 사이(스케줄러 · 늦은 답장 보기)도.
//   서버 컴퓨터의 것이 필요한 곳은 atServer 안에서만, 동기로: 그사이 다른 코드가 끼어들 수 없어요.
// 확인: tests/pluginzone.test.mjs (TZ · LC_ALL로 띄운 진짜 Node와), tests/sttz.test.mjs (진짜 실리 브라우저와: tools/st/oracle-tz.mjs)

import { isMainThread } from 'node:worker_threads';

// ---- 원래 것 (이 파일을 불러온 때의 것: worker.mjs가 맨 먼저 불러요)
const N = Date, P = N.prototype;
const natDesc = Object.fromEntries(Object.getOwnPropertyNames(P).map(k => [k, Object.getOwnPropertyDescriptor(P, k)]));
const nat = Object.fromEntries(Object.entries(natDesc).map(([k, d]) => [k, d.value]));
const natParse = N.parse, natUTC = N.UTC;
const globalDesc = Object.getOwnPropertyDescriptor(globalThis, 'Date');
const NatDTF = Intl.DateTimeFormat;
const INTL = ['DateTimeFormat', 'Collator', 'NumberFormat', 'PluralRules', 'RelativeTimeFormat', 'ListFormat', 'Segmenter', 'DisplayNames', 'DurationFormat'].filter(k => typeof Intl[k] === 'function');
const intlDesc = Object.fromEntries(INTL.map(k => [k, Object.getOwnPropertyDescriptor(Intl, k)]));
// (the locale-taking methods of the other built-ins: their default locale is the language's)
//  (not toLocaleUpperCase · toLocaleLowerCase: V8 maps case without a locale given the same in any language — Node with LC_ALL=tr_TR too)
const PROTOS = [[Number.prototype, 'toLocaleString'], [BigInt.prototype, 'toLocaleString'], [String.prototype, 'localeCompare']];
const protoDesc = PROTOS.map(([o, k]) => Object.getOwnPropertyDescriptor(o, k));

let zone = null, LOC = null;

// ---- 오프셋 (밀리초, 로컬 − UTC). 초마다 캐시
const LIM = 8.64e15;
const fmts = new Map();
const fmtOf = tz => {
    let f = fmts.get(tz);
    if (!f) { f = new NatDTF('en-US', { timeZone: tz, hourCycle: 'h23', era: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }); fmts.set(tz, f); }
    return f;
};
// (days since 1970-01-01 of a proleptic Gregorian date: H. Hinnant's days_from_civil)
function daysFrom(y, m, d) {
    y -= m <= 2 ? 1 : 0;
    const era = Math.floor(y / 400), yoe = y - era * 400;
    const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    return era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468;
}
const offs = new Map();
function offAt(t) {
    const s = Math.min(LIM, Math.max(-LIM, Math.floor(t / 1000) * 1000));
    const key = `${zone}|${s}`;
    let o = offs.get(key);
    if (o !== undefined) return o;
    const p = {};
    for (const x of fmtOf(zone).formatToParts(new N(s))) p[x.type] = x.value;
    let y = Number(p.year);
    if (p.era === 'BC' || p.era === 'B') y = 1 - y;
    o = daysFrom(y, Number(p.month), Number(p.day)) * 864e5 + ((Number(p.hour) * 60 + Number(p.minute)) * 60 + Number(p.second)) * 1000 - s;
    if (offs.size > 4000) offs.clear();
    offs.set(key, o);
    return o;
}
const wallOf = t => t + offAt(t);
// 로컬 시각(로컬 칸을 UTC로 읽은 값) → 순간. 건너뛴 시각 · 겹친 시각은 바뀌기 전 오프셋으로 (ECMAScript LocalTime의 규칙)
function fromWall(w) {
    if (!Number.isFinite(w)) return NaN;
    const before = offAt(w - 864e5 * 1.5), after = offAt(w + 864e5 * 1.5);
    if (before === after) {
        const t = w - before;
        if (offAt(t) === before) return t;
    }
    const ta = w - before, tb = w - after;
    if (offAt(ta) === before) return ta;   // (only this one, or repeated: the offset before)
    if (offAt(tb) === after) return tb;
    return ta;                             // (skipped: the offset before)
}
const clip = t => (Number.isFinite(t) && Math.abs(t) <= LIM ? Math.trunc(t) + 0 : NaN);
// t의 로컬 칸을 UTC 칸으로 가진 Date와 더할 해. Date 범위 끝을 조금 넘는 로컬 시각은 400년(146097일: 요일 · 날짜가 같아요) 옮겨서
const CYCLE = 146097 * 864e5;
function local(t) {
    const w = wallOf(t);
    if (w > LIM) return [new N(w - CYCLE), 400];
    if (w < -LIM) return [new N(w + CYCLE), -400];
    return [new N(w), 0];
}

// ---- 글 → 순간. 엔진이 로컬 시각으로 읽는 글(시간대가 없는 것)만 이 시간대로
//  (as V8's ISO reader: T and Z in either case, no space before or after — a text with one goes to the legacy reader, local time)
const ISO = /^([+-]\d{6}|\d{4})(-\d\d(-\d\d)?)?(T\d\d:\d\d(:\d\d(\.\d+)?)?)?(Z|[+-]\d\d:\d\d)?$/i;
function isLocal(s) {
    const m = ISO.exec(s);
    if (m) return !!m[4] && !m[7];
    const x = s.replace(/\([^)]*\)/g, ' ');
    if (/(^|[^a-z])(z|ut|utc|gmt|[ecmp][sd]t)([^a-z]|$)/i.test(x)) return false;
    if (/\d:\d\d(:\d\d(\.\d+)?)?\s*(am|pm)?\s*[+-]\d/i.test(x)) return false;
    return true;
}
function parse(v) {
    const s = String(v);
    const t = natParse(s);
    if (zone === null || Number.isNaN(t) || !isLocal(s)) return t;
    // (the wall time in the text, read as UTC: a zone added to a text that has none wins, with no host zone in between)
    const w = ISO.test(s) ? natParse(s + 'Z') : natParse(s + ' GMT');
    return Number.isNaN(w) ? t : clip(fromWall(w));
}

// ---- Date 생성자 (같은 prototype을 써요: instanceof · 이미 있는 Date는 그대로)
const timeOf = v => { try { return nat.getTime.call(v); } catch { return undefined; } };
const isObj = v => (typeof v === 'object' && v !== null) || typeof v === 'function';
// (ECMAScript ToPrimitive with no hint)
function toPrimitive(v) {
    if (!isObj(v)) return v;
    const ex = v[Symbol.toPrimitive];
    if (ex !== undefined && ex !== null) {
        if (typeof ex !== 'function') throw new TypeError('Symbol.toPrimitive is not a function');
        const r = ex.call(v, 'default');
        if (isObj(r)) throw new TypeError('Cannot convert object to primitive value');
        return r;
    }
    for (const k of ['valueOf', 'toString']) { const f = v[k]; if (typeof f === 'function') { const r = f.call(v); if (!isObj(r)) return r; } }
    throw new TypeError('Cannot convert object to primitive value');
}
// 로컬 칸(생성자의 둘 이상의 인자) → 로컬 시각을 UTC로 읽은 값. Date 범위 끝을 조금 넘는 로컬 시각은 400년 가까이에서 세고 되돌려요(local()처럼)
function wallFields(a) {
    const n = a.map(x => +x);   // (ToNumber, in order, once: as the engine)
    const w = natUTC(...n);
    if (!Number.isNaN(w) || !n.every(Number.isFinite)) return w;
    const yi = Math.trunc(n[0]), y = yi >= 0 && yi <= 99 ? 1900 + yi : n[0];
    for (const k of [1, -1]) { const s = natUTC(y - 400 * k, ...n.slice(1)); if (!Number.isNaN(s)) return s + k * CYCLE; }
    return NaN;
}
function ZDate(...a) {
    if (!new.target) return zone === null ? N() : P.toString.call(new N(N.now()));
    let t;
    if (a.length === 0) t = N.now();
    else if (a.length === 1) {
        const had = isObj(a[0]) ? timeOf(a[0]) : undefined;
        if (had !== undefined) t = had;
        else { const p = toPrimitive(a[0]); t = typeof p === 'string' ? parse(p) : clip(+p); }
    } else t = zone === null ? nat.getTime.call(new N(...a)) : clip(fromWall(wallFields(a)));
    return Reflect.construct(N, [t], new.target);
}
Object.defineProperties(ZDate, {
    prototype: { value: P, writable: false, enumerable: false, configurable: false },
    length: { value: 7 }, name: { value: 'Date' },
    now: { value: function now() { return N.now(); }, writable: true, configurable: true },
    UTC: { value: natUTC, writable: true, configurable: true },
    parse: { value: function parse_(s) { return parse(s); }, writable: true, configurable: true },
});
Object.defineProperty(ZDate.parse, 'name', { value: 'parse' });

// ---- Date.prototype: 로컬 getter · setter · 글
const mine = {};
const def = (name, fn) => { mine[name] = fn; };
for (const [l, u] of [['getFullYear', 'getUTCFullYear'], ['getMonth', 'getUTCMonth'], ['getDate', 'getUTCDate'], ['getDay', 'getUTCDay'], ['getHours', 'getUTCHours'], ['getMinutes', 'getUTCMinutes'], ['getSeconds', 'getUTCSeconds'], ['getMilliseconds', 'getUTCMilliseconds']]) {
    def(l, function () {
        if (zone === null) return nat[l].call(this);
        const t = nat.getTime.call(this);
        if (Number.isNaN(t)) return NaN;
        const [d, y] = local(t);
        return nat[u].call(d) + (l === 'getFullYear' ? y : 0);
    });
}
def('getYear', function () { if (zone === null) return nat.getYear.call(this); const y = this.getFullYear(); return Number.isNaN(y) ? NaN : y - 1900; });
def('getTimezoneOffset', function () { if (zone === null) return nat.getTimezoneOffset.call(this); const t = nat.getTime.call(this); if (Number.isNaN(t)) return NaN; return Math.trunc((t - wallOf(t)) / 6e4) + 0; });
for (const [l, u] of [['setFullYear', 'setUTCFullYear'], ['setMonth', 'setUTCMonth'], ['setDate', 'setUTCDate'], ['setHours', 'setUTCHours'], ['setMinutes', 'setUTCMinutes'], ['setSeconds', 'setUTCSeconds'], ['setMilliseconds', 'setUTCMilliseconds']]) {
    def(l, function (...a) {
        if (zone === null) return nat[l].apply(this, a);
        const t = nat.getTime.call(this);
        // (setFullYear on an invalid date starts from +0 local; the others stay invalid)
        const w = Number.isNaN(t) ? (l === 'setFullYear' ? 0 : NaN) : wallOf(t);
        const n = a.map(x => +x);   // (ToNumber, in order, once: as the engine)
        // (near the end of Date's range — a wall time or a result past ±8.64e15 —: the setter on the wall time counted k·400 years nearer, moved
        //  back, as local(). setFullYear: the year it sets counted so, the date it starts from only inside the range — its year is replaced)
        const full = l === 'setFullYear', j = Math.abs(w) > LIM ? Math.sign(w) : 0;
        const at = k => { const r = nat[u].apply(new N(w - (full ? j : k) * CYCLE), full && n.length ? [n[0] - 400 * k, ...n.slice(1)] : n); return Number.isNaN(r) ? r : r + k * CYCLE; };
        let r = NaN;
        for (const k of j && !full ? [j] : [0, 1, -1]) { r = at(k); if (!Number.isNaN(r) || !Number.isFinite(w)) break; }
        const out = clip(fromWall(r));
        nat.setTime.call(this, out);
        return out;
    });
}
def('setYear', function (y) {
    if (zone === null) return nat.setYear.call(this, y);
    y = +y;   // (ToNumber: a BigInt throws, as the engine's)
    if (Number.isNaN(y)) { nat.setTime.call(this, NaN); return NaN; }
    const yi = Math.trunc(y);
    return this.setFullYear(yi >= 0 && yi <= 99 ? 1900 + yi : y);
});
// (as V8 writes them, in this zone. The name in brackets is in the default language, as V8's)
const pad = (n, l = 2) => String(n).padStart(l, '0');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const yearStr = y => (y < 0 ? '-' + pad(-y, 4) : pad(y, 4));
//  (V8 date.h LocalTimezone: before 1970 and after 2038 the name is the one of an equivalent year in 2008~2035 — same leap year, same
//   weekday of 1 January: EquivalentTime · EquivalentYear. V8 takes today's names — ICU getDisplayName —, Intl those of the instant's
//   own rules: a zone whose name changed since can differ in the brackets — Lord Howe in the 1970s. Only toString · toTimeString write it)
const MAX_EPOCH = 2147483647 * 1000;
const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
function equivalent(t) {
    const days = Math.floor(t / 864e5), within = t - days * 864e5, d = new N(days * 864e5);
    const y = nat.getUTCFullYear.call(d), wd = (((daysFrom(y, 1, 1) + 4) % 7) + 7) % 7;
    const recent = (isLeap(y) ? 1956 : 1967) + (wd * 12) % 28, ey = 2008 + (recent + 3 * 28 - 2008) % 28;
    return (daysFrom(ey, nat.getUTCMonth.call(d) + 1, 1) + nat.getUTCDate.call(d) - 1) * 864e5 + within;
}
const names = new Map();
function zoneName(t) {
    const k = `${LOC}|${zone}`;
    let f = names.get(k);
    if (f === undefined) { try { f = new NatDTF(LOC ?? undefined, { timeZone: zone, timeZoneName: 'long' }); } catch { f = null; } names.set(k, f); }
    try { return f?.formatToParts(new N(t < 0 || t > MAX_EPOCH ? equivalent(t) : t)).find(p => p.type === 'timeZoneName')?.value; } catch { return undefined; }
}
const offStr = t => { const o = Math.trunc(offAt(t) / 6e4), a = Math.abs(o); return `GMT${o < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}${pad(a % 60)}`; };
const dateStr = t => { const [d, y] = local(t); return `${DAYS[nat.getUTCDay.call(d)]} ${MONS[nat.getUTCMonth.call(d)]} ${pad(nat.getUTCDate.call(d))} ${yearStr(nat.getUTCFullYear.call(d) + y)}`; };
const timeStr = t => { const [d] = local(t), n = zoneName(t); return `${pad(nat.getUTCHours.call(d))}:${pad(nat.getUTCMinutes.call(d))}:${pad(nat.getUTCSeconds.call(d))} ${offStr(t)}${n ? ` (${n})` : ''}`; };
const strOf = (name, f) => def(name, function () { if (zone === null) return nat[name].call(this); const t = nat.getTime.call(this); if (Number.isNaN(t)) return 'Invalid Date'; return f(t); });
strOf('toString', t => `${dateStr(t)} ${timeStr(t)}`);
strOf('toDateString', dateStr);
strOf('toTimeString', timeStr);
// (no locale given: the language's. No timeZone in the options: this zone. Options are read through, as Intl reads them)
const locOf = l => (LOC !== null && (l === undefined || (Array.isArray(l) && l.length === 0)) ? LOC : l);
const withZone = o => (zone === null || o === null || (o !== undefined && Object(o).timeZone !== undefined) ? o : Object.create(o === undefined ? null : Object(o), { timeZone: { value: zone, enumerable: true } }));
for (const k of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']) def(k, function (l, o) { return nat[k].call(this, locOf(l), withZone(o)); });

// ---- Intl 생성자: 언어를 안 주면 그 언어, DateTimeFormat은 시간대도
function wrapIntl(C, zoned) {
    const W = function (l, o) {
        const a = [locOf(l), zoned ? withZone(o) : o];
        return new.target ? Reflect.construct(C, a, new.target === W ? C : new.target) : C(...a);
    };
    Object.defineProperties(W, { prototype: { value: C.prototype, writable: false, enumerable: false, configurable: false }, name: { value: C.name }, length: { value: C.length } });
    for (const k of Object.getOwnPropertyNames(C)) if (!['prototype', 'name', 'length'].includes(k)) Object.defineProperty(W, k, Object.getOwnPropertyDescriptor(C, k));
    return W;
}
const intlMine = Object.fromEntries(INTL.map(k => [k, wrapIntl(Intl[k], k === 'DateTimeFormat')]));
const protoMine = PROTOS.map(([, k], i) => {
    const f = protoDesc[i].value;
    // (localeCompare(that, locales, options) · toLocaleString(locales, options))
    return k === 'localeCompare' ? function localeCompare(that, l, o) { return f.call(this, that, locOf(l), o); } : function (l, ...rest) { return f.call(this, locOf(l), ...rest); };
});
// (the original's name and length: the wrappers look like the engine's own)
for (const [i, [, k]] of PROTOS.entries()) Object.defineProperties(protoMine[i], { name: { value: k }, length: { value: protoDesc[i].value.length } });
for (const [k, f] of Object.entries(mine)) Object.defineProperties(f, { name: { value: k }, length: { value: natDesc[k].value.length } });

// ---- 끼우기 (한 번, 되돌리지 않아요: 위의 규칙)
let on = false;
function install() {
    if (on) return;
    if (isMainThread && !process.env.NA_SCREEN_ANYWHERE) throw new Error('plugin/zone.mjs는 작업 스레드에서만 시간대 · 언어를 바꿀 수 있습니다.');
    for (const [k, f] of Object.entries(mine)) Object.defineProperty(P, k, { ...natDesc[k], value: f });
    Object.defineProperty(P, 'constructor', { ...natDesc.constructor, value: ZDate });
    Object.defineProperty(globalThis, 'Date', { ...globalDesc, value: ZDate });
    for (const k of INTL) {
        Object.defineProperty(Intl, k, { ...intlDesc[k], value: intlMine[k] });
        // (new Intl.X().constructor === Intl.X, as Date's above)
        Object.defineProperty(intlMine[k].prototype, 'constructor', { ...Object.getOwnPropertyDescriptor(intlMine[k].prototype, 'constructor'), value: intlMine[k] });
    }
    for (const [i, [o, k]] of PROTOS.entries()) Object.defineProperty(o, k, { ...protoDesc[i], value: protoMine[i] });
    on = true;
}
// (the new values are kept only once they are in: a refused one changes nothing. The main thread — tests only — is not changed for null)
function settle(z, l) {
    if (z !== null || l !== null) install();
    zone = z; LOC = l;
}
// (a worker thread: in from the start)
if (!isMainThread) install();

// 이 스레드의 시간대 → ICU가 쓰는 이름 | null (서버 컴퓨터의 것)
export function setZone(tz) {
    settle(tz === null || tz === undefined || tz === '' ? null : new NatDTF('en-US', { timeZone: String(tz) }).resolvedOptions().timeZone, LOC);
    return zone;
}
// 이 스레드의 기본 언어 → 정리한 이름 | null (서버의 것)
export function setLocale(locale) {
    settle(zone, locale === null || locale === undefined || locale === '' ? null : Intl.getCanonicalLocales(String(locale))[0]);
    return LOC;
}
// 실리 서버의 코드를 옮긴 것을 실리 서버처럼 서버 컴퓨터의 시간대 · 언어로: fn이 도는 동안만 → fn의 값.
// 동기로만 써요: fn이 돌려준 promise의 await 뒤(남은 부분)는 이 스레드의 것으로 돌아요. 동기라서 그사이 다른 코드가 끼어들지 않아요
export function atServer(fn) {
    const z = zone, l = LOC;
    zone = null; LOC = null;
    try { return fn(); } finally { zone = z; LOC = l; }
}
export const getZone = () => zone;
export const getLocale = () => LOC;
