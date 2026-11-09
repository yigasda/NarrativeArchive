// 지갑 표의 가는 선 무늬: 종류마다 다른 그림 한 장(viewBox 340×200, 오른쪽에 붙여 그려요). 시안 docs/mockups/phone-passes/gen2.py,
// 소망이 동그라미 친 것만 있어요. 둘 다 합격한 종류는 표 id로 둘 중 하나를 골라요(늘 같은 표는 같은 무늬)
const r1 = v => Math.round(v * 10) / 10;
const S = (fg, op, w = 0.8) => `stroke="${fg}" stroke-opacity="${r1(op * 100) / 100}" fill="none" stroke-width="${w}"`;
const range = (a, b, s = 1) => { const o = []; for (let v = a; s > 0 ? v < b : v > b; v += s) o.push(v); return o; };
const cos = Math.cos, sin = Math.sin, PI = Math.PI;
const flight = (fg, op) => {
    const s = S(fg, op), cx = 270, cy = 150, r = 120;
    return range(0, 90, 15).map(a => `<ellipse cx="${cx}" cy="${cy}" rx="${r1(r * Math.abs(cos(a / 180 * PI)))}" ry="${r}" ${s}/>`).join('')
        + [-45, -20, 0, 20, 45].map(a => `<path d="M${cx - r} ${r1(cy - r * sin(a / 180 * PI))} H${cx + r}" ${s}/>`).join('')
        + `<path d="M140 70 Q240 30 330 95" ${S(fg, op * 2.2, 1.1)} stroke-dasharray="2 4"/><circle cx="140" cy="70" r="2.4" fill="${fg}" fill-opacity="${r1(op * 250) / 100}"/>`;
};
const train = (fg, op) => range(-60, 300, 18).map(y => `<path d="M360 84 L-20 ${y}" ${S(fg, op)}/>`).join('');
const dots = (fg, op) => range(0, 12).flatMap(c => range(0, 12).map(r => `<circle cx="${150 + c * 16}" cy="${12 + r * 16}" r="${r1((0.6 + (c + r) * 0.12) * 100) / 100}" fill="${fg}" fill-opacity="${r1(op * 160) / 100}"/>`)).join('');
const rings = (fg, op) => range(14, 260, 13).map(r => `<circle cx="300" cy="100" r="${r}" ${S(fg, op)}/>`).join('');
const spots = (fg, op) => range(0, 10).map(i => `<path d="M230 -10 L${200 + i * 9} 210" ${S(fg, op)}/>`).join('') + range(0, 10).map(i => `<path d="M330 -10 L${250 + i * 9} 210" ${S(fg, op)}/>`).join('');
const windows = (fg, op) => range(0, 9).flatMap(c => range(0, 8).map(r => `<rect x="${170 + c * 20}" y="${14 + r * 24}" width="10" height="14" rx="5" ${S(fg, op * 0.6)}/>`)).join('');
const pitch = (fg, op) => { const s = S(fg, op); return `<rect x="150" y="10" width="300" height="180" ${s}/><path d="M260 10 V190" ${s}/><circle cx="260" cy="100" r="34" ${s}/><circle cx="260" cy="100" r="1.8" fill="${fg}" fill-opacity="${r1(op * 200) / 100}"/><rect x="380" y="50" width="70" height="100" ${s}/>`; };
const bowl = (fg, op) => range(0, 8).map(i => `<rect x="${180 - i * 14}" y="${60 - i * 14}" width="${200 + i * 28}" height="${80 + i * 28}" rx="${40 + i * 14}" ${S(fg, op)}/>`).join('');
const beam = (fg, op) => range(0, 18).map(i => `<path d="M345 -5 L${100 + i * 14} 210" ${S(fg, op)}/>`).join('') + `<circle cx="345" cy="-5" r="10" ${S(fg, op)}/>`;
const columns = (fg, op) => range(0, 4).flatMap(c => range(0, 6).map(i => `<path d="M${170 + c * 44 + i * 5} 30 V190" ${S(fg, op)}/>`)).join('') + `<path d="M160 24 H360 M160 196 H360" ${S(fg, op * 1.6)}/>`;
const route = (fg, op) => {
    const pts = [[200, 150], [228, 150], [250, 124], [286, 124], [308, 98], [350, 98]];
    return `<path d="M${pts.map(q => q.join(' ')).join(' L')}" ${S(fg, op * 2, 1.4)} stroke-linejoin="round"/>` + pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" ${S(fg, op * 2.4, 1.2)}/>`).join('');
};
// the lane dashes stop above the time in the bottom corner
const lanes = (fg, op) => `<path d="M250 40 L150 210 M290 40 L390 210" ${S(fg, op)}/>`
    + range(1, 6).map(i => i * 0.12).map(t => `<path d="M270 ${r1(40 + t * t * 170)} V${r1(40 + (t + 0.06) ** 2 * 170)}" stroke="${fg}" stroke-opacity="${r1(op * 200) / 100}" stroke-width="${r1(1 + t * 3)}"/>`).join('')
    + range(0, 4).map(i => `<path d="M150 ${40 - i * 8} H390" ${S(fg, op * 0.5)}/>`).join('');
