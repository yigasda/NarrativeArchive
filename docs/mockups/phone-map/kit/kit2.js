// 다녀간 곳 › 레시피만으로 찍은 동네 8곳. 손으로 맞춘 것 없이, 나라 기본값 + 동네 종류(이름 낱말) + 이름 해시로만 그려요.
// node docs/mockups/phone-map/kit/kit2.js → kit2.html
const fs = require('fs'), path = require('path');
const flow = require('./flow.js');
const hsh = s => [...String(s)].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7);
const rng = seed => { let s = hsh(seed) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
const f = n => (Math.round(n * 10) / 10).toString();
const curve = (pts, close = false) => { const P = close ? [pts.at(-1), ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts.at(-1)]; let d = `M${f(P[1][0])} ${f(P[1][1])}`;
  for (let i = 1; i < P.length - 2; i++) { const [a, b, c, e] = [P[i - 1], P[i], P[i + 1], P[i + 2]]; d += ` C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`; }
  return close ? d + 'Z' : d; };
const C = { land: '#f3f0ea', built: '#ebe7df', park: '#d4e8c9', forest: '#c3dcb5', water: '#b6d4ef', sand: '#f2e6c4', road: '#ffffff', edge: '#dad4c9', major: '#fde7a3', majorEdge: '#e3c77c',
  rail: '#a9a49b', contour: '#e2dccd', label: '#6f7681', plaza: '#efe6d2', bld: '#e0dbd0', bld2: '#d8d2c6', station: '#d9d2c5', stationEdge: '#c4bcae', poi: '#8a7f73' };
const W = 390, H = 560;
const way = (d, w = 3.2) => `<path d="${d}" fill="none" stroke="${C.edge}" stroke-width="${f(w + 2.2)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${C.road}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
const big = (d, w = 7) => `<path d="${d}" fill="none" stroke="${C.majorEdge}" stroke-width="${f(w + 2.4)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${C.major}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
const rail = d => `<path d="${d}" fill="none" stroke="${C.rail}" stroke-width="3"/><path d="${d}" fill="none" stroke="${C.land}" stroke-width="1.5" stroke-dasharray="5 5"/>`;
const label = (x, y, t, size = 11, w = 600, col = C.label) => `<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-family="-apple-system, 'Noto Sans KR', 'Hiragino Sans', sans-serif" font-size="${size}" font-weight="${w}" fill="${col}" stroke="${C.land}" stroke-width="3" paint-order="stroke">${t}</text>`;
const blob = (r, cx, cy, rx, ry, n = 10) => curve(Array.from({ length: n }, (_, k) => { const a = k / n * 6.283, q = 1 + (r() - 0.5) * 0.4; return [cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q]; }), true);
const trees = (r, cx, cy, rx, ry, n) => { let o = ''; for (let i = 0; i < n; i++) { const a = r() * 6.283, d = Math.sqrt(r()); o += `<circle cx="${f(cx + Math.cos(a) * rx * d * 0.85)}" cy="${f(cy + Math.sin(a) * ry * d * 0.85)}" r="${f(2 + r() * 2.4)}" fill="${C.forest}"/>`; } return o; };
const badge = (x, y) => `<g transform="translate(${f(x)} ${f(y)})"><rect x="-8" y="-8" width="16" height="16" rx="4.5" fill="#5f6670"/><path d="M-3.5 -4.5h7a1.5 1.5 0 0 1 1.5 1.5v4.5a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2v-4.5a1.5 1.5 0 0 1 1.5 -1.5zM-5 -0.5h10M-2.5 3.5l-1.5 2.5M2.5 3.5l1.5 2.5" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
const G = { church: 'M12 2v6M9 5h6M5 22V12l7-4 7 4v10M10 22v-5h4v5', shrine: 'M3 6h18M5 9h14M7 9v13M17 9v13M4 4l16 0', tower: 'M12 2l3 20H9zM10 9h4M9.4 14h5.2', park: 'M12 3l5 8h-3l4 6H6l4-6H7zM12 17v4', museum: 'M3 9l9-5 9 5M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18', shop: 'M5 8h14l-1.2 12H6.2zM9 8V6a3 3 0 0 1 6 0v2', boat: 'M3 15h18l-3 5H6zM12 4v11M12 4l6 8h-6', school: 'M3 9l9-5 9 5-9 5zM7 11v5c3 2 7 2 10 0v-5', temple: 'M12 2l8 6H4zM6 8v10M18 8v10M3 18h18M9 18v-5h6v5', view: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6' };
const poi = (x, y, glyph) => `<g transform="translate(${f(x)} ${f(y)})"><circle r="8.5" fill="#fff" stroke="${C.edge}" stroke-width="1"/><path d="${glyph}" fill="none" stroke="${C.poi}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" transform="translate(-6 -6) scale(.5)"/></g>`;
const mix = ws => { let cx = 0, cy = 0; for (const [w, a] of ws) { cx += w * Math.cos(4 * a); cy += w * Math.sin(4 * a); } return Math.atan2(cy, cx) / 4; };
const inEll = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;

// ---- recipe: what a country draws by default, what the neighbourhood's own words add, and what its name's hash moves
const COUNTRY = { JP: { style: 'valley', rails: 2, temple: 'shrine', water: ['none', 'river'] }, KR: { style: 'boulevard', rails: 0, temple: 'temple', water: ['river', 'none'] }, DE: { style: 'old', rails: 1, temple: 'church', water: ['river', 'none'] }, FR: { style: 'old', rails: 0, temple: 'church', water: ['none', 'river'] },
  PT: { style: 'hill', rails: 0, temple: 'church', water: ['river'] }, NL: { style: 'canal', rails: 0, temple: 'church', water: ['none'] }, US: { style: 'suburb', rails: 0, temple: 'school', water: ['lake', 'none'] }, TH: { style: 'boulevard', rails: 1, temple: 'temple', water: ['none', 'river', 'lake'] } };
const WORDS = [[/해운대|beach|strand|plage|浜|해변/i, { water: 'coast' }], [/montmartre|alfama|언덕|坂/i, { style: 'hill' }], [/altstadt|구시가|old town|vieux/i, { style: 'old' }], [/祇園|gion|浅草/i, { old: true }],
  [/jordaan|grachten|canal/i, { style: 'canal' }], [/schwabing|主宅|주택|residential|suburb|bellevue/i, { quiet: true }], [/sukhumvit|soi/i, { style: 'boulevard', rails: 1 }]];
function recipe(name, cc) {
  const r = rng(name), base = { ...COUNTRY[cc] };
  for (const [rx, add] of WORDS) if (rx.test(name)) Object.assign(base, add);
  if (typeof base.water !== 'string') base.water = base.water[Math.floor(r() * base.water.length)];
  const corner = Math.floor(r() * 4); return { ...base, r, hx: [40, 350, 40, 350][corner], hy: [60, 60, 480, 480][corner], tilt: (r() - 0.5) * 0.5, bend: 0.2 + r() * 0.35, cx: 140 + r() * 120, cy: 200 + r() * 140, parks: 1 + Math.floor(r() * 3), side: r() < 0.5 ? 1 : -1 };
}
function town(name, cc, names) {
  const R = recipe(name, cc), r = R.r; let o = `<rect width="${W}" height="${H}" fill="${C.built}"/>`;
  // water: a coast along one side, a river across, or a lake
  let wet = () => false, water = '';
  if (R.water === 'coast') { const pts = Array.from({ length: 8 }, (_, i) => [-30 + i * 64, 380 + (r() - 0.5) * 50 + i * 8 * R.side]); const yAt = x => { let k = Math.min(6, Math.max(0, Math.floor((x + 30) / 64))); const [a, b] = [pts[k], pts[k + 1]]; return a[1] + (b[1] - a[1]) * ((x - a[0]) / 64); };
    wet = (x, y) => y > yAt(x) + 8; water = `<path d="${curve(pts)} L430 600 L-30 600Z" fill="${C.sand}"/><path d="${curve(pts.map(([x, y]) => [x, y + 14]))} L430 600 L-30 600Z" fill="${C.water}"/>`; R.coastAt = yAt; }
  if (R.water === 'river') { const y0 = 120 + r() * 300, pts = Array.from({ length: 8 }, (_, i) => [-30 + i * 64, y0 + Math.sin(i * 0.9 + r() * 3) * 34 + (i - 4) * 10 * R.side]), w = 24 + r() * 16;
    const yAt = x => { let k = Math.min(6, Math.max(0, Math.floor((x + 30) / 64))); const [a, b] = [pts[k], pts[k + 1]]; return a[1] + (b[1] - a[1]) * ((x - a[0]) / 64); };
    wet = (x, y) => Math.abs(y - yAt(x)) < w / 2 + 5; water = `<path d="${curve(pts)}" fill="none" stroke="${C.water}" stroke-width="${f(w)}" stroke-linecap="round"/>`; R.riverAt = yAt; }
  if (R.water === 'lake') { const lx = r() < 0.5 ? 60 : 330, ly = 80 + r() * 380, rx = 70 + r() * 30, ry = 50 + r() * 30; wet = (x, y) => inEll(x, y, lx, ly, rx + 4, ry + 4); water = `<path d="${blob(r, lx, ly, rx, ry, 12)}" fill="${C.water}"/>`; }
  // parks, kept away from the water
  const parks = []; for (let i = 0; i < R.parks; i++) { const p = [30 + r() * 330, 40 + r() * 480, 30 + r() * 34, 22 + r() * 26]; if (!wet(p[0], p[1])) parks.push(p); }
  // the street direction field, by style
  const cx = R.cx, cy = R.cy, field = {
    valley: (x, y) => R.tilt + R.bend * Math.sin(x / 140 + R.cx) + 0.3 * Math.cos(y / 160 + R.cy),
    old: (x, y) => { const d = Math.hypot(x - cx, (y - cy) * 0.8), w = Math.max(0, Math.min(1, (120 - d) / 50)); return mix([[w, Math.atan2(cy - y, cx - x)], [1 - w, R.tilt * 0.3 + 0.12 * Math.sin(y / 110)]]); },
    hill: (x, y) => Math.atan2(R.hy - y, R.hx - x) + Math.PI / 2 + 0.18 * Math.sin(Math.hypot(x - R.hx, y - R.hy) / 34),
    canal: (x, y) => Math.atan2((cy + 260) - y, cx - x) + Math.PI / 2,
    boulevard: (x, y) => R.tilt * 0.4 + 0.16 * Math.sin(x / 50) * Math.cos(y / 60),
    suburb: (x, y) => R.tilt + 0.75 * Math.sin(x / 95) * Math.cos(y / 120),
  }[R.style];
  const ff = R.riverAt ? (x, y) => { const d = Math.abs(y - R.riverAt(x)), w = Math.max(0, 1 - d / 90), t = Math.atan2(R.riverAt(x + 4) - R.riverAt(x - 4), 8); return mix([[w, t], [1 - w, field(x, y)]]); }
    : R.coastAt ? (x, y) => { const d = Math.abs(y - R.coastAt(x)), w = Math.max(0, 1 - d / 110), t = Math.atan2(R.coastAt(x + 4) - R.coastAt(x - 4), 8); return mix([[w, t], [1 - w, field(x, y)]]); } : field;
  let st = R.rails ? [cx + 30, cy - 70] : null;
  if (st) for (let t = 0; t < 8 && [[0, 0], [30, 0], [-30, 0], [0, 20], [0, -20]].some(([u, v]) => wet(st[0] + u, st[1] + v)); t++) st = [st[0], st[1] + 60];
  const canalAt = (x, y) => R.style === 'canal' && [230, 300, 370, 440].some(k => Math.abs(Math.hypot(x - cx, y - cy - 260) - k) < 9);
  const block = (x, y) => wet(x, y) || canalAt(x, y) || parks.some(([a, b, c, d]) => inEll(x, y, a, b, c, d)) || (st && inEll(x, y, st[0], st[1], 34, 26)) || (R.style === 'old' && inEll(x, y, cx, cy, 16, 12));
  const sep = R.style === 'suburb' || R.quiet ? 32 : R.style === 'boulevard' ? 18 : R.style === 'canal' ? 22 : 24;
  const { houses, streets } = flow({ W, H, field: ff, block, sep, r, C, f });
  o += water + parks.map(([a, b, c, d]) => `<path d="${blob(r, a, b, c, d)}" fill="${C.park}"/>` + trees(r, a, b, c, d, Math.round(c * d / 60))).join('') + houses + way(streets, R.style === 'boulevard' ? 1.8 : 2.2);
  // canals along the rings, hill contours under the streets' ends
  if (R.style === 'canal') for (const k of [230, 300, 370, 440]) o += `<circle cx="${f(cx)}" cy="${f(cy + 260)}" r="${k}" fill="none" stroke="${C.water}" stroke-width="8"/>`;
  if (R.style === 'hill') for (let k = 1; k < 9; k++) o += `<circle cx="${f(R.hx)}" cy="${f(R.hy)}" r="${k * 52}" fill="none" stroke="${C.contour}" stroke-width="1.2"/>`;
  // big roads: boulevards make a large grid; elsewhere two or three bending roads through the middle
  if (R.style === 'boulevard') { for (const x of [60 + r() * 40, 230 + r() * 60]) o += big(`M${f(x)} -20 L${f(x + R.tilt * 120)} 600`, 9); for (const y of [150 + r() * 40, 380 + r() * 60]) o += big(`M-20 ${f(y)} L410 ${f(y - R.tilt * 120)}`, 9); }
  else { const n = R.quiet ? 1 : 2; for (let i = 0; i < n; i++) { const vert = i % 2 === 0, p = Array.from({ length: 5 }, (_, k) => vert ? [cx + (r() - 0.5) * 120 + (k - 2) * 20, -20 + k * 150] : [-20 + k * 107, cy + (r() - 0.5) * 120]); o += big(curve(p), 6.5); } }
  if (R.style === 'old') o += `<path d="${blob(r, cx, cy, 18, 14, 8)}" fill="${C.plaza}" stroke="${C.edge}"/>` + poi(cx, cy, G[R.temple]);
  if (R.style === 'hill') o += poi(R.hx + (cx - R.hx) * 0.35, R.hy + (cy - R.hy) * 0.35, G.view);
  if (R.old) o += poi(cx - 40, cy + 10, G[R.temple]);
  // the station, its tracks and badge
  if (st) { for (let i = 0; i < R.rails; i++) { const a = R.tilt + i * 0.5, dx = Math.cos(a) * 300, dy = Math.sin(a) * 300; o += rail(`M${f(st[0] - dx)} ${f(st[1] - dy)} L${f(st[0] + dx)} ${f(st[1] + dy)}`); }
    o += `<rect x="${f(st[0] - 26)}" y="${f(st[1] - 14)}" width="52" height="28" rx="3" transform="rotate(${f(R.tilt * 57.3)} ${f(st[0])} ${f(st[1])})" fill="${C.station}" stroke="${C.stationEdge}"/>` + badge(st[0] - 40, st[1] - 30); }
  // places: a few points of interest that suit the kind, where there's land
  const kinds = R.water === 'coast' ? [G.boat, G.shop, G.park] : R.quiet || R.style === 'suburb' ? [G.school, G.park, G.shop] : [G.shop, G.museum, G[R.temple]];
  kinds.forEach((g, i) => { for (let t = 0; t < 20; t++) { const x = 40 + r() * 310, y = 50 + r() * 460; if (!block(x, y) && Math.hypot(x - cx, y - cy) > 50) { o += poi(x, y, g); break; } } });
  // labels: the neighbourhood big in the middle, its neighbours round it
  o += label(cx, cy + 34, names[0], 13, 700, '#4a5058');
  [[70, 90], [320, 120], [90, 470], [310, 450]].slice(0, names.length - 1).forEach(([x, y], i) => { if (!wet(x, y)) o += label(x, y, names[i + 1], 10.5); });
  if (st) o += label(st[0] + 10, st[1] - 26, names.station || '', 11, 700, '#4a5058');
  return { svg: o, R };
}
const TOWNS = [['京都 · 祇園', 'JP', '🇯🇵', ['祇園', '八坂', '清水', '四条']], ['부산 · 해운대', 'KR', '🇰🇷', ['해운대', '우동', '중동', '좌동']], ['München · Schwabing', 'DE', '🇩🇪', ['Schwabing', 'Maxvorstadt', 'Englischer Garten', 'Freimann']],
  ['Paris · Montmartre', 'FR', '🇫🇷', ['Montmartre', 'Pigalle', 'Abbesses', 'Clignancourt']], ['Lisboa · Alfama', 'PT', '🇵🇹', ['Alfama', 'Graça', 'Castelo', 'Mouraria']], ['Amsterdam · Jordaan', 'NL', '🇳🇱', ['Jordaan', 'Westerpark', 'Grachtengordel', 'Centrum']],
  ['Bellevue · Eastgate', 'US', '🇺🇸', ['Eastgate', 'Lake Hills', 'Crossroads', 'Wilburton']], ['Bangkok · Sukhumvit', 'TH', '🇹🇭', ['Sukhumvit', 'Asok', 'Phrom Phong', 'Khlong Toei']]];
const css = `*{box-sizing:border-box;margin:0}body{background:#d9dce2;font-family:-apple-system,'Noto Sans KR',sans-serif;padding:24px;width:1760px;color:#161b22}h1{font-size:22px}p.s{color:#555;font-size:13px;margin:4px 0 16px}
.row{display:grid;grid-template-columns:repeat(4,410px);gap:24px 24px}.col>b{display:block;font-size:15px}.col>small{display:block;color:#555;font-size:12px;margin:4px 0 10px;min-height:16px}
.ph{width:390px;height:620px;border-radius:44px 44px 0 0;border:9px solid #111;border-bottom:0;overflow:hidden;position:relative;background:#f4f5f7}.ph svg{display:block}
.sh{position:absolute;left:0;right:0;top:500px;bottom:0;background:#f4f5f7;border-radius:22px 22px 0 0;box-shadow:0 -6px 24px rgba(22,27,34,.14);padding:12px 18px}.gr{width:36px;height:5px;border-radius:3px;background:#d4d7dc;margin:0 auto 12px}.sh h2{font-size:22px;font-weight:700}`;
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head><body><h1>다녀간 곳 › 레시피만으로 찍은 동네 8곳</h1><p class="s">손으로 맞춘 것 없음 — 나라 기본값 + 동네 이름 낱말 + 이름 해시</p><div class="row">`
  + TOWNS.map(([name, cc, flag, names]) => { const { svg, R } = town(name, cc, names); return `<div class="col"><b>${flag} ${name}</b><small>${R.style} · 물 ${R.water}${R.rails ? ` · 철도 ${R.rails}` : ''}${R.quiet ? ' · 조용한 주택가' : ''}</small><div class="ph"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${svg}</svg><div class="sh"><div class="gr"></div><h2>${flag} ${names[0]}</h2></div></div></div>`; }).join('') + `</div></body></html>`;
fs.writeFileSync(path.join(__dirname, 'kit2.html'), html);
console.log('ok');
