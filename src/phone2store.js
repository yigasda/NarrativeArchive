// 폰 2(실시간) 저장 자리 (docs/PHONE2-PLAN.md 단계 1). 폰 1 코드는 이 파일을 부르지 않고, 이 파일도 폰 1 것을
// 하나도 부르거나 고치지 않아요: 채팅 메타의 m.live 한 칸만 봐요. 휴대폰 창(phone.js)만 불러요(4-2).
//
// m.live = {
//   v: 1,
//   mode: 'story' | 'live',                      지금 보는 폰 (기본: 폰 1)
//   world: null | {                               지금 폰 2 하나
//     id, from: 'story' | 'fresh', startedAt (ms), dayShift (현실보다 며칠 앞인지),
//     scope: the chat it belongs to (phoneChatScope), storyUpto: 이야기에서 시작했으면 그때의 마지막 메시지 번호
//       (폰 2는 이야기를 그 번호까지만 읽어요; 글을 복사하지 않아요), else null,
//     story: 이야기에서 시작했으면 그때의 이야기 표시 { ranges, titles, rawFrom } (phone2story.js), else null,
//     persona: the persona's name, lastOwner: 마지막으로 연 폰 주인,
//     phones: { [name key]: phone },              모든 인물의 폰 2
//     finance, profiles, pre, lore, loreOff:      폰 1의 m.finance · phoneProfiles · phonePre · phoneLore · phoneLoreOff
//                                                 에 해당하는 폰 2 것 (이야기에서 시작하면 그때의 깊은 복사)
//     messenger: { accounts: { [name key]: { name } }, rooms: { [id]: { id, members: [name], messages: [], name?, read? } } },
//       messages: [{ id, n (세계 전체의 메시지 번호), from: name, text, at (ms), ko?, state? (주인이 답하며 적은 상태), does? [{ app, what }] (답하며 폰으로 한 일),
//         act? (말 없이 한 일 · 상태만: 메신저 화면엔 안 그려요), call? }], read: { [name key]: 마지막으로 읽은 시각 (ms) }, name: 단체방 이름
//       seq: 마지막으로 준 메시지 번호
//     queue: { round, jobs: [{ id, world, round, kind, owner, at, state: 'waiting' | 'running' | 'done' | 'failed' | 'dropped', error, seen }] },
//   },
//   archive: [world …],                            지난 폰 2들 (읽기만, 지우지 않아요)
// }

// the same key as people.js nameKey (m.phones' keys): tests/phone2store.test.mjs keeps them in step
export const liveKey = n => String(n || '').trim().toLowerCase();
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const newId = (p = '') => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// reading never adds m.live: a chat that never opens 폰 2 keeps its metadata as it was
export const liveOf = m => (obj(m?.live) && m.live.v === 1 ? m.live : null);
function ensureLive(m) {
    if (!obj(m)) throw new Error('채팅 정보가 없어요');
    if (!liveOf(m)) {
        if (m.live !== undefined) throw new Error('폰 2 저장 자리를 읽을 수 없어요');
        m.live = { v: 1, mode: 'story', world: null, archive: [] };
    }
    return m.live;
}
export const liveWorld = m => liveOf(m)?.world || null;
export const liveMode = m => (liveOf(m)?.mode === 'live' && liveWorld(m) ? 'live' : 'story');
// 폰 2 is shown only when there is one; 폰 1 is always there to go back to
export function setLiveMode(m, mode) {
    if (mode !== 'story' && mode !== 'live') throw new Error('모드는 story 또는 live예요');
    if (mode === 'live' && !liveWorld(m)) throw new Error('아직 폰 2가 없어요');
    if (mode === 'story' && !liveOf(m)) return 'story';
    ensureLive(m).mode = mode;
    return mode;
}

