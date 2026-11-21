// Orbit: 실시간 폰(폰 2)의 메신저 화면 (docs/design/orbit.md, 시안 docs/mockups/phone2-messenger · phone2-orbit).
// 목록 · 새 대화는 흰 카드 + 검정 알약(시안 A), 방 안은 그 사람 색 오로라 바탕 + 유리(시안 C).
// 화면만 그려요: 폰 2를 읽는 건 phone.js가 하고, 이 파일은 그 결과(ui.orbit)만 받아요(폰 2 파일을 부르지 않아요).
// 설명 글은 쓰지 않아요(몰입이 깨져요). 화면에 나오는 건 이름 · 말 · 시각 · 상태 낱말뿐이에요.
import { esc } from './util.js';
import { axBar, axInd } from './phoneapps.js';
import { faceOf, stFace } from './people.js';

// 사람마다 고정된 색 오로라(이름 해시): [바탕 세 점, 바탕색]
const AURA = [
    ['#6f8fe6', '#a9c4f7', '#c7b8f2', '#94acee'],   // 파랑 · 라벤더
    ['#e8615a', '#f4ab95', '#f7c9b4', '#ee8b7c'],   // 산호
    ['#59b874', '#f0bf7f', '#cfe08c', '#8dcb8a'],   // 초록 · 살구
    ['#f2a2b4', '#f7c6a6', '#e7b3e0', '#f1b0b4'],   // 장미 · 복숭아
    ['#5fb3c9', '#a9dcd6', '#b9c8f2', '#86c3cf'],   // 물빛
    ['#d9a35a', '#f3cf96', '#e8a7a0', '#e4b47c'],   // 호박
];
const GROUP = ['#8a6fdc', '#d79ad8', '#a7a1ef', '#a688de'];
const hash = s => [...String(s || '')].reduce((h, c) => (h * 31 + c.codePointAt(0)) % 99991, 7);
const auraOf = (name, group) => (group ? GROUP : AURA[hash(String(name).toLowerCase()) % AURA.length]);
const auraBg = ([a, b, c, d]) => `radial-gradient(40% 50% at 25% 35%,${a} 0,transparent 70%),radial-gradient(45% 55% at 75% 70%,${b} 0,transparent 70%),radial-gradient(40% 40% at 70% 20%,${c} 0,transparent 70%),${d}`;
export const orbitBg = (name, group) => auraBg(auraOf(name, group));

// 선 아이콘(24 판)
const I = {
    back: 'M15 5l-7 7 7 7', plus: 'M12 5v14M5 12h14', send: 'M5 12h13M13 6l6 6-6 6', srch: 'M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM20 20l-4.3-4.3', pen: 'M4 20h4L19 9l-4-4L4 16z', chat: 'M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', file: 'M7 3h7l5 5v13H7zM14 3v5h5M12 12v6M9.5 15.5 12 18l2.5-2.5', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0', tell: 'M4 15V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v4M8 20H4v-4M4 20l7-7h9M17 10l3 3-3 3',
    clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2', chk: 'M4 12.5l4.5 4.5L20 6', chev: 'M9 6l6 6-6 6', x: 'M6 6l12 12M18 6L6 18',
    tr: 'M4 6h8M8 4v2c0 4-2 7-5 8M6 10c1.5 2 3.5 3.5 6 4M13 20l4-9 4 9M14.5 17h5', moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
    set: 'M7 15a5 5 0 0 1 10 0M3 15h2M19 15h2M5.6 9.6l1.4 1.4M18.4 9.6 17 11M12 6v2M4 19h16',
    book: 'M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9', spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
};
const ic = (k, s = 20, c = 'currentColor', w = 2) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${I[k]}"/></svg>`;
// Lucide 아이콘(https://lucide.dev, ISC License, Copyright (c) Lucide Contributors · NOTICE.md): 방 화면의 새 아이콘은 손으로 그리지 않고 여기서 가져와요(24 판의 안쪽 그림 그대로)
const LU = {
    'chevron-left': '<path d="m15 18-6-6 6-6" />',
    'ellipsis': '<circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />',
    'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />',
    'sun': '<circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />',
    'copy': '<rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />',
    'smile-plus': '<path d="M22 11v1a10 10 0 1 1-9-10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" x2="9.01" y1="9" y2="9" /><line x1="15" x2="15.01" y1="9" y2="9" /><path d="M16 5h6" /><path d="M19 2v6" />',
    'languages': '<path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" />',
    'bookmark': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />',
    'eye-off': '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /><path d="m2 2 20 20" />',
    'pencil': '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" />',
    'circle-check': '<circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />',
    'message-square-x': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="m14.5 7.5-5 5" /><path d="m9.5 7.5 5 5" />',
    'trash-2': '<path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" />',
    'pin': '<path d="M12 17v5" /><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />',
    'sticky-note': '<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" /><path d="M15 3v4a2 2 0 0 0 2 2h4" />',
    'check': '<path d="M20 6 9 17l-5-5" />',
    'settings-2': '<path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />',
    'search': '<circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />',
    'type': '<polyline points="4 7 4 4 20 4 20 7" /><line x1="9" x2="15" y1="20" y2="20" /><line x1="12" x2="12" y1="4" y2="20" />',
    'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />',
    'chevron-right': '<path d="m9 18 6-6-6-6" />',
    'x': '<path d="M18 6 6 18" /><path d="m6 6 12 12" />',
    'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />',
    'plus': '<path d="M5 12h14" /><path d="M12 5v14" />',
    'reply': '<polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />',
    'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />',
    'scan-text': '<path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 8h8" /><path d="M7 12h10" /><path d="M7 16h6" />',
    'brain': '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" /><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" /><path d="M17.599 6.5a3 3 0 0 0 .399-1.375" /><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" /><path d="M3.477 10.896a4 4 0 0 1 .585-.396" /><path d="M19.938 10.5a4 4 0 0 1 .585.396" /><path d="M6 18a4 4 0 0 1-1.967-.516" /><path d="M19.967 17.484A4 4 0 0 1 18 18" />',
    'git-branch': '<line x1="6" x2="6" y1="3" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />',
    'paperclip': '<path d="M13.234 20.252 21 12.3" /><path d="m16 6-8.414 8.586a2 2 0 0 0 0 2.828 2 2 0 0 0 2.828 0l8.414-8.586a4 4 0 0 0 0-5.656 4 4 0 0 0-5.656 0l-8.415 8.585a6 6 0 1 0 8.486 8.486" />',
    'chevron-up': '<path d="m18 15-6-6-6 6" />',
    'smile': '<circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" x2="9.01" y1="9" y2="9" /><line x1="15" x2="15.01" y1="9" y2="9" />',
    'plug': '<path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />',
    'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />',
    'venetian-mask': '<path d="M18 11c-1.5 0-2.5.5-3 2" /><path d="M4 6a2 2 0 0 0-2 2v4a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5V8a2 2 0 0 0-2-2h-3a8 8 0 0 0-5 2 8 8 0 0 0-5-2z" /><path d="M6 11c1.5 0 2.5.5 3 2" />',
    'braces': '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" /><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />',
    'book-open': '<path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />',
    'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />',
    'images': '<path d="M18 22H4a2 2 0 0 1-2-2V6" /><path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18" /><circle cx="12" cy="8" r="2" /><rect width="16" height="16" x="6" y="2" rx="2" />',
    'wrench': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />',
    'bot': '<path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />',
    'calendar-clock': '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h5" /><path d="M17.5 17.5 16 16.3V14" /><circle cx="16" cy="16" r="6" />',
    'arrow-right': '<path d="M5 12h14" /><path d="m12 5 7 7-7 7" />',
};
const lu = (k, s = 18, w = 2) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${LU[k]}</svg>`;
// 두 색 섞기(#rrggbb, t = 뒤 색의 몫): 껍데기 앱의 기기 바 색을 방 바탕에 맞춰요
const mix = (a, b, t) => `#${[1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('')}`;
// 그 사람 현지 시각의 아이콘: 05~17 해 · 17~21 저녁 · 21~05 달 (날씨 하늘과 같은 경계)
export const dayIcon = hhmm => { const h = Number(String(hhmm || '').slice(0, 2)); return h >= 5 && h < 17 ? 'sun' : h >= 17 && h < 21 ? 'set' : 'moon'; };

