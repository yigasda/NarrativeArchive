// 캐릭터 휴대폰 · 데이터: what the phone holds — the model's JSON cleaned and merged, the request (archive, lorebook, world),
// 롤플에 넣기, dates and times as the owner's phone shows them, and the places they have been.

import { ensureWealth, wealthBlock, wealthDate, wealthCheck, addWealthFX } from './wealth.js';
import { askDraft } from './ai.js';
import { ownerProfileBlock } from './phoneprofile.js';
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
import { applyMoney, investNow, moneyNow, replayEffects, revertEffects } from './phonesyncmoney.js';
import { pruneDropped, srcOf, addFrom, orphanOf, itemMark, edited, busy, exclusive, joinComments, realign, bodyMark, newSync, syncOf, makeMark, settleMarks, pickRound, unreadCount, addDone, settleRound, archiveRound, reachesEnd, quoted, journalAdd, journalRead, journalWrite } from './phonesync.js';

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
- ARCHIVE, RECENT CHAT, OWNER, COUNTRY, and sometimes WORLD and LOREBOOK.
- OWNER PROFILE (sometimes): the background selected for this phone's owner.

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
- People: only people the story has. A relationship word (girlfriend, ex, husband, boss) only if the archive uses it for them.
- Nothing later than the newest moment of the story.
- The diary holds only what the archive shows happened and what the owner felt about it; no new secrets, no new feelings.`;
const PHONE_STYLE = `LANGUAGE
- Each text is in the language its writer would really use on a phone: from their nationality and where they live; between two people, the language they share.
- A text that is not in Korean gets "ko": a natural Korean translation. A Korean text gets no "ko".
- People write the way they talk in the archive and chat. Texts are short, like real texts.

TIMES
"MM-DD HH:MM" (24-hour), in story time, from the archive's dates. "now" is the newest moment of the story.`;
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
A value the story does not give (a booking number, a seat, a price, an exact time) stays empty; never make one up.`;

export const AI_SYS_PHONE = `GOAL
Show what one character's phone holds right now, in a long role-play. The user opens it to peek at the story from the phone's side.
An app draws the screens from your JSON; you only write the content.

