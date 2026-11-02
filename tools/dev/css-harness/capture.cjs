// Capture every scene (tools/dev/css-harness/scenes.cjs) as a screenshot + a computed-style dump, across the matrix
//   extension theme: light · dark   ×   SillyTavern theme: default · Dark Lite · Cappuccino · hostile   ×   width: 412 · 1280
// so two labels can be compared pixel for pixel and value for value (compare.cjs). CSS cleanup must leave both diffs at zero.
//   node tools/dev/css-harness/capture.cjs <label> [--quick] [--only name,name] [--st default,hostile] [--w 412]
//   --quick = light · dark × default ST theme × 412 only (about 4 minutes); the full matrix takes 25–35 minutes.
// Output: tools/dev/css-harness/out/<label>/<scene>__<na>__<st>__<w>.png / .json  (gitignored)
const fs = require('fs'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const { chromium } = require('playwright');
const { SCENES, ARCH, answer, B, OWNERS } = require('./scenes.cjs');
const ST = process.env.ST_URL || 'http://127.0.0.1:8000/';
const ROOT = path.join(__dirname, '../../..');
const args = process.argv.slice(2); const label = args.find(a => !a.startsWith('--')) || 'run';
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const quick = args.includes('--quick'); if (args.includes('--fast')) args.push('--nopng', '--nostates');
const NA = ['light', 'dark'];
// 'default' is the theme the user has set in SillyTavern (Dark Lite here); the other two are real themes with very different colours; 'hostile' is hostile.css on top of the default
const STT = (opt('--st') || (quick ? 'default' : 'default,Cappuccino,Celestial Macaron,hostile')).split(',');
const WIDTHS = (opt('--w') || (quick ? '412' : '412,1280')).split(',').map(Number);
const owner = opt('--owner');
const only = opt('--only')?.split(',') || (owner ? (OWNERS[owner] || (() => { console.log('unknown --owner; one of: ' + Object.keys(OWNERS).join(' · ')); process.exit(2); })()) : null);
const noPng = args.includes('--nopng'), noStates = args.includes('--nostates'); // --fast = both: values only, about a third of the time
const skipExisting = args.includes('--skip-existing');
const OUT = path.join(__dirname, 'out', label);
const HOSTILE = fs.readFileSync(path.join(__dirname, 'hostile.css'), 'utf8');
// the computed properties we compare (no transitions/animations: those are frozen below and not part of the look)
const PROPS = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderTopWidth', 'borderTopStyle', 'borderRightColor', 'borderRightWidth', 'borderBottomColor', 'borderBottomWidth', 'borderLeftColor', 'borderLeftWidth', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius', 'boxShadow', 'opacity', 'fontSize', 'fontWeight', 'fontFamily', 'fontStyle', 'lineHeight', 'letterSpacing', 'textDecorationLine', 'textTransform', 'textAlign', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'gap', 'display', 'visibility', 'outlineColor', 'outlineWidth', 'outlineStyle', 'accentColor', 'fill', 'stroke', 'filter', 'backdropFilter', 'mixBlendMode', 'webkitMaskImage', 'minHeight', 'maxHeight'];
const portOpen = port => new Promise(r => { const s = net.connect(port, '127.0.0.1'); s.once('connect', () => { s.end(); r(true); }); s.once('error', () => r(false)); });
if (require.main === module) (async () => {
    fs.mkdirSync(OUT, { recursive: true });
    try { await fetch(ST); } catch { console.log('SillyTavern is not answering at ' + ST + ' — start it first (docs/DESIGN.md › 실제 폰에서 확인)'); process.exit(2); }
    // the phone's fake model
    let fake = null; if (!await portOpen(5555)) { fake = spawn('node', [path.join(ROOT, 'tools/dev/fakeph.mjs')], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800)); }
    const total = WIDTHS.length * STT.length * NA.length * SCENES.filter(sc => !only || only.includes(sc.name)).length;
    console.log(`${label}: ${total} captures planned (${WIDTHS.join('·')} × ${STT.join('·')} × ${NA.join('·')} × ${SCENES.filter(sc => !only || only.includes(sc.name)).length} scenes)`);
    const b = await chromium.launch(); const results = []; let baseTheme = null; // the user's own ST theme, read once: 'default' means this one
    try {
        for (const width of WIDTHS) for (const st of STT) {
            const ctx = await b.newContext({ viewport: { width, height: 870 }, deviceScaleFactor: 1 });
            const p = await ctx.newPage(); await p.clock.setFixedTime(new Date('2026-10-26T12:00:00'));
            p.on('pageerror', e => results.push({ error: String(e).slice(0, 160) }));
            await p.goto(ST, { waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.SillyTavern?.getContext?.().characters?.length > 0, null, { timeout: 60000 }); await p.waitForTimeout(1500);
            await p.evaluate(async () => { await SillyTavern.getContext().selectCharacterById(0); }); await p.waitForTimeout(1000);
            await p.evaluate(async () => { await SillyTavern.getContext().openCharacterChat('na_test'); }); await p.waitForTimeout(1500);
            // freeze motion so timing never changes a pixel; the properties above do not include transitions
            // (backdrop blur renders with noise in headless Chromium, so it is off for the pixels; the blur value itself is still compared in the JSON)
            await p.addStyleTag({ content: '*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; animation-delay: 0s !important; caret-color: transparent !important; backdrop-filter: none !important; }' + (process.env.NA_HARNESS_CSS || '') });
            await p.evaluate(async ([B]) => { const core = await import(B + 'core.js'); const g = core.globalSettings(); for (const k of ['draftConn', 'aiConn']) g[k] = { ...(g[k] || {}), mode: 'custom', url: 'http://127.0.0.1:5555/v1', model: 'fake', key: 'x', fmt: 'openai' }; g.faces = g.faces || {}; for (const n of ['mara', 'ren', 'ivo']) g.faces[n] = 'none'; }, [B]);
            if (baseTheme === null) baseTheme = await p.evaluate(() => String($('#themes').val() || ''));
            const origTheme = baseTheme;
            const stNames = await p.evaluate(() => [...document.querySelectorAll('#themes option')].map(o => o.value));
            {
                if (st !== 'default' && st !== 'hostile' && !stNames.includes(st)) { results.push({ error: `ST theme not installed: ${st}` }); await ctx.close(); continue; }
                await p.evaluate(([st, orig]) => { $('#themes').val(st === 'default' || st === 'hostile' ? orig : st).trigger('change'); document.getElementById('na_hostile')?.remove(); }, [st, origTheme]).catch(() => {});
                if (st === 'hostile') await p.evaluate(css => { const s = document.createElement('style'); s.id = 'na_hostile'; s.textContent = css; document.head.append(s); }, HOSTILE);
                await p.waitForTimeout(500);
                for (const na of NA) {
                    await p.evaluate(t => document.body.classList.toggle('na_darkui', t === 'dark'), na);
                    let archNow = null;
                    for (const sc of SCENES) {
                        if (only && !only.includes(sc.name)) continue;
                        const tag = `${sc.name}__${na}__${st.replace(/\s+/g, '')}__${width}`;
                        if (skipExisting && fs.existsSync(path.join(OUT, tag + '.json')) && (noPng || fs.existsSync(path.join(OUT, tag + '.png')))) continue;
                        const t0 = Date.now();
                        try {
                            if (archNow !== sc.arch) { await setArch(p, sc.arch); archNow = sc.arch; }
                            // window scenes answer from the in-page fake; the phone talks to tools/dev/fakeph.mjs
                            await p.unroute('http://127.0.0.1:5555/**').catch(() => {});
                            if (!sc.phone) await p.route('http://127.0.0.1:5555/**', async route => { const body = route.request().postData() || ''; const txt = answer(body); const isAnth = /anthropic|\/messages/.test(route.request().url()); await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(isAnth ? { content: [{ type: 'text', text: txt }] } : { choices: [{ message: { role: 'assistant', content: txt } }] }) }); });
                            await sc.open(p, helpers);
                            // every web font in, so glyphs are the same pixels run after run (the phone loads Noto Sans KR lazily)
                            await p.evaluate(() => document.fonts.ready); await p.waitForFunction(() => [...document.fonts].every(f => f.status !== 'loading'), null, { timeout: 5000 }).catch(() => {});
                            await p.waitForTimeout(500);
                            const el = await p.$(sc.root); if (!el) throw new Error('root not found: ' + sc.root);
                            if (noPng) { /* values only */ }
                            else if (sc.root.startsWith('dialog') || sc.shot === 'page') await p.screenshot({ path: path.join(OUT, tag + '.png'), animations: 'disabled', caret: 'hide' });
                            else await el.screenshot({ path: path.join(OUT, tag + '.png'), animations: 'disabled', caret: 'hide' });
                            const dump = await styleDump(p, sc.root, { states: !noStates });
                            fs.writeFileSync(path.join(OUT, tag + '.json'), JSON.stringify(dump));
                            // where the root sat: a fractional offset rasterises gradients and shadows differently, so this is logged for diagnosis
                            const rect = await el.boundingBox();
                            results.push({ tag, n: dump.length, ms: Date.now() - t0, rect: rect && [rect.x, rect.y, rect.width, rect.height].map(v => Math.round(v * 100) / 100) });
                            fs.writeFileSync(path.join(OUT, '_index.json'), JSON.stringify(results, null, 1));
                            // watch the pace: a line every 10 captures with the time left, and a hard stop when one capture takes 5x the usual (something is piling up — fix it, then resume with --skip-existing)
                            const done = results.filter(r => r.ms); const n = done.length; const avg = done.reduce((a, r) => a + r.ms, 0) / n;
                            if (n % 10 === 0) console.log(`${n}/${total} · ${(avg / 1000).toFixed(1)} s each · about ${Math.round((total - n) * avg / 60000)} min left`);
                            if (n > 10 && Date.now() - t0 > 5 * avg) { console.log(`STOP: ${tag} took ${((Date.now() - t0) / 1000).toFixed(0)} s, usual is ${(avg / 1000).toFixed(1)} s. Something is slowing the page down.`); process.exitCode = 3; throw new Error('pace'); }
                        } catch (e) { if (e.message === 'pace') throw e; results.push({ tag, error: String(e.message || e).slice(0, 200) });
                            if (results.slice(-3).every(r => r.error)) { let up = true; try { await fetch(ST); } catch { up = false; } if (!up) { console.log('STOP: SillyTavern stopped answering. Start it again and resume with --skip-existing'); process.exitCode = 4; throw new Error('pace'); } } }
                        finally { if (sc.close) await sc.close(p).catch(() => {}); await p.evaluate(() => { document.querySelectorAll('dialog.popup').forEach(d => { try { d.close(); } catch {} d.remove(); }); window.toastr?.clear?.(); }); await p.waitForTimeout(300);
                            const stray = await p.evaluate(() => document.querySelectorAll('dialog[open], .na_ph_frame').length); if (stray) results.push({ tag, error: `left behind after close: ${stray} dialog/phone` }); }
                    }
                }
            }
            await p.evaluate(orig => { document.getElementById('na_hostile')?.remove(); if (orig) $('#themes').val(orig).trigger('change'); }, origTheme).catch(() => {});
            await p.waitForTimeout(1500); await ctx.close(); // long enough for ST to save the restored theme
        }
    } finally { await b.close(); if (fake) fake.kill(); }
    const bad = results.filter(r => r.error);
    fs.writeFileSync(path.join(OUT, '_index.json'), JSON.stringify(results, null, 1));
    if (!process.exitCode) fs.writeFileSync(path.join(OUT, '_done.json'), JSON.stringify({ at: new Date().toISOString(), captures: results.filter(r => r.tag && !r.error).length, problems: bad.length, args }));
    console.log(`${label}: ${results.filter(r => r.tag && !r.error).length} captures → ${OUT}`);
    if (bad.length) { console.log('problems:'); for (const r of bad) console.log(' ', r.tag || '', r.error); }
})();

