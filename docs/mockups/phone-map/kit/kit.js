// 다녀간 곳 › 조립식 지도 시안: 같은 "역 앞 번화가"를 나라마다 다른 조각으로 조립해요.
// 땅(바다 · 강 · 언덕) + 길 짜임(나라 · 지역) + 역 · 랜드마크 + 동네 블록. 이름 해시로만 골라서 같은 도시는 늘 같아요.
// node docs/mockups/phone-map/kit/kit.js → kit.html
const fs = require('fs'), path = require('path');
const hsh = s => [...String(s)].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7);
const rng = seed => { let s = hsh(seed) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
const f = n => (Math.round(n * 10) / 10).toString();
const curve = (pts, close = false) => { const P = close ? [pts.at(-1), ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts.at(-1)]; let d = `M${f(P[1][0])} ${f(P[1][1])}`;
  for (let i = 1; i < P.length - 2; i++) { const [a, b, c, e] = [P[i - 1], P[i], P[i + 1], P[i + 2]]; d += ` C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`; }
  return close ? d + 'Z' : d; };
const C = { land: '#f3f0ea', built: '#ebe7df', park: '#d4e8c9', forest: '#c3dcb5', water: '#b6d4ef', waterEdge: '#a3c6e6', road: '#ffffff', edge: '#dad4c9', major: '#fde7a3', majorEdge: '#e3c77c',
  rail: '#a9a49b', contour: '#e2dccd', label: '#6f7681', plaza: '#efe6d2', bld: '#e0dbd0', bld2: '#d8d2c6', station: '#d9d2c5', stationEdge: '#c4bcae', poi: '#8a7f73' };
const W = 390, H = 560;
let uid = 0;
// ---- shared pieces
const way = (d, w = 3.2) => `<path d="${d}" fill="none" stroke="${C.edge}" stroke-width="${f(w + 2.2)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${C.road}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
const big = (d, w = 7) => `<path d="${d}" fill="none" stroke="${C.majorEdge}" stroke-width="${f(w + 2.4)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${C.major}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
const rail = (d, w = 3) => `<path d="${d}" fill="none" stroke="${C.rail}" stroke-width="${f(w)}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${C.land}" stroke-width="${f(w / 2)}" stroke-dasharray="5 5"/>`;
const label = (x, y, t, size = 11, w = 600, col = C.label) => `<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-family="-apple-system, 'Noto Sans KR', 'Hiragino Sans', sans-serif" font-size="${size}" font-weight="${w}" fill="${col}" stroke="${C.land}" stroke-width="3" paint-order="stroke" letter-spacing=".02em">${t}</text>`;
const clip = (d, inner) => { const id = `k${uid++}`; return `<defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs><g clip-path="url(#${id})">${inner}</g>`; };
// blocks of houses between the streets of a grid (turned by ang round cx,cy): a lighter fill per block, building rows inside
function blocks(r, cx, cy, ang, bw, bh, gap, x0, x1, y0, y1, density = 0.9, rows = 2) {
  let o = '';
  for (let x = x0; x < x1; x += bw + gap) for (let y = y0; y < y1; y += bh + gap) {
    if (r() > density) continue;
    o += `<rect x="${f(x)}" y="${f(y)}" width="${f(bw)}" height="${f(bh)}" rx="1.5" fill="${C.built}"/>`;
    // building footprints along the block's edge
    const n = Math.max(2, Math.round(bw / (6 + r() * 5)));
    for (let i = 0; i < n; i++) { const w = bw / n - 1.4, hh = bh / rows - 1.6; for (let k = 0; k < rows; k++) if (r() < 0.86) o += `<rect x="${f(x + 0.7 + i * (bw / n))}" y="${f(y + 0.8 + k * (bh / rows))}" width="${f(w)}" height="${f(hh * (0.7 + r() * 0.3))}" rx=".8" fill="${r() < 0.3 ? C.bld2 : C.bld}"/>`; }
  }
  return `<g transform="rotate(${f(ang)} ${f(cx)} ${f(cy)})">${o}</g>`;
}
// the streets of the same grid
function gridLines(cx, cy, ang, bw, bh, gap, x0, x1, y0, y1, w = 2.2) {
  let d = '';
  for (let x = x0 - gap / 2; x < x1 + bw; x += bw + gap) d += `M${f(x)} ${f(y0 - 20)}V${f(y1 + 20)}`;
  for (let y = y0 - gap / 2; y < y1 + bh; y += bh + gap) d += `M${f(x0 - 20)} ${f(y)}H${f(x1 + 20)}`;
  return `<g transform="rotate(${f(ang)} ${f(cx)} ${f(cy)})">${way(d, w)}</g>`;
}
const parkBlob = (r, cx, cy, rx, ry, n = 10) => curve(Array.from({ length: n }, (_, k) => { const a = k / n * 6.283, q = 1 + (r() - 0.5) * 0.4; return [cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q]; }), true);
const trees = (r, cx, cy, rx, ry, n) => { let o = ''; for (let i = 0; i < n; i++) { const a = r() * 6.283, d = Math.sqrt(r()); o += `<circle cx="${f(cx + Math.cos(a) * rx * d * 0.85)}" cy="${f(cy + Math.sin(a) * ry * d * 0.85)}" r="${f(2 + r() * 2.4)}" fill="${C.forest}"/>`; } return o; };
const stationBox = (x, y, w, h, ang = 0) => `<g transform="rotate(${f(ang)} ${f(x + w / 2)} ${f(y + h / 2)})"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="3" fill="${C.station}" stroke="${C.stationEdge}" stroke-width="1.2"/></g>`;
const badge = (x, y) => `<g transform="translate(${f(x)} ${f(y)})"><rect x="-8" y="-8" width="16" height="16" rx="4.5" fill="#5f6670"/><path d="M-3.5 -4.5h7a1.5 1.5 0 0 1 1.5 1.5v4.5a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2v-4.5a1.5 1.5 0 0 1 1.5 -1.5zM-5 -0.5h10M-2.5 3.5l-1.5 2.5M2.5 3.5l1.5 2.5" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
const poi = (x, y, glyph) => `<g transform="translate(${f(x)} ${f(y)})"><circle r="8.5" fill="#fff" stroke="${C.edge}" stroke-width="1"/><path d="${glyph}" fill="none" stroke="${C.poi}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" transform="translate(-6 -6) scale(.5)"/></g>`;
const G = { church: 'M12 2v6M9 5h6M5 22V12l7-4 7 4v10M10 22v-5h4v5', shrine: 'M3 6h18M5 9h14M7 9v13M17 9v13M4 4l16 0', tower: 'M12 2l3 20H9zM10 9h4M9.4 14h5.2', park: 'M12 3l5 8h-3l4 6H6l4-6H7zM12 17v4', museum: 'M3 9l9-5 9 5M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18', shop: 'M5 8h14l-1.2 12H6.2zM9 8V6a3 3 0 0 1 6 0v2', bridge: 'M3 16h18M5 16c2-6 12-6 14 0M8 16v-3M16 16v-3' };

const flow = require('./flow.js');
// blend street directions without flips: streets repeat every 90°, so blend the angle ×4 as a vector
const mix = (ws) => { let cx = 0, cy = 0; for (const [w, a] of ws) { cx += w * Math.cos(4 * a); cy += w * Math.sin(4 * a); } return Math.atan2(cy, cx) / 4; };
const inEll = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
// ---- 일본 · 시부야: 골짜기로 휘어 드는 골목이 서서히 방향을 바꾸며 이어지고, 철도 네 줄이 역으로 모여요
function shibuya() {
  const r = rng('渋谷'); let o = `<rect width="${W}" height="${H}" fill="${C.built}"/>`;
  const sx = 214, sy = 276;
  const field = (x, y) => { const d = Math.hypot(x - sx, y - sy), toward = Math.atan2(sy - y, sx - x);
    return mix([[Math.min(1, 70 / (d + 1)), toward], [1, -0.25 + 0.45 * Math.sin(x / 150) + 0.3 * Math.cos(y / 170)]]); };
  const block = (x, y) => inEll(x, y, 40, 40, 96, 76) || inEll(x, y, 330, 470, 36, 28) || inEll(x, y, sx, sy, 40, 30);
  const { houses, streets } = flow({ W, H, field, block, sep: 24, r, C, f });
  o += `<path d="${parkBlob(r, 40, 40, 90, 70)}" fill="${C.park}"/>` + trees(r, 40, 40, 90, 70, 40) + `<path d="${parkBlob(r, 330, 470, 34, 26)}" fill="${C.park}"/>`;
  o += houses + way(streets, 2.1);
  o += big(curve([[150, -20], [170, 120], [188, 250], [200, 380], [214, 580]]), 7.5) + big(curve([[-20, 330], [120, 300], [196, 286], [300, 300], [410, 340]]), 8.5) + big(curve([[-20, 210], [80, 230], [190, 278]]), 5.5);
  o += rail(curve([[232, -20], [226, 150], [214, 280], [206, 420], [200, 580]]), 3.2) + rail(curve([[244, -20], [238, 150], [226, 280], [218, 420], [212, 580]]), 3.2)
     + rail(curve([[-20, 262], [100, 266], [214, 274], [410, 250]]), 3) + rail(curve([[410, 176], [300, 220], [230, 270]]), 2.6);
  o += [[200, 254, 24, 40, -4], [228, 262, 20, 30, -4], [188, 298, 30, 18, -6], [222, 296, 26, 16, -2]].map(([x, y, w, h, a]) => stationBox(x, y, w, h, a)).join('') + badge(214, 236);
  o += poi(54, 46, G.shrine) + poi(318, 468, G.park) + poi(110, 360, G.shop) + poi(292, 120, G.tower);
  o += label(250, 240, '渋谷駅', 12, 700, '#4a5058') + label(120, 150, '神南', 11) + label(92, 410, '道玄坂', 11) + label(300, 410, '桜丘町', 11) + label(310, 140, '宮益坂', 11) + label(52, 92, '代々木公園', 10, 600, '#6b8a5e');
  return o;
}
// ---- 독일 · 프랑크푸르트: 역 앞은 반듯한 바둑판, 성벽 자리 공원 링 안에서는 길이 성당 광장 쪽으로 모이며 휘고, 남쪽엔 강
function frankfurt() {
  const r = rng('Frankfurt'); let o = `<rect width="${W}" height="${H}" fill="${C.built}"/>`;
  const dx = 296, dy = 330, ring = (x, y) => ((x - 292) / 104) ** 2 + ((y - 300) / 150) ** 2;
  const riverY = x => 470 + 10 * Math.sin(x / 70) - x * 0.06;
  const field = (x, y) => { const g = ring(x, y), w = Math.max(0, Math.min(1, (1.25 - g) * 2.2)), toward = Math.atan2(dy - y, dx - x);
    return mix([[w, toward], [1 - w, 0.02 + (y < 170 ? 0.16 * Math.sin(x / 90) : 0)], [x > 330 && y < 150 ? 0.6 : 0, -0.14]]); };
  const inRing = (x, y) => { const g = ring(x, y); return g > 0.88 && g < 1.08; };
  const block = (x, y) => inEll(x, y, 74, 62, 70, 46) || inEll(x, y, 232, 146, 14, 11) || inRing(x, y) || (y > riverY(x) - 4 && y < riverY(x) + 36) || (x > 58 && x < 96 && y > 182 && y < 310) || (x < 62 && y > 170 && y < 320) || inEll(x, y, dx, dy, 16, 12);
  const { houses, streets } = flow({ W, H, field, block, sep: 25, r, C, f });
  const ringD = curve(Array.from({ length: 24 }, (_, k) => { const a = k / 24 * 6.283; return [292 + Math.cos(a) * 104 * 0.98, 300 + Math.sin(a) * 150 * 0.98]; }), true);
  const top = Array.from({ length: 9 }, (_, i) => { const x = -30 + i * 56; return [x, riverY(x) - 2]; }), bot = Array.from({ length: 9 }, (_, i) => { const x = 418 - i * 56; return [x, riverY(x) + 34]; });
  o += `<path d="${curve(top)} L${f(bot[0][0])} ${f(bot[0][1])} ${curve(bot).replace(/^M[^C]*/, '')} Z" fill="${C.water}"/>`;
  o += `<path d="${parkBlob(r, 74, 62, 66, 42, 11)}" fill="${C.park}"/>` + trees(r, 74, 62, 66, 42, 34) + `<path d="M60 58c8 -6 18 -6 26 0" fill="none" stroke="${C.water}" stroke-width="5" stroke-linecap="round"/>`;
  o += `<path d="${ringD}" fill="none" stroke="${C.park}" stroke-width="22"/>` + houses + way(streets, 2.2);
  o += `<path d="${parkBlob(r, 232, 146, 14, 10, 8)}" fill="${C.plaza}" stroke="${C.edge}"/>`;
  o += big(curve([[150, -20], [176, 60], [210, 120], [230, 146]]), 6) + big(curve([[410, 40], [330, 80], [270, 120], [236, 146]]), 5.5) + big(curve([[-20, 150], [40, 140], [96, 186]]), 5);
  o += `<path d="${parkBlob(r, dx, dy, 18, 14, 8)}" fill="${C.plaza}" stroke="${C.edge}"/>`;
  o += big(curve(Array.from({ length: 24 }, (_, k) => { const a = k / 24 * 6.283; return [292 + Math.cos(a) * 104 * 1.1, 300 + Math.sin(a) * 150 * 1.06]; }), true), 6);
  o += big(curve([[96, 246], [140, 248], [186, 258]]), 6.5) + big(curve([[200, riverY(200) - 30], [208, riverY(208) + 10], [214, riverY(214) + 50]]), 4.5) + way(`M320 ${f(riverY(320) - 6)} L324 ${f(riverY(324) + 40)}M140 ${f(riverY(140) - 6)} L138 ${f(riverY(138) + 40)}`, 4);
  let fan = ''; for (let i = 0; i < 9; i++) { const yy = 196 + i * 12; fan += `M-20 ${f(yy + (i - 4) * 16)}C20 ${f(yy + (i - 4) * 10)} 40 ${f(yy)} 62 ${f(yy)}`; }
  o += `<path d="${fan}" fill="none" stroke="${C.rail}" stroke-width="1.4"/>` + `<rect x="58" y="188" width="38" height="116" rx="2" fill="${C.station}" stroke="${C.stationEdge}" stroke-width="1"/>` + `<path d="M58 211h38M58 234h38M58 257h38M58 280h38" stroke="${C.stationEdge}" stroke-width=".8"/>` + `<rect x="92" y="200" width="12" height="92" rx="1.5" fill="${C.bld2}"/>` + badge(52, 168);
  o += poi(232, 146, G.museum) + poi(26, 134, G.tower) + poi(110, 56, G.park) + poi(dx, dy, G.church) + poi(240, 520, G.museum) + poi(352, 470, G.bridge);
  o += label(104, 172, 'Hauptbahnhof', 11.5, 700, '#4a5058') + label(140, 360, 'Bahnhofsviertel', 10.5) + label(300, 290, 'Altstadt', 11) + label(330, 200, 'Innenstadt', 10.5) + label(200, 482, 'Main', 11, 600, '#5a84ad') + label(150, 548, 'Sachsenhausen', 10.5) + label(190, 92, 'Westend', 10.5) + label(76, 104, 'Palmengarten', 10, 600, '#6b8a5e') + label(266, 168, 'Opernplatz', 10) + label(330, 60, 'Nordend', 10.5);
  return o;
}
// ---- 한국 · 강남역: 넓은 대로가 큰 격자를 만들고, 그 안은 휘어진 골목 덩어리, 뒤로 산 등고선, 대로 밑 지하철
function gangnam() {
  const r = rng('강남역'); let o = `<rect width="${W}" height="${H}" fill="${C.land}"/>`;
  // a hill in the corner with its contour rings
  o += `<path d="${parkBlob(r, 350, 40, 120, 90, 12)}" fill="${C.forest}" opacity=".75"/>`;
  for (let k = 1; k < 5; k++) o += `<path d="${parkBlob(rng('hill' + k), 350, 40, 120 - k * 22, 90 - k * 17, 12)}" fill="none" stroke="#b5d0a6" stroke-width="1"/>`;
  // superblocks between the boulevards, each filled with crooked alleys and many small buildings
  const xs = [-20, 120, 270, 420], ys = [-20, 180, 380, 600];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const x0 = xs[i] + 12, x1 = xs[i + 1] - 12, y0 = ys[j] + 12, y1 = ys[j + 1] - 12, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, a = (r() - 0.5) * 16;
    const box = `M${x0} ${y0}H${x1}V${y1}H${x0}Z`;
    let alleys = ''; for (let k = 0; k < 6; k++) { const yy = y0 + (k + 0.5) * (y1 - y0) / 6; alleys += `M${x0 - 10} ${f(yy)}C${f(cx - 30)} ${f(yy + (r() - 0.5) * 18)} ${f(cx + 30)} ${f(yy + (r() - 0.5) * 18)} ${x1 + 10} ${f(yy + (r() - 0.5) * 10)}`; }
    for (let k = 0; k < 4; k++) { const xx = x0 + (k + 0.5) * (x1 - x0) / 4; alleys += `M${f(xx)} ${y0 - 10}C${f(xx + (r() - 0.5) * 20)} ${f(cy - 40)} ${f(xx + (r() - 0.5) * 20)} ${f(cy + 40)} ${f(xx + (r() - 0.5) * 12)} ${y1 + 10}`; }
    o += clip(box, `<path d="${box}" fill="${C.built}"/>` + blocks(r, cx, cy, a, 12, 10, 3, x0 - 40, x1 + 40, y0 - 40, y1 + 40, 0.92, 1) + way(alleys, 1.8));
  }
  // the boulevards: wide, many lanes (drawn wider), and the subway along the big one
  o += big(`M120 -20V600`, 12) + big(`M270 -20V600`, 9) + big(`M-20 180H410`, 12) + big(`M-20 380H410`, 9);
  o += `<path d="M270 -20V600" stroke="#7ab07a" stroke-width="2.2" stroke-dasharray="1 0" opacity=".0"/>`;
  o += `<path d="M-20 180H410" stroke="#3aa858" stroke-width="2" opacity=".55"/>`;
  o += stationBox(104, 164, 32, 32) + `<circle cx="120" cy="180" r="6" fill="#3aa858"/><path d="M117 180h6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;
  o += poi(196, 270, G.shop) + poi(340, 290, G.museum) + poi(340, 70, G.park);
  o += label(120, 214, '강남역', 12, 700, '#2f7d4f') + label(196, 110, '역삼동', 11) + label(190, 470, '서초동', 11) + label(46, 300, '서초', 11) + label(330, 470, '도곡동', 11) + label(200, 172, '테헤란로', 10, 600, '#9a8a54') + label(132, 540, '강남대로', 10, 600, '#9a8a54');
  return o;
}
// ---- 미국 · 시카고 루프: 똑같은 크기의 바둑판, 동쪽 호수와 반듯한 호숫가 공원, 둘로 갈라지는 강, 루프를 도는 고가 철도
function chicago() {
  const r = rng('Chicago'); let o = `<rect width="${W}" height="${H}" fill="${C.land}"/>`;
  // the lake to the east with a straight shore, the lakefront park
  o += `<path d="M300 -20 L320 120 L316 300 L330 600 H420 V-20Z" fill="${C.water}"/>` + `<path d="M270 -20 L300 -20 L320 120 L316 300 L330 600 H292 L288 300 L290 120Z" fill="${C.park}"/>` + trees(r, 300, 300, 18, 260, 30);
  // a strict even grid west of the park
  o += clip('M-20 -20 H288 L290 120 L288 300 L292 600 H-20Z', `<rect x="-20" y="-20" width="320" height="640" fill="${C.land}"/>` + blocks(r, 140, 280, 0, 30, 30, 6, -20, 300, -20, 620, 0.97, 2) + gridLines(140, 280, 0, 30, 30, 6, -20, 300, -20, 620, 2.6));
  // the river: from the lake west, then splitting north and south
  const rv = `M330 140 C270 142 200 140 150 142 C110 144 92 150 80 170`, rn = `M80 170 C70 120 74 60 66 -20`, rs = `M80 170 C74 240 88 330 70 420 C60 480 64 540 56 600`;
  o += `<path d="${rv}" fill="none" stroke="${C.water}" stroke-width="16" stroke-linecap="round"/><path d="${rn}" fill="none" stroke="${C.water}" stroke-width="14" stroke-linecap="round"/><path d="${rs}" fill="none" stroke="${C.water}" stroke-width="14" stroke-linecap="round"/>`;
  o += way('M222 128V156M150 128V156M78 196H100M90 280H112M72 380H94', 3.4);
  // the elevated loop: a rectangle of rails over the streets
  o += rail('M110 190H250V420H110Z', 3.4) + rail('M250 300H300M110 250H-20', 3);
  o += big('M-20 300H288', 7) + big('M180 -20V600', 7);
  o += stationBox(96, 408, 36, 26) + poi(300, 70, G.park) + poi(214, 236, G.tower) + poi(300, 470, G.museum);
  o += label(180, 260, 'The Loop', 12, 700, '#5b4f6b') + label(114, 448, 'Union Station', 10.5, 700, '#5b4f6b') + label(200, 100, 'River North', 11) + label(220, 500, 'South Loop', 11) + label(350, 240, 'Lake', 11, 600, '#5a84ad') + label(350, 254, 'Michigan', 11, 600, '#5a84ad') + label(300, 30, 'Grant Park', 10, 600, '#6b8a5e');
  return o;
}
const CITIES = [['A. 일본 · 시부야', '🇯🇵', '渋谷', '東京 · 역 앞 번화가', shibuya, '골짜기로 모이는 철도 네 줄 · 각도가 제각각인 골목 패치 · 굽은 큰길'],
  ['B. 독일 · 프랑크푸르트', '🇩🇪', 'Frankfurt am Main', 'Hauptbahnhof · 역 앞 번화가', frankfurt, '부채꼴로 모이는 막다른 역 · 역 앞 바둑판 · 성벽 자리 공원 링 · 구시가 · 강'],
  ['C. 한국 · 강남역', '🇰🇷', '서울', '강남역 · 역 앞 번화가', gangnam, '넓은 대로가 만든 큰 격자 · 안쪽은 휜 골목 · 뒤쪽 산 · 대로 밑 지하철'],
  ['D. 미국 · 시카고', '🇺🇸', 'Chicago', 'Union Station · 역 앞 번화가', chicago, '똑같은 바둑판 · 호숫가 공원 · 갈라지는 강 · 고가 루프']];
