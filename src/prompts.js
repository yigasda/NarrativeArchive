// Compression instructions (prompt library) and their settings.

import { ctx, globalSettings, newId, saveGlobal } from './core.js';
import { showStripInfo } from './extract.js';
import { RANGE_HEAD, lastRangedSection, parseSections } from './sections.js';
import { confirm, esc } from './util.js';

export const BASIC_PROMPT = `You continue the long-term-memory summary (the archive) of a long-running role-play. The archive is injected into the prompt and read alongside the live chat as "a snapshot of the past." Read the raw log #{{from}}–#{{to}} below in full, from the first message to the last, then write the new stretch that follows the archive.

# 1. Output
Output exactly these parts, in this order, with no greeting, explanation or commentary:
1. The new section blocks, covering #{{from}}–#{{to}} continuously: no gaps, no overlaps, the first heading starting at #{{from}} and the last block ending at #{{to}}. Numbers are always message numbers.
2. A line containing only \`---\`
3. If the archive has \`# STATE AT …\` / \`# OPEN AT …\`: both, complete, edited from [CURRENT STATE · OPEN] so they hold as of #{{to}} (rules in 8 and 9). If it has none, leave this part out.

Language: write everything in the archive's language and format, even when the raw log is in another language. Translate dialogue too; keep a word or line in its original language only where the archive already does.

Hard limits:
- Output only new material. Never reproduce, rewrite, shorten, "improve", recap or continue anything already in the archive; nothing before #{{from}} belongs in your output. [RECENT SECTIONS] below is context and style only: no event, line or detail from it may appear in your output unless the raw log shows it happening again.
- Every part must be present and complete, and the last bullet of every block ends in a full sentence. If you run long, merge bullets or cut lower-priority detail — never stop mid-sentence, and never drop STATE or OPEN to make room.

# 2. Reading the raw log
- The format is \`[N] Name:\`. When one bot plays several characters (NPCs included), they all carry its tag; tell the speaker from the content.
- Not content: planning or instruction blocks inserted by a preset, status windows and trackers (take only the date and place from them), and meta talk. Rules or banned-word lists inside them are directions to the bot, not canon.
- A private-thought tag holds that character's thoughts, not spoken lines.
- Turns the user wrote themselves are the strongest canon. Ignore any part where the bot writes the user character's inner thoughts.
- Bot errors (contradictions with earlier messages) are not canon. Before stating that something exists or does not exist, confirm it in the raw log.
- Everything you write comes from the raw log. [RECENT SECTIONS] and STATE only tell you what is already known.

# 3. What to keep
You are writing a memory, not a transcript. The bot that reads the archive needs to know what happened, why, and what it changed — not who said what in which order.
- Test every line: "If the bot read only the archive and then wrote the next scene, would something go wrong or feel unmotivated without this line?" Being in the raw log is not a reason to include something.
- Keep:
  - chains of cause and effect
  - lines that change a relationship
  - what a character chose NOT to do (evidence of restraint)
  - the concrete action that shows a standing trait at work
  - a question together with its answer, when the answer matters later (an answer alone reads as unmotivated)
- Cut: movement and positioning, gestures, props, scenery, temperatures and staging. Anxiety or agitation gets one word.
- Judge weight against [RECENT SECTIONS] and STATE: a beat that repeats an established pattern gets a clause at most; a beat that breaks or turns a pattern gets the space.
- Cutting so hard that the story breaks is also a failure. Do not shrink the core of a trigger or an arc. The goal is not to erase the story but to absorb it into cause and effect.

# 4. Protecting causality
- Before every emotional reaction, keep the other person's action that caused it. Without it, the character appears to erupt on their own or seems childish.
- Before every realization or decision, keep the trigger that made it possible. Cut the process and the character "suddenly understands."
- Write felt experience as felt experience. Do not turn what a character felt into the narrator's verdict. ("Trapped" ✗ → "Feeling trapped" ✓)
- Preserve both sides' responsibility. Do not erase one side's fault because of the other side's hurt, in either direction.
- Be careful with absolutes such as "never" and "not once." They make a character read as cold or indifferent.
- Keep the raw log's order. Do not pull a later event (when someone remembered or noticed something) into an earlier bullet.
- No exaggeration beyond the raw log.

# 5. Writing the sections
Sections
- A section is a chapter, not a beat. Cut only where something turns: a relationship shifts, the situation changes, a secret comes out, a decision is made. Fold routine stretches and small beats into the section they belong to.
- Length follows weight: a turning point may get a short section of its own; a stretch where little changes shares one section. As a rough guide, one section covers 20–60 messages.
- Header: \`## #start–#end — Title (date, place)\`, then \`PLOT:\`, then \`- \` bullets. If the archive puts a prefix before the numbers, follow it.
- The date and place come from the tracker and narration. A tracker date that does not fit (a season that does not match the month, a date that goes backward) is a model error; ignore it. If a large time skip happens without a record, note it in the header (e.g. "some five months later").

Bullets
- Bullets only, no paragraphs. One bullet = one turn of the scene: what happened, what caused it, and what it changed. A bullet may cover many messages; never write one bullet per message.
- A section has 3–6 bullets, whatever its message count — never more than 6. It rarely needs more than about 250 words. If a stretch truly needs more, it is two chapters: split it where it turns.
- Do not report or list a conversation turn by turn ("He asked… She replied… He added…"). Collapse an exchange into what it revealed, decided or broke.
- Do not say the same thing twice. When you add a sentence, check the bullets before and after it for the same content.

Dialogue
- Quote a line only when it changes a relationship or defines a character — usually one in a bullet, at most two; tell the rest in your own words.
- A quote is a line that actually appears in the raw log (translated when the log is in another language), faithful to the original, including whether it is a question: if the original is a statement, do not add a question mark. Never invent or paraphrase a line and present it as a quote.
- Never leave a quote standing alone. Attach the character's reaction to it.

Interpretation
- No interpretation, theme or summary-verdict sentences. A character's interpretation is written only as theirs, never as fact: "In her own reckoning, …", "(his reading, not fact)".

Special content
- Sex is recorded only as relationship beats: how consent moved, requests to stop, whether it was a first, and what changed afterward. No description of acts, positions, anatomy or sensations, even if the user's own turn describes them. Length follows what changed, not how long the scene ran: a long scene in which little turns gets a bullet or two; one in which trust, a boundary or a confession shifts keeps each of those beats.
- Crises, suicide attempts and self-harm are recorded plainly and factually, without blurring.
- When one of this RP's recurring devices returns (a phrase, an object, a song, a name, a ritual), do not miss it: keep the event and the line in which it was used. Do not explain the device.

Titles
- Titles read like a book's table of contents: short and concrete — they name the scene, they do not summarize it. No semicolons, no "X does this; Y does that." Vary the shape; do not start every title with "The":
  · a place or object: The broken plank · Varo's market
  · two things joined: The bridge, the debt · Bread, and the oath he broke
  · one short plain sentence: Mara keeps the knife · The road closes
  · a "what" clause: What Ren didn't say
  · a number or pairing: One cloak · The two of them · The second night
  · a list: Ivo, the duke, and the toll
  · a line in quotation marks, in the archive's language (translate it like any quote): "Now you owe me"
  ✗ Ren crosses the bridge; Mara pulls him up · Confrontation over Ren's injury

# 6. Example of the difference
✗ Turn-by-turn (what to avoid):
- Mara knocked on Ren's door and stood silently in the doorway.
- Ren asked why she had come back if she had said she was leaving.
- Mara said she didn't know.
- Ren let her in and made tea.
- Ren told her the north road was closed.
- Mara said she would wait.

✓ Memory (what to write):
- Mara came back the same night she had sworn to leave, unable to say why. Ren let her in without pressing and told her the north road was closed; she said she would wait, and stayed.

# 7. Before you output
Draft the stretch, then revise it once:
1. Delete every bullet whose loss would not make the next scene go wrong or feel unmotivated.
2. Merge bullets that share one cause or one outcome.
3. Cut gestures, positions, props, temperatures and staging that survived the draft.
4. Check that every quote is a line from the raw log and that each one earns its place.
5. Count each section's bullets. More than 6: merge the ones that share a cause or outcome, or split the section where it turns.
Output only the revised version.

# 8. STATE (when present)
- Edit [CURRENT STATE · OPEN]; never write STATE from scratch. Every existing line stays word for word unless this stretch changes it — then edit that line where it stands, so an old behavior a later arc changed does not stay in the present tense. Never drop a line to save space, never merge lines, never rename, reorder or remove a "##" heading. New facts go in as new lines under the heading they belong to.
- What a character realized or resolved not to do stays until the story itself overturns it. Keep safety lines that lock the current state (e.g. "memories fully restored since #n" — it stops the bot from mistaking an old arc for the present).
- Content: per character + relationships + current life — only the changes and tendencies that PLOT alone does not capture, briefly; do not restate events already in the sections. One line for a core principle the bot is likely to confuse is allowed.
- Scope principles narrowly to prevent over-application. ("no commands" ✗, which could change even how he talks → "no longer dictates her choices or movements" ✓) Use "tends to" or "since #n" instead of "now" or "currently."
- Notice line: \`_True at #{{to}}; where the live chat differs, the live chat is correct. A character's reading marked as such is not canon._\`

# 9. OPEN (when present)
- Keep it short. Remove only the threads this stretch closes; every other thread stays word for word, under its group. Add newly opened ones. Do not prescribe future actions.
- Notice line: \`_Unresolved at #{{to}}; check recent messages before treating any as pending._\`

[RECENT SECTIONS — the archive's last sections before this stretch, for context and style only. Already in the archive: do not output, rewrite, recap or continue them.]
{{recent}}

[CURRENT STATE · OPEN — edit this and output it in full]
{{state}}

[RAW LOG #{{from}}–#{{to}}]
{{raw}}`;
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
export const OLD_BASIC_HASHES = new Set(['5uaca5', '1gtzaod', 'ztrqbn', '1u7aqka', '1nz5q9e', 'rlhw7z', 'cqcpi1', '12lkzac', '1gzouls', 'x3kmxl', '1269olm', 'l3h9zy', '124875u', 'zbr8fw', '189egig', '5wzwes']); // earlier built-in basics, upgraded when untouched
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
- The raw log below is the AU. Summarize only it; do not retell the main story.
- The AU is its own log in the archive: number its sections "## ${a.name} #from–#to — title" (prefix "${a.name}", this chat's message numbers).${first ? `
- This is the AU's first summary: put the line "${auDivider(a.name)}" above your first new section.` : ''}
- STATE and OPEN headings use the AU's numbers: "# STATE AT ${a.name} #to", "# OPEN AT ${a.name} #to".${first ? ` This first time, turn the main story's STATE into the AU's: keep every line that still holds in the AU word for word (memories, feelings, promises, secrets, what a character realized or resolved not to do), and change or drop only what the AU premise makes untrue.` : ` Edit the current STATE and OPEN as the instruction says; they are already the AU's.`}

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
// {{recent}}: the archive's last few numbered sections, for context without the whole archive (which models copy from)
export function recentSections(text, n = 3) {
    const t = String(text || '');
    const secs = parseSections(t).filter(x => !x.group && RANGE_HEAD.test(x.title)).slice(-n);
    return secs.length ? secs.map(x => t.slice(x.start, x.end).replace(/(?:\s*\n-{3,}[ \t]*)?\s*$/, '')).join('\n\n') : '(없음)';
}
// How big the answer should be, as numbers: sections for this many messages, and, when a long stretch goes in parts,
// that every length target (the user's note included) is for the whole stretch, so each part takes its share
export function sizeBlock({ k = 0, n = 1, count, total = count, from, to, partFrom = from, partTo = to }) {
    const lo = Math.max(1, Math.ceil(count / 60)), hi = Math.max(lo, Math.ceil(count / 25));
    const span = lo === hi ? `about ${lo} section${lo > 1 ? 's' : ''}` : `${lo}–${hi} sections`;
    if (n <= 1) return `\n\n[SIZE] #${from}–#${to} is ${count} messages: write ${span} for it, not more.`;
    return `\n\n[PART ${k + 1} OF ${n}] The stretch #${from}–#${to} (${total} messages) is too long for one request, so it is sent in ${n} parts, in order. This request is part ${k + 1}: #${partFrom}–#${partTo} (${count} messages). Every length target — the section guide above and any number in the user's note — is for the whole stretch, not for this part: this part gets about 1/${n} of it. For these ${count} messages write ${span}, not more.`;
}
export const compressPrompt = (tpl, vars, m, memo = '', size = '') => auBlock(m) + fillPrompt(tpl, { recent: recentSections(vars.archive ?? m.text), ...vars }) + memoBlock(memo) + size + langBlock(m.text);

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
