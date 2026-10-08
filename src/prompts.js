// Compression instructions (prompt library) and their settings.

import { ctx, globalSettings, newId, saveGlobal } from './core.js';
import { showStripInfo } from './extract.js';
import { lastRangedSection } from './sections.js';
import { confirm, esc } from './util.js';

export const BASIC_PROMPT = `You continue the long-term-memory summary (the archive) of a long-running role-play. The archive goes into the prompt and is read alongside the live chat as "a snapshot of the past." Read the raw log #{{from}}–#{{to}} below in full, from the first message to the last, then write the new stretch that follows the existing archive.

# Output
Output exactly the following, in this order, with no greeting, explanation or commentary. Use the existing archive's language and format — even when the raw log is in another language. Translate dialogue into the archive's language; keep a word or line in its original language only where the archive already does.
1. The new stretch blocks
   - Header: \`## #start–#end — Title (date, place)\`, then \`PLOT:\`, then \`- \` bullets. If the existing archive puts a prefix before the numbers, follow it.
   - A section is a chapter, not a beat. Cut only where something turns: a relationship shifts, the situation changes, a secret comes out, a decision is made. Fold routine stretches and small beats into the section they belong to.
   - Length follows weight: a turning point may get a short section of its own; a stretch where little changes shares one section. As a rough guide, one section covers 20–60 messages.
   - Titles read like a book's table of contents: short and concrete — they name the scene, they do not summarize it. No semicolons, no "X does this; Y does that." Vary the shape; do not start every title with "The":
     · a place or object: The broken plank · Varo's market
     · two things joined: The bridge, the debt · Bread, and the oath he broke
     · one short plain sentence: Mara keeps the knife · The road closes
     · a "what" clause: What Ren didn't say
     · a number or pairing: One cloak · The two of them · The second night
     · a list: Ivo, the duke, and the toll
     · a line in quotation marks, copied exactly: "Now you owe me"
     ✗ Ren crosses the bridge; Mara pulls him up · Confrontation over Ren's injury
   - Numbers are always message numbers. The blocks must run continuously from #{{from}} to #{{to}}, with no gaps and no overlaps. The last block must end at #{{to}}.
2. A line containing only \`---\`
3. If the existing archive has \`# STATE AT …\` / \`# OPEN AT …\`: both, complete, rewritten from [CURRENT STATE · OPEN] below so they hold as of #{{to}}. If it has none, leave this part out.

## Hard limits on output
- Output ONLY new material. Never reproduce, rewrite, shorten, "improve" or continue any existing section of the archive. The [FORMAT REFERENCE] block below is shown only so you can match its style; it is already in the archive and must not appear in your output in any form.
- Every output must be complete. All parts must be present, and the final bullet of every block must end in a full sentence. If you are running long, merge bullets or cut lower-priority detail. Never stop mid-sentence, and never drop STATE or OPEN to make room.

# Handling the raw log
- The log format is \`[N] Name:\`. When one bot plays several characters (NPCs included), they all carry its tag; identify the speaker from the content.
- Not content: planning or instruction blocks inserted by a preset, status windows and trackers (take only the date and place from them), and meta talk. Rules or banned-word lists inside them are directions to the bot, not canon.
- A private-thought tag holds that character's thoughts, not spoken lines.
- Turns the user wrote themselves are the strongest canon. Ignore any part where the bot writes the user character's inner thoughts.
- Bot errors (contradictions with earlier messages) do not become canon. Before stating that something exists or does not exist, confirm it in the raw log.
- Quotes must be lines that actually appear in the raw log (translated when the log is in another language). Never invent or paraphrase a line and present it as a quote.

# Core principles
- Being in the raw log is not a reason to include something. Ask of every line: "If the bot read only the archive and then wrote the next scene, would something go wrong or feel unmotivated without this line?"
- A character's interpretation is written only as theirs, never as fact: "In her own reckoning, …", "(his reading, not fact)".
- Cut: movement and positioning, gestures, props, scenery. Anxiety or agitation gets one word.
- Keep:
  - chains of cause and effect
  - lines that change a relationship
  - questions together with the answers they got (an answer alone reads as unmotivated)
  - what a character chose NOT to do (evidence of restraint)
  - the concrete action that shows a standing trait at work
- Cutting so hard that the story breaks is also a failure. Do not shrink the core of a trigger or an arc. The goal is not to erase the story but to absorb it into cause and effect. Do not list dialogue.

# Protecting causality
- Before every emotional reaction, keep the other person's action that caused it. Without it, the character appears to erupt on their own or seems childish.
- Before every realization or decision, keep the trigger that made it possible. Cut the process and the character "suddenly understands."
- Write felt experience as felt experience. Do not turn what a character felt into the narrator's verdict. ("Trapped" ✗ → "Feeling trapped" ✓)
- Preserve both sides' responsibility. Do not erase one side's fault because of the other side's hurt, in either direction.
- Be careful with absolutes such as "never" and "not once." They make a character read as cold or indifferent.
- Do not say the same thing twice. When you add a sentence, check the bullets before and after it for the same content.
- Keep the raw log's order. Do not pull a later event (when someone remembered or noticed something) into an earlier bullet.
- No exaggeration beyond the raw log.

# Stretch blocks
- Bullets only, no paragraphs. One bullet = one event; to shorten, merge bullets.
- No interpretation, theme or summary-verdict sentences.
- Dialogue only when it changes a relationship or defines a character — usually one line in a bullet, at most two; tell the rest in your own words. Inside quotation marks, stay faithful to the raw log, including whether it is a question; if the original is a statement, do not add a question mark.
- Never leave a quote standing alone. Attach the character's reaction to it.
- Dates and places in headers come from the tracker and narration. A tracker date that does not fit (a season that does not match the month, a date that goes backward) is a model error; ignore it. If a large time skip happens without a record, note it in the header (e.g. "some five months later").
- Sex is recorded only as relationship beats: how consent moved, requests to stop, whether it was a first, and what changed afterward. No description of acts, positions, anatomy or sensations, even if the user's own turn describes them. However many messages a sex scene runs, it takes one bullet — at most two when the relationship turns in it — and never a section of its own unless something outside the act happens there too.
- Crises, suicide attempts and self-harm are recorded plainly and factually, without blurring.
- When one of this RP's recurring devices returns (a phrase, an object, a song, a name, a ritual), do not miss it: keep the event and the line in which it was used. Do not explain the device.

# STATE (when present)
- Edit [CURRENT STATE · OPEN]; never write STATE from scratch. Every existing line stays word for word unless this stretch changes it — then edit that line where it stands. Never drop a line to save space, never merge lines, never rename, reorder or remove a "##" heading. New facts go in as new lines under the heading they belong to. What a character realized or resolved not to do stays until the story itself overturns it.
- Per character + relationships + current life. Notice line: \`_True at #{{to}}; where the live chat differs, the live chat is correct. A character's reading marked as such is not canon._\`
- Do not restate events already in the stretch blocks; record only changes and tendencies that PLOT alone does not capture, briefly. One line for a core principle the bot is likely to confuse is allowed.
- Keep safety lines that lock the current state (e.g. "memories fully restored since #n" — it stops the bot from mistaking an old arc for the present).
- Do not leave an old behavior in present tense if a later arc changed it. If something changed in this stretch, edit the existing line.
- Scope principles narrowly to prevent over-application. ("no commands" ✗, which could change even how he talks → "no longer dictates her choices or movements" ✓)
- Use "tends to" or "since #n" instead of "now" or "currently."

# OPEN (when present)
- Keep it short. Remove only the threads this stretch closes; every other thread stays word for word, under its group. Add newly opened ones. Do not prescribe future actions.
- Notice line: \`_Unresolved at #{{to}}; check recent messages before treating any as pending._\`

[FORMAT REFERENCE — the archive's last PLOT block. Style reference only. Do not output, rewrite or continue it.]
{{last_section}}

[CURRENT STATE · OPEN — rewrite this and output it in full]
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
export const OLD_BASIC_HASHES = new Set(['5uaca5', '1gtzaod', 'ztrqbn', '1u7aqka', '1nz5q9e', 'rlhw7z', 'cqcpi1', '12lkzac', '1gzouls', 'x3kmxl', '1269olm']); // earlier built-in basics, upgraded when untouched
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
export const compressPrompt = (tpl, vars, m, memo = '') => auBlock(m) + fillPrompt(tpl, vars) + memoBlock(memo);

// An AU answer that forgot its prefix or divider gets them: "## #12–#30" → "## AU #12–#30",
// "# STATE AT #30" → "# STATE AT AU #30", and "# ── AU ──" above the first new section.
export function auFix(text, m) {
    const a = auOf(m);
    if (!a.on) return text;
    let out = String(text || '')
        .replace(/^(##\s+)#(\d+\s*[–—~-]\s*#?\d+)/gm, `$1${a.name} #$2`)
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
