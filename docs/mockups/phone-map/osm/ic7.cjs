const { execFileSync } = require('child_process'); const fs = require('fs'); const { chromium } = require('playwright');
const S = process.argv[2], out = S + '/acph'; fs.mkdirSync(out, { recursive: true });
const places = [['muenchen-schwabing', 48.159, 11.582, 'Schwabing', 'München'], ['bamberg-altstadt', 49.892, 10.887, 'Bamberg', 'Oberfranken'], ['stuttgart-mitte', 48.778, 9.18, 'Stuttgart', 'Mitte'], ['dresden-altstadt', 51.052, 13.740, 'Dresden', 'Altstadt']];
const V = [['0', '색 정함 · 작은 아이콘 없음']];
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 }); const rows = [];
  for (const [n, la, lo, name, sub] of places) { const cells = [];
    for (const [g, t] of V) { const h = `${out}/${n}-ic${g}.html`;
      execFileSync('node', ['/home/user/NarrativeArchive/docs/mockups/phone-map/osm/osmmap.js', `${S}/osm_de/${n}.json`, h, String(la), String(lo), '1500'], { env: { ...process.env, STYLE: 'gmap', MAIN: name, ICONS: g } });
      await p.goto('file://' + h); await p.evaluate(([a, c]) => { document.querySelector('.sh h2').textContent = '🇩🇪 ' + a; document.querySelector('.sh p').textContent = c; }, [name, sub]);
      const s = h.replace('.html', '.png'); await p.locator('.ph').screenshot({ path: s }); cells.push([t, s]); }
    rows.push(cells); }
  fs.writeFileSync(out + '/ic7.html', `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#d9dce2;font:600 16px -apple-system,'Noto Sans KR',sans-serif;width:1800px">` + rows.map(cs => `<div style="display:inline-block;margin:0 14px 14px 0">` + cs.map(([t, s]) => `<div>${t}<br><img src="${s}" width=408 style="margin-top:6px"></div>`).join('') + '</div>').join(''));
  await p.setViewportSize({ width: 1820, height: 1000 }); await p.goto('file://' + out + '/ic7.html'); await p.screenshot({ path: out + '/IC7.jpg', fullPage: true, type: 'jpeg', quality: 86 }); await b.close(); })();
