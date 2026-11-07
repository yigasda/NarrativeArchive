// 캐릭터 휴대폰 · 다녀간 곳 지도 확대: two fingers pinch the map (1× to 3×), one finger moves it once it is bigger,
// a double tap zooms in or back; on a computer ctrl + wheel (a trackpad pinch) and dragging with the mouse.
// How it stays quick on a phone (the way a game map does it):
//  - right after a map is shown, it is copied once into a picture kept off the page (the screen's own sharpness;
//    the last few maps keep theirs); fingers down before it is ready and the map waits for it, never the slow way;
//  - while fingers move, nothing on the page changes: the part in view is painted from that picture into one canvas,
//    and the pins are painted on it too. (Changing anything on the page each move — a style, an attribute — makes the
//    browser work out the whole phone's styles again, because of the :has() rules the theme guard needs: 40 ms a
//    move on a slow phone, which is what made it feel a second or more behind);
//  - when they let go, the real map (its viewBox) and the pins are put where the picture was, once.
// The map never moves past its own edges; the pins keep their size. Not zoomed, one finger still scrolls the sheet
// (touch-action pan-y). Either finger on the map starts a pinch. A redraw of the same map (data-z) keeps the zoom.
import { PIN } from './phonemapart.js';

const MAX = 3;
let last = null; // { z, s, tx, ty }

const onMap = (x, y, target) => {
    if (!target?.closest || target.closest('button, a, input, [contenteditable], .mp_sheet, .mq_sheet, .mq_fc, .mq_hc, .ax_top, .ax_sb')) return null;
    const svg = target.closest('.mp_wx')?.querySelector('.mp_bg > svg.mp_art[data-z]');
    if (!svg) return null;
    const r = svg.parentElement.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom ? svg : null;
};
// map units ↔ the screen, measured on the map's frame (.mp_bg), which never moves
const box = svg => { const W = svg._W || (svg._W = svg.viewBox.baseVal.width), H = svg._H || (svg._H = svg.viewBox.baseVal.height); return { W, H, r: svg.parentElement.getBoundingClientRect() }; };
const st = svg => svg._z || (svg._z = { s: 1, tx: 0, ty: 0 });
const clamp = (svg, s, tx, ty) => { const { W, H } = box(svg); s = Math.min(MAX, Math.max(1, s)); return { s, tx: Math.min(0, Math.max(W - W * s, tx)), ty: Math.min(0, Math.max(H - H * s, ty)) }; };

// the picture (off the page, kept for the last few maps) and the canvas it is painted into (on the page, mid-gesture)
const PICS = new Map(); // data-z → canvas
function prepare(svg) {
    if (svg._view || svg._making || !svg.isConnected) return;
    svg._making = true;
    const { W, H, r } = box(svg), dpr = window.devicePixelRatio || 1;
    const done = src => {
        if (!svg.isConnected) return;
        PICS.delete(svg.dataset.z); PICS.set(svg.dataset.z, src);
        while (PICS.size > 6) PICS.delete(PICS.keys().next().value);
        const view = document.createElement('canvas');
        view.width = Math.round(r.width * dpr); view.height = Math.round(r.width * dpr * H / W);
        view.className = 'mp_pic';
        view.setAttribute('aria-hidden', 'true');
        view.style.cssText = 'position: absolute; left: 0; top: 0; width: 100%; height: auto; visibility: hidden; pointer-events: none;';
        svg.after(view);
        svg._src = src; svg._view = view;
        if (svg._gest) live(svg); // fingers were already on it: it moves from now on
    };
    const kept = PICS.get(svg.dataset.z);
    if (kept) return done(kept);
    // the screen's own sharpness (zoomed in it is a little soft only while moving; let go and the real map is sharp)
    const R = Math.min(r.width / W * dpr, 1400 / W), w = Math.round(W * R), h = Math.round(H * R);
    const url = URL.createObjectURL(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${w}" height="${h}">${svg.innerHTML}</svg>`], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
        URL.revokeObjectURL(url);
        if (!svg.isConnected) return;
        const src = document.createElement('canvas');
        src.width = w; src.height = h;
        src.getContext('2d').drawImage(img, 0, 0, w, h);
        done(src);
    };
    img.onerror = () => { URL.revokeObjectURL(url); svg._making = false; };
    img.src = url;
}
// right after the map shows, as soon as the phone has a moment
const soon = svg => (window.requestIdleCallback || (f => setTimeout(f, 120)))(() => prepare(svg), { timeout: 250 });