// a new 폰 2: the one there goes to the archive first (never thrown away); the jobs waiting for it are dropped there
export function newWorld(m, { from = 'fresh', persona = '', dayShift = 0, scope = '', storyUpto = null, now = Date.now() } = {}) {
    if (from !== 'story' && from !== 'fresh') throw new Error('시작은 story 또는 fresh예요');
    if (!String(persona || '').trim()) throw new Error('페르소나 이름이 필요해요');
    if (from === 'story' && !(Number.isInteger(storyUpto) && storyUpto >= 0)) throw new Error('이야기의 어느 메시지까지인지 필요해요');
    const live = ensureLive(m);
    if (live.world) archiveWorld(m, now);
    const name = String(persona).trim();
    live.world = { id: newId('w'), from, startedAt: now, dayShift: Number(dayShift) || 0, scope: String(scope || ''), storyUpto: from === 'story' ? storyUpto : null,
        story: null, persona: name, lastOwner: '', phones: {}, finance: null, profiles: {}, pre: {}, lore: [], loreOff: {},
        messenger: { accounts: { [liveKey(name)]: { name } }, rooms: {} }, queue: { round: 0, jobs: [] } };
    return live.world;
}
// 폰 1's chat-level keys a 폰 2 begun from the story takes a deep copy of (phoneScreenHolder, phoneStoryScope and
// phoneStoryRun are 폰 1's alone; glossary, dateOrder and the settings stay shared, read only)
export const STORY_COPY = { phones: 'phones', finance: 'finance', phoneProfiles: 'profiles', phonePre: 'pre', phoneLore: 'lore', phoneLoreOff: 'loreOff' };
// 이야기에서 시작: a new 폰 2 from 폰 1 as it is now, nothing shared with it (폰 1 is only read)
// story: what the story was then (phone2story.js storyMark: its ranges, titles, first raw message), so 폰 2 reads no further
export function startFromStory(m, { persona, upto, scope = '', dayShift = 0, now = Date.now(), story = null } = {}) {
    if (!(Number.isInteger(upto) && upto >= 0)) throw new Error('이야기의 어느 메시지까지인지 필요해요');
    if (!obj(story) || !obj(story.ranges) || !Array.isArray(story.titles) || !Number.isInteger(story.rawFrom)) throw new Error('시작할 때의 이야기 표시가 필요해요');
    const copy = Object.fromEntries(Object.keys(STORY_COPY).filter(k => m?.[k] !== undefined && m[k] !== null).map(k => [k, structuredClone(m[k])]));
    const w = newWorld(m, { from: 'story', persona, dayShift, scope, storyUpto: upto, now });
    for (const [k, to] of Object.entries(STORY_COPY)) if (k in copy) w[to] = copy[k];
    // (the copies begin clean: 폰 1's last rounds can't be undone here, their result isn't 폰 2's, and a payment 폰 1 still
    // owes a story message can't be worked out here, where the story's words are never sent)
    for (const p of Object.values(w.phones || {})) {
        if (!obj(p)) continue;
        delete p.syncUndo; delete p.syncUndos; delete p.syncLast;
        if (obj(p.sync)) delete p.sync.owed;
    }
    w.story = structuredClone(story);
    if (typeof m.lastPhoneOwner === 'string') w.lastOwner = m.lastPhoneOwner;
    return w;
}
// 처음부터 시작: an empty 폰 2 (its phones are made later from the cards)
export const startFresh = (m, { persona, scope = '', now = Date.now() } = {}) => newWorld(m, { from: 'fresh', persona, scope, now });
export function archiveWorld(m, now = Date.now()) {
    const live = liveOf(m);
    if (!live?.world) return null;
    const w = live.world;
    for (const j of w.queue?.jobs || []) if (j.state === 'waiting' || j.state === 'running') { j.state = 'dropped'; j.error = '보관됨'; }
    w.archivedAt = now;
    live.archive.push(w);
    live.world = null;
    live.mode = 'story';
    return w;
}
export const archivedWorlds = m => [...(liveOf(m)?.archive || [])];
// 폰 1's story begins anew (새 이야기로 비우기, "아니요, 새 이야기"): 폰 2 can't keep a story that is gone.
//   'all':   폰 2 goes entirely, its archive too (m.live is taken off)
//   'chats': the messenger stays (its rooms, messages and accounts, and the persona), in a world begun fresh: no phones,
//            ledger, profiles, lore or story mark, real dates (dayShift 0), no job waiting; the archive goes
// Either way the phone shows 타임라인 again. An m.live this version can't read is left as it is.
// Returns what was done: 'none' (there was no 폰 2), 'all' or 'chats'.
export function resetLive(m, how = 'chats') {
    if (how !== 'all' && how !== 'chats') throw new Error('비우기는 all 또는 chats예요');
    const live = liveOf(m);
    if (!live) return 'none';
    const w = live.world, rooms = Object.keys(w?.messenger?.rooms || {}).length;
    if (how === 'all' || !w || !rooms) { delete m.live; return w || live.archive?.length ? 'all' : 'none'; }
    live.world = { id: newId('w'), from: 'fresh', startedAt: w.startedAt, dayShift: 0, scope: w.scope, storyUpto: null, story: null,
        persona: w.persona, lastOwner: '', phones: {}, finance: null, profiles: {}, pre: {}, lore: [], loreOff: {},
        messenger: w.messenger, queue: { round: (Number(w.queue?.round) || 0) + 1, jobs: [] } };
    live.archive = [];
    live.mode = 'story';
    return 'chats';
}

