// 지갑 표 뒤 무늬(viewBox 340×200, 오른쪽에 붙어요). 종류마다 그 물건을 정확한 비율 · 원근으로, 고른 가는 선과 옅은 면 두세 단계로만 그려요
const r1 = v => Math.round(v * 10) / 10;
const S = (fg, op, w = 0.8) => `stroke="${fg}" stroke-opacity="${r1(op * 100) / 100}" fill="none" stroke-width="${w}"`;
const F = (fg, a) => `fill="${fg}" fill-opacity="${r1(a * 1000) / 1000}"`;
const P = (d, a) => `<path d="${d}" ${a}/>`;
const range = (a, b, s = 1) => { const o = []; for (let v = a; s > 0 ? v < b : v > b; v += s) o.push(v); return o; };
const cos = Math.cos, sin = Math.sin, PI = Math.PI, D = PI / 180;
const pt = (cx, cy, r, a) => [r1(cx + r * cos(a)), r1(cy + r * sin(a))];
const M = ([x, y]) => `${x} ${y}`;
// ---- kept: flight, membership
const flight = (fg, op) => {
    const s = S(fg, op), cx = 270, cy = 150, r = 120;
    return range(0, 90, 15).map(a => `<ellipse cx="${cx}" cy="${cy}" rx="${r1(r * Math.abs(cos(a / 180 * PI)))}" ry="${r}" ${s}/>`).join('')
        + [-45, -20, 0, 20, 45].map(a => `<path d="M${cx - r} ${r1(cy - r * sin(a / 180 * PI))} H${cx + r}" ${s}/>`).join('')
        + `<path d="M140 70 Q240 30 330 95" ${S(fg, op * 2.2, 1.1)} stroke-dasharray="2 4"/><circle cx="140" cy="70" r="2.4" fill="${fg}" fill-opacity="${r1(op * 250) / 100}"/>`;
};
const dots = (fg, op) => range(0, 12).flatMap(c => range(0, 12).map(r => `<circle cx="${150 + c * 16}" cy="${12 + r * 16}" r="${r1((0.6 + (c + r) * 0.12) * 100) / 100}" fill="${fg}" fill-opacity="${r1(op * 160) / 100}"/>`)).join('');
const holo = (fg, op, u) => `<defs><linearGradient id="${u}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd1f0"/><stop offset=".35" stop-color="#c4f2ff"/><stop offset=".7" stop-color="#d9ffc9"/><stop offset="1" stop-color="#fff1b8"/></linearGradient></defs><rect x="262" y="-10" width="46" height="230" fill="url(#${u}h)" fill-opacity=".28"/>` + range(0, 12).map(i => `<path d="M${262 + i * 4} -10 V220" stroke="#fff" stroke-opacity=".12"/>`).join('');

// ---- each kind a finely built texture of its own, faded in from the left so the words stay clear
const fadeIn = (u, inner) => `<defs><linearGradient id="${u}f" x1="0" x2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#fff"/></linearGradient><mask id="${u}m"><rect x="-20" y="-20" width="400" height="260" fill="url(#${u}f)"/></mask></defs><g mask="url(#${u}m)">${inner}</g>`;
const Z = (fg, op, k = 1, w = 0.7) => S(fg, op * k, w);
// train: a tunnel, rounded portals stepping away to one point
const train = (fg, op, u) => fadeIn(u, range(0, 16).map(i => { const k = 0.84 ** i, w = 300 * k, h = 230 * k, cx = 300 + (1 - k) * 4, cy = 100; return `<rect x="${r1(cx - w / 2)}" y="${r1(cy - h / 2)}" width="${r1(w)}" height="${r1(h)}" rx="${r1(h * 0.42)}" ${Z(fg, op, 1.4 - i * 0.05)}/>`; }).join('')
    + P(range(0, 8).map(i => { const a = PI * (0.6 + i * 0.1); return `M${M(pt(300, 100, 12, a))}L${M(pt(300, 100, 260, a))}`; }).join(''), Z(fg, op, 0.6, 0.5)));
