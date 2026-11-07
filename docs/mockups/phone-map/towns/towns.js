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
// the four snowy Norwegian maps picked by hand: a town's name picks one of them
const NO6 = ['Bergen', 'Bodo', 'Hammerfest', 'Kirkenes'];
// Egypt: twelve maps drawn one by one; a town's name picks one (the names below pick their own)
const EG12 = ['Cairo', 'Giza', 'Luxor', 'Valley of the Kings', 'Aswan', 'Alexandria', 'Siwa', 'Hurghada', 'Tanta', 'Port Said', 'Old Cairo', 'Abu Simbel'];
// names (English, Korean, Arabic spelling) that pick their own Egypt map, in EG12 order
const EG_NAMES = [['cairo', '카이로', 'zamalek', '자말렉', 'downtown cairo'], ['giza', '기자', 'pyramid', '피라미드'], ['luxor', '룩소르', 'karnak', '카르나크'], ['valley of the kings', '왕가의 계곡', 'deir el', '데이르'], ['aswan', '아스완', 'nubia', '누비아', 'philae', '필레'], ['alexandria', '알렉산드리아', 'iskandariya'], ['siwa', '시와', 'bahariya', '바하리야', 'farafra', '파라프라', 'dakhla', '다클라', 'kharga', '카르가', 'oasis', '오아시스'], ['hurghada', '후르가다', 'sharm', '샤름', 'dahab', '다합', 'gouna', '구나', 'marsa alam', '마르사알람', 'red sea', '홍해'], ['tanta', '탄타', 'mansoura', '만수라', 'zagazig', '자가지그', 'delta', '삼각주', 'fayoum', '파이윰'], ['port said', '포트사이드', 'suez', '수에즈', 'ismailia', '이스마일리아'], ['old cairo', '옛 카이로', 'islamic cairo', '이슬람 카이로', 'khan el', '칸 엘', 'coptic', '콥트'], ['abu simbel', '아부심벨', 'lake nasser', '나세르']];
const EGY = {
  light: { land: '#f4e7c8', built: '#eee2c9', park: '#d3e4b4', forest: '#9fc285', vine: '#e2e9bf', sand: '#ead7a8', road: '#fffaf0', edge: '#dccaa3', contour: '#e5d2a6', plaza: '#f2e6cd', bld: '#e6d5b4', wall: '#cdb68a' },
  dark: { land: '#2e2a24', built: '#332e27', park: '#26321f', forest: '#2b4a2c', vine: '#2e3424', sand: '#3a3429', road: '#4a4438', edge: '#1c1914', contour: '#38322a', plaza: '#3a352d', bld: '#3d372e', wall: '#5a4d38' },
};
const SNOW = {
  light: { land: '#f8fafc', built: '#eef2f6', park: '#e3ece8', forest: '#d6e3dc', road: '#ffffff', edge: '#d3dbe4', contour: '#e4eaf0', water: '#b7d0e8', plaza: '#f1efea', sand: '#eef0f2' },
  dark: { land: '#262d36', built: '#2c343e', park: '#26322e', forest: '#22302a', road: '#46505e', edge: '#161b22', contour: '#303843', water: '#173149', plaza: '#30353c', sand: '#2c3138' },
};
function draw(kind, W, H, seed, dark = false) {
  const c = { ...PAL[dark ? 'dark' : 'light'], ...(kind === 'noSnow' ? SNOW[dark ? 'dark' : 'light'] : kind === 'egypt' ? EGY[dark ? 'dark' : 'light'] : {}) }, r = rng(`${kind}|${kind === 'noSnow' ? (NO6.includes(seed) ? seed : NO6[hsh(seed) % NO6.length]) : seed}`), o = [];
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
  } else if (kind === 'villaTown') { // 한국 빌라촌: 삐뚤한 블록마다 빽빽이 들어선 다세대 빌라, 골목에 줄지어 선 차, 작은 놀이터, 교회 십자가, 모퉁이 편의점, 버스 다니는 큰길과 길가 상가
    const sp = 54 + r() * 8, ga = (r() - 0.5) * 36, N = Math.ceil(Math.max(W, H) * 1.7 / sp), P = [], C = W / 2, D = H / 2, ca = Math.cos(ga / 57.3), sa = Math.sin(ga / 57.3);
    const car = dark ? ['#4a5260', '#5a5040', '#3e4a5a', '#56565c'] : ['#cfd5de', '#e3d8c2', '#c3cfe0', '#dcdcde'];
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.road}"/>`);
    for (let i = 0; i <= N; i++) { P.push([]); for (let j = 0; j <= N; j++) { const u = (i - N / 2) * sp + (r() - 0.5) * sp * 0.35, v = (j - N / 2) * sp * 0.8 + (r() - 0.5) * sp * 0.3; P[i].push([C + u * ca - v * sa, D + u * sa + v * ca]); } }
    const B = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const q = [P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1]], mx = q.reduce((s, p) => s + p[0], 0) / 4, my = q.reduce((s, p) => s + p[1], 0) / 4, t = (i * 7 + j * 11) % 23;
      const sh = k => `M${q.map(([x, y]) => `${f(mx + (x - mx) * k)} ${f(my + (y - my) * k)}`).join('L')}Z`;
      if (t === 3 || t === 15) { B.push(`<path d="${sh(0.84)}" fill="${c.park}"/><circle cx="${f(mx)}" cy="${f(my)}" r="5" fill="${c.sand}"/>`); for (let k = 0; k < 4; k++) B.push(`<circle cx="${f(mx + (k % 2 ? 1 : -1) * sp * 0.25)}" cy="${f(my + (k > 1 ? 1 : -1) * sp * 0.2)}" r="3" fill="${c.forest}"/>`); continue; }
      if (t === 19) { B.push(`<path d="${sh(0.84)}" fill="${c.plaza}"/>`); for (let k = -2; k <= 2; k++) B.push(`<path d="M${f(mx + k * 6 * ca - 8 * -sa)} ${f(my + k * 6 * sa - 8 * ca)}l${f(16 * -sa)} ${f(16 * ca)}" stroke="${c.road}" stroke-width="1"/>`); continue; }
      B.push(`<path d="${sh(0.88)}" fill="${c.built}"/>`);
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { if (r() < 0.22) continue; const u = (a - 0.5) * sp * 0.44, v = (b - 0.5) * sp * 0.38, x = mx + u * ca - v * sa, y = my + u * sa + v * ca; B.push(`<rect x="${f(x - 7.5 + r())}" y="${f(y - 4.5)}" width="${f(13 + r() * 3)}" height="${f(8 + r() * 2)}" rx="1" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.6" transform="rotate(${f(ga)} ${f(x)} ${f(y)})"/>`); }
      if (t === 7) B.push(`<path d="M${f(mx - 3)} ${f(my)}h6M${f(mx)} ${f(my - 4)}v8" stroke="${c.wall}" stroke-width="1.6"/>`);
      if (t === 12) B.push(`<rect x="${f(mx - 6)}" y="${f(my - 4)}" width="12" height="8" rx="1" fill="${c.plaza}" stroke="${c.wall}" stroke-width="1"/>`); }
    o.push(B.join(''));
    for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) if (r() < 0.35) { const a = P[i][j], b = P[i][j + 1]; for (let k = 1; k < 4; k++) { const x = a[0] + (b[0] - a[0]) * k / 4 + 2.6, y = a[1] + (b[1] - a[1]) * k / 4; o.push(`<rect x="${f(x - 1.6)}" y="${f(y - 3)}" width="3.2" height="6" rx="1" fill="${car[(i + j + k) % 4]}" transform="rotate(${f(ga)} ${f(x)} ${f(y)})"/>`); } }
    const m = Math.floor(N / 2) + Math.floor((r() - 0.5) * 3), row = P.map(rw => rw[m]);
    o.push(`<path d="${curve(row)}" fill="none" stroke="${c.plaza}" stroke-width="20"/>`);
    for (let k = 0; k < N * 3; k++) { const t = k / (N * 3), i = Math.floor(t * N), u = t * N - i, x = row[i][0] + (row[i + 1][0] - row[i][0]) * u, y = row[i][1] + (row[i + 1][1] - row[i][1]) * u; for (const s of [-1, 1]) o.push(`<rect x="${f(x - 3)}" y="${f(y + s * 8 - 2.5)}" width="6" height="5" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.5" transform="rotate(${f(ga)} ${f(x)} ${f(y)})"/>`); }
    o.push(big(curve(row), 5.4), way(curve(P[Math.floor(N / 2) + 2].map(p => p)), 3.6));
  } else if (kind === 'jpHouses') { // 일본 단독주택가: 좁은 길 바둑판(동네마다 방향이 살짝 달라요), 작은 마당 딸린 집들이 촘촘, 동네 작은 공원, 신사 숲, 모퉁이 편의점, 한쪽을 지나는 전철과 작은 역, 둑길 낀 개천
    const ga = (r() - 0.5) * 30, ga2 = ga + 12 + r() * 14, cut = [[X0, H * (0.3 + r() * 0.2)], [W * 0.5, H * 0.5], [X1, H * (0.6 + r() * 0.2)]];
    const hood = (d, a, cx, cy) => { const id = `${cidBase}_${nClip++}`, T = [], sx = 30, sy = 24; for (let i = -14; i <= 14; i++) for (let j = -16; j <= 16; j++) { const x = cx + i * sx, y = cy + j * sy, t = ((i * 13 + j * 7) % 31 + 31) % 31;
        if (t === 5) { T.push(`<rect x="${f(x + 2)}" y="${f(y + 2)}" width="${sx - 4}" height="${sy - 4}" rx="2" fill="${c.park}"/><circle cx="${f(x + 10)}" cy="${f(y + 10)}" r="3" fill="${c.sand}"/>`); continue; }
        if (t === 17) { T.push(`<rect x="${f(x + 2)}" y="${f(y + 2)}" width="${sx - 4}" height="${sy - 4}" rx="2" fill="${c.forest}"/><path d="M${f(x + 11)} ${f(y + 15)}h8M${f(x + 12)} ${f(y + 13)}v5M${f(x + 18)} ${f(y + 13)}v5" stroke="${c.majorEdge}" stroke-width="1.3"/>`); continue; }
        for (const [dx, dy] of [[3, 3], [16, 3], [3, 13], [16, 13]]) { if (r() < 0.1) continue; const w = 8 + r() * 2.4, h = 6.5 + r() * 2; T.push(`<rect x="${f(x + dx)}" y="${f(y + dy)}" width="${f(w)}" height="${f(h)}" rx="0.8" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.5"/>`); if (r() < 0.3) T.push(`<circle cx="${f(x + dx + w + 1)}" cy="${f(y + dy + h)}" r="1.6" fill="${c.forest}"/>`); }
        if (t === 11) T.push(`<rect x="${f(x + 3)}" y="${f(y + 3)}" width="12" height="8" rx="1" fill="${c.plaza}" stroke="${c.wall}" stroke-width="0.8"/>`); }
      for (let i = -14; i <= 14; i++) T.push(way(`M${f(cx + i * sx)} ${f(cy - 420)}V${f(cy + 420)}`, 1.9)); for (let j = -16; j <= 16; j++) T.push(way(`M${f(cx - 440)} ${f(cy + j * sy)}H${f(cx + 440)}`, 1.9));
      return `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})"><path d="${d}" fill="${c.built}"/><g transform="rotate(${f(a)} ${f(cx)} ${f(cy)})">${T.join('')}</g></g>`; };
    o.push(hood(`${curve(cut)}L${X1} ${Y0}L${X0} ${Y0}Z`, ga, W * 0.5, H * 0.2), hood(`${curve(cut)}L${X1} ${Y1}L${X0} ${Y1}Z`, ga2, W * 0.5, H * 0.8));
    o.push(`<path d="${curve(cut)}" fill="none" stroke="${c.park}" stroke-width="30"/>`, `<path d="${curve(cut)}" fill="none" stroke="${c.water}" stroke-width="12"/>`, way(curve(cut.map(([x, y]) => [x, y - 12])), 2.6));
    const rl = [[X0, H * (0.08 + r() * 0.1)], [X1, H * (0.14 + r() * 0.1)]];
    o.push(`<path d="M${f(rl[0][0])} ${f(rl[0][1])}L${f(rl[1][0])} ${f(rl[1][1])}" stroke="${c.land}" stroke-width="12"/>`, rail(`M${f(rl[0][0])} ${f(rl[0][1])}L${f(rl[1][0])} ${f(rl[1][1])}`));
    { const sx = W * (0.3 + r() * 0.4), sy = rl[0][1] + (rl[1][1] - rl[0][1]) * (sx - X0) / (X1 - X0), a = Math.atan2(rl[1][1] - rl[0][1], rl[1][0] - rl[0][0]) * 57.3; o.push(`<rect x="${f(sx - 26)}" y="${f(sy + 6)}" width="52" height="10" rx="2" fill="${c.bld}" stroke="${c.wall}" stroke-width="1" transform="rotate(${f(a)} ${f(sx)} ${f(sy)})"/><path d="M${f(sx)} ${f(sy + 16)}L${f(sx + 10)} ${Y1}" stroke="${c.plaza}" stroke-width="8"/>`, way(`M${f(sx)} ${f(sy + 16)}L${f(sx + 10)} ${Y1}`, 3)); }
  } else if (kind === 'terraces') { // 영국 테라스 하우스 동네: 살짝 휘며 나란히 가는 거리마다 양쪽으로 길게 붙은 집 줄, 집 뒤 좁고 긴 뒷마당 띠와 뒷골목, 모퉁이 펍, 동네 공원, 교회, 가게 늘어선 하이 스트리트
    const ga = (r() - 0.5) * 30, sp = 52 + r() * 6, bend = 10 + r() * 20, cx = W * 0.5, cy = H * 0.5, T = [];
    T.push(`<rect x="${f(cx - 700)}" y="${f(cy - 700)}" width="1400" height="1400" fill="${c.park}"/>`);
    const st = y => curve(Array.from({ length: 9 }, (_, k) => [cx - 500 + k * 125, cy + y + Math.sin(k * 0.8 + y / 90) * bend]));
    const pk = Math.floor(r() * 4) - 2, ys = []; for (let y = -sp * 7; y <= sp * 7; y += sp) ys.push(y);
    for (const y of ys) for (const s of [-1, 1]) T.push(`<path d="${st(y + s * 16)}" fill="none" stroke="${c.vine}" stroke-width="13" stroke-dasharray="6 1.4"/>`);
    for (const y of ys) T.push(way(st(y + sp / 2), 1.4));
    for (const y of ys) for (const s of [-1, 1]) T.push(`<path d="${st(y + s * 7.5)}" fill="none" stroke="${c.wall}" stroke-width="9.4"/><path d="${st(y + s * 7.5)}" fill="none" stroke="${c.bld}" stroke-width="8" stroke-dasharray="5.4 0.9"/>`);
    for (const y of ys) T.push(way(st(y), 3));
    for (let x = -480; x <= 480; x += 150 + r() * 40) T.push(way(`M${f(cx + x)} ${f(cy - 700)}V${f(cy + 700)}`, 3));
    T.push(`<rect x="${f(cx - 60 + pk * 40)}" y="${f(cy + sp * 1 - 2)}" width="100" height="${f(sp * 2 + 4)}" fill="${c.park}"/><path d="M${f(cx - 60 + pk * 40)} ${f(cy + sp)}L${f(cx + 40 + pk * 40)} ${f(cy + sp * 3)}M${f(cx + 40 + pk * 40)} ${f(cy + sp)}L${f(cx - 60 + pk * 40)} ${f(cy + sp * 3)}" stroke="${c.road}" stroke-width="2"/>`);
    for (let k = 0; k < 10; k++) T.push(`<circle cx="${f(cx - 50 + pk * 40 + (k % 5) * 20)}" cy="${f(cy + sp + 10 + Math.floor(k / 5) * (sp * 2 - 20))}" r="4" fill="${c.forest}"/>`);
    for (let k = 0; k < 3; k++) { const x = cx - 300 + k * 260 + r() * 40, y = ys[2 + k * 3] ?? 0; T.push(`<rect x="${f(x - 7)}" y="${f(cy + y - 7)}" width="14" height="14" rx="2" fill="${c.wall}"/>`); }
    T.push(`<rect x="${f(cx - 22 - pk * 60)}" y="${f(cy - sp * 2 - 18)}" width="44" height="16" rx="1.5" fill="${c.bld}" stroke="${c.wall}" stroke-width="1"/><rect x="${f(cx + 16 - pk * 60)}" y="${f(cy - sp * 2 - 24)}" width="9" height="9" rx="1" fill="${c.wall}"/>`);
    const hs = `M${f(cx - 700)} ${f(cy - sp * 4.5)}L${f(cx + 700)} ${f(cy - sp * 4.5 + 60)}`;
    T.push(`<path d="${hs}" stroke="${c.plaza}" stroke-width="24"/>`, `<path d="${hs}" stroke="${c.wall}" stroke-width="22" stroke-dasharray="6 1" opacity=".35"/>`, big(hs, 5.4));
    o.push(`<g transform="rotate(${f(ga)} ${f(cx)} ${f(cy)})">${T.join('')}</g>`);
  } else if (kind === 'courtyardBlocks') { // 독일 중정 블록 시가지: 가운데 마당을 두른 네모 건물 블록(마당엔 나무), 가로수 줄 선 넓은 거리, 가운데 트램 다니는 큰길, 블록 하나 비운 작은 광장과 분수, 사선으로 가로지르는 대로, 고가 철길 호
    const ga = (r() - 0.5) * 20, bw = 70 + r() * 10, bh = 56 + r() * 8, cx = W * 0.5, cy = H * 0.5, ox = r() * bw, oy = r() * bh, T = [];
    T.push(`<rect x="${f(cx - 700)}" y="${f(cy - 700)}" width="1400" height="1400" fill="${c.road}"/>`);
    const sqI = Math.floor(r() * 2), sqJ = Math.floor(r() * 2);
    for (let i = -7; i <= 7; i++) for (let j = -9; j <= 9; j++) { const x = cx + i * bw - ox, y = cy + j * bh - oy, p = 7, w = bw - p * 2, h = bh - p * 2;
      if (i === sqI && j === sqJ) { T.push(`<rect x="${f(x + p)}" y="${f(y + p)}" width="${f(w)}" height="${f(h)}" rx="2" fill="${c.plaza}" stroke="${c.edge}" stroke-width="0.8"/><circle cx="${f(x + bw / 2)}" cy="${f(y + bh / 2)}" r="6" fill="${c.water}" stroke="${c.road}" stroke-width="2"/>`); for (let k = 0; k < 8; k++) T.push(`<circle cx="${f(x + p + 5 + (k % 4) * (w - 10) / 3)}" cy="${f(y + p + 5 + Math.floor(k / 4) * (h - 10))}" r="3" fill="${c.forest}"/>`); continue; }
      if ((i * 5 + j * 3 + 40) % 17 === 0) { T.push(`<rect x="${f(x + p)}" y="${f(y + p)}" width="${f(w)}" height="${f(h)}" rx="2" fill="${c.park}"/>`); for (let k = 0; k < 6; k++) T.push(`<circle cx="${f(x + p + 6 + r() * (w - 12))}" cy="${f(y + p + 6 + r() * (h - 12))}" r="${f(3 + r() * 2)}" fill="${c.forest}"/>`); continue; }
      T.push(`<rect x="${f(x + p)}" y="${f(y + p)}" width="${f(w)}" height="${f(h)}" rx="1.5" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.7"/><rect x="${f(x + p + 10)}" y="${f(y + p + 9)}" width="${f(w - 20)}" height="${f(h - 18)}" rx="1" fill="${(i + j) % 3 ? c.park : c.plaza}"/>`);
      if ((i + j) % 3) T.push(`<circle cx="${f(x + bw / 2 + (r() - 0.5) * 10)}" cy="${f(y + bh / 2)}" r="3.4" fill="${c.forest}"/>`);
      for (let k = 1; k < 4; k++) T.push(`<path d="M${f(x + p + k * w / 4)} ${f(y + p)}v${f(h)}" stroke="${c.wall}" stroke-width="0.4" opacity=".4"/>`); }
    for (let i = -7; i <= 8; i++) for (let k = 0; k < 18; k++) T.push(`<circle cx="${f(cx + i * bw - ox)}" cy="${f(cy - 9 * bh - oy + k * bh + bh / 4)}" r="2.4" fill="${c.forest}" opacity=".8"/>`);
    const ty = cy + (Math.floor(r() * 3) - 1) * bh - oy; T.push(big(`M${f(cx - 700)} ${f(ty)}H${f(cx + 700)}`, 9), rail(`M${f(cx - 700)} ${f(ty)}H${f(cx + 700)}`));
    T.push(big(`M${f(cx - 600)} ${f(cy + 500)}L${f(cx + 600)} ${f(cy - 400)}`, 6));
    o.push(`<g transform="rotate(${f(ga)} ${f(cx)} ${f(cy)})">${T.join('')}</g>`);
    const ar = [[X0, H * (0.9 + r() * 0.1)], [W * 0.4, H * 0.72], [W * 0.8, H * 0.8], [X1, H * (0.95 + r() * 0.1)]];
    o.push(`<path d="${curve(ar)}" fill="none" stroke="${c.contour}" stroke-width="12"/>`, rail(curve(ar)));
  } else if (kind === 'jpSuburb') { // 일본 교외 역세권: 가로지르는 철길과 작은 역, 역 앞 작은 로터리와 지붕 덮인 상점가, 역 가까이 맨션 몇 동, 멀어질수록 띄엄띄엄 집과 밭 · 비닐하우스, 큰 슈퍼와 주차장, 학교 운동장, 개천
    const ga = (r() - 0.5) * 20, cx = W * (0.42 + r() * 0.16), cy = H * 0.5, T = [];
    T.push(`<rect x="${f(cx - 700)}" y="${f(cy - 700)}" width="1400" height="1400" fill="${c.built}"/>`);
    const crop = [c.vine, c.park, dark ? '#2a3328' : '#e6ecd0'];
    for (let i = -14; i <= 14; i++) for (let j = -14; j <= 14; j++) { const x = cx + i * 28, y = cy + j * 24, d = Math.hypot(i * 28, j * 24 * 1.3), t = ((i * 13 + j * 7) % 29 + 29) % 29;
      if (Math.abs(j) <= 1) continue;
      if (d > 150 && r() < Math.min(0.7, (d - 150) / 200)) { T.push(`<rect x="${f(x + 1)}" y="${f(y + 1)}" width="26" height="22" fill="${crop[t % 3]}"/>`); if (t % 5 === 0) for (let k = 0; k < 3; k++) T.push(`<rect x="${f(x + 3)}" y="${f(y + 3 + k * 6.5)}" width="22" height="4.5" rx="1" fill="${c.road}" stroke="${c.edge}" stroke-width="0.4"/>`); continue; }
      if (d < 120 && t % 4 === 0) { T.push(`<rect x="${f(x + 3)}" y="${f(y + 4)}" width="22" height="9" rx="1" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.8"/><rect x="${f(x + 3)}" y="${f(y + 15)}" width="22" height="5" rx="1" fill="${c.plaza}"/>`); continue; }
      for (const [dx, dy] of [[3, 3], [16, 3], [3, 13], [16, 13]]) if (r() < (d < 200 ? 0.85 : 0.5)) T.push(`<rect x="${f(x + dx)}" y="${f(y + dy)}" width="${f(8 + r() * 2)}" height="${f(6.5 + r() * 2)}" rx="0.8" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.5"/>`); }
    for (let i = -14; i <= 14; i++) T.push(way(`M${f(cx + i * 28)} ${f(cy - 400)}V${f(cy + 400)}`, i % 4 ? 1.8 : 3)); for (let j = -14; j <= 14; j++) if (Math.abs(j) > 1) T.push(way(`M${f(cx - 420)} ${f(cy + j * 24)}H${f(cx + 420)}`, j % 4 ? 1.8 : 3));
    T.push(`<path d="M${f(cx - 700)} ${f(cy)}H${f(cx + 700)}" stroke="${c.land}" stroke-width="30"/>`, rail(`M${f(cx - 700)} ${f(cy - 4)}H${f(cx + 700)}`), rail(`M${f(cx - 700)} ${f(cy + 4)}H${f(cx + 700)}`));
    T.push(`<rect x="${f(cx - 30)}" y="${f(cy - 12)}" width="60" height="24" rx="3" fill="${c.bld}" stroke="${c.wall}" stroke-width="1.2"/>`);
    T.push(`<circle cx="${f(cx)}" cy="${f(cy - 34)}" r="14" fill="${c.plaza}" stroke="${c.edge}"/><circle cx="${f(cx)}" cy="${f(cy - 34)}" r="5" fill="${c.park}"/>`);
    T.push(`<path d="M${f(cx)} ${f(cy - 48)}V${f(cy - 220)}" stroke="${c.plaza}" stroke-width="12"/><path d="M${f(cx)} ${f(cy - 48)}V${f(cy - 220)}" stroke="${c.wall}" stroke-width="1.4" stroke-dasharray="2 3"/>`);
    T.push(`<rect x="${f(cx + 60)}" y="${f(cy + 26)}" width="56" height="44" rx="2" fill="${c.plaza}"/><rect x="${f(cx + 64)}" y="${f(cy + 30)}" width="48" height="16" rx="1" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.8"/>${[0, 1, 2, 3, 4].map(k => `<path d="M${f(cx + 66 + k * 10)} ${f(cy + 50)}v16" stroke="${c.road}" stroke-width="1"/>`).join('')}`);
    T.push(`<rect x="${f(cx - 150)}" y="${f(cy + 60)}" width="70" height="48" rx="3" fill="${c.sand}"/><ellipse cx="${f(cx - 115)}" cy="${f(cy + 84)}" rx="24" ry="14" fill="${c.park}" stroke="${c.road}" stroke-width="1.2"/><rect x="${f(cx - 150)}" y="${f(cy + 44)}" width="40" height="12" rx="1" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.8"/>`);
    o.push(`<g transform="rotate(${f(ga)} ${f(cx)} ${f(cy)})">${T.join('')}</g>`);
    const rv = [[X0, H * (0.82 + r() * 0.1)], [W * 0.4, H * 0.76], [W * 0.75, H * (0.86 + r() * 0.06)], [X1, H * 0.8]];
    o.push(`<path d="${curve(rv)}" fill="none" stroke="${c.park}" stroke-width="26"/>`, `<path d="${curve(rv)}" fill="none" stroke="${c.water}" stroke-width="10"/>`);
    o.push(big(`M${f(cx + 180)} ${Y0}L${f(cx + 220)} ${Y1}`, 5));
  } else if (kind === 'krTown') { // 한국 지방 소도시 시내: 가운데 로터리 네거리, 큰길 따라 빽빽한 상가, 지붕 덮인 전통시장, 앞마당 넓은 군청, 버스터미널, 가장자리 아파트 몇 동, 둑길 낀 하천과 다리, 둘레 논밭과 뒷산
    const cx = W * (0.44 + r() * 0.12), cy = H * (0.44 + r() * 0.1), ga = (r() - 0.5) * 24, pd = [dark ? '#23382a' : '#cfe5bf', dark ? '#1d3848' : '#cde5f3', dark ? '#2a3b25' : '#dcebc4'], T = [];
    for (let i = -14; i < 14; i++) for (let j = -14; j < 14; j++) T.push(`<rect x="${f(cx + i * 30 + 1.2)}" y="${f(cy + j * 22 + 1.2)}" width="27.6" height="19.6" fill="${pd[((i * 7 + j * 3) % 3 + 3) % 3]}"/>`);
    T.push(`<path d="${blob(cx, cy, 150, 110, 10, 0.1)}" fill="${c.built}"/>`);
    o.push(`<g transform="rotate(${f(ga)} ${f(cx)} ${f(cy)})">${T.join('')}</g>`);
    o.push(grid(blob(cx, cy, 146, 106, 10, 0.1), ga + 4, cx, cy, 30, 24, 2));
    o.push(fill(blob(X1 - 20, Y0 + 20, 150, 100, 10, 0.2), c.forest));
    for (let k = 1; k <= 3; k++) o.push(`<path d="${blob(X1 - 10, Y0 + 10, 150 - k * 34, 100 - k * 24, 9, 0.12)}" fill="none" stroke="${c.park}" stroke-width="1.2"/>`);
    const at = (u, v) => [cx + u * Math.cos(ga / 57.3) - v * Math.sin(ga / 57.3), cy + u * Math.sin(ga / 57.3) + v * Math.cos(ga / 57.3)], ang = ga;
    const shops = (u0, u1, v, horiz) => { for (let u = u0; u < u1; u += 8) for (const s of [-1, 1]) { const [x, y] = horiz ? at(u, v + s * 9) : at(v + s * 9, u); o.push(`<rect x="${f(x - 3.6)}" y="${f(y - 3.4)}" width="7.2" height="6.8" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.8" transform="rotate(${f(ang)} ${f(x)} ${f(y)})"/>`); } };
    shops(-140, -20, 0, true); shops(20, 140, 0, true); shops(-110, -20, 0, false); shops(20, 110, 0, false);
    { const [x, y] = at(-60, -50); o.push(`<rect x="${f(x - 34)}" y="${f(y - 20)}" width="68" height="40" rx="2" fill="${c.plaza}" stroke="${c.wall}" stroke-width="1" transform="rotate(${f(ang)} ${f(x)} ${f(y)})"/>`, ...[-1, 0, 1].map(k => `<path d="M${f(x - 30)} ${f(y + k * 11)}h60" stroke="${c.wall}" stroke-width="1.2" stroke-dasharray="5 2" transform="rotate(${f(ang)} ${f(x)} ${f(y)})"/>`)); }
    { const [x, y] = at(60, -56); o.push(`<rect x="${f(x - 30)}" y="${f(y - 22)}" width="60" height="44" rx="2" fill="${c.park}" transform="rotate(${f(ang)} ${f(x)} ${f(y)})"/><rect x="${f(x - 20)}" y="${f(y - 20)}" width="40" height="12" rx="1.5" fill="${c.bld}" stroke="${c.wall}" stroke-width="1" transform="rotate(${f(ang)} ${f(x)} ${f(y)})"/><rect x="${f(x - 12)}" y="${f(y - 4)}" width="24" height="18" rx="1" fill="${c.plaza}" transform="rotate(${f(ang)} ${f(x)} ${f(y)})"/>`); }
    { const [x, y] = at(70, 52); o.push(`<rect x="${f(x - 26)}" y="${f(y - 16)}" width="52" height="32" rx="2" fill="${c.plaza}" stroke="${c.edge}" transform="rotate(${f(ang)} ${f(x)} ${f(y)})"/>`, ...[0, 1, 2, 3].map(k => `<path d="M${f(x - 20 + k * 12)} ${f(y - 12)}v12" stroke="${c.road}" stroke-width="2.2" transform="rotate(${f(ang)} ${f(x)} ${f(y)})"/>`)); }
    for (let k = 0; k < 4; k++) { const [x, y] = at(-150 + k * 22, 70 + (k % 2) * 16); o.push(`<rect x="${f(x - 8)}" y="${f(y - 4)}" width="16" height="30" rx="1.5" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.7" transform="rotate(${f(ang + 90)} ${f(x)} ${f(y)})"/>`); }
    const ck = [[X0, cy + 140 + r() * 20], [cx - 60, cy + 124], [cx + 80, cy + 150], [X1, cy + 120]];
    o.push(`<path d="${curve(ck)}" fill="none" stroke="${c.park}" stroke-width="34"/>`, `<path d="${curve(ck)}" fill="none" stroke="${c.water}" stroke-width="14"/>`);
    { const e = at(-600, 0), e2 = at(600, 0), e3 = at(0, -600), e4 = at(0, 600); o.push(big(`M${f(e[0])} ${f(e[1])}L${f(e2[0])} ${f(e2[1])}`, 5.4), big(`M${f(e3[0])} ${f(e3[1])}L${f(e4[0])} ${f(e4[1])}`, 5.4)); }
    o.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="18" fill="${c.majorEdge}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="16" fill="${c.major}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="9" fill="${c.park}"/>`);
  } else if (kind === 'haussmann') { // 프랑스 오스만 블록 시가지: 건물이 꽉 찬 블록(작은 안마당), 구역마다 다른 결의 거리, 비스듬히 가로지르는 가로수 대로, 대로가 만나는 둥근 광장, 정원 광장과 성당
    const cx = W * (0.42 + r() * 0.16), cy = H * (0.42 + r() * 0.16), a1 = r() * 3.1416, a2 = a1 + 0.9 + r() * 0.6, a3 = a1 - 0.8 - r() * 0.5;
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.bld}"/>`);
    const ray = a => [cx + Math.cos(a) * 900, cy + Math.sin(a) * 900], angs = [a1, a2, a1 + 3.1416, a3 + 3.1416, a3, a2 + 3.1416].sort((a, b) => a - b);
    for (let k = 0; k < angs.length; k++) { const b0 = angs[k], b1 = angs[(k + 1) % angs.length] + (k === angs.length - 1 ? 6.283 : 0), mid = (b0 + b1) / 2, id = `${cidBase}_${nClip++}`, d = `M${f(cx)} ${f(cy)}L${ray(b0).map(f).join(' ')}L${ray(mid).map(v => f(v)).join(' ')}L${ray(b1).map(f).join(' ')}Z`;
      const g = (mid * 57.3) + (r() - 0.5) * 30, sx = 38 + r() * 12, sy = 30 + r() * 10, L = [];
      for (let i = -14; i <= 14; i++) for (let j = -16; j <= 16; j++) L.push(`<rect x="${f(cx + i * sx + sx * 0.36)}" y="${f(cy + j * sy + sy * 0.34)}" width="${f(sx * 0.28)}" height="${f(sy * 0.3)}" rx="1" fill="${c.plaza}"/>`);
      for (let i = -14; i <= 14; i++) L.push(way(`M${f(cx + i * sx)} ${f(cy - 600)}V${f(cy + 600)}`, 2.6)); for (let j = -16; j <= 16; j++) L.push(way(`M${f(cx - 600)} ${f(cy + j * sy)}H${f(cx + 600)}`, 2.6));
      o.push(`<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})"><g transform="rotate(${f(g)} ${f(cx)} ${f(cy)})">${L.join('')}</g></g>`); }
    for (const a of [a1, a2, a3]) { const p = ray(a), q = ray(a + 3.1416), d = `M${f(q[0])} ${f(q[1])}L${f(p[0])} ${f(p[1])}`; o.push(way(d, 7)); for (const s of [-1, 1]) o.push(`<path d="${d}" stroke="${c.forest}" stroke-width="3.4" stroke-dasharray="0.1 9" stroke-linecap="round" transform="translate(${f(-Math.sin(a) * s * 2.4)} ${f(Math.cos(a) * s * 2.4)})"/>`); }
    o.push(big(`M${f(ray(a1 + 3.1416)[0])} ${f(ray(a1 + 3.1416)[1])}L${f(ray(a1)[0])} ${f(ray(a1)[1])}`, 5.6));
    o.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="26" fill="${c.edge}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="24.5" fill="${c.road}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="12" fill="${c.park}"/><rect x="${f(cx - 4)}" y="${f(cy - 3)}" width="8" height="6" rx="1" fill="${c.wall}"/>`);
    { const a = a2 + 0.4, d = 130, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; o.push(`<rect x="${f(x - 30)}" y="${f(y - 22)}" width="60" height="44" rx="3" fill="${c.park}" stroke="${c.road}" stroke-width="3"/><circle cx="${f(x)}" cy="${f(y)}" r="5" fill="${c.water}"/>`, ...[[-20, -14], [20, -14], [-20, 14], [20, 14]].map(([u, v]) => `<circle cx="${f(x + u)}" cy="${f(y + v)}" r="3.4" fill="${c.forest}"/>`)); }
    { const a = a3 - 0.5, d = 150, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; o.push(`<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a * 57.3)})"><rect x="-22" y="-7" width="44" height="14" rx="1.5" fill="${c.wall}"/><rect x="-6" y="-15" width="12" height="30" rx="1.5" fill="${c.wall}"/><circle cx="18" cy="0" r="5" fill="${c.wall}"/></g>`); }
  } else if (kind === 'auSuburb') { // 호주 넓은 교외: 굽은 큰길에서 갈라진 굽은 동네길과 막다른 둥근 길, 넓은 마당 집마다 뒤뜰 수영장, 유칼립투스 나무 많이, 큰 주차장 낀 쇼핑센터, 크리켓 오벌, 개울 따라 초록 띠
    const grass = dark ? '#263022' : '#e6edd4', pool = dark ? '#2a6a8a' : '#8fd3f0', gum = dark ? '#2e4a34' : '#a9c99b';
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${grass}"/>`);
    const ck = [[X0, H * (0.6 + r() * 0.2)], [W * 0.3, H * 0.66], [W * 0.6, H * (0.5 + r() * 0.2)], [X1, H * 0.56]];
    o.push(`<path d="${curve(ck)}" fill="none" stroke="${c.park}" stroke-width="46"/>`, `<path d="${curve(ck)}" fill="none" stroke="${c.water}" stroke-width="4"/>`);
    const art = [[W * (0.2 + r() * 0.2), Y0], [W * 0.35, H * 0.4], [W * 0.3, H * 0.75], [W * 0.38, Y1]];
    const streets = [];
    for (let k = 0; k < 9; k++) { const t = 0.08 + k * 0.1, i = Math.min(2, Math.floor(t * 3)), u = t * 3 - i, x = art[i][0] + (art[i + 1][0] - art[i][0]) * u, y = art[i][1] + (art[i + 1][1] - art[i][1]) * u, sd = k % 2 ? 1 : -1, len = 90 + r() * 80, b = (sd > 0 ? 0 : 3.1416) + (r() - 0.5) * 0.6;
      const p1 = [x + Math.cos(b) * len * 0.5 + (r() - 0.5) * 20, y + Math.sin(b) * len * 0.5 + 14], p2 = [x + Math.cos(b) * len, y + Math.sin(b) * len + (r() - 0.5) * 40]; streets.push([[x, y], p1, p2]); }
    const qb = (a, b, e, t) => [(1 - t) * (1 - t) * a[0] + 2 * t * (1 - t) * b[0] + t * t * e[0], (1 - t) * (1 - t) * a[1] + 2 * t * (1 - t) * b[1] + t * t * e[1]];
    for (const [a, b, e] of streets) for (let k = 1; k <= 7; k++) { const t = k / 8.2, [x, y] = qb(a, b, e, t), [x2, y2] = qb(a, b, e, t + 0.01), an = Math.atan2(y2 - y, x2 - x); for (const sd of [-1, 1]) { const hx = x - Math.sin(an) * sd * 14, hy = y + Math.cos(an) * sd * 14; o.push(`<rect x="${f(hx - 6)}" y="${f(hy - 4.5)}" width="12" height="9" rx="1.2" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.6" transform="rotate(${f(an * 57.3)} ${f(hx)} ${f(hy)})"/>`); if (r() < 0.3) { const px = x - Math.sin(an) * sd * 25, py = y + Math.cos(an) * sd * 25; o.push(`<rect x="${f(px - 3.5)}" y="${f(py - 2)}" width="7" height="4" rx="1.6" fill="${pool}" stroke="${c.road}" stroke-width="0.8" transform="rotate(${f(an * 57.3)} ${f(px)} ${f(py)})"/>`); } } }
    for (let k = 0; k < 50; k++) o.push(`<circle cx="${f(W * (-0.05 + r() * 1.1))}" cy="${f(H * (-0.05 + r() * 1.1))}" r="${f(3 + r() * 3)}" fill="${gum}"/>`);
    for (const [a, b, e] of streets) o.push(way(`M${f(a[0])} ${f(a[1])}Q${f(b[0])} ${f(b[1])} ${f(e[0])} ${f(e[1])}`, 3), `<circle cx="${f(e[0])}" cy="${f(e[1])}" r="8" fill="${c.road}" stroke="${c.edge}" stroke-width="1.3"/>`);
    const sx = W * (0.72 + r() * 0.12), sy = H * (0.22 + r() * 0.1); o.push(`<rect x="${f(sx - 60)}" y="${f(sy - 40)}" width="120" height="80" rx="4" fill="${c.plaza}"/>`, `<rect x="${f(sx - 54)}" y="${f(sy - 34)}" width="60" height="34" rx="2" fill="${c.bld}" stroke="${c.wall}" stroke-width="1"/>`);
    for (let k = 0; k < 9; k++) o.push(`<path d="M${f(sx - 52 + k * 12)} ${f(sy + 6)}v28" stroke="${c.road}" stroke-width="1"/>`);
    const ox = W * (0.62 + r() * 0.2), oy = H * (0.82 + r() * 0.08); o.push(`<ellipse cx="${f(ox)}" cy="${f(oy)}" rx="40" ry="30" fill="${c.park}" stroke="${c.road}" stroke-width="2"/><rect x="${f(ox - 2)}" y="${f(oy - 7)}" width="4" height="14" fill="${c.sand}"/>`);
    o.push(big(curve(art), 5.4), way(`M${f(sx - 60)} ${f(sy)}L${f(art[1][0])} ${f(art[1][1])}`, 4));
  } else if (kind === 'cnSuperblock') { // 중국 대로 사이 큰 단지: 가운데 초록 띠 있는 넓은 대로, 담장 두른 큰 단지마다 줄지은 고층 아파트와 정원 · 굽은 산책길 · 정문, 대로변 상가 띠, 호수 공원 블록, 큰 쇼핑몰 광장
    const ga = (r() - 0.5) * 16, bw = 150 + r() * 20, bh = 118 + r() * 16, cx = W * 0.5, cy = H * 0.5, ox = r() * bw, oy = r() * bh, T = [];
    T.push(`<rect x="${f(cx - 700)}" y="${f(cy - 700)}" width="1400" height="1400" fill="${c.road}"/>`);
    for (let i = -4; i <= 4; i++) for (let j = -5; j <= 5; j++) { const x = cx + i * bw - ox, y = cy + j * bh - oy, p = 14, w = bw - p * 2, h = bh - p * 2, t = ((i * 5 + j * 3) % 11 + 11) % 11;
      if (t === 4) { T.push(`<rect x="${f(x + p)}" y="${f(y + p)}" width="${f(w)}" height="${f(h)}" rx="4" fill="${c.park}"/>`, fill(blob(x + bw / 2, y + bh / 2, w * 0.32, h * 0.28, 9, 0.2), c.water)); for (let k = 0; k < 12; k++) T.push(`<circle cx="${f(x + p + 6 + r() * (w - 12))}" cy="${f(y + p + 6 + r() * (h - 12))}" r="3" fill="${c.forest}"/>`); continue; }
      if (t === 8) { T.push(`<rect x="${f(x + p)}" y="${f(y + p)}" width="${f(w)}" height="${f(h)}" rx="3" fill="${c.plaza}"/><rect x="${f(x + p + 10)}" y="${f(y + p + 10)}" width="${f(w * 0.6)}" height="${f(h * 0.5)}" rx="6" fill="${c.bld}" stroke="${c.wall}" stroke-width="1.2"/>`); for (let k = 0; k < 8; k++) T.push(`<path d="M${f(x + p + 10 + k * 12)} ${f(y + p + h * 0.66)}v${f(h * 0.26)}" stroke="${c.road}" stroke-width="1"/>`); continue; }
      T.push(`<rect x="${f(x + p)}" y="${f(y + p)}" width="${f(w)}" height="${f(h)}" rx="3" fill="${c.park}" stroke="${c.wall}" stroke-width="1.2"/>`, `<path d="${curve([[x + p + 8, y + bh / 2], [x + bw * 0.4, y + bh * 0.3], [x + bw * 0.6, y + bh * 0.7], [x + bw - p - 8, y + bh / 2]])}" fill="none" stroke="${c.road}" stroke-width="2"/>`);
      const slab = t % 2, nx = slab ? 3 : 4, ny = slab ? 4 : 3;
      for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) { const hx = x + p + 10 + (a + 0.5) * (w - 20) / nx, hy = y + p + 8 + (b + 0.5) * (h - 16) / ny, ww = slab ? 26 : 12, hh = slab ? 8 : 12; T.push(`<rect x="${f(hx - ww / 2 + 2.5)}" y="${f(hy - hh / 2 + 2.5)}" width="${ww}" height="${hh}" rx="1" fill="${c.edge}" opacity=".5"/><rect x="${f(hx - ww / 2)}" y="${f(hy - hh / 2)}" width="${ww}" height="${hh}" rx="1" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.6"/>`); }
      T.push(`<rect x="${f(x + bw / 2 - 6)}" y="${f(y + bh - p - 2)}" width="12" height="4" fill="${c.wall}"/>`);
      for (let k = 0; k < Math.floor(w / 10); k++) T.push(`<rect x="${f(x + p + k * 10 + 1)}" y="${f(y + p - 6)}" width="8" height="5" fill="${c.plaza}" stroke="${c.edge}" stroke-width="0.4"/>`); }
    for (let i = -4; i <= 5; i++) { const d = `M${f(cx + i * bw - ox)} ${f(cy - 700)}V${f(cy + 700)}`; T.push(i % 2 ? way(d, 5) : big(d, 8), i % 2 ? '' : `<path d="${d}" stroke="${c.park}" stroke-width="2.4"/>`); }
    for (let j = -5; j <= 6; j++) { const d = `M${f(cx - 700)} ${f(cy + j * bh - oy)}H${f(cx + 700)}`; T.push(j % 2 ? way(d, 5) : big(d, 8), j % 2 ? '' : `<path d="${d}" stroke="${c.park}" stroke-width="2.4"/>`); }
    o.push(`<g transform="rotate(${f(ga)} ${f(cx)} ${f(cy)})">${T.join('')}</g>`);
  } else if (kind === 'nordicWood') { // 북유럽 목조 주택 교외: 숲 사이 굽은 길 따라 띄엄띄엄 나무집(빨강 · 노랑 · 하양 지붕), 집 둘레 작은 풀밭, 숲 속 호수와 작은 섬 · 선착장, 하얀 교회, 숲길 점선, 학교 운동장
    const roof = dark ? ['#6e4040', '#6e6343', '#4f5560', '#5a4f44'] : ['#e8a49a', '#efd894', '#f4f4f2', '#d9c2a8'];
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.forest}"/>`);
    for (let k = 0; k < 340; k++) o.push(`<circle cx="${f(W * (-0.1 + r() * 1.2))}" cy="${f(H * (-0.1 + r() * 1.2))}" r="${f(3 + r() * 4)}" fill="${c.park}" opacity=".45"/>`);
    const lx = W * (r() < 0.5 ? 0.22 : 0.74), ly = H * (0.62 + r() * 0.2);
    const roads = [];
    roads.push([[X0, H * (0.3 + r() * 0.1)], [W * 0.3, H * 0.36], [W * 0.55, H * (0.26 + r() * 0.1)], [X1, H * 0.34]]);
    for (let k = 0; k < 3; k++) { const x0 = W * (0.15 + k * 0.32 + r() * 0.08), y0 = yOn(roads[0], x0); roads.push([[x0, y0], [x0 + (r() - 0.5) * 80, y0 + 70], [x0 + (r() - 0.5) * 120, y0 + 150], [x0 + (r() - 0.5) * 100, Y1]]); }
    roads.push([[roads[1][1][0], roads[1][1][1]], [W * 0.5, H * 0.1], [W * 0.6, Y0]]);
    for (const rd of roads) for (let t = 0.06; t < 0.96; t += 0.07) { if (r() < 0.25) continue; const n = rd.length - 1, i = Math.min(n - 1, Math.floor(t * n)), u = t * n - i, x = rd[i][0] + (rd[i + 1][0] - rd[i][0]) * u, y = rd[i][1] + (rd[i + 1][1] - rd[i][1]) * u, sd = r() < 0.5 ? -1 : 1, hx = x + sd * 16, hy = y + (r() - 0.5) * 8;
      o.push(fill(blob(hx, hy, 15, 11, 7, 0.25), c.park), `<rect x="${f(hx - 5)}" y="${f(hy - 4)}" width="10" height="8" rx="1" fill="${roof[Math.floor(r() * 4)]}" stroke="${c.edge}" stroke-width="0.6"/>`); if (r() < 0.4) o.push(`<rect x="${f(hx + 6)}" y="${f(hy)}" width="5" height="4" rx="0.6" fill="${roof[2]}" stroke="${c.edge}" stroke-width="0.5"/>`); }
    for (const rd of roads) o.push(way(curve(rd), 2.8));
    o.push(fill(blob(lx, ly, 104, 64, 11, 0.3), c.water), fill(blob(lx + 20, ly - 6, 16, 10, 7, 0.3), c.forest), `<path d="M${f(lx - 60)} ${f(ly - 46)}l14 12" stroke="${c.wall}" stroke-width="3" stroke-linecap="round"/>`);
    { const [x, y] = roads[0][1]; o.push(fill(blob(x, y - 26, 22, 14, 7, 0.2), c.park), `<rect x="${f(x - 8)}" y="${f(y - 30)}" width="16" height="9" rx="1" fill="${roof[2]}" stroke="${c.wall}" stroke-width="1"/><rect x="${f(x + 6)}" y="${f(y - 33)}" width="5" height="5" fill="${c.wall}"/>`); }
    { const [x, y] = roads[0][2]; o.push(`<rect x="${f(x + 16)}" y="${f(y - 52)}" width="44" height="30" rx="3" fill="${c.park}" stroke="${c.road}" stroke-width="1.2"/><rect x="${f(x + 18)}" y="${f(y - 60)}" width="22" height="7" rx="1" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.8"/>`); }
    o.push(`<path d="${curve([[X0, H * 0.8], [W * 0.3, H * 0.9], [lx, ly + 80], [X1, H * 0.95]])}" fill="none" stroke="${c.wall}" stroke-width="1.4" stroke-dasharray="3 4"/>`);
    o.push(big(curve(roads[0]), 4.4));
  } else if (kind === 'itOldNew') { // 이탈리아 옛 시내 + 새 시내: 촘촘한 옛 블록 시내(두오모 광장 · 종탑), 옛 성벽 자리 가로수 고리길, 바깥은 반듯한 블록마다 떨어져 선 아파트 몇 동, 역과 철길, 강과 다리
    const cx = W * (0.44 + r() * 0.12), cy = H * (0.42 + r() * 0.1), ga = (r() - 0.5) * 30, g2 = ga + 20 + r() * 20, R = 92 + r() * 14;
    const T = [], bw = 46, bh = 36, ca2 = Math.cos(g2 / 57.3), sa2 = Math.sin(g2 / 57.3);
    T.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.built}"/>`);
    for (let i = -9; i <= 9; i++) for (let j = -10; j <= 10; j++) { const u = i * bw, v = j * bh, p = (a, b) => [cx + a * ca2 - b * sa2, cy + a * sa2 + b * ca2], [x, y] = p(u + bw / 2, v + bh / 2), t = ((i * 7 + j * 5) % 13 + 13) % 13;
      if (t === 6) { T.push(`<rect x="${f(x - bw / 2 + 4)}" y="${f(y - bh / 2 + 4)}" width="${bw - 8}" height="${bh - 8}" rx="2" fill="${c.park}" transform="rotate(${f(g2)} ${f(x)} ${f(y)})"/>`); continue; }
      for (const [dx, dy] of [[-11, -7], [11, -7], [-11, 7], [11, 7]]) if (r() < 0.8) { const [hx, hy] = p(u + bw / 2 + dx, v + bh / 2 + dy); T.push(`<rect x="${f(hx - 7)}" y="${f(hy - 4.5)}" width="14" height="9" rx="1" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.6" transform="rotate(${f(g2)} ${f(hx)} ${f(hy)})"/>`); } }
    o.push(T.join(''));
    o.push(grid(`M${X0} ${Y0}H${X1}V${Y1}H${X0}Z`, g2, cx, cy, bw, bh, 2.4).replace(`fill="${c.built}"`, 'fill="none"'));
    const old = blob(cx, cy, R, R * 0.82, 10, 0.08), id = `${cidBase}_${nClip++}`, sp = 20, N = 14, P = [], ca = Math.cos(ga / 57.3), sa = Math.sin(ga / 57.3);
    for (let i = 0; i <= N; i++) { P.push([]); for (let j = 0; j <= N; j++) { const u = (i - N / 2) * sp + (r() - 0.5) * sp * 0.5, v = (j - N / 2) * sp * 0.82 + (r() - 0.5) * sp * 0.45; P[i].push([cx + u * ca - v * sa, cy + u * sa + v * ca]); } }
    const B = [`<path d="${old}" fill="${c.road}"/>`], m = N / 2 - 1;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { if (i >= m && i < m + 2 && j >= m && j < m + 2) continue; const q = [P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1]], mx = q.reduce((s, p) => s + p[0], 0) / 4, my = q.reduce((s, p) => s + p[1], 0) / 4; B.push(`<path d="M${q.map(([x, y]) => `${f(mx + (x - mx) * 0.8)} ${f(my + (y - my) * 0.8)}`).join('L')}Z" fill="${c.plaza}" stroke="${c.wall}" stroke-width="0.5"/>`); }
    const sq = [P[m][m], P[m + 2][m], P[m + 2][m + 2], P[m][m + 2]], sx = sq.reduce((s, p) => s + p[0], 0) / 4, sy = sq.reduce((s, p) => s + p[1], 0) / 4;
    B.push(`<path d="M${sq.map(([x, y]) => `${f(sx + (x - sx) * 0.92)} ${f(sy + (y - sy) * 0.92)}`).join('L')}Z" fill="${c.sand}"/>`, `<g transform="translate(${f(sx)} ${f(sy - 4)}) rotate(${f(ga)})"><rect x="-16" y="-6" width="32" height="12" rx="1.5" fill="${c.wall}"/><circle cx="-10" cy="0" r="6" fill="${c.wall}" stroke="${c.sand}" stroke-width="1.2"/><rect x="18" y="-4" width="6" height="6" fill="${c.wall}"/></g>`);
    o.push(`<clipPath id="${id}"><path d="${old}"/></clipPath><g clip-path="url(#${id})">${B.join('')}</g>`);
    o.push(way(old, 6), `<path d="${blob(cx, cy, R + 9, R * 0.82 + 8, 10, 0.08)}" fill="none" stroke="${c.forest}" stroke-width="3" stroke-dasharray="0.1 9" stroke-linecap="round"/>`);
    const rl = [[X0, cy + R + 60], [X1, cy + R + 20]]; o.push(`<path d="M${f(rl[0][0])} ${f(rl[0][1])}L${f(rl[1][0])} ${f(rl[1][1])}" stroke="${c.land}" stroke-width="16"/>`, rail(`M${f(rl[0][0])} ${f(rl[0][1] - 3)}L${f(rl[1][0])} ${f(rl[1][1] - 3)}`), rail(`M${f(rl[0][0])} ${f(rl[0][1] + 3)}L${f(rl[1][0])} ${f(rl[1][1] + 3)}`));
    { const x = cx + 30, y = rl[0][1] + (rl[1][1] - rl[0][1]) * (x - X0) / (X1 - X0); o.push(`<rect x="${f(x - 30)}" y="${f(y - 20)}" width="60" height="12" rx="2" fill="${c.bld}" stroke="${c.wall}" stroke-width="1"/>`, big(`M${f(x)} ${f(y - 20)}L${f(cx + 10)} ${f(cy + R * 0.82)}`, 4.6)); }
    const rv = [[X0, cy - R - 50], [W * 0.4, cy - R - 30], [W * 0.75, cy - R - 60], [X1, cy - R - 40]];
    o.push(`<path d="${curve(rv)}" fill="none" stroke="${c.park}" stroke-width="36"/>`, `<path d="${curve(rv)}" fill="none" stroke="${c.water}" stroke-width="20"/>`);
    for (const t of [0.3, 0.7]) { const x = W * t, y = yOn(rv, x); o.push(way(`M${f(x)} ${f(y - 20)}L${f(x + 2)} ${f(y + 20)}`, 4.4)); }
  } else if (kind === 'usStrip') { // 미국 큰길 상가 교외: 1마일마다 넓은 간선도로, 길가엔 ㄱ자 상가와 넓은 주차장 · 큰 마트 · 주유소 · 드라이브스루, 뒤쪽은 굽은 주택가, 학교 운동장 · 야구장, 한쪽 고속도로 나들목
    const ga = (r() - 0.5) * 10, cx = W * 0.5, cy = H * 0.5, M = 260, T = [];
    T.push(`<rect x="${f(cx - 700)}" y="${f(cy - 700)}" width="1400" height="1400" fill="${c.built}"/>`);
    const ax = cx - M / 2 + (r() - 0.5) * 60, ay = cy - M / 2 + (r() - 0.5) * 60;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const x0 = ax + i * M, y0 = ay + j * M;
      for (let k = 0; k < 7; k++) { const y = y0 + 50 + k * 26 + (k % 2) * 4; T.push(way(`M${f(x0 + 46)} ${f(y)}Q${f(x0 + M / 2)} ${f(y + (k % 2 ? 14 : -14))} ${f(x0 + M - 46)} ${f(y)}`, 2)); for (let h = 0; h < 14; h++) { const x = x0 + 56 + h * 12; for (const s of [-1, 1]) T.push(`<rect x="${f(x - 4)}" y="${f(y + s * 8 - 3 + (k % 2 ? 14 : -14) * 4 * ((h + 0.5) / 14) * (1 - (h + 0.5) / 14))}" width="8" height="6" rx="0.8" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.4"/>`); } }
      T.push(way(`M${f(x0 + 46)} ${f(y0 + 40)}V${f(y0 + M - 40)}`, 2.4), way(`M${f(x0 + M - 46)} ${f(y0 + 40)}V${f(y0 + M - 40)}`, 2.4));
      T.push(`<path d="M${f(x0 + 4)} ${f(y0 + 4)}h${M - 8}v40h${-(M - 8)}z" fill="${c.plaza}"/>`);
      const lay = (i * 3 + j * 5 + 20) % 4;
      if (lay === 0) T.push(`<path d="M${f(x0 + 10)} ${f(y0 + 8)}h90v10h-80v18h-10z" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.8"/>`, ...[0, 1, 2, 3, 4, 5].map(k => `<path d="M${f(x0 + 28 + k * 12)} ${f(y0 + 22)}v16" stroke="${c.road}" stroke-width="1"/>`));
      if (lay === 1) T.push(`<rect x="${f(x0 + 120)}" y="${f(y0 + 8)}" width="70" height="20" rx="1" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.8"/>`, ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<path d="M${f(x0 + 100 + k * 11)} ${f(y0 + 30)}v10" stroke="${c.road}" stroke-width="1"/>`));
      if (lay === 2) T.push(`<rect x="${f(x0 + 14)}" y="${f(y0 + 12)}" width="22" height="16" rx="1" fill="${c.road}" stroke="${c.wall}" stroke-width="1"/><rect x="${f(x0 + 21)}" y="${f(y0 + 17)}" width="8" height="6" fill="${c.wall}"/>`, `<rect x="${f(x0 + 60)}" y="${f(y0 + 12)}" width="14" height="10" rx="1" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.8"/><path d="M${f(x0 + 54)} ${f(y0 + 30)}h26v-24h-26" fill="none" stroke="${c.road}" stroke-width="2"/>`);
      if (lay === 3) T.push(`<rect x="${f(x0 + 60)}" y="${f(y0 + 60)}" width="${M - 120}" height="${M - 120}" rx="4" fill="${c.park}"/><path d="M${f(x0 + 100)} ${f(y0 + 180)}l-20 -20a28 28 0 0 1 40 0z" fill="${c.sand}"/><rect x="${f(x0 + 140)}" y="${f(y0 + 74)}" width="50" height="16" rx="1" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.8"/><ellipse cx="${f(x0 + 165)}" cy="${f(y0 + 150)}" rx="26" ry="16" fill="${c.sand}"/><ellipse cx="${f(x0 + 165)}" cy="${f(y0 + 150)}" rx="18" ry="10" fill="${c.park}"/>`);
    }
    for (let i = -2; i <= 3; i++) T.push(big(`M${f(ax + i * M)} ${f(cy - 700)}V${f(cy + 700)}`, 7));
    for (let j = -2; j <= 3; j++) T.push(big(`M${f(cx - 700)} ${f(ay + j * M)}H${f(cx + 700)}`, 7));
    o.push(`<g transform="rotate(${f(ga)} ${f(cx)} ${f(cy)})">${T.join('')}</g>`);
    const fx = W * (r() < 0.5 ? 0.9 : 0.1); o.push(big(`M${f(fx)} ${Y0}L${f(fx + 10)} ${Y1}`, 10), `<path d="M${f(fx)} ${f(H * 0.5 - 30)}q30 30 0 60" fill="none" stroke="${c.major}" stroke-width="4"/>`);
  } else if (kind === 'caLake') { // 캐나다 호숫가 교외 도시: 한쪽을 차지한 큰 호수와 모래 해변 · 호숫가 산책길 · 요트 선착장, 물가 따라 철길, 작은 시내 바둑판, 단풍나무 많은 주택가, 큰 공원에 아이스링크와 야구장
    const ga = (r() - 0.5) * 16, sh = [[X0, H * (0.68 + r() * 0.08)], [W * 0.35, H * 0.74], [W * 0.7, H * (0.66 + r() * 0.08)], [X1, H * 0.72]];
    const maple = dark ? ['#5a3a30', '#5a5030', '#2e4a34'] : ['#f0b48f', '#f2d27a', '#a9c99b'];
    o.push(rowsGrid(`${curve(sh.map(([x, y]) => [x, y - 40]))}L${X1} ${Y0}L${X0} ${Y0}Z`, ga, W * 0.5, H * 0.3, 44, 26));
    for (let k = 0; k < 70; k++) { const x = W * (-0.05 + r() * 1.1), y = H * (-0.05 + r() * 0.75); if (y > yOn(sh, Math.max(X0, Math.min(X1, x))) - 46) continue; o.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(2.6 + r() * 2)}" fill="${maple[k % 3]}"/>`); }
    const px = W * (0.15 + r() * 0.5), py = H * (0.2 + r() * 0.15); o.push(`<rect x="${f(px - 50)}" y="${f(py - 34)}" width="100" height="68" rx="4" fill="${c.park}" stroke="${c.road}" stroke-width="2" transform="rotate(${f(ga)} ${f(px)} ${f(py)})"/><rect x="${f(px - 40)}" y="${f(py - 24)}" width="34" height="20" rx="8" fill="${c.road}" stroke="${c.water}" stroke-width="1.4" transform="rotate(${f(ga)} ${f(px)} ${f(py)})"/><path d="M${f(px + 30)} ${f(py + 24)}l-18 -18a25 25 0 0 1 36 0z" fill="${c.sand}" transform="rotate(${f(ga)} ${f(px)} ${f(py)})"/>`);
    o.push(fill(`${curve(sh.map(([x, y]) => [x, y - 40]))}L${X1} ${Y1}L${X0} ${Y1}Z`, c.park));
    o.push(`<path d="${curve(sh.map(([x, y]) => [x, y - 30]))}" fill="none" stroke="${c.land}" stroke-width="10"/>`, rail(curve(sh.map(([x, y]) => [x, y - 30]))));
    o.push(fill(`${curve(sh.map(([x, y]) => [x, y - 8]))}L${X1} ${Y1}L${X0} ${Y1}Z`, c.sand), fill(`${curve(sh)}L${X1} ${Y1}L${X0} ${Y1}Z`, c.water));
    o.push(`<path d="${curve(sh.map(([x, y]) => [x, y - 18]))}" fill="none" stroke="${c.road}" stroke-width="1.6" stroke-dasharray="1 3" stroke-linecap="round"/>`);
    const mx = W * (0.7 + r() * 0.15), my = yOn(sh, mx); o.push(`<path d="${curve([[mx - 40, my], [mx - 50, my + 40], [mx + 10, my + 56]])}" fill="none" stroke="${c.contour}" stroke-width="6" stroke-linecap="round"/>`);
    for (let k = 0; k < 4; k++) o.push(`<path d="M${f(mx - 34 + k * 12)} ${f(my + 4)}v24" stroke="${c.road}" stroke-width="1.6"/>`);
    o.push(big(curve(sh.map(([x, y]) => [x, y - 48])), 4.8), big(`M${f(W * 0.45)} ${Y0}L${f(W * 0.5)} ${f(yOn(sh, W * 0.5) - 48)}`, 4.4));
  } else if (kind === 'krUniv') { // 한국 대학가 · 원룸촌: 언덕 위 대학 정문과 캠퍼스 건물, 정문에서 내려오는 큰길 양옆 빽빽한 가게, 그 뒤 골목마다 작은 원룸 건물이 촘촘, 큰길 끝 지하철역, 뒷산
    const ga = (r() - 0.5) * 24, cx = W * (0.44 + r() * 0.12), gy = H * (0.22 + r() * 0.06), T = [];
    T.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.road}"/>`);
    const sp = 30, N = 22, P = []; for (let i = 0; i <= N; i++) { P.push([]); for (let j = 0; j <= N; j++) P[i].push([cx + (i - N / 2) * sp + (r() - 0.5) * 10, gy + 4 + j * sp * 0.7 + (r() - 0.5) * 6]); }
    for (let i = 0; i < N; i++) for (let j = 0; j < N - 6; j++) { const q = [P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1]], mx = q.reduce((s, p) => s + p[0], 0) / 4, my = q.reduce((s, p) => s + p[1], 0) / 4; T.push(`<path d="M${q.map(([x, y]) => `${f(mx + (x - mx) * 0.86)} ${f(my + (y - my) * 0.86)}`).join('L')}Z" fill="${c.built}"/>`); for (const [dx, dy] of [[-6, -3.5], [6, -3.5], [-6, 3.5], [6, 3.5]]) if (r() < 0.85) T.push(`<rect x="${f(mx + dx - 4.5)}" y="${f(my + dy - 3)}" width="9" height="6" rx="0.8" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.5"/>`); }
    for (let i = 0; i <= N; i++) T.push(way(curve(P[i].slice(0, N - 5)), 1.8)); for (let j = 0; j <= N - 6; j++) T.push(way(curve(P.map(rw => rw[j])), 1.8));
    T.push(`<path d="M${f(cx)} ${f(gy)}V${f(Y1 + 50)}" stroke="${c.plaza}" stroke-width="26"/>`);
    for (let k = 0; k < 40; k++) for (const s of [-1, 1]) T.push(`<rect x="${f(cx + s * 9.5 - 3.5)}" y="${f(gy + 6 + k * 8)}" width="7" height="6.6" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.6"/>`);
    T.push(fill(`M${X0} ${Y0}H${X1}V${f(gy)}${curve([[X1, gy], [cx + 120, gy - 10], [cx, gy + 2], [cx - 120, gy - 6], [X0, gy]]).replace('M', 'L')}Z`, c.park));
    for (let k = 0; k < 7; k++) { const x = cx - 150 + k * 50 + (r() - 0.5) * 16, y = gy - 40 - (k % 3) * 22; T.push(`<rect x="${f(x - 16)}" y="${f(y - 9)}" width="${f(26 + r() * 12)}" height="${f(14 + r() * 6)}" rx="1.5" fill="${c.bld}" stroke="${c.wall}" stroke-width="1"/>`); }
    T.push(`<rect x="${f(cx - 14)}" y="${f(gy - 6)}" width="28" height="7" rx="1.5" fill="${c.wall}"/>`, way(`M${f(cx)} ${f(gy - 4)}L${f(cx + 20)} ${f(gy - 60)}L${f(cx - 30)} ${f(gy - 110)}`, 2.6));
    T.push(fill(blob(X0 + 40, Y0 + 10, 140, 60, 9, 0.2), c.forest), fill(blob(X1 - 30, Y0, 120, 50, 9, 0.2), c.forest));
    T.push(big(`M${f(cx)} ${f(gy)}V${f(Y1 + 50)}`, 4.8));
    const sy = gy + 40 * 8 + 6; T.push(big(`M${f(X0 - 50)} ${f(sy)}H${f(X1 + 50)}`, 5.6), `<circle cx="${f(cx)}" cy="${f(sy)}" r="7" fill="${c.road}" stroke="${dark ? '#8fb3d4' : '#3f8fd8'}" stroke-width="2.6"/>`);
    o.push(`<g transform="rotate(${f(ga)} ${f(W / 2)} ${f(H / 2)})">${T.join('')}</g>`);
  } else if (kind === 'deDorf') { // 독일 들판 마을: 굽은 마을길 가운데 잔디 마당과 교회, 길 따라 ㄷ자 농가(마당 품은 집 셋), 집 뒤 길쭉한 텃밭 띠, 바깥은 길쭉길쭉한 줄 밭이 방향 바꿔 가며 퍼지고, 개울과 숲 가장자리, 밭길
    const crop = [c.vine, c.park, c.sand, dark ? '#2a3328' : '#e6ecd0'], cx = W * (0.44 + r() * 0.12), cy = H * (0.46 + r() * 0.1);
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${crop[3]}"/>`);
    for (let g = 0; g < 9; g++) { const gx = W * (-0.1 + (g % 3) * 0.45 + r() * 0.1), gy = H * (-0.1 + Math.floor(g / 3) * 0.5 + r() * 0.1), a = r() * 180, T = []; for (let k = 0; k < 14; k++) T.push(`<rect x="${f(-120 + k * 17)}" y="-90" width="15.4" height="180" fill="${crop[(k * 3 + g + Math.floor(r() * 2)) % 4]}"/>`); o.push(`<g transform="translate(${f(gx)} ${f(gy)}) rotate(${f(a)})">${T.join('')}<path d="M-122 -92h240v184h-240z" fill="none" stroke="${c.road}" stroke-width="2.4"/></g>`); }
    o.push(fill(blob(X1 - 10, Y0 + 30, 160, 90, 10, 0.2), c.forest), fill(blob(X0, Y1, 140, 70, 10, 0.2), c.forest));
    const ms = [[X0, cy + 30], [cx - 110, cy + 10], [cx, cy + 22], [cx + 110, cy - 6], [X1, cy + 14]];
    o.push(`<path d="${curve(ms)}" fill="none" stroke="${c.built}" stroke-width="120"/>`);
    for (let x = X0 + 10; x < X1; x += 22) for (const s of [-1, 1]) { const y = yOn(ms, Math.max(X0, Math.min(X1, x))); if (Math.abs(x - cx) < 34) continue; o.push(`<rect x="${f(x - 9)}" y="${f(s < 0 ? y - 56 : y + 22)}" width="18" height="34" fill="${crop[(Math.floor(x) + s) % 2 ? 1 : 0]}" opacity=".8"/>`); const hy = y + s * 13, d = s < 0 ? -1 : 1; o.push(`<path d="M${f(x - 8)} ${f(hy)}v${f(d * 10)}h16v${f(-d * 10)}" fill="none" stroke="${c.bld}" stroke-width="4.4" stroke-linejoin="round"/><path d="M${f(x - 8)} ${f(hy)}v${f(d * 10)}h16v${f(-d * 10)}" fill="none" stroke="${c.wall}" stroke-width="0.6"/>`); }
    o.push(fill(blob(cx, yOn(ms, cx) - 4, 30, 18, 8, 0.15), c.park), `<g transform="translate(${f(cx)} ${f(yOn(ms, cx) - 6)})"><rect x="-12" y="-4" width="24" height="8" rx="1" fill="${c.wall}"/><rect x="6" y="-7" width="7" height="7" rx="1" fill="${c.wall}"/></g>`);
    for (let k = 0; k < 6; k++) o.push(`<circle cx="${f(cx - 24 + k * 10)}" cy="${f(yOn(ms, cx) + (k % 2 ? 10 : -14))}" r="3" fill="${c.forest}"/>`);
    const ck = [[X0, cy + 110 + r() * 30], [cx - 40, cy + 90], [cx + 80, cy + 130], [X1, cy + 100]];
    o.push(`<path d="${curve(ck)}" fill="none" stroke="${c.forest}" stroke-width="10" stroke-dasharray="0.1 7" stroke-linecap="round"/>`, `<path d="${curve(ck)}" fill="none" stroke="${c.water}" stroke-width="4"/>`);
    o.push(way(curve(ms), 3.6), way(`M${f(cx + 60)} ${f(yOn(ms, cx + 60))}L${f(cx + 120)} ${Y0}`, 2), way(`M${f(cx - 70)} ${f(yOn(ms, cx - 70))}L${f(cx - 140)} ${Y1}`, 2), big(`M${X0} ${f(H * 0.12)}L${X1} ${f(H * 0.06)}`, 4.6));
  } else if (kind === 'jpDanchi') { // 일본 단지(団地): 같은 방향으로 엇갈려 선 긴 판상 아파트 줄, 동 사이 넓은 잔디 · 놀이터 · 벚나무, 단지 가운데 작은 상가 · 버스 회차로, 둘레는 단독주택 바둑판, 뒤쪽 숲 언덕
    const ga = (r() - 0.5) * 30, cx = W * (0.46 + r() * 0.1), cy = H * (0.46 + r() * 0.1), T = [];
    o.push(rowsGrid(`M${X0} ${Y0}H${X1}V${Y1}H${X0}Z`, ga + 10, cx, cy, 30, 22, 5));
    const site = blob(cx, cy, 160, 118, 10, 0.08); o.push(fill(site, c.park), `<path d="${site}" fill="none" stroke="${c.road}" stroke-width="4"/>`);
    const id = `${cidBase}_${nClip++}`;
    for (let j = -5; j <= 5; j++) for (let i = -4; i <= 4; i++) { if (Math.abs(i) <= 0 && Math.abs(j) <= 1) continue; const x = cx + i * 46 + (j % 2) * 18, y = cy + j * 24; T.push(`<rect x="${f(x - 18 + 2)}" y="${f(y - 4 + 2)}" width="36" height="8" rx="1" fill="${c.edge}" opacity=".45"/><rect x="${f(x - 18)}" y="${f(y - 4)}" width="36" height="8" rx="1" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.6"/>`); if ((i + j) % 4 === 0) T.push(`<circle cx="${f(x + 23)}" cy="${f(y + 12)}" r="3.4" fill="${dark ? '#5a3a46' : '#f3c6d0'}"/>`); if ((i * 3 + j) % 7 === 0) T.push(`<rect x="${f(x - 10)}" y="${f(y + 7)}" width="16" height="8" rx="2" fill="${c.sand}"/>`); }
    T.push(`<rect x="${f(cx - 24)}" y="${f(cy - 14)}" width="48" height="16" rx="2" fill="${c.plaza}" stroke="${c.wall}" stroke-width="1"/><circle cx="${f(cx + 6)}" cy="${f(cy + 18)}" r="11" fill="${c.road}" stroke="${c.edge}"/><circle cx="${f(cx + 6)}" cy="${f(cy + 18)}" r="4" fill="${c.park}"/>`);
    o.push(`<clipPath id="${id}"><path d="${site}"/></clipPath><g clip-path="url(#${id})"><g transform="rotate(${f(ga)} ${f(cx)} ${f(cy)})">${T.join('')}</g></g>`);
    o.push(fill(blob(X1 - 30, Y0 + 20, 140, 80, 10, 0.2), c.forest), fill(blob(X0 + 10, Y0, 120, 60, 9, 0.2), c.forest));
    o.push(big(curve([[X0, cy + 140], [cx - 120, cy + 120], [cx + 60, cy + 136], [X1, cy + 110]]), 5), way(`M${f(cx + 6)} ${f(cy + 30)}L${f(cx + 10)} ${f(cy + 126)}`, 3.4));
  } else if (kind === 'noSnow') { // 눈 덮인 노르웨이 도시: 이름 따라 세 생김새(해협 건너 시내 · 섬 위 시내 · 피오르 끝 시내) × 네 방향, 눈 지붕 나무집 바둑판, 눈 속 침엽수, 다리, 뾰족한 하얀 교회, 케이블카, 스키 길, 부두
    const wallc = dark ? ['#6a4646', '#6a6040', '#44566e', '#56606a', '#56606a', '#56606a'] : ['#e3a49c', '#ead38c', '#a9c3e3', '#c9cfd6', '#c9cfd6', '#d8b8a0'], pine = dark ? '#1f3a2a' : '#5f8f6f';
    const v = Math.floor(r() * 3), turn = Math.floor(r() * 4) * 90, ga = (r() - 0.5) * 24, S0 = o.length;
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.land}"/>`);
    let townD, waterD, edges = [], bridge = null;
    if (v === 0) { const ch = [[X0, H * (0.44 + r() * 0.1)], [W * 0.35, H * 0.5], [W * 0.65, H * (0.42 + r() * 0.1)], [X1, H * 0.48]];
      townD = `${curve(ch.map(([x, y]) => [x, y + 40]))}L${X1} ${Y1}L${X0} ${Y1}Z`; waterD = `${curve(ch.map(([x, y]) => [x, y - 34]))}${curve([...ch].reverse().map(([x, y]) => [x, y + 40])).replace('M', 'L')}Z`; edges = [ch.map(([x, y]) => [x, y + 52]), ch.map(([x, y]) => [x, y - 46])]; const bx = W * (0.3 + r() * 0.4), by = yOn(ch, bx); bridge = [[bx - 6, by - 44], [bx + 6, by + 48]]; }
    else if (v === 1) { const ix = W * (0.45 + r() * 0.1), iy = H * (0.5 + r() * 0.08), isl = blob(ix, iy, 120 + r() * 20, 78 + r() * 12, 11, 0.15);
      townD = isl; waterD = `${blob(ix, iy, 190, 130, 11, 0.12)}`; edges = [[[ix - 100, iy], [ix, iy - 50], [ix + 100, iy]]]; bridge = [[ix + 120, iy - 10], [ix + 205, iy - 30]]; }
    else { const fx = W * (0.45 + r() * 0.15), fy = H * (0.52 + r() * 0.08), fj = [[X0, fy + 40], [W * 0.2, fy + 10], [fx - 40, fy + 20], [fx, fy]];
      townD = `${blob(fx + 30, fy, 150, 110, 11, 0.12)}`; waterD = `${curve([...fj.map(([x, y]) => [x, y - 26]), [fx + 26, fy + 6], ...[...fj].reverse().map(([x, y]) => [x, y + 26])], false)}Z`; edges = [[[fx - 120, fy + 60], [fx + 30, fy + 70], [fx + 170, fy + 30]]]; bridge = [[W * 0.2, fy - 20], [W * 0.2 + 4, fy + 40]]; }
    for (let k = 1; k < 16; k++) o.push(`<path d="${blob(W * 0.5, H * 0.5, 120 + k * 26, 90 + k * 20, 12, 0.06)}" fill="none" stroke="${c.contour}" stroke-width="${k % 4 ? 0.9 : 1.6}"/>`);
    { let g = ''; for (let k = 0; k < 220; k++) { const x = W * (-0.15 + r() * 1.3), y = H * (-0.15 + r() * 1.3); g += `M${f(x)} ${f(y - 5)}l3.4 7h-6.8z`; } o.push(`<path d="${g}" fill="${pine}" opacity=".85"/>`); }
    { const id = `${cidBase}_${nClip++}`, T = [], cx = W * 0.5, cy = H * 0.6;
      for (let i = -16; i <= 16; i++) for (let j = -14; j <= 14; j++) { const x = cx + i * 30, y = cy + j * 22, t = ((i * 7 + j * 3) % 19 + 19) % 19; if (t === 9) { for (let k = 0; k < 5; k++) T.push(`<path d="M${f(x + 6 + k * 4)} ${f(y + 6 + (k % 2) * 6)}l3 6h-6z" fill="${pine}"/>`); continue; }
        for (const [dx, dy] of [[3, 3], [16, 3], [3, 12], [16, 12]]) if (r() < 0.68) T.push(`<rect x="${f(x + dx)}" y="${f(y + dy)}" width="9.4" height="7" rx="1.2" fill="${c.road}" stroke="${wallc[Math.floor(r() * 6)]}" stroke-width="1.4"/>`); }
      for (let i = -16; i <= 16; i++) T.push(way(`M${f(cx + i * 30)} ${f(cy - 400)}V${f(cy + 400)}`, 2.2)); for (let j = -14; j <= 14; j++) T.push(way(`M${f(cx - 500)} ${f(cy + j * 22)}H${f(cx + 500)}`, 2.2));
      if (v === 1) o.push(fill(waterD, c.water));
      o.push(`<clipPath id="${id}"><path d="${townD}"/></clipPath><g clip-path="url(#${id})"><path d="${townD}" fill="${c.built}"/><g transform="rotate(${f(ga)} ${f(cx)} ${f(cy)})">${T.join('')}</g></g>`); }
    if (v !== 1) o.push(fill(waterD, c.water)); else o.push(`<path d="${townD}" fill="none" stroke="${c.sand}" stroke-width="3"/>`);
    for (let k = 0; k < 0; k++) { const x = W * (0.05 + r() * 0.9), y = H * (0.05 + r() * 0.9); o.push(`<path d="${blob(x, y, 4 + r() * 6, 3 + r() * 3, 6, 0.4)}" fill="${c.land}" opacity=".9"/>`); }
    if (bridge) { const [[x1, y1], [x2, y2]] = bridge; o.push(`<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${c.edge}" stroke-width="8"/><path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${c.road}" stroke-width="5.6"/>`); }
    const tx = W * (0.1 + r() * 0.8), ty = H * (0.1 + r() * 0.2); o.push(`<path d="M${f(tx - 10)} ${f(ty + 8)}L${f(tx)} ${f(ty - 12)}L${f(tx + 10)} ${f(ty + 8)}Z" fill="${c.road}" stroke="${c.wall}" stroke-width="1.4" stroke-linejoin="round"/>`);
    const cb = [W * (0.2 + r() * 0.6), H * 0.3], ce = [cb[0] - 60 + r() * 120, H * -0.02], ln = dark ? '#aeb5c0' : '#6b717b';
    o.push(`<path d="M${f(cb[0])} ${f(cb[1])}L${f(ce[0])} ${f(ce[1])}" stroke="${ln}" stroke-width="1.3"/>`, ...[cb, ce].map(([x, y]) => `<rect x="${f(x - 6)}" y="${f(y - 4)}" width="12" height="8" rx="2" fill="${c.wall}"/>`));
    for (let k = 0; k < 2; k++) { const x0 = W * (0.15 + k * 0.5 + r() * 0.1); o.push(`<path d="${curve([[x0, H * -0.05], [x0 + 30, H * 0.08], [x0 - 10, H * 0.18], [x0 + 20, H * 0.28]])}" fill="none" stroke="${dark ? '#8fb3d4' : '#7fa9d8'}" stroke-width="1.4" stroke-dasharray="4 3"/>`); }
    edges.forEach((e, k) => o.push(k ? way(curve(e), 3.6) : big(curve(e), 4.6)));
    const body = o.splice(S0).join(''); o.push(`<g transform="rotate(${turn} ${f(W / 2)} ${f(H / 2)})">${body}</g>`);
  } else if (kind === 'egypt') { // 이집트: 이름이 열두 장 중 하나를 골라요 — 장마다 생김새가 통째로 달라요
    const low = String(seed).toLowerCase(); let hit = -1, best = 0; EG_NAMES.forEach((ns, k) => { for (const n of ns) if (low.includes(n) && n.length > best) { best = n.length; hit = k; } }); const pick = hit >= 0 ? hit : hsh(seed) % EG12.length;
    const palm = (x, y, s = 1) => { let g = ''; for (let j = 0; j < 6; j++) { const a = j / 6 * 6.283 + 0.3; g += `M${f(x)} ${f(y)}l${f(Math.cos(a) * 5 * s)} ${f(Math.sin(a) * 5 * s)}`; } return `<path d="${g}" stroke="${c.forest}" stroke-width="${f(2 * s)}" stroke-linecap="round"/>`; };
    const palms = (x, y, n, rx, ry) => { let g = ''; for (let k = 0; k < n; k++) g += palm(x + (r() - 0.5) * 2 * rx, y + (r() - 0.5) * 2 * ry, 0.8 + r() * 0.4); return g; };
    const dunes = (n = 40) => { let g = ''; for (let k = 0; k < n; k++) { const x = W * (-0.1 + r() * 1.2), y = H * (-0.1 + r() * 1.2), w = 30 + r() * 50; g += `M${f(x - w)} ${f(y)}q${f(w)} ${f(-8 - r() * 8)} ${f(w * 2)} 0`; } return `<path d="${g}" fill="none" stroke="${c.contour}" stroke-width="1.6" stroke-linecap="round"/>`; };
    const pyr = (x, y, s) => `<path d="M${f(x)} ${f(y - s)}L${f(x + s)} ${f(y)}L${f(x)} ${f(y)}Z" fill="${c.wall}"/><path d="M${f(x)} ${f(y - s)}L${f(x)} ${f(y)}L${f(x - s)} ${f(y)}Z" fill="${c.sand}"/><path d="M${f(x - s)} ${f(y)}L${f(x)} ${f(y + s)}L${f(x)} ${f(y)}Z" fill="${c.bld}"/><path d="M${f(x)} ${f(y)}L${f(x)} ${f(y + s)}L${f(x + s)} ${f(y)}Z" fill="${c.wall}" opacity=".75"/><path d="M${f(x)} ${f(y - s)}L${f(x + s)} ${f(y)}L${f(x)} ${f(y + s)}L${f(x - s)} ${f(y)}Z" fill="none" stroke="${c.edge}" stroke-width="0.8"/>`;
    const mosque = (x, y, s = 1) => `<rect x="${f(x - 9 * s)}" y="${f(y - 7 * s)}" width="${f(18 * s)}" height="${f(14 * s)}" rx="1.5" fill="${c.plaza}" stroke="${c.wall}" stroke-width="0.8"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(5 * s)}" fill="${c.bld}" stroke="${c.wall}" stroke-width="1"/><circle cx="${f(x + 11 * s)}" cy="${f(y - 9 * s)}" r="${f(2 * s)}" fill="${c.wall}"/>`;
    const boat = (x, y, a) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"><path d="M-6 0Q0 3 6 0Z" fill="${c.wall}"/><path d="M0 -0.5L0 -8L5 -1Z" fill="${c.road}" stroke="${c.edge}" stroke-width="0.5"/></g>`;
    const river = (pts, w, green = 0) => (green ? `<path d="${curve(pts)}" fill="none" stroke="${c.park}" stroke-width="${w + green}" stroke-linecap="round"/>` : '') + `<path d="${curve(pts)}" fill="none" stroke="${c.water}" stroke-width="${w}" stroke-linecap="round"/>`;
    const fields = (d, ang, cx, cy, s = 18) => { const id = `${cidBase}_${nClip++}`, T = []; for (let i = -18; i <= 18; i++) for (let j = -18; j <= 18; j++) T.push(`<rect x="${f(cx + i * s + 0.8)}" y="${f(cy + j * s * 0.8 + 0.8)}" width="${f(s - 1.6)}" height="${f(s * 0.8 - 1.6)}" fill="${[c.park, c.forest, c.vine, c.park][((i * 7 + j * 3) % 4 + 4) % 4]}"/>`); return `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})"><g transform="rotate(${f(ang)} ${f(cx)} ${f(cy)})">${T.join('')}</g></g>`; };
    o.push(`<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${c.land}"/>`);
    if (pick === 0) { // 카이로: 강 가운데 길쭉한 섬 둘, 양쪽 강변 빽빽한 시가지와 다리 여럿, 강변 고층 줄
      const rv = [[W * 0.42, Y0], [W * 0.5, H * 0.3], [W * 0.46, H * 0.7], [W * 0.54, Y1]];
      o.push(rowsGrid(`${curve(rv)}L${X0} ${Y1}L${X0} ${Y0}Z`, 18, W * 0.2, H * 0.5, 34, 20), rowsGrid(`${curve(rv)}L${X1} ${Y1}L${X1} ${Y0}Z`, -12, W * 0.8, H * 0.5, 26, 22));
      o.push(river(rv, 70, 14));
      for (const [t, L] of [[0.3, 60], [0.68, 44]]) { const y = H * t, x = W * 0.48; o.push(grid(blob(x, y, 14, L, 9, 0.12), 80, x, y, 14, 10, 1.6), fill(blob(x, y + L * 0.6, 10, L * 0.3, 7, 0.2), c.park)); }
      for (const t of [0.15, 0.45, 0.85]) o.push(way(`M${f(W * 0.3)} ${f(H * t)}L${f(W * 0.68)} ${f(H * t + 6)}`, 4.6));
      for (let k = 0; k < 10; k++) o.push(`<rect x="${f(W * 0.38 + (k % 2) * 4)}" y="${f(H * (0.05 + k * 0.09))}" width="8" height="10" rx="1" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.8"/>`);
      o.push(big(curve([[X0, H * 0.6], [W * 0.3, H * 0.52], [W * 0.7, H * 0.56], [X1, H * 0.48]]), 5.4), boat(W * 0.5, H * 0.52, 80), boat(W * 0.47, H * 0.9, 100));
    } else if (pick === 1) { // 기자: 사막 고원에 큰 피라미드 셋과 작은 피라미드 줄, 스핑크스, 고원 끝에서 갑자기 시작되는 빽빽한 시가지
      o.push(dunes(36));
      const ex = [[X0, H * 0.78], [W * 0.4, H * 0.72], [W * 0.7, H * 0.8], [X1, H * 0.74]];
      o.push(rowsGrid(`${curve(ex)}L${X1} ${Y1}L${X0} ${Y1}Z`, 6, W * 0.5, H * 0.9, 30, 18));
      const px = W * (0.35 + r() * 0.1), py = H * 0.38; o.push(pyr(px, py, 46), pyr(px + 70, py + 44, 40), pyr(px + 128, py + 80, 22));
      for (let k = 0; k < 3; k++) o.push(pyr(px + 160 + k * 16, py + 110, 6));
      o.push(`<path d="M${f(px - 40)} ${f(py + 110)}h20v6h-20z" fill="${c.wall}"/><circle cx="${f(px - 18)}" cy="${f(py + 113)}" r="4" fill="${c.wall}"/>`);
      o.push(`<path d="M${f(px - 10)} ${f(py + 50)}L${f(px - 30)} ${f(py + 110)}M${f(px + 70)} ${f(py + 86)}L${f(px - 20)} ${f(py + 112)}" stroke="${c.sand}" stroke-width="3"/>`, big(`M${f(px - 30)} ${f(py + 118)}L${f(px - 50)} ${Y1}`, 4.6), way(curve(ex.map(([x, y]) => [x, y + 6])), 3.4));
    } else if (pick === 2) { // 룩소르: 강 동쪽 기둥 숲 큰 신전과 스핑크스 길, 서쪽 초록 들판 너머 사막 절벽, 강 위 돛배
      const rv = [[W * 0.36, Y0], [W * 0.4, H * 0.5], [W * 0.34, Y1]];
      o.push(fields(`${curve(rv.map(([x, y]) => [x - 10, y]))}L${X0} ${Y1}L${X0} ${Y0}Z`, 4, W * 0.15, H * 0.5), `<path d="${curve([[W * 0.05, Y0], [W * 0.1, H * 0.5], [W * 0.04, Y1]])}" fill="none" stroke="${c.wall}" stroke-width="16" stroke-dasharray="3 3"/>`);
      o.push(grid(`${curve(rv.map(([x, y]) => [x + 14, y]))}L${X1} ${Y1}L${X1} ${Y0}Z`, 0, W * 0.7, H * 0.5, 32, 26));
      o.push(river(rv, 34, 18));
      const tx = W * 0.62, ty = H * 0.3; o.push(`<rect x="${f(tx - 40)}" y="${f(ty - 30)}" width="110" height="70" fill="${c.sand}" stroke="${c.wall}" stroke-width="2"/>`);
      for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) o.push(`<circle cx="${f(tx - 30 + i * 10)}" cy="${f(ty - 20 + j * 11)}" r="2.6" fill="${c.wall}"/>`);
      o.push(`<rect x="${f(tx + 52)}" y="${f(ty - 24)}" width="12" height="58" fill="${c.wall}"/>`);
      for (let k = 0; k < 16; k++) for (const s of [-1, 1]) o.push(`<rect x="${f(tx + 6 + s * 7 - 2)}" y="${f(ty + 46 + k * 9)}" width="4" height="5" fill="${c.wall}"/>`);
      o.push(`<path d="M${f(tx + 6)} ${f(ty + 42)}V${Y1}" stroke="${c.plaza}" stroke-width="6"/>`, boat(W * 0.39, H * 0.4, 90), boat(W * 0.38, H * 0.7, 95), big(`M${f(W * 0.52)} ${Y0}L${f(W * 0.5)} ${Y1}`, 4.6));
    } else if (pick === 3) { // 왕가의 계곡: 메마른 바위 산줄기 사이 굽이굽이 마른 골짜기, 골짜기 벽마다 무덤 입구, 구불구불한 길과 작은 주차장, 능선 등고선
      for (let k = 0; k < 22; k++) o.push(`<path d="${curve([[X0, H * (k * 0.06) - 20], [W * 0.3, H * (k * 0.06) + Math.sin(k) * 20], [W * 0.6, H * (k * 0.06) - 10], [X1, H * (k * 0.06) + 14]])}" fill="none" stroke="${c.wall}" stroke-width="${k % 3 ? 0.8 : 1.6}" opacity=".5"/>`);
      const va = [[X0, H * 0.7], [W * 0.25, H * 0.62], [W * 0.45, H * 0.4], [W * 0.62, H * 0.46], [W * 0.78, H * 0.24], [X1, H * 0.2]];
      o.push(`<path d="${curve(va)}" fill="none" stroke="${c.sand}" stroke-width="56" stroke-linecap="round"/>`, `<path d="${curve([[W * 0.45, H * 0.4], [W * 0.42, H * 0.18], [W * 0.5, Y0]])}" fill="none" stroke="${c.sand}" stroke-width="36" stroke-linecap="round"/>`);
      for (let k = 0; k < 16; k++) { const t = r(), i = Math.min(4, Math.floor(t * 5)), u = t * 5 - i, x = va[i][0] + (va[i + 1][0] - va[i][0]) * u, y = va[i][1] + (va[i + 1][1] - va[i][1]) * u + (k % 2 ? -22 : 22); o.push(`<rect x="${f(x - 3)}" y="${f(y - 2.5)}" width="6" height="5" rx="1" fill="${c.wall}"/>`); }
      o.push(way(curve(va), 2.6), `<rect x="${f(W * 0.6)}" y="${f(H * 0.52)}" width="40" height="22" rx="3" fill="${c.plaza}" stroke="${c.edge}"/>`, big(curve([[X0, H * 0.95], [W * 0.15, H * 0.75], va[1]]), 4));
    } else if (pick === 4) { // 아스완: 바위섬 흩어진 넓은 강, 사구가 강물에 바로 닿는 서쪽 기슭, 알록달록 누비아 마을, 동쪽 강변 시가지와 돛배 떼
      const rv = [[W * 0.5, Y0], [W * 0.46, H * 0.5], [W * 0.54, Y1]], nub = dark ? ['#5a4a6a', '#3e5a7a', '#6a4646', '#6a6040'] : ['#c9b6e6', '#9fc4ec', '#f0b0a8', '#f2d98a'];
      o.push(dunes(30), grid(`${curve(rv.map(([x, y]) => [x + 40, y]))}L${X1} ${Y1}L${X1} ${Y0}Z`, -8, W * 0.8, H * 0.5, 26, 20));
      o.push(river(rv, 130, 0));
      for (let k = 0; k < 14; k++) { const x = W * (0.38 + r() * 0.2), y = H * (0.05 + r() * 0.9), s = 4 + r() * 12; o.push(fill(blob(x, y, s, s * 0.7, 7, 0.35), c.wall), r() < 0.4 ? palms(x, y, 2, s * 0.5, s * 0.3) : ''); }
      const vx = W * 0.22, vy = H * 0.55; for (let k = 0; k < 40; k++) o.push(`<rect x="${f(vx + (r() - 0.5) * 90)}" y="${f(vy + (r() - 0.5) * 80)}" width="8" height="7" rx="1" fill="${nub[k % 4]}" stroke="${c.edge}" stroke-width="0.5"/>`);
      for (let k = 0; k < 6; k++) o.push(boat(W * (0.45 + r() * 0.12), H * (0.1 + r() * 0.8), 80 + r() * 20));
      o.push(big(curve(rv.map(([x, y]) => [x + 74, y])), 4.6));
    } else if (pick === 5) { // 알렉산드리아: 둥글게 휜 지중해 만과 길게 이어진 해안 큰길, 만 끝 곶 위 요새, 바둑판 시가지, 방파제와 항구, 둥근 도서관
      const bay = [[X0, H * 0.2], [W * 0.2, H * 0.36], [W * 0.5, H * 0.42], [W * 0.8, H * 0.34], [X1, H * 0.18]];
      o.push(grid(`${curve(bay.map(([x, y]) => [x, y + 24]))}L${X1} ${Y1}L${X0} ${Y1}Z`, 4, W * 0.5, H * 0.7, 28, 22));
      o.push(fill(`${curve(bay)}L${X1} ${Y0}L${X0} ${Y0}Z`, c.water), `<path d="${curve(bay.map(([x, y]) => [x, y + 6]))}" fill="none" stroke="${c.sand}" stroke-width="10"/>`);
      o.push(fill(blob(W * 0.86, H * 0.2, 30, 16, 8, 0.2), c.built), `<rect x="${f(W * 0.86 - 10)}" y="${f(H * 0.2 - 8)}" width="20" height="16" rx="2" fill="${c.wall}" stroke="${c.edge}"/>`);
      o.push(`<path d="${curve([[W * 0.08, H * 0.3], [W * 0.12, H * 0.12], [W * 0.3, H * 0.06]])}" fill="none" stroke="${c.contour}" stroke-width="7" stroke-linecap="round"/>`, `<circle cx="${f(W * 0.55)}" cy="${f(H * 0.56)}" r="12" fill="${c.bld}" stroke="${c.wall}" stroke-width="1.4"/><path d="M${f(W * 0.55 - 12)} ${f(H * 0.56)}h24" stroke="${c.wall}" stroke-width="1"/>`);
      o.push(big(curve(bay.map(([x, y]) => [x, y + 18])), 5.6), boat(W * 0.4, H * 0.24, 0));
    } else if (pick === 6) { // 시와 같은 사막 오아시스: 하얗게 빛나는 소금 호수, 둘레 빽빽한 야자 숲, 언덕 위 무너진 흙 요새 마을, 샘, 모래 언덕
      o.push(dunes(50));
      const lx = W * (0.55 + r() * 0.2), ly = H * 0.42, salt = dark ? '#3c4650' : '#eef4f7';
      o.push(fill(blob(lx, ly, 120, 54, 11, 0.3), salt), fill(blob(lx, ly, 96, 40, 11, 0.3), c.water));
      o.push(fill(blob(W * 0.3, H * 0.6, 110, 70, 10, 0.25), c.park), palms(W * 0.3, H * 0.6, 70, 100, 60));
      const fx = W * 0.32, fy = H * 0.58; o.push(fill(blob(fx, fy, 34, 26, 9, 0.2), c.wall)); for (let k = 0; k < 24; k++) o.push(`<rect x="${f(fx + (r() - 0.5) * 50)}" y="${f(fy + (r() - 0.5) * 40)}" width="6" height="5" rx="0.6" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.5"/>`);
      o.push(`<circle cx="${f(W * 0.2)}" cy="${f(H * 0.74)}" r="6" fill="${c.water}" stroke="${c.road}" stroke-width="2"/>`, way(curve([[X0, H * 0.9], [W * 0.25, H * 0.75], [fx, fy + 30], [lx - 100, ly + 40], [X1, H * 0.8]]), 3.4));
    } else if (pick === 7) { // 홍해 리조트: 붉은 바위 산 아래 해안, 옥빛 산호 얕은 바다와 짙은 바다, 해안 따라 수영장 딸린 리조트 줄, 작은 만 마리나, 사막 큰길
      const sh = [[W * 0.62, Y0], [W * 0.56, H * 0.3], [W * 0.66, H * 0.55], [W * 0.58, H * 0.8], [W * 0.64, Y1]], lag = dark ? '#1d4a5a' : '#bfe8ea', pool = dark ? '#2a6a8a' : '#8fd3f0';
      for (let k = 0; k < 14; k++) o.push(`<path d="${blob(W * 0.15, H * 0.5, 30 + k * 14, 40 + k * 18, 10, 0.1)}" fill="none" stroke="${c.wall}" stroke-width="1" opacity=".5"/>`);
      o.push(fill(`${curve(sh)}L${X1} ${Y1}L${X1} ${Y0}Z`, lag), fill(`${curve(sh.map(([x, y]) => [x + 50, y]))}L${X1} ${Y1}L${X1} ${Y0}Z`, c.water));
      for (let k = 0; k < 6; k++) { const y = H * (0.08 + k * 0.16), x = sh[0][0] + (r() - 0.5) * 20 - 30; o.push(`<rect x="${f(x - 24)}" y="${f(y - 14)}" width="30" height="26" rx="3" fill="${c.park}"/><rect x="${f(x - 20)}" y="${f(y - 10)}" width="12" height="8" rx="1" fill="${c.bld}" stroke="${c.wall}" stroke-width="0.8"/>`, `<path d="${blob(x - 4, y + 4, 8, 4, 7, 0.3)}" fill="${pool}" stroke="${c.road}" stroke-width="1.2"/>`, palms(x - 8, y, 3, 12, 10)); }
      o.push(big(curve(sh.map(([x, y]) => [x - 80, y])), 4.8), way(`M${f(W * 0.1)} ${Y0}L${f(W * 0.3)} ${f(H * 0.5)}L${f(sh[2][0] - 80)} ${f(sh[2][1])}`, 2.6));
    } else if (pick === 8) { // 나일 삼각주 마을: 사방 초록 들판 조각, 곧은 관개 수로 그물, 수로 따라 늘어선 흙집 마을, 야자 줄, 비둘기 탑
      o.push(fields(`M${X0} ${Y0}H${X1}V${Y1}H${X0}Z`, 8 + r() * 10, W * 0.5, H * 0.5, 22));
      for (let k = 0; k < 4; k++) { const y = H * (0.1 + k * 0.28); o.push(river([[X0, y], [W * 0.5, y + (r() - 0.5) * 30], [X1, y + (r() - 0.5) * 20]], 5, 0)); }
      for (let k = 0; k < 3; k++) { const x = W * (0.15 + k * 0.35); o.push(river([[x, Y0], [x + (r() - 0.5) * 40, H * 0.5], [x + (r() - 0.5) * 40, Y1]], 4, 0)); }
      for (let v = 0; v < 3; v++) { const vx = W * (0.2 + v * 0.3 + r() * 0.05), vy = H * (0.25 + (v % 2) * 0.45); o.push(fill(blob(vx, vy, 40, 22, 8, 0.25), c.built)); for (let k = 0; k < 22; k++) o.push(`<rect x="${f(vx + (r() - 0.5) * 66)}" y="${f(vy + (r() - 0.5) * 34)}" width="6" height="5" rx="0.6" fill="${c.bld}" stroke="${c.edge}" stroke-width="0.4"/>`); o.push(`<circle cx="${f(vx + 30)}" cy="${f(vy - 14)}" r="4" fill="${c.wall}"/>`, palms(vx, vy + 26, 6, 40, 4)); }
      o.push(big(`M${X0} ${f(H * 0.55)}L${X1} ${f(H * 0.45)}`, 4.6));
    } else if (pick === 9) { // 수에즈 운하 도시: 곧게 뻗은 운하와 줄지어 지나는 큰 배, 운하 어귀 항구 도시 바둑판, 맞은편 사막, 운하 옆 철길과 큰길, 짧은 우회 수로
      const cx = W * (0.5 + (r() - 0.5) * 0.2);
      o.push(dunes(30), rowsGrid(`M${X0} ${Y0}H${f(cx - 20)}V${f(H * 0.55)}H${X0}Z`, 0, W * 0.2, H * 0.3, 30, 22));
      o.push(`<path d="M${f(cx)} ${Y0}V${Y1}" stroke="${c.water}" stroke-width="30"/>`, `<path d="M${f(cx + 40)} ${f(H * 0.3)}Q${f(cx + 46)} ${f(H * 0.5)} ${f(cx)} ${f(H * 0.7)}M${f(cx)} ${f(H * 0.3)}L${f(cx + 40)} ${f(H * 0.3)}" fill="none" stroke="${c.water}" stroke-width="16"/>`);
      for (let k = 0; k < 4; k++) o.push(`<rect x="${f(cx - 4)}" y="${f(H * (0.05 + k * 0.24))}" width="8" height="28" rx="3" fill="${c.wall}" stroke="${c.edge}" stroke-width="0.8"/>`);
      o.push(fill(`M${X0} ${Y0}H${f(cx - 16)}V${f(H * 0.08)}H${X0}Z`, c.water), rail(`M${f(cx - 26)} ${Y0}V${Y1}`), big(`M${f(cx - 40)} ${Y0}V${Y1}`, 5), way(`M${f(cx + 30)} ${Y0}V${Y1}`, 3));
    } else if (pick === 10) { // 옛 카이로 골목: 빽빽한 미로 골목, 둥근 지붕과 첨탑 사원 여럿, 언덕 위 성채, 지붕 덮인 시장 길, 성문
      const sp = 22, N = 22, P = []; for (let i = 0; i <= N; i++) { P.push([]); for (let j = 0; j <= N; j++) P[i].push([W / 2 + (i - N / 2) * sp + (r() - 0.5) * 12, H / 2 + (j - N / 2) * sp * 0.8 + (r() - 0.5) * 10]); }
      o.push(fill(`M${X0} ${Y0}H${X1}V${Y1}H${X0}Z`, c.bld)); let d = ''; for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const a = P[i][j]; if (i < N && r() > 0.35) d += `M${f(a[0])} ${f(a[1])}L${f(P[i + 1][j][0])} ${f(P[i + 1][j][1])}`; if (j < N && r() > 0.45) d += `M${f(a[0])} ${f(a[1])}L${f(P[i][j + 1][0])} ${f(P[i][j + 1][1])}`; }
      o.push(way(d, 1.8));
      for (let k = 0; k < 7; k++) { const i = 2 + Math.floor(r() * (N - 4)), j = 2 + Math.floor(r() * (N - 4)), [x, y] = P[i][j]; o.push(mosque(x, y, 1 + r() * 0.4)); }
      const sm = P.map(rw => rw[Math.floor(N / 2)]); o.push(`<path d="${curve(sm)}" fill="none" stroke="${c.plaza}" stroke-width="8"/>`, `<path d="${curve(sm)}" fill="none" stroke="${c.wall}" stroke-width="1.2" stroke-dasharray="2 3"/>`);
      const cx = W * 0.82, cy = H * 0.2; o.push(fill(blob(cx, cy, 50, 36, 8, 0.15), c.sand), `<path d="${blob(cx, cy, 40, 28, 8, 0.1)}" fill="${c.plaza}" stroke="${c.wall}" stroke-width="3"/>`, mosque(cx, cy, 1.5));
      o.push(big(`M${X0} ${f(H * 0.92)}L${X1} ${f(H * 0.86)}`, 5));
    } else { // 아부심벨: 넓은 호수와 들쭉날쭉 메마른 바위 기슭, 기슭 바위에 새긴 큰 신전 둘, 작은 마을과 비행장, 사막 길
      const lake = blob(W * 0.65, H * 0.55, 220, 180, 14, 0.35);
      o.push(dunes(30), fill(lake, c.water));
      for (let k = 0; k < 10; k++) o.push(fill(blob(W * (0.35 + r() * 0.6), H * (0.1 + r() * 0.8), 6 + r() * 14, 4 + r() * 8, 7, 0.4), c.land));
      const tx = W * 0.32, ty = H * 0.42; o.push(`<path d="M${f(tx - 30)} ${f(ty - 24)}h40v48h-40z" fill="${c.wall}"/>`, ...[0, 1, 2, 3].map(k => `<rect x="${f(tx - 26 + k * 9)}" y="${f(ty - 16)}" width="6" height="18" rx="2" fill="${c.sand}"/>`), `<path d="M${f(tx - 26)} ${f(ty + 34)}h24v20h-24z" fill="${c.wall}"/>`);
      o.push(fill(blob(W * 0.15, H * 0.7, 36, 20, 8, 0.2), c.built), palms(W * 0.15, H * 0.6, 8, 30, 8));
      o.push(`<path d="M${f(W * 0.05)} ${f(H * 0.18)}L${f(W * 0.3)} ${f(H * 0.08)}" stroke="${c.contour}" stroke-width="12"/><path d="M${f(W * 0.05)} ${f(H * 0.18)}L${f(W * 0.3)} ${f(H * 0.08)}" stroke="${c.road}" stroke-width="1.2" stroke-dasharray="6 5"/>`, way(curve([[X0, H * 0.9], [W * 0.15, H * 0.7], [tx - 40, ty], [W * 0.2, H * 0.15]]), 3), big(`M${X0} ${f(H * 0.4)}L${f(W * 0.15)} ${f(H * 0.68)}`, 4.4));
    }
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
const KINDS = ['oldRiver', 'gridLake', 'star', 'bay', 'island', 'mountain', 'canals', 'octagon', 'suburb', 'confluence', 'walled', 'railHub', 'hillPort', 'fjordVillage', 'canalGrid', 'deltaCity', 'oasis', 'farmVillage', 'medina', 'lakeResort', 'riverIslands', 'collegeTown', 'alpineValley', 'hilltop', 'interchange', 'portDocks', 'bigRiver', 'apartments', 'alleys', 'downtown', 'atoll', 'stiltVillage', 'riceTerraces', 'canyon', 'usTown', 'euroSquare', 'beachTown', 'campus', 'strait', 'archipelago', 'polarPort', 'pivotFarms', 'mountainCity', 'hillside', 'ruralTown', 'stationFront', 'castleMoat', 'templeRuins', 'crater', 'saltFlats', 'caveTown', 'savanna', 'tropicalResort', 'airportTown', 'villaTown', 'jpHouses', 'terraces', 'courtyardBlocks', 'jpSuburb', 'krTown', 'haussmann', 'auSuburb', 'cnSuperblock', 'nordicWood', 'itOldNew', 'usStrip', 'caLake', 'krUniv', 'deDorf', 'jpDanchi', 'noSnow', 'egypt'];
const KO = { oldRiver: '강가 구시가지', gridLake: '바둑판 + 호수', star: '방사형 광장', bay: '만 · 해안', island: '섬', mountain: '산골 마을', canals: '반원 운하', octagon: '사선 바둑판 + 바다', suburb: '교외 고리길', confluence: '두 강이 만나는 곳', walled: '별 모양 성곽', railHub: '철길이 모이는 역', hillPort: '계단식 언덕 항구', fjordVillage: '피오르 마을', canalGrid: '운하 바둑판', deltaCity: '삼각주 도시', oasis: '사막 오아시스', farmVillage: '논밭 사이 마을', medina: '성벽 안 미로 골목', lakeResort: '호숫가 휴양지', riverIslands: '강 가운데 섬', collegeTown: '대학 도시', alpineValley: '알프스 골짜기', hilltop: '언덕 꼭대기 마을', interchange: '신도시 나들목', portDocks: '컨테이너 항구', bigRiver: '큰 강 대도시', apartments: '아파트 단지', alleys: '골목 주택가', downtown: '도심 업무지구', atoll: '산호섬 환초', stiltVillage: '수상가옥 마을', riceTerraces: '계단식 논', canyon: '협곡 도시', usTown: '미국 소도시', euroSquare: '유럽 소도시 광장', beachTown: '해변 소도시', campus: '학교 캠퍼스 동네', strait: '해협 도시', archipelago: '다도해', polarPort: '극지 항구', pivotFarms: '원형 농장 사막', mountainCity: '산 아래 도시', hillside: '언덕 주택가', ruralTown: '시골 읍내', stationFront: '역 앞 번화가', castleMoat: '해자 두른 성 마을', templeRuins: '사원 유적', crater: '화산 분화구 마을', saltFlats: '염전 · 갯벌 마을', caveTown: '동굴 · 바위 마을', savanna: '사바나 마을', tropicalResort: '열대 해변 리조트', airportTown: '공항 옆 동네', villaTown: '빌라촌', jpHouses: '단독주택 주택가', terraces: '테라스 하우스 동네', courtyardBlocks: '중정 블록 시가지', jpSuburb: '교외 역세권', krTown: '지방 소도시 시내', haussmann: '오스만 블록 시가지', auSuburb: '넓은 교외', cnSuperblock: '대로 사이 큰 단지', nordicWood: '목조 주택 교외', itOldNew: '옛 시내 + 새 시내', usStrip: '큰길 상가 교외', caLake: '호숫가 교외 도시', krUniv: '대학가 · 원룸촌', deDorf: '들판 마을', jpDanchi: '단지(団地)', noSnow: '눈 덮인 노르웨이 도시', egypt: '이집트' };
return { draw, KINDS, KO, hsh };
})();
if (typeof module !== 'undefined') module.exports = TOWN3;
