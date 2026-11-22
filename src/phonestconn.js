// 실리태번의 "API 연결" 창을 폰 화면에서 조종해요 (docs/design/orbit-marinara.md 1-7). 실리 코드를 복사하지 않아요:
// 실리의 진짜 칸(#rm_api_block 안)을 그 자리에서 읽어 목록으로 만들고, 폰에서 바꾸면 그 칸에 값을 넣고 실리가 듣는 신호(input · change)를 쏘거나 단추를 눌러요.
// 그래서 소스마다 화면을 따로 짜지 않아요: 실리가 보여 주는 칸이 곧 폰이 보여 주는 칸이에요(소망 실리의 버전 · 모델 목록 그대로). 실리 팝업(키 관리 · 프로필 · 추가 매개변수 · 확인)도 같은 방식으로 읽어요(stPopNodes).
// 범위(소망): Chat Completion(#openai_api) · NovelAI(#novel_api). 키는 우리가 저장하지 않아요: 실리 키 칸에 넣기만 하고, 저장은 실리가 해요.
// 글은 한국어로(src/phonestconnko.js): 실리가 한국어로 보여 주면 그대로, 영어로 남은 것만 바꿔요.
import { stKo } from './phonestconnko.js';
const ROOT = '#rm_api_block', APIS = ['openai', 'novel'];
const root = () => document.querySelector(ROOT);
const raw = el => String(el?.textContent || '').replace(/\s+/g, ' ').trim(), txt = el => stKo(raw(el));
const shown = (el, top) => { for (let e = el; e && e !== top; e = e.parentElement) if (getComputedStyle(e).display === 'none') return false; return true; };
// 칸을 다시 찾을 주소: id가 있으면 그것, 없으면 id 있는 조상에서부터의 자리. 팝업 안은 자리가 바뀌니 표(data-nasc)를 달아요
let seq = 0;
export function stPath(el) {
    if (!el.id && el.closest('dialog')) { el.dataset.nasc ||= String(++seq); return `[data-nasc="${el.dataset.nasc}"]`; }
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && e.parentElement; e = e.parentElement) {
        if (e.id) { parts.unshift(`#${CSS.escape(e.id)}`); break; }
        parts.unshift(`:nth-child(${[...e.parentElement.children].indexOf(e) + 1})`);
    }
    return parts.join(' > ');
}
const at = p => { try { return document.querySelector(p); } catch { return null; } };
const FA = { 'fa-info-circle': 'info', 'fa-circle-info': 'info', 'fa-file-circle-plus': 'file-plus-2', 'fa-save': 'save', 'fa-floppy-disk': 'save', 'fa-pencil': 'pencil', 'fa-pen-to-square': 'pencil', 'fa-recycle': 'refresh-cw', 'fa-rotate': 'refresh-cw', 'fa-trash': 'trash-2', 'fa-trash-can': 'trash-2', 'fa-key': 'key-round', 'fa-eye-slash': 'eye-off', 'fa-eye': 'eye', 'fa-circle-question': 'circle-help', 'fa-xmark': 'x', 'fa-circle-xmark': 'x', 'fa-plus': 'plus', 'fa-check': 'check', 'fa-copy': 'copy' };
const iconOf = el => { for (const e of [el, ...el.querySelectorAll('i, .fa-solid, .fa-regular')]) for (const c of e.classList) if (FA[c]) return FA[c]; return ''; };
const linksIn = el => [...el.querySelectorAll('a[href]')].filter(a => /^https?:/i.test(a.getAttribute('href') || '')).map(a => ({ text: txt(a) || stKo(a.title) || '', href: a.href }));
const TEXTY = 'small, p, li, td, th, code, .neutral_warning, .toggle-description, .reverse_proxy_warning, .info-block';
const HOLDS = 'input, select, textarea, button, .menu_button, [data-action]';
const isBtn = el => el.matches('button, .menu_button, .api_button, .api_loading, [data-action]') && !el.matches('label');
const btnOf = el => ({ t: 'btn', p: stPath(el), text: txt(el), icon: iconOf(el), title: stKo(el.title || ''), off: el.classList.contains('disabled') || el.disabled === true, cancel: el.classList.contains('api_loading'), ok: el.classList.contains('popup-button-ok') });

