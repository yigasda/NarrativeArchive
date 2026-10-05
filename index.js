// 서사 아카이브 (Narrative Archive)
// You write the archive. This extension stores it per chat, injects it,
// hides already-compressed messages, extracts raw ranges, and shows token counts.

const MODULE = 'narrative_archive';
const PROMPT_KEY = 'narrative_archive_injection';

const DEFAULT_META = Object.freeze({
    text: '',
    boundary: -1,   // last message index covered by the archive
    keep: 1,        // how many compressed messages stay visible
    enabled: true,
    depth: 1,
    role: 0,        // 0 system, 1 user, 2 assistant
});

const ctx = () => SillyTavern.getContext();

// ---------------------------------------------------------------- state

function hasChat() {
    const c = ctx();
    return !!(c.chatId || c.getCurrentChatId?.());
}

function getMeta() {
    const md = ctx().chatMetadata;
    if (!md) return null;
    if (!md[MODULE] || typeof md[MODULE] !== 'object') md[MODULE] = structuredClone(DEFAULT_META);
    for (const k of Object.keys(DEFAULT_META)) {
        if (!Object.hasOwn(md[MODULE], k)) md[MODULE][k] = DEFAULT_META[k];
    }
    return md[MODULE];
}

async function saveMeta() {
    await ctx().saveMetadata();
}

// ---------------------------------------------------------------- helpers

const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fmt = n => Number(n || 0).toLocaleString();

async function countTokens(text) {
    if (!text) return 0;
    try { return await ctx().getTokenCountAsync(text); }
    catch { return Math.round(text.length / 3); }
}

function download(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

async function copyText(text, fallbackEl) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        if (fallbackEl) {
            fallbackEl.focus();
            fallbackEl.select();
            try { if (document.execCommand('copy')) return true; } catch { /* ignore */ }
        }
        return false;
    }
}

function chatLabel() {
    const c = ctx();
    const id = String(c.getCurrentChatId?.() || c.chatId || 'chat');
    return id.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

function nowStamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}-${p(d.getMinutes())}`;
}

// ---------------------------------------------------------------- injection

function applyInjection() {
    const c = ctx();
    const m = hasChat() ? getMeta() : null;
    if (!m || !m.enabled || !m.text.trim()) {
        c.setExtensionPrompt(PROMPT_KEY, '', 1, 1);
        return;
    }
    c.setExtensionPrompt(PROMPT_KEY, m.text, 1, Math.max(0, Number(m.depth) || 0), false, Number(m.role) || 0);
}

// ---------------------------------------------------------------- hiding

async function applyHide({ silent = false } = {}) {
    const m = getMeta();
    if (!m || m.boundary < 0) {
        if (!silent) toastr.info('먼저 경계선(아카이브가 몇 번까지 다루는지)을 정해 주세요.');
        return;
    }
    const hideEnd = m.boundary - Math.max(0, Number(m.keep) || 0);
    if (hideEnd < 0) {
        if (!silent) toastr.info('숨길 메시지가 없습니다.');
        return;
    }
    await ctx().executeSlashCommandsWithOptions(`/hide 0-${hideEnd}`, { handleParserErrors: true, handleExecutionErrors: true });
    if (!silent) toastr.success(`#0 ~ #${hideEnd} 숨김 (마지막 ${m.keep}개는 남김)`);
}

// ---------------------------------------------------------------- extraction

function buildExtract(start, end) {
    const chat = ctx().chat || [];
    const out = [];
    for (let i = Math.max(0, start); i <= Math.min(end, chat.length - 1); i++) {
        const msg = chat[i];
        if (!msg) continue;
        const text = String(msg.mes ?? '').trim();
        if (!text) continue;
        out.push({ i, name: msg.name || (msg.is_user ? 'User' : 'Char'), text });
    }
    return out;
}

const extractToText = items => items.map(x => `[${x.i}] ${x.name}:\n${x.text}`).join('\n\n');

