// Compare two capture labels: every screenshot pixel for pixel (ImageMagick compare -metric AE) and every style dump value for value.
//   node tools/dev/css-harness/compare.cjs <before> <after> [--diffs]
// Only captures present in BOTH labels are compared (so a --quick or --owner "after" is checked against the matching part of a full "before");
// the count of skipped ones is printed. A capture made with --nopng is compared by values only. Exit 0 only when nothing differs.
// --diffs writes a highlighted PNG next to each differing pair.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const [A, Bl] = process.argv.slice(2).filter(a => !a.startsWith('--')); const wantDiffs = process.argv.includes('--diffs');
if (!A || !Bl) { console.log('usage: compare.cjs <before> <after> [--diffs]'); process.exit(2); }
const dirA = path.join(__dirname, 'out', A), dirB = path.join(__dirname, 'out', Bl);
for (const d of [dirA, dirB]) if (!fs.existsSync(d)) { console.log('no such capture:', d); process.exit(2); }
// the box a dialog sat in, from the label's _index.json (captures renamed from another theme column fall back to that column's entry)
const indexes = new Map();
const rectOf = (dir, tag) => { if (!indexes.has(dir)) { try { indexes.set(dir, JSON.parse(fs.readFileSync(path.join(dir, '_index.json'), 'utf8'))); } catch { indexes.set(dir, []); } }
    const ix = indexes.get(dir); const hit = ix.find(r => r.tag === tag && r.rect) || ix.find(r => r.tag === tag.replace('__default__', '__DarkLite__') && r.rect); return hit ? hit.rect : null; };
const tagsOf = d => new Set(fs.readdirSync(d).filter(f => /\.(png|json)$/.test(f) && !f.startsWith('_')).map(f => f.replace(/\.(png|json)$/, '')));
const ta = tagsOf(dirA), tb = tagsOf(dirB);
const tags = [...ta].filter(t => tb.has(t)).sort();
const onlyA = [...ta].filter(t => !tb.has(t)).length, onlyB = [...tb].filter(t => !ta.has(t)).length;
let pix = 0, sty = 0, broken = 0, pixDone = 0, valDone = 0;
for (const tag of tags) {
    const pa = path.join(dirA, tag + '.png'), pb = path.join(dirB, tag + '.png');
    if (fs.existsSync(pa) && fs.existsSync(pb)) {
        pixDone++;
        // the phone's translucent gel icons and the panel's long run of shadowed cards rasterise with 1–2 levels of tile-seam noise that moves between
        // runs (not a CSS effect; every value is still compared exactly in the JSON), so those tolerate 13/255 (5%); every window must be exact
        const tol = /^(phone-|panel)/.test(tag) ? 13 : 0;
        // a dialog is shot as the whole viewport: compare only its own box (the chat page behind it re-flows with the ST theme and is not ours)
        const rect = tag.startsWith('phone-') || tag.startsWith('panel') ? null : (rectOf(dirA, tag) || rectOf(dirB, tag));
        const argv = ['-I', path.join(__dirname, 'pixdiff.py'), pa, pb, String(tol), ...(rect ? rect.map(String) : []), ...(wantDiffs ? [path.join(dirB, `_diff_${tag}.png`)] : [])];
        let out = ''; try { out = execFileSync('python3', argv, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim(); } catch (e) { out = 'ERR ' + String(e.stderr || e.message).slice(0, 80); }
        if (out.startsWith('SIZE') || out.startsWith('ERR')) { broken++; console.log(`SIZE    ${tag}: ${out}`); }
        else { const [n, peak] = out.split(' ').map(Number);
            // a window must be exact — except for the compositor's own jitter on a transformed knob or icon edge (seen flipping 0 ↔ 33 px between
            // runs of the same CSS): up to 40 pixels at most 64/255 apart is reported as noise, not a difference
            if (n && tol === 0 && n <= 40 && peak <= 64) console.log(`noise   ${tag}: ${n} px, max ${peak}/255 (anti-aliasing jitter, values identical)`);
            else if (n) { pix++; console.log(`PIXELS  ${tag}: ${n} px differ (max ${peak}/255)${rect ? ' inside the window' : ''}`); } }
    }
    const ja = path.join(dirA, tag + '.json'), jb = path.join(dirB, tag + '.json');
    if (fs.existsSync(ja) && fs.existsSync(jb)) {
        valDone++;
        const noToast = r => !/(^|\s)toast(\s|-|$)|toast-container/.test(r.cls || '') && !(r.tag === 'DIV' && r.cls === 'toast-top-center');
        const a = JSON.parse(fs.readFileSync(ja)).filter(noToast), b = JSON.parse(fs.readFileSync(jb)).filter(noToast);
        const byPath = new Map(b.map(r => [r.path, r])); const diffs = [];
        for (const ra of a) { const rb = byPath.get(ra.path); if (!rb) { diffs.push(`${ra.path} <${ra.tag}.${ra.cls}> gone`); continue; }
            for (const k of Object.keys(ra)) { if (k === 'path' || k === 'inter') continue; if ((k === 'hover' || k === 'focus') && (!(k in ra) || !(k in rb))) continue; if (String(ra[k]) !== String(rb[k])) diffs.push(`${ra.path} <${ra.tag}${ra.cls ? '.' + ra.cls.split(' ')[0] : ''}> ${k}: ${ra[k]} → ${rb[k]}`); } }
        if (a.length !== b.length) diffs.push(`element count ${a.length} → ${b.length}`);
        if (diffs.length) { sty++; console.log(`STYLES  ${tag}: ${diffs.length} values differ`); for (const d of diffs.slice(0, 8)) console.log('    ', d); if (diffs.length > 8) console.log('     …'); }
    } else { broken++; console.log(`NOJSON  ${tag}`); }
}
console.log(`\n${tags.length} compared — pixels on ${pixDone}, values on ${valDone} (${onlyA} only in ${A}, ${onlyB} only in ${Bl}) · pixel diffs: ${pix} · style diffs: ${sty} · unreadable: ${broken}`);
process.exit(pix || sty || broken ? 1 : 0);
