// STATE · OPEN as a list of changes instead of a rewrite. The model answers
//   # STATE CHANGES
//   ADD ## Set :: - a new line
//   EDIT ## Set :: - the old line ==> - the new line
//   DROP ## Horus :: - the old line
// and the extension applies it to the archive's own STATE / OPEN: a line nobody named stays as it is.
// The risky ones (a drop, an edit that cuts a line to under half, a new heading) start unticked.

import { headingRanges, splitTail, tailBlocks, trimEnd } from './sections.js';

const CHG_HEAD = /^# (STATE|OPEN) CHANGES\b.*$/m;
export const hasChanges = text => CHG_HEAD.test(String(text || ''));

const bare = l => String(l || '').replace(/^\s*[-*•]\s*/, '').trim();
const norm = l => bare(l).toLowerCase().replace(/[“”"'‘’`]/g, '').replace(/[.。!?…\s]+$/g, '').replace(/\s+/g, ' ');
const words = l => new Set(norm(l).split(/[^\p{L}\p{N}#]+/u).filter(w => w.length > 1));
const overlap = (a, b) => { const A = words(a), B = words(b); if (!A.size || !B.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.max(A.size, B.size); };
const headName = h => String(h || '').replace(/^#+\s*/, '').trim();

// "# STATE CHANGES …" / "# OPEN CHANGES …" blocks of an answer's tail → [{ kind, op, head, old, neu }]
export function parseChanges(tail) {
    const items = [];
    for (const b of tailBlocks(String(tail || ''))) {
        const hm = b.text.match(CHG_HEAD);
        if (!hm) continue;
        const kind = hm[1];
        for (const line of b.text.split('\n').slice(1)) {
            const mt = line.match(/^\s*[-*]?\s*(ADD|EDIT|DROP)\b\s*(?:(##[^:]*?)\s*::\s*|::\s*)?(.*)$/i);
            if (!mt || !mt[3].trim() || /^\(none\)$/i.test(mt[3].trim())) continue;
            const op = mt[1].toUpperCase(), head = headName(mt[2]);
            if (op === 'EDIT') {
                const parts = mt[3].split(/\s*(?:==>|=>|→)\s*/);
                if (parts.length < 2) continue;
                items.push({ kind, op, head, old: parts[0].trim(), neu: parts.slice(1).join(' → ').trim() });
            } else items.push({ kind, op, head, old: op === 'DROP' ? mt[3].trim() : '', neu: op === 'ADD' ? mt[3].trim() : '' });
        }
    }
    return items;
}

// one block's lines with the "## " heading each line sits under
function lineMap(text) {
    let head = '';
    return text.split('\n').map((l, i) => {
        if (/^##\s/.test(l)) head = headName(l);
        return { i, l, head, item: /^\s*[-*•]\s/.test(l) };
    });
}
// where an old line is: under its heading first, then anywhere in the block
function findLine(map, head, old) {
    const pool = [map.filter(x => x.item && (!head || x.head.toLowerCase() === head.toLowerCase())), map.filter(x => x.item)];
    const n = norm(old);
    for (const xs of pool) {
        const exact = xs.find(x => norm(x.l) === n);
        if (exact) return exact;
        const pre = n.length >= 20 && xs.find(x => norm(x.l).startsWith(n.replace(/…$/, '')) || n.startsWith(norm(x.l)));
        if (pre) return pre;
        let best = null, score = 0;
        for (const x of xs) { const s = overlap(x.l, old); if (s > score) { score = s; best = x; } }
        if (best && score >= 0.7) return best;
    }
    return null;
}

// what each change would do to this tail, and whether it starts ticked
export function planChanges(baseTail, items) {
    const blocks = tailBlocks(String(baseTail || ''));
    return items.map(c => {
        const b = blocks.find(x => x.key === c.kind);
        if (!b) return { ...c, found: null, on: false, why: `${c.kind} 블록이 없어요` };
        const map = lineMap(b.text);
        const hasHead = !c.head || map.some(x => /^##\s/.test(x.l) && x.head.toLowerCase() === c.head.toLowerCase());
        if (c.op === 'ADD') return { ...c, found: null, newHead: !hasHead, on: hasHead, why: hasHead ? '' : '새 제목' };
        const found = findLine(map, c.head, c.old);
        if (!found) return { ...c, found: null, on: false, why: '원래 줄을 못 찾았어요' };
        // a closed OPEN thread going is the normal case; a STATE line going is the one to look at
        if (c.op === 'DROP') return { ...c, found: found.l, on: c.kind === 'OPEN', why: c.kind === 'OPEN' ? '닫힌 스레드' : '줄 삭제' };
        const cut = bare(c.neu).length < bare(found.l).length * 0.5;
        return { ...c, found: found.l, on: !cut, why: cut ? '줄을 반 넘게 줄여요' : '' };
    });
}

const bullet = l => (/^\s*[-*•]\s/.test(l) ? l.trim() : `- ${bare(l)}`);
// the end number of every block heading and notice line: "# STATE AT Y2 #574" → "# STATE AT AU #151"
export function retagTail(tail, prefix, to) {
    const tag = `${prefix ? `${prefix} ` : ''}#${to}`;
    return tail.replace(/^(# (?:STATE|OPEN) AT\s+)(?:\S{1,12}\s)?#\d+/gm, `$1${tag}`)
        .replace(/^(_(?:True|Unresolved) at\s+)(?:\S{1,12}\s)?#\d+/gm, `$1${tag}`);
}

// the archive's STATE · OPEN with the ticked changes applied, renumbered to the new sections' end
export function applyChanges(baseTail, plan, { prefix = '', to = null } = {}) {
    const blocks = tailBlocks(String(baseTail || '')).filter(b => b.key === 'STATE' || b.key === 'OPEN');
    const out = blocks.map(b => {
        const lines = b.text.split('\n');
        const mine = plan.filter(c => c.on && c.kind === b.key);
        // edits and drops by line text (indexes move as lines go in)
        for (const c of mine.filter(x => x.op !== 'ADD' && x.found)) {
            const i = lines.indexOf(c.found);
            if (i < 0) continue;
            if (c.op === 'DROP') lines.splice(i, 1);
            else lines[i] = bullet(c.neu);
        }
        // an edit whose line was not found, ticked by hand: goes in as a new line under its heading
        const adds = mine.filter(x => x.op === 'ADD' || (x.op === 'EDIT' && !x.found)).map(x => ({ head: x.head, line: bullet(x.neu) }));
        for (const a of adds) {
            const map = lineMap(lines.join('\n'));
            const h = a.head ? map.find(x => /^##\s/.test(x.l) && x.head.toLowerCase() === a.head.toLowerCase()) : null;
            if (!h && a.head) {
                // a new heading: at the end, before a closing notice line
                let e = lines.length; while (e > 1 && (!lines[e - 1].trim() || /^_.*_$/.test(lines[e - 1].trim()))) e--;
                lines.splice(e, 0, '', `## ${a.head}`, a.line);
                continue;
            }
            let e = h ? h.i + 1 : 1;
            while (e < lines.length && !/^##\s/.test(lines[e])) e++;
            while (e > (h ? h.i + 1 : 1) && (!lines[e - 1].trim() || /^_.*_$/.test(lines[e - 1].trim()))) e--;
            lines.splice(e, 0, a.line);
        }
        return trimEnd(lines.join('\n'));
    }).join('\n\n');
    if (to === null) return out;
    // the notice lines, when the archive's blocks have none yet
    const tag = `${prefix ? `${prefix} ` : ''}#${to}`;
    const notice = { STATE: `_True at ${tag}; where the live chat differs, the live chat is correct. A character's reading marked as such is not canon._`, OPEN: `_Unresolved at ${tag}; check recent messages before treating any as pending._` };
    return retagTail(out, prefix, to).replace(/^# (STATE|OPEN) AT[^\n]*$/gm, (head, k, at, all) => {
        const next = all.slice(at + head.length).split(/\n(?=# )/)[0];
        return /^_(?:True|Unresolved) at\b/m.test(next) ? head : `${head}\n${notice[k]}`;
    });
}

// an answer with change lists → the same answer with full STATE · OPEN, plus what was decided
// (blocks the answer wrote out in full stay as written; blocks it left out stay as the archive has them)
export function resolveChanges(archive, answer, pick = null) {
    const [body, tail] = splitTail(String(answer || ''));
    const items = parseChanges(tail);
    const baseTail = splitTail(String(archive || ''))[1];
    const plan = planChanges(baseTail, items);
    if (pick) plan.forEach((c, k) => { if (k in pick) c.on = !!pick[k]; });
    const rs = headingRanges(body);
    const last = rs[rs.length - 1];
    let full = applyChanges(baseTail, plan, last ? { prefix: last.prefix, to: last.to } : {});
    // a block the answer gave in full wins over the archive's
    const given = tailBlocks(tail).filter(b => (b.key === 'STATE' || b.key === 'OPEN') && !CHG_HEAD.test(b.text));
    if (given.length) {
        const fb = tailBlocks(full).map(b => given.find(g => g.key === b.key)?.text || b.text);
        full = fb.join('\n\n');
    }
    const b = trimEnd(body).replace(/\n-{3,}\s*$/, '').trim();
    return { text: `${b}\n\n---\n${full}\n`, plan, body: b };
}
