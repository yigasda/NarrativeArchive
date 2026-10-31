// 새로 일어난 일 반영: where reading starts (one mark per app group), what has been read, and which archive sections
// this round may use. No model calls here.
// A mark is a message number plus a fingerprint of the user message at or before it. A swipe changes only the
// character's last reply, so the mark holds; a message deleted before it moves the mark with it; a mark that can't
// be found again (or matches twice) is asked for once more.
export const SYNC_GROUPS = ['base', 'money', 'invest'];
// one job at a time: a reflection, or making the bank or the investment (checked in the jobs themselves, not only the buttons)
export const busy = { sync: false, fill: 0 };
export async function exclusive(kind, job) {
    if (busy.sync || (kind === 'sync' && busy.fill)) throw new Error(busy.sync ? '새로 일어난 일을 반영하는 중이에요' : '은행·투자를 만드는 중이에요. 끝난 뒤 다시 해 주세요');
    if (kind === 'sync') busy.sync = true; else busy.fill++;
    try { return await job(); } finally { if (kind === 'sync') busy.sync = false; else busy.fill--; }
}
export const LIMIT = 12;
const fp = s => { let h = 5381; const t = String(s ?? ''); for (let i = 0; i < t.length; i++) h = (h * 33 + t.charCodeAt(i)) >>> 0; return `${h.toString(36)}.${t.length}`; };
const isUser = x => !!x && x.is_user && !x.is_system;

export function newSync(scope) { return { v: 1, scope, order: 'oldest', limit: LIMIT, marks: {}, done: [], failed: {}, arch: {}, events: {} }; }
export const syncOf = (p, scope) => (p.sync ||= newSync(scope));

// a mark after message `index` (-1: from the first message)
export function makeMark(chat, index) {
    let user = -1;
    for (let j = Math.min(index, chat.length - 1); j >= 0; j--) if (isUser(chat[j])) { user = j; break; }
    return { index, user, fp: user >= 0 ? fp(chat[user].mes) : '' };
}
// 'ok', 'moved' (by `delta`), or 'lost'
export function findMark(chat, mk) {
    if (!mk) return { state: 'lost' };
    if (mk.user < 0) return { state: 'ok', delta: 0 };
    if (isUser(chat[mk.user]) && fp(chat[mk.user].mes) === mk.fp) return { state: 'ok', delta: 0 };
    const hits = [];
    for (let j = 0; j < chat.length; j++) if (isUser(chat[j]) && fp(chat[j].mes) === mk.fp) hits.push(j);
    return hits.length === 1 ? { state: 'moved', delta: hits[0] - mk.user } : { state: 'lost' };
}
const shiftRanges = (rs, from, d) => rs.map(([a, b]) => (b < from ? [a, b] : [a < from ? a : a + d, b + d]));
// marks that moved are moved, with what was read after them; returns the groups that need a new mark
export function settleMarks(s, chat, groups = SYNC_GROUPS) {
    const lost = [];
    for (const g of groups) {
        const mk = s.marks[g];
        if (!mk) { lost.push(g); continue; }
        const r = findMark(chat, mk);
        if (r.state === 'lost') { lost.push(g); continue; }
        if (r.state === 'moved' && r.delta) {
            const from = mk.user;
            mk.index += r.delta; mk.user += r.delta;
            if (g === 'base') {
                s.done = shiftRanges(s.done, from, r.delta);
                s.failed = Object.fromEntries(Object.entries(s.failed).map(([k, v]) => [Number(k) >= from ? Number(k) + r.delta : k, v]));
            }
        }
    }
    return lost;
}

