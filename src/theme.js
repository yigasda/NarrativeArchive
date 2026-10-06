// The extension's light/dark look and the outline SVG icon helpers.
import { globalSettings, saveGlobal } from './core.js';

// SillyTavern's own theme: its text is light → a dark theme. Only used once, to pick the starting look.
export function stIsDark() {
    const m = getComputedStyle(document.body).color.match(/\d+(\.\d+)?/g);
    if (!m) return false;
    const [r, g, b] = m.map(Number);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

// the extension's own look, chosen in 설정 › 테마 ('light' | 'dark'), not tied to SillyTavern's theme
export function uiTheme() {
    const g = globalSettings();
    if (g.uiTheme !== 'light' && g.uiTheme !== 'dark') { g.uiTheme = stIsDark() ? 'dark' : 'light'; saveGlobal(); }
    return g.uiTheme;
}
export const darkUI = () => uiTheme() === 'dark';

// body.na_darkui → the warm dark palette (style.css), otherwise the cream mockup palette
export function applyTheme() {
    const dark = darkUI();
    document.body.classList.toggle('na_darkui', dark);
    document.querySelectorAll('.na_browser').forEach(el => el.classList.toggle('na_darkui', dark));
    document.querySelectorAll('input[name="na_ui_theme"]').forEach(el => { el.checked = el.value === uiTheme(); });
}
export function setUiTheme(mode) {
    globalSettings().uiTheme = mode === 'dark' ? 'dark' : 'light';
    saveGlobal();
    applyTheme();
}

// outline icons drawn like the mockups (group A screens): a path string, or raw <path>/<circle> markup
export const svgA = (d, size = 16, sw = 2) => `<svg class="na_svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d.startsWith('<') ? d : `<path d="${d}"/>`}</svg>`;
export const ICO_A = {
    right: 'M9 6l6 6-6 6', down: 'M6 9l6 6 6-6', left: 'M15 6l-6 6 6 6', check: 'M20 6L9 17l-5-5',
    up: 'M12 19V5M5 12l7-7 7 7', dn: 'M12 5v14M19 12l-7 7-7-7', plus: 'M12 5v14M5 12h14',
    key: 'M15 7a4 4 0 1 1-3.9 5H3v4M7 12v3', layers: 'M12 2l9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5',
    pen: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    pin: 'M12 17v5M5 17h14l-2-4V4H7v9z', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    home: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>',
    compress: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    book: '<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>',
    chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z',
    wand: 'M15 4V2M15 10V8M11 6h2M17 6h2M4 20L14 10M19 13v2M18 14h2',
    route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h8"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    quote: 'M7 7h4v4c0 3-1.5 5-4 6M15 7h4v4c0 3-1.5 5-4 6',
    compass: '<circle cx="12" cy="12" r="10"/><path d="M16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1L20 20M8.1 15.9L20 4"/>',
    fileplus: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    steth: '<path d="M5 3v6a5 5 0 0 0 10 0V3"/><path d="M10 14v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3.1 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 20.9 10H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.1 6.1C3.6 7.8 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.5-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    redo: '<path d="M21 4v6h-6"/><path d="M20.5 10A8.5 8.5 0 1 0 19 16.5"/>',
    tl: '<path d="M6 3v18"/><circle cx="6" cy="7" r="2"/><circle cx="6" cy="17" r="2"/><path d="M11 7h9M11 17h9"/>',
};

// thin outline icon (mockup style) for the append / health / drift / quote screens
export function svgB(inner, size = 16, sw = 2, cls = '') {
    return `<svg${cls ? ` class="${cls}"` : ''} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
export const SVG_B = {
    check: '<path d="M20 6L9 17l-5-5"/>',
    star: '<path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6l-5 3.6 1.9-5.8L4 8.8h6.1z"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    mag: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    userx: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 8l5 5M22 8l-5 5"/>',
    redo: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
};
