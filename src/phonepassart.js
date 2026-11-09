// 지갑 표 뒤에 깔리는 무늬: 종류마다 다른 그림(viewBox 340×200, 오른쪽에 붙여 그려요). 시안 docs/mockups/phone-passes/,
// 소망이 동그라미 친 것만 있어요. 종류마다 둘이고, 표 id로 둘 중 하나를 골라요(늘 같은 표는 같은 무늬).
// 그림마다 층(옅고 진한 선 · 면), 은은한 빛 하나, 강조색 한 점을 두고, 글자가 있는 왼쪽으로 갈수록 사라져요(fade).
// 같은 모양의 선은 한 path에 모아요(요소 수가 적어야 휴대폰 창이 가벼워요)
const r1 = v => Math.round(v * 10) / 10;
const S = (fg, op, w = 0.8) => `stroke="${fg}" stroke-opacity="${r1(op * 100) / 100}" fill="none" stroke-width="${w}"`;
const F = (c, a) => `fill="${c}" fill-opacity="${r1(a * 100) / 100}"`;
const range = (a, b, s = 1) => { const o = []; for (let v = a; s > 0 ? v < b : v > b; v += s) o.push(v); return o; };
const cos = Math.cos, sin = Math.sin, PI = Math.PI;
const P = (d, attrs) => `<path d="${d}" ${attrs}/>`;
// a soft round light (radial gradient) and a fade from the left; u keeps the ids of one card apart from another's
const glow = (u, n, cx, cy, r, c, a) => `<defs><radialGradient id="${u}${n}"><stop offset="0" stop-color="${c}" stop-opacity="${a}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${u}${n})"/>`;
const fade = (u, inner, from = 0.12, to = 0.5) => `<defs><linearGradient id="${u}f" x1="0" x2="1"><stop offset="${from}" stop-color="#fff" stop-opacity="0"/><stop offset="${to}" stop-color="#fff"/></linearGradient><mask id="${u}m"><rect x="-20" y="-20" width="400" height="260" fill="url(#${u}f)"/></mask></defs><g mask="url(#${u}m)">${inner}</g>`;
const vgrad = (u, n, c, a0, a1) => `<defs><linearGradient id="${u}${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="${a0}"/><stop offset="1" stop-color="${c}" stop-opacity="${a1}"/></linearGradient></defs>`;

// ---- kept as chosen: flight (globe + route), membership (dots, hologram)
const flight = (fg, op) => {
    const s = S(fg, op), cx = 270, cy = 150, r = 120;
    return range(0, 90, 15).map(a => `<ellipse cx="${cx}" cy="${cy}" rx="${r1(r * Math.abs(cos(a / 180 * PI)))}" ry="${r}" ${s}/>`).join('')
        + [-45, -20, 0, 20, 45].map(a => `<path d="M${cx - r} ${r1(cy - r * sin(a / 180 * PI))} H${cx + r}" ${s}/>`).join('')
        + `<path d="M140 70 Q240 30 330 95" ${S(fg, op * 2.2, 1.1)} stroke-dasharray="2 4"/><circle cx="140" cy="70" r="2.4" fill="${fg}" fill-opacity="${r1(op * 250) / 100}"/>`;
};
const dots = (fg, op) => range(0, 12).flatMap(c => range(0, 12).map(r => `<circle cx="${150 + c * 16}" cy="${12 + r * 16}" r="${r1((0.6 + (c + r) * 0.12) * 100) / 100}" fill="${fg}" fill-opacity="${r1(op * 160) / 100}"/>`)).join('');
const holo = (fg, op, u) => `<defs><linearGradient id="${u}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd1f0"/><stop offset=".35" stop-color="#c4f2ff"/><stop offset=".7" stop-color="#d9ffc9"/><stop offset="1" stop-color="#fff1b8"/></linearGradient></defs><rect x="262" y="-10" width="46" height="230" fill="url(#${u}h)" fill-opacity=".28"/>`
    + P(range(0, 12).map(i => `M${262 + i * 4} -10V220`).join(''), 'stroke="#fff" stroke-opacity=".12"');

