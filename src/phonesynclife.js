// 새로 일어난 일 반영 · 생활 (시계 · 건강 · 파일 · 날씨): what the new messages did to the everyday apps, and what the
// story's clock moving on does to them. Like the money side, every change is listed in `effects` (what went in, and
// what a changed record was before), so 되돌리기 and 빼기 can take it back and 복구 can put it back; a record the user
// changed since stays as it is.
// The model's records are cleaned here too, for the first fill (phonelife.js) and for a reflection alike.
import { arr, hhmm, ko, line, num, pad, pick, when, withEv } from './phoneparse.js';
import { appOf, kindOfApp } from './phonescreen.js';

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const CONDS = ['clear', 'partly', 'cloudy', 'drizzle', 'rain', 'sleet', 'snow', 'fog', 'storm', 'wind'];
export const FILE_KINDS = ['pdf', 'image', 'video', 'audio', 'zip', 'doc', 'sheet', 'slides', 'other'];
const int = (v, lo, hi) => { const n = num(v); return n === null ? null : Math.max(lo, Math.min(hi, Math.round(n))); };
const yes = v => v === true;
const day5 = v => when(v).slice(0, 5);
const tz = v => (/^[A-Za-z]+(?:\/[A-Za-z_+-]+){1,2}$/.test(String(v || '')) ? String(v) : '');

// ---- cleaning one record
// an alarm's repeat days as the model writes them: ["mon", …], Korean, German or Japanese day names, or one word ("weekdays", "매일")
const DAY_WORD = { 월: 'mon', 화: 'tue', 수: 'wed', 목: 'thu', 금: 'fri', 토: 'sat', 일: 'sun', mo: 'mon', di: 'tue', mi: 'wed', do: 'thu', fr: 'fri', sa: 'sat', so: 'sun', 月: 'mon', 火: 'tue', 水: 'wed', 木: 'thu', 金: 'fri', 土: 'sat', 日: 'sun' };
const daysOf = v => {
    const one = String(Array.isArray(v) ? (v.length === 1 ? v[0] : '') : v || '').trim().toLowerCase();
    if (/^(daily|every ?day|매일|täglich|毎日)$/.test(one)) return [...DAYS];
    if (/^(weekdays?|평일|werktags|wochentags|平日)$/.test(one)) return DAYS.slice(0, 5);
    if (/^(weekends?|주말|wochenende|週末)$/.test(one)) return DAYS.slice(5);
    // a range ("mon-fri", "월~금", "Mo bis Fr") is every day from the one to the other
    const tok = d => { const s = String(d).trim().toLowerCase(); return DAYS.includes(s.slice(0, 3)) ? s.slice(0, 3) : DAY_WORD[s.replace(/요일$|曜日?$/, '').slice(0, 2)] || DAY_WORD[s.slice(0, 1)] || ''; };
    const ranged = String(Array.isArray(v) ? v.join(',') : v || '').replace(/([^\s,·/~\-–—]+)\s*(?:-|~|–|—|\bto\b|\bbis\b|부터)\s*([^\s,·/~\-–—]+)/g, (m, a, b) => { const i = DAYS.indexOf(tok(a)), j = DAYS.indexOf(tok(b)); return i < 0 || j < 0 ? m : (i <= j ? DAYS.slice(i, j + 1) : [...DAYS.slice(i), ...DAYS.slice(0, j + 1)]).join(','); });
    const out = arr(ranged.split(/[\s,·/]+/)).map(d => { const s = String(d).trim().toLowerCase(); return DAYS.includes(s.slice(0, 3)) ? s.slice(0, 3) : DAY_WORD[s.replace(/요일$|曜日?$/, '').slice(0, 2)] || DAY_WORD[s.slice(0, 1)]; }).filter(Boolean);
    return DAYS.filter(d => out.includes(d));
};
const off = v => v === false || /^(false|off|no|aus|꺼짐|끔)$/i.test(String(v ?? '').trim());
export const alarmOf = a => withEv({ time: hhmm(a?.time), label: line(a?.label, 60), ko: ko(a?.ko), days: daysOf(a?.days), date: day5(a?.date),
    on: !off(a?.on), wake: yes(a?.wake), then: arr(a?.then).map(hhmm).filter(Boolean).slice(0, 10), snooze: int(a?.snooze, 0, 60) ?? 0, snoozeCount: int(a?.snoozeCount, 0, 20) ?? 0, sound: line(a?.sound, 30), made: day5(a?.made) }, a);
// a file's kind: the model's, or what an extension says (it may write "png" for the kind, or leave it out)
const EXT_KIND = [[/^(png|jpe?g|heic|gif|webp|bmp|tiff?|raw)$/i, 'image'], [/^(mp4|mov|avi|mkv|webm|m4v)$/i, 'video'], [/^(mp3|m4a|wav|aac|flac|ogg|amr)$/i, 'audio'],
    [/^(zip|rar|7z|tar|gz)$/i, 'zip'], [/^(docx?|odt|rtf|txt|pages|hwp|hwpx)$/i, 'doc'], [/^(xlsx?|csv|ods|numbers)$/i, 'sheet'], [/^(pptx?|odp|key)$/i, 'slides'], [/^pdf$/i, 'pdf']];
const kindOf = (k, name) => { if (FILE_KINDS.includes(k)) return k; for (const v of [k, (String(name || '').match(/\.([a-z0-9]{2,5})$/i) || [])[1]]) { const hit = EXT_KIND.find(([re]) => re.test(String(v || ''))); if (hit) return hit[1]; } return 'other'; };
// a size in KB: a number is KB; "1.2 MB", "3 GB", "800 KB" by their unit
const kbOf = v => { const n = num(v); if (n === null) return null; const u = String(v ?? '').match(/([kmg])i?b\b|([kmg])바이트/i); const k = (u?.[1] || u?.[2] || 'k').toLowerCase(); return Math.round(n * (k === 'g' ? 1048576 : k === 'm' ? 1024 : 1)); };
export const fileOf = x => withEv({ name: line(x?.name, 80), kind: kindOf(String(x?.kind || '').toLowerCase().replace(/^\./, ''), x?.name), folder: (f => (!f || /^(downloads?|download folder|다운로드|下载|ダウンロード|téléchargements|descargas|transferências|загрузки|scaricati)$/i.test(f) ? 'Downloads' : f))(line(x?.folder, 40)), size: kbOf(x?.size), time: when(x?.time), from: line(x?.from, 60),
    pages: int(x?.pages, 0, 2000), length: line(x?.length, 8), tag: pick(x?.tag, ['red', 'orange'], ''), private: yes(x?.private), preview: yes(x?.private) ? '' : line(x?.preview, 160), look: line(x?.look, 20).toLowerCase(), ko: ko(x?.ko), opened: when(x?.opened), trashed: day5(x?.trashed) }, x);
// 스크린타임: that day's phone use, as the model writes it ({ "apps": { name: minutes }, "pickups", "late" }; a list of
// { app, min } too). A day never holds more than its 24 hours; nothing given is none (the screen works it out)
export const SCREEN_KINDS = ['chat', 'social', 'game', 'video', 'music', 'work', 'reading', 'shopping', 'other'];
export function screenOf(v) {
    if (!v || typeof v !== 'object') return null;
    const pairs = Array.isArray(v.apps) ? v.apps.map(x => [x?.app ?? x?.name, x?.min]) : v.apps && typeof v.apps === 'object' ? Object.entries(v.apps) : [];
    const apps = {};
    for (const [k, m] of pairs) { const name = appName(k), n = int(m, 0, 1440); if (name && n !== null && n > 0) apps[name] = (apps[name] || 0) + n; }
    const total = Object.values(apps).reduce((a, b) => a + b, 0);
    if (total > 1440) for (const k of Object.keys(apps)) apps[k] = Math.round(apps[k] * 1440 / total);
    const o = {};
    if (Object.keys(apps).length) o.apps = Object.fromEntries(Object.entries(apps).sort((a, b) => b[1] - a[1]).slice(0, 12));
    const pk = int(v.pickups, 0, 1000), late = hhmm(v.late);
    if (pk !== null) o.pickups = pk;
    if (late) o.late = late;
    return Object.keys(o).length ? o : null;
}
// an app's name as the phone shows it ("인스타" is Instagram), so its icon and its minutes are one app
const appName = v => { const n = line(v, 40); return n ? appOf(n)?.name || n : ''; };
// the reflection's change to their usual: apps put in or used more or less ("add"; 0 minutes is gone), apps they deleted
// ("drop"), the rest as it was. A whole list ("apps") is taken as adds too, so an app it left out is never lost
export function screenChange(was, ch) {
    if (!ch || typeof ch !== 'object') return null;
    const apps = new Map((was?.apps || []).map(a => [a.app, { ...a }])), now = new Map((was?.sometimes || []).map(a => [a.app, { ...a }]));
    for (const x of [...arr(ch.apps), ...arr(ch.add)]) {
        const app = appName(x?.app ?? x?.name), m = int(x?.min, 0, 1440);
        if (!app) continue;
        if (m === 0) { apps.delete(app); now.delete(app); continue; }
        // an app they opened now and then that they now use every day moves up
        const k = String(x?.kind || '').toLowerCase(), old = apps.get(app) || now.get(app);
        now.delete(app);
        apps.set(app, { app, kind: SCREEN_KINDS.includes(k) ? k : old?.kind || kindOfApp(app), min: m ?? old?.min ?? 30 });
    }
    for (const d of arr(ch.drop)) { const app = appName(typeof d === 'string' ? d : d?.app ?? d?.name); apps.delete(app); now.delete(app); }
    return usualScreenOf({ apps: [...apps.values()], sometimes: [...now.values()], pickups: ch.pickups ?? was?.pickups, late: ch.late || was?.late });
}
// their usual phone use as the reflection reads it: names and minutes only, short ("WhatsApp 48, Gmail 62 · sometimes:
// Tinder 14 · pickups 84 · late 23:55"); thirty apps cost what a dozen did as JSON, and the kinds are the code's to know
export const screenLine = v => (v && typeof v === 'object' ? [(v.apps || []).map(a => `${a.app} ${a.min}`).join(', '), v.sometimes?.length ? `sometimes: ${v.sometimes.map(a => `${a.app} ${a.min}`).join(', ')}` : '',
    v.pickups != null ? `pickups ${v.pickups}` : '', v.late ? `late ${v.late}` : ''].filter(Boolean).join(' · ') : v);
