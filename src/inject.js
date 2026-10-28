// What gets injected: building the prompt block (muted, faded, world, extra blocks) and keeping it current.

import { PROMPT_KEY, ctx, getMeta, globalSettings, hasChat } from './core.js';
import { applyDigests } from './digest.js';
import { embedSoon } from './embed.js';
import { applyFade } from './fade.js';
import { currentCast, inCast, knowledgeRows } from './knowledge.js';
import { sectionPanel } from './panel.js';
import { isExcluded } from './quotes.js';
import { cachedTokens, filterMuted, parseSections, resting, sectionKey, trimEnd } from './sections.js';
import { worldText } from './world.js';

// What actually gets injected: digests in place of their sections, muted sections removed, older sections shortened by the forgetting curve,
// the shared world first. The token cap only warns.
export const STATE_KEY = 'narrative_archive_state';
// 캐시 아끼기 (on unless turned off): the archive block holds only what stays put between replies, so the prompt up to it
// and the chat after it can be served from the provider's prompt cache. What this reply alone needs (sections a keyword or
// the router called in, notes on who is in the scene) goes in this second block, just above the last two messages.
export const NOW_KEY = 'narrative_archive_now';
export const NOW_DEPTH = 2;
export const cacheSave = () => globalSettings().cacheSave !== false;
// STATE 가까이 넣기 was taken out in 3.88.0: the archive now sits right after the hidden messages, so its STATE is
// already read where it belongs. The key is still cleared, so a chat that had it on keeps no stale block

// 이어지는 자리: just above the first visible message after the archive's last one, so the past is read before what followed it.
// The spot only moves when messages are hidden, so the prompt before it stays the same from reply to reply.
// skipLast: a swipe leaves the reply being replaced out of the prompt; extra: a typed message not in the chat yet
export function autoDepth(m, { skipLast = false, extra = 0 } = {}) {
    const chat = ctx().chat || [];
    const end = skipLast ? chat.length - 1 : chat.length;
    const from = Number.isFinite(+m?.boundary) ? Math.max(0, +m.boundary + 1) : 0;
    let n = extra;
    for (let i = from; i < end; i++) if (!chat[i]?.is_system) n++;
    return n;
}
const placeOf = m => (Number(m.position) === 3 ? [1, autoDepth(m)] : [[0, 1, 2].includes(Number(m.position)) ? Number(m.position) : 1, Math.max(0, Number(m.depth) || 0)]);

// right before a reply is written, so the worked-out depth counts the chat as the prompt will have it
export function placeArchive(o) {
    const m = hasChat() ? getMeta() : null;
    if (!m || !m.enabled || !lastBuild.text || Number(m.position) !== 3) return;
    ctx().setExtensionPrompt(PROMPT_KEY, lastBuild.text, 1, autoDepth(m, o), false, Number(m.role) || 0);
}

export async function buildInjection(m) {
    // digests stand in for their sections first, then muted sections drop out, then the forgetting curve
    const build = () => applyFade(m, filterMuted(m, applyDigests(m, m.text)));
    const faded0 = build();
    const { faded } = faded0;
    const split = cacheSave();
    // with 캐시 아끼기 the block is the archive at rest; the sections called in now go whole into the second block
    const text = split ? resting(build).text : faded0.text;
    const cap = Math.max(0, Number(m.tokenCap) || 0);
    const trimmed = [];
    const extra = text.trim() ? extraBlocks(m) : '';
    const world = worldText(m);
    const core = text.trim() ? `${trimEnd(text)}${split ? '' : extra}` : '';
    const final = world || core ? [world, core].filter(Boolean).join('\n\n') : '';
    const now = split && text.trim() ? nowBlock(m, faded0.text, final, extra) : '';
    const tokens = await cachedTokens(final) + (now ? await cachedTokens(now) : 0);
    return { text: final, now, tokens, trimmed, cap, over: !!cap && tokens > cap, faded };
}

