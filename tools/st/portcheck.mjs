// plugin/st/public/의 실리 코드 부분 복사 확인: `// 실리 <경로> <a>~<b>` 표시 아래 줄이 실리 그 파일의 a~b줄과 글자 그대로인지.
// 쓰기: node tools/st/portcheck.mjs <실리 1.19.1 폴더> [살펴볼 폴더 = plugin/st]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ST = process.argv[2];
if (!ST) { console.error('usage: node tools/st/portcheck.mjs <SillyTavern 1.19.1 folder> [dir]'); process.exit(2); }
const DIR = process.argv[3] || path.join(here, '..', '..', 'plugin', 'st');
const MARK = /^\s*\/\/ 실리 (\S+) (\d+)~(\d+)\s*$/;

function walk(d) {
    return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
        const p = path.join(d, e.name);
        return e.isDirectory() ? walk(p) : /\.(m?js)$/.test(e.name) ? [p] : [];
    });
}

const cache = new Map();
const stFile = (rel) => {
    if (!cache.has(rel)) cache.set(rel, fs.readFileSync(path.join(ST, rel), 'utf8').split('\n'));
    return cache.get(rel);
};

let blocks = 0, mismatches = 0, files = 0;
for (const f of walk(DIR)) {
    const L = fs.readFileSync(f, 'utf8').split('\n');
    let fileBlocks = 0;
    for (let i = 0; i < L.length; i++) {
        const m = MARK.exec(L[i]);
        if (!m) continue;
        const [, rel, a, b] = m;
        const A = Number(a), B = Number(b);
        fileBlocks++; blocks++;
        let src;
        try { src = stFile(rel); } catch (e) { console.log(`MISMATCH ${path.relative(DIR, f)}:${i + 1} cannot read ${rel}: ${e.message}`); mismatches++; continue; }
        if (A < 1 || B < A || B > src.length) { console.log(`MISMATCH ${path.relative(DIR, f)}:${i + 1} bad range ${rel} ${a}~${b}`); mismatches++; continue; }
        for (let k = 0; k <= B - A; k++) {
            const ours = L[i + 1 + k], theirs = src[A - 1 + k];
            if (ours !== theirs) {
                console.log(`MISMATCH ${path.relative(DIR, f)}:${i + 2 + k} vs ${rel}:${A + k}\n  ours:   ${JSON.stringify(ours)}\n  theirs: ${JSON.stringify(theirs)}`);
                mismatches++;
                break;
            }
        }
    }
    if (fileBlocks) files++;
}
console.log(`portcheck: ${files} files, ${blocks} blocks, ${mismatches} mismatches`);
process.exitCode = mismatches ? 1 : 0;
