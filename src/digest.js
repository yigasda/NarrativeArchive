// Digests: one short section that stands in for a run of sections in the prompt. The sections stay in the
// archive (and the reader); while a digest is on, only the digest is injected in their place.

import { askCompress, drLabel, draftReady, stripThink } from './ai.js';
import { ctx, getMeta, newId, saveMeta } from './core.js';
import { applyInjection } from './inject.js';
import { langBlock } from './prompts.js';
import { RANGE_HEAD, groupLabel, parseSections, sectionKey, trimEnd } from './sections.js';
import { ICO_A, svgA } from './theme.js';
import { translateLines, trLineOk, withLineTr } from './translate.js';
import { confirm, countTokens, esc, fmt } from './util.js';

export const DIGEST_DEFAULT_TOK = 1200;

export const AI_SYS_DIGEST = `GOAL
Condense a run of story-archive sections into ONE short section that stands in for them in the prompt. The sections stay saved; only your digest is read in their place, so a later scene must still make sense from it.

YOU GET
- SECTIONS: the sections in order, each with its heading line and its text.
- TARGET: the most tokens the digest may use. A token is about three quarters of an English word, so TARGET 1200 is about 900 words. It is a ceiling, not a goal.
- NOTE (sometimes): what the user wants kept or cut. It may be in Korean. It overrides the steps below.

STEPS
1. Read every section. Keep what later scenes depend on: how relationships changed, decisions, promises, secrets that came out, injuries, firsts, the reasons behind big reactions, and where things stand at the end.
2. Cut what only repeats or colours the mood: individual acts, positions, gestures, back-and-forth that changes nothing. A sex scene, however long, becomes one bullet of relationship beats (how consent moved, a request to stop, whether it was a first, what changed afterward) and nothing about the acts, bodies or sensations.
3. Length: only what step 1 needs, and never more than TARGET. Do not fill the budget: a stretch that is mostly one sex scene may need a tenth of it.
4. Form: one heading line "## <prefix> #first–#last — Title (date, place)" covering the whole run (keep the prefix the headings use; if dates or places differ, give the first and the last: "Hathyr 8, noon → night"; no clock times, "5:29 PM" ✗), then "PLOT:", then "- " bullets.
5. Order: bullets follow the order things happened. Never mention an event before the bullet that tells it ("after a later fight, …" ✗).
6. Bullets: one bullet is one turn of the story: what happened, why, and what it changed. Never report a conversation turn by turn ("He asked… She replied… He added…"); fold the exchange into what it revealed, decided or broke.
7. Title: like a book's table of contents, short and concrete; it names the stretch, it does not summarize it. No semicolons.
8. Quotes: at most three in the whole digest, only lines that define the stretch, copied exactly from the sections. Keep each short: if a line runs long, keep the one sentence that matters, never reword it. Tell the rest in your own words.
9. Em dashes: at most one in the bullets. Use commas, semicolons or full stops.
10. Same language as the sections. Add nothing that is not in them: no reading, theme or verdict of your own. A character's reading stays theirs ("in his reckoning, …").

EXAMPLE
SECTIONS:
## #40–#52 — The inn (Spring 4, night, Varo)
PLOT:
- Mara asked Ren to stay; he hesitated, then agreed.
- They talked late; Ren admitted he had never shared a room with anyone since his sister died.
## #53–#71 — The first night (Spring 4, night, Varo)
PLOT:
- Their first night together. Mara asked him to slow down once; he stopped and waited until she said to go on.
- Ren held her afterward and said, "I'm not going anywhere."
TARGET: 120

Answer:
## #40–#71 — The inn (Spring 4, night, Varo)
PLOT:
- Mara asked Ren to stay; he admitted he had not shared a room with anyone since his sister died.
- Their first night together: when she asked him to slow down he stopped and waited for her. Afterward he told her, "I'm not going anywhere."

OUTPUT
Before you output, check: under TARGET (if not, shorten quotes first, then merge bullets), bullets in order, no turn-by-turn bullet, at most three quotes, at most one em dash.
Only the digest section, heading line first. No fences, no comments.`;

export const digestsOf = m => (Array.isArray(m?.digests) ? m.digests : []);

// the archive's numbered sections in order (no group headings), with their keys
const rangedSecs = text => parseSections(text).filter(x => !x.group && RANGE_HEAD.test(x.title));

