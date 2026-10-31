// 캐릭터 휴대폰 · 생활 (시계 · 건강 · 파일 · 날씨) and 배달: the first fill of each (the draft model) and the delivery
// payments. The model writes only what needs the story and the character; totals, time left, charts, comparisons and the
// sentences under them are worked out by the screens (phonelifeapps.js).
// p.life = { clock, health, files, weather, at }; p.delivery = { shops, orders, cart, look, at }

import { askDraft } from './ai.js';
import { datedRows } from './anniv.js';
import { calendars } from './calendar.js';
import { saveMeta } from './core.js';
import { finance, migrateBank, round } from './finance.js';
import { headingPlaces } from './people.js';
import { arr, COUNTRIES, ensureIds, hhmm, jsonOf, ko, last4, line, num, pad, pick, rowDay, sideRequest, storyNow, when, withEv } from './phonedata.js';
import { exclusive } from './phonesync.js';
import { recentTrackers } from './scenes.js';
import { wealthDate } from './wealth.js';

export const AI_SYS_LIFE = `GOAL
Fill four everyday apps on one character's phone in a long role-play: the clock, health, files and weather. The user opens them to see habits the character never puts into words.
Write only what needs the story and the character. The app works out everything that follows from your numbers: totals, time left, charts, comparisons and the sentences under them.

YOU GET
- ARCHIVE, RECENT CHAT, OWNER, and sometimes WORLD, LOREBOOK and OWNER PROFILE.
- PHONE NOW: what the phone already holds (events, mails, tickets, bookings), with their "ev" tags.
- STORY DAYS: the last 14 days of the story, and where the owner was on each.
- WEATHER NOW (sometimes): the date, time, place and weather from the chat's newest status line.

STORY OR EVERYDAY
- OWNER PROFILE is for habits and taste: when they get up, how tidy they are, how much they move. The archive and chat are for what happened.
- Everyday records stay plain: most alarms wake someone up, most files are dull, most days are ordinary. One or two things stand out, not every record.
- Big things (a trip, a move, a new relationship, a job, a purchase, an illness) only from the story. Never invent one to explain a number.
- An item tied to a story event takes that event's "ev" from PHONE NOW, and its date and place agree with it.

CLOCK
- Alarms the owner set: time, label in their own words, repeat days, on or off, when they made it. An alarm they no longer need may stay switched off: a trip that is over, an old shift.
- "wake": true for alarms that get them up. A run of alarms minutes apart is one alarm with "then": the later times.
- Timers they saved, with the day last used. "running" only when the story's now shows a timer going.

HEALTH
- Every day in STORY DAYS. "date" is the day they woke up: a night that ran past midnight belongs to the next day.
- A day the story shows follows it: "from": "story" and its "ev". A long night out means short sleep, a day on foot means many steps.
- Any other day: write it freely from the character, the archive and their life, "from": "pattern". It still follows that day's events and tickets in PHONE NOW.
- "usual" is their normal week.
- Numbers only: no diagnosis, no mood, no reason.

FILES
- What the owner received, saved or scanned: documents, downloads, voice recordings, archives, spreadsheets, a few saved pictures or videos. What the camera took is in the photos app, not here.
- Folders they made, with how many files each holds; list only the files worth seeing, not every one.
- How tidy they are shows in names and folders: "final_FINAL(2)", a duplicate download, "New folder (3)", or neat names.
- A ticket or booking file carries the same "ev" as that record and no "preview"; the app draws it. Any other document gets "preview": one line on what its first page shows.
- An adult may keep a private file: name, type and size only, with "private": true. Nothing explicit in the name.

WEATHER
- With WEATHER NOW, its date, time, place and weather stand; write the rest to agree with them. Without it: what the chat describes, then the archive, then what fits the season and place ("from": "guess").
- "cities": places the owner saved, in their order: home, work, family, past and coming trips. A city stays after the trip ends. A saved city is not proof of a relationship.
- Never today's real-world weather.

LANGUAGE
Labels, file names and folder names in the language the owner really uses on their phone. A text not in Korean gets "ko".

SIZE
Up to 8 alarms, 4 timers, 6 folders, 18 files and 5 cities.

JSON (one object, nothing before or after it)
{
  "clock": { "alarms": [{ "time": "HH:MM", "label", "ko", "days": ["mon" … "sun"], or [] with "date": "MM-DD" for a one-time alarm, "on": true or false,
                          "wake": true or false, "then": ["HH:MM", …] or [], "snooze": minutes or 0, "snoozeCount", "sound", "made": "MM-DD", "ev" }],
             "timers": [{ "label", "ko", "sec", "last": "MM-DD" }],
             "running": { "label", "ko", "sec", "left": seconds } or null },
  "health": { "usual": { "bed": "HH:MM", "sleep": "HH:MM", "wake": "HH:MM", "steps", "workouts": per week, "rest": resting heart rate },
              "days": [{ "date": "MM-DD", "bed": "HH:MM", "sleep": "HH:MM", "wake": "HH:MM", "woke": times awake, "steps", "km", "floors",
                         "workout": { "kind", "time": "HH:MM", "min", "km" } or null, "hr": [low, high], "from": "story" | "pattern", "ev" }] },
  "files": { "folders": [{ "name", "ko", "count", "fav": true or false }],
             "items": [{ "name", "kind": "pdf" | "image" | "video" | "audio" | "zip" | "doc" | "sheet" | "slides" | "other",
                         "folder": a folder's name or "Downloads", "size": KB, "time": "MM-DD HH:MM", "from": where it came from, "pages", "length": "M:SS" for audio or video,
                         "tag": "red" | "orange" | "", "private": true or false, "preview", "ko", "opened": "MM-DD HH:MM", "trashed": "MM-DD" only in the trash, "ev" }],
             "cloud": { "used": GB, "total": GB } },
  "weather": { "here": { "place", "date": "MM-DD", "time": "HH:MM" (only without WEATHER NOW), "from": "tracker" | "chat" | "archive" | "guess",
                         "cond": "clear" | "cloudy" | "rain" | "snow" | "fog" | "storm", "temp", "hi", "lo", "line": one sentence of forecast, "ko",
                         "hours": [6 of { "time": "HH:MM", "cond", "temp", "rain": percent }],
                         "days": [10 of { "day": "MM-DD", "cond", "lo", "hi", "rain": percent }],
                         "tiles": { "rain24": mm, "rainNext": mm, "feels", "wind": km/h, "gust", "dir", "humidity", "dew", "sunrise": "HH:MM", "sunset": "HH:MM", "visibility": km } },
               "cities": [{ "name", "ko", "tz": like "Europe/Berlin", "cond", "temp", "hi", "lo", "sunset": "HH:MM", "note": "" or a few words, like a past trip, "noteKo" }] }
}
Numbers are plain JSON numbers.`;

