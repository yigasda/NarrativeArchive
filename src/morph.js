// 바뀐 부분만 다시 그리기: 새로 그린 화면(fresh)과 지금 화면(live)을 견줘서 다른 곳만 고쳐요.
// 화면을 통째로 갈아 끼우면 폰에서 0.5초쯤 걸리고 깜빡였어요(그림 · 글꼴 · 테마 방패를 전부 다시 계산, 소망).
// 같은 화면을 다시 그릴 때만 써요(phone.js drawNow). 끝나면 live의 모양은 fresh와 같아요. 지키는 것:
//   - 스크롤 위치 · 그림 · 움직이는 것(안 바뀐 요소는 그대로라서)
//   - 글을 치고 있는 칸: 새 글이 지금 글과 같으면 손대지 않아요(커서 · 키보드가 그대로). 다르면 새 글로 바꿔요(보낸 뒤 비우기)
//   - keepNode가 참인 요소(폰 안 물음 창처럼 화면 밖에서 얹은 것): 지우지도 고치지도 않아요
// 고른 칸(input · select · textarea)의 값은 새 화면대로 맞춰요: 통째로 갈 때와 같게.

const keyOf = n => (n.nodeType === 1 ? `${n.tagName}|${n.getAttribute('data-id') || n.id || ''}` : '');
const hasKey = n => n.nodeType === 1 && (n.hasAttribute('data-id') || !!n.id);
const FORM = 'input, select, textarea';

function syncAttrs(a, b) {
    for (const { name } of [...a.attributes]) if (!b.hasAttribute(name)) a.removeAttribute(name);
    for (const { name, value } of [...b.attributes]) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
}

// 칸의 값: 새 화면의 값으로 (치고 있는 칸은 새 값이 바뀌었을 때만)
function syncForm(a, b, focused, changed) {
    const t = a.tagName;
    if (t === 'INPUT') {
        const type = (a.getAttribute('type') || 'text').toLowerCase();
        if (type === 'file') return;
        if (type === 'checkbox' || type === 'radio') { const on = b.hasAttribute('checked'); if (a.checked !== on) a.checked = on; return; }
        const v = b.getAttribute('value') ?? '';
        if ((!focused || changed) && a.value !== v) a.value = v;
    } else if (t === 'TEXTAREA') {
        const v = b.textContent || '';
        if ((!focused || changed) && a.value !== v) a.value = v;
    } else if (t === 'OPTION') {
        const on = b.hasAttribute('selected'); if (a.selected !== on && !(focused && !changed)) a.selected = on;
    }
}

function morphNode(a, b, o) {
    if (a.nodeType !== 1) { if (a.data !== b.data) a.data = b.data; return; }
    // (똑같으면 그대로: 화면의 거의 전부가 여기서 끝나요. 값을 가진 칸이 든 곳은 값까지 맞춰야 해서 내려가요)
    if (a.isEqualNode(b) && !a.matches(FORM) && !a.querySelector(FORM)) return;
    const focused = o.active === a, editing = focused && a.isContentEditable;
    const before = a.tagName === 'INPUT' ? a.getAttribute('value') : a.tagName === 'TEXTAREA' ? a.defaultValue : null;
    syncAttrs(a, b);
    if (a.matches(FORM) || a.tagName === 'OPTION') syncForm(a, b, focused || (a.tagName === 'OPTION' && o.active === a.closest('select')), a.tagName === 'INPUT' ? before !== b.getAttribute('value') : a.tagName === 'TEXTAREA' ? before !== (b.textContent || '') : true);
    if (a.tagName === 'TEXTAREA') return;
    // (치고 있는 칸: 글이 같으면 안 건드려요. 브라우저가 칸 안에 넣은 줄바꿈 요소도 그대로)
    if (editing && a.textContent === b.textContent) return;
    morphKids(a, b, o);
}

function morphKids(a, b, o) {
    const olds = new Map();
    for (let n = a.firstChild; n; n = n.nextSibling) if (hasKey(n) && !o.keepNode(n)) { const k = keyOf(n); if (!olds.has(k)) olds.set(k, []); olds.get(k).push(n); }
    const skip = n => { while (n && o.keepNode(n)) n = n.nextSibling; return n; };
    let cur = skip(a.firstChild);
    for (const nb of [...b.childNodes]) {
        let hit = null;
        if (hasKey(nb)) { const q = olds.get(keyOf(nb)); if (q?.length) hit = q.shift(); }
        else if (cur && cur.nodeType === nb.nodeType && !hasKey(cur) && (nb.nodeType !== 1 || cur.tagName === nb.tagName)) hit = cur;
        if (!hit) { a.insertBefore(nb, cur); continue; }
        if (hit === cur) cur = skip(cur.nextSibling); else a.insertBefore(hit, cur);
        // (열쇠가 있는 옛 요소가 자리를 지나쳤으면 줄에서 빼요: 뒤에서 또 맞추지 않게)
        if (hasKey(hit)) { const q = olds.get(keyOf(hit)); const i = q ? q.indexOf(hit) : -1; if (i >= 0) q.splice(i, 1); }
        morphNode(hit, nb, o);
    }
    while (cur) { const next = skip(cur.nextSibling); cur.remove(); cur = next; }
}

// live의 자식들을 fresh(DocumentFragment나 요소)의 자식들처럼. keepNode: 남겨 둘 요소인지
export function morph(live, fresh, { keepNode = () => false } = {}) {
    const o = { keepNode: n => n.nodeType === 1 && keepNode(n), active: live.ownerDocument.activeElement };
    morphKids(live, fresh, o);
}
