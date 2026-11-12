// 다녀간 곳 › 실제 지도 시안: OSM(Overpass `out geom`) 데이터를 지금 지도 색으로 그려요.
// node docs/mockups/phone-map/osm/osmmap.js <data.json> <out.html> <lat> <lon> <metersAcross> [labels.json]
const fs = require('fs');
const [, , src, out, lat0s, lon0s, spanS, labelsSrc] = process.argv;
const lat0 = +lat0s, lon0 = +lon0s, FX = process.env.FX ?? (/^(pretty|gmap)$/.test(process.env.STYLE) ? 'BC' : 'BCD');   // FX: A 큰 건물 색 · B 땅 쓰임 색 · C 동네마다 축척 · D 건물 그림자
const C = { land: '#f3f0ea', built: '#ebe7df', park: '#d4e8c9', forest: '#c3dcb5', water: '#b6d4ef', road: '#ffffff', edge: '#dad4c9', major: '#fde7a3', majorEdge: '#e3c77c',
  rail: '#a9a49b', label: '#6f7681', plaza: '#efe6d2', bld: '#e0dbd0', foot: '#e6e1d7',
  mark: '#d5cab6', markStation: '#d3d4d6', resi: '#f0ece5', shop: '#f3e3d6', works: '#e3e3df', railyard: '#e4e2dc', school: '#f3e9c9', shadow: '#bdb4a4' };
// DEEP=1: the same palette a step deeper (less washed out)
if (process.env.DEEP) Object.assign(C, { land: '#efe9df', built: '#e6e0d5', park: '#c6e0b4', forest: '#b3d3a0', water: '#a3c9ee', edge: '#cfc7b8', major: '#fcd87c', majorEdge: '#dcb75e',
  label: '#5c636e', bld: '#d6cdbd', foot: '#ddd6ca', mark: '#c9b99d', resi: '#ebe5da', shop: '#f0dccb', works: '#dcdcd6', railyard: '#dedbd3', school: '#efe3bc', shadow: '#ada291' });
// PAL=cool|neutral|paper|terra: the same depth, a different tone
const PALS = {
  cool: { land: '#eceef0', built: '#e6e9ec', bld: '#d5dae0', shadow: '#b8bfc8', edge: '#cfd4da', park: '#cbe3c4', forest: '#b7d6ae', water: '#a7c8ec', major: '#f9dc8a', majorEdge: '#dfbe6a',
    label: '#58606b', foot: '#dde1e5', resi: '#e9ecef', shop: '#efe4e0', works: '#dee1e5', railyard: '#e0e3e6', school: '#efe8cf', plaza: '#e8eaec', mark: '#c9d0d8' },
  neutral: { land: '#f5f5f3', built: '#efefec', bld: '#dededa', shadow: '#c4c4be', edge: '#d6d6d1', park: '#c3e5b6', forest: '#aed8a0', water: '#9fcaf2', major: '#fce8b4', majorEdge: '#e9d298',
    label: '#5f646c', foot: '#e4e4e0', resi: '#f1f1ee', shop: '#f5e6dc', works: '#e6e6e3', railyard: '#e3e3df', school: '#f3ebcc', plaza: '#ececea', mark: '#d2d2cc' },
  paper: { land: '#f2ead9', built: '#ece2cf', bld: '#ddcfb5', shadow: '#c2b296', edge: '#d6c9b0', park: '#cddcb0', forest: '#b9cd98', water: '#a9c7d9', major: '#f4cf7f', majorEdge: '#d4ab5a',
    label: '#6a5f50', foot: '#e3d8c3', resi: '#efe6d4', shop: '#f0dcc4', works: '#e2dccf', railyard: '#e3dccd', school: '#efe1b8', plaza: '#ebdfc8', mark: '#d2c09f' },
  terra: { land: '#f1ebe3', built: '#ebe2d8', bld: '#dcc4b2', shadow: '#bea08a', edge: '#d5c7b9', park: '#c8ddb4', forest: '#b3cf9c', water: '#a5c8e6', major: '#f8d58a', majorEdge: '#d9b064',
    label: '#66594f', foot: '#e2d7cc', resi: '#eee6dc', shop: '#f0dccd', works: '#e3ded8', railyard: '#e4ded7', school: '#efe2c0', plaza: '#ebe0d3', mark: '#d0b19b' } };
// ROAD=1|1.5|2: softer yellow for the big roads
if (PALS.neutral && process.env.ROAD) Object.assign(PALS.neutral, process.env.ROAD === '2' ? { major: '#fcedc6', majorEdge: '#ead8a8' } : process.env.ROAD === '1.5' ? { major: '#fce8b4', majorEdge: '#e9d298' } : { major: '#fce3a2', majorEdge: '#e9cd88' });
// PAL=mix: halfway between the neutral tone and the old beige
{ const hx = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), mixc = (a, b) => '#' + hx(a).map((v, i) => Math.round((v + hx(b)[i]) / 2).toString(16).padStart(2, '0')).join('');
  PALS.mix = Object.fromEntries(Object.entries(PALS.neutral).map(([k2, v]) => [k2, C[k2] ? mixc(v, C[k2]) : v])); }
