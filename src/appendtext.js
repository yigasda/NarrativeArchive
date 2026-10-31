// Adding new sections, the text side: the prompts, where new sections go, rewritten sections, end numbers,
// STATE lines a rewrite dropped, and the checks before adding.

import { ctx, sectionChanges } from './core.js';
import { lineDiff, renderDiff } from './diff.js';
import { offstageSet } from './recall.js';
import { headingRanges, lastRangeEnd, parseSections, RANGE_HEAD, splitTail, tailBlocks, trimEnd } from './sections.js';
import { translateButton } from './translate.js';
import { esc, escRe, fmt } from './util.js';

export const AI_SYS_CONFLICT = `GOAL
Before NEW TEXT is added to the story archive, find places where it contradicts the EXISTING ARCHIVE.

YOU GET
- EXISTING ARCHIVE: the story so far. Its end (latest sections, STATE, OPEN) is what is true now.
- NEW TEXT: new section blocks to add. It may end with new STATE and OPEN blocks that will REPLACE the old ones.

HOW TO WORK
Step 1. Read the NEW TEXT one bullet at a time.
Step 2. For each bullet, check the EXISTING ARCHIVE for anything it clashes with.

REPORT ONLY THESE (each must clash with something the archive actually says)
1. NAME: the same person, place or thing spelled differently. e.g. "Mirabel" in the archive, "Mirabelle" in the new text.
2. TIME: dates or time of day going backwards compared with where the archive ended.
3. FACT: a fact that contradicts one already established (who did what, injuries, objects, relationships, places).
4. SETTLED: something the archive marks as resolved is reopened, or something open is treated as already resolved, with no reason given.
5. PLACE: a character in two places at once.

DO NOT REPORT
- New events, new people, new places: the story moving on is not a contradiction.
- The new STATE / OPEN being different from the old ones: they are meant to replace them. Only report it if they clash with the NEW sections themselves.
- Style, length, or anything that could be "added".
- Anything you are not sure about.

OUTPUT: Korean, one bullet per problem, exactly like this
- <무엇이 어긋나는지> — 근거 (<기존 아카이브의 섹션 제목>)
If there is no problem, write exactly: 없음`;

export const AI_SYS_DRAFTFIX = `GOAL
Revise a DRAFT of new story-archive sections (and its STATE / OPEN) the way the user asks — and nothing else.

YOU GET
- DRAFT: new section blocks ("## #from–#to — Title (date, place)", then bullets), maybe followed by "---" and STATE / OPEN.
- RAW LOG (sometimes): the messages the draft was made from, each starting with [number] and the speaker. It is the only source of new facts and quotes. Every message the bot writes carries the same name tag, even when another character speaks or acts; tell who does what from the content.
- EARLIER REQUESTS (sometimes): what the user already asked for. They are done; keep them done.
- REQUEST: what the user wants changed now. It may be in Korean. The user knows this story: where REQUEST and your reading of the raw log disagree, REQUEST wins.

STEPS
1. Do what REQUEST asks. Leave everything else word for word: the other sections and bullets, the headings' ranges, dates and places (unless asked), and STATE / OPEN (unless the change means they must say something different).
2. The sections must still cover the same message range with no gaps or overlaps. If you merge or split sections, renumber their headings from the RAW LOG.
3. New facts and quotes come only from DRAFT or RAW LOG. Never invent or paraphrase a line and present it as a quote.
4. Keep the archive's rules: one bullet = one event; the action that caused a reaction comes before it; a character's interpretation only as theirs; no commentary; same language as the DRAFT.
5. Every sentence in a bullet carries the number of the message it comes from: (#88), or (#88, #91). Keep the numbers already there; a new sentence needs its own. Only messages inside that section's range, and for a reason or motive only messages up to the moment it explains. A sentence you cannot point to a message for (a motive, a fear, a meaning the log does not state) does not go in; if the request needs one, say so on the NOTE line.
6. If part of the request cannot be done, do the rest and say what was not done on a last line that starts with "NOTE:", in Korean.

EXAMPLE
DRAFT:
## #12–#18 — The bridge (Spring 3, Varo)
PLOT:
- Ivo arrived while Ren was still hurt; Mara pulled Ren up from the broken plank (#13, #15).
REQUEST:
순서 틀렸어. 마라가 먼저 끌어올리고 그 다음에 이보가 왔어

Answer:
## #12–#18 — The bridge (Spring 3, Varo)
PLOT:
- Mara pulled Ren up from the broken plank; Ivo arrived afterward, while Ren was still hurt (#13, #15).

OUTPUT
Only the section blocks you changed, each one whole (heading, PLOT:, every bullet), in order; leave out every section you did not change. If you merged or split sections, give the new blocks: they replace every old section whose range they overlap. If STATE or OPEN must change, write that whole block after a line with only ---. Then an optional NOTE line. No fences, no comments.`;