// their usual phone use: each app with its kind and minutes a day, pickups, the time they usually last look at it
export function usualScreenOf(v) {
    if (!v || typeof v !== 'object') return null;
    const seen = new Set(), list = (xs, max) => arr(xs).map(x => { const app = appName(x?.app ?? x?.name); return { app, kind: pick(String(x?.kind || '').toLowerCase(), SCREEN_KINDS, kindOfApp(app)), min: int(x?.min, 0, 1440) }; })
        .filter(x => x.app && x.min !== null && x.min > 0 && !seen.has(x.app) && seen.add(x.app)).sort((a, b) => b.min - a.min).slice(0, max);
    // every day's apps, then the ones they open now and then (minutes on a day they do)
    const apps = list(v.apps, 16), sometimes = list(v.sometimes, 18), pk = int(v.pickups, 0, 1000), late = hhmm(v.late);
    return apps.length || pk !== null || late ? { apps, ...(sometimes.length ? { sometimes } : {}), ...(pk !== null ? { pickups: pk } : {}), ...(late ? { late } : {}) } : null;
}
// a day's workouts (a run in the morning, yoga at night): the list, in the day's order, the same one once; "workout" is
// the longest, for a screen that shows one (and an older row that has only it)
const workoutOne = w => (w && typeof w === 'object' && line(w.kind, 30) ? { kind: line(w.kind, 30), time: hhmm(w.time), min: int(w.min, 0, 600), km: num(w.km) } : null);
const workoutKey = w => `${String(w.kind).toLowerCase()}|${w.time || ''}`;
export function workoutList(...lists) {
    const out = new Map();
    for (const w of lists.flat().map(workoutOne).filter(Boolean)) { const k = workoutKey(w), o = out.get(k); out.set(k, o ? { ...o, ...Object.fromEntries(Object.entries(w).filter(([, v]) => v !== null && v !== '')), kind: o.kind } : w); }
    return [...out.values()].sort((a, b) => String(a.time || '99').localeCompare(String(b.time || '99'))).slice(0, 6);
}
const longest = ws => ws.reduce((a, w) => (!a || (w.min ?? 0) > (a.min ?? 0) ? w : a), null);
const workoutsOf = d => { const ws = workoutList(arr(d?.workouts), d?.workout ? [d.workout] : []); return { workout: longest(ws), ...(ws.length ? { workouts: ws } : {}) }; };
export const dayOf = d => withEv({ date: day5(d?.date), bed: hhmm(d?.bed), sleep: hhmm(d?.sleep), wake: hhmm(d?.wake), woke: int(d?.woke, 0, 30) ?? 0, steps: int(d?.steps, 0, 120000), km: num(d?.km), floors: int(d?.floors, 0, 400),
    ...workoutsOf(d),
    hr: arr(d?.hr).map(x => int(x, 30, 220)).filter(x => x !== null).slice(0, 2), from: pick(d?.from, ['story', 'pattern'], 'pattern'),
    // that day's coffee, water and weight when the model gives them (else the screens use their usual)
    ...dayExtras(d) }, d);
const dayExtras = d => { const o = {}, c = int(d?.coffee, 0, 15), w = num(d?.water), kg = num(d?.weight), sc = screenOf(d?.screen); if (sc) o.screen = sc; if (c !== null) o.coffee = c; const ck = line(d?.coffeeKind, 30); if (ck) o.coffeeKind = ck; if (w !== null && w > 0 && w <= 8) o.water = Math.round(w * 10) / 10; if (kg !== null && kg >= 25 && kg <= 300) o.weight = Math.round(kg * 10) / 10; return o; };
// a chance of rain in percent; a model writing millimetres (0.4, 1.2) is read as a chance: a trace may rain, a millimetre will
const rainPct = v => { const n = num(v); if (n === null) return null; if (!Number.isInteger(n) && n < 10) return n <= 0 ? 0 : n < 1 ? 40 : 70; return Math.max(0, Math.min(100, Math.round(n))); };
const cityOf = c => ({ name: line(c?.name, 40), ko: ko(c?.ko), tz: tz(c?.tz), cond: condPick(c?.cond, 'cloudy', { temp: int(c?.temp, -60, 60) }), temp: int(c?.temp, -60, 60), hi: int(c?.hi, -60, 60), lo: int(c?.lo, -60, 60), sunrise: hhmm(c?.sunrise), sunset: hhmm(c?.sunset),
    rainNext: num(c?.rainNext), wind: num(c?.wind), gust: num(c?.gust), dir: line(c?.dir, 12), feels: int(c?.feels, -60, 60), humidity: int(c?.humidity, 0, 100), dew: int(c?.dew, -60, 60), visibility: num(c?.visibility), note: line(c?.note, 40), noteKo: ko(c?.noteKo) });

// ---- 날씨: the chat's status line stands; the model's numbers only fill what it doesn't say
// Korean "비" (rain) and "눈" (snow) count only as a word of their own ("비", "비 옴", "비가", "눈이 내림"), never inside
// another word ("비행기", "눈부신")
const RAIN_KO = '(?<![가-힣])비(?:(?![가-힣])|(?=[가옴와]))', SNOW_KO = '(?<![가-힣])눈(?:(?![가-힣])|(?=[이옴발]))';
// the sky in any words a status line or a model may use: emoji, a word's forms ("rainy", "흐린", "bewölkt"), Korean,
// English, German, French, Spanish, Japanese, Chinese. The worst weather named wins ("흐리고 비" is rain)
const COND_RE = [['storm', /storm|thunder|lightning|[⛈🌩]|뇌우|천둥|번개|gewitter|orage|tormenta|雷/iu], ['sleet', /sleet|freezing rain|진눈깨비|어는 ?비|schneeregen|霙|みぞれ|雨夹雪|雨雪/iu],
    ['snow', new RegExp(`snow|blizzard|[❄🌨☃⛄]|폭설|함박눈|눈보라|눈송이|${SNOW_KO}|schnee|neige|nieve|雪`, 'iu')], ['drizzle', /drizzl|light rain|이슬비|가랑비|보슬비|부슬비|nieselregen|bruine|llovizna|霧雨|小雨|细雨/iu],
    ['rain', new RegExp(`rain|shower|downpour|[🌧☔]|소나기|장대비|폭우|호우|장마|빗방울|빗줄기|${RAIN_KO}|regen|pluie|lluvia|雨`, 'iu')], ['fog', /fog|mist|haz[ey]|[🌫]|안개|연무|박무|nebel|brouillard|niebla|霧|雾|霞/iu],
    ['wind', /gale|gust|strong wind|windy|[💨🌬]|강풍|돌풍|바람이? ?(?:세|강|많|쌩)|sturm|stürmisch|windig|venteux|ventoso|強風|大风|强风/iu], ['partly', /partly|some clouds|mostly sunny|sun and clouds|[🌤⛅🌥]|구름 ?(?:조금|약간)|대체로 맑|teils|heiter|wolkig mit sonne|éclaircies|parcialmente|晴れ時々|晴时多云|多云转晴|晴間/iu],
    ['cloudy', /cloud|overcast|grey sky|gray sky|[☁]|흐림|흐린|흐려|흐리|구름|잔뜩|구름 ?많|bewölkt|wolk|bedeckt|nuageux|couvert|nublado|曇|阴|多云/iu], ['clear', /clear|sunn?y|sunshine|fine|bright|[☀🌞🌝]|맑|화창|쾌청|햇살|햇빛|햇볕|쨍쨍|sonnig|klar|ensoleillé|soleil|despejado|soleado|晴|快晴/iu]];
