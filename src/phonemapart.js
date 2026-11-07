// 다녀간 곳's drawings: the town map (64 maps drawn whole, src/phonemaptowns.js), which one suits a town (the city table
// and its neighbourhood words, src/phonemapcity.js), the pins on it, and the month's day strip (a block for a stay).
// Everything is picked by names, never at random, so a town looks the same every time it opens.
// Plain SVG strings: phoneapps.js draws the screen around them.
import { TOWN_KINDS, townDraw } from './phonemaptowns.js';
import { CITY, CLUE, COMMON, HINT, PLACE } from './phonemapcity.js';

export const hsh = s => [...String(s)].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7);
const norm = s => String(s || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
// a word in a text: Latin words from a word start (so "port" finds "Portsmouth harbour" but not "airport"), the rest anywhere
const RX = new Map(), rx = w => { if (!RX.has(w)) RX.set(w, new RegExp(`(^|[^a-z\u00c0-\u024f])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)); return RX.get(w); };
const has = (text, w) => /^[a-z]/.test(w) ? rx(w).test(text) : text.includes(w);
// the city table's row for a town: its own name, or the longest of the row's names in it ("서울특별시" → 서울)
const ROWS = new Map();
function cityRow(city) {
    if (ROWS.has(city)) return ROWS.get(city);
    let best = null, len = 0;
    for (const row of CITY) for (const n of row[0]) {
        // a Latin name (4 letters or more) from a word start, a short one whole, any other script from the start
        // ("서울특별시" → 서울, "東京都" → 東京 and not 京都, "베니스" not 니스)
        const hit = city === n || (/^[a-z]/.test(n) ? n.length >= 4 && has(city, n) : city.startsWith(n));
        if (hit && n.length > len) { best = row; len = n.length; }
    }
    if (ROWS.size > 200) ROWS.clear();
    ROWS.set(city, best);
    return best;
}
// the city table's place for a town name (its own name or one of its others), else the first place of its row; -1 if none
export function townPlace(city) {
    const c = norm(city);
    if (!c) return -1;
    const own = PLACE.findIndex(([ko, al]) => norm(ko) === c || al.some(n => norm(n) === c));
    if (own >= 0) return own;
    const row = cityRow(c);
    return row ? PLACE.findIndex(x => CITY[x[2]] === row) : -1;
}
// the maps that suit a town, best first: the neighbourhoods its places name (most named first), words that suit a map
// wherever they are (a beach, a station, a castle), the town's own row, then the everyday maps
const PICKED = new Map();
export function townCandidates(city, places = []) {
    const c = norm(city), texts = places.map(norm), memo = `${c}\u0001${texts.join('\u0002')}`;
    if (PICKED.has(memo)) return PICKED.get(memo);
    const own = cityRow(c);
    let row = own;
    const score = new Map(), bump = (ks, n) => ks.forEach((k, i) => score.set(k, (score.get(k) || 0) + n * (1 - i * 0.04)));
    for (const [town, words, ks] of HINT) {
        const towns = town.split(' · ');
        const here = row && row[0].some(n => towns.includes(n));
        // a neighbourhood written as the city ("Hongdae"): its town's row, and the neighbourhood counts most
        const asCity = !own && !here && words.some(w => has(c, w));
        if (asCity && !row) row = cityRow(towns[0]);
        if (!here && !asCity) continue;
        const n = texts.filter(t => words.some(w => has(t, w))).length + (asCity ? 3 : 0);
        if (n) bump(ks, n);
    }
    for (const [words, ks] of CLUE) { const n = texts.filter(t => words.some(w => has(t, w))).length; if (n) bump(ks, n * 0.6); }
    const first = [...score].sort((a, b) => b[1] - a[1]).map(([k]) => k), turn = hsh(c) % COMMON.length;
    const out = [...new Set([...first, ...(row ? row[1] : []), ...COMMON.slice(turn), ...COMMON.slice(0, turn)])];
    if (PICKED.size > 100) PICKED.clear();
    PICKED.set(memo, out);
    return out;
}
// each town its own map: the best one no other town has taken; `towns` ({ key, city, places }) in the order they were
// first visited, so an older town keeps its map when a new town comes
export function townKinds(towns) {
    const out = new Map(), used = new Set();
    for (const t of towns) {
        const cands = townCandidates(t.city, t.places), turn = hsh(t.key) % TOWN_KINDS.length;
        const k = cands.find(x => !used.has(x)) || [...TOWN_KINDS.slice(turn), ...TOWN_KINDS.slice(0, turn)].find(x => !used.has(x)) || cands[0];
        out.set(t.key, k); used.add(k);
    }
    return out;
}
// the town (dark for a night visit); `hint` is the places' names, for the maps that pick a sheet by them (Egypt).
// A drawing is kept for the next time the screen opens
const drawn = new Map();
export function townSvg(kind, W, H, seed, dark = false, hint = '') {
    const key = `${kind}|${W}|${H}|${seed}|${dark}|${hint}`;
    if (!drawn.has(key)) { if (drawn.size >= 24) drawn.delete(drawn.keys().next().value); drawn.set(key, townDraw(kind, W, H, seed, dark, hint)); }
    return drawn.get(key);
}
const PIN = 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function pinSvg(x, y, label, dark) {
    const t = label.length > 20 ? `${label.slice(0, 19)}…` : label;
    return `<g transform="translate(${(x - 18).toFixed(1)} ${(y - 34).toFixed(1)}) scale(1.5)"><path d="${PIN}" fill="var(--axd)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.4" fill="#fff"/></g>`
        + (t ? `<text x="${(x + 13).toFixed(1)}" y="${(y - 18).toFixed(1)}" class="mp_pl${dark ? ' dk' : ''}">${esc(t)}</text>` : '');
}
// pins down the visible land in order (newest on top), sideways by the place's name; a coast keeps them off the sea
export function pinSpots(names, W, top, bottom) {
    return names.map((n, k) => [36 + (hsh(n) % 1000) / 1000 * (W - 170), names.length > 1 ? top + (bottom - top) * k / (names.length - 1) : (top + bottom) / 2]);
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
