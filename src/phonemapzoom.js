// 캐릭터 휴대폰 · 다녀간 곳 지도 확대: two fingers pinch the map (1× to 3×), one finger moves it once it is bigger,
// a double tap zooms in or back; on a computer ctrl + wheel (a trackpad pinch) and dragging with the mouse.
// The drawing (svg.mp_art) moves as a picture (a CSS transform on its own layer, so the phone doesn't draw the
// whole town again on every move); the pins (svg.mp_pins over it) keep their size and go where their spot went,
// and the map never moves past its own edges. Not zoomed, one finger still scrolls the sheet (touch-action pan-y).
// Two fingers count when either of them is on the map. A redraw of the same map (data-z) keeps the zoom.
const MAX = 3;
let last = null; // { z, s, tx, ty }

const onMap = (x, y, target) => {
    if (!target?.closest || target.closest('button, a, input, [contenteditable], .mp_sheet, .mq_sheet, .mq_fc, .mq_hc, .ax_top, .ax_sb')) return null;
    const svg = target.closest('.mp_wx')?.querySelector('.mp_bg > svg.mp_art[data-z]');
    if (!svg) return null;
    const r = svg.parentElement.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom ? svg : null;
};
// map units ↔ the screen: measured on the map's frame (.mp_bg), which never moves
const box = svg => { const vb = svg.viewBox.baseVal, bg = svg.parentElement; return { W: vb.width, H: vb.height, r: bg.getBoundingClientRect(), L: bg.offsetWidth / vb.width }; };
const st = svg => svg._z || (svg._z = { s: 1, tx: 0, ty: 0 });

function apply(svg, s, tx, ty) {
    const { W, H, L } = box(svg);
    s = Math.min(MAX, Math.max(1, s));
    tx = Math.min(0, Math.max(W - W * s, tx));
    ty = Math.min(0, Math.max(H - H * s, ty));
    Object.assign(st(svg), { s, tx, ty });
    svg.style.transform = s === 1 ? '' : `translate(${(tx * L).toFixed(2)}px, ${(ty * L).toFixed(2)}px) scale(${s.toFixed(4)})`;
    for (const g of svg.parentElement.querySelectorAll('.mp_pins .mp_pin')) {
        const x = Number(g.dataset.x), y = Number(g.dataset.y);
        g.setAttribute('transform', s === 1 ? '' : `translate(${(tx + (s - 1) * x).toFixed(2)} ${(ty + (s - 1) * y).toFixed(2)})`);
    }
    svg.closest('.mp_wx')?.classList.toggle('mp_zoomed', s > 1);
    last = { z: svg.dataset.z, s, tx, ty };
}
// zoom to s keeping the map point under (cx, cy) on screen where it is
function zoomAt(svg, s, cx, cy, from = st(svg)) {
    const { W, r } = box(svg), k = W / r.width, u = (cx - r.left) * k, v = (cy - r.top) * k;
    const wx = (u - from.tx) / from.s, wy = (v - from.ty) / from.s, n = Math.min(MAX, Math.max(1, s));
    apply(svg, n, u - wx * n, v - wy * n);
}
// while it moves it is a picture on its own layer; once still it is drawn sharp again at its new size
const moving = (svg, on) => { svg.style.willChange = on ? 'transform' : st(svg).s > 1 ? 'auto' : ''; };

export function mapZoom(root) {
    let g = null; // the gesture: { svg, mode: 'pinch' | 'pan' | 'wait', ... }
    const mid = t => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1;
    const unit = svg => box(svg).W / box(svg).r.width;
    root.addEventListener('touchstart', e => {
        const t = e.touches;
        const svg = g?.svg || [...t].map(x => onMap(x.clientX, x.clientY, x.target)).find(Boolean);
        if (!svg) return;
        if (t.length >= 2) { const [cx, cy] = mid(t); g = { svg, mode: 'pinch', d0: dist(t), cx, cy, from: { ...st(svg) } }; moving(svg, true); e.preventDefault(); }
        else if (st(svg).s > 1) { g = { svg, mode: 'pan', x: t[0].clientX, y: t[0].clientY, from: { ...st(svg) } }; moving(svg, true); e.preventDefault(); }
        else g = { svg, mode: 'wait' };
    }, { passive: false, capture: true });
    root.addEventListener('touchmove', e => {
        if (!g || g.mode === 'wait') return;
        if (e.cancelable) e.preventDefault();
        const t = e.touches, k = unit(g.svg);
        if (g.mode === 'pinch' && t.length >= 2) {
            const [cx, cy] = mid(t);
            zoomAt(g.svg, g.from.s * dist(t) / g.d0, g.cx, g.cy, g.from);
            const s = st(g.svg); apply(g.svg, s.s, s.tx + (cx - g.cx) * k, s.ty + (cy - g.cy) * k);
        } else if (g.mode === 'pan' && t.length === 1) apply(g.svg, g.from.s, g.from.tx + (t[0].clientX - g.x) * k, g.from.ty + (t[0].clientY - g.y) * k);
    }, { passive: false, capture: true });
    const end = e => {
        if (!g) return;
        const t = e.touches;
        if (g.mode === 'pinch' && t.length === 1 && st(g.svg).s > 1) g = { svg: g.svg, mode: 'pan', x: t[0].clientX, y: t[0].clientY, from: { ...st(g.svg) } };
        else if (!t.length) { moving(g.svg, false); g = null; }
    };
    root.addEventListener('touchend', end, true);
    root.addEventListener('touchcancel', end, true);
    // a double tap (or double click): in to 2× where it was tapped, or back to the whole map
    root.addEventListener('dblclick', e => {
        const svg = onMap(e.clientX, e.clientY, e.target);
        if (!svg) return;
        e.preventDefault();
        if (st(svg).s > 1) apply(svg, 1, 0, 0); else zoomAt(svg, 2, e.clientX, e.clientY);
        moving(svg, false);
    });
    // a computer: ctrl + wheel is a trackpad pinch; a zoomed map drags with the mouse
    let still = 0;
    root.addEventListener('wheel', e => {
        if (!e.ctrlKey) return;
        const svg = onMap(e.clientX, e.clientY, e.target);
        if (!svg) return;
        e.preventDefault();
        moving(svg, true);
        zoomAt(svg, st(svg).s * Math.exp(-e.deltaY / 200), e.clientX, e.clientY);
        clearTimeout(still); still = setTimeout(() => moving(svg, false), 200);
    }, { passive: false });
    let drag = null;
    root.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        const svg = onMap(e.clientX, e.clientY, e.target);
        if (!svg || st(svg).s === 1) return;
        drag = { svg, x: e.clientX, y: e.clientY, from: { ...st(svg) } };
        moving(svg, true);
        e.preventDefault();
    });
    root.addEventListener('pointermove', e => {
        if (!drag) return;
        const k = unit(drag.svg);
        apply(drag.svg, drag.from.s, drag.from.tx + (e.clientX - drag.x) * k, drag.from.ty + (e.clientY - drag.y) * k);
    });
    root.addEventListener('pointerup', () => { if (drag) moving(drag.svg, false); drag = null; });
    // the same map drawn again (the phone redraws its screen) keeps its zoom; another map starts whole
    new MutationObserver(() => {
        if (!last || last.s === 1) return;
        const svg = root.querySelector('.mp_bg > svg.mp_art[data-z]');
        if (!svg || svg._z) return;
        if (svg.dataset.z === last.z) { apply(svg, last.s, last.tx, last.ty); moving(svg, false); } else last = null;
    }).observe(root, { childList: true, subtree: true });
}
