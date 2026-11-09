// The phone's Korean (3.182.4~): the reflection writes the story's own words only; what is in another language gets its
// Korean here, after the reflection or when 한국어 is pressed. Its own instructions (not the archive's line translator):
// each line goes with its app and who says it to whom, and the phone's
// voice table (p.koVoice: how each person sounds in Korean), so every translation reads alike; the translator adds a
// person it decides, the user can change one

import { aroundBlock, cardBlocks, koGaps, refreshUndoAfter, sideRequest } from './phonedata.js';
import { askDraft } from './ai.js';
import { askTranslator, glossaryEntries, glossaryIn } from './translate.js';
import { getMeta, hasChat } from './core.js';
import { parseJson } from './phoneparse.js';

export const AI_SYS_PHONE_KO = `GOAL
Translate what a character's phone shows into natural Korean, so that all of it reads as one: each person sounds the same wherever they appear.

YOU GET
- OWNER: whose phone it is.
- PEOPLE AROUND (sometimes): the people in the owner's life, who they are to the owner and where things stand.
- VOICES (sometimes): how each person sounds in Korean in texts and comments, as "Name: style". Always follow it.
- GLOSSARY (sometimes): names and terms, written exactly this way.
- LINES: numbered, each "[app · who → to]" and its words. "self" is the owner writing for themselves.

VOICE
- Texts and comments: each person in the same voice they have everywhere else, as VOICES shows; without it, as the original and who they are to each other (PEOPLE AROUND) suggest.
- Everything else (the owner's own notes, diary, calendar and the like, mails, posts) reads as its original does. VOICES is not for it.
- Lines that read alike in the original read alike in Korean.

LINES
- Translate every line in full, with its meaning, length, line breaks and emoji. No notes, no explanations.
- Names of people and places in Korean script, the GLOSSARY spelling when given. Brand and app names as Korean users write them.

JSON (one object, nothing before or after it)
{ "lines": [{ "n": its number, "ko": the Korean }] }
Every number once.`;

// how a person texts, from the story itself (3.184.2~): asked once for each who texts or comments on the phone and has no
// row yet, before the translation. With the words that show it; a person the story doesn't show stays out (and isn't asked
// again until the table changes)
export const AI_SYS_PHONE_VOICE = `GOAL
Work out how each person in WHO writes to the people they text, as the story shows it, so the phone's Korean keeps their voice.

YOU GET
- ARCHIVE, RECENT CHAT, OWNER, and sometimes STORY YEAR, WORLD, LOREBOOK, OWNER PROFILE and OWNER DOESN'T KNOW. Nothing on the phone may show what the owner doesn't know.
- CHARACTER CARD — name and PERSONA — name (sometimes): the chat's cards and the user's persona, as written, with how they speak.
- WHO: the people to describe.

VOICE
- For each person in WHO: how they talk to the people they text (the Korean speech level they would use, how they address them, their habits), as the story shows it, in a short note in Korean.
- "evidence": the exact words in the story or a card that show it. Nothing shows it: "style": "" and "evidence": [].
- "label": the same in two or three short Korean words joined with " · ", like "격식 존댓말 · 단호함", for a list.

JSON (one object, nothing before or after it)
{ "people": [{ "who", "style", "label", "evidence": [exact words from the story or a card] }] }`;

// who texts or comments in what is to be translated and has no row in the table: [names]
export function voicesWanted(p, { all = false } = {}) {
    const have = new Set(voiceRows(p).map(whoKey)), asked = new Set((p.koVoiceAsked || []).map(x => String(x).toLowerCase()));
    return [...new Set(koGaps(p, { all }).filter(g => /^(text|comment)/.test(g.app)).map(g => String(g.who).trim()).filter(Boolean))]
        .filter(n => !have.has(n.toLowerCase()) && !asked.has(n.toLowerCase())).slice(0, 20);
}
// 이름표: a row the user wrote gets a short label for the list, like the story's own (its own small request: no story, no
// translation; the note alone)
export const AI_SYS_VOICE_LABEL = `GOAL
Give each note on how a person talks a short label for a list.

YOU GET
- NOTES: numbered, each a person's name and a note on how they talk.

LABEL
- Two or three short Korean words joined with " · ", at most 20 characters, saying what the note says. Like "격식 존댓말 · 단호함".

JSON (one object, nothing before or after it)
{ "labels": [{ "n": its number, "label" }] }
Every number once.`;
export const labelOk = l => { const t = String(l ?? '').trim(); return t && t.length <= 20 ? t : ''; };
// items: [{ who, style }] → [label or ''] in the same order. Throws when the request fails
export async function labelVoices(items) {
    const list = (Array.isArray(items) ? items : []).slice(0, 40);
    if (!list.some(x => String(x?.style || '').trim())) return list.map(() => '');
    const input = `[NOTES]\n${list.map((x, i) => `${i + 1}: ${String(x?.who || '').trim() || '?'}: ${String(x?.style || '').replace(/\s+/g, ' ').trim().slice(0, 300)}`).join('\n')}`;
    const got = parseJson(String(await askDraft(input, { force: true, system: AI_SYS_VOICE_LABEL, maxTokens: 800, effort: 'low' })).replace(/^[^{]*/, '').replace(/[^}]*$/, ''), { salvage: true }) || {};
    const out = list.map(() => '');
    for (const r of Array.isArray(got.labels) ? got.labels : []) { const k = Number(r?.n) - 1; if (k >= 0 && k < out.length && String(list[k]?.style || '').trim()) out[k] = labelOk(r?.label); }
    return out;
}

