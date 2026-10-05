// 서사 아카이브 (Narrative Archive)
// You write the archive. This extension stores it per chat, injects it,
// hides already-compressed messages, extracts raw ranges, and shows token counts.

const MODULE = 'narrative_archive';
const PROMPT_KEY = 'narrative_archive_injection';
const VERSION = '1.1.0';
const SNAPSHOT_MAX = 5;
const SNAPSHOT_MAX_CHARS = 2_000_000;

const DEFAULT_META = Object.freeze({
    text: '',
    boundary: -1,   // last message index covered by the archive
    keep: 1,        // how many compressed messages stay visible
    enabled: true,
    position: 1,    // extension_prompt_types: 0 after main prompt, 1 in chat, 2 before main prompt
    depth: 1,
    role: 0,        // 0 system, 1 user, 2 assistant
    wrap: '',       // optional template, {{archive}} is replaced by the archive text
    remindTok: 0,   // nudge when raw text after the boundary passes this many tokens (0 = off)
    once: '',       // one-shot override for the next generation only
    snapshots: [],  // [{ at, reason, text, boundary }] newest first
    lastInject: null,
});

const POSITIONS = { 1: '채팅 안 (깊이)', 0: '메인 프롬프트 뒤', 2: '메인 프롬프트 앞' };
const ROLES = { 0: '시스템', 1: '유저', 2: '어시스턴트' };

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
        if (!Object.hasOwn(md[MODULE], k)) md[MODULE][k] = structuredClone(DEFAULT_META[k]);
    }
    if (!Array.isArray(md[MODULE].snapshots)) md[MODULE].snapshots = [];
    return md[MODULE];
}

async function saveMeta() {
    await ctx().saveMetadata();
}

function pushSnapshot(m, reason) {
    if (!m.text.trim()) return false;
    const top = m.snapshots[0];
    if (top && top.text === m.text && top.boundary === m.boundary) return false;
    m.snapshots.unshift({ at: Date.now(), reason, text: m.text, boundary: m.boundary });
    m.snapshots.length = Math.min(m.snapshots.length, SNAPSHOT_MAX);
    let total = 0;
    m.snapshots = m.snapshots.filter((s, i) => (total += s.text.length) <= SNAPSHOT_MAX_CHARS || i === 0);
    return true;
}