// 이어서 고치기 answers with only the sections it changed: they replace the draft sections whose range they
// overlap, everything else stays as it was (faster to write, and nothing else can be touched)
export function spliceChanged(draft, answer) {
    const [dBody, dTail] = splitTail(String(draft || ''));
    const [aBody, aTail] = splitTail(String(answer || ''));
    const secs = t => parseSections(t).filter(x => !x.group && RANGE_HEAD.test(x.title)).map(x => {
        const r = x.title.match(RANGE_HEAD);
        return { pre: (r[1] || '').trim(), from: Math.min(+r[2], +r[4]), to: Math.max(+r[2], +r[4]), start: x.start, text: trimEnd(t.slice(x.start, x.end)).replace(/\n-{3,}\s*$/, '').trim() };
    });
    const ds = secs(dBody), as = secs(aBody);
    if (!as.length) return null;
    const hit = d => as.some(a => a.pre === d.pre && a.from <= d.to && a.to >= d.from);
    // an answer that would swallow many sections (one wide range over the whole draft) is not an edit: refuse it
    const gone = ds.filter(hit).length;
    if (gone > as.length + 1) return { refused: `모델 답이 섹션 ${gone}개를 ${as.length}개로 덮어쓰려고 해서 안 넣었어요` };
    const all = [...ds.filter(d => !hit(d)), ...as].sort((x, y) => x.from - y.from);
    const lead = ds.length ? dBody.slice(0, ds[0].start) : '';
    const given = tailBlocks(aTail).filter(b => b.key === 'STATE' || b.key === 'OPEN');
    const tail = tailBlocks(dTail).map(b => given.find(g => g.key === b.key)?.text || b.text).join('\n\n');
    return `${lead}${all.map(x => x.text).join('\n\n')}${tail.trim() ? `\n\n---\n${tail.trim()}` : ''}`;
}