if (PALS[process.env.PAL ?? 'neutral']) Object.assign(C, PALS[process.env.PAL ?? 'neutral']);   // 기본: 2 중립 밝은 톤 + B·C·D
const d = JSON.parse(require('fs').readFileSync(src, 'utf8'));
{ const cv = src.replace(/\.json$/, '-cover.json'); if (require('fs').existsSync(cv)) { const seen = new Set(d.elements.map(e => e.type + e.id)); for (const e of JSON.parse(require('fs').readFileSync(cv, 'utf8')).elements) if (!seen.has(e.type + e.id)) d.elements.push(e); } }
const mx = 111320 * Math.cos(lat0 * Math.PI / 180), my = 110540;
// C: dense old towns closer, loose estates and parks further out — buildings per km² round the centre
let span = +spanS;
if (FX.includes('C')) {
  let n = 0; for (const e of d.elements) if (e.tags && e.tags.building && e.geometry) { const g = e.geometry[0], x = (g.lon - lon0) * mx, y = (g.lat - lat0) * my; if (Math.abs(x) < 500 && Math.abs(y) < 500) n++; }
  span = Math.max(1000, Math.min(1550, 2600 - n * 1.1)); console.log('density', n, '→ span', Math.round(span));
}
const W = 390, H = 560, k = W / span;                       // px per meter
const P = (la, lo) => [W / 2 + (lo - lon0) * mx * k, H / 2 - (la - lat0) * my * k];
const f = n => (Math.round(n * 10) / 10).toString();
const pts = g => g.map(p => P(p.lat, p.lon));
const line = ps => 'M' + ps.map(p => f(p[0]) + ' ' + f(p[1])).join('L');
const ring = ps => line(ps) + 'Z';
// relation outer/inner members → joined rings
function rings(members) {
  const segs = members.filter(m => m.geometry).map(m => ({ role: m.role || 'outer', g: m.geometry.map(p => [p.lat, p.lon]) }));
  const outv = [], same = (a, b) => a[0] === b[0] && a[1] === b[1];
  for (const role of ['outer', 'inner']) {
    const left = segs.filter(s => s.role === role).map(s => s.g);
    while (left.length) {
      let cur = left.shift();
      for (let grow = true; grow && !same(cur[0], cur.at(-1));) {
        grow = false;
        for (let i = 0; i < left.length; i++) {
          const s = left[i];
          if (same(cur.at(-1), s[0])) cur = cur.concat(s.slice(1));
          else if (same(cur.at(-1), s.at(-1))) cur = cur.concat(s.slice(0, -1).reverse());
          else if (same(cur[0], s.at(-1))) cur = s.concat(cur.slice(1));
          else if (same(cur[0], s[0])) cur = s.slice(1).reverse().concat(cur);
          else continue;
          left.splice(i, 1); grow = true; break;
        }
      }
      outv.push(ring(cur.map(([a, b]) => P(a, b))));
    }
  }
  return outv.join('');
}
// the sea: OSM draws a coast as lines with the land on their left; joined, then closed round a frame outside the screen on the water side
function sea() {
  const ways = d.elements.filter(e => e.type === 'way' && e.tags && e.tags.natural === 'coastline' && e.geometry).map(e => e.geometry.map(g => [g.lon, g.lat]));
  if (!ways.length) return '';
  const same = (a, b) => a[0] === b[0] && a[1] === b[1], chains = [];
  while (ways.length) { let c = ways.shift(); for (let grow = true; grow;) { grow = false; for (let i = 0; i < ways.length; i++) { const w = ways[i];
    if (same(c.at(-1), w[0])) { c = c.concat(w.slice(1)); ways.splice(i, 1); grow = true; break; } if (same(w.at(-1), c[0])) { c = w.concat(c.slice(1)); ways.splice(i, 1); grow = true; break; } } } chains.push(c); }
  const X0 = -400, Y0 = -400, X1 = W + 400, Y1 = H + 400, per = 2 * (X1 - X0 + Y1 - Y0);
  const tOf = ([x, y]) => { const c = [Math.abs(y - Y0), Math.abs(x - X1), Math.abs(y - Y1), Math.abs(x - X0)], k = c.indexOf(Math.min(...c));
    return [x - X0, (X1 - X0) + (y - Y0), (X1 - X0) + (Y1 - Y0) + (X1 - x), 2 * (X1 - X0) + (Y1 - Y0) + (Y1 - y)][k]; };
  const atT = t => { t = ((t % per) + per) % per; const a = X1 - X0, b = Y1 - Y0; return t < a ? [X0 + t, Y0] : t < a + b ? [X1, Y0 + t - a] : t < 2 * a + b ? [X1 - (t - a - b), Y1] : [X0, Y1 - (t - 2 * a - b)]; };
  const inside = (x, y, ps) => { let c = false; for (let i = 0, j = ps.length - 1; i < ps.length; j = i++) { const [a, b] = ps[i], [u, v] = ps[j]; if ((b > y) !== (v > y) && x < (u - a) * (y - b) / (v - b) + a) c = !c; } return c; };
  let out = '';
  for (const c of chains) {
    const px = c.map(([lo, la]) => P(la, lo)).map(([x, y]) => [Math.max(X0, Math.min(X1, x)), Math.max(Y0, Math.min(Y1, y))]);
    if (px.length < 2) continue;
    if (same(c[0], c.at(-1))) { out += ring(px); continue; }   // an island: the ring itself is land, so the water is everything else
    const tb = tOf(px.at(-1)), ta = tOf(px[0]), corners = [0, X1 - X0, X1 - X0 + Y1 - Y0, 2 * (X1 - X0) + Y1 - Y0];
    const walk = dir => { const pts = []; let t = tb; const end = dir > 0 ? (ta - tb + per) % per : (tb - ta + per) % per;
      const cs = corners.map(k => dir > 0 ? (k - tb + per) % per : (tb - k + per) % per).map((dd, i) => [dd, corners[i]]).filter(([dd]) => dd > 0 && dd < end).sort((a, b) => a[0] - b[0]);
      for (const [, k] of cs) pts.push(atT(k)); return [...px, atT(tb), ...pts, atT(ta)]; };
    // the water is on the coast's right (land on the left): test a point just right of the middle of the line
    const m = Math.floor(c.length / 2), [lo0, la0] = c[Math.max(0, m - 1)], [lo1, la1] = c[Math.min(c.length - 1, m)], ddx = lo1 - lo0, ddy = la1 - la0, nn = Math.hypot(ddx, ddy) || 1;
    const tp = P((la0 + la1) / 2 - ddx / nn * 0.0002, (lo0 + lo1) / 2 + ddy / nn * 0.0002);
    const A = walk(1), B = walk(-1); out += ring(inside(tp[0], tp[1], A) ? A : B);
  }
  return out;
}
const area = e => e.type === 'relation' ? rings(e.members || []) : (e.geometry ? ring(pts(e.geometry)) : '');
const COVER = { farm: '#f0eddc', grass: '#d3ebc4', scrub: '#c9ddb0', vine: '#dfe6bf', orchard: '#cfe5b8', allot: '#d9e8c6', grave: '#cfdcc8', rock: '#dcd9d3', sand: '#f3ead0', wet: '#cfe3dc' };
const coverOf = t => { const n = t.natural, u = t.landuse;
  if (n === 'wood' || u === 'forest') return 'forest';
  if (/scrub|heath|shrubbery|fell/.test(n || '')) return 'scrub';
  if (/bare_rock|scree|shingle|cliff|glacier/.test(n || '') || u === 'quarry') return 'rock';
  if (/sand|beach/.test(n || '')) return 'sand';
  if (n === 'wetland') return 'wet';
  if (n === 'grassland' || /^(grass|meadow|village_green|greenery|greenfield|recreation_ground|flowerbed)$/.test(u || '') || t.leisure === 'golf_course') return 'grass';
  if (u === 'vineyard') return 'vine';
  if (u === 'orchard' || u === 'plant_nursery') return 'orchard';
  if (/farmland|farmyard/.test(u || '')) return 'farm';
  if (u === 'allotments') return 'allot';
  if (u === 'cemetery') return 'grave';
  return null; };
