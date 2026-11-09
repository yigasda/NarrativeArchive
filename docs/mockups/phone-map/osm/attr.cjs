const { execFileSync } = require('child_process'); const fs = require('fs'); const { chromium } = require('playwright');
const S = process.argv[2];
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 });
  for (const [a, n] of [['', 'long'], ['short', 'short']]) { const h = `${S}/attr-${n}.html`;
    execFileSync('node', ['/home/user/NarrativeArchive/docs/mockups/phone-map/osm/osmmap.js', `${S}/osm_de/muenchen-schwabing.json`, h, '48.159', '11.582', '1500'], { env: { ...process.env, STYLE: 'gmap', MAIN: 'Schwabing', ATTR: a } });
    await p.goto('file://' + h); await p.evaluate(() => { document.querySelector('.sh h2').textContent = '🇩🇪 Schwabing'; document.querySelector('.sh p').textContent = 'München'; });
    await p.locator('.ph').screenshot({ path: `${S}/attr-${n}.png` }); }
  await b.close(); })();
