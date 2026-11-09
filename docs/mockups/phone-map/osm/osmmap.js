// 다녀간 곳 › 실제 지도 시안: OSM(Overpass `out geom`) 데이터를 지금 지도 색으로 그려요.
// node docs/mockups/phone-map/osm/osmmap.js <data.json> <out.html> <lat> <lon> <metersAcross> [labels.json]
const fs = require('fs');
const [, , src, out, lat0s, lon0s, spanS, labelsSrc] = process.argv;
const lat0 = +lat0s, lon0 = +lon0s, span = +spanS;
const C = { land: '#f3f0ea', built: '#ebe7df', park: '#d4e8c9', forest: '#c3dcb5', water: '#b6d4ef', road: '#ffffff', edge: '#dad4c9', major: '#fde7a3', majorEdge: '#e3c77c',
  rail: '#a9a49b', label: '#6f7681', plaza: '#efe6d2', bld: '#e0dbd0', foot: '#e6e1d7' };
const W = 390, H = 560, k = W / span;                       // px per meter
const mx = 111320 * Math.cos(lat0 * Math.PI / 180), my = 110540;
const P = (la, lo) => [W / 2 + (lo - lon0) * mx * k, H / 2 - (la - lat0) * my * k];
const f = n => (Math.round(n * 10) / 10).toString();
const d = JSON.parse(fs.readFileSync(src, 'utf8'));
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
const L = { built: '', park: '', forest: '', water: '', plaza: '', bld: '', foot: '', minor: '', mid: '', major: '', rail: '', tram: '' };
const BUILT = /residential|commercial|retail|industrial|railway|construction|brownfield|education|emergency/;
const GREEN = /grass|village_green|flowerbed|meadow|allotments|cemetery|greenhouse/;
for (const e of d.elements) {
  const t = e.tags || {}, closed = e.geometry && e.geometry.length > 2 && e.geometry[0].lat === e.geometry.at(-1).lat && e.geometry[0].lon === e.geometry.at(-1).lon;
  if (t.natural === 'water' || (t.waterway && /riverbank|dock/.test(t.waterway))) { L.water += area(e); continue; }
  if (t.building) { if (e.type === 'way' && closed) L.bld += area(e); continue; }
  if (t.leisure && /park|garden/.test(t.leisure)) { L.park += area(e); continue; }
  if (t.landuse === 'forest' || t.natural === 'scrub') { L.forest += area(e); continue; }
  if (t.landuse && GREEN.test(t.landuse)) { L.park += area(e); continue; }
  if (t.landuse && BUILT.test(t.landuse)) { L.built += area(e); continue; }
  if (e.type !== 'way' || !e.geometry) continue;
  if (t.tunnel && t.tunnel !== 'no') continue;
  const h = t.highway, rw = t.railway;
  if (h === 'pedestrian' && closed && t.area === 'yes') { L.plaza += area(e); continue; }
  const dl = line(pts(e.geometry));
  if (h) {
    if (/^(primary|trunk|motorway)(_link)?$/.test(h)) L.major += dl;
    else if (/^(secondary|tertiary)(_link)?$/.test(h)) L.mid += dl;
    else if (/^(residential|unclassified|living_street|service|pedestrian|busway)$/.test(h)) L.minor += dl;
    else if (/^(footway|path|cycleway|track)$/.test(h)) L.foot += dl;
  } else if (rw === 'rail' || rw === 'light_rail') L.rail += dl;
  else if (rw === 'tram') L.tram += dl;
}
const st = (dd, col, w, extra = '') => dd ? `<path d="${dd}" fill="none" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>` : '';
const fill = (dd, col) => dd ? `<path d="${dd}" fill="${col}" fill-rule="evenodd"/>` : '';
const mpx = m => Math.max(0.6, m * k);                       // real width in meters → px, with a floor
let svg = `<rect width="${W}" height="${H}" fill="${C.land}"/>`
  + fill(L.built, C.built) + fill(L.park, C.park) + fill(L.forest, C.forest) + fill(L.plaza, C.plaza) + fill(L.water, C.water)
  + fill(L.bld, C.bld)
  + st(L.foot, C.foot, mpx(3))
  + st(L.minor, C.edge, mpx(9) + 1.6) + st(L.mid, C.edge, mpx(12) + 1.8)
  + st(L.minor, C.road, mpx(9)) + st(L.mid, C.road, mpx(12))
  + st(L.rail, C.rail, 2.4) + st(L.rail, C.land, 1.1, ' stroke-dasharray="4 4"') + st(L.tram, C.rail, 0.9)
  + st(L.major, C.majorEdge, mpx(16) + 2) + st(L.major, C.major, mpx(16));
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
  for (const [pr, la, lo, n, sz, wt, col] of cand) {
    if (seen.has(n)) continue;
    const [x, y] = P(la, lo), w = n.length * sz * 0.6 + 6, h = sz + 6;
    if (x - w / 2 < 6 || x + w / 2 > W - 6 || y - h < 14 || y > 486) continue;
    const b = [x - w / 2 - 8, y - h - 6, x + w / 2 + 8, y + 6];
    if (boxes.some(c => b[0] < c[2] && b[2] > c[0] && b[1] < c[3] && b[3] > c[1])) continue;
    boxes.push(b); seen.add(n); outL.push([la, lo, n, sz, wt, col]);
    if (outL.length >= 8) break;
  }
  return outL;
}
const labels = labelsSrc ? JSON.parse(fs.readFileSync(labelsSrc, 'utf8')) : autoLabels();
for (const [la, lo, text, size = 11, wt = 600, col = C.label] of labels) {
  const [x, y] = P(la, lo);
  svg += `<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-family="-apple-system, 'Noto Sans KR', sans-serif" font-size="${size}" font-weight="${wt}" fill="${col}" stroke="${C.land}" stroke-width="3" paint-order="stroke" letter-spacing=".02em">${text}</text>`;
}
const css = `*{box-sizing:border-box;margin:0}body{background:#d9dce2;font-family:-apple-system,'Noto Sans KR',sans-serif;padding:24px;width:458px}
.ph{width:390px;height:844px;border-radius:44px;border:9px solid #111;overflow:hidden;position:relative;background:#f4f5f7;box-sizing:content-box}.ph svg{display:block}
.sh{position:absolute;left:0;right:0;top:500px;bottom:0;background:#f4f5f7;border-radius:22px 22px 0 0;box-shadow:0 -6px 24px rgba(22,27,34,.14);padding:12px 18px}.gr{width:36px;height:5px;border-radius:3px;background:#d4d7dc;margin:0 auto 14px}
.sh h2{font-size:24px;font-weight:700}.sh p{color:#7b818c;font-size:13px;margin-top:4px}.card{margin-top:14px;background:#fff;border-radius:18px;height:120px;box-shadow:0 1px 2px rgba(22,27,34,.04),0 8px 24px rgba(22,27,34,.05)}`;
const title = process.env.TITLE || '', sub = process.env.SUB || '';
fs.writeFileSync(out, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="ph"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${svg}</svg><div class="sh"><div class="gr"></div><h2>${title}</h2><p>${sub}</p><div class="card"></div></div></div></body></html>`);
console.log('ok', (svg.length / 1024).toFixed(0) + 'KB svg');
