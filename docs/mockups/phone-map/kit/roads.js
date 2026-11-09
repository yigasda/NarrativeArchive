// 큰길 뼈대 15가지 + 얹는 구조물 12가지. 동네마다 뼈대 하나, 구조물 두세 개를 이름 해시로 골라요.
// 뼈대는 점 목록(polyline)들을 돌려줘서, 단지 · 학교 · 신사가 그 길을 비켜 앉을 수 있어요.
module.exports = ({ r, f, curve, C, big, way, W = 390, H = 560 }) => {
  const P = (a, d, x, y) => [x + Math.cos(a) * d, y + Math.sin(a) * d];
  const line = (a, cx, cy, len = 520) => [P(a + Math.PI, len, cx, cy), [cx, cy], P(a, len, cx, cy)];
  const wob = (pts, k) => pts.map(([x, y], i) => (i === 0 || i === pts.length - 1) ? [x, y] : [x + (r() - 0.5) * k, y + (r() - 0.5) * k]);
  const thru = (a, cx, cy, n = 5, k = 40) => wob(Array.from({ length: n }, (_, i) => P(a, -520 + i * (1040 / (n - 1)), cx, cy)), k);
  const SK = {
    diagonal: (cx, cy) => [thru(-0.6 + r() * 0.3, cx, cy)],
    y: (cx, cy) => { const a = r() * 6.283; return [0, 2.1, 4.2].map(d => [[cx, cy], ...wob([P(a + d, 120, cx, cy), P(a + d + 0.2, 300, cx, cy), P(a + d + 0.3, 560, cx, cy)], 30)]); },
    star: (cx, cy) => { const a = r(); return Array.from({ length: 6 }, (_, i) => [[cx, cy], P(a + i * 1.047, 560, cx, cy)]); },
    roundabout: (cx, cy) => { const a = r(); const o = Array.from({ length: 5 }, (_, i) => [P(a + i * 1.257, 22, cx, cy), ...wob([P(a + i * 1.257 + 0.1, 200, cx, cy), P(a + i * 1.257 + 0.2, 560, cx, cy)], 40)]); o.ring = [cx, cy, 22]; return o; },
    ringRadial: (cx, cy) => { const R = 150 + r() * 40, ring = Array.from({ length: 25 }, (_, i) => P(i / 24 * 6.283, R, cx, cy)); return [ring, ...[0.3, 1.9, 3.6, 5.0].map(a => [[cx, cy], P(a + r() * 0.3, 560, cx, cy)])]; },
    twin: (cx, cy) => { const a = 1.57 + (r() - 0.5) * 0.4; const o = [thru(a, cx - 10, cy, 4, 10), thru(a, cx + 10, cy, 4, 10)]; o.median = true; return o; },
    tee: (cx, cy) => { const a = r() * 0.4 - 0.2; return [thru(a, cx, cy - 120, 5, 30), [P(a + 1.57, 0, cx, cy - 120), ...wob([P(a + 1.57, 200, cx, cy - 120), P(a + 1.57, 700, cx, cy - 120)], 30)]]; },
    elbow: (cx, cy) => { const s = r() < 0.5 ? 1 : -1; return [[[cx - 400 * s, cy - 60], [cx - 40 * s, cy - 50], [cx, cy - 30], [cx + 10 * s, cy + 20], [cx + 20 * s, cy + 600]]]; },
    trapezoid: (cx, cy) => [[[cx - 40, -40], [cx - 120, 300], [cx - 220, 620]], [[cx + 40, -40], [cx + 120, 300], [cx + 220, 620]], line(0.05, cx, cy + 120)],
    grid: (cx, cy) => { const t = (r() - 0.5) * 0.3; return [-90, 90].map(d => line(1.57 + t, cx + d, cy)).concat([-110, 110].map(d => line(t, cx, cy + d))); },
    contour: (cx, cy) => { const hx = r() < 0.5 ? -60 : 450, hy = r() < 0.5 ? -40 : 600, R = 260 + r() * 80; return [Array.from({ length: 20 }, (_, i) => P(i / 19 * 6.283, R, hx, hy)), Array.from({ length: 20 }, (_, i) => P(i / 19 * 6.283, R + 130, hx, hy))]; },
    zigzag: (cx, cy) => { const x0 = 60 + r() * 260; return [Array.from({ length: 9 }, (_, i) => [x0 + (i % 2 ? 90 : -90) * (0.6 + r() * 0.4), -40 + i * 80])]; },
    single: (cx, cy) => [thru(1.57 + (r() - 0.5) * 0.6, cx, cy, 6, 70)],
    none: () => [],
    cross: (cx, cy) => [thru(1.57 + (r() - 0.5) * 0.3, cx, cy, 5, 50), thru((r() - 0.5) * 0.4, cx, cy, 5, 50)],
  };
  const NAMES = Object.keys(SK);
  // overlays drawn over a skeleton road
  const len = p => p.reduce((s, q, i) => i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0);
  const pointAt = (p, t) => { let L = len(p) * t; for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (L <= d) { const u = L / d; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * u, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * u, Math.atan2(p[i][1] - p[i - 1][1], p[i][0] - p[i - 1][0])]; } L -= d; } return [...p.at(-1), 0]; };
  const OV = {
    elevated: p => { const d = curve(p); let pil = ''; for (let t = 0.05; t < 1; t += 0.06) { const [x, y, a] = pointAt(p, t); pil += `<rect x="-2" y="-5" width="4" height="10" transform="translate(${f(x + 3)} ${f(y + 4)}) rotate(${f(a * 57.3)})" fill="#c9c2b6"/>`; }
      return `<path d="${d}" fill="none" stroke="#000" stroke-opacity=".08" stroke-width="16" transform="translate(4 6)"/>` + pil + `<path d="${d}" fill="none" stroke="#bfb8ac" stroke-width="13"/><path d="${d}" fill="none" stroke="#e9e5dd" stroke-width="10"/><path d="${d}" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="6 6"/>`; },
    clover: p => { const [x, y] = pointAt(p, 0.45); let o = ''; for (const [u, v] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) o += `<circle cx="${f(x + u * 22)}" cy="${f(y + v * 22)}" r="18" fill="none" stroke="${C.majorEdge}" stroke-width="6.4"/><circle cx="${f(x + u * 22)}" cy="${f(y + v * 22)}" r="18" fill="none" stroke="${C.major}" stroke-width="4"/>`;
      return o + `<circle cx="${f(x)}" cy="${f(y)}" r="10" fill="${C.park}"/>`; },
    diamond: p => { const [x, y, a] = pointAt(p, 0.55), q = (u, v) => [x + Math.cos(a) * u - Math.sin(a) * v, y + Math.sin(a) * u + Math.cos(a) * v]; const d = `M${q(-60, 0).map(f).join(' ')}L${q(-20, 26).map(f).join(' ')}L${q(20, 26).map(f).join(' ')}L${q(60, 0).map(f).join(' ')}M${q(-60, 0).map(f).join(' ')}L${q(-20, -26).map(f).join(' ')}L${q(20, -26).map(f).join(' ')}L${q(60, 0).map(f).join(' ')}`; return big(d, 3.6); },
    trench: p => { const d = curve(p); return `<path d="${d}" fill="none" stroke="#cfc8bc" stroke-width="18"/><path d="${d}" fill="none" stroke="#b9b1a4" stroke-width="12"/>` + big(d, 8); },
    tunnel: p => { let o = ''; for (const t of [0.3, 0.62]) { const [x, y, a] = pointAt(p, t); o += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a * 57.3)})"><path d="M-6 -9a9 9 0 0 1 0 18" fill="none" stroke="#8f877b" stroke-width="3"/><rect x="0" y="-9" width="40" height="18" fill="${C.built}" opacity=".85"/></g>`; } return o; },
    tram: p => `<path d="${curve(p)}" fill="none" stroke="#8a847a" stroke-width="1.2"/><path d="${curve(p)}" fill="none" stroke="#8a847a" stroke-width="3.4" stroke-dasharray="1 7"/>`,
    busLane: p => `<path d="${curve(p)}" fill="none" stroke="#d98b7a" stroke-width="2" transform="translate(2.6 0)" opacity=".8"/>`,
    median: p => `<path d="${curve(p)}" fill="none" stroke="${C.park}" stroke-width="5"/>` + (() => { let o = ''; for (let t = 0.04; t < 1; t += 0.035) { const [x, y] = pointAt(p, t); o += `<circle cx="${f(x)}" cy="${f(y)}" r="2.4" fill="${C.forest}"/>`; } return o; })(),
    zebra: p => { let o = ''; for (const t of [0.35, 0.5, 0.68]) { const [x, y, a] = pointAt(p, t); o += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a * 57.3)})">${[-6, -3, 0, 3, 6].map(v => `<rect x="-1" y="${v - 0.8}" width="2" height="1.6" fill="#fff"/>`).join('')}</g>`; } return o; },
    bridgeBig: p => '',
    railOver: p => { const [x, y, a] = pointAt(p, 0.4), b = a + 1.57; return `<path d="M${f(x - Math.cos(b) * 400)} ${f(y - Math.sin(b) * 400)} L${f(x + Math.cos(b) * 400)} ${f(y + Math.sin(b) * 400)}" fill="none" stroke="${C.rail}" stroke-width="3"/><path d="M${f(x - Math.cos(b) * 400)} ${f(y - Math.sin(b) * 400)} L${f(x + Math.cos(b) * 400)} ${f(y + Math.sin(b) * 400)}" fill="none" stroke="${C.land}" stroke-width="1.5" stroke-dasharray="5 5"/>`; },
    parking: p => { const [x, y, a] = pointAt(p, 0.75); let o = `<g transform="translate(${f(x + 22)} ${f(y)}) rotate(${f(a * 57.3)})"><rect x="-22" y="6" width="44" height="26" rx="2" fill="#e4e0d8"/>`; for (let i = 0; i < 6; i++) o += `<path d="M${-18 + i * 7} 10v8M${-18 + i * 7} 20v8" stroke="#fff" stroke-width=".8"/>`; return o + '</g>'; },
  };
  // the interchange loops and tunnel mouths looked like toys at this size: kept out of the draw until they're drawn properly