// the pins as they are on the page, read once a gesture
function pinList(svg) {
    const t = svg.parentElement.querySelector('.mp_pins text'), cs = t ? getComputedStyle(t) : null;
    return {
        list: [...svg.parentElement.querySelectorAll('.mp_pins .mp_pin')].map(g => ({ x: Number(g.dataset.x), y: Number(g.dataset.y), label: g.querySelector('text')?.textContent || '' })),
        fill: getComputedStyle(svg.parentElement).getPropertyValue('--axd').trim() || '#2f6bff',
        ink: cs?.fill || '#161b22', halo: cs?.stroke || '#f2efe8', font: cs ? `${cs.fontWeight} 12px ${cs.fontFamily}` : '600 12px sans-serif',
    };
}
const PATH = typeof Path2D === 'function' ? new Path2D(PIN) : null;
// mid-gesture: paint the part in view, and the pins, into the canvas — nothing on the page changes
function paint(svg, z) {
    const view = svg._view, src = svg._src, { W, H } = box(svg), c = view.getContext('2d'), f = view.width / W, q = src.width / W;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(src, (-z.tx / z.s) * q, (-z.ty / z.s) * q, (W / z.s) * q, (H / z.s) * q, 0, 0, view.width, view.height);
    const P = svg._pins;
    if (!P || !PATH) return;
    c.font = P.font; c.lineJoin = 'round';
    for (const p of P.list) {
        const x = z.tx + z.s * p.x, y = z.ty + z.s * p.y;
        c.setTransform(1.5 * f, 0, 0, 1.5 * f, (x - 18) * f, (y - 34) * f);
        c.fillStyle = P.fill; c.fill(PATH); c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.stroke(PATH);
        c.beginPath(); c.arc(12, 10, 2.4, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
        if (!p.label) continue;
        c.setTransform(f, 0, 0, f, (x + 13) * f, (y - 18) * f);
        c.lineWidth = 3; c.strokeStyle = P.halo; c.strokeText(p.label, 0, 0); c.fillStyle = P.ink; c.fillText(p.label, 0, 0);
    }
}
// the page itself: the real map showing just what is in view, the pins where their spots went (once, at the end)
function place(svg, { s, tx, ty }) {
    const { W, H } = box(svg);
    svg.setAttribute('viewBox', s === 1 ? `0 0 ${W} ${H}` : `${(-tx / s).toFixed(3)} ${(-ty / s).toFixed(3)} ${(W / s).toFixed(3)} ${(H / s).toFixed(3)}`);
    for (const g of svg.parentElement.querySelectorAll('.mp_pins .mp_pin')) {
        const x = Number(g.dataset.x), y = Number(g.dataset.y);
        g.setAttribute('transform', s === 1 ? '' : `translate(${(tx + (s - 1) * x).toFixed(2)} ${(ty + (s - 1) * y).toFixed(2)})`);
    }
    svg.closest('.mp_wx')?.classList.toggle('mp_zoomed', s > 1);
}
const pinsLayer = svg => svg.parentElement.querySelector('.mp_pins');
function live(svg) {
    svg._live = true; svg._pins = pinList(svg);
    paint(svg, st(svg));
    svg._view.style.visibility = 'visible'; svg.style.visibility = 'hidden';
    const pl = pinsLayer(svg); if (pl) pl.style.visibility = 'hidden';
}
// fingers down: the picture moves; if it is not made yet, the map waits for it (never the slow page moves)
function begin(svg) {
    if (svg._gest) return;
    svg._gest = true;
    if (svg._view) live(svg); else prepare(svg);
}
function move(svg, s, tx, ty) {
    const z = clamp(svg, s, tx, ty);
    Object.assign(st(svg), z);
    last = { z: svg.dataset.z, ...z };
    if (svg._live) paint(svg, z); else if (!svg._gest) place(svg, z);
}
// let go: the page is put where the picture was, once; the canvas goes away the frame after
function settle(svg) {
    svg._gest = false;
    place(svg, st(svg));
    if (!svg._live) return;
    svg._live = false;
    svg.style.visibility = ''; const pl = pinsLayer(svg); if (pl) pl.style.visibility = '';
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!svg._live) svg._view.style.visibility = 'hidden'; }));
}
const jump = (svg, s, tx, ty) => { move(svg, s, tx, ty); settle(svg); };
// zoom to s keeping the map point under (cx, cy) on screen where it is
function zoomAt(svg, s, cx, cy, from = st(svg), go = move) {
    const { W, r } = box(svg), k = W / r.width, u = (cx - r.left) * k, v = (cy - r.top) * k;
    const wx = (u - from.tx) / from.s, wy = (v - from.ty) / from.s, n = Math.min(MAX, Math.max(1, s));
    go(svg, n, u - wx * n, v - wy * n);
}