const css = `*{box-sizing:border-box;margin:0}body{background:#d9dce2;font-family:-apple-system,'Noto Sans KR',sans-serif;padding:24px;width:1760px;color:#161b22}h1{font-size:22px}p.s{color:#555;font-size:13px;margin:4px 0 16px}
.row{display:grid;grid-template-columns:repeat(4,410px);gap:24px}.col>b{display:block;font-size:16px}.col>small{display:block;color:#555;font-size:12px;margin:4px 0 10px;min-height:32px}
.ph{width:390px;height:844px;border-radius:44px;border:9px solid #111;overflow:hidden;position:relative;background:#f4f5f7}.ph svg{display:block}
.sh{position:absolute;left:0;right:0;top:500px;bottom:0;background:#f4f5f7;border-radius:22px 22px 0 0;box-shadow:0 -6px 24px rgba(22,27,34,.14);padding:12px 18px}.gr{width:36px;height:5px;border-radius:3px;background:#d4d7dc;margin:0 auto 14px}
.sh h2{font-size:24px;font-weight:700}.sh p{color:#7b818c;font-size:13px;margin-top:4px}.card{margin-top:14px;background:#fff;border-radius:18px;height:120px;box-shadow:0 1px 2px rgba(22,27,34,.04),0 8px 24px rgba(22,27,34,.05)}`;
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head><body><h1>다녀간 곳 › 조립식 지도 — 같은 "역 앞 번화가", 네 나라</h1><p class="s">땅 · 길 짜임 · 역 · 랜드마크 · 동네 블록을 도시마다 조립 (이름 해시로 고정)</p><div class="row">`
  + CITIES.map(([t, flag, name, sub, fn, d]) => `<div class="col"><b>${t}</b><small>${d}</small><div class="ph"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${fn()}</svg><div class="sh"><div class="gr"></div><h2>${flag} ${name}</h2><p>${sub}</p><div class="card"></div></div></div></div>`).join('') + `</div></body></html>`;
fs.writeFileSync(path.join(__dirname, 'kit.html'), html);
console.log('ok');
