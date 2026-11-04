// 캐릭터 휴대폰 · 데이터: what the phone holds — the model's JSON cleaned and merged, the request (archive, lorebook, world),
// 롤플에 넣기, dates and times as the owner's phone shows them, and the places they have been.

import { ensureWealth, wealthBlock, wealthDate, wealthCheck, addWealthFX } from './wealth.js';
import { askDraft } from './ai.js';
import { ownerProfileBlock, resolvePhoneProfile } from './phoneprofile.js';
import { migrateBank, finance, finite, cash, reviseBaseline, positions } from './finance.js';
import { calendars, headingDate } from './calendar.js';
import { ctx, globalSettings, saveMeta } from './core.js';
import { chatRows, recentForCheck } from './drift.js';
import { applyInjection } from './inject.js';
import { knowledgeRows } from './knowledge.js';
import { headingPlaces, nameKey, nameRe } from './people.js';
import { estTok } from './recall.js';
import { recentTrackers } from './scenes.js';
import { parseSections, RANGE_HEAD, sectionKey, splitTail } from './sections.js';
import { glossaryEntries } from './translate.js';
import { worldText } from './world.js';
import { phoneChatScope } from './phonestory.js';
import { tidyKo, arr, evOf, gapDays, giftOf, hhmm, jsonOf, ko, parseJson, storyMin, byStory, yearIn, last4, line, num, pad, pick, str, when, withEv } from './phoneparse.js';
export { tidyKo, arr, gapDays, giftOf, hhmm, jsonOf, ko, last4, line, num, pad, pick, storyMin, byStory, str, when, withEv };
import { COUNTRY_TZ, applyDays, applyLife, applyWeather, cardClock, cityAt, dayGap, dlvClock, fillDays, lifeClock, lifeNow, weatherFrom, zoneShift } from './phonesynclife.js';
import { applyMoney, dlvTotal, investNow, moneyNow, payOrders, replayEffects, revertEffects } from './phonesyncmoney.js';
import { pruneDropped, srcOf, addFrom, orphanOf, itemMark, edited, busy, exclusive, joinComments, realign, bodyMark, newSync, syncOf, makeMark, settleMarks, pickRound, unreadCount, addDone, settleRound, archiveRound, archivedUnread, readBefore, reachesEnd, quoted, journalAdd, journalRead, journalWrite } from './phonesync.js';

export const WALLS = ['dusk', 'ocean', 'forest', 'rose', 'night', 'sand', 'mono', 'aurora'];
export const ACCENTS = ['blue', 'green', 'orange', 'pink', 'purple', 'red'];
export const MOODS = ['warm', 'cool', 'green', 'dark', 'bright', 'pink'];
export const COUNTRIES = { KR: '한국', US: '미국', GB: '영국', DE: '독일', FR: '프랑스', IT: '이탈리아', ES: '스페인', JP: '일본', CN: '중국', TW: '대만', CA: '캐나다', AU: '호주', RU: '러시아', BR: '브라질' };
export const CAP = { threads: 12, messages: 40, calls: 30, photos: 24, notes: 12, searches: 20, events: 16, contacts: 30, posts: 20, comments: 8, mails: 20, diary: 20, voice: 12 };
const LISTS = ['calls', 'photos', 'notes', 'searches', 'events', 'posts', 'mails', 'diary', 'voice'];

const DEVICE_RULES = `- Use the device described in the story when there is one.
- Otherwise choose a phone that suits the owner's means, work and habits, in the story's time. Choose the model and storage together; no fixed default capacity.
- Use a capacity offered for that specific model and an OS version that belongs with it. Invent a plausible serial number.
- Keep an existing device as it is. These details belong to the phone screen, not new events in the role-play.`;

export const AI_SYS_DEVICE = `GOAL
Fill the device information in one character's phone settings.

YOU GET
- COUNTRY.
- ARCHIVE, RECENT CHAT, OWNER, and sometimes STORY YEAR, WORLD, LOREBOOK, OWNER PROFILE and OWNER DOESN'T KNOW. Nothing on the phone may show what the owner doesn't know.

RULES
${DEVICE_RULES}

ANSWER — one JSON object, nothing else:
{ "name": the device's name, "model": model name, "os": OS name and version,
  "storage": storage capacity with its unit, "serial": serial number }`;

// 폰 만들기 and 새로 일어난 일 반영 share the test, the language, the times and the app items; making a phone adds the
// phone's own settings (country, wallpaper, device) and how much to fill
const PHONE_FACT = `ONE TEST FOR EVERY ITEM
Could this be on the owner's phone, given what the archive, lorebook and chat show? If not, leave it out.
- The lorebook counts as fact like the archive; where the two disagree, the archive wins.
- Events (a meeting, a fight, a confession, a trip, a loss) only if the archive or lorebook has them.
- Small everyday things around those events are fine: how a text was worded, a photo of a place they were, a search they would make.
- People: only people the story has. A relationship word (girlfriend, ex, husband, boss) only if the archive or chat uses it for them.
- Nothing later than the newest moment of the story.
- The diary holds only what the archive shows happened and what the owner felt about it; no new secrets, no new feelings.`;
// every time on the phone is the owner's own clock: a time written on the other side of the world is moved to theirs
export const OWN_CLOCK = `Every time is on the owner's phone clock, where the owner is now. A time shown on a screen or in a scene goes by the city of whoever's screen or scene it is: the owner's city, or no OWNER'S CLOCK, keeps it as it is; another city in OWNER'S CLOCK is moved by its hours there (a messenger timestamp on the other side's screen). A status line's time is the clock of the city its scene is in; OWNER'S CLOCK gives the newest one on the owner's clock when that is another city.`;
export const CLOCK_GET = `- OWNER'S CLOCK (sometimes): where the owner is, their time now, and how many hours the other saved cities and the people elsewhere are ahead or behind.`;
const PHONE_STYLE = `LANGUAGE
- Each text is in the language its writer would really use on a phone: from their nationality and where they live; between two people, the language they share.
- A text that is not in Korean gets "ko": a natural Korean translation. A Korean text gets no "ko".
- People write the way they talk in the archive and chat. Texts are short, like real texts.

TIMES
"MM-DD HH:MM" in story time; "now" is the newest moment of the story. A year only as STORY YEAR or the story itself gives one.
${OWN_CLOCK}`;
const PHONE_TEST = `${PHONE_FACT}\n\n${PHONE_STYLE}`;
const PHONE_ITEMS = `  "contacts": [{ "name": name in the story, "saved": how the owner saved them (a nickname, an emoji, or just the name) }],
  "threads": [{ "with": name, "messages": [{ "from": "me" or the sender's name, "text", "ko", "time" }],
               "draft": { "text", "ko", "time" } only when the archive or chat shows the owner wrote a text to them and didn't send it }],
  "calls": [{ "with": name, "type": "in" | "out" | "missed", "time", "min": minutes talked }],
  "photos": [{ "caption": what the photo shows, "ko", "time", "mood": one of ${MOODS.join(', ')} }],
  "notes": [{ "title", "kt": Korean title, "text", "ko", "time" }],
  "searches": [{ "q", "ko", "time", "tab": true if its page is still open on the phone, "mark": true if they bookmarked it }],
  "events": [{ "title", "ko", "date": "MM-DD", "time": "HH:MM" or "" }],
  "profile": { "handle": the owner's SNS name, "bio", "ko", "followers": a number, "following": a number },
  "posts": [{ "text", "ko", "photo": what the posted photo shows or "", "pko": its Korean, "time", "likes": a number,
              "comments": [{ "from": name, "text", "ko" }] }],
  "mails": [{ "from": sender, "subject", "ks": Korean subject, "text", "ko", "time", "unread": true or false }],
  "diary": [{ "date": "MM-DD", "title", "kt": Korean title, "text", "ko" }],
  "voice": [{ "title", "kt", "text", "ko", "time", "sec", "place" }] only when the archive or chat shows the owner recorded one`;
const PHONE_LAST = `Any item may carry "ev": a short tag for one story event, the same on every item that comes from it (the flight's mail, its event and its photo all "ev": "berlin-flight").
A booking the story has carries the details a real one would (a booking number, a seat, a gate), made up to fit. Never a booking, a trip or a purchase the story doesn't have.`;

export const AI_SYS_PHONE = `GOAL
Show what one character's phone holds right now, in a long role-play. The user opens it to peek at the story from the phone's side.
An app draws the screens from your JSON; you only write the content.

YOU GET
- ARCHIVE: the story so far, in sections (#numbers are chat messages), with the current state at the end.
- WORLD (sometimes): the shared setting.
- LOREBOOK (sometimes): setting notes the user picked.
- RECENT CHAT: the messages after the archive, oldest first.
- OWNER: whose phone it is. STORY YEAR (sometimes): the story's year.
- OWNER PROFILE (sometimes): the background the user chose for the owner.
- OWNER DOESN'T KNOW (sometimes): facts the owner does not know, or only suspects. Nothing on the phone may show them as known.
- DEVICE — locked (sometimes): the phone they already have. Keep it as it is.
${CLOCK_GET}

${PHONE_TEST}

EVERYDAY
- Besides the story, a few plain records of the owner's daily life, from their profile, job and habits as the archive shows them: a shopping list, a recipe search, a newsletter, a photo of the sky, a reminder for the dentist. Each has "everyday": true.
- No more than a third of any list. No event, person, place or feeling the story doesn't have in them.

DEVICE
${DEVICE_RULES}

JSON (one object, nothing before or after it)
{
  "country": two-letter code of the country the owner lives in and their phone is set to, like "KR", "US", "DE",
  "wallpaper": one of ${WALLS.join(', ')}, the one that suits the owner,
  "accent": one of ${ACCENTS.join(', ')},
  "now": "MM-DD HH:MM",
  "device": { "name": device name, "model": model name, "os": OS and version, "storage": capacity with GB or TB, "serial": invented serial number },
${PHONE_ITEMS}
}
At most 6 threads of up to 12 messages, 10 calls, 8 photos, 5 notes, 8 searches (3 open at most), 6 events, 5 posts with up to 4 comments,
6 mails, 5 diary entries. Fewer is fine; an empty list is fine. The diary has no "everyday" entries.
Oldest first in every list.
${PHONE_LAST}`;

