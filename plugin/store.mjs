// 서버 플러그인의 저장: Orbit(실시간 폰) 데이터를 실리 채팅 파일 밖에, 조각으로 나눠 둬요.
// 채팅 파일에 넣어 두면 말 하나를 저장해도 실리가 롤플 채팅을 통째로 다시 써서 폰에서 몇 초씩 걸렸어요.
// 여기서는 바뀐 조각만 받아서 그 파일만 다시 써요.
//   <사용자 폴더>/NarrativeArchive/orbit/<id>/index.json   { v, rev, chat, at, parts: { 조각 이름: 파일 이름 } }
//   <사용자 폴더>/NarrativeArchive/orbit/<id>/<파일>.json   조각 하나 (JSON 값)
// rev: 저장할 때마다 1씩 올라가요. 저장하는 쪽이 자기가 본 rev(base)를 같이 보내고, 그사이 다른 쪽이 저장했으면
// (rev가 다르면) 거절해요: 브라우저와 서버가 서로의 것을 덮어쓰지 않아요.
// 이 파일은 파일만 다뤄요(실리 · 익스프레스를 몰라요). 그래서 테스트에서 임시 폴더로 그대로 돌려요.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const STORE = { v: 1, idMax: 80, nameMax: 200, parts: 5000 };
const ID = /^[A-Za-z0-9_-]{1,80}$/;

export class StoreError extends Error {
    constructor(code, message, extra = {}) { super(message); this.code = code; Object.assign(this, extra); }
}
const bad = (msg) => new StoreError(400, msg);
const idOf = id => { const s = String(id ?? ''); if (!ID.test(s)) throw bad('잘못된 저장 이름입니다.'); return s; };
// a part's file: its name hashed (any name is a safe file name, the same name the same file)
const fileOf = name => `p_${crypto.createHash('sha1').update(String(name)).digest('hex').slice(0, 24)}.json`;
const nameOk = name => typeof name === 'string' && name.length > 0 && name.length <= STORE.nameMax;

// one at a time per store (a second save waits for the first: two would read the same rev)
const lines = new Map();
function inLine(key, job) {
    const before = lines.get(key) || Promise.resolve();
    const mine = before.catch(() => {}).then(job);
    const tail = mine.catch(() => {});
    lines.set(key, tail);
    tail.then(() => { if (lines.get(key) === tail) lines.delete(key); });
    return mine;
}
// a file written whole or not at all (written beside itself, then moved over)
async function writeWhole(file, text) {
    const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    await fs.writeFile(tmp, text, 'utf8');
    await fs.rename(tmp, file);
}
const readJson = async file => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (err) { if (err?.code === 'ENOENT') return undefined; throw err; } };

