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
// train: a rail yard from above, pairs of rails with their sleepers, running on the diagonal
const train = (fg, op, u) => { let rails = '', ties = ''; const ang = -0.42, ux = cos(ang), uy = sin(ang), nx = -uy, ny = ux;
    for (let j = -12; j < 2; j++) { const ox = 150 + j * 26 * nx, oy = 260 + j * 26 * ny, L = 520;
        for (const d of [-5, 5]) rails += `M${r1(ox + nx * d)} ${r1(oy + ny * d)}l${r1(ux * L)} ${r1(uy * L)}`;
        for (let t = 0; t < L; t += 7) ties += `M${r1(ox + ux * t - nx * 8)} ${r1(oy + uy * t - ny * 8)}l${r1(nx * 16)} ${r1(ny * 16)}`; }
    return fadeIn(u, P(ties, Z(fg, op, 0.55, 0.5)) + P(rails, Z(fg, op, 1.3, 0.7))); };
// concert: a sound field, a fine mesh lifted by the wave from the stage
const rings = (fg, op, u) => { const h = (x, z) => 26 * Math.exp(-((x - 300) ** 2 + (z - 4) ** 2 * 900) / 9000) * cos(Math.hypot(x - 300, (z - 4) * 30) / 9);
    const pr = (x, z) => { const k = 1 / (1 + z * 0.12); return [r1(300 + (x - 300) * k), r1(40 + 150 * (1 - k) * 2.2 - h(x, z) * k)]; };
    let d = ''; for (let z = 0; z <= 12; z += 0.5) d += `M${range(0, 41).map(i => pr(150 + i * 7, z).join(' ')).join('L')}`;
    for (let i = 0; i <= 40; i += 2) d += `M${range(0, 25).map(j => pr(150 + i * 7, j * 0.5).join(' ')).join('L')}`;
    return fadeIn(u, P(d, Z(fg, op, 0.9, 0.45))); };
// concert: a sound ribbon, many sine lines in shifted phase twisting into one band
const spots = (fg, op, u) => fadeIn(u, range(0, 26).map(j => { const ph = j * 0.12; return `<path d="M${range(0, 61).map(i => { const x = 130 + i * 5, t = i / 60; return `${r1(x)} ${r1(100 + (42 * sin(t * PI * 2.2 + ph) + 10 * cos(t * PI * 5 + ph * 2)) * sin(t * PI))}`; }).join('L')}" ${Z(fg, op, 1, 0.5)}/>`; }).join(''));
// hotel: a tufted headboard, quilted lines with a button at each crossing
const windows = (fg, op, u) => { let d = '', dots = ''; for (let i = -8; i < 14; i++) d += `M${150 + i * 22} -10l120 220M${150 + i * 22} 210l120 -220`;
    for (let r = 0; r < 12; r++) for (let c = 0; c < 14; c++) { const x = 150 + c * 22 + (r % 2 ? 11 : 0), y = -10 + r * 20.2; dots += `<circle cx="${r1(x)}" cy="${r1(y)}" r="1.3" ${F(fg, op * 1.8)}/>`; }
    return fadeIn(u, P(d, Z(fg, op, 1, 0.5)) + dots); };
// hotel: satin, fine pinstripes under one soft sheen
const doors = (fg, op, u) => fadeIn(u, `<defs><linearGradient id="${u}s" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="${fg}" stop-opacity="0"/><stop offset=".55" stop-color="${fg}" stop-opacity="${r1(op * 0.7 * 100) / 100}"/><stop offset=".8" stop-color="${fg}" stop-opacity="0"/></linearGradient></defs><rect x="0" y="-10" width="400" height="220" fill="url(#${u}s)"/>` + P(range(0, 60).map(i => `M${130 + i * 4.5} -10V210`).join(''), Z(fg, op, 0.55, 0.4)));
// match: the goal net, a fine square mesh hanging in a soft sag
const pitch = (fg, op, u) => { const sag = (x, y) => y + 14 * sin(PI * (x - 150) / 270) * (y / 210); let d = '';
    for (let y = -10; y <= 214; y += 9) d += `M${range(0, 31).map(i => { const x = 150 + i * 9; return `${x} ${r1(sag(x, y))}`; }).join('L')}`;
    for (let x = 150; x <= 420; x += 9) d += `M${range(0, 26).map(j => { const y = -10 + j * 9; return `${r1(x + 3 * sin(y / 30))} ${r1(sag(x, y))}`; }).join('L')}`;
    return fadeIn(u, P(d, Z(fg, op, 0.8, 0.45))); };
