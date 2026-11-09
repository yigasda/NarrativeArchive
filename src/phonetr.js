// The phone's Korean (3.182.4~): the reflection writes the story's own words only; what is in another language gets its
// Korean here, after the reflection or when 한국어 is pressed. Its own instructions (not the archive's line translator):
// each line goes with its app and who says it to whom, the chat's lines already in Korean as examples, and the phone's
// voice table (p.koVoice: how one person speaks Korean to another), which the translator adds to for a pair it decides
// and which the user can change

import { koGaps, refreshUndoAfter } from './phonedata.js';
import { askTranslator, glossaryEntries, glossaryIn } from './translate.js';
import { getMeta, hasChat } from './core.js';
import { parseJson } from './phoneparse.js';

export const AI_SYS_PHONE_KO = `GOAL
Translate what a character's phone shows into natural Korean, each line in the voice that person really uses with that listener.

YOU GET
- OWNER: whose phone it is.
- VOICES (sometimes): how one person speaks Korean to another, as "A → B: style". Always follow it.
- EXAMPLES (sometimes): lines of the same chats already in Korean. Keep their voice.
- GLOSSARY (sometimes): names and terms, written exactly this way.
- LINES: numbered, each "[app · who → to]" and its words. "self" is the owner writing for themselves.

VOICE
- Each line in the voice its writer really uses with that listener, as VOICES and EXAMPLES show; with neither, as the original and the relationship suggest. One pair keeps one voice.

LINES
- Translate every line in full, with its meaning, length, line breaks and emoji. No notes, no explanations.
- Names of people and places in Korean script, the GLOSSARY spelling when given. Brand and app names as Korean users write them.

JSON (one object, nothing before or after it)
{ "voices": [{ "from", "to", "style": a short note in Korean, like "반말, 무뚝뚝하게" }] (each pair you decided that VOICES doesn't have),
  "lines": [{ "n": its number, "ko": the Korean }] }
Every number once.`;

// how many fields one go fills at most (the rest wait for the next), and how much one request carries
export const KO_MAX = 400;
const KO_CHUNK = 60, KO_CHARS = 9000;

const pair = (a, b) => `${String(a).trim().toLowerCase()}→${String(b).trim().toLowerCase()}`;
const voiceRows = p => (Array.isArray(p.koVoice) ? p.koVoice : []).filter(v => v && v.from && v.to && v.style);

// a few lines of each chat in the request already in Korean, both ways, the newest
function examplesFor(p, chunk) {
    const own = p.owner || 'me', rooms = new Set(chunk.filter(g => g.app.startsWith('text')).map(g => (g.who === own ? g.to : g.who)));
    const out = [];
    for (const t of p.threads || []) {
        const room = t.group ? `${t.with} (group)` : t.with;
        if (!rooms.has(room) && !rooms.has(t.with)) continue;
        for (const m of (t.messages || []).filter(m => String(m.ko || '').trim()).slice(-4)) {
            const who = m.from === 'me' ? own : m.from, to = m.from === 'me' ? room : t.group ? room : own;
            out.push(`- ${who} → ${to}: "${String(m.text).replace(/\s+/g, ' ').slice(0, 160)}" = "${String(m.ko).replace(/\s+/g, ' ').slice(0, 160)}"`);
        }
    }
    return out.slice(0, 24);
}

function inputOf(p, chunk) {
    const voices = voiceRows(p), gloss = hasChat() ? glossaryIn(glossaryEntries(getMeta()), chunk.map(g => g.x[g.f]).join('\n')) : [];
    const ex = examplesFor(p, chunk);
    return [
        `[OWNER]\n${p.owner || 'me'}`,
        voices.length ? `[VOICES]\n${voices.map(v => `- ${v.from} → ${v.to}: ${v.style}`).join('\n')}` : '',
        ex.length ? `[EXAMPLES]\n${ex.join('\n')}` : '',
        gloss.length ? `[GLOSSARY]\n${gloss.map(e => `- ${e.src} = ${e.ko}`).join('\n')}` : '',
        `[LINES]\n${chunk.map((g, i) => `${i + 1}: [${g.app} · ${g.who} → ${g.to}] ${JSON.stringify(String(g.x[g.f]))}`).join('\n')}`,
    ].filter(Boolean).join('\n\n');
}

// fills what has no Korean; the number filled. Throws when the translator fails (what came back before stays)
export async function fillKo(p, { max = KO_MAX } = {}) {
    const gaps = koGaps(p).slice(0, max);
    let n = 0;
    for (let i = 0; i < gaps.length;) {
        let j = i, size = 0;
        const len = g => String(g.x[g.f]).length;
        while (j < gaps.length && (j === i || (j - i < KO_CHUNK && size + len(gaps[j]) < KO_CHARS))) { size += len(gaps[j]); j++; }
        const chunk = gaps.slice(i, j);
        i = j;
        const out = await askTranslator(inputOf(p, chunk), { system: AI_SYS_PHONE_KO, maxTokens: Math.min(16384, 1500 + size * 3) });
        const got = parseJson(String(out).replace(/^[^{]*/, '').replace(/[^}]*$/, ''), { salvage: true }) || {};
        // a pair the translator decided is kept; one the table already has (the user's own, or an earlier) stays as it is
        const have = new Set(voiceRows(p).map(v => pair(v.from, v.to)));
        const fresh = (Array.isArray(got.voices) ? got.voices : []).filter(v => v && String(v.from || '').trim() && String(v.to || '').trim() && String(v.style || '').trim() && !have.has(pair(v.from, v.to)))
            .map(v => ({ from: String(v.from).trim().slice(0, 60), to: String(v.to).trim().slice(0, 60), style: String(v.style).trim().slice(0, 80), by: 'model' }));
        if (fresh.length) p.koVoice = [...voiceRows(p), ...fresh].slice(-80);
        for (const r of Array.isArray(got.lines) ? got.lines : []) {
            const g = chunk[Number(r?.n) - 1], ko = String(r?.ko ?? '').trim();
            if (g && ko && !String(g.x[g.k] ?? '').trim()) { g.x[g.k] = ko; n++; }
        }
    }
    if (n) refreshUndoAfter(p);
    return n;
}
