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
    const cols = Math.max(2, Math.floor((w - 30) / 34)), rows = Math.max(2, Math.floor((h - 30) / 22));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (r() > 0.08) o += `<rect x="${f(-w / 2 + 18 + i * ((w - 36) / cols))}" y="${f(-h / 2 + 16 + j * ((h - 30) / rows))}" width="${f((w - 36) / cols - 8)}" height="7" rx="1" fill="#d6d0c4"/>`;
    o += `<circle cx="${f(w / 2 - 20)}" cy="${f(h / 2 - 18)}" r="7" fill="${C.park}"/></g>`;
    return { svg: o, inside: (x, y) => { const dx = x - cx, dy = y - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca; return Math.abs(u) < w / 2 + 4 && Math.abs(v) < h / 2 + 4; }, at: P(0, h / 2 + 12), name }; };
  // 6 · 신사 · 절 경내: 숲 안의 본당, 참배길(점선)과 문
  const shrine = (cx, cy, rx, ry, torii = true) => ({ svg: `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${C.park}"/>` + Array.from({ length: Math.round(rx * ry / 45) }, () => { const a = r() * 6.283, d = Math.sqrt(r()) * 0.9; return `<circle cx="${f(cx + Math.cos(a) * rx * d)}" cy="${f(cy + Math.sin(a) * ry * d)}" r="${f(2.2 + r() * 2.4)}" fill="${C.forest}"/>`; }).join('')
      + `<path d="M${f(cx)} ${f(cy + ry)}V${f(cy + 4)}" stroke="#efe6d2" stroke-width="5"/><path d="M${f(cx)} ${f(cy + ry)}V${f(cy + 4)}" stroke="#d8ccb3" stroke-width="1" stroke-dasharray="2 3"/>`
      + `<rect x="${f(cx - 11)}" y="${f(cy - 10)}" width="22" height="14" rx="1.5" fill="#d9cdb7" stroke="#c6b89c"/>` + (torii ? `<path d="M${f(cx - 6)} ${f(cy + ry - 6)}h12M${f(cx - 4)} ${f(cy + ry - 6)}v6M${f(cx + 4)} ${f(cy + ry - 6)}v6" stroke="#c96a52" stroke-width="1.6" stroke-linecap="round"/>` : ''),
    inside: (x, y) => inEll(x, y, cx, cy, rx + 3, ry + 3) });
  // 7 · 학교: ㄱ자 건물 + 트랙 운동장
  const school = (cx, cy, a) => ({ svg: `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${f(a * 57.2958)})"><rect x="-36" y="-26" width="72" height="52" rx="4" fill="#ece6da"/><rect x="-30" y="-20" width="38" height="40" rx="19" fill="#e7c6ae"/><rect x="-24" y="-14" width="26" height="28" rx="13" fill="#cfe3bf"/><path d="M14 -20h16v40h-16zM14 -20h-4v8h4" fill="#d6cfc2"/></g>`,
    inside: (x, y) => inEll(x, y, cx, cy, 42, 34) });
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
