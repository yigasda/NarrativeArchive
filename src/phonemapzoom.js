// 캐릭터 휴대폰 · 다녀간 곳 지도 확대: two fingers pinch the map (1× to 3×), one finger moves it once it is bigger,
// a double tap zooms in or back; on a computer ctrl + wheel (a trackpad pinch) and dragging with the mouse.
// How it stays quick on a phone (the way map apps do it):
//  - a little after a map is shown, it is copied once into a picture (a canvas, about the screen's own sharpness);
//  - while fingers move only that picture is moved and scaled (the town is never drawn again mid-gesture);
//  - when they let go, the real map is drawn once, sharp, showing just the part in view (its viewBox), never a
//    bigger-than-the-screen layer. Before the picture is ready a gesture moves the real map's viewBox instead.
// The pins (svg.mp_pins over it) keep their size and go where their spot went; the map never moves past its edges.
// Not zoomed, one finger still scrolls the sheet (touch-action pan-y). Either finger on the map starts a pinch.
// A redraw of the same map (data-z) keeps the zoom; another map starts whole.
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
const box = svg => { const W = svg._W || (svg._W = svg.viewBox.baseVal.width), H = svg._H || (svg._H = svg.viewBox.baseVal.height), bg = svg.parentElement; return { W, H, r: bg.getBoundingClientRect(), L: bg.offsetWidth / W }; };
const st = svg => svg._z || (svg._z = { s: 1, tx: 0, ty: 0 });
const clamp = (svg, s, tx, ty) => { const { W, H } = box(svg); s = Math.min(MAX, Math.max(1, s)); return { s, tx: Math.min(0, Math.max(W - W * s, tx)), ty: Math.min(0, Math.max(H - H * s, ty)) }; };

// the picture: the map copied once into a canvas, shown only while fingers move
function prepare(svg) {
    if (svg._pic || svg._making || !svg.isConnected) return;
    svg._making = true;
    const { W, H } = box(svg), R = Math.min((window.devicePixelRatio || 1) * 1.5, 1600 / W);
    const src = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${Math.round(W * R)}" height="${Math.round(H * R)}">${svg.innerHTML}</svg>`;
    const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' })), img = new Image();
    img.onload = () => {
        URL.revokeObjectURL(url);
        if (!svg.isConnected) return;
        const c = document.createElement('canvas');
        c.width = Math.round(W * R); c.height = Math.round(H * R);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.className = 'mp_pic';
        c.setAttribute('aria-hidden', 'true');
        c.style.cssText = 'position: absolute; left: 0; top: 0; width: 100%; height: auto; transform-origin: 0 0; will-change: transform; visibility: hidden; pointer-events: none;';
        svg.after(c);
        svg._pic = c;
    };
    img.onerror = () => { URL.revokeObjectURL(url); svg._making = false; };
    img.src = url;
}
const soon = svg => (window.requestIdleCallback || (f => setTimeout(f, 400)))(() => prepare(svg), { timeout: 1500 });

function pins(svg, { s, tx, ty }) {
    for (const g of svg.parentElement.querySelectorAll('.mp_pins .mp_pin')) {
        const x = Number(g.dataset.x), y = Number(g.dataset.y);
        g.setAttribute('transform', s === 1 ? '' : `translate(${(tx + (s - 1) * x).toFixed(2)} ${(ty + (s - 1) * y).toFixed(2)})`);
    }
}
// the real map showing just what is in view
function draw(svg, { s, tx, ty }) {
    const { W, H } = box(svg);
    svg.setAttribute('viewBox', s === 1 ? `0 0 ${W} ${H}` : `${(-tx / s).toFixed(3)} ${(-ty / s).toFixed(3)} ${(W / s).toFixed(3)} ${(H / s).toFixed(3)}`);
}
// mid-gesture: move the picture if there is one, else the real map
function move(svg, s, tx, ty) {
    const z = clamp(svg, s, tx, ty), pic = svg._pic;
    Object.assign(st(svg), z);
    if (pic) {
        const { L } = box(svg);
        if (pic.style.visibility !== 'visible') { pic.style.visibility = 'visible'; svg.style.visibility = 'hidden'; }
        pic.style.transform = `translate(${(z.tx * L).toFixed(2)}px, ${(z.ty * L).toFixed(2)}px) scale(${z.s.toFixed(4)})`;
    } else draw(svg, z);
    pins(svg, z);
    svg.closest('.mp_wx')?.classList.toggle('mp_zoomed', z.s > 1);
    last = { z: svg.dataset.z, ...z };
}
// let go: the real map, sharp, once
function settle(svg) {
    const z = st(svg), pic = svg._pic;
    draw(svg, z);
    if (pic && pic.style.visibility === 'visible') requestAnimationFrame(() => { svg.style.visibility = ''; pic.style.visibility = 'hidden'; });
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
    const unit = svg => { const { W, r } = box(svg); return W / r.width; };
    root.addEventListener('touchstart', e => {
        const t = e.touches;
        const svg = g?.svg || [...t].map(x => onMap(x.clientX, x.clientY, x.target)).find(Boolean);
        if (!svg) return;
        prepare(svg);
        if (t.length >= 2) { const [cx, cy] = mid(t); g = { svg, mode: 'pinch', d0: dist(t), cx, cy, from: { ...st(svg) } }; e.preventDefault(); }
        else if (st(svg).s > 1) { g = { svg, mode: 'pan', x: t[0].clientX, y: t[0].clientY, from: { ...st(svg) } }; e.preventDefault(); }
        else g = { svg, mode: 'wait' };
    }, { passive: false, capture: true });
    root.addEventListener('touchmove', e => {
        if (!g || g.mode === 'wait') return;
        if (e.cancelable) e.preventDefault();
        const t = e.touches, k = unit(g.svg);
        if (g.mode === 'pinch' && t.length >= 2) {
            const [cx, cy] = mid(t), f = g.from, s = Math.min(MAX, Math.max(1, f.s * dist(t) / g.d0));
            const { r } = box(g.svg), u = (g.cx - r.left) * k, v = (g.cy - r.top) * k;
            move(g.svg, s, u - (u - f.tx) / f.s * s + (cx - g.cx) * k, v - (v - f.ty) / f.s * s + (cy - g.cy) * k);
        } else if (g.mode === 'pan' && t.length === 1) move(g.svg, g.from.s, g.from.tx + (t[0].clientX - g.x) * k, g.from.ty + (t[0].clientY - g.y) * k);
    }, { passive: false, capture: true });
    const end = e => {
        if (!g) return;
        const t = e.touches;
        if (g.mode === 'pinch' && t.length === 1 && st(g.svg).s > 1) g = { svg: g.svg, mode: 'pan', x: t[0].clientX, y: t[0].clientY, from: { ...st(g.svg) } };
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
        prepare(svg);
        zoomAt(svg, st(svg).s * Math.exp(-e.deltaY / 200), e.clientX, e.clientY);
        clearTimeout(still); still = setTimeout(() => settle(svg), 200);
    }, { passive: false });
    let drag = null;
    root.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        const svg = onMap(e.clientX, e.clientY, e.target);
        if (!svg || st(svg).s === 1) return;
        drag = { svg, x: e.clientX, y: e.clientY, from: { ...st(svg) } };
        e.preventDefault();
    });
    root.addEventListener('pointermove', e => {
        if (!drag) return;
        const k = unit(drag.svg);
        move(drag.svg, drag.from.s, drag.from.tx + (e.clientX - drag.x) * k, drag.from.ty + (e.clientY - drag.y) * k);
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
