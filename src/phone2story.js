// 폰 2가 읽는 이야기 (docs/PHONE2-PLAN.md 단계 5-1): 이야기에서 시작한 폰 2는 시작한 순간까지만 알아요.
// 글은 복사하지 않고, 시작할 때 두 가지만 적어 둬요(startFromStory의 story):
//   ranges: 그때 아카이브에 있던 장면들의 메시지 범위, 번호 앞말(prefix)마다 합친 구간 { '': [[0, 130]], Y1: [[0, 300]] }
//   titles: 범위 없는 장면(머리말 등)의 제목
//   rawFrom: 그때 아직 압축 안 된 첫 메시지 번호(경계선 + 1), storyUpto(시작한 메시지 번호)까지는 원래 메시지로 읽어요
//   own: 이 채팅의 메시지 번호를 쓰는 앞말(맨 뒤 장면의 앞말, 켜 둔 AU 이름)
// 나중에 읽을 때(liveStoryText): 지금 아카이브의 장면 중, 범위가 시작 때 구간 안에 다 들어가는 것만(이름이 바뀌거나
// 다시 압축돼 합쳐지거나 나뉘어도 안에 있으면 그대로), 범위 없는 장면은 시작 때 있던 제목만. 끝의 지금 상태(STATE ·
// OPEN) 칸은 안 읽어요. 시작 뒤에 새로 압축된 장면은 안 읽고, 그 메시지들은 rawFrom ~ storyUpto 원래 메시지로 읽어요.
// 폰 1은 이 파일을 부르지 않아요. 아카이브 글은 읽기만 해요.

import { headingRanges, parseSections, RANGE_HEAD, splitTail } from './sections.js';
import { liveWorld, startFromStory, numberLive } from './phone2store.js';

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
// chat · fp: which chat this is and the words of message `upto` (phonedata.js chatStamp), kept so a branch is told apart
export function beginFromStory(m, { persona, upto, scope = '', dayShift = 0, now = Date.now(), chat = null, fp = null } = {}) {
    const w = startFromStory(m, { persona, upto, scope, dayShift, now, story: storyMark(m, upto) });
    if (chat) w.chat = String(chat);
    if (fp) w.storyFp = String(fp);
    return w;
}

// 분기한 방의 폰 2 (7-4에서 바꿈): 폰 2 came here with a branch of the chat it began in?
//   'none'   this is its own chat (or it began fresh, or nothing tells)
//   'after'  a branch taken after the message it began at: this chat has all it knew. Nothing changes (adoptChat)
//   'before' a branch taken before it: this chat doesn't have what it began from. 폰 1 is rewound first (settleBranch on
//            폰 1's phones), then 폰 2 begins again from that 폰 1 (rebeginFromStory); the main chat keeps its own 폰 2
// now: { chat, branch, fp } of this chat (phonedata.js chatStamp(w.storyUpto)): its mark, is it a branch, the words of
// message storyUpto here (null: no such message). point: where 폰 1's phones found the branch (settleBranch), for a 폰 2
// begun before marks were kept
export function liveBranched(w, { chat = null, branch = false, fp = null, point = null } = {}) {
    if (!w || w.from !== 'story' || !Number.isInteger(w.storyUpto)) return 'none';
    if (!w.chat) return Number.isInteger(point) && point < w.storyUpto ? 'before' : 'none';
    if (!chat || !branch || w.chat === String(chat)) return 'none';
    return w.storyFp && fp && w.storyFp === String(fp) ? 'after' : 'before';
}
// 'after': 폰 2 is this chat's from now on (asked once)
export function adoptChat(w, chat) { if (w && chat) w.chat = String(chat); return w; }
// 'before': 폰 2 begins again here, from 폰 1 as it is now (already rewound). The 폰 2 that came with the branch goes (not
// to the archive: it is the main chat's, which keeps its own); its persona stays (the owners' languages are on 폰 1's phones, copied with them). opts: as beginFromStory
// (persona left out: the one it had). 폰 1 with no phone: there is nothing to begin from, 폰 2 is taken off (returns null)
export function rebeginFromStory(m, opts = {}) {
    const old = liveWorld(m);
    if (!old) throw new Error('아직 폰 2가 없어요');
    const live = m.live, keep = { world: live.world, mode: live.mode };
    if (!Object.values(m.phones || {}).some(p => p?.owner)) { live.world = null; live.mode = 'story'; return null; }
    live.world = null;
    try {
        const w = beginFromStory(m, { ...opts, persona: opts.persona || old.persona });
        live.mode = keep.mode;
        return w;
    } catch (err) { live.world = keep.world; live.mode = keep.mode; throw err; }
}

// 실시간 폰 새로 시작 › 대화만 남기기: 폰 2's phones begin again from 폰 1 as it is now (as beginFromStory copies them),
// and the messenger stays: its rooms, messages, accounts and the persona. The kept talk is talk the new phones have
// already read (it is not reflected into them again); what is said after is. opts: as beginFromStory (persona left out:
// the one it had). 폰 1 with no phone: there is nothing to begin from, 폰 2 is left as it is (returns null)
export function rebeginKeepingChats(m, opts = {}) {
    const old = liveWorld(m);
    if (!old) throw new Error('아직 폰 2가 없어요');
    if (!Object.values(m.phones || {}).some(p => p?.owner)) return null;
    const live = m.live, keep = { world: live.world, mode: live.mode, archive: live.archive };
    live.world = null;
    try {
        const w = beginFromStory(m, { ...opts, persona: opts.persona || old.persona });
        w.messenger = old.messenger;
        w.queue = { round: (Number(old.queue?.round) || 0) + 1, jobs: [] };
        const rooms = Object.values(w.messenger?.rooms || {}), all = rooms.flatMap(r => r.messages || []);
        // (a number at or before where the story now ends would be taken for the story's own message: the kept messages
        // are numbered again after it, in the order they were said, and a summary that names the old numbers goes)
        if (all.some(x => !Number.isInteger(x.n) || x.n <= w.storyUpto)) {
            // (by the numbers they had, so the bubbles of one reply, said at the same moment, keep their order)
            const order = all.map((x, i) => ({ x, i })).sort((a, b) => (Number.isInteger(a.x.n) ? a.x.n : Infinity) - (Number.isInteger(b.x.n) ? b.x.n : Infinity) || (a.x.at || 0) - (b.x.at || 0) || a.i - b.i);
            order.forEach(({ x }, k) => { x.n = w.storyUpto + 1 + k; });
            for (const r of rooms) delete r.digest;
            w.messenger.seq = w.storyUpto + order.length;
        }
        const top = numberLive(w), first = Math.min(top + 1, ...all.map(x => x.n));
        // (the kept talk is read: a phone that has a reading takes it as a stretch done; one that never read anything
        // begins its reading after it)
        if (all.length) for (const p of Object.values(w.phones || {})) {
            if (!p || typeof p !== 'object') continue;
            if (p.sync?.marks?.base) (p.sync.done ||= []).push([first, top]);
            else p.sync = { ...(p.sync || {}), marks: { ...(p.sync?.marks || {}), base: { index: top, user: -1, fp: '', tail: '' } } };
        }
        live.mode = keep.mode; live.archive = keep.archive || [];
        return w;
    } catch (err) { live.world = keep.world; live.mode = keep.mode; live.archive = keep.archive; throw err; }
}
