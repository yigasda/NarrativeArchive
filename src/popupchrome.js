// One way to close every extension popup (docs/DESIGN.md › 확장 패널 · 팝업): a 닫기 button at the bottom, nothing else.
//  - a popup only to look at: one 닫기 (a soft full-width pill);
//  - a popup that does something: 닫기 (text) · the action (orange pill) — its cancel button reads 닫기.
// No ✕ and no 취소 for closing. Short questions (util.confirm, .na_confirm) keep 취소 · the action, since 취소 there is an
// answer, not a way out. Windows with their own bottom row (아카이브에 추가, 고쳐 달라고 하기) say 닫기 themselves.
const SKIP = '.na_confirm, .na_phone, .na_st, .na_ap3, .na_sf3';
const shown = el => !!el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';

export function dressPopup(dlg) {
    if (!dlg || dlg.dataset.naPx || !dlg.querySelector('.na_popup') || dlg.querySelector(SKIP)) return;
    dlg.dataset.naPx = '1';
    const cancel = dlg.querySelector('.popup-controls .popup-button-cancel');
    const act = shown(cancel);
    dlg.classList.add('na_px', act ? 'na_px_act' : 'na_px_view');
    if (act) cancel.textContent = '닫기';
}

// Themes keep their hands off our windows: Blue Lemonade skips its colour overrides inside this marker (its own
// "keep an extension's colours" switch). Our own CSS (69-components.css) holds the font and the rest.
const KEEP = 'data-bl-native-ext-colors';
function keepOwnLook() {
    const panel = document.getElementById('na_settings'); if (panel && !panel.hasAttribute(KEEP)) panel.setAttribute(KEEP, '');
    document.querySelectorAll('dialog.popup[open]').forEach(d => { if (!d.hasAttribute(KEEP) && d.querySelector('.na_popup, .na_phone')) d.setAttribute(KEEP, ''); });
}

export function watchPopups() {
    const check = () => { document.querySelectorAll('dialog.popup[open]').forEach(dressPopup); keepOwnLook(); };
    new MutationObserver(check).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    check();
}
