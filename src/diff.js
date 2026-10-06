// Line and section diffs, and the two-version compare popup.

import { ctx, getMeta, hasChat } from './core.js';
import { groupLabel, parseSections, sectionKey } from './sections.js';
import { sourceRange, srcButton } from './source.js';
import { translateButton } from './translate.js';
import { esc, fmt, timeLabel } from './util.js';

// Line diff (LCS after trimming the shared head/tail). Returns [{ t: ' '|'+'|'-', line }].
export function lineDiff(oldText, newText) {
    const a = oldText.split('\n'), b = newText.split('\n');
    let pre = 0;
    while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
    let suf = 0;
    while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
    const A = a.slice(pre, a.length - suf), B = b.slice(pre, b.length - suf);
    const out = a.slice(0, pre).map(line => ({ t: ' ', line }));
    const n = A.length, m = B.length;
    if (n * m > 6_000_000) {
        A.forEach(line => out.push({ t: '-', line }));
        B.forEach(line => out.push({ t: '+', line }));
    } else {
        const w = m + 1;
        const L = new Uint32Array((n + 1) * w);
        for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
                L[i * w + j] = A[i] === B[j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
            }
        }
        let i = 0, j = 0;
        while (i < n && j < m) {
            if (A[i] === B[j]) { out.push({ t: ' ', line: A[i] }); i++; j++; }
            else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) out.push({ t: '-', line: A[i++] });
            else out.push({ t: '+', line: B[j++] });
        }
        while (i < n) out.push({ t: '-', line: A[i++] });
        while (j < m) out.push({ t: '+', line: B[j++] });
    }
    a.slice(a.length - suf).forEach(line => out.push({ t: ' ', line }));
    return interleaveChanges(out);
}

// Inside each run of changed lines, put every old line right above the new line it became
// (paired by shared words, in order), instead of all removed lines followed by all added ones.
export function interleaveChanges(rows) {
    const toks = l => new Set((l.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []));
    const sim = (x, y) => { if (!x.size || !y.size) return 0; let n = 0; for (const t of x) if (y.has(t)) n++; return n / Math.max(x.size, y.size); };
    const out = [];
    for (let i = 0; i < rows.length;) {
        if (rows[i].t === ' ') { out.push(rows[i++]); continue; }
        let e = i; while (e < rows.length && rows[e].t !== ' ') e++;
        const run = rows.slice(i, e);
        i = e;
        const D = run.filter(r => r.t === '-'), A = run.filter(r => r.t === '+');
        if (!D.length || !A.length || D.length * A.length > 40_000) { out.push(...run); continue; }
        // best in-order pairing (alignment that maximises total similarity; pairs below 0.25 don't count)
        const td = D.map(r => toks(r.line)), ta = A.map(r => toks(r.line));
        const n = D.length, m = A.length, w = m + 1;
        const S = new Float64Array((n + 1) * w);
        for (let x = n - 1; x >= 0; x--) for (let y = m - 1; y >= 0; y--) {
            const s0 = sim(td[x], ta[y]);
            S[x * w + y] = Math.max(S[(x + 1) * w + y], S[x * w + y + 1], s0 >= 0.25 ? s0 + S[(x + 1) * w + y + 1] : 0);
        }
        let x = 0, y = 0;
        while (x < n && y < m) {
            const s0 = sim(td[x], ta[y]);
            if (s0 >= 0.25 && Math.abs(S[x * w + y] - (s0 + S[(x + 1) * w + y + 1])) < 1e-9) { out.push(D[x++], A[y++]); }
            else if (S[(x + 1) * w + y] >= S[x * w + y + 1]) out.push(D[x++]);
            else out.push(A[y++]);
        }
        while (x < n) out.push(D[x++]);
        while (y < m) out.push(A[y++]);
    }
    return out;
}

