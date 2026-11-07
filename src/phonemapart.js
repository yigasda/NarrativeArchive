// 다녀간 곳's drawings (the approved board, docs/mockups/phone-map/journey-map.html A): a town map whose streets come
// from the town's name (old-town lanes, a grid by a lake, rings and spokes, a coast), the pins on it, and the month's day
// strip (a block for a stay). Everything is picked by a name hash, so a town looks the same every time it opens.
// Plain SVG strings, no imports: phoneapps.js draws the screen around them.

export const hsh = s => [...String(s)].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7);
const rng = seed => { let s = hsh(seed) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
const KINDS = ['old', 'grid', 'ring', 'coast'];
// each town its own street pattern: the name picks one, and one another town already wears moves on to the next free
// one (so three towns never look alike); `towns` in the order they were first visited
export function townKinds(towns) {
    const out = new Map(), used = [];
    for (const t of towns) {
        let k = hsh(t) % 4;
        for (let n = 0; n < 4 && used.includes(KINDS[k]) && used.length < 4; n++) k = (k + 1) % 4;
        out.set(t, KINDS[k]); used.push(KINDS[k]);
        if (used.length === 4) used.length = 0;
    }
    return out;
}

// the town: land, blocks, parks, water, streets (a white road on a slightly darker edge); dark for a night visit
export function townSvg(kind, W, H, seed, dark = false) {
    const r = rng(`${kind}:${seed}`), o = [];
    const land = dark ? '#1f2630' : '#f2efe8', blk = dark ? '#28303b' : '#e9e5dc', park = dark ? '#233a2f' : '#d5e8cc', water = dark ? '#1c3550' : '#c4daee', road = dark ? '#3a4452' : '#fff', edge = dark ? '#151a21' : '#ddd8ce';
    o.push(`<rect width="${W}" height="${H}" fill="${land}"/>`);
    const way = (d, w) => `<path d="${d}" fill="none" stroke="${edge}" stroke-width="${w + 3}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${road}" stroke-width="${w}" stroke-linecap="round"/>`;
    const f = n => n.toFixed(1);
    if (kind === 'old') { // a river town: soft blocks between bending lanes
        for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H; o.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(30 + r() * 46)}" height="${f(22 + r() * 34)}" rx="${f(8 + r() * 8)}" fill="${r() < 0.18 ? park : blk}" transform="rotate(${Math.round(r() * 40 - 20)} ${f(x)} ${f(y)})"/>`); }
        o.push(`<path d="M-20 ${f(H * 0.7)} C${f(W * 0.25)} ${f(H * 0.5)} ${f(W * 0.45)} ${f(H * 0.92)} ${f(W * 0.7)} ${f(H * 0.66)} S${W + 20} ${f(H * 0.56)} ${W + 20} ${f(H * 0.6)}" stroke="${water}" stroke-width="24" fill="none"/>`);
        for (let i = 0; i < 6; i++) { const y = r() * H; o.push(way(`M-20 ${f(y)} C${f(W * 0.3)} ${f(y + (r() - 0.5) * 90)} ${f(W * 0.6)} ${f(y + (r() - 0.5) * 90)} ${W + 20} ${f(y + (r() - 0.5) * 60)}`, 4 + r() * 3)); }
        for (let i = 0; i < 4; i++) { const x = r() * W; o.push(way(`M${f(x)} -20 C${f(x + (r() - 0.5) * 80)} ${f(H * 0.4)} ${f(x + (r() - 0.5) * 80)} ${f(H * 0.7)} ${f(x + (r() - 0.5) * 60)} ${H + 20}`, 4)); }
    } else if (kind === 'grid') { // long avenues, short streets, one park block, a lake on one side
        const cw = 58, ch = 26, px = Math.floor(r() * 4) * cw, side = r() < 0.5;
        for (let x = -10; x < W; x += cw) for (let y = -10; y < H; y += ch) o.push(`<rect x="${x + 4}" y="${y + 3}" width="${cw - 8}" height="${ch - 6}" rx="3" fill="${Math.abs(x + 10 - px) < 1 && y > 30 && y < 120 ? park : blk}"/>`);
        o.push(side ? `<path d="M${f(W * 0.8)} -10 Q${f(W * 0.72)} ${f(H * 0.5)} ${f(W * 0.84)} ${H + 10} H${W + 10} V-10Z" fill="${water}"/>` : `<path d="M${f(W * 0.2)} -10 Q${f(W * 0.28)} ${f(H * 0.5)} ${f(W * 0.16)} ${H + 10} H-10 V-10Z" fill="${water}"/>`);
        o.push(way(`M-10 ${f(H * (0.25 + r() * 0.2))} L${W + 10} ${f(H * (0.1 + r() * 0.2))}`, 7));
    } else if (kind === 'ring') { // rings and spokes around a square
        const cx = W * (0.4 + r() * 0.2), cy = H * (0.45 + r() * 0.1);
        for (let i = 0; i < 60; i++) { const a = r() * 6.28, d = 30 + r() * Math.max(W, H) * 0.7, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; o.push(`<rect x="${f(x - 14)}" y="${f(y - 10)}" width="${f(22 + r() * 18)}" height="${f(14 + r() * 14)}" rx="4" fill="${r() < 0.12 ? park : blk}" transform="rotate(${Math.round(a * 57)} ${f(x)} ${f(y)})"/>`); }
        for (const rr of [44, 96, 160]) o.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${rr}" fill="none" stroke="${edge}" stroke-width="${rr < 50 ? 9 : 7}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${rr}" fill="none" stroke="${road}" stroke-width="${rr < 50 ? 6 : 4.5}"/>`);
        const turn = r();
        for (let k = 0; k < 8; k++) { const a = k * 0.785 + turn; o.push(way(`M${f(cx)} ${f(cy)} L${f(cx + Math.cos(a) * 520)} ${f(cy + Math.sin(a) * 520)}`, 5)); }
        o.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="18" fill="${park}"/>`);
    } else { // a bay: the sea takes the lower side, the streets bend with the shore
        for (let i = 0; i < 50; i++) { const x = r() * W, y = r() * H * 0.7; o.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(24 + r() * 30)}" height="${f(16 + r() * 20)}" rx="4" fill="${r() < 0.15 ? park : blk}"/>`); }
        o.push(`<path d="M-10 ${f(H * 0.78)} C${f(W * 0.3)} ${f(H * 0.62)} ${f(W * 0.55)} ${f(H * 0.96)} ${W + 10} ${f(H * 0.6)} V${H + 10} H-10Z" fill="${water}"/>`);
        o.push(`<path d="M-10 ${f(H * 0.75)} C${f(W * 0.3)} ${f(H * 0.59)} ${f(W * 0.55)} ${f(H * 0.93)} ${W + 10} ${f(H * 0.57)}" stroke="${dark ? '#3b3a33' : '#efe2c4'}" stroke-width="7" fill="none"/>`);
        for (let i = 0; i < 4; i++) o.push(way(`M-10 ${f(H * (0.08 + i * 0.13))} C${f(W * 0.3)} ${f(H * (0.0 + i * 0.13))} ${f(W * 0.55)} ${f(H * (0.22 + i * 0.13))} ${W + 10} ${f(H * (0.0 + i * 0.11))}`, i ? 4 : 7));
        for (let i = 0; i < 5; i++) { const x = W * (0.1 + i * 0.2); o.push(way(`M${f(x)} -10 L${f(x + 20)} ${f(H * 0.66)}`, 4)); }
    }
    return o.join('');
}

