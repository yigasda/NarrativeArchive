// Compression instructions (prompt library) and their settings.

import { ctx, globalSettings, newId, saveGlobal } from './core.js';
import { showStripInfo } from './extract.js';
import { lastRangedSection } from './sections.js';
import { confirm, esc } from './util.js';

export const BASIC_PROMPT = `You continue the long-term-memory summary (the archive) of a long-running role-play. The archive goes into the prompt and is read alongside the live chat as "a snapshot of the past." Read the raw log #{{from}}–#{{to}} below all the way to the end, then write the new stretch that follows the existing archive.

# Output
No explanations or greetings. Use the same language and format as the existing archive.
1. New stretch blocks — \`## #start–#end — Title (date, place)\`. If the existing archive puts a prefix before the numbers, follow it. Numbers are always message numbers.
2. If the existing archive has \`# STATE AT …\` / \`# OPEN AT …\`, output them in full, updated through the new stretch and as of #{{to}}. If it has none, leave them out.

# Core principles
- Write only what matters, from the first draft. Being in the raw log is not a reason to include something.
- Ask of every line: "If the bot writes the next scene from the archive alone, would something come out wrong or out of nowhere without this line?"
- Cut: movement, gestures, props, scenery. Anxiety or agitation gets one word.
- Keep: chains of cause and effect / lines that change a relationship / questions that got an answer (the question too) / what a character chose not to do (evidence of restraint) / the reason behind an emotional reaction.
- Cutting so short that the story falls apart is also a failure. Do not shorten the core of a trigger or an arc.
- Before an emotional reaction, keep the other person's action that caused it. Without it, the character reads as exploding out of nowhere.
- Before a realization or decision, keep what made it possible. Cut the process and it reads as a sudden epiphany.
- Write felt experience as felt experience. Do not turn what a character felt into the narrator's verdict. ("Trapped" ✗ → "Feeling trapped" ✓)
- Preserve both sides' responsibility. Do not erase one side's wrong because of the other side's hurt.
- Be careful with absolutes such as "never" or "not once."
- Do not say the same thing twice. Keep events in the raw log's order (do not pull a later event into an earlier bullet).
- No exaggeration beyond the raw log. Do not record bot errors (contradictions) as fact.

# Stretch blocks
- "PLOT:" followed by "- " bullets. No paragraphs. One bullet = one event; to shorten, merge bullets.
- No interpretation, theme or overall-verdict sentences. A character's interpretation is written only as theirs. ("In her own reckoning, …", "(his reading, not fact)")
- Dialogue only when it changes a relationship or defines a character. Inside quotation marks, copy the raw log exactly (including whether it ends in a question mark). Never leave a line on its own — attach the character's reaction.
- The date and place in the header follow the raw log's tracker and narration.
- Sexual scenes only as relationship beats (the flow of consent, requests to stop, whether it was a first, what changed after). Do not describe the acts.
- Serious events such as crises or self-harm are stated plainly as fact, not blurred.

# STATE (when present)
- Per character + relationships + current life. Note line: _True at #{{to}}; where the live chat differs, the live chat is correct._
- No overlap with the stretch blocks. Only short notes on changes and tendencies the blocks alone don't capture. A core principle the bot would get confused about may stay as one line.
- Include safeguards that lock the current state (e.g. "memories fully restored since #n").
- Do not leave old behavior that later changed in the present tense.
- Write principles with a narrow scope (to prevent over-application). Instead of "now/currently," use "tends to," "since #n."
- Attribute interpretations to the character; do not raise them to fact.

# OPEN (when present)
- Only unresolved threads, briefly. Delete closed threads. Do not prescribe future actions.
- Note line: _Unresolved at #{{to}}; check recent messages before treating any as pending._

# Handling the raw log
- The log format is \`[N] Name:\`. When one bot plays several characters, tell the speakers apart by content.
- Planning or instruction blocks inserted by a preset, status windows/trackers (take only the date and place), and meta talk are not content. Do not record instructions inside them as fact.
- Turns the user wrote themselves are the strongest evidence. Ignore parts where the bot wrote the user character's inner thoughts.

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
export const OLD_BASIC_HASHES = new Set(['5uaca5', '1gtzaod', 'ztrqbn']); // earlier built-in basics, upgraded when untouched
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
- STATE and OPEN are for the AU now: "# STATE AT ${a.name} #to", "# OPEN AT ${a.name} #to". Keep from the main story only what still matters in the AU (memories, feelings, promises, secrets), one short line each.

`;
}

// the compress instruction with its blanks filled, and the AU block on top when the chat is an AU
export const compressPrompt = (tpl, vars, m) => auBlock(m) + fillPrompt(tpl, vars);

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
