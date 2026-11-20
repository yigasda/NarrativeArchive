// 실시간 폰이 아는 이야기 (docs/PHONE2-PLAN.md "요약본으로 시작"): 이야기에서 시작한 폰은 그때의 이야기를 요약본 한 장으로
// 가지고 있어요 (phone2snap.js가 만들어요). 롤플 채팅도 아카이브도 번호로 다시 읽지 않아요.
// 이 파일은 그런 폰을 시작하고, 다시 시작하고, 분기한 방에 온 폰을 가려내요. 폰 1은 이 파일을 부르지 않아요.

import { liveWorld, startFromStory, numberLive, isSnap } from './phone2store.js';

// the story 폰 2 knows: its snapshot's text ('' for one begun fresh, or one that has no snapshot yet)
export const liveStoryText = (m, w) => (w?.from === 'story' && isSnap(w.snap) ? w.snap.text : '');

// 이야기에서 시작: 폰 2 begun at message `upto` (the newest one)
// chat · fp: which chat this is and the words of message `upto` (phonedata.js chatStamp), kept so a branch is told apart
// snap: the story as it stands now, taken by phone2snap.js liveSnapDraft for this same message (`upto`). With it 폰 2
// never reads the chat or the archive again: its story is that text
export function beginFromStory(m, { persona, upto, scope = '', dayShift = 0, now = Date.now(), chat = null, fp = null, snap = null } = {}) {
    if (snap != null && (!isSnap(snap) || snap.upto !== upto)) throw new Error('이야기 요약본이 이 시작 자리의 것이 아니에요. 다시 만들어 주세요');
    const w = startFromStory(m, { persona, upto, scope, dayShift, now });
    if (chat) w.chat = String(chat);
    if (fp) w.storyFp = String(fp);
    if (snap) w.snap = structuredClone(snap);
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
