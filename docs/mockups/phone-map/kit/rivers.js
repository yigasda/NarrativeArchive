// 강 틀 10가지 × 물가 5가지 × 다리 · 폭 · 굽이 손잡이. 강은 가운데 줄(점 목록) + 폭으로 그리고, wet()으로 길 · 집을 막아요.
module.exports = ({ r, f, curve, C, W = 390, H = 530 }) => {
  const smooth = (pts, n = 6) => { const o = []; for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[Math.max(0, i - 1)], pts[i]], [c, d] = [pts[i + 1], pts[Math.min(pts.length - 1, i + 2)]];
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; o.push([0.5 * (2 * b[0] + (-a[0] + c[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 + (-a[0] + 3 * b[0] - 3 * c[0] + d[0]) * t3), 0.5 * (2 * b[1] + (-a[1] + c[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 + (-a[1] + 3 * b[1] - 3 * c[1] + d[1]) * t3)]); } } o.push(pts.at(-1)); return o; };
  const dist = (pts, x, y) => { let m = 1e9; for (let i = 1; i < pts.length; i++) { const [p, q] = [pts[i - 1], pts[i]], dx = q[0] - p[0], dy = q[1] - p[1], t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy || 1))); m = Math.min(m, Math.hypot(x - p[0] - t * dx, y - p[1] - t * dy)); } return m; };
  const turn = (pts, a, cx = W / 2, cy = H / 2) => pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
  // frames: each returns channels [{ pts, w }] (and sand bars or an island)
  const F = {
    cross: (k) => { const y0 = H * (0.3 + 0.4 * r()), ph = r() * 6; return [{ pts: Array.from({ length: 7 }, (_, i) => [-60 + i * 85, y0 + Math.sin(i * 0.8 + ph) * 22 * k]), w: 34 + r() * 18 }]; },
    edge: () => { const side = r() < 0.5 ? -1 : 1; return [{ pts: Array.from({ length: 7 }, (_, i) => [side < 0 ? -10 + Math.sin(i) * 14 : W + 10 + Math.sin(i) * 14, -40 + i * 100]), w: 90 + r() * 40 }]; },
    meander: (k) => { const y0 = H * (0.35 + 0.3 * r()); return [{ pts: Array.from({ length: 6 }, (_, i) => [-80 + i * 110, y0 + (i % 2 ? 1 : -1) * (40 + 35 * k)]), w: 28 + r() * 14 }]; },
    wrap: () => { const cx = W * (0.4 + 0.2 * r()), cy = H * (0.45 + 0.1 * r()), R = 150 + r() * 40; return [{ pts: [[-60, cy - R * 0.6], ...Array.from({ length: 9 }, (_, i) => { const a = Math.PI * 1.1 - i * 0.36; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.9]; }), [W + 60, cy + R * 0.4]], w: 30 + r() * 14 }]; },
    confluence: () => { const jx = W * (0.35 + 0.3 * r()), jy = H * (0.4 + 0.2 * r()); return [{ pts: [[-60, jy - 80], [jx * 0.5, jy - 40], [jx, jy], [jx + 120, jy + 30], [W + 60, jy + 60]], w: 40 }, { pts: [[jx + 40, -60], [jx + 30, jy * 0.5], [jx + 10, jy - 10], [jx, jy]], w: 22 }]; },
    island: () => { const y0 = H * (0.4 + 0.2 * r()), a = r() * 40 + 60, b = a + 200 + r() * 60; return [{ pts: [[-60, y0], [a - 30, y0], [a + 40, y0 - 50], [(a + b) / 2, y0 - 62], [b - 40, y0 - 50], [b + 30, y0], [W + 60, y0 + 10]], w: 28 }, { pts: [[a - 30, y0], [a + 40, y0 + 46], [(a + b) / 2, y0 + 58], [b - 40, y0 + 46], [b + 30, y0]], w: 24 }]; },
    creek: () => { const x0 = W * (0.3 + 0.4 * r()), ph = r() * 6; return [{ pts: Array.from({ length: 8 }, (_, i) => [x0 + Math.sin(i * 0.9 + ph) * 60, -40 + i * 85]), w: 9 + r() * 5 }]; },
    covered: () => { const y0 = H * (0.35 + 0.3 * r()); return [{ pts: Array.from({ length: 7 }, (_, i) => [-60 + i * 85, y0 + i * 4 + Math.sin(i * 0.7) * 10]), w: 7, walk: true }]; },
    straight: () => [{ pts: [[-60, H * (0.3 + 0.4 * r())], [W + 60, H * (0.3 + 0.4 * r())]], w: 40 + r() * 20 }],
    braided: () => { const y0 = H * (0.38 + 0.24 * r()); return [{ pts: Array.from({ length: 7 }, (_, i) => [-60 + i * 85, y0 + Math.sin(i * 1.1) * 16]), w: 110 + r() * 30, bars: true }]; },
  };
  const BANK = ['park', 'wall', 'reed', 'promenade', 'none'];
  function make(frame, bank, opts = {}) {
    const k = opts.bend ?? (0.4 + r() * 0.8), ch = F[frame](k).map(c => ({ ...c, pts: smooth(opts.turn ? turn(c.pts, opts.turn) : c.pts) }));
    const pad = opts.walk ? 18 : bank === 'park' ? 18 : bank === 'promenade' ? 14 : bank === 'reed' ? 9 : bank === 'wall' ? 6 : 3;
    const wet = (x, y) => ch.some(c => dist(c.pts, x, y) < c.w / 2 + (c.walk ? 16 : pad));
    const d = c => 'M' + c.pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L');
    let under = '', over = '';
    for (const c of ch) {
      if (bank === 'park') under += `<path d="${d(c)}" fill="none" stroke="${C.park}" stroke-width="${f(c.w + 36)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (bank === 'promenade') under += `<path d="${d(c)}" fill="none" stroke="#efe6d2" stroke-width="${f(c.w + 28)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (bank === 'wall') under += `<path d="${d(c)}" fill="none" stroke="#c9c3b8" stroke-width="${f(c.w + 8)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (bank === 'reed') under += `<path d="${d(c)}" fill="none" stroke="#dbe7c9" stroke-width="${f(c.w + 18)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (c.walk) under += `<path d="${d(c)}" fill="none" stroke="#d9d1c0" stroke-width="${f(c.w + 30)}" stroke-linecap="round"/><path d="${d(c)}" fill="none" stroke="#eee6d4" stroke-width="${f(c.w + 26)}" stroke-linecap="round"/><path d="${d(c)}" fill="none" stroke="${C.park}" stroke-width="${f(c.w + 10)}" stroke-linecap="round"/>`;
    }
    for (const c of ch) under += `<path d="${d(c)}" fill="none" stroke="${C.water}" stroke-width="${f(c.w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    for (const c of ch) {
      if (c.bars) for (let i = 0; i < 5; i++) { const p = c.pts[Math.floor((0.12 + i * 0.18) * c.pts.length)]; under += `<ellipse cx="${f(p[0])}" cy="${f(p[1] + (r() - 0.5) * c.w * 0.4)}" rx="${f(22 + r() * 18)}" ry="${f(5 + r() * 5)}" fill="${C.sand}"/>`; }
      if (bank === 'reed') for (let i = 2; i < c.pts.length - 2; i += 2) { const [x, y] = c.pts[i], [x2, y2] = c.pts[i + 1], a = Math.atan2(y2 - y, x2 - x), nx = -Math.sin(a), ny = Math.cos(a); for (const s of [-1, 1]) over += `<path d="M${f(x + nx * s * (c.w / 2 + 3))} ${f(y + ny * s * (c.w / 2 + 3))}l${f(-nx * s * 3)} ${f(-ny * s * 3 - 2)}" stroke="#a9c391" stroke-width="1"/>`; }
      if (bank === 'promenade') for (let i = 2; i < c.pts.length - 2; i += 3) { const [x, y] = c.pts[i], [x2, y2] = c.pts[i + 1], a = Math.atan2(y2 - y, x2 - x), nx = -Math.sin(a), ny = Math.cos(a); for (const s of [-1, 1]) over += `<circle cx="${f(x + nx * s * (c.w / 2 + 10))}" cy="${f(y + ny * s * (c.w / 2 + 10))}" r="2.6" fill="${C.forest}"/>`; }
      if (bank === 'park') over += `<path d="${'M' + c.pts.map(([x, y], i) => { const j = Math.min(i + 1, c.pts.length - 1), a = Math.atan2(c.pts[j][1] - y, c.pts[j][0] - x); return `${f(x - Math.sin(a) * (c.w / 2 + 9))} ${f(y + Math.cos(a) * (c.w / 2 + 9))}`; }).join('L')}" fill="none" stroke="#e8c9a6" stroke-width="1.3" stroke-dasharray="4 3"/>`;
      if (bank === 'wall') for (const s of [-1, 1]) over += `<path d="${'M' + c.pts.map(([x, y], i) => { const j = Math.min(i + 1, c.pts.length - 1), a = Math.atan2(c.pts[j][1] - y, c.pts[j][0] - x); return `${f(x - Math.sin(a) * s * (c.w / 2 + 4))} ${f(y + Math.cos(a) * s * (c.w / 2 + 4))}`; }).join('L')}" fill="none" stroke="#b5ada0" stroke-width="1"/>`;
      if (c.walk) for (let i = 1; i < c.pts.length - 1; i += 2) { const [x, y] = c.pts[i]; over += `<circle cx="${f(x)}" cy="${f(y - 9)}" r="2.6" fill="${C.forest}"/><circle cx="${f(x + 7)}" cy="${f(y + 9)}" r="2.6" fill="${C.forest}"/><rect x="${f(x - 1.5)}" y="${f(y - 1.5)}" width="3" height="3" fill="#cfc6b4"/>`; }
    }
    // bridges: across the main channel, a car bridge white, a rail bridge grey and dotted
    const main = ch[0], nb = opts.bridges ?? (frame === 'creek' || frame === 'covered' ? 4 : 1 + Math.floor(r() * 3)), bridges = [];
    for (let i = 0; i < nb; i++) { const p = main.pts[Math.floor(main.pts.length * (0.15 + 0.7 * (i + 0.5) / nb))], j = main.pts.indexOf(p), q = main.pts[Math.min(j + 1, main.pts.length - 1)], a = Math.atan2(q[1] - p[1], q[0] - p[0]), L = main.w / 2 + pad + 6, rail = i === 1 && r() < 0.5;
      const x1 = p[0] - Math.sin(a) * L, y1 = p[1] + Math.cos(a) * L, x2 = p[0] + Math.sin(a) * L, y2 = p[1] - Math.cos(a) * L; bridges.push([x1, y1, x2, y2]);
      over += rail ? `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${C.rail}" stroke-width="4"/><path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="#fff" stroke-width="1.6" stroke-dasharray="4 4"/>`
        : `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${C.edge}" stroke-width="${main.w > 60 ? 9 : 7}"/><path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="#fff" stroke-width="${main.w > 60 ? 6.4 : 4.6}"/>`; }
    return { wet, under, over, bridges, ch };
  }
  return { make, FRAMES: Object.keys(F), BANK };
};