export function openStore(root) {
    const base = path.join(String(root), 'NarrativeArchive', 'orbit');
    // 이 저장에 쓴 횟수 (저장 · 복사 · 지우기마다 1): 먼저 말 걸기 스케줄러가 "그사이 바뀐 것이 없으면 다시 훑지 않기"에 써요
    let writes = 0;
    const dirOf = id => path.join(base, idOf(id));
    const indexOf = async id => { const x = await readJson(path.join(dirOf(id), 'index.json')); return x && x.v === STORE.v && Number.isInteger(x.rev) && x.parts && typeof x.parts === 'object' ? x : null; };

    // 통째로 읽기 → { rev, chat, parts: { 이름: 값 } } | null (없는 저장)
    async function load(id) {
        return inLine(dirOf(id), async () => {
            const ix = await indexOf(id);
            if (!ix) return null;
            const parts = {};
            for (const [name, file] of Object.entries(ix.parts)) { const v = await readJson(path.join(dirOf(id), file)); if (v !== undefined) parts[name] = v; }
            return { rev: ix.rev, chat: ix.chat || '', parts };
        });
    }
    // 지금 rev만 → 수 | null
    async function revOf(id) { return inLine(dirOf(id), async () => (await indexOf(id))?.rev ?? null); }

    // 바뀐 조각 저장. parts: { 이름: 값 (null이면 그 조각을 지워요) }; base: 내가 본 rev (처음 만들 때는 null);
    // chat: 이 저장이 어느 채팅의 것인지 (실리가 채팅마다 주는 표시) → { rev }
    // 그사이 다른 쪽이 저장했으면 StoreError 409 (rev: 지금 것), 아무것도 안 바꿔요
    async function save(id, { base = null, parts = {}, chat = undefined } = {}) {
        if (!parts || typeof parts !== 'object' || Array.isArray(parts)) throw bad('저장할 조각이 없습니다.');
        const names = Object.keys(parts);
        if (!names.every(nameOk)) throw bad('잘못된 조각 이름입니다.');
        return inLine(dirOf(id), async () => {
            const dir = dirOf(id), ix = await indexOf(id);
            if ((ix ? ix.rev : null) !== (base === undefined ? null : base)) throw new StoreError(409, '다른 곳에서 먼저 저장되었습니다.', { rev: ix ? ix.rev : null });
            const next = ix ? { ...ix, parts: { ...ix.parts } } : { v: STORE.v, rev: 0, chat: '', parts: {} };
            await fs.mkdir(dir, { recursive: true });
            const gone = [];
            for (const name of names) {
                const v = parts[name];
                if (v === null || v === undefined) { if (next.parts[name]) { gone.push(next.parts[name]); delete next.parts[name]; } continue; }
                const file = next.parts[name] || fileOf(name);
                await writeWhole(path.join(dir, file), JSON.stringify(v));
                next.parts[name] = file;
            }
            if (Object.keys(next.parts).length > STORE.parts) throw bad('조각이 너무 많습니다.');
            next.rev += 1; next.at = Date.now();
            if (typeof chat === 'string') next.chat = chat.slice(0, 200);
            // (the index last: what it names is all on disk; a part no longer named goes after it)
            await writeWhole(path.join(dir, 'index.json'), JSON.stringify(next));
            writes += 1;
            for (const f of gone) await fs.rm(path.join(dir, f), { force: true });
            return { rev: next.rev };
        });
    }
    // 갈라진 채팅(분기)의 몫: from을 to로 통째로 복사해요 (to가 이미 있으면 안 해요) → { rev }
    async function fork(from, to, { chat = undefined } = {}) {
        const src = dirOf(from), dst = dirOf(to);
        if (src === dst) throw bad('같은 저장입니다.');
        return inLine(src, () => inLine(dst, async () => {
            const ix = await indexOf(from);
            if (!ix) throw new StoreError(404, '저장을 찾을 수 없습니다.');
            if (await indexOf(to)) throw new StoreError(409, '이미 있는 저장입니다.');
            await fs.mkdir(dst, { recursive: true });
            for (const file of Object.values(ix.parts)) await fs.copyFile(path.join(src, file), path.join(dst, file));
            const next = { ...ix, rev: 1, at: Date.now(), ...(typeof chat === 'string' ? { chat: chat.slice(0, 200) } : {}) };
            await writeWhole(path.join(dst, 'index.json'), JSON.stringify(next));
            writes += 1;
            return { rev: next.rev };
        }));
    }
    // 통째로 지우기 → 있었으면 true
    async function drop(id) {
        return inLine(dirOf(id), async () => { const had = !!(await indexOf(id)); await fs.rm(dirOf(id), { recursive: true, force: true }); writes += 1; return had; });
    }
    // 있는 저장들의 이름 → [id]
    async function list() {
        let names;
        try { names = await fs.readdir(base); } catch (err) { if (err?.code === 'ENOENT') return []; throw err; }
        const out = [];
        for (const n of names.sort()) if (ID.test(n) && await revOf(n) !== null) out.push(n);
        return out;
    }
    return { load, revOf, save, fork, drop, list, generation: () => writes, dir: base };
}
