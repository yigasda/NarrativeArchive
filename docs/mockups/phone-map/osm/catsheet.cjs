const { ICON, glyph } = require('/home/user/NarrativeArchive/docs/mockups/phone-map/osm/icons.js'); const fs = require('fs'); const { chromium } = require('playwright');
const src = fs.readFileSync('/home/user/NarrativeArchive/docs/mockups/phone-map/osm/osmmap.js', 'utf8'); const CAT = Object.fromEntries([...src.match(/const CAT = \{([^}]*)\}/)[1].matchAll(/(\w+): '(#[0-9a-f]+)'/g)].map(x => [x[1], x[2]]));
const names = Object.keys(ICON), cols = 10, cw = 86, ch = 58;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cw}" height="${Math.ceil(names.length / cols) * ch}" style="background:#faf6ee">`;
names.forEach((n, i) => { const x = (i % cols) * cw + 18, y = Math.floor(i / cols) * ch + 22, c = CAT[n] || '#999';
  svg += `<g transform="translate(${x} ${y})"><circle r="7.5" fill="${c}"/><g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(-5 -5) scale(.42)">${glyph(n)}</g></g><text x="${x + 11}" y="${y + 3.6}" font-family="sans-serif" font-size="10.5" font-weight="600" fill="${c}" stroke="#fff" stroke-width="3" paint-order="stroke">${n}</text>`; });
fs.writeFileSync(process.argv[2] + '/cat.html', `<!doctype html><body style="margin:0">${svg}</svg>`);
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: cols * cw, height: 600 }, deviceScaleFactor: 2 }); await p.goto('file://' + process.argv[2] + '/cat.html'); await p.locator('svg').screenshot({ path: process.argv[2] + '/cat.png' }); await b.close(); })();
