// Light/dark rule pairs in style.css — `body:not(.na_darkui) X { p: a }` next to `body.na_darkui X { p: b }` — and what each can fold into.
//   node tools/dev/css-harness/pairs.cjs                 # the list, sorted into kinds
//   node tools/dev/css-harness/pairs.cjs --apply same     # fold pairs whose values are identical in both themes into one plain rule
//   node tools/dev/css-harness/pairs.cjs --apply palette  # fold pairs whose (light, dark) values are an existing --na-* variable's pair into one rule using the variable
// Kinds:
//   same     both themes set the same values → the theme prefix is noise: one plain rule `X { … }` (saves a line, changes nothing)
//   palette  (light, dark) values equal an existing variable's (light, dark) definition → `X { p: var(--na-…) }` (saves a line)
//   new      values differ and match no variable → would need a new variable (two definition lines for one saved line: not worth it unless the triple repeats)
// A fold keeps the rule at the LIGHT rule's line and deletes the dark one. The folded selector keeps `body:is(.na_darkui, :not(.na_darkui))` in
// front: the pair's specificity (0,1,1 more than the bare selector) is what made it beat ST's .menu_button and later rules — tried without, 94 captures changed; selectors with their own specificity needs (the theme prefix
// adds (0,1,1)) are listed under "risky" and never folded by --apply. Run the harness after applying.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../../..'); const CSS = path.join(ROOT, 'style.css');
const args = process.argv.slice(2); const ai = args.indexOf('--apply'); const apply = ai >= 0 ? args[ai + 1].split(',') : null;
const L = fs.readFileSync(CSS, 'utf8').split('\n');
const norm = s => s.replace(/\s+/g, ' ').trim();
const parse = body => { const o = {}; for (const d of body.split(';')) { const j = d.indexOf(':'); if (j > 0) o[d.slice(0, j).trim()] = d.slice(j + 1).trim(); } return o; };
// the palette: every --na-* variable with one light and one dark value
const vars = {};
L.forEach((l, i) => { for (const m of l.matchAll(/(--na-[a-z0-9-]+)\s*:\s*([^;}]+)/g)) { const v = vars[m[1]] = vars[m[1]] || {}; const dark = /body\.na_darkui/.test(l) || (() => { for (let k = i; k >= Math.max(0, i - 40); k--) { if (/^body\.na_darkui/.test(L[k])) return true; if (/^body:not\(\.na_darkui\)/.test(L[k])) return false; } return null; })(); if (dark === true) v.dark = m[2].trim(); else if (dark === false) v.light = m[2].trim(); } });
const palette = {}; for (const [n, v] of Object.entries(vars)) if (v.light && v.dark) palette[`${v.light}|${v.dark}`] = n;
const rules = {};
L.forEach((l, i) => { const m = l.match(/^(body:not\(\.na_darkui\)|body\.na_darkui) (.+?)\s*\{(.*)\}\s*$/); if (!m) return; const t = m[1].includes('not') ? 'L' : 'D'; const sel = norm(m[2]); (rules[sel] = rules[sel] || {})[t] = { line: i, props: parse(m[3]), tail: l.slice(l.indexOf('}') + 1) }; });
const kinds = { same: [], palette: [], new: [], risky: [] };
for (const [sel, v] of Object.entries(rules)) {
    if (!v.L || !v.D) continue;
    const kl = Object.keys(v.L.props), kd = Object.keys(v.D.props);
    if (kl.join() !== kd.join()) { kinds.risky.push({ sel, why: 'different property sets', L: v.L.line, D: v.D.line }); continue; }
    if (/:not\(#na_x\)|!important/.test(L[v.L.line]) !== /:not\(#na_x\)|!important/.test(L[v.D.line])) { kinds.risky.push({ sel, why: 'importance differs', L: v.L.line, D: v.D.line }); continue; }
    const out = {}; let kind = 'same';
    for (const k of kl) { const a = v.L.props[k], b = v.D.props[k]; if (a === b) out[k] = a; else { const p = palette[`${a}|${b}`] || palette[`${a.replace(' !important', '')}|${b.replace(' !important', '')}`]; if (p) { out[k] = `var(${p})${/!important/.test(a) ? ' !important' : ''}`; if (kind === 'same') kind = 'palette'; } else { kind = 'new'; out[k] = `${a} / ${b}`; } } }
    kinds[kind].push({ sel, L: v.L.line, D: v.D.line, out, tail: v.L.tail });
}
if (!apply) {
    for (const [k, list] of Object.entries(kinds)) { console.log(`\n== ${k} (${list.length})`); for (const x of list.slice(0, k === 'new' ? 12 : 40)) console.log(`  ${x.L + 1}/${x.D + 1}  ${x.sel.slice(0, 80)}  ${x.out ? JSON.stringify(x.out).slice(0, 90) : x.why}`); if (list.length > 40) console.log('  …'); }
    console.log(`\npairs: same ${kinds.same.length} · palette ${kinds.palette.length} · new ${kinds.new.length} · risky ${kinds.risky.length} — --apply same,palette would remove ${kinds.same.length + kinds.palette.length} lines`);
    process.exit(0);
}
const todo = [].concat(...apply.map(k => kinds[k] || [])).sort((a, b) => b.D - a.D);
const del = new Set();
for (const x of todo) { L[x.L] = `body:is(.na_darkui, :not(.na_darkui)) ${x.sel} { ${Object.entries(x.out).map(([k, v]) => `${k}: ${v}`).join('; ')}; }${x.tail}`; del.add(x.D); }
const out = L.filter((_, i) => !del.has(i));
fs.writeFileSync(CSS, out.join('\n')); console.log(`folded ${todo.length} pairs → ${L.length - out.length} lines removed; style.css is now ${out.length - 1} lines. Run the harness.`);
