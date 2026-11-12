const { execFileSync } = require('child_process'); const fs = require('fs'); const { chromium } = require('playwright');
const S = process.argv[2], out = S + '/abc'; fs.mkdirSync(out, { recursive: true });
const places = [['muenchen-schwabing', 48.159, 11.582, 'Schwabing', 'München'], ['garmisch-zentrum', 47.492, 11.096, 'Garmisch-Partenkirchen', 'Bayern'], ['koblenz-deutscheseck', 50.36, 7.60, 'Koblenz', 'Deutsches Eck'], ['ruedesheim-zentrum', 49.979, 7.924, 'Rüdesheim am Rhein', 'Rheingau']];
const V = [['', '지금'], ['A', 'A 따뜻한 연크림'], ['B', 'B 밝은 회색 · 세이지'], ['C', 'C 밝은 회색 · 살구 큰길']];
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 470, height: 900 }, deviceScaleFactor: 2 }); const rows = [];
  for (const [n, la, lo, name, sub] of places) { const cells = [];
    for (const [g, t] of V) { const h = `${out}/${n}-${g || 0}.html`;
      execFileSync('node', ['/home/user/NarrativeArchive/docs/mockups/phone-map/osm/osmmap.js', `${S}/osm_de/${n}.json`, h, String(la), String(lo), '1500'], { env: { ...process.env, STYLE: 'gmap', MAIN: name, GPAL: g } });
      await p.goto('file://' + h); await p.evaluate(([a, c]) => { document.querySelector('.sh h2').textContent = '🇩🇪 ' + a; document.querySelector('.sh p').textContent = c; }, [name, sub]);
      const s = h.replace('.html', '.png'); await p.locator('svg').screenshot({ path: s }); cells.push([t, s]); }
    rows.push([name, cells]); }
  fs.writeFileSync(out + '/abc.html', `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#d9dce2;font:600 15px -apple-system,'Noto Sans KR',sans-serif;width:${4 * 406 + 16}px">` + rows.map(([n, cs]) => `<div style="margin:10px 0 6px;font-size:18px">${n}</div><div style="display:grid;grid-template-columns:repeat(4,390px);gap:16px">` + cs.map(([t, s]) => `<div>${t}<div style="height:500px;overflow:hidden;border-radius:14px;margin-top:4px"><img src="${s}" width=390></div></div>`).join('') + '</div>').join(''));
  await p.setViewportSize({ width: 1660, height: 1000 }); await p.goto('file://' + out + '/abc.html'); await p.screenshot({ path: out + '/ABC.jpg', fullPage: true, type: 'jpeg', quality: 85 }); await b.close(); })();
