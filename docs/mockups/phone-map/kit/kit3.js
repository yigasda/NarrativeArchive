// 다녀간 곳 › 재료 10가지를 넣은 레시피 동네 8곳(kit2와 같은 동네). 큰길은 물에서 멈추고, 바닷가엔 해안도로.
// node docs/mockups/phone-map/kit/kit3.js → kit3.html
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
const BLD = { JP: 'wood', KR: 'plain', DE: 'court', FR: 'court', PT: 'court', NL: 'court', US: 'yard', TH: 'plain' };
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
  const R = recipe(name, cc), r = R.r, P = require('./parts.js')({ C, f, curve, r, inEll });
  let o = `<rect width="${W}" height="${H}" fill="${C.built}"/>`;
  const at = pts => x => { let k = Math.min(pts.length - 2, Math.max(0, Math.floor((x - pts[0][0]) / 64))); const [a, b] = [pts[k], pts[k + 1]]; return a[1] + (b[1] - a[1]) * ((x - a[0]) / 64); };
  let wet = () => false, under = '', over = '', coast = null, river = null, landClip = '';
  if (R.water === 'coast') { const pts = Array.from({ length: 8 }, (_, i) => [-30 + i * 64, 390 + (r() - 0.5) * 40 + i * 6 * R.side]); coast = { pts, at: at(pts) }; wet = (x, y) => y > coast.at(x) - 2;
    landClip = `M-30 -30 H430 V${f(pts.at(-1)[1] - 6)} ${curve(pts.map(([x, y]) => [x, y - 6]).reverse()).replace(/^M[^C]*/, '')} Z`; }
  if (R.water === 'river') { const y0 = 140 + r() * 260, pts = Array.from({ length: 8 }, (_, i) => [-30 + i * 64, y0 + Math.sin(i * 0.9 + r() * 3) * 30 + (i - 4) * 8 * R.side]), w = 22 + r() * 12; river = { pts, at: at(pts), w }; wet = (x, y) => Math.abs(y - river.at(x)) < w / 2 + 16; }
  if (R.water === 'lake') { const lx = r() < 0.5 ? 70 : 320, ly = 120 + r() * 320, rx = 66 + r() * 26, ry = 48 + r() * 24; wet = (x, y) => inEll(x, y, lx, ly, rx + 6, ry + 6); under += `<path d="${blob(r, lx, ly, rx, ry, 12)}" fill="${C.water}"/>`; }
  const cx = R.cx, cy = R.cy;
  // the big roads' skeleton first (one of 15, plus overlays), so the compounds keep clear of them
  const RD = require('./roads.js')({ r, f, curve, C, big, way }).draw(R.style, R.quiet, cx, cy), roadPts = RD.lines; R.sk = RD.sk + ' + ' + RD.ov.join(' · ');
  const seg = (p, q, x, y) => { const dx = q[0] - p[0], dy = q[1] - p[1], t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - p[0] - t * dx, y - p[1] - t * dy); };
  const roadNear = (x, y, d) => roadPts.some(ps => ps.slice(1).some((q, i) => seg(ps[i], q, x, y) < d));
  // the compounds: apartments (KR), a shrine or temple (JP · TH · KR), a school everywhere; each keeps the streets out
  const zones = [], free = (x, y, rad, rd = 58) => !wet(x, y) && !roadNear(x, y, rd) && !zones.some(z => z.inside(x, y)) && x > 30 && x < 360 && y > 40 && y < 520 && Math.hypot(x - cx, y - cy) > rad;
  const place = (make, rad, hw = 40, hh = 30, rd = 58, tries = 80) => { for (let t = 0; t < tries; t++) { const x = 40 + r() * 310, y = 50 + r() * 450; if (free(x, y, rad, rd) && [[1, 1], [-1, -1], [1, -1], [-1, 1]].every(([u, v]) => free(x + u * hw, y + v * hh, 0, 10))) { const z = make(x, y); zones.push(z); return z; } } };
  if (cc === 'KR') { place((x, y) => P.apt(x, y, 110, 80, R.tilt * 0.4, `${names[1]} 아파트`), 60, 58, 42, 66); place((x, y) => P.apt(x, y, 96, 72, R.tilt * 0.4 + 0.05, `${names[2]} 단지`), 60, 50, 38, 60); }
  if (cc === 'JP' || R.old || cc === 'TH') place((x, y) => P.shrine(x, y, 42, 34, cc), 40);
  place((x, y) => P.school(x, y, R.tilt + (r() - 0.5) * 0.6, cc), 60);
  const parks = []; for (let i = 0; i < R.parks - 1; i++) { const p = [30 + r() * 330, 40 + r() * 480, 26 + r() * 26, 20 + r() * 20]; if (free(p[0], p[1], 0)) parks.push(p); }
  // the street field (as in kit2), bent along the shore or the river
  const field = { valley: (x, y) => R.tilt + R.bend * Math.sin(x / 140 + R.cx) + 0.3 * Math.cos(y / 160 + R.cy),
    old: (x, y) => { const d = Math.hypot(x - cx, (y - cy) * 0.8), w = Math.max(0, Math.min(1, (120 - d) / 50)); return mix([[w, Math.atan2(cy - y, cx - x)], [1 - w, R.tilt * 0.3 + 0.12 * Math.sin(y / 110)]]); },
    hill: (x, y) => Math.atan2(R.hy - y, R.hx - x) + Math.PI / 2 + 0.18 * Math.sin(Math.hypot(x - R.hx, y - R.hy) / 34),
    canal: (x, y) => Math.atan2((cy + 260) - y, cx - x) + Math.PI / 2,
    boulevard: (x, y) => R.tilt * 0.4 + 0.16 * Math.sin(x / 50) * Math.cos(y / 60),
    suburb: (x, y) => R.tilt + 0.75 * Math.sin(x / 95) * Math.cos(y / 120) }[R.style];
  const edge = coast || river, ff = edge ? (x, y) => { const d = Math.abs(y - edge.at(x)), w = Math.max(0, 1 - d / 100), t = Math.atan2(edge.at(x + 4) - edge.at(x - 4), 8); return mix([[w, t], [1 - w, field(x, y)]]); } : field;
  let st = R.rails ? [cx + 30, cy - 70] : null;
  if (st) for (let t = 0; t < 8 && [[0, 0], [30, 0], [-30, 0], [0, 20], [0, -20]].some(([u, v]) => wet(st[0] + u, st[1] + v) || zones.some(z => z.inside(st[0] + u, st[1] + v))); t++) st = [st[0], st[1] + 60];
  const canalAt = (x, y) => R.style === 'canal' && [230, 300, 370, 440].some(k => Math.abs(Math.hypot(x - cx, y - cy - 260) - k) < 9);
  const block = (x, y) => wet(x, y) || canalAt(x, y) || zones.some(z => z.inside(x, y)) || parks.some(([a, b, c, d]) => inEll(x, y, a, b, c, d)) || (st && inEll(x, y, st[0], st[1], 34, 26)) || (R.style === 'old' && inEll(x, y, cx, cy, 16, 12));
  // buildings: the country's kind, towers round the station, gardens in a quiet street
  const kind = R.quiet && cc !== 'US' ? BLD[cc] : BLD[cc], hb = P.HOUSE[kind](block), ht = P.HOUSE.tower(block);
  const house = l => (st && l.pts.some(([x, y]) => Math.hypot(x - st[0], y - st[1]) < 110)) ? ht(l) : hb(l);
  const sep = cc === 'US' ? 34 : R.style === 'boulevard' ? 20 : R.style === 'canal' ? 22 : kind === 'wood' ? 22 : 25;
  const { houses, streets, lines } = flow({ W, H, field: ff, block, sep, r, C, f, house });
  if (coast) { const b = P.beach(coast, big); under += b.under; over += b.over; }
  if (river) { const b = P.riverbank(river.pts, river.w, way); under += b.under; }
  o += under + parks.map(([a, b, c, d]) => `<path d="${blob(r, a, b, c, d)}" fill="${C.park}"/>` + trees(r, a, b, c, d, Math.round(c * d / 60))).join('') + zones.map(z => z.svg).join('') + houses + way(streets, cc === 'JP' ? 1.9 : R.style === 'boulevard' ? 1.8 : 2.2);
  if (R.style === 'canal') for (const k of [230, 300, 370, 440]) o += `<circle cx="${f(cx)}" cy="${f(cy + 260)}" r="${k}" fill="none" stroke="${C.water}" stroke-width="8"/>`;
  if (R.style === 'hill') { for (let k = 1; k < 9; k++) o += `<circle cx="${f(R.hx)}" cy="${f(R.hy)}" r="${k * 52}" fill="none" stroke="${C.contour}" stroke-width="1.2"/>`; o += P.stairs(lines, R.hx, R.hy); }
  // big roads, kept on land: they stop at the sea (clip), cross a river as bridges
  let roads = RD.svg;
  if (river) for (const x of P.riverbank(river.pts, river.w, way).bridges) { const y = river.at(x); roads += `<path d="M${f(x)} ${f(y - river.w / 2 - 14)}V${f(y + river.w / 2 + 14)}" stroke="${C.edge}" stroke-width="7.4"/><path d="M${f(x)} ${f(y - river.w / 2 - 14)}V${f(y + river.w / 2 + 14)}" stroke="#fff" stroke-width="5"/>`; }
  o += landClip ? `<defs><clipPath id="land${hsh(name)}"><path d="${landClip}"/></clipPath></defs><g clip-path="url(#land${hsh(name)})">${roads}</g>` : roads;
  o += (landClip ? `<g clip-path="url(#land${hsh(name)})">${RD.top}</g>` : RD.top) + over;
  if (R.style === 'old') o += `<path d="${blob(r, cx, cy, 18, 14, 8)}" fill="${C.plaza}" stroke="${C.edge}"/>` + poi(cx, cy, G[R.temple]);
  if (R.style === 'hill') o += poi(R.hx + (cx - R.hx) * 0.35, R.hy + (cy - R.hy) * 0.35, G.view);
  if (st) { for (let i = 0; i < R.rails; i++) { const a = R.tilt + i * 0.5, dx = Math.cos(a) * 300, dy = Math.sin(a) * 300; o += rail(`M${f(st[0] - dx)} ${f(st[1] - dy)} L${f(st[0] + dx)} ${f(st[1] + dy)}`); }
    o += `<rect x="${f(st[0] - 26)}" y="${f(st[1] - 14)}" width="52" height="28" rx="3" transform="rotate(${f(R.tilt * 57.3)} ${f(st[0])} ${f(st[1])})" fill="${C.station}" stroke="${C.stationEdge}"/>` + badge(st[0] - 40, st[1] - 30); }
  for (const z of zones) if (z.name) o += label(z.at[0], z.at[1] + 2, z.name, 9.5, 600, '#7d8a6c');
  const ly = st && Math.hypot(st[0] - cx, st[1] - cy - 34) < 70 ? st[1] + 52 : cy + 34;
  o += label(cx, ly, names[0], 13, 700, '#4a5058');
  [[70, 90], [320, 120], [90, 470], [310, 450]].slice(0, names.length - 1).forEach(([x, y], i) => { if (!wet(x, y) && !zones.some(z => z.inside(x, y))) o += label(x, y, names[i + 1], 10.5); });
  return { svg: o, R };
}
const TOWNS = [['京都 · 祇園', 'JP', '🇯🇵', ['祇園', '八坂', '清水', '四条']], ['부산 · 해운대', 'KR', '🇰🇷', ['해운대', '우동', '중동', '좌동']], ['München · Schwabing', 'DE', '🇩🇪', ['Schwabing', 'Maxvorstadt', 'Englischer Garten', 'Freimann']],
  ['Paris · Montmartre', 'FR', '🇫🇷', ['Montmartre', 'Pigalle', 'Abbesses', 'Clignancourt']], ['Lisboa · Alfama', 'PT', '🇵🇹', ['Alfama', 'Graça', 'Castelo', 'Mouraria']], ['Amsterdam · Jordaan', 'NL', '🇳🇱', ['Jordaan', 'Westerpark', 'Grachtengordel', 'Centrum']],
  ['Bellevue · Eastgate', 'US', '🇺🇸', ['Eastgate', 'Lake Hills', 'Crossroads', 'Wilburton']], ['Bangkok · Sukhumvit', 'TH', '🇹🇭', ['Sukhumvit', 'Asok', 'Phrom Phong', 'Khlong Toei']]];
