// Where the same selector is written more than once in style.css — the raw material of step 4-2 (fold the later copy into the first).
//   node tools/dev/css-harness/dupes.cjs [--from 7232]      # only groups whose later copy sits at or after this line
// For each selector written twice or more: every line it appears on, and per pair whether the later copy only repeats / overrides properties
// the earlier one already sets (a pure override → merge by hand) or adds new ones (merge, keep the extra declarations).
// Only one-line rules are read (6,400+ of the file); multi-line blocks are listed separately as "not parsed".
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../../..');
const lines = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8').split('\n');
const args = process.argv.slice(2); const fi = args.indexOf('--from'); const from = fi >= 0 ? parseInt(args[fi + 1]) : 0;
const norm = s => s.replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1').trim();
const rules = []; const multi = [];
lines.forEach((l, i) => {
    if (/^\s*(\/\*|@|$)/.test(l)) return;
    const m = l.match(/^([^{]+)\{(.*)\}\s*$/);
    if (!m) { if (/\{\s*$/.test(l)) multi.push(i + 1); return; }
    const props = {}; for (const d of m[2].split(';')) { const j = d.indexOf(':'); if (j > 0) props[d.slice(0, j).trim()] = d.slice(j + 1).trim(); }
    rules.push({ line: i + 1, sel: norm(m[1]), props });
});
const groups = new Map(); for (const r of rules) { if (!groups.has(r.sel)) groups.set(r.sel, []); groups.get(r.sel).push(r); }
let shown = 0, pure = 0, lineSum = 0;
for (const [sel, rs] of groups) {
    if (rs.length < 2 || !rs.some(r => r.line >= from && r !== rs[0])) continue;
    shown++;
    const first = rs[0]; const notes = [];
    for (const r of rs.slice(1)) { const keys = Object.keys(r.props); const over = keys.filter(k => k in first.props); const added = keys.filter(k => !(k in first.props)); const isPure = added.length === 0; if (isPure) pure++; lineSum++; notes.push(`  ${r.line}: ${isPure ? 'pure override' : `adds ${added.join(', ')}`}${over.length ? ` · overrides ${over.join(', ')}` : ''}`); }
    console.log(`${sel.slice(0, 110)}\n  ${first.line}: first${notes.length ? '\n' + notes.join('\n') : ''}`);
}
console.log(`\n${shown} selectors written more than once (later copy at/after line ${from}) · ${lineSum} later copies, ${pure} of them pure overrides · ${multi.length} multi-line blocks not parsed (lines ${multi.slice(0, 6).join(', ')}…)`);
