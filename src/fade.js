// Forgetting curve: short and one-line versions of old sections.

import { askDraft, drLabel, draftReady, draftSettings, stripThink, withSpinner } from './ai.js';
import { currentChatId } from './chats.js';
import { ctx, getMeta, saveMeta, textHash } from './core.js';
import { applyInjection } from './inject.js';
import { sectionPanel, syncPanel } from './panel.js';
import { mdBlock } from './reader.js';
import { routerCfg, routerState } from './router.js';
import { RANGE_HEAD, filterMuted, keywordWaiting, linkedMap, parseSections, pinnedSet, sectionKey, sectionLinks } from './sections.js';
import { ICO_A, svgA } from './theme.js';
import { trCachedLines, trLineOk, translateLines, withLineTr } from './translate.js';
import { confirm, countTokens, esc, fmt } from './util.js';

// Each numbered section can keep a short version and a one-line version next to its full text (m.layers, keyed by section).
// With the curve on, the newest sections go in whole, older ones as their short version, the oldest as one line.
// Pinned sections, and sections a keyword or the AI router just called in, always go in whole.
export const fadeCfg = m => { const f = m?.fade && typeof m.fade === 'object' ? m.fade : {}; return { on: !!f.on, full: Number.isFinite(+f.full) && f.full !== undefined ? Math.max(0, +f.full) : 8, short: Number.isFinite(+f.short) && f.short !== undefined ? Math.max(0, +f.short) : 20 }; };
// versions picked by hand per section ('long' | 'short' | 'line'); they beat the curve and work with it off
export const fadeForce = m => (m.fadeForce && typeof m.fadeForce === 'object' ? m.fadeForce : {});
export const fadeActive = m => fadeCfg(m).on || Object.keys(fadeForce(m)).length > 0;
export const layersOf = m => (m.layers && typeof m.layers === 'object' ? m.layers : {});
export const layerHash = (text, s) => textHash(text.slice(s.start, s.end).replace(/^[^\n]*\n?/, '').trim());

// what each numbered section should be: 'long' | 'short' | 'line' (before checking which versions exist)
export function fadeWants(m, text = m.text) {
    const cfg = fadeCfg(m);
    const secs = parseSections(text);
    const pinned = pinnedSet(m);
    const stack = [], nums = [];
    for (const s of secs) {
        while (stack.length && stack[stack.length - 1].level >= s.level) stack.pop();
        if (s.group) { stack.push(s); continue; }
        if (RANGE_HEAD.test(s.title)) nums.push({ s, safe: pinned.has(sectionKey(s)) || stack.some(g => pinned.has(sectionKey(g))) });
    }
    // called in right now: keyword links that fired, the router's picks (and what they point at)
    const lm = linkedMap(m), waiting = keywordWaiting(m);
    const called = new Set(Object.keys(lm).filter(k => !waiting.has(k)));
    const rc = routerCfg(m);
    if (rc.mode !== 'off') {
        const picks = routerState.get(currentChatId())?.picks || [];
        for (const k of picks) { called.add(k); if (rc.follow) for (const t of sectionLinks(m).out.get(k) || []) called.add(t); }
    }
    const force = fadeForce(m);
    const out = new Map();
    nums.forEach(({ s, safe }, i) => {
        const age = nums.length - 1 - i;
        const k = sectionKey(s);
        // called in right now always goes whole; then a hand-picked version; then pin and the curve
        if (called.has(k)) return out.set(k, { s, want: 'long', why: 'called' });
        if (force[k]) return out.set(k, { s, want: force[k], why: 'manual' });
        out.set(k, { s, want: !cfg.on || safe || age < cfg.full ? 'long' : age < cfg.full + cfg.short ? 'short' : 'line', why: safe ? 'pin' : '' });
    });
    return out;
}

// the version that actually goes in: a missing or outdated version falls back to the longer one
export function fadeUse(m, text, s, want) {
    const L = layersOf(m)[sectionKey(s)];
    if (want === 'long' || !L) return 'long';
    if (L.h && L.h !== layerHash(text, s)) return 'long'; // the full text changed since the versions were made
    if (want === 'line' && String(L.line || '').trim()) return 'line';
    if (String(L.short || '').trim()) return 'short';
    return 'long';
}

