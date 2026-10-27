// 문체 다듬기: new sections get one more pass for their sentences alone. No raw log goes with it, only the sections,
// the instruction's voice rules and the archive's own writing to match, so the editor does one job: how it is said.
// What is said is guarded by the extension: a section comes back with the same bullets, numbers and quotes, or it stays.

import { askFix, stripThink } from './ai.js';
import { globalSettings } from './core.js';
import { TIDY_PROMPT, activePrompt, langBlock } from './prompts.js';
import { checkCounts, countCheckOn, rangedBlocks } from './rulecheck.js';
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

export const AI_SYS_STYLE = `You are the line editor of a role-play's long-term memory (the archive). You get NEW SECTIONS, the archive's VOICE RULES, and VOICE SAMPLES of the archive's own writing. Rewrite the sentences of each PLOT bullet so the new sections read as if the same hand wrote the samples. You change how things are said, never what is said.

Never change:
- what happened, who did it, why, in what order, or what it changed. Every cause stays before its reaction, every trigger before its decision.
- any quote: a line in quotation marks stays exactly as written, and keeps the words around it that say who said it.
- the message numbers in parentheses, such as (#88). Every sentence keeps its numbers; when you split a sentence, each part gets the numbers it needs; when you join two, keep both.
- a reading that belongs to a character ("In her own reckoning", "claiming he…"): it stays theirs.
- heading lines, "PLOT:", how many bullets there are and what each one covers.

Do not add facts, feelings, images, interpretation, or a closing line about what it meant. Do not drop content: only words the voice rules themselves rule out may go.
A section may come with its RAW LOG: the messages it covers. It is there so you do not misstate anything. Use it only to check what is true: who felt or said what, whose reading something is, what came first. Never add anything from it that the section does not already say, and never move content from one section to another. Where the section's wording and the raw log disagree, keep the section's content and only fix the wording to what the raw log shows.
The VOICE SAMPLES are already in the archive. Never output, copy or continue them; take only their sound.
Output only the new sections, in the same order, each starting with its heading line, without the <section> tags or the raw log. Nothing else.`;

const cites = t => [...String(t).matchAll(/\(([^()]*#\d[^()]*)\)/g)].flatMap(x => x[1].match(/\d+/g) || []).sort().join(',');
const quotes = t => [...String(t).matchAll(/["“]([^"”\n]{2,})["”]/g)].map(x => x[1].replace(/[.,!?…]+$/, '').trim());
const bulletCount = t => String(t).split('\n').filter(l => /^\s*[-*•]\s/.test(l)).length;

// why a rewritten section is not taken ('' when it is)
export function styleGuard(before, after) {
    if (!after) return '답에 없음';
    if (bulletCount(after) !== bulletCount(before)) return '불릿 수가 바뀜';
    if (cites(after) !== cites(before)) return '출처 번호가 바뀜';
    const q = quotes(after).join('\n');
    if (quotes(before).some(x => !q.includes(x))) return '인용이 바뀜';
    if (after.split('\n')[0].trim() !== before.split('\n')[0].trim()) return '제목 줄이 바뀜';
    return '';
}

// draft: the append window's text; withRaw: each section goes with the messages it covers.
// Returns { text, changed, kept: [{ head, why }], raws }, or throws
// rawOf: where a section's messages come from (default: this chat, read by its heading's numbers)
export async function polishStyle(draft, m, { withRaw = true, rawOf = null } = {}) {
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
    const secs = blocks.map((b, i) => (raws[i] ? `<section>\n${b.text}\n</section>\n<raw_log>\n${raws[i]}\n</raw_log>` : `<section>\n${b.text}\n</section>`)).join('\n\n');
    const prompt = `VOICE RULES:\n${voiceRules(activePrompt(globalSettings())?.text)}\n\n${samples ? `VOICE SAMPLES (already in the archive: never output them):\n${samples}\n\n` : ''}NEW SECTIONS${raws.some(Boolean) ? ', each with its RAW LOG' : ''}:\n${secs}${langBlock(m?.text || body, { tail: false, src: raws.some(Boolean) ? 'the raw log is' : '' })}`;
    const out = stripThink(await askFix(prompt, { system: AI_SYS_STYLE })).replace(/^```[a-z]*\n?|```\s*$/g, '')
        .replace(/<raw_log>[\s\S]*?<\/raw_log>/g, '').replace(/^\s*<\/?section>\s*$/gm, '').trim(); // tags a model echoed back
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
    let res = { text: `${text.replace(/\n{3,}/g, '\n\n')}${tail}`, changed, kept, raws: raws.filter(Boolean).length };
    // the rewrite may have brought back an em dash or a long bullet: the counts are checked again
    if (changed && countCheckOn()) {
        const c = await checkCounts({ text: res.text }, { m });
        res = { ...res, text: c.text, countFixed: c.countFixed || 0, countLeft: c.countLeft || 0 };
    }
    return res;
}
