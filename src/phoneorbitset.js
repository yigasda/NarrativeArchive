// Orbit 채팅 설정의 화면들 (마리나라 ChatSettingsDrawer, fc0333c 의 대화 모드 조작을 빠짐없이: docs/design/orbit-marinara.md 1-5).
// 레이아웃 · 이름은 마리나라, 부품은 우리 시트 것(os_*) + 작은 부품 몇 개(ot_*). 고급 매개변수 · 채팅 변수는 넣지 않아요(소망).
// 동작이 아직 없는 조작: 값은 이 시트가 열려 있는 동안만 기억하고(T.v), 누르면 "아직 연결되지 않았어요" 알림이 떠요(na_os_* · na_ob_soon).
// 아이콘: Lucide (ISC, NOTICE.md).
import { esc } from './util.js';
const LI = {
    'arrow-up': '<path d="m5 12 7-7 7 7" /> <path d="M12 19V5" />',
    'arrow-down': '<path d="M12 5v14" /> <path d="m19 12-7 7-7-7" />',
    'sliders-horizontal': '<line x1="21" x2="14" y1="4" y2="4" /> <line x1="10" x2="3" y1="4" y2="4" /> <line x1="21" x2="12" y1="12" y2="12" /> <line x1="8" x2="3" y1="12" y2="12" /> <line x1="21" x2="16" y1="20" y2="20" /> <line x1="12" x2="3" y1="20" y2="20" /> <line x1="14" x2="14" y1="2" y2="6" /> <line x1="8" x2="8" y1="10" y2="14" /> <line x1="16" x2="16" y1="18" y2="22" />',
    'circle-help': '<circle cx="12" cy="12" r="10" /> <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /> <path d="M12 17h.01" />',
    'star': '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />',
    'lock-open': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /> <path d="M7 11V7a5 5 0 0 1 9.9-1" />',
    'external-link': '<path d="M15 3h6v6" /> <path d="M10 14 21 3" /> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />',
    'save': '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /> <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /> <path d="M7 3v4a1 1 0 0 0 1 1h7" />',
    'pencil': '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /> <path d="m15 5 4 4" />',
    'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /> <polyline points="7 10 12 15 17 10" /> <line x1="12" x2="12" y1="15" y2="3" />',
    'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /> <polyline points="17 8 12 3 7 8" /> <line x1="12" x2="12" y1="3" y2="15" />',
    'trash-2': '<path d="M3 6h18" /> <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /> <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /> <line x1="10" x2="10" y1="11" y2="17" /> <line x1="14" x2="14" y1="11" y2="17" />',
    'plus': '<path d="M5 12h14" /> <path d="M12 5v14" />',
    'git-graph': '<circle cx="5" cy="6" r="3" /> <path d="M5 9v6" /> <circle cx="5" cy="18" r="3" /> <path d="M12 3v18" /> <circle cx="19" cy="6" r="3" /> <path d="M16 15.7A9 9 0 0 0 19 9" />',
    'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /> <path d="M14 2v4a2 2 0 0 0 2 2h4" /> <path d="M10 9H8" /> <path d="M16 13H8" /> <path d="M16 17H8" />',
    'hash': '<line x1="4" x2="20" y1="9" y2="9" /> <line x1="4" x2="20" y1="15" y2="15" /> <line x1="10" x2="8" y1="3" y2="21" /> <line x1="16" x2="14" y1="3" y2="21" />',
    'book-open': '<path d="M12 7v14" /> <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />',
    'chart-column': '<path d="M3 3v16a2 2 0 0 0 2 2h16" /> <path d="M18 17V9" /> <path d="M13 17V5" /> <path d="M8 17v-3" />',
    'list-checks': '<path d="m3 17 2 2 4-4" /> <path d="m3 7 2 2 4-4" /> <path d="M13 6h8" /> <path d="M13 12h8" /> <path d="M13 18h8" />',
    'copy': '<rect width="14" height="14" x="8" y="8" rx="2" ry="2" /> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />',
    'history': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> <path d="M3 3v5h5" /> <path d="M12 7v5l4 2" />',
    'eye': '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /> <circle cx="12" cy="12" r="3" />',
    'eye-off': '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /> <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /> <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /> <path d="m2 2 20 20" />',
    'x': '<path d="M18 6 6 18" /> <path d="m6 6 12 12" />',
    'ban': '<circle cx="12" cy="12" r="10" /> <path d="m4.9 4.9 14.2 14.2" />',
    'maximize-2': '<polyline points="15 3 21 3 21 9" /> <polyline points="9 21 3 21 3 15" /> <line x1="21" x2="14" y1="3" y2="10" /> <line x1="3" x2="10" y1="21" y2="14" />',
    'messages-square': '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" /> <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />',
    'sparkles': '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /> <path d="M20 3v4" /> <path d="M22 5h-4" /> <path d="M4 17v2" /> <path d="M5 18H3" />',
    'puzzle': '<path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z" />',
    'link-2': '<path d="M9 17H7A5 5 0 0 1 7 7h2" /> <path d="M15 7h2a5 5 0 1 1 0 10h-2" /> <line x1="8" x2="16" y1="12" y2="12" />',
    'unlink': '<path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" /> <path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71" /> <line x1="8" x2="8" y1="2" y2="5" /> <line x1="2" x2="5" y1="8" y2="8" /> <line x1="16" x2="16" y1="19" y2="22" /> <line x1="19" x2="22" y1="16" y2="16" />',
    'search': '<circle cx="11" cy="11" r="8" /> <path d="m21 21-4.3-4.3" />',
    'images': '<path d="M18 22H4a2 2 0 0 1-2-2V6" /> <path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18" /> <circle cx="12" cy="8" r="2" /> <rect width="16" height="16" x="6" y="2" rx="2" />',
    'paintbrush': '<path d="m14.622 17.897-10.68-2.913" /> <path d="M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z" /> <path d="M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15" />',
    'camera': '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /> <circle cx="12" cy="13" r="3" />',
    'film': '<rect width="18" height="18" x="3" y="3" rx="2" /> <path d="M7 3v18" /> <path d="M3 7.5h4" /> <path d="M3 12h18" /> <path d="M3 16.5h4" /> <path d="M17 3v18" /> <path d="M17 7.5h4" /> <path d="M17 16.5h4" />',
    'check': '<path d="M20 6 9 17l-5-5" />',
    'brain': '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /> <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" /> <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" /> <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" /> <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" /> <path d="M3.477 10.896a4 4 0 0 1 .585-.396" /> <path d="M19.938 10.5a4 4 0 0 1 .585.396" /> <path d="M6 18a4 4 0 0 1-1.967-.516" /> <path d="M19.967 17.484A4 4 0 0 1 18 18" />',
    'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /> <path d="M21 3v5h-5" /> <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /> <path d="M8 16H3v5" />',
    'wrench': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />',
    'file-plus-2': '<path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" /> <path d="M14 2v4a2 2 0 0 0 2 2h4" /> <path d="M3 15h6" /> <path d="M6 12v6" />',
    'languages': '<path d="m5 8 6 6" /> <path d="m4 14 6-6 2-3" /> <path d="M2 5h12" /> <path d="M7 2h1" /> <path d="m22 22-5-10-5 10" /> <path d="M14 18h6" />',
    'bot': '<path d="M12 8V4H8" /> <rect width="16" height="12" x="4" y="8" rx="2" /> <path d="M2 14h2" /> <path d="M20 14h2" /> <path d="M15 13v2" /> <path d="M9 13v2" />',
    'clock-3': '<circle cx="12" cy="12" r="10" /> <polyline points="12 6 12 12 16.5 12" />',
    'locate-fixed': '<line x1="2" x2="5" y1="12" y2="12" /> <line x1="19" x2="22" y1="12" y2="12" /> <line x1="12" x2="12" y1="2" y2="5" /> <line x1="12" x2="12" y1="19" y2="22" /> <circle cx="12" cy="12" r="7" /> <circle cx="12" cy="12" r="3" />',
    'calendar-clock': '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" /> <path d="M16 2v4" /> <path d="M8 2v4" /> <path d="M3 10h5" /> <path d="M17.5 17.5 16 16.3V14" /> <circle cx="16" cy="16" r="6" />',
    'chevrons-up-down': '<path d="m7 15 5 5 5-5" /> <path d="m7 9 5-5 5 5" />',
    'dices': '<rect width="12" height="12" x="2" y="10" rx="2" ry="2" /> <path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6" /> <path d="M6 18h.01" /> <path d="M10 14h.01" /> <path d="M15 6h.01" /> <path d="M18 9h.01" />',
    'house': '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /> <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />',
    'settings-2': '<path d="M20 7h-9" /> <path d="M14 17H5" /> <circle cx="17" cy="17" r="3" /> <circle cx="7" cy="7" r="3" />',
    'scan-text': '<path d="M3 7V5a2 2 0 0 1 2-2h2" /> <path d="M17 3h2a2 2 0 0 1 2 2v2" /> <path d="M21 17v2a2 2 0 0 1-2 2h-2" /> <path d="M7 21H5a2 2 0 0 1-2-2v-2" /> <path d="M7 8h8" /> <path d="M7 12h10" /> <path d="M7 16h6" />',
    'chevron-right': '<path d="m9 18 6-6-6-6" />',
    'chevron-left': '<path d="m15 18-6-6 6-6" />',
    'chevron-down': '<path d="m6 9 6 6 6-6" />',
    'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> <path d="M3 3v5h5" />',
    'git-branch': '<line x1="6" x2="6" y1="3" y2="15" /> <circle cx="18" cy="6" r="3" /> <circle cx="6" cy="18" r="3" /> <path d="M18 9a9 9 0 0 1-9 9" />',
    'plug': '<path d="M12 22v-5" /> <path d="M9 8V2" /> <path d="M15 8V2" /> <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />',
    'venetian-mask': '<path d="M18 11c-1.5 0-2.5.5-3 2" /> <path d="M4 6a2 2 0 0 0-2 2v4a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5V8a2 2 0 0 0-2-2h-3a8 8 0 0 0-5 2 8 8 0 0 0-5-2z" /> <path d="M6 11c1.5 0 2.5.5 3 2" />',
    'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /> <circle cx="9" cy="7" r="4" /> <path d="M22 21v-2a4 4 0 0 0-3-3.87" /> <path d="M16 3.13a4 4 0 0 1 0 7.75" />',
    'type': '<polyline points="4 7 4 4 20 4 20 7" /> <line x1="9" x2="15" y1="20" y2="20" /> <line x1="12" x2="12" y1="4" y2="20" />',
    'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />',
    'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /> <circle cx="12" cy="7" r="4" />',
    'triangle-alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /> <path d="M12 9v4" /> <path d="M12 17h.01" />',
    'info': '<circle cx="12" cy="12" r="10" /> <path d="M12 16v-4" /> <path d="M12 8h.01" />',
    'bookmark': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />',
    'pin': '<path d="M12 17v5" /> <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />',
    'key-round': '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" /> <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />',
};
const li = (k, s = 18, w = 2) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${LI[k] || ''}</svg>`;

// 맨 화면의 줄: [화면, 아이콘, 이름]. 값은 orbitSetRows가 붙여요
export const ORBIT_SET_TITLES = { profile: '설정 프로필', branches: '채팅 분기', conn: '연결', stconn: 'API 연결', preset: '프롬프트 프리셋', persona: '페르소나', people: '캐릭터', group: '단체 채팅', linked: '연결된 채팅', lore: '로어북', ctx: '활성 컨텍스트', agents: '에이전트', gallery: '갤러리', memory: '기억 회상', memlist: '이 채팅의 기억', trans: '번역', auto: '자율 메시지', tz: '스케줄 시간대', sum: '자동 요약', sumedit: '요약 편집', name: '채팅 제목' };
const HELP = {
    profile: '설정 프로필은 이 채팅의 제공자, 프롬프트, 에이전트, 번역, 기억 등의 설정을 저장해 다시 쓸 수 있게 합니다. 캐릭터, 스프라이트, 요약, 태그, 장면 프롬프트는 바꾸지 않습니다. 프로필의 페르소나, 로어북, 배경은 적용할 때 채팅으로 복사됩니다. 별표를 누르면 이 모드의 새 채팅에 사용됩니다.',
    name: '이 이름은 나에게만 보입니다. AI에게 전송되지 않으며 대화에 아무 영향도 주지 않습니다.',
    branches: '이 채팅의 분기를 전환, 이름 변경, 내보내기, 가져오기 합니다.',
    conn: '이 채팅이 사용하는 모델입니다. 여기서 고르면 이 채팅만 바뀝니다. \'기본값 사용\'은 메인 모델을 따릅니다.',
    preset: '프리셋의 대화 프롬프트를 고른 뒤, 필요하면 이 채팅만의 사본을 편집합니다.',
    persona: '페르소나는 이 채팅에서 내가 누구인지 정의합니다. AI는 이 페르소나의 이름으로 나를 부르고 세부 정보를 맥락으로 사용합니다.',
    people: '이 채팅의 캐릭터입니다. 캐릭터마다 AI가 연기하는 고유한 성격이 있습니다.',
    group: '묶은 응답 하나 또는 캐릭터별 개별 차례 중에서 고릅니다. 개별 응답은 응답하는 캐릭터마다 모델 요청을 따로 사용합니다.',
    linked: '이 채팅이 다른 채팅에 대해 무엇을 아는지 정하거나, 롤플레이에 연결합니다. 연결된 메시지는 자동으로 공유됩니다. 〈influence〉는 그쪽의 한 차례를 이끌고 〈note〉는 지울 때까지 남습니다.',
    lore: '로어북에는 세계 정보, 배경 이야기, 설정이 담깁니다. 키워드가 채팅에 나오면 AI가 해당 항목을 받습니다.',
    ctx: '이 채팅에서 활성화된 로어북과 컨텍스트를 봅니다.',
    agents: '대화 명령, 사용자 지정 에이전트, 설치된 기능 패키지가 제공하는 설정을 구성합니다.',
    gallery: '이 채팅의 이미지와 동영상을 보고 만듭니다.',
    memory: '이전 대화에서 관련된 부분을 필요할 때 기억으로 불러옵니다. 로컬 임베딩 모델이 있으면 그것을, 없으면 임베딩 제공자를 사용합니다.',
    trans: '이 채팅의 번역을 여기서 설정합니다. 제공자와 대상 언어가 포함됩니다.',
    auto: '캐릭터가 성격, 내 상태, 선택적 스케줄에 따라 먼저 메시지를 보낼 수 있습니다. 수다스러운 캐릭터는 내가 활동하지 않을 때 더 빨리 연락합니다.',
    sum: '요청을 작게 유지하려고 대화가 스스로 요약됩니다. 하루마다 일간 요약이 만들어지고, 여러 날은 주간 요약으로 합쳐집니다. AI는 주간 요약, 이번 주의 일간 요약, 오늘의 메시지를 봅니다. 아직 끌 수 없습니다.',
};
// 대화 명령(마리나라 CONVERSATION_COMMANDS 중 패키지 없이 늘 뜨는 것. 패키지가 있어야 뜨는 것은 docs/MARINARA-PORT.md)
const COMMANDS = [['schedule', '스케줄 갱신', '캐릭터가 자신의 현재 상태와 활동을 바꿀 수 있게 합니다.'], ['crosspost', '교차 게시', '캐릭터가 메시지를 다른 공유 채팅으로 돌릴 수 있게 합니다.'], ['memories', '기억', '캐릭터가 다른 캐릭터를 위한 기억을 만들 수 있게 합니다.'], ['scenes', '장면', '캐릭터가 대화에서 몰입형 장면을 시작할 수 있게 합니다.'], ['influence', '영향', '캐릭터가 연결된 채팅에 일회성 영향을 보낼 수 있게 합니다.'], ['notes', '노트', '캐릭터가 연결된 채팅에 오래 남는 노트를 저장할 수 있게 합니다.'], ['reactions', '반응', '캐릭터가 이모지 배지로 메시지에 반응할 수 있게 합니다.']];
const HOURS = Array.from({ length: 12 }, (_, h) => [String(h), h ? `오전 ${h}시` : '오전 12시 (자정)']);

// 실리 칸 목록(src/phonestconn.js) → 시트 부품. API 연결 화면과 실리 팝업이 같이 써요. T: { open (펼친 고르기), v (펼친 서랍), scQ (고르기 검색) }
function scGroup(T, list, inner) {
    const cd = (...r) => `<div class="os_cd">${r.join('')}</div>`, pad = h => `<div class="ot_p">${h}</div>`, none = t => `<div class="os_no">${t}</div>`;
    const A = p => ` data-p="${esc(p)}"`, lk = l => `<button type="button" class="os_go na_sc_link" data-h="${esc(l.href)}">${li('external-link', 13, 2.2)}${esc(l.text || '열기')}</button>`, Q = String(T.scQ || '').trim().toLowerCase();
    const btn = b => b.text ? `<button type="button" class="${b.ok ? 'os_ok' : b.cancel ? 'os_go oc_x' : 'os_go'} na_sc_btn"${A(b.p)}${b.off ? ' disabled' : ''}${b.title ? ` title="${esc(b.title)}"` : ''}>${b.icon ? li(b.icon, 13, 2.2) : ''}${esc(b.text)}</button>` : `<button type="button" class="os_ib na_sc_btn"${A(b.p)}${b.off ? ' disabled' : ''} aria-label="${esc(b.title)}" title="${esc(b.title)}">${li(b.icon || 'circle-help', 16)}</button>`;
    const one = n => {
        if (n.t === 'note') return n.warn ? `<div class="ot_box warn">${li('triangle-alert', 15)}<span>${esc(n.text)}</span></div>` : pad(`<div class="os_d oc_nt">${esc(n.text)}</div>${n.links.length ? `<div class="ot_r ot_w oc_lk">${n.links.map(lk).join('')}</div>` : ''}`);
        if (n.t === 'link') return pad(`<div class="ot_r">${lk(n)}</div>`);
        if (n.t === 'status') return `<div class="os_rw oc_st"><i class="ot_dot ${n.ok ? 'on' : 'off'}"></i><span class="os_l">${esc(n.text)}</span></div>`;
        if (n.t === 'tg') return `<div role="button" tabindex="0" class="os_rw ot_t na_sc_tg"${A(n.p)} data-on="${n.on ? 1 : 0}" aria-label="${esc(n.label)}" aria-pressed="${n.on}"><span class="ot_x"><span class="os_l oc_wr">${esc(n.label)}</span>${n.title ? `<span class="os_d">${esc(n.title)}</span>` : ''}</span><i class="ot_sw${n.on ? ' on' : ''}"></i></div>`;
        if (n.t === 'key') return `<div class="os_pp oc_key${n.on ? ' on' : ''}"><span class="ot_tile">${li(n.on ? 'check' : 'key-round', 15, 2.2)}</span><span class="ot_x"><span class="os_l">${esc(n.label || '이름 없음')}</span><span class="os_d">${esc(n.value)}${n.on ? ' · 쓰는 중' : ''}</span>${n.idp ? `<button type="button" class="os_d oc_id na_sc_btn"${A(n.idp)} title="ID 복사">ID ${esc(n.id)}</button>` : ''}</span><span class="oc_kb">${n.btns.map(b => btn({ ...b, text: '' })).join('')}</span></div>`;
        if (n.t === 'in') { const open = T.open === `l:${n.p}`;
            return pad(`<div class="ot_r${n.area ? ' oc_ar' : ''}"><div class="os_q ot_q0 oc_q"><div class="os_qi na_sc_in${n.masked ? ' oc_mask' : ''}${n.area ? ' oc_area' : ''}"${A(n.p)} contenteditable="true" role="textbox" enterkeyhint="${n.area ? 'enter' : 'done'}" spellcheck="false" autocapitalize="off" data-ph="${esc(n.ph)}" aria-label="${esc(n.ph.split('\n')[0] || '값')}">${esc(n.value)}</div></div>${n.list.length ? `<button type="button" class="os_ib na_os_sel" data-k="l:${esc(n.p)}" aria-label="고를 수 있는 값 ${n.list.length}개" title="고를 수 있는 값">${li('chevron-down', 16)}</button>` : ''}${n.key ? `<button type="button" class="os_ib na_sc_btn"${A(n.key)} aria-label="API 키 관리" title="API 키 관리">${li('key-round', 16)}</button>` : ''}</div>${open ? `<div class="ot_r ot_w oc_pk">${n.list.map(o => `<button type="button" class="ot_chip na_sc_pick"${A(n.p)} data-v="${esc(o.v)}">${esc(o.l)}</button>`).join('')}</div>` : ''}`); }
        if (n.t === 'sel' || n.t === 'multi') { const k = `s:${n.p}`, open = T.open === k, multi = n.t === 'multi', picked = multi ? n.options.filter(o => o.on) : [];
            const val = multi ? (picked.length ? picked.map(o => o.l).join(', ') : '고른 것 없음') : (n.text || '고르기');
            const hit = open ? n.options.filter(o => !Q || `${o.l} ${o.v} ${o.g}`.toLowerCase().includes(Q)) : [], cut = hit.slice(0, 80); let grp = null;
            return `<div role="button" tabindex="0" class="os_rw na_os_sel oc_sel${n.off ? ' off' : ''}" data-k="${esc(k)}" aria-label="${esc(val)}" aria-expanded="${open}"><span class="os_l">${esc(val)}</span>${multi && picked.length ? `<span class="ot_chip">${picked.length}</span>` : ''}<i class="os_ch">${li('chevron-down', 16)}</i></div>`
                + (open ? (n.options.length > 12 ? pad(`<div class="os_q ot_q0">${li('search', 16)}<div class="os_qi na_sc_q" contenteditable="true" role="textbox" enterkeyhint="search" spellcheck="false" data-ph="검색" aria-label="검색">${esc(T.scQ || '')}</div></div>`) : '')
                    + (cut.length ? cut.map(o => { const h = o.g && o.g !== grp ? `<div class="oc_g">${esc(o.g)}</div>` : ''; grp = o.g; const on = multi ? o.on : o.v === n.value;
                        return `${h}<div role="button" tabindex="0" class="os_rw ot_o ${multi ? 'na_sc_mopt' : 'na_sc_opt'}${o.off ? ' off' : ''}"${A(n.p)} data-v="${esc(o.v)}" aria-pressed="${on}"><span class="os_l">${esc(o.l || o.v)}</span>${on ? li('check', 16, 2.4) : ''}</div>`; }).join('') : none('맞는 것이 없어요.'))
                    + (hit.length > cut.length ? pad(`<div class="os_d">${hit.length - cut.length}개가 더 있어요. 검색해서 좁혀요.</div>`) : '') : ''); }
        if (n.t === 'drawer') { const k = `d:${n.p}`, open = !!T.v[k];
            return `<div role="button" tabindex="0" class="os_rw na_sc_dr" data-k="${esc(k)}" aria-expanded="${open}"><span class="os_l">${esc(n.title)}</span><i class="os_ch${open ? ' up' : ''}">${li('chevron-down', 16)}</i></div>` + (open ? `<div class="oc_in">${scGroup(T, n.kids, true)}</div>` : ''); }
        return '';
    };
    // 줄 → 카드: 머리글(cap)마다 새 카드. 잇닿은 단추는 한 줄로 모아요
    let out = '', card = [], run = [];
    const act = b => `<button type="button" class="oc_ab${b.main ? ' main' : b.cancel ? ' x' : ''} na_sc_btn"${A(b.p)}${b.off ? ' disabled' : ''}${b.title ? ` title="${esc(b.title)}"` : ''}>${esc(b.text)}</button>`;   // 연결 줄: 칩이 아니라 큰 단추(소망)
    const flushRun = () => { if (run.length) { card.push(pad(run.some(b => b.act) ? `<div class="oc_act">${run.map(act).join('')}</div>` : `<div class="ot_r ot_w oc_bt">${run.map(btn).join('')}</div>`)); run = []; } };
    const flush = () => { flushRun(); if (card.length) { out += inner ? card.join('') : cd(...card); card = []; } };
    for (const n of list) {
        if (n.t === 'btn') { run.push(n); continue; } flushRun();
        if (n.t === 'cap') { flush(); out += inner ? `<div class="oc_g">${esc(n.text)}</div>` : `<div class="os_cap oc_cap"><span>${esc(n.text)}</span>${n.link ? `<button type="button" class="os_ib na_sc_link" data-h="${esc(n.link)}" aria-label="${esc(n.text)} 도움말" title="도움말">${li('circle-help', 14)}</button>` : ''}</div>`; continue; }
        card.push(one(n));
    }
    flush(); return out;
}
// 실리 팝업을 우리 시트로 (src/phonestpop.js가 실리 팝업 위에 얹어요). P: { title, nodes, controls, close, dark, open, v, scQ }
export function orbitStPop(P) {
    const ctl = P.controls.map(b => `<button type="button" class="${b.ok ? 'os_ok' : 'os_go'} na_sc_btn" data-p="${esc(b.p)}"${b.off ? ' disabled' : ''}>${esc(b.text)}</button>`).join('');
    return `<div class="ob_bg${P.dark ? ' dk' : ''} oc_bg"></div><div class="ob_shade na_scp_x"></div><div class="ob_sheet os_sh oc_pop"><i class="ob_grab"></i><div class="os_hd"><b>${esc(P.title || '실리태번')}</b>${P.close ? `<button type="button" class="os_ib na_sc_btn" data-p="${esc(P.close)}" aria-label="닫기">${li('x', 20)}</button>` : ''}</div><div class="os_bd">${scGroup(P, P.nodes, false)}${ctl ? `<div class="oc_ctl">${ctl}</div>` : ''}</div></div>`;
}
// T: { page, v, open, dark, title, roomId, me, members, more, group, auto: { on, cap, ex }, sched: { any, list: [{ n, days }], zone, device, differs, busy }, tzQ, tzList }
export function orbitSetPage(T, face) {
    const g = (k, d) => (k in T.v ? T.v[k] : d);
    const hp = t => `<div class="os_hp">${t}</div>`, cap = t => `<div class="os_cap">${t}</div>`, cd = (...r) => `<div class="os_cd">${r.join('')}</div>`, none = t => `<div class="os_no">${t}</div>`;
    const tg = (k, l, d, def, cls = 'na_os_tg', on = !!g(k, def)) => `<div role="button" tabindex="0" class="os_rw ot_t ${cls}" data-k="${k}" data-on="${on ? 1 : 0}" aria-label="${l}" aria-pressed="${on}"><span class="ot_x"><span class="os_l">${l}</span>${d ? `<span class="os_d">${d}</span>` : ''}</span><i class="ot_sw${on ? ' on' : ''}"></i></div>`;
    const sel = (k, l, opts, def, cls = 'na_os_opt', cur = g(k, def)) => `<div role="button" tabindex="0" class="os_rw na_os_sel" data-k="${k}" aria-label="${l}"><span class="os_l">${l}</span><span class="os_v">${esc((opts.find(o => o[0] === cur) || opts[0] || ['', ''])[1])}</span><i class="os_ch">${li('chevron-down', 16)}</i></div>`
        + (T.open === k ? opts.map(o => `<div role="button" tabindex="0" class="os_rw ot_o ${cls}" data-k="${k}" data-v="${esc(o[0])}"><span class="os_l">${esc(o[1])}</span>${o[0] === cur ? li('check', 16, 2.4) : ''}</div>`).join('') : '');
    const seg = (k, opts, def, cls = 'na_os_seg', cur = g(k, def)) => `<div class="os_sg ot_sg">${opts.map(o => `<button type="button" class="${cls}${o[0] === cur ? ' on' : ''}" data-k="${k}" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>`;
    const inp = (k, l, def, ph = '', o = {}) => `<div class="os_rw ot_i"><span class="os_l">${l}</span><span class="os_v os_qi ${o.cls || 'na_os_in'}" data-k="${k}" contenteditable="true" role="textbox"${o.num ? ' inputmode="numeric"' : ''} enterkeyhint="done" spellcheck="false" data-ph="${esc(ph)}" aria-label="${l}">${esc(String(g(k, def) ?? ''))}</span>${o.unit ? `<span class="ot_u">${o.unit}</span>` : ''}</div>`;
    const area = (k, l, def, ph = '', o = {}) => `<div class="ot_a">${l ? `<div class="ot_al"><span>${l}</span>${o.tail || ''}</div>` : ''}<div class="os_q ot_aq${o.mono ? ' mono' : ''}"><div class="os_qi na_os_in" data-k="${k}" contenteditable="true" role="textbox" spellcheck="false" data-ph="${esc(ph)}" aria-label="${esc(o.aria || l)}" style="min-height:${(o.rows || 3) * 19}px">${esc(String(g(k, def) ?? ''))}</div></div>${o.hint ? hp(o.hint) : ''}</div>`;
    const soon = (l, icon = '', kind = 'os_go', o = {}) => `<button type="button" class="${kind} na_ob_soon${o.cls ? ` ${o.cls}` : ''}" aria-label="${esc(o.aria || l)}"${o.off ? ' disabled' : ''}>${icon ? li(icon, o.size || 13, 2.2) : ''}${l}</button>`;
    const ib = (icon, l, cls = 'na_ob_soon', at = '') => `<button type="button" class="os_ib ${cls}" aria-label="${esc(l)}" title="${esc(l)}"${at}>${li(icon, 16)}</button>`;
    const add = (l, cls = 'na_ob_soon', icon = 'plus') => `<button type="button" class="ot_add ${cls}" aria-label="${esc(l)}">${li(icon, 15, 2.2)}${l}</button>`;
    const nav = (v, l, d = '', icon = 'chevron-right') => `<div role="button" tabindex="0" class="os_rw ot_t ${v ? 'na_ob_srow' : 'na_ob_soon'}" data-v="${v}" aria-label="${l}"><span class="ot_x"><span class="os_l">${l}</span>${d ? `<span class="os_d">${d}</span>` : ''}</span><i class="os_ch">${li(icon, 16)}</i></div>`;
    const pp = (n, sub, btns) => `<div class="os_pp">${face(n, 32)}<span class="ot_x"><span class="os_l">${esc(n)}</span>${sub ? `<span class="os_d">${esc(sub)}</span>` : ''}</span>${btns}</div>`;
    const pad = h => `<div class="ot_p">${h}</div>`;
    const P = T.page, H = HELP[P] ? hp(HELP[P]) : '';
    const B = {
        // 설정 프로필 (마리나라 5592–5768 + ChatProfileBuilder의 문)
        profile: () => H + cd(sel('profile', '프로필', [['', '사용자 지정 설정 프로필'], ['default', '기본값']], ''), pad(`<div class="ot_r">${soon('편집', '', 'os_go', { aria: '이 프로필의 슬롯 편집' })}${soon('새로 만들기', 'plus', 'os_go', { aria: '이 채팅의 설정으로 새 프로필' })}<i class="os_sp"></i>${ib('star', '이 모드의 새 채팅에 쓸 기본 프로필로 표시')}</div>`))
            + cd(`<div class="ot_r ot_ic">${ib('save', '현재 채팅 설정을 이 프로필에 저장')}${ib('pencil', '프로필 이름 변경')}<i class="ot_vr"></i>${ib('download', '설정 프로필 가져오기 (.json)')}${ib('upload', '설정 프로필 내보내기 (.json)')}${ib('trash-2', '프로필 삭제')}</div>`),
        // 채팅 제목 (ChatNameSection): 이름 + 채팅 ID 복사
        name: () => H + `<div class="os_q"><div class="os_qi na_ob_snm" contenteditable="true" role="textbox" enterkeyhint="done" spellcheck="false" data-ph="${esc(T.autoName)}" aria-label="채팅 제목">${esc(T.name)}</div></div><button type="button" class="os_ok na_ob_snok">저장</button>`
            + cap('') + cd(`<div role="button" tabindex="0" class="os_rw na_os_copyid" aria-label="채팅 ID 복사"><span class="os_l">채팅 ID</span><span class="os_v ot_code">${esc(T.roomId)}</span><i class="os_ch">${li('copy', 15)}</i></div>`),
        // 채팅 분기 (ChatBranchesPanel)
        branches: () => H + `<button type="button" class="ot_add solid na_ob_soon" aria-label="분기 그래프 열기">${li('git-graph', 15, 2.2)}분기 그래프</button>`
            + `<div class="ot_g3">${[['upload', 'JSONL', 'JSONL로 내보내기'], ['file-text', '텍스트', '텍스트로 내보내기'], ['download', '가져오기', '분기 가져오기 (.jsonl)'], ['hash', 'Markdown', 'Markdown으로 내보내기'], ['book-open', '스토리', '열고, 공유하고, 인쇄할 수 있는 꾸민 HTML 스토리로 내보내기'], ['chart-column', '통계', '채팅 통계']].map(([k, l, a]) => soon(l, k, 'ot_gb', { aria: a, size: 14 })).join('')}${soon('범위 내보내기', 'list-checks', 'ot_gb w3', { aria: '첫 메시지와 마지막 메시지를 골라 그 부분만 내보내기', size: 14 })}</div>`
            + cd(`<div class="os_pp"><span class="ot_tile">${li('check', 15, 2.4)}</span><span class="ot_x"><span class="os_l">${esc(T.title)}</span><span class="os_d">현재 분기</span></span>${ib('pencil', '분기 이름 변경')}${ib('trash-2', '분기 삭제')}</div>`),
        // 연결 (ConnectionSection + 고르는 창의 문)
        conn: () => { const M = T.conns[0] || { name: '', sub: '' }, has = !!M.name && M.name !== '모델 없음';
            return H + cap('모델') + cd(`<div role="button" tabindex="0" class="os_rw ot_t na_os_sel" data-k="connOpen" aria-label="모델"><span class="ot_x"><span class="os_l">${has ? esc(M.name) : '설정된 모델 없음'}</span><span class="os_d">${has ? `메인을 따름${M.sub ? ` · ${esc(M.sub)}` : ''}` : '아직 메인 모델이 없습니다'}</span></span><i class="os_ch">${li('chevron-down', 16)}</i></div>`)
                + (has ? hp('메인을 바꾸면 이 채팅도 바뀝니다.') : '')
                + (T.open === 'connOpen' ? cap('지금 · 메인을 따름') + cd(pad(`<div class="ot_r">${soon('기본값 사용', 'house')}<i class="os_sp"></i>${ib('refresh-cw', '모델 목록 새로 고침')}</div>`), pad(`<div class="os_q ot_q0">${li('search', 16)}<div class="os_qi na_os_in" data-k="connQ" contenteditable="true" role="textbox" enterkeyhint="search" spellcheck="false" data-ph="모델 검색 또는 ID 붙여넣기…" aria-label="모든 모델 검색 또는 모델 ID 붙여넣기">${esc(g('connQ', ''))}</div></div>`))
                    + cap('모든 모델') + ((l => (l.length ? cd(...l.map((c, i) => `<div role="button" tabindex="0" class="os_rw ot_t na_ob_soon" aria-label="${esc(c.name)}"><span class="ot_x"><span class="os_l">${esc(c.name)}</span>${c.sub ? `<span class="os_d">${esc(c.sub)}</span>` : ''}</span>${i === 0 && !g('connQ', '') ? li('check', 16, 2.4) : ''}${ib('star', `${c.name} 즐겨찾기`)}</div>`)) : none(T.conns.some(c => c.name && c.name !== '모델 없음') ? '여기에는 아직 모델이 없습니다.' : '아직 모델이 없습니다. 계정을 추가하면 생깁니다.')))(T.conns.filter(c => c.name && c.name !== '모델 없음' && (!g('connQ', '') || `${c.name} ${c.sub}`.toLowerCase().includes(String(g('connQ', '')).toLowerCase())))))
                    + cd(`<button type="button" class="os_rw na_ob_soon" aria-label="계정 추가">${li('plus', 18)}<span class="os_l">계정 추가</span></button>`) : '')
                + cap('연결 설정') + cd(nav('stconn', 'API 연결', '키 · 주소 · 모델 · 연결 · 테스트 메시지', 'chevron-right')); },
        // 실리태번의 API 연결 (1-7): src/phonestconn.js가 실리의 진짜 칸을 읽어 준 목록(T.st)을 실리 순서대로 그려요. 소스마다 화면을 따로 짜지 않아요
        stconn: () => (T.st ? hp('실리태번의 API 연결 창을 그대로 조종합니다. 여기서 바꾸면 실리태번의 연결이 바뀝니다(롤플레이도 같은 연결을 씁니다). 키는 실리태번에만 저장됩니다.') + scGroup(T, T.st, false) : none('실리태번의 API 연결 창을 찾지 못했어요.')),
        // 프롬프트 프리셋 (ConversationPromptSection)
        preset: () => H + cd(sel('presetSrc', '프롬프트 소스', [['', '기본 대화 프롬프트']], ''))
            + area('presetText', '대화 프롬프트', '', '사용자 지정 대화 프롬프트를 입력하세요...', { rows: 6, mono: true, tail: `<span class="ot_chip">${g('presetText', '') ? '사용자 지정' : '기본값'}</span><i class="os_sp"></i>${g('presetText', '') ? ib('rotate-ccw', '기본 프롬프트로 초기화') : ''}${ib('maximize-2', '편집기 확장')}${ib('book-open', '매크로 참조')}`, hint: `~${Math.ceil(String(g('presetText', '')).length / 4)} 토큰` }),
        // 페르소나 (6132–6334): 고른 페르소나 줄(편집 · 제거) + 이전 메시지에 페르소나 적용
        persona: () => H + (T.me && !g('personaOff', false) ? cd(pp(T.me, '', `${ib('pencil', '페르소나 카드 편집')}${ib('x', '페르소나 제거', 'na_os_tg', ' data-k="personaOff"')}`)) : hp('선택된 페르소나가 없습니다.') + add('페르소나 선택'))
            + `<button type="button" class="ot_add solid na_os_sel" data-k="reassign" aria-label="이전 메시지에 페르소나 적용"${T.me && !g('personaOff', false) ? '' : ' disabled'}>${li('history', 15, 2.2)}이전 메시지에 페르소나 적용…</button>`
            + (T.open === 'reassign' ? cap('업데이트할 메시지') + cd(...[['none', '페르소나 없이 보낸 메시지'], ['as', '다음으로 보낸 메시지…'], ['all', '이 채팅의 모든 사용자 메시지']].map(([v, l]) => `<div role="button" tabindex="0" class="os_rw na_os_seg" data-k="reTarget" data-v="${v}"><i class="ot_rd${g('reTarget', 'none') === v ? ' on' : ''}"></i><span class="os_l">${l}</span><span class="os_v">0</span></div>`)) + `<button type="button" class="os_ok na_ob_soon" aria-label="메시지 업데이트" disabled>메시지 0개 업데이트</button>` : ''),
        // 캐릭터 (6337–6527): 줄마다 채팅에서 켜기/끄기(둘 이상일 때) · 카드 편집 · 제거, 캐릭터 추가
        people: () => H + (T.members.length ? cd(...T.members.map(n => pp(n, '', `${T.group ? ib(g(`off:${n}`, false) ? 'eye-off' : 'eye', g(`off:${n}`, false) ? '채팅에서 활성화' : '채팅에서 비활성화', 'na_os_tg', ` data-k="off:${esc(n)}"`) : ''}${ib('pencil', '캐릭터 카드 편집')}${ib('trash-2', '채팅에서 제거', T.group ? 'na_ob_prem' : 'na_ob_soon', ` data-n="${esc(n)}"`)}`))) : hp('이 채팅에 추가된 캐릭터가 없습니다.'))
            + (g('addOpen', false) ? cap('캐릭터') + (T.more.length ? cd(...T.more.map(n => pp(n, '', ib('plus', `${n} 추가`, 'na_ob_padd', ` data-n="${esc(n)}"`)))) : none('아직 캐릭터가 없습니다.')) + `<button type="button" class="os_ok na_os_tg" data-k="addOpen">완료</button>` : `<button type="button" class="ot_add na_os_tg" data-k="addOpen" aria-label="캐릭터 추가">${li('plus', 15, 2.2)}캐릭터 추가</button>`),
        // 단체 채팅 (6661–6918, 캐릭터가 둘 이상일 때)
        group: () => { const ind = T.auto.ind, ord = T.auto.order;
            return H + cap('모드') + seg('', [['merged', '묶음'], ['individual', '개별']], '', 'na_os_gmode', ind ? 'individual' : 'merged')
                + (ind ? cap('응답 순서') + seg('', [['sequential', '순차'], ['smart', '스마트'], ['manual', '수동']], '', 'na_os_gorder', ord) + hp({ sequential: '응답할 수 있는 캐릭터가 목록 순서대로 하나씩 응답합니다. 오프라인 캐릭터는 건너뜁니다.', smart: '스마트는 대화, 스케줄 상태, 수다스러움을 바탕으로 응답할 수 있는 캐릭터를 하나 이상 고릅니다.', manual: '자동 응답이 없습니다. 캐릭터를 하나 이상 @멘션해 대화로 부르세요.' }[ord] || '')
                    + cd(tg('', '프롬프트에 차례 추가', T.auto.turn ? '개별 차례마다 응답하는 캐릭터에 대한 짧은 지시가 포함됩니다.' : '개별 차례는 차례 지시 없이 컨텍스트에 의존합니다.', true, 'na_os_gturn', T.auto.turn)) : ''); },
        // 연결된 채팅 (7535–7647)
        linked: () => H + cd(tg('cross', '채팅 간 인식', '캐릭터가 자신의 다른 채팅에서 일어나는 일을 압니다', true))
            + (T.open === 'linkPick' ? cd(pad(`<div class="ot_r"><div class="os_q ot_q0" style="flex:1">${li('search', 16)}<div class="os_qi na_os_in" data-k="linkQ" contenteditable="true" role="textbox" enterkeyhint="search" spellcheck="false" data-ph="롤플레이 채팅 검색" aria-label="롤플레이 채팅 검색">${esc(g('linkQ', ''))}</div></div>${ib('x', '선택기 닫기', 'na_os_sel', ' data-k="linkPick"')}</div>`)) : `<button type="button" class="ot_add na_os_sel" data-k="linkPick" aria-label="롤플레이에 연결">${li('plus', 15, 2.2)}롤플레이에 연결</button>`),
        // 로어북 (LorebooksSection)
        lore: () => H + cd(inp('loreBudget', '로어북 토큰 예산', '', '기본값', { num: true })) + hp('이 채팅에서 활성화된 로어북 검색 결과의 컨텍스트 상한입니다. 0으로 설정하면 제한이 없습니다.')
            + none('이 채팅에 활성화된 로어북이 없습니다.')
            + (T.open === 'lorePick' ? cd(pad(`<div class="ot_r"><div class="os_q ot_q0" style="flex:1">${li('search', 16)}<div class="os_qi na_os_in" data-k="loreQ" contenteditable="true" role="textbox" enterkeyhint="search" spellcheck="false" data-ph="로어북 검색…" aria-label="로어북 검색">${esc(g('loreQ', ''))}</div></div>${ib('x', '선택기 닫기', 'na_os_sel', ' data-k="lorePick"')}</div>`), none('사용할 수 있는 로어북이 이미 모두 여기에 활성화되어 있습니다.')) : `<button type="button" class="ot_add na_os_sel" data-k="lorePick" aria-label="로어북 추가">${li('plus', 15, 2.2)}로어북 추가</button>`),
        // 활성 컨텍스트 (ActiveLorebookEntriesContent, 읽기 전용)
        ctx: () => { const C = T.ctx || { items: [] }, BD = { constant: 'CONST', selective: 'SELECT', normal: 'NORMAL' };
            const row = (x, i) => `<div role="button" tabindex="0" class="os_rw ot_t ot_cx na_os_sel" data-k="ctx:${i}" aria-label="${esc(x.name)}"><i class="ot_dot ${x.st}"></i><span class="ot_x"><span class="ot_cl"><span class="os_l">${esc(x.name)}</span><span class="ot_chip">${BD[x.st] || 'NORMAL'}</span>${x.vector ? `<span class="ot_chip">벡터${x.score ? ` ${esc(x.score)}` : ''}</span>` : ''}${x.loc ? '<span class="ot_chip">위치</span>' : ''}<span class="ot_u cg_num">#${esc(String(x.order))}</span></span><span class="os_d">${esc(x.book)} · ${esc(x.src)}</span>${x.keys?.length ? `<span class="os_d">키: ${esc(x.keys.slice(0, 5).join(', '))}${x.keys.length > 5 ? ` +${x.keys.length - 5}` : ''}</span>` : ''}${x.hit ? `<span class="os_d">일치: ${esc(x.hit)}</span>` : ''}${T.open === `ctx:${i}` ? `<span class="ot_tx">${esc(x.text) || '(비어 있음)'}</span>` : ''}</span><button type="button" class="os_go na_ob_soon" aria-label="${esc(x.book)}에서 ${esc(x.name)} 열기">열기</button></div>`;
            const loc = C.items.filter(x => x.loc), rest = C.items.filter(x => !x.loc), ix = x => C.items.indexOf(x);
            return H + (C.items.length ? `<div class="ot_r"><span class="ot_cnt"><b>${C.items.length}</b>개 활성 • ~${esc(String(C.tokens || 0))} 토큰</span></div>`
                + (C.skipped ? `<div class="ot_box warn">${li('triangle-alert', 15)}<span>일치하는 로어 항목 ${C.skipped}개가 토큰 예산으로 건너뛰어졌습니다</span></div>` : '')
                + (loc.length ? cap('현재 위치') + cd(...loc.map(x => row(x, ix(x)))) : '') + (rest.length ? (loc.length ? cap('그 밖의 활성 로어') : '<div class="os_cap"></div>') + cd(...rest.map(x => row(x, ix(x)))) : '') : none('이 채팅에 활성 항목이 없습니다')); },
        // 에이전트 (대화 화면 7130–7532): 명령 카드 + 스케줄 생성 환경설정. 패키지가 있어야 뜨는 카드는 docs/MARINARA-PORT.md
        agents: () => H + cap('명령') + cd(tg('cmds', '명령', '모델이 스케줄, 장면, 미디어, 반응 등 설치된 명령으로 나와 상호작용할 수 있게 합니다.', true), ...(g('cmds', true) ? COMMANDS.map(([k, l, d]) => tg(`cmd:${k}`, l, d, true)) : []))
            + area('schedPrefs', '스케줄 생성 환경설정', '', '예: 모두 자정 전에 자게 해 주세요. 캐릭터에게 오전 10시~정오에 자유 시간을 주세요. 저는 평일 9시~5시에 일합니다.', { rows: 4, hint: '전역 설정입니다. 모든 대화 채팅의 다음 스케줄 재생성(수동 또는 주간 자동)에 적용됩니다.' })
            + hp('캐릭터 스케줄을 생성하는 방식을 이끄는 자유 형식 지침입니다. 지시(\'자정 넘어서는 아무도 깨어 있지 않게\')와 사실 조건(\'나는 9시~5시에 일함\') 모두 됩니다.')
            + (String(g('schedPrefs', '')).trim() ? `<div class="ot_box"><b>스케줄 생성 환경설정 활성</b><span>“${esc(String(g('schedPrefs', '')).trim().slice(0, 120))}”</span><span>다음에 스케줄을 재생성할 때 적용됩니다.</span></div>` : ''),
        // 갤러리 (ChatGallery): 단추 줄 · 검색 · 선택 · 탭 · 올리기 · 빈 상태
        gallery: () => { const tab = g('galTab', 'img');
            return H + `<div class="ot_r ot_w">${soon('일러스트', 'paintbrush')}${soon('셀카', 'camera')}${soon('동영상', 'film')}</div>`
                + `<div class="os_q">${li('search', 16)}<div class="os_qi na_os_in" data-k="galQ" contenteditable="true" role="textbox" enterkeyhint="search" spellcheck="false" data-ph="채팅, 캐릭터, 페르소나, 스프라이트 이미지 검색" aria-label="갤러리 이미지 검색">${esc(g('galQ', ''))}</div></div>`
                + `<div class="ot_r ot_w">${soon('선택', 'check', 'os_go', { off: true })}${soon('모두 선택', '', 'os_go', { off: true })}</div>`
                + seg('galTab', [['img', '이미지 0'], ['vid', '동영상 0']], 'img')
                + (tab === 'img' ? add('이미지 업로드', 'na_ob_soon', 'upload') + none('아직 이미지가 없습니다<br>이미지를 업로드하거나 일러스트를 생성해 갤러리를 채우세요') : cap('동영상 메시지') + none('아직 동영상이 없습니다<br>동영상 메시지를 보내거나 사진을 움직이게 해 이 탭을 채우세요')); },
        // 기억 회상 (대화 화면 9995–10006)
        memory: () => H + cd(tg('recall', '기억 회상 사용', '이 채팅의 이전 대화에서 관련된 부분을 회상해 컨텍스트로 넣습니다.', true))
            + `<button type="button" class="ot_add solid na_ob_srow" data-v="memlist" aria-label="이 채팅의 기억 열기">${li('brain', 15, 2.2)}이 채팅의 기억 열기</button>`,
        // 이 채팅의 기억 (MemoryRecallMemoriesModal)
        memlist: () => `<div class="ot_r"><span class="ot_cnt"><b>0</b> 기억 조각</span><i class="os_sp"></i>${ib('upload', '기억 내보내기', 'na_ob_soon', ' disabled')}${ib('download', '기억 가져오기')}${soon('모두 다시 벡터화', 'refresh-cw', 'os_go', { aria: '모든 기억 다시 벡터화' })}${ib('trash-2', '모든 기억 지우기', 'na_ob_soon', ' disabled')}</div>`
            + none('이 채팅에는 아직 회상 기억이 만들어지지 않았습니다. 생성 후 메시지 5개씩 묶어 만들어집니다.'),
        // 번역 (TranslationSection)
        trans: () => { const sv = g('trSvc', 'google'), ai = sv === 'ai';
            return H + cd(sel('trSvc', '서비스', [['google', 'Google 번역'], ['deepl', 'DeepL API'], ['deeplx', 'DeepLX (자체 호스팅)'], ['ai', 'AI (연결 사용)']], 'google'), inp('trIn', '모델 언어', '', ai ? 'English' : 'en'), inp('trOut', '내 언어', '', ai ? 'Korean' : 'ko'))
                + hp(`내가 보내는 메시지는 모델 언어로, 모델의 응답은 내 언어로 번역됩니다. ${ai ? 'English, Japanese, Spanish 같은 언어 이름을 쓰세요.' : 'en, ja, es, de, fr, zh, ko 같은 언어 코드를 쓰세요.'}`)
                + (ai ? cd(sel('trConn', '연결', [['', '연결 선택…']], '')) + hp('번역에 사용할 AI 연결')
                    + area('trInP', '보내는 메시지 프롬프트', '', '', { rows: 5, mono: true, tail: `<i class="os_sp"></i>${g('trInP', '') ? soon('복원', 'rotate-ccw', 'os_go', { aria: '기본 프롬프트 복원' }) : ''}`, hint: 'AI 번역이 쓰는 시스템 프롬프트입니다. {{targetLanguage}}는 위의 해당 언어로 바뀝니다.' })
                    + area('trOutP', '받는 응답 프롬프트', '', '', { rows: 5, mono: true, tail: `<i class="os_sp"></i>${g('trOutP', '') ? soon('복원', 'rotate-ccw', 'os_go', { aria: '기본 프롬프트 복원' }) : ''}` }) : '')
                + (sv === 'deepl' ? cd(inp('trKey', 'DeepL API 키', '', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx')) : '')
                + (sv === 'deeplx' ? cd(inp('trUrl', 'DeepLX URL', '', 'http://localhost:1188')) + hp('자체 호스팅한 DeepLX 인스턴스의 URL (예: http://localhost:1188)') : '')
                + cap('') + cd(tg('trAuto', '응답 자동 번역', '생성 후 AI 응답을 자동으로 번역합니다.', false), tg('trMine', '내 메시지 번역', '보내기 전에 내 메시지를 대상 언어로 번역합니다.', false), tg('trBtn', '초안 번역 버튼 표시', '보내기 옆에 번역 바로가기를 추가합니다. 대화에서는 입력창 스마일 메뉴의 도구 탭에서 초안 번역을 늘 쓸 수 있습니다.', false), tg('trOnly', '번역만 표시', '메시지가 번역되면 원문과 번역을 함께 보여 주는 대신 번역만 그 자리에 보여 줍니다.', false))
                + hp('이 번역 설정을 모든 모드의 새 채팅용으로 저장합니다. 설정 마법사와 채팅 프로필의 설정이 먼저 적용됩니다. 기존 채팅은 그대로입니다.') + `<div class="ot_r ot_w">${soon('번역기 기본값 저장', 'save')}</div>`; },
        // 자율 메시지 (6921–7127): 켜기 → 채팅 체크인 제한, 캐릭터 간 대화(단체), 스케줄, 상태 줄 + 재생성, 시간대, 스케줄 편집
        auto: () => { const A = T.auto, S = T.sched, son = !!S.on, num = A.cap !== '';
            return H + cd(tg('', '자율 메시지', '스케줄이 없어도 내가 활동하지 않을 때 캐릭터가 메시지를 보냅니다', false, 'na_ob_aon', A.on),
                ...(A.on ? [sel('capMode', '채팅 체크인 제한', [['default', '기본 채팅 상한(수다스러움 기준)'], ['numeric', '숫자 값']], 'default', 'na_os_capm', num ? 'numeric' : 'default'), ...(num ? [inp('', '하루 체크인 수', A.cap, '8', { num: true, cls: 'na_ob_acap' })] : [])] : []))
                + (A.on ? hp('채팅 전체의 상한을 설정하며 캐릭터별 상한은 이보다 낮출 수만 있습니다. 상한을 높이면 모델 요청과 알림이 많이 발생할 수 있습니다.') : '')
                + (T.group ? cd(tg('', '캐릭터 간 대화', '단체 채팅에서 캐릭터끼리 대화합니다', false, 'na_ob_aex', A.ex)) : '')
                + cap('') + cd(tg('', '스케줄', '활동 가능 시간 및 지연을 위한 선택적 캐릭터 루틴', false, 'na_os_schon', son),
                    `<div class="os_rw ot_t ot_st"><span class="ot_x"><span class="os_l">${!son ? '스케줄 꺼짐: 자율성은 수다스러움과 내 상태를 사용합니다.' : S.any ? '스케줄 생성됨(상태는 캐릭터 루틴에서 결정됩니다)' : '스케줄 켜짐: 준비되면 루틴을 생성하세요.'}</span><span class="os_d">${son ? '기존 캐릭터 루틴이 재사용됩니다. 새 일정이 필요하면 새로 생성하세요.' : '활동 가능 시간과 바쁨 지연을 반영하려면 스케줄을 켜세요.'}</span></span><button type="button" class="os_go na_os_regen" aria-label="스케줄 생성"${S.busy || !T.members.length ? ' disabled' : ''}>${li('refresh-cw', 13, 2.2)}${S.busy ? '재생성 중…' : S.any ? '재생성' : '생성'}</button></div>`)
                + cap('') + cd(`<div class="os_rw ot_i" style="cursor:default">${li('clock-3', 17)}<span class="os_l">스케줄 시간대</span><span class="os_v ot_ok">${li('check', 13, 2.4)}모든 대화</span></div>`, `<div role="button" tabindex="0" class="os_rw na_ob_srow" data-v="tz" aria-label="스케줄 시간대 고르기"><span class="os_l">${esc(S.zone)}</span><i class="os_ch">${li('chevron-down', 16)}</i></div>`, ...(S.differs ? [`<button type="button" class="os_rw ot_c na_os_tzdev" aria-label="기기 설정 사용">${li('locate-fixed', 16)}<span>기기 설정 사용</span></button>`] : []))
                + hp(`온라인 상태와 자율 메시지는 이 시간대를 따릅니다. 현재 기기의 시간대: ${esc(S.device)}.`)
                + (S.any ? cap('스케줄 편집') + cd(...S.list.map(x => `<div role="button" tabindex="0" class="os_rw na_os_sched" data-n="${esc(x.n)}" aria-label="${esc(x.n)} 스케줄 편집"><span class="os_l">${esc(x.n)}</span><span class="os_v">${x.days ? `${x.days}일 예정됨` : '스케줄 만들기'}</span></div>`)) : ''); },
        // 스케줄 시간대 고르기 (ConversationTimeZoneSelect의 목록)
        tz: () => `<div class="os_q">${li('search', 16)}<div class="os_qi na_os_tzq" contenteditable="true" role="textbox" enterkeyhint="search" spellcheck="false" data-ph="시간대 검색" aria-label="시간대 검색">${esc(T.tzQ)}</div></div>`
            + (T.tzList.length ? cd(...T.tzList.map(z => `<div role="button" tabindex="0" class="os_rw na_os_tz" data-v="${esc(z.id)}"><span class="os_l">${esc(z.label)}</span>${z.on ? li('check', 16, 2.4) : ''}</div>`)) : none('검색 결과가 없어요')),
        // 자동 요약 (10009–10175)
        sum: () => { const sem = !!g('semOn', false);
            return H + cd(nav('sumedit', '요약 편집', '캐릭터가 이 채팅에서 기억하는 내용을 검토하고 편집합니다.', 'pencil'))
                + cd(tg('semOn', '의미 기반 요약 검색', '최근 주는 컨텍스트에 두고, 설정된 임베딩 모델과 아래 한도로 관련된 이전 주를 불러옵니다. 임베딩을 쓸 수 없으면 모든 요약이 컨텍스트에 남습니다.', false), ...(sem ? [inp('semRecent', '최근 주', '4', '', { num: true }), inp('semOlder', '이전 주', '4', '', { num: true }), inp('semMin', '관련도 임계값', '0.30', '')] : []))
                + cap('') + cd(sel('sumConn', '요약 제공자', [['', '에이전트 기본값 또는 채팅 모델']], ''), inp('sumMax', '최대 출력 크기', '4096', '', { num: true }))
                + hp('수동 및 자동 요약에 사용할 모델 제공자를 고릅니다.')
                + cd(sel('rollHour', '하루 전환 시각', HOURS, '4')) + hp('이 시각 전에 보낸 메시지는 전날로 칩니다. 절대 대화하지 않는 시간을 고르면 늦은 밤 대화가 중간에 끊기지 않습니다.')
                + cd(inp('sumTail', '최근 메시지 꼬리', '10', '', { num: true })) + hp('요약된 뒤에도 원문 그대로 유지할 최근 메시지 수입니다. 캐릭터가 요점만이 아니라 어젯밤 대화의 실제 흐름을 이어 가는 데 도움이 됩니다. <b>0</b>으로 설정하면 끕니다. 값이 클수록 프롬프트 크기와 모델 비용이 늘어납니다.'); },
        // 요약 편집 (SummariesEditorModal)
        sumedit: () => `<div class="ot_r"><span class="ot_cnt"><b>0</b>개 항목 · ~0 토큰</span></div>` + hp('이번 주의 날들은 주가 끝나면 자동으로 주간 요약으로 합쳐집니다. 이번 주 날짜의 편집 내용은 그 합치기로 다시 쓰일 수 있습니다.')
            + cap('누락된 요약') + cd(`<div class="os_rw ot_t ot_st"><span class="ot_x"><span class="os_d">실패했거나 자동 요약을 받지 못한 지난 날을 다시 시도합니다.</span></span>${soon('백필', 'refresh-cw', 'os_go', { aria: '누락된 요약 생성' })}</div>`)
            + none('아직 요약이 없습니다. 대화한 첫날이 끝난 뒤 다시 오세요.')
            + `<div class="ot_r ot_w ot_end"><button type="button" class="os_go na_ob_sback">취소</button>${soon('저장', '', 'os_go', { off: true })}</div>`,
    };
    return B[P] ? B[P]() : null;
}

// 빠른 전환기 (마리나라 QuickSwitcherMobile + ConnectionSwitcherBody + CharacterPickerList, fc0333c: 입력칸의 ^ 로 열어요).
// 탭 둘: 모델(지금 줄 · 검색 · 맨 화면[즐겨찾기 · 계정] ↔ 계정 화면[그 계정의 즐겨찾기 · 모든 모델]) · 페르소나(검색 · 없음 · 목록).
// 무작위(주사위 · 무작위 풀)는 소망이 뺐고, 컨텍스트 막대는 값을 줄 함수가 없어 W.ctx가 있을 때만 그려요.
// W: { tab, q, pq, drilled, pane, order, stars: [id], conns: [{ id, name, sub, roles: [] }], personas: [{ id, name, title, src, cur }], limit, ctx: { used, max, pct } | null }
export function orbitSwitcher(W) {
    const none = t => `<div class="os_no">${t}</div>`, cap = (t, n) => `<div class="os_cap ow_cap"><span>${t}</span>${n === undefined ? '' : `<span class="cg_num">${n}</span>`}</div>`, cd = (...r) => `<div class="os_cd">${r.join('')}</div>`;
    const tabs = `<div class="os_sg ow_sg">${[['models', '모델'], ['personas', '페르소나']].map(([k, t]) => `<button type="button" class="na_ow_tab${W.tab === k ? ' on' : ''}" data-v="${k}">${t}</button>`).join('')}</div>`;
    let body = '';
    if (W.tab === 'models') {
        const all = W.conns.filter(c => c.name && c.name !== '모델 없음'), cur = W.curName ? null : (all.find(c => c.id === W.cur) || null), nowLabel = W.follows ? '지금 · 메인을 따름' : '지금 · 이 채팅만', stars = new Set(W.stars), q = W.q.trim().toLowerCase();
        const groups = []; for (const c of all) { const k = c.sub || c.name; let g = groups.find(x => x.key === k); if (!g) groups.push(g = { key: k, name: k, rows: [] }); g.rows.push(c); }
        const groupOf = c => groups.find(g => g.rows.includes(c)), starred = W.stars.map(id => all.find(c => c.id === id)).filter(Boolean);
        const paneGroup = W.drilled ? groups.find(g => g.key === W.pane) : null, paneKey = paneGroup?.key;   // (즐겨찾기 화면은 따로 없어요: 맨 화면 맨 위에 있어요, 소망)
        const tile = () => '';   // (제공자 글자 타일은 소망이 뺐어요)
        // 모델 한 줄 (ModelRow): 타일 · 이름 · 둘째 줄(어디서 도는지) · 역할 알약 · 지금 것이면 ✓ · [순서 ↑↓ | 설정 · 즐겨찾기]
        const row = (c, o = {}) => { const st = stars.has(c.id), is = c === cur, ord = W.order && o.order, sub = o.away ? (groupOf(c)?.name || '') : (o.sub ?? '');
            return `<div class="os_pp ow_row${is && !o.now ? ' cur' : ''}"><div role="button" tabindex="0" class="ow_pick na_ow_pick" data-id="${esc(c.id)}" aria-label="${esc(c.name)}"${is ? ' aria-current="true"' : ''}>${tile(c, o.now)}<span class="ot_x"><span class="os_l">${esc(c.name)}</span>${sub ? `<span class="os_d">${esc(sub)}</span>` : ''}</span>${(c.roles || []).map((r, i) => `<span class="ot_chip${i ? '' : ' strong'}">${r}</span>`).join('')}${is && !o.now ? `<i class="ow_ck">${li('check', 15, 2.4)}</i>` : ''}</div>`
                + (o.now ? '' : ord && st ? `<button type="button" class="os_ib na_ow_mv" data-id="${esc(c.id)}" data-by="-1" aria-label="${esc(c.name)} 위로 이동"${W.stars.indexOf(c.id) <= 0 ? ' disabled' : ''}>${li('arrow-up', 15)}</button><button type="button" class="os_ib na_ow_mv" data-id="${esc(c.id)}" data-by="1" aria-label="${esc(c.name)} 아래로 이동"${W.stars.indexOf(c.id) >= W.stars.length - 1 ? ' disabled' : ''}>${li('arrow-down', 15)}</button>`
                    : `${st ? `<button type="button" class="os_ib na_ob_soon" aria-label="${esc(c.name)} 설정">${li('sliders-horizontal', 15)}</button>` : ''}<button type="button" class="os_ib ow_st na_ow_star${st ? ' on' : ''}" data-id="${esc(c.id)}" aria-pressed="${st}" aria-label="${esc(c.name)} 즐겨찾기">${li('star', 16)}</button>`) + '</div>'; };
        const orderBtn = `<div class="ot_r ot_end ow_ord"><button type="button" class="os_go na_ow_order" aria-pressed="${!!W.order}">${W.order ? '완료' : '순서 편집'}</button></div>`;
        const dflt = W.follows ? '' : `<button type="button" class="os_go na_ow_default" aria-label="기본값 사용">${li('house', 13, 2.2)}기본값 사용</button>`;
        const now = `<div class="ow_now${dflt ? ' d' : ''}">${cur ? row(cur, { now: true, sub: [nowLabel, groupOf(cur)?.name].filter(Boolean).join(' · ') }) : `<div class="ow_nn"><div class="os_cap ow_cap"><span>${nowLabel}</span></div><div class="ow_nx">${W.curName ? esc(W.curName) : '모델 선택'}</div></div>`}${dflt}</div>`;
        const search = `<div class="os_q ow_q">${li('search', 16)}<div class="os_qi na_ow_q" contenteditable="true" role="textbox" enterkeyhint="go" spellcheck="false" autocapitalize="off" data-ph="${paneGroup ? `${esc(paneGroup.name)} 검색...` : '모델 검색 또는 ID 붙여넣기…'}" aria-label="모든 모델 검색 또는 모델 ID 붙여넣기">${esc(W.q)}</div>${W.q ? `<button type="button" class="os_ib na_ow_qx" aria-label="검색 지우기">${li('x', 15)}</button>` : ''}</div>`;
        const add = cd(`<button type="button" class="os_rw na_ob_soon" aria-label="계정 추가">${li('plus', 18)}<span class="os_l">계정 추가</span></button>`);
        if (!all.length) body = now + none('아직 모델이 없습니다. 계정을 추가하면 생깁니다.') + add;
        else if (q) {   // 검색 결과: 즐겨찾기 먼저, 계정별로, 마지막에 친 글자를 모델 ID로 (계정을 골라 둔 상태면 그 계정 안에서만)
            const hit = c => `${c.name} ${c.sub}`.toLowerCase().includes(q), scope = paneGroup ? paneGroup.rows : all, hits = scope.filter(hit), typed = W.q.trim(), target = paneGroup || (cur && groupOf(cur)) || groups[0];
            const secs = paneGroup ? [['즐겨찾기', hits.filter(c => stars.has(c.id)), false], ['모든 모델', hits.filter(c => !stars.has(c.id)), false]]
                : [['즐겨찾기', hits.filter(c => stars.has(c.id)), true], ...groups.map(g => [esc(g.name), hits.filter(c => !stars.has(c.id) && g.rows.includes(c)), false])];
            const use = target && !/\s/.test(typed) && !all.some(c => c.name === typed) ? cd(`<div role="button" tabindex="0" class="os_rw ot_t na_ow_use" data-id="${esc(target.rows[0].id)}" data-m="${esc(typed)}" aria-label="“${esc(typed)}” 사용">${li('search', 17)}<span class="ot_x"><span class="os_l">“${esc(typed)}” 사용</span><span class="os_d">${esc(target.name)}에 이 ID 추가</span></span></div>`) : '';
            body = now + search + secs.filter(s => s[1].length).map(([l, r, away]) => cap(l, r.length) + cd(...r.map(c => row(c, { away })))).join('') + use
                + (hits.length || use ? '' : none('일치하는 모델이 없습니다.')) + (paneGroup ? cd(`<div role="button" tabindex="0" class="os_rw na_ow_qall" aria-label="모든 계정 검색">${li('search', 17)}<span class="os_l">모든 계정 검색</span></div>`) : ''); }
        else if (!paneGroup) body = now + search   // 맨 화면: 즐겨찾기(맨 위) · 계정들 · 계정 추가
            + `<div class="ow_ttl"><b>즐겨찾기</b><span>모델 ${starred.length}개 · 계정 ${new Set(starred.map(c => groupOf(c).key)).size}개</span></div>`
            + (starred.length > 1 ? orderBtn : '') + (starred.length ? cd(...starred.map(c => row(c, { away: true, order: starred.length > 1 }))) : none('아직 즐겨찾기한 모델이 없습니다. 계정을 고르고 쓰는 모델을 즐겨찾기하세요.'))
            + cap('계정') + cd(...groups.map(g => `<div role="button" tabindex="0" class="os_rw ot_t na_ow_pane" data-v="${esc(g.key)}"><span class="ot_x"><span class="os_l">${esc(g.name)}</span><span class="os_d">모델 ${g.rows.length}개</span></span><i class="os_ch">${li('chevron-right', 16)}</i></div>`)) + add;
        else { const back = `<button type="button" class="ow_back na_ow_back">${li('chevron-left', 16)}모든 연결</button>`;   // 한 계정의 화면: 그 계정의 즐겨찾기 · 모든 모델
            const st = paneGroup.rows.filter(c => stars.has(c.id)).sort((a, b) => W.stars.indexOf(a.id) - W.stars.indexOf(b.id)), rest = paneGroup.rows.filter(c => !stars.has(c.id));
            body = search + back + `<div class="os_pp ow_hd"><span class="ot_x"><span class="os_l">${esc(paneGroup.name)}</span><span class="os_d">모델 ${paneGroup.rows.length}개 · ${st.length ? `즐겨찾기 ${st.length}개` : '즐겨찾기 없음'}</span></span><button type="button" class="os_ib na_ob_soon" aria-label="모델 목록 새로 고침">${li('refresh-cw', 15)}</button></div>`
                + (st.length ? cap('즐겨찾기', st.length) + cd(...st.map(c => row(c))) : '') + (rest.length ? cap('모든 모델', rest.length) + cd(...rest.map(c => row(c))) : '') + (st.length + rest.length ? '' : none('여기에는 아직 모델이 없습니다.')); }
        if (W.ctx) body = `<div class="ow_ctx"><div><span>컨텍스트</span><b class="cg_num">${esc(W.ctx.used)} / ${esc(W.ctx.max)} 토큰</b></div><i><i style="width:${Math.max(0, Math.min(100, W.ctx.pct))}%"></i></i></div>` + body;
    } else {   // 페르소나 (CharacterPickerList kind="persona"): 검색 · 없음 · 페르소나 줄(지금 것에 ✓) · 50개씩 더 보기
        const q = W.pq.trim().toLowerCase(), list = W.personas.filter(p => !q || `${p.name} ${p.title || ''}`.toLowerCase().includes(q)), any = W.personas.some(p => p.cur);
        const pr = (p, pick, ava) => `<div role="button" tabindex="0" class="os_pp ow_row ow_p na_ow_persona${pick ? ' cur' : ''}" data-id="${esc(p.id)}" aria-label="${esc(p.name)}"${pick ? ' aria-current="true"' : ''}>${ava}<span class="ot_x"><span class="os_l">${esc(p.name || '?')}</span>${p.title ? `<span class="os_d">${esc(p.title)}</span>` : ''}</span>${pick ? `<i class="ow_ck">${li('check', 15, 2.4)}</i>` : ''}</div>`;
        const ava = p => (p.src ? `<span class="ow_av"><img src="${esc(p.src)}" alt="" loading="lazy"></span>` : `<span class="ow_av">${esc((p.name || '?')[0].toUpperCase())}</span>`);
        body = `<div class="os_q ow_q">${li('search', 16)}<div class="os_qi na_ow_pq" contenteditable="true" role="textbox" enterkeyhint="search" spellcheck="false" data-ph="페르소나 검색" aria-label="페르소나 검색">${esc(W.pq)}</div></div>`
            + (!W.personas.length ? `<div class="os_no ow_em"><span class="ow_tile">${li('user', 18)}</span>아직 페르소나가 없습니다.</div>`
                : q && !list.length ? `<div class="os_no ow_em">"${esc(W.pq.trim())}"와 일치하는 항목이 없습니다.<button type="button" class="os_go na_ow_pqx">${li('x', 13, 2.2)}검색 지우기</button></div>`
                : (q ? '' : cd(pr({ id: '', name: '없음', title: '페르소나가 선택되지 않았습니다' }, !any, `<span class="ow_av none">${li('ban', 14)}</span>`)))
                    + (list.length ? cd(...list.slice(0, W.limit).map(p => pr(p, p.cur, ava(p))), ...(list.length > W.limit ? [`<button type="button" class="os_rw ot_c na_ow_more">${Math.min(50, list.length - W.limit)}개 더 보기</button>`] : [])) : ''));
    }
    return `<div class="ob_shade na_ow_x"></div><div class="ob_sheet os_sh ow"><i class="ob_grab"></i><div class="os_hd"><b>빠른 전환기</b><button type="button" class="os_ib na_ow_x" aria-label="빠른 전환기 닫기">${li('x', 19)}</button></div><div class="os_bd">${tabs}${body}</div></div>`;
}

// 생각 보기 (마리나라 MessageThinkingModal): 제목 · 복사 단추 · 뇌 아이콘 + 생각 글. 저장된 생각이 없으면 안내만
export const orbitThink = K => `<div class="ob_shade na_ok_x"></div><div class="ob_sheet os_sh ok"><i class="ob_grab"></i><div class="os_hd"><b>모델 생각</b>${K.text ? `<button type="button" class="os_ib na_ok_copy" aria-label="모델 생각 복사">${li(K.copied ? 'check' : 'copy', 16)}</button>` : ''}<button type="button" class="os_ib na_ok_x" aria-label="생각 닫기">${li('x', 19)}</button></div><div class="os_bd">${K.text ? `<div class="ok_t">${li('brain', 15)}<div class="ok_x">${esc(K.text)}</div></div>` : `<div class="ot_box warn">${li('info', 15)}<span>이 메시지에는 저장된 생각이 없습니다.</span></div>`}</div></div>`;

// 프롬프트 보기 (마리나라 PeekPromptModal): 제목 · 출처 알약 · "섹션 N개 · ~T 토큰" · 복사 · 닫기 / 찾기 줄(이전 · 다음) / 생성 정보 · 참고 / 섹션 목록(접힘) · 채팅 기록.
// 찾기에 글이 있으면 섹션 대신 메시지마다 한 장(찾은 글 표시). 결정 진단 · 응답 점검 · "현재 컨텍스트 보기"는 없어요(docs/MARINARA-PORT.md).
// P: { exact, source, messages: [{ role, content }], note, gen: { provider, model, pills: [[이름, 값]] } | null, q, at, open: [열린 열쇠] }
export function orbitPeek(P) {
    const tok = t => Math.ceil(String(t || '').length / 4), total = tok(P.messages.map(m => m.content).join('\n\n')), q = P.q.trim(), open = new Set(P.open);
    const chip = (r, on) => `<span class="ot_chip op_r${on ? ' strong' : ''}">${esc(r)}</span>`, pretty = l => String(l).replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const hist = P.messages.filter(m => m.role === 'user' || m.role === 'assistant'), rest = P.messages.filter(m => !hist.includes(m));
    const secs = rest.map((m, i) => ({ k: `s${i}`, label: pretty((String(m.content).match(/^\s*<([a-z_][\w-]*)>\s*$/im) || [])[1] || m.role), role: m.role, content: m.content }));
    const badge = P.exact ? '정확한 텍스트 모델 요청' : P.source === 'live_preview' ? '실시간 미리 보기' : P.source === 'raw_messages' ? '원본 메시지' : '프롬프트 미리 보기';
    let n = 0; const marks = [], hl = t => { if (!q) return esc(t); const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu'); let out = '', last = 0, m; while ((m = re.exec(t))) { if (!m[0]) { re.lastIndex++; continue; } out += esc(t.slice(last, m.index)) + `<mark class="${n === P.at ? 'cur' : ''}">${esc(m[0])}</mark>`; marks.push(n++); last = m.index + m[0].length; } return out + esc(t.slice(last)); };
    const blk = (k, head, body) => `<div class="os_cd op_b"><div role="button" tabindex="0" class="os_rw na_op2_sec" data-k="${k}" aria-expanded="${open.has(k)}">${li(open.has(k) ? 'chevron-down' : 'chevron-right', 15)}${head}</div>${open.has(k) ? body : ''}</div>`;
    const flat = q ? P.messages.map(m => `<div class="os_cd op_b"><div class="os_rw op_h">${chip(m.role, m.role === 'assistant')}</div><div class="op_x">${hl(m.content)}</div></div>`).join('') : '';
    const list = q ? flat : secs.map(s => blk(s.k, `${chip(s.label, /last.?message/i.test(s.label) || s.role === 'assistant')}<span class="os_v cg_num">~${tok(s.content)} 토큰</span>`, `<div class="op_x">${esc(s.content)}</div>`)).join('')
        + (hist.length ? blk('h', `${chip('채팅 기록')}<span class="os_l op_n">${P.exact ? `제공자 블록 ${hist.length}개` : `메시지 ${hist.length}개`}</span><span class="os_v cg_num">~${tok(hist.map(m => m.content).join('\n\n'))} 토큰</span>`,
            hist.map((m, i) => `<div role="button" tabindex="0" class="os_rw op_m na_op2_sec" data-k="h${i}" aria-expanded="${open.has(`h${i}`)}">${li(open.has(`h${i}`) ? 'chevron-down' : 'chevron-right', 14)}${chip(m.role, m.role === 'assistant')}${open.has(`h${i}`) ? '<i class="os_sp"></i>' : `<span class="os_l op_n">${esc(String(m.content).split('\n')[0].slice(0, 80))}</span>`}<span class="os_v cg_num">~${tok(m.content)}</span></div>${open.has(`h${i}`) ? `<div class="op_x">${esc(m.content)}</div>` : ''}`).join('')) : '');
    const G = P.gen;
    return `<div class="ob_shade na_op2_x"></div><div class="ob_sheet os_sh op"><i class="ob_grab"></i><div class="os_hd"><b>조립된 프롬프트</b><button type="button" class="os_ib na_op2_copy" aria-label="조립된 프롬프트 복사">${li('copy', 16)}</button><button type="button" class="os_ib na_op2_x" aria-label="조립된 프롬프트 닫기">${li('x', 19)}</button></div>
      <div class="op_top"><div class="ot_r"><span class="ot_chip${P.exact ? ' strong' : ''}">${badge}</span><span class="ot_cnt">섹션 ${secs.length + (hist.length ? 1 : 0)}개 · ~${total.toLocaleString()} 토큰</span></div>
        <div class="ot_r"><div class="os_q ot_q0" style="flex:1">${li('search', 16)}<div class="os_qi na_op2_q" contenteditable="true" role="textbox" enterkeyhint="search" spellcheck="false" data-ph="찾기" aria-label="프롬프트에서 찾기">${esc(P.q)}</div></div><span class="ot_cnt op_c" role="status">${q ? (n ? `${Math.min(P.at, n - 1) + 1} / ${n}` : '일치 항목 없음') : ''}</span><button type="button" class="os_ib na_op2_nav" data-by="-1" aria-label="이전 일치"${q && n ? '' : ' disabled'}>${li('arrow-up', 15)}</button><button type="button" class="os_ib na_op2_nav" data-by="1" aria-label="다음 일치"${q && n ? '' : ' disabled'}>${li('arrow-down', 15)}</button></div>${q ? '<div class="os_hp">찾기를 지우면 섹션으로 돌아갑니다.</div>' : ''}</div>
      <div class="os_bd" data-n="${n}">${G ? `<div class="ot_box op_g">${G.model ? `<b>${G.provider ? `<i>${esc(G.provider)} / </i>` : ''}${esc(G.model)}</b>` : ''}<span>~${total.toLocaleString()} 추정 토큰</span>${G.pills?.length ? `<div class="ot_r ot_w">${G.pills.map(([l, v]) => `<span class="ot_chip">${esc(l)} ${esc(String(v))}</span>`).join('')}</div>` : ''}</div>` : ''}${P.note ? `<div class="ot_box"><span><b>참고: </b>${esc(P.note)}</span></div>` : ''}${list || '<div class="os_no"></div>'}</div></div>`;
}