// a row the user deletes: gone, and that person isn't asked of the story again (사람 추가 brings them back by hand).
// The deleted row, or null
export function dropVoice(p, i) {
    const rows = Array.isArray(p?.koVoice) ? p.koVoice : [], k = Number(i);
    if (!Number.isInteger(k) || k < 0 || k >= rows.length) return null;
    const [row] = rows.splice(k, 1), name = who(row);
    if (name && !(p.koVoiceAsked || []).some(x => String(x).toLowerCase() === name.toLowerCase())) p.koVoiceAsked = [...(p.koVoiceAsked || []), name].slice(-200);
    return row;
}
// asks the story about these people (names); the rows it found: [{ who, style, evidence, by }]. A row needs the words
// that show it (from the story or a card)
async function askVoices(m, owner, p, names) {
    // (the cards and the persona whole; the owner's chosen profile only when it is a lorebook entry: a card or a persona is
    // in already)
    const binding = p.financeProfile || m?.phoneProfiles?.[String(owner || '').toLowerCase()] || null;
    const input = await sideRequest(m, owner, [...cardBlocks(), `[WHO]\n${names.map(n => `- ${n}`).join('\n')}`], { profile: binding?.type === 'lore' ? binding : undefined });
    const got = parseJson(String(await askDraft(input, { force: true, system: AI_SYS_PHONE_VOICE, maxTokens: 3000, effort: 'low' })).replace(/^[^{]*/, '').replace(/[^}]*$/, ''), { salvage: true }) || {};
    const wanted = new Map(names.map(n => [n.toLowerCase(), n])), seen = new Set();
    return (Array.isArray(got.people) ? got.people : []).filter(v => v && wanted.has(whoKey(v)) && !seen.has(whoKey(v)) && String(v.style || '').trim()
        && (Array.isArray(v.evidence) ? v.evidence : []).some(e => String(e || '').trim()) && seen.add(whoKey(v)))
        .map(v => ({ who: wanted.get(whoKey(v)), style: String(v.style).trim().slice(0, 300), ...(String(v.label || '').trim() && String(v.label).trim().length <= 20 ? { label: String(v.label).trim() } : {}), evidence: v.evidence.map(e => String(e).trim()).filter(Boolean).slice(0, 2).map(e => e.slice(0, 160)), by: 'model' }));
}
// before a translation: who texts and has no row yet; the rows added. One the story doesn't show isn't asked again; nor
// one whose row the user deletes (dropVoice)
export async function learnVoices(m, owner, p, { all = false } = {}) {
    const want = voicesWanted(p, { all });
    if (!want.length) return 0;
    const rows = (await askVoices(m, owner, p, want)).filter(r => !voiceRows(p).some(v => whoKey(v) === whoKey(r)));
    if (rows.length) p.koVoice = [...voiceRows(p), ...rows].slice(-80);
    const got1 = new Set(rows.map(r => r.who.toLowerCase()));
    p.koVoiceAsked = [...new Set([...(p.koVoiceAsked || []), ...want.filter(n => !got1.has(n.toLowerCase()))])].slice(-200);
    return rows.length;
}
// 뽑기: the user asks the story about someone (a row they added, or one already there): what it finds takes that
// person's row, whoever wrote it, and they come off the not-asked list; one it doesn't find keeps the row it had.
// { found: [names], missing: [names] }
export async function pickVoices(m, owner, p, names) {
    const list = [...new Set((Array.isArray(names) ? names : [names]).map(n => String(n || '').trim()).filter(Boolean))].slice(0, 20);
    if (!list.length) return { found: [], missing: [] };
    const rows = await askVoices(m, owner, p, list), keys = new Set(rows.map(r => whoKey(r)));
    const rest = (Array.isArray(p.koVoice) ? p.koVoice : []).filter(v => !keys.has(whoKey(v)));
    p.koVoice = [...rest, ...rows].slice(-80);
    p.koVoiceAsked = (p.koVoiceAsked || []).filter(x => !keys.has(String(x).toLowerCase()));
    return { found: rows.map(r => r.who), missing: list.filter(n => !keys.has(n.toLowerCase())) };
}

