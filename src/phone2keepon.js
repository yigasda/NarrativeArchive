// phone2keep.js를 실리에 잇기: 플러그인으로 가는 요청, 채팅이 바뀔 때 읽기, core.js saveMeta 앞에 끼우기.
// index.js가 keepStart()를 한 번 불러요.

import { ctx, getMeta, hasChat, setSaveHook } from './core.js';
import { makeKeep } from './phone2keep.js';
import { reseedActivity } from './phone2sched.js';

const PATH = '/api/plugins/narrative-archive';
const J = JSON.stringify;
async function http(path, body) {
    const headers = ctx().getRequestHeaders();
    const r = await fetch(PATH + path, body === undefined ? { headers } : { method: 'POST', headers, body });
    if (r.ok) return r.json();
    const err = new Error((await r.json().catch(() => ({})))?.error || `Orbit 저장 서버 오류 (${r.status})`);
    err.code = r.status;
    throw err;
}
const api = {
    ping: () => http('/ping'),
    load: id => http('/store/load', J({ id })).catch(err => { if (err.code === 404) return null; throw err; }),
    rev: id => http('/store/rev', J({ id })).then(r => (Number.isInteger(r?.rev) ? r.rev : null)),
    // (the parts are JSON texts already: they go into the body as they are)
    save: (id, { base, chat, parts }) => http('/store/save', `{"id":${J(id)},"base":${J(base ?? null)},"chat":${J(chat || '')},"parts":{${Object.entries(parts).map(([k, s]) => `${J(k)}:${s ?? 'null'}`).join(',')}}}`),
    fork: (from, to, { chat }) => http('/store/fork', J({ from, to, chat })),
    drop: id => http('/store/drop', J({ id })),
};
const now = () => (hasChat() ? { m: getMeta(), mark: ctx().chatMetadata?.integrity || '' } : null);

export const keep = makeKeep({ api, now });
// 지금 채팅의 Orbit 데이터를 다 읽었을 때 끝나는 약속 (플러그인이 없으면 바로)
export const liveReady = () => keep.ready();
export const keepState = () => keep.state();

// 지금 채팅의 Orbit 데이터가 플러그인에 있나 (있어야 서버가 실리를 닫은 동안 돌릴 수 있어요)
export const keepKept = () => keep.kept();

