// Which rules of style.css decide a value somewhere, and which never do.
// Every scene (windows, results, panel) is opened in light and dark; for every element inside the root the browser is asked which rules match
// (CDP CSS.getMatchedStylesForNode) and, per property, which declaration wins (cascade order, !important honoured). Interactive elements are
// also read with :hover and :focus-visible forced, so state rules get their chance. A rule that never wins anything anywhere is a candidate.
// Candidates are then sorted into bins — only the first bin is safe to delete without looking:
//   safe       plain selector, no state, not in a media query, none of its classes appear in src/*.js
//   in-src     its classes are written by code (a screen the harness does not open may need it) — look before deleting
//   state      has :hover / :focus / :active / :disabled / :checked / [hidden] / .on … — keep unless the state was reachable
//   media      inside @media / @supports / @container — the harness runs one width here
//   pseudo     ::before / ::after / ::placeholder / scrollbar parts — matched styles do not report wins for these reliably
//   node tools/dev/css-harness/deadrules.cjs [--quick] [--only name,name]   → out/deadrules.json + a summary on stdout
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { SCENES, ARCH, answer, B } = require('./scenes.cjs');
const ST = process.env.ST_URL || 'http://127.0.0.1:8000/';
const ROOT = path.join(__dirname, '../../..');
const args = process.argv.slice(2); const quick = args.includes('--quick'); const oi = args.indexOf('--only'); const only = oi >= 0 ? args[oi + 1].split(',') : null;
(async () => {
    try { await fetch(ST); } catch { console.log('SillyTavern is not answering at ' + ST); process.exit(2); }
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 870 } });
    const cdp = await p.context().newCDPSession(p); const sheets = {};
    cdp.on('CSS.styleSheetAdded', e => { sheets[e.header.styleSheetId] = e.header.sourceURL; });
    await p.goto(ST, { waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.SillyTavern?.getContext?.().characters?.length > 0, null, { timeout: 60000 }); await p.waitForTimeout(1500);
    await p.evaluate(async () => { await SillyTavern.getContext().selectCharacterById(0); }); await p.waitForTimeout(1000);
    await p.evaluate(async () => { await SillyTavern.getContext().openCharacterChat('na_test'); }); await p.waitForTimeout(1500);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); await p.waitForTimeout(500);
    const ours = id => /NarrativeArchive\/style\.css/.test(sheets[id] || '');
    if (!Object.values(sheets).some(u => /NarrativeArchive\/style\.css/.test(u))) { console.log('style.css not seen by CDP'); process.exit(1); }
    await p.route('http://127.0.0.1:5555/**', async route => { const txt = answer(route.request().postData() || ''); await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: txt } }] }) }); });
    await p.evaluate(async ([B]) => { const core = await import(B + 'core.js'); const g = core.globalSettings(); for (const k of ['draftConn', 'aiConn']) g[k] = { ...(g[k] || {}), mode: 'custom', url: 'http://127.0.0.1:5555/v1', model: 'fake', key: 'x', fmt: 'openai' }; }, [B]);
    const seen = new Map(), win = new Map(); const key = r => `${(r.style.range ? r.style.range.startLine + 1 : '?')}: ${r.selectorList.text}`;
    const tally = m => {
        const rules = (m.matchedCSSRules || []).map(x => x.rule).filter(r => r.origin === 'regular'); const best = {};
        for (const r of rules) { const k = key(r); if (ours(r.styleSheetId)) seen.set(k, (seen.get(k) || 0) + 1);
            for (const d of r.style.cssProperties || []) { if (d.disabled || !d.text) continue; const cur = best[d.name]; if (!cur || d.important || !cur.imp) best[d.name] = { k, imp: !!d.important, ours: ours(r.styleSheetId) }; } }
        for (const v of Object.values(best)) if (v.ours) win.set(v.k, (win.get(v.k) || 0) + 1);
        // pseudo-element rules (::before/::after) come separately; a declaration there counts as a win for its rule
        for (const pm of m.pseudoElements || []) for (const x of pm.matches || []) { const r = x.rule; if (r.origin !== 'regular' || !ours(r.styleSheetId)) continue; const k = key(r); seen.set(k, (seen.get(k) || 0) + 1); if ((r.style.cssProperties || []).some(d => d.text)) win.set(k, (win.get(k) || 0) + 1); }
    };
    const scan = async root => {
        const { root: doc } = await cdp.send('DOM.getDocument', { depth: -1 }); const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: doc.nodeId, selector: `${root}, ${root} *` });
        const sigs = new Set();
        for (const nodeId of nodeIds) { let m; try { m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId }); } catch { continue; } tally(m);
            // interactive: one of each tag+class signature also with hover and focus forced
            const desc = await cdp.send('DOM.describeNode', { nodeId }).catch(() => null); const node = desc?.node; if (!node) continue;
            const attrs = node.attributes || []; const cls = attrs[attrs.indexOf('class') + 1] || ''; const tag = node.nodeName;
            if (!/^(BUTTON|INPUT|SELECT|TEXTAREA|LABEL|A)$/.test(tag) && !/role="?button/.test(attrs.join(' '))) continue;
            const sig = tag + '|' + cls; if (sigs.has(sig) || sigs.size > 60) continue; sigs.add(sig);
            for (const st of [['hover'], ['focus', 'focus-visible'], ['active']]) { await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: st }); const mm = await cdp.send('CSS.getMatchedStylesForNode', { nodeId }).catch(() => null); if (mm) tally(mm); }
            await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] }); }
    };
    let archNow = null; let n = 0; const t0 = Date.now();
    for (const na of quick ? ['light'] : ['light', 'dark']) { await p.evaluate(t => document.body.classList.toggle('na_darkui', t === 'dark'), na);
        for (const sc of SCENES) { if (sc.phone || (only && !only.includes(sc.name))) continue;
            try { if (archNow !== sc.arch) { await p.evaluate(async ([B, A, arch]) => { const core = await import(B + 'core.js'); const m = core.getMeta(); delete m.studio; m.retitled = []; delete m.layers; m.history = []; m.snapshots = []; m.text = ''; if (arch === 'empty') await core.saveMeta(); else await core.commitText(A, 'harness', { boundary: arch === 'studio' ? 5 : 29 }); }, [B, ARCH, sc.arch]); archNow = sc.arch; }
                await sc.open(p, {}); await scan(sc.root); n++; if (n % 10 === 0) console.log(`${n} scenes · ${((Date.now() - t0) / 60000).toFixed(1)} min`); }
            catch (e) { console.log('skip', sc.name, na, String(e.message).slice(0, 80)); }
            finally { if (sc.close) await sc.close(p).catch(() => {}); await p.evaluate(() => { document.querySelectorAll('dialog.popup').forEach(d => { try { d.close(); } catch {} d.remove(); }); window.toastr?.clear?.(); }); await p.waitForTimeout(250); } } }
    await b.close();
    // --- sort the candidates ---
    const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8').split('\n');
    const src = fs.readdirSync(path.join(ROOT, 'src')).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n') + fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');
    const inMedia = line => { let depth = 0; for (let i = 0; i < line - 1; i++) { const l = css[i]; if (/^\s*@(media|supports|container)\b/.test(l)) depth++; if (depth && /^\}\s*$/.test(l)) depth--; } return depth > 0; };
    const bins = { safe: [], 'in-src': [], state: [], media: [], pseudo: [] };
    for (const k of [...seen.keys()].filter(k => !win.has(k)).sort((a, b) => parseInt(a) - parseInt(b))) {
        const line = parseInt(k); const sel = k.slice(k.indexOf(':') + 2);
        if (/::|:-webkit-|:placeholder/.test(sel)) bins.pseudo.push(k);
        else if (/:(hover|focus|focus-visible|focus-within|active|disabled|checked|indeterminate|empty|has\(|not\(|is\(|where\()|\[hidden\]|\[disabled\]|\[aria-|\.on\b|\.active\b|\.open\b|\.goes\b|\.none\b|\.same\b|\.part\b|\.busy\b|\.sel\b|\.off\b/.test(sel)) bins.state.push(k);
        else if (!Number.isNaN(line) && inMedia(line)) bins.media.push(k);
        else { const classes = [...sel.matchAll(/\.([A-Za-z0-9_-]+)/g)].map(x => x[1]); const used = classes.filter(c => new RegExp('\\b' + c.replace(/[-]/g, '\\-') + '\\b').test(src)); (used.length ? bins['in-src'] : bins.safe).push(k); }
    }
    fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'out', 'deadrules.json'), JSON.stringify({ scenes: n, matched: seen.size, winning: win.size, bins }, null, 1));
    console.log(`\n${n} scene openings · rules reached: ${seen.size} · decide something: ${win.size} · never decide anything: ${seen.size - win.size}`);
    for (const [bin, list] of Object.entries(bins)) console.log(`  ${bin.padEnd(7)} ${String(list.length).padStart(4)}`);
    console.log('\nsafe to delete (never win, no state, not in media, classes not in src):'); console.log(bins.safe.join('\n') || '  (none)');
})();
