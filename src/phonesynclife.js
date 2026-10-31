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
export const alarmOf = a => withEv({ time: hhmm(a?.time), label: line(a?.label, 60), ko: ko(a?.ko), days: arr(a?.days).map(d => String(d).toLowerCase().slice(0, 3)).filter(d => DAYS.includes(d)), date: day5(a?.date),
    on: a?.on !== false, wake: yes(a?.wake), then: arr(a?.then).map(hhmm).filter(Boolean).slice(0, 10), snooze: int(a?.snooze, 0, 60) ?? 0, snoozeCount: int(a?.snoozeCount, 0, 20) ?? 0, sound: line(a?.sound, 30), made: day5(a?.made) }, a);
export const fileOf = x => withEv({ name: line(x?.name, 80), kind: pick(x?.kind, FILE_KINDS, 'other'), folder: line(x?.folder, 40) || 'Downloads', size: num(x?.size), time: when(x?.time), from: line(x?.from, 60),
    pages: int(x?.pages, 0, 2000), length: line(x?.length, 8), tag: pick(x?.tag, ['red', 'orange'], ''), private: yes(x?.private), preview: yes(x?.private) ? '' : line(x?.preview, 160), ko: ko(x?.ko), opened: when(x?.opened), trashed: day5(x?.trashed) }, x);
export const dayOf = d => withEv({ date: day5(d?.date), bed: hhmm(d?.bed), sleep: hhmm(d?.sleep), wake: hhmm(d?.wake), woke: int(d?.woke, 0, 30) ?? 0, steps: int(d?.steps, 0, 120000), km: num(d?.km), floors: int(d?.floors, 0, 400),
    workout: d?.workout && line(d.workout.kind, 30) ? { kind: line(d.workout.kind, 30), time: hhmm(d.workout.time), min: int(d.workout.min, 0, 600), km: num(d.workout.km) } : null,
    hr: arr(d?.hr).map(x => int(x, 30, 220)).filter(x => x !== null).slice(0, 2), from: pick(d?.from, ['story', 'pattern'], 'pattern') }, d);
const cityOf = c => ({ name: line(c?.name, 40), ko: ko(c?.ko), tz: tz(c?.tz), cond: pick(c?.cond, CONDS, 'cloudy'), temp: int(c?.temp, -60, 60), hi: int(c?.hi, -60, 60), lo: int(c?.lo, -60, 60), sunrise: hhmm(c?.sunrise), sunset: hhmm(c?.sunset),
    rainNext: num(c?.rainNext), wind: num(c?.wind), gust: num(c?.gust), dir: line(c?.dir, 12), feels: int(c?.feels, -60, 60), humidity: int(c?.humidity, 0, 100), dew: int(c?.dew, -60, 60), note: line(c?.note, 40), noteKo: ko(c?.noteKo) });

// ---- 날씨: the chat's status line stands; the model's numbers only fill what it doesn't say
// Korean "비" (rain) and "눈" (snow) count only as a word of their own ("비", "비 옴", "비가", "눈이 내림"), never inside
// another word ("비행기", "눈부신")
const RAIN_KO = '(?<![가-힣])비(?:(?![가-힣])|(?=[가옴와]))', SNOW_KO = '(?<![가-힣])눈(?:(?![가-힣])|(?=[이옴발]))';
const COND_RE = [['storm', /storm|thunder|뇌우|천둥|번개|gewitter|雷/i], ['sleet', /sleet|진눈깨비|schneeregen|霙|みぞれ/i],
    ['snow', new RegExp(`snow|폭설|함박눈|눈보라|${SNOW_KO}|schnee|雪`, 'i')], ['drizzle', /drizzle|이슬비|가랑비|nieselregen|霧雨/i],
    ['rain', new RegExp(`rain|shower|소나기|장대비|폭우|호우|${RAIN_KO}|regen|雨`, 'i')], ['fog', /fog|mist|안개|nebel|霧/i],
    ['wind', /gale|strong wind|windy|강풍|바람이 (?:세|강)|sturm|stürmisch|強風/i], ['partly', /partly|some clouds|구름 조금|구름 약간|teils|heiter|晴れ時々/i],
    ['cloudy', /cloud|overcast|흐림|구름|bewölkt|wolk|曇/i], ['clear', /clear|sun|맑|화창|햇살|햇빛|sonnig|klar|晴/i]];