const css = `*{box-sizing:border-box;margin:0}body{background:#d9dce2;font-family:-apple-system,'Noto Sans KR',sans-serif;padding:24px;width:1760px;color:#161b22}h1{font-size:22px}p.s{color:#555;font-size:13px;margin:4px 0 16px}
.row{display:grid;grid-template-columns:repeat(4,410px);gap:24px 24px}.col>b{display:block;font-size:15px}.col>small{display:block;color:#555;font-size:12px;margin:4px 0 10px;min-height:16px}
.ph{width:390px;height:620px;border-radius:44px 44px 0 0;border:9px solid #111;border-bottom:0;overflow:hidden;position:relative;background:#f4f5f7}.ph svg{display:block}
.sh{position:absolute;left:0;right:0;top:500px;bottom:0;background:#f4f5f7;border-radius:22px 22px 0 0;box-shadow:0 -6px 24px rgba(22,27,34,.14);padding:12px 18px}.gr{width:36px;height:5px;border-radius:3px;background:#d4d7dc;margin:0 auto 12px}.sh h2{font-size:22px;font-weight:700}`;
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head><body><h1>다녀간 곳 › 재료 10가지를 넣은 동네 8곳</h1><p class="s">목조 골목 · 중정 블록 · 마당 집 · 빌딩 · 아파트 단지 · 신사/절 경내 · 학교 운동장 · 모래사장+해안도로+방파제 · 둔치+다리 · 계단길 — 큰길은 물에서 멈춰요</p><div class="row">`
  + TOWNS.map(([name, cc, flag, names]) => { const { svg, R } = town(name, cc, names); return `<div class="col"><b>${flag} ${name}</b><small>${R.style} · 물 ${R.water} · 큰길 ${R.sk || ''}${R.rails ? ` · 철도 ${R.rails}` : ''}${R.quiet ? ' · 조용한 주택가' : ''}</small><div class="ph"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${svg}</svg><div class="sh"><div class="gr"></div><h2>${flag} ${names[0]}</h2></div></div></div>`; }).join('') + `</div></body></html>`;
fs.writeFileSync(path.join(__dirname, 'kit3.html'), html);
console.log('ok');