// weather that has passed ("비가 그치고 맑음", "after the rain", "雨上がり") doesn't name the sky now
const OVER = /(?:비|눈)[가이]?\s*(?:그치|그쳤|그침|그쳐|멈추|멈췄|멎)[^,.;· ]*|(?:rain|snow)(?:ing)?\s*(?:has\s+)?(?:stopped|cleared|ended|is over)|after\s+the\s+(?:rain|snow|storm)|雨上がり|雨が(?:止|やん)|雨停/giu;
export const condOf = text => { const s = String(text || ''), t = s.replace(OVER, ' '); return COND_RE.find(([, re]) => re.test(t))?.[0] || (t !== s ? 'partly' : ''); };
// a sky the model names outside the list ("sunny", "맑고 쌀쌀", "小雨"): read like a status line; else what the numbers say,
// else cloudy. temp and rain (a chance of rain, %) are optional
export const condGuess = (temp, rain = null) => {
    if (!Number.isFinite(temp)) return '';
    if (Number.isFinite(rain) && rain >= 50) return temp <= 1 ? 'snow' : 'rain';
    return temp >= 24 ? 'clear' : temp >= 12 ? 'partly' : 'cloudy';
};
export const condPick = (v, dflt = 'cloudy', { temp = null, rain = null } = {}) => (CONDS.includes(v) ? v : condOf(v) || condGuess(temp, rain) || dflt);
// "3°C", "-2°", "영하 2도", "11도"; "72°F" and "72℉" are Fahrenheit, kept in Celsius
const tempOf = text => { const s = String(text || ''), mt = s.match(/(영하\s*)?([-−]?\d{1,3}(?:[.,]\d)?)\s*(?:°\s*([CF])?|(℃)|(℉)|도(?![가-힣]))/i); if (!mt) return null; let n = Number(mt[2].replace('−', '-').replace(',', '.')); if (mt[5] || String(mt[3] || '').toUpperCase() === 'F') n = (n - 32) * 5 / 9; n = Math.round(n); return mt[1] ? -Math.abs(n) : n; };
// the day's high and low hold the temperature now (a status line's 11° over a model's high of 9°)
const fit = h => { if (Number.isFinite(h.temp)) { if (!Number.isFinite(h.hi) || h.hi < h.temp) h.hi = h.temp; if (!Number.isFinite(h.lo) || h.lo > h.temp) h.lo = h.temp; for (const d of h.days || []) if (d.day === h.date) { if (Number.isFinite(d.hi) && d.hi < h.temp) d.hi = h.temp; if (Number.isFinite(d.lo) && d.lo > h.temp) d.lo = h.temp; } } return h; };
// a status line (scenes.js recentTrackers) as the weather it gives, or null
// its time from the minutes the reader worked out ("오후 7:00" is 19:00); its place the city alone ("서울, Mara의 집" is 서울)
export function weatherFrom(t) {
    if (!t || !(t.place || t.weather)) return null;
    const time = Number.isFinite(t.min) ? `${pad(Math.floor(t.min / 60))}:${pad(t.min % 60)}` : hhmm(t.time);
    return { date: t.date || '', time, place: String(t.city || t.place || '').split(/\s*[,，→>/·]\s*/)[0].trim(), weather: t.weather || '' };
}
const hereOf = h => ({
    place: line(h.place, 60), date: day5(h.date), time: hhmm(h.time), from: pick(h.from, ['tracker', 'chat', 'archive', 'guess'], 'guess'),
    cond: condPick(h.cond, 'cloudy', { temp: int(h.temp, -60, 60), rain: int(arr(h.hours)[0]?.rain, 0, 100) }), temp: int(h.temp, -60, 60), hi: int(h.hi, -60, 60), lo: int(h.lo, -60, 60), line: line(h.line, 160), ko: ko(h.ko),
    hours: arr(h.hours).map(x => ({ time: hhmm(x?.time), cond: condPick(x?.cond, 'cloudy', { temp: int(x?.temp, -60, 60), rain: rainPct(x?.rain) }), temp: int(x?.temp, -60, 60), rain: rainPct(x?.rain) ?? 0 })).filter(x => x.time).slice(0, 6),
    days: arr(h.days).map(x => ({ day: day5(x?.day), cond: condPick(x?.cond, 'cloudy', { temp: int(x?.hi, -60, 60), rain: rainPct(x?.rain) }), lo: int(x?.lo, -60, 60), hi: int(x?.hi, -60, 60), rain: rainPct(x?.rain) ?? 0 })).filter(x => x.day).slice(0, 10),
    tiles: Object.fromEntries(['rain24', 'rainNext', 'feels', 'wind', 'gust', 'humidity', 'dew', 'visibility'].map(k => [k, num(h.tiles?.[k])]).concat([['dir', line(h.tiles?.dir, 12)], ['sunrise', hhmm(h.tiles?.sunrise)], ['sunset', hhmm(h.tiles?.sunset)]])),
});
// the status line over a weather "here": its date, time, place and weather stand
// fresh: the model's own answer, whose whole forecast was shaped around its temperature; a status line's other reading
// moves that shape with it (the high, the low, the hours, today's row). Either way the felt temperature and the dew point
// follow the temperature now
function overlay(here, now, fresh = false) {
    if (!now) return here;
    here.from = 'tracker';
    if (now.place) here.place = line(now.place, 60);
    if (/^\d{2}-\d{2}/.test(when(now.date))) here.date = day5(now.date);
    if (now.time) here.time = hhmm(now.time);
    const c = condOf(now.weather), t = tempOf(now.weather), t0 = here.temp, c0 = here.cond;
    if (c) here.cond = c;
    // a sentence written for another sky or temperature no longer describes this one
    if (c && c !== c0 || t !== null && Number.isFinite(t0) && Math.abs(t - t0) >= 4) { here.line = ''; here.ko = ''; }
    if (t !== null) {
        here.temp = t;
        const d = Number.isFinite(t0) ? t - t0 : 0, mv = (o, k) => { if (Number.isFinite(o?.[k])) o[k] = o[k] + d; };
        if (d && here.tiles) { mv(here.tiles, 'feels'); mv(here.tiles, 'dew'); }
        if (d && fresh) { mv(here, 'hi'); mv(here, 'lo'); for (const x of here.hours || []) mv(x, 'temp'); for (const x of here.days || []) if (x.day === here.date) { mv(x, 'hi'); mv(x, 'lo'); } }
    }
    here.said = line(now.weather, 60);
    return here;
}
// a Korean copy that only repeats the line (a Korean line given the same "ko") would show twice
const unko = h => { if (h.ko && h.line && h.ko.replace(/\s+/g, ' ').trim() === h.line.replace(/\s+/g, ' ').trim()) h.ko = ''; return unline(h); };
// a "line" that is no more than the sky's name ("흐림", "Cloudy") says what the header already says
const unline = h => { const l = String(h.line || '').replace(/(영하\s*)?[-−]?\d{1,3}(?:[.,]\d)?\s*(?:°\s*[CF]?|℃|℉|도(?![가-힣]))/gi, '').replace(/기온|temperature|temp\b|현재|지금|now|currently/gi, '').replace(/[\s,.·/|()~-]+/g, ' ').trim(); if (l && l.length <= 8 && condOf(l) === h.cond) { h.line = ''; h.ko = ''; } return h; };
// the saved city a place names (by its name or its Korean name): two places in two different saved cities are apart,
// and the status line (the scene's) doesn't stand over an owner the model puts in the other
// (by whole words: "Frankfurt · Küche" is Frankfurt am Main, "서울역" Seoul; "LA" is not Milan, "Ren" not Florence)
const wordsOf = v => String(v || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean), leads = ws => ws.map((_, i) => ws.slice(0, i + 1).join(''));
const sameCity = (place, name) => { const p = wordsOf(place), n = wordsOf(name), pj = p.join(''), nj = n.join(''), head = wordsOf(String(place || '').split(/\s*[·|,/→>]\s*/)[0]).join(''); return !!pj && !!nj && (leads(p).includes(nj) || leads(n).includes(pj) || !!head && leads(n).includes(head) || /^\p{Script=Hangul}/u.test(nj) && pj.startsWith(nj)); };
// (else a later piece of the place, "Gangnam, Seoul", "Kreuzberg · Berlin", when only one saved city is named there)
export const cityAt = (place, cities) => {
    const pk = wordsOf(place).join(''), of = t => arr(cities).find(c => [c?.name, c?.ko].filter(Boolean).some(n => sameCity(t, n))) || null;
    if (!pk) return null;
    const first = of(place);
    if (first) return first;
    const hits = [...new Set(String(place || '').split(/\s*[·|,/→>]\s*/).slice(1).map(of).filter(Boolean))];
    return hits.length === 1 ? hits[0] : null;
};
// the saved city the owner is in carries the same weather as "here" (the model may leave it as it was)
export function mirrorHome(w) {
    const h = w?.here, c = h && cityAt(h.place, w.cities);
    if (!c) return w;
    for (const k of ['cond', 'temp', 'hi', 'lo']) if (h[k] !== null && h[k] !== undefined && h[k] !== '') c[k] = h[k];
    for (const k of ['sunrise', 'sunset', 'rainNext', 'wind', 'gust', 'dir', 'feels', 'humidity', 'dew', 'visibility']) { const v = h.tiles?.[k]; if (v !== null && v !== undefined && v !== '') c[k] = v; }
    return w;
}
export const apart = (a, b, cities) => { const x = cityAt(a, cities), y = cityAt(b, cities); return !!(x && y && x !== y); };
// a country's main time zone (a country with several: its biggest city's)
export const COUNTRY_TZ = { KR: 'Asia/Seoul', JP: 'Asia/Tokyo', CN: 'Asia/Shanghai', TW: 'Asia/Taipei', HK: 'Asia/Hong_Kong', SG: 'Asia/Singapore', TH: 'Asia/Bangkok', VN: 'Asia/Ho_Chi_Minh', ID: 'Asia/Jakarta', PH: 'Asia/Manila', MY: 'Asia/Singapore', IN: 'Asia/Kolkata', AE: 'Asia/Dubai', IL: 'Asia/Jerusalem', TR: 'Europe/Istanbul', RU: 'Europe/Moscow',
    GB: 'Europe/London', IE: 'Europe/Dublin', PT: 'Europe/Lisbon', ES: 'Europe/Madrid', FR: 'Europe/Paris', BE: 'Europe/Brussels', NL: 'Europe/Amsterdam', DE: 'Europe/Berlin', CH: 'Europe/Zurich', AT: 'Europe/Vienna', IT: 'Europe/Rome', CZ: 'Europe/Prague', PL: 'Europe/Warsaw', DK: 'Europe/Copenhagen', SE: 'Europe/Stockholm', NO: 'Europe/Oslo', FI: 'Europe/Helsinki', GR: 'Europe/Athens', UA: 'Europe/Kyiv', IS: 'Atlantic/Reykjavik',
    EG: 'Africa/Cairo', NG: 'Africa/Lagos', KE: 'Africa/Nairobi', ZA: 'Africa/Johannesburg', MA: 'Africa/Casablanca', US: 'America/New_York', CA: 'America/Toronto', MX: 'America/Mexico_City', CO: 'America/Bogota', PE: 'America/Lima', BR: 'America/Sao_Paulo', AR: 'America/Buenos_Aires', CL: 'America/Santiago', AU: 'Australia/Sydney', NZ: 'Pacific/Auckland' };
