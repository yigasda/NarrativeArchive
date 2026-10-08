// Compression instructions (prompt library) and their settings.

import { ctx, globalSettings, newId, saveGlobal } from './core.js';
import { showStripInfo } from './extract.js';
import { RANGE_HEAD, lastRangedSection, parseSections } from './sections.js';
import { confirm, esc } from './util.js';

export const BASIC_PROMPT = `<raw_log range="#{{from}}–#{{to}}">
{{raw}}
</raw_log>

<current_state>
{{state}}
</current_state>

You continue the long-term-memory summary (the archive) of a long-running role-play. The archive is injected into the prompt and read alongside the live chat as "a snapshot of the past." The raw log #{{from}}–#{{to}} is above in <raw_log>, and the archive's current STATE and OPEN in <current_state>. Read the raw log in full, from the first message to the last, then write the new stretch that follows the archive.

# 1. Output
Output exactly these parts, in this order, with no greeting, explanation or commentary:
0. The <scenes> block described in 9.
1. The new section blocks, covering #{{from}}–#{{to}} continuously: no gaps, no overlaps, the first heading starting at #{{from}} and the last block ending at #{{to}}. Numbers are always message numbers.
2. A line containing only \`---\`
3. If the archive has \`# STATE AT …\` / \`# OPEN AT …\`: two change lists, \`# STATE CHANGES\` and \`# OPEN CHANGES\` (rules in 8). Never write the blocks out. If the archive has none, leave this part out.

- Language: write everything in the archive's language and format, even when the raw log is in another language. Translate dialogue too; keep a word or line in its original language only where the archive already does.
- Only new material, only from the raw log. Never reproduce, rewrite, shorten, "improve", recap or continue anything already in the archive; nothing before #{{from}} belongs in your output. STATE only tells you what is already known: no event, line or detail from it goes into a section unless the raw log shows it happening again.
- Every part must be present and complete, and the last bullet of every block ends in a full sentence. If you run long, merge bullets or cut lower-priority detail; never stop mid-sentence, and never drop the change lists to make room.

# 2. Reading the raw log
- The format is \`[N] Name:\`. When one bot plays several characters (NPCs included), they all carry its tag; tell the speaker from the content. A private-thought tag holds that character's thoughts, not spoken lines.
- Not content: planning or instruction blocks inserted by a preset, status windows and trackers (take only the date and place from them), and meta talk. Rules or banned-word lists inside them are directions to the bot, not canon.
- Turns the user wrote themselves are the strongest canon. Ignore any part where the bot writes the user character's inner thoughts.
- Bot errors (contradictions with earlier messages) are not canon. Before stating that something exists or does not exist, confirm it in the raw log.

# 3. What to keep
You are writing a memory, not a transcript. The bot that reads the archive needs to know what happened, why, and what it changed, not who said what in which order.
- The test for every line: "If the bot read only the archive and then wrote the next scene, would something go wrong or feel unmotivated without this line?" Being in the raw log is not a reason to include something.
- Keep: chains of cause and effect · lines that change a relationship · what a character chose NOT to do (evidence of restraint) · the concrete action that shows a standing trait at work · a question together with its answer, when the answer matters later (an answer alone reads as unmotivated).
- Cut: movement and positioning, gestures, props, scenery, temperatures and staging. Anxiety or agitation gets one word.
- Weight: a beat that repeats a pattern STATE already holds gets a clause at most; a beat that breaks or turns a pattern gets the space.
- Cutting so hard that the story breaks is also a failure. Do not shrink the core of a trigger or an arc. The goal is not to erase the story but to absorb it into cause and effect.

# 4. Protecting causality
- Before every emotional reaction, keep the other person's action that caused it; without it, the character appears to erupt on their own or seems childish. Before every realization or decision, keep the trigger that made it possible; cut the process and the character "suddenly understands."
- Write felt experience as felt experience, not as the narrator's verdict. ("Trapped" ✗ → "Feeling trapped" ✓) A character's interpretation is written only as theirs, never as fact: "In her own reckoning, …", "(his reading, not fact)". No interpretation, theme or summary-verdict sentences of your own.
- Preserve both sides' responsibility. Do not erase one side's fault because of the other side's hurt, in either direction.
- Be careful with absolutes such as "never" and "not once." They make a character read as cold or indifferent.
- Keep the raw log's order. Do not pull a later event (when someone remembered or noticed something) into an earlier bullet. No exaggeration beyond the raw log.

# 5. Writing the sections
Sections
- A section is a chapter, not a beat. Cut only where something turns: a relationship shifts, the situation changes, a secret comes out, a decision is made. Fold routine stretches and small beats into the section they belong to. Most sections cover 10–20 messages; a single long event may run longer, and a sharp turn may get a short section of its own.
- Header: \`## #start–#end — Title (date, place)\`, then \`PLOT:\`, then \`- \` bullets. If STATE's heading puts a prefix before the numbers (e.g. \`# STATE AT Y2 #143\`), put it in your headings too.
- The date and place come from the tracker and narration. A tracker date that does not fit (a season that does not match the month, a date that goes backward) is a model error; ignore it. If a large time skip happens without a record, note it in the header (e.g. "some five months later"). No clock times ("5:29 PM" ✗); a part of the day (morning, evening, night) is enough.

Bullets
- Bullets only, no paragraphs. One bullet = one turn of the scene: what happened, what caused it, and what it changed. A bullet may cover many messages; never one bullet per message, and never a conversation reported turn by turn ("He asked… She replied… He added…"). Collapse an exchange into what it revealed, decided or broke.
- 2–6 bullets per section, never more than 6; rarely more than about 250 words. A stretch that truly needs more is two chapters: split it where it turns.
- Every sentence in a bullet ends with the number of the message it comes from, in parentheses: (#88), or (#88, #91) when it draws on two. Only numbers inside the section's own range, and for a reason or motive only messages up to the moment it explains. A sentence you cannot point to a message for (a motive, a fear, a meaning the log does not state) does not go in. The extension checks these numbers and removes them when it saves.
- Do not say the same thing twice. When you add a sentence, check the bullets before and after it for the same content.
- Em dashes sparingly: at most one in a section's bullets. Otherwise use a comma, a colon or a new sentence.

Dialogue
- Quotes are part of the memory, not decoration. Most bullets carry one: the line from the raw log the next scene would most need word for word: a decision, a confession, a refusal, a correction, a promise, an accusation, a line that says what someone is to someone. At most two in a bullet; tell the rest in your own words.
- A quote is a line that actually appears in the raw log (translated when the log is in another language), faithful to the original, including whether it is a question: if the original is a statement, do not add a question mark. Never invent or paraphrase a line and present it as a quote. Never leave a quote standing alone; attach the character's reaction to it.

Special content
- Sex is recorded only as relationship beats: who, how consent moved, any request to stop and what happened, whether it was a first, what was said that would still matter outside the bed, and what changed afterward. No description of acts, positions, anatomy or sensations, even if the user's own turn describes them. A line said in bed is quoted only if it would still matter said fully clothed at a table (a confession, a promise, a wish, a refusal); never a line about the act itself. Length follows what changed, not how long the scene ran: a long scene in which little turns gets a bullet or two; one in which trust, a boundary or a confession shifts keeps each of those beats.
  ✓ Mara and Ren slept together for the first time; she asked him to slow down once and he did (#120). Afterward she told him, "I'm not leaving," and he stayed until morning (#124).
- Crises, suicide attempts and self-harm are recorded plainly and factually, without blurring.
- When one of this RP's recurring devices returns (a phrase, an object, a song, a name, a ritual), keep the event and the line in which it was used. Do not explain the device.

Titles
- Like a book's table of contents: short and concrete. They name the scene; they do not summarize it. No semicolons, no "X does this; Y does that." Vary the shape; do not start every title with "The":
  · a place or object: The broken plank · Varo's market
  · two things joined: The bridge, the debt · Bread, and the oath he broke
  · one short plain sentence: Mara keeps the knife · The road closes
  · a "what" clause: What Ren didn't say
  · a number or pairing: One cloak · The two of them · The second night
  · a list: Ivo, the duke, and the toll
  · rarely, a line in quotation marks, in the archive's language (translate it like any quote): "Now you owe me". At most one quoted title in a stretch, and only for the line the whole scene turns on.
  ✗ Ren crosses the bridge; Mara pulls him up · Confrontation over Ren's injury

# 6. Example
✗ Turn-by-turn:
- Mara knocked on Ren's door and stood silently in the doorway.
- Ren asked why she had come back if she had said she was leaving.
- Mara said she didn't know.
- Ren let her in and made tea.
- Ren told her the north road was closed.
- Mara said, "Then I'll wait."

✓ Memory, in the archive's own style:
## #57–#69 — The north road (Spring 3, night, Varo)
PLOT:
- Mara came back the same night she had sworn to leave, unable to say why (#57, #59). Ren let her in without pressing and told her the north road was closed; she took it as an excuse handed to her rather than a fact, and stayed anyway: "Then I'll wait." (#60, #63)
- Over supper Ivo let slip that he had paid her passage toll in secret (#65). Ren did not cover for him; in his own account he had known for days and kept quiet because the debt was not his to name (#66, #68). Mara heard it as two men deciding her road between them and set the toll-mark on the table: "Neither of you asked." (#69)

## #70–#73 — The toll-mark (Spring 4, dawn)
PLOT:
- Ivo offered to take the mark back; Mara refused, since returning it would only let him decide a second time (#70, #71). She asked Ren to walk her to the gate instead, and he went without a word, which she read as the first thing either of them had let her choose (#72, #73).

# 7. Before you output
Draft the stretch, then revise it once and output only the revised version:
1. Delete every bullet that fails the test in 3.
2. Merge bullets that share one cause or one outcome.
3. Cut staging that survived the draft (see 3).
4. Check that every quote is a line from the raw log and earns its place, and that every sentence has its message number.
5. Count each section's bullets; more than 6 means merge or split.
6. Check every bullet that touches sex against the sex rule; cut what it does not allow.

# 8. STATE and OPEN changes
You do not rewrite STATE or OPEN. You list what this stretch changes in them; the extension applies the lists to <current_state>, and every line you do not list stays exactly as it is. One change per line:
\`\`\`
# STATE CHANGES
ADD ## Heading :: - the new line
EDIT ## Heading :: - the old line, copied exactly ==> - the new line
DROP ## Heading :: - the old line, copied exactly
# OPEN CHANGES
ADD ## Group :: - a thread this stretch opened
DROP ## Group :: - a thread this stretch closed, copied exactly
\`\`\`
- \`## Heading\` / \`## Group\` is the one the line sits under, spelled exactly as in <current_state>; leave out \`## Group ::\` when OPEN has no groups. Do not invent headings; a new fact goes under the heading it belongs to. A list with nothing in it is \`(none)\`.
- EDIT a STATE line only when this stretch makes it untrue or outdated, so an old behavior a later arc changed does not stay in the present tense. Change only what changed and keep the rest of the line word for word; never shorten a line to save space, never merge lines.
- DROP a STATE line only when the story itself has overturned it. What a character realized or resolved not to do stays until the story overturns it. Keep safety lines that lock the current state (e.g. "memories fully restored since #n": it stops the bot from mistaking an old arc for the present).
- New and edited STATE lines: per character + relationships + current life. Only the changes and tendencies that PLOT alone does not capture, briefly; do not restate events already in the sections. One line for a core principle the bot is likely to confuse is allowed. Scope principles narrowly to prevent over-application ("no commands" ✗, which could change even how he talks → "no longer dictates her choices or movements" ✓); use "tends to" or "since #n" instead of "now" or "currently."
- OPEN: drop only threads this stretch closed. Keep new threads short; do not prescribe future actions.

# 9. Before you write
First write the scene boundaries of #{{from}}–#{{to}} by message number (where time, place or the situation turns) inside <scenes>…</scenes>, one line per scene, and check there that every message from #{{from}} to #{{to}} falls inside one of them. The extension removes this block. Then write the sections on those boundaries. Do not output STATE or OPEN in full; <current_state> is for reading only.`;
// earlier basic text, upgraded when untouched
export const PREV_BASIC = `아래 원문(#{{from}}–#{{to}})을 기존 아카이브와 같은 형식으로 압축해 주세요.
- 섹션 제목은 "## #시작–#끝 — 짧은 제목" 형식
- 사건·관계 변화·약속·떡밥 위주로, 대사는 꼭 필요한 것만 원문 그대로
- 원문에 없는 내용은 쓰지 않기
- 아카이브에 STATE·OPEN이 있으면 새 내용을 반영해 고친 전체도 함께

[형식 참고 — 기존 아카이브의 마지막 섹션]
{{last_section}}

[지금의 STATE · OPEN]
{{state}}

[원문]
{{raw}}`;
export const OLD_DEFAULTS = new Set(['1y2ik7n', '4nh49a']);
export const OLD_BASIC_HASHES = new Set(['5uaca5', '1gtzaod', 'ztrqbn', '1u7aqka', '1nz5q9e', 'rlhw7z', 'cqcpi1', '12lkzac', '1gzouls', 'x3kmxl', '1269olm', 'l3h9zy', '124875u', 'zbr8fw', '189egig', '5wzwes', 'kf51sc', '2oz3nu', '17uau04', '16w0zvh', 'm1q50b', 'ou2i35', '1kk6bu', 'dc5o0o', 'e6en20', '1qnbhcj', 'cwt9a8', 'k678s0', 'lbvxyj', '1cw54yj']); // earlier built-in basics, upgraded when untouched
export const OLD_BASIC = `아래 원문(#{{from}}–#{{to}})을 기존 아카이브와 같은 형식으로 압축해 주세요.
- 섹션 제목은 "## #시작–#끝 — 짧은 제목" 형식
- 사건·관계 변화·약속·떡밥 위주로, 대사는 꼭 필요한 것만 원문 그대로
- 원문에 없는 내용은 쓰지 않기

[형식 참고 — 기존 아카이브의 마지막 섹션]
{{last_section}}

[원문]
{{raw}}`;
export const activePrompt = g => g.prompts.find(p => p.id === g.activePrompt) || g.prompts[0];