// concert: moiré, two sets of rings a little apart, the interference doing the work
const rings = (fg, op, u) => fadeIn(u, range(1, 40).map(i => `<circle cx="296" cy="96" r="${i * 5}" ${Z(fg, op, 0.8, 0.5)}/><circle cx="326" cy="112" r="${i * 5}" ${Z(fg, op, 0.8, 0.5)}/>`).join(''));
// concert: a sound ribbon, many sine lines in shifted phase twisting into one band
const spots = (fg, op, u) => fadeIn(u, range(0, 26).map(j => { const ph = j * 0.12; return `<path d="M${range(0, 61).map(i => { const x = 130 + i * 5, t = i / 60; return `${r1(x)} ${r1(100 + (42 * sin(t * PI * 2.2 + ph) + 10 * cos(t * PI * 5 + ph * 2)) * sin(t * PI))}`; }).join('L')}" ${Z(fg, op, 1, 0.5)}/>`; }).join(''));
// hotel: a tufted headboard, quilted lines with a button at each crossing
const windows = (fg, op, u) => { let d = '', dots = ''; for (let i = -8; i < 14; i++) d += `M${150 + i * 22} -10l120 220M${150 + i * 22} 210l120 -220`;
    for (let r = 0; r < 12; r++) for (let c = 0; c < 14; c++) { const x = 150 + c * 22 + (r % 2 ? 11 : 0), y = -10 + r * 20.2; dots += `<circle cx="${r1(x)}" cy="${r1(y)}" r="1.3" ${F(fg, op * 1.8)}/>`; }
    return fadeIn(u, P(d, Z(fg, op, 1, 0.5)) + dots); };
// hotel: satin, fine pinstripes under one soft sheen
const doors = (fg, op, u) => fadeIn(u, `<defs><linearGradient id="${u}s" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="${fg}" stop-opacity="0"/><stop offset=".55" stop-color="${fg}" stop-opacity="${r1(op * 0.7 * 100) / 100}"/><stop offset=".8" stop-color="${fg}" stop-opacity="0"/></linearGradient></defs><rect x="0" y="-10" width="400" height="220" fill="url(#${u}s)"/>` + P(range(0, 60).map(i => `M${130 + i * 4.5} -10V210`).join(''), Z(fg, op, 0.55, 0.4)));
// match: a football in wire, the icosahedron's edges turned in space
const pitch = (fg, op, u) => { const t = (1 + Math.sqrt(5)) / 2, V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    const rot = ([x, y, z]) => { const a = 0.5, b = 0.35; const x1 = x * cos(a) + z * sin(a), z1 = -x * sin(a) + z * cos(a), y1 = y * cos(b) - z1 * sin(b), z2 = y * sin(b) + z1 * cos(b); return [x1, y1, z2]; };
    const R = 84 / Math.hypot(1, t), P3 = V.map(rot); let d = '', back = '';
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) { const dd = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]); if (Math.abs(dd - 2) > 0.01) continue;
        const [a, b] = [P3[i], P3[j]], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], seg = `M${r1(306 + a[0] * R)} ${r1(100 - a[1] * R)}L${r1(306 + b[0] * R)} ${r1(100 - b[1] * R)}`;
        if (m[2] > 0) d += seg; else back += seg; }
    return fadeIn(u, `<circle cx="306" cy="100" r="${r1(R * Math.hypot(1, t))}" ${Z(fg, op, 1.3, 0.8)}/>` + P(back, Z(fg, op, 0.5, 0.5) + ' stroke-dasharray="2 3"') + P(d, Z(fg, op, 1.4, 0.8))); };
// match: the pitch seen from the stand, mown stripes in perspective with their fine edges
const bowl = (fg, op, u) => { const vx = 300, vy = -60, x = (x0, y) => r1(vx + (x0 - vx) * (y - vy) / (210 - vy)); let st = '', ln = '';
    for (let i = 0; i < 16; i++) { const a = 60 + i * 30, b = a + 30, y0 = 20; ln += `M${x(a, y0)} ${y0}L${a} 210`; if (i % 2) st += `M${x(a, y0)} ${y0}L${a} 210H${b}L${x(b, y0)} ${y0}Z`; }
    return fadeIn(u, P(st, F(fg, 0.04)) + P(ln, Z(fg, op, 0.8, 0.5)) + P(`M${x(60, 20)} 20H${x(540, 20)}M${x(60, 90)} 90H${x(540, 90)}`, Z(fg, op, 1.3, 0.8)) + `<ellipse cx="${vx}" cy="90" rx="${r1((x(540, 90) - x(60, 90)) * 0.09)}" ry="9" ${Z(fg, op, 1.3, 0.8)}/>`); };
