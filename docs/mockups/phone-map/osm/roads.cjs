const { execFileSync } = require('child_process'); const fs = require('fs'); const { chromium } = require('playwright');
const P = [['', '지금'], ['1', '한 단계 연하게'], ['2', '두 단계 연하게']];
const dir = process.argv[2], out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 }); const cells = [];
  for (const [r, t] of P) { const h = `${out}/road${r || 0}.html`;
    execFileSync('node', ['/home/user/NarrativeArchive/docs/mockups/phone-map/osm/osmmap.js', `${dir}/frankfurt-bankenviertel.json`, h, '50.11', '8.67', '1500'], { env: { ...process.env, ROAD: r } });
    await p.goto('file://' + h); await p.evaluate(() => { document.querySelector('.sh h2').textContent = '🇩🇪 Frankfurt am Main'; document.querySelector('.sh p').textContent = 'Bankenviertel · Hauptbahnhof'; });
    const s = h.replace('.html', '.png'); await p.locator('.ph').screenshot({ path: s }); cells.push([t, s]); }
  fs.writeFileSync(out + '/roads.html', `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#d9dce2;font:15px -apple-system,'Noto Sans KR',sans-serif"><div style="display:flex;gap:20px">` + cells.map(([t, s]) => `<div><b>${t}</b><br><img src="${s}" width=408></div>`).join('') + '</div>');
  await p.setViewportSize({ width: 1330, height: 920 }); await p.goto('file://' + out + '/roads.html'); await p.screenshot({ path: out + '/roads.png', fullPage: true }); await b.close(); })();
