// node shot.cjs → sheet.png (mock.html 전체)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.join(__dirname, 'mock.html')); await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(__dirname, process.argv[2] || 'sheet.jpg'), fullPage: true }); console.log(errs); await b.close(); })();
