// 다녀간 곳 › 실제 지도 시안: OSM(Overpass `out geom`) 데이터를 지금 지도 색으로 그려요.
// node docs/mockups/phone-map/osm/osmmap.js <data.json> <out.html> <lat> <lon> <metersAcross> [labels.json]
const fs = require('fs');
const [, , src, out, lat0s, lon0s, spanS, labelsSrc] = process.argv;
const lat0 = +lat0s, lon0 = +lon0s, FX = process.env.FX ?? (process.env.STYLE === 'pretty' ? 'BC' : 'BCD');   // FX: A 큰 건물 색 · B 땅 쓰임 색 · C 동네마다 축척 · D 건물 그림자
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
const { ICON, glyph, pick } = require('./icons.js');
const pxArea = ps => Math.abs(ps.reduce((s, p, i) => { const q = ps[(i + 1) % ps.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const centre = ps => { const n = ps.length; return [ps.reduce((s, p) => s + p[0], 0) / n, ps.reduce((s, p) => s + p[1], 0) / n]; };
const POIS = [], GREENS = [];
const L = { station: '',  shop: '', works: '', railyard: '', school: '', mark: '', markStation: '', shadow: {}, built: '', park: '', forest: '', water: '', plaza: '', bld: '', foot: '', minor: '', mid: '', major: '', rail: '', tram: '' };
const BUILT = /residential|commercial|retail|industrial|railway|construction|brownfield|education|emergency/;
const GREEN = /grass|village_green|flowerbed|meadow|allotments|cemetery|greenhouse/;
for (const e of d.elements) {
  const t = e.tags || {}, closed = e.geometry && e.geometry.length > 2 && e.geometry[0].lat === e.geometry.at(-1).lat && e.geometry[0].lon === e.geometry.at(-1).lon;
  if (t.natural === 'water' || (t.waterway && /riverbank|dock/.test(t.waterway))) { L.water += area(e); continue; }
  if (t.building) {
    if (e.type !== 'way' || !closed) continue;
    const a = area(e);
    if (PRETTY) {
      const ps = pts(e.geometry), px = pxArea(ps);
      { const ic = pick(t); if (ic && (t.name || t.wikidata)) POIS.push({ ic, at: centre(ps), pr: (t.wikidata ? 2 : 0) + (t.name ? 1 : 0) + Math.min(2, px / 400), name: t.name }); }
      if (t.building === 'train_station' || t.railway === 'station') { L.station += a; continue; }
      if (px < 40 * k * k * 2.2) continue;          // the tiny sheds and kiosks go
    }
    // A: churches, stations, castles, halls and anything with its own wiki page stand out a little
    const big = /cathedral|church|chapel|castle|palace|train_station|government|museum|civic|public|university|stadium|transportation/.test(t.building) || t.historic || t.tourism || t.wikidata || t.amenity === 'place_of_worship';
    if (FX.includes('A') && big) { if (/train_station|transportation/.test(t.building) || t.railway) L.markStation += a; else L.mark += a; }
    else L.bld += a;
    // D: a soft shadow down-right, longer for taller houses
    if (FX.includes('D')) { const lv = parseFloat(t['building:levels']) || (t.height ? parseFloat(t.height) / 3 : 0) || 3, off = Math.min(7, 0.5 + lv * 3 * k * 0.3), b = (Math.round(off * 2) / 2).toFixed(1); L.shadow[b] = (L.shadow[b] || '') + a; }
    continue;
  }
  if (PRETTY && e.geometry) { const ic = pick(t); if (ic && t.name && !t.building) { const ps = pts(e.geometry); POIS.push({ ic, at: centre(ps), pr: (t.wikidata ? 2 : 0) + 1 + Math.min(2, pxArea(ps) / 3000), name: t.name }); } }
  if (PRETTY && e.type === 'node') { const ic = pick(t); if (ic && (t.name || t.wikidata)) POIS.push({ ic, at: P(e.lat, e.lon), pr: (t.wikidata ? 2.5 : 0) + 1, name: t.name }); }
  if (t.leisure && /park|garden/.test(t.leisure)) { L.park += area(e); if (PRETTY && e.type === 'way' && e.geometry) GREENS.push(pts(e.geometry)); continue; }
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
    if (/^(primary|trunk|motorway)(_link)?$/.test(h)) L.major += dl;
    else if (/^(secondary|tertiary)(_link)?$/.test(h)) L.mid += dl;
    else if (/^(residential|unclassified|living_street|pedestrian|busway)$/.test(h) || h === 'service' && (!PRETTY || t.name)) L.minor += dl;
    else if (/^(footway|path|cycleway|track)$/.test(h) && !PRETTY) L.foot += dl;
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
  + ['farm', 'grass', 'allot', 'orchard', 'vine', 'grave', 'scrub', 'wet', 'sand', 'rock'].map(k => fill(LC[k], COVER[k])).join('') + fill(L.park, C.park) + fill(L.forest, C.forest) + fill(L.plaza, C.plaza) + fill(L.water, C.water)
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
const css = `*{box-sizing:border-box;margin:0}body{background:#d9dce2;font-family:-apple-system,'Noto Sans KR',sans-serif;padding:24px;width:458px}
.ph{width:390px;height:844px;border-radius:44px;border:9px solid #111;overflow:hidden;position:relative;background:#f4f5f7;box-sizing:content-box}.ph svg{display:block}
.sh{position:absolute;left:0;right:0;top:500px;bottom:0;background:#f4f5f7;border-radius:22px 22px 0 0;box-shadow:0 -6px 24px rgba(22,27,34,.14);padding:12px 18px}.gr{width:36px;height:5px;border-radius:3px;background:#d4d7dc;margin:0 auto 14px}
.sh h2{font-size:24px;font-weight:700}.sh p{color:#7b818c;font-size:13px;margin-top:4px}.card{margin-top:14px;background:#fff;border-radius:18px;height:120px;box-shadow:0 1px 2px rgba(22,27,34,.04),0 8px 24px rgba(22,27,34,.05)}`;
const title = process.env.TITLE || '', sub = process.env.SUB || '';
fs.writeFileSync(out, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="ph"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${svg}</svg><div class="sh"><div class="gr"></div><h2>${title}</h2><p>${sub}</p><div class="card"></div></div></div></body></html>`);
console.log('ok', (svg.length / 1024).toFixed(0) + 'KB svg');
