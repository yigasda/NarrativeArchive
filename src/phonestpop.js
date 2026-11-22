// 실리 팝업(키 관리 · 연결 프로필 만들기/편집 · 추가 매개변수 · 확인 창)을 우리 시트로 보여 줘요 (docs/design/orbit-marinara.md 1-7).
// 실리 팝업은 그대로 열려 있고(실리 코드가 그 칸 · 단추를 읽어요), 우리는 그 안의 것을 안 보이게 하고 같은 팝업 안에 우리 시트를 얹어요. 시트에서 누르면 실리의 진짜 칸 · 단추를 눌러요.
// 실리 팝업은 화면 전체를 막는 창이라 폰 화면에 그릴 수 없어요(폰이 눌리지 않아요). 그래서 팝업 안에, 폰 자리에 딱 맞춰 그려요.
import { stPopNodes, stConnSet, stConnToggleOption, stConnClick, stConnWatch } from './phonestconn.js';
import { orbitStPop } from './phoneorbitset.js';
import { stKo } from './phonestconnko.js';
const imp = (el, o) => { for (const [k, v] of Object.entries(o)) el.style.setProperty(k, v, 'important'); };

// canvas(): 폰의 화면 요소(크기 · 자리 · 배율을 따라요) · dark(): 어두운 Orbit인지 → 그만 보기
export function stPopWatch({ canvas, dark }) {
    const live = new Map();
    const drop = d => { const x = live.get(d); if (!x) return; x.stop(); clearTimeout(x.t); x.host.remove(); live.delete(d); };
    const take = dlg => {
        if (live.has(dlg) || dlg.querySelector('.na_popup, .na_scp') || !dlg.querySelector('.popup-body')) return;
        const cv = canvas(); if (!cv) return;
        const r = cv.getBoundingClientRect(), k = r.width / (cv.offsetWidth || r.width) || 1;
        dlg.classList.add('na_scp_d');
        imp(dlg, { position: 'fixed', inset: '0', width: '100vw', height: '100dvh', 'max-width': 'none', 'max-height': 'none', margin: '0', padding: '0', border: '0', background: 'transparent', 'box-shadow': 'none', overflow: 'hidden', 'backdrop-filter': 'none', filter: 'none' });
        for (const c of dlg.children) imp(c, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', opacity: '0', 'pointer-events': 'none' });   // (display는 건드리지 않아요: 실리가 숨긴 칸인지 그걸로 읽어요)
        const host = document.createElement('div'); host.className = 'na_popup na_phone na_scp';   // (na_phone: 우리 확장의 다른 팝업용 스킨이 시트 단추 바탕을 지우지 않게) host.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;overflow:hidden;`;
        host.innerHTML = `<div class="ax ax_orbitroom"><div class="ax_canvas na_scp_c" style="position:absolute;left:0;top:0;width:${cv.offsetWidth}px;height:${cv.offsetHeight}px;transform:scale(${k});transform-origin:0 0;background:transparent;"></div></div>`;
        dlg.appendChild(host); const cvs = host.querySelector('.na_scp_c'), ui = { open: '', v: {}, scQ: '' }, x = { host, t: 0, stop: () => {} }; live.set(dlg, x);
        const typing = () => !!host.querySelector('.na_sc_in:focus, .na_sc_q:focus');
        const draw = () => { if (!dlg.isConnected || !dlg.open) return drop(dlg); const P = stPopNodes(dlg); if (!P) return; const top = cvs.querySelector('.os_bd')?.scrollTop || 0;
            cvs.innerHTML = orbitStPop({ ...P, ...ui, dark: dark() }); const bd = cvs.querySelector('.os_bd'); if (bd) bd.scrollTop = top; };
        const later = (ms = 60) => { clearTimeout(x.t); x.t = setTimeout(() => { if (typing()) return later(300); draw(); }, ms); };
        x.stop = stConnWatch(() => later(0), dlg.querySelector('.popup-body'));
        const val = el => (el.classList.contains('oc_area') ? el.innerText.replace(/\n$/, '') : el.innerText.replace(/\n/g, ''));
        host.addEventListener('click', e => { const el = e.target.closest('.na_sc_btn, .na_sc_tg, .na_sc_opt, .na_sc_mopt, .na_sc_pick, .na_sc_link, .na_sc_dr, .na_os_sel, .na_scp_x'); if (!el) return; e.stopPropagation(); const d = el.dataset;
            if (el.classList.contains('na_scp_x')) { const P = stPopNodes(dlg), c = P?.close || P?.controls.find(b => !b.ok)?.p; if (c) stConnClick(c); return; }   // (바깥을 누르면: 닫기 단추가 있으면 그것, 없으면 취소)
            if (el.classList.contains('na_sc_link')) { if (/^https?:/i.test(d.h || '')) window.open(d.h, '_blank', 'noopener'); return; }
            if (el.classList.contains('na_os_sel')) { ui.open = ui.open === d.k ? '' : d.k; ui.scQ = ''; return draw(); }
            if (el.classList.contains('na_sc_dr')) { ui.v[d.k] = !ui.v[d.k]; return draw(); }
            if (el.classList.contains('off')) return;
            if (el.classList.contains('na_sc_tg')) stConnSet(d.p, d.on !== '1');
            else if (el.classList.contains('na_sc_opt') || el.classList.contains('na_sc_pick')) { ui.open = ''; stConnSet(d.p, d.v); }
            else if (el.classList.contains('na_sc_mopt')) stConnToggleOption(d.p, d.v);
            else stConnClick(d.p);
            later(); });
        host.addEventListener('input', e => { const el = e.target.closest?.('.na_sc_in, .na_sc_q'); if (!el) return; if (el.classList.contains('na_sc_q')) { ui.scQ = el.innerText; return; } stConnSet(el.dataset.p, val(el), true); });
        host.addEventListener('focusout', e => { if (e.target.closest?.('.na_sc_in, .na_sc_q')) later(); });
        host.addEventListener('keydown', e => { const el = e.target.closest?.('.na_sc_in, .na_sc_q'); if (!el) return; e.stopPropagation(); if (e.key === 'Enter' && !el.classList.contains('oc_area')) { e.preventDefault(); el.blur(); } });
        draw();
    };
    const scan = () => { document.querySelectorAll('dialog.popup[open]').forEach(take); for (const d of [...live.keys()]) if (!d.isConnected || !d.open) drop(d); };
    const mo = new MutationObserver(() => { scan(); setTimeout(scan, 40); }); mo.observe(document.body, { childList: true, subtree: false, attributes: false });
    scan();
    return () => { mo.disconnect(); for (const d of [...live.keys()]) drop(d); };
}

// 실리가 띄우는 알림(토스트)의 글을 한국어로 (소망: "알림도 다 번역"). 표에 있는 글만 바꾸고, 모르는 글은 그대로 둬요 → 그만 보기
export function stToastKo() {
    const fix = el => { for (const e of el.matches?.('.toast-message, .toast-title') ? [el] : el.querySelectorAll?.('.toast-message, .toast-title') || []) { const a = e.textContent, b = stKo(a.replace(/\s+/g, ' ').trim()); if (b && b !== a.trim()) e.textContent = b; } };
    const mo = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) fix(n); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    return () => mo.disconnect();
}