// 폰 2 phones: their own, never one of m.phones
export const livePhone = (m, owner) => liveWorld(m)?.phones?.[liveKey(owner)] || null;
export function putLivePhone(m, p) {
    const w = liveWorld(m);
    if (!w) throw new Error('아직 폰 2가 없어요');
    if (!obj(p) || !String(p.owner || '').trim()) throw new Error('폰 주인이 필요해요');
    if (Object.values(m.phones || {}).includes(p)) throw new Error('폰 1의 폰은 폰 2에 넣을 수 없어요');
    w.phones[liveKey(p.owner)] = p;
    return p;
}

// 폰 2's own drawer, in 폰 1's shape: what a screen is given in place of the chat's metadata while 실시간 is on, so the
// same screens draw 폰 2 and can't reach 폰 1. Its phones · finance · phoneProfiles · phonePre · phoneLore ·
// phoneLoreOff · lastPhoneOwner are this world's (reads and writes go there); glossary · glossaryPeople · dateOrder are
// a copy of 폰 1's (shared, read only: a change stays in the copy); text (the story) is what `text` gives (the part 폰 2
// knew when it began, phone2story.js), else ''. Everything else of 폰 1 is not there at all (undefined), and anything written that isn't 폰 2's own stays
// in the drawer, never in m.
export const LIVE_OWN = { phones: 'phones', finance: 'finance', phoneProfiles: 'profiles', phonePre: 'pre', phoneLore: 'lore', phoneLoreOff: 'loreOff', lastPhoneOwner: 'lastOwner' };
export const LIVE_SHARED = ['glossary', 'glossaryPeople', 'dateOrder'];
const IS_LIVE = Symbol('폰 2 서랍');
export const isLiveMeta = v => !!(v && typeof v === 'object' && v[IS_LIVE]);
// text: what 폰 2 may read of the story, a function asked each time (phone2story.js liveStoryText), else ''
// the newest messenger talk of the rooms `owner` is in, oldest first, one line a message ("Name: words"), the last `n`
// that fit in maxChars (seen: only up to that message number). What 폰 1's app requests show as RECENT CHAT when they
// are given 폰 2's drawer
export function liveRecent(w, owner, n = 12, { maxChars = Infinity, seen = null } = {}) {
    const flat = v => String(v ?? '').replace(/\s+/g, ' ').trim(), k = liveKey(owner);
    const all = Object.values(w?.messenger?.rooms || {}).filter(r => (r.members || []).some(x => liveKey(x) === k)).flatMap(r => r.messages || [])
        .filter(x => (x.call || flat(x.text)) && (seen == null || (x.n ?? Infinity) <= seen)).sort((a, b) => (a.n ?? 0) - (b.n ?? 0) || (a.at ?? 0) - (b.at ?? 0)).slice(-Math.max(0, n));
    const out = [];
    let room = Math.max(0, maxChars);
    for (let i = all.length - 1; i >= 0; i--) {
        const x = all[i], t = `${x.from}: ${x.call ? `(call, ${Math.max(0, Math.round(Number(x.call.min) || 0))} min${flat(x.call.summary) ? ` — ${flat(x.call.summary)}` : ''})` : flat(x.text)}`;
        if (out.length && t.length + 1 > room) break;
        out.unshift(t.slice(0, room)); room -= t.length + 1;
        if (room <= 0) break;
    }
    return out.join('\n');
}
export function liveMeta(m, { text = null } = {}) {
    const w = liveWorld(m);
    if (!w) throw new Error('아직 폰 2가 없어요');
    const own = k => typeof k === 'string' && Object.hasOwn(LIVE_OWN, k), shared = k => typeof k === 'string' && LIVE_SHARED.includes(k);
    const drawer = {}, copies = {};
    const story = () => { const t = typeof text === 'function' ? text() : ''; return typeof t === 'string' ? t : ''; };
    // (a copy of a shared key: taken again when the chat's own has changed since — the glossary edited on its screen,
    // which writes the chat's meta — so the drawer never reads an old one)
    const from = {}, sig = k => { try { return JSON.stringify(m[k]) ?? ''; } catch { return ''; } };
    const copy = k => { const s = sig(k); if (!Object.hasOwn(copies, k) || from[k] !== s) { from[k] = s; copies[k] = m[k] === undefined ? undefined : structuredClone(m[k]); } return copies[k]; };
    // (phoneJournal: the browser key 폰 2's 복구 records are under. 폰 1's functions that touch the journal of the meta they
    // are given ask for it, so with the drawer they never reach 폰 1's own)
    // (phoneUpto · phoneRecent: what 폰 1's app requests read of the talk. The role-play chat only up to where 폰 2 began
    // (none of it for one begun fresh), and for the newest talk the messenger's, never the chat's)
    const upto = () => (w.from === 'story' && Number.isInteger(w.storyUpto) ? w.storyUpto : -1);
    const at = k => (own(k) ? w[LIVE_OWN[k]] : Object.hasOwn(drawer, k) ? drawer[k] : k === 'text' ? story() : k === 'phoneJournal' ? (liveScope(w.scope || 'live', m) || 'live') : k === 'phoneUpto' ? upto() : k === 'phoneRecent' ? (owner, n, o) => liveRecent(w, owner, n, o) : shared(k) ? copy(k) : undefined);
    const keys = () => [...new Set([...Object.keys(LIVE_OWN).filter(k => w[LIVE_OWN[k]] !== undefined), ...LIVE_SHARED.filter(k => m[k] !== undefined), 'text', ...Object.keys(drawer)])];
    return new Proxy(drawer, {
        get: (_, k) => (k === IS_LIVE ? true : typeof k === 'symbol' ? undefined : at(k)),
        set: (_, k, v) => { if (own(k)) w[LIVE_OWN[k]] = v; else if (shared(k) && !Object.hasOwn(drawer, k)) { copies[k] = v; from[k] = sig(k); } else drawer[k] = v; return true; },
        deleteProperty: (_, k) => { if (own(k)) w[LIVE_OWN[k]] = undefined; else { delete drawer[k]; if (shared(k)) { copies[k] = undefined; from[k] = sig(k); } } return true; },
        has: (_, k) => k === IS_LIVE || keys().includes(k),
        ownKeys: () => keys(),
        getOwnPropertyDescriptor: (_, k) => (keys().includes(k) ? { value: at(k), writable: true, enumerable: true, configurable: true } : undefined),
        defineProperty: (_, k, d) => { if ('value' in d) { if (own(k)) w[LIVE_OWN[k]] = d.value; else drawer[k] = d.value; } return true; },
    });
}

