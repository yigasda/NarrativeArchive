// 지갑 표 뒤 무늬(viewBox 340×200, 오른쪽에 붙어요). 소망이 시안 2~13에서 동그라미 친 것만 있어요. 종류마다 하나~셋이고,
// 표 id 글자 합으로 골라요(늘 같은 표는 같은 무늬, 이웃한 id끼리 번갈아요). null은 무늬 없는 모습
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
// concert: a sound ribbon, many sine lines in shifted phase twisting into one band
const spots = (fg, op, u) => fadeIn(u, range(0, 26).map(j => { const ph = j * 0.12; return `<path d="M${range(0, 61).map(i => { const x = 130 + i * 5, t = i / 60; return `${r1(x)} ${r1(100 + (42 * sin(t * PI * 2.2 + ph) + 10 * cos(t * PI * 5 + ph * 2)) * sin(t * PI))}`; }).join('L')}" ${Z(fg, op, 1, 0.5)}/>`; }).join(''));
// hotel: a tufted headboard, quilted lines with a button at each crossing
const windows = (fg, op, u) => { let d = '', dots = ''; for (let i = -8; i < 14; i++) d += `M${150 + i * 22} -10l120 220M${150 + i * 22} 210l120 -220`;
    for (let r = 0; r < 12; r++) for (let c = 0; c < 14; c++) { const x = 150 + c * 22 + (r % 2 ? 11 : 0), y = -10 + r * 20.2; dots += `<circle cx="${r1(x)}" cy="${r1(y)}" r="1.3" ${F(fg, op * 1.8)}/>`; }
    return fadeIn(u, P(d, Z(fg, op, 1, 0.5)) + dots); };
// hotel: satin, fine pinstripes under one soft sheen
const doors = (fg, op, u) => fadeIn(u, `<defs><linearGradient id="${u}s" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="${fg}" stop-opacity="0"/><stop offset=".55" stop-color="${fg}" stop-opacity="${r1(op * 0.7 * 100) / 100}"/><stop offset=".8" stop-color="${fg}" stop-opacity="0"/></linearGradient></defs><rect x="0" y="-10" width="400" height="220" fill="url(#${u}s)"/>` + P(range(0, 60).map(i => `M${130 + i * 4.5} -10V210`).join(''), Z(fg, op, 0.55, 0.4)));
// match: the pitch seen from the stand, mown stripes in perspective with their fine edges
const bowl = (fg, op, u) => { const vx = 300, vy = -60, x = (x0, y) => r1(vx + (x0 - vx) * (y - vy) / (210 - vy)); let st = '', ln = '';
    for (let i = 0; i < 16; i++) { const a = 60 + i * 30, b = a + 30, y0 = 20; ln += `M${x(a, y0)} ${y0}L${a} 210`; if (i % 2) st += `M${x(a, y0)} ${y0}L${a} 210H${b}L${x(b, y0)} ${y0}Z`; }
    return fadeIn(u, P(st, F(fg, 0.04)) + P(ln, Z(fg, op, 0.8, 0.5)) + P(`M${x(60, 20)} 20H${x(540, 20)}M${x(60, 90)} 90H${x(540, 90)}`, Z(fg, op, 1.3, 0.8)) + `<ellipse cx="${vx}" cy="90" rx="${r1((x(540, 90) - x(60, 90)) * 0.09)}" ry="9" ${Z(fg, op, 1.3, 0.8)}/>`); };
// museum: marble, veins branching in fine lines of a few weights
const rosette = (fg, op, u) => { const vein = (x, y, a, n, w, k) => { let d = `M${x} ${y}`; for (let i = 0; i < n; i++) { a += sin(i * 1.7 + x) * 0.35; x += 9 * cos(a); y += 9 * sin(a); d += `L${r1(x)} ${r1(y)}`; } return P(d, Z(fg, op, k, w)); };
    return fadeIn(u, vein(160, 200, -0.7, 40, 1.2, 1.6) + vein(240, 214, -1.1, 30, 0.7, 1.2) + vein(200, 150, -0.2, 30, 0.5, 0.9) + vein(300, 120, -1.4, 18, 0.5, 0.9) + vein(260, 200, -0.4, 22, 0.4, 0.7) + vein(330, 214, -1.8, 26, 0.9, 1.3) + vein(210, 90, -0.6, 26, 0.4, 0.6)); };
// bus: a motorway flyover from above, lanes sweeping round in parallel curves, the dashes between them
const lanes = (fg, op, u) => { const lane = k => `M130 ${190 - k * 9}C250 ${190 - k * 9} ${300 - k * 4} ${150 - k * 6} ${330 - k * 6} ${80 - k * 3}S${380 - k * 6} -10 ${420} ${-20 + k * 6}`;
    return fadeIn(u, range(0, 12).map(k => P(lane(k), Z(fg, op, k % 4 === 0 ? 1.5 : 0.7, k % 4 === 0 ? 0.8 : 0.5) + (k % 4 === 2 ? ' stroke-dasharray="6 6"' : ''))).join('')); };