export function applyFade(m, text) {
    const faded = new Map();
    if (!fadeActive(m)) return { text, faded };
    const plan = fadeWants(m, text);
    let out = '';
    for (const s of parseSections(text)) {
        const p = plan.get(sectionKey(s));
        const chunk = text.slice(s.start, s.end);
        const use = p ? fadeUse(m, text, s, p.want) : 'long';
        if (use === 'long') { out += chunk; continue; }
        faded.set(sectionKey(s), use);
        const L = layersOf(m)[sectionKey(s)];
        out += `${chunk.match(/^[^\n]*/)[0]}\n${use === 'line' ? String(L.line).trim() : withTopLabel(chunk, L.short)}\n\n`;
    }
    return { text: out, faded };
}

export const AI_SYS_LAYERS = `GOAL
Make two shorter versions of ONE section of a story archive. The full section stays saved. Your versions are used when the section is old.

YOU GET
SECTION: its title line and its full text.

STEPS
1. Read the section. Mark what MUST survive:
   who did what · decisions · promises · secrets that came out · injuries · how a relationship changed ·
   facts later parts may depend on (names, places, objects, numbers like #346).
2. SHORT: a light trim, not a summary — about 85% of the section's length (never longer than the section).
   Keep the sentences and their detail; take out only what adds nothing: repeated feelings, filler, things said twice.
   Same form as the original: bullets stay bullets, and every label line of the section (PLOT:, NOTES:, any line
   that ends with a colon) stays, in the same order, with its own shortened bullets under it. Keep every fact from step 1.
   Dialogue: a line you keep in quotation marks is copied exactly from the section — every word, same order,
   nothing trimmed, merged or reworded. Never shorten a quote.
   Keep WHOLE, however long, a line that turns the scene: one the section itself calls out ("the line that changed …"),
   or a confession, promise, vow, declaration, refusal or accusation that the rest of the section reacts to.
   Only minor lines may lose their quotation marks and be said in your own words.
3. LINE: one sentence, 30 words or fewer: the single most important thing that happened or changed.
4. Same language as the section. Add nothing that is not in the section. No comments.

EXAMPLE
SECTION:
## #12–#15 — The bridge (Spring 3, Varo)
PLOT:
- Ren and Mara cross the old bridge at dusk. Mara is afraid of heights; Ren holds her sleeve and talks about his sister to distract her.
- Halfway, a plank breaks. Ren falls to one knee and cuts his leg; Mara pulls him up. She says, "Now you owe me."
- On the far side Ivo waits with the horses. He tells them the duke has closed the south road, so they must go through Varo's market.
- That night Ren admits his sister is dead. Mara doesn't answer but sleeps next to him.
NOTES:
- Ren's leg wound is not treated yet.
Answer:
SHORT:
PLOT:
- Ren and Mara crossed the old bridge at dusk; Mara is afraid of heights, so Ren held her sleeve and talked about his sister.
- Halfway a plank broke. Ren fell to one knee and cut his leg; Mara pulled him up. She said, "Now you owe me."
- Across the bridge Ivo waited with the horses: the duke has closed the south road, so they must go through Varo's market.
- That night Ren admitted his sister is dead. Mara didn't answer but slept next to him.
NOTES:
- Ren's leg wound is untreated.
LINE:
Ren was hurt on the bridge and saved by Mara; that night he told her his sister is dead.

OUTPUT
Exactly this, nothing else:
SHORT:
<short version>
LINE:
<one sentence>`;

