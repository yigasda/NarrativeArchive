// 다녀간 곳 › 실제 지도 시안: OSM(Overpass `out geom`) 데이터를 지금 지도 색으로 그려요.
// node docs/mockups/phone-map/osm/osmmap.js <data.json> <out.html> <lat> <lon> <metersAcross> [labels.json]
const fs = require('fs');
const [, , src, out, lat0s, lon0s, spanS, labelsSrc] = process.argv;
const lat0 = +lat0s, lon0 = +lon0s, FX = process.env.FX ?? 'BCD';   // FX: A 큰 건물 색 · B 땅 쓰임 색 · C 동네마다 축척 · D 건물 그림자
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
    label: '#5f646c', foot: '#e4e4e0', resi: '#f1f1ee', shop: '#f5e6dc', works: '#e6e6e3', railyard: '#e7e7e4', school: '#f3ebcc', plaza: '#ececea', mark: '#d2d2cc' },
  paper: { land: '#f2ead9', built: '#ece2cf', bld: '#ddcfb5', shadow: '#c2b296', edge: '#d6c9b0', park: '#cddcb0', forest: '#b9cd98', water: '#a9c7d9', major: '#f4cf7f', majorEdge: '#d4ab5a',
    label: '#6a5f50', foot: '#e3d8c3', resi: '#efe6d4', shop: '#f0dcc4', works: '#e2dccf', railyard: '#e3dccd', school: '#efe1b8', plaza: '#ebdfc8', mark: '#d2c09f' },
  terra: { land: '#f1ebe3', built: '#ebe2d8', bld: '#dcc4b2', shadow: '#bea08a', edge: '#d5c7b9', park: '#c8ddb4', forest: '#b3cf9c', water: '#a5c8e6', major: '#f8d58a', majorEdge: '#d9b064',
    label: '#66594f', foot: '#e2d7cc', resi: '#eee6dc', shop: '#f0dccd', works: '#e3ded8', railyard: '#e4ded7', school: '#efe2c0', plaza: '#ebe0d3', mark: '#d0b19b' } };
// ROAD=1|1.5|2: softer yellow for the big roads
if (PALS.neutral && process.env.ROAD) Object.assign(PALS.neutral, process.env.ROAD === '2' ? { major: '#fcedc6', majorEdge: '#ead8a8' } : process.env.ROAD === '1.5' ? { major: '#fce8b4', majorEdge: '#e9d298' } : { major: '#fce3a2', majorEdge: '#e9cd88' });
if (PALS[process.env.PAL ?? 'neutral']) Object.assign(C, PALS[process.env.PAL ?? 'neutral']);   // 기본: 2 중립 밝은 톤 + B·C·D
const d = JSON.parse(require('fs').readFileSync(src, 'utf8'));
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
const L = { resi: '', shop: '', works: '', railyard: '', school: '', mark: '', markStation: '', shadow: {}, built: '', park: '', forest: '', water: '', plaza: '', bld: '', foot: '', minor: '', mid: '', major: '', rail: '', tram: '' };
const BUILT = /residential|commercial|retail|industrial|railway|construction|brownfield|education|emergency/;
const GREEN = /grass|village_green|flowerbed|meadow|allotments|cemetery|greenhouse/;
for (const e of d.elements) {
  const t = e.tags || {}, closed = e.geometry && e.geometry.length > 2 && e.geometry[0].lat === e.geometry.at(-1).lat && e.geometry[0].lon === e.geometry.at(-1).lon;
  if (t.natural === 'water' || (t.waterway && /riverbank|dock/.test(t.waterway))) { L.water += area(e); continue; }
  if (t.building) {
    if (e.type !== 'way' || !closed) continue;
    const a = area(e);
    // A: churches, stations, castles, halls and anything with its own wiki page stand out a little
    const big = /cathedral|church|chapel|castle|palace|train_station|government|museum|civic|public|university|stadium|transportation/.test(t.building) || t.historic || t.tourism || t.wikidata || t.amenity === 'place_of_worship';
    if (FX.includes('A') && big) { if (/train_station|transportation/.test(t.building) || t.railway) L.markStation += a; else L.mark += a; }
    else L.bld += a;
    // D: a soft shadow down-right, longer for taller houses
    if (FX.includes('D')) { const lv = parseFloat(t['building:levels']) || (t.height ? parseFloat(t.height) / 3 : 0) || 3, off = Math.min(7, 0.5 + lv * 3 * k * 0.3), b = (Math.round(off * 2) / 2).toFixed(1); L.shadow[b] = (L.shadow[b] || '') + a; }
    continue;
  }
  if (t.leisure && /park|garden/.test(t.leisure)) { L.park += area(e); continue; }
  if (t.landuse === 'forest' || t.natural === 'scrub') { L.forest += area(e); continue; }
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
    else if (/^(residential|unclassified|living_street|service|pedestrian|busway)$/.test(h)) L.minor += dl;
    else if (/^(footway|path|cycleway|track)$/.test(h)) L.foot += dl;
  } else if (rw === 'rail' || rw === 'light_rail') L.rail += dl;
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
  + fill(L.built, C.built) + fill(L.resi, C.resi) + fill(L.shop, C.shop) + fill(L.works, C.works) + fill(L.railyard, C.railyard) + fill(L.school, C.school) + fill(L.park, C.park) + fill(L.forest, C.forest) + fill(L.plaza, C.plaza) + fill(L.water, C.water)
  + terrain()
  + Object.entries(L.shadow).map(([o, dd]) => `<path d="${dd}" fill="${C.shadow}" opacity=".75" transform="translate(${o} ${(o * 1.3).toFixed(1)})"/>`).join('')
  + fill(L.bld, C.bld) + fill(L.mark, C.mark) + fill(L.markStation, C.markStation)
  + (L.park + L.forest ? `<defs><clipPath id="fg"><path d="${L.park + L.forest}"/></clipPath><mask id="fo"><rect x="-50" y="-50" width="${W + 100}" height="${H + 100}" fill="#fff"/><path d="${L.park + L.forest}" fill="#000"/></mask></defs>`
      + `<g mask="url(#fo)">${st(L.foot, C.foot, mpx(3))}</g><g clip-path="url(#fg)" opacity=".35">${st(L.foot, C.foot, mpx(2.4))}</g>` : st(L.foot, C.foot, mpx(3)))
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
