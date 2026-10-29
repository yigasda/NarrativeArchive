// 캐릭터 휴대폰: one character's phone as the story stands — messages, calls, photos (captions, no pictures), notes,
// searches, a calendar and the places they have been. The draft model writes the content as JSON from the archive; the
// screens are drawn here, the same for everyone. Texts are in the language the writer would use, with Korean under them.
// m.phones = { [name key]: { owner, country, wall, accent, now, contacts, threads, calls, photos, notes, searches, events,
//   upto (the last message number the archive held), at, inject } }

import { askAI, askDraft, drLabel, withSpinner } from './ai.js';
import { annivsOf, datedRows } from './anniv.js';
import { ctx, getMeta, globalSettings, saveGlobal, saveMeta } from './core.js';
import { recentForCheck } from './drift.js';
import { applyInjection } from './inject.js';
import { faceHtml, headingPlaces, nameKey, nameRe, peopleList } from './people.js';
import { calendars, headingDate } from './calendar.js';
import { RANGE_HEAD, parseSections, sectionKey, splitTail } from './sections.js';
import { estTok } from './recall.js';
import { recentTrackers } from './scenes.js';
import { confirm, esc } from './util.js';
import { worldText } from './world.js';

export const WALLS = ['dusk', 'ocean', 'forest', 'rose', 'night', 'sand', 'mono', 'aurora'];
export const ACCENTS = ['blue', 'green', 'orange', 'pink', 'purple', 'red'];
const MOODS = ['warm', 'cool', 'green', 'dark', 'bright', 'pink'];
const COUNTRIES = { KR: '한국', US: '미국', GB: '영국', DE: '독일', FR: '프랑스', IT: '이탈리아', ES: '스페인', JP: '일본', CN: '중국', TW: '대만', CA: '캐나다', AU: '호주', RU: '러시아', BR: '브라질' };
const CAP = { threads: 12, messages: 40, calls: 30, photos: 24, notes: 12, searches: 20, events: 16, contacts: 30, posts: 20, comments: 8, mails: 20, diary: 20 };
const LISTS = ['calls', 'photos', 'notes', 'searches', 'events', 'posts', 'mails', 'diary'];

export const AI_SYS_PHONE = `GOAL
Show what one character's phone holds right now, in a long role-play. The user opens it to peek at the story from the phone's side.
An app draws the screens from your JSON; you only write the content.

YOU GET
- ARCHIVE: the story so far, in sections (#numbers are chat messages), with the current state at the end.
- WORLD (sometimes): the shared setting.
- LOREBOOK (sometimes): setting notes the user picked.
- RECENT CHAT: the newest messages, after the archive.
- OWNER: whose phone it is.
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

TIMES
"MM-DD HH:MM" (24-hour), in story time, from the archive's dates. "now" is the newest moment of the story.

JSON (one object, nothing before or after it)
{
  "country": two-letter code of the country the owner lives in and their phone is set to, like "KR", "US", "DE",
  "wallpaper": one of ${WALLS.join(', ')}, the one that suits the owner,
  "accent": one of ${ACCENTS.join(', ')},
  "now": "MM-DD HH:MM",
  "contacts": [{ "name": name in the story, "saved": how the owner saved them (a nickname, an emoji, or just the name) }],
  "threads": [{ "with": name, "messages": [{ "from": "me" or the sender's name, "text", "ko", "time" }] }],
  "calls": [{ "with": name, "type": "in" | "out" | "missed", "time", "min": minutes talked }],
  "photos": [{ "caption": what the photo shows, "ko", "time", "mood": one of ${MOODS.join(', ')} }],
  "notes": [{ "title", "kt": Korean title, "text", "ko", "time" }],
  "searches": [{ "q", "ko", "time" }],
  "events": [{ "title", "ko", "date": "MM-DD", "time": "HH:MM" or "" }],
  "profile": { "handle": the owner's SNS name, "bio", "ko", "followers": a number, "following": a number },
  "posts": [{ "text", "ko", "photo": what the posted photo shows or "", "pko": its Korean, "time", "likes": a number,
              "comments": [{ "from": name, "text", "ko" }] }],
  "mails": [{ "from": sender, "subject", "ks": Korean subject, "text", "ko", "time", "unread": true or false }],
  "diary": [{ "date": "MM-DD", "title", "kt": Korean title, "text", "ko" }]
}
At most 6 threads of up to 12 messages, 10 calls, 8 photos, 5 notes, 8 searches, 6 events, 5 posts with up to 4 comments,
6 mails, 5 diary entries. Fewer is fine; an empty list is fine.
Oldest first in every list.`;

const UPDATE_ASK = `[UPDATE]
Write only what came onto the phone after PHONE NOW's "now", in the same JSON: new messages (under the thread they belong to),
calls, photos, notes, searches, events, posts, mails and diary entries, and "now" as the new newest moment.
Contacts and profile only if new or changed.
Leave out country, wallpaper and accent. If nothing new would be on the phone, answer {"now": …} alone.`;

// ---- what the model sends back, cleaned: known keys only, text cut short, times in one shape
const str = (v, n) => String(v ?? '').replace(/[ \t]+/g, ' ').trim().slice(0, n);
const line = (v, n) => str(v, n).replace(/\s*\n\s*/g, ' ');
const pad = x => String(x).padStart(2, '0');
const when = v => {
    // "10-25 21:00", or with the year in front ("2026-10-25 21:00", "2026/10/25T21:00")
    const mt = String(v || '').match(/(?:^|\D)(?:\d{4}[-/.])?(\d{1,2})[-/.](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2}))?/);
    if (!mt || Number(mt[1]) > 12 || Number(mt[2]) > 31) return '';
    return `${pad(mt[1])}-${pad(mt[2])}${mt[3] ? ` ${pad(mt[3])}:${mt[4]}` : ''}`;
};
const hhmm = v => { const mt = String(v || '').match(/(\d{1,2}):(\d{2})/); return mt ? `${pad(mt[1])}:${mt[2]}` : ''; };
const ko = v => line(v, 400);
const arr = v => (Array.isArray(v) ? v : []);
const pick = (v, list, dflt) => (list.includes(v) ? v : dflt);

