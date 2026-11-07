// 도시 지도 12가지: 길 모양만이 아니라 땅 쓰임(숲 · 모래 · 운하 · 성벽 · 철길 · 등고선)까지 달라요.
// 같은 생김새도 이름에 따라 방향 · 물 위치 · 크기가 바뀌어요(무작위 없음, 이름 해시).
var TOWN3 = (() => {
const hsh = s => [...String(s)].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7);
const rng = seed => { let s = hsh(seed) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
const f = n => (Math.round(n * 10) / 10).toString();
// a smooth line through points (Catmull-Rom → cubic Bézier)
const curve = (pts, close = false) => { const P = close ? [pts.at(-1), ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts.at(-1)]; let d = `M${f(P[1][0])} ${f(P[1][1])}`;
  for (let i = 1; i < P.length - 2; i++) { const [a, b, c, e] = [P[i - 1], P[i], P[i + 1], P[i + 2]]; d += ` C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`; }
  return close ? d + 'Z' : d; };
const PAL = {
  light: { land: '#f3f0ea', built: '#ebe7df', park: '#d4e8c9', forest: '#c3dcb5', water: '#b6d4ef', sand: '#f2e6c4', road: '#ffffff', edge: '#dad4c9', major: '#fde7a3', majorEdge: '#e3c77c', rail: '#a9a49b', wall: '#d9c8a7', contour: '#e2dccd', label: '#7b818c', plaza: '#efe6d2', bld: '#e0dbd0', vine: '#e3e6c8' },
  dark: { land: '#1d232c', built: '#232a34', park: '#1f3529', forest: '#1c3124', water: '#173149', sand: '#33302a', road: '#384250', edge: '#141920', major: '#5a5030', majorEdge: '#3d3620', rail: '#59606b', wall: '#4b4232', contour: '#262d37', label: '#8b93a0', plaza: '#2c2f33', bld: '#2b323d', vine: '#262f27' },
};
function draw(kind, W, H, seed, dark = false) {
  const c = PAL[dark ? 'dark' : 'light'], r = rng(`${kind}|${seed}`), o = [];
  const mirror = r() < 0.5, tilt = Math.round((r() - 0.5) * 24);
  const way = (d, w = 4) => `<path d="${d}" fill="none" stroke="${c.edge}" stroke-width="${f(w + 2.6)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${c.road}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const big = (d, w = 7) => `<path d="${d}" fill="none" stroke="${c.majorEdge}" stroke-width="${f(w + 2.6)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${c.major}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const rail = d => `<path d="${d}" fill="none" stroke="${c.rail}" stroke-width="3.2"/><path d="${d}" fill="none" stroke="${c.land}" stroke-width="1.6" stroke-dasharray="5 5"/>`;
  const fill = (d, col, op = 1) => `<path d="${d}" fill="${col}"${op < 1 ? ` opacity="${op}"` : ''}/>`;
  const blob = (cx, cy, rx, ry, n = 9, j = 0.25) => curve(Array.from({ length: n }, (_, k) => { const a = k / n * 6.283, q = 1 + (r() - 0.5) * 2 * j; return [cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q]; }), true);
  const S = Math.max(W, H) * 1.5; // drawing room beyond the edges (for the tilt)
  // a street grid with rows of houses along every street (turned by ang around cx, cy), only inside the shape d
  const rowsGrid = (d, ang, cx, cy, sx, sy, hw = 6) => { const id = `${cidBase}_${nClip++}`, L = [], R = [];
    for (let y = -560; y <= 560; y += sy) for (const s of [-1, 1]) R.push(`<path d="M${f(cx - 600)} ${f(cy + y + s * (hw / 2 + 2))}H${f(cx + 600)}" stroke="${c.bld}" stroke-width="${hw}" stroke-dasharray="${f(5 + r() * 3)} 1.6"/>`);
    for (let x = -600; x <= 600; x += sx) L.push(way(`M${f(cx + x)} ${f(cy - 600)}V${f(cy + 600)}`, 2.2));
    for (let y = -560; y <= 560; y += sy) L.push(way(`M${f(cx - 600)} ${f(cy + y)}H${f(cx + 600)}`, 2.2));
    return `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})"><path d="${d}" fill="${c.built}"/><g transform="rotate(${f(ang)} ${f(cx)} ${f(cy)})">${R.join('')}${L.join('')}</g></g>`; };
  const yOn = (pts, x) => { for (let k = 0; k < pts.length - 1; k++) if (x <= pts[k + 1][0]) { const u = (x - pts[k][0]) / (pts[k + 1][0] - pts[k][0]), v = u * u * (3 - 2 * u); return pts[k][1] + (pts[k + 1][1] - pts[k][1]) * v; } return pts.at(-1)[1]; };
  let nClip = 0; const cidBase = `t${hsh(kind + '|' + seed)}`;
  // a street grid turned by ang around (cx, cy), only inside the shape d
  const grid = (d, ang, cx, cy, sx, sy, w = 2.3, every = 0, bw = 5) => { const id = `${cidBase}_${nClip++}`, L = []; let k = 0;
    for (let x = -600; x <= 600; x += sx, k++) L.push(every && k % every === 0 ? big(`M${f(cx + x)} ${f(cy - 600)}V${f(cy + 600)}`, bw) : way(`M${f(cx + x)} ${f(cy - 600)}V${f(cy + 600)}`, w));
    for (let y = -600; y <= 600; y += sy) L.push(way(`M${f(cx - 600)} ${f(cy + y)}H${f(cx + 600)}`, w));
    return `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})"><path d="${d}" fill="${c.built}"/><g transform="rotate(${f(ang)} ${f(cx)} ${f(cy)})">${L.join('')}</g></g>`; };
  o.push(`<rect x="${-S}" y="${-S}" width="${3 * S}" height="${3 * S}" fill="${c.land}"/>`);
  const X0 = -W * 0.25, X1 = W * 1.25, Y0 = -H * 0.25, Y1 = H * 1.25;
  if (kind === 'oldRiver') { // 강이 휘감는 구시가지: 광장에서 골목이 퍼지고, 강가는 공원, 다리 셋
    const cx = W * (0.35 + r() * 0.3), cy = H * (0.35 + r() * 0.15);
    o.push(fill(blob(cx, cy, W * 0.42, H * 0.3, 11, 0.12), c.built));
    const rv = [[X0, H * 0.78], [W * 0.2, H * (0.62 + r() * 0.1)], [W * 0.5, H * 0.86], [W * 0.82, H * (0.6 + r() * 0.1)], [X1, H * 0.7]];
    o.push(`<path d="${curve(rv)}" fill="none" stroke="${c.park}" stroke-width="54"/>`);
    for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283 + r() * 0.3, L = 120 + r() * 260, mid = [cx + Math.cos(a + 0.3) * L * 0.5, cy + Math.sin(a + 0.3) * L * 0.5]; o.push(way(curve([[cx, cy], mid, [cx + Math.cos(a) * L, cy + Math.sin(a) * L]]), 3 + r() * 1.5)); }
    for (let k = 0; k < 4; k++) o.push(way(`${curve([[X0, cy - 80 + k * 55], [cx, cy - 60 + k * 50 + (r() - 0.5) * 40], [X1, cy - 90 + k * 60]])}`, 2.6));
    o.push(`<path d="${curve(rv)}" fill="none" stroke="${c.water}" stroke-width="30"/>`);
    for (const t of [0.22, 0.5, 0.78]) { const x = W * t; o.push(way(`M${f(x - 6)} ${f(H * 0.52)} L${f(x + 6)} ${f(H * 0.98)}`, 5)); }
    o.push(`<rect x="${f(cx - 20)}" y="${f(cy - 14)}" width="40" height="28" rx="3" fill="${c.plaza}" stroke="${c.edge}"/>`, `<circle cx="${f(cx + 8)}" cy="${f(cy)}" r="5" fill="${c.wall}"/>`);
  } else if (kind === 'gridLake') { // 바둑판 + 호숫가: 촘촘한 길, 4칸마다 큰길, 사선 대로 하나, 호숫가 공원 띠
    const cw = 34 + r() * 14, ch = 20 + r() * 8;
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.built}"/>`);
    const px = Math.floor(r() * 5), py = Math.floor(r() * 6) + 2;
    o.push(`<rect x="${f(px * cw + 2)}" y="${f(py * ch + 2)}" width="${f(cw * 2 - 4)}" height="${f(ch * 4 - 4)}" fill="${c.park}"/>`);
    for (let x = -cw * 3, k = 0; x < W + cw * 3; x += cw, k++) o.push(k % 4 ? way(`M${f(x)} ${Y0}V${Y1}`, 2.4) : big(`M${f(x)} ${Y0}V${Y1}`, 5));
    for (let y = -ch * 3, k = 0; y < H + ch * 3; y += ch, k++) o.push(k % 5 ? way(`M${X0} ${f(y)}H${X1}`, 2.2) : big(`M${X0} ${f(y)}H${X1}`, 5));
    o.push(big(`M${f(-W * 0.1)} ${f(H * 1.05)}L${f(W * 0.9)} ${f(-H * 0.1)}`, 5.5));
    const sh = [[W * 0.72, Y0], [W * (0.66 + r() * 0.08), H * 0.3], [W * 0.74, H * 0.6], [W * 0.68, H * 0.9], [W * 0.72, Y1]];
    o.push(fill(`${curve(sh)}L${X1} ${Y1}L${X1} ${Y0}Z`, c.park), fill(`${curve(sh.map(([x, y]) => [x + 18, y]))}L${X1} ${Y1}L${X1} ${Y0}Z`, c.water));
    o.push(`<path d="${curve(sh.map(([x, y]) => [x + 9, y]))}" fill="none" stroke="${c.road}" stroke-width="2" stroke-dasharray="1 4" stroke-linecap="round"/>`);
  } else if (kind === 'star') { // 방사형: 작은 둥근 광장에서 대로 여덟 갈래, 갈래 사이마다 방향이 다른 바둑판, 바깥 고리길, 강과 긴 공원
    const cx = W * (0.42 + r() * 0.16), cy = H * (0.4 + r() * 0.12), n = 8, a0 = r() * 0.8, R = 900;
    const ang = Array.from({ length: n }, (_, k) => a0 + k / n * 6.283 + (r() - 0.5) * 0.25);
    for (let k = 0; k < n; k++) { const a = ang[k], b = ang[(k + 1) % n] + (k === n - 1 ? 6.283 : 0), m = (a + b) / 2;
      const d = `M${f(cx)} ${f(cy)}L${f(cx + Math.cos(a) * R)} ${f(cy + Math.sin(a) * R)}L${f(cx + Math.cos(m) * R * 1.4)} ${f(cy + Math.sin(m) * R * 1.4)}L${f(cx + Math.cos(b) * R)} ${f(cy + Math.sin(b) * R)}Z`;
      o.push(grid(d, m * 57.3, cx, cy, 26 + r() * 8, 34 + r() * 10, 2.2)); }
    const pa = ang[2], px = cx + Math.cos(pa) * 150, py = cy + Math.sin(pa) * 150;
    o.push(`<rect x="-70" y="-17" width="140" height="34" rx="3" fill="${c.park}" transform="translate(${f(px)} ${f(py)}) rotate(${f(pa * 57.3)})"/>`);
    o.push(`<path d="${curve([[X0, H * 0.86], [W * 0.25, H * 0.8], [W * 0.55, H * 0.93], [W * 0.85, H * 0.84], [X1, H * 0.9]])}" fill="none" stroke="${c.park}" stroke-width="46"/>`);
    o.push(`<path d="${curve([[X0, H * 0.86], [W * 0.25, H * 0.8], [W * 0.55, H * 0.93], [W * 0.85, H * 0.84], [X1, H * 0.9]])}" fill="none" stroke="${c.water}" stroke-width="24"/>`);
    o.push(way(`M${f(cx + 250)} ${f(cy)}A250 210 0 1 1 ${f(cx + 249.9)} ${f(cy - 1)}`, 4.6));
    ang.forEach((a, k) => { const e = `M${f(cx + Math.cos(a) * 24)} ${f(cy + Math.sin(a) * 24)}L${f(cx + Math.cos(a) * R)} ${f(cy + Math.sin(a) * R)}`; o.push(k % 4 === 0 ? big(e, 6) : way(e, 4.6)); });
    o.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="27" fill="${c.edge}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="25.5" fill="${c.road}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="15" fill="${c.park}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="5" fill="${c.wall}"/>`);
  } else if (kind === 'bay') { // 만: 바다가 한쪽을 차지, 모래사장, 해안 도로, 부두 셋, 뒤쪽 언덕 등고선
    const bay = [[X0, H * 0.58], [W * 0.18, H * 0.66], [W * 0.42, H * (0.82 + r() * 0.06)], [W * 0.7, H * 0.68], [W * 0.9, H * 0.48], [X1, H * 0.42]];
    for (let k = 0; k < 6; k++) o.push(`<path d="${curve([[X0, H * (0.05 + k * 0.07)], [W * 0.3, H * (0.02 + k * 0.08)], [W * 0.6, H * (0.08 + k * 0.06)], [X1, H * (0.0 + k * 0.07)]])}" fill="none" stroke="${c.contour}" stroke-width="1.2"/>`);
    o.push(fill(`${curve(bay.map(([x, y]) => [x, y - 70]))}L${X1} ${Y1}L${X0} ${Y1}Z`, c.built));
    for (let k = 0; k < 5; k++) o.push(way(curve(bay.map(([x, y]) => [x, y - 40 - k * 32])), k === 2 ? 3.4 : 2.4));
    for (let k = 0; k < 7; k++) { const x = W * (0.05 + k * 0.15); o.push(way(`M${f(x)} ${f(H * 0.2)}L${f(x + 10)} ${f(H * 0.9)}`, 2.4)); }
    o.push(fill(`${curve(bay.map(([x, y]) => [x, y - 8]))}L${X1} ${Y1}L${X0} ${Y1}Z`, c.sand), fill(`${curve(bay)}L${X1} ${Y1}L${X0} ${Y1}Z`, c.water));
    o.push(big(curve(bay.map(([x, y]) => [x, y - 16])), 5));
    for (const t of [0.3, 0.55, 0.78]) { const [x, y] = [W * t, H * (t < 0.5 ? 0.76 : 0.7)]; o.push(`<path d="M${f(x)} ${f(y)}l${f(8 + r() * 6)} 44" stroke="${c.road}" stroke-width="5" stroke-linecap="round"/>`); }
  } else if (kind === 'island') { // 섬: 물이 사방, 섬을 도는 순환 도로, 본토로 가는 다리, 작은 항구
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.water}"/>`);
    const cx = W * (0.48 + r() * 0.06), cy = H * 0.45, isl = blob(cx, cy, W * 0.42, H * 0.36, 13, 0.18);
    o.push(fill(`M${X0} ${f(H * 1.05)} ${curve([[X0, H * 0.95], [W * 0.3, H * 1.02], [W * 0.7, H * 0.96], [X1, H * 1.02]]).slice(1)}L${X1} ${Y1}L${X0} ${Y1}Z`, c.land));
    o.push(fill(isl, c.sand), fill(blob(cx, cy, W * 0.39, H * 0.33, 13, 0.16), c.land), fill(blob(cx + 10, cy - 10, W * 0.24, H * 0.2, 9, 0.2), c.built), fill(blob(cx - 70, cy + 40, 46, 30, 7, 0.25), c.forest));
    o.push(way(blob(cx, cy, W * 0.32, H * 0.27, 11, 0.06), 4));
    for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283; o.push(way(curve([[cx, cy], [cx + Math.cos(a) * 50, cy + Math.sin(a) * 40 + 10], [cx + Math.cos(a) * W * 0.3, cy + Math.sin(a) * H * 0.25]]), 2.4)); }
    o.push(big(`M${f(cx + 20)} ${f(cy + H * 0.3)}L${f(cx + 40)} ${f(H * 1.05)}`, 5));
    o.push(`<path d="M${f(cx - W * 0.34)} ${f(cy + 10)}h-26M${f(cx - W * 0.34)} ${f(cy + 26)}h-20" stroke="${c.road}" stroke-width="4" stroke-linecap="round"/>`);
  } else if (kind === 'mountain') { // 산골: 숲과 등고선, 지그재그 산길, 아래쪽 작은 마을, 산 호수
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.forest}"/>`);
    const pk = [W * (0.3 + r() * 0.4), H * 0.12];
    for (let k = 1; k < 12; k++) o.push(`<path d="${blob(pk[0], pk[1], k * 34, k * 26, 10, 0.06)}" fill="none" stroke="${dark ? '#24402d' : '#b3d1a4'}" stroke-width="${k % 4 ? 1 : 1.8}"/>`);
    o.push(fill(blob(W * 0.5, H * 0.92, W * 0.48, H * 0.22, 10, 0.15), c.land), fill(blob(W * 0.5, H * 0.95, W * 0.3, H * 0.14, 9, 0.2), c.built));
    o.push(fill(blob(pk[0] + (mirror ? 90 : -90), H * 0.42, 40, 24, 8, 0.2), c.water));
    const sx = W * (0.3 + r() * 0.2), z = [[sx, H * 1.05], [sx + 10, H * 0.86]];
    for (let k = 0; k < 4; k++) { const y = H * (0.78 - k * 0.15), L = 70 + r() * 50, dir = k % 2 ? -1 : 1; z.push([sx + dir * L, y], [sx + dir * (L + 12), y - 14], [sx + dir * (L - 2), y - 30]); }
    z.push([pk[0], pk[1] + 40]);
    o.push(big(curve(z), 4));
    o.push(way(curve([[sx + 10, H * 0.86], [W * 0.8, H * 0.7], [X1, H * 0.62]]), 2.6));
    for (let k = 0; k < 6; k++) o.push(way(`M${f(W * (0.25 + k * 0.1))} ${f(H * 0.86)}L${f(W * (0.22 + k * 0.11))} ${f(H * 1.05)}`, 2.4));
    o.push(way(curve([[W * 0.15, H * 0.92], [W * 0.5, H * 0.88], [W * 0.85, H * 0.93]]), 3));
  } else if (kind === 'canals') { // 운하: 반원 운하 겹겹, 운하 따라 길, 바퀴살 골목, 위쪽 큰 물
    const cx = W * (0.5 + (r() - 0.5) * 0.2), cy = H * 0.05;
    o.push(fill(blob(cx, cy + 120, W * 0.7, H * 0.7, 12, 0.06), c.built));
    o.push(fill(`M${X0} ${Y0}H${X1}V${f(cy + 10)}${curve([[X1, cy + 10], [cx + 120, cy + 30], [cx - 120, cy + 30], [X0, cy + 10]]).replace('M', 'L')}Z`, c.water));
    for (let k = 0; k < 9; k++) { const a = Math.PI * (0.1 + k * 0.1); o.push(way(`M${f(cx + Math.cos(a) * 60)} ${f(cy + Math.sin(a) * 60)}L${f(cx + Math.cos(a) * S)} ${f(cy + Math.sin(a) * S)}`, 2.4)); }
    for (const rr of [110, 170, 230, 300]) { o.push(way(`M${f(cx - rr - 9)} ${f(cy)}A${rr + 9} ${rr + 9} 0 0 0 ${f(cx + rr + 9)} ${f(cy)}`, 2.2), way(`M${f(cx - rr + 9)} ${f(cy)}A${rr - 9} ${rr - 9} 0 0 0 ${f(cx + rr - 9)} ${f(cy)}`, 2.2), `<path d="M${f(cx - rr)} ${f(cy)}A${rr} ${rr} 0 0 0 ${f(cx + rr)} ${f(cy)}" fill="none" stroke="${c.water}" stroke-width="9"/>`); }
    for (let k = 0; k < 4; k++) { const a = Math.PI * (0.25 + k * 0.17); o.push(big(`M${f(cx + Math.cos(a) * 40)} ${f(cy + Math.sin(a) * 40)}L${f(cx + Math.cos(a) * S)} ${f(cy + Math.sin(a) * S)}`, 4.5)); }
    o.push(fill(blob(cx + 140, cy + 380, 60, 40, 8, 0.2), c.park));
  } else if (kind === 'octagon') { // 사선 바둑판: 비스듬한 칸(모서리를 깎은 블록), 큰 사선 대로, 아래 바다와 모래
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.road}"/>`);
    const g = 30, a = 45 * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    for (let i = -16; i < 16; i++) for (let j = -16; j < 16; j++) { const u = i * g, v = j * g, x = W / 2 + u * ca - v * sa, y = H / 2 + u * sa + v * ca; if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue; o.push(`<rect x="${f(x - 12.5)}" y="${f(y - 12.5)}" width="25" height="25" rx="5.5" fill="${(i * 7 + j * 3) % 23 === 0 ? c.park : c.built}" stroke="${c.edge}" stroke-width="0.6" transform="rotate(45 ${f(x)} ${f(y)})"/>`); }
    o.push(big(`M${X0} ${f(H * 0.42)}L${X1} ${f(H * 0.3)}`, 6), big(`M${f(W * 0.1)} ${Y0}L${f(W * 0.9)} ${Y1}`, 6));
    const sea = [[X0, H * 0.86], [W * 0.5, H * 0.8], [X1, H * 0.74]];
    o.push(fill(`${curve(sea.map(([x, y]) => [x, y - 12]))}L${X1} ${Y1}L${X0} ${Y1}Z`, c.sand), fill(`${curve(sea)}L${X1} ${Y1}L${X0} ${Y1}Z`, c.water));
  } else if (kind === 'suburb') { // 교외: 구불구불한 고리길과 막다른 길, 큰 공원(골프장), 휘는 고속도로
    o.push(fill(blob(W * 0.3, H * 0.3, 110, 80, 9, 0.2), c.park), fill(blob(W * 0.8, H * 0.75, 90, 120, 9, 0.2), c.forest));
    for (let k = 0; k < 9; k++) { const cx = W * (0.15 + (k % 3) * 0.35) + (r() - 0.5) * 40, cy = H * (0.15 + Math.floor(k / 3) * 0.33) + (r() - 0.5) * 30; o.push(fill(blob(cx, cy, 50, 34, 12, 0.22), c.built), way(blob(cx, cy, 40, 26, 12, 0.22), 2.6)); for (let q = 0; q < 10; q++) { const a = q / 10 * 6.283, hx = cx + Math.cos(a) * 50, hy = cy + Math.sin(a) * 33; o.push(`<rect x="${f(hx - 4)}" y="${f(hy - 3)}" width="8" height="6" rx="1" fill="${c.edge}" transform="rotate(${Math.round(a * 57)} ${f(hx)} ${f(hy)})"/>`); } for (let q = 0; q < 3; q++) { const a = r() * 6.283; o.push(way(`M${f(cx + Math.cos(a) * 34)} ${f(cy + Math.sin(a) * 22)}L${f(cx + Math.cos(a) * 12)} ${f(cy + Math.sin(a) * 8)}`, 2.4), `<circle cx="${f(cx + Math.cos(a) * 12)}" cy="${f(cy + Math.sin(a) * 8)}" r="4.5" fill="${c.road}" stroke="${c.edge}"/>`); } }
    o.push(way(curve([[X0, H * 0.48], [W * 0.3, H * 0.5], [W * 0.55, H * 0.42], [X1, H * 0.5]]), 3.6), way(curve([[W * 0.5, Y0], [W * 0.46, H * 0.4], [W * 0.55, H * 0.7], [W * 0.5, Y1]]), 3.6));
    o.push(big(curve([[X0, H * 0.95], [W * 0.4, H * 0.8], [W * 0.75, H * 0.35], [X1, H * 0.05]]), 8));
  } else if (kind === 'confluence') { // 두 강이 만나는 곳: 넓은 강 두 줄기가 합쳐지고, 사이 반도엔 촘촘한 옛 동네와 끝자락 공원, 양쪽 강변은 결이 다른 바둑판, 다리 여럿
    const m = [W * (0.46 + r() * 0.1), H * (0.56 + r() * 0.06)];
    const r1 = [[X0, H * (0.12 + r() * 0.1)], [W * 0.12, H * 0.2], [W * 0.3, H * 0.4], m];
    const r2 = [[W * (0.74 + r() * 0.1), Y0], [W * 0.72, H * 0.12], [W * 0.62, H * 0.36], m];
    const mg = [m, [W * 0.52, H * 0.78], [W * 0.6, H * 0.98], [W * 0.56, Y1]];
    const A = [...r1, ...mg.slice(1)], B = [...r2, ...mg.slice(1)], P = [...r1, ...r2.slice(0, -1).reverse()];
    o.push(grid(`${curve(A)}L${X0} ${Y1}Z`, 12 + r() * 10, W * 0.2, H * 0.7, 30, 24));
    o.push(grid(`${curve(B)}L${X1} ${Y1}L${X1} ${Y0}Z`, -20 - r() * 12, W * 0.8, H * 0.6, 36, 26));
    o.push(grid(`${curve(P)}L${X0} ${Y0}Z`, Math.atan2(m[1] - H * 0.1, m[0] - W * 0.4) * 57.3, W * 0.4, H * 0.2, 18, 22, 2));
    o.push(fill(blob(m[0] - 18, m[1] - 34, 34, 22, 8, 0.15), c.park));
    for (const [pts, w] of [[A, 30], [B, 26], [mg, 44]]) o.push(`<path d="${curve(pts)}" fill="none" stroke="${c.water}" stroke-width="${w}" stroke-linecap="round"/>`);
    const bridge = (p, at, q, w = 4.2) => { const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), nx = -dy / L * 26, ny = dx / L * 26; return way(`M${f(at[0] - nx)} ${f(at[1] - ny)}L${f(at[0] + nx)} ${f(at[1] + ny)}`, w); };
    o.push(bridge(r1[0], r1[1], r1[2]), bridge(r1[1], r1[2], r1[3]), bridge(r2[0], r2[1], r2[2]), bridge(r2[1], r2[2], r2[3]), bridge(mg[1], mg[2], mg[3], 5));
    o.push(big(curve([[X0, H * 0.74], [W * 0.3, H * 0.7], [mg[1][0], mg[1][1]], [W * 0.8, H * 0.74], [X1, H * 0.68]]), 5.5));
    o.push(big(curve(r2.slice(0, 3).map(([x, y]) => [x + 30, y + 6]).concat([[mg[2][0] + 40, mg[2][1]], [mg[3][0] + 40, Y1]])), 4.8));
  } else if (kind === 'walled') { // 성곽 도시: 별 모양 성벽과 해자, 안은 구불길, 밖은 반듯한 새 동네
    for (let k = 0; k < 10; k++) o.push(way(`M${X0} ${f(H * (k * 0.12 - 0.05))}L${X1} ${f(H * (k * 0.12 + 0.05))}`, 2.4), way(`M${f(W * (k * 0.13 - 0.05))} ${Y0}L${f(W * (k * 0.13 + 0.03))} ${Y1}`, 2.4));
    const cx = W * (0.45 + r() * 0.1), cy = H * (0.45 + r() * 0.08), n = 6, star = []; for (let k = 0; k < n * 2; k++) { const a = k / (n * 2) * 6.283 + 0.2, rr = k % 2 ? 120 : 160; star.push(`${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr * 0.86)}`); }
    o.push(`<path d="M${star.join('L')}Z" fill="${c.water}" stroke="${c.water}" stroke-width="22" stroke-linejoin="round"/>`, `<path d="M${star.join('L')}Z" fill="${c.built}" stroke="${c.wall}" stroke-width="7" stroke-linejoin="miter"/>`);
    for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283 + r(); o.push(way(curve([[cx, cy], [cx + Math.cos(a + 0.4) * 50, cy + Math.sin(a + 0.4) * 40], [cx + Math.cos(a) * 110, cy + Math.sin(a) * 92]]), 2.2)); }
    o.push(`<rect x="${f(cx - 16)}" y="${f(cy - 12)}" width="32" height="24" rx="3" fill="${c.plaza}" stroke="${c.edge}"/>`);
    for (const k of [0, 4, 8]) { const a = k / 12 * 6.283 + 0.2; o.push(big(`M${f(cx + Math.cos(a) * 150)} ${f(cy + Math.sin(a) * 130)}L${f(cx + Math.cos(a) * S)} ${f(cy + Math.sin(a) * S)}`, 5)); }
  } else if (kind === 'hillPort') { // 계단식 언덕 항구: 바다에서 언덕으로 등고선 따라 겹겹이 휘는 길, 사이를 잇는 계단, 방파제와 부두
    const sea = [[X0, H * 0.78], [W * 0.35, H * 0.72], [W * 0.7, H * 0.8], [X1, H * 0.74]];
    o.push(fill(`${curve(sea.map(([x, y]) => [x, y - 300]))}L${X1} ${Y1}L${X0} ${Y1}Z`, c.built));
    for (let k = 0; k < 8; k++) { const dy = 24 + k * 30, wob = 14 + k * 3; o.push(way(curve(sea.map(([x, y], i) => [x, y - dy + (i % 2 ? -wob : wob) * 0.5])), k === 3 ? 3.6 : 2.4)); }
    for (let k = 0; k < 6; k++) { const x = W * (0.12 + k * 0.16) + (r() - 0.5) * 20; o.push(`<path d="M${f(x)} ${f(H * 0.72)}L${f(x + 14)} ${f(H * 0.1)}" stroke="${c.road}" stroke-width="2" stroke-dasharray="2 2.5"/>`); }
    o.push(fill(`${curve(sea.map(([x, y]) => [x, y - 7]))}L${X1} ${Y1}L${X0} ${Y1}Z`, c.sand), fill(`${curve(sea)}L${X1} ${Y1}L${X0} ${Y1}Z`, c.water));
    o.push(big(curve(sea.map(([x, y]) => [x, y - 14])), 5));
    const bx = W * (0.55 + r() * 0.2); o.push(`<path d="M${f(bx)} ${f(H * 0.78)}q40 30 90 18" fill="none" stroke="${c.wall}" stroke-width="6" stroke-linecap="round"/>`);
    for (let k = 0; k < 3; k++) o.push(`<rect x="${f(W * (0.2 + k * 0.12))}" y="${f(H * 0.74)}" width="8" height="30" rx="2" fill="${c.road}" stroke="${c.edge}"/>`);
  } else if (kind === 'fjordVillage') { // 피오르 마을: 가파른 초록 절벽 사이 긴 물길, 한쪽 물가에만 길 한 줄과 집들, 건너가는 배 점선
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.forest}"/>`);
    const fj = [[W * 0.62, Y0], [W * 0.56, H * 0.25], [W * 0.62, H * 0.55], [W * 0.54, H * 0.8], [W * 0.6, Y1]];
    for (let k = 1; k < 9; k++) for (const sd of [-1, 1]) o.push(`<path d="${curve(fj.map(([x, y]) => [x + sd * (40 + k * 16), y]))}" fill="none" stroke="${dark ? '#24402d' : '#acc99d'}" stroke-width="${k % 3 ? 0.9 : 1.6}"/>`);
    o.push(`<path d="${curve(fj.map(([x, y]) => [x - 52, y]))}" fill="none" stroke="${c.land}" stroke-width="40"/>`);
    o.push(`<path d="${curve(fj)}" fill="none" stroke="${c.sand}" stroke-width="66"/><path d="${curve(fj)}" fill="none" stroke="${c.water}" stroke-width="58"/>`);
    o.push(big(curve(fj.map(([x, y]) => [x - 44, y])), 4));
    for (let k = 0; k < 14; k++) { const t = 0.15 + k * 0.05, [x, y] = [fj[1][0] - 66 - (k % 2) * 14, H * t * 1.3]; o.push(`<rect x="${f(x)}" y="${f(y)}" width="11" height="8" rx="1.5" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.6"/>`); }
    o.push(`<path d="M${f(W * 0.5)} ${f(H * 0.5)}L${f(W * 0.72)} ${f(H * 0.42)}" stroke="${dark ? '#8fb0d6' : '#5c87bf'}" stroke-width="1.6" stroke-dasharray="4 4"/>`);
    o.push(way(curve([[W * 0.08, H * 0.3], [W * 0.25, H * 0.42], [fj[1][0] - 44, H * 0.48]]), 2.4));
  } else if (kind === 'canalGrid') { // 운하 바둑판: 반듯한 길, 세 줄마다 길 대신 운하, 운하마다 작은 다리
    const cw = 40 + r() * 8, ch = 28;
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.built}"/>`);
    for (let x = -cw * 3; x < W + cw * 3; x += cw) o.push(way(`M${f(x)} ${Y0}V${Y1}`, 2.4));
    for (let y = -ch * 3, k = 0; y < H + ch * 3; y += ch, k++) o.push(k % 3 === 0 ? `<path d="M${X0} ${f(y)}H${X1}" stroke="${c.water}" stroke-width="10"/>` : way(`M${X0} ${f(y)}H${X1}`, 2.2));
    for (let y = -ch * 3, k = 0; y < H + ch * 3; y += ch, k++) if (k % 3 === 0) for (let x = -cw * 3; x < W + cw * 3; x += cw) o.push(`<rect x="${f(x - 3)}" y="${f(y - 7)}" width="6" height="14" fill="${c.road}" stroke="${c.edge}" stroke-width="0.6"/>`);
    o.push(`<path d="${curve([[X0, H * 0.1], [W * 0.5, H * 0.04], [X1, H * 0.12]])}" fill="none" stroke="${c.water}" stroke-width="34"/>`, big(`M${f(W * (0.3 + r() * 0.3))} ${Y0}V${Y1}`, 5));
  } else if (kind === 'deltaCity') { // 삼각주 도시: 강이 부채꼴로 넓어져 바다로, 그 사이 길쭉한 섬 넷에 저마다 바둑판, 끝자락 습지와 모래톱, 섬을 꿰는 큰길
    const ap = [W * (0.4 + r() * 0.2), H * 0.08], sea = H * 0.82;
    o.push(grid(`M${X0} ${Y0}H${X1}V${Y1}H${X0}Z`, (r() - 0.5) * 20, W * 0.5, H * 0.4, 32, 26));
    const L = [[ap[0] - 16, Y0], [ap[0] - 18, ap[1]], [ap[0] - 70, H * 0.4], [W * 0.02, sea]], Rb = [[ap[0] + 16, Y0], [ap[0] + 18, ap[1]], [ap[0] + 80, H * 0.42], [W * 0.98, sea]];
    o.push(fill(`${curve(L)}L${X0} ${f(sea)}L${X0} ${Y1}L${X1} ${Y1}L${X1} ${f(sea)}${curve([...Rb].reverse()).replace('M', 'L')}Z`, c.water));
    o.push(fill(`${curve([[X0, sea - 6], [W * 0.5, sea + 10], [X1, sea - 8]])}L${X1} ${Y1}L${X0} ${Y1}Z`, c.water));
    for (let i = 0; i < 4; i++) { const u = (i + 0.5) / 4 - 0.5, top = [ap[0] + u * 50, ap[1] + 60 + Math.abs(u) * 50], bot = [ap[0] + u * W * 1.15 + (W * 0.5 - ap[0]) * 0.6, sea + 8], hw = W * 0.12;
      const mid = [(top[0] + bot[0]) / 2, (top[1] + bot[1]) / 2], ax = Math.atan2(bot[1] - top[1], bot[0] - top[0]) * 57.3 - 90;
      const isl = curve([[top[0] - 8, top[1] + 4], [top[0], top[1] - 4], [top[0] + 8, top[1] + 4], [mid[0] + hw * 0.75, mid[1]], [bot[0] + hw, bot[1] - 10], [bot[0], bot[1] + 6], [bot[0] - hw, bot[1] - 10], [mid[0] - hw * 0.75, mid[1]]], true);
      o.push(grid(isl, ax, mid[0], mid[1], 18 + r() * 6, 20 + r() * 6, 2));
      o.push(fill(blob(bot[0], bot[1] - 6, hw * 0.8, 9, 7, 0.2), c.park), fill(blob(top[0], top[1] + 14, 9, 14, 6, 0.15), c.park)); }
    for (let k = 0; k < 4; k++) o.push(fill(blob(W * (0.12 + k * 0.25 + r() * 0.06), sea + 26 + r() * 20, 22 + r() * 12, 5, 7, 0.25), c.sand));
    o.push(big(curve([[X0, H * 0.5], [W * 0.3, H * 0.55], [W * 0.7, H * 0.52], [X1, H * 0.46]]), 5.5), big(`M${f(ap[0] + 60)} ${Y0}L${f(ap[0] + 40)} ${f(H * 0.3)}L${X1} ${f(H * 0.26)}`, 4.6));
  } else if (kind === 'oasis') { // 사막 오아시스: 모래 언덕 물결, 야자수 숲에 둘러싸인 작은 호수, 그 옆 촘촘한 마을, 곧은 사막 도로
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.sand}"/>`);
    for (let k = 0; k < 12; k++) { const y = H * (k * 0.1 - 0.05); o.push(`<path d="${curve([[X0, y], [W * 0.25, y - 14], [W * 0.5, y + 8], [W * 0.75, y - 12], [X1, y + 4]])}" fill="none" stroke="${dark ? '#3e3829' : '#e6d29f'}" stroke-width="${k % 3 ? 1 : 1.8}"/>`); }
    const lx = W * (0.35 + r() * 0.3), ly = H * 0.5;
    o.push(fill(blob(lx, ly, 120, 90, 11, 0.2), c.park), fill(blob(lx, ly, 46, 32, 9, 0.2), c.water));
    for (let k = 0; k < 18; k++) { const a = k / 18 * 6.283, d = 60 + r() * 40; o.push(`<circle cx="${f(lx + Math.cos(a) * d)}" cy="${f(ly + Math.sin(a) * d * 0.75)}" r="${f(4 + r() * 3)}" fill="${c.forest}"/>`); }
    const tx = lx + 90, ty = ly - 40; o.push(fill(blob(tx, ty, 70, 50, 9, 0.2), c.built));
    for (let k = 0; k < 16; k++) { const a = r() * 6.283, L = 20 + r() * 50; o.push(way(`M${f(tx)} ${f(ty)}l${f(Math.cos(a) * L)} ${f(Math.sin(a) * L * 0.7)}`, 1.6)); }
    o.push(big(`M${X0} ${f(H * 0.82)}L${X1} ${f(H * 0.7)}`, 5), way(curve([[tx, ty], [tx + 30, H * 0.65], [tx + 40, H * 0.74]]), 2.6));
  } else if (kind === 'farmVillage') { // 논밭 사이 마을: 기울어진 밭 조각보, 밭두렁 길, 한 줄 마을, 개울
    for (let i = -3; i < 9; i++) for (let j = -3; j < 9; j++) { const x = i * 64 + (j % 2) * 18, y = j * 52; o.push(`<rect x="${x}" y="${y}" width="${f(60 + r() * 6)}" height="48" rx="2" fill="${[c.park, dark ? '#2b2c22' : '#ece6c5', dark ? '#23302a' : '#dfe9cf', dark ? '#2e2a22' : '#f1e4c9'][Math.floor(r() * 4)]}" transform="rotate(${Math.round(r() * 8 - 4)} ${x} ${y})"/>`); }
    for (let k = 0; k < 7; k++) o.push(`<path d="M${X0} ${f(H * (k * 0.16))}L${X1} ${f(H * (k * 0.16 + 0.05))}" stroke="${c.road}" stroke-width="1.4" opacity=".8"/>`);
    o.push(`<path d="${curve([[W * 0.2, Y0], [W * 0.3, H * 0.4], [W * 0.18, H * 0.7], [W * 0.28, Y1]])}" fill="none" stroke="${c.water}" stroke-width="8"/>`);
    const vy = H * (0.45 + r() * 0.1); o.push(big(curve([[X0, vy + 20], [W * 0.5, vy], [X1, vy + 24]]), 4.5));
    for (let k = 0; k < 18; k++) { const x = W * (0.34 + k * 0.028), y = vy + (k % 2 ? -14 : 9) + (r() - 0.5) * 4; o.push(`<rect x="${f(x)}" y="${f(y)}" width="10" height="8" rx="1.5" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.6"/>`); }
    o.push(`<rect x="${f(W * 0.52)}" y="${f(vy - 30)}" width="14" height="12" rx="2" fill="${c.wall}"/>`);
  } else if (kind === 'medina') { // 성벽 안 미로 골목: 네모난 성벽과 문 넷, 안은 촘촘한 꺾인 골목, 가운데 큰 광장
    const cx = W * 0.5, cy = H * 0.5, sw = W * 0.4, sh = H * 0.36;
    for (let k = 0; k < 8; k++) o.push(way(`M${X0} ${f(H * k * 0.18)}L${X1} ${f(H * (k * 0.18 + 0.06))}`, 2.4));
    o.push(`<rect x="${f(cx - sw)}" y="${f(cy - sh)}" width="${f(sw * 2)}" height="${f(sh * 2)}" rx="8" fill="${c.built}" stroke="${c.wall}" stroke-width="6"/>`);
    for (let k = 0; k < 60; k++) { let x = cx - sw + 10 + r() * (sw * 2 - 20), y = cy - sh + 10 + r() * (sh * 2 - 20); let d = `M${f(x)} ${f(y)}`; for (let q = 0; q < 3; q++) { if (r() < 0.5) x = Math.max(cx - sw + 6, Math.min(cx + sw - 6, x + (r() - 0.5) * 50)); else y = Math.max(cy - sh + 6, Math.min(cy + sh - 6, y + (r() - 0.5) * 40)); d += `L${f(x)} ${f(y)}`; } o.push(`<path d="${d}" fill="none" stroke="${c.road}" stroke-width="1.6" stroke-linejoin="round"/>`); }
    o.push(`<rect x="${f(cx - 30)}" y="${f(cy - 20)}" width="60" height="40" rx="3" fill="${c.plaza}" stroke="${c.edge}"/>`);
    for (const [gx, gy] of [[cx, cy - sh], [cx, cy + sh], [cx - sw, cy], [cx + sw, cy]]) o.push(`<rect x="${f(gx - 8)}" y="${f(gy - 8)}" width="16" height="16" rx="2" fill="${c.major}" stroke="${c.majorEdge}"/>`);
    o.push(big(`M${f(cx)} ${Y0}V${f(cy - sh)}M${f(cx)} ${f(cy + sh)}V${Y1}`, 4.5), big(`M${X0} ${f(cy)}H${f(cx - sw)}M${f(cx + sw)} ${f(cy)}H${X1}`, 4.5));
  } else if (kind === 'lakeResort') { // 호숫가 휴양지: 가운데 큰 호수, 호수를 따라 도는 산책길과 도시, 선착장, 배 점선
    const lx = W * (0.45 + r() * 0.1), ly = H * 0.52, lake = blob(lx, ly, W * 0.32, H * 0.3, 12, 0.14);
    o.push(fill(blob(lx, ly, W * 0.62, H * 0.56, 12, 0.08), c.built));
    for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283; o.push(way(`M${f(lx + Math.cos(a) * W * 0.34)} ${f(ly + Math.sin(a) * H * 0.32)}L${f(lx + Math.cos(a) * W * 0.8)} ${f(ly + Math.sin(a) * H * 0.8)}`, 2.4)); }
    for (const q of [0.48, 0.62]) o.push(way(blob(lx, ly, W * q, H * q * 0.9, 12, 0.06), 2.6));
    o.push(fill(blob(lx, ly, W * 0.36, H * 0.34, 12, 0.14), c.park), fill(lake, c.water));
    o.push(big(blob(lx, ly, W * 0.37, H * 0.35, 12, 0.1), 4));
    o.push(`<path d="M${f(lx - 60)} ${f(ly + 20)}Q${f(lx)} ${f(ly - 40)} ${f(lx + 70)} ${f(ly + 10)}" fill="none" stroke="${dark ? '#8fb0d6' : '#5c87bf'}" stroke-width="1.6" stroke-dasharray="4 4"/>`);
    for (const a of [0.6, 2.4, 4.2]) o.push(`<path d="M${f(lx + Math.cos(a) * W * 0.3)} ${f(ly + Math.sin(a) * H * 0.28)}l${f(Math.cos(a) * -18)} ${f(Math.sin(a) * -14)}" stroke="${c.road}" stroke-width="4.5" stroke-linecap="round"/>`);
  } else if (kind === 'riverIslands') { // 강 가운데 섬: 크게 휘는 넓은 강, 끝이 뾰족한 섬 둘(촘촘한 옛 골목 · 성당 광장 · 끝자락 공원), 나무 줄 선 강변길, 섬을 꿰는 다리
    const rv = [[X0, H * (0.42 + r() * 0.08)], [W * 0.1, H * 0.46], [W * 0.38, H * (0.4 + r() * 0.06)], [W * 0.66, H * 0.54], [W * 0.92, H * 0.46], [X1, H * 0.5]];
    o.push(grid(`${curve(rv)}L${X1} ${Y0}L${X0} ${Y0}Z`, 8 + r() * 14, W * 0.5, H * 0.2, 32, 24));
    o.push(grid(`${curve(rv)}L${X1} ${Y1}L${X0} ${Y1}Z`, -10 - r() * 14, W * 0.5, H * 0.8, 28, 34));
    o.push(`<path d="${curve(rv)}" fill="none" stroke="${c.park}" stroke-width="92"/>`);
    for (const sd of [-1, 1]) o.push(`<path d="${curve(rv.map(([x, y]) => [x, y + sd * 40]))}" fill="none" stroke="${c.forest}" stroke-width="3" stroke-dasharray="0.1 9" stroke-linecap="round"/>`);
    o.push(`<path d="${curve(rv)}" fill="none" stroke="${c.water}" stroke-width="66"/>`);
    const dirAt = i => Math.atan2(rv[i + 1][1] - rv[i - 1][1], rv[i + 1][0] - rv[i - 1][0]);
    const isl = (i, L, h) => { const [x, y] = rv[i], a = dirAt(i), q = ([u, v]) => [x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a)];
      const d = curve([[-L, 0], [-L * 0.5, -h], [L * 0.35, -h * 0.95], [L, 0], [L * 0.35, h * 0.9], [-L * 0.5, h]].map(q), true);
      o.push(grid(d, a * 57.3, x, y, 15, 12, 1.8), fill(curve([[L * 0.55, -h * 0.7], [L, 0], [L * 0.55, h * 0.7], [L * 0.45, 0]].map(q), true), c.park));
      return { q, a }; };
    const I1 = isl(2, 78, 17), I2 = isl(3, 50, 13);
    { const [px, py] = I1.q([-20, -2]); o.push(`<rect x="${f(px - 15)}" y="${f(py - 8)}" width="30" height="16" rx="2" fill="${c.plaza}" stroke="${c.edge}" transform="rotate(${f(I1.a * 57.3)} ${f(px)} ${f(py)})"/><circle cx="${f(px + 4)}" cy="${f(py)}" r="4" fill="${c.wall}"/>`); }
    const bridge = (x, y, a, len = 46, w = 4.4) => way(`M${f(x - Math.sin(a) * len)} ${f(y + Math.cos(a) * len)}L${f(x + Math.sin(a) * len)} ${f(y - Math.cos(a) * len)}`, w);
    for (const [i, u] of [[2, 0.5], [2, -0.35], [3, 0.25], [4, 0]]) { const [x, y] = i === 4 ? rv[4] : (i === 2 ? I1 : I2).q([u * (i === 2 ? 78 : 50), 0]); o.push(bridge(x, y, dirAt(i))); }
    for (const t of [0.5]) { const x = (rv[1][0] + rv[2][0]) * t, y = (rv[1][1] + rv[2][1]) * t; o.push(bridge(x, y, Math.atan2(rv[2][1] - rv[1][1], rv[2][0] - rv[1][0]))); }
    o.push(big(curve(rv.map(([x, y]) => [x, y - 40])), 4.8), way(curve(rv.map(([x, y]) => [x, y + 40])), 3.6));
    { const [x, y] = I1.q([0, 0]), a = dirAt(2); o.push(big(`M${f(x - Math.sin(a) * 600)} ${f(y + Math.cos(a) * 600)}L${f(x + Math.sin(a) * 600)} ${f(y - Math.cos(a) * 600)}`, 5)); }
  } else if (kind === 'collegeTown') { // 대학 도시: 굽은 큰길을 따라 늘어선 네모 마당 건물들, 둥근 도서관, 강가 넓은 풀밭, 나머지는 구불한 골목 동네
    const hs = [[X0, H * 0.46], [W * 0.25, H * (0.42 + r() * 0.06)], [W * 0.55, H * 0.5], [W * 0.8, H * (0.4 + r() * 0.06)], [X1, H * 0.44]];
    o.push(grid(`M${X0} ${Y0}H${X1}V${Y1}H${X0}Z`, 6 + r() * 8, W * 0.5, H * 0.5, 34, 28, 2.2));
    const rv = [[W * 0.86, Y0], [W * 0.8, H * 0.3], [W * 0.88, H * 0.62], [W * 0.82, Y1]];
    o.push(fill(`${curve(rv.map(([x, y]) => [x - 90, y]))}L${X1} ${Y1}L${X1} ${Y0}Z`, c.park));
    for (let k = 0; k < 5; k++) o.push(`<path d="${curve(rv.map(([x, y], j) => [x - 30 - k * 14 + (j % 2) * 8, y]))}" fill="none" stroke="${c.road}" stroke-width="1.4" opacity=".7"/>`);
    o.push(`<path d="${curve(rv)}" fill="none" stroke="${c.water}" stroke-width="22"/>`, fill(`${curve(rv.map(([x, y]) => [x + 11, y]))}L${X1} ${Y1}L${X1} ${Y0}Z`, c.water));
    const quad = (x, y, w, h, two) => { let s = `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${c.park}" stroke="${c.bld}" stroke-width="7"/><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="none" stroke="${c.edge}" stroke-width="1" transform="translate(-3.5 -3.5) scale(1)" opacity="0"/>`;
      if (two) s += `<rect x="${f(x + w)}" y="${f(y + h * 0.2)}" width="${f(w * 0.6)}" height="${f(h * 0.6)}" fill="${c.park}" stroke="${c.bld}" stroke-width="7"/>`; return s + `<circle cx="${f(x + w / 2)}" cy="${f(y + h / 2)}" r="2.4" fill="${c.forest}"/>`; };
    const at = t => { const i = Math.min(3, Math.floor(t * 4)), u = t * 4 - i; return [hs[i][0] + (hs[i + 1][0] - hs[i][0]) * u, hs[i][1] + (hs[i + 1][1] - hs[i][1]) * u]; };
    o.push(fill(blob(W * 0.45, H * 0.48, W * 0.36, H * 0.3, 10, 0.12), c.plaza));
    [0.3, 0.42, 0.52, 0.62, 0.72].forEach((t, k) => { const [x, y] = at(t), w = 34 + r() * 18, h = 28 + r() * 14, up = k % 2 === 0; o.push(quad(x - w / 2, up ? y - h - 14 : y + 14, w, h, k === 2)); });
    { const [x, y] = at(0.5); o.push(quad(x - 120, y - 90, 44, 34, true), quad(x + 34, y + 70, 50, 30, false)); }
    { const [x, y] = at(0.37); o.push(`<circle cx="${f(x + 8)}" cy="${f(y + 46)}" r="15" fill="${c.bld}" stroke="${c.edge}"/><circle cx="${f(x + 8)}" cy="${f(y + 46)}" r="6" fill="${c.plaza}"/>`); }
    o.push(big(curve(hs), 5.5), way(curve([[W * 0.3, Y0], [W * 0.34, H * 0.3], at(0.4), [W * 0.38, H * 0.8], [W * 0.3, Y1]]), 4.2));
  } else if (kind === 'alpineValley') { // 알프스 골짜기: 양쪽 비탈 숲과 눈 덮인 봉우리, 옆 골짜기로 꺾이는 등고선, 자갈밭 낀 갈래 강, 골짜기 바닥 마을과 철길, 갈지자 산길, 케이블카
    const vy = H * (0.52 + (r() - 0.5) * 0.08), side = [W * (0.25 + r() * 0.1), W * (0.7 + r() * 0.1)];
    const fl = sd => [[X0, vy + sd * 54], [W * 0.2, vy + sd * (46 + r() * 14)], [W * 0.5, vy + sd * 58], [W * 0.8, vy + sd * (44 + r() * 14)], [X1, vy + sd * 52]];
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.park}"/>`);
    for (const [x, y, rx, ry] of [[W * 0.12, vy - 120, 90, 50], [W * 0.62, vy - 100, 120, 40], [W * 0.3, vy + 110, 110, 46], [W * 0.88, vy + 120, 80, 60]]) o.push(fill(blob(x, y, rx, ry, 9, 0.25), c.forest));
    for (const [x, sd] of [[W * 0.45, -1], [W * 0.95, -1], [W * 0.05, 1]]) o.push(fill(blob(x, vy + sd * 215, 110, 90, 9, 0.2), c.road), fill(blob(x, vy + sd * 215, 60, 46, 8, 0.2), c.land));
    const cont = (sd, k) => curve(Array.from({ length: 14 }, (_, j) => { const x = X0 + j * (X1 - X0) / 13, sx = side[sd < 0 ? 0 : 1], v = Math.max(0, 1 - Math.abs(x - sx) / (40 + k * 10)); return [x, vy + sd * (66 + k * 22) + sd * v * (30 + k * 6) + Math.sin(j * 1.3 + k) * 4]; }));
    for (let k = 0; k < 11; k++) for (const sd of [-1, 1]) o.push(`<path d="${cont(sd, k)}" fill="none" stroke="${dark ? '#2e4a37' : '#b5cfa6'}" stroke-width="${k % 4 === 3 ? 1.6 : 0.9}"/>`);
    for (const [sd, sx] of [[-1, side[0]], [1, side[1]]]) o.push(`<path d="${curve([[sx + 6, vy + sd * 300], [sx - 4, vy + sd * 150], [sx + 2, vy + sd * 40]])}" fill="none" stroke="${c.water}" stroke-width="3"/>`);
    o.push(fill(`${curve(fl(-1))}L${X1} ${f(vy + 52)}${curve([...fl(1)].reverse()).replace('M', 'L')}Z`, c.land));
    o.push(`<path d="${curve([[X0, vy + 12], [W * 0.3, vy + 4], [W * 0.6, vy + 18], [X1, vy + 8]])}" fill="none" stroke="${c.sand}" stroke-width="22"/>`);
    for (const dy of [-4, 5]) o.push(`<path d="${curve([[X0, vy + 12 + dy], [W * 0.3, vy + 4 - dy], [W * 0.6, vy + 18 + dy], [X1, vy + 8 - dy]])}" fill="none" stroke="${c.water}" stroke-width="${dy > 0 ? 6 : 4}"/>`);
    const cx = W * (0.45 + r() * 0.15), tw = blob(cx, vy - 22, 100, 26, 10, 0.12);
    o.push(grid(tw, -4, cx, vy - 22, 22, 14, 2), `<rect x="${f(cx - 9)}" y="${f(vy - 32)}" width="18" height="12" rx="2" fill="${c.plaza}" stroke="${c.edge}"/><circle cx="${f(cx)}" cy="${f(vy - 26)}" r="3" fill="${c.wall}"/>`);
    o.push(rail(curve([[X0, vy + 36], [W * 0.4, vy + 30], [W * 0.7, vy + 40], [X1, vy + 32]])));
    o.push(big(curve([[X0, vy - 46], [W * 0.3, vy - 42], [cx, vy - 46], [W * 0.75, vy - 40], [X1, vy - 44]]), 4.6));
    const zz = [[cx + 70, vy - 44]]; for (let k = 1; k <= 5; k++) zz.push([cx + 80 + (k % 2 ? 34 : -4), vy - 46 - k * 22]); zz.push([cx + 96, vy - 180]);
    o.push(way(curve(zz), 3), `<rect x="${f(cx + 88)}" y="${f(vy - 188)}" width="16" height="12" rx="2" fill="${c.bld}" stroke="${c.edge}"/>`);
    const cb = [cx - 70, vy + 40], ce = [cx - 140, vy + 230], ln = dark ? '#aeb5c0' : '#6b717b';
    o.push(`<path d="M${f(cb[0])} ${f(cb[1])}L${f(ce[0])} ${f(ce[1])}" stroke="${ln}" stroke-width="1.3"/>`, ...[0.33, 0.66].map(t => `<rect x="${f(cb[0] + (ce[0] - cb[0]) * t - 2)}" y="${f(cb[1] + (ce[1] - cb[1]) * t - 2)}" width="4" height="4" fill="${ln}"/>`), ...[cb, ce].map(([x, y]) => `<rect x="${f(x - 6)}" y="${f(y - 4)}" width="12" height="8" rx="2" fill="${c.wall}"/>`));
  } else if (kind === 'hilltop') { // 언덕 꼭대기 마을: 등고선 언덕 위 성벽 두른 작은 마을, 비탈엔 등고선 따라 줄지은 포도밭, 갈지자 오르막길, 아래 골짜기 큰길
    const cx = W * (0.42 + r() * 0.16), cy = H * (0.36 + r() * 0.1);
    for (let k = 11; k >= 1; k--) o.push(`<ellipse cx="${f(cx)}" cy="${f(cy + k * 3)}" rx="${70 + k * 30}" ry="${54 + k * 24}" fill="none" stroke="${c.contour}" stroke-width="1.2"/>`);
    const vy = (a0, a1, r0, r1) => { const id = `${cidBase}_${nClip++}`, p = (a, rr) => `${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr * 0.8)}`;
      let rows = ''; for (let rr = r0; rr < r1; rr += 6) rows += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${rr}" ry="${f(rr * 0.8)}" fill="none" stroke="${c.park}" stroke-width="2.6"/>`;
      return `<clipPath id="${id}"><path d="M${p(a0, r0)}L${p(a0, r1)}L${p((a0 + a1) / 2, r1 * 1.08)}L${p(a1, r1)}L${p(a1, r0)}L${p((a0 + a1) / 2, r0 * 0.96)}Z"/></clipPath><g clip-path="url(#${id})"><rect x="${-S}" y="${-S}" width="${3 * S}" height="${3 * S}" fill="${c.vine}"/>${rows}</g>`; };
    const sects = [[-2.9, -1.9], [-1.6, -0.5], [-0.2, 0.9], [2.0, 2.9]];
    sects.forEach(([a0, a1], k) => o.push(vy(a0 + r() * 0.15, a1 - r() * 0.15, 112 + (k % 2) * 30, 200 + r() * 70)));
    o.push(fill(blob(cx - 250, cy + 170, 90, 50, 9, 0.2), c.forest), fill(blob(cx + 260, cy - 140, 80, 60, 9, 0.2), c.forest));
    const tw = blob(cx, cy, 82, 62, 10, 0.07);
    o.push(fill(tw, c.built), `<path d="${tw}" fill="none" stroke="${c.wall}" stroke-width="5"/>`);
    o.push(way(curve([[cx - 80, cy + 4], [cx - 30, cy - 10], [cx + 10, cy + 6], [cx + 80, cy - 6]]), 3));
    for (let k = 0; k < 6; k++) { const x = cx - 60 + k * 24 + (r() - 0.5) * 8; o.push(way(curve([[x, cy - 56], [x + (r() - 0.5) * 16, cy - 20], [x + (r() - 0.5) * 12, cy + 2]]), 2), way(curve([[x + 6, cy + 4], [x + (r() - 0.5) * 14, cy + 30], [x + 4, cy + 56]]), 2)); }
    o.push(`<rect x="${f(cx + 8)}" y="${f(cy - 26)}" width="28" height="20" rx="2" fill="${c.plaza}" stroke="${c.edge}"/><path d="M${f(cx + 14)} ${f(cy - 12)}h12v-7l-6-5l-6 5z" fill="${c.wall}"/>`);
    const zz = [[cx + 6, cy + 62]]; for (let k = 1; k <= 6; k++) zz.push([cx + (k % 2 ? 70 : -60) + k * 6, cy + 62 + k * 34]); zz.push([cx + 40, Y1]);
    o.push(big(curve(zz), 4.8));
    zz.slice(1, -1).forEach(([x, y]) => { for (let j = 0; j < 3; j++) o.push(`<circle cx="${f(x + (x > cx ? 14 : -14) + j * 0)}" cy="${f(y - 12 + j * 12)}" r="3.2" fill="${c.forest}"/>`); });
    o.push(big(curve([[X0, H * 0.94], [W * 0.3, H * 0.88], [W * 0.7, H * 0.97], [X1, H * 0.9]]), 5.5));
  } else if (kind === 'interchange') { // 신도시 나들목: 고속도로 둘이 엇갈리는 네잎 나들목, 큰 블록마다 큰 건물, 둥근 경기장, 연못 낀 공원, 막다른 골목 동네
    const cx = W * (0.4 + r() * 0.2), cy = H * (0.45 + r() * 0.12), ga = (r() - 0.5) * 0.4;
    o.push(grid(`M${X0} ${Y0}H${X1}V${Y1}H${X0}Z`, ga * 57.3, cx, cy, 72, 62, 3.4));
    const at = (u, v) => [cx + u * Math.cos(ga) - v * Math.sin(ga), cy + u * Math.sin(ga) + v * Math.cos(ga)];
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { if (!i || !j) continue; const [x, y] = at(i * 72 - 36, j * 62 - 31), k = (i * 7 + j * 3 + 40) % 5;
      if (k === 0) { for (let s = 0; s < 3; s++) o.push(`<rect x="${f(x - 26 + s * 18)}" y="${f(y - 18)}" width="12" height="${f(26 + (s % 2) * 8)}" rx="1.5" fill="${c.bld}" transform="rotate(${f(ga * 57.3)} ${f(x)} ${f(y)})"/>`); }
      else if (k === 2) o.push(`<rect x="${f(x - 24)}" y="${f(y - 18)}" width="48" height="30" rx="2" fill="${c.bld}" transform="rotate(${f(ga * 57.3)} ${f(x)} ${f(y)})"/>`);
      else if (k === 4) o.push(way(`M${f(x - 30)} ${f(y)}H${f(x + 6)}`, 2), `<circle cx="${f(x + 10)}" cy="${f(y)}" r="5" fill="${c.road}" stroke="${c.edge}"/>`, way(`M${f(x)} ${f(y - 24)}V${f(y - 6)}`, 2)); }
    { const [x, y] = at(-2 * 72 + 6, 2 * 62 - 10); o.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="52" ry="36" fill="${c.edge}"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="48" ry="32" fill="${c.bld}"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="32" ry="19" fill="${c.park}"/>`); }
    { const [x, y] = at(2 * 72 - 10, -2 * 62 + 14); o.push(fill(blob(x, y, 66, 46, 9, 0.12), c.park), fill(blob(x + 8, y + 4, 26, 16, 8, 0.2), c.water)); }
    const hw = (d, w = 9) => `<path d="${d}" fill="none" stroke="${c.majorEdge}" stroke-width="${w + 4}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c.major}" stroke-width="${w}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c.majorEdge}" stroke-width="0.8" opacity=".7"/>`;
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const [x, y] = at(sx * 30, sy * 30); o.push(`<circle cx="${f(x)}" cy="${f(y)}" r="22" fill="none" stroke="${c.majorEdge}" stroke-width="6.6"/><circle cx="${f(x)}" cy="${f(y)}" r="22" fill="${c.park}" stroke="${c.major}" stroke-width="4"/>`); }
    const e1 = at(-700, 0), e2 = at(700, 0), e3 = at(0, -700), e4 = at(0, 700);
    o.push(hw(`M${f(e1[0])} ${f(e1[1])}L${f(e2[0])} ${f(e2[1])}`), hw(`M${f(e3[0])} ${f(e3[1])}L${f(e4[0])} ${f(e4[1])}`));
  } else if (kind === 'portDocks') { // 컨테이너 항구: 바다로 뻗은 네모난 부두마다 컨테이너 줄과 크레인, 부두로 들어가는 철길, 뒤쪽 바둑판 동네, 등대 달린 방파제
    const sh = H * (0.5 + r() * 0.08);
    o.push(grid(`M${X0} ${Y0}H${X1}V${f(sh)}H${X0}Z`, (r() - 0.5) * 16, W * 0.5, H * 0.2, 30, 24));
    o.push(fill(`M${X0} ${f(sh)}H${X1}V${Y1}H${X0}Z`, c.water));
    o.push(`<rect x="${X0}" y="${f(sh - 34)}" width="${X1 - X0}" height="40" fill="${c.contour}"/>`);
    const tint = [c.bld, c.wall, c.plaza, c.sand];
    for (let k = 0; k < 4; k++) { const x = W * (0.02 + k * 0.25) + r() * 10, w = 58 + r() * 14, h = 96 + r() * 50;
      o.push(`<rect x="${f(x)}" y="${f(sh - 4)}" width="${f(w)}" height="${f(h)}" fill="${c.contour}"/>`);
      for (let row = 0; row < Math.floor(h / 13) - 1; row++) for (let col = 0; col < 3; col++) o.push(`<rect x="${f(x + 6 + col * (w - 12) / 3)}" y="${f(sh + 6 + row * 13)}" width="${f((w - 12) / 3 - 3)}" height="9" rx="1" fill="${tint[(row * 3 + col + k) % 4]}"/>`);
      for (let j = 0; j < 2; j++) { const cy = sh + 26 + j * 46; o.push(`<rect x="${f(x + w - 4)}" y="${f(cy - 6)}" width="12" height="12" rx="1.5" fill="none" stroke="${c.rail}" stroke-width="2"/><path d="M${f(x + w + 2)} ${f(cy)}h12" stroke="${c.rail}" stroke-width="2" stroke-linecap="round"/>`); }
      o.push(rail(`M${f(x + w / 2)} ${f(sh - 30)}V${f(sh - 6)}`)); }
    o.push(rail(`M${X0} ${f(sh - 24)}H${X1}`));
    const bw = [[W * 1.1, sh + 210], [W * 0.7, sh + 196], [W * 0.38, sh + 210]];
    o.push(`<path d="${curve(bw)}" fill="none" stroke="${c.contour}" stroke-width="8" stroke-linecap="round"/>`, `<circle cx="${f(bw[2][0])}" cy="${f(bw[2][1])}" r="6" fill="${c.road}" stroke="${c.wall}" stroke-width="3"/>`);
    o.push(big(`M${X0} ${f(sh - 44)}H${X1}`, 5.5), big(`M${f(W * 0.6)} ${Y0}L${f(W * 0.56)} ${f(sh - 44)}`, 4.6));
  } else if (kind === 'bigRiver') { // 큰 강 대도시: 아주 넓은 강, 양쪽 강변 공원 띠와 강변 고속도로, 줄지은 다리, 강 가운데 섬(이름 따라), 강 북쪽 산 공원, 양쪽 동네 결이 달라요
    const ry = H * (0.42 + r() * 0.16), amp = 20 + r() * 40, ph = r() * 6.283;
    const rv = Array.from({ length: 7 }, (_, k) => [X0 + k * (X1 - X0) / 6, ry + Math.sin(k * 0.9 + ph) * amp]);
    const yAt = x => { const t = (x - X0) / (X1 - X0) * 6, k = Math.min(5, Math.floor(t)), u = t - k; return rv[k][1] + (rv[k + 1][1] - rv[k][1]) * (3 * u * u - 2 * u * u * u); };
    const off = d => curve(rv.map(([x, y]) => [x, y + d]));
    o.push(grid(`${off(0)}L${X1} ${Y0}L${X0} ${Y0}Z`, (r() - 0.5) * 30, W * 0.5, ry - 120, 30 + r() * 8, 24 + r() * 6, 2.2, 6, 4.4));
    o.push(grid(`${off(0)}L${X1} ${Y1}L${X0} ${Y1}Z`, (r() - 0.5) * 30, W * 0.5, ry + 120, 34 + r() * 8, 28 + r() * 6, 2.2, 4, 4.4));
    { const mx = W * (0.15 + r() * 0.7), my = ry - 150 - r() * 30; o.push(fill(blob(mx, my, 90, 50, 10, 0.2), c.forest)); for (let k = 1; k <= 3; k++) o.push(`<path d="${blob(mx + 4, my + 2, 90 - k * 22, 50 - k * 12, 9, 0.1)}" fill="none" stroke="${c.park}" stroke-width="1.2"/>`); }
    o.push(`<path d="${off(0)}" fill="none" stroke="${c.park}" stroke-width="132"/>`);
    o.push(`<path d="${off(0)}" fill="none" stroke="${c.water}" stroke-width="96"/>`);
    if (r() < 0.6) { const ix = W * (0.25 + r() * 0.5), iy = yAt(ix) + 10, isl = blob(ix, iy, 64 + r() * 20, 15, 10, 0.08); o.push(fill(blob(ix, iy, 74 + r() * 10, 19, 10, 0.06), c.park), grid(isl, 0, ix, iy, 16, 10, 1.8)); }
    const nb = 2 + Math.floor(r() * 2);
    for (let k = 0; k < nb; k++) { const x = W * (k + 0.3 + r() * 0.4) / nb * 1.1 - W * 0.05, y = yAt(x), lean = (r() - 0.5) * 40; o.push(`<path d="M${f(x - lean)} ${f(y - 62)}L${f(x + lean)} ${f(y + 62)}" stroke="${c.edge}" stroke-width="8.6" stroke-linecap="butt"/><path d="M${f(x - lean)} ${f(y - 62)}L${f(x + lean)} ${f(y + 62)}" stroke="${c.road}" stroke-width="6"/>`); }
    o.push(big(off(-60), 6), big(off(60), 6));
  } else if (kind === 'apartments') { // 아파트 단지 신도시: 큰길로 나뉜 큰 블록마다 같은 쪽을 보는 긴 아파트 동, 단지 안 고리길 · 놀이터, 학교 운동장, 길가 상가, 사선으로 흐르는 하천과 둔치 공원
    const bw = 118 + r() * 30, bh = 100 + r() * 24, ga = (r() - 0.5) * 16, ox = r() * bw, oy = r() * bh;
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.land}"/>`);
    const blocks = [];
    for (let i = -3; i < W / bw + 3; i++) for (let j = -3; j < H / bh + 3; j++) blocks.push([i * bw - ox, j * bh - oy, (i * 31 + j * 17 + 100) % 7]);
    const B = [];
    for (const [x, y, t] of blocks) {
      const p = 9, w = bw - p * 2, h = bh - p * 2, cx = x + bw / 2, cy = y + bh / 2;
      if (t === 3) { B.push(`<rect x="${f(x + p)}" y="${f(y + p)}" width="${f(w)}" height="${f(h)}" rx="4" fill="${c.plaza}"/><rect x="${f(cx - w * 0.36)}" y="${f(cy - h * 0.3)}" width="${f(w * 0.46)}" height="${f(h * 0.6)}" rx="${f(h * 0.3)}" fill="${c.sand}" stroke="${c.road}" stroke-width="2"/><rect x="${f(cx + w * 0.16)}" y="${f(cy - h * 0.34)}" width="${f(w * 0.24)}" height="12" rx="1.5" fill="${c.bld}"/><rect x="${f(cx + w * 0.16)}" y="${f(cy - h * 0.34)}" width="12" height="${f(h * 0.6)}" rx="1.5" fill="${c.bld}"/>`); continue; }
      if (t === 5) { B.push(`<rect x="${f(x + p)}" y="${f(y + p)}" width="${f(w)}" height="${f(h)}" rx="4" fill="${c.park}"/>`, `<path d="M${f(x + p + 8)} ${f(cy + 10)}Q${f(cx)} ${f(cy - 30)} ${f(x + bw - p - 8)} ${f(cy + 6)}" fill="none" stroke="${c.road}" stroke-width="2"/>`); continue; }
      B.push(`<rect x="${f(x + p)}" y="${f(y + p)}" width="${f(w)}" height="${f(h)}" rx="4" fill="${c.built}"/>`, `<rect x="${f(x + p + 10)}" y="${f(y + p + 10)}" width="${f(w - 20)}" height="${f(h - 20)}" rx="10" fill="none" stroke="${c.road}" stroke-width="2"/>`);
      const rows = Math.max(3, Math.floor((h - 16) / 18)), cols = w > 130 ? 3 : 2, tilt2 = t === 1 ? 18 : t === 6 ? -12 : 0;
      for (let a = 0; a < rows; a++) for (let b = 0; b < cols; b++) { if (a === 1 && b === (cols > 2 ? 1 : 0) && t % 2) { B.push(`<circle cx="${f(x + p + (b + 0.5) * w / cols)}" cy="${f(y + p + (a + 0.5) * h / rows)}" r="6" fill="${c.park}"/>`); continue; }
        const bx = x + p + (b + 0.5) * w / cols, by = y + p + 8 + (a + 0.5) * (h - 16) / rows; B.push(`<rect x="${f(bx - w / cols * 0.34)}" y="${f(by - 4.5)}" width="${f(w / cols * 0.74)}" height="8" rx="1.5" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.6" transform="rotate(${tilt2} ${f(bx)} ${f(by)})"/>`); }
      if (t === 0 || t === 4) B.push(`<rect x="${f(x + p)}" y="${f(y + bh - p - 10)}" width="${f(w)}" height="10" rx="2" fill="${c.plaza}" stroke="${c.edge}" stroke-width="0.6"/>`);
    }
    const L = []; for (let i = -3, k = 0; i < W / bw + 3; i++, k++) L.push((k % 3 ? way : big)(`M${f(i * bw - ox)} ${f(Y0 - 200)}V${f(Y1 + 200)}`, k % 3 ? 4.4 : 6)); for (let j = -3, k = 0; j < H / bh + 3; j++, k++) L.push((k % 3 === 1 ? big : way)(`M${f(X0 - 200)} ${f(j * bh - oy)}H${f(X1 + 200)}`, k % 3 === 1 ? 6 : 4.4));
    o.push(`<g transform="rotate(${f(ga)} ${f(W / 2)} ${f(H / 2)})">${B.join('')}${L.join('')}</g>`);
    const st = [[X0, H * (0.1 + r() * 0.3)], [W * 0.3, H * 0.35], [W * 0.6, H * 0.6], [X1, H * (0.75 + r() * 0.2)]];
    o.push(`<path d="${curve(st)}" fill="none" stroke="${c.park}" stroke-width="40"/>`, `<path d="${curve(st)}" fill="none" stroke="${c.water}" stroke-width="12"/>`, `<path d="${curve(st.map(([x, y]) => [x, y - 14]))}" fill="none" stroke="${c.road}" stroke-width="1.6" stroke-dasharray="1 4" stroke-linecap="round"/>`);
  } else if (kind === 'alleys') { // 골목 주택가: 삐뚤빼뚤 이어지다 끊기는 좁은 골목 그물, 철길과 작은 역, 역 앞 상점가, 건널목, 작은 신사 · 쌈지 공원, 동네를 가르는 큰길 하나
    const sp = 24 + r() * 6, ga = (r() - 0.5) * 30, N = Math.ceil(Math.max(W, H) * 1.6 / sp), P = [];
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.built}"/>`);
    const C = W / 2, D = H / 2, ca = Math.cos(ga / 57.3), sa = Math.sin(ga / 57.3);
    for (let i = 0; i <= N; i++) { P.push([]); for (let j = 0; j <= N; j++) { const u = (i - N / 2) * sp + (r() - 0.5) * sp * 0.5, v = (j - N / 2) * sp + (r() - 0.5) * sp * 0.5; P[i].push([C + u * ca - v * sa, D + u * sa + v * ca]); } }
    for (let k = 0; k < 9; k++) { const i = 1 + Math.floor(r() * (N - 2)), j = 1 + Math.floor(r() * (N - 2)), [x, y] = P[i][j]; o.push(fill(blob(x, y, 9 + r() * 6, 8 + r() * 5, 6, 0.2), c.park)); }
    for (let k = 0; k < 26; k++) { const i = Math.floor(r() * N), j = Math.floor(r() * N), [x, y] = P[i][j]; o.push(`<rect x="${f(x + 3)}" y="${f(y + 3)}" width="${f(sp * 0.5)}" height="${f(sp * 0.4)}" rx="1" fill="${c.bld}" transform="rotate(${f(ga)} ${f(x)} ${f(y)})"/>`); }
    let d = '';
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const a = P[i][j]; if (i < N && r() > 0.22) d += `M${f(a[0])} ${f(a[1])}L${f(P[i + 1][j][0])} ${f(P[i + 1][j][1])}`; if (j < N && r() > 0.3) d += `M${f(a[0])} ${f(a[1])}L${f(P[i][j + 1][0])} ${f(P[i][j + 1][1])}`; }
    o.push(way(d, 2));
    const mid = Math.floor(N / 2) + Math.floor((r() - 0.5) * 4), mid2 = Math.floor(N / 2) + Math.floor((r() - 0.5) * 6);
    o.push(way(curve(P.map(row => row[mid2])), 3.6));
    const shop = P.map(row => row[mid]).slice(Math.floor(N * 0.3), Math.floor(N * 0.62));
    o.push(`<path d="${curve(shop)}" fill="none" stroke="${c.plaza}" stroke-width="12" stroke-linecap="round"/>`, way(curve(shop), 3.4), `<path d="${curve(shop)}" fill="none" stroke="${c.wall}" stroke-width="1.4" stroke-dasharray="2 5"/>`);
    const s = shop.at(-1), ra = Math.atan2(sa, ca) + 1.571 + (r() - 0.5) * 0.5, rl = [[s[0] - Math.cos(ra) * 700, s[1] - Math.sin(ra) * 700], [s[0], s[1]], [s[0] + Math.cos(ra) * 700, s[1] + Math.sin(ra) * 700]];
    o.push(`<path d="M${f(rl[0][0])} ${f(rl[0][1])}L${f(rl[2][0])} ${f(rl[2][1])}" stroke="${c.land}" stroke-width="16"/>`, rail(`M${f(rl[0][0])} ${f(rl[0][1])}L${f(rl[2][0])} ${f(rl[2][1])}`));
    o.push(`<rect x="-26" y="-7" width="52" height="14" rx="2" fill="${c.bld}" stroke="${c.edge}" transform="translate(${f(s[0] + Math.cos(ra + 1.571) * 14)} ${f(s[1] + Math.sin(ra + 1.571) * 14)}) rotate(${f(ra * 57.3)})"/>`);
    o.push(big(curve([P[0][Math.floor(N * 0.25)], P[Math.floor(N * 0.5)][Math.floor(N * 0.3)], P[N][Math.floor(N * 0.22)]]), 5.4));
  } else if (kind === 'downtown') { // 도심 업무지구: 큰 블록마다 그림자 진 높은 빌딩, 가운데 광장 공원, 사선 대로, 지하철 노선 점선과 역, 휘어 지나는 고가 도로
    const bw = 58 + r() * 14, bh = 46 + r() * 12, ga = (r() - 0.5) * 24, ox = r() * bw, oy = r() * bh, pi = Math.floor(r() * 3), pj = Math.floor(r() * 3);
    const T = [];
    T.push(`<rect x="${X0 - 200}" y="${Y0 - 200}" width="${X1 - X0 + 400}" height="${Y1 - Y0 + 400}" fill="${c.built}"/>`);
    for (let i = -4; i < W / bw + 4; i++) for (let j = -4; j < H / bh + 4; j++) { const x = i * bw - ox, y = j * bh - oy;
      if (i === pi + 1 && (j === pj + 2 || j === pj + 3)) { if (j === pj + 2) T.push(`<rect x="${f(x + 5)}" y="${f(y + 5)}" width="${f(bw - 10)}" height="${f(bh * 2 - 10)}" rx="3" fill="${c.park}"/><path d="M${f(x + 5)} ${f(y + 5)}L${f(x + bw - 5)} ${f(y + bh * 2 - 5)}M${f(x + bw - 5)} ${f(y + 5)}L${f(x + 5)} ${f(y + bh * 2 - 5)}" stroke="${c.road}" stroke-width="1.8"/><circle cx="${f(x + bw / 2)}" cy="${f(y + bh)}" r="7" fill="${c.plaza}" stroke="${c.road}" stroke-width="1.8"/>`); continue; }
      const n = 1 + ((i * 13 + j * 7 + 50) % 3);
      for (let k = 0; k < n; k++) { const w = (bw - 14) / n - 3, h = bh - 14 - ((i + j + k) % 2) * 8, bx = x + 7 + k * (w + 3), by = y + 7;
        T.push(`<rect x="${f(bx + 3)}" y="${f(by + 3)}" width="${f(w)}" height="${f(h)}" rx="1.5" fill="${c.edge}" opacity=".55"/><rect x="${f(bx)}" y="${f(by)}" width="${f(w)}" height="${f(h)}" rx="1.5" fill="${c.bld}"/>`); } }
    for (let i = -4, k = 0; i < W / bw + 4; i++, k++) T.push((k % 3 ? way : big)(`M${f(i * bw - ox)} ${f(Y0 - 200)}V${f(Y1 + 200)}`, k % 3 ? 3.4 : 5.4));
    for (let j = -4, k = 0; j < H / bh + 4; j++, k++) T.push(way(`M${f(X0 - 200)} ${f(j * bh - oy)}H${f(X1 + 200)}`, k % 4 ? 3 : 4.6));
    o.push(`<g transform="rotate(${f(ga)} ${f(W / 2)} ${f(H / 2)})">${T.join('')}</g>`);
    o.push(big(`M${f(X0)} ${f(H * (0.9 + r() * 0.2))}L${f(X1)} ${f(-H * (0.1 + r() * 0.2))}`, 5.4));
    const ex = [[X0, H * (0.2 + r() * 0.2)], [W * 0.3, H * 0.3], [W * 0.55, H * 0.62], [W * 0.8, H * 0.74], [X1, H * (0.7 + r() * 0.2)]];
    o.push(`<path d="${curve(ex)}" fill="none" stroke="${c.edge}" stroke-width="15" opacity=".5" transform="translate(3 4)"/>`, big(curve(ex), 9));
    const ln = dark ? '#aeb5c0' : '#7d838d';
    for (const [a, b] of [[[X0, H * 0.55], [X1, H * 0.4]], [[W * 0.3, Y0], [W * 0.6, Y1]]]) { o.push(`<path d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}" stroke="${ln}" stroke-width="2.2" stroke-dasharray="7 4" opacity=".8"/>`);
      for (const t of [0.3, 0.5, 0.7]) o.push(`<circle cx="${f(a[0] + (b[0] - a[0]) * t)}" cy="${f(a[1] + (b[1] - a[1]) * t)}" r="4.5" fill="${c.road}" stroke="${ln}" stroke-width="2"/>`); }
  } else if (kind === 'atoll') { // 산호섬 환초: 깊은 바다에 고리 모양 산호 섬들, 섬 사이 물길, 안쪽은 맑은 석호, 큰 섬엔 마을과 활주로, 석호 위 수상 숙소, 배 길 점선
    const lag = dark ? '#1f4566' : '#d3ebf9', reef = dark ? '#2a5274' : '#e6f3fb';
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.water}"/>`);
    const cx = W * (0.45 + r() * 0.1), cy = H * (0.48 + r() * 0.08), rx = W * (0.36 + r() * 0.08), ry = H * (0.34 + r() * 0.06), rot = r() * 6.283;
    const pt = (a, k = 1) => [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
    const arc = (a0, a1, k = 1) => curve(Array.from({ length: 12 }, (_, j) => pt(a0 + (a1 - a0) * j / 11, k)));
    o.push(`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="none" stroke="${reef}" stroke-width="44"/>`, `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx - 14)}" ry="${f(ry - 14)}" fill="${lag}"/>`);
    for (let k = 0; k < 5; k++) o.push(fill(blob(cx + (r() - 0.5) * rx, cy + (r() - 0.5) * ry, 10 + r() * 14, 6 + r() * 8, 7, 0.3), reef));
    const segs = []; let a = rot; for (let k = 0; k < 6; k++) { const len = 0.55 + r() * 0.7; segs.push([a, a + len]); a += len + 0.16 + r() * 0.12; if (a > rot + 6.1) break; }
    let main = segs[0]; for (const s of segs) if (s[1] - s[0] > main[1] - main[0]) main = s;
    for (const [a0, a1] of segs) o.push(`<path d="${arc(a0, a1)}" fill="none" stroke="${c.sand}" stroke-width="30" stroke-linecap="round"/>`, `<path d="${arc(a0 + 0.04, a1 - 0.04)}" fill="none" stroke="${c.park}" stroke-width="18" stroke-linecap="round"/>`);
    const [m0, m1] = main, mm = (m0 + m1) / 2;
    o.push(`<path d="${arc(m0 + 0.08, mm - 0.04)}" fill="none" stroke="${c.built}" stroke-width="14" stroke-linecap="round"/>`, way(arc(m0 + 0.06, m1 - 0.06), 2.4));
    for (let j = 0; j < 7; j++) { const t = m0 + 0.1 + j * (mm - m0 - 0.12) / 6, [x, y] = pt(t), [u, v] = pt(t, 0.94); o.push(`<rect x="${f(x - 3)}" y="${f(y - 2.5)}" width="6" height="5" rx="1" fill="${c.bld}" transform="rotate(${f(t * 57.3 + 90)} ${f(x)} ${f(y)})"/>`); if (j % 3 === 1) o.push(`<path d="M${f(x)} ${f(y)}L${f(u)} ${f(v)}" stroke="${c.wall}" stroke-width="1.8"/><rect x="${f(u - 3.5)}" y="${f(v - 3.5)}" width="7" height="7" rx="1.2" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.6"/>`); }
    o.push(`<path d="${arc(mm + 0.04, m1 - 0.08)}" fill="none" stroke="${c.plaza}" stroke-width="8"/>`, `<path d="${arc(mm + 0.06, m1 - 0.1)}" fill="none" stroke="${c.road}" stroke-width="1.2" stroke-dasharray="5 4"/>`);
    const oth = segs.filter(s => s !== main); for (const [a0, a1] of oth.slice(0, 2)) { const t = (a0 + a1) / 2, [x, y] = pt(t); o.push(`<circle cx="${f(x)}" cy="${f(y)}" r="3" fill="${c.bld}"/>`); }
    if (oth.length) { const [x, y] = pt(m0 + 0.2, 0.96), [x2, y2] = pt((oth[0][0] + oth[0][1]) / 2, 0.96); o.push(`<path d="${curve([[x, y], [cx + (x + x2 - 2 * cx) * 0.2, cy + (y + y2 - 2 * cy) * 0.2], [x2, y2]])}" fill="none" stroke="${dark ? '#8fb3d4' : '#6f9fca'}" stroke-width="1.4" stroke-dasharray="4 4"/>`); }
  } else if (kind === 'stiltVillage') { // 수상가옥 마을: 물가 동네에서 물 위로 뻗은 나무다리가 나뭇가지처럼 갈라지고, 다리마다 기둥 위 집들, 매어 둔 배, 맹그로브 숲
    const sh = [[X0, H * (0.24 + r() * 0.1)], [W * 0.3, H * 0.3], [W * 0.6, H * (0.2 + r() * 0.1)], [X1, H * 0.3]];
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.water}"/>`);
    o.push(grid(`${curve(sh)}L${X1} ${Y0}L${X0} ${Y0}Z`, (r() - 0.5) * 20, W * 0.5, H * 0.1, 26, 22));
    o.push(`<path d="${curve(sh)}" fill="none" stroke="${c.sand}" stroke-width="12"/>`);
    for (let k = 0; k < 4; k++) { const x = W * (0.05 + k * 0.3 + r() * 0.1); o.push(fill(blob(x, H * 0.3 + 10, 30, 14, 8, 0.3), c.forest)); }
    const bw = c.wall, H0 = [];
    const walk = (x, y, a, len, depth) => { const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; o.push(`<path d="M${f(x)} ${f(y)}L${f(x2)} ${f(y2)}" stroke="${bw}" stroke-width="${depth ? 2 : 3}" stroke-linecap="round"/>`);
      const n = Math.floor(len / 16); for (let j = 1; j <= n; j++) { const t = j / (n + 0.5), px = x + (x2 - x) * t, py = y + (y2 - y) * t; for (const sd of [-1, 1]) if (r() < 0.75) H0.push([px + Math.cos(a + sd * 1.571) * 9, py + Math.sin(a + sd * 1.571) * 9, a]); }
      if (depth < 2) for (const sd of [-1, 1]) if (r() < 0.8) walk(x + (x2 - x) * (0.4 + r() * 0.4), y + (y2 - y) * (0.4 + r() * 0.4), a + sd * (0.7 + r() * 0.5), len * 0.55, depth + 1); };
    for (const t of [0.18, 0.5, 0.8]) { const x = W * (t + (r() - 0.5) * 0.08), y = H * 0.32; walk(x, y, 1.571 + (r() - 0.5) * 0.5, 150 + r() * 60, 0); }
    for (const [x, y, a] of H0) o.push(`<rect x="${f(x - 6)}" y="${f(y - 5)}" width="12" height="10" rx="1.5" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.8" transform="rotate(${f(a * 57.3)} ${f(x)} ${f(y)})"/>`);
    for (let k = 0; k < 9; k++) { const x = W * r(), y = H * (0.5 + r() * 0.45), a = r() * 180; o.push(`<path d="M-8 0Q0 -4 8 0Q0 4 -8 0Z" fill="${c.wall}" transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"/>`); }
    o.push(big(curve(sh.map(([x, y]) => [x, y - 22])), 5));
  } else if (kind === 'riceTerraces') { // 계단식 논: 언덕 둘레를 따라 층층이 쌓인 논(물 찬 논 · 초록 논이 번갈아), 꼭대기 숲, 골짜기 개울, 능선 위 마을, 굽이진 길
    const tr = [dark ? '#23382a' : '#cfe5bf', dark ? '#1d3848' : '#c3dff0', dark ? '#2a3b25' : '#dfeac2'];
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.park}"/>`);
    const hills = [[W * (0.2 + r() * 0.1), H * (0.3 + r() * 0.1), 230], [W * (0.75 + r() * 0.1), H * (0.7 + r() * 0.1), 250]];
    for (const [hx, hy, R] of hills) { const ph = [r() * 6, r() * 6, r() * 6], rad = a => 1 + 0.16 * Math.sin(3 * a + ph[0]) + 0.1 * Math.sin(5 * a + ph[1]) + 0.06 * Math.sin(8 * a + ph[2]);
      for (let k = 16; k >= 1; k--) { const d = curve(Array.from({ length: 36 }, (_, j) => { const a = j / 36 * 6.283, q = R * k / 16 * rad(a); return [hx + Math.cos(a) * q, hy + Math.sin(a) * q * 0.75]; }), true);
        o.push(`<path d="${d}" fill="${k <= 3 ? c.forest : tr[k % 3]}" stroke="${k <= 3 ? 'none' : c.road}" stroke-width="0.9"/>`); } }
    const st = [[X0, H * 0.95], [W * 0.35, H * 0.62], [W * 0.55, H * 0.42], [X1, H * 0.08]];
    o.push(`<path d="${curve(st)}" fill="none" stroke="${c.forest}" stroke-width="16"/>`, `<path d="${curve(st)}" fill="none" stroke="${c.water}" stroke-width="5"/>`);
    const vx = W * 0.5, vy = H * 0.58, tw = blob(vx + 40, vy - 20, 46, 20, 8, 0.15); o.push(fill(tw, c.built));
    for (let k = 0; k < 14; k++) { const x = vx + 40 + (r() - 0.5) * 80, y = vy - 20 + (r() - 0.5) * 30; o.push(`<rect x="${f(x - 4)}" y="${f(y - 3)}" width="8" height="6" rx="1" fill="${c.bld}" transform="rotate(${f(r() * 60 - 30)} ${f(x)} ${f(y)})"/>`); }
    o.push(big(curve([[X0, H * 0.75], [W * 0.25, H * 0.68], [vx + 10, vy - 6], [W * 0.62, H * 0.5], [W * 0.68, H * 0.3], [X1, H * 0.22]]), 4.4));
  } else if (kind === 'canyon') { // 협곡 도시: 붉은 바위 층이 드러난 깊은 협곡과 바닥의 강, 절벽 끝에 붙은 옛 동네, 협곡을 건너는 높은 다리, 전망대, 위쪽 들판
    const rock = [dark ? '#4a3a30' : '#e6c9a8', dark ? '#3e3129' : '#dbb894', dark ? '#352a24' : '#cfa882', dark ? '#2d2420' : '#c39a74'];
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.land}"/>`);
    for (let k = 0; k < 6; k++) o.push(fill(`M${f(X0 + k * 120 - 40)} ${Y0}h${f(100 + r() * 30)}V${Y1}h${f(-100)}Z`, k % 2 ? c.vine : c.park, 0.5));
    const cl = [[X0, H * (0.35 + r() * 0.2)], [W * 0.22, H * (0.5 + r() * 0.1)], [W * 0.48, H * (0.4 + r() * 0.12)], [W * 0.74, H * (0.58 + r() * 0.08)], [X1, H * (0.45 + r() * 0.15)]], d = curve(cl);
    const side = r() < 0.5 ? -1 : 1, cw = 120 + r() * 30;
    const town = curve(cl.map(([x, y]) => [x, y + side * (cw / 2 + 4)]));
    o.push(grid(`${town}L${X1} ${side < 0 ? Y0 : Y1}L${X0} ${side < 0 ? Y0 : Y1}Z`, 0, W * 0.5, H * 0.5, 14 + r() * 4, 12 + r() * 4, 1.8));
    rock.forEach((col, k) => o.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${f(cw - k * (cw - 30) / 4)}" stroke-linejoin="round"/>`));
    for (let k = 0; k < 4; k++) o.push(`<path d="${curve(cl.map(([x, y], j) => [x, y + (k - 1.5) * cw * 0.18 + Math.sin(j * 2 + k) * 4]))}" fill="none" stroke="${rock[3]}" stroke-width="0.8" opacity=".6"/>`);
    o.push(`<path d="${d}" fill="none" stroke="${c.water}" stroke-width="12"/>`);
    const bx = (cl[2][0] + cl[3][0]) / 2, by = (cl[2][1] + cl[3][1]) / 2; o.push(`<path d="M${f(bx - 10)} ${f(by - cw * 0.7)}L${f(bx + 10)} ${f(by + cw * 0.7)}" stroke="${c.edge}" stroke-width="8"/><path d="M${f(bx - 10)} ${f(by - cw * 0.7)}L${f(bx + 10)} ${f(by + cw * 0.7)}" stroke="${c.road}" stroke-width="5.4"/>`);
    for (const j of [1, 2]) { const [x, y] = cl[j]; o.push(`<circle cx="${f(x)}" cy="${f(y + side * (cw / 2 + 2))}" r="5" fill="${c.plaza}" stroke="${c.wall}" stroke-width="2"/>`); }
    o.push(big(curve(cl.map(([x, y]) => [x, y + side * (cw / 2 + 34)])), 4.8), way(`M${f(bx - 10)} ${f(by - cw * 0.7)}L${f(bx - 40)} ${Y0}M${f(bx + 10)} ${f(by + cw * 0.7)}L${f(bx + 40)} ${Y1}`, 4));
  } else if (kind === 'usTown') { // 미국 소도시: 밭 조각보 가운데 작은 바둑판 동네, 가게 블록 두 줄의 메인 스트리트, 잔디 광장 법원, 연못 공원 · 야구장 · 묘지, 나무 줄 선 개울, 철길 옆 곡물 창고, 마을 옆 고속도로
    const ga = (r() - 0.5) * 8, cx = W * (0.42 + r() * 0.16), cy = H * (0.42 + r() * 0.12), crop = [c.vine, c.park, c.sand, dark ? '#2a3328' : '#e8eccf'];
    const bw = 34, bh = 28, nx = 3 + Math.floor(r() * 2), ny = 3;
    const T = [];
    for (let i = -7; i < 8; i++) for (let j = -7; j < 8; j++) { const x = cx + i * 74, y = cy + j * 64; T.push(`<rect x="${f(x + 2)}" y="${f(y + 2)}" width="70" height="${j % 2 ? 60 : 28}" rx="2" fill="${crop[(i * 5 + j * 3 + 70) % 4]}"/>`); if (j % 2 === 0) T.push(`<rect x="${f(x + 2)}" y="${f(y + 34)}" width="70" height="28" rx="2" fill="${crop[(i * 3 + j * 7 + 71) % 4]}"/>`); }
    for (let i = -7; i < 8; i += 2) T.push(way(`M${f(cx + i * 74)} ${f(cy - 600)}V${f(cy + 600)}`, 2.6)); for (let j = -7; j < 8; j += 2) T.push(way(`M${f(cx - 700)} ${f(cy + j * 64)}H${f(cx + 700)}`, 2.6));
    const tx0 = cx - nx * bw, ty0 = cy - ny * bh, tw = nx * 2 * bw, th = ny * 2 * bh;
    T.push(`<rect x="${f(tx0 - 6)}" y="${f(ty0 - 6)}" width="${f(tw + 12)}" height="${f(th + 12)}" rx="10" fill="${c.built}"/>`);
    const cell = (i, j, col, inset = 4) => `<rect x="${f(tx0 + i * bw + inset)}" y="${f(ty0 + j * bh + inset)}" width="${f(bw - inset * 2)}" height="${f(bh - inset * 2)}" rx="2" fill="${col}"/>`;
    const mi = nx - 1, mj = ny - 1;
    for (let i = 0; i < nx * 2; i++) for (let j = 0; j < ny * 2; j++) for (let k = 0; k < 3; k++) T.push(`<circle cx="${f(tx0 + i * bw + 6 + r() * (bw - 12))}" cy="${f(ty0 + j * bh + 6 + r() * (bh - 12))}" r="${f(2.4 + r() * 1.2)}" fill="${c.forest}" opacity=".8"/>`);
    const shops = (i, j) => { let g = cell(i, j, c.land, 3); for (let k = 0; k < 4; k++) g += `<rect x="${f(tx0 + i * bw + 4 + k * 6.6)}" y="${f(ty0 + j * bh + 4)}" width="5.6" height="${f(bh - 8)}" rx="0.8" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.8"/>`; return g; };
    for (const i of [mi, mi + 1]) for (const j of [mj - 1, mj + 2]) T.push(shops(i, j));
    for (const i of [mi - 1, mi + 2]) for (const j of [mj, mj + 1]) T.push(shops(i, j));
    T.push(`<rect x="${f(tx0 + mi * bw + 3)}" y="${f(ty0 + mj * bh + 3)}" width="${f(bw * 2 - 6)}" height="${f(bh * 2 - 6)}" rx="3" fill="${c.park}"/>${[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => `<circle cx="${f(cx + a * 22)}" cy="${f(cy + b * 15)}" r="3.4" fill="${c.forest}"/>`).join("")}<rect x="${f(cx - 10)}" y="${f(cy - 8)}" width="20" height="16" rx="1.5" fill="${c.wall}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="3" fill="${c.plaza}"/>`);
    { const i = 0, j = 0, x = tx0 + i * bw + 4, y = ty0 + j * bh + 4; T.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(bw * 2 - 8)}" height="${f(bh - 8)}" rx="2" fill="${c.park}"/><ellipse cx="${f(x + bw * 0.7)}" cy="${f(y + bh * 0.3)}" rx="11" ry="6" fill="${c.water}"/>`); }
    { const x = tx0 + (nx * 2 - 1) * bw + bw / 2, y = ty0 + (ny * 2 - 1) * bh + 5; T.push(cell(nx * 2 - 1, ny * 2 - 1, c.park, 3), `<path d="M${f(x)} ${f(y + 16)}l-11 -11a16 16 0 0 1 22 0z" fill="${c.sand}"/><path d="M${f(x)} ${f(y + 15)}l-6 -6l6 -5l6 5z" fill="${c.park}" stroke="${c.road}" stroke-width="0.8"/>`); }
    { T.push(cell(0, ny * 2 - 1, c.park, 3)); const x = tx0 + 7, y = ty0 + (ny * 2 - 1) * bh + 7; for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) T.push(`<rect x="${f(x + b * 5.5)}" y="${f(y + a * 5)}" width="2.4" height="2.4" fill="${c.wall}"/>`); }
    for (let i = 0; i <= nx * 2; i++) T.push(way(`M${f(tx0 + i * bw)} ${f(ty0 - 4)}V${f(ty0 + th + 4)}`, 2.6)); for (let j = 0; j <= ny * 2; j++) T.push(way(`M${f(tx0 - 4)} ${f(ty0 + j * bh)}H${f(tx0 + tw + 4)}`, 2.6));
    T.push(big(`M${f(cx - bw)} ${f(cy - 600)}V${f(cy + 600)}`, 5.2), way(`M${f(cx - 700)} ${f(cy + bh)}H${f(cx + 700)}`, 3.6));
    o.push(`<g transform="rotate(${f(ga)} ${f(cx)} ${f(cy)})">${T.join('')}</g>`);
    const ck = [[X0, cy + th / 2 + 30 + r() * 20], [cx - 80, cy + th / 2 + 24], [cx + 40, cy + th / 2 + 44], [cx + 140, cy + th / 2 + 20], [X1, cy + th / 2 + 60]];
    o.push(`<path d="${curve(ck)}" fill="none" stroke="${c.forest}" stroke-width="16" stroke-linecap="round"/>`, `<path d="${curve(ck)}" fill="none" stroke="${c.water}" stroke-width="4"/>`);
    const rl = [[X0, cy - th / 2 - 40 - r() * 30], [X1, cy - th / 2 - 10]];
    o.push(`<path d="M${f(rl[0][0])} ${f(rl[0][1])}L${f(rl[1][0])} ${f(rl[1][1])}" stroke="${c.land}" stroke-width="10"/>`, rail(`M${f(rl[0][0])} ${f(rl[0][1])}L${f(rl[1][0])} ${f(rl[1][1])}`));
    { const gx = cx + 60, gy = rl[0][1] + (rl[1][1] - rl[0][1]) * ((gx - X0) / (X1 - X0)) - 14; for (let k = 0; k < 4; k++) o.push(`<circle cx="${f(gx + k * 10)}" cy="${f(gy)}" r="5" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.8"/>`); o.push(`<rect x="${f(gx - 24)}" y="${f(gy + 6)}" width="16" height="7" rx="1" fill="${c.wall}"/>`); }
    o.push(`<circle cx="${f(cx - tw / 2 + 10)}" cy="${f(cy - th / 2 - 4)}" r="5.5" fill="${c.road}" stroke="${c.rail}" stroke-width="2"/>`);
    o.push(big(curve([[cx + tw / 2 + 50, Y0], [cx + tw / 2 + 40, cy], [cx + tw / 2 + 70, Y1]]), 6));
  } else if (kind === 'euroSquare') { // 유럽 소도시 광장: 살짝 휘는 옛 골목 바둑판 가운데 너른 시장 광장(성당 · 시청 · 분수), 옛 성벽 자리를 두른 나무 고리 공원, 밖은 새 동네, 옆을 흐르는 강과 돌다리
    const cx = W * (0.44 + r() * 0.12), cy = H * (0.42 + r() * 0.1), Rx = 116 + r() * 14, Ry = 88 + r() * 10, ga = r() * 30;
    o.push(grid(`M${X0} ${Y0}H${X1}V${Y1}H${X0}Z`, ga + 20, cx, cy, 34, 28));
    const ring = blob(cx, cy, Rx, Ry, 12, 0.05);
    o.push(fill(ring, c.built));
    const sp = 22, N = 18, P = []; const ca = Math.cos(ga / 57.3), sa = Math.sin(ga / 57.3);
    for (let i = 0; i <= N; i++) { P.push([]); for (let j = 0; j <= N; j++) { const u = (i - N / 2) * sp, v = (j - N / 2) * sp * 0.85, bend = Math.sin(u / 60 + v / 90) * 6; P[i].push([cx + u * ca - (v + bend) * sa + (r() - 0.5) * 3, cy + u * sa + (v + bend) * ca + (r() - 0.5) * 3]); } }
    { const id = `${cidBase}_${nClip++}`; let d = ''; for (let i = 0; i <= N; i++) d += curve(P[i]); let e = ''; for (let j = 0; j <= N; j++) e += curve(P.map(row => row[j]));
      o.push(`<clipPath id="${id}"><path d="${ring}"/></clipPath><g clip-path="url(#${id})">${way(d, 2)}${way(e, 2)}`);
      const sq = [P[7][7], P[11][7], P[11][10], P[7][10]].map(([x, y], k) => [x + (k % 3 ? 4 : -3), y + (k > 1 ? 3 : -2)]);
      o.push(`<path d="M${sq.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z" fill="${c.plaza}" stroke="${c.edge}" stroke-width="1"/>`);
      const [kx, ky] = P[9][6]; o.push(`<g transform="translate(${f(kx)} ${f(ky - 2)}) rotate(${f(ga)})"><rect x="-18" y="-5" width="36" height="10" rx="1.5" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.7"/><rect x="2" y="-12" width="9" height="24" rx="1.5" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.7"/><circle cx="-14" cy="0" r="3.2" fill="${c.wall}"/></g>`);
      const [hx, hy] = P[11][8]; o.push(`<rect x="${f(hx - 1)}" y="${f(hy - 8)}" width="14" height="16" rx="1.5" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.7" transform="rotate(${f(ga)} ${f(hx)} ${f(hy)})"/>`);
      const qx = (sq[0][0] + sq[2][0]) / 2, qy = (sq[0][1] + sq[2][1]) / 2; o.push(`<circle cx="${f(qx)}" cy="${f(qy)}" r="4" fill="${c.water}" stroke="${c.road}" stroke-width="1.4"/></g>`); }
    o.push(`<path d="${ring}" fill="none" stroke="${c.park}" stroke-width="16"/>`);
    for (let k = 0; k < 40; k++) { const a = k / 40 * 6.283, q = 1 + (k % 2 ? 0.035 : -0.035); o.push(`<circle cx="${f(cx + Math.cos(a) * Rx * q)}" cy="${f(cy + Math.sin(a) * Ry * q)}" r="2.6" fill="${c.forest}"/>`); }
    o.push(way(blob(cx, cy, Rx + 13, Ry + 12, 12, 0.04), 4.2));
    const rv = [[X0, cy + Ry + 44], [W * 0.4, cy + Ry + 34 + r() * 14], [W * 0.7, cy + Ry + 54], [X1, cy + Ry + 40]];
    o.push(`<path d="${curve(rv)}" fill="none" stroke="${c.park}" stroke-width="40"/>`, `<path d="${curve(rv)}" fill="none" stroke="${c.water}" stroke-width="24"/>`);
    for (const t of [0.35, 0.7]) { const x = W * t, y = yOn(rv, W * t); o.push(way(`M${f(x)} ${f(y - 24)}L${f(x + 3)} ${f(y + 24)}`, 4.6)); }
    o.push(big(curve([[X0, cy + 30], [cx - Rx - 60, cy + 14], [cx - Rx - 13, cy + 4]]), 4.8), big(curve([[cx + Rx + 13, cy - 6], [cx + Rx + 70, cy - 30], [X1, cy - 50]]), 4.8), big(curve([[cx + 20, cy - Ry - 12], [cx + 40, cy - Ry - 60], [cx + 50, Y0]]), 4.4));
  } else if (kind === 'beachTown') { // 해변 소도시: 길게 휘는 넓은 모래사장, 줄지은 파라솔, 야자수 산책로, 바다로 뻗은 잔교, 끝자락 요트 항구, 해안 큰길 뒤 동네, 뒷산 등고선
    const sea = sd => [[X0, H * (0.6 + r() * 0.05) + sd], [W * 0.3, H * 0.66 + sd], [W * 0.65, H * (0.62 + r() * 0.06) + sd], [X1, H * 0.56 + sd]];
    const s0 = sea(0);
    for (let k = 0; k < 7; k++) o.push(`<path d="${curve([[X0, H * (0.02 + k * 0.05)], [W * 0.35, H * (0.0 + k * 0.055)], [W * 0.7, H * (0.04 + k * 0.05)], [X1, H * (0.01 + k * 0.05)]])}" fill="none" stroke="${c.contour}" stroke-width="1.2"/>`);
    o.push(grid(`${curve(s0.map(([x, y]) => [x, y - 64]))}L${X1} ${f(H * 0.3)}L${X0} ${f(H * 0.3)}Z`, (r() - 0.5) * 14, W * 0.5, H * 0.4, 30, 22));
    o.push(fill(blob(W * (0.2 + r() * 0.6), H * 0.14, 90, 30, 9, 0.2), c.forest));
    o.push(fill(`${curve(s0.map(([x, y]) => [x, y - 44]))}L${X1} ${Y1}L${X0} ${Y1}Z`, c.sand));
    o.push(fill(`${curve(s0)}L${X1} ${Y1}L${X0} ${Y1}Z`, c.water));
    for (let k = 1; k <= 3; k++) o.push(`<path d="${curve(s0.map(([x, y], j) => [x, y + k * 12 + (j % 2) * 3]))}" fill="none" stroke="${c.road}" stroke-width="${f(1.6 - k * 0.3)}" opacity="${f(0.8 - k * 0.2)}" stroke-dasharray="${k * 14} ${k * 9}"/>`);
    o.push(`<path d="${curve(s0.map(([x, y]) => [x, y - 50]))}" fill="none" stroke="${c.plaza}" stroke-width="8"/>`);
    for (let k = 0; k < 26; k++) { const x = X0 + 30 + k * 22; o.push(`<circle cx="${f(x)}" cy="${f(yOn(s0, x) - 50)}" r="2.6" fill="${c.forest}"/>`); }
    const cols = [c.wall, c.road, c.major];
    for (let row = 0; row < 2; row++) for (let k = 0; k < 22; k++) { const x = X0 + 60 + k * 26 + row * 13; o.push(`<circle cx="${f(x)}" cy="${f(yOn(s0, x) - 30 + row * 12)}" r="3.2" fill="${cols[(k + row) % 3]}" stroke="${c.edge}" stroke-width="0.5"/>`); }
    const px = W * (0.4 + r() * 0.2), py = yOn(s0, px); o.push(`<path d="M${f(px)} ${f(py - 44)}L${f(px)} ${f(py + 80)}" stroke="${c.edge}" stroke-width="7.4"/><path d="M${f(px)} ${f(py - 44)}L${f(px)} ${f(py + 80)}" stroke="${c.plaza}" stroke-width="5"/><rect x="${f(px - 12)}" y="${f(py + 76)}" width="24" height="16" rx="3" fill="${c.bld}" stroke="${c.edge}"/>`);
    const mx = W * (0.88 + r() * 0.08), my = yOn(s0, mx);
    o.push(`<path d="${curve([[mx - 60, my - 10], [mx - 70, my + 50], [mx - 20, my + 90], [mx + 50, my + 80]])}" fill="none" stroke="${c.contour}" stroke-width="7" stroke-linecap="round"/>`);
    for (let k = 0; k < 4; k++) o.push(`<path d="M${f(mx - 46 + k * 18)} ${f(my + 4)}v30" stroke="${c.road}" stroke-width="1.6"/>`, `<path d="M-5 0Q0 -2.5 5 0Q0 2.5 -5 0Z" fill="${c.road}" stroke="${c.edge}" stroke-width="0.5" transform="translate(${f(mx - 40 + k * 18)} ${f(my + 24)}) rotate(90)"/>`);
    o.push(big(curve(s0.map(([x, y]) => [x, y - 64])), 5));
  } else if (kind === 'campus') { // 학교 캠퍼스 동네: 담장 두른 큰 학교 땅(ㄷ자 본관 · 운동장 트랙 · 체육관 · 기숙사 · 연못), 정문에서 본관까지 가로수길, 정문 앞 가게 골목, 둘레 주택가
    const cx = W * (0.46 + r() * 0.08), cy = H * (0.44 + r() * 0.08), ga = (r() - 0.5) * 20;
    o.push(grid(`M${X0} ${Y0}H${X1}V${Y1}H${X0}Z`, ga, cx, cy, 28, 24));
    const T = [];
    T.push(`<rect x="${f(cx - 150)}" y="${f(cy - 110)}" width="300" height="210" rx="10" fill="${c.plaza}" stroke="${c.wall}" stroke-width="2.4"/>`, `<rect x="${f(cx - 80)}" y="${f(cy - 30)}" width="100" height="56" rx="4" fill="${c.park}"/>`, `<rect x="${f(cx - 138)}" y="${f(cy + 40)}" width="74" height="50" rx="4" fill="${c.park}"/>`);
    T.push(`<path d="M${f(cx - 70)} ${f(cy - 92)}h140v54h-18v-36h-104v36h-18z" fill="${c.bld}" stroke="${c.wall}" stroke-width="1.2"/>`);
    T.push(`<rect x="${f(cx + 30)}" y="${f(cy - 14)}" width="104" height="66" rx="33" fill="${c.sand}"/><rect x="${f(cx + 42)}" y="${f(cy - 4)}" width="80" height="46" rx="23" fill="${c.park}" stroke="${c.road}" stroke-width="1.2"/><path d="M${f(cx + 82)} ${f(cy - 4)}v46" stroke="${c.road}" stroke-width="1"/>`);
    T.push(`<rect x="${f(cx - 136)}" y="${f(cy - 90)}" width="44" height="30" rx="2" fill="${c.bld}" stroke="${c.wall}" stroke-width="1.2"/>`);
    for (let k = 0; k < 3; k++) T.push(`<rect x="${f(cx - 136)}" y="${f(cy - 34 + k * 20)}" width="50" height="10" rx="1.5" fill="${c.bld}" stroke="${c.wall}" stroke-width="1.2"/>`);
    T.push(`<path d="${blob(cx - 40, cy + 62, 20, 12, 8, 0.15)}" fill="${c.water}"/>`);
    T.push(`<path d="M${f(cx)} ${f(cy + 100)}V${f(cy - 36)}" stroke="${c.plaza}" stroke-width="9"/><path d="M${f(cx - 70)} ${f(cy - 30)}H${f(cx + 20)}" stroke="${c.plaza}" stroke-width="5"/>`);
    for (let k = 0; k < 8; k++) for (const sd of [-1, 1]) T.push(`<circle cx="${f(cx + sd * 9)}" cy="${f(cy + 92 - k * 16)}" r="3.2" fill="${c.forest}"/>`);
    for (let k = 0; k < 18; k++) { const a = r() * 6.283; T.push(`<circle cx="${f(cx - 150 + 8 + r() * 284)}" cy="${f(cy + 100 - 6 - r() * 8)}" r="2.6" fill="${c.forest}"/>`); }
    T.push(`<rect x="${f(cx - 14)}" y="${f(cy + 96)}" width="28" height="8" rx="2" fill="${c.wall}"/>`);
    for (const sd of [-1, 1]) for (let k = 0; k < 7; k++) T.push(`<rect x="${f(cx + sd * 12 - (sd < 0 ? 10 : 0))}" y="${f(cy + 114 + k * 13)}" width="10" height="10" fill="${c.plaza}" stroke="${c.edge}" stroke-width="0.5"/>`);
    T.push(way(`M${f(cx)} ${f(cy + 104)}V${f(cy + 400)}`, 3.6));
    o.push(`<g transform="rotate(${f(ga)} ${f(cx)} ${f(cy)})">${T.join('')}</g>`);
    o.push(big(curve([[X0, cy + 130], [cx - 60, cy + 118], [cx + 80, cy + 122], [X1, cy + 108]].map(([x, y]) => [x, y + Math.sin(ga / 57.3) * (x - cx)])), 5));
  } else if (kind === 'strait') { // 해협 도시: 두 땅 사이 좁고 굽은 바다, 한쪽으로 갈라지는 만, 양쪽 언덕 동네(결이 달라요), 탑 둘 선 큰 현수교, 해협을 가로지르는 배 길과 선착장, 바닷가 둥근 지붕 사원과 공원
    const ch = [[W * (0.2 + r() * 0.15), Y0], [W * 0.38, H * 0.25], [W * (0.5 + r() * 0.1), H * 0.55], [W * 0.62, H * 0.8], [W * (0.7 + r() * 0.1), Y1]];
    const xOn = y => { for (let k = 0; k < ch.length - 1; k++) if (y <= ch[k + 1][1]) { const u = (y - ch[k][1]) / (ch[k + 1][1] - ch[k][1]), v = u * u * (3 - 2 * u); return ch[k][0] + (ch[k + 1][0] - ch[k][0]) * v; } return ch.at(-1)[0]; };
    o.push(grid(`${curve(ch)}L${X0} ${Y1}L${X0} ${Y0}Z`, 10 + r() * 15, W * 0.2, H * 0.5, 22, 18, 2));
    o.push(grid(`${curve(ch)}L${X1} ${Y1}L${X1} ${Y0}Z`, -15 - r() * 15, W * 0.8, H * 0.5, 30, 24, 2.2));
    const gy = H * (0.3 + r() * 0.15), hz = [[xOn(gy), gy], [xOn(gy) - 70, gy - 10], [xOn(gy) - 150, gy + 20], [X0, gy + 10]];
    o.push(`<path d="${curve(hz)}" fill="none" stroke="${c.water}" stroke-width="30" stroke-linecap="round"/>`);
    o.push(`<path d="${curve(ch)}" fill="none" stroke="${c.park}" stroke-width="104"/>`, `<path d="${curve(ch)}" fill="none" stroke="${c.water}" stroke-width="88"/>`);
    for (const sd of [-1, 1]) o.push(big(curve(ch.map(([x, y]) => [x + sd * 54, y])), 4.6));
    const by = H * (0.62 + r() * 0.12), bx = xOn(by), bL = 70;
    o.push(`<path d="M${f(bx - bL)} ${f(by + 6)}L${f(bx + bL)} ${f(by - 6)}" stroke="${c.majorEdge}" stroke-width="9.6" stroke-linecap="round"/><path d="M${f(bx - bL)} ${f(by + 6)}L${f(bx + bL)} ${f(by - 6)}" stroke="${c.major}" stroke-width="7" stroke-linecap="round"/>`);
    for (const t of [-0.45, 0.45]) o.push(`<rect x="${f(bx + t * bL * 2 - 3)}" y="${f(by - t * 12 - 7)}" width="6" height="14" rx="1" fill="${c.wall}"/>`);
    o.push(big(`M${f(bx - bL)} ${f(by + 6)}L${X0} ${f(by + 60)}M${f(bx + bL)} ${f(by - 6)}L${X1} ${f(by - 70)}`, 6));
    const fl = dark ? '#8fb3d4' : '#6f9fca';
    for (const y of [H * 0.15, H * 0.45, H * 0.92]) { const x = xOn(y); o.push(`<path d="M${f(x - 46)} ${f(y)}Q${f(x)} ${f(y - 18)} ${f(x + 46)} ${f(y + 4)}" fill="none" stroke="${fl}" stroke-width="1.4" stroke-dasharray="4 4"/>`); for (const sd of [-1, 1]) o.push(`<rect x="${f(x + sd * 50 - 5)}" y="${f(y - 2)}" width="10" height="5" rx="1" fill="${c.wall}"/>`); }
    { const y = H * (0.2 + r() * 0.1), x = xOn(y) + 74; o.push(fill(blob(x + 14, y, 30, 22, 8, 0.15), c.park), `<circle cx="${f(x + 12)}" cy="${f(y)}" r="9" fill="${c.bld}" stroke="${c.wall}" stroke-width="1.2"/>`, ...[[-6, -12], [30, -12], [-6, 12], [30, 12]].map(([dx, dy]) => `<circle cx="${f(x + dx)}" cy="${f(y + dy)}" r="2" fill="${c.wall}"/>`)); }
  } else if (kind === 'archipelago') { // 다도해: 크고 작은 섬 여럿(모래 테두리 · 숲 가운데), 섬 둘레 얕은 물빛, 큰 섬엔 항구 마을, 섬과 섬을 잇는 배 길 점선과 연도교, 등대
    const sh = dark ? '#1f4566' : '#cfe6f6';
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.water}"/>`);
    const isl = []; const add = (x, y, rx, ry) => isl.push({ x, y, rx, ry, d: blob(x, y, rx, ry, 10, 0.28) });
    add(W * (0.3 + r() * 0.15), H * (0.4 + r() * 0.15), 90 + r() * 20, 60 + r() * 14);
    for (let k = 0; k < 40 && isl.length < 9; k++) { const x = W * (-0.05 + r() * 1.1), y = H * (-0.05 + r() * 1.1), s = 12 + r() * 36; if (isl.some(p => Math.hypot(p.x - x, (p.y - y) * 1.2) < Math.max(p.rx, p.ry) + s + 14)) continue; add(x, y, s, s * (0.6 + r() * 0.3)); }
    for (const p of isl) o.push(fill(blob(p.x, p.y, p.rx + 16, p.ry + 14, 9, 0.2), sh));
    for (const p of isl) o.push(fill(p.d, c.sand), fill(blob(p.x, p.y, p.rx * 0.86, p.ry * 0.84, 10, 0.25), c.land), fill(blob(p.x + p.rx * 0.1, p.y - p.ry * 0.1, p.rx * 0.5, p.ry * 0.45, 8, 0.3), c.forest));
    const big0 = isl[0], hx = big0.x + big0.rx * 0.5, hy = big0.y + big0.ry * 0.5;
    o.push(fill(blob(hx - 10, hy - 8, 36, 20, 8, 0.2), c.built));
    for (let k = 0; k < 4; k++) o.push(way(`M${f(hx - 36 + k * 18)} ${f(hy - 24)}L${f(hx - 30 + k * 18)} ${f(hy + 6)}`, 1.8));
    o.push(way(curve([[hx - 46, hy - 4], [hx - 10, hy - 12], [hx + 26, hy - 2]]), 2.2), way(curve([[big0.x - big0.rx * 0.7, big0.y], [big0.x - 20, big0.y - big0.ry * 0.3], [hx - 20, hy - 10]]), 3));
    o.push(`<path d="M${f(hx + 20)} ${f(hy + 4)}l26 16" stroke="${c.wall}" stroke-width="4" stroke-linecap="round"/>`);
    const fl = dark ? '#8fb3d4' : '#6f9fca';
    isl.slice(1, 4).forEach(p => o.push(`<path d="${curve([[hx + 40, hy + 18], [(hx + p.x) / 2 + 20, (hy + p.y) / 2 - 10], [p.x, p.y]])}" fill="none" stroke="${fl}" stroke-width="1.4" stroke-dasharray="4 4"/>`));
    for (const p of isl.slice(1, 5)) o.push(fill(p.d, c.sand), fill(blob(p.x, p.y, p.rx * 0.86, p.ry * 0.84, 10, 0.25), c.land), fill(blob(p.x + p.rx * 0.1, p.y - p.ry * 0.1, p.rx * 0.5, p.ry * 0.45, 8, 0.3), c.forest));
    if (isl.length > 2) { let a = isl[1], b = isl[2], best = 1e9; for (let i = 1; i < isl.length; i++) for (let j = i + 1; j < isl.length; j++) { const dd = Math.hypot(isl[i].x - isl[j].x, isl[i].y - isl[j].y); if (dd < best) { best = dd; a = isl[i]; b = isl[j]; } } o.push(big(`M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`, 4)); }
    const lt = isl.at(-1); o.push(`<circle cx="${f(lt.x + lt.rx * 0.7)}" cy="${f(lt.y)}" r="5" fill="${c.road}" stroke="${c.wall}" stroke-width="2.6"/>`);
  } else if (kind === 'polarPort') { // 극지 항구: 눈 덮인 바위 비탈(등고선), 알록달록한 작은 집들이 비탈에 흩어지고, 작은 항구와 배, 바다엔 떠다니는 얼음 조각, 굽은 길 하나, 헬기장
    const hc = dark ? ['#6e4747', '#6e6343', '#405670', '#43604c'] : ['#e9a9a2', '#ecd593', '#a3c1e6', '#acd3ae'];
    const snow = dark ? '#283039' : '#fbfcfd', sh = [[X0, H * (0.6 + r() * 0.08)], [W * 0.25, H * 0.66], [W * 0.5, H * (0.56 + r() * 0.08)], [W * 0.75, H * 0.68], [X1, H * 0.6]];
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${snow}"/>`);
    for (let k = 1; k < 12; k++) o.push(`<path d="${curve(sh.map(([x, y], j) => [x, y - k * 24 + Math.sin(j * 1.7 + k) * 8]))}" fill="none" stroke="${c.contour}" stroke-width="${k % 4 ? 1 : 1.8}"/>`);
    for (let k = 0; k < 5; k++) o.push(fill(blob(W * r(), H * (0.05 + r() * 0.4), 30 + r() * 20, 12 + r() * 8, 7, 0.35), c.built));
    o.push(fill(`${curve(sh)}L${X1} ${Y1}L${X0} ${Y1}Z`, c.water));
    o.push(`<path d="${curve(sh)}" fill="none" stroke="${c.contour}" stroke-width="5"/>`);
    for (let k = 0; k < 14; k++) { const x = W * (-0.05 + r() * 1.1), y = yOn(sh, Math.max(X0, Math.min(X1, x))) + 30 + r() * 140, s = 5 + r() * 14; o.push(`<path d="${blob(x, y, s, s * 0.7, 6, 0.4)}" fill="${snow}" stroke="${c.road}" stroke-width="1"/>`); }
    const rd = sh.map(([x, y], j) => [x, y - 40 - (j % 2) * 16]); o.push(way(curve(rd), 3.4));
    o.push(way(curve([[rd[2][0], rd[2][1]], [rd[2][0] + 40, rd[2][1] - 60], [rd[2][0] - 10, rd[2][1] - 120], [rd[2][0] + 30, Y0]]), 2.6));
    const vx = W * (0.3 + r() * 0.4); for (let k = 0; k < 46; k++) { const x = vx + (r() - 0.5) * 220, y = yOn(sh, x) - 14 - Math.pow(r(), 1.5) * 90, s = 6 + r() * 3; if (Math.abs(y - yOn(rd, x)) < 7) continue; o.push(`<rect x="${f(x - s / 2)}" y="${f(y - s / 2)}" width="${f(s)}" height="${f(s * 0.8)}" rx="1" fill="${hc[k % 4]}" stroke="${c.edge}" stroke-width="0.6"/>`); }
    const hx = vx, hy = yOn(sh, hx);
    o.push(`<path d="M${f(hx - 30)} ${f(hy)}v34h60v-34" fill="none" stroke="${c.contour}" stroke-width="6"/>`);
    for (let k = 0; k < 3; k++) o.push(`<path d="M-7 0Q0 -3 7 0Q0 3 -7 0Z" fill="${hc[k]}" stroke="${c.edge}" stroke-width="0.6" transform="translate(${f(hx - 14 + k * 14)} ${f(hy + 18)}) rotate(90)"/>`);
    o.push(`<circle cx="${f(W * 0.85)}" cy="${f(yOn(sh, W * 0.85) - 70)}" r="10" fill="${c.plaza}" stroke="${c.wall}" stroke-width="1.4"/><text x="${f(W * 0.85)}" y="${f(yOn(sh, W * 0.85) - 66.5)}" font-size="10" font-weight="700" text-anchor="middle" fill="${c.wall}">H</text>`);
  } else if (kind === 'pivotFarms') { // 원형 농장 사막: 모래 위에 바둑판처럼 놓인 동그란 밭(초록 진하기가 저마다, 반쯤 거둔 밭, 빈 밭), 1마일 길, 곧은 수로, 네거리 작은 마을, 사막 고속도로
    const ga = (r() - 0.5) * 16, cs = 86 + r() * 14, ox = r() * cs, oy = r() * cs, G = [dark ? '#2b4a2c' : '#a9d39a', dark ? '#24402a' : '#c3e2b2', dark ? '#355a32' : '#8fc782', dark ? '#3a3a2a' : '#e3dba8'];
    const T = [`<rect x="${X0 - 200}" y="${Y0 - 200}" width="${X1 - X0 + 400}" height="${Y1 - Y0 + 400}" fill="${c.sand}"/>`];
    for (let k = 0; k < 8; k++) T.push(`<path d="${curve([[X0 - 100, H * (k * 0.16)], [W * 0.3, H * (k * 0.16 + 0.04)], [W * 0.7, H * (k * 0.16 - 0.03)], [X1 + 100, H * (k * 0.16 + 0.02)]])}" fill="none" stroke="${c.wall}" stroke-width="1" opacity=".35"/>`);
    const ti = Math.floor(r() * 3) + 1, tj = Math.floor(r() * 2) + 1;
    for (let i = -3; i < W / cs + 3; i++) for (let j = -3; j < H / cs + 3; j++) { const x = i * cs - ox + cs / 2, y = j * cs - oy + cs / 2, rr = cs / 2 - 4, t = (i * 7 + j * 13 + 60) % 9;
      if (i === ti && j === tj) { T.push(`<rect x="${f(x - rr)}" y="${f(y - rr)}" width="${f(rr * 2)}" height="${f(rr * 2)}" rx="4" fill="${c.built}"/>`); for (let a = 1; a < 4; a++) T.push(way(`M${f(x - rr)} ${f(y - rr + a * rr / 2)}H${f(x + rr)}`, 2), way(`M${f(x - rr + a * rr / 2)} ${f(y - rr)}V${f(y + rr)}`, 2)); T.push(`<rect x="${f(x - 8)}" y="${f(y - 6)}" width="16" height="12" rx="2" fill="${c.wall}"/>`); continue; }
      if (t === 4) continue;
      T.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(rr)}" fill="${G[t % 4]}"/>`);
      if (t === 2 || t === 7) { const a0 = r() * 6.283; T.push(`<path d="M${f(x)} ${f(y)}L${f(x + Math.cos(a0) * rr)} ${f(y + Math.sin(a0) * rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x + Math.cos(a0 + 2.4) * rr)} ${f(y + Math.sin(a0 + 2.4) * rr)}Z" fill="${G[3]}"/>`); }
      const a = r() * 6.283; T.push(`<path d="M${f(x)} ${f(y)}L${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)}" stroke="${c.road}" stroke-width="1.2" opacity=".8"/><circle cx="${f(x)}" cy="${f(y)}" r="2" fill="${c.road}"/>`); }
    for (let i = -3, k = 0; i < W / cs + 4; i++, k++) T.push(way(`M${f(i * cs - ox)} ${f(Y0 - 200)}V${f(Y1 + 200)}`, 2.2)); for (let j = -3; j < H / cs + 4; j++) T.push(way(`M${f(X0 - 200)} ${f(j * cs - oy)}H${f(X1 + 200)}`, 2.2));
    const cy0 = (tj + 1) * cs - oy; T.push(`<path d="M${f(X0 - 200)} ${f(cy0 + 5)}H${f(X1 + 200)}" stroke="${c.water}" stroke-width="5"/>`);
    T.push(big(`M${f((ti + 1) * cs - ox)} ${f(Y0 - 200)}V${f(Y1 + 200)}`, 5.2));
    o.push(`<g transform="rotate(${f(ga)} ${f(W / 2)} ${f(H / 2)})">${T.join('')}</g>`);
  } else if (kind === 'mountainCity') { // 산 아래 도시: 위쪽 큰 산(등고선 · 숲 · 정상 · 산길 점선 · 절), 산자락 골짜기마다 파고든 동네, 산에서 내려와 도시를 지나는 개천, 아래는 빽빽한 바둑판, 산자락 큰길
    const sx = W * (0.3 + r() * 0.4), sy = H * (0.02 + r() * 0.08), ft = Array.from({ length: 9 }, (_, k) => [X0 + k * (X1 - X0) / 8, H * (0.42 + r() * 0.1) - (k % 3 === 1 ? 40 + r() * 30 : 0)]);
    const foot = curve(ft), id = `${cidBase}_${nClip++}`;
    o.push(grid(`${foot}L${X1} ${Y1}L${X0} ${Y1}Z`, (r() - 0.5) * 20, W * 0.5, H * 0.75, 26, 22, 2));
    let cont = ''; for (let k = 1; k < 16; k++) cont += `<path d="${blob(sx, sy, k * 30, k * 24, 12, 0.08)}" fill="none" stroke="${dark ? '#2e4a37' : '#a9c99b'}" stroke-width="${k % 4 ? 0.9 : 1.6}"/>`;
    o.push(`<clipPath id="${id}"><path d="${foot}L${X1} ${Y0}L${X0} ${Y0}Z"/></clipPath><g clip-path="url(#${id})"><rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.forest}"/>${cont}</g>`);
    o.push(`<path d="${foot}" fill="none" stroke="${c.park}" stroke-width="10"/>`);
    for (const k of [1, 4, 7]) { const [x, y] = ft[k]; o.push(`<path d="M${f(x)} ${f(y + 10)}L${f(x + (sx - x) * 0.2)} ${f(y + (sy - y) * 0.28)}" stroke="${c.built}" stroke-width="16" stroke-linecap="round"/>`, way(`M${f(x)} ${f(y + 10)}L${f(x + (sx - x) * 0.2)} ${f(y + (sy - y) * 0.28)}`, 2.4)); }
    const tr = []; let px = ft[3][0], py = ft[3][1]; for (let k = 0; k < 9; k++) { tr.push([px, py]); px += (sx - px) / (9 - k) + (k % 2 ? 22 : -22); py += (sy - py) / (9 - k); } tr.push([sx, sy]);
    o.push(`<path d="${curve(tr)}" fill="none" stroke="${c.wall}" stroke-width="1.6" stroke-dasharray="3 4"/>`, `<path d="M${f(sx)} ${f(sy - 7)}l7 11h-14z" fill="${c.wall}"/>`);
    { const [x, y] = tr[4]; o.push(`<rect x="${f(x + 10)}" y="${f(y - 5)}" width="16" height="10" rx="1.5" fill="${c.bld}" stroke="${c.wall}" stroke-width="1"/>`); }
    const st = [[ft[4][0], ft[4][1] - 30], [ft[4][0] + 10, ft[4][1] + 40], [W * 0.45, H * 0.75], [W * 0.38, Y1]];
    o.push(`<path d="${curve(st)}" fill="none" stroke="${c.park}" stroke-width="24"/>`, `<path d="${curve(st)}" fill="none" stroke="${c.water}" stroke-width="8"/>`);
    o.push(big(curve(ft.map(([x, y]) => [x, y + 24])), 5.4));
  } else if (kind === 'hillside') { // 언덕 주택가: 둥근 언덕을 감아 도는 짧고 긴 골목들, 골목 따라 줄지은 집 줄(군데군데 파스텔 지붕), 골목 사이 가파른 계단, 머리핀처럼 꺾이며 오르는 큰길, 꼭대기 공원 · 전망대, 아래 바다와 항구 길
    const hc = dark ? ['#4f4549', '#44505b', '#545040', '#465247'] : ['#f1cfc9', '#cadff2', '#efe3b8', '#cfe6cf'];
    const hx = W * (0.45 + r() * 0.2), hy = H * (0.18 + r() * 0.12), ph = r() * 6;
    const at = (a, rad) => { const q = rad * (1 + 0.07 * Math.sin(2 * a + ph) + 0.04 * Math.sin(5 * a + ph * 1.7)); return [hx + Math.cos(a) * q, hy + Math.sin(a) * q * 0.78]; };
    const arc = (a0, a1, rad) => { const n = Math.max(4, Math.ceil((a1 - a0) * 8)); return curve(Array.from({ length: n }, (_, j) => at(a0 + (a1 - a0) * j / (n - 1), rad))); };
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.built}"/>`);
    for (let rad = 50; rad < 520; rad += 28) o.push(`<path d="${arc(0, 6.283, rad)}" fill="none" stroke="${c.contour}" stroke-width="1"/>`);
    const rows = [], streets = [];
    for (let rad = 80; rad < 420; rad += 30) { let a = r() * 6.283; const end = a + 6.283; while (a < end - 0.4) { const len = 0.7 + r() * 1.4, a1 = Math.min(a + len, end - 0.2); streets.push([a, a1, rad]); a = a1 + 0.12 + r() * 0.3; } }
    for (const [a0, a1, rad] of streets) for (const d of [-9, 9]) { const tint = r() < 0.28 ? hc[Math.floor(r() * 4)] : c.bld; rows.push(`<path d="${arc(a0 + 0.02, a1 - 0.02, rad + d)}" fill="none" stroke="${tint}" stroke-width="9" stroke-dasharray="7 2"/>`); }
    o.push(rows.join(''));
    for (const [a0, a1, rad] of streets) o.push(way(arc(a0, a1, rad), 2.4));
    for (let k = 0; k < 16; k++) { const a = r() * 6.283, rad = 80 + Math.floor(r() * 10) * 30, p = at(a, rad), q = at(a, rad + 30); o.push(`<path d="M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}" stroke="${c.road}" stroke-width="3"/><path d="M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}" stroke="${c.wall}" stroke-width="2.4" stroke-dasharray="0.8 2"/>`); }
    o.push(fill(blob(hx, hy, 62, 46, 9, 0.15), c.park));
    for (let k = 0; k < 12; k++) { const a = r() * 6.283, d = r() * 40; o.push(`<circle cx="${f(hx + Math.cos(a) * d)}" cy="${f(hy + Math.sin(a) * d * 0.7)}" r="3" fill="${c.forest}"/>`); }
    o.push(`<circle cx="${f(hx + 18)}" cy="${f(hy - 6)}" r="7" fill="${c.plaza}" stroke="${c.wall}" stroke-width="1.6"/>`);
    const dir = 1.571 + (r() - 0.5) * 0.8, hp = []; for (let k = 0; k <= 10; k++) { const rad = 440 - k * 38; hp.push(at(dir + (k % 2 ? 0.32 : -0.32) * (rad / 300), rad)); } hp.push(at(dir, 56));
    o.push(big(curve(hp), 4.6));
    const sea = [[X0, H * (0.84 + r() * 0.06)], [W * 0.35, H * 0.9], [W * 0.7, H * (0.82 + r() * 0.08)], [X1, H * 0.88]];
    o.push(fill(`${curve(sea)}L${X1} ${Y1}L${X0} ${Y1}Z`, c.water), big(curve(sea.map(([x, y]) => [x, y - 10])), 5));
    for (let k = 0; k < 3; k++) { const x = W * (0.18 + k * 0.3); o.push(`<rect x="${f(x)}" y="${f(yOn(sea, x) - 2)}" width="12" height="40" fill="${c.contour}"/>`); }
  } else if (kind === 'ruralTown') { // 시골 읍내: 큰길 두 개가 만나는 네거리에 작은 동네(장터 · 버스터미널 · 학교 운동장), 둘레는 물 찬 논 · 초록 논 바둑판과 농로, 둑길 낀 개울, 띄엄띄엄 농가, 구석 뒷산
    const cx = W * (0.42 + r() * 0.16), cy = H * (0.42 + r() * 0.14), ga = (r() - 0.5) * 30, pd = [dark ? '#23382a' : '#cfe5bf', dark ? '#1d3848' : '#cde5f3', dark ? '#2a3b25' : '#dcebc4'];
    const T = [];
    for (let i = -14; i < 14; i++) for (let j = -14; j < 14; j++) T.push(`<rect x="${f(cx + i * 30 + 1.2)}" y="${f(cy + j * 22 + 1.2)}" width="27.6" height="19.6" fill="${pd[(i * 7 + j * 3 + 300 + Math.floor(r() * 2)) % 3]}"/>`);
    for (let i = -14; i < 14; i += 3) T.push(`<path d="M${f(cx + i * 30)} ${f(cy - 400)}V${f(cy + 400)}" stroke="${c.road}" stroke-width="1.6"/>`);
    T.push(`<path d="${blob(cx, cy, 96, 70, 10, 0.12)}" fill="${c.built}"/>`);
    o.push(`<g transform="rotate(${f(ga)} ${f(cx)} ${f(cy)})">${T.join('')}</g>`);
    o.push(grid(blob(cx, cy, 92, 66, 10, 0.1), ga, cx, cy, 24, 18, 2));
    o.push(fill(blob(X1 - 30, Y0 + 30, 140, 90, 9, 0.2), c.forest), fill(blob(X0 + 20, Y1 - 10, 110, 60, 9, 0.2), c.forest));
    const ck = [[X0, cy + 110 + r() * 30], [cx - 60, cy + 90], [cx + 60, cy + 120], [X1, cy + 80]];
    o.push(`<path d="${curve(ck)}" fill="none" stroke="${c.park}" stroke-width="28"/>`, `<path d="${curve(ck)}" fill="none" stroke="${c.water}" stroke-width="12"/>`, way(curve(ck.map(([x, y]) => [x, y - 14])), 2.2));
    const at = (u, v) => [cx + u * Math.cos(ga / 57.3) - v * Math.sin(ga / 57.3), cy + u * Math.sin(ga / 57.3) + v * Math.cos(ga / 57.3)];
    { const [x, y] = at(-40, -30); o.push(`<rect x="${f(x - 18)}" y="${f(y - 12)}" width="36" height="24" rx="2" fill="${c.plaza}" stroke="${c.wall}" stroke-width="1"/>${[0, 1, 2].map(k => `<path d="M${f(x - 12)} ${f(y - 6 + k * 6)}h24" stroke="${c.wall}" stroke-width="1.4" stroke-dasharray="4 2"/>`).join('')}`); }
    { const [x, y] = at(44, -26); o.push(`<rect x="${f(x - 20)}" y="${f(y - 12)}" width="40" height="24" rx="2" fill="${c.plaza}" stroke="${c.edge}"/>${[0, 1, 2, 3].map(k => `<path d="M${f(x - 14 + k * 9)} ${f(y - 8)}v10" stroke="${c.road}" stroke-width="2"/>`).join('')}<rect x="${f(x - 16)}" y="${f(y + 4)}" width="32" height="6" rx="1" fill="${c.bld}"/>`); }
    { const [x, y] = at(40, 34); o.push(`<rect x="${f(x - 26)}" y="${f(y - 16)}" width="52" height="32" rx="3" fill="${c.park}"/><ellipse cx="${f(x + 6)}" cy="${f(y)}" rx="16" ry="10" fill="${c.sand}"/><rect x="${f(x - 24)}" y="${f(y - 14)}" width="8" height="28" rx="1" fill="${c.bld}"/>`); }
    for (let k = 0; k < 6; k++) { const x = W * (0.05 + r() * 0.9), y = H * (0.05 + r() * 0.9); if (Math.hypot(x - cx, y - cy) < 130) continue; o.push(fill(blob(x, y, 14, 9, 6, 0.2), c.forest), `<rect x="${f(x - 4)}" y="${f(y - 3)}" width="8" height="6" rx="1" fill="${c.bld}"/><rect x="${f(x + 5)}" y="${f(y - 2)}" width="6" height="5" rx="1" fill="${c.bld}"/>`); }
    { const e = at(-700, 0), e2 = at(700, 0), e3 = at(0, -700), e4 = at(0, 700); o.push(big(`M${f(e[0])} ${f(e[1])}L${f(e2[0])} ${f(e2[1])}`, 5), big(`M${f(e3[0])} ${f(e3[1])}L${f(e4[0])} ${f(e4[1])}`, 5)); }
  } else if (kind === 'stationFront') { // 역 앞 번화가: 가로지르는 넓은 철길과 긴 역 건물, 역 앞 광장과 버스 로터리, 로터리에서 부채처럼 퍼지는 번화가(빽빽한 상가 · 큰 백화점 · 지붕 덮인 아케이드), 철길 너머는 결이 다른 동네
    const ry = H * (0.28 + r() * 0.08), ra = (r() - 0.5) * 0.2, sx = W * (0.4 + r() * 0.2), rl = x => ry + (x - sx) * Math.tan(ra);
    const below = `M${X0} ${f(rl(X0) + 26)}L${X1} ${f(rl(X1) + 26)}L${X1} ${Y1}L${X0} ${Y1}Z`, above = `M${X0} ${f(rl(X0) - 26)}L${X1} ${f(rl(X1) - 26)}L${X1} ${Y0}L${X0} ${Y0}Z`;
    o.push(grid(above, ra * 57.3 + 20 + r() * 20, W * 0.5, H * 0.1, 30, 24));
    const T = [], rx = sx, rcy = rl(sx) + 64;
    { const id = `${cidBase}_${nClip++}`; T.push(grid(below, ra * 57.3 + (r() - 0.5) * 10, rx, rcy, 22, 18, 2.2), `<clipPath id="${id}"><path d="${below}"/></clipPath><g clip-path="url(#${id})">`);
      const fan = [-2.75, -2.2, -1.57, -0.95, -0.4].map(a => a + 3.1416 + (r() - 0.5) * 0.1);
      for (let k = 0; k < fan.length - 1; k++) { const a0 = fan[k], a1 = fan[k + 1], m = (a0 + a1) / 2; const d = `M${f(rx)} ${f(rcy)}L${f(rx + Math.cos(a0) * 700)} ${f(rcy - Math.sin(a0) * 700 * -1)}L${f(rx + Math.cos(a1) * 700)} ${f(rcy + Math.sin(a1) * 700)}Z`;
        const gid = `${cidBase}_${nClip++}`, B = []; for (let i = -14; i < 14; i++) for (let j = 2; j < 30; j++) { const u = i * 17, v = j * 16; B.push(`<rect x="${f(rx + u + 1.5)}" y="${f(rcy + v + 1.5)}" width="13" height="12.5" rx="1" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.4"/>`); }
        T.push(`<clipPath id="${gid}"><path d="M${f(rx)} ${f(rcy)}L${f(rx + Math.cos(a0) * 700)} ${f(rcy + Math.sin(a0) * 700)}L${f(rx + Math.cos(a1) * 700)} ${f(rcy + Math.sin(a1) * 700)}Z"/></clipPath><g clip-path="url(#${gid})"><g transform="rotate(${f((m - 1.5708) * 57.3)} ${f(rx)} ${f(rcy)})">${B.join('')}</g></g>`); }
      for (const a of fan) T.push(way(`M${f(rx)} ${f(rcy)}L${f(rx + Math.cos(a) * 700)} ${f(rcy + Math.sin(a) * 700)}`, a === fan[2] ? 5 : 4));
      { const a = (fan[2] + fan[3]) / 2, p0 = 60, p1 = 220; T.push(`<path d="M${f(rx + Math.cos(a) * p0)} ${f(rcy + Math.sin(a) * p0)}L${f(rx + Math.cos(a) * p1)} ${f(rcy + Math.sin(a) * p1)}" stroke="${c.plaza}" stroke-width="7"/><path d="M${f(rx + Math.cos(a) * p0)} ${f(rcy + Math.sin(a) * p0)}L${f(rx + Math.cos(a) * p1)} ${f(rcy + Math.sin(a) * p1)}" stroke="${c.wall}" stroke-width="1.2" stroke-dasharray="2 3"/>`); }
      { const a = (fan[1] + fan[2]) / 2, d = 80, x = rx + Math.cos(a) * d, y = rcy + Math.sin(a) * d; T.push(`<rect x="${f(x - 22)}" y="${f(y - 16)}" width="44" height="32" rx="3" fill="${c.wall}" transform="rotate(${f((a - 1.5708) * 57.3)} ${f(x)} ${f(y)})"/>`); }
      T.push(`<rect x="${f(rx - 80)}" y="${f(rl(rx) + 26)}" width="160" height="22" fill="${c.plaza}"/><circle cx="${f(rx)}" cy="${f(rcy)}" r="34" fill="${c.edge}"/><circle cx="${f(rx)}" cy="${f(rcy)}" r="32" fill="${c.road}"/><circle cx="${f(rx)}" cy="${f(rcy)}" r="18" fill="${c.park}"/>`);
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; T.push(`<path d="M${f(rx + Math.cos(a) * 22)} ${f(rcy + Math.sin(a) * 22)}L${f(rx + Math.cos(a) * 30)} ${f(rcy + Math.sin(a) * 30)}" stroke="${c.wall}" stroke-width="1.2"/>`); }
      T.push('</g>'); }
    o.push(T.join(''));
    o.push(`<path d="M${X0} ${f(rl(X0))}L${X1} ${f(rl(X1))}" stroke="${c.contour}" stroke-width="50"/>`);
    for (let k = -3; k <= 3; k++) o.push(`<path d="M${X0} ${f(rl(X0) + k * 6.5)}L${X1} ${f(rl(X1) + k * 6.5)}" stroke="${c.rail}" stroke-width="1.5"/>`);
    o.push(`<rect x="-90" y="-10" width="180" height="24" rx="4" fill="${c.bld}" stroke="${c.wall}" stroke-width="1.2" transform="translate(${f(sx)} ${f(rl(sx) + 10)}) rotate(${f(ra * 57.3)})"/>`);
    o.push(big(`M${f(sx + 160)} ${Y0}L${f(sx + 190)} ${Y1}`, 5));
  } else if (kind === 'castleMoat') { // 해자 두른 성 마을: 집 줄 촘촘한 옛 성 아래 동네, 그 가운데 삐뚤한 다각형 성곽 두 겹(돌담 · 해자 · 숲), 꼭대기 천수각, 성 앞 곧은 대로, 동네 사이 절 마당, 옆을 흐르는 강
    const cx = W * (0.44 + r() * 0.12), cy = H * (0.42 + r() * 0.1), ga = (r() - 0.5) * 20;
    o.push(rowsGrid(`M${X0} ${Y0}H${X1}V${Y1}H${X0}Z`, ga, cx, cy, 44, 22));
    const poly = (s, n, j) => { const ph = r() * 6.283; return Array.from({ length: n }, (_, k) => { const a = ph + k / n * 6.283, q = s * (1 + (r() - 0.5) * j); return [cx + Math.cos(a) * q, cy + Math.sin(a) * q * 0.8]; }); };
    const P2 = poly(100, 9, 0.35), P1 = poly(52, 7, 0.35), D = p => `M${p.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
    o.push(`<path d="${D(P2)}" fill="${c.park}" stroke="${c.water}" stroke-width="18" stroke-linejoin="round"/>`, `<path d="${D(P2)}" fill="none" stroke="${c.wall}" stroke-width="1.4" stroke-linejoin="round" transform="translate(0 0)"/>`);
    for (let k = 0; k < 30; k++) { const a = r() * 6.283, d = 70 + r() * 36; o.push(`<circle cx="${f(cx + Math.cos(a) * d)}" cy="${f(cy + Math.sin(a) * d * 0.8)}" r="${f(3 + r() * 3)}" fill="${c.forest}"/>`); }
    o.push(`<path d="${D(P1)}" fill="${c.plaza}" stroke="${c.wall}" stroke-width="3" stroke-linejoin="round"/>`);
    o.push(`<rect x="${f(cx - 10)}" y="${f(cy - 14)}" width="22" height="18" rx="1.5" fill="${c.bld}" stroke="${c.wall}" stroke-width="1.2"/><rect x="${f(cx - 5)}" y="${f(cy - 10)}" width="12" height="10" rx="1" fill="${c.wall}"/><rect x="${f(cx + 18)}" y="${f(cy + 6)}" width="16" height="10" rx="1" fill="${c.bld}" stroke="${c.wall}" stroke-width="1"/>`);
    const g = P2[Math.floor(P2.length / 2)], g1 = P1[Math.floor(P1.length / 2)];
    o.push(way(`M${f(g[0])} ${f(g[1])}L${f((g[0] + g1[0]) / 2 + 8)} ${f((g[1] + g1[1]) / 2)}L${f(g1[0])} ${f(g1[1])}`, 3.4));
    const dx = g[0] - cx, dy = g[1] - cy, L = Math.hypot(dx, dy); o.push(big(`M${f(g[0])} ${f(g[1])}L${f(g[0] + dx / L * 500)} ${f(g[1] + dy / L * 500)}`, 5.4));
    for (let k = 0; k < 3; k++) { const a = r() * 6.283, d = 170 + r() * 70, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8; o.push(`<rect x="${f(x - 18)}" y="${f(y - 13)}" width="36" height="26" rx="2" fill="${c.plaza}" stroke="${c.edge}" stroke-width="0.8" transform="rotate(${f(ga)} ${f(x)} ${f(y)})"/><rect x="${f(x - 7)}" y="${f(y - 6)}" width="14" height="10" rx="1" fill="${c.wall}" transform="rotate(${f(ga)} ${f(x)} ${f(y)})"/>`, ...[[-13, 8], [13, 8], [-13, -8]].map(([a2, b2]) => `<circle cx="${f(x + a2)}" cy="${f(y + b2)}" r="3" fill="${c.forest}"/>`)); }
    const rv = [[X0, H * (0.84 + r() * 0.08)], [W * 0.4, H * 0.92], [W * 0.75, H * (0.84 + r() * 0.06)], [X1, H * 0.9]];
    o.push(`<path d="${curve(rv)}" fill="none" stroke="${c.park}" stroke-width="40"/>`, `<path d="${curve(rv)}" fill="none" stroke="${c.water}" stroke-width="22"/>`);
    for (const t of [0.25, 0.7]) { const x = W * t, y = yOn(rv, x); o.push(way(`M${f(x)} ${f(y - 22)}L${f(x + 2)} ${f(y + 22)}`, 4.6)); }
  } else if (kind === 'templeRuins') { // 사원 유적: 나무 우듬지 빽빽한 밀림, 숲을 두른 가는 네모 해자와 돌길, 가운데 회랑 · 돌 기단 · 탑 다섯, 숲 속 곳곳 작은 무너진 사원, 섬 사원 떠 있는 큰 저수지, 붉은 흙길
    const cx = W * (0.44 + r() * 0.12), cy = H * (0.44 + r() * 0.1), ga = (r() - 0.5) * 8, S = 120 + r() * 16, dirt = dark ? '#4a3e34' : '#e8d3b6';
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.forest}"/>`);
    const can = []; for (let k = 0; k < 420; k++) can.push(`<circle cx="${f(W * (-0.1 + r() * 1.2))}" cy="${f(H * (-0.1 + r() * 1.2))}" r="${f(3 + r() * 5)}" fill="${k % 3 ? c.park : c.vine}" opacity="${k % 3 ? '.55' : '.4'}"/>`); o.push(can.join(''));
    const by = cy - S * 0.8 - 34, bx = cx + (r() - 0.5) * 120; o.push(`<rect x="${f(bx - 150)}" y="${f(by - 26)}" width="300" height="40" rx="3" fill="${c.water}" transform="rotate(${f(ga)} ${f(cx)} ${f(cy)})"/><rect x="${f(bx - 7)}" y="${f(by - 13)}" width="14" height="14" rx="1" fill="${c.wall}" transform="rotate(${f(ga)} ${f(cx)} ${f(cy)})"/>`);
    o.push(`<path d="${curve([[X0, cy + S * 0.7 + 60], [cx - S, cy + S * 0.7 + 40], [cx + S * 0.5, cy + S * 0.7 + 70], [X1, cy + S * 0.7 + 30]])}" fill="none" stroke="${dirt}" stroke-width="5"/>`, `<path d="${curve([[cx + S + 30, Y0], [cx + S + 10, cy], [cx + S + 50, Y1]])}" fill="none" stroke="${dirt}" stroke-width="4"/>`);
    const T = [`<rect x="${f(cx - S)}" y="${f(cy - S * 0.8)}" width="${f(S * 2)}" height="${f(S * 1.6)}" fill="none" stroke="${c.water}" stroke-width="12"/>`];
    T.push(`<path d="M${f(cx)} ${f(cy + S * 0.8 + 8)}V${f(cy + S * 0.8 + 300)}" stroke="${dirt}" stroke-width="7"/><path d="M${f(cx)} ${f(cy + S * 0.8 + 10)}V${f(cy + S * 0.3)}" stroke="${c.sand}" stroke-width="7"/>`);
    T.push(`<rect x="${f(cx - S * 0.42)}" y="${f(cy - S * 0.36)}" width="${f(S * 0.84)}" height="${f(S * 0.7)}" fill="${c.plaza}" stroke="${c.wall}" stroke-width="2"/>`);
    T.push(`<rect x="${f(cx - S * 0.3)}" y="${f(cy - S * 0.26)}" width="${f(S * 0.6)}" height="${f(S * 0.5)}" fill="${c.sand}" stroke="${c.wall}" stroke-width="2.4"/><path d="M${f(cx - S * 0.3)} ${f(cy)}H${f(cx + S * 0.3)}M${f(cx)} ${f(cy - S * 0.26)}V${f(cy + S * 0.24)}" stroke="${c.wall}" stroke-width="1.4"/>`);
    for (const [ddx, ddy, s] of [[0, 0, 8], [-1, -1, 5], [1, -1, 5], [-1, 1, 5], [1, 1, 5]]) { const x = cx + ddx * S * 0.18, y = cy + ddy * S * 0.15; T.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${s}" fill="${c.wall}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.45)}" fill="${c.bld}"/>`); }
    o.push(`<g transform="rotate(${f(ga)} ${f(cx)} ${f(cy)})">${T.join('')}</g>`);
    for (let k = 0; k < 7; k++) { const x = W * (-0.05 + r() * 1.1), y = H * (-0.05 + r() * 1.1); if (Math.abs(x - cx) < S + 20 && Math.abs(y - cy) < S * 0.8 + 20) continue; o.push(fill(blob(x, y, 14, 11, 7, 0.25), c.park), `<rect x="${f(x - 5)}" y="${f(y - 5)}" width="10" height="10" rx="1" fill="${c.wall}"/><rect x="${f(x - 2)}" y="${f(y - 2)}" width="4" height="4" fill="${c.sand}"/>`); }
  } else if (kind === 'crater') { // 화산 분화구 마을: 바다에 잠긴 칼데라를 초승달처럼 두른 섬, 안쪽은 가파른 절벽 등고선, 절벽 위에 하얀 집들이 빼곡한 마을과 구불한 골목, 바깥 비탈은 포도밭과 검은 모래 해변, 칼데라 가운데 검은 새 화산섬, 등줄기 길
    const cx = W * (0.5 + (r() - 0.5) * 0.16), cy = H * (0.5 + (r() - 0.5) * 0.12), R = 150 + r() * 20, a0 = r() * 6.283, span = 3.6 + r() * 0.8, lava = dark ? '#1a1c20' : '#8f8a86';
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.water}"/>`);
    const ar = (rr, b0, b1, n = 30) => Array.from({ length: n }, (_, k) => { const a = b0 + (b1 - b0) * k / (n - 1), q = rr * (1 + 0.05 * Math.sin(4 * a + a0)); return [cx + Math.cos(a) * q, cy + Math.sin(a) * q * 0.86]; });
    const isl = (ri, ro, b0, b1) => curve([...ar(ro, b0, b1), ...ar(ri, b0, b1).reverse()], true);
    o.push(fill(isl(R - 4, R + 92, a0, a0 + span), c.sand), fill(isl(R, R + 84, a0 + 0.03, a0 + span - 0.03), c.land));
    const id = `${cidBase}_${nClip++}`, V = [];
    for (let rr = R + 30; rr < R + 84; rr += 6) V.push(`<path d="${curve(ar(rr, a0, a0 + span))}" fill="none" stroke="${c.park}" stroke-width="3.4" stroke-dasharray="${f(14 + r() * 20)} 5"/>`);
    o.push(`<clipPath id="${id}"><path d="${isl(R, R + 84, a0 + 0.03, a0 + span - 0.03)}"/></clipPath><g clip-path="url(#${id})">${V.join('')}`);
    for (let k = 0; k < 4; k++) o.push(`<path d="${curve(ar(R + 2 + k * 4, a0, a0 + span))}" fill="none" stroke="${c.wall}" stroke-width="${2.4 - k * 0.5}" opacity="${f(0.9 - k * 0.2)}"/>`);
    const vm = a0 + span * (0.3 + r() * 0.4), H0 = [];
    for (let k = 0; k < 140; k++) { const a = vm + (r() - 0.5) * 0.9, rr = R + 12 + Math.pow(r(), 1.6) * 34, q = rr * (1 + 0.05 * Math.sin(4 * a + a0)), x = cx + Math.cos(a) * q, y = cy + Math.sin(a) * q * 0.86; H0.push(`<rect x="${f(x - 2.6)}" y="${f(y - 2.2)}" width="5.2" height="4.4" rx="0.8" fill="${k % 9 ? c.road : c.water}" stroke="${c.edge}" stroke-width="0.5"/>`); }
    o.push(H0.join(''), way(curve(ar(R + 26, vm - 0.5, vm + 0.5, 14).map(([x, y], k) => [x + (k % 2) * 3, y])), 1.8), '</g>');
    o.push(big(curve(ar(R + 52, a0 + 0.15, a0 + span - 0.15)), 4.2));
    const ix = cx + (r() - 0.5) * 30, iy = cy + (r() - 0.5) * 20; o.push(fill(blob(ix, iy, 40, 30, 10, 0.25), lava));
    for (let k = 1; k <= 3; k++) o.push(`<path d="${blob(ix + 2, iy + 1, 40 - k * 10, 30 - k * 8, 9, 0.2)}" fill="none" stroke="${dark ? '#2b2e33' : '#a7a29d'}" stroke-width="1"/>`);
    o.push(fill(blob(cx + Math.cos(a0 + span + 0.6) * (R + 40), cy + Math.sin(a0 + span + 0.6) * (R + 40) * 0.86, 28, 18, 8, 0.2), c.land));
  } else if (kind === 'saltFlats') { // 염전 · 갯벌 마을: 둑으로 나뉜 큰 염전 묶음(안쪽은 잔잔한 물빛 칸들 · 소금 하얀 칸), 칸 사이 물길, 긴 소금 창고 줄, 바다 쪽 넓은 갯벌에 가늘게 갈라지는 갯골, 갈대밭, 갯벌 끝 바다와 고깃배
    const mud = dark ? '#363431' : '#e4ddd0', reed = dark ? '#3a3a2a' : '#e8e2bf', sal = [dark ? '#2c3a48' : '#dce9f1', dark ? '#3a4450' : '#f5f7f8', dark ? '#30414e' : '#cfe1ec', dark ? '#3c3a44' : '#ece4e8'];
    const dk = [[X0, H * (0.46 + r() * 0.08)], [W * 0.3, H * 0.5], [W * 0.6, H * (0.44 + r() * 0.08)], [X1, H * 0.5]];
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.land}"/>`);
    const ga = (r() - 0.5) * 10, T = [];
    for (let bi = 0; bi < 3; bi++) for (let bj = 0; bj < 2; bj++) { const x0 = W * (0.02 + bi * 0.33), y0 = H * (0.02 + bj * 0.22), bw = W * 0.3, bh = H * 0.19, n = 4 + bj, m = 3;
      T.push(`<rect x="${f(x0)}" y="${f(y0)}" width="${f(bw)}" height="${f(bh)}" rx="2" fill="${c.wall}"/>`);
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) T.push(`<rect x="${f(x0 + 3 + i * (bw - 6) / n)}" y="${f(y0 + 3 + j * (bh - 6) / m)}" width="${f((bw - 6) / n - 2)}" height="${f((bh - 6) / m - 2)}" rx="1" fill="${sal[(i + j * 2 + bi + bj * 3 + (r() < 0.2 ? 1 : 0)) % 4]}"/>`); }
    o.push(`<g transform="rotate(${f(ga)} ${f(W / 2)} ${f(H / 4)})">${T.join('')}</g>`);
    o.push(`<path d="M${X0} ${f(H * 0.235)}H${X1}" stroke="${c.water}" stroke-width="5" transform="rotate(${f(ga)} ${f(W / 2)} ${f(H / 4)})"/>`);
    for (let k = 0; k < 5; k++) o.push(`<rect x="${f(W * (0.08 + k * 0.18))}" y="${f(yOn(dk, W * (0.08 + k * 0.18)) - 26)}" width="44" height="10" rx="1.5" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.8"/>`);
    o.push(fill(`${curve(dk)}L${X1} ${Y1}L${X0} ${Y1}Z`, mud));
    { const rx0 = W * (r() < 0.5 ? 0.04 : 0.66); o.push(`<path d="${blob(rx0 + 60, yOn(dk, rx0 + 60) + 40, 70, 26, 9, 0.2)}" fill="${reed}"/>`); for (let k = 0; k < 40; k++) { const x = rx0 + 10 + r() * 100, y = yOn(dk, rx0 + 60) + 24 + r() * 32; o.push(`<path d="M${f(x)} ${f(y)}l1.5 -4" stroke="${c.wall}" stroke-width="0.8"/>`); } }
    const sea = [[X0, H * 0.9], [W * 0.4, H * 0.86], [W * 0.75, H * 0.92], [X1, H * 0.88]];
    const creek = (x, y, a, len, w, dpt) => { if (dpt > 4) return; const pts = [[x, y]]; let px = x, py = y, b = a; for (let k = 0; k < 5; k++) { b += (r() - 0.5) * 0.9; px += Math.cos(b) * len / 5; py += Math.sin(b) * len / 5; pts.push([px, py]); } o.push(`<path d="${curve(pts)}" fill="none" stroke="${c.water}" stroke-width="${f(w)}" stroke-linecap="round" opacity=".85"/>`); for (const sd of [-1, 1]) if (r() < 0.7) { const [qx, qy] = pts[2 + Math.floor(r() * 2)]; creek(qx, qy, b + sd * (0.5 + r() * 0.6), len * 0.55, w * 0.55, dpt + 1); } };
    for (let k = 0; k < 3; k++) creek(W * (0.15 + k * 0.33 + r() * 0.08), H * 0.9, -1.571 + (r() - 0.5) * 0.5, 120 + r() * 40, 5, 0);
    o.push(fill(`${curve(sea)}L${X1} ${Y1}L${X0} ${Y1}Z`, c.water));
    for (let k = 0; k < 4; k++) { const x = W * (0.15 + k * 0.22 + r() * 0.05), y = yOn(sea, x) + 14 + r() * 14; o.push(`<path d="M-6 0Q0 -3 6 0Q0 3 -6 0Z" fill="${c.road}" stroke="${c.edge}" stroke-width="0.6" transform="translate(${f(x)} ${f(y)}) rotate(${f(r() * 40 - 20)})"/>`); }
    o.push(`<path d="${curve(dk)}" fill="none" stroke="${c.wall}" stroke-width="8"/>`, big(curve(dk.map(([x, y]) => [x, y - 1])), 4));
  } else if (kind === 'caveTown') { // 동굴 · 바위 마을: 분홍빛 바위 땅에 구불구불 깎인 골짜기 결, 골짜기마다 모여 선 버섯바위, 바위 벼랑에 파 들어간 동굴 집, 작은 마을과 굽은 길, 하늘엔 알록달록 열기구
    const rock = dark ? '#3a302c' : '#efdccb', rock2 = dark ? '#453832' : '#e5cbb4', cone = dark ? '#57463d' : '#d8b79a', bal = dark ? ['#7a4a4a', '#7a6a3a', '#3e5a7a', '#5a4a7a'] : ['#f29a8e', '#f4cf6b', '#8fb8ec', '#c3a3e6'];
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${rock}"/>`);
    const vals = []; for (let k = 0; k < 4; k++) { const y0 = H * (0.1 + k * 0.26 + r() * 0.06), pts = Array.from({ length: 6 }, (_, j) => [X0 + j * (X1 - X0) / 5, y0 + (r() - 0.5) * 60]); vals.push(pts); o.push(`<path d="${curve(pts)}" fill="none" stroke="${rock2}" stroke-width="${f(40 + r() * 20)}" stroke-linecap="round"/>`); for (let q = 1; q <= 3; q++) for (const sd of [-1, 1]) o.push(`<path d="${curve(pts.map(([x, y], j) => [x, y + sd * (12 + q * 9) + Math.sin(j * 2 + q) * 4]))}" fill="none" stroke="${cone}" stroke-width="0.8" opacity=".7"/>`); o.push(`<path d="${curve(pts)}" fill="none" stroke="${c.park}" stroke-width="6" stroke-linecap="round" opacity=".8"/>`); }
    for (const pts of vals) for (let k = 0; k < 14; k++) { const x = W * (-0.05 + r() * 1.1), y = yOn(pts, Math.max(X0, Math.min(X1, x))) + (r() - 0.5) * 50, s = 4 + r() * 5; o.push(`<circle cx="${f(x + 1.5)}" cy="${f(y + 2)}" r="${f(s)}" fill="${cone}" opacity=".6"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}" fill="${cone}"/><circle cx="${f(x - s * 0.3)}" cy="${f(y - s * 0.3)}" r="${f(s * 0.4)}" fill="${rock}"/>`); }
    const v = vals[1], cx = W * (0.3 + r() * 0.4), cy = yOn(v, cx) - 30;
    for (let k = 0; k < 18; k++) { const x = cx - 80 + k * 9, y = yOn(v, Math.max(X0, Math.min(X1, x))) - 24 - (k % 3) * 5; o.push(`<rect x="${f(x - 3)}" y="${f(y - 3)}" width="6" height="5" rx="2.5" fill="${c.wall}"/>`); }
    o.push(fill(blob(cx + 40, cy - 40, 56, 26, 9, 0.2), c.built));
    for (let k = 0; k < 14; k++) o.push(`<rect x="${f(cx - 6 + (k % 7) * 13)}" y="${f(cy - 52 + Math.floor(k / 7) * 14)}" width="9" height="8" rx="1" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.5"/>`);
    o.push(way(curve([[X0, cy - 10], [cx - 40, cy - 30], [cx + 40, cy - 44], [cx + 140, cy - 20], [X1, cy - 60]]), 3.4), way(curve([[cx + 40, cy - 40], [cx + 60, H * 0.95], [cx + 20, Y1]]), 2.6));
    for (let k = 0; k < 6; k++) { const x = W * (0.08 + r() * 0.84), y = H * (0.06 + r() * 0.8), s = 6 + r() * 3, col = bal[k % 4]; o.push(`<ellipse cx="${f(x + 5)}" cy="${f(y + 18)}" rx="${f(s * 0.8)}" ry="${f(s * 0.3)}" fill="${c.edge}" opacity=".3"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}" fill="${col}" stroke="${c.road}" stroke-width="1"/><path d="M${f(x - s)} ${f(y)}Q${f(x)} ${f(y + 3)} ${f(x + s)} ${f(y)}M${f(x)} ${f(y - s)}V${f(y + s)}" fill="none" stroke="${c.road}" stroke-width="0.9" opacity=".8"/><path d="M${f(x - s * 0.5)} ${f(y + s * 0.86)}L${f(x - 1.6)} ${f(y + s + 4)}M${f(x + s * 0.5)} ${f(y + s * 0.86)}L${f(x + 1.6)} ${f(y + s + 4)}" stroke="${c.wall}" stroke-width="0.7"/><rect x="${f(x - 2)}" y="${f(y + s + 4)}" width="4" height="3" rx="0.6" fill="${c.wall}"/>`); }
  } else if (kind === 'savanna') { // 사바나 마을: 누런 풀밭에 듬성듬성 그늘 진 평평한 아카시아, 짐승 길이 모여드는 물웅덩이, 나무 줄 선 마른 강바닥, 가시 울타리 두른 둥근 마을(동그란 오두막 · 가운데 가축 우리), 흙길
    const grass = dark ? '#34352a' : '#ede3bf', dirt = dark ? '#4a3e34' : '#e3cfae', tree = dark ? '#2b4a2c' : '#9cc28a';
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${grass}"/>`);
    for (let k = 0; k < 60; k++) o.push(`<ellipse cx="${f(W * (-0.1 + r() * 1.2))}" cy="${f(H * (-0.1 + r() * 1.2))}" rx="${f(20 + r() * 40)}" ry="${f(8 + r() * 14)}" fill="${c.sand}" opacity=".5"/>`);
    { let g = ''; for (let k = 0; k < 520; k++) { const x = W * (-0.05 + r() * 1.1), y = H * (-0.05 + r() * 1.1); g += `M${f(x)} ${f(y)}l-1.4 -3.6M${f(x + 1.6)} ${f(y)}l0.6 -4M${f(x + 3)} ${f(y)}l1.8 -3`; } o.push(`<path d="${g}" stroke="${c.wall}" stroke-width="0.7" opacity=".45" stroke-linecap="round"/>`); }
    const rb = [[X0, H * (0.15 + r() * 0.2)], [W * 0.3, H * 0.3], [W * 0.55, H * (0.2 + r() * 0.15)], [X1, H * 0.35]];
    o.push(`<path d="${curve(rb)}" fill="none" stroke="${c.sand}" stroke-width="20" stroke-linecap="round"/>`, `<path d="${curve(rb)}" fill="none" stroke="${dirt}" stroke-width="8" stroke-linecap="round"/>`);
    for (let k = 0; k < 24; k++) { const x = W * (-0.05 + k * 0.046), y = yOn(rb, Math.max(X0, Math.min(X1, x))) + (k % 2 ? -16 : 16) + (r() - 0.5) * 6; o.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(4 + r() * 3)}" fill="${tree}"/>`); }
    const wx = W * (0.62 + r() * 0.2), wy = H * (0.62 + r() * 0.15);
    for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + r() * 0.4; o.push(`<path d="${curve([[wx + Math.cos(a) * 30, wy + Math.sin(a) * 22], [wx + Math.cos(a + 0.2) * 120, wy + Math.sin(a + 0.2) * 90], [wx + Math.cos(a - 0.1) * 300, wy + Math.sin(a - 0.1) * 240]])}" fill="none" stroke="${dirt}" stroke-width="1.4" stroke-dasharray="3 3"/>`); }
    o.push(fill(blob(wx, wy, 38, 26, 9, 0.2), dirt), fill(blob(wx, wy, 24, 16, 8, 0.25), c.water));
    for (let k = 0; k < 70; k++) { const g0 = Math.floor(k / 7), gx = W * (((g0 * 37) % 10) / 10 + 0.05), gy = H * (((g0 * 53) % 10) / 10 + 0.05), x = k % 7 < 5 ? gx + (r() - 0.5) * 90 : W * (-0.05 + r() * 1.1), y = k % 7 < 5 ? gy + (r() - 0.5) * 60 : H * (-0.05 + r() * 1.1), s = 4 + r() * 7; if (Math.hypot(x - wx, y - wy) < 50) continue; o.push(`<ellipse cx="${f(x + 3)}" cy="${f(y + 3)}" rx="${f(s * 1.2)}" ry="${f(s * 0.6)}" fill="${c.edge}" opacity=".35"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s * 1.3)}" ry="${f(s * 0.7)}" fill="${tree}"/>`); }
    const vx = W * (0.25 + r() * 0.2), vy = H * (0.62 + r() * 0.12), VR = 54;
    for (let k = 0; k < 7; k++) { const a = -0.6 + k * 0.35, d = VR + 22, x = vx + Math.cos(a) * d, y = vy + Math.sin(a) * d * 0.8; o.push(`<rect x="${f(x - 11)}" y="${f(y - 8)}" width="22" height="16" rx="2" fill="${k % 2 ? c.vine : c.park}" transform="rotate(${f(a * 57.3)} ${f(x)} ${f(y)})"/>`); }
    o.push(`<ellipse cx="${f(vx)}" cy="${f(vy)}" rx="${VR}" ry="${f(VR * 0.8)}" fill="${dirt}"/>`);
    for (let k = 0; k < 40; k++) { const a = k / 40 * 6.283; o.push(`<circle cx="${f(vx + Math.cos(a) * VR)}" cy="${f(vy + Math.sin(a) * VR * 0.8)}" r="3" fill="${tree}"/>`); }
    for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283 + 0.3, d = 36; o.push(`<circle cx="${f(vx + Math.cos(a) * d)}" cy="${f(vy + Math.sin(a) * d * 0.8)}" r="6" fill="${c.bld}" stroke="${c.wall}" stroke-width="1.2"/><circle cx="${f(vx + Math.cos(a) * d)}" cy="${f(vy + Math.sin(a) * d * 0.8)}" r="1.6" fill="${c.wall}"/>`); }
    o.push(`<ellipse cx="${f(vx)}" cy="${f(vy)}" rx="16" ry="12" fill="${c.sand}" stroke="${c.wall}" stroke-width="1.6" stroke-dasharray="2 2"/>`);
    { const hx = wx - 120 + r() * 60, hy = wy - 150 + r() * 40; for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; o.push(`<circle cx="${f(hx + Math.cos(a) * 14)}" cy="${f(hy + Math.sin(a) * 10)}" r="4.6" fill="${c.bld}" stroke="${c.wall}" stroke-width="1"/>`); } }
    for (let h = 0; h < 3; h++) { const ax = wx + (r() - 0.5) * 220, ay = wy + (r() - 0.5) * 140; for (let k = 0; k < 9; k++) o.push(`<ellipse cx="${f(ax + (r() - 0.5) * 30)}" cy="${f(ay + (r() - 0.5) * 16)}" rx="2" ry="1.2" fill="${c.wall}"/>`); }
    { const bx = W * (0.1 + r() * 0.8), by = H * (0.1 + r() * 0.3); o.push(`<circle cx="${f(bx + 4)}" cy="${f(by + 4)}" r="15" fill="${c.edge}" opacity=".3"/><circle cx="${f(bx)}" cy="${f(by)}" r="15" fill="${c.forest}"/><circle cx="${f(bx - 4)}" cy="${f(by - 4)}" r="6" fill="${tree}"/>`); }
    for (let k = 0; k < 12; k++) o.push(`<circle cx="${f(W * r())}" cy="${f(H * r())}" r="2.2" fill="${c.wall}"/>`);
    o.push(`<path d="${curve([[X0, vy + 60], [vx - 40, vy + VR * 0.8], [vx + 80, vy + 30], [wx - 40, wy + 10], [X1, wy + 80]])}" fill="none" stroke="${dirt}" stroke-width="5" stroke-linecap="round"/>`);
  } else if (kind === 'tropicalResort') { // 열대 해변 리조트: 밀림 뒤 언덕, 야자수 줄 선 하얀 모래 해변, 정원 속 빌라와 둥근 수영장들, 바다로 뻗은 수상 빌라 다리, 얕은 옥빛 바다와 산호초, 파도 줄
    const lag = dark ? '#1d4a5a' : '#bfe8ea', reef = dark ? '#1a3d52' : '#9fd8e0', palm = dark ? '#2b5a3a' : '#7fbf86', pool = dark ? '#2a6a8a' : '#8fd3f0';
    const sh = [[X0, H * (0.5 + r() * 0.08)], [W * 0.3, H * 0.56], [W * 0.6, H * (0.5 + r() * 0.08)], [X1, H * 0.54]];
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.forest}"/>`);
    for (let k = 0; k < 200; k++) o.push(`<circle cx="${f(W * (-0.1 + r() * 1.2))}" cy="${f(H * (-0.1 + r() * 0.7))}" r="${f(3 + r() * 5)}" fill="${c.park}" opacity=".5"/>`);
    o.push(fill(`${curve(sh.map(([x, y]) => [x, y - 90]))}L${X1} ${Y1}L${X0} ${Y1}Z`, c.park));
    o.push(fill(`${curve(sh.map(([x, y]) => [x, y - 18]))}L${X1} ${Y1}L${X0} ${Y1}Z`, c.sand));
    o.push(fill(`${curve(sh)}L${X1} ${Y1}L${X0} ${Y1}Z`, lag));
    o.push(fill(`${curve(sh.map(([x, y]) => [x, y + 110]))}L${X1} ${Y1}L${X0} ${Y1}Z`, c.water));
    for (let k = 0; k < 18; k++) { const x = X0 + 10 + k * 34 + r() * 10; o.push(fill(blob(x, yOn(sh, Math.max(X0, Math.min(X1, x))) + 106, 18 + r() * 8, 7 + r() * 3, 7, 0.3), reef)); }
    o.push(`<path d="${curve(sh.map(([x, y]) => [x, y + 122]))}" fill="none" stroke="${c.road}" stroke-width="1.4" opacity=".7" stroke-dasharray="24 10"/>`);
    for (let k = 0; k < 10; k++) o.push(fill(blob(W * (0.05 + r() * 0.9), yOn(sh, W * 0.5) + 40 + r() * 50, 10 + r() * 10, 5 + r() * 4, 7, 0.3), reef));
    for (let k = 0; k < 4; k++) { const x = W * (0.1 + k * 0.24 + r() * 0.05), y = yOn(sh, x) - 60; o.push(`<rect x="${f(x - 20)}" y="${f(y - 14)}" width="40" height="28" rx="3" fill="${c.bld}" stroke="${c.wall}" stroke-width="1"/>`, `<path d="${blob(x + 6, y + 30, 18, 8, 8, 0.25)}" fill="${pool}" stroke="${c.road}" stroke-width="2"/>`); }
    for (let k = 0; k < 30; k++) { const x = X0 + 20 + k * 17 + r() * 6, y = yOn(sh, Math.max(X0, Math.min(X1, x))) - 26 - r() * 14; let g = ''; for (let j = 0; j < 6; j++) { const a = j / 6 * 6.283; g += `M${f(x)} ${f(y)}l${f(Math.cos(a) * 6)} ${f(Math.sin(a) * 6)}`; } o.push(`<path d="${g}" stroke="${palm}" stroke-width="2.2" stroke-linecap="round"/>`); }
    const px = W * (0.55 + r() * 0.25), py = yOn(sh, px); o.push(`<path d="M${f(px)} ${f(py)}V${f(py + 70)}M${f(px - 50)} ${f(py + 70)}H${f(px + 50)}" stroke="${c.wall}" stroke-width="3" stroke-linecap="round"/>`);
    for (let k = 0; k < 7; k++) o.push(`<rect x="${f(px - 54 + k * 16)}" y="${f(py + (k % 2 ? 72 : 58))}" width="10" height="10" rx="1.5" fill="${c.bld}" stroke="${c.wall}" stroke-width="1"/>`);
    o.push(way(curve(sh.map(([x, y]) => [x, y - 88])), 3.4), big(curve(sh.map(([x, y]) => [x, y - 140])), 4.6));
  } else if (kind === 'airportTown') { // 공항 옆 동네: 풀밭 위 나란한 활주로 둘(흰 점선 · 끝 줄무늬), 유도로, 휜 터미널과 줄 선 비행기, 관제탑, 큰 주차장, 공항 가는 큰길, 옆 동네는 집 줄 촘촘한 바둑판
    const ga = (r() - 0.5) * 30, cx = W * 0.5, cy = H * (0.4 + r() * 0.1), rw = dark ? '#3c434e' : '#c9ccd1', sd = r() < 0.5 ? 1 : -1;
    o.push(rowsGrid(`M${X0} ${Y0}H${X1}V${Y1}H${X0}Z`, ga + 8, cx, cy + 200, 40, 22));
    const T = [`<rect x="-700" y="${f(cy - 110)}" width="1400" height="210" fill="${c.park}"/>`];
    for (const [y, L] of [[cy - 70, 700], [cy + 20, 560]]) { T.push(`<rect x="${f(cx - L / 2)}" y="${f(y - 9)}" width="${L}" height="18" rx="2" fill="${rw}"/><path d="M${f(cx - L / 2 + 20)} ${f(y)}H${f(cx + L / 2 - 20)}" stroke="${c.road}" stroke-width="1.4" stroke-dasharray="10 8"/>`); for (const e of [-1, 1]) for (let k = -2; k <= 2; k++) T.push(`<path d="M${f(cx + e * (L / 2 - 6))} ${f(y + k * 3)}h${f(-e * 10)}" stroke="${c.road}" stroke-width="1.4"/>`); }
    T.push(`<path d="M${f(cx - 300)} ${f(cy - 40)}H${f(cx + 300)}M${f(cx - 240)} ${f(cy - 70)}V${f(cy + 20)}M${f(cx + 60)} ${f(cy - 70)}V${f(cy + 60)}M${f(cx + 220)} ${f(cy - 70)}V${f(cy + 20)}" stroke="${rw}" stroke-width="6" stroke-linecap="round"/>`);
    T.push(`<rect x="${f(cx - 10)}" y="${f(cy + 50)}" width="170" height="40" rx="3" fill="${c.contour}"/><path d="M${f(cx)} ${f(cy + 92)}Q${f(cx + 75)} ${f(cy + 70)} ${f(cx + 150)} ${f(cy + 92)}" fill="none" stroke="${c.bld}" stroke-width="14" stroke-linecap="round"/><path d="M${f(cx)} ${f(cy + 92)}Q${f(cx + 75)} ${f(cy + 70)} ${f(cx + 150)} ${f(cy + 92)}" fill="none" stroke="${c.wall}" stroke-width="1"/>`);
    for (let k = 0; k < 6; k++) { const x = cx + 14 + k * 25, y = cy + 64; T.push(`<path d="M${f(x)} ${f(y - 8)}v16M${f(x - 7)} ${f(y - 1)}h14M${f(x - 3)} ${f(y + 6)}h6" stroke="${c.road}" stroke-width="2.4" stroke-linecap="round"/><path d="M${f(x)} ${f(y - 8)}v16M${f(x - 7)} ${f(y - 1)}h14M${f(x - 3)} ${f(y + 6)}h6" stroke="${c.wall}" stroke-width="0.8" stroke-linecap="round"/>`); }
    T.push(`<circle cx="${f(cx - 30)}" cy="${f(cy + 66)}" r="6" fill="${c.bld}" stroke="${c.wall}" stroke-width="1.6"/>`);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) T.push(`<rect x="${f(cx + 4 + i * 19)}" y="${f(cy + 104 + j * 12)}" width="16" height="9" rx="1" fill="${c.contour}"/>`);
    T.push(big(`M${f(cx + 75)} ${f(cy + 98)}V${f(cy + 600)}`, 5.4));
    o.push(`<g transform="rotate(${f(ga)} ${f(cx)} ${f(cy)})">${T.join('')}</g>`);
  } else { // railHub: 큰 종착역에서 철길이 부채처럼 퍼지고 셋으로 갈라져 나가요, 역 앞 고리 큰길 안 옛 동네, 밖은 바둑판
    const cx = W * (0.4 + r() * 0.2), cy = H * (0.62 + r() * 0.06), st = [cx + (r() - 0.5) * 40, cy - 112];
    o.push(grid(`M${X0} ${Y0}H${X1}V${Y1}H${X0}Z`, (r() - 0.5) * 24, W * 0.5, H * 0.5, 32, 26));
    const trk = d => `<path d="${d}" fill="none" stroke="${c.rail}" stroke-width="1.5"/>`;
    const sweep = side => { const sd = side, p = [[st[0] + sd * 34, st[1] - 4], [st[0] + sd * 40, st[1] - 70], [st[0] + sd * 110, st[1] - 150], [st[0] + sd * 260, st[1] - 210], [st[0] + sd * 520, st[1] - 250]];
      o.push(`<path d="${curve(p)}" fill="none" stroke="${c.contour}" stroke-width="40" stroke-linecap="round"/>`);
      for (let j = -2; j <= 2; j++) o.push(trk(curve(p.map(([x, y], i) => [x + j * 6 * (i < 2 ? 1 : 0.7), y + (i > 1 ? j * 5 * sd : 0)])))); };
    sweep(-1); sweep(1);
    o.push(`<rect x="${f(st[0] - 64)}" y="${f(st[1] - 46)}" width="128" height="44" fill="${c.contour}"/>`);
    for (let k = 0; k < 9; k++) o.push(trk(`M${f(st[0] - 56 + k * 14)} ${f(st[1])}V${f(st[1] - 44)}`));
    o.push(`<rect x="${f(st[0] - 82)}" y="${f(st[1] - 4)}" width="164" height="26" rx="4" fill="${c.bld}" stroke="${c.edge}"/>`);
    const ring = `M${f(cx - 120)} ${f(cy)}C${f(cx - 120)} ${f(cy - 90)} ${f(cx + 120)} ${f(cy - 90)} ${f(cx + 120)} ${f(cy)}S${f(cx - 120)} ${f(cy + 90)} ${f(cx - 120)} ${f(cy)}Z`;
    o.push(grid(ring, 30 + r() * 30, cx, cy, 17, 15, 1.8));
    o.push(`<rect x="${f(cx - 22)}" y="${f(cy - 12)}" width="44" height="26" rx="3" fill="${c.plaza}" stroke="${c.edge}"/>`);
    o.push(fill(`M${f(cx - 150)} ${f(cy - 40)}l-40 10v120l40 20z`, c.park), fill(blob(cx + 190, cy + 40, 46, 70, 8, 0.15), c.park));
    o.push(big(ring, 6.5), big(`M${f(cx + 116)} ${f(cy + 10)}L${X1} ${f(cy + 40)}`, 5), big(`M${f(cx - 116)} ${f(cy + 20)}L${X0} ${f(cy + 60)}`, 5));
    o.push(`<path d="${curve([[X0, H * 1.0], [W * 0.4, H * 0.96], [W * 0.8, H * 1.04], [X1, H * 0.98]])}" fill="none" stroke="${c.water}" stroke-width="22"/>`);
  }
  const tr = `translate(${W / 2} ${H / 2}) rotate(${tilt}) scale(${mirror ? -1 : 1} 1) translate(${-W / 2} ${-H / 2})`;
  return `<g transform="${tr}">${o.join('')}</g>`;
}
const KINDS = ['oldRiver', 'gridLake', 'star', 'bay', 'island', 'mountain', 'canals', 'octagon', 'suburb', 'confluence', 'walled', 'railHub', 'hillPort', 'fjordVillage', 'canalGrid', 'deltaCity', 'oasis', 'farmVillage', 'medina', 'lakeResort', 'riverIslands', 'collegeTown', 'alpineValley', 'hilltop', 'interchange', 'portDocks', 'bigRiver', 'apartments', 'alleys', 'downtown', 'atoll', 'stiltVillage', 'riceTerraces', 'canyon', 'usTown', 'euroSquare', 'beachTown', 'campus', 'strait', 'archipelago', 'polarPort', 'pivotFarms', 'mountainCity', 'hillside', 'ruralTown', 'stationFront', 'castleMoat', 'templeRuins', 'crater', 'saltFlats', 'caveTown', 'savanna', 'tropicalResort', 'airportTown'];
const KO = { oldRiver: '강가 구시가지', gridLake: '바둑판 + 호수', star: '방사형 광장', bay: '만 · 해안', island: '섬', mountain: '산골 마을', canals: '반원 운하', octagon: '사선 바둑판 + 바다', suburb: '교외 고리길', confluence: '두 강이 만나는 곳', walled: '별 모양 성곽', railHub: '철길이 모이는 역', hillPort: '계단식 언덕 항구', fjordVillage: '피오르 마을', canalGrid: '운하 바둑판', deltaCity: '삼각주 도시', oasis: '사막 오아시스', farmVillage: '논밭 사이 마을', medina: '성벽 안 미로 골목', lakeResort: '호숫가 휴양지', riverIslands: '강 가운데 섬', collegeTown: '대학 도시', alpineValley: '알프스 골짜기', hilltop: '언덕 꼭대기 마을', interchange: '신도시 나들목', portDocks: '컨테이너 항구', bigRiver: '큰 강 대도시', apartments: '아파트 단지', alleys: '골목 주택가', downtown: '도심 업무지구', atoll: '산호섬 환초', stiltVillage: '수상가옥 마을', riceTerraces: '계단식 논', canyon: '협곡 도시', usTown: '미국 소도시', euroSquare: '유럽 소도시 광장', beachTown: '해변 소도시', campus: '학교 캠퍼스 동네', strait: '해협 도시', archipelago: '다도해', polarPort: '극지 항구', pivotFarms: '원형 농장 사막', mountainCity: '산 아래 도시', hillside: '언덕 주택가', ruralTown: '시골 읍내', stationFront: '역 앞 번화가', castleMoat: '해자 두른 성 마을', templeRuins: '사원 유적', crater: '화산 분화구 마을', saltFlats: '염전 · 갯벌 마을', caveTown: '동굴 · 바위 마을', savanna: '사바나 마을', tropicalResort: '열대 해변 리조트', airportTown: '공항 옆 동네' };
return { draw, KINDS, KO, hsh };
})();
if (typeof module !== 'undefined') module.exports = TOWN3;
