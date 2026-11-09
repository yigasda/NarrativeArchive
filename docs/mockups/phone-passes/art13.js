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
// train: the winged wheel of the railways, spoked wheel between two swept wings of five feathers each
const train = (fg, op, u) => { const cx = 286, cy = 100;
    let d = disc(cx, cy, 30) + disc(cx, cy, 24) + disc(cx, cy, 7) + disc(cx, cy, 3);
    for (let i = 0; i < 10; i++) { const a = i * PI / 5; d += bar(...pt(cx, cy, 6, a), ...pt(cx, cy, 25, a), 2.6); }
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) { const bx = cx + s * 27, by = cy - 16 + k * 7, tx = cx + s * (104 - k * 13), ty = cy - 38 + k * 9, mx = (bx + tx) / 2;
        d += `M${bx} ${r1(by - 2.6)}Q${r1(mx)} ${r1(ty - 8)} ${r1(tx)} ${r1(ty)}Q${r1(mx + s * 6)} ${r1(ty + 6)} ${bx} ${r1(by + 2.6)}Z`; }
    return emb(u, fg, `<path d="${d}"/>`); };
// concert: a studio microphone, the capsule with its grille, the yoke, the stand and its base
const rings = (fg, op, u) => { const cx = 290; let g = `M${cx - 26} 46a26 26 0 0 1 52 0V96a26 26 0 0 1 -52 0Z`;
    for (let i = 0; i < 7; i++) g += `M${cx - 17} ${40 + i * 9}h34v3.2h-34Z`;
    return emb(u, fg, `<path d="${g}"/><path d="M${cx - 36} 82v14a36 36 0 0 0 72 0v-14" fill="none" stroke="#000" stroke-width="4"/><path d="M${cx - 2} 132h4v34h-4ZM${cx - 30} 166h60a4 4 0 0 1 0 8h-60a4 4 0 0 1 0 -8Z"/>`); };
// concert: a sound ribbon, many sine lines in shifted phase twisting into one band
const spots = (fg, op, u) => fadeIn(u, range(0, 26).map(j => { const ph = j * 0.12; return `<path d="M${range(0, 61).map(i => { const x = 130 + i * 5, t = i / 60; return `${r1(x)} ${r1(100 + (42 * sin(t * PI * 2.2 + ph) + 10 * cos(t * PI * 5 + ph * 2)) * sin(t * PI))}`; }).join('L')}" ${Z(fg, op, 1, 0.5)}/>`; }).join(''));
// hotel: a tufted headboard, quilted lines with a button at each crossing
const windows = (fg, op, u) => { let d = '', dots = ''; for (let i = -8; i < 14; i++) d += `M${150 + i * 22} -10l120 220M${150 + i * 22} 210l120 -220`;
    for (let r = 0; r < 12; r++) for (let c = 0; c < 14; c++) { const x = 150 + c * 22 + (r % 2 ? 11 : 0), y = -10 + r * 20.2; dots += `<circle cx="${r1(x)}" cy="${r1(y)}" r="1.3" ${F(fg, op * 1.8)}/>`; }
    return fadeIn(u, P(d, Z(fg, op, 1, 0.5)) + dots); };
// hotel: satin, fine pinstripes under one soft sheen
const doors = (fg, op, u) => fadeIn(u, `<defs><linearGradient id="${u}s" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="${fg}" stop-opacity="0"/><stop offset=".55" stop-color="${fg}" stop-opacity="${r1(op * 0.7 * 100) / 100}"/><stop offset=".8" stop-color="${fg}" stop-opacity="0"/></linearGradient></defs><rect x="0" y="-10" width="400" height="220" fill="url(#${u}s)"/>` + P(range(0, 60).map(i => `M${130 + i * 4.5} -10V210`).join(''), Z(fg, op, 0.55, 0.4)));
// match: a club crest, shield with an inner border, a star over a chevron, three small stars above
const pitch = (fg, op, u) => { const sh = (x0, x1, y0, y1) => { const m = (x0 + x1) / 2; return `M${x0} ${y0}H${x1}V${y1 - 40}C${x1} ${y1 - 12} ${m + 16} ${y1 - 4} ${m} ${y1}C${m - 16} ${y1 - 4} ${x0} ${y1 - 12} ${x0} ${y1 - 40}Z`; };
    const d = sh(244, 336, 44, 172) + sh(252, 328, 52, 162) + star(290, 92, 20, 8) + `M262 132L290 116L318 132V140L290 124L262 140Z` + star(266, 32, 6, 2.4) + star(290, 28, 7, 2.8) + star(314, 32, 6, 2.4);
    return emb(u, fg, `<path d="${d}"/>`); };
