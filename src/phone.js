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
import { recentTrackers } from './scenes.js';
import { confirm, esc } from './util.js';
import { worldText } from './world.js';

export const WALLS = ['dusk', 'ocean', 'forest', 'rose', 'night', 'sand', 'mono', 'aurora'];
export const ACCENTS = ['blue', 'green', 'orange', 'pink', 'purple', 'red'];
const MOODS = ['warm', 'cool', 'green', 'dark', 'bright', 'pink'];
const COUNTRIES = { KR: '한국', US: '미국', GB: '영국', DE: '독일', FR: '프랑스', IT: '이탈리아', ES: '스페인', JP: '일본', CN: '중국', TW: '대만', CA: '캐나다', AU: '호주', RU: '러시아', BR: '브라질' };
const CAP = { threads: 12, messages: 40, calls: 30, photos: 24, notes: 12, searches: 20, events: 16, contacts: 30 };

export const AI_SYS_PHONE = `GOAL
Show what one character's phone holds right now, in a long role-play. The user opens it to peek at the story from the phone's side.
An app draws the screens from your JSON; you only write the content.

YOU GET
- ARCHIVE: the story so far, in sections (#numbers are chat messages), with the current state at the end.
- WORLD (sometimes): the shared setting.
- RECENT CHAT: the newest messages, after the archive.
- OWNER: whose phone it is.
- PHONE NOW (only when updating): what the phone holds already.

ONE TEST FOR EVERY ITEM
Could this be on the owner's phone, given what the archive and chat show? If not, leave it out.
- Events (a meeting, a fight, a confession, a trip, a loss) only if the archive has them.
- Small everyday things around those events are fine: how a text was worded, a photo of a place they were, a search they would make.
- People: only people the story has. A relationship word (girlfriend, ex, husband, boss) only if the archive uses it for them.
- Nothing later than the newest moment of the story.

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
  "events": [{ "title", "ko", "date": "MM-DD", "time": "HH:MM" or "" }]
}
At most 6 threads of up to 12 messages, 10 calls, 8 photos, 5 notes, 8 searches, 6 events. Fewer is fine; an empty list is fine.
Oldest first in every list.`;

const UPDATE_ASK = `[UPDATE]
Write only what came onto the phone after PHONE NOW's "now", in the same JSON: new messages (under the thread they belong to),
calls, photos, notes, searches and events, and "now" as the new newest moment. Contacts only if new or saved differently.
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
    for (const k of ['calls', 'photos', 'notes', 'searches', 'events']) p[k] = keep([...p[k], ...add[k]], CAP[k]);
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

function phoneRequest(m, owner, p = null) {
    const world = worldText(m);
    const recent = recentForCheck(6).join('\n\n').slice(-6000);
    const ar = archiveFor(m, p ? p.upto ?? -1 : -1);
    const now = p ? JSON.stringify(phoneForModel(p)) : '';
    return [
        p ? `[PHONE NOW]\n${now}` : '',
        `[ARCHIVE${p ? ' — the sections since PHONE NOW' : ''}]\n${ar.text || '(nothing new)'}`,
        world ? `[WORLD]\n${world}` : '',
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
});

export async function makePhone(m, owner, { update = false } = {}) {
    const key = nameKey(owner);
    const old = update ? m.phones?.[key] : null;
    const out = await askDraft(phoneRequest(m, owner, old), { system: AI_SYS_PHONE, maxTokens: 16000 });
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
    redo: '<path d="M21 4v6h-6"/><path d="M20.5 10A8.5 8.5 0 1 0 19 16.5"/>',
};
const ic = (k, s = 18, w = 2) => `<svg class="na_ph_i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
const APPS = { msg: '메시지', call: '전화', photo: '사진', note: '메모', search: '검색', cal: '캘린더', map: '다녀간 곳' };
const MOOD_ICO = { warm: 'photo', cool: 'photo', green: 'map', dark: 'clock', bright: 'photo', pink: 'heart' };
const koOn = () => globalSettings().phoneKo !== false;
const savedName = (p, n) => p.contacts.find(c => nameKey(c.name) === nameKey(n))?.saved || n;
const tr = (p, t, k) => `${esc(t)}${k && koOn() ? `<span class="na_ph_ko">${esc(k)}</span>` : ''}`;
const hasKo = p => [...p.threads.flatMap(t => t.messages), ...p.photos, ...p.notes, ...p.searches, ...p.events].some(x => x.ko);
// a face: the archive's own face for people in the roster, else the first letter on the accent
const av = (name, size, roster) => roster.has(nameKey(name)) ? faceHtml(name, size) : `<span class="na_ph_letter" style="width:${size}px;height:${size}px">${esc([...String(name).trim()][0] || '?')}</span>`;

