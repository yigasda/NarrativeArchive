// Small helpers: escaping, number/time formatting, token counting, download, clipboard, confirm.

import { ctx } from './core.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const fmt = n => Number(n || 0).toLocaleString();

export async function countTokens(text) {
    if (!text) return 0;
    try { return await ctx().getTokenCountAsync(text); }
    catch { return Math.round(text.length / 3); }
}

export function download(filename, text, type = 'text/plain') {
    const blob = new Blob([text], { type: `${type};charset=utf-8` });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export async function copyText(text, fallbackEl) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        if (fallbackEl) {
            fallbackEl.focus();
            fallbackEl.select();
            try { if (document.execCommand('copy')) return true; } catch { /* ignore */ }
        }
        return false;
    }
}

export async function confirm(title, text) {
    const c = ctx();
    const r = await c.Popup.show.confirm(title, text);
    return r === c.POPUP_RESULT.AFFIRMATIVE || r === true;
}

export function chatLabel() {
    const c = ctx();
    const id = String(c.getCurrentChatId?.() || c.chatId || 'chat');
    return id.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

export function nowStamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}-${p(d.getMinutes())}`;
}

export function timeLabel(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    const today = new Date().toDateString() === d.toDateString();
    return `${today ? '오늘' : `${d.getMonth() + 1}/${d.getDate()}`} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