// a "MM-DD HH:MM" of one zone in another (Intl knows the rules; the year is the phone's, else this one)
export function zoneShift(at, from, to, year = new Date().getFullYear()) {
    const mt = /^(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(String(at || ''));
    if (!mt || !from || !to || from === to) return at;
    try {
        const parts = (tz, d) => { const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d), g = k => Number(f.find(x => x.type === k)?.value); return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute')); };
        const guess = new Date(Date.UTC(year, mt[1] - 1, mt[2], mt[3], mt[4]));
        // the offset at the moment itself, not at the wall time read as UTC (a summer-time change between the two)
        let utc = guess.getTime() - (parts(from, guess) - guess.getTime());
        utc = guess.getTime() - (parts(from, new Date(utc)) - utc);
        const local = new Date(parts(to, new Date(utc)));
        return `${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
    } catch { return at; }
}
// the newest status line over the saved weather, for the screen alone (nothing is saved): a day or hours later than it
export const overlayNow = (here, now) => fit(unline(overlay(structuredClone(here), now)));
// a saved forecast moved on to a later status line (its hours and highs with the temperature): a fill's second turn that
// wrote no weather of its own
export const overlayFresh = (here, now) => fit(unko(overlay(structuredClone(here), now, true)));
export function parseWeather(w, now) {
    return { here: fit(unko(overlay(hereOf(w?.here || {}), now, true))), cities: arr(w?.cities).map(cityOf).filter(c => c.name).slice(0, 5) };
}

// ---- story days: "MM-DD" without a year; a gap across New Year is taken the short way round
// (02-29, a leap day, sits between 02-28 and 03-01: half a day from each, so it is neither of them; other years count as
// 365 days)
const dnum = s => { const mt = /^(\d{2})-(\d{2})/.exec(String(s || '')); return !mt ? NaN : mt[1] === '02' && mt[2] === '29' ? Date.UTC(2001, 2, 1) / 864e5 - 0.5 : Date.UTC(2001, mt[1] - 1, mt[2]) / 864e5; };
export const dayGap = (a, b) => { let g = dnum(b) - dnum(a); if (g < -180) g += 365; if (g > 180) g -= 365; return Math.sign(g) * Math.ceil(Math.abs(g)); };

// ---- effects on any record list of the phone, by path ("life.clock.alarms", "delivery.orders", "money.tx")
const walk = (p, path, make) => {
    const ks = path.split('.'), last = ks.pop();
    let o = p;
    for (const k of ks) { if (!o?.[k]) { if (!make) return null; o[k] = {}; } o = o[k]; }
    if (!o) return null;
    if (make && o[last] === undefined) o[last] = [];
    return { parent: o, key: last };
};
export const boxAt = (p, path, make = false) => { const w = walk(p, path, make); return w ? w.parent[w.key] : null; };
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const fields = (r, keys) => Object.fromEntries(keys.map(k => [k, r[k] === undefined ? null : structuredClone(r[k])]));
const setFields = (r, vals) => { for (const [k, v] of Object.entries(vals)) if (v === null) delete r[k]; else r[k] = structuredClone(v); };
// change: fields of one record (from → to); set: a whole value (the weather); drop: a record taken out (by the clock)
// unchanged since the round: an id put on a record after it (a saved city, a new day: ids are given when the phone is
// saved) is no change
const bareIds = (now, was) => {
    if (Array.isArray(now)) return now.map((x, i) => bareIds(x, Array.isArray(was) ? was[i] : undefined));
    if (!now || typeof now !== 'object') return now;
    const out = {};
    for (const [k, v] of Object.entries(now)) if (!(k === 'id' && (!was || typeof was !== 'object' || !('id' in was)))) out[k] = bareIds(v, was && typeof was === 'object' ? was[k] : undefined);
    return out;
};
const sameSince = (now, was) => same(bareIds(now ?? null, was), was);
export function lifeRevert(p, x) {
    if (x.type === 'change') { const r = boxAt(p, x.path)?.find(o => o.id === x.id); if (!r) return true; if (!Object.keys(x.to).every(k => sameSince(r[k] ?? null, x.to[k]))) return false; setFields(r, x.from); return true; }
    if (x.type === 'set') { const w = walk(p, x.path); if (!w) return true; if (!sameSince(w.parent[w.key], x.to)) return false; if (x.from === null) delete w.parent[w.key]; else w.parent[w.key] = structuredClone(x.from); return true; }
    if (x.type === 'drop') { const box = boxAt(p, x.path, true); if (!box.some(o => o.id === x.item.id)) box.push(structuredClone(x.item)); return true; }
    return null;
}
export function lifeReplay(p, x) {
    if (x.type === 'change') { const r = boxAt(p, x.path)?.find(o => o.id === x.id); if (r && Object.keys(x.from).every(k => same(r[k] ?? null, x.from[k]))) setFields(r, x.to); return true; }
    if (x.type === 'set') { const w = walk(p, x.path, false); if (w && same(w.parent[w.key] ?? null, x.from)) w.parent[w.key] = structuredClone(x.to); return true; }
    if (x.type === 'drop') { const box = boxAt(p, x.path); const i = box ? box.findIndex(o => o.id === x.item.id) : -1; if (i >= 0) box.splice(i, 1); return true; }
    return null;
}

// ---- one event's alarms, files and health days (e.phone's "alarms", "files", "health")
// e: { id, at, date }; on: the everyday apps were made before this message (else they already hold it)
// a day still going (the phone's today) told again later the same day: what adds up over a day (steps, distance,
// floors, coffee, water, each app's minutes, pickups) never goes down from what was there (the model writes the totals so
// far; a lower one is it forgetting the morning). 되돌리기 takes it back like any change
const GROWS = ['steps', 'km', 'floors', 'coffee', 'water'];
export function soFar(was, vals) {
    const out = { ...vals };
    for (const k of GROWS) if (finiteNum(was?.[k]) && finiteNum(out[k]) && out[k] < was[k]) out[k] = was[k];
    // the day's workouts so far: the ones there and the new ones; its heart range only widens
    if (out.workouts || out.workout) { const ws = workoutList(arr(was?.workouts), was?.workout ? [was.workout] : [], arr(out.workouts), out.workout ? [out.workout] : []); out.workouts = ws; out.workout = longest(ws); }
    if (Array.isArray(out.hr) && !out.hr.length && was?.hr?.length) out.hr = was.hr;
    if (Array.isArray(out.hr) && out.hr.length === 2 && Array.isArray(was?.hr) && was.hr.length === 2) out.hr = [Math.min(out.hr[0], was.hr[0]), Math.max(out.hr[1], was.hr[1])];
    if (out.screen && was?.screen) {
        const apps = { ...(was.screen.apps || {}) };
        for (const [k, m] of Object.entries(out.screen.apps || {})) apps[k] = Math.max(apps[k] || 0, m);
        out.screen = { ...out.screen, apps, ...(finiteNum(was.screen.pickups) && !(out.screen.pickups >= was.screen.pickups) ? { pickups: was.screen.pickups } : {}), ...(was.screen.late && !out.screen.late ? { late: was.screen.late } : {}) };
    }
    return out;
}
export function applyLife(p, e, phone, on) {
    const out = { effects: [], apps: new Set() };
    if (!p.life || !on || !phone || typeof phone !== 'object') return out;
    const L = p.life;
    const change = (path, r, vals, app) => {
        const keys = Object.keys(vals).filter(k => !same(r[k] ?? null, vals[k] ?? null));
        if (!keys.length) return;
        const fx = { type: 'change', path, id: r.id, from: fields(r, keys), to: Object.fromEntries(keys.map(k => [k, vals[k] ?? null])) };
        setFields(r, fx.to);
        out.effects.push(fx); out.apps.add(app);
    };
    const push = (path, row, app) => { boxAt(p, path, true).push(row); out.effects.push({ type: 'push', path, item: structuredClone(row) }); out.apps.add(app); };
    // ids unique on the phone: the same event told again in a later round adds its own records
    const taken = new Set([...(L.clock?.alarms || []), ...(L.clock?.timers || []), ...(L.health?.days || []), ...(L.files?.items || []), ...(L.files?.folders || [])].map(x => x?.id).filter(Boolean));
    const sid = base => { let id = base, n = 2; while (taken.has(id)) id = `${base}~${n++}`; taken.add(id); return id; };
    const tag = (row, k, c) => ({ ...row, id: sid(`sync:${e.id}:${c}${k}`), ev: e.id, sourceIndex: e.at });
    // only the fields the model wrote, cleaned as a whole record would be
    // what the model gave and the parser kept (a value it couldn't read never blanks the one there)
    const given = (raw, clean, keys) => Object.fromEntries(keys.filter(k => raw[k] !== undefined && raw[k] !== '' && raw[k] !== null && clean[k] !== '' && clean[k] !== undefined && clean[k] !== null).map(k => [k, clean[k]]));
    arr(phone.alarms).forEach((a, k) => {
        if (!a || typeof a !== 'object') return;
        const clean = alarmOf(a), was = a.change && (L.clock?.alarms || []).find(o => o.id === a.change);
        if (was) return change('life.clock.alarms', was, given(a, clean, ['time', 'label', 'ko', 'days', 'date', 'on', 'wake', 'then', 'snooze']), '시계');
        if (!clean.time) return;
        // the same alarm written again without its id: that alarm, changed (switched off, its days)
        const lk = v => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
        const twin = (L.clock?.alarms || []).find(o => o.time === clean.time && o.date === clean.date && (!lk(o.label) || !lk(clean.label) || lk(o.label).includes(lk(clean.label)) || lk(clean.label).includes(lk(o.label))));
        if (twin) return change('life.clock.alarms', twin, given(a, clean, ['ko', 'days', 'on', 'wake', 'then', 'snooze']), '시계');
        push('life.clock.alarms', tag({ ...clean, made: clean.made || e.date }, k, 'a'), '시계');
    });
    arr(phone.files).forEach((x, k) => {
        if (!x || typeof x !== 'object') return;
        // a time without its day ("16:00") is the event's day
        const clean = fileOf(/^\d{1,2}:\d{2}$/.test(String(x.time || '').trim()) ? { ...x, time: `${e.date} ${x.time}` } : x), was = x.change && (L.files?.items || []).find(o => o.id === x.change);
        if (was) {
            const vals = given(x, clean, ['name', 'folder', 'time', 'opened', 'preview', 'look', 'ko', 'tag']);
            if (x.deleted === true) vals.trashed = e.date;
            return change('life.files.items', was, vals, '파일');
        }
        if (!clean.name) return;
        // the same file written again without its id (saved again, or deleted): that file, changed
        const twin = (L.files?.items || []).find(o => o.name === clean.name && !o.trashed && (o.folder === clean.folder || !x.folder || x.deleted === true));
        if (twin) { const vals = given(x, clean, ['time', 'opened', 'preview', 'look', 'ko', 'tag']); if (x.deleted === true) vals.trashed = e.date; return change('life.files.items', twin, vals, '파일'); }
        if (x.deleted === true) return;
        // a folder the phone already has, written another way ("work" for "Work"), is that folder
        const own = [...(L.files?.folders || []).map(f => f.name), ...(L.files?.items || []).map(f => f.folder)].find(n => n && n.toLowerCase() === clean.folder.toLowerCase());
        if (own) clean.folder = own;
        // a folder the story makes (a new "Wohnung" for the flat's papers) is added to the folders
        else if (clean.folder && clean.folder !== 'Downloads') push('life.files.folders', tag({ name: clean.folder, ko: '', count: 0, fav: false }, k, 'd'), '파일');
        push('life.files.items', tag({ ...clean, time: clean.time || `${e.date}${e.time ? ` ${e.time}` : ''}` }, k, 'f'), '파일');
    });
    // a timer saved (the same label again: its seconds and day), and one running at the newest message (from its event's time)
    const lk = v => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const timerOf = t => ({ label: line(t?.label, 40), ko: ko(t?.ko), sec: int(t?.sec, 1, 86400), last: day5(t?.last) || e.date });
    let started = null;
    arr(phone.timers).forEach((t, k) => {
        if (!t || typeof t !== 'object') return;
        const clean = timerOf(t);
        if (!clean.sec) return;
        const twin = (L.clock?.timers || []).find(o => lk(o.label) && lk(clean.label) && (lk(o.label).includes(lk(clean.label)) || lk(clean.label).includes(lk(o.label))) || o.sec === clean.sec && (!lk(o.label) || !lk(clean.label)));
        if (twin) return change('life.clock.timers', twin, { sec: clean.sec, last: clean.last, ...(clean.ko ? { ko: clean.ko } : {}) }, '시계');
        push('life.clock.timers', tag(clean, k, 't'), '시계');
        // a timer first told in this event was set then: it runs from the event's time (the model seldom writes "running" on its own)
        if (!phone.running && clean.last === e.date && !started) started = { label: clean.label, ko: clean.ko, sec: clean.sec, left: clean.sec };
    });
    const running = phone.running && typeof phone.running === 'object' ? phone.running : started;
    if (running) {
        const r = running, sec = int(r.sec, 1, 86400);
        if (sec) {
            const to = { label: line(r.label, 40), ko: ko(r.ko), sec, left: Math.min(sec, int(r.left, 0, 86400) ?? sec), at: `${e.date}${e.time ? ` ${e.time}` : ''}` };
            const c = (L.clock ||= {});
            if (!same(c.running ?? null, to)) { out.effects.push({ type: 'set', path: 'life.clock.running', from: c.running ?? null, to: structuredClone(to) }); c.running = to; out.apps.add('시계'); }
        }
    }
    // their usual that the story changed (lost weight, quit coffee): each field on its own, so 되돌리기 takes back just it
    const uu = phone.usual && typeof phone.usual === 'object' ? phone.usual : null;
    if (uu) {
        const n = (v, lo, hi, d = 1) => { const x = num(v); return Number.isFinite(x) && x >= lo && x <= hi ? Math.round(x * d) / d : undefined; };
        const vals = { weight: n(uu.weight, 20, 300, 10), coffee: n(uu.coffee, 0, 15), water: n(uu.water, 0, 8, 10), coffeeKind: uu.coffeeKind ? line(uu.coffeeKind, 30) : undefined, coffeeKo: uu.coffeeKo ? ko(uu.coffeeKo) : undefined,
            bed: hhmm(uu.bed) || undefined, sleep: hhmm(uu.sleep) || undefined, wake: hhmm(uu.wake) || undefined, steps: n(uu.steps, 0, 80000), workouts: n(uu.workouts, 0, 21), rest: n(uu.rest, 30, 140), height: n(uu.height, 100, 230),
            // a habit with the phone the story changes (they quit the game, they're glued to it lately): the whole usual use again
            screen: uu.screen ? screenChange(L.health?.usual?.screen, uu.screen) || undefined : undefined };
        const u = (L.health ||= {}).usual ||= {};
        for (const [k, v] of Object.entries(vals)) {
            if (v === undefined || same(u[k] ?? null, v)) continue;
            out.effects.push({ type: 'set', path: `life.health.usual.${k}`, from: u[k] ?? null, to: v });
            u[k] = v; out.apps.add('건강');
        }
    }
    // a day the story shows: written over the day already there (a pattern day, or an earlier telling of it)
    arr(phone.health).forEach((d, k) => {
        const clean = dayOf({ ...d, from: 'story' });
        if (!clean.date) return;
        // fell asleep after midnight: the row is the day they woke up, the event's own day, not the evening before
        if (clean.sleep && clean.sleep < '12:00' && e.date && dayGap(clean.date, e.date) === 1) clean.date = e.date;
        const was = (L.health?.days || []).find(o => o.date === clean.date), today = was && was.date === String(p.now || '').slice(0, 5);
        // a day the story already told: this telling changes only what it says
        if (was?.from === 'story') { const vals = { ...given(d, clean, ['bed', 'sleep', 'wake', 'woke', 'steps', 'km', 'floors', 'workout', 'workouts', 'hr', 'coffee', 'coffeeKind', 'water', 'weight', 'screen']), ev: e.id }; return change('life.health.days', was, today ? soFar(was, vals) : vals, '건강'); }
        // what the story doesn't say is their usual
        const u = L.health?.usual || {};
        // waking: not before it happens (a night still going keeps it empty; the clock fills it once its time is past):
        // the event's own day before their usual waking time, or a row for the day after the event (asleep past midnight)
        const awake = !(e.time && u.wake && (clean.date === e.date && e.time < u.wake || dayGap(e.date, clean.date) > 0));
        for (const k of ['bed', 'sleep', 'wake']) if (!clean[k] && u[k] && (k !== 'wake' || awake)) clean[k] = u[k];
        // a day already over gets their usual steps; today's stay open (the screen counts them up, the clock fills them after)
        if (clean.steps === null && finiteNum(u.steps) && awake && dayGap(clean.date, e.date) > 0) clean.steps = u.steps;
        // what the model no longer writes is worked out: distance from the steps, floors and the heart range from their usual
        const hd = hash(clean.date);
        if (clean.steps === null && finiteNum(clean.km) && clean.km > 0) clean.steps = Math.round(clean.km / 0.00072);
        if (clean.km === null && finiteNum(clean.steps)) clean.km = Math.round(clean.steps * 0.00072 * 10) / 10;
        if (clean.floors === null) clean.floors = (hd >>> 9) % 9;
        if (!clean.hr.length && u.rest) clean.hr = [u.rest - 4 + hd % 5, u.rest + 45 + (hd >>> 4) % 40];
        bedFirst(clean);
        const vals = { ...clean, ev: e.id };
        if (was) return change('life.health.days', was, today ? soFar(was, vals) : vals, '건강');
        push('life.health.days', tag(vals, k, 'h'), '건강');
    });
    return out;
}

// ---- 처음 채우기의 건강: the model writes one row a day with the night after its evening ({ date, steps, …, night });
// the app keeps one row a waking day (a night belongs to the morning it ends). Pasta on the evening of 10-25, asleep at
// 01:30, up at 08:50: the model's 10-25 "night" → the app's 10-26 row. The night after the last story day hasn't ended:
// it is left out. The first day's own night isn't in the answer: their usual. A row in the old shape (no "night") is
// taken as a waking day, as it was.
export function nightsToDays(rows, { usual = {}, lastDay = '' } = {}) {
    const out = new Map();
    const blank = date => ({ date, bed: '', sleep: '', wake: '', woke: 0, steps: null, km: null, floors: null, workout: null, hr: [], from: 'pattern' });
    const at = date => (out.has(date) ? out.get(date) : out.set(date, blank(date)).get(date));
    const list = arr(rows).filter(d => d && typeof d === 'object' && day5(d.date)).sort((a, b) => dayGap(day5(b.date), day5(a.date)));
    for (const d of list) {
        const date = day5(d.date), story = d.from === 'story';
        if (!d.night || typeof d.night !== 'object') {
            if (d.night === undefined && (d.sleep || d.wake)) { Object.assign(at(date), dayOf(d)); continue; }
        }
        const day = dayOf({ ...d, bed: '', sleep: '', wake: '', woke: 0 }), r = at(date);
        for (const k of ['steps', 'km', 'floors', 'workout', 'workouts', 'hr', 'coffee', 'coffeeKind', 'water', 'weight', 'screen']) if (day[k] !== undefined) r[k] = day[k];
        if (story) { r.from = 'story'; if (day.ev) r.ev ||= day.ev; }
        if (d.night && typeof d.night === 'object') {
            const n = dayOf(d.night), w = at(plusDay(date, 1));
            for (const k of ['bed', 'sleep', 'wake', 'woke']) w[k] = n[k];
            // the night is what a health row is mostly about: its tag goes first
            if (story) { w.from = 'story'; if (day.ev) w.ev = day.ev; }
        }
    }
    const days = [...out.values()].filter(r => !lastDay || dayGap(lastDay, r.date) <= 0);
    for (const r of days) if (!r.sleep && !r.wake && usual.sleep) Object.assign(r, { bed: usual.bed || usual.sleep, sleep: usual.sleep, wake: usual.wake || '' });
    return days.sort((a, b) => dayGap(b.date, a.date)).slice(-14);
}

// ---- the round's own: the new days nobody told (pattern), and the weather
// days: the model's top-level "days"; a day already there stays (a story day, or one written before)
export function applyDays(p, days, round) {
    const out = [];
    if (!p.life) return out;
    const box = boxAt(p, 'life.health.days', true);
    arr(days).forEach((d, k) => {
        const clean = dayOf({ ...d, from: 'pattern' });
        if (!clean.date) return;
        // the phone's today, already there: its totals so far (only what the model wrote; never lower)
        const was = box.find(o => o.date === clean.date);
        if (was && clean.date === String(p.now || '').slice(0, 5)) {
            const keys = [...GROWS, 'screen', 'workout', 'workouts', 'hr'].filter(k => d?.[k] !== undefined && d[k] !== null && d[k] !== '' && clean[k] !== undefined && clean[k] !== null);
            if (finiteNum(clean.steps) && !keys.includes('km') && d?.km === undefined) { clean.km = Math.round(clean.steps * 0.00072 * 10) / 10; keys.push('km'); }
            const to = soFar(was, Object.fromEntries(keys.map(k => [k, clean[k]])));
            const ch = Object.keys(to).filter(k => JSON.stringify(was[k] ?? null) !== JSON.stringify(to[k] ?? null));
            if (!ch.length) return;
            const fx = { type: 'change', path: 'life.health.days', id: was.id, from: fields(was, ch), to: fields(to, ch) };
            setFields(was, fx.to);
            out.push(fx);
            return;
        }
        if (was) return;
        delete clean.ev;
        // what the model leaves off a pattern day is their usual (a day is never half told)
        const u = p.life.health?.usual || {};
        for (const k of ['bed', 'sleep', 'wake']) if (!clean[k] && u[k]) clean[k] = u[k];
        if (clean.steps === null && finiteNum(u.steps) && clean.date !== String(p.now || '').slice(0, 5)) clean.steps = u.steps;
        const hd = hash(clean.date);
        if (clean.steps === null && finiteNum(clean.km) && clean.km > 0) clean.steps = Math.round(clean.km / 0.00072);
        if (clean.km === null && finiteNum(clean.steps)) clean.km = Math.round(clean.steps * 0.00072 * 10) / 10;
        if (clean.floors === null) clean.floors = (hd >>> 9) % 9;
        if (!clean.hr.length && u.rest) clean.hr = [u.rest - 4 + hd % 5, u.rest + 45 + (hd >>> 4) % 40];
        bedFirst(clean);
        const row = { ...clean, id: `sync:${round}:d${k}` };
        box.push(row);
        out.push({ type: 'push', path: 'life.health.days', item: structuredClone(row) });
    });
    box.sort((a, b) => dayGap(b.date, a.date));
    return out;
}
// days nobody wrote (the model left them out): their usual, a little different each day, up to the story's now. Today
// only once the usual wake-up time has passed. No more than 14 days back.
// night times past midnight count as late; in bed is never after asleep (a usual bed time put beside a told sleep, or two times moved apart)
const lateMin = t => { const m = /^\d{2}:\d{2}$/.test(t || '') ? minutes(t) : null; return m === null ? null : m < 12 * 60 ? m + 1440 : m; };
const bedFirst = r => { if (r.bed && r.sleep && lateMin(r.bed) > lateMin(r.sleep)) r.bed = r.sleep; return r; };
const finiteNum = v => typeof v === 'number' && Number.isFinite(v);
// a day's hash with its bits mixed: "10-23" and "10-24" must land far apart (a plain h*31+c leaves neighbouring days a
// few bits apart, and nine days in a row got the same bedtime)
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const shiftHm = (t, min) => { const mt = /^(\d{2}):(\d{2})$/.exec(t || ''); if (!mt) return ''; const v = ((mt[1] * 60 + Number(mt[2]) + min) % 1440 + 1440) % 1440; return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`; };
// year: the story's (a leap year has its February 29), else a common year
// (a year unknown: a common one, so 02-28 is followed by 03-01; a leap one only from 02-29 itself)
const plusDay0 = (day, n, year = 0) => { const mt = /^(\d{2})-(\d{2})$/.exec(day); const d = new Date(Date.UTC(Number(year) || (day === '02-29' ? 2000 : 2001), mt[1] - 1, Number(mt[2]) + n)); return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const plusDay = (day, n) => plusDay0(day, n);
export function fillDays(p, now, round) {
    const out = [], L = p.life, u = L?.health?.usual, today = String(now || '').slice(0, 5), hm = String(now || '').slice(6, 11);
    if (!u || !/^\d{2}-\d{2}$/.test(today)) return out;
    const box = boxAt(p, 'life.health.days', true), Y = !p.noYear && p.year ? p.year : 0, plusDay = (d, n) => plusDay0(d, n, Y);
    const end = hm && u.wake && hm < u.wake ? plusDay(today, -1) : today;
    // every day missing since the first one kept, gaps between days too (a story day told before the one between them);
    // a story that jumped ahead: only its last two weeks
    const first = box.length ? box.reduce((a, d) => (dayGap(a, d.date) < 0 ? d.date : a), box[0].date) : plusDay(today, -14);
    const from = box.length ? (dayGap(first, today) > 13 ? plusDay(today, -13) : first) : plusDay(first, 1);
    for (let day = from, k = 0; dayGap(day, end) >= 0 && k < 15; day = plusDay(day, 1), k++) {
        if (box.some(d => d.date === day)) continue;
        const h = hash(day), j = n => ((h >>> n) % 41 - 20) / 100, steps = finiteNum(u.steps) && day !== today ? Math.round(u.steps * (1 + j(1) * 1.5)) : null;
        const row = { date: day, bed: shiftHm(u.bed || u.sleep, Math.round(j(3) * 100)), sleep: shiftHm(u.sleep, Math.round(j(5) * 100)), wake: shiftHm(u.wake, Math.round(j(7) * 60)), woke: h % 3,
            steps, km: steps === null ? null : Math.round(steps * 0.00072 * 10) / 10, floors: (h >>> 9) % 9, workout: null, hr: u.rest ? [u.rest - 4 + h % 5, u.rest + 45 + (h >>> 4) % 40] : [], from: 'pattern', id: `sync:${round}:g${k}` };
        // to bed before asleep (each time is moved on its own; in bed 00:38 after asleep at 00:17 can't be)
        if (row.bed && row.sleep && lateMin(row.bed) > lateMin(row.sleep)) row.bed = shiftHm(row.sleep, -(10 + h % 25));
        box.push(row);
        out.push({ type: 'push', path: 'life.health.days', item: structuredClone(row) });
    }
    if (out.length) box.sort((a, b) => dayGap(b.date, a.date));
    return out;
}
// w: the model's "weather" (null: keep it); now: the status line's (it stands over the model's)
// archive: the request carried archive sections (else the weather can't have come from there: it came from the chat)
// today: the story's day after the round ("MM-DD"), for the weather carried over a day nobody described
const samePlace = (a, b) => { const k = v => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''); return !k(a) || !k(b) || k(a) === k(b); };
export function applyWeather(p, w, now, { archive = true, today = '' } = {}) {
    if (!p.life) return [];
    const was = p.life.weather || null;
    let next;
    if (w && typeof w === 'object') {
        const raw = hereOf(w), here = fit(unko(apart(raw.place, now?.place, was?.cities || arr(w.cities).map(cityOf)) ? raw : overlay(raw, now, true)));
        if (here.from === 'archive' && !archive) here.from = 'chat';
        // a forecast or a tile the model left out stays as it was (the clock trims what is past)
        const old = was?.here;
        // the same day and place guessed again: the sky doesn't flip within a day on a guess; the story's own words do change it
        if (old?.cond && here.from === 'guess' && old.date && here.date === old.date && samePlace(old.place, here.place)) {
            for (const k of ['cond', 'temp', 'hi', 'lo', 'line', 'ko', 'said', 'from']) if (old[k] !== undefined) here[k] = old[k];
            if (!here.time) here.time = old.time;
        }
        if (old) {
            // yesterday's hours and rain are not today's; its forecast days are (the clock trims what is past)
            const sameDay = old.date === here.date;
            if (!here.hours.length && sameDay) here.hours = structuredClone(old.hours || []);
            if (!here.days.length) here.days = structuredClone(old.days || []);
            for (const [k, v] of Object.entries(here.tiles)) if ((v === null || v === '') && old.tiles?.[k] !== undefined && (sameDay || k !== 'rain24' && k !== 'rainNext')) here.tiles[k] = old.tiles[k];
            for (const k of ['hi', 'lo']) if (here[k] === null && old[k] !== undefined) here[k] = old[k];
            fit(here);
        }
        // the cities keep what the model leaves out (their time zone, their note). A sky or temperature that changed takes
        // the tiles with it: feels and dew move by the same degrees, and a new sky's rain, wind, humidity and visibility are
        // the screen's to work out again (not the old day's "5 mm more by tomorrow" under a clear sky)
        const key = v => line(v, 40).toLowerCase();
        const cities = (was?.cities || []).map(c => {
            const n = arr(w.cities).find(x => [c.name, c.ko].filter(Boolean).map(key).includes(key(x?.name))); if (!n) return c;
            const f = cityOf(n), out = { ...c, cond: condPick(n.cond, c.cond, { temp: f.temp }) };
            if (out.cond !== c.cond) for (const k of ['rainNext', 'wind', 'gust', 'dir', 'humidity', 'visibility']) out[k] = k === 'dir' ? '' : null;
            if (Number.isFinite(f.temp) && Number.isFinite(c.temp) && f.temp !== c.temp) for (const k of ['feels', 'dew']) if (Number.isFinite(c[k])) out[k] = c[k] + f.temp - c.temp;
            for (const k of ['temp', 'hi', 'lo', 'sunrise', 'sunset', 'rainNext', 'wind', 'gust', 'dir', 'feels', 'humidity', 'dew', 'visibility']) if (f[k] !== null && f[k] !== '') out[k] = f[k];
            return out;
        });
        // a city the story gives the owner reason to save now (a trip planned, a move): added at the end, up to 8
        for (const n of arr(w.cities)) {
            if (cities.length >= 8 || n?.added !== true) continue;
            const f = cityOf(n);
            if (!f.name || cities.some(c => [c.name, c.ko].filter(Boolean).map(key).includes(key(f.name)))) continue;
            cities.push({ ...f, note: line(n?.note, 40), noteKo: ko(n?.noteKo) });
        }
        next = { ...(was || {}), here, cities };
    } else if (now && was?.here && !apart(was.here.place, now.place, was.cities)) {
        // only the status line: its words stand over the weather there was; on a later day, yesterday's hours, sentence
        // and rain go with the day
        const here = fit(overlay(structuredClone(was.here), now));
        if (was.here.date && /^\d{2}-\d{2}$/.test(here.date) && dayGap(was.here.date, here.date) > 0) Object.assign(here, { hours: [], line: '', ko: '', tiles: { ...(here.tiles || {}), rain24: null, rainNext: null } });
        next = { ...was, here };
    } else if (was?.here?.cond && was.here.date && /^\d{2}-\d{2}$/.test(today) && dayGap(was.here.date, today) > 0) {
        // the day moved on with nothing said about the sky: yesterday's carries over as a guess for today (not a stale date)
        // yesterday's sentence and rain don't describe today; the screen reads what it needs off the sky
        next = { ...was, here: { ...structuredClone(was.here), date: today, time: '', from: 'guess', said: '', line: '', ko: '', hours: [], tiles: { ...(was.here.tiles || {}), rain24: null, rainNext: null } } };
    } else return [];
    // the cities are the next state's own (an effect's "from" must hold what was)
    next.cities = structuredClone(next.cities || []);
    mirrorHome(next);
    if (same(was, next)) return [];
    p.life.weather = next;
    return [{ type: 'set', path: 'life.weather', from: structuredClone(was), to: structuredClone(next) }];
}

// ---- the story's clock moved on (now: "MM-DD HH:MM"): what that does by itself
// Timers keep the remaining seconds at their saved story timestamp. Dates have no year: use the
// phone's current year, correcting December/January timestamps at the New Year boundary.
// A backwards or incomplete clock must not add time or discard a running timer.
export function timerLeft(p, now) {
    const r = p.life?.clock?.running, left = Math.max(0, Number(r?.left) || 0);
    if (!r) return 0;
    const parse = s => /^(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(String(s || ''))?.slice(1).map(Number);
    const a = parse(r.at || p.life.at), b = parse(now);
    if (!a || !b) return left;
    const year = Number(p.year) || Number(String(p.money?.asOf || p.investment?.date || '').slice(0, 4)) || new Date().getFullYear();
    const stamp = (x, y) => Date.UTC(y, x[0] - 1, x[1], x[2], x[3]);
    const end = stamp(b, year);
    let start = stamp(a, year);
    if (a[0] === 12 && b[0] === 1) start = stamp(a, year - 1);
    else if (a[0] === 1 && b[0] === 12) start = stamp(a, year + 1);
    return Math.max(0, left - Math.max(0, (end - start) / 1000));
}

// a one-time alarm that has rung goes off; a timer that would have run out is gone; a trash older than 30 days is
// emptied; the forecast's past hours fall away; health keeps 60 days
export function lifeClock(p, now) {
    const out = [];
    const L = p.life, today = String(now || '').slice(0, 5), hm = String(now || '').slice(6, 11);
    if (!L || !/^\d{2}-\d{2}$/.test(today)) return out;
    const change = (path, r, vals) => { const keys = Object.keys(vals).filter(k => !same(r[k] ?? null, vals[k])); if (!keys.length) return; const fx = { type: 'change', path, id: r.id, from: fields(r, keys), to: fields(vals, keys) }; setFields(r, fx.to); out.push(fx); };
    for (const a of L.clock?.alarms || []) if (a.on && a.date && !a.days?.length && (dayGap(a.date, today) > 0 || a.date === today && hm && a.time && hm > a.time)) change('life.clock.alarms', a, { on: false });
    if (L.clock?.running) {
        const gone = timerLeft(p, now) <= 0;
        if (gone) { out.push({ type: 'set', path: 'life.clock.running', from: structuredClone(L.clock.running), to: null }); L.clock.running = null; }
    }
    // a night told while it went on: its waking is their usual, once that time has come
    const u = L.health?.usual;
    if (u?.wake) for (const d of L.health?.days || []) if (!d.wake && (dayGap(d.date, today) > 0 || d.date === today && hm && hm >= u.wake)) change('life.health.days', d, { wake: u.wake });
    // and its steps, once that day is over
    if (finiteNum(u?.steps)) for (const d of L.health?.days || []) if ((d.steps === null || d.steps === undefined) && dayGap(d.date, today) > 0) change('life.health.days', d, { steps: u.steps, km: Math.round(u.steps * 0.00072 * 10) / 10 });
    const files = L.files?.items || [];
    for (const x of [...files]) if (x.trashed && dayGap(x.trashed, today) > 30) { files.splice(files.indexOf(x), 1); out.push({ type: 'drop', path: 'life.files.items', item: structuredClone(x) }); }
    const days = L.health?.days || [];
    for (const d of [...days]) if (dayGap(d.date, today) > 60) { days.splice(days.indexOf(d), 1); out.push({ type: 'drop', path: 'life.health.days', item: structuredClone(d) }); }
    const here = L.weather?.here;
    if (here?.date) {
        const next = structuredClone(L.weather);
        if (here.date !== today) next.here.hours = [];
        else if (hm) { let add = 0, prev = -1; next.here.hours = here.hours.filter(x => { const m = minutes(x.time); if (m < prev) add += 1440; prev = m; return m + add >= minutes(hm) - 59; }); }
        next.here.days = here.days.filter(x => dayGap(x.day, today) <= 0);
        if (!same(next, L.weather)) { out.push({ type: 'set', path: 'life.weather', from: structuredClone(L.weather), to: structuredClone(next) }); L.weather = next; }
    }
    return out;
}
const minutes = t => { const mt = /^(\d{2}):(\d{2})/.exec(String(t || '')); return mt ? mt[1] * 60 + Number(mt[2]) : 0; };

// what the model sees of the everyday apps
export function lifeNow(p) {
    const L = p.life;
    if (!L) return null;
    return {
        alarms: (L.clock?.alarms || []).map(a => ({ id: a.id, time: a.time, label: a.label, days: a.days, date: a.date, on: a.on })),
        timers: (L.clock?.timers || []).map(t => ({ label: t.label, sec: t.sec })), running: L.clock?.running ? { label: L.clock.running.label, sec: L.clock.running.sec } : null,
        folders: ['Downloads', ...(L.files?.folders || []).map(f => f.name).filter(Boolean)],
        files: (L.files?.items || []).filter(x => !x.trashed).slice(-12).map(x => ({ id: x.id, name: x.name, folder: x.folder, time: x.time })),
        // (the phone's today with everything so far: the model writes its totals again, and adds to these)
        health: (L.health?.days || []).slice(-3).map(d => ({ id: d.id, date: d.date, sleep: d.sleep, wake: d.wake, steps: d.steps, from: d.from,
            ...(d.date === String(p.now || '').slice(0, 5) ? Object.fromEntries([['floors', d.floors], ['workouts', (d.workouts || (d.workout ? [d.workout] : [])).map(w => `${w.kind}${w.time ? ` ${w.time}` : ''}${w.min ? ` ${w.min} min` : ''}`)], ['coffee', d.coffee], ['water', d.water], ['screen', d.screen ? [Object.entries(d.screen.apps || {}).map(([k, m]) => `${k} ${m}`).join(', '), d.screen.pickups != null ? `pickups ${d.screen.pickups}` : '', d.screen.late ? `late ${d.screen.late}` : ''].filter(Boolean).join(' · ') : undefined]].filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && !v.length))) : {}) })),
        usual: (u => (u ? Object.fromEntries(['bed', 'sleep', 'wake', 'steps', 'workouts', 'rest', 'weight', 'coffee', 'coffeeKind', 'water', 'screen'].filter(k => u[k] !== undefined && u[k] !== null && u[k] !== '').map(k => [k, k === 'screen' ? screenLine(u[k]) : u[k]])) : undefined))(L.health?.usual),
        weather: L.weather?.here ? { place: L.weather.here.place, date: L.weather.here.date, time: L.weather.here.time, cond: L.weather.here.cond, temp: L.weather.here.temp, cities: (L.weather.cities || []).map(c => c.name) } : null,
    };
}
// a delivery still on the way an hour and a half after it was due (or ordered) has arrived by now
// a card payment waits ("승인 대기") through its own day and goes through once the story's day moves on
export function cardClock(p, now) {
    const out = [], today = String(now || '').slice(0, 5);
    if (!/^\d{2}-\d{2}$/.test(today)) return out;
    for (const t of p.money?.tx || []) {
        if (!t.pending || t.kind !== 'card' || !/^\d{2}-\d{2}/.test(String(t.time || '')) || dayGap(String(t.time).slice(0, 5), today) <= 0) continue;
        out.push({ type: 'change', path: 'money.tx', id: t.id, from: { pending: true }, to: { pending: false } });
        t.pending = false;
    }
    return out;
}
export function dlvClock(p, now) {
    const out = [], today = String(now || '').slice(0, 5), hm = String(now || '').slice(6, 11);
    if (!p.delivery || !/^\d{2}-\d{2}$/.test(today)) return out;
    for (const o of p.delivery.orders || []) {
        if (o.status !== 'on the way') continue;
        // an arrival time without its day ("21:30") is the order's day
        const arr2 = String(o.arrived || ''), at = /^\d{2}-\d{2}/.test(arr2) ? arr2 : /^\d{2}:\d{2}/.test(arr2) ? `${String(o.time || '').slice(0, 5)} ${arr2}` : String(o.time || ''), g = dayGap(at.slice(0, 5), today);
        if (g > 0 || g === 0 && hm && at.slice(6, 11) && minutes(hm) - minutes(at.slice(6, 11)) >= 90) { out.push({ type: 'status', path: 'delivery.orders', id: o.id, status: 'delivered', prev: o.status }); o.status = 'delivered'; o.byClock = true; }
    }
    return out;
}
