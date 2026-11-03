// Rules whose declaration bodies are identical and that sit next to each other (nothing but comments or blank lines between) can be one
// rule with a comma list — the cascade cannot tell the difference, so this is order-safe by construction.
//   node tools/dev/css-harness/merge.cjs            # the groups it would merge
//   node tools/dev/css-harness/merge.cjs --apply    # merge them (the first rule keeps its line; the others are removed)
// Only one-line rules take part; a rule that is inside an @-block, or whose selector list already spans 200+ chars, is left alone.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../../..'); const CSS = path.join(ROOT, 'style.css');
const apply = process.argv.includes('--apply');
const L = fs.readFileSync(CSS, 'utf8').split('\n');
const norm = s => s.replace(/\s+/g, ' ').trim();
const rule = l => { const m = l.match(/^([^/@\s][^{]*)\{(.*)\}\s*$/); return m && !/\{.*\{/.test(l) ? { sel: m[1].trim(), body: norm(m[2]) } : null; };
const groups = []; let i = 0;
while (i < L.length) {
    const r = rule(L[i]); if (!r) { i++; continue; }
    const g = [i]; let j = i + 1;
    while (j < L.length) { const l = L[j]; if (!l.trim() || l.startsWith('/*')) { j++; continue; } const r2 = rule(l); if (r2 && r2.body === r.body) { g.push(j); j++; } else break; }
    if (g.length > 1 && g.reduce((a, k) => a + rule(L[k]).sel.length + 2, 0) < 200) groups.push(g);
    i = j;
}
const saving = groups.reduce((a, g) => a + g.length - 1, 0);
if (!apply) { for (const g of groups.slice(0, 30)) console.log(`  ${g.map(k => k + 1).join('+')}  ${g.map(k => rule(L[k]).sel).join(', ').slice(0, 110)}  { ${rule(L[g[0]]).body.slice(0, 50)}… }`); console.log(`\n${groups.length} adjacent groups · ${saving} lines removable`); process.exit(0); }
for (const g of groups.reverse()) { const sels = g.map(k => rule(L[k]).sel).join(', '); L[g[0]] = `${sels} { ${rule(L[g[0]]).body} }`; for (const k of g.slice(1).reverse()) L.splice(k, 1); }
fs.writeFileSync(CSS, L.join('\n')); console.log(`merged ${groups.length} groups, ${saving} lines fewer; style.css is now ${L.length - 1} lines. Run the harness.`);