export function parsePhone(out) {
    const s = String(out || '').replace(/```(?:json)?/gi, '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('모델 답에서 폰 내용(JSON)을 찾지 못했어요');
    let raw;
    try { raw = JSON.parse(s.slice(a, b + 1)); } catch { throw new Error('모델 답의 JSON이 깨져 있어요. 다시 해 보세요'); }
    const msg = x => ({ from: line(x?.from, 40) || 'me', text: str(x?.text, 600), ko: ko(x?.ko), time: when(x?.time) });
    return {
        country: /^[A-Z]{2}$/.test(String(raw.country || '').toUpperCase()) ? String(raw.country).toUpperCase() : '',
        wall: pick(raw.wallpaper, WALLS, ''),
        accent: pick(raw.accent, ACCENTS, ''),
        now: when(raw.now),
        contacts: arr(raw.contacts).map(x => ({ name: line(x?.name, 40), saved: line(x?.saved, 40) })).filter(x => x.name).slice(0, CAP.contacts),
        threads: arr(raw.threads).map(t => ({ with: line(t?.with, 40), messages: arr(t?.messages).map(msg).filter(x => x.text) })).filter(t => t.with && t.messages.length).slice(0, CAP.threads),
        calls: arr(raw.calls).map(x => ({ with: line(x?.with, 40), type: pick(x?.type, ['in', 'out', 'missed'], 'in'), time: when(x?.time), min: Math.max(0, Math.min(600, Math.round(Number(x?.min) || 0))) })).filter(x => x.with),
        photos: arr(raw.photos).map(x => ({ caption: line(x?.caption, 200), ko: ko(x?.ko), time: when(x?.time), mood: pick(x?.mood, MOODS, 'warm') })).filter(x => x.caption),
        notes: arr(raw.notes).map(x => ({ title: line(x?.title, 80), kt: line(x?.kt, 80), text: str(x?.text, 1500), ko: str(x?.ko, 1500), time: when(x?.time) })).filter(x => x.title || x.text),
        searches: arr(raw.searches).map(x => ({ q: line(x?.q, 120), ko: ko(x?.ko), time: when(x?.time) })).filter(x => x.q),
        events: arr(raw.events).map(x => ({ title: line(x?.title, 80), ko: ko(x?.ko), date: when(x?.date).slice(0, 5), time: hhmm(x?.time) })).filter(x => x.title && x.date),
        profile: raw.profile && typeof raw.profile === 'object' ? { handle: line(raw.profile.handle, 40), bio: line(raw.profile.bio, 200), ko: ko(raw.profile.ko), followers: Math.max(0, Math.round(Number(raw.profile.followers) || 0)), following: Math.max(0, Math.round(Number(raw.profile.following) || 0)) } : null,
        posts: arr(raw.posts).map(x => ({ text: str(x?.text, 800), ko: str(x?.ko, 800), photo: line(x?.photo, 200), pko: ko(x?.pko), time: when(x?.time), likes: Math.max(0, Math.min(99999, Math.round(Number(x?.likes) || 0))),
            comments: arr(x?.comments).map(c => ({ from: line(c?.from, 40), text: line(c?.text, 300), ko: ko(c?.ko) })).filter(c => c.from && c.text).slice(0, CAP.comments) })).filter(x => x.text || x.photo),
        mails: arr(raw.mails).map(x => ({ from: line(x?.from, 60), subject: line(x?.subject, 120), ks: line(x?.ks, 120), text: str(x?.text, 2000), ko: str(x?.ko, 2000), time: when(x?.time), unread: !!x?.unread })).filter(x => x.from && (x.subject || x.text)),
        diary: arr(raw.diary).map(x => ({ date: when(x?.date).slice(0, 5), title: line(x?.title, 80), kt: line(x?.kt, 80), text: str(x?.text, 2000), ko: str(x?.ko, 2000) })).filter(x => x.date && x.text),
    };
}

// what makes two items the same, list by list: an update that repeats what the phone holds adds nothing
const SIG = {
    msg: x => [nameKey(x.from), x.text, x.time], calls: x => [nameKey(x.with), x.type, x.time], photos: x => [x.caption, x.time],
    notes: x => [x.title, x.text], searches: x => [x.q, x.time], events: x => [x.title, x.date, x.time], posts: x => [x.text, x.photo, x.time],
    mails: x => [x.from, x.subject, x.time], diary: x => [x.date, x.title, x.text],
};
const sigOf = (k, x) => JSON.stringify(SIG[k](x)).toLowerCase();
const fresh = (k, old, add) => { const seen = new Set(old.map(x => sigOf(k, x))); return add.filter(x => !seen.has(sigOf(k, x)) && seen.add(sigOf(k, x))); };
// an update's new items go after the old ones; every list keeps its newest, the threads the ones written in last
function mergePhone(p, add) {
    const keep = (list, n) => list.slice(-n);
    for (const t of add.threads) {
        const old = p.threads.find(x => nameKey(x.with) === nameKey(t.with));
        if (old) old.messages = keep([...old.messages, ...fresh('msg', old.messages, t.messages)], CAP.messages);
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

function phoneRequest(m, owner, p = null, lore = '') {
    const world = worldText(m);
    const recent = recentForCheck(6).join('\n\n').slice(-6000);
    const ar = archiveFor(m, p ? p.upto ?? -1 : -1);
    const now = p ? JSON.stringify(phoneForModel(p)) : '';
    return [
        p ? `[PHONE NOW]\n${now}` : '',
        `[ARCHIVE${p ? ' — the sections since PHONE NOW' : ''}]\n${ar.text || '(nothing new)'}`,
        world ? `[WORLD]\n${world}` : '',
        lore ? `[LOREBOOK]\n${lore}` : '',
        recent ? `[RECENT CHAT]\n${recent}` : '',
        `[OWNER]\n${owner}`,
        p ? UPDATE_ASK : '',
    ].filter(Boolean).join('\n\n');
}
// what the model is shown of a phone it is updating: the newest of each list, without the Korean
const phoneForModel = p => ({
    country: p.country, now: p.now,
    contacts: p.contacts,
    threads: p.threads.map(t => ({ with: t.with, messages: t.messages.slice(-6).map(({ from, text, time }) => ({ from, text, time })) })),
    calls: p.calls.slice(-5).map(({ ko: _, ...x }) => x),
    photos: p.photos.slice(-4).map(({ caption, time }) => ({ caption, time })),
    notes: p.notes.slice(-3).map(({ title, text, time }) => ({ title, text: text.slice(0, 200), time })),
    searches: p.searches.slice(-4).map(({ q, time }) => ({ q, time })),
    events: p.events.slice(-4).map(({ title, date, time }) => ({ title, date, time })),
    profile: p.profile ? { handle: p.profile.handle, bio: p.profile.bio } : undefined,
    posts: (p.posts || []).slice(-3).map(({ text, photo, time }) => ({ text: text.slice(0, 200), photo, time })),
    mails: (p.mails || []).slice(-3).map(({ from, subject, time }) => ({ from, subject, time })),
    diary: (p.diary || []).slice(-2).map(({ date, title, text }) => ({ date, title, text: text.slice(0, 300) })),
});

export async function makePhone(m, owner, { update = false } = {}) {
    const key = nameKey(owner);
    const old = update ? m.phones?.[key] : null;
    const out = await askDraft(phoneRequest(m, owner, old, await loreFor(m, owner)), { system: AI_SYS_PHONE, maxTokens: 16000 });
    const got = parsePhone(out);
    m.phones = m.phones && typeof m.phones === 'object' ? m.phones : {};
    if (old) mergePhone(old, got);
    else {
        const was = m.phones[key];
        const base = { owner, inject: false, ...got, wall: got.wall || 'dusk', accent: got.accent || 'blue', country: got.country || 'KR', threads: [], contacts: [], ...Object.fromEntries(LISTS.map(k => [k, []])) };
        if (was?.theme) base.theme = was.theme;
        m.phones[key] = mergePhone(base, got);
    }
    const p = m.phones[key];
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
            out.push(`Texts with ${t.with}: ${t.messages.slice(-4).map(x => `${said(p, x)}: "${x.text}"`).join(' / ')}`);
        }
        const missed = p.calls.filter(c => c.type === 'missed').slice(-3);
        if (missed.length) out.push(`Missed calls: ${missed.map(c => `${c.with} (${c.time})`).join(', ')}`);
        const soon = p.events.filter(e => !p.now || upcoming(e, p.now)).slice(0, 3);
        if (soon.length) out.push(`Calendar: ${soon.map(e => `${e.date}${e.time ? ` ${e.time}` : ''} ${e.title}`).join('; ')}`);
        if (p.notes.length) out.push(`Notes: ${p.notes.slice(-3).map(n => n.title || n.text.slice(0, 40)).join('; ')}`);
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
const parts = v => { const mt = String(v || '').match(/^(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/); return mt ? { mo: Number(mt[1]), d: Number(mt[2]), h: mt[3] ? Number(mt[3]) : null, mi: mt[4] || '' } : null; };
const tOf = (p, h, mi) => { const f = fmtOf(p); return f.t ? f.t(h, mi) : `${pad(h)}:${mi}`; };
export function fmtDate(p, v, short = false) { const x = parts(v); if (!x) return ''; const f = fmtOf(p); return short ? f.s(x.mo, x.d) : f.d(x.mo, x.d); }
export function fmtTime(p, v) { const x = parts(v); return x && x.h !== null ? tOf(p, x.h, x.mi) : ''; }
// a list's time: the clock on the phone's today, the short date before it
// the moment the screen being drawn shows (the story's now), set by screen(); the phone's own "now" otherwise
let shownNow = '';
const nowOf = p => shownNow || p.now || '';
const listTime = (p, v) => (String(v).slice(0, 5) === String(nowOf(p)).slice(0, 5) ? fmtTime(p, v) : fmtDate(p, v, true));
const bigClock = (p, v) => { const x = parts(v); if (!x || x.h === null) return ''; return fmtOf(p).h12 ? `${x.h % 12 || 12}:${x.mi}` : `${pad(x.h)}:${x.mi}`; };
const minsOf = v => { const x = parts(v); return x ? ((x.mo * 31 + x.d) * 24 + (x.h ?? 0)) * 60 + (Number(x.mi) || 0) : 0; };
const ago = (p, v) => {
    const d = minsOf(nowOf(p)) - minsOf(v);
    if (String(v).slice(0, 5) !== String(nowOf(p)).slice(0, 5) || d < 0) return fmtDate(p, v, true);
    return d < 1 ? '지금' : d < 60 ? `${d}분 전` : `${Math.floor(d / 60)}시간 전`;
};
const lastTime = t => t.messages[t.messages.length - 1]?.time || '';
// still to come at `now`: a later day, or today at a time not yet passed (or all day)
const upcoming = (e, now) => { const day = String(now).slice(0, 5), hm = String(now).slice(6); return e.date > day || (e.date === day && (!e.time || !hm || e.time >= hm)); };

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
const rowDay = r => (r?.date?.d && calendars()[r.date.cal]?.length === 12 ? `${pad(r.date.m + 1)}-${pad(r.date.d)}` : '');
function storyNow(p) {
    try {
        const t = recentTrackers(1)[0];
        const d = t?.date ? monthDay(t.date) : null;
        if (t && Number.isFinite(t.min) && d) return `${pad(d.mo)}-${pad(d.d)} ${pad(Math.floor(t.min / 60))}:${pad(t.min % 60)}`;
    } catch { /* no status window */ }
    return p.now || '';
}

// ---- the places they have been: section headings that name a place, in sections the owner is in (no model)
export function placesOf(m, owner) {
    const re = nameRe(owner), cals = calendars(), out = [];
    for (const s of parseSections(String(m.text || '')).filter(x => !x.group && RANGE_HEAD.test(x.title))) {
        if (!re.test(m.text.slice(s.start, s.end))) continue;
        const pl = headingPlaces(s.title, cals);
        if (!pl.length) continue;
        const d = headingDate(s.title, cals);
        const name = s.title.match(RANGE_HEAD)[5].replace(/^\s*[—–-]\s*/, '').replace(/\s*\([^()]*\)\s*(\[[^\]]*\])?\s*$/, '').trim();
        out.push({ place: pl.join(' → '), date: d.date?.label || '', time: d.time || '', scene: name, key: sectionKey(s) });
    }
    return out.reverse().slice(0, 40);
}

// ---- 사진 그리기: the AI 기능 모델 turns a caption into image tags, one line for the picture and one per person. With
// AutoPic in 직접 생성 mode the picture goes through AutoPic (its model, vibes, registered looks; only the people in the
// photo); otherwise, or if that fails, SillyTavern's image generation draws it quietly, without a chat message.
// How people look: AutoPic's registered characters, else 인물 도감's 그림 태그.
export const AI_SYS_PHOTO = `GOAL
A photo on a character's phone is known only by its caption. Turn it into a NovelAI image prompt.

YOU GET
- PHOTO: the caption and when it was taken.
- OWNER: whose phone it is.
- LOOKS: people whose looks the app already has, by exact name.
- STORY: the archive around that day, for place, clothes and light.

ANSWER — one line each, nothing before or after:
PHOTO: tags for the whole picture
[exact name]: tags for one person from LOOKS who is in the photo (a line for each)
OTHER: tags for one person not in LOOKS (a line for each)
AVOID: negative tags (empty if none are needed)

LANGUAGE AND FORM
- English only. Danbooru-style tags as NovelAI reads them, separated by commas.
- Tags, never sentences.

LOOKS COME FROM THE APP (most important)
- A person from LOOKS who is in the photo gets a line starting with [exact name]:; the app adds their looks.
  Copy the name exactly as LOOKS has it: no nickname, alias, role or translation.
- For them, never write hair (colour, length, style), eyes, skin or tan, body type, chest size,
  face shape, height or size difference — not even if the story mentions it.
- Someone not in LOOKS gets an OTHER line, described in full: gender, rough age, hair, eyes, build, clothes.
- A selfie, or a person the caption does not name, is the owner.
- Nobody gets a line who is not in the photo.

WHAT GOES WHERE
- PHOTO: how many in frame (no humans, 1girl, 1boy, 2girls, 1girl 1boy, multiple boys …), what they do together,
  place, time of day, weather, light, mood, and how a phone took it (selfie, mirror selfie, candid, pov,
  from behind, close-up, upper body, blurry, flash).
- A person's line: what changes day to day — expression, gaze, pose, action, who they touch,
  the clothes they wear that day and their state.

EXPLICIT PHOTOS
- Allowed when the caption is explicit; tag it plainly.
- Clothing state: nude, topless, open shirt, clothes lift, panties aside, disheveled …
- Bare parts are always tagged, in that person's line: nipples, penis (erection if aroused), pussy.
- Mood as the scene warrants: blush, heavy breathing, sweat, trembling, tears …

NEVER
- gritting teeth, clenched teeth, clenched jaw.

LAST CHECK
No hair, eye, skin, body or height tag for anyone in LOOKS.`;
const NEVER_NEG = 'gritting teeth, clenched teeth, clenched jaw';
export const looksOf = () => { const l = globalSettings().looks; return l && typeof l === 'object' ? l : {}; };
const drawing = new Set(); // 'owner key:photo index' being drawn now

// the dated sections of the photo's day (or the last one before it), for place, clothes and light
function storyAround(m, time) {
    const rows = datedRows(m).filter(r => rowDay(r)), x = parts(time), day = x ? `${pad(x.mo)}-${pad(x.d)}` : '';
    let hit = day ? rows.filter(r => rowDay(r) === day) : [];
    if (!hit.length && day) hit = rows.filter(r => rowDay(r) <= day).slice(-1);
    if (!hit.length) hit = rows.slice(-1);
    return hit.slice(-2).map(r => m.text.slice(r.s.start, r.s.end).trim()).join('\n\n').slice(0, 6000);
}

// ---- AutoPic (another extension, used only when it is installed): its settings and registered characters, read only
const autopic = () => { const es = ctx().extensionSettings || {}; const a = es.AutoPic || es.autopic; return a && typeof a === 'object' ? a : null; };
const autopicDirect = () => { const g = autopic()?.naiParams?.generationMode; return !!g && g !== 'legacy'; };
// the characters AutoPic has for this chat's character card
function autopicPeople() {
    const c = ctx(), ch = c.characters?.[c.characterId];
    const list = ch ? autopic()?.characterPrompts?.[ch.avatar] : null;
    return Array.isArray(list) ? list.filter(x => x && x.enabled !== false && String(x.name || '').trim()).map(x => ({ name: String(x.name).trim(), prompt: String(x.prompt || '').trim(), uc: String(x.uc || '').trim(), center: x.center })) : [];
}

const tagList = s => String(s).replace(/[<>"`|]/g, ' ').split(',').map(t => t.trim()).filter(Boolean);
// the answer's lines: PHOTO, one per [name], OTHER, AVOID (TAGS: from the first version reads as PHOTO)
export function readPhotoAnswer(out) {
    const r = { scene: [], people: [], others: [], neg: [] };
    for (const raw of String(out || '').split('\n')) {
        const l = raw.replace(/^[\s*>-]+/, '').replace(/\*\*/g, '');
        let mt;
        if ((mt = l.match(/^(?:PHOTO|TAGS)\s*:(.*)$/i))) r.scene.push(...tagList(mt[1]));
        else if ((mt = l.match(/^\[([^\]]{1,40})\]\s*:(.*)$/))) r.people.push({ name: mt[1].trim(), tags: tagList(mt[2]) });
        else if ((mt = l.match(/^OTHER\s*:(.*)$/i))) { const t = tagList(mt[1]); if (t.length) r.others.push(t); }
        else if ((mt = l.match(/^AVOID\s*:(.*)$/i))) r.neg.push(...tagList(mt[1]));
    }
    if (!r.scene.length && !r.people.length && !r.others.length) throw new Error('모델 답에서 PHOTO 줄을 찾지 못했어요');
    r.neg = [...new Set([...r.neg, ...tagList(NEVER_NEG)])];
    return r;
}
// one prompt for SillyTavern's image generation: the picture, then each person with their looks
function onePrompt(a, ap) {
    const looks = looksOf();
    const lookOf = n => ap.find(x => nameKey(x.name) === nameKey(n))?.prompt || looks[nameKey(n)] || '';
    const tags = [...a.scene, ...a.people.flatMap(x => [...tagList(lookOf(x.name)), ...x.tags]), ...a.others.flat()];
    return { tags: [...new Set(tags)].join(', '), neg: a.neg.join(', ') };
}
const shownTags = a => [`PHOTO: ${a.scene.join(', ')}`, ...a.people.map(x => `[${x.name}]: ${x.tags.join(', ')}`), ...a.others.map(t => `OTHER: ${t.join(', ')}`), a.neg.length ? `AVOID: ${a.neg.join(', ')}` : ''].filter(Boolean).join('\n');

async function drawWithST(tags, neg) {
    const c = ctx();
    if (!c.SlashCommandParser?.commands?.imagine) throw new Error('실리태번 이미지 생성 확장이 꺼져 있어요. 확장 → 이미지 생성에서 NovelAI를 연결해 주세요');
    const r = await c.executeSlashCommandsWithOptions(`/imagine quiet=true gallery=false extend=false negative="${neg}" ${tags}`);
    const url = String(r?.pipe || '').trim();
    if (!url || r?.isError) throw new Error('그림을 받지 못했어요. 실리태번 이미지 생성 설정을 확인해 주세요');
    return url;
}
// AutoPic 직접 생성: each person in the photo as a NovelAI character prompt (registered looks first), nobody else.
// Its reference image needs AutoPic's own helper, so it stays off for phone photos; vibes and the rest are AutoPic's.
async function drawWithAutopic(a, ap) {
    const mod = await import('/scripts/extensions/third-party/AutoPic/nai-direct.mjs');
    if (typeof mod.generateDirect !== 'function') throw new Error('AutoPic 직접 생성 함수를 찾지 못했어요');
    const looks = looksOf();
    const characterPrompts = [
        ...a.people.map(x => {
            const base = ap.find(y => nameKey(y.name) === nameKey(x.name));
            return { name: base?.name || x.name, prompt: [...tagList(base?.prompt || looks[nameKey(x.name)] || ''), ...x.tags].join(', '), uc: base?.uc || '', enabled: true, ...(base?.center ? { center: { ...base.center } } : {}) };
        }),
        ...a.others.map(t => ({ name: '', prompt: t.join(', '), uc: '', enabled: true })),
    ].filter(x => x.prompt);
    const c = ctx();
    const prompt = a.scene.join(', ');
    return mod.generateDirect({
        nai: { ...autopic().naiParams, refEnabled: false },
        prompt,
        payload: { prompt, negative_prompt: a.neg.join(', '), characterPrompts },
        library: ap,
        context: c,
        getHeaders: () => c.getRequestHeaders(),
        saveImage: saveImageFile,
    });
}
async function saveImageFile(base64, folder, name, format) {
    const r = await fetch('/api/images/upload', { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify({ image: base64, format, ch_name: folder, filename: String(name).replace(/\./g, '_') }) });
    if (!r.ok) throw new Error('그림을 저장하지 못했어요');
    return (await r.json()).path;
}

export async function drawPhoto(m, p, k) {
    const ph = p.photos[k];
    if (!ph) return null;
    const looks = looksOf(), ap = autopic() ? autopicPeople() : [];
    const known = [...new Set([...ap.map(x => x.name), ...peopleList(m).filter(n => looks[nameKey(n)])])];
    const prompt = [
        `[PHOTO]\n${ph.caption}${ph.time ? ` (taken ${ph.time})` : ''}`,
        `[OWNER]\n${p.owner}`,
        `[LOOKS]\n${known.join('\n') || '(nobody)'}`,
        `[STORY]\n${storyAround(m, ph.time) || '(none)'}`,
    ].join('\n\n');
    const a = readPhotoAnswer(await askAI(prompt, { system: AI_SYS_PHOTO, maxTokens: 2000 }));
    let url = '', via = 'st';
    if (autopicDirect()) {
        try { url = await drawWithAutopic(a, ap); via = 'autopic'; }
        catch (e) {
            console.warn('[narrative-archive] AutoPic direct', e);
            toastr.warning(`오토픽으로 못 그려서 실리태번 이미지 생성으로 그려요 (${String(e?.message || e).slice(0, 80)})`, '캐릭터 휴대폰', { timeOut: 6000 });
        }
    }
    if (!url) { const one = onePrompt(a, ap); url = await drawWithST(one.tags, one.neg); }
    ph.img = url; ph.tags = shownTags(a); ph.via = via;
    await saveMeta();
    return ph;
}