// how many fields one go fills at most (the rest wait for the next), and how much one request carries
export const KO_MAX = 400;
const KO_CHUNK = 60, KO_CHARS = 9000;

const who = v => String(v?.who ?? v?.from ?? '').trim(), whoKey = v => who(v).toLowerCase();
const voiceRows = p => (Array.isArray(p.koVoice) ? p.koVoice : []).filter(v => v && who(v) && String(v.style || '').trim());

// (no examples from the Korean already on the phone: what an older reflection wrote there is the uneven voice this
// replaces; the voice table alone keeps it even)
function inputOf(p, chunk) {
    const voices = voiceRows(p), gloss = hasChat() ? glossaryIn(glossaryEntries(getMeta()), chunk.map(g => g.x[g.f]).join('\n')) : [];
    return [
        `[OWNER]\n${p.owner || 'me'}`,
        aroundBlock(p),
        voices.length ? `[VOICES]\n${voices.map(v => `- ${who(v)}: ${v.style}`).join('\n')}` : '',
        gloss.length ? `[GLOSSARY]\n${gloss.map(e => `- ${e.src} = ${e.ko}`).join('\n')}` : '',
        `[LINES]\n${chunk.map((g, i) => `${i + 1}: [${g.app} · ${g.who} → ${g.to}] ${JSON.stringify(String(g.x[g.f]))}`).join('\n')}`,
    ].filter(Boolean).join('\n\n');
}

// which of the phone's lines a screen shows (its view): the app 한국어 long-pressed there translates again
const VIEW_APPS = [[/^(msg|thread|draft|groupinfo|contact)/, a => a.startsWith('text')], [/^photo/, a => a === 'photo caption'], [/^note/, a => a.startsWith('note')],
    [/^search/, a => a === 'search'], [/^cal/, a => a === 'calendar'], [/^sns/, a => /^(post|comment|profile)/.test(a)], [/^mail/, a => a.startsWith('mail')],
    [/^diary/, a => a.startsWith('diary')], [/^voice/, a => a.startsWith('voice memo')], [/^(clock|alarm)/, a => a === 'alarm' || a === 'timer'], [/^(files|folder|file)/, a => a === 'file']];
export const koAppOf = view => VIEW_APPS.find(([re]) => re.test(String(view || '')))?.[1] || null;

// translates one app's lines again (all of them, with the voice table and the examples as they are now): their Korean is
// cleared first and, if the translator fails or leaves a line out, put back. The number translated
export async function redoKo(p, only, { max = KO_MAX } = {}) {
    const rows = koGaps(p, { all: true }).filter(g => !only || only(g.app)).slice(0, max), was = rows.map(g => g.x[g.k]);
    for (const g of rows) delete g.x[g.k];
    try { return await fillKo(p, { max, only }); }
    finally { rows.forEach((g, i) => { if (!String(g.x[g.k] ?? '').trim() && was[i] !== undefined) g.x[g.k] = was[i]; }); }
}

// fills what has no Korean (only: those of one app); the number filled. Throws when the translator fails (what came back
// before stays)
export async function fillKo(p, { max = KO_MAX, only = null } = {}) {
    // (3.183.18: the voice table is how people talk to others; what the translator wrote there before, from notes and
    // diaries too, goes once. The user's own rows stay)
    // (3.184.1: and only from texts and comments, never a mail's sender or a calendar line: what it decided before goes once more)
    if (!(p.koVoiceV >= 3)) { if (Array.isArray(p.koVoice)) p.koVoice = p.koVoice.filter(v => v?.by !== 'model'); p.koVoiceV = 3; }
    const gaps = koGaps(p).filter(g => !only || only(g.app)).slice(0, max);
    let n = 0;
    for (let i = 0; i < gaps.length;) {
        let j = i, size = 0;
        const len = g => String(g.x[g.f]).length;
        while (j < gaps.length && (j === i || (j - i < KO_CHUNK && size + len(gaps[j]) < KO_CHARS))) { size += len(gaps[j]); j++; }
        const chunk = gaps.slice(i, j);
        i = j;
        const out = await askTranslator(inputOf(p, chunk), { system: AI_SYS_PHONE_KO, maxTokens: Math.min(16384, 1500 + size * 3) });
        const got = parseJson(String(out).replace(/^[^{]*/, '').replace(/[^}]*$/, ''), { salvage: true }) || {};
        for (const r of Array.isArray(got.lines) ? got.lines : []) {
            const g = chunk[Number(r?.n) - 1], ko = String(r?.ko ?? '').trim();
            if (g && ko && !String(g.x[g.k] ?? '').trim()) { g.x[g.k] = ko; n++; }
        }
    }
    if (n) refreshUndoAfter(p);
    return n;
}