// match: the pitch seen from the stand, mown stripes in perspective with their fine edges
const bowl = (fg, op, u) => { const vx = 300, vy = -60, x = (x0, y) => r1(vx + (x0 - vx) * (y - vy) / (210 - vy)); let st = '', ln = '';
    for (let i = 0; i < 16; i++) { const a = 60 + i * 30, b = a + 30, y0 = 20; ln += `M${x(a, y0)} ${y0}L${a} 210`; if (i % 2) st += `M${x(a, y0)} ${y0}L${a} 210H${b}L${x(b, y0)} ${y0}Z`; }
    return fadeIn(u, P(st, F(fg, 0.04)) + P(ln, Z(fg, op, 0.8, 0.5)) + P(`M${x(60, 20)} 20H${x(540, 20)}M${x(60, 90)} 90H${x(540, 90)}`, Z(fg, op, 1.3, 0.8)) + `<ellipse cx="${vx}" cy="90" rx="${r1((x(540, 90) - x(60, 90)) * 0.09)}" ry="9" ${Z(fg, op, 1.3, 0.8)}/>`); };
// movie: the screen's surface, fine scanlines under a soft sheen from the projector
const beam = (fg, op, u) => fadeIn(u, `<defs><radialGradient id="${u}g" cx=".7" cy=".3" r=".7"><stop offset="0" stop-color="${fg}" stop-opacity="${r1(op * 0.9 * 100) / 100}"/><stop offset="1" stop-color="${fg}" stop-opacity="0"/></radialGradient></defs><rect x="0" y="-10" width="400" height="230" fill="url(#${u}g)"/>` + P(range(0, 75).map(i => `M130 ${r1(-10 + i * 3)}H420`).join(''), Z(fg, op, 0.45, 0.35)));
// movie: a strip of film twisting through the air, its frames and sprocket holes following the turn
const premiere = (fg, op, u) => { const c = t => [150 + t * 290, 150 - 90 * t + 30 * sin(t * PI * 2)], w = t => 34 * cos(t * PI * 1.3 + 0.4);
    let edges = '', frames = '', holes = ''; const e = s => `M${range(0, 61).map(i => { const t = i / 60, [x, y] = c(t), ww = w(t) * s; return `${r1(x + ww * 0.35)} ${r1(y + ww)}`; }).join('L')}`;
    edges = e(1) + e(-1) + e(0.72) + e(-0.72);
    for (let i = 0; i <= 30; i++) { const t = i / 30, [x, y] = c(t), ww = w(t); frames += `M${r1(x + ww * 0.25)} ${r1(y + ww * 0.72)}L${r1(x - ww * 0.25)} ${r1(y - ww * 0.72)}`; for (const s of [0.86, -0.86]) holes += `M${r1(x + ww * s * 0.35 - 1.2)} ${r1(y + ww * s)}h2.4`; }
    return fadeIn(u, P(edges, Z(fg, op, 1.2, 0.6)) + P(frames, Z(fg, op, 0.7, 0.45)) + P(holes, Z(fg, op, 1.8, 1.4))); };
