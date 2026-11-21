// 폰 2(Orbit) 데이터를 실리 채팅 파일 밖에 두기 (docs/PHONE2-PLAN.md "서버 플러그인").
// 서버 플러그인(plugin/)이 있으면 m.live를 조각으로 나눠 플러그인에 두고, 바뀐 조각만 보내요.
// 채팅 파일에는 m.liveRef = { id }만 남아요: m.live는 "세지 않는" 자리로 바꿔서 실리가 저장할 때 안 들어가요.
//   그래서 Orbit에서 말 하나를 보내도 실리가 롤플 채팅을 통째로 다시 쓰지 않아요.
// 플러그인이 없으면 아무것도 안 해요: 지금처럼 m.live가 채팅 파일에 들어가요.
// 플러그인에 둔 채팅(m.liveRef가 있음)을 플러그인 없이 열면 m.live가 비어 있어요. 그때는 새로 만들지도 않아요
//   (폰 2 저장 파일의 ensureLive가 막아요): 플러그인을 다시 켜면 그대로 돌아와요.
// 이 파일은 실리 · 화면을 몰라요(연결은 phone2keepon.js). 폰 1 · 아카이브는 읽지도 쓰지도 않아요.

// chunk: 방의 말을 이만큼씩 한 조각으로 (새 말이 오면 마지막 조각만 다시 보내요)
export const KEEP = { chunk: 200 };

