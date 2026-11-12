// 타일 지도 확인용 가짜 OpenFreeMap(클라우드 세션은 타일 서버가 막혀 있어요): 받아 둔 OSM json(osm-data 브랜치의 zip) → OpenMapTiles
// 모양의 벡터 타일(water, waterway, landcover, landuse, transportation(+_name), poi, place)과 시험 글꼴. route(page, [json…])가
// Playwright 페이지의 tiles.openfreemap.org 요청에 답해요. 모양 확인용이라 실제 타일과 똑같지 않아요(장소 · 동네 이름이 적어요).
//   npm i --prefix /tmp/tiles geojson-vt@3.2.1 vt-pbf@3.1.3 fontnik@0.7.7
//   NODE_PATH=/tmp/tiles/node_modules:$NODE_PATH node tools/dev/mkglyphs.cjs /tmp/tiles/glyphs   (한 번)
//   TILE_GLYPHS=/tmp/tiles/glyphs NODE_PATH=/tmp/tiles/node_modules:$NODE_PATH node 내 스크립트(route를 부르는 것)
const geojsonvt = require('geojson-vt'), vtpbf = require('vt-pbf'), fs = require('fs'), path = require('path');
function feats(file) {
    const els = [];
    for (const f of [file, file.replace(/\.json$/, '-cover.json')]) if (fs.existsSync(f)) els.push(...JSON.parse(fs.readFileSync(f, 'utf8')).elements);
    const L = { water: [], waterway: [], landcover: [], landuse: [], transportation: [], transportation_name: [], poi: [], place: [] };
    const ll = g => g.map(p => [p.lon, p.lat]), closed = g => g.length > 3 && g[0].lat === g.at(-1).lat && g[0].lon === g.at(-1).lon;
    const poly = (g, props) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ll(g)] }, properties: props });
    const line = (g, props) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: ll(g) }, properties: props });
    const mid = g => { let x = 0, y = 0; for (const p of g) { x += p.lon; y += p.lat; } return [x / g.length, y / g.length]; };
    for (const e of els) {
        const t = e.tags || {}, rings = e.type === 'relation' ? (e.members || []).filter(m => m.geometry && m.role !== 'inner' && closed(m.geometry)).map(m => m.geometry) : e.geometry ? [e.geometry] : [];
        for (const g of rings) {
            const c = closed(g);
            if (c && (t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'basin' || t.landuse === 'reservoir')) L.water.push(poly(g, { class: t.water === 'river' || t.waterway === 'riverbank' ? 'river' : 'lake' }));
            if (c && t.leisure === 'swimming_pool') L.water.push(poly(g, { class: 'swimming_pool' }));
            if (!c && /^(river|canal)$/.test(t.waterway || '')) L.waterway.push(line(g, { class: t.waterway, name: t.name }));
            if (c && (t.landuse === 'forest' || t.natural === 'wood')) L.landcover.push(poly(g, { class: 'wood' }));
            if (c && (t.leisure === 'park' || t.leisure === 'garden' || /^(grass|meadow|recreation_ground)$/.test(t.landuse || ''))) L.landcover.push(poly(g, { class: 'grass', subclass: t.leisure || t.landuse }));
            if (c && /^(residential|commercial|retail|industrial|railway|cemetery)$/.test(t.landuse || '')) L.landuse.push(poly(g, { class: t.landuse }));
            if (c && /^(school|university|college)$/.test(t.amenity || '')) L.landuse.push(poly(g, { class: t.amenity }));
            if (t.highway && !c) {
                const h = t.highway, cls = /^(motorway|trunk|primary|secondary|tertiary)$/.test(h.replace('_link', '')) ? h.replace('_link', '') : /^(residential|unclassified|living_street)$/.test(h) ? 'minor' : h === 'service' ? 'service' : 'path';
                const props = { class: cls, subclass: cls === 'path' ? h : undefined, brunnel: t.bridge ? 'bridge' : t.tunnel ? 'tunnel' : undefined };
                L.transportation.push(line(g, props)); if (t.name) L.transportation_name.push(line(g, { class: cls, name: t.name }));
            }
            if (t.railway === 'rail' && !c) L.transportation.push(line(g, { class: 'rail', service: t.service, brunnel: t.tunnel ? 'tunnel' : undefined }));
            const pc = t.amenity || t.tourism || t.historic || t.leisure;
            if (t.name && pc && !/^(parking|bench|waste_basket)$/.test(pc)) {
                const cls = t.tourism === 'attraction' ? 'attraction' : t.amenity === 'place_of_worship' ? 'place_of_worship' : t.tourism === 'museum' ? 'museum' : pc;
                L.poi.push({ type: 'Feature', geometry: { type: 'Point', coordinates: mid(g) }, properties: { name: t.name, class: cls, subclass: pc, rank: t.wikidata ? 1 : 20 } });
            }
            if (t.place && /^(suburb|quarter|neighbourhood)$/.test(t.place)) L.place.push({ type: 'Feature', geometry: { type: 'Point', coordinates: mid(g) }, properties: { class: t.place, name: t.name } });
        }
    }
    return L;
}
function server(files) {
    const L = { water: [], waterway: [], landcover: [], landuse: [], transportation: [], transportation_name: [], poi: [], place: [] };
    for (const f of files) { const x = feats(f); for (const k in L) L[k].push(...x[k]); }
    const idx = Object.fromEntries(Object.entries(L).map(([k, fs_]) => [k, geojsonvt({ type: 'FeatureCollection', features: fs_ }, { maxZoom: 14, indexMaxZoom: 6, tolerance: 2, extent: 4096, buffer: 64 })]));
    return (z, x, y) => { const layers = {}; for (const k in idx) { const t = idx[k].getTile(z, x, y); if (t) layers[k] = t; } return Buffer.from(vtpbf.fromGeojsonVt(layers, { version: 2 })); };
}
async function route(page, files) {
    const tile = server(files), G = process.env.TILE_GLYPHS || path.join(__dirname, 'glyphs');
    await page.route('https://tiles.openfreemap.org/**', r => {
        const u = new URL(r.request().url());
        if (u.pathname === '/planet') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ tilejson: '3.0.0', tiles: ['https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14, vector_layers: ['water', 'waterway', 'landcover', 'landuse', 'transportation', 'transportation_name', 'poi', 'place'].map(id => ({ id, fields: {} })) }) });
        let m = /\/planet\/(\d+)\/(\d+)\/(\d+)\.pbf$/.exec(u.pathname);
        if (m) return r.fulfill({ contentType: 'application/x-protobuf', body: tile(+m[1], +m[2], +m[3]) });
        m = /\/fonts\/([^/]+)\/(\d+-\d+)\.pbf$/.exec(decodeURIComponent(u.pathname));
        if (m) { const f = path.join(G, m[1].split(',')[0], m[2] + '.pbf'); return fs.existsSync(f) ? r.fulfill({ contentType: 'application/x-protobuf', body: fs.readFileSync(f) }) : r.fulfill({ status: 404, body: '' }); }
        return r.fulfill({ status: 404, body: '' });
    });
}
module.exports = { route };