// 빠진 구간 받기: only the gap's messages and the section before it go to the draft model
export const AI_SYS_GAPFILL = `GOAL
A draft of story-archive sections skipped some messages: the section before the gap ends early and the next one starts late. Write those messages into the draft so the numbering runs on with no gap — and change nothing else.

YOU GET
- SECTION BEFORE THE GAP: the section that should have covered the gap, or reached up to it.
- SECTION AFTER THE GAP: its heading only, for context. Never output it.
- GAP: the missing message range.
- RAW LOG: the gap's messages, each starting with [number] and the speaker. It is the only source of new facts and quotes. Every message the bot writes carries the same name tag, even when another character speaks or acts; tell who does what from the content.

STEPS
1. Read the RAW LOG. If it continues the scene of the section before the gap, fold it into that section: change the heading's end number to the gap's last number and add or extend bullets. If something turns there (a relationship shifts, a secret comes out, a decision is made), keep the section as it is and write one new section for the gap after it instead.
2. Keep every existing bullet of the section before the gap word for word unless the gap changes what it says.
3. Follow the archive's rules: memory, not transcript — what happened, what caused it, what it changed; the action that caused a reaction comes before it; a character's interpretation only as theirs; at most 6 bullets per section; quotes only verbatim from the RAW LOG; no commentary; same language and format as the section before the gap.
4. Every sentence in a bullet you write carries the number of the message it comes from: (#88). A sentence you cannot point to a message for does not go in.
5. When two messages describe the same moment (a turn and the reply re-telling it, or a recap at the start of the next message), it happened once.

EXAMPLE
SECTION BEFORE THE GAP:
## #12–#18 — The bridge (Spring 3, Varo)
PLOT:
- Mara pulled Ren up from the broken plank; Ivo arrived afterward, while Ren was still hurt.
GAP: #19–#22
RAW LOG: Ivo bound Ren's leg and offered to carry him; Ren refused and limped on alone.

Answer:
## #12–#22 — The bridge (Spring 3, Varo)
PLOT:
- Mara pulled Ren up from the broken plank; Ivo arrived afterward, while Ren was still hurt.
- Ivo bound Ren's leg and offered to carry him; Ren refused and limped on alone (#19, #21).

OUTPUT
The section before the gap (changed or not), then the new section if you wrote one. Its numbers must run from the section's first number to the gap's last number with no gap. No fences, no comments.`;

