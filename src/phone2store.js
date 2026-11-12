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
//     persona: the persona's name, lastOwner: 마지막으로 연 폰 주인,
//     phones: { [name key]: phone },              모든 인물의 폰 2
//     finance, profiles, pre, lore, loreOff:      폰 1의 m.finance · phoneProfiles · phonePre · phoneLore · phoneLoreOff
//                                                 에 해당하는 폰 2 것 (이야기에서 시작하면 그때의 깊은 복사)
//     messenger: { accounts: { [name key]: { name } }, rooms: { [id]: { id, members: [name], messages: [] } } },
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
        persona: name, lastOwner: '', phones: {}, finance: null, profiles: {}, pre: {}, lore: [], loreOff: {},
        messenger: { accounts: { [liveKey(name)]: { name } }, rooms: {} }, queue: { round: 0, jobs: [] } };
    return live.world;
}
// 폰 1's chat-level keys a 폰 2 begun from the story takes a deep copy of (phoneScreenHolder, phoneStoryScope and
// phoneStoryRun are 폰 1's alone; glossary, dateOrder and the settings stay shared, read only)
export const STORY_COPY = { phones: 'phones', finance: 'finance', phoneProfiles: 'profiles', phonePre: 'pre', phoneLore: 'lore', phoneLoreOff: 'loreOff' };
// 이야기에서 시작: a new 폰 2 from 폰 1 as it is now, nothing shared with it (폰 1 is only read)
export function startFromStory(m, { persona, upto, scope = '', dayShift = 0, now = Date.now() } = {}) {
    const copy = Object.fromEntries(Object.keys(STORY_COPY).filter(k => m?.[k] !== undefined && m[k] !== null).map(k => [k, structuredClone(m[k])]));
    const w = newWorld(m, { from: 'story', persona, dayShift, scope, storyUpto: upto, now });
    for (const [k, to] of Object.entries(STORY_COPY)) if (k in copy) w[to] = copy[k];
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
// a copy of 폰 1's (shared, read only: a change stays in the copy); text (the story) is '' until 5단계 gives the part up
// to storyUpto. Everything else of 폰 1 is not there at all (undefined), and anything written that isn't 폰 2's own stays
// in the drawer, never in m.
export const LIVE_OWN = { phones: 'phones', finance: 'finance', phoneProfiles: 'profiles', phonePre: 'pre', phoneLore: 'lore', phoneLoreOff: 'loreOff', lastPhoneOwner: 'lastOwner' };
export const LIVE_SHARED = ['glossary', 'glossaryPeople', 'dateOrder'];
const IS_LIVE = Symbol('폰 2 서랍');
export const isLiveMeta = v => !!(v && typeof v === 'object' && v[IS_LIVE]);
export function liveMeta(m) {
    const w = liveWorld(m);
    if (!w) throw new Error('아직 폰 2가 없어요');
    const own = k => typeof k === 'string' && Object.hasOwn(LIVE_OWN, k), shared = k => typeof k === 'string' && LIVE_SHARED.includes(k);
    const drawer = { text: '' }, copies = {};
    const copy = k => (Object.hasOwn(copies, k) ? copies[k] : (copies[k] = m[k] === undefined ? undefined : structuredClone(m[k])));
    const at = k => (own(k) ? w[LIVE_OWN[k]] : Object.hasOwn(drawer, k) ? drawer[k] : shared(k) ? copy(k) : undefined);
    const keys = () => [...new Set([...Object.keys(LIVE_OWN).filter(k => w[LIVE_OWN[k]] !== undefined), ...LIVE_SHARED.filter(k => m[k] !== undefined), ...Object.keys(drawer)])];
    return new Proxy(drawer, {
        get: (_, k) => (k === IS_LIVE ? true : typeof k === 'symbol' ? undefined : at(k)),
        set: (_, k, v) => { if (own(k)) w[LIVE_OWN[k]] = v; else if (shared(k) && !Object.hasOwn(drawer, k)) copies[k] = v; else drawer[k] = v; return true; },
        deleteProperty: (_, k) => { if (own(k)) w[LIVE_OWN[k]] = undefined; else { delete drawer[k]; if (shared(k)) copies[k] = undefined; } return true; },
        has: (_, k) => k === IS_LIVE || keys().includes(k),
        ownKeys: () => keys(),
        getOwnPropertyDescriptor: (_, k) => (keys().includes(k) ? { value: at(k), writable: true, enumerable: true, configurable: true } : undefined),
        defineProperty: (_, k, d) => { if ('value' in d) { if (own(k)) w[LIVE_OWN[k]] = d.value; else drawer[k] = d.value; } return true; },
    });
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

// 일의 줄: one at a time, each job tagged with its world and round; a failure stops the line until it is seen
export function enqueueJob(m, { kind, owner = '', at = Date.now() } = {}) {
    const w = liveWorld(m);
    if (!w) throw new Error('아직 폰 2가 없어요');
    if (!['reply', 'reflect', 'first'].includes(kind)) throw new Error('일 종류는 reply · reflect · first예요');
    const job = { id: newId('j'), world: w.id, round: ++w.queue.round, kind, owner: String(owner || ''), at, state: 'waiting' };
    w.queue.jobs.push(job);
    return job;
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