// Every change to the archive text goes through here: snapshot, save, re-inject, refresh UI.
async function commitText(text, reason, { boundary } = {}) {
    const m = getMeta();
    const next = String(text).replace(/\r\n/g, '\n');
    if (next === m.text && (boundary === undefined || boundary === m.boundary)) return false;
    pushSnapshot(m, reason);
    m.text = next;
    if (boundary !== undefined) m.boundary = boundary;
    await saveMeta();
    applyInjection();
    syncPanel();
    return true;
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

function download(filename, text, type = 'text/plain') {
    const blob = new Blob([text], { type: `${type};charset=utf-8` });
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

async function confirm(title, text) {
    const c = ctx();
    const r = await c.Popup.show.confirm(title, text);
    return r === c.POPUP_RESULT.AFFIRMATIVE || r === true;
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

function timeLabel(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    const today = new Date().toDateString() === d.toDateString();
    return `${today ? '오늘' : `${d.getMonth() + 1}/${d.getDate()}`} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------------------------------------------------------------- injection

function wrapText(m, text) {
    const tpl = String(m.wrap || '').trim();
    if (!tpl) return text;
    return tpl.includes('{{archive}}') ? tpl.split('{{archive}}').join(text) : `${tpl}\n${text}`;
}

function injectedText(m) {
    const body = m.once ? m.once : m.text;
    return body.trim() ? wrapText(m, body) : '';
}

function applyInjection() {
    const c = ctx();
    const m = hasChat() ? getMeta() : null;
    if (!m || !m.enabled || !injectedText(m)) {
        c.setExtensionPrompt(PROMPT_KEY, '', 1, 1);
        return;
    }
    const pos = [0, 1, 2].includes(Number(m.position)) ? Number(m.position) : 1;
    c.setExtensionPrompt(PROMPT_KEY, injectedText(m), pos, Math.max(0, Number(m.depth) || 0), false, Number(m.role) || 0);
}

let onceInFlight = false;

async function onGenerationStarted(type, _opts, dryRun) {
    if (dryRun || type === 'quiet' || !hasChat()) return;
    const m = getMeta();
    const text = m.enabled ? injectedText(m) : '';
    m.lastInject = {
        at: Date.now(),
        once: !!m.once,
        enabled: !!m.enabled,
        tokens: await countTokens(text),
        chars: text.length,
        position: m.position, depth: m.depth, role: m.role,
        sections: parseSections(m.once || m.text).filter(x => !x.group).length,
        head: text.slice(0, 160),
        tail: text.slice(-160),
    };
    if (m.once) onceInFlight = true;
    refreshInjectLog();
}

async function onGenerationDone() {
    if (!onceInFlight || !hasChat()) return;
    onceInFlight = false;
    const m = getMeta();
    m.once = '';
    await saveMeta();
    applyInjection();
    syncPanel();
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
    const re = /^(#{1,3}) .*$/gm;
    const heads = [];
    let m;
    while ((m = re.exec(text)) !== null) heads.push({ start: m.index, title: m[0], level: m[1].length });
    const sections = [];
    if (!heads.length) {
        if (text.trim()) sections.push({ title: '(제목 없음)', start: 0, end: text.length, level: 1, group: false });
        return sections;
    }
    if (text.slice(0, heads[0].start).trim()) sections.push({ title: '(머리말)', start: 0, end: heads[0].start, level: 1, group: false });
    heads.forEach((h, idx) => {
        const next = heads[idx + 1];
        const end = next ? next.start : text.length;
        // A heading directly followed by deeper headings ("# ── Y1 ──" → "## #0–#47") is a group divider, not a card.
        const group = !!next && next.level > h.level;
        const note = text.slice(h.start + h.title.length, end).replace(/^\s*-{3,}\s*$/gm, '').trim();
        sections.push({ title: h.title.replace(/^#+\s*/, ''), start: h.start, end, level: h.level, group, note });
    });
    return sections;
}

const groupLabel = title => title.replace(/^[\s─━—–=-]+|[\s─━—–=-]+$/g, '') || title;

function highlight(text, query) {
    const safe = esc(text);
    if (!query) return safe;
    return safe.replace(new RegExp(escRe(esc(query)), 'gi'), s => `<mark>${s}</mark>`);
}

// Section browser shared by the panel tab and the large popup.
// Returns { render } — call render() after the archive changes.
function mountSectionBrowser($host) {
    const $root = $(`
      <div class="na_browser">
        <div class="na_search_wrap">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="search" class="text_pole na_search" placeholder="이름, 장소, 대사로 찾기">
        </div>
        <div class="na_search_info na_dim"></div>
        <div class="na_list"></div>
      </div>`);
    $host.empty().append($root);
    const $list = $root.find('.na_list');
    const $search = $root.find('.na_search');
    const $info = $root.find('.na_search_info');
    const collapsed = new Set();

    const editSection = ($card, s) => {
        const m = getMeta();
        const original = m.text.slice(s.start, s.end);
        const $body = $card.children('.na_card_body').prop('hidden', false).empty();
        const $ta = $('<textarea class="text_pole na_sec_edit" spellcheck="false"></textarea>').val(original.replace(/\s+$/, ''));
        const $btns = $(`<div class="na_row na_right">
            <button type="button" class="na_btn na_cancel">취소</button>
            <button type="button" class="na_btn na_save na_primary"><i class="fa-solid fa-floppy-disk"></i> 섹션 저장</button></div>`);
        $body.append($ta, $btns);
        $ta.trigger('focus');
        $btns.find('.na_cancel').on('click', render);
        $btns.find('.na_save').on('click', async () => {
            const cur = getMeta();
            if (cur.text.slice(s.start, s.end) !== original) {
                toastr.warning('아카이브가 그사이 바뀌어서 저장하지 않았어요. 다시 열어 주세요.');
                return;
            }
            const trail = original.match(/\s*$/)[0] || '\n\n';
            await commitText(cur.text.slice(0, s.start) + $ta.val().replace(/\s+$/, '') + trail + cur.text.slice(s.end), `섹션 편집 전: ${s.title.slice(0, 40)}`);
            render();
            toastr.success('섹션 저장됨');
        });
    };

    function render() {
        const m = getMeta();
        if (!m) return;
        const q = $search.val().trim();
        const sections = parseSections(m.text);
        const cardCount = sections.filter(x => !x.group).length;
        let shown = 0, hits = 0;
        $list.empty();
        const groupStack = [];
        sections.forEach((s, idx) => {
            while (groupStack.length && groupStack[groupStack.length - 1].level >= s.level) groupStack.pop();
            const $parent = groupStack.length ? groupStack[groupStack.length - 1].$items : $list;
            const body = m.text.slice(s.start, s.end);
            let count = 0;
            if (q) {
                count = (body.match(new RegExp(escRe(q), 'gi')) || []).length;
                hits += count;
            }
            if (s.group) {
                const key = s.title;
                const isOpen = q || !collapsed.has(key);
                const $g = $(`
                  <div class="na_group na_lv${s.level}" data-idx="${idx}">
                    <div class="na_group_head">
                      <i class="fa-solid fa-caret-${isOpen ? 'down' : 'right'} na_group_chev"></i>
                      <span class="na_group_title">${highlight(groupLabel(s.title), q)}</span>
                      <span class="na_group_line"></span>
                      <span class="na_group_meta"></span>
                      ${s.note ? '<i class="fa-solid fa-pen na_group_edit" title="머리글 편집"></i>' : ''}
                    </div>
                    ${s.note ? `<div class="na_group_note na_dim">${highlight(s.note, q)}</div>` : ''}
                    <div class="na_card_body" hidden></div>
                    <div class="na_group_items" ${isOpen ? '' : 'hidden'}></div>
                  </div>`);
                $g.find('.na_group_head').on('click', () => {
                    if (q) return;
                    collapsed.has(key) ? collapsed.delete(key) : collapsed.add(key);
                    render();
                });
                $g.find('.na_group_edit').on('click', e => {
                    e.stopPropagation();
                    $g.find('.na_group_note').prop('hidden', true);
                    editSection($g, s);
                });
                $parent.append($g);
                groupStack.push({ level: s.level, $items: $g.children('.na_group_items') });
                return;
            }
            if (q && !count) return;
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
                    <button type="button" class="na_btn na_edit"><i class="fa-solid fa-pen"></i> 이 섹션 편집</button>
                  </div>
                </div>
              </div>`);
            $card.find('.na_card_head').on('click', () => $card.find('.na_card_body').prop('hidden', (i, v) => !v));
            $card.find('.na_edit').on('click', e => { e.stopPropagation(); editSection($card, s); });
            $parent.append($card);
        });
        $list.find('.na_group').each(function () {
            const $g = $(this);
            const n = $g.find('.na_card').length;
            $g.find('> .na_group_head .na_group_meta').text(`${n}`);
            if (q && !n && !$g.find('> .na_group_head mark, > .na_group_note mark').length) $g.remove();
        });
        $info.text(q ? `"${q}" — 섹션 ${shown}개에서 ${hits}건` : `섹션 ${cardCount}개 · 제목을 누르면 펼쳐져요`);
        if (!sections.length) $list.html('<div class="na_empty">아카이브가 비어 있어요.<br>개요 탭에 붙여넣거나 보관 탭에서 불러오세요.</div>');
    }

    let t;
    $search.on('input', () => { clearTimeout(t); t = setTimeout(render, 200); });
    render();
    return { render };
}