// 새로 일어난 일 반영: one round of unread messages at a time; each story event says where it comes from
// 새로 일어난 일 반영: the request is put together from the apps the phone has. A phone without a bank, a delivery app or
// the everyday apps gets none of their rules or fields (the request stays short and cheap).
// life: 시계 · 건강 · 파일 (and 날씨 only when no status line gives it: weather)
// weather: the model writes the weather (no status line gives it, or the day moved on); tracker: a status line gives some
// split: the first of two steps (core): no money, each event marked "money" when it touches it (moneySystem writes it after)
export function updateSystem({ money = true, delivery = false, life = false, weather = false, tracker = false, split = false, invest = false, zone = false } = {}) {
    const paid = delivery ? 'order, ticket or delivery' : 'order or ticket';
    return `${split ? 'STAGE: core\n' : ''}GOAL
Add to one character's phone what a few new chat messages put on it, in a long role-play. The user opens the phone to peek at the story from the phone's side.
An app adds your JSON to the phone; you only write what is new.${split ? ' Money is written in a second step: here you only mark the events that touch it.' : ''}

YOU GET
- NEW MESSAGES: the messages to read now, each with its number (#123).
- ARCHIVE FOR THESE MESSAGES (sometimes): summary sections covering them, or a stretch archived before the phone read it (its messages are not in NEW MESSAGES). They count as evidence, like the messages.
- ARCHIVE BEFORE (sometimes): what happened earlier. Background; nothing in it is new.
- STORY NOW (sometimes): where the story stands after these messages. Background.
- EVENTS ON THE PHONE: story events the phone already holds, with their ids.
- DAYS (sometimes): the story's days from the day before these messages on, with their weekdays. A weekday the story names ("on Friday") is the next one there.
- MESSAGES READ BEFORE, NOW CHANGED (sometimes): messages put on the phone before and edited since, with the events they gave.
${money ? `- MONEY NOW and INVESTMENTS NOW (sometimes): the bank, card, orders, tickets and brokerage, with record ids. WEALTH (sometimes): how much the owner has.\n` : ''}${delivery ? `- DELIVERY SHOPS: the shops the delivery app already has.\n` : ''}${life ? `- LIFE NOW: the alarms, files and health days the phone already holds, with record ids.\n` : ''}${weather && tracker ? `- WEATHER NOW: the date, time, place and weather from the chat's last status line up to these messages (a scene the owner isn't in: its place and weather only).\n` : ''}- PHONE NOW: the newest of what the phone holds.
${CLOCK_GET}
- OWNER, and sometimes STORY YEAR, WORLD, LOREBOOK, OWNER PROFILE and OWNER DOESN'T KNOW. Nothing on the phone may show what the owner doesn't know.

WHAT IS NEW
- Only what happens in NEW MESSAGES or ARCHIVE FOR THESE MESSAGES. Guesses and memories of earlier days add nothing.
- A plan made in these messages goes in the calendar; what is planned hasn't happened yet (no payment, no photo).
- Each message's own replies, orders and payments belong to the event in that message, not folded into an earlier one.
- An event in EVENTS ON THE PHONE keeps its id; add only what the phone doesn't hold yet.
- MESSAGES READ BEFORE, NOW CHANGED were already put on the phone: give their events the ids listed there${split ? '' : '; a payment in them is that same payment, its amount corrected if it changed'}.
${split ? `- A scene that only touches these apps (a taxi paid, a basket filled${invest ? ', a share price mentioned' : ''}) is still an event, with its "apps".\n` : ''}- Small everyday things around an event are fine: how a text was worded, a photo of the place, a search they would make.
- People: only people the story has. A relationship word (girlfriend, ex, husband, boss) only if the messages or archive use it for them.
- A diary entry holds only what these messages show and what the owner felt about it; no new secrets, no new feelings.

WHERE IT COMES FROM
- "at": the number of the message the event happens in. For an archive section, the message in its range it belongs to.
- "quote": a few words copied exactly as written in that message or section, not reworded.
- "date" and "time": when it happens in that message ("MM-DD", "HH:MM" if known). A plan for later happens when it is made; its later day goes only on the calendar item.
- "now": the moment of the newest message, never a time something is only planned for.
- "ownerCity": only when these messages take the owner to another city (a trip, a move, coming home): { "city": in English, "names": [each name the messages and status lines write it as, exactly, then its English and Korean names], "tz": its time zone like "Asia/Seoul" }; else null.
${zone ? `- "statusCity": the newest status line in these messages is from a scene the app can't place. Whose clock does it show? A city or person in OWNER'S CLOCK, "owner" for the owner's own, or "" when the messages don't say.\n` : ''}${split ? `- "apps": "money" when the event has anything for the bank, cards, orders, tickets or the delivery app (its basket too)${invest ? '; "invest" for the brokerage (a trade, a share price the story gives, a share they start watching, a stake)' : ''}; else []. When unsure, include it.\n` : ''}${life ? `
LIFE
- An alarm the owner sets, changes or switches on or off in these messages; a timer they set; a file they receive, save, scan or delete. Pictures the camera takes go to photos, not files.
- An alarm for one occasion (a flight, an appointment) rings once: "days": [] and its "date". Only an alarm the owner keeps for every week has "days".
- A record already in LIFE NOW is changed with "change": its id; write only the fields that changed. A deleted file is "deleted": true.
- Health: a row for every story day these messages move into. A day these messages show goes in that event's "phone"."health"; a day already in LIFE NOW that the story now shows is rewritten the same way. Every other new day goes in the top-level "days", written freely from the character and their life (a lazy Sunday, a day on their feet, a sleepless night), still following that day's events and tickets.
- "screen" on each day: that day's phone use, from what happened and how they felt (a fight: hours of texting late into the night; a day out with friends: barely any), in their own habits (LIFE NOW's usual), plus any other app that day called for, by its real name (a trip: maps, a translator).
- A lasting change to their habits or body these messages state (they lost weight, quit coffee, drink more water, get up earlier now, quit a game, glued to the phone lately): that event's "phone"."usual" with only what changed. Nothing said: no "usual".
${weather ? `- "weather": ${tracker ? 'WEATHER NOW stands for an owner in that scene (its date, time, place and weather); write the rest of the forecast to agree with it, "from": "chat". An owner elsewhere gets the weather where they are.' : 'what these messages describe, else the archive. If the story\'s day or place changed with nothing to go on, what fits the season and place, "from": "guess". If neither changed and nothing describes it: null (the app keeps the last weather).'}
- With new weather, also write each saved city's "cond", "temp", "hi" and "lo".
` : ''}` : ''}${money ? `
MONEY (only with MONEY NOW or INVESTMENTS NOW)
- A payment, transfer, refund, order, ticket or trade that happens in these messages goes in the event's "money".
- An amount the story gives stays as it is. A real one with no amount gets a plausible amount for the owner, the place and MONEY NOW: "amountFrom": "guess".
- A payment the scene plainly implies (eating out, a taxi ride) counts; one someone else may have paid does not. Never invent a payment the scene doesn't show or imply.
- Every move, trade and order says "occurrence": "new" when it happens in this message, "again" when the message only talks about one made before.
- Already in MONEY NOW or INVESTMENTS NOW: its id as "already"; it is not paid again.
- A card purchase goes on the card account; a refund is plus; paying the card off is a transfer from the bank.
- No money is made up to cover a payment; a balance may go below zero.
- Company money, family money and an inheritance still to come are not the owner's cash.
- A new paid ${paid} has its payment as a move in the same event.
- A cancelled order${delivery ? ' or delivery' : ''} moves no money; if it was already paid, its refund is a plus move.
${delivery ? `- A delivery paid in cash at the door has no move. "tip" only where tipping is the custom; elsewhere 0.
- A delivery from a shop not in DELIVERY SHOPS also gives "newShop" with 2 to 4 dishes: the one ordered and others it would have.
` : ''}` : ''}
${PHONE_STYLE.replace('; "now" is the newest moment of the story.', '.')}

ANSWER — one JSON object, nothing else:
{ "now": "MM-DD HH:MM", "ownerCity": null,${zone ? ' "statusCity": "",' : ''}
  "events": [{ "id": an id from EVENTS ON THE PHONE, or a short new tag like "berlin-flight", "at": 123, "quote": "exact words",
               "date": "MM-DD", "time": "HH:MM" or "", "summary": "one short line",${split ? ` "apps": [] or ["money"${invest ? ', "invest"' : ''}],` : ''}
               "phone": { only the app items this event puts on the phone }${money ? `,
               "money": { "amountFrom": "story" | "guess",
                          "moves": [{ "account": a bank account's last 4 digits or "broker:EUR", "amount": minus for money out, "currency", "who", "ko", "memo": what it was for, "kind": "card" | "transfer" | "deposit" | "cash" (taken out as cash), "fee": a transfer fee charged on top of "amount", on the sending move, "occurrence": "new" | "again", "already": "" }],
                          "trades": [{ "kind": "buy" | "sell" | "dividend", "symbol", "name", "ko" and "currency" (a share not in INVESTMENTS NOW), "quantity", "price", "fee", "amount": dividend only, "occurrence": "new" | "again", "already": "" }],
                          "orders": [{ "shop", "item", "ko", "option", "qty", "price": unit price, "status": "ordered" (the default) | "shipped" | "on the way" | "delivered" | "cancelled" | "returning" | "returned" | "refunded", "eta": "MM-DD" or "", "gift", "paid": false only when someone else pays or it is paid on delivery, "occurrence": "new" | "again", "already": "" }],
                          "passes": [{ "kind": "flight" | "train" | "hotel" | "event" | "other", "by", "from", "to", "date": "MM-DD", "time", "seat", "gate", "no", "status", "already": "" }]${delivery ? `,
                          "deliveries": [{ "shop", "items": [{ "name", "ko", "option", "optionKo", "qty", "price": unit price, "pic": { "base": the dish in 1 to 3 English words, "with": [up to 3 main ingredients, like "beef"], "size": "regular" | "large", "set": [a set's sides or drinks] } }], "fee", "tip", "discount", "mode": "delivery" | "pickup", "time": "MM-DD HH:MM", "arrived": "MM-DD HH:MM" or "", "to": "home" | "work" | a person's name, "address", "left": where the courier left it, or "", "noteShop", "noteShopKo", "noteRider", "noteRiderKo", "noCutlery", "for": how many people, "status": "on the way" | "delivered" | "cancelled" | "refunded", "gift", "occurrence": "new" | "again", "already": "",
                                          "newShop": { "name": the same as "shop", "ko", "cuisine", "menu": [{ "name", "ko", "desc", "price", "top": true for its best-known dish, "pic" }] } or null }]` : ''} }` : ''} }]${life ? `,
  "days": [{ the same fields as "health" }]` : ''}${life && weather ? `,
  "weather": { "place", "date", "time", "from": "chat" | "archive" | "guess", "cond": "clear" | "partly" | "cloudy" | "drizzle" | "rain" | "sleet" | "snow" | "fog" | "storm" | "wind", "temp", "hi", "lo", "line", "ko",
               "hours": [6 of { "time", "cond", "temp", "rain": percent }] (the hours ahead when the sky will change, else []), "days": [10 of { "day", "cond", "lo", "hi", "rain": percent }],
               "tiles": { "rain24": mm today, "rainNext": mm by tomorrow, "wind": km/h, "dir", "humidity", "feels": only when the story gives it },
               "cities": [{ "name", "cond", "temp", "hi", "lo" }, a city newly saved (home, work, family, a trip) also "tz", "note": a few words, "added": true] } or null` : ''} }
${money ? `"money" only when money moves or an order or ticket changes.` : ''}
${money ? `Also in "money" when these messages show them: "newAccount": { "kind": "checking" | "savings" | "credit", "name", "last4", "currency", "balance" } (an account or card the owner opens), "newCard": { "account": last4, "exp": "MM/YY" }${delivery ? `, "cart": { "shop", "items": [like a delivery's] } (dishes put in the basket and not ordered)` : ''}, "watch": [{ "symbol", "name", "currency", "note", "ko" }] (a share they start watching), "quotes": [{ "symbol", "date", "value", "evidence": exact words }] (a price the story gives), "stakes": [{ "company", "listed", "percent", "holder", "voter", "beneficiary", "restriction", "value", "currency", "evidence": exact words }] (a stake the story says they now hold).
` : ''}In "events", a plan moved or called off is its item again with "was": the date it had, or "cancelled": true. In "threads", a text the owner deleted is { "text", "deleted": true }.
Items in "phone":
{
${PHONE_ITEMS}${life ? `,
  "alarms": [{ "change": an id or "", "time", "label", "ko", "days": the weekdays it repeats or [], "date": "MM-DD" for a one-time alarm, "on", "wake", "then", "snooze", "snoozeCount", "sound" }],
  "files": [{ "change": an id or "", "name", "kind", "folder": one of LIFE NOW's "folders" (downloads are "Downloads"), or a new one the story makes, "size": KB, "time", "from", "pages", "length": "M:SS" for audio or video, "tag": "red" | "orange" | "", "private", "preview", "look": what it shows (a picture or video: "sea" | "city" | "night" | "food" | "hills" | "pet" | "sunset" | "mountain" | "snow" | "flower" | "interior" | "concert" | "paper" | "screenshot" | "map"; a document: "ticket" (a flight or train ticket, "preview": "carrier · from → to · date") | "receipt" | "invoice" | "cv" | "letter" | "certificate" | "recipe" | "medical" | "menu" | "contract" | "notes"; audio: "voice" | "music"), "ko", "opened", "deleted": true when removed }],
  "health": [{ "date": the day they woke, "sleep", "wake", "woke": times awake in the night, "steps", "km", "floors", "hr": [low, high], "workout": { "kind", "time", "min", "km" } or null, "coffee": cups, "coffeeKind", "water": litres, "weight": kg only when they weighed, "screen": { "apps": { app name: minutes }, "pickups", "late": "HH:MM" } }],
  "timers": [{ "label", "ko", "sec" }],
  "usual": { "weight": kg, "coffee": cups a day, "coffeeKind", "coffeeKo", "water": litres a day, "bed": "HH:MM", "sleep": "HH:MM", "wake": "HH:MM", "steps", "workouts": a week, "rest": resting heart rate, "height": cm, "screen": { "add": [{ "app": its real name, "kind", "min" }] (installed, or used more or less), "drop": [apps deleted], "pickups", "late" } }` : ''}
}
Fewer is fine. No new events: "events": [].
In "phone" items, a booking the story has carries the details a real one would (a booking number, a seat, a gate), made up to fit; never a booking the story doesn't have.${money ? ' Money amounts follow MONEY.' : ''}`;
}
export const AI_SYS_PHONE_UPDATE = updateSystem();

// ---- 반영 in two steps (docs/REFLECT-2STAGE-PLAN.md): core reads the events and the plain apps and marks what else each
// event touches; money and life are asked after, only when needed, each with its own short instructions. The first
// line names the step (the test harness files each answer under it)
// core: the old one-step instructions without money (life, files, health and the weather stay: they read the whole
// messages anyway), with each event marked "money" when it touches it
export const coreSystem = ({ life = false, weather = false, tracker = false, invest = false, zone = false } = {}) => updateSystem({ money: false, delivery: false, life, weather, tracker, split: true, invest, zone });
// delivery: the phone has the delivery app
// invest: an event touches the brokerage (trades, prices, watched shares, stakes); else none of it is asked or sent
export function moneySystem({ delivery = false, invest = false } = {}) {
    const paid = delivery ? 'order, ticket or delivery' : 'order or ticket';
    return `STAGE: money
GOAL
Write the money of story events already read from a few new chat messages in a long role-play: payments, transfers, refunds, orders and tickets${invest ? ', trades' : ''}${delivery ? ', and food deliveries' : ''}. An app adds your JSON to the phone's bank, wallet, orders${delivery ? ', delivery app' : ''}${invest ? ' and brokerage' : ''}.

YOU GET
- EVENTS: the story events to write money for, each with its id, message number, date, time, summary and quote. An event marked "changed" was read before and its message edited since.
- MESSAGES: the messages those events come from, with the ones next to them. ARCHIVE FOR THESE MESSAGES (sometimes): summary sections covering them.
- MONEY NOW${invest ? ' (sometimes) and INVESTMENTS NOW (sometimes)' : ''}: the bank, card, orders${invest ? ', tickets and brokerage' : ' and tickets'}, with record ids. WEALTH (sometimes): how much the owner has.
${delivery ? `- DELIVERY SHOPS: the shops the delivery app already has, and the basket.\n` : ''}- DAYS and STORY YEAR (sometimes), OWNER, and sometimes OWNER PROFILE.

MONEY
- A payment, transfer, refund, order${invest ? ', ticket or trade' : ' or ticket'} that happens in an event goes in that event's "money", under its id. An event with no money is left out.
- An amount the story gives stays as it is. A real one with no amount gets a plausible amount for the owner, the place and MONEY NOW: "amountFrom": "guess".
- A payment the scene plainly implies (eating out, a taxi ride) counts; one someone else may have paid does not. Never invent a payment the scene doesn't show or imply.
- Every move${invest ? ', trade' : ''} and order says "occurrence": "new" when it happens in this message, "again" when the message only talks about one made before.
- Already in MONEY NOW${invest ? ' or INVESTMENTS NOW' : ''}: its id as "already"; it is not paid again. A "changed" event's payment is that same payment, its amount corrected if it changed.
- A card purchase goes on the card account; a refund is plus; paying the card off is a transfer from the bank.
- No money is made up to cover a payment; a balance may go below zero.
- Company money, family money and an inheritance still to come are not the owner's cash.
- A new paid ${paid} has its payment as a move in the same event.
- A cancelled order${delivery ? ' or delivery' : ''} moves no money; if it was already paid, its refund is a plus move.
${delivery ? `- A delivery paid in cash at the door has no move. "tip" only where tipping is the custom; elsewhere 0.
- A delivery from a shop not in DELIVERY SHOPS also gives "newShop" with 2 to 4 dishes: the one ordered and others it would have.
` : ''}- A ticket or booking the story has carries the details a real one would (a booking number, a seat, a gate), made up to fit.
- People: only people the story has.

LANGUAGE
Banks, shops, merchants and items named as they would be in the owner's country. A name not in Korean gets "ko"; a Korean one gets none.

ANSWER — one JSON object, nothing else:
{ "events": [{ "id": an id from EVENTS,
               "money": { "amountFrom": "story" | "guess",
                          "moves": [{ "account": a bank account's last 4 digits${invest ? ' or "broker:EUR"' : ''}, "amount": minus for money out, "currency", "who", "ko", "memo": what it was for, "kind": "card" | "transfer" | "deposit" | "cash" (taken out as cash), "fee": a transfer fee charged on top of "amount", on the sending move, "occurrence": "new" | "again", "already": "" }],
${invest ? `                          "trades": [{ "kind": "buy" | "sell" | "dividend", "symbol", "name", "ko" and "currency" (a share not in INVESTMENTS NOW), "quantity", "price", "fee", "amount": dividend only, "occurrence": "new" | "again", "already": "" }],
` : ''}                          "orders": [{ "shop", "item", "ko", "option", "qty", "price": unit price, "status": "ordered" (the default) | "shipped" | "on the way" | "delivered" | "cancelled" | "returning" | "returned" | "refunded", "eta": "MM-DD" or "", "gift", "paid": false only when someone else pays or it is paid on delivery, "occurrence": "new" | "again", "already": "" }],
                          "passes": [{ "kind": "flight" | "train" | "hotel" | "event" | "other", "by", "from", "to", "date": "MM-DD", "time", "seat", "gate", "no", "status", "already": "" }]${delivery ? `,
                          "deliveries": [{ "shop", "items": [{ "name", "ko", "option", "optionKo", "qty", "price": unit price, "pic": { "base": the dish in 1 to 3 English words, "with": [up to 3 main ingredients, like "beef"], "size": "regular" | "large", "set": [a set's sides or drinks] } }], "fee", "tip", "discount", "mode": "delivery" | "pickup", "time": "MM-DD HH:MM", "arrived": "MM-DD HH:MM" or "", "to": "home" | "work" | a person's name, "address", "left": where the courier left it, or "", "noteShop", "noteShopKo", "noteRider", "noteRiderKo", "noCutlery", "for": how many people, "status": "on the way" | "delivered" | "cancelled" | "refunded", "gift", "occurrence": "new" | "again", "already": "",
                                          "newShop": { "name": the same as "shop", "ko", "cuisine", "menu": [{ "name", "ko", "desc", "price", "top": true for its best-known dish, "pic" }] } or null }]` : ''} } }] }
Also in "money" when the messages show them: "newAccount": { "kind": "checking" | "savings" | "credit", "name", "last4", "currency", "balance" } (an account or card the owner opens), "newCard": { "account": last4, "exp": "MM/YY" }${delivery ? `, "cart": { "shop", "items": [like a delivery's] } (dishes put in the basket and not ordered)` : ''}${invest ? `, "watch": [{ "symbol", "name", "currency", "note", "ko" }] (a share they start watching), "quotes": [{ "symbol", "date", "value", "evidence": exact words }] (a price the story gives), "stakes": [{ "company", "listed", "percent", "holder", "voter", "beneficiary", "restriction", "value", "currency", "evidence": exact words }] (a stake the story says they now hold).` : '.'}
No money anywhere: "events": [].`;
}

// ---- what the model sends back, cleaned: known keys only, text cut short, times in one shape

// a country as the model may write it: "DE", "DEU", "Germany", "독일"
const ISO3 = { KOR: 'KR', USA: 'US', GBR: 'GB', DEU: 'DE', FRA: 'FR', ITA: 'IT', ESP: 'ES', JPN: 'JP', CHN: 'CN', TWN: 'TW', CAN: 'CA', AUS: 'AU', RUS: 'RU', BRA: 'BR' };
const NAMED = { korea: 'KR', 'south korea': 'KR', 'united states': 'US', usa: 'US', america: 'US', 'united kingdom': 'GB', uk: 'GB', britain: 'GB', england: 'GB', germany: 'DE', deutschland: 'DE', france: 'FR', italy: 'IT', spain: 'ES', japan: 'JP', china: 'CN', taiwan: 'TW', canada: 'CA', australia: 'AU', russia: 'RU', brazil: 'BR' };
export const countryOf = v => { const s = String(v || '').trim(), u = s.toUpperCase(); if (/^[A-Z]{2}$/.test(u)) return u; if (ISO3[u]) return ISO3[u]; return NAMED[s.toLowerCase()] || Object.entries(COUNTRIES).find(([, n]) => n === s)?.[0] || ''; };
// a count as a profile writes it: 1200, "1.2k", "3.4만", "2M"
const countOf = v => { const s = String(v ?? '').trim(), n = num(s); if (n === null) return 0; const k = /만/.test(s) ? 1e4 : /백만|\d\s*[mM]\b/.test(s) ? 1e6 : /\d\s*[kK]\b|천/.test(s) ? 1e3 : 1; return Math.max(0, Math.round(n * k)); };
const truthy = v => v === true || /^(true|yes|ja|예|네)$/i.test(String(v ?? '').trim());
// owner: whose phone it is (a message they wrote is "me", whatever name the model gives it; no thread or call with themselves)
export function parsePhone(out, owner = '') {
    const s = String(out || '').replace(/```(?:json)?/gi, '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('모델 답에서 폰 내용(JSON)을 찾지 못했어요');
    let raw;
    try { raw = parseJson(s.slice(a, b + 1), { salvage: true }); } catch { throw new Error('모델 답의 JSON이 깨져 있어요. 다시 해 보세요'); }
    // an everyday record the model made up from the owner's habits stays apart from the story (재구성)
    const tag = (x, raw) => (raw?.everyday === true ? { ...withEv(x, raw), src: 'guess' } : withEv(x, raw));
    const self = owner ? nameKey(owner) : '', mine = v => !!self && nameKey(line(v, 40)) === self;
    const msg = x => ({ from: mine(x?.from) ? 'me' : line(x?.from, 40) || 'me', text: str(x?.text, 600), ko: ko(x?.ko), time: when(x?.time), ...(x?.deleted === true ? { deleted: true } : {}) });
    // a translation that only repeats its text (a Korean text given the same "ko") is none: it would show twice
    const same = (a, b) => !!a && !!b && a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();
    const PAIRS = [['text', 'ko'], ['caption', 'ko'], ['q', 'ko'], ['title', 'ko'], ['title', 'kt'], ['subject', 'ks'], ['photo', 'pko'], ['bio', 'ko']];
    const unko = o => { if (o && typeof o === 'object') { for (const [a, b] of PAIRS) if (same(o[a], o[b])) o[b] = ''; for (const v of Object.values(o)) if (v && typeof v === 'object') unko(v); } return o; };
    return unko({
        device: parseDevice(raw.device),
        country: countryOf(raw.country),
        wall: pick(raw.wallpaper, WALLS, ''),
        accent: pick(raw.accent, ACCENTS, ''),
        now: when(raw.now),
        contacts: arr(raw.contacts).map(x => ({ name: line(x?.name, 40), saved: line(x?.saved, 40) })).filter(x => x.name && !mine(x.name)).slice(0, CAP.contacts),
        threads: arr(raw.threads).map(t => { const d = t?.draft && str(t.draft.text, 600); return { with: line(t?.with, 40), messages: arr(t?.messages).map(msg).filter(x => x.text), ...(d ? { draft: { text: d, ko: ko(t.draft.ko), time: when(t.draft.time), src: 'story' } } : {}) }; }).filter(t => t.with && !mine(t.with) && t.messages.length).slice(0, CAP.threads),
        calls: arr(raw.calls).map(x => tag({ with: line(x?.with, 40), type: pick(x?.type, ['in', 'out', 'missed'], 'in'), time: when(x?.time), min: Math.max(0, Math.min(600, Math.round(num(x?.min) || 0))) }, x)).filter(x => x.with && !mine(x.with)),
        photos: arr(raw.photos).map(x => tag({ caption: line(x?.caption, 200), ko: ko(x?.ko), time: when(x?.time), mood: pick(x?.mood, MOODS, 'warm') }, x)).filter(x => x.caption),
        notes: arr(raw.notes).map(x => tag({ title: line(x?.title, 80), kt: line(x?.kt, 80), text: str(x?.text, 1500), ko: str(x?.ko, 1500), time: when(x?.time) }, x)).filter(x => x.title || x.text),
        searches: arr(raw.searches).map(x => tag({ q: line(x?.q, 120), ko: ko(x?.ko), time: when(x?.time), ...(truthy(x?.tab) ? { tab: true } : {}), ...(truthy(x?.mark) ? { mark: true } : {}) }, x)).filter(x => x.q),
        events: arr(raw.events).map(x => tag({ title: line(x?.title, 80), ko: ko(x?.ko), date: when(x?.date).slice(0, 5), time: hhmm(x?.time), ...(when(x?.was).slice(0, 5) ? { was: when(x.was).slice(0, 5) } : {}), ...(x?.cancelled === true ? { cancelled: true } : {}) }, x)).filter(x => x.title && (x.date || x.cancelled)),
        profile: raw.profile && typeof raw.profile === 'object' ? { handle: line(raw.profile.handle, 40), bio: line(raw.profile.bio, 200), ko: ko(raw.profile.ko), followers: countOf(raw.profile.followers), following: countOf(raw.profile.following) } : null,
        posts: arr(raw.posts).map(x => tag({ text: str(x?.text, 800), ko: str(x?.ko, 800), photo: line(x?.photo, 200), pko: ko(x?.pko), time: when(x?.time), likes: Math.min(99999, countOf(x?.likes)),
            comments: arr(x?.comments).map(c => ({ from: line(c?.from, 40), text: line(c?.text, 300), ko: ko(c?.ko) })).filter(c => c.from && c.text).slice(0, CAP.comments) }, x)).filter(x => x.text || x.photo),
        mails: arr(raw.mails).map(x => tag({ from: line(x?.from, 60), subject: line(x?.subject, 120), ks: line(x?.ks, 120), text: str(x?.text, 2000), ko: str(x?.ko, 2000), time: when(x?.time), unread: truthy(x?.unread) }, x)).filter(x => x.from && (x.subject || x.text)),
        diary: arr(raw.diary).map(x => tag({ date: when(x?.date).slice(0, 5), title: line(x?.title, 80), kt: line(x?.kt, 80), text: str(x?.text, 2000), ko: str(x?.ko, 2000) }, x)).filter(x => x.date && x.text),
        voice: arr(raw.voice).map(x => tag({ title: line(x?.title, 80), kt: line(x?.kt, 80), text: str(x?.text, 2000), ko: str(x?.ko, 2000), time: when(x?.time), sec: secOf(x?.sec), place: line(x?.place, 60), src: 'story' }, x)).filter(x => x.text),
    });
}

// what makes two items the same, list by list: an update that repeats what the phone holds adds nothing
const SIG = {
    msg: x => [nameKey(x.from), x.text, x.time], calls: x => [nameKey(x.with), x.type, x.time], photos: x => [x.caption, x.time],
    notes: x => [x.title, x.text], searches: x => [x.q, x.time], events: x => [x.title, x.date, x.time], posts: x => [x.text, x.photo, x.time],
    mails: x => [x.from, x.subject, x.time], diary: x => [x.date, x.title, x.text], voice: x => [x.title, x.time],
};
const sigOf = (k, x) => JSON.stringify(SIG[k](x)).toLowerCase();
// the same record told again with its clock a little off ("21:00" then "21:02"): the one there, not a second
// (a short text like "ㅋㅋ" or "ok" may really come twice, so only a longer one is matched this way)
const NEAR = { msg: x => [nameKey(x.from), x.text], calls: x => [nameKey(x.with), x.type], photos: x => [x.caption], mails: x => [x.from, x.subject], searches: x => [x.q], voice: x => [x.title] };
// how far the clock may be off, in minutes, before it is another record (a call back an hour later is a second call)
const NEAR_MIN = { msg: 15, calls: 10, photos: 30, mails: 120, searches: 15, voice: 30 };
const nearMin = t => { const x = parts(t); return x && x.h !== null ? storyMin(t, '') : null; };
const twinOf = (k, list, a) => {
    const sig = sigOf(k, a), exact = list.find(x => sigOf(k, x) === sig);
    if (exact || !NEAR[k] || (k === 'msg' && String(a.text || '').trim().length < 6)) return exact || null;
    const key = JSON.stringify(NEAR[k](a)).toLowerCase(), t = nearMin(a.time);
    return t === null ? null : list.find(x => JSON.stringify(NEAR[k](x)).toLowerCase() === key && nearMin(x.time) !== null && Math.abs(nearMin(x.time) - t) <= NEAR_MIN[k]) || null;
};
const fresh = (k, old, add) => { const out = []; for (const x of add) if (!twinOf(k, old, x) && !twinOf(k, out, x)) out.push(x); return out; };
// an update's new items go after the old ones; every list keeps its newest, the threads the ones written in last
// every record gets the app's own id (not the model's): links between apps point at it, and it survives trimming and 다시 만들기.
// Phones saved before ids get theirs when next opened or made
const newId = () => Math.random().toString(36).slice(2, 8);
export function ensureIds(p) {
    let n = 0;
    const mo = p?.money, lf = p?.life, dv = p?.delivery;
    for (const xs of [...[...LISTS, 'threads', 'contacts'].map(k => p?.[k]), mo?.tx, mo?.passes, mo?.orders, mo?.bank?.accounts,
        lf?.clock?.alarms, lf?.clock?.timers, lf?.health?.days, lf?.files?.folders, lf?.files?.items, lf?.weather?.cities, dv?.shops, dv?.orders]) for (const x of xs || []) if (x && typeof x === 'object' && !x.id) { x.id = newId(); n++; }
    return n;
}
// 다시 만들기 of an app: a record that comes back the same keeps what the user did with it (its id, picture, read state, results page)
const CARRY = ['id', 'img', 'tags', 'via', 'seen', 'results', 'draft', 'closed', 'marks', 'unmark'];
function carryOver(k, was, now) {
    const keyOf = k === 'threads' ? t => nameKey(t.with) : k === 'contacts' ? c => nameKey(c.name) : SIG[k] ? x => sigOf(k, x) : null;
    if (!keyOf || !Array.isArray(was)) return;
    const old = new Map(was.map(x => [keyOf(x), x]));
    for (const x of now) {
        const o = old.get(keyOf(x));
        if (!o) continue;
        for (const f of CARRY) if (o[f] !== undefined && x[f] === undefined) x[f] = o[f];
        if (k === 'mails' && o.unread === false) x.unread = false;
    }
}
// 재구성 (src "guess") records are the model's imagining, not the story: they never go back to the model or into the role-play
export const isGuess = x => x?.src === 'guess';

// a reflection keeps everything (keepAll); making a phone keeps each list to its size
function mergePhone(p, add, { keepAll = false } = {}) {
    if (!p.device && add.device) p.device = add.device;
    const keep = (list, n) => (keepAll ? list : list.slice(-n));
    const lk = v => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    // the same text, written a little differently: equal letters, or one holding the other when the shorter has 3 letters or more and they are
    // close in length. A text of emoji or marks alone ("👍") has no letters: only the very same text is it (an empty key
    // would sit inside every text), and a short "응" inside a long text is not that text
    const sameText = (a, b) => {
        const x = lk(a), y = lk(b);
        if (!x || !y) return !x && !y && String(a || '').trim() === String(b || '').trim() && !!String(a || '').trim();
        if (x === y) return true;
        const [s, l] = x.length <= y.length ? [x, y] : [y, x];
        return s.length >= 3 && s.length / l.length >= 0.6 && l.includes(s);
    };
    for (const t of add.threads) {
        const old = p.threads.find(x => nameKey(x.with) === nameKey(t.with));
        // a text the owner deleted: the one there is marked (it stays for 되돌리기), never added again
        // (one the phone never had, a thread new in this round too, goes in marked, so the data holds it)
        const gone = t.messages.filter(x => x.deleted), matched = new Set();
        if (gone.length && old) for (const g of gone) { const o = [...old.messages].reverse().find(x => !x.deleted && sameText(x.text, g.text)); if (o) { o.deleted = true; matched.add(g); } }
        t.messages = t.messages.filter(x => !matched.has(x));
        // in story order: a later round can bring texts from before the ones there (an earlier stretch read late)
        if (old) { old.messages = keep([...old.messages, ...fresh('msg', old.messages, t.messages)].sort(byStory(p.now)), CAP.messages); if (t.draft) old.draft = t.draft; }
        else p.threads.push({ ...t, messages: keep(fresh('msg', [], t.messages).sort(byStory(p.now)), CAP.messages) });
    }
    p.threads = keep([...p.threads].sort(byStory(p.now, lastTime)), CAP.threads);
    joinComments(p.posts, add.posts, CAP.comments);
    // a plan told again with its time now ("dinner 11-03" then "dinner 11-03 19:00"): the same event, given its time
    for (const e of add.events || []) { const o = (p.events || []).find(x => !x.time && e.time && x.date === e.date && x.title.toLowerCase() === e.title.toLowerCase()); if (o) o.time = e.time; }
    // a plan moved ("was": its old date) or called off ("cancelled"): the item there changes, nothing is added
    // the plan it means: the same title, or (moved) the one on its old day whose words mostly match ("토요일 저녁 약속" → "일요일 저녁 약속")
    const words = v => new Set(String(v || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 2));
    const alike = (a, b) => { const A = words(a), B = words(b), n = [...A].filter(w => B.has(w)).length; return n >= Math.ceil(Math.min(A.size, B.size) * 0.5) && n > 0; };
    const sameTitle = (a, b) => lk(a) === lk(b) || lk(a).includes(lk(b)) || lk(b).includes(lk(a)) || alike(a, b);
    // a plan written as called off and, alongside it, the same plan on another day (run35: Saturday off, Sunday new):
    // one plan moved, not one gone and a second made
    for (const c of (add.events || []).filter(e => e.cancelled)) {
        const n = (add.events || []).find(e => !e.cancelled && !e.was && e.date && e.date !== c.date && sameTitle(e.title, c.title));
        const old = c.date || (p.events || []).find(x => !x.cancelled && sameTitle(x.title, c.title))?.date || '';
        if (n && old && (p.events || []).some(x => !x.cancelled && x.date === old)) { n.was = old; c.dropped = true; }
    }
    add.events = (add.events || []).filter(e => !e.dropped).filter(e => {
        if (!e.was && !e.cancelled) return true;
        const live = (p.events || []).filter(x => !x.cancelled);
        const o = live.find(x => (lk(x.title) === lk(e.title) || lk(x.title).includes(lk(e.title)) || lk(e.title).includes(lk(x.title))) && (x.date === e.was || x.date === e.date || !e.was))
            || (e.was ? live.filter(x => x.date === e.was).find(x => alike(x.title, e.title)) || (live.filter(x => x.date === e.was).length === 1 ? live.find(x => x.date === e.was) : null) : live.find(x => alike(x.title, e.title) && x.date === e.date));
        if (!o) return !e.cancelled && !!e.date;
        if (e.title && !e.cancelled) { o.title = e.title; if (e.ko) o.ko = e.ko; }
        if (e.cancelled) o.cancelled = true; else { if (e.date) o.date = e.date; if (e.time) o.time = e.time; }
        return false;
    });
    for (const k of LISTS) p[k] = keep([...(p[k] || []), ...fresh(k, p[k] || [], add[k] || [])], CAP[k]);
    if (add.profile?.handle || add.profile?.bio) p.profile = { ...(p.profile || {}), ...Object.fromEntries(Object.entries(add.profile).filter(([, v]) => v)) };
    for (const c of add.contacts) {
        const old = p.contacts.find(x => nameKey(x.name) === nameKey(c.name));
        if (old) old.saved = c.saved || old.saved; else p.contacts.push(c);
    }
    p.contacts = keep(p.contacts, CAP.contacts);
    if (add.now) p.now = add.now;
    return p;
}

// ---- the request
const secEnd = s => { const mt = s.title.match(RANGE_HEAD); return mt ? Number(mt[4]) : -1; };
const secFirst = s => { const mt = s.title.match(RANGE_HEAD); return mt ? Number(mt[2]) : -1; };
const lastEnd = m => Math.max(-1, ...parseSections(String(m.text || '')).filter(s => !s.group).map(secEnd));
// a reflection's background (the archive before its messages): the newest sections up to this, the rest is old news
const BEFORE_MAX = 30_000;
// stretches archived before the phone read them, read from their sections: whole sections, up to this many tokens of
// section text a round (about 20 sections of 250–280 words). A summary is nearly all events, about 4–5 to 1,000 tokens,
// so they fit one answer's 40 events and 16,000 tokens (an answer cut short would lose the round). A section is never cut:
// one past the limit waits whole for the next round, and one longer than the limit goes alone
const ARCH_TOKENS = 8_000;
// the archive's sections with a message range ("## #a–#b — …"): { key, first, last, text }
const archSections = m => { const [body] = splitTail(String(m?.text || '')); return parseSections(body).filter(x => !x.group && RANGE_HEAD.test(x.title)).map(x => { const mt = x.title.match(RANGE_HEAD); return { key: `${mt[2]}-${mt[4]}:${x.title.length}`, first: Number(mt[2]), last: Number(mt[4]), text: body.slice(x.start, x.end).trim() }; }); };
const ARCHIVE_MAX = 120_000; // characters: the state at the end, and as many of the newest sections as fit
// a chat with no archive yet: its own messages stand in for it, from the start, the newest kept when there are too many
// (tokens: making a phone reads up to 70,000; the life fill 40,000, its files and saved cities reaching far back (run37:
// 40,000 kept every rule and the story's days, 50,000 began to slip); the other everyday apps 30,000; the bank, investments
// and device keep the recent chat)
export const CHAT_TOKENS = { phone: 70_000, life: 40_000, apps: 30_000 };
// the chat from the newest message back (upto: from the phone's clock back, see phoneAt)
const atOf = t => Number((String(t).match(/^\[#(\d+)/) || [])[1] ?? NaN);
const chatUpto = (rows, upto) => (upto == null ? rows : rows.filter(t => !(atOf(t) > upto)));
function chatStory(budget, upto = null) {
    const rows = chatUpto(recentForCheck(1e9), upto), out = [];
    for (let i = rows.length - 1, size = 0; i >= 0; i--) { const t = estTok(rows[i]); if (out.length && size + t > budget) break; out.unshift(rows[i]); size += t; }
    return out.join('\n\n');
}
export const noArchive = m => !archiveFor(m, -1).text.trim();
// the last message the archive covers (its sections' "#a–#b" headings), -1 when none. upto: only the sections that begin
// at or before that message (a phone's clock): one archived past it is the reflection's to read, not the fill's
// whole false: only sections that end by then (a remake of the phone's own apps, which leaves no mark of its own to say it
// read past the clock)
export const archiveEnd = (m, upto = null, whole = true) => Math.max(-1, ...parseSections(splitTail(String(m?.text || ''))[0]).filter(s => !s.group && (upto == null || (whole ? secFirst(s) : secEnd(s)) <= upto)).map(secEnd));
// the chat after the archive, oldest first: every message the archive doesn't cover yet, nothing left out in between, up
// to `budget` tokens. A longer stretch is read up to where it stops (to); the request's app marks that as read, and the
// rest is the reflection's to read, in its own order, so no message is lost and none comes in twice
// upto: the phone's clock (phoneAt): a fill reads no further than the phone has; the reflection reads on from there
// from: a turn that carries on another (after the message that one stopped at)
export function chatAfterArchive(m, budget = CHAT_TOKENS.phone, upto0 = null, from = null, whole = true) {
    // a section that begins at or before the clock and runs past it is read whole: the clock moves to its end (never past
    // the chat's last message: an archive longer than the chat, a branch or messages deleted, doesn't move it ahead).
    // whole false: such a section is left to the reflection, and the read stops at the clock
    const arEnd = archiveEnd(m, upto0, whole), upto = upto0 == null ? null : whole ? Math.max(upto0, Math.min(arEnd, chatEnd())) : upto0;
    const end = Math.max(arEnd, from ?? -1), all = syncRows().filter(r => r.index > end), rows = all.filter(r => upto == null || r.index <= upto), out = [];
    let size = 0;
    for (const r of rows) { const t = estTok(r.text); if (out.length && size + t > budget) break; out.push(r); size += t; }
    return { text: out.map(r => r.text).join('\n\n'), from: out[0]?.index ?? null, to: out.at(-1)?.index ?? end, n: out.length, all: out.length === rows.length, left: rows.length - out.length,
        upto, later: all.length > rows.length, ...(whole ? {} : { cut: true }) };
}
// where the phone has read up to, its clock: the last message its making or a reflection read. Filling an app, or making
// some again, reads up to here and no further, so every app stands at the same moment; what comes after is the
// reflection's to read, for all of them at once. null: a phone with no reading record (it reads to now, as it always did)
export const phoneAt = p => { const s = p?.sync, b = s?.marks?.base?.index; return Number.isInteger(b) ? Math.max(b, ...(s.done || []).map(r => r[1]), ...Object.keys(s.hiddenRead || {}).map(Number)) : null; };
// it as RECENT CHAT; cut short, the block says where the story stops for now
const afterBlock = g => (g?.n ? `[RECENT CHAT${g.all && !g.later ? '' : ` — the story so far ends at #${nowAt(g)}; the messages after it are read later`}]\n${g.text}` : '');
// what a phone's request reads after the archive (null: no archive, the chat goes as before)
// p: the phone it is for (its clock bounds it); no archive: only that bound (the chat goes as before, up to it)
export const windowOf = (m, p = null, from = null, budget = CHAT_TOKENS.phone, whole = true) => { const upto = phoneAt(p); return noArchive(m) ? (upto == null ? null : { none: true, n: 0, all: true, upto }) : chatAfterArchive(m, budget, upto, from, whole); };
// what the phone's reflection took from the messages after `after` up to the phone's clock: each event's summary and the
// words it came from. The part of a long stretch a fill can't read word for word goes like this (less detailed, nothing lost)
// null when some message there was never read by a reflection (only the making read it, or a newest-first reflection
// left it for later): its events aren't there to tell it, so the fill stops before it instead
export function toldShort(p, after, upto) {
    if (upto == null || !(upto > after)) return null;
    const s = p?.sync, base = s?.marks?.base?.index ?? Infinity;
    if (!s || syncRows().some(r => r.index > after && r.index <= upto && !(r.index > base && readBefore(s, r.index)))) return null;
    const evs = Object.entries(p?.sync?.events || {}).filter(([, e]) => Number.isInteger(e?.at) && e.at > after && e.at <= upto).sort((x, y) => x[1].at - y[1].at);
    return { from: after + 1, to: upto, n: evs.length, text: `[TOLD SHORT — messages #${after + 1}–#${upto}, after RECENT CHAT: what the phone's reflection took from each, a summary and the words it came from]\n${evs.map(([id, e]) => `#${e.at} · ${e.summary || id}${e.quote ? ` — "${e.quote}"` : ''}`).join('\n') || '(nothing for the phone)'}` };
}
// a fill read in two turns (see fillLife): what it says after. short: the part it took from the reflection's summaries
export const turnsNote = (last, what, short = null) => {
    const obj = `${what}${/[가-힣]$/.test(what) && (what.charCodeAt(what.length - 1) - 0xac00) % 28 ? '을' : '를'}`;
    if (short?.n !== undefined && last?.all) return globalThis.toastr?.info(`${obj} 채웠어요. 대화가 길어서 #${short.from}부터는 요약만 보고 채웠어요.`, '캐릭터 휴대폰');
    if (!last || last.all) return;
    globalThis.toastr?.warning(last.upto != null ? `${obj} #${last.to}까지만 채웠어요. 아카이브하고 다시 만들면 나머지도 들어가요.` : `${obj} #${last.to}까지 채웠어요. 나머지는 반영하면 들어가요.`, '캐릭터 휴대폰');
};
// a fill or a remake reads the story after the archive up to the phone's clock in two turns at most: the first reads
// 70,000 tokens word for word and writes the whole app; what is left, the second reads (30,000 tokens more, word for
// word) and writes only what it adds, in the voice of what the first wrote (LIFE SO FAR, PHONE SO FAR …), the code
// putting it in. A stretch longer still goes along as the reflection's summaries (TOLD SHORT): nothing lost, that part
// less detailed. A phone made anew needs no second turn: what it didn't read is after its clock, the reflection's
export const MORE_TOKENS = 30_000;
// the second turn's window: the rest word for word, and past that the summaries; cover: how far the two reach together
export function secondTurn(m, p, first, whole = true) {
    if (!first || first.all) return null;
    const more = windowOf(m, p, first.to, MORE_TOKENS, whole);
    if (!more?.n) return null;
    const short = more.all ? null : toldShort(p, more.to, more.upto);
    return { more, short, cover: short ? { ...more, all: true } : more };
}
// only: what this app's second turn writes, when it is less than the whole JSON
export const soFarHead = (what, short, only = '') => `[${what} SO FAR — what you wrote from the story before RECENT CHAT. Write only what RECENT CHAT${short ? ' and TOLD SHORT' : ''} add or change, in the same JSON and in the same voice, language and naming as here; leave out what is already here${only ? `. ${only}` : ''}]`;
// the story's "now" for a request that stopped short: the message it read up to (null: now is now). Its days, weather
// and clock stand there too, so it never writes a day it didn't read; the reflection moves them on from there
export const nowAt = g => (!g ? null : !g.all ? g.to : g.upto ?? null);
// where a request read up to, when it stopped short of now: its app's mark (null: it read to now)
export const readMark = g => { const i = nowAt(g); return i == null ? null : markAfter(i); };
export const readNote = g => { if (g && !g.all) globalThis.toastr?.info(g.upto != null ? `대화가 길어서 #${g.to}까지 읽었어요. 아카이브하고 다시 만들면 나머지도 들어가요.` : `대화가 길어서 #${g.to}까지 읽었어요. 나머지는 반영하면 들어가요.`, '캐릭터 휴대폰'); };
// the story's year: the phone's own (carried over New Year), else one written in a date in the archive, the newest status
// lines or (no archive) the chat; none for a story that never dates itself (a fantasy calendar, an undated present)
// upto: a request that read only up to that message takes the status lines up to it (see nowAt)
export function storyYear(m, p = null, upto = null) {
    // the owner's own choice in 날짜 및 시간: this year, or none
    if (p?.noYear) return '';
    if (p?.year) return String(p.year);
    let tracks = '';
    try { tracks = recentTrackers(5, upto == null ? {} : { chat: (ctx().chat || []).slice(0, upto + 1) }).map(t => t.date || '').join('\n'); } catch { /* no status lines */ }
    return yearIn(m.text) || yearIn(tracks) || (noArchive(m) ? yearIn(recentForCheck(1e9).join('\n')) : '');
}
// a phone's year, once: one the story writes in a date, else none (설정 › 날짜 및 시간 changes it); true when it was set now
export function ensureYear(m, p, upto = null) {
    if (!p || p.year || p.noYear) return false;
    const y = Number(storyYear(m, p, upto));
    if (y) p.year = y; else p.noYear = true;
    return true;
}
// the story's year changed (설정 › 날짜 및 시간): every phone in the chat moves to it, and every full date its bank,
// investments and the shared ledger hold moves by as many years, so their order stays as it was (a February 29 that
// doesn't exist then becomes the 28th)
const FULL_DAY = /^(\d{4})-(\d{2})-(\d{2})(.*)$/s;
const shiftDay = (v, n) => {
    const mt = FULL_DAY.exec(v); if (!mt) return v;
    const y = Number(mt[1]) + n, d = mt[2] === '02' && mt[3] === '29' && new Date(Date.UTC(y, 1, 29)).getUTCMonth() !== 1 ? '28' : mt[3];
    return `${y}-${mt[2]}-${d}${mt[4]}`;
};
const shiftAll = (o, n) => (Array.isArray(o) ? o.map(x => shiftAll(x, n)) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [shiftDay(k, n), shiftAll(v, n)])) : typeof o === 'string' ? shiftDay(o, n) : o);
export const hasDatedRecords = m => !!m.finance || Object.values(m.phones || {}).some(p => p?.money || p?.investment);
export function setStoryYear(m, p, year) {
    const n = p.year && !p.noYear ? year - p.year : 0;
    if (n) {
        if (m.finance) m.finance = shiftAll(m.finance, n);
        for (const q of Object.values(m.phones || {})) {
            if (!q || typeof q !== 'object') continue;
            for (const k of ['money', 'investment']) if (q[k]) q[k] = shiftAll(q[k], n);
            if (q !== p && q.year && !q.noYear) q.year += n;
            // the copies 되돌리기 and 빼기 compare against move too (else a moved record reads as changed by hand and stays),
            // and 되돌리기 puts back the year it had moved to
            if (q.syncUndo) { q.syncUndo = shiftAll(q.syncUndo, n); if (q.syncUndo.year) q.syncUndo.year += n; }
            for (const e of Object.values(q.sync?.events || {})) if (e?.effects) e.effects = shiftAll(e.effects, n);
        }
        // this browser's record of unsaved rounds (복구) too
        try {
            const scope = phoneChatScope(ctx()), owners = new Set(Object.values(m.phones || {}).map(q => q?.owner));
            journalWrite(scope, journalRead(scope).map(r => (owners.has(r.owner) ? { ...r, events: shiftAll(r.events || [], n), life: shiftAll(r.life || [], n), ...(r.year ? { year: r.year + n } : {}) } : r)));
        } catch { /* no journal here */ }
    }
    p.year = year; p.noYear = false;
    return n;
}
// what the model is told of the year: a year in any text is this one (nothing when it is unknown)
const yearBlock = (m, p, upto = null) => { const y = storyYear(m, p, upto); return y ? `[STORY YEAR]\n${y}` : ''; };
// the archive block, or (budget) the chat in its place, then no RECENT CHAT: it is in there
const archiveBlock = (m, ar, head, budget, upto = null) => (budget && noArchive(m) ? `[${head} — none written yet: the chat so far is the story]\n${chatStory(budget, upto) || '(empty)'}` : `[${head}]\n${ar}`);
// upto: no section that begins after that message (a fill reads up to the phone's clock), and then no current state
// either (the tail tells the story's end, past the clock)
function archiveFor(m, after = -1, upto = null, whole = true) {
    const [body, tail0] = splitTail(String(m.text || ''));
    const all = parseSections(body).filter(s => !s.group && (after < 0 || secEnd(s) > after));
    const secs = all.filter(s => upto == null || (whole ? secFirst(s) : secEnd(s)) <= upto), tail = secs.length === all.length ? tail0 : '';
    const parts = [];
    let size = tail.length;
    for (let i = secs.length - 1; i >= 0; i--) {
        const t = body.slice(secs[i].start, secs[i].end).trim();
        if (parts.length && size + t.length > ARCHIVE_MAX) break;
        parts.unshift(t); size += t.length;
    }
    return { text: [parts.join('\n\n'), tail.trim()].filter(Boolean).join('\n\n'), count: secs.length };
}
export const newSections = (m, p) => (p ? parseSections(String(m.text || '')).filter(s => !s.group && secEnd(s) > (p.upto ?? -1)).length : 0);

// 참고 로어북 (this chat): the books picked go whole up to LORE_MAX tokens; past that, the owner's entries first,
// then the always-on ones, then the rest, while there is room
const LORE_MAX = 20_000;
export const phoneLore = m => (Array.isArray(m.phoneLore) ? m.phoneLore.filter(Boolean) : []);
// entries of a picked book left out by hand: m.phoneLoreOff = { [book]: [uid, …] }
export const loreOff = (m, book) => new Set((m.phoneLoreOff && typeof m.phoneLoreOff === 'object' && Array.isArray(m.phoneLoreOff[book]) ? m.phoneLoreOff[book] : []).map(String));
export async function loreFor(m, owner) {
    const c = ctx(), re = nameRe(owner), items = [];
    for (const name of phoneLore(m)) {
        let data = null;
        try { data = await c.loadWorldInfo(name); } catch { /* a book that is gone */ }
        const off = loreOff(m, name);
        for (const [uid, e] of Object.entries(data?.entries || {})) {
            const body = String(e?.content || '').trim();
            if (!body || e.disable || off.has(String(e.uid ?? uid))) continue;
            const title = String(e.comment || (e.key || []).join(', ')).trim();
            const mine = [body, title, ...(e.key || []), ...(e.keysecondary || [])].some(x => re.test(String(x)));
            items.push({ text: `- ${title ? `${title}: ` : ''}${body}`, rank: mine ? 0 : e.constant ? 1 : 2 });
        }
    }
    const all = items.map(x => x.text).join('\n');
    if (estTok(all) <= LORE_MAX) return all;
    const out = [];
    let used = 0;
    for (const x of [...items].sort((a, b) => a.rank - b.rank)) {
        const t = estTok(x.text);
        if (used + t <= LORE_MAX) { out.push(x.text); used += t; }
    }
    return out.join('\n');
}

// 번역 용어집: names as the user wants them, in the Korean and as full names
export const namesBlock = m => { const g = glossaryEntries(m); return g.length ? `[NAMES]\nHow these names are written. Korean text uses the Korean form; a person's full name is the one given here.\n${g.map(e => `- ${e.src} = ${e.ko}`).join('\n')}` : ''; };
// 다시 만들기, app by app: which JSON keys each app is drawn from
export const REMAKE = { msg: ['threads', 'contacts'], call: ['calls'], photo: ['photos'], note: ['notes'], search: ['searches'], cal: ['events'], sns: ['profile', 'posts'], mail: ['mails'], diary: ['diary'] };
const onlyAsk = keys => `[ONLY THESE]\nThe phone already holds the rest. Write only these keys of the JSON, from the whole story: ${keys.join(', ')}.`;
// 누가 아는가: what the owner doesn't know (or only suspects) stays off their phone
const blindBlock = (m, owner) => {
    const me = n => nameKey(n) === nameKey(owner);
    const rows = knowledgeRows(m).flatMap(r => (r.unaware.some(me) ? [`- ${r.fact}`] : r.suspects.some(me) ? [`- ${r.fact} (only suspects)`] : []));
    return rows.length ? `[OWNER DOESN'T KNOW]\n${rows.join('\n')}` : '';
};
// extra: a second turn's blocks (PHONE SO FAR, TOLD SHORT)
function phoneRequest(m, owner, p = null, lore = '', only = null, profile = '', gap = null, extra = []) {
    const world = worldText(m), upto = nowAt(gap);
    const recent = chatUpto(recentForCheck(1e9), upto).slice(-6).join('\n\n').slice(-6000);
    const ar = archiveFor(m, p ? p.upto ?? -1 : -1, nowAt(gap), !gap?.cut);
    const now = p ? JSON.stringify(phoneForModel(p)) : '';
    return [
        p ? `[PHONE NOW]\n${now}` : '', clockBlock(p || m.phones?.[nameKey(owner)], upto == null ? undefined : storyNow(p || m.phones?.[nameKey(owner)] || {}, upto, m) || undefined, m, statusAt(p || m.phones?.[nameKey(owner)] || {}, upto, m)),
        !p && m.phones?.[nameKey(owner)]?.device ? `[DEVICE — locked]\n${JSON.stringify(m.phones[nameKey(owner)].device)}` : '',
        archiveBlock(m, ar.text || '(nothing new)', `ARCHIVE${p ? ' — the sections since PHONE NOW' : ''}`, CHAT_TOKENS.phone, upto),
        world ? `[WORLD]\n${world}` : '',
        lore ? `[LOREBOOK]\n${lore}` : '',
        afterBlock(gap) || (recent && !noArchive(m) ? `[RECENT CHAT]\n${recent}` : ''),
        yearBlock(m, p, upto),
        `[OWNER]\n${owner}`,
        profile, blindBlock(m, owner),
        namesBlock(m),
        ...extra,
        only ? onlyAsk(only) : '',
    ].filter(Boolean).join('\n\n');
}
// what the model is shown of a phone it is updating: the newest of each list, without the Korean
// PHONE NOW for the model: the newest of each list with its event tags; nothing 재구성, no ids
const real = xs => (xs || []).filter(x => !isGuess(x));
const ev = (x, o) => (x.ev ? { ...o, ev: x.ev } : o);
const phoneForModel = p => ({
    country: p.country, now: p.now,
    contacts: p.contacts.map(({ name, saved }) => ({ name, saved })),
    threads: p.threads.map(t => ({ with: t.with, messages: real(t.messages).slice(-6).map(({ from, text, time }) => ({ from, text, time })) })),
    calls: real(p.calls).slice(-5).map(x => ev(x, { with: x.with, type: x.type, time: x.time, min: x.min })),
    photos: real(p.photos).slice(-4).map(x => ev(x, { caption: x.caption, time: x.time })),
    notes: real(p.notes).slice(-3).map(x => ev(x, { title: x.title, text: x.text.slice(0, 200), time: x.time })),
    searches: real(p.searches).slice(-4).map(x => ev(x, { q: x.q, time: x.time })),
    events: real(p.events).slice(-4).map(x => ev(x, { title: x.title, date: x.date, time: x.time })),
    profile: p.profile ? { handle: p.profile.handle, bio: p.profile.bio } : undefined,
    posts: real(p.posts).slice(-3).map(x => ev(x, { text: x.text.slice(0, 200), photo: x.photo, time: x.time })),
    mails: real(p.mails).slice(-3).map(x => ev(x, { from: x.from, subject: x.subject, time: x.time })),
    diary: real(p.diary).slice(-2).map(x => ev(x, { date: x.date, title: x.title, text: x.text.slice(0, 300) })),
    // so a memo already there isn't recorded again
    voice: real(p.voice || []).slice(-3).map(x => ev(x, { title: x.title, time: x.time })),
});

// apps: some of REMAKE's names, made again from the whole story while the rest of the phone stays as it is
export async function makePhone(m, owner, { update = false, apps = null } = {}) {
    const key = nameKey(owner);
    if (update && m.phones?.[key]) return updatePhone(m, owner);
    if (busy.sync || busy.fill) throw new Error('다른 폰 작업이 끝난 뒤 다시 해 주세요');
    // reading starts after the last message there was when this was asked; what comes in while it writes stays unread
    // (or, with more after the archive than one request reads, after the last message it read: the reflection goes on from there)
    // made again with its reading kept (some apps, or a phone whose bank or life apps stay): up to the phone's clock, like
    // a fill; made anew: up to now, and that becomes its clock
    const cur = m.phones?.[key], keep = !!(apps && cur) || !!(cur?.sync?.marks?.base && ['money', 'invest', 'life', 'delivery'].some(g => cur.sync.marks[g]));
    const gap = keep ? windowOf(m, cur, null, CHAT_TOKENS.phone, false) : windowOf(m, null);
    // nothing shown after the archive (all of it archived and hidden): it read up to the archive's end, not -1 (no further
    // than the chat's last message: an archive longer than the chat leaves the messages written after for the reflection)
    const mark = readMark(gap) || (n => (a => (n.index < a ? markAfter(a) : n))(Math.min(archiveEnd(m), chatEnd())))(markNow());
    const old = update ? m.phones?.[key] : null;
    const part = apps && m.phones?.[key] ? apps.flatMap(a => REMAKE[a] || []) : null;
    const binding=structuredClone(m.phones?.[key]?.financeProfile || m.phoneProfiles?.[key]);
    const lore = await loreFor(m, owner), profile = await ownerProfileBlock(ctx(), binding, owner);
    const ask = (g, extra = []) => askDraft(phoneRequest(m, owner, old, lore, part, profile, g, extra), { force: true, system: old ? AI_SYS_PHONE_UPDATE : AI_SYS_PHONE, maxTokens: 16000 });
    const out = await ask(gap), got = parsePhone(out, owner);
    // made again up to the clock and stopped short: a second turn adds the rest (one that fails keeps the first)
    const two = keep && !old ? secondTurn(m, cur, gap, false) : null;
    let got2 = null, last = gap, short = null;
    if (two) {
        try {
            const was = jsonOf(out, { salvage: true }), soFar = part && was ? Object.fromEntries(part.filter(k => was[k] !== undefined).map(k => [k, was[k]])) : was;
            got2 = parsePhone(await ask(two.cover, [`${soFarHead('PHONE', two.short)}\n${JSON.stringify(soFar)}`, two.short?.text || '']), owner);
            last = two.cover; short = two.short;
        } catch (err) { console.warn('[narrative-archive] phone, second turn', err); }
    }
    if(JSON.stringify(binding)!==JSON.stringify(m.phones?.[key]?.financeProfile || m.phoneProfiles?.[key])) throw new Error('생성 중 연결한 인물 정보가 변경됐어요. 다시 시도해 주세요');
    m.phones = m.phones && typeof m.phones === 'object' ? m.phones : {};
    if (part) {
        const p = m.phones[key];
        const was = Object.fromEntries(part.map(k => [k, p[k]]));
        for (const k of part) p[k] = k === 'profile' ? (got.profile || p.profile) : [];
        const only = g => ({ ...g, ...Object.fromEntries([...LISTS, 'threads', 'contacts'].filter(k => !part.includes(k)).map(k => [k, []])), now: '' });
        mergePhone(p, { ...only(got), profile: null });
        if (got2) mergePhone(p, { ...only(got2), profile: part.includes('profile') ? got2.profile : null });
        for (const k of part) if (k !== 'profile') carryOver(k, was[k], p[k]);
        // the last round's 되돌리기 would put back the old app's records: no more
        delete p.syncUndo;
        ensureIds(p);
        p.at = Date.now();
        await saveMeta();
        if (p.inject) applyInjection();
        turnsNote(last, '앱', short);
        return p;
    }
    if (old) mergePhone(old, got);
    else {
        const was = m.phones[key];
        const base = { owner, inject: false, ...got, wall: got.wall || 'dusk', accent: got.accent || 'blue', country: got.country || 'KR', threads: [], contacts: [], ...Object.fromEntries(LISTS.map(k => [k, []])) };
        if (was?.device) base.device = structuredClone(was.device);
        if (was?.theme) base.theme = was.theme;
        if (was?.wealthPlan) base.wealthPlan = structuredClone(was.wealthPlan);
        if (was?.money) base.money = was.money;
        if (was?.investment) base.investment = was.investment;
        // the apps filled on their own (clock · health · files · weather, delivery) stay like the bank, and so does what the
        // owner set: the year, hidden contacts and places, where they live
        for (const k of ['life', 'delivery', 'voiceAt', 'year', 'noYear', 'hiddenContacts', 'hiddenPlaces', 'lives', 'where']) if (was?.[k] !== undefined) base[k] = was[k];
        if (binding) base.financeProfile = structuredClone(binding);
        // the phone's own apps start reading again from here. With a bank, investments or the everyday apps kept (they
        // weren't made again), the reading state stays as it was: messages they haven't read yet are still theirs to read
        // (the phone's own items from those messages are told apart by their words, so nothing doubles)
        if (was?.sync?.marks?.base && ['money', 'invest', 'life', 'delivery'].some(g => was.sync.marks[g])) base.sync = was.sync;
        else {
            base.sync = newSync(phoneChatScope(ctx())); base.sync.marks.base = mark;
            // a reading started anew: the old one's unsaved rounds (복구) aren't this phone's
            try { const scope = phoneChatScope(ctx()); journalWrite(scope, journalRead(scope).filter(r => nameKey(r.owner) !== key)); } catch { /* no journal here */ }
        }
        m.phones[key] = mergePhone(base, got);
        if (got2) mergePhone(m.phones[key], got2);
    }
    const p = m.phones[key];
    ensureYear(m, p, nowAt(last));
    if(m.phoneProfiles) delete m.phoneProfiles[key];
    ensureIds(p);
    p.upto = lastEnd(m);
    p.at = Date.now();
    await saveMeta();
    if (p.inject) applyInjection();
    if (two) turnsNote(last, '폰', short); else readNote(gap);
    await tryWhere(m, p);
    await saveMeta();
    return p;
}

// ---- 새로 일어난 일 반영
// every message the phone may read, numbered (system messages and offstage ones left out)
// the chat's last message, hidden or not (-1: none)
const chatEnd = () => chatRows().at(-1)?.index ?? -1;
export const syncRows = () => chatRows().filter(r => !r.hidden).map(({ index, text }) => ({ index, text }));
export const markNow = () => { const rows = syncRows(); return makeMark(ctx().chat || [], rows.length ? rows[rows.length - 1].index : -1); };
export const markAfter = index => makeMark(ctx().chat || [], index);
// 'ok', 'none' (no start yet: an older phone) or 'lost' (its message is gone or now matches twice)
export function syncState(p) {
    if (!p?.sync?.marks?.base) return 'none';
    // the bank's and the investment's starts move with a deleted message too; one that can't be found again stays put
    // every app's mark follows a message deleted or put in before it (the life and delivery apps' too: their mark says
    // which messages they took in, so a number off by one would skip one or take one twice)
    if (settleMarks(p.sync, ctx().chat || [], ['base', ...['money', 'invest', 'life', 'delivery'].filter(g => p.sync.marks[g])]).includes('base')) return 'lost';
    p.sync.readChat ||= firstMark(p.sync);
    p.sync.scope = phoneChatScope(ctx());
    return 'ok';
}
// counted on a copy: what changed since the last round is left for the round itself to see
// which chat the phone was last read in: SillyTavern gives a branch a new integrity mark (and names its main chat);
// renaming a chat or importing a backup keeps the mark, so neither looks like a branch
const chatMark = () => ctx().chatMetadata?.integrity || null;
// a phone copied into a branch of the chat it was read in: messages past the branch point are other talk, never edits
const otherChat = s => { const now = chatMark(), read = s.readChat || firstMark(s); return !!read && !!now && read !== now && !!ctx().chatMetadata?.main_chat; };
// a phone from before marks (3.140 and older) knows only the chat it was last read in, by name (its scope). When that
// name is this branch's main chat, the phone came here with the branch and still holds the main chat's later talk;
// otherwise (read here already, a renamed chat, a backup) it is this chat's own
const chatName = scope => { try { return JSON.parse(String(scope).replace(/^[^[]*/, '')).at(-1); } catch { return null; } };
function firstMark(s) {
    const main = ctx().chatMetadata?.main_chat;
    return s.scope && main && s.scope !== phoneChatScope(ctx()) && chatName(s.scope) === main ? `before:${s.scope}` : chatMark();
}
// what is left to read: unread messages, and stretches archived before the phone read them (one each)
export const syncLeft = (p, m = null) => { if (!p?.sync?.marks?.base) return null; const s = structuredClone(p.sync); realign(s, chatRows(), { other: otherChat(s) }); const rows = syncRows(); return unreadCount(s, rows) + (m ? archivedUnread(s, archSections(m), rows, chatRows()).length : 0); };
const ITEM_KEYS = [...LISTS, 'threads', 'contacts'];
const sizes = p => Object.fromEntries(ITEM_KEYS.map(k => [k, k === 'threads' ? p.threads.reduce((n, t) => n + t.messages.length, 0) : k === 'posts' ? (p.posts || []).reduce((n, x) => n + 1 + (x.comments?.length || 0), 0) : (p[k] || []).length]));
// every app item that can carry a source: list items, text messages, comments
const phoneItems = p => [...LISTS.flatMap(k => (p[k] || []).map(x => ({ k, x }))), ...p.threads.flatMap(t => t.messages.map(x => ({ k: 'msg', x }))),
    ...(p.posts || []).flatMap(x => (x.comments || []).map(c => ({ k: 'comment', x: c })))];
// after a merge: the phone's own copy of each item an event gave (new, or one already there) notes where it came from
const ckey = c => `${String(c.from || '').toLowerCase()}|${c.text}`;
function tagItems(p, add, src) {
    const tag = (k, x, a) => {
        if (!x) return;
        // an item already there with no sources (made with the phone, or before sources were kept) keeps that start
        if (x !== a && !x.froms) addFrom(x, srcOf('before', '', ''));
        x.made ||= itemMark(k, x);
        for (const f of src ? [src] : a?.froms || []) { addFrom(x, f); if (src && x !== a) addFrom(a, f); }
    };
    for (const k of LISTS) for (const a of add[k] || []) tag(k, twinOf(k, p[k] || [], a), a);
    for (const t of add.threads || []) { const own = p.threads.find(x => nameKey(x.with) === nameKey(t.with)); for (const a of t.messages) tag('msg', own ? twinOf('msg', own.messages, a) : null, a); }
    for (const a of add.posts || []) {
        const own = (p.posts || []).find(o => o.text && o.text === a.text || o.photo && o.photo === a.photo && o.time === a.time);
        for (const c of a.comments || []) tag('comment', own?.comments?.find(x => ckey(x) === ckey(c)), c);
    }
}
const APP_NAME = { threads: '문자', contacts: '연락처', calls: '통화', photos: '사진', notes: '메모', searches: '검색', events: '캘린더', posts: 'SNS', mails: '메일', diary: '일기', voice: '음성 메모' };
// ---- 2단계 돈 (docs/REFLECT-2STAGE-PLAN.md): the events core marked "money", and the ones owed from before, asked on
// their own with only their messages (and the ones next to them). A payment that can't be placed leaves that event's
// money owed, not the event: its texts and photos stay. Owed twice: skipped, and said so.
// targets: [{ id, at, date, time, summary, quote, changed, tries }]; c: { rows, sections, reread, year, anchor, profile, check }
// returns { late: [{ id, at, add, effects }] for the events it paid, owed, notes, changes, apps }
const OWED_TRIES = 2;
// one list of records per event, its two steps together (되돌리기 keeps an event's records that can't go back)
const byEvent = xs => { const out = new Map(); for (const x of xs) out.set(x.id, [...(out.get(x.id) || []), ...(x.effects || [])]); return [...out]; };
async function moneyStage(m, p, owner, targets, c) {
    const s = p.sync, out = { late: [], owed: [], notes: [], changes: [], apps: new Set() };
    if (!targets.length) return out;
    const owe = (t, why) => {
        const tries = (t.tries || 0) + 1;
        if (tries >= OWED_TRIES) out.notes.push(`${t.summary || t.id}: 결제를 두 번 못 넣어서 건너뛰었어요 (${why})`);
        else { out.owed.push({ id: t.id, at: t.at, date: t.date, time: t.time, tries, ...(t.invest ? { invest: true } : {}) }); out.notes.push(`${t.summary || t.id}: 결제는 다음 반영 때 다시 넣어요 (${why})`); }
    };
    const text = new Map(c.rows.map(r => [r.index, r.text])), near = new Set();
    // two messages either side: the event is often put on the message next to the one with the amount ("gets out of the
    // taxi" at #1, "I paid 12000 won" at #3)
    for (const t of targets) for (let i = t.at - 2; i <= t.at + 2; i++) if (text.has(i)) near.add(i);
    const archive = (c.sections || []).filter(x => targets.some(t => t.at >= x.first && t.at <= x.last)).map(x => x.text);
    if (p.money) migrateBank(m, p);
    // the brokerage only when an event touches it (most money scenes are a meal, a taxi, a parcel)
    const money = moneyNow(p), invest = targets.some(t => t.invest) ? investNow(m, p) : null, today = String(p.now || '').slice(0, 5);
    const dayList = c.known && /^\d{2}-\d{2}$/.test(today) ? Array.from({ length: 14 }, (_, k) => {
        const d = new Date(Date.UTC(Number(c.year), Number(today.slice(0, 2)) - 1, Number(today.slice(3, 5)) + k - 7));
        return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]}`;
    }) : [];
    const input = [
        `[EVENTS]\n${targets.map(t => `- ${t.id}: #${t.at} ${t.date || ''}${t.time ? ` ${t.time}` : ''} ${t.summary || ''}${t.quote ? ` ("${t.quote}")` : ''}${t.changed ? ' (changed)' : ''}`).join('\n')}`,
        `[MESSAGES]\n${[...near].sort((a, b) => a - b).map(i => text.get(i)).join('\n\n')}`,
        archive.length ? `[ARCHIVE FOR THESE MESSAGES]\n${archive.join('\n\n')}` : '',
        money ? `[MONEY NOW]\n${JSON.stringify(money)}` : '', invest ? `[INVESTMENTS NOW]\n${JSON.stringify(invest)}` : '',
        money && p.delivery ? `[DELIVERY SHOPS]\n${(p.delivery.shops || []).map(x => x.name).join('\n') || '(none yet)'}${p.delivery.cart?.items?.length ? `\nCART (in the basket, not ordered): ${p.delivery.cart.shop}: ${p.delivery.cart.items.map(x => `${x.qty || 1}× ${x.name}`).join(', ')}` : ''}` : '',
        (money || invest) && p.wealthPlan ? `[WEALTH]\n${JSON.stringify({ currency: p.wealthPlan.currency, deposits: p.wealthPlan.deposits, investments: p.wealthPlan.investments, basis: p.wealthPlan.basis })}` : '',
        c.known ? `[STORY YEAR]\n${c.known}` : '', dayList.length ? `[DAYS]\n${dayList.join('\n')}` : '',
        `[OWNER]\n${owner}`, c.profile || '', namesBlock(m),
    ].filter(Boolean).join('\n\n');
    let raw = null, why = '';
    try {
        const ans = await askDraft(input, { force: true, system: moneySystem({ delivery: !!(money && p.delivery), invest: !!invest }), maxTokens: 8000, effort: 'low' });
        why = c.check?.() || '';
        raw = why ? null : jsonOf(ans);
        if (!why && (!raw || !Array.isArray(raw.events))) why = '모델 답에서 결제를 찾지 못했어요';
    } catch (err) { why = String(err?.message || err); }
    if (why) { for (const t of targets) owe(t, why); return out; }
    const byId = new Map();
    // the same id twice: its lists are joined (a taxi and a dinner both given under one event), not the first lost
    const join = (a, b) => { const out = { ...a }; for (const [k, v] of Object.entries(b)) out[k] = Array.isArray(v) && Array.isArray(a[k]) ? [...a[k], ...v] : a[k] ?? v; return out; };
    for (const x of raw.events) if (x && typeof x === 'object' && x.money && typeof x.money === 'object') { const id = String(x.id ?? '').trim(); byId.set(id, byId.has(id) ? join(byId.get(id), x.money) : x.money); }
    for (const id of byId.keys()) if (!targets.some(t => t.id === id)) out.notes.push(`돈 단계가 모르는 이벤트(${id})를 써서 넣지 않았어요`);
    for (const t of targets) {
        const mo = byId.get(t.id);
        if (!mo) continue;
        // a changed message already put its payments on the phone: only its own events may correct them
        if (c.reread?.has(t.at) && !c.reread.get(t.at).some(x => x.id === t.id)) { out.notes.push(`#${t.at} 바뀐 대화의 결제는 새로 넣지 않았어요`); continue; }
        const stage = structuredClone({ money: p.money, investment: p.investment, finance: m.finance, delivery: p.delivery });
        let paid;
        try { paid = applyMoney(m, p, { id: t.id, at: t.at, date: t.date, time: t.time, summary: t.summary, money: mo }, { year: c.year, anchor: c.anchor, marks: s.marks, legs: s.events[t.id]?.legs || [], span: s.failed[t.at]?.span || null, edited: !!c.reread?.has(t.at) }); }
        catch (err) { p.money = stage.money; p.investment = stage.investment; m.finance = stage.finance; if (p.delivery) p.delivery = Object.assign(p.delivery, stage.delivery); owe(t, String(err?.message || err)); continue; }
        for (const ch of paid.changes) { out.apps.add(ch.app); if (ch.amount !== null) out.changes.push({ ...ch, what: line(t.summary, 60) }); }
        out.notes.push(...paid.notes);
        // the event keeps every record it gave, from both steps and every round (빼기 takes them all out together)
        const e0 = s.events[t.id] ||= { at: t.at, quote: t.quote || '', summary: t.summary || t.id, effects: [] };
        e0.effects = [...(e0.effects || []), ...paid.effects];
        if (paid.legs.length) e0.legs = [...(e0.legs || []), ...paid.legs.filter(l => !(e0.legs || []).some(o => o.key === l.key))];
        out.late.push({ id: t.id, at: t.at, add: {}, effects: paid.effects, summary: t.summary, legs: paid.legs });
    }
    return out;
}

async function updatePhone(m, owner) {
    return exclusive('sync', async () => {
        const key = nameKey(owner), p = m.phones[key], scope = phoneChatScope(ctx());
        if (syncState(p) !== 'ok') { const e = new Error('먼저 반영 시작 위치를 골라 주세요'); e.code = 'SYNC_PICK'; throw e; }
        const s = p.sync, swiped = [];
        // a read message edited or swiped since: if the last round read it, that round is undone and read again;
        // an older round's items stay, and the changed message is simply read again
        // an edit or swipe of a message the last round read: that round is undone first (what can be), on the reading as it
        // was, then the chat is laid over it once: nothing is renumbered twice
        const other = otherChat(s), probe = realign(structuredClone(s), chatRows(), { other });
        let kept = null;
        if (probe.changed.some(x => p.syncUndo?.readFp?.includes(x.fp)) && canUndo(p)) kept = await undoRound(m, p);
        const moved = realign(s, chatRows(), { other });
        settleDropped(p, moved, swiped);
        s.readChat = chatMark() || s.readChat;
        renumber(m, p, moved);
        if (kept) swiped.push('읽은 대화가 바뀌어서 지난 반영을 되돌리고 다시 읽었어요', ...kept.map(x => `${x}: 그 뒤 기록과 이어져 있거나 직접 바꾼 거라 남겨뒀어요`));
        // messages renumbered with no round after it: the last round's undo would put back the old numbers
        const shifted = moved.changed.length || moved.dropped.length || Object.entries(moved.moved).some(([o, n]) => Number(o) !== n);
        // an older message changed: read again, tied to the events it already gave (no new payment from it)
        const reread = new Map(moved.changed.map(x => [x.at, Object.entries(s.events).filter(([, e]) => e.at === x.at || (e.effects || []).some(f => (f.item?.sourceIndex ?? f.sourceIndex) === x.at)).map(([id, e]) => ({ id, summary: e.summary }))]));
        if (reread.size) swiped.push(`바뀐 대화 ${reread.size}개를 다시 읽어요. 그 대화의 결제는 새로 넣지 않고 기존 기록만 고쳐요`);
        const rows = syncRows(), round = pickRound(s, rows), clockBefore = phoneAt(p) ?? -1;
        // where everyone is: read once for a phone that never had it, and again below when the owner's city changes
        // the archive: sections covering this round are evidence; earlier ones are background; ones reaching unread messages stay out
        const [, tail] = splitTail(String(m.text || ''));
        const sections = archSections(m);
        // stretches archived before the phone read them go along as evidence, oldest first, a few at a time
        const archIn = [];
        for (const x of archivedUnread(s, sections, rows, chatRows())) { if (archIn.length && archIn.reduce((n, y) => n + estTok(y.text), 0) + estTok(x.text) > ARCH_TOKENS) break; archIn.push(x); }
        if (!round.rows.length && !archIn.length) { if (shifted) delete p.syncUndo; p.syncLast = { checked: 0, remaining: 0, apps: [], failed: [], notes: swiped, at: Date.now() }; await saveMeta(); return p; }
        // read once for a phone that never had it, and once more for one read before the city's own name was kept ("서울")
        if (!p.where || !p.where.failed && (p.where.people || []).some(x => !('local' in x) && !('names' in x))) await tryWhere(m, p);
        const got = archiveRound(s, sections, rows, round.rows), evidence = [...archIn, ...got.evidence.filter(x => !archIn.some(y => y.key === x.key))];
        // background is what was read before: never a section read now as evidence, nor one archived and still unread
        const unreadArch = new Set(archivedUnread(s, sections, rows, chatRows()).map(x => x.key)), background = got.background.filter(x => !evidence.some(y => y.key === x.key) && !unreadArch.has(x.key));
        const before = [];
        for (let i = background.length - 1, size = 0; i >= 0 && size + background[i].text.length <= BEFORE_MAX; i--) { before.unshift(background[i].text); size += background[i].text.length; }
        const events = Object.entries(s.events).slice(-40).map(([id, e]) => `- ${id}: ${e.summary}${e.at === null || e.at === undefined ? '' : ` (#${e.at})`}`).join('\n');
        const world = worldText(m), lore = await loreFor(m, owner), profile = await ownerProfileBlock(ctx(), p.financeProfile, owner, { money: !!(p.money || p.investment) });
        if (p.money) migrateBank(m, p);
        const money = moneyNow(p), invest = investNow(m, p), life = lifeNow(p);
        // a phone with money apps reads in two steps: core (marks the events money touches), then money for those
        const split = !!(money || invest);
        // the weather: a status line stands; the model writes it when there is none, or when the status line's day moved on
        // as the story stood at this round's last message (one that reads to the end: now): an older round sees no status
        // line after it, like STORY NOW
        const roundEnd = reachesEnd(s, rows, round.rows) ? null : Math.max(-1, ...round.rows.map(r => r.index), ...archIn.map(x => x.last));
        const upChat = roundEnd == null ? {} : { chat: (ctx().chat || []).slice(0, roundEnd + 1) };
        let tracker = null, st = null, trackAt = -1;
        try { const t = recentTrackers(1, upChat)[0]; tracker = trackerWeather(t); trackAt = Number.isInteger(t?.i) ? t.i : -1; st = statusMoment(p, roundEnd, null, m); } catch { /* no status lines */ }
        // whose scene the newest status line is (true the owner's, false elsewhere, null unknown); one with no time too
        let sceneOwn = tracker ? sceneHome(p, tracker.place, m) : true;
        // a status line among these messages whose scene the phone can't place: the model says whose clock it shows
        const clock = clockBlock(p, hm(p.now) ? p.now : st?.raw, m, st);
        const askZone = sceneOwn === null && round.rows.some(r => r.index === trackAt) && !!clock;
        // a scene the owner isn't in (or may not be): the model gets its place and weather, never its hour
        const trackShown = tracker && sceneOwn !== true ? { place: tracker.place, weather: tracker.weather } : tracker;
        const trackDay = tracker ? when(tracker.date).slice(0, 5) : '';
        // the model writes the weather when no status line gives it, when the status line has no date or its day moved on
        // from the saved weather's, or when it puts the story somewhere else; a same-day, same-place line only stands over it
        const placeKey = v => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''), elsewhere = (a, b) => placeKey(a) && placeKey(b) && !placeKey(a).includes(placeKey(b)) && !placeKey(b).includes(placeKey(a));
        // the life apps already read past this round (filled further on): its weather is theirs, a round behind leaves it
        const lifeAhead = !!life && roundEnd != null && (roundEnd <= (s.marks.life?.index ?? -1) || roundEnd < clockBefore);
        const askWeather = !!life && !lifeAhead && (!tracker || !trackDay || trackDay !== life.weather?.date || elsewhere(tracker.place, life.weather?.place));
        // the year the phone's now is in: read once from the bank or the archive, then carried over New Year with the now
        if (!p.year && !p.noYear) { const y = Number(storyYear(m, p, roundEnd) || String(p.money?.asOf || p.investment?.date || '').slice(0, 4)); if (y > 1900) p.year = y; }
        const known = p.year && !p.noYear ? String(p.year) : '', year = known || String(new Date().getFullYear());
        // the ledger's days are taken nearest the phone's now (a story with no year of its own too: then this year), so a round
        // past New Year books January after December
        const anchor = /^\d{2}-\d{2}/.test(p.now || '') ? `${year}-${p.now.slice(0, 5)}` : '';
        // the days ahead with their weekdays (only with a known year): "on Friday" is a date the model can look up
        const today = String(p.now || '').slice(0, 5), dayList = known && /^\d{2}-\d{2}$/.test(today) ? Array.from({ length: 14 }, (_, k) => {
            const d = new Date(Date.UTC(Number(known), Number(today.slice(0, 2)) - 1, Number(today.slice(3, 5)) + k));
            return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]}`;
        }) : [];
        const input = [
            `[NEW MESSAGES]\n${round.rows.map(r => r.text).join('\n\n') || '(none: this round reads only stretches archived before the phone read them)'}`,
            evidence.length ? `[ARCHIVE FOR THESE MESSAGES]\n${evidence.map(x => x.text).join('\n\n')}` : '',
            before.length ? `[ARCHIVE BEFORE]\n${before.join('\n\n')}` : '',
            reachesEnd(s, rows, round.rows) && tail.trim() ? `[STORY NOW]\n${tail.trim()}` : '',
            `[EVENTS ON THE PHONE]\n${events || '(none yet)'}`,
            known ? `[STORY YEAR]\n${known}` : '', dayList.length ? `[DAYS]\n${dayList.join('\n')}` : '',
            reread.size ? `[MESSAGES READ BEFORE, NOW CHANGED]\n${[...reread].map(([at, evs]) => `- #${at}: ${evs.length ? evs.map(e => `${e.id} (${e.summary})`).join('; ') : 'nothing on the phone yet'}`).join('\n')}` : '',
            `[PHONE NOW]\n${JSON.stringify(phoneForModel(p))}`,
            !split && money ? `[MONEY NOW]\n${JSON.stringify(money)}` : '', !split && invest ? `[INVESTMENTS NOW]\n${JSON.stringify(invest)}` : '',
            !split && money && p.delivery ? `[DELIVERY SHOPS]\n${(p.delivery.shops || []).map(x => x.name).join('\n') || '(none yet)'}${p.delivery.cart?.items?.length ? `\nCART (in the basket, not ordered): ${p.delivery.cart.shop}: ${p.delivery.cart.items.map(x => `${x.name} ×${x.qty}`).join(', ')}` : ''}` : '',
            life ? `[LIFE NOW]\n${JSON.stringify(life)}` : '', askWeather && tracker ? `[WEATHER NOW]\n${JSON.stringify(trackShown)}` : '', clock,
            !split && (money || invest) && p.wealthPlan ? `[WEALTH]\n${JSON.stringify({ currency: p.wealthPlan.currency, deposits: p.wealthPlan.deposits, investments: p.wealthPlan.investments, basis: p.wealthPlan.basis })}` : '',
            world ? `[WORLD]\n${world}` : '', lore ? `[LOREBOOK]\n${lore}` : '',
            `[OWNER]\n${owner}`, profile, blindBlock(m, owner), namesBlock(m),
        ].filter(Boolean).join('\n\n');
        const made = { money: p.money?.at, invest: p.investment?.at, life: p.life, delivery: p.delivery };
        // low thinking: tested against medium on Vertex, the same payments, ids and amounts, without the thinking cost
        const out = await askDraft(input, { force: true, system: split ? coreSystem({ life: !!life, weather: askWeather, tracker: !!tracker, invest: !!invest, zone: askZone }) : updateSystem({ money: false, life: !!life, weather: askWeather, tracker: !!tracker, zone: askZone }), maxTokens: 16000, effort: 'low' });
        // the answer is for the chat and messages it was asked about
        if (phoneChatScope(ctx()) !== scope || m.phones?.[key] !== p) throw new Error('반영하는 사이 채팅이나 폰이 바뀌었어요. 다시 해 주세요');
        if (p.money?.at !== made.money || p.investment?.at !== made.invest) throw new Error('반영하는 사이 은행이나 투자가 새로 만들어졌어요. 다시 해 주세요');
        if (p.life !== made.life || p.delivery !== made.delivery) throw new Error('반영하는 사이 생활 앱이나 배달 앱이 새로 만들어졌어요. 다시 해 주세요');
        const nowText = new Map(syncRows().map(r => [r.index, r.text]));
        if (round.rows.some(r => nowText.get(r.index) !== r.text)) throw new Error('반영하는 사이 대화가 바뀌었어요. 다시 해 주세요');
        const raw = jsonOf(out);
        if (!raw || !Array.isArray(raw.events)) throw new Error('모델 답에서 반영할 내용을 찾지 못했어요. 다시 해 주세요');
        const inRound = new Set(round.rows.map(r => r.index)), textAt = new Map(round.rows.map(r => [r.index, r.text])), start = s.marks.base.index;
        const rid = Math.random().toString(36).slice(2, 10), rowText = new Map(rows.map(r => [r.index, r.text]));
        const failed = {}, loose = [], added = [], apps = new Set(), changes = [], notes = [...swiped];
        // for 되돌리기: what was there before this round (ids and message counts), and the reading state
        const msgSig = x => JSON.stringify([x.from, x.text, x.time]);
        const had = new Set(ITEM_KEYS.flatMap(k => (p[k] || []).map(x => x.id)).filter(Boolean)), msgs = new Map(p.threads.map(t => [t.id, new Set(t.messages.map(msgSig))]));
        const undo = { sync: structuredClone({ done: s.done, failed: s.failed, arch: s.arch, events: s.events, seen: s.seen, hiddenRead: s.hiddenRead || {}, owed: s.owed || { money: [] }, dropped: s.dropped || [] }), now: p.now, year: p.year, where: structuredClone(p.where ?? null), moneyAt: p.money?.at, investAt: p.investment?.at,
            comments: (p.posts || []).filter(x => x.id).map(x => [x.id, x.comments?.length || 0]), before: structuredClone(mergedState(p)) };
        // an event's day when the model leaves it out: the day of the event before it, else the answer's now
        let lastDay = when(raw.now).slice(0, 5);
        const used = new Set(), wants = new Map();
        for (const e of arr(raw.events).slice(0, 40)) {
            if (!e || typeof e !== 'object') continue;
            // "#151" or "151" for the message number
            const at = Number(String(e.at ?? '').replace(/^\s*#/, '')), sec = evidence.find(x => at >= x.first && at <= x.last);
            const fail = why => (inRound.has(at) ? (failed[at] ||= why) : loose.push(why));
            if (!Number.isInteger(at) || at <= start || (!inRound.has(at) && !sec)) { fail('읽는 범위 밖의 일이에요'); continue; }
            // a section's message the phone already read (before it was archived) is in already
            if (!inRound.has(at) && readBefore(s, at)) { fail('이미 읽은 대화예요'); continue; }
            if (!quoted(e.quote, textAt.get(at) || '') && !(sec && quoted(e.quote, sec.text))) { fail('원문에서 근거를 찾지 못했어요'); continue; }
            let add;
            const day = when(e.date).slice(0, 5) || lastDay, phone = e.phone && typeof e.phone === 'object' ? structuredClone(e.phone) : {};
            // a time without its day ("15:10") takes the event's day
            const dated = x => { if (x && typeof x === 'object' && /^\s*\d{1,2}:\d{2}\s*$/.test(String(x.time || '')) && day) x.time = `${day} ${hhmm(x.time)}`; };
            for (const k of [...LISTS, 'threads']) for (const x of arr(phone[k])) { dated(x); for (const msg of arr(x?.messages)) dated(msg); if (x?.draft) dated(x.draft); }
            try { add = parsePhone(JSON.stringify(phone), owner); } catch { fail('앱 내용 형식이 잘못됐어요'); continue; }
            // a bare number is no event id (a model counting its events would take an old event's number again)
            const tagOf = v => { const t = evOf(v); return /^\d+$/.test(t) ? '' : t; };
            // one id for two new events in one answer would take the second for the first (its payment kept out as the same one)
            const id0 = tagOf(e.id) || tagOf(e.summary) || `ev-${at}`, id = used.has(id0) && added.some(x => x.id === id0 && x.at !== at) ? `${id0}-${at}` : id0;
            used.add(id);
            // core marks the events money touches; their money is asked for after (a money left in core's answer is asked again)
            if (split) { const ap = arr(e.apps).map(x => String(x).toLowerCase()), inv = ap.includes('invest') || ['trades', 'watch', 'quotes', 'stakes'].some(k => arr(e.money?.[k]).length); if (ap.includes('money') || inv || e.money) wants.set(id, { id, at, date: day, time: hhmm(e.time), summary: line(e.summary, 160), quote: line(e.quote, 200), changed: reread.has(at), invest: inv }); delete e.money; }
            // a changed message already put its payments on the phone: only its own events may correct them
            if (reread.has(at) && e.money && !reread.get(at).some(x => x.id === id)) { notes.push(`#${at} 바뀐 대화의 결제는 새로 넣지 않았어요`); delete e.money; }
            // the money first, on its own: a payment that can't be placed leaves the whole event out
            const stage = structuredClone({ money: p.money, investment: p.investment, finance: m.finance, delivery: p.delivery });
            let paid;
            if (day) lastDay = day;
            try { paid = applyMoney(m, p, { id, at, date: day, time: hhmm(e.time), summary: line(e.summary, 160), money: e.money }, { year, anchor, marks: s.marks, legs: s.events[id]?.legs || [], span: s.failed[at]?.span || null, edited: reread.has(at) }); }
            catch (err) { p.money = stage.money; p.investment = stage.investment; m.finance = stage.finance; if (p.delivery) p.delivery = Object.assign(p.delivery, stage.delivery); fail(String(err?.message || err)); continue; }
            for (const c of paid.changes) { apps.add(c.app); if (c.amount !== null) changes.push({ ...c, what: line(e.summary, 60) }); }
            notes.push(...paid.notes);
            // the everyday apps: alarms, files, the days the story shows
            const lived = applyLife(p, { id, at, date: day, time: hhmm(e.time) }, phone, !!p.life && at > (s.marks.life?.index ?? -1));
            for (const a of lived.apps) apps.add(a);
            const fx = [...paid.effects, ...lived.effects];
            for (const k of LISTS) for (const x of add[k]) x.ev ||= id;
            for (const t of add.threads) for (const x of t.messages) x.ev ||= id;
            const was = sizes(p), told = structuredClone(add); // as told (merging takes the deleted texts it matched out of add)
            mergePhone(p, { ...add, device: null, now: '' }, { keepAll: true });
            // this message (its number and words) is a source of each item, new or already there
            tagItems(p, add, srcOf(at, bodyMark(rowText.get(at) || ''), rid));
            const got = sizes(p);
            for (const k of ITEM_KEYS) if (got[k] !== was[k]) apps.add(APP_NAME[k]);
            if (add.profile?.handle || add.profile?.bio) apps.add('SNS');
            // an event told again from a later message (its order delivered, its amount stated) stays where it happened, so
            // deleting that message still offers everything it gave; one whose message is gone is taken up by the new one
            const at0 = s.events[id]?.at, home = Number.isInteger(at0) && inRound.has(at0) === false && rowText.has(at0) ? at0 : at;
            s.events[id] = { at: home, quote: line(e.quote, 200), summary: line(e.summary, 160), effects: [...(s.events[id]?.effects || []), ...fx], ...(paid.legs.length || s.events[id]?.legs ? { legs: [...(s.events[id]?.legs || []), ...paid.legs.filter(l => !(s.events[id]?.legs || []).some(o => o.key === l.key))] } : {}) };
            added.push({ id, at, add: told, effects: fx, quote: line(e.quote, 200), summary: line(e.summary, 160), legs: paid.legs });
        }
        // 2단계 돈: what core marked, and what earlier rounds still owe (asked whether or not anything is marked now)
        let late = [];
        if (split) {
            const owedBefore = arr(s.owed?.money), targets = [...wants.values()];
            for (const t of targets) t.tries = owedBefore.find(o => o.id === t.id)?.tries || 0;
            for (const o of owedBefore) { const e0 = s.events[o.id]; if (!wants.has(o.id) && e0 && Number.isInteger(e0.at)) targets.push({ id: o.id, at: e0.at, date: o.date || '', time: o.time || '', summary: e0.summary || o.id, quote: e0.quote || '', changed: false, tries: o.tries || 0, invest: !!o.invest }); }
            const check = () => (phoneChatScope(ctx()) !== scope || m.phones?.[key] !== p ? '반영하는 사이 채팅이나 폰이 바뀌었어요' : p.money?.at !== made.money || p.investment?.at !== made.invest ? '반영하는 사이 은행이나 투자가 새로 만들어졌어요' : '');
            const st = await moneyStage(m, p, owner, targets, { rows, sections, reread, year, known, anchor, profile, check });
            s.owed = { ...(s.owed || {}), money: st.owed };
            late = st.late;
            for (const a of st.apps) apps.add(a);
            changes.push(...st.changes); notes.push(...st.notes);
        }
        // read: this round's messages; a failed one gets one more try next round, then it is skipped
        // a failed event can carry what later messages said (a reply, an order): the messages that got nothing this round
        // are read once more with it, so that content isn't lost
        settleRound(s, round.rows, failed, new Set(added.map(x => x.at)));
        for (const x of evidence) s.arch[x.key] = 1;
        // an archived stretch read from its section: its messages count as read (shown again later, they aren't read twice)
        const hiddenNow = [];
        // (every evidence section's hidden messages, a mixed one's too: a section retitled later must not bring them back)
        if (evidence.length) {
            const txt = new Map(chatRows().filter(r => r.hidden).map(r => [r.index, r.text])), base = s.marks.base?.index ?? -1;
            s.hiddenRead ||= {};
            for (const x of evidence) for (const [i, t] of txt) if (i > base && i >= x.first && i <= x.last && s.hiddenRead[i] === undefined) { s.hiddenRead[i] = bodyMark(t); hiddenNow.push([i, s.hiddenRead[i]]); }
        }
        // a now without its time ("2026-12-31", "1/2"): that day at the round's last event time, else the time it was
        let nowAt = (t => (/^\d{2}-\d{2}$/.test(t) ? `${t} ${arr(raw.events).map(e => [when(e?.date).slice(0, 5), hhmm(e?.time)]).filter(([d, h]) => d === t && /^\d{2}:\d{2}$/.test(h || '')).map(([, h]) => h).sort().at(-1) || (t === String(p.now || '').slice(0, 5) ? p.now.slice(6) : '') || '12:00'}`.trim() : t))(when(raw.now));
        // the phone's time only moves on, across New Year too (12-31 → 01-01 is a day later, not months back)
        // (a day or a few behind is the model slipping and is ignored; two months or more behind is a story that skipped far
        // ahead, past the half year the dates alone can tell: half a year later)
        // the scene the phone couldn't place, as the model read it: that city's clock for this round only (not kept for the
        // place: a "cafe" may be in either city next time)
        // the owner moved to another city in these messages: their clock is that city's from here on
        const ownerWent = ownerMoved(p, raw.ownerCity);
        let named = null;
        if (askZone && typeof raw.statusCity === 'string') named = zoneNamed(p, raw.statusCity, m);
        if (ownerWent || named) { st = statusMoment(p, roundEnd, named, m); if (tracker) sceneOwn = sceneHome(p, tracker.place, m, named); }
        // a status line among these messages: now is never before it (a model that took another city's hour for the
        // owner's); later, the model's own. Its status line also sets back a now that ran ahead of it the day before
        const fresh = !!st?.at && round.rows.some(r => r.index === st.i);
        if (fresh && (!hm(nowAt) || laterThan(st.at, nowAt))) nowAt = st.at;
        const gap = nowAt && p.now ? dayGap(p.now.slice(0, 5), nowAt.slice(0, 5)) : 1;
        // (set back 24 hours at most: 11-03 04:00 → 11-02 05:00 yes, → 11-01 23:00 no)
        const behind = hm(p.now) && hm(nowAt) ? -gap * 1440 + (Number(p.now.slice(6, 8)) - Number(nowAt.slice(6, 8))) * 60 + Number(p.now.slice(9, 11)) - Number(nowAt.slice(9, 11)) : 0;
        const setBack = fresh && laterThan(p.now, nowAt) && behind > 0 && behind <= 1440;
        if (nowAt && (setBack || gap > 0 || gap < -60 || gap === 0 && nowAt.slice(6) > p.now.slice(6))) {
            if (!setBack && p.year && p.now && nowAt.slice(0, 5) < p.now.slice(0, 5)) p.year++;
            // set back over New Year (01-01 to 12-31): the year before
            if (setBack && p.year && nowAt.slice(0, 5) > p.now.slice(0, 5)) p.year--;
            p.now = nowAt;
        }
        // the round's own: new days nobody told, the weather, and what the clock moving on does by itself
        const days = [...applyDays(p, raw.days, rid), ...fillDays(p, p.now, rid)], sky = lifeAhead ? [] : applyWeather(p, askWeather ? raw.weather : null, sceneOwn === true ? tracker : null, { archive: evidence.length + before.length > 0, today: String(p.now || '').slice(0, 5) });
        if (days.length) apps.add('건강');
        if (sky.length) apps.add('날씨');
        const roundFx = [...days, ...sky, ...lifeClock(p, p.now), ...dlvClock(p, p.now), ...cardClock(p, p.now)];
        // after the clock moves: the card's month is counted up to the story's now
        if (p.money) migrateBank(m, p);
        const id = rid;
        s.rounds = [...(s.rounds || []).slice(-19), id];
        p.syncLast = { checked: inRound.size + archIn.length, remaining: unreadCount(s, rows) + archivedUnread(s, sections, rows, chatRows()).length, apps: [...apps], failed: [...Object.entries(failed).map(([at, why]) => ({ at: Number(at), why, skipped: s.failed[at]?.tries >= 2 })), ...loose.map(why => ({ at: null, why }))], changes, notes, at: Date.now() };
        ensureIds(p);
        p.at = Date.now();
        pruneDropped(s, phoneItems(p));
        p.syncLast.notes = p.syncLast.notes.filter(n => !n.endsWith('뺄 수 있어요') || s.dropped.some(d => n.startsWith(`대화 ${d.label}가`)));
        p.syncUndo = { ...undo, round: id, read: [...inRound], readFp: round.rows.map(r => bodyMark(r.text)), comments: undo.comments,
            items: ITEM_KEYS.flatMap(k => (p[k] || []).filter(x => x.id && !had.has(x.id)).map(x => [k, x.id])),
            msgs: p.threads.filter(t => msgs.has(t.id)).map(t => [t.id, t.messages.map(msgSig).filter(sg => !msgs.get(t.id).has(sg))]).filter(([, xs]) => xs.length),
            effects: [...added.flatMap(x => x.effects || []), ...late.flatMap(x => x.effects || []), ...roundFx], byEvent: byEvent([...added, ...late]), after: structuredClone(mergedState(p)) };
        // kept in this browser until the saved chat shows it: 복구 can add it back if the save didn't land
        journalAdd(scope, { round: id, owner, at: Date.now(), now: p.now, year: p.year, back: !!setBack, where: structuredClone(p.where ?? null), events: [...added, ...late], ...(split ? { owed: s.owed } : {}), done: [...inRound], seen: round.rows.map(r => [r.index, bodyMark(r.text)]), failed: Object.fromEntries([...inRound].filter(i => s.failed[i]).map(i => [i, s.failed[i]])), arch: evidence.map(x => x.key), hidden: hiddenNow, life: roundFx });
        await saveMeta();
        if (p.inject) applyInjection();
        return p;
    });
}
// 복구: rounds this browser made that the saved chat doesn't have; only what is missing is added, nothing is overwritten
export const pendingRounds = (m, scope) => {
    const j = journalRead(scope);
    return j.filter(r => r.at < performance.timeOrigin && !m.phones?.[nameKey(r.owner)]?.sync?.rounds?.includes(r.round));
};
// rounds the saved chat already has are dropped once the page has been loaded again since they were made
export function tidyJournal(m, scope) {
    const j = journalRead(scope), keep = j.filter(r => !(r.at < performance.timeOrigin && m.phones?.[nameKey(r.owner)]?.sync?.rounds?.includes(r.round)));
    if (keep.length !== j.length) journalWrite(scope, keep);
    return pendingRounds(m, scope).length;
}
export async function restoreRounds(m, scope) {
    const rounds = pendingRounds(m, scope);
    for (const r of rounds) {
        const p = m.phones?.[nameKey(r.owner)];
        if (!p) continue;
        const s = syncOf(p, scope);
        for (const e of r.events) {
            for (const k of LISTS) e.add[k] = arr(e.add[k]);
            e.add.threads = arr(e.add.threads); e.add.contacts = arr(e.add.contacts);
            mergePhone(p, { ...e.add, device: null, now: '' }, { keepAll: true });
            tagItems(p, e.add);
            replayEffects(m, p, e.effects || []);
            // the event knows its records again (빼기 and later rounds go by them), and what it paid (legs)
            const ev = s.events[e.id] ||= { at: e.at, quote: e.quote || '', summary: e.summary || e.id };
            const had = new Set((ev.effects || []).map(x => JSON.stringify(x)));
            ev.effects = [...(ev.effects || []), ...(e.effects || []).filter(x => !had.has(JSON.stringify(x)))];
            if (e.legs?.length) ev.legs = [...(ev.legs || []), ...e.legs.filter(l => !(ev.legs || []).some(o => o.key === l.key))];
        }
        replayEffects(m, p, r.life || []);
        if (r.owed) s.owed = structuredClone(r.owed);
        // the story's clock as the round left it (and the year it carried over New Year)
        if (r.now && (!p.now || r.back || gapDays(String(p.now).slice(0, 5), String(r.now).slice(0, 5)) >= 0)) { p.now = r.now; if (r.year) p.year = r.year; }
        if (r.where) p.where = structuredClone(r.where);
        // a message it read well is no longer a failure to retry
        for (const i of r.done || []) if (!(r.failed || {})[i]) delete s.failed[i];
        addDone(s, r.done);
        s.seen ||= {};
        for (const [i, f] of r.seen || []) s.seen[i] = f;
        for (const [i, f] of Object.entries(r.failed || {})) s.failed[i] = f;
        for (const k of r.arch || []) s.arch[k] = 1;
        // the hidden messages it read from an archive section stay read
        for (const [i, f] of r.hidden || []) (s.hiddenRead ||= {})[i] = f;
        s.rounds = [...(s.rounds || []).slice(-19), r.round];
        if (p.money) migrateBank(m, p);
        ensureIds(p);
    }
    // the record stays until a later load shows the round saved (tidyJournal): a failed save here can be restored again
    await saveMeta();
    return rounds.length;
}

// read messages gone (deleted, or a stretch written again): what they put on the phone stays and is offered to take off
// (설정 › 대화 반영 › 빼기); unsure ones (the same words are still elsewhere) are only told
function settleDropped(p, { dropped }, notes) {
    const s = p.sync;
    if (!dropped.length) return;
    s.dropped ||= [];
    const runs = [];
    for (const d of dropped) { const last = runs[runs.length - 1]; if (last && d.old === last.to + 1 && !!d.unsure === last.unsure) last.to = d.old; else runs.push({ from: d.old, to: d.old, unsure: !!d.unsure }); }
    const items = phoneItems(p);
    for (const r of runs) {
        const ids = Object.entries(s.events).filter(([, e]) => e.at >= r.from && e.at <= r.to).map(([id]) => id), label = r.from === r.to ? `#${r.from}` : `#${r.from}–${r.to}`;
        const key = Math.random().toString(36).slice(2, 10);
        for (const id of ids) s.events[id].at = null;
        // sources from these messages lose their number: a new message given the same number is not them
        let hit = false;
        for (const { x } of items) for (const f of x.froms || []) if (f.at !== null && f.at >= r.from && f.at <= r.to) { f.was = f.at; f.at = null; f.gone = key; hit = true; }
        if (!ids.length && !hit) continue;
        if (r.unsure) { notes.push(`대화 ${label}가 바뀌었어요. 같은 말이 여럿이라 어느 것인지 몰라서, 거기서 넣은 내용은 그대로 뒀어요`); continue; }
        s.dropped.push({ key, label, events: ids, at: Date.now() });
        notes.push(`대화 ${label}가 지워졌거나 바뀌었어요. 거기서 넣은 내용은 설정 › 대화 반영에서 뺄 수 있어요`);
    }
}
// 빼기: one gone stretch's events, with the app and money records they made; an event something later builds on
// (an order delivered later, a record corrected later, shares sold later) stays, and is named
export async function dropStretch(m, p, k) {
    const s = p.sync;
    // k: the stretch's key (its place in the list can change when the list is tidied just below), or its place
    const was = typeof k === 'string' ? null : s.dropped?.[k]?.key;
    pruneDropped(s, phoneItems(p));
    const d = s.dropped.find(x => x.key === (typeof k === 'string' ? k : was));
    if (!d) return { gone: 0, items: 0, kept: [] };
    const kept = [], stay = new Set(), out = new Set();
    let gone = 0;
    for (const id of d.events) {
        const e = s.events[id];
        if (!e || e.at !== null) continue;
        const made = new Set((e.effects || []).filter(x => x.type === 'push' || x.type === 'entry').map(x => x.item?.id ?? x.id));
        // built on later: another event changed, corrected or counted one of its records as its own
        let tied = Object.entries(s.events).some(([o, x]) => o !== id && ((x.effects || []).some(y => ['status', 'amend', 'amendEntry', 'change'].includes(y.type) && made.has(y.id)) || (x.legs || []).some(l => l.state === 'included' && made.has(l.rec))));
        const trades = new Set((e.effects || []).filter(x => x.path === 'investment.trades').map(x => x.item.id));
        if (!tied && trades.size) { try { positions((p.investment?.trades || []).filter(t => !trades.has(t.id))); } catch { tied = true; } }
        // an account, share or shop it opened that something else still uses (a later payment into the account, a later
        // trade of the share, a later order from the shop) stays, and so the event does
        const pushed = path => (e.effects || []).filter(x => x.type === 'push' && x.path === path).map(x => x.item);
        const others = Object.entries(s.events).filter(([o]) => o !== id).flatMap(([, x]) => x.effects || []);
        if (!tied && pushed('money.bank.accounts').some(a => others.some(y => y.item?.account === a.last4 || String(y.key || '').startsWith(`${a.id}:`)) || (p.money?.tx || []).some(t => t.account === a.last4 && t.ev !== id))) tied = true;
        if (!tied && pushed('investment.securities').some(x => (p.investment?.trades || []).some(t => t.symbol === x.symbol && !trades.has(t.id)))) tied = true;
        if (!tied && pushed('delivery.shops').some(x => (p.delivery?.orders || []).some(o => o.shop === x.name && o.ev !== id))) tied = true;
        if (tied) { kept.push(e.summary || id); stay.add(id); continue; }
        revertEffects(m, p, e.effects || []);
        out.add(id);
        delete s.events[id];
        gone++;
    }
    // app items: one with sources goes when all of them are gone and it is as it went in (not changed by hand);
    // one saved before sources goes with its event, as before. An item of an event that stays, stays.
    const goes = (k, x) => !stay.has(x.ev) && (Array.isArray(x.froms) && x.froms.length ? orphanOf(x, d.key) && !edited(k, x) : out.has(x.ev));
    let items = 0;
    const keep = k => x => { if (!goes(k, x)) return true; items++; return false; };
    for (const key of LISTS) if (Array.isArray(p[key])) p[key] = p[key].filter(keep(key));
    for (const t of p.threads) t.messages = t.messages.filter(keep('msg'));
    p.threads = p.threads.filter(t => t.messages.length); // a thread with nothing left in it goes too
    for (const x of p.posts || []) if (x.comments) x.comments = x.comments.filter(keep('comment'));
    s.dropped.splice(s.dropped.indexOf(d), 1);
    if (p.money) migrateBank(m, p);
    await saveMeta();
    if (p.inject) applyInjection();
    return { gone, items, kept };
}
export const canUndo = p => { const u = p?.syncUndo, s = p?.sync; return !!u && s?.rounds?.[s.rounds.length - 1] === u.round && p.money?.at === u.moneyAt && p.investment?.at === u.investAt; };
// a message deleted before others: the events, failures and records that name a message number follow it
function renumber(m, p, { moved, changed, dropped = [] }) {
    const map = { ...moved };
    for (const x of changed) map[x.old] = x.at;
    // a gone message's number may be taken by a new one: records from it no longer name it
    for (const x of dropped) map[x.old] = null;
    if (!Object.entries(map).some(([o, n]) => Number(o) !== n)) return;
    const to = i => (i !== undefined && map[i] !== undefined ? map[i] : i);
    for (const e of Object.values(p.sync.events)) if (e.at !== null) e.at = to(e.at);
    for (const { x } of phoneItems(p)) for (const f of x.froms || []) if (f.at !== null) f.at = to(f.at);
    for (const f of Object.values(p.sync.failed)) if (f.span) f.span = [to(f.span[0]) ?? f.span[0], to(f.span[1]) ?? f.span[1]];
    for (const r of [...(p.money?.tx || []), ...(p.money?.orders || []), ...(p.money?.passes || []), ...(p.investment?.trades || []), ...(p.delivery?.orders || [])]) if (r.sourceIndex !== undefined) r.sourceIndex = to(r.sourceIndex);
    // the events' own copies of their records too (a changed message's events are found by them)
    for (const e of Object.values(p.sync.events)) for (const f of e.effects || []) { if (f.item?.sourceIndex !== undefined) f.item.sourceIndex = to(f.item.sourceIndex); if (f.sourceIndex !== undefined) f.sourceIndex = to(f.sourceIndex); }
    for (const a of Object.values(m.finance?.accounts || {})) if (a.owner === p.owner) for (const x of Object.values(a.entries)) if (x.sourceIndex !== undefined) x.sourceIndex = to(x.sourceIndex);
}
// 되돌리기: the last round only. What it added goes by its ids, its money comes back out, and those messages are unread again.
// Something the user changed since stays as it is; a bank or investment made again since can't be undone this way.
// what a round may change on items that were there before it (a plan moved or called off, a text marked deleted, a draft,
// a contact's saved name, the profile, a post's comments): kept before and after the round, so 되돌리기 puts back each one
// still as the round left it (one changed by hand since stays)
const sig = x => JSON.stringify([x.from, x.text, x.time]);
function mergedState(p) {
    return {
        events: Object.fromEntries((p.events || []).filter(x => x.id).map(x => [x.id, { title: x.title, ko: x.ko ?? '', date: x.date ?? '', time: x.time ?? '', cancelled: !!x.cancelled }])),
        threads: Object.fromEntries((p.threads || []).filter(t => t.id).map(t => [t.id, { draft: t.draft ?? null, deleted: (t.messages || []).filter(x => x.deleted).map(sig) }])),
        contacts: Object.fromEntries((p.contacts || []).filter(x => x.id).map(x => [x.id, x.saved ?? null])),
        profile: p.profile ? { handle: p.profile.handle ?? '', bio: p.profile.bio ?? '' } : null,
        comments: Object.fromEntries((p.posts || []).filter(x => x.id).map(x => [x.id, x.comments || []])),
    };
}
function restoreMerged(p, before, after) {
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b), now = mergedState(p);
    for (const x of p.events || []) {
        const b = before.events[x.id];
        if (!b || !same(now.events[x.id], after.events[x.id])) continue;
        Object.assign(x, { title: b.title, ko: b.ko, date: b.date, time: b.time });
        if (b.cancelled) x.cancelled = true; else delete x.cancelled;
    }
    for (const t of p.threads || []) {
        const b = before.threads[t.id], a = after.threads[t.id];
        if (!b || !a) continue;
        if (same(now.threads[t.id].draft, a.draft)) { if (b.draft === null) delete t.draft; else t.draft = b.draft; }
        const was = new Set(b.deleted), marked = new Set(a.deleted.filter(g => !was.has(g)));
        for (const x of t.messages) if (x.deleted && marked.has(sig(x))) delete x.deleted;
    }
    for (const x of p.contacts || []) if (x.id in before.contacts && same(now.contacts[x.id], after.contacts[x.id])) { if (before.contacts[x.id] === null) delete x.saved; else x.saved = before.contacts[x.id]; }
    if (same(now.profile, after.profile)) { if (before.profile) p.profile = { ...(p.profile || {}), ...before.profile }; else delete p.profile; }
    for (const x of p.posts || []) if (before.comments[x.id] && same(now.comments[x.id], after.comments[x.id])) x.comments = structuredClone(before.comments[x.id]);
}
export async function undoRound(m, p) {
    const u = p.syncUndo, s = p.sync;
    if (!u || s?.rounds?.[s.rounds.length - 1] !== u.round) throw new Error('되돌릴 반영이 없어요');
    if (!canUndo(p)) throw new Error('그 뒤에 은행이나 투자를 다시 만들어서 되돌릴 수 없어요');
    const gone = new Set(u.items.map(([, id]) => id));
    for (const k of ITEM_KEYS) if (Array.isArray(p[k])) p[k] = p[k].filter(x => !gone.has(x.id));
    for (const [tid, sigs] of u.msgs) {
        const t = p.threads.find(x => x.id === tid);
        if (t) { const drop = new Set(sigs); t.messages = t.messages.filter(x => !drop.delete(JSON.stringify([x.from, x.text, x.time]))); }
    }
    p.threads = p.threads.filter(t => t.messages.length);
    if (u.before && u.after) restoreMerged(p, u.before, u.after);
    else for (const [pid, n] of u.comments || []) { const x = (p.posts || []).find(y => y.id === pid); if (x?.comments?.length > n) x.comments = x.comments.slice(0, n); }
    // items that were there before the round forget it as a source
    for (const { x } of phoneItems(p)) if (x.froms) x.froms = x.froms.filter(f => f.r !== u.round);
    // what can't be put back (changed since, or built on) stays, and so does its event, with only what stayed
    const now = structuredClone(s.events), kept = [];
    const left = new Set(revertEffects(m, p, u.effects).map(x => JSON.stringify(x)));
    Object.assign(s, structuredClone(u.sync));
    // an event 빼기 took off since stays off (the snapshot still had it)
    for (const id of Object.keys(s.events)) if (!(id in now)) delete s.events[id];
    for (const [id, effects] of u.byEvent || []) {
        const rest = effects.filter(x => left.has(JSON.stringify(x)));
        if (rest.length && now[id]) { s.events[id] = { ...now[id], effects: [...(s.events[id]?.effects || []), ...rest] }; kept.push(now[id].summary || id); }
    }
    s.rounds.pop();
    pruneDropped(s, phoneItems(p));
    p.now = u.now;
    if (u.year !== undefined) p.year = u.year;
    if (u.where !== undefined) { if (u.where) p.where = u.where; else delete p.where; }
    delete p.syncLast; delete p.syncUndo;
    if (p.money) migrateBank(m, p);
    const scope = phoneChatScope(ctx());
    journalWrite(scope, journalRead(scope).filter(r => r.round !== u.round));
    await saveMeta();
    if (p.inject) applyInjection();
    return kept;
}

// 결제 다시 읽기: the money the last round owes, asked again now and put on that same round (되돌리기 takes it back with
// the round's texts). Only while that round is the newest; after another round, that round asks for it by itself
export const canRetryMoney = p => !!(p?.sync?.owed?.money?.length && canUndo(p));
export async function retryMoney(m, owner) {
    return exclusive('sync', async () => {
        const key = nameKey(owner), p = m.phones?.[key], scope = phoneChatScope(ctx());
        if (!canRetryMoney(p)) throw new Error('다시 읽을 결제가 없어요');
        const s = p.sync, u = p.syncUndo, made = { money: p.money?.at, invest: p.investment?.at };
        const targets = arr(s.owed.money).map(o => ({ o, e0: s.events[o.id] })).filter(x => x.e0 && Number.isInteger(x.e0.at))
            .map(({ o, e0 }) => ({ id: o.id, at: e0.at, date: o.date || '', time: o.time || '', summary: e0.summary || o.id, quote: e0.quote || '', changed: false, tries: o.tries || 0, invest: !!o.invest }));
        const [body] = splitTail(String(m.text || ''));
        const sections = parseSections(body).filter(x => !x.group && RANGE_HEAD.test(x.title)).map(x => { const mt = x.title.match(RANGE_HEAD); return { key: `${mt[2]}-${mt[4]}:${x.title.length}`, first: Number(mt[2]), last: Number(mt[4]), text: body.slice(x.start, x.end).trim() }; });
        const year = p.year && !p.noYear ? String(p.year) : String(new Date().getFullYear()), anchor = /^\d{2}-\d{2}/.test(p.now || '') ? `${year}-${p.now.slice(0, 5)}` : '';
        const profile = await ownerProfileBlock(ctx(), p.financeProfile, owner, { money: true });
        const check = () => (phoneChatScope(ctx()) !== scope || m.phones?.[key] !== p ? '다시 읽는 사이 채팅이나 폰이 바뀌었어요' : p.money?.at !== made.money || p.investment?.at !== made.invest ? '다시 읽는 사이 은행이나 투자가 새로 만들어졌어요' : !canUndo(p) || p.syncUndo !== u ? '다시 읽는 사이 반영이 또 있었어요' : '');
        const st = await moneyStage(m, p, owner, targets, { rows: syncRows(), sections, reread: null, year, known: p.year && !p.noYear ? String(p.year) : '', anchor, profile, check });
        s.owed = { ...(s.owed || {}), money: st.owed };
        // on the same round: 되돌리기 takes these back with it, and 복구 brings them back with it
        u.effects = [...u.effects, ...st.late.flatMap(x => x.effects || [])];
        u.byEvent = byEvent([...(u.byEvent || []).map(([id, effects]) => ({ id, effects })), ...st.late]);
        journalWrite(scope, journalRead(scope).map(r => (r.round === u.round ? { ...r, events: [...(r.events || []), ...st.late], owed: s.owed } : r)));
        if (p.money) migrateBank(m, p);
        if (p.syncLast) { p.syncLast.apps = [...new Set([...(p.syncLast.apps || []), ...st.apps])]; p.syncLast.notes = [...(p.syncLast.notes || []), ...st.notes]; }
        p.at = Date.now();
        await saveMeta();
        if (p.inject) applyInjection();
        return { paid: st.late.length, owed: st.owed.length, notes: st.notes };
    });
}

// ---- 롤플에 넣기: a short note of what the phones hold, after the archive
export function phoneBlock(m) {
    const ps = Object.values(m?.phones || {}).filter(p => p?.inject && p.owner);
    if (!ps.length) return '';
    const said = (p, x) => (x.from === 'me' ? p.owner : x.from);
    return `\n\n# PHONES\n_What these characters' phones hold, true to the archive. Background for when the scene touches a phone: do not bring it up unprompted, and do not build new events on it._\n${ps.map(p => {
        const out = [];
        const saved = p.contacts.filter(c => c.saved && c.saved !== c.name).map(c => `${c.name} as "${c.saved}"`);
        if (saved.length) out.push(`Contacts saved: ${saved.join(', ')}`);
        for (const t of [...p.threads].sort(byStory(p.now, lastTime)).reverse().slice(0, 4)) {
            out.push(`Texts with ${t.with}: ${t.messages.filter(x => !isGuess(x)).slice(-4).map(x => `${said(p, x)}: "${x.text}"`).join(' / ')}`);
        }
        const missed = p.calls.filter(c => c.type === 'missed' && !isGuess(c)).slice(-3);
        if (missed.length) out.push(`Missed calls: ${missed.map(c => `${c.with} (${c.time})`).join(', ')}`);
        const soon = p.events.filter(e => !isGuess(e) && (!p.now || upcoming(e, p.now))).sort((a, b) => gapDays(p.now, a.date) - gapDays(p.now, b.date)).slice(0, 3);
        if (soon.length) out.push(`Calendar: ${soon.map(e => `${e.date}${e.time ? ` ${e.time}` : ''} ${e.title}`).join('; ')}`);
        const notes = p.notes.filter(n => !isGuess(n));
        if (notes.length) out.push(`Notes: ${notes.slice(-3).map(n => n.title || n.text.slice(0, 40)).join('; ')}`);
        return `## ${p.owner}'s phone${p.now ? ` (as of ${p.now})` : ''}\n${out.map(l => `- ${l}`).join('\n')}`;
    }).join('\n')}`;
}

// ---- dates, times and numbers as the owner's phone shows them: one way for each of 한국 · 일본 · 중국 · 미국 · 영국 · 호주 · 유럽
// (a country outside them writes the European way). Every app reads its notation from here
const GROUP = { KR: 'KR', KP: 'KR', JP: 'JP', CN: 'CN', TW: 'CN', HK: 'CN', MO: 'CN', US: 'US', CA: 'US', PH: 'US', PR: 'US', GB: 'GB', IE: 'GB', AU: 'AU', NZ: 'AU' };
export const notationOf = p => { const c = String(p?.country || p?.lives || '').toUpperCase(); return c ? GROUP[c] || 'EU' : 'KR'; };
const H12 = {
    KR: (h, mi) => `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${mi}`,
    US: (h, mi) => `${h % 12 || 12}:${mi} ${h < 12 ? 'AM' : 'PM'}`,
    AU: (h, mi) => `${h % 12 || 12}:${mi} ${h < 12 ? 'am' : 'pm'}`,
};
const FMT = {
    KR: { loc: 'ko-KR', d: (mo, d) => `${mo}월 ${d}일`, s: (mo, d) => `${mo}. ${d}.`, y: (y, mo, d) => `${y}. ${mo}. ${d}.`, t: H12.KR, half: h => (h < 12 ? '오전' : '오후') },
    US: { loc: 'en-US', d: (mo, d) => `${mo}/${d}`, s: (mo, d) => `${mo}/${d}`, y: (y, mo, d) => `${mo}/${d}/${y}`, t: H12.US, hr: h => `${h % 12 || 12}${h < 12 ? 'AM' : 'PM'}`, half: h => (h < 12 ? 'AM' : 'PM') },
    JP: { loc: 'ja-JP', d: (mo, d) => `${mo}月${d}日`, s: (mo, d) => `${mo}/${d}`, y: (y, mo, d) => `${y}/${pad(mo)}/${pad(d)}` },
    CN: { loc: 'zh-CN', d: (mo, d) => `${mo}月${d}日`, s: (mo, d) => `${mo}/${d}`, y: (y, mo, d) => `${y}/${pad(mo)}/${pad(d)}` },
    GB: { loc: 'en-GB', d: (mo, d) => `${pad(d)}/${pad(mo)}`, s: (mo, d) => `${pad(d)}/${pad(mo)}`, y: (y, mo, d) => `${pad(d)}/${pad(mo)}/${y}` },
    AU: { loc: 'en-AU', d: (mo, d) => `${d}/${mo}`, s: (mo, d) => `${d}/${mo}`, y: (y, mo, d) => `${d}/${mo}/${y}`, t: H12.AU, hr: h => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`, half: h => (h < 12 ? 'am' : 'pm') },
    EU: { loc: 'de-DE', d: (mo, d) => `${pad(d)}.${pad(mo)}.`, s: (mo, d) => `${pad(d)}.${pad(mo)}.`, y: (y, mo, d) => `${pad(d)}.${pad(mo)}.${y}` },
};
const fmtOf = p => FMT[notationOf(p)];
// the locale the phone's numbers and money are written in (1,234.5 or 1.234,5)
export const localeOf = p => fmtOf(p).loc;
export const parts = v => { const mt = String(v || '').match(/^(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/); return mt ? { mo: Number(mt[1]), d: Number(mt[2]), h: mt[3] ? Number(mt[3]) : null, mi: mt[4] || '' } : null; };
const tOf = (p, h, mi) => { const f = fmtOf(p); return f.t ? f.t(h, mi) : `${pad(h)}:${mi}`; };
// a clock in minutes of the day ("HH:MM" or a number), as the phone writes it: 오후 3:05 · 3:05 PM · 15:05
const minOf = v => { if (typeof v === 'number') return Number.isFinite(v) ? ((Math.round(v) % 1440) + 1440) % 1440 : null; const mt = String(v ?? '').match(/(\d{1,2}):(\d{2})/); return mt ? (Number(mt[1]) % 24) * 60 + Number(mt[2]) : null; };
export const clockOf = (p, v) => { const m = minOf(v); return m === null ? '' : tOf(p, Math.floor(m / 60), pad(m % 60)); };
// the same without 오전/오후 (a big number, a chart's axis): 3:05 on a 12-hour phone, 15:05 on the others
export const clockNum = (p, v) => { const m = minOf(v); if (m === null) return ''; const h = Math.floor(m / 60); return fmtOf(p).t ? `${h % 12 || 12}:${pad(m % 60)}` : `${pad(h)}:${pad(m % 60)}`; };
// 오전/오후 · AM/PM alone, '' on a 24-hour phone
export const halfOf = (p, v) => { const m = minOf(v); const f = fmtOf(p); return m === null || !f.half ? '' : f.half(Math.floor(m / 60)); };
// an hour mark (the weather's hours): 3PM · 3pm, else 15시 (오후 3시 does not fit the hour's narrow column)
export const hourOf = (p, v) => { const m = minOf(v); if (m === null) return ''; const h = Math.floor(m / 60), f = fmtOf(p); return f.hr ? f.hr(h) : `${h}시`; };
// a date with its year (a receipt, a statement): 2026. 10. 30. · 10/30/2026 · 2026/10/30 · 30.10.2026
export const fullDate = (p, v) => { const mt = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return mt ? fmtOf(p).y(mt[1], Number(mt[2]), Number(mt[3])) : ''; };
export function fmtDate(p, v, short = false) { const x = parts(v); if (!x) return ''; const f = fmtOf(p); return short ? f.s(x.mo, x.d) : f.d(x.mo, x.d); }
export function fmtTime(p, v) { const x = parts(v); return x && x.h !== null ? tOf(p, x.h, x.mi) : ''; }
// a list's time: the clock on the phone's today, the short date before it
// the moment the screen being drawn shows (the story's now), set by screen(); the phone's own "now" otherwise
let shownNow = '';
export const showNow = v => { shownNow = v; }; // the window sets the story's now it is showing
const nowOf = p => shownNow || p.now || '';
export const listTime = (p, v) => (String(v).slice(0, 5) === String(nowOf(p)).slice(0, 5) ? fmtTime(p, v) : fmtDate(p, v, true));
export const bigClock = (p, v) => { const x = parts(v); if (!x || x.h === null) return ''; return fmtOf(p).t ? `${x.h % 12 || 12}:${x.mi}` : `${pad(x.h)}:${x.mi}`; };
const minsOf = v => { const x = parts(v); return x ? ((x.mo * 31 + x.d) * 24 + (x.h ?? 0)) * 60 + (Number(x.mi) || 0) : 0; };
export const ago = (p, v) => {
    const d = minsOf(nowOf(p)) - minsOf(v);
    if (String(v).slice(0, 5) !== String(nowOf(p)).slice(0, 5) || d < 0) return fmtDate(p, v, true);
    return d < 1 ? '지금' : d < 60 ? `${d}분 전` : `${Math.floor(d / 60)}시간 전`;
};
export const lastTime = t => t.messages.filter(x => !x.deleted).at(-1)?.time || '';
// still to come at `now`: a later day, or today at a time not yet passed (or all day)
export const upcoming = (e, now) => { if (e.cancelled) return false; const day = String(now).slice(0, 5), hm = String(now).slice(6), g = gapDays(day, e.date); return g > 0 || (g === 0 && (!e.time || !hm || e.time >= hm)); };

// the story's now: the newest status window when it has a time, else what the phone was made with
// a date's month and day, 1-based: "2026-10-26", "10/26", or a month name the calendars know (their months count from 0)
export function monthDay(text) {
    const s = String(text || '');
    const num = s.match(/(?:^|\D)(?:\d{4}[-/.]\s*)?(\d{1,2})[-/.]\s*(\d{1,2})(?!\d)/);
    if (num && Number(num[1]) >= 1 && Number(num[1]) <= 12 && Number(num[2]) >= 1 && Number(num[2]) <= 31) return { mo: Number(num[1]), d: Number(num[2]) };
    // day first ("26.10.", "26/10/2026"): a first number past 12 is the day
    if (num && Number(num[1]) > 12 && Number(num[1]) <= 31 && Number(num[2]) >= 1 && Number(num[2]) <= 12) return { mo: Number(num[2]), d: Number(num[1]) };
    const cals = calendars(), d = headingDate(`(${s})`, cals).date;
    if (d?.d && cals[d.cal]?.length === 12) return { mo: d.m + 1, d: d.d };
    // a month by its name ("30. Januar", "Jan 30"), the way the phone reads dates elsewhere
    const w = when(s).slice(0, 5);
    return /^\d{2}-\d{2}$/.test(w) ? { mo: Number(w.slice(0, 2)), d: Number(w.slice(3)) } : null;
}
// a dated row's day as the phone writes it ("10-25"), or '' when its calendar is not a 12-month one
export const rowDay = r => (r?.date?.d && calendars()[r.date.cal]?.length === 12 ? `${pad(r.date.m + 1)}-${pad(r.date.d)}` : '');
// the newest status line's weather, its date as "MM-DD" whatever shape the line writes it in ("1월 30일 (토)", "Jan 30")
export const trackerWeather = t => { const w = weatherFrom(t); if (w) { const d = monthDay(w.date); w.date = d ? `${pad(d.mo)}-${pad(d.d)}` : when(w.date).slice(0, 5); } return w; };
// the story's now: the newest status line on the owner's clock (statusMoment), else the phone's own. Read to now (no upto),
// the later of the two: a text that came a few minutes after the status line is not in the future
// upto: the story as it stood at that message (a request that read only so far)
export function storyNow(p, upto = null, m = null) {
    let at = '';
    try { at = statusMoment(p, upto, null, m)?.at || ''; } catch { /* no status window */ }
    // (and read up to the phone's clock: a fill's now is the phone's own, not an older status line's)
    if ((upto == null || upto >= (phoneAt(p) ?? Infinity)) && at && hm(p?.now) && laterThan(p.now, at)) return p.now;
    return at || p?.now || '';
}

// ---- 위치 판독: where the owner and the people on their phone are now and where they live, read by the model from the
// character cards and the persona word for word, the story's current state and the newest messages. Asked when a phone
// is made, once for a phone that has none, and again when the owner's city changes; OWNER'S CLOCK goes by it first
export const AI_SYS_WHERE = `GOAL
Work out where each person is now and where they live, in a long role-play, so a character's phone shows the right time for each of them.

YOU GET
- CHARACTER CARD: the role-play character's card, word for word (one per character in a group chat).
- PERSONA (sometimes): the user's character, word for word.
- OWNER PROFILE (sometimes): the background the user chose for the phone's owner.
- STORY NOW (sometimes): the story's current state, from the end of the archive.
- RECENT CHAT: the newest messages.
- OWNER: whose phone it is. PEOPLE: the others on the owner's phone.
- OWNER DOESN'T KNOW (sometimes): facts the owner does not know, or only suspects.

WHERE
- "city": where the person is now, in the story's present. A trip or a stay counts; a birthplace or a past home doesn't.
- "names": every name the same city goes by here. Always each name the chat's messages and status lines write it as, exactly as written ("München", "뮌헨", "서울 강남"'s "서울"); then its English and its Korean name. A chat in English with status lines in Korean gives both.
- "lives": the country they live in now, not where they were born or their nationality. Born in Germany, living in Korea: "KR".
- "tz": the time zone of "city", like "Asia/Seoul".
- The newest of the story wins over a card: a card that says Berlin, a story that has moved them to Seoul: Seoul.
- Someone nothing here places: leave them out. Never guess from a name or a language.
- Someone whose whereabouts are in OWNER DOESN'T KNOW: leave them out. The owner's phone may not know them.
- "evidence": the few words that show it.

JSON (one object, nothing before or after it)
{ "people": [{ "name": as in OWNER or PEOPLE, "city": in English, "names": [], "lives": two-letter country code, "tz", "evidence" }] }`;
const realTz = v => { const z = String(v || '').trim(); if (!/^[A-Za-z]+(?:\/[A-Za-z_+-]+){1,2}$/.test(z)) return ''; try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return z; } catch { return ''; } };
// the cards as they are: every field the story can say where someone is in, nothing summed up
const CARD_KEYS = ['description', 'personality', 'scenario', 'first_mes', 'mes_example'];
const cardText = ch => CARD_KEYS.map(k => { const v = ch?.data?.[k] ?? ch?.[k]; return v ? `[${k}]\n${v}` : ''; }).filter(Boolean).join('\n\n');
// the other phones in this chat: given, else the chat's own saved ones (a screen or a fill that has only the phone)
const phonesOf = m => m?.phones || ctx()?.chatMetadata?.narrative_archive?.phones || null;
function whereRequest(m, p) {
    const c = ctx(), g = c.groupId ? (c.groups || []).find(x => x.id === c.groupId) : null;
    const chars = g ? (g.members || []).map(a => (c.characters || []).find(x => x.avatar === a)).filter(Boolean) : [c.characters?.[c.characterId]].filter(Boolean);
    const persona = String(c.powerUserSettings?.persona_description || '').trim(), upto = phoneAt(p);
    const people = [...new Set([...(p.threads || []).map(t => t.with), ...(p.contacts || []).map(x => x.name), ...Object.values(m.phones || {}).map(q => q?.owner)].filter(n => n && nameKey(n) !== nameKey(p.owner)))].slice(0, 16);
    const [, tail] = splitTail(String(m.text || ''));
    return { chars, persona, people, blocks: [
        ...chars.map(ch => `[CHARACTER CARD — ${ch.name || ch.data?.name || ''}]\n${cardText(ch) || '(empty)'}`),
        persona ? `[PERSONA — ${c.name1 || 'user'}]\n${persona}` : '',
        tail.trim() ? `[STORY NOW]\n${tail.trim()}` : '',
        `[RECENT CHAT]\n${chatUpto(recentForCheck(1e9), upto).slice(-8).join('\n\n').slice(-8000) || '(none yet)'}`,
        `[OWNER]\n${p.owner}`, `[PEOPLE]\n${people.join('\n') || '(none)'}`, blindBlock(m, p.owner),
    ] };
}
// the names a city goes by: as the chat writes it, in English and in Korean (an older reading's one "local" counts too)
const namesOf = x => [...new Set([x?.city, x?.local, ...arr(x?.names)].map(v => line(v, 60)).filter(Boolean))].slice(0, 8);
const whereRow = x => ({ name: line(x?.name, 60), city: line(x?.city, 60), names: namesOf(x), lives: String(x?.lives || '').trim().toUpperCase().slice(0, 2), tz: realTz(x?.tz) });
export async function readWhere(m, p) {
    const r = whereRequest(m, p), binding = p.financeProfile;
    // a profile that is a lorebook entry is the one thing the cards and the persona don't already hold
    const lore = binding?.type === 'lore' ? await resolvePhoneProfile(ctx(), binding).catch(() => null) : null;
    const input = [...r.blocks.slice(0, -3), lore ? `[OWNER PROFILE — chosen by the user for ${p.owner}]\n${lore.text}` : '', ...r.blocks.slice(-3)].filter(Boolean).join('\n\n');
    const raw = jsonOf(await askDraft(input, { force: true, system: AI_SYS_WHERE, maxTokens: 2000, effort: 'low' }));
    const known = new Set([p.owner, ...r.people].map(nameKey));
    const got = arr(raw?.people).map(whereRow).filter(x => x.name && known.has(nameKey(x.name)) && (x.tz || COUNTRY_TZ[x.lives])).slice(0, 16);
    // read again: someone it leaves out keeps what was read before
    const people = [...got, ...(p.where?.people || []).filter(o => !got.some(x => nameKey(x.name) === nameKey(o.name))).map(o => ({ ...o, names: namesOf(o) }))].slice(0, 16);
    p.where = { at: Date.now(), people };
    return people;
}
// a read that fails is noted and not asked again (the clock goes by the phones and the countries); one already there stays
const tryWhere = async (m, p) => { try { await readWhere(m, p); } catch (err) { console.warn('[narrative-archive] where', err); p.where = { ...(p.where || { at: Date.now(), people: [] }), failed: true }; } };
// the owner moved to another city in the story (the reflection says so): their row in the reading follows
function ownerMoved(p, c) {
    const tz = realTz(c?.tz), city = line(c?.city, 60);
    if (!tz || !city) return false;
    const row = { ...whereOf(p, p.owner), name: p.owner, city, names: namesOf(c), tz };
    delete row.local;
    p.where = { at: p.where?.at || Date.now(), people: [row, ...(p.where?.people || []).filter(x => nameKey(x.name) !== nameKey(p.owner))] };
    return true;
}
const whereOf = (p, name) => (p?.where?.people || []).find(x => nameKey(x.name) === nameKey(name));
const regionName = c => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(c) || c; } catch { return c; } };
// a zone with the names a status line may call its city by
const zoneOfWhere = x => (!x ? null : x.tz ? { tz: x.tz, where: x.city || regionName(x.lives), names: namesOf(x) } : COUNTRY_TZ[x.lives] ? { tz: COUNTRY_TZ[x.lives], where: x.city || regionName(x.lives), names: namesOf(x) } : null);
function zoneOfPhone(q) {
    const w = q?.life?.weather, city = cityAt(w?.here?.place, w?.cities), c = String(q?.lives || q?.country || '').toUpperCase();
    return city?.tz ? { tz: city.tz, where: city.name, names: [city.name, city.ko] } : COUNTRY_TZ[c] ? { tz: COUNTRY_TZ[c], where: regionName(c), names: [] } : null;
}
// ---- one place decides whose clock a status line shows. The owner's zone: where they were read (or last moved) to be,
// else their phone's saved city, else the country. The time zones around them: the saved cities, the people read to be
// somewhere, the other phones in the chat. Every clock on the phone goes by these
export const ownerZone = p => zoneOfWhere(whereOf(p, p?.owner)) || zoneOfPhone(p);
function placesAround(p, m = null) {
    const out = [], own = ownerZone(p);
    // (the owner's own place as the weather app has it is one of their names too: a zone known only by the country)
    if (own) out.push({ tz: own.tz, name: own.where, names: [own.where, ...own.names, p?.life?.weather?.here?.place] });
    for (const c of arr(p?.life?.weather?.cities)) if (c?.tz) out.push({ tz: c.tz, name: c.name, names: [c.name, c.ko] });
    for (const x of p?.where?.people || []) if (nameKey(x.name) !== nameKey(p.owner)) { const z = zoneOfWhere(x); if (z) out.push({ tz: z.tz, name: z.where, names: z.names, who: x.name }); }
    // another phone's owner: where that phone read them to be, else its own saved city or country
    for (const q of Object.values(phonesOf(m) || {})) if (q && q !== p && q.owner && !whereOf(p, q.owner)) { const z = ownerZone(q); if (z) out.push({ tz: z.tz, name: z.where, names: z.names, who: q.owner }); }
    return out;
}
export function zonesOf(p, at = p?.now, m = null) {
    const own = ownerZone(p), t = String(at || '');
    if (!own || !/^\d{2}-\d{2} \d{2}:\d{2}$/.test(t)) return null;
    const mins = v => { const [d, h] = [String(v).slice(0, 5), String(v).slice(6)]; return dayGap(t.slice(0, 5), d) * 1440 + Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5)); };
    const base = mins(t), hours = tz => (mins(zoneShift(t, own.tz, tz, Number(p.year) || undefined)) - base) / 60, others = [];
    for (const z of placesAround(p, m).slice(1)) {
        const name = z.who || z.name;
        if (z.tz === own.tz || others.some(o => nameKey(o.name) === nameKey(name))) continue;
        const h = hours(z.tz);
        if (h) others.push(z.who ? { name: z.who, where: z.name, hours: h } : { name: z.name, hours: h });
    }
    return others.length ? { own: { name: own.where, tz: own.tz }, at: t, others } : null;
}
// what the model is told of them: it only adds or takes off the hours given (the code works them out)
export const clockBlock = (p, at = p?.now, m = null, st = null) => {
    const z = zonesOf(p, at, m);
    const hrs = h => `${Math.abs(h)} hour${Math.abs(h) === 1 ? '' : 's'} ${h > 0 ? 'ahead' : 'behind'}`;
    return z ? `[OWNER'S CLOCK]\nThe owner is in ${z.own.name}, ${z.at} now.\n${z.others.map(c => (c.where ? `${c.name} (in ${c.where}) is ${hrs(c.hours)}` : `${c.name} is ${hrs(c.hours)}`)).join(', ')}.${st?.known && st.at && st.at !== st.raw ? `\nThe newest status line, ${st.raw} in ${st.city}, is ${st.at} here.` : ''}` : '';
};
const pkey = v => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const sceneOf = place => String(place || '').split(/\s*[,，→>/·|]\s*/)[0].trim();
// the zone a status line's place names: its scene part is a known city's name, or starts with it ("서울 강남"). A name
// only at the start ("Paris Baguette") is taken only when it is the owner's own zone; in another zone it is no proof
export function sceneZone(p, place, m = null) {
    const sc = sceneOf(place), whole = pkey(sc), words = sc.split(/\s+/).filter(Boolean), first = pkey(words[0]), own = ownerZone(p);
    if (!whole) return null;
    // the place's first words as one ("New York" of "New York City")
    const leads = new Set(words.map((_, k) => pkey(words.slice(0, k + 1).join(' '))));
    let part = null;
    for (const z of placesAround(p, m)) for (const raw of z.names.filter(Boolean)) {
        const n = pkey(raw);
        if (!n) continue;
        // the whole scene, or a city of two words or more its first words are (no shop is named "New York ...")
        if (n === whole || /\s/.test(String(raw).trim()) && leads.has(n)) return { tz: z.tz, name: z.name };
        // the first word, the Korean name it starts with, or the scene the start of a longer city name ("Frankfurt")
        if (!part && (n === first || whole.startsWith(n) && n.length >= 2 && /^[가-힣]/.test(n) || whole.length >= 4 && n.startsWith(whole))) part = z;
    }
    return part && (!own || part.tz === own.tz) ? { tz: part.tz, name: part.name } : null;
}
// whose clock a status line's scene keeps: true the owner's, false another zone's, null unknown (on a phone that keeps
// other zones). A phone with no zone of its own, or no other zone around, is the owner's
export function sceneHome(p, place, m = null, named = null) {
    const own = ownerZone(p), z = sceneZone(p, place, m) || named;
    // a known city is the owner's only when it is in their own zone (Paris for an owner in Frankfurt is elsewhere, though
    // its clock reads the same)
    if (own && z) return z.tz === own.tz;
    if (!own || !zonesOf(p, hm(p?.now) ? p.now : '01-01 12:00', m)) return true;
    return null;
}
// the newest status line up to upto, on the owner's clock: at '' when its scene's zone is unknown (it may be someone
// else's hour). named: the zone the reflection gave for it this round. null with no dated status line
const hm = v => /^\d{2}-\d{2} \d{2}:\d{2}$/.test(String(v || ''));
const laterThan = (a, b) => { const g = dayGap(String(b).slice(0, 5), String(a).slice(0, 5)); return g > 0 || g === 0 && String(a).slice(6) > String(b).slice(6); };
// the same, never throwing (no status window: null): for a fill's OWNER'S CLOCK
export const statusAt = (p, upto = null, m = null) => { try { return statusMoment(p, upto, null, m); } catch { return null; } };
export function statusMoment(p, upto = null, named = null, m = null) {
    const t = recentTrackers(1, upto == null ? {} : { chat: (ctx().chat || []).slice(0, upto + 1) })[0];
    const d = t?.date ? monthDay(t.date) : null;
    if (!t || !Number.isFinite(t.min) || !d) return null;
    const raw = `${pad(d.mo)}-${pad(d.d)} ${pad(Math.floor(t.min / 60))}:${pad(t.min % 60)}`, place = t.city || t.place || '', base = { raw, place, i: t.i };
    const home = sceneHome(p, place, m, named);
    if (home === true) return { ...base, at: raw, city: ownerZone(p)?.where || '', home: true, known: true };
    if (home === null) return { ...base, at: '', home: false, known: false };
    const scene = sceneZone(p, place, m) || named;
    return { ...base, at: zoneShift(raw, scene.tz, ownerZone(p).tz, Number(p.year) || undefined), city: scene.name, home: false, known: true };
}
// a city the reflection named for a status line: its zone (a saved city, someone's city, the owner's own)
function zoneNamed(p, name, m = null) {
    const own = ownerZone(p), k = pkey(name);
    if (!k) return null;
    if (k === 'owner' && own) return { tz: own.tz, name: own.where };
    for (const z of placesAround(p, m)) if (pkey(z.who) === k || z.names.some(n => pkey(n) === k)) return { tz: z.tz, name: z.name };
    return null;
}
// ---- the places they have been: section headings that name a place, in sections the owner is in (no model).
// One row a place, newest visit first: a move ("A → B") counts for both, and a place gone to again counts up
export function placesOf(m, owner) {
    const re = nameRe(owner), cals = calendars(), seen = new Map();
    for (const s of parseSections(String(m.text || '')).filter(x => !x.group && RANGE_HEAD.test(x.title)).reverse()) {
        if (!re.test(m.text.slice(s.start, s.end))) continue;
        const pl = headingPlaces(s.title, cals);
        if (!pl.length) continue;
        const d = headingDate(s.title, cals);
        const day = d.date?.d && cals[d.date.cal]?.length === 12 ? `${pad(d.date.m + 1)}-${pad(d.date.d)}` : '';
        const name = s.title.match(RANGE_HEAD)[5].replace(/^\s*[—–-]\s*/, '').replace(/\s*\([^()]*\)\s*(\[[^\]]*\])?\s*$/, '').trim();
        for (const place of pl) {
            const k = nameKey(place), had = seen.get(k);
            if (had) had.n++;
            else seen.set(k, { place, n: 1, day, date: d.date?.label || '', time: d.time || '', scene: name, key: sectionKey(s) });
        }
    }
    return [...seen.values()].slice(0, 40);
}

export const koOn = () => globalSettings().phoneKo !== false;
export const savedName = (p, n) => p.contacts.find(c => nameKey(c.name) === nameKey(n))?.saved || n;
export const hasKo = p => [...p.threads.flatMap(t => t.messages), ...p.photos, ...p.notes, ...p.searches, ...p.events, ...(p.posts || []), ...(p.mails || []), ...(p.diary || [])].some(x => x.ko);

// ---- 은행 · 지갑 · 쇼핑 (채우기): one request for all three, so the amounts agree. Balances and everyday payments are
// invented (the user wants a real-looking bank); purchases and bookings come from the story. None of it goes back to the
// model or into the role-play
export const AI_SYS_MONEY = `GOAL
Fill the money side of one character's phone in a long role-play: their bank, the cards and passes in their wallet, and their online orders. The user opens these apps to peek at the character's life.

YOU GET
- ARCHIVE, RECENT CHAT, OWNER, and sometimes STORY YEAR, WORLD, LOREBOOK, OWNER PROFILE and OWNER DOESN'T KNOW. Nothing on the phone may show what the owner doesn't know.
- PHONE NOW: what the phone already holds (mails, events, searches, food deliveries), with their "ev" tags. A delivery there is paid through the delivery app; the app puts it in the bank, so it gets no "tx".
- FINANCIAL SCALE (sometimes): how much the owner's bank deposits come to, worked out beforehand.
- EVALUATION DATE: the story's day, for exchange rates. SAVED RATES: the rates the app already has for it.
${CLOCK_GET}
- EXISTING ACCOUNTS (sometimes): the accounts the bank already has.

STORY OR INVENTED
- Trips, bookings, gifts and big purchases: only what the story shows or plainly implies. Give each the "ev" tag the phone's mail or event for it already has.
- Besides the story's, 2 to 4 passes already used in the past months, fitting the owner's life and tastes (a film, a match, a concert, an exhibition, a past trip's boarding pass or train ticket), dated before the story's now, "status": "used", with no "ev". Never one that contradicts the story. Coming bookings stay only the story's.
- Rent, wages, bills and subscriptions: invent them, fitting the owner's job and life, unless the story gives them.
- Besides the story's, 2 to 4 everyday online orders fitting the owner (household things, books, clothes), with no "ev".
- An amount the story gives stays as it is: whose it is, its currency, its date and what it was for. A company's value, a transfer or an old balance is not what the owner has in the bank now.
- Balances, last four digits, card expiry dates, everyday payments (coffee, groceries, transit), and amounts the story doesn't give: invent them, fitting the owner's life, job and country. The deposits together fall within FINANCIAL SCALE.
- Company money, family money and an inheritance still to come are not the owner's cash. Don't invent a trust or a restriction to explain a small balance.
- A booking the story has carries the details a real one would (a booking number, a seat, a gate, a delivery date), made up to fit.
- Orders stand as of the story's now: with no sign it arrived, it is not "delivered".
- "basis": a line or two on what the story gave and what you invented. Invented amounts are for the app only, never new facts in the role-play.

ACCOUNTS
- A credit card account has "balance": 0. The app adds up the month from its card payments in "tx": purchases minus, refunds plus; paying the card off is a transfer, not a refund. A payment not yet settled is "pending".
- EXISTING ACCOUNTS keep their id, kind, last4, currency and balance; only their names may change. No new accounts.

ONE THING, ONE AMOUNT
A purchase is in "orders" or "passes" and once in "tx", with the same amount, date and "ev".

TIMES
- ${OWN_CLOCK}

LANGUAGE
Banks, shops, merchants and items named as they would be in the owner's country. A name not in Korean gets "ko"; a Korean one gets none.

JSON (one object, nothing before or after it)
{
  "currency": three-letter code,
  "basis": what the story gave and what you invented,
  "bank": { "name", "accounts": [{ "id": its id in EXISTING ACCOUNTS or REBUILD ACCOUNTS, or "", "kind": "checking" | "savings" | "credit", "name", "last4", "currency": three-letter code, "balance": number }] },
  "cards": [{ "account": last4, "exp": "MM/YY" }],
  "tx": [{ "account": last4, "who": merchant or person, "ko", "amount": number (minus for money out), "time": "MM-DD HH:MM",
           "kind": "card" | "transfer" | "deposit" | "cash", "memo", "pending": true or false, "ev" }],
  "passes": [{ "kind": "flight" | "train" | "hotel" | "event" | "other", "by": airline, line, hotel or venue, "from", "to",
               "date": "MM-DD", "time": "HH:MM", "seat", "gate", "no", "status", "ev" }],
  "orders": [{ "shop", "item", "ko", "option", "qty", "price": number, "time", "status": "ordered" | "shipped" | "on the way" | "delivered" | "unknown",
               "eta": "MM-DD", "arrived": "MM-DD", "gift": who it is for or "", "ev" }],
  "fx": [{ "from": an account currency, "to": FINANCIAL SCALE's currency, "date": EVALUATION DATE, "value": number }] for each pair SAVED RATES doesn't have
}
2 to 4 accounts and 8 to 15 transactions. Coming passes and orders only from the story. Oldest first.
Numbers are plain JSON numbers, without separators.`;

// 은행 새로 만들기: the same accounts, everything else made again
const MONEY_REBUILD = `

REBUILD
REBUILD ACCOUNTS means the user asked for the money apps to be made again.
- The same accounts, no more and no fewer: keep each one's id, kind, last4 and currency.
- Everything else is new: balances, cards, transactions, passes and orders, read again from the story. Don't copy the old invented balances.
- A deposit account's balance is its CURRENT balance, 0 or more: what it holds now, after your transactions and after MONEY ALREADY MOVED.
- MONEY ALREADY MOVED is money the app already recorded going in or out of each account. Leave it out of "tx"; if it is the same story event as an amount you write, count it once.
- Return every list, even an empty one.`;

// 음성 메모 (채우기): memos at moments the archive has, spoken rather than written
export const AI_SYS_VOICES = `GOAL
Fill the voice memo app of one character's phone in a long role-play: memos they recorded to themselves at moments in the story so far.

YOU GET
- ARCHIVE, RECENT CHAT, OWNER, and sometimes STORY YEAR, WORLD, LOREBOOK, OWNER PROFILE and OWNER DOESN'T KNOW. Nothing on the phone may show what the owner doesn't know.
- DIARY: the owner's diary entries, so the memos are not the same moments told again.
${CLOCK_GET}

RULES
- ${OWN_CLOCK}
- 3 or 4 memos, each at a moment the archive has where the owner could plausibly talk into their phone alone: after a fight, on the way somewhere, late at night. Not the days the diary already covers, where possible.
- Spoken, not written: the way the owner talks in the archive and chat, with pauses (…), restarts and half sentences. Not a diary entry.
- Only what the archive shows happened and what the owner felt about it; no new events, no new secrets.
- In the owner's own language. Speech not in Korean gets "ko"; Korean speech gets none.
- 20 to 90 seconds of speech each.

ANSWER — one JSON object, nothing else:
{ "memos": [{ "title": the name the phone would show, "kt", "text", "ko", "time": "MM-DD HH:MM", "sec": its length in seconds, "place": where, or "" }] }
Oldest first.`;

// story: how many tokens of chat stand in for a missing archive (0: the recent chat only, as with an archive)
// read: an object to put what was read in ({ gap }), for a request whose app marks where it read up to
export async function sideRequest(m, owner, blocks, { profile, money = false, story = 0, read = null } = {}) {
    const world = worldText(m), lore = await loreFor(m, owner);
    const profileText = await ownerProfileBlock(ctx(),profile,owner,{money});
    const ph = m.phones?.[nameKey(owner)] || null, gap = read && 'gap' in read ? read.gap : windowOf(m, ph), upto = nowAt(gap);
    const recent = chatUpto(recentForCheck(1e9), upto).slice(-6).join('\n\n').slice(-6000);
    if (read) read.gap = gap;
    return [
        archiveBlock(m, archiveFor(m, -1, upto).text || '(empty)', 'ARCHIVE', story, upto),
        world ? `[WORLD]\n${world}` : '', lore ? `[LOREBOOK]\n${lore}` : '',
        afterBlock(gap) || (recent && !(story && noArchive(m)) ? `[RECENT CHAT]\n${recent}` : ''),
        yearBlock(m, ph, upto), `[OWNER]\n${owner}`, profileText, blindBlock(m, owner), ...blocks, namesBlock(m),
    ].filter(Boolean).join('\n\n');
}
// an answer without a currency takes the owner's country's, not a guess at euros
const HOME_CUR = { KR: 'KRW', US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', JP: 'JPY', CN: 'CNY', TW: 'TWD', CA: 'CAD', AU: 'AUD', RU: 'RUB', BR: 'BRL' };
export function parseMoney(raw, country = '') {
    if (!raw || typeof raw !== 'object') throw new Error('모델 답에서 은행 · 지갑 · 쇼핑 내용(JSON)을 찾지 못했어요');
    const cur = /^[A-Z]{3}$/.test(String(raw.currency || '').toUpperCase()) ? String(raw.currency).toUpperCase() : HOME_CUR[country] || 'EUR';
    const code = v => { const c = String(v || '').trim().toUpperCase(); return /^[A-Z]{3}$/.test(c) ? c : ''; };
    const accounts = arr(raw.bank?.accounts).map(a => ({ id: line(a?.id, 80), currency: code(a?.currency) || cur, kind: pick(a?.kind, ['checking', 'savings', 'credit'], 'checking'), name: line(a?.name, 40), last4: last4(a?.last4), balance: num(a?.balance) })).filter(a => a.last4).slice(0, 4);
    // two accounts the model gave the same last 4 digits: the second gets its own (records find their account by them)
    const seen4 = new Set(); for (const a of accounts) { while (seen4.has(a.last4)) a.last4 = String((Number(a.last4) + 1) % 10000).padStart(4, '0'); seen4.add(a.last4); }
    // a record's account as the model names it: its last 4 digits, else its name
    const acctOf = v => { const d = last4(v); if (accounts.some(a => a.last4 === d)) return d; const w = String(v || '').toLowerCase().replace(/\s+/g, ''); return (w && accounts.find(a => a.name && a.name.toLowerCase().replace(/\s+/g, '') === w))?.last4 || ''; };
    return {
        currency: cur, basis: str(raw.basis, 1500),
        bank: { name: line(raw.bank?.name, 40) || 'Bank', accounts },
        cards: arr(raw.cards).map(c => ({ account: acctOf(c?.account), exp: line(c?.exp, 5) })).filter(c => accounts.some(a => a.last4 === c.account)).slice(0, 6),
        // a record on no account the bank has is shown nowhere: left out; money in with no kind is a deposit
        tx: arr(raw.tx).map(x => withEv({ account: acctOf(x?.account), who: line(x?.who, 60), ko: ko(x?.ko), amount: num(x?.amount), time: when(x?.time), kind: pick(x?.kind, ['card', 'transfer', 'deposit', 'cash'], num(x?.amount) > 0 ? 'deposit' : 'card'), memo: line(x?.memo, 80), pending: x?.pending === true }, x)).filter(x => x.who && x.amount !== null && x.amount !== 0 && x.account).slice(-30),
        passes: arr(raw.passes).map(x => withEv({ kind: pick(x?.kind, ['flight', 'train', 'hotel', 'event', 'other'], 'other'), by: line(x?.by, 60), from: line(x?.from, 40), to: line(x?.to, 40), date: when(x?.date).slice(0, 5), time: hhmm(x?.time), seat: line(x?.seat, 12), gate: line(x?.gate, 12), no: line(x?.no, 24), status: line(x?.status, 30) }, x)).filter(x => x.by).slice(-10),
        orders: arr(raw.orders).map(x => withEv({ shop: line(x?.shop, 60), item: line(x?.item, 80), ko: ko(x?.ko), option: line(x?.option, 60), qty: Math.max(1, Math.round(num(x?.qty) || 1)), price: num(x?.price), time: when(x?.time), status: pick(x?.status, ['ordered', 'shipped', 'on the way', 'delivered', 'unknown', 'cancelled', 'returning', 'returned', 'refunded'], 'unknown'), eta: when(x?.eta).slice(0, 5), arrived: when(x?.arrived).slice(0, 5), gift: giftOf(x?.gift) }, x)).filter(x => x.item).slice(-12),
    };
}
// what a money fill's second turn adds: history only, put after the first's (the same payment, pass or order told again is
// that one). Its payments count as in the balance already (the first's balances are as of the story's now)
const MORE_CAP = { cards: 6, tx: 40, passes: 14, orders: 16 };
function moneyMore(m, p, n, tx) {
    // the same payment told again a few minutes off (the same account and amount within half an hour), the same order on
    // the same day, is the one there
    const mins = t => (/^\d{2}-\d{2} \d{2}:\d{2}/.test(String(t || '')) ? Number(t.slice(6, 8)) * 60 + Number(t.slice(9, 11)) : NaN);
    const near = (a, b) => String(a.time).slice(0, 5) === String(b.time).slice(0, 5) && (!(Math.abs(mins(a.time) - mins(b.time)) > 30));
    const same = { tx: (a, b) => a.account === b.account && a.amount === b.amount && near(a, b), passes: (a, b) => a.kind === b.kind && String(a.by).toLowerCase() === String(b.by).toLowerCase() && a.date === b.date,
        orders: (a, b) => String(a.shop).toLowerCase() === String(b.shop).toLowerCase() && String(a.item).toLowerCase() === String(b.item).toLowerCase() && String(a.time).slice(0, 5) === String(b.time).slice(0, 5), cards: (a, b) => a.account === b.account };
    const add = list => { const had = p.money[list] || [], fresh = []; for (const x of n[list]) if (![...had, ...fresh].some(y => same[list](y, x))) fresh.push(x); const all = [...(p.money[list] || []), ...fresh]; p.money[list] = (list === 'tx' || list === 'orders' ? all.sort(byStory(p.now)) : all).slice(-MORE_CAP[list]); return fresh; };
    add('cards'); add('passes'); add('orders');
    const fresh = tx ? add('tx') : [];
    ensureIds(p);
    for (const t of fresh) {
        const a = p.money.bank.accounts.find(x => x.last4 === t.account), ledger = a && finance(m).accounts[`${a.id}:${a.currency}`];
        if (ledger && t.id && !ledger.included.includes(t.id)) ledger.included.push(t.id);
    }
}
// what the phone already holds, so the money side reuses its event tags
const moneyContext = (p, now = p.now) => JSON.stringify({ now, mails: (p.mails || []).slice(-8).map(x => ev(x, { from: x.from, subject: x.subject, time: x.time })), events: real(p.events).slice(-8).map(x => ev(x, { title: x.title, date: x.date, time: x.time })), searches: real(p.searches).slice(-6).map(x => ev(x, { q: x.q, time: x.time })),
    ...(p.delivery?.orders?.length ? { deliveries: p.delivery.orders.filter(o => o.status !== 'cancelled').slice(-12).map(o => ev(o, { shop: o.shop, time: o.time, total: dlvTotal(o) })) } : {}) });
export const prepareWealth = (m,p,refresh=false) => ensureWealth(m,p,()=>sideRequest(m,p.owner,[`[OWNER COUNTRY]\n${p.country || ''}`,`[ACCOUNT CURRENCIES]\n${JSON.stringify((p.money?.bank?.accounts || []).map(a=>a.currency))}`],{profile:p.financeProfile,money:true}),{refresh});
export const fillMoney = (m, p, opts = {}) => exclusive('fill', () => makeMoney(m, p, opts));
async function makeMoney(m, p, { regenerateBalances = false, wealthPlan = null } = {}) {
    const mark0 = markNow();
    let mark = mark0;
    // what it reads after the archive; its day is the story's where that stops (now, when it reads to the end), not
    // the phone's now from when it was made
    const read = { gap: windowOf(m, p) }, at = storyNow(p, nowAt(read.gap)) || p.now;
    migrateBank(m, p);
    const old = p.money, rebuild = !!old && regenerateBalances;
    const plan = wealthPlan || await prepareWealth(m,p,regenerateBalances);
    const date = wealthDate(m,p,at);
    const accountState = () => JSON.stringify([p.money,p.financeProfile,finance(m)]);
    const before = accountState();
    const preserved = rebuild ? `[REBUILD ACCOUNTS]\n${JSON.stringify(old.bank.accounts.map(({id,kind,name,last4,currency})=>({id,kind,name,last4,currency})))}\n[MONEY ALREADY MOVED]\n${JSON.stringify(old.bank.accounts.map(a=>({id:a.id,currency:a.currency,entries:finance(m).accounts[`${a.id}:${a.currency}`]?.entries || {}})))}` : old ? `[EXISTING ACCOUNTS]\n${JSON.stringify(old.bank.accounts)}` : '';
    const system = AI_SYS_MONEY + (rebuild ? MONEY_REBUILD : '');
    const rates = () => `[SAVED RATES]\n${JSON.stringify(Object.fromEntries(Object.entries(finance(m).prices).filter(([k])=>k.startsWith('FX:')).map(([k,book])=>[k,book[date]])))}`;
    const input = await sideRequest(m,p.owner,[`[PHONE NOW]\n${moneyContext(p, at)}`,clockBlock(p, at, m, statusAt(p, nowAt(read.gap), m)),preserved,wealthBlock(plan,'deposits'),`[EVALUATION DATE]\n${date}`,rates()],{profile:p.financeProfile,money:true,read});
    mark = readMark(read.gap) || mark;
    let correction='';
    for(let attempt=0;attempt<2;attempt++) {
        const out = await askDraft(input+'\n'+correction,{force:true,system,maxTokens:12000});
        const raw = jsonOf(out), next = parseMoney(raw, p.country);
        if (p.money !== old || accountState() !== before) throw new Error('생성 중 계좌가 변경됐어요. 다시 시도해 주세요');
        if (old) {
            if (rebuild) {
                const rows = raw?.bank?.accounts;
                if (!Array.isArray(rows) || rows.length !== old.bank.accounts.length || old.bank.accounts.some(a => {
                    const matches = rows.filter(b=>b.id === a.id);
                    return matches.length !== 1 || String(matches[0].currency || '').toUpperCase() !== a.currency || matches[0].kind !== a.kind || last4(matches[0].last4) !== a.last4 || a.kind!=='credit' && (!finite(num(matches[0].balance)) || num(matches[0].balance) < 0);
                })) throw new Error('새 계좌 잔액을 확인하지 못했어요. 기존 잔액은 유지돼요');
                if (['cards','tx','passes','orders'].some(k=>!Array.isArray(raw[k])) || next.tx.some(t=>!old.bank.accounts.some(a=>a.last4===t.account))) throw new Error('새 거래 내역을 확인하지 못했어요. 기존 데이터는 유지돼요');
                next.bank.accounts = old.bank.accounts.map(a => {
                    const b = rows.find(b=>b.id === a.id);
                    return {...a,name:next.bank.accounts.find(b=>b.id === a.id)?.name || a.name,balance:a.kind==='credit'?0:num(b.balance)};
                });
            } else next.bank.accounts = old.bank.accounts.map(a => ({ ...a, name: next.bank.accounts.find(b => b.id === a.id)?.name || a.name }));
            next.currency = old.currency;
            next.displayCurrency = old.displayCurrency;
            next.fxDate = old.fxDate;
            if (!rebuild) next.tx = old.tx;
            next.asOf = old.asOf;
            if (!rebuild) next.basis = old.basis || next.basis;
        }
        // Stage the whole result: malformed responses cannot partially rewrite a baseline.
        const staged = {finance:structuredClone(finance(m))};
        if (rebuild) for (const a of next.bank.accounts) {
            if (a.kind === 'credit') continue;
            const key = `${a.id}:${a.currency}`, ledger = staged.finance.accounts[key];
            if (ledger) {
                // The new amount is current cash. Retain all ledger entries and offset them once.
                const net = cash(ledger) - ledger.amount;
                reviseBaseline(staged,key,a.balance - net,'계좌 새로 만들기');
            }
        }
        const updated = {...p,money:{...next,at:Date.now()}};
        ensureIds(updated);
        if (rebuild) {
            const oldIds = new Set((old.tx || []).map(t=>t.id));
            for (const a of next.bank.accounts) {
                const ledger = staged.finance.accounts[`${a.id}:${a.currency}`];
                if (!ledger || a.kind === 'credit') continue;
                ledger.included = ledger.included.filter(id=>!oldIds.has(id) || staged.finance.transfers[id]);
                ledger.included = [...new Set([...ledger.included,...updated.money.tx.filter(t=>t.account===a.last4).map(t=>t.id)])];
            }
        }
        migrateBank(staged,updated);
        if (!old || rebuild) {
            addWealthFX(staged,raw.fx,date);
            correction=wealthCheck(staged,plan,'deposits',updated.money.bank.accounts.filter(a=>a.kind!=='credit').map(a=>({currency:a.currency,amount:a.balance})),date);
            if(correction) {if(attempt===0) {correction += '\n[PREVIOUS CANDIDATE]\n'+JSON.stringify(raw);continue;}throw new Error('예금 규모를 재력 기준에 맞추지 못했어요. 기존 금융 데이터는 유지돼요');}
        }
        p.money = updated.money; m.finance = staged.finance;
        // stopped short of the phone's clock: a second turn adds the history the rest of the story has (cards, payments,
        // passes, orders); the accounts and their balances stay the first's. One that fails keeps the first
        const two = secondTurn(m, p, read.gap);
        let last = read.gap, short = null;
        if (two) {
            try {
                const at2 = storyNow(p, nowAt(two.cover)) || p.now, tx = !old || rebuild, soFar = { cards: raw.cards, ...(tx ? { tx: raw.tx } : {}), passes: raw.passes, orders: raw.orders };
                const only = `The bank, its accounts and their balances stay as they are: leave "bank" and "fx" out${tx ? '' : ', and "tx" too (the bank keeps its own)'}`;
                const input2 = await sideRequest(m, p.owner, [`[PHONE NOW]\n${moneyContext(p, at2)}`, clockBlock(p, at2, m, statusAt(p, nowAt(two.cover), m)), `[EXISTING ACCOUNTS]\n${JSON.stringify(p.money.bank.accounts)}`, `[EVALUATION DATE]\n${date}`, rates(),
                    `${soFarHead('MONEY', two.short, only)}\n${JSON.stringify(soFar)}`, two.short?.text || ''], { profile: p.financeProfile, money: true, read: { gap: two.cover } });
                const out2 = String(await askDraft(input2, { force: true, system: AI_SYS_MONEY, maxTokens: 12000 }) ?? ''), raw2 = jsonOf(out2);
                // an answer that isn't the JSON, or one cut off before its end: what it read isn't all there, so the mark
                // stays where the first turn stopped
                if (!raw2 || typeof raw2 !== 'object' || !/\}\s*(?:```)?\s*$/.test(out2)) throw new Error('모델 답에서 은행 내용(JSON)을 끝까지 찾지 못했어요');
                if (p.money !== updated.money) throw new Error('생성 중 계좌가 변경됐어요');
                moneyMore(m, p, parseMoney({ ...raw2, currency: p.money.currency, bank: p.money.bank }, p.country), tx);
                last = two.cover; short = two.short;
            } catch (err) { console.warn('[narrative-archive] money, second turn', err); }
        }
        mark = readMark(last) || mark0;
        // the delivery app's orders are paid from the bank now there is one
        payOrders(m, p, String(date || p.money.asOf || '').slice(0, 4) || String(new Date().getFullYear()));
        syncOf(p, phoneChatScope(ctx())).marks.money = mark;
        await saveMeta();
        if (two) turnsNote(last, '은행', short); else readNote(read.gap);
        return p.money;
    }
}
// a recording's length: seconds, or "1:20"
// a recording's length: seconds, "1:20", "1분 20초", "2 min", "1m30s"
export const secOf = v => {
    const s = String(v ?? ''), mt = s.match(/(\d{1,2}):(\d{2})/), mn = !mt && s.match(/(\d+)\s*(?:min(?:ute)?s?|분|m)(?![a-z])(?:\s*(\d+)\s*(?:s(?:ec(?:onds?)?)?|초))?/i);
    const n = mt ? mt[1] * 60 + Number(mt[2]) : mn ? mn[1] * 60 + Number(mn[2] || 0) : num(v);
    return Math.max(3, Math.min(900, Math.round(n || 30)));
};
export async function fillVoice(m, p) {
    const diary = (p.diary || []).slice(-6).map(d => `- ${d.date} ${d.title}`).join('\n');
    const out = await askDraft(await sideRequest(m, p.owner, [`[DIARY]\n${diary || '(none)'}`, clockBlock(p, p.now, m)], {story:CHAT_TOKENS.apps,profile:p.financeProfile}), { force: true, system: AI_SYS_VOICES, maxTokens: 6000 });
    const memos = arr(jsonOf(out, { salvage: 'whole' })?.memos).map(x => ({ title: line(x?.title, 80), kt: line(x?.kt, 80), text: str(x?.text, 2000), ko: str(x?.ko, 2000), time: when(x?.time), sec: secOf(x?.sec), place: line(x?.place, 60), src: 'guess' })).filter(x => x.text);
    if (!memos.length) throw new Error('모델 답에서 음성 메모를 찾지 못했어요');
    p.voice = [...(p.voice || []).filter(x => x.src === 'story' || x.now), ...memos].sort(byStory(p.now)).slice(-CAP.voice);
    p.voiceAt = Date.now();
    ensureIds(p);
    await saveMeta();
    return p.voice;
}


// Device flavor is private UI data. It never enters phoneBlock or the RP injection.
export function parseDevice(raw, owner = '') {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    raw = raw.device || raw.deviceInfo || raw.device_info || raw;
    const scalar=v=>typeof v==='string' || typeof v==='number' ? String(v).trim() : '';
    const first=(...values)=>values.map(scalar).find(Boolean) || '';
    const model=line(first(raw.model,raw.modelName,raw.model_name),80);
    const os=line(typeof raw.os==='object' && raw.os ? [scalar(raw.os.name),scalar(raw.os.version)].filter(Boolean).join(' ') : first(raw.os,raw.osVersion,raw.os_version,raw.softwareVersion,raw.software_version),80);
    // Keep display text as given. Normalize familiar units without rejecting other notations.
    const capacity=typeof raw.storage==='object' && raw.storage ? `${first(raw.storage.capacity,raw.storage.value)} ${scalar(raw.storage.unit)}`
        : first(raw.storage,raw.storageCapacity,raw.storage_capacity) || (raw.storageGB!=null ? `${scalar(raw.storageGB)} GB` : raw.storage_gb!=null ? `${scalar(raw.storage_gb)} GB` : '');
    const match=capacity.normalize('NFKC').replace(/기가바이트/gi,'GB').replace(/테라바이트/gi,'TB').match(/^\s*(\d+(?:[.,]\d+)?)\s*(GB|TB)\s*$/i);
    const storage=match ? `${Number(match[1].replace(',','.'))} ${match[2].toUpperCase()}` : line(capacity,80);
    const name=line(first(raw.name,raw.deviceName,raw.device_name),80);
    const serial=line(first(raw.serial,raw.serialNumber,raw.serial_number),32);
    const device={name,model,os,storage,serial};
    return Object.values(device).some(Boolean) ? device : null;
}
// Use the same JSON extraction as bank and voice generation; keep every readable field.
export const readDeviceReply = out => parseDevice(jsonOf(out));
const deviceRequests = new WeakMap();
export async function fillDevice(m,p) {
    if(p.device) return p.device;
    if(deviceRequests.has(p)) return deviceRequests.get(p);
    const request=(async()=>{
        const binding=JSON.stringify(p.financeProfile);
        const input=await sideRequest(m,p.owner,[`[COUNTRY]\n${p.country || ''}`],{profile:p.financeProfile});
        const out=await askDraft(input,{force:true,system:AI_SYS_DEVICE,maxTokens:4000,effort:'low'});
        const device=readDeviceReply(out);
        if(!device) throw new Error('모델 답에서 기기 정보(JSON)를 찾지 못했어요');
        if(JSON.stringify(p.financeProfile)!==binding) throw new Error('인물 정보가 변경됐어요. 다시 불러와 주세요');
        if(m.phones && m.phones[nameKey(p.owner)]!==p) return null;
        if(!p.device) {p.device=device;await saveMeta();}
        return p.device;
    })();
    deviceRequests.set(p,request);
    try {return await request;} finally {deviceRequests.delete(p);}
}
