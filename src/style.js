// 문체 다듬기: new sections get one more pass for their sentences alone. No raw log goes with it, only the sections,
// the instruction's voice rules and the archive's own writing to match, so the editor does one job: how it is said.
// What is said is guarded by the extension: a section comes back with the same bullets, numbers and quotes, or it stays.

import { askFix, stripThink } from './ai.js';
import { globalSettings } from './core.js';
import { TIDY_PROMPT, activePrompt, archiveLang, langBlock } from './prompts.js';
import { checkCounts, countCheckOn, rangedBlocks, sectionProblems } from './rulecheck.js';
import { rawFor } from './retitle.js';
import { lastSections, styleSamples } from './scenes.js';
import { splitTail } from './sections.js';

// the voice rules of the instruction in use: the tidied one's "# 6.", the basic one's <tone> + <archive_voice>,
// or the tidied one's for an instruction that has neither
const VOICE_TIDY = /^# 6\. The archive's voice\n([\s\S]*?)\n# 7\./m;
export function voiceRules(text) {
    const t = String(text || '');
    const a = VOICE_TIDY.exec(t);
    if (a) return a[1].trim();
    const tone = /<tone>[\s\S]*?<\/tone>/.exec(t)?.[0] || '', voice = /<archive_voice>[\s\S]*?<\/archive_voice>/.exec(t)?.[0] || '';
    if (voice) return `${tone}\n\n${voice}`.trim();
    return VOICE_TIDY.exec(TIDY_PROMPT)[1].trim();
}

export const AI_SYS_STYLE = `You are the line editor of a role-play's long-term memory (the archive). The sections you get are already right in content. Your one job is their sentences: make them read as if the hand that wrote the VOICE SAMPLES wrote them, following the VOICE RULES. You change how things are said, never what is said.

WHAT YOU LOOK FOR, bullet by bullet
1. Tone: calm, plain, exact. A sentence that sounds impressive is too much.
2. Length and rhythm: two to four sentences of middle length per bullet. A long sentence that joins acts with different purposes ("paid…, packed…, and sent…") becomes two or three; join acts only when they are one motion. A short, flat sentence often closes a bullet.
3. Narrator images: a metaphor the raw log does not have ("her smile melted his anger", "a thaw between them") becomes the plain fact ("and his anger was gone").
4. Feeling: name it once and say whose it is, or give the one bodily sign the log gives. Never both ("Pale and afraid" keeps one of them).
5. Openings: a sentence usually opens on its subject, but never the same first word twice in one bullet (he and she count; only a name may repeat), and never the same opening shape again and again across a section (a run of "Stung…", "Startled…", "Furious…", "Hoping…"). Do not answer that by starting every sentence with he or she: use the name, or another opening the VOICE RULES show ("Three days on, …", "To Ren, …", "When she left, …", "But she …").
FOUND, under a section, lists what the extension counted in it. Fix every item there as well.

STEPS
1. For each section, first write <notes>…</notes>: one line per change, "B<bullet number>: what is wrong → what you do". A bullet with nothing wrong gets no line and stays word for word.
2. Then write the section with those changes.

NEVER CHANGE
- what happened, who did it, why, in what order, or what it changed. Every cause stays before its reaction, every trigger before its decision.
- any quote: a line in quotation marks stays exactly as written, and keeps the words around it that say who said it.
- the message numbers in parentheses, such as (#88). Each bullet keeps exactly the numbers it has, no more and none fewer, and nothing moves from one bullet to another. Every sentence ends with its numbers; when you split a sentence, each part gets the numbers it needs; when you join two, keep both.
- a reading that belongs to a character ("In her own reckoning", "claiming he…"): it stays theirs.
- heading lines, "PLOT:", how many bullets there are and what each one covers.
Do not add facts, feelings, images, interpretation, or a closing line about what it meant. Do not drop content: only words the rules above rule out may go.

A section may come with its RAW LOG: the messages it covers. Use it only to check what is true: who felt or said what, whose reading something is, what came first, whether an image is the log's own. Never add anything from it that the section does not already say.
The VOICE SAMPLES are already in the archive. Never output, copy or continue them; take only their sound.

OUTPUT
For each section in order: its <notes> block, then the section starting with its heading line. No <section> tags, no raw log, nothing else.`;

