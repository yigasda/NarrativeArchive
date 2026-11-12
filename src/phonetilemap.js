// 캐릭터 휴대폰 · 지도 화면(다녀간 곳 · 도시 찾기 · 도시 · 동네 · 빈 화면) › 타일 지도: MapLibre GL + OpenFreeMap 벡터 타일에
// 지도 룰(docs/design/map.md › 타일 지도) 색을 입혀요. 시안 docs/mockups/phone-map/maplibre/index.html.
// - 지도 칸(.mp_bg)에 data-tm(어느 도시 · 동네 · 장소)이 있으면 그 칸에 붙어요. 화면이 다시 그려져도 지도 하나를 옮겨 붙여요(새로 안 만들어요).
// - 그리기 전엔, 그리고 못 그리면(인터넷이 없음 · 좌표 모름) 그 칸의 그림 지도가 그대로 보여요.
// - MapLibre(assets/maplibre, 800KB)와 좌표 표(phonemapspots.js)는 지도 칸이 처음 나올 때 한 번만 불러와요.
import { MAP_ICONS as ICONS } from './phonemapicons.js';
import { PLACE } from './phonemapcity.js';
import { townPlace, hsh, PIN } from './phonemapart.js';

const BASE = new URL('../assets/maplibre/', import.meta.url).href;
const TILES = 'https://tiles.openfreemap.org/planet', GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
let lib = null, spots = null;
export function loadLib() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    return lib || (lib = new Promise((res, rej) => {
        const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = `${BASE}maplibre-gl.css`; document.head.appendChild(css);
        const s = document.createElement('script'); s.src = `${BASE}maplibre-gl.js`;
        s.onload = () => (window.maplibregl ? res(window.maplibregl) : rej(new Error('maplibre')));
        s.onerror = () => { lib = null; rej(new Error('maplibre')); };
        document.head.appendChild(s);
    }));
}
const loadSpots = () => spots || (spots = import('./phonemapspots.js').then(m => m.SPOTS));

// ---- where: a town (and its neighbourhood or a place in it) → a spot of the list [slug, cc, kind, lat, lon, city, names]
const key = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
export function spotIn(S, city, words = []) {
    const i = townPlace(city), ko = i >= 0 ? PLACE[i][0] : String(city || ''), names = i >= 0 ? [ko, ...PLACE[i][1]] : [ko];
    const ks = names.map(key).filter(Boolean), ws = words.map(key).filter(w => w.length >= 2);
    const named = s => s[6].some(n => { const k = key(n); return k.length >= 2 && ws.some(w => w === k || (k.length >= 3 && w.includes(k)) || (w.length >= 3 && k.includes(w))); });
    const mine = S.filter(s => s[5] && ks.includes(key(s[5])));
    return mine.find(named)                                                           // a neighbourhood (or a place) of the town
        || S.find(s => !s[5] && s[6].some(n => ks.includes(key(n))))                  // the town is a spot itself (a village, an island)
        || mine.find(s => s[2].startsWith('도심')) || mine[0]                          // the town's middle
        || (ws.length ? S.find(s => !s[5] && named(s)) : null) || null;                // a place that is a spot of its own
}

// ---- how it looks (the map rule): colours, the special lands, road widths that grow when zoomed in
const C = { land: '#faf6ee', park: '#c3e9cc', forest: '#b1e0bc', vine: '#e6edc3', water: '#a7e4ee', road: '#ffffff', edge: '#e6dece', major: '#fbe9b8', majorEdge: '#ecd59a',
    school: '#f4e7c6', works: '#efece6', shop: '#fbf0d6', rail: '#b8b6b2', railDash: '#f4efe6', hood: '#6f6f6f', street: '#7a7770', waterInk: '#2f8fb6', rock: '#faf6ee', sand: '#faf6ee', ice: '#ffffff' };
