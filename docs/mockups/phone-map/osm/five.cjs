const { execFileSync } = require('child_process'); const fs = require('fs'); const { chromium } = require('playwright');
const [n, la, lo] = ['frankfurt-bankenviertel', 50.11, 8.67];
const modes = [['', '지금'], ['A', 'A 큰 건물 색'], ['B', 'B 땅 쓰임 색'], ['C', 'C 축척'], ['D', 'D 그림자'], ['ABCD', '넷 다']];
const dir = process.argv[2], out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 }); const cells = [];
  for (const [m, t] of modes) { const h = `${out}/${m || '0'}.html`;
    execFileSync('node', ['/home/user/NarrativeArchive/docs/mockups/phone-map/osm/osmmap.js', `${dir}/${n}.json`, h, String(la), String(lo), '1500'], { env: { ...process.env, FX: m } });
    await p.goto('file://' + h); await p.addStyleTag({ content: '.ph{border:0;border-radius:0}' }); await p.locator('svg').screenshot({ path: h.replace('.html', '.png') }); cells.push([t, h.replace('.html', '.png')]); }
  const html = `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#d9dce2;font:15px -apple-system,'Noto Sans KR',sans-serif;width:${6*406+16}px"><div style="display:grid;grid-template-columns:repeat(6,390px);gap:16px">`
    + cells.map(([t, s]) => `<div><b>${t}</b><div style="height:500px;overflow:hidden;border-radius:14px;margin-top:6px"><img src="${s}" width=390></div></div>`).join('') + '</div>';
  fs.writeFileSync(out + '/five.html', html); await p.setViewportSize({ width: 2470, height: 560 }); await p.goto('file://' + out + '/five.html'); await p.screenshot({ path: out + '/five.png', fullPage: true }); await b.close(); })();
