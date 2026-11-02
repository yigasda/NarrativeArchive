// Delete rules from style.css by the "line: selector" keys deadrules.cjs printed — only after each key is checked against the file.
//   node tools/dev/css-harness/prune.cjs                 # dry run: the safe bin of out/deadrules.json, shows what would go
//   node tools/dev/css-harness/prune.cjs --write         # apply
//   node tools/dev/css-harness/prune.cjs --keys keys.txt # a hand-picked list (one "line: selector" per line) instead of the safe bin
// A key is skipped (and reported) when the selector at that line no longer matches: run deadrules.cjs again after any edit to style.css.
// One-line rules lose their line; a multi-line rule loses from its selector line to its closing brace. Deletions run bottom-up so earlier lines keep their numbers.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../../..'); const CSS = path.join(ROOT, 'style.css');
const args = process.argv.slice(2); const write = args.includes('--write'); const ki = args.indexOf('--keys');
const keys = ki >= 0 ? fs.readFileSync(args[ki + 1], 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
    : JSON.parse(fs.readFileSync(path.join(__dirname, 'out', 'deadrules.json'), 'utf8')).bins.safe;
const lines = fs.readFileSync(CSS, 'utf8').split('\n');
const norm = s => s.replace(/\s+/g, ' ').trim();
const plan = []; const skipped = [];
for (const k of keys) {
    const line = parseInt(k); const sel = k.slice(k.indexOf(':') + 2);
    const text = lines[line - 1] || '';
    const selInFile = norm(text.slice(0, text.indexOf('{')));
    if (!text.includes('{') || norm(sel) !== selInFile) { skipped.push({ k, found: text.slice(0, 80) }); continue; }
    let end = line - 1;
    if (!/\}\s*$/.test(text)) { let depth = 0; for (let i = line - 1; i < lines.length; i++) { depth += (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length; if (depth === 0) { end = i; break; } } }
    plan.push({ k, from: line - 1, to: end });
}
plan.sort((a, b) => b.from - a.from);
let removed = 0;
for (const x of plan) { lines.splice(x.from, x.to - x.from + 1); removed += x.to - x.from + 1; }
console.log(`${plan.length} rules → ${removed} lines ${write ? 'removed' : 'would be removed'}; ${skipped.length} keys skipped (selector not at that line)`);
for (const s of skipped) console.log('  skip', s.k, '| found:', s.found);
if (write) { fs.writeFileSync(CSS, lines.join('\n')); console.log(`style.css is now ${lines.length} lines`); }
else for (const x of plan.slice().reverse()) console.log('  ', x.k, x.to > x.from ? `(${x.to - x.from + 1} lines)` : '');
