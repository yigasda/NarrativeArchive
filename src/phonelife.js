// 캐릭터 휴대폰 · 생활 (시계 · 건강 · 파일 · 날씨) and 배달: the first fill of each (the draft model) and the delivery
// payments. The model writes only what needs the story and the character; totals, time left, charts, comparisons and the
// sentences under them are worked out by the screens (phonelifeapps.js).
// p.life = { clock, health, files, weather, at }; p.delivery = { shops, orders, cart, look, at }

import { askDraft } from './ai.js';
import { datedRows } from './anniv.js';
import { calendars } from './calendar.js';
import { saveMeta } from './core.js';
import { headingPlaces } from './people.js';
import { FOOD_IDS, dishPic } from './phonefood.js';
import { arr, trackerWeather, CHAT_TOKENS, COUNTRIES, byStory, ensureIds, giftOf, hhmm, jsonOf, ko, last4, line, markNow, num, pad, pick, rowDay, sideRequest, storyNow, when, withEv } from './phonedata.js';
import { dlvTotal, payOrders, shopStats, unpayOrders } from './phonesyncmoney.js';
import { alarmOf, cityAt, dayGap, fileOf, nightsToDays, parseWeather, screenOf, usualScreenOf, weatherFrom } from './phonesynclife.js';
import { SCREEN_LIST } from './phonescreen.js';
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
- People: only people the story has. Nothing later than the story's now.

CLOCK
- Alarms the owner set: time, label in their own words, repeat days, on or off, when they made it. An alarm they no longer need may stay switched off: a trip that is over, an old shift.
- "wake": true for alarms that get them up. A run of alarms minutes apart is one alarm with "then": the later times.
- An alarm for one occasion (a flight, an appointment) rings once: "days": [] and its "date". Only an alarm the owner keeps for every week has "days".
- Timers they saved, with the day last used. "running" only when the story's now shows a timer going.

HEALTH
- One row per day in STORY DAYS: that day's steps, distance, floors, workout and heart rate, and in "night" the sleep after its evening (to bed, asleep, awake the next morning).
- Pasta on the evening of 10-25, asleep at 23:40 or at 01:30, up at 08:50: all of that sleep is the 10-25 row's "night".
- The last day's "night" only when the story's now is already past it; else null.
- A day the story shows, or its night, follows it: "from": "story" and its "ev". A long night out means short sleep, a day on foot means many steps.
- Any other day: write it freely from the character, the archive and their life, "from": "pattern". It still follows that day's events and tickets in PHONE NOW.
- "usual" is their normal week. Its water, coffee, weight and height fit the character.
- Screen time shows who they really are, habits they'd never admit (a game they can't put down, texting all night, barely touching the phone): from their character, not their polite profile. Each day's "screen" follows what happened that day.
- Their apps, named exactly as here (another real app when none fits them):
${SCREEN_LIST}
- Numbers only: no diagnosis, no mood, no reason.

FILES
- What the owner received, saved or scanned: documents, downloads, voice recordings, archives, spreadsheets, a few saved pictures or videos. What the camera took is in the photos app, not here.
- Folders they made, with how many files each holds; list only the files worth seeing, not every one.
- How tidy they are shows in names and folders: "final_FINAL(2)", a duplicate download, "New folder (3)", or neat names.
- A ticket or booking file carries the same "ev" as that record. Every document gets "preview": one line on what its first page shows (for a booking in PHONE NOW the app draws its own).
- Every file gets "look", what it shows. A picture or video: "sea", "city", "night", "food", "hills", "pet", "sunset", "mountain", "snow", "flower", "interior", "concert", "paper" (a photo of a page), "screenshot", "map". A document: "ticket" (a flight or train ticket; its "preview" "carrier · from → to · date and number", like "KTX · 서울 → 부산 · 1월 10일 08:00"), "receipt", "invoice", "cv", "letter", "certificate", "sheet", "slides", "recipe", "medical", "menu", "contract", "notes". Audio: "voice" or "music". Other: "event" (.ics), "contact" (.vcf), "book" (.epub). For a zip, "preview" lists a few names inside.
- An adult may keep a private file: name, type and size only, with "private": true.
- No booking the story doesn't have (a hotel, a ticket, a reservation). A booking it has may show the details a real one would (a gate, a seat, a booking number), made up to fit.

WEATHER
- With WEATHER NOW, its date, time, place and weather stand for an owner in that scene; write the rest to agree with them. An owner elsewhere gets the weather where they are. Without it: what the chat describes, then the archive, then what fits the season and place ("from": "guess"). The place is where the story has the owner now.
- "cities": places the owner saved, in their order: home first (where the archive and profile say they live), then work, family, past and coming trips. A city stays after the trip ends. A saved city is not proof of a relationship.
- Places the story, profile or lorebook name come first. Others may fit their life (where family lives, a holiday some years ago), never a trip the story contradicts. With no place named at all, home is a city that fits the owner's country.
- Never today's real-world weather.

LANGUAGE
Labels, file names and folder names in the language the owner really uses on their phone. A text not in Korean gets "ko"; a Korean one gets none.

SIZE
Up to 8 alarms, 4 timers, 6 folders, 18 files and 5 cities.