const SAND = { shop: '#f2e1c2', land: '#f4e8d2', forest: '#dfe0b8', park: '#e7e3c3', rock: '#ebcfae', sand: '#f1dfbd', school: '#efe0c2', edge: '#e8d8bf' };
const SNOW = { shop: '#f3f0e8', land: '#f6f8fa', forest: '#dce9e3', park: '#e6efea', vine: '#e6efea', rock: '#e9edf1', sand: '#eef1f3', ice: '#ffffff', water: '#bfe2ee', edge: '#dde3e9', school: '#eef1f4', works: '#eceff2', major: '#f6ecd0', majorEdge: '#e2d5b3' };
const DEEP = { water: '#8ec7dd', waterInk: '#2a7598' }, EMERALD = { water: '#7fd9cf', sand: '#f4e3bd', waterInk: '#1f8a80' };
export function palette(kind, lat) {
    const a = Math.abs(lat), p = { ...C, ...(/사막/.test(kind) ? SAND : /눈/.test(kind) ? SNOW : {}) };
    if (/눈/.test(kind) && a >= 66) Object.assign(p, DEEP);
    if (a < 27) Object.assign(p, EMERALD);
    return p;
}
const W = (px, z0) => ['interpolate', ['exponential', 1.6], ['zoom'], z0 - 2, px * 0.45, z0, px, z0 + 4, px * 5];
export function tileStyle(z0, P = C) {
    const mid = ['secondary', 'tertiary'], maj = ['primary', 'trunk'], name = ['get', 'name'];
    const pick = cls => cls.includes('minor') ? ['any', ['in', ['get', 'class'], ['literal', cls]], ['all', ['==', ['get', 'class'], 'path'], ['==', ['get', 'subclass'], 'pedestrian']]] : ['in', ['get', 'class'], ['literal', cls]];
    const road = (id, cls, w, color) => ({ id, type: 'line', source: 't', 'source-layer': 'transportation', filter: ['all', pick(cls), ['!=', ['get', 'brunnel'], 'tunnel']],
        layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': w } });
    const rail = (id, yard, color, w, extra = {}) => ({ id, type: 'line', source: 't', 'source-layer': 'transportation',
        filter: ['all', ['==', ['get', 'class'], 'rail'], yard ? ['has', 'service'] : ['!', ['has', 'service']], ['!=', ['get', 'brunnel'], 'tunnel']], paint: { 'line-color': color, 'line-width': w, ...extra } });
    const label = (color, halo = 1.3) => ({ 'text-color': color, 'text-halo-color': '#ffffff', 'text-halo-width': halo });
    return { version: 8, glyphs: GLYPHS,
        sources: { t: { type: 'vector', url: TILES }, pois: { type: 'geojson', data: EMPTY }, pins: { type: 'geojson', data: EMPTY } },
        layers: [
            { id: 'land', type: 'background', paint: { 'background-color': P.land } },
            { id: 'cover', type: 'fill', source: 't', 'source-layer': 'landcover', paint: { 'fill-color': ['match', ['get', 'class'], 'wood', P.forest, 'grass', P.park, 'wetland', P.park,
                'farmland', ['match', ['get', 'subclass'], 'vineyard', P.vine, P.school], 'ice', P.ice, 'rock', P.rock, 'sand', P.sand, P.land] } },
            { id: 'use', type: 'fill', source: 't', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['railway', 'industrial', 'school', 'university', 'college', 'kindergarten', 'cemetery', 'pitch', 'stadium', 'playground', 'commercial', 'retail']]],
                paint: { 'fill-color': ['match', ['get', 'class'], ['commercial', 'retail'], P.shop, ['railway', 'industrial'], P.works, ['cemetery', 'pitch', 'stadium', 'playground'], P.park, P.school] } },
            // a garden's swimming pool is no water (a Hawaiian street turns into a scatter of blue bits)
            { id: 'water', type: 'fill', source: 't', 'source-layer': 'water', filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'], ['!=', ['get', 'class'], 'swimming_pool']], paint: { 'fill-color': P.water } },
            { id: 'river', type: 'line', source: 't', 'source-layer': 'waterway', filter: ['all', ['in', ['get', 'class'], ['literal', ['river', 'canal']]], ['!=', ['get', 'brunnel'], 'tunnel']],
                paint: { 'line-color': P.water, 'line-width': W(2.5, z0) } },
            road('minorEdge', ['minor'], W(5.5 + 1.2, z0), P.edge), road('midEdge', mid, W(8 + 1.35, z0), P.edge),
            road('minorRoad', ['minor'], W(5.5, z0), P.road), road('midRoad', mid, W(8, z0), P.road),
            rail('railYard', true, P.rail, W(1.3, z0), { 'line-opacity': 0.75 }), rail('rail', false, P.rail, 2.2), rail('railDash', false, P.railDash, 0.9, { 'line-dasharray': [6.7, 5.6] }),
            road('majEdge', maj, W(10 + 1.35, z0), P.majorEdge), road('majRoad', maj, W(10, z0), P.major),
            road('motEdge', ['motorway'], W(11 + 1.35, z0), P.majorEdge), road('motRoad', ['motorway'], W(11, z0), P.major),
            { id: 'street', type: 'symbol', source: 't', 'source-layer': 'transportation_name', filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'tertiary', 'minor']]],
                layout: { 'symbol-placement': 'line', 'text-field': name, 'text-font': ['Noto Sans Regular'], 'text-size': 9.5, 'symbol-spacing': 320, 'text-max-angle': 28, 'text-padding': 6 }, paint: label(P.street) },
            { id: 'waterName', type: 'symbol', source: 't', 'source-layer': 'water_name', layout: { 'text-field': name, 'text-font': ['Noto Sans Italic'], 'text-size': 10.5 }, paint: label(P.waterInk, 1.2) },
            { id: 'riverName', type: 'symbol', source: 't', 'source-layer': 'waterway', filter: ['==', ['get', 'class'], 'river'],
                layout: { 'symbol-placement': 'line', 'text-field': name, 'text-font': ['Noto Sans Italic'], 'text-size': 10.5, 'symbol-spacing': 400 }, paint: label(P.waterInk, 1.2) },
            { id: 'hood', type: 'symbol', source: 't', 'source-layer': 'place', filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood']]],
                layout: { 'text-field': ['upcase', name], 'text-font': ['Noto Sans Bold'], 'text-size': 10, 'text-letter-spacing': 0.12, 'text-padding': 24 }, paint: label(P.hood) },
            // 장소: 종류별 색 동그라미 + 같은 색 글씨(고르기는 pickPlaces), 그 위에 방문 핀
            { id: 'poi', type: 'symbol', source: 'pois', layout: { 'icon-image': ['get', 'k'], 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 10.5,
                'text-anchor': 'left', 'text-offset': [0.95, 0], 'icon-padding': 4, 'text-padding': 6, 'text-max-width': 9 }, paint: { 'text-color': ['get', 'col'], 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } },
            { id: 'pin', type: 'symbol', source: 'pins', layout: { 'icon-image': 'vpin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'],
                'text-size': 12.5, 'text-anchor': 'left', 'text-offset': [0.95, -1.35], 'text-optional': true, 'text-max-width': 12 }, paint: { 'text-color': '#161b22', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 } },
        ] };
}
const EMPTY = { type: 'FeatureCollection', features: [] };