// ---- 카메라: one photo of this very moment, from the newest messages (the AI 기능 모델)
const AI_SYS_SHOT = `GOAL
The owner of a phone in a long role-play takes one photo right now. Write what the photo shows.

YOU GET
- OWNER, and NOW: the story's moment.
- STORY END: the last archived sections and the current state.
- RECENT CHAT: the newest messages; the photo is taken at the end of them.
- PHOTOS SO FAR: captions already on the phone, for the language and the style.

RULES
- Only what is really in front of the owner at this moment; nothing the story has not shown.
- One short caption, the way a photo is described: who or what is in it, where, the light.
- In the language of PHOTOS SO FAR (the owner's own). A caption that is not Korean gets "ko", a Korean translation.

ANSWER — one JSON object, nothing else:
{ "caption", "ko", "mood": one of ${MOODS.join(', ')} }`;
const shooting = new Set(); // owner keys taking a photo now
async function takePhoto(m, p) {
    const [body, tail] = splitTail(String(m.text || ''));
    const secs = parseSections(body).filter(x => !x.group).slice(-2).map(x => body.slice(x.start, x.end).trim());
    const prompt = [
        `[OWNER]\n${p.owner}`, `[NOW]\n${storyNow(p) || p.now || ''}`,
        `[STORY END]\n${[...secs, tail.trim()].filter(Boolean).join('\n\n').slice(-8000)}`,
        `[RECENT CHAT]\n${recentForCheck(6).join('\n\n').slice(-5000)}`,
        `[PHOTOS SO FAR]\n${p.photos.slice(-3).map(x => `- ${x.caption}`).join('\n') || '(none)'}`,
    ].join('\n\n');
    const out = String(await askAI(prompt, { system: AI_SYS_SHOT, maxTokens: 1500 }) || '').replace(/```(?:json)?/gi, '');
    const a = out.indexOf('{'), b = out.lastIndexOf('}');
    let raw = null;
    try { raw = a >= 0 && b > a ? JSON.parse(out.slice(a, b + 1)) : null; } catch { raw = null; }
    const caption = line(raw?.caption, 200);
    if (!caption) throw new Error('모델 답에서 사진 설명을 찾지 못했어요');
    p.photos.push({ caption, ko: ko(raw?.ko), time: storyNow(p) || p.now || '', mood: pick(raw?.mood, MOODS, 'warm') });
    p.photos = p.photos.slice(-CAP.photos);
    await saveMeta();
    return p.photos.length - 1;
}

// ---- drawing
const ICO = {
    msg: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/>',
    call: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    photo: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    note: '<path d="M5 3h10l4 4v14H5z"/><path d="M9 11h6M9 15h6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    map: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    sig: '<path d="M4 18h2v-3H4zM9 18h2v-6H9zM14 18h2V9h-2zM19 18h2V6h-2z" fill="currentColor" stroke="none"/>',
    bat: '<rect x="2" y="7" width="18" height="10" rx="2.5"/><rect x="4" y="9" width="11" height="6" rx="1" fill="currentColor" stroke="none"/><path d="M22 10v4"/>',
    out: '<path d="M7 17L17 7M9 7h8v8"/>', in: '<path d="M17 7L7 17M15 17H7V9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    heart: '<path d="M12 20.5s-7.8-4.7-9.7-9.5C1 7.6 3.2 4.5 6.6 4.5c2.2 0 3.8 1.2 5.4 3.1 1.6-1.9 3.2-3.1 5.4-3.1 3.4 0 5.6 3.1 4.3 6.5-1.9 4.8-9.7 9.5-9.7 9.5z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    right: '<path d="M9 6l6 6-6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    redo: '<path d="M21 4v6h-6"/><path d="M20.5 10A8.5 8.5 0 1 0 19 16.5"/>',
};
const ic = (k, s = 18, w = 2) => `<svg class="na_ph_i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
const APPS = { msg: '메시지', call: '전화', photo: '사진', note: '메모', search: '검색', cal: '캘린더', map: '지도', sns: 'SNS', mail: '메일', diary: '일기', set: '설정', cam: '카메라' };
const koOn = () => globalSettings().phoneKo !== false;
const savedName = (p, n) => p.contacts.find(c => nameKey(c.name) === nameKey(n))?.saved || n;
const hasKo = p => [...p.threads.flatMap(t => t.messages), ...p.photos, ...p.notes, ...p.searches, ...p.events, ...(p.posts || []), ...(p.mails || []), ...(p.diary || [])].some(x => x.ko);
function statusBar(p, now) {
    return `<div class="na_ph_sb"><span>${esc(fmtTime(p, now) || '')}</span><i>${ic('sig', 15)}${ic('bat', 20, 1.6)}</i></div>`;
}

function lockNotes(p, now) {
    const notes = [];
    const day = String(now).slice(0, 5);
    for (const t of [...p.threads].sort((a, b) => lastTime(b).localeCompare(lastTime(a)))) {
        const x = t.messages[t.messages.length - 1];
        if (x && x.from !== 'me' && notes.length < 2) notes.push({ app: 'msg', title: savedName(p, t.with), text: x.text, ko: x.ko, time: x.time });
    }
    const missed = p.calls.filter(c => c.type === 'missed' && c.time.slice(0, 5) === day);
    if (missed.length) {
        const last = missed[missed.length - 1];
        const n = missed.filter(c => nameKey(c.with) === nameKey(last.with)).length;
        notes.push({ app: 'call', title: '부재중 전화', text: `${savedName(p, last.with)}${n > 1 ? ` · ${n}통` : ''}`, time: last.time });
    }
    const ev = p.events.find(e => upcoming(e, now));
    if (ev && notes.length < 3) notes.push({ app: 'cal', title: '캘린더', text: `${ev.title}${ev.time ? ` · ${fmtTime(p, `${ev.date} ${ev.time}`)}` : ''}`, ko: ev.ko, time: '' });
    return notes.slice(0, 3);
}

// ---- 홈: 클리어 글래스 (the user's design board, drawn at its own 390 × 844 and scaled to the phone).
// Two themes, both the user's boards: 컬러 젤 (Gel.dc.html, the default) and 화이트 그레이 (Main.dc.html, p.theme = 'gray');
// every value below is the boards'
const CG_W = 390, CG_H = 844;
const CG_ALPHA = 'd9'; // clarity 0.85
const CG_I = {
    msg: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4z',
    call: 'M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2z',
    photo: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 16l5-5 4 4 3-3 6 6M15 9h.01',
    note: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5',
    cal: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M9 3v4M15 3v4',
    map: 'M9 4L4 6v14l5-2 6 2 5-2V4l-5 2zM9 4v14M15 6v14',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    sns: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
    set: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
    cam: 'M4 8h3l2-3h6l2 3h3v11H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
    diary: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
};
const CG_GEL = { sns: ['#efc4d0', '#d494a7'], mail: ['#bfd3e9', '#8faed1'], diary: ['#d3cae9', '#a699c9'], set: ['#d1d4d9', '#a2a7af'], cam: ['#e2e4e8', '#aeb2b9', '#2a313b'], photo: ['#f0cbb5', '#d89f98'], cal: ['#f6f7f9', '#dcdfe5', '#b0564e'], note: ['#f4e5b5', '#dcc680', '#5a4a1f'], map: ['#c3dcc1', '#93ba97'], call: ['#bbddc0', '#89b892'], msg: ['#bbddc0', '#89b892'], search: ['#bfd3e9', '#8faed1'] };
const cgIcon = (k, mono, badge = 0) => {
    const [c1, c2, g = '#ffffff'] = CG_GEL[k];
    const svg = mono
        ? `<svg aria-hidden="true" width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#2a313b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="${CG_I[k]}"/></svg>`
        : `<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${g}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${CG_I[k]}"/></svg>`;
    return `<button type="button" class="cg_ic" data-go="${k}" aria-label="${APPS[k]}"${mono ? '' : ` style="--c1: ${c1}${CG_ALPHA}; --c2: ${c2}${CG_ALPHA}"`}>${svg}${badge ? `<span class="cg_badge cg_num">${badge}</span>` : ''}</button>`;
};
const cgBar = (p, now) => `
  <div class="cg_sb"><span class="cg_num">${esc(bigClock(p, now) || '')}</span><span class="cg_sbi">
    <svg aria-hidden="true" width="18" height="12" viewBox="0 0 18 12" fill="#161b22"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg aria-hidden="true" width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="#161b22" stroke-width="1.8" stroke-linecap="round"><path d="M1.5 4.2a9.5 9.5 0 0 1 13 0"/><path d="M4 7a6 6 0 0 1 8 0"/><circle cx="8" cy="10" r="1" fill="#161b22" stroke="none"/></svg>
    <svg aria-hidden="true" width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x="0.5" y="0.5" width="23" height="12" rx="3.8" stroke="#161b22" stroke-opacity="0.4"/><rect x="2.5" y="2.5" width="16" height="8" rx="2" fill="#161b22"/><path d="M25.5 4.5v4" stroke="#161b22" stroke-opacity="0.4" stroke-width="1.5" stroke-linecap="round"/></svg>
  </span></div>`;
// a note's lines for the checklist widget: "- a" lines, else its sentences; "[x]" or "✓" at the start reads as done
function noteItems(n) {
    if (!n) return [];
    const lines = String(n.text || '').split('\n').map(l => l.trim()).filter(Boolean);
    const list = (lines.length > 1 ? lines : String(n.text || n.title || '').split(/(?<=[.!?。])\s+/)).map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
    return list.slice(0, 3).map(l => { const done = /^(\[x\]|✓|✔)\s*/i.test(l); return { done, text: l.replace(/^(\[x\]|\[ \]|✓|✔)\s*/i, '') }; });
}
function homeScreen(p, now, m) {
    const mono = p.theme === 'gray';
    const day = String(now).slice(0, 5), x = parts(now);
    const anniv = annivToday(m, now);
    const unread = p.threads.filter(t => t.messages[t.messages.length - 1]?.from !== 'me').length;
    const missed = p.calls.filter(c => c.type === 'missed' && c.time.slice(0, 5) === day).length;
    const bars = mono ? ['#2a313b', 'rgba(22, 27, 34, 0.22)'] : ['#d89f98', '#8faed1'];
    const evs = [...(anniv ? [{ title: anniv, when: '기념일', heart: true }] : []),
        ...p.events.filter(e => upcoming(e, now)).map(e => ({ title: e.title, when: `${e.date === day ? '' : `${fmtDate(p, e.date, true)} `}${e.time ? fmtTime(p, `${e.date} ${e.time}`) : e.date === day ? '하루 종일' : ''}`.trim() }))].slice(0, 2);
    const note = p.notes[p.notes.length - 1], items = noteItems(note);
    // SNS: comments from others on today's posts; 메일: unread
    const badges = { sns: (p.posts || []).filter(x => x.time.slice(0, 5) === day).reduce((n, x) => n + x.comments.filter(c => nameKey(c.from) !== nameKey(p.owner)).length, 0), mail: (p.mails || []).filter(x => x.unread).length };
    return `
      <div class="cg_bg1" aria-hidden="true"></div><div class="cg_bg2" aria-hidden="true"></div>
      <svg class="cg_noise" aria-hidden="true" width="390" height="844"><filter id="cgn"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#cgn)"/></svg>
      <div class="cg_col">
        ${cgBar(p, now)}
        <div class="cg_top">
          <div class="cg_widgets">
            <button type="button" class="cg_glass cg_wcal" data-go="cal">
              <span class="cg_cap cg_capcal">${x ? `${x.mo}월` : '캘린더'}</span>
              <span class="cg_num cg_day">${x ? x.d : ''}</span>
              <span class="cg_fill"></span>
              <span class="cg_evs">${evs.length ? evs.map((e, k) => `<span class="cg_ev"><span class="cg_evbar" style="background: ${bars[k]}"></span><span class="cg_evtx"><span class="cg_evt">${e.heart ? '♥ ' : ''}${esc(e.title)}</span><span class="cg_num cg_evw">${esc(e.when)}</span></span></span>`).join('') : '<span class="cg_evw">다가오는 일정 없음</span>'}</span>
            </button>
            <button type="button" class="cg_glass cg_wnote" data-go="note">
              <span class="cg_wh"><span class="cg_cap cg_capnote">메모</span><span class="cg_num cg_evw">${p.notes.length ? esc(fmtDate(p, note.time, true)) : ''}</span></span>
              ${items.length ? items.map(i => `<span class="cg_item ${i.done ? 'done' : ''}"><span class="cg_chk">${i.done ? '<svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>' : ''}</span><span class="cg_itx">${esc(i.text)}</span></span>`).join('') : '<span class="cg_evw">메모 없음</span>'}
            </button>
          </div>
          <div class="cg_grid">${['photo', 'cal', 'note', 'map', 'sns', 'mail', 'diary', 'set'].map(k => `<div class="cg_cell">${cgIcon(k, mono, badges[k] || 0)}<span class="cg_lbl">${APPS[k]}</span></div>`).join('')}</div>
        </div>
        <div class="cg_fill"></div>
        <div class="cg_dots" aria-hidden="true"><span></span><span class="on"></span></div>
        <div class="cg_dockwrap"><div class="cg_glass cg_dock">${cgIcon('call', mono, missed)}${cgIcon('msg', mono, unread)}${cgIcon('cam', mono)}${cgIcon('search', mono)}</div></div>
        <button type="button" class="cg_ind" data-go="lock" aria-label="잠금화면"><span></span></button>
      </div>`;
}

// 잠금화면 · 클리어 글래스: the home's ground and glass, a thin big clock, the notes as glass cards
const cgMini = (k, mono) => { const [c1, c2, g = '#ffffff'] = CG_GEL[k]; return `<span class="cg_ic cg_mini"${mono ? '' : ` style="--c1: ${c1}${CG_ALPHA}; --c2: ${c2}${CG_ALPHA}"`}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${mono ? '#2a313b' : g}" stroke-width="${mono ? 1.75 : 2}" stroke-linecap="round" stroke-linejoin="round"><path d="${CG_I[k]}"/></svg></span>`; };
function lockScreen(p, now) {
    const mono = p.theme === 'gray';
    return `
      <div class="cg_bg1" aria-hidden="true"></div><div class="cg_bg2" aria-hidden="true"></div>
      <svg class="cg_noise" aria-hidden="true" width="390" height="844"><filter id="cgl"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#cgl)"/></svg>
      <div class="cg_col cg_lock" data-go="home">
        ${cgBar(p, '')}
        <div class="cg_lk">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3a4250" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3"/></svg>
          <span class="cg_lkdate">${esc(fmtDate(p, now))}</span>
          <span class="cg_num cg_lkclock">${esc(bigClock(p, now))}</span>
          <span class="cg_fill"></span>
          <span class="cg_lknotes">${lockNotes(p, now).map(n => `
            <button type="button" class="cg_glass cg_nt" data-go="${n.app}">${cgMini(n.app, mono)}<span class="cg_nttx"><b>${esc(n.title)}</b><span>${esc(n.text)}</span>${n.ko && koOn() ? `<small class="cg_ntko">${esc(n.ko)}</small>` : ''}</span>${n.time ? `<span class="cg_ntw">${esc(ago(p, n.time))}</span>` : ''}</button>`).join('')}</span>
          <span class="cg_lkopen">눌러서 열기</span>
        </div>
        <span class="cg_ind cg_lkind" aria-hidden="true"><span></span></span>
      </div>`;
}

const head = (p, title, { back = 'home', sub = '', chip = true, extra = '' } = {}) => `
  <div class="na_ph_head">
    <button type="button" class="na_ph_back" data-go="${back}" aria-label="뒤로">${ic('back', 20, 2.4)}</button>
    <span class="na_ph_headr">${extra}${chip && hasKo(p) ? `<button type="button" class="na_ph_kochip ${koOn() ? 'on' : ''}">가 한국어</button>` : ''}</span>
  </div>
  <div class="na_ph_title">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
const empty = t => `<div class="na_ph_empty">${esc(t)}</div>`;

const busyHtml = '<i class="fa-solid fa-spinner fa-spin"></i>';
const drawBtn = (p, k, cls = '') => { const busy = drawing.has(`${nameKey(p.owner)}:${k}`); return `<button type="button" class="na_ph_draw ${cls}" data-k="${k}" ${busy ? 'disabled' : ''}>${busy ? `${busyHtml} 그리는 중` : p.photos[k].img ? '다시 그리기' : '그리기'}</button>`; };
// 외모: a sheet over the album with everyone's looks for drawing (every chat). AutoPic's registered looks come first
function looksSheet(m) {
    const looks = looksOf(), ap = autopic() ? autopicPeople() : [];
    const rows = peopleList(m).map(n => {
        const reg = ap.find(x => nameKey(x.name) === nameKey(n));
        return `
          <div class="na_ph_lrow">${faceHtml(n, 40)}<div>
            <b>${esc(n)}</b>${reg ? '<span class="na_ph_apbadge">오토픽 외모 사용</span>' : ''}
            ${reg ? `<div class="na_ph_lta off">${esc(reg.prompt || '(오토픽에 외모 없음)')}</div><small>오토픽에 등록된 외모가 먼저 들어가요</small>`
                : `<textarea class="na_ph_lta" data-n="${esc(n)}" rows="2" spellcheck="false" placeholder="외모 태그 (머리 · 눈 · 피부 · 체형 · 키)">${esc(looks[nameKey(n)] || '')}</textarea>`}
          </div></div>`;
    }).join('');
    return `
      <div class="na_ph_shade na_ph_lclose"></div>
      <div class="na_ph_sheet">
        <div class="na_ph_grab"></div>
        <div class="na_ph_sheethead"><b>인물 외모<small>사진 그릴 때 들어가요 · 모든 채팅</small></b><button type="button" class="na_ph_lclose na_ph_done">완료</button></div>
        <div class="na_ph_lrows">${rows || empty('인물이 없어요')}</div>
      </div>`;
}

function annivToday(m, now) {
    const day = String(now).slice(0, 5);
    const rows = datedRows(m);
    for (const a of annivsOf(m)) {
        const r = rows.find(x => sectionKey(x.s) === a.key);
        if (r && rowDay(r) === day) return a.name;
    }
    return '';
}
// ---- SNS · 메일 · 일기 · 설정 · 카메라: drawn like the real apps (the approved boards), at 390 × 844 and scaled like the home
const AX = {
    back: 'M15 5l-7 7 7 7', heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z', cmt: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z',
    send: 'M22 3L11 13M22 3l-7 18-4-8-8-4z', save: 'M6 3h12v18l-6-4-6 4z', grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', tag: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    plus: 'M12 5v14M5 12h14', menu: 'M4 7h16M4 12h16M4 17h16', home: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    reels: 'M4 4h16v16H4zM4 9h16M9 4l3 5M15 4l3 5', photo: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 16l5-5 4 4 3-3 6 6M15 9h.01',
    compose: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', filter: 'M4 6h16M7 12h10M10 18h4', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', folder: 'M3 6h6l2 2h10v11H3z',
    reply: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 6 6v3', more: 'M5 12h.01M12 12h.01M19 12h.01', chev: 'M9 6l6 6-6 6', cal: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M9 3v4M15 3v4',
    pen: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
    palette: 'M12 3a9 9 0 0 0 0 18c1 0 1.5-.6 1.5-1.4 0-.9-.7-1.3-.7-2.1 0-.8.6-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-5-4-9-9-9zM7.5 11h.01M10 7h.01M14.5 7h.01',
    lang: 'M4 6h9M8.5 4v2M6 6c0 4 3 7 6 8M11 6c0 3-3 7-7 8M14 20l4-9 4 9M15.5 17h5', user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01', in: 'M17 7L7 17M15 17H7V9', out: 'M7 17L17 7M9 7h8v8', missed: 'M4 7l6 6 4-4 6 6', x: 'M6 6l12 12M18 6L6 18',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    keypad: 'M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z', voice: 'M5 10v4M9 7v10M13 4v16M17 8v8M21 11v2',
    call: 'M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2z', video: 'M3 7h12v10H3zM15 10l6-3v10l-6-3', mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
    lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3', mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3', check: 'M5 12.5l4.5 4.5L19 7.5', share: 'M12 3v12M7 8l5-5 5 5M5 14v6h14v-6', bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', flip: 'M20 12a8 8 0 0 1-14 5M4 12a8 8 0 0 1 14-5M18 3v4h-4M6 21v-4h4', down: 'M6 9l6 6 6-6',
};
const ax = (k, z = 22, c = 'currentColor', w = 2, f = 'none') => `<svg aria-hidden="true" width="${z}" height="${z}" viewBox="0 0 24 24" fill="${f}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${AX[k]}"/></svg>`;
const axBar = (p, now, c = '#111') => `
  <div class="ax_sb" style="color: ${c}"><span class="cg_num">${esc(bigClock(p, now) || '')}</span><span class="ax_sbi">
    <svg aria-hidden="true" width="18" height="12" viewBox="0 0 18 12" fill="${c}"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg aria-hidden="true" width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"><path d="M1.5 4.2a9.5 9.5 0 0 1 13 0"/><path d="M4 7a6 6 0 0 1 8 0"/><circle cx="8" cy="10" r="1" fill="${c}" stroke="none"/></svg>
    <svg aria-hidden="true" width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x="0.5" y="0.5" width="23" height="12" rx="3.8" stroke="${c}" stroke-opacity="0.4"/><rect x="2.5" y="2.5" width="16" height="8" rx="2" fill="${c}"/></svg>
  </span></div>`;
const axInd = (c = '#111') => `<button type="button" class="ax_ind" data-go="home" aria-label="홈"><span style="background: ${c}"></span></button>`;
const axKo = (t, k) => `${esc(t)}${k && koOn() ? `<span class="ax_ko">${esc(k)}</span>` : ''}`;
// a photo's colours, from its mood (or, for a post, from its words)
const AX_MOOD = { warm: '#f0b38a, #c66a6f', cool: '#9fbadb, #5f7fa8', green: '#b9d4b0, #6f9a76', pink: '#f2bfcd, #cf7f98', dark: '#6d6478, #2f2a38', bright: '#f6dd8f, #e5a85a' };
const moodOf = s => MOODS[[...String(s)].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) % 9973, 7) % MOODS.length];
const axFace = (n, z) => `<span class="ax_face" style="width: ${z}px; height: ${z}px">${faceHtml(n, z)}</span>`;

function snsScreen(p, now) {
    const pr = p.profile || {}, posts = (p.posts || []).map((x, k) => [x, k]).reverse();
    const n = v => (Number(v) || 0).toLocaleString();
    return `${axBar(p, now)}
      <div class="ax_igtop"><b>${esc(pr.handle || p.owner)} ${ax('down', 18, '#111', 2.4)}</b><span>${ax('plus', 24, '#111')}${ax('menu', 24, '#111')}</span></div>
      <div class="ax_scroll">
        <div class="ax_igprof"><span class="ax_ring">${axFace(p.owner, 82)}</span><span class="ax_stats"><span><b>${posts.length}</b>게시물</span><span><b>${n(pr.followers)}</b>팔로워</span><span><b>${n(pr.following)}</b>팔로잉</span></span></div>
        <div class="ax_igname"><b>${esc(p.owner)}</b>${pr.bio ? `<br>${axKo(pr.bio, pr.ko)}` : ''}</div>
        <div class="ax_igbtns"><span>프로필 편집</span><span>프로필 공유</span></div>
        <div class="ax_igtabs"><span class="on">${ax('grid', 22)}</span><span>${ax('tag', 22)}</span></div>
        <div class="ax_grid3">${posts.length ? posts.map(([x, k]) => x.photo
            ? `<button type="button" class="ax_tile" data-go="snspost" data-i="${k}" style="--axbg: linear-gradient(160deg, ${AX_MOOD[moodOf(x.photo)]})">${ax('photo', 26, '#fff', 1.6)}<span class="ax_tcap">${esc(x.photo)}</span></button>`
            : `<button type="button" class="ax_tile ax_ttext" data-go="snspost" data-i="${k}">${axKo(x.text, x.ko)}</button>`).join('') : ''}</div>
        ${posts.length ? '' : '<div class="ax_empty">게시물이 없어요</div>'}
      </div>
      <div class="ax_ignav">${ax('home', 26, '#111')}${ax('search', 26, '#111')}${ax('plus', 26, '#111')}${ax('reels', 26, '#111', 1.8)}<span class="ax_navme">${axFace(p.owner, 28)}</span></div>
      ${axInd()}`;
}
function snsPost(p, now, k) {
    const x = (p.posts || [])[k], pr = p.profile || {};
    if (!x) return snsScreen(p, now);
    return `${axBar(p, now)}
      <div class="ax_igtop ax_center"><button type="button" class="ax_back" data-go="sns" aria-label="뒤로">${ax('back', 26, '#111', 2.2)}</button><b>게시물</b><span class="ax_sp"></span></div>
      <div class="ax_scroll">
        <div class="ax_posth"><span class="ax_ring ax_ring_s">${axFace(p.owner, 30)}</span><div><b>${esc(pr.handle || p.owner)}</b></div>${ax('more', 22, '#111', 3)}</div>
        ${x.photo ? `<div class="ax_postpic" style="background: linear-gradient(160deg, ${AX_MOOD[moodOf(x.photo)]})">${ax('photo', 56, '#fff', 1.3)}<div class="ax_alt">${axKo(x.photo, x.pko)}</div></div>` : ''}
        <div class="ax_postact">${ax('heart', 26, '#ed4956', 2, '#ed4956')}${ax('cmt', 25, '#111', 1.9)}${ax('send', 24, '#111', 1.9)}<span class="ax_sp"></span>${ax('save', 24, '#111', 1.9)}</div>
        <div class="ax_postbody"><b>좋아요 ${x.likes.toLocaleString()}개</b></div>
        ${x.text ? `<div class="ax_postbody"><b>${esc(pr.handle || p.owner)}</b> ${axKo(x.text, x.ko)}</div>` : ''}
        ${x.comments.map(c => `<div class="ax_cmt"><b>${esc(savedName(p, c.from))}</b> ${axKo(c.text, c.ko)}</div>`).join('')}
        <div class="ax_postt">${esc(fmtDate(p, x.time))}</div>
      </div>
      ${axInd()}`;
}
function diaryScreen(p, now) {
    const ds = (p.diary || []).map((x, k) => [x, k]).reverse(), x0 = parts(now);
    const have = new Set((p.diary || []).map(d => d.date));
    // the week up to the story's today (no weekday names: the story's dates carry no year)
    const days = [];
    if (x0) for (let n = 6; n >= 0; n--) { const d = new Date(2001, x0.mo - 1, x0.d - n); days.push(`${pad(d.getMonth() + 1)}-${pad(d.getDate())}`); }
    return `${axBar(p, now, '#3d3127')}
      <div class="ax_dytop"><button type="button" class="ax_back" data-go="home">${ax('back', 22, '#8a6d4a', 2.4)}</button>${ax('search', 22, '#8a6d4a')}</div>
      <div class="ax_scroll">
        <div class="ax_dymonth"><b>${x0 ? `${x0.mo}월` : '일기'}</b><span>${ds.length}편</span></div>
        ${days.length ? `<div class="ax_strip">${days.map(d => `<b class="${d === String(now).slice(0, 5) ? 'on' : ''} ${have.has(d) ? 'd' : ''}">${Number(d.slice(3))}</b>`).join('')}</div>` : ''}
        ${ds.length ? ds.map(([y, k]) => `
          <button type="button" class="ax_dcard" data-go="diaryone" data-i="${k}"><span class="ax_dd"><b class="cg_num">${esc(String(parts(y.date)?.d || ''))}</b>${esc(`${parts(y.date)?.mo || ''}월`)}</span><span class="ax_dtx"><span class="ax_dh">${esc(y.title || '')}${y.kt && koOn() ? `<small>${esc(y.kt)}</small>` : ''}</span><span class="ax_dp">${esc(y.text.replace(/\s+/g, ' '))}</span></span></button>`).join('') : '<div class="ax_empty">일기가 없어요</div>'}
      </div>
      <span class="ax_fab" aria-hidden="true">${ax('pen', 24, '#fbf8f2')}</span>
      ${axInd()}`;
}
function diaryOne(p, now, k) {
    const x = (p.diary || [])[k];
    if (!x) return diaryScreen(p, now);
    return `${axBar(p, now, '#3d3127')}
      <div class="ax_dytop"><button type="button" class="ax_back" data-go="diary">${ax('back', 22, '#8a6d4a', 2.4)}${esc(`${parts(x.date)?.mo || ''}월`)}</button>${x.ko ? `<button type="button" class="na_ph_kochip ax_kobtn ${koOn() ? 'on' : ''}">한국어</button>` : ''}</div>
      <div class="ax_scroll ax_paper">
        <div class="ax_pdt">${esc(fmtDate(p, x.date))}</div>
        <h3>${esc(x.title || '')}</h3>${x.kt && koOn() ? `<div class="ax_pkt">${esc(x.kt)}</div>` : ''}
        <p>${esc(x.text)}</p>
        ${x.ko && koOn() ? `<div class="ax_pko">${esc(x.ko)}</div>` : ''}
      </div>
      ${axInd()}`;
}
// ---- 메시지 · 전화 · 사진 · 메모 · 검색 · 캘린더 · 메일 · 설정 · 카메라 (v3.118): the boards' layout in the home's flat look —
// each app one colour (메시지 · 전화 blue, the rest their home icon's), round glass buttons, white cards, no gradients
const AXB = { msg: 'blue', thread: 'blue', call: 'blue', callmiss: 'blue', callwho: 'blue', photo: 'apri', photoone: 'apri', note: 'butter', noteone: 'butter', search: 'sky', searchone: 'sky', cal: 'brick', calone: 'brick', mail: 'sky', mailone: 'sky', set: 'slate', settheme: 'slate', cam: 'apri' };
const AXB_C = { blue: ['#2f6bff', '#e1e9ff'], apri: ['#a65a4e', '#f7e3d7'], butter: ['#7f6a22', '#f6edcf'], sky: ['#3f6a9e', '#dde8f4'], brick: ['#a14a42', '#f3dcd9'], slate: ['#454d5a', '#e6e8ec'] };
// people outside the archive get a letter on one of the home icons' colours
const AX_AV = ['#8faed1', '#a699c9', '#d89f98', '#89b892', '#d494a7', '#a2a7af', '#dcc680'];
const axTint = n => AX_AV[[...String(n)].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) % 9973, 7) % AX_AV.length];
const axLetter = (n, z) => `<span class="ax_avc" style="width: ${z}px; height: ${z}px; font-size: ${Math.round(z * 0.4)}px; background: ${axTint(n)}">${esc([...String(n).trim()][0] || '?')}</span>`;
const axAv = (n, z, roster) => (roster.has(nameKey(n)) ? axFace(n, z) : axLetter(n, z));
const axFlat = mood => (AX_MOOD[mood] || AX_MOOD.warm).split(', ')[1];
const axCb = (go, k = 'back') => `<button type="button" class="ax_cb" data-go="${go}" aria-label="${k === 'x' ? '닫기' : '뒤로'}">${ax(k, 18, 'currentColor', 2.3)}</button>`;
const axKp = p => (hasKo(p) ? `<button type="button" class="na_ph_kochip ax_kp ${koOn() ? 'on' : ''}">가 한국어</button>` : '');
const axTop = (left, right = '') => `<div class="ax_top">${left}<span class="ax_topr">${right}</span></div>`;
const axH1 = (t, sub = '') => `<div class="ax_h1"><b>${esc(t)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
const axFind = (t = '검색') => `<div class="ax_find">${ax('search', 16, 'currentColor', 2.2)}${t}</div>`;
const axChev = ax('chev', 15, '#b7bdc6', 2.4);
const axNewest = xs => xs.map((x, k) => [x, k]).sort((a, b) => String(b[0].time).localeCompare(String(a[0].time)));
const axDay = (p, now, v) => (String(v).slice(0, 5) === String(now).slice(0, 5) ? '오늘' : fmtDate(p, v));
// days from b to a (both MM-DD), in one year; -1 when a is before b
const axDays = (a, b) => { const x = parts(a), y = parts(b); return x && y ? Math.round((new Date(2000, x.mo - 1, x.d) - new Date(2000, y.mo - 1, y.d)) / 864e5) : -1; };

function msgList(p, now, roster) {
    const ts = [...p.threads].sort((a, b) => lastTime(b).localeCompare(lastTime(a)));
    return `${axBar(p, now)}
      ${axTop(axCb('home'), axKp(p))}
      <div class="ax_scroll">
        ${axH1('메시지', ts.length ? `${ts.length}개 대화` : '')}
        ${axFind()}
        ${ts.length ? `<div class="ax_card">${ts.map(t => { const x = t.messages[t.messages.length - 1]; return `
          <button type="button" class="ax_rw" data-go="thread" data-i="${p.threads.indexOf(t)}">${x.from !== 'me' ? '<i class="ax_dot"></i>' : ''}${axAv(t.with, 48, roster)}<span class="ax_tx">
            <span class="ax_h"><b>${esc(savedName(p, t.with))}</b><small class="cg_num">${esc(listTime(p, x.time))}</small></span>
            <span class="ax_p">${esc(x.text)}${x.ko && koOn() ? `<span class="ax_ko">${esc(x.ko)}</span>` : ''}</span></span></button>`; }).join('')}</div>` : '<div class="ax_empty">메시지가 없어요</div>'}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
function threadScreen(p, now, i, roster) {
    const t = p.threads[i];
    if (!t) return msgList(p, now, roster);
    const ms = t.messages, group = new Set(ms.filter(x => x.from !== 'me').map(x => nameKey(x.from))).size > 1, saved = savedName(p, t.with);
    let day = '';
    const rows = ms.map((x, n) => {
        let out = '';
        const d = x.time.slice(0, 5), me = x.from === 'me', prev = ms[n - 1], next = ms[n + 1];
        if (d && d !== day) { day = d; out += `<div class="ax_tm"><b>${esc(axDay(p, now, x.time))}</b> ${esc(fmtTime(p, x.time))}</div>`; }
        else if (prev && prev.from !== x.from) out += '<i class="ax_gap"></i>';
        if (!me && group && (!prev || prev.from !== x.from || d !== prev.time.slice(0, 5))) out += `<div class="ax_who">${esc(savedName(p, x.from))}</div>`;
        const tail = !next || next.from !== x.from || next.time.slice(0, 5) !== d;
        out += `<div class="ax_bb ${me ? 'ax_bm' : 'ax_bt'} ${tail ? 'tail' : ''}">${esc(x.text)}${x.ko && koOn() ? `<span class="ax_k">${esc(x.ko)}</span>` : ''}</div>`;
        if (me && !next && x.time.length > 5) out += `<div class="ax_read">읽음 ${esc(fmtTime(p, x.time))}</div>`;
        return out;
    }).join('');
    return `${axBar(p, now)}
      ${axTop(`${axCb('msg')}<span class="ax_who2">${axAv(t.with, 38, roster)}<span><b>${esc(saved)}</b><small>${saved !== t.with ? esc(t.with) : '휴대전화'}</small></span></span>`, axKp(p))}
      <div class="ax_scroll ax_msgs">${rows}<i class="ax_pad big"></i></div>
      <div class="ax_ibar">${ax('lock', 14, 'currentColor')}보기 전용<span class="ax_mi">${ax('mic', 17, 'currentColor')}</span></div>
      ${axInd()}`;
}

// 전화: one row per run of the same person and kind on one day, newest first
function callRuns(p, onlyMissed) {
    const runs = [];
    for (let k = p.calls.length - 1; k >= 0; k--) {
        const c = p.calls[k], last = runs[runs.length - 1];
        if (onlyMissed && c.type !== 'missed') continue;
        if (last && nameKey(last.c.with) === nameKey(c.with) && last.c.type === c.type && last.c.time.slice(0, 5) === c.time.slice(0, 5)) last.n++;
        else runs.push({ c, k, n: 1 });
    }
    return runs;
}
const callKind = c => (c.type === 'missed' ? '부재중' : `${c.type === 'out' ? '발신' : '수신'}${c.min ? ` · ${c.min}분` : ''}`);
function callScreen(p, now, roster, onlyMissed) {
    const runs = callRuns(p, onlyMissed), day = String(now).slice(0, 5);
    const row = ({ c, k, n }) => `<button type="button" class="ax_rw" data-go="callwho" data-i="${k}"><span class="ax_ci ${c.type}">${ax(c.type, 17, 'currentColor', 2.2)}</span><span class="ax_tx"><b class="${c.type === 'missed' ? 'm' : ''}">${esc(savedName(p, c.with))}${n > 1 ? ` (${n})` : ''}</b><span class="ax_p">${callKind(c)}</span></span><small class="cg_num">${esc(listTime(p, c.time))}</small></button>`;
    const today = runs.filter(r => r.c.time.slice(0, 5) === day), before = runs.filter(r => r.c.time.slice(0, 5) !== day);
    return `${axBar(p, now)}
      ${axTop(axCb('home'))}
      <div class="ax_scroll">
        ${axH1('최근 기록', runs.length ? `${runs.reduce((s, r) => s + r.n, 0)}통` : '')}
        ${today.length ? `<div class="ax_sec">오늘</div><div class="ax_card">${today.map(row).join('')}</div>` : ''}
        ${before.length ? `<div class="ax_sec">${today.length ? '이전' : '최근'}</div><div class="ax_card">${before.map(row).join('')}</div>` : ''}
        ${runs.length ? '' : `<div class="ax_empty">${onlyMissed ? '부재중 전화가 없어요' : '통화 기록이 없어요'}</div>`}
        <i class="ax_pad big"></i>
      </div>
      <div class="ax_dock"><button type="button" class="${onlyMissed ? '' : 'on'}" data-go="call">전체</button><button type="button" class="${onlyMissed ? 'on' : ''}" data-go="callmiss">부재중</button></div>
      ${axInd()}`;
}
function callWho(p, now, k, roster) {
    const c0 = p.calls[k];
    if (!c0) return callScreen(p, now, roster, false);
    const who = c0.with, saved = savedName(p, who), ti = p.threads.findIndex(t => nameKey(t.with) === nameKey(who));
    const cs = p.calls.filter(c => nameKey(c.with) === nameKey(who)).reverse();
    const days = [...new Set(cs.map(c => c.time.slice(0, 5)))];
    const act = (k2, label, go) => (go ? `<button type="button" ${go}>${ax(k2, 21, 'currentColor')}${label}</button>` : `<span>${ax(k2, 21, 'currentColor')}${label}</span>`);
    return `${axBar(p, now)}
      ${axTop(axCb('call'))}
      <div class="ax_scroll">
        <div class="ax_ptop"><span class="ax_ring2" style="background: ${axTint(who)}">${axAv(who, 88, roster)}</span><h2>${esc(saved)}</h2><p>${saved !== who ? `저장된 이름 · ${esc(who)}` : '휴대전화'}</p></div>
        <div class="ax_acts">${act('cmt', '메시지', ti >= 0 ? `data-go="thread" data-i="${ti}"` : '')}${act('call', '전화')}${act('video', '영상')}${act('mail', '메일')}</div>
        ${days.map(d => `<div class="ax_card"><div class="ax_hd">${esc(axDay(p, now, d))}</div>${cs.filter(c => c.time.slice(0, 5) === d).map(c => `<div class="ax_lr"><span class="${c.type === 'missed' ? 'm' : ''}">${c.type === 'missed' ? '부재중 전화' : `${c.type === 'out' ? '발신' : '수신'} 전화${c.min ? ` · ${c.min}분` : ''}`}</span><span class="cg_num">${esc(fmtTime(p, c.time))}</span></div>`).join('')}</div>`).join('')}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}

// 사진: the album by day; a photo with no picture yet has a 그리기 pill
const axPic = (x, z) => (x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : ax('photo', z, '#fff', z > 40 ? 1.2 : 1.6));
function photoScreen(p, now) {
    const ps = axNewest(p.photos);
    const days = [...new Set(ps.map(([x]) => x.time.slice(0, 5)))];
    return `${axBar(p, now)}
      ${axTop(axCb('home'), `<button type="button" class="ax_kp on na_ph_looksbtn">${ax('user', 14, 'currentColor', 2.2)} 외모</button>${axKp(p)}`)}
      <div class="ax_scroll">
        ${axH1('사진', ps.length ? `${ps.length}장` : '')}
        ${ps.length ? days.map(d => { const xs = ps.filter(([x]) => x.time.slice(0, 5) === d); return `
          <div class="ax_pday">${esc(axDay(p, now, d))}<small>${xs.length}장</small></div>
          <div class="ax_pg">${xs.map(([x, k]) => `<div class="ax_pq" data-go="photoone" data-i="${k}" role="button" tabindex="0" aria-label="크게 보기" style="background: ${axFlat(x.mood)}">${axPic(x, 24)}${x.img ? '' : drawBtn(p, k, 'ax_dr')}</div>`).join('')}</div>`; }).join('') : '<div class="ax_empty">사진이 없어요</div>'}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
function photoView(p, now, k) {
    const x = p.photos[k];
    if (!x) return photoScreen(p, now);
    return `${axBar(p, now, '#fff')}
      <div class="ax_top">${axCb('photo')}<span class="ax_ttl">${esc(axDay(p, now, x.time))}<small class="cg_num">${esc(fmtTime(p, x.time))}</small></span><span class="ax_topr">${axKp(p) || '<i class="ax_cbsp"></i>'}</span></div>
      <div class="ax_pvimg ${x.img ? 'has' : ''}" style="background: ${axFlat(x.mood)}">${axPic(x, 60)}</div>
      <div class="ax_scroll">
        <div class="ax_pvcap"><p>${esc(x.caption)}${x.ko && koOn() ? `<span class="ax_k">${esc(x.ko)}</span>` : ''}</p>${x.tags ? `<div class="ax_tags">그린 태그${x.via === 'autopic' ? ' · 오토픽' : ''} · ${esc(x.tags)}</div>` : ''}</div>
        <div class="ax_pvbtns">${drawBtn(p, k, 'ax_pvdraw')}<button type="button" data-go="photo">사진</button></div>
      </div>
      ${axInd('#fff')}`;
}

// 메모: grouped like the real app (오늘 · 이전 7일 · 이전 30일 · by month)
const NOTE_MARK = /^(\[x\]|✓|✔|\[ \]|[-*•])\s*/i;
function noteScreen(p, now) {
    const ns = axNewest(p.notes);
    const label = t => { const n = axDays(now, t); return n === 0 ? '오늘' : n > 0 && n <= 7 ? '이전 7일' : n > 0 && n <= 30 ? '이전 30일' : `${parts(t)?.mo || ''}월`; };
    const groups = [];
    for (const [x, k] of ns) { const l = label(x.time), g = groups[groups.length - 1]; if (g && g.l === l) g.xs.push([x, k]); else groups.push({ l, xs: [[x, k]] }); }
    return `${axBar(p, now)}
      ${axTop(axCb('home'), axKp(p))}
      <div class="ax_scroll">
        ${axH1('메모', ns.length ? `${ns.length}개` : '')}
        ${axFind()}
        ${groups.length ? groups.map(g => `<div class="ax_sec">${esc(g.l)}</div><div class="ax_card">${g.xs.map(([x, k]) => `
          <button type="button" class="ax_rw ax_rwn" data-go="noteone" data-i="${k}"><span class="ax_tx"><b>${axKo(x.title || x.text.slice(0, 30), x.kt)}</b><span class="ax_p1"><span class="cg_num">${esc(listTime(p, x.time))}</span>${esc(x.text.split('\n').map(l => l.trim().replace(NOTE_MARK, '')).filter(Boolean).join(' · '))}</span></span></button>`).join('')}</div>`).join('') : '<div class="ax_empty">메모가 없어요</div>'}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
// a note's lines: "- a", "[ ] a", "[x] a", "✓ a" read as a checklist, the rest as plain lines
function noteOne(p, now, k) {
    const n = p.notes[k];
    if (!n) return noteScreen(p, now);
    const body = String(n.text || '').split('\n').map(l => {
        const t = l.trim(), mt = t.match(NOTE_MARK);
        if (!mt) return t ? `<div class="ax_nline">${esc(t)}</div>` : '<div class="ax_nline"><br></div>';
        const done = /^(\[x\]|✓|✔)/i.test(mt[1]);
        return `<div class="ax_chk ${done ? 'd' : ''}"><i>${done ? ax('check', 13, '#5a4a1f', 3.2) : ''}</i><span>${esc(t.slice(mt[0].length))}</span></div>`;
    }).join('');
    return `${axBar(p, now)}
      ${axTop(axCb('note'), axKp(p))}
      <div class="ax_scroll ax_nd">
        <div class="ax_ndt cg_num">${esc(fmtDate(p, n.time))} ${esc(fmtTime(p, n.time))}</div>
        <h2>${esc(n.title || '')}</h2>${n.kt && koOn() ? `<div class="ax_nkt">${esc(n.kt)}</div>` : ''}
        ${body ? `<div class="ax_card ax_ncard">${body}</div>` : ''}
        ${n.ko && koOn() ? `<div class="ax_nko">${esc(n.ko)}</div>` : ''}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}

// 검색: what they looked up and when (the result pages aren't in the archive)
function searchScreen(p, now) {
    const ss = axNewest(p.searches);
    return `${axBar(p, now)}
      ${axTop(axCb('home'), axKp(p))}
      <div class="ax_scroll">
        ${axH1('검색')}
        <div class="ax_find ax_findbig">${ax('search', 18, 'currentColor', 2.2)}<span>검색어 또는 주소</span></div>
        ${ss.length ? `<div class="ax_sec">최근 검색</div><div class="ax_card">${ss.map(([x, k]) => `
          <button type="button" class="ax_rw" data-go="searchone" data-i="${k}">${ax('clock', 20, '#8faed1', 1.9)}<span class="ax_tx"><b class="ax_n">${esc(x.q)}</b>${x.ko && koOn() ? `<span class="ax_p">${esc(x.ko)}</span>` : ''}</span><small class="cg_num">${esc(listTime(p, x.time))}</small></button>`).join('')}</div>` : '<div class="ax_empty">검색 기록이 없어요</div>'}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
function searchOne(p, now, k) {
    const x = p.searches[k];
    if (!x) return searchScreen(p, now);
    return `${axBar(p, now)}
      ${axTop(axCb('search'), axKp(p))}
      <div class="ax_scroll">
        <div class="ax_find ax_findq">${ax('search', 16, 'currentColor', 2.2)}<span>${esc(x.q)}</span></div>
        <div class="ax_card ax_sqk"><small>이 검색 · <span class="cg_num">${esc(fmtDate(p, x.time, true))} ${esc(fmtTime(p, x.time))}</span></small><p>${esc(x.q)}</p>${x.ko && koOn() ? `<div class="ax_k">${esc(x.ko)}</div>` : ''}</div>
        <div class="ax_sqn">검색 결과 페이지는 아카이브에 없어서 보여주지 않아요.<br>검색어와 시간만 남아요.</div>
      </div>
      ${axInd()}`;
}

// 캘린더: the story's month (no weekdays: its dates carry no year), then the days that have something
const AX_EVC = ['#b0564e', '#8faed1', '#89b892', '#dcc680', '#a699c9'];
function annivList(m) {
    const rows = datedRows(m);
    return annivsOf(m).map(a => { const r = rows.find(x => sectionKey(x.s) === a.key); return r && rowDay(r) ? { name: a.name, date: rowDay(r) } : null; }).filter(Boolean);
}
function calScreen(p, now, m) {
    const day = String(now).slice(0, 5), x0 = parts(now) || parts(p.events[0]?.date) || { mo: 1, d: 1 };
    const an = annivList(m);
    const evs = p.events.map((e, k) => ({ e, k }));
    const marked = new Set([...p.events.map(e => e.date), ...an.map(a => a.date)]);
    const len = new Date(2000, x0.mo, 0).getDate();
    const grid = Array.from({ length: len }, (_, n) => { const d = `${pad(x0.mo)}-${pad(n + 1)}`; return `<b class="${d === day ? 't' : ''} ${marked.has(d) ? 'e' : ''}">${n + 1}</b>`; }).join('');
    const row = ({ e, k }, when = '') => `<button type="button" class="ax_ev" data-go="calone" data-i="${k}"><i style="background: ${AX_EVC[k % AX_EVC.length]}"></i><span class="ax_tx"><b>${esc(e.title)}</b>${e.ko && koOn() ? `<span class="ax_p">${esc(e.ko)}</span>` : ''}</span><small class="cg_num">${e.time ? esc(fmtTime(p, `${e.date} ${e.time}`)) : '하루 종일'}${when ? `<br>${esc(when)}` : ''}</small></button>`;
    const anRow = a => `<div class="ax_ev"><i style="background: #d494a7"></i><span class="ax_tx"><b>♥ ${esc(a.name)}</b><span class="ax_p">기념일 · 매년 ${esc(fmtDate(p, a.date))}</span></span></div>`;
    const soon = [...new Set(evs.filter(x => x.e.date >= day).map(x => x.e.date))].sort();
    if (an.some(a => a.date === day) && !soon.includes(day)) soon.unshift(day);
    const past = evs.filter(x => x.e.date < day).reverse();
    return `${axBar(p, now)}
      ${axTop(axCb('home'), axKp(p))}
      <div class="ax_scroll">
        ${axH1(`${x0.mo}월`, p.events.length ? `일정 ${p.events.length}` : '')}
        <div class="ax_card"><div class="ax_cal7">${grid}</div></div>
        ${soon.map(d => `<div class="ax_sec">${esc(fmtDate(p, d))}${d === day ? ' · 오늘' : ''}</div><div class="ax_card">${d === day ? an.filter(a => a.date === d).map(anRow).join('') : ''}${evs.filter(x => x.e.date === d).map(x => row(x)).join('')}</div>`).join('')}
        ${soon.length ? '' : '<div class="ax_sec">다가오는 일정 없음</div>'}
        ${an.length ? `<div class="ax_sec">기념일</div><div class="ax_card">${an.map(anRow).join('')}</div>` : ''}
        ${past.length ? `<div class="ax_sec">지난 일정</div><div class="ax_card">${past.map(x => row(x, fmtDate(p, x.e.date, true))).join('')}</div>` : ''}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
function calOne(p, now, k, m) {
    const e = p.events[k];
    if (!e) return calScreen(p, now, m);
    return `${axBar(p, now)}
      ${axTop(axCb('cal'), axKp(p))}
      <div class="ax_scroll">
        <div class="ax_card ax_edh"><h2>${esc(e.title)}</h2>${e.ko && koOn() ? `<div class="ax_k">${esc(e.ko)}</div>` : ''}<p class="cg_num">${esc(fmtDate(p, e.date))}<br>${e.time ? esc(fmtTime(p, `${e.date} ${e.time}`)) : '하루 종일'}</p></div>
        <div class="ax_card"><div class="ax_lr"><span>캘린더</span><span class="ax_v"><i class="ax_cdot" style="background: ${AX_EVC[k % AX_EVC.length]}"></i>${esc(p.owner)}</span></div></div>
      </div>
      ${axInd()}`;
}

// 메일
function mailScreen(p, now) {
    const ms = (p.mails || []).map((x, k) => [x, k]).reverse(), unread = ms.filter(([x]) => x.unread).length;
    return `${axBar(p, now)}
      ${axTop(axCb('home'), axKp(p))}
      <div class="ax_scroll">
        ${axH1('받은편지함', unread ? `안 읽음 ${unread}` : '')}
        ${axFind()}
        ${ms.length ? `<div class="ax_card">${ms.map(([x, k]) => `
          <button type="button" class="ax_rw ax_rwm" data-go="mailone" data-i="${k}">${x.unread ? '<i class="ax_dot"></i>' : ''}${axLetter(x.from, 42)}<span class="ax_tx">
            <span class="ax_h"><b>${esc(x.from)}</b><small class="cg_num">${esc(listTime(p, x.time))}</small></span>
            <span class="ax_s ${x.unread ? 'u' : ''}">${esc(x.subject)}</span><span class="ax_p">${axKo(x.text.replace(/\s+/g, ' '), x.ko ? x.ko.replace(/\s+/g, ' ') : '')}</span></span></button>`).join('')}</div>` : '<div class="ax_empty">메일이 없어요</div>'}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
function mailOne(p, now, k) {
    const x = (p.mails || [])[k];
    if (!x) return mailScreen(p, now);
    return `${axBar(p, now)}
      ${axTop(axCb('mail'), axKp(p))}
      <div class="ax_scroll">
        <div class="ax_card ax_rw ax_mfrom">${axLetter(x.from, 44)}<span class="ax_tx"><b>${esc(x.from)}</b><span class="ax_p">받는 사람: ${esc(p.owner)}</span></span><small class="cg_num">${esc(fmtDate(p, x.time, true))} ${esc(fmtTime(p, x.time))}</small></div>
        <div class="ax_msub">${axKo(x.subject, x.ks)}</div>
        <div class="ax_mbody">${esc(x.text)}</div>
        ${x.ko && koOn() ? `<div class="ax_mko">${esc(x.ko)}</div>` : ''}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}

// 설정
function setScreen(p, now, m) {
    const looks = looksOf(), nLooks = peopleList(m).filter(n => looks[nameKey(n)]).length;
    const si = (c, k) => `<span class="ax_si" style="background: ${c}">${ax(k, 17, '#fff')}</span>`;
    return `${axBar(p, now)}
      ${axTop(axCb('home'))}
      <div class="ax_scroll">
        ${axH1('설정')}
        <div class="ax_card"><div class="ax_rw ax_me">${axFace(p.owner, 56)}<span class="ax_tx"><b>${esc(p.owner)}</b><span class="ax_p">${esc([p.profile?.handle, COUNTRIES[p.country] || p.country].filter(Boolean).join(' · '))}</span></span></div></div>
        <div class="ax_sec">화면</div>
        <div class="ax_card">
          <button type="button" class="ax_rw" data-go="settheme">${si('#a699c9', 'palette')}<span class="ax_tx"><span class="ax_n">테마</span></span><span class="ax_v">${p.theme === 'gray' ? '화이트 그레이' : '컬러 젤'}</span>${axChev}</button>
          <button type="button" class="ax_rw na_ph_kochip ax_koline">${si('#89b892', 'lang')}<span class="ax_tx"><span class="ax_n">한국어 보기</span></span><span class="ax_sw ${koOn() ? 'on' : ''}"></span></button>
        </div>
        <div class="ax_foot">외국어로 된 문자 · 메모 · 글 밑에 한국어를 붙여요.</div>
        <div class="ax_sec">일반</div>
        <div class="ax_card">
          <label class="ax_rw">${si('#8faed1', 'globe')}<span class="ax_tx"><span class="ax_n">국적</span></span><span class="ax_v">${esc(COUNTRIES[p.country] || p.country || '')}</span>${axChev}<select class="na_ph_country ax_sel" aria-label="국적">${Object.entries(COUNTRIES).map(([k, v]) => `<option value="${k}" ${k === p.country ? 'selected' : ''}>${v}</option>`).join('')}${COUNTRIES[p.country] ? '' : `<option value="${esc(p.country)}" selected>${esc(p.country)}</option>`}</select></label>
          <button type="button" class="ax_rw na_ph_looksbtn2">${si('#d89f98', 'user')}<span class="ax_tx"><span class="ax_n">외모</span></span><span class="ax_v">${nLooks ? `${nLooks}명` : ''}</span>${axChev}</button>
          <div class="ax_rw">${si('#a2a7af', 'info')}<span class="ax_tx"><span class="ax_n">이 폰에 대해</span></span><span class="ax_v cg_num">${p.upto >= 0 ? `#${p.upto}까지` : ''}</span></div>
        </div>
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
function setTheme(p, now) {
    const mini = gray => `<span class="ax_mini"><i class="b1" ${gray ? 'style="opacity: 0.75"' : ''}></i><i class="b2" ${gray ? 'style="opacity: 0.75"' : ''}></i><i class="w" style="left: 8px"></i><i class="w" style="left: 58px"></i><span class="g">${(gray ? Array(8).fill('rgba(255, 255, 255, 0.5)') : ['#e8b8a8', '#eceef2', '#ead69c', '#acc9ad', '#e2b3c3', '#a8c1df', '#bdb1db', '#bcc0c6']).map(c => `<i style="background: ${c}"></i>`).join('')}</span><i class="d"></i></span>`;
    const opt = (v, label) => { const on = (p.theme === 'gray') === (v === 'gray'); return `<button type="button" class="ax_tp na_ph_theme" data-v="${v}">${mini(v === 'gray')}<span>${label}</span><span class="ax_radio ${on ? 'on' : ''}">${on ? ax('check', 14, '#fff', 3.4) : ''}</span></button>`; };
    return `${axBar(p, now)}
      ${axTop(axCb('set'))}
      <div class="ax_scroll">${axH1('테마')}<div class="ax_card ax_themes">${opt('gel', '컬러 젤')}${opt('gray', '화이트 그레이')}</div><div class="ax_foot">홈 화면과 잠금화면에 쓰여요.</div></div>
      ${axInd()}`;
}
function camScreen(p, now, k, busy) {
    const shot = k >= 0 ? p.photos[k] : null, last = p.photos[p.photos.length - 1], th = shot || last;
    const t = recentTrackers(1)[0];
    const modes = '<div class="ax_modes"><span>동영상</span><span class="on">사진</span><span>인물</span></div>';
    const bar = `<div class="ax_cbar"><button type="button" class="ax_cthumb" data-go="photo" aria-label="사진" style="--axbg: ${axFlat(th?.mood || 'green')}">${th?.img ? `<img src="${esc(th.img)}" alt="">` : ''}</button><button type="button" class="ax_shut na_ph_shutter" aria-label="찍기" ${busy ? 'disabled' : ''}><span>${busy ? busyHtml : ''}</span></button><span class="ax_flip" aria-hidden="true">${ax('flip', 22, '#fff')}</span></div>`;
    const top = pill => `<div class="ax_camtop">${ax('bolt', 22, '#fff')}<span class="ax_pill">${pill}</span><button type="button" class="ax_back" data-go="home" aria-label="닫기">${ax('x', 22, '#fff', 2.4)}</button></div>`;
    if (shot) return `${axBar(p, now, '#fff')}
      ${top('사진에 넣었어요')}
      <div class="ax_shot" style="background: ${axFlat(shot.mood)}">${shot.img ? `<img src="${esc(shot.img)}" alt="">` : ax('photo', 64, 'rgba(255, 255, 255, 0.7)', 1.2)}
        <div class="ax_sheet"><small>방금 찍은 사진</small><p>${esc(shot.caption)}</p>${shot.ko && koOn() ? `<div class="ax_k">${esc(shot.ko)}</div>` : ''}
          <div class="ax_btns">${drawBtn(p, k, 'ax_camdraw')}<button type="button" data-go="photoone" data-i="${k}">사진</button><button type="button" data-go="cam">다시 찍기</button></div></div></div>
      ${modes}${bar}${axInd('#fff')}`;
    return `${axBar(p, now, '#fff')}
      ${top(busy ? '찍는 중…' : `지금 장면 · ${esc(fmtDate(p, now, true))} ${esc(fmtTime(p, now))}`)}
      <div class="ax_vf"><i class="ax_scene" style="background: radial-gradient(60% 50% at 30% 35%, #f2c08f 0, transparent 60%), radial-gradient(50% 45% at 75% 60%, #8a5a7a 0, transparent 65%), linear-gradient(170deg, ${AX_MOOD[last?.mood || 'warm']})"></i>
        <i class="ax_gl" style="left: 33.3%; top: 0; bottom: 0; width: 1px"></i><i class="ax_gl" style="left: 66.6%; top: 0; bottom: 0; width: 1px"></i><i class="ax_gl" style="top: 33.3%; left: 0; right: 0; height: 1px"></i><i class="ax_gl" style="top: 66.6%; left: 0; right: 0; height: 1px"></i>
        <i class="ax_focus"></i>${t?.place ? `<span class="ax_hint">${esc(t.place)}</span>` : ''}<span class="ax_zoom"><span>.5</span><span class="on">1×</span><span>2</span></span></div>
      ${modes}${bar}${axInd('#fff')}`;
}

function mapScreen(p, m) {
    const pl = placesOf(m, p.owner);
    return `${head(p, '다녀간 곳', { chip: false, sub: pl.length ? `${pl.length}곳` : '' })}
      <div class="na_ph_mapart" aria-hidden="true">${pl.slice(0, 5).map((_, k) => `<i style="left:${[18, 62, 38, 80, 28][k]}%;top:${[30, 22, 58, 62, 78][k]}%">${ic('map', 18, 2.2)}</i>`).join('')}</div>
      <div class="na_ph_list">${pl.length ? pl.map(x => `
        <div class="na_ph_row na_ph_place">${ic('map', 18)}<div><b>${esc(x.place)}</b><p>${esc(x.scene)}</p></div><small>${esc(x.date)}${x.time ? `<br>${esc(x.time)}` : ''}</small></div>`).join('') : empty('아카이브 제목에 이 인물이 간 장소가 아직 없어요')}</div>`;
}

function screen(p, view, m, roster) {
    const now = storyNow(p);
    shownNow = now;
    const [v, i] = view.split(':');
    const body = v === 'lock' ? lockScreen(p, now) : v === 'home' ? homeScreen(p, now, m) : v === 'msg' ? msgList(p, now, roster)
        : v === 'thread' ? threadScreen(p, now, Number(i), roster) : v === 'call' || v === 'callmiss' ? callScreen(p, now, roster, v === 'callmiss') : v === 'callwho' ? callWho(p, now, Number(i), roster)
        : v === 'photo' ? photoScreen(p, now) : v === 'photoone' ? photoView(p, now, Number(i))
        : v === 'note' ? noteScreen(p, now) : v === 'noteone' ? noteOne(p, now, Number(i)) : v === 'search' ? searchScreen(p, now) : v === 'searchone' ? searchOne(p, now, Number(i))
        : v === 'cal' ? calScreen(p, now, m) : v === 'calone' ? calOne(p, now, Number(i), m) : v === 'map' ? mapScreen(p, m)
        : v === 'sns' ? snsScreen(p, now) : v === 'snspost' ? snsPost(p, now, Number(i)) : v === 'mail' ? mailScreen(p, now) : v === 'mailone' ? mailOne(p, now, Number(i))
        : v === 'diary' ? diaryScreen(p, now) : v === 'diaryone' ? diaryOne(p, now, Number(i)) : v === 'set' ? setScreen(p, now, m) : v === 'settheme' ? setTheme(p, now)
        : v === 'cam' ? camScreen(p, now, i === undefined ? -1 : Number(i), shooting.has(nameKey(p.owner))) : homeScreen(p, now, m);
    // the home is the design board itself, at its own size, scaled to the screen (--k)
    // every app but 지도: drawn at the boards' size too, each its own app look
    if (!['map', 'home', 'lock'].includes(v)) { const c = AXB_C[AXB[v]]; return `<div class="na_ph_scr app ax ax_${v} v_${v}${c ? ' axb' : ''}" style="--ph-acc:var(--ph-${p.accent})${c ? `; --axd: ${c[0]}; --axc: ${c[1]}` : ''}"><div class="cg_canvas ax_canvas">${body}</div></div>`; }
    if (v === 'home' || v === 'lock') return `<div class="na_ph_scr cg ${p.theme === 'gray' ? 'cg_mono' : 'cg_gel'} v_${v}" style="--ph-acc:var(--ph-${p.accent})"><div class="cg_canvas">${body}</div></div>`;
    const glass = v === 'lock';
    return `<div class="na_ph_scr ${glass ? `glass w_${p.wall}` : 'app'} v_${v}" style="--ph-acc:var(--ph-${p.accent})">${statusBar(p, now)}<div class="na_ph_body">${body}</div><button type="button" class="na_ph_bar" data-go="home" aria-label="홈"></button></div>`;
}

// ---- the window
export async function openPhone(who = null) {
    const c = ctx();
    const m = getMeta();
    m.phones = m.phones && typeof m.phones === 'object' ? m.phones : {};
    const names = peopleList(m);
    const roster = new Set(names.map(nameKey));
    let owner = who && names.some(n => nameKey(n) === nameKey(who)) ? names.find(n => nameKey(n) === nameKey(who)) : (names.find(n => m.phones[nameKey(n)]) || names[0] || null);
    let view = 'lock', menu = false, sheet = false, adding = false, loreOpen = false;
    const loreExp = new Set(), loreEnts = new Map(); // books opened to their entries, and their entries once read
    // the phone has the screen to itself: one layer over everything (a dialog, so the extension's colours and
    // SillyTavern's top layer both hold), the people along the top, the controls in a sheet behind ⚙
    let sheetOpen = false;
    const $root = $(`
      <div class="na_popup na_v2 na_phone na_phl_root">
        <div class="na_phl_top">
          <div class="na_ph_owners"></div>
          <button type="button" class="na_phl_btn na_phl_gear" aria-label="폰 설정" aria-expanded="false">${svgGear}</button>
          <button type="button" class="na_phl_btn na_phl_close" aria-label="닫기">${ic('x', 20, 2.4)}</button>
        </div>
        <div class="na_ph_wrap"><div class="na_ph_frame"></div></div>
        <div class="na_phl_shade" hidden></div>
        <div class="na_phl_sheet" hidden>
          <div class="na_phl_grab"></div>
          <div class="na_phl_sheethead"><b>캐릭터 휴대폰</b><small>아카이브에 있는 만큼만 · 보기 전용</small></div>
          <div class="na_ph_addrow" hidden><input type="text" class="text_pole na_ph_addname" placeholder="로어북에만 있는 인물 이름" enterkeyhint="done"><button type="button" class="na_v2_pillbtn na_ph_addok">추가</button></div>
          <div class="na_ph_ctrl"></div>
        </div>
      </div>`);
    const setSheet = on => { sheetOpen = on; $root.find('.na_phl_sheet, .na_phl_shade').prop('hidden', !on); $root.find('.na_phl_gear').attr('aria-expanded', String(on)).toggleClass('on', on); };
    const phone = () => (owner ? m.phones[nameKey(owner)] : null);
    const drawOwners = () => {
        $root.find('.na_ph_owners').html(`${names.map(n => `
          <button type="button" class="na_ph_pick ${n === owner ? 'on' : ''}" data-n="${esc(n)}">${faceHtml(n, 40)}<span>${esc(n)}</span>${m.phones[nameKey(n)] ? '<i></i>' : ''}</button>`).join('')}
          <button type="button" class="na_ph_pick na_ph_addp" title="인물 넣기"><span class="na_ph_addic">${ic('plus', 18, 2)}</span><span>넣기</span></button>`);
        $root.find('.na_ph_addrow').prop('hidden', !adding);
    };
    const drawPhone = (keep = false) => {
        const p = phone();
        if (!owner) { $root.find('.na_ph_frame').html(''); return; }
        if (!p) {
            $root.find('.na_ph_frame').html(`
              <div class="na_ph_scr glass w_dusk"><div class="na_ph_sb"><span></span><i>${ic('sig', 15)}${ic('bat', 20, 1.6)}</i></div>
                <div class="na_ph_body na_ph_make">
                  <div class="na_ph_makecard">
                    <span class="na_ph_makeface">${faceHtml(owner, 64)}</span>
                    <b>${esc(owner)}의 폰</b>
                    <p>${phoneLore(m).length ? '아카이브와 로어북을' : '아카이브를'} 읽고 메시지 · 통화 · 사진 · 메모 · 검색 · 일정을 채워요. 국적에 맞는 말로 쓰고 한국어를 밑에 붙여요.</p>
                    <button type="button" class="na_ph_makebtn">폰 만들기</button>
                    <small>초안 모델 · ${esc(drLabel())}</small>
                  </div>
                </div></div>`);
            return;
        }
        const top = keep ? $root.find('.na_ph_body, .ax_scroll').scrollTop() : 0;
        $root.find('.na_ph_frame').html(screen(p, view, m, roster));
        if (sheet && (view === 'photo' || view === 'set')) $root.find('.na_ph_scr').append(looksSheet(m));
        if (keep) $root.find('.na_ph_body, .ax_scroll').scrollTop(top);
    };
    // 참고 로어북: each book with its switch; › opens its entries, each with its own (a book with some left out shows −)
    const LCK = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path class="na_ck_v" d="M5 12.5l4.5 4.5L19 7.5"/><path class="na_ck_p" d="M6 12h12"/></svg>';
    const loreSum = () => { const on = phoneLore(m); return on.length ? on.map(b => (loreOff(m, b).size ? `${b} (일부)` : b)).join(', ') : '없음 · 아카이브만 읽어요'; };
    const loreRow = () => {
        const on = phoneLore(m);
        const all = loreOpen ? (ctx().getWorldInfoNames?.() || []) : [];
        const book = b => {
            const picked = on.includes(b), off = loreOff(m, b), ents = loreEnts.get(b), open = loreExp.has(b);
            const n = ents ? ents.length : 0, onN = picked ? (ents ? ents.filter(e => !off.has(e.uid)).length : null) : 0;
            return `
              <div class="na_ph_lorebook">
                <label class="na_ph_loreitem"><span class="na_ck ${picked && off.size ? 'part' : ''}"><input type="checkbox" class="na_ph_lorepick" value="${esc(b)}" ${picked ? 'checked' : ''}>${LCK}</span><span class="na_ph_lorename">${esc(b)}</span>${ents && picked && off.size ? `<small>${onN}/${n}</small>` : ''}</label>
                <button type="button" class="na_ph_loreexp ${open ? 'on' : ''}" data-b="${esc(b)}" aria-label="${open ? '항목 닫기' : '항목 보기'}" aria-expanded="${open}">${ic(open ? 'down' : 'right', 15, 2.2)}</button>
              </div>
              ${open ? `<div class="na_ph_loreents">${!ents ? `<small class="na_ph_lorewait">${busyHtml} 항목 읽는 중</small>` : ents.length ? ents.map(e => `
                <label class="na_ph_loreent"><span class="na_ck"><input type="checkbox" class="na_ph_loreentpick" data-b="${esc(b)}" data-u="${esc(e.uid)}" ${picked && !off.has(e.uid) ? 'checked' : ''}>${LCK}</span><span>${esc(e.title)}</span>${e.always ? '<em>항상</em>' : ''}</label>`).join('') : '<small class="na_ph_lorewait">쓸 수 있는 항목이 없어요</small>'}</div>` : ''}`;
        };
        return `
          <button type="button" class="na_ph_crow na_ph_lorebtn"><span><b>참고 로어북</b><small>${esc(loreSum())}</small></span>${ic(loreOpen ? 'down' : 'right', 16, 2.2)}</button>
          ${loreOpen ? `<div class="na_ph_lorelist">${all.length ? `<div class="na_ph_lorescroll">${all.map(book).join('')}</div>` : '<div class="na_empty">로어북이 없어요</div>'}<small>이 채팅의 모든 폰이 같이 읽어요 · 2만 토큰까지 통째로</small></div>` : ''}`;
    };
    const drawCtrl = () => {
        const p = phone();
        if (!p) { $root.find('.na_ph_ctrl').html(owner ? loreRow() : ''); return; }
        const n = newSections(m, p);
        $root.find('.na_ph_ctrl').html(`${loreRow()}
          <label class="na_ph_crow"><span><b>롤플에 넣기</b><small>켜면 이 폰의 최근 문자 · 일정이 주입돼요</small></span><input type="checkbox" class="na_toggle na_ph_inject" ${p.inject ? 'checked' : ''}></label>
          <div class="na_ph_cbtns">
            <button type="button" class="na_v2_btn na_ph_update">${ic('redo', 15)}<span>새로 일어난 일 반영${n ? ` · 새 섹션 ${n}` : ''}</span></button>
            <button type="button" class="na_v2_btn na_ph_more ${menu ? 'on' : ''}" aria-label="${menu ? '메뉴 닫기' : '더 보기'}" aria-expanded="${menu}">${menu ? ic('x', 16, 2.4) : '⋯'}</button>
          </div>
          ${menu ? `
          <div class="na_ph_menu">
            <small class="na_ph_menunote">테마 · 국적 · 외모는 폰 안 설정 앱에 있어요</small>
            <div class="na_ph_menubtns"><button type="button" class="na_v2_pillbtn na_ph_remake">처음부터 다시 만들기</button><button type="button" class="na_v2_pillbtn na_ph_del">이 폰 지우기</button></div>
          </div>` : ''}`);
    };
    const draw = () => { drawOwners(); drawPhone(); drawCtrl(); };
    const make = async ($btn, update) => {
        const p = await withSpinner($btn, update ? '반영하는 중' : '폰 만드는 중', () => makePhone(m, owner, { update }));
        if (!p) return;
        if (!update) view = 'lock';
        draw();
        toastr.success(update ? '새로 일어난 일을 폰에 넣었어요' : `${owner}의 폰을 만들었어요`, '캐릭터 휴대폰');
    };
    // the screen changes first; saving waits
    $root.on('click', '.na_ph_pick:not(.na_ph_addp)', function () { owner = this.dataset.n; view = 'lock'; menu = false; sheet = false; draw(); });
    // a person only the lorebook knows: into the same list as 인물 도감's +
    $root.on('click', '.na_ph_addp', () => { adding = !adding; drawOwners(); if (adding) { setSheet(true); $root.find('.na_ph_addname').trigger('focus'); } });
    const addPerson = async () => {
        const v = String($root.find('.na_ph_addname').val() || '').trim();
        if (!v) return;
        const have = names.find(n => nameKey(n) === nameKey(v));
        if (!have) { m.people = [...(Array.isArray(m.people) ? m.people : []), v]; names.push(v); roster.add(nameKey(v)); }
        owner = have || v; adding = false; view = 'lock'; menu = false; sheet = false;
        $root.find('.na_ph_addname').val('');
        draw();
        if (!have) await saveMeta();
    };
    $root.on('click', '.na_ph_addok', addPerson);
    $root.on('keydown', '.na_ph_addname', e => { if (e.key === 'Enter' && !e.originalEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); addPerson(); } });
    $root.on('click', '.na_phl_gear', () => setSheet(!sheetOpen));
    $root.on('click', '.na_phl_shade', () => setSheet(false));
    $root.on('click', '.na_ph_lorebtn', () => { loreOpen = !loreOpen; drawCtrl(); if (loreOpen) setTimeout(() => $root.find('.na_ph_lorelist')[0]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0); });
    // the list is drawn again on every switch; where it was scrolled to stays
    const redrawLore = () => { const top = $root.find('.na_ph_lorescroll').scrollTop(); drawCtrl(); $root.find('.na_ph_lorescroll').scrollTop(top); };
    const setOff = (b, uids) => { m.phoneLoreOff = m.phoneLoreOff && typeof m.phoneLoreOff === 'object' ? m.phoneLoreOff : {}; if (uids.size) m.phoneLoreOff[b] = [...uids]; else delete m.phoneLoreOff[b]; };
    const setOn = (b, yes) => { const set = new Set(phoneLore(m)); if (yes) set.add(b); else set.delete(b); m.phoneLore = [...set]; };
    $root.on('change', '.na_ph_lorepick', async function () {
        // a whole book: on with every entry, or off
        setOn(this.value, this.checked); setOff(this.value, new Set());
        redrawLore();
        await saveMeta();
    });
    $root.on('click', '.na_ph_loreexp', async function () {
        const b = this.dataset.b;
        if (loreExp.has(b)) { loreExp.delete(b); return redrawLore(); }
        loreExp.add(b); redrawLore();
        if (loreEnts.has(b)) return;
        let data = null;
        try { data = await ctx().loadWorldInfo(b); } catch { /* a book that is gone */ }
        loreEnts.set(b, Object.entries(data?.entries || {})
            .filter(([, e]) => String(e?.content || '').trim() && !e.disable)
            .map(([uid, e]) => ({ uid: String(e.uid ?? uid), title: String(e.comment || (e.key || []).join(', ') || String(e.content).slice(0, 40)).trim(), always: !!e.constant })));
        redrawLore();
    });
    $root.on('change', '.na_ph_loreentpick', async function () {
        const b = this.dataset.b, u = this.dataset.u, ents = loreEnts.get(b) || [];
        const wasOn = phoneLore(m).includes(b);
        // an entry ticked in a book that was off: that book, with only this entry
        const off = wasOn ? loreOff(m, b) : new Set(ents.map(e => e.uid));
        if (this.checked) off.delete(u); else off.add(u);
        const left = ents.filter(e => !off.has(e.uid)).length;
        setOn(b, left > 0); setOff(b, left > 0 ? off : new Set());
        redrawLore();
        await saveMeta();
    });
    $root.on('click', '.na_ph_frame [data-go]', function (e) {
        const go = this.dataset.go;
        if (!go) return;
        e.stopPropagation();
        view = ['thread', 'callwho', 'noteone', 'photoone', 'searchone', 'calone', 'mailone', 'diaryone', 'snspost'].includes(go) ? `${go}:${this.dataset.i}` : go;
        const mail = go === 'mailone' ? phone()?.mails?.[Number(this.dataset.i)] : null;
        if (mail?.unread) { mail.unread = false; saveMeta(); }
        sheet = false;
        drawPhone();
        $root.find('.na_ph_body, .ax_scroll').scrollTop(view.startsWith('thread') ? 1e6 : 0);
    });
    $root.on('click', '.na_ph_looksbtn, .na_ph_looksbtn2', e => { e.stopPropagation(); sheet = true; drawPhone(true); });
    $root.on('click', '.na_ph_shutter', async e => {
        e.stopPropagation();
        const p = phone(), id = nameKey(p.owner);
        if (shooting.has(id)) return;
        shooting.add(id); drawPhone();
        try { const k = await takePhoto(m, p); if (phone() === p) view = `cam:${k}`; toastr.success('사진을 찍었어요', '캐릭터 휴대폰'); }
        catch (err) { console.error('[narrative-archive] camera', err); toastr.error(String(err?.message || err), '사진 찍기 실패'); }
        finally { shooting.delete(id); drawPhone(); }
    });
    $root.on('click', '.na_ph_lclose', e => { e.stopPropagation(); sheet = false; drawPhone(true); });
    // each box is kept as it is left
    $root.on('change', '.na_ph_lta[data-n]', function () {
        const g = globalSettings(), v = String(this.value || '').replace(/\s+/g, ' ').trim();
        g.looks = g.looks && typeof g.looks === 'object' ? g.looks : {};
        if (v) g.looks[nameKey(this.dataset.n)] = v; else delete g.looks[nameKey(this.dataset.n)];
        saveGlobal();
    });
    $root.on('click', '.na_ph_kochip:not(.na_ph_looksbtn)', e => { e.stopPropagation(); const g = globalSettings(); g.phoneKo = !koOn(); drawPhone(); if (view.startsWith('thread')) $root.find('.ax_scroll').scrollTop(1e6); saveGlobal(); });
    $root.on('click', '.na_ph_makebtn', function () { make($(this), false); });
    // one photo at a time; the screen can change while it draws
    $root.on('click', '.na_ph_draw', async function (e) {
        e.stopPropagation();
        const p = phone(), k = Number(this.dataset.k), id = `${nameKey(p.owner)}:${k}`;
        if (drawing.has(id)) return;
        drawing.add(id); drawPhone(true);
        try { await drawPhoto(m, p, k); toastr.success('사진을 그렸어요', '캐릭터 휴대폰'); }
        catch (err) { console.error('[narrative-archive] photo', err); toastr.error(String(err?.message || err), '사진 그리기 실패'); }
        finally { drawing.delete(id); drawPhone(true); }
    });
    $root.on('click', '.na_ph_update', function () { make($(this), true); });
    // what opens under the phone scrolls into sight, so the tap visibly does something
    const showOpened = sel => setTimeout(() => $root.find(sel)[0]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);
    $root.on('click', '.na_ph_more', () => { menu = !menu; drawCtrl(); if (menu) showOpened('.na_ph_menu'); });
    $root.on('change', '.na_ph_inject', async function () { phone().inject = this.checked; await saveMeta(); applyInjection(); });
    $root.on('change', '.na_ph_country', async function () { phone().country = this.value; drawPhone(); await saveMeta(); });
    $root.on('click', '.na_ph_theme', async function () { const p = phone(); if (this.dataset.v === 'gray') p.theme = 'gray'; else delete p.theme; drawPhone(); drawCtrl(); await saveMeta(); });
    $root.on('click', '.na_ph_wsw', async function () { phone().wall = this.dataset.w; drawPhone(); drawCtrl(); await saveMeta(); });
    $root.on('click', '.na_ph_remake', async function () {
        if (!await confirm('처음부터 다시 만들까요?', '지금 폰 내용은 지워지고 아카이브 전체를 다시 읽어요.')) return;
        const keep = phone().inject;
        await make($(this), false);
        if (phone() && keep) { phone().inject = true; await saveMeta(); applyInjection(); drawCtrl(); }
    });
    $root.on('click', '.na_ph_del', async () => {
        if (!await confirm('이 폰을 지울까요?', `${esc(owner)}의 폰 내용이 이 채팅에서 지워져요.`)) return;
        const was = phone()?.inject;
        delete m.phones[nameKey(owner)];
        menu = false; view = 'lock'; draw();
        await saveMeta();
        if (was) applyInjection();
    });
    draw();
    // the home board is 390 px wide: --k scales it to whatever width the screen has now
    const frame = $root.find('.na_ph_frame')[0];
    const fit = () => { const w = frame.clientWidth - 14; if (w > 0) frame.style.setProperty('--k', String(w / CG_W)); };
    const ro = new ResizeObserver(fit);
    ro.observe(frame);
    cgFonts();
    const dlg = document.createElement('dialog');
    dlg.className = 'popup na_phl';
    dlg.id = 'na_phl';
    dlg.append($root[0]);
    document.body.append(dlg);
    // toasts sit in the top layer with the phone, then go back
    let toasts = document.getElementById('toast-container');
    if (!toasts) { toasts = document.createElement('div'); toasts.id = 'toast-container'; if (toastr.options?.positionClass) toasts.classList.add(toastr.options.positionClass); }
    dlg.append(toasts);
    dlg.showModal();
    await new Promise(done => {
        const close = () => { if (dlg.open) dlg.close(); };
        // ✕, Esc, or a tap on the dark around the phone (the sheet closes first)
        $root.on('click', '.na_phl_close', close);
        $root.on('click', '.na_ph_wrap', e => { if (e.target === e.currentTarget) { if (sheetOpen) setSheet(false); else close(); } });
        dlg.addEventListener('cancel', e => { e.preventDefault(); if (sheetOpen) setSheet(false); else close(); });
        dlg.addEventListener('close', done, { once: true });
    });
    ro.disconnect();
    const t = dlg.querySelector('#toast-container');
    if (t) { if (t.childNodes.length) document.body.append(t); else t.remove(); }
    dlg.remove();
}
const svgGear = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
// the board's fonts (Inter Tight for numbers, Noto Sans KR), once
function cgFonts() {
    if (document.getElementById('na_cg_fonts')) return;
    $('head').append('<link id="na_cg_fonts" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@100;200;300;400;500;600&family=Noto+Sans+KR:wght@300;400;500;600;700&family=Noto+Serif+KR:wght@400;500;600&display=swap">');
}
