// 꼭 남길 장면: stretches of the chat the user wants kept in detail, each with a short note on why.
// Kept in the chat's archive record by message number, like the archive's own headings. Compression gets the notes as
// instructions, the forgetting curve leaves sections holding them whole.

import { ctx, getMeta, hasChat, saveMeta } from './core.js';
import { RANGE_HEAD } from './sections.js';
import { confirm, esc } from './util.js';

export const keepsOf = m => (Array.isArray(m?.keeps) ? m.keeps : []);
export const keepsIn = (m, from, to) => keepsOf(m).filter(k => k.from <= to && k.to >= from).sort((a, b) => a.from - b.from);
export const isKeptAt = (m, i) => keepsOf(m).some(k => i >= k.from && i <= k.to);
export const keepLabel = k => (k.from === k.to ? `#${k.from}` : `#${k.from}–#${k.to}`);

// the instruction a compress request carries for the stretches inside its range
export function keepNote(m, from, to) {
    const ks = keepsIn(m, from, to);
    if (!ks.length) return '';
    return `KEEP WHOLE: the user marked these stretches of the raw log. Give each one its own bullets: every step in order, why each happened, and any quoted line exactly as it was said. Do not cut them for space.\n${ks.map(k => `- ${keepLabel(k)}${k.note ? `: ${k.note}` : ''}`).join('\n')}`;
}

// does a "#a–#b" section cover one of them?
export function sectionKept(m, title) {
    const r = String(title || '').match(RANGE_HEAD);
    if (!r) return false;
    const a = Math.min(+r[2], +r[4]), b = Math.max(+r[2], +r[4]);
    return keepsIn(m, a, b).length > 0;
}

const save = async () => { await saveMeta(); (await import('./inject.js')).applyInjection(); (await import('./panel.js')).syncPanel(); };

// stretches that overlap or touch become one, their notes kept side by side
export function mergeKeeps(list) {
    const out = [];
    for (const k of [...list].sort((x, y) => x.from - y.from || y.to - x.to)) {
        const last = out[out.length - 1];
        if (last && k.from <= last.to + 1) {
            last.to = Math.max(last.to, k.to);
            const notes = [last.note, k.note].map(x => String(x || '').trim()).filter(Boolean);
            last.note = [...new Set(notes)].join(' · ');
        } else out.push({ ...k });
    }
    return out;
}