// museum: an isometric lattice, the floor of a gallery drawn in fine triangles
const columns = (fg, op, u) => { let d = ''; const h = 16; for (let i = -20; i < 30; i++) d += `M${130 + i * h * 1.1547} -10l${r1(220 * 0.57735)} 220M${130 + i * h * 1.1547} 210l${r1(220 * 0.57735)} -220`; for (let y = -10; y < 214; y += h) d += `M130 ${y}H420`; return fadeIn(u, P(d, Z(fg, op, 0.8, 0.4))); };
// museum: marble, veins branching in fine lines of a few weights
const rosette = (fg, op, u) => { const vein = (x, y, a, n, w, k) => { let d = `M${x} ${y}`; for (let i = 0; i < n; i++) { a += sin(i * 1.7 + x) * 0.35; x += 9 * cos(a); y += 9 * sin(a); d += `L${r1(x)} ${r1(y)}`; } return P(d, Z(fg, op, k, w)); };
    return fadeIn(u, vein(160, 200, -0.7, 40, 1.2, 1.6) + vein(240, 214, -1.1, 30, 0.7, 1.2) + vein(200, 150, -0.2, 30, 0.5, 0.9) + vein(300, 120, -1.4, 18, 0.5, 0.9) + vein(260, 200, -0.4, 22, 0.4, 0.7) + vein(330, 214, -1.8, 26, 0.9, 1.3) + vein(210, 90, -0.6, 26, 0.4, 0.6)); };
// bus: the road ahead as a perspective grid running to the horizon
const route = (fg, op, u) => { const vx = 300, vy = 40, ts = range(1, 14).map(k => vy + (210 - vy) * (k / 13) ** 1.9); return fadeIn(u, P(range(0, 23).map(i => `M${vx} ${vy}L${-140 + i * 40} 214`).join('') + ts.map(y => `M130 ${r1(y)}H420`).join(''), Z(fg, op, 0.8, 0.5)) + P(`M130 ${vy}H420`, Z(fg, op, 1.6, 0.8))); };
// bus: a motorway flyover from above, lanes sweeping round in parallel curves, the dashes between them
const lanes = (fg, op, u) => { const lane = k => `M130 ${190 - k * 9}C250 ${190 - k * 9} ${300 - k * 4} ${150 - k * 6} ${330 - k * 6} ${80 - k * 3}S${380 - k * 6} -10 ${420} ${-20 + k * 6}`;
    return fadeIn(u, range(0, 12).map(k => P(lane(k), Z(fg, op, k % 4 === 0 ? 1.5 : 0.7, k % 4 === 0 ? 0.8 : 0.5) + (k % 4 === 2 ? ' stroke-dasharray="6 6"' : ''))).join('')); };
// ferry: the deck, planks running away with their seams and the grain in each
const waves = (fg, op, u) => { const vx = 300, vy = -260, X = (x, y) => r1(vx + (x - vx) * (y - vy) / (214 - vy)); let d = '', grain = '';
    for (let i = 0; i < 20; i++) { const x0 = 110 + i * 18; d += `M${X(x0, 0)} 0L${x0} 214`; for (let g = 0; g < 3; g++) { const xg = x0 + 8 + g * 7; grain += `M${X(xg, 20 + g * 30)} ${20 + g * 30}L${X(xg + 2, 120 + g * 30)} ${120 + g * 30}`; } }
    for (let i = 0; i < 20; i++) { const x0 = 110 + i * 18, y = [24, 70, 118, 166][i % 4] + (i % 2) * 22; d += `M${X(x0, y)} ${y}L${X(x0 + 18, y)} ${y}`; }
    return fadeIn(u, P(d, Z(fg, op, 1.2, 0.6)) + P(grain, Z(fg, op, 0.5, 0.4))); };
