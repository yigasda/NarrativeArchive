// 지갑 표의 가는 선 무늬: 종류마다 다른 그림 한 장(viewBox 340×200, 오른쪽에 붙여 그려요). 시안 docs/mockups/phone-passes/gen2.py,
// 소망이 동그라미 친 것만 있어요. 둘 다 합격한 종류는 표 id로 둘 중 하나를 골라요(늘 같은 표는 같은 무늬)
const r1 = v => Math.round(v * 10) / 10;
const S = (fg, op, w = 0.8) => `stroke="${fg}" stroke-opacity="${r1(op * 100) / 100}" fill="none" stroke-width="${w}"`;
const range = (a, b, s = 1) => { const o = []; for (let v = a; s > 0 ? v < b : v > b; v += s) o.push(v); return o; };
const P = (d, a) => `<path d="${d}" ${a}/>`;
const cos = Math.cos, sin = Math.sin, PI = Math.PI;
const flight = (fg, op) => {
    const s = S(fg, op), cx = 270, cy = 150, r = 120;
    return range(0, 90, 15).map(a => `<ellipse cx="${cx}" cy="${cy}" rx="${r1(r * Math.abs(cos(a / 180 * PI)))}" ry="${r}" ${s}/>`).join('')
        + [-45, -20, 0, 20, 45].map(a => `<path d="M${cx - r} ${r1(cy - r * sin(a / 180 * PI))} H${cx + r}" ${s}/>`).join('')
        + `<path d="M140 70 Q240 30 330 95" ${S(fg, op * 2.2, 1.1)} stroke-dasharray="2 4"/><circle cx="140" cy="70" r="2.4" fill="${fg}" fill-opacity="${r1(op * 250) / 100}"/>`;
};
const train = (fg, op) => P(range(0, 10).map(i => `M330 118L-20 ${-40 + i * 34}`).join(''), S(fg, op, 0.7));
const dots = (fg, op) => range(0, 12).flatMap(c => range(0, 12).map(r => `<circle cx="${150 + c * 16}" cy="${12 + r * 16}" r="${r1((0.6 + (c + r) * 0.12) * 100) / 100}" fill="${fg}" fill-opacity="${r1(op * 160) / 100}"/>`)).join('');
const rings = (fg, op) => range(1, 13).map(i => `<circle cx="300" cy="128" r="${i * 16}" ${S(fg, op, 0.7)}/>`).join('');
const spots = (fg, op) => P([240, 320].map((x, k) => range(0, 6).map(i => `M${x} -10L${(k ? 290 : 210) + i * 16} 210`).join('')).join(''), S(fg, op, 0.7));
const windows = (fg, op) => range(0, 7).flatMap(c => range(0, 6).map(r => `<rect x="${192 + c * 22}" y="${30 + r * 26}" width="10" height="14" rx="5" ${S(fg, op * 0.8, 0.7)}/>`)).join('');
const doors = (fg, op) => range(0, 6).map(i => `<path d="M${244 - i * 14} 210V${110 - i * 6}a${36 + i * 14} ${36 + i * 14} 0 0 1 ${72 + i * 28} 0V210" ${S(fg, op, 0.7)}/>`).join('');
const pitch = (fg, op) => { const s = S(fg, op, 0.7); return `<rect x="176" y="40" width="300" height="150" ${s}/>` + P('M290 40V190M176 82H212V148H176', s) + `<circle cx="290" cy="115" r="30" ${s}/>`; };
const bowl = (fg, op) => range(0, 6).map(i => `<rect x="${215 - i * 14}" y="${95 - i * 12}" width="${140 + i * 28}" height="${50 + i * 24}" rx="${25 + i * 12}" ${S(fg, op, 0.7)}/>`).join('');
const beam = (fg, op) => P(range(0, 12).map(i => `M350 0L${120 + i * 20} 210`).join(''), S(fg, op, 0.7)) + `<circle cx="350" cy="0" r="9" ${S(fg, op, 0.7)}/>`;
const columns = (fg, op) => P(range(0, 4).flatMap(c => range(0, 5).map(i => `M${196 + c * 42 + i * 5} 62V186`)).join('') + 'M186 56H360M186 192H360', S(fg, op, 0.7));
const route = (fg, op) => {
    const pts = [[200, 168], [232, 168], [254, 142], [290, 142], [312, 116], [350, 116]];
    return P(`M${pts.map(q => q.join(' ')).join('L')}`, `${S(fg, op * 2, 1.2)} stroke-linejoin="round"`) + pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" ${S(fg, op * 2, 1)}/>`).join('');
};
const lanes = (fg, op) => P('M266 60L170 210M294 60L390 210M180 60H380', S(fg, op, 0.7)) + P(range(1, 5).map(i => i * 0.15).map(t => `M280 ${r1(60 + t * t * 150)}V${r1(60 + (t + 0.07) ** 2 * 150)}`).join(''), S(fg, op * 2, 1.6));
const waves = (fg, op) => P(range(0, 9).map(r => { const y = 48 + r * 18; return `M170 ${y}${range(0, 6).map(() => 'q10 -4 20 0t20 0').join('')}`; }).join(''), S(fg, op, 0.7));
const arches = (fg, op) => range(0, 6).map(i => `<path d="M${226 - i * 16} 210V${132 - i * 4}a${54 + i * 16} ${54 + i * 16} 0 0 1 ${108 + i * 32} 0V210" ${S(fg, op, 0.7)}/>`).join('');
const wheel = (fg, op) => {
    const s = S(fg, op, 0.7), cx = 290, cy = 112, R = 62, at = a => [r1(cx + R * cos(a * PI / 8)), r1(cy + R * sin(a * PI / 8))];
    return `<circle cx="${cx}" cy="${cy}" r="${R}" ${s}/>` + P(range(0, 16).map(a => { const [x, y] = at(a); return `M${cx} ${cy}L${x} ${y}`; }).join('') + `M${cx} ${cy}L${cx - 36} 210M${cx} ${cy}L${cx + 36} 210`, s) + range(0, 16).map(a => { const [x, y] = at(a); return `<circle cx="${x}" cy="${y}" r="3.2" ${s}/>`; }).join('');
};
const coaster = (fg, op) => {
    const f = q => [170 + q * 210, 140 - 50 * sin(q * PI * 2.2) * (1 - q * 0.3)], t = range(0, 41).map(i => i / 40);
    const line = dy => `M${t.map(q => { const [x, y] = f(q); return `${r1(x)} ${r1(y + dy)}`; }).join('L')}`;
    return P(line(0) + line(8), S(fg, op * 1.4, 0.7)) + P(t.filter((_, i) => i % 2 === 0).map(q => { const [x, y] = f(q); return `M${r1(x)} ${r1(y)}v8`; }).join(''), S(fg, op, 0.7))
        + P(t.filter((_, i) => i % 5 === 0).map(q => { const [x, y] = f(q); return `M${r1(x)} ${r1(y + 8)}V210`; }).join(''), S(fg, op * 0.7, 0.7));
};
const diamonds = (fg, op) => P(range(-4, 8).map(i => `M${170 + i * 28} -10L${290 + i * 28} 210M${170 + i * 28} 210L${290 + i * 28} -10`).join(''), S(fg, op, 0.7));
const depths = (fg, op) => P(range(0, 8).map(i => `M${180 + i * 8} 210C${206 + i * 8} ${140 - i * 6} 268 ${160 - i * 12} ${304 - i * 2} ${98 - i * 8}S352 ${44 + i * 4} 372 ${30 + i * 14}`).join(''), S(fg, op, 0.7));
const rosette = (fg, op) => range(0, 12).map(a => `<circle cx="${r1(288 + 34 * cos(a * PI / 6))}" cy="${r1(118 + 34 * sin(a * PI / 6))}" r="34" ${S(fg, op, 0.7)}/>`).join('') + `<circle cx="288" cy="118" r="68" ${S(fg, op, 0.7)}/>`;
const premiere = (fg, op) => P(range(0, 16).map(a => `M${r1(288 + cos(a * PI / 8) * 18)} ${r1(122 + sin(a * PI / 8) * 18)}L${r1(288 + cos(a * PI / 8) * 110)} ${r1(122 + sin(a * PI / 8) * 110)}`).join(''), S(fg, op, 0.7))
    + P(range(0, 8).map(a => `M${r1(288 + cos(a * PI / 4 + 0.39) * 74)} ${r1(122 + sin(a * PI / 4 + 0.39) * 74 - 6)}l1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8z`).join(''), S(fg, op * 1.6, 0.7));