// ---- 서버 플러그인과 번갈아 돌기 (docs/PHONE2-PLAN.md "서버 플러그인" 3-3)
// 플러그인의 일꾼은 실리를 닫은 동안 · 탭을 가려 둔 동안 먼저 말 걸기와 늦은 답장을 돌려요. 둘이 같이 돌면 말이 두 번 나오니까:
//   - 브라우저는 보이는 동안 30초마다 "내가 보고 있어요"를 알려요 (keepBeat). 일꾼은 그 뒤 75초 동안 이 채팅을 안 건드려요
//     (가려져 있어도 브라우저가 답장을 받고 있는 중이면 알려요: 그 답장이 들어갈 때까지 일꾼이 기다려요)
//   - 가려져 있고 일꾼이 돌고 있으면 브라우저의 30초 틱은 쉬어요 (keepServes: phone2tick.js가 봐요)
//   - 다시 보이면 · 30초마다, 일꾼이 그사이 쓴 것을 받아요 (keepSync). 브라우저에만 있는 것과는 합쳐요 (phone2keep.js merge3)
let serves = false;
// 서버 플러그인의 일꾼이 이 채팅을 맡을 수 있나 (플러그인에 둔 채팅이고, 마지막으로 알렸을 때 일꾼이 돌고 있었어요)
export const keepServes = () => serves && keep.kept();
const hidden = () => !!globalThis.document?.hidden;
// "내가 보고 있어요" → 일꾼이 돌고 있으면 true
export async function keepPing() {
    const id = keep.id(), w = hasChat() ? getMeta()?.live?.world : null;
    if (!id || !w) { serves = false; return false; }
    const st = w.presence?.user?.status, status = st === 'idle' || st === 'dnd' ? st : 'active';
    try { serves = !!(await http('/auto/presence', J({ id, status })))?.on; }
    catch { serves = false; }   // (an older plugin without this route, or the plugin gone: as before, the browser does it all)
    return serves;
}
// 일꾼이 쓴 것을 받아요 → 바뀌었으면 true (화면에 알려요: 'na-live-change')
export async function keepSync() {
    const m = hasChat() ? getMeta() : null;
    if (!m || !keep.kept()) return false;
    let changed = false;
    // (how many messages a character wrote first were unseen in each room before: what the server added shows after)
    const unseen = () => new Map(Object.values(m.live?.world?.messenger?.rooms || {}).map(r => [r.id, r.autonomousUnreadCount > 0 ? Math.floor(r.autonomousUnreadCount) : 0]));
    const before = unseen();
    try { changed = await keep.sync(); }
    catch (err) { console.warn('[narrative-archive] Orbit 맞추기', err); return false; }
    if (!changed) return false;
    // (what Marinara's tracker remembers of the rooms is read from the rooms again: the messages the server's characters wrote first)
    for (const roomId of Object.keys(m.live?.world?.messenger?.rooms || {})) { try { reseedActivity(m, roomId); } catch { /* a room gone meanwhile */ } }
    try { globalThis.document?.dispatchEvent(new globalThis.CustomEvent('na-live-change')); } catch { /* no screen */ }
    // 그사이 캐릭터가 먼저 건 말이 들어왔어요: 화면이 알림(소리 · 떠 있는 알림 · 브라우저 알림)을 띄울 신호
    //   'na-live-auto', detail: { from: 'server', rooms: [{ room, by: [이름], added, count }] }
    const rooms = [];
    for (const r of Object.values(m.live?.world?.messenger?.rooms || {})) {
        const now = r.autonomousUnreadCount > 0 ? Math.floor(r.autonomousUnreadCount) : 0, added = now - (before.get(r.id) || 0);
        if (added > 0) rooms.push({ room: r.id, by: (Array.isArray(r.autonomousUnreadCharacterIds) ? r.autonomousUnreadCharacterIds : []).map(k => (r.members || []).find(n => String(n || '').trim().toLowerCase() === k) || k), added, count: now });
    }
    if (rooms.length) { try { globalThis.document?.dispatchEvent(new globalThis.CustomEvent('na-live-auto', { detail: { from: 'server', rooms } })); } catch { /* no screen */ } }
    return true;
}
let beating = null;
// 30초마다 · 탭이 다시 보일 때 · 채팅을 열 때
export function keepBeat() {
    if (beating) return beating;
    beating = (async () => {
        await keep.ready();
        const busy = !!(hasChat() && getMeta()?.live?.world?.queue?.jobs?.some(j => j.state === 'running'));
        if (hidden() && !busy) return;
        await keepPing();
        if (!hidden()) await keepSync();
    })().catch(err => console.warn('[narrative-archive] Orbit 서버 알리기', err)).finally(() => { beating = null; });
    return beating;
}
// 이 채팅의 방마다 일꾼이 실리를 닫은 동안 돌릴 수 있나 → { on, rooms: [{ id, room, can, why }] } (화면이 "닫아도 와요"를 되는 방에만 보여 줘요)
export async function keepAutoStatus() {
    const id = keep.id();
    if (!id) return { on: false, rooms: [] };
    try { const r = await http('/auto/status', J({ id })); return { on: !!r?.on, rooms: Array.isArray(r?.rooms) ? r.rooms : [] }; }
    catch { return { on: false, rooms: [] }; }
}
export const KEEP_BEAT_MS = 30_000;

let started = false;
export function keepStart() {
    if (started) return;
    started = true;
    setSaveHook(() => keep.onSave());
    const c = ctx(), et = c.eventTypes || c.event_types;
    const open = () => { const at = now(); if (at) keep.open(at.m, at.mark); };
    c.eventSource.on(et.CHAT_CHANGED, () => { open(); serves = false; keepBeat(); });
    open();
    keepBeat();
    // (.unref: only there in Node — the tests — so the timer does not keep the process up; a browser's timer is a number)
    globalThis.setInterval(keepBeat, KEEP_BEAT_MS)?.unref?.();
    globalThis.document?.addEventListener?.('visibilitychange', () => { if (!hidden()) keepBeat(); });
}