// rails: bundles of parallel tracks collapse to one line, lone tracks (a harbour line, a spur) stay.
// greedy: main lines first, longest first; a track mostly within 30 m of an accepted one is dropped
const RAILKEEP = new Set();
{ const ways = d.elements.filter(e => e.type === 'way' && e.geometry && e.tags && /^(rail|light_rail)$/.test(e.tags.railway) && !(e.tags.tunnel && e.tags.tunnel !== 'no'));
  const toM = g => g.map(p => [(p.lon - lon0) * mx, (p.lat - lat0) * my]);
  const sample = ms => { const o = []; for (let i = 1; i < ms.length; i++) { const [a, b] = [ms[i - 1], ms[i]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6)); for (let k = 0; k < n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } o.push(ms.at(-1)); return o; };
  const len = ms => ms.reduce((s, p, i) => i ? s + Math.hypot(p[0] - ms[i - 1][0], p[1] - ms[i - 1][1]) : 0, 0);
  const W8 = ways.map(e => { const ms = toM(e.geometry); return { e, pts: sample(ms), len: len(ms), main: !e.tags.service }; }).sort((a, b) => (b.main - a.main) || (b.len - a.len));
  const grid = new Map(), cell = 30, key = (x, y) => Math.floor(x / cell) + ',' + Math.floor(y / cell);
  const near = ([x, y]) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const c = grid.get((Math.floor(x / cell) + i) + ',' + (Math.floor(y / cell) + j)); if (c) for (const [u, v] of c) if ((u - x) ** 2 + (v - y) ** 2 < cell * cell) return true; } return false; };
  for (const w of W8) {
    const hit = w.pts.filter(near).length / w.pts.length;
    if (process.env.RAIL === 'old' || hit < 0.5) { RAILKEEP.add(w.e.id); for (const p of w.pts) { const k = key(p[0], p[1]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); } }
  } }
const LC = Object.fromEntries(Object.keys(COVER).map(k => [k, '']));
// STYLE=pretty: the real shapes drawn the way the old kit maps were — fewer lines, big charcoal names, icons, a station box, trees in parks
const PRETTY = process.env.STYLE === 'pretty';
// STYLE=gmap: a busy street map's manner — cream ground, land uses in their own colours, hardly any houses, white streets with no rim, coloured place names with their icons, street names along the streets
const GMAP = process.env.STYLE === 'gmap', COLLECT = PRETTY || GMAP, STREETS = [], FOOT = [];
// gmap: ordinary blocks stay the quiet ground (homes, shops, offices alike); only the places that mean something get a colour — parks, campuses, works yards, water
if (GMAP) Object.assign(C, { land: '#f5ede2', built: '#f5ede2', resi: '#f5ede2', shop: '#f5ede2', works: '#ebe8e3', railyard: '#ebe8e3', school: '#efdcb6', park: '#c2e0a3', forest: '#b2d796', water: '#a4cdf2',
  bld: '#dedbd6', edge: '#dccfbb', road: '#ffffff', major: '#fdd98a', majorEdge: '#e9b85a', plaza: '#f5ede2', foot: '#d2e9bd' });
