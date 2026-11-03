// 새로 일어난 일 반영 · 생활 (시계 · 건강 · 파일 · 날씨): what the new messages did to the everyday apps, and what the
// story's clock moving on does to them. Like the money side, every change is listed in `effects` (what went in, and
// what a changed record was before), so 되돌리기 and 빼기 can take it back and 복구 can put it back; a record the user
// changed since stays as it is.
// The model's records are cleaned here too, for the first fill (phonelife.js) and for a reflection alike.
import { arr, hhmm, ko, line, num, pad, pick, when, withEv } from './phoneparse.js';

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
export const dayOf = d => withEv({ date: day5(d?.date), bed: hhmm(d?.bed), sleep: hhmm(d?.sleep), wake: hhmm(d?.wake), woke: int(d?.woke, 0, 30) ?? 0, steps: int(d?.steps, 0, 120000), km: num(d?.km), floors: int(d?.floors, 0, 400),
    workout: d?.workout && line(d.workout.kind, 30) ? { kind: line(d.workout.kind, 30), time: hhmm(d.workout.time), min: int(d.workout.min, 0, 600), km: num(d.workout.km) } : null,
    hr: arr(d?.hr).map(x => int(x, 30, 220)).filter(x => x !== null).slice(0, 2), from: pick(d?.from, ['story', 'pattern'], 'pattern') }, d);
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
export const cityAt = (place, cities) => { const k = v => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''), pk = k(place); return pk ? arr(cities).find(c => [c?.name, c?.ko].map(k).filter(Boolean).some(n => pk.includes(n) || n.includes(pk))) || null : null; };
// the saved city the owner is in carries the same weather as "here" (the model may leave it as it was)
export function mirrorHome(w) {
    const h = w?.here, c = h && cityAt(h.place, w.cities);
    if (!c) return w;
    for (const k of ['cond', 'temp', 'hi', 'lo']) if (h[k] !== null && h[k] !== undefined && h[k] !== '') c[k] = h[k];
    for (const k of ['sunrise', 'sunset', 'rainNext', 'wind', 'gust', 'dir', 'feels', 'humidity', 'dew', 'visibility']) { const v = h.tiles?.[k]; if (v !== null && v !== undefined && v !== '') c[k] = v; }
    return w;
}
export const apart = (a, b, cities) => { const x = cityAt(a, cities), y = cityAt(b, cities); return !!(x && y && x !== y); };
// a "MM-DD HH:MM" of one zone in another (Intl knows the rules; the year is the phone's, else this one)
export function zoneShift(at, from, to, year = new Date().getFullYear()) {
    const mt = /^(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(String(at || ''));
    if (!mt || !from || !to || from === to) return at;
    try {
        const parts = (tz, d) => { const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d), g = k => Number(f.find(x => x.type === k)?.value); return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute')); };
        const guess = new Date(Date.UTC(year, mt[1] - 1, mt[2], mt[3], mt[4]));
        const utc = guess.getTime() - (parts(from, guess) - guess.getTime()), local = new Date(parts(to, new Date(utc)));
        return `${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
    } catch { return at; }
}
// the newest status line over the saved weather, for the screen alone (nothing is saved): a day or hours later than it
export const overlayNow = (here, now) => fit(unline(overlay(structuredClone(here), now)));
export function parseWeather(w, now) {
    return { here: fit(unko(overlay(hereOf(w?.here || {}), now, true))), cities: arr(w?.cities).map(cityOf).filter(c => c.name).slice(0, 5) };
}

// ---- story days: "MM-DD" without a year; a gap across New Year is taken the short way round
const dnum = s => { const mt = /^(\d{2})-(\d{2})/.exec(String(s || '')); return mt ? Date.UTC(2001, mt[1] - 1, mt[2]) / 864e5 : NaN; };
export const dayGap = (a, b) => { let g = dnum(b) - dnum(a); if (g < -180) g += 365; if (g > 180) g -= 365; return g; };

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
export function lifeRevert(p, x) {
    if (x.type === 'change') { const r = boxAt(p, x.path)?.find(o => o.id === x.id); if (!r) return true; if (!Object.keys(x.to).every(k => same(r[k] ?? null, x.to[k]))) return false; setFields(r, x.from); return true; }
    if (x.type === 'set') { const w = walk(p, x.path); if (!w) return true; if (!same(w.parent[w.key], x.to)) return false; if (x.from === null) delete w.parent[w.key]; else w.parent[w.key] = structuredClone(x.from); return true; }
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
    const tag = (row, k, c) => ({ ...row, id: `sync:${e.id}:${c}${k}`, ev: e.id, sourceIndex: e.at });
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
        push('life.files.items', tag({ ...clean, time: clean.time || `${e.date}${e.time ? ` ${e.time}` : ''}` }, k, 'f'), '파일');
    });
    // their usual that the story changed (lost weight, quit coffee): each field on its own, so 되돌리기 takes back just it
    const uu = phone.usual && typeof phone.usual === 'object' ? phone.usual : null;
    if (uu) {
        const n = (v, lo, hi, d = 1) => { const x = num(v); return Number.isFinite(x) && x >= lo && x <= hi ? Math.round(x * d) / d : undefined; };
        const vals = { weight: n(uu.weight, 20, 300, 10), coffee: n(uu.coffee, 0, 15), water: n(uu.water, 0, 8, 10), coffeeKind: uu.coffeeKind ? line(uu.coffeeKind, 30) : undefined, coffeeKo: uu.coffeeKo ? ko(uu.coffeeKo) : undefined };
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
        const was = (L.health?.days || []).find(o => o.date === clean.date);
        // a day the story already told: this telling changes only what it says
        if (was?.from === 'story') return change('life.health.days', was, { ...given(d, clean, ['bed', 'sleep', 'wake', 'woke', 'steps', 'km', 'floors', 'workout', 'hr']), ev: e.id }, '건강');
        // what the story doesn't say is their usual
        const u = L.health?.usual || {};
        // waking: not before it happens (a night still going keeps it empty; the clock fills it once its time is past):
        // the event's own day before their usual waking time, or a row for the day after the event (asleep past midnight)
        const awake = !(e.time && u.wake && (clean.date === e.date && e.time < u.wake || dayGap(e.date, clean.date) > 0));
        for (const k of ['bed', 'sleep', 'wake']) if (!clean[k] && u[k] && (k !== 'wake' || awake)) clean[k] = u[k];
        // a day already over gets their usual steps; today's stay open (the screen counts them up, the clock fills them after)
        if (clean.steps === null && finiteNum(u.steps) && awake && dayGap(clean.date, e.date) > 0) clean.steps = u.steps;
        bedFirst(clean);
        const vals = { ...clean, ev: e.id };
        if (was) return change('life.health.days', was, vals, '건강');
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
        for (const k of ['steps', 'km', 'floors', 'workout', 'hr']) r[k] = day[k];
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
        if (!clean.date || box.some(o => o.date === clean.date)) return;
        delete clean.ev;
        // what the model leaves off a pattern day is their usual (a day is never half told)
        const u = p.life.health?.usual || {};
        for (const k of ['bed', 'sleep', 'wake']) if (!clean[k] && u[k]) clean[k] = u[k];
        if (clean.steps === null && finiteNum(u.steps) && clean.date !== String(p.now || '').slice(0, 5)) clean.steps = u.steps;
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
const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const shiftHm = (t, min) => { const mt = /^(\d{2}):(\d{2})$/.exec(t || ''); if (!mt) return ''; const v = ((mt[1] * 60 + Number(mt[2]) + min) % 1440 + 1440) % 1440; return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`; };
// year: the story's (a leap year has its February 29), else a common year
const plusDay0 = (day, n, year = 2001) => { const mt = /^(\d{2})-(\d{2})$/.exec(day); const d = new Date(Date.UTC(Number(year) || 2001, mt[1] - 1, Number(mt[2]) + n)); return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const plusDay = (day, n) => plusDay0(day, n);
export function fillDays(p, now, round) {
    const out = [], L = p.life, u = L?.health?.usual, today = String(now || '').slice(0, 5), hm = String(now || '').slice(6, 11);
    if (!u || !/^\d{2}-\d{2}$/.test(today)) return out;
    const box = boxAt(p, 'life.health.days', true), Y = !p.noYear && p.year ? p.year : 2001, plusDay = (d, n) => plusDay0(d, n, Y);
    const end = hm && u.wake && hm < u.wake ? plusDay(today, -1) : today;
    // every day missing since the first one kept, gaps between days too (a story day told before the one between them);
    // a story that jumped ahead: only its last two weeks
    const first = box.length ? box.reduce((a, d) => (dayGap(a, d.date) < 0 ? d.date : a), box[0].date) : plusDay(today, -14);
    const from = box.length ? (dayGap(first, today) > 13 ? plusDay(today, -13) : first) : plusDay(first, 1);
    for (let day = from, k = 0; dayGap(day, end) >= 0 && k < 15; day = plusDay(day, 1), k++) {
        if (box.some(d => d.date === day)) continue;
        const h = hash(day), j = n => ((h >> n) % 41 - 20) / 100, steps = finiteNum(u.steps) && day !== today ? Math.round(u.steps * (1 + j(1) * 1.5)) : null;
        const row = { date: day, bed: shiftHm(u.bed || u.sleep, Math.round(j(3) * 100)), sleep: shiftHm(u.sleep, Math.round(j(5) * 100)), wake: shiftHm(u.wake, Math.round(j(7) * 60)), woke: h % 3,
            steps, km: steps === null ? null : Math.round(steps * 0.00072 * 10) / 10, floors: (h >> 9) % 9, workout: null, hr: u.rest ? [u.rest - 4 + h % 5, u.rest + 45 + (h >> 4) % 40] : [], from: 'pattern', id: `sync:${round}:g${k}` };
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
        // the cities keep what the model leaves out (their time zone, their note)
        const cities = (was?.cities || []).map(c => { const key = v => line(v, 40).toLowerCase(), n = arr(w.cities).find(x => [c.name, c.ko].filter(Boolean).map(key).includes(key(x?.name))); if (!n) return c; const f = cityOf(n), out = { ...c, cond: condPick(n.cond, c.cond, { temp: f.temp }) }; for (const k of ['temp', 'hi', 'lo', 'sunrise', 'sunset', 'rainNext', 'wind', 'gust', 'dir', 'feels', 'humidity', 'dew', 'visibility']) if (f[k] !== null && f[k] !== '') out[k] = f[k]; return out; });
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
// a one-time alarm that has rung goes off; a timer that would have run out is gone; a trash older than 30 days is
// emptied; the forecast's past hours fall away; health keeps 60 days
export function lifeClock(p, now) {
    const out = [];
    const L = p.life, today = String(now || '').slice(0, 5), hm = String(now || '').slice(6, 11);
    if (!L || !/^\d{2}-\d{2}$/.test(today)) return out;
    const change = (path, r, vals) => { const keys = Object.keys(vals).filter(k => !same(r[k] ?? null, vals[k])); if (!keys.length) return; const fx = { type: 'change', path, id: r.id, from: fields(r, keys), to: fields(vals, keys) }; setFields(r, fx.to); out.push(fx); };
    for (const a of L.clock?.alarms || []) if (a.on && a.date && !a.days?.length && (dayGap(a.date, today) > 0 || a.date === today && hm && a.time && hm > a.time)) change('life.clock.alarms', a, { on: false });
    if (L.clock?.running) {
        const at = String(L.at || ''), gone = at.slice(0, 5) !== today || (hm && at.slice(6, 11) && minutes(hm) - minutes(at.slice(6, 11)) >= (L.clock.running.left || 0) / 60);
        if (gone) { out.push({ type: 'set', path: 'life.clock.running', from: structuredClone(L.clock.running), to: null }); L.clock.running = null; }
    }
    // a night told while it went on: its waking is their usual, once that time has come
    const u = L.health?.usual;
    if (u?.wake) for (const d of L.health?.days || []) if (!d.wake && (dayGap(d.date, today) > 0 || d.date === today && hm && hm >= u.wake)) change('life.health.days', d, { wake: u.wake });
    // and its steps, once that day is over
    if (finiteNum(u?.steps)) for (const d of L.health?.days || []) if ((d.steps === null || d.steps === undefined) && dayGap(d.date, today) > 0) change('life.health.days', d, { steps: u.steps });
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
        folders: ['Downloads', ...(L.files?.folders || []).map(f => f.name).filter(Boolean)],
        files: (L.files?.items || []).filter(x => !x.trashed).slice(-12).map(x => ({ id: x.id, name: x.name, folder: x.folder, time: x.time })),
        health: (L.health?.days || []).slice(-3).map(d => ({ id: d.id, date: d.date, sleep: d.sleep, wake: d.wake, steps: d.steps, from: d.from })),
        usual: (u => (u ? Object.fromEntries(['weight', 'coffee', 'coffeeKind', 'water'].filter(k => u[k] !== undefined && u[k] !== null && u[k] !== '').map(k => [k, u[k]])) : undefined))(L.health?.usual),
        weather: L.weather?.here ? { place: L.weather.here.place, date: L.weather.here.date, time: L.weather.here.time, cond: L.weather.here.cond, temp: L.weather.here.temp, cities: (L.weather.cities || []).map(c => c.name) } : null,
    };
}
// a delivery still on the way an hour and a half after it was due (or ordered) has arrived by now
export function dlvClock(p, now) {
    const out = [], today = String(now || '').slice(0, 5), hm = String(now || '').slice(6, 11);
    if (!p.delivery || !/^\d{2}-\d{2}$/.test(today)) return out;
    for (const o of p.delivery.orders || []) {
        if (o.status !== 'on the way') continue;
        // an arrival time without its day ("21:30") is the order's day
        const arr2 = String(o.arrived || ''), at = /^\d{2}-\d{2}/.test(arr2) ? arr2 : /^\d{2}:\d{2}/.test(arr2) ? `${String(o.time || '').slice(0, 5)} ${arr2}` : String(o.time || ''), g = dayGap(at.slice(0, 5), today);
        if (g > 0 || g === 0 && hm && at.slice(6, 11) && minutes(hm) - minutes(at.slice(6, 11)) >= 90) { out.push({ type: 'status', path: 'delivery.orders', id: o.id, status: 'delivered', prev: o.status }); o.status = 'delivered'; }
    }
    return out;
}