// word-level diff of two lines: [{t:' '|'-'|'+', s}] (null when too long to bother)
export function wordDiff(a, b) {
    const tok = x => x.match(/[\p{L}\p{N}]+|\s+|[^\p{L}\p{N}\s]/gu) || [];
    const A = tok(a), B = tok(b), n = A.length, m = B.length;
    if (!n || !m || n * m > 400_000) return null;
    const w = m + 1, L = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i * w + j] = A[i] === B[j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
    const out = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
        if (A[i] === B[j]) { out.push({ t: ' ', s: A[i] }); i++; j++; }
        else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) out.push({ t: '-', s: A[i++] });
        else out.push({ t: '+', s: B[j++] });
    }
    while (i < n) out.push({ t: '-', s: A[i++] });
    while (j < m) out.push({ t: '+', s: B[j++] });
    return out;
}

// html for one side of a changed pair, the differing words marked; null when the lines barely share anything
export function markedPair(a, b) {
    const d = wordDiff(a, b);
    if (!d) return null;
    const same = d.filter(x => x.t === ' ' && /\S/.test(x.s)).length, all = d.filter(x => /\S/.test(x.s)).length;
    if (same < all * 0.3) return null;
    const side = t => d.filter(x => x.t === ' ' || x.t === t).map(x => x.t === ' ' ? esc(x.s) : `<mark class="na_diff_hl">${esc(x.s)}</mark>`).join('')
        .replace(/<\/mark>(\s*)<mark class="na_diff_hl">/g, '$1');
    return { old: side('-'), new: side('+') };
}

// pairs each run of '-' rows with the '+' run right after it, line by line
export function diffPairs(rows) {
    const pairs = new Map(); // index of '-' row → index of its '+' row
    for (let i = 0; i < rows.length;) {
        if (rows[i].t !== '-') { i++; continue; }
        let d = i; while (d < rows.length && rows[d].t === '-') d++;
        let a = d; while (a < rows.length && rows[a].t === '+') a++;
        for (let k = 0; k < Math.min(d - i, a - d); k++) pairs.set(i + k, d + k);
        i = a > d ? a : d;
    }
    return pairs;
}

export function renderDiff(rows, context = 2, { src = true } = {}) {
    const keep = new Array(rows.length).fill(false);
    rows.forEach((r, i) => {
        if (r.t === ' ') return;
        for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) keep[k] = true;
    });
    const marked = new Map(); // row index → html with changed words marked
    for (const [d, a] of diffPairs(rows)) {
        const mk = markedPair(rows[d].line, rows[a].line);
        if (mk) { marked.set(d, mk.old); marked.set(a, mk.new); }
    }
    // the section each row sits in, for a "원문" chip at the start of each run of changes
    const m = src && hasChat() ? getMeta() : null;
    const isHead = l => /^#{1,3} /.test(l);
    let headOld = '', headNew = '';
    const heads = rows.map(r => {
        if (isHead(r.line)) { if (r.t !== '+') headOld = r.line; if (r.t !== '-') headNew = r.line; }
        return r.t === '-' ? headOld : headNew;
    });
    let html = '', skipped = 0;
    const flush = () => { if (skipped) html += `<div class="na_diff_skip">··· 같은 줄 ${fmt(skipped)}개 ···</div>`; skipped = 0; };
    rows.forEach((r, i) => {
        if (!keep[i]) { skipped++; return; }
        flush();
        if (m && r.t !== ' ' && (i === 0 || rows[i - 1].t === ' ')) {
            const b = srcButton(m, heads[i], 'chip');
            if (b) html += `<div class="na_diff_src">${b}</div>`;
        }
        const cls = r.t === '+' ? 'na_diff_add' : r.t === '-' ? 'na_diff_del' : 'na_diff_same';
        html += `<div class="${cls}"><span>${r.t === ' ' ? '' : r.t}</span><div class="na_dl">${marked.get(i) ?? (esc(r.line) || '&nbsp;')}</div></div>`;
    });
    flush();
    return html;
}

