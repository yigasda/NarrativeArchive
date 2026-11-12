// 폰 2가 읽는 이야기 (docs/PHONE2-PLAN.md 단계 5-1): 이야기에서 시작한 폰 2는 시작한 순간까지만 알아요.
// 글은 복사하지 않고, 시작할 때 두 가지만 적어 둬요(startFromStory의 story):
//   ranges: 그때 아카이브에 있던 장면들의 메시지 범위, 번호 앞말(prefix)마다 합친 구간 { '': [[0, 130]], Y1: [[0, 300]] }
//   titles: 범위 없는 장면(머리말 등)의 제목
//   rawFrom: 그때 아직 압축 안 된 첫 메시지 번호(경계선 + 1), storyUpto(시작한 메시지 번호)까지는 원래 메시지로 읽어요
// 나중에 읽을 때(liveStoryText): 지금 아카이브의 장면 중, 범위가 시작 때 구간 안에 다 들어가는 것만(이름이 바뀌거나
// 다시 압축돼 합쳐지거나 나뉘어도 안에 있으면 그대로), 범위 없는 장면은 시작 때 있던 제목만. 끝의 지금 상태(STATE ·
// OPEN) 칸은 안 읽어요. 시작 뒤에 새로 압축된 장면은 안 읽고, 그 메시지들은 rawFrom ~ storyUpto 원래 메시지로 읽어요.
// 폰 1은 이 파일을 부르지 않아요. 아카이브 글은 읽기만 해요.

import { headingRanges, parseSections, RANGE_HEAD, splitTail } from './sections.js';
import { startFromStory } from './phone2store.js';

// [[a, b], …] sorted, touching or overlapping ones joined ([0, 50] + [51, 100] → [0, 100])
function joinSpans(spans) {
    const out = [];
    for (const [a, b] of [...spans].sort((x, y) => x[0] - y[0] || x[1] - y[1])) {
        const last = out[out.length - 1];
        if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
        else out.push([a, b]);
    }
    return out;
}
const rangeOf = title => { const r = String(title || '').match(RANGE_HEAD); if (!r) return null; const a = Number(r[2]), b = Number(r[4]); return { prefix: (r[1] || '').trim(), from: Math.min(a, b), to: Math.max(a, b) }; };
const inside = (spans, from, to) => (spans || []).some(([a, b]) => a <= from && to <= b);

// what the story was when 폰 2 began at message `upto`: { ranges, titles, rawFrom } (small: no story text)
export function storyMark(m, upto) {
    if (!Number.isInteger(upto) || upto < 0) throw new Error('이야기의 어느 메시지까지인지 필요해요');
    const [body] = splitTail(String(m?.text || ''));
    const by = {};
    for (const r of headingRanges(body)) {
        const from = Math.min(r.from, r.to), to = Math.max(r.from, r.to);
        (by[r.prefix] ||= []).push([from, to]);
    }
    const ranges = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, joinSpans(v)]));
    const titles = parseSections(body).filter(s => !s.group && !RANGE_HEAD.test(s.title)).map(s => s.title);
    const bnd = Number.isInteger(m?.boundary) && m.boundary >= 0 ? m.boundary : -1;
    // (a boundary past the start: nothing raw; the archive had it all)
    return { ranges, titles, rawFrom: Math.min(bnd + 1, upto + 1) };
}

// the story 폰 2 may read now: the sections it knew when it began, as the archive has them now; '' for a 폰 2 begun
// fresh, or one with no mark. (the same text read again: the cut kept)
const cut = new WeakMap();
export function liveStoryText(m, w) {
    const st = w?.story;
    if (!w || w.from !== 'story' || !st || typeof st !== 'object') return '';
    const text = String(m?.text || ''), had = cut.get(w);
    if (had && had.text === text && had.st === st) return had.out;
    const [body] = splitTail(text), titles = new Set(Array.isArray(st.titles) ? st.titles : []);
    const keep = parseSections(body).filter(s => {
        if (s.group) return false;
        const r = rangeOf(s.title);
        if (r) return inside(st.ranges?.[r.prefix], r.from, r.to);
        return titles.has(s.title);
    });
    const out = keep.map(s => body.slice(s.start, s.end).replace(/\s+$/, '')).join('\n\n');
    cut.set(w, { text, st, out: out ? `${out}\n` : '' });
    return cut.get(w).out;
}

// the chat messages 폰 2 reads as they are (not yet archived when it began): { from, to }, or null (none / begun fresh)
export function liveRawRange(w) {
    if (!w || w.from !== 'story' || !Number.isInteger(w.storyUpto)) return null;
    const from = Number.isInteger(w.story?.rawFrom) ? w.story.rawFrom : 0, to = w.storyUpto;
    return from <= to ? { from, to } : null;
}

// 이야기에서 시작: 폰 2 begun at message `upto` (the newest one), with its mark of the story then; the one way to begin
// from the story (startFromStory alone refuses without a mark)
export const beginFromStory = (m, { persona, upto, scope = '', dayShift = 0, now = Date.now() } = {}) =>
    startFromStory(m, { persona, upto, scope, dayShift, now, story: storyMark(m, upto) });