// what was read is kept by each message's fingerprint (who and what, not its number), so a message edited or swiped after
// it was read is unread again, and deleting one doesn't shift what counts as read onto the next
export const bodyMark = text => fp(String(text).replace(/^\[#\d+[^\]]*\]\s*/, ''));
export const noteRead = (s, rows) => { s.seen ||= {}; for (const r of rows) s.seen[r.index] = bodyMark(r.text); };
// the old reading laid over the chat as it is now. Read messages still there in the same order are anchors (a longest
// common run of fingerprints); between two anchors, what vanished and what appeared is one gap:
// - only new messages: unread, as they are
// - as many changed as vanished, with an anchor after them (or the last message alone, a swipe): edits, read again
//   tied to what they gave before
// - a read message now hidden (or hidden and changed): still read; hiding is not deleting
// - anything else (vanished, or a stretch rewritten): the new messages are new; what the old ones put on the phone stays,
//   offered to take off ("unsure" when the same words are still elsewhere and it can't be told which one went)
const lcs = (a, b) => {
    let lo = 0;
    while (lo < a.length && lo < b.length && a[lo] === b[lo]) lo++;
    let ea = a.length, eb = b.length;
    while (ea > lo && eb > lo && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
    const pairs = [];
    for (let i = 0; i < lo; i++) pairs.push([i, i]);
    const A = a.slice(lo, ea), B = b.slice(lo, eb), n = A.length, m = B.length;
    if (n && m) {
        const t = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
        for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = A[i] === B[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
        for (let i = 0, j = 0; i < n && j < m;) { if (A[i] === B[j]) { pairs.push([lo + i, lo + j]); i++; j++; } else if (t[i + 1][j] >= t[i][j + 1]) i++; else j++; }
    }
    for (let k = 0; k < a.length - ea; k++) pairs.push([ea + k, eb + k]);
    return pairs;
};
// all: every message with { index, text, hidden }. Returns moved (old → new number), changed ({ old, at, fp }) and
// dropped ({ old, fp, unsure })
export function realign(s, all) {
    const base = s.marks.base?.index ?? -1, cur = all.filter(r => r.index > base).map(r => ({ ...r, fp: bodyMark(r.text) }));
    if (!s.seen) { s.seen = {}; for (const r of cur) if (!r.hidden && isDone(s, r.index)) s.seen[r.index] = r.fp; }
    const old = [...Object.entries(s.seen).map(([i, f]) => ({ old: Number(i), fp: f })), ...Object.entries(s.hiddenRead || {}).map(([i, f]) => ({ old: Number(i), fp: f }))].sort((a, b) => a.old - b.old);
    // a short line ("뭐 샀어?") said again somewhere is no anchor unless its neighbours match too
    const short = r => r.text.replace(/^\[#\d+[^\]]*\]\s*[^:]*:\s*/, '').length < 15;
    const all_ = lcs(old.map(x => x.fp), cur.map(x => x.fp)), at = new Set(all_.map(([i, j]) => `${i},${j}`));
    const pairs = all_.filter(([i, j]) => !short(cur[j]) || at.has(`${i - 1},${j - 1}`) || at.has(`${i + 1},${j + 1}`));
    const moved = {}, seen = {}, hiddenRead = {}, changed = [], dropped = [];
    for (const [i, j] of pairs) { moved[old[i].old] = cur[j].index; (cur[j].hidden ? hiddenRead : seen)[cur[j].index] = old[i].fp; }
    const anchors = [[-1, -1], ...pairs, [old.length, cur.length]], gaps = [];
    for (let k = 0; k + 1 < anchors.length; k++) { const [i0, j0] = anchors[k], [i1, j1] = anchors[k + 1]; gaps.push({ O: old.slice(i0 + 1, i1), N: cur.slice(j0 + 1, j1), last: k + 2 === anchors.length }); }
    // a message moved up or down: gone from one gap, the same words in another
    const pool = new Map();
    for (const g of gaps) for (const r of g.N) if (!short(r)) (pool.get(r.fp) || pool.set(r.fp, []).get(r.fp)).push(r);
    for (const g of gaps) g.O = g.O.filter(x => { const r = pool.get(x.fp)?.shift(); if (!r) return true; moved[x.old] = r.index; (r.hidden ? hiddenRead : seen)[r.index] = x.fp; r.taken = true; return false; });
    for (const { O, N: all_, last } of gaps) {
        const N = all_.filter(r => !r.taken);
        if (!O.length) continue;
        const H = N.filter(r => r.hidden), V = N.filter(r => !r.hidden);
        if (!V.length && H.length >= O.length) { O.forEach((x, n) => { hiddenRead[H[n].index] = x.fp; moved[x.old] = H[n].index; }); continue; }
        if (V.length === O.length && (!last || O.length === 1)) { O.forEach((x, n) => changed.push({ old: x.old, at: V[n].index, fp: x.fp })); continue; }
        dropped.push(...O.map(x => ({ old: x.old, fp: x.fp, unsure: cur.some(r => r.fp === x.fp) })));
    }
    const failed = {};
    for (const [i, x] of Object.entries(s.failed)) if (moved[i] !== undefined && seen[moved[i]]) failed[moved[i]] = x;
    s.seen = seen; s.hiddenRead = hiddenRead; s.failed = failed; s.done = [];
    addDone(s, Object.keys(seen).map(Number));
    return { moved, changed, dropped, gone: [...changed, ...dropped].map(x => x.fp) };
}
// a post seen again may bring new comments: they join the post already there (same text, or same text, photo and time)
export function joinComments(posts, adds, cap = 8) {
    const key = c => `${String(c.from || '').toLowerCase()}|${c.text}`;
    let n = 0;
    for (const x of adds || []) {
        const old = (posts || []).find(o => o.text && o.text === x.text || o.photo && o.photo === x.photo && o.time === x.time);
        if (!old || !x.comments?.length) continue;
        const seen = new Set((old.comments || []).map(key)), more = x.comments.filter(c => !seen.has(key(c)));
        if (more.length) { old.comments = [...(old.comments || []), ...more].slice(-cap); n += more.length; }
    }
    return n;
}

// read messages, as merged ranges [first, last]
export const isDone = (s, i) => s.done.some(([a, b]) => i >= a && i <= b);
export function addDone(s, idx) {
    const all = [...s.done.map(r => [...r]), ...idx.map(i => [i, i])].sort((x, y) => x[0] - y[0]);
    const out = [];
    for (const r of all) { const last = out[out.length - 1]; if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]); else out.push(r); }
    s.done = out;
}

// this round's messages: `limit` unread ones from the chosen end, plus failed ones getting their one retry
// rows: [{ index, text }] for every message the phone may read (system messages already left out)
export function pickRound(s, rows) {
    const base = s.marks.base?.index ?? -1, limit = Math.max(1, Math.min(100, Math.floor(Number(s.limit) || LIMIT)));
    const unread = rows.filter(r => r.index > base && !isDone(s, r.index));
    const take = s.order === 'newest' ? unread.slice(-limit) : unread.slice(0, limit);
    const retry = rows.filter(r => s.failed[r.index]?.tries === 1 && !take.includes(r));
    return { rows: [...retry, ...take].sort((a, b) => a.index - b.index), retry: retry.map(r => r.index), remaining: unread.length - take.length };
}
export const unreadCount = (s, rows) => { const base = s.marks.base?.index ?? -1; return rows.filter(r => r.index > base && !isDone(s, r.index)).length; };

// after a round: a message whose event failed is read once more; when anything failed, so are the messages that got
// nothing (a failed event can carry what they said); a second miss is skipped. Then the round counts as read.
// failed: { [index]: why }, got: indices with an event that went in
// `span` keeps which messages were read together, so a retry knows what already went in beside it
// what 빼기 can offer: events still there and not taken up again by a message in the chat now (a new message may reuse
// a gone one's event id; then it is that message's)
export function pruneDropped(s) {
    s.dropped = (s.dropped || []).map(d => ({ ...d, events: d.events.filter(id => s.events[id] && s.events[id].at === null) })).filter(d => d.events.length);
}

// rows: the round's { index, text }
export function settleRound(s, rows, failed, got) {
    const round = rows.map(r => r.index), any = Object.keys(failed).length > 0, span = [Math.min(...round), Math.max(...round)];
    for (const r of rows) {
        const i = r.index, was = s.failed[i]?.span, wide = was ? [Math.min(was[0], span[0]), Math.max(was[1], span[1])] : span, f = bodyMark(r.text);
        if (failed[i]) s.failed[i] = { tries: (s.failed[i]?.tries || 0) + 1, why: failed[i], span: wide, fp: f };
        else if (any && !got.has(i)) s.failed[i] = { tries: (s.failed[i]?.tries || 0) + 1, why: '실패한 일과 같이 한 번 더 읽어요', quiet: true, span: wide, fp: f };
        else delete s.failed[i];
    }
    addDone(s, round);
    noteRead(s, rows);
}

// archive sections ({ key, first, last, text }) for this round:
// evidence — starts after the mark, and every message it covers is read or being read now, and not used before
// background — everything it covers is before the mark or already read; never sent: sections with unread messages outside this round
export function archiveRound(s, sections, rows, round) {
    const base = s.marks.base?.index ?? -1, now = new Set(round.map(r => r.index)), idx = rows.map(r => r.index);
    const covered = sec => idx.filter(i => i >= sec.first && i <= sec.last);
    const evidence = [], background = [];
    for (const sec of sections) {
        const ins = covered(sec);
        if (sec.first > base && ins.some(i => now.has(i)) && ins.every(i => now.has(i) || isDone(s, i)) && !s.arch[sec.key]) evidence.push(sec);
        else if (ins.every(i => i <= base || (isDone(s, i) && !now.has(i)))) background.push(sec);
    }
    return { evidence, background };
}

// does this round read the newest message? (only then may the archive's current state go along: an older round must
// not see what comes after it)
export const reachesEnd = (s, rows, round) => { const last = rows[rows.length - 1]?.index ?? -1; return round.some(r => r.index === last); };

// a quote counts when it is in the source word for word, ignoring only spacing, case and punctuation:
// reworded text can turn "lent" into "borrowed", so it never counts
const norm = t => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
export const quoted = (quote, text) => { const q = norm(quote); return q.length >= 2 && norm(text).includes(q); };

// 복구 기록: what each round added, kept in this browser per chat until the saved chat is seen to have it
const jkey = scope => `narrativearchive:sync:${scope}`;
export function journalRead(scope, storage = globalThis.localStorage) {
    try { const j = JSON.parse(storage?.getItem(jkey(scope)) || '[]'); return Array.isArray(j) ? j : []; } catch { return []; }
}
export function journalWrite(scope, rounds, storage = globalThis.localStorage) {
    try { if (rounds.length) storage?.setItem(jkey(scope), JSON.stringify(rounds)); else storage?.removeItem(jkey(scope)); } catch { /* the chat's own save still holds the round */ }
}
export const journalAdd = (scope, round, storage = globalThis.localStorage) => journalWrite(scope, [...journalRead(scope, storage), round].slice(-20), storage);
