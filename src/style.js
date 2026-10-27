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

export const AI_SYS_STYLE = `You are the line editor of a role-play's long-term memory (the archive). The sections you get are already right in content. Your one job is their sentences: make them read as if the hand that wrote the VOICE SAMPLES wrote them, by the VOICE RULES. You change how things are said, never what is said. The VOICE RULES decide; the points below are where new sections most often slip from them.

WHAT YOU LOOK FOR, bullet by bullet
1. Tone: a quiet, exact chronicler. Plain sentences, names instead of descriptions. The more serious the moment, the plainer the sentence; a sentence that sounds impressive is too much.
2. Length and rhythm: two to four sentences per bullet, mostly of middle length; a short, flat sentence often closes it. Join acts in one sentence when they are one motion, and start a new sentence when the purpose changes ("paid…, packed…, and sent…" may be two). A bullet's closing beat stays tied to what led to it: in the same sentence, or opened with a word that carries the order or the pause ("Then he stood by her empty chair.").
3. Openings: most sentences open on their subject, a name or he/she, and now and then one opens otherwise; that mix is the voice. Two sentences in one bullet do not open with the same word (he and she count; a name may repeat). When several sentences in a section open on a feeling or a participle ("Stung that…", "Hoping to…"), keep the one that reads best and turn the others: the subject first, the reason after the act ("He told her to stay, stung that…"), with the feeling inside the act's sentence rather than a sentence of its own.
4. Feeling: the characters carry it through what they did and said; the narrator stays quiet. Name a feeling once and say whose it is, or give the one bodily sign the log gives, never both ("Pale and afraid" keeps one).
5. Images and endings: no narrator metaphors. An image stays only if the raw log has it; with no raw log, write it plainly ("her smile melted his anger" becomes what happened: "and his anger was gone"). A bullet does not end on what it meant.
6. Punctuation: a colon only to introduce a line, a reason, or what something meant to someone; a semicolon for two acts that answer each other; at most one em dash in a section's bullets, the rest a comma, a colon or a new sentence. No long "and… and… and" sentences.
HOW MUCH TO CHANGE
- Fix what is wrong, as little as it takes. Most bullets need one change or none; a bullet that already reads right stays word for word.
- The small words that carry the logic (and, but, or, yet, still, because, so, only) keep their meaning: "angry at this and at that" never becomes "angry at this or that".
- The points above are the voice's habits, not quotas. When two of them pull against each other, choose the plainer sentence that keeps the meaning exact.
- FOUND, under a section, is what the extension counted in it by rule of thumb. Fix the items that are real; one you leave as it is, say why in your notes.

STEPS
1. For each section, first write <notes>…</notes>: one line per change, "B<bullet number>: what is wrong → what you do". A bullet with nothing wrong gets no line and stays word for word.
2. Then write the section with those changes.

NEVER CHANGE
- what happened, who did it, why, in what order, or what it changed. Every cause stays before its reaction, every trigger before its decision; moving a reason after its act inside one sentence is fine.
- any quote: a line in quotation marks stays exactly as written, and keeps the words around it that say who said it.
- the message numbers in parentheses, such as (#88). Each bullet keeps exactly the numbers it has, no more and none fewer, and nothing moves from one bullet to another. Every sentence ends with its numbers; when you split a sentence, each part gets the numbers it needs; when you join two, keep both.
- whose something is: a reading or a feeling that belongs to a character ("In her own reckoning", "claiming he…") stays theirs, and felt experience stays felt ("feeling hunted" never becomes "hunted").
- heading lines, "PLOT:", how many bullets there are and what each one covers.
Do not add facts, feelings, images, interpretation, absolutes ("never", "not once"), or the archive's set shapes ("rather than…", "In her own reckoning…") where the section does not have them. Do not drop content: only words the VOICE RULES rule out may go.

A section may come with its RAW LOG: the messages it covers. Use it only to check what is true: who felt or said what, whose reading something is, what came first, whether an image is the log's own. Never add anything from it that the section does not already say.
The VOICE SAMPLES are already in the archive. Never output, copy or continue them; take only their sound.

OUTPUT
For each section in order: its <notes> block, then the section starting with its heading line. No <section> tags, no raw log, nothing else.`;

