const { execFileSync } = require('child_process'); const fs = require('fs'); const { chromium } = require('playwright');
const modes = [['BCD', '', 'B·C·D (지금 색)'], ['BCD', '1', 'B·C·D · 한 단계 진하게']];
const dir = process.argv[2], out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 }); const cells = [];
  for (const [m, deep, t] of modes) { const h = `${out}/${m}${deep}.html`;
    execFileSync('node', ['/home/user/NarrativeArchive/docs/mockups/phone-map/osm/osmmap.js', `${dir}/frankfurt-bankenviertel.json`, h, '50.11', '8.67', '1500'], { env: { ...process.env, FX: m, DEEP: deep } });
    await p.goto('file://' + h); await p.addStyleTag({ content: '.ph{border:0;border-radius:0}' }); await p.locator('svg').screenshot({ path: h.replace('.html', '.png') }); cells.push([t, h.replace('.html', '.png')]); }
  fs.writeFileSync(out + '/two.html', `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#d9dce2;font:15px -apple-system,'Noto Sans KR',sans-serif;width:828px"><div style="display:grid;grid-template-columns:repeat(2,390px);gap:16px">` + cells.map(([t, s]) => `<div><b>${t}</b><div style="height:500px;overflow:hidden;border-radius:14px;margin-top:6px"><img src="${s}" width=390></div></div>`).join('') + '</div>');
  await p.setViewportSize({ width: 860, height: 560 }); await p.goto('file://' + out + '/two.html'); await p.screenshot({ path: out + '/two.png', fullPage: true }); await b.close(); })();