// where a digest's sections sit now: null when one is gone, or they are no longer next to each other
export function digestSpan(text, d) {
    const all = parseSections(text).filter(x => !x.group);
    const idx = d.keys.map(k => all.findIndex(x => sectionKey(x) === k));
    if (!idx.length || idx.some(i => i < 0) || idx.some((v, i) => i && v !== idx[i - 1] + 1)) return null;
    return { first: all[idx[0]], last: all[idx[idx.length - 1]], secs: idx.map(i => all[i]) };
}

// keys of sections an active digest stands in for → that digest
export function digestedKeys(m) {
    const out = new Map();
    for (const d of digestsOf(m)) {
        if (!d.on || !digestSpan(m.text, d)) continue;
        d.keys.forEach(k => out.set(k, d));
    }
    return out;
}

// the archive text with every active digest in place of its sections (for the injection only)
export function applyDigests(m, text) {
    let out = text;
    const live = digestsOf(m).filter(d => d.on && String(d.text || '').trim());
    // from the back, so earlier offsets stay right
    const spans = live.map(d => ({ d, sp: digestSpan(out, d) })).filter(x => x.sp).sort((a, b) => b.sp.first.start - a.sp.first.start);
    for (const { d, sp } of spans) {
        const block = out.slice(sp.first.start, sp.last.end);
        const tail = block.match(/(?:\s*\n-{3,}[ \t]*)?\s*$/)[0] || '\n\n';
        out = out.slice(0, sp.first.start) + trimEnd(d.text) + tail + out.slice(sp.last.end);
    }
    return out;
}

const rangeOf = title => { const r = String(title).match(RANGE_HEAD); return r ? { prefix: (r[1] || '').trim(), from: Math.min(+r[2], +r[4]), to: Math.max(+r[2], +r[4]) } : null; };
const sectionBody = t => String(t).replace(/(?:\s*\n-{3,}[ \t]*)?\s*$/, '');
const spanLabel = (text, d) => {
    const sp = digestSpan(text, d);
    if (!sp) return '섹션이 바뀌어서 쓸 수 없어요';
    const a = rangeOf(sp.first.title), b = rangeOf(sp.last.title);
    return a && b ? `${a.prefix ? `${a.prefix} ` : ''}#${a.from}–#${b.to} · 섹션 ${sp.secs.length}개` : `섹션 ${sp.secs.length}개`;
};

