// 실리태번의 "API 연결" 창을 폰 화면에서 조종해요 (docs/design/orbit-marinara.md 1-7). 실리 코드를 복사하지 않아요:
// 실리의 진짜 칸(#rm_api_block 안)을 그 자리에서 읽어 목록으로 만들고, 폰에서 바꾸면 그 칸에 값을 넣고 실리가 듣는 신호(input · change)를 쏘거나 단추를 눌러요.
// 그래서 소스마다 화면을 따로 짜지 않아요: 실리가 보여 주는 칸이 곧 폰이 보여 주는 칸이에요(소망 실리의 버전 · 번역 · 모델 목록 그대로).
// 범위(소망): Chat Completion(#openai_api) · NovelAI(#novel_api). 키는 우리가 저장하지 않아요: 실리 키 칸에 넣기만 하고, 저장은 실리가 해요.
const ROOT = '#rm_api_block', APIS = ['openai', 'novel'];
const root = () => document.querySelector(ROOT);
const txt = el => String(el?.textContent || '').replace(/\s+/g, ' ').trim();
const shown = (el, top) => { for (let e = el; e && e !== top; e = e.parentElement) if (getComputedStyle(e).display === 'none') return false; return true; };
// 칸을 다시 찾을 주소: id가 있으면 그것, 없으면 id 있는 조상에서부터의 자리
export function stPath(el) {
    const parts = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
        if (e.id) { parts.unshift(`#${CSS.escape(e.id)}`); break; }
        parts.unshift(`:nth-child(${[...e.parentElement.children].indexOf(e) + 1})`);
    }
    return parts.join(' > ');
}
const at = p => { try { return document.querySelector(p); } catch { return null; } };
const FA = { 'fa-info-circle': 'info', 'fa-circle-info': 'info', 'fa-file-circle-plus': 'file-plus-2', 'fa-save': 'save', 'fa-floppy-disk': 'save', 'fa-pencil': 'pencil', 'fa-recycle': 'refresh-cw', 'fa-rotate': 'refresh-cw', 'fa-trash': 'trash-2', 'fa-trash-can': 'trash-2', 'fa-key': 'key-round', 'fa-eye-slash': 'eye-off', 'fa-eye': 'eye', 'fa-circle-question': 'circle-help', 'fa-xmark': 'x' };
const iconOf = el => { for (const c of el.classList) if (FA[c]) return FA[c]; return ''; };
const linksIn = el => [...el.querySelectorAll('a[href]')].filter(a => /^https?:/i.test(a.getAttribute('href') || '')).map(a => ({ text: txt(a) || a.title || '', href: a.href }));
const TEXTY = 'small, p, li, .neutral_warning, .toggle-description, .reverse_proxy_warning, .info-block';
const isBtn = el => el.matches('button, .menu_button, .api_button, .api_loading') && !el.matches('label');