// ---- places (the map rule: 4 on a screen, more than 120px apart, sights first, one to eat or drink, one station)
const KIND = { place_of_worship: 'church', museum: 'museum', art_gallery: 'gallery', theatre: 'theatre', cinema: 'cinema', music: 'music', library: 'library', castle: 'castle', monument: 'monument',
    attraction: 'landmark', zoo: 'zoo', aquarium: 'aquarium', park: 'park', garden: 'garden', stadium: 'stadium', swimming: 'swim', golf: 'golf', playground: 'playground', cafe: 'cafe', restaurant: 'food',
    fast_food: 'food', bar: 'bar', beer: 'beer', bakery: 'bakery', lodging: 'hotel', hospital: 'hospital', pharmacy: 'pharmacy', college: 'university', school: 'school', town_hall: 'townhall',
    police: 'police', fire_station: 'fire', post: 'post', bank: 'bank', bus: 'bus', ferry_terminal: 'ferry', harbor: 'harbour', aerialway: 'cable', railway: 'train', cemetery: 'cemetery',
    information: 'info', campsite: 'camp', marketplace: 'market', department_store: 'mall', shop: 'shop', lighthouse: 'lighthouse' };
const SUB = { cafe: 'cafe', ice_cream: 'cafe', restaurant: 'food', fast_food: 'food', food_court: 'food', bar: 'bar', pub: 'beer', biergarten: 'beer', bakery: 'bakery', wine: 'wine', museum: 'museum',
    gallery: 'gallery', arts_centre: 'gallery', theatre: 'theatre', cinema: 'cinema', concert_hall: 'music', music_venue: 'music', library: 'library', castle: 'castle', palace: 'palace', ruins: 'ruin',
    monument: 'monument', memorial: 'monument', statue: 'statue', viewpoint: 'view', attraction: 'landmark', artwork: 'artwork', zoo: 'zoo', aquarium: 'aquarium', theme_park: 'wheel', park: 'park',
    garden: 'garden', cemetery: 'cemetery', grave_yard: 'cemetery', stadium: 'stadium', sports_centre: 'sports', swimming_pool: 'swim', water_park: 'swim', golf_course: 'golf', playground: 'playground',
    marketplace: 'market', mall: 'mall', department_store: 'mall', hotel: 'hotel', hostel: 'hotel', guest_house: 'hotel', motel: 'hotel', hospital: 'hospital', pharmacy: 'pharmacy', university: 'university',
    college: 'university', school: 'school', kindergarten: 'school', townhall: 'townhall', police: 'police', fire_station: 'fire', post_office: 'post', bank: 'bank', bus_station: 'bus', ferry_terminal: 'ferry',
    marina: 'harbour', lighthouse: 'lighthouse', tower: 'tower', station: 'train', halt: 'train', subway: 'metro', tram_stop: 'tram', camp_site: 'camp', information: 'info', fountain: 'fountain',
    place_of_worship: 'church', peak: 'mountain', beach: 'beach', hot_spring: 'spring', public_bath: 'spring', books: 'shop', clothes: 'shop', gift: 'shop' };
