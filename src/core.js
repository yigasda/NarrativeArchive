// Constants, the per-chat archive record (chatMetadata) and global settings, and commitText: every change to the archive text goes through it.

import { syncTrackedBoundary } from './hide.js';
import { applyInjection } from './inject.js';
import { syncPanel } from './panel.js';
import { BASIC_PROMPT, OLD_BASIC, OLD_BASIC_HASHES, OLD_DEFAULTS, PREV_BASIC } from './prompts.js';
import { parseSections } from './sections.js';

// 서사 아카이브 (Narrative Archive)
// You write the archive. This extension stores it per chat, injects it,
// hides already-compressed messages, extracts raw ranges, and shows token counts.

export const MODULE = 'narrative_archive';
export const PROMPT_KEY = 'narrative_archive_injection';
export const VERSION = '3.47.0';
export const SNAPSHOT_MAX = 5;
export const SNAPSHOT_MAX_CHARS = 2_000_000;

export const DEFAULT_META = Object.freeze({
    text: '',
    boundary: -1,   // last message index covered by the archive
    keep: 1,        // how many compressed messages stay visible
    enabled: true,
    position: 1,    // extension_prompt_types: 0 after main prompt, 1 in chat, 2 before main prompt
    depth: 1,
    role: 0,        // 0 system, 1 user, 2 assistant
    track: false,   // boundary follows the last #number in the archive's headings
    snapshots: [],  // [{ at, reason, text, boundary }] newest first
    muted: [],      // section titles left out of the injection
    lastInject: null,
    tokenCap: 0,    // 0 = no cap
    pinned: [],     // section/group titles never dropped by the cap
    linked: {},     // { title: [keywords] } — injected only when a keyword is in recent messages
    linkDepth: 4,   // how many recent messages to scan for those keywords
    history: [],    // [{ at, reason, added, removed, changed, delta, snapAt }] newest first
    backup: null,   // { at, how } — last .txt/.json export
    sinceBackup: 0, // changes since that export
    backupEvery: 10, // remind after this many changes (0 = off)
    lastExport: null, // { from, to, at, how } — the latest extract copied or saved
});

export const SETTING_KEYS = ['keep', 'enabled', 'position', 'depth', 'role', 'muted', 'track', 'tokenCap', 'pinned', 'backupEvery', 'linked', 'linkDepth', 'glossary', 'logLinks', 'knowledge', 'knowInject', 'quotes', 'router', 'people', 'temps', 'voice', 'voiceInject', 'layers', 'fade', 'worldOn', 'quoteExclude', 'quoteMined', 'knowMined', 'personLines', 'fadeForce', 'au', 'digests'];
export const POSITIONS = { 1: '채팅 안 (깊이)', 0: '메인 프롬프트 뒤', 2: '메인 프롬프트 앞' };
export const ROLES = { 0: '시스템', 1: '유저', 2: '어시스턴트' };

export const ctx = () => SillyTavern.getContext();

// Switches: the real checkbox is hidden and a <span> next to it draws the switch, so no theme's
// input[type=checkbox] rules (boxes, ticks, forced sizes) can reach the look.
export function skinToggles(root = document) {
    const list = root.matches?.('input.na_toggle') ? [root] : root.querySelectorAll?.('input.na_toggle:not(.na_tgl)') || [];
    for (const el of list) {
        if (el.classList.contains('na_tgl')) continue;
        el.classList.add('na_tgl');
        const ui = document.createElement('span');
        ui.className = 'na_tgl_ui';
        ui.setAttribute('aria-hidden', 'true');
        el.after(ui);
        // outside a <label> the span would not toggle the box by itself
        if (!el.closest('label')) ui.addEventListener('click', () => el.click());
    }
}
new MutationObserver(muts => { for (const mu of muts) for (const n of mu.addedNodes) if (n.nodeType === 1) skinToggles(n); })
    .observe(document.documentElement, { childList: true, subtree: true });

export function hasChat() {
    const c = ctx();
    return !!(c.chatId || c.getCurrentChatId?.());
}

export function getMeta() {
    const md = ctx().chatMetadata;
    if (!md) return null;
    if (!md[MODULE] || typeof md[MODULE] !== 'object') md[MODULE] = structuredClone(DEFAULT_META);
    for (const k of Object.keys(DEFAULT_META)) {
        if (!Object.hasOwn(md[MODULE], k)) md[MODULE][k] = structuredClone(DEFAULT_META[k]);
    }
    if (!Array.isArray(md[MODULE].snapshots)) md[MODULE].snapshots = [];
    if (!Array.isArray(md[MODULE].muted)) md[MODULE].muted = [];
    if (!Array.isArray(md[MODULE].pinned)) md[MODULE].pinned = [];
    if (!Array.isArray(md[MODULE].history)) md[MODULE].history = [];
    delete md[MODULE].once; // removed in 1.4.0
    delete md[MODULE].aiDraft; // AI compress removed in 2.4.0
    return md[MODULE];
}

export async function saveMeta() {
    await ctx().saveMetadata();
}

export const HISTORY_MAX = 30;