// add or change one; it joins any stretch it overlaps or touches instead of standing next to it
export async function putKeep(from, to, note, id = null) {
    const m = getMeta();
    m.keeps = keepsOf(m).slice();
    const a = Math.min(from, to), b = Math.max(from, to);
    const hit = m.keeps.find(k => (id ? k.id === id : k.from === a && k.to === b));
    if (hit) Object.assign(hit, { from: a, to: b, note });
    else m.keeps.push({ id: `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, from: a, to: b, note, at: Date.now() });
    m.keeps = mergeKeeps(m.keeps);
    await save();
}

export async function dropKeep(id) {
    const m = getMeta();
    m.keeps = keepsOf(m).filter(k => k.id !== id);
    await save();
}

// the small form: numbers and the note. Returns true when saved
export async function editKeep({ from, to, note = '', id = null } = {}) {
    if (!hasChat()) return false;
    const c = ctx();
    const last = Math.max(0, (c.chat?.length || 1) - 1);
    const $f = $(`
      <div class="na_popup na_v2 na_kp_form">
        <div class="na_v2_title"><b>꼭 남길 장면</b><small>압축할 때 이 구간은 자세히, 중요한 대사는 그대로 남겨요</small></div>
        <div class="na_kp_range"><span>#</span><input type="number" class="text_pole na_kp_from" min="0" max="${last}"><span>부터 #</span><input type="number" class="text_pole na_kp_to" min="0" max="${last}"><span>까지</span></div>
        <textarea class="text_pole na_kp_note" rows="3" placeholder="왜 남기는지 한 줄 · 예: 고백 장면, 대사 다 살려"></textarea>
        <small class="na_v2_note">메모는 압축 지시에 그대로 들어가요</small>
      </div>`);
    $f.find('.na_kp_from').val(Number.isFinite(from) ? from : last);
    $f.find('.na_kp_to').val(Number.isFinite(to) ? to : Number.isFinite(from) ? from : last);
    $f.find('.na_kp_note').val(note);
    let vals = null;
    $f.on('input change', 'input, textarea', () => { vals = read(); });
    const read = () => ({ a: parseInt($f.find('.na_kp_from').val(), 10), b: parseInt($f.find('.na_kp_to').val(), 10), note: String($f.find('.na_kp_note').val() || '').trim() });
    vals = read();
    const ok = await c.callGenericPopup($f, c.POPUP_TYPE.CONFIRM, '', { okButton: '저장', cancelButton: '취소', leftAlign: true });
    if (!ok) return false;
    const v = vals;
    if (!Number.isFinite(v.a) || !Number.isFinite(v.b) || v.a < 0 || v.b < 0) { toastr.warning('메시지 번호를 넣어 주세요'); return false; }
    await putKeep(v.a, v.b, v.note, id);
    toastr.success(`꼭 남길 장면에 적었어요: ${keepLabel({ from: Math.min(v.a, v.b), to: Math.max(v.a, v.b) })}`, '서사 아카이브', { timeOut: 3000 });
    return true;
}

// the list: every stretch with its note, to open, change or drop
export async function openKeeps() {
    if (!hasChat()) return toastr.info('채팅을 먼저 여세요.');
    const c = ctx();
    const $root = $(`
      <div class="na_popup na_v2 na_kp">
        <div class="na_v2_title"><b>꼭 남길 장면</b><small>압축할 때 자세히 · 오래돼도 안 줄어요</small></div>
        <div class="na_kp_list"></div>
        <div class="na_kp_pick">
          <div class="na_kp_pick_head"><b>탭해서 고르기</b><small class="na_kp_hint"></small><span class="na_spacer"></span><button type="button" class="na_linkbtn na_kp_add">번호로 적기</button></div>
          <div class="na_kp_msgs"></div>
        </div>
      </div>`);
    // 탭해서 고르기: the messages not compressed yet, one line each; the scene's first line, then its last
    const { cleanMessage } = await import('./extract.js');
    const chat = c.chat || [];
    const m0 = getMeta();
    // stretches saved before they were joined: join them now
    if (keepsOf(m0).length !== mergeKeeps(keepsOf(m0)).length) { m0.keeps = mergeKeeps(keepsOf(m0)); await saveMeta(); }
    const lo = Math.max(0, Number(m0.boundary) >= 0 ? Number(m0.boundary) + 1 : 0, chat.length - 400);
    let start = null;
    const opened = new Set(); // rows held down: their whole message shows under them
    const hint = () => $root.find('.na_kp_hint').text(start === null ? '장면 첫 메시지를 탭하세요 · 꾹 누르면 전체 보기' : `#${start}부터 · 끝 메시지를 탭하세요 (같은 줄을 한 번 더 누르면 그 메시지만)`);
    // each message cleaned once, not on every redraw
    const clean = new Map();
    const cleanOf = i => { if (!clean.has(i)) clean.set(i, cleanMessage(String(chat[i]?.mes || ''), { stripTags: true }).trim()); return clean.get(i); };
    const drawMsgs = () => {
        const mm = getMeta();
        const rows = [];
        for (let i = lo; i < chat.length; i++) {
            const x = chat[i];
            if (!x || x.is_system) continue;
            const t = cleanOf(i).replace(/\s+/g, ' ');
            rows.push(`<button type="button" class="na_kp_msg ${isKeptAt(mm, i) ? 'kept' : ''} ${start === i ? 'start' : ''} ${opened.has(i) ? 'open' : ''}" data-i="${i}"><b>#${i}</b><span class="na_kp_who">${esc(x.name || '')}</span><span class="na_kp_line">${esc(t.slice(0, 90)) || '<span class="na_dim">(비어 있음)</span>'}</span></button>`
                + (opened.has(i) ? `<div class="na_kp_full" data-i="${i}">${esc(cleanOf(i)).replace(/\n/g, '<br>')}<button type="button" class="na_linkbtn na_kp_fold">접기</button></div>` : ''));
        }
        $root.find('.na_kp_msgs').html(rows.join('') || '<div class="na_empty">압축 안 된 메시지가 없어요.</div>');
        hint();
    };
    const render = () => {
        const ks = keepsOf(getMeta());
        $root.find('.na_kp_list').html(ks.length ? ks.map(k => `
          <div class="na_v2_card na_kp_item" data-id="${esc(k.id)}">
            <button type="button" class="na_cite na_kp_src" title="원문 보기">${esc(keepLabel(k))}</button>
            <span class="na_kp_txt">${k.note ? esc(k.note) : '<span class="na_dim">메모 없음</span>'}</span>
            <button type="button" class="na_linkbtn na_kp_edit">고치기</button>
            <button type="button" class="na_linkbtn na_danger na_kp_del">지우기</button>
          </div>`).join('') : '<div class="na_empty">아직 없어요. 아래에서 장면 첫 메시지와 끝 메시지를 탭하세요.</div>');
        drawMsgs();
    };
    // 꾹 누르기 (or right-click): open or close the whole message, without picking it
    let held = null, heldFired = false;
    const toggle = i => { opened.has(i) ? opened.delete(i) : opened.add(i); const top = $root.find('.na_kp_msgs').scrollTop(); drawMsgs(); $root.find('.na_kp_msgs').scrollTop(top); };
    $root.on('pointerdown', '.na_kp_msg', function () { const i = Number(this.dataset.i); heldFired = false; clearTimeout(held); held = setTimeout(() => { heldFired = true; toggle(i); }, 500); });
    $root.on('pointerup pointerleave pointercancel', '.na_kp_msg', () => clearTimeout(held));
    $root.on('scroll', '.na_kp_msgs', () => clearTimeout(held));
    // a phone's own long-press (contextmenu) can come before or after the timer: only one of them opens the row
    $root.on('contextmenu', '.na_kp_msg, .na_kp_full', function (e) { e.preventDefault(); clearTimeout(held); if (!heldFired && $(this).hasClass('na_kp_msg')) toggle(Number(this.dataset.i)); heldFired = true; });
    // the whole message closes only from its 접기 (a tap that clears a selection must not close it)
    $root.on('click', '.na_kp_fold', function (e) { e.stopPropagation(); toggle(Number($(this).closest('.na_kp_full').data('i'))); });
    $root.on('click', '.na_kp_msg', async function () {
        if (heldFired) { heldFired = false; return; }
        const i = Number(this.dataset.i);
        if (start === null) { start = i; $(this).addClass('start'); return hint(); }
        const a = Math.min(start, i), b = Math.max(start, i);
        start = null;
        if (keepsOf(getMeta()).some(k => k.from <= a && k.to >= b)) { render(); return toastr.info(`이미 남겨 둔 구간이에요 (${keepLabel({ from: a, to: b })})`, '서사 아카이브', { timeOut: 2500 }); }
        // the list changes at once; saving and rebuilding what goes in follow in the background
        const saving = putKeep(a, b, '');
        render();
        saving.catch(e => toastr.error(String(e?.message || e), '꼭 남길 장면'));
        toastr.success(`꼭 남길 장면: ${keepLabel({ from: a, to: b })}`, '서사 아카이브', { timeOut: 2500 });
    });
    const byId = el => keepsOf(getMeta()).find(k => k.id === String($(el).closest('.na_kp_item').data('id')));
    $root.on('click', '.na_kp_add', async () => { if (await editKeep()) render(); });
    $root.on('click', '.na_kp_edit', async function () { const k = byId(this); if (k && await editKeep(k)) render(); });
    $root.on('click', '.na_kp_del', async function () {
        const k = byId(this);
        if (!k || !await confirm('꼭 남길 장면 지우기', `목록에서 ${esc(keepLabel(k))} 구간을 지울까요? 아카이브는 그대로예요.`)) return;
        await dropKeep(k.id); render();
    });
    $root.on('click', '.na_kp_src', async function () { const k = byId(this); if (k) (await import('./source.js')).openSource(k.from, k.to, keepLabel(k)); });
    render();
    // the newest messages are where the scene usually just happened: open at the bottom
    setTimeout(() => { const el = $root.find('.na_kp_msgs')[0]; if (el) el.scrollTop = el.scrollHeight; }, 0);
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// 3.69.0 put a star on the message itself; those become one-message stretches here, once
export async function moveOldStars() {
    if (!hasChat()) return;
    const c = ctx();
    const ids = (c.chat || []).flatMap((x, i) => (x?.extra?.na_star ? [i] : []));
    if (!ids.length) return;
    const m = getMeta();
    m.keeps = keepsOf(m).slice();
    for (const i of ids) {
        if (!m.keeps.some(k => k.from <= i && k.to >= i)) m.keeps.push({ id: `k${i.toString(36)}${Math.random().toString(36).slice(2, 5)}`, from: i, to: i, note: '', at: Date.now() });
        delete c.chat[i].extra.na_star;
    }
    m.keeps.sort((x, y) => x.from - y.from);
    await saveMeta();
    await c.saveChat?.();
    document.querySelectorAll('#chat .na_mes_star, #chat .na_star_badge').forEach(el => el.remove());
}