// 브라우저 저장 (5-4): what 폰 1 keeps in this browser per chat (the last phone owner, 복구's journal) is keyed by the chat
// (phoneChatScope). 폰 2 keeps its own under its own key, the chat's and its world's: "<scope>:live:<world id>", so neither
// reads or overwrites the other, and a new 폰 2 never reads an old one's. null without a chat or a 폰 2
export const liveScope = (scope, m) => { const w = liveWorld(m); return scope && w?.id ? `${scope}:live:${w.id}` : null; };
// the last owner 폰 2 showed: in its world (saved with the chat) and in this browser too (a reload may come before the
// chat is saved); read back from the browser first, as 폰 1 does
export function rememberLiveOwner(m, owner, scope, storage = globalThis.localStorage) {
    const w = liveWorld(m), k = liveScope(scope, m);
    if (!w || !String(owner || '').trim()) return;
    w.lastOwner = String(owner).trim();
    try { if (k) storage?.setItem(k, w.lastOwner); } catch { /* the chat's own save still holds it */ }
}
export function readLiveOwner(m, scope, storage = globalThis.localStorage) {
    const w = liveWorld(m), k = liveScope(scope, m);
    if (!w) return null;
    let saved = null;
    try { saved = k ? storage?.getItem(k) : null; } catch { saved = null; }
    const has = n => !!n && Object.values(w.phones || {}).some(p => liveKey(p?.owner) === liveKey(n));
    return has(saved) ? saved : has(w.lastOwner) ? w.lastOwner : null;
}

