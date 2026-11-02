// Compare two capture labels: every screenshot pixel for pixel (ImageMagick compare -metric AE) and every style dump value for value.
//   node tools/dev/css-harness/compare.cjs <before> <after> [--diffs]
// Only captures present in BOTH labels are compared (so a --quick "after" is checked against the matching part of a full "before");
// the count of skipped ones is printed. Exit 0 only when nothing differs. --diffs writes a highlighted PNG next to each differing pair.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const [A, Bl] = process.argv.slice(2).filter(a => !a.startsWith('--')); const wantDiffs = process.argv.includes('--diffs');
if (!A || !Bl) { console.log('usage: compare.cjs <before> <after> [--diffs]'); process.exit(2); }
const dirA = path.join(__dirname, 'out', A), dirB = path.join(__dirname, 'out', Bl);
for (const d of [dirA, dirB]) if (!fs.existsSync(d)) { console.log('no such capture:', d); process.exit(2); }
const tagsOf = d => new Set(fs.readdirSync(d).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)));
const ta = tagsOf(dirA), tb = tagsOf(dirB);
const tags = [...ta].filter(t => tb.has(t)).sort();
const onlyA = [...ta].filter(t => !tb.has(t)).length, onlyB = [...tb].filter(t => !ta.has(t)).length;
let pix = 0, sty = 0, broken = 0;
for (const tag of tags) {
    const pa = path.join(dirA, tag + '.png'), pb = path.join(dirB, tag + '.png');
    // the phone's translucent gel icons and status-bar glyphs rasterise with a few levels of tile-seam noise that moves between runs (not a CSS effect;
    // every value is still compared exactly in the JSON), so phone pixels get a 5% fuzz; every window stays at exact zero
    const fuzz = tag.startsWith('phone-') ? ['-fuzz', '5%'] : [];
    let out = '0', code = 0;
    try { execFileSync('compare', ['-metric', 'AE', ...fuzz, pa, pb, wantDiffs ? path.join(dirB, `_diff_${tag}.png`) : 'null:'], { stdio: ['ignore', 'ignore', 'pipe'] }); }
    catch (e) { out = String(e.stderr || '').trim(); code = e.status; }
    if (code === 2 || /differ|unable|error/i.test(out) && !/^[\d.e+]+$/.test(out)) { broken++; console.log(`SIZE    ${tag}: ${out.split('\n')[0]}`); }
    else if (parseFloat(out) !== 0) { pix++; console.log(`PIXELS  ${tag}: ${out} px differ`); }
    const ja = path.join(dirA, tag + '.json'), jb = path.join(dirB, tag + '.json');
    if (fs.existsSync(ja) && fs.existsSync(jb)) {
        const a = JSON.parse(fs.readFileSync(ja)), b = JSON.parse(fs.readFileSync(jb));
        const byPath = new Map(b.map(r => [r.path, r])); const diffs = [];
        for (const ra of a) { const rb = byPath.get(ra.path); if (!rb) { diffs.push(`${ra.path} <${ra.tag}.${ra.cls}> gone`); continue; }
            for (const k of Object.keys(ra)) if (k !== 'path' && String(ra[k]) !== String(rb[k])) diffs.push(`${ra.path} <${ra.tag}${ra.cls ? '.' + ra.cls.split(' ')[0] : ''}> ${k}: ${ra[k]} → ${rb[k]}`); }
        if (a.length !== b.length) diffs.push(`element count ${a.length} → ${b.length}`);
        if (diffs.length) { sty++; console.log(`STYLES  ${tag}: ${diffs.length} values differ`); for (const d of diffs.slice(0, 8)) console.log('    ', d); if (diffs.length > 8) console.log('     …'); }
    } else { broken++; console.log(`NOJSON  ${tag}`); }
}
console.log(`\n${tags.length} compared (${onlyA} only in ${A}, ${onlyB} only in ${Bl}) · pixel diffs: ${pix} · style diffs: ${sty} · unreadable: ${broken}`);
process.exit(pix || sty || broken ? 1 : 0);
