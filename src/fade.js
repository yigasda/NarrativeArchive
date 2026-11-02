// Forgetting curve: short and one-line versions of old sections.

import { askDraft, drLabel, draftReady, draftSettings, stripThink, withSpinner } from './ai.js';
import { currentChatId } from './chats.js';
import { ctx, getMeta, saveMeta, textHash } from './core.js';
import { applyInjection } from './inject.js';
import { sectionPanel, syncPanel } from './panel.js';
import { estTok } from './picker.js';
import { mdBlock } from './reader.js';
import { routerCfg, routerState } from './router.js';
import { RANGE_HEAD, atRest, filterMuted, keywordWaiting, linkedMap, parseSections, pinnedSet, sectionKey, sectionLinks } from './sections.js';
import { ICO_A, svgA } from './theme.js';
import { trCachedLines, trLineOk, translateLines, withLineTr } from './translate.js';
import { confirm, countTokens, esc, fmt } from './util.js';

// Each numbered section can keep a short version and a one-line version next to its full text (m.layers, keyed by section).
// With the curve on, the newest sections go in whole, older ones as their short version, the oldest as the gist (요점).
// Pinned sections, and sections a keyword or the AI router just called in, always go in whole.
export const fadeCfg = m => { const f = m?.fade && typeof m.fade === 'object' ? m.fade : {}; return { on: !!f.on, full: Number.isFinite(+f.full) && f.full !== undefined ? Math.max(0, +f.full) : 8, short: Number.isFinite(+f.short) && f.short !== undefined ? Math.max(0, +f.short) : 20 }; };
// versions picked by hand per section ('long' | 'short' | 'line'); they beat the curve and work with it off
export const fadeForce = m => (m.fadeForce && typeof m.fadeForce === 'object' ? m.fadeForce : {});
export const fadeActive = m => fadeCfg(m).on || Object.keys(fadeForce(m)).length > 0;
export const layersOf = m => (m.layers && typeof m.layers === 'object' ? m.layers : {});
export const layerHash = (text, s) => textHash(text.slice(s.start, s.end).replace(/^[^\n]*\n?/, '').trim());