// 한 칸 → 그릴 것 (보이는 것만, 실리 순서대로)
//   cap { text, link? } · note { text, links, warn } · sel { p, value, text, options: [{ v, l, g, off }] } · multi { p, options: [{ v, l, on, off }] }
//   in { p, value, ph, masked, area, list: [{ v, l }] (고를 수 있는 값: 지역 · 저장된 키), key (키 관리 단추의 주소) } · tg { p, label, on, title } · btn { p, text, icon, title, off, cancel, ok } · link { text, href }
//   drawer { p, title, kids } · status { ok, text } · key { on, label, value, id, idp, btns } (키 관리의 저장된 키 한 줄)
function walk(el, into, top) {
    if (!shown(el, top) || el.matches('script, style, datalist, option, optgroup, .select2, .select2-container, hr, br, img')) return;
    if (el.matches('select')) { const multi = el.multiple, opts = [...el.options].filter(o => !o.hidden && o.style.display !== 'none' && !(o.parentElement.tagName === 'OPTGROUP' && (o.parentElement.hidden || o.parentElement.style.display === 'none'))).map(o => ({ v: o.value, l: txt(o), g: o.parentElement.tagName === 'OPTGROUP' ? stKo(o.parentElement.label || '') : '', off: o.disabled, on: o.selected }));
        return void into.push(multi ? { t: 'multi', p: stPath(el), options: opts } : { t: 'sel', p: stPath(el), value: el.value, text: txt(el.selectedOptions[0]) || el.value, options: opts, off: el.disabled }); }
    if (el.matches('input[type=checkbox]')) return void into.push({ t: 'tg', p: stPath(el), label: txt(el.closest('label')) || stKo(el.title || ''), on: el.checked, title: stKo(el.closest('label')?.title || '') });
    if (el.matches('input, textarea')) { if (el.type === 'hidden' || el.type === 'file') return; const dl = el.getAttribute('list') ? document.getElementById(el.getAttribute('list')) : null, key = el.parentElement?.querySelector(':scope > .manage-api-keys');
        return void into.push({ t: 'in', p: stPath(el), value: el.value, ph: stKo(el.placeholder || ''), masked: el.classList.contains('masked-secret'), area: el.tagName === 'TEXTAREA' && !el.classList.contains('popup-input'), list: dl ? [...dl.options].filter(o => o.value).slice(0, 60).map(o => ({ v: o.value, l: raw(o) || o.value })) : [], key: key && shown(key, top) ? stPath(key) : '' }); }
    if (el.matches('.manage-api-keys')) return;   // (키 칸 옆에 같이 그려요)
    if (el.matches('.secretKeyManagerItem')) { const id = el.querySelector('.secretKeyManagerItemId');
        return void into.push({ t: 'key', on: el.classList.contains('active'), label: raw(el.querySelector('.secretKeyManagerItemHeader strong')), value: raw(el.querySelector('.secretKeyManagerItemHeader small')), id: raw(id), idp: id ? stPath(id) : '', btns: [...el.querySelectorAll('button[data-action]')].map(btnOf) }); }
    if (el.matches('label') && el.querySelector('input[type=checkbox], select')) return void [...el.querySelectorAll('input[type=checkbox], select')].forEach(c => walk(c, into, top));   // (이름은 스위치 줄에 이미 들어가요)
    if (el.matches('.inline-drawer')) { const kids = [], body = el.querySelector(':scope > .inline-drawer-content'); if (body) [...body.children].forEach(c => walk(c, kids, body));   // (접혀 있어도 안을 읽어요: body 자신의 display는 보지 않아요. 실리 칸을 건드리면 지켜보기가 그걸 변화로 잡아요)
        return void into.push({ t: 'drawer', p: stPath(el), title: txt(el.querySelector(':scope > .inline-drawer-toggle')), kids }); }
    if (el.matches('.online_status')) return void into.push({ t: 'status', ok: !!el.querySelector('.online_status_indicator.success'), text: txt(el.querySelector('.online_status_text')) });
    if (isBtn(el)) return void into.push(btnOf(el));
    if (el.matches('.openrouter_view_credits, .nanogpt_view_credits')) return void into.push({ t: 'btn', p: stPath(el), text: txt(el), icon: '', title: stKo(el.title || '') });   // (링크처럼 생겼지만 누르면 잔액을 불러와요)
    if (el.matches('i.fa-circle-exclamation, i.fa-triangle-exclamation') && el.title) return void into.push({ t: 'note', text: stKo(el.title), links: [], warn: true });
    if (el.matches('a')) { const href = el.getAttribute('href') || ''; return void (/^https?:/i.test(href) ? into.push({ t: 'link', text: txt(el) || stKo(el.title) || href, href: el.href }) : raw(el) && into.push({ t: 'btn', p: stPath(el), text: txt(el), icon: '', title: stKo(el.title || '') })); }
    if (el.matches('h1, h2, h3, h4, label, b, strong, .range-block-title') && !el.querySelector(HOLDS)) { const t = txt(el), l = linksIn(el); return void (t ? into.push({ t: 'cap', text: t, link: l[0]?.href || '' }) : l[0] && into.push({ t: 'link', text: l[0].text || stKo(el.querySelector('a')?.title || ''), href: l[0].href })); }
    if (el.matches(TEXTY) && !el.querySelector(HOLDS)) { const t = txt(el); return void (t && into.push({ t: 'note', text: t, links: linksIn(el), warn: el.matches('.reverse_proxy_warning, .neutral_warning') })); }
    if (el.matches('tr') && !el.querySelector(HOLDS)) { const c = [...el.children].map(txt).filter(Boolean); return void (c.length && into.push({ t: 'note', text: c.join(': '), links: [] })); }
    if (el.matches('.secretKeyManagerInfo')) return void into.push({ t: 'note', text: [...el.children].map(txt).filter(Boolean).join(' · ') || txt(el), links: [] });
    if (!el.children.length || ![...el.children].some(c => c.matches('div, ul, ol, li, table, form, label, h1, h2, h3, h4, p') || c.querySelector(HOLDS) || c.matches(HOLDS))) { const t = txt(el), l = linksIn(el); if (l.length === 1 && raw(el) === raw(el.querySelector('a[href]'))) return void into.push({ t: 'link', ...l[0] }); return void (t && into.push({ t: 'note', text: t, links: l })); }   // (글만 든 덩어리는 한 줄로)
    [...el.children].forEach(c => walk(c, into, top));
}

