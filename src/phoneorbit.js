// Orbit: 실시간 폰(폰 2)의 메신저 화면 (docs/design/orbit.md, 시안 docs/mockups/phone2-messenger · phone2-orbit).
// 목록 · 새 대화는 흰 카드 + 검정 알약(시안 A), 방 안은 그 사람 색 오로라 바탕 + 유리(시안 C).
// 화면만 그려요: 폰 2를 읽는 건 phone.js가 하고, 이 파일은 그 결과(ui.orbit)만 받아요(폰 2 파일을 부르지 않아요).
// 설명 글은 쓰지 않아요(몰입이 깨져요). 화면에 나오는 건 이름 · 말 · 시각 · 상태 낱말뿐이에요.
import { esc } from './util.js';
import { axBar, axInd } from './phoneapps.js';
import { faceOf, stFace } from './people.js';
import { orbitSetPage, orbitSwitcher, orbitThink, orbitPeek, ORBIT_SET_TITLES } from './phoneorbitset.js';

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
    'bell': '<path d="M10.268 21a2 2 0 0 0 3.464 0" /> <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />',
    'external-link': '<path d="M15 3h6v6" /> <path d="M10 14 21 3" /> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />',
    'circle-help': '<circle cx="12" cy="12" r="10" /> <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /> <path d="M12 17h.01" />',
    'star': '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />',
    'lock-open': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /> <path d="M7 11V7a5 5 0 0 1 9.9-1" />',
    'messages-square': '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" /> <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />',
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
    'keyboard': '<path d="M10 8h.01" /><path d="M12 12h.01" /><path d="M14 8h.01" /><path d="M16 12h.01" /><path d="M18 8h.01" /><path d="M6 8h.01" /><path d="M7 16h10" /><path d="M8 12h.01" /><rect width="20" height="16" x="2" y="4" rx="2" />',
    'hand': '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" /><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" /><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />',
    'paw-print': '<circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" /><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />',
    'pizza': '<path d="m12 14-1 1" /><path d="m13.75 18.25-1.25 1.42" /><path d="M17.775 5.654a15.68 15.68 0 0 0-12.121 12.12" /><path d="M18.8 9.3a1 1 0 0 0 2.1 7.7" /><path d="M21.964 20.732a1 1 0 0 1-1.232 1.232l-18-5a1 1 0 0 1-.695-1.232A19.68 19.68 0 0 1 15.732 2.037a1 1 0 0 1 1.232.695z" />',
    'car': '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" />',
    'volleyball': '<path d="M11.1 7.1a16.55 16.55 0 0 1 10.9 4" /><path d="M12 12a12.6 12.6 0 0 1-8.7 5" /><path d="M16.8 13.6a16.55 16.55 0 0 1-9 7.5" /><path d="M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10" /><path d="M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5" /><circle cx="12" cy="12" r="10" />',
    'lightbulb': '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" />',
    'shapes': '<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z" /><rect x="3" y="14" width="7" height="7" rx="1" /><circle cx="17.5" cy="17.5" r="3.5" />',
    'flag': '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" />',
    'clock': '<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />',
    'locate-fixed': '<line x1="2" x2="5" y1="12" y2="12" /><line x1="19" x2="22" y1="12" y2="12" /><line x1="12" x2="12" y1="2" y2="5" /><line x1="12" x2="12" y1="19" y2="22" /><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="3" />',
    'sparkles': '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" />',
    'chevron-down': '<path d="m6 9 6 6 6-6" />',
    'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />',
    'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />',
    'arrow-right': '<path d="M5 12h14" /><path d="m12 5 7 7-7 7" />',
};
const lu = (k, s = 18, w = 2) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${LU[k]}</svg>`;
// 두 색 섞기(#rrggbb, t = 뒤 색의 몫): 껍데기 앱의 기기 바 색을 방 바탕에 맞춰요
const mix = (a, b, t) => `#${[1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('')}`;
// 그 사람 현지 시각의 아이콘: 05~17 해 · 17~21 저녁 · 21~05 달 (날씨 하늘과 같은 경계)
export const dayIcon = hhmm => { const h = Number(String(hhmm || '').slice(0, 2)); return h >= 5 && h < 17 ? 'sun' : h >= 17 && h < 21 ? 'set' : 'moon'; };

