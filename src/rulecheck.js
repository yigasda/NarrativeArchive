// 세는 규칙 검사: after a compression, the extension counts what the instruction asks for (bullets, words, em dashes,
// banned phrases) section by section. The instruction still says all of it; this only catches what the model missed,
// and asks again for those sections alone, once.

import { askCompress, SECTION_GUARD, stripThink } from './ai.js';
import { globalSettings } from './core.js';
import { archiveLang, langBlock } from './prompts.js';
import { RANGE_HEAD, splitTail } from './sections.js';

export const MAX_BULLETS = 6;
export const MAX_WORDS = 275; // "rarely more than about 250": a little room before it counts as over
export const MAX_DASHES = 1;
// from the instruction's NEVER list; only looked for when the archive is in English
const BANNED = ['tender', 'intimate', 'profound', 'palpable', 'a testament to', 'unspoken', 'electric', 'in that moment', 'it was clear that', "couldn't help but", 'their bond deepened', 'something shifted'];
const bannedRe = new RegExp(`\\b(${BANNED.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]")).join('|')})\\b`, 'gi');

export const countCheckOn = () => true; // always on since 3.87.8: it only asks again when a section breaks a count

// the "## #a–#b — Title" blocks of an answer's body, with where each one sits
export function rangedBlocks(body) {
    const lines = String(body).split('\n');
    const out = [];
    let pos = 0, cur = null;
    for (const l of lines) {
        const head = /^##\s+(.*)$/.exec(l);
        const r = head && RANGE_HEAD.exec(head[1].trim());
        // a block ends at the next heading of any level, or at the "---" before the change lists
        if (head || /^#\s/.test(l) || /^-{3,}\s*$/.test(l)) { if (cur) { cur.end = pos; out.push(cur); } cur = r ? { start: pos, key: `${r[2]}-${r[4]}`, head: l } : null; }
        pos += l.length + 1;
    }
    if (cur) { cur.end = Math.min(pos, String(body).length); out.push(cur); }
    return out.map(b => ({ ...b, text: String(body).slice(b.start, b.end).replace(/\s+$/, '') }));
}

// what one section breaks: [] when nothing
export function sectionProblems(text, { english = false, counts = true, maxWords = MAX_WORDS } = {}) {
    const bullets = String(text).split('\n').filter(l => /^\s*[-*•]\s/.test(l));
    const plain = bullets.map(l => l.replace(/^\s*[-*•]\s/, '').replace(/\([^()]*#\d[^()]*\)/g, ' '));
    const words = plain.join(' ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
    const dashes = plain.join(' ').split('—').length - 1;
    const out = [];
    if (counts && bullets.length > MAX_BULLETS) out.push(`${bullets.length} bullets (at most ${MAX_BULLETS}: merge bullets that belong together)`);
    if (counts && words > maxWords) out.push(`about ${words} words (about 250 at most: cut staging, repeats and lower-priority detail)`);
    if (dashes > MAX_DASHES) out.push(`${dashes} em dashes in the bullets (at most ${MAX_DASHES}: rewrite the rest with a comma, a colon or a new sentence)`);
    if (english) {
        const hits = [...new Set((plain.join(' ').match(bannedRe) || []).map(w => w.toLowerCase()))];
        if (hits.length) out.push(`banned wording: ${hits.map(w => `"${w}"`).join(', ')} (say the same thing plainly without it)`);
    }
    return out;
}

const FIX_SYS = `You fix sections of a role-play archive that break a few counted rules. Each section comes with what is wrong with it. Change only what the problem needs; keep everything else word for word.
- Too many bullets: merge bullets that belong together. Never drop a cause, a reason, a decision or a quote to get there; merge instead.
- Too many words: cut staging (movement, gestures, props, scenery), repeated content and lower-priority detail. Keep every cause before its reaction, every trigger before its decision, and anything that limits a fact: what someone saw, admitted or only suspected, an "even so", an "only". Quotes that stay stay exactly as written.
- Too many em dashes: rewrite the extra ones with a comma, a colon or a new sentence.
- Banned wording: say the same thing plainly, without it and without a new image.
- Every sentence keeps its message numbers, such as (#88). A sentence made from two keeps the numbers of both.
- Keep each heading line and "PLOT:" exactly as they are. Do not add facts, quotes, interpretation or a closing line about what it meant.
Output only the fixed sections, in the same order, each starting with its heading line. Nothing else.`;

// res: a compression's answer ({ text, … }). Returns it with the over-limit sections asked for again and swapped in
// where the new one breaks fewer rules. memo: a user's note wins over the counts, so with one only dashes and wording are checked
// force: asked for by hand (작업실's 고쳐 받기), so it runs with the switch off; maxWords: 작업실 marks from 250 on
export async function checkCounts(res, { m, memo = '', force = false, maxWords = MAX_WORDS } = {}) {
    if ((!force && !countCheckOn()) || !res?.text) return res;
    const [body, tail] = splitTail(res.text);
    const english = archiveLang(m?.text || body) === 'en';
    const opt = { english, counts: !String(memo || '').trim(), maxWords };
    const blocks = rangedBlocks(body);
    const bad = blocks.map(b => ({ ...b, probs: sectionProblems(b.text, opt) })).filter(b => b.probs.length);
    if (!bad.length) return { ...res, countFixed: 0, countLeft: 0 };
    const ask = bad.map(b => `[PROBLEMS: ${b.probs.join('; ')}]\n${b.text}`).join('\n\n');
    let fixed = [];
    try {
        const out = stripThink(await askCompress(`${ask}${langBlock(m?.text || body, { tail: false, src: '' })}`, { system: FIX_SYS, guard: SECTION_GUARD }));
        fixed = rangedBlocks(String(out || '').replace(/^```[a-z]*\n?|```\s*$/g, ''));
    } catch (e) {
        console.warn('[narrative-archive] count check', e);
        return { ...res, countFixed: 0, countLeft: bad.length, countError: String(e?.message || e) };
    }
    let text = body, gone = 0, left = 0;
    // swap from the end, so the earlier positions stay right
    for (const b of [...bad].reverse()) {
        const f = fixed.find(x => x.key === b.key);
        const nowProbs = f ? sectionProblems(f.text, opt) : b.probs;
        // a fix that lost its bullets, or broke more than before, is not used
        const ok = f && /^\s*[-*•]\s/m.test(f.text) && nowProbs.length < b.probs.length;
        if (ok) { text = `${text.slice(0, b.start)}${f.text}\n\n${text.slice(b.end).replace(/^\s+/, '')}`; gone++; }
        if ((ok ? nowProbs : b.probs).length) left++;
    }
    return { ...res, text: `${text.replace(/\n{3,}/g, '\n\n')}${tail}`, countFixed: gone, countLeft: left };
}