// ---- train: speed lines into a lit vanishing point, a few long streaks in the accent
const train = (fg, op, u, acc) => {
    const vx = 330, vy = 92, ys = range(-80, 300, 12);
    const lines = (pick, a, w) => P(ys.filter(pick).map(y => `M${vx} ${vy}L-20 ${y}`).join(''), S(fg, a, w));
    return fade(u, glow(u, 'g', vx, vy, 70, acc, 0.35) + lines(() => true, op * 0.55, 0.6) + lines(y => Math.abs(y - vy) < 70, op * 0.9, 0.8)
        + P([-30, 6, 44, 150, 196].map(y => `M${vx} ${vy}L-20 ${y}`).join(''), S(acc, 0.55, 1.2)) + `<circle cx="${vx}" cy="${vy}" r="3" fill="${acc}"/>`, 0.05, 0.55);
};
// ---- concert: rings of sound, alternate rings dotted, a light at the source, a few notes of light on the rings
const rings = (fg, op, u, acc) => {
    const cx = 300, cy = 100, rs = range(14, 250, 12);
    return fade(u, glow(u, 'g', cx, cy, 80, acc, 0.4)
        + rs.map((r, i) => `<circle cx="${cx}" cy="${cy}" r="${r}" ${S(fg, op * (1.3 - i / rs.length), i % 3 === 2 ? 1.4 : 0.7)}${i % 2 ? ' stroke-dasharray="1 4" stroke-linecap="round"' : ''}/>`).join('')
        + [[36, 200], [60, 250], [96, 214], [132, 236]].map(([r, a]) => `<circle cx="${r1(cx + r * cos(a * PI / 180))}" cy="${r1(cy + r * sin(a * PI / 180))}" r="2.2" fill="${acc}" fill-opacity=".85"/>`).join('')
        + `<circle cx="${cx}" cy="${cy}" r="4" fill="${acc}"/>`, 0.15, 0.6);
};
// ---- concert: two spotlights, each a soft cone with fine edges and dust in the light, a pool on the floor
const spots = (fg, op, u, acc) => {
    const cone = (x, to, n) => vgrad(u, n, acc, 0.42, 0) + P(`M${x - 6} -10L${to - 56} 210H${to + 56}L${x + 6} -10Z`, `fill="url(#${u}${n})"`) + P(`M${x - 6} -10L${to - 56} 210M${x + 6} -10L${to + 56} 210`, S(fg, op * 1.2));
    const dust = [[236, 70], [252, 110], [228, 140], [300, 60], [284, 120], [310, 150], [262, 170], [242, 96]];
    return fade(u, cone(230, 250, 'a') + cone(330, 280, 'b') + `<ellipse cx="266" cy="190" rx="90" ry="12" ${F(acc, 0.16)}/>`
        + dust.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 0.9 : 1.4}" fill="#fff" fill-opacity="${i % 2 ? 0.35 : 0.6}"/>`).join(''), 0.2, 0.6);
};
// ---- hotel: the facade at night, floors and windows, a few rooms lit warm
const windows = (fg, op, u, acc) => {
    const lit = new Set(['1,2', '3,1', '4,4', '6,3', '2,5', '5,6', '7,2']);
    let o = '', w = '';
    for (let c = 0; c < 8; c++) for (let r = 0; r < 7; r++) {
        const x = 186 + c * 20, y = 18 + r * 24;
        if (lit.has(`${c},${r}`)) o += `<rect x="${x}" y="${y}" width="11" height="15" rx="5.5" ${F(acc, 0.55)}/>`;
        else w += `M${x + 5.5} ${y}a5.5 5.5 0 0 1 5.5 5.5V${y + 15}H${x}V${y + 5.5}a5.5 5.5 0 0 1 5.5 -5.5Z`;
    }
    return fade(u, P(w, S(fg, op * 0.9, 0.7)) + o + P(range(0, 8).map(r => `M176 ${r1(38 + r * 24)}H350`).join(''), S(fg, op * 0.45)) + P('M176 8H350M176 12H350', S(fg, op * 1.2, 1)), 0.25, 0.6);
};
// ---- hotel: a doorway inside doorways, each frame a step deeper, a lamp over the door
const doors = (fg, op, u, acc) => {
    const fr = range(0, 7).map(i => [230 - i * 13, 34 - i * 12, 80 + i * 26, 40 + i * 13]);
    return fade(u, fr.reverse().map(([x, y, w, r], i) => `<rect x="${x}" y="${y}" width="${w}" height="220" rx="${r}" ${F('#3a2e1e', 0.018 * (i + 1))} ${S(fg, op * (0.6 + i * 0.08))}/>`).join('')
        + glow(u, 'g', 270, 46, 34, acc, 0.5) + `<circle cx="270" cy="46" r="3" fill="${acc}"/><circle cx="296" cy="140" r="2.6" ${F(acc, 0.8)}/>`, 0.2, 0.6);
};
// ---- match: the pitch from above, mown stripes, crisp lines, the ball on the spot
const pitch = (fg, op, u, acc) => {
    const x0 = 160, x1 = 470, y0 = 14, y1 = 186, mx = 270;
    const stripes = range(0, 10).filter(i => i % 2).map(i => `<rect x="${x0 + i * 31}" y="${y0}" width="31" height="${y1 - y0}" ${F('#fff', 0.035)}/>`).join('');
    const lines = `M${x0} ${y0}H${x1}V${y1}H${x0}ZM${mx} ${y0}V${y1}M${x0} 62H${x0 + 40}V138H${x0}M${x0} 84H${x0 + 14}V116H${x0}`;
    return fade(u, stripes + P(lines, S(fg, op * 1.3, 0.9)) + `<circle cx="${mx}" cy="100" r="36" ${S(fg, op * 1.3, 0.9)}/>` + P(`M${x0 + 40} 82A22 22 0 0 1 ${x0 + 40} 118`, S(fg, op * 1.3, 0.9))
        + glow(u, 'g', mx, 100, 30, acc, 0.35) + `<circle cx="${mx}" cy="100" r="3.2" fill="${acc}"/>`, 0.1, 0.5);
};
// ---- match: the stadium bowl, tiers getting lighter outward, floodlights on the rim, the pitch inside
const bowl = (fg, op, u, acc) => {
    const ring = i => [190 - i * 13, 66 - i * 11, 160 + i * 26, 68 + i * 22, 34 + i * 11];
    let o = '';
    for (let i = 7; i >= 0; i--) { const [x, y, w, h, r] = ring(i); o += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${F('#fff', i % 2 ? 0.025 : 0.04)} ${S(fg, op * (1.2 - i * 0.08))}/>`; }
    const [x, y, w, h] = ring(0);
    o += `<rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" rx="10" ${F(acc, 0.18)}/>` + P(`M${x + w / 2} ${y + 10}V${y + h - 10}`, S(fg, op * 1.4));
    const [X, Y, W, H, R] = ring(7);
    o += [[X + R * 0.3, Y + R * 0.3], [X + W - R * 0.3, Y + R * 0.3], [X + R * 0.3, Y + H - R * 0.3], [X + W - R * 0.3, Y + H - R * 0.3]].map(([a, b], i) => glow(u, `l${i}`, r1(a), r1(b), 16, acc, 0.5) + `<circle cx="${r1(a)}" cy="${r1(b)}" r="2.2" fill="${acc}"/>`).join('');
    return fade(u, o, 0.15, 0.55);
};
// ---- movie: the projector's beam, a soft cone with fine rays and dust, the lens lit
const beam = (fg, op, u, acc) => {
    const lx = 345, ly = -5;
    return fade(u, `<defs><linearGradient id="${u}b" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${acc}" stop-opacity=".38"/><stop offset="1" stop-color="${acc}" stop-opacity="0"/></linearGradient></defs>`
        + P(`M${lx} ${ly}L90 210H330Z`, `fill="url(#${u}b)"`) + P(range(0, 16).map(i => `M${lx} ${ly}L${100 + i * 15} 210`).join(''), S(fg, op * 0.7, 0.6))
        + [[300, 50], [270, 90], [250, 130], [310, 110], [220, 170], [286, 150], [330, 70]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 ? 0.9 : 1.3}" fill="#fff" fill-opacity="${i % 3 ? 0.4 : 0.7}"/>`).join('')
        + glow(u, 'g', lx, ly, 40, acc, 0.6) + `<circle cx="${lx - 6}" cy="${ly + 6}" r="5" fill="${acc}"/>`, 0.15, 0.55);
};
// ---- movie: a premiere's starburst, tapered rays, stars of a few sizes, the light in the middle
const premiere = (fg, op, u, acc) => {
    const cx = 280, cy = 96, rays = range(0, 24).map(a => {
        const t = a * PI / 12, w = 0.035, L = a % 2 ? 120 : 160;
        return `M${r1(cx + 14 * cos(t - w))} ${r1(cy + 14 * sin(t - w))}L${r1(cx + L * cos(t))} ${r1(cy + L * sin(t))}L${r1(cx + 14 * cos(t + w))} ${r1(cy + 14 * sin(t + w))}Z`;
    }).join('');
    const star = (x, y, s, a) => P(`M${x} ${y - s}C${x + s * 0.12} ${y - s * 0.12} ${x + s * 0.12} ${y - s * 0.12} ${x + s} ${y}C${x + s * 0.12} ${y + s * 0.12} ${x + s * 0.12} ${y + s * 0.12} ${x} ${y + s}C${x - s * 0.12} ${y + s * 0.12} ${x - s * 0.12} ${y + s * 0.12} ${x - s} ${y}C${x - s * 0.12} ${y - s * 0.12} ${x - s * 0.12} ${y - s * 0.12} ${x} ${y - s}Z`, F('#fff', a));
    return fade(u, P(rays, F(fg, op * 0.6)) + glow(u, 'g', cx, cy, 60, acc, 0.45) + `<circle cx="${cx}" cy="${cy}" r="5" fill="${acc}"/>`
        + star(212, 40, 7, 0.55) + star(330, 156, 9, 0.5) + star(244, 160, 4, 0.45) + star(318, 34, 5, 0.6) + star(196, 120, 3.5, 0.4), 0.15, 0.55);
};
// ---- museum: a classical front, pediment, fluted columns on steps, a lamp-lit doorway
const columns = (fg, op, u, acc) => {
    const xs = range(0, 5).map(i => 176 + i * 40);
    const fl = xs.flatMap(x => range(0, 5).map(j => `M${x + 3 + j * 3.5} 62V166`)).join('');
    return fade(u, P('M162 52L268 14L374 52Z', `${F('#3a2e1e', 0.05)} ${S(fg, op * 1.2, 0.9)}`) + P('M162 52H374M166 58H370', S(fg, op * 1.2, 0.9))
        + xs.map(x => `<rect x="${x}" y="60" width="20" height="108" ${F('#3a2e1e', 0.04)}/>`).join('') + P(fl, S(fg, op * 0.8, 0.6))
        + P('M156 168H380M150 176H386M144 184H392', S(fg, op * 1.2, 0.9)) + glow(u, 'g', 286, 120, 26, acc, 0.35) + `<circle cx="268" cy="34" r="3" ${F(acc, 0.9)}/>`, 0.2, 0.6);
};
// ---- museum: a rosette, petals filled by turns, a bead ring outside, the heart in the accent
const rosette = (fg, op, u, acc) => {
    const cx = 275, cy = 100, pet = range(0, 12).map(a => `<circle cx="${r1(cx + 40 * cos(a * PI / 6))}" cy="${r1(cy + 40 * sin(a * PI / 6))}" r="40" ${a % 2 ? F('#3a2e1e', 0.03) : 'fill="none"'} ${S(fg, op)}/>`).join('');
    return fade(u, pet + `<circle cx="${cx}" cy="${cy}" r="82" ${S(fg, op * 1.2, 0.9)}/><circle cx="${cx}" cy="${cy}" r="90" ${S(fg, op * 0.7)}/>`
        + range(0, 36).map(a => `<circle cx="${r1(cx + 86 * cos(a * PI / 18))}" cy="${r1(cy + 86 * sin(a * PI / 18))}" r="1.2" ${F(fg, op * 1.8)}/>`).join('')
        + `<circle cx="${cx}" cy="${cy}" r="9" ${F(acc, 0.85)}/><circle cx="${cx}" cy="${cy}" r="14" ${S(acc, 0.6)}/>`, 0.2, 0.6);
};
// ---- bus: a network map, other lines faint, this one in the accent, stops as rings, the end stop bigger
const route = (fg, op, u, acc) => {
    const mine = [[196, 156], [226, 156], [248, 132], [284, 132], [306, 106], [350, 106]];
    const other = 'M180 70H230L262 102V190M214 20L246 52H300L330 82V200M280 160H330L352 138';
    return fade(u, P(other, `${S(fg, op * 1.2, 3)} stroke-linecap="round" stroke-linejoin="round"`)
        + P(`M${mine.map(q => q.join(' ')).join('L')}`, `stroke="${acc}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"`)
        + mine.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === mine.length - 1 ? 6 : 4}" fill="#fff" stroke="${acc}" stroke-width="2"/>`).join('')
        + [[230, 70], [262, 140], [300, 52]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="none" ${S(fg, op * 2, 1.4)}/>`).join(''), 0.25, 0.6);
};
// ---- bus: the road ahead, its surface darker, dashes growing toward you, a low sun on the horizon
const lanes = (fg, op, u, acc) => {
    const hx = 270, hy = 44, dash = range(1, 6).map(i => i * 0.13).map(t => { const y0 = hy + t * t * 160, y1 = hy + (t + 0.06) ** 2 * 160, w = 0.6 + t * 3; return `M${r1(hx - w)} ${r1(y0)}H${r1(hx + w)}L${r1(hx + w * 1.3)} ${r1(y1)}H${r1(hx - w * 1.3)}Z`; }).join('');
    return fade(u, glow(u, 'g', hx, hy, 60, acc, 0.45) + P(`M${hx - 8} ${hy}L150 210H390L${hx + 8} ${hy}Z`, F('#000', 0.14))
        + P(`M${hx - 8} ${hy}L150 210M${hx + 8} ${hy}L390 210`, S(fg, op * 1.4, 1)) + P(`M${hx - 5} ${hy}L180 210M${hx + 5} ${hy}L360 210`, S(fg, op * 0.6, 0.6))
        + P(dash, F(fg, op * 2.4)) + P(`M150 ${hy}H390`, S(fg, op * 0.9)), 0.2, 0.55);
};
// ---- ferry: swell in layers, each band a little deeper, crests drawn, the sun on the water
const waves = (fg, op, u, acc) => {
    const band = (y, amp) => `M-20 ${y} ${range(0, 10).map(() => `q11 ${r1(-amp)} 22 0 t22 0`).join(' ')}`;
    let o = glow(u, 'g', 296, 40, 46, acc, 0.45) + `<circle cx="296" cy="40" r="11" ${F(acc, 0.6)}/>`;
    for (let i = 0; i < 8; i++) { const y = 70 + i * 18, a = 5 + i * 0.6; o += P(`${band(y, a)}V230H-20Z`, F('#000', 0.035)) + P(band(y, a), S(fg, op * (0.8 + i * 0.07), 0.8)); }
    return fade(u, o + P('M266 64h60M276 72h40M286 80h20', S(acc, 0.5, 1.2)), 0.25, 0.6);
};
// ---- ferry: a sea chart, depth contours shaded deeper inward, soundings, the channel marked
const depths = (fg, op, u, acc) => {
    const c = i => `M${150 + i * 6} 210C${180 + i * 8} ${120 - i * 6} 260 ${150 - i * 12} ${300 - i * 2} ${80 - i * 8}S350 ${20 + i * 4} 370 ${10 + i * 14}L400 -20V210Z`;
    const n = [['12', 214, 166], ['18', 252, 124], ['25', 300, 150], ['31', 318, 96], ['40', 344, 140]];
    return fade(u, range(0, 9).map(i => P(c(i), `${F('#000', 0.03)} ${S(fg, op * (0.9 + i * 0.04))}`)).join('')
        + n.map(([t, x, y]) => `<text x="${x}" y="${y}" font-size="8" font-family="Inter Tight, sans-serif" ${F(fg, op * 2.2)}>${t}</text>`).join('')
        + P('M196 196C240 150 286 120 360 40', `stroke="${acc}" stroke-width="1.4" fill="none" stroke-dasharray="5 4"`) + `<circle cx="360" cy="40" r="3.4" fill="${acc}"/>`, 0.2, 0.6);
};
// ---- theater: the proscenium, curtains drawn back in folds, nested arches, a pool of light on the stage
const arches = (fg, op, u, acc) => {
    const arch = i => `M${200 - i * 14} 210V${110 - i * 4}A${80 + i * 14} ${80 + i * 14} 0 0 1 ${360 + i * 14} ${110 - i * 4}V210`;
    const folds = left => range(0, 5).map(j => left ? `M${196 + j * 7} 40C${206 + j * 6} 110 ${192 + j * 8} 150 ${200 + j * 9} 210` : `M${364 - j * 7} 40C${354 - j * 6} 110 ${368 - j * 8} 150 ${360 - j * 9} 210`).join('');
    return fade(u, range(0, 7).map(i => P(arch(i), S(fg, op * (1.2 - i * 0.1), i ? 0.8 : 1.4))).join('') + P(`${folds(true)}${folds(false)}`, S(fg, op * 0.9, 0.7))
        + P('M196 30C230 60 250 64 280 64C310 64 330 60 364 30V22H196Z', F('#000', 0.12)) + `<ellipse cx="280" cy="192" rx="56" ry="10" ${F(acc, 0.28)}/>` + glow(u, 'g', 280, 180, 60, acc, 0.3), 0.2, 0.6);
};
// ---- theater: harlequin diamonds, every other one filled, a few in the accent, fading in from the left
const diamonds = (fg, op, u, acc) => {
    let fill = '', hot = '';
    for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
        const x = 150 + c * 24 + (r % 2 ? 12 : 0), y = -32 + r * 22, d = `M${x} ${y}l12 22l-12 22l-12 -22Z`;
        if ((r * 7 + c * 3) % 11 === 0) hot += d; else if ((r + c) % 2) fill += d;
    }
    const grid = range(-6, 9).map(i => `M${150 + i * 24} -10L${270 + i * 24} 210M${150 + i * 24} 210L${270 + i * 24} -10`).join('');
    return fade(u, P(fill, F('#000', 0.1)) + P(hot, F(acc, 0.32)) + P(grid, S(fg, op * 1.1, 0.7)), 0.2, 0.6);
};
// ---- theme park: the big wheel, gondolas tinted, lights on the rim, the legs it stands on
const wheel = (fg, op, u, acc) => {
    const cx = 280, cy = 92, R = 76, at = (a, r) => [r1(cx + r * cos(a * PI / 12)), r1(cy + r * sin(a * PI / 12))];
    const spokes = range(0, 24).map(a => { const [x, y] = at(a, R); return `M${cx} ${cy}L${x} ${y}`; }).join('');
    const pods = range(0, 12).map(a => { const [x, y] = at(a * 2, R); return `<rect x="${r1(x - 5)}" y="${y}" width="10" height="9" rx="3" ${a % 3 ? F(fg, 0.12) : F(acc, 0.6)}/>`; }).join('');
    const bulbs = range(0, 48).map(a => { const [x, y] = at(a / 2, R + 6); return `<circle cx="${x}" cy="${y}" r="1" ${F(a % 4 ? '#fff' : acc, a % 4 ? 0.4 : 0.9)}/>`; }).join('');
    return fade(u, glow(u, 'g', cx, cy, 100, acc, 0.22) + `<circle cx="${cx}" cy="${cy}" r="${R}" ${S(fg, op * 1.4, 1.2)}/><circle cx="${cx}" cy="${cy}" r="${R - 8}" ${S(fg, op * 0.8)}/>`
        + P(spokes, S(fg, op * 0.9, 0.6)) + pods + bulbs + P(`M${cx} ${cy}L${cx - 46} 210M${cx} ${cy}L${cx + 46} 210M${cx - 30} 168H${cx + 30}`, S(fg, op * 1.6, 1.6)) + `<circle cx="${cx}" cy="${cy}" r="5" ${F(acc, 0.9)}/>`, 0.2, 0.6);
};
// ---- theme park: a coaster, two rails with ties, the lattice under it, a car on the hill
const coaster = (fg, op, u, acc) => {
    const f = q => [140 + q * 240, 120 - 64 * sin(q * PI * 2.2) * (1 - q * 0.3)], t = range(0, 61).map(i => i / 60);
    const rail = dy => `M${t.map(q => { const [x, y] = f(q); return `${r1(x)} ${r1(y + dy)}`; }).join('L')}`;
    const ties = t.filter((_, i) => i % 2 === 0).map(q => { const [x, y] = f(q); return `M${r1(x)} ${r1(y)}v8`; }).join('');
    const legs = t.filter((_, i) => i % 5 === 0).map(q => { const [x, y] = f(q); return `M${r1(x)} ${r1(y + 8)}V210`; }).join('');
    const cross = t.filter((_, i) => i % 5 === 0).slice(0, -1).map((q, i) => { const [x, y] = f(q), [x2, y2] = f(t[(i + 1) * 5]); return `M${r1(x)} ${r1(y + 8)}L${r1(x2)} 210M${r1(x2)} ${r1(y2 + 8)}L${r1(x)} 210`; }).join('');
    const [cx, cy] = f(0.27);
    return fade(u, P(cross, S(fg, op * 0.45, 0.5)) + P(legs, S(fg, op * 0.9, 0.8)) + P(rail(0) + rail(8), S(fg, op * 1.8, 1.1)) + P(ties, S(fg, op * 1.1, 0.7))
        + `<rect x="${r1(cx - 12)}" y="${r1(cy - 8)}" width="24" height="10" rx="4" ${F(acc, 0.9)}/>` + glow(u, 'g', r1(cx), r1(cy), 30, acc, 0.35), 0.15, 0.55);
};
// the plain look of the first wallet has no drawing: null
const MOTIF = { flight: [flight, null], train: [train, null], membership: [dots, holo], other: [dots], concert: [rings, spots], hotel: [windows, doors], match: [pitch, bowl],
    movie: [beam, premiere], museum: [columns, rosette], bus: [route, lanes], ferry: [waves, depths], theater: [arches, diamonds], park: [wheel, coaster] };
// the sum of its letters: ids next to each other (p1, p2 …) take turns
const seedOf = id => [...String(id || '')].reduce((h, c) => h + c.charCodeAt(0), 0);
export function passMotif(k, fg, op, id, acc = fg) {
    const xs = MOTIF[k] || MOTIF.other, f = xs[seedOf(id) % xs.length];
    return f ? f(fg, op, `pa${String(id || '').replace(/[^\w-]/g, '')}`, acc) : null;
}
