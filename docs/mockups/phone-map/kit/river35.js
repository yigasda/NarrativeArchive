// 강 35가지를 한 장에: 틀 10 × 물가 5 중 35개 조합, 이름 해시로 폭 · 굽이 · 다리 수 · 방향이 달라요. node river35.js → river35.html
const fs = require('fs'), path = require('path');
const flow = require('./flow.js');
const hsh = s => [...String(s)].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7);
const rng = seed => { let s = hsh(seed) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
const f = n => (Math.round(n * 10) / 10).toString();
const curve = pts => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L');
const C = { land: '#f3f0ea', built: '#ebe7df', park: '#d4e8c9', forest: '#c3dcb5', water: '#b6d4ef', sand: '#f2e6c4', road: '#ffffff', edge: '#dad4c9', rail: '#a9a49b', bld: '#e0dbd0', bld2: '#d8d2c6' };
const W = 390, H = 530;
const way = (d, w) => `<path d="${d}" fill="none" stroke="${C.edge}" stroke-width="${f(w + 2.2)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${C.road}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
const NAMES = { cross: '가로지르는 강', edge: '가장자리 큰 강', meander: '굽이치는 강', wrap: '감싸 도는 강', confluence: '두 강 합류', island: '섬을 낀 강', creek: '개천', covered: '복개천 산책로', straight: '곧게 정비된 강', braided: '모래톱 넓은 강' };
const BN = { park: '둔치 공원', wall: '콘크리트 제방', reed: '갈대밭', promenade: '가로수 산책로', none: '건물이 바로 물가' };
const R0 = rng('frames'), FR = Object.keys(NAMES), BK = Object.keys(BN), combos = [];
for (const fr of FR) for (const b of BK) combos.push([fr, b]);
// 35 of the 50, spread so every frame keeps 3–4 banks
const pick = combos.filter((_, i) => (i * 7) % 50 < 35);
let tiles = '';
pick.forEach(([fr, b], n) => {
  const r = rng(`${fr}|${b}|${n}`), RV = require('./rivers.js')({ r, f, curve, C, W, H }), turn = fr === 'edge' || fr === 'creek' ? 0 : (r() - 0.5) * 0.9;
  const rv = RV.make(fr, b, { turn });
  const field = (x, y) => (r() * 0 + 0.1 * Math.sin(x / 90)) + turn;
  const { houses, streets } = flow({ W, H, field, block: rv.wet, sep: 24, r, C, f });
  tiles += `<div class="t"><svg viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${C.built}"/>${rv.under}${houses}${way(streets, 2.1)}${rv.over}</svg><b>${n + 1}. ${NAMES[fr]}</b><small>${BN[b]}</small></div>`;
});
const css = `*{box-sizing:border-box;margin:0}body{background:#d9dce2;font-family:-apple-system,'Noto Sans KR',sans-serif;padding:24px;width:1760px;color:#161b22}h1{font-size:22px}p.s{color:#555;font-size:13px;margin:4px 0 16px}
.g{display:grid;grid-template-columns:repeat(7,1fr);gap:14px}.t{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(22,27,34,.05),0 6px 18px rgba(22,27,34,.08)}.t svg{display:block;width:100%;height:auto}.t b{display:block;font-size:13px;padding:8px 10px 0}.t small{display:block;font-size:11.5px;color:#6b7380;padding:2px 10px 10px}`;
fs.writeFileSync(path.join(__dirname, 'river35.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head><body><h1>다녀간 곳 › 강 35가지</h1><p class="s">강 틀 10가지 × 물가 5가지 중 35개 (폭 · 굽이 · 방향 · 다리 수는 이름 해시) — 마음에 드는 번호에 동그라미</p><div class="g">${tiles}</div></body></html>`);
console.log('ok', pick.length);