// an attraction the tiles name only that: its name says what it is (in the languages the map meets); a viewpoint is the coin telescope
const GUESS = [[/bridge|brücke|brucke|pont\b|ponte|puente|橋|대교|다리$/i, 'bridge'], [/clock|uhrturm|시계/i, 'clock'], [/tower|turm|\btour\b|torre|タワー|타워|塔/i, 'tower'],
    [/gate|\btor\b|tor$|porte\b|porta\b|puerta|門|문$/i, 'gate'], [/square|platz|^place |piazza|plaza|広場|광장/i, 'square'], [/fountain|brunnen|fontaine|fontana|噴水|분수/i, 'fountain'],
    [/statue|statua|銅像|동상/i, 'statue'], [/memorial|denkmal|monument|mahnmal|記念|기념/i, 'monument'], [/mill|mühle|moulin|mulino|풍차/i, 'windmill'],
    [/planetarium|observator|sternwarte|천문/i, 'observatory'], [/building|skyscraper|center$|centre$|hochhaus|빌딩|ビル/i, 'skyscraper'], [/castle|schloss|burg\b|château|castello|城$/i, 'castle'],
    [/church|kirche|cathedral|\bdom\b|basilica|성당|교회/i, 'church'], [/market|markt|marché|mercato|市場|시장/i, 'market'], [/museum|musée|museo|미술관|박물관/i, 'museum'],
    [/garden|garten|jardin|giardino|庭園|정원/i, 'garden'], [/sculpture|skulptur|art$/i, 'artwork']];
export const kindOf = p => (p.class === 'attraction' && p.subclass !== 'viewpoint' ? (GUESS.find(([re]) => re.test(p.name || '')) || [])[1] || (p.subclass === 'artwork' ? 'artwork' : 'landmark') : '')
    || SUB[p.subclass] || KIND[p.class] || '';