// 메신저: every room has the persona in it (the persona's own rooms only); people get an account when they first join
export function ensureAccount(m, name) {
    const w = liveWorld(m), n = String(name || '').trim();
    if (!w) throw new Error('아직 폰 2가 없어요');
    if (!n) throw new Error('이름이 필요해요');
    return (w.messenger.accounts[liveKey(n)] ||= { name: n });
}
export function ensureRoom(m, members) {
    const w = liveWorld(m);
    if (!w) throw new Error('아직 폰 2가 없어요');
    const names = [...new Map([w.persona, ...(members || [])].map(n => String(n || '').trim()).filter(Boolean).map(n => [liveKey(n), n])).values()];
    if (names.length < 2) throw new Error('방에는 페르소나 말고 한 사람 이상이 필요해요');
    const keys = names.map(liveKey).sort().join('|');
    const room = Object.values(w.messenger.rooms).find(r => r.members.map(liveKey).sort().join('|') === keys);
    if (room) return room;
    for (const n of names) ensureAccount(m, n);
    const id = newId('r');
    return (w.messenger.rooms[id] = { id, members: names, messages: [] });
}
export const liveRooms = m => Object.values(liveWorld(m)?.messenger?.rooms || {});
const roomOf = (m, id) => { const r = liveWorld(m)?.messenger?.rooms?.[id]; if (!r) throw new Error('없는 방이에요'); return r; };
// every messenger message has a number of its own, one count for the whole world (the order they were said in; after
// the story's numbers when 폰 2 began from the story): the
// reflection names a message by it, as 폰 1's names a chat message by its place. Messages from before numbers: numbered
// once, in the order they were said (a number given is never changed)
export function numberLive(w) {
    const ms = w.messenger, all = Object.values(ms.rooms || {}).flatMap(r => r.messages || []);
    // (a 폰 2 begun from the story counts on from the story's last message: its phones hold records that name the story's
    // message numbers, and a messenger message with one of those numbers would be taken for that message)
    let top = Math.max(Number(ms.seq) || 0, Number.isInteger(w.storyUpto) ? w.storyUpto : 0, ...all.map(x => (Number.isInteger(x.n) ? x.n : 0)));
    for (const x of all.filter(x => !Number.isInteger(x.n)).sort((a, b) => (a.at || 0) - (b.at || 0) || String(a.id).localeCompare(String(b.id)))) x.n = ++top;
    ms.seq = top;
    return top;
}
// the next number (one given out: the count moves on)
export const liveNo = w => (w.messenger.seq = numberLive(w) + 1);
// 단체방 이름 (빈 글이면 이름 없음)
export function nameRoom(m, id, name) { const r = roomOf(m, id), n = String(name || '').trim().slice(0, 40); if (n) r.name = n; else delete r.name; return r; }
// 페르소나가 보내요: 메신저에만 남아요. 보낸 사람은 그때까지 읽은 걸로
export function sendLive(m, id, text, at = Date.now()) {
    const r = roomOf(m, id), w = liveWorld(m), t = String(text || '').trim();
    if (!t) throw new Error('보낼 말이 없어요');
    const msg = { id: newId('t'), n: liveNo(w), from: w.persona, text: t.slice(0, 4000), at };
    r.messages.push(msg);
    (r.read ||= {})[liveKey(w.persona)] = at;
    return msg;
}
// who가 이 방을 at까지 읽었어요 (앞으로만)
export function readLive(m, id, who, at = Date.now()) { const r = roomOf(m, id), k = liveKey(who); if (!r.members.some(n => liveKey(n) === k)) return r; r.read ||= {}; if (!(r.read[k] >= at)) r.read[k] = at; return r; }
// who가 아직 안 읽은 남의 말 수
export const unreadFor = (room, who) => { const k = liveKey(who), t = room?.read?.[k] || 0; return (room?.messages || []).filter(x => liveKey(x.from) !== k && x.at > t).length; };
// 이 말을 아직 안 읽은 사람들 (보낸 사람 빼고)
export const unreadBy = (room, msg) => (room?.members || []).filter(n => liveKey(n) !== liveKey(msg?.from) && !((room?.read?.[liveKey(n)] || 0) >= msg?.at));