// a pin (the app's pindot: the pin outline, a small filled dot) filled in the app's blue, its place name beside it
const PIN = 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function pinSvg(x, y, label, dark) {
    const t = label.length > 20 ? `${label.slice(0, 19)}…` : label;
    return `<g transform="translate(${(x - 18).toFixed(1)} ${(y - 34).toFixed(1)}) scale(1.5)"><path d="${PIN}" fill="var(--axd)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.4" fill="#fff"/></g>`
        + (t ? `<text x="${(x + 13).toFixed(1)}" y="${(y - 18).toFixed(1)}" class="mp_pl${dark ? ' dk' : ''}">${esc(t)}</text>` : '');
}
// pins down the visible land in order (newest on top), sideways by the place's name; a coast keeps them off the sea
export function pinSpots(names, kind, W, top, bottom) {
    const b = kind === 'coast' ? Math.min(bottom, top + (bottom - top) * 0.75) : bottom;
    return names.map((n, k) => [36 + (hsh(n) % 1000) / 1000 * (W - 170), names.length > 1 ? top + (b - top) * k / (names.length - 1) : (top + b) / 2]);
}

// ---- the month strip: one track of the month's days, a rounded block for a stay (days in a row), today a dot under it
// blocks: [first day, last day, fill, go?]; labels: [day (may be .5), text, on, 'up' | 'down']; gap: [day, text] under the track
export const STAY = ['#b9cdfb', '#9db9fa', '#7fa6f7', '#5a8bf3', '#2f6bff']; // towns, first visited → now
export const BUSY = ['#eef0f3', '#cfdcfd', '#9db9fa', '#6a95f6', '#2f6bff']; // 0, 1, 2, 3, 4+ places that day
export function stripSvg({ days, today, blocks, labels = [] }, W = 326) {
    const cell = W / days, f = n => n.toFixed(1), up = labels.some(l => l[3] !== 'down'), down = labels.some(l => l[3] === 'down');
    const top = up ? 28 : 8, ax = top + 18 + (down ? 36 : 24), H = ax + 6;
    let s = `<rect x="0" y="${top}" width="${W}" height="18" rx="6" fill="#eef0f3"/>`;
    if (today && today < days) s += `<path d="M${f(today * cell)} ${top}H${W - 6}a6 6 0 0 1 6 6v6a6 6 0 0 1-6 6H${f(today * cell)}z" fill="#f6f7f9"/>`;
    for (const [a, b, fill] of blocks) { let x = (a - 1) * cell + 1, w = (b - a + 1) * cell - 2; if (w < cell * 1.6) { x -= (cell * 1.6 - w) / 2; w = cell * 1.6; } s += `<rect x="${f(Math.max(0, x))}" y="${top + 1.5}" width="${f(Math.min(w, W - Math.max(0, x)))}" height="15" rx="5" fill="${fill}"/>`; }
    if (today) s += `<circle cx="${f((today - 0.5) * cell)}" cy="${top + 25}" r="2.4" fill="#161b22"/>`;
    for (const [d, t, on, side] of labels) s += `<text x="${f((d - 0.5) * cell)}" y="${side === 'down' ? top + 38 : top - 8}" class="mp_sl${on ? ' on' : ''}">${esc(t)}</text>`;
    for (const d of [1, 10, 20, days]) s += `<text x="${f((d - 0.5) * cell)}" y="${ax}" class="mp_sx">${d}${d === 1 ? '일' : ''}</text>`;
    return { svg: `<svg class="mp_strip" viewBox="0 0 ${W} ${H}" width="100%" aria-hidden="true">${s}</svg>`, cell, top, H };
}
