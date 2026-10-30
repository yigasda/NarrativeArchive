// 캐릭터 휴대폰 · AI 기능 모델: 사진 그리기 (실리태번 이미지 생성 or AutoPic), 카메라, 메모 · 일기 새로 쓰기, 검색 결과 페이지.

import { ownerProfileBlock } from './phoneprofile.js';
import { askAI } from './ai.js';
import { datedRows } from './anniv.js';
import { calendars } from './calendar.js';
import { ctx, globalSettings, saveMeta } from './core.js';
import { recentForCheck } from './drift.js';
import { headingPlaces, nameKey, peopleList } from './people.js';
import { arr, CAP, COUNTRIES, ensureIds, ko, line, MOODS, namesBlock, pad, parts, pick, rowDay, storyNow, str } from './phonedata.js';

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
export const drawing = new Set(); // 'owner key:photo index' being drawn now

// the dated sections of the photo's day (or the last one before it), for place, clothes and light
function storyAround(m, time) {
    const rows = datedRows(m).filter(r => rowDay(r)), x = parts(time), day = x ? `${pad(x.mo)}-${pad(x.d)}` : '';
    let hit = day ? rows.filter(r => rowDay(r) === day) : [];
    if (!hit.length && day) hit = rows.filter(r => rowDay(r) <= day).slice(-1);
    if (!hit.length) hit = rows.slice(-1);
    return hit.slice(-2).map(r => m.text.slice(r.s.start, r.s.end).trim()).join('\n\n').slice(0, 6000);
}