JSON (one object, nothing before or after it)
{
  "clock": { "alarms": [{ "time": "HH:MM", "label", "ko", "days": ["mon" … "sun"], or [] with "date": "MM-DD" for a one-time alarm, "on": true or false,
                          "wake": true or false, "then": ["HH:MM", …] or [], "snooze": minutes or 0, "snoozeCount", "sound", "made": "MM-DD", "ev" }],
             "timers": [{ "label", "ko", "sec", "last": "MM-DD" }],
             "running": { "label", "ko", "sec", "left": seconds } or null },
  "health": { "usual": { "bed": "HH:MM", "sleep": "HH:MM", "wake": "HH:MM", "steps", "workouts": per week, "rest": resting heart rate,
                         "water": liters a day, "coffee": cups of coffee a day (0 if none), "coffeeKind": what they usually drink, like "Cappuccino", "coffeeKo",
                         "weight": kg, "height": cm,
                         "screen": { "apps": [{ "app", "kind": "chat" | "social" | "game" | "video" | "music" | "work" | "reading" | "shopping" | "other", "min": minutes a day }], "sometimes": [the same, apps they open now and then, "min" on a day they do], "pickups": a day, "late": "HH:MM" they usually last look at it } },
              "days": [{ "date": "MM-DD", "steps", "km", "floors", "workout": { "kind", "time": "HH:MM", "min", "km" } or null, "hr": [low, high], "coffee": cups, "coffeeKind", "water": litres, "weight": kg only when they weighed, "screen": { "apps": { app name: minutes }, "pickups", "late": "HH:MM" },
                         "night": { "bed": "HH:MM", "sleep": "HH:MM", "wake": "HH:MM", "woke": times awake } or null, "from": "story" | "pattern", "ev" }] },
  "files": { "folders": [{ "name", "ko", "count", "fav": true or false }],
             "items": [{ "name", "kind": "pdf" | "image" | "video" | "audio" | "zip" | "doc" | "sheet" | "slides" | "other",
                         "folder": a folder's name or "Downloads", "size": KB, "time": "MM-DD HH:MM", "from": where it came from, "pages", "length": "M:SS" for audio or video,
                         "tag": "red" | "orange" | "", "private": true or false, "preview", "look", "ko", "opened": "MM-DD HH:MM", "trashed": "MM-DD" only in the trash, "ev" }],
             "cloud": { "used": GB, "total": GB } },
  "weather": { "here": { "place", "date": "MM-DD", "time": "HH:MM" (only without WEATHER NOW), "from": "tracker" | "chat" | "archive" | "guess",
                         "cond": "clear" | "partly" | "cloudy" | "drizzle" | "rain" | "sleet" | "snow" | "fog" | "storm" | "wind", "temp", "hi", "lo", "line": one sentence of forecast, "ko",
                         "hours": [6 of { "time": "HH:MM", "cond", "temp", "rain": percent }],
                         "days": [10 of { "day": "MM-DD", "cond", "lo", "hi", "rain": percent }],
                         "tiles": { "rain24": mm, "rainNext": mm, "feels", "wind": km/h, "gust", "dir", "humidity", "dew", "sunrise": "HH:MM", "sunset": "HH:MM", "visibility": km } },
               "cities": [{ "name", "ko", "tz": like "Europe/Berlin", "cond", "temp", "hi", "lo", "sunrise": "HH:MM", "sunset": "HH:MM",
                 "rainNext": mm, "wind": km/h, "gust", "dir", "feels", "humidity", "dew", "note": "" or a few words, like a past trip, "noteKo" }] }
}
Numbers are plain JSON numbers. "ev" is a word tag, never a number: the "ev" of its story event in PHONE NOW, a short new one like "pasta-night" for a story event without one, or "" for an everyday record.`;

export const AI_SYS_DELIVERY = `GOAL
Fill the food delivery app on one character's phone in a long role-play: the shops they use, what they ordered, where it went, and what still sits in the basket. The user opens it to see how the character eats and lives.
Write only what needs the story and the character. The app works out totals and records each payment in the bank.

YOU GET
- ARCHIVE, RECENT CHAT, OWNER, and sometimes WORLD, LOREBOOK and OWNER PROFILE.
- PHONE NOW: what the phone already holds, with their "ev" tags.
- STORY DAYS: the last 14 days of the story, and where the owner was on each.
- LIVES IN: where the owner lives now.
- MONEY NOW (sometimes): the owner's bank accounts and cards, by their last 4 digits, and the bank's recent transactions with their ids.

SHOPS
- 5 to 7 shops the owner orders from, the kind found where they live, named as they would be there. 3 or 4 dishes each.
- "nearby": 5 to 8 more shops around them they haven't ordered from, each with only the one dish it is known for. The app works out their ratings, fees and times.

