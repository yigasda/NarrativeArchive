// Step 4-3's knife: take the forced priority off a range of style.css lines, so a quick capture can tell whether it was needed.
//   node tools/dev/css-harness/relax.cjs --range 7980-7990 --what important     # drop " !important" in those lines
//   node tools/dev/css-harness/relax.cjs --range 7980-7990 --what notx          # drop ":not(#na_x)" in those lines
//   node tools/dev/css-harness/relax.cjs --range 7980-7990 --what both
// It edits style.css in place and prints how many it removed per line; undo with `git checkout -- style.css`.
// The loop: relax a block → copy to the local SillyTavern → capture --quick → compare against baseline → same? keep the change : revert and
// write the reason next to the rule (what the priority beats). Halve the range on a mixed result.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../../..'); const CSS = path.join(ROOT, 'style.css');
const args = process.argv.slice(2); const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const range = (opt('--range') || '').split('-').map(Number); const what = opt('--what') || 'both';
if (!range[0] || !range[1]) { console.log('usage: relax.cjs --range A-B --what important|notx|both'); process.exit(2); }
const lines = fs.readFileSync(CSS, 'utf8').split('\n'); let nImp = 0, nNot = 0;
for (let i = range[0] - 1; i < Math.min(range[1], lines.length); i++) {
    let l = lines[i]; if (/^\s*\/\*/.test(l)) continue;
    if (what !== 'notx') { const c = (l.match(/\s*!important/g) || []).length; nImp += c; l = l.replace(/\s*!important/g, ''); }
    if (what !== 'important') { const c = (l.match(/:not\(#na_x\)/g) || []).length; nNot += c; l = l.replace(/:not\(#na_x\)/g, ''); }
    lines[i] = l;
}
fs.writeFileSync(CSS, lines.join('\n'));
console.log(`lines ${range[0]}–${range[1]}: removed ${nImp} !important, ${nNot} :not(#na_x)`);