// → [{ t, ... }] 화면에 그릴 것들 (보이는 것만, 실리 순서대로)
//   cap { text, link? } · note { text, links, warn } · sel { p, label, value, text, options: [{ v, l, g, off }] } · multi { p, label, options: [{ v, l, on, off }] }
//   in { p, value, ph, masked, list: [값], key (키 관리 단추의 주소) } · tg { p, label, on, title } · btn { p, text, icon, off } · link { text, href }
//   drawer { p, title, kids } · status { ok, text }
export function stConnNodes() {
    const R = root(); if (!R) return null;
    const api = document.querySelector('#main_api')?.value || '', block = api === 'openai' ? R.querySelector('#openai_api') : api === 'novel' ? R.querySelector('#novel_api') : null;
    const out = [];
    const walk = (el, into, top) => {
        if (!shown(el, top) || el.matches('script, style, datalist, option, optgroup, .select2, .select2-container, hr, br')) return;
        if (el.matches('select')) { const multi = el.multiple, opts = [...el.options].filter(o => !o.hidden && o.style.display !== 'none').map(o => ({ v: o.value, l: txt(o), g: o.parentElement.tagName === 'OPTGROUP' ? (o.parentElement.label || '') : '', off: o.disabled, on: o.selected }));
            return void into.push(multi ? { t: 'multi', p: stPath(el), options: opts } : { t: 'sel', p: stPath(el), value: el.value, text: txt(el.selectedOptions[0]) || el.value, options: opts, off: el.disabled }); }
        if (el.matches('input[type=checkbox]')) return void into.push({ t: 'tg', p: stPath(el), label: txt(el.closest('label')) || el.title || '', on: el.checked, title: el.closest('label')?.title || '' });
        if (el.matches('input, textarea')) { if (el.type === 'hidden' || el.type === 'file') return; const dl = el.getAttribute('list') ? document.getElementById(el.getAttribute('list')) : null, key = el.parentElement?.querySelector(':scope > .manage-api-keys');
            return void into.push({ t: 'in', p: stPath(el), value: el.value, ph: el.placeholder || '', masked: el.classList.contains('masked-secret'), list: dl ? [...dl.options].map(o => o.value).filter(Boolean).slice(0, 60) : [], key: key && shown(key, top) ? stPath(key) : '' }); }
        if (el.matches('.manage-api-keys')) return;   // (키 칸 옆에 같이 그려요)
        if (el.matches('label.checkbox_label') && el.querySelector('input[type=checkbox], select')) return void [...el.children].forEach(c => walk(c, into, top));
        if (el.matches('.inline-drawer')) { const kids = [], body = el.querySelector(':scope > .inline-drawer-content'); if (body) { const was = body.style.display; body.style.display = 'block'; [...body.children].forEach(c => walk(c, kids, body)); body.style.display = was; }
            return void into.push({ t: 'drawer', p: stPath(el), title: txt(el.querySelector(':scope > .inline-drawer-toggle')), kids }); }
        if (el.matches('.online_status')) return void into.push({ t: 'status', ok: !!el.querySelector('.online_status_indicator.success'), text: txt(el.querySelector('.online_status_text')) });
        if (isBtn(el)) return void into.push({ t: 'btn', p: stPath(el), text: txt(el), icon: iconOf(el), title: el.title || '', off: el.classList.contains('disabled') || el.disabled === true, cancel: el.classList.contains('api_loading') });
        if (el.matches('a')) { const href = el.getAttribute('href') || ''; return void (/^https?:/i.test(href) ? into.push({ t: 'link', text: txt(el) || el.title || href, href: el.href }) : txt(el) && into.push({ t: 'btn', p: stPath(el), text: txt(el), icon: '', title: el.title || '' })); }
        if (el.matches('h3, h4, label, b') && !el.querySelector('input, select, textarea, button, .menu_button')) { const t = txt(el), l = linksIn(el); return void (t ? into.push({ t: 'cap', text: t, link: l[0]?.href || '' }) : l[0] && into.push({ t: 'link', text: l[0].text || el.querySelector('a')?.title || '', href: l[0].href })); }
        if (el.matches(TEXTY) && !el.querySelector('input, select, textarea, button, .menu_button')) { const t = txt(el); return void (t && into.push({ t: 'note', text: t, links: linksIn(el), warn: el.matches('.reverse_proxy_warning, .neutral_warning') })); }
        if (!el.children.length) { const t = txt(el); return void (t && into.push({ t: 'note', text: t, links: [] })); }
        [...el.children].forEach(c => walk(c, into, top));
    };
    // 맨 위: API 고르기(둘만: Chat Completion · NovelAI, 지금 것이 다른 것이면 그것도) · 연결 프로필 줄
    const main = document.querySelector('#main_api');
    if (main) out.push({ t: 'cap', text: txt(R.querySelector('#title_api')) || 'API' }, { t: 'sel', p: '#main_api', value: main.value, text: txt(main.selectedOptions[0]), options: [...main.options].filter(o => APIS.includes(o.value) || o.selected).map(o => ({ v: o.value, l: txt(o), g: '', off: false })) });
    for (const c of R.children) { if (c.id === 'title_api' || c.contains(main)) break; walk(c, out, R); }   // (Connection Manager가 맨 앞에 끼워 넣은 프로필 줄)
    if (block) [...block.children].forEach(c => walk(c, out, block));
    else out.push({ t: 'note', text: '이 화면은 Chat Completion과 NovelAI만 보여 줘요.', links: [] });
    const tail = R.querySelector('#auto-connect-checkbox')?.closest('.flex-container'); if (tail) [...tail.children].forEach(c => walk(c, out, tail));
    return out;
}

// 폰에서 누른 것을 실리 칸에 그대로: 값 넣고 input → change 신호(실리 칸마다 듣는 신호가 달라서 둘 다 쏴요), 단추는 누르기
const fire = el => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
export function stConnSet(path, value) { const el = at(path); if (!el) return false;
    if (el.type === 'checkbox') el.checked = !!value; else el.value = value;
    fire(el); return true; }
export function stConnToggleOption(path, v) { const el = at(path), o = el && [...el.options].find(x => x.value === v); if (!o || o.disabled) return false; o.selected = !o.selected; fire(el); return true; }
// (연결 중에는 실리가 단추를 .disabled로만 막아요: 그건 손가락만 막는 것이라, 우리가 누르기 전에 직접 봐요)
export function stConnClick(path) { const el = at(path); if (!el || el.classList.contains('disabled') || el.disabled === true) return false; el.click(); return true; }
// 실리 쪽이 바뀌면(상태 · 모델 목록 · 보이는 칸) 알려 줘요 → 그만 듣기
export function stConnWatch(fn) { const R = root(); if (!R) return () => {}; let t = 0; const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(fn, 180); });
    mo.observe(R, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'placeholder', 'disabled'], characterData: true }); return () => { clearTimeout(t); mo.disconnect(); }; }
