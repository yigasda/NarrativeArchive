const { execFileSync } = require('child_process'); const fs = require('fs'); const { chromium } = require('playwright');
const places = [['hamburg-altona', 53.55, 9.935], ['frankfurt-bankenviertel', 50.11, 8.67]];
const dir = process.argv[2], out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 }); const cells = [];
  for (const [n, la, lo] of places) for (const [r, t] of [['old', '처음'], ['dash', 'A 점선 (구내 뺌)'], ['band', 'B 회색 띠 + 흰 줄']]) { const h = `${out}/${n}-${r}.html`;
    execFileSync('node', ['/home/user/NarrativeArchive/docs/mockups/phone-map/osm/osmmap.js', `${dir}/${n}.json`, h, String(la), String(lo), '1500'], { env: { ...process.env, RAIL: r } });
    await p.goto('file://' + h); await p.addStyleTag({ content: '.ph{border:0;border-radius:0}' }); const s = h.replace('.html', '.png'); await p.locator('svg').screenshot({ path: s }); cells.push([n + ' · ' + t, s]); }
  fs.writeFileSync(out + '/rail.html', `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#d9dce2;font:15px -apple-system,'Noto Sans KR',sans-serif;width:${6*406+16}px"><div style="display:grid;grid-template-columns:repeat(6,390px);gap:16px">` + cells.map(([t, s]) => `<div><b>${t}</b><div style="height:500px;overflow:hidden;border-radius:14px;margin-top:6px"><img src="${s}" width=390></div></div>`).join('') + '</div>');
  await p.setViewportSize({ width: 2470, height: 560 }); await p.goto('file://' + out + '/rail.html'); await p.screenshot({ path: out + '/rail.png', fullPage: true }); await b.close(); })();
