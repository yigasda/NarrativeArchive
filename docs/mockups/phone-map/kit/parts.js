// 지도 재료 10가지: 건물 종류(집 줄 놓는 법) 5 + 땅 위에 놓이는 것 3 + 물가 2. 다 이름 해시(r)로만 움직여요.
module.exports = ({ C, f, curve, r, inEll }) => {
  const rot = (x, y, a, w, h, fill, rx = 0.8) => `<rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}" rx="${rx}" transform="translate(${f(x)} ${f(y)}) rotate(${f(a * 57.2958)})" fill="${fill}"/>`;
  // walk a street, calling put(x, y, angle, nx, ny) every `gap` points
  const along = (l, gap, put) => { let o = ''; for (let i = 2; i < l.pts.length - 2; i += gap) { const [x0, y0] = l.pts[i - 1], [x1, y1] = l.pts[i + 1], a = Math.atan2(y1 - y0, x1 - x0); o += put(l.pts[i][0], l.pts[i][1], a, -Math.sin(a), Math.cos(a)); } return o; };
  const HOUSE = {
    // 1 · 일본 골목: 작은 목조 집이 길 양옆에 두 줄, 빽빽하게
    wood: block => l => along(l, 2, (x, y, a, nx, ny) => { let o = ''; for (const s of [-1, 1]) for (const k of [5.4, 10.6]) { if (r() < 0.12) continue; const hx = x + nx * k * s, hy = y + ny * k * s; if (!block(hx, hy)) o += rot(hx, hy, a, 4.6 + r() * 1.4, 4 + r(), r() < 0.35 ? C.bld2 : C.bld, 0.5); } return o; }),
    // 3 · 유럽 중정형: 길을 따라 끊김 없이 이어진 건물 띠, 블록 가운데는 비워 둬요(안뜰)
    court: block => l => along(l, 3, (x, y, a, nx, ny) => { let o = ''; for (const s of [-1, 1]) { const hx = x + nx * 6.8 * s, hy = y + ny * 6.8 * s; if (!block(hx, hy)) o += rot(hx, hy, a, 9.6, 6.2, r() < 0.25 ? C.bld2 : C.bld, 0.3); } return o; }),
    // 4 · 미국 교외: 띄엄띄엄 집 한 채, 뒤에 마당(초록), 앞은 차고 진입로
    yard: block => l => along(l, 5, (x, y, a, nx, ny) => { let o = ''; for (const s of [-1, 1]) { if (r() < 0.2) continue; const hx = x + nx * 9 * s, hy = y + ny * 9 * s, gx = x + nx * 16 * s, gy = y + ny * 16 * s; if (block(hx, hy)) continue;
      o += rot(gx, gy, a, 11, 8, C.park, 1.5) + rot(hx, hy, a, 8, 6.4, C.bld, 0.8) + `<path d="M${f(x + nx * 3 * s)} ${f(y + ny * 3 * s)}L${f(hx - nx * 3 * s)} ${f(hy - ny * 3 * s)}" stroke="#fff" stroke-width="1.6"/>`; } return o; }),
    // 5 · 큰 빌딩: 역 앞 · 업무지구, 넓은 덩어리가 듬성듬성
    tower: block => l => along(l, 6, (x, y, a, nx, ny) => { let o = ''; for (const s of [-1, 1]) { if (r() < 0.25) continue; const hx = x + nx * 11 * s, hy = y + ny * 11 * s; if (!block(hx, hy)) o += rot(hx, hy, a, 13 + r() * 8, 10 + r() * 6, C.bld2, 1.2) + rot(hx, hy, a, 5, 4, '#cfc8bb', 0.6); } return o; }),
    plain: block => l => along(l, 3, (x, y, a, nx, ny) => { let o = ''; for (const s of [-1, 1]) { if (r() < 0.18) continue; const hx = x + nx * 6.8 * s, hy = y + ny * 6.8 * s; if (!block(hx, hy)) o += rot(hx, hy, a, 6 + r() * 3, 5 + r() * 2.4, r() < 0.3 ? C.bld2 : C.bld); } return o; }),
  };
  // 2 · 한국 아파트 단지: 담 안쪽에 길쭉한 동이 나란히, 단지 안을 도는 길, 단지 이름
  const apt = (cx, cy, w, h, a, name) => { const ca = Math.cos(a), sa = Math.sin(a), P = (u, v) => [cx + u * ca - v * sa, cy + u * sa + v * ca];
    let o = `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${f(a * 57.2958)})"><rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}" rx="10" fill="#e9eedf"/>`
      + `<rect x="${f(-w / 2 + 8)}" y="${f(-h / 2 + 8)}" width="${f(w - 16)}" height="${f(h - 16)}" rx="8" fill="none" stroke="#fff" stroke-width="3.2"/>`;
    // the blocks: long slabs in rows, towers on a grid, slabs and towers mixed, or slabs fanned round a court
    const lay = ['slab', 'tower', 'mix', 'fan'][Math.floor(r() * 4)], B = '#d6d0c4';
    if (lay === 'slab') { const cols = Math.max(2, Math.floor((w - 30) / 34)), rows = Math.max(2, Math.floor((h - 30) / 22)); for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (r() > 0.08) o += `<rect x="${f(-w / 2 + 18 + i * ((w - 36) / cols))}" y="${f(-h / 2 + 16 + j * ((h - 30) / rows))}" width="${f((w - 36) / cols - 8)}" height="7" rx="1" fill="${B}"/>`; }
    if (lay === 'tower') for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) if (r() > 0.15) o += `<path d="M${f(-w / 2 + 20 + i * (w - 40) / 4)} ${f(-h / 2 + 16 + j * (h - 30) / 3)}h9v4h3v6h-12z" fill="${B}"/>`;
    if (lay === 'mix') { for (let i = 0; i < 3; i++) o += `<rect x="${f(-w / 2 + 16)}" y="${f(-h / 2 + 16 + i * 14)}" width="${f(w * 0.45)}" height="7" rx="1" fill="${B}"/>`; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) o += `<rect x="${f(w * 0.08 + i * 18)}" y="${f(-h / 2 + 16 + j * 20)}" width="11" height="11" rx="1" fill="${B}"/>`; }
    if (lay === 'fan') for (let i = 0; i < 6; i++) { const a2 = -2.6 + i * 0.42; o += `<rect x="-14" y="-3.5" width="28" height="7" rx="1" transform="translate(${f(Math.cos(a2) * w * 0.3)} ${f(Math.sin(a2) * h * 0.3)}) rotate(${f(a2 * 57.3 + 90)})" fill="${B}"/>`; }
    o += `<circle cx="${f(w / 2 - 20)}" cy="${f(h / 2 - 18)}" r="7" fill="${C.park}"/></g>`;
    return { svg: o, inside: (x, y) => { const dx = x - cx, dy = y - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca; return Math.abs(u) < w / 2 + 4 && Math.abs(v) < h / 2 + 4; }, at: P(0, h / 2 + 12), name }; };
  // 6 · 경내: 신사(도리이 참배길) · 절(산문 · 탑 · 마당) · 교회(묘지) · 사원(태국 지붕) — 나라와 해시로, 숲 모양 · 크기 · 참배길 방향도 달라요
  const shrine = (cx, cy, rx, ry, cc) => { rx *= 0.8 + r() * 0.5; ry *= 0.8 + r() * 0.4; const kind = cc === 'JP' ? (r() < 0.6 ? 'jinja' : 'tera') : cc === 'KR' ? 'tera' : cc === 'TH' ? 'wat' : 'church', dir = r() < 0.5 ? 1 : -1;
    let o = `<path d="${curve(Array.from({ length: 11 }, (_, k) => { const a = k / 11 * 6.283, q = 1 + (r() - 0.5) * 0.35; return [cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q]; }), true)}" fill="${kind === 'church' ? '#dfe8d4' : C.park}"/>`;
    o += Array.from({ length: Math.round(rx * ry / (kind === 'church' ? 90 : 45)) }, () => { const a = r() * 6.283, d = Math.sqrt(r()) * 0.9; return `<circle cx="${f(cx + Math.cos(a) * rx * d)}" cy="${f(cy + Math.sin(a) * ry * d)}" r="${f(2.2 + r() * 2.4)}" fill="${C.forest}"/>`; }).join('');
    const ex = cx, ey = cy + ry * dir;
    if (kind === 'jinja') o += `<path d="M${f(ex)} ${f(ey)}V${f(cy + 4 * dir)}" stroke="#efe6d2" stroke-width="5"/>` + `<rect x="${f(cx - 11)}" y="${f(cy - 8)}" width="22" height="14" rx="1.5" fill="#d9cdb7" stroke="#c6b89c"/>` + [0.25, 0.6].map(t => { const y = cy + (ey - cy) * (0.3 + t); return `<path d="M${f(cx - 6)} ${f(y)}h12M${f(cx - 4)} ${f(y)}v5M${f(cx + 4)} ${f(y)}v5" stroke="#c96a52" stroke-width="1.6" stroke-linecap="round"/>`; }).join('');
    if (kind === 'tera') o += `<rect x="${f(cx - rx * 0.5)}" y="${f(cy - ry * 0.35)}" width="${f(rx)}" height="${f(ry * 0.7)}" fill="#efe6d2"/><rect x="${f(cx - 14)}" y="${f(cy - 10)}" width="28" height="16" rx="1" fill="#d4c6ab" stroke="#bfae8d"/><rect x="${f(cx + rx * 0.3)}" y="${f(cy - 6)}" width="8" height="8" fill="#c9b99a"/><rect x="${f(cx - 6)}" y="${f(cy + ry * 0.35 - 3)}" width="12" height="5" fill="#c9b99a"/>`;
    if (kind === 'wat') o += `<rect x="${f(cx - rx * 0.55)}" y="${f(cy - ry * 0.4)}" width="${f(rx * 1.1)}" height="${f(ry * 0.8)}" fill="#f1e8d4"/><path d="M${f(cx - 14)} ${f(cy + 6)}L${f(cx)} ${f(cy - 12)}L${f(cx + 14)} ${f(cy + 6)}Z" fill="#e2b45c"/><circle cx="${f(cx + rx * 0.35)}" cy="${f(cy)}" r="6" fill="#ead9b0" stroke="#d9c08a"/>`;
    if (kind === 'church') { o += `<path d="M${f(cx - 8)} ${f(cy - 14)}h16v26h-16zM${f(cx - 16)} ${f(cy - 2)}h32v8h-32z" fill="#d6cfc2"/>`; for (let i = 0; i < 14; i++) o += `<rect x="${f(cx - rx * 0.6 + (i % 7) * rx * 0.18)}" y="${f(cy + ry * 0.25 + Math.floor(i / 7) * 7)}" width="3" height="4" rx=".6" fill="#c9c3b8"/>`; }
    return { svg: o, inside: (x, y) => inEll(x, y, cx, cy, rx + 3, ry + 3) }; };
  // 7 · 학교: 나라마다 다른 운동장 · 건물 모양, 해시로 크기 · 방향 · 붙는 시설(테니스 · 농구 · 수영장 · 강당)
  const school = (cx, cy, a, cc) => { const g = (x, y, w, h, c, rx = 1.5) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${rx}" fill="${c}"/>`;
    const kind = { JP: 'dirt', KR: 'turf', DE: 'court', FR: 'court', PT: 'court', NL: 'court', US: 'fields', TH: 'yard' }[cc] || 'turf';
    const W = 64 + r() * 22, H = 46 + r() * 16, shape = ['I', 'L', 'U', 'O'][Math.floor(r() * 4)], extra = ['tennis', 'hoop', 'pool', 'hall'].filter(() => r() < 0.45);
    let o = g(-W / 2, -H / 2, W, H, '#ece6da', 4);
    if (kind === 'dirt') o += g(-W / 2 + 4, -H / 2 + 4, W * 0.58, H - 8, '#eadcc2', 3);
    if (kind === 'turf') o += `<rect x="${f(-W / 2 + 4)}" y="${f(-H / 2 + 4)}" width="${f(W * 0.58)}" height="${f(H - 8)}" rx="${f((H - 8) / 2)}" fill="#e7c6ae"/><rect x="${f(-W / 2 + 10)}" y="${f(-H / 2 + 10)}" width="${f(W * 0.58 - 12)}" height="${f(H - 20)}" rx="${f((H - 20) / 2)}" fill="#bfdcae"/>`;
    if (kind === 'fields') o += `<path d="M${f(-W / 2 + 4)} ${f(-H / 2 + 4)}h${f(W * 0.5)}a${f(W * 0.5)} ${f(W * 0.5)} 0 0 1 ${f(-W * 0.5)} ${f(W * 0.5)}Z" fill="#cfe3bf"/><path d="M${f(-W / 2 + 8)} ${f(-H / 2 + 8)}l10 10M${f(-W / 2 + 8)} ${f(-H / 2 + 8)}h14M${f(-W / 2 + 8)} ${f(-H / 2 + 8)}v14" stroke="#e2cfa9" stroke-width="2"/>`;
    if (kind === 'yard') o += g(-W / 2 + 4, -H / 2 + 4, W * 0.45, H * 0.6, '#e4ddcf', 2) + `<path d="M${f(-W / 2 + 4)} ${f(-H / 2 + 4)}h${f(W * 0.45)}" stroke="#cfc7b8" stroke-width="2.4"/>`;
    const bx = kind === 'court' ? -W / 2 + 6 : W * 0.12, bw = kind === 'court' ? W - 12 : W * 0.34, by = -H / 2 + 5, bh = H - 10;
    o += shape === 'I' ? g(bx, by, bw * 0.4, bh, '#d6cfc2') : shape === 'L' ? g(bx, by, bw, bh * 0.3, '#d6cfc2') + g(bx + bw * 0.6, by, bw * 0.4, bh, '#d6cfc2')
      : shape === 'U' ? g(bx, by, bw, bh * 0.28, '#d6cfc2') + g(bx, by, bw * 0.3, bh, '#d6cfc2') + g(bx + bw * 0.7, by, bw * 0.3, bh, '#d6cfc2')
      : `<rect x="${f(bx)}" y="${f(by)}" width="${f(bw)}" height="${f(bh)}" fill="none" stroke="#d6cfc2" stroke-width="${f(Math.min(bw, bh) * 0.28)}"/>`;
    if (extra.includes('tennis')) o += g(W / 2 - 16, H / 2 - 12, 12, 8, '#9fbfa5', 1) + `<path d="M${f(W / 2 - 10)} ${f(H / 2 - 12)}v8" stroke="#fff" stroke-width=".7"/>`;
    if (extra.includes('pool')) o += g(-W / 2 + 6, H / 2 - 11, 14, 7, '#9fcbe8', 1);
    if (extra.includes('hoop')) o += g(W / 2 - 30, H / 2 - 12, 11, 8, '#e2c7a4', 1);
    if (extra.includes('hall')) o += g(-W / 2 + 22, H / 2 - 13, 16, 10, '#cfc8bb', 2);
    return { svg: `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${f(a * 57.2958)})">${o}</g>`, inside: (x, y) => inEll(x, y, cx, cy, W * 0.62, H * 0.75) }; };
  // 8 · 바닷가: 모래사장 띠, 해안선 따라 해안도로, 방파제와 등대
  const beach = (coast, big) => { const pts = coast.pts, sand = `<path d="${curve(pts)} L430 640 L-30 640Z" fill="${C.sand}"/>`, sea = `<path d="${curve(pts.map(([x, y]) => [x, y + 22]))} L430 640 L-30 640Z" fill="${C.water}"/>`;
    const road = big(curve(pts.map(([x, y]) => [x, y - 8])), 6.5), bx = pts[5][0], by = pts[5][1] + 22;
    const pier = `<path d="M${f(bx)} ${f(by)} l38 46 l18 -4" fill="none" stroke="#cfc9be" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${f(bx + 56)}" cy="${f(by + 42)}" r="3.4" fill="#e06b5c"/>`;
    const waves = Array.from({ length: 8 }, (_, i) => { const x = 20 + i * 48, y = coast.at(x) + 50 + (i % 3) * 22; return `<path d="M${f(x)} ${f(y)}q6 -3 12 0t12 0" fill="none" stroke="#9dc3e6" stroke-width="1.2"/>`; }).join('');
    return { under: sand + sea + waves + pier, over: road }; };
  // 9 · 강 둔치: 물 양옆에 공원 띠와 자전거길, 다리 몇 개
  const riverbank = (pts, w, way) => { const d = curve(pts), bx = [70 + r() * 60, 230 + r() * 60];
    return { under: `<path d="${d}" fill="none" stroke="${C.park}" stroke-width="${f(w + 30)}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#e9e2cf" stroke-width="${f(w + 8)}" stroke-dasharray="1 0" opacity=".0"/><path d="${d}" fill="none" stroke="${C.water}" stroke-width="${f(w)}" stroke-linecap="round"/>`
      + `<path d="${curve(pts.map(([x, y]) => [x, y - w / 2 - 9]))}" fill="none" stroke="#e8c9a6" stroke-width="1.4" stroke-dasharray="4 3"/>`, bridges: bx }; };
  // 10 · 언덕 계단길: 등고선을 가로지르는 계단(가로 눈금)
  const stairs = (lines, hx, hy) => { let o = ''; const near = lines.filter(l => l.fam === 1).filter(l => l.pts.some(([x, y]) => Math.hypot(x - hx, y - hy) < 200)).slice(0, 5);
    for (const l of near) { const seg = l.pts.filter(([x, y]) => Math.hypot(x - hx, y - hy) < 220).slice(0, 30); if (seg.length < 8) continue; const d = 'M' + seg.map(([x, y]) => `${f(x)} ${f(y)}`).join('L');
      o += `<path d="${d}" fill="none" stroke="#fff" stroke-width="4.6" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#c9c1b3" stroke-width="3.6" stroke-dasharray="1.2 2.2"/>`; } return o; };
  return { HOUSE, apt, shrine, school, beach, riverbank, stairs };
};
