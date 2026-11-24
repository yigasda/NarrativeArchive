// phone2keep.js를 실리에 잇기: 플러그인으로 가는 요청, 채팅이 바뀔 때 읽기, core.js saveMeta 앞에 끼우기.
// index.js가 keepStart()를 한 번 불러요.

import { MODULE, ctx, getMeta, hasChat, saveMeta, setSaveHook } from './core.js';
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
    const err = new Error((await r.json().catch(() => ({})))?.error || `서버 오류 (${r.status})`);
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
const seenOf = m => new Map(Object.values(m?.live?.world?.messenger?.rooms || {}).map(r => [r.id, new Set((r.messages || []).map(x => x.id))]));
const synced = {
    // (how many messages a character wrote first were unseen in each room before, and which messages were there: what the server added shows after)
    before: m => ({ unseen: unseenOf(m), seen: seenOf(m) }),
    after(m, mark = {}) {
        const before = mark.unseen || new Map(), seen = mark.seen || new Map();
        // (what Marinara's tracker remembers of the rooms is read from the rooms again: the messages the server's characters wrote first)
        for (const roomId of Object.keys(m.live?.world?.messenger?.rooms || {})) { try { reseedActivity(m, roomId); } catch { /* a room gone meanwhile */ } }
        try { globalThis.document?.dispatchEvent(new globalThis.CustomEvent('na-live-change')); } catch { /* no screen */ }
        const rooms = [];
        for (const r of Object.values(m.live?.world?.messenger?.rooms || {})) {
            const count = r.autonomousUnreadCount > 0 ? Math.floor(r.autonomousUnreadCount) : 0, added = count - (before.get(r.id) || 0);
            if (added > 0) rooms.push({ room: r.id, by: (Array.isArray(r.autonomousUnreadCharacterIds) ? r.autonomousUnreadCharacterIds : []).map(k => (r.members || []).find(n => String(n || '').trim().toLowerCase() === k) || k), added, count });
        }
        if (rooms.length) { try { globalThis.document?.dispatchEvent(new globalThis.CustomEvent('na-live-auto', { detail: { from: 'server', rooms } })); } catch { /* no screen */ } }
        // (a reply the server wrote while I was away — a late reply, not one written first: the same cue as the browser's own
        //  finished reply, 'na-live-reply' from the reply loop. Marinara's server writes it too: a closed page does not stop a
        //  reply — generate.routes.ts 1924~1934 — and the page gets it when it reads the chat again)
        const persona = String(m.live?.world?.persona || '').trim().toLowerCase();
        for (const r of Object.values(m.live?.world?.messenger?.rooms || {})) {
            const had = seen.get(r.id);
            if (!had) continue;
            const fresh = (r.messages || []).filter(x => !had.has(x.id) && String(x.from || '').trim().toLowerCase() !== persona && String(x.text || '').trim() && !x.extra?.autonomous);
            if (!fresh.length) continue;
            const by = [...new Set(fresh.map(x => x.from))];
            const cue = () => { try { globalThis.document?.dispatchEvent(new globalThis.CustomEvent('na-live-reply', { detail: { from: 'server', room: r.id, by, auto: false, regen: false } })); } catch { /* no screen */ } };
            // (the server translates a reply after it is saved — automatic translation, phone2translate.js —: the completion cue waits
            //  for it and for its save, as Marinara's does — use-generate.ts 3894~3906 waitForServerTranslationToSettle)
            // (another chat opened meanwhile: the cue still goes, for that room — Marinara's completion notifications always run once
            //  the wait is over, use-generate.ts 3896~3906 .finally)
            if (fresh.some(translationOwed)) waitForServerTranslationToSettle(r.id).then(cue, cue); else cue();
        }
    },
};
// (a message whose automatic translation the server took on and has not saved yet)
const translationOwed = x => typeof x.extra?.automaticTranslationSource === 'string' && !(typeof x.extra.translation === 'string' && x.extra.translation && x.extra.translationSource === x.text && x.extra.automaticTranslationSource === x.text);
// 마리나라 use-generate.ts waitForServerTranslationToSettle (1126~1141): 서버의 그 방 번역이 끝날 때까지(최대 30분) 1.5초마다 물어보고
// (/auto/status의 translating: plugin/work.mjs), 끝나면 그 저장을 받아요. 묻다가 실패해도 계속 물어요(다시 연결되는 동안)
//   묻는 저장은 시작할 때의 것 하나예요 (마리나라: 그 채팅의 id). 그사이 다른 채팅을 열어도 그 저장을 끝까지 물어요(마리나라처럼).
//   끝나면 그 채팅이 그대로일 때만 받아요(받는 것은 지금 채팅의 것이라서) → 받았으면 true, 다른 채팅이면 false. 알림은 부르는 쪽이 늘 해요
export const TRANSLATION_SETTLE = { pollMs: 1_500, maxMs: 30 * 60_000 };
export async function waitForServerTranslationToSettle(room, { wait = ms => new Promise(r => setTimeout(r, ms)), now = () => Date.now() } = {}) {
    const startedAt = now(), id = keep.id();
    while (now() - startedAt < TRANSLATION_SETTLE.maxMs) {
        try {
            if (!id) break;
            const status = await http('/auto/status', J({ id }));
            const row = (Array.isArray(status?.rooms) ? status.rooms : []).find(x => x?.room === room);
            if (!row?.translating) break;
        } catch {
            // Keep the independent completion notification pending through a reconnect.
        }
        await wait(TRANSLATION_SETTLE.pollMs);
    }
    if (keep.id() !== id) return false;
    await keepSync();
    return true;
}

