const { execFileSync } = require('child_process'); const fs = require('fs'); const { chromium } = require('playwright');
const [src, la, lo, ter, title, sub, out] = process.argv.slice(2);
const V = [['높이 없음', '', ''], ['면 단계', ter, 'steps'], ['면 단계 + 그림자 두 톤', ter, 'steps+shade']];
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 }); const cells = [];
  for (const [t, T, st] of V) { const h = `${out}-${st || 'flat'}.html`;
    execFileSync('node', ['/home/user/NarrativeArchive/docs/mockups/phone-map/osm/osmmap.js', src, h, la, lo, '1500'], { env: { ...process.env, TERRAIN: T, TSTYLE: st } });
    await p.goto('file://' + h); await p.evaluate(([a, c]) => { document.querySelector('.sh h2').textContent = a; document.querySelector('.sh p').textContent = c; }, [title, sub]);
    const s = h.replace('.html', '.png'); await p.locator('.ph').screenshot({ path: s }); cells.push([t, s]); }
  fs.writeFileSync(out + '.html', `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#d9dce2;font:15px -apple-system,'Noto Sans KR',sans-serif"><div style="display:flex;gap:20px">` + cells.map(([t, s]) => `<div><b>${t}</b><br><img src="${s}" width=408></div>`).join('') + '</div>');
  await p.setViewportSize({ width: 1330, height: 920 }); await p.goto('file://' + out + '.html'); await p.screenshot({ path: out + '.png', fullPage: true }); await b.close(); })();
