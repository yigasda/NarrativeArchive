// phone2keep.js를 실리에 잇기: 플러그인으로 가는 요청, 채팅이 바뀔 때 읽기, core.js saveMeta 앞에 끼우기.
// index.js가 keepStart()를 한 번 불러요.

import { ctx, getMeta, hasChat, setSaveHook } from './core.js';
import { makeKeep } from './phone2keep.js';
import { reseedActivity } from './phone2sched.js';

const PATH = '/api/plugins/narrative-archive';
const J = JSON.stringify;
// 요청마다 시간 제한: 화면이 꺼질 때 걸린 요청이 끝나지 않고 남아서, 화면을 다시 켰을 때 다음 받기 · 알리기를 막지 않게.
// 저장 조각을 오가는 요청은 크고 폰에서 느려서 길게 (넘으면 오류: 저장은 다음 저장 때 다시, 서버가 그사이 받았으면 합쳐요)
export const KEEP_LIMIT = { short: 15_000, store: 60_000 };
async function http(path, body, ms = KEEP_LIMIT.short) {
    const headers = ctx().getRequestHeaders();
    const signal = typeof globalThis.AbortSignal?.timeout === 'function' ? globalThis.AbortSignal.timeout(ms) : undefined;
    const r = await fetch(PATH + path, body === undefined ? { headers, signal } : { method: 'POST', headers, body, signal });
    if (r.ok) return r.json();
    const err = new Error((await r.json().catch(() => ({})))?.error || `Orbit 저장 서버 오류 (${r.status})`);
    err.code = r.status;
    throw err;
}
const api = {
    ping: () => http('/ping'),
    load: id => http('/store/load', J({ id }), KEEP_LIMIT.store).catch(err => { if (err.code === 404) return null; throw err; }),
    rev: id => http('/store/rev', J({ id })).then(r => (Number.isInteger(r?.rev) ? r.rev : null)),
    // (the parts are JSON texts already: they go into the body as they are)
    save: (id, { base, chat, parts }) => http('/store/save', `{"id":${J(id)},"base":${J(base ?? null)},"chat":${J(chat || '')},"parts":{${Object.entries(parts).map(([k, s]) => `${J(k)}:${s ?? 'null'}`).join(',')}}}`, KEEP_LIMIT.store),
    fork: (from, to, { chat }) => http('/store/fork', J({ from, to, chat }), KEEP_LIMIT.store),
    drop: id => http('/store/drop', J({ id }), KEEP_LIMIT.store),
};
const now = () => (hasChat() ? { m: getMeta(), mark: ctx().chatMetadata?.integrity || '' } : null);

// 플러그인의 것을 받아 맞췄을 때마다 (받기 · 저장하다 부딪혀 합친 때 둘 다): 마리나라가 기억하는 방의 움직임을 다시 읽고, 화면에 알려요
//   'na-live-change' (다시 그리기) · 그사이 캐릭터가 먼저 건 말이 들어왔으면 'na-live-auto', detail: { from: 'server', rooms: [{ room, by: [이름], added, count }] }
const unseenOf = m => new Map(Object.values(m?.live?.world?.messenger?.rooms || {}).map(r => [r.id, r.autonomousUnreadCount > 0 ? Math.floor(r.autonomousUnreadCount) : 0]));
const synced = {
    // (how many messages a character wrote first were unseen in each room before: what the server added shows after)
    before: m => unseenOf(m),
    after(m, before = new Map()) {
        // (what Marinara's tracker remembers of the rooms is read from the rooms again: the messages the server's characters wrote first)
        for (const roomId of Object.keys(m.live?.world?.messenger?.rooms || {})) { try { reseedActivity(m, roomId); } catch { /* a room gone meanwhile */ } }
        try { globalThis.document?.dispatchEvent(new globalThis.CustomEvent('na-live-change')); } catch { /* no screen */ }
        const rooms = [];
        for (const r of Object.values(m.live?.world?.messenger?.rooms || {})) {
            const count = r.autonomousUnreadCount > 0 ? Math.floor(r.autonomousUnreadCount) : 0, added = count - (before.get(r.id) || 0);
            if (added > 0) rooms.push({ room: r.id, by: (Array.isArray(r.autonomousUnreadCharacterIds) ? r.autonomousUnreadCharacterIds : []).map(k => (r.members || []).find(n => String(n || '').trim().toLowerCase() === k) || k), added, count });
        }
        if (rooms.length) { try { globalThis.document?.dispatchEvent(new globalThis.CustomEvent('na-live-auto', { detail: { from: 'server', rooms } })); } catch { /* no screen */ } }
    },
};

export const keep = makeKeep({ api, now, synced });
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
// 일꾼이 쓴 것을 받아요 → 바뀌었으면 true (화면에 알리는 것은 synced.after)
export async function keepSync() {
    const m = hasChat() ? getMeta() : null;
    if (!m || !keep.kept()) return false;
    try { return await keep.sync(); }
    catch (err) { console.warn('[narrative-archive] Orbit 맞추기', err); return false; }
}

// ---- 세계 자물쇠 (마리나라의 채팅마다 하나뿐인 생성 자물쇠: generate.routes.ts activeGenerations, 둘째 요청은 409)
// 이 채팅의 Orbit에서 답장을 만들 수 있는 것은 한 번에 하나: 이 브라우저 아니면 서버 플러그인의 일꾼. 자물쇠는 일꾼이 갖고 있어요.
// 브라우저는 일하기 전에 받고(keepClaim), 일하는 동안 이어 잡고(keepRenew: 5분 동안 소식이 없으면 일꾼이 풀어요 — 탭이 닫혔을 때),
// 끝나면 놓아요. 일꾼이 쥐고 있으면 { ok: false }: 그 일은 일꾼이 끝낸 뒤에 해요.
// 플러그인이 없거나 옛것이거나 답하지 않으면 { ok: true } (전처럼 브라우저가 다 해요: 저장이 rev로 부딪힘을 막아요)
const TAB = `browser:${Math.random().toString(36).slice(2, 12)}`;
const holding = new Map();   // (저장 id → 이 페이지가 겹쳐 잡은 수: 안쪽에서 다시 잡아도 바깥이 놓을 때 놓아요)
export async function keepClaim() {
    const id = keep.id();
    if (!id) return { ok: true, release: () => {} };
    let r = null;
    try { r = await http('/auto/claim', J({ id, by: TAB })); } catch { r = null; }
    if (r && r.ok === false) return { ok: false, by: String(r.by || ''), release: () => {} };
    holding.set(id, (holding.get(id) || 0) + 1);
    let done = false;
    return {
        ok: true,
        release: () => {
            if (done) return;
            done = true;
            const n = (holding.get(id) || 1) - 1;
            if (n > 0) { holding.set(id, n); return; }
            holding.delete(id);
            http('/auto/release', J({ id, by: TAB })).catch(() => {});
        },
    };
}
// 잡고 있는 자물쇠를 이어 잡아요 (일이 길 때 답장 하나마다)
export async function keepRenew() {
    const id = keep.id();
    if (!id || !holding.has(id)) return;
    try { await http('/auto/claim', J({ id, by: TAB })); } catch { /* the next one tries again */ }
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