YOU GET
- ARCHIVE: the story so far, in sections (#numbers are chat messages), with the current state at the end.
- WORLD (sometimes): the shared setting.
- LOREBOOK (sometimes): setting notes the user picked.
- RECENT CHAT: the newest messages, after the archive.
- OWNER: whose phone it is.
- OWNER PROFILE (sometimes): the background the user chose for the owner.
- OWNER DOESN'T KNOW (sometimes): facts the owner does not know, or only suspects. Nothing on the phone may show them as known.

${PHONE_TEST}

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
6 mails, 5 diary entries. Fewer is fine; an empty list is fine.
Oldest first in every list.
${PHONE_LAST}`;

// 새로 일어난 일 반영: one round of unread messages at a time; each story event says where it comes from
export const AI_SYS_PHONE_UPDATE = `GOAL
Add to one character's phone what a few new chat messages put on it, in a long role-play. The user opens the phone to peek at the story from the phone's side.
An app adds your JSON to the phone; you only write what is new.

YOU GET
- NEW MESSAGES: the messages to read now, each with its number (#123).
- ARCHIVE FOR THESE MESSAGES (sometimes): summary sections covering them. They count as evidence, like the messages.
- ARCHIVE BEFORE (sometimes): what happened earlier. Background; nothing in it is new.
- STORY NOW (sometimes): where the story stands after these messages. Background.
- EVENTS ON THE PHONE: story events the phone already holds, with their ids.
- MONEY NOW and INVESTMENTS NOW (sometimes): the bank, card, orders, tickets and brokerage, with record ids. WEALTH (sometimes): how much the owner has.
- PHONE NOW: the newest of what the phone holds.
- OWNER, and sometimes WORLD, LOREBOOK, OWNER PROFILE and OWNER DOESN'T KNOW. Nothing on the phone may show what the owner doesn't know.

WHAT IS NEW
- Only what happens in NEW MESSAGES or ARCHIVE FOR THESE MESSAGES. Guesses and memories of earlier days add nothing.
- A plan made in these messages goes in the calendar; what is planned hasn't happened yet (no payment, no photo).
- Each message's own replies, orders and payments belong to the event in that message, not folded into an earlier one.
- An event in EVENTS ON THE PHONE keeps its id; add only what the phone doesn't hold yet.
- MESSAGES READ BEFORE, NOW CHANGED were already put on the phone: give their events the ids listed there; a payment in them is that same payment, its amount corrected if it changed.
- Small everyday things around an event are fine: how a text was worded, a photo of the place, a search they would make.
- People: only people the story has.

WHERE IT COMES FROM
- "at": the number of the message the event happens in. For an archive section, the message in its range it belongs to.
- "quote": a few words copied exactly as written in that message or section, not reworded.
- "date": the story's day it happens, "MM-DD"; "time" if known.

MONEY (only with MONEY NOW or INVESTMENTS NOW)
- A payment, transfer, refund, order, ticket or trade that happens in these messages goes in the event's "money".
- An amount the story gives stays as it is. A real one with no amount gets a plausible amount for the owner, the place and MONEY NOW: "amountFrom": "guess".
- A payment the scene plainly implies (eating out, a taxi ride) counts; one someone else may have paid does not. Never invent a payment the scene doesn't show or imply.
- Every move, trade and order says "occurrence": "new" when it happens in this message, "again" when the message only talks about one made before.
- Already in MONEY NOW or INVESTMENTS NOW: its id as "already"; it is not paid again.
- A card purchase goes on the card account; a refund is plus; paying the card off is a transfer from the bank.
- No money is made up to cover a payment; a balance may go below zero.
- A new paid order or ticket has its payment as a move in the same event.
- An order or ticket only moves forward. A cancelled order moves no money; if it was already paid, its refund is a plus move.

${PHONE_STYLE}

ANSWER — one JSON object, nothing else:
{ "now": "MM-DD HH:MM",
  "events": [{ "id": an id from EVENTS ON THE PHONE, or a short new tag like "berlin-flight", "at": 123, "quote": "exact words",
               "date": "MM-DD", "time": "HH:MM" or "", "summary": "one short line",
               "phone": { only the app items this event puts on the phone },
               "money": { "amountFrom": "story" | "guess",
                          "moves": [{ "account": a bank account's last 4 digits or "broker:EUR", "amount": minus for money out, "currency", "who", "ko", "memo", "kind": "card" | "transfer" | "deposit", "fee": a transfer fee charged on top of "amount", on the sending move, "occurrence": "new" | "again", "already": "" }],
                          "trades": [{ "kind": "buy" | "sell" | "dividend", "symbol", "name", "ko", "currency", "quantity", "price", "fee", "amount": dividend only, "occurrence": "new" | "again", "already": "" }],
                          "orders": [{ "shop", "item", "ko", "option", "qty", "price": unit price, "status": "ordered" | "shipped" | "on the way" | "delivered" | "cancelled" | "returned" | "refunded", "eta": "MM-DD", "gift", "paid": false only when someone else pays or it is paid on delivery, "occurrence": "new" | "again", "already": "" }],
                          "passes": [{ "kind": "flight" | "train" | "hotel" | "event" | "other", "by", "from", "to", "date": "MM-DD", "time", "seat", "gate", "no", "status", "already": "" }] } }] }
"money" only when money moves or an order or ticket changes. Numbers are plain JSON numbers.
Items in "phone":
{
${PHONE_ITEMS}
}
Fewer is fine. No new events: "events": [].
In "phone" items, a value the story does not give (a booking number, a seat, an exact time) stays empty; never make one up. Money amounts follow MONEY.`;

// ---- what the model sends back, cleaned: known keys only, text cut short, times in one shape
export const str = (v, n) => String(v ?? '').replace(/[ \t]+/g, ' ').trim().slice(0, n);
export const line = (v, n) => str(v, n).replace(/\s*\n\s*/g, ' ');
export const pad = x => String(x).padStart(2, '0');
export const when = v => {
    // "10-25 21:00", or with the year in front ("2026-10-25 21:00", "2026/10/25T21:00")
    const mt = String(v || '').match(/(?:^|\D)(?:\d{4}[-/.])?(\d{1,2})[-/.](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2}))?/);
    if (!mt || Number(mt[1]) > 12 || Number(mt[2]) > 31) return '';
    return `${pad(mt[1])}-${pad(mt[2])}${mt[3] ? ` ${pad(mt[3])}:${mt[4]}` : ''}`;
};
const hhmm = v => { const mt = String(v || '').match(/(\d{1,2}):(\d{2})/); return mt ? `${pad(mt[1])}:${mt[2]}` : ''; };
export const ko = v => line(v, 400);
export const arr = v => (Array.isArray(v) ? v : []);
export const pick = (v, list, dflt) => (list.includes(v) ? v : dflt);
// an event tag, kept only when given: items from the same story event share it (links between apps)
const evOf = v => line(v, 40).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
const withEv = (x, raw) => { const ev = evOf(raw?.ev); return ev ? { ...x, ev } : x; };

export function parsePhone(out) {
    const s = String(out || '').replace(/```(?:json)?/gi, '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('모델 답에서 폰 내용(JSON)을 찾지 못했어요');
    let raw;
    try { raw = JSON.parse(s.slice(a, b + 1)); } catch { throw new Error('모델 답의 JSON이 깨져 있어요. 다시 해 보세요'); }
    const msg = x => ({ from: line(x?.from, 40) || 'me', text: str(x?.text, 600), ko: ko(x?.ko), time: when(x?.time) });
    return {
        device: parseDevice(raw.device),
        country: /^[A-Z]{2}$/.test(String(raw.country || '').toUpperCase()) ? String(raw.country).toUpperCase() : '',
        wall: pick(raw.wallpaper, WALLS, ''),
        accent: pick(raw.accent, ACCENTS, ''),
        now: when(raw.now),
        contacts: arr(raw.contacts).map(x => ({ name: line(x?.name, 40), saved: line(x?.saved, 40) })).filter(x => x.name).slice(0, CAP.contacts),
        threads: arr(raw.threads).map(t => { const d = t?.draft && str(t.draft.text, 600); return { with: line(t?.with, 40), messages: arr(t?.messages).map(msg).filter(x => x.text), ...(d ? { draft: { text: d, ko: ko(t.draft.ko), time: when(t.draft.time), src: 'story' } } : {}) }; }).filter(t => t.with && t.messages.length).slice(0, CAP.threads),
        calls: arr(raw.calls).map(x => withEv({ with: line(x?.with, 40), type: pick(x?.type, ['in', 'out', 'missed'], 'in'), time: when(x?.time), min: Math.max(0, Math.min(600, Math.round(Number(x?.min) || 0))) }, x)).filter(x => x.with),
        photos: arr(raw.photos).map(x => withEv({ caption: line(x?.caption, 200), ko: ko(x?.ko), time: when(x?.time), mood: pick(x?.mood, MOODS, 'warm') }, x)).filter(x => x.caption),
        notes: arr(raw.notes).map(x => withEv({ title: line(x?.title, 80), kt: line(x?.kt, 80), text: str(x?.text, 1500), ko: str(x?.ko, 1500), time: when(x?.time) }, x)).filter(x => x.title || x.text),
        searches: arr(raw.searches).map(x => withEv({ q: line(x?.q, 120), ko: ko(x?.ko), time: when(x?.time), ...(x?.tab ? { tab: true } : {}), ...(x?.mark ? { mark: true } : {}) }, x)).filter(x => x.q),
        events: arr(raw.events).map(x => withEv({ title: line(x?.title, 80), ko: ko(x?.ko), date: when(x?.date).slice(0, 5), time: hhmm(x?.time) }, x)).filter(x => x.title && x.date),
        profile: raw.profile && typeof raw.profile === 'object' ? { handle: line(raw.profile.handle, 40), bio: line(raw.profile.bio, 200), ko: ko(raw.profile.ko), followers: Math.max(0, Math.round(Number(raw.profile.followers) || 0)), following: Math.max(0, Math.round(Number(raw.profile.following) || 0)) } : null,
        posts: arr(raw.posts).map(x => withEv({ text: str(x?.text, 800), ko: str(x?.ko, 800), photo: line(x?.photo, 200), pko: ko(x?.pko), time: when(x?.time), likes: Math.max(0, Math.min(99999, Math.round(Number(x?.likes) || 0))),
            comments: arr(x?.comments).map(c => ({ from: line(c?.from, 40), text: line(c?.text, 300), ko: ko(c?.ko) })).filter(c => c.from && c.text).slice(0, CAP.comments) }, x)).filter(x => x.text || x.photo),
        mails: arr(raw.mails).map(x => withEv({ from: line(x?.from, 60), subject: line(x?.subject, 120), ks: line(x?.ks, 120), text: str(x?.text, 2000), ko: str(x?.ko, 2000), time: when(x?.time), unread: !!x?.unread }, x)).filter(x => x.from && (x.subject || x.text)),
        diary: arr(raw.diary).map(x => withEv({ date: when(x?.date).slice(0, 5), title: line(x?.title, 80), kt: line(x?.kt, 80), text: str(x?.text, 2000), ko: str(x?.ko, 2000) }, x)).filter(x => x.date && x.text),
        voice: arr(raw.voice).map(x => withEv({ title: line(x?.title, 80), kt: line(x?.kt, 80), text: str(x?.text, 2000), ko: str(x?.ko, 2000), time: when(x?.time), sec: Math.max(3, Math.min(900, Math.round(Number(x?.sec) || 30))), place: line(x?.place, 60), src: 'story' }, x)).filter(x => x.text),
    };
}

// what makes two items the same, list by list: an update that repeats what the phone holds adds nothing
const SIG = {
    msg: x => [nameKey(x.from), x.text, x.time], calls: x => [nameKey(x.with), x.type, x.time], photos: x => [x.caption, x.time],
    notes: x => [x.title, x.text], searches: x => [x.q, x.time], events: x => [x.title, x.date, x.time], posts: x => [x.text, x.photo, x.time],
    mails: x => [x.from, x.subject, x.time], diary: x => [x.date, x.title, x.text], voice: x => [x.title, x.time],
};
const sigOf = (k, x) => JSON.stringify(SIG[k](x)).toLowerCase();
const fresh = (k, old, add) => { const seen = new Set(old.map(x => sigOf(k, x))); return add.filter(x => !seen.has(sigOf(k, x)) && seen.add(sigOf(k, x))); };
// an update's new items go after the old ones; every list keeps its newest, the threads the ones written in last
// every record gets the app's own id (not the model's): links between apps point at it, and it survives trimming and 다시 만들기.
// Phones saved before ids get theirs when next opened or made
const newId = () => Math.random().toString(36).slice(2, 8);
export function ensureIds(p) {
    let n = 0;
    const mo = p?.money;
    for (const xs of [...[...LISTS, 'threads', 'contacts'].map(k => p?.[k]), mo?.tx, mo?.passes, mo?.orders, mo?.bank?.accounts]) for (const x of xs || []) if (x && typeof x === 'object' && !x.id) { x.id = newId(); n++; }
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
    for (const t of add.threads) {
        const old = p.threads.find(x => nameKey(x.with) === nameKey(t.with));
        if (old) { old.messages = keep([...old.messages, ...fresh('msg', old.messages, t.messages)], CAP.messages); if (t.draft) old.draft = t.draft; }
        else p.threads.push({ ...t, messages: keep(fresh('msg', [], t.messages), CAP.messages) });
    }
    p.threads = keep([...p.threads].sort((a, b) => lastTime(a).localeCompare(lastTime(b))), CAP.threads);
    joinComments(p.posts, add.posts, CAP.comments);
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
const lastEnd = m => Math.max(-1, ...parseSections(String(m.text || '')).filter(s => !s.group).map(secEnd));
const ARCHIVE_MAX = 120_000; // characters: the state at the end, and as many of the newest sections as fit
function archiveFor(m, after = -1) {
    const [body, tail] = splitTail(String(m.text || ''));
    const secs = parseSections(body).filter(s => !s.group && (after < 0 || secEnd(s) > after));
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
function phoneRequest(m, owner, p = null, lore = '', only = null, profile = '') {
    const world = worldText(m);
    const recent = recentForCheck(6).join('\n\n').slice(-6000);
    const ar = archiveFor(m, p ? p.upto ?? -1 : -1);
    const now = p ? JSON.stringify(phoneForModel(p)) : '';
    return [
        p ? `[PHONE NOW]\n${now}` : '',
        !p && m.phones?.[nameKey(owner)]?.device ? `[DEVICE — locked]\n${JSON.stringify(m.phones[nameKey(owner)].device)}` : '',
        `[ARCHIVE${p ? ' — the sections since PHONE NOW' : ''}]\n${ar.text || '(nothing new)'}`,
        world ? `[WORLD]\n${world}` : '',
        lore ? `[LOREBOOK]\n${lore}` : '',
        recent ? `[RECENT CHAT]\n${recent}` : '',
        `[OWNER]\n${owner}`,
        profile, blindBlock(m, owner),
        namesBlock(m),
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
});

// apps: some of REMAKE's names, made again from the whole story while the rest of the phone stays as it is
export async function makePhone(m, owner, { update = false, apps = null } = {}) {
    const key = nameKey(owner);
    if (update && m.phones?.[key]) return updatePhone(m, owner);
    if (busy.sync || busy.fill) throw new Error('다른 폰 작업이 끝난 뒤 다시 해 주세요');
    // reading starts after the last message there was when this was asked; what comes in while it writes stays unread
    const mark = markNow();
    const old = update ? m.phones?.[key] : null;
    const part = apps && m.phones?.[key] ? apps.flatMap(a => REMAKE[a] || []) : null;
    const binding=structuredClone(m.phones?.[key]?.financeProfile || m.phoneProfiles?.[key]);
    const out = await askDraft(phoneRequest(m, owner, old, await loreFor(m, owner), part, await ownerProfileBlock(ctx(),binding,owner)), { system: old ? AI_SYS_PHONE_UPDATE : AI_SYS_PHONE, maxTokens: 16000 });
    if(JSON.stringify(binding)!==JSON.stringify(m.phones?.[key]?.financeProfile || m.phoneProfiles?.[key])) throw new Error('생성 중 연결한 인물 정보가 변경됐어요. 다시 시도해 주세요');
    const got = parsePhone(out);
    m.phones = m.phones && typeof m.phones === 'object' ? m.phones : {};
    if (part) {
        const p = m.phones[key];
        const was = Object.fromEntries(part.map(k => [k, p[k]]));
        for (const k of part) p[k] = k === 'profile' ? (got.profile || p.profile) : [];
        mergePhone(p, { ...got, ...Object.fromEntries([...LISTS, 'threads', 'contacts'].filter(k => !part.includes(k)).map(k => [k, []])), profile: null, now: '' });
        for (const k of part) if (k !== 'profile') carryOver(k, was[k], p[k]);
        ensureIds(p);
        p.at = Date.now();
        await saveMeta();
        if (p.inject) applyInjection();
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
        if (binding) base.financeProfile = structuredClone(binding);
        // the phone's own apps start reading again from here; the bank and investment keep their marks
        base.sync = newSync(phoneChatScope(ctx()));
        base.sync.marks.base = mark;
        for (const g of ['money', 'invest']) if (was?.sync?.marks?.[g]) base.sync.marks[g] = was.sync.marks[g];
        m.phones[key] = mergePhone(base, got);
    }
    const p = m.phones[key];
    if(m.phoneProfiles) delete m.phoneProfiles[key];
    ensureIds(p);
    p.upto = lastEnd(m);
    p.at = Date.now();
    await saveMeta();
    if (p.inject) applyInjection();
    return p;
}

// ---- 새로 일어난 일 반영
// every message the phone may read, numbered (system messages and offstage ones left out)
export const syncRows = () => chatRows().filter(r => !r.hidden).map(({ index, text }) => ({ index, text }));
export const markNow = () => { const rows = syncRows(); return makeMark(ctx().chat || [], rows.length ? rows[rows.length - 1].index : -1); };
export const markAfter = index => makeMark(ctx().chat || [], index);
// 'ok', 'none' (no start yet: an older phone) or 'lost' (its message is gone or now matches twice)
export function syncState(p) {
    if (!p?.sync?.marks?.base) return 'none';
    // the bank's and the investment's starts move with a deleted message too; one that can't be found again stays put
    if (settleMarks(p.sync, ctx().chat || [], ['base', ...['money', 'invest'].filter(g => p.sync.marks[g])]).includes('base')) return 'lost';
    p.sync.scope = phoneChatScope(ctx());
    return 'ok';
}
// counted on a copy: what changed since the last round is left for the round itself to see
export const syncLeft = p => { if (!p?.sync?.marks?.base) return null; const s = structuredClone(p.sync); realign(s, chatRows()); return unreadCount(s, syncRows()); };
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
    for (const k of LISTS) for (const a of add[k] || []) tag(k, (p[k] || []).find(x => sigOf(k, x) === sigOf(k, a)), a);
    for (const t of add.threads || []) { const own = p.threads.find(x => nameKey(x.with) === nameKey(t.with)); for (const a of t.messages) tag('msg', own?.messages.find(x => sigOf('msg', x) === sigOf('msg', a)), a); }
    for (const a of add.posts || []) {
        const own = (p.posts || []).find(o => o.text && o.text === a.text || o.photo && o.photo === a.photo && o.time === a.time);
        for (const c of a.comments || []) tag('comment', own?.comments?.find(x => ckey(x) === ckey(c)), c);
    }
}
const APP_NAME = { threads: '문자', contacts: '연락처', calls: '통화', photos: '사진', notes: '메모', searches: '검색', events: '캘린더', posts: 'SNS', mails: '메일', diary: '일기', voice: '음성 메모' };
async function updatePhone(m, owner) {
    return exclusive('sync', async () => {
        const key = nameKey(owner), p = m.phones[key], scope = phoneChatScope(ctx());
        if (syncState(p) !== 'ok') { const e = new Error('먼저 반영 시작 위치를 골라 주세요'); e.code = 'SYNC_PICK'; throw e; }
        const s = p.sync, swiped = [];
        // a read message edited or swiped since: if the last round read it, that round is undone and read again;
        // an older round's items stay, and the changed message is simply read again
        let moved = realign(s, chatRows());
        settleDropped(p, moved, swiped);
        renumber(m, p, moved);
        // an edit or swipe of a message the last round read: that round is undone (what can be) and read again
        if (moved.changed.some(x => p.syncUndo?.readFp?.includes(x.fp)) && canUndo(p)) {
            const kept = await undoRound(m, p);
            moved = realign(s, chatRows());
            renumber(m, p, moved);
            swiped.push('읽은 대화가 바뀌어서 지난 반영을 되돌리고 다시 읽었어요', ...kept.map(x => `${x}: 그 뒤 기록과 이어져 있거나 직접 바꾼 거라 남겨뒀어요`));
        }
        // an older message changed: read again, tied to the events it already gave (no new payment from it)
        const reread = new Map(moved.changed.map(x => [x.at, Object.entries(s.events).filter(([, e]) => e.at === x.at).map(([id, e]) => ({ id, summary: e.summary }))]));
        if (reread.size) swiped.push(`바뀐 대화 ${reread.size}개를 다시 읽어요. 그 대화의 결제는 새로 넣지 않고 기존 기록만 고쳐요`);
        const rows = syncRows(), round = pickRound(s, rows);
        if (!round.rows.length) { p.syncLast = { checked: 0, remaining: 0, apps: [], failed: [], notes: swiped, at: Date.now() }; await saveMeta(); return p; }
        // the archive: sections covering this round are evidence; earlier ones are background; ones reaching unread messages stay out
        const [body, tail] = splitTail(String(m.text || ''));
        const sections = parseSections(body).filter(x => !x.group && RANGE_HEAD.test(x.title)).map(x => { const mt = x.title.match(RANGE_HEAD); return { key: `${mt[2]}-${mt[4]}:${x.title.length}`, first: Number(mt[2]), last: Number(mt[4]), text: body.slice(x.start, x.end).trim() }; });
        const { evidence, background } = archiveRound(s, sections, rows, round.rows);
        const before = [];
        for (let i = background.length - 1, size = 0; i >= 0 && size + background[i].text.length <= ARCHIVE_MAX; i--) { before.unshift(background[i].text); size += background[i].text.length; }
        const known = Object.entries(s.events).slice(-40).map(([id, e]) => `- ${id}: ${e.summary} (#${e.at})`).join('\n');
        const world = worldText(m), lore = await loreFor(m, owner), profile = await ownerProfileBlock(ctx(), p.financeProfile, owner, { money: !!(p.money || p.investment) });
        if (p.money) migrateBank(m, p);
        const money = moneyNow(p), invest = investNow(m, p);
        const year = (wealthDate(m, p) || String(p.money?.asOf || p.investment?.date || '')).slice(0, 4) || String(new Date().getFullYear());
        const input = [
            `[NEW MESSAGES]\n${round.rows.map(r => r.text).join('\n\n')}`,
            evidence.length ? `[ARCHIVE FOR THESE MESSAGES]\n${evidence.map(x => x.text).join('\n\n')}` : '',
            before.length ? `[ARCHIVE BEFORE]\n${before.join('\n\n')}` : '',
            reachesEnd(s, rows, round.rows) && tail.trim() ? `[STORY NOW]\n${tail.trim()}` : '',
            `[EVENTS ON THE PHONE]\n${known || '(none yet)'}`,
            reread.size ? `[MESSAGES READ BEFORE, NOW CHANGED]\n${[...reread].map(([at, evs]) => `- #${at}: ${evs.length ? evs.map(e => `${e.id} (${e.summary})`).join('; ') : 'nothing on the phone yet'}`).join('\n')}` : '',
            `[PHONE NOW]\n${JSON.stringify(phoneForModel(p))}`,
            money ? `[MONEY NOW]\n${JSON.stringify(money)}` : '', invest ? `[INVESTMENTS NOW]\n${JSON.stringify(invest)}` : '',
            (money || invest) && p.wealthPlan ? `[WEALTH]\n${JSON.stringify({ currency: p.wealthPlan.currency, deposits: p.wealthPlan.deposits, investments: p.wealthPlan.investments, basis: p.wealthPlan.basis })}` : '',
            world ? `[WORLD]\n${world}` : '', lore ? `[LOREBOOK]\n${lore}` : '',
            `[OWNER]\n${owner}`, profile, blindBlock(m, owner), namesBlock(m),
        ].filter(Boolean).join('\n\n');
        const made = { money: p.money?.at, invest: p.investment?.at };
        // low thinking: tested against medium on Vertex, the same payments, ids and amounts, without the thinking cost
        const out = await askDraft(input, { system: AI_SYS_PHONE_UPDATE, maxTokens: 16000, effort: 'low' });
        // the answer is for the chat and messages it was asked about
        if (phoneChatScope(ctx()) !== scope || m.phones?.[key] !== p) throw new Error('반영하는 사이 채팅이나 폰이 바뀌었어요. 다시 해 주세요');
        if (p.money?.at !== made.money || p.investment?.at !== made.invest) throw new Error('반영하는 사이 은행이나 투자가 새로 만들어졌어요. 다시 해 주세요');
        const nowText = new Map(syncRows().map(r => [r.index, r.text]));
        if (round.rows.some(r => nowText.get(r.index) !== r.text)) throw new Error('반영하는 사이 대화가 바뀌었어요. 다시 해 주세요');
        const raw = jsonOf(out);
        if (!raw || !Array.isArray(raw.events)) throw new Error('모델 답에서 반영할 내용을 찾지 못했어요. 다시 해 주세요');
        const inRound = new Set(round.rows.map(r => r.index)), textAt = new Map(round.rows.map(r => [r.index, r.text])), start = s.marks.base.index;
        const rid = Math.random().toString(36).slice(2, 10), rowText = new Map(rows.map(r => [r.index, r.text]));
        const failed = {}, loose = [], added = [], apps = new Set(), changes = [], notes = [...swiped];
        // for 되돌리기: what was there before this round (ids and message counts), and the reading state
        const had = new Set(ITEM_KEYS.flatMap(k => (p[k] || []).map(x => x.id)).filter(Boolean)), msgs = new Map(p.threads.map(t => [t.id, t.messages.length]));
        const undo = { sync: structuredClone({ done: s.done, failed: s.failed, arch: s.arch, events: s.events, seen: s.seen }), now: p.now, moneyAt: p.money?.at, investAt: p.investment?.at,
            comments: (p.posts || []).filter(x => x.id).map(x => [x.id, x.comments?.length || 0]) };
        for (const e of raw.events.slice(0, 40)) {
            const at = Number(e?.at), sec = evidence.find(x => at >= x.first && at <= x.last);
            const fail = why => (inRound.has(at) ? (failed[at] ||= why) : loose.push(why));
            if (!Number.isInteger(at) || at <= start || (!inRound.has(at) && !sec)) { fail('읽는 범위 밖의 일이에요'); continue; }
            if (!quoted(e.quote, textAt.get(at) || '') && !(sec && quoted(e.quote, sec.text))) { fail('원문에서 근거를 찾지 못했어요'); continue; }
            let add;
            const day = when(e.date).slice(0, 5), phone = e.phone && typeof e.phone === 'object' ? structuredClone(e.phone) : {};
            // a time without its day ("15:10") takes the event's day
            const dated = x => { if (x && typeof x === 'object' && /^\s*\d{1,2}:\d{2}\s*$/.test(String(x.time || '')) && day) x.time = `${day} ${hhmm(x.time)}`; };
            for (const k of [...LISTS, 'threads']) for (const x of arr(phone[k])) { dated(x); for (const msg of arr(x?.messages)) dated(msg); if (x?.draft) dated(x.draft); }
            try { add = parsePhone(JSON.stringify(phone)); } catch { fail('앱 내용 형식이 잘못됐어요'); continue; }
            const id = evOf(e.id) || evOf(e.summary) || `ev-${at}`;
            // a changed message already put its payments on the phone: only its own events may correct them
            if (reread.has(at) && e.money && !reread.get(at).some(x => x.id === id)) { notes.push(`#${at} 바뀐 대화의 결제는 새로 넣지 않았어요`); delete e.money; }
            // the money first, on its own: a payment that can't be placed leaves the whole event out
            const stage = structuredClone({ money: p.money, investment: p.investment, finance: m.finance });
            let paid;
            try { paid = applyMoney(m, p, { id, at, date: when(e.date).slice(0, 5), time: hhmm(e.time), summary: line(e.summary, 160), money: e.money }, { year, marks: s.marks, legs: s.events[id]?.legs || [], span: s.failed[at]?.span || null, edited: reread.has(at) }); }
            catch (err) { p.money = stage.money; p.investment = stage.investment; m.finance = stage.finance; fail(String(err?.message || err)); continue; }
            for (const c of paid.changes) { apps.add(c.app); if (c.amount !== null) changes.push({ ...c, what: line(e.summary, 60) }); }
            notes.push(...paid.notes);
            for (const k of LISTS) for (const x of add[k]) x.ev ||= id;
            for (const t of add.threads) for (const x of t.messages) x.ev ||= id;
            const was = sizes(p);
            mergePhone(p, { ...add, device: null, now: '' }, { keepAll: true });
            // this message (its number and words) is a source of each item, new or already there
            tagItems(p, add, srcOf(at, bodyMark(rowText.get(at) || ''), rid));
            const got = sizes(p);
            for (const k of ITEM_KEYS) if (got[k] !== was[k]) apps.add(APP_NAME[k]);
            if (add.profile?.handle || add.profile?.bio) apps.add('SNS');
            s.events[id] = { at, quote: line(e.quote, 200), summary: line(e.summary, 160), effects: [...(s.events[id]?.effects || []), ...paid.effects], ...(paid.legs.length || s.events[id]?.legs ? { legs: [...(s.events[id]?.legs || []), ...paid.legs.filter(l => !(s.events[id]?.legs || []).some(o => o.key === l.key))] } : {}) };
            added.push({ id, at, add, effects: paid.effects });
        }
        // read: this round's messages; a failed one gets one more try next round, then it is skipped
        // a failed event can carry what later messages said (a reply, an order): the messages that got nothing this round
        // are read once more with it, so that content isn't lost
        settleRound(s, round.rows, failed, new Set(added.map(x => x.at)));
        for (const x of evidence) s.arch[x.key] = 1;
        const nowAt = when(raw.now);
        if (nowAt && nowAt > (p.now || '')) p.now = nowAt;
        // after the clock moves: the card's month is counted up to the story's now
        if (p.money) migrateBank(m, p);
        const id = rid;
        s.rounds = [...(s.rounds || []).slice(-19), id];
        p.syncLast = { checked: inRound.size, remaining: unreadCount(s, rows), apps: [...apps], failed: [...Object.entries(failed).map(([at, why]) => ({ at: Number(at), why, skipped: s.failed[at]?.tries >= 2 })), ...loose.map(why => ({ at: null, why }))], changes, notes, at: Date.now() };
        ensureIds(p);
        p.at = Date.now();
        pruneDropped(s, phoneItems(p));
        p.syncLast.notes = p.syncLast.notes.filter(n => !n.endsWith('뺄 수 있어요') || s.dropped.some(d => n.startsWith(`대화 ${d.label}가`)));
        p.syncUndo = { ...undo, round: id, read: [...inRound], readFp: round.rows.map(r => bodyMark(r.text)), comments: undo.comments,
            items: ITEM_KEYS.flatMap(k => (p[k] || []).filter(x => x.id && !had.has(x.id)).map(x => [k, x.id])),
            msgs: p.threads.filter(t => msgs.has(t.id) && t.messages.length > msgs.get(t.id)).map(t => [t.id, t.messages.slice(msgs.get(t.id)).map(x => JSON.stringify([x.from, x.text, x.time]))]),
            effects: added.flatMap(x => x.effects || []), byEvent: added.map(x => [x.id, x.effects || []]) };
        // kept in this browser until the saved chat shows it: 복구 can add it back if the save didn't land
        journalAdd(scope, { round: id, owner, at: Date.now(), events: added, done: [...inRound], seen: round.rows.map(r => [r.index, bodyMark(r.text)]), failed: Object.fromEntries([...inRound].filter(i => s.failed[i]).map(i => [i, s.failed[i]])), arch: evidence.map(x => x.key) });
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
            s.events[e.id] ||= { at: e.at, quote: '', summary: e.id };
        }
        addDone(s, r.done);
        s.seen ||= {};
        for (const [i, f] of r.seen || []) s.seen[i] = f;
        for (const [i, f] of Object.entries(r.failed || {})) s.failed[i] = f;
        for (const k of r.arch || []) s.arch[k] = 1;
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
    pruneDropped(s, phoneItems(p));
    const d = s.dropped[k];
    if (!d) return { gone: 0, items: 0, kept: [] };
    const kept = [], stay = new Set(), out = new Set();
    let gone = 0;
    for (const id of d.events) {
        const e = s.events[id];
        if (!e || e.at !== null) continue;
        const made = new Set((e.effects || []).filter(x => x.type === 'push' || x.type === 'entry').map(x => x.item?.id ?? x.id));
        // built on later: another event changed, corrected or counted one of its records as its own
        let tied = Object.entries(s.events).some(([o, x]) => o !== id && ((x.effects || []).some(y => ['status', 'amend', 'amendEntry'].includes(y.type) && made.has(y.id)) || (x.legs || []).some(l => l.state === 'included' && made.has(l.rec))));
        const trades = new Set((e.effects || []).filter(x => x.path === 'investment.trades').map(x => x.item.id));
        if (!tied && trades.size) { try { positions((p.investment?.trades || []).filter(t => !trades.has(t.id))); } catch { tied = true; } }
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
    for (const x of p.posts || []) if (x.comments) x.comments = x.comments.filter(keep('comment'));
    s.dropped.splice(k, 1);
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
    for (const r of [...(p.money?.tx || []), ...(p.money?.orders || []), ...(p.money?.passes || []), ...(p.investment?.trades || [])]) if (r.sourceIndex !== undefined) r.sourceIndex = to(r.sourceIndex);
    for (const a of Object.values(m.finance?.accounts || {})) if (a.owner === p.owner) for (const x of Object.values(a.entries)) if (x.sourceIndex !== undefined) x.sourceIndex = to(x.sourceIndex);
}
// 되돌리기: the last round only. What it added goes by its ids, its money comes back out, and those messages are unread again.
// Something the user changed since stays as it is; a bank or investment made again since can't be undone this way.
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
    for (const [pid, n] of u.comments || []) { const x = (p.posts || []).find(y => y.id === pid); if (x?.comments?.length > n) x.comments = x.comments.slice(0, n); }
    // items that were there before the round forget it as a source
    for (const { x } of phoneItems(p)) if (x.froms) x.froms = x.froms.filter(f => f.r !== u.round);
    // what can't be put back (changed since, or built on) stays, and so does its event, with only what stayed
    const now = structuredClone(s.events), kept = [];
    const left = new Set(revertEffects(m, p, u.effects).map(x => JSON.stringify(x)));
    Object.assign(s, structuredClone(u.sync));
    for (const [id, effects] of u.byEvent || []) {
        const rest = effects.filter(x => left.has(JSON.stringify(x)));
        if (rest.length && now[id]) { s.events[id] = { ...now[id], effects: rest }; kept.push(now[id].summary || id); }
    }
    s.rounds.pop();
    pruneDropped(s, phoneItems(p));
    p.now = u.now;
    delete p.syncLast; delete p.syncUndo;
    if (p.money) migrateBank(m, p);
    const scope = phoneChatScope(ctx());
    journalWrite(scope, journalRead(scope).filter(r => r.round !== u.round));
    await saveMeta();
    if (p.inject) applyInjection();
    return kept;
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
        for (const t of [...p.threads].sort((a, b) => lastTime(b).localeCompare(lastTime(a))).slice(0, 4)) {
            out.push(`Texts with ${t.with}: ${t.messages.filter(x => !isGuess(x)).slice(-4).map(x => `${said(p, x)}: "${x.text}"`).join(' / ')}`);
        }
        const missed = p.calls.filter(c => c.type === 'missed' && !isGuess(c)).slice(-3);
        if (missed.length) out.push(`Missed calls: ${missed.map(c => `${c.with} (${c.time})`).join(', ')}`);
        const soon = p.events.filter(e => !isGuess(e) && (!p.now || upcoming(e, p.now))).slice(0, 3);
        if (soon.length) out.push(`Calendar: ${soon.map(e => `${e.date}${e.time ? ` ${e.time}` : ''} ${e.title}`).join('; ')}`);
        const notes = p.notes.filter(n => !isGuess(n));
        if (notes.length) out.push(`Notes: ${notes.slice(-3).map(n => n.title || n.text.slice(0, 40)).join('; ')}`);
        return `## ${p.owner}'s phone${p.now ? ` (as of ${p.now})` : ''}\n${out.map(l => `- ${l}`).join('\n')}`;
    }).join('\n')}`;
}

// ---- dates and times as the owner's phone shows them
const FMT = {
    KR: { d: (mo, d) => `${mo}월 ${d}일`, s: (mo, d) => `${mo}. ${d}.`, h12: true, t: (h, mi) => `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${mi}` },
    US: { d: (mo, d) => `${mo}/${d}`, s: (mo, d) => `${mo}/${d}`, h12: true, t: (h, mi) => `${h % 12 || 12}:${mi} ${h < 12 ? 'AM' : 'PM'}` },
    JP: { d: (mo, d) => `${mo}月${d}日`, s: (mo, d) => `${mo}/${d}` },
    DE: { d: (mo, d) => `${pad(d)}.${pad(mo)}.`, s: (mo, d) => `${pad(d)}.${pad(mo)}.` },
    _: { d: (mo, d) => `${pad(d)}/${pad(mo)}`, s: (mo, d) => `${pad(d)}/${pad(mo)}` },
};
for (const k of ['CN', 'TW']) FMT[k] = FMT.JP;
for (const k of ['AT', 'CH', 'RU', 'PL', 'CZ', 'FI', 'NO', 'DK']) FMT[k] = FMT.DE;
FMT.PH = FMT.US;
const fmtOf = p => FMT[p?.country] || FMT._;
export const parts = v => { const mt = String(v || '').match(/^(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/); return mt ? { mo: Number(mt[1]), d: Number(mt[2]), h: mt[3] ? Number(mt[3]) : null, mi: mt[4] || '' } : null; };
const tOf = (p, h, mi) => { const f = fmtOf(p); return f.t ? f.t(h, mi) : `${pad(h)}:${mi}`; };
export function fmtDate(p, v, short = false) { const x = parts(v); if (!x) return ''; const f = fmtOf(p); return short ? f.s(x.mo, x.d) : f.d(x.mo, x.d); }
export function fmtTime(p, v) { const x = parts(v); return x && x.h !== null ? tOf(p, x.h, x.mi) : ''; }
// a list's time: the clock on the phone's today, the short date before it
// the moment the screen being drawn shows (the story's now), set by screen(); the phone's own "now" otherwise
let shownNow = '';
export const showNow = v => { shownNow = v; }; // the window sets the story's now it is showing
const nowOf = p => shownNow || p.now || '';
export const listTime = (p, v) => (String(v).slice(0, 5) === String(nowOf(p)).slice(0, 5) ? fmtTime(p, v) : fmtDate(p, v, true));
export const bigClock = (p, v) => { const x = parts(v); if (!x || x.h === null) return ''; return fmtOf(p).h12 ? `${x.h % 12 || 12}:${x.mi}` : `${pad(x.h)}:${x.mi}`; };
const minsOf = v => { const x = parts(v); return x ? ((x.mo * 31 + x.d) * 24 + (x.h ?? 0)) * 60 + (Number(x.mi) || 0) : 0; };
export const ago = (p, v) => {
    const d = minsOf(nowOf(p)) - minsOf(v);
    if (String(v).slice(0, 5) !== String(nowOf(p)).slice(0, 5) || d < 0) return fmtDate(p, v, true);
    return d < 1 ? '지금' : d < 60 ? `${d}분 전` : `${Math.floor(d / 60)}시간 전`;
};
export const lastTime = t => t.messages[t.messages.length - 1]?.time || '';
// still to come at `now`: a later day, or today at a time not yet passed (or all day)
export const upcoming = (e, now) => { const day = String(now).slice(0, 5), hm = String(now).slice(6); return e.date > day || (e.date === day && (!e.time || !hm || e.time >= hm)); };

// the story's now: the newest status window when it has a time, else what the phone was made with
// a date's month and day, 1-based: "2026-10-26", "10/26", or a month name the calendars know (their months count from 0)
export function monthDay(text) {
    const s = String(text || '');
    const num = s.match(/(?:^|\D)(?:\d{4}[-/.]\s*)?(\d{1,2})[-/.]\s*(\d{1,2})(?!\d)/);
    if (num && Number(num[1]) >= 1 && Number(num[1]) <= 12 && Number(num[2]) >= 1 && Number(num[2]) <= 31) return { mo: Number(num[1]), d: Number(num[2]) };
    const cals = calendars(), d = headingDate(`(${s})`, cals).date;
    return d?.d && cals[d.cal]?.length === 12 ? { mo: d.m + 1, d: d.d } : null;
}
// a dated row's day as the phone writes it ("10-25"), or '' when its calendar is not a 12-month one
export const rowDay = r => (r?.date?.d && calendars()[r.date.cal]?.length === 12 ? `${pad(r.date.m + 1)}-${pad(r.date.d)}` : '');
export function storyNow(p) {
    try {
        const t = recentTrackers(1)[0];
        const d = t?.date ? monthDay(t.date) : null;
        if (t && Number.isFinite(t.min) && d) return `${pad(d.mo)}-${pad(d.d)} ${pad(Math.floor(t.min / 60))}:${pad(t.min % 60)}`;
    } catch { /* no status window */ }
    return p.now || '';
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
- ARCHIVE, RECENT CHAT, OWNER, and sometimes WORLD, LOREBOOK and OWNER PROFILE.
- PHONE NOW: what the phone already holds (mails, events, searches), with their "ev" tags.
- FINANCIAL SCALE: how much the owner's bank deposits come to, worked out beforehand.
- EVALUATION DATE: the story's day, for exchange rates. SAVED RATES: the rates the app already has for it.
- EXISTING ACCOUNTS (sometimes): the accounts the bank already has.

STORY OR INVENTED
- Purchases, bookings, trips, gifts, rent, wages: only what the story shows or plainly implies. Give each the "ev" tag the phone's mail or event for it already has.
- An amount the story gives stays as it is: whose it is, its currency, its date and what it was for. A company's value, a transfer or an old balance is not what the owner has in the bank now.
- Balances, last four digits, card expiry dates, everyday payments (coffee, groceries, transit), and amounts the story doesn't give: invent them, fitting the owner's life, job and country. The deposits together fall within FINANCIAL SCALE.
- Company money, family money and an inheritance still to come are not the owner's cash. Don't invent a trust or a restriction to explain a small balance.
- A booking number, seat, gate or delivery date the story doesn't give stays empty.
- Orders stand as of the story's now: with no sign it arrived, it is not "delivered".
- "basis": a line or two on what the story gave and what you invented. Invented amounts are for the app only, never new facts in the role-play.

ACCOUNTS
- A credit card account has "balance": 0. The app adds up the month from its card payments in "tx": purchases minus, refunds plus; paying the card off is a transfer, not a refund. A payment not yet settled is "pending".
- EXISTING ACCOUNTS keep their id, kind, last4, currency and balance; only their names may change. No new accounts.

ONE THING, ONE AMOUNT
A purchase is in "orders" or "passes" and once in "tx", with the same amount, date and "ev".

LANGUAGE
Banks, shops, merchants and items named as they would be in the owner's country. A name not in Korean gets "ko".

JSON (one object, nothing before or after it)
{
  "currency": three-letter code,
  "basis": what the story gave and what you invented,
  "bank": { "name", "accounts": [{ "id": its id in EXISTING ACCOUNTS, or "", "kind": "checking" | "savings" | "credit", "name", "last4", "currency": three-letter code, "balance": number }] },
  "cards": [{ "account": last4, "exp": "MM/YY" }],
  "tx": [{ "account": last4, "who": merchant or person, "ko", "amount": number (minus for money out), "time": "MM-DD HH:MM",
           "kind": "card" | "transfer" | "deposit", "memo", "pending": true or false, "ev" }],
  "passes": [{ "kind": "flight" | "train" | "hotel" | "event" | "other", "by": airline, line, hotel or venue, "from", "to",
               "date": "MM-DD", "time": "HH:MM", "seat", "gate", "no", "status", "ev" }],
  "orders": [{ "shop", "item", "ko", "option", "qty", "price": number, "time", "status": "ordered" | "shipped" | "on the way" | "delivered" | "unknown",
               "eta": "MM-DD", "arrived": "MM-DD", "gift": who it is for or "", "ev" }],
  "fx": [{ "from": an account currency, "to": FINANCIAL SCALE's currency, "date": EVALUATION DATE, "value": number }] for each pair SAVED RATES doesn't have
}
2 or 3 accounts and 8 to 15 transactions. Passes and orders only from the story; an empty list is fine. Oldest first.
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
- ARCHIVE, RECENT CHAT, OWNER, and sometimes WORLD and LOREBOOK.
- DIARY: the owner's diary entries, so the memos are not the same moments told again.
- OWNER PROFILE (sometimes): the background the user chose for the owner.

RULES
- 3 or 4 memos, each at a moment the archive has where the owner could plausibly talk into their phone alone: after a fight, on the way somewhere, late at night. Not the days the diary already covers, where possible.
- Spoken, not written: the way the owner talks in the archive and chat, with pauses (…), restarts and half sentences. Not a diary entry.
- Only what the archive shows happened and what the owner felt about it; no new events, no new secrets.
- In the owner's own language. Speech not in Korean gets "ko".
- 20 to 90 seconds of speech each.

ANSWER — one JSON object, nothing else:
{ "memos": [{ "title": the name the phone would show, "kt", "text", "ko", "time": "MM-DD HH:MM", "sec": its length in seconds, "place": where, or "" }] }
Oldest first.`;

const jsonOf = out => { const t = String(out || '').replace(/```(?:json)?/gi, ''), a = t.indexOf('{'), b = t.lastIndexOf('}'); try { return a >= 0 && b > a ? JSON.parse(t.slice(a, b + 1)) : null; } catch { return null; } };
const num = v => { if (v === null || v === undefined || String(v).trim() === '') return null; const n = Number(String(v ?? '').replace(/[^\d.,-]/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
const last4 = v => String(v ?? '').replace(/\D/g, '').slice(-4);
export async function sideRequest(m, owner, blocks, { profile, money = false } = {}) {
    const world = worldText(m), lore = await loreFor(m, owner);
    const profileText = await ownerProfileBlock(ctx(),profile,owner,{money});
    const recent = recentForCheck(6).join('\n\n').slice(-6000);
    return [
        `[ARCHIVE]\n${archiveFor(m, -1).text || '(empty)'}`,
        world ? `[WORLD]\n${world}` : '', lore ? `[LOREBOOK]\n${lore}` : '',
        recent ? `[RECENT CHAT]\n${recent}` : '',
        `[OWNER]\n${owner}`, profileText, blindBlock(m, owner), ...blocks, namesBlock(m),
    ].filter(Boolean).join('\n\n');
}
export function parseMoney(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('모델 답에서 은행 · 지갑 · 쇼핑 내용(JSON)을 찾지 못했어요');
    const cur = /^[A-Z]{3}$/.test(String(raw.currency || '').toUpperCase()) ? String(raw.currency).toUpperCase() : 'EUR';
    const accounts = arr(raw.bank?.accounts).map(a => ({ id: line(a?.id, 80), currency: /^[A-Z]{3}$/.test(a?.currency || '') ? a.currency : cur, kind: pick(a?.kind, ['checking', 'savings', 'credit'], 'checking'), name: line(a?.name, 40), last4: last4(a?.last4), balance: num(a?.balance) })).filter(a => a.last4).slice(0, 4);
    return {
        currency: cur, basis: str(raw.basis, 1500),
        bank: { name: line(raw.bank?.name, 40) || 'Bank', accounts },
        cards: arr(raw.cards).map(c => ({ account: last4(c?.account), exp: line(c?.exp, 5) })).filter(c => accounts.some(a => a.last4 === c.account)).slice(0, 4),
        tx: arr(raw.tx).map(x => withEv({ account: last4(x?.account), who: line(x?.who, 60), ko: ko(x?.ko), amount: num(x?.amount), time: when(x?.time), kind: pick(x?.kind, ['card', 'transfer', 'deposit'], 'card'), memo: line(x?.memo, 80), pending: !!x?.pending }, x)).filter(x => x.who && x.amount !== null).slice(-30),
        passes: arr(raw.passes).map(x => withEv({ kind: pick(x?.kind, ['flight', 'train', 'hotel', 'event', 'other'], 'other'), by: line(x?.by, 60), from: line(x?.from, 40), to: line(x?.to, 40), date: when(x?.date).slice(0, 5), time: hhmm(x?.time), seat: line(x?.seat, 12), gate: line(x?.gate, 12), no: line(x?.no, 24), status: line(x?.status, 30) }, x)).filter(x => x.by).slice(-8),
        orders: arr(raw.orders).map(x => withEv({ shop: line(x?.shop, 60), item: line(x?.item, 80), ko: ko(x?.ko), option: line(x?.option, 60), qty: Math.max(1, Math.round(Number(x?.qty) || 1)), price: num(x?.price), time: when(x?.time), status: pick(x?.status, ['ordered', 'shipped', 'on the way', 'delivered', 'unknown'], 'unknown'), eta: when(x?.eta).slice(0, 5), arrived: when(x?.arrived).slice(0, 5), gift: line(x?.gift, 40) }, x)).filter(x => x.item).slice(-12),
    };
}
// what the phone already holds, so the money side reuses its event tags
const moneyContext = p => JSON.stringify({ now: p.now, mails: (p.mails || []).slice(-8).map(x => ev(x, { from: x.from, subject: x.subject, time: x.time })), events: real(p.events).slice(-8).map(x => ev(x, { title: x.title, date: x.date, time: x.time })), searches: real(p.searches).slice(-6).map(x => ev(x, { q: x.q, time: x.time })) });
export const prepareWealth = (m,p,refresh=false) => ensureWealth(m,p,()=>sideRequest(m,p.owner,[`[OWNER COUNTRY]\n${p.country || ''}`,`[ACCOUNT CURRENCIES]\n${JSON.stringify((p.money?.bank?.accounts || []).map(a=>a.currency))}`],{profile:p.financeProfile,money:true}),{refresh});
export const fillMoney = (m, p, opts = {}) => exclusive('fill', () => makeMoney(m, p, opts));
async function makeMoney(m, p, { regenerateBalances = false, wealthPlan = null } = {}) {
    const mark = markNow();
    migrateBank(m, p);
    const old = p.money, rebuild = !!old && regenerateBalances;
    const plan = wealthPlan || await prepareWealth(m,p,regenerateBalances);
    const date = wealthDate(m,p);
    const accountState = () => JSON.stringify([p.money,p.financeProfile,finance(m)]);
    const before = accountState();
    const preserved = rebuild ? `[REBUILD ACCOUNTS]\n${JSON.stringify(old.bank.accounts.map(({id,kind,name,last4,currency})=>({id,kind,name,last4,currency})))}\n[MONEY ALREADY MOVED]\n${JSON.stringify(old.bank.accounts.map(a=>({id:a.id,currency:a.currency,entries:finance(m).accounts[`${a.id}:${a.currency}`]?.entries || {}})))}` : old ? `[EXISTING ACCOUNTS]\n${JSON.stringify(old.bank.accounts)}` : '';
    const system = AI_SYS_MONEY + (rebuild ? MONEY_REBUILD : '');
    const input = await sideRequest(m,p.owner,[`[PHONE NOW]\n${moneyContext(p)}`,preserved,wealthBlock(plan,'deposits'),`[EVALUATION DATE]\n${date}`,`[SAVED RATES]\n${JSON.stringify(Object.fromEntries(Object.entries(finance(m).prices).filter(([k])=>k.startsWith('FX:')).map(([k,book])=>[k,book[date]])))}`],{profile:p.financeProfile,money:true});
    let correction='';
    for(let attempt=0;attempt<2;attempt++) {
        const out = await askDraft(input+'\n'+correction,{system,maxTokens:12000});
        const raw = jsonOf(out), next = parseMoney(raw);
        if (p.money !== old || accountState() !== before) throw new Error('생성 중 계좌가 변경됐어요. 다시 시도해 주세요');
        if (old) {
            if (rebuild) {
                const rows = raw?.bank?.accounts;
                if (!Array.isArray(rows) || rows.length !== old.bank.accounts.length || old.bank.accounts.some(a => {
                    const matches = rows.filter(b=>b.id === a.id);
                    return matches.length !== 1 || matches[0].currency !== a.currency || matches[0].kind !== a.kind || String(matches[0].last4) !== a.last4 || a.kind!=='credit' && (!finite(matches[0].balance) || matches[0].balance < 0);
                })) throw new Error('새 계좌 잔액을 확인하지 못했어요. 기존 잔액은 유지돼요');
                if (['cards','tx','passes','orders'].some(k=>!Array.isArray(raw[k])) || next.tx.some(t=>!old.bank.accounts.some(a=>a.last4===t.account))) throw new Error('새 거래 내역을 확인하지 못했어요. 기존 데이터는 유지돼요');
                next.bank.accounts = old.bank.accounts.map(a => {
                    const b = rows.find(b=>b.id === a.id);
                    return {...a,name:next.bank.accounts.find(b=>b.id === a.id)?.name || a.name,balance:a.kind==='credit'?0:b.balance};
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
        syncOf(p, phoneChatScope(ctx())).marks.money = mark;
        await saveMeta();
        return p.money;
    }
}
export async function fillVoice(m, p) {
    const diary = (p.diary || []).slice(-6).map(d => `- ${d.date} ${d.title}`).join('\n');
    const out = await askDraft(await sideRequest(m, p.owner, [`[DIARY]\n${diary || '(none)'}`], {profile:p.financeProfile}), { system: AI_SYS_VOICES, maxTokens: 6000 });
    const memos = arr(jsonOf(out)?.memos).map(x => ({ title: line(x?.title, 80), kt: line(x?.kt, 80), text: str(x?.text, 2000), ko: str(x?.ko, 2000), time: when(x?.time), sec: Math.max(3, Math.min(900, Math.round(Number(x?.sec) || 30))), place: line(x?.place, 60), src: 'guess' })).filter(x => x.text);
    if (!memos.length) throw new Error('모델 답에서 음성 메모를 찾지 못했어요');
    p.voice = [...(p.voice || []).filter(x => x.src === 'story' || x.now), ...memos].sort((a, b) => String(a.time).localeCompare(String(b.time))).slice(-CAP.voice);
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
        const out=await askDraft(input,{system:AI_SYS_DEVICE,maxTokens:4000});
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