ORDERS
- A delivery the story shows or a scene plainly implies gets its "ev". Besides those, 4 to 8 everyday orders from the last weeks, spread over those shops (a favourite or two more often), the character's own: late and alone, the same dish again, food for two.
- Never an order to explain a scene, and no big event (a party, a guest, a move) the story doesn't have.
- People: only people the story has. No order later than the story's now.
- The same place always has the same address. "tip" only where tipping is the custom; elsewhere 0.
- "status" as of the story's now: "on the way" only for an order still coming then. An order only moves forward: "on the way", "delivered", then perhaps "cancelled" or "refunded".
- "account": the card or account that paid, by its last 4 digits in MONEY NOW, or "cash". Without MONEY NOW, "account": "card" or "cash".
- Don't write bank transactions; the app records the payment from "account".
- A meal already in MONEY NOW's transactions (the same shop, day and amount) is that order's payment: "paidBy": its id. The app adds no second payment for it.

CART
- Dishes put in the basket and not ordered, or null. No money moves for it.

PICTURES
- Every dish gets "pic"; the app draws it. "base": the closest of BASES. "with": up to 3 of TOPPINGS that set it apart from the shop's other dishes (salmon sushi: "sushi" with ["salmon"]). "size": "large" only for a large or extra size. "set": up to 2 of SIDES, only for a set or combo.
- An ordered or basket dish from a shop's menu takes that dish's "pic".
- BASES: ${FOOD_IDS.base.join(', ')}
- TOPPINGS: ${FOOD_IDS.top.join(', ')}
- SIDES: ${FOOD_IDS.side.join(', ')}

LANGUAGE
Shop names, dishes and notes in the language they really have there. A text not in Korean gets "ko"; a Korean one gets none.