export const condOf = text => COND_RE.find(([, re]) => re.test(String(text || '')))?.[0] || '';
const tempOf = text => { const mt = String(text || '').match(/(-?\d{1,2})\s*°/); return mt ? Number(mt[1]) : null; };
// a status line (scenes.js recentTrackers) as the weather it gives, or null
export function weatherFrom(t) {
    return t && (t.place || t.weather) ? { date: t.date || '', time: t.time || (Number.isFinite(t.min) ? `${pad(Math.floor(t.min / 60))}:${pad(t.min % 60)}` : ''), place: t.place || '', weather: t.weather || '' } : null;
}
const hereOf = h => ({
    place: line(h.place, 60), date: day5(h.date), time: hhmm(h.time), from: pick(h.from, ['tracker', 'chat', 'archive', 'guess'], 'guess'),
    cond: pick(h.cond, CONDS, 'cloudy'), temp: int(h.temp, -60, 60), hi: int(h.hi, -60, 60), lo: int(h.lo, -60, 60), line: line(h.line, 160), ko: ko(h.ko),
    hours: arr(h.hours).map(x => ({ time: hhmm(x?.time), cond: pick(x?.cond, CONDS, 'cloudy'), temp: int(x?.temp, -60, 60), rain: int(x?.rain, 0, 100) ?? 0 })).filter(x => x.time).slice(0, 6),
    days: arr(h.days).map(x => ({ day: day5(x?.day), cond: pick(x?.cond, CONDS, 'cloudy'), lo: int(x?.lo, -60, 60), hi: int(x?.hi, -60, 60), rain: int(x?.rain, 0, 100) ?? 0 })).filter(x => x.day).slice(0, 10),
    tiles: Object.fromEntries(['rain24', 'rainNext', 'feels', 'wind', 'gust', 'humidity', 'dew', 'visibility'].map(k => [k, num(h.tiles?.[k])]).concat([['dir', line(h.tiles?.dir, 12)], ['sunrise', hhmm(h.tiles?.sunrise)], ['sunset', hhmm(h.tiles?.sunset)]])),
});
// the status line over a weather "here": its date, time, place and weather stand
function overlay(here, now) {
    if (!now) return here;
    here.from = 'tracker';
    if (now.place) here.place = line(now.place, 60);
    if (/^\d{2}-\d{2}/.test(when(now.date))) here.date = day5(now.date);
    if (now.time) here.time = hhmm(now.time);
    const c = condOf(now.weather), t = tempOf(now.weather);
    if (c) here.cond = c;
    if (t !== null) here.temp = t;
    here.said = line(now.weather, 60);
    return here;
}
export function parseWeather(w, now) {
    return { here: overlay(hereOf(w?.here || {}), now), cities: arr(w?.cities).map(cityOf).filter(c => c.name).slice(0, 5) };
}