// ---- AutoPic (another extension, used only when it is installed): its settings and registered characters, read only
export const autopic = () => { const es = ctx().extensionSettings || {}; const a = es.AutoPic || es.autopic; return a && typeof a === 'object' ? a : null; };
const autopicDirect = () => { const g = autopic()?.naiParams?.generationMode; return !!g && g !== 'legacy'; };
// the characters AutoPic has for this chat's character card
export function autopicPeople() {
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

// one picture for a caption: an album photo's or an SNS post's
async function drawCaption(m, p, ph, caption, time) {
    const looks = looksOf(), ap = autopic() ? autopicPeople() : [];
    const known = [...new Set([...ap.map(x => x.name), ...peopleList(m).filter(n => looks[nameKey(n)])])];
    const prompt = [
        `[PHOTO]\n${caption}${time ? ` (taken ${time})` : ''}`,
        `[OWNER]\n${p.owner}`,
        `[LOOKS]\n${known.join('\n') || '(nobody)'}`,
        `[STORY]\n${storyAround(m, time) || '(none)'}`,
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
    p.generatedAt = Date.now();
    await saveMeta();
    return ph;
}
export async function drawPhoto(m, p, k) {
    const ph = p.photos[k];
    return ph ? drawCaption(m, p, ph, ph.caption, ph.time) : null;
}
// an SNS post's photo, drawn the same way; the post then shows only the picture
export async function drawPost(m, p, k) {
    const x = (p.posts || [])[k];
    return x?.photo ? drawCaption(m, p, x, x.photo, x.time) : null;
}

// ---- 카메라: one photo of this very moment, from the newest messages (the AI 기능 모델)
const AI_SYS_SHOT = `GOAL
The owner of a phone in a long role-play takes one photo right now. Write what the photo shows.

YOU GET
- OWNER, and NOW: the story's moment.
- RECENT CHAT: the newest messages; the photo is taken at the end of them.
- PHOTOS SO FAR: captions already on the phone, for the language and the style.

RULES
- Only what is really in front of the owner at this moment; nothing RECENT CHAT has not shown.
- One short caption, the way a photo is described: who or what is in it, where, the light.
- In the language of PHOTOS SO FAR (the owner's own). A caption that is not Korean gets "ko", a Korean translation.

ANSWER — one JSON object, nothing else:
{ "caption", "ko", "mood": one of ${MOODS.join(', ')} }`;
export const shooting = new Set(); // owner keys taking a photo now
// the chat only: the archive is often summed up long after, so its end can be well behind this moment
export async function takePhoto(m, p) {
    const prompt = [
        `[OWNER]\n${p.owner}`, `[NOW]\n${storyNow(p) || p.now || ''}`,
        `[RECENT CHAT]\n${recentForCheck(12).join('\n\n').slice(-9000)}`,
        `[PHOTOS SO FAR]\n${p.photos.slice(-3).map(x => `- ${x.caption}`).join('\n') || '(none)'}`,
        namesBlock(m),
    ].filter(Boolean).join('\n\n');
    const out = String(await askAI(prompt, { system: AI_SYS_SHOT, maxTokens: 1500 }) || '').replace(/```(?:json)?/gi, '');
    const a = out.indexOf('{'), b = out.lastIndexOf('}');
    let raw = null;
    try { raw = a >= 0 && b > a ? JSON.parse(out.slice(a, b + 1)) : null; } catch { raw = null; }
    const caption = line(raw?.caption, 200);
    if (!caption) throw new Error('모델 답에서 사진 설명을 찾지 못했어요');
    p.photos.push({ caption, ko: ko(raw?.ko), time: storyNow(p) || p.now || '', mood: pick(raw?.mood, MOODS, 'warm') });
    p.photos = p.photos.slice(-CAP.photos);
    ensureIds(p);
    p.generatedAt = Date.now();
    await saveMeta();
    return p.photos.length - 1;
}

// ---- 메모 · 일기 새로 쓰기: one new entry at this very moment, from the newest messages (the AI 기능 모델; the chat only, like the camera)
const AI_SYS_WRITE = `GOAL
The owner of a phone in a long role-play writes one new entry on it right now: a note or a diary entry (WRITE says which). Write it.

YOU GET
- OWNER, and NOW: the story's moment.
- RECENT CHAT: the newest messages; the entry is written at the end of them.
- SO FAR: the owner's earlier entries of this kind, for the language and the way they write.

RULES
- Only what RECENT CHAT shows happened, and what the owner felt about it. Nothing it does not show.
- In the owner's own language, as in SO FAR. A title or text not in Korean gets "kt" and "ko", its Korean.
- A note is short, the way people jot things on a phone: a list, a reminder, a line or two. A diary entry is a few short paragraphs in the owner's voice.

ANSWER — one JSON object, nothing else:
{ "title", "kt", "text", "ko" }`;
export const writing = new Set(); // "owner:note" / "owner:diary" being written
export async function writeEntry(m, p, kind) {
    const diary = kind === 'diary', list = diary ? (p.diary || []) : p.notes;
    const prompt = [
        await ownerProfileBlock(ctx(),p.financeProfile,p.owner),
        `[OWNER]\n${p.owner}${p.country ? ` (phone set to ${p.country})` : ''}`, `[NOW]\n${storyNow(p) || p.now || ''}`, `[WRITE]\n${diary ? 'a diary entry' : 'a note'}`,
        `[RECENT CHAT]\n${recentForCheck(12).join('\n\n').slice(-9000)}`,
        `[SO FAR]\n${list.slice(-3).map(x => `- ${x.title ? `${x.title}: ` : ''}${x.text.slice(0, 300)}`).join('\n') || '(none)'}`,
        namesBlock(m),
    ].filter(Boolean).join('\n\n');
    const out = String(await askAI(prompt, { system: AI_SYS_WRITE, maxTokens: 2500 }) || '').replace(/```(?:json)?/gi, '');
    const a = out.indexOf('{'), b = out.lastIndexOf('}');
    let raw = null;
    try { raw = a >= 0 && b > a ? JSON.parse(out.slice(a, b + 1)) : null; } catch { raw = null; }
    const text = str(raw?.text, 2000);
    if (!text) throw new Error(`모델 답에서 ${diary ? '일기' : '메모'}를 찾지 못했어요`);
    const now = storyNow(p) || p.now || '';
    const x = { title: line(raw?.title, 80), kt: line(raw?.kt, 80), text, ko: str(raw?.ko, 2000) };
    if (diary) { p.diary = [...(p.diary || []), { date: now.slice(0, 5), ...x }].slice(-CAP.diary); }
    else { p.notes.push({ ...x, time: now }); p.notes = p.notes.slice(-CAP.notes); }
    ensureIds(p);
    p.generatedAt = Date.now();
    await saveMeta();
    return (diary ? p.diary : p.notes).length - 1;
}

// ---- 검색: a search's results page, made once when it is first opened (the AI 기능 모델) and kept
const AI_SYS_SEARCH = `GOAL
A character in a long role-play searched this on their phone. Write the results page the search showed.

YOU GET
- OWNER, QUERY, and when it was searched.
- WHERE: the country the phone is set to, and the places the owner was that day.
- SHOPS: the shops and items in the owner's shopping app, if any.

RULES
- The results are what the web of the story's world would show for this query: sites, articles, shops, places, forums.
- The web knows only what is public. The owner and the people around them are not on it, unless the story makes them public.
- Each result in the language a site for this query would use. A text not in Korean gets "ko" (a title gets "kt").
- Each result is a different site with something different to say. A shop or item in SHOPS keeps its name there.
- 4 to 6 results. "answer" only when a search engine would show one box on top (a timetable, the weather, opening hours, a short fact); else null.
- "news" only when the query is about something in the news; "questions" and "related" are what other people searched.

ANSWER — one JSON object, nothing else:
{
  "answer": null or { "label": what it is about, "text", "ko", "steps": [{ "time", "place", "off": true when it does not run }] or [], "site" },
  "results": [{ "site": the site's name, "url": "site.com/path", "path": "the › path › shown", "color": the site's colour as "#hex",
                "kind": "news" | "transit" | "forum" | "wiki" | "shop" | "blog" | "official" | "other",
                "title", "kt", "date": "MM-DD" or "", "text": a one- or two-line snippet, "ko", "bold": [the words of it that match the query],
                "links": [up to 3 short sub-page names] }],
  "news": [{ "site", "color", "title", "kt", "ago": like "2시간 전" }],
  "questions": [{ "q", "ko" }],
  "related": [3 or 4 searches]
}`;
// 페이지: a result opened, written once as its site would have it (kept on the result as "page")
const AI_SYS_PAGE = `GOAL
A character in a long role-play opened a search result on their phone. Write the web page it opened, as that site would have it.

YOU GET
- OWNER, QUERY and when it was searched.
- RESULT: the result that was opened (site, address, kind, colour, title, snippet).
- WHERE: the country and the places the owner was that day.

RULES
- The page says what the snippet promised, in more detail, and nothing the story contradicts.
- The web knows only what is public: the owner and the people around them are not on it, unless the story makes them public.
- In the site's language. Each text not in Korean gets "ko" (a title gets "kt").
- Write it like the real kind of site: a news article reads like news, a forum thread has people talking, a wiki is neutral.
- Keep the site's name, address and colour from RESULT.
- Fill only the part for this "kind"; leave the others out.

ANSWER — one JSON object, nothing else:
{
  "kind": RESULT's kind, "nav": [3 to 6 menu items of the site],
  "title", "kt", "lede": { "text": one sentence under the title, "ko" } or null,
  "body": [2 to 5 paragraphs { "text", "ko" }],

  "news":    { "section", "ticker": a short live line or "", "author", "date": "MM-DD HH:MM", "minutes", "photo": what the photo shows, "credit", "quote": { "text", "ko", "who" } or null },
  "transit": { "stop": the stop the page is for, "alert": { "title", "text", "ko" } or null,
               "departures": [3 to 5 { "line", "to", "note", "time": "HH:MM", "delay": minutes or 0, "off": true or false }],
               "route": [3 to 6 { "stop", "time", "off": true or false }] },
  "forum":   { "board", "members", "online", "author", "ago", "flair", "votes", "comments": [3 to 6 { "who", "ago", "text", "ko", "votes", "reply": true when it answers the one before, "op": true when the poster } ] },
  "wiki":    { "note": a one-line hatnote or "", "photo", "facts": [3 to 5 { "k", "v" }], "langs": number, "sections": [1 to 3 { "h", "text", "ko" }] },
  "shop":    { "crumbs": [2 or 3], "brand", "price": number, "old": number or null, "currency", "rating": 1–5, "reviews", "colors": [2 to 4 "#hex"], "ship" },
  "blog":    { "blog": the blog's name, "category", "author", "date", "minutes", "photo", "tags": [2 to 4] },
  "official":{ "hours": [{ "day", "time" }] or [], "address", "phone" }
}`;
// 미발송 초안 (떠올리기): what the owner might have typed to someone and held back. The model's imagining (src "guess"):
// shown as such, never sent back to the model or into the role-play
const AI_SYS_DRAFT = `GOAL
In a long role-play, the owner of a phone started a text to someone and never sent it. Write that unsent text.

YOU GET
- OWNER and TO: who was writing, and to whom.
- THREAD: their texts so far, newest last.
- RECENT CHAT: the story's newest messages.

RULES
- What the owner might have typed and held back, given THREAD and RECENT CHAT: nearer to what they mean than what they sent. No new events, nothing the chat does not support.
- In the language and voice of the owner's own texts in THREAD. Short like a text; it may break off mid-sentence.
- A text not in Korean gets "ko": a natural Korean translation.

ANSWER — one JSON object, nothing else:
{ "text", "ko" }`;
export const drafting = new Set(); // "owner:thread id" being imagined
export async function makeDraft(m, p, i) {
    const t = p.threads[i];
    if (!t) return null;
    const said = x => (x.from === 'me' ? p.owner : x.from);
    const prompt = [
        await ownerProfileBlock(ctx(),p.financeProfile,p.owner),
        `[OWNER]\n${p.owner}`, `[TO]\n${t.with}`,
        `[THREAD]\n${t.messages.filter(x => x.src !== 'guess').slice(-12).map(x => `${said(x)} (${x.time}): ${x.text}`).join('\n')}`,
        `[RECENT CHAT]\n${recentForCheck(8).join('\n\n').slice(-7000)}`,
        namesBlock(m),
    ].filter(Boolean).join('\n\n');
    const out = String(await askAI(prompt, { system: AI_SYS_DRAFT, maxTokens: 1200 }) || '').replace(/```(?:json)?/gi, '');
    const a = out.indexOf('{'), b = out.lastIndexOf('}');
    let raw = null;
    try { raw = a >= 0 && b > a ? JSON.parse(out.slice(a, b + 1)) : null; } catch { raw = null; }
    const text = str(raw?.text, 600);
    if (!text) throw new Error('모델 답에서 초안을 찾지 못했어요');
    t.draft = { text, ko: ko(raw?.ko), time: storyNow(p) || p.now || '', src: 'guess' };
    p.generatedAt = Date.now();
    await saveMeta();
    return t.draft;
}
// 음성 메모 떠올리기 (the red button): one memo the owner records right now, spoken rather than written
const AI_SYS_VOICE = `GOAL
The owner of a phone in a long role-play records a short voice memo to themselves right now. Write what they say.

YOU GET
- OWNER, and NOW: the story's moment.
- RECENT CHAT: the newest messages; the memo is recorded at the end of them.
- SO FAR: the owner's earlier memos.

RULES
- Spoken, not written: the way the owner talks in the chat, with pauses (…), restarts and half sentences. Not a diary entry.
- Only what RECENT CHAT shows happened and what the owner felt about it; nothing it doesn't support.
- In the owner's own language. Speech not in Korean gets "ko".
- 20 to 90 seconds of speech.

ANSWER — one JSON object, nothing else:
{ "title": the name the phone would show, "kt", "text", "ko", "sec": its length in seconds, "place": where it was recorded, or "" }`;
export const filling = new Set(); // "owner:money" / "owner:voice" being filled
export const recording = new Set(); // owner keys recording a memo now
export async function recordVoice(m, p) {
    const prompt = [
        await ownerProfileBlock(ctx(),p.financeProfile,p.owner),
        `[OWNER]\n${p.owner}${p.country ? ` (phone set to ${p.country})` : ''}`, `[NOW]\n${storyNow(p) || p.now || ''}`,
        `[RECENT CHAT]\n${recentForCheck(12).join('\n\n').slice(-9000)}`,
        `[SO FAR]\n${(p.voice || []).slice(-3).map(x => `- ${x.title}: ${x.text.slice(0, 200)}`).join('\n') || '(none)'}`,
        namesBlock(m),
    ].filter(Boolean).join('\n\n');
    const out = String(await askAI(prompt, { system: AI_SYS_VOICE, maxTokens: 2000 }) || '').replace(/```(?:json)?/gi, '');
    const a = out.indexOf('{'), b = out.lastIndexOf('}');
    let raw = null;
    try { raw = a >= 0 && b > a ? JSON.parse(out.slice(a, b + 1)) : null; } catch { raw = null; }
    const text = str(raw?.text, 2000);
    if (!text) throw new Error('모델 답에서 음성 메모를 찾지 못했어요');
    p.voice = [...(p.voice || []), { title: line(raw?.title, 80), kt: line(raw?.kt, 80), text, ko: str(raw?.ko, 2000), time: storyNow(p) || p.now || '', sec: Math.max(3, Math.min(900, Math.round(Number(raw?.sec) || 30))), place: line(raw?.place, 60), src: 'guess', now: true }].slice(-CAP.voice);
    ensureIds(p);
    p.generatedAt = Date.now();
    await saveMeta();
    return p.voice.length - 1;
}
export const searching = new Set(); // "owner:index" of searches whose page is being made
// where the owner was the day of a search: the places in that day's headings (not the story itself, so the page
// answers the query and not the scene)
function placesThatDay(m, time) {
    const cals = calendars(), rows = datedRows(m).filter(r => rowDay(r)), x = parts(time), day = x ? `${pad(x.mo)}-${pad(x.d)}` : '';
    let hit = day ? rows.filter(r => rowDay(r) === day) : [];
    if (!hit.length && day) hit = rows.filter(r => rowDay(r) <= day).slice(-1);
    if (!hit.length) hit = rows.slice(-1);
    return [...new Set(hit.flatMap(r => headingPlaces(r.s.title, cals)))].slice(0, 6);
}
export const KINDS = ['news', 'transit', 'forum', 'wiki', 'shop', 'blog', 'official', 'other'];
const hex = v => (/^#[0-9a-f]{6}$/i.test(String(v || '').trim()) ? String(v).trim().toLowerCase() : '');
const whereOf = (m, p, x) => [p.country ? `Country: ${COUNTRIES[p.country] ? `${p.country} (${COUNTRIES[p.country]})` : p.country}` : '', (pl => (pl.length ? `Places that day: ${pl.join(', ')}` : ''))(placesThatDay(m, x.time))].filter(Boolean).join('\n');
export async function searchPage(m, p, k) {
    const x = p.searches[k];
    const where = whereOf(m, p, x);
    const shops = (p.money?.orders || []).map(o => `- ${o.shop}: ${o.item}`).join('\n');
    const prompt = [`[OWNER]\n${p.owner}`, `[QUERY]\n${x.q}`, `[SEARCHED]\n${x.time || p.now || ''}`, `[WHERE]\n${where || '(unknown)'}`, shops ? `[SHOPS]\n${shops}` : '', namesBlock(m)].filter(Boolean).join('\n\n');
    const out = String(await askAI(prompt, { system: AI_SYS_SEARCH, maxTokens: 4000 }) || '').replace(/```(?:json)?/gi, '');
    const a = out.indexOf('{'), b = out.lastIndexOf('}');
    let raw = null;
    try { raw = a >= 0 && b > a ? JSON.parse(out.slice(a, b + 1)) : null; } catch { raw = null; }
    const rs = arr(raw?.results).map(r => ({ site: line(r?.site, 60), url: line(r?.url, 120), path: line(r?.path, 120), color: hex(r?.color), kind: pick(r?.kind, KINDS, 'other'), title: line(r?.title, 160), kt: line(r?.kt, 160), date: line(r?.date, 10), text: line(r?.text, 400), ko: line(r?.ko, 400), bold: arr(r?.bold).map(w => line(w, 40)).filter(Boolean).slice(0, 4), links: arr(r?.links).map(w => line(w, 30)).filter(Boolean).slice(0, 3) })).filter(r => r.title).slice(0, 8);
    if (!rs.length) throw new Error('모델 답에서 검색 결과를 찾지 못했어요');
    x.results = rs;
    const an = raw?.answer;
    x.answer = an && line(an.text, 200) ? { label: line(an.label, 60), text: line(an.text, 200), ko: line(an.ko, 200), site: line(an.site, 60), steps: arr(an.steps).map(t => ({ time: line(t?.time, 12), place: line(t?.place, 40), ...(t?.off === true ? { off: true } : {}) })).filter(t => t.place).slice(0, 5) } : null;
    x.news = arr(raw?.news).map(n => ({ site: line(n?.site, 60), color: hex(n?.color), title: line(n?.title, 160), kt: line(n?.kt, 160), ago: line(n?.ago, 20) })).filter(n => n.title).slice(0, 4);
    x.questions = arr(raw?.questions).map(q => ({ q: line(q?.q, 120), ko: line(q?.ko, 120) })).filter(q => q.q).slice(0, 4);
    x.related = arr(raw?.related).map(w => line(w, 60)).filter(Boolean).slice(0, 4);
    p.generatedAt = Date.now();
    await saveMeta();
}

// a result opened: its page, written once and kept on the result
export const paging = new Set(); // "owner:search.result" being written
const txt = (v, n) => ({ text: str(v?.text, n), ko: str(v?.ko, n) });
export async function webPage(m, p, k, r) {
    const x = p.searches[k], res = x?.results?.[r];
    if (!res) return;
    const prompt = [`[OWNER]\n${p.owner}`, `[QUERY]\n${x.q}`, `[SEARCHED]\n${x.time || p.now || ''}`,
        `[RESULT]\n${JSON.stringify({ site: res.site, url: res.url, kind: res.kind || 'other', color: res.color, title: res.title, text: res.text })}`,
        `[WHERE]\n${whereOf(m, p, x) || '(unknown)'}`, namesBlock(m)].filter(Boolean).join('\n\n');
    const out = String(await askAI(prompt, { system: AI_SYS_PAGE, maxTokens: 5000 }) || '').replace(/```(?:json)?/gi, '');
    const a = out.indexOf('{'), b = out.lastIndexOf('}');
    let raw = null;
    try { raw = a >= 0 && b > a ? JSON.parse(out.slice(a, b + 1)) : null; } catch { raw = null; }
    const body = arr(raw?.body).map(v => txt(v, 1200)).filter(v => v.text).slice(0, 6);
    if (!raw || !(body.length || raw.title)) throw new Error('모델 답에서 페이지를 찾지 못했어요');
    const kind = KINDS.includes(res.kind) ? res.kind : 'other', o = raw[kind] && typeof raw[kind] === 'object' ? raw[kind] : {};
    const yes = v => v === true;
    const extra = {
        news: () => ({ section: line(o.section, 30), ticker: line(o.ticker, 120), author: line(o.author, 40), date: line(o.date, 16), minutes: line(o.minutes, 6), photo: line(o.photo, 160), credit: line(o.credit, 80), quote: o.quote && line(o.quote.text, 200) ? { ...txt(o.quote, 200), who: line(o.quote.who, 60) } : null }),
        transit: () => ({ stop: line(o.stop, 50), alert: o.alert && line(o.alert.text, 300) ? { title: line(o.alert.title, 60), ...txt(o.alert, 300) } : null,
            departures: arr(o.departures).map(d => ({ line: line(d?.line, 6), to: line(d?.to, 50), note: line(d?.note, 60), time: line(d?.time, 5), delay: Math.max(0, Math.min(180, Math.round(Number(d?.delay) || 0))), off: yes(d?.off) })).filter(d => d.to).slice(0, 6),
            route: arr(o.route).map(d => ({ stop: line(d?.stop, 50), time: line(d?.time, 5), off: yes(d?.off) })).filter(d => d.stop).slice(0, 7) }),
        forum: () => ({ board: line(o.board, 40), members: line(o.members, 12), online: line(o.online, 8), author: line(o.author, 30), ago: line(o.ago, 20), flair: line(o.flair, 20), votes: line(o.votes, 8),
            comments: arr(o.comments).map(c => ({ who: line(c?.who, 30), ago: line(c?.ago, 20), ...txt(c, 600), votes: line(c?.votes, 8), reply: yes(c?.reply), op: yes(c?.op) })).filter(c => c.text).slice(0, 7) }),
        wiki: () => ({ note: line(o.note, 160), photo: line(o.photo, 120), facts: arr(o.facts).map(f => ({ k: line(f?.k, 30), v: line(f?.v, 60) })).filter(f => f.k && f.v).slice(0, 6), langs: Math.max(0, Math.min(300, Math.round(Number(o.langs) || 0))), sections: arr(o.sections).map(v => ({ h: line(v?.h, 60), ...txt(v, 1200) })).filter(v => v.h && v.text).slice(0, 3) }),
        shop: () => ({ crumbs: arr(o.crumbs).map(c => line(c, 30)).filter(Boolean).slice(0, 3), brand: line(o.brand, 40), price: Number.isFinite(Number(o.price)) && o.price !== null && o.price !== '' ? Number(o.price) : null, old: Number.isFinite(Number(o.old)) && o.old !== null && o.old !== '' ? Number(o.old) : null, currency: line(o.currency, 3).toUpperCase(), rating: Math.max(0, Math.min(5, Number(o.rating) || 0)), reviews: line(o.reviews, 10), colors: arr(o.colors).map(hex).filter(Boolean).slice(0, 4), ship: line(o.ship, 140) }),
        blog: () => ({ blog: line(o.blog, 40), category: line(o.category, 30), author: line(o.author, 40), date: line(o.date, 20), minutes: line(o.minutes, 6), photo: line(o.photo, 160), tags: arr(o.tags).map(t => line(t, 20)).filter(Boolean).slice(0, 4) }),
        official: () => ({ hours: arr(o.hours).map(h => ({ day: line(h?.day, 20), time: line(h?.time, 30) })).filter(h => h.day).slice(0, 7), address: line(o.address, 120), phone: line(o.phone, 30) }),
        other: () => ({}),
    }[kind]();
    res.page = { nav: arr(raw.nav).map(n => line(n, 20)).filter(Boolean).slice(0, 6), title: line(raw.title, 200) || res.title, kt: line(raw.kt, 200), lede: raw.lede && line(raw.lede.text, 300) ? txt(raw.lede, 300) : null, body, [kind]: extra };
    p.generatedAt = Date.now();
    await saveMeta();
}
