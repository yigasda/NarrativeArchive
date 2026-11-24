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
    const head = parts?.live, need = name => { if (!(name in parts)) throw new Error('Orbit 저장 조각이 없습니다.'); return parts[name]; };
    if (!obj(head) || !obj(head.live)) throw new Error('Orbit 저장을 읽을 수 없습니다.');
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
                    if (!obj(got)) throw new Error('Orbit 저장을 읽을 수 없습니다.');
                    if (!Number.isInteger(got.chunks)) { w.messenger.rooms[id] = got.room; continue; }
                    const messages = [];
                    for (let k = 0; k < got.chunks; k++) { const c = need(`room/${id}/${k}`); if (!Array.isArray(c)) throw new Error('Orbit 저장을 읽을 수 없습니다.'); messages.push(...c); }
                    w.messenger.rooms[id] = { ...got.room, messages };
                }
            }
        }
        live.world = w;
    }
    if (head.archive) live.archive = need('archive');
    return live;
}

// ---- 서버 플러그인이 실리를 닫은 동안(또는 탭을 가려 둔 동안) 쓴 것과 맞추기
// 두 값이 같은가 (JSON으로 같은가)
const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
// id가 있는 것들의 목록인가 (방의 말 · 답장 줄): 이런 목록은 자리로가 아니라 id로 맞춰요
const idList = v => Array.isArray(v) && v.length > 0 && v.every(x => obj(x) && typeof x.id === 'string' && x.id);
// 셋을 비교해서 합쳐요 → 합친 값. base: 마지막으로 서버와 맞았던 것, server: 서버에 지금 있는 것, local: 브라우저에 지금 있는 것
//   한쪽만 바꾼 것은 바꾼 쪽의 것. 양쪽이 다 바꿨으면: 묶음(객체)은 안으로 들어가 칸마다 다시 비교, id 목록은 id로 합치고
//   (어느 쪽이 더한 것도 남고, 어느 쪽이 지운 것은 지워져요; 같은 것을 양쪽이 고쳤으면 서버 것), 나머지는 서버 것.
//   서버가 쓰는 것은 "새 말을 더하기"와 세는 수 · 표시라서, 브라우저에서 내가 보낸 말이 서버 것에 덮이지 않아요
export function merge3(base, server, local) {
    if (same(server, local)) return server;
    if (same(base, local)) return server;
    if (same(base, server)) return local;
    if (obj(server) && obj(local)) {
        const b = obj(base) ? base : {}, out = {};
        for (const k of new Set([...Object.keys(server), ...Object.keys(local)])) {
            const inS = Object.hasOwn(server, k), inL = Object.hasOwn(local, k), inB = Object.hasOwn(b, k);
            // (a key one side removed and the other left as it was: removed; removed by one and changed by the other: kept as changed)
            if (!inS && inB && same(b[k], local[k])) continue;
            if (!inL && inB && same(b[k], server[k])) continue;
            const v = !inL ? server[k] : !inS ? local[k] : merge3(b[k], server[k], local[k]);
            if (v !== undefined) out[k] = v;
        }
        return out;
    }
    if (Array.isArray(server) && Array.isArray(local) && (idList(server) || idList(local)) && [server, local].every(v => !v.length || idList(v))) {
        const B = new Map((idList(base) ? base : []).map(x => [x.id, x])), S = new Map(server.map(x => [x.id, x])), L = new Map(local.map(x => [x.id, x]));
        const out = [];
        // (the server's order; what only the browser has comes after, in the browser's order)
        for (const x of server) {
            if (!L.has(x.id)) { if (B.has(x.id) && same(B.get(x.id), x)) continue; out.push(x); continue; }   // (the browser removed it and the server left it alone: removed)
            out.push(merge3(B.get(x.id), x, L.get(x.id)));
        }
        for (const x of local) {
            if (S.has(x.id)) continue;
            if (B.has(x.id) && same(B.get(x.id), x)) continue;   // (the server removed it and the browser left it alone: removed)
            out.push(x);
        }
        return out;
    }
    return server;
}
// 합친 뒤 방의 말 순서와 번호를 바로잡아요: 말은 보낸 때 순서로, 번호(n)가 겹친 것은 브라우저에만 있던 말에 새 번호를 줘요.
// 서버가 가진 말의 번호는 그대로 둬요 (반영 · 요약이 그 번호로 읽은 자리를 기억해요)
export function settleRooms(live, serverLive) {
    const w = live?.world, rooms = w?.messenger?.rooms;
    if (!obj(rooms)) return live;
    const kept = new Set();
    for (const r of Object.values(serverLive?.world?.messenger?.rooms || {})) for (const x of Array.isArray(r?.messages) ? r.messages : []) if (x?.id) kept.add(x.id);
    let top = 0;
    for (const r of Object.values(rooms)) for (const x of Array.isArray(r?.messages) ? r.messages : []) if (kept.has(x?.id) && Number.isInteger(x.n)) top = Math.max(top, x.n);
    const fresh = [];
    for (const r of Object.values(rooms)) {
        if (!Array.isArray(r?.messages)) continue;
        r.messages = r.messages.map((x, i) => [x, i]).sort((a, b) => (Number(a[0]?.at) || 0) - (Number(b[0]?.at) || 0) || a[1] - b[1]).map(p => p[0]);
        for (const x of r.messages) if (obj(x) && !kept.has(x.id) && Number.isInteger(x.n)) fresh.push(x);
    }
    fresh.sort((a, b) => a.n - b.n || (Number(a.at) || 0) - (Number(b.at) || 0));
    for (const x of fresh) x.n = ++top;
    if (obj(w.messenger) && Number.isInteger(w.messenger.seq)) w.messenger.seq = Math.max(w.messenger.seq, top);
    return live;
}
// target을 source와 같은 값으로 만들어요, 있던 객체 · 목록은 그대로 둔 채로 (화면과 돌고 있는 답장이 쥐고 있는 것이 죽지 않게).
// id 목록은 같은 id의 객체를 다시 써요
export function into(target, source) {
    // (a value with no old one to fit into goes in as a copy: nothing of `source` is shared with `target`)
    const fresh = v => (v !== null && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);
    const fit = (old, v) => ((obj(old) && obj(v)) || (Array.isArray(old) && Array.isArray(v)) ? into(old, v) : fresh(v));
    if (Array.isArray(target)) {
        const olds = idList(target) && (idList(source) || !source.length) ? new Map(target.map(x => [x.id, x])) : null;
        const next = source.map((v, i) => fit(olds ? olds.get(v?.id) : target[i], v));
        target.length = 0;
        for (const v of next) target.push(v);
        return target;
    }
    for (const k of Object.keys(target)) if (!Object.hasOwn(source, k)) delete target[k];
    for (const k of Object.keys(source)) target[k] = fit(target[k], source[k]);
    return target;
}