// ---------------------------------------------------------------- panel

let sectionPanel = null;
let editorDirty = false;

function renderPanel() {
    const html = `
    <div id="na_settings" class="extension_settings">
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b class="na_title"><i class="fa-solid fa-feather-pointed"></i> 서사 아카이브 <span class="na_ver">v${VERSION}</span></b>
          <span class="na_head_badge" id="na_head_badge"></span>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <div class="na_body">

            <div class="na_meter" id="na_meter">
              <div class="na_meter_top">
                <span class="na_meter_total" id="na_meter_total">-</span>
                <span class="na_meter_state" id="na_meter_state"></span>
              </div>
              <div class="na_meter_bar"><span class="na_seg_arc"></span><span class="na_seg_raw"></span></div>
              <div class="na_meter_legend" id="na_meter_legend"></div>
            </div>

            <nav class="na_nav" role="tablist">
              <button type="button" class="na_nav_btn active" data-tab="overview">개요</button>
              <button type="button" class="na_nav_btn" data-tab="sections">섹션</button>
              <button type="button" class="na_nav_btn" data-tab="compress">압축</button>
              <button type="button" class="na_nav_btn" data-tab="vault">보관</button>
              <button type="button" class="na_nav_btn" data-tab="config">설정</button>
            </nav>

            <!-- 개요 -->
            <section class="na_tab_pane" data-pane="overview">
              <div class="na_block">
                <div class="na_block_head">
                  <div>
                    <h4>주입 본문</h4>
                    <p>매 턴 프롬프트에 들어가는 아카이브 전체예요. 여기서 바로 고치고 <b>저장</b>하면 다음 턴부터 반영돼요.
                       <b>이번만</b>은 저장하지 않고 다음 응답 한 번에만 이 내용으로 보냅니다.</p>
                  </div>
                </div>
                <div class="na_editor_bar">
                  <span class="na_chip" id="na_ed_tok">-</span>
                  <span class="na_dirty" id="na_ed_dirty" hidden>● 저장 안 됨</span>
                  <span class="na_spacer"></span>
                  <button type="button" class="na_icon" id="na_ed_find" title="찾기"><i class="fa-solid fa-magnifying-glass"></i></button>
                  <button type="button" class="na_icon" id="na_ed_copy" title="전체 복사"><i class="fa-regular fa-copy"></i></button>
                  <button type="button" class="na_icon" id="na_ed_big" title="크게 보기"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></button>
                </div>
                <div class="na_findbar" id="na_findbar" hidden>
                  <input type="search" class="text_pole" id="na_find_q" placeholder="본문에서 찾기 (Enter: 다음)">
                  <span class="na_dim" id="na_find_info"></span>
                </div>
                <div class="na_once_banner" id="na_once_banner" hidden>
                  <i class="fa-solid fa-hourglass-half"></i>
                  <span>다음 응답 1회는 <b>임시 본문</b>으로 보내요. 저장된 아카이브는 그대로예요.</span>
                  <a href="#" id="na_once_cancel">취소</a>
                </div>
                <textarea id="na_editor" class="text_pole na_editor" spellcheck="false" placeholder="# 제목&#10;&#10;# ── Y1 ──&#10;&#10;## #0–#47 — ..."></textarea>
                <div class="na_editor_actions">
                  <button type="button" class="na_btn" id="na_ed_revert"><i class="fa-solid fa-rotate-left"></i> 되돌리기</button>
                  <button type="button" class="na_btn" id="na_ed_once"><i class="fa-solid fa-hourglass-start"></i> 이번만</button>
                  <button type="button" class="na_btn na_primary" id="na_ed_save"><i class="fa-solid fa-floppy-disk"></i> 저장</button>
                </div>
              </div>
              <details class="na_block na_details">
                <summary>마지막 주입 기록</summary>
                <div id="na_inject_log"></div>
              </details>
            </section>

            <!-- 섹션 -->
            <section class="na_tab_pane" data-pane="sections" hidden>
              <div class="na_block">
                <div class="na_block_head">
                  <div>
                    <h4>섹션</h4>
                    <p><code>#</code> 구분 제목은 접을 수 있는 묶음, <code>##</code> 제목은 카드로 나뉘어요.</p>
                  </div>
                  <button type="button" class="na_btn na_small" id="na_sec_big"><i class="fa-solid fa-up-right-and-down-left-from-center"></i> 크게</button>
                </div>
                <div id="na_sec_host"></div>
              </div>
            </section>

            <!-- 압축 -->
            <section class="na_tab_pane" data-pane="compress" hidden>
              <div class="na_block">
                <div class="na_block_head"><div><h4>경계선</h4><p>아카이브가 어디까지 다루는지예요. 그 앞 메시지는 숨겨서 토큰을 아낍니다.</p></div></div>
                <div class="na_fields">
                  <label class="na_field"><span>아카이브는 #</span><input type="number" id="na_boundary" class="text_pole" min="0" placeholder="-"><span>까지</span></label>
                  <label class="na_field"><span>숨길 때 남길 메시지</span><input type="number" id="na_keep" class="text_pole" min="0" max="50"><span>개</span></label>
                </div>
                <div class="na_since" id="na_since"></div>
              </div>
              <div class="na_block">
                <div class="na_block_head"><div><h4>압축 루틴</h4><p>뽑기 → 다른 모델이나 직접 압축 → 추가. 추가하면 경계선 이동과 숨기기가 자동이에요.</p></div></div>
                <div class="na_steps">
                  <button type="button" class="na_step" id="na_open_extract"><b>1</b><span><strong>원문 뽑기</strong><small>경계선 이후 메시지 복사·저장</small></span></button>
                  <button type="button" class="na_step" id="na_open_append"><b>2</b><span><strong>아카이브에 추가</strong><small>압축본 붙여넣기 · 경계선 이동</small></span></button>
                  <button type="button" class="na_step" id="na_apply_hide"><b><i class="fa-solid fa-eye-slash"></i></b><span><strong>숨기기 다시 적용</strong><small>경계선 기준으로 /hide</small></span></button>
                </div>
              </div>
            </section>

            <!-- 보관 -->
            <section class="na_tab_pane" data-pane="vault" hidden>
              <div class="na_block">
                <div class="na_block_head">
                  <div><h4>복구 지점</h4><p>저장·추가·불러오기·복원 직전 상태를 자동으로 남겨요. 최근 ${SNAPSHOT_MAX}개까지.</p></div>
                  <button type="button" class="na_btn na_small" id="na_snap_now"><i class="fa-solid fa-bookmark"></i> 지금 보관</button>
                </div>
                <div id="na_snap_list" class="na_snap_list"></div>
              </div>
              <div class="na_block">
                <div class="na_block_head"><div><h4>파일</h4><p><b>.txt</b>는 아카이브 본문만, <b>.json</b>은 경계선·설정·복구 지점까지 통째로 담아요.</p></div></div>
                <div class="na_tiles">
                  <button type="button" class="na_tile" id="na_import"><i class="fa-solid fa-file-arrow-up"></i><span>불러오기</span><small>.txt · .json</small></button>
                  <button type="button" class="na_tile" id="na_export"><i class="fa-solid fa-file-lines"></i><span>내보내기</span><small>.txt 본문만</small></button>
                  <button type="button" class="na_tile" id="na_export_json"><i class="fa-solid fa-box-archive"></i><span>백업</span><small>.json 통째로</small></button>
                  <button type="button" class="na_tile na_tile_danger" id="na_clear"><i class="fa-solid fa-eraser"></i><span>비우기</span><small>복구 지점에 남김</small></button>
                </div>
                <input type="file" id="na_file" accept=".txt,.md,.json,text/plain,application/json" hidden>
              </div>
            </section>

            <!-- 설정 -->
            <section class="na_tab_pane" data-pane="config" hidden>
              <div class="na_block">
                <label class="checkbox_label na_switch"><input type="checkbox" id="na_enabled"><span>아카이브 주입 사용</span></label>
                <div class="na_fields">
                  <label class="na_field"><span>위치</span>
                    <select id="na_position" class="text_pole">${Object.entries(POSITIONS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
                  </label>
                  <label class="na_field" id="na_depth_field"><span>깊이</span><input type="number" id="na_depth" class="text_pole" min="0" max="999"></label>
                  <label class="na_field"><span>역할</span>
                    <select id="na_role" class="text_pole">${Object.entries(ROLES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
                  </label>
                </div>
              </div>
              <div class="na_block">
                <div class="na_block_head"><div><h4>감싸기</h4><p>아카이브 앞뒤에 붙일 문구예요. <code>{{archive}}</code> 자리에 본문이 들어가요. 비워 두면 본문만 보냅니다.</p></div></div>
                <textarea id="na_wrap" class="text_pole na_wrap" rows="4" spellcheck="false" placeholder="<story_archive>&#10;{{archive}}&#10;</story_archive>"></textarea>
              </div>
              <div class="na_block">
                <div class="na_block_head"><div><h4>압축 알림</h4><p>경계선 이후 원문이 이 토큰을 넘으면 계기판에 표시해요. 0이면 끔.</p></div></div>
                <div class="na_fields"><label class="na_field"><input type="number" id="na_remind" class="text_pole" min="0" step="1000"><span>토큰</span></label></div>
              </div>
            </section>

            <div class="na_nochat" id="na_nochat" hidden>채팅을 열면 이 채팅의 아카이브가 보여요.</div>
          </div>
        </div>
      </div>
    </div>`;
    $('#extensions_settings2').append(html);
    bindPanel();
}

