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
    const mt = String(v || '').match(/(\d{1,2})[-/.](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2}))?/);
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

// an update's new items go after the old ones; every list keeps its newest
function mergePhone(p, add) {
    const keep = (list, n) => list.slice(-n);
    for (const t of add.threads) {
        const old = p.threads.find(x => nameKey(x.with) === nameKey(t.with));
        if (old) old.messages = keep([...old.messages, ...t.messages], CAP.messages);
        else p.threads.push({ ...t, messages: keep(t.messages, CAP.messages) });
    }
    p.threads = keep(p.threads, CAP.threads);
    for (const k of LISTS) p[k] = keep([...(p[k] || []), ...(add[k] || [])], CAP[k]);
    if (add.profile?.handle || add.profile?.bio) p.profile = { ...(p.profile || {}), ...Object.fromEntries(Object.entries(add.profile).filter(([, v]) => v)) };
    for (const c of add.contacts) {
        const old = p.contacts.find(x => nameKey(x.name) === nameKey(c.name));
        if (old) old.saved = c.saved || old.saved; else p.contacts.push(c);
    }
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
export async function loreFor(m, owner) {
    const c = ctx(), re = nameRe(owner), items = [];
    for (const name of phoneLore(m)) {
        let data = null;
        try { data = await c.loadWorldInfo(name); } catch { /* a book that is gone */ }
        for (const e of Object.values(data?.entries || {})) {
            const body = String(e?.content || '').trim();
            if (!body || e.disable) continue;
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
    else m.phones[key] = { owner, inject: false, ...got, wall: got.wall || 'dusk', accent: got.accent || 'blue', country: got.country || 'KR' };
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
        const soon = p.events.filter(e => !p.now || e.date >= p.now.slice(0, 5)).slice(0, 3);
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
const listTime = (p, v) => (String(v).slice(0, 5) === String(p.now).slice(0, 5) ? fmtTime(p, v) : fmtDate(p, v, true));
const bigClock = (p, v) => { const x = parts(v); if (!x || x.h === null) return ''; return fmtOf(p).h12 ? `${x.h % 12 || 12}:${x.mi}` : `${pad(x.h)}:${x.mi}`; };
const minsOf = v => { const x = parts(v); return x ? ((x.mo * 31 + x.d) * 24 + (x.h ?? 0)) * 60 + (Number(x.mi) || 0) : 0; };
const ago = (p, v) => {
    const d = minsOf(p.now) - minsOf(v);
    if (String(v).slice(0, 5) !== String(p.now).slice(0, 5) || d < 0) return fmtDate(p, v, true);
    return d < 1 ? '지금' : d < 60 ? `${d}분 전` : `${Math.floor(d / 60)}시간 전`;
};
const lastTime = t => t.messages[t.messages.length - 1]?.time || '';

// the story's now: the newest status window when it has a time, else what the phone was made with
function storyNow(p) {
    try {
        const t = recentTrackers(1)[0];
        const d = t?.date ? headingDate(`(${t.date})`, calendars()).date : null;
        if (t && Number.isFinite(t.min) && d?.d && d.m <= 12) return `${pad(d.m)}-${pad(d.d)} ${pad(Math.floor(t.min / 60))}:${pad(t.min % 60)}`;
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
    const rows = datedRows(m), x = parts(time);
    let hit = x ? rows.filter(r => r.date.m === x.mo && r.date.d === x.d) : [];
    if (!hit.length && x) hit = rows.filter(r => r.date.m < x.mo || (r.date.m === x.mo && r.date.d <= x.d)).slice(-1);
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
const MOOD_ICO = { warm: 'photo', cool: 'photo', green: 'map', dark: 'clock', bright: 'photo', pink: 'heart' };
const koOn = () => globalSettings().phoneKo !== false;
const savedName = (p, n) => p.contacts.find(c => nameKey(c.name) === nameKey(n))?.saved || n;
const tr = (p, t, k) => `${esc(t)}${k && koOn() ? `<span class="na_ph_ko">${esc(k)}</span>` : ''}`;
const hasKo = p => [...p.threads.flatMap(t => t.messages), ...p.photos, ...p.notes, ...p.searches, ...p.events, ...(p.posts || []), ...(p.mails || []), ...(p.diary || [])].some(x => x.ko);
// a face: the archive's own face for people in the roster, else the first letter on the accent
const av = (name, size, roster) => roster.has(nameKey(name)) ? faceHtml(name, size) : `<span class="na_ph_letter" style="width:${size}px;height:${size}px">${esc([...String(name).trim()][0] || '?')}</span>`;

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
    const ev = p.events.find(e => e.date >= day);
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
        ...p.events.filter(e => e.date >= day).map(e => ({ title: e.title, when: `${e.date === day ? '' : `${fmtDate(p, e.date, true)} `}${e.time ? fmtTime(p, `${e.date} ${e.time}`) : e.date === day ? '하루 종일' : ''}`.trim() }))].slice(0, 2);
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

function msgList(p, roster) {
    const ts = [...p.threads].sort((a, b) => lastTime(b).localeCompare(lastTime(a)));
    return `${head(p, '메시지')}
      <div class="na_ph_list">${ts.length ? ts.map(t => { const x = t.messages[t.messages.length - 1]; const i = p.threads.indexOf(t); return `
        <button type="button" class="na_ph_row" data-go="thread" data-i="${i}">${av(t.with, 44, roster)}
          <div><b>${esc(savedName(p, t.with))}</b><p>${esc(x.text)}</p></div><small>${esc(listTime(p, x.time))}</small>${x.from !== 'me' ? '<i class="na_ph_dot"></i>' : ''}</button>`; }).join('') : empty('메시지가 없어요')}</div>`;
}

function threadScreen(p, i, roster) {
    const t = p.threads[i];
    if (!t) return msgList(p, roster);
    const others = new Set(t.messages.filter(x => x.from !== 'me').map(x => nameKey(x.from)));
    let day = '', prev = '';
    const lastMe = t.messages.map(x => x.from).lastIndexOf('me');
    const rows = t.messages.map((x, n) => {
        let out = '';
        const d = x.time.slice(0, 5);
        if (d && d !== day) { day = d; out += `<div class="na_ph_day">${esc(fmtDate(p, x.time))}${x.time.length > 5 ? ` ${esc(fmtTime(p, x.time))}` : ''}</div>`; prev = ''; }
        const me = x.from === 'me';
        if (!me && others.size > 1 && prev !== x.from) out += `<div class="na_ph_who">${esc(savedName(p, x.from))}</div>`;
        prev = x.from;
        out += `<div class="na_ph_b ${me ? 'me' : 'them'}">${tr(p, x.text, x.ko)}</div>`;
        if (n === lastMe && n === t.messages.length - 1 && x.time.length > 5) out += `<div class="na_ph_read">읽음 ${esc(fmtTime(p, x.time))}</div>`;
        return out;
    }).join('');
    return `
      <div class="na_ph_head na_ph_chathead">
        <button type="button" class="na_ph_back" data-go="msg" aria-label="뒤로">${ic('back', 20, 2.4)}</button>
        <div class="na_ph_who2">${av(t.with, 40, roster)}<span>${esc(savedName(p, t.with))}</span></div>
        ${hasKo(p) ? `<button type="button" class="na_ph_kochip ${koOn() ? 'on' : ''}">가 한국어</button>` : '<span></span>'}
      </div>
      <div class="na_ph_msgs">${rows}</div>
      <div class="na_ph_input">${ic('lock', 13)} 보기 전용</div>`;
}

function callScreen(p, roster) {
    const cs = [...p.calls].reverse();
    return `${head(p, '최근 기록', { chip: false })}
      <div class="na_ph_list">${cs.length ? cs.map(c => `
        <div class="na_ph_row ${c.type}">${av(c.with, 40, roster)}
          <div><b>${esc(savedName(p, c.with))}</b><p>${ic(c.type === 'out' ? 'out' : 'in', 12, 2.4)} ${c.type === 'missed' ? '부재중' : c.type === 'out' ? '발신' : '수신'}${c.min && c.type !== 'missed' ? ` · ${c.min}분` : ''}</p></div><small>${esc(listTime(p, c.time))}</small></div>`).join('') : empty('통화 기록이 없어요')}</div>`;
}

const busyHtml = '<i class="fa-solid fa-spinner fa-spin"></i>';
const drawBtn = (p, k, cls = '') => { const busy = drawing.has(`${nameKey(p.owner)}:${k}`); return `<button type="button" class="na_ph_draw ${cls}" data-k="${k}" ${busy ? 'disabled' : ''}>${busy ? `${busyHtml} 그리는 중` : p.photos[k].img ? '다시 그리기' : '그리기'}</button>`; };
const thumb = (x, size = 26) => (x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : ic(MOOD_ICO[x.mood] || 'photo', size, 1.6));
function photoScreen(p) {
    const ps = p.photos.map((x, k) => [x, k]).reverse();
    return `${head(p, '사진', { sub: ps.length ? `${ps.length}장` : '', extra: `<button type="button" class="na_ph_kochip na_ph_looksbtn">${ic('user', 12, 2.4)} 외모</button>` })}
      <div class="na_ph_photos">${ps.length ? ps.map(([x, k]) => `
        <div class="na_ph_pc"><div class="na_ph_thumb m_${x.mood} ${x.img ? 'has' : ''}" data-go="photoone" data-i="${k}" role="button" tabindex="0" aria-label="크게 보기">${thumb(x)}</div>${x.img ? '' : drawBtn(p, k, 'on_thumb')}<p>${tr(p, x.caption, x.ko)}<small>${esc(fmtDate(p, x.time, true))} ${esc(fmtTime(p, x.time))}</small></p></div>`).join('') : empty('사진이 없어요')}</div>`;
}
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

function photoView(p, k) {
    const x = p.photos[k];
    if (!x) return photoScreen(p);
    return `${head(p, '', { back: 'photo' })}
      <div class="na_ph_viewer">
        <div class="na_ph_big m_${x.mood} ${x.img ? 'has' : ''}">${thumb(x, 40)}</div>
        <p>${tr(p, x.caption, x.ko)}<small>${esc(fmtDate(p, x.time))} ${esc(fmtTime(p, x.time))}</small></p>
        ${drawBtn(p, k, 'wide')}
        ${x.tags ? `<details class="na_ph_tags"><summary>그린 태그${x.via === 'autopic' ? ' · 오토픽' : ''}</summary><code>${esc(x.tags)}</code></details>` : ''}
      </div>`;
}

function noteScreen(p, i) {
    const n = p.notes[i];
    if (n) return `${head(p, '', { back: 'note' })}
      <div class="na_ph_notebody"><small>${esc(fmtDate(p, n.time))} ${esc(fmtTime(p, n.time))}</small><h4>${tr(p, n.title, n.kt)}</h4><p>${esc(n.text)}</p>${n.ko && koOn() ? `<p class="na_ph_ko">${esc(n.ko)}</p>` : ''}</div>`;
    const ns = p.notes.map((x, k) => [x, k]).reverse();
    return `${head(p, '메모')}
      <div class="na_ph_list na_ph_cards">${ns.length ? ns.map(([x, k]) => `
        <button type="button" class="na_ph_row" data-go="noteone" data-i="${k}"><div><b>${tr(p, x.title || x.text.slice(0, 30), x.kt)}</b><p>${esc(x.text.replace(/\s+/g, ' '))}</p></div><small>${esc(listTime(p, x.time))}</small></button>`).join('') : empty('메모가 없어요')}</div>`;
}

function searchScreen(p) {
    const ss = [...p.searches].reverse();
    return `${head(p, '검색')}
      <div class="na_ph_sbar">${ic('search', 15)} 검색</div>
      <div class="na_ph_sub">최근 검색</div>
      <div class="na_ph_list">${ss.length ? ss.map(x => `
        <div class="na_ph_row na_ph_srow">${ic('clock', 16)}<div><b>${tr(p, x.q, x.ko)}</b></div><small>${esc(listTime(p, x.time))}</small></div>`).join('') : empty('검색 기록이 없어요')}</div>`;
}

function annivToday(m, now) {
    const day = String(now).slice(0, 5);
    const rows = datedRows(m);
    for (const a of annivsOf(m)) {
        const r = rows.find(x => sectionKey(x.s) === a.key);
        if (r && `${pad(r.date.m)}-${pad(r.date.d)}` === day) return a.name;
    }
    return '';
}
function calScreen(p, now, m) {
    const day = String(now).slice(0, 5);
    const soon = p.events.filter(e => e.date >= day), past = p.events.filter(e => e.date < day).reverse();
    const rows = datedRows(m);
    const anniv = annivsOf(m).map(a => { const r = rows.find(x => sectionKey(x.s) === a.key); return r ? { name: a.name, date: `${pad(r.date.m)}-${pad(r.date.d)}` } : null; }).filter(Boolean);
    const ev = e => `<div class="na_ph_ev"><span class="na_ph_evd"><b>${esc(String(parts(e.date)?.d || ''))}</b>${esc(`${parts(e.date)?.mo || ''}월`)}</span><div><b>${tr(p, e.title, e.ko)}</b>${e.time ? `<small>${esc(fmtTime(p, `${e.date} ${e.time}`))}</small>` : '<small>하루 종일</small>'}</div></div>`;
    return `${head(p, '캘린더', { sub: fmtDate(p, now) })}
      <div class="na_ph_list">
        <div class="na_ph_sub">다가오는 일정</div>${soon.length ? soon.map(ev).join('') : empty('다가오는 일정이 없어요')}
        ${anniv.length ? `<div class="na_ph_sub">기념일</div>${anniv.map(a => `<div class="na_ph_ev"><span class="na_ph_evd heart">${ic('heart', 15, 2.2)}</span><div><b>${esc(a.name)}</b><small>매년 ${esc(fmtDate(p, a.date))}</small></div></div>`).join('')}` : ''}
        ${past.length ? `<div class="na_ph_sub">지난 일정</div>${past.map(ev).join('')}` : ''}
      </div>`;
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
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01', bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', flip: 'M20 12a8 8 0 0 1-14 5M4 12a8 8 0 0 1 14-5M18 3v4h-4M6 21v-4h4', down: 'M6 9l6 6 6-6',
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
function mailScreen(p, now) {
    const ms = (p.mails || []).map((x, k) => [x, k]).reverse(), unread = ms.filter(([x]) => x.unread).length;
    return `${axBar(p, now)}
      <div class="ax_mltop"><button type="button" class="ax_back ax_blue" data-go="home">${ax('back', 22, '#2f6bff', 2.4)}사서함</button><span>편집</span></div>
      <div class="ax_scroll">
        <div class="ax_big">받은편지함</div>
        <div class="ax_search">${ax('search', 17, '#8e8e93', 2.2)}검색</div>
        ${ms.length ? ms.map(([x, k]) => `
          <button type="button" class="ax_mrow ${x.unread ? 'u' : ''}" data-go="mailone" data-i="${k}"><span class="ax_mdot">${x.unread ? '<i></i>' : ''}</span><span class="ax_mtx">
            <span class="ax_mh"><b>${esc(x.from)}</b><small class="cg_num">${esc(listTime(p, x.time))}</small>${ax('chev', 14, '#c4c4c7', 2.4)}</span>
            <span class="ax_ms">${esc(x.subject)}</span><span class="ax_mp">${axKo(x.text.replace(/\s+/g, ' '), x.ko ? x.ko.replace(/\s+/g, ' ') : '')}</span></span></button>`).join('') : '<div class="ax_empty">메일이 없어요</div>'}
      </div>
      <div class="ax_mbar">${ax('filter', 24, '#2f6bff')}<small>방금 업데이트됨<br><span>${unread ? `안 읽음 ${unread}` : '모두 읽음'}</span></small>${ax('compose', 24, '#2f6bff')}</div>
      ${axInd()}`;
}
function mailOne(p, now, k) {
    const x = (p.mails || [])[k];
    if (!x) return mailScreen(p, now);
    return `${axBar(p, now)}
      <div class="ax_mltop"><button type="button" class="ax_back ax_blue" data-go="mail">${ax('back', 22, '#2f6bff', 2.4)}받은편지함</button>${ax('down', 22, '#2f6bff', 2.4)}</div>
      <div class="ax_scroll">
        <div class="ax_mdfrom"><span class="ax_mdav">${esc([...String(x.from).trim()][0] || '?')}</span><div><b>${esc(x.from)}</b><small>받는 사람: ${esc(p.owner)}</small></div><small class="cg_num">${esc(fmtDate(p, x.time, true))} ${esc(fmtTime(p, x.time))}</small></div>
        <div class="ax_mdsub">${axKo(x.subject, x.ks)}</div>
        <div class="ax_mdbody">${esc(x.text)}</div>
        ${x.ko && koOn() ? `<div class="ax_mdko">${esc(x.ko)}</div>` : ''}
      </div>
      <div class="ax_mbar">${ax('trash', 24, '#2f6bff')}${ax('folder', 24, '#2f6bff')}${ax('reply', 24, '#2f6bff')}${ax('compose', 24, '#2f6bff')}</div>
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
function setScreen(p, now, m) {
    const looks = looksOf(), nLooks = peopleList(m).filter(n => looks[nameKey(n)]).length;
    return `${axBar(p, now)}
      <div class="ax_sttop"><button type="button" class="ax_back ax_blue" data-go="home">${ax('back', 24, '#2f6bff', 2.4)}</button></div>
      <div class="ax_scroll">
        <div class="ax_big">설정</div>
        <div class="ax_search ax_search2">${ax('search', 17, '#8e8e93', 2.2)}검색</div>
        <div class="ax_grp"><div class="ax_srow ax_me">${axFace(p.owner, 58)}<span class="ax_st"><b>${esc(p.owner)}</b><small>${esc([p.profile?.handle, COUNTRIES[p.country] || p.country].filter(Boolean).join(' · '))}</small></span></div></div>
        <div class="ax_ghead">화면</div>
        <div class="ax_grp">
          <button type="button" class="ax_srow" data-go="settheme"><span class="ax_si" style="background: #a66cf0">${ax('palette', 18, '#fff')}</span><span class="ax_st">테마</span><span class="ax_sv">${p.theme === 'gray' ? '화이트 그레이' : '컬러 젤'}</span>${ax('chev', 16, '#c4c4c7', 2.4)}</button>
          <button type="button" class="ax_srow na_ph_kochip ax_koline"><span class="ax_si" style="background: #34c759">${ax('lang', 18, '#fff')}</span><span class="ax_st">한국어 보기</span><span class="ax_sw ${koOn() ? 'on' : ''}"></span></button>
        </div>
        <div class="ax_foot">외국어로 된 문자 · 메모 · 글 밑에 한국어를 붙여요.</div>
        <div class="ax_ghead">일반</div>
        <div class="ax_grp">
          <label class="ax_srow"><span class="ax_si" style="background: #2f8cff">${ax('globe', 18, '#fff')}</span><span class="ax_st">국적</span><span class="ax_sv">${esc(COUNTRIES[p.country] || p.country || '')}</span>${ax('chev', 16, '#c4c4c7', 2.4)}<select class="na_ph_country ax_sel" aria-label="국적">${Object.entries(COUNTRIES).map(([k, v]) => `<option value="${k}" ${k === p.country ? 'selected' : ''}>${v}</option>`).join('')}${COUNTRIES[p.country] ? '' : `<option value="${esc(p.country)}" selected>${esc(p.country)}</option>`}</select></label>
          <button type="button" class="ax_srow na_ph_looksbtn2"><span class="ax_si" style="background: #ff9f0a">${ax('user', 18, '#fff')}</span><span class="ax_st">외모</span><span class="ax_sv">${nLooks ? `${nLooks}명` : ''}</span>${ax('chev', 16, '#c4c4c7', 2.4)}</button>
          <div class="ax_srow"><span class="ax_si" style="background: #8e8e93">${ax('info', 18, '#fff')}</span><span class="ax_st">이 폰에 대해</span><span class="ax_sv cg_num">${p.upto >= 0 ? `#${p.upto}까지` : ''}</span></div>
        </div>
      </div>
      ${axInd()}`;
}
function setTheme(p, now) {
    const mini = gray => `<span class="ax_mini"><i class="b1" ${gray ? 'style="opacity: 0.75"' : ''}></i><i class="b2" ${gray ? 'style="opacity: 0.75"' : ''}></i><i class="w" style="left: 8px"></i><i class="w" style="left: 58px"></i><span class="g">${(gray ? Array(8).fill('rgba(255, 255, 255, 0.5)') : ['#e8b8a8', '#eceef2', '#ead69c', '#acc9ad', '#e2b3c3', '#a8c1df', '#bdb1db', '#bcc0c6']).map(c => `<i style="background: ${c}"></i>`).join('')}</span><i class="d"></i></span>`;
    const opt = (v, label) => { const on = (p.theme === 'gray') === (v === 'gray'); return `<button type="button" class="ax_tp na_ph_theme" data-v="${v}">${mini(v === 'gray')}<span>${label}</span><span class="ax_radio ${on ? 'on' : ''}">${on ? '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ''}</span></button>`; };
    return `${axBar(p, now)}
      <div class="ax_sttop"><button type="button" class="ax_back ax_blue" data-go="set">${ax('back', 24, '#2f6bff', 2.4)}설정</button><b>테마</b><span class="ax_sp"></span></div>
      <div class="ax_scroll"><div class="ax_themes">${opt('gel', '컬러 젤')}${opt('gray', '화이트 그레이')}</div><div class="ax_foot">홈 화면과 잠금화면에 쓰여요.</div></div>
      ${axInd()}`;
}
function camScreen(p, now, k, busy) {
    const shot = k >= 0 ? p.photos[k] : null, last = p.photos[p.photos.length - 1];
    const t = recentTrackers(1)[0];
    const modes = '<div class="ax_modes"><span>타임랩스</span><span>동영상</span><span class="on">사진</span><span>인물</span><span>파노라마</span></div>';
    const bar = `<div class="ax_cbar"><button type="button" class="ax_cthumb" data-go="photo" aria-label="사진첩" style="--axbg: linear-gradient(160deg, ${AX_MOOD[(shot || last)?.mood || 'green']})">${(shot || last)?.img ? `<img src="${esc((shot || last).img)}" alt="">` : ''}</button><button type="button" class="ax_shut na_ph_shutter" aria-label="찍기" ${busy ? 'disabled' : ''}><span>${busy ? busyHtml : ''}</span></button><span class="ax_flip" aria-hidden="true">${ax('flip', 24, '#fff')}</span></div>`;
    if (shot) return `${axBar(p, now, '#fff')}
      <div class="ax_camtop">${ax('bolt', 22, '#fff')}<span class="ax_pill">사진첩에 넣었어요</span><button type="button" class="ax_back" data-go="home" aria-label="닫기">${ax('down', 22, '#fff', 2.4)}</button></div>
      <div class="ax_shot" style="background: linear-gradient(170deg, ${AX_MOOD[shot.mood || 'warm']})">${shot.img ? `<img src="${esc(shot.img)}" alt="">` : ax('photo', 64, 'rgba(255, 255, 255, 0.7)', 1.2)}
        <div class="ax_sheet"><small>방금 찍은 사진</small><p>${esc(shot.caption)}</p>${shot.ko && koOn() ? `<div class="ax_k">${esc(shot.ko)}</div>` : ''}
          <div class="ax_btns">${drawBtn(p, k, 'ax_yellow')}<button type="button" data-go="photoone" data-i="${k}">사진첩</button><button type="button" data-go="cam">다시 찍기</button></div></div></div>
      ${modes}${bar}${axInd('#fff')}`;
    return `${axBar(p, now, '#fff')}
      <div class="ax_camtop">${ax('bolt', 22, '#fff')}<span class="ax_pill">${busy ? '찍는 중…' : `지금 장면 · ${esc(fmtDate(p, now, true))} ${esc(fmtTime(p, now))}`}</span><button type="button" class="ax_back" data-go="home" aria-label="닫기">${ax('down', 22, '#fff', 2.4)}</button></div>
      <div class="ax_vf"><i class="ax_scene" style="background: radial-gradient(60% 50% at 30% 35%, #f2c08f 0, transparent 60%), radial-gradient(50% 45% at 75% 60%, #8a5a7a 0, transparent 65%), linear-gradient(170deg, ${AX_MOOD[last?.mood || 'warm']})"></i><i class="ax_vig"></i>
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
    const [v, i] = view.split(':');
    const body = v === 'lock' ? lockScreen(p, now) : v === 'home' ? homeScreen(p, now, m) : v === 'msg' ? msgList(p, roster)
        : v === 'thread' ? threadScreen(p, Number(i), roster) : v === 'call' ? callScreen(p, roster) : v === 'photo' ? photoScreen(p) : v === 'photoone' ? photoView(p, Number(i))
        : v === 'note' ? noteScreen(p, -1) : v === 'noteone' ? noteScreen(p, Number(i)) : v === 'search' ? searchScreen(p)
        : v === 'cal' ? calScreen(p, now, m) : v === 'map' ? mapScreen(p, m)
        : v === 'sns' ? snsScreen(p, now) : v === 'snspost' ? snsPost(p, now, Number(i)) : v === 'mail' ? mailScreen(p, now) : v === 'mailone' ? mailOne(p, now, Number(i))
        : v === 'diary' ? diaryScreen(p, now) : v === 'diaryone' ? diaryOne(p, now, Number(i)) : v === 'set' ? setScreen(p, now, m) : v === 'settheme' ? setTheme(p, now)
        : v === 'cam' ? camScreen(p, now, i === undefined ? -1 : Number(i), shooting.has(nameKey(p.owner))) : homeScreen(p, now, m);
    // the home is the design board itself, at its own size, scaled to the screen (--k)
    // SNS · 메일 · 일기 · 설정 · 카메라: drawn at the boards' size too, each its own app look
    if (['sns', 'snspost', 'mail', 'mailone', 'diary', 'diaryone', 'set', 'settheme', 'cam'].includes(v)) return `<div class="na_ph_scr app ax ax_${v} v_${v}" style="--ph-acc:var(--ph-${p.accent})"><div class="cg_canvas ax_canvas">${body}</div></div>`;
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
    const $root = $(`
      <div class="na_popup na_v2 na_phone">
        <div class="na_v2_titlebar"><div class="na_v2_title"><b>캐릭터 휴대폰</b><small>아카이브에 있는 만큼만 · 보기 전용</small></div><button type="button" class="na_v2_pillbtn na_ph_fullbtn">${ic('full', 14, 2.2)}폰만 보기</button></div>
        <div class="na_ph_owners"></div>
        <div class="na_ph_addrow" hidden><input type="text" class="text_pole na_ph_addname" placeholder="로어북에만 있는 인물 이름" enterkeyhint="done"><button type="button" class="na_v2_pillbtn na_ph_addok">추가</button></div>
        <div class="na_ph_wrap"><div class="na_ph_frame"></div><button type="button" class="na_ph_fullx" aria-label="폰만 보기 닫기">${ic('x', 20, 2.4)}</button></div>
        <div class="na_ph_ctrl"></div>
      </div>`);
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
        const top = keep ? $root.find('.na_ph_body').scrollTop() : 0;
        $root.find('.na_ph_frame').html(screen(p, view, m, roster));
        if (sheet && (view === 'photo' || view === 'set')) $root.find('.na_ph_scr').append(looksSheet(m));
        if (keep) $root.find('.na_ph_body').scrollTop(top);
    };
    const loreRow = () => {
        const on = phoneLore(m);
        const all = loreOpen ? (ctx().getWorldInfoNames?.() || []) : [];
        return `
          <button type="button" class="na_ph_crow na_ph_lorebtn"><span><b>참고 로어북</b><small>${on.length ? esc(on.join(', ')) : '없음 · 아카이브만 읽어요'}</small></span>${ic(loreOpen ? 'down' : 'right', 16, 2.2)}</button>
          ${loreOpen ? `<div class="na_ph_lorelist">${all.length ? all.map(b => `<label class="na_ph_loreitem"><span class="na_ck"><input type="checkbox" class="na_ph_lorepick" value="${esc(b)}" ${on.includes(b) ? 'checked' : ''}><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path class="na_ck_v" d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><span>${esc(b)}</span></label>`).join('') : '<div class="na_empty">로어북이 없어요</div>'}<small>이 채팅의 모든 폰이 같이 읽어요 · 2만 토큰까지 통째로</small></div>` : ''}`;
    };
    const drawCtrl = () => {
        const p = phone();
        if (!p) { $root.find('.na_ph_ctrl').html(owner ? loreRow() : ''); return; }
        const n = newSections(m, p);
        $root.find('.na_ph_ctrl').html(`${loreRow()}
          <label class="na_ph_crow"><span><b>롤플에 넣기</b><small>켜면 이 폰의 최근 문자 · 일정이 주입돼요</small></span><input type="checkbox" class="na_toggle na_ph_inject" ${p.inject ? 'checked' : ''}></label>
          <div class="na_ph_cbtns">
            <button type="button" class="na_v2_btn na_ph_update">${ic('redo', 15)}<span>새로 일어난 일 반영${n ? ` · 새 섹션 ${n}` : ''}</span></button>
            <button type="button" class="na_v2_btn na_ph_more" aria-label="더 보기">⋯</button>
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
    $root.on('click', '.na_ph_addp', () => { adding = !adding; drawOwners(); if (adding) $root.find('.na_ph_addname').trigger('focus'); });
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
    // 폰만 보기: the phone alone, as tall as the screen; ✕ or a tap beside it comes back
    $root.on('click', '.na_ph_fullbtn', () => $root.addClass('na_ph_full'));
    $root.on('click', '.na_ph_fullx', () => $root.removeClass('na_ph_full'));
    $root.on('click', '.na_ph_wrap', e => { if (e.target === e.currentTarget && $root.hasClass('na_ph_full')) $root.removeClass('na_ph_full'); });
    $root.on('click', '.na_ph_lorebtn', () => { loreOpen = !loreOpen; drawCtrl(); });
    $root.on('change', '.na_ph_lorepick', async function () {
        const set = new Set(phoneLore(m));
        if (this.checked) set.add(this.value); else set.delete(this.value);
        m.phoneLore = [...set];
        $root.find('.na_ph_lorebtn small').text(m.phoneLore.length ? m.phoneLore.join(', ') : '없음 · 아카이브만 읽어요');
        await saveMeta();
    });
    $root.on('click', '.na_ph_frame [data-go]', function (e) {
        const go = this.dataset.go;
        if (!go) return;
        e.stopPropagation();
        view = ['thread', 'noteone', 'photoone', 'mailone', 'diaryone', 'snspost'].includes(go) ? `${go}:${this.dataset.i}` : go;
        const mail = go === 'mailone' ? phone()?.mails?.[Number(this.dataset.i)] : null;
        if (mail?.unread) { mail.unread = false; saveMeta(); }
        sheet = false;
        drawPhone();
        $root.find('.na_ph_body').scrollTop(view.startsWith('thread') ? 1e6 : 0);
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
    $root.on('click', '.na_ph_kochip:not(.na_ph_looksbtn)', e => { e.stopPropagation(); const g = globalSettings(); g.phoneKo = !koOn(); drawPhone(); if (view.startsWith('thread')) $root.find('.na_ph_body').scrollTop(1e6); saveGlobal(); });
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
    $root.on('click', '.na_ph_more', () => { menu = !menu; drawCtrl(); });
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
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: false, large: false, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
    ro.disconnect();
}
// the board's fonts (Inter Tight for numbers, Noto Sans KR), once
function cgFonts() {
    if (document.getElementById('na_cg_fonts')) return;
    $('head').append('<link id="na_cg_fonts" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@100;200;300;400;500;600&family=Noto+Sans+KR:wght@300;400;500;600;700&family=Noto+Serif+KR:wght@400;500;600&display=swap">');
}