// 다이제스트: the list (switch, view, edit, remake, delete) and making a new one from picked sections
export async function openDigest(group = null, keys = null) {
    const c = ctx(), m = getMeta();
    m.digests = digestsOf(m);
    // groups that hold numbered sections
    const groups = () => {
        const secs = parseSections(m.text), out = [];
        let cur = { start: -1, label: '(묶음 밖)', secs: [] };
        for (const x of secs) {
            if (x.group) { if (cur.secs.length) out.push(cur); cur = { start: x.start, label: groupLabel(x.title), secs: [] }; continue; }
            if (x.level === 1 && cur.start >= 0) { if (cur.secs.length) out.push(cur); cur = { start: -1, label: '(묶음 밖)', secs: [] }; }
            if (RANGE_HEAD.test(x.title)) cur.secs.push(x);
        }
        if (cur.secs.length) out.push(cur);
        return out;
    };
    let gs = groups();
    let gi = group ? Math.max(0, gs.findIndex(g => g.start === group.start)) : Math.max(0, gs.length - 1);
    const $root = $(`
      <div class="na_popup na_v2 na_dg">
        <div class="na_v2_title"><b>다이제스트</b><small>이어진 섹션을 짧은 섹션 하나로 · 원본은 그대로 두고, 켜져 있는 동안 주입에는 다이제스트만 들어가요</small></div>
        <div class="na_dg_have"></div>
        <div class="na_v2_label">새로 만들기</div>
        ${gs.length ? `<select class="text_pole na_mg_group na_dg_group">${gs.map((g, i) => `<option value="${i}">${esc(g.label)} · 섹션 ${g.secs.length}개</option>`).join('')}</select>` : '<small class="na_v2_note">번호가 있는 섹션이 없어요</small>'}
        <div class="na_mg_pickhead"><small class="na_dim">두 섹션을 누르면 그 사이가 모두 골라져요</small><span class="na_rt_quick"><button type="button" class="na_pchip" data-all="1">전체</button><button type="button" class="na_pchip" data-all="0">비우기</button></span></div>
        <div class="na_mg_list na_dg_list"></div>
        <label class="na_v2_card na_v2_switchrow na_dg_target"><span class="na_cp_txt"><span>최대 길이</span><small class="na_dg_tinfo"></small></span><span class="na_dg_tok"><input type="number" class="text_pole na_dg_tokin" min="100" step="100" value="${DIGEST_DEFAULT_TOK}"><span>토큰</span></span></label>
        <div class="na_ly_ask"><input type="text" class="na_ly_askq na_dg_note" placeholder="메모 (선택 · 예: 정사 파트라 관계 변화만 남겨줘)" aria-label="메모" enterkeyhint="go"><button type="button" class="na_ly_askgo na_dg_go" aria-label="만들기" title="초안 모델로 다이제스트 만들기">${svgA(ICO_A.check, 17, 2.4)}</button></div>
        <div class="na_dg_res" hidden>
          <div class="na_rt_head"><b class="na_dg_restitle"></b><button type="button" class="na_linkbtn na_dg_ko na_dg_resko">한국어로</button></div>
          <div class="na_dg_kotext na_dg_reskotext" hidden></div>
          <textarea class="text_pole na_dg_out" rows="10" spellcheck="false"></textarea>
          <button type="button" class="na_v2_btn primary wide na_dg_save">저장하고 켜기</button>
        </div>
      </div>`);
    // picked in the archive tab: open on their group with them ticked
    let picked = new Set(), draft = null; // draft: { keys, text }
    if (keys?.length) {
        const g = gs.findIndex(x => x.secs.some(y => sectionKey(y) === keys[0]));
        if (g >= 0) { gi = g; picked = new Set(gs[g].secs.map((y, i) => (keys.includes(sectionKey(y)) ? i : -1)).filter(i => i >= 0)); }
    }
    $root.find('.na_dg_group').val(String(gi));
    const secsNow = () => gs[gi]?.secs || [];
    const tokOf = x => Math.ceil(m.text.slice(x.start, x.end).length / 3.6);
    const contiguous = () => { const a = [...picked].sort((x, y) => x - y); return a.every((v, i) => !i || v === a[i - 1] + 1); };
    const covered = () => new Set(digestsOf(m).filter(d => digestSpan(m.text, d)).flatMap(d => d.keys));
    const drawHave = () => {
        const ds = digestsOf(m);
        $root.find('.na_dg_have').html(ds.length ? `<div class="na_v2_label">있는 다이제스트</div><div class="na_rt_list">${ds.map((d, i) => {
            const ok = !!digestSpan(m.text, d);
            const head = String(d.text).split('\n')[0].replace(/^#+\s*/, '');
            return `<div class="na_dg_item ${ok ? '' : 'stale'}" data-i="${i}">
              <div class="na_dg_ihead"><span class="na_rt_txt"><small>${esc(spanLabel(m.text, d))} · 약 ${fmt(d.tok || 0)} 토큰${d.srcTok ? ` (원본 ${fmt(d.srcTok)})` : ''}</small><b>${esc(head)}</b></span>
                <input type="checkbox" class="na_toggle na_dg_on" ${d.on && ok ? 'checked' : ''} ${ok ? '' : 'disabled'} title="${ok ? '켜면 주입에 이 다이제스트가 원본 대신 들어가요' : '가리키던 섹션이 지워졌거나 순서가 바뀌었어요'}"></div>
              <div class="na_dg_iact"><button type="button" class="na_linkbtn na_dg_ko">한국어로</button><button type="button" class="na_linkbtn na_dg_view">보기 · 고치기</button>${ok ? '<button type="button" class="na_linkbtn na_dg_redo">다시 만들기</button>' : ''}<button type="button" class="na_linkbtn na_danger na_dg_del">지우기</button></div>
              <div class="na_dg_kotext" hidden></div>
              <textarea class="text_pole na_dg_edit" rows="8" spellcheck="false" hidden>${esc(d.text)}</textarea>
            </div>`;
        }).join('')}</div>` : '');
    };
    const drawList = () => {
        const cov = covered();
        $root.find('.na_dg_list').html(secsNow().map((x, i) => {
            const r = rangeOf(x.title);
            const name = x.title.replace(RANGE_HEAD, '$5').replace(/^\s*[—–-]\s*/, '');
            return `<label class="na_mg_row ${picked.has(i) ? 'on' : ''}"><input type="checkbox" data-i="${i}" ${picked.has(i) ? 'checked' : ''}>
              <span class="na_rt_txt"><small>${esc(`${r.prefix ? `${r.prefix} ` : ''}#${r.from}–#${r.to}`)}${cov.has(sectionKey(x)) ? ' · 다이제스트 있음' : ''}</small><span>${esc(name)}</span></span></label>`;
        }).join(''));
        const sel = [...picked].map(i => secsNow()[i]);
        const src = sel.reduce((a, x) => a + tokOf(x), 0);
        const ok = picked.size >= 1 && contiguous();
        $root.find('.na_dg_tinfo').text(!picked.size ? '섹션을 고르면 원본 길이가 보여요' : !contiguous() ? '이어진 섹션만 고를 수 있어요' : `고른 원본 약 ${fmt(src)} 토큰 · ${esc(drLabel())}`);
        $root.find('.na_dg_go').prop('disabled', !ok);
    };
    $root.on('change', '.na_dg_list .na_mg_row input', function () {
        const i = Number(this.dataset.i);
        if (this.checked) {
            const others = [...picked];
            picked.add(i);
            if (others.length && !others.some(o => Math.abs(o - i) === 1)) {
                const near = others.reduce((a, o) => (Math.abs(o - i) < Math.abs(a - i) ? o : a), others[0]);
                for (let k = Math.min(near, i); k <= Math.max(near, i); k++) picked.add(k);
            }
        } else picked.delete(i);
        drawList();
    });
    $root.on('click', '.na_mg_pickhead .na_pchip', function () { picked = this.dataset.all === '1' ? new Set(secsNow().map((x, i) => i)) : new Set(); drawList(); });
    $root.find('.na_dg_group').on('change', function () { gi = Number(this.value); picked = new Set(); drawList(); });
    const saveAndInject = async () => { await saveMeta(); applyInjection(); };
    $root.on('change', '.na_dg_on', async function () {
        const d = m.digests[Number($(this).closest('.na_dg_item').data('i'))];
        if (!d) return;
        // one active digest per section: turning this on turns off others that share a section
        if (this.checked) m.digests.forEach(o => { if (o !== d && o.on && o.keys.some(k => d.keys.includes(k))) o.on = false; });
        d.on = this.checked;
        await saveAndInject(); drawHave(); drawList();
    });
    // 한국어로: line by line through the translation model, cached like the reader's translations
    $root.on('click', '.na_dg_ko', async function () {
        const res = $(this).hasClass('na_dg_resko');
        const $box = res ? $root.find('.na_dg_reskotext') : $(this).closest('.na_dg_item').find('.na_dg_kotext');
        if (!$box.prop('hidden')) { $box.prop('hidden', true); return $(this).text('한국어로'); }
        const text = res ? String($root.find('.na_dg_out').val() || '') : String(m.digests[Number($(this).closest('.na_dg_item').data('i'))]?.text || '');
        const lines = [...new Set(text.split('\n').map(l => l.trim()).filter(trLineOk))];
        const $b = $(this).prop('disabled', true).text('번역하는 중…');
        try {
            const ko = await translateLines(lines);
            const map = new Map(lines.map((l, k) => [l, ko[k]]).filter(([, v]) => v));
            $box.text(withLineTr(text, map)).prop('hidden', false);
            $b.text('원문으로');
        } catch (e) {
            console.error('[NarrativeArchive] digest translate', e);
            toastr.error(String(e?.message || e), '번역');
            $b.text('한국어로');
        } finally { $b.prop('disabled', false); }
    });
    $root.on('click', '.na_dg_view', function () {
        const $it = $(this).closest('.na_dg_item'), $ta = $it.find('.na_dg_edit');
        if ($ta.prop('hidden')) { $ta.prop('hidden', false); $(this).text('고친 것 저장'); return; }
        const d = m.digests[Number($it.data('i'))];
        const v = trimEnd(String($ta.val() || ''));
        if (!/^#{1,3}\s/.test(v)) return toastr.warning('첫 줄은 "## #시작–#끝 — 제목" 헤더여야 해요.');
        d.text = v;
        countTokens(v).then(async t => { d.tok = t; await saveAndInject(); drawHave(); toastr.success('다이제스트를 고쳤어요'); });
    });
    $root.on('click', '.na_dg_del', async function () {
        const i = Number($(this).closest('.na_dg_item').data('i'));
        if (!await confirm('다이제스트 지우기', '이 다이제스트를 지울까요? 원본 섹션은 그대로예요.')) return;
        m.digests.splice(i, 1);
        await saveAndInject(); drawHave(); drawList();
    });
    $root.on('click', '.na_dg_redo', function () {
        const d = m.digests[Number($(this).closest('.na_dg_item').data('i'))];
        const sp = d && digestSpan(m.text, d);
        if (!sp) return;
        gs = groups();
        gi = Math.max(0, gs.findIndex(g => g.secs.some(x => sectionKey(x) === d.keys[0])));
        $root.find('.na_dg_group').val(String(gi));
        picked = new Set(secsNow().map((x, i) => (d.keys.includes(sectionKey(x)) ? i : -1)).filter(i => i >= 0));
        $root.find('.na_dg_tokin').val(d.target || DIGEST_DEFAULT_TOK);
        $root.find('.na_dg_note').val(d.note || '');
        drawList();
        $root.find('.na_dg_list')[0].scrollIntoView({ block: 'nearest' });
    });
    let busy = false;
    const go = async () => {
        if (busy || $root.find('.na_dg_go').prop('disabled')) return;
        if (!draftReady()) return toastr.info('⚙ 설정 → AI · 번역 → 초안 모델을 먼저 정해 주세요.', '다이제스트');
        const idx = [...picked].sort((a, b) => a - b), sel = idx.map(i => secsNow()[i]);
        const target = Math.max(100, parseInt($root.find('.na_dg_tokin').val(), 10) || DIGEST_DEFAULT_TOK);
        const note = String($root.find('.na_dg_note').val() || '').trim();
        const src = sel.map(x => sectionBody(m.text.slice(x.start, x.end))).join('\n\n');
        busy = true;
        const $b = $root.find('.na_dg_go').prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i>');
        try {
            const out = stripThink(await askCompress(`SECTIONS:\n${src}\n\nTARGET: ${target}${note ? `\n\nNOTE:\n${note}` : ''}${langBlock(m.text)}`, { system: AI_SYS_DIGEST }))
                .replace(/^```[a-z]*\n?|```\s*$/g, '').trim().split(/\n-{3,}\s*\n/)[0].trim();
            if (!/^#{1,3}\s/.test(out)) throw new Error('초안 모델이 섹션 형태로 답하지 않았어요');
            const [tok, srcTok] = await Promise.all([countTokens(out), countTokens(src)]);
            draft = { keys: sel.map(sectionKey), text: out, target, note, srcTok };
            $root.find('.na_dg_res').prop('hidden', false);
            $root.find('.na_dg_restitle').text(`섹션 ${sel.length}개 · 약 ${fmt(srcTok)} → ${fmt(tok)} 토큰${tok > target * 1.3 ? ' · 목표보다 길어요' : ''}`);
            $root.find('.na_dg_out').val(out);
            $root.find('.na_dg_reskotext').prop('hidden', true).empty(); $root.find('.na_dg_resko').text('한국어로');
            $root.find('.na_dg_res')[0].scrollIntoView({ block: 'nearest' });
        } catch (e) {
            console.error('[NarrativeArchive] digest', e);
            toastr.error(String(e?.message || e), '다이제스트');
        } finally { busy = false; $b.html(svgA(ICO_A.check, 17, 2.4)); drawList(); }
    };
    $root.find('.na_dg_go').on('click', go);
    $root.find('.na_dg_note').on('keydown', e => { if (e.key === 'Enter' && !e.originalEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); go(); } });
    $root.find('.na_dg_save').on('click', async () => {
        if (!draft) return;
        const text = trimEnd(String($root.find('.na_dg_out').val() || ''));
        if (!/^#{1,3}\s/.test(text)) return toastr.warning('첫 줄은 "## #시작–#끝 — 제목" 헤더여야 해요.');
        const tok = await countTokens(text);
        // the new one is on; any other digest over the same sections goes off
        m.digests.forEach(o => { if (o.on && o.keys.some(k => draft.keys.includes(k))) o.on = false; });
        m.digests.push({ id: newId(), keys: draft.keys, text, on: true, tok, srcTok: draft.srcTok, target: draft.target, note: draft.note, at: Date.now() });
        await saveAndInject();
        toastr.success(`다이제스트를 켰어요 · 주입이 약 ${fmt(draft.srcTok)} → ${fmt(tok)} 토큰`, '다이제스트');
        draft = null; picked = new Set();
        $root.find('.na_dg_res').prop('hidden', true);
        drawHave(); drawList();
    });
    drawHave(); drawList();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}
