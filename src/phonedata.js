// 캐릭터 휴대폰 · 데이터: what the phone holds — the model's JSON cleaned and merged, the request (archive, lorebook, world),
// 롤플에 넣기, dates and times as the owner's phone shows them, and the places they have been.

import { ensureWealth, wealthBlock, wealthDate, wealthCheck, addWealthFX } from './wealth.js';
import { askDraft as askDraftAny } from './ai.js';
// the phone's requests give up after 5 minutes (a stuck call would hold 반영 and the fills for good)
const askDraft = (input, o = {}) => askDraftAny(input, { timeout: 300000, ...o });
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
import { glossaryEntries, glossaryPeople } from './translate.js';
import { worldText } from './world.js';
import { phoneChatScope, phoneTarget } from './phonestory.js';
import { rememberStory, dateOrderSource, htmlClocks, htmlDatedClocks, htmlTimeContext, swapDate, withDateOrder, withDateOrderSync, tidyKo, arr, evOf, gapDays, giftOf, hhmm, jsonOf, ko, parseJson, storyMin, byStory, yearIn, last4, line, num, pad, pick, str, when, withEv } from './phoneparse.js';
import { clockFallback, exactClockShift } from './phoneclock.js';
import { PLACE } from './phonemapcity.js';
export { tidyKo, arr, gapDays, giftOf, hhmm, jsonOf, ko, last4, line, num, pad, pick, storyMin, byStory, str, when, withEv };
import { COUNTRY_TZ, applyDays, applyLife, applyWeather, cardClock, cityAt, dayGap, dlvClock, fillDays, lifeClock, lifeNow, weatherFrom, zoneShift } from './phonesynclife.js';
import { applyMoney, dlvTotal, investNow, moneyMissing, moneyNow, orderClock, payOrders, recordsMoney, regularClock, replayEffects, revertEffects } from './phonesyncmoney.js';
import { isDone, pruneDropped, srcOf, addFrom, orphanOf, itemMark, edited, busy, exclusive, joinComments, realign, bodyMark, newSync, syncOf, makeMark, settleMarks, pickRound, unreadCount, addDone, settleRound, archiveRound, archivedUnread, readBefore, reachesEnd, quoted, journalAdd, journalRead, journalWrite } from './phonesync.js';

