// Compression instructions (prompt library) and their settings.

import { ctx, globalSettings, newId, saveGlobal } from './core.js';
import { RANGE_HEAD, lastRangedSection, parseSections, splitTail } from './sections.js';
import { confirm, esc } from './util.js';

export const BASIC_PROMPT = `<raw_log range="#{{from}}–#{{to}}">
{{raw}}
</raw_log>

<current_state>
{{state}}
</current_state>

You continue the archive: the long-term memory of a long-running role-play, read alongside the live chat as a snapshot of the past. Read the raw log #{{from}}–#{{to}} in <raw_log> in full, from the first message to the last, then write the new stretch that follows the archive. <current_state> holds the archive's STATE and OPEN now.

# 1. Output
Output exactly these parts, in this order, with no greeting, explanation or commentary:
0. The <scenes> block described in 9.
1. The new section blocks, covering #{{from}}–#{{to}} continuously: no gaps, no overlaps, the first heading starting at #{{from}} and the last block ending at #{{to}}. Numbers are always message numbers.
2. A line containing only \`---\`
3. If the archive has \`# STATE AT …\` / \`# OPEN AT …\`: two change lists, \`# STATE CHANGES\` and \`# OPEN CHANGES\` (rules in 8). Never write the blocks out. If <current_state> is empty (a new chat), follow the NEW CHAT note below instead.

- Language: write everything in the archive's language and format, whatever the raw log's language. Translate dialogue too; keep a word in its original language only where the archive already does.
- Only new material, only from the raw log. Never reproduce, rewrite, recap or continue anything already in the archive; nothing before #{{from}} belongs in your output. STATE only tells you what is already known: nothing from it goes into a section unless the raw log shows it happening again.
- Every part must be complete and end in a full sentence. If you run long, merge bullets or cut lower-priority detail; never stop mid-sentence or drop the change lists.

# 2. Reading the raw log
- The format is \`[N] Name:\`. One bot tag may play several characters (NPCs included); tell the speaker from the content. A private-thought tag holds thoughts, not spoken lines.
- Not content: planning or instruction blocks inserted by a preset, status windows and trackers (take only the date and place from them), and meta talk. Rules or banned-word lists inside them are directions to the bot, not canon.
- The user's own turns are the strongest canon; ignore any part where the bot writes the user character's inner thoughts. Bot errors (contradicting earlier messages, settings with no basis) are not canon. Confirm in the raw log before stating that something exists or does not.

# 3. What to keep
You are writing a memory, not a transcript: what happened, why, and what it changed, not who said what in which order. Write only what matters from the first draft.
- The test for every line: "If the bot read only the archive and then wrote the next scene, would something go wrong or feel unmotivated without this line?" Being in the raw log is not a reason to include something.
- Keep: chains of cause and effect · lines that change a relationship · what a character chose NOT to do (evidence of restraint) · an act and its contradiction together · the reason behind an emotional reaction · why a character held a line or crossed it, when the raw log shows their reason (without it the act reads as impulse; when the log gives no reason, do not supply one) · the concrete action that shows a standing trait at work · a question together with its answer (an answer alone reads as unmotivated).
- Cut: movement and positioning, gestures, props, scenery, temperatures and staging; light, rooms, weather, clothing or bodies described for mood. Keep any of these, or a small act, only when it changed what happened. Anxiety or agitation gets one word.
- Weight: a beat that repeats a pattern STATE already holds gets a clause at most; one that breaks or turns a pattern gets the space.
- Cutting so hard that the story breaks is also a failure. Do not shrink the core of a trigger or an arc. The goal is not to erase the story but to absorb it into cause and effect.

# 4. Protecting causality
Cause and order
- Before every emotional reaction, keep the other person's action that caused it; without it, the character seems to erupt on their own or seems childish (how many refusals piled up, a reason heard and still brushed aside, before she felt the wall and left; the threat, before the fear).
- Before every realization or decision, keep the trigger that made it possible; cut the process and the character "suddenly understands" (he handed her the choice for the first time, so she chose).
- When a reaction draws on a past event, name the event plainly and briefly ("remembering the shipwreck"), never a summary of its meaning ("refusing any echo of past self-destruction"). When the archive uses log prefixes, its numbers may follow with the prefix: (Y1 #322–#325).
- Keep the raw log's order. Do not pull a later event (when someone remembered or noticed something) into an earlier bullet. Nothing stronger than the raw log says.

Whose it is
- Write felt experience as felt experience, not as the narrator's verdict. ("Hunted into a dead end" ✗ → "Feeling hunted into a dead end" ✓) A character's interpretation is written only as theirs, never as fact: "(her reading, not his intent)", "In her own reckoning, …".
- Record each person's part as it happened, without softening it or making it worse. Preserve both sides' responsibility: do not erase one side's fault because of the other side's hurt, in either direction.
  ✗ "the old wound beneath her sense of being caged" (reads as if the cage was only in her head) → ✓ "the old wound that drove that fear so deep"
  ✗ "running away gave her no freedom" → ✓ "running away alone could not prove she was free"
- Write a character's present feelings from where the relationship stands now. Once the relationship has changed, describe how they see the other person today, not through the lens of an earlier arc.
- Be careful with absolutes such as "never" and "not once." They make a character read as cold or indifferent.

# 5. Writing the sections
Sections
- A section is a chapter, not a beat. Cut only where something turns: a relationship shifts, the situation changes, a secret comes out, a decision is made. Fold small beats into the section they belong to. Most sections cover 10–20 messages; a long event may run longer, a sharp turn may get a short one.
- Header: \`## #start–#end — Title (date, place)\`, then \`PLOT:\`, then \`- \` bullets. If STATE's heading puts a prefix before the numbers (e.g. \`# STATE AT Y2 #143\`), put it in your headings too.
- Date and place come from the tracker and narration; a tracker date that does not fit (a season wrong for the month, a date going backward) is a model error, ignore it. Note an unrecorded time skip in the header ("some five months later"). No clock times; a part of the day (morning, evening, night) is enough.

Bullets
- Bullets only, no paragraphs. One bullet = one event: what happened, what caused it, and what it changed. A bullet may cover many messages; never one bullet per message, and never a conversation reported turn by turn ("He asked… She replied…"). Collapse an exchange into what it revealed, decided or broke. To shorten, merge bullets.
- 2–6 bullets per section, never more than 6; rarely more than about 250 words. A stretch that truly needs more is two chapters: split it where it turns.
- Every sentence in a bullet ends with its source message number in parentheses: (#88), or (#88, #91). Only numbers inside the section's own range. A sentence you cannot point to a message for (a motive, a fear, a meaning the log does not state) does not go in. The extension checks these numbers and removes them when it saves.
- Do not say the same thing twice. When you add a sentence, check the bullets before and after it for the same content.

Quotes
- Quotes are part of the memory, not decoration, and not a transcript. Quote only a line that changes a relationship or defines a character, the one that turns the moment and that the next scene would need word for word: a decision, a confession, a refusal, a correction, a promise, an accusation, a line that says what someone is to someone. Many bullets carry none; at most two in a bullet. Tell the rest in your own words, absorbed into cause and effect.
- A quote is a line that actually appears in the raw log (translated when the log is in another language), faithful to the original, including whether it is a question: a statement gets no question mark. Never invent or paraphrase a line as a quote. Keep each speaker's register and "……". Keep honorifics, nicknames and untranslatable words as written.
- Never leave a quote standing alone: the sentence around it says who and in what spirit, and attaches the character's reaction to it.
- Keep a quote short: one sentence, under about 20 words. If the line runs longer, quote the part that matters; never reword it.

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

# 6. The archive's voice
Write every PLOT bullet in the voice of the existing archive, so your text reads as if the same hand wrote the earlier sections.

VOICE
- A quiet, exact chronicler, calm and clear. Past tense, plain sentences, names instead of descriptions. The more serious the moment, the plainer the sentence.
- If a sentence sounds impressive, it is probably too much.

RHYTHM
- Two to four sentences per bullet, mostly of middle length. A short, flat sentence often closes it.
- Most sentences open on their subject: a name, or he/she. Only now and then does one open otherwise, for example:
  "Three days on, …" / "To Ren, …" / "The letter …" / "What he wanted was …" / "But she …" / ""Stay," she said, and …" / "Asked why, he …" / "When she left, …"
  Never open two sentences in a bullet with the same word, other than a name.
- A reason can come after the act as easily as before it.
- Join acts in one sentence only when they are one motion. When the purpose changes, start a new sentence.
- Colon only to introduce a line, a reason, or what something meant to someone. Semicolon for two acts that answer each other. Em dashes sparingly: at most one in a section's bullets; otherwise use a comma, a colon or a new sentence.

SHAPES
What section 3 keeps often takes one of these shapes. Use one when the log calls for it; most bullets need one or none.
- An act and its contradiction together: "…said he would never forgive it, and still did not let go."
- Restraint as what was not done: "…rather than knock", "never crossed the line".
- A reading tied to its owner: "To Ren, it sounded like a sentence." / "In her own reckoning, …"
- A question kept with its answer.

FEELING
- Let the characters carry the feeling through what they did and said. The narrator stays quiet.
- Name a feeling once and say whose it is, or show one bodily sign the log gives. Not both ("flushed and angry", "pale with fear": keep one).
- No narrator metaphors. An image appears only if the log has it.

NEVER
- Interpretation, theme or summary-verdict sentences of your own; summing up meaning: "their bond deepened", "something shifted". Ending a bullet on what it meant.
- tender, intimate, profound, palpable, a testament to, unspoken, electric, in that moment, it was clear that, couldn't help but.
- Long "and… and… and" sentences. Describing a known character instead of naming them.
- "while" twice in one bullet. "Also" to tack an act on ("He also…"): join it to the act before it instead.

# 7. Example
✓ Memory, in the archive's own style:
## #57–#69 — The north road (Spring 3, night, Varo)
PLOT:
- Mara came back the same night she had sworn to leave, unable to say why (#57, #59). Ren let her in without pressing and told her the north road was closed, and she stayed: "Then I'll wait." (#60, #63)
- Over supper Ivo let slip that he had paid her passage toll in secret (#65). Ren did not cover for him; in his own account he had known for days and kept quiet because the debt was not his to name (#66, #68). Mara heard it as two men deciding her road between them and set the toll-mark on the table: "Neither of you asked." (#69)

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
- \`## Heading\` / \`## Group\` is the one the line sits under, spelled exactly as in <current_state>; leave out \`## Group ::\` when OPEN has no groups. Do not invent headings. An empty list is \`(none)\`.
- EDIT a STATE line only when this stretch makes it untrue or outdated, so an old behavior a later arc changed does not stay in the present tense (one who used to ignore her signals and has changed: "can still ask, but stops at a clear no"). Change only what changed and keep the rest of the line word for word; never shorten a line to save space, never merge lines.
- DROP a STATE line only when the story itself has overturned it; what a character realized or resolved stays until then. Keep safety lines that lock the current state (e.g. "memories fully restored since #n": it stops the bot from mistaking an old arc for the present).
- New and edited STATE lines: per character + relationships + current situation (or household). Only the changes and tendencies that PLOT alone does not capture, briefly; do not restate events already in the sections. STATE may hold interpretation, but a character's reading is attributed to them, never raised to fact. One line for a core principle the bot is likely to confuse is allowed. Scope principles narrowly to prevent over-application ("no commands" ✗, which could change even how he talks → "no longer dictates her choices or movements" ✓); use "tends to" or "since #n" instead of "now" or "currently."
- OPEN: drop only threads this stretch closed. Keep new threads short; do not prescribe future actions.

# 9. Before you write
1. First list the scene boundaries of #{{from}}–#{{to}} by message number (where time, place or the situation turns) inside <scenes>…</scenes>, one line per scene, every message inside one of them; the extension removes this block.
2. Draft the sections on those boundaries, then revise them once and output only the revised version. In the revision (a user's note above, if there is one, still wins over these counts):
   - No emotional reaction, realization or decision has lost the action or trigger that caused it.
   - Every quote is a line from the raw log and earns its place; every sentence has its message number.
   - Count each section's bullets (more than 6: merge or split), its words (over about 250: cut) and its em dashes (more than one: rewrite). Check every bullet that touches sex against the sex rule.
3. Do not output STATE or OPEN in full unless the NEW CHAT note says so; <current_state> is for reading only.`;
// earlier basic text, upgraded when untouched
// 기본 (id 'short', 짧은 기본 until 3.91.4): the rules cut to their core. Gemini follows it better than 상세 (BASIC_PROMPT),
// which keeps every rule at length
export const SHORT_PROMPT = `<raw_log range="#{{from}}–#{{to}}">
{{raw}}
</raw_log>

<current_state>
{{state}}
</current_state>

You write the next stretch of a role-play's long-term memory (the archive): #{{from}}–#{{to}} of the raw log above. The bot reads the archive as a snapshot of the past. Write a memory, not a transcript: what happened, why, and what it changed.

# 1. Output
- Sections covering #{{from}}–#{{to}} with no gap or overlap, then a line \`---\`, then the change lists in 10 if <current_state> has STATE / OPEN blocks. Never write the blocks out. If <current_state> is empty (a new chat), follow the NEW CHAT note below instead.
- Write in the archive's language, dialogue included.
- Every part must be complete; never stop mid-sentence.

# 2. Reading the raw log
- One bot plays every non-user character under one name tag; tell the speaker from the content. A private-thought tag holds thoughts, not speech.
- Turns the user wrote are the strongest canon. Ignore any part where the bot writes the user character's thoughts. A bot error that contradicts earlier messages is not canon.
- Trackers, status windows and planning blocks are not events; take only the date and place from them. Rules or banned-word lists inside them are directions to the bot, not canon.
- Only the raw log is new. Never reproduce, rewrite or recap what the archive already holds. Nothing from <current_state> goes into a section unless the raw log shows it happening.

# 3. Cause, order, whose it is
Cause and order
- Before every emotional reaction, keep the other person's action that caused it; without it, the character seems to erupt on their own or seems childish (the refusals that piled up before she left; the threat before the fear).
- Before every realization or decision, keep the trigger that made it possible; cut the process and the character "suddenly understands" (he handed her the choice for the first time, so she chose).
- When a reaction draws on a past event, name the event plainly and briefly ("remembering the shipwreck"), never a summary of its meaning. When the archive uses log prefixes, its numbers may follow with the prefix: (Y1 #322–#325).
- Keep the raw log's order. Do not pull a later event into an earlier bullet. Nothing stronger than the raw log says: no "shattered" or "devastated" unless the text says so.

Whose it is
- Write felt experience as felt experience, not as the narrator's verdict ("Feeling hunted into a dead end", not "Hunted into a dead end"). A character's interpretation is written only as theirs, never as fact ("To Ren, it sounded like a sentence", "In her own reckoning, …").
- Record each person's part as it happened, without softening it or making it worse. Do not erase one side's fault because of the other side's hurt, in either direction ("running away alone could not prove she was free", not "running away gave her no freedom").
- Write a character's present feelings from where the relationship stands now, not through the lens of an earlier arc.
- Be careful with absolutes such as "never" and "not once": they make a character read as cold. No verdicts, labels or themes of your own ("childish", "cold", "cowardly") unless a character says them.

# 4. What to keep
Test every line: "Without it, would the bot's next scene go wrong or feel unmotivated?" Being in the raw log is not a reason. Cutting so hard that the story breaks is also a failure: never shrink the core of a trigger or an arc.
- Keep: the reason behind an emotional reaction · why a character held a line or crossed it, when the raw log shows it (when it gives none, do not supply one) · what a character chose not to do ("…rather than knock") · an act and its contradiction together ("…said he would never forgive it, and still did not let go") · a question with its answer. Most bullets need one of these or none.
- A beat that repeats a pattern STATE already holds gets a clause at most; one that breaks or turns it gets the space.
- Cut how a line was said, and light, rooms, clothing or bodies described for mood; anxiety gets one word. The rest of the staging: 5.
- When one of this RP's recurring devices returns (a phrase, an object, a song, a ritual), keep that event and line.

# 5. What to leave out
Leave out movement that only carries the scene, such as taking off a coat or crossing a room. Keep a physical act only if it is the event itself (a slap, a kiss) or drives a choice or conflict. Never fill the gap with invented meaning.
✗ Ren hung up his coat, sat beside her and poured the tea before asking why she had come back.
✓ Ren asked why she had come back.

# 6. Emotional arc
Preserve the emotional thread of the scene: what each character feels toward the other, how those feelings change, and what feelings remain in tension. When the raw log gives an inner thought or motive that matters to the relationship, state it briefly alongside the action it drives. When someone hides something or admits only part of it, keep what they left out. Do not invent feelings or resolve a conflict the log leaves unresolved. Cut staging and repetition to make room; do not add length.

# 7. Sections and bullets
- A section is a chapter: cut where the story turns (a relationship shifts, a decision, a secret, a change of place or time). Most sections cover 10–20 messages.
- Header: "## #start–#end — Title (date, place)", then "PLOT:", then 2–6 "- " bullets, about 250 words at most; a section that needs more is two, split where it turns. If the STATE heading puts a prefix before its number (# STATE AT Y2 #143), put it in your headings too.
- Date and place from the tracker, ignoring one that does not fit (wrong season, going backward); a part of the day, never a clock time; note an unrecorded time skip ("some five months later").
- One bullet is one event: what happened, what caused it, what it changed. Never report a conversation turn by turn ("He asked… She replied…"); fold it into what it revealed, decided or broke. An argument is one bullet: each side's point once, then where it ended. Verbs like asked, explained, argued, countered, admitted in a row mean you are reporting turns.
- Every sentence ends with the number of the message it comes from: (#88), or (#88, #91). A sentence you cannot point to a message for does not go in.
- Say each thing once. Do not lean on one verb ("explaining", "insisting") line after line.
- Titles: like a book's table of contents, short and concrete; they name the scene, they do not summarize it. Vary the shape: a place or object, two things joined, one short plain sentence, a "what" clause; rarely a quoted line, at most one in a stretch. No semicolons (✗ Ren crosses the bridge; Mara pulls him up).

# 8. Quotes and special content
- Quote only a line that changes a relationship or defines a character, the one that turns the moment: it decides, confesses, refuses, promises, accuses or says what someone is to someone. Many bullets have none, at most two.
- Faithful to the raw log (translated when needed); a statement gets no question mark. Keep each speaker's register and "……", and honorifics, nicknames and untranslatable words as written. One sentence, under about 20 words. Never invent or paraphrase a quote.
- The sentence around a quote says who and in what spirit, and the character's reaction goes with it.
- Sex: only relationship beats: who, how consent moved, a request to stop, a first, what was said that would still matter at a table, what changed after. No acts, bodies or sensations, even if the user's own turn describes them; never quote a line about the act itself. Crises and self-harm: plainly.

# 9. The archive's voice
Write every PLOT bullet in the voice of the existing archive, so your text reads as if the same hand wrote the earlier sections.
- A quiet, exact chronicler. Past tense, plain sentences, names instead of descriptions. The more serious the moment, the plainer the sentence. If a sentence sounds impressive, it is probably too much.
- Two to four sentences per bullet, mostly of middle length. A short, flat sentence often closes it.
- Most sentences open on their subject: a name, or he/she. Only now and then does one open otherwise, for example:
  "Three days on, …" / "To Ren, …" / "The letter …" / "What he wanted was …" / "But she …" / ""Stay," she said, and …" / "Asked why, he …" / "When she left, …"
  Never open two sentences in a bullet with the same word, other than a name.
- A reason can come after the act as easily as before it. Join acts in one sentence only when they are one motion; when the purpose changes, start a new sentence.
- Colon only to introduce a line, a reason, or what something meant to someone. Semicolon for two acts that answer each other. At most one em dash in a section.
- Name feelings when needed; keep them brief and attributed. Cut bodily signs that only repeat them. No commentary of the narrator's own. No narrator metaphors; an image appears only if the log has it.
- Never: summing up meaning ("their bond deepened", "something shifted") or ending a bullet on what it meant · tender, intimate, profound, palpable, a testament to, unspoken, electric, in that moment, it was clear that, couldn't help but · long "and… and… and" sentences · describing a known character instead of naming them · "while" twice in one bullet · "Also" to tack an act on ("He also…"): join it to the act before it instead.

# 10. STATE and OPEN changes
Only what this stretch changes, one change per line under \`# STATE CHANGES\` and \`# OPEN CHANGES\`: \`ADD ## Heading :: - new line\`, \`EDIT ## Heading :: - old line copied exactly ==> - new line\`, \`DROP ## Heading :: - old line copied exactly\`. An empty list is (none).
- STATE lines: per character, relationships, current situation; only what PLOT does not already hold. EDIT only a line this stretch makes untrue, changing only what changed, so an old behavior does not stay in the present tense ("can still ask, but stops at a clear no"). DROP only what the story overturned. Keep safety lines ("memories restored since #n").
- Scope principles narrowly ("no longer dictates her choices", not "no commands"); "tends to" or "since #n", not "now"; a character's reading stays theirs.
- OPEN: short threads; drop the ones this stretch closed; never prescribe future actions.

# 11. Example
✗ Mara knocked and stood in the doorway. Ren asked why she had come back. Mara said she didn't know. Ren told her the road was closed. Mara said, "Then I'll wait."
✗ Ivo asked why she stayed. Mara explained the road was closed. Ivo argued she could take the river. Mara countered that the river was his idea.
✓
## #57–#74 — The north road (Spring 3, night, Varo)
PLOT:
- Mara came back the same night she had sworn to leave, unable to say why (#57, #59). Ren let her in without pressing and told her the north road was closed, and she stayed: "Then I'll wait." (#60, #63)
- Ivo pressed her to take the river road; Mara refused it because it was his idea, and the question was left there (#71, #74).

# 12. Before you write
Check each section once before you output: a reaction or decision that lost its cause, order, anything said twice, verdicts of your own, quote length, em dashes, bullet count.`;
export const OLD_SHORT_HASHES = new Set(['amx6h2', '892qha', '13bqai', 'aromd8', '1ksvarl', 'vty6ef', '19jwyhk', '1onlmqn', '8w7l4g', 'xrfv6n', '17lzb8y', '1e146dz', '1gmqwj8', 'c81cqs', 'lwei5t', '42t9kk']); // earlier built-in short ones, upgraded when untouched
export const BUILTIN_PROMPTS = new Set(['basic', 'short']);
const BUILTIN_TEXT = { basic: () => BASIC_PROMPT, short: () => SHORT_PROMPT };
// 기본 (정리본) as it shipped in 3.84.0–3.86.x, before it became 기본 itself: an untouched copy is taken out
export const OLD_TIDY_HASHES = new Set(['du58gb']);

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
export const OLD_BASIC_HASHES = new Set(['1k1sqdj', '1wmhnb4', '1heknmb', 'rnoag8', '1y824pg', '1a9dx2s', '1xqbitt', '1qmckm4', '197ipyx', '1kagm56', '1kvass7', '5uaca5', '1gtzaod', 'ztrqbn', '1u7aqka', '1nz5q9e', 'rlhw7z', 'cqcpi1', '12lkzac', '1gzouls', 'x3kmxl', '1269olm', 'l3h9zy', '124875u', 'zbr8fw', '189egig', '5wzwes', 'kf51sc', '2oz3nu', '17uau04', '16w0zvh', 'm1q50b', 'ou2i35', '1kk6bu', 'dc5o0o', 'e6en20', '1qnbhcj', 'cwt9a8', 'k678s0', 'lbvxyj', '1cw54yj', '936ejv', '1aww7hu', 'nx8yvf']); // earlier built-in basics, upgraded when untouched
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
// tail: false for jobs that write sections only, so the line does not invite STATE / OPEN blocks
// src: what may be in another language (a digest reads sections, not a raw log)
export const langBlock = (text, { tail = true, src = null } = {}) => {
    const l = archiveLang(text);
    const from = src ?? `the raw log${l === 'en' ? ' and the user\'s note are' : ' is'}`;
    return l ? `\n\n[ANSWER LANGUAGE — ${LANG_NAME[l]}. Write every heading${tail ? ', bullet and STATE / OPEN line' : ' and bullet'} in ${LANG_NAME[l]}, like the archive${from ? `, even though ${from} in another language` : ''}. Translate quoted lines into ${LANG_NAME[l]}.]` : '';
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
// a chat whose archive has no STATE / OPEN yet: the built-in instruction asks for both blocks in full (and the archive's
// title line), following this note; it goes in only then, so every later stretch reads a shorter instruction
export const NEW_CHAT_NOTE = `# NEW CHAT
This chat's archive has no STATE or OPEN yet. Start the output with the archive's title line and note, then the sections, then \`---\` and both blocks in full:
\`\`\`
# <character> × <character> — Context Archive (#{{from}}–#{{to}})
_Continuity record, not a script. Ends at #{{to}} — where the live chat differs, the live chat is correct._

…sections…

---
# STATE AT #{{to}} (date, part of day, place)
_True at #{{to}}. A character's reading marked as such is not canon._
## <each character>
## Relationships
## Current situation
# OPEN AT #{{to}}
_Unresolved at #{{to}}; check recent messages before treating any as pending._
\`\`\`
The heading is always "STATE AT", never "CURRENT STATE". The STATE rules in 8 apply: short lines, no events already in the sections, a character's reading attributed to them. OPEN may be split into groups (e.g. ## Deep past · ## Relationships · ## World and live plot); keep threads short and do not prescribe future actions.`;

// the note, the size and the language go before a closing "Before you write" step, so that step is read last
// (a later part of a long range already has the STATE the first part wrote, so it gets change lists again)
function compressExtra(tpl, vars, m, memo, size) {
    const noState = vars.state === undefined ? !splitTail(String(vars.archive ?? m.text ?? ''))[1].trim() : !String(vars.state).trim() || String(vars.state).trim() === '(없음)';
    const fresh = /NEW CHAT note/.test(tpl) && noState ? `\n\n${NEW_CHAT_NOTE.split('{{from}}').join(vars.from ?? '').split('{{to}}').join(vars.to ?? '')}` : '';
    return fresh + memoBlock(memo) + size + langBlock(m.text);
}
// where the closing "# N. Before you write" step starts (its number moved from 9 to 8 in 3.89.2; custom copies keep theirs)
export const beforeAt = text => { let at = -1; for (const mt of String(text).matchAll(/\n# \d+\. Before you write/g)) at = mt.index; return at; };
export const compressPrompt = (tpl, vars, m, memo = '', size = '') => {
    const body = fillPrompt(tpl, { recent: recentSections(vars.archive ?? m.text), ...vars });
    const au = auBlock(m), cut = body.indexOf('</current_state>');
    const withAu = !au ? body : cut >= 0 ? `${body.slice(0, cut + 16)}\n\n${au.trim()}${body.slice(cut + 16)}` : au + body;
    const extra = compressExtra(tpl, vars, m, memo, size);
    const last = beforeAt(withAu);
    return last >= 0 ? `${withAu.slice(0, last).replace(/\s+$/, '')}${extra}\n\n${withAu.slice(last + 1)}` : withAu + extra;
};

// 규칙은 시스템 메시지로: the rules (after <current_state>, up to "# N. Before you write") go in the system part;
// the raw log, the state, the AU block, this stretch's notes and the closing step stay in the request.
// Turned off, or a template without both marks: everything in the request, as before.
export const rulesInSystem = () => !!globalSettings().rulesInSystem;
export function compressParts(tpl, vars, m, memo = '', size = '') {
    const whole = () => ({ system: '', prompt: compressPrompt(tpl, vars, m, memo, size) });
    if (!rulesInSystem()) return whole();
    const body = fillPrompt(tpl, { recent: recentSections(vars.archive ?? m.text), ...vars });
    const cut = body.indexOf('</current_state>'), last = beforeAt(body);
    if (cut < 0 || last < cut) return whole();
    const rules = body.slice(cut + 16, last).trim();
    const au = auBlock(m).trim(), notes = compressExtra(tpl, vars, m, memo, size).trim();
    return { system: rules, prompt: `${body.slice(0, cut + 16)}${au ? `\n\n${au}` : ''}\n\n[The rules for this job are in the system message. Follow them.]${notes ? `\n\n${notes}` : ''}\n\n${body.slice(last + 1)}` };
}

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
    $('#na_opt_tags').prop('checked', g.stripTags !== false);
    $('#na_quick_auto').prop('checked', !!g.quickAuto);
    $('#na_nudge').val(String(g.compressNudge === undefined || g.compressNudge === null || g.compressNudge === '' ? 60 : Number(g.compressNudge) || 0));
    const $h = $('#na_plib');
    if (!$h.length) return;
    const cur = activePrompt(g);
    const sorted = [...g.prompts].sort((a, b) => (b.fav - a.fav));
    $h.find('.na_psel').html(sorted.map(p => `<option value="${esc(p.id)}">${p.fav ? '★ ' : ''}${esc(p.name)}</option>`).join('')).val(cur.id);
    $h.find('.na_pfav').html(g.prompts.filter(p => p.fav).map(p =>
        `<button type="button" class="na_pchip ${p.id === cur.id ? 'on' : ''}" data-id="${esc(p.id)}">${esc(p.name)}</button>`).join(''));
    $h.find('.na_pstar i').attr('class', cur.fav ? 'fa-solid fa-star' : 'fa-regular fa-star');
    $h.find('.na_pstar').toggleClass('active', !!cur.fav);
    $h.find('.na_pdel, .na_pren').prop('disabled', BUILTIN_PROMPTS.has(cur.id));
    $h.find('.na_prompt_reset').toggle(!!BUILTIN_TEXT[cur.id] && cur.text !== BUILTIN_TEXT[cur.id]());
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
          <button type="button" class="na_linkbtn na_prompt_reset">처음 모양으로 되돌리기</button>
        </div>`);
    $('#na_opt_hidden').on('change', function () { g().skipHidden = this.checked; saveGlobal(); });
    $('#na_opt_tags').on('change', function () { g().stripTags = this.checked; saveGlobal(); });
    $('#na_quick_auto').on('change', function () { g().quickAuto = this.checked; saveGlobal(); });
    $('#na_nudge').on('change', function () { g().compressNudge = Number(this.value) || 0; saveGlobal(); });
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
        if (BUILTIN_PROMPTS.has(p.id)) return;
        const name = await askName('이름 바꾸기', p.name);
        if (!name) return;
        p.name = name; saveGlobal(); renderPromptSettings();
    });
    $h.find('.na_pdel').on('click', async () => {
        const p = activePrompt(g());
        if (BUILTIN_PROMPTS.has(p.id)) return;
        if (!await confirm('지시문 삭제', `"${esc(p.name)}"을(를) 지울까요? 되돌릴 수 없어요.`)) return;
        g().prompts = g().prompts.filter(x => x.id !== p.id);
        pick(g().prompts[0].id);
    });
    $h.find('.na_prompt_ta').on('input', function () { activePrompt(g()).text = this.value; saveGlobal(); });
    $h.find('.na_prompt_reset').on('click', () => {
        const p = activePrompt(g());
        if (!BUILTIN_PROMPTS.has(p.id)) return;
        p.text = BUILTIN_TEXT[p.id](); $h.find('.na_prompt_ta').val(p.text).data('pid', null); saveGlobal(); renderPromptSettings();
    });
    $('#na_cmp_settings').on('toggle', function () { if (this.open) renderPromptSettings(); });
    renderPromptSettings();
}
