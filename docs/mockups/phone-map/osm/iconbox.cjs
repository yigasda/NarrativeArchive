// measure each glyph's real box in a browser, write OFF (shift to the 24-grid centre) into icons.js
const fs = require('fs'), { chromium } = require('playwright'), P = '/home/user/NarrativeArchive/docs/mockups/phone-map/osm/icons.js';
delete require.cache[P]; const { ICON } = require(P);
(async () => { const b = await chromium.launch(), p = await b.newPage();
  await p.setContent(`<svg xmlns="http://www.w3.org/2000/svg">${Object.entries(ICON).map(([n, d]) => `<path id="${n}" d="${d}" fill="none" stroke="#000" stroke-width="1.5"/>`).join('')}</svg>`);
  const box = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('path')].map(e => { const r = e.getBBox(); return [e.id, [r.x, r.y, r.width, r.height]]; })));
  await b.close();
  // optical nudges on top of the box: a light part (a mug's handle) pulls the box off the heavy part, so move the heavy part back to the middle
  const OPT = { beer: [1.4, 0], cafe: [1, 0] };
  const OFF = {}; for (const [n, [x, y, w, h]] of Object.entries(box)) { const o = OPT[n] || [0, 0], dx = +(12 - (x + w / 2) + o[0]).toFixed(2), dy = +(12 - (y + h / 2) + o[1]).toFixed(2); if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) OFF[n] = [dx, dy]; }
  let s = fs.readFileSync(P, 'utf8').replace(/\n\/\/ OFF:[\s\S]*$/, '\nmodule.exports = { ICON, pick };\n');
  s = s.replace('module.exports = { ICON, pick };', `// OFF: how far each glyph moves so its real box sits in the middle of the 24 grid (iconbox.cjs measures it)\nconst OFF = ${JSON.stringify(OFF)};\nconst glyph = n => OFF[n] ? \`<g transform="translate(\${OFF[n][0]} \${OFF[n][1]})"><path d="\${ICON[n]}"/></g>\` : \`<path d="\${ICON[n]}"/>\`;\nmodule.exports = { ICON, OFF, glyph, pick };`);
  if (!s.includes('const glyph')) throw 'x';
  fs.writeFileSync(P, s); console.log(Object.keys(OFF).length, 'moved:', Object.entries(OFF).map(([n, v]) => n + '(' + v + ')').join(' '));
})();