const OVN = Object.keys(OV).filter(k => !['bridgeBig', 'clover', 'diamond', 'tunnel'].includes(k));
  function pick(style, quiet) {
    // the style leans the choice; the hash decides inside it
    const lean = { boulevard: ['grid', 'cross', 'twin', 'trapezoid'], suburb: ['contour', 'elbow', 'single', 'trapezoid', 'none'], hill: ['contour', 'zigzag', 'single', 'y'], old: ['star', 'roundabout', 'ringRadial', 'y'], canal: ['single', 'diagonal', 'elbow', 'cross'], valley: ['y', 'diagonal', 'elbow', 'cross', 'single', 'star', 'tee'] }[style] || NAMES;
    const sk = lean[Math.floor(r() * lean.length)], n = quiet ? 1 : 2 + Math.floor(r() * 2), ov = [];
    while (ov.length < n) { const k = OVN[Math.floor(r() * OVN.length)]; if (!ov.includes(k)) ov.push(k); }
    return { sk, ov };
  }
  function draw(style, quiet, cx, cy) {
    const { sk, ov } = pick(style, quiet), lines = SK[sk](cx, cy);
    let o = lines.map((p, i) => big(p.length === 2 ? `M${f(p[0][0])} ${f(p[0][1])}L${f(p[1][0])} ${f(p[1][1])}` : curve(p), style === 'boulevard' ? 9 : i === 0 ? 7.5 : 6)).join('');
    if (lines.ring) o += `<circle cx="${f(lines.ring[0])}" cy="${f(lines.ring[1])}" r="${lines.ring[2]}" fill="none" stroke="${C.majorEdge}" stroke-width="9.4"/><circle cx="${f(lines.ring[0])}" cy="${f(lines.ring[1])}" r="${lines.ring[2]}" fill="none" stroke="${C.major}" stroke-width="7"/><circle cx="${f(lines.ring[0])}" cy="${f(lines.ring[1])}" r="14" fill="${C.park}"/>`;
    if (lines.median) o += OV.median(lines[0].map(([x, y], i) => [(x + lines[1][i][0]) / 2, (y + lines[1][i][1]) / 2]));
    let top = ''; if (lines.length) for (const k of ov) { const p = lines[Math.floor(r() * lines.length)]; if (p.length > 2 || k === 'railOver' || k === 'zebra' || k === 'parking') top += OV[k](p.length > 2 ? p : [p[0], [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2], p[1]]); }
    return { lines, svg: o, top, sk, ov };
  }
  return { draw, NAMES, OVN };
};
