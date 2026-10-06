// Light/dark theme detection and the outline SVG icon helpers.

// Section browser shared by the panel tab and the large popup.
// Returns { render } — call render() after the archive changes.
// the theme's text is light → a dark theme (the timeline keeps the mockup's cream colors only on light themes)
export function darkUI() {
    const m = getComputedStyle(document.body).color.match(/\d+(\.\d+)?/g);
    if (!m) return false;
    const [r, g, b] = m.map(Number);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

// body.na_darkui on dark themes: light themes get the mockup's own colors (style.css), dark themes the theme's
export let themeTimer = null;
export function watchTheme() {
    const sync = () => document.body.classList.toggle('na_darkui', darkUI());
    sync();
    const mo = new MutationObserver(() => { clearTimeout(themeTimer); themeTimer = setTimeout(sync, 300); });
    for (const el of [document.documentElement, document.body]) mo.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
    // theme presets also swap a <style> in <head>
    mo.observe(document.head, { childList: true, subtree: true, characterData: true });
}

// outline icons drawn like the mockups (group A screens): a path string, or raw <path>/<circle> markup
export const svgA = (d, size = 16, sw = 2) => `<svg class="na_svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d.startsWith('<') ? d : `<path d="${d}"/>`}</svg>`;
export const ICO_A = {
    right: 'M9 6l6 6-6 6', down: 'M6 9l6 6 6-6', left: 'M15 6l-6 6 6 6', check: 'M20 6L9 17l-5-5',
    up: 'M12 19V5M5 12l7-7 7 7', dn: 'M12 5v14M19 12l-7 7-7-7', plus: 'M12 5v14M5 12h14',
    key: 'M15 7a4 4 0 1 1-3.9 5H3v4M7 12v3', layers: 'M12 2l9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5',
    pen: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    pin: 'M12 17v5M5 17h14l-2-4V4H7v9z', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
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
