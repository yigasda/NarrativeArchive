const fs = require('fs'); const { chromium } = require('playwright'); const S = process.argv[2], L = process.argv[3].split(',');
(async () => { const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 800 } });
  fs.writeFileSync(S + '/qc.html', `<!doctype html><meta charset=utf-8><body style="margin:0;padding:10px;background:#d9dce2;font:600 15px sans-serif"><div style="display:flex;gap:10px">` + L.map(n => `<div>${n}<br><img src="allde/${n}.png" width=390 style="height:500px;object-fit:cover;object-position:top"></div>`).join('') + '</div>');
  await p.goto('file://' + S + '/qc.html'); await p.waitForTimeout(300); await p.screenshot({ path: S + '/qc.png', fullPage: true }); await b.close(); })();