// 얼굴: 그 사람 색 동그라미 + 첫 글자
// 얼굴: 인물 도감에서 정한 프사(없으면 실리태번 아바타)가 있으면 그 그림, 없으면 색 동그라미 + 첫 글자. 단체방은 늘 보라 동그라미
// (그림이 안 불러와지면 작은 그림 → 글자로 물러나요)
const faceUrl = (name, s) => { try { const big = s * (globalThis.devicePixelRatio || 1) > 96, url = faceOf(name, big); return { url, fb: big && url && !url.startsWith('data:') ? stFace(name) : '' }; } catch { return { url: '', fb: '' }; } };
const face = (name, s = 48, group = false) => { const f = group ? { url: '' } : faceUrl(name, s); return `<span class="ob_face" style="width:${s}px;height:${s}px;font-size:${Math.round(s * 0.38)}px"><span class="ob_blob" style="background:${orbitBg(name, group)}"></span><b>${esc([...String(name || '?')][0] || '?')}</b>${f.url ? `<img src="${esc(f.url)}"${f.fb && f.fb !== f.url ? ` data-fb="${esc(f.fb)}"` : ''} alt="" loading="lazy" decoding="async">` : ''}</span>`; };
if (typeof document !== 'undefined') document.addEventListener('error', e => { const i = e.target; if (i?.tagName !== 'IMG' || !i.parentElement?.classList.contains('ob_face')) return; if (i.dataset.fb) { const fb = i.dataset.fb; delete i.dataset.fb; i.src = fb; } else i.remove(); }, true);