// a hologram strip down the membership card (the gradient id is the pass's own, so two cards never share one)
const holo = (fg, op, id) => { const g = `ph${String(id || '').replace(/[^\w-]/g, '')}`; return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd1f0"/><stop offset=".35" stop-color="#c4f2ff"/><stop offset=".7" stop-color="#d9ffc9"/><stop offset="1" stop-color="#fff1b8"/></linearGradient></defs><rect x="262" y="-10" width="46" height="230" fill="url(#${g})" fill-opacity=".28"/>` + range(0, 12).map(i => `<path d="M${262 + i * 4} -10 V220" stroke="#fff" stroke-opacity=".12"/>`).join(''); };
// null: the plain look of the first wallet (an icon tile on top, the icon between the two places, no drawing)
const MOTIF = { flight: [flight, null], train: [train, null], membership: [dots, holo], other: [dots], concert: [rings, spots], hotel: [windows, doors], match: [pitch, bowl], movie: [beam, premiere],
    museum: [columns, rosette], bus: [route, lanes], ferry: [waves, depths], theater: [arches, diamonds], park: [wheel, coaster] };
// the sum of its letters: ids next to each other (p1, p2 …) take turns
const seedOf = id => [...String(id || '')].reduce((h, c) => h + c.charCodeAt(0), 0);
export function passMotif(k, fg, op, id) {
    const xs = MOTIF[k] || MOTIF.other, f = xs[seedOf(id) % xs.length];
    return f ? f(fg, op, id) : null;
}
