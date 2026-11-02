// Which rules of style.css actually decide a value somewhere, and which never do (dead weight).
// For every scene, every element inside the root gets its matched rules from the browser (CDP CSS.getMatchedStylesForNode);
// per property the winning declaration is found (cascade order, !important honoured). A rule that never wins any property
// on any element in any scene can be deleted without changing a pixel — still re-check by grepping its classes in src/.
//   node tools/dev/css-harness/deadrules.cjs [--quick] [--only name,name]   → out/deadrules.json + a list on stdout
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { SCENES, ARCH, answer, B } = require('./scenes.cjs');
const ST = process.env.ST_URL || 'http://127.0.0.1:8000/';
const args = process.argv.slice(2); const quick = args.includes('--quick'); const oi = args.indexOf('--only'); const only = oi >= 0 ? args[oi + 1].split(',') : null;
(async () => {
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
    const scan = async root => {
        const { root: doc } = await cdp.send('DOM.getDocument', { depth: -1 }); const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: doc.nodeId, selector: `${root}, ${root} *` });
        for (const nodeId of nodeIds) { let m; try { m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId }); } catch { continue; }
            const rules = (m.matchedCSSRules || []).map(x => x.rule).filter(r => r.origin === 'regular'); const best = {};
            for (const r of rules) { const k = key(r); if (ours(r.styleSheetId)) seen.set(k, (seen.get(k) || 0) + 1);
                for (const d of r.style.cssProperties || []) { if (d.disabled || !d.text) continue; const cur = best[d.name]; if (!cur || d.important || !cur.imp) best[d.name] = { k, imp: !!d.important, ours: ours(r.styleSheetId) }; } }
            for (const v of Object.values(best)) if (v.ours) win.set(v.k, (win.get(v.k) || 0) + 1); }
    };
    let archNow = null;
    for (const na of quick ? ['light'] : ['light', 'dark']) { await p.evaluate(t => document.body.classList.toggle('na_darkui', t === 'dark'), na);
        for (const sc of SCENES) { if (sc.phone || (only && !only.includes(sc.name))) continue;
            try { if (archNow !== sc.arch) { await p.evaluate(async ([B, A, arch]) => { const core = await import(B + 'core.js'); const m = core.getMeta(); delete m.studio; m.retitled = []; delete m.layers; if (arch === 'empty') { m.text = ''; await core.saveMeta(); } else await core.commitText(A, 'harness', { boundary: 29 }); }, [B, ARCH, sc.arch]); archNow = sc.arch; }
                await sc.open(p, {}); await scan(sc.root); }
            catch (e) { console.log('skip', sc.name, String(e.message).slice(0, 80)); }
            finally { if (sc.close) await sc.close(p).catch(() => {}); await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close())); await p.waitForTimeout(250); } } }
    const dead = [...seen.keys()].filter(k => !win.has(k)).sort((a, b) => parseInt(a) - parseInt(b));
    fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'out', 'deadrules.json'), JSON.stringify({ matched: seen.size, winning: win.size, dead }, null, 1));
    console.log(`rules reached: ${seen.size} · decide something: ${win.size} · never decide anything (candidates to delete): ${dead.length}`); console.log(dead.join('\n'));
    await b.close();
})();