if (GMAP) Object.assign(COVER, { grass: '#d3ecc3', allot: '#d6ebc5', orchard: '#cfe8bc', vine: '#dde8c0', grave: '#d4e3cb', scrub: '#cfe3b8', farm: '#f1ecd9' });
// GPAL=A|B|C: the street-map manner in three looks — A warm pale cream with mint parks, B light grey with sage parks and slate water,
// C light grey with mint parks, cyan water and apricot main roads
const GPALS = {
    A: { land: '#faf6ee', built: '#faf6ee', resi: '#faf6ee', shop: '#fbf0d6', works: '#efece6', railyard: '#efece6', school: '#f4e7c6', park: '#c3e9cc', forest: '#b1e0bc', water: '#a9d8f0', vine: '#e6edc3', bld: '#efe9df', edge: '#e6dece', major: '#fbe9b8', majorEdge: '#ecd59a', plaza: '#faf6ee' },
    B: { land: '#f2f2f0', built: '#f2f2f0', resi: '#f2f2f0', shop: '#ede2de', works: '#e5e5e2', railyard: '#e5e5e2', school: '#e9e5dd', park: '#c8d7c6', forest: '#b7cab5', water: '#5d7882', vine: '#dcdcc4', bld: '#e7e7e4', edge: '#d8d8d4', major: '#bcb1a6', majorEdge: '#a1968c', plaza: '#f2f2f0' },
    C: { land: '#f3f3f3', built: '#f3f3f3', resi: '#f3f3f3', shop: '#f3eeee', works: '#ebebeb', railyard: '#ebebeb', school: '#f1ead9', park: '#c9f0d7', forest: '#b8e7c7', water: '#a7e4ee', vine: '#e4f1c6', bld: '#e9e9e9', edge: '#dcdcdc', major: '#fdd3ae', majorEdge: '#f3b98a', plaza: '#f3f3f3' },
};
GPALS.AC = { ...GPALS.A, water: GPALS.C.water, major: GPALS.C.major, majorEdge: GPALS.C.majorEdge };   // A's cream with C's water and apricot main roads
GPALS.ACa = { ...GPALS.A, water: GPALS.C.water };
GPALS.ACm = { ...GPALS.ACa, motor: GPALS.C.major, motorEdge: GPALS.C.majorEdge };   // pale yellow main roads, apricot motorways   // A's cream and main roads with C's water
// 기본 GPAL: ACa (A 바탕 + C 물 + A 연노랑 큰길)
if (GMAP && GPALS[process.env.GPAL ?? 'ACa']) { const g = GPALS[process.env.GPAL ?? 'ACa']; Object.assign(C, g); Object.assign(COVER, { grass: g.park, allot: g.park, orchard: g.park, vine: g.vine, grave: g.park, scrub: g.forest, farm: g.school }); }   // vineyards keep their own yellow-green
const { ICON, glyph, pick } = require('./icons.js');
const COVER0 = null;
const pxArea = ps => Math.abs(ps.reduce((s, p, i) => { const q = ps[(i + 1) % ps.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const centre = ps => { const n = ps.length; return [ps.reduce((s, p) => s + p[0], 0) / n, ps.reduce((s, p) => s + p[1], 0) / n]; };
const POIS = [], GREENS = [];
// a place worth a name on the map: not a car park, not a chain shop or supermarket (EDEKA, PENNY…), unless it has its own wiki page
const okPlace = (t, ic) => ic !== 'parking' && ic !== 'fuel' && !(t.brand && !t.wikipedia) && !((t.shop || ic === 'shop' || ic === 'mall') && !t.wikidata);
const L = { sea: '', motor: '', station: '',  shop: '', works: '', railyard: '', school: '', mark: '', markStation: '', shadow: {}, built: '', park: '', forest: '', water: '', plaza: '', bld: '', foot: '', minor: '', mid: '', major: '', rail: '', tram: '' };
const BUILT = /residential|commercial|retail|industrial|railway|construction|brownfield|education|emergency/;
const GREEN = /grass|village_green|flowerbed|meadow|allotments|cemetery|greenhouse/;
for (const e of d.elements) {
  const t = e.tags || {}, closed = e.geometry && e.geometry.length > 2 && e.geometry[0].lat === e.geometry.at(-1).lat && e.geometry[0].lon === e.geometry.at(-1).lon;
  if (t.natural === 'water' || (t.waterway && /riverbank|dock/.test(t.waterway))) { L.water += area(e); continue; }
  if (t.building) {
    if (e.type !== 'way' || !closed) continue;
    const a = area(e);
    if (PRETTY || GMAP) {
      const ps = pts(e.geometry), px = pxArea(ps);
      { const ic = pick(t); if (ic && (t.name || t.wikidata) && okPlace(t, ic)) POIS.push({ ic, at: centre(ps), pr: (t.wikidata ? 2 : 0) + (t.name ? 1 : 0) + Math.min(2, px / 400), name: t.name }); }
      if (t.building === 'train_station' || t.railway === 'station') { L.station += a; continue; }
      if (px < 40 * k * k * 2.2) continue;          // the tiny sheds and kiosks go
      if (GMAP) continue;                              // gmap: no houses at this scale — the blocks are the ground
    }
    // A: churches, stations, castles, halls and anything with its own wiki page stand out a little
    const big = /cathedral|church|chapel|castle|palace|train_station|government|museum|civic|public|university|stadium|transportation/.test(t.building) || t.historic || t.tourism || t.wikidata || t.amenity === 'place_of_worship';
    if (FX.includes('A') && big) { if (/train_station|transportation/.test(t.building) || t.railway) L.markStation += a; else L.mark += a; }
    else L.bld += a;
    // D: a soft shadow down-right, longer for taller houses
    if (FX.includes('D')) { const lv = parseFloat(t['building:levels']) || (t.height ? parseFloat(t.height) / 3 : 0) || 3, off = Math.min(7, 0.5 + lv * 3 * k * 0.3), b = (Math.round(off * 2) / 2).toFixed(1); L.shadow[b] = (L.shadow[b] || '') + a; }
    continue;
  }
  if (COLLECT && e.geometry) { const ic = pick(t); if (ic && t.name && !t.building && okPlace(t, ic)) { const ps = pts(e.geometry); POIS.push({ ic, at: centre(ps), pr: (t.wikidata ? 2 : 0) + 1 + Math.min(2, pxArea(ps) / 3000), name: t.name }); } }
  if (COLLECT && e.type === 'node') { const ic = pick(t); if (ic && (t.name || t.wikidata) && okPlace(t, ic)) POIS.push({ ic, at: P(e.lat, e.lon), pr: (t.wikidata ? 2.5 : 0) + 1, name: t.name }); }
  // gmap: parks only where they matter — courtyard lawns, flowerbeds and small gardens go
  if (GMAP && e.type === 'way' && e.geometry && (t.leisure && /park|garden/.test(t.leisure) || /^(grass|flowerbed|village_green|greenery)$/.test(t.landuse || '') || t.natural === 'grassland') && pxArea(pts(e.geometry)) < 2500 * k * k) continue;
  if (t.leisure && /park|garden/.test(t.leisure)) { L.park += area(e); if (COLLECT && e.type === 'way' && e.geometry) GREENS.push(pts(e.geometry)); continue; }
  { const c = coverOf(t); if (c) { if (c === 'forest') L.forest += area(e); else LC[c] += area(e); continue; } }
  if (t.landuse && GREEN.test(t.landuse)) { L.park += area(e); continue; }
  if (t.landuse && BUILT.test(t.landuse)) {
    const a = area(e), u = t.landuse;
    if (!FX.includes('B')) L.built += a;
    else if (u === 'residential') L.resi += a; else if (/commercial|retail/.test(u)) L.shop += a; else if (u === 'industrial') L.works += a;
    else if (u === 'railway') L.railyard += a; else if (u === 'education') L.school += a; else L.built += a;
    continue;
  }
  if (e.type !== 'way' || !e.geometry) continue;
  if (t.tunnel && t.tunnel !== 'no') continue;
  const h = t.highway, rw = t.railway;
  if (h === 'pedestrian' && closed && t.area === 'yes') { L.plaza += area(e); continue; }
  const dl = line(pts(e.geometry));
  if (h) {
    if (GMAP && /^(trunk|motorway)(_link)?$/.test(h)) L.motor += dl;   // gmap: motorways and trunk roads apart, so they can take their own colour
    else if (/^(primary|trunk|motorway)(_link)?$/.test(h)) L.major += dl;
    else if (/^(secondary|tertiary)(_link)?$/.test(h)) L.mid += dl;
    else if (/^(residential|unclassified|living_street|pedestrian|busway)$/.test(h) || h === 'service' && (!COLLECT || t.name)) L.minor += dl;
    else if (/^(footway|path|cycleway|track)$/.test(h) && !PRETTY) { if (GMAP) { const ps = pts(e.geometry); FOOT.push({ dl, ps }); } else L.foot += dl; }
    if (GMAP && t.name && /^(primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$/.test(h)) STREETS.push({ name: t.name, ps: pts(e.geometry), rank: /^(primary|secondary)$/.test(h) ? 3 : h === 'tertiary' ? 2 : 1 });
  } else if (rw === 'rail' || rw === 'light_rail') {
    // RAIL=old keeps every track dashed; by default the yard tracks (sidings, spurs) vanish into the yard's face and the main lines are one thin line
    if (RAILKEEP.has(e.id)) L.rail += dl;
  }
  else if (rw === 'tram') L.tram += dl;
}
// TERRAIN=<prefix from terrain.py>: height bands on green, depth on water, soft hill shading under the houses
function terrain() {
  const T = process.env.TERRAIN; if (!T) return '';
  const m = JSON.parse(fs.readFileSync(T + '.json', 'utf8')), [x0, y0] = P(m.N, m.W), [x1, y1] = P(m.S, m.E);
  const img = (name, extra = '') => `<image href="data:image/png;base64,${fs.readFileSync(T + '-' + name + '.png').toString('base64')}" x="${f(x0)}" y="${f(y0)}" width="${f(x1 - x0)}" height="${f(y1 - y0)}" preserveAspectRatio="none"${extra}/>`;
  const defs = `<defs><clipPath id="tg"><path d="${L.park + L.forest}"/></clipPath><mask id="tl"><rect x="-50" y="-50" width="${W + 100}" height="${H + 100}" fill="#fff"/><path d="${L.water}" fill="#000"/></mask></defs>`;
  // TSTYLE=steps: flat height bands on green (sharp edges); steps+shade: plus two flat shade tones on the far slopes
  if (process.env.TSTYLE === 'steps') return defs + img('steps', ' clip-path="url(#tg)"');
  if (process.env.TSTYLE === 'steps+shade') return defs + img('steps', ' clip-path="url(#tg)"') + img('stepshade', ' mask="url(#tl)"');
  return `<defs><clipPath id="tg"><path d="${L.park + L.forest}"/></clipPath><clipPath id="tw"><path d="${L.water}"/></clipPath><mask id="tl"><rect x="-50" y="-50" width="${W + 100}" height="${H + 100}" fill="#fff"/><path d="${L.water}" fill="#000"/></mask></defs>`
    + (L.park + L.forest ? img('hills', ' clip-path="url(#tg)"') : '') + (L.water ? img('depth', ' clip-path="url(#tw)"') : '') + img('shade', ' mask="url(#tl)" opacity=".35"') + (L.park + L.forest ? img('shade', ' clip-path="url(#tg)" opacity=".65"') : '');
}
const st = (dd, col, w, extra = '') => dd ? `<path d="${dd}" fill="none" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>` : '';
const fill = (dd, col) => dd ? `<path d="${dd}" fill="${col}" fill-rule="evenodd"/>` : '';
const mpx = m => Math.max(0.6, m * k);                       // real width in meters → px, with a floor
let svg = `<rect width="${W}" height="${H}" fill="${C.land}"/>`
  + fill(L.built, C.built) + fill(L.resi, C.resi) + fill(L.shop, C.shop) + fill(L.works, C.works) + fill(L.railyard, C.railyard) + fill(L.school, C.school)
  + ['farm', 'grass', 'allot', 'orchard', 'vine', 'grave', 'scrub', 'wet', 'sand', 'rock'].map(k => fill(LC[k], COVER[k])).join('') + fill(L.park, C.park) + fill(L.forest, C.forest) + fill(L.plaza, C.plaza) + fill(sea(), C.water) + fill(L.water, C.water)
  + terrain()
  + Object.entries(L.shadow).map(([o, dd]) => `<path d="${dd}" fill="${C.shadow}" opacity=".75" transform="translate(${o} ${(o * 1.3).toFixed(1)})"/>`).join('')
  + fill(L.bld, C.bld) + fill(L.mark, C.mark) + fill(L.markStation, C.markStation)
  + (L.park + L.forest ? `<defs><clipPath id="fg"><path d="${L.park + L.forest}"/></clipPath><mask id="fo"><rect x="-50" y="-50" width="${W + 100}" height="${H + 100}" fill="#fff"/><path d="${L.park + L.forest}" fill="#000"/></mask></defs>`
      + `<g mask="url(#fo)">${st(L.foot, C.foot, mpx(3))}</g><g clip-path="url(#fg)" opacity=".35">${st(L.foot, C.foot, mpx(2.4))}</g>` : st(L.foot, C.foot, mpx(3)))
  + st(L.minor, C.edge, mpx(9) + 1.6) + st(L.mid, C.edge, mpx(12) + 1.8)
  + st(L.minor, C.road, mpx(9)) + st(L.mid, C.road, mpx(12))
  + (process.env.RAIL === 'old' ? st(L.rail, C.rail, 2.4) + st(L.rail, C.land, 1.1, ' stroke-dasharray="4 4"') + st(L.tram, C.rail, 0.9)
     : (process.env.RAIL ?? 'dash') === 'dash' ? st(L.rail, '#b4b4ae', 2.6) + st(L.rail, '#f5f5f3', 1.1, ' stroke-dasharray="6 5"') + st(L.tram, '#b9b9b3', 0.6, ' opacity=".6"')
     : process.env.RAIL === 'band' ? st(L.rail, '#bdbdb7', 2.8) + st(L.rail, '#f2f2ef', 0.9) + st(L.tram, '#b9b9b3', 0.6, ' opacity=".6"')
     : st(L.rail, C.railLine || '#b9b9b3', 1.3) + st(L.tram, C.railLine || '#b9b9b3', 0.6, ' opacity=".6"'))
  + st(L.major, C.majorEdge, mpx(16) + 2) + st(L.major, C.major, mpx(16))
  + (PRETTY ? prettyTop() : '');
if (GMAP) svg = `<rect width="${W}" height="${H}" fill="${C.land}"/>`
  + fill(L.built, C.built) + fill(L.resi, C.resi) + fill(L.shop, C.shop) + fill(L.works, C.works) + fill(L.railyard, C.railyard) + fill(L.school, C.school)
  + ['farm', 'grass', 'allot', 'orchard', 'vine', 'grave', 'scrub', 'wet', 'sand', 'rock'].map(k2 => fill(LC[k2], COVER[k2])).join('') + fill(L.park, C.park) + fill(L.forest, C.forest) + fill(L.plaza, C.plaza) + fill(sea(), C.water) + fill(L.water, C.water)
  + fill(L.bld, C.bld) + fill(L.station, '#e2dfda')
  // park paths as faces, not lines: the few long ones as a soft band one shade lighter than the grass, no rim
  + (L.park + L.forest ? `<defs><clipPath id="gp"><path d="${L.park + L.forest}"/></clipPath></defs><g clip-path="url(#gp)">${st(parkPaths(), C.foot, Math.max(3.6, mpx(4)))}</g>` : '')
  + st(L.minor, C.edge, Math.max(5.5, mpx(8)) + 1.2) + st(L.mid, C.edge, Math.max(8, mpx(12)) + 1.35)
  + st(L.minor, C.road, Math.max(5.5, mpx(8))) + st(L.mid, C.road, Math.max(8, mpx(12)))
  + st(L.rail, '#b8b6b2', 2.2) + st(L.rail, '#f4efe6', 0.9, ' stroke-dasharray="6 5"')
  + st(L.major, C.majorEdge, Math.max(10, mpx(16)) + 1.35) + st(L.major, C.major, Math.max(10, mpx(16)))
  + st(L.motor, C.motorEdge || C.majorEdge, Math.max(11, mpx(20)) + 1.35) + st(L.motor, C.motor || C.major, Math.max(11, mpx(20)));
// the park paths worth a soft band: measured only where they run inside a park and on screen, the longest few
function parkPaths() {
  const inside = (x, y, ps) => { let c = false; for (let i = 0, j = ps.length - 1; i < ps.length; j = i++) { const [a, b] = ps[i], [u, v] = ps[j]; if ((b > y) !== (v > y) && x < (u - a) * (y - b) / (v - b) + a) c = !c; } return c; };
  const big = GREENS.filter(g => pxArea(g) > 2500 * k * k), inPark = ([x, y]) => x > 0 && x < W && y > 0 && y < 490 && big.some(g => inside(x, y, g));
  const cand = FOOT.map(q => ({ ...q, len: q.ps.reduce((a, pt, i) => i && inPark(pt) && inPark(q.ps[i - 1]) ? a + Math.hypot(pt[0] - q.ps[i - 1][0], pt[1] - q.ps[i - 1][1]) : a, 0) }))
    .filter(q => q.len > 50 * k).sort((a, b) => b.len - a.len);
  // no two paths side by side: a path mostly within 28 px of one already drawn is left out
  const kept = [], dots = [], gap = 28;
  for (const q of cand) { const sp = []; for (let i = 1; i < q.ps.length; i++) { const [a, b] = [q.ps[i - 1], q.ps[i]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6)); for (let j = 0; j < n; j++) sp.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); }
    const vis = sp.filter(inPark); if (!vis.length) continue;
    const near = vis.filter(([x, y]) => dots.some(([u, v]) => (u - x) ** 2 + (v - y) ** 2 < gap * gap)).length / vis.length;
    if (near > 0.3) continue; kept.push(q.dl); dots.push(...vis); if (kept.length >= 8) break; }
  return kept.join('');
}
// trees in the parks, the station box, the icons — the old kit's pieces on the real shapes
function prettyTop() {
  let o = '', seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const inside = (x, y, ps) => { let c = false; for (let i = 0, j = ps.length - 1; i < ps.length; j = i++) { const [a, b] = ps[i], [u, v] = ps[j]; if ((b > y) !== (v > y) && x < (u - a) * (y - b) / (v - b) + a) c = !c; } return c; };
  for (const ps of GREENS) { const A = pxArea(ps); if (A < 500) continue; const xs = ps.map(p => p[0]), ys = ps.map(p => p[1]), [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    for (let n = Math.min(60, A / 220), i = 0, tries = 0; i < n && tries < n * 6; tries++) { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); if (x < -10 || x > W + 10 || y < -10 || y > H + 10 || !inside(x, y, ps)) continue; o += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(2 + rnd() * 2.4)}" fill="${C.tree || C.forest}"/>`; i++; } }
  if (L.station) o += `<path d="${L.station}" fill="${C.station || '#d9d2c5'}" stroke="${C.stationEdge || '#c4bcae'}" stroke-width="1.2" fill-rule="evenodd"/>`;
  return o;
}
// no labels file → names from the data: stations, quarters, sights, the river; greedy, no overlaps, above the sheet
const CITY = /^(Berlin|München|Hamburg|Köln|Düsseldorf|Frankfurt \(Main\)|Frankfurt|Dresden|Heidelberg|Leipzig|Nürnberg)[\s-]+/;
function autoLabels() {
  const cand = [], seen = new Set();
  for (const e of d.elements) {
    const t = e.tags || {};
    let n = t.name; if (!n) continue;
    if (t.railway === 'station') n = /Hauptbahnhof|Hbf/.test(n) ? 'Hauptbahnhof' : n.replace(CITY, '').replace(/^[SU]\+?[SU]? /, '');
    if (n.length > 20) continue;
    if (e.type === 'node') {
      let pr = 0, sz = 11, wt = 600, col = C.label;
      if (t.railway === 'station') { if (t.station === 'subway') continue; pr = 5; sz = 11.5; wt = 700; col = '#4a5058'; }
      else if (t.place === 'suburb') pr = 4; else if (t.place === 'quarter') pr = 3.5; else if (t.place === 'square') pr = 2.5;
      else if (t.place === 'neighbourhood') { pr = 2; sz = 10.5; } else if (t.tourism === 'attraction' && t.wikidata && !t.shop) { pr = 1; sz = 10; }
      if (pr) cand.push([pr, e.lat, e.lon, n, sz, wt, col]);
    } else if (e.type === 'way' && t.waterway === 'river' && e.geometry) {
      const ps = e.geometry.filter(p => { const [x, y] = P(p.lat, p.lon); return x > 40 && x < W - 40 && y > 30 && y < 470; });
      if (ps.length) { const p = ps[ps.length >> 1]; cand.push([4.5, p.lat, p.lon, n, 11, 600, '#5a84ad']); }
    }
  }
  cand.sort((a, b) => b[0] - a[0]);
  const boxes = [], outL = [];
  const M = process.env.MAIN;
  if (M) { const nd = d.elements.find(e => e.type === 'node' && e.tags && e.tags.name === M && e.tags.place); let la = lat0 + 40 / (my * k), lo = lon0;
    if (nd) { const [x, y] = P(nd.lat, nd.lon); if (x > 60 && x < W - 60 && y > 40 && y < 440) [la, lo] = [nd.lat, nd.lon]; }
    const [x, y] = P(la, lo), w = M.length * 16 * 0.62 + 10; boxes.push([x - w / 2 - 10, y - 26, x + w / 2 + 10, y + 10]); seen.add(M); outL.push([la, lo, M, 16, 800, '#3a4048']); }
  for (const [pr, la, lo, n, sz, wt, col] of cand) {
    if (seen.has(n)) continue;
    const zs = PRETTY ? 1.25 : 1, [x, y] = P(la, lo), w = n.length * sz * zs * 0.6 + 6, h = sz * zs + 6;
    if (x - w / 2 < 6 || x + w / 2 > W - 6 || y - h < 14 || y > 486) continue;
    const b = [x - w / 2 - 8, y - h - 6, x + w / 2 + 8, y + 6];
    if (boxes.some(c => b[0] < c[2] && b[2] > c[0] && b[1] < c[3] && b[3] > c[1])) continue;
    boxes.push(b); seen.add(n); outL.push([la, lo, n, sz, wt, col]);
    if (outL.length >= 8) break;
  }
  return outL;
}
const labels = labelsSrc ? JSON.parse(fs.readFileSync(labelsSrc, 'utf8')) : autoLabels();
if (PRETTY) svg += prettyMarks(labels);
if (GMAP) { svg += gmapMarks(labels); labels.length = 0; }
for (const [la, lo, text, size = 11, wt = 600, col = C.label] of labels) {
  const [x, y] = P(la, lo);
  if (PRETTY) { const big = size >= 11.5 || wt >= 700, first = text === labels[0][2], sz = first ? 16 : big ? 14 : 12, cl = col === '#5a84ad' ? '#4f7aa6' : big ? '#3f454d' : '#5a6069';
    svg += `<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-family="-apple-system, 'Noto Sans KR', 'Hiragino Sans', sans-serif" font-size="${sz}" font-weight="${first || big ? 700 : 650}" fill="${first ? '#3a4048' : cl}" stroke="#fff" stroke-width="${first ? 4.2 : 3.6}" stroke-linejoin="round" paint-order="stroke">${text}</text>`; continue; }
  svg += `<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-family="-apple-system, 'Noto Sans KR', sans-serif" font-size="${size}" font-weight="${wt}" fill="${col}" stroke="${C.land}" stroke-width="3" paint-order="stroke" letter-spacing=".02em">${text}</text>`;
}
// icons: up to 7, landmarks first, spread out, clear of the names; a train badge by the main station
function prettyMarks(labels) {
  let o = ''; const taken = labels.map(([la, lo, n, sz]) => { const [x, y] = P(la, lo), w = n.length * 7.6 + 8; return [x - w / 2, y - 16, x + w / 2, y + 5]; });
  const free = (x, y, r) => x > 14 && x < W - 14 && y > 16 && y < 480 && !taken.some(b => x + r > b[0] && x - r < b[2] && y + r > b[1] && y - r < b[3]);
  const st = d.elements.find(e => e.type === 'node' && e.tags && e.tags.railway === 'station' && e.tags.station !== 'subway' && (() => { const [x, y] = P(e.lat, e.lon); return x > 20 && x < W - 20 && y > 30 && y < 470; })());
  if (st) { let [x, y] = P(st.lat, st.lon); y -= 22; if (free(x, y, 9)) { taken.push([x - 12, y - 12, x + 12, y + 12]);
    o += `<g transform="translate(${f(x)} ${f(y)})"><rect x="-9" y="-9" width="18" height="18" rx="5" fill="#5f6670"/><g fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" transform="translate(-6 -6) scale(.5)">${glyph('train')}</g></g>`; } }
  const used = new Map(), pool = POIS.filter(p => p.ic !== 'train').sort((a, b) => b.pr - a.pr);
  let n = 0;
  for (const p of pool) { const [x, y] = p.at; if (!free(x, y, 11) || (used.get(p.ic) || 0) >= 2) continue;
    if (taken.some(b => Math.hypot((b[0] + b[2]) / 2 - x, (b[1] + b[3]) / 2 - y) < 46 && b[2] - b[0] < 30)) continue;
    taken.push([x - 11, y - 11, x + 11, y + 11]); used.set(p.ic, (used.get(p.ic) || 0) + 1);
    o += `<g transform="translate(${f(x)} ${f(y)})"><circle r="9.5" fill="#fff" stroke="#d8d4cc" stroke-width="1"/><g fill="none" stroke="#8a7f73" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" transform="translate(-6.6 -6.6) scale(.55)">${glyph(p.ic)}</g></g>`;
    if (++n >= 7) break; }
  return o;
}
// gmap names: streets along their line, places with a coloured icon and the name in the same colour, quarters in grey
function gmapMarks(labels) {
  let o = '', defs = '', id = 0; const taken = [];
  const hit = b => taken.some(c => b[0] < c[2] && b[2] > c[0] && b[1] < c[3] && b[3] > c[1]);
  const txt = (x, y, t, sz, wt, col, anchor = 'middle') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-family="-apple-system, 'Noto Sans KR', 'Hiragino Sans', sans-serif" font-size="${sz}" font-weight="${wt}" fill="${col}" stroke="#fff" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${t}</text>`;
  // quarters first (they own the middle), then places, then streets in what is left
  let quarters = 0;
  for (const [la, lo, n, sz, wt, col] of labels) { if (n !== process.env.MAIN && col !== '#5a84ad' && ++quarters > 3) continue;   // the big name + three quarters at most
    let [x, y] = P(la, lo); const big = n === process.env.MAIN, z = big ? 15 : col === '#5a84ad' ? 11.5 : 12, w = n.length * z * 0.6;
    if (big) x = Math.max(w / 2 + 12, Math.min(W - w / 2 - 12, x));   // the big name never runs off the screen
    const b = [x - w / 2 - 4, y - z - 2, x + w / 2 + 4, y + 4]; if (hit(b)) continue; taken.push(b);
    if ((process.env.GPAL ?? 'ACa') && !big && col !== '#5a84ad') { o += `<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-family="-apple-system, 'Noto Sans KR', sans-serif" font-size="10" font-weight="600" letter-spacing=".12em" fill="#6f6f6f" stroke="#fff" stroke-width="2.6" paint-order="stroke">${n.toUpperCase()}</text>`; continue; }
    o += txt(x, y, n, z, big ? 700 : 600, col === '#5a84ad' ? (process.env.GPAL === 'B' ? '#3f5a63' : '#4a7fb5') : big ? '#3c4043' : '#5f6368'); }
  // every icon has its family's colour (no purple; faith a warm grey-brown, sights teal, water a water blue, getting about navy)
  const CAT = { food: '#e0782a', cafe: '#e0782a', bar: '#e0782a', beer: '#e0782a', bakery: '#e0782a', wine: '#e0782a', shop: '#4a7cd6', mall: '#4a7cd6', market: '#4a7cd6', fuel: '#4a7cd6', parking: '#4a7cd6', bank: '#4a7cd6', post: '#4a7cd6', hotel: '#d4568c', school: '#9a7449', university: '#9a7449', library: '#9a7449', hospital: '#d14a3e', pharmacy: '#d14a3e', police: '#6f7783', fire: '#d14a3e', townhall: '#6f7783', park: '#3d8b3d', garden: '#3d8b3d', forest: '#3d8b3d', playground: '#3d8b3d', zoo: '#3d8b3d', golf: '#3d8b3d', camp: '#3d8b3d', mountain: '#3d8b3d', cemetery: '#5f8a6a', lake: '#2f8fb6', beach: '#2f8fb6', fountain: '#2f8fb6', spring: '#2f8fb6', swim: '#2f8fb6', aquarium: '#2f8fb6', harbour: '#2f8fb6', lighthouse: '#2f8fb6', metro: '#3a64b0', train: '#3a64b0', tram: '#3a64b0', bus: '#3a64b0', ferry: '#3a64b0', boat: '#3a64b0', airport: '#3a64b0', cable: '#3a64b0', bike: '#3a64b0', bridge: '#3a64b0', museum: '#1d8f9f', gallery: '#1d8f9f', theatre: '#1d8f9f', cinema: '#1d8f9f', music: '#1d8f9f', castle: '#1d8f9f', palace: '#1d8f9f', monument: '#1d8f9f', statue: '#1d8f9f', ruin: '#1d8f9f', view: '#1d8f9f', tower: '#1d8f9f', clock: '#1d8f9f', windmill: '#1d8f9f', observatory: '#1d8f9f', wheel: '#1d8f9f', church: '#8a7465', cathedral: '#8a7465', chapel: '#8a7465', mosque: '#8a7465', synagogue: '#8a7465', shrine: '#8a7465', temple: '#8a7465', pagoda: '#8a7465', stadium: '#2f9a78', sports: '#2f9a78', ski: '#2f9a78', info: '#6f7783' };
  const seen = new Set(), placed = []; let n = 0;
  for (const p of POIS.filter(q => q.name && q.name.length <= 22).sort((a, b) => b.pr - a.pr)) {
    if (seen.has(p.name)) continue; const [x, y] = p.at, col = CAT[p.ic] || '#6f6a64', w = p.name.length * 10.5 * 0.58 + 16;
    if (x < 10 || x + w > W - 4 || y < 14 || y > 482) continue;
    const b = [x - 8, y - 9, x + w, y + 8]; if (hit(b)) continue;
    if (placed.some(([u, v]) => Math.hypot(u - x, v - y) < 120)) continue;   // places spread out, not stacked
    taken.push(b); seen.add(p.name); placed.push([x, y]);
    o += `<g transform="translate(${f(x)} ${f(y)})"><circle r="7.5" fill="${col}"/><g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(-5 -5) scale(.42)">${glyph(p.ic)}</g></g>` + txt(x + 11, y + 3.6, p.name, 10.5, 600, col, 'start');
    if (++n >= 4) break; }
  // a few more places as small icons only (no name), the old kit's white badge: each one goes where the screen is emptiest —
  // the candidate furthest from every name and icon already there, and never nearer than 70 px to one
  if (process.env.ICONS === '1') {   // small nameless icons: off by default (they made the clean map busy); the named dots carry every family's colour instead
    const gap = ([x, y]) => Math.min(...taken.map(([a, b2, c, d]) => Math.hypot(Math.max(a - x, 0, x - c), Math.max(b2 - y, 0, y - d))), ...placed.map(([u, v]) => Math.hypot(u - x, v - y)));
    let pool = POIS.filter(q => !seen.has(q.name) && q.at[0] > 16 && q.at[0] < W - 16 && q.at[1] > 22 && q.at[1] < 474);
    for (let m = 0; m < 3 && pool.length; m++) {
      let best = null, bd = 70;
      const icons = placed.slice(-m || placed.length).slice(0, m);   // the small icons placed so far keep 160 px between them
      // by importance, not by distance: pushing each to the emptiest spot lined them up round the edge like a drawn shape.
      // clear of the screen's edge too, and the whole set of markers stays at seven
      if (placed.length >= 7) break;
      for (const q of pool.slice().sort((a, b) => b.pr - a.pr)) { const [qx, qy] = q.at; if (qx < 50 || qx > W - 50 || qy < 50) continue;
        if (gap(q.at) >= 70 && (!m || placed.slice(-m).every(([u, v]) => Math.hypot(u - qx, v - qy) >= 160))) { best = q; break; } }
      if (!best) break;
      const [x, y] = best.at; taken.push([x - 11, y - 11, x + 11, y + 11]); placed.push([x, y]); pool = pool.filter(q => q.ic !== best.ic || Math.hypot(q.at[0] - x, q.at[1] - y) > 150);
      // ICONSTYLE: white (old kit badge) · dot (the named places' coloured dot, smaller and faded) · line (just the glyph, faint, no badge)
      const ist = process.env.ICONSTYLE || 'white', col = CAT[best.ic] || '#6f6a64';
      o += ist === 'full' ? `<g transform="translate(${f(x)} ${f(y)})"><circle r="7.5" fill="${col}"/><g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(-5 -5) scale(.42)">${glyph(best.ic)}</g></g>`   // the named places' dot exactly, without the name
        : ist === 'dot' ? `<g transform="translate(${f(x)} ${f(y)})" opacity=".55"><circle r="6.5" fill="${col}"/><g fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" transform="translate(-4.3 -4.3) scale(.36)">${glyph(best.ic)}</g></g>`
        : ist === 'line' ? `<g fill="none" stroke="${col}" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(${f(x - 8.4)} ${f(y - 8.4)}) scale(.7)">${glyph(best.ic)}</g>`
        : `<g transform="translate(${f(x)} ${f(y)})"><circle r="10.5" fill="#fff" stroke="#e3ddd2" stroke-width="1"/><g fill="none" stroke="#7d7266" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" transform="translate(-7.2 -7.2) scale(.6)">${glyph(best.ic)}</g></g>`; } }
  // streets: the longest pieces, upright text along the line
  const sn = new Set();
  for (const s2 of STREETS.map(q => ({ ...q, len: q.ps.reduce((a, pt, i) => i ? a + Math.hypot(pt[0] - q.ps[i - 1][0], pt[1] - q.ps[i - 1][1]) : 0, 0) })).sort((a, b) => b.rank - a.rank || b.len - a.len)) {
    if (sn.has(s2.name) || s2.len < s2.name.length * 6.2 + 30) continue;
    let ps = s2.ps.filter(([x, y]) => x > -20 && x < W + 20 && y > -20 && y < 490); if (ps.length < 2) continue;
    if (ps[0][0] > ps.at(-1)[0]) ps = ps.slice().reverse();
    const mid = ps[ps.length >> 1], w = s2.name.length * 5.6; const b = [mid[0] - w / 2 - 2, mid[1] - 8, mid[0] + w / 2 + 2, mid[1] + 8];
    const run = ps.filter(([x, y]) => Math.hypot(x - mid[0], y - mid[1]) < w / 2 + 6).map(([x, y]) => [x - 6, y - 7, x + 6, y + 7]);   // the text follows the street: every bit of it must be clear
    if (hit(b) || run.some(hit) || mid[0] < 30 || mid[0] > W - 30 || mid[1] < 20 || mid[1] > 480) continue; taken.push(b, ...run); sn.add(s2.name);
    defs += `<path id="sp${id}" d="${line(ps)}"/>`;
    o += `<text font-family="-apple-system, 'Noto Sans KR', sans-serif" font-size="9.5" font-weight="500" fill="#7a7770" stroke="#fff" stroke-width="2.6" paint-order="stroke" dy="3.2"><textPath href="#sp${id++}" startOffset="50%" text-anchor="middle">${s2.name}</textPath></text>`;
    if (sn.size >= 8) break; }
  return `<defs>${defs}</defs>` + o;
}
// the data's licence (ODbL): the credit always shows in the map's corner, above the sheet (which starts at 500), and links to the copyright page
svg += `<a href="https://www.openstreetmap.org/copyright" target="_blank"><text x="${W - 8}" y="493" text-anchor="end" font-family="-apple-system, 'Noto Sans KR', sans-serif" font-size="8.5" font-weight="500" fill="#6f6a64" stroke="#fff" stroke-width="2.4" stroke-opacity=".8" paint-order="stroke">© OpenStreetMap${process.env.ATTR === "short" ? "" : " contributors"}</text></a>`;
const css = `*{box-sizing:border-box;margin:0}body{background:#d9dce2;font-family:-apple-system,'Noto Sans KR',sans-serif;padding:24px;width:458px}
.ph{width:390px;height:844px;border-radius:44px;border:9px solid #111;overflow:hidden;position:relative;background:#f4f5f7;box-sizing:content-box}.ph svg{display:block}
.sh{position:absolute;left:0;right:0;top:500px;bottom:0;background:#f4f5f7;border-radius:22px 22px 0 0;box-shadow:0 -6px 24px rgba(22,27,34,.14);padding:12px 18px}.gr{width:36px;height:5px;border-radius:3px;background:#d4d7dc;margin:0 auto 14px}
.sh h2{font-size:24px;font-weight:700}.sh p{color:#7b818c;font-size:13px;margin-top:4px}.card{margin-top:14px;background:#fff;border-radius:18px;height:120px;box-shadow:0 1px 2px rgba(22,27,34,.04),0 8px 24px rgba(22,27,34,.05)}`;
const title = process.env.TITLE || '', sub = process.env.SUB || '';
fs.writeFileSync(out, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="ph"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${svg}</svg><div class="sh"><div class="gr"></div><h2>${title}</h2><p>${sub}</p><div class="card"></div></div></div></body></html>`);
console.log('ok', (svg.length / 1024).toFixed(0) + 'KB svg');
