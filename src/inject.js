// What gets injected: building the prompt block (muted, faded, world, extra blocks) and keeping it current.

import { PROMPT_KEY, ctx, getMeta, hasChat } from './core.js';
import { applyDigests } from './digest.js';
import { applyFade } from './fade.js';
import { currentCast, inCast, knowledgeRows } from './knowledge.js';
import { sectionPanel } from './panel.js';
import { isExcluded } from './quotes.js';
import { cachedTokens, filterMuted, splitTail, tailBlocks, trimEnd } from './sections.js';
import { worldText } from './world.js';

// What actually gets injected: digests in place of their sections, muted sections removed, older sections shortened by the forgetting curve,
// the shared world first. The token cap only warns.
export const STATE_KEY = 'narrative_archive_state';
export const stateCfg = m => { const r = m?.stateRemind && typeof m.stateRemind === 'object' ? m.stateRemind : {}; return { on: !!r.on, depth: Number.isFinite(+r.depth) && r.depth !== undefined && r.depth !== '' ? Math.min(20, Math.max(0, +r.depth)) : 3 }; };

// STATE 가까이 넣기: the STATE block leaves the archive block and goes in on its own, close to the newest messages
export function takeState(m, text) {
    if (!stateCfg(m).on) return { text, state: '' };
    const [body, tail] = splitTail(text);
    const blocks = tailBlocks(tail);
    const st = blocks.find(b => b.key === 'STATE');
    if (!st) return { text, state: '' };
    const rest = blocks.filter(b => b !== st).map(b => b.text).join('\n\n');
    return { text: `${trimEnd(body)}${rest ? `\n\n${rest}` : ''}\n`, state: st.text };
}
export const stateText = state => (state ? `[CURRENT STATE: where things stand right now. Keep the next reply consistent with it, and never mention it.]\n${state.replace(/^# /, '')}` : '');

export async function buildInjection(m) {
    // digests stand in for their sections first, then muted sections drop out, then the forgetting curve
    const faded0 = applyFade(m, filterMuted(m, applyDigests(m, m.text)));
    const { faded } = faded0;
    const { text, state } = takeState(m, faded0.text);
    const cap = Math.max(0, Number(m.tokenCap) || 0);
    const trimmed = [];
    const extra = text.trim() ? extraBlocks(m) : '';
    const world = worldText(m);
    const core = text.trim() ? `${trimEnd(text)}${extra}` : '';
    const final = world || core ? [world, core].filter(Boolean).join('\n\n') : '';
    const st = stateText(state);
    const tokens = await cachedTokens([final, st].filter(Boolean).join('\n\n'));
    return { text: final, tokens, trimmed, cap, over: !!cap && tokens > cap, faded, state: st };
}

export let lastBuild = { text: '', tokens: 0, trimmed: [], cap: 0, over: false, faded: new Map(), state: '' };
export let injectSeq = 0;
export let injectReady = Promise.resolve(lastBuild);

export function applyInjection() {
    const c = ctx();
    const m = hasChat() ? getMeta() : null;
    const seq = ++injectSeq;
    injectReady = (async () => {
        const b = m ? await buildInjection(m) : { text: '', tokens: 0, trimmed: [], cap: 0, over: false, faded: new Map(), state: '' };
        if (seq !== injectSeq) return lastBuild;
        const fadeSig = f => [...(f || [])].map(e => e.join('=')).join('\n');
        const trimChanged = b.trimmed.join('\n') !== lastBuild.trimmed.join('\n') || fadeSig(b.faded) !== fadeSig(lastBuild.faded);
        lastBuild = b;
        if (trimChanged) sectionPanel?.render();
        if (!m || !m.enabled || !b.text) c.setExtensionPrompt(PROMPT_KEY, '', 1, 1);
        else {
            const pos = [0, 1, 2].includes(Number(m.position)) ? Number(m.position) : 1;
            c.setExtensionPrompt(PROMPT_KEY, b.text, pos, Math.max(0, Number(m.depth) || 0), false, Number(m.role) || 0);
        }
        if (!m || !m.enabled || !b.state) c.setExtensionPrompt(STATE_KEY, '', 1, 0);
        else c.setExtensionPrompt(STATE_KEY, b.state, 1, stateCfg(m).depth, false, 0);
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