export const keep = makeKeep({ api, now, synced });
// 지금 채팅의 Orbit 데이터를 다 읽었을 때 끝나는 약속 (플러그인이 없으면 바로)
export const liveReady = () => keep.ready();
export const keepState = () => keep.state();

// 지금 채팅의 Orbit 데이터가 플러그인에 있나 (있어야 서버가 실리를 닫은 동안 돌릴 수 있어요)
export const keepKept = () => keep.kept();

// ---- 서버 플러그인과 번갈아 돌기 (docs/PHONE2-PLAN.md "서버 플러그인" 3-3)
// 플러그인의 일꾼은 마리나라의 서버처럼 돌아요:
//   - 늦은 답장은 때가 되면 일꾼이 바로 보내요. 브라우저가 보고 있어도요 (마리나라는 서버가 그 요청 안에서 기다렸다가 보내요:
//     conversation-presence-runtime.ts 254~321, 연결이 끊겨도 계속 — generate.routes.ts 1924~1934). 한 방에 둘이 같이 쓰지 않게
//     방 자물쇠를 잡아요 (아래)
//   - 먼저 말 걸기: 브라우저는 보이는 동안 30초마다 "내가 보고 있어요"를 알려요 (keepBeat). 일꾼의 스케줄러는 그 뒤 75초 동안
//     이 채팅에 먼저 말을 걸지 않아요 (마리나라의 RECENT_CLIENT_PRESENCE_MS). 가려지면 알리지 않아요 (마리나라의 폴링도 가려지면 쉬어요)
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

