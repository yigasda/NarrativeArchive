// Comment weight in style.css: 1,000+ of its lines are comments, many of them 2–4 line headers. This lists them and can fold each
// multi-line header into one line (the first sentence, up to 140 chars) — rendering cannot change, the harness still runs once after.
//   node tools/dev/css-harness/comments.cjs            # counts + the longest headers
//   node tools/dev/css-harness/comments.cjs --fold     # rewrite multi-line /* … */ headers as one line each
//   node tools/dev/css-harness/comments.cjs --fold --keep-versions   # keep "(3.169.x)" / "docs/mockups/…" references in the folded line
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../../..'); const CSS = path.join(ROOT, 'style.css');
const args = process.argv.slice(2); const fold = args.includes('--fold'); const keepRefs = args.includes('--keep-versions');
const L = fs.readFileSync(CSS, 'utf8').split('\n');
const blocks = []; let i = 0;
while (i < L.length) {
    if (L[i].startsWith('/*') && !L[i].includes('*/')) { let j = i; while (j < L.length && !L[j].includes('*/')) j++; blocks.push([i, j]); i = j + 1; }
    else i++;
}
const total = L.filter(l => l.startsWith('/*') || /^\s+[^{}:;]*$/.test(l) && !l.trim().startsWith('.') && !l.trim().startsWith('--')).length;
console.log(`comment-only lines (approx): ${total} of ${L.length} · multi-line headers: ${blocks.length}, spanning ${blocks.reduce((a, [s, e]) => a + e - s + 1, 0)} lines`);
if (!fold) { for (const [s, e] of blocks.filter(([s, e]) => e - s >= 2).slice(0, 25)) console.log(`  ${String(s + 1).padStart(5)}  ${e - s + 1} lines  ${L[s].slice(0, 100)}`); process.exit(0); }
let saved = 0;
for (const [s, e] of blocks.reverse()) {
    const text = L.slice(s, e + 1).join(' ').replace(/^\/\*\s*=*\s*/, '').replace(/\s*\*\/\s*$/, '').replace(/\s+/g, ' ').trim();
    const ref = keepRefs ? (text.match(/\((?:docs\/mockups\/[^)]+|3\.\d+\.\d+)[^)]*\)/) || [''])[0] : '';
    let head = text.split(/(?<=[.;:!?])\s|(?<=[가-힣]요)\s/)[0].slice(0, 140).trim();
    if (ref && !head.includes(ref)) head = `${head} ${ref}`;
    const eq = L[s].startsWith('/* ====') ? '============ ' : '';
    L.splice(s, e - s + 1, `/* ${eq}${head.replace(/\s*\*\/.*$/, '')} */`);
    saved += e - s;
}
fs.writeFileSync(CSS, L.join('\n')); console.log(`folded ${blocks.length} headers, ${saved} lines fewer; style.css is now ${L.length - 1} lines`);