// Which "##" sections were added, removed or edited between two archive texts.
export function sectionChanges(a, b) {
    const map = t => {
        const o = new Map();
        for (const s of parseSections(t)) if (!s.group) o.set(s.title, t.slice(s.start, s.end).trim());
        return o;
    };
    const A = map(a), B = map(b);
    let added = [...B.keys()].filter(k => !A.has(k));
    let removed = [...A.keys()].filter(k => !B.has(k));
    // same "#from–#to" on both sides = the title was edited, not a new section
    const rangeOf = t => (t.match(/#\d+\s*[–—~-]\s*#?\d+/) || [])[0];
    const renamed = [];
    for (const r of [...removed]) {
        const key = rangeOf(r);
        const hit = key && added.find(x => rangeOf(x) === key);
        if (hit) { renamed.push(`${r} → ${hit}`); removed = removed.filter(x => x !== r); added = added.filter(x => x !== hit); }
    }
    return { added, removed, renamed, changed: [...B.keys()].filter(k => A.has(k) && A.get(k) !== B.get(k)) };
}

export function pushSnapshot(m, reason) {
    if (!m.text.trim()) return false;
    const top = m.snapshots[0];
    if (top && top.text === m.text && top.boundary === m.boundary) return false;
    m.snapshots.unshift({ at: Date.now(), reason, text: m.text, boundary: m.boundary });
    m.snapshots.length = Math.min(m.snapshots.length, SNAPSHOT_MAX);
    let total = 0;
    m.snapshots = m.snapshots.filter((s, i) => (total += s.text.length) <= SNAPSHOT_MAX_CHARS || i === 0);
    return true;
}

// Every change to the archive text goes through here: snapshot, save, re-inject, refresh UI.
export async function commitText(text, reason, { boundary } = {}) {
    const m = getMeta();
    const next = String(text).replace(/\r\n/g, '\n');
    if (next === m.text && (boundary === undefined || boundary === m.boundary)) return false;
    const snapped = pushSnapshot(m, reason);
    if (next !== m.text) {
        const ch = sectionChanges(m.text, next);
        m.history.unshift({ at: Date.now(), reason: reason.replace(/ 전(?=$|:)/, ''), ...ch, delta: next.length - m.text.length, snapAt: snapped ? m.snapshots[0].at : null });
        m.history.length = Math.min(m.history.length, HISTORY_MAX);
        m.sinceBackup = (Number(m.sinceBackup) || 0) + 1;
        if (m.backupEvery > 0 && m.sinceBackup === m.backupEvery) toastr.info(`백업 뒤로 ${m.sinceBackup}번 바뀌었어요. 도구 탭에서 .json 백업을 받아 두세요.`, '서사 아카이브');
    }
    m.text = next;
    if (boundary !== undefined) m.boundary = boundary;
    else syncTrackedBoundary(m);
    await saveMeta();
    applyInjection();
    syncPanel();
    return true;
}

// Defaults shipped by earlier versions, recognised by hash so their text isn't carried here.
export const textHash = t => { let x = 5381; for (let i = 0; i < t.length; i++) x = ((x * 33) ^ t.charCodeAt(i)) >>> 0; return x.toString(36); };

export const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function globalSettings() {
    const es = ctx().extensionSettings;
    if (!es[MODULE] || typeof es[MODULE] !== 'object') es[MODULE] = {};
    const g = es[MODULE];
    const defaults = { usePrompt: false, skipHidden: true, stripTags: false, aiProfile: '', aiMaxTokens: 8192 };
    for (const [k, v] of Object.entries(defaults)) if (!Object.hasOwn(g, k)) g[k] = v;
    // prompt library: [{ id, name, text, fav }], first entry is the built-in basic one
    if (g.aiMaxTokens === 4096 && !g.aiMaxSet) g.aiMaxTokens = 8192; // the old default, never changed by hand
    if (!Array.isArray(g.prompts)) {
        g.prompts = [{ id: 'basic', name: '기본', text: BASIC_PROMPT, fav: true }];
        const old = typeof g.prompt === 'string' ? g.prompt : '';
        if (old.trim() && old !== OLD_BASIC && old !== BASIC_PROMPT && !OLD_DEFAULTS.has(textHash(old))) {
            g.prompts.push({ id: newId(), name: '내 지시문', text: old, fav: true });
        }
        g.activePrompt = g.prompts[g.prompts.length - 1].id;
        delete g.prompt;
    }
    if (!g.prompts.some(p => p.id === 'basic')) g.prompts.unshift({ id: 'basic', name: '기본', text: BASIC_PROMPT, fav: true });
    const basic = g.prompts.find(p => p.id === 'basic');
    if (basic.text === PREV_BASIC || basic.text === OLD_BASIC || OLD_BASIC_HASHES.has(textHash(basic.text))) basic.text = BASIC_PROMPT;
    if (!g.prompts.some(p => p.id === g.activePrompt)) g.activePrompt = g.prompts[0].id;
    return g;
}
export const saveGlobal = () => ctx().saveSettingsDebounced?.();