// m.live를 "세지 않는" 자리로: 읽고 쓰는 것은 그대로, JSON으로 저장할 때만 빠져요
const hide = (m, live) => Object.defineProperty(m, 'live', { value: live, enumerable: false, writable: true, configurable: true });
const shown = m => Object.prototype.propertyIsEnumerable.call(m, 'live');
const restOf = m => sumOf(JSON.stringify(m));

// api: { ping() → { ok }, load(id) → { rev, chat, parts } | null, rev(id) → 수 | null, save(id, { base, chat, parts: { 이름: JSON 글 | null } }) → { rev }
//        (그사이 다른 곳에서 저장했으면 code 409인 오류), fork(from, to, { chat }) → { rev }, drop(id) }
// now(): 지금 열린 채팅의 { m (우리 메타), mark (실리가 채팅마다 주는 표시: 분기하면 달라져요) } | null
// synced: { before(m) → 표, after(m, 표) } 플러그인의 것을 받아 m.live에 맞춘 때마다 (받기 · 저장하다 부딪혀 합친 때 둘 다):
//   before는 맞추기 전에, after는 맞춘 뒤에 불러요 (화면에 알리기 · 먼저 건 말 알림)
// prep(live) → live: 합치기 전에 서버 것과 base(마지막으로 맞았던 것)에 해요 (읽는 쪽이 메모리에서 하는 옛 저장 옮기기를 셋에 똑같이:
//   안 하면 양쪽이 처음 옮긴 같은 값을 "둘 다 새로 넣었다"고 보고 서버 것을 골라, 그사이 브라우저에서 바꾼 것이 되돌아가요).
//   받은 값을 고치지 말고 새 값을 돌려줘요. 이 파일은 무엇을 옮기는지 몰라요 (phone2keepon.js가 줘요)
export function makeKeep({ api, now, synced = null, prep = x => x }) {
    let cur = null;
    // (채팅을 열 때마다 물어봐요: 잠깐 끊겼다가 돌아올 수 있어요)
    const plugin = () => Promise.resolve().then(() => api.ping()).then(x => !!x?.ok, () => false);

    // 채팅을 열 때: 플러그인에 둔 것이면 읽어서 m.live에 붙여요. 채팅 파일에 든 것이면 플러그인으로 옮겨요
    function open(m, mark = '') {
        // (texts: each part as it was when the browser and the plugin last agreed — what a merge compares against)
        const st = { m, mark: String(mark || ''), id: '', rev: null, sums: new Map(), texts: new Map(), rest: null, state: 'loading', error: null, line: Promise.resolve() };
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
                    for (const [name, v] of Object.entries(got.parts)) { const s = JSON.stringify(v); st.sums.set(name, sumOf(s)); st.texts.set(name, s); }
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
            if (st.id) { const id = st.id; st.id = ''; st.rev = null; st.sums = new Map(); st.texts = new Map(); delete m.liveRef; await api.drop(id); }
            return;
        }
        const live = m.live;
        if (!obj(live) || live.v !== 1) return;   // (못 읽는 자리는 그대로 둬요)
        if (st.id) hide(m, live);
        // (the plugin has something newer — the server wrote while the tab was hidden, or just after I came back: taken in
        //  and merged with what is only here, then sent again. Twice at most: a third clash in a row is told as an error)
        for (let tries = 0; ; tries++) {
            const send = {}, sums = new Map(), texts = new Map();
            for (const [name, v] of Object.entries(splitLive(m.live))) {
                const s = JSON.stringify(v), h = sumOf(s);
                sums.set(name, h); texts.set(name, s);
                if (st.sums.get(name) !== h) send[name] = s;
            }
            for (const name of st.sums.keys()) if (!sums.has(name)) send[name] = null;
            if (!Object.keys(send).length) break;
            const id = st.id || newId();
            let got;
            try { got = await api.save(id, { base: st.id ? st.rev : null, chat: st.mark, parts: send }); }
            catch (err) {
                if (err?.code !== 409) throw err;
                if (!st.id || tries >= 2 || !await syncNow(st)) throw new Error('Orbit 데이터가 다른 곳에서 변경되었습니다. 채팅을 다시 여세요.');
                continue;
            }
            st.id = id; st.rev = got.rev; st.sums = sums; st.texts = texts;
            break;
        }
        if (!st.id) return;
        if (m.liveRef?.id !== st.id) m.liveRef = { id: st.id };
        if (shown(m)) hide(m, m.live);
    }
    const push = st => (st.line = st.line.catch(() => {}).then(() => pushNow(st)));
    // 플러그인에 더 새 것이 있으면 받아서 m.live에 맞춰요 → 바뀌었으면 true. 브라우저에만 있는 것(아직 못 보낸 내 말 등)은 합쳐서 남겨요
    async function syncNow(st) {
        const m = st.m;
        if (st.state !== 'ok' || !st.id || !obj(m.live)) return false;
        const rev = await api.rev(st.id);
        if (rev === null || rev === st.rev) return false;
        const got = await api.load(st.id);
        if (!got) return false;
        const server = prep(joinLive(got.parts)), mine = new Map(Object.entries(splitLive(m.live)).map(([k, v]) => [k, JSON.stringify(v)]));
        const dirty = mine.size !== st.texts.size || [...mine].some(([k, s]) => st.texts.get(k) !== s);
        let next = server, mark;
        try { mark = synced?.before?.(m); } catch (err) { console.warn('[narrative-archive] Orbit 맞추기 전', err); }
        if (dirty) {
            // (the same world on both sides: merged against what the two last agreed on. Another world — I began a new
            //  Orbit here meanwhile —: mine is kept whole and goes up over the plugin's)
            if (obj(server.world) && obj(m.live.world) && server.world.id === m.live.world.id) {
                const base = prep(joinLive(Object.fromEntries([...st.texts].map(([k, s]) => [k, JSON.parse(s)]))));
                next = settleRooms(merge3(base, server, JSON.parse(JSON.stringify(m.live))), server);
            } else next = null;
        }
        if (next) into(m.live, next);
        st.rev = got.rev; st.sums = new Map(); st.texts = new Map();
        for (const [name, v] of Object.entries(got.parts)) { const s = JSON.stringify(v); st.sums.set(name, sumOf(s)); st.texts.set(name, s); }
        if (next) { try { synced?.after?.(m, mark); } catch (err) { console.warn('[narrative-archive] Orbit 맞춘 뒤', err); } }
        return true;
    }
    // (in the same line as the saves: never in the middle of one)
    const sync = () => { const at = now(); if (!cur || !at || cur.m !== at.m) return Promise.resolve(false); const st = cur; const run = st.line.catch(() => {}).then(() => syncNow(st)); st.line = run.catch(() => {}); return run; };
    const idOf = () => { const at = now(); return cur && at && cur.m === at.m && cur.state === 'ok' ? cur.id : ''; };

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
    return { open, onSave, state, ready, kept, sync, id: idOf, error: () => cur?.error || null };
}