// the second block: sections in the full build that the resting one lacks or holds only in part, then the scene notes
function nowBlock(m, full, rest, extra) {
    const secs = parseSections(full).filter(s => !s.group).map(s => full.slice(s.start, s.end).trim()).filter(t => t && !rest.includes(t));
    let out = secs.length ? `# CALLED BACK FOR THIS SCENE\n_Earlier parts of the story that the scene now touches, in full. They happened in the past, in the order shown; the archive above stays the record._\n\n${secs.join('\n\n')}` : '';
    if (extra.trim()) out += `${out ? '\n' : ''}${extra}`;
    return out.trim();
}

export let lastBuild = { text: '', now: '', tokens: 0, trimmed: [], cap: 0, over: false, faded: new Map() };
export let injectSeq = 0;
export let injectReady = Promise.resolve(lastBuild);

export function applyInjection() {
    embedSoon();
    const c = ctx();
    const m = hasChat() ? getMeta() : null;
    const seq = ++injectSeq;
    injectReady = (async () => {
        const b = m ? await buildInjection(m) : { text: '', now: '', tokens: 0, trimmed: [], cap: 0, over: false, faded: new Map() };
        if (seq !== injectSeq) return lastBuild;
        const fadeSig = f => [...(f || [])].map(e => e.join('=')).join('\n');
        const trimChanged = b.trimmed.join('\n') !== lastBuild.trimmed.join('\n') || fadeSig(b.faded) !== fadeSig(lastBuild.faded);
        lastBuild = b;
        if (trimChanged) sectionPanel?.render();
        if (!m || !m.enabled || !b.text) c.setExtensionPrompt(PROMPT_KEY, '', 1, 1);
        else {
            const [pos, depth] = placeOf(m);
            c.setExtensionPrompt(PROMPT_KEY, b.text, pos, depth, false, Number(m.role) || 0);
        }
        c.setExtensionPrompt(STATE_KEY, '', 1, 0);
        c.setExtensionPrompt(NOW_KEY, m && m.enabled && b.text && b.now ? b.now : '', 1, NOW_DEPTH, false, Number(m?.role) || 0);
        return b;
    })();
    return injectReady;
}

// latest build, waiting for one in flight
export const currentInjection = async () => { let p; do { p = injectReady; await p; } while (p !== injectReady); return lastBuild; };

export function extraBlocks(m) {
    let out = '';
    const castNow = currentCast(m);
    const kr = (m.knowInject ? knowledgeRows(m) : []).map(r => ({ ...r, unaware: r.unaware.filter(n => inCast(castNow, n)), suspects: r.suspects.filter(n => inCast(castNow, n)) }));
    if (kr.length) out += `\n\n# WHO KNOWS WHAT\n_Characters act only on what they know. Do not let anyone reveal or use a fact they do not know._\n${kr.map(r =>
        `- ${r.fact} — knows: ${r.knows.join(', ') || 'no one'}${r.unaware.length ? `; does not know: ${r.unaware.join(', ')}` : ''}${r.suspects.length ? `; suspects: ${r.suspects.join(', ')}` : ''}`).join('\n')}`;
    const vs = m.voiceInject && m.voice ? Object.entries(m.voice).filter(([who, v]) => String(v?.text || '').trim() && inCast(castNow, who) && !isExcluded(m, who)) : [];
    // characters in the scene now: a constant core, how they talk, and real lines to match (made from the card and the chat)
    if (vs.length) out += `\n\n# CHARACTER NOTES\n_Notes for writing these characters. Follow them silently: never mention, quote or refer to these notes in the story. Who they are does not drift: it changes only where the archive records the change._\n${vs.map(([who, v]) => {
        const speech = String(v.text).trim().replace(/^-\s*\[[^\]\n]{1,10}\]\s*/gm, '- ');
        const core = String(v.core || '').trim(), samples = Array.isArray(v.samples) ? v.samples : [];
        if (!core && !samples.length) return `## ${who}\n${speech}`;
        return `## ${who}${core ? `\nWho they are:\n${core}` : ''}\nHow they talk:\n${speech}${samples.length ? `\nLines of theirs, for the sound only. Write new lines like these, never reuse them:\n${samples.map(q => `- "${q}"`).join('\n')}` : ''}`;
    }).join('\n')}`;
    return out;
}