const FOOD = ['food', 'cafe', 'bar', 'beer', 'bakery', 'wine'];
const SIGHT = ['landmark', 'gate', 'skyscraper', 'square', 'artwork', 'bridge', 'clock', 'windmill', 'observatory', 'chapel', 'synagogue', 'pagoda', 'museum', 'gallery', 'theatre', 'cinema', 'music',
    'castle', 'palace', 'monument', 'statue', 'ruin', 'view', 'tower', 'lighthouse', 'zoo', 'aquarium', 'wheel', 'park', 'garden', 'stadium', 'church', 'cathedral', 'mosque', 'temple', 'shrine',
    'library', 'university', 'market', 'mall', 'beach', 'fountain', 'spring', 'mountain', 'harbour', 'airport'];
const TIER = k => SIGHT.includes(k) ? 0 : FOOD.includes(k) ? 1 : ['train', 'metro', 'ferry', 'cable'].includes(k) ? 2 : ['hotel', 'school', 'townhall', 'hospital'].includes(k) ? 3 : 9;
const NOT_PLACE = new Set(['clinic', 'doctors', 'dentist', 'veterinary', 'hairdresser', 'beauty', 'optician', 'bus_stop', 'subway_entrance', 'platform', 'supermarket', 'convenience', 'fuel', 'parking',
    'bicycle_parking', 'atm', 'toilets', 'post_box', 'charging_station', 'car_rental', 'car', 'laundry', 'dry_cleaning', 'mobile_phone', 'kiosk']);
export function choosePlaces(cand, max, near = () => false) {
    cand.sort((a, b) => a.t - b.t || a.r - b.r);
    const out = [], per = {}, cap = { 1: 1 + Math.floor((max - 4) / 2), 2: 1 + Math.floor((max - 4) / 2) };
    for (const x of cand) {
        if (out.length >= max || x.t === 9) break;
        if (cap[x.t] && (per[x.t] || 0) >= cap[x.t]) continue;
        if (near(x) || out.some(y => Math.hypot(y.xy.x - x.xy.x, y.xy.y - x.xy.y) < 120)) continue;
        out.push(x); per[x.t] = (per[x.t] || 0) + 1;
    }
    return out;
}

