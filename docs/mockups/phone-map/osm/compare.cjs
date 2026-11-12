const { execFileSync } = require('child_process'); const fs = require('fs'); const { chromium } = require('playwright');
const places = [['frankfurt-bankenviertel', 50.11, 8.67], ['berlin-prenzlauerberg', 52.5365, 13.417], ['heidelberg-altstadt', 49.4125, 8.70], ['berlin-marzahn', 52.543, 13.564]];
const modes = [['', '지금'], ['A', 'A 큰 건물 색'], ['B', 'B 땅 쓰임 색'], ['C', 'C 동네마다 축척'], ['D', 'D 건물 그림자'], ['ABCD', '넷 다']];
const dir = process.argv[2], out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 470, height: 900 } }); const cells = [];
  for (const [n, la, lo] of places) for (const [m, t] of modes) { const h = `${out}/${n}-${m || '0'}.html`;
    execFileSync('node', ['/home/user/NarrativeArchive/docs/mockups/phone-map/osm/osmmap.js', `${dir}/${n}.json`, h, String(la), String(lo), '1500'], { stdio: 'inherit', env: { ...process.env, FX: m } });
    await p.goto('file://' + h); await p.addStyleTag({ content: '.ph{border:0;border-radius:0}' }); await p.locator('svg').screenshot({ path: h.replace('.html', '.png') }); cells.push([n, t, h.replace('.html', '.png')]); }
  const html = `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#d9dce2;font:13px -apple-system,'Noto Sans KR',sans-serif;width:${6*326+16}px"><div style="display:grid;grid-template-columns:repeat(6,310px);gap:16px">`
    + cells.map(([n, t, s]) => `<div><b>${t}</b> <span style="color:#666">${n}</span><div style="height:400px;overflow:hidden;border-radius:12px;margin-top:4px"><img src="${s}" width=310></div></div>`).join('') + '</div>';
  fs.writeFileSync(out + '/cmp.html', html); await p.setViewportSize({ width: 2000, height: 1000 }); await p.goto('file://' + out + '/cmp.html'); await p.screenshot({ path: out + '/cmp.png', fullPage: true }); await b.close(); })();