export const AI_SYS_DELIVERY = `GOAL
Fill the food delivery app on one character's phone in a long role-play: the shops they use, what they ordered, where it went, and what still sits in the basket. The user opens it to see how the character eats and lives.
Write only what needs the story and the character. The app works out totals and records each payment in the bank.

YOU GET
- ARCHIVE, RECENT CHAT, OWNER, and sometimes WORLD, LOREBOOK and OWNER PROFILE.
- PHONE NOW: what the phone already holds, with their "ev" tags.
- STORY DAYS: the last 14 days of the story, and where the owner was on each.
- LIVES IN: where the owner lives now.
- MONEY NOW (sometimes): the owner's bank accounts and cards, by their last 4 digits.

SHOPS
- Up to 5 shops the owner orders from, the kind found where they live, named as they would be there. 3 or 4 dishes each.

ORDERS
- A delivery the story shows or a scene plainly implies gets its "ev". A few more are the character's everyday orders: late and alone, the same dish again, food for two.
- Never an order to explain a scene, and no big event (a party, a guest, a move) the story doesn't have.
- The same place always has the same address. "tip" only where tipping is the custom; elsewhere 0.
- "status" as of the story's now: "on the way" only for an order still coming then. An order only moves forward: "on the way", "delivered", then perhaps "cancelled" or "refunded".
- "account": the card or account that paid, by its last 4 digits in MONEY NOW, or "cash". Without MONEY NOW, "account": "card" or "cash".
- Don't write bank transactions; the app records the payment from "account".

CART
- Dishes put in the basket and not ordered, or null. No money moves for it.

LANGUAGE
Shop names, dishes and notes in the language they really have there. A text not in Korean gets "ko".

JSON (one object, nothing before or after it)
{
  "shops": [{ "name", "ko", "cuisine", "rating", "reviews", "fee", "minOrder", "eta": like "25–35", "fav": true or false,
              "menu": [{ "name", "ko", "desc", "price", "top": true for the shop's best-known dish }] }],
  "orders": [{ "shop", "items": [{ "name", "ko", "option", "qty", "price": unit price }], "fee", "tip", "discount",
               "mode": "delivery" | "pickup", "time": "MM-DD HH:MM", "arrived": "MM-DD HH:MM" or "", "to": "home" | "work" | a person's name, "address": short,
               "left": where the courier left it, or "", "noteShop", "noteShopKo", "noteRider", "noteRiderKo", "noCutlery": true or false, "for": how many people,
               "status", "account": last 4 digits or "cash", "reviewed": true or false, "gift": who it was sent to, or "", "ev" }],
  "cart": { "shop", "items": [{ "name", "ko", "option", "qty", "price" }], "noteShop", "noteShopKo", "noteRider", "noteRiderKo" } or null
}
Numbers are plain JSON numbers.`;

