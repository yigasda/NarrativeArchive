// Who knows what: secrets, who knows them, and the injected block.

import { askAI, withSpinner } from './ai.js';
import { gotoSection } from './ask.js';
import { ctx, getMeta, saveMeta } from './core.js';
import { applyInjection, extraBlocks } from './inject.js';
import { capWords } from './keywords.js';
import { syncPanel } from './panel.js';
import { faceHtml } from './people.js';
import { mountSectionPicker } from './picker.js';
import { RANGE_HEAD, findCited, parseSections, sectionKey, splitTail, tailBlocks } from './sections.js';
import { translateLines } from './translate.js';
import { confirm, countTokens, esc, fmt } from './util.js';

export function knowledgeRows(m) {
    return String(m?.knowledge || '').split('\n').map(l => l.replace(/^\s*[-*]\s*/, '').trim()).filter(l => l.includes('|')).map(l => {
        const parts = l.split('|').map(x => x.trim());
        const field = name => { const p = parts.find(x => x.toLowerCase().startsWith(`${name}:`)); return p ? p.slice(name.length + 1).split(',').map(x => x.trim()).filter(x => x && !/^(none|-|없음)$/i.test(x)) : []; };
        return { fact: parts[0], knows: field('knows'), unaware: field('unaware'), suspects: field('suspects'), src: (parts.find(x => x.toLowerCase().startsWith('src:')) || '').slice(4).trim() };
    }).filter(r => r.fact);
}

export const knowLine = r => `${r.fact} | knows: ${r.knows.join(', ') || 'none'} | unaware: ${r.unaware.join(', ') || 'none'} | suspects: ${r.suspects.join(', ') || 'none'}${r.src ? ` | src: ${r.src}` : ''}`;