// a section that opens with a label line (PLOT: …) keeps it in its short version: put it back if it was dropped
export function withTopLabel(chunk, short) {
    short = String(short || '').trim();
    const first = String(chunk).replace(/^[^\n]*\n?/, '').trimStart().match(/^([A-Z][A-Z0-9 /&'-]{1,30}:)[ \t]*(\n|$)/);
    return first && short && !short.startsWith(first[1]) ? `${first[1]}\n${short}` : short;
}

// quoted lines in `out` that are not a whole quoted line of `src` word for word (shortened, cut or reworded)
export function changedQuotes(src, out) {
    const norm = t => String(t).replace(/[“”«»„]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
    const hay = norm(src), bare = q => q.replace(/[\s.,!?…~—–-]+$/u, '');
    const quotes = t => [...t.matchAll(/"([^"]{6,})"/g)].map(x => x[1].trim());
    const whole = quotes(hay);
    return quotes(norm(out)).filter(q => {
        if (whole.some(w => w === q || bare(w) === bare(q))) return false; // a whole quoted line
        if (whole.some(w => w.includes(bare(q)))) return true; // only part of a quoted line: shortened
        return !hay.includes(q) && !hay.includes(bare(q)); // not in the section as written
    });
}

export const AI_SYS_LAYERS_REVISE = `GOAL
Change the short version (and the one line) of a story-archive section the way the user asks — and nothing else.

YOU GET
SECTION: the full section. It is the only source of facts and quotes.
CURRENT SHORT and CURRENT LINE: the versions saved now.
REQUEST: what the user wants changed (it may be in Korean).

STEPS
1. Do what REQUEST asks.
2. Leave every other part of CURRENT SHORT exactly as it is, word for word.
3. Anything you add comes from SECTION. A line in quotation marks is copied whole from SECTION — every word, same order.
4. Keep the form of CURRENT SHORT: its label lines (PLOT: …) and bullets. Same language as SECTION.
5. Change LINE only if REQUEST asks for it, or if your change makes LINE wrong.

EXAMPLE
SECTION:
## #12–#15 — The bridge
PLOT:
- Halfway, a plank breaks. Ren cuts his leg; Mara pulls him up. She says, "Now you owe me, and I always collect."
- Ivo tells them the south road is closed.
CURRENT SHORT:
PLOT:
- A plank broke; Ren cut his leg and Mara pulled him up, telling him he owed her.
- Ivo: the south road is closed.
CURRENT LINE:
Mara saved Ren on the bridge.
REQUEST:
마라 대사는 원문 그대로 넣어줘
Answer:
SHORT:
PLOT:
- A plank broke; Ren cut his leg and Mara pulled him up: "Now you owe me, and I always collect."
- Ivo: the south road is closed.
LINE:
Mara saved Ren on the bridge.

OUTPUT
Exactly this, nothing else:
SHORT:
<short version>
LINE:
<one sentence>`;

// short rewrites: low thinking effort and an 8,000-token ceiling (thinking counts against it), so a model that can't
// switch thinking off doesn't spend the whole draft budget on one section
const LAYER_ASK = { system: AI_SYS_LAYERS, effort: 'low', get maxTokens() { return Math.min(8000, Number(draftSettings().max) || 16000); } };

// SHORT / LINE out of a model answer, or null if it isn't in that shape
const parseLayers = out => out.match(/SHORT:\s*\n?([\s\S]*?)\n\s*\**LINE:?\**\s*\n?([\s\S]+)$/i);

export async function draftLayers(m, s) {
    const section = m.text.slice(s.start, s.end).trim();
    // no small cap on the answer: models that think first can spend a few thousand tokens before writing anything
    // (the draft model's own "초안 최대 길이" applies)
    let out = stripThink(await askDraft(`SECTION:\n${section}`, LAYER_ASK));
    // a quote must stay whole: one more try naming the ones that were cut or reworded. If that try fails or comes back
    // worse, the first answer is kept (it was paid for) and the changed quotes are pointed out instead
    const bad = changedQuotes(section, out);
    if (bad.length && parseLayers(out)) {
        try {
            const again = stripThink(await askDraft(`SECTION:\n${section}\n\nYour last answer changed these quotes. Copy each one exactly from the section, or drop its quotation marks and say it in your own words:\n${bad.map(q => `- "${q}"`).join('\n')}`, LAYER_ASK));
            if (parseLayers(again) && changedQuotes(section, again).length < bad.length) out = again;
        } catch (e) { console.warn('[narrative-archive] layers retry', e); }
        const left = changedQuotes(section, out).length;
        if (left) toastr.warning(`${s.title.slice(0, 30)}: 원문과 다른 대사 ${left}개가 남았어요. 버전 창에서 확인해 주세요`);
    }
    const mt = parseLayers(out);
    if (!mt) throw new Error(`${s.title.slice(0, 30)}: 답 형식이 달라요 (SHORT:/LINE: 없음)`);
    const short = withTopLabel(m.text.slice(s.start, s.end), mt[1].replace(/^\**\s*/, ''));
    return { short, line: mt[2].trim().split('\n')[0].trim() };
}

export async function saveLayers(m, s, short, line) {
    m.layers = layersOf(m);
    short = String(short || '').trim(); line = String(line || '').trim();
    if (!short && !line) delete m.layers[sectionKey(s)];
    else m.layers[sectionKey(s)] = { short, line, h: layerHash(m.text, s) };
    await saveMeta();
    applyInjection().then(() => sectionPanel?.render());
    syncPanel();
}

export const WARN_SVG = '<svg class="na_warn_svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>';

export async function openLayers(s) {
    const c = ctx();
    const m = getMeta();
    const L = layersOf(m)[sectionKey(s)] || {};
    const full = m.text.slice(s.start, s.end).replace(/^[^\n]*\n?/, '').trim();
    const stale = L.h && L.h !== layerHash(m.text, s);
    const plan = fadeActive(m) ? fadePlan(m).get(sectionKey(s)) : null;
    const use = plan ? fadeUse(m, m.text, s, plan.want) : null;
    const name = { long: '원문', short: '짧게', line: '한 줄' };
    const into = { long: '원문으로', short: '짧은 버전으로', line: '한 줄로' };
    const noteHtml = (p, u) => p ? `지금 <b>${into[u]}</b> 들어가요${p.why === 'pin' ? ' (📌 고정)' : p.why === 'called' ? ' (지금 불려 온 섹션)' : p.why === 'manual' ? ' (직접 고름)' : ''}${u !== p.want ? ` · 고른 건 ${name[p.want]}인데 ${stale ? '원문이 바뀌어서' : '그 버전이 없어서'}` : ''}` : '망각 곡선이 꺼져 있어 원문으로 들어가요';
    const forced = () => fadeForce(getMeta())[sectionKey(s)] || 'auto';
    const now = t => use === t ? ' · 지금 들어감' : '';
    let tab = use && use !== 'long' ? use : (L.short ? 'short' : 'long');
    const $root = $(`
      <div class="na_popup na_v2 na_layers">
        <div class="na_v2_title"><small>섹션 버전</small><b>${esc(s.title)}</b></div>
        <div class="na_v2_note na_ly_note">${noteHtml(plan, use)}</div>
        <div class="na_ly_force"><span>넣을 버전</span><div class="na_v2_seg na_ly_forceseg">${[['auto', '자동'], ['long', '원문'], ['short', '짧게'], ['line', '한 줄']].map(([v, l]) => `<button type="button" data-v="${v}" class="${forced() === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        ${stale ? '<div class="na_xr_warn slim">' + WARN_SVG + '<div>버전을 만든 뒤에 원문이 바뀌었어요. 저장할 때까지 원문으로 들어가요.</div></div>' : ''}
        <div class="na_v2_seg na_ly_tabs">
          <button type="button" data-t="long"><span>원문${now('long')}</span><small class="na_ly_tok_long"></small></button>
          <button type="button" data-t="short"><span>짧게${now('short')}</span><small class="na_ly_tok_short"></small></button>
          <button type="button" data-t="line"><span>한 줄${now('line')}</span><small class="na_ly_tok_line"></small></button>
        </div>
        <div class="na_ly_tools">
          <button type="button" class="na_v2_pillbtn na_ly_edit">${svgA(ICO_A.pen, 13)}<span>직접 고치기</span></button>
          <button type="button" class="na_v2_pillbtn na_ly_tr"><i class="fa-solid fa-language"></i><span>한국어로</span></button>
          <small class="na_ly_trinfo"></small>
        </div>
        <div class="na_ly_pane" data-t="long"><div class="na_ly_view na_ly_full"></div></div>
        <div class="na_ly_pane" data-t="short"><div class="na_ly_view"></div><textarea class="text_pole na_ly_short" rows="8" spellcheck="false" hidden placeholder="원문을 85%쯤으로 살짝 다듬은 것. 직접 쓰거나 초안 모델로 만들어요."></textarea></div>
        <div class="na_ly_pane" data-t="line"><div class="na_ly_view"></div><textarea class="text_pole na_ly_line" rows="3" spellcheck="false" hidden placeholder="가장 중요한 일 한 문장"></textarea></div>
        ${draftReady() ? `<div class="na_ly_ask"><input type="text" class="na_ly_askq" placeholder="고쳐 달라고 하기 (예: 소망 대사는 원문 그대로)" aria-label="고쳐 달라고 하기" enterkeyhint="send"><button type="button" class="na_ly_askgo" aria-label="보내기" title="초안 모델에게 보내기">${svgA('M22 2L11 13M22 2l-7 20-4-9-9-4z', 17)}</button></div>` : ''}
        <div class="na_v2_row2 na_ly_btns">${draftReady() ? `<button type="button" class="na_v2_btn na_ly_draft">초안 모델로 ${L.short || L.line ? '다시' : '만들기'}</button>` : ''}<button type="button" class="na_v2_btn na_ly_save">저장</button></div>
        ${draftReady() ? `<small class="na_v2_foot">${esc(drLabel())} · 짧게·한 줄을 같이 채워요. 저장해야 들어가요</small>` : '<small class="na_v2_foot">⚙ 설정 → AI · 번역 → 초안 모델을 정하면 여기서 바로 만들 수 있어요</small>'}
      </div>`);
    const startShort = L.short ? withTopLabel(m.text.slice(s.start, s.end), L.short) : '', startLine = L.line || '';
    $root.find('.na_ly_short').val(startShort);
    $root.find('.na_ly_line').val(startLine);
    const text = t => t === 'long' ? full : String($root.find(t === 'short' ? '.na_ly_short' : '.na_ly_line').val() || '');
    const dirty = () => text('short').trim() !== startShort.trim() || text('line').trim() !== startLine.trim();
    // each tab is read as text; "직접 고치기" turns short / one line into an editor, "한국어로" shows it translated
    let editing = false, korean = false, trBusy = false;
    const trMap = new Map();
    const trLines = t => [...new Set(text(t).split('\n').filter(trLineOk).map(l => l.trim()))];
    const fillTr = t => { const ls = trLines(t); trCachedLines(ls).forEach((x, i) => { if (x) trMap.set(ls[i], x); }); return ls; };
    const show = () => {
        $root.find('.na_ly_tabs button').each(function () { $(this).toggleClass('on', this.dataset.t === tab); });
        $root.find('.na_ly_pane').each(function () { this.hidden = this.dataset.t !== tab; });
        const $pane = $root.find(`.na_ly_pane[data-t="${tab}"]`);
        const raw = text(tab);
        $pane.find('textarea').prop('hidden', !editing);
        $pane.find('.na_ly_view').prop('hidden', editing)
            .html(raw.trim() ? mdBlock(korean ? withLineTr(raw, trMap) : raw) : `<span class="na_ly_empty">${tab === 'line' ? '한 줄이 아직 없어요' : '짧은 버전이 아직 없어요'} · 직접 고치기로 쓰거나 초안 모델로 만들어요</span>`);
        $root.find('.na_ly_edit').prop('hidden', tab === 'long').find('span').text(editing ? '다 고쳤어요' : '직접 고치기');
        $root.find('.na_ly_edit').toggleClass('on', editing);
        $root.find('.na_ly_tr').prop('disabled', editing || !raw.trim()).toggleClass('on', korean).find('span').text(korean ? '원문으로' : '한국어로');
        const ls = fillTr(tab), n = ls.filter(l => trMap.has(l)).length;
        $root.find('.na_ly_trinfo').text(editing ? '고친 뒤 아래 저장을 눌러야 들어가요' : korean && n < ls.length ? `${n}/${ls.length}줄 번역됨` : !korean && n ? `번역 ${n === ls.length ? '있음' : `${n}/${ls.length}줄 있음`}` : '');
        if (editing) $pane.find('textarea').trigger('focus');
    };
    const tok = async () => {
        const [a, b, d] = await Promise.all([countTokens(full), countTokens($root.find('.na_ly_short').val()), countTokens($root.find('.na_ly_line').val())]);
        $root.find('.na_ly_tok_long').text(fmt(a));
        $root.find('.na_ly_tok_short').text(b ? `${fmt(b)} · ${Math.round(b / Math.max(1, a) * 100)}%` : '없음');
        $root.find('.na_ly_tok_line').text(d ? fmt(d) : '없음');
    };
    show(); tok();
    $root.on('click', '.na_ly_tabs button', function () { tab = this.dataset.t; if (tab === 'long') editing = false; show(); });
    $root.on('click', '.na_ly_edit', () => { editing = !editing; if (editing) korean = false; show(); });
    $root.on('click', '.na_ly_tr', async function () {
        if (trBusy) return;
        if (korean) { korean = false; return show(); }
        const missing = fillTr(tab).filter(l => !trMap.has(l));
        if (missing.length) {
            trBusy = true;
            $(this).prop('disabled', true).find('span').text('번역하는 중…');
            try { const tr = await translateLines(missing); missing.forEach((l, i) => { if (tr[i]) trMap.set(l, tr[i]); }); }
            catch (e) { toastr.error(String(e?.message || e), '번역 실패'); }
            trBusy = false;
        }
        korean = fillTr(tab).some(l => trMap.has(l));
        show();
    });
    $root.on('click', '.na_ly_forceseg button', async function () {
        await setFadeForce([sectionKey(s)], this.dataset.v);
        $root.find('.na_ly_forceseg button').each(function () { $(this).toggleClass('on', this.dataset.v === forced()); });
        const mm = getMeta(), p2 = fadeActive(mm) ? fadePlan(mm).get(sectionKey(s)) : null;
        $root.find('.na_ly_note').html(noteHtml(p2, p2 ? fadeUse(mm, mm.text, s, p2.want) : null));
    });
    $root.find('textarea').on('input', tok);
    $root.find('.na_ly_save').on('click', () => $root.closest('dialog').find('.popup-button-ok').trigger('click'));
    $root.find('.na_ly_draft').on('click', async function () {
        const r = await withSpinner($(this), '만드는 중…', () => draftLayers(m, s));
        if (r) { $root.find('.na_ly_short').val(r.short); $root.find('.na_ly_line').val(r.line); tab = 'short'; editing = false; korean = false; show(); tok(); }
    });
    // "고쳐 달라고 하기": the draft model changes the short version / one line as asked; save still decides
    const askRevise = async () => {
        const req = String($root.find('.na_ly_askq').val() || '').trim();
        if (!req) return $root.find('.na_ly_askq').trigger('focus');
        const $go = $root.find('.na_ly_askgo');
        const r = await withSpinner($go, '', () => reviseLayers(m, s, text('short'), text('line'), req));
        if (!r) return;
        $root.find('.na_ly_short').val(r.short); $root.find('.na_ly_line').val(r.line);
        $root.find('.na_ly_askq').val('');
        tab = 'short'; editing = false; korean = false; show(); tok();
        toastr[r.changed.length ? 'warning' : 'success'](r.changed.length ? `고쳤어요 · 원문과 다른 대사 ${r.changed.length}개가 있어요` : '고쳤어요 · 마음에 들면 저장을 눌러 주세요');
    };
    $root.on('click', '.na_ly_askgo', askRevise);
    $root.on('keydown', '.na_ly_askq', e => { if (e.key === 'Enter' && !e.originalEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); askRevise(); } });
    const res = await c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', { wide: true, large: false, allowVerticalScrolling: true, leftAlign: true, okButton: '저장', cancelButton: '닫기' });
    if (res !== c.POPUP_RESULT.AFFIRMATIVE && res !== true) {
        // closed with changes not saved: ask instead of dropping them
        if (!dirty() || !await confirm('저장 안 한 고침', '짧은 버전 · 한 줄을 고친 게 있어요. 저장할까요?')) return;
    }
    await saveLayers(m, s, $root.find('.na_ly_short').val(), $root.find('.na_ly_line').val());
    toastr.success('섹션 버전을 저장했어요');
}

// fadeWants as the injection really sees it (muted and keyword-waiting sections don't count toward age),
// with each entry's section taken from the full archive text so offsets and version hashes line up
export function fadePlan(m) {
    const full = new Map(parseSections(m.text).map(x => [sectionKey(x), x]));
    const out = new Map();
    for (const [k, p] of fadeWants(m, filterMuted(m, m.text))) if (full.has(k)) out.set(k, { ...p, s: full.get(k) });
    return out;
}

// sections whose short / one-line version is missing or outdated. Default: only the ones the curve needs now
// (they'd go in as the full text); all = every section in the curve, the needed ones first
export function fadeMissing(m, all = false) {
    const need = [], rest = [];
    for (const { s, want } of fadePlan(m).values()) {
        const L = layersOf(m)[sectionKey(s)];
        const stale = !!(L?.h && L.h !== layerHash(m.text, s));
        const noShort = !String(L?.short || '').trim(), noLine = !String(L?.line || '').trim();
        if (want !== 'long' && (!L || stale || noShort || (want === 'line' && noLine))) need.push(s);
        else if (all && (!L || stale || noShort || noLine)) rest.push(s);
    }
    return all ? [...need, ...rest] : need;
}

export let fadeFilling = null;
export async function fillFade($btn, only = null) {
    if (fadeFilling) { fadeFilling.stop = true; $btn.prop('disabled', true); return; }
    const m = getMeta();
    const pick = only && new Set(only);
    const todo = fadeMissing(m, true).filter(x => !pick || pick.has(sectionKey(x))), need = pick ? 0 : fadeMissing(m).length;
    if (!todo.length) return toastr.info('모든 섹션에 짧게 · 한 줄 버전이 있어요.');
    if (!await confirm('초안 모델로 채우기', `짧게 · 한 줄 버전이 없는 섹션 ${todo.length}개를 초안 모델(${drLabel()})로 하나씩 만들까요?${need ? ` 지금 곡선에 필요한 ${need}개부터 해요.` : ''} 섹션마다 요청이 한 번씩 가요. 도중에 멈출 수 있어요.`)) return;
    fadeFilling = { stop: false };
    const html = $btn.html();
    let done = 0, failed = 0;
    try {
        for (const s of todo) {
            if (fadeFilling.stop || getMeta() !== m) break;
            $btn.html(`<i class="fa-solid fa-stop"></i> 멈추기 (${done + failed + 1}/${todo.length})`);
            const cur = parseSections(m.text).find(x => sectionKey(x) === sectionKey(s));
            if (!cur) continue;
            try { const r = await draftLayers(m, cur); if (getMeta() !== m) break; m.layers = layersOf(m); m.layers[sectionKey(cur)] = { ...r, h: layerHash(m.text, cur) }; done++; await saveMeta(); }
            catch (e) { failed++; console.warn('[narrative-archive] layers', e); if (failed >= 3 && !done) { toastr.error(String(e?.message || e), '초안 모델'); break; } }
        }
    } finally {
        fadeFilling = null;
        $btn.prop('disabled', false).html(html);
        applyInjection().then(() => sectionPanel?.render());
        syncPanel();
        if (done || failed) toastr[failed ? 'warning' : 'success'](`버전 ${done}개 만들었어요${failed ? ` · ${failed}개 실패 (다시 누르면 남은 것만 해요)` : ''}`);
    }
}

// hand-picked versions for many sections at once: v = 'auto' (back to the curve) | 'long' | 'short' | 'line'
// the user's own change request for a section's versions ("소망 대사는 원문 그대로"): returns { short, line, changed }
export async function reviseLayers(m, s, short, line, req) {
    const section = m.text.slice(s.start, s.end).trim();
    const out = stripThink(await askDraft(`SECTION:\n${section}\n\nCURRENT SHORT:\n${String(short || '').trim() || '(none)'}\n\nCURRENT LINE:\n${String(line || '').trim() || '(none)'}\n\nREQUEST:\n${req}`, { ...LAYER_ASK, system: AI_SYS_LAYERS_REVISE }));
    const mt = parseLayers(out);
    if (!mt) throw new Error('답 형식이 달라요 (SHORT:/LINE: 없음). 다시 보내 주세요');
    const next = withTopLabel(section, mt[1].replace(/^\**\s*/, ''));
    return { short: next, line: mt[2].trim().split('\n')[0].trim(), changed: changedQuotes(section, next) };
}

export async function setFadeForce(keys, v) {
    const m = getMeta();
    m.fadeForce = { ...fadeForce(m) };
    for (const k of keys) { if (v === 'auto') delete m.fadeForce[k]; else m.fadeForce[k] = v; }
    await saveMeta();
    await applyInjection();
    sectionPanel?.render();
    syncPanel();
}

// pick sections and set their version in one go; also makes missing versions for the picked ones
export async function openFadePicker() {
    const c = ctx();
    const name = { long: '원문', short: '짧게', line: '한 줄' };
    let filter = 'all';
    const picked = new Set();
    const $root = $(`
      <div class="na_popup na_v2 na_fp">
        <div class="na_v2_title"><b>섹션별 버전</b><small>고른 섹션에 원문 · 짧게 · 한 줄을 한꺼번에 정해요. 자동은 망각 곡선을 따라요</small></div>
        <div class="na_v2_chips na_fp_filters">
          <button type="button" data-f="all" class="on">전체</button><button type="button" data-f="manual">직접 고른 것</button><button type="button" data-f="miss">버전 없음</button>
        </div>
        <div class="na_fp_list"></div>
        <div class="na_fp_bar">
          <div class="na_fp_barhead"><label class="na_fp_all"><input type="checkbox" class="na_fp_allbox"> <span class="na_fp_n">0개 고름</span></label><button type="button" class="na_linkbtn na_fp_make" hidden>버전 만들기</button></div>
          <div class="na_v2_seg na_fp_set">${[['auto', '자동'], ['long', '원문'], ['short', '짧게'], ['line', '한 줄']].map(([v, l]) => `<button type="button" data-v="${v}" disabled>${l}</button>`).join('')}</div>
        </div>
      </div>`);
    const rows = () => {
        const m = getMeta();
        const plan = fadePlan(m), force = fadeForce(m), L = layersOf(m);
        const out = [];
        let group = '';
        for (const s of parseSections(m.text)) {
            if (s.group) { if (s.level <= 2) group = s.title; continue; }
            if (!RANGE_HEAD.test(s.title)) continue;
            const k = sectionKey(s), p = plan.get(k), lay = L[k] || {};
            const stale = !!(lay.h && lay.h !== layerHash(m.text, s));
            const has = { short: !stale && !!String(lay.short || '').trim(), line: !stale && !!String(lay.line || '').trim() };
            const use = p ? fadeUse(m, m.text, p.s, p.want) : 'off';
            out.push({ s, k, group, p, use, has, force: force[k] || '', muted: !p });
        }
        return out;
    };
    const draw = () => {
        const all = rows();
        const show = all.filter(r => filter === 'all' || (filter === 'manual' ? r.force : !r.muted && (!r.has.short || !r.has.line)));
        let lastGroup = null;
        $root.find('.na_fp_list').html(show.length ? show.map(r => {
            const head = r.group !== lastGroup ? `<div class="na_fp_group">${esc(r.group || '묶음 없음')}</div>` : '';
            lastGroup = r.group;
            const state = r.muted ? '<span class="na_fp_use off">꺼짐</span>' : `<span class="na_fp_use ${r.use}">${name[r.use]}</span>`;
            const why = r.force ? '<span class="na_fp_why">직접</span>' : r.p?.why === 'pin' ? '<span class="na_fp_why">고정</span>' : r.p?.why === 'called' ? '<span class="na_fp_why">불려 옴</span>' : '';
            return `${head}<label class="na_fp_row ${picked.has(r.k) ? 'on' : ''}" data-k="${esc(r.k)}"><input type="checkbox" ${picked.has(r.k) ? 'checked' : ''}><span class="na_fp_title">${esc(r.s.title)}</span><span class="na_fp_has"><i class="${r.has.short ? 'y' : ''}" title="짧은 버전 ${r.has.short ? '있음' : '없음'}">짧</i><i class="${r.has.line ? 'y' : ''}" title="한 줄 ${r.has.line ? '있음' : '없음'}">줄</i></span>${why}${state}</label>`;
        }).join('') : '<div class="na_empty">해당하는 섹션이 없어요.</div>');
        const n = picked.size;
        $root.find('.na_fp_n').text(`${n}개 고름`);
        $root.find('.na_fp_allbox').prop('checked', show.length > 0 && show.every(r => picked.has(r.k))).prop('indeterminate', n > 0 && !show.every(r => picked.has(r.k)));
        $root.find('.na_fp_set button').prop('disabled', !n);
        const missN = all.filter(r => picked.has(r.k) && !r.muted && (!r.has.short || !r.has.line)).length;
        $root.find('.na_fp_make').prop('hidden', !missN || !draftReady()).text(`버전 없는 ${missN}개 초안 모델로 만들기`);
    };
    $root.on('click', '.na_fp_filters button', function () { filter = this.dataset.f; $root.find('.na_fp_filters button').each(function () { $(this).toggleClass('on', this.dataset.f === filter); }); draw(); });
    $root.on('change', '.na_fp_row input', function () { const k = String($(this).closest('.na_fp_row').data('k')); this.checked ? picked.add(k) : picked.delete(k); draw(); });
    $root.on('change', '.na_fp_allbox', function () { const ks = $root.find('.na_fp_row').map(function () { return String($(this).data('k')); }).get(); for (const k of ks) this.checked ? picked.add(k) : picked.delete(k); draw(); });
    $root.on('click', '.na_fp_set button', async function () {
        const v = this.dataset.v, keys = [...picked];
        await setFadeForce(keys, v);
        const left = v === 'short' || v === 'line' ? rows().filter(r => picked.has(r.k) && r.p && fadeUse(getMeta(), getMeta().text, r.p.s, v) !== v).length : 0;
        toastr.success(`${keys.length}개를 ${v === 'auto' ? '자동(망각 곡선)' : name[v]}으로 정했어요${left ? ` · ${left}개는 그 버전이 없어서 더 긴 걸로 들어가요` : ''}`);
        draw();
    });
    $root.on('click', '.na_fp_make', async function () { await fillFade($(this), [...picked]); draw(); });
    draw();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