// --- the archive each scene expects ---
async function setArch(p, arch) {
    await p.evaluate(async ([B, A, arch]) => {
        const core = await import(B + 'core.js'); const m = core.getMeta();
        delete m.studio; m.retitled = []; delete m.layers;
        // the panel's history tab lists every commit, so start from nothing each time: one entry, same delta, same (frozen) time
        m.history = []; m.snapshots = []; m.text = '';
        if (arch === 'empty') { await core.saveMeta(); }
        // the studio needs messages left after the archive, so its archive stops at #5; everything else is archived to the end
        else await core.commitText(A, 'harness', { boundary: arch === 'studio' ? 5 : 29 });
    }, [B, ARCH, arch]);
    await p.waitForTimeout(300);
}
// --- phone helpers (the same moves as tools/dev/probe.cjs) ---
const helpers = {
    panel: async (p, scrollY) => {
        await p.$eval('#extensions-settings-button .drawer-icon', e => e.click()); await p.waitForTimeout(1000);
        await p.evaluate(() => { const c = document.querySelector('#na_settings .inline-drawer-content'); const t = document.querySelector('#na_settings .inline-drawer-toggle'); if (c && t && getComputedStyle(c).display === 'none') t.click(); });
        await p.waitForTimeout(600);
        const h = await p.$eval('#na_settings', e => e.getBoundingClientRect().height); if (h < 400) throw new Error(`panel not unfolded (height ${Math.round(h)})`);
        // the section list was drawn at page load from what was on disk: switch the view away and back so it redraws from the archive set just now
        await p.evaluate(() => { const b = v => document.querySelector(`#na_settings .na_seg_btn[data-view="${v}"]`); b('editor')?.click(); b('cards')?.click(); });
        await p.evaluate(y => { const el = document.querySelector('#na_settings'); el.scrollIntoView({ block: 'start' }); const sc = el.closest('.scrollableInner, #extensions_settings, .drawer-content') || el.parentElement; if (sc) sc.scrollTop += y; }, scrollY);
        await p.waitForTimeout(600);
    },
    phone: async p => {
        await p.evaluate(async ([B]) => { const core = await import(B + 'core.js'); const m = core.getMeta(); delete m.phones; (await import(B + 'phone.js')).openPhone('Mara'); }, [B]);
        await p.waitForSelector('.na_ph_makebtn', { timeout: 8000 }); await p.$eval('.na_ph_makebtn', e => e.click()); await p.waitForSelector('.cg_lock', { timeout: 20000 }); await p.waitForTimeout(1200); await p.$eval('.cg_lkopen', e => e.click()); await p.waitForTimeout(500);
    },
    phoneTo: async (p, go) => { await p.evaluate(go => { const x = document.createElement('button'); x.dataset.go = go; x.style.display = 'none'; document.querySelector('.na_ph_frame .na_ph_scr').append(x); x.click(); x.remove(); }, go); await p.waitForTimeout(700); },
    phoneMoney: async p => { const { SAMPLE_MONEY } = require('../probe.cjs'); await p.evaluate(async ([B, src]) => { const core = await import(B + 'core.js'), pd = await import(B + 'phonedata.js'), fin = await import(B + 'finance.js'); const m = core.getMeta(), ph = Object.values(m.phones || {})[0]; await (new Function('return ' + src)())({ ph, pd, fin, m }); await core.saveMeta(); }, [B, SAMPLE_MONEY.toString()]); await p.waitForTimeout(300); },
};
// --- every element inside the root: its path, classes and the computed look; interactive ones also hovered and focused ---
async function styleDump(p, root, { states = true } = {}) {
    const cdp = await p.context().newCDPSession(p); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const base = await p.evaluate(([root, PROPS]) => {
        window.__naSigs = new Set();
        const R = document.querySelector(root); const out = []; let i = 0;
        const pathOf = e => { const parts = []; while (e && e !== R) { let n = 0, s = e; while ((s = s.previousElementSibling)) n++; parts.unshift(n); e = e.parentElement; } return parts.join('/'); };
        for (const e of [R, ...R.querySelectorAll('*')]) {
            const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
            const rec = { path: pathOf(e), tag: e.tagName, cls: [...e.classList].sort().join(' '), w: Math.round(r.width), h: Math.round(r.height) };
            for (const k of PROPS) rec[k] = cs[k];
            for (const ps of ['::before', '::after']) { const q = getComputedStyle(e, ps); if (q.content && q.content !== 'none' && q.content !== 'normal') rec[ps] = [q.content, q.backgroundColor, q.color, q.borderTopColor, q.width, q.height, q.opacity].join('|'); }
            if (e.matches('button, input, select, textarea, label, a, [role=button], [tabindex]') && i < 40) { const sig = e.tagName + '|' + rec.cls + '|' + (e.disabled ? 'd' : ''); if (!window.__naSigs) window.__naSigs = new Set(); if (!window.__naSigs.has(sig)) { window.__naSigs.add(sig); rec.inter = true; e.setAttribute('data-na-h', i++); } }
            out.push(rec);
        }
        return out;
    }, [root, PROPS]);
    // forced :hover and :focus-visible on the interactive ones
    if (!states) { await p.evaluate(root => document.querySelectorAll(`${root} [data-na-h]`).forEach(e => e.removeAttribute('data-na-h')), root); await cdp.detach(); return base; }
    const { root: doc } = await cdp.send('DOM.getDocument', { depth: -1 });
    for (const rec of base.filter(r => r.inter)) {
        const idx = base.indexOf(rec);
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: doc.nodeId, selector: `${root} [data-na-h="${base.filter((r, j) => r.inter && j <= idx).length - 1}"]` }).catch(() => ({ nodeId: 0 }));
        if (!nodeId) continue;
        for (const [state, key] of [[['hover'], 'hover'], [['focus', 'focus-visible'], 'focus']]) {
            await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: state });
            rec[key] = await p.evaluate(([root, n, PROPS]) => { const e = document.querySelector(`${root} [data-na-h="${n}"]`); if (!e) return null; const cs = getComputedStyle(e); return ['color', 'backgroundColor', 'borderTopColor', 'boxShadow', 'outlineColor', 'outlineWidth', 'opacity', 'textDecorationLine'].map(k => cs[k]).join('|'); }, [root, base.filter((r, j) => r.inter && j <= idx).length - 1, PROPS]);
        }
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
    }
    await p.evaluate(root => document.querySelectorAll(`${root} [data-na-h]`).forEach(e => e.removeAttribute('data-na-h')), root);
    await cdp.detach();
    return base;
}
module.exports = { helpers, styleDump, PROPS };