const needChat = fn => (...a) => hasChat() ? fn(...a) : toastr.info('채팅을 먼저 여세요.');

function bindPanel() {
    const $p = $('#na_settings');

    $p.find('.na_nav_btn').on('click', function () {
        const tab = $(this).data('tab');
        $p.find('.na_nav_btn').removeClass('active');
        $(this).addClass('active');
        $p.find('.na_tab_pane').each(function () { $(this).prop('hidden', $(this).data('pane') !== tab); });
        if (tab === 'sections' && hasChat()) {
            if (!sectionPanel) sectionPanel = mountSectionBrowser($('#na_sec_host'));
            else sectionPanel.render();
        }
    });

    // --- editor
    const $ed = $('#na_editor');
    let tokTimer;
    const updateEdTok = () => {
        clearTimeout(tokTimer);
        tokTimer = setTimeout(async () => $('#na_ed_tok').text(`${fmt(await countTokens($ed.val()))} 토큰`), 500);
    };
    const setDirty = v => { editorDirty = v; $('#na_ed_dirty').prop('hidden', !v); };
    $ed.on('input', () => { setDirty(hasChat() && $ed.val() !== getMeta().text); updateEdTok(); });
    $ed.on('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); $('#na_ed_save').trigger('click'); }
    });
    $('#na_ed_save').on('click', needChat(async () => {
        editorDirty = false;
        const changed = await commitText($ed.val(), '본문 저장 전');
        setDirty(false);
        toastr.success(changed ? '아카이브 저장됨' : '바뀐 내용이 없어요');
    }));
    $('#na_ed_revert').on('click', needChat(() => {
        $ed.val(getMeta().text); setDirty(false); updateEdTok();
    }));
    $('#na_ed_once').on('click', needChat(async () => {
        const m = getMeta();
        const v = $ed.val().replace(/\r\n/g, '\n');
        if (!v.trim()) return toastr.info('본문이 비어 있어요.');
        if (v === m.text) return toastr.info('저장된 아카이브와 같아요. 고친 뒤 눌러 주세요.');
        m.once = v;
        await saveMeta(); applyInjection(); syncPanel();
        toastr.success('다음 응답 1회에 이 내용을 보내요');
    }));
    $('#na_once_cancel').on('click', async e => {
        e.preventDefault();
        if (!hasChat()) return;
        const m = getMeta();
        m.once = ''; await saveMeta(); applyInjection(); syncPanel();
    });
    $('#na_ed_copy').on('click', async () => {
        const ok = await copyText($ed.val(), $ed[0]);
        ok ? toastr.success('복사됨') : toastr.warning('복사가 막혀 있어요.');
    });
    $('#na_ed_big').on('click', needChat(openViewer));

    // in-textarea find
    $('#na_ed_find').on('click', () => {
        const $fb = $('#na_findbar');
        $fb.prop('hidden', !$fb.prop('hidden'));
        if (!$fb.prop('hidden')) $('#na_find_q').trigger('focus');
    });
    let findFrom = 0;
    const doFind = advance => {
        const q = $('#na_find_q').val();
        const text = $ed.val();
        if (!q) { $('#na_find_info').text(''); return; }
        const lower = text.toLowerCase(), ql = q.toLowerCase();
        const total = lower.split(ql).length - 1;
        if (!total) { $('#na_find_info').text('없음'); return; }
        let at = lower.indexOf(ql, advance ? findFrom : 0);
        if (at < 0) at = lower.indexOf(ql);
        findFrom = at + ql.length;
        const nth = lower.slice(0, at).split(ql).length;
        $('#na_find_info').text(`${nth}/${total}`);
        const el = $ed[0];
        el.setSelectionRange(at, at + q.length);
        const lineH = parseFloat(getComputedStyle(el).lineHeight) || 18;
        el.scrollTop = Math.max(0, (text.slice(0, at).split('\n').length - 3) * lineH);
    };
    $('#na_find_q').on('input', () => { findFrom = 0; doFind(false); });
    $('#na_find_q').on('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doFind(true); } });

    // --- sections
    $('#na_sec_big').on('click', needChat(openViewer));

    // --- compress
    $('#na_boundary').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        const v = this.value === '' ? -1 : parseInt(this.value, 10);
        m.boundary = Number.isFinite(v) ? Math.max(-1, v) : -1;
        await saveMeta(); refreshStatus();
    });
    $('#na_keep').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.keep = Math.max(0, parseInt(this.value, 10) || 0); this.value = m.keep;
        await saveMeta(); refreshStatus();
    });
    $('#na_open_extract').on('click', needChat(openExtract));
    $('#na_open_append').on('click', needChat(openAppend));
    $('#na_apply_hide').on('click', needChat(() => applyHide()));

    // --- vault
    $('#na_snap_now').on('click', needChat(async () => {
        const m = getMeta();
        if (!m.text.trim()) return toastr.info('아카이브가 비어 있어요.');
        if (!pushSnapshot(m, '직접 보관')) return toastr.info('마지막 복구 지점과 같아요.');
        await saveMeta(); renderSnapshots(); toastr.success('보관됨');
    }));
    $('#na_export').on('click', needChat(() => {
        const m = getMeta();
        if (!m.text.trim()) return toastr.info('아카이브가 비어 있습니다.');
        download(`아카이브_${chatLabel()}_${nowStamp()}.txt`, m.text);
    }));
    $('#na_export_json').on('click', needChat(() => {
        const { once, lastInject, ...rest } = getMeta();
        download(`아카이브_${chatLabel()}_${nowStamp()}.json`, JSON.stringify({ format: 'narrative-archive', version: VERSION, data: rest }, null, 2), 'application/json');
    }));
    $('#na_clear').on('click', needChat(async () => {
        const m = getMeta();
        if (!m.text.trim()) return toastr.info('이미 비어 있어요.');
        if (!await confirm('아카이브 비우기', '본문을 비울까요? 지금 내용은 복구 지점에 남아요.')) return;
        editorDirty = false;
        await commitText('', '비우기 전', { boundary: -1 });
        toastr.success('비웠어요');
    }));
    $('#na_import').on('click', needChat(() => $('#na_file').val('').trigger('click')));
    $('#na_file').on('change', async function () {
        const file = this.files?.[0];
        if (!file || !hasChat()) return;
        const raw = await file.text();
        const m = getMeta();
        let json = null;
        if (/\.json$/i.test(file.name)) {
            try { json = JSON.parse(raw); } catch { return toastr.error('JSON을 읽지 못했어요.'); }
            if (json?.format !== 'narrative-archive' || typeof json.data?.text !== 'string') return toastr.error('서사 아카이브 백업 파일이 아니에요.');
        }
        if (m.text.trim() && !await confirm('아카이브 덮어쓰기', '이 채팅의 기존 아카이브를 불러온 파일로 바꿀까요? 지금 내용은 복구 지점에 남아요.')) return;
        editorDirty = false;
        if (json) {
            const d = json.data;
            for (const k of ['keep', 'enabled', 'position', 'depth', 'role', 'wrap', 'remindTok']) if (Object.hasOwn(d, k)) m[k] = d[k];
            if (Array.isArray(d.snapshots)) {
                const seen = new Set(m.snapshots.map(s => s.at));
                m.snapshots = [...m.snapshots, ...d.snapshots.filter(s => s && typeof s.text === 'string' && !seen.has(s.at))]
                    .sort((a, b) => b.at - a.at).slice(0, SNAPSHOT_MAX);
            }
            await commitText(d.text, '불러오기 전', { boundary: Number.isFinite(d.boundary) ? d.boundary : -1 });
        } else {
            await commitText(raw, '불러오기 전');
        }
        toastr.success(`불러옴: ${file.name}`);
    });

    // --- config
    $('#na_enabled').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.enabled = this.checked; await saveMeta(); applyInjection(); refreshStatus();
    });
    $('#na_position').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.position = parseInt(this.value, 10); await saveMeta(); applyInjection(); syncPanel();
    });
    $('#na_depth').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.depth = Math.max(0, parseInt(this.value, 10) || 0); this.value = m.depth;
        await saveMeta(); applyInjection();
    });
    $('#na_role').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.role = parseInt(this.value, 10) || 0; await saveMeta(); applyInjection();
    });
    let wrapTimer;
    $('#na_wrap').on('input', function () {
        clearTimeout(wrapTimer);
        wrapTimer = setTimeout(async () => {
            if (!hasChat()) return;
            const m = getMeta();
            m.wrap = this.value; await saveMeta(); applyInjection(); refreshStatus();
        }, 500);
    });
    $('#na_remind').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.remindTok = Math.max(0, parseInt(this.value, 10) || 0); this.value = m.remindTok;
        await saveMeta(); refreshStatus();
    });
}