// match: the pitch seen from the stand, mown stripes in perspective with their fine edges
const bowl = (fg, op, u) => { const vx = 300, vy = -60, x = (x0, y) => r1(vx + (x0 - vx) * (y - vy) / (210 - vy)); let st = '', ln = '';
    for (let i = 0; i < 16; i++) { const a = 60 + i * 30, b = a + 30, y0 = 20; ln += `M${x(a, y0)} ${y0}L${a} 210`; if (i % 2) st += `M${x(a, y0)} ${y0}L${a} 210H${b}L${x(b, y0)} ${y0}Z`; }
    return fadeIn(u, P(st, F(fg, 0.04)) + P(ln, Z(fg, op, 0.8, 0.5)) + P(`M${x(60, 20)} 20H${x(540, 20)}M${x(60, 90)} 90H${x(540, 90)}`, Z(fg, op, 1.3, 0.8)) + `<ellipse cx="${vx}" cy="90" rx="${r1((x(540, 90) - x(60, 90)) * 0.09)}" ry="9" ${Z(fg, op, 1.3, 0.8)}/>`); };
// movie: a film reel, six windows round the hub, the strip running off it with its sprocket holes
const beam = (fg, op, u) => { const cx = 282, cy = 90; let d = disc(cx, cy, 56) + disc(cx, cy, 9) + disc(cx, cy, 4);
    for (let i = 0; i < 6; i++) { const [x, y] = pt(cx, cy, 32, i * PI / 3 + PI / 6); d += disc(x, y, 14); }
    let s = `M${cx} ${cy + 56}H360V${cy + 78}H${cx}Z`; for (let i = 0; i < 8; i++) s += `M${cx + 6 + i * 10} ${cy + 59}h5v4h-5ZM${cx + 6 + i * 10} ${cy + 71}h5v4h-5Z`;
    return emb(u, fg, `<path d="${d}"/><path d="${s}"/>`); };
// movie: the festival laurel, two branches of paired leaves closing round a star
const premiere = (fg, op, u) => { const cx = 290, cy = 100, R = 54; let d = star(cx, cy, 18, 7.5);
    for (const s of [-1, 1]) { d += `M${M(pt(cx, cy, R - 1.2, PI / 2 + s * 0.28))}A${R - 1.2} ${R - 1.2} 0 0 ${s < 0 ? 1 : 0} ${M(pt(cx, cy, R - 1.2, PI / 2 + s * 2.35))}L${M(pt(cx, cy, R + 1.2, PI / 2 + s * 2.35))}A${R + 1.2} ${R + 1.2} 0 0 ${s < 0 ? 0 : 1} ${M(pt(cx, cy, R + 1.2, PI / 2 + s * 0.28))}Z`;
        for (let k = 0; k < 9; k++) { const a = PI / 2 + s * (0.42 + k * 0.23), [x, y] = pt(cx, cy, R, a), tg = a + s * PI / 2, sz = 11 - k * 0.5;
            for (const side of [-1, 1]) { const dir = tg + side * 0.55, [ex, ey] = [x + cos(dir) * sz * 2, y + sin(dir) * sz * 2], [mx, my] = [x + cos(dir) * sz, y + sin(dir) * sz], nx = -sin(dir) * sz * 0.38, ny = cos(dir) * sz * 0.38;
                d += `M${r1(x)} ${r1(y)}Q${r1(mx + nx)} ${r1(my + ny)} ${r1(ex)} ${r1(ey)}Q${r1(mx - nx)} ${r1(my - ny)} ${r1(x)} ${r1(y)}Z`; } } }
    return emb(u, fg, `<path d="${d}"/>`); };
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
// ferry: a ship's wheel, the rim, eight spokes running through to turned handles, the hub
const waves = (fg, op, u) => { const cx = 290, cy = 100; let d = disc(cx, cy, 48) + disc(cx, cy, 40) + disc(cx, cy, 12) + disc(cx, cy, 5);
    for (let i = 0; i < 8; i++) { const a = i * PI / 4; d += bar(...pt(cx, cy, 11, a), ...pt(cx, cy, 41, a), 4) + bar(...pt(cx, cy, 47, a), ...pt(cx, cy, 58, a), 4.5);
        const [x, y] = pt(cx, cy, 66, a); d += `M${M(pt(cx, cy, 58, a + 0.1))}L${M(pt(cx, cy, 58, a - 0.1))}L${M(pt(x, y, 4.5, a - PI / 2))}A4.5 4.5 0 0 1 ${M(pt(x, y, 4.5, a + PI / 2))}Z`; }
    return emb(u, fg, `<path d="${d}"/>`); };