const waves = (fg, op) => range(20, 200, 12).map(y => `<path d="M140 ${y} ${range(0, 12, 2).map(i => `Q${150 + i * 20} ${y - 5} ${160 + i * 20} ${y} T${180 + i * 20} ${y}`).join(' ')}" ${S(fg, op)}/>`).join('');
const arches = (fg, op) => range(0, 7).map(i => `<path d="M${200 - i * 14} 210 V${110 - i * 4} A${80 + i * 14} ${80 + i * 14} 0 0 1 ${360 + i * 14} ${110 - i * 4} V210" ${S(fg, op)}/>`).join('');
const wheel = (fg, op) => {
    const s = S(fg, op), cx = 280, cy = 96, at = a => [r1(cx + 78 * cos(a * PI / 12)), r1(cy + 78 * sin(a * PI / 12))];
    return `<circle cx="${cx}" cy="${cy}" r="78" ${s}/><circle cx="${cx}" cy="${cy}" r="70" ${s}/>` + range(0, 24).map(a => { const [x, y] = at(a); return `<path d="M${cx} ${cy} L${x} ${y}" ${s}/><circle cx="${x}" cy="${y}" r="4" ${s}/>`; }).join('') + `<path d="M${cx} ${cy} L${cx - 40} 210 M${cx} ${cy} L${cx + 40} 210" ${s}/>`;
};
const coaster = (fg, op) => {
    const f = u => [140 + u * 230, 120 - 60 * sin(u * PI * 2.2) * (1 - u * 0.3)], t = range(0, 61).map(i => i / 60);
    const line = dy => `M${t.map(u => { const [x, y] = f(u); return `${r1(x)} ${r1(y + dy)}`; }).join(' L')}`;
    return `<path d="${line(0)}" ${S(fg, op * 1.6)}/><path d="${line(10)}" ${S(fg, op * 1.6)}/>`
        + t.filter((_, i) => i % 2 === 0).map(u => { const [x, y] = f(u); return `<path d="M${r1(x)} ${r1(y)} v10" ${S(fg, op)}/>`; }).join('')
        + t.filter((_, i) => i % 6 === 0).map(u => { const [x, y] = f(u); return `<path d="M${r1(x)} ${r1(y + 10)} V210" ${S(fg, op * 0.6)}/>`; }).join('');
};
const doors = (fg, op) => range(0, 8).map(i => `<rect x="${230 - i * 12}" y="${30 - i * 12}" width="${80 + i * 24}" height="200" rx="${40 + i * 12}" ${S(fg, op)}/>`).join('');
const diamonds = (fg, op) => range(-3, 9).map(i => `<path d="M${150 + i * 24} -10 L${150 + i * 24 + 120} 210 M${150 + i * 24} 210 L${150 + i * 24 + 120} -10" ${S(fg, op)}/>`).join('');
const depths = (fg, op) => range(0, 10).map(i => `<path d="M${150 + i * 6} 200 C${180 + i * 8} ${120 - i * 6} 260 ${150 - i * 12} ${300 - i * 2} ${80 - i * 8} S350 ${20 + i * 4} 370 ${10 + i * 14}" ${S(fg, op)}/>`).join('');
const MOTIF = { flight: [flight], train: [train], membership: [dots], other: [dots], concert: [rings, spots], hotel: [windows, doors], match: [pitch, bowl], movie: [beam],
    museum: [columns], bus: [route, lanes], ferry: [waves, depths], theater: [arches, diamonds], park: [wheel, coaster] };
const seedOf = id => [...String(id || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 0);
export function passMotif(k, fg, op, id) {
    const xs = MOTIF[k] || MOTIF.other;
    return xs[seedOf(id) % xs.length](fg, op);
}