// which messages a bullet points to. A range "(#5–#7)" stands for 5, 6 and 7, so a sentence split out of it with (#6)
// is not a new number; what may not happen is a number the bullet did not cover, or one it named going missing
const CITE_PAREN = /\(([^()]*#\d[^()]*)\)/g;
function citeNums(t) {
    const singles = new Set(), ranges = [], covered = new Set();
    for (const mk of String(t).matchAll(CITE_PAREN)) {
        for (const r of mk[1].matchAll(/#?(\d+)\s*(?:[–—~-]\s*#?(\d+))?/g)) {
            const x = Number(r[1]), y = r[2] !== undefined ? Number(r[2]) : x, lo = Math.min(x, y), hi = Math.max(x, y);
            if (lo === hi) singles.add(lo); else ranges.push([lo, hi]);
            for (let n = lo; n <= hi && n - lo <= 60; n++) covered.add(n);
        }
    }
    return { singles, ranges, covered };
}
const bulletsOf = t => String(t).split('\n').filter(l => /^\s*[-*•]\s/.test(l));
// one bullet: '' when it keeps its messages, else what was lost or added, e.g. "#17 빠짐"
function bulletCiteDrift(before, after) {
    const x = citeNums(before), y = citeNums(after);
    // a single number must still be there; a range must keep at least one of its messages
    const lost = [...[...x.singles].filter(n => !y.covered.has(n)), ...x.ranges.filter(([lo, hi]) => ![...y.covered].some(n => n >= lo && n <= hi)).map(([lo, hi]) => `${lo}–#${hi}`)];
    // a number between the bullet's own first and last is a split sentence, not content from elsewhere
    const lo = Math.min(...x.covered), hi = Math.max(...x.covered);
    const added = [...y.covered].filter(n => !x.covered.has(n) && !(n > lo && n < hi));
    return [lost.length && `${lost.map(n => `#${n}`).join(', ')} 빠짐`, added.length && `${added.map(n => `#${n}`).join(', ')} 생김`].filter(Boolean).join(' · ');
}
const quotes = t => [...String(t).matchAll(/["“]([^"”\n]{2,})["”]/g)].map(x => x[1].replace(/[.,!?…]+$/, '').trim());
// one bullet rewritten: '' when it can be taken
function bulletGuard(before, after) {
    const drift = bulletCiteDrift(before, after);
    if (drift) return `출처 번호 ${drift}`;
    const q = quotes(after).join('\n');
    if (quotes(before).some(x => !q.includes(x))) return '인용이 바뀜';
    return '';
}

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
        if (ss.length > 4) out.push(`${B}: ${ss.length} sentences (two to four in a bullet)`);
        const whiles = (l.match(/\bwhile\b/gi) || []).length;
        if (whiles >= 2) out.push(`${B}: "while" ${whiles} times`);
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
            if (n > 32) out.push(`${B}: a long sentence, ${n} words ("${x.split(/\s+/).slice(0, 6).join(' ')}…"): split it where the purpose changes, keeping the bullet within four sentences`);
            // "paid …, packed …, and sent …": a list of acts ending in ", and <verb>"
            if (/,\s+[a-z]+\b[^,;]*,\s+and\s+(?!(?:the|a|an|his|her|their|he|she|they|it|its|that|this|then|so)\b)[a-z]+/.test(x)) out.push(`${B}: several acts joined in one sentence ("${x.split(/\s+/).slice(0, 6).join(' ')}…")`);
            if (SHAPE.test(x.replace(/^["“(]+/, ''))) shaped.push(`${B} "${x.split(/\s+/).slice(0, 2).join(' ')}…"`);
            const mt = x.match(METAPHORS);
            if (mt) out.push(`${B}: "${mt[0]}" may be a narrator image: say plainly what happened`);
            // a feeling standing as its own sentence: "He was furious at …", "She felt hurt …"
            const fs = x.replace(/^["“(]+/, '').match(/^(?:He|She|They|[A-Z][a-z]+) (?:was|were|felt|grew|became) (?:\w+ )?(angry|furious|ashamed|embarrassed|afraid|scared|hurt|jealous|anxious|nervous|stung|glad|relieved|upset|annoyed|irritated|resentful|surprised|startled|shocked|pleased|happy|sad|worried|frustrated)\b/);
            if (fs) out.push(`${B}: the feeling stands as its own sentence ("${x.split(/\s+/).slice(0, 4).join(' ')}…"): put the act first and the feeling after it in the same sentence`);
            if (BODY.test(x) && FEELING.test(x)) out.push(`${B}: a feeling named and shown by the body together ("${x.match(BODY)[0]}", "${x.match(FEELING)[0]}"): keep one`);
        }
    });
    // "Also" opening a sentence is a patch; "Then" is left alone, it carries the order or the pause of a closing beat
    const alsos = bullets.flatMap((l, k) => sentencesOf(l).filter(x => /^Also\b|^\S+ also\b/.test(x)).map(() => `B${k + 1}`));
    if (english && alsos.length) out.push(`"also" patches ${alsos.length} sentence${alsos.length > 1 ? 's' : ''} (${alsos.join(', ')}): join the act to the one before it instead`);
    if (shaped.length >= 2) out.push(`${shaped.length} sentences open on a feeling or a participle instead of the subject: ${shaped.join(', ')}. Keep the one that reads best, turn the others subject first`);
    return [...new Set(out)];
}

// a rewritten section, bullet by bullet: the heading and the number of bullets must hold, or it all stays;
// then each bullet that keeps its numbers and quotes is taken, and one that does not stays as it was.
// Returns { text, why, kept: ['B1: …'] } — why is set when nothing could be taken
export function mergeRewrite(before, after) {
    if (!after) return { text: before, why: '답에 없음', kept: [] };
    if (after.split('\n')[0].trim() !== before.split('\n')[0].trim()) return { text: before, why: '제목 줄이 바뀜', kept: [] };
    const a = bulletsOf(before), b = bulletsOf(after);
    if (a.length !== b.length) return { text: before, why: '불릿 수가 바뀜', kept: [] };
    const kept = [];
    let k = 0;
    const text = before.split('\n').map(l => {
        if (!/^\s*[-*•]\s/.test(l)) return l;
        const i = k++, why = bulletGuard(a[i], b[i]);
        if (why) { kept.push(`B${i + 1}: ${why}`); return l; }
        return b[i];
    }).join('\n');
    return { text, why: kept.length === a.length ? kept.join(', ') : '', kept };
}
export const styleGuard = (before, after) => { const r = mergeRewrite(before, after); return r.why || (r.kept.length ? r.kept.join(', ') : ''); };

// draft: the append window's text; withRaw: each section goes with the messages it covers (off: the pass is about
// wording alone, the guards keep the facts, and a long raw log only pulls the editor's eye off the checklist).
// Returns { text, changed, kept: [{ head, why }], raws, notes, foundBefore, left }, or throws
// rawOf: where a section's messages come from (default: this chat, read by its heading's numbers)
// again: what the count still finds after the pass gets one more pass, once
export async function polishStyle(draft, m, { withRaw = false, rawOf = null, again = true } = {}) {
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
        const mg = mergeRewrite(b.text, got.find(x => x.key === b.key)?.text || '');
        const head = b.head.replace(/^##\s*/, '');
        if (mg.why) { kept.unshift({ head, why: mg.why }); continue; }
        if (mg.kept.length) kept.unshift({ head, why: `${mg.kept.join(', ')} · 그 불릿만 그대로`, part: true });
        if (mg.text.trim() === b.text.trim()) continue;
        text = `${text.slice(0, b.start)}${mg.text}\n\n${text.slice(b.end).replace(/^\s+/, '')}`;
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
// what stayed as it was: whole sections, or single bullets inside a section that was otherwise taken
export const keptSummary = r => (r.kept?.length ? ` · 그대로 둔 것: ${r.kept.map(k => `${k.head.split(' — ')[0]} ${k.why.replace(/ · 그 불릿만 그대로$/, '')}`).join(' / ')}` : '');
