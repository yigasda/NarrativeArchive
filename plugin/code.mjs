// 일꾼이 불러올 코드가 있는 곳 (2026-11-23).
// 일꾼은 답장 코드(src/)를 그대로 돌려요. 그 코드를 이 플러그인 폴더가 아니라 **실리의 확장 폴더**에서 불러요:
// 실리가 확장을 업데이트하면 일꾼도 같은 코드가 돼요(플러그인 폴더에서 git pull을 안 해도). 확장의 버전이 바뀌면 일꾼을 다시 띄워요.
//   확장 폴더: 사용자의 것(<사용자 폴더>/extensions/<이름>) → 모든 사용자의 것(<실리>/public/scripts/extensions/third-party/<이름>).
//   이름은 저장소 이름이라 정해져 있지 않아요: manifest.json의 display_name · homePage가 이 플러그인 폴더의 것과 같고,
//   plugin/worker.mjs가 있는 폴더를 찾아요.
// 확장 폴더를 못 찾거나 그 코드가 일꾼과 말을 못 맞추면(WORKER_PROTO) 이 플러그인 폴더의 코드로 돌려요.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 일꾼과 본체(host.mjs)가 주고받는 말의 판. 그 말을 바꾸면 올려요: 다른 판의 일꾼은 안 써요
export const WORKER_PROTO = 1;
export const OWN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const readManifest = async dir => { try { const v = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8')); return obj(v) ? v : null; } catch { return null; } };
const has = async f => { try { return (await fs.stat(f)).isFile(); } catch { return false; } };

// 이 플러그인 폴더의 코드 → { dir, version, from: 'plugin' }
export async function ownCode() {
    const m = await readManifest(OWN_DIR);
    return { dir: OWN_DIR, version: String(m?.version || ''), from: 'plugin' };
}
// 확장 폴더의 코드 → { dir, version, from: 'extension' } | null
//   bases: 찾아볼 확장 폴더들의 부모 (앞의 것이 먼저)
export async function extensionCode(bases) {
    const mine = await readManifest(OWN_DIR);
    if (!mine) return null;
    for (const base of bases) {
        let names;
        try { names = (await fs.readdir(base)).sort(); } catch { continue; }
        for (const name of names) {
            const dir = path.join(base, name);
            if (path.resolve(dir) === OWN_DIR) continue;
            const m = await readManifest(dir);
            if (!m || m.display_name !== mine.display_name || m.homePage !== mine.homePage || !m.version) continue;
            if (!await has(path.join(dir, 'plugin', 'worker.mjs'))) continue;
            return { dir: await fs.realpath(dir), version: String(m.version), from: 'extension' };
        }
    }
    return null;
}
// 그 사용자의 일꾼이 쓸 코드 → 확장 폴더의 것 | 이 플러그인 폴더의 것
//   user: 실리의 req.user ({ directories: { root, extensions } }) · stRoot: 실리 폴더 · skip(code) → 이 코드를 쓰지 않을까 (전에 못 뜬 판)
export async function codeFor(user, { stRoot = process.cwd(), skip = () => false } = {}) {
    const bases = [user?.directories?.extensions || (user?.directories?.root ? path.join(user.directories.root, 'extensions') : ''), path.join(stRoot, 'public', 'scripts', 'extensions', 'third-party')].filter(Boolean);
    const ext = await extensionCode(bases);
    return ext && !skip(ext) ? ext : ownCode();
}

// 사용자마다 일꾼 하나 (plugin/index.mjs가 써요). 일꾼은 그때 고른 코드(codeFor)로 떠요: 확장이 업데이트되어 버전이 바뀌면 다시 띄워요.
// 그 코드로 일꾼이 못 뜨면 그 판은 다시 쓰지 않고 이 플러그인 폴더의 코드로 돌려요. 같이 온 요청들은 한 번 띄운 것을 같이 기다려요
//   on() → 실리 서버 안인가 · start(root, code) → 일꾼 (host.mjs startAuto) · autos: root → 일꾼 · users: root → req.user
export function makeAutoFor({ on, start, autos = new Map(), users = new Map(), log = () => {}, find = codeFor }) {
    const starting = new Map(), failed = new Set();
    const keyOf = c => `${c.from}:${c.dir}:${c.version}`;
    return async function autoFor(user) {
        const root = user?.directories?.root;
        if (!on() || !root) return null;
        users.set(root, user);
        if (starting.has(root)) return starting.get(root);
        const code = await find(user, { skip: c => failed.has(keyOf(c)) });
        const had = autos.get(root);
        if (had?.alive() && keyOf(had.code) === keyOf(code)) return had;
        if (starting.has(root)) return starting.get(root);
        const run = (async () => {
            if (had) { autos.delete(root); await had.stop().catch(() => {}); }
            const auto = await start(root, code);
            autos.set(root, auto);
            auto.ready.then(() => {}, err => { log(err); if (code.from === 'extension') failed.add(keyOf(code)); });
            return auto;
        })().finally(() => starting.delete(root));
        starting.set(root, run);
        return run;
    };
}
