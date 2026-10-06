// Forgetting curve: short and one-line versions of old sections.

import { askDraft, drLabel, draftReady, stripThink, withSpinner } from './ai.js';
import { currentChatId } from './chats.js';
import { ctx, getMeta, saveMeta, textHash } from './core.js';
import { applyInjection } from './inject.js';
import { sectionPanel, syncPanel } from './panel.js';
import { routerCfg, routerState } from './router.js';
import { RANGE_HEAD, filterMuted, keywordWaiting, linkedMap, parseSections, pinnedSet, sectionKey, sectionLinks } from './sections.js';
import { confirm, countTokens, esc, fmt } from './util.js';

// Each numbered section can keep a short version and a one-line version next to its full text (m.layers, keyed by section).
// With the curve on, the newest sections go in whole, older ones as their short version, the oldest as one line.
// Pinned sections, and sections a keyword or the AI router just called in, always go in whole.
export const fadeCfg = m => { const f = m?.fade && typeof m.fade === 'object' ? m.fade : {}; return { on: !!f.on, full: Number.isFinite(+f.full) && f.full !== undefined ? Math.max(0, +f.full) : 8, short: Number.isFinite(+f.short) && f.short !== undefined ? Math.max(0, +f.short) : 20 }; };
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
    const out = new Map();
    nums.forEach(({ s, safe }, i) => {
        const age = nums.length - 1 - i;
        const k = sectionKey(s);
        out.set(k, { s, want: safe || called.has(k) || age < cfg.full ? 'long' : age < cfg.full + cfg.short ? 'short' : 'line', why: safe ? 'pin' : called.has(k) ? 'called' : '' });
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
    if (!fadeCfg(m).on) return { text, faded };
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
2. SHORT: rewrite the section in about one third of its length, never more than three quarters
   (a section that is already short may stay near that limit, but must still be shorter).
   Same form as the original: bullets stay bullets, and every label line of the section (PLOT:, NOTES:, any line
   that ends with a colon) stays, in the same order, with its own shortened bullets under it. Keep every fact from step 1.
   Cut mood, repeated feelings and exact dialogue. Keep a quote only if it is a line the story keeps coming back to.
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
- Crossing the old bridge at dusk, a plank broke; Ren cut his leg and Mara, afraid of heights, pulled him up: "Now you owe me."
- Ivo: the duke closed the south road, so they go through Varo's market.
- That night Ren admitted his sister is dead; Mara slept beside him without answering.
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

export async function draftLayers(m, s) {
    const out = await askDraft(`SECTION:\n${m.text.slice(s.start, s.end).trim()}`, { system: AI_SYS_LAYERS, maxTokens: 4000 });
    const mt = stripThink(out).match(/SHORT:\s*\n?([\s\S]*?)\n\s*\**LINE:?\**\s*\n?([\s\S]+)$/i);
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
    const plan = fadeCfg(m).on ? fadePlan(m).get(sectionKey(s)) : null;
    const use = plan ? fadeUse(m, m.text, s, plan.want) : null;
    const name = { long: '원문', short: '짧게', line: '한 줄' };
    const into = { long: '원문으로', short: '짧은 버전으로', line: '한 줄로' };
    const now = t => use === t ? ' · 지금 들어감' : '';
    let tab = use && use !== 'long' ? use : (L.short ? 'short' : 'long');
    const $root = $(`
      <div class="na_popup na_v2 na_layers">
        <div class="na_v2_title"><small>섹션 버전</small><b>${esc(s.title)}</b></div>
        ${plan ? `<div class="na_v2_note na_ly_note">망각 곡선: 지금 <b>${into[use]}</b> 들어가요${plan.why === 'pin' ? ' (📌 고정)' : plan.why === 'called' ? ' (지금 불려 온 섹션)' : use !== plan.want ? ` · 원래는 ${name[plan.want]}인데 ${stale ? '원문이 바뀌어서' : '그 버전이 없어서'}` : ''}</div>` : ''}
        ${stale ? '<div class="na_xr_warn slim">' + WARN_SVG + '<div>버전을 만든 뒤에 원문이 바뀌었어요. 저장할 때까지 원문으로 들어가요.</div></div>' : ''}
        <div class="na_v2_seg na_ly_tabs">
          <button type="button" data-t="long"><span>원문${now('long')}</span><small class="na_ly_tok_long"></small></button>
          <button type="button" data-t="short"><span>짧게${now('short')}</span><small class="na_ly_tok_short"></small></button>
          <button type="button" data-t="line"><span>한 줄${now('line')}</span><small class="na_ly_tok_line"></small></button>
        </div>
        <div class="na_ly_pane" data-t="long"><div class="na_ly_full">${esc(full)}</div></div>
        <div class="na_ly_pane" data-t="short"><textarea class="text_pole na_ly_short" rows="8" spellcheck="false" placeholder="원문을 1/3쯤으로 줄인 것. 직접 붙여넣거나 초안 모델로 만들어요."></textarea></div>
        <div class="na_ly_pane" data-t="line"><textarea class="text_pole na_ly_line" rows="3" spellcheck="false" placeholder="가장 중요한 일 한 문장"></textarea></div>
        <div class="na_v2_row2 na_ly_btns">${draftReady() ? `<button type="button" class="na_v2_btn na_ly_draft">초안 모델로 ${L.short || L.line ? '다시' : '만들기'}</button>` : ''}<button type="button" class="na_v2_btn na_ly_save">저장</button></div>
        ${draftReady() ? `<small class="na_v2_foot">${esc(drLabel())} · 짧게·한 줄을 같이 채워요. 저장해야 들어가요</small>` : '<small class="na_v2_foot">⚙ 설정 → AI · 번역 → 초안 모델을 정하면 여기서 바로 만들 수 있어요</small>'}
      </div>`);
    $root.find('.na_ly_short').val(L.short ? withTopLabel(m.text.slice(s.start, s.end), L.short) : '');
    $root.find('.na_ly_line').val(L.line || '');
    const show = () => {
        $root.find('.na_ly_tabs button').each(function () { $(this).toggleClass('on', this.dataset.t === tab); });
        $root.find('.na_ly_pane').each(function () { this.hidden = this.dataset.t !== tab; });
    };
    const tok = async () => {
        const [a, b, d] = await Promise.all([countTokens(full), countTokens($root.find('.na_ly_short').val()), countTokens($root.find('.na_ly_line').val())]);
        $root.find('.na_ly_tok_long').text(fmt(a));
        $root.find('.na_ly_tok_short').text(b ? `${fmt(b)} · ${Math.round(b / Math.max(1, a) * 100)}%` : '없음');
        $root.find('.na_ly_tok_line').text(d ? fmt(d) : '없음');
    };
    show(); tok();
    $root.on('click', '.na_ly_tabs button', function () { tab = this.dataset.t; show(); });
    $root.find('textarea').on('input', tok);
    $root.find('.na_ly_save').on('click', () => $root.closest('dialog').find('.popup-button-ok').trigger('click'));
    $root.find('.na_ly_draft').on('click', async function () {
        const r = await withSpinner($(this), '만드는 중…', () => draftLayers(m, s));
        if (r) { $root.find('.na_ly_short').val(r.short); $root.find('.na_ly_line').val(r.line); tab = 'short'; show(); tok(); }
    });
    const res = await c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', { wide: true, large: false, allowVerticalScrolling: true, leftAlign: true, okButton: '저장', cancelButton: '닫기' });
    if (res !== c.POPUP_RESULT.AFFIRMATIVE && res !== true) return;
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
export async function fillFade($btn) {
    if (fadeFilling) { fadeFilling.stop = true; $btn.prop('disabled', true); return; }
    const m = getMeta();
    const todo = fadeMissing(m, true), need = fadeMissing(m).length;
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