JSON (one object, nothing before or after it)
{
  "shops": [{ "name", "ko", "cuisine", "rating", "reviews", "fee", "minOrder", "eta": like "25–35", "fav": true or false,
              "menu": [{ "name", "ko", "desc", "price", "top": true for the shop's best-known dish, "pic": { "base", "with": [], "size": "regular" | "large", "set": [] } }] }],
  "nearby": [{ "name", "ko", "cuisine", "dish": { "name", "ko", "price", "pic" } }],
  "orders": [{ "shop", "items": [{ "name", "ko", "option", "optionKo", "qty", "price": unit price, "pic" }], "fee", "tip", "discount",
               "mode": "delivery" | "pickup", "time": "MM-DD HH:MM", "arrived": "MM-DD HH:MM" or "", "to": "home" | "work" | a person's name, "address": short,
               "left": where the courier left it, or "", "noteShop", "noteShopKo", "noteRider", "noteRiderKo", "noCutlery": true or false, "for": how many people,
               "status", "account": last 4 digits or "cash", "paidBy": a transaction id from MONEY NOW, or "", "reviewed": true or false, "gift": who it was sent to, or "", "ev" }],
  "cart": { "shop", "items": [{ "name", "ko", "option", "optionKo", "qty", "price", "pic" }], "noteShop", "noteShopKo", "noteRider", "noteRiderKo" } or null
}
Numbers are plain JSON numbers. "ev" is a word tag, never a number: the "ev" of its story event in PHONE NOW, a short new one like "pasta-night" for a story event without one, or "" for an everyday record.`;

// ---- inputs
const DAY = 864e5;
const md = s => { const mt = String(s || '').match(/^(\d{2})-(\d{2})/); return mt ? { mo: Number(mt[1]), d: Number(mt[2]) } : null; };
// a story day moved by n days (MM-DD; the story's dates carry no year, so a leap year is assumed)
export const shiftDay = (day, n) => { const x = md(day); if (!x) return ''; const t = new Date(Date.UTC(2001, x.mo - 1, x.d) + n * DAY); return `${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
// the last 14 story days, each with the places its archive sections name
export function storyDays(m, p) {
    const now = String(storyNow(p) || p.now || '').slice(0, 5);
    const rows = datedRows(m).filter(r => rowDay(r)), cals = calendars();
    const last = md(now) ? now : rows.map(rowDay).at(-1) || '';
    if (!last) return [];
    return Array.from({ length: 14 }, (_, k) => shiftDay(last, k - 13)).map(day => ({ day, places: [...new Set(rows.filter(r => rowDay(r) === day).flatMap(r => headingPlaces(r.s.title, cals)))].slice(0, 4) }));
}
// the chat's newest status line (date, time, place, weather), if any
export function weatherNow() {
    try { return trackerWeather(recentTrackers(1)[0]); } catch { return null; }
}
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

// ---- 생활: parse (one record at a time in phonesynclife.js, the same for a reflection)
const int = (v, lo, hi) => { const n = num(v); return n === null ? null : Math.max(lo, Math.min(hi, Math.round(n))); };
const yes = v => v === true;
const day5 = v => when(v).slice(0, 5);
export { parseWeather };
// lastDay: the story's last day (a night after it hasn't ended yet)
export function parseLife(raw, now, lastDay = '') {
    if (!raw || typeof raw !== 'object') throw new Error('모델 답에서 시계 · 건강 · 파일 · 날씨 내용(JSON)을 찾지 못했어요');
    const c = raw.clock || {}, h = raw.health || {}, f = raw.files || {};
    const run = c.running && int(c.running.sec, 1, 86400) ? { label: line(c.running.label, 40), ko: ko(c.running.ko), sec: int(c.running.sec, 1, 86400), left: int(c.running.left, 0, 86400) ?? 0 } : null;
    return {
        clock: {
            alarms: arr(c.alarms).map(alarmOf).filter(a => a.time).slice(0, 8),
            timers: arr(c.timers).map(t => ({ label: line(t?.label, 40), ko: ko(t?.ko), sec: int(t?.sec, 1, 86400), last: day5(t?.last) })).filter(t => t.sec).slice(0, 4),
            running: run,
        },
        health: {
            usual: { bed: hhmm(h.usual?.bed), sleep: hhmm(h.usual?.sleep), wake: hhmm(h.usual?.wake), steps: int(h.usual?.steps, 0, 80000), workouts: int(h.usual?.workouts, 0, 21), rest: int(h.usual?.rest, 30, 140),
                water: num(h.usual?.water) > 0 && num(h.usual?.water) <= 8 ? num(h.usual.water) : null, coffee: int(h.usual?.coffee, 0, 12), coffeeKind: line(h.usual?.coffeeKind, 30), coffeeKo: ko(h.usual?.coffeeKo),
                weight: num(h.usual?.weight) >= 25 && num(h.usual?.weight) <= 250 ? num(h.usual.weight) : null, height: int(h.usual?.height, 100, 230),
                ...(usualScreenOf(h.usual?.screen) ? { screen: usualScreenOf(h.usual.screen) } : {}) },
            // the model writes a day and the night after it; the app keeps a row per waking day
            days: nightsToDays(h.days, { usual: { bed: hhmm(h.usual?.bed), sleep: hhmm(h.usual?.sleep), wake: hhmm(h.usual?.wake) }, lastDay }),
        },
        files: {
            folders: arr(f.folders).map(x => ({ name: line(x?.name, 40), ko: ko(x?.ko), count: int(x?.count, 0, 9999) ?? 0, fav: yes(x?.fav) })).filter(x => x.name && fileOf({ name: 'x', folder: x.name }).folder !== 'Downloads').slice(0, 6),
            items: arr(f.items).map(fileOf).filter(x => x.name).slice(0, 18),
            cloud: (u => ({ used: u.total !== null && u.used !== null ? Math.min(u.used, u.total) : u.used, total: u.total }))({ used: num(f.cloud?.used), total: num(f.cloud?.total) }),
        },
        weather: parseWeather(raw.weather, now),
    };
}

// ---- 배달: parse
const dish = x => {
    const d = { name: line(x?.name, 60), ko: ko(x?.ko), option: line(x?.option, 60), optionKo: ko(x?.optionKo), qty: int(x?.qty, 1, 50) ?? 1, price: num(x?.price) ?? 0 };
    if (!d.optionKo) delete d.optionKo;
    const pic = dishPic(x?.pic, d, true);
    return pic ? { ...d, pic } : d;
};
// tx: the bank's rows the model may point at ("paidBy": this order's payment is already there)
// a shop's dishes as the model writes them, each with its picture
const menuOf = (xs, n) => arr(xs).map(x => { const m = { name: line(x?.name, 60), ko: ko(x?.ko), desc: line(x?.desc, 100), price: num(x?.price) ?? 0, top: yes(x?.top) }, pic = dishPic(x?.pic, m, true); return pic ? { ...m, pic } : m; }).filter(x => x.name).slice(0, n);
export function parseDelivery(raw, accounts = [], tx = [], now = '') {
    if (!raw || typeof raw !== 'object') throw new Error('모델 답에서 배달 내용(JSON)을 찾지 못했어요');
    // a bank row it points at: that row is the payment, and its account is the order's
    const paidOf = v => { const t = tx.find(r => r.id === String(v ?? '') && r.amount < 0); return t ? { paidBy: t.id, account: t.account } : {}; };
    const acct = v => { const s = String(v ?? '').trim().toLowerCase(); if (s === 'cash') return 'cash'; const l4 = last4(v); return l4 && accounts.some(a => a.last4 === l4) ? l4 : 'card'; };
    const cart = raw.cart && arr(raw.cart.items).length ? { shop: line(raw.cart.shop, 60), items: arr(raw.cart.items).map(dish).filter(x => x.name).slice(0, 8), noteShop: line(raw.cart.noteShop, 120), noteShopKo: ko(raw.cart.noteShopKo), noteRider: line(raw.cart.noteRider, 120), noteRiderKo: ko(raw.cart.noteRiderKo) } : null;
    return {
        shops: arr(raw.shops).map(s => ({ name: line(s?.name, 60), ko: ko(s?.ko), cuisine: line(s?.cuisine, 30), rating: num(s?.rating), reviews: int(s?.reviews, 0, 999999), fee: num(s?.fee) ?? 0, minOrder: num(s?.minOrder), eta: line(s?.eta, 12), fav: yes(s?.fav),
            menu: menuOf(s?.menu, 4) })).filter(s => s.name).slice(0, 7),
        orders: arr(raw.orders).map(o => withEv({ shop: line(o?.shop, 60), items: arr(o?.items).map(dish).filter(x => x.name).slice(0, 10), fee: num(o?.fee) ?? 0, tip: num(o?.tip) ?? 0, discount: Math.abs(num(o?.discount) ?? 0),
            mode: pick(o?.mode, ['delivery', 'pickup'], 'delivery'), time: when(o?.time), arrived: when(o?.arrived) || hhmm(o?.arrived), to: line(o?.to, 40) || 'home', address: line(o?.address, 80), left: line(o?.left, 60),
            noteShop: line(o?.noteShop, 120), noteShopKo: ko(o?.noteShopKo), noteRider: line(o?.noteRider, 120), noteRiderKo: ko(o?.noteRiderKo), noCutlery: yes(o?.noCutlery), for: int(o?.for, 1, 30) ?? 1,
            status: pick(o?.status, ['on the way', 'delivered', 'cancelled', 'refunded'], 'delivered'), account: acct(o?.account), ...paidOf(o?.paidBy), reviewed: yes(o?.reviewed), gift: giftOf(o?.gift) }, o)).filter(o => o.shop && o.items.length && o.time)
            .sort(byStory(now)).slice(-12),
        cart,
    };
}
// 동네 가게: shops nearby the owner hasn't ordered from, the one dish each is known for; their numbers are the app's
export function nearbyShops(raw, shops, won) {
    const have = new Set(shops.map(s => s.name.toLowerCase()));
    return arr(raw?.nearby).map(s => {
        const name = line(s?.name, 60);
        if (!name || have.has(name.toLowerCase())) return null;
        have.add(name.toLowerCase());
        const d = s?.dish && typeof s.dish === 'object' ? s.dish : {}, m = { name: line(d.name, 60), ko: ko(d.ko), desc: '', price: num(d.price) ?? 0, top: true }, pic = m.name ? dishPic(d.pic, m, true) : null;
        const st = shopStats(name, won);
        return { name, ko: ko(s?.ko), cuisine: line(s?.cuisine, 30), rating: st.rating, reviews: st.reviews, fee: st.fee, minOrder: st.minOrder, eta: st.eta, fav: false, nearby: true, menu: m.name ? [pic ? { ...m, pic } : m] : [] };
    }).filter(Boolean).slice(0, 8);
}
// 동네 가게 메뉴: a shop nearby comes with the one dish it is known for; right after the delivery app is filled, the
// menus of all of them are asked in one more request of their own (the shops alone, no story, so it stays light);
// one that failed is asked again when the app is opened
export const AI_SYS_SHOP_MENU = `GOAL
Write the menus of a few food delivery shops on a character's phone in a long role-play, the way the delivery app shows them.

YOU GET
- SHOPS: each shop's name, its cuisine and the dish it is known for.
- LIVES IN and CURRENCY: where the shops are and the money their prices are in.

MENU
- For each shop, 4 to 6 dishes it would really sell, the known dish first with "top": true, each priced as it would be there, with a short "desc".
- Every dish gets "pic"; the app draws it. "base": the closest of BASES. "with": up to 3 of TOPPINGS that set it apart from the shop's other dishes. "size": "large" only for a large or extra size. "set": up to 2 of SIDES, only for a set.
- BASES: ${FOOD_IDS.base.join(', ')}
- TOPPINGS: ${FOOD_IDS.top.join(', ')}
- SIDES: ${FOOD_IDS.side.join(', ')}

LANGUAGE
Dish names in the language they really have there. A name not in Korean gets "ko"; a Korean one gets none.

JSON (one object, nothing before or after it)
{ "shops": [{ "name": as in SHOPS, "menu": [{ "name", "ko", "desc", "price", "top": true or false, "pic": { "base", "with": [], "size": "regular" | "large", "set": [] } }] }] }
Numbers are plain JSON numbers.`;
export const menuWanted = s => !!(s?.nearby && !s.menuAt && (s.menu || []).length < 2);
export async function fillShopMenus(m, p) {
    const want = (p.delivery?.shops || []).filter(menuWanted);
    if (!want.length) return 0;
    const cur = p.money?.currency || p.money?.bank?.accounts?.[0]?.currency || (livesIn(p) === 'KR' ? 'KRW' : 'EUR');
    const input = [`[SHOPS]\n${JSON.stringify(want.map(s => ({ name: s.name, cuisine: s.cuisine, known: s.menu?.[0] ? { name: s.menu[0].name, price: s.menu[0].price } : null })))}`,
        `[LIVES IN]\n${COUNTRIES[livesIn(p)] || livesIn(p) || '(unknown)'}`, `[CURRENCY]\n${cur}`].join('\n\n');
    const out = await askDraft(input, { force: true, system: AI_SYS_SHOP_MENU, maxTokens: 9000, effort: 'low' });
    const plain = v => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const got = new Map(arr(jsonOf(out)?.shops).filter(x => x && typeof x === 'object').map(x => [plain(x.name), menuOf(x.menu, 6)]));
    let n = 0;
    // a shop gone while it was asked (the app made again) is left; the dish each is known for stays first, as it was
    for (const w of want) {
        const s = (p.delivery?.shops || []).find(x => x.id === w.id), menu = got.get(plain(w.name));
        if (!s || !menuWanted(s) || !menu?.length) continue;
        const known = s.menu?.[0];
        s.menu = known ? [{ ...known, top: true }, ...menu.filter(x => plain(x.name) !== plain(known.name)).map(x => ({ ...x, top: false }))].slice(0, 6) : menu;
        s.menuAt = Date.now();
        n++;
    }
    if (!n) throw new Error('모델 답에서 가게 메뉴를 찾지 못했어요');
    await saveMeta();
    return n;
}
// ---- 동네 가게 새로 고침: as the story's days go by, shops nearby open and close and the list reorders, the way the real
// apps' do. Every 3 story days and 3 reflections both (asked after a reflection: a story that skips days at every
// reflection still asks at most every third one), 1 or 2 shops open and 1 or 2 of the
// ones nearby go; the owner moving to another of their saved cities makes it that city's shops. One short request of its
// own, the shops alone with their menus (no story)
const NEARBY_DAYS = 3, NEARBY_ROUNDS = 3, NEARBY_MAX = 8;
// the saved city the owner is in now (the weather's place read against the saved cities), or ''
const homeCity = p => cityAt(p.life?.weather?.here?.place || '', p.life?.weather?.cities || [])?.name || '';
export const AI_SYS_NEARBY = `GOAL
Keep the shops near one character up to date on the food delivery app of their phone in a long role-play, as the days go by.

YOU GET
- PLACE: the city they are in now. MOVED: true when they are in another city than before.
- CURRENCY: the money prices are in.
- NEARBY: the shops near them they haven't ordered from lately. ORDERED: the shops they order from.

CHANGES
- Without MOVED: 1 or 2 new shops open near them ("new"), and 1 or 2 of NEARBY close or drop out ("gone", their names as given).
- With MOVED: 5 to 7 shops of that city ("new"), and every shop of NEARBY is "gone".
- A new shop is the kind found there, named as it would be, not one of ORDERED or NEARBY. 4 to 6 dishes each, its best-known first with "top": true, each with a short "desc", priced as it would be there.
- Every dish gets "pic"; the app draws it. "base": the closest of BASES. "with": up to 3 of TOPPINGS. "size": "large" only for a large or extra size. "set": up to 2 of SIDES, only for a set.
- BASES: ${FOOD_IDS.base.join(', ')}
- TOPPINGS: ${FOOD_IDS.top.join(', ')}
- SIDES: ${FOOD_IDS.side.join(', ')}

LANGUAGE
Shop and dish names in the language they really have there. A name not in Korean gets "ko"; a Korean one gets none.

JSON (one object, nothing before or after it)
{ "new": [{ "name", "ko", "cuisine", "menu": [{ "name", "ko", "desc", "price", "top": true or false, "pic": { "base", "with": [], "size": "regular" | "large", "set": [] } }] }], "gone": ["a name from NEARBY"] }
Numbers are plain JSON numbers.`;
// the shops nearby: not ordered from in the story's last 30 days (the 자주 시킨 가게 line's own rule)
const lately = (p, d, name) => { const today = String(storyNow(p) || p.now || '').slice(0, 5); return d.orders.some(o => o.shop === name && /^\d{2}-\d{2}$/.test(today) && dayGap(String(o.time || '').slice(0, 5), today) >= 0 && dayGap(String(o.time || '').slice(0, 5), today) <= 30); };
export function nearbyDue(p) {
    const d = p.delivery, today = String(storyNow(p) || p.now || '').slice(0, 5);
    if (!d?.shops?.length || !/^\d{2}-\d{2}$/.test(today)) return '';
    const city = homeCity(p);
    if (city && d.city && city !== d.city) return 'moved';
    if (!/^\d{2}-\d{2}$/.test(d.nearbyAt || '')) return '';
    return dayGap(d.nearbyAt, today) >= NEARBY_DAYS && (d.nearbyRounds || 0) >= NEARBY_ROUNDS ? 'days' : '';
}
// read: a reflection that read messages (it counts toward the 3)
export async function refreshNearby(m, p, { read = false } = {}) {
    const d = p.delivery, today = String(storyNow(p) || p.now || '').slice(0, 5);
    if (d && read) d.nearbyRounds = (d.nearbyRounds || 0) + 1;
    const why = nearbyDue(p);
    // a phone filled before this kept no day: it starts counting now
    if (d && !d.nearbyAt && /^\d{2}-\d{2}$/.test(today)) { d.nearbyAt = today; d.city ||= homeCity(p); await saveMeta(); return 0; }
    if (!why) return 0;
    const moved = why === 'moved', near = d.shops.filter(s => !lately(p, d, s.name)), ordered = d.shops.filter(s => lately(p, d, s.name));
    const cur = p.money?.currency || p.money?.bank?.accounts?.[0]?.currency || (livesIn(p) === 'KR' ? 'KRW' : 'EUR');
    const input = [`[PLACE]\n${homeCity(p) || COUNTRIES[livesIn(p)] || livesIn(p) || '(unknown)'}${moved ? '\n[MOVED]\ntrue' : ''}`, `[CURRENCY]\n${cur}`,
        `[NEARBY]\n${JSON.stringify(near.map(s => ({ name: s.name, cuisine: s.cuisine })))}`, `[ORDERED]\n${JSON.stringify(ordered.map(s => s.name))}`].join('\n\n');
    const out = await askDraft(input, { force: true, system: AI_SYS_NEARBY, maxTokens: 9000, effort: 'low' });
    const raw = jsonOf(out);
    if (!raw || typeof raw !== 'object') throw new Error('모델 답에서 동네 가게를 찾지 못했어요');
    // the phone may have changed while it was asked (the app made again)
    if (p.delivery !== d) return 0;
    const plain = v => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const gone = new Set(moved ? near.map(s => plain(s.name)) : arr(raw.gone).map(plain));
    const have = new Set(d.shops.map(s => plain(s.name)));
    const won = cur === 'KRW', fresh = arr(raw.new).map(x => {
        const name = line(x?.name, 60); if (!name || have.has(plain(name))) return null; have.add(plain(name));
        const st = shopStats(name, won), menu = menuOf(x?.menu, 6);
        return { name, ko: ko(x?.ko), cuisine: line(x?.cuisine, 30), rating: st.rating, reviews: st.reviews, fee: st.fee, minOrder: st.minOrder, eta: st.eta, fav: false, nearby: true, menu, ...(menu.length > 1 ? { menuAt: Date.now() } : {}) };
    }).filter(Boolean).slice(0, moved ? 7 : 2);
    // a shop nearby goes (never one ordered from lately); the rest reorder; the new ones come first, as the app shows what opened
    const kept = d.shops.filter(s => lately(p, d, s.name) || !gone.has(plain(s.name)));
    const mix = v => [...`${today}:${v}`].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
    const stay = kept.filter(s => !lately(p, d, s.name)).sort((a, b) => mix(a.name) - mix(b.name));
    const nearby = [...fresh, ...stay].slice(0, NEARBY_MAX);
    d.shops = [...kept.filter(s => lately(p, d, s.name)), ...nearby];
    d.nearbyAt = today; d.nearbyRounds = 0; d.city = homeCity(p) || d.city || '';
    ensureIds(p);
    await saveMeta();
    return fresh.length;
}
// what an order came to (the model never writes it)
export const orderTotal = dlvTotal;

// ---- 배달 payments (phonesyncmoney.js): one bank row per paid order, tied by the order's id and its "ev"
const yearOf = (m, p) => (wealthDate(m, p) || String(p.money?.asOf || '')).slice(0, 4) || String(new Date().getFullYear());
export const payDeliveries = (m, p) => payOrders(m, p, yearOf(m, p));
export { unpayOrders as unpayDeliveries };

// a "MM-DD HH:MM" after another (across New Year the short way round)
const later = (t, now) => { const g = dayGap(String(now).slice(0, 5), String(t).slice(0, 5)); return g > 0 || g === 0 && String(t).slice(6, 11) > String(now).slice(6, 11) && !!String(now).slice(6, 11); };
// ---- the fills
export const fillLife = (m, p) => exclusive('fill', async () => {
    const now = weatherNow(), days = storyDays(m, p);
    const input = await sideRequest(m, p.owner, [`[PHONE NOW]\n${phoneNow(p)}`, daysBlock(days),
        now ? `[WEATHER NOW]\n${JSON.stringify(now)}` : '', p.country ? `[PHONE COUNTRY]\n${COUNTRIES[p.country] || p.country}` : ''], { profile: p.financeProfile, story: CHAT_TOKENS.apps });
    const out = await askDraft(input, { force: true, system: AI_SYS_LIFE, maxTokens: 16000, effort: 'low' });
    const life = parseLife(jsonOf(out), now, days.at(-1)?.day || '');
    // a booking the wallet holds is drawn from it: its file needs no line of its own
    const at = storyNow(p) || p.now || '';
    if (/^\d{2}-\d{2}/.test(at)) life.files.items = life.files.items.filter(x => !later(x.time, at));
    const booked = new Set((p.money?.passes || []).map(x => x.ev).filter(Boolean));
    for (const x of life.files.items) if (x.ev && booked.has(x.ev)) x.preview = '';
    p.life = { ...life, at: storyNow(p) || p.now || '' };
    // a reflection reads on from here: what came before is in what was just written
    if (p.sync?.marks) p.sync.marks.life = markNow();
    ensureIds(p);
    await saveMeta();
    return p.life;
});
// ---- 스크린타임만 채우기: a phone filled before the screen time was there (its health days stay as they are). Their usual
// use and each recent day's, from the character and the story; one short request, once
export const AI_SYS_SCREEN = `GOAL
Write the screen time on a character's phone in a long role-play: the apps they use and for how long, the way the phone's Screen Time shows it.

YOU GET
- The character, their profile and the story so far.
- DAYS: their last days from the health app (when they slept and woke, their steps; "ev" when the story shows that day).
- PHONE COUNTRY.

SCREEN TIME
- It shows who they really are, habits they'd never admit (a game they can't put down, texting all night, barely touching the phone): from their character, not their polite profile.
- "usual" is their normal day, 4 to 10 apps, and 3 to 6 they open now and then.
- Each of DAYS follows what happened that day and how they felt (a fight: hours of texting late into the night; a day out with friends: barely any), and how they slept.
- Their apps, named exactly as here (another real app when none fits them):
${SCREEN_LIST}
- Numbers only: no diagnosis, no mood, no reason.

JSON (one object, nothing before or after it)
{ "usual": { "apps": [{ "app", "kind": "chat" | "social" | "game" | "video" | "music" | "work" | "reading" | "shopping" | "other", "min": minutes a day }], "sometimes": [the same, apps they open now and then, "min" on a day they do], "pickups": a day, "late": "HH:MM" they usually last look at it },
  "days": [{ "date": "MM-DD" as in DAYS, "apps": { app name: minutes }, "pickups", "late": "HH:MM" }] }
Numbers are plain JSON numbers.`;
export const fillScreen = (m, p) => exclusive('fill', async () => {
    const h = p.life?.health;
    if (!h) throw new Error('건강 앱을 먼저 채워 주세요');
    // the last week before today (today is counted as it goes, from their usual)
    const today = String(storyNow(p) || p.now || '').slice(0, 5);
    const days = (h.days || []).filter(d => d.date && d.date !== today && !d.screen && (!today || dayGap(d.date, today) > 0)).sort((a, b) => dayGap(b.date, a.date)).slice(-7);
    const input = await sideRequest(m, p.owner, [`[DAYS]\n${JSON.stringify(days.map(d => ({ date: d.date, sleep: d.sleep, wake: d.wake, steps: d.steps, ...(d.ev ? { ev: d.ev } : {}) })))}`,
        p.country ? `[PHONE COUNTRY]\n${COUNTRIES[p.country] || p.country}` : ''], { profile: p.financeProfile, story: CHAT_TOKENS.apps });
    const out = await askDraft(input, { force: true, system: AI_SYS_SCREEN, maxTokens: 6000, effort: 'low' });
    const raw = jsonOf(out), usual = usualScreenOf(raw?.usual);
    let n = 0;
    // a phone the reflection already gave a usual keeps it; a day already told keeps its own
    if (usual && !h.usual?.screen) { (h.usual ||= {}).screen = usual; n++; }
    for (const x of arr(raw?.days)) {
        const d = days.find(y => y.date === String(x?.date || '').slice(0, 5)), sc = screenOf(x);
        if (d && sc && !d.screen) { d.screen = sc; n++; }
    }
    if (!n) throw new Error('모델 답에서 스크린타임을 찾지 못했어요');
    await saveMeta();
    return n;
});
export const fillDelivery = (m, p) => exclusive('fill', async () => {
    const accounts = p.money?.bank?.accounts || [];
    // the bank's own rows (not the ones this app put there): a meal already paid there is pointed at, not paid again
    const tx = (p.money?.tx || []).filter(t => !String(t.id).startsWith('dlv-') && !t.delivery);
    const money = accounts.length ? `[MONEY NOW]\n${JSON.stringify({ accounts: accounts.map(a => ({ last4: a.last4, kind: a.kind, name: a.name, currency: a.currency })), tx: tx.slice(-20).map(t => ({ id: t.id, account: t.account, time: t.time, who: t.who, amount: t.amount })) })}` : '';
    const input = await sideRequest(m, p.owner, [`[PHONE NOW]\n${phoneNow(p)}`, daysBlock(storyDays(m, p)), `[LIVES IN]\n${COUNTRIES[livesIn(p)] || livesIn(p) || '(unknown)'}`, money], { profile: p.financeProfile, story: CHAT_TOKENS.apps });
    const out = await askDraft(input, { force: true, system: AI_SYS_DELIVERY, maxTokens: 12000, effort: 'low' });
    const raw = jsonOf(out), d = parseDelivery(raw, accounts, tx, storyNow(p) || p.now || ''), at = storyNow(p) || p.now || '';
    // the shops nearby go after the ones they order from (the app's 동네 인기 가게)
    d.shops = [...d.shops, ...nearbyShops(raw, d.shops, (p.money?.currency || accounts[0]?.currency) === 'KRW')];
    // nothing after the story's now
    if (/^\d{2}-\d{2}/.test(at)) d.orders = d.orders.filter(o => !later(o.time, at));
    if (p.delivery) unpayOrders(m, p);
    // orders a reflection put in stay (their payments are the bank's own rows); the fill's own telling of the same
    // order (the same shop on the same day, or the same story event) is that one, not a second
    const kept = (p.delivery?.orders || []).filter(o => o.sync), plain = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const twin = o => kept.some(k => (o.ev && k.ev === o.ev) || (plain(k.shop) === plain(o.shop) && dayGap(String(k.time).slice(0, 5), String(o.time).slice(0, 5)) === 0));
    p.delivery = { ...d, orders: [...d.orders.filter(o => !twin(o)), ...kept].sort(byStory(p.now)), look: deliveryLook(p), at: storyNow(p) || p.now || '', nearbyAt: String(storyNow(p) || p.now || '').slice(0, 5), city: homeCity(p) };
    if (p.sync?.marks) p.sync.marks.delivery = markNow();
    ensureIds(p);
    payDeliveries(m, p);
    await saveMeta();
    // the shops nearby get their menus straight after, in a request of their own (a failure here leaves the app as filled)
    try { await fillShopMenus(m, p); } catch { /* asked again when the app is opened */ }
    return p.delivery;
});
