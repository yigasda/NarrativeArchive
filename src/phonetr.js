// The phone's Korean (3.182.4~): the reflection writes the story's own words only; what is in another language gets its
// Korean here, from the translator, after the reflection or when 한국어 is pressed. A field of several lines goes out line by
// line (the translator keeps one line for one line) and comes back joined the same way

import { koGaps, refreshUndoAfter } from './phonedata.js';
import { translateLines } from './translate.js';

// how many fields one go fills at most (the rest wait for the next)
export const KO_MAX = 400;

// fills what has no Korean; the number filled. Throws when the translator fails (nothing is half written then)
export async function fillKo(p, { max = KO_MAX } = {}) {
    const gaps = koGaps(p).slice(0, max);
    if (!gaps.length) return 0;
    const lines = gaps.map(g => String(g.x[g.f]).split('\n'));
    const want = [...new Set(lines.flat().map(l => l.trim()).filter(l => /\p{L}{2,}/u.test(l)))];
    const got = new Map((await translateLines(want)).map((t, i) => [want[i], t]));
    let n = 0;
    gaps.forEach((g, i) => {
        const parts = lines[i].map(l => (l.trim() && /\p{L}{2,}/u.test(l.trim()) ? got.get(l.trim()) : l));
        if (parts.some(t => t === null || t === undefined)) return;
        g.x[g.k] = parts.join('\n');
        n++;
    });
    if (n) refreshUndoAfter(p);
    return n;
}
