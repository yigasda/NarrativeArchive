const { ICON, glyph } = require('/home/user/NarrativeArchive/docs/mockups/phone-map/osm/icons.js'); const fs = require('fs'); const { chromium } = require('playwright');
const names = Object.keys(ICON), cols = 10, cw = 74, ch = 64;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cw}" height="${Math.ceil(names.length / cols) * ch}" style="background:#f5f5f3">`;
names.forEach((n, i) => { const x = (i % cols) * cw + cw / 2, y = Math.floor(i / cols) * ch + 24;
  svg += `<g transform="translate(${x} ${y})"><circle r="13" fill="#fff" stroke="#d6d6d1"/><g fill="none" stroke="#8a7f73" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" transform="translate(-9 -9) scale(.75)">${glyph(n)}</g></g><text x="${x}" y="${y + 30}" font: font-family="sans-serif" font-size="9.5" text-anchor="middle" fill="#666">${n}</text>`; });
fs.writeFileSync(process.argv[2] + '/icons.html', `<!doctype html><body style="margin:0">${svg}</svg>`);
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: cols * cw, height: 600 }, deviceScaleFactor: 2 }); await p.goto('file://' + process.argv[2] + '/icons.html'); await p.locator('svg').screenshot({ path: process.argv[2] + '/icons.png' }); await b.close(); console.log(names.length); })();
