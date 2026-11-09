// 강 35가지를 한 장에: 틀 10 × 물가 5 중 35개 조합, 이름 해시로 폭 · 굽이 · 다리 수 · 방향이 달라요. node river35.js → river2.html
const fs = require('fs'), path = require('path');
const flow = require('./flow.js');
const hsh = s => [...String(s)].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7);
const rng = seed => { let s = hsh(seed) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
const f = n => (Math.round(n * 10) / 10).toString();
const curve = (pts, close = false) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + (close ? 'Z' : '');
const C = { land: '#f3f0ea', built: '#ebe7df', park: '#d4e8c9', forest: '#c3dcb5', water: '#b6d4ef', sand: '#f2e6c4', road: '#ffffff', edge: '#dad4c9', rail: '#a9a49b', bld: '#e0dbd0', bld2: '#d8d2c6' };
const W = 390, H = 530;
const way = (d, w) => `<path d="${d}" fill="none" stroke="${C.edge}" stroke-width="${f(w + 2.2)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${C.road}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
const NAMES = { cross: '가로지르는 강', edge: '가장자리 큰 강', meander: '굽이치는 강', wrap: '감싸 도는 강', confluence: '두 강 합류', island: '섬을 낀 강', creek: '개천', covered: '복개천 산책로', straight: '곧게 정비된 강', braided: '모래톱 넓은 강' };
const BN = { park: '둔치 공원', wall: '콘크리트 제방', reed: '갈대밭', promenade: '가로수 산책로', none: '건물이 바로 물가' };
const FR = Object.keys(NAMES), BK = Object.keys(BN), combos = [];
for (const fr of FR) for (const b of BK) combos.push([fr, b]);
const first = combos.filter((_, i) => (i * 7) % 50 < 35);
// the ten 소망 circled, drawn exactly as they were (the same seed; 4 · 19 · 22 with their first frames)
const KEEP = [4, 6, 7, 14, 15, 16, 17, 19, 22, 32], OLD = { cross: 'crossOld', island: 'islandOld', creek: 'creekOld' }, REDRAWN = new Set([4, 19, 22]);
const NEW = [['corner', 'promenade', '모서리만 스치는 강'], ['tributary', 'park', '큰 강에 개천 합류'], ['estuary', 'reed', '바다로 넓어지는 하구'], ['weir', 'wall', '보 · 낙차'], ['lock', 'wall', '갑문 있는 운하'],
  ['elevatedAlong', 'park', '강 따라 고가도로'], ['parallelCanal', 'promenade', '강과 나란한 수로'], ['oxbow', 'reed', '우각호(옛 물길 호수)'], ['deltaFork', 'reed', '세 갈래로 갈라지는 강'], ['docks', 'wall', '부두 독(선착장)'],
  ['lagoon', 'park', '물길로 이어진 호수'], ['moat', 'wall', '성 둘레 해자'], ['arcs', 'promenade', '반원 운하 여러 줄'], ['quai', 'wall', '계단식 강변(케)'], ['floodplain', 'none', '강가 밭 · 범람원'],
  ['piers', 'none', '잔교가 나온 물가'], ['bendAway', 'park', '위에서 휘어 나가는 강'], ['islandChain', 'reed', '작은 섬 줄지은 강'], ['marina', 'wall', '요트 정박지'], ['cite', 'wall', '도시섬과 다리'],
  ['veniceGrid', 'none', '좁은 운하 격자'], ['dam', 'park', '댐과 저수지'], ['pondChain', 'park', '연못 이어진 실개천'], ['viaduct', 'park', '강 건너는 철도 고가'], ['peninsula', 'promenade', '반도처럼 감싼 강']];
const tile = (seed, fr, b, opts, title, sub, tag) => { const r = rng(seed), RV = require('./rivers.js')({ r, f, curve, C, W, H }), turn = opts.noTurn ? 0 : fr === 'edge' || fr === 'creek' || fr === 'creekOld' ? 0 : (r() - 0.5) * 0.9;
  const rv = RV.make(fr, b, { turn }), field = (x, y) => 0.1 * Math.sin(x / 90) + turn, { houses, streets } = flow({ W, H, field, block: rv.wet, sep: 24, r, C, f });
  return `<div class="t ${tag}"><svg viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${C.built}"/>${rv.under}${houses}${way(streets, 2.1)}${rv.over}</svg><b>${title}</b><small>${sub}</small></div>`; };
let tiles = '';
for (const n of KEEP) { const [fr, b] = first[n - 1]; tiles += tile(`${fr}|${b}|${n - 1}`, REDRAWN.has(n) ? OLD[fr] : fr, b, {}, `✓ ${n}. ${NAMES[fr]}`, `${BN[b]} (고르신 것)`, 'k'); }
NEW.forEach(([fr, b, t], i) => { tiles += tile(`new|${fr}|${b}`, fr, b, { noTurn: ['moat', 'veniceGrid', 'dam', 'docks', 'corner', 'tributary', 'arcs', 'quai', 'floodplain', 'marina', 'elevatedAlong', 'weir', 'lock', 'piers', 'viaduct', 'oxbow', 'cite', 'bendAway', 'islandChain'].includes(fr) }, `${i + 1}. ${t}`, BN[b], ''); });
const css = `*{box-sizing:border-box;margin:0}body{background:#d9dce2;font-family:-apple-system,'Noto Sans KR',sans-serif;padding:24px;width:1760px;color:#161b22}h1{font-size:22px}p.s{color:#555;font-size:13px;margin:4px 0 16px}
.g{display:grid;grid-template-columns:repeat(7,1fr);gap:14px}.t{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(22,27,34,.05),0 6px 18px rgba(22,27,34,.08)}.t svg{display:block;width:100%;height:auto}.t b{display:block;font-size:13px;padding:8px 10px 0}.t.k{outline:3px solid #8fb39a}.t small{display:block;font-size:11.5px;color:#6b7380;padding:2px 10px 10px}`;
fs.writeFileSync(path.join(__dirname, 'river2.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head><body><h1>다녀간 곳 › 강 2차 — 고르신 10개(✓) + 새로 그린 25개</h1><p class="s">새 25개는 고르신 것과 겹치지 않게: 모서리 · 합류 · 하구 · 보 · 갑문 · 고가 · 수로 · 우각호 · 갈래 · 부두 · 호수 · 해자 · 운하 · 계단 강변 · 밭 · 잔교 · 섬 · 요트 · 도시섬 · 운하 격자 · 댐 · 연못 · 철교 · 반도</p><div class="g">${tiles}</div></body></html>`);
console.log('ok');
