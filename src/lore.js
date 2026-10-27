// 로어북 같이 보기: entries from the lorebooks this chat uses, sent along with compression, drift checks, questions and
// voice notes so names, places and rules stay as the lorebook has them. An entry goes along when one of its keys is in the
// text the job reads (the same rule SillyTavern uses); always-on entries come after, while the budget lasts.

import { ctx, globalSettings, saveGlobal } from './core.js';
import { estTok } from './recall.js';

export const loreCfg = () => { const g = globalSettings(); const l = g.lore && typeof g.lore === 'object' ? g.lore : {}; return { on: !!l.on, budget: Number.isFinite(+l.budget) && l.budget ? Math.min(6000, Math.max(300, +l.budget)) : 1500 }; };
export const setLore = patch => { const g = globalSettings(); g.lore = { ...loreCfg(), ...patch }; saveGlobal(); };

// the books this chat uses: the global picks, the character's own and extra books, the chat's book
export async function activeBooks() {
    const c = ctx();
    const names = new Set();
    try {
        const wi = await import('/scripts/world-info.js');
        for (const n of wi.selected_world_info || []) names.add(n);
        const ch = c.characters?.[c.characterId];
        if (ch?.data?.extensions?.world) names.add(ch.data.extensions.world);
        const file = String(ch?.avatar || '').replace(/\.[^.]+$/, '');
        for (const n of (wi.world_info?.charLore || []).find(e => e.name === file)?.extraBooks || []) names.add(n);
    } catch (e) { console.warn('[narrative-archive] lorebooks', e); }
    if (c.chatMetadata?.world_info) names.add(c.chatMetadata.world_info);
    return [...names].filter(Boolean);
}

const keyHits = (key, low, raw) => {
    const k = String(key || '').trim();
    if (!k) return false;
    const rx = k.match(/^\/(.+)\/([a-z]*)$/s);
    if (rx) { try { return new RegExp(rx[1], rx[2]).test(raw); } catch { return false; } }
    return low.includes(k.toLowerCase());
};

// entries for a text: [{ book, title, text }]
export async function loreEntries(text) {
    const c = ctx();
    const raw = String(text || ''), low = raw.toLowerCase();
    const hit = [], always = [];
    for (const name of await activeBooks()) {
        let data = null;
        try { data = await c.loadWorldInfo(name); } catch { /* a book that is gone */ }
        for (const e of Object.values(data?.entries || {})) {
            const body = String(e?.content || '').trim();
            if (!body || e.disable) continue;
            const item = { book: name, title: String(e.comment || (e.key || [])[0] || '').trim(), text: body };
            if ((e.key || []).some(k => keyHits(k, low, raw))) hit.push(item);
            else if (e.constant) always.push(item);
        }
    }
    return [...hit, ...always];
}

// the block a prompt gets, or '' (off, no books, nothing fits)
export async function loreBlock(text, { budget = loreCfg().budget } = {}) {
    if (!loreCfg().on) return '';
    const list = await loreEntries(text);
    const out = [], seen = new Set();
    let tok = 0;
    for (const e of list) {
        if (seen.has(e.text)) continue;
        const t = estTok(e.text) + 10;
        if (tok + t > budget) continue;
        seen.add(e.text);
        tok += t;
        out.push(`- ${e.title ? `${e.title}: ` : ''}${e.text.replace(/\s*\n\s*/g, ' ')}`);
    }
    return out.length ? `\n\n[LOREBOOK: setting reference from the user's lorebooks. Use it for names, places, titles and rules. It is background, not something that happened in this stretch.]\n${out.join('\n')}` : '';
}