// Who is in the story now: the STATE block's "## Name" headings and names in the last few numbered sections
// (not STATE's prose, which mentions old characters in passing). Used to keep "unaware / suspects" to people
// who could actually slip — not everyone who ever appeared.
export function currentCast(m, recent = 4) {
    const text = String(m.text || '');
    const state = tailBlocks(splitTail(text)[1]).filter(b => b.key === 'STATE').map(b => (b.text.match(/^## .*$/gm) || []).join('\n')).join('\n');
    const secs = parseSections(text).filter(x => !x.group && RANGE_HEAD.test(x.title)).slice(-recent);
    const cast = new Set(capWords(state + '\n' + secs.map(x => text.slice(x.start, x.end)).join('\n')));
    return cast.size >= 2 ? cast : null; // too little to judge: don't filter
}
// STATE's "## Name" headings that look like people (for telling the model who is in the story now)
export function castNames(m) {
    const state = tailBlocks(splitTail(String(m.text || ''))[1]).filter(b => b.key === 'STATE').map(b => b.text).join('\n');
    return (state.match(/^## (.+)$/gm) || []).map(h => h.slice(3).trim())
        .filter(h => h.split(/\s+/).length <= 3 && !/^(relationships?|current|household|world|setting|places?|open|notes?|misc|other|status|state)\b/i.test(h));
}

export const inCast = (cast, name) => !cast || [...cast].some(w => name.split(/\s+/).includes(w));

// names in unaware/suspects that are no longer in the story
export function staleUnaware(m, cast = currentCast(m)) {
    if (!cast) return [];
    const out = new Set();
    for (const r of knowledgeRows(m)) for (const n of [...r.unaware, ...r.suspects]) if (!inCast(cast, n)) out.add(n);
    return [...out];
}

// dropEmpty (AI output only): a row nobody in the story is kept from has nothing to protect
export function trimUnaware(text, cast, { dropEmpty = false } = {}) {
    return knowledgeRows({ knowledge: text })
        .map(r => cast ? { ...r, unaware: r.unaware.filter(n => inCast(cast, n)), suspects: r.suspects.filter(n => inCast(cast, n)) } : r)
        .filter(r => !dropEmpty || r.unaware.length || r.suspects.length)
        .map(knowLine).join('\n');
}

export const AI_SYS_KNOW = `GOAL
You help a role-play model avoid one mistake: a character saying or acting on something they could not know.
To do that you write down SECRETS: facts that some CURRENT CAST characters know and other CURRENT CAST characters do not.

YOU GET
- CURRENT CAST: the characters in the story right now.
- CURRENT TABLE: secrets already found in earlier sections, numbered.
- SECTIONS: the next part of the story archive, in order.

A ROW IS ALLOWED ONLY IF ALL THREE ARE TRUE
1. It comes from the SECTIONS you were given.
2. At least one CURRENT CAST character knows it, AND at least one CURRENT CAST character does not know it (or only suspects it).
3. If a character who does not know it mentioned it or acted on it, that would be a mistake.

GOOD ROWS
- Ivo listens to private talks through the wind | knows: Ivo | unaware: Ren
- Ren told only Ivo about her old life | knows: Ivo, Ren | unaware: Mara
- Mara lied to Ren about where she was that night | knows: Mara | unaware: Ren | suspects: Ivo

DO NOT WRITE
- Things every CURRENT CAST character saw, did together, or was told. Nobody to hide it from.
- Events, feelings, or scenes that are not secrets ("they ate together", "she cried", "he was angry").
- Anyone outside the CURRENT CAST in unaware or suspects. People who left the story do not count.
- The same secret again in other words. Something that happens many times is ONE row ("Ivo has often listened through the wind"), not one row per time.

HOW TO WORK
Step 1. Read every section you were given, all the way to the last one. Do not stop early.
Step 2. For each secret you find, look at the CURRENT TABLE:
  - It is already there and nobody new learns it here: write nothing.
  - It is already there but here someone is told, finds out, overhears, or starts to suspect: write UPDATE with that row number.
  - It is not there yet: write NEW.
Step 3. Write only those lines.

OUTPUT: nothing else, English, one line each, exactly like this
NEW | <the secret in one short sentence> | knows: <names> | unaware: <names> | suspects: <names> | src: <the section heading, copied exactly>
UPDATE <row number> | knows: <names> | unaware: <names> | suspects: <names>
Write "none" for an empty list. Use the archive's own spelling of names.
If you have nothing to add or change, write exactly: none`;

export const AI_SYS_KNOW_TIDY = `GOAL
You clean up a table of SECRETS for a role-play: facts that some CURRENT CAST characters know and others do not. The table helps the role-play model avoid a character saying something they could not know.
The table was built section by section, so it has repeats and some rows are out of date.

YOU GET
- ARCHIVE: the whole story. The END of it (the latest sections, STATE and OPEN) is what is true now.
- CURRENT CAST: the characters in the story right now.
- TABLE: the secrets, numbered.

CHECK EVERY ROW, ONE BY ONE
1. Is it the same secret as another row, or the same thing happening again? → MERGE those rows into one.
2. By the END of the archive, did someone from "unaware" or "suspects" find out, get told, or see it come out openly? → KEEP the row with the corrected lists.
3. Is nobody in the CURRENT CAST still kept from it, or is it not really a secret (just an event or a feeling)? → DROP it.
4. Otherwise it is fine → write nothing for it.

EXAMPLES
- Rows 4, 7 and 9 are all "Ivo listened through the wind to Ren" → MERGE 4, 7, 9 | Ivo has often listened through the wind to Ren's private talks | knows: Ivo | unaware: Ren | suspects: none | src: <heading of the first one>
- Row 3 says Ren does not know, but near the end Ren is told → KEEP 3 | knows: Ivo, Ren | unaware: Mara | suspects: none
- Row 5: everyone in the CURRENT CAST knows it now → DROP 5

RULES
- unaware and suspects may only name CURRENT CAST characters.
- Rows you do not mention stay exactly as they are, so you only need to write the changes.

OUTPUT: nothing else, English, one line each, exactly like this
KEEP <number> | knows: <names> | unaware: <names> | suspects: <names>
MERGE <number>, <number>, ... | <the merged secret in one short sentence> | knows: <names> | unaware: <names> | suspects: <names> | src: <section heading, copied exactly>
DROP <number>
Write "none" for an empty list. If nothing needs changing, write exactly: none`;

// One pass over the finished table against the whole archive: merge repeats, update to the end state, drop dead rows.
export async function tidyKnowledge(m) {
    const rows = knowledgeRows(m);
    if (!rows.length) return { merged: 0, dropped: 0, fixed: 0 };
    const cast = castNames(m);
    const table = rows.map((r, k) => `${k + 1}. ${knowLine(r)}`).join('\n');
    const out = await askAI(`[ARCHIVE]\n${m.text}\n\n${cast.length ? `[CURRENT CAST]\n${cast.join(', ')}\n\n` : ''}[TABLE]\n${table}`, { system: AI_SYS_KNOW_TIDY, maxTokens: 4000 });
    const gone = new Set(), extra = [];
    let merged = 0, dropped = 0, fixed = 0;
    const fieldsOf = t => knowledgeRows({ knowledge: `x |${t}` })[0];
    for (const raw of out.split('\n')) {
        const line = raw.replace(/^\s*(?:[-*•])\s*/, '').trim();
        let mt;
        if ((mt = line.match(/^DROP\s*#?(\d+)/i))) { const i = Number(mt[1]) - 1; if (rows[i] && !gone.has(i)) { gone.add(i); dropped++; } continue; }
        if ((mt = line.match(/^KEEP\s*#?(\d+)\s*\|(.*)$/i))) {
            const r = rows[Number(mt[1]) - 1], f = fieldsOf(mt[2]);
            if (!r || !f) continue;
            if (/knows:/i.test(mt[2])) r.knows = f.knows;
            if (/unaware:/i.test(mt[2])) r.unaware = f.unaware;
            if (/suspects:/i.test(mt[2])) r.suspects = f.suspects;
            fixed++; continue;
        }
        if ((mt = line.match(/^MERGE\s*([\d,#\s]+)\|(.*)$/i))) {
            const ids = mt[1].split(/[,\s#]+/).map(Number).filter(n => rows[n - 1]).map(n => n - 1);
            const r = knowledgeRows({ knowledge: mt[2] })[0];
            if (ids.length < 2 || !r) continue;
            ids.forEach(i => gone.add(i));
            if (!r.src) r.src = rows[ids[0]].src;
            extra.push({ at: Math.min(...ids), r });
            merged += ids.length - 1;
        }
    }
    const next = [];
    rows.forEach((r, i) => {
        extra.filter(x => x.at === i).forEach(x => next.push(x.r));
        if (!gone.has(i)) next.push(r);
    });
    m.knowledge = trimUnaware(next.map(knowLine).join('\n'), currentCast(m), { dropEmpty: true });
    return { merged, dropped, fixed, before: rows.length, after: knowledgeRows(m).length };
}

export async function openKnowledge() {
    const c = ctx();
    const m = getMeta();
    const $root = $(`
      <div class="na_popup na_v2 na_kn2">
        <div class="na_v2_title"><b>누가 아는가</b><small class="na_kn2_sub"></small></div>
        <div class="na_kn2_main">
          <button type="button" class="na_v2_btn primary na_kn_ai"><span>AI로 만들기</span></button>
          <button type="button" class="na_v2_btn na_kn_tidy" title="겹치는 줄 합치기 · 끝 시점 기준으로 고치기 · 필요 없는 줄 빼기">AI로 다듬기</button>
        </div>
        <label class="na_v2_card na_kn2_inject na_kn_inject">
          <span class="na_cp_txt"><b>주입하기</b><small>모르는 걸 아는 척하지 않게<span class="na_kn_tok"></span></small></span>
          <input type="checkbox" class="na_toggle">
        </label>
        <div class="na_kn_pickhost"></div>
        <div class="na_check na_check_soft na_kn_stale" hidden></div>
        <div class="na_kn_list"></div>
        <div class="na_kn2_more">
          <button type="button" class="na_linkbtn na_kn_edit">직접 고치기</button>
          <button type="button" class="na_linkbtn na_kn_trbtn">한국어로 보기</button>
          <button type="button" class="na_linkbtn danger na_kn_clear">전체 삭제</button>
        </div>
        <div class="na_kn_editbox" hidden>
          <small class="na_dim">한 줄에 하나: <code>사실 | knows: A, B | unaware: C | suspects: D | src: 섹션 제목</code></small>
          <textarea class="text_pole na_kn_ta" rows="12" spellcheck="false"></textarea>
          <div class="na_row_btns"><button type="button" class="na_btn na_small na_primary na_kn_save">저장</button><button type="button" class="na_btn na_small na_kn_cancel">취소</button></div>
        </div>
      </div>`);
    const secs = () => parseSections(m.text);
    let tr = null;
    const render = () => {
        const rows = knowledgeRows(m);
        $root.find('.na_kn_ai span').text(rows.length ? 'AI로 더하기 · 고치기' : 'AI로 만들기');
        $root.find('.na_kn_clear, .na_kn_tidy').prop('hidden', !String(m.knowledge || '').trim());
        $root.find('.na_kn2_main').toggleClass('one', !String(m.knowledge || '').trim());
        const castN = currentCast(m)?.size || 0;
        $root.find('.na_kn2_sub').text(`비밀 ${rows.length}개${castN ? ` · 지금 인물 ${castN}명 기준` : ''}`);
        const stale = staleUnaware(m);
        $root.find('.na_kn_stale').prop('hidden', !stale.length).html(stale.length
            ? `<i class="fa-solid fa-user-slash"></i><div class="na_kn_stale_txt">지금 이야기에 안 나오는 인물이 '모름'·'짐작'에 있어요: <b>${stale.map(esc).join(', ')}</b><small class="na_dim">STATE의 인물 제목과 최근 섹션 4개에 나오는 인물만 남겨요</small></div><button type="button" class="na_btn na_small na_kn_trim">빼기</button>` : '');
        $root.find('.na_kn_inject input').prop('checked', !!m.knowInject);
        const legend = '<div class="na_kn2_legend"><span><span class="na_kn2_k mini">S</span>알아요</span><span><span class="na_kn2_s mini">S<b>?</b></span>짐작</span><span><span class="na_kn2_u">S</span>몰라요</span></div>';
        $root.find('.na_kn_list').html(rows.length ? legend + rows.map((r, i) => {
            const s = r.src ? findCited(secs(), r.src) : null;
            const k = r.knows.map(x => `<span class="na_kn2_k">${faceHtml(x, 22)}${esc(x)}</span>`).join('');
            const su = r.suspects.map(x => `<span class="na_kn2_s">${esc(x)}<b>?</b></span>`).join('');
            const u = r.unaware.map(x => `<span class="na_kn2_u">${esc(x)}</span>`).join('');
            const secret = r.unaware.length > 0;
            return `<div class="na_kn_row na_kn2_card ${secret ? 'secret' : ''}" data-i="${i}">
              <div class="na_kn_fact">${esc(r.fact)}${tr?.[i] ? `<div class="na_kn_tr">${esc(tr[i])}</div>` : ''}</div>
              <div class="na_kn_people">${k}${su}${u}${!k && !su && !u ? '<span class="na_v2_note">아직 아무도</span>' : ''}</div>
              <div class="na_kn2_foot">
                ${s ? `<button type="button" class="na_cite" data-start="${s.start}" title="${esc(s.title)}">${esc((s.title.match(/^(?:\S+\s+)?#\d+\s*[–—~-]\s*#?\d+/) || [s.title.slice(0, 24)])[0])}</button>` : '<span></span>'}
                <small>${secret ? `${r.unaware.map(esc).join(', ')}에겐 비밀` : r.knows.length ? '모두 알아요' : ''}</small>
                <button type="button" class="na_kn_del" title="이 줄 삭제" aria-label="이 줄 삭제"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
              </div>
            </div>`;
        }).join('')
            : '<div class="na_empty">아직 없어요. AI로 만들거나 직접 적어 주세요.</div>');
        const blk = extraBlocks({ ...m, knowInject: true, voiceInject: false });
        if (blk) countTokens(blk).then(t => $root.find('.na_kn_tok').text(` · 약 ${fmt(t)} 토큰`)); else $root.find('.na_kn_tok').text('');
    };
    render();
    const save = async () => { await saveMeta(); applyInjection(); syncPanel(); render(); };
    $root.find('.na_kn_inject input').on('change', async function () { m.knowInject = this.checked; await save(); });
    // AI: chosen sections a few at a time; each part updates the table built so far
    m.knowMined = Array.isArray(m.knowMined) ? m.knowMined : [];
    const picker = mountSectionPicker($root.find('.na_kn_pickhost'), {
        m, title: 'AI가 읽을 섹션', goLabel: '읽고 정리하기', doneLabel: '읽음',
        doneKeys: () => new Set(m.knowMined),
        extraFoot: '<label class="checkbox_label na_kn_fresh"><input type="checkbox"><span>지금 표는 버리고 처음부터 만들기</span></label>',
        onGo: async (parts, step, stepDone) => {
            if ($root.find('.na_kn_fresh input').prop('checked')) {
                if (knowledgeRows(m).length && !await confirm('처음부터 만들기', '지금 표를 지우고 고른 섹션으로 새로 만들까요?')) return;
                m.knowledge = ''; m.knowMined = []; tr = null;
                $root.find('.na_kn_fresh input').prop('checked', false);
            }
            // each part answers only with NEW rows and UPDATEs to numbered rows; the table is merged here
            const cast = castNames(m);
            const factKey = t => String(t).toLowerCase().replace(/[^a-z0-9가-힣]+/g, ' ').trim();
            let added = 0, updated = 0;
            for (const [i, part] of parts.entries()) {
                await step(part, i);
                const rows = knowledgeRows(m);
                const table = rows.map((r, k) => `${k + 1}. ${knowLine(r)}`).join('\n');
                const out = await askAI(`${cast.length ? `[CURRENT CAST]\n${cast.join(', ')}\n\n` : ''}[CURRENT TABLE]\n${table || '(empty)'}\n\n[SECTIONS]\n${picker.text(part)}`, { system: AI_SYS_KNOW, maxTokens: 4000 });
                const seen = new Set(rows.map(r => factKey(r.fact)));
                let understood = /^\s*none\.?\s*$/i.test(out);
                for (const raw of out.split('\n')) {
                    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
                    const up = line.match(/^UPDATE\s*#?(\d+)\s*\|(.*)$/i);
                    if (up) {
                        const r = rows[Number(up[1]) - 1];
                        if (!r) continue;
                        const f = knowledgeRows({ knowledge: `x |${up[2]}` })[0];
                        if (!f) continue;
                        if (/knows:/i.test(up[2])) r.knows = f.knows;
                        if (/unaware:/i.test(up[2])) r.unaware = f.unaware;
                        if (/suspects:/i.test(up[2])) r.suspects = f.suspects;
                        updated++; understood = true;
                        continue;
                    }
                    const body = line.replace(/^NEW\s*\|\s*/i, '');
                    if (!body.includes('|') || !/knows:/i.test(body)) continue;
                    const r = knowledgeRows({ knowledge: body })[0];
                    if (!r) continue;
                    understood = true;
                    if (seen.has(factKey(r.fact))) continue;
                    seen.add(factKey(r.fact));
                    rows.push(r); added++;
                }
                if (!understood) throw new Error('AI 답을 표로 못 읽었어요');
                m.knowledge = trimUnaware(rows.map(knowLine).join('\n'), currentCast(m), { dropEmpty: true }); tr = null;
                m.knowMined = [...new Set([...m.knowMined, ...part.map(sectionKey)])];
                await save();
                stepDone();
            }
            await step(null, parts.length - 1, '표 다듬는 중…');
            const t = await tidyKnowledge(m); tr = null;
            await save();
            toastr.success(`새로 ${added}개${updated ? ` · 고친 줄 ${updated}개` : ''} · 다듬기: 합침 ${t.merged} · 뺌 ${t.dropped} → 지금 표 ${knowledgeRows(m).length}개. 틀린 건 직접 고쳐 주세요.`);
        },
    });
    $root.find('.na_kn_ai').on('click', function () { $(this).toggleClass('active', picker.toggle()); });
    $root.find('.na_kn_tidy').on('click', async function () {
        const t = await withSpinner($(this), '다듬는 중…', () => tidyKnowledge(m));
        if (!t) return;
        tr = null; await save();
        toastr.success(`합침 ${t.merged} · 뺌 ${t.dropped} · 고침 ${t.fixed} → ${t.before}개에서 ${t.after}개로`);
    });
    $root.on('click', '.na_kn_trim', async () => { m.knowledge = trimUnaware(m.knowledge, currentCast(m)); tr = null; await save(); });
    $root.find('.na_kn_edit').on('click', () => { $root.find('.na_kn_ta').val(m.knowledge || ''); $root.find('.na_kn_editbox').prop('hidden', false); $root.find('.na_kn_list').prop('hidden', true); });
    $root.find('.na_kn_cancel').on('click', () => { $root.find('.na_kn_editbox').prop('hidden', true); $root.find('.na_kn_list').prop('hidden', false); });
    $root.find('.na_kn_save').on('click', async () => { m.knowledge = $root.find('.na_kn_ta').val().trim(); tr = null; $root.find('.na_kn_cancel').trigger('click'); await save(); });
    $root.find('.na_kn_trbtn').on('click', async function () {
        if (tr) { tr = null; render(); return; }
        const rows = knowledgeRows(m);
        if (!rows.length) return;
        const out = await withSpinner($(this), '번역하는 중…', () => translateLines(rows.map(r => r.fact)));
        if (out) { tr = out; render(); }
    });
    $root.on('click', '.na_cite[data-start]', function () { const st = Number(this.dataset.start); $root.closest('dialog').find('.popup-button-ok').trigger('click'); gotoSection(st); });
    // delete one row: drop the line that produced the i-th row
    $root.on('click', '.na_kn_del', async function () {
        const i = Number($(this).closest('.na_kn_row').data('i'));
        let n = -1;
        const lines = String(m.knowledge || '').split('\n');
        const at = lines.findIndex(l => knowledgeRows({ knowledge: l }).length && ++n === i);
        if (at < 0) return;
        lines.splice(at, 1);
        m.knowledge = lines.join('\n').trim();
        if (tr) tr.splice(i, 1);
        await save();
    });
    $root.find('.na_kn_clear').on('click', async () => {
        if (!await confirm('전체 삭제', '누가 아는가 표를 모두 지울까요? 되돌릴 수 없어요.')) return;
        m.knowledge = ''; m.knowMined = []; tr = null;
        await save();
        toastr.success('누가 아는가 표를 비웠어요');
    });
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}