// ferry: water seen from above, swell drawn as many fine lines that ride over one another
const depths = (fg, op, u) => fadeIn(u, range(0, 34).map(r => { const y0 = -10 + r * 7; return `<path d="M${range(0, 55).map(i => { const x = 130 + i * 5; return `${x} ${r1(y0 + 5 * sin(x * 0.035 + r * 0.45) + 3 * sin(x * 0.09 - r * 0.3))}`; }).join('L')}" ${Z(fg, op, r % 5 === 0 ? 1.2 : 0.6, 0.45)}/>`; }).join(''));
// theater: brocade, an ogee lattice in fine double lines with a point at each joint
const arches = (fg, op, u) => { let d = '', dots = ''; const w = 34, h = 44;
    for (let r = -1; r < 6; r++) for (let c = 0; c < 9; c++) { const x = 140 + c * w + (r % 2 ? w / 2 : 0), y = r * h;
        for (const k of [0, 3]) d += `M${x} ${y + k}C${x + w * 0.5} ${y + h * 0.25 + k} ${x - w * 0.5 + w} ${y + h * 0.75 - k} ${x + w / 2} ${y + h - k}C${x - w * 0.5 + w / 2} ${y + h * 0.75 - k} ${x - w * 0.5} ${y + h * 0.25 + k} ${x} ${y + k}`;
        dots += `<circle cx="${x}" cy="${y}" r="1.4" ${F(fg, op * 2)}/>`; }
    return fadeIn(u, P(d, Z(fg, op, 0.9, 0.45)) + dots); };
// theater: a festoon curtain, rows of swags gathered up, fine folds falling in each
const diamonds = (fg, op, u) => { let d = '', f = ''; const w = 46;
    for (let r = 0; r < 6; r++) { const y = -10 + r * 38; for (let c = 0; c < 7; c++) { const x = 140 + c * w; d += `M${x} ${y}Q${x + w / 2} ${y + 30} ${x + w} ${y}`; for (let j = 1; j < 6; j++) { const t = j / 6; f += `M${r1(x + w * t)} ${r1(y + 30 * 2 * t * (1 - t))}L${r1(x + w * (0.5 + (t - 0.5) * 0.7))} ${r1(y + 38)}`; } } }
    return fadeIn(u, P(d, Z(fg, op, 1.3, 0.7)) + P(f, Z(fg, op, 0.6, 0.4))); };
// theme park: a swirl, many fine lines turning out from one point like a spinning ride
const wheel = (fg, op, u) => { const cx = 320, cy = 96; return fadeIn(u, range(0, 36).map(j => { const a0 = j * PI / 18; return `<path d="M${range(0, 41).map(i => { const t = i / 40, r = 6 + t * 190, a = a0 + t * 2.6; return M(pt(cx, cy, r, a)); }).join('L')}" ${Z(fg, op, 0.7, 0.45)}/>`; }).join('')); };
// theme park: the coaster's support lattice, a truss of crossing members going away
const coaster = (fg, op, u) => { const vx = 520, vy = 60, X = (x, t) => r1(vx + (x - vx) * t), Y = (y, t) => r1(vy + (y - vy) * t); let d = '';
    const ts = range(0, 14).map(k => 1 / (1 + 0.18 * k));
    ts.forEach((t, i) => { d += `M${X(160, t)} ${Y(214, t)}V${Y(20, t)}`; if (i < ts.length - 1) { const t2 = ts[i + 1]; for (const [y0, y1] of [[214, 150], [150, 86], [86, 20]]) d += `M${X(160, t)} ${Y(y0, t)}L${X(160, t2)} ${Y(y1, t2)}M${X(160, t)} ${Y(y1, t)}L${X(160, t2)} ${Y(y0, t2)}`; for (const y of [214, 150, 86, 20]) d += `M${X(160, t)} ${Y(y, t)}L${X(160, t2)} ${Y(y, t2)}`; } });
    return fadeIn(u, P(d, Z(fg, op, 0.9, 0.5))); };
const MOTIF = { flight: [flight, null], train: [train, null], membership: [dots, holo], other: [dots], concert: [rings, spots], hotel: [windows, doors], match: [pitch, bowl],
    movie: [beam, premiere], museum: [columns, rosette], bus: [route, lanes], ferry: [waves, depths], theater: [arches, diamonds], park: [wheel, coaster] };
const seedOf = id => [...String(id || '')].reduce((h, c) => h + c.charCodeAt(0), 0);
export function passMotif(k, fg, op, id) {
    const xs = MOTIF[k] || MOTIF.other, f = xs[seedOf(id) % xs.length];
    return f ? f(fg, op, `pa${String(id || '').replace(/[^\w-]/g, '')}`) : null;
}