// a short version this small (tokens, roughly) is not taken down to the gist by the curve
export const GIST_MIN = 200;
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
    if (rc.mode !== 'off' && !atRest()) {
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
        let want = !cfg.on || safe || age < cfg.full ? 'long' : age < cfg.full + cfg.short ? 'short' : 'line';
        // a small section stops at its short version: its gist would save a few dozen tokens and lose most of it
        if (want === 'line' && estTok(layersOf(m)[k]?.short || '') <= GIST_MIN) want = 'short';
        out.set(k, { s, want, why: safe ? 'pin' : '' });
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
2. SHORT: rewrite the section in about 60% of its length, never more than 85% of it
   (a section that is already short may stay near that limit, but must still be shorter).
   Same form as the original: bullets stay bullets, and every label line of the section (PLOT:, NOTES:, any line
   that ends with a colon) stays, in the same order, with its own shortened bullets under it. Keep every fact from step 1.
   Cut mood and repeated feelings. A sex scene shrinks to one bullet of relationship beats (consent, a request to stop, a first, what changed) — nothing about acts or bodies.
   Dialogue: a line you keep in quotation marks is copied exactly from the section — every word, same order,
   nothing trimmed, merged or reworded. Never shorten a quote.
   Keep WHOLE, however long, a line that turns the scene: one the section itself calls out ("the line that changed …"),
   or a confession, promise, vow, declaration, refusal or accusation that the rest of the section reacts to.
   Only minor lines may lose their quotation marks and be said in your own words.
3. LINE: the gist, about half of SHORT (30% of the section): two to four bullets with who did what, what was decided and what changed. No label lines, no mood.
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
- Mara pulled Ren up when a plank broke on the bridge; his leg is cut and untreated.
- The south road is closed, so they go through Varo's market.
- That night Ren told her his sister is dead.

OUTPUT
Exactly this, nothing else:
SHORT:
<short version>
LINE:
<two to four bullets>`;

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
Change the short version (and the gist) of a story-archive section the way the user asks — and nothing else.

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
- Mara saved Ren on the bridge.
- The south road is closed.
REQUEST:
마라 대사는 원문 그대로 넣어줘
Answer:
SHORT:
PLOT:
- A plank broke; Ren cut his leg and Mara pulled him up: "Now you owe me, and I always collect."
- Ivo: the south road is closed.
LINE:
- Mara saved Ren on the bridge.
- The south road is closed.

OUTPUT
Exactly this, nothing else:
SHORT:
<short version>
LINE:
<two to four bullets>`;

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
    const name = { long: '원문', short: '짧게', line: '요점' };
    const into = { long: '원문으로', short: '짧은 버전으로', line: '요점으로' };
    const noteHtml = (p, u) => p ? `지금 <b>${into[u]}</b> 들어가요${p.why === 'pin' ? ' (📌 고정)' : p.why === 'called' ? ' (지금 불려 온 섹션)' : p.why === 'manual' ? ' (직접 고름)' : ''}${u !== p.want ? ` · 고른 건 ${name[p.want]}인데 ${stale ? '원문이 바뀌어서' : '그 버전이 없어서'}` : ''}` : '망각 곡선이 꺼져 있어 원문으로 들어가요';
    const forced = () => fadeForce(getMeta())[sectionKey(s)] || 'auto';
    const now = t => use === t ? ' · 지금 들어감' : '';
    let tab = use && use !== 'long' ? use : (L.short ? 'short' : 'long');
    // (v3, docs/mockups/ext-layers A): the three versions as cards (tap to read one; the one going in is marked), an 자동으로
    // 고르기 switch (off: the card you tap is the one that goes in), then the version's text with 직접 고치기 · 한국어로,
    // 고쳐 달라고 하기 and 초안 모델로 만들기; 닫기 · 저장 at the bottom
    const $root = $(`
      <div class="na_popup na_v2 na_layers na_ly3">
        <div class="na_v2_title"><b>섹션 버전</b><small>${esc(s.title)}</small></div>
        <div class="na_v2_note na_ly_note">${noteHtml(plan, use)}</div>
        ${stale ? '<div class="na_xr_warn slim">' + WARN_SVG + '<div>버전을 만든 뒤에 원문이 바뀌었어요. 저장할 때까지 원문으로 들어가요.</div></div>' : ''}
        <div class="na_ly3_lbl"><span>넣을 버전</span><label class="na_ly3_auto">자동으로 고르기<input type="checkbox" class="na_toggle na_ly3_autoon"${forced() === 'auto' ? ' checked' : ''}></label></div>
        <div class="na_ly3_cards na_ly_tabs">${[['long', '원문'], ['short', '짧게'], ['line', '요점']].map(([t, l]) => `<button type="button" class="na_ly3_card" data-t="${t}"><b>${l}</b><small class="na_ly_tok_${t}"></small></button>`).join('')}</div>
        <div class="na_v2_card na_ly3_body">
          <div class="na_ly_tools">
            <small class="na_ly_trinfo"></small>
            <button type="button" class="na_v2_pillbtn na_ly_edit">${svgA(ICO_A.pen, 13)}<span>직접 고치기</span></button>
            <button type="button" class="na_v2_pillbtn na_ly_tr"><i class="fa-solid fa-language"></i><span>한국어로</span></button>
          </div>
          <div class="na_ly_pane" data-t="long"><div class="na_ly_view na_ly_full"></div></div>
          <div class="na_ly_pane" data-t="short"><div class="na_ly_view"></div><textarea class="text_pole na_ly_short" rows="8" spellcheck="false" hidden placeholder="원문을 1/3쯤으로 줄인 것. 직접 쓰거나 초안 모델로 만들어요."></textarea></div>
          <div class="na_ly_pane" data-t="line"><div class="na_ly_view"></div><textarea class="text_pole na_ly_line" rows="5" spellcheck="false" hidden placeholder="- 누가 무엇을 했고, 무엇이 바뀌었는지 (불릿 2~4개)"></textarea></div>
        </div>
          ${draftReady() ? `<div class="na_ly_ask"><input type="text" class="na_ly_askq" placeholder="고쳐 달라고 하기 (예: 소망 대사는 원문 그대로)" aria-label="고쳐 달라고 하기" enterkeyhint="send"><button type="button" class="na_ly_askgo" aria-label="보내기" title="초안 모델에게 보내기">${svgA('M22 2L11 13M22 2l-7 20-4-9-9-4z', 17)}</button></div>` : ''}
          ${draftReady() ? `<div class="na_ly3_foot"><button type="button" class="na_ly3_tool na_ly_draft">${svgA('<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/>', 13)}초안 모델로 ${L.short || L.line ? '다시 ' : ''}만들기</button></div>` : '<small class="na_v2_foot">⚙ 설정 → AI 모델 → 초안 모델을 정하면 여기서 바로 만들 수 있어요</small>'}
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
        const mm = getMeta(), p2 = fadeActive(mm) ? fadePlan(mm).get(sectionKey(s)) : null, goes = p2 ? fadeUse(mm, mm.text, s, p2.want) : (forced() !== 'auto' ? forced() : null);
        $root.find('.na_ly_tabs button').each(function () { $(this).toggleClass('on', this.dataset.t === tab).toggleClass('goes', this.dataset.t === goes).toggleClass('none', this.dataset.t !== 'long' && !text(this.dataset.t).trim()); });
        $root.find('.na_ly_pane').each(function () { this.hidden = this.dataset.t !== tab; });
        const $pane = $root.find(`.na_ly_pane[data-t="${tab}"]`);
        const raw = text(tab);
        $pane.find('textarea').prop('hidden', !editing);
        $pane.find('.na_ly_view').prop('hidden', editing)
            .html(raw.trim() ? mdBlock(korean ? withLineTr(raw, trMap) : raw) : `<span class="na_ly_empty">${tab === 'line' ? '요점이 아직 없어요' : '짧은 버전이 아직 없어요'} · 직접 쓰거나 초안 모델로 만들어요</span>`);
        $root.find('.na_ly_edit').prop('hidden', tab === 'long').find('span').text(editing ? '다 고쳤어요' : '직접 고치기');
        $root.find('.na_ly_edit').toggleClass('on', editing);
        $root.find('.na_ly_tr').prop('disabled', editing || !raw.trim()).toggleClass('on', korean).find('span').text(korean ? '원문으로' : '한국어로');
        const ls = fillTr(tab), n = ls.filter(l => trMap.has(l)).length;
        $root.find('.na_ly_trinfo').text(editing ? '고친 뒤 아래 저장을 눌러야 들어가요' : korean && n < ls.length ? `${n}/${ls.length}줄 번역됨` : !korean && n ? `번역 ${n === ls.length ? '있음' : `${n}/${ls.length}줄 있음`}` : '');
        if (editing) $pane.find('textarea').trigger('focus');
    };
    const tok = async () => {
        const [a, b, d] = await Promise.all([countTokens(full), countTokens($root.find('.na_ly_short').val()), countTokens($root.find('.na_ly_line').val())]);
        $root.find('.na_ly_tok_long').text(`${fmt(a)} 토큰`);
        $root.find('.na_ly_tok_short').text(b ? `${fmt(b)} 토큰 · ${Math.round(b / Math.max(1, a) * 100)}%` : '없음');
        $root.find('.na_ly_tok_line').text(d ? `${fmt(d)} 토큰 · ${Math.round(d / Math.max(1, a) * 100)}%` : '없음');
        show();
    };
    show(); tok();
    $root.on('click', '.na_ly_tabs button', function () { tab = this.dataset.t; if (tab === 'long') editing = false; if (forced() !== 'auto') setForce(tab); else show(); });
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
    const setForce = async v => {
        await setFadeForce([sectionKey(s)], v);
        const mm = getMeta(), p2 = fadeActive(mm) ? fadePlan(mm).get(sectionKey(s)) : null;
        $root.find('.na_ly_note').html(noteHtml(p2, p2 ? fadeUse(mm, mm.text, s, p2.want) : null));
        show();
    };
    // 자동으로 고르기: on = the curve picks; off = the card being read is the one that goes in
    $root.on('change', '.na_ly3_autoon', function () { setForce(this.checked ? 'auto' : tab); });
    $root.find('textarea').on('input', tok);
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
        if (!dirty() || !await confirm('저장 안 한 고침', '짧은 버전 · 요점을 고친 게 있어요. 저장할까요?', '저장하기')) return;
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
    if (!todo.length) return toastr.info('모든 섹션에 짧게 · 요점 버전이 있어요.');
    if (!await confirm('초안 모델로 채우기', `짧게 · 요점 버전이 없는 섹션 ${todo.length}개를 초안 모델(${drLabel()})로 하나씩 만들까요?${need ? ` 지금 곡선에 필요한 ${need}개부터 해요.` : ''} 섹션마다 요청이 한 번씩 가요. 도중에 멈출 수 있어요.`, '만들기')) return;
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
    // (v3, docs/mockups/ext-fadepick C): what goes in now as one bar on top, then each section with its version as a small
    // menu (자동 · 원문 · 짧게 · 요점; a version not made yet is greyed); 꺼짐 rows are dimmed
    const c = ctx();
    const name = { long: '원문', short: '짧게', line: '요점', off: '꺼짐' };
    let filter = 'all', open = '', multi = false;
    const picked = new Set();
    const $root = $(`
      <div class="na_popup na_v2 na_fp na_fp3">
        <div class="na_v2_title"><b>섹션별 버전</b><small>섹션마다 원문 · 짧게 · 요점 중 무엇을 넣을지</small></div>
        <div class="na_v2_card na_fp3_sum"></div>
        <div class="na_fp3_fl"><div class="na_v2_chips na_fp_filters"></div><button type="button" class="na_linkbtn na_fp3_multi">여러 개 바꾸기</button></div>
        <div class="na_fp_list"></div>
        <div class="na_fp3_more"><button type="button" class="na_fp3_tool na_fp_make" hidden></button></div>
        <div class="na_fp3_bulk" hidden>
          <div class="na_fp3_bh"><label class="na_fp3_allp"><input type="checkbox" class="na_fp3_allbox"><span class="na_fp3_ck na_fp3_allck"></span><span class="na_fp3_n">0개 고름</span></label><small>넣을 버전</small></div>
          <div class="na_fp3_set">${[['auto', '자동'], ['long', '원문'], ['short', '짧게'], ['line', '요점']].map(([v, l]) => `<button type="button" data-v="${v}">${l}</button>`).join('')}</div>
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
        const cnt = { long: 0, short: 0, line: 0, off: 0 };
        all.forEach(r => cnt[r.use]++);
        const manualN = all.filter(r => r.force).length, missN = all.filter(r => !r.muted && (!r.has.short || !r.has.line)).length;
        $root.find('.na_fp3_sum').html(`<div class="na_fp3_sh"><b>지금 들어가는 것</b><small>${all.length}개 섹션</small></div>
          <div class="na_fp3_bar">${['long', 'short', 'line', 'off'].map(u => cnt[u] ? `<i class="u_${u}" style="flex:${cnt[u]}"></i>` : '').join('')}</div>
          <div class="na_fp3_leg">${['long', 'short', 'line', 'off'].map(u => `<span class="u_${u}"><i></i>${name[u]} ${cnt[u]}</span>`).join('')}</div>`);
        $root.find('.na_fp_filters').html([['all', `전체 ${all.length}`], ['manual', `직접 ${manualN}`], ['miss', `버전 없음 ${missN}`]].map(([f, l]) => `<button type="button" data-f="${f}" class="${filter === f ? 'on' : ''}">${l}</button>`).join(''));
        const show = all.filter(r => filter === 'all' || (filter === 'manual' ? r.force : !r.muted && (!r.has.short || !r.has.line)));
        let lastGroup = null;
        $root.find('.na_fp_list').html(show.length ? show.map(r => {
            const head = r.group !== lastGroup ? `${lastGroup !== null ? '</div>' : ''}<div class="na_fp_group">${esc(r.group || '묶음 없음')}</div><div class="na_v2_card na_fp3_card">` : '';
            lastGroup = r.group;
            const [num, ...rest] = r.s.title.split(' — ');
            const nm = rest.join(' — ').replace(/\s*\([^)]*\)\s*$/, '');
            const why = r.muted ? '꺼짐 · 망각 곡선 밖' : [name[r.use], r.force ? '직접' : r.p?.why === 'pin' ? '고정' : r.p?.why === 'called' ? '불려 옴' : '자동', !r.has.short && !r.has.line ? '버전 없음' : ''].filter(Boolean).join(' · ');
            const menu = !multi && open === r.k && !r.muted ? `<div class="na_fp3_menu">${[['auto', '자동'], ['long', '원문'], ['short', '짧게'], ['line', '요점']].map(([v, l]) => `<button type="button" data-v="${v}" class="${(r.force || 'auto') === v ? 'on' : ''}"${(v === 'short' && !r.has.short) || (v === 'line' && !r.has.line) ? ' data-miss="1"' : ''}>${l}${(v === 'short' && !r.has.short) || (v === 'line' && !r.has.line) ? '<small>없음</small>' : ''}</button>`).join('')}</div>` : '';
            const ck = multi ? `<span class="na_fp3_ck${picked.has(r.k) ? ' on' : ''}">${picked.has(r.k) ? svgA(ICO_A.check, 11, 3.4) : ''}</span>` : '';
            return `${head}<div class="na_fp3_row${r.muted ? ' off' : ''}${multi ? ' pickable' : ''}${picked.has(r.k) ? ' picked' : ''}" data-k="${esc(r.k)}">${ck}<span class="na_fp3_tt"><b>${esc(num)}${nm ? ` · ${esc(nm)}` : ''}</b><small>${esc(why)}</small></span>${r.muted ? `<span class="na_fp3_pick off">꺼짐</span>` : `<button type="button" class="na_fp3_pick u_${r.use}">${name[r.use]} ▾</button>`}</div>${menu}`;
        }).join('') + '</div>' : '<div class="na_empty">해당하는 섹션이 없어요.</div>');
        $root.find('.na_fp_make').prop('hidden', !missN || !draftReady()).text(`버전 없는 ${missN}개 초안 모델로 만들기`);
        const vis = show.map(r => r.k);
        $root.find('.na_fp3_multi').text(multi ? '그만 고르기' : '여러 개 바꾸기');
        $root.find('.na_fp3_bulk').prop('hidden', !multi);
        $root.find('.na_fp3_n').text(`${picked.size}개 고름`);
        $root.find('.na_fp3_allbox').prop('checked', vis.length > 0 && vis.every(k => picked.has(k))).prop('indeterminate', picked.size > 0 && !vis.every(k => picked.has(k)));
        $root.find('.na_fp3_set button').prop('disabled', !picked.size);
        const allOn = vis.length > 0 && vis.every(k => picked.has(k));
        $root.find('.na_fp3_allck').toggleClass('on', allOn).html(allOn ? svgA(ICO_A.check, 11, 3.4) : picked.size ? '<i></i>' : '');
    };
    $root.on('click', '.na_fp3_multi', () => { multi = !multi; open = ''; if (!multi) picked.clear(); draw(); });
    $root.on('click', '.na_fp3_row.pickable', function () { const k = String($(this).data('k')); picked.has(k) ? picked.delete(k) : picked.add(k); draw(); });
    $root.on('change', '.na_fp3_allbox', function () { $root.find('.na_fp3_row').each((i, el) => { const k = String($(el).data('k')); this.checked ? picked.add(k) : picked.delete(k); }); draw(); });
    $root.on('click', '.na_fp3_set button', async function () {
        const v = this.dataset.v, keys = [...picked];
        if (!keys.length) return;
        await setFadeForce(keys, v);
        const left = v === 'short' || v === 'line' ? rows().filter(r => picked.has(r.k) && r.p && fadeUse(getMeta(), getMeta().text, r.p.s, v) !== v).length : 0;
        toastr.success(`${keys.length}개를 ${v === 'auto' ? '자동(망각 곡선)' : name[v]}으로 정했어요${left ? ` · ${left}개는 그 버전이 없어서 더 긴 걸로 들어가요` : ''}`);
        picked.clear(); multi = false; draw();
    });
    $root.on('click', '.na_fp_filters button', function () { filter = this.dataset.f; open = ''; draw(); });
    $root.on('click', '.na_fp3_row:not(.pickable) .na_fp3_pick:not(.off)', function () { const k = String($(this).closest('.na_fp3_row').data('k')); open = open === k ? '' : k; draw(); });
    $root.on('click', '.na_fp3_menu button', async function () {
        const k = open, v = this.dataset.v;
        await setFadeForce([k], v);
        if (this.dataset.miss) toastr.info(`그 버전이 아직 없어서 더 긴 걸로 들어가요`);
        open = ''; draw();
    });
    $root.on('click', '.na_fp_make', async function () { await fillFade($(this), rows().filter(r => !r.muted && (!r.has.short || !r.has.line)).map(r => r.k)); draw(); });
    draw();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: false, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

