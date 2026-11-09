// 지갑 표 뒤 무늬(viewBox 340×200, 오른쪽에 붙어요). 종류마다 그 물건을 정확한 비율 · 원근으로, 고른 가는 선과 옅은 면 두세 단계로만 그려요
const r1 = v => Math.round(v * 10) / 10;
const S = (fg, op, w = 0.8) => `stroke="${fg}" stroke-opacity="${r1(op * 100) / 100}" fill="none" stroke-width="${w}"`;
const F = (fg, a) => `fill="${fg}" fill-opacity="${r1(a * 1000) / 1000}"`;
const P = (d, a = '') => `<path d="${d}" ${a}/>`;
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

// ---- each kind its own picture, in soft light: shapes made of gradients that fade into the card, one crisp line at most
const A = (fg, a) => `fill="${fg}" fill-opacity="${a}"`;
const G = (u, n, fg, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => `<linearGradient id="${u}${n}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, a]) => `<stop offset="${o}" stop-color="${fg}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
const R = (u, n, fg, a, cx = 0.5, cy = 0.5) => `<radialGradient id="${u}${n}" cx="${cx}" cy="${cy}" r="0.5"><stop offset="0" stop-color="${fg}" stop-opacity="${a}"/><stop offset="1" stop-color="${fg}" stop-opacity="0"/></radialGradient>`;
const url = (u, n) => `fill="url(#${u}${n})"`;
const line = (fg, a, w = 1) => `stroke="${fg}" stroke-opacity="${a}" stroke-width="${w}" fill="none" stroke-linecap="round"`;
// train: bands of light streaming past a window, each brightening toward the front
const train = (fg, op, u) => `<defs>${G(u, 'g', fg, [[0, 0], [1, 0.16]], 0, 0, 1, 0)}</defs>` + [[70, 10, 150], [88, 4, 210], [100, 22, 120], [130, 6, 190], [144, 12, 240], [164, 3, 170]].map(([y, h, x]) => `<rect x="${x}" y="${y}" width="${420 - x}" height="${h}" rx="${h / 2}" ${url(u, 'g')}/>`).join('');
// concert: a warm wash of stage light from below, three clean arcs riding over it
const rings = (fg, op, u) => `<defs>${R(u, 'r', fg, 0.22)}</defs><circle cx="320" cy="180" r="150" ${url(u, 'r')}/>` + [70, 100, 130].map((r, i) => `<path d="M${320 - r} 180A${r} ${r} 0 0 1 ${320 + r} 180" ${line(fg, 0.2 - i * 0.04, 1.2)}/>`).join('');
// concert: three beams from the rig above, bright where they start and gone by the floor
const spots = (fg, op, u) => `<defs>${G(u, 'b', fg, [[0, 0.2], [1, 0]])}</defs>` + [[230, 170, 270], [292, 222, 322], [350, 290, 380]].map(([x, l, r]) => `<path d="M${x - 5} -6L${l} 214H${r}L${x + 5} -6Z" ${url(u, 'b')}/>`).join('');
// hotel: one tall arched window with the room's warm light pouring down it
const windows = (fg, op, u) => `<defs>${G(u, 'w', fg, [[0, 0.04], [1, 0.2]])}</defs><path d="M254 214V84a46 46 0 0 1 92 0V214Z" ${url(u, 'w')}/><path d="M254 214V84a46 46 0 0 1 92 0V214" ${line(fg, 0.14, 1)}/><path d="M300 38V214M254 118H346" ${line(fg, 0.1, 1)}/>`;
// hotel: linen folded on the bed, three soft diagonal folds with their sheen
const doors = (fg, op, u) => `<defs>${G(u, 'f', fg, [[0, 0], [0.5, 0.12], [1, 0]], 0, 0, 1, 0)}</defs>` + [[180, 0.6], [250, 1], [320, 0.7]].map(([x, k]) => `<path d="M${x} 214L${x + 90} -10H${x + 150}L${x + 60} 214Z" ${url(u, 'f')} fill-opacity="${k}"/>`).join('');
// match: the grass mown in broad stripes that fade away up the pitch, the centre circle drawn once
const pitch = (fg, op, u) => `<defs>${G(u, 's', fg, [[0, 0], [1, 0.09]])}</defs>` + range(0, 4).map(i => `<rect x="${190 + i * 56}" y="-10" width="28" height="224" ${url(u, 's')}/>`).join('') + `<circle cx="318" cy="200" r="58" ${line(fg, 0.14, 1.2)}/>`;
// match: a floodlight's sweep from the corner of the stand, wide and soft
const bowl = (fg, op, u) => `<defs>${R(u, 'l', fg, 0.3)}${G(u, 'w', fg, [[0, 0.16], [1, 0]], 1, 0, 0, 1)}</defs><path d="M344 -4L150 170V214H230L360 4Z" ${url(u, 'w')}/><circle cx="352" cy="0" r="40" ${url(u, 'l')}/>`;
// movie: the projector's beam, brightest at the lens and thinning into the dark
const beam = (fg, op, u) => `<defs>${G(u, 'p', fg, [[0, 0.2], [1, 0]], 1, 0, 0, 1)}${R(u, 'l', fg, 0.4)}</defs><path d="M352 4L160 214H330L360 12Z" ${url(u, 'p')}/><circle cx="356" cy="6" r="26" ${url(u, 'l')}/>`;
// movie: frames of film in a row going away, each a little dimmer than the last
const premiere = (fg, op, u) => range(0, 5).map(i => { const w = 70 - i * 9, h = 50 - i * 6.4, x = 330 - i * 36 - w / 2, y = 118 - h / 2 - i * 8; return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="5" ${A(fg, 0.13 - i * 0.02)}/>`; }).join('');
// museum: a pool of light on the gallery wall, a frame hanging in it
const columns = (fg, op, u) => `<defs>${R(u, 'p', fg, 0.2)}</defs><ellipse cx="282" cy="112" rx="110" ry="90" ${url(u, 'p')}/><rect x="244" y="86" width="76" height="56" ${line(fg, 0.22, 1.2)}/><rect x="251" y="93" width="62" height="42" ${A(fg, 0.05)}/>`;
// museum: an arcade, three arches one behind another, paler the further they go
const rosette = (fg, op, u) => [[300, 64, 0.06], [312, 48, 0.08], [322, 34, 0.11]].map(([x, r, a], i) => `<path d="M${x - r} 214V${150 - r + i * 10}a${r} ${r} 0 0 1 ${2 * r} 0V214Z" ${A(fg, a)}/>`).join('');
// bus: the line on the map as one smooth broad ribbon, three stops along it
const route = (fg, op, u) => `<defs>${G(u, 'r', fg, [[0, 0], [1, 0.22]], 0, 0, 1, 0)}</defs><path d="M170 190C240 190 250 120 300 110S350 60 420 56" stroke="url(#${u}r)" stroke-width="12" fill="none" stroke-linecap="round"/>` + [[252, 142], [300, 110], [352, 72]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" ${A(fg, 0.3)}/>`).join('');
// bus: the road running to a glow on the horizon
const lanes = (fg, op, u) => `<defs>${G(u, 'h', fg, [[0, 0], [1, 0.14]])}${G(u, 'r', fg, [[0, 0.02], [1, 0.1]])}</defs><rect x="150" y="0" width="270" height="64" ${url(u, 'h')}/><path d="M290 64L170 214H410Z" ${url(u, 'r')}/><path d="M290 70V214" ${line(fg, 0.18, 2.4)} stroke-dasharray="10 12"/>`;
// ferry: three swells, each a band darker below its crest
const waves = (fg, op, u) => `<defs>${G(u, 'w', fg, [[0, 0.12], [1, 0]])}</defs>` + [70, 110, 150].map(y => `<path d="M150 ${y}C200 ${y - 22} 250 ${y - 22} 300 ${y}S400 ${y + 22} 450 ${y}V${y + 50}H150Z" ${url(u, 'w')}/>`).join('');
// ferry: the sun low over the water, its light broken into a path below it
const depths = (fg, op, u) => `<defs>${R(u, 's', fg, 0.34)}${G(u, 'p', fg, [[0, 0.22], [1, 0]])}</defs><circle cx="300" cy="96" r="70" ${url(u, 's')}/><path d="M270 96A30 30 0 0 1 330 96Z" ${A(fg, 0.18)}/><path d="M150 96H420" ${line(fg, 0.14, 1)}/>`
    + [[284, 104, 32], [276, 114, 48], [288, 126, 24], [270, 140, 60], [290, 156, 20], [266, 172, 68]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="3" rx="1.5" ${url(u, 'p')}/>`).join('');
// theater: velvet falling in folds, light catching each fold, the valance across the top
const arches = (fg, op, u) => `<defs>${G(u, 'v', fg, [[0, 0], [0.5, 0.14], [1, 0]], 0, 0, 1, 0)}</defs>` + range(0, 6).map(i => `<rect x="${220 + i * 24}" y="-10" width="24" height="224" ${url(u, 'v')}/>`).join('') + `<path d="M208 -10H420V22Q390 40 360 22Q330 40 300 22Q270 40 240 22Q224 32 208 22Z" ${A(fg, 0.1)}/>`;
// theater: the tiers of the house curving round, each a soft band
const diamonds = (fg, op, u) => `<defs>${G(u, 't', fg, [[0, 0.12], [1, 0.02]])}</defs>` + [0, 1, 2].map(i => { const y = 50 + i * 46, rx = 150 - i * 14; return `<path d="M${300 - rx} ${y}Q300 ${y + 60} ${300 + rx} ${y}V${y + 18}Q300 ${y + 78} ${300 - rx} ${y + 18}Z" ${url(u, 't')}/>`; }).join('');
// theme park: the big wheel against the sky, its rim lit, cut by the edge
const wheel = (fg, op, u) => `<defs>${R(u, 'g', fg, 0.14)}</defs><circle cx="320" cy="120" r="120" ${url(u, 'g')}/><circle cx="320" cy="120" r="96" ${line(fg, 0.16, 3)}/>` + P(range(0, 12).map(i => `M320 120L${M(pt(320, 120, 96, i * PI / 6))}`).join(''), line(fg, 0.08, 1)) + `<circle cx="320" cy="120" r="8" ${A(fg, 0.18)}/>`;
// theme park: a string of bulbs looping across, the near ones bigger and brighter
const coaster = (fg, op, u) => { const pts = range(0, 11).map(i => { const t = i / 10; return [170 + t * 250, 60 + 50 * sin(t * PI) + t * 40]; });
    return P(`M${pts.map(([x, y]) => `${r1(x)} ${r1(y - 4)}`).join('L')}`, line(fg, 0.12, 1)) + `<defs>${R(u, 'b', fg, 0.5)}</defs>` + pts.map(([x, y], i) => `<circle cx="${r1(x)}" cy="${r1(y + 4)}" r="${r1(6 + i * 0.8)}" ${url(u, 'b')}/><circle cx="${r1(x)}" cy="${r1(y + 4)}" r="${r1(2 + i * 0.25)}" ${A(fg, 0.3)}/>`).join(''); };
const MOTIF = { flight: [flight, null], train: [train, null], membership: [dots, holo], other: [dots], concert: [rings, spots], hotel: [windows, doors], match: [pitch, bowl],
    movie: [beam, premiere], museum: [columns, rosette], bus: [route, lanes], ferry: [waves, depths], theater: [arches, diamonds], park: [wheel, coaster] };
const seedOf = id => [...String(id || '')].reduce((h, c) => h + c.charCodeAt(0), 0);
export function passMotif(k, fg, op, id) {
    const xs = MOTIF[k] || MOTIF.other, f = xs[seedOf(id) % xs.length];
    return f ? f(fg, op, `pa${String(id || '').replace(/[^\w-]/g, '')}`) : null;
}