// which messages a section points to: a split sentence repeats a number and a joined one carries it once,
// so what must match is the set (none lost, none new), not how often each appears
const citeSet = t => new Set([...String(t).matchAll(/\(([^()]*#\d[^()]*)\)/g)].flatMap(x => (x[1].match(/\d+/g) || []).map(Number)));
const bulletsOf = t => String(t).split('\n').filter(l => /^\s*[-*•]\s/.test(l));
// each bullet keeps the messages it pointed to: '' when it does, else what was lost or added, e.g. "불릿 2 #17 빠짐"
function citeDrift(before, after) {
    const a = bulletsOf(before), b = bulletsOf(after);
    for (let k = 0; k < a.length; k++) {
        const x = citeSet(a[k]), y = citeSet(b[k] || '');
        const lost = [...x].filter(n => !y.has(n)), added = [...y].filter(n => !x.has(n));
        if (lost.length || added.length) return `불릿 ${k + 1} ${[lost.length && `${lost.map(n => `#${n}`).join(', ')} 빠짐`, added.length && `${added.map(n => `#${n}`).join(', ')} 생김`].filter(Boolean).join(' · ')}`;
    }
    return '';
}
const quotes = t => [...String(t).matchAll(/["“]([^"”\n]{2,})["”]/g)].map(x => x[1].replace(/[.,!?…]+$/, '').trim());
const bulletCount = t => bulletsOf(t).length;

// ---- what the extension can count in the sentences, sent to the editor as FOUND and checked again after
const NOT_NAMES = new Set(['he', 'she', 'they', 'his', 'her', 'their', 'him', 'it', 'its', 'the', 'a', 'an', 'when', 'but', 'then', 'after', 'as', 'at', 'in', 'on', 'so', 'and', 'with', 'by', 'while', 'once', 'still', 'this', 'that', 'there']);
const METAPHORS = /\b(melt(?:ed|ing|s)?|disarm(?:ed|ing|s)?|thaw(?:ed|ing|s)?|shatter(?:ed|ing|s)?|crumbl(?:ed|ing|es)|flood(?:ed|ing|s)|wash(?:ed|es)? over|ignit(?:ed|ing|es)|spark(?:ed|ing|s)|pierc(?:ed|ing|es)|drown(?:ed|ing|s)|swallow(?:ed|ing|s) (?:by|in)|crack(?:ed|ing)? open|wall(?:s)? (?:came|come|coming) down)\b/i;
const BODY = /\b(flushed|blushing|blushed|trembling|shaking|pale|red-faced|tearful|in tears|clenched|white-knuckled)\b/i;
const FEELING = /\b(angry|furious|ashamed|embarrassed|afraid|scared|hurt|jealous|anxious|nervous|stung|glad|relieved|upset|annoyed|irritated|resentful)\b/i;
const sentencesOf = line => line.replace(/^\s*[-*•]\s*/, '').split(/(?<=[.!?…]["”]?)\s+(?=["“(]?[A-Z가-힣])/).map(x => x.trim()).filter(Boolean);
const firstWord = x => (x.replace(/^["“(]+/, '').match(/^[\p{L}'’-]+/u) || [''])[0];
const SHAPE = /^(?:[A-Z][a-z]+(?:ed|ing)\b|(?:Furious|Angry|Glad|Afraid|Unable|Resentful|Flushed|Hurt|Desperate|Determined|Stung|Surprised|Relieved|Annoyed|Ashamed|Jealous)\b)/;
export function styleLint(text, { english = true } = {}) {
    const out = sectionProblems(text, { english });
    const bullets = bulletsOf(text);
    const shaped = [];
    bullets.forEach((l, k) => {
        const B = `B${k + 1}`;
        const ss = sentencesOf(l.replace(/\([^()]*#\d[^()]*\)/g, ''));
        const seen = new Map();
        for (const x of ss) {
            const w = firstWord(x), lw = w.toLowerCase();
            if (!w) continue;
            if (seen.has(lw) && (NOT_NAMES.has(lw) || !/^\p{Lu}/u.test(w))) { out.push(`${B}: two sentences open with "${w}"`); break; }
            seen.set(lw, true);
        }
        if (!english) return;
        for (const x of ss) {
            const n = x.split(/\s+/).length;
            if (n > 32) out.push(`${B}: a ${n}-word sentence ("${x.split(/\s+/).slice(0, 6).join(' ')}…"): split it where the purpose changes`);
            // "paid …, packed …, and sent …": a list of acts ending in ", and <verb>"
            if (/,\s+[a-z]+\b[^,;]*,\s+and\s+(?!(?:the|a|an|his|her|their|he|she|they|it|its|that|this|then|so)\b)[a-z]+/.test(x)) out.push(`${B}: several acts joined in one sentence ("${x.split(/\s+/).slice(0, 6).join(' ')}…")`);
            if (SHAPE.test(x.replace(/^["“(]+/, ''))) shaped.push(`${B} "${x.split(/\s+/).slice(0, 2).join(' ')}…"`);
            const mt = x.match(METAPHORS);
            if (mt) out.push(`${B}: "${mt[0]}" may be a narrator image: keep it only if the raw log has it`);
            if (BODY.test(x) && FEELING.test(x)) out.push(`${B}: a feeling named and shown by the body together ("${x.match(BODY)[0]}", "${x.match(FEELING)[0]}"): keep one`);
        }
    });
    if (shaped.length >= 2) out.push(`the same opening shape ${shaped.length} times: ${shaped.join(', ')}`);
    return [...new Set(out)];
}

// why a rewritten section is not taken ('' when it is)
export function styleGuard(before, after) {
    if (!after) return '답에 없음';
    if (bulletCount(after) !== bulletCount(before)) return '불릿 수가 바뀜';
    const drift = citeDrift(before, after);
    if (drift) return `출처 번호가 바뀜 (${drift})`;
    const q = quotes(after).join('\n');
    if (quotes(before).some(x => !q.includes(x))) return '인용이 바뀜';
    if (after.split('\n')[0].trim() !== before.split('\n')[0].trim()) return '제목 줄이 바뀜';
    return '';
}

// draft: the append window's text; withRaw: each section goes with the messages it covers.
// Returns { text, changed, kept: [{ head, why }], raws, notes, foundBefore, left }, or throws
// rawOf: where a section's messages come from (default: this chat, read by its heading's numbers)
// again: what the count still finds after the pass gets one more pass, once
export async function polishStyle(draft, m, { withRaw = true, rawOf = null, again = true } = {}) {
    const [body, tail] = splitTail(String(draft || ''));
    const blocks = rangedBlocks(body);
    if (!blocks.length) throw new Error('다듬을 섹션이 없어요 · 제목 줄이 `## #시작–#끝 — 제목` 모양이어야 해요');
    const own = styleSamples(m).map(x => x.text);
    // a section being polished is never its own sample (one already in the archive is among its last sections)
    const heads = new Set(blocks.map(b => b.head.trim()));
    const samples = (own.length ? own : lastSections(m?.text || '', 4).filter(x => !heads.has(x.split('\n')[0].trim())).slice(-2)).join('\n\n');
    // each section's own messages, read from the chat (they are not hidden yet); one that cannot be found goes alone
    const readRaw = rawOf || (b => rawFor(m, { title: b.head.replace(/^##\s*/, '') }, { here: true }).then(r => r.raw || ''));
    const raws = withRaw ? await Promise.all(blocks.map(b => Promise.resolve(readRaw(b)).then(x => x || '', () => ''))) : blocks.map(() => '');
    const english = archiveLang(m?.text || body) !== 'ko';
    const found = blocks.map(b => styleLint(b.text, { english }));
    const secs = blocks.map((b, i) => `<section>\n${b.text}\n</section>${found[i].length ? `\nFOUND:\n${found[i].map(x => `- ${x}`).join('\n')}` : ''}${raws[i] ? `\n<raw_log>\n${raws[i]}\n</raw_log>` : ''}`).join('\n\n');
    const prompt = `VOICE RULES:\n${voiceRules(activePrompt(globalSettings())?.text)}\n\n${samples ? `VOICE SAMPLES (already in the archive: never output them):\n${samples}\n\n` : ''}NEW SECTIONS${raws.some(Boolean) ? ', each with its RAW LOG' : ''}:\n${secs}${langBlock(m?.text || body, { tail: false, src: raws.some(Boolean) ? 'the raw log is' : '' })}`;
    const answer = stripThink(await askFix(prompt, { system: AI_SYS_STYLE })).replace(/^```[a-z]*\n?|```\s*$/g, '');
    // the editor's notes, one line per change; then what is left is the sections (tags a model echoed back go too)
    const notes = [...answer.matchAll(/<notes>([\s\S]*?)<\/notes>/g)].flatMap(x => x[1].split('\n').map(l => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean));
    const out = answer.replace(/<notes>[\s\S]*?<\/notes>/g, '').replace(/<raw_log>[\s\S]*?<\/raw_log>/g, '').replace(/^FOUND:\n(?:- .*\n?)*/gm, '').replace(/^\s*<\/?section>\s*$/gm, '').trim();
    const got = rangedBlocks(out);
    if (!got.length) throw new Error('모델이 섹션 모양으로 답하지 않았어요 · 초안은 그대로예요');
    let text = body, changed = 0;
    const kept = [];
    // swap from the end, so the earlier positions stay right
    for (const b of [...blocks].reverse()) {
        const a = got.find(x => x.key === b.key)?.text || '';
        const why = styleGuard(b.text, a);
        if (why) { kept.unshift({ head: b.head.replace(/^##\s*/, ''), why }); continue; }
        if (a.trim() === b.text.trim()) continue;
        text = `${text.slice(0, b.start)}${a}\n\n${text.slice(b.end).replace(/^\s+/, '')}`;
        changed++;
    }
    // what is still there after the pass, counted the same way
    const after = rangedBlocks(text).map(b => styleLint(b.text, { english })).flat();
    let res = { text: `${text.replace(/\n{3,}/g, '\n\n')}${tail}`, changed, kept, raws: raws.filter(Boolean).length, notes, foundBefore: found.flat().length, left: after };
    if (again && changed && after.length) {
        const r2 = await polishStyle(res.text, m, { withRaw, rawOf, again: false }).catch(() => null);
        if (r2?.changed) res = { ...r2, changed: Math.max(changed, r2.changed), kept: [...kept, ...r2.kept.filter(k => !kept.some(x => x.head === k.head))], notes: [...notes, ...r2.notes], foundBefore: res.foundBefore };
    }
    // the rewrite may have brought back an em dash or a long bullet: the counts are checked again
    if (again && res.changed && countCheckOn()) {
        const c = await checkCounts({ text: res.text }, { m });
        res = { ...res, text: c.text, countFixed: c.countFixed || 0, countLeft: c.countLeft || 0 };
        if (c.countFixed) res.left = rangedBlocks(splitTail(res.text)[0]).map(b => styleLint(b.text, { english })).flat();
    }
    return res;
}

// one line for the toast: how many changes the editor listed, and what the count still finds
export const styleSummary = r => `${r.notes?.length ? ` · 고친 점 ${r.notes.length}개` : ''}${r.left?.length ? ` · 아직 남은 것 ${r.left.length}개: ${r.left.slice(0, 3).join(' / ')}${r.left.length > 3 ? ' …' : ''}` : ' · 셀 수 있는 건 다 고쳐졌어요'}`;