// ---- the one map (moved into whichever map box is on screen), its deeper twin for places, the visit pins
const live = { el: null, map: null, deep: null, slug: '', pal: '', z0: 14, found: [], pinKey: '', pinAt: new Map(), shown: [], vis: 430 };
function pinImage(color) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="54" height="54" viewBox="0 0 24 24"><path d="${PIN}" fill="${color}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.4" fill="#fff"/></svg>`;
    return new Promise(res => { const im = new Image(54, 54); im.onload = () => res(im); im.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; });
}
function iconImage(k) {
    const [d, off, col] = ICONS[k];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="-8 -8 16 16"><circle r="7.5" fill="${col}"/><g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(-5 -5) scale(.42)"><g transform="translate(${off[0]} ${off[1]})"><path d="${d}"/></g></g></svg>`;
    return new Promise(res => { const im = new Image(32, 32); im.onload = () => res(im); im.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; });
}
function pickPlaces() {
    const map = live.map; if (!map || !map.getSource('pois')) return;
    const w = live.el.clientWidth, h = live.vis, c = map.project(map.getCenter()), max = 4 + Math.max(0, Math.round((map.getZoom() - live.z0) * 2));
    const pinned = new Set(live.shown.map(key)), pins = [...live.pinAt.values()].map(ll => map.project(ll)), cand = [];
    for (const f of live.found) {
        const p = f.properties, k = kindOf(p);
        if (!k || !ICONS[k] || NOT_PLACE.has(p.subclass) || (k === 'hospital' && p.subclass !== 'hospital') || pinned.has(key(p.name))) continue;
        const xy = map.project(f.geometry.coordinates);
        if (xy.x < 24 || xy.x > w - 110 || xy.y < 112 || xy.y > h - 24) continue;
        cand.push({ f: { ...f, properties: { name: p.name, k, col: ICONS[k][2] } }, t: TIER(k), r: p.rank ?? 30, xy });
    }
    const near = x => pins.some(q => Math.hypot(q.x - x.xy.x, q.y - x.xy.y) < 70) || Math.hypot(c.x - x.xy.x, c.y - x.xy.y) < 24;
    map.getSource('pois').setData({ type: 'FeatureCollection', features: choosePlaces(cand, max, near).map(x => x.f) });
}
// a visit's pin: where the map has a place of that name, else a spot of its own from its name (round the middle, on land, apart)
function placePins() {
    const map = live.map; if (!map || !map.getSource('pins')) return;
    const w = live.el.clientWidth, h = live.vis, c = map.project(map.getCenter()), taken = [];
    for (const n of live.shown) {
        if (live.pinAt.has(n)) { taken.push(map.project(live.pinAt.get(n))); continue; }
        const k = key(n), mid = map.getCenter(), f = live.found.find(f => { const m = key(f.properties.name); return m && (m === k || (m.length >= 4 && k.includes(m)) || (k.length >= 4 && m.includes(k))) && mid.distanceTo({ lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }) < 1800; });
        let ll = f ? f.geometry.coordinates : null;
        if (!ll) {
            const s = hsh(n);
            for (let t = 0; t < 24 && !ll; t++) {
                const a = ((s % 360) + t * 137.5) * Math.PI / 180, r = 46 + ((s >>> 9) % 70) + t * 5, x = c.x + Math.cos(a) * r * 1.25, y = c.y + Math.sin(a) * r * 0.8;
                if (x < 28 || x > w - 130 || y < 120 || y > h - 30) continue;
                if (map.queryRenderedFeatures([x, y], { layers: ['water', 'rail', 'railYard', 'motRoad', 'majRoad'] }).length) continue;
                if (taken.some(q => Math.hypot(q.x - x, q.y - y) < 64)) continue;
                ll = map.unproject([x, y]).toArray();
            }
        }
        if (!ll) continue;
        live.pinAt.set(n, ll); taken.push(map.project(ll));
    }
    const at = live.shown.filter(n => live.pinAt.has(n)).map(n => live.pinAt.get(n));
    if (at.length && !live.fitted) {
        live.fitted = true;
        const pad = { top: 112, bottom: Math.max(0, live.el.clientHeight - h) + 36, left: 36, right: 150 };
        const off = at.some(ll => { const q = map.project(ll); return q.x < pad.left || q.x > w - pad.right || q.y < pad.top || q.y > h - 36; });
        if (off) {
            const b = at.reduce((bb, ll) => bb.extend(ll), new window.maplibregl.LngLatBounds(at[0], at[0]));
            const cam = map.cameraForBounds(b, { padding: pad, maxZoom: live.z0 });   // never more than one step further out than the town's own scale
            if (cam) map.jumpTo({ center: cam.center, zoom: Math.max(live.z0 - 1, cam.zoom) });
        }
    }
    map.getSource('pins').setData({ type: 'FeatureCollection', features: live.shown.filter(n => live.pinAt.has(n)).map(n => ({ type: 'Feature', geometry: { type: 'Point', coordinates: live.pinAt.get(n) }, properties: { name: n.length > 20 ? `${n.slice(0, 19)}…` : n } })) });
}
function deepMap(gl, center, zoom) {
    let el = document.getElementById('na_tm_deep');
    if (!el) { el = document.createElement('div'); el.id = 'na_tm_deep'; el.setAttribute('aria-hidden', 'true'); el.style.cssText = 'position: fixed; left: -10000px; top: 0; visibility: hidden; pointer-events: none;'; document.body.appendChild(el); }
    el.style.width = `${live.el.clientWidth * 2}px`; el.style.height = `${live.el.clientHeight * 2}px`;
    if (live.deep) live.deep.remove();
    live.deep = new gl.Map({ container: el, interactive: false, attributionControl: false, center, zoom: zoom + 1,
        style: { version: 8, sources: { t: { type: 'vector', url: TILES } }, layers: [{ id: 'p', type: 'circle', source: 't', 'source-layer': 'poi', paint: { 'circle-radius': 1, 'circle-opacity': 0 } }] } });
    live.deep.on('idle', () => {
        const seen = new Set(), out = [];
        for (const f of live.deep.querySourceFeatures('t', { sourceLayer: 'poi' })) {
            const p = f.properties, k = `${p.name}|${p.class}|${p.subclass}`;
            if (!p.name || seen.has(k) || f.geometry.type !== 'Point') continue;
            seen.add(k); out.push({ type: 'Feature', geometry: f.geometry, properties: p });
        }
        live.found = out; placePins(); pickPlaces();
    });
}
// the map box on screen: <div class="mp_bg" data-tm='{"city","words":[…],"pins":[…],"vis":px}'>
export async function mountTiles(root) {
    const host = root?.querySelector?.('.mp_bg[data-tm]');
    if (!host) { if (live.el?.isConnected) live.el.remove(); return; }
    let want; try { want = JSON.parse(host.dataset.tm); } catch { return; }
    const spot = spotIn(await loadSpots(), want.city, want.words || []);
    if (!spot || !host.isConnected) return;
    let gl; try { gl = await loadLib(); } catch { return; }
    if (!host.isConnected) return;
    const [slug, , kind, lat, lon] = spot, P = palette(kind, lat), pal = JSON.stringify(P);
    const wx = host.closest('.mp_wx');
    live.vis = Number(want.vis) || host.clientHeight;
    const pinKey = (want.pins || []).join('|');
    if (live.map && live.slug === slug && live.pal === pal) {
        if (live.el.parentElement !== host) host.appendChild(live.el);
        live.map.resize();
        if (pinKey !== live.pinKey) { live.pinKey = pinKey; live.shown = want.pins || []; live.fitted = false; placePins(); pickPlaces(); }
        if (live.ready) { host.classList.add('mp_tiled'); wx?.classList.add('mp_tiles'); }
        return;
    }
    if (live.map) { live.map.remove(); live.map = null; }
    if (!live.el) { live.el = document.createElement('div'); live.el.className = 'mp_tile'; }
    host.appendChild(live.el);
    Object.assign(live, { slug, pal, pinKey, shown: want.pins || [], pinAt: new Map(), found: [], ready: false, fitted: false });
    const span = /도심/.test(kind) ? 1300 : 1550, w = host.clientWidth || 390;
    const z0 = live.z0 = Math.log2(78271.517 * Math.cos(lat * Math.PI / 180) * w / span);
    // the middle a little above the box's middle: the sheet covers its lower part
    const map = live.map = new gl.Map({ container: live.el, style: tileStyle(z0, P), center: [lon, lat], zoom: z0, attributionControl: false,
        localIdeographFontFamily: '-apple-system, "Noto Sans KR", "Hiragino Sans", "PingFang SC", sans-serif', dragRotate: false, pitchWithRotate: false, fadeDuration: 150 });
    map.touchZoomRotate.disableRotation();
    if (live.vis < host.clientHeight) map.setPadding({ bottom: host.clientHeight - live.vis });
    const color = getComputedStyle(host).getPropertyValue('--axd').trim() || '#3478f6';
    map.on('styleimagemissing', async e => {
        if (map.hasImage(e.id)) return;
        const im = e.id === 'vpin' ? await pinImage(color) : ICONS[e.id] ? await iconImage(e.id) : null;
        if (im && !map.hasImage(e.id)) map.addImage(e.id, im, { pixelRatio: 2 });
    });
    map.once('load', async () => { if (!map.hasImage('vpin')) map.addImage('vpin', await pinImage(color), { pixelRatio: 2 }); });
    map.once('idle', () => {
        if (live.map !== map) return;
        live.ready = true;
        const h = live.el.closest('.mp_bg'); h?.classList.add('mp_tiled'); h?.closest('.mp_wx')?.classList.add('mp_tiles');
        placePins();
    });
    map.on('error', () => { if (!live.ready && live.map === map) { /* the drawn map stays */ } });
    map.on('moveend', () => { pickPlaces(); live.deep?.jumpTo({ center: map.getCenter(), zoom: map.getZoom() + 1 }); });
    deepMap(gl, [lon, lat], z0);
}
// the box grew or shrank (the sheet was pulled down or back up)
export function resizeTiles(vis) { if (!live.map) return; if (vis) live.vis = vis; live.map.resize(); live.map.setPadding({ bottom: Math.max(0, live.el.clientHeight - live.vis) }); pickPlaces(); }
// how much of the box is map you see: down to the sheet (or the search sheet, or the card on a neighbourhood's map)
function visOf(host) {
    const wx = host.closest('.mp_wx'), top = host.getBoundingClientRect().top;
    const s = wx?.querySelector('.mp_sheet, .mq_sheet, .mq_fc');
    const v = s ? s.getBoundingClientRect().top - top : host.clientHeight;
    return Math.max(160, Math.min(host.clientHeight, v));
}
// the phone's screens are drawn again and again: a new map box gets the one map (watched, the way phonemapzoom.js does)
export function tileWatch(root) {
    let busy = false;
    sheetPull(root);
    new MutationObserver(() => {
        const host = root.querySelector('.mp_bg[data-tm]');
        if (!host) { if (live.el?.isConnected && !live.el.closest('.mp_bg[data-tm]')) live.el.remove(); return; }
        if (host._tm || busy) return;
        host._tm = true; busy = true;
        requestAnimationFrame(() => { host.dataset.vis ||= String(Math.round(visOf(host))); const d = JSON.parse(host.dataset.tm); d.vis = Number(host.dataset.vis); host.dataset.tm = JSON.stringify(d);
            mountTiles(root).catch(() => {}).finally(() => { busy = false; }); });
    }).observe(root, { childList: true, subtree: true });
}
// the sheet pulled down: the whole screen is map and the sheet is gone; a small "목록" pill at the bottom brings it back.
// Nothing follows the finger (a style changed on every move makes the whole phone's styles be worked out again,
// docs/DESIGN.md 4장 함정): the pull is measured, and when the finger lets go the sheet moves once, with a transition.
const PEEK = 0;
function setLow(wx, low) {
    const sc = wx.querySelector(':scope > .ax_scroll'), gap = sc?.querySelector('.mp_gap'), host = wx.querySelector('.mp_bg');
    if (!sc || !gap || !host) return;
    if (low) { if (!gap.dataset.h) gap.dataset.h = String(gap.offsetHeight); sc.scrollTop = 0; gap.style.height = `${sc.clientHeight - PEEK}px`; }
    else gap.style.height = '';
    wx.classList.toggle('mp_low', low);
    let up = wx.querySelector(':scope > .mp_up');
    if (low && !up) {
        const n = live.shown.length;
        up = document.createElement('button'); up.type = 'button'; up.className = 'mp_up';
        up.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.1M4 12h.1M4 18h.1"/></svg>목록${n ? ` · ${n}곳` : ''}`;
        up.addEventListener('click', e => { e.stopPropagation(); setLow(wx, false); });
        wx.appendChild(up);
    } else if (!low && up) up.remove();
    const done = () => { const v = low ? host.clientHeight - PEEK : visOf(host); resizeTiles(Math.round(v)); };
    gap.addEventListener('transitionend', done, { once: true }); setTimeout(done, 400);
}
function sheetPull(root) {
    let g = null;
    root.addEventListener('pointerdown', e => {
        const sheet = e.target.closest?.('.mp_wx.mp_tiles .mp_sheet'); if (!sheet) return;
        const wx = sheet.closest('.mp_wx'), sc = wx.querySelector(':scope > .ax_scroll');
        if (!wx.classList.contains('mp_low') && sc && sc.scrollTop > 2) return;   // the list is scrolled: the finger scrolls it
        g = { wx, x: e.clientX, y: e.clientY, low: wx.classList.contains('mp_low') };
    }, true);
    root.addEventListener('pointerup', e => {
        if (!g) return;
        const dx = e.clientX - g.x, dy = e.clientY - g.y, { wx, low } = g; g = null;
        if (!low && dy > 48 && Math.abs(dy) > Math.abs(dx) * 1.4) setLow(wx, true);
        else if (low && (dy < -24 || (Math.abs(dy) < 6 && Math.abs(dx) < 6))) setLow(wx, false);
    }, true);
    root.addEventListener('pointercancel', () => { g = null; }, true);
}