// ferry: water seen from above, swell drawn as many fine lines that ride over one another
const depths = (fg, op, u) => fadeIn(u, range(0, 34).map(r => { const y0 = -10 + r * 7; return `<path d="M${range(0, 55).map(i => { const x = 130 + i * 5; return `${x} ${r1(y0 + 5 * sin(x * 0.035 + r * 0.45) + 3 * sin(x * 0.09 - r * 0.3))}`; }).join('L')}" ${Z(fg, op, r % 5 === 0 ? 1.2 : 0.6, 0.45)}/>`; }).join(''));
// theme park: a swirl, many fine lines turning out from one point like a spinning ride
const wheel = (fg, op, u) => { const cx = 320, cy = 96; return fadeIn(u, range(0, 36).map(j => { const a0 = j * PI / 18; return `<path d="M${range(0, 41).map(i => { const t = i / 40, r = 6 + t * 190, a = a0 + t * 2.6; return M(pt(cx, cy, r, a)); }).join('L')}" ${Z(fg, op, 0.7, 0.45)}/>`; }).join('')); };
// theater: a harlequin of tall diamonds, every other one shaded (chosen from mockup 10)
const harlequin = (fg, op) => {
    const w = 20, h = 32; let fill = '';
    for (let r = -1; r < 8; r++) for (let c = 0; c < 14; c++) { if ((r + c) % 2) continue; const x = 150 + c * w + (r % 2 ? w / 2 : 0) - (r % 2 ? 0 : 0), y = r * h / 2; fill += `M${x} ${y}l${w / 2} ${h / 2}l-${w / 2} ${h / 2}l-${w / 2} -${h / 2}Z`; }
    const grid = range(-12, 14).map(i => `M${150 + i * w} -10l${r1(224 * w / h * 0.5 * 2 / 1)} 224M${150 + i * w} 214l${r1(224 * w / h)} -224`).join('');
    return P(fill, F(fg, 0.05)) + P(grid, S(fg, op, 0.6));
};
// museum: a ceiling rosette of lens petals (chosen from mockup 10)
const rosetteP = (fg, op) => {
    const cx = 300, cy = 118, petal = (a, r0, r1_, w) => { const [x0, y0] = pt(cx, cy, r0, a), [x1, y1] = pt(cx, cy, r1_, a), m = (r0 + r1_) / 2, [ax, ay] = pt(cx, cy, m, a - w), [bx, by] = pt(cx, cy, m, a + w); return `M${x0} ${y0}Q${ax} ${ay} ${x1} ${y1}Q${bx} ${by} ${x0} ${y0}Z`; };
    const outer = range(0, 16).map(i => petal(i * PI / 8, 16, 74, 0.2)).join(''), inner = range(0, 8).map(i => petal(i * PI / 4 + PI / 8, 12, 46, 0.32)).join('');
    const beads = range(0, 60).map(i => { const [x, y] = pt(cx, cy, 83, i * PI / 30); return `<circle cx="${x}" cy="${y}" r="1.1" ${F(fg, op * 1.8)}/>`; }).join('');
    return P(outer, `${F(fg, 0.03)} ${S(fg, op, 0.7)}`) + P(inner, S(fg, op * 1.3, 0.7)) + beads + [78, 88, 92, 100].map((r, i) => `<circle cx="${cx}" cy="${cy}" r="${r}" ${S(fg, op * (i === 2 ? 1.3 : 0.8), 0.7)}/>`).join('')
        + `<circle cx="${cx}" cy="${cy}" r="10" ${S(fg, op * 1.3)}/><circle cx="${cx}" cy="${cy}" r="5" ${F(fg, op * 1.6)}/>`;
};
// ferry: a sea chart, the coast hatched, depth lines, soundings, the fairway (chosen from mockup 10)
const seaChart = (fg, op, u) => {
    const coast = 'M250 -10C268 20 300 34 318 56C336 78 352 88 372 92C392 96 404 104 420 112';
    const sh = (k, s) => coast.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (_, x, y) => `${r1(+x - k * 7)} ${r1(+y + k * 9 * s)}`);
    const land = `${coast}L420 -10Z`;
    const hatch = range(0, 30).map(i => `M${250 + i * 7} -10l-40 60`).join('');
    const nums = [['4', 268, 74], ['9', 300, 96], ['13', 236, 104], ['21', 312, 138], ['28', 258, 158], ['35', 350, 168], ['17', 368, 130]];
    return `<defs><clipPath id="${u}c"><path d="${land}"/></clipPath></defs>` + P(land, F(fg, 0.05)) + `<g clip-path="url(#${u}c)">${P(hatch, S(fg, op * 0.7, 0.6))}</g>` + P(coast, S(fg, op * 1.6, 0.9))
        + range(1, 10).map(k => P(sh(k, 1 + k * 0.08), S(fg, op * (k % 3 === 0 ? 1.1 : 0.6), k % 3 === 0 ? 0.8 : 0.6))).join('')
        + nums.map(([t, x, y]) => `<text x="${x}" y="${y}" font-size="7" font-style="italic" font-family="Georgia, serif" ${F(fg, op * 2.6)}>${t}</text>`).join('')
        + P('M180 206C232 172 262 150 344 126', `${S(fg, op * 1.8, 0.9)} stroke-dasharray="3 3"`) + `<circle cx="344" cy="126" r="2.6" ${F(fg, op * 2.5)}/>`;
};
// bus: chevrons pointing on, fading in toward the front (chosen from mockup 10)
const chevrons = (fg, op) => range(0, 5).map(i => `<path d="M${210 + i * 26} 64L${240 + i * 26} 100L${210 + i * 26} 136" ${LN(fg, op, 0.5 + i * 0.25, 8)} stroke-linecap="round" stroke-linejoin="round"/>`).join('');
// theme park: a sunburst from the bottom right corner, every other ray filled (chosen from mockup 10)
const sunburst = (fg, op) => range(0, 9).map(i => { const a0 = PI + i * PI / 18, a1 = a0 + PI / 36; return `<path d="M350 210L${M(pt(350, 210, 260, a0))}L${M(pt(350, 210, 260, a1))}Z" fill="${fg}" fill-opacity="${r1(op * 0.35 * 100) / 100}"/>`; }).join('');
const LN = (fg, op, k, w) => `stroke="${fg}" stroke-opacity="${r1(op * k * 100) / 100}" stroke-width="${w}" fill="none"`;
// what 소망 chose, kind by kind; null is the plain look (no drawing). The train and the movie have no drawing chosen yet
// the main wallet's look: no drawing and the dotted line between the two places ('' draws nothing but keeps the line)
const lined = () => '';
// theater (mockup, not chosen yet): damask, the opera house wallpaper, rows of medallions with a small flower between them, shaded in one tone
const damask = (fg, op, u) => { let a = '', b = '';
    for (let r = -1; r < 5; r++) for (let c = 0; c < 6; c++) { const x = 168 + c * 44 + (r % 2 ? 22 : 0), y = r * 56 + 20;
        a += `M${x} ${y - 26}C${x + 10} ${y - 16} ${x + 16} ${y - 6} ${x + 8} ${y + 4}C${x + 16} ${y + 10} ${x + 14} ${y + 22} ${x} ${y + 26}C${x - 14} ${y + 22} ${x - 16} ${y + 10} ${x - 8} ${y + 4}C${x - 16} ${y - 6} ${x - 10} ${y - 16} ${x} ${y - 26}Z`;
        b += `M${x} ${y - 12}C${x + 5} ${y - 6} ${x + 5} ${y + 4} ${x} ${y + 12}C${x - 5} ${y + 4} ${x - 5} ${y - 6} ${x} ${y - 12}Z`;
        const fx = x + 22, fy = y + 28; for (let k = 0; k < 4; k++) { const t = k * PI / 2; b += `M${fx} ${fy}Q${r1(fx + 7 * cos(t - 0.5))} ${r1(fy + 7 * sin(t - 0.5))} ${r1(fx + 8 * cos(t))} ${r1(fy + 8 * sin(t))}Q${r1(fx + 7 * cos(t + 0.5))} ${r1(fy + 7 * sin(t + 0.5))} ${fx} ${fy}Z`; } }
    return fadeIn(u, `<path d="${a}" ${F(fg, 0.07)}/><path d="${b}" ${F(fg, 0.07)}/>`); };