export function mapZoom(root) {
    let g = null; // the gesture: { svg, mode: 'pinch' | 'pan' | 'wait', ... }
    const mid = t => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1;
    root.addEventListener('touchstart', e => {
        const t = e.touches;
        const svg = g?.svg || [...t].map(x => onMap(x.clientX, x.clientY, x.target)).find(Boolean);
        if (!svg) return;
        if (t.length >= 2) { const [cx, cy] = mid(t); g = { svg, mode: 'pinch', d0: dist(t), cx, cy, from: { ...st(svg) }, k: box(svg).W / box(svg).r.width, r: box(svg).r }; begin(svg); e.preventDefault(); }
        else if (st(svg).s > 1) { g = { svg, mode: 'pan', x: t[0].clientX, y: t[0].clientY, from: { ...st(svg) }, k: box(svg).W / box(svg).r.width }; begin(svg); e.preventDefault(); }
        else g = { svg, mode: 'wait' };
    }, { passive: false, capture: true });
    root.addEventListener('touchmove', e => {
        if (!g || g.mode === 'wait') return;
        if (e.cancelable) e.preventDefault();
        const t = e.touches, k = g.k;
        if (g.mode === 'pinch' && t.length >= 2) {
            const [cx, cy] = mid(t), f = g.from, s = Math.min(MAX, Math.max(1, f.s * dist(t) / g.d0));
            const u = (g.cx - g.r.left) * k, v = (g.cy - g.r.top) * k;
            move(g.svg, s, u - (u - f.tx) / f.s * s + (cx - g.cx) * k, v - (v - f.ty) / f.s * s + (cy - g.cy) * k);
        } else if (g.mode === 'pan' && t.length === 1) move(g.svg, g.from.s, g.from.tx + (t[0].clientX - g.x) * k, g.from.ty + (t[0].clientY - g.y) * k);
    }, { passive: false, capture: true });
    const end = e => {
        if (!g) return;
        const t = e.touches;
        if (g.mode === 'pinch' && t.length === 1 && st(g.svg).s > 1) g = { svg: g.svg, mode: 'pan', x: t[0].clientX, y: t[0].clientY, from: { ...st(g.svg) }, k: g.k };
        else if (!t.length) { if (g.mode !== 'wait') settle(g.svg); g = null; }
    };
    root.addEventListener('touchend', end, true);
    root.addEventListener('touchcancel', end, true);
    // a double tap (or double click): in to 2× where it was tapped, or back to the whole map
    root.addEventListener('dblclick', e => {
        const svg = onMap(e.clientX, e.clientY, e.target);
        if (!svg) return;
        e.preventDefault();
        if (st(svg).s > 1) jump(svg, 1, 0, 0); else zoomAt(svg, 2, e.clientX, e.clientY, st(svg), jump);
    });
    // a computer: ctrl + wheel is a trackpad pinch; a zoomed map drags with the mouse
    let still = 0;
    root.addEventListener('wheel', e => {
        if (!e.ctrlKey) return;
        const svg = onMap(e.clientX, e.clientY, e.target);
        if (!svg) return;
        e.preventDefault();
        begin(svg);
        zoomAt(svg, st(svg).s * Math.exp(-e.deltaY / 200), e.clientX, e.clientY);
        clearTimeout(still); still = setTimeout(() => settle(svg), 200);
    }, { passive: false });
    let drag = null;
    root.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        const svg = onMap(e.clientX, e.clientY, e.target);
        if (!svg || st(svg).s === 1) return;
        drag = { svg, x: e.clientX, y: e.clientY, from: { ...st(svg) }, k: box(svg).W / box(svg).r.width };
        begin(svg);
        e.preventDefault();
    });
    root.addEventListener('pointermove', e => {
        if (drag) move(drag.svg, drag.from.s, drag.from.tx + (e.clientX - drag.x) * drag.k, drag.from.ty + (e.clientY - drag.y) * drag.k);
    });
    root.addEventListener('pointerup', () => { if (drag) settle(drag.svg); drag = null; });
    // a map just shown: its picture is made when the phone is idle; the same map drawn again keeps its zoom
    new MutationObserver(() => {
        const svg = root.querySelector('.mp_bg > svg.mp_art[data-z]');
        if (!svg || svg._seen) return;
        svg._seen = true;
        soon(svg);
        if (!last || last.s === 1) return;
        if (svg.dataset.z === last.z) jump(svg, last.s, last.tx, last.ty); else last = null;
    }).observe(root, { childList: true, subtree: true });
}
