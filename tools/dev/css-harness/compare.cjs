// Compare two capture labels: every screenshot pixel for pixel (ImageMagick compare -metric AE) and every style dump value for value.
//   node tools/dev/css-harness/compare.cjs <before> <after> [--diffs]
// Exit 0 only when nothing differs. --diffs writes a highlighted diff PNG next to each differing pair (out/<after>/_diff_<tag>.png).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const [A, Bl] = process.argv.slice(2).filter(a => !a.startsWith('--')); const wantDiffs = process.argv.includes('--diffs');
if (!A || !Bl) { console.log('usage: compare.cjs <before> <after>'); process.exit(2); }
const dirA = path.join(__dirname, 'out', A), dirB = path.join(__dirname, 'out', Bl);
const tags = fs.readdirSync(dirA).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)).sort();
let pix = 0, sty = 0, missing = 0;
for (const tag of tags) {
    const pa = path.join(dirA, tag + '.png'), pb = path.join(dirB, tag + '.png');
    if (!fs.existsSync(pb)) { missing++; console.log('MISSING in after:', tag); continue; }
    let ae = '0';
    try { execFileSync('compare', ['-metric', 'AE', pa, pb, wantDiffs ? path.join(dirB, `_diff_${tag}.png`) : 'null:'], { stdio: ['ignore', 'ignore', 'pipe'] }); }
    catch (e) { ae = String(e.stderr || '').trim(); }
    const n = parseFloat(ae) || (ae && !/^0(\.0+)?$/.test(ae) ? NaN : 0);
    if (n !== 0) { pix++; console.log(`PIXELS  ${tag}: ${ae} px differ`); }
    // style dump
    const ja = path.join(dirA, tag + '.json'), jb = path.join(dirB, tag + '.json');
    if (fs.existsSync(ja) && fs.existsSync(jb)) {
        const a = JSON.parse(fs.readFileSync(ja)), b = JSON.parse(fs.readFileSync(jb));
        const byPath = new Map(b.map(r => [r.path, r])); const diffs = [];
        for (const ra of a) { const rb = byPath.get(ra.path); if (!rb) { diffs.push(`${ra.path} <${ra.tag}.${ra.cls}> gone`); continue; }
            for (const k of Object.keys(ra)) if (k !== 'path' && String(ra[k]) !== String(rb[k])) diffs.push(`${ra.path} <${ra.tag}${ra.cls ? '.' + ra.cls.split(' ')[0] : ''}> ${k}: ${ra[k]} → ${rb[k]}`); }
        if (a.length !== b.length) diffs.push(`element count ${a.length} → ${b.length}`);
        if (diffs.length) { sty++; console.log(`STYLES  ${tag}: ${diffs.length} values differ`); for (const d of diffs.slice(0, 8)) console.log('    ', d); if (diffs.length > 8) console.log('     …'); }
    }
}
console.log(`\n${tags.length} captures · pixel diffs: ${pix} · style diffs: ${sty} · missing: ${missing}`);
process.exit(pix || sty || missing ? 1 : 0);
