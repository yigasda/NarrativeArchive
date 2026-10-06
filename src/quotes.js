// Quote bank and voice fingerprints.

import { aiLabel, askAI, withSpinner } from './ai.js';
import { ctx, getMeta, saveMeta } from './core.js';
import { applyInjection, extraBlocks } from './inject.js';
import { KW_STOP } from './keywords.js';
import { currentCast, inCast } from './knowledge.js';
import { syncPanel } from './panel.js';
import { faceHtml } from './people.js';
import { mountSectionPicker } from './picker.js';
import { parseSections, sectionKey } from './sections.js';
import { SVG_B, svgB } from './theme.js';
import { confirm, countTokens, esc, fmt } from './util.js';

// who says the quote that follows `before`: "Name:" → Name; "Name said/told …" → Name;
// "He told Name" → the first name earlier on the line (not the one being spoken to); else the nearest name
export const SPEECH = 'said|says|told|tells|asked|asks|answered|replied|whispered|murmured|snapped|added|called|warned|admitted|insisted|thought|wrote';
export function guessSpeaker(before, names) {
    const isName = w => names.has(w) && !KW_STOP.has(w);
    const colon = before.match(/([A-Z][a-z][A-Za-z'’]*)['’]?s?\s*:\s*$/);
    if (colon && isName(colon[1])) return colon[1];
    const verbs = [...before.matchAll(new RegExp(`\\b([A-Z][a-z][A-Za-z'’]*)\\s+(?:\\w+ly\\s+)?(?:${SPEECH})\\b`, 'g'))];
    const lastVerb = verbs[verbs.length - 1];
    if (lastVerb && isName(lastVerb[1])) return lastVerb[1];
    const all = [...before.matchAll(/\b([A-Z][a-z][A-Za-z'’]*)\b/g)].map(x => x[1].replace(/['’]s$/, '')).filter(isName);
    if (lastVerb && /^(He|She|They|It)$/.test(lastVerb[1])) {
        const head = before.slice(0, lastVerb.index);
        const earlier = [...head.matchAll(/\b([A-Z][a-z][A-Za-z'’]*)\b/g)].map(x => x[1].replace(/['’]s$/, '')).filter(isName);
        if (earlier.length) return earlier[earlier.length - 1];
    }
    return all.length ? all[all.length - 1] : '?';
}

// quoted lines in the archive with a guessed speaker
export function archiveQuotes(m) {
    const names = new Set([...m.text.matchAll(/[a-z,;]\s+([A-Z][a-z][A-Za-z'’]*)/g)].map(x => x[1].replace(/['’]s$/, '')));
    const out = [];
    const secs = parseSections(m.text).filter(x => !x.group);
    for (const s of secs) {
        const body = m.text.slice(s.start, s.end);
        for (const line of body.split('\n')) {
            for (const mt of line.matchAll(/["“]([^"“”]{15,400})["”]/g)) {
                out.push({ who: guessSpeaker(line.slice(0, mt.index), names), text: mt[1].trim(), src: s.title });
            }
        }
    }
    const seen = new Set();
    return out.filter(q => !seen.has(q.text) && seen.add(q.text));
}

// characters the user never wants in the bank (e.g. their own persona)
export const quoteExcluded = m => new Set((Array.isArray(m.quoteExclude) ? m.quoteExclude : []).map(x => String(x).toLowerCase()));
export const isExcluded = (m, who) => quoteExcluded(m).has(String(who).toLowerCase());

// ticked lines, up to N per speaker, only for people in the story now (an absent character's voice is wasted tokens)

export const AI_SYS_QUOTES = `GOAL
Collect VOICE SAMPLES for a role-play: lines in quotation marks that show HOW a character talks (their rhythm, word choice, attitude).
The user will pick from your list, so list every good one. Do not cut the list short.

YOU GET
SECTIONS of a story archive, written in the third person. Lines people said are inside quotation marks.

STEP 1. Read every section, all the way to the last one. Do not stop early.

STEP 2. For each quoted line, find who SAID it. Be careful, the archive is third person:
- The speaker is the one doing the speaking verb (said, told, asked, answered, whispered, swore, warned, thought…), NOT the person spoken to.
    "Ivo told Ren, \"…\"" → Ivo
    "Ren asked him, \"…\"" → Ren
- "she" / "he" / "they": look at the sentences around it to find who that is.
    "Mara turned to Ivo. She said, \"…\"" → Mara
- A name followed by a colon owns the line after it.
    "Ren: \"…\"" → Ren
- One bullet can quote two different people. Decide for each quote separately.
    "Ivo refused, \"…\"; Ren laughed, \"…\"" → first Ivo, second Ren
- A line someone repeats, reads out, or remembers from another person belongs to the person who first said it, and only if the archive makes that clear.
- If you cannot tell who said it, skip it. Never guess.

STEP 3. Keep only lines that are good voice samples. If SKIP THESE SPEAKERS is given, leave out every line by those speakers.
KEEP: lines that sound like that person and still make sense on their own.
SKIP:
- one- or two-word lines ("Yes." "Go.")
- lines that only explain the plot
- lines that make no sense without the scene around them
- labels, titles, names of places or things in quotation marks (those are not speech)

STEP 4. Copy each kept line EXACTLY as written in the archive: same words, same punctuation. Leave out the quotation marks. Never write new lines or fix the wording.

OUTPUT: nothing else, one line each, exactly like this
<speaker> | <the line>
Example:
Ivo | You can hate me tomorrow. Tonight you eat.
Ren | I'm not afraid of you, I'm afraid of the quiet.
Use the archive's own spelling of names. If there are no good lines, write exactly: none`;

// normalise a quote for matching against the archive
export const quoteKey = t => String(t).replace(/[“”„"]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

// ---- voice fingerprint: a few speech rules per character, drawn from that character's lines in the quote bank
export const AI_SYS_VOICE = `GOAL
Write a speech guide for one character: 4 to 7 rules that let another writer make NEW lines sound like this character.
Use only the LINES you are given.

YOU GET
- NAME: the character.
- LINES: things this character said in the story, one per line.

STEPS
1. Read all the LINES. Look for habits that show up in at least 2 lines. Check:
   sentence length and rhythm · how they address others (names, titles, pet names) · orders, questions or statements ·
   formal or casual · words, images or topics they come back to · humor · what they never say · how feelings leak out.
2. For each habit write ONE rule: a full English sentence saying what the character does when they talk.
   Concrete enough to imitate ("Answers questions with a question"), not a label ("Questions").
3. After the rule, add one short example copied word for word from the LINES, in parentheses and quotes.
   Leave the example out if no line fits.
4. Before the rule put one Korean tag in square brackets:
   길이 · 명령 · 질문 · 호칭 · 존댓말 · 반말 · 감정 · 유머 · 반복 · 말버릇 · 비유 · 조건 · 금기 · 침묵.
5. Drop rules any character could have ("speaks naturally", "shows emotion"). Keep the 4 to 7 strongest.

DO NOT
- No headings, numbering, bold, or labels such as "Pattern:", "Rule:", "Verb start:".
- No personality, looks or plot. Only how they speak.
- No catchphrases that are not in the LINES.

EXAMPLE
NAME: Ivo
LINES:
Sit. Eat. We talk after.
You think I'd let you walk there alone? Funny.
Mara. Look at me. Breathe.
I said I'd come back. I came back.
If you fall, I catch you. That's the deal.
Answer:
- [길이] Speaks in very short sentences, often two or three words. ("Sit. Eat.")
- [명령] Gives orders instead of asking. ("Mara. Look at me. Breathe.")
- [호칭] Says the other person's name alone before an important line. ("Mara. Look at me.")
- [유머] Hides worry behind dry one-word sarcasm. ("Funny.")
- [반복] Repeats his own words back to make a point. ("I said I'd come back. I came back.")
- [조건] States promises as plain if-then terms. ("If you fall, I catch you.")

OUTPUT
4 to 7 lines and nothing before or after them. Every line exactly like:
- [태그] Rule sentence. ("example")`;

// keeps the "- [태그] rule" lines; tolerates numbering, bold and "Pattern:"-style labels, drops a rule cut off mid-sentence
export function voiceRules(out) {
    const rules = String(out || '').split('\n').map(l => l.trim())
        .filter(l => /^([-*•]|\d+[.)])\s+\S/.test(l))
        .map(l => l.replace(/^([-*•]|\d+[.)])\s+/, '').replace(/\*\*/g, '').replace(/^(\[[^\]]{1,8}\]\s*)?(pattern|rule|habit|verb start|example)\s*:\s*/i, '$1').trim())
        .filter(l => l.replace(/^\[[^\]]*\]\s*/, '').length >= 12);
    const cut = l => { const q = (l.match(/["“”]/g) || []).length, open = (l.match(/\(/g) || []).length - (l.match(/\)/g) || []).length; return q % 2 === 1 || open > 0 || !/[.!?)"”'’。]$/.test(l); };
    if (rules.length && cut(rules[rules.length - 1])) rules.pop();
    return rules.map(l => `- ${l}`);
}

export async function makeVoice(m, who) {
    const lines = [...new Set((m.quotes || []).filter(q => q.who === who).map(q => q.text))].slice(0, 150);
    if (lines.length < 3) throw new Error(`${who}: 대사가 3개는 있어야 말투를 볼 수 있어요`);
    // room for models that think before answering (their thinking counts against the limit and cut the rules short)
    const ask = extra => askAI(`NAME: ${who}\n\nLINES:\n${lines.join('\n')}${extra}`, { system: AI_SYS_VOICE, maxTokens: 8000 });
    let rules = voiceRules(await ask(''));
    if (rules.length < 3) rules = voiceRules(await ask('\n\nYour last answer was cut off or not in the format. Answer again: 4 to 7 lines, each exactly "- [태그] Rule sentence. (\"example\")", nothing else.'));
    if (!rules.length) throw new Error(`${who}: 모델 답에서 규칙을 못 찾았어요. 다시 눌러 주세요`);
    m.voice = m.voice && typeof m.voice === 'object' ? m.voice : {};
    m.voice[who] = { text: rules.slice(0, 8).join('\n'), n: lines.length, at: Date.now() };
}

export async function openQuotes() {
    const c = ctx();
    const m = getMeta();
    m.quotes = Array.isArray(m.quotes) ? m.quotes : [];
    const $root = $(`
      <div class="na_popup na_v2 na_qb_root" aria-label="대사 은행">
        <div class="na_v2_tabs na_qb_tabs" role="tablist"><button type="button" data-p="quotes" class="on">대사 <span class="na_qb_nq"></span></button><button type="button" data-p="voice">말투 지문 <span class="na_qb_nv"></span></button></div>
        <div class="na_qb_pane" data-pane="voice" hidden><div class="na_v2 na_vc_body"></div></div>
        <div class="na_qb_pane na_v2 na_qb2" data-pane="quotes">
        <div class="na_v2_row2">
          <button type="button" class="na_v2_btn primary na_qb_ai" title="AI가 고른 섹션을 읽고 인물별 대사를 모아요">AI로 모으기</button>
          <button type="button" class="na_v2_btn na_qb_find" title="아카이브의 따옴표 대사를 AI 없이 모아요">아카이브에서 모으기</button>
        </div>
        <div class="na_qb_pickhost"></div>
        <div class="na_search_wrap na_qb2_search">${svgB(SVG_B.mag, 16)}<input type="search" class="text_pole na_search na_qb_q" placeholder="인물 · 대사로 찾기"></div>
        <div class="na_qb_excl">
          <span class="na_qb_excl_label">빼는 인물</span>
          <span class="na_qb_excl_chips"></span>
          <button type="button" class="na_qb_excl_plus" title="대사를 모으거나 주입하지 않을 인물">+ 추가</button>
          <input type="text" class="text_pole na_qb_excl_in" placeholder="이름" enterkeyhint="done" hidden>
          <button type="button" class="na_v2_pillbtn na_qb_excl_add" hidden>추가</button>
        </div>
        <div class="na_qb_list"></div>
        <button type="button" class="na_linkbtn na_danger na_qb_clear">${svgB(SVG_B.trash, 13)} 모은 대사 전체 삭제</button>
        </div>
      </div>`);
    // ---- 말투 지문 pane: one open card, the rest as rows; characters with enough lines but no fingerprint as dashed rows
    let vOpen = null, vEdit = null;
    const parseRule = l => {
        let t = l.replace(/^[-*•]\s*/, '').trim();
        const tag = (t.match(/^\[([^\]\n]{1,10})\]\s*/) || [, ''])[1];
        t = t.replace(/^\[[^\]\n]{1,10}\]\s*/, '');
        const ex = t.match(/\s*\(\s*((?:["“][^"”]+["”][\s.,…]*)+)\)\s*\.?\s*$/);
        return { tag, rule: ex ? t.slice(0, ex.index).replace(/[\s,.]+$/, '') + '.' : t, ex: ex ? ex[1].trim() : '' };
    };
    const renderVoice = () => {
        const voice = m.voice && typeof m.voice === 'object' ? m.voice : {};
        const counts = new Map();
        for (const x of m.quotes) if (x.who && x.who !== '?' && !isExcluded(m, x.who)) counts.set(x.who, (counts.get(x.who) || 0) + 1);
        const whos = Object.keys(voice).sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
        const missing = [...counts].filter(([who, n]) => n >= 3 && !voice[who]).map(([who]) => who);
        vOpen = whos.includes(vOpen) ? vOpen : whos[0] || null;
        const $b = $root.find('.na_vc_body');
        // collapsed rows sit together in gap-6 groups, around the open card
        const rowsHtml = list => (list.length ? `<div class="na_vc_rows">${list.join('')}</div>` : '');
        const before = [], after = [];
        let card = '';
        whos.forEach(who => { const v = voice[who], n = counts.get(who) || 0, rules = String(v.text || '').split('\n').map(l => l.trim()).filter(Boolean);
            if (who !== vOpen) { (card ? after : before).push(`<button type="button" class="na_v2_card na_vc_row" data-who="${esc(who)}">${faceHtml(who, 32)}<span class="na_vc_who1">${esc(who)} <small>· 규칙 ${rules.length}개</small></span>${svgB(SVG_B.right, 16)}</button>`); return; }
            card = `
            <div class="na_v2_card na_vc_card" data-who="${esc(who)}">
              <div class="na_vc_head">${faceHtml(who, 40)}<span class="na_vc_who"><b>${esc(who)}</b><small>대사 ${v.n || '?'}개로 만듦${v.n && v.n !== Math.min(150, n) ? ` · 지금 ${n}개` : ''}</small></span><button type="button" class="na_v2_pillbtn na_vc_make" ${n >= 3 ? '' : 'disabled'}>${svgB(SVG_B.redo, 13)}다시</button></div>
              ${vEdit === who
                ? `<textarea class="text_pole na_vc_text" rows="${Math.min(10, rules.length + 2)}" spellcheck="false">${esc(v.text)}</textarea><small class="na_v2_note">한 줄에 규칙 하나 · 앞의 [태그]는 화면에만 보이고 주입할 땐 빠져요</small>`
                : `<div class="na_vc_rules">${rules.map(l => { const r = parseRule(l); return `<div class="na_vc_rule">${r.tag ? `<span class="na_vc_tag">${esc(r.tag)}</span>` : ''}<span><span>${esc(r.rule)}</span>${r.ex ? `<i>${esc(r.ex)}</i>` : ''}</span></div>`; }).join('')}</div>`}
              <div class="na_vc_foot"><button type="button" class="na_linkbtn na_vc_edit">${vEdit === who ? '그만 고치기' : '직접 고치기'}</button><button type="button" class="na_linkbtn na_danger na_vc_del">지우기</button></div>
            </div>`; });
        after.push(...missing.map(who => `<div class="na_v2_card na_vc_row dashed" data-who="${esc(who)}" title="대사 ${counts.get(who)}개">${faceHtml(who, 32)}<span class="na_vc_who1">${esc(who)} <small>· 아직 없음</small></span><button type="button" class="na_vc_make na_vc_mk">만들기</button></div>`));
        $b.html(`
          <label class="na_v2_card na_v2_switchrow"><span class="na_vc_sw"><b>조용히 주입</b><small>“본문에서 언급하지 말 것”을 붙여 보내요<span class="na_vc_tok"></span></small></span><input type="checkbox" class="na_toggle na_vc_inject" ${m.voiceInject ? 'checked' : ''}></label>
          ${rowsHtml(before)}${card}${rowsHtml(after)}
          ${!whos.length && !missing.length ? '<div class="na_empty">대사가 3개 이상인 인물이 없어요. "대사" 탭에서 먼저 대사를 모아 주세요.</div>' : ''}
          ${missing.length > 1 ? `<button type="button" class="na_v2_btn primary wide na_vc_all"><i class="fa-solid fa-fingerprint"></i> 없는 지문 ${missing.length}개 한꺼번에 만들기</button>` : ''}
          <small class="na_v2_foot">모은 대사로 인물마다 말버릇 규칙을 뽑아 조용히 주입해요 · AI 기능 모델(${esc(aiLabel())})이 그 인물 대사만 읽어요</small>`);
        const blk = extraBlocks({ ...m, knowInject: false, voiceInject: true });
        if (blk) countTokens(blk).then(t => $b.find('.na_vc_tok').text(` · 약 ${fmt(t)} 토큰`));
    };
    const render = () => {
        const q = $root.find('.na_qb_q').val().trim().toLowerCase();
        const by = new Map();
        m.quotes.forEach((x, i) => { if (q && !`${x.who} ${x.text}`.toLowerCase().includes(q)) return; if (!by.has(x.who)) by.set(x.who, []); by.get(x.who).push({ x, i }); });
        const cast = currentCast(m);
        $root.find('.na_qb_clear').prop('hidden', !m.quotes.length);
        const ex = Array.isArray(m.quoteExclude) ? m.quoteExclude : [];
        $root.find('.na_qb_excl_chips').html(ex.map(n => `<span class="na_pchip na_qb_exchip">${esc(n)}<button type="button" class="na_qb_unex" data-n="${esc(n)}" title="다시 모으기" aria-label="다시 넣기">×</button></span>`).join(''));
        $root.find('.na_qb_nq').text(m.quotes.length || '');
        $root.find('.na_qb_nv').text(Object.keys(m.voice || {}).length || '');
        renderVoice();
        const gbtns = (who, xs) => `<span class="na_qb_gbtns" data-who="${esc(who)}">
              ${who !== '?' ? `<button type="button" class="na_icon na_icon_sm na_qb_gexcl" title="이 인물 빼기 (대사 지우고 앞으로도 안 모음)" aria-label="이 인물 빼기">${svgB(SVG_B.userx, 15)}</button>` : ''}
              ${xs.length ? `<button type="button" class="na_icon na_icon_sm na_qb_gdel" title="이 인물 대사 모두 지우기" aria-label="이 인물 대사 모두 지우기">${svgB(SVG_B.trash, 15)}</button>` : ''}
            </span>`;
        const rows = xs => `<div class="na_qb_rows">${xs.map(({ x, i }) => `<div class="na_qb_row" data-i="${i}">
              <div class="na_qb_text"><span>“${esc(x.text)}”</span><div class="na_qb_src">${esc(String(x.src || '').slice(0, 50).replace(/\s+[—–]\s+/, ' · '))}</div></div>
              <input type="text" class="text_pole na_qb_whoin" value="${esc(x.who === '?' ? '' : x.who)}" placeholder="누구?" title="말한 사람">
              <button type="button" class="na_icon na_icon_sm na_qb_del" title="빼기" aria-label="빼기">${svgB(SVG_B.x, 13, 2.2)}</button>
            </div>`).join('')}</div>`;
        // unknown speaker: one dashed row; opens into the editable lines
        const unkOpen = qbUnkOpen || !!q;
        const group = ([who, xs]) => (who === '?' ? `
          <div class="na_qb_group na_qb_unknown${unkOpen ? ' open' : ''}">
            <div class="na_qb_unkrow" role="button" tabindex="0" aria-expanded="${unkOpen}"><span>말한 사람 모름 <b>${xs.length}</b>개 · ${unkOpen ? '누구인지 적어 주세요' : '눌러서 고쳐 주세요'}</span>${unkOpen ? gbtns(who, xs) : ''}${svgB(SVG_B.right, 15, 2.2, 'na_qb_unkchev')}</div>
            ${unkOpen ? rows(xs) : ''}</div>` : `
          <div class="na_qb_group ${!inCast(cast, who) ? 'na_qb_away' : ''}"><div class="na_qb_who">${faceHtml(who, 26)}<b>${esc(who)}</b><span class="na_qb_n">대사 ${xs.length}개</span>${!inCast(cast, who) ? '<span class="na_qb_awaytag" title="STATE의 인물 제목과 최근 섹션 4개에 안 나와요. 다시 나오면 말투 지문이 자동으로 들어가요">지금 안 나옴</span>' : ''}${m.voice?.[who] ? '<span class="na_qb_fp">지문 있음</span>' : ''}
            ${gbtns(who, xs)}</div>
            ${rows(xs)}</div>`);
        $root.find('.na_qb_list').html(by.size ? [...by].sort((a, b) => (a[0] === '?') - (b[0] === '?') || b[1].length - a[1].length).map(group).join('') : '<div class="na_empty">아직 없어요. "아카이브에서 모으기"를 눌러 보세요.</div>');
    };
    let qbUnkOpen = false;
    $root.on('click', '.na_qb_unkrow', function (e) { if ($(e.target).closest('.na_qb_gbtns').length) return; qbUnkOpen = !$(this).closest('.na_qb_group').hasClass('open'); render(); });
    $root.on('keydown', '.na_qb_unkrow', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $(this).trigger('click'); } });
    render();
    const save = async () => { await saveMeta(); applyInjection(); syncPanel(); render(); };
    $root.find('.na_qb_q').on('input', render);
    $root.on('click', '.na_qb_tabs button', function () {
        const p = this.dataset.p;
        $root.find('.na_qb_tabs button').each(function () { $(this).toggleClass('on', this.dataset.p === p); });
        $root.find('.na_qb_pane').each(function () { this.hidden = this.dataset.pane !== p; });
    });
    $root.on('change', '.na_vc_inject', async function () { m.voiceInject = this.checked; await save(); });
    $root.on('click', '.na_vc_row:not(.dashed)', function () { vOpen = String($(this).data('who')); vEdit = null; renderVoice(); });
    $root.on('click', '.na_vc_row.dashed', function (e) { if (!$(e.target).closest('.na_vc_make').length) $(this).find('.na_vc_make').trigger('click'); });
    $root.on('click', '.na_vc_edit', function () { const who = String($(this).closest('.na_vc_card').data('who')); vEdit = vEdit === who ? null : who; renderVoice(); });
    $root.on('change', '.na_vc_text', async function () {
        const who = String($(this).closest('.na_vc_card').data('who'));
        const v = this.value.trim();
        if (v) m.voice[who] = { ...m.voice[who], text: v }; else delete m.voice[who];
        // the editor stays open: "그만 고치기" right after typing must close it, not reopen it
        await save();
    });
    $root.on('click', '.na_vc_del', async function () {
        const who = String($(this).closest('.na_vc_card').data('who'));
        if (!await confirm('말투 지문 지우기', `${esc(who)}의 말투 지문을 지울까요?`)) return;
        delete m.voice[who]; await save();
    });
    $root.on('click', '.na_vc_make', async function () {
        const who = String($(this).closest('[data-who]').data('who'));
        const ok = await withSpinner($(this), '만드는 중…', async () => { await makeVoice(m, who); return true; });
        if (ok) { vOpen = who; await save(); toastr.success(`${who}: 말투 지문을 만들었어요${m.voiceInject ? '' : '. "조용히 주입"을 켜면 RP 모델에 들어가요'}`); }
    });
    $root.on('click', '.na_vc_all', async function () {
        const counts = new Map();
        for (const x of m.quotes) if (x.who && x.who !== '?' && !isExcluded(m, x.who)) counts.set(x.who, (counts.get(x.who) || 0) + 1);
        const voice = m.voice || {};
        // only the missing ones, and the ones whose lines changed since
        const todo = [...counts].filter(([who, n]) => n >= 3 && (!voice[who] || voice[who].n !== Math.min(150, n))).map(([who]) => who);
        if (!todo.length) return toastr.info(counts.size ? '새로 만들 지문이 없어요. 인물 카드의 "다시"로 하나씩 다시 만들 수 있어요.' : '대사가 3개 이상인 인물이 없어요.');
        const $b = $(this);
        let done = 0;
        await withSpinner($b, '만드는 중…', async () => {
            for (const who of todo) { $b.html(`<i class="fa-solid fa-spinner fa-spin"></i> ${esc(who)} (${done + 1}/${todo.length})`); await makeVoice(m, who); done++; await saveMeta(); }
        });
        await save();
        if (done) toastr.success(`말투 지문 ${done}개를 만들었어요${m.voiceInject ? '' : '. "조용히 주입"을 켜면 RP 모델에 들어가요'}`);
    });
    $root.on('change', '.na_qb_whoin', async function () { m.quotes[Number($(this).closest('.na_qb_row').data('i'))].who = this.value.trim() || '?'; await save(); });
    $root.on('click', '.na_qb_del', async function () { m.quotes.splice(Number($(this).closest('.na_qb_row').data('i')), 1); await save(); });
    $root.find('.na_qb_clear').on('click', async () => {
        if (!await confirm('전체 삭제', `모은 대사 ${m.quotes.length}개를 모두 지울까요? 되돌릴 수 없어요. (아카이브 본문은 그대로예요)`)) return;
        m.quotes = []; m.quoteMined = [];
        await save();
        toastr.success('대사 은행을 비웠어요');
    });
    $root.find('.na_qb_find').on('click', async () => {
        const have = new Set(m.quotes.map(q => q.text));
        const found = archiveQuotes(m).filter(q => !have.has(q.text) && !isExcluded(m, q.who));
        if (!found.length) return toastr.info('새로 모을 대사가 없어요.');
        m.quotes.push(...found.map(q => ({ ...q, on: false })));
        await save();
        toastr.success(`${found.length}개 모았어요. 말한 사람은 짐작이라 틀릴 수 있어요. 고치거나 "AI로 모으기"를 써 보세요.`);
    });
    // lines the model returned → verified candidates (must appear verbatim in one of the sections it read)
    const readPicks = (out, secs) => {
        const bodies = secs.map(x => quoteKey(m.text.slice(x.start, x.end)));
        const picks = [], made = [];
        for (const line of out.split('\n')) {
            const mt = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').match(/^\[?([^|\]]{1,40}?)\]?\s*\|\s*(.+)$/);
            if (!mt) continue;
            const who = mt[1].trim(), text = mt[2].trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim();
            const k = quoteKey(text);
            if (!who || k.length < 4) continue;
            const at = bodies.findIndex(b => b.includes(k));
            if (at < 0) { made.push(text); continue; } // not in what it read: made up or changed
            picks.push({ who, text, src: secs[at].title });
        }
        return { picks, made };
    };
    // excluded characters: their lines are removed and never gathered or injected
    const exclude = async name => {
        name = String(name).trim();
        if (!name || name === '?') return;
        m.quoteExclude = [...new Set([...(m.quoteExclude || []), name])];
        const before = m.quotes.length;
        m.quotes = m.quotes.filter(q => !isExcluded(m, q.who));
        if (m.voice) for (const who of Object.keys(m.voice)) if (isExcluded(m, who)) delete m.voice[who];
        await save();
        toastr.success(`${name}: 빼는 인물로 정했어요${before - m.quotes.length ? ` · 대사 ${before - m.quotes.length}개 지움` : ''}`);
    };
    // mobile keyboards often send no "Enter" key (IME composing / keyCode 229), so take the button, Enter and change
    const addExcluded = async () => {
        const $in = $root.find('.na_qb_excl_in');
        const v = String($in.val() || '').trim();
        if (!v) return;
        $in.val('');
        for (const n of v.split(/[,，]/)) await exclude(n);
    };
    $root.find('.na_qb_excl_add').on('click', addExcluded);
    // "+ 추가" pill → the name field (and its 추가 button for keyboards without Enter)
    const exclEdit = on => { $root.find('.na_qb_excl_in, .na_qb_excl_add').prop('hidden', !on); $root.find('.na_qb_excl_plus').prop('hidden', on); };
    $root.find('.na_qb_excl_plus').on('click', () => { exclEdit(true); $root.find('.na_qb_excl_in').trigger('focus'); });
    $root.find('.na_qb_excl_in').on('blur', function () { setTimeout(() => { if (!String(this.value || '').trim() && !$root.find('.na_qb_excl_add').is(':focus')) exclEdit(false); }, 150); });

    $root.find('.na_qb_excl_in').on('keydown', function (e) {
        if ((e.key === 'Enter' || e.keyCode === 13) && !e.isComposing) { e.preventDefault(); addExcluded(); }
    }).on('change', addExcluded);
    $root.on('click', '.na_qb_unex', async function () {
        const n = String($(this).data('n'));
        m.quoteExclude = (m.quoteExclude || []).filter(x => x !== n);
        await save();
    });
    $root.on('click', '.na_qb_gexcl', async function () {
        const who = String($(this).closest('.na_qb_gbtns').data('who'));
        if (!await confirm('인물 빼기', `${esc(who)}의 대사를 모두 지우고, 앞으로 모으거나 주입하지 않을까요? (위 "뺄 인물"에서 되돌릴 수 있어요)`)) return;
        await exclude(who);
    });
    $root.on('click', '.na_qb_gdel', async function () {
        const who = String($(this).closest('.na_qb_gbtns').data('who'));
        const n = m.quotes.filter(q => q.who === who).length;
        if (!await confirm('대사 지우기', `${who === '?' ? '말한 사람 모름' : esc(who)} 대사 ${n}개를 모두 지울까요? 되돌릴 수 없어요.`)) return;
        m.quotes = m.quotes.filter(q => q.who !== who);
        await save();
    });

    // AI gather: chosen sections a few at a time (a whole archive in one go makes models stop early)
    m.quoteMined = Array.isArray(m.quoteMined) ? m.quoteMined : [];
    const picker = mountSectionPicker($root.find('.na_qb_pickhost'), {
        m, title: 'AI가 읽을 섹션', goLabel: '모으기 시작', doneLabel: '모음',
        doneKeys: () => new Set(m.quoteMined),
        onGo: async (parts, step, stepDone) => {
            let added = 0, fixed = 0, made = 0, found = 0;
            try {
                for (const [i, part] of parts.entries()) {
                    await step(part, i);
                    const ex = Array.isArray(m.quoteExclude) ? m.quoteExclude : [];
                    const out = await askAI(`${ex.length ? `[SKIP THESE SPEAKERS]\n${ex.join(', ')}\n\n` : ''}[ARCHIVE SECTIONS]\n${picker.text(part)}`, { system: AI_SYS_QUOTES, maxTokens: 6000 });
                    const r = readPicks(out, part);
                    made += r.made.length; found += r.picks.length;
                    // candidates only: nothing gets ticked; lines already here just get the AI's speaker
                    for (const p of r.picks.filter(x => !isExcluded(m, x.who))) {
                        const q = m.quotes.find(x => quoteKey(x.text) === quoteKey(p.text));
                        if (q) { if (q.who !== p.who) { q.who = p.who; fixed++; } }
                        else { m.quotes.push({ ...p, on: false }); added++; }
                    }
                    m.quoteMined = [...new Set([...m.quoteMined, ...part.map(sectionKey)])];
                    await save();
                    stepDone();
                }
            } finally {
                if (found || made) toastr.success(`후보 ${found}개 · 새로 ${added}개${fixed ? ` · 말한 사람 ${fixed}개 고침` : ''}${made ? ` · 아카이브에 없는 ${made}개는 뺐어요` : ''}. 틀린 건 빼고 "말투 지문" 탭에서 지문을 만들어 보세요.`);
            }
        },
    });
    $root.find('.na_qb_ai').on('click', function () { $(this).toggleClass('active', picker.toggle()); });
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}