// ferry: water seen from above, swell drawn as many fine lines that ride over one another
const depths = (fg, op, u) => fadeIn(u, range(0, 34).map(r => { const y0 = -10 + r * 7; return `<path d="M${range(0, 55).map(i => { const x = 130 + i * 5; return `${x} ${r1(y0 + 5 * sin(x * 0.035 + r * 0.45) + 3 * sin(x * 0.09 - r * 0.3))}`; }).join('L')}" ${Z(fg, op, r % 5 === 0 ? 1.2 : 0.6, 0.45)}/>`; }).join(''));
// theater: a lyre, two curving arms, the crossbar, five strings and the base
const arches = (fg, op, u) => { const cx = 290; let arms = '';
    for (const s of [-1, 1]) arms += `M${cx + s * 10} 160C${cx + s * 40} 154 ${cx + s * 46} 116 ${cx + s * 34} 92C${cx + s * 26} 76 ${cx + s * 30} 56 ${cx + s * 44} 46`;
    const strings = range(0, 5).map(i => `M${cx - 12 + i * 6} 72V156`).join('');
    return emb(u, fg, `<path d="${arms}" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round"/><path d="M${cx - 44} 66h88v6h-88Z"/><path d="${strings}" fill="none" stroke="#000" stroke-width="1.4"/><path d="M${cx - 26} 156h52a5 5 0 0 1 0 10h-52a5 5 0 0 1 0 -10Z"/>`
        + `<path d="${disc(cx - 44, 44, 5) + disc(cx + 44, 44, 5)}"/>`); };
// theater: the proscenium, an arch on two fluted pilasters with a keystone, over the stage step
const diamonds = (fg, op, u) => { const cx = 282, w = 42, top = 100;
    let d = `M${cx - w - 10} 168V${top}A${w + 10} ${w + 10} 0 0 1 ${cx + w + 10} ${top}V168H${cx + w}V${top}A${w} ${w} 0 0 0 ${cx - w} ${top}V168Z` + `M${cx - 8} ${top - w - 12}h16l-3 16h-10Z`;
    for (const s of [-1, 1]) { const x = cx + s * (w + 5); d += `M${x - 9} 168h18v4h-18Z`; for (let i = 0; i < 3; i++) d += `M${x - 5 + i * 4} ${top + 6}h1.6v${158 - top}h-1.6Z`; }
    return emb(u, fg, `<path d="${d}"/><path d="M${cx - w - 22} 174h${2 * w + 44}v6h-${2 * w + 44}Z"/>`); };