// Returns { text, placed, replaced: [keys], renumbered }
// Pasted sections whose numbers the archive already covers (a model rewriting the format sample, say).
// 'skip' leaves them out; 'replace' swaps an exact match (same prefix and range) in place of the old one.
export function findRewrites(eBody, pBody) {
    const existing = parseSections(eBody).filter(x => !x.group).map(x => ({ s: x, r: x.title.match(RANGE_HEAD) })).filter(x => x.r);
    const covered = new Map(); // prefix → highest number in the archive
    for (const { r } of existing) {
        const pre = (r[1] || '').trim(), to = Math.max(parseInt(r[2], 10), parseInt(r[4], 10));
        covered.set(pre, Math.max(covered.get(pre) ?? -1, to));
    }
    // the archive's title or a divider counts as the same one even when its numbers moved on:
    // "# A × B — Context Archive (#0–#150)" pasted over an archive that says (#0–#104)
    const bare = t => t.trim().replace(/#?\d+/g, '#').replace(/\s+/g, ' ');
    const groupTitles = new Set(parseSections(eBody).filter(x => x.group || x.level === 1).map(x => bare(x.title)));
    const out = [];
    for (const sec of parseSections(pBody)) {
        if (sec.title === '(머리말)' || sec.title === '(제목 없음)') continue;
        const r = sec.title.match(RANGE_HEAD);
        if (!r) {
            // a "# ── Y2 ──" divider (or the archive title) that the archive already has
            if (sec.level === 1 && groupTitles.has(bare(sec.title))) out.push({ sec, kind: 'divider' });
            continue;
        }
        const pre = (r[1] || '').trim(), from = parseInt(r[2], 10), to = parseInt(r[4], 10);
        if (!covered.has(pre) || Math.min(from, to) > covered.get(pre)) continue;
        const same = existing.find(x => (x.r[1] || '').trim() === pre && parseInt(x.r[2], 10) === from && parseInt(x.r[4], 10) === to);
        out.push({ sec, kind: same ? 'exact' : 'overlap', old: same?.s });
    }
    return out;
}

// the pasted text minus sections the archive already has (what the number check should look at)
export function stripRewrites(archive, add) {
    const [eBody] = splitTail(archive);
    const [pBody, pTail] = splitTail(add);
    const p = trimEnd(pBody).replace(/\n-{3,}\s*$/, '');
    const drop = new Set(findRewrites(trimEnd(eBody).replace(/\n-{3,}\s*$/, ''), p).map(f => f.sec.start));
    if (!drop.size) return add;
    return `${trimEnd(parseSections(p).filter(x => !drop.has(x.start)).map(x => p.slice(x.start, x.end)).join(''))}${pTail ? `\n\n${pTail}` : ''}`;
}

export function placeAppend(archive, add, { renumber, rewrites = 'skip' } = {}) {
    const [eBody, eTail] = splitTail(archive);
    const [pBody, pTail] = splitTail(add);
    const sep = /\n-{3,}\s*$/.test(trimEnd(eBody));
    let body = trimEnd(eBody).replace(/\n-{3,}\s*$/, '');
    let pClean = trimEnd(pBody).replace(/\n-{3,}\s*$/, '');
    const found = findRewrites(body, pClean);
    const skipped = [], swapped = [];
    if (found.length) {
        const drop = new Set(found.map(f => f.sec.start));
        // replace exact matches in place (from the end so earlier offsets stay valid)
        if (rewrites === 'replace') {
            const exact = found.filter(f => f.kind === 'exact').sort((x, y) => y.old.start - x.old.start);
            for (const f of exact) {
                const oldTrail = body.slice(f.old.start, f.old.end).match(/\s*$/)[0] || '\n\n';
                body = body.slice(0, f.old.start) + trimEnd(pClean.slice(f.sec.start, f.sec.end)) + oldTrail + body.slice(f.old.end);
                swapped.push(f.sec.title);
            }
        }
        found.filter(f => !(rewrites === 'replace' && f.kind === 'exact') && f.kind !== 'divider').forEach(f => skipped.push(f.sec.title));
        pClean = trimEnd(parseSections(pClean).filter(x => !drop.has(x.start)).map(x => pClean.slice(x.start, x.end)).join(''));
        body = trimEnd(body);
    }
    if (pClean.trim()) body = `${trimEnd(body)}${body.trim() ? '\n\n' : ''}${pClean}`;

    const eBlocks = tailBlocks(eTail), pBlocks = tailBlocks(pTail);
    const replaced = [];
    const blocks = eBlocks.map(b => {
        const nb = pBlocks.find(x => x.key === b.key);
        if (nb) replaced.push(b.key);
        return nb || b;
    });
    pBlocks.filter(x => !eBlocks.some(b => b.key === x.key)).forEach(x => blocks.push(x));

    let renumbered = null;
    const oldEnd = lastRangeEnd(eBody), newEnd = lastRangeEnd(pBody);
    // only within one log: an AU's #40 says nothing about the main story's #604 in the title
    const samePrefix = (headingRanges(eBody).pop()?.prefix ?? '') === (headingRanges(pBody).pop()?.prefix ?? '');
    if (renumber && samePrefix && oldEnd !== null && newEnd !== null && newEnd > oldEnd) {
        const swap = line => line.replace(new RegExp(`#${oldEnd}(?!\\d)`, 'g'), `#${newEnd}`);
        // a top "# " title line and the intro lines under it, up to the next heading
        const lines = body.split('\n');
        if (/^# /.test(lines[0] || '')) {
            for (let i = 0; i < lines.length; i++) {
                if (i > 0 && /^#{1,3} /.test(lines[i])) break;
                lines[i] = swap(lines[i]);
            }
        }
        body = lines.join('\n');
        // STATE/OPEN headings + their first note line, unless just replaced
        blocks.forEach((b, i) => {
            if (replaced.includes(b.key) || pBlocks.includes(b)) return;
            const ls = b.text.split('\n');
            for (let k = 0; k < Math.min(ls.length, 4); k++) if (k === 0 || /^_.*_$/.test(ls[k].trim())) ls[k] = swap(ls[k]);
            blocks[i] = { ...b, text: ls.join('\n') };
        });
        renumbered = { from: oldEnd, to: newEnd };
    }

    let text = trimEnd(body);
    // a first STATE / OPEN (a new chat) keeps the --- the answer put before it
    const pSep = /\n-{3,}\s*$/.test(trimEnd(pBody));
    if (blocks.length) text += `${sep || eTail || pSep ? '\n\n---\n\n' : '\n\n'}${blocks.map(b => b.text).join('\n\n')}`;
    return { text: `${text}\n`, placed: !!eTail && !!pClean.trim(), replaced, renumbered, skipped, swapped, rewriteCount: found.filter(f => f.kind !== 'divider').length, exactCount: found.filter(f => f.kind === 'exact').length };
}

// Signs that a pasted (AI) answer stopped early. Display strings, empty if it looks complete.
export function cutSigns(archive, add) {
    const out = [];
    const [, eTail] = splitTail(archive);
    const [, pTail] = splitTail(add);
    const hasBlocks = k => new RegExp(`^# ${k}\\b`, 'm');
    const missing = ['STATE', 'OPEN'].filter(k => hasBlocks(k).test(eTail) && !hasBlocks(k).test(pTail));
    if (missing.length) out.push(`${missing.join('·')} 블록이 없어요. 이대로 추가하면 예전 ${missing.join('·')} 블록이 그대로 남아요.`);
    const lastLine = (add.trim().split('\n').filter(l => l.trim()).pop() || '').trim();
    const ends = /[.!?。…"'”’)\]_*~」』>]$|[다요음함임됨짐]$|^#{1,3} |^-{3,}$/;
    if (lastLine && !ends.test(lastLine)) out.push(`마지막 줄이 문장 중간에서 끝나요: "…${lastLine.slice(-40)}"`);
    return out;
}

// "# STATE AT AU #145" over sections that end at #143: the number the STATE / OPEN headings carry vs the sections' end
export function tailNumberGap(text) {
    const rs = headingRanges(splitTail(text)[0]);
    const end = rs.length ? Math.max(rs[rs.length - 1].from, rs[rs.length - 1].to) : null;
    const mt = splitTail(text)[1].match(/^# (?:STATE|OPEN) AT\s+(?:(\S{1,12})\s+)?#(\d+)/m);
    if (end === null || !mt) return null;
    const at = Number(mt[2]);
    return at === end ? null : { at, end, prefix: rs[rs.length - 1].prefix };
}
// STATE / OPEN headings and their "_True at #n_" lines moved to the sections' end
export function fixTailNumber(text, gap) {
    const [body, tail] = splitTail(text);
    const re = new RegExp(`((?:STATE|OPEN) AT\\s+(?:\\S{1,12}\\s+)?#|(?:True|Unresolved) at\\s+(?:\\S{1,12}\\s+)?#)${gap.at}(?!\\d)`, 'g');
    return body + tail.replace(re, `$1${gap.end}`);
}

// ---- STATE lines a rewrite dropped: compare the archive's STATE with the pasted one, put lines back

// STATE as headed parts: [{ head, lines }] (the notice line and blank lines left out)
function stateParts(text) {
    const blk = tailBlocks(splitTail(text)[1]).find(b => b.key === 'STATE');
    if (!blk) return null;
    const parts = [];
    let cur = { head: '', lines: [] };
    for (const l of blk.text.split('\n').slice(1)) {
        const h = l.match(/^##\s+(.+?)\s*$/);
        if (h) { parts.push(cur); cur = { head: h[1].trim(), lines: [] }; continue; }
        if (!l.trim() || /^_.*_$/.test(l.trim())) continue;
        cur.lines.push(l.trimEnd());
    }
    parts.push(cur);
    return parts.filter(p => p.head || p.lines.length);
}
const normLine = l => String(l).toLowerCase().replace(/^\s*(?:#+|[-*•])\s*/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const wordSet = l => new Set(normLine(l).split(' ').filter(w => w.length > 2));
// most of the shorter line's words in the other: an edit of the same line, not a lost one
const sameLine = (a, b) => { const A = wordSet(a), B = wordSet(b); if (!A.size || !B.size) return false; let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.min(A.size, B.size) >= 0.6; };

export function stateLoss(oldText, newText) {
    const o = stateParts(oldText), n = stateParts(newText);
    if (!o || !n) return null;
    const nh = new Set(n.map(p => normLine(p.head))), oh = new Set(o.map(p => normLine(p.head)));
    const gone = o.filter(p => p.head && !nh.has(normLine(p.head))).map(p => p.head);
    const added = n.filter(p => p.head && !oh.has(normLine(p.head))).map(p => p.head);
    // as many headings gone as new ones: read them as renamed, in order
    const renames = gone.length && gone.length === added.length ? gone.map((h, i) => ({ from: added[i], to: h })) : [];
    const fresh = n.flatMap(p => p.lines);
    const freshSet = new Set(fresh.map(normLine));
    const missing = [];
    for (const p of o) for (const line of p.lines) {
        if (freshSet.has(normLine(line)) || fresh.some(x => sameLine(line, x))) continue;
        missing.push({ head: p.head, line });
    }
    return renames.length || missing.length ? { renames, missing } : null;
}

// the pasted text with headings renamed back and the picked lines under their old headings again
export function restoreState(text, loss, pick) {
    const [body, tail] = splitTail(text);
    const blocks = tailBlocks(tail);
    const i = blocks.findIndex(b => b.key === 'STATE');
    if (i < 0) return text;
    let st = blocks[i].text;
    for (const r of loss.renames) st = st.replace(new RegExp(`^##\\s+${escRe(r.from)}\\s*$`, 'm'), `## ${r.to}`);
    const lines = st.split('\n');
    const endOf = h => { let e = h + 1; while (e < lines.length && !/^#{1,2}\s/.test(lines[e])) e++; while (e > h + 1 && !lines[e - 1].trim()) e--; return e; };
    loss.missing.forEach((x, k) => {
        if (!pick.has(k)) return;
        if (!x.head) {
            const h = lines.findIndex((l, j) => j > 0 && /^##\s/.test(l));
            let at = h < 0 ? lines.length : h;
            while (at > 1 && !lines[at - 1].trim()) at--;
            lines.splice(at, 0, x.line);
            return;
        }
        const h = lines.findIndex(l => /^##\s/.test(l) && normLine(l) === normLine(x.head));
        if (h < 0) { lines.push('', `## ${x.head}`, x.line); return; }
        lines.splice(endOf(h), 0, x.line);
    });
    blocks[i] = { ...blocks[i], text: lines.join('\n') };
    return `${body}${blocks.map(b => b.text).join('\n\n')}\n`;
}

// Problems with the numbering of pasted sections, as display strings.
// messages a summary may leave out without a gap: OOC 빼기 kinds, and empty ones
const skippable = (a, b) => {
    const chat = ctx().chat || [], off = offstageSet(chat);
    for (let i = a; i <= b; i++) if (chat[i] && !off.has(i) && String(chat[i].mes || '').trim()) return false;
    return true;
};
export function checkAppend(m, add, last) {
    const ranges = headingRanges(add);
    const issues = [];
    if (!ranges.length) return { ranges, issues: ['제목에서 "#시작–#끝" 번호를 못 찾았어요. 번호 검사는 건너뛰어요.'], soft: true };
    const label = r => `${r.prefix ? `${r.prefix} ` : ''}#`;
    // continues the archive: compare with the archive's last numbered section of the same prefix
    const mine = headingRanges(m.text);
    const lastA = mine[mine.length - 1];
    if (lastA) {
        const first = ranges.find(r => r.prefix === lastA.prefix);
        const want = lastA.to + 1;
        if (first && first.from > want && !skippable(want, first.from - 1)) issues.push(`첫 섹션이 ${label(first)}${first.from}부터예요. ${label(first)}${want}${first.from - 1 > want ? `–#${first.from - 1}` : ''} (${first.from - want}개)가 빠졌어요.`);
        else if (first && first.from < want) issues.push(`첫 섹션 ${label(first)}${first.from}가 아카이브에 이미 있는 ${label(lastA)}${lastA.to}까지와 겹쳐요.`);
    }
    // numbering restarts per prefix (Y1, Y2 …), so check continuity within each
    const lastBy = new Map();
    const gaps = []; // between two pasted sections, for the fix buttons
    for (const r of ranges) {
        if (r.from > r.to) issues.push(`"${r.title}" — 시작 #${r.from}이 끝 #${r.to}보다 커요.`);
        const prev = lastBy.get(r.prefix);
        if (prev) {
            if (r.from > prev.to + 1 && !skippable(prev.to + 1, r.from - 1)) {
                issues.push(`${label(r)}${prev.to}와 #${r.from} 사이 #${prev.to + 1}${r.from - 1 > prev.to + 1 ? `–#${r.from - 1}` : ''}가 빠졌어요.`);
                gaps.push({ prefix: r.prefix, from: prev.to + 1, to: r.from - 1, before: prev, after: r });
            }
            else if (r.from <= prev.to) issues.push(`"${r.title}"가 앞 섹션(${label(prev)}${prev.to}까지)과 겹쳐요.`);
        }
        lastBy.set(r.prefix, r);
    }
    const end = ranges[ranges.length - 1];
    if (end.to > last) issues.push(`끝 ${label(end)}${end.to}가 채팅 마지막 #${last}보다 커요.`);
    return { ranges, issues, gaps, soft: false };
}

// a paste that carries most of the archive's numbered sections is a whole new version, not new sections
export function looksWhole(archive, add) {
    const [eBody] = splitTail(archive);
    const eb = trimEnd(eBody).replace(/\n-{3,}\s*$/, '');
    const n = parseSections(eb).filter(x => !x.group && RANGE_HEAD.test(x.title)).length;
    if (n < 3) return false;
    const pb = trimEnd(splitTail(add)[0]).replace(/\n-{3,}\s*$/, '');
    return findRewrites(eb, pb).filter(f => f.kind !== 'divider').length >= Math.ceil(n * 0.8);
}

// shows what a whole-archive swap changes; true once confirmed
export async function confirmWhole(oldText, newText) {
    const c = ctx();
    const ch = sectionChanges(oldText, newText);
    const rows = lineDiff(oldText, newText);
    const add = rows.filter(r => r.t === '+').length, del = rows.filter(r => r.t === '-').length;
    const list = (label, xs) => xs.length ? `<div class="na_whole_sum"><b>${label} ${xs.length}개</b><ul>${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    const counts = [['새', ch.added], ['바뀜', ch.changed], ['제목', ch.renamed], ['없어짐', ch.removed]].filter(([, xs]) => xs.length).map(([k, xs]) => `${k} ${xs.length}`);
    const $v = $(`
      <div class="na_popup na_popup_fill">
        <div class="na_diff_head">
          <b>아카이브를 통째로 바꿔요</b>
          <span class="na_chip na_chip_add">+${fmt(add)}줄</span><span class="na_chip na_chip_del">−${fmt(del)}줄</span>
        </div>
        ${counts.length ? `<details class="na_whole_sums"><summary>섹션 변화 · ${counts.join(' · ')}</summary>
          ${list('새 섹션', ch.added)}${list('내용이 바뀐 섹션', ch.changed)}${list('제목이 바뀐 섹션', ch.renamed)}${list('없어지는 섹션', ch.removed)}
        </details>` : '<div class="na_empty">섹션은 그대로예요.</div>'}
        <small class="na_dim">지금 아카이브는 "통째로 바꾸기 전" 복구 지점으로 남아요.</small>
        <div class="na_diff">${add || del ? renderDiff(rows) : '<div class="na_empty">내용이 똑같아요.</div>'}</div>
      </div>`);
    if (add || del) $v.find('.na_diff_head').append(translateButton($v.find('.na_diff')));
    const r = await c.callGenericPopup($v, c.POPUP_TYPE.CONFIRM, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '통째로 바꾸기', cancelButton: '취소' });
    return r === c.POPUP_RESULT.AFFIRMATIVE || r === true;
}