export const WALLS = ['dusk', 'ocean', 'forest', 'rose', 'night', 'sand', 'mono', 'aurora'];
export const ACCENTS = ['blue', 'green', 'orange', 'pink', 'purple', 'red'];
export const MOODS = ['warm', 'cool', 'green', 'dark', 'bright', 'pink'];
export const COUNTRIES = { KR: '한국', US: '미국', GB: '영국', DE: '독일', FR: '프랑스', IT: '이탈리아', ES: '스페인', JP: '일본', CN: '중국', TW: '대만', CA: '캐나다', AU: '호주', RU: '러시아', BR: '브라질' };
export const CAP = { threads: 12, messages: 40, calls: 30, photos: 24, notes: 12, searches: 20, events: 16, contacts: 30, posts: 20, comments: 8, mails: 20, diary: 20, voice: 12, visits: 60 };
// visits: the places the owner went to (the map app), each visit its own record
const LISTS = ['calls', 'photos', 'notes', 'searches', 'events', 'posts', 'mails', 'diary', 'voice', 'visits'];

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
- People: only people the story or PEOPLE AROUND has. A relationship word (girlfriend, ex, husband, boss) only if the archive or chat uses it for them.
- Nothing later than the newest moment of the story.
- The diary holds only what the archive shows happened and what the owner felt about it; no new secrets, no new feelings.`;
// every time on the phone is the owner's own clock: a time written on the other side of the world is moved to theirs
export const OWN_CLOCK = `Every time is on the owner's phone clock, where the owner is now. A time on a screen or in a scene goes by the city of whoever's screen or scene it is: the owner's city, or no OWNER'S CLOCK, keeps it; another city in OWNER'S CLOCK moves it by its hours there (a messenger timestamp on the other side's screen). A status line's time is the clock of the city its scene is in; OWNER'S CLOCK gives the newest one on the owner's clock when that is another city.`;
export const CLOCK_GET = `- OWNER'S CLOCK (sometimes): where the owner is, their time now, and how many hours the other saved cities and the people elsewhere are ahead or behind.`;
// a request that doesn't set the phone's clock (an app's fill, making some apps again) or makes a phone: the block may hold
// the newest message's screen time converted, as the reflection's does, and is read by the reflection's own rules
export const FILL_CLOCK_GET = `- OWNER'S CLOCK (sometimes): where the owner is, their time now, and how many hours the other saved cities and the people elsewhere are ahead or behind; sometimes the newest message's screen time already converted to the owner's clock (Time choices).`;
const CLOCK_VIEW = `- Viewpoint: use the default viewpoint in OWNER'S CLOCK when set. Change it only when the surrounding narration shifts to another person's scene, not merely a sender's name. A time or date alone does NOT identify whose clock it is. Attachments keep their own clocks.`;
// (the reflection's CLOCK FIRST without what only setting the clock needs: whose screen, how a screen's time is moved)
export const FILL_CLOCK = `${CLOCK_VIEW}
- A screen's time: use the matching converted OWNER'S CLOCK value as-is; otherwise convert it to the owner's time zone. This step only converts time zones; never add elapsed time. Same zone: unchanged. Example: +8h: 12:32 → 20:32 exactly.
- Other scenes, memories and appointments keep their own times.`;
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
  "calls": [{ "with": name, "type": "in" | "out" | "missed", "time", "min": minutes talked, "count": calls in a row (34 missed calls are one item) }],
  "photos": [{ "caption": what the photo shows, "ko", "time", "mood": one of ${MOODS.join(', ')} }],
  "notes": [{ "title", "kt": Korean title, "text", "ko", "time" }],
  "searches": [{ "q", "ko", "time", "tab": true if its page is still open on the phone, "mark": true if they bookmarked it }],
  "events": [{ "title", "ko", "date": "MM-DD", "time": "HH:MM" or "" }],
  "profile": { "handle": the owner's SNS name, "bio", "ko", "followers": a number, "following": a number },
  "posts": [{ "text", "ko", "photo": what the posted photo shows or "", "pko": its Korean, "time", "likes": a number,
              "comments": [{ "from": name, "text", "ko" }] }],
  "mails": [{ "from": sender, "subject", "ks": Korean subject, "text", "ko", "time", "unread": true or false }],
  "diary": [{ "date": "MM-DD", "title", "kt": Korean title, "text", "ko" }],
  "visits": [{ "place": a place the owner really went to, as the story writes it (a room, a shop, a house; a city alone when the story names nothing closer there, never the city they live in alone), "city": the city it is in, or "", "home": true when it is the owner's own home, "with": [the people there with them], "time", "already": the id of that same visit in PHONE NOW, else "" }],
  "voice": [{ "title", "kt", "text", "ko", "time", "sec", "place" }] only when the archive or chat shows the owner recorded one`;
// (반영: a voice memo may be an everyday one too, so the 폰 만들기 limit is left off there)
const VOICE_ONLY = ' only when the archive or chat shows the owner recorded one';
const PHONE_LAST = `Any item may carry "ev": a short tag for one story event, the same on every item that comes from it (the flight's mail and its photo both "ev": "berlin-flight").
A booking the story has carries the details a real one would (a booking number, a seat, a gate), made up to fit. Never a booking, a trip or a purchase the story doesn't have.`;

const CLOCK_FIRST = `CLOCK FIRST
First resolve "clock" and "now" for the latest scene, then write events and app records using those times.

${CLOCK_VIEW}
- Given exact time:
  1. In the last message, identify the stated time relevant to the present.
  2-1. If current, use it unchanged.
  2-2. Otherwise, add only stated elapsed time to reach the present (e.g., "three hours ago", "about ten minutes", "a few weeks later").
  3. The result must represent the present, not the past or future.
  WARNING: Actions that take time ≠ explicitly stated elapsed time
- No exact time: your task is to infer the current time. The last message may mix present, past, and future. Identify the story's current point within it, then infer its time from context.

- "clock":
  - basis (max 20 words: default used or narrative evidence for a switch; time passed)
  - finalViewpoint (the final viewpoint determined for the last message)
  - elapsedTime (stated elapsed time used; null if absent)
  - sceneTime (the resulting current scene time before conversion, already including elapsedTime)
  - messageSender (who sent the displayed message; null if absent).

- "now": use the matching converted OWNER'S CLOCK value as-is; otherwise convert "clock.sceneTime" to the owner's time zone. This step only converts time zones; never add elapsed time. Same zone: unchanged. Example: +8h: 12:32 → 20:32 exactly.
- App records: the owner's present scene agrees with "now". Other scenes, memories and appointments keep their own times.`;
// making a phone sets its clock, as a reflection does: CLOCK FIRST and its "clock"; making some apps again doesn't
// (its clock stays): only how a time is read
export const AI_SYS_PHONE = `GOAL
Show what one character's phone holds right now, in a long role-play. The user opens it to peek at the story from the phone's side.
An app draws the screens from your JSON; you only write the content.

YOU GET
- ARCHIVE: the story so far, in sections (#numbers are chat messages), with the current state at the end.
- WORLD (sometimes): the shared setting.
- LOREBOOK (sometimes): setting notes the user picked.
- PEOPLE AROUND (sometimes): people in the owner's life, close or not, from the cards, persona, profile and lorebook, with where things stand now.
- RECENT CHAT: the messages after the archive, oldest first.
- OWNER: whose phone it is. STORY YEAR (sometimes): the story's year.
- OWNER PROFILE (sometimes): the background the user chose for the owner.
- OWNER DOESN'T KNOW (sometimes): facts the owner does not know, or only suspects. Nothing on the phone may show them as known.
- DEVICE — locked (sometimes): the phone they already have. Keep it as it is.
${FILL_CLOCK_GET}

${CLOCK_FIRST}

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
  "clock": { "basis": "default used or switch evidence; time passed", "finalViewpoint": "name", "elapsedTime": null or "3 hours", "sceneTime": "MM-DD HH:MM", "messageSender": null or "name" },
  "now": "MM-DD HH:MM",
  "device": { "name": device name, "model": model name, "os": OS and version, "storage": capacity with GB or TB, "serial": invented serial number },
${PHONE_ITEMS}
}
At most 6 threads of up to 12 messages, 10 calls, 8 photos, 5 notes, 8 searches (3 open at most), 6 events, 5 posts with up to 4 comments,
6 mails, 5 diary entries, the 12 newest visits. Fewer is fine; an empty list is fine. The diary has no "everyday" entries.
Oldest first in every list.
${PHONE_LAST}`;
export const AI_SYS_PHONE_APPS = `GOAL
Show what one character's phone holds right now, in a long role-play. The user opens it to peek at the story from the phone's side.
An app draws the screens from your JSON; you only write the content.

YOU GET
- ARCHIVE: the story so far, in sections (#numbers are chat messages), with the current state at the end.
- WORLD (sometimes): the shared setting.
- LOREBOOK (sometimes): setting notes the user picked.
- PEOPLE AROUND (sometimes): people in the owner's life, close or not, from the cards, persona, profile and lorebook, with where things stand now.
- RECENT CHAT: the messages after the archive, oldest first.
- OWNER: whose phone it is. STORY YEAR (sometimes): the story's year.
- OWNER PROFILE (sometimes): the background the user chose for the owner.
- OWNER DOESN'T KNOW (sometimes): facts the owner does not know, or only suspects. Nothing on the phone may show them as known.
- DEVICE — locked (sometimes): the phone they already have. Keep it as it is.
${FILL_CLOCK_GET}

${PHONE_TEST}
${FILL_CLOCK}

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
6 mails, 5 diary entries, the 12 newest visits. Fewer is fine; an empty list is fine. The diary has no "everyday" entries.
Oldest first in every list.
${PHONE_LAST}`;

// 새로 일어난 일 반영: one round of unread messages at a time; each story event says where it comes from
// 새로 일어난 일 반영: the request is put together from the apps the phone has. A phone without a bank, a delivery app or
// the everyday apps gets none of their rules or fields (the request stays short and cheap).
// life: 시계 · 건강 · 파일 (and 날씨 only when no status line gives it: weather)
// weather: the model writes the weather (no status line gives it, or the day moved on); tracker: a status line gives some
// split: the first of two steps (core): no money, each event marked "money" when it touches it (moneySystem writes it after)
// 시계 · 파일 items and their rules, the same in the reflection and its 일상
const LIFE_ALARMS = `  "alarms": [{ "change": an id or "", "time", "label", "ko", "days": the weekdays it repeats or [], "date": "MM-DD" for a one-time alarm, "on", "wake", "then", "snooze", "snoozeCount", "sound" }],`;
const LIFE_FILES = `  "files": [{ "change": an id or "", "name", "kind", "folder": one of LIFE NOW's "folders" (downloads are "Downloads"), or a new one the story makes, "size": KB, "time", "from", "pages", "length": "M:SS" for audio or video, "tag": "red" | "orange" | "", "private", "preview", "look": what it shows (a picture or video: "sea" | "city" | "night" | "food" | "hills" | "pet" | "sunset" | "mountain" | "snow" | "flower" | "interior" | "concert" | "paper" | "screenshot" | "map"; a document: "ticket" (a flight or train ticket, "preview": "carrier · from → to · date") | "receipt" | "invoice" | "cv" | "letter" | "certificate" | "recipe" | "medical" | "menu" | "contract" | "notes"; audio: "voice" | "music"), "ko", "opened", "deleted": true when removed }],`;
const LIFE_TIMERS = `  "timers": [{ "label", "ko", "sec" }],`;
const LIFE_ONCE = `- An alarm for one occasion (a flight, an appointment) rings once: "days": [] and its "date". Only an alarm the owner keeps for every week has "days".`;
const LIFE_CHANGE = `- A record already in LIFE NOW is changed with "change": its id; write only the fields that changed. A deleted file is "deleted": true.`;
// wallet: the phone has the bank's wallet, whose tickets the calendar shows (core then writes none of them)
export function updateSystem({ money = true, delivery = false, life = false, weather = false, tracker = false, split = false, invest = false, zone = false, archiveOnly = false, wallet = false } = {}) {
    const paid = delivery ? 'order, ticket or delivery' : 'order or ticket';
    return `${split ? 'STAGE: core\n' : ''}GOAL
Add to one character's phone what a few new chat messages put on it, in a long role-play. The user opens the phone to peek at the story from the phone's side.
An app adds your JSON to the phone; you only write what is new.

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
- PEOPLE AROUND (sometimes): people in the owner's life, close or not, from the cards, persona, profile and lorebook, with where things stand now.
- OWNER, and sometimes STORY YEAR, WORLD, LOREBOOK, OWNER PROFILE and OWNER DOESN'T KNOW. Nothing on the phone may show what the owner doesn't know.

${archiveOnly ? '' : `${CLOCK_FIRST}\n\n`}WHAT IS NEW
- Only what happens in NEW MESSAGES or ARCHIVE FOR THESE MESSAGES. Guesses and memories of earlier days add nothing.
${split ? '' : `- Something done before that the phone would hold, first told of here (an order already placed, a ticket already bought): an event in that message; its money says "again".
`}- A plan made in these messages goes in the calendar; what is planned hasn't happened yet (no payment, no photo).
${wallet ? `- A ticket the wallet holds (a flight, a train, a hotel stay, a show, a membership) shows on the calendar from there: no calendar item for it. A reservation or an appointment is still a calendar item.
` : ''}- Each message's own replies, orders and payments belong to the event in that message, not folded into an earlier one.
- An event in EVENTS ON THE PHONE keeps its id; add only what the phone doesn't hold yet.
- MESSAGES READ BEFORE, NOW CHANGED were already put on the phone: give their events the ids listed there${split ? '' : '; a payment in them is that same payment, its amount corrected if it changed'}.
- Small things around an event are fine (how a text was worded, a photo of the place, a search they would make). Nothing the story contradicts, no new facts or plans.
- People: only people the story or PEOPLE AROUND has. A relationship word (girlfriend, ex, husband, boss) only if the messages or archive use it for them.
- A diary entry holds what these messages show and what the owner feels about it, as the story and PEOPLE AROUND show them; no new secrets or events.

WHERE IT COMES FROM
- "at": the number of the message the event happens in. For an archive section, the message in its range it belongs to.
- "quote": a few words copied exactly as written in that message or section, not reworded.
- "date" and "time": when it happens in that message ("MM-DD", "HH:MM" if known). A plan for later happens when it is made; its later day goes only on the calendar item.
- "now": ${archiveOnly ? 'the moment of the newest message, never a time something is only planned for.' : 'the time resolved in CLOCK FIRST.'}
- "moved": only people these messages put in another city (a trip, a move, coming home), the owner too: [{ "name": as in OWNER or the messages, "city": in English, "names": [each name the messages and status lines write it as, exactly, then its English and Korean names], "tz": its time zone like "Asia/Seoul", "in": the two-letter country code of "city" }]; else [].
${zone ? `- "statusCity": whose clock the newest status line here shows (the app can't place its scene): a city or person in OWNER'S CLOCK, "owner" for the owner's own, another city as { "city": in English, "tz" }, or "" when the messages don't say.\n` : ''}${life ? `
LIFE
- An alarm the owner sets, changes or switches on or off in these messages; a timer they set; a file they receive, save, scan or delete. Pictures the camera takes go to photos, not files.
${LIFE_ONCE}
${LIFE_CHANGE}
- Health: a row for every story day these messages move into. A day these messages show goes in that event's "phone"."health"; a day already in LIFE NOW that the story now shows is rewritten the same way. Every other new day goes in the top-level "days", written freely from the character and their life (a lazy Sunday, a day on their feet, a sleepless night), still following that day's events and tickets. The day of "now" again every time, with its totals so far (steps, workouts, coffee, water, "screen"), even when nothing new happened.
- "screen" on each day: that day's phone use, from what happened and how they felt (a fight: hours of texting late into the night; a day out with friends: barely any), in their own habits (LIFE NOW's usual), plus any other app that day called for, by its real name (a trip: maps, a translator).
- A lasting change to their habits or body these messages state (they lost weight, quit coffee, drink more water, get up earlier now, quit a game, glued to the phone lately): that event's "phone"."usual" with only what changed. Nothing said: no "usual".
${weather ? `- "weather": ${tracker ? 'WEATHER NOW stands for an owner in that scene (its date, time, place and weather); write the rest of the forecast to agree with it, "from": "chat". An owner elsewhere gets the weather where they are.' : 'what these messages describe, else the archive. If the story\'s day or place changed with nothing to go on, what fits the season and place, "from": "guess". If neither changed and nothing describes it: null (the app keeps the last weather).'}
- With new weather, also write each saved city's "cond", "temp", "hi" and "lo".
` : ''}` : ''}${money ? `
MONEY (only with MONEY NOW or INVESTMENTS NOW)
- A payment, transfer, refund, order, ticket or trade that happens in these messages goes in the event's "money".
- An amount the story gives stays as it is. A real one with no amount gets a plausible amount for the owner, the place and MONEY NOW: "amountFrom": "guess".
- A payment the scene plainly implies (eating out, a taxi ride) counts; one someone else may have paid does not. Never invent a payment the scene doesn't show or imply.
- Every move, trade, order and ticket says "occurrence": "new" when it happens in this message, "again" when the message only talks about one made before.
- An order or ticket made before and not in MONEY NOW yet ("I already ordered you a scarf") is still written, "again": the app puts it in with no payment. Its shop or price may be "" or null when the story doesn't say.
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
{ ${archiveOnly ? '' : '"clock": { "basis": "default used or switch evidence; time passed", "finalViewpoint": "name", "elapsedTime": null or "3 hours", "sceneTime": "MM-DD HH:MM", "messageSender": null or "name" },\n  '}"now": "MM-DD HH:MM", "moved": [],${zone ? ' "statusCity": "",' : ''}
  "events": [{ "id": an id from EVENTS ON THE PHONE, or a short new tag like "berlin-flight", "at": 123, "quote": "exact words",
               "date": "MM-DD", "time": "HH:MM" or "", "summary": "one short line",
               "phone": { only the app items this event puts on the phone }${money ? `,
               "money": { "amountFrom": "story" | "guess",
                          "moves": [{ "account": a bank account's last 4 digits or "broker:EUR", "amount": minus for money out, "currency", "who", "ko", "memo": what it was for, "kind": "card" | "transfer" | "deposit" | "cash" (taken out as cash), "fee": a transfer fee charged on top of "amount", on the sending move, "rate": for an amount in another currency than its account's, that day's rate (the account's currency for one), "occurrence": "new" | "again", "already": "" }],
                          "trades": [{ "kind": "buy" | "sell" | "dividend", "symbol", "name", "ko" and "currency" (a share not in INVESTMENTS NOW), "quantity", "price", "fee", "amount": dividend only, "occurrence": "new" | "again", "already": "" }],
                          "orders": [{ "shop", "item", "ko", "option", "qty", "price": unit price, "status": "ordered" (the default) | "shipped" | "on the way" | "delivered" | "cancelled" | "returning" | "returned" | "refunded", "eta": "MM-DD" or "", "gift", "paid": false only when someone else pays or it is paid on delivery, "occurrence": "new" | "again", "already": "" }],
                          "passes": [{ "kind": "flight" | "train" | "hotel" | "event" | "other", "by": airline, line, hotel or venue, "from", "to", "date": "MM-DD", "time", "seat", "gate", "no", "status", "made": [the fields made up to fit, like "no", "seat", "date"], "occurrence": "new" | "again", "already": "" }]${delivery ? `,
                          "deliveries": [{ "shop", "items": [{ "name", "ko", "option", "optionKo", "qty", "price": unit price, "pic": { "base": the dish in 1 to 3 English words, "with": [up to 3 main ingredients, like "beef"], "size": "regular" | "large", "set": [a set's sides or drinks] } }], "fee", "tip", "discount", "mode": "delivery" | "pickup", "time": "MM-DD HH:MM", "arrived": "MM-DD HH:MM" or "", "to": "home" | "work" | a person's name, "address", "left": where the courier left it, or "", "noteShop", "noteShopKo", "noteRider", "noteRiderKo", "noCutlery", "for": how many people, "status": "on the way" | "delivered" | "cancelled" | "refunded", "gift", "occurrence": "new" | "again", "already": "",
                                          "newShop": { "name": the same as "shop", "ko", "cuisine", "menu": [{ "name", "ko", "desc", "price", "top": true for its best-known dish, "pic" }] } or null }]` : ''} }` : ''} }],
${life ? `,
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
${PHONE_ITEMS.replace(VOICE_ONLY, '')}${life ? `,
${LIFE_ALARMS}
${LIFE_FILES}
  "health": [{ "date": the day they woke, "sleep", "wake", "woke": times awake in the night, "steps", "km", "floors", "hr": [low, high], "workouts": [{ "kind", "time", "min", "km" }], "coffee": cups, "coffeeKind", "water": litres, "weight": kg only when they weighed, "screen": { "apps": { app name: minutes }, "pickups", "late": "HH:MM" } }],
${LIFE_TIMERS}
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
// messages anyway); the money step reads every round on its own
export const coreSystem = ({ life = false, weather = false, tracker = false, invest = false, zone = false, archiveOnly = false, wallet = false } = {}) => updateSystem({ money: false, delivery: false, life, weather, tracker, split: true, invest, zone, archiveOnly, wallet });
// 돈 단계 (3.176~): every round's messages, read for what the owner's phone would now show. One list of records.
// delivery: the phone has the delivery app; invest: it has the brokerage
export function moneySystem({ delivery = false, invest = false } = {}) {
    return `STAGE: money
GOAL
Keep the owner's phone in step with the story. Role-play is told as narrative: it rarely names a figure, a shop, an app or a date. Read what happened and what it means for the owner's money, and write what their phone would now show: payments, orders, tickets${delivery ? `, deliveries` : ''}, assets, debts, regular income and bills${invest ? `, investments` : ''}, with the details made up to fit the owner, the place and the moment. The app links records, merges them, keeps the balances and stops anything being paid twice.

YOU GET
- MESSAGES: every message of this round, numbered. Messages marked (changed) were edited.
- EVENTS: what the phone already put down for these messages, by message number.
- ARCHIVE FOR THESE MESSAGES (sometimes): the story around them.
- MONEY NOW${invest ? `, INVESTMENTS NOW` : ''}${delivery ? `, DELIVERY SHOPS` : ''} and sometimes WEALTH: the owner's finances and records, with ids, and this month's income and spending so far.
- DAYS PASSED (sometimes): the story days that ended in these messages, including ones the story skipped or spent away from the owner: the latest few one by one, a longer stretch before them as one span.
- MISSING ON THE PHONE (sometimes): what the phone should hold and doesn't yet. Write it now.
- OWNER, and sometimes OWNER PROFILE, STORY YEAR and CALENDAR (the days around now, with their weekdays).

READING THE STORY
- Ask what the owner's phone would show after these scenes. Scenes leave a money trail without saying so: dinner out, a ride home, a gift handed over, a trip, a night in a hotel, food at the door, a bad month, a windfall, a family in debt.
- What the story takes for granted gets written, even when it first comes up mid-way: flying now or tomorrow means a ticket, staying at a hotel means a booking, a parcel on its way means an order. Missing from the phone: create the record. Determine when it happened and whether it was mentioned before from the story.
- Talk and mood count: "we're broke", "the debt grew", "my shares are soaring", "they cut me off" change balances, debts, values and regular money. A balance the story implies goes in its account's "balance".
- Fit the owner: their wealth, habits, city and MONEY NOW decide what they buy, where, for how much and how they pay.
- Someone else's own money is theirs, unless it reaches the owner (a gift or money sent to them, support they get, a debt of their household).

KEEPING IN STEP
- What is already on the phone: its id as "already". Keep the facts it holds, fill its gaps, change what the story changes.
- Repeated mentions alone do not create another record. Separate actions or changes concerning the same item remain separate records.
- Details the story leaves out are made up to fit and listed in "made". A value that went up or down with no figure gets a new estimate.
- One story beat is one trail: rising shares change their value; blocked money is not a withdrawal; an order talked about again is not paid again.
- A message marked (changed): its records as the edited text now has them.

TIME PASSING
- What recurs (pay, an allowance, support, rent, bills, subscriptions, a membership, a loan repayment) is one "regular" record, written once when the story or the owner's life shows it; the app pays it on its days. A rent day or a payday is that regular, not a one-off payment. A change to it is the same record with the new "amount" or "status".
- DAYS PASSED: the owner lived each of those days too. Besides what the scenes show and the regular ones, the phone would show what fits their life that day: one or two payments${delivery ? `, orders or deliveries` : ''}${!delivery ? ` or orders` : ''} a day, as the owner's life would have them (coffee, a meal, getting around, groceries). A span of many days the same, about as many as its line says, each dated within it.
- Write any missing "regular" records that the owner's life plainly has (pay or an allowance, rent, a phone bill, subscriptions), using OWNER PROFILE and MONEY NOW; a card account with no "billDay" gets one.

WHICH TYPE
- "account": a bank account or card in MONEY NOW, or one the owner opens. A card's spending is payments on it, not a debt; the app pays its bill each month.
- "regular": money that comes in or goes out again and again.
- "asset": what the owner holds outside the phone's accounts${invest ? ` and the holdings in INVESTMENTS NOW` : ''}: a home, a car, a business, a valuable, money in another bank or a trust, money owed to them, shares, funds or crypto. "amount" is its whole value.
- "debt": money the owner or their household owes outside the cards.${invest ? `
- "quote": one share's price, for a holding in INVESTMENTS NOW.
- "stake": a part of a company the owner owns, by percent.` : ''}
- Something blocked, freed, stopped or restarted is its own record with the new "status".
- One thing may need two types, like a new order and the payment for it.

PAYMENTS
- Bank and card movements go in "payment". What the owner pays for now (an order, a ticket${delivery ? `, a delivery` : ''}, an asset, a debt, a regular paid by hand) has its payment in the same message, its "for" naming that record; money got back from a loan the owner gave too.
- The owner's share only: the stated split, or a plausible one. Paid by someone else, or with cash already in hand: no payment.
- A card purchase goes on the card's account; a refund is plus. No money is made up to cover a payment; a balance may go below zero.
- Family, company and expected money is not the owner's cash: "whose" and "status": "expected" say so.
- A cancelled paid order normally gets a refund. Infer its amount and timing from context and existing records unless the story indicates otherwise.${invest ? `

INVESTMENTS
- Prices move with time. When the story reaches a day after INVESTMENTS NOW's date, every holding gets a "quote" for the newest day: moved plausibly from its last price, in step with the story's world and the owner's luck, "amountFrom": "guess".
- Complete the owner's investment activity from their habits, circumstances and the story, even when individual trades are not described.
- A trade's money stays in the brokerage; it is not also a payment.` : ''}${delivery ? `

DELIVERY
- Food ordered in: a delivery with dishes, fees and a tip as the place would have them; a tip only where tipping is the custom.
- Paid in cash at the door: "payer" on delivery and no payment.
- Dishes put in the basket and not ordered: "cart".
- A shop not in DELIVERY SHOPS: "newShop" with 2 to 4 dishes, the one ordered among them.` : ''}

LANGUAGE
Names fit the owner's country. A name not in Korean gets "ko". People come from the story.

JSON (one object, nothing before or after it)
{ "records": [{
    Include only fields applicable to this record; the fields below are not all required.
    "type": "payment" | "regular" | "order" | "ticket" | "asset" | "debt" | "account" | "card"${invest ? ` | "trade" | "quote" | "watch" | "stake"` : ''}${delivery ? ` | "delivery" | "cart"` : ''},
    "at": the message number it comes from; for a day in DAYS PASSED, the message it ended in, with "date" that day,
    "occurrence": "new" if the action or change happens in this message; "again" if the message describes an earlier action or an existing state,
    "names": [what identifies it, with English and Korean; for "the hotel", the names of the one it means],
    "already": an id from MONEY NOW${invest ? ` or INVESTMENTS NOW` : ''}, or "",
    "refersBack": true if the story mentioned this same one before,
    "amount", "currency", "amountFrom": "story" | "guess",
    "date": "MM-DD", "time": "HH:MM",
    "status",
    "made": [the fields made up],

    payment: "amount": the money moved, minus for money out; "date": when it moved; "account": last 4 digits${invest ? ` or "broker:EUR"` : ''}, "kind": "card" | "transfer" | "deposit" | "cash" (taken out of the account as cash), "who", "ko", "memo", "fee": on top, on money sent, "rate": for a currency other than the account's, "for": a name of the record it pays, or ""
    regular: "amount": each time, minus for money out; "date": its first day; "frequency": "monthly" | "weekly" | "yearly"; "day": the day of the month or the weekday; "account": last 4 digits; "who": who pays it or is paid, "ko"; "for": the debt it pays, or ""; "status": "active" | "stopped"
    order: "amount": one item's price; "date": when ordered; "shop", "option", "qty", "status": "ordered" | "shipped" | "on the way" | "delivered" | "cancelled" | "returning" | "returned" | "refunded", "eta": "MM-DD", "gift": who it is for, "sender": who sent it to the owner, "payer": "owner" | "someone else" | "on delivery"
    ticket: no "amount" (its price is the payment); "date": the day of travel, the event or check-in; "until": "MM-DD", the last day of a stay or membership; "kind": "flight" | "train" | "hotel" | "event" | "membership" | "other", "by": airline, line, hotel, venue or club, "from", "to", "seat", "gate", "no"
    asset: "amount": its whole value now; "date": when the owner got it; "kind": "property" | "vehicle" | "business" | "valuable" | "deposit" | "receivable" (money owed to the owner) | "investment" | "other", "whose": "owner" | "shared" | "family" | "company", "status": "held" | "expected" | "blocked" | "sold" | "lost", "conditions"
    debt: "amount": what is owed now; "date": when it was taken on; "kind": "loan" | "mortgage" | "personal" | "tax" | "other", "lender", "whose", "due": "MM-DD", "status": "open" | "paid" | "overdue" | "forgiven", "conditions"
    account: "amount": the money in it when opened, none for a card account; "date": when opened; "kind": "checking" | "savings" | "credit", "last4" when known, for a card "billDay": the day of the month its bill is paid and "paidFrom": the account it is paid from, "balance": for one already on the phone, when the story implies it, the account's resulting balance at this point in the story, including payments reported up to that point, with "memo": the story context behind this balance, in a few words; "status": "open" | "blocked" | "closed", "reason"
    card: "account": last 4 digits, "exp": "MM/YY"${invest ? `
    trade: "amount": a dividend's total only; "date": when traded; "kind": "buy" | "sell" | "dividend", "symbol", "ko", "quantity", "price": per share, "fee"
    quote: "amount": one share's price; "date": its day; "symbol", "evidence": exact words when from the story
    watch: "symbol", "ko", "note"
    stake: "amount": its value; "company", "listed", "percent", "holder", "voter", "beneficiary", "restriction", "evidence": exact words` : ''}${delivery ? `
    delivery: no "amount" (the app adds it up); "date", "time": when ordered; "shop", "items": [{ "name", "ko", "option", "optionKo", "qty", "price": unit price, "pic": { "base": the dish in 1 to 3 English words, "with": [up to 3 main ingredients], "size": "regular" | "large", "set": [] } }], "fee", "tip", "discount", "mode": "delivery" | "pickup", "arrived": "MM-DD HH:MM" or "", "to": "home" | "work" | a person, "payer": "owner" | "someone else" | "on delivery", "address", "left", "noteShop", "noteShopKo", "noteRider", "noteRiderKo", "noCutlery", "people": how many, "status": "on the way" | "delivered" | "cancelled" | "refunded", "gift", "newShop": { "name", "ko", "cuisine", "menu": [{ "name", "ko", "desc", "price", "top", "pic" }] } or null
    cart: "shop", "items": [like a delivery's]` : ''}
}] }
Use the message's day for a current change unless the story gives another time.
Numbers are plain JSON numbers. Nothing for the owner's money: "records": [].`;
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
    const msg = (x, t) => ({ from: mine(x?.from) ? 'me' : line(x?.from, 40) || 'me', text: str(x?.text, 600), ko: ko(x?.ko), time: when(x?.time), ...(x?.deleted === true ? { deleted: true } : {}), ...(x?.everyday === true || t?.everyday === true ? { src: 'guess' } : {}) });
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
        threads: arr(raw.threads).map(t => { const d = t?.draft && str(t.draft.text, 600); return { with: line(t?.with, 40), messages: arr(t?.messages).map(x => msg(x, t)).filter(x => x.text), ...(d ? { draft: { text: d, ko: ko(t.draft.ko), time: when(t.draft.time), src: 'story' } } : {}) }; }).filter(t => t.with && !mine(t.with) && t.messages.length).slice(0, CAP.threads),
        calls: inARow(arr(raw.calls).map(x => tag({ with: line(x?.with, 40), type: pick(x?.type, ['in', 'out', 'missed'], 'in'), time: when(x?.time), min: Math.max(0, Math.min(600, Math.round(num(x?.min) || 0))), ...(callCount(x?.count) > 1 ? { count: callCount(x.count) } : {}) }, x)).filter(x => x.with && !mine(x.with))),
        photos: arr(raw.photos).map(x => tag({ caption: line(x?.caption, 200), ko: ko(x?.ko), time: when(x?.time), mood: pick(x?.mood, MOODS, 'warm') }, x)).filter(x => x.caption),
        notes: arr(raw.notes).map(x => tag({ title: line(x?.title, 80), kt: line(x?.kt, 80), text: str(x?.text, 1500), ko: str(x?.ko, 1500), time: when(x?.time) }, x)).filter(x => x.title || x.text),
        searches: arr(raw.searches).map(x => tag({ q: line(x?.q, 120), ko: ko(x?.ko), time: when(x?.time), ...(truthy(x?.tab) ? { tab: true } : {}), ...(truthy(x?.mark) ? { mark: true } : {}) }, x)).filter(x => x.q),
        events: arr(raw.events).map(x => tag({ title: line(x?.title, 80), ko: ko(x?.ko), date: when(x?.date).slice(0, 5), time: hhmm(x?.time), ...(when(x?.was).slice(0, 5) ? { was: when(x.was).slice(0, 5) } : {}), ...(x?.cancelled === true ? { cancelled: true } : {}) }, x)).filter(x => x.title && (x.date || x.cancelled)),
        profile: raw.profile && typeof raw.profile === 'object' ? { handle: line(raw.profile.handle, 40), bio: line(raw.profile.bio, 200), ko: ko(raw.profile.ko), followers: countOf(raw.profile.followers), following: countOf(raw.profile.following) } : null,
        posts: arr(raw.posts).map(x => tag({ text: str(x?.text, 800), ko: str(x?.ko, 800), photo: line(x?.photo, 200), pko: ko(x?.pko), time: when(x?.time), likes: Math.min(99999, countOf(x?.likes)),
            comments: arr(x?.comments).map(c => ({ from: line(c?.from, 40), text: line(c?.text, 300), ko: ko(c?.ko) })).filter(c => c.from && c.text).slice(0, CAP.comments) }, x)).filter(x => x.text || x.photo),
        mails: arr(raw.mails).map(x => tag({ from: line(x?.from, 60), subject: line(x?.subject, 120), ks: line(x?.ks, 120), text: str(x?.text, 2000), ko: str(x?.ko, 2000), time: when(x?.time), unread: truthy(x?.unread) }, x)).filter(x => x.from && (x.subject || x.text)),
        diary: arr(raw.diary).map(x => tag({ date: when(x?.date).slice(0, 5), title: line(x?.title, 80), kt: line(x?.kt, 80), text: str(x?.text, 2000), ko: str(x?.ko, 2000) }, x)).filter(x => x.date && x.text),
        visits: arr(raw.visits).map(x => tag({ place: line(x?.place, 60), city: line(x?.city, 60), ...(line(x?.already, 40) ? { already: line(x.already, 40) } : {}), ...(x?.home === true ? { home: true } : {}), with: [...new Set(arr(x?.with).map(n => line(n, 40)).filter(n => n && !mine(n)))].slice(0, 6), time: when(x?.time), src: 'story' }, x)).filter(x => x.place).slice(-CAP.visits),
        voice: arr(raw.voice).map(x => tag({ title: line(x?.title, 80), kt: line(x?.kt, 80), text: str(x?.text, 2000), ko: str(x?.ko, 2000), time: when(x?.time), sec: secOf(x?.sec), place: line(x?.place, 60), src: 'story' }, x)).filter(x => x.text),
    });
}

// what makes two items the same, list by list: an update that repeats what the phone holds adds nothing
// calls one after another (34 missed from the same person, nothing between): one row with its count, at the last one
const callCount = v => { const n = Math.round(num(v) || 0); return n > 0 ? Math.min(999, n) : 1; };
function inARow(calls) {
    const out = [];
    for (const x of [...calls].sort((a, b) => String(a.time).localeCompare(String(b.time)))) {
        const o = out.at(-1), gap = o && nearMin(o.time) !== null && nearMin(x.time) !== null ? nearMin(x.time) - nearMin(o.time) : null;
        if (o && x.type === 'missed' && o.type === 'missed' && nameKey(o.with) === nameKey(x.with) && isGuess(o) === isGuess(x) && gap !== null && gap >= 0 && gap <= 180) {
            o.count = (o.count || 1) + (x.count || 1); o.time = x.time;
        } else out.push(x);
    }
    return out;
}
const SIG = {
    msg: x => [nameKey(x.from), x.text, x.time], calls: x => [nameKey(x.with), x.type, x.time], photos: x => [x.caption, x.time],
    notes: x => [x.title, x.text], searches: x => [x.q, x.time], events: x => [x.title, x.date, x.time], posts: x => [x.text, x.photo, x.time],
    mails: x => [x.from, x.subject, x.time], diary: x => [x.date, x.title, x.text], voice: x => [x.title, x.time],
    visits: x => [nameKey(x.place), x.time],
};
const sigOf = (k, x) => JSON.stringify(SIG[k](x)).toLowerCase();
// the same record told again with its clock a little off ("21:00" then "21:02"): the one there, not a second
// (a short text like "ㅋㅋ" or "ok" may really come twice, so only a longer one is matched this way)
const NEAR = { msg: x => [nameKey(x.from), x.text], calls: x => [nameKey(x.with), x.type], photos: x => [x.caption], mails: x => [x.from, x.subject], searches: x => [x.q], voice: x => [x.title], visits: x => [nameKey(x.place)] };
// how far the clock may be off, in minutes, before it is another record (a call back an hour later is a second call)
const NEAR_MIN = { msg: 15, calls: 10, photos: 30, mails: 120, searches: 15, voice: 30, visits: 60 };
const nearMin = t => { const x = parts(t); return x && x.h !== null ? storyMin(t, '') : null; };
// a city's ids in the town table by any of its names ("부산" · "Busan" · "Pusan"), for the data the table holds (a ticket's
// route, the country a city is in); a city the table doesn't know has none
let townIds = null;
export const cityIds = v => {
    if (!townIds) { townIds = new Map(); for (const [ko, al, , cc] of PLACE) for (const n of [ko, ...al]) { const k = pkey(n); if (k) (townIds.get(k) || townIds.set(k, new Set()).get(k)).add(`${ko}|${cc}`); } }
    return townIds.get(pkey(v)) || new Set();
};
// (a visit the model says is one in PHONE NOW, by its id, is that one; else one written the same, its city too when both give
// one: the model, not the code, tells "부산" and "Busan" the same)
const sameCityText = (a, b) => !pkey(a) || !pkey(b) || pkey(a) === pkey(b);
const twinOf = (k, list, a) => {
    if (k === 'visits' && a.already) { const was = list.find(x => x.id === a.already); if (was) return was; }
    const sig = sigOf(k, a), exact = list.find(x => sigOf(k, x) === sig && (k !== 'visits' || sameCityText(x.city, a.city)));
    if (exact || !NEAR[k] || (k === 'msg' && String(a.text || '').trim().length < 6)) return exact || null;
    const key = JSON.stringify(NEAR[k](a)).toLowerCase(), t = nearMin(a.time);
    return t === null ? null : list.find(x => JSON.stringify(NEAR[k](x)).toLowerCase() === key && (k !== 'visits' || sameCityText(x.city, a.city)) && nearMin(x.time) !== null && Math.abs(nearMin(x.time) - t) <= NEAR_MIN[k]) || null;
};
const fresh = (k, old, add) => { const out = []; for (const x of add) if (!twinOf(k, old, x) && !twinOf(k, out, x)) { delete x.already; out.push(x); } return out; };
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

// the thread or contact a name the model wrote is: the very name, else the one the place reading knows by another of
// that person's names ("소망" for "Somang Park", its aka), else the one name it is short for ("Somang" of "Somang Park");
// only one: two that fit is no one (a new one is made as before)
function personIn(p, list, get, name) {
    const k = nameKey(name), same = x => nameKey(get(x)) === k;
    if (!k) return undefined;
    const hit = list.find(same);
    if (hit) return hit;
    const row = (p?.where?.people || []).find(r => [r.name, ...arr(r.aka)].some(n => nameKey(n) === k)), names = row ? [row.name, ...arr(row.aka)].map(nameKey) : [];
    const one = xs => (xs.length === 1 ? xs[0] : undefined);
    return one(list.filter(x => names.includes(nameKey(get(x))))) || one(list.filter(x => samePerson(get(x), name)));
}
const EVERYDAY_KEYS = ['contacts', 'threads', 'calls', 'photos', 'notes', 'searches', 'mails', 'posts', 'diary', 'voice', 'events', 'alarms', 'files', 'timers'];
// (the clock and files in an answer: an alarm and a timer, two files)
const EVERYDAY_LIFE = { alarms: 1, timers: 1, files: 2 };
function everydayOn(raw, rows, textAt) {
    const ed = raw?.everyday && typeof raw.everyday === 'object' && !Array.isArray(raw.everyday) ? raw.everyday : null;
    if (!ed || !EVERYDAY_KEYS.some(k => arr(ed[k]).length)) return;
    // (a time after the round's now is the model running ahead: it is the now)
    const now = when(raw.now), cap = y => (y && typeof y === 'object' && hm(now) && hm(when(y.time)) && laterThan(when(y.time), now) ? { ...y, time: now } : y);
    const mark = x => (x && typeof x === 'object' ? { ...cap(x), everyday: true, ...(Array.isArray(x.messages) ? { messages: x.messages.map(y => (y && typeof y === 'object' ? { ...cap(y), everyday: true } : y)) } : {}) } : x);
    raw.events = arr(raw.events);
    const num = e => Number(String(e?.at ?? '').replace(/^\s*#/, ''));
    let host = raw.events.filter(e => e && typeof e === 'object' && Number.isInteger(num(e))).sort((a, b) => num(b) - num(a))[0];
    if (!host) {
        const last = rows.at(-1);
        if (!last) return;
        const words = String(textAt.get(last.index) || '').replace(/^\[#\d+[^\]]*\]\s*/, '').trim().slice(0, 40);
        if (!words) return;
        host = { id: `everyday-${last.index}`, at: last.index, quote: words, summary: '(everyday)', date: '', time: '', phone: {} };
        raw.events.push(host);
    }
    host.phone = host.phone && typeof host.phone === 'object' ? host.phone : {};
    // (a contact only for someone these records text or call)
    const talked = new Set([...arr(ed.threads).map(x => nameKey(x?.with)), ...arr(ed.calls).map(x => nameKey(x?.with))].filter(Boolean));
    ed.contacts = arr(ed.contacts).filter(x => talked.has(nameKey(x?.name)));
    for (const k of EVERYDAY_KEYS) if (arr(ed[k]).length) host.phone[k] = [...arr(host.phone[k]), ...arr(ed[k]).slice(0, EVERYDAY_LIFE[k] ?? Infinity).map(mark)];
}
// ---- 일상 (반영의 다음 요청): the owner's ordinary life in the hours these messages cover, and the texts after a scene,
// on its own (in the reflection's own request it was a line among many: run51–53 wrote none after a scene and kept making
// up details). It gets all the reflection got, what the reflection put on the phone from these messages, and the people
// the owner had a scene with
// the apps' items as the reflection writes them, without the profile (no SNS name changed); the contacts in, so someone
// texted who isn't saved yet is
// (no visit: a place is gone to in the story, never made up for an ordinary day)
const EVERYDAY_ITEMS = PHONE_ITEMS.split('\n').filter(l => !/^\s*"(?:profile|visits)"/.test(l)).join('\n').replace(VOICE_ONLY, '');
export const everydaySystem = ({ life = false } = {}) => `GOAL
Write the ordinary life on one character's phone in the hours a few new role-play messages cover: the small records a real phone gathers, and the texts people send after a scene with the owner.
Another step already put the story's own events on the phone; you only add everyday life around them.

YOU GET
- NEW MESSAGES: the messages these hours come from, each with its number (#123).
- ARCHIVE FOR THESE MESSAGES, ARCHIVE BEFORE, STORY NOW (sometimes): the story around them. Background.
- EVENTS ON THE PHONE, PHONE NOW, LIFE NOW (sometimes: the alarms, files and health days, with record ids), WEATHER NOW (sometimes), DAYS (sometimes): what the phone holds.
${CLOCK_GET}
- PEOPLE AROUND (sometimes): people in the owner's life, close or not, from the cards, persona, profile and lorebook, with where things stand now.
- PUT ON THE PHONE NOW: what the other step wrote from these messages. Never again.
- OWNER, and sometimes STORY YEAR, WORLD, LOREBOOK, OWNER PROFILE and OWNER DOESN'T KNOW. Nothing on the phone may show what the owner doesn't know.

EVERYDAY
- The owner's ordinary life in these hours, from their habits: each answer fills most lists as these hours call for, for example a photo of lunch, a search, a note, a mail, a post, texts and calls by the person, a voice memo, and a diary entry when these hours end the day. A list with nothing in these hours stays empty.
- For each person the owner had a scene with in NEW MESSAGES: at least one text between the two later these hours, in their own voices (a fight may go on; a job given in person gets a short check).
- People from the story or PEOPLE AROUND as they are and with what they feel; never someone the owner isn't in touch with now. PEOPLE AROUND are part of the owner's life whether or not they are in touch: they turn up wherever they would on a real phone. Someone texted or called who isn't in the contacts yet goes in "contacts" too. A relationship word (girlfriend, ex, husband, boss) only if the messages, archive or PEOPLE AROUND use it for them.
- A diary entry holds what these messages show and what the owner feels about it, as the story and PEOPLE AROUND show them; no new secrets or events.
- Anything a later message could contradict is a new fact: what someone decided, said or wants, a time, a result; a task and its deadline ("check the moodboards by 18:00"), a thing done ("uploaded it"), a plan for later ("ramyeon tonight?"). What these messages already say is no new fact: a text may say it again ("the deck is for Friday"). How they feel and small things around them are fine. No new facts, events, plans or secrets.
- Times stay within the owner-local window in PUT ON THE PHONE NOW; do not read its end again from other screens.
- Never a booking, a trip or a purchase the story doesn't have (a ticket mail, an order confirmation).${life ? `
- Their clock and files too: an alarm they set for tomorrow, a timer for the pasta, a file they download, save or screenshot. Pictures the camera takes go to photos, not files.
${LIFE_ONCE}
${LIFE_CHANGE}` : ''}

${PHONE_STYLE}

JSON (one object, nothing before or after it)
{ "everyday": { the items below, each app a list (an empty one when nothing) } }
Items, as the phone's own apps take them:
{
${EVERYDAY_ITEMS}${life ? `,
${LIFE_ALARMS}
${LIFE_FILES}
${LIFE_TIMERS}` : ''}
}`;
export const AI_SYS_EVERYDAY = everydaySystem();
// what the reflection put on the phone from these messages, one line an event
const putLine = e => { const ph = e?.phone && typeof e.phone === 'object' ? e.phone : {}; const bits = Object.entries(ph).filter(([, v]) => Array.isArray(v) && v.length).map(([k, v]) => (k === 'threads' ? `texts with ${v.map(t => t?.with).filter(Boolean).join(', ')}` : `${k} ${v.length}`)); return `- #${e?.at ?? '?'} ${line(e?.summary, 120)}${bits.length ? ` (${bits.join('; ')})` : ''}`; };
// the reflection's own blocks, but the messages read before and changed since (they only match its events' ids)
export const everydayParts = parts => arr(parts).filter(b => !String(b).startsWith('[MESSAGES READ BEFORE, NOW CHANGED]'));
async function askEveryday(parts, raw, p, rows, life = false, m = null) {
    const mine = everydayParts(parts).join('\n\n');
    const blocks = [mine, `[PUT ON THE PHONE NOW]\n${arr(raw?.events).map(putLine).join('\n') || '(nothing)'}\nOwner-local window: ${p.now || "unknown"} to ${raw?.now || p.now || "unknown"}.`].filter(Boolean).join('\n\n');
    try { const got = jsonOf(await askDraft(blocks, { force: true, system: everydaySystem({ life }), maxTokens: 6000, effort: 'low' })); return got?.everyday && typeof got.everyday === 'object' ? got.everyday : null; }
    catch (err) { console.warn('[narrative-archive] everyday', err); return null; }
}
// the people closest to the owner (위치 판독's "around"): who they are to the owner and how it stands, in the cards' own words
export const aroundBlock = p => (p?.around?.people?.length ? `[PEOPLE AROUND]\n${p.around.people.map(x => `- ${x.name}${x.aka?.length ? ` (${x.aka.join(', ')})` : ''}: ${x.about}`).join('\n')}` : '');
// 반영's everyday records (재구성, "everyday": true): so many an answer and a day in each app, texts and calls for each
// person (a slow day read in many rounds gets some each round, not a pile). The story's own records have no limit
const EVERYDAY_CAP = { threads: [3, 12], calls: [1, 3], photos: [2, 8], searches: [2, 8], notes: [1, 3], mails: [1, 3], posts: [1, 2], diary: [1, 3], voice: [1, 2], events: [1, 3] };
const dayOfItem = x => when(String(x?.date || x?.time || '')).slice(0, 5);
function everydayOnly(p, add, day, daily) {
    const who = (k, x, th) => (k === 'threads' ? nameKey(th?.with) : k === 'calls' ? nameKey(x.with) : '');
    const had = (k, d, w) => (k === 'threads' ? (p.threads || []).filter(th => nameKey(th.with) === w).flatMap(th => th.messages || []) : (p[k] || []).filter(x => k !== 'calls' || nameKey(x.with) === w))
        .filter(x => isGuess(x) && (dayOfItem(x) || '') === d).length;
    const ok = (k, x, th) => {
        if (!isGuess(x)) return true;
        const [perRound, perDay] = EVERYDAY_CAP[k] || [0, 0], d = dayOfItem(x) || day || '', w = who(k, x, th), dk = `${k}|${w}|${d}`, rk = `round|${k}|${w}`;
        if (!daily.has(dk)) daily.set(dk, had(k, d, w));
        if ((daily.get(rk) || 0) >= perRound || daily.get(dk) >= perDay) return false;
        daily.set(dk, daily.get(dk) + 1); daily.set(rk, (daily.get(rk) || 0) + 1);
        return true;
    };
    for (const k of LISTS) if (Array.isArray(add[k])) add[k] = add[k].filter(x => ok(k, x));
    if (Array.isArray(add.threads)) for (const th of add.threads) th.messages = (th.messages || []).filter(x => ok('threads', x, th));
    if (Array.isArray(add.threads)) add.threads = add.threads.filter(th => th.messages.length || th.draft);
}
// a reflection keeps everything (keepAll); making a phone keeps each list to its size
// (the city they live in, by any of its names, a part of one too: "Frankfurt" for "Frankfurt am Main"; never a place in it,
// "Frankfurt Hauptbahnhof")
// (its first whole words count, "Frankfurt" of "Frankfurt am Main", and a Korean name without 특별시 · 광역시 · 시, "서울" of
// "서울특별시"; never part of a word, "Los Ang", nor another city that starts the same, "Frankfurt (Oder)")
// (their home as the visits have it; the city they are in only while it is in the country they live in: away in Tokyo,
// Tokyo is a visit)
const homeCity = (p, v) => {
    const k = pkey(v), own = ownerZone(p), row = whereOf(p, p.owner);
    if (!k) return false;
    const home = (p.visits || []).filter(x => x?.home).at(-1), lives = homeCountry(p);
    // (at home or away by the country the owner is in: the town table's country for the city they are in, else their clock's
    // country when one list names it; a clock no list names is at home, never "away" by a list too short)
    const zones = COUNTRY_ZONES[lives] ? COUNTRY_ZONES[lives].map(([z]) => z) : COUNTRY_TZ[lives] ? [COUNTRY_TZ[lives]] : [];
    const inCc = [own?.where, row?.city].map(n => new Set([...cityIds(n)].map(k => k.split('|')[1].toUpperCase()))).find(x => x.size === 1);
    const elsewhere = z => Object.entries(COUNTRY_ZONES).some(([c, l]) => c !== lives && l.some(([x]) => x === z)) || Object.entries(COUNTRY_TZ).some(([c, x]) => c !== lives && x === z);
    // (the reading tells the country the city is in, "in": that decides; the tables only for a phone read before it did)
    const atHome = !lives ? true : row?.in ? row.in === lives : inCc ? inCc.has(lives) : !own?.tz || !zones.length || zones.includes(own.tz) || !elsewhere(own.tz);
    return [home?.city, ...(atHome ? [own?.where, ...arr(own?.names), row?.city, ...arr(row?.names)] : [])].filter(Boolean).some(n0 => {
        const n = String(n0), words = n.trim().split(/\s+/), leads = words.map((_, i) => pkey(words.slice(0, i + 1).join(' ')));
        return leads.includes(k) || /^[가-힣]+$/.test(n) && n.startsWith(String(v).trim()) && /^(?:특별시|광역시|특별자치시|시)$/.test(n.slice(String(v).trim().length));
    });
};
const visitOk = (p, x) => {
    if (new Set(p.hiddenPlaces || []).has(nameKey(x.place))) return false;
    // a city alone: no city given, the place is that city, or both are the city they live in by its names
    const cityAlone = !x.city || pkey(x.city) === pkey(x.place) || homeCity(p, x.city);
    return !(cityAlone && homeCity(p, x.place));
};
// (the owner is never one of "with": only by a name of theirs, so "Ren Kim" stays for an owner Ren)
// (the visit itself is kept, its "with" set on it: where it came from and its 빼기 go by the very item)
// (a first name alone, "Mara", is the one person whose first name it is, "Mara Lee": only when it is theirs alone among the
// rows, the contacts and PEOPLE AROUND, and never the owner's, "Ren" for an owner Ren Park with a Ren Kim about, as in
// SCENES WITH)
const withWho = (p, m, n) => {
    const who = personOf(p, m, n);
    if (!who || (p?.where?.people || []).some(r => nameKey(r.name) === who.key)) return who;
    const f = String(n || '').trim();
    if (/\s/.test(f) || isOwnerName(p, m, f)) return who;
    const firstOf = x => String(x || '').trim().split(/\s+/)[0], full = new Map();
    for (const x of [p.owner, ownerRow(p)?.name, ...(p?.where?.people || []).map(r => r?.name), ...(p?.contacts || []).map(c => c?.name), ...(p?.around?.people || []).map(x => x?.name)])
        if (x && /\s/.test(String(x).trim()) && nameKey(firstOf(x)) === nameKey(f)) full.set(nameKey(x), String(x).trim());
    if (full.size !== 1 || [...full.keys()].some(k => isOwnerName(p, m, full.get(k)))) return who;
    const name = [...full.values()][0], r = (p?.where?.people || []).find(x => nameKey(x.name) === nameKey(name));
    return { key: nameKey(r?.name || name), name: r?.name || name };
};
const visitWith = (p, x, m = null) => { const out = []; for (const n of arr(x.with)) { const who = withWho(p, m, n); if (who && !isOwnerName(p, m, n) && !isOwnerName(p, m, who.name) && !out.some(o => withWho(p, m, o)?.key === who.key)) out.push(who.name); } x.with = out; return x; };
function mergePhone(p, add, { keepAll = false, m = null } = {}) {
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
        const old = personIn(p, p.threads, x => x.with, t.with);
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
    // (a place the user swiped off the map never comes back; the city they live in alone is no visit; their home is one
    // row for as long as it is their home: a new one only when they live somewhere else)
    if (add.visits?.length) {
        const homes = (p.visits || []).filter(x => x.home).map(x => nameKey(x.place));
        add.visits = add.visits.filter(x => visitOk(p, x) && !(x.home && (homes.includes(nameKey(x.place)) || !homes.push(nameKey(x.place))))).map(x => visitWith(p, x, m));
    }
    for (const k of LISTS) p[k] = keep([...(p[k] || []), ...fresh(k, p[k] || [], add[k] || [])], CAP[k]);
    if (add.profile?.handle || add.profile?.bio) p.profile = { ...(p.profile || {}), ...Object.fromEntries(Object.entries(add.profile).filter(([, v]) => v)) };
    for (const c of add.contacts) {
        const old = personIn(p, p.contacts, x => x.name, c.name);
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
// Model-only context: keep source rows and sync fingerprints on the ordinary cleaned text.
// Read raw HTML only for a message this request already selected, never archive summaries by index.
const phoneMessageText = (text, index = atOf(text)) => {
    const message = Number.isInteger(index) ? ctx().chat?.[index] : null;
    const context = message && !message.is_system ? htmlTimeContext(message.mes) : '';
    return context ? `${text}\n${context}` : text;
};
const recentPhoneRows = (n, { upto = null, ...options } = {}) => chatUpto(recentForCheck(upto == null ? n : 1e9, options), upto).slice(-n);
export function recentPhoneText(n, { maxChars = Infinity, ...options } = {}) {
    const rows = recentPhoneRows(n, options), out = [];
    let room = Math.max(0, maxChars);
    for (let i = rows.length - 1; i >= 0; i--) {
        if (out.length) room -= 2;
        if (room <= 0) break;
        const full = phoneMessageText(rows[i]);
        if (full.length > room) {
            // Keep the original tail behavior, but never a detached labels-only fragment.
            // A partially retained source cannot prove which of its HTML fields remain visible.
            out.unshift(rows[i].slice(-room));
            break;
        }
        out.unshift(full); room -= full.length;
    }
    return out.join('\n\n');
}
function chatStory(budget, upto = null) {
    const rows = recentPhoneRows(1e9, { upto }), out = [];
    for (let i = rows.length - 1, size = 0; i >= 0; i--) { const text = phoneMessageText(rows[i]), t = estTok(text); if (out.length && size + t > budget) break; out.unshift(text); size += t; }
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
    for (const r of rows) { const text = phoneMessageText(r.text, r.index), t = estTok(text); if (out.length && size + t > budget) break; out.push({ ...r, modelText: text }); size += t; }
    return { text: out.map(r => r.modelText).join('\n\n'), from: out[0]?.index ?? null, to: out.at(-1)?.index ?? end, n: out.length, all: out.length === rows.length, left: rows.length - out.length,
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
    // (the newest status line that writes a year: it is the story's now; else, for a phone being made, the year the reading
    // of where everyone is read from the story; else none: never guessed from the dates a text writes, a birthday, a memory
    // or a plan; the user sets it before the phone is made, or in 날짜 및 시간)
    const st = trackerYear(upto);
    if (st) return String(acrossNewYear(st.y, st.day, p?.now || p?.clockAt));
    return p?.readYear ? String(p.readYear) : '';
}
// the newest status line that writes a year: { y, day: "MM-DD" } (the status lines come newest first)
function trackerYear(upto = null) {
    let ts = [];
    try { ts = recentTrackers(5, { visibleOnly: true, ...(upto == null ? {} : { chat: (ctx().chat || []).slice(0, upto + 1) }) }); } catch { /* no status lines */ }
    const dayOf = t => { const d = monthDay(t.date || ''); return d ? `${pad(d.mo)}-${pad(d.d)}` : ''; };
    const i = ts.findIndex(t => Number(yearIn(t.date || '')));
    if (i < 0) return null;
    // (a newer status line with a day but no year, "01-02" after "2026-12-30": the status lines no longer say the year, and the
    // code doesn't work it out from the days; the place reading's year goes, as the model read it from the story)
    if (ts.slice(0, i).some(t => dayOf(t) && dayOf(t) !== dayOf(ts[i]))) return null;
    return { y: Number(yearIn(ts[i].date)), day: dayOf(ts[i]) };
}
// a status line's year on the owner's clock: its New Year's Day is still the old year where the owner is on 12-31, and
// its 12-31 already the new one where they are on 01-01
const acrossNewYear = (y, day, now) => { const d = String(now || '').slice(0, 5); return day === '01-01' && d === '12-31' ? y - 1 : day === '12-31' && d === '01-01' ? y + 1 : y; };
// a phone's year, once: one the story writes in a date, else none (설정 › 날짜 및 시간 changes it); true when it was set now
export function ensureYear(m, p, upto = null) {
    if (!p || p.year || p.noYear) return false;
    // (moved by the user in 날짜 및 시간 before it was worked out again: by as many years, a status line's New Year still counted)
    const y = Number(storyYear(m, p, upto));
    if (y) p.year = y + (Number(p.yearShift) || 0); else p.noYear = true;
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
            if (q !== p && q.year && !q.noYear) { q.year += n; q.yearShift = (Number(q.yearShift) || 0) + n; }
            // the copies 되돌리기 and 빼기 compare against move too (else a moved record reads as changed by hand and stays),
            // and 되돌리기 puts back the year it had moved to
            if (q.syncUndo) { q.syncUndo = shiftAll(q.syncUndo, n); if (q.syncUndo.year) q.syncUndo.year += n; }
            if (q.syncUndos) q.syncUndos = q.syncUndos.map(u => { const v = shiftAll(u, n); if (v.year) v.year += n; return v; });
            for (const e of Object.values(q.sync?.events || {})) if (e?.effects) e.effects = shiftAll(e.effects, n);
        }
        // (a phone being made, its year read before and not set by the user: it moves with the rest, and stays moved when its year
        // is worked out again as it is made)
        for (const q of Object.values(m.phonePre || {})) if (q?.year && !q.noYear && !q.yearSet) { q.year += n; q.yearShift = (Number(q.yearShift) || 0) + n; }
        // this browser's record of unsaved rounds (복구) too
        try {
            const scope = phoneChatScope(ctx()), owners = new Set(Object.values(m.phones || {}).map(q => q?.owner));
            journalWrite(scope, journalRead(scope).map(r => (owners.has(r.owner) ? { ...r, events: shiftAll(r.events || [], n), life: shiftAll(r.life || [], n), ...(r.year ? { year: r.year + n } : {}) } : r)));
        } catch { /* no journal here */ }
    }
    // (this phone's year is the user's now: never worked out again over it)
    p.year = year; p.noYear = false; p.yearSet = true; delete p.yearShift;
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
// pre: a phone being made, as far as it is read before (where everyone is, PEOPLE AROUND): its OWNER'S CLOCK goes by it
// a day the story is on (MM-DD), for a phone with no time yet: the newest status line's date only (a date in the archive
// may be a memory, "they first met on 2025-07-01", a heading a stretch of days or another calendar's: with none, the
// hours go with every change in the year)
function storyDayOf(m, upto = null, st = null) {
    const d0 = monthDay(st?.date || '');
    if (d0) return `${pad(d0.mo)}-${pad(d0.d)}`;
    try { const t = recentTrackers(1, { visibleOnly: true, ...(upto == null ? {} : { chat: (ctx().chat || []).slice(0, upto + 1) }) })[0], d = monthDay(t?.date || ''); if (d) return `${pad(d.mo)}-${pad(d.d)}`; } catch { /* no status lines */ }
    return '';
}
// the year a time is converted in: the story's, else this one; a 02-29 in a leap year, the next one from the story's (never
// the 1st of March, never a day's hours off)
const isLeap = y => new Date(Date.UTC(y, 1, 29)).getUTCMonth() === 1;
const yearOr = (t, y) => {
    const n = Number(y) || 0;
    if (!String(t || '').startsWith('02-29')) return n || undefined;
    let v = n || new Date().getFullYear();
    while (!isLeap(v)) v++;
    return v;
};
const todayWall = () => { const d = new Date(); return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function phoneRequest(m, owner, p = null, lore = '', only = null, profile = '', gap = null, extra = [], pre = null, { anew = false } = {}) {
    // (made again keeping its reading, a phone with no 위치 정보 read before it: its own time still)
    const cur0 = m.phones?.[nameKey(owner)], q0 = p || (pre ? (!anew && cur0?.now ? { ...pre, now: cur0.now } : pre) : cur0) || { owner }, q = anew && q0.now ? { ...q0, now: '' } : q0;
    const world = worldText(m), upto = nowAt(gap);
    const recent = recentPhoneText(6, { upto, maxChars: 6000 });
    const ar = archiveFor(m, p ? p.upto ?? -1 : -1, nowAt(gap), !gap?.cut);
    const now = p ? JSON.stringify(phoneForModel(p)) : '';
    return [
        p ? `[PHONE NOW]\n${now}` : '', ((at, st) => {
            // (a phone being made has no time yet: its newest status line's, as a reflection's; else today's, for the hours alone)
            // (no time, but a day the story is on: its hours that day, its summer-time changes near it; no day either:
            // today's hours, with every change in the year, so the hours the answer's own day has are there too)
            // (the newest status line's time on the owner's clock, as the reading up to a message has it)
            const t = at === undefined ? q.now : at, story = hm(t) ? t : stTime(st), day = story ? '' : storyDayOf(m, upto, st);
            return fillClock(m, q, story || (day ? `${day} 12:00` : todayWall()), st, gap, { text: extra.find(x => String(x).startsWith('[TOLD SHORT')) || '' }, { story: true, quiet: story ? false : day ? 'day' : true });
        })(upto == null ? undefined : storyNow(q, upto, m) || undefined, statusAt(q, upto, m)),
        !p && m.phones?.[nameKey(owner)]?.device ? `[DEVICE — locked]\n${JSON.stringify(m.phones[nameKey(owner)].device)}` : '',
        archiveBlock(m, ar.text || '(nothing new)', `ARCHIVE${p ? ' — the sections since PHONE NOW' : ''}`, CHAT_TOKENS.phone, upto),
        world ? `[WORLD]\n${world}` : '',
        lore ? `[LOREBOOK]\n${lore}` : '',
        aroundBlock(q),
        afterBlock(gap) || (recent && !noArchive(m) ? `[RECENT CHAT]\n${recent}` : ''),
        yearBlock(m, q, upto),
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
    calls: real(p.calls).slice(-5).map(x => ev(x, { with: x.with, type: x.type, time: x.time, min: x.min, ...(x.count > 1 ? { count: x.count } : {}) })),
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
    // (the newest visits with their ids: the same visit told again is one of these, "already")
    visits: real(p.visits || []).slice(-4).map(x => ev(x, { id: x.id, place: x.place, city: x.city, time: x.time })),
});

// 폰 만들기 전 위치 정보: for a phone not made yet, where everyone is (asked of the people the chat already names), the
// story's year and PEOPLE AROUND, read first and kept in the chat until the phone is made: the user checks them in 위치
// 정보 (setOwnerLives, setPlaceCity, dropPlacePerson and rereadPlaces take it as a phone) and the year (setPreYear), and
// a make asked again (a clock check it didn't pass) reads none of it again. again: read anew
// (kept while what the reading read is the same: the owner's 인물 정보, the 참고 로어북 picked and the entries left out)
const loreKey = m => JSON.stringify(phoneLore(m).slice().sort().map(b => [b, [...loreOff(m, b)].sort()]));
// (and while the phone it was read for is the same: one read for an old phone, gone since, is not the new one's)
const sameBinding = (pre, binding, m) => JSON.stringify(pre?.financeProfile ?? null) === JSON.stringify(binding ?? null) && (pre?.lore ?? loreKey(m)) === loreKey(m) && !!pre?.base === !!m?.phones?.[nameKey(pre?.owner)];
export const phonePre = (m, owner) => m?.phonePre?.[nameKey(owner)] || null;
// the time 위치 정보 shows a phone not made yet its hours at: the one its request will go by (the newest status line's
// time, else its day at noon), else '' (today's, as the request's then)
const preClock = (m, pre) => { const upto = nowAt(windowOf(m, null)), st = statusAt(pre, upto, m), t = stTime(st); if (t) return t; const day = storyDayOf(m, upto, st); return day ? `${day} 12:00` : ''; };
// a status line's time on the owner's clock (one it can't place: as written)
const stTime = st => (st?.known && hm(st.at) ? st.at : hm(st?.raw) ? st.raw : '');
// (an old phone made again whole, one with no 위치 정보: its year and where it lives, as the owner left them)
const seedPre = (m, owner, binding) => {
    const cur = m.phones?.[nameKey(owner)], pre = { owner, making: true, lore: loreKey(m), base: !!cur, ...(binding ? { financeProfile: structuredClone(binding) } : {}) };
    if (cur) for (const k of ['year', 'noYear', 'lives', 'livesManual', 'country']) if (cur[k] !== undefined) pre[k] = cur[k];
    return pre;
};
// what the user set on what was read before (a city by hand, someone taken off, the year, the country) goes on what is read
// anew when it can't be kept as it is (the owner's 인물 정보 or 참고 로어북 changed)
const carryEdits = (pre, old) => {
    if (!old) return pre;
    const manual = arr(old.where?.people).filter(r => r?.manual), removed = arr(old.where?.removed);
    if (manual.length || removed.length) pre.where = { at: old.where?.at || Date.now(), people: structuredClone(manual), ...(removed.length ? { removed: [...removed] } : {}) };
    if (old.yearSet) { delete pre.year; delete pre.noYear; if (old.year) pre.year = old.year; if (old.noYear) pre.noYear = true; pre.yearSet = true; }
    if (old.livesManual) { pre.lives = old.lives; pre.livesManual = true; }
    return pre;
};
// what was read before for this owner, while it is still theirs (see sameBinding). Read for an old phone gone since, it
// is the new phone's all the same when the user changed it (a city by hand, someone taken off, the country, the year):
// what they set is kept, never read over
const preEdited = pre => !!(pre?.yearSet || pre?.livesManual || pre?.where?.removed?.length || pre?.where?.people?.some(r => r?.manual));
function keepPre(m, owner, binding) {
    const kept = phonePre(m, owner), base = !!m?.phones?.[nameKey(owner)];
    if (!kept) return null;
    if (sameBinding(kept, binding, m)) return kept;
    if (!!kept.base !== base && preEdited(kept) && sameBinding({ ...kept, base }, binding, m)) {
        // (a year that came from the phone gone since, not the user's: worked out again for this one)
        if (kept.base && !kept.yearSet) { delete kept.year; delete kept.noYear; ensureYear(m, kept, nowAt(windowOf(m, null))); }
        kept.base = base;
        return kept;
    }
    return null;
}
// (새로 시작 while a reading or a making waits: what comes back is the old story's, never put in the new one)
const storyRun = m => Number(m.phoneStoryRun) || 0;
const stillRun = (m, run) => { if (storyRun(m) !== run) throw new Error('새로 시작해서 멈췄어요'); };
export async function preparePhone(m, owner, { again = false } = {}) {
    const key = nameKey(owner), run = storyRun(m);
    await ensureScreenHolder(m);
    const binding = m.phones?.[key]?.financeProfile || m.phoneProfiles?.[key], kept = keepPre(m, owner, binding);
    if (kept && !again) { glossAka(m, kept); kept.clockAt = preClock(m, kept); return kept; }
    // (read again, 다시 연동: what the user set by hand, who they took off and the year they chose stay, as for a phone)
    const pre = kept ? Object.assign(structuredClone(kept), { lore: loreKey(m) }) : carryEdits(seedPre(m, owner, binding), phonePre(m, owner)), asked = { known: true };
    if (pre.where) delete pre.where.failed;
    if (kept && !pre.yearSet && !pre.base) { delete pre.year; delete pre.noYear; }
    // (where everyone is first: its reading tells the year too, on the clock the phone will be at)
    await tryWhere(m, pre, asked);
    stillRun(m, run);
    pre.clockAt = preClock(m, pre);
    ensureYear(m, pre, nowAt(windowOf(m, null)));
    pre.asked = asked.asked || [];
    (m.phonePre ||= {})[key] = pre;
    await saveMeta();
    return pre;
}
// the story's year for a phone not made yet (null or none: no year)
export async function setPreYear(m, owner, year) {
    const pre = phonePre(m, owner);
    if (!pre) return;
    const y = Number(year);
    if (Number.isInteger(y) && y >= 1900 && y <= 2100) { pre.year = y; pre.noYear = false; } else { delete pre.year; pre.noYear = true; }
    pre.yearSet = true;
    await saveMeta();
}
// apps: some of REMAKE's names, made again from the whole story while the rest of the phone stays as it is
export function makePhone(m, owner, opts = {}) { return withDateOrder(dateOrderOf(m), () => makePhone0(m, owner, opts)); }
async function makePhone0(m, owner, { update = false, apps = null } = {}) {
    const run = storyRun(m);
    await ensureScreenHolder(m);
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
    // a phone made for the first time (no reading of where everyone is): that reading first, so its OWNER'S CLOCK has the
    // hours and the time choices and its check knows the places, as a reflection's does (and PEOPLE AROUND goes along):
    // the one the user checked in 위치 정보 (preparePhone), else read now; its year too, from the start
    const firstMade = !part && !old && !cur?.where, kept = firstMade ? keepPre(m, owner, binding) : null, asked = {};
    let pre = null;
    if (cur) glossAka(m, cur);
    if (kept) {
        pre = structuredClone(kept); glossAka(m, pre); asked.asked = kept.asked || [];
        // (a year read before, not set by the user nor taken from an old phone: worked out again now, a status line that
        // has crossed New Year since goes)
        pre.clockAt = preClock(m, pre);
        if (!pre.yearSet && !pre.base) { delete pre.year; delete pre.noYear; ensureYear(m, pre, nowAt(gap)); }
        // (a reading that failed is read again: what the user set by hand, and who they took off, stay)
        if (pre.where?.failed) {
            delete pre.where.failed; asked.known = true; await tryWhere(m, pre, asked); pre.asked = asked.asked || [];
            // (a year guessed while the reading had failed is worked out again; one the user or the old phone set stays)
            pre.clockAt = preClock(m, pre);
            if (!pre.yearSet && !pre.base) { delete pre.year; delete pre.noYear; ensureYear(m, pre, nowAt(gap)); }
            stillRun(m, run); m.phonePre[key] = structuredClone(pre); await saveMeta();
        }
    } else if (firstMade) {
        pre = carryEdits(seedPre(m, owner, binding), phonePre(m, owner)); asked.known = true; await tryWhere(m, pre, asked); pre.clockAt = preClock(m, pre); ensureYear(m, pre, nowAt(gap));
        // (kept as preparePhone keeps it: a make asked again, after a clock check it didn't pass, reads none of it again)
        stillRun(m, run); pre.asked = asked.asked || []; (m.phonePre ||= {})[key] = structuredClone(pre); await saveMeta();
    }
    // (made anew, up to now: an old phone's saved time is no time of the story's now; made again with its reading kept, it
    // reads up to that time and goes by it)
    const anew = !part && !old && !keep;
    const ask = (g, extra = []) => askDraft(phoneRequest(m, owner, old, lore, part, profile, g, extra, pre, { anew }), { force: true, system: old ? AI_SYS_PHONE_UPDATE : part ? AI_SYS_PHONE_APPS : AI_SYS_PHONE, maxTokens: 16000 });
    const out = await ask(gap), got = parsePhone(out, owner);
    // a phone made sets its clock as a reflection does, by the same check, and like a reflection is not saved when it
    // doesn't hold (never asked again on its own)
    if (!part && !old) {
        const q = pre ? (!anew && cur?.now ? { ...pre, now: cur.now } : pre) : cur || { owner };
        // (by what the request showed: an owner the reading placed nowhere is checked by no zone; the answer's country is
        // where they live, and they may be away, so 위치 정보 asks the user where they are)
        withDateOrderSync(dateOrderOf(m), () => validateReflectionClock(jsonOf(out, { salvage: true }) || {}, anew ? { ...q, now: '' } : q, m, got.now));
    }
    // made again up to the clock and stopped short: a second turn adds the rest (one that fails keeps the first)
    const two = keep && !old ? secondTurn(m, cur, gap, false) : null;
    let got2 = null, last = gap, short = null;
    if (two) {
        try {
            const was = jsonOf(out, { salvage: true }), soFar = part && was ? Object.fromEntries(part.filter(k => was[k] !== undefined).map(k => [k, was[k]])) : was;
            const out2 = await ask(two.cover, [`${soFarHead('PHONE', two.short)}\n${JSON.stringify(soFar)}`, two.short?.text || '']), g2 = parsePhone(out2, owner);
            // (made again whole: its clock checked as the first turn's; one that doesn't hold is left out, the first kept)
            // (a second answer with no "now" leaves the clock as the first set it: nothing to check)
            if (!part && g2.now) { const q = pre ? (!anew && cur?.now ? { ...pre, now: cur.now } : pre) : cur || { owner }; withDateOrderSync(dateOrderOf(m), () => validateReflectionClock(jsonOf(out2, { salvage: true }) || {}, q, m, g2.now)); }
            got2 = g2; last = two.cover; short = two.short;
        } catch (err) { console.warn('[narrative-archive] phone, second turn', err); }
    }
    if(JSON.stringify(binding)!==JSON.stringify(m.phones?.[key]?.financeProfile || m.phoneProfiles?.[key])) throw new Error('생성 중 연결한 인물 정보가 변경됐어요. 다시 시도해 주세요');
    stillRun(m, run);
    m.phones = m.phones && typeof m.phones === 'object' ? m.phones : {};
    if (part) {
        const p = m.phones[key];
        const was = Object.fromEntries(part.map(k => [k, p[k]]));
        for (const k of part) p[k] = k === 'profile' ? (got.profile || p.profile) : [];
        const only = g => ({ ...g, ...Object.fromEntries([...LISTS, 'threads', 'contacts'].filter(k => !part.includes(k)).map(k => [k, []])), now: '' });
        mergePhone(p, { ...only(got), profile: null }, { m });
        if (got2) mergePhone(p, { ...only(got2), profile: part.includes('profile') ? got2.profile : null }, { m });
        for (const k of part) if (k !== 'profile') carryOver(k, was[k], p[k]);
        // an archive section that runs past the clock isn't sent (it would tell what comes after), and its messages are
        // hidden: what a reflection put in from them, up to the clock, the remake never saw, so it stays
        const clock = phoneAt(p), [body] = splitTail(String(m.text || ''));
        const unseen = Number.isInteger(clock) ? parseSections(body).filter(s => !s.group && secFirst(s) <= clock && secEnd(s) > clock).map(s => [secFirst(s), clock]) : [];
        const inUnseen = i => Number.isInteger(i) && unseen.some(([a, b]) => i >= a && i <= b);
        if (unseen.length) for (const k of part) if (LISTS.includes(k)) p[k] = [...p[k], ...fresh(k, p[k], (was[k] || []).filter(x => x.froms?.length ? x.froms.every(f => inUnseen(f.at)) : !!x.ev && inUnseen(p.sync?.events?.[x.ev]?.at)))].slice(-CAP[k]);
        // the last round's 되돌리기 would put back the old app's records: no more
        delete p.syncUndo; delete p.syncUndos;
        ensureIds(p);
        p.at = Date.now();
        await saveMeta();
        if (p.inject) applyInjection();
        turnsNote(last, '앱', short);
        return p;
    }
    if (old) mergePhone(old, got, { m });
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
        for (const k of ['life', 'delivery', 'voiceAt', 'year', 'noYear', 'yearSet', 'yearShift', 'hiddenContacts', 'hiddenPlaces', 'lives', 'livesManual', 'where', 'around']) if (was?.[k] !== undefined) base[k] = was[k];
        // (made for the first time: where everyone is and PEOPLE AROUND, as read before it)
        if (pre) for (const k of ['where', 'around', 'lives', 'livesManual', 'year', 'noYear', 'yearSet', 'yearShift']) if (pre[k] !== undefined) base[k] = structuredClone(pre[k]);
        // (the phone is set to the country its owner lives in, as read and checked, over the one the answer gave)
        if (pre?.lives && COUNTRIES[pre.lives]) base.country = pre.lives;
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
        m.phones[key] = mergePhone(base, got, { m });
        if (got2) mergePhone(m.phones[key], got2, { m });
    }
    const p = m.phones[key];
    // (made whole: what was read before it for this owner is done with, whichever way it was made)
    if (m.phonePre?.[key]) { delete m.phonePre[key]; if (!Object.keys(m.phonePre).length) delete m.phonePre; }
    ensureYear(m, p, nowAt(last));
    // (a year from the newest status line, read before the phone had its clock: on the owner's clock across New Year)
    if (!pre?.yearSet && !p.yearSet && p.year && !p.noYear) { const st = trackerYear(nowAt(last)), sh = Number(p.yearShift) || 0; if (st && st.y + sh === p.year) p.year = acrossNewYear(st.y, st.day, p.now) + sh; }
    if(m.phoneProfiles) delete m.phoneProfiles[key];
    ensureIds(p);
    p.upto = lastEnd(m);
    p.at = Date.now();
    await saveMeta();
    if (p.inject) applyInjection();
    if (two) turnsNote(last, '폰', short); else readNote(gap);
    // made for the first time: read again only for someone on it the reading before didn't ask about; made again: as before
    // (a reading that failed before it is not asked again: the clock goes by the phones and the countries, as for a reflection)
    const later = pre?.where?.failed ? [] : pre ? [...p.threads.map(t => t.with), ...p.contacts.map(x => x.name)].filter(n => n && !isOwnerName(p, m, n) && !(asked.asked || []).some(a => strictSame(m, a, n)) && !hasRow(p, m, n)) : null;
    if (!later || later.length) await tryWhere(m, p);
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
    for (const t of add.threads || []) { const own = personIn(p, p.threads, x => x.with, t.with); for (const a of t.messages) tag('msg', own ? twinOf('msg', own.messages, a) : null, a); }
    for (const a of add.posts || []) {
        const own = (p.posts || []).find(o => o.text && o.text === a.text || o.photo && o.photo === a.photo && o.time === a.time);
        for (const c of a.comments || []) tag('comment', own?.comments?.find(x => ckey(x) === ckey(c)), c);
    }
}
const APP_NAME = { threads: '문자', contacts: '연락처', calls: '통화', photos: '사진', notes: '메모', searches: '검색', events: '캘린더', posts: 'SNS', mails: '메일', diary: '일기', voice: '음성 메모', visits: '지도' };
// ---- 2단계 돈 (3.176~, docs/REFLECT-2STAGE-PLAN.md): every round, the round's messages (and ones owed from before) read
// for what the owner's phone would now show. The answer is one list of records, each with the message it comes from;
// the code puts each message's records on its event: core's one event at that message, else a money event of its own
// ("money-#"), so 되돌리기 and 빼기 take them with that message. A message whose money can't go in is owed (its texts and
// photos stay), read again next round; owed twice: skipped, and said so.
// c: { targets: core's events this round [{ id, at, date, time, summary, quote, changed }], rows, raw, sections, evidence,
//      reread, year, known, anchor, profile, check, inRound, nowDay, passed }
// returns { late: [{ id, at, add, effects }] for the events it paid, owed: [{ at, tries }], notes, changes, apps }
const OWED_TRIES = 2;
// one list of records per event, its two steps together (되돌리기 keeps an event's records that can't go back)
const byEvent = xs => { const out = new Map(); for (const x of xs) out.set(x.id, [...(out.get(x.id) || []), ...(x.effects || [])]); return [...out]; };
const MONEY_PATH = /^(money|investment|delivery)\./;
const SPAN_MAX = 60, ON_DAY = ['payment', 'order', 'trade', 'delivery'];
// DAYS PASSED: the story days these messages moved past (from the phone's day before the round to the day before its new
// one), each with the message it ended in (the first whose event is on a later day, else the round's last): the latest
// seven one by one, a longer stretch before them as one span
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function daysPassed(was, now, known, events, last) {
    const a = String(was || '').slice(0, 5), b = String(now || '').slice(0, 5);
    if (!/^\d{2}-\d{2}$/.test(a) || !/^\d{2}-\d{2}$/.test(b) || !Number.isInteger(last) || last < 0) return null;
    const gap = dayGap(a, b);
    if (!(gap > 0)) return null;
    const y = Number(known) || 2000, start = new Date(Date.UTC(y, Number(a.slice(0, 2)) - 1, Number(a.slice(3, 5))));
    const day = k => { const d = new Date(start); d.setUTCDate(d.getUTCDate() + k); return { md: `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, wd: known ? ` ${WEEKDAY[d.getUTCDay()]}` : '' }; };
    const dated = arr(events).filter(e => Number.isInteger(e.at) && /^\d{2}-\d{2}$/.test(e.date || '')).sort((x, z) => x.at - z.at);
    const endedIn = md => dated.find(e => dayGap(md, e.date) > 0)?.at ?? last;
    const lines = [], each = Math.min(gap, 7);
    let span = null;
    // (about one or two a day of it, 60 at most: the code's count, so the model needn't work it out)
    if (gap > each) { const f = day(0), t = day(gap - each - 1), n = gap - each, lo = Math.min(n, SPAN_MAX), hi = Math.min(n * 2, SPAN_MAX); span = [f.md, t.md]; lines.push(`- ${f.md} to ${t.md} (${n} days, ended by #${endedIn(t.md)}: about ${lo === hi ? lo : `${lo}–${hi}`} records)`); }
    for (let k = gap - each; k < gap; k++) { const d = day(k); lines.push(`- ${d.md}${d.wd} (ended in #${endedIn(d.md)})`); }
    return { text: lines.join('\n'), span };
}
async function moneyStage(m, p, owner, c) {
    const s = p.sync, out = { late: [], owed: [], notes: [], changes: [], apps: new Set() };
    const owedBefore = arr(s.owed?.money).filter(o => Number.isInteger(o?.at));
    const text = new Map(c.rows.map(r => [r.index, r.text]));
    // Source HTML is snapshotted with the cleaned rows, not reread after the core request.
    const sourceHtml = c.raw || new Map(c.rows.map(r => [r.index, ctx().chat?.[r.index]?.mes]));
    // (a message the user edited since it was read says so)
    const modelText = i => { const context = htmlTimeContext(sourceHtml.get(i)), t = c.reread?.has(i) ? text.get(i).replace(/^(\[#\d+[^\]]*\])/, '$1 (changed)') : text.get(i); return context ? `${t}\n${context}` : t; };
    // (only messages read already or in this round: the next round's aren't these, nor ones from before the phone)
    const ours = i => i > (s.marks?.base?.index ?? -1) && (readBefore(s, i) || !!c.inRound?.has(i));
    const msgs = new Set([...(c.inRound || [])].filter(i => text.has(i)));
    for (const o of owedBefore) if (text.has(o.at) && ours(o.at)) msgs.add(o.at);
    // the events these messages gave: this round's, and those an owed message gave before
    const targets = [...arr(c.targets)];
    for (const o of owedBefore) for (const [id, e0] of Object.entries(s.events)) if (e0.at === o.at && !targets.some(t => t.id === id)) targets.push({ id, at: e0.at, date: o.date || '', time: o.time || '', summary: e0.summary || id, quote: e0.quote || '', changed: false });
    const evidence = arr(c.evidence);
    const asked = [...new Set([...msgs, ...targets.map(t => t.at).filter(Number.isInteger)])].sort((x, y) => x - y);
    // a record names one of these messages, or one an archive section read now covers
    const allowed = at => msgs.has(at) || targets.some(t => t.at === at) || evidence.some(x => at >= x.first && at <= x.last);
    if (!asked.length && !evidence.length && !c.passed?.text) return out;
    // owed: tried once more next round, then skipped (the note says how many messages)
    const owing = { again: [], skipped: [] };
    const owe = (at, why, alone = false) => {
        if (!Number.isInteger(at) || out.owed.some(o => o.at === at)) return;
        const tries = (owedBefore.find(o => o.at === at)?.tries || 0) + 1;
        if (tries >= OWED_TRIES) { if (alone) out.notes.push(`#${at}: 결제를 두 번 못 넣어서 건너뛰었어요 (${why})`); else owing.skipped.push(at); }
        // (with its event's day and time: read again, its money is on that day)
        else { const t = targets.find(x => x.at === at && x.date); out.owed.push({ at, tries, ...(t ? { date: t.date, time: t.time || '' } : {}) }); if (alone) out.notes.push(`#${at}: 결제는 다음 반영 때 다시 넣어요 (${why})`); else owing.again.push(at); }
    };
    const oweAll = why => {
        for (const at of asked) owe(at, why);
        if (owing.again.length) out.notes.push(`메시지 ${owing.again.length}개의 결제는 다음 반영 때 다시 넣어요 (${why})`);
        if (owing.skipped.length) out.notes.push(`메시지 ${owing.skipped.length}개의 결제를 두 번 못 넣어서 건너뛰었어요 (${why})`);
    };
    const archive = (c.sections || []).filter(x => asked.some(at => at >= x.first && at <= x.last) || evidence.some(y => y.key === x.key)).map(x => x.text);
    if (p.money) migrateBank(m, p);
    // (with neither a bank nor a brokerage, no request at all: nothing to write to)
    const money = moneyNow(p), invest = investNow(m, p), today = String(p.now || '').slice(0, 5);
    if (!money && !invest) { out.notes.push('은행 · 투자 앱이 없어서 결제는 넣지 않았어요'); return out; }
    const dayList = c.known && /^\d{2}-\d{2}$/.test(today) ? Array.from({ length: 14 }, (_, k) => {
        const d = new Date(Date.UTC(Number(c.year), Number(today.slice(0, 2)) - 1, Number(today.slice(3, 5)) + k - 7));
        return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]}`;
    }) : [];
    const input = [
        `[MESSAGES]\n${asked.filter(i => text.has(i)).map(modelText).join('\n\n') || '(none: these are read from the archive sections below)'}`,
        `[EVENTS]\n${targets.map(t => `- ${t.id}: #${t.at} ${t.date || ''}${t.time ? ` ${t.time}` : ''} ${t.summary || ''}${t.quote ? ` ("${t.quote}")` : ''}${t.changed ? ' (changed)' : ''}`).join('\n') || '(none)'}`,
        archive.length ? `[ARCHIVE FOR THESE MESSAGES]\n${archive.join('\n\n')}` : '',
        money ? `[MONEY NOW]\n${JSON.stringify(money)}` : '', invest ? `[INVESTMENTS NOW]\n${JSON.stringify(invest)}` : '',
        money && p.delivery ? `[DELIVERY SHOPS]\n${(p.delivery.shops || []).map(x => x.name).join('\n') || '(none yet)'}${p.delivery.cart?.items?.length ? `\nCART (in the basket, not ordered): ${p.delivery.cart.shop}: ${p.delivery.cart.items.map(x => `${x.qty || 1}× ${x.name}`).join(', ')}` : ''}` : '',
        p.wealthPlan ? `[WEALTH]\n${JSON.stringify({ currency: p.wealthPlan.currency, deposits: p.wealthPlan.deposits, investments: p.wealthPlan.investments, basis: p.wealthPlan.basis })}` : '',
        c.passed?.text ? `[DAYS PASSED]\n${c.passed.text}` : '', money ? (x => (x ? `[MISSING ON THE PHONE]\n${x}` : ''))(moneyMissing(p)) : '',
        c.known ? `[STORY YEAR]\n${c.known}` : '', dayList.length ? `[CALENDAR]\n${dayList.join('\n')}` : '',
        `[OWNER]\n${owner}`, c.profile || '', namesBlock(m),
    ].filter(Boolean).join('\n\n');
    let raw = null, why = '';
    try {
        const ans = await askDraft(input, { force: true, system: moneySystem({ delivery: !!(money && p.delivery), invest: !!invest }), maxTokens: 12000, effort: 'low' });
        why = c.check?.() || '';
        raw = why ? null : jsonOf(ans);
        if (!why && (!raw || !Array.isArray(raw.records) && !Array.isArray(raw.events))) why = '모델 답에서 결제를 찾지 못했어요';
    } catch (err) { why = String(err?.message || err); }
    if (why) { oweAll(why); return out; }
    // ---- each message's records, on its event
    const groups = [];
    // (the day a record is on: its own, else its message's event's, else the event's before it, else the round's now)
    const dayAt = at => { const t = targets.find(x => x.at === at && /^\d{2}-\d{2}$/.test(x.date || '')) || [...targets].filter(x => Number.isInteger(x.at) && x.at < at && /^\d{2}-\d{2}$/.test(x.date || '')).sort((a, b) => b.at - a.at)[0]; return t?.date || c.nowDay || today; };
    // the event a message's money goes on: the one event the message gave (a changed message's: the one that holds its
    // money), else that message's own money event
    const eventAt = at => {
        if (c.reread?.has(at)) {
            const had = c.reread.get(at).map(x => x.id).filter(id => (s.events[id]?.effects || []).some(f => MONEY_PATH.test(String(f.path || '')) || f.type === 'entry'));
            if (had.length === 1) return had[0];
        }
        const own = `money-${at}`;
        if (s.events[own]) return own;
        const here = targets.filter(t => t.at === at);
        return here.length === 1 ? here[0].id : own;
    };
    const idKey = v => String(v ?? '').trim().replace(/^#/, '').toLowerCase();
    if (Array.isArray(raw.records)) {
        const byAt = new Map();
        let bad = 0;
        for (const r of arr(raw.records)) {
            if (!r || typeof r !== 'object') continue;
            const at = Number(String(r.at ?? '').replace(/^\s*#/, ''));
            if (!Number.isInteger(at) || !allowed(at)) { bad++; continue; }
            if (!byAt.has(at)) byAt.set(at, []);
            byAt.get(at).push(r);
        }
        if (bad) out.notes.push(`돈 기록 ${bad}개는 어느 메시지인지 몰라서 넣지 않았어요`);
        // (a long stretch of skipped days: 20 records at most for it, the rest left out and said)
        const span = c.passed?.span;
        if (span) {
            let n = 0, over = 0;
            const inSpan = r => { const d = when(r.date).slice(0, 5); return /^\d{2}-\d{2}$/.test(d) && dayGap(span[0], d) >= 0 && dayGap(d, span[1]) >= 0; };
            for (const [at, rs] of byAt) byAt.set(at, rs.filter(r => !inSpan(r) || ++n <= SPAN_MAX || !++over));
            if (over) out.notes.push(`건너뛴 날의 돈 기록 ${over}개는 너무 많아서 넣지 않았어요`);
        }
        for (const [at, rs] of [...byAt].sort((x, y) => x[0] - y[0])) {
            const id = eventAt(at), t = targets.find(x => x.id === id);
            // (one message's records on different days, a skipped day's spending: each day on its own)
            const byDay = new Map();
            // (by the day it happened: a payment, an order, a trade, a delivery; any other record's "date" is no such day (a
            // regular's first day, when an asset was got), and it goes on its message's day)
            for (const r of rs) { const d = (ON_DAY.includes(String(r.type || '').toLowerCase()) && when(r.date).slice(0, 5)) || dayAt(at); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(r); }
            const named = rs.map(r => line(arr(r.names)[0] || r.who || r.shop || r.by || r.symbol || r.memo || '', 30)).filter(Boolean);
            for (const [d, dayRecs] of byDay) groups.push({ id, at, date: d, time: t?.date === d ? t.time || '' : '', summary: t?.summary || `돈: ${[...new Set(named)].slice(0, 3).join(', ') || `#${at}`}`, quote: t?.quote || '', money: recordsMoney(dayRecs), mine: !t });
        }
    } else {
        // an answer in the lists by event id (the shape before 3.176)
        const byId = new Map();
        const join = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = Array.isArray(v) && Array.isArray(a[k]) ? [...a[k], ...v] : a[k] ?? v; return o; };
        for (const x of raw.events) if (x && typeof x === 'object' && x.money && typeof x.money === 'object') { const id = idKey(x.id); byId.set(id, byId.has(id) ? join(byId.get(id), x.money) : x.money); }
        for (const id of byId.keys()) if (!targets.some(t => idKey(t.id) === id)) out.notes.push(`돈 단계가 모르는 이벤트(${id})를 써서 넣지 않았어요`);
        for (const t of targets) { const mo = byId.get(idKey(t.id)); if (mo) groups.push({ id: t.id, at: t.at, date: t.date || dayAt(t.at), time: t.time || '', summary: t.summary, quote: t.quote, money: mo, mine: false }); }
    }
    const failedAt = new Set();
    for (const g of groups) {
        if (failedAt.has(g.at)) continue;
        // a changed message already put its payments on the phone: only its own events may correct them
        if (c.reread?.has(g.at) && !c.reread.get(g.at).some(x => x.id === g.id)) { out.notes.push(`#${g.at} 바뀐 대화의 결제는 새로 넣지 않았어요`); continue; }
        const stage = structuredClone({ money: p.money, investment: p.investment, finance: m.finance, delivery: p.delivery });
        let paid;
        try { paid = applyMoney(m, p, { id: g.id, at: g.at, date: g.date, time: g.time, summary: g.summary, money: g.money }, { placeCity: cityIds, year: c.year, anchor: c.anchor, marks: s.marks, legs: s.events[g.id]?.legs || [], span: s.failed[g.at]?.span || null, edited: !!c.reread?.has(g.at) }); }
        catch (err) { p.money = stage.money; p.investment = stage.investment; m.finance = stage.finance; if (p.delivery) p.delivery = Object.assign(p.delivery, stage.delivery); failedAt.add(g.at); owe(g.at, String(err?.message || err), true); continue; }
        for (const ch of paid.changes) { out.apps.add(ch.app); if (ch.amount !== null) out.changes.push({ ...ch, what: line(g.summary, 60) }); }
        out.notes.push(...paid.notes);
        // a message's own money event holds only what it gave; one with nothing is none
        if (g.mine && !paid.effects.length && !s.events[g.id]) continue;
        // the event keeps every record it gave, from both steps and every round (빼기 takes them all out together)
        const e0 = s.events[g.id] ||= { at: g.at, quote: g.quote || '', summary: g.summary || g.id, effects: [] };
        if (e0.at !== g.at && Number.isInteger(g.at)) for (const f of paid.effects) f.src = g.at;
        e0.effects = [...(e0.effects || []), ...paid.effects];
        if (paid.legs.length) e0.legs = [...(e0.legs || []), ...paid.legs.filter(l => !(e0.legs || []).some(o => o.key === l.key))];
        out.late.push({ id: g.id, at: g.at, add: {}, effects: paid.effects, summary: g.summary, quote: g.quote || '', legs: paid.legs });
    }
    return out;
}

// Resolve once on a detached phone: validation and failed downstream requests cannot move the live clock or locations.
export function reflectionClockPlan(raw, original, m, { round, roundEnd = null, tracker = null, st = null, sceneOwn = true, askZone = false, archiveOnly = false }) {
    const p = { ...original, where: structuredClone(original.where) };
    m = { ...m, phones: { ...m?.phones, [nameKey(p.owner)]: p } };
    // a now without its time ("2026-12-31", "1/2"): that day at the round's last event time, else the time it was
    let nowAt = (t => (/^\d{2}-\d{2}$/.test(t) ? `${t} ${arr(raw.events).map(e => [when(e?.date).slice(0, 5), hhmm(e?.time)]).filter(([d, h]) => d === t && /^\d{2}:\d{2}$/.test(h || '')).map(([, h]) => h).sort().at(-1) || (t === String(p.now || '').slice(0, 5) ? p.now.slice(6) : '') || '12:00'}`.trim() : t))(when(raw.now));
    // the phone's time only moves on, across New Year too (12-31 → 01-01 is a day later, not months back)
    // (a day or a few behind is the model slipping and is ignored; two months or more behind is a story that skipped far
    // ahead, past the half year the dates alone can tell: half a year later)
    // the scene the phone couldn't place, as the model read it: that city's clock for this round only (not kept for the
    // place: a "cafe" may be in either city next time)
    // who these messages put in another city ("moved", the owner too): their rows from here on, the owner's clock that
    // city's (read first: a status line's scene named by that person, "Mara", is where these messages put her)
    // (an older answer's "ownerCity" and "elsewhere" are read the same)
    const went = [...arr(raw.moved), ...arr(raw.elsewhere)], isOwner = x => ['owner', 'the owner'].includes(nameKey(x?.name)) || isOwnerName(p, m, x?.name);
    const ownerWent = ownerMoved(p, went.find(isOwner) || raw.ownerCity);
    const ownerWentOthers = peopleMoved(p, went.filter(x => !isOwner(x)), round.rows.map(r => r.text).join('\n'), m);
    let named = null;
    if (askZone && (typeof raw.statusCity === 'string' || raw.statusCity && typeof raw.statusCity === 'object')) named = zoneNamed(p, raw.statusCity, m);
    if (ownerWent || ownerWentOthers || named) { st = statusMoment(p, roundEnd, named, m); if (tracker) sceneOwn = sceneHome(p, tracker.place, m, named); }
    if (!archiveOnly) validateReflectionClock(raw, p, m, nowAt);
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
    return { now: p.now, year: p.year, where: p.where, st, sceneOwn, named, setBack };
}

function validateReflectionClock(raw, p, m, now) {
    const r = clockCheck(raw, p, m, now);
    if (r.why) { const e = new Error(`시간 판독 답이 맞지 않아요 (${r.why}). 이번 답은 반영하지 않았어요. 다시 시도해 주세요`); e.code = 'CLOCK_INVALID'; throw e; }
}
// the reflection's check of its "clock" and "now": { why } when they don't hold, { expected } with the now the scene's
// time gives (null when the places aren't known)
function clockCheck(raw, p, m, now) {
    const c = raw?.clock, scene = when(c?.sceneTime);
    const fail = why => { throw Object.assign(new Error(why), { clockWhy: why }); };
    try { return { expected: clockExpected(raw, p, m, now, c, scene, fail) }; } catch (err) { if (err?.clockWhy) return { why: err.clockWhy, expected: err.expected ?? null }; throw err; }
}
function clockExpected(raw, p, m, now, c, scene, fail) {
    if (!c || typeof c !== 'object' || typeof c.finalViewpoint !== 'string' || !c.finalViewpoint.trim() || !hm(scene) || !hm(now)) fail('finalViewpoint·sceneTime·now 확인 필요');
    // Diagnostic evidence only: sceneTime already includes this interval. Never add it again here.
    if (c.elapsedTime !== null && (typeof c.elapsedTime !== 'string' || !c.elapsedTime.trim())) fail('elapsedTime은 명시된 경과 시간 또는 null이어야 해요');
    const statedYear = Number(yearIn(raw.now)) || null, gap = p.now ? dayGap(p.now.slice(0, 5), now.slice(0, 5)) : 0;
    let ownerYear = statedYear || (!p.noYear && Number(p.year)) || null;
    if (!statedYear && ownerYear && p.now) {
        if ((gap > 0 || gap < -60) && now.slice(0, 5) < p.now.slice(0, 5)) ownerYear++;
        else if (gap < 0 && now.slice(0, 5) > p.now.slice(0, 5)) ownerYear--;
    }
    const sceneYear = Number(yearIn(c.sceneTime)) || (ownerYear ? ownerYear + (now.startsWith('01-01') && scene.startsWith('12-31') ? -1 : now.startsWith('12-31') && scene.startsWith('01-01') ? 1 : 0) : null);
    if (!exactClockShift(scene, 'UTC', 'UTC', sceneYear || 2000) || !exactClockShift(now, 'UTC', 'UTC', ownerYear || 2000)) fail('유효하지 않은 날짜');
    // Compare only identities and zones we actually know. Unknown places and ambiguous DST clocks stay with the model.
    const person = screenPerson(m, c.finalViewpoint), name = person?.name || c.finalViewpoint;
    const zones = placesAround(p, m).filter(z => (z.own ? [p.owner, ...arr(z.by)] : [z.who, ...arr(z.by)]).some(n => n && nameKey(n) === nameKey(name)));
    const own = ownerZone(p), tz = [...new Set(zones.map(z => z.tz))];
    let expected = null;
    if (nameKey(name) === nameKey(p.owner)) expected = scene;
    else if (own && tz.length === 1) {
        if (tz[0] === own.tz) expected = scene;
        else {
            expected = exactClockShift(scene, tz[0], own.tz, sceneYear);
        }
    }
    if (expected && expected !== now) { try { fail('sceneTime과 now의 시차 불일치'); } catch (err) { err.expected = expected; throw err; } }
    return expected;
}

async function updatePhone(m, owner) {
    return exclusive('sync', async () => {
        const key = nameKey(owner), p = m.phones[key], scope = phoneChatScope(ctx());
        if (syncState(p) !== 'ok') { const e = new Error('먼저 반영 시작 위치를 골라 주세요'); e.code = 'SYNC_PICK'; throw e; }
        // (용어집's other forms of names on 위치 정보 rows first: before anything reads or keeps them)
        glossAka(m, p);
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
        const rows = syncRows(), round = pickRound(s, rows), archiveOnly = !round.rows.length, clockBefore = phoneAt(p) ?? -1;
        const rawRows = new Map(rows.map(r => [r.index, ctx().chat?.[r.index]?.mes]));
        // Snapshot supplementary HTML hints with this round's visible messages, before any request can change the chat.
        // Archive evidence keeps its own text; its source index is never a reason to reopen hidden raw messages.
        const clockRows = round.rows.map(r => {
            const raw = rawRows.get(r.index);
            return { ...r, clockSource: raw, htmlTimeContext: htmlTimeContext(raw) };
        });
        // where everyone is: read once for a phone that never had it, and again below when the owner's city changes
        // the archive: sections covering this round are evidence; earlier ones are background; ones reaching unread messages stay out
        const [, tail] = splitTail(String(m.text || ''));
        const sections = archSections(m);
        // stretches archived before the phone read them go along as evidence, oldest first, a few at a time
        const archIn = [];
        for (const x of archivedUnread(s, sections, rows, chatRows())) { if (archIn.length && archIn.reduce((n, y) => n + estTok(y.text), 0) + estTok(x.text) > ARCH_TOKENS) break; archIn.push(x); }
        if (!round.rows.length && !archIn.length) {
            if (shifted) { delete p.syncUndo; delete p.syncUndos; }
            // nothing new: the last round's result stays up, with its 되돌리기 while it can still be undone
            p.syncLast = p.syncUndo && canUndo(p) && p.syncLast?.checked ? { ...p.syncLast, notes: [...(p.syncLast.notes || []), ...swiped] } : { checked: 0, remaining: 0, apps: [], failed: [], notes: swiped, at: Date.now() };
            await saveMeta(); return p;
        }
        // read once for a phone that never had it, and once more for one read before the city's own name was kept ("서울")
        if (!p.where || !p.where.failed && (p.where.people || []).some(x => !('local' in x) && !('names' in x))) await tryWhere(m, p);
        // (a phone read before the country followed the reading takes it now)
        syncLives(p);
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
        try { const t = recentTrackers(1, { ...upChat, visibleOnly: true })[0]; tracker = trackerWeather(t); trackAt = Number.isInteger(t?.i) ? t.i : -1; st = statusMoment(p, roundEnd, null, m); } catch { /* no status lines */ }
        // whose scene the newest status line is (true the owner's, false elsewhere, null unknown); one with no time too
        let sceneOwn = tracker ? sceneHome(p, tracker.place, m) : true;
        // a status line among these messages whose scene the phone can't place: the model says whose clock it shows
        // Archive-only rounds use the pre-CLOCK-FIRST request (3.171.16): no viewpoint or time choices.
        // With visible messages, only their latest message can supply choices; archive summaries are background for time.
        const clock = archiveOnly ? archiveClockBlock(p, hm(p.now) ? p.now : st?.raw, m, st)
            : ownerClock(p, hm(p.now) ? p.now : st?.raw, m, st, clockRows);
        // (on a phone that knows no other city, a scene that isn't one of the owner's places is asked too: "Frankfurt"
        // may be another country; it stays the owner's unless the model names another city)
        // (a city on the owner's hours, its summer-time change near, is no other clock for a status line's scene)
        const hasZoneOffsets = !!zonesOf(p, hm(p.now) ? p.now : st?.raw, m)?.others.some(o => o.hours);
        const askZone = round.rows.some(r => r.index === trackAt) && (sceneOwn === null && hasZoneOffsets || sceneOwn === true && !hasZoneOffsets && !!tracker && !sceneZone(p, tracker.place, m));
        // a scene the owner isn't in (or may not be): the model gets its place and weather, never its hour
        // (and one asked about, not yet placed: its place and weather only too)
        const trackShown = tracker && (sceneOwn !== true || askZone) ? { place: tracker.place, weather: tracker.weather } : tracker;
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
        const inputParts = [
            `[NEW MESSAGES]\n${clockRows.map(r => [r.text, r.htmlTimeContext].filter(Boolean).join('\n')).join('\n\n') || '(none: this round reads only stretches archived before the phone read them)'}`,
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
            world ? `[WORLD]\n${world}` : '', lore ? `[LOREBOOK]\n${lore}` : '', aroundBlock(p),
            `[OWNER]\n${owner}`, profile, blindBlock(m, owner), namesBlock(m),
        ].filter(Boolean);
        const input = inputParts.join('\n\n');
        const made = { money: p.money?.at, invest: p.investment?.at, life: p.life, delivery: p.delivery };
        // low thinking: tested against medium on Vertex, the same payments, ids and amounts, without the thinking cost
        const out = await askDraft(input, { force: true, system: split ? coreSystem({ life: !!life, weather: askWeather, tracker: !!tracker, invest: !!invest, zone: askZone, archiveOnly, wallet: !!money }) : updateSystem({ money: false, life: !!life, weather: askWeather, tracker: !!tracker, zone: askZone, archiveOnly }), maxTokens: 16000, effort: 'low' });
        // then the everyday life of these hours, on its own (it fails alone: the round goes in without it)
        // (only on an answer the round can use: a broken one fails the round, and its 일상 would be paid for nothing)
        const core0 = jsonOf(out);
        // the answer is for the chat and messages it was asked about
        if (phoneChatScope(ctx()) !== scope || m.phones?.[key] !== p) throw new Error('반영하는 사이 채팅이나 폰이 바뀌었어요. 다시 해 주세요');
        if (p.money?.at !== made.money || p.investment?.at !== made.invest) throw new Error('반영하는 사이 은행이나 투자가 새로 만들어졌어요. 다시 해 주세요');
        if (p.life !== made.life || p.delivery !== made.delivery) throw new Error('반영하는 사이 생활 앱이나 배달 앱이 새로 만들어졌어요. 다시 해 주세요');
        const nowText = new Map(syncRows().map(r => [r.index, r.text]));
        if (round.rows.some(r => nowText.get(r.index) !== r.text)) throw new Error('반영하는 사이 대화가 바뀌었어요. 다시 해 주세요');
        if (!core0 || !Array.isArray(core0.events)) throw new Error('모델 답에서 반영할 내용을 찾지 못했어요. 다시 해 주세요');
        const clockPlan = reflectionClockPlan(core0, p, m, { round, roundEnd, tracker, st, sceneOwn, askZone, archiveOnly });
        // Archive-only records keep the 3.171.16 date fallback from the model's original now.
        // The separately guarded clockPlan still decides the phone's saved time.
        const raw = archiveOnly ? { ...core0 } : { ...core0, now: clockPlan.now };
        // Temporary diagnostic: unify only the selected person's display alias; keep the model answer intact.
        if (!archiveOnly && typeof toastr !== 'undefined') {
            const diagnostic = `${clock || '(OWNER’S CLOCK 입력 없음)'}\n\n[MODEL RESPONSE]\n${JSON.stringify({ clock: clockForDisplay(core0.clock, m) ?? null, now: core0.now ?? null, ...(clockPlan.now !== when(core0.now) ? { appliedNow: clockPlan.now } : {}) }, null, 2)}`;
            const toast = toastr.info(diagnostic, '시간 판독 · 테스트', {
                escapeHtml: true, timeOut: 0, extendedTimeOut: 0, closeButton: true, tapToDismiss: false,
            });
            toast?.find?.('.toast-message')?.css?.({ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });
        }
        const everyday = round.rows.length ? await askEveryday(inputParts, raw, p, round.rows, !!life, m) : null;
        if (phoneChatScope(ctx()) !== scope || m.phones?.[key] !== p || p.money?.at !== made.money || p.investment?.at !== made.invest || p.life !== made.life || p.delivery !== made.delivery) throw new Error('반영하는 사이 폰이 바뀌었어요. 다시 해 주세요');
        const afterEveryday = new Map(syncRows().map(r => [r.index, r.text]));
        if (round.rows.some(r => afterEveryday.get(r.index) !== r.text)) throw new Error('반영하는 사이 대화가 바뀌었어요. 다시 해 주세요');
        if (everyday) raw.everyday = everyday;
        const inRound = new Set(round.rows.map(r => r.index)), textAt = new Map(round.rows.map(r => [r.index, r.text])), start = s.marks.base.index;
        const rid = Math.random().toString(36).slice(2, 10), rowText = new Map(rows.map(r => [r.index, r.text]));
        const failed = {}, loose = [], added = [], apps = new Set(), changes = [], notes = [...swiped];
        // for 되돌리기: what was there before this round (ids and message counts), and the reading state
        const msgSig = x => JSON.stringify([x.from, x.text, x.time]);
        // (a record added without an id, like the investments' news search, gets one first: else it would count as the round's)
        ensureIds(p);
        const had = new Set(ITEM_KEYS.flatMap(k => (p[k] || []).map(x => x.id)).filter(Boolean)), msgs = new Map(p.threads.map(t => [t.id, new Set(t.messages.map(msgSig))]));
        const undo = { sync: structuredClone({ done: s.done, failed: s.failed, arch: s.arch, events: s.events, seen: s.seen, hiddenRead: s.hiddenRead || {}, owed: s.owed || { money: [] }, dropped: s.dropped || [] }), now: p.now, year: p.year, where: structuredClone(p.where ?? null), moneyAt: p.money?.at, investAt: p.investment?.at,
            comments: (p.posts || []).filter(x => x.id).map(x => [x.id, x.comments?.length || 0]), before: structuredClone(mergedState(p)) };
        // an event's day when the model leaves it out: the day of the event before it, else the answer's now
        let lastDay = when(raw.now).slice(0, 5);
        // the answer's "everyday" records go with this round's last event (되돌리기 and 빼기 take them with it), each marked
        // as one (재구성); a round with no event gets one for its last message
        everydayOn(raw, round.rows, textAt);
        const used = new Set(), wants = new Map(), daily = new Map();
        // (past 40 events in one answer, the rest's messages are read again next round, not lost)
        const over = arr(raw.events).slice(40), firstAt = new Set(arr(raw.events).slice(0, 40).map(e => Number(String(e?.at ?? '').replace(/^\s*#/, ''))));
        for (const e of over) { const at = Number(String(e?.at ?? '').replace(/^\s*#/, '')); if (inRound.has(at) && !firstAt.has(at)) failed[at] ||= '한 번에 일이 너무 많아서 다음에 다시 읽어요'; else if (!inRound.has(at)) loose.push('한 번에 일이 너무 많아서 아카이브 구간의 일 하나를 넣지 못했어요'); }
        for (const e of arr(raw.events).slice(0, 40)) {
            if (!e || typeof e !== 'object') continue;
            // "#151" or "151" for the message number
            // ("#2–#3", "2, 3" or a number one off: the message among these whose words the quote is)
            const nums = (String(e.at ?? '').match(/\d+/g) || []).map(Number);
            let at = Number(String(e.at ?? '').replace(/^\s*#/, ''));
            if (!Number.isInteger(at)) at = nums[0] ?? NaN;
            if (e.quote && !(inRound.has(at) && quoted(e.quote, textAt.get(at) || ''))) { const hit = [...nums, at - 1, at + 1, ...inRound].find(i => inRound.has(i) && quoted(e.quote, textAt.get(i) || '')); if (hit !== undefined) at = hit; }
            const sec = evidence.find(x => at >= x.first && at <= x.last);
            const fail = why => (inRound.has(at) ? (failed[at] ||= why) : loose.push(why));
            if (!Number.isInteger(at) || at <= start || (!inRound.has(at) && !sec)) { fail('읽는 범위 밖의 일이에요'); continue; }
            // a section's message the phone already read (before it was archived) is in already
            if (!inRound.has(at) && readBefore(s, at)) { fail('이미 읽은 대화예요'); continue; }
            if (!quoted(e.quote, textAt.get(at) || '') && !(sec && quoted(e.quote, sec.text))) { fail('원문에서 근거를 찾지 못했어요'); continue; }
            let add;
            const day = when(e.date).slice(0, 5) || lastDay, phone = e.phone && typeof e.phone === 'object' ? structuredClone(e.phone) : {};
            // a time without its day ("15:10") takes the event's day
            const dated = x => { if (x && typeof x === 'object' && /^\s*\d{1,2}:\d{2}\s*$/.test(String(x.time || '')) && day) x.time = `${day} ${hhmm(x.time)}`; };
            // (a visit with no time at all is on the event's day: another day's visit to the same place is another visit)
            for (const x of arr(phone.visits)) if (x && typeof x === 'object' && !String(x.time || '').trim() && day) x.time = day;
            for (const k of [...LISTS, 'threads']) for (const x of arr(phone[k])) { dated(x); for (const msg of arr(x?.messages)) dated(msg); if (x?.draft) dated(x.draft); }
            try { add = parsePhone(JSON.stringify(phone), owner); } catch { fail('앱 내용 형식이 잘못됐어요'); continue; }
            everydayOnly(p, add, day, daily);
            // a bare number is no event id (a model counting its events would take an old event's number again)
            const tagOf = v => { const t = evOf(v); return /^\d+$/.test(t) ? '' : t; };
            // one id for two new events in one answer would take the second for the first (its payment kept out as the same one)
            const id0 = tagOf(e.id) || tagOf(e.summary) || `ev-${at}`, id = used.has(id0) && added.some(x => x.id === id0 && x.at !== at) ? `${id0}-${at}` : id0;
            used.add(id);
            // the money is the money step's, every round: core's events are its EVENTS (a money left in core's answer is read again there)
            if (split) { wants.set(id, { id, at, date: day, time: hhmm(e.time), summary: line(e.summary, 160), quote: line(e.quote, 200), changed: reread.has(at) }); delete e.money; }
            // a changed message already put its payments on the phone: only its own events may correct them
            if (reread.has(at) && e.money && !reread.get(at).some(x => x.id === id)) { notes.push(`#${at} 바뀐 대화의 결제는 새로 넣지 않았어요`); delete e.money; }
            // the money first, on its own: a payment that can't be placed leaves the whole event out
            const stage = structuredClone({ money: p.money, investment: p.investment, finance: m.finance, delivery: p.delivery });
            let paid;
            if (day) lastDay = day;
            try { paid = applyMoney(m, p, { id, at, date: day, time: hhmm(e.time), summary: line(e.summary, 160), money: e.money }, { placeCity: cityIds, year, anchor, marks: s.marks, legs: s.events[id]?.legs || [], span: s.failed[at]?.span || null, edited: reread.has(at) }); }
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
            mergePhone(p, { ...add, device: null, now: '' }, { keepAll: true, m });
            // this message (its number and words) is a source of each item, new or already there
            tagItems(p, add, srcOf(at, bodyMark(rowText.get(at) || ''), rid));
            const got = sizes(p);
            for (const k of ITEM_KEYS) if (got[k] !== was[k]) apps.add(APP_NAME[k]);
            if (add.profile?.handle || add.profile?.bio) apps.add('SNS');
            // an event told again from a later message (its order delivered, its amount stated) stays where it happened, so
            // deleting that message still offers everything it gave; one whose message is gone is taken up by the new one
            const at0 = s.events[id]?.at, home = Number.isInteger(at0) && inRound.has(at0) === false && rowText.has(at0) ? at0 : at;
            // (what this later message gave is marked with it: deleting only this message takes only that back)
            if (home !== at) for (const f of fx) f.src = at;
            s.events[id] = { at: home, quote: line(e.quote, 200), summary: line(e.summary, 160), effects: [...(s.events[id]?.effects || []), ...fx], ...(paid.legs.length || s.events[id]?.legs ? { legs: [...(s.events[id]?.legs || []), ...paid.legs.filter(l => !(s.events[id]?.legs || []).some(o => o.key === l.key))] } : {}) };
            added.push({ id, at, add: told, effects: fx, quote: line(e.quote, 200), summary: line(e.summary, 160), legs: paid.legs });
        }
        // 2단계 돈: every round, this round's messages and the ones earlier rounds still owe
        let late = [];
        if (split) {
            const targets = [...wants.values()];
            const check = () => (phoneChatScope(ctx()) !== scope || m.phones?.[key] !== p ? '반영하는 사이 채팅이나 폰이 바뀌었어요' : p.money?.at !== made.money || p.investment?.at !== made.invest ? '반영하는 사이 은행이나 투자가 새로 만들어졌어요' : '');
            const st = await moneyStage(m, p, owner, { targets, rows, raw: rawRows, sections, evidence, reread, year, known, anchor, profile, check, inRound, nowDay: String(clockPlan.now || p.now || '').slice(0, 5), passed: daysPassed(p.now, clockPlan.now, known, targets, Math.max(-1, ...inRound, ...evidence.map(x => x.last))) });
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
        // Commit the same preview used by everyday, only after the round's requests and guards succeeded.
        p.now = clockPlan.now; p.year = clockPlan.year; p.where = clockPlan.where;
        const { named, setBack } = clockPlan;
        sceneOwn = clockPlan.sceneOwn;
        // the round's own: new days nobody told, the weather, and what the clock moving on does by itself
        const days = [...applyDays(p, raw.days, rid), ...fillDays(p, p.now, rid)], sky = lifeAhead ? [] : applyWeather(p, askWeather && !weatherElsewhere(p, raw.weather, named, m) ? raw.weather : null, sceneOwn === true ? homeTracker(p, tracker, raw.weather, m) : null, { archive: evidence.length + before.length > 0, today: String(p.now || '').slice(0, 5) });
        if (days.length) apps.add('건강');
        if (sky.length) apps.add('날씨');
        // (and the money time pays by itself: regular income and bills on their days, card bills, parcels past their day)
        const roundFx = [...days, ...sky, ...lifeClock(p, p.now), ...dlvClock(p, p.now), ...cardClock(p, p.now), ...orderClock(p, p.now), ...(p.money ? regularClock(m, p, p.now, p.year && !p.noYear ? String(p.year) : year) : [])];
        // after the clock moves: the card's month is counted up to the story's now
        if (p.money) migrateBank(m, p);
        const id = rid;
        s.rounds = [...(s.rounds || []).slice(-19), id];
        p.syncLast = { checked: inRound.size + archIn.length, remaining: unreadCount(s, rows) + archivedUnread(s, sections, rows, chatRows()).length, apps: [...apps], failed: [...Object.entries(failed).map(([at, why]) => ({ at: Number(at), why, skipped: s.failed[at]?.tries >= 2 })), ...loose.map(why => ({ at: null, why }))], changes, notes, at: Date.now() };
        ensureIds(p);
        p.at = Date.now();
        pruneDropped(s, phoneItems(p));
        p.syncLast.notes = p.syncLast.notes.filter(n => !n.endsWith('뺄 수 있어요') || s.dropped.some(d => n.startsWith(`대화 ${d.label}가`)));
        delete p.clockHold;
        // 되돌리기 goes back up to 5 rounds: the one before stays below this one while it is the round just before (and the bank
        // and investments weren't made again since)
        const below = p.syncUndo && s.rounds.at(-2) === p.syncUndo.round && p.money?.at === p.syncUndo.moneyAt && p.investment?.at === p.syncUndo.investAt;
        p.syncUndos = below ? [...(p.syncUndos || []), p.syncUndo].slice(-4) : [];
        if (!p.syncUndos.length) delete p.syncUndos;
        p.syncUndo = { ...undo, round: id, last: structuredClone(p.syncLast), read: [...inRound], readFp: round.rows.map(r => bodyMark(r.text)), comments: undo.comments, whereAfter: JSON.stringify(p.where ?? null),
            items: ITEM_KEYS.flatMap(k => (p[k] || []).filter(x => x.id && !had.has(x.id)).map(x => [k, x.id])),
            msgs: p.threads.filter(t => msgs.has(t.id)).map(t => [t.id, t.messages.map(msgSig).filter(sg => !msgs.get(t.id).has(sg))]).filter(([, xs]) => xs.length),
            effects: [...added.flatMap(x => x.effects || []), ...late.flatMap(x => x.effects || []), ...roundFx], byEvent: byEvent([...added, ...late]), after: structuredClone(mergedState(p)) };
        // kept in this browser until the saved chat shows it: 복구 can add it back if the save didn't land
        journalAdd(scope, { round: id, owner, at: Date.now(), now: p.now, year: p.year, back: !!setBack, where: structuredClone(p.where ?? null), events: [...added, ...late], ...(split ? { owed: s.owed } : {}), done: [...inRound], seen: round.rows.map(r => [r.index, bodyMark(r.text)]), failed: Object.fromEntries([...inRound].filter(i => s.failed[i]).map(i => [i, s.failed[i]])), arch: evidence.map(x => x.key), hidden: hiddenNow, life: roundFx });
        await saveMeta();
        if (p.inject) applyInjection();
        return p;
    }, { operation: 'reflect', owner, scope: phoneChatScope(ctx()) });
}
// 복구: rounds this browser made that the saved chat doesn't have; only what is missing is added, nothing is overwritten
export const pendingRounds = (m, scope) => {
    const j = journalRead(scope);
    // (nor one whose talk a later round read again: 반영 pressed before 복구 has it already; a message only tried and
    // failed then is still the lost round's)
    return j.filter(r => { const q = m.phones?.[nameKey(r.owner)], s = q?.sync; return r.at < performance.timeOrigin && !s?.rounds?.includes(r.round) && !(s?.done && (r.done || []).some(i => isDone(s, i) && !s.failed?.[i])); });
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
            mergePhone(p, { ...e.add, device: null, now: '' }, { keepAll: true, m });
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
        if (r.now && (!p.now || r.back || laterThan(r.now, p.now) || !hm(r.now) && gapDays(String(p.now).slice(0, 5), String(r.now).slice(0, 5)) > 0)) { p.now = r.now; if (r.year) p.year = r.year; }
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
        delete p.clockHold;
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
        // what an event living at another message got from these ones (its order delivered here): offered on its own
        const parts = Object.entries(s.events).filter(([id, e]) => !ids.includes(id) && (e.effects || []).some(f => Number.isInteger(f.src) && f.src >= r.from && f.src <= r.to)).map(([id]) => id);
        for (const id of parts) for (const f of s.events[id].effects) if (Number.isInteger(f.src) && f.src >= r.from && f.src <= r.to) { f.src = null; f.gone = key; }
        // sources from these messages lose their number: a new message given the same number is not them
        let hit = false;
        for (const { x } of items) for (const f of x.froms || []) if (f.at !== null && f.at >= r.from && f.at <= r.to) { f.was = f.at; f.at = null; f.gone = key; hit = true; }
        if (!ids.length && !hit && !parts.length) continue;
        if (r.unsure) { notes.push(`대화 ${label}가 바뀌었어요. 같은 말이 여럿이라 어느 것인지 몰라서, 거기서 넣은 내용은 그대로 뒀어요`); continue; }
        s.dropped.push({ key, label, events: ids, ...(parts.length ? { parts } : {}), at: Date.now() });
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
    const pend = new Set(s.dropped.filter(x => x !== d).flatMap(x => [...x.events, ...(x.parts || [])]));
    let gone = 0;
    // an event living at another message: only what the gone ones gave it goes back (a later message's "delivered")
    for (const id of d.parts || []) {
        const e = s.events[id];
        if (!e) continue;
        const mine = (e.effects || []).filter(f => f.gone === d.key), left = revertEffects(m, p, mine);
        const back = new Set(mine.filter(f => !left.some(l => l === f)).map(f => JSON.stringify(f)));
        e.effects = e.effects.filter(f => !back.has(JSON.stringify(f)));
        if (left.length) kept.push(e.summary || id); else gone++;
    }
    for (const id of d.events) {
        const e = s.events[id];
        if (!e || e.at !== null) continue;
        const made = new Set((e.effects || []).filter(x => x.type === 'push' || x.type === 'entry').map(x => x.item?.id ?? x.id));
        // built on later: another event changed, corrected or counted one of its records as its own
        // (another event of this same stretch goes too: it holds nothing)
        // (nor does one whose message is gone too and that waits in the 빼기 list: taking either off first takes the order)
        const leaving = o => o === id || d.events.includes(o) || s.events[o]?.at === null && pend.has(o);
        let tied = Object.entries(s.events).some(([o, x]) => !leaving(o) && ((x.effects || []).some(y => ['status', 'amend', 'amendEntry', 'change', 'seen'].includes(y.type) && made.has(y.id)) || (x.legs || []).some(l => l.state === 'included' && made.has(l.rec))));
        const trades = new Set((e.effects || []).filter(x => x.path === 'investment.trades').map(x => x.item.id));
        if (!tied && trades.size) { try { positions((p.investment?.trades || []).filter(t => !trades.has(t.id))); } catch { tied = true; } }
        // an account, share or shop it opened that something else still uses (a later payment into the account, a later
        // trade of the share, a later order from the shop) stays, and so the event does
        const pushed = path => (e.effects || []).filter(x => x.type === 'push' && x.path === path).map(x => x.item);
        const others = Object.entries(s.events).filter(([o]) => !leaving(o)).flatMap(([, x]) => x.effects || []);
        if (!tied && pushed('money.bank.accounts').some(a => others.some(y => y.item?.account === a.last4 || String(y.key || '').startsWith(`${a.id}:`)) || (p.money?.tx || []).some(t => t.account === a.last4 && !leaving(t.ev)))) tied = true;
        if (!tied && pushed('investment.securities').some(x => (p.investment?.trades || []).some(t => t.symbol === x.symbol && !trades.has(t.id)))) tied = true;
        if (!tied && pushed('delivery.shops').some(x => (p.delivery?.orders || []).some(o => o.shop === x.name && !leaving(o.ev)))) tied = true;
        if (tied) { kept.push(e.summary || id); stay.add(id); continue; }
        // what couldn't go (changed since: an order delivered and reviewed, with its payment) stays, and so does its event
        const left = revertEffects(m, p, e.effects || []);
        if (left.length) { e.effects = left; kept.push(e.summary || id); stay.add(id); continue; }
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
    // what stayed because another stretch still waiting holds it is offered again with that one gone (else it stays for good)
    if (stay.size && pend.size) d.events = d.events.filter(id => stay.has(id)); else s.dropped.splice(s.dropped.indexOf(d), 1);
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
    // (a message still owed its money: by its new number; one gone owes nothing)
    if (p.sync.owed?.money) p.sync.owed.money = p.sync.owed.money.map(o => (Number.isInteger(o?.at) ? { ...o, at: to(o.at) } : o)).filter(o => o && o.at !== null);
    for (const r of [...(p.money?.tx || []), ...(p.money?.orders || []), ...(p.money?.passes || []), ...(p.money?.assets || []), ...(p.money?.debts || []), ...(p.money?.regulars || []), ...(p.investment?.trades || []), ...(p.delivery?.orders || [])]) if (r.sourceIndex !== undefined) r.sourceIndex = to(r.sourceIndex);
    // the events' own copies of their records too (a changed message's events are found by them)
    for (const e of Object.values(p.sync.events)) for (const f of e.effects || []) { if (f.item?.sourceIndex !== undefined) f.item.sourceIndex = to(f.item.sourceIndex); if (f.sourceIndex !== undefined) f.sourceIndex = to(f.sourceIndex); if (Number.isInteger(f.src)) f.src = to(f.src); }
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
const FX_APP = [[/^life\.weather/, '날씨'], [/^life\.health/, '건강'], [/^life\.clock/, '시계'], [/^life\.files/, '파일'], [/^delivery/, '배달'], [/^money\.(orders)/, '쇼핑'], [/^money\.passes/, '지갑'], [/^money/, '은행'], [/^investment/, '투자']];
const fxApp = path => FX_APP.find(([re]) => re.test(String(path || '')))?.[1] || '';
export async function undoRound(m, p) {
    const target = phoneTarget(m, p);
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
    const now = structuredClone(s.events), kept = [], droppedNow = structuredClone(s.dropped || []);
    const left = new Set(revertEffects(m, p, u.effects).map(x => JSON.stringify(x)));
    Object.assign(s, structuredClone(u.sync));
    // what 빼기 took off since the round stays off: the list as it is now, and an event's records only those still there
    s.dropped = droppedNow;
    for (const [id, e] of Object.entries(s.events)) if (now[id]) { const still = new Set((now[id].effects || []).map(x => JSON.stringify(x))); e.effects = (e.effects || []).filter(x => still.has(JSON.stringify(x))); }
    // an event 빼기 took off since stays off (the snapshot still had it)
    for (const id of Object.keys(s.events)) if (!(id in now)) delete s.events[id];
    for (const [id, effects] of u.byEvent || []) {
        const rest = effects.filter(x => left.has(JSON.stringify(x)));
        if (rest.length && now[id]) { s.events[id] = { ...now[id], effects: [...(s.events[id]?.effects || []), ...rest] }; kept.push(now[id].summary || id); }
    }
    // the round's own changes (the weather, new days, the clock's): what stayed is said too
    const evFx = new Set((u.byEvent || []).flatMap(([, fx]) => fx.map(x => JSON.stringify(x))));
    for (const x of u.effects) { const j = JSON.stringify(x); if (left.has(j) && !evFx.has(j)) { const app = fxApp(x.path); if (app && !kept.includes(app)) kept.push(app); } }
    s.rounds.pop();
    pruneDropped(s, phoneItems(p));
    p.now = u.now;
    p.clockHold = true;
    if (u.year !== undefined) p.year = u.year;
    // the place reading as it was before the round, unless it changed since (AI로 연동, a city set by hand): what the user
    // did after the round stays. (An older undo without the reading after it: kept unless it is still the one from before)
    const whereLater = u.whereAfter !== undefined ? JSON.stringify(p.where ?? null) !== u.whereAfter : !!p.where && p.where.at !== u.where?.at;
    if (u.where !== undefined && !whereLater) { if (u.where) p.where = u.where; else delete p.where; }
    // the round before comes up to be undone next, with its result
    const prev = (p.syncUndos || []).pop();
    if (!p.syncUndos?.length) delete p.syncUndos;
    if (prev) { p.syncUndo = prev; if (prev.last) p.syncLast = structuredClone(prev.last); else delete p.syncLast; } else { delete p.syncLast; delete p.syncUndo; }
    if (p.money) migrateBank(m, p);
    journalWrite(target.scope, journalRead(target.scope).filter(r => r.round !== u.round));
    await saveMeta();
    target.check();
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
        const [body] = splitTail(String(m.text || ''));
        const sections = parseSections(body).filter(x => !x.group && RANGE_HEAD.test(x.title)).map(x => { const mt = x.title.match(RANGE_HEAD); return { key: `${mt[2]}-${mt[4]}:${x.title.length}`, first: Number(mt[2]), last: Number(mt[4]), text: body.slice(x.start, x.end).trim() }; });
        const year = p.year && !p.noYear ? String(p.year) : String(new Date().getFullYear()), anchor = /^\d{2}-\d{2}/.test(p.now || '') ? `${year}-${p.now.slice(0, 5)}` : '';
        const profile = await ownerProfileBlock(ctx(), p.financeProfile, owner, { money: true });
        const check = () => (phoneChatScope(ctx()) !== scope || m.phones?.[key] !== p ? '다시 읽는 사이 채팅이나 폰이 바뀌었어요' : p.money?.at !== made.money || p.investment?.at !== made.invest ? '다시 읽는 사이 은행이나 투자가 새로 만들어졌어요' : !canUndo(p) || p.syncUndo !== u ? '다시 읽는 사이 반영이 또 있었어요' : '');
        // (the owed messages, and the events they gave, are what the money step reads)
        const st = await moneyStage(m, p, owner, { targets: [], rows: syncRows(), sections, reread: null, year, known: p.year && !p.noYear ? String(p.year) : '', anchor, profile, check, nowDay: String(p.now || '').slice(0, 5) });
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
        // (by message, as it is owed: the messages whose money went in, the ones still owed)
        return { paid: new Set(st.late.filter(x => (x.effects || []).length).map(x => x.at)).size, owed: st.owed.length, notes: st.notes };
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
    // (both numbers could be the month: the chat's 상태창 날짜 순서 says which; "MM-DD" with dashes is month first)
    const dm = num && !/\d{4}/.test(num[0]) && swapDate(num[1], num[2], (/\d{1,2}([-/.])\s*\d/.exec(num[0]) || [])[1]);
    if (num && !dm && Number(num[1]) >= 1 && Number(num[1]) <= 12 && Number(num[2]) >= 1 && Number(num[2]) <= 31) return { mo: Number(num[1]), d: Number(num[2]) };
    if (dm && Number(num[2]) >= 1 && Number(num[2]) <= 12 && Number(num[1]) >= 1 && Number(num[1]) <= 31) return { mo: Number(num[2]), d: Number(num[1]) };
    // day first ("26.10.", "26/10/2026"): a first number past 12 is the day
    if (num && Number(num[1]) > 12 && Number(num[1]) <= 31 && Number(num[2]) >= 1 && Number(num[2]) <= 12) return { mo: Number(num[2]), d: Number(num[1]) };
    const cals = calendars(), d = headingDate(`(${s})`, cals).date;
    if (d?.d && cals[d.cal]?.length === 12) return { mo: d.m + 1, d: d.d };
    // a month by its name ("30. Januar", "Jan 30"), the way the phone reads dates elsewhere
    const w = when(s.replace(/(\d)(?:st|nd|rd|th)\b/gi, '$1')).slice(0, 5);
    return /^\d{2}-\d{2}$/.test(w) ? { mo: Number(w.slice(0, 2)), d: Number(w.slice(3)) } : null;
}
// a dated row's day as the phone writes it ("10-25"), or '' when its calendar is not a 12-month one
export const rowDay = r => (r?.date?.d && calendars()[r.date.cal]?.length === 12 ? `${pad(r.date.m + 1)}-${pad(r.date.d)}` : '');
// the newest status line's weather, its date as "MM-DD" whatever shape the line writes it in ("1월 30일 (토)", "Jan 30")
export const trackerWeather = t => { const w = weatherFrom(t); if (w) { const d = monthDay(w.date); w.date = d ? `${pad(d.mo)}-${pad(d.d)}` : when(w.date).slice(0, 5); } return w; };
// the story's now: the newest status line on the owner's clock (statusMoment), else the phone's own. Read to now (no upto),
// the later of the two: a text that came a few minutes after the status line is not in the future
// upto: the story as it stood at that message (a request that read only so far)
// right after 되돌리기 (until the next 반영 or 복구): the screen's clock stays where the phone was, its weather and health
// days with it; otherwise it follows the newest status line in the chat, 반영 or not
export const clockHeld = p => !!p?.clockHold;
// 상태창 날짜 순서 (per chat): 'md' 월.일 (11.03), 'dm' 일.월 (03.11.). Asked once before the chat's first 폰 만들기 or
// 반영 (needsDateOrder), month first until then; changed any time in the phone's settings
// One explicit screen fallback per chat, independent of which phone is open.
export const screenHolderOf = m => typeof m?.phoneScreenHolder === 'string' ? m.phoneScreenHolder.trim() : '';
export async function setScreenHolder(m, name) {
    if (!m || typeof name !== 'string') return;
    const value = name.trim();
    m.phoneScreenHolder = value; // an explicit unset stays unset too
    await saveMeta();
}
// Initialize once per chat. Later persona changes and an explicit unset do not replace this choice.
export async function ensureScreenHolder(m, c = ctx()) {
    if (!m || Object.hasOwn(m, 'phoneScreenHolder')) return;
    const name = typeof c?.name1 === 'string' ? c.name1.trim() : '';
    await setScreenHolder(m, name);
}
// Use the place reader's exact-name / aka / unique first-name resolver, not a second name heuristic.
function screenPerson(m, name) {
    const rows = [];
    for (const p of Object.values(m?.phones || {})) for (const r of p?.where?.people || []) {
        if (!rows.some(x => nameKey(x.name) === nameKey(r.name))) rows.push(r);
    }
    return personIn({ where: { people: rows } }, rows, x => x.name, name);
}
export function screenHolderChoices(m, c = ctx()) {
    const out = [], seen = new Set();
    const add = (name, sub) => {
        if (typeof name !== 'string' || !name.trim()) return;
        const row = screenPerson(m, name), key = nameKey(row?.name || name);
        if (seen.has(key)) return;
        seen.add(key); out.push({ name: name.trim(), sub });
    };
    add(c?.name1, '사용자 페르소나');
    add(c?.characters?.[c.characterId]?.name, '현재 캐릭터');
    for (const p of Object.values(m?.phones || {})) {
        add(p?.owner, '연결된 인물');
        for (const x of p?.where?.people || []) add(x.name, '연결된 인물');
    }
    // (phoneProfiles is keyed by nameKey: the name as it is written — the phone being made, the chat's people, or as the archive writes it)
    const written = key => m.phonePre?.[key]?.owner || (Array.isArray(m.people) ? m.people : []).find(n => nameKey(n) === key)
        || String(m.text || '').match(new RegExp(`(?<![\\p{L}\\p{N}])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu'))?.[0] || key;
    for (const key of Object.keys(m?.phoneProfiles || {})) add(written(key), '연결된 인물');
    add(screenHolderOf(m), '선택한 인물');
    return out;
}
export function screenHolderLabel(m, c = ctx()) {
    const saved = screenHolderOf(m), key = nameKey(screenPerson(m, saved)?.name || saved);
    return screenHolderChoices(m, c).find(x => nameKey(screenPerson(m, x.name)?.name || x.name) === key)?.name || saved;
}
// Display aliases only. Never change the model's time, sender, explanation or a different scene owner.
export function clockForDisplay(clock, m, c = ctx()) {
    const flat = typeof clock?.finalViewpoint === 'string';
    const selected = screenHolderLabel(m, c), owner = flat ? clock.finalViewpoint : clock?.screen?.owner;
    if (!selected || typeof owner !== 'string') return clock;
    const key = name => nameKey(screenPerson(m, name)?.name || name);
    if (key(owner) !== key(selected)) return clock;
    return flat ? { ...clock, finalViewpoint: selected } : { ...clock, screen: { ...clock.screen, owner: selected } };
}
export const dateOrderOf = m => (m?.dateOrder === 'dm' ? 'dm' : 'md');
export const needsDateOrder = m => !m?.dateOrder;
export async function setDateOrder(m, order) { if (!m || !['md', 'dm'].includes(order)) return; m.dateOrder = order; await saveMeta(); }
dateOrderSource(() => ctx()?.chatMetadata?.narrative_archive?.dateOrder);
export function storyNow(p, upto = null, m = null) {
    if (upto == null && p?.clockHold) upto = phoneAt(p);
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
- LOREBOOK (sometimes): setting notes the user picked.

WHERE
- "city": where the person is now, in the story's present. A trip or a stay counts; a birthplace or a past home doesn't.
- "names": every name the same city goes by here. Always each name the chat's messages and status lines write it as, exactly as written ("München", "뮌헨", "서울 강남"'s "서울"); then its English and its Korean name. A chat in English with status lines in Korean gives both.
- "lives": the country they live in now, not where they were born or their nationality. Born in Germany, living in Korea: "KR".
- "in": the country "city" is in. Living in Korea, on a trip to Tokyo: "lives": "KR", "in": "JP".
- "tz": the time zone of "city", like "Asia/Seoul".
- "aka": the other names the same person goes by here, as the chat writes them: a first name, a nickname, the name in Korean or English ("소망" for "Somang Park").
- A name in PEOPLE that is the owner by another name (their full name, a nickname): no row of its own; it goes in the owner's "aka". Someone else who shares the owner's first name is someone else.
- The newest of the story wins over a card: a card that says Berlin, a story that has moved them to Seoul: Seoul.
- Someone nothing here places: leave them out. Never guess from a name or a language.
- Someone whose whereabouts are in OWNER DOESN'T KNOW: leave them out. The owner's phone may not know them.
- "evidence": the few words that show it.

YEAR
- "year": the year the story is happening in now, as these texts tell it (a date, a status line, a card that sets it), a number. A year that only a memory, a birth, a past event or a plan names is not it ("born in 1990", "they met in 2019", "the wedding next year"). null when nothing tells it (an undated present, a calendar of its own).

PEOPLE AROUND
- "around": the people in the owner's life these texts tell of (family, people at work, friends, past partners, anyone with a part in it), never the owner; up to 5 (with more, the ones with the biggest part in the owner's life).
- "about": everything these texts say of that person and the owner, wherever it is in them: who they are to each other, what happened between them, how each feels about the other, how they talk and text, and last where things stand now (together, apart, not in touch). Compress the texts' own words and keep their details; do not sum up. At most 300 tokens; shorter when the texts say less. Nothing invented, nothing from OWNER DOESN'T KNOW.

JSON (one object, nothing before or after it)
{ "people": [{ "name": as in OWNER or PEOPLE, "aka": [], "city": in English, "names": [], "lives": two-letter country code, "in": two-letter country code, "tz", "evidence" }],
  "year": a number or null,
  "around": [{ "name", "aka": [], "about" }] }`;
// (as the clock names itself, "Asia/Seoul" for "asia/seoul": one zone is one name everywhere it is compared)
const realTz = v => { const z = String(v || '').trim(); if (!/^[A-Za-z]+(?:\/[A-Za-z_+-]+){1,2}$/.test(z)) return ''; try { return new Intl.DateTimeFormat('en-US', { timeZone: z }).resolvedOptions().timeZone || z; } catch { return ''; } };
// the cards as they are: every field the story can say where someone is in, nothing summed up
const CARD_KEYS = ['description', 'personality', 'scenario', 'first_mes', 'mes_example'];
const cardText = ch => CARD_KEYS.map(k => { const v = ch?.data?.[k] ?? ch?.[k]; return v ? `[${k}]\n${v}` : ''; }).filter(Boolean).join('\n\n');
// the other phones in this chat: given, else the chat's own saved ones (a screen or a fill that has only the phone)
const phonesOf = m => m?.phones || ctx()?.chatMetadata?.narrative_archive?.phones || null;
// known: a phone not made yet (no contacts to go by): the people the chat already names, the characters' cards, the
// persona, the default screen, the glossary's people (and the other phones' owners, as always), each once
function whereRequest(m, p, { known = false } = {}) {
    const c = ctx(), g = c.groupId ? (c.groups || []).find(x => x.id === c.groupId) : null;
    const chars = g ? (g.members || []).map(a => (c.characters || []).find(x => x.avatar === a)).filter(Boolean) : [c.characters?.[c.characterId]].filter(Boolean);
    const persona = String(c.powerUserSettings?.persona_description || '').trim(), upto = phoneAt(p);
    const more = known || p.making ? [...chars.map(ch => ch.name || ch.data?.name), c.name1, screenHolderOf(m), ...glossaryPeople(m)] : [];
    // (each person once: two forms of one name in 용어집, "Ivo" and "이보", are one)
    const seen = [], people = [...(p.threads || []).map(t => t.with), ...(p.contacts || []).map(x => x.name), ...Object.values(m.phones || {}).map(q => q?.owner), ...more]
        .map(n => line(n, 60)).filter(n => n && !isOwnerName(p, m, n) && !seen.some(x => nameKey(x) === nameKey(n) || nameKey(glossTwin(m, x)) === nameKey(n)) && seen.push(n)).slice(0, 16);
    const [, tail] = splitTail(String(m.text || ''));
    return { chars, persona, people, blocks: [
        ...chars.map(ch => `[CHARACTER CARD — ${ch.name || ch.data?.name || ''}]\n${cardText(ch) || '(empty)'}`),
        persona ? `[PERSONA — ${c.name1 || 'user'}]\n${persona}` : '',
        tail.trim() ? `[STORY NOW]\n${tail.trim()}` : '',
        `[RECENT CHAT]\n${recentPhoneText(8, { upto, maxChars: 8000 }) || '(none yet)'}`,
        `[OWNER]\n${p.owner}`, `[PEOPLE]\n${people.join('\n') || '(none)'}`, blindBlock(m, p.owner),
    ] };
}
// the names a city goes by: as the chat writes it, in English and in Korean (an older reading's one "local" counts too)
const namesOf = x => [...new Set([x?.city, x?.local, ...arr(x?.names)].map(v => line(v, 60)).filter(Boolean))].slice(0, 8);
const akaOf = x => [...new Set(arr(x?.aka).map(v => line(v, 40)).filter(v => v && nameKey(v) !== nameKey(x?.name)))].slice(0, 6);
// a ticket's details the model made up to fit (a booking number, a seat, a day): shown, never proof of another ticket, the
// story's own when it gives them later
export const MADE_FIELDS = ['no', 'seat', 'gate', 'date', 'time', 'from', 'to'];
const madeOf = x => [...new Set(arr(x?.made).map(v => String(v || '').trim()).filter(v => MADE_FIELDS.includes(v)))];
const cc2 = v => (/^[A-Za-z]{2}$/.test(String(v || '').trim()) ? String(v).trim().toUpperCase() : '');
const whereRow = x => ({ name: line(x?.name, 60), ...(akaOf(x).length ? { aka: akaOf(x) } : {}), city: line(x?.city, 60), names: namesOf(x), lives: cc2(x?.lives), ...(cc2(x?.in) ? { in: cc2(x.in) } : {}), tz: realTz(x?.tz) });
// opts.known: see whereRequest; opts.asked is set to the people it asked about
export async function readWhere(m, p, opts = {}) {
    const r = whereRequest(m, p, opts), binding = p.financeProfile;
    opts.asked = r.people;
    if (p.making) p.asked = r.people;
    // a profile that is a lorebook entry is the one thing the cards and the persona don't already hold
    const lore = binding?.type === 'lore' ? await resolvePhoneProfile(ctx(), binding).catch(() => null) : null;
    const book = await loreFor(m, p.owner).catch(() => '');
    const input = [...r.blocks.slice(0, -3), lore ? `[OWNER PROFILE — chosen by the user for ${p.owner}]\n${lore.text}` : '', book ? `[LOREBOOK]\n${book}` : '', ...r.blocks.slice(-3)].filter(Boolean).join('\n\n');
    const raw = jsonOf(await askDraft(input, { force: true, system: AI_SYS_WHERE, maxTokens: 4500, effort: 'low' }));
    // the people closest to the owner, as the cards, the persona, the profile and the lorebook tell them (반영 reads these,
    // never the texts themselves); a reading that gives none keeps the ones there
    // (the owner by a name of theirs, as before, or as this reading gives it: their full name in the contacts, "Ren Park",
    // is the owner's aka here, never a person of its own)
    // (never the name of someone else's row there before: "Mara" given as the owner's aka while Mara has a row of her own is
    // hers, and her row and the city set for her stay)
    // (a name the reading gives both as the owner's aka and as a row of its own, "Ren Park": the code doesn't pick one; it stays
    // its own row and the user is asked in 위치 정보 (p.where.ask), unless they answered it before)
    const said = new Set(arr(p.where?.ownerSaid).map(nameKey)), notOwner = new Set(arr(p.where?.notOwner).map(nameKey));
    const oldOthers = new Set((p.where?.people || []).map(r => r?.name).filter(n => n && !isOwnerName(p, m, n)).map(nameKey));
    const ownRead = arr(raw?.people).find(x => nameKey(x?.name) === nameKey(p.owner));
    const readOthers = new Set(arr(raw?.people).map(x => line(x?.name, 60)).filter(n => n && nameKey(n) !== nameKey(p.owner)).map(nameKey));
    const both = akaOf(ownRead || {}).filter(a => readOthers.has(nameKey(a)) && !said.has(nameKey(a)) && !notOwner.has(nameKey(a)) && !oldOthers.has(nameKey(a)));
    const ownAka = new Set([...withTwins(m, akaOf(ownRead || {})).map(nameKey).filter(k => !oldOthers.has(k) && !notOwner.has(k) && (!readOthers.has(k) || said.has(k))), ...said]);
    const isOwn = n => isOwnerName(p, m, n) || withTwins(m, [n]).some(x => ownAka.has(nameKey(x)));
    const around = arr(raw?.around).map(x => ({ name: line(x?.name, 60), aka: akaOf(x), about: str(x?.about, 1600) })).filter(x => x.name && x.about && !isOwn(x.name)).slice(0, 5);
    if (around.length) p.around = { at: Date.now(), people: around };
    // (a phone being made: the story's year as the reading tells it, for its year before a guess from the dates)
    const y = Number(raw?.year);
    if (p.making) { if (Number.isInteger(y) && y >= 1900 && y <= 2100) p.readYear = y; else delete p.readYear; }
    const known = [p.owner, ...r.people];
    // (someone the user took off stays off; what the user set by hand stays as they set it)
    // (by any form of their name: one taken off as "Ivo" stays off as "이보"; one set by hand as "Ivo" stays so as "이보")
    const removed = new Set(p.where?.removed || []), formsOf = x => withTwins(m, [x.name, ...arr(x.aka)]).map(nameKey), gone = x => formsOf(x).some(k => removed.has(k));
    const olds = p.where?.people || [], strong = x => withTwins(m, [x.name]).map(nameKey);
    const shared = x => !olds.some(o => strong(o).some(k => strong(x).includes(k))) && olds.filter(o => formsOf(o).some(k => strong(x).includes(k))).length > 1;
    // (the owner's row is only the owner's: never someone else's old row, nor theirs the owner's)
    // (nor the row of someone this reading reads apart: "Mara Kim" is never Mara's old row while Mara is read too)
    const oldRow = x => {
        const ks = formsOf(x), mine = r => isOwn(r.name) === isOwn(x.name) && !(readNames.has(nameKey(r.name)) && nameKey(r.name) !== nameKey(x.name));
        const rows = (p.where?.people || []).filter(mine);
        return rows.find(r => nameKey(r.name) === nameKey(x.name)) || (hits => (hits.length === 1 ? hits[0] : null))(rows.filter(r => rowForms(m, r).some(k => ks.includes(k)))) || (r => (r && mine(r) ? r : null))(whereOf(p, x.name));
    };
    // (a row by the other form of a name asked about, "이보" for "Ivo", is that person's; and it keeps that form as a name of theirs)
    // (an aka the reading gives that is the owner's name, on someone else ("Ren" for Ren Kim), or the name of another row it
    // reads ("Mara" for Mara Kim, with a Mara of her own), is no name of theirs: never a way to someone else's row)
    const readNames = new Set(arr(raw?.people).map(x => nameKey(line(x?.name, 60))).filter(Boolean));
    // (the owner's own aka as the reading gives it stays theirs: "Ren Park" read as a row too is the owner's)
    const ownAkaOnly = x => ({ ...x, ...(arr(x.aka).length ? { aka: arr(x.aka).filter(a => isOwn(x.name) && ownAka.has(nameKey(a)) || !readNames.has(nameKey(a)) && (isOwn(x.name) || !isOwn(a))) } : {}) });
    const used = new Set();
    const read = arr(raw?.people).map(whereRow).map(ownAkaOnly).filter(x => x.name && !said.has(nameKey(x.name)) && known.some(k => nameKey(k) === nameKey(x.name) || nameKey(glossTwin(m, k)) === nameKey(x.name)) && !gone(x) && (x.tz || COUNTRY_TZ[x.lives]))
        // (the owner read by another name of theirs, "렌" for Ren: their row, by the owner's name, that one kept as an aka)
        .map(x => (nameKey(x.name) !== nameKey(p.owner) && isOwn(x.name) ? { ...x, name: p.owner, aka: [...new Set([x.name, ...arr(x.aka)])].filter(a => nameKey(a) !== nameKey(p.owner)).slice(0, 6), byOther: true } : x))
        // (the row read by the owner's own name first: one by another name of theirs only when there is none)
        .sort((a, b) => Number(!!a.byOther) - Number(!!b.byOther))
        .filter((x, i, all) => all.findIndex(y => nameKey(y.name) === nameKey(x.name)) === i)
        .map(({ byOther, ...x }) => x)
        // (one set by hand, "Mara Lee", read now by a shorter name of hers, "Mara": her row, by the name it had, the shorter one an
        // aka; never a second row of her)
        .map(x => { const o = oldRow(x); if (!o?.manual) return x; used.add(o); const longer = !isOwn(x.name) && nameKey(o.name) !== nameKey(x.name) && String(o.name).length > String(x.name).length;
            return { ...x, ...(longer ? { name: o.name, aka: [...new Set([x.name, ...arr(x.aka)])].filter(a => nameKey(a) !== nameKey(o.name)).slice(0, 6) } : {}), ...(o.manual.city ? { city: o.city, names: namesOf(o), tz: o.tz, in: o.in } : {}), ...(o.manual.lives ? { lives: o.lives } : {}), manual: o.manual }; })
        // (a name that is only an aka two rows share, "Ivo" of Ivo Kim and Ivo Park, is neither of them: left out)
        .filter(x => !shared(x));
    // one person by two names ("Somang Park" in the contacts, "Somang" in a thread) in the same city: once, by the longer
    // name. In two cities they are two people (two named alike) and both stay
    const here = (a, b) => sameName(m, a.name, b.name) && nameKey(a.name) !== nameKey(b.name) && isOwn(a.name) === isOwn(b.name) && pkey(a.city) === pkey(b.city) && (a.tz || '') === (b.tz || '');
    // (two forms the same length, "Yu" and "유우": the one first in order stays)
    const longer = (y, x) => String(y.name).length > String(x.name).length || String(y.name).length === String(x.name).length && nameKey(y.name) < nameKey(x.name);
    const twin = x => read.some(y => here(x, y) && longer(y, x));
    const got = read.filter(x => !twin(x)).slice(0, 16).map(x => { const more = read.filter(y => here(y, x) && twin(y)).flatMap(y => [y.name, ...arr(y.aka)]).filter(n => nameKey(n) !== nameKey(x.name)); return more.length ? { ...x, aka: [...new Set([...arr(x.aka), ...more])].slice(0, 6) } : x; }),
        merged = read.filter(twin).map(x => nameKey(x.name));
    // (an old row of a person read now by another form of their name is that person's: one row, its names kept)
    // (by a row's own name or its 용어집 form, never an aka alone: "Ivo" an aka of both Ivo Kim and Ivo Park is neither)
    const samePersonRow = (o, x) => isOwn(o.name) === isOwn(x.name) && (strong(o).some(k => formsOf(x).includes(k)) || strong(x).some(k => formsOf(o).includes(k)) && olds.filter(r => formsOf(r).some(k => strong(x).includes(k))).length === 1);
    // (read again: the names a person's row had before stay theirs, by the same name too, "Ren Park" the owner's; never a
    // name that is now another row's own, nor the owner's on someone else)
    const gotNames = new Set(got.map(x => nameKey(x.name)));
    // (전부 새로: none of them, the reading's names only)
    for (const x of opts.all ? [] : got) for (const o of p.where?.people || []) {
        const same = nameKey(o.name) === nameKey(x.name);
        if (!same && !samePersonRow(o, x)) continue;
        const more = [...(same ? [] : [o.name]), ...arr(o.aka)].filter(n => nameKey(n) !== nameKey(x.name) && !(gotNames.has(nameKey(n)) && nameKey(n) !== nameKey(o.name)) && (isOwn(x.name) || !isOwn(n)));
        if (more.length) x.aka = [...new Set([...arr(x.aka), ...more])].filter(n => nameKey(n) !== nameKey(x.name)).slice(0, 8);
        if (same && arr(o.glossAka).length) x.glossAka = [...new Set([...arr(x.glossAka), ...arr(o.glossAka)])];
    }
    // read again: someone it leaves out keeps what was read before
    const people = [...got, ...(p.where?.people || []).filter(o => !used.has(o) && !got.some(x => nameKey(x.name) === nameKey(o.name) || samePersonRow(o, x)) && !merged.includes(nameKey(o.name)) && !got.some(x => here(o, x) && longer(x, o))).map(o => ({ ...o, names: namesOf(o) }))].slice(0, 16);
    // (the user's answers to "is this the owner?" stay; a name still unanswered is asked once)
    const ask = [...new Set([...arr(p.where?.ask), ...both])].filter(n => !said.has(nameKey(n)) && !notOwner.has(nameKey(n)) && people.some(r => nameKey(r.name) === nameKey(n)));
    p.where = { at: Date.now(), people, ...(removed.size ? { removed: [...removed] } : {}), ...(said.size ? { ownerSaid: arr(p.where?.ownerSaid) } : {}), ...(notOwner.size ? { notOwner: arr(p.where?.notOwner) } : {}), ...(ask.length ? { ask } : {}) };
    glossAka(m, p);
    // (PEOPLE AROUND by the name 위치 정보 has for them: one person, one name, on the map and in the texts alike)
    // (two entries that turn out one person: the first, with the other's names)
    if (p.around?.people) {
        const out = [];
        for (const x0 of p.around.people) {
            const who = personOf(p, m, x0.name), x = !who || nameKey(who.name) === nameKey(x0.name) ? x0 : { ...x0, name: who.name, aka: [...new Set([...arr(x0.aka), x0.name])].filter(a => nameKey(a) !== nameKey(who.name)).slice(0, 6) };
            const had = out.find(y => nameKey(y.name) === nameKey(x.name));
            if (had) had.aka = [...new Set([...arr(had.aka), ...arr(x.aka)])].filter(a => nameKey(a) !== nameKey(had.name)).slice(0, 6); else out.push(x);
        }
        p.around.people = out;
    }
    syncLives(p);
    return people;
}
// a read that fails is noted and not asked again (the clock goes by the phones and the countries); one already there stays
const tryWhere = async (m, p, opts = {}) => { try { await readWhere(m, p, opts); } catch (err) { console.warn('[narrative-archive] where', err); p.where = { ...(p.where || { at: Date.now(), people: [] }), failed: true }; } };
// the owner moved to another city in the story (the reflection says so): their row in the reading follows
function ownerMoved(p, c) {
    const tz = realTz(c?.tz), city = line(c?.city, 60);
    // (a city the user set by hand stays)
    if (!tz || !city || whereOf(p, p.owner)?.manual?.city) return false;
    // (their row by a name of theirs too, an older reading's "Ren Park": that one moves, no second row left behind)
    const was = whereOf(p, p.owner), row = { ...was, name: p.owner, city, names: namesOf(c), tz };
    delete row.in; if (cc2(c?.in)) row.in = cc2(c.in);
    if (was && nameKey(was.name) !== nameKey(p.owner)) row.aka = [...new Set([was.name, ...arr(was.aka)])].filter(n => nameKey(n) !== nameKey(p.owner)).slice(0, 8);
    delete row.local;
    p.where = { ...(p.where || {}), at: p.where?.at || Date.now(), people: [row, ...(p.where?.people || []).filter(x => x !== was && nameKey(x.name) !== nameKey(p.owner))] };
    return true;
}
// one person by two names: the same, or one a single word that is the other's first ("Somang" and "Somang Park"; never
// "Ren Kim" and "Ren Park")
const samePerson = (a, b) => { const x = nameKey(a), y = nameKey(b); if (!x || !y) return false; if (x === y) return true; const [s, l] = x.length < y.length ? [x, y] : [y, x]; return !/\s/.test(s) && l.split(/\s+/)[0] === s; };
// a name and its other form in 번역 용어집 ("Ivo = 이보"): the same person. glossTwin gives the other form, as written
// (the pairs read once per 용어집 text: a long one is not read again for every name)
let glossMemo = { text: null, map: new Map() };
const glossMap = m => {
    const text = String(m?.glossary ?? '');
    // (an empty one is read each time: nothing to read, and nothing kept that a later one could miss)
    if (glossMemo.text !== text || !text) { const map = new Map(); for (const e of glossaryEntries(m)) { const a = nameKey(e.src), b = nameKey(e.ko); if (a && b && a !== b) { if (!map.has(a)) map.set(a, e.ko); if (!map.has(b)) map.set(b, e.src); } } glossMemo = { text, map }; }
    return glossMemo.map;
};
const glossTwin = (m, n) => { const k = nameKey(n); return k && m ? glossMap(m).get(k) || '' : ''; };
const sameName = (m, a, b) => samePerson(a, b) || (t => !!t && samePerson(t, b))(glossTwin(m, a));
// one person by the very same name only: equal, or one the 용어집 other form of the other ("Ren" and "렌"; never "Ren"
// and "Ren Kim", who may be someone else)
const strictSame = (m, a, b) => { const x = nameKey(a), y = nameKey(b); return !!x && !!y && (x === y || nameKey(glossTwin(m, a)) === y || nameKey(glossTwin(m, b)) === x); };
// a 위치 정보 row for this name: by the row's name, an aka, a 용어집 form, or the one row whose first name it is ("Mara
// Lee" for a row Mara): no reading needed for them
const hasRow = (p, m, n) => { const who = personOf(p, m, n); return !!(who && (p?.where?.people || []).some(r => nameKey(r.name) === who.key)) || !!whereOf(p, n); };
// the owner by a name of theirs: their own, their 위치 정보 row's aka, the 용어집 other form of either; never another
// whose first name is theirs ("Ren Kim" for an owner Ren is asked about, kept, and with them)
const ownerRow = p => whereOf(p, p?.owner);
const isOwnerName = (p, m, n) => {
    if (!nameKey(n) || !p?.owner) return false;
    const row = ownerRow(p), own = new Set(withTwins(m, [p.owner, row?.name, ...arr(row?.aka)].filter(Boolean)).map(nameKey));
    return withTwins(m, [n]).some(x => own.has(nameKey(x)));
};
// a person named in a text, as a name is written there, never as a part of another word: "Mara" not in "Maradona"; a
// Korean name alone or with what Korean puts after a name (소망이 · 소망이가 · 소망이랑 · 소망아 · 소망 씨 · 소망한테 · 이보는 ·
// 이보네), never in another word ("이보다", "장미꽃", "소망하다", "그건 소망이다"); a name in Latin letters may take a Korean
// ending ("Ivo가")
// ("하고" not as a verb: "소망하고 있다", "소망하고 싶다")
const KO_AFTER = String.raw`(?:이(?!다)(?:가|는|를|랑|와|하고|한테|에게|도|만|네|야|의|여|요)?|가|는|은|를|을|와|과|랑|하고(?!\s*(?:있|싶))|한테|에게|께|의|도|만|네|야|아|여|씨|님|요|부터|까지|처럼|보고|더러|에게서|한테서)`;
// (and, after a Korean name of three letters or more only, endings an ordinary word takes as often: "마리아라고",
// "마리아로부터", "마리아조차", "지훈이라면" for 지훈이, "마리아밖에", "마리아뿐", "마리아인데"; a short name, "하나", "가을",
// "유리", is that word too, "하나밖에", "가을인데", "유리라고", and is found by the endings above)
const KO_MID = String.raw`(?:이?(?:라고|라면|라도)|인데|로부터|으로부터|조차|마저|밖에|뿐)`;
// (endings a place or a thing takes as well: "가을에", "하늘로", "바다에서", "하나였다", "나라보다": after a Korean name of
// three letters or more only; a short one, "가을", "하늘", may be that word, and is found by the other endings)
const KO_WEAK = String.raw`(?:(?:에서|에|으로|로|보다)(?:는|도|만|의|요|부터|까지|라도|선)?(?![\p{L}])|였(?:다|어|고|지|는데|던|으면|을|음)?(?![\p{L}]))`;
const nameRes = new Map();
export function namedIn(text, name) {
    const n = String(name || '').trim();
    if (n.length < 2) return false;
    const low = String(text || '').toLowerCase();
    // (a text without the name in it at all needs no closer look)
    if (!low.includes(n.toLowerCase())) return false;
    let re = nameRes.get(n);
    if (!re) {
        const esc = n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), ko = /\p{Script=Hangul}$/u.test(n), short = ko && [...n].length <= 2;
        const at = after => new RegExp(String.raw`(?:^|[^\p{L}\p{N}])${esc}(?=$|[^\p{L}\p{N}]|${after})`, 'u');
        re = at(ko ? (short ? KO_AFTER : `${KO_AFTER}|${KO_MID}|${KO_WEAK}`) : String.raw`\p{Script=Hangul}`);
        if (nameRes.size > 2000) nameRes.clear();
        nameRes.set(n, re);
    }
    return re.test(low);
}
// the 용어집 other forms a text may be searched for: only those 용어집 marks as people (a "Rose = 장미" there may be a
// flower); the rows themselves (위치 정보, texts) take every pair, as a whole name only
// (an aka that is only another name's 용어집 form, put there by glossAka, counts by the same rule)
// (용어집's people read once per its text and its people marks, as its pairs are)
let peopleMemo = { text: null, set: new Set() };
const peopleSet = m => { if (!m) return new Set(); const text = `${m.glossary ?? ''}\0${JSON.stringify(m.glossaryPeople ?? null)}`; if (peopleMemo.text !== text || !m.glossary) peopleMemo = { text, set: new Set(glossaryPeople(m).map(nameKey)) }; return peopleMemo.set; };
const peopleTwins = (m, names) => {
    const ok = peopleSet(m), people = n => ok.has(nameKey(n)) || ok.has(nameKey(glossTwin(m, n)));
    // (a name is left out only as the 용어집 form of one before it: the row's own name, first, always stays; "Rose" and
    // its "장미" leave "Rose")
    const own = names.filter((n, i) => !names.slice(0, i).some(x => nameKey(x) !== nameKey(n) && nameKey(glossTwin(m, x)) === nameKey(n)) || people(n));
    return withTwins(m, own).filter(n => own.includes(n) || people(n));
};
// names with their 용어집 other forms added (each once)
const withTwins = (m, names) => { const out = []; for (const n of [...names, ...(m ? names.map(x => glossTwin(m, x)) : [])]) if (n && !out.some(x => nameKey(x) === nameKey(n))) out.push(n); return out; };
// one person by any of their names: the 위치 정보 row they are on (by its name or an aka, or the 용어집 other form of
// one), else the name itself; { key, name } with the row's name as the one to show
function personOf(p, m, n) {
    const k = nameKey(n);
    if (!k) return null;
    // (a row by its own name first; else the one row that has it as an aka: a short name two rows share is no one's)
    const keys = withTwins(m, [n]).map(nameKey), rows = p?.where?.people || [];
    const row = rows.find(r => keys.includes(nameKey(r.name))) || (hits => (hits.length === 1 ? hits[0] : null))(rows.filter(r => arr(r.aka).some(x => keys.includes(nameKey(x)))));
    return row ? { key: nameKey(row.name), name: row.name } : { key: keys.slice().sort()[0], name: n };
}
// every form of one row's person: its name, its aka, their 용어집 other forms
const rowForms = (m, r) => withTwins(m, [r?.name, ...arr(r?.aka)].filter(Boolean)).map(nameKey);
// 용어집 forms not yet on a 위치 정보 row are put on it as its aka ("Ivo = 이보" added after it was read), so every place
// that finds a person by their aka (texts, the clock, the default screen) finds them by both. Code only, no request
// (the forms it puts there are marked, glossAka: when 용어집 changes, "Rose = 장미" to "Rose = 로즈", "장미" goes)
const glossRows = (m, rows) => {
    let changed = false;
    for (const r of rows || []) {
        if (!r || typeof r !== 'object' || !r.name) continue;
        const marked = new Set(arr(r.glossAka).map(nameKey)), own = arr(r.aka).filter(a => !marked.has(nameKey(a)));
        const twins = withTwins(m, [r.name, ...own]).filter(n => nameKey(n) !== nameKey(r.name) && !own.some(a => nameKey(a) === nameKey(n)));
        // (changed only when a name really comes or goes: an aka list already full stays as it is)
        const aka = [...own, ...twins].slice(0, 8), g = twins.filter(n => aka.includes(n));
        if (JSON.stringify(aka) !== JSON.stringify(arr(r.aka))) { r.aka = aka; changed = true; }
        if (JSON.stringify(g) !== JSON.stringify(arr(r.glossAka))) { if (g.length) r.glossAka = g; else delete r.glossAka; changed = true; }
    }
    return changed;
};
// (the last rounds' 되돌리기 keep the reading as it was: their copies get the same names, so 되돌리기 still sees the reading
// it left, and puts back the one before it)
function glossAka(m, p) {
    if (!m || !glossRows(m, p?.where?.people)) return;
    for (const u of [p.syncUndo, ...arr(p.syncUndos)]) {
        if (!u) continue;
        if (u.where?.people) glossRows(m, u.where.people);
        if (typeof u.whereAfter === 'string') { try { const w = JSON.parse(u.whereAfter); if (w?.people) { glossRows(m, w.people); u.whereAfter = JSON.stringify(w); } } catch { /* an old copy */ } }
    }
}
// (by the short name only when it is one person's: "Ivo" with an Ivo Kim and an Ivo Park is neither)
// (the owner's row: by their own name or one of its aka, never another's who shares their first name ("Ren Kim"), and
// no one else's row is the owner's)
const whereOf = (p, name) => {
    const rows = p?.where?.people || [], k = nameKey(name), own = nameKey(p?.owner), exact = rows.find(x => nameKey(x.name) === k);
    if (exact || !k) return exact;
    if (k === own) {
        const hits = rows.filter(x => arr(x.aka).some(a => nameKey(a) === k));
        return hits.length === 1 ? hits[0] : undefined;
    }
    const same = rows.filter(x => nameKey(x.name) !== own && samePerson(x.name, name));
    return same.length === 1 ? same[0] : undefined;
};
// where the owner lives (설정 › 위치 정보's 사는 나라: by hand or read), else the phone's 국적: what the bank, the money,
// the parcels and the web go by (a Korean living in Germany banks in euros)
export const homeCountry = p => String(p?.lives || whereOf(p, p?.owner)?.lives || p?.country || '').toUpperCase();
// ---- 설정 › 위치 정보: the phone's own country (p.lives) follows the reading of where the owner lives, unless set by hand
function syncLives(p) { const l = whereOf(p, p?.owner)?.lives; if (l && !p.livesManual) p.lives = String(l).toUpperCase(); }
// a city's time zone for one the user typed: a saved city/alias or a known city, never a guess from their residence.
// A country can span zones, and the person may be travelling; an unknown city must not lock in the owner's clock.
const ZONES = (() => { try { return Intl.supportedValuesOf('timeZone'); } catch { return []; } })();
const CITY_ZONES = [
    ['America/Los_Angeles', ['San Francisco', '샌프란시스코', 'Seattle', '시애틀', '로스앤젤레스', 'Los Angeles']],
    ['America/Vancouver', ['Vancouver', '밴쿠버', '벤쿠버']],
    ['America/New_York', ['New York', 'New York City', '뉴욕', 'Boston', '보스턴', 'Washington DC', 'Washington D.C.', '워싱턴 DC']],
    ['America/Chicago', ['Chicago', '시카고']], ['America/Denver', ['Denver', '덴버']],
    ['America/Phoenix', ['Phoenix', '피닉스']], ['Pacific/Honolulu', ['Honolulu', '호놀룰루']],
    ['America/Toronto', ['Toronto', '토론토', 'Ottawa', '오타와', 'Montreal', '몬트리올']],
    ['America/Edmonton', ['Edmonton', '에드먼턴', 'Calgary', '캘거리']], ['America/Winnipeg', ['Winnipeg', '위니펙']],
    ['Europe/Berlin', ['Frankfurt', 'Frankfurt am Main', '프랑크푸르트', 'Berlin', '베를린', 'Munich', 'München', 'Muenchen', '뮌헨', 'Hamburg', '함부르크', 'Cologne', 'Köln', 'Koeln', '쾰른', 'Düsseldorf', 'Duesseldorf', '뒤셀도르프', 'Stuttgart', '슈투트가르트', 'Leipzig', '라이프치히', 'Dresden', '드레스덴', 'Heidelberg', '하이델베르크', 'Nuremberg', 'Nürnberg', '뉘른베르크', 'Bonn', '본']],
    // (the cities most chats write, in English, the local name and Korean: a city typed in 위치 정보 by any of them; a name
    // two cities share, Cambridge, Portland, is asked: CITY_TWINS)
    ['Asia/Seoul', ['Seoul', '서울', 'Busan', 'Pusan', '부산', 'Incheon', '인천', 'Daegu', '대구', 'Daejeon', '대전', 'Gwangju', '광주', 'Ulsan', '울산', 'Suwon', '수원', 'Seongnam', '성남', 'Pangyo', '판교', 'Bundang', '분당', 'Ilsan', '일산', 'Goyang', '고양', 'Yongin', '용인', 'Jeju', '제주', 'Jeonju', '전주', 'Gangneung', '강릉', 'Sejong', '세종', 'Pohang', '포항', 'Changwon', '창원', 'Cheongju', '청주', 'Chuncheon', '춘천', 'Gyeongju', '경주', 'Yeosu', '여수', 'Sokcho', '속초']],
    ['Asia/Tokyo', ['Tokyo', '東京', '도쿄', 'Osaka', '大阪', '오사카', 'Kyoto', '京都', '교토', 'Yokohama', '横浜', '요코하마', 'Nagoya', '名古屋', '나고야', 'Sapporo', '札幌', '삿포로', 'Fukuoka', '福岡', '후쿠오카', 'Kobe', '神戸', '고베', 'Okinawa', 'Naha', '沖縄', '오키나와', 'Nara', '奈良', '나라', 'Hiroshima', '広島', '히로시마', 'Sendai', '仙台', '센다이']],
    ['Asia/Shanghai', ['Shanghai', '上海', '상하이', 'Beijing', '北京', '베이징', 'Shenzhen', '深圳', '선전', 'Guangzhou', '广州', '광저우', 'Chengdu', '成都', '청두', 'Hangzhou', '杭州', '항저우', 'Qingdao', '青岛', '칭다오']],
    ['Asia/Hong_Kong', ['Hong Kong', '香港', '홍콩']], ['Asia/Taipei', ['Taipei', '台北', '타이베이', '타이페이', 'Kaohsiung', '가오슝']],
    ['Asia/Singapore', ['Singapore', '싱가포르', '싱가폴']], ['Asia/Bangkok', ['Bangkok', '방콕', 'Phuket', '푸껫', '푸켓', 'Chiang Mai', '치앙마이']],
    ['Asia/Ho_Chi_Minh', ['Ho Chi Minh City', 'Saigon', '호찌민', '호치민', 'Hanoi', '하노이', 'Da Nang', '다낭', 'Nha Trang', '나트랑']],
    ['Asia/Manila', ['Manila', '마닐라', 'Cebu', '세부']], ['Asia/Jakarta', ['Jakarta', '자카르타']], ['Asia/Makassar', ['Bali', 'Denpasar', '발리']],
    ['Asia/Kuala_Lumpur', ['Kuala Lumpur', '쿠알라룸푸르']], ['Asia/Kolkata', ['Mumbai', '뭄바이', 'Delhi', 'New Delhi', '델리', '뉴델리', 'Bangalore', 'Bengaluru', '벵갈루루']],
    ['Asia/Dubai', ['Dubai', '두바이', 'Abu Dhabi', '아부다비']], ['Europe/Istanbul', ['Istanbul', '이스탄불']], ['Asia/Tehran', ['Tehran', '테헤란']],
    ['Europe/London', ['London', '런던', 'Manchester', '맨체스터', 'Liverpool', '리버풀', 'Edinburgh', '에든버러', 'Oxford', '옥스퍼드']],
    ['Europe/Dublin', ['Dublin', '더블린']], ['Europe/Paris', ['Paris', '파리', 'Lyon', '리옹', 'Nice', '니스', 'Marseille', '마르세유']],
    ['Europe/Rome', ['Rome', 'Roma', '로마', 'Milan', 'Milano', '밀라노', 'Venice', 'Venezia', '베네치아', 'Florence', 'Firenze', '피렌체', 'Naples', 'Napoli', '나폴리']],
    ['Europe/Madrid', ['Madrid', '마드리드', 'Barcelona', '바르셀로나', 'Seville', 'Sevilla', '세비야']], ['Europe/Lisbon', ['Lisbon', 'Lisboa', '리스본', 'Porto', '포르투']],
    ['Europe/Amsterdam', ['Amsterdam', '암스테르담']], ['Europe/Brussels', ['Brussels', 'Bruxelles', '브뤼셀']], ['Europe/Vienna', ['Vienna', 'Wien', '빈', '비엔나']],
    ['Europe/Zurich', ['Zurich', 'Zürich', '취리히', 'Geneva', 'Genève', '제네바', 'Bern', '베른']], ['Europe/Prague', ['Prague', 'Praha', '프라하']],
    ['Europe/Budapest', ['Budapest', '부다페스트']], ['Europe/Warsaw', ['Warsaw', 'Warszawa', '바르샤바']], ['Europe/Copenhagen', ['Copenhagen', 'København', '코펜하겐']],
    ['Europe/Stockholm', ['Stockholm', '스톡홀름']], ['Europe/Oslo', ['Oslo', '오슬로']], ['Europe/Helsinki', ['Helsinki', '헬싱키']], ['Europe/Athens', ['Athens', '아테네']],
    ['Europe/Moscow', ['Moscow', 'Москва', '모스크바', 'Saint Petersburg', 'St. Petersburg', '상트페테르부르크']],
    ['Australia/Sydney', ['Sydney', '시드니', 'Canberra', '캔버라']], ['Australia/Melbourne', ['Melbourne', '멜버른']], ['Australia/Brisbane', ['Brisbane', '브리즈번', 'Gold Coast', '골드코스트']],
    ['Australia/Perth', ['Perth', '퍼스']], ['Australia/Adelaide', ['Adelaide', '애들레이드']], ['Australia/Lord_Howe', ['Lord Howe Island', 'Lord Howe', '로드하우']],
    ['Pacific/Auckland', ['Auckland', '오클랜드', 'Wellington', '웰링턴']], ['America/Mexico_City', ['Mexico City', '멕시코시티']],
    ['America/Sao_Paulo', ['São Paulo', 'Sao Paulo', '상파울루', 'Rio de Janeiro', '리우데자네이루']], ['America/Argentina/Buenos_Aires', ['Buenos Aires', '부에노스아이레스']],
    ['America/Los_Angeles', ['San Diego', '샌디에이고', 'Las Vegas', '라스베이거스', 'LA']], ['America/New_York', ['Philadelphia', '필라델피아', 'Miami', '마이애미', 'Atlanta', '애틀랜타']],
    ['America/Chicago', ['Dallas', '댈러스', 'Houston', '휴스턴', 'Austin', '오스틴']], ['Africa/Cairo', ['Cairo', '카이로']], ['Africa/Johannesburg', ['Johannesburg', '요하네스버그', 'Cape Town', '케이프타운']],
];
// a city name two places go by, each with its zone: the user is asked which (cityChoices)
const CITY_TWINS = [
    [['Cambridge', '케임브리지'], [['Europe/London', '영국 케임브리지'], ['America/New_York', '미국 케임브리지 (매사추세츠)']]],
    [['Portland', '포틀랜드'], [['America/Los_Angeles', '미국 포틀랜드 (오리건)'], ['America/New_York', '미국 포틀랜드 (메인)']]],
    [['Birmingham', '버밍엄', '버밍햄'], [['Europe/London', '영국 버밍엄'], ['America/Chicago', '미국 버밍햄 (앨라배마)']]],
    [['San Jose', '산호세'], [['America/Los_Angeles', '미국 산호세 (캘리포니아)'], ['America/Costa_Rica', '코스타리카 산호세']]],
    [['Santiago', '산티아고'], [['America/Santiago', '칠레 산티아고'], ['Europe/Madrid', '스페인 산티아고데콤포스텔라']]],
    [['Perth', '퍼스'], [['Australia/Perth', '호주 퍼스'], ['Europe/London', '영국 퍼스 (스코틀랜드)']]],
    [['Valencia', '발렌시아'], [['Europe/Madrid', '스페인 발렌시아'], ['America/Caracas', '베네수엘라 발렌시아']]],
    // (a city that is also the last part of another country's clock name, "America/Argentina/San_Juan": asked, never that one)
    [['San Juan', '산후안'], [['America/Puerto_Rico', '푸에르토리코 산후안'], ['America/Argentina/San_Juan', '아르헨티나 산후안']]],
    [['Cordoba', 'Córdoba', '코르도바'], [['Europe/Madrid', '스페인 코르도바'], ['America/Argentina/Cordoba', '아르헨티나 코르도바']]],
    [['Merida', 'Mérida', '메리다'], [['America/Merida', '멕시코 메리다'], ['Europe/Madrid', '스페인 메리다'], ['America/Caracas', '베네수엘라 메리다']]],
    [['Tripoli', '트리폴리'], [['Africa/Tripoli', '리비아 트리폴리'], ['Asia/Beirut', '레바논 트리폴리']]],
    [['Halifax', '핼리팩스'], [['America/Halifax', '캐나다 핼리팩스'], ['Europe/London', '영국 핼리팩스']]],
    [['La Paz', '라파스'], [['America/La_Paz', '볼리비아 라파스'], ['America/Mazatlan', '멕시코 라파스']]],
];
const cityTwin = k => CITY_TWINS.find(([names]) => names.some(n => pkey(n) === k));
// a country with more than one clock: its zones, for the user to pick one (a city the app doesn't know, in that country)
const COUNTRY_ZONES = {
    US: [['America/New_York', '동부 (뉴욕 · 보스턴 · 마이애미 · 애틀랜타)'], ['America/Chicago', '중부 (시카고 · 댈러스 · 휴스턴)'], ['America/Denver', '산악 (덴버 · 솔트레이크시티)'], ['America/Phoenix', '애리조나 (피닉스)'], ['America/Los_Angeles', '서부 (LA · 샌프란시스코 · 시애틀 · 라스베이거스)'], ['America/Anchorage', '알래스카'], ['Pacific/Honolulu', '하와이']],
    CA: [['America/St_Johns', '뉴펀들랜드'], ['America/Halifax', '대서양 (핼리팩스)'], ['America/Toronto', '동부 (토론토 · 몬트리올 · 오타와)'], ['America/Winnipeg', '중부 (위니펙)'], ['America/Regina', '서스캐처원'], ['America/Edmonton', '산악 (캘거리 · 에드먼턴)'], ['America/Vancouver', '태평양 (밴쿠버)']],
    AU: [['Australia/Sydney', '시드니 · 멜버른 · 캔버라'], ['Australia/Brisbane', '퀸즐랜드 (브리즈번)'], ['Australia/Adelaide', '남호주 (애들레이드)'], ['Australia/Darwin', '노던 준주 (다윈)'], ['Australia/Perth', '서호주 (퍼스)'], ['Australia/Hobart', '태즈메이니아 (호바트)'], ['Australia/Lord_Howe', '로드하우섬']],
    RU: [['Europe/Kaliningrad', '칼리닌그라드'], ['Europe/Moscow', '모스크바 · 상트페테르부르크'], ['Europe/Samara', '사마라'], ['Asia/Yekaterinburg', '예카테린부르크'], ['Asia/Omsk', '옴스크'], ['Asia/Novosibirsk', '노보시비르스크'], ['Asia/Krasnoyarsk', '크라스노야르스크'], ['Asia/Irkutsk', '이르쿠츠크'], ['Asia/Yakutsk', '야쿠츠크'], ['Asia/Vladivostok', '블라디보스토크'], ['Asia/Magadan', '마가단'], ['Asia/Kamchatka', '캄차카']],
    BR: [['America/Sao_Paulo', '브라질리아 · 상파울루 · 리우'], ['America/Manaus', '아마조나스 (마나우스)'], ['America/Rio_Branco', '아크리'], ['America/Noronha', '페르난두지노로냐']],
    MX: [['America/Mexico_City', '중부 (멕시코시티)'], ['America/Cancun', '킨타나로오 (칸쿤)'], ['America/Chihuahua', '치와와'], ['America/Hermosillo', '소노라'], ['America/Tijuana', '바하칼리포르니아 (티후아나)']],
    ID: [['Asia/Jakarta', '서부 (자카르타)'], ['Asia/Makassar', '중부 (발리 · 마카사르)'], ['Asia/Jayapura', '동부 (자야푸라)']],
    NZ: [['Pacific/Auckland', '본토 (오클랜드 · 웰링턴)'], ['Pacific/Chatham', '채텀 제도']],
    CL: [['America/Santiago', '본토 (산티아고)'], ['Pacific/Easter', '이스터섬']],
    PT: [['Europe/Lisbon', '본토 · 마데이라 (리스본)'], ['Atlantic/Azores', '아조레스']],
    ES: [['Europe/Madrid', '본토 (마드리드 · 바르셀로나)'], ['Atlantic/Canary', '카나리아 제도']],
    MN: [['Asia/Ulaanbaatar', '울란바토르'], ['Asia/Hovd', '호브드']],
    EC: [['America/Guayaquil', '본토 (키토 · 과야킬)'], ['Pacific/Galapagos', '갈라파고스']],
};
// a city typed in 위치 정보: its zone ({ tz }), the places that name goes by ({ choices: [{ tz, label }] }), or, one the
// app doesn't know, { askCountry: true } (then countryZones)
// (a city the user types, for someone: a name two places go by is always asked, whatever another row has; their own row's
// city never answers it)
export function cityChoices(p, text, name = '') {
    const tz = tzForCity(p, text, { typed: true, except: name });
    if (tz) return { tz };
    const twin = cityTwin(pkey(text));
    return twin ? { choices: twin[1].map(([z, label]) => ({ tz: z, label })) } : { askCountry: true };
}
// a country's zones to pick from: one, or (a country with many) each with the cities in it
export function countryZones(code) {
    const c = countryOf(code);
    if (!c) return [];
    if (COUNTRY_ZONES[c]) return COUNTRY_ZONES[c].map(([tz, label]) => ({ tz, label }));
    return COUNTRY_TZ[c] ? [{ tz: COUNTRY_TZ[c], label: COUNTRIES[c] || c }] : [];
}
export function tzForCity(p, text, { typed = false, except = '' } = {}) {
    const k = pkey(text);
    if (!k) return '';
    if (typed && cityTwin(k)) return '';
    // Manual text must match a whole saved name. "Berlin, New Hampshire" is not the saved Berlin.
    // Check every source together so two different places sharing an alias never pick the first one.
    const known = [...arr(p?.life?.weather?.cities).map(c => ({ tz: c.tz, names: [c.name, c.ko, ...arr(c.names)] })),
        ...arr(p?.where?.people).filter(r => !except || nameKey(r.name) !== nameKey(except)).map(r => ({ tz: r.tz, names: namesOf(r) }))];
    const saved = [...new Set(known.filter(r => r.names.some(n => pkey(n) === k)).map(r => realTz(r.tz)).filter(Boolean))];
    if (saved.length) return saved.length === 1 ? saved[0] : '';
    // (a name two places go by is asked: cityChoices)
    if (cityTwin(k)) return '';
    const explicit = realTz(text);
    if (explicit) return explicit;
    const z = ZONES.filter(t => pkey(t.split('/').pop().replace(/_/g, ' ')) === k);
    if (z.length) return z.length === 1 ? z[0] : '';
    return CITY_ZONES.find(([, names]) => names.some(n => pkey(n) === k))?.[0] || '';
}
// what 위치 정보 shows: the owner (where they live, the city they are in) and the others with how far their clock is
export function placeInfo(p) {
    // (a phone not made yet has no time: its hours by today's)
    const rows = p?.where?.people || [], own = whereOf(p, p?.owner), t = hm(p?.now) ? p.now : p?.making ? (hm(p.clockAt) ? p.clockAt : todayWall()) : '', base = ownerZone(p);
    const hours = tz => { if (!t || !base || !tz) return null; const a = zoneShift(t, base.tz, tz, yearOr(t, p.year)), d = dayGap(t.slice(0, 5), a.slice(0, 5)); return (d * 1440 + (Number(a.slice(6, 8)) * 60 + Number(a.slice(9, 11))) - (Number(t.slice(6, 8)) * 60 + Number(t.slice(9, 11)))) / 60; };
    return { owner: { name: p?.owner, lives: p?.lives || own?.lives || p?.country || '', livesManual: !!p?.livesManual, city: own?.city || base?.where || '', tz: own?.tz || base?.tz || '', cityManual: !!own?.manual?.city },
        people: rows.filter(x => x !== own && nameKey(x.name) !== nameKey(p?.owner)).map(x => ({ name: x.name, city: x.city || '', lives: x.lives || '', tz: x.tz || '', hours: hours(x.tz || COUNTRY_TZ[x.lives]), manual: !!x.manual?.city })),
        failed: !!p?.where?.failed, at: p?.where?.at || null };
}
const rowFor = (p, name) => { const r = whereOf(p, name); if (r) return r; const row = { name }; p.where = { ...(p.where || {}), at: p.where?.at || Date.now(), people: [...(p.where?.people || []), row] }; return row; };
// the owner's country, by hand (two letters: "DE")
export async function setOwnerLives(m, p, code) {
    const c = String(code || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) return;
    p.lives = c; p.livesManual = true;
    const r = rowFor(p, p.owner); r.lives = c; r.manual = { ...(r.manual || {}), lives: true };
    await saveMeta();
}
// someone's city, by hand: its zone found for it; neither the reading nor a reflection changes it after
// tz: the zone the user picked for it (cityChoices' choices, countryZones). Without one, a city the app can't place on its
// own throws, with what to ask: err.choices (which of the places that name goes by), or err.askCountry (which country)
export async function setPlaceCity(m, p, name, text, tz0 = '') {
    const city = line(text, 60);
    if (!city || !name) return;
    const tz = realTz(tz0) || tzForCity(p, city, { typed: true, except: name });
    if (!tz) {
        const c = cityChoices(p, city, name), err = new Error(c.choices ? '어느 도시인지 골라 주세요' : '어느 나라 도시인지 골라 주세요');
        if (c.choices) err.choices = c.choices; else err.askCountry = true;
        throw err;
    }
    const r = rowFor(p, name);
    Object.assign(r, { city, names: [city], tz, manual: { ...(r.manual || {}), city: true } });
    // (the country of a city typed by hand is not the reading's: unknown until read)
    delete r.local; delete r.in;
    if (p.where) p.where.removed = (p.where.removed || []).filter(k => k !== nameKey(name));
    await saveMeta();
}
// someone read wrong: off the list, and not read in again
export async function dropPlacePerson(m, p, name) {
    if (!name || nameKey(name) === nameKey(p.owner) || !p.where) return;
    p.where = { ...p.where, people: (p.where.people || []).filter(x => nameKey(x.name) !== nameKey(name)), removed: [...new Set([...(p.where.removed || []), nameKey(name)])] };
    await saveMeta();
}
// 위치 정보 asks "is this the owner?" for a name the reading gave both as the owner's and as someone's (p.where.ask): yes, it
// becomes the owner's name (its row goes, its name an aka of theirs, and stays so when read again); no, it stays someone else
export async function answerOwnerAsk(m, p, name, isOwner) {
    if (!name || !p.where) return;
    const k = nameKey(name);
    p.where.ask = arr(p.where.ask).filter(n => nameKey(n) !== k);
    if (!p.where.ask.length) delete p.where.ask;
    if (isOwner) {
        p.where.ownerSaid = [...new Set([...arr(p.where.ownerSaid), name])];
        p.where.people = (p.where.people || []).filter(r => nameKey(r.name) !== k);
        const own = whereOf(p, p.owner);
        if (own) own.aka = [...new Set([...arr(own.aka), name])].slice(0, 8);
    } else p.where.notOwner = [...new Set([...arr(p.where.notOwner), name])];
    await saveMeta();
}
// AI로 다시 읽기: the reading asked again now. all: everything anew, what was set by hand and the people taken off too;
// else what was set by hand stays. A failure leaves what is there
export async function rereadPlaces(m, p, { all = false } = {}) {
    const was = structuredClone({ where: p.where ?? null, lives: p.lives, livesManual: p.livesManual });
    if (all && p.where) { p.where = { ...p.where, people: (p.where.people || []).map(({ manual, ...x }) => x) }; delete p.where.removed; delete p.where.ownerSaid; delete p.where.notOwner; delete p.where.ask; delete p.livesManual; }
    try { await readWhere(m, p, { all }); }
    catch (err) { p.where = was.where ?? undefined; if (!was.where) delete p.where; p.lives = was.lives; if (was.livesManual) p.livesManual = true; throw err; }
    // (a phone not made yet: its year read again with it, unless the user or the old phone set it)
    if (p.making && !p.yearSet && !p.base) { delete p.year; delete p.noYear; ensureYear(m, p, nowAt(windowOf(m, null))); }
    await saveMeta();
    return placeInfo(p);
}
// the model's weather for a place the phone knows is another's (Busan for an owner in Seoul, the city the scene was just
// named as): not the owner's
function weatherElsewhere(p, w, named, m = null) {
    const place = w && typeof w === 'object' ? line(w.place, 60) : '';
    if (!place) return false;
    return sceneHome(p, place, m) === false || !!named && named.own === false && pkey(named.name) === pkey(place);
}
// the owner's status line as the weather app takes it: a place that is no city the phone knows ("Mara's room", "Gangnam ·
// cafe") leaves the app's own city as it is (the model's, else the one there); its sky, warmth and hour are the line's
function homeTracker(p, t, w, m = null) {
    if (!t || sceneZone(p, t.place, m)) return t;
    const city = line(w?.place, 60), here = p?.life?.weather?.here?.place;
    // (the model's city when it names one: an owner gone somewhere new, "Rome · hotel", is in Rome)
    // (a room, a home, a cafe is no city — "방" or "집" only as the word's end, so 방콕 is Bangkok; the owner's own city or a
    // saved one always is)
    const own = ownerZone(p), known = !!city && ([own?.where, ...(own?.names || [])].some(n => pkey(n) === pkey(city)) || !!cityAt(city, p?.life?.weather?.cities));
    const place = city && (known || !/\b(room|home|house|flat|apartment|dorm|place|cafe|office|kitchen|hotel)\b|(?:방|집)(?![가-힣])/i.test(city)) ? city : here || city;
    return place ? { ...t, place, city: place } : t;
}
// people other than the owner the reflection says are now in another city: their rows (where they live stays)
// (a person: one the phone knows, or a name these messages write as it is — never "everyone", "the courier")
const NOT_A_PERSON = /^(everyone|everybody|they|them|someone|somebody|people|friends|family|all|the\b.*|모두|다들|사람들|가족|친구들)$/i;
function peopleMoved(p, list, text = '', m = null) {
    let n = 0;
    // (by any name of theirs: the row's own, an aka, the 용어집 other form; one person, one row)
    const rowOf = name => { const who = personOf(p, m, name); return who ? (p?.where?.people || []).find(r => nameKey(r.name) === who.key) || whereOf(p, name) : undefined; };
    const known = new Set([...(p?.where?.people || []).flatMap(x => rowForms(m, x)), ...withTwins(m, [...(p?.contacts || []).map(x => x.name), ...(p?.threads || []).map(t => t.with)].filter(Boolean)).map(nameKey)]);
    const removed = new Set(p?.where?.removed || []);
    for (const c of arr(list).slice(0, 8)) {
        const name0 = line(c?.name, 60), tz = realTz(c?.tz), city = line(c?.city, 60);
        if (!name0 || !tz || !city || isOwnerName(p, m, name0) || NOT_A_PERSON.test(name0.trim())) continue;
        // (someone the phone doesn't know yet, as the model read them from the messages: a name, never a word like "someone")
        if (!known.has(nameKey(name0)) && !/^[\p{Lu}\p{Script=Hangul}]/u.test(name0)) continue;
        const was = rowOf(name0), name = was?.name || name0;
        // (no row of their own and a name two rows share, "Ivo" of Ivo Kim and Ivo Park: neither is moved, and no third row)
        if (!was) { const ks = withTwins(m, [name0]).map(nameKey), rows = p?.where?.people || []; if (rows.filter(r => rowForms(m, r).some(k => ks.includes(k)) || samePerson(r.name, name0)).length > 1) continue; }
        // (one the user took off, by any name of theirs, or whose city they set by hand, stays as they left it)
        if ((was ? rowForms(m, was) : withTwins(m, [name0]).map(nameKey)).some(k => removed.has(k)) || was?.manual?.city) continue;
        // (and the country that city is in, as the model gives it: none given, none kept from the city before)
        const row = { ...was, name, city, names: namesOf(c), tz };
        delete row.local; delete row.in; if (cc2(c?.in)) row.in = cc2(c.in);
        if (was && was.city === row.city && was.tz === row.tz) continue;
        p.where = { ...(p.where || {}), at: p.where?.at || Date.now(), people: [...(p.where?.people || []).filter(x => x !== was && nameKey(x.name) !== nameKey(name)), row] };
        n++;
    }
    return n > 0;
}
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
// a zone's person by every name of theirs (by: what a name given as it is matches), and the forms a text is searched for
// (rawBy: their own names; a 용어집 other form only when 용어집 marks them a person, "Rose = 장미" may be a flower)
const byOf = (m, names) => { const raw = names.filter(Boolean); return { by: withTwins(m, raw), rawBy: raw }; };
function placesAround(p, m = null) {
    const out = [], own = ownerZone(p);
    // (the owner's own place as the weather app has it is one of their names too: a zone known only by the country)
    if (own) out.push({ tz: own.tz, name: own.where, names: [own.where, ...own.names, p?.life?.weather?.here?.place], own: true, ...byOf(m, [p?.owner, ...arr(whereOf(p, p?.owner)?.aka)]) });
    for (const c of arr(p?.life?.weather?.cities)) if (c?.tz) out.push({ tz: c.tz, name: c.name, names: [c.name, c.ko] });
    for (const x of p?.where?.people || []) if (nameKey(x.name) !== nameKey(p.owner)) { const z = zoneOfWhere(x); if (z) out.push({ tz: z.tz, name: z.where, names: z.names, who: x.name, ...byOf(m, [x.name, ...arr(x.aka)]) }); }
    // another phone's owner: where that phone read them to be, else its own saved city or country
    for (const q of Object.values(phonesOf(m) || {})) if (q && q !== p && q.owner && !whereOf(p, q.owner)) { const z = ownerZone(q); if (z) out.push({ tz: z.tz, name: z.where, names: z.names, who: q.owner, ...byOf(m, [q.owner, ...arr(whereOf(q, q.owner)?.aka)]) }); }
    return out;
}
const tzFormat = new Map();
const wallOf = (tz, ms) => {
    let f = tzFormat.get(tz);
    if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); tzFormat.set(tz, f); }
    const g = f.formatToParts(new Date(ms)), k = n => Number(g.find(x => x.type === n)?.value);
    return Date.UTC(k('year'), k('month') - 1, k('day'), k('hour') % 24, k('minute'));
};
// every change of a zone's own offset in a year (a day at a time, then to the minute; a zone changes at most once a day),
// found once and kept
const zoneYears = new Map();
const wallText = ms => { const w = new Date(ms); return `${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())} ${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`; };
function zoneChanges(tz, year) {
    const key = `${tz}|${year}`;
    if (zoneYears.has(key)) return zoneYears.get(key);
    const MIN = 6e4, D = 864e5, off = ms => wallOf(tz, ms) - ms, out = [];
    try {
        for (let a = Date.UTC(year, 0, 1) - D, end = Date.UTC(year + 1, 0, 1) + D; a < end; a += D) {
            const o = off(a);
            if (o === off(a + D)) continue;
            let lo = a, hi = a + D;
            while (hi - lo > MIN) { const mid = lo + Math.max(1, Math.round((hi - lo) / MIN / 2)) * MIN; if (off(mid) === o) lo = mid; else hi = mid; }
            out.push(hi);
        }
    } catch { out.length = 0; }
    if (zoneYears.size > 400) zoneYears.clear();
    zoneYears.set(key, out);
    return out;
}
// every change of the hours between two zones: { ms, before, after, at } with "at" the owner's clock as it changes
// ("10-25 03:00→02:00", "03-29 02:00→03:00", or one time when only the other place's clock changes)
function dstYear(ownTz, tz, year) {
    const H = 36e5, MIN = 6e4, hrs = ms => (wallOf(tz, ms) - wallOf(ownTz, ms)) / H;
    return [...new Set([...zoneChanges(ownTz, year), ...zoneChanges(tz, year)])].sort((a, b) => a - b).flatMap(ms => {
        const before = hrs(ms - MIN), after = hrs(ms);
        if (before === after) return [];
        const was = wallText(wallOf(ownTz, ms - MIN) + MIN), is = wallText(wallOf(ownTz, ms));
        return [{ ms, before, after, at: was === is ? was : was.slice(0, 5) === is.slice(0, 5) ? `${was}→${is.slice(6)}` : `${was}→${is}` }];
    });
}
// a summer-time change within a week of the owner's time t (theirs or the other place's), as the hours now (h) read it:
// one that brought h ("before": the hours before it) or one that ends it ("from": the hours from it). The owner's time
// is read on their clock as written, as the hours are (a time a change skips or repeats reads as zoneShift reads it)
export function dstNear(t, ownTz, tz, year = new Date().getFullYear(), h = null) {
    const mt = /^(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(String(t || ''));
    if (!mt || !ownTz || !tz || ownTz === tz) return [];
    try {
        const y = Number(year), guess = Date.UTC(y, mt[1] - 1, mt[2], mt[3], mt[4]), W = 7 * 24 * 36e5;
        const now = guess - (wallOf(ownTz, guess) - guess), near = [...new Set([new Date(now - W).getUTCFullYear(), new Date(now + W).getUTCFullYear()])].flatMap(v => dstYear(ownTz, tz, v)).filter(x => x.ms > now - W && x.ms <= now + W);
        const seen = new Set(), list = near.filter(x => !seen.has(x.ms) && seen.add(x.ms)).sort((a, b) => a.ms - b.ms);
        const h0 = h ?? (wallOf(tz, now) - wallOf(ownTz, now)) / 36e5, past = [], ahead = [];
        // (from the hours now, back change by change and on change by change: two in a row stay in order)
        let cur = h0;
        for (const x of list.filter(x => x.ms <= now).reverse()) if (x.after === cur) { past.unshift({ at: x.at, hours: x.before, past: true }); cur = x.before; }
        cur = h0;
        for (const x of list.filter(x => x.ms > now)) if (x.before === cur) { ahead.push({ at: x.at, hours: x.after, past: false }); cur = x.after; }
        return [...past, ...ahead];
    } catch { return []; }
}
export function zonesOf(p, at = p?.now, m = null, { wholeYear = false } = {}) {
    const own = ownerZone(p), t = String(at || '');
    if (!own || !/^\d{2}-\d{2} \d{2}:\d{2}$/.test(t)) return null;
    const mins = v => { const [d, h] = [String(v).slice(0, 5), String(v).slice(6)]; return dayGap(t.slice(0, 5), d) * 1440 + Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5)); };
    const base = mins(t), hours = tz => (mins(zoneShift(t, own.tz, tz, yearOr(t, p.year))) - base) / 60, others = [];
    for (const z of placesAround(p, m).slice(1)) {
        const name = z.who || z.name;
        if (z.tz === own.tz || others.some(o => nameKey(o.name) === nameKey(name))) continue;
        // (wholeYear: a time that is no story time, today's: every change in the year, the hours from each)
        const year = yearOr(t, p.year) || new Date().getFullYear();
        const h = hours(z.tz), dst = wholeYear ? dstYear(own.tz, z.tz, year).map(x => ({ at: x.at, hours: x.after, past: false })) : dstNear(t, own.tz, z.tz, yearOr(t, p.year), h), more = dst.length ? { dst } : {};
        // (a place on the owner's hours now is no row, unless its hours change within the week: "0 hours (DST: +1 hour from …)")
        if (h || dst.length) others.push(z.who ? { name: z.who, where: z.name, hours: h, ...more } : { name: z.name, hours: h, ...more });
    }
    return others.some(o => o.hours || o.dst?.length) ? { own: { name: own.where, tz: own.tz }, at: t, others } : null;
}
// Display only: a person's city already labels that city's hours. Keep every person, and keep standalone cities
// unless saved city names/aliases and time zones agree. A shared offset, a partial name or a country is not a city match.
function clockRows(p, m, others) {
    const places = placesAround(p, m), zones = new Map();
    const zoneKey = tz => {
        if (!zones.has(tz)) {
            try { zones.set(tz, tz ? new Intl.DateTimeFormat('en', { timeZone: tz }).resolvedOptions().timeZone : ''); }
            catch { zones.set(tz, ''); }
        }
        return zones.get(tz);
    };
    const rows = others.map(row => {
        const person = 'where' in row;
        const sources = places.filter(x => !x.own && (person ? x.who === row.name && x.name === row.where : !x.who && x.name === row.name));
        const tz = zoneKey(sources[0]?.tz);
        // Conflicting saved locations must not silently choose one for display merging.
        const names = tz && sources.every(x => zoneKey(x.tz) === tz) ? sources.flatMap(x => x.names).map(pkey).filter(Boolean) : [];
        return { row, person, tz, names };
    });
    return rows.filter(city => city.person || !rows.some(person => person.person && person.row.hours === city.row.hours &&
        person.tz === city.tz && person.names.some(n => city.names.includes(n)))).map(x => x.row);
}
const hoursText = h => `${h > 0 ? '+' : ''}${h} hour${Math.abs(h) === 1 ? '' : 's'}`;
// what the model is told of them: it only adds or takes off the hours given (the code works them out)
// (a summer-time change within a week of the clock's time: the hours on its other side, and from when)
// quiet: the time is no story time, never shown. true: today's (a phone being made with no time and no day yet), the
// hours with every summer-time change in the year; 'day': a story day at noon, its changes near it as always
export const clockBlock = (p, at = p?.now, m = null, st = null, required = false, quiet = false) => {
    const z = zonesOf(p, at, m, { wholeYear: quiet === true }), holder = screenHolderOf(m);
    // Keep the same presence rule; the reflection's existing fallback can require this same format.
    if (!z && !holder && !required) return '';
    const label = v => /[\r\n]/.test(v) ? JSON.stringify(v) : v;
    const location = z?.own.name || ownerZone(p)?.where;
    const lines = ["[OWNER'S CLOCK]"];
    if (p?.owner) lines.push(`Phone owner: ${label(p.owner)}`);
    if (location) lines.push(`Location: ${label(location)}`);
    if (p?.now || required) lines.push(`Saved phone time: ${p?.now ? label(p.now) : 'unknown'}`);
    // Fills can use a story/status time instead of the saved phone time. Keep that reference distinct.
    if (z && z.at !== p?.now && !quiet) lines.push(`Clock reference time: ${z.at}`);
    if (holder) lines.push(`Default screen viewpoint: ${label(holder)}`);
    if (z) {
        lines.push('', `Time differences from ${label(location || "the owner's clock")}:`, ...clockRows(p, m, z.others).map(c =>
            `- ${label(c.name || 'Unnamed location')}${c.where ? ` (${label(c.where)})` : ''}: ${hoursText(c.hours)}${c.dst ? ` (DST: ${c.dst.map(d => `${hoursText(d.hours)} ${d.past ? 'before' : 'from'} ${d.at}`).join('; ')})` : ''}`));
        if (st?.known && st.at && st.at !== st.raw) lines.push(`The newest status line, ${st.raw} in ${st.city}, is ${st.at} here.`);
    }
    return lines.join('\n');
};
// 3.171.16 clock context for archive-only reflection; retained for event-local times and legacy now.
const archiveClockBlock = (p, at = p?.now, m = null, st = null) => {
    const z = zonesOf(p, at, m);
    const hrs = h => `${Math.abs(h)} hour${Math.abs(h) === 1 ? '' : 's'} ${h > 0 ? 'ahead' : 'behind'}`;
    return z && z.others.some(c => c.hours) ? `[OWNER'S CLOCK]\nThe owner is in ${z.own.name}, ${z.at} now.\n${z.others.filter(c => c.hours).map(c => (c.where ? `${c.name} (in ${c.where}) is ${hrs(c.hours)}` : `${c.name} is ${hrs(c.hours)}`)).join(', ')}.${st?.known && st.at && st.at !== st.raw ? `\nThe newest status line, ${st.raw} in ${st.city}, is ${st.at} here.` : ''}` : '';
};
// Reflection-only choices. Explicit dates stay as written; marked HTML clocks can carry a labelled fallback date.
// Keep the request's date order and locations in the choices, not mutable chat state after the call.
// at: the time the clock stands at (the request's own, as the hours above it): every choice is worked out from it too
export function reflectionClocks(p, rows, m = null, at = p?.now) {
    return withDateOrder(dateOrderOf(m), () => reflectionClocks0(p, rows, m, at));
}
// OWNER'S CLOCK, one for every request (a reflection, making a phone or its apps again, every app's fill): the hours to
// the other places and, from the newest message the request reads, the time choices, both from the same time (at)
// the same for every request (a reflection, an app's fill, making a phone or its apps again): the block, the phone's
// name, then the choices when there are any; all inside the block (a phone with no other place and no screen of its own
// gets the block's first lines, so the name never goes along with no block)
export function ownerClock(p, at, m = null, st = null, rows = [], { quiet = false } = {}) {
    const r = withDateOrderSync(dateOrderOf(m), () => reflectionClocks0(p, rows, m, at)), block = clockBlock(p, at, m, st, false, quiet);
    if (!r.identity) return block;
    return [block || clockBlock(p, at, m, null, true, quiet), r.identity, r.body].filter(Boolean).join('\n\n');
}
// the newest message a fill (or making a phone, or making its apps again) reads, for its time choices, as the request
// shows it: with TOLD SHORT, its last lines (one row each, in order); else the last message it reads word for word (with
// its HTML, as RECENT CHAT shows it: never a system message's, never one cut short)
// story: a request whose chat with no archive goes whole in place of the archive (sideRequest's story, making a phone):
// its newest message is never cut short there
export function fillClockRows(m, p, gap = null, short = null, { story = false } = {}) {
    if (short?.text) return String(short.text).split('\n').flatMap(l => { const mt = /^#(\d+) · /.exec(l); return mt ? [{ index: Number(mt[1]), text: l }] : []; });
    const upto = nowAt(gap), row = gap?.n ? syncRows().find(r => r.index === gap.to) : null;
    const text = row ? row.text : recentPhoneRows(1, { upto }).at(-1), index = row ? row.index : atOf(text);
    if (!text || !Number.isInteger(index)) return [];
    const msg = ctx().chat?.[index], full = phoneMessageText(text, index);
    const whole = row || full.length <= 6000 || story && noArchive(m);
    return [{ index, text, ...(msg && !msg.is_system && typeof msg.mes === 'string' && whole ? { clockSource: msg.mes } : {}) }];
}
export const fillClock = (m, p, at, st = null, gap = null, short = null, opts = {}) => ownerClock(p, at, m, st, fillClockRows(m, p, gap, short, opts), opts);
// Only the newest supplied message can provide conversion choices. If its clock is not
// recognized, leave time inference to the model instead of reviving an earlier message's clock.
// Within that message, use source position, not the largest date. Archive rows use supplied indices.
// (two rows with one number, two summaries of one message: the later one is the newer)
function latestClock(rows) {
    const r = arr(rows).reduce((a, b) => (!a || b.index >= a.index ? b : a), null);
    if (!r) return null;
    // only a clock the screen shows (an HTML time field, with its date or without): a date and a time in the story's text
    // may be any time (one remembered, one planned), so the model reads it from the story with OWNER'S CLOCK's hours
    const stamps = typeof r.clockSource === 'string' ? [...htmlDatedClocks(r.clockSource, { positions: true }), ...htmlClocks(r.clockSource, { positions: true })] : [];
    const latest = stamps.sort((a, b) => b.position - a.position)[0];
    if (!latest) return null;
    const { position, ...stamp } = latest;
    return { at: r.index, ...stamp };
}
function reflectionClocks0(p, rows, m, at = p?.now) {
    const own = ownerZone(p), choices = [], people = [], text = arr(rows).map(r => r.text).join('\n'), fallback = screenPerson(m, screenHolderOf(m))?.name || screenHolderOf(m);
    if (!own) return { choices, text: '' };
    for (const z of placesAround(p, m)) {
        const names = [...new Set((z.own ? [p.owner, 'owner', ...(z.by || [])] : z.who ? [z.who, ...(z.by || [])] : []).filter(Boolean))];
        if (!names.length || !z.own && !names.some(n => nameKey(n) === nameKey(fallback)) && !peopleTwins(m, [...new Set([z.who, ...arr(z.rawBy)].filter(Boolean))]).some(n => namedIn(text, n))) continue;
        if (people.some(x => x.names[0] === names[0])) continue;
        try { new Intl.DateTimeFormat('en', { timeZone: z.tz }); } catch { continue; }
        people.push({ names, tz: z.tz });
    }
    // The chosen fallback must not be displaced by the hint's six-person limit.
    people.sort((a, b) => Number(b.names.some(n => nameKey(n) === nameKey(fallback))) - Number(a.names.some(n => nameKey(n) === nameKey(fallback))));
    const defaultPerson = people.find(x => x.names.some(n => nameKey(n) === nameKey(fallback)));
    const defaultZone = defaultPerson?.tz;
    const identity = `Phone being updated: ${JSON.stringify(p.owner)} (${own.where}).${defaultZone === own.tz ? '\nThe default screen and this phone share a time zone; default screen times need no conversion.' : ''}`;
    let stamp = latestClock(rows);
    // (a 02-29 with no year of its own in a story year that has none: no such day)
    const leap = y => new Date(Date.UTC(y, 1, 29)).getUTCMonth() === 1, year0 = Number(yearIn(stamp?.sourceTime)) || Number(p.year);
    if (stamp?.local?.startsWith('02-29') && year0 && !leap(year0)) stamp = null;
    if (stamp) {
        // Both dated and bare clocks offer only the configured screen person when set.
        // An unresolved configured person is not evidence for a different person's screen.
        const candidates = fallback ? (defaultPerson ? [defaultPerson] : []) : people.slice(0, 6);
        for (const who of candidates) {
            if (stamp.clock) {
                const fallback = clockFallback({ ...p, now: at }, own.tz, who.tz, stamp.clock);
                if (fallback) {
                    const source = new Date(`${fallback.localYear}-${fallback.local.slice(0, 5)}T00:00:00Z`), owner = new Date(`${fallback.ownerYear}-${fallback.ownerTime.slice(0, 5)}T00:00:00Z`);
                    // A date-free source never becomes a dated answer choice. The dated calculation is only a reference.
                    choices.push({ ...stamp, names: who.names, date: null, reference: { date: fallback.assumedDate,
                        ownerClock: fallback.ownerTime.slice(6), dayShift: (owner - source) / 864e5,
                        localAnchor: fallback.localAnchor, earlier: fallback.rolled } });
                }
            } else choices.push({ ...stamp, names: who.names, ownerTime: zoneShift(stamp.local, who.tz, own.tz, yearOr(stamp.local, yearIn(stamp.sourceTime) || p.year)) });
        }
    }
    if (!choices.length) return { choices, identity, body: '', text: identity };
    const lines = [`${stamp.clock ? 'No date is shown; read the story to determine the date.\n\n' : '\n'}${choices.map(c => c.reference
            ? `On ${c.names[0]}'s clock → owner's clock: ${c.reference.ownerClock}${c.reference.dayShift ? ` (${c.reference.dayShift > 0 ? '+' : ''}${c.reference.dayShift} day${Math.abs(c.reference.dayShift) === 1 ? '' : 's'} relative to screen)` : ''}.`
            : `On ${c.names[0]}'s clock → owner's time: ${c.ownerTime}`).join('\n')}`];
    const body = `Time choices.\nTime alone does not identify the viewpoint.\nKeep the default viewpoint unless the surrounding narration shifts to another screen or scene.\n\nDate order: ${dateOrderOf(m) === 'dm' ? 'day.month' : 'month.day'}.\n${lines.join('\n')}`;
    return { choices, identity, body, text: `${identity}\n\n${clockBlock(p, at, m) ? '' : `${clockBlock(p, at, m, null, true)}\n\n`}${body}` };
}
const pkey = v => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
// a place that is someone's own: their name (or their first name) then 's · 의 · 네, or a room, a home after it
const OWNED = /^(?:'s|’s|s'|’|의|네|\s*(?:방|집|사무실|작업실|차)(?![가-힣])|\s+(?:room|bedroom|house|home|flat|apartment|place|office|studio|car)\b)/i;
function ownedBy(scene, name) {
    const s = String(scene || '').trim().toLowerCase(), full = String(name || '').trim().toLowerCase();
    return [...new Set([full, full.split(/\s+/)[0]])].some(n => n.length >= 2 && s.startsWith(n) && OWNED.test(s.slice(n.length)));
}
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
        // the whole scene only: another zone's city is never guessed from the start of a name ("New York Bagels, Gangnam")
        if (n === whole) return { tz: z.tz, name: z.name, own: !!z.own };
        // its first words, the first word, the Korean name it starts with, or the scene the start of a longer city name
        // ("New York City", "Frankfurt"): trusted only in the owner's own zone
        if (!part && (leads.has(n) || n === first || whole.startsWith(n) && n.length >= 2 && /^[가-힣]/.test(n) || whole.length >= 4 && n.startsWith(whole))) part = z;
    }
    // someone's own place ("Mara's room", "소망의 방", "렌네 집"): where that person is
    const zs = placesAround(p, m), by = zs.find(z => peopleTwins(m, arr(z.rawBy)).some(n => ownedBy(sc, n)));
    if (by) return { tz: by.tz, name: by.name, own: !!by.own || !!own && by.tz === own.tz && [own.where, ...(own.names || [])].some(n => pkey(n) && pkey(n) === pkey(by.name)) };
    // a city no one here is in, by its time zone's name ("Rome", "Tokyo"): the owner gone there, before a 반영 moves them
    if (!part && own) { const z = ZONES.find(x => pkey(x.split('/').pop().replace(/_/g, ' ')) === whole); if (z) return { tz: z, name: sc, own: z === own.tz, moved: z !== own.tz }; }
    return part && (!own || part.tz === own.tz) ? { tz: part.tz, name: part.name, own: !!part.own } : null;
}
// whose clock a status line's scene keeps: true the owner's, false another zone's, null unknown (on a phone that keeps
// other zones). A phone with no zone of its own, or no other zone around, is the owner's
export function sceneHome(p, place, m = null, named = null) {
    const own = ownerZone(p), z = sceneZone(p, place, m) || named;
    // a known city is the owner's only when it is in their own zone (Paris for an owner in Frankfurt is elsewhere, though
    // its clock reads the same)
    // (and another city in the same zone, Busan for an owner in Seoul, is elsewhere too: its hour is theirs, its weather
    // isn't; an owner known only by the country takes any city of their zone)
    if (own && z) return !!z.moved || z.tz === own.tz && (z.own === true || !own.names?.length);
    if (!own || !zonesOf(p, hm(p?.now) ? p.now : '01-01 12:00', m)?.others.some(o => o.hours)) return true;
    return null;
}
// the newest status line up to upto, on the owner's clock: at '' when its scene's zone is unknown (it may be someone
// else's hour). named: the zone the reflection gave for it this round. null with no dated status line
const hm = v => /^\d{2}-\d{2} \d{2}:\d{2}$/.test(String(v || ''));
const laterThan = (a, b) => { const g = dayGap(String(b).slice(0, 5), String(a).slice(0, 5)); return g > 0 || g === 0 && String(a).slice(6) > String(b).slice(6); };
// the same, never throwing (no status window: null): for a fill's OWNER'S CLOCK
export const statusAt = (p, upto = null, m = null) => { try { return statusMoment(p, upto, null, m); } catch { return null; } };
export function statusMoment(p, upto = null, named = null, m = null) {
    const t = recentTrackers(1, { visibleOnly: true, ...(upto == null ? {} : { chat: (ctx().chat || []).slice(0, upto + 1) }) })[0];
    const d = t?.date ? monthDay(t.date) : null;
    if (!t || !Number.isFinite(t.min) || !d) return null;
    const raw = `${pad(d.mo)}-${pad(d.d)} ${pad(Math.floor(t.min / 60))}:${pad(t.min % 60)}`, place = t.city || t.place || '', base = { raw, place, i: t.i };
    const home = sceneHome(p, place, m, named);
    if (home === true) { const z = sceneZone(p, place, m); return { ...base, at: raw, city: z?.moved ? z.name : ownerZone(p)?.where || '', home: true, known: true }; }
    if (home === null) return { ...base, at: '', home: false, known: false };
    const scene = sceneZone(p, place, m) || named;
    return { ...base, at: zoneShift(raw, scene.tz, ownerZone(p).tz, yearOr(raw, p.year)), city: scene.name, home: false, known: true };
}
// a city the reflection named for a status line: its zone (a saved city, someone's city, the owner's own)
function zoneNamed(p, name, m = null) {
    const own = ownerZone(p), ownNames = new Set([own?.where, ...(own?.names || [])].map(pkey).filter(Boolean));
    // the owner's when it is the owner's own place, or a city by one of the owner's city names in their zone (Seoul, not
    // Busan, for an owner in Seoul)
    const mine = (tz, city) => !!own && tz === own.tz && ownNames.has(pkey(city));
    // another city the model names ({ "city", "tz" }): its zone, for this round
    if (name && typeof name === 'object') { const tz = realTz(name.tz), city = line(name.city, 60); return tz ? { tz, name: city || tz, own: mine(tz, city) } : null; }
    const k = pkey(name);
    if (!k) return null;
    // ("owner", or the owner's own name)
    if ((k === 'owner' || k === pkey(p?.owner)) && own) return { tz: own.tz, name: own.where, own: true };
    const around = placesAround(p, m);
    for (const z of around) if (pkey(z.who) === k || z.names.some(n => pkey(n) === k)) return { tz: z.tz, name: z.name, own: !!z.own || mine(z.tz, z.name) };
    // a shorter name for a saved one ("New York" for "New York City"): only when every such city keeps one zone
    const lead = n => { const w = String(n || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean); return w.some((_, i) => w.slice(0, i + 1).join('') === k); };
    const hits = around.filter(z => z.names.some(lead));
    if (hits.length && hits.every(z => z.tz === hits[0].tz)) return { tz: hits[0].tz, name: hits[0].name, own: !!hits[0].own || mine(hits[0].tz, hits[0].name) };
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
${FILL_CLOCK_GET}
- EXISTING ACCOUNTS (sometimes): the accounts the bank already has.
- PEOPLE AROUND (sometimes): people in the owner's life, close or not, from the cards, persona, profile and lorebook, with where things stand now.

STORY OR INVENTED
- Trips, bookings, gifts and big purchases: only what the story shows or plainly implies. Give each the "ev" tag the phone's mail or event for it already has.
- Besides the story's, 2 to 4 passes already used in the past months, fitting the owner's life and tastes (a film, a match, a concert, an exhibition, a past trip's boarding pass or train ticket), dated before the story's now, "status": "used", with no "ev". Never one that contradicts the story. Coming bookings stay only the story's.
- Rent, wages, bills and subscriptions: invent them, fitting the owner's job and life, unless the story gives them.
- Besides the story's, 2 to 4 everyday online orders fitting the owner (household things, books, clothes), with no "ev".
- An amount the story gives stays as it is: whose it is, its currency, its date and what it was for. A company's value, a transfer or an old balance is not what the owner has in the bank now.
- Balances, last four digits, card expiry dates, everyday payments (coffee, groceries, transit), and amounts the story doesn't give: invent them, fitting the owner's life, job and country. The deposits together fall within FINANCIAL SCALE.
- Company money, family money and an inheritance still to come are not the owner's cash. Don't invent a trust or a restriction to explain a small balance.
- People (who money goes to or comes from): only people the story or PEOPLE AROUND has, or a shop, a landlord, an employer the owner's life plainly has.
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
${FILL_CLOCK}

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
               "date": "MM-DD", "time": "HH:MM", "seat", "gate", "no", "status", "made": [the fields made up to fit, like "no", "seat"], "ev" }],
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
${FILL_CLOCK_GET}
- PEOPLE AROUND (sometimes): people in the owner's life, close or not, from the cards, persona, profile and lorebook, with where things stand now.

RULES
- ${OWN_CLOCK}
${FILL_CLOCK}
- 3 or 4 memos, each at a moment the archive has where the owner could plausibly talk into their phone alone: after a fight, on the way somewhere, late at night. Not the days the diary already covers, where possible.
- Spoken, not written: the way the owner talks in the archive and chat, with pauses (…), restarts and half sentences. Not a diary entry.
- Only what the archive shows happened and what the owner felt about it; no new events, no new secrets.
- People: only people the story or PEOPLE AROUND has.
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
    const recent = recentPhoneText(6, { upto, maxChars: 6000 });
    if (read) read.gap = gap;
    const arch = archiveBlock(m, archiveFor(m, -1, upto).text || '(empty)', 'ARCHIVE', story, upto), chat = afterBlock(gap) || (recent && !(story && noArchive(m)) ? `[RECENT CHAT]\n${recent}` : '');
    const tales = [arch, world ? `[WORLD]\n${world}` : '', lore ? `[LOREBOOK]\n${lore}` : '', chat];
    const input = [...tales, yearBlock(m, ph, upto), `[OWNER]\n${owner}`, profileText, blindBlock(m, owner), ...blocks, namesBlock(m)].filter(Boolean).join('\n\n');
    // (the story part as it went in, for evidence: storyPart)
    return rememberStory(input, [...tales, profileText].filter(Boolean).join('\n\n'));
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
        passes: arr(raw.passes).map(x => withEv({ kind: pick(x?.kind, ['flight', 'train', 'hotel', 'event', 'other'], 'other'), by: line(x?.by, 60), from: line(x?.from, 40), to: line(x?.to, 40), date: when(x?.date).slice(0, 5), time: hhmm(x?.time), seat: line(x?.seat, 12), gate: line(x?.gate, 12), no: line(x?.no, 24), status: line(x?.status, 30), ...(madeOf(x).length ? { made: madeOf(x) } : {}) }, x)).filter(x => x.by).slice(-10),
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
export const prepareWealth = (m,p,refresh=false) => ensureWealth(m,p,()=>sideRequest(m,p.owner,[`[OWNER COUNTRY]\n${homeCountry(p)}`,`[ACCOUNT CURRENCIES]\n${JSON.stringify((p.money?.bank?.accounts || []).map(a=>a.currency))}`],{profile:p.financeProfile,money:true}),{refresh});
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
    const input = await sideRequest(m,p.owner,[`[PHONE NOW]\n${moneyContext(p, at)}`,fillClock(m, p, at, statusAt(p, nowAt(read.gap), m), read.gap),aroundBlock(p),preserved,wealthBlock(plan,'deposits'),`[EVALUATION DATE]\n${date}`,rates()],{profile:p.financeProfile,money:true,read});
    mark = readMark(read.gap) || mark;
    let correction='';
    for(let attempt=0;attempt<2;attempt++) {
        const out = await askDraft(input+'\n'+correction,{force:true,system,maxTokens:12000});
        const raw = jsonOf(out), next = parseMoney(raw, homeCountry(p));
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
                const input2 = await sideRequest(m, p.owner, [`[PHONE NOW]\n${moneyContext(p, at2)}`, fillClock(m, p, at2, statusAt(p, nowAt(two.cover), m), two.cover, two.short), aroundBlock(p), `[EXISTING ACCOUNTS]\n${JSON.stringify(p.money.bank.accounts)}`, `[EVALUATION DATE]\n${date}`, rates(),
                    `${soFarHead('MONEY', two.short, only)}\n${JSON.stringify(soFar)}`, two.short?.text || ''], { profile: p.financeProfile, money: true, read: { gap: two.cover } });
                const out2 = String(await askDraft(input2, { force: true, system: AI_SYS_MONEY, maxTokens: 12000 }) ?? ''), raw2 = jsonOf(out2);
                // an answer that isn't the JSON, or one cut off before its end: what it read isn't all there, so the mark
                // stays where the first turn stopped
                // (a line after the JSON is fine: it is the JSON itself that must be whole)
                const b2 = out2.lastIndexOf('}'), closed = (() => { try { JSON.parse(out2.slice(out2.indexOf('{'), b2 + 1)); return true; } catch { return false; } })();
                if (!raw2 || typeof raw2 !== 'object' || !closed) throw new Error('모델 답에서 은행 내용(JSON)을 끝까지 찾지 못했어요');
                if (p.money !== updated.money) throw new Error('생성 중 계좌가 변경됐어요');
                moneyMore(m, p, parseMoney({ ...raw2, currency: p.money.currency, bank: p.money.bank }, homeCountry(p)), tx);
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
    const out = await askDraft(await sideRequest(m, p.owner, [`[DIARY]\n${diary || '(none)'}`, fillClock(m, p, p.now, null, windowOf(m, p), null, { story: true }), aroundBlock(p)], {story:CHAT_TOKENS.apps,profile:p.financeProfile}), { force: true, system: AI_SYS_VOICES, maxTokens: 6000 });
    const memos = arr(jsonOf(out, { salvage: 'whole' })?.memos).map(x => ({ title: line(x?.title, 80), kt: line(x?.kt, 80), text: str(x?.text, 2000), ko: str(x?.ko, 2000), time: when(x?.time), sec: secOf(x?.sec), place: line(x?.place, 60), src: 'guess' })).filter(x => x.text);
    if (!memos.length) throw new Error('모델 답에서 음성 메모를 찾지 못했어요');
    // (one the story already put there, the same title at the same time, isn't written twice)
    const keptVoice = (p.voice || []).filter(x => x.src === 'story' || x.now);
    p.voice = [...keptVoice, ...fresh('voice', keptVoice, memos)].sort(byStory(p.now)).slice(-CAP.voice);
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