// 홈 아이콘(시안 phone2-orbit 4번 · 82%): 노을 안개 판 + 점 뒤로 옅어지는 빛 꼬리 고리 + 빛나는 점
const ICON = (() => {
    const k = 0.82, r = 16.5 * k, w = (6.2 * k).toFixed(2), a0 = -Math.PI / 4, g = 0.34, N = 40, P = (t) => [32 + r * Math.cos(t), 32 + r * Math.sin(t)].map(v => v.toFixed(2));
    const [dx, dy] = P(a0);
    let tail = '';
    for (let i = 0; i < N; i++) {
        const t0 = a0 + g + (2 * Math.PI - 2 * g) * i / N, t1 = a0 + g + (2 * Math.PI - 2 * g) * (i + 1) / N + 0.01;
        const [x0, y0] = P(t0), [x1, y1] = P(t1);
        tail += `<path d="M${x0} ${y0}A${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x1} ${y1}" stroke="#fff" stroke-opacity="${(0.08 + 0.92 * (i / (N - 1)) ** 1.4).toFixed(3)}" stroke-width="${w}" fill="none"/>`;
    }
    return `<svg aria-hidden="true" viewBox="0 0 64 64" width="SZ" height="SZ"><defs><linearGradient id="obi_bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3c3a6"/><stop offset=".5" stop-color="#e8a7b8"/><stop offset="1" stop-color="#b5a3dd"/></linearGradient>`
        + `<linearGradient id="obi_hl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>`
        + `<radialGradient id="obi_gl"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
        + `<filter id="obi_sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.6" flood-color="#7a4a6a" flood-opacity=".28"/></filter>`
        + `<clipPath id="obi_c"><rect width="64" height="64" rx="18.6"/></clipPath></defs><g clip-path="url(#obi_c)"><rect width="64" height="64" fill="url(#obi_bg)"/>`
        + `<g filter="url(#obi_sh)">${tail}<circle cx="${dx}" cy="${dy}" r="${(9 * k).toFixed(2)}" fill="url(#obi_gl)"/><circle cx="${dx}" cy="${dy}" r="${(5 * k).toFixed(2)}" fill="#fff"/></g>`
        + `<rect width="64" height="64" fill="url(#obi_hl)"/></g></svg>`;
})();
const icon = sz => ICON.replace(/"SZ"/g, `"${sz}"`);
// 실시간 폰 홈 1쪽 위 위젯(시안 phone2-home 4차 "줄 간격 고르게 · 말 옅게"): 유리 카드 한 장, 머리줄은 Orbit 아이콘 · 이름 ·
// 안 읽은 수, 최근 방 두 줄(얼굴 · 이름 · 마지막 말 · 시각 · 검정 숫자). 누르면 Orbit, 줄을 누르면 그 방. 방이 없으면 새 대화 한 줄
export const orbitHomeWidget = (rooms, unread = 0) => `<div class="cg_glass ob_w" tabindex="0" data-go="orbit" aria-label="Orbit">
      <div class="ob_wh"><span class="ob_wi">${icon(18)}</span>Orbit${unread ? `<em>안 읽음 ${unread}</em>` : ''}</div>
      ${rooms.length ? rooms.map(r => `<div class="ob_wr" role="button" tabindex="0" data-go="orbitroom" data-i="${esc(r.id)}">${face(r.title, 32, r.group)}<span class="ob_wt"><b>${esc(r.title)}</b><span>${r.last ? `${r.lastWho ? `${esc(r.lastWho)}: ` : ''}${esc(r.last)}` : ''}</span></span><span class="ob_wn"><span class="cg_num">${esc(r.time || '')}</span>${r.unread ? `<span class="ob_wb cg_num">${r.unread}</span>` : ''}</span></div>`).join('')
        : `<div class="ob_wr" role="button" tabindex="0" data-go="orbitnew"><span class="ob_wp">${ic('plus', 16, '#3a3f47', 2.2)}</span><span class="ob_wt"><b>새 대화</b></span></div>`}
    </div>`;

const dots = lit => Array.from({ length: 24 }, (_, h) => `<i class="${h === lit ? 'h' : h < lit ? 'p' : ''}" style="height:${h < lit ? [9, 15, 22, 15][h % 4] : 4}px"></i>`).join('');

// 방 목록 (시안 A): 맨 위 "지금 그 사람" 카드, 1:1 · 단체 고르기, 흰 목록, 아래 새 대화
// o: { tab, back: { n (안 전한 말), busy, sheet: { text, count, more } | null }, acct: { name, ro, sheet, list: [{ name, sub, on }] }, hero: { name, city, local } | null, rooms: [{ id, title, group, last, lastWho, time, unread }] }
// 왼쪽 위 얼굴 = 지금 계정(시안 phone2-account A): 누르면 아래 시트에서 페르소나 ↔ 이 폰 주인. 주인 계정은 읽기만(새 대화 · 안 읽음 없음)
export function orbitList(p, now, o) {
    const tab = o.tab || 'all', rooms = o.rooms.filter(r => tab === 'all' || (tab === 'group') === r.group);
    const bk = o.back, h = o.hero, lit = h ? Number(String(h.local).slice(0, 2)) : -1, a = o.acct || { name: '', list: [] }, many = a.list.length > 1;
    return `${axBar(p, o.clock || now)}
      <div class="ob_top">${many ? `<button type="button" class="ob_me na_ob_acct" aria-label="계정">${face(a.name, 46)}</button>` : a.ro ? `<span class="ob_me">${face(a.name, 46)}</span>` : `<button type="button" class="ob_me na_ob_face" data-n="${esc(a.name)}" aria-label="프사 바꾸기">${face(a.name, 46)}</button>`}<b class="ob_h1">메시지</b>${a.ro ? '<span class="ob_cb0"></span>' : `<span class="ob_tr">${bk ? `<button type="button" class="ob_cb ob_bk na_ob_back${bk.n || bk.busy ? '' : ' off'}" aria-label="${bk.busy ? '정리 중' : '롤플에 전하기'}"${bk.busy ? ' disabled' : ''}>${bk.busy ? '<i class="fa-solid fa-spinner fa-spin"></i>' : ic('tell', 20, '#1b1d24', 2.1)}${bk.n && !bk.busy ? `<span class="ob_un cg_num">${bk.n}</span>` : ''}</button>` : ''}<button type="button" class="ob_cb" data-go="orbitnew" aria-label="새 대화">${ic('pen', 19)}</button></span>`}</div>
      <div class="ob_scroll ax_scroll">
        <div class="ob_seg">${[['all', '전체'], ['one', '1:1'], ['group', '단체']].map(([k, t]) => `<button type="button" class="ob_sg na_ob_tab${tab === k ? ' on' : ''}" data-v="${k}">${t}</button>`).join('')}</div>
        ${h ? `<div class="ob_hero"><span class="ob_blob" style="background:${orbitBg(h.name)}"></span><span class="ob_gl"></span><div class="ob_in"><small>${esc(h.name)}${h.city ? ` · ${esc(h.city)}` : ''} 지금</small><div class="ob_big cg_num">${esc(h.local)}</div><div class="ob_dots">${dots(lit)}</div><div class="ob_dl"><span>0시</span><span>12시</span><span>24시</span></div></div></div>` : ''}
        ${rooms.length ? `<div class="ob_list">${rooms.map(r => `<div class="ob_rm" role="button" tabindex="0" data-go="orbitroom" data-i="${esc(r.id)}">${face(r.title, 50, r.group)}<span class="ob_t"><b>${esc(r.title)}</b><span class="ob_p">${r.last ? `${r.lastWho ? `${esc(r.lastWho)}: ` : ''}${esc(r.last)}` : ''}</span></span><span class="ob_r"><span class="cg_num">${esc(r.time || '')}</span>${r.unread ? `<span class="ob_un cg_num">${r.unread}</span>` : '<span class="ob_un0"></span>'}</span></div>`).join('')}</div>` : ''}
        <i class="ob_pad"></i>
      </div>
      ${a.ro ? '' : `<button type="button" class="ob_dock" data-go="orbitnew">${ic('plus', 16, '#fff', 2.4)}새 대화</button>`}
      ${bk?.sheet ? `<div class="ob_shade na_ob_bkno"></div><div class="ob_sheet ob_bks"><i class="ob_grab"></i><div class="ob_bkh"><b>롤플에 넣기</b><span>말 ${bk.sheet.count}개</span></div><div class="ob_bkt na_ob_bktx" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="false" aria-label="넣을 글">${esc(bk.sheet.text)}</div>${bk.sheet.more ? `<div class="ob_bkm">남은 말 ${bk.sheet.more}개는 한 번 더</div>` : ''}<div class="ob_bkb"><button type="button" class="ob_bkno na_ob_bkno">취소</button><button type="button" class="ob_bkok na_ob_bkok"${bk.busy ? ' disabled' : ''}>넣기</button></div></div>` : ''}
      ${a.sheet ? `<div class="ob_shade na_ob_shade"></div><div class="ob_sheet"><i class="ob_grab"></i>${a.list.map(x => `<div class="ob_acc na_ob_who" role="button" tabindex="0" data-n="${esc(x.name)}"><button type="button" class="ob_fb na_ob_face" data-n="${esc(x.name)}" aria-label="프사 바꾸기">${face(x.name, 40)}</button><span class="ob_t"><b>${esc(x.name)}</b>${x.sub ? `<span class="ob_p">${esc(x.sub)}</span>` : ''}</span><span class="ob_ck${x.on ? ' on' : ''}">${x.on ? ic('chk', 14, '#fff', 3) : ''}</span></div>`).join('')}</div>` : ''}
      ${axInd()}`;
}

// 방 안 (시안 C): 그 사람 색 바탕, 유리 머리줄 · 말풍선 · 입력칸
// o: { id, title, group, sub, there: { icon, time } (1:1 상대의 현지 시각이 내 시각과 다를 때: 이름 바로 옆에 낮 · 저녁 · 밤 그림 + 시각, 시안 sheetCut2의 6), chips: [{ icon, text }], asOwner (주인 계정: 읽기만), draft, clock, faceOf (1:1 · 내 계정: 머리줄 얼굴을 누르면 그 사람 프사 바꾸기),
//      msgs: [{ day } | { mine, from, text, ko, time, unread, id, open, held (길게 눌린 말), pick (고르는 중: true | false), wait (번역 중), reply (맨 끝 답장 묶음), dots (그 묶음의 마지막 말) }],
//      swipe: { at, count } | null (맨 끝 답장 넘기기), picking: 고른 수 | null,
//      list: { items: [{ no, now, bubbles: [{ text, ko }] }], picks: [no], busy (답장이 오는 중: 지우기 막힘) } | null (받아 둔 답장 창) }
// 말 고치기 (시안 docs/mockups/phone2-edit M3 · W3): 길게 누르면 그 말 위 검정 알약(재번역 · 선택 · 삭제, 맨 끝 답장이면 빨간 "답장 버리기"도. 빨강은 그것 하나만),
// 선택이면 말마다 동그라미 + 입력칸 자리의 줄, 맨 끝 답장 아래 점(옆으로 밀어서 넘겨요)
export function orbitRoom(p, now, o) {
    // (번역 줄 · 배지 이모지는 span이 아니에요: 소망 테마가 span의 글꼴을 따로 정해서, span 안의 이모지만 기기 이모지가 아니었어요 — !emoji 시험 화면으로 확인)
    const koOf = x => (x.wait ? `<div class="ob_ko ob_wait"><i class="fa-solid fa-spinner fa-spin"></i> 번역 중</div>`
        : x.ko ? (x.open ? `<div class="ob_ko na_ob_ko" role="button" tabindex="0" data-id="${esc(x.id)}">${esc(x.ko)}${x.edited && !x.mine ? '<span class="ob_edm">수정됨</span>' : ''}</div>` : `<span class="ob_kof na_ob_ko" role="button" tabindex="0" data-id="${esc(x.id)}">${ic('tr', 13)}번역 보기</span>`) : '');
    // 길게 누른 카드 (시안 docs/mockups/shell-bars Q2): 윗줄은 빠른 반응 6개 + "+"(폰 이모지 키보드), 아랫줄은 재번역 · 선택 · 삭제 (· 답장 버리기). 내가 단 반응은 동그랗게
    const reRow = x => (o.quick?.length ? `<div class="ob_hr">${o.quick.map(e => `<button type="button" class="na_ob_re${x.myre === e ? ' on' : ''}" data-id="${esc(x.id)}" data-e="${esc(e)}" aria-label="${esc(e)} 반응">${esc(e)}</button>`).join('')}<span class="ob_hp na_ob_reany${x.myre && !o.quick.includes(x.myre) ? ' on' : ''}" role="button" tabindex="0" aria-label="다른 이모지">${x.myre && !o.quick.includes(x.myre) ? esc(x.myre) : ic('plus', 17, 'currentColor', 2.2)}<input class="ob_rein" data-id="${esc(x.id)}" inputmode="text" enterkeyhint="done" autocomplete="off" aria-label="이모지 고르기"></span></div>` : '');
    // 길게 누른 판 (시안 docs/mockups/orbit-top M2): 말풍선 바로 아래 흰 판에 아이콘만. 반응을 누르면 같은 판이 이모지 줄로, 북마크를 누르면 북마크 · 고정 · 메모 줄로 바뀌어요(o.heldSub).
    // 켜진 것(북마크 · 고정 · 메모가 있음, AI에게 숨김)은 옅은 칸. 빨강은 삭제. 시안의 12칸 + 선택(소망). 동작이 아직 없는 칸(답장 · 프롬프트 보기 · 생각 보기 · 분기)은 na_ob_soon(알림만)이고, 동작이 생기면 이어요
    const pill = x => { const mk = x.mk || {}, me = x.mine ? ' me' : '', id = esc(x.id), ck = lu('check', 15, 2.4);
        const ib = (c, k, l, cls = '') => `<button type="button" class="${c}${cls}" data-id="${id}" aria-label="${l}">${lu(k, 19, 1.8)}</button>`;
        const row = (c, k, l, on) => `<button type="button" class="ob_pr ${c}" data-id="${id}">${lu(k, 17)}<span>${l}</span>${on ? ck : ''}</button>`;
        if (o.heldSub === 're' && o.quick?.length) return `<div class="ob_pill ob_hc${me}">${reRow(x)}</div>`;
        if (o.heldSub === 'mark') return `<div class="ob_pill ob_pm${me}">${row('na_ob_mbm', 'bookmark', '북마크', mk.b)}${row('na_ob_mpin', 'pin', '고정', mk.p)}${row('na_ob_mnote', 'sticky-note', '메모', mk.n)}</div>`;
        return `<div class="ob_pill${me}">${ib('na_ob_mcopy', 'copy', '복사')}${ib('na_ob_soon', 'reply', '답장')}${ib('na_ob_mre', 'smile-plus', '반응', x.myre ? ' on' : '')}${ib('na_ob_mtr', 'languages', '재번역')}${ib('na_ob_mregen', 'refresh-cw', '재생성')}${ib('na_ob_mmark', 'bookmark', '북마크 · 고정 · 메모', mk.b || mk.p || mk.n ? ' on' : '')}${ib('na_ob_mhide', 'eye-off', mk.h ? 'AI에게 표시' : 'AI에게 숨기기', mk.h ? ' on' : '')}${ib('na_ob_soon', 'scan-text', '프롬프트 보기')}${ib('na_ob_soon', 'brain', '생각 보기')}${ib('na_ob_soon', 'git-branch', '분기')}${ib('na_ob_medit', 'pencil', '수정')}${ib('na_ob_mpick', 'circle-check', '선택')}${ib('na_ob_mdel', 'trash-2', '삭제', ' red')}</div>`; };
    const dots = w => `<div class="ob_swd na_ob_swd" aria-label="답장 ${w.at}/${w.count}">${Array.from({ length: Math.min(w.count, 9) }, (_, i) => `<i class="${i === Math.min(w.at, 9) - 1 ? 'on' : ''}"></i>`).join('')}</div>`;
    // 묶음(시안 docs/mockups/shell-bars U1 · B2): 같은 사람이 이어 보낸 말은 붙은 쪽 모서리만 덜 둥글고(g1 첫 말 · gL 마지막 말),
    // 상대 묶음의 마지막 말 옆에 작은 얼굴. 내 말의 시간(+ 안 읽은 수)은 말풍선 안 오른쪽 아래, 내 마지막 말 밑엔 다 읽었으면 "읽음"
    const kind = x => (x.day ? '' : x.mine ? 'me' : `th:${x.from || ''}`), ks = o.msgs.map(kind);
    const lastMe = o.msgs.reduce((k, x, i) => (x.mine ? i : k), -1);
    const msg = (x, i) => { if (x.day) return `<div class="ob_day">${esc(x.day)}</div>`;
        const g = `${ks[i - 1] !== ks[i] ? ' g1' : ''}${ks[i + 1] !== ks[i] ? ' gL' : ''}`;
        const ed = x.edited ? '<span class="ob_edm">수정됨</span>' : '';
        // 표시(북마크 · 고정 · 메모 · AI에게 숨김): 작은 아이콘. 내 말은 시간 앞, 캐릭터 말은 글 끝. 숨긴 말은 말풍선도 옅게
        const mk = x.mk || {}, mki = mk.b || mk.p || mk.n || mk.h ? `<span class="ob_mk">${mk.h ? lu('eye-off', 11, 2.2) : ''}${mk.p ? lu('pin', 11, 2.2) : ''}${mk.b ? lu('bookmark', 11, 2.2) : ''}${mk.n ? lu('sticky-note', 11, 2.2) : ''}</span>` : '';
        const tin = x.mine && x.time ? `<span class="ob_tin">${mki}${ed}${x.unread ? `<b>${x.unread}</b> ` : ''}<span class="cg_num">${esc(x.time)}</span></span>` : '';
        // 고치는 중(시안 E2): 원문 · 한국어가 그 자리에서 바로 고쳐지는 칸이 되고, 밑에 ✕ · ✓
        if (x.fix) return `<div class="ob_b ${x.mine ? 'me' : 'th ob_glass'}${g} ob_fix"><div class="ob_ft na_ob_ft" contenteditable="true" role="textbox" enterkeyhint="done" spellcheck="false" aria-label="원문">${esc(x.fix.t)}</div>${x.ko ? `<div class="ob_ko ob_fk na_ob_fk" contenteditable="true" role="textbox" enterkeyhint="done" spellcheck="false" aria-label="한국어">${esc(x.fix.k)}</div>` : ''}</div>`
            + `<div class="ob_fbar${x.mine ? ' me' : ''}"><button type="button" class="ob_fno na_ob_fno" aria-label="그만 고치기">${ic('x', 14, '#333', 2.4)}</button><button type="button" class="ob_fok na_ob_fok" aria-label="고치기">${ic('chk', 17, '#fff', 2.6)}</button></div>`;
        const av = !x.mine && ks[i + 1] !== ks[i] ? `<span class="ob_av">${face(x.from || o.title, 34)}</span>` : '';
        const re = x.re ? `<span class="ob_re${x.re.isNew ? ' new' : ''}"${x.re.isNew ? ` style="--ret:-${x.re.ago}ms"` : ''}>${x.re.es.map(e => `<i class="ob_ree">${esc(e)}</i>`).join('')}${x.re.n > 1 ? `<b class="cg_num">${x.re.n}</b>` : ''}</span>` : '';
        const bb = `<div class="ob_b na_ob_b ${x.mine ? 'me' : 'th ob_glass'}${g}${x.re ? ` has_re${x.re.isNew && x.re.ago < 220 ? ' re_new' : ''}` : ''}${x.held ? ' held' : ''}${mk.h ? ' hid' : ''}${x.reply ? ' na_ob_sw' : ''}" data-id="${esc(x.id)}">${esc(x.text)}${x.mine && x.time ? '' : mki}${x.edited && !x.mine && !(x.ko && x.open && !x.wait) ? ed : ''}${koOf(x)}${tin}${av}${re}${!x.mine && !x.reply && x.tl ? `<span class="ob_tl cg_num">${esc(x.tl)}</span>` : ''}</div>`;
        return `${o.group && !x.mine && x.from ? `<div class="ob_sn">${esc(x.from)}</div>` : ''}${x.pick === undefined ? bb : `<div class="ob_prow na_ob_prow${x.mine ? ' me' : ''}" data-id="${esc(x.id)}"><span class="ob_pck${x.pick ? ' on' : ''}">${x.pick ? ic('chk', 13, '#fff', 3) : ''}</span>${bb}</div>`}${x.held ? pill(x) : ''}${i === lastMe && x.time && !x.unread ? '<div class="ob_rd">읽음</div>' : ''}${x.dots && o.swipe ? dots(o.swipe) : ''}`; };
    // 받아 둔 답장 창 (시안 docs/mockups/phone2-edit sheetGlass2 "G3 + 말풍선"): 옅은 유리 창, 답장마다 번호 + 유리 말풍선, 지금 것은 번호가 검정이고 말풍선이 더 밝아요. 창 안에서 굴리고 제목 · 버튼은 고정
    const L = o.list, sheet = !L ? '' : `<div class="ob_shade ob_shl na_ob_slx"></div><div class="ob_sheet ob_sl" style="--sla:${orbitBg(o.title, o.group)}"><i class="ob_grab"></i><div class="ob_slh"><b>받아 둔 답장</b><span class="cg_num">${L.items.length}</span></div>
        <div class="ob_sls">${L.items.map(x => `<div class="ob_slr na_ob_slr${x.now ? ' now' : ''}" role="button" tabindex="0" data-n="${x.no}"><span class="ob_sln cg_num">${x.no}</span><div class="ob_slb">${x.bubbles.length ? x.bubbles.map(b => `<div class="ob_sll">${esc(b.text)}${b.ko ? `<small>${esc(b.ko)}</small>` : ''}</div>`).join('') : '<div class="ob_sll"><small>오는 중</small></div>'}</div><span class="ob_pck${L.picks.includes(x.no) ? ' on' : ''}">${L.picks.includes(x.no) ? ic('chk', 13, '#fff', 3) : ''}</span></div>`).join('')}</div>
        <div class="ob_bkb"><button type="button" class="ob_bkno na_ob_slkeep"${L.busy || L.items.length < 2 ? ' disabled' : ''}>지금 것만 남기기</button><button type="button" class="ob_bkok na_ob_sldrop"${L.busy || !L.picks.length ? ' disabled' : ''}>${L.picks.length ? `${L.picks.length}개 ` : ''}버리기</button></div></div>`;
    // 방 설정 시트 (시안 docs/mockups/orbit-top S1 · S2 · S3): 묶음 제목 + 흰 카드 + 줄(오른쪽에 지금 값). 줄을 누르면 시트 안에서 그 화면으로.
    // 줄은 시안 그대로 다 있어요(소망). 지금 되는 것: 찾기 · 북마크 · 휴지통, 방 이름, 사람, 방 지우기. 나머지 줄(마리나라 채팅 설정의 줄 전부, 고급 매개변수만 빼요: 채팅 분기 · 갤러리 · 연결 · 프롬프트 프리셋 · 페르소나 · 채팅 변수 · 로어북 · 활성 컨텍스트 · 기억 회상 · 기능 호출 · 번역 · 자동 요약 · 연결된 채팅 · 자율 메시지)과 머리의 ⋯는 na_ob_soon(알림만)이고, 동작이 생기면 이어요
    const T = o.set, setSheet = (() => { if (!T) return '';
        const rw = (v, k, l, val = '') => `<button type="button" class="os_rw ${v ? 'na_ob_srow' : 'na_ob_soon'}" data-v="${v}" aria-label="${l}">${lu(k, 18)}<span class="os_l">${l}</span><span class="os_v">${esc(val)}</span><i class="os_ch">${lu('chevron-right', 16)}</i></button>`;
        const hd = (t, sub) => `<div class="os_hd${sub ? ' sub' : ''}">${sub ? `<button type="button" class="os_ib na_ob_sback" aria-label="뒤로">${lu('chevron-left', 20)}</button>` : ''}<b>${t}</b>${sub ? '' : `<button type="button" class="os_ib na_ob_soon" aria-label="설정 더 보기">${lu('ellipsis', 18)}</button>`}<button type="button" class="os_ib na_ob_sx" aria-label="닫기">${lu('x', 19)}</button></div>`;
        const item = (x, tail, note = '') => `<div class="os_it"><div class="os_x">${esc(x.text)}</div>${x.ko ? `<div class="os_k">${esc(x.ko)}</div>` : ''}${note ? `<div class="os_nt">${esc(note)}</div>` : ''}<div class="os_m">${x.pin ? lu('pin', 12) : ''}<b>${esc(x.from)}</b><span class="cg_num">${esc(x.when)}</span><i class="os_sp"></i>${tail}</div></div>`;
        const none = t => `<div class="os_no">${t}</div>`;
        let head = hd('채팅 설정'), body = '';
        if (T.page === 'main') body = `<div class="os_cap">채팅</div><div class="os_cd">${rw('find', 'search', '메시지 검색', T.marks ? `북마크 ${T.marks}` : '')}${rw('name', 'type', '채팅 제목', T.title)}${rw('people', 'users', '캐릭터', String(T.count))}${rw('', 'git-branch', '채팅 분기')}${rw('', 'images', '갤러리')}</div>
            <div class="os_cap">생성</div><div class="os_cd">${rw('', 'plug', '연결')}${rw('', 'file-text', '프롬프트 프리셋')}${rw('', 'venetian-mask', '페르소나', T.me)}${rw('', 'braces', '채팅 변수')}${rw('', 'book-open', '로어북')}${rw('', 'scan-text', '활성 컨텍스트')}${rw('', 'brain', '기억 회상')}${rw('', 'wrench', '기능 호출')}${rw('', 'languages', '번역')}${rw('', 'calendar-clock', '자동 요약')}</div>
            <div class="os_cap">연결</div><div class="os_cd">${rw('', 'link', '연결된 채팅')}${rw('', 'bot', '자율 메시지')}</div><div class="os_cap"></div><div class="os_cd"><button type="button" class="os_rw red na_ob_sdrop">${lu('trash-2', 18)}<span class="os_l">채팅 삭제</span></button></div>`;
        else if (T.page === 'find') { head = hd('메시지 검색', true);
            const go = x => `<button type="button" class="os_go na_ob_sgo" data-id="${esc(x.id)}">메시지로 이동</button>`;
            body = `<div class="os_sg">${[['search', '검색'], ['marks', '북마크'], ['trash', '휴지통']].map(([k, t]) => `<button type="button" class="na_ob_stab${T.tab === k ? ' on' : ''}" data-v="${k}">${t}</button>`).join('')}</div>`
                + (T.tab === 'search' ? `<div class="os_q">${lu('search', 16)}<div class="os_qi na_ob_sq" contenteditable="true" role="textbox" enterkeyhint="search" spellcheck="false" data-ph="텍스트 검색" aria-label="메시지 검색">${esc(T.q)}</div></div>${T.items.length ? `<div class="os_cd">${T.items.map(x => item(x, go(x))).join('')}</div>` : T.q.trim() ? none('검색 결과가 없어요') : ''}`
                    : T.tab === 'marks' ? (T.items.length ? `<div class="os_cd">${T.items.map(x => item(x, go(x), x.note)).join('')}</div>` : none('북마크하거나 메모한 메시지가 여기 모여요'))
                    : (T.items.length ? `<div class="os_cd">${T.items.map(x => item(x, `<button type="button" class="os_go na_ob_srest" data-id="${esc(x.id)}">${lu('rotate-ccw', 12, 2.2)}복원</button>`)).join('')}</div><div class="os_ft"><span>삭제한 메시지는 30일 뒤 사라져요</span><button type="button" class="na_ob_sempty">휴지통 비우기</button></div>` : none('삭제한 메시지는 30일 동안 여기 남아요'))); }
        else if (T.page === 'name') { head = hd('채팅 제목', true); body = `<div class="os_q"><div class="os_qi na_ob_snm" contenteditable="true" role="textbox" enterkeyhint="done" spellcheck="false" data-ph="${esc(T.auto)}" aria-label="채팅 제목">${esc(T.name)}</div></div><button type="button" class="os_ok na_ob_snok">저장</button>`; }
        else if (T.page === 'people') { head = hd('캐릭터', true);
            body = `<div class="os_cd">${T.members.map(n => `<div class="os_pp">${face(n, 32)}<span class="os_l">${esc(n)}</span>${T.group ? `<button type="button" class="os_ib na_ob_prem" data-n="${esc(n)}" aria-label="${esc(n)} 제외">${lu('x', 16)}</button>` : ''}</div>`).join('')}</div>`
                + (T.more.length ? `<div class="os_cap">추가</div><div class="os_cd">${T.more.map(n => `<div class="os_pp">${face(n, 32)}<span class="os_l">${esc(n)}</span><button type="button" class="os_ib na_ob_padd" data-n="${esc(n)}" aria-label="${esc(n)} 추가">${lu('plus', 17)}</button></div>`).join('')}</div>` : ''); }
        return `<div class="ob_shade na_ob_sx"></div><div class="ob_sheet os_sh"><i class="ob_grab"></i>${head}<div class="os_bd">${body}</div></div>`; })();
    const holding = o.msgs.some(x => x.held);
    // 방 화면(시안 docs/mockups/orbit-top A_glass · X2, docs/design/orbit-marinara.md 1-3): 연한 바탕 + 그 사람 빛, 작은 유리 머리 한 줄(‹ · 얼굴 · 이름 · ⋯).
    // 어두운 방(o.dark)은 .ob_bg.dk 뒤의 형제들로 색을 바꿔요. --obc = 그 사람 색(어두운 방의 내 말풍선 · 보내기에 섞어요)
    const au = auraOf(o.title, o.group), fg = o.dark ? '#fff' : '#1e2026', obc = o.dark ? ` style="--obc:${au[3]}"` : '';
    return `<div class="ob_bg${o.dark ? ' dk' : ''}" data-bar="${o.dark ? '#131417' : mix('#f5f2f3', au[3], 0.3)}"><span class="ob_blob" style="background:${orbitBg(o.title, o.group)}"></span></div>${axBar(p, o.clock || now, fg)}
      <div class="ob_ct"><button type="button" class="ob_gb" data-go="orbit" aria-label="뒤로">${lu('chevron-left', 20)}</button>${o.faceOf ? `<button type="button" class="ob_fb ob_hf na_ob_face" data-n="${esc(o.faceOf)}" aria-label="프사 바꾸기">${face(o.title, 28, o.group)}<i class="ob_dot"></i></button>` : `<span class="ob_hf">${face(o.title, 28, o.group)}${o.group ? '' : '<i class="ob_dot"></i>'}</span>`}<span class="ob_nm"><b><i>${esc(o.title)}</i>${o.there ? `<em class="ob_lt cg_num">${ic(o.there.icon, 11, 'currentColor', 2.2)}${esc(o.there.time)}</em>` : ''}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ''}</span>${o.asOwner ? '' : `<button type="button" class="ob_tb na_ob_find" aria-label="메시지 검색">${lu('search', 18)}</button><button type="button" class="ob_tb na_ob_set" aria-label="채팅 설정">${lu('settings-2', 18)}</button>`}<button type="button" class="ob_tb na_ob_more${o.menu ? ' on' : ''}" aria-label="더 보기">${lu('ellipsis', 18)}</button></div>
      ${o.menu ? `<div class="ob_mx na_ob_mx"></div><div class="ob_menu"><button type="button" class="ob_mr na_ob_dark">${lu(o.dark ? 'sun' : 'moon', 17)}<span>${o.dark ? '라이트 모드' : '다크 모드'}</span></button></div>` : ''}
      ${o.chips.length ? `<div class="ob_chips">${o.chips.map(c => `<span class="ob_chip">${ic(c.icon, 13, '#fff')}${esc(c.text)}</span>`).join('')}</div>` : ''}
      <div${obc} class="ob_msgs ax_scroll${o.fixing ? ' fixing' : ''}${o.asOwner ? ' ro' : ''}${holding ? ' hold na_ob_hold' : ''}${o.picking != null ? ' picking' : ''}"><div class="ob_mi">${o.msgs.map((x, i) => msg(x, i)).join('')}${o.snapBusy ? '<div class="ob_fail ob_note"><span>이야기 정리 중</span></div>' : o.typing ? '<div class="ob_typ ob_glass" aria-label="입력 중"><i></i><i></i><i></i></div>' : ''}${o.fail ? `<div class="ob_fail"><span>답장을 못 받았어요</span><button type="button" class="ob_retry na_ob_retry" data-id="${esc(o.fail.id)}">다시</button></div>` : ''}</div></div>
      ${o.asOwner ? '' : o.picking != null ? `<div class="ob_inp ob_pbar"><span>${o.picking}개 선택</span><span class="ob_pbtn"><button type="button" class="na_ob_ptr"${o.picking ? '' : ' disabled'}>재번역</button><button type="button" class="na_ob_pdel red"${o.picking ? '' : ' disabled'}>삭제</button><button type="button" class="na_ob_pquit">취소</button></span></div>`
        : `<div${obc} class="ob_inp"><button type="button" class="ob_ci na_ob_soon" aria-label="사진 · 파일">${lu('paperclip', 21)}</button><button type="button" class="ob_ci na_ob_soon" aria-label="빠른 전환">${lu('chevron-up', 22, 2.2)}</button><div class="ob_msgin na_ob_in" contenteditable="true" role="textbox" enterkeyhint="send" spellcheck="false" data-ph="메시지" aria-label="메시지">${esc(o.draft || '')}</div><button type="button" class="ob_ci na_ob_soon" aria-label="이모지">${lu('smile', 22)}</button><button type="button" class="ob_send na_ob_send" aria-label="보내기">${lu('arrow-right', 19, 2.4)}</button></div>`}
      ${sheet}${setSheet}
      ${o.note ? `<div class="ob_shade na_ob_ntx"></div><div class="ob_sheet ob_bks ob_nts"><i class="ob_grab"></i><div class="ob_bkh"><b>메모</b></div><div class="ob_bkt na_ob_nttx" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="false" aria-label="메모">${esc(o.note.text)}</div><div class="ob_bkb"><button type="button" class="ob_bkno na_ob_ntx">취소</button><button type="button" class="ob_bkok na_ob_ntok">저장</button></div></div>` : ''}
      ${axInd(fg)}`;
}

// 새 대화 (시안 A): 사람 고르기, 둘 이상이면 단체방 이름
// o: { people: [{ name, sub }], picked: [name], gname, imp: { messages } (맨 위 채팅 가져오기 줄) }
export function orbitNew(p, now, o) {
    const on = n => o.picked.some(x => x.toLowerCase() === n.toLowerCase()), n = o.picked.length;
    return `${axBar(p, o.clock || now)}
      <div class="ob_top"><button type="button" class="ob_cb" data-go="orbit" aria-label="뒤로">${ic('back', 20)}</button><b class="ob_h1">새 대화</b><span class="ob_cb0"></span></div>
      <div class="ob_scroll ax_scroll">
        ${n ? `<div class="ob_picked">${o.picked.map(x => `<span class="ob_pk na_ob_pick" role="button" tabindex="0" data-n="${esc(x)}">${face(x, 52)}<span class="ob_x">${ic('x', 11, '#fff', 3)}</span>${esc(x)}</span>`).join('')}</div>` : ''}
        ${n > 1 ? `<div class="ob_gname"><span class="ob_blob" style="background:${orbitBg('', true)}"></span><span class="ob_gl"></span><div class="ob_in0"><small>단체방 이름</small><div class="ob_gin na_ob_gname" contenteditable="true" role="textbox" enterkeyhint="done" spellcheck="false" data-ph="${esc(o.picked.join(', '))}">${esc(o.gname || '')}</div></div></div>` : ''}
        ${o.imp ? `<div class="ob_list ob_impl"><div class="ob_rm" role="button" tabindex="0" data-go="liveimport"><span class="ls_ic chat">${ic('chat', 18, '#3d7a4a')}</span><span class="ob_t"><b>채팅 가져오기</b>${o.imp.messages ? `<span class="ob_p">새 메시지 ${o.imp.messages}개</span>` : ''}</span>${ic('chev', 16, '#bfc2c7', 2.2)}</div></div>` : ''}
        <div class="ob_sec">사람</div>
        <div class="ob_list">${o.people.map(x => `<div class="ob_rm na_ob_pick" role="button" tabindex="0" data-n="${esc(x.name)}">${face(x.name, 46)}<span class="ob_t"><b>${esc(x.name)}</b>${x.sub ? `<span class="ob_p">${esc(x.sub)}</span>` : ''}</span><span class="ob_ck${on(x.name) ? ' on' : ''}">${on(x.name) ? ic('chk', 15, '#fff', 3) : ''}</span></div>`).join('')}</div>
        <i class="ob_pad"></i>
      </div>
      ${n ? `<button type="button" class="ob_go na_ob_make">${n > 1 ? `단체방 만들기 <em>· 나 포함 ${n + 1}명</em>` : '대화하기'}</button>` : ''}
      ${axInd()}`;
}

// 실시간 폰 시작 (시안 docs/mockups/phone2-start C): 노을 카드(나 · 지금 시각 · 날짜 · 현실과의 차이), 고르기 줄, 검정 알약.
// 줄(시안 docs/mockups/phone2-import S1): 이야기에서 시작(타임라인 폰이 있을 때만) · 이 채팅에서 가져오기 · 파일에서 가져오기.
// o: { persona, local, date, shift, upto (이야기 줄의 글; null이면 이야기 줄 없음), pick: 'story' | 'chat' | 'file' | '',
//      chat: { messages, bubbles, again }, file: { names, messages, bubbles } | null, back (뒤로 갈 곳), title, busy }
export function liveStart(p, now, o) {
    const row = (k, tint, off, title, sub) => { const on = o.pick === k && !off; return `<div class="ob_rm ls_opt na_ls_pick${on ? ' on' : ''}${off ? ' off' : ''}" role="button" tabindex="0" data-v="${k}"><span class="ls_ic ${k}">${ic({ story: 'book', chat: 'chat', file: 'file' }[k], 18, tint)}</span><span class="ob_t"><b>${esc(title)}</b>${sub ? `<span class="ob_p">${esc(sub)}</span>` : ''}</span><span class="ob_ck${on ? ' on' : ''}">${on ? ic('chk', 14, '#fff', 3) : ''}</span></div>`; };
    const c = o.chat || { messages: 0, bubbles: 0 }, f = o.file, n = x => `메시지 ${x.messages}개 · 말풍선 ${x.bubbles}개`;
    return `${axBar(p, now)}
      <div class="ob_top"><button type="button" class="ob_cb" data-go="${esc(o.back || 'set')}" aria-label="뒤로">${ic('back', 20)}</button><b class="ob_h1">${esc(o.title || '실시간')}</b><span class="ob_cb0"></span></div>
      <div class="ob_scroll ax_scroll">
        <div class="ob_hero ls_hero"><span class="ob_blob ls_bg"></span><span class="ob_gl"></span><div class="ob_in"><small>${esc(o.persona)} 지금</small><div class="ob_big cg_num">${esc(o.local)}<em>${esc(o.date)}</em></div>${o.shift ? `<span class="ls_pill">${esc(o.shift)}</span>` : ''}</div></div>
        <div class="ob_list">${o.upto == null ? '' : row('story', '#2c4a80', false, '이야기에서 시작', o.upto)}${row('chat', '#3d7a4a', !c.messages, '이 채팅에서 가져오기', c.messages ? (c.again ? `새 ${n(c)}` : n(c)) : c.again ? '새 메시지 없음' : '')}${row('file', '#8a6a2a', false, '파일에서 가져오기', f ? `${f.names.length ? `${f.names.join(', ')} · ` : ''}${f.again ? '새 ' : ''}${n(f)}` : '.jsonl')}</div>
        <i class="ob_pad"></i>
      </div>
      <button type="button" class="ob_go na_ob_start"${o.busy || !o.pick ? ' disabled' : ''}>${o.busy ? esc(o.busy) : o.pick === 'story' || !o.pick && o.upto != null ? '시작' : '가져오기'}</button>
      ${axInd()}`;
}

// 폰도 인물도 없는 채팅의 첫 화면 (시안 docs/mockups/phone2-import R3, 타일은 G5 장미 · 복숭아 그라데이션: 번지는 공이 티 나지 않게, 그림 없이): 큰 제목, 밑줄 이름 칸, 검정 알약,
// 그 아래 작은 "메신저 채팅 가져오기". o: { name (적던 이름), tint (타일 색 번호), live (실시간 폰이 이미 있음: 가져오기 대신 그리로) }
// 타일 색 다섯 (시안 sheetTile G1~G5: 산호 · 초록 살구 · 물빛 · 호박 · 장미 복숭아). 폰을 열 때마다 하나를 골라요(o.tint)
const WH_TINT = [['#ee9184', '#f6c0a7'], ['#8ecf98', '#e6d29a'], ['#7fc4d4', '#abdcd4'], ['#e3b278', '#f2d1a3'], ['#f2a6b5', '#f6c2a8']];
export function whoScreen(now, o = {}) {
    const t = Math.abs(Math.trunc(Number(o.tint) || 0)) % WH_TINT.length;
    return `${axBar({}, now)}
      <div class="wh_body"><span class="wh_ic" style="--wa:${WH_TINT[t][0]};--wb:${WH_TINT[t][1]}"></span><b class="wh_h">누구의<br>폰인가요</b>
        <div class="wh_in na_who_in" contenteditable="true" role="textbox" enterkeyhint="done" spellcheck="false" data-ph="인물 이름" aria-label="인물 이름">${esc(o.name || '')}</div></div>
      <button type="button" class="ob_go wh_go na_who_ok">폰 보기</button>
      ${o.live ? `<button type="button" class="wh_imp na_ph_pmode" data-v="live">${ic('chat', 15, '#5b6170')}실시간 폰으로</button>` : `<button type="button" class="wh_imp" data-go="livestart">${ic('chat', 15, '#5b6170')}메신저 채팅 가져오기</button>`}
      ${axInd()}`;
}

// 프사 바꾸기 (시안 docs/mockups/phone2-edit sheetCrop C1 + 소망이 그린 큰 네모 두 칸 갤러리): 그 사람 방 색 전체 화면.
// 위는 사진 + 둥근 틀(끌어서 옮기고 막대 · 두 손가락으로 크기), 아래는 모아 둔 사진 두 칸 격자(맨 앞은 더하기, 고른 칸의 오른쪽 위 ×로 지우기), 아래로 굴려요. 맨 아래 "이대로 쓰기".
// o: { name, back (뒤로 갈 곳), src (틀에 올린 사진; 없으면 빈 틀), album: [{ url, on }], busy }
export function orbitFace(p, now, o) {
    return `<div class="ob_bg"><span class="ob_blob" style="background:${orbitBg(o.name)}"></span></div>${axBar(p, o.clock || now, '#fff')}
      <div class="of_top"><button type="button" class="ob_cb of_cb" data-go="${esc(o.back || 'orbit')}" aria-label="뒤로">${ic('back', 20, '#1b1d24', 2.2)}</button><b class="of_h">${esc(o.name)}</b><span class="ob_cb0"></span></div>
      <div class="of_scroll ax_scroll">
        <div class="of_stage na_of_stage">${o.src ? `<img class="of_img na_of_img" src="${esc(o.src)}" alt="" draggable="false">` : ''}<i class="of_ring"></i></div>
        <div class="of_zoom${o.src ? '' : ' off'}"><span>작게</span><div class="of_tr na_of_tr" role="slider" tabindex="0" aria-label="크기"><i class="of_th na_of_th"></i></div><span>크게</span></div>
        <div class="of_grid"><button type="button" class="of_add na_of_add" aria-label="사진 더하기">${ic('plus', 22, '#fff', 2.2)}</button>${o.album.map((x, i) => `<div class="of_cell"><button type="button" class="of_pic na_of_pic${x.on ? ' on' : ''}" data-i="${i}"><img src="${esc(x.url)}" alt="" loading="lazy" decoding="async"></button>${x.on && x.url.startsWith('data:') ? `<button type="button" class="of_del na_of_del" data-i="${i}" aria-label="사진 지우기">${ic('x', 14, '#fff', 2.6)}</button>` : ''}</div>`).join('')}</div>
        <i class="of_pad"></i>
      </div>
      <button type="button" class="ob_go of_go na_of_ok"${o.busy || !o.src ? ' disabled' : ''}>이대로 쓰기</button>
      ${axInd('#fff')}`;
}

