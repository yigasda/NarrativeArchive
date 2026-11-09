// 흐름으로 그리는 길: 도시마다 길 방향 지도(field)를 하나 두고, 골목이 그 방향과 그 직각 방향을 따라 부드럽게 휘며 이어져요.
// 같은 간격으로 겹치지 않게(가까운 길이 있으면 멈춤), 물 · 공원 · 역에서는 멈춰요. 집은 길 양옆에 줄지어 놓여요.
module.exports = function flow({ W, H, field, block, sep = 26, step = 3, r, C, f }) {
  const cell = sep / 2, OCC = [new Map(), new Map()], key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  const near = (x, y, id, fam) => { const occ = OCC[fam], cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [px, py, pid] of occ.get(`${cx + i},${cy + j}`) || []) if (pid !== id && Math.hypot(px - x, py - y) < sep * 0.72) return true; return false; };
  const mark = (pts, id, fam) => pts.forEach(([x, y]) => { const occ = OCC[fam], k = key(x, y); if (!occ.has(k)) occ.set(k, []); occ.get(k).push([x, y, id]); });
  const out = (x, y) => x < -30 || y < -30 || x > W + 30 || y > H + 30;
  const lines = []; let nid = 0;
  const trace = (x0, y0, fam) => {
    const id = nid++, half = s => { const pts = []; let x = x0, y = y0, prev = null;
      for (let k = 0; k < 400; k++) { let a = field(x, y) + fam * Math.PI / 2; let dx = Math.cos(a), dy = Math.sin(a);
        if (prev && dx * prev[0] + dy * prev[1] < 0) { dx = -dx; dy = -dy; } if (k === 0 && s < 0) { dx = -dx; dy = -dy; }
        prev = [dx, dy]; x += dx * step; y += dy * step;
        if (out(x, y) || block(x, y) || (k > 2 && near(x, y, id, fam))) break; pts.push([x, y]); }
      return pts; };
    const a = half(1), b = half(-1), pts = [...b.reverse(), [x0, y0], ...a];
    if (pts.length < 6) return; mark(pts, id, fam); lines.push({ pts, fam });
  };
  // seeds on a coarse grid, both families, in an order fixed by the hash
  const seeds = []; for (let x = -10; x < W + 10; x += sep * 0.9) for (let y = -10; y < H + 10; y += sep * 0.9) seeds.push([x + (r() - 0.5) * 6, y + (r() - 0.5) * 6]);
  for (const fam of [0, 1]) for (const [x, y] of seeds) if (!block(x, y) && !near(x, y, -1, fam)) trace(x, y, fam);
  const d = l => 'M' + l.pts.filter((_, i) => i % 2 === 0 || i === l.pts.length - 1).map(([x, y]) => `${f(x)} ${f(y)}`).join('L');
  // houses along both sides of every street
  let houses = '';
  for (const l of lines) for (let i = 2; i < l.pts.length - 2; i += 3) {
    const [x0, y0] = l.pts[i - 1], [x1, y1] = l.pts[i + 1], a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
    for (const s of [-1, 1]) { if (r() < 0.18) continue; const off = 6.4 + r() * 1.2, hx = l.pts[i][0] + nx * off * s, hy = l.pts[i][1] + ny * off * s;
      if (block(hx, hy)) continue; const w = 6 + r() * 3, h = 5 + r() * 2.4;
      houses += `<rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}" rx=".8" transform="translate(${f(hx)} ${f(hy)}) rotate(${f(a * 57.2958)})" fill="${r() < 0.3 ? C.bld2 : C.bld}"/>`; }
  }
  return { houses, streets: lines.map(d).join('') };
};
