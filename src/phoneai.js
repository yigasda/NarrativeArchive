// 캐릭터 휴대폰 · AI 기능 모델: 사진 그리기 (실리태번 이미지 생성 or AutoPic), 카메라, 메모 · 일기 새로 쓰기, 검색 결과 페이지.

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
    await saveMeta();
    return (diary ? p.diary : p.notes).length - 1;
}

// ---- 검색: a search's results page, made once when it is first opened (the AI 기능 모델) and kept
const AI_SYS_SEARCH = `GOAL
A character in a long role-play searched this on their phone. Write the results page the search showed.

YOU GET
- OWNER, QUERY, and when it was searched.
- WHERE: the country the phone is set to, and the places the owner was that day.

RULES
- The results are what the web of the story's world would show for this query: sites, articles, shops, places, forums.
- The web knows only what is public. The owner and the people around them are not on it, unless the story makes them public.
- Each result in the language a site for this query would use. A result not in Korean gets "kt" (its title in Korean) and "ko" (its text in Korean).
- Each result is a different site with something different to say.
- 4 to 6 results.

ANSWER — one JSON object, nothing else:
{ "results": [{ "site": the site's name, "url": a short address like "site.com/page", "title", "kt", "text": a one- or two-line snippet, "ko" }] }`;
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
export async function searchPage(m, p, k) {
    const x = p.searches[k];
    const where = [p.country ? `Country: ${COUNTRIES[p.country] ? `${p.country} (${COUNTRIES[p.country]})` : p.country}` : '', (pl => (pl.length ? `Places that day: ${pl.join(', ')}` : ''))(placesThatDay(m, x.time))].filter(Boolean).join('\n');
    const prompt = [`[OWNER]\n${p.owner}`, `[QUERY]\n${x.q}`, `[SEARCHED]\n${x.time || p.now || ''}`, `[WHERE]\n${where || '(unknown)'}`, namesBlock(m)].filter(Boolean).join('\n\n');
    const out = String(await askAI(prompt, { system: AI_SYS_SEARCH, maxTokens: 2500 }) || '').replace(/```(?:json)?/gi, '');
    const a = out.indexOf('{'), b = out.lastIndexOf('}');
    let raw = null;
    try { raw = a >= 0 && b > a ? JSON.parse(out.slice(a, b + 1)) : null; } catch { raw = null; }
    const rs = arr(raw?.results).map(r => ({ site: line(r?.site, 60), url: line(r?.url, 120), title: line(r?.title, 160), kt: line(r?.kt, 160), text: line(r?.text, 400), ko: line(r?.ko, 400) })).filter(r => r.title).slice(0, 8);
    if (!rs.length) throw new Error('모델 답에서 검색 결과를 찾지 못했어요');
    x.results = rs;
    await saveMeta();
}