// theme park: a swirl, many fine lines turning out from one point like a spinning ride
const wheel = (fg, op, u) => { const cx = 320, cy = 96; return fadeIn(u, range(0, 36).map(j => { const a0 = j * PI / 18; return `<path d="M${range(0, 41).map(i => { const t = i / 40, r = 6 + t * 190, a = a0 + t * 2.6; return M(pt(cx, cy, r, a)); }).join('L')}" ${Z(fg, op, 0.7, 0.45)}/>`; }).join('')); };
// theme park: a scalloped seal, a ring inside and a star at its heart, like the stamp on a day pass
const coaster = (fg, op, u) => { const cx = 290, cy = 100; let o = '';
    for (let i = 0; i < 28; i++) { const a = i * PI / 14, b = (i + 1) * PI / 14; o += `${i ? '' : `M${M(pt(cx, cy, 60, a))}`}Q${M(pt(cx, cy, 68, (a + b) / 2))} ${M(pt(cx, cy, 60, b))}`; }
    return emb(u, fg, `<path d="${o}Z${disc(cx, cy, 50)}${disc(cx, cy, 46)}${star(cx, cy, 30, 12)}"/>`); };
// ---- embossed emblems: one carefully built mark per kind, pressed into the card (a lit edge, a shadowed edge, a faint face)
const emb = (u, fg, inner) => `<defs><filter id="${u}x" x="-20%" y="-20%" width="140%" height="140%"><feFlood flood-color="${fg}" flood-opacity=".06"/><feComposite in2="SourceAlpha" operator="in" result="F"/>`
    + `<feOffset in="SourceAlpha" dx=".9" dy=".9" result="a"/><feComposite in="SourceAlpha" in2="a" operator="out" result="ha"/><feFlood flood-color="#fff" flood-opacity=".3"/><feComposite in2="ha" operator="in" result="H"/>`
    + `<feOffset in="SourceAlpha" dx="-.9" dy="-.9" result="b"/><feComposite in="SourceAlpha" in2="b" operator="out" result="sa"/><feFlood flood-color="#000" flood-opacity=".34"/><feComposite in2="sa" operator="in" result="L"/>`
    + `<feMerge><feMergeNode in="F"/><feMergeNode in="H"/><feMergeNode in="L"/></feMerge></filter></defs><g filter="url(#${u}x)" fill="#000" fill-rule="evenodd">${inner}</g>`;
const disc = (cx, cy, r) => `M${r1(cx - r)} ${cy}a${r} ${r} 0 1 0 ${r1(2 * r)} 0a${r} ${r} 0 1 0 ${r1(-2 * r)} 0Z`;
const star = (cx, cy, R, r, n = 5, rot = -PI / 2) => `M${range(0, n * 2).map(i => M(pt(cx, cy, i % 2 ? r : R, rot + i * PI / n))).join('L')}Z`;
const bar = (x0, y0, x1, y1, w) => { const dx = x1 - x0, dy = y1 - y0, Ln = Math.hypot(dx, dy), nx = -dy / Ln * w / 2, ny = dx / Ln * w / 2; return `M${r1(x0 + nx)} ${r1(y0 + ny)}L${r1(x1 + nx)} ${r1(y1 + ny)}L${r1(x1 - nx)} ${r1(y1 - ny)}L${r1(x0 - nx)} ${r1(y0 - ny)}Z`; };
const MOTIF = { flight: [flight, null], train: [train, null], membership: [dots, holo], other: [dots], concert: [rings, spots], hotel: [windows, doors], match: [pitch, bowl],
    movie: [beam, premiere], museum: [columns, rosette], bus: [route, lanes], ferry: [waves, depths], theater: [arches, diamonds], park: [wheel, coaster] };
const seedOf = id => [...String(id || '')].reduce((h, c) => h + c.charCodeAt(0), 0);
export function passMotif(k, fg, op, id) {
    const xs = MOTIF[k] || MOTIF.other, f = xs[seedOf(id) % xs.length];
    return f ? f(fg, op, `pa${String(id || '').replace(/[^\w-]/g, '')}`) : null;
}
