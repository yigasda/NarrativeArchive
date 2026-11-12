// node shot2.cjs → pick.jpg (고른 것 A+C 줄만)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.join(__dirname, 'mock.html') + '?only=A%2BC'); await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(__dirname, 'pick.jpg'), fullPage: true, quality: 88, type: 'jpeg' }); console.log(errs); await b.close(); })();