function syncPanel() {
    if (!$('#na_settings').length) return;
    const on = hasChat();
    $('#na_settings .na_tab_pane, #na_settings .na_nav, #na_meter').toggleClass('na_disabled', !on);
    $('#na_nochat').prop('hidden', on);
    if (!on) { refreshStatus(); return; }
    const m = getMeta();
    if (!editorDirty) $('#na_editor').val(m.text).trigger('input');
    $('#na_once_banner').prop('hidden', !m.once);
    $('#na_enabled').prop('checked', !!m.enabled);
    $('#na_position').val(String(m.position));
    $('#na_depth').val(m.depth);
    $('#na_depth_field').toggleClass('na_disabled', Number(m.position) !== 1);
    $('#na_role').val(String(m.role));
    if (document.activeElement?.id !== 'na_wrap') $('#na_wrap').val(m.wrap);
    $('#na_remind').val(m.remindTok);
    $('#na_boundary').val(m.boundary >= 0 ? m.boundary : '');
    $('#na_keep').val(m.keep);
    sectionPanel?.render();
    renderSnapshots();
    refreshInjectLog();
    refreshStatus();
}

function renderSnapshots() {
    const $l = $('#na_snap_list');
    if (!$l.length || !hasChat()) return;
    const m = getMeta();
    $l.empty();
    if (!m.snapshots.length) {
        $l.html('<div class="na_empty">아직 복구 지점이 없어요.</div>');
        return;
    }
    m.snapshots.forEach((s, i) => {
        const diff = s.text.length - m.text.length;
        const $row = $(`
          <div class="na_snap">
            <div class="na_snap_main">
              <span class="na_snap_time">${esc(timeLabel(s.at))}</span>
              <span class="na_snap_reason">${esc(s.reason)}</span>
              <span class="na_snap_meta">${fmt(s.text.length)}자 · 지금보다 ${diff === 0 ? '같음' : `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}자`}${s.boundary >= 0 ? ` · #${s.boundary}까지` : ''}</span>
            </div>
            <div class="na_snap_btns">
              <button type="button" class="na_icon na_snap_view" title="내용 보기"><i class="fa-regular fa-eye"></i></button>
              <button type="button" class="na_icon na_snap_restore" title="이 지점으로 복원"><i class="fa-solid fa-clock-rotate-left"></i></button>
              <button type="button" class="na_icon na_snap_del" title="삭제"><i class="fa-regular fa-trash-can"></i></button>
            </div>
          </div>`);
        $row.find('.na_snap_view').on('click', () => {
            const c = ctx();
            const $v = $('<div class="na_popup"><textarea class="text_pole na_full" readonly spellcheck="false"></textarea></div>');
            $v.find('textarea').val(s.text);
            c.callGenericPopup($v, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, okButton: '닫기' });
        });
        $row.find('.na_snap_restore').on('click', async () => {
            if (!await confirm('복원', `${timeLabel(s.at)} (${s.reason}) 상태로 되돌릴까요? 지금 내용도 복구 지점에 남아요.`)) return;
            editorDirty = false;
            await commitText(s.text, '복원 전', { boundary: s.boundary });
            toastr.success('복원됨');
        });
        $row.find('.na_snap_del').on('click', async () => {
            m.snapshots.splice(i, 1); await saveMeta(); renderSnapshots();
        });
        $l.append($row);
    });
}

function refreshInjectLog() {
    const $l = $('#na_inject_log');
    if (!$l.length || !hasChat()) return;
    const li = getMeta().lastInject;
    if (!li) {
        $l.html('<div class="na_empty">아직 이 채팅에서 기록된 생성이 없어요. 응답을 한 번 받으면 여기 남아요.</div>');
        return;
    }
    if (!li.enabled || !li.chars) {
        $l.html(`<div class="na_log"><div><b>${esc(timeLabel(li.at))}</b> · 주입 없음 (꺼져 있거나 비어 있었어요)</div></div>`);
        return;
    }
    const where = Number(li.position) === 1 ? `채팅 안 깊이 ${li.depth}` : POSITIONS[li.position];
    $l.html(`
      <div class="na_log">
        <div class="na_log_row"><span>시각</span><b>${esc(timeLabel(li.at))}</b>${li.once ? '<span class="na_chip na_chip_warn">이번만 본문</span>' : ''}</div>
        <div class="na_log_row"><span>분량</span><b>${fmt(li.tokens)} 토큰</b><span class="na_dim">${fmt(li.chars)}자 · 섹션 ${li.sections}개</span></div>
        <div class="na_log_row"><span>자리</span><b>${esc(where)}</b><span class="na_dim">${esc(ROLES[li.role] || '')} 역할</span></div>
        <div class="na_log_clip"><span>시작</span><pre>${esc(li.head)}${li.chars > 160 ? '…' : ''}</pre></div>
        <div class="na_log_clip"><span>끝</span><pre>${li.chars > 160 ? '…' : ''}${esc(li.tail)}</pre></div>
      </div>`);
}

// ---------------------------------------------------------------- status

let statusTimer = null;
function refreshStatusSoon() {
    clearTimeout(statusTimer);
    statusTimer = setTimeout(refreshStatus, 400);
}

async function refreshStatus() {
    if (!$('#na_meter').length) return;
    if (!hasChat()) {
        $('#na_meter_total').text('채팅 없음');
        $('#na_meter_state, #na_meter_legend, #na_since, #na_head_badge').text('');
        $('#na_meter .na_seg_arc, #na_meter .na_seg_raw').css('width', 0);
        return;
    }
    const m = getMeta();
    const chat = ctx().chat || [];
    const last = chat.length - 1;
    const archiveTok = await countTokens(m.enabled ? injectedText(m) : '');
    const after = m.boundary >= 0 ? buildExtract(m.boundary + 1, last) : [];
    const afterTok = await countTokens(extractToText(after));
    const total = archiveTok + afterTok;
    const over = m.remindTok > 0 && afterTok >= m.remindTok;

    $('#na_meter_total').html(`${fmt(total)}<small> 토큰 주입</small>`);
    let state = '';
    if (!m.enabled) state = '<span class="na_chip na_chip_off">주입 꺼짐</span>';
    else if (m.once) state = '<span class="na_chip na_chip_warn">다음 1회 임시 본문</span>';
    else if (over) state = '<span class="na_chip na_chip_warn">압축할 때예요</span>';
    else if (m.text.trim()) state = '<span class="na_chip na_chip_on">주입 중</span>';
    $('#na_meter_state').html(state);

    const pct = total ? Math.round(archiveTok / total * 100) : 0;
    $('#na_meter .na_seg_arc').css('width', `${pct}%`);
    $('#na_meter .na_seg_raw').css('width', `${total ? 100 - pct : 0}%`).toggleClass('na_over', over);
    $('#na_meter_legend').html(`
      <span><i class="na_dot na_dot_arc"></i>아카이브 ${fmt(archiveTok)}</span>
      <span><i class="na_dot na_dot_raw"></i>${m.boundary >= 0 ? `#${m.boundary} 이후 원문 ${fmt(afterTok)} · ${after.length}개` : '경계선 없음'}</span>`);
    $('#na_head_badge').text(m.text.trim() ? fmt(archiveTok) : '');

    $('#na_since').html(m.boundary >= 0
        ? `현재 마지막 <b>#${last}</b> · 압축 이후 메시지 <b>${after.length}</b>개 · 원문 <b>${fmt(afterTok)}</b> 토큰${over ? ` <span class="na_chip na_chip_warn">알림 기준 ${fmt(m.remindTok)} 넘음</span>` : ''}`
        : '<span class="na_dim">경계선이 아직 없어요. 직접 적거나 "아카이브에 추가"를 쓰면 자동으로 정해져요.</span>');
}

// ---------------------------------------------------------------- viewer popup

async function openViewer() {
    const c = ctx();
    const $root = $(`
      <div class="na_popup">
        <div class="na_nav">
          <button type="button" class="na_nav_btn active" data-tab="sections">섹션</button>
          <button type="button" class="na_nav_btn" data-tab="full">전체 편집</button>
        </div>
        <div class="na_pane" data-pane="sections"></div>
        <div class="na_pane" data-pane="full" hidden>
          <textarea class="text_pole na_full" spellcheck="false"></textarea>
          <div class="na_row na_right">
            <span class="na_full_tok na_dim"></span>
            <button type="button" class="na_btn na_full_save na_primary"><i class="fa-solid fa-floppy-disk"></i> 저장</button>
          </div>
        </div>
      </div>`);

    const browser = mountSectionBrowser($root.find('[data-pane="sections"]'));
    const $full = $root.find('.na_full');
    const updateFullTok = async () => $root.find('.na_full_tok').text(`${fmt(await countTokens($full.val()))} 토큰`);

    $root.find('.na_nav_btn').on('click', function () {
        const tab = $(this).data('tab');
        $root.find('.na_nav_btn').removeClass('active');
        $(this).addClass('active');
        $root.find('.na_pane').each(function () { $(this).prop('hidden', $(this).data('pane') !== tab); });
        if (tab === 'full') { $full.val(getMeta().text); updateFullTok(); }
        else browser.render();
    });

    let t;
    $full.on('input', () => { clearTimeout(t); t = setTimeout(updateFullTok, 600); });
    $full.on('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); $root.find('.na_full_save').trigger('click'); }
    });
    $root.find('.na_full_save').on('click', async () => {
        editorDirty = false;
        const changed = await commitText($full.val(), '전체 편집 저장 전');
        toastr.success(changed ? '아카이브 저장됨' : '바뀐 내용이 없어요');
    });

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
          <button type="button" class="na_btn na_reload"><i class="fa-solid fa-rotate"></i> 범위 적용</button>
        </div>
        <div class="na_ex_info na_dim"></div>
        <div class="na_row">
          <button type="button" class="na_btn na_copy na_primary"><i class="fa-solid fa-copy"></i> 전체 복사</button>
          <button type="button" class="na_btn na_save_txt"><i class="fa-solid fa-download"></i> .txt 저장</button>
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
        if (!await confirm('경계선 확인', `끝 번호 #${end}가 기존 경계선 #${m.boundary}보다 앞이에요. 그래도 저장할까요?`)) return;
    }

    await commitText(m.text.replace(/\s+$/, '') + (m.text.trim() ? '\n\n' : '') + add + '\n', '추가 전', { boundary: end });
    if ($root.find('.na_do_hide').prop('checked')) await applyHide({ silent: true });
    toastr.success(`아카이브에 추가됨 · 경계선 #${end}`);
}

// ---------------------------------------------------------------- boot

function onChatChanged() {
    onceInFlight = false;
    editorDirty = false;
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
    if (et.GENERATION_STARTED) es.on(et.GENERATION_STARTED, onGenerationStarted);
    for (const ev of [et.MESSAGE_RECEIVED, et.GENERATION_STOPPED]) {
        if (ev) es.on(ev, onGenerationDone);
    }
    for (const ev of [et.MESSAGE_RECEIVED, et.MESSAGE_SENT, et.MESSAGE_DELETED]) {
        if (ev) es.on(ev, refreshStatusSoon);
    }
    if (document.getElementById('extensions_settings2')) start();
})();