// Section-by-section diff: each changed section gets a card (added / changed / removed) with its −/+ lines.
// Sections are matched by title, so a renamed section shows as one removed and one added.
export function sectionDiffList(aText, bText) {
    const body = (t, s) => t.slice(s.start, s.end).replace(/^[^\n]*\n?/, '').replace(/^(?:[ \t]*\n)+/, '').trimEnd();
    const A = parseSections(aText), B = parseSections(bText);
    const mapA = new Map(A.map(s => [sectionKey(s), s])), mapB = new Map(B.map(s => [sectionKey(s), s]));
    const out = B.map(s => {
        const k = sectionKey(s), a = mapA.get(k);
        if (!a) return { kind: 'add', s, a: '', b: body(bText, s) };
        const ab = body(aText, a), bb = body(bText, s);
        return { kind: ab.trim() === bb.trim() ? 'same' : 'mod', s, a: ab, b: bb };
    });
    // a removed section goes right after the section that came before it in A
    let prev = null; // the entry in `out` for the A section seen last
    for (const s of A) {
        const k = sectionKey(s);
        if (mapB.has(k)) { prev = out.find(x => x.kind !== 'del' && sectionKey(x.s) === k); continue; }
        const entry = { kind: 'del', s, a: body(aText, s), b: '' };
        out.splice(prev ? out.indexOf(prev) + 1 : 0, 0, entry);
        prev = entry;
    }
    return out;
}

export const DIFF_KIND = { add: '추가', mod: '수정', del: '삭제', same: '같음' };

// fills $host with the count chips, the section cards and the "바뀐 섹션만" toggle
export function renderSectionDiff($host, aText, bText, { tr } = {}) {
    const m = hasChat() ? getMeta() : null;
    const list = sectionDiffList(aText, bText);
    const n = { add: 0, mod: 0, del: 0, same: 0 };
    list.forEach(x => n[x.kind]++);
    const changed = n.add + n.mod + n.del;
    let onlyChanged = true;
    const card = x => {
        const title = x.s.group ? groupLabel(x.s.title) : x.s.title;
        if (x.kind === 'same') return `<div class="na_df2_same"><span class="na_df2_badge same">같음</span><span>${esc(title)}</span></div>`;
        // an added / removed section has no other side: lineDiff('', text) would add one empty −/+ row
        const rows = lineDiff(x.a, x.b).filter(r => !(x.kind === 'add' && r.t === '-') && !(x.kind === 'del' && r.t === '+'));
        // header chip: just "원문" (the message range goes into its tooltip)
        const src = (x.kind !== 'del' && m && !x.s.group ? srcButton(m, x.s.title, 'chip') : '')
            .replace(/ title="([^"]*)"/, (_, t) => ` title="${esc(sourceRange(m, x.s.title)?.label || '')} · ${t}"`)
            .replace(/>[^]*<\/button>$/, '>원문</button>');
        // only the −/+ lines, a "… 같은 줄 N개" row between runs; "−" (not "-") as the minus sign
        const lines = renderDiff(rows, 0, { src: false })
            .replace(/··· 같은 줄 ([\d,]+)개 ···/g, '… 같은 줄 $1개')
            .replace(/<div class="na_diff_del"><span>-<\/span>/g, '<div class="na_diff_del"><span>−</span>');
        return `
          <div class="na_df2_card ${x.kind}">
            <div class="na_df2_head"><span class="na_df2_badge ${x.kind}">${DIFF_KIND[x.kind]}</span><b title="${esc(title)}">${esc(title)}</b>${src}</div>
            ${x.a.trim() || x.b.trim() ? `<div class="na_diff na_df2_lines">${lines}</div>` : '<div class="na_df2_empty">제목만 있어요</div>'}
          </div>`;
    };
    const draw = () => {
        const shown = onlyChanged ? list.filter(x => x.kind !== 'same') : list;
        $host.find('.na_df2_cards').html(changed || !onlyChanged ? shown.map(card).join('') : '<div class="na_empty">내용이 똑같아요.</div>');
        $host.find('.na_df2_only').toggleClass('active', onlyChanged).attr('aria-pressed', String(onlyChanged))
            .text(onlyChanged ? '바뀐 섹션만' : '모든 섹션')
            .attr('title', onlyChanged ? `같은 섹션 ${n.same}개는 숨겼어요 · 누르면 모두 보여요` : '누르면 바뀐 섹션만 보여요');
        tr?.reset();
        syncTr();
    };
    $host.html(`
      <div class="na_df2_counts">
        <span class="add">추가 ${n.add}</span><span class="mod">수정 ${n.mod}</span><span class="del">삭제 ${n.del}</span>
        <span class="na_spacer"></span><span class="na_df2_tr"></span>
      </div>
      <div class="na_df2_cards"></div>
      <div class="na_df2_foot">${n.same ? '<button type="button" class="na_v2_btn na_df2_only"></button>' : ''}</div>`);
    // "한국어로" + a switch; the switch drives the shared translate button, which stays hidden next to it
    const syncTr = () => {
        if (!tr) return;
        const $w = $host.find('.na_df2_tr');
        const busy = tr.prop('disabled');
        $w.toggleClass('busy', busy).find('.na_df2_trlbl').text(busy ? '번역하는 중…' : '한국어로');
        $w.find('input').prop('checked', busy || $host.find('.na_diff_tr').length > 0).prop('disabled', busy);
    };
    if (tr && changed) {
        tr.detach();
        const $w = $host.find('.na_df2_tr');
        $w.append('<label class="na_df2_trsw"><span class="na_df2_trlbl">한국어로</span><input type="checkbox" class="na_toggle"></label>').append(tr);
        $w.find('input').on('change', () => { tr.trigger('click'); syncTr(); });
        tr.data('naTrObs')?.disconnect();
        const obs = new MutationObserver(syncTr);
        obs.observe(tr[0], { attributes: true, attributeFilter: ['disabled'], childList: true, subtree: true });
        tr.data('naTrObs', obs);
    }
    $host.find('.na_df2_only').on('click', () => { onlyChanged = !onlyChanged; draw(); });
    draw();
    return n;
}