// match (mockup, not chosen yet): the stand seen from the pitch, rows of seats curving round, each row a little smaller and fainter
const stand = (fg, op, u) => { let o = '';
    for (let r = 0; r < 9; r++) { const k = 0.9 ** r, y = 200 - r * 22 * k - r * 4, w = 18 * k, h = 14 * k, gap = 4 * k, n = Math.ceil(260 / (w + gap)) + 1, bend = 10 * k;
        for (let i = 0; i < n; i++) { const x = 160 + i * (w + gap), t = (x - 160) / 260, yy = y - bend * 4 * t * (1 - t);
            o += `<rect x="${r1(x)}" y="${r1(yy - h)}" width="${r1(w)}" height="${r1(h)}" rx="${r1(h * 0.35)}" ${F(fg, r1((0.15 - r * 0.012) * 100) / 100)}/>`; } }
    return fadeIn(u, o); };
const MOTIF = { flight: [flight, null], train: [lined, null], membership: [dots, holo], other: [dots], concert: [spots], hotel: [windows, doors], match: [bowl],
    movie: [null], museum: [rosette, rosetteP], bus: [lanes, chevrons], ferry: [depths, seaChart], theater: [harlequin], park: [wheel, sunburst] };
const seedOf = id => [...String(id || '')].reduce((h, c) => h + c.charCodeAt(0), 0);
export function passMotif(k, fg, op, id) {
    const xs = MOTIF[k] || MOTIF.other, f = xs[seedOf(id) % xs.length];
    return f ? f(fg, op, `pa${String(id || '').replace(/[^\w-]/g, '')}`) : null;
}
