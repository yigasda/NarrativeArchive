const { execFileSync } = require('child_process'); const fs = require('fs'); const { chromium } = require('playwright');
const [src, la, lo, title, sub, out] = process.argv.slice(2);
const V = [['예쁜 지도 · 반반', { STYLE: 'pretty', PAL: 'mix', MAIN: process.env.MAINNAME }], ['구글 지도 느낌', { STYLE: 'gmap', MAIN: process.env.MAINNAME }]];
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 }); const cells = [];
  for (const [i, [t, env]] of V.entries()) { const h = `${out}-${i}.html`;
    execFileSync('node', ['/home/user/NarrativeArchive/docs/mockups/phone-map/osm/osmmap.js', src, h, la, lo, '1500'], { env: { ...process.env, ...env } });
    await p.goto('file://' + h); await p.evaluate(([a, c]) => { document.querySelector('.sh h2').textContent = a; document.querySelector('.sh p').textContent = c; }, [title, sub]);
    const s = h.replace('.html', '.png'); await p.locator('.ph').screenshot({ path: s }); cells.push([t, s]); }
  fs.writeFileSync(out + '.html', `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#d9dce2;font:15px -apple-system,'Noto Sans KR',sans-serif"><div style="display:flex;gap:20px">` + cells.map(([t, s]) => `<div><b>${t}</b><br><img src="${s}" width=408></div>`).join('') + '</div>');
  await p.setViewportSize({ width: 890, height: 920 }); await p.goto('file://' + out + '.html'); await p.screenshot({ path: out + '.png', fullPage: true }); await b.close(); })();
