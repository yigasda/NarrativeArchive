// 캐릭터 휴대폰 · 데이터: what the phone holds — the model's JSON cleaned and merged, the request (archive, lorebook, world),
// 롤플에 넣기, dates and times as the owner's phone shows them, and the places they have been.

import { ensureWealth, wealthBlock, wealthDate, wealthCheck, addWealthFX } from './wealth.js';
import { askDraft } from './ai.js';
import { ownerProfileBlock } from './phoneprofile.js';
import { migrateBank, finance, finite, cash, reviseBaseline } from './finance.js';
import { calendars, headingDate } from './calendar.js';
import { ctx, globalSettings, saveMeta } from './core.js';
import { recentForCheck } from './drift.js';
import { applyInjection } from './inject.js';
import { knowledgeRows } from './knowledge.js';
import { headingPlaces, nameKey, nameRe } from './people.js';
import { estTok } from './recall.js';
import { recentTrackers } from './scenes.js';
import { parseSections, RANGE_HEAD, sectionKey, splitTail } from './sections.js';
import { glossaryEntries } from './translate.js';
import { worldText } from './world.js';

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

export const AI_SYS_PHONE = `GOAL
Show what one character's phone holds right now, in a long role-play. The user opens it to peek at the story from the phone's side.
An app draws the screens from your JSON; you only write the content.

YOU GET
- ARCHIVE: the story so far, in sections (#numbers are chat messages), with the current state at the end.
- WORLD (sometimes): the shared setting.
- LOREBOOK (sometimes): setting notes the user picked.
- RECENT CHAT: the newest messages, after the archive.
- OWNER: whose phone it is.
- OWNER DOESN'T KNOW (sometimes): facts the owner does not know, or only suspects. Nothing on the phone may show them as known.
- PHONE NOW (only when updating): what the phone holds already.

ONE TEST FOR EVERY ITEM
Could this be on the owner's phone, given what the archive, lorebook and chat show? If not, leave it out.
- The lorebook counts as fact like the archive; where the two disagree, the archive wins.
- Events (a meeting, a fight, a confession, a trip, a loss) only if the archive or lorebook has them.
- Small everyday things around those events are fine: how a text was worded, a photo of a place they were, a search they would make.
- People: only people the story has. A relationship word (girlfriend, ex, husband, boss) only if the archive uses it for them.
- Nothing later than the newest moment of the story.
- The diary holds only what the archive shows happened and what the owner felt about it; no new secrets, no new feelings.

LANGUAGE
- Each text is in the language its writer would really use on a phone: from their nationality and where they live; between two people, the language they share.
- A text that is not in Korean gets "ko": a natural Korean translation. A Korean text gets no "ko".
- People write the way they talk in the archive and chat. Texts are short, like real texts.

DEVICE
${DEVICE_RULES}

TIMES
"MM-DD HH:MM" (24-hour), in story time, from the archive's dates. "now" is the newest moment of the story.

JSON (one object, nothing before or after it)
{
  "country": two-letter code of the country the owner lives in and their phone is set to, like "KR", "US", "DE",
  "wallpaper": one of ${WALLS.join(', ')}, the one that suits the owner,
  "accent": one of ${ACCENTS.join(', ')},
  "now": "MM-DD HH:MM",
  "device": { "name": device name, "model": model name, "os": OS and version, "storage": capacity with GB or TB, "serial": invented serial number },
  "contacts": [{ "name": name in the story, "saved": how the owner saved them (a nickname, an emoji, or just the name) }],
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
  "voice": [{ "title", "kt", "text", "ko", "time", "sec", "place" }] only when the archive or chat shows the owner recorded one
}
At most 6 threads of up to 12 messages, 10 calls, 8 photos, 5 notes, 8 searches (3 open at most), 6 events, 5 posts with up to 4 comments,
6 mails, 5 diary entries. Fewer is fine; an empty list is fine.
Oldest first in every list.
Any item may carry "ev": a short tag for one story event, the same on every item that comes from it (the flight's mail, its event and its photo all "ev": "berlin-flight"). Keep the tags PHONE NOW uses.
A value the story does not give (a booking number, a seat, a price, an exact time) stays empty; never make one up.`;

const UPDATE_ASK = `[UPDATE]
Write only what came onto the phone after PHONE NOW's "now", in the same JSON: new messages (under the thread they belong to),
calls, photos, notes, searches, events, posts, mails and diary entries, and "now" as the new newest moment.
Contacts and profile only if new or changed.
Leave out country, wallpaper and accent. If nothing new would be on the phone, answer {"now": …} alone.`;

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