export const DF2_ARROW = '<span class="na_df2_arrow"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>';
export const diffSide = (cls, tag, name, sub) => `<div class="na_df2_side ${cls}"><small>${tag}</small><b title="${esc(name)}">${esc(name)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;

export async function openDiff(snap, after = { text: getMeta().text, label: '지금' }, { restore } = {}) {
    const c = ctx();
    const $v = $(`
      <div class="na_popup na_v2 na_df2">
        <div class="na_v2_title"><b>두 버전 비교</b></div>
        <div class="na_df2_sides">
          ${diffSide('old', '이전', '복구 지점', [snap.at ? timeLabel(snap.at) : '', snap.reason].filter(Boolean).join(' · '))}
          ${DF2_ARROW}
          ${diffSide('new', '이후', after.label, `${fmt(after.text.length)}자`)}
        </div>
        <div class="na_df2_body"></div>
      </div>`);
    const $host = $v.find('.na_df2_body');
    const tr = translateButton($host);
    renderSectionDiff($host, snap.text, after.text, { tr });
    if (restore) $host.find('.na_df2_foot').append('<button type="button" class="na_v2_btn primary na_df2_restore">이전으로 복원</button>');
    $v.find('.na_df2_restore').on('click', () => { $v.closest('dialog').find('.popup-button-ok').trigger('click'); setTimeout(restore, 50); });
    await c.callGenericPopup($v, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

export async function openCompare() {
    const c = ctx();
    const m = getMeta();
    const sources = [
        { id: 'now', label: '지금 아카이브', text: m.text },
        ...m.snapshots.map((s, i) => ({ id: `s${i}`, label: `복구 지점 · ${timeLabel(s.at)} · ${s.reason}`, text: s.text })),
        { id: 'file', label: '파일 불러오기…', text: null },
    ];
    const opts = sel => sources.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.label)}</option>`).join('');
    const $root = $(`
      <div class="na_popup na_v2 na_df2">
        <div class="na_v2_title"><b>두 버전 비교</b><small>A에서 B로 바뀐 섹션만 보여줘요. 파일끼리도 비교할 수 있어요</small></div>
        <div class="na_df2_sides">
          <label class="na_df2_side old"><small>이전 · A</small><select class="text_pole na_cmp_a">${opts(m.snapshots.length ? 's0' : 'file')}</select></label>
          ${DF2_ARROW}
          <label class="na_df2_side new"><small>이후 · B</small><select class="text_pole na_cmp_b">${opts('now')}</select></label>
          <input type="file" class="na_cmp_file" accept=".txt,.md,.json,text/plain,application/json" hidden>
        </div>
        <details class="na_v2_more">
          <summary>일부만 비교</summary>
          <input type="text" class="text_pole na_cmp_marker" placeholder="이 줄부터만 비교 (예: # ── Y2) — 비우면 전체">
        </details>
        <div class="na_df2_body na_cmp_diff"><div class="na_empty">A와 B를 고르세요.</div></div>
      </div>`);
    const files = { a: null, b: null };
    let pickingFor = null;
    const cmpTr = translateButton($root.find('.na_cmp_diff'));
    const textOf = side => {
        const id = $root.find(`.na_cmp_${side}`).val();
        if (id === 'file') return files[side]?.text ?? null;
        return sources.find(x => x.id === id)?.text ?? null;
    };
    const cut = (t, marker) => {
        if (!marker) return t;
        const at = t.indexOf(marker);
        return at < 0 ? null : t.slice(at);
    };
    const render = () => {
        const marker = $root.find('.na_cmp_marker').val().trim();
        const a0 = textOf('a'), b0 = textOf('b');
        cmpTr.detach(); // keep its click handler; .html() below would drop it
        if (a0 === null || b0 === null) { $root.find('.na_cmp_diff').html(`<div class="na_empty">파일을 골라 주세요.<br><button type="button" class="na_v2_pillbtn na_cmp_pickfile" data-side="${a0 === null ? 'a' : 'b'}">파일 고르기</button></div>`); return; }
        const a = cut(a0, marker), b = cut(b0, marker);
        if (a === null || b === null) {
            $root.find('.na_cmp_diff').html(`<div class="na_empty">"${esc(marker)}" 줄이 ${a === null && b === null ? '둘 다' : a === null ? 'A에' : 'B에'} 없어요.</div>`);
            return;
        }
        renderSectionDiff($root.find('.na_cmp_diff'), a, b, { tr: cmpTr });
    };
    $root.find('.na_cmp_a, .na_cmp_b').on('change', function () {
        const side = $(this).hasClass('na_cmp_a') ? 'a' : 'b';
        if (this.value === 'file') { pickingFor = side; $root.find('.na_cmp_file').val('').trigger('click'); }
        render();
    });
    $root.find('.na_cmp_file').on('change', async function () {
        const f = this.files?.[0];
        if (!f || !pickingFor) return;
        let text = (await f.text()).replace(/\r\n/g, '\n');
        if (/\.json$/i.test(f.name)) { try { const j = JSON.parse(text); if (typeof j?.data?.text === 'string') text = j.data.text; } catch { /* plain text */ } }
        files[pickingFor] = { name: f.name, text };
        render();
    });
    $root.on('click', '.na_cmp_pickfile', function () { pickingFor = this.dataset.side; $root.find('.na_cmp_file').val('').trigger('click'); });
    let t;
    $root.find('.na_cmp_marker').on('input', () => { clearTimeout(t); t = setTimeout(render, 300); });
    render();
    if ($root.find('.na_cmp_a').val() === 'file') { pickingFor = 'a'; }
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}
