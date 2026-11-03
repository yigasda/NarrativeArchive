// The map of --na-* variables in style.css: where each is defined (line, scope selector, value) and how often it is used — step 4-4's checklist.
//   node tools/dev/css-harness/vars.cjs            # every variable
//   node tools/dev/css-harness/vars.cjs --name accent   # those whose name contains "accent"
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../../..');
const lines = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8').split('\n');
const args = process.argv.slice(2); const ni = args.indexOf('--name'); const filt = ni >= 0 ? args[ni + 1] : null;
const defs = new Map(), uses = new Map(); let scope = '';
lines.forEach((l, i) => {
    const one = l.match(/^([^{]+)\{(.*)\}\s*$/);
    if (one) scope = one[1].trim(); else if (/\{\s*$/.test(l)) scope = l.replace(/\{\s*$/, '').trim();
    for (const m of l.matchAll(/(--na-[a-z0-9-]+)\s*:\s*([^;}]+)/g)) { const v = m[1]; if (!defs.has(v)) defs.set(v, []); defs.get(v).push({ line: i + 1, scope: scope.slice(0, 70), value: m[2].trim().slice(0, 60) }); }
    for (const m of l.matchAll(/var\((--na-[a-z0-9-]+)/g)) uses.set(m[1], (uses.get(m[1]) || 0) + 1);
});
const names = [...new Set([...defs.keys(), ...uses.keys()])].filter(n => !filt || n.includes(filt)).sort();
for (const n of names) {
    const d = defs.get(n) || []; console.log(`${n}  · used ${uses.get(n) || 0}×  · defined ${d.length}×${d.length ? '' : '  ← NEVER DEFINED'}${uses.get(n) ? '' : '  ← never used'}`);
    for (const x of d) console.log(`    ${String(x.line).padStart(5)}  ${x.scope.padEnd(70)}  ${x.value}`);
}
const scopes = new Set([...defs.values()].flat().map(x => x.scope));
console.log(`\n${names.length} variables · ${[...defs.values()].flat().length} definitions in ${scopes.size} scopes · never defined: ${names.filter(n => !defs.has(n)).length} · never used: ${names.filter(n => !uses.has(n)).length}`);