// → 화면에 그릴 것들: API 고르기(둘만: Chat Completion · NovelAI, 지금 것이 다른 것이면 그것도) · 연결 프로필 줄 · 지금 API의 칸들 · 자동 연결 / 숨긴 키 보기
export function stConnNodes() {
    const R = root(); if (!R) return null;
    const main = document.querySelector('#main_api'), api = main?.value || '', block = api === 'openai' ? R.querySelector('#openai_api') : api === 'novel' ? R.querySelector('#novel_api') : null, out = [];
    if (main) out.push({ t: 'cap', text: txt(R.querySelector('#title_api')) || 'API' }, { t: 'sel', p: '#main_api', value: main.value, text: txt(main.selectedOptions[0]), options: [...main.options].filter(o => APIS.includes(o.value) || o.selected).map(o => ({ v: o.value, l: txt(o), g: '', off: false })) });
    for (const c of R.children) { if (c.id === 'title_api' || c.contains(main)) break; walk(c, out, R); }   // (Connection Manager가 맨 앞에 끼워 넣은 프로필 줄)
    if (block) [...block.children].forEach(c => walk(c, out, block));
    else out.push({ t: 'note', text: '이 화면은 Chat Completion과 NovelAI만 보여 줘요.', links: [] });
    const tail = R.querySelector('#auto-connect-checkbox')?.closest('.flex-container'); if (tail) [...tail.children].forEach(c => walk(c, out, tail));
    return out;
}

// 실리 팝업(dialog.popup) → { title, nodes, controls: [btn], close (닫기 단추의 주소) }
export function stPopNodes(dlg) {
    const body = dlg.querySelector('.popup-body'); if (!body) return null;
    const nodes = [], content = body.querySelector('.popup-content'), input = body.querySelector(':scope > .popup-input'), extra = body.querySelector(':scope > .popup-inputs'), ctl = body.querySelector(':scope > .popup-controls'), x = dlg.querySelector(':scope > .popup-button-close');
    if (content) for (const c of content.childNodes) { if (c.nodeType === 1) walk(c, nodes, content); else if (c.nodeType === 3 && c.textContent.trim()) nodes.push({ t: 'note', text: stKo(c.textContent.replace(/\s+/g, ' ').trim()), links: [] }); }   // (실리가 글을 맨몸으로 넣기도 해요)
    if (input) walk(input, nodes, body); if (extra) [...extra.children].forEach(c => walk(c, nodes, extra));
    const title = nodes[0]?.t === 'cap' ? nodes.shift().text : dlg.querySelector('.secretKeyManager') ? 'API 키 관리' : '';
    return { title, nodes, controls: ctl ? [...ctl.children].filter(c => shown(c, body) && isBtn(c)).map(btnOf) : [], close: x && shown(x, dlg) ? stPath(x) : '' };
}

// 폰에서 누른 것을 실리 칸에 그대로: 값 넣고 신호(실리 칸마다 듣는 신호가 달라서 input → change 둘 다. 글을 치는 중에는 input만), 단추는 누르기
export function stConnSet(path, value, typing = false) { const el = at(path); if (!el) return false;
    if (el.type === 'checkbox') el.checked = !!value; else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true })); if (!typing) el.dispatchEvent(new Event('change', { bubbles: true })); return true; }
export function stConnToggleOption(path, v) { const el = at(path), o = el && [...el.options].find(x => x.value === v); if (!o || o.disabled) return false; o.selected = !o.selected; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; }
// (연결 중에는 실리가 단추를 .disabled로만 막아요: 그건 손가락만 막는 것이라, 우리가 누르기 전에 직접 봐요)
export function stConnClick(path) { const el = at(path); if (!el || el.classList.contains('disabled') || el.disabled === true) return false; el.click(); return true; }
// 실리 쪽이 바뀌면(상태 · 모델 목록 · 보이는 칸) 알려 줘요 → 그만 듣기
export function stConnWatch(fn, el = root()) { if (!el) return () => {}; let t = 0; const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(fn, 180); });
    mo.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'placeholder', 'disabled'], characterData: true }); return () => { clearTimeout(t); mo.disconnect(); }; }