function statusBar(p, now) {
    return `<div class="na_ph_sb"><span>${esc(fmtTime(p, now) || '')}</span><i>${ic('sig', 15)}${ic('bat', 20, 1.6)}</i></div>`;
}

function lockScreen(p, now) {
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
    return `
      <div class="na_ph_lock" data-go="home">
        <div class="na_ph_lockdate">${esc(fmtDate(p, now))}</div>
        <div class="na_ph_clock">${esc(bigClock(p, now))}</div>
        <div class="na_ph_notes">${notes.slice(0, 3).map(n => `
          <div class="na_ph_note" data-go="${n.app}"><span class="na_ph_app a_${n.app}">${ic(n.app, 15)}</span><div><b>${esc(n.title)}</b><p>${tr(p, n.text, n.ko)}</p></div>${n.time ? `<small>${esc(ago(p, n.time))}</small>` : ''}</div>`).join('')}</div>
        <div class="na_ph_swipe">눌러서 열기</div>
      </div>`;
}

function homeScreen(p, now, m) {
    const day = String(now).slice(0, 5);
    const anniv = annivToday(m, now);
    const ev = p.events.find(e => e.date >= day);
    const unread = p.threads.filter(t => t.messages[t.messages.length - 1]?.from !== 'me').length;
    const missed = p.calls.filter(c => c.type === 'missed' && c.time.slice(0, 5) === day).length;
    const badge = { msg: unread, call: missed };
    const app = (k, label = true) => `<button type="button" class="na_ph_appbtn" data-go="${k}"><span class="na_ph_app a_${k}">${ic(k, 24)}${badge[k] ? `<em>${badge[k]}</em>` : ''}</span>${label ? `<span>${APPS[k]}</span>` : ''}</button>`;
    return `
      <div class="na_ph_home">
        <button type="button" class="na_ph_widget" data-go="cal">
          <b>${anniv ? '오늘은' : '캘린더'} · ${esc(fmtDate(p, now))}</b>
          ${anniv ? `<span>${ic('heart', 13, 2.4)} ${esc(anniv)}</span>` : ev ? `<span>${tr(p, ev.title, ev.ko)}</span><small>${esc(ev.date === day ? '오늘' : fmtDate(p, ev.date))}${ev.time ? ` · ${esc(fmtTime(p, `${ev.date} ${ev.time}`))}` : ''}</small>` : '<span class="na_ph_dim">다가오는 일정 없음</span>'}
        </button>
        <div class="na_ph_grid">${['cal', 'photo', 'note', 'map'].map(k => app(k)).join('')}</div>
        <div class="na_ph_dock">${['call', 'msg', 'search'].map(k => app(k, false)).join('')}</div>
      </div>`;
}

