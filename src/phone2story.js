// 폰 2가 읽는 이야기 (docs/PHONE2-PLAN.md 단계 5-1): 이야기에서 시작한 폰 2는 시작한 순간까지만 알아요.
// 글은 복사하지 않고, 시작할 때 두 가지만 적어 둬요(startFromStory의 story):
//   ranges: 그때 아카이브에 있던 장면들의 메시지 범위, 번호 앞말(prefix)마다 합친 구간 { '': [[0, 130]], Y1: [[0, 300]] }
//   titles: 범위 없는 장면(머리말 등)의 제목
//   rawFrom: 그때 아직 압축 안 된 첫 메시지 번호(경계선 + 1), storyUpto(시작한 메시지 번호)까지는 원래 메시지로 읽어요
//   own: 이 채팅의 메시지 번호를 쓰는 앞말(맨 뒤 장면의 앞말, 켜 둔 AU 이름). 분기할 때 이것만 잘라요
// 나중에 읽을 때(liveStoryText): 지금 아카이브의 장면 중, 범위가 시작 때 구간 안에 다 들어가는 것만(이름이 바뀌거나
// 다시 압축돼 합쳐지거나 나뉘어도 안에 있으면 그대로), 범위 없는 장면은 시작 때 있던 제목만. 끝의 지금 상태(STATE ·
// OPEN) 칸은 안 읽어요. 시작 뒤에 새로 압축된 장면은 안 읽고, 그 메시지들은 rawFrom ~ storyUpto 원래 메시지로 읽어요.
// 폰 1은 이 파일을 부르지 않아요. 아카이브 글은 읽기만 해요.

import { headingRanges, parseSections, RANGE_HEAD, splitTail } from './sections.js';
import { liveWorld, startFromStory } from './phone2store.js';
import { startShift } from './phone2clock.js';

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

// the heading prefixes that number this chat's own messages: the newest section's (a new section takes it, as the
// archive's own writing does), and the AU's name while it is on; an older prefix is an earlier chat's
function ownPrefixes(m, body) {
    const last = headingRanges(body).pop();
    return [...new Set([last ? last.prefix : '', ...(m?.au?.on && m.au.name ? [String(m.au.name).trim()] : [])])];
}
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
    return { ranges, titles, rawFrom: Math.min(bnd + 1, upto + 1), own: ownPrefixes(m, body) };
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

// does this chat still hold what 폰 2 began from? false when the chat ends before the message it began at (a branch
// taken from an earlier message): its numbers are not this chat's. Only says so; what to do is the user's choice
// (그대로 두기 · 대화만 남기기 · 통째로 지우기, phone2store resetLive). lastIndex: the chat's last message number
export const liveFitsChat = (w, lastIndex) => !w || w.from !== 'story' || !Number.isInteger(w.storyUpto) || (Number.isInteger(lastIndex) && w.storyUpto <= lastIndex);

// 이야기에서 시작: 폰 2 begun at message `upto` (the newest one), with its mark of the story then; the one way to begin
// from the story (startFromStory alone refuses without a mark)
export const beginFromStory = (m, { persona, upto, scope = '', dayShift = 0, now = Date.now() } = {}) =>
    startFromStory(m, { persona, upto, scope, dayShift, now, story: storyMark(m, upto) });

// 분기한 방의 폰 2 (5-3): a branch taken before the message 폰 2 began at (point: the branch point, from settleBranch on
// 폰 2's phones) holds none of what 폰 2 knew past it, nor anything said on its messenger (all of it came after it began).
// 폰 2 then begins at the branch point instead: its mark keeps only the stretches up to there (a section reaching past it
// is not read; its messages are read as they are), no messenger talk, no job waiting. A branch after the start: nothing
// changes (the branch has all 폰 2 knew). The main chat's 폰 2 is its own copy and stays as it is.
// Only this chat's numbering is cut (st.own, else the newest section's prefix): an earlier chat's sections stay whole
// Returns null (nothing to do) or { point, rooms } (how many messenger rooms went)
// dayShift: 폰 2's days from the real ones again, from the story's time at the branch point (storyAt "MM-DD HH:MM",
// storyYear, tz: where the owner is), as a start from the story counts them (phone2clock startShift); none: as it was
// "MM-DD HH:MM" that is a real day and time (not "13-40 25:00")
const realAt = v => { const t = /^(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(String(v || '')); return !!t && +t[1] >= 1 && +t[1] <= 12 && +t[2] >= 1 && +t[2] <= 31 && +t[3] < 24 && +t[4] < 60; };
export function settleLiveBranch(m, point, { dayShift = null, storyAt = '', storyYear = null, tz = '' } = {}) {
    const w = liveWorld(m);
    if (!w || w.from !== 'story' || !Number.isInteger(point) || point < 0 || !Number.isInteger(w.storyUpto) || w.storyUpto <= point) return null;
    const st = w.story && typeof w.story === 'object' ? w.story : { ranges: {}, titles: [], rawFrom: 0 };
    const [body] = splitTail(String(m?.text || ''));
    // (this chat's prefixes as they were when 폰 2 began; one another chat's archive brought in (logLinks) is never this chat's)
    const links = new Set(Object.keys(m?.logLinks || {})), own = new Set((Array.isArray(st.own) ? st.own : ownPrefixes(m, body)).filter(k => !links.has(k)));
    const other = { has: k => !own.has(k) };
    const ranges = Object.fromEntries(Object.entries(st.ranges || {}).map(([k, spans]) => [k, other.has(k) ? spans
        : (spans || []).filter(([a]) => a <= point).map(([a, b]) => [a, Math.min(b, point)])]).filter(([, v]) => v.length));
    // (this chat's sections that reach past the branch point: their messages up to it are read as they are)
    const straddle = headingRanges(body).filter(r => !other.has(r.prefix)).map(r => [Math.min(r.from, r.to), Math.max(r.from, r.to)]).filter(([a, b]) => a <= point && b > point).map(([a]) => a);
    const rawFrom = Math.min(Number.isInteger(st.rawFrom) ? st.rawFrom : 0, point + 1, ...straddle);
    w.story = { ...st, ranges, rawFrom };
    w.storyUpto = point;
    const rooms = Object.keys(w.messenger?.rooms || {}).length;
    const me = String(w.persona || '').trim(), key = me.toLowerCase();
    w.messenger = { accounts: me ? { [key]: w.messenger?.accounts?.[key] || { name: me } } : {}, rooms: {} };
    w.queue = { round: (Number(w.queue?.round) || 0) + 1, jobs: [] };
    if (Number.isInteger(dayShift)) w.dayShift = dayShift;
    else if (realAt(storyAt) && Number.isInteger(Number(storyYear)) && tz) { try { w.dayShift = startShift({ storyAt, storyYear: Number(storyYear), tz }); } catch { /* an unreadable time: as it was */ } }
    return { point, rooms };
}
