// 지난 장면 짐작하기: when the chat points back without naming it ("that night", "what you promised"), a small model
// pictures that earlier moment in the words the archive would use. The router and 회상 search with those words too,
// so a section is found even when neither its title nor the chat says "festival" but its body does.

import { askAI } from './ai.js';
import { currentChatId } from './chats.js';
import { globalSettings } from './core.js';
import { recentForCheck } from './drift.js';
import { castNames } from './knowledge.js';
import { LANG_NAME, archiveLang } from './prompts.js';
import { RANGE_HEAD, parseSections } from './sections.js';
import { shortHash } from './translate.js';

export const GUESS_MODES = { off: '끄기', router: '라우터만', both: '라우터 · 회상' };
export const guessMode = () => (globalSettings().guess in GUESS_MODES ? globalSettings().guess : 'router');

export const AI_SYS_GUESS = `GOAL
A long role-play is stored as an archive of past scenes. The newest messages may point back at an earlier moment
without naming it: "that night", "the place by the water", "what you promised me", "like last time", a look, a scar.
Picture that earlier moment and describe it so a word search over the archive can find it.

HOW
- Read the LATEST message first, then the others.
- If nothing in them points back at an earlier moment, or everything is already named plainly, answer exactly: NONE
- Otherwise write 1 to 3 short plain sentences about that earlier moment: who was there, where, the objects,
  what happened, the time of day or season. Use the concrete nouns such a scene would be written with
  (lantern, harbor, ring, fever), several of them, including likely synonyms.
- It is a guess. Do not explain it, do not hedge, no preamble, no list.`;

const cache = new Map(); // chat id → { key, text }

// the guess for the current messages ('' when off, nothing points back, or the model failed)
export async function sceneGuess(m, ready) {
    if (guessMode() === 'off' || !ready) return '';
    const msgs = recentForCheck(3);
    if (!msgs.length) return '';
    msgs[msgs.length - 1] = msgs[msgs.length - 1].replace(/^\[#(\d+)/, '[#$1 · LATEST');
    const recent = msgs.join('\n\n').slice(-4000);
    const id = currentChatId();
    const key = shortHash(recent);
    const hit = cache.get(id);
    if (hit?.key === key) return hit.text;
    const ranged = parseSections(m.text).filter(x => !x.group && RANGE_HEAD.test(x.title));
    const now = ranged.length ? ranged[ranged.length - 1].title : '';
    const lang = LANG_NAME[archiveLang(m.text)];
    const main = castNames(m);
    let text = '';
    try {
        const out = await Promise.race([
            askAI(`${main.length ? `[MAIN CAST]\n${main.join(', ')}\n\n` : ''}${now ? `[NEWEST ARCHIVED SCENE]\n${now}\n\n` : ''}[RECENT CHAT]\n${recent}${lang ? `\n\n[Write the answer in ${lang}, the archive's language, even if the chat is in another language.]` : ''}`, { system: AI_SYS_GUESS, maxTokens: 400 }),
            new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 8_000)),
        ]);
        text = String(out || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        if (/^none\b/i.test(text) || text.length < 8) text = '';
        text = text.slice(0, 600);
    } catch (e) {
        console.warn('[narrative-archive] scene guess', e);
        return '';
    }
    cache.set(id, { key, text });
    return text;
}

// what the last guess said, for the recall search and the settings line
export const lastGuess = () => cache.get(currentChatId())?.text || '';
