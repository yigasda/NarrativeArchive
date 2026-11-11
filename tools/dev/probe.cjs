// Drive the real phone in a local SillyTavern with Playwright and screenshot it. See docs/DESIGN.md › 실제 폰에서 확인.
//   node tools/dev/probe.cjs [light|dark]          → shots/ 아래에 홈 · 홈2 · 은행 · 지갑 스크린샷 예시
// As a module: const { open } = require('./probe.cjs'); const s = await open('light'); await s.to('bank'); await s.shot('x'); await s.close();
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ST = process.env.ST_URL || 'http://127.0.0.1:8000/';
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const ARCH = `## #1–#12 — The garage (Oct 24, evening, Varo)
PLOT:
- Mara finds Ren waiting at the old garage in Varo; they argue about the key Ivo lent her (#3–#7).
- Ren leaves before she can answer; Mara photographs the sunset behind the garage (#10).

## #13–#25 — The flooded road (Oct 25, afternoon, Eastgate → Varo)
PLOT:
- The road from Eastgate is closed by the flood; Mara takes the bus back to Varo (#14–#18).
- Ivo calls twice; Mara does not pick up (#20).
- Ren texts that he is waiting at the garage; Mara answers she will be there in five minutes (#24).

# STATE
## Mara
- German, lives in Varo; has Ivo's workshop key, promised to return it Saturday.
## Ren
- Waiting at the garage; apologised for the argument.
## Ivo
- Runs the workshop; wants his key back.
`;
async function open(theme = 'light', { width = 412, out = 'shots', video = '', make = true } = {}) {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width, height: 1100 }, deviceScaleFactor: 2, ...(video ? { recordVideo: { dir: video, size: { width, height: 1100 } } } : {}) });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(String(e.stack || e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(ST, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.SillyTavern?.getContext?.().characters?.length > 0, null, { timeout: 60000 }); await p.waitForTimeout(2000);
    await p.evaluate(async () => { await SillyTavern.getContext().selectCharacterById(0); }); await p.waitForTimeout(1500);
    await p.evaluate(async () => { await SillyTavern.getContext().openCharacterChat('na_test'); }); await p.waitForTimeout(2000);
    await p.evaluate(t => document.body.classList.toggle('na_darkui', t === 'dark'), theme);
    // the archive text, a fresh phone, and both model connections pointed at the fake model
    await p.evaluate(async ({ B, ARCH }) => {
        const core = await import(B + 'core.js'); const m = core.getMeta(); m.text = ARCH; delete m.phones; m.dateOrder ||= 'md';
        const g = core.globalSettings(), fake = { mode: 'custom', url: 'http://127.0.0.1:5555/v1', key: 'k', model: 'fake', fmt: 'openai' };
        g.draftConn = { ...fake }; g.aiConn = { ...fake }; g.faces = g.faces || {}; for (const n of ['mara', 'ren', 'ivo']) g.faces[n] = 'none';
        (await import(B + 'phone.js')).openPhone('Mara');
    }, { B, ARCH });
    await p.waitForTimeout(800);
    // no phone yet → 폰 만들기 준비 straight away: 위치 연동, then 이대로 폰 만들기 (make: false stops on the prep screen)
    await p.waitForSelector('.na_ph_preplink', { timeout: 15000 });
    if (make) {
        await p.click('.na_ph_preplink'); await p.waitForSelector('.na_ph_prepmake:not([disabled])', { timeout: 30000 }); await p.waitForTimeout(300);
        await p.click('.na_ph_prepmake'); await p.waitForTimeout(400);
        if (await p.$('.pcf_ok[data-v="b"]')) await p.click('.pcf_ok[data-v="b"]');
        await p.waitForSelector('.cg_lock', { timeout: 30000 }); await p.waitForTimeout(1500);
        await p.click('.cg_lkopen'); await p.waitForTimeout(300);
    }
    fs.mkdirSync(out, { recursive: true });
    const s = {
        p, errs,
        // open any route the way a tap would: data-go (+ data-i)
        to: async (go, i) => { await p.evaluate(([go, i]) => { const x = document.createElement('button'); x.dataset.go = go; if (i !== undefined) x.dataset.i = i; x.style.display = 'none'; document.querySelector('.na_ph_frame .na_ph_scr').append(x); x.click(); }, [go, i]); await p.waitForTimeout(350); },
        shot: async n => { const f = path.join(out, `${n}_${theme}.png`); await (await p.$('.na_ph_frame')).screenshot({ path: f }); return f; },
        scroll: async (y = 1e6) => { await p.evaluate(y => { const e = document.querySelector('.na_ph_frame .ax_scroll'); if (e) e.scrollTop = y; }, y); await p.waitForTimeout(200); },
        // run code in the page with the extension's modules: s.run(async ({ core, ph }) => { ph.money.tx.push(...) })
        run: (fn, arg) => p.evaluate(async ([B, src, arg]) => { const core = await import(B + 'core.js'), pd = await import(B + 'phonedata.js'), fin = await import(B + 'finance.js'); const m = core.getMeta(), ph = m.phones.mara; const r = await (0, eval)(`(${src})`)({ core, pd, fin, m, ph, arg }); pd.ensureIds(ph); return r; }, [B, fn.toString(), arg]),
        // anything sticking out sideways past the screen
        overflow: () => p.evaluate(() => { const s = document.querySelector('.na_ph_scr'), R = s.getBoundingClientRect(), out = []; for (const e of s.querySelectorAll('*')) { const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; let c = e.parentElement, clip = false; while (c && c !== s) { const o = getComputedStyle(c).overflowX; if (o !== 'visible' && c.getBoundingClientRect().right <= R.right + 1) { clip = true; break; } c = c.parentElement; } if (!clip && (r.right > R.right + 1 || r.left < R.left - 1)) out.push(String(e.className?.baseVal ?? e.className ?? e.tagName).slice(0, 30)); } return [...new Set(out)].slice(0, 8); }),
        // the page's own errors, without SillyTavern's usual 500s from its own endpoints
        errors: () => errs.filter(e => !/500|Internal S|Failed to load/.test(e)),
        close: async () => { const v = p.video(); await ctx.close(); await b.close(); return v ? v.path() : null; },
    };
    return s;
}
// a small bank, so money screens have something
const SAMPLE_MONEY = async ({ ph, pd, fin, m }) => {
    ph.money = { currency: 'EUR', asOf: '10-25', bank: { name: 'Varo Bank', accounts: [{ kind: 'checking', name: 'Girokonto', last4: '4821', currency: 'EUR', balance: 1284.17 }, { kind: 'credit', name: 'Kreditkarte', last4: '7710', currency: 'EUR', balance: 0 }, { kind: 'savings', name: 'Tagesgeld', last4: '9902', currency: 'EUR', balance: 6420 }] },
        cards: [{ account: '4821', exp: '08/28' }, { account: '7710', exp: '03/27' }],
        tx: [{ time: '10-25 09:12', who: 'Bäckerei Krume', amount: -4.8, account: '4821', kind: 'card', memo: 'Brezel, Kaffee' }, { time: '10-25 08:02', who: 'Ren', amount: -20, account: '4821', kind: 'transfer', memo: 'Pizza' }, { time: '10-24 18:40', who: 'Varo Air', amount: -189, account: '7710', kind: 'card', pending: true }, { time: '10-24 12:00', who: 'Ivo Werkstatt', amount: 1450, account: '4821', kind: 'deposit', memo: 'Lohn Oktober' }, { time: '10-22 10:00', who: 'Miete', amount: -620, account: '4821', kind: 'transfer', memo: 'Oktober' }, { time: '10-21 15:00', who: 'Netflix', amount: -13.99, account: '7710', kind: 'card' }, { time: '09-21 15:00', who: 'Netflix', amount: -13.99, account: '7710', kind: 'card' }],
        passes: [{ kind: 'flight', by: 'Varo Air', from: 'Varo', to: 'Lisboa', date: '10-30', time: '04:55', seat: '14C', gate: 'B12', no: 'VA231', status: '' }, { kind: 'movie', by: 'Kino Metropol', title: 'Dune', date: '09-14', time: '20:00', seat: 'R5', status: 'used' }], orders: [] };
    pd.ensureIds(ph); fin.migrateBank(m, ph);
};
module.exports = { open, SAMPLE_MONEY };
if (require.main === module) (async () => {
    const s = await open(process.argv[2] || 'light');
    await s.shot('home'); await s.to('home2'); await s.shot('home2');
    await s.run(SAMPLE_MONEY); await s.to('bank'); await s.shot('bank'); await s.to('wallet'); await s.shot('wallet');
    console.log('overflow', await s.overflow()); console.log('errors', s.errors());
    await s.close();
})();
