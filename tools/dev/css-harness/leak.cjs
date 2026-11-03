// Where a hostile SillyTavern theme shows through: hostile.css paints every button/label/input/select loud and !important; this opens every
// scene with it on and lists the elements inside our roots that carry any of its marks. Before the shield block (plan 4-3) it is the to-do list
// of what to shield; after it, it is the test — the list must be empty.
//   node tools/dev/css-harness/leak.cjs [--only name,name] [--quick]      → out/leak.json + a summary
const fs = require('fs'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const { chromium } = require('playwright');
const { SCENES, ARCH, answer, B } = require('./scenes.cjs');
const ST = process.env.ST_URL || 'http://127.0.0.1:8000/';
const ROOT = path.join(__dirname, '../../..');
const args = process.argv.slice(2); const oi = args.indexOf('--only'); const only = oi >= 0 ? args[oi + 1].split(',') : null; const quick = args.includes('--quick');
const HOSTILE = fs.readFileSync(path.join(__dirname, 'hostile.css'), 'utf8');
const portOpen = port => new Promise(r => { const s = net.connect(port, '127.0.0.1'); s.once('connect', () => { s.end(); r(true); }); s.once('error', () => r(false)); });
(async () => {
    try { await fetch(ST); } catch { console.log('SillyTavern is not answering at ' + ST); process.exit(2); }
    let fake = null; if (!await portOpen(5555)) { fake = spawn('node', [path.join(ROOT, 'tools/dev/fakeph.mjs')], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800)); }
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 870 } });
    await p.goto(ST, { waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.SillyTavern?.getContext?.().characters?.length > 0, null, { timeout: 60000 }); await p.waitForTimeout(1500);
    await p.evaluate(async () => { await SillyTavern.getContext().selectCharacterById(0); }); await p.waitForTimeout(1000);
    await p.evaluate(async () => { await SillyTavern.getContext().openCharacterChat('na_test'); }); await p.waitForTimeout(1500);
    await p.evaluate(css => { const s = document.createElement('style'); s.id = 'na_hostile'; s.textContent = css; document.head.append(s); }, HOSTILE);
    await p.evaluate(async ([B]) => { const core = await import(B + 'core.js'); const g = core.globalSettings(); for (const k of ['draftConn', 'aiConn']) g[k] = { ...(g[k] || {}), mode: 'custom', url: 'http://127.0.0.1:5555/v1', model: 'fake', key: 'x', fmt: 'openai' }; g.faces = g.faces || {}; for (const n of ['mara', 'ren', 'ivo']) g.faces[n] = 'none'; }, [B]);
    const { helpers } = require('./capture.cjs');
    const leaks = {}; let archNow = null;
    for (const na of quick ? ['light'] : ['light', 'dark']) { await p.evaluate(t => document.body.classList.toggle('na_darkui', t === 'dark'), na);
        for (const sc of SCENES) { if (only && !only.includes(sc.name)) continue;
            try {
                if (archNow !== sc.arch) { await p.evaluate(async ([B, A, arch]) => { const core = await import(B + 'core.js'); const m = core.getMeta(); delete m.studio; m.retitled = []; delete m.layers; m.history = []; m.snapshots = []; m.text = ''; if (arch === 'empty') await core.saveMeta(); else await core.commitText(A, 'harness', { boundary: arch === 'studio' ? 5 : 29 }); }, [B, ARCH, sc.arch]); archNow = sc.arch; }
                await p.unroute('http://127.0.0.1:5555/**').catch(() => {});
                if (!sc.phone) await p.route('http://127.0.0.1:5555/**', async route => { const txt = answer(route.request().postData() || ''); await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: txt } }] }) }); });
                await sc.open(p, helpers); await p.waitForTimeout(300);
                const found = await p.evaluate(root => {
                    const R = document.querySelector(root); if (!R) return []; const out = [];
                    for (const e of R.querySelectorAll('*')) { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') continue;
                        const marks = [];
                        if (cs.backgroundColor === 'rgb(255, 0, 255)' || /255, 0, 255|0, 255, 255/.test(cs.backgroundImage)) marks.push('bg');
                        if (cs.color === 'rgb(0, 255, 0)') marks.push('color');
                        if (cs.borderTopStyle === 'dashed' && cs.borderTopColor === 'rgb(0, 0, 255)') marks.push('border');
                        if (/255, 255, 0/.test(cs.boxShadow)) marks.push('shadow');
                        if (/Comic Sans/.test(cs.fontFamily)) marks.push('font');
                        if (cs.letterSpacing === '3px') marks.push('spacing');
                        if (cs.textTransform === 'uppercase') marks.push('upper');
                        if (cs.accentColor === 'rgb(255, 0, 255)') marks.push('accent');
                        if (marks.length) out.push(`${e.tagName.toLowerCase()}${[...e.classList].slice(0, 3).map(c => '.' + c).join('')} → ${marks.join(' ')}`); }
                    return [...new Set(out)];
                }, sc.root);
                if (found.length) leaks[`${sc.name}__${na}`] = found;
            } catch (e) { leaks[`${sc.name}__${na}`] = ['ERROR ' + String(e.message).slice(0, 100)]; }
            finally { if (sc.close) await sc.close(p).catch(() => {}); await p.evaluate(() => { document.querySelectorAll('dialog.popup').forEach(d => { try { d.close(); } catch {} d.remove(); }); window.toastr?.clear?.(); }); await p.waitForTimeout(250); } } }
    await b.close(); if (fake) fake.kill();
    fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true }); fs.writeFileSync(path.join(__dirname, 'out', 'leak.json'), JSON.stringify(leaks, null, 1));
    const n = Object.values(leaks).reduce((a, l) => a + l.length, 0);
    console.log(`${Object.keys(leaks).length} scenes let the hostile theme through, ${n} element kinds in all`);
    for (const [k, l] of Object.entries(leaks)) { console.log(k); for (const x of l.slice(0, 12)) console.log('   ', x); if (l.length > 12) console.log('    …', l.length - 12, 'more'); }
    process.exit(n ? 1 : 0);
})();