const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const newId = () => `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
// a JSON text's mark: its length and two different sums (the same text → the same mark)
export function sumOf(s) {
    let a = 5381, b = 52711;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = ((a * 33) ^ c) >>> 0; b = (Math.imul(b, 31) + c) >>> 0; }
    return `${s.length}.${a.toString(36)}.${b.toString(36)}`;
}

// m.live → 조각들 { 이름: 값 }
//   live            { live: 나머지, world: 세계의 나머지, phones: [폰 열쇠…] | null, rooms: [방 id…] | null, archive: 있나 }
//   phone/<열쇠>     폰 하나
//   room/<id>       { room: 말을 뺀 방, chunks: 말 조각 수 }  (말이 배열이 아니면 { room: 방 그대로 })
//   room/<id>/<k>   말 조각 (KEEP.chunk개씩)
//   archive         예전 세계들
export function splitLive(live) {
    const parts = {}, { world, archive, ...top } = live;
    const head = { live: top, archive: archive !== undefined, phones: null, rooms: null };
    if (archive !== undefined) parts.archive = archive;
    if ('world' in live) {
        if (!obj(world)) head.world = world;
        else {
            const w = { ...world };
            if (obj(world.phones)) {
                head.phones = Object.keys(world.phones); delete w.phones;
                for (const k of head.phones) parts[`phone/${k}`] = world.phones[k];
            }
            if (obj(world.messenger) && obj(world.messenger.rooms)) {
                const rooms = world.messenger.rooms;
                head.rooms = Object.keys(rooms); w.messenger = { ...world.messenger }; delete w.messenger.rooms;
                for (const id of head.rooms) {
                    const room = rooms[id];
                    if (!obj(room) || !Array.isArray(room.messages)) { parts[`room/${id}`] = { room }; continue; }
                    const { messages, ...rest } = room, n = Math.ceil(messages.length / KEEP.chunk);
                    parts[`room/${id}`] = { room: rest, chunks: n };
                    for (let k = 0; k < n; k++) parts[`room/${id}/${k}`] = messages.slice(k * KEEP.chunk, (k + 1) * KEEP.chunk);
                }
            }
            head.world = w;
        }
    }
    parts.live = head;
    return parts;
}
// 조각들 → m.live (빠진 조각이 있으면 오류: 모자란 채로 쓰지 않아요)
export function joinLive(parts) {
    const head = parts?.live, need = name => { if (!(name in parts)) throw new Error('Orbit 저장 조각이 빠졌어요'); return parts[name]; };
    if (!obj(head) || !obj(head.live)) throw new Error('Orbit 저장을 읽을 수 없어요');
    const live = { ...head.live };
    if ('world' in head) {
        let w = head.world;
        if (obj(w)) {
            w = { ...w };
            if (Array.isArray(head.phones)) { w.phones = {}; for (const k of head.phones) w.phones[k] = need(`phone/${k}`); }
            if (Array.isArray(head.rooms)) {
                w.messenger = { ...w.messenger, rooms: {} };
                for (const id of head.rooms) {
                    const got = need(`room/${id}`);
                    if (!obj(got)) throw new Error('Orbit 저장을 읽을 수 없어요');
                    if (!Number.isInteger(got.chunks)) { w.messenger.rooms[id] = got.room; continue; }
                    const messages = [];
                    for (let k = 0; k < got.chunks; k++) { const c = need(`room/${id}/${k}`); if (!Array.isArray(c)) throw new Error('Orbit 저장을 읽을 수 없어요'); messages.push(...c); }
                    w.messenger.rooms[id] = { ...got.room, messages };
                }
            }
        }
        live.world = w;
    }
    if (head.archive) live.archive = need('archive');
    return live;
}

// m.live를 "세지 않는" 자리로: 읽고 쓰는 것은 그대로, JSON으로 저장할 때만 빠져요
const hide = (m, live) => Object.defineProperty(m, 'live', { value: live, enumerable: false, writable: true, configurable: true });
const shown = m => Object.prototype.propertyIsEnumerable.call(m, 'live');
const restOf = m => sumOf(JSON.stringify(m));

// api: { ping() → { ok }, load(id) → { rev, chat, parts } | null, save(id, { base, chat, parts: { 이름: JSON 글 | null } }) → { rev }
//        (그사이 다른 곳에서 저장했으면 code 409인 오류), fork(from, to, { chat }) → { rev }, drop(id) }
// now(): 지금 열린 채팅의 { m (우리 메타), mark (실리가 채팅마다 주는 표시: 분기하면 달라져요) } | null
export function makeKeep({ api, now }) {
    let cur = null;
    // (채팅을 열 때마다 물어봐요: 잠깐 끊겼다가 돌아올 수 있어요)
    const plugin = () => Promise.resolve().then(() => api.ping()).then(x => !!x?.ok, () => false);

    // 채팅을 열 때: 플러그인에 둔 것이면 읽어서 m.live에 붙여요. 채팅 파일에 든 것이면 플러그인으로 옮겨요
    function open(m, mark = '') {
        const st = { m, mark: String(mark || ''), id: '', rev: null, sums: new Map(), rest: null, state: 'loading', error: null, line: Promise.resolve() };
        cur = st;
        st.ready = (async () => {
            if (!obj(m)) { st.state = 'none'; return; }
            const ref = obj(m.liveRef) && typeof m.liveRef.id === 'string' ? m.liveRef.id : '';
            if (!await plugin()) { st.state = ref ? 'off' : 'none'; return; }
            let dirty = shown(m);
            if (ref) {
                let got = await api.load(ref), id = ref;
                // (a branch carries its parent's liveRef: it takes its own copy, the parent's stays the parent's)
                if (got && st.mark && got.chat && got.chat !== st.mark) {
                    id = newId();
                    got = { ...got, rev: (await api.fork(ref, id, { chat: st.mark })).rev };
                }
                if (got) {
                    const live = joinLive(got.parts);
                    hide(m, live); st.id = id; st.rev = got.rev;
                    for (const [name, v] of Object.entries(got.parts)) st.sums.set(name, sumOf(JSON.stringify(v)));
                    if (id !== ref) { m.liveRef = { id }; dirty = true; }
                } else if (!shown(m)) { delete m.liveRef; dirty = true; console.warn('[narrative-archive] Orbit 저장을 찾을 수 없어요', ref); }
            }
            st.state = 'ok';
            await pushNow(st);
            if (!dirty && !shown(m)) st.rest = restOf(m);
        })().catch(err => { st.state = 'error'; st.error = err; console.warn('[narrative-archive] Orbit 저장 읽기', err); });
        return st.ready;
    }

    // 바뀐 조각만 보내요 (처음이면 통째로 옮겨요). 보낸 뒤에는 m.live가 채팅 파일에 안 들어가요
    async function pushNow(st) {
        const m = st.m;
        if (st.state !== 'ok') return;
        if (!Object.hasOwn(m, 'live') || m.live === undefined) {
            // (폰 2를 통째로 지웠어요: 플러그인의 것도 지워요)
            if (st.id) { const id = st.id; st.id = ''; st.rev = null; st.sums = new Map(); delete m.liveRef; await api.drop(id); }
            return;
        }
        const live = m.live;
        if (!obj(live) || live.v !== 1) return;   // (못 읽는 자리는 그대로 둬요)
        if (st.id) hide(m, live);
        const send = {}, sums = new Map();
        for (const [name, v] of Object.entries(splitLive(live))) {
            const s = JSON.stringify(v), h = sumOf(s);
            sums.set(name, h);
            if (st.sums.get(name) !== h) send[name] = s;
        }
        for (const name of st.sums.keys()) if (!sums.has(name)) send[name] = null;
        if (Object.keys(send).length) {
            const id = st.id || newId();
            let got;
            try { got = await api.save(id, { base: st.id ? st.rev : null, chat: st.mark, parts: send }); }
            catch (err) { if (err?.code === 409) throw new Error('Orbit 데이터가 다른 곳에서 바뀌었어요. 채팅을 다시 열어 주세요'); throw err; }
            st.id = id; st.rev = got.rev; st.sums = sums;
        }
        if (!st.id) return;
        if (m.liveRef?.id !== st.id) m.liveRef = { id: st.id };
        if (shown(m)) hide(m, m.live);
    }
    const push = st => (st.line = st.line.catch(() => {}).then(() => pushNow(st)));

    // core.js saveMeta가 실리 저장 앞에 불러요 → null (평소대로 저장) | { skip (실리 저장을 건너뛰어도 돼요), error, saved() }
    async function onSave() {
        const at = now();
        if (!at || !obj(at.m)) return null;
        if (!cur || cur.m !== at.m) open(at.m, at.mark);
        const st = cur;
        await st.ready;
        if (st.state !== 'ok') return null;
        let error = null;
        try { await push(st); } catch (err) { error = err; }
        const rest = restOf(st.m);
        // (only a chat kept in the plugin skips: its other data is as the chat file has it)
        return { skip: !!st.id && !shown(st.m) && st.rest === rest, error, saved: () => { st.rest = rest; } };
    }

    // 지금 채팅: 'none' (채팅이 없거나 플러그인이 없어요) | 'loading' | 'ok' | 'off' (플러그인에 둔 채팅인데 플러그인이 꺼져 있어요) | 'error'
    const state = () => { const at = now(); return cur && at && cur.m === at.m ? cur.state : 'none'; };
    const ready = () => { const at = now(); if (at && obj(at.m) && (!cur || cur.m !== at.m)) open(at.m, at.mark); return cur?.ready || Promise.resolve(); };
    const kept = () => { const at = now(); return !!(cur && at && cur.m === at.m && cur.state === 'ok' && cur.id); };
    return { open, onSave, state, ready, kept, error: () => cur?.error || null };
}