// ---- inputs
const DAY = 864e5;
const md = s => { const mt = String(s || '').match(/^(\d{2})-(\d{2})/); return mt ? { mo: Number(mt[1]), d: Number(mt[2]) } : null; };
// a story day moved by n days (MM-DD; the story's dates carry no year, so a leap year is assumed)
export const shiftDay = (day, n) => { const x = md(day); if (!x) return ''; const t = new Date(Date.UTC(2000, x.mo - 1, x.d) + n * DAY); return `${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
// the last 14 story days, each with the places its archive sections name
export function storyDays(m, p) {
    const now = String(storyNow(p) || p.now || '').slice(0, 5);
    const rows = datedRows(m).filter(r => rowDay(r)), cals = calendars();
    const last = md(now) ? now : rows.map(rowDay).sort().at(-1) || '';
    if (!last) return [];
    return Array.from({ length: 14 }, (_, k) => shiftDay(last, k - 13)).map(day => ({ day, places: [...new Set(rows.filter(r => rowDay(r) === day).flatMap(r => headingPlaces(r.s.title, cals)))].slice(0, 4) }));
}
// the chat's newest status line (date, time, place, weather), if any
export function weatherNow() {
    try { const t = recentTrackers(1)[0]; return t && (t.place || t.weather) ? { date: t.date || '', time: t.time || (Number.isFinite(t.min) ? `${pad(Math.floor(t.min / 60))}:${pad(t.min % 60)}` : ''), place: t.place || '', weather: t.weather || '' } : null; } catch { return null; }
}
// the status line's weather words as one of the app's kinds, and a temperature written in it
const COND_RE = [['storm', /storm|thunder|뇌우|천둥|번개|gewitter|雷/i], ['snow', /snow|눈|schnee|雪/i], ['rain', /rain|drizzle|shower|비|소나기|regen|雨/i], ['fog', /fog|mist|안개|nebel|霧/i], ['cloudy', /cloud|overcast|흐림|구름|bewölkt|wolk|曇/i], ['clear', /clear|sun|맑|화창|sonnig|klar|晴/i]];
export const condOf = text => COND_RE.find(([, re]) => re.test(String(text || '')))?.[0] || '';
const tempOf = text => { const mt = String(text || '').match(/(-?\d{1,2})\s*°/); return mt ? Number(mt[1]) : null; };
// where the owner lives: the profile's country (the delivery app is 배달의민족 there in Korea, Uber Eats elsewhere)
export const livesIn = p => (p.lives || p.country || '');
export const deliveryLook = p => (livesIn(p) === 'KR' ? 'baemin' : 'ubereats');
const phoneNow = p => JSON.stringify({
    now: storyNow(p) || p.now,
    events: (p.events || []).slice(-10).map(x => ({ title: x.title, date: x.date, time: x.time, ...(x.ev ? { ev: x.ev } : {}) })),
    mails: (p.mails || []).slice(-8).map(x => ({ from: x.from, subject: x.subject, time: x.time, ...(x.ev ? { ev: x.ev } : {}) })),
    tickets: (p.money?.passes || []).map(x => ({ kind: x.kind, by: x.by, from: x.from, to: x.to, date: x.date, time: x.time, ...(x.ev ? { ev: x.ev } : {}) })),
    orders: (p.money?.orders || []).slice(-6).map(x => ({ shop: x.shop, item: x.item, time: x.time, ...(x.ev ? { ev: x.ev } : {}) })),
});
const daysBlock = days => `[STORY DAYS]\n${days.map(d => `${d.day}${d.places.length ? `: ${d.places.join(', ')}` : ''}`).join('\n') || '(unknown)'}`;

// ---- 생활: parse
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const CONDS = ['clear', 'cloudy', 'rain', 'snow', 'fog', 'storm'];
const FILE_KINDS = ['pdf', 'image', 'video', 'audio', 'zip', 'doc', 'sheet', 'slides', 'other'];
const int = (v, lo, hi) => { const n = num(v); return n === null ? null : Math.max(lo, Math.min(hi, Math.round(n))); };
const yes = v => v === true;
const tz = v => (/^[A-Za-z]+(?:\/[A-Za-z_+-]+){1,2}$/.test(String(v || '')) ? String(v) : '');
const day5 = v => when(v).slice(0, 5);
const cityOf = c => ({ name: line(c?.name, 40), ko: ko(c?.ko), tz: tz(c?.tz), cond: pick(c?.cond, CONDS, 'cloudy'), temp: int(c?.temp, -60, 60), hi: int(c?.hi, -60, 60), lo: int(c?.lo, -60, 60), sunset: hhmm(c?.sunset), note: line(c?.note, 40), noteKo: ko(c?.noteKo) });
export function parseWeather(w, now) {
    const h = w?.here || {};
    const here = {
        place: line(h.place, 60), date: day5(h.date), time: hhmm(h.time), from: pick(h.from, ['tracker', 'chat', 'archive', 'guess'], 'guess'),
        cond: pick(h.cond, CONDS, 'cloudy'), temp: int(h.temp, -60, 60), hi: int(h.hi, -60, 60), lo: int(h.lo, -60, 60), line: line(h.line, 160), ko: ko(h.ko),
        hours: arr(h.hours).map(x => ({ time: hhmm(x?.time), cond: pick(x?.cond, CONDS, 'cloudy'), temp: int(x?.temp, -60, 60), rain: int(x?.rain, 0, 100) ?? 0 })).filter(x => x.time).slice(0, 6),
        days: arr(h.days).map(x => ({ day: day5(x?.day), cond: pick(x?.cond, CONDS, 'cloudy'), lo: int(x?.lo, -60, 60), hi: int(x?.hi, -60, 60), rain: int(x?.rain, 0, 100) ?? 0 })).filter(x => x.day).slice(0, 10),
        tiles: Object.fromEntries(['rain24', 'rainNext', 'feels', 'wind', 'gust', 'humidity', 'dew', 'visibility'].map(k => [k, num(h.tiles?.[k])]).concat([['dir', line(h.tiles?.dir, 12)], ['sunrise', hhmm(h.tiles?.sunrise)], ['sunset', hhmm(h.tiles?.sunset)]])),
    };
    // the status line stands: its date, time, place and weather; the model's numbers only fill what it doesn't say
    if (now) {
        here.from = 'tracker';
        if (now.place) here.place = line(now.place, 60);
        if (md(when(now.date))) here.date = day5(now.date);
        if (now.time) here.time = hhmm(now.time);
        const c = condOf(now.weather), t = tempOf(now.weather);
        if (c) here.cond = c;
        if (t !== null) here.temp = t;
        here.said = line(now.weather, 60);
    }
    return { here, cities: arr(w?.cities).map(cityOf).filter(c => c.name).slice(0, 5) };
}
export function parseLife(raw, now) {
    if (!raw || typeof raw !== 'object') throw new Error('모델 답에서 시계 · 건강 · 파일 · 날씨 내용(JSON)을 찾지 못했어요');
    const c = raw.clock || {}, h = raw.health || {}, f = raw.files || {};
    const run = c.running && int(c.running.sec, 1, 86400) ? { label: line(c.running.label, 40), ko: ko(c.running.ko), sec: int(c.running.sec, 1, 86400), left: int(c.running.left, 0, 86400) ?? 0 } : null;
    return {
        clock: {
            alarms: arr(c.alarms).map(a => withEv({ time: hhmm(a?.time), label: line(a?.label, 60), ko: ko(a?.ko), days: arr(a?.days).map(d => String(d).toLowerCase().slice(0, 3)).filter(d => DAYS.includes(d)), date: day5(a?.date),
                on: a?.on !== false, wake: yes(a?.wake), then: arr(a?.then).map(hhmm).filter(Boolean).slice(0, 10), snooze: int(a?.snooze, 0, 60) ?? 0, snoozeCount: int(a?.snoozeCount, 0, 20) ?? 0, sound: line(a?.sound, 30), made: day5(a?.made) }, a)).filter(a => a.time).slice(0, 8),
            timers: arr(c.timers).map(t => ({ label: line(t?.label, 40), ko: ko(t?.ko), sec: int(t?.sec, 1, 86400), last: day5(t?.last) })).filter(t => t.sec).slice(0, 4),
            running: run,
        },
        health: {
            usual: { bed: hhmm(h.usual?.bed), sleep: hhmm(h.usual?.sleep), wake: hhmm(h.usual?.wake), steps: int(h.usual?.steps, 0, 80000), workouts: int(h.usual?.workouts, 0, 21), rest: int(h.usual?.rest, 30, 140) },
            days: arr(h.days).map(d => withEv({ date: day5(d?.date), bed: hhmm(d?.bed), sleep: hhmm(d?.sleep), wake: hhmm(d?.wake), woke: int(d?.woke, 0, 30) ?? 0, steps: int(d?.steps, 0, 120000), km: num(d?.km), floors: int(d?.floors, 0, 400),
                workout: d?.workout && line(d.workout.kind, 30) ? { kind: line(d.workout.kind, 30), time: hhmm(d.workout.time), min: int(d.workout.min, 0, 600), km: num(d.workout.km) } : null,
                hr: arr(d?.hr).map(x => int(x, 30, 220)).filter(x => x !== null).slice(0, 2), from: pick(d?.from, ['story', 'pattern'], 'pattern') }, d)).filter(d => d.date)
                .sort((a, b) => a.date.localeCompare(b.date)).filter((d, k, xs) => !k || xs[k - 1].date !== d.date).slice(-14),
        },
        files: {
            folders: arr(f.folders).map(x => ({ name: line(x?.name, 40), ko: ko(x?.ko), count: int(x?.count, 0, 9999) ?? 0, fav: yes(x?.fav) })).filter(x => x.name).slice(0, 6),
            items: arr(f.items).map(x => withEv({ name: line(x?.name, 80), kind: pick(x?.kind, FILE_KINDS, 'other'), folder: line(x?.folder, 40) || 'Downloads', size: num(x?.size), time: when(x?.time), from: line(x?.from, 60),
                pages: int(x?.pages, 0, 2000), length: line(x?.length, 8), tag: pick(x?.tag, ['red', 'orange'], ''), private: yes(x?.private), preview: line(x?.preview, 160), ko: ko(x?.ko), opened: when(x?.opened), trashed: day5(x?.trashed) }, x)).filter(x => x.name).slice(0, 18),
            cloud: { used: num(f.cloud?.used), total: num(f.cloud?.total) },
        },
        weather: parseWeather(raw.weather, now),
    };
}

// ---- 배달: parse
const dish = x => ({ name: line(x?.name, 60), ko: ko(x?.ko), option: line(x?.option, 60), qty: int(x?.qty, 1, 50) ?? 1, price: num(x?.price) ?? 0 });
export function parseDelivery(raw, accounts = []) {
    if (!raw || typeof raw !== 'object') throw new Error('모델 답에서 배달 내용(JSON)을 찾지 못했어요');
    const acct = v => { const s = String(v ?? '').trim().toLowerCase(); if (s === 'cash') return 'cash'; const l4 = last4(v); return l4 && accounts.some(a => a.last4 === l4) ? l4 : 'card'; };
    const cart = raw.cart && arr(raw.cart.items).length ? { shop: line(raw.cart.shop, 60), items: arr(raw.cart.items).map(dish).filter(x => x.name).slice(0, 8), noteShop: line(raw.cart.noteShop, 120), noteShopKo: ko(raw.cart.noteShopKo), noteRider: line(raw.cart.noteRider, 120), noteRiderKo: ko(raw.cart.noteRiderKo) } : null;
    return {
        shops: arr(raw.shops).map(s => ({ name: line(s?.name, 60), ko: ko(s?.ko), cuisine: line(s?.cuisine, 30), rating: num(s?.rating), reviews: int(s?.reviews, 0, 999999), fee: num(s?.fee) ?? 0, minOrder: num(s?.minOrder), eta: line(s?.eta, 12), fav: yes(s?.fav),
            menu: arr(s?.menu).map(x => ({ name: line(x?.name, 60), ko: ko(x?.ko), desc: line(x?.desc, 100), price: num(x?.price) ?? 0, top: yes(x?.top) })).filter(x => x.name).slice(0, 4) })).filter(s => s.name).slice(0, 5),
        orders: arr(raw.orders).map(o => withEv({ shop: line(o?.shop, 60), items: arr(o?.items).map(dish).filter(x => x.name).slice(0, 10), fee: num(o?.fee) ?? 0, tip: num(o?.tip) ?? 0, discount: Math.abs(num(o?.discount) ?? 0),
            mode: pick(o?.mode, ['delivery', 'pickup'], 'delivery'), time: when(o?.time), arrived: when(o?.arrived), to: line(o?.to, 40) || 'home', address: line(o?.address, 80), left: line(o?.left, 60),
            noteShop: line(o?.noteShop, 120), noteShopKo: ko(o?.noteShopKo), noteRider: line(o?.noteRider, 120), noteRiderKo: ko(o?.noteRiderKo), noCutlery: yes(o?.noCutlery), for: int(o?.for, 1, 30) ?? 1,
            status: pick(o?.status, ['on the way', 'delivered', 'cancelled', 'refunded'], 'delivered'), account: acct(o?.account), reviewed: yes(o?.reviewed), gift: line(o?.gift, 40) }, o)).filter(o => o.shop && o.items.length && o.time)
            .sort((a, b) => a.time.localeCompare(b.time)).slice(-12),
        cart,
    };
}
// what an order came to (the model never writes it)
export const orderTotal = o => round(o.items.reduce((n, x) => n + x.qty * x.price, 0) + (o.fee || 0) + (o.tip || 0) - (o.discount || 0));

// ---- 배달 payments: one bank row per paid order (and a plus row for a refund), tied by the order's id and its "ev".
// An order on a debit account also gets its ledger line, so the balance moves. "card" without a bank waits for one.
const PAY = 'dlv-';
const payAccount = (p, o) => {
    const as = p.money?.bank?.accounts || [];
    if (o.account === 'cash') return null;
    return as.find(a => a.last4 === o.account) || (o.account === 'card' ? as.find(a => a.kind === 'credit') || as.find(a => a.kind === 'checking') || as[0] : null) || null;
};
export function unpayDeliveries(m, p) {
    const tx = p.money?.tx;
    if (!tx) return;
    const f = finance(m), gone = tx.filter(t => String(t.id || '').startsWith(PAY));
    for (const t of gone) for (const L of Object.values(f.accounts)) delete L.entries[t.id];
    p.money.tx = tx.filter(t => !gone.includes(t));
}
export function payDeliveries(m, p) {
    if (!p.money || !p.delivery) return 0;
    migrateBank(m, p);
    const f = finance(m), tx = p.money.tx ||= [], year = (wealthDate(m, p) || String(p.money.asOf || '')).slice(0, 4) || String(new Date().getFullYear());
    let n = 0;
    const put = (o, a, id, amount, time, memo) => {
        if (tx.some(t => t.id === id)) return;
        tx.push({ id, account: a.last4, who: o.shop, ko: o.ko || '', amount, time, kind: 'card', memo, pending: false, ...(o.ev ? { ev: o.ev } : {}), delivery: o.id });
        if (a.kind !== 'credit') { const L = f.accounts[`${a.id}:${a.currency}`]; if (L) L.entries[id] = { amount, date: `${year}-${time.slice(0, 5)}` }; }
        n++;
    };
    for (const o of p.delivery.orders) {
        if (o.status === 'cancelled') continue;
        const a = payAccount(p, o);
        if (!a) continue;
        const total = orderTotal(o);
        if (!(total > 0)) continue;
        put(o, a, `${PAY}${o.id}`, -total, o.time, o.mode === 'pickup' ? 'Pickup' : 'Delivery');
        if (o.status === 'refunded') put(o, a, `${PAY}${o.id}-r`, total, o.arrived || o.time, 'Refund');
    }
    tx.sort((a, b) => String(a.time).localeCompare(String(b.time)));
    for (const a of p.money.bank.accounts) if (a.kind !== 'credit') { const L = f.accounts[`${a.id}:${a.currency}`]; if (L) a.balance = round(L.amount + Object.values(L.entries).reduce((s, x) => s + x.amount, 0)); }
    return n;
}

// ---- the fills
export const fillLife = (m, p) => exclusive('fill', async () => {
    const now = weatherNow(), days = storyDays(m, p);
    const input = await sideRequest(m, p.owner, [`[PHONE NOW]\n${phoneNow(p)}`, daysBlock(days),
        now ? `[WEATHER NOW]\n${JSON.stringify(now)}` : '', p.country ? `[PHONE COUNTRY]\n${COUNTRIES[p.country] || p.country}` : ''], { profile: p.financeProfile });
    const out = await askDraft(input, { system: AI_SYS_LIFE, maxTokens: 16000 });
    const life = parseLife(jsonOf(out), now);
    p.life = { ...life, at: storyNow(p) || p.now || '' };
    ensureIds(p);
    await saveMeta();
    return p.life;
});
export const fillDelivery = (m, p) => exclusive('fill', async () => {
    const accounts = p.money?.bank?.accounts || [];
    const money = accounts.length ? `[MONEY NOW]\n${JSON.stringify(accounts.map(a => ({ last4: a.last4, kind: a.kind, name: a.name, currency: a.currency })))}` : '';
    const input = await sideRequest(m, p.owner, [`[PHONE NOW]\n${phoneNow(p)}`, daysBlock(storyDays(m, p)), `[LIVES IN]\n${COUNTRIES[livesIn(p)] || livesIn(p) || '(unknown)'}`, money], { profile: p.financeProfile });
    const out = await askDraft(input, { system: AI_SYS_DELIVERY, maxTokens: 9000 });
    const d = parseDelivery(jsonOf(out), accounts);
    if (p.delivery) unpayDeliveries(m, p);
    p.delivery = { ...d, look: deliveryLook(p), at: storyNow(p) || p.now || '' };
    ensureIds(p);
    payDeliveries(m, p);
    await saveMeta();
    return p.delivery;
});