// ---- 방 자물쇠 (plugin/lock.mjs: 마리나라의 채팅마다 하나뿐인 생성 자물쇠 activeGenerations — 걸려 있으면 둘째 요청은 409)
// 이 채팅의 Orbit에서 한 방의 답장을 만들 수 있는 것은 한 번에 하나: 이 브라우저 탭 아니면 서버 플러그인의 일꾼. 자물쇠는 일꾼이 갖고 있어요.
// 브라우저는 그 방에서 일하기 전에 받고(keepClaim), 일하는 동안 이어 잡고(keepRenew: 5분 동안 소식이 없으면 일꾼이 풀어요 — 탭이 닫혔을 때),
// 끝나면 놓아요. 일꾼이 쥐고 있으면 { ok: false }: 그 방의 일은 일꾼이 끝낸 뒤에 해요.
// 플러그인이 없거나 옛것이거나 답하지 않으면 { ok: true } (전처럼 브라우저가 다 해요: 저장이 rev로 부딪힘을 막아요)
const TAB = `browser:${Math.random().toString(36).slice(2, 12)}`;
const holding = new Map();   // ('저장 id/방 id' → { id, room, n: 이 페이지가 겹쳐 잡은 수 }: 이어 잡을 것)
const free = { ok: true, release: () => {} };
export async function keepClaim(room) {
    const id = keep.id();
    room = String(room || '');
    if (!id || !room) return free;
    let r = null;
    try { r = await http('/auto/claim', J({ id, room, by: TAB })); } catch { r = null; }
    if (r && r.ok === false) return { ok: false, by: String(r.by || ''), release: () => {} };
    // (no answer from the plugin: nothing is held there, nothing to let go)
    if (!r) return free;
    const key = `${id}/${room}`, had = holding.get(key);
    if (had) had.n += 1; else holding.set(key, { id, room, n: 1 });
    let done = false;
    return {
        ok: true,
        release: () => {
            if (done) return;
            done = true;
            const h = holding.get(key);
            if (h && (h.n -= 1) <= 0) holding.delete(key);
            http('/auto/release', J({ id, room, by: TAB })).catch(() => {});
        },
    };
}
// 잡고 있는 방들을 이어 잡아요 (일이 길 때: 답장 하나마다)
export async function keepRenew() {
    await Promise.all([...holding.values()].map(h => http('/auto/claim', J({ id: h.id, room: h.room, by: TAB, renew: true })).catch(() => {})));
}
// 이 브라우저의 시간대 · 언어를 확장 설정에 적어요 (extension_settings.narrative_archive.device: { timeZone, locale, intl, isMobile }).
// 서버 플러그인의 일꾼이 그 시간대 · 언어로 돌아요(plugin/work.mjs useDevice · plugin/zone.mjs): 실리 매크로 {{time}} · {{date}} …가 이 페이지와 같게.
// isMobile: 실리 isMobile()(RossAscends-mods.js 143~147, getContext().isMobile) — 서버의 {{isMobile}}이 이 값이에요(plugin/st/namacros.js). 실리에 없으면 안 적어요.
// 바뀌었을 때만 저장해요(실리 saveSettingsDebounced → settings.json). 확장 설정이 아직 없으면(처음 켠 때) 다음 번에
export function keepDevice() {
    try {
        const c = ctx(), es = c.extensionSettings, g = es?.[MODULE];
        if (!g || typeof g !== 'object') return false;
        const o = Intl.DateTimeFormat().resolvedOptions();
        const now = { timeZone: String(o.timeZone || ''), locale: String(c.getCurrentLocale?.() || ''), intl: String(o.locale || '') };
        if (typeof c.isMobile === 'function') now.isMobile = c.isMobile() === true;
        const had = g.device;
        if (had && typeof had === 'object' && had.timeZone === now.timeZone && had.locale === now.locale && had.intl === now.intl && had.isMobile === now.isMobile) return false;
        g.device = now;
        c.saveSettingsDebounced?.();
        return true;
    } catch (err) { console.warn('[narrative-archive] device', err); return false; }
}
let beating = null;
// 30초마다 · 탭이 다시 보일 때 · 채팅을 열 때
export function keepBeat() {
    keepDevice();
    if (beating) return beating;
    beating = (async () => {
        await keep.ready();
        if (hidden()) return;
        await keepPing();
        await keepSync();
        // (an Orbit begun since the chat was opened: its persona is written too)
        await keepPersona();
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

// 이 채팅의 페르소나 (실리 personas.js의 user_avatar: 아바타 파일 이름)를 채팅에 적어 둬요: 서버는 실리를 닫은 동안에도 그 채팅에서
// 마지막으로 쓴 페르소나로 답해요 (plugin/work.mjs). 빠른 전환기로 바꿀 때(PERSONA_CHANGED)와, 채팅을 열 때 실리가 고른 것
// (실리의 CHAT_CHANGED 처리 loadPersonaForCurrentChat이 먼저 끝나요: 실리의 이벤트는 차례로 기다려요)
// 플러그인에 둔 Orbit이 이 탭에서 다 열린 채팅만(keep.kept): 채팅을 여는 중에 실리가 페르소나를 바꾸면(PERSONA_CHANGED가 우리
// CHAT_CHANGED보다 먼저 와요) 그때는 안 적어요 — 그 저장이 Orbit을 한 번 더 열어 저장이 둘 생길 수 있었어요. 열고 나면
// keepBeat가 적어요. 달라졌을 때만 저장해요
let stPersonas = null;
const personasModule = async () => { if (!stPersonas && typeof window !== 'undefined') { try { stPersonas = await import('/scripts/personas.js'); } catch { stPersonas = null; } } return stPersonas; };
export async function keepPersona(avatar = null) {
    if (!hasChat()) return false;
    if (!keep.kept()) return false;
    const m = getMeta();
    if (!m) return false;
    const a = typeof avatar === 'string' && avatar ? avatar : (await personasModule())?.user_avatar;
    if (typeof a !== 'string' || !a || m.stPersona === a) return false;
    m.stPersona = a;
    await saveMeta();
    return true;
}
const notePersona = avatar => { keepPersona(avatar).catch(err => console.warn('[narrative-archive] persona', err)); };

let started = false;
export function keepStart() {
    if (started) return;
    started = true;
    setSaveHook(() => keep.onSave());
    const c = ctx(), et = c.eventTypes || c.event_types;
    const open = () => { const at = now(); if (at) keep.open(at.m, at.mark); };
    c.eventSource.on(et.CHAT_CHANGED, () => { open(); serves = false; keepBeat(); });
    if (et.PERSONA_CHANGED) c.eventSource.on(et.PERSONA_CHANGED, avatar => notePersona(avatar));
    open();
    keepBeat();
    // (.unref: only there in Node — the tests — so the timer does not keep the process up; a browser's timer is a number)
    globalThis.setInterval(keepBeat, KEEP_BEAT_MS)?.unref?.();
    globalThis.document?.addEventListener?.('visibilitychange', () => { if (!hidden()) keepBeat(); });
}