// {{last_section}} is only a style sample. Models sometimes rewrite it as part of their answer,
// so it always goes in with a do-not-repeat label.
export function referenceSection(text) {
    const sec = lastRangedSection(text);
    if (!sec) return '(없음)';
    return `(Format sample only. This section is ALREADY in the archive — do not output, repeat or rewrite it. Start from the new log.)\n${sec}`;
}

// ---- AU: a chat that carries the main story's archive into an alternate universe.
// Its sections become their own log ("# ── AU ──", "## AU #0–#35 — …") after the main story's.

export const auOf = m => {
    const a = m?.au && typeof m.au === 'object' ? m.au : {};
    return { on: !!a.on, name: String(a.name || '').trim().replace(/\s+/g, '') || 'AU', note: String(a.note || '').trim() };
};
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const auDivider = name => `# ── ${name} ──`;
export const hasAuDivider = (text, name) => new RegExp(`^#\\s*──\\s*${reEsc(name)}\\s*──\\s*$`, 'm').test(String(text || ''));

// the block that goes on top of the compress instruction while the chat is an AU
export function auBlock(m) {
    const a = auOf(m);
    if (!a.on) return '';
    const first = !hasAuDivider(m.text, a.name);
    return `[AU — read this first]
This chat is an alternate universe (AU) of the story in the archive. The characters remember the main story and carry it into the AU.
AU premise: ${a.note || '(not given — take it from the raw log)'}
- The raw log is the AU. Summarize only it; do not retell the main story.
- The AU is its own log in the archive: number its sections "## ${a.name} #from–#to — title" (prefix "${a.name}", this chat's message numbers).${first ? `
- This is the AU's first summary: put the line "${auDivider(a.name)}" above your first new section.` : ''}
- STATE and OPEN: list changes only, as the instruction says; the extension renumbers them to the AU.${first ? ` This first time the main story's STATE carries into the AU: every line that still holds in the AU (memories, feelings, promises, secrets, what a character realized or resolved not to do) carries over untouched, so leave it out of your list. EDIT or DROP only what the AU premise makes untrue; do not add an AU heading or restate the AU's events in STATE.` : ` They are already the AU's.`}

`;
}

// the compress instruction with its blanks filled, and the AU block on top when the chat is an AU.
// memo: the user's note for this one compression — last, where it is read as the final word
export const memoBlock = memo => (String(memo || '').trim() ? `\n\n[USER'S NOTE FOR THIS STRETCH — highest priority. The user knows this story; follow this note even where the instructions above say otherwise.]\n${String(memo).trim()}` : '');
// The archive's language, read from its sections (not STATE titles or the raw log): 'en', 'ko' or '' when unclear
export function archiveLang(text) {
    const body = parseSections(String(text || '')).filter(x => !x.group && RANGE_HEAD.test(x.title)).slice(-8).map(x => String(text).slice(x.start, x.end)).join('\n');
    const hangul = (body.match(/[\uac00-\ud7af]/g) || []).length, latin = (body.match(/[A-Za-z]/g) || []).length;
    if (hangul + latin < 200) return '';
    return hangul / (hangul + latin) > 0.3 ? 'ko' : 'en';
}
export const LANG_NAME = { en: 'English', ko: 'Korean' };
// the last thing the model reads: the answer's language, whatever language the raw log and the note are in
export const langBlock = text => {
    const l = archiveLang(text);
    return l ? `\n\n[ANSWER LANGUAGE — ${LANG_NAME[l]}. Write every heading, bullet and STATE / OPEN line in ${LANG_NAME[l]}, like the archive, even though the raw log${l === 'en' ? ' and the user\'s note are' : ' is'} in another language. Translate quoted lines into ${LANG_NAME[l]}.]` : '';
};
// does an answer come back in the language the archive is written in? ('' when it cannot tell)
const textLang = (t, min) => {
    const hangul = (String(t).match(/[\uac00-\ud7af]/g) || []).length, latin = (String(t).match(/[A-Za-z]/g) || []).length;
    return hangul + latin < min ? '' : hangul / (hangul + latin) > 0.3 ? 'ko' : 'en';
};
export const answerLangOk = (archive, answer) => { const want = archiveLang(archive), got = textLang(answer, 40); return !want || !got || want === got; };
// {{recent}}: the headings of the archive's last few numbered sections — where the story stands, with no bullets
// for the model to blend into the new stretch (it did, even with only three sections' bodies)
export function recentSections(text, n = 3) {
    const t = String(text || '');
    const secs = parseSections(t).filter(x => !x.group && RANGE_HEAD.test(x.title)).slice(-n);
    return secs.length ? secs.map(x => `## ${x.title.replace(/^#+\s*/, '')}`).join('\n') : '(없음)';
}
// 2단계 압축, step 1: the raw log → one line per message, re-tellings marked, so step 2 never meets a moment twice
export const eventsSystem = lang => `GOAL
Turn a stretch of role-play messages into an event list, one entry per message, so a later writer can summarize the stretch without reading it. Record only what is new in each message; mark a message that only re-tells a moment already recorded. The later writer will see only your list, never the messages, so anything you leave out is lost: actions, but also motives, readings and restraint.

YOU GET
- KNOWN NAMES: the characters of this story.
- EARLIER MESSAGES: the last few messages before these, for context only. Write no entries for them; a message of yours that re-tells one of them is "= #N".
- MESSAGES: each starts with [number] and the speaker. The bot plays every non-user character under one name tag; tell who speaks or acts from the content. A private-thought tag holds thoughts, not speech. Status windows, trackers, planning blocks and OOC talk are not events; take only the date and place from them.
- Turns the user wrote are the strongest canon: their character's words, choices and own actions stand as written. When that character acts on someone else, the outcome is whatever the next reply shows; if the reply has it miss, fail or get turned aside, write it that way (Ren swung at Ivo; Ivo caught his arm). Ignore any part where the bot writes the user character's thoughts.
- Some user turns steer the story instead of playing it: a line opening with 전개:, 지시: or OOC, or text in brackets addressed to the bot. That is a request, not part of the story. Leave it out and write only what the bot's reply then put on the page.

STEPS
Each message
1. Ask: what happens here that has not happened before? An action, a decision, a reveal, a line that changes something, a move in place or time.
2. Write it as one short line (under about 30 words), or two when the message holds two separate events: who did what to whom, and the visible result. Use the KNOWN NAMES; never call a known character by a description ("the god", "her husband"). No description of bodies, rooms, light or weather.
3. A re-telling, re-description or reaction to a moment from an earlier message (above in this batch or in EARLIER MESSAGES; a reply re-telling the user's action from the other side, a recap at the start of a message) is "= #N", with the number of the message where it happened, then "; " and only what is new, if anything.
4. Nothing happens (small talk, scenery, waiting): "—".

What counts as an event
5. A feeling, only when it changes something (a confession, a refusal, a breakdown). Write it plainly, in one or two words.
6. A private thought or narrated reading, when it reveals a motive, a decision, or how one character took another's act. Write it as:
   Set (thinks): …
   Horus took it as …
7. Holding back, when the message makes it visible: a refusal, a stopped hand, a chosen silence, a promise kept under pressure. Write what was not done.
8. Words are not facts. When someone tells, claims, suspects or lies, keep it theirs: "Ivo told Ren the bridge was safe", "Mara suspects Ivo", never "the bridge was safe". If a later message proves or breaks it, write that when it happens.
9. A sex scene: only its steps, one plain line each: consent asked or given, a request to stop, a first, climax, the end. No acts, positions, bodies or sensations. A climax re-told in the next message is "= #N".

Quotes
10. Copy the spoken lines a later writer would most want word for word: a decision, a confession, a refusal, a correction, a promise, an accusation, a line that says what someone is to someone. At most two per message, exactly as written, in the original language, each on its own line starting with two spaces and a quotation mark. Never compose or paraphrase a quote. If a message has no such line, give none.
11. Inside a sex scene, quote a line only if it would still matter said fully clothed at a table (a confession, a promise, a wish, a refusal, a line that defines the relationship); never a line about the act itself (moans, directions, words about bodies).

Marks
12. When the date or place changes, start the line with "@ date, place —" (no clock time).
13. Start a line with ★ when it turns something: a relationship shifts, a secret comes out, a decision is made, a promise is given or broken. Use ★ sparingly; most lines have none.

EXAMPLE
KNOWN NAMES: Mara, Ren, Ivo

MESSAGES:
[57] Ren: Ren grabs Mara's wrist before she reaches the door. "Don't."
[58] Bot: Mara freezes as Ren's hand closes around her wrist… She doesn't pull away. "Then give me a reason."
[59] Ren: Ren opens his mouth, then closes it. If he gives her a reason, she'll stay for the wrong one. He says nothing for a long time.
[60] Bot: Ivo knocks: the north road is closed. Mara sets her bag down.

Answer:
[57] Ren stopped Mara at the door by grabbing her wrist.
  "Don't."
[58] = #57; Mara did not pull away and asked for a reason to stay.
  "Then give me a reason."
[59] Ren (thinks): if he gives her a reason, she will stay for the wrong one; he said nothing.
[60] ★ Ivo brought word that the north road was closed; Mara set her bag down and stayed.

OUTPUT
One entry per message, in order, no number skipped. Every entry line starts with [number]. Quote lines start with two spaces and a quotation mark. Nothing else: no headers, no commentary.
Write in ${lang || 'the language most of the messages are in'}; quotes stay in their original language.`;
// step 2: the list stands where the raw log was; this note goes on top of it
export const eventsNote = () => `The raw log has been turned into an event list, one entry per message. Lines marked (thinks) are private thoughts or readings; write them as that character's, never as fact. Lines marked ★ are turning points; give them room and consider starting a section there. Lines starting with "= #N;" add only what is new to an earlier moment. Treat this list as the raw log. The list was made without your rules. It can carry sex acts and lines said inside them, and more quotes than a section needs; your rules still decide what stays. A sex scene comes down to its relationship beats; a line said in bed stays only if it would still matter said fully clothed at a table.

The list has one entry per message; that is its shape, not yours. Collapse runs of entries into what they revealed, decided or broke. Never one sentence per entry, never "he said… she said…". Quotes under the entries are candidates in their original language: pick at most two per bullet, keep only the part that carries the turn, and translate it into the archive's language like any quote.

LIST:
[40] Ivo told Mara that Ren had paid her debt in secret.
[41] Mara confronted Ren in the yard and asked if it was true.
  "빚 갚은 거, 당신이에요?"
[42] = #41; Ren went still, then admitted it.
  "그래. 내가 했어."
[43] Mara accused him of buying her the way the duke had tried to.
  "결국 당신도 공작이랑 똑같네요. 돈으로 사람을 사고."
[44] Ren (thinks): if he explains, she will hear an excuse; he said only that she owed him nothing.
  "넌 나한테 빚진 거 없어."
[45] ★ Mara tore up the receipt and walked out.

✗ Mara asked Ren if he had paid the debt. Ren admitted it: "그래. 내가 했어." Mara accused him of being like the duke: "결국 당신도 공작이랑 똑같네요. 돈으로 사람을 사고." Ren said she owed him nothing: "넌 나한테 빚진 거 없어." Mara tore up the receipt.

✓
- When Ivo let slip that Ren had secretly paid her debt, Mara confronted him in the yard and he admitted it (#40, #42). She took it as being bought: "You're no different from the duke." (#43)
- Ren was sure any explanation would sound like an excuse and said only, "You owe me nothing." (#44) She tore up the receipt and left (#45).

(End of the example. The real list follows.)

`;
// How big the answer should be, as numbers: sections for this many messages, and, when a long stretch goes in parts,
// that every length target (the user's note included) is for the whole stretch, so each part takes its share
export function sizeBlock({ k = 0, n = 1, count, total = count, from, to, partFrom = from, partTo = to }) {
    // the archive's own sections: most cover 10–20 messages (about 15–22 on average once long events are counted)
    const lo = Math.max(1, Math.ceil(count / 22)), hi = Math.max(lo, Math.ceil(count / 15));
    const span = lo === hi ? `${lo} section${lo > 1 ? 's' : ''}` : `${lo}–${hi} sections`;
    if (n <= 1) return `\n\n[SIZE] #${from}–#${to} is ${count} messages: write roughly ${span} for it, cutting where the story turns.`;
    return `\n\n[PART ${k + 1} OF ${n}] The stretch #${from}–#${to} (${total} messages) is too long for one request, so it is sent in ${n} parts, in order. This request is part ${k + 1}: #${partFrom}–#${partTo} (${count} messages). Every length target — the section guide above and any number in the user's note — is for the whole stretch, not for this part: this part gets about 1/${n} of it. For these ${count} messages write roughly ${span}, cutting where the story turns.`;
}
// the long raw log goes first (a template that puts it on top in <raw_log> / <current_state>), so the AU block
// sits right after those, with the instructions; older templates keep it on top
export const compressPrompt = (tpl, vars, m, memo = '', size = '') => {
    const body = fillPrompt(tpl, { recent: recentSections(vars.archive ?? m.text), ...vars });
    const au = auBlock(m), cut = body.indexOf('</current_state>');
    const withAu = !au ? body : cut >= 0 ? `${body.slice(0, cut + 16)}\n\n${au.trim()}${body.slice(cut + 16)}` : au + body;
    // the note, the size and the language go before a closing "Before you write" step, so that step is read last
    const extra = memoBlock(memo) + size + langBlock(m.text);
    const last = withAu.lastIndexOf('\n# 9. Before you write');
    return last >= 0 ? `${withAu.slice(0, last).replace(/\s+$/, '')}${extra}\n\n${withAu.slice(last + 1)}` : withAu + extra;
};

// An AU answer that forgot its prefix or divider gets them: "## #12–#30" → "## AU #12–#30",
// "# STATE AT #30" → "# STATE AT AU #30", and "# ── AU ──" above the first new section.
// a section title without its "Y2 #1–#9 — " lead, for telling one section from another
export const bareTitle = t => String(t).replace(/^#+\s*/, '').replace(RANGE_HEAD, '$5').replace(/^\s*[—–-]\s*/, '').trim().toLowerCase();

// Sections a model copied out of the archive instead of writing new ones: a title the archive already has,
// most of its lines already in the archive, or a range that ends before the stretch it was asked for.
export function dropReproduced(body, archive, from) {
    const secs = parseSections(body);
    const known = parseSections(archive).filter(x => !x.group && RANGE_HEAD.test(x.title));
    const titles = new Set(known.map(x => bareTitle(x.title)));
    const lines = new Set(String(archive).split('\n').map(l => l.trim()).filter(l => l.length > 30));
    let out = '', dropped = 0, at = 0;
    for (const x of secs) {
        const r = x.group ? null : String(x.title).match(RANGE_HEAD);
        if (!r) continue;
        const own = body.slice(x.start, x.end).split('\n').slice(1).map(l => l.trim()).filter(l => l.length > 30);
        const copied = own.length && own.filter(l => lines.has(l)).length / own.length >= 0.6;
        if (Math.max(+r[2], +r[4]) < from || titles.has(bareTitle(x.title)) || copied) {
            out += body.slice(at, x.start); at = x.end; dropped++;
        }
    }
    out += body.slice(at);
    return { text: dropped ? out.replace(/\n{3,}/g, '\n\n').trim() : body, dropped };
}

export function auFix(text, m) {
    const a = auOf(m);
    if (!a.on) return text;
    // a heading the archive already has (a section the model copied) keeps its own numbering, so the
    // append window can still see it as already there
    const have = new Set(parseSections(m.text).filter(x => !x.group && RANGE_HEAD.test(x.title)).map(x => bareTitle(x.title)));
    let out = String(text || '')
        .replace(/^(##\s+)#(\d+\s*[–—~-]\s*#?\d+)(.*)$/gm, (all, h, r, rest) => (have.has(bareTitle(`#${r}${rest}`)) ? all : `${h}${a.name} #${r}${rest}`))
        .replace(/^(#\s+(?:STATE|OPEN)\s+AT\s+)#(\d+)/gm, `$1${a.name} #$2`)
        .replace(/^(_(?:True|Unresolved) at )#(\d+)/gm, `$1${a.name} #$2`);
    if (!hasAuDivider(m.text, a.name) && !hasAuDivider(out, a.name)) {
        const mt = /^##\s/m.exec(out);
        if (mt) out = `${out.slice(0, mt.index)}${auDivider(a.name)}\n\n${out.slice(mt.index)}`;
    }
    return out;
}

export function fillPrompt(tpl, vars) {
    let out = tpl;
    for (const [k, v] of Object.entries(vars)) out = out.split(`{{${k}}}`).join(v);
    return tpl.includes('{{raw}}') ? out : `${out}\n\n${vars.raw}`;
}

// ---- compress settings in the panel: extract options + prompt library

export function renderPromptSettings() {
    const g = globalSettings();
    $('#na_opt_hidden').prop('checked', !!g.skipHidden);
    $('#na_opt_tags').prop('checked', !!g.stripTags);
    if (document.activeElement?.id !== 'na_strip_custom') $('#na_strip_custom').val(g.stripCustom || '');
    showStripInfo();
    const $h = $('#na_plib');
    if (!$h.length) return;
    const cur = activePrompt(g);
    const sorted = [...g.prompts].sort((a, b) => (b.fav - a.fav));
    $h.find('.na_psel').html(sorted.map(p => `<option value="${esc(p.id)}">${p.fav ? '★ ' : ''}${esc(p.name)}</option>`).join('')).val(cur.id);
    $h.find('.na_pfav').html(g.prompts.filter(p => p.fav).map(p =>
        `<button type="button" class="na_pchip ${p.id === cur.id ? 'on' : ''}" data-id="${esc(p.id)}">${esc(p.name)}</button>`).join(''));
    $h.find('.na_pstar i').attr('class', cur.fav ? 'fa-solid fa-star' : 'fa-regular fa-star');
    $h.find('.na_pstar').toggleClass('active', !!cur.fav);
    $h.find('.na_pdel, .na_pren').prop('disabled', cur.id === 'basic');
    $h.find('.na_prompt_reset').toggle(cur.id === 'basic' && cur.text !== BASIC_PROMPT);
    const $ta = $h.find('.na_prompt_ta');
    if ($ta.data('pid') !== cur.id) $ta.val(cur.text).data('pid', cur.id);
}

export function bindPromptSettings() {
    const g = () => globalSettings();
    const $h = $('#na_plib').html(`
        <div class="na_pfav"></div>
        <div class="na_prow">
          <select class="text_pole na_psel"></select>
          <button type="button" class="na_icon na_pstar" title="즐겨찾기"><i class="fa-regular fa-star"></i></button>
          <button type="button" class="na_icon na_pnew" title="새 지시문"><i class="fa-solid fa-plus"></i></button>
          <button type="button" class="na_icon na_pdup" title="복제"><i class="fa-regular fa-clone"></i></button>
          <button type="button" class="na_icon na_pren" title="이름 바꾸기"><i class="fa-solid fa-i-cursor"></i></button>
          <button type="button" class="na_icon na_pdel" title="삭제"><i class="fa-regular fa-trash-can"></i></button>
        </div>
        <textarea class="text_pole na_prompt_ta" spellcheck="false" rows="9"></textarea>
        <div class="na_pfoot">
          <details class="na_phelp">
            <summary>쓸 수 있는 자리표시</summary>
            <dl>
              <dt>{{raw}}</dt><dd>원문 (안 쓰면 맨 끝에 붙어요)</dd>
              <dt>{{from}} {{to}}</dt><dd>번호 범위</dd>
              <dt>{{last_section}}</dt><dd>아카이브 마지막 섹션</dd>
              <dt>{{state}}</dt><dd>지금의 STATE · OPEN</dd>
              <dt>{{archive}}</dt><dd>아카이브 전체</dd>
            </dl>
          </details>
          <button type="button" class="na_linkbtn na_prompt_reset">기본 지시문 되돌리기</button>
        </div>`);
    $('#na_opt_hidden').on('change', function () { g().skipHidden = this.checked; saveGlobal(); });
    $('#na_opt_tags').on('change', function () { g().stripTags = this.checked; saveGlobal(); showStripInfo(); });
    $('#na_strip_custom').on('input', function () { g().stripCustom = this.value; saveGlobal(); showStripInfo(); });
    const pick = id => { g().activePrompt = id; saveGlobal(); renderPromptSettings(); };
    const askName = async (title, value) => {
        const v = await ctx().Popup.show.input(title, '', value);
        return typeof v === 'string' ? v.trim() : '';
    };
    $h.find('.na_psel').on('change', function () { pick(this.value); });
    $h.on('click', '.na_pchip', function () { pick($(this).data('id')); });
    $h.find('.na_pstar').on('click', () => { const p = activePrompt(g()); p.fav = !p.fav; saveGlobal(); renderPromptSettings(); });
    $h.find('.na_pnew').on('click', async () => {
        const name = await askName('새 지시문 이름', `지시문 ${g().prompts.length + 1}`);
        if (!name) return;
        const p = { id: newId(), name, text: '', fav: false };
        g().prompts.push(p); pick(p.id);
        $h.find('.na_prompt_ta').trigger('focus');
    });
    $h.find('.na_pdup').on('click', async () => {
        const src = activePrompt(g());
        const name = await askName('복제한 지시문 이름', `${src.name} 사본`);
        if (!name) return;
        const p = { id: newId(), name, text: src.text, fav: false };
        g().prompts.push(p); pick(p.id);
    });
    $h.find('.na_pren').on('click', async () => {
        const p = activePrompt(g());
        if (p.id === 'basic') return;
        const name = await askName('이름 바꾸기', p.name);
        if (!name) return;
        p.name = name; saveGlobal(); renderPromptSettings();
    });
    $h.find('.na_pdel').on('click', async () => {
        const p = activePrompt(g());
        if (p.id === 'basic') return;
        if (!await confirm('지시문 삭제', `"${esc(p.name)}"을(를) 지울까요? 되돌릴 수 없어요.`)) return;
        g().prompts = g().prompts.filter(x => x.id !== p.id);
        pick(g().prompts[0].id);
    });
    $h.find('.na_prompt_ta').on('input', function () { activePrompt(g()).text = this.value; saveGlobal(); });
    $h.find('.na_prompt_reset').on('click', () => {
        const p = g().prompts.find(x => x.id === 'basic');
        p.text = BASIC_PROMPT; $h.find('.na_prompt_ta').val(p.text).data('pid', null); saveGlobal(); renderPromptSettings();
    });
    $('#na_cmp_settings').on('toggle', function () { if (this.open) renderPromptSettings(); });
    renderPromptSettings();
}
