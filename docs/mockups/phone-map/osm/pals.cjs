const { execFileSync } = require('child_process'); const fs = require('fs'); const { chromium } = require('playwright');
const P = [['', '1', '진하게 (지금 톤)'], ['cool', '', '1 차가운 회색'], ['neutral', '', '2 중립 밝은 톤'], ['paper', '', '3 따뜻한 종이'], ['terra', '', '4 흙 · 테라코타']];
const dir = process.argv[2], out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 }); const cells = [];
  for (const [pal, deep, t] of P) { const h = `${out}/${pal || 'deep'}.html`;
    execFileSync('node', ['/home/user/NarrativeArchive/docs/mockups/phone-map/osm/osmmap.js', `${dir}/frankfurt-bankenviertel.json`, h, '50.11', '8.67', '1500'], { env: { ...process.env, FX: 'BCD', DEEP: deep, PAL: pal } });
    await p.goto('file://' + h); await p.evaluate(() => { document.querySelector('.sh h2').textContent = '🇩🇪 Frankfurt am Main'; document.querySelector('.sh p').textContent = 'Bankenviertel · Hauptbahnhof'; });
    const s = h.replace('.html', '.png'); await p.locator('.ph').screenshot({ path: s }); cells.push([t, s]); }
  fs.writeFileSync(out + '/pals.html', `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#d9dce2;font:15px -apple-system,'Noto Sans KR',sans-serif"><div style="display:flex;gap:20px">` + cells.map(([t, s]) => `<div><b>${t}</b><br><img src="${s}" width=408></div>`).join('') + '</div>');
  await p.setViewportSize({ width: 2180, height: 920 }); await p.goto('file://' + out + '/pals.html'); await p.screenshot({ path: out + '/pals.png', fullPage: true }); await b.close(); })();
