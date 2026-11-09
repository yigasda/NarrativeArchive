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

// ---- one element each, one soft tone of the ink, made by a rule, sitting quietly on the right
const T = (fg, op, k) => `fill="${fg}" fill-opacity="${r1(op * k * 100) / 100}"`;
const L = (fg, op, k, w) => `stroke="${fg}" stroke-opacity="${r1(op * k * 100) / 100}" stroke-width="${w}" fill="none"`;
// train: motion dashes, rows of rounded dashes that lengthen toward the front
const train = (fg, op) => range(0, 9).map(r => { const y = 30 + r * 18; return range(0, 6).map(c => { const len = 6 + c * 7, x = 200 + c * (c * 3.5 + 14) + (r % 2) * 8; return `<rect x="${r1(x)}" y="${y}" width="${len}" height="4" rx="2" ${T(fg, op, 0.3 + c * 0.14)}/>`; }).join(''); }).join('');
// concert: an equalizer, bars on the floor of the card, heights from one smooth curve
const rings = (fg, op) => range(0, 14).map(i => { const h = r1(26 + 70 * Math.abs(sin(i * 0.55) * cos(i * 0.21))); return `<rect x="${206 + i * 13}" y="${200 - h}" width="8" height="${h + 6}" rx="4" ${T(fg, op, 0.6)}/>`; }).join('');
// concert: one soft spotlight falling from the top right
const spots = (fg, op, u) => `<defs><radialGradient id="${u}s" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${fg}" stop-opacity="${r1(op * 1.6 * 100) / 100}"/><stop offset="1" stop-color="${fg}" stop-opacity="0"/></radialGradient></defs><ellipse cx="300" cy="40" rx="150" ry="130" fill="url(#${u}s)"/>`;
// hotel: one tall arch, a doorway, with a fine inner border
const windows = (fg, op) => `<path d="M250 214V96a52 52 0 0 1 104 0V214Z" ${T(fg, op, 0.35)}/><path d="M260 214V98a42 42 0 0 1 84 0V214" ${L(fg, op, 1.2, 1)}/>`;
// hotel: a satin sheen, one broad soft band across the corner
const doors = (fg, op, u) => `<defs><linearGradient id="${u}h" x1="0" y1="1" x2="1" y2="0"><stop offset="0.35" stop-color="${fg}" stop-opacity="0"/><stop offset="0.55" stop-color="${fg}" stop-opacity="${r1(op * 1.2 * 100) / 100}"/><stop offset="0.75" stop-color="${fg}" stop-opacity="0"/></linearGradient></defs><rect x="150" y="-10" width="200" height="220" fill="url(#${u}h)"/>`;
// match: the pitch's halfway line and centre circle, crisp and large
const pitch = (fg, op) => `<circle cx="310" cy="100" r="58" ${L(fg, op, 1.3, 1.2)}/><circle cx="310" cy="100" r="3" ${T(fg, op, 2)}/><path d="M310 -10V210" ${L(fg, op, 1.3, 1.2)}/>`;
// match: mown grass, broad stripes of two tones
const bowl = (fg, op) => range(0, 5).map(i => `<rect x="${190 + i * 32}" y="-10" width="16" height="220" ${T(fg, op, 0.3)}/>`).join('');
// movie: a strip of film down the right edge, sprockets on both sides
const beam = (fg, op) => `<rect x="286" y="-10" width="56" height="220" ${T(fg, op, 0.35)}/>` + range(0, 12).map(i => `<rect x="291" y="${-4 + i * 18}" width="7" height="9" rx="2" ${T('#000', 1, 0.14)}/><rect x="330" y="${-4 + i * 18}" width="7" height="9" rx="2" ${T('#000', 1, 0.14)}/>`).join('');
// movie: the projector's cone from the corner, fading out
const premiere = (fg, op, u) => `<defs><linearGradient id="${u}p" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${fg}" stop-opacity="${r1(op * 1.4 * 100) / 100}"/><stop offset="1" stop-color="${fg}" stop-opacity="0"/></linearGradient></defs><path d="M346 -6L180 210H330Z" fill="url(#${u}p)"/>`;
// museum: a picture frame, two clean rectangles
const columns = (fg, op) => `<rect x="236" y="44" width="104" height="120" ${L(fg, op, 1.4, 6)}/><rect x="252" y="60" width="72" height="88" ${L(fg, op, 1, 1)}/>`;
// museum: the venue's initial, very large, outlined in a serif
const rosette = (fg, op, u, by) => `<text x="356" y="196" text-anchor="end" font-family="Georgia, 'Times New Roman', serif" font-size="230" ${L(fg, op, 1.3, 1)}>${String(by || 'M').trim().charAt(0).toUpperCase() || 'M'}</text>`;
// bus: the line on the map, one bold stroke with three stops
const route = (fg, op) => `<path d="M190 176H244L284 136H324L356 104H420" ${L(fg, op, 1.4, 6)} stroke-linecap="round" stroke-linejoin="round"/>` + [[244, 176], [324, 136], [356, 104]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" ${T(fg, op, 2)}/>`).join('');
// bus: chevrons pointing on, fading in toward the front
const lanes = (fg, op) => range(0, 5).map(i => `<path d="M${210 + i * 26} 64L${240 + i * 26} 100L${210 + i * 26} 136" ${L(fg, op, 0.5 + i * 0.25, 8)} stroke-linecap="round" stroke-linejoin="round"/>`).join('');
// ferry: three broad swells
const waves = (fg, op) => [80, 116, 152].map(y => `<path d="M190 ${y}q18 -14 36 0t36 0t36 0t36 0t36 0" ${L(fg, op, 1, 6)} stroke-linecap="round"/>`).join('');
// ferry: a compass star, eight points, filled
const depths = (fg, op) => { const cx = 300, cy = 100, p = range(0, 16).map(i => { const r = i % 2 ? 14 : (i % 4 ? 52 : 82); return M(pt(cx, cy, r, i * PI / 8 - PI / 2)); }); return `<path d="M${p.join('L')}Z" ${T(fg, op, 0.5)}/><circle cx="${cx}" cy="${cy}" r="96" ${L(fg, op, 1, 1)}/>`; };
// theater: a column of tall diamonds down the right edge
const arches = (fg, op) => range(-1, 6).map(i => `<path d="M306 ${i * 40}l22 20l-22 20l-22 -20Z" ${T(fg, op, i % 2 ? 0.25 : 0.55)}/>`).join('');
// theater: the valance, a scalloped band across the top
const diamonds = (fg, op) => `<path d="M150 -10H420V22${range(0, 9).map(() => 'a15 15 0 0 1 -30 0').join('')}Z" ${T(fg, op, 0.4)}/>`;
// theme park: the big wheel, rim and eight spokes, crisp
const wheel = (fg, op) => `<circle cx="306" cy="104" r="76" ${L(fg, op, 1.3, 3)}/>` + P(range(0, 8).map(i => `M306 104L${M(pt(306, 104, 76, i * PI / 4))}`).join(''), L(fg, op, 1, 1.2)) + range(0, 8).map(i => `<circle cx="${pt(306, 104, 76, i * PI / 4 + PI / 8)[0]}" cy="${pt(306, 104, 76, i * PI / 4 + PI / 8)[1]}" r="6" ${T(fg, op, 1.2)}/>`).join('') + `<circle cx="306" cy="104" r="8" ${T(fg, op, 1.4)}/>`;
// theme park: a sunburst from the bottom right corner, every other ray filled
const coaster = (fg, op) => range(0, 6).map(i => { const a0 = PI * 1.14 + i * PI / 16, a1 = a0 + PI / 32; return `<path d="M350 210L${M(pt(350, 210, 260, a0))}L${M(pt(350, 210, 260, a1))}Z" ${T(fg, op, 0.2)}/>`; }).join('');
const MOTIF = { flight: [flight, null], train: [train, null], membership: [dots, holo], other: [dots], concert: [rings, spots], hotel: [windows, doors], match: [pitch, bowl],
    movie: [beam, premiere], museum: [columns, rosette], bus: [route, lanes], ferry: [waves, depths], theater: [arches, diamonds], park: [wheel, coaster] };
const seedOf = id => [...String(id || '')].reduce((h, c) => h + c.charCodeAt(0), 0);
export function passMotif(k, fg, op, id, acc, by) {
    const xs = MOTIF[k] || MOTIF.other, f = xs[seedOf(id) % xs.length];
    return f ? f(fg, op, `pa${String(id || '').replace(/[^\w-]/g, '')}`, by) : null;
}