const head = (p, title, { back = 'home', sub = '', chip = true } = {}) => `
  <div class="na_ph_head">
    <button type="button" class="na_ph_back" data-go="${back}" aria-label="뒤로">${ic('back', 20, 2.4)}</button>
    ${chip && hasKo(p) ? `<button type="button" class="na_ph_kochip ${koOn() ? 'on' : ''}">가 한국어</button>` : ''}
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
    return `${head(p, '사진', { sub: ps.length ? `${ps.length}장` : '' })}
      <div class="na_ph_photos">${ps.length ? ps.map(([x, k]) => `
        <div class="na_ph_pc"><button type="button" class="na_ph_thumb m_${x.mood} ${x.img ? 'has' : ''}" data-go="photoone" data-i="${k}" aria-label="크게 보기">${thumb(x)}</button>${x.img ? '' : drawBtn(p, k, 'on_thumb')}<p>${tr(p, x.caption, x.ko)}<small>${esc(fmtDate(p, x.time, true))} ${esc(fmtTime(p, x.time))}</small></p></div>`).join('') : empty('사진이 없어요')}</div>`;
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
        : v === 'cal' ? calScreen(p, now, m) : v === 'map' ? mapScreen(p, m) : homeScreen(p, now, m);
    const glass = v === 'lock' || v === 'home';
    return `<div class="na_ph_scr ${glass ? `glass w_${p.wall}` : 'app'} v_${v}" style="--ph-acc:var(--ph-${p.accent})">${statusBar(p, now)}<div class="na_ph_body">${body}</div><button type="button" class="na_ph_bar" data-go="${v === 'lock' ? 'home' : v === 'home' ? 'lock' : 'home'}" aria-label="홈"></button></div>`;
}

// ---- the window
export async function openPhone(who = null) {
    const c = ctx();
    const m = getMeta();
    m.phones = m.phones && typeof m.phones === 'object' ? m.phones : {};
    const names = peopleList(m);
    const roster = new Set(names.map(nameKey));
    let owner = who && names.some(n => nameKey(n) === nameKey(who)) ? names.find(n => nameKey(n) === nameKey(who)) : (names.find(n => m.phones[nameKey(n)]) || names[0] || null);
    let view = 'lock', menu = false;
    const $root = $(`
      <div class="na_popup na_v2 na_phone">
        <div class="na_v2_title"><b>캐릭터 휴대폰</b><small>아카이브에 있는 만큼만 · 보기 전용</small></div>
        <div class="na_ph_owners"></div>
        <div class="na_ph_wrap"><div class="na_ph_frame"></div></div>
        <div class="na_ph_ctrl"></div>
      </div>`);
    const phone = () => (owner ? m.phones[nameKey(owner)] : null);
    const drawOwners = () => $root.find('.na_ph_owners').html(names.length ? names.map(n => `
        <button type="button" class="na_ph_pick ${n === owner ? 'on' : ''}" data-n="${esc(n)}">${faceHtml(n, 40)}<span>${esc(n)}</span>${m.phones[nameKey(n)] ? '<i></i>' : ''}</button>`).join('') : '<div class="na_empty">STATE에 "## 이름" 인물이 없어요. 인물 도감에서 인물을 넣어 주세요.</div>');
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
                    <p>아카이브를 읽고 메시지 · 통화 · 사진 · 메모 · 검색 · 일정을 채워요. 국적에 맞는 말로 쓰고 한국어를 밑에 붙여요.</p>
                    <button type="button" class="na_ph_makebtn">폰 만들기</button>
                    <small>초안 모델 · ${esc(drLabel())}</small>
                  </div>
                </div></div>`);
            return;
        }
        const top = keep ? $root.find('.na_ph_body').scrollTop() : 0;
        $root.find('.na_ph_frame').html(screen(p, view, m, roster));
        if (keep) $root.find('.na_ph_body').scrollTop(top);
    };
    const drawCtrl = () => {
        const p = phone();
        if (!p) { $root.find('.na_ph_ctrl').html(''); return; }
        const n = newSections(m, p);
        $root.find('.na_ph_ctrl').html(`
          <label class="na_ph_crow"><span><b>롤플에 넣기</b><small>켜면 이 폰의 최근 문자 · 일정이 주입돼요</small></span><input type="checkbox" class="na_toggle na_ph_inject" ${p.inject ? 'checked' : ''}></label>
          <div class="na_ph_cbtns">
            <button type="button" class="na_v2_btn na_ph_update">${ic('redo', 15)}<span>새로 일어난 일 반영${n ? ` · 새 섹션 ${n}` : ''}</span></button>
            <button type="button" class="na_v2_btn na_ph_more" aria-label="더 보기">⋯</button>
          </div>
          ${menu ? `
          <div class="na_ph_menu">
            <label><span>국적</span><select class="text_pole na_ph_country">${Object.entries(COUNTRIES).map(([k, v]) => `<option value="${k}" ${k === p.country ? 'selected' : ''}>${v}</option>`).join('')}${COUNTRIES[p.country] ? '' : `<option value="${esc(p.country)}" selected>${esc(p.country)}</option>`}</select></label>
            <label><span>배경</span><span class="na_ph_walls">${WALLS.map(w => `<button type="button" class="na_ph_wsw w_${w} ${w === p.wall ? 'on' : ''}" data-w="${w}" aria-label="${w}"></button>`).join('')}</span></label>
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
    $root.on('click', '.na_ph_pick', function () { owner = this.dataset.n; view = 'lock'; menu = false; draw(); });
    $root.on('click', '.na_ph_frame [data-go]', function (e) {
        const go = this.dataset.go;
        if (!go) return;
        e.stopPropagation();
        view = ['thread', 'noteone', 'photoone'].includes(go) ? `${go}:${this.dataset.i}` : go;
        drawPhone();
        $root.find('.na_ph_body').scrollTop(view.startsWith('thread') ? 1e6 : 0);
    });
    $root.on('click', '.na_ph_kochip', e => { e.stopPropagation(); const g = globalSettings(); g.phoneKo = !koOn(); drawPhone(); if (view.startsWith('thread')) $root.find('.na_ph_body').scrollTop(1e6); saveGlobal(); });
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
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: false, large: false, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}