// 일의 줄: one at a time, each job tagged with its world and round; a failure stops the line until it is seen
// room: the messenger room a reply is for
export function enqueueJob(m, { kind, owner = '', room = '', at = Date.now() } = {}) {
    const w = liveWorld(m);
    if (!w) throw new Error('아직 폰 2가 없어요');
    if (!['reply', 'reflect', 'first'].includes(kind)) throw new Error('일 종류는 reply · reflect · first예요');
    const job = { id: newId('j'), world: w.id, round: ++w.queue.round, kind, owner: String(owner || ''), ...(room ? { room: String(room) } : {}), at, state: 'waiting' };
    w.queue.jobs.push(job);
    // (the line keeps its newest finished jobs only; waiting, running and failed ones always stay)
    const old = w.queue.jobs.filter(j => j.state === 'done' || j.state === 'dropped');
    if (old.length > JOBS_KEPT) { const gone = new Set(old.slice(0, old.length - JOBS_KEPT)); w.queue.jobs = w.queue.jobs.filter(j => !gone.has(j)); }
    return job;
}
export const JOBS_KEPT = 20;
// the persona wrote in a room: each of the others in it owes an answer. One already waiting for that owner and room
// answers these words too (it reads the room when it runs), so no second one is lined up. Returns the jobs lined up
export function enqueueReplies(m, roomId, at = Date.now()) {
    const w = liveWorld(m), room = w?.messenger?.rooms?.[roomId];
    if (!room) throw new Error('없는 방이에요');
    const out = [];
    for (const n of room.members) {
        if (liveKey(n) === liveKey(w.persona) || !w.phones?.[liveKey(n)]) continue;
        if (w.queue.jobs.some(j => j.state === 'waiting' && j.kind === 'reply' && liveKey(j.owner) === liveKey(n) && j.room === roomId)) continue;
        out.push(enqueueJob(m, { kind: 'reply', owner: n, room: roomId, at }));
    }
    return out;
}
// a job left "running" by a page that closed (nothing runs it any more) waits again: its result never came in
export function reviveJobs(m) {
    let n = 0;
    for (const j of liveWorld(m)?.queue.jobs || []) if (j.state === 'running') { j.state = 'waiting'; n++; }
    return n;
}
export const queueStopped = m => !!liveWorld(m)?.queue.jobs.some(j => j.state === 'failed' && !j.seen);
// the next job to run, or null: none while one runs, none while a failure waits to be seen
export function nextJob(m) {
    const w = liveWorld(m);
    if (!w || queueStopped(m) || w.queue.jobs.some(j => j.state === 'running')) return null;
    const j = w.queue.jobs.find(x => x.state === 'waiting');
    if (j) j.state = 'running';
    return j || null;
}
// a job's end: its result counts only if its world is still the one there (false: drop the result)
export function finishJob(m, job, { error = '' } = {}) {
    const w = liveWorld(m), mine = !!w && job?.world === w.id ? w.queue.jobs.find(j => j.id === job.id) : null;
    if (!mine || mine.state !== 'running') return false;
    if (error) { mine.state = 'failed'; mine.error = String(error); return false; }
    mine.state = 'done';
    return true;
}
export function seeFailure(m, jobId) {
    const j = liveWorld(m)?.queue.jobs.find(x => x.id === jobId && x.state === 'failed');
    if (j) j.seen = true;
    return !!j;
}