// 얼굴: 그 사람 색 동그라미 + 첫 글자
// 얼굴: 인물 도감에서 정한 프사(없으면 실리 아바타)가 있으면 그 그림, 없으면 색 동그라미 + 첫 글자. 단체방은 늘 보라 동그라미
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
        ${rooms.length ? `<div class="ob_list">${rooms.map(r => `<div class="ob_rm" role="button" tabindex="0" data-go="orbitroom" data-i="${esc(r.id)}">${face(r.title, 50, r.group)}<span class="ob_t"><b>${esc(r.title)}</b>${r.live ? `<span class="ob_p ob_lv">${r.live.spin ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>' : ''}<span>${esc(r.live.t)}</span></span>` : `<span class="ob_p">${r.last ? `${r.lastWho ? `${esc(r.lastWho)}: ` : ''}${esc(r.last)}` : ''}</span>`}</span><span class="ob_r"><span class="cg_num">${esc(r.time || '')}</span>${r.unread ? `<span class="ob_un cg_num">${r.unread}</span>` : '<span class="ob_un0"></span>'}</span></div>`).join('')}</div>` : ''}
        <i class="ob_pad"></i>
      </div>
      ${a.ro ? '' : `<button type="button" class="ob_dock" data-go="orbitnew">${ic('plus', 16, '#fff', 2.4)}새 대화</button>`}
      ${bk?.sheet ? `<div class="ob_shade na_ob_bkno"></div><div class="ob_sheet ob_bks"><i class="ob_grab"></i><div class="ob_bkh"><b>롤플에 넣기</b><span>말 ${bk.sheet.count}개</span></div><div class="ob_bkt na_ob_bktx" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="false" aria-label="넣을 글">${esc(bk.sheet.text)}</div>${bk.sheet.more ? `<div class="ob_bkm">남은 말 ${bk.sheet.more}개는 한 번 더</div>` : ''}<div class="ob_bkb"><button type="button" class="ob_bkno na_ob_bkno">취소</button><button type="button" class="ob_bkok na_ob_bkok"${bk.busy ? ' disabled' : ''}>넣기</button></div></div>` : ''}
      ${a.sheet ? `<div class="ob_shade na_ob_shade"></div><div class="ob_sheet"><i class="ob_grab"></i>${a.list.map(x => `<div class="ob_acc na_ob_who" role="button" tabindex="0" data-n="${esc(x.name)}"><button type="button" class="ob_fb na_ob_face" data-n="${esc(x.name)}" aria-label="프사 바꾸기">${face(x.name, 40)}</button><span class="ob_t"><b>${esc(x.name)}</b>${x.sub ? `<span class="ob_p">${esc(x.sub)}</span>` : ''}</span><span class="ob_ck${x.on ? ' on' : ''}">${x.on ? ic('chk', 14, '#fff', 3) : ''}</span></div>`).join('')}</div>` : ''}
      ${orbitAlerts(o)}
      ${axInd()}`;
}

// 캐릭터가 먼저 건 말의 알림 (마리나라의 ConversationAutonomousEffects · ChatNotificationBubbles):
//   band: { name } 지금 보는 방에 왔을 때 오른쪽 위에 5초 뜨는 띠 · bubs: [{ id, name, count }] 다른 방에 왔을 때 오른쪽 가장자리의 프사 방울(누르면 그 방으로, ✕는 지우기)
//   방울이 2개 이상이면 마리나라의 모바일 모양대로 하나로 묶어요: 프사 3개까지 겹치고 합계 배지, 누르면 펼쳐요(nbOpen)
const orbitAlerts = o => { const bs = o.bubs || [], sum = bs.reduce((n, b) => n + b.count, 0), num = n => (n > 99 ? '99+' : n);
    const one = b => `<span class="ob_nbi"><button type="button" class="ob_nbf na_ob_nb" data-id="${esc(b.id)}" aria-label="${esc(b.name)}님이 메시지를 보냈습니다" title="${esc(b.name)}님이 메시지를 보냈습니다">${face(b.name, 44)}</button><b class="cg_num">${num(b.count)}</b><button type="button" class="ob_nbx na_ob_nbx" data-id="${esc(b.id)}" aria-label="알림 지우기">${lu('x', 11, 2.6)}</button></span>`;
    const group = `<button type="button" class="ob_nbg na_ob_nbg" aria-label="대화 ${bs.length}개" title="대화 ${bs.length}개">${bs.slice(0, 3).map((b, i) => `<span class="ob_nbs" style="top:${i * 5}px;right:${i * 5}px;z-index:${3 - i}">${face(b.name, 40)}</span>`).join('')}<b class="cg_num">${num(sum)}</b></button>`;
    return `${o.band ? `<div class="ob_band" role="status"><span>${esc(o.band.name)}님이 메시지를 보냈습니다</span><button type="button" class="na_ob_bandx" aria-label="닫기">${lu('x', 13, 2.4)}</button></div>` : ''}${bs.length ? `<div class="ob_nb">${bs.length === 1 || o.nbOpen ? bs.map(one).join('') : group}</div>` : ''}`; };

// 방 안 (시안 C): 그 사람 색 바탕, 유리 머리줄 · 말풍선 · 입력칸
// o: { id, title, group, sub, there: { icon, time } (1:1 상대의 현지 시각이 내 시각과 다를 때: 이름 바로 옆에 낮 · 저녁 · 밤 그림 + 시각, 시안 sheetCut2의 6), chips: [{ icon, text }], asOwner (주인 계정: 읽기만), draft, clock, faceOf (1:1 · 내 계정: 머리줄 얼굴을 누르면 그 사람 프사 바꾸기),
//      msgs: [{ day } | { mine, from, text, ko, time, unread, id, open, held (길게 눌린 말), pick (고르는 중: true | false), wait (번역 중), reply (맨 끝 답장 묶음), dots (그 묶음의 마지막 말) }],
//      swipe: { at, count } | null (맨 끝 답장 넘기기), picking: 고른 수 | null,
//      list: { items: [{ no, now, bubbles: [{ text, ko }] }], picks: [no], busy (답장이 오는 중: 지우기 막힘) } | null (받아 둔 답장 창) }
// 말 고치기 (시안 docs/mockups/phone2-edit M3 · W3): 길게 누르면 그 말 위 검정 알약(재번역 · 선택 · 삭제, 맨 끝 답장이면 빨간 "답장 버리기"도. 빨강은 그것 하나만),
// 선택이면 말마다 동그라미 + 입력칸 자리의 줄, 맨 끝 답장 아래 점(옆으로 밀어서 넘겨요)
export function orbitRoom(p, now, o) {
    // (번역 줄 · 배지 이모지는 span이 아니에요: 소망 테마가 span의 글꼴을 따로 정해서, span 안의 이모지만 기기 이모지가 아니었어요 — !emoji 시험 화면으로 확인)
    const koOf = (x, tail = '') => (x.wait ? `<div class="ob_ko ob_wait"><i class="fa-solid fa-spinner fa-spin"></i> 번역 중</div>`
        : x.ko ? (x.open ? `<div class="ob_ko na_ob_ko" role="button" tabindex="0" data-id="${esc(x.id)}">${esc(x.ko)}${tail}${x.edited && !x.mine ? '<span class="ob_edm">수정됨</span>' : ''}</div>` : `<span class="ob_kof na_ob_ko" role="button" tabindex="0" data-id="${esc(x.id)}">${ic('tr', 13)}번역 보기</span>`) : '');
    // 길게 누른 카드 (시안 docs/mockups/shell-bars Q2): 윗줄은 빠른 반응 6개 + "+"(폰 이모지 키보드), 아랫줄은 재번역 · 선택 · 삭제 (· 답장 버리기). 내가 단 반응은 동그랗게
    const reRow = x => (o.quick?.length ? `<div class="ob_hr">${o.quick.map(e => `<button type="button" class="na_ob_re${x.myre === e ? ' on' : ''}" data-id="${esc(x.id)}" data-e="${esc(e)}" aria-label="${esc(e)} 반응">${esc(e)}</button>`).join('')}<span class="ob_hp na_ob_reany${x.myre && !o.quick.includes(x.myre) ? ' on' : ''}" role="button" tabindex="0" aria-label="다른 이모지">${x.myre && !o.quick.includes(x.myre) ? esc(x.myre) : ic('plus', 17, 'currentColor', 2.2)}<input class="ob_rein" data-id="${esc(x.id)}" inputmode="text" enterkeyhint="done" autocomplete="off" aria-label="이모지 고르기"></span></div>` : '');
    // 길게 누른 판 (시안 docs/mockups/orbit-top M2): 말풍선 바로 아래 흰 판에 아이콘만. 반응을 누르면 같은 판이 이모지 줄로, 북마크를 누르면 북마크 · 고정 · 메모 줄로 바뀌어요(o.heldSub).
    // 켜진 것(북마크 · 고정 · 메모가 있음, AI에게 숨김)은 옅은 칸. 빨강은 삭제. 시안의 12칸 + 선택(소망). 동작이 아직 없는 칸(답장 · 프롬프트 보기 · 생각 보기 · 분기)은 na_ob_soon(알림만)이고, 동작이 생기면 이어요
    const pill = x => { const mk = x.mk || {}, me = x.mine ? ' me' : '', id = esc(x.id), ck = lu('check', 15, 2.4);
        const ib = (c, k, l, cls = '', off = false) => `<button type="button" class="${c}${cls}" data-id="${id}" aria-label="${l}"${off ? ' disabled' : ''}>${lu(k, 19, 1.8)}</button>`;
        const row = (c, k, l, on) => `<button type="button" class="ob_pr ${c}" data-id="${id}">${lu(k, 17)}<span>${l}</span>${on ? ck : ''}</button>`;
        if (o.heldSub === 're' && o.quick?.length) return `<div class="ob_pill ob_hc${me}">${reRow(x)}</div>`;
        if (o.heldSub === 'mark') return `<div class="ob_pill ob_pm${me}">${row('na_ob_mbm', 'bookmark', mk.b ? '북마크 제거' : '메시지 북마크', mk.b)}${mk.b ? `<div class="ob_pl"><div class="os_qi na_ob_mbl" data-id="${id}" contenteditable="true" role="textbox" enterkeyhint="done" spellcheck="false" data-ph="이름 (선택)" aria-label="북마크 이름">${esc(x.bl || '')}</div></div>` : ''}${row('na_ob_mpin', 'pin', mk.p ? '컨텍스트 고정 해제' : '컨텍스트에 고정', mk.p)}<div class="ob_ph">고정한 메시지는 기록 한도를 넘어도 남습니다(모델의 토큰 한도 안에서). 채팅당 최대 10개.</div>${row('na_ob_mnote', 'sticky-note', '비공개 메모', mk.n)}</div>`;
        return `<div class="ob_pill${me}">${ib('na_ob_mcopy', 'copy', '복사')}${ib('na_ob_mreply', 'reply', '답장', '', !String(x.text || '').trim())}${ib('na_ob_mre', 'smile-plus', '반응', x.myre ? ' on' : '')}${ib('na_ob_mtr', 'languages', '재번역')}${ib('na_ob_mregen', 'refresh-cw', '재생성')}${ib('na_ob_mmark', 'bookmark', '북마크 · 고정 · 메모', mk.b || mk.p || mk.n ? ' on' : '')}${ib('na_ob_mhide', 'eye-off', mk.h ? 'AI에게 표시' : 'AI에게 숨기기', mk.h ? ' on' : '')}${x.lastA ? ib('na_ob_mpeek', 'search', '프롬프트 보기') : ''}${ib('na_ob_mbranch', 'git-branch', '여기서 분기')}${x.mine ? '' : ib('na_ob_mthink', 'brain', '모델 생각 보기')}${ib('na_ob_medit', 'pencil', '수정')}${ib('na_ob_mpick', 'circle-check', '선택')}${ib('na_ob_mdel', 'trash-2', '삭제', ' red')}</div>`; };
    const dots = w => `<div class="ob_swd na_ob_swd" aria-label="답장 ${w.at}/${w.count}">${Array.from({ length: Math.min(w.count, 9) }, (_, i) => `<i class="${i === Math.min(w.at, 9) - 1 ? 'on' : ''}"></i>`).join('')}</div>`;
    // 묶음(시안 docs/mockups/shell-bars U1 · B2): 같은 사람이 이어 보낸 말은 붙은 쪽 모서리만 덜 둥글고(g1 첫 말 · gL 마지막 말),
    // 상대 묶음의 마지막 말 옆에 작은 얼굴. 내 말의 시간(+ 안 읽은 수)은 말풍선 안 오른쪽 아래, 내 마지막 말 밑엔 다 읽었으면 "읽음"
    const kind = x => (x.day ? '' : x.mine ? 'me' : `th:${x.from || ''}`), ks = o.msgs.map(kind);
    const lastMe = o.msgs.reduce((k, x, i) => (x.mine ? i : k), -1);
    // 답장 미리 보기 (마리나라 MessageReplyPreview): ↩ + "○○에게 답장" + 인용 두 줄. 입력칸 위 것에는 취소 ✕, 보낸 말 위 것에는 없어요
    const rq = (r, x = false) => `<span class="ob_rq${x ? ' ob_rp' : ''}">${lu('reply', 14)}<span><b>${esc(r.name)}에게 답장</b><i>${esc(r.content)}</i></span>${x ? `<button type="button" class="os_ib na_ob_rpx" aria-label="답장 취소">${lu('x', 15)}</button>` : ''}</span>`;
    // 말의 첨부 (x.atts: [{ img, url, name }]): 마리나라처럼 말풍선 밖, 말 바로 아래에 그림을 그대로 보여 줘요(소망: 말풍선 안에 넣으니 못생겼어요). 누르면 크게. 빼기(✕)는 늘 보이지 않고, 그 말(말풍선이나 첨부)을 길게 눌러 들었을 때만 첨부마다 떠요(소망).
    //   글 없이 첨부만 보낸 말은 말풍선 없이 첨부만 그리고(길게 누르기는 이 줄이 받아요), 시각을 아래에 작게 적어요
    const atr = x => (x.atts?.length ? `<div class="ob_atr${x.mine ? ' me' : ''} na_ob_b${x.held ? ' held' : ''}" data-id="${esc(x.id)}">${x.atts.map((a, i) => `<span class="ob_ati${a.img ? ' i' : ' ob_glass'}">${a.img ? `<img class="ob_ai na_ob_aimg" src="${esc(a.url)}" data-u="${esc(a.url)}" alt="${esc(a.name)}" loading="lazy">` : `${lu('file-text', 15)}<span>${esc(a.name)}</span>`}${!x.held || o.asOwner ? '' : `<button type="button" class="ob_ax na_ob_ax" data-id="${esc(x.id)}" data-i="${i}" aria-label="${esc(a.name)} 빼기">${lu('x', 13, 2.4)}</button>`}</span>`).join('')}${!x.text && (x.time || x.tl) ? `<span class="ob_att cg_num">${esc(x.time || x.tl)}</span>` : ''}</div>` : '');
    const msg = (x, i) => { if (x.day) return `<div class="ob_day">${esc(x.day)}</div>`;
        const g = `${ks[i - 1] !== ks[i] ? ' g1' : ''}${ks[i + 1] !== ks[i] ? ' gL' : ''}`;
        const ed = x.edited ? '<span class="ob_edm">수정됨</span>' : '';
        // 표시(북마크 · 고정 · 메모 · AI에게 숨김): 작은 아이콘. 내 말은 시간 앞, 캐릭터 말은 한국어 줄 끝(없으면 원문 끝)의 오른쪽. 숨긴 말은 말풍선도 옅게
        const koShown = !!(x.ko && x.open && !x.wait);
        const mk = x.mk || {}, mki = mk.b || mk.p || mk.n || mk.h ? `<span class="ob_mk">${mk.h ? lu('eye-off', 11, 2.2) : ''}${mk.p ? lu('pin', 11, 2.2) : ''}${mk.b ? lu('bookmark', 11, 2.2) : ''}${mk.n ? lu('sticky-note', 11, 2.2) : ''}</span>` : '';
        const tin = x.mine && x.time ? `<span class="ob_tin">${mki}${ed}${x.unread ? `<b>${x.unread}</b> ` : ''}<span class="cg_num">${esc(x.time)}</span></span>` : '';
        // 고치는 중(시안 E2): 원문 · 한국어가 그 자리에서 바로 고쳐지는 칸이 되고, 밑에 ✕ · ✓
        if (x.fix) return `<div class="ob_b ${x.mine ? 'me' : 'th ob_glass'}${g} ob_fix"><div class="ob_ft na_ob_ft" contenteditable="true" role="textbox" enterkeyhint="done" spellcheck="false" aria-label="원문">${esc(x.fix.t)}</div>${x.ko ? `<div class="ob_ko ob_fk na_ob_fk" contenteditable="true" role="textbox" enterkeyhint="done" spellcheck="false" aria-label="한국어">${esc(x.fix.k)}</div>` : ''}</div>`
            + `<div class="ob_fbar${x.mine ? ' me' : ''}"><button type="button" class="ob_fno na_ob_fno" aria-label="그만 고치기">${ic('x', 14, '#333', 2.4)}</button><button type="button" class="ob_fok na_ob_fok" aria-label="고치기">${ic('chk', 17, '#fff', 2.6)}</button></div>`;
        const av = !x.mine && ks[i + 1] !== ks[i] ? `<span class="ob_av">${face(x.from || o.title, 34)}</span>` : '';
        const re = x.re ? `<span class="ob_re${x.re.isNew ? ' new' : ''}"${x.re.isNew ? ` style="--ret:-${x.re.ago}ms"` : ''}>${x.re.es.map(e => `<i class="ob_ree">${esc(e)}</i>`).join('')}${x.re.n > 1 ? `<b class="cg_num">${x.re.n}</b>` : ''}</span>` : '';
        const bb = `<div class="ob_b na_ob_b ${x.mine ? 'me' : 'th ob_glass'}${g}${x.re ? ` has_re${x.re.isNew && x.re.ago < 220 ? ' re_new' : ''}` : ''}${x.held ? ' held' : ''}${mk.h ? ' hid' : ''}${x.reply ? ' na_ob_sw' : ''}" data-id="${esc(x.id)}">${x.rp ? rq(x.rp) : ''}${esc(x.text)}${(x.mine && x.time) || koShown ? '' : mki}${x.edited && !x.mine && !(x.ko && x.open && !x.wait) ? ed : ''}${koOf(x, !x.mine && koShown ? mki : '')}${tin}${av}${re}${!x.mine && !x.reply && x.tl ? `<span class="ob_tl cg_num">${esc(x.tl)}</span>` : ''}</div>`;
        return `${o.group && !x.mine && x.from ? `<div class="ob_sn">${esc(x.from)}</div>` : ''}${x.pick === undefined ? (x.text || !x.atts?.length ? bb : '') : `<div class="ob_prow na_ob_prow${x.mine ? ' me' : ''}" data-id="${esc(x.id)}"><span class="ob_pck${x.pick ? ' on' : ''}">${x.pick ? ic('chk', 13, '#fff', 3) : ''}</span>${bb}</div>`}${atr(x)}${x.held ? pill(x) : ''}${i === lastMe && x.time && !x.unread ? '<div class="ob_rd">읽음</div>' : ''}${x.dots && o.swipe ? dots(o.swipe) : ''}`; };
    // 받아 둔 답장 창 (시안 docs/mockups/phone2-edit sheetGlass2 "G3 + 말풍선"): 옅은 유리 창, 답장마다 번호 + 유리 말풍선, 지금 것은 번호가 검정이고 말풍선이 더 밝아요. 창 안에서 굴리고 제목 · 버튼은 고정
    const L = o.list, sheet = !L ? '' : `<div class="ob_shade ob_shl na_ob_slx"></div><div class="ob_sheet ob_sl" style="--sla:${orbitBg(o.title, o.group)}"><i class="ob_grab"></i><div class="ob_slh"><b>받아 둔 답장</b><span class="cg_num">${L.items.length}</span></div>
        <div class="ob_sls">${L.items.map(x => `<div class="ob_slr na_ob_slr${x.now ? ' now' : ''}" role="button" tabindex="0" data-n="${x.no}"><span class="ob_sln cg_num">${x.no}</span><div class="ob_slb">${x.bubbles.length ? x.bubbles.map(b => `<div class="ob_sll">${esc(b.text)}${b.ko ? `<small>${esc(b.ko)}</small>` : ''}</div>`).join('') : '<div class="ob_sll"><small>오는 중</small></div>'}</div><span class="ob_pck${L.picks.includes(x.no) ? ' on' : ''}">${L.picks.includes(x.no) ? ic('chk', 13, '#fff', 3) : ''}</span></div>`).join('')}</div>
        <div class="ob_bkb"><button type="button" class="ob_bkno na_ob_slkeep"${L.busy || L.items.length < 2 ? ' disabled' : ''}>지금 것만 남기기</button><button type="button" class="ob_bkok na_ob_sldrop"${L.busy || !L.picks.length ? ' disabled' : ''}>${L.picks.length ? `${L.picks.length}개 ` : ''}버리기</button></div></div>`;
    // 방 설정 시트 (시안 docs/mockups/orbit-top S1 · S2 · S3): 묶음 제목 + 흰 카드 + 줄(오른쪽에 지금 값). 줄을 누르면 시트 안에서 그 화면으로.
    // 줄은 시안 그대로 다 있어요(소망). 지금 되는 것: 찾기 · 북마크 · 휴지통, 방 이름, 사람, 방 지우기. 나머지 줄(마리나라 채팅 설정의 줄 전부, 고급 매개변수 · 채팅 변수만 빼요: 채팅 분기 · 갤러리 · 연결 · 프롬프트 프리셋 · 페르소나 · 로어북 · 활성 컨텍스트 · 기억 회상 · 기능 호출 · 번역 · 자동 요약 · 연결된 채팅)과 머리의 ⋯는 na_ob_soon(알림만)이고, 동작이 생기면 이어요
    const T = o.set, setSheet = (() => { if (!T) return '';
        const rw = (v, k, l, val = '') => `<button type="button" class="os_rw ${v ? 'na_ob_srow' : 'na_ob_soon'}" data-v="${v}" aria-label="${l}">${lu(k, 18)}<span class="os_l">${l}</span><span class="os_v">${esc(val)}</span><i class="os_ch">${lu('chevron-right', 16)}</i></button>`;
        const hd = (t, sub) => `<div class="os_hd${sub ? ' sub' : ''}">${sub ? `<button type="button" class="os_ib na_ob_sback" aria-label="뒤로">${lu('chevron-left', 20)}</button>` : ''}<b>${t}</b>${sub ? '' : [['circle-help', '도움말'], ['rotate-ccw', '보기 초기화'], ['star', '새 대화 채팅에 이 레이아웃 사용'], ['lock-open', '창 잠금']].map(([k, l]) => `<button type="button" class="os_ib na_ob_soon" aria-label="${l}">${lu(k, 17)}</button>`).join('')}<button type="button" class="os_ib na_ob_sx" aria-label="${sub ? '닫기' : '채팅 설정 닫기'}">${lu('x', 19)}</button></div>`;
        const item = (x, tail, note = '') => `<div class="os_it"><div class="os_x">${esc(x.text)}</div>${x.ko ? `<div class="os_k">${esc(x.ko)}</div>` : ''}${note ? `<div class="os_nt">${esc(note)}</div>` : ''}<div class="os_m">${x.pin ? lu('pin', 12) : ''}<b>${esc(x.from)}</b><span class="cg_num">${esc(x.when)}</span><i class="os_sp"></i>${tail}</div></div>`;
        const none = t => `<div class="os_no">${t}</div>`;
        let head = hd('채팅 설정'), body = '';
        // 맨 위 검색칸(소망: 검색은 설정 창에서 바로, 마리나라처럼): 글자를 넣으면 아래가 찾은 메시지로 바뀌어요. 북마크 · 휴지통은 줄로
        const go = x => `<button type="button" class="os_go na_ob_sgo" data-id="${esc(x.id)}">메시지로 이동</button>`;
        if (T.page === 'main') body = `<div class="os_q">${lu('search', 16)}<div class="os_qi na_ob_sq" contenteditable="true" role="textbox" enterkeyhint="search" spellcheck="false" data-ph="메시지 검색" aria-label="메시지 검색">${esc(T.q)}</div></div>` + (T.q.trim() ? (T.items.length ? `<div class="os_cd">${T.items.map(x => item(x, go(x))).join('')}</div>` : none('검색 결과가 없어요')) : `<div class="os_cap">채팅</div><div class="os_cd">${rw('marks', 'bookmark', '북마크', T.marks ? String(T.marks) : '')}${rw('trash', 'trash-2', '휴지통', T.trashN ? String(T.trashN) : '')}${rw('name', 'type', '채팅 제목', T.title)}${rw('people', 'users', '캐릭터', String(T.count))}${T.group ? rw('group', 'messages-square', '단체 채팅') : ''}${rw('branches', 'git-branch', '채팅 분기', '1')}${rw('gallery', 'images', '갤러리')}</div>
            <div class="os_cap">생성</div><div class="os_cd">${rw('profile', 'settings-2', '설정 프로필')}${rw('conn', 'plug', '연결')}${rw('preset', 'file-text', '프롬프트 프리셋')}${rw('persona', 'venetian-mask', '페르소나', T.me)}${rw('lore', 'book-open', '로어북')}${rw('ctx', 'scan-text', '활성 컨텍스트')}${rw('agents', 'sparkles', '에이전트')}${rw('memory', 'brain', '기억 회상')}${rw('trans', 'languages', '번역')}${rw('caption', 'images', '그림 설명', T.caption?.enabled ? '켬' : '끔')}${rw('sum', 'calendar-clock', '자동 요약')}</div>
            <div class="os_cap">연결</div><div class="os_cd">${rw('linked', 'link', '연결된 채팅')}${rw('auto', 'bot', '자율 메시지', T.autoOn ? '켜짐' : '꺼짐')}${rw('notify', 'bell', '알림')}</div><div class="os_cap"></div><div class="os_cd"><button type="button" class="os_rw red na_ob_sdrop">${lu('trash-2', 18)}<span class="os_l">채팅 삭제</span></button></div>`);
        else if (T.page === 'find') { head = hd(T.tab === 'marks' ? '북마크' : '휴지통', true);
            body = `<div class="os_sg">${[['marks', '북마크'], ['trash', '휴지통']].map(([k, t]) => `<button type="button" class="na_ob_stab${T.tab === k ? ' on' : ''}" data-v="${k}">${t}</button>`).join('')}</div>`
                + (T.tab === 'marks' ? (T.items.length ? `<div class="os_cd">${T.items.map(x => item(x, go(x), x.note)).join('')}</div>` : none('북마크하거나 메모한 메시지가 여기 모여요'))
                    : (T.items.length ? `<div class="os_cd">${T.items.map(x => item(x, `<button type="button" class="os_go na_ob_srest" data-id="${esc(x.id)}">${lu('rotate-ccw', 12, 2.2)}복원</button>`)).join('')}</div><div class="os_ft"><span>삭제한 메시지는 30일 뒤 사라져요</span>${T.items.length > 1 ? '<button type="button" class="na_ob_srestall">모두 복원</button>' : ''}<button type="button" class="na_ob_sempty">휴지통 비우기</button></div>` : none('삭제한 메시지는 30일 동안 여기 남아요'))); }
        else { head = hd(ORBIT_SET_TITLES[T.page] || '채팅 설정', true); body = orbitSetPage(T, face) || ''; }
        return `<div class="ob_shade na_ob_sx"></div><div class="ob_sheet os_sh"><i class="ob_grab"></i>${head}<div class="os_bd">${body}</div></div>`; })();
    // 이모지 판 (시안 docs/mockups/orbit-emoji): 입력칸 바로 위 카드. 탭은 이모지 · 카오모지 둘(소망), 검색칸, 분류 줄(이모지 그림 대신 선 아이콘, 소망: "다르게"), 격자. 목록 · 검색은 마리나라 것(src/marinara)
    const E = o.emo, emo = !E ? '' : `<div class="oe_p${E.tab === 'kao' ? ' kao' : ''}"><div class="os_sg oe_sg">${[['emoji', '이모지'], ['kao', '카오모지']].map(([k, t]) => `<button type="button" class="na_ob_etab${E.tab === k ? ' on' : ''}" data-v="${k}">${t}</button>`).join('')}</div>
        <div class="os_q oe_q">${lu('search', 16)}<div class="os_qi na_ob_eq" contenteditable="true" role="textbox" enterkeyhint="search" spellcheck="false" data-ph="${E.tab === 'kao' ? '카오모지 검색' : '이모지 검색'}" aria-label="검색">${esc(E.q)}</div></div>
        ${E.q.trim() ? '' : `<div class="oe_cat">${E.cats.map((c, i) => `<button type="button" class="na_ob_ecat${i === E.cat ? ' on' : ''}" data-i="${i}" aria-label="${esc(c.label)}">${c.lu ? lu(c.lu, 19, 1.8) : `<b>${esc(c.label)}</b>`}</button>`).join('')}</div>`}
        <div class="oe_sc">${E.title ? `<div class="os_cap">${esc(E.title)}</div>` : ''}${E.items.length ? `<div class="oe_gr">${E.items.map(e => `<button type="button" class="na_ob_ei" data-e="${esc(e)}">${E.tab === 'kao' ? `<b>${esc(e)}</b>` : `<i>${esc(e)}</i>`}</button>`).join('')}</div>` : `<div class="os_no">${E.busy ? '' : '검색 결과가 없어요'}</div>`}</div></div>`;
    // 대화 상태 카드 · 스케줄 편집 시트 (시안 docs/mockups/orbit-sched, docs/design/orbit-marinara.md 1-4). 레이아웃은 마리나라, 부품은 채팅 설정의 것 + 새 부품 몇 개(css의 .ss · .sc)
    const dk = o.dark ? ' dk' : '', STC = { online: '', idle: 'idle', dnd: 'dnd', offline: 'off' }, STL = { online: '온라인', idle: '자리 비움', dnd: '바쁨', offline: '오프라인' };
    const stMenu = (cur, cls, at, pos) => `<div class="mn" style="${pos}">${Object.keys(STL).map(k => `<div role="button" tabindex="0" class="${cls}${k === cur ? ' cur' : ''}" data-v="${k}"${at}><i class="dot ${STC[k]}"></i>${STL[k]}</div>`).join('')}</div>`;
    const R = o.pres, pres = !R ? '' : `<div class="ob_mx na_op_x"></div><div class="sc ss${dk}"><div class="h">${lu('calendar-clock', 18)}<b>대화 상태</b><i role="button" tabindex="0" class="na_op_auto" aria-label="자율 메시지 설정">${lu('settings-2', 17)}</i><i role="button" tabindex="0" class="na_op_ref" aria-label="새로 고침">${lu('refresh-cw', 17)}</i></div>${R.people.map(x => { const n = esc(x.name), nx = x.next;
        return `<div class="who">${face(x.name, 40)}<div><b>${n}${x.ov ? '<i class="ovp">재정의</i>' : ''}</b><div>${esc(x.sub)}</div></div></div>
        <div class="st" style="position:relative"><span class="pk na_op_pk" role="button" tabindex="0" data-n="${n}" aria-label="상태 고르기"><i class="dot ${STC[x.st]}"></i>${lu('chevron-down', 14)}</span><div class="tx na_op_act" contenteditable="true" role="textbox" enterkeyhint="done" spellcheck="false" data-n="${n}" data-ph="${STL[x.st]}" aria-label="활동">${esc(x.act)}</div>${x.ov ? `<i role="button" tabindex="0" class="na_op_clr" data-n="${n}" aria-label="수동 재정의 지우기">${lu('trash-2', 15)}</i>` : ''}${x.menu ? stMenu(x.st, 'na_op_pick', ` data-n="${n}"`, 'left:0;top:48px') : ''}</div>
        <div class="sh">${lu('calendar-clock', 16)}<b>스케줄</b><div class="bd${x.badge === '꺼짐' ? ' off' : ''}">${x.badge}</div><span class="sp"></span><button type="button" class="os_go na_op_edit" data-n="${n}">${lu('pencil', 12, 2.2)}편집</button></div>
        ${nx.length ? `<div class="nx"><i class="dot ${STC[nx[0].st]}"></i><div class="a"><div class="t"><span>다음 · ${esc(nx[0].when)}</span>${nx.length > 1 ? `<em role="button" tabindex="0" class="na_op_more">${R.open ? '숨기기' : `+${nx.length - 1}개 더 보기`}</em>` : ''}</div><div class="v">${esc(nx[0].act)}</div></div></div>${R.open ? nx.slice(1).map(b => `<div class="xr na_op_edit" role="button" tabindex="0" data-n="${n}" data-d="${b.day}"><i class="dot ${STC[b.st]}"></i><div><div class="t">${esc(b.when)}</div><div class="v">${esc(b.act)}</div></div></div>`).join('') : ''}` : x.note ? `<div class="nx"><div class="a"><div class="t"><span>${x.note}</span></div></div></div>` : ''}
        ${x.wait ? `<div class="now na_op_now" role="button" tabindex="0" data-n="${n}">지금 답장</div>` : ''}`; }).join('')}</div>`;
    const C = o.sch, sched = (() => { if (!C) return '';
        const ed = (f, v, ph, at = '', st = '') => `contenteditable="true" role="textbox" enterkeyhint="done" spellcheck="false" data-f="${f}"${at} data-ph="${ph}"${st ? ` style="${st}"` : ''}>${esc(v)}`;
        const bar = d => `<div class="bar">${d.segs.map(g => `<i class="${STC[g.st]}" style="left:calc(4px + (100% - 8px) * ${(g.a / 1440).toFixed(5)});width:max(2px, calc((100% - 8px) * ${((g.b - g.a) / 1440).toFixed(5)} - 2px))"></i>`).join('')}${d.now == null ? '' : `<b class="now" style="left:calc(4px + (100% - 8px) * ${(d.now / 1440).toFixed(5)})"></b>`}</div><div class="tk">${[0, 6, 12, 18, 24].map(h => `<u class="M" style="left:${h / 24 * 100}%"></u>`).join('')}${[0, 6, 12, 18, 24].map(h => `<div style="left:${h / 24 * 100}%">${String(h % 24).padStart(2, '0')}</div>`).join('')}${d.now == null ? '' : `<b class="nw" style="left:${(d.now / 1440 * 100).toFixed(3)}%"></b>`}</div>`;
        const day = d => { const at = ` data-d="${d.key}"`;
            return `<div class="os_cd" style="margin-bottom:10px;overflow:visible"><div class="na_ss_day" role="button" tabindex="0"${at} aria-expanded="${d.open}"><div class="dh">${lu(d.open ? 'chevron-down' : 'chevron-right', 17)}<b>${d.name}</b><div class="n">블록 ${d.blocks.length}개</div></div>${bar(d)}</div>${!d.open ? '' : `<div class="gd"><div class="inl"><div class="fld" style="min-height:38px"><div class="v na_ss_in" ${ed('dguide', d.guide, '가이드: 저녁 식사 후 더 사교적으로', at, 'font-weight:400')}</div></div></div><button type="button" class="os_go ${C.busy === d.key ? 'na_ss_stop' : 'na_ss_regen'}"${at} style="height:38px;padding:0 12px">${lu(C.busy === d.key ? 'x' : 'refresh-cw', 12, 2.2)}${C.busy === d.key ? '중지' : '재생성'}</button></div>
              ${d.blocks.map((b, i) => `<div class="blk" style="position:relative"><span class="pk na_ss_pk" role="button" tabindex="0"${at} data-i="${i}" aria-label="블록 상태 고르기"><i class="dot ${STC[b.st]}"></i>${lu('chevron-down', 13)}</span>${b.menu ? stMenu(b.st, 'na_ss_pick', `${at} data-i="${i}"`, 'left:10px;top:42px') : ''}<div class="tm na_ss_in" ${ed('time', b.time.replace('-', ' – '), '09:00 – 11:30', `${at} data-i="${i}"`)}</div><div class="ac na_ss_in" ${ed('act', b.act, STL[b.st], `${at} data-i="${i}"`)}</div><i role="button" tabindex="0" class="na_ss_del"${at} data-i="${i}" aria-label="블록 제거">${lu('x', 15)}</i></div>`).join('')}<div class="add na_ss_add" role="button" tabindex="0"${at}>${lu('plus', 15, 2.2)}블록 추가</div>`}</div>`; };
        const rw = (v, k, l, val) => `<button type="button" class="os_rw na_ss_go" data-v="${v}">${lu(k, 18)}<span class="os_l">${l}</span><span class="os_v">${esc(val)}</span><i class="os_ch">${lu('chevron-right', 16)}</i></button>`;
        const soon = (k, l, v, u = '', chev = true) => `<div class="fld na_ob_soon" role="button" tabindex="0" aria-label="${l}">${lu(k, 17)}<div class="v">${esc(v)}</div>${u ? `<div class="u">${esc(u)}</div>` : ''}${chev ? lu('chevron-down', 16) : ''}</div>`;
        const sub = C.page !== 'main', title = { tune: '조정', ai: '스케줄 AI', tz: '스케줄 시간대', conn: '생성 모델' }[C.page] || `${esc(C.owner)} 스케줄 편집`;
        const MODE = { rewrite: ['재작성', '캐릭터와 지침으로 한 주를 새로 씁니다'], adjust: ['조정', '루틴은 대부분 두고 지침만 반영합니다'], vary: ['변주', '그럴듯한 범위에서 한 주를 다르게 만듭니다'], repair: ['수리', '빈 시간과 겹침만 최소한으로 고칩니다'] };
        const num = (f, l, v, unit) => `<div class="fld${v === '' ? ' ph' : ''}"><div class="v"${v === '' ? ' style="font-weight:500;color:inherit"' : ''}>${l}</div><div class="u na_ss_in" inputmode="numeric" ${ed(f, v, '기본값')}</div>${v !== '' && unit ? `<div class="u">${unit}</div>` : ''}</div>`;
        const body = C.page === 'tune' ? `<div class="os_cd"><div class="pad"><div class="lb">채팅 수다스러움</div><div class="step">${['드물게', '조용히', '보통', '사교적', '매우 자주'].map((t, i) => `<div role="button" tabindex="0" class="na_ss_step${i === C.talk ? ' on' : ''}" data-i="${i}">${t}</div>`).join('')}</div>
              <div class="lb">체크인 전 대기</div><div class="inl"><div class="fld"><div class="v na_ss_in" inputmode="numeric" ${ed('wait', C.wait, '120')}</div><div class="u">분</div></div></div>
              <div class="lb">체크인 시점</div><div class="chips">${C.moments.map(m => `<div role="button" tabindex="0" class="chip na_ss_chip${m.on ? ' on' : ''}" data-k="${m.k}">${m.on ? lu('check', 13, 2.6) : ''}${m.label}</div>`).join('')}</div></div></div>
              <div class="os_cap">고급 타이밍</div><div class="os_cd">${num('cap', '일일 안전 한도', C.cap, '회')}${num('idle', '자리 비움 중 지연', C.idle, '분')}${num('dnd', '바쁨 중 지연', C.dnd, '분')}</div>`
            : C.page === 'ai' ? `<div class="os_cap">주간 행동</div><div class="os_cd">${Object.entries(MODE).map(([k, [t, d]]) => `<div role="button" tabindex="0" class="opt na_ss_opt${k === C.mode ? ' on' : ''}" data-v="${k}"><div class="a"><b>${t}</b><div class="d">${d}</div></div><span class="ck">${k === C.mode ? lu('check', 13, 2.8) : ''}</span></div>`).join('')}</div>
              <div class="os_cap">주간 생성</div><div class="os_cd"><div class="fld na_ss_gen" role="button" tabindex="0"><div class="v">${C.gen === 'day' ? '하루에 요청 1회' : '요청 1회로 한 주 전체'}</div>${lu('chevron-down', 16)}</div></div>
              <div class="os_cap">주간 지침</div><div class="os_cd"><div class="fld"><div class="v na_ss_in" ${ed('guide', C.guide, '예: 평일에는 야간 활동을 늘리고 주말에는 사교적으로', '', 'font-weight:400;padding:12px 0;white-space:normal')}</div></div></div>
              <div class="os_cap"></div><button type="button" class="os_ok ${C.busy === 'week' ? 'na_ss_stop' : 'na_ss_run'}">${C.busy === 'week' ? '중지' : `주 ${MODE[C.mode][0]}`}</button><div class="hint" style="text-align:center">${C.busy === 'week' && C.busyText ? esc(C.busyText) : '초안일 뿐입니다. 스케줄을 저장하면 적용됩니다'}</div>`
            : C.page === 'tz' ? `<div class="os_q">${lu('search', 16)}<div class="os_qi na_ss_tzq" contenteditable="true" role="textbox" enterkeyhint="search" spellcheck="false" data-ph="시간대 검색" aria-label="시간대 검색">${esc(C.tzQ)}</div></div>${C.tzList.length ? `<div class="os_cd">${C.tzList.map(z => `<div class="fld na_ss_tz" role="button" tabindex="0" data-v="${esc(z.id)}"><div class="v">${esc(z.label)}</div>${z.on ? lu('check', 16, 2.4) : ''}</div>`).join('')}</div>` : '<div class="os_no">검색 결과가 없어요</div>'}`
            : C.page === 'conn' ? `<div class="os_cd">${C.conns.map(c => `<div role="button" tabindex="0" class="opt na_ss_conn${c.on ? ' on' : ''}" data-v="${esc(c.id)}"><div class="a"><b>${esc(c.name)}</b>${c.sub ? `<span>${esc(c.sub)}</span>` : ''}</div><span class="ck">${c.on ? lu('check', 13, 2.8) : ''}</span></div>`).join('')}</div>`
            : `<div class="os_cap">스케줄 시간대</div><div class="os_cd"><div class="fld na_ss_go" role="button" tabindex="0" data-v="tz">${lu('clock', 17)}<div class="v">${esc(C.tz)}</div>${lu('chevron-down', 16)}</div>${C.zone ? `<div class="fld na_ss_zoneoff" role="button" tabindex="0">${lu('locate-fixed', 17)}<div class="v">폰의 시간대 사용</div><div class="u">${esc(C.phoneTz)}</div></div>` : ''}</div><div class="hint">온라인 상태와 자율 메시지는 이 시간대를 따릅니다${C.zone ? ' · 모든 대화에 적용' : ''}</div>
              <div class="os_cap">루틴 프로필</div><div class="os_cd"><div class="rt">${face(C.owner, 46)}<div class="a"><b>${esc(C.owner)}</b><div class="d">${C.summary ? esc(C.summary) : '아직 루틴 요약이 없습니다'}</div>${C.summary && C.stale ? '<div class="stale">요약이 오래됐을 수 있습니다</div>' : ''}<button type="button" class="os_go ${C.busy === 'sum' ? 'na_ss_stop' : 'na_ss_sum'}">${lu(C.busy === 'sum' ? 'x' : 'sparkles', 12, 2.2)}${C.busy === 'sum' ? '중지' : C.summary ? '요약 새로 고침' : '요약 생성'}</button></div></div></div>
              <div class="os_cap">생성 모델</div><div class="os_cd"><div class="fld na_ss_go" role="button" tabindex="0" data-v="conn">${lu('plug', 17)}<div class="v">${esc(C.conn)}</div>${lu('chevron-down', 16)}</div></div>${C.connSub ? `<div class="hint">${esc(C.connSub)} · ${esc(C.conn)}</div>` : ''}
              <div class="os_cap"></div><div class="os_cd">${rw('tune', 'settings-2', '조정', C.tuneSum)}${rw('ai', 'sparkles', '스케줄 AI', C.aiSum)}<button type="button" class="os_rw na_ss_renew">${lu('refresh-cw', 18)}<span class="os_l">매주 갱신</span><span class="os_v">${C.renew ? '켜짐' : '꺼짐'}</span></button></div>
              <div class="os_cap">주간 스케줄</div>${C.days.map(day).join('')}`;
        // 생성이 실패하면: 오류 글 + (모델이 준 글이 있으면) 고쳐서 초안에 넣기 — 마리나라의 "Edit generated schedule JSON"
        const err = !C.err ? '' : `<div class="os_cd" style="margin-bottom:12px"><div class="pad"><div class="lb" style="color:#c4553f">생성에 실패했습니다. 초안은 그대로입니다</div><div class="hint" style="margin:0 0 10px">${esc(C.err.msg)}</div>${C.err.raw ? `<div class="lb">생성된 스케줄 JSON 편집</div><div class="inl"><div class="fld" style="align-items:flex-start"><div class="v na_ss_raw" contenteditable="true" role="textbox" spellcheck="false" aria-label="생성된 스케줄 JSON" style="font:12px/1.45 ui-monospace,monospace;font-weight:400;white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow-y:auto;padding:10px 0">${esc(C.err.text)}</div></div></div>` : ''}<div style="display:flex;gap:8px;margin-top:10px">${C.err.raw ? '<button type="button" class="os_go na_ss_fix">초안에 적용</button>' : ''}<button type="button" class="os_go na_ss_errx">닫기</button></div></div></div>`;
        return `<div class="ob_shade na_ss_x"></div><div class="ob_sheet os_sh ss${dk}${C.busy ? ' busy' : ''}"><i class="ob_grab"></i><div class="os_hd${sub ? ' sub' : ''}">${sub ? `<button type="button" class="os_ib na_ss_back" aria-label="뒤로">${lu('chevron-left', 20)}</button>` : ''}<b>${title}</b>${!sub && C.dirty ? '<div class="dr">저장되지 않은 초안</div>' : ''}<button type="button" class="os_ib na_ss_x" aria-label="닫기">${lu('x', 19)}</button></div><div class="os_bd">${err}${body}</div>
          <div class="ftr"><button type="button" class="os_go na_ss_imp">${lu('upload', 12, 2.2)}가져오기</button><button type="button" class="os_go na_ss_exp">${lu('download', 12, 2.2)}내보내기</button><div class="d"></div><div class="no na_ss_x" role="button" tabindex="0">취소</div><div class="sv na_ss_save" role="button" tabindex="0">스케줄 저장</div></div></div>`; })();
    const holding = o.msgs.some(x => x.held);
    // 방 화면(시안 docs/mockups/orbit-top A_glass · X2, docs/design/orbit-marinara.md 1-3): 연한 바탕 + 그 사람 빛, 작은 유리 머리 한 줄(‹ · 얼굴 · 이름 · ⋯).
    // 어두운 방(o.dark)은 .ob_bg.dk 뒤의 형제들로 색을 바꿔요. --obc = 그 사람 색(어두운 방의 내 말풍선 · 보내기에 섞어요)
    const au = auraOf(o.title, o.group), fg = o.dark ? '#fff' : '#1e2026', obc = o.dark ? ` style="--obc:${au[3]}"` : '';
    return `<div class="ob_bg${o.dark ? ' dk' : ''}" data-bar="${o.dark ? '#131417' : mix('#f5f2f3', au[3], 0.3)}"><span class="ob_blob" style="background:${orbitBg(o.title, o.group)}"></span></div>${axBar(p, o.clock || now, fg)}
      <div class="ob_ct"><button type="button" class="ob_gb" data-go="orbit" aria-label="뒤로">${lu('chevron-left', 20)}</button>${o.faceOf ? `<button type="button" class="ob_fb ob_hf na_ob_face" data-n="${esc(o.faceOf)}" aria-label="프사 바꾸기">${face(o.title, 28, o.group)}<i class="ob_dot ${STC[o.st] || ''}"></i></button>` : `<span class="ob_hf">${face(o.title, 28, o.group)}${o.group ? '' : `<i class="ob_dot ${STC[o.st] || ''}"></i>`}</span>`}<span class="ob_nm${o.asOwner ? '' : ' na_ob_pres'}"${o.asOwner ? '' : ' role="button" tabindex="0" aria-label="대화 상태"'}><b><i>${esc(o.title)}</i>${o.there ? `<em class="ob_lt cg_num">${ic(o.there.icon, 11, 'currentColor', 2.2)}${esc(o.there.time)}</em>` : ''}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ''}</span>${o.asOwner ? '' : `<button type="button" class="ob_tb na_ob_find" aria-label="메시지 검색">${lu('search', 18)}</button><button type="button" class="ob_tb na_ob_set" aria-label="채팅 설정">${lu('settings-2', 18)}</button>`}<button type="button" class="ob_tb na_ob_more${o.menu ? ' on' : ''}" aria-label="더 보기">${lu('ellipsis', 18)}</button></div>
      ${o.menu ? `<div class="ob_mx na_ob_mx"></div><div class="ob_menu"><button type="button" class="ob_mr na_ob_dark">${lu(o.dark ? 'sun' : 'moon', 17)}<span>${o.dark ? '라이트 모드' : '다크 모드'}</span></button></div>` : ''}
      ${o.chips.length ? `<div class="ob_chips">${o.chips.map(c => `<span class="ob_chip">${ic(c.icon, 13, '#fff')}${esc(c.text)}</span>`).join('')}</div>` : ''}
      <div${obc} class="ob_msgs ax_scroll${o.fixing ? ' fixing' : ''}${o.asOwner ? ' ro' : ''}${holding ? ' hold na_ob_hold' : ''}${o.picking != null ? ' picking' : ''}${o.emo && o.picking == null ? ' emo' : ''}${o.reply && o.picking == null ? ' rp' : ''}${o.att?.length && o.picking == null ? ' at' : ''}"><div class="ob_mi">${o.msgs.map((x, i) => msg(x, i)).join('')}${o.snapBusy ? '<div class="ob_fail ob_note"><span>이야기 정리 중</span></div>' : o.typing ? '<div class="ob_typ ob_glass" aria-label="입력 중"><i></i><i></i><i></i></div>' : ''}${(o.notes || []).map(t => `<div class="ob_fail ob_note"><span>${esc(t)}</span></div>`).join('')}${o.fail ? `<div class="ob_fail"><span>답장을 못 받았어요</span><button type="button" class="ob_retry na_ob_retry" data-id="${esc(o.fail.id)}">다시</button></div>` : ''}</div></div>
      ${o.asOwner || o.picking != null ? '' : emo}
      ${o.asOwner ? '' : o.picking != null ? `<div class="ob_inp ob_pbar"><span>${o.picking}개 선택</span><span class="ob_pbtn"><button type="button" class="na_ob_ptr"${o.picking ? '' : ' disabled'}>재번역</button><button type="button" class="na_ob_pdel red"${o.picking ? '' : ' disabled'}>삭제</button><button type="button" class="na_ob_pquit">취소</button></span></div>`
        : `${o.att?.length || o.reading ? `<div class="ob_at${o.reply ? ' up' : ''}">${(o.att || []).map((a, i) => `<span class="ob_ap">${lu(a.img ? 'images' : 'file-text', 13)}<span>${esc(a.name)}</span><button type="button" class="na_ob_atx" data-i="${i}" aria-label="${esc(a.name)} 제거">${lu('x', 11, 2.4)}</button></span>`).join('')}${o.reading ? '<span class="ob_ap">파일 읽는 중...</span>' : ''}</div>` : ''}${o.reply ? rq(o.reply, true) : ''}<input type="file" class="na_ob_file" hidden multiple accept="${esc(o.accept || '')}"><div${obc} class="ob_inp"><button type="button" class="ob_ci na_ob_clip${o.att?.length ? ' on' : ''}" aria-label="파일 첨부">${lu('paperclip', 21)}</button><button type="button" class="ob_ci na_ob_sw${o.sw ? ' on' : ''}" aria-label="빠른 전환기" aria-haspopup="dialog" aria-expanded="${!!o.sw}">${lu('chevron-up', 22, 2.2)}</button><div class="ob_msgin na_ob_in" contenteditable="true" role="textbox" enterkeyhint="send" spellcheck="false" data-ph="메시지" aria-label="메시지">${esc(o.draft || '')}</div><button type="button" class="ob_ci na_ob_emo${o.emo ? ' on' : ''}" aria-label="${o.emo ? '키보드' : '이모지'}">${lu(o.emo ? 'keyboard' : 'smile', o.emo ? 21 : 22)}</button><button type="button" class="ob_send na_ob_send" aria-label="보내기">${lu('arrow-right', 19, 2.4)}</button></div>`}
      ${sheet}${setSheet}${pres}${sched}${o.sw ? orbitSwitcher(o.sw) : ''}${o.view ? `<div class="ob_iv na_ob_ivx" role="button" aria-label="닫기"><img src="${esc(o.view)}" alt=""></div>` : ''}${orbitAlerts(o)}
      ${o.note ? `<div class="ob_shade na_ob_ntx"></div><div class="ob_sheet ob_bks ob_nts"><i class="ob_grab"></i><div class="ob_bkh"><b>메모</b></div><div class="ob_bkt na_ob_nttx" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="false" aria-label="비공개 메모" data-ph="나만 볼 수 있습니다. 모델에게는 전송되지 않습니다.">${esc(o.note.text)}</div><div class="ob_bkb">${o.note.had ? '<button type="button" class="ob_bkno na_ob_ntrm">메모 제거</button>' : '<button type="button" class="ob_bkno na_ob_ntx">취소</button>'}<button type="button" class="ob_bkok na_ob_ntok">메모 저장</button></div></div>` : ''}${o.think ? orbitThink(o.think) : ''}${o.peek ? orbitPeek(o.peek) : ''}
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