function mergePhone(p, add) {
    if (!p.device && add.device) p.device = add.device;
    const keep = (list, n) => list.slice(-n);
    for (const t of add.threads) {
        const old = p.threads.find(x => nameKey(x.with) === nameKey(t.with));
        if (old) { old.messages = keep([...old.messages, ...fresh('msg', old.messages, t.messages)], CAP.messages); if (t.draft) old.draft = t.draft; }
        else p.threads.push({ ...t, messages: keep(fresh('msg', [], t.messages), CAP.messages) });
    }
    p.threads = keep([...p.threads].sort((a, b) => lastTime(a).localeCompare(lastTime(b))), CAP.threads);
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
        m.phones?.[nameKey(owner)]?.device ? `[DEVICE — locked]\n${JSON.stringify(m.phones[nameKey(owner)].device)}` : '',
        `[ARCHIVE${p ? ' — the sections since PHONE NOW' : ''}]\n${ar.text || '(nothing new)'}`,
        world ? `[WORLD]\n${world}` : '',
        lore ? `[LOREBOOK]\n${lore}` : '',
        recent ? `[RECENT CHAT]\n${recent}` : '',
        `[OWNER]\n${owner}`,
        profile, blindBlock(m, owner),
        namesBlock(m),
        p ? UPDATE_ASK : '',
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
    const old = update ? m.phones?.[key] : null;
    const part = apps && m.phones?.[key] ? apps.flatMap(a => REMAKE[a] || []) : null;
    const binding=structuredClone(m.phones?.[key]?.financeProfile || m.phoneProfiles?.[key]);
    const out = await askDraft(phoneRequest(m, owner, old, await loreFor(m, owner), part, await ownerProfileBlock(ctx(),binding,owner)), { system: AI_SYS_PHONE, maxTokens: 16000 });
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
- ARCHIVE, RECENT CHAT, OWNER, and sometimes WORLD and LOREBOOK.
- PHONE NOW: what the phone already holds (mails, events, searches), with their "ev" tags.

STORY OR INVENTED
- Purchases, bookings, trips, gifts, rent, wages: only what the story shows or plainly implies. Give each the "ev" tag the phone's mail or event for it already has.
- Preserve explicit amounts with their owner, currency, purpose and date. A company valuation, transfer amount or old balance is not a current personal bank balance.
- Where personal balances are unspecified, invent a coherent scale from the owner's business reach, ownership, access to funds, lifestyle and established spending. Do not turn company assets, family wealth or an expected inheritance into personal cash. Never invent restrictions or trusts to explain a low balance.
- Distinguish everyday spending cash and reserves. Investment holdings belong outside bank cash. Record a short "basis" explaining the supplied evidence and the invented scale; invented amounts are app-only, never new canon.
- Credit account balance is a placeholder: return 0. The app computes monthly usage from the returned card transactions: purchases negative, refunds positive; repayments are transfers, not refunds. Include all current-month card transactions you intend to show, and mark pending authorizations pending. Never invent a separate monthly spending total.
- Last four digits, card expiry dates and everyday payments may be invented. Large purchases, wages and distributions need story support.
- EXISTING ACCOUNTS, when provided, are locked financial snapshots. Keep their id, currency, balance, kind and last4 exactly. You may change their display names; do not invent extra accounts or replay old transactions. Credit accounts are not cash; monthly usage is computed from card transactions.
- A booking number, seat, gate or delivery date the story doesn't give stays empty.
- Orders stand as of the story's now: with no sign it arrived, it is not "delivered".

ONE THING, ONE AMOUNT
A purchase is in "orders" or "passes" and once in "tx", with the same amount, date and "ev".

LANGUAGE
Banks, shops, merchants and items named as they would be in the owner's country. A name not in Korean gets "ko".

JSON (one object, nothing before or after it)
{
  "currency": three-letter code,
  "basis": short explanation of evidence and invented scale,
  "bank": { "name", "accounts": [{ "id": existing id when supplied, "kind": "checking" | "savings" | "credit", "name", "last4", "currency": three-letter code, "balance": number }] },
  "cards": [{ "account": last4, "exp": "MM/YY" }],
  "tx": [{ "account": last4, "who": merchant or person, "ko", "amount": number (minus for money out), "time": "MM-DD HH:MM",
           "kind": "card" | "transfer" | "deposit", "memo", "pending": true or false, "ev" }],
  "passes": [{ "kind": "flight" | "train" | "hotel" | "event" | "other", "by": airline, line, hotel or venue, "from", "to",
               "date": "MM-DD", "time": "HH:MM", "seat", "gate", "no", "status", "ev" }],
  "orders": [{ "shop", "item", "ko", "option", "qty", "price": number, "time", "status": "ordered" | "shipped" | "on the way" | "delivered" | "unknown",
               "eta": "MM-DD", "arrived": "MM-DD", "gift": who it is for or "", "ev" }]
}
2 or 3 accounts and 8 to 15 transactions. Passes and orders only from the story; an empty list is fine. Oldest first.`;

// 음성 메모 (채우기): memos at moments the archive has, spoken rather than written
export const AI_SYS_VOICES = `GOAL
Fill the voice memo app of one character's phone in a long role-play: memos they recorded to themselves at moments in the story so far.

YOU GET
- ARCHIVE, RECENT CHAT, OWNER, and sometimes WORLD and LOREBOOK.
- DIARY: the owner's diary entries, so the memos are not the same moments told again.

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
export async function sideRequest(m, owner, blocks, { profile } = {}) {
    const world = worldText(m), lore = await loreFor(m, owner);
    const profileText = await ownerProfileBlock(ctx(),profile,owner);
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
export const prepareWealth = (m,p,refresh=false) => ensureWealth(m,p,()=>sideRequest(m,p.owner,[`[OWNER COUNTRY]\n${p.country || ''}`,`[ACCOUNT CURRENCIES]\n${JSON.stringify((p.money?.bank?.accounts || []).map(a=>a.currency))}`],{profile:p.financeProfile}),{refresh});
export async function fillMoney(m, p, { regenerateBalances = false, wealthPlan = null } = {}) {
    migrateBank(m, p);
    const old = p.money, rebuild = !!old && regenerateBalances;
    const plan = wealthPlan || await prepareWealth(m,p,regenerateBalances);
    const date = wealthDate(m,p);
    const accountState = () => JSON.stringify([p.money,p.financeProfile,finance(m)]);
    const before = accountState();
    const preserved = rebuild ? `[REBUILD ACCOUNTS]\n${JSON.stringify(old.bank.accounts.map(({id,kind,name,last4,currency})=>({id,kind,name,last4,currency})))}\n[APPLIED CASH ENTRIES]\n${JSON.stringify(old.bank.accounts.map(a=>({id:a.id,currency:a.currency,entries:finance(m).accounts[`${a.id}:${a.currency}`]?.entries || {}})))}` : old ? `[EXISTING ACCOUNTS]\n${JSON.stringify(old.bank.accounts)}` : '';
    const system = AI_SYS_MONEY + (rebuild ? `
REBUILD MONEY APPS
REBUILD ACCOUNTS explicitly requests new balances, not locked snapshots. Keep every supplied account id, kind, last4 and currency; no added or omitted accounts. Re-read the story and infer fresh personal cash where unspecified, rather than copying previous invented balances.
Regenerate cards, transactions, passes and orders together from the supplied story and owner profile. Previous generated records are replaced, not carried forward. Re-read explicit receipts, spending and purchases from the story; keep their owner, amount, currency and date. Matching orders, passes and card payments describe the same event: use consistent dates, amounts and ev tags.
Each balance is the CURRENT balance AFTER the newly returned transactions and applied cash entries, not an opening balance. Applied cash entries remain in the ledger; do not duplicate them in tx or replay them. They may describe the same story event: never count it twice. Do not replay transfers, currency conversion, or credit company/family assets to personal cash. Explicit current personal balances take priority; preserve the amounts and currencies of established receipts and spending (for example, EUR 15000 received and EUR 2000 spent may leave EUR 13000 when no other funds or movements exist).
Return complete cards, tx, passes and orders arrays (empty when appropriate); all tx must reference a returned account last4. For credit accounts return balance 0; the app computes usage from card transactions. Return a finite nonnegative balance for each deposit account and explain the evidence/invented scale in basis.` : '');
    const input = await sideRequest(m,p.owner,[`[PHONE NOW]\n${moneyContext(p)}`,preserved,wealthBlock(plan,'deposits'),`[EVALUATION DATE]\n${date}\nAlso return fx:[{from,to,date,value}] for account currencies to ${plan.currency}; existing rates: ${JSON.stringify(Object.fromEntries(Object.entries(finance(m).prices).filter(([k])=>k.startsWith('FX:')).map(([k,book])=>[k,book[date]])))}`],{profile:p.financeProfile});
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
