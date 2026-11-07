// 캐릭터 휴대폰 · 다녀간 곳 지도 확대: two fingers pinch the map (1× to 3×), one finger moves it once it is bigger,
// a double tap zooms in or back; on a computer ctrl + wheel (a trackpad pinch) and dragging with the mouse.
// Only the drawing (g.mp_zm) grows: the pins keep their size and move to where their spot went, and the map
// never moves past its own edges. Not zoomed, one finger still scrolls the sheet as before.
// A redraw of the same map (data-z) keeps the zoom.
const MAX = 3;
let last = null; // { z, s, tx, ty }

const svgAt = (root, x, y, target) => {
    if (target.closest?.('button, a, input, [contenteditable], .mp_sheet, .mq_sheet, .mq_fc, .mq_hc, .ax_top, .ax_sb')) return null;
    const svg = target.closest?.('.mp_wx')?.querySelector('.mp_bg > svg.mp_art');
    if (!svg || !svg.querySelector('.mp_zm') || !root.contains(svg)) return null;
    const r = svg.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom ? svg : null;
};
const box = svg => { const vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect(); return { W: vb.width, H: vb.height, k: vb.width / r.width, r }; };
const st = svg => svg._z || (svg._z = { s: 1, tx: 0, ty: 0 });

function apply(svg, s, tx, ty) {
    const { W, H } = box(svg);
    s = Math.min(MAX, Math.max(1, s));
    tx = Math.min(0, Math.max(W - W * s, tx));
    ty = Math.min(0, Math.max(H - H * s, ty));
    Object.assign(st(svg), { s, tx, ty });
    svg.querySelector('.mp_zm').setAttribute('transform', s === 1 ? '' : `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})`);
    for (const g of svg.querySelectorAll('.mp_pin')) {
        const x = Number(g.dataset.x), y = Number(g.dataset.y);
        g.setAttribute('transform', s === 1 ? '' : `translate(${(tx + (s - 1) * x).toFixed(2)} ${(ty + (s - 1) * y).toFixed(2)})`);
    }
    svg.closest('.mp_wx')?.classList.toggle('mp_zoomed', s > 1);
    last = { z: svg.dataset.z, s, tx, ty };
}
// zoom to s keeping the map point under (cx, cy) on screen where it is
function zoomAt(svg, s, cx, cy, from = st(svg)) {
    const { k, r } = box(svg), u = (cx - r.left) * k, v = (cy - r.top) * k;
    const wx = (u - from.tx) / from.s, wy = (v - from.ty) / from.s, n = Math.min(MAX, Math.max(1, s));
    apply(svg, n, u - wx * n, v - wy * n);
}

export function mapZoom(root) {
    let g = null; // the gesture: { svg, mode: 'pinch' | 'pan', ... }
    const mid = t => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1;
    root.addEventListener('touchstart', e => {
        const t = e.touches, svg = g?.svg || svgAt(root, t[0].clientX, t[0].clientY, e.target);
        if (!svg) return;
        if (t.length >= 2) { const [cx, cy] = mid(t); g = { svg, mode: 'pinch', d0: dist(t), cx, cy, from: { ...st(svg) } }; e.preventDefault(); }
        else if (st(svg).s > 1) { g = { svg, mode: 'pan', x: t[0].clientX, y: t[0].clientY, from: { ...st(svg) } }; e.preventDefault(); }
        else g = { svg, mode: 'wait' };
    }, { passive: false });
    root.addEventListener('touchmove', e => {
        if (!g || g.mode === 'wait') return;
        e.preventDefault();
        const t = e.touches, { k } = box(g.svg);
        if (g.mode === 'pinch' && t.length >= 2) {
            const [cx, cy] = mid(t);
            zoomAt(g.svg, g.from.s * dist(t) / g.d0, g.cx, g.cy, g.from);
            const s = st(g.svg); apply(g.svg, s.s, s.tx + (cx - g.cx) * k, s.ty + (cy - g.cy) * k);
        } else if (g.mode === 'pan' && t.length === 1) apply(g.svg, g.from.s, g.from.tx + (t[0].clientX - g.x) * k, g.from.ty + (t[0].clientY - g.y) * k);
    }, { passive: false });
    root.addEventListener('touchend', e => {
        if (!g) return;
        const t = e.touches;
        if (g.mode === 'pinch' && t.length === 1 && st(g.svg).s > 1) g = { svg: g.svg, mode: 'pan', x: t[0].clientX, y: t[0].clientY, from: { ...st(g.svg) } };
        else if (!t.length) g = null;
    });
    root.addEventListener('touchcancel', () => { g = null; });
    // a double tap (or double click): in to 2× where it was tapped, or back to the whole map
    root.addEventListener('dblclick', e => {
        const svg = svgAt(root, e.clientX, e.clientY, e.target);
        if (!svg) return;
        e.preventDefault();
        if (st(svg).s > 1) apply(svg, 1, 0, 0); else zoomAt(svg, 2, e.clientX, e.clientY);
    });
    // a computer: ctrl + wheel is a trackpad pinch; a zoomed map drags with the mouse
    root.addEventListener('wheel', e => {
        if (!e.ctrlKey) return;
        const svg = svgAt(root, e.clientX, e.clientY, e.target);
        if (!svg) return;
        e.preventDefault();
        zoomAt(svg, st(svg).s * Math.exp(-e.deltaY / 200), e.clientX, e.clientY);
    }, { passive: false });
    let drag = null;
    root.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        const svg = svgAt(root, e.clientX, e.clientY, e.target);
        if (!svg || st(svg).s === 1) return;
        drag = { svg, x: e.clientX, y: e.clientY, from: { ...st(svg) } };
        e.preventDefault();
    });
    root.addEventListener('pointermove', e => {
        if (!drag) return;
        const { k } = box(drag.svg);
        apply(drag.svg, drag.from.s, drag.from.tx + (e.clientX - drag.x) * k, drag.from.ty + (e.clientY - drag.y) * k);
    });
    root.addEventListener('pointerup', () => { drag = null; });
    // the same map drawn again (the phone redraws its screen) keeps its zoom
    new MutationObserver(() => {
        if (!last || last.s === 1) return;
        const svg = root.querySelector('.mp_bg > svg.mp_art');
        if (!svg || svg._z) return;
        if (svg.dataset.z === last.z) apply(svg, last.s, last.tx, last.ty); else last = null; // another map starts whole
    }).observe(root, { childList: true, subtree: true });
}