// ---------------------------------------------------------------- sections

function parseSections(text) {
    const re = /^#{1,3} .*$/gm;
    const heads = [];
    let m;
    while ((m = re.exec(text)) !== null) heads.push({ start: m.index, title: m[0] });
    const sections = [];
    if (!heads.length) {
        if (text.trim()) sections.push({ title: '(제목 없음)', start: 0, end: text.length });
        return sections;
    }
    if (text.slice(0, heads[0].start).trim()) sections.push({ title: '(머리말)', start: 0, end: heads[0].start });
    heads.forEach((h, idx) => {
        const end = idx + 1 < heads.length ? heads[idx + 1].start : text.length;
        sections.push({ title: h.title.replace(/^#+\s*/, ''), start: h.start, end });
    });
    return sections;
}

function highlight(text, query) {
    const safe = esc(text);
    if (!query) return safe;
    return safe.replace(new RegExp(escRe(esc(query)), 'gi'), s => `<mark>${s}</mark>`);
}

// ---------------------------------------------------------------- status

let statusTimer = null;
function refreshStatusSoon() {
    clearTimeout(statusTimer);
    statusTimer = setTimeout(refreshStatus, 400);
}

async function refreshStatus() {
    const $s = $('#na_status');
    if (!$s.length) return;
    if (!hasChat()) {
        $s.html('<span class="na_dim">열린 채팅이 없습니다.</span>');
        return;
    }
    const m = getMeta();
    const chat = ctx().chat || [];
    const last = chat.length - 1;
    const archiveTok = await countTokens(m.text);
    const after = m.boundary >= 0 ? buildExtract(m.boundary + 1, last) : [];
    const afterTok = await countTokens(extractToText(after));
    const sections = parseSections(m.text).length;

    const lines = [];
    lines.push(`<div><b>아카이브</b> ${fmt(archiveTok)} 토큰 · 섹션 ${sections}개 ${m.enabled ? '' : '<span class="na_warn">(주입 꺼짐)</span>'}</div>`);
    if (m.boundary >= 0) {
        lines.push(`<div><b>경계선</b> #${m.boundary}까지 압축됨 · 현재 마지막 #${last}</div>`);
        lines.push(`<div><b>압축 이후</b> 메시지 ${after.length}개 · 원문 ${fmt(afterTok)} 토큰</div>`);
    } else {
        lines.push('<div class="na_dim">경계선이 아직 없습니다. 아래에서 지정하거나 "아카이브에 추가"를 쓰면 자동으로 정해져요.</div>');
    }
    lines.push(`<div><b>주입 합계</b> 약 ${fmt(archiveTok + afterTok)} 토큰 (아카이브 + 압축 이후 원문)</div>`);
    $s.html(lines.join(''));
}

// ---------------------------------------------------------------- panel

function syncPanel() {
    const on = hasChat();
    $('#na_settings .na_body').toggleClass('na_disabled', !on);
    if (!on) { refreshStatus(); return; }
    const m = getMeta();
    $('#na_enabled').prop('checked', !!m.enabled);
    $('#na_depth').val(m.depth);
    $('#na_role').val(String(m.role));
    $('#na_boundary').val(m.boundary >= 0 ? m.boundary : '');
    $('#na_keep').val(m.keep);
    refreshStatus();
}

function renderPanel() {
    const html = `
    <div id="na_settings" class="extension_settings">
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>서사 아카이브</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <div class="na_body">
            <div id="na_status" class="na_status"></div>

            <label class="checkbox_label"><input type="checkbox" id="na_enabled"><span>아카이브 주입 사용</span></label>
            <div class="na_row">
              <label>깊이 <input type="number" id="na_depth" class="text_pole na_num" min="0" max="999"></label>
              <label>역할
                <select id="na_role" class="text_pole na_sel">
                  <option value="0">시스템</option>
                  <option value="1">유저</option>
                  <option value="2">어시스턴트</option>
                </select>
              </label>
            </div>
            <div class="na_row">
              <label>아카이브는 # <input type="number" id="na_boundary" class="text_pole na_num" min="0" placeholder="-"> 까지</label>
              <label>남길 메시지 <input type="number" id="na_keep" class="text_pole na_num" min="0" max="50"> 개</label>
            </div>

            <div class="na_buttons">
              <div class="menu_button" id="na_open_view"><i class="fa-solid fa-book-open"></i> 아카이브 보기·편집</div>
              <div class="menu_button" id="na_open_extract"><i class="fa-solid fa-scissors"></i> 원문 뽑기</div>
              <div class="menu_button" id="na_open_append"><i class="fa-solid fa-file-circle-plus"></i> 아카이브에 추가</div>
              <div class="menu_button" id="na_apply_hide"><i class="fa-solid fa-eye-slash"></i> 숨기기 적용</div>
              <div class="menu_button" id="na_import"><i class="fa-solid fa-file-import"></i> 불러오기</div>
              <div class="menu_button" id="na_export"><i class="fa-solid fa-file-export"></i> 내보내기</div>
            </div>
            <input type="file" id="na_file" accept=".txt,.md,text/plain" hidden>
          </div>
        </div>
      </div>
    </div>`;
    $('#extensions_settings2').append(html);

    $('#na_enabled').on('change', async function () {
        const m = getMeta(); if (!m) return;
        m.enabled = this.checked; await saveMeta(); applyInjection(); refreshStatus();
    });
    $('#na_depth').on('change', async function () {
        const m = getMeta(); if (!m) return;
        m.depth = Math.max(0, parseInt(this.value, 10) || 0); this.value = m.depth;
        await saveMeta(); applyInjection();
    });
    $('#na_role').on('change', async function () {
        const m = getMeta(); if (!m) return;
        m.role = parseInt(this.value, 10) || 0; await saveMeta(); applyInjection();
    });
    $('#na_boundary').on('change', async function () {
        const m = getMeta(); if (!m) return;
        const v = this.value === '' ? -1 : parseInt(this.value, 10);
        m.boundary = Number.isFinite(v) ? Math.max(-1, v) : -1;
        await saveMeta(); refreshStatus();
    });
    $('#na_keep').on('change', async function () {
        const m = getMeta(); if (!m) return;
        m.keep = Math.max(0, parseInt(this.value, 10) || 0); this.value = m.keep;
        await saveMeta(); refreshStatus();
    });

    $('#na_open_view').on('click', () => hasChat() ? openViewer() : toastr.info('채팅을 먼저 여세요.'));
    $('#na_open_extract').on('click', () => hasChat() ? openExtract() : toastr.info('채팅을 먼저 여세요.'));
    $('#na_open_append').on('click', () => hasChat() ? openAppend() : toastr.info('채팅을 먼저 여세요.'));
    $('#na_apply_hide').on('click', () => hasChat() ? applyHide() : toastr.info('채팅을 먼저 여세요.'));
    $('#na_export').on('click', () => {
        if (!hasChat()) return toastr.info('채팅을 먼저 여세요.');
        const m = getMeta();
        if (!m.text.trim()) return toastr.info('아카이브가 비어 있습니다.');
        download(`아카이브_${chatLabel()}_${nowStamp()}.txt`, m.text);
    });
    $('#na_import').on('click', () => hasChat() ? $('#na_file').val('').trigger('click') : toastr.info('채팅을 먼저 여세요.'));
    $('#na_file').on('change', async function () {
        const file = this.files?.[0];
        if (!file) return;
        const text = await file.text();
        const m = getMeta();
        if (m.text.trim()) {
            const { Popup, POPUP_RESULT } = ctx();
            const r = await Popup.show.confirm('아카이브 덮어쓰기', '이 채팅의 기존 아카이브를 불러온 파일로 바꿀까요?');
            if (r !== POPUP_RESULT.AFFIRMATIVE && r !== true) return;
        }
        m.text = text.replace(/\r\n/g, '\n');
        await saveMeta(); applyInjection(); refreshStatus();
        toastr.success(`불러옴: ${file.name}`);
    });
}

// ---------------------------------------------------------------- viewer popup

async function openViewer() {
    const c = ctx();
    const m = getMeta();
    const $root = $(`
      <div class="na_popup">
        <div class="na_tabs">
          <div class="menu_button na_tab active" data-tab="sections">섹션 보기</div>
          <div class="menu_button na_tab" data-tab="full">전체 편집</div>
        </div>
        <div class="na_pane" data-pane="sections">
          <input type="search" class="text_pole na_search" placeholder="아카이브 검색 (이름, 장소, 대사...)">
          <div class="na_search_info na_dim"></div>
          <div class="na_list"></div>
        </div>
        <div class="na_pane" data-pane="full" hidden>
          <textarea class="text_pole na_full" spellcheck="false"></textarea>
          <div class="na_row na_right">
            <span class="na_full_tok na_dim"></span>
            <div class="menu_button na_full_save"><i class="fa-solid fa-floppy-disk"></i> 저장</div>
          </div>
        </div>
      </div>`);

    const $list = $root.find('.na_list');
    const $search = $root.find('.na_search');
    const $info = $root.find('.na_search_info');
    const $full = $root.find('.na_full');

    const renderList = () => {
        const q = $search.val().trim();
        const ql = q.toLowerCase();
        const sections = parseSections(m.text);
        let shown = 0, hits = 0;
        $list.empty();
        sections.forEach((s, idx) => {
            const body = m.text.slice(s.start, s.end);
            let count = 0;
            if (q) {
                const re = new RegExp(escRe(q), 'gi');
                count = (body.match(re) || []).length;
                if (!count) return;
                hits += count;
            }
            shown++;
            const $card = $(`
              <div class="na_card" data-idx="${idx}">
                <div class="na_card_head">
                  <span class="na_card_title">${highlight(s.title, q)}</span>
                  <span class="na_card_meta">${count ? `<span class="na_hit">${count}건</span>` : ''}${fmt(body.length)}자</span>
                </div>
                <div class="na_card_body" ${q ? '' : 'hidden'}>
                  <div class="na_card_text">${highlight(body, q)}</div>
                  <div class="na_row na_right">
                    <div class="menu_button na_edit"><i class="fa-solid fa-pen"></i> 이 섹션 편집</div>
                  </div>
                </div>
              </div>`);
            $card.find('.na_card_head').on('click', () => $card.find('.na_card_body').prop('hidden', (i, v) => !v));
            $card.find('.na_edit').on('click', e => { e.stopPropagation(); editSection($card, s); });
            $list.append($card);
        });
        $info.text(q ? `"${q}" — 섹션 ${shown}개에서 ${hits}건` : `섹션 ${sections.length}개 · 제목을 누르면 펼쳐져요`);
        if (!sections.length) $list.html('<div class="na_dim">아카이브가 비어 있습니다. "전체 편집"에 붙여넣거나 "불러오기"를 쓰세요.</div>');
    };

    const editSection = ($card, s) => {
        const original = m.text.slice(s.start, s.end);
        const $body = $card.find('.na_card_body').prop('hidden', false).empty();
        const $ta = $('<textarea class="text_pole na_sec_edit" spellcheck="false"></textarea>').val(original.replace(/\s+$/, ''));
        const $btns = $(`<div class="na_row na_right">
            <div class="menu_button na_cancel">취소</div>
            <div class="menu_button na_save"><i class="fa-solid fa-floppy-disk"></i> 섹션 저장</div></div>`);
        $body.append($ta, $btns);
        $ta.trigger('focus');
        $btns.find('.na_cancel').on('click', renderList);
        $btns.find('.na_save').on('click', async () => {
            if (m.text.slice(s.start, s.end) !== original) {
                toastr.warning('아카이브가 그사이 바뀌어서 저장하지 않았어요. 다시 열어 주세요.');
                return;
            }
            const trail = original.match(/\s*$/)[0] || '\n\n';
            m.text = m.text.slice(0, s.start) + $ta.val().replace(/\s+$/, '') + trail + m.text.slice(s.end);
            await saveMeta(); applyInjection(); refreshStatus();
            $full.val(m.text);
            renderList();
            toastr.success('섹션 저장됨');
        });
    };

    const updateFullTok = async () => $root.find('.na_full_tok').text(`${fmt(await countTokens($full.val()))} 토큰`);

    $root.find('.na_tab').on('click', function () {
        const tab = $(this).data('tab');
        $root.find('.na_tab').removeClass('active');
        $(this).addClass('active');
        $root.find('.na_pane').each(function () { $(this).prop('hidden', $(this).data('pane') !== tab); });
        if (tab === 'full') { $full.val(m.text); updateFullTok(); }
        else renderList();
    });

    let searchTimer;
    $search.on('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderList, 200); });
    $full.on('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(updateFullTok, 600); });
    $root.find('.na_full_save').on('click', async () => {
        m.text = $full.val().replace(/\r\n/g, '\n');
        await saveMeta(); applyInjection(); refreshStatus();
        toastr.success('아카이브 저장됨');
    });

    renderList();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// ---------------------------------------------------------------- extract popup

async function openExtract() {
    const c = ctx();
    const m = getMeta();
    const last = (c.chat?.length || 0) - 1;
    const defStart = Math.min(m.boundary + 1, Math.max(0, last));

    const $root = $(`
      <div class="na_popup">
        <div class="na_row">
          <label># <input type="number" class="text_pole na_num na_from" min="0" max="${last}" value="${Math.max(0, defStart)}"></label>
          <span>~</span>
          <label># <input type="number" class="text_pole na_num na_to" min="0" max="${last}" value="${Math.max(0, last)}"></label>
          <div class="menu_button na_reload"><i class="fa-solid fa-rotate"></i> 범위 적용</div>
        </div>
        <div class="na_ex_info na_dim"></div>
        <div class="na_row">
          <div class="menu_button na_copy"><i class="fa-solid fa-copy"></i> 전체 복사</div>
          <div class="menu_button na_save_txt"><i class="fa-solid fa-download"></i> .txt 저장</div>
        </div>
        <div class="na_ex_list"></div>
        <textarea class="na_ex_hidden" readonly></textarea>
      </div>`);

    let current = '';
    const render = async () => {
        const from = parseInt($root.find('.na_from').val(), 10) || 0;
        const to = parseInt($root.find('.na_to').val(), 10);
        const items = buildExtract(from, Number.isFinite(to) ? to : last);
        current = extractToText(items);
        $root.find('.na_ex_hidden').val(current);
        const $list = $root.find('.na_ex_list').empty();
        items.forEach(x => {
            const $it = $(`
              <div class="na_card">
                <div class="na_card_head"><span class="na_card_title">[${x.i}] ${esc(x.name)}</span><span class="na_card_meta">${fmt(x.text.length)}자</span></div>
                <div class="na_card_body" hidden><div class="na_card_text">${esc(x.text)}</div></div>
              </div>`);
            $it.find('.na_card_head').on('click', () => $it.find('.na_card_body').prop('hidden', (i, v) => !v));
            $list.append($it);
        });
        $root.find('.na_ex_info').text(items.length
            ? `메시지 ${items.length}개 · ${fmt(current.length)}자 · 약 ${fmt(await countTokens(current))} 토큰 · 제목을 누르면 펼쳐져요`
            : '이 범위에 메시지가 없습니다.');
    };

    $root.find('.na_reload').on('click', render);
    $root.find('.na_from, .na_to').on('change', render);
    $root.find('.na_copy').on('click', async () => {
        if (!current) return;
        const ok = await copyText(current, $root.find('.na_ex_hidden')[0]);
        ok ? toastr.success('복사됨') : toastr.warning('복사가 막혀 있어요. .txt 저장을 써 주세요.');
    });
    $root.find('.na_save_txt').on('click', () => {
        if (!current) return;
        const from = $root.find('.na_from').val(), to = $root.find('.na_to').val();
        download(`원문_${chatLabel()}_${from}-${to}.txt`, current);
    });

    await render();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// ---------------------------------------------------------------- append popup

async function openAppend() {
    const c = ctx();
    const m = getMeta();
    const last = (c.chat?.length || 0) - 1;

    const $root = $(`
      <div class="na_popup">
        <div class="na_dim">새로 압축한 섹션을 붙여넣으세요. 아카이브 맨 끝에 덧붙습니다.</div>
        <textarea class="text_pole na_append_ta" spellcheck="false" placeholder="## Y2 #574–#600 — ..."></textarea>
        <div class="na_row">
          <label>이번에 압축한 끝 번호 # <input type="number" class="text_pole na_num na_end" min="0" max="${last}" value="${Math.max(0, last)}"></label>
        </div>
        <label class="checkbox_label"><input type="checkbox" class="na_do_hide" checked><span>저장 후 숨기기 적용 (마지막 ${m.keep}개 남김)</span></label>
        <div class="na_append_info na_dim"></div>
      </div>`);

    const $ta = $root.find('.na_append_ta');
    let t;
    $ta.on('input', () => {
        clearTimeout(t);
        t = setTimeout(async () => $root.find('.na_append_info').text(`약 ${fmt(await countTokens($ta.val()))} 토큰`), 500);
    });

    const result = await c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', {
        wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '추가', cancelButton: '취소',
    });
    if (result !== c.POPUP_RESULT.AFFIRMATIVE && result !== true) return;

    const add = String($ta.val() || '').replace(/\r\n/g, '\n').trim();
    if (!add) return toastr.info('붙여넣은 내용이 없어요.');
    const end = parseInt($root.find('.na_end').val(), 10);
    if (!Number.isFinite(end) || end < 0) return toastr.warning('끝 번호를 확인해 주세요.');
    if (m.boundary >= 0 && end <= m.boundary) {
        const r = await c.Popup.show.confirm('경계선 확인', `끝 번호 #${end}가 기존 경계선 #${m.boundary}보다 앞이에요. 그래도 저장할까요?`);
        if (r !== c.POPUP_RESULT.AFFIRMATIVE && r !== true) return;
    }

    m.text = (m.text.replace(/\s+$/, '') + (m.text.trim() ? '\n\n' : '') + add + '\n');
    m.boundary = end;
    await saveMeta();
    applyInjection();
    if ($root.find('.na_do_hide').prop('checked')) await applyHide({ silent: true });
    syncPanel();
    toastr.success(`아카이브에 추가됨 · 경계선 #${end}`);
}

// ---------------------------------------------------------------- boot

function onChatChanged() {
    applyInjection();
    syncPanel();
}

(function init() {
    const c = ctx();
    const es = c.eventSource;
    const et = c.eventTypes || c.event_types;

    const start = () => {
        if (!$('#na_settings').length) renderPanel();
        onChatChanged();
    };

    es.on(et.APP_READY, start);
    es.on(et.CHAT_CHANGED, onChatChanged);
    for (const ev of [et.MESSAGE_RECEIVED, et.MESSAGE_SENT, et.MESSAGE_DELETED]) {
        if (ev) es.on(ev, refreshStatusSoon);
    }
    if (document.getElementById('extensions_settings2')) start();
})();