// ---- story days: "MM-DD" without a year; a gap across New Year is taken the short way round
const dnum = s => { const mt = /^(\d{2})-(\d{2})/.exec(String(s || '')); return mt ? Date.UTC(2000, mt[1] - 1, mt[2]) / 864e5 : NaN; };
export const dayGap = (a, b) => { let g = dnum(b) - dnum(a); if (g < -180) g += 366; if (g > 180) g -= 366; return g; };

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
    const given = (raw, clean, keys) => Object.fromEntries(keys.filter(k => raw[k] !== undefined && raw[k] !== '' && raw[k] !== null).map(k => [k, clean[k]]));
    arr(phone.alarms).forEach((a, k) => {
        if (!a || typeof a !== 'object') return;
        const clean = alarmOf(a), was = a.change && (L.clock?.alarms || []).find(o => o.id === a.change);
        if (was) return change('life.clock.alarms', was, given(a, clean, ['time', 'label', 'ko', 'days', 'date', 'on', 'wake', 'then', 'snooze']), '시계');
        if (!clean.time) return;
        if ((L.clock?.alarms || []).some(o => o.time === clean.time && o.label === clean.label && o.date === clean.date)) return;
        push('life.clock.alarms', tag({ ...clean, made: clean.made || e.date }, k, 'a'), '시계');
    });
    arr(phone.files).forEach((x, k) => {
        if (!x || typeof x !== 'object') return;
        const clean = fileOf(x), was = x.change && (L.files?.items || []).find(o => o.id === x.change);
        if (was) {
            const vals = given(x, clean, ['name', 'folder', 'opened', 'preview', 'ko', 'tag']);
            if (x.deleted === true) vals.trashed = e.date;
            return change('life.files.items', was, vals, '파일');
        }
        if (!clean.name || x.deleted === true) return;
        if ((L.files?.items || []).some(o => o.name === clean.name && o.folder === clean.folder && !o.trashed)) return;
        push('life.files.items', tag({ ...clean, time: clean.time || `${e.date}${e.time ? ` ${e.time}` : ''}` }, k, 'f'), '파일');
    });
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
        // waking: not before it happens (a night still going keeps it empty; the clock fills it once its time is past)
        const awake = !(clean.date === e.date && e.time && u.wake && e.time < u.wake);
        for (const k of ['bed', 'sleep', 'wake']) if (!clean[k] && u[k] && (k !== 'wake' || awake)) clean[k] = u[k];
        if (clean.steps === null && finiteNum(u.steps) && awake) clean.steps = u.steps;
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
        const row = { ...clean, id: `sync:${round}:d${k}` };
        box.push(row);
        out.push({ type: 'push', path: 'life.health.days', item: structuredClone(row) });
    });
    box.sort((a, b) => dayGap(b.date, a.date));
    return out;
}
// days nobody wrote (the model left them out): their usual, a little different each day, up to the story's now. Today
// only once the usual wake-up time has passed. No more than 14 days back.
const finiteNum = v => typeof v === 'number' && Number.isFinite(v);
const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const shiftHm = (t, min) => { const mt = /^(\d{2}):(\d{2})$/.exec(t || ''); if (!mt) return ''; const v = ((mt[1] * 60 + Number(mt[2]) + min) % 1440 + 1440) % 1440; return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`; };
const plusDay = (day, n) => { const mt = /^(\d{2})-(\d{2})$/.exec(day); const d = new Date(Date.UTC(2000, mt[1] - 1, Number(mt[2]) + n)); return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
export function fillDays(p, now, round) {
    const out = [], L = p.life, u = L?.health?.usual, today = String(now || '').slice(0, 5), hm = String(now || '').slice(6, 11);
    if (!u || !/^\d{2}-\d{2}$/.test(today)) return out;
    const box = boxAt(p, 'life.health.days', true), last = box.length ? box.reduce((a, d) => (dayGap(a, d.date) > 0 ? d.date : a), box[0].date) : plusDay(today, -14);
    const end = hm && u.wake && hm < u.wake ? plusDay(today, -1) : today;
    // a story that jumped ahead: only its last two weeks
    const from = dayGap(last, today) > 14 ? plusDay(today, -13) : plusDay(last, 1);
    for (let day = from, k = 0; dayGap(day, end) >= 0 && k < 15; day = plusDay(day, 1), k++) {
        if (box.some(d => d.date === day)) continue;
        const h = hash(day), j = n => ((h >> n) % 41 - 20) / 100, steps = finiteNum(u.steps) ? Math.round(u.steps * (1 + j(1) * 1.5)) : null;
        const row = { date: day, bed: shiftHm(u.bed || u.sleep, Math.round(j(3) * 100)), sleep: shiftHm(u.sleep, Math.round(j(5) * 100)), wake: shiftHm(u.wake, Math.round(j(7) * 60)), woke: h % 3,
            steps, km: steps === null ? null : Math.round(steps * 0.00072 * 10) / 10, floors: (h >> 9) % 9, workout: null, hr: u.rest ? [u.rest - 4 + h % 5, u.rest + 45 + (h >> 4) % 40] : [], from: 'pattern', id: `sync:${round}:g${k}` };
        box.push(row);
        out.push({ type: 'push', path: 'life.health.days', item: structuredClone(row) });
    }
    if (out.length) box.sort((a, b) => dayGap(b.date, a.date));
    return out;
}
// w: the model's "weather" (null: keep it); now: the status line's (it stands over the model's)
// archive: the request carried archive sections (else the weather can't have come from there: it came from the chat)
export function applyWeather(p, w, now, { archive = true } = {}) {
    if (!p.life) return [];
    const was = p.life.weather || null;
    let next;
    if (w && typeof w === 'object') {
        const here = overlay(hereOf(w), now);
        if (here.from === 'archive' && !archive) here.from = 'chat';
        // a forecast or a tile the model left out stays as it was (the clock trims what is past)
        const old = was?.here;
        if (old) {
            if (!here.hours.length) here.hours = structuredClone(old.hours || []);
            if (!here.days.length) here.days = structuredClone(old.days || []);
            for (const [k, v] of Object.entries(here.tiles)) if ((v === null || v === '') && old.tiles?.[k] !== undefined) here.tiles[k] = old.tiles[k];
            for (const k of ['hi', 'lo']) if (here[k] === null && old[k] !== undefined) here[k] = old[k];
        }
        // the cities keep what the model leaves out (their time zone, their note)
        const cities = (was?.cities || []).map(c => { const n = arr(w.cities).find(x => line(x?.name, 40) === c.name); if (!n) return c; const f = cityOf(n), out = { ...c, cond: pick(n.cond, CONDS, c.cond) }; for (const k of ['temp', 'hi', 'lo', 'rainNext', 'wind', 'gust', 'dir', 'feels', 'humidity', 'dew']) if (f[k] !== null && f[k] !== '') out[k] = f[k]; return out; });
        next = { ...(was || {}), here, cities };
    } else if (now && was?.here) {
        // only the status line: its words stand over the weather there was
        next = { ...was, here: overlay(structuredClone(was.here), now) };
    } else return [];
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
        else if (hm) next.here.hours = here.hours.filter(x => minutes(x.time) >= minutes(hm) - 59);
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
        files: (L.files?.items || []).filter(x => !x.trashed).slice(-12).map(x => ({ id: x.id, name: x.name, folder: x.folder, time: x.time })),
        health: (L.health?.days || []).slice(-3).map(d => ({ id: d.id, date: d.date, sleep: d.sleep, wake: d.wake, steps: d.steps, from: d.from })),
        weather: L.weather?.here ? { place: L.weather.here.place, date: L.weather.here.date, time: L.weather.here.time, cond: L.weather.here.cond, temp: L.weather.here.temp, cities: (L.weather.cities || []).map(c => c.name) } : null,
    };
}
// a delivery still on the way an hour and a half after it was due (or ordered) has arrived by now
export function dlvClock(p, now) {
    const out = [], today = String(now || '').slice(0, 5), hm = String(now || '').slice(6, 11);
    if (!p.delivery || !/^\d{2}-\d{2}$/.test(today)) return out;
    for (const o of p.delivery.orders || []) {
        if (o.status !== 'on the way') continue;
        const at = String(o.arrived || o.time || ''), g = dayGap(at.slice(0, 5), today);
        if (g > 0 || g === 0 && hm && at.slice(6, 11) && minutes(hm) - minutes(at.slice(6, 11)) >= 90) { out.push({ type: 'status', path: 'delivery.orders', id: o.id, status: 'delivered', prev: o.status }); o.status = 'delivered'; }
    }
    return out;
}