// movie: an anamorphic flare, a long streak of light with its ghosts along a line
const beam = (fg, op, u) => fadeIn(u, `<defs><radialGradient id="${u}g"><stop offset="0" stop-color="${fg}" stop-opacity="${r1(op * 3 * 100) / 100}"/><stop offset="1" stop-color="${fg}" stop-opacity="0"/></radialGradient></defs><ellipse cx="300" cy="70" rx="200" ry="5" fill="url(#${u}g)"/><ellipse cx="300" cy="70" rx="80" ry="2" fill="url(#${u}g)"/><circle cx="300" cy="70" r="26" fill="url(#${u}g)"/>`
    + [[262, 100, 10], [236, 120, 5], [214, 138, 16], [190, 156, 7]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" ${F(fg, 0.05)} ${Z(fg, op, 1.2, 0.6)}/>`).join('') + P(range(0, 12).map(i => `M${M(pt(300, 70, 8, i * PI / 6))}L${M(pt(300, 70, i % 3 ? 22 : 44, i * PI / 6))}`).join(''), Z(fg, op, 1.4, 0.5)));
// movie: the projector beam, fine rays with dust caught in them
const premiere = (fg, op, u) => fadeIn(u, P(range(0, 40).map(i => `M352 -6L${130 + i * 5.5} 214`).join(''), Z(fg, op, 0.55, 0.4)) + range(0, 40).map(i => { const t = ((i * 37) % 100) / 100, q = ((i * 61) % 100) / 100, y = -6 + t * 220, x = 352 - (352 - (130 + q * 220)) * t; return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(0.5 + q)}" ${F(fg, op * 2.2)}/>`; }).join(''));
// museum: an isometric lattice, the floor of a gallery drawn in fine triangles
const columns = (fg, op, u) => { let d = ''; const h = 16; for (let i = -20; i < 30; i++) d += `M${130 + i * h * 1.1547} -10l${r1(220 * 0.57735)} 220M${130 + i * h * 1.1547} 210l${r1(220 * 0.57735)} -220`; for (let y = -10; y < 214; y += h) d += `M130 ${y}H420`; return fadeIn(u, P(d, Z(fg, op, 0.8, 0.4))); };
// museum: a picture frame's moulding, many fine profiles stepping in, mitred at the corners
const rosette = (fg, op, u) => { const x0 = 210, y0 = 30, x1 = 400, y1 = 176; let d = '';
    for (let i = 0; i < 16; i++) { const k = i * 3 + (i > 8 ? 6 : 0); d += `M${x0 + k} ${y0 + k}H${x1 - k}V${y1 - k}H${x0 + k}Z`; }
    return fadeIn(u, P(d, Z(fg, op, 1, 0.5)) + P(`M${x0} ${y0}L${x0 + 51} ${y0 + 51}M${x1} ${y0}L${x1 - 51} ${y0 + 51}M${x0} ${y1}L${x0 + 51} ${y1 - 51}M${x1} ${y1}L${x1 - 51} ${y1 - 51}`, Z(fg, op, 1.4, 0.6))); };
// bus: the road ahead as a perspective grid running to the horizon
const route = (fg, op, u) => { const vx = 300, vy = 40, ts = range(1, 14).map(k => vy + (210 - vy) * (k / 13) ** 1.9); return fadeIn(u, P(range(0, 23).map(i => `M${vx} ${vy}L${-140 + i * 40} 214`).join('') + ts.map(y => `M130 ${r1(y)}H420`).join(''), Z(fg, op, 0.8, 0.5)) + P(`M130 ${vy}H420`, Z(fg, op, 1.6, 0.8))); };
// bus: a speedometer, its scale of fine ticks round the dial, the needle
const lanes = (fg, op, u) => { const cx = 316, cy = 130, tk = range(0, 61).map(i => { const a = PI * (0.8 + i * 1.4 / 60), L = i % 10 ? (i % 5 ? 6 : 10) : 16; return `M${M(pt(cx, cy, 92, a))}L${M(pt(cx, cy, 92 - L, a))}`; }).join('');
    return fadeIn(u, `<path d="M${M(pt(cx, cy, 100, PI * 0.8))}A100 100 0 1 1 ${M(pt(cx, cy, 100, PI * 2.2))}" ${Z(fg, op, 1.3, 0.8)}/>` + P(tk, Z(fg, op, 1.4, 0.7)) + P(`M${cx} ${cy}L${M(pt(cx, cy, 78, PI * 1.62))}`, Z(fg, op, 2, 1.4)) + `<circle cx="${cx}" cy="${cy}" r="5" ${Z(fg, op, 2, 0.8)}/>`); };
// ferry: the sea as a surface in wire, rows of swell coming toward you
const waves = (fg, op, u) => fadeIn(u, range(0, 22).map(r => { const z = 1 + r * 0.22, y0 = 20 + 190 * (1 - 1 / z) * 1.25; return `<path d="M${range(0, 51).map(i => { const x = 130 + i * 6; return `${x} ${r1(y0 + (7 / z) * sin(x * 0.05 / z * 2 + r * 0.7) + (3 / z) * sin(x * 0.13 + r))}`; }).join('L')}" ${Z(fg, op, 1.2 - r * 0.03, 0.5)}/>`; }).join(''));
// ferry: a compass rose to scale, degree ring, the eight points in fine outline
const depths = (fg, op, u) => { const cx = 306, cy = 100; const tk = range(0, 72).map(i => { const a = i * PI / 36, L = i % 9 ? 4 : 10; return `M${M(pt(cx, cy, 92, a))}L${M(pt(cx, cy, 92 - L, a))}`; }).join('');
    const star = range(0, 8).map(i => { const a = i * PI / 4 - PI / 2, L = i % 2 ? 46 : 78; return `M${cx} ${cy}L${M(pt(cx, cy, 9, a - PI / 8))}L${M(pt(cx, cy, L, a))}L${M(pt(cx, cy, 9, a + PI / 8))}Z`; }).join('');
    return fadeIn(u, [96, 92, 70].map(r => `<circle cx="${cx}" cy="${cy}" r="${r}" ${Z(fg, op, 1.1, 0.6)}/>`).join('') + P(tk, Z(fg, op, 1.2, 0.5)) + P(star, Z(fg, op, 1.3, 0.6)) + P(range(0, 8).map(i => { const a = i * PI / 4 - PI / 2; return `M${cx} ${cy}L${M(pt(cx, cy, i % 2 ? 46 : 78, a))}`; }).join(''), Z(fg, op, 0.8, 0.4))); };
// theater: velvet, vertical folds shaded light to dark across each one
const arches = (fg, op, u) => fadeIn(u, `<defs><linearGradient id="${u}v" x1="0" x2="1"><stop offset="0" stop-color="${fg}" stop-opacity="0"/><stop offset=".45" stop-color="${fg}" stop-opacity="${r1(op * 0.9 * 100) / 100}"/><stop offset="1" stop-color="${fg}" stop-opacity="0"/></linearGradient></defs>` + range(0, 12).map(i => `<path d="M${150 + i * 22} -10C${156 + i * 22} 60 ${144 + i * 22} 140 ${152 + i * 22.5} 214H${174 + i * 22.5}C${166 + i * 22} 140 ${178 + i * 22} 60 ${172 + i * 22} -10Z" fill="url(#${u}v)"/>`).join(''));
// theater: the horseshoe of the house, tiers in fine curves, the seats as points along them
const diamonds = (fg, op, u) => { let d = '', dots = ''; for (let i = 0; i < 9; i++) { const y = 30 + i * 18, rx = 170 - i * 8; d += `M${300 - rx} ${y}Q300 ${y + 60} ${300 + rx} ${y}`; for (let j = 0; j <= 24; j++) { const t = j / 24, x = (1 - t) ** 2 * (300 - rx) + 2 * (1 - t) * t * 300 + t * t * (300 + rx), yy = (1 - t) ** 2 * y + 2 * (1 - t) * t * (y + 60) + t * t * y; dots += `<circle cx="${r1(x)}" cy="${r1(yy + 5)}" r="0.9" ${F(fg, op * 2)}/>`; } }
    return fadeIn(u, P(d, Z(fg, op, 1.1, 0.6)) + dots); };
// theme park: a coaster's vertical loop, the track coming in low, round and out, two rails and the ties
const wheel = (fg, op, u) => { const cx = 300, cy = 110, R = 66, pts = [];
    for (let i = 0; i <= 30; i++) pts.push([130 + i * (cx - 130) / 30, cy + R]);
    for (let i = 1; i <= 90; i++) { const t = i / 90 * PI * 2; pts.push([cx + R * sin(t) + 22 * i / 90, cy + R * cos(t)]); }
    for (let i = 1; i <= 20; i++) pts.push([cx + 22 + i * 5, cy + R]);
    const nrm = i => { const p = pts[Math.max(0, i - 1)], n = pts[Math.min(pts.length - 1, i + 1)], dx = n[0] - p[0], dy = n[1] - p[1], L = Math.hypot(dx, dy) || 1; return [-dy / L, dx / L]; };
    const rail = d => `M${pts.map(([x, y], i) => { const [nx, ny] = nrm(i); return `${r1(x + nx * d)} ${r1(y + ny * d)}`; }).join('L')}`;
    const ties = pts.filter((_, i) => i % 2 === 0).map(([x, y], j) => { const [nx, ny] = nrm(j * 2); return `M${r1(x - nx * 5)} ${r1(y - ny * 5)}L${r1(x + nx * 5)} ${r1(y + ny * 5)}`; }).join('');
    return fadeIn(u, P(rail(-5) + rail(5), Z(fg, op, 1.5, 0.8)) + P(ties, Z(fg, op, 0.9, 0.5)) + P(`M${cx - 30} 214L${cx} ${cy + R + 5}L${cx + 30} 214M${cx + 52} 214V${cy + R + 5}`, Z(fg, op, 1, 0.6))); };
// theme park: a carousel canopy from below, fine radial stripes, the scalloped rim lit with points
const coaster = (fg, op, u) => { const cx = 300, cy = 10, R = 150; let d = '', lights = '';
    for (let i = 0; i <= 36; i++) d += `M${cx} ${cy}L${M(pt(cx, cy, R, i * PI / 36))}`;
    let rim = `M${M(pt(cx, cy, R, 0))}`; for (let i = 0; i < 18; i++) { const a = (i + 1) * PI / 18, m = (i + 0.5) * PI / 18; rim += `Q${M(pt(cx, cy, R + 14, m))} ${M(pt(cx, cy, R, a))}`; const [x, y] = pt(cx, cy, R + 8, m); lights += `<circle cx="${x}" cy="${y}" r="1.6" ${F(fg, op * 2.6)}/>`; }
    return fadeIn(u, P(d, Z(fg, op, 0.8, 0.5)) + P(rim, Z(fg, op, 1.4, 0.8)) + [40, 80, 120].map(r => `<path d="M${M(pt(cx, cy, r, 0))}A${r} ${r} 0 0 1 ${M(pt(cx, cy, r, PI))}" ${Z(fg, op, 0.7, 0.5)}/>`).join('') + lights); };
const MOTIF = { flight: [flight, null], train: [train, null], membership: [dots, holo], other: [dots], concert: [rings, spots], hotel: [windows, doors], match: [pitch, bowl],
    movie: [beam, premiere], museum: [columns, rosette], bus: [route, lanes], ferry: [waves, depths], theater: [arches, diamonds], park: [wheel, coaster] };
const seedOf = id => [...String(id || '')].reduce((h, c) => h + c.charCodeAt(0), 0);
export function passMotif(k, fg, op, id) {
    const xs = MOTIF[k] || MOTIF.other, f = xs[seedOf(id) % xs.length];
    return f ? f(fg, op, `pa${String(id || '').replace(/[^\w-]/g, '')}`) : null;
}
