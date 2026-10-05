// 서사 아카이브 (Narrative Archive)
// You write the archive. This extension stores it per chat, injects it,
// hides already-compressed messages, extracts raw ranges, and shows token counts.

const MODULE = 'narrative_archive';
const PROMPT_KEY = 'narrative_archive_injection';
const VERSION = '1.5.0';
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
    track: false,   // boundary follows the last #number in the archive's headings
    snapshots: [],  // [{ at, reason, text, boundary }] newest first
    muted: [],      // section titles left out of the injection
    lastInject: null,
});

const SETTING_KEYS = ['keep', 'enabled', 'position', 'depth', 'role', 'wrap', 'remindTok', 'muted', 'track'];
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
    if (!Array.isArray(md[MODULE].muted)) md[MODULE].muted = [];
    delete md[MODULE].once; // removed in 1.4.0
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
    else syncTrackedBoundary(m);
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
    const body = filterMuted(m, m.text);
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

async function onGenerationStarted(type, _opts, dryRun) {
    if (dryRun || type === 'quiet' || !hasChat()) return;
    const m = getMeta();
    const text = m.enabled ? injectedText(m) : '';
    m.lastInject = {
        at: Date.now(),
        enabled: !!m.enabled,
        tokens: await countTokens(text),
        chars: text.length,
        position: m.position, depth: m.depth, role: m.role,
        sections: parseSections(filterMuted(m, m.text)).filter(x => !x.group).length,
        muted: mutedCount(m),
        head: text.slice(0, 160),
        tail: text.slice(-160),
    };
    refreshInjectLog();
}

// ---------------------------------------------------------------- hiding

const lastIndex = () => (ctx().chat?.length || 0) - 1;

// When tracking, pull the boundary to the archive's last heading number. Returns a reason string if it can't.
function syncTrackedBoundary(m) {
    if (!m.track) return null;
    const n = guessEndNumber(m.text);
    if (n === null) return '아카이브 제목에서 #번호를 못 찾았어요';
    if (n > lastIndex()) return `아카이브 마지막 번호 #${n}가 채팅 마지막 #${lastIndex()}보다 커요 (다른 채팅 번호일 수 있어요)`;
    m.boundary = n;
    return null;
}

async function applyHide({ silent = false } = {}) {
    const m = getMeta();
    if (!m) return;
    const problem = syncTrackedBoundary(m);
    if (problem) {
        if (!silent) toastr.warning(`${problem}. 숨기지 않았어요.`);
        return;
    }
    if (m.boundary < 0) {
        if (!silent) toastr.info('먼저 경계선(아카이브가 몇 번까지 다루는지)을 정해 주세요.');
        return;
    }
    await saveMeta();
    const hideEnd = m.boundary - Math.max(0, Number(m.keep) || 0);
    const last = lastIndex();
    const run = cmd => ctx().executeSlashCommandsWithOptions(cmd, { handleParserErrors: true, handleExecutionErrors: true });
    // only up to the boundary: everything after it is shown again
    if (hideEnd >= 0) await run(`/hide 0-${hideEnd}`);
    if (hideEnd + 1 <= last) await run(`/unhide ${Math.max(0, hideEnd + 1)}-${last}`);
    syncPanel();
    if (!silent) toastr.success(hideEnd >= 0 ? `#0 ~ #${hideEnd} 숨김 · #${hideEnd + 1}부터 보임 (마지막 ${m.keep}개 남김)` : '숨길 메시지가 없어서 모두 보이게 했어요');
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

// "## Y2 #574–#600 — ..." → 600 (largest #number in the last numbered heading)
function guessEndNumber(text) {
    const heads = String(text).match(/^#{1,3} .*$/gm) || [];
    for (let i = heads.length - 1; i >= 0; i--) {
        const nums = [...heads[i].matchAll(/#(\d+)/g)].map(x => parseInt(x[1], 10));
        if (nums.length) return Math.max(...nums);
    }
    return null;
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

// ---- muted sections: kept in the text, left out of the injection

const sectionKey = s => s.title;
const mutedSet = m => new Set(Array.isArray(m.muted) ? m.muted : []);

function filterMuted(m, text) {
    const muted = mutedSet(m);
    if (!muted.size) return text;
    let out = '';
    let skipLevel = 0;
    for (const s of parseSections(text)) {
        if (skipLevel && s.level > skipLevel) continue;
        skipLevel = 0;
        if (muted.has(sectionKey(s))) {
            if (s.group) skipLevel = s.level;
            continue;
        }
        out += text.slice(s.start, s.end);
    }
    return out;
}

function mutedCount(m) {
    const muted = mutedSet(m);
    if (!muted.size) return 0;
    return parseSections(m.text).filter(s => muted.has(sectionKey(s))).length;
}

async function setMuted(key, on) {
    const m = getMeta();
    const set = mutedSet(m);
    on ? set.add(key) : set.delete(key);
    m.muted = [...set];
    await saveMeta();
    applyInjection();
    syncPanel();
}

const tokCache = new Map();
async function cachedTokens(text) {
    if (tokCache.has(text)) return tokCache.get(text);
    const n = await countTokens(text);
    if (tokCache.size > 400) tokCache.clear();
    tokCache.set(text, n);
    return n;
}
const shortNum = n => n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : fmt(n);

// ---- reorder / insert

const trimEnd = t => t.replace(/\s+$/, '');

function moveSectionText(text, s, dir) {
    const secs = parseSections(text);
    const i = secs.findIndex(x => x.start === s.start);
    const o = secs[i + dir];
    if (i < 0 || !o || o.group || s.group || o.level !== s.level || o.title === '(머리말)' || s.title === '(머리말)') return null;
    const [A, B] = dir > 0 ? [secs[i], o] : [o, secs[i]];
    const tail = text.slice(B.start, B.end).match(/\s*$/)[0] || '\n\n';
    const moved = trimEnd(text.slice(B.start, B.end)) + '\n\n' + trimEnd(text.slice(A.start, A.end)) + tail;
    return { text: text.slice(0, A.start) + moved + text.slice(B.end), start: dir > 0 ? A.start + trimEnd(text.slice(B.start, B.end)).length + 2 : A.start };
}

function insertAfterText(text, s) {
    const head = `${'#'.repeat(Math.max(1, s.level === 1 && !s.group ? 1 : s.level))} 새 섹션`;
    const before = trimEnd(text.slice(0, s.end));
    const after = text.slice(s.end);
    const block = `${head}\n\n- \n`;
    const start = before.length + 2;
    return { text: `${before}\n\n${block}${after ? '\n' : ''}${after}`, start };
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
        <div class="na_search_info"></div>
        <div class="na_list"></div>
      </div>`);
    $host.empty().append($root);
    const $list = $root.find('.na_list');
    const $search = $root.find('.na_search');
    const $info = $root.find('.na_search_info');
    const collapsed = new Set();
    const openCards = new Set();
    let pendingEdit = -1;
    let renderId = 0;

    const editSection = ($card, s) => {
        const m = getMeta();
        const original = m.text.slice(s.start, s.end);
        const $body = $card.children('.na_card_body').prop('hidden', false).empty();
        const $ta = $('<textarea class="text_pole na_sec_edit" spellcheck="false"></textarea>').val(trimEnd(original));
        const $btns = $(`<div class="na_card_actions">
            <span class="na_spacer"></span>
            <button type="button" class="na_btn na_small na_cancel">취소</button>
            <button type="button" class="na_btn na_small na_save na_primary"><i class="fa-solid fa-check"></i> 섹션 저장</button></div>`);
        $body.append($ta, $btns);
        $ta.trigger('focus');
        $ta.on('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); $btns.find('.na_save').trigger('click'); }
        });
        $btns.find('.na_cancel').on('click', render);
        $btns.find('.na_save').on('click', async () => {
            const cur = getMeta();
            if (cur.text.slice(s.start, s.end) !== original) {
                toastr.warning('아카이브가 그사이 바뀌어서 저장하지 않았어요. 다시 열어 주세요.');
                return;
            }
            const trail = original.match(/\s*$/)[0] || '\n\n';
            const edited = trimEnd($ta.val());
            const newTitle = (edited.match(/^#{1,3} (.*)$/m) || [])[1];
            // keep the mute switch attached when the title is renamed
            if (newTitle && newTitle !== s.title && mutedSet(cur).has(s.title)) {
                cur.muted = [...mutedSet(cur)].map(k => k === s.title ? newTitle.trim() : k);
            }
            if (openCards.has(s.title) && newTitle) openCards.add(newTitle.trim());
            await commitText(cur.text.slice(0, s.start) + edited + trail + cur.text.slice(s.end), `섹션 편집 전: ${s.title.slice(0, 40)}`);
            render();
            toastr.success('섹션 저장됨');
        });
    };

    const move = async (s, dir) => {
        const m = getMeta();
        const r = moveSectionText(m.text, s, dir);
        if (!r) return toastr.info(dir < 0 ? '맨 위예요 (같은 묶음 안에서만 옮겨요)' : '맨 아래예요 (같은 묶음 안에서만 옮겨요)');
        await commitText(r.text, `순서 이동 전: ${s.title.slice(0, 40)}`);
        render();
    };

    const insertAfter = async s => {
        const m = getMeta();
        const r = insertAfterText(m.text, s);
        await commitText(r.text, '새 섹션 추가 전');
        pendingEdit = r.start; // set after commit so only this final render opens the editor
        render();
    };

    const sw = (on, title) => `<button type="button" class="na_sw ${on ? 'on' : ''}" title="${title}" aria-pressed="${on}"><span></span></button>`;

    function render() {
        const m = getMeta();
        if (!m) return;
        const myId = ++renderId;
        const q = $search.val().trim();
        const sections = parseSections(m.text);
        const muted = mutedSet(m);
        const cardCount = sections.filter(x => !x.group).length;
        let shown = 0, hits = 0, editTarget = null;
        const allGroups = [];
        $list.empty();
        const groupStack = [];
        sections.forEach((s, idx) => {
            while (groupStack.length && groupStack[groupStack.length - 1].level >= s.level) groupStack.pop();
            const $parent = groupStack.length ? groupStack[groupStack.length - 1].$items : $list;
            const parentOff = groupStack.some(g => g.off);
            const off = muted.has(sectionKey(s));
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
                  <div class="na_group na_lv${s.level} ${off ? 'na_off' : ''} ${parentOff ? 'na_off_parent' : ''}">
                    <div class="na_group_head">
                      <i class="fa-solid fa-chevron-${isOpen ? 'down' : 'right'} na_group_chev"></i>
                      <span class="na_group_title">${highlight(groupLabel(s.title), q)}</span>
                      <span class="na_group_line"></span>
                      <span class="na_group_meta"></span>
                      ${s.note ? '<button type="button" class="na_icon na_icon_sm na_group_edit" title="머리글 편집"><i class="fa-solid fa-pen"></i></button>' : ''}
                      ${sw(!off, off ? '이 묶음 주입 켜기' : '이 묶음 통째로 주입에서 빼기')}
                    </div>
                    ${s.note ? `<div class="na_group_note">${highlight(s.note, q)}</div>` : ''}
                    <div class="na_card_body" hidden></div>
                    <div class="na_group_items" ${isOpen ? '' : 'hidden'}></div>
                  </div>`);
                $g.find('> .na_group_head').on('click', () => {
                    if (q) return;
                    collapsed.has(key) ? collapsed.delete(key) : collapsed.add(key);
                    render();
                });
                $g.find('> .na_group_head .na_sw').on('click', e => { e.stopPropagation(); setMuted(key, !off); });
                $g.find('> .na_group_head .na_group_edit').on('click', e => {
                    e.stopPropagation();
                    $g.find('> .na_group_note').prop('hidden', true);
                    editSection($g, s);
                });
                $parent.append($g);
                const g = { level: s.level, $items: $g.children('.na_group_items'), $el: $g, off: off || parentOff, tok: [] };
                groupStack.push(g);
                allGroups.push(g);
                return;
            }
            if (q && !count) return;
            shown++;
            const isOpen = !!q || openCards.has(s.title);
            const $card = $(`
              <div class="na_card ${off ? 'na_off' : ''} ${parentOff ? 'na_off_parent' : ''}">
                <div class="na_card_head">
                  <span class="na_card_title">${highlight(s.title, q)}</span>
                  <span class="na_card_meta">${count ? `<span class="na_hit">${count}건</span>` : ''}<span class="na_tok">${fmt(body.length)}자</span></span>
                  ${sw(!off, off ? '주입 켜기' : '이 섹션만 주입에서 빼기 (본문은 그대로)')}
                </div>
                <div class="na_card_body" ${isOpen ? '' : 'hidden'}>
                  <div class="na_card_text">${highlight(body, q)}</div>
                  <div class="na_card_actions">
                    <button type="button" class="na_icon na_up" title="위로"><i class="fa-solid fa-arrow-up"></i></button>
                    <button type="button" class="na_icon na_down" title="아래로"><i class="fa-solid fa-arrow-down"></i></button>
                    <button type="button" class="na_icon na_ins" title="아래에 새 섹션"><i class="fa-solid fa-plus"></i></button>
                    <span class="na_spacer"></span>
                    <button type="button" class="na_btn na_small na_edit"><i class="fa-solid fa-pen"></i> 편집</button>
                  </div>
                </div>
              </div>`);
            $card.find('.na_card_head').on('click', () => {
                const $b = $card.children('.na_card_body');
                const willOpen = $b.prop('hidden');
                $b.prop('hidden', !willOpen);
                willOpen ? openCards.add(s.title) : openCards.delete(s.title);
            });
            $card.find('.na_card_head .na_sw').on('click', e => { e.stopPropagation(); setMuted(sectionKey(s), !off); });
            $card.find('.na_edit').on('click', e => { e.stopPropagation(); editSection($card, s); });
            $card.find('.na_up').on('click', () => move(s, -1));
            $card.find('.na_down').on('click', () => move(s, 1));
            $card.find('.na_ins').on('click', () => insertAfter(s));
            $parent.append($card);
            if (s.start === pendingEdit) editTarget = [$card, s];
            const job = cachedTokens(body).then(n => {
                if (myId !== renderId) return;
                $card.find('.na_tok').text(`${shortNum(n)} 토큰`).attr('title', `${fmt(body.length)}자`);
                return n;
            });
            groupStack.forEach(g => g.tok.push(job));
        });
        // group badges: card count, then card count · token sum
        allGroups.forEach(g => {
            const n = g.$el.find('.na_card').length;
            const $meta = g.$el.find('> .na_group_head .na_group_meta').text(`${n}`);
            if (q && !n && !g.$el.find('> .na_group_head mark, > .na_group_note mark').length) { g.$el.remove(); return; }
            Promise.all(g.tok).then(ns => {
                if (myId === renderId) $meta.text(`${n} · ${shortNum(ns.reduce((x, y) => x + (y || 0), 0))}`);
            });
        });
        const offN = mutedCount(m);
        $info.html(q
            ? `"${esc(q)}" — 섹션 ${shown}개에서 ${hits}건`
            : `섹션 ${cardCount}개${offN ? ` · <span class="na_warn_txt">${offN}개 꺼짐</span>` : ''} · 스위치로 주입에서 뺄 수 있어요`);
        if (!sections.length) $list.html('<div class="na_empty">아카이브가 비어 있어요.<br>개요 탭에 붙여넣거나 보관 탭에서 불러오세요.</div>');
        if (editTarget) { pendingEdit = -1; editSection(...editTarget); editTarget[0][0].scrollIntoView({ block: 'center' }); }
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

            <div class="na_carry" id="na_carry" hidden>
              <i class="fa-solid fa-route"></i>
              <div class="na_carry_text"><b>이어서 쓸까요?</b><span id="na_carry_desc"></span></div>
              <div class="na_carry_btns">
                <button type="button" class="na_btn na_small na_primary" id="na_carry_go">가져오기</button>
                <button type="button" class="na_icon na_icon_sm" id="na_carry_x" title="닫기"><i class="fa-solid fa-xmark"></i></button>
              </div>
            </div>

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
                    <p>여기서 고치고 <b>저장</b>하면 다음 턴부터 반영돼요.</p>
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
                <textarea id="na_editor" class="text_pole na_editor" spellcheck="false" placeholder="# 제목&#10;&#10;# ── Y1 ──&#10;&#10;## #0–#47 — ..."></textarea>
                <div class="na_editor_actions">
                  <button type="button" class="na_btn" id="na_ed_revert"><i class="fa-solid fa-rotate-left"></i> 되돌리기</button>
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
                    <p>스위치를 끄면 본문은 두고 주입에서만 빠져요. 카드를 펼치면 순서 이동·새 섹션 추가·편집.</p>
                  </div>
                  <button type="button" class="na_btn na_small" id="na_sec_big"><i class="fa-solid fa-up-right-and-down-left-from-center"></i> 크게</button>
                </div>
                <div id="na_sec_host"></div>
              </div>
            </section>

            <!-- 압축 -->
            <section class="na_tab_pane" data-pane="compress" hidden>
              <div class="na_block">
                <div class="na_block_head"><div><h4>경계선</h4><p>아카이브가 다루는 마지막 메시지 번호예요. 그 앞은 숨겨서 토큰을 아껴요.</p></div></div>
                <div class="na_set_list">
                  <label class="na_set_row"><span><span>아카이브 따라가기</span><small id="na_track_info">제목의 마지막 #번호를 경계선으로</small></span><input type="checkbox" id="na_track" class="na_toggle"></label>
                  <label class="na_set_row" id="na_boundary_row"><span>아카이브는 #… 까지</span><input type="number" id="na_boundary" class="text_pole" min="0" placeholder="-"></label>
                  <label class="na_set_row"><span>숨길 때 남길 메시지</span><input type="number" id="na_keep" class="text_pole" min="0" max="50"></label>
                </div>
                <div class="na_since" id="na_since"></div>
              </div>
              <div class="na_block">
                <div class="na_block_head"><div><h4>압축 루틴</h4><p>추가할 때 새 섹션 제목의 마지막 #번호를 읽어서 경계선을 맞춰요.</p></div></div>
                <div class="na_steps">
                  <button type="button" class="na_step" id="na_open_extract"><b>1</b><span><strong>원문 뽑기</strong><small>경계선 이후 메시지 · 압축 지시문 붙여 복사</small></span><i class="fa-solid fa-chevron-right"></i></button>
                  <button type="button" class="na_step" id="na_open_append"><b>2</b><span><strong>아카이브에 추가</strong><small>압축본 붙여넣기 · 번호 검사 · 경계선 자동</small></span><i class="fa-solid fa-chevron-right"></i></button>
                  <button type="button" class="na_step na_step_sub" id="na_apply_hide"><b><i class="fa-solid fa-eye-slash"></i></b><span><strong>숨기기 다시 적용</strong><small>경계선 앞만 숨기고 뒤는 다시 보이게</small></span><i class="fa-solid fa-chevron-right"></i></button>
                </div>
              </div>
            </section>

            <!-- 보관 -->
            <section class="na_tab_pane" data-pane="vault" hidden>
              <div class="na_block">
                <div class="na_block_head">
                  <div><h4>복구 지점</h4><p>바꾸기 직전 상태를 자동으로 남겨요 (최근 ${SNAPSHOT_MAX}개).</p></div>
                  <button type="button" class="na_btn na_small" id="na_snap_now"><i class="fa-solid fa-bookmark"></i> 지금 보관</button>
                </div>
                <div id="na_snap_list" class="na_snap_list"></div>
              </div>
              <div class="na_block">
                <div class="na_block_head"><div><h4>가져오기</h4></div></div>
                <div class="na_tiles">
                  <button type="button" class="na_tile" id="na_import"><i class="fa-solid fa-file-arrow-up"></i><span>파일에서</span><small>.txt · .json</small></button>
                  <button type="button" class="na_tile" id="na_from_chat"><i class="fa-solid fa-comments"></i><span>다른 채팅에서</span><small>같은 캐릭터</small></button>
                </div>
                <div class="na_block_head na_block_head_gap"><div><h4>내보내기</h4></div></div>
                <div class="na_tiles">
                  <button type="button" class="na_tile" id="na_export"><i class="fa-solid fa-file-lines"></i><span>.txt</span><small>본문만</small></button>
                  <button type="button" class="na_tile" id="na_export_json"><i class="fa-solid fa-box-archive"></i><span>.json 백업</span><small>설정·복구 지점까지</small></button>
                </div>
                <div class="na_row na_right"><button type="button" class="na_linkbtn na_danger" id="na_clear"><i class="fa-solid fa-eraser"></i> 아카이브 비우기</button></div>
                <input type="file" id="na_file" accept=".txt,.md,.json,text/plain,application/json" hidden>
              </div>
            </section>

            <!-- 설정 -->
            <section class="na_tab_pane" data-pane="config" hidden>
              <div class="na_block">
                <div class="na_block_head"><div><h4>주입</h4></div></div>
                <div class="na_set_list">
                  <label class="na_set_row"><span>아카이브 주입</span><input type="checkbox" id="na_enabled" class="na_toggle"></label>
                  <label class="na_set_row"><span>위치</span>
                    <select id="na_position" class="text_pole">${Object.entries(POSITIONS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
                  </label>
                  <label class="na_set_row" id="na_depth_field"><span>깊이</span><input type="number" id="na_depth" class="text_pole" min="0" max="999"></label>
                  <label class="na_set_row"><span>역할</span>
                    <select id="na_role" class="text_pole">${Object.entries(ROLES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
                  </label>
                  <div class="na_set_row"><span><span>꺼 둔 섹션 <b id="na_muted_n">0</b>개</span><small>섹션 탭의 스위치로 끈 것</small></span><button type="button" class="na_btn na_small" id="na_unmute_all">모두 켜기</button></div>
                </div>
              </div>
              <div class="na_block">
                <div class="na_block_head"><div><h4>감싸기</h4><p><code>{{archive}}</code> 자리에 본문이 들어가요. 비워 두면 본문만.</p></div></div>
                <textarea id="na_wrap" class="text_pole na_wrap" rows="3" spellcheck="false" placeholder="<story_archive>&#10;{{archive}}&#10;</story_archive>"></textarea>
              </div>
              <div class="na_block">
                <div class="na_set_list">
                  <label class="na_set_row"><span>압축 알림 <small>원문이 이 토큰을 넘으면 표시 · 0은 끔</small></span><input type="number" id="na_remind" class="text_pole" min="0" step="1000"></label>
                </div>
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
    $('#na_track').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.track = this.checked;
        const problem = syncTrackedBoundary(m);
        await saveMeta(); syncPanel();
        if (problem) toastr.warning(problem);
        else if (m.track) toastr.success(`경계선을 #${m.boundary}로 맞췄어요`);
    });

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
        const { lastInject, ...rest } = getMeta();
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
    $('#na_from_chat').on('click', needChat(openChatPicker));
    $('#na_carry_go').on('click', needChat(async () => { if (carryOffer) await importArchive(carryOffer, '방금 있던 채팅'); }));
    $('#na_carry_x').on('click', () => { carryOffer = null; $('#na_carry').prop('hidden', true); });
    $('#na_unmute_all').on('click', needChat(async () => {
        const m = getMeta(); m.muted = []; await saveMeta(); applyInjection(); syncPanel();
    }));
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
            for (const k of SETTING_KEYS) if (Object.hasOwn(d, k)) m[k] = d[k];
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
    if (!on) { $('#na_carry').prop('hidden', true); refreshStatus(); return; }
    const m = getMeta();
    if (!editorDirty) $('#na_editor').val(m.text).trigger('input');
    $('#na_enabled').prop('checked', !!m.enabled);
    $('#na_position').val(String(m.position));
    $('#na_depth').val(m.depth);
    $('#na_depth_field').toggleClass('na_disabled', Number(m.position) !== 1);
    $('#na_role').val(String(m.role));
    if (document.activeElement?.id !== 'na_wrap') $('#na_wrap').val(m.wrap);
    $('#na_remind').val(m.remindTok);
    $('#na_muted_n').text(mutedCount(m));
    $('#na_unmute_all').prop('disabled', !mutedCount(m));
    $('#na_carry').prop('hidden', !carryOffer);
    if (carryOffer) $('#na_carry_desc').text(`방금 있던 채팅의 아카이브 (${fmt(carryOffer.text.length)}자)를 이 채팅에 가져와요.`);
    rememberArchive();
    $('#na_boundary').val(m.boundary >= 0 ? m.boundary : '');
    $('#na_track').prop('checked', !!m.track);
    $('#na_boundary_row').toggleClass('na_disabled', !!m.track);
    {
        const n = guessEndNumber(m.text);
        $('#na_track_info').html(n === null ? '제목에 #번호가 없어요'
            : `아카이브 마지막 번호 <b>#${n}</b>${n > lastIndex() ? ' <span class="na_warn_txt">· 채팅보다 커요</span>' : ''}`);
    }
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
              <button type="button" class="na_icon na_snap_diff" title="지금과 비교"><i class="fa-solid fa-code-compare"></i></button>
              <button type="button" class="na_icon na_snap_view" title="내용 보기"><i class="fa-regular fa-eye"></i></button>
              <button type="button" class="na_icon na_snap_restore" title="이 지점으로 복원"><i class="fa-solid fa-clock-rotate-left"></i></button>
              <button type="button" class="na_icon na_snap_del" title="삭제"><i class="fa-regular fa-trash-can"></i></button>
            </div>
          </div>`);
        $row.find('.na_snap_diff').on('click', () => openDiff(s));
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
        <div class="na_log_row"><span>시각</span><b>${esc(timeLabel(li.at))}</b></div>
        <div class="na_log_row"><span>분량</span><b>${fmt(li.tokens)} 토큰</b><span class="na_dim">${fmt(li.chars)}자 · 섹션 ${li.sections}개${li.muted ? ` · ${li.muted}개 꺼짐` : ''}</span></div>
        <div class="na_log_row"><span>자리</span><b>${esc(where)}</b><span class="na_dim">${esc(ROLES[li.role] || '')} 역할</span></div>
        <div class="na_log_clip"><span>시작</span><pre>${esc(li.head)}${li.chars > 160 ? '…' : ''}</pre></div>
        <div class="na_log_clip"><span>끝</span><pre>${li.chars > 160 ? '…' : ''}${esc(li.tail)}</pre></div>
      </div>`);
}

// ---------------------------------------------------------------- carry over

let lastSeen = null;   // the most recent chat that had an archive, kept in memory
let carryOffer = null; // shown when we land in an empty chat right after one with an archive

const currentChatId = () => String(ctx().getCurrentChatId?.() || ctx().chatId || '');
const pickSettings = m => Object.fromEntries(SETTING_KEYS.map(k => [k, structuredClone(m[k])]));

function rememberArchive() {
    if (!hasChat()) return;
    const m = getMeta();
    if (m.text.trim()) lastSeen = { chatId: currentChatId(), text: m.text, settings: pickSettings(m) };
}

async function importArchive(src, label) {
    const m = getMeta();
    if (m.text.trim() && !await confirm('아카이브 가져오기', `이 채팅의 아카이브를 "${label}"의 것으로 바꿀까요? 지금 내용은 복구 지점에 남아요.`)) return false;
    for (const k of SETTING_KEYS) if (src.settings && Object.hasOwn(src.settings, k)) m[k] = structuredClone(src.settings[k]);
    editorDirty = false;
    carryOffer = null;
    // a new chat restarts numbering, so the boundary is cleared and tracking turned off
    m.track = false;
    await commitText(src.text, '가져오기 전', { boundary: -1 });
    toastr.success(`가져옴: ${label}`);
    return true;
}

async function fetchJson(url, body) {
    const c = ctx();
    const headers = c.getRequestHeaders ? c.getRequestHeaders() : { 'Content-Type': 'application/json' };
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return r.json();
}

// Other chats of the current character / group, newest first: [{ id, label, when, load() }]
async function listOtherChats() {
    const c = ctx();
    const here = currentChatId();
    if (c.groupId) {
        const g = (c.groups || []).find(x => x.id === c.groupId);
        return (g?.chats || []).filter(id => id !== here).reverse().map(id => ({
            id, label: id, when: '',
            load: async () => (await fetchJson('/api/chats/group/get', { id }))?.[0]?.chat_metadata?.[MODULE],
        }));
    }
    const ch = c.characters?.[c.characterId];
    if (!ch) return [];
    const data = await fetchJson('/api/characters/chats', { avatar_url: ch.avatar });
    const arr = (Array.isArray(data) ? data : Object.values(data || {})).filter(x => x?.file_name);
    return arr
        .map(x => ({ id: String(x.file_name).replace(/\.jsonl$/, ''), when: x.last_mes || '', count: x.chat_items }))
        .filter(x => x.id !== here)
        .sort((a, b) => (Date.parse(b.when) || 0) - (Date.parse(a.when) || 0))
        .map(x => ({
            ...x, label: x.id,
            load: async () => (await fetchJson('/api/chats/get', { ch_name: ch.name, file_name: x.id, avatar_url: ch.avatar }))?.[0]?.chat_metadata?.[MODULE],
        }));
}

async function openChatPicker() {
    const c = ctx();
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div>
          <h4>다른 채팅에서 가져오기</h4>
          <p>같은 캐릭터(또는 그룹)의 다른 채팅이에요. <b>확인</b>을 누르면 그 채팅에 아카이브가 있는지 열어 봐요. 가져오면 경계선은 비워져요.</p>
        </div></div>
        <div class="na_row"><button type="button" class="na_btn na_small na_check_all"><i class="fa-solid fa-magnifying-glass"></i> 최근 10개 모두 확인</button></div>
        <div class="na_pick_list"><div class="na_empty">불러오는 중…</div></div>
      </div>`);
    const popup = c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });

    let chats = [];
    try { chats = await listOtherChats(); }
    catch (e) {
        console.warn('[narrative-archive] chat list', e);
        $root.find('.na_pick_list').html('<div class="na_empty">채팅 목록을 못 불러왔어요. 이전 채팅에서 .json 백업 → 여기서 불러오기를 써 주세요.</div>');
        return popup;
    }
    const $list = $root.find('.na_pick_list').empty();
    if (!chats.length) $list.html('<div class="na_empty">다른 채팅이 없어요.</div>');
    const checkers = chats.map(chat => {
        const $row = $(`
          <div class="na_pick">
            <div class="na_pick_main">
              <span class="na_pick_name">${esc(chat.label)}</span>
              <span class="na_pick_meta">${chat.when ? esc(String(chat.when)) : ''}${chat.count ? ` · 메시지 ${fmt(chat.count)}개` : ''}</span>
            </div>
            <div class="na_pick_state"><button type="button" class="na_btn na_small na_pick_check">확인</button></div>
          </div>`);
        const check = async () => {
            const $st = $row.find('.na_pick_state').html('<span class="na_dim">여는 중…</span>');
            try {
                const meta = await chat.load();
                if (!meta?.text?.trim()) { $st.html('<span class="na_dim">아카이브 없음</span>'); return; }
                const tok = await countTokens(meta.text);
                $st.html(`<span class="na_chip">${fmt(tok)} 토큰</span><button type="button" class="na_btn na_small na_primary na_pick_go">가져오기</button>`);
                $st.find('.na_pick_go').on('click', async () => {
                    if (await importArchive({ text: meta.text, settings: meta }, chat.label)) $st.html('<span class="na_chip na_chip_on">가져옴</span>');
                });
            } catch (e) {
                console.warn('[narrative-archive] chat load', e);
                $st.html('<span class="na_warn_txt">못 열었어요</span>');
            }
        };
        $row.find('.na_pick_check').on('click', check);
        $list.append($row);
        return check;
    });
    $root.find('.na_check_all').on('click', async () => {
        for (const check of checkers.slice(0, 10)) await check();
    });
    return popup;
}

// ---------------------------------------------------------------- diff

// Line diff (LCS after trimming the shared head/tail). Returns [{ t: ' '|'+'|'-', line }].
function lineDiff(oldText, newText) {
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
    return out;
}

function renderDiff(rows, context = 2) {
    const keep = new Array(rows.length).fill(false);
    rows.forEach((r, i) => {
        if (r.t === ' ') return;
        for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) keep[k] = true;
    });
    let html = '', skipped = 0;
    const flush = () => { if (skipped) html += `<div class="na_diff_skip">··· 같은 줄 ${fmt(skipped)}개 ···</div>`; skipped = 0; };
    rows.forEach((r, i) => {
        if (!keep[i]) { skipped++; return; }
        flush();
        const cls = r.t === '+' ? 'na_diff_add' : r.t === '-' ? 'na_diff_del' : 'na_diff_same';
        html += `<div class="${cls}"><span>${r.t === ' ' ? '' : r.t}</span>${esc(r.line) || '&nbsp;'}</div>`;
    });
    flush();
    return html;
}

async function openDiff(snap) {
    const c = ctx();
    const rows = lineDiff(snap.text, getMeta().text);
    const add = rows.filter(r => r.t === '+').length, del = rows.filter(r => r.t === '-').length;
    const $v = $(`
      <div class="na_popup">
        <div class="na_diff_head">
          <b>${esc(timeLabel(snap.at))} · ${esc(snap.reason)}</b> → <b>지금</b>
          <span class="na_chip na_chip_add">+${fmt(add)}줄</span><span class="na_chip na_chip_del">−${fmt(del)}줄</span>
        </div>
        <div class="na_diff">${add || del ? renderDiff(rows) : '<div class="na_empty">내용이 똑같아요.</div>'}</div>
      </div>`);
    await c.callGenericPopup($v, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
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
    else if (over) state = '<span class="na_chip na_chip_warn">압축할 때예요</span>';
    else if (m.text.trim()) state = '<span class="na_chip na_chip_on">주입 중</span>';
    $('#na_meter_state').html(state);

    const pct = total ? Math.round(archiveTok / total * 100) : 0;
    $('#na_meter .na_seg_arc').css('width', `${pct}%`);
    $('#na_meter .na_seg_raw').css('width', `${total ? 100 - pct : 0}%`).toggleClass('na_over', over);
    $('#na_meter_legend').html(`
      <span><i class="na_dot na_dot_arc"></i>아카이브 ${fmt(archiveTok)}</span>
      <span><i class="na_dot na_dot_raw"></i>${m.boundary >= 0 ? `#${m.boundary} 이후 원문 ${fmt(afterTok)} · ${after.length}개` : '경계선 없음'}</span>
      ${mutedCount(m) ? `<span class="na_warn_txt"><i class="fa-solid fa-toggle-off"></i> 섹션 ${mutedCount(m)}개 꺼짐</span>` : ''}`);
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

const DEFAULT_PROMPT = `아래 원문(#{{from}}–#{{to}})을 기존 아카이브와 같은 형식으로 압축해 주세요.
- 섹션 제목은 "## #시작–#끝 — 짧은 제목" 형식
- 사건·관계 변화·약속·떡밥 위주로, 대사는 꼭 필요한 것만 원문 그대로
- 원문에 없는 내용은 쓰지 않기

[형식 참고 — 기존 아카이브의 마지막 섹션]
{{last_section}}

[원문]
{{raw}}`;

function globalSettings() {
    const es = ctx().extensionSettings;
    if (!es[MODULE] || typeof es[MODULE] !== 'object') es[MODULE] = {};
    const g = es[MODULE];
    const defaults = { prompt: DEFAULT_PROMPT, usePrompt: false, skipHidden: true, nameStyle: 'full', stripTags: false };
    for (const [k, v] of Object.entries(defaults)) if (!Object.hasOwn(g, k)) g[k] = v;
    return g;
}
const saveGlobal = () => ctx().saveSettingsDebounced?.();

// "## Y2 #574–#600 — ..." → { from: 574, to: 600 }
function headingRanges(text) {
    return (String(text).match(/^#{1,3} .*$/gm) || []).flatMap(line => {
        const r = line.match(/#(\d+)\s*[–—~-]\s*#?(\d+)/);
        return r ? [{ title: line.replace(/^#+\s*/, ''), from: parseInt(r[1], 10), to: parseInt(r[2], 10) }] : [];
    });
}

function lastRangedSection(text) {
    const secs = parseSections(text).filter(s => !s.group && /#\d+\s*[–—~-]\s*#?\d+/.test(s.title));
    const s = secs[secs.length - 1];
    return s ? trimEnd(text.slice(s.start, s.end)) : '';
}

function cleanMessage(text, g) {
    if (!g.stripTags) return text;
    return text
        .replace(/<(think|thinking|details)[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<[^>\n]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function formatExtract(items, g) {
    return items.map(x => {
        const head = g.nameStyle === 'name' ? `${x.name}:` : g.nameStyle === 'number' ? `[${x.i}]` : `[${x.i}] ${x.name}:`;
        return `${head}\n${x.text}`;
    }).join('\n\n');
}

function fillPrompt(tpl, vars) {
    let out = tpl;
    for (const [k, v] of Object.entries(vars)) out = out.split(`{{${k}}}`).join(v);
    return tpl.includes('{{raw}}') ? out : `${out}\n\n${vars.raw}`;
}

async function openExtract() {
    const c = ctx();
    const m = getMeta();
    const g = globalSettings();
    const last = (c.chat?.length || 0) - 1;
    const defStart = Math.min(m.boundary + 1, Math.max(0, last));

    const $root = $(`
      <div class="na_popup">
        <div class="na_ex_range">
          <label># <input type="number" class="text_pole na_num na_from" min="0" max="${last}" value="${Math.max(0, defStart)}"></label>
          <span>~</span>
          <label># <input type="number" class="text_pole na_num na_to" min="0" max="${last}" value="${Math.max(0, last)}"></label>
        </div>
        <details class="na_block na_details na_ex_opts">
          <summary>뽑기 옵션</summary>
          <div class="na_set_list">
            <label class="na_set_row"><span>숨긴 메시지 빼기</span><input type="checkbox" class="na_toggle na_opt_hidden"></label>
            <label class="na_set_row"><span><span>태그 지우기</span><small>&lt;think&gt; 블록 통째로, 나머지 HTML 태그는 글자만 남김</small></span><input type="checkbox" class="na_toggle na_opt_tags"></label>
            <label class="na_set_row"><span>머리글</span>
              <select class="text_pole na_opt_name">
                <option value="full">[번호] 이름:</option>
                <option value="name">이름:</option>
                <option value="number">[번호]</option>
              </select>
            </label>
          </div>
        </details>
        <details class="na_block na_details na_ex_prompt">
          <summary>압축 지시문 <span class="na_chip na_prompt_state"></span></summary>
          <div class="na_set_list">
            <label class="na_set_row"><span><span>복사할 때 지시문 붙이기</span><small>다른 모델에 그대로 붙여넣기용</small></span><input type="checkbox" class="na_toggle na_opt_prompt"></label>
          </div>
          <textarea class="text_pole na_prompt_ta" spellcheck="false" rows="9"></textarea>
          <div class="na_prompt_help">
            <code>{{raw}}</code> 원문 · <code>{{from}}</code> <code>{{to}}</code> 번호 · <code>{{last_section}}</code> 아카이브 마지막 섹션 · <code>{{archive}}</code> 아카이브 전체.
            <code>{{raw}}</code>가 없으면 원문은 맨 끝에 붙어요.
            <button type="button" class="na_linkbtn na_prompt_reset">기본값으로</button>
          </div>
        </details>
        <div class="na_ex_info na_dim"></div>
        <div class="na_ex_actions">
          <button type="button" class="na_btn na_save_txt"><i class="fa-solid fa-download"></i> .txt 저장</button>
          <button type="button" class="na_btn na_copy na_primary"><i class="fa-solid fa-copy"></i> <span class="na_copy_label">전체 복사</span></button>
        </div>
        <div class="na_ex_list"></div>
        <textarea class="na_ex_hidden" readonly></textarea>
      </div>`);

    $root.find('.na_opt_hidden').prop('checked', g.skipHidden);
    $root.find('.na_opt_tags').prop('checked', g.stripTags);
    $root.find('.na_opt_name').val(g.nameStyle);
    $root.find('.na_opt_prompt').prop('checked', g.usePrompt);
    $root.find('.na_prompt_ta').val(g.prompt);

    let current = '';
    let output = '';
    const range = () => {
        const from = parseInt($root.find('.na_from').val(), 10) || 0;
        const to = parseInt($root.find('.na_to').val(), 10);
        return { from, to: Number.isFinite(to) ? to : last };
    };
    const render = async () => {
        const { from, to } = range();
        const all = buildExtract(from, to);
        const items = all
            .filter(x => !(g.skipHidden && c.chat[x.i]?.is_system))
            .map(x => ({ ...x, text: cleanMessage(x.text, g) }))
            .filter(x => x.text);
        current = formatExtract(items, g);
        output = g.usePrompt
            ? fillPrompt(g.prompt, { raw: current, from: String(from), to: String(to), last_section: lastRangedSection(m.text), archive: m.text })
            : current;
        $root.find('.na_ex_hidden').val(output);
        $root.find('.na_prompt_state').text(g.usePrompt ? '붙임' : '안 붙임').toggleClass('na_chip_on', g.usePrompt);
        $root.find('.na_copy_label').text(g.usePrompt ? '지시문과 함께 복사' : '전체 복사');
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
        const skipped = all.length - items.length;
        $root.find('.na_ex_info').text(items.length
            ? `메시지 ${items.length}개${skipped ? ` (${skipped}개 뺌)` : ''} · 복사될 분량 약 ${fmt(await countTokens(output))} 토큰`
            : '이 범위에 메시지가 없습니다.');
    };

    let t;
    const later = () => { clearTimeout(t); t = setTimeout(render, 300); };
    $root.find('.na_from, .na_to').on('change', render);
    $root.find('.na_opt_hidden').on('change', function () { g.skipHidden = this.checked; saveGlobal(); render(); });
    $root.find('.na_opt_tags').on('change', function () { g.stripTags = this.checked; saveGlobal(); render(); });
    $root.find('.na_opt_name').on('change', function () { g.nameStyle = this.value; saveGlobal(); render(); });
    $root.find('.na_opt_prompt').on('change', function () { g.usePrompt = this.checked; saveGlobal(); render(); });
    $root.find('.na_prompt_ta').on('input', function () { g.prompt = this.value; saveGlobal(); later(); });
    $root.find('.na_prompt_reset').on('click', () => { g.prompt = DEFAULT_PROMPT; $root.find('.na_prompt_ta').val(g.prompt); saveGlobal(); render(); });
    $root.find('.na_copy').on('click', async () => {
        if (!current) return;
        const ok = await copyText(output, $root.find('.na_ex_hidden')[0]);
        ok ? toastr.success('복사됨') : toastr.warning('복사가 막혀 있어요. .txt 저장을 써 주세요.');
    });
    $root.find('.na_save_txt').on('click', () => {
        if (!current) return;
        const { from, to } = range();
        download(`원문_${chatLabel()}_${from}-${to}.txt`, output);
    });

    await render();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// ---------------------------------------------------------------- append popup

// Problems with the numbering of pasted sections, as display strings.
function checkAppend(m, add, last) {
    const ranges = headingRanges(add);
    const issues = [];
    if (!ranges.length) return { ranges, issues: ['제목에서 "#시작–#끝" 번호를 못 찾았어요. 번호 검사는 건너뛰어요.'], soft: true };
    const prevEnd = m.boundary >= 0 ? m.boundary : guessEndNumber(m.text);
    if (prevEnd !== null && prevEnd !== undefined) {
        const want = prevEnd + 1;
        const first = ranges[0].from;
        if (first > want) issues.push(`첫 섹션이 #${first}부터예요. #${want}–#${first - 1} (${first - want}개)가 빠졌어요.`);
        else if (first < want) issues.push(`첫 섹션 #${first}가 이미 압축된 #${prevEnd}까지와 겹쳐요.`);
    }
    ranges.forEach((r, i) => {
        if (r.from > r.to) issues.push(`"${r.title}" — 시작 #${r.from}이 끝 #${r.to}보다 커요.`);
        const prev = ranges[i - 1];
        if (!prev) return;
        if (r.from > prev.to + 1) issues.push(`#${prev.to}와 #${r.from} 사이 #${prev.to + 1}–#${r.from - 1}가 빠졌어요.`);
        else if (r.from <= prev.to) issues.push(`"${r.title}"가 앞 섹션(#${prev.to}까지)과 겹쳐요.`);
    });
    const end = ranges[ranges.length - 1].to;
    if (end > last) issues.push(`끝 #${end}가 채팅 마지막 #${last}보다 커요.`);
    return { ranges, issues, soft: false };
}

async function openAppend() {
    const c = ctx();
    const m = getMeta();
    const last = (c.chat?.length || 0) - 1;

    const $root = $(`
      <div class="na_popup">
        <div class="na_dim">새로 압축한 섹션을 붙여넣으세요. 아카이브 맨 끝에 덧붙습니다.</div>
        <textarea class="text_pole na_append_ta" spellcheck="false" placeholder="## Y2 #574–#600 — ..."></textarea>
        <div class="na_check" hidden></div>
        <div class="na_row">
          <label>이번에 압축한 끝 번호 # <input type="number" class="text_pole na_num na_end" min="0" max="${last}" value="${Math.max(0, last)}"></label>
          <span class="na_end_hint na_dim"></span>
        </div>
        <label class="checkbox_label"><input type="checkbox" class="na_do_hide" checked><span>저장 후 숨기기 적용 (마지막 ${m.keep}개 남김)</span></label>
        <div class="na_append_info na_dim"></div>
      </div>`);

    const $ta = $root.find('.na_append_ta');
    const $end = $root.find('.na_end');
    const $check = $root.find('.na_check');
    let endTouched = false;
    let lastCheck = { issues: [] };
    $end.on('input', () => { endTouched = true; $root.find('.na_end_hint').text(''); });
    let t;
    $ta.on('input', () => {
        clearTimeout(t);
        t = setTimeout(async () => {
            const val = $ta.val();
            const guess = guessEndNumber(val);
            if (guess !== null && !endTouched) {
                $end.val(guess);
                $root.find('.na_end_hint').html(`제목에서 <b>#${guess}</b>을 읽었어요`);
            }
            lastCheck = val.trim() ? checkAppend(m, val, last) : { issues: [] };
            if (!val.trim()) $check.prop('hidden', true);
            else if (!lastCheck.issues.length) {
                const r = lastCheck.ranges;
                $check.prop('hidden', false).attr('class', 'na_check na_check_ok')
                    .html(`<i class="fa-solid fa-circle-check"></i> 번호 이어짐 확인 · #${r[0].from}–#${r[r.length - 1].to}, 섹션 ${r.length}개`);
            } else {
                $check.prop('hidden', false).attr('class', `na_check ${lastCheck.soft ? 'na_check_soft' : 'na_check_warn'}`)
                    .html(`<i class="fa-solid fa-triangle-exclamation"></i><ul>${lastCheck.issues.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
            }
            $root.find('.na_append_info').text(`약 ${fmt(await countTokens(val))} 토큰 · 섹션 ${parseSections(val).filter(x => !x.group).length}개`);
        }, 400);
    });

    const result = await c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', {
        wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '추가', cancelButton: '취소',
    });
    if (result !== c.POPUP_RESULT.AFFIRMATIVE && result !== true) return;

    const add = String($ta.val() || '').replace(/\r\n/g, '\n').trim();
    if (!add) return toastr.info('붙여넣은 내용이 없어요.');
    const end = parseInt($root.find('.na_end').val(), 10);
    if (!Number.isFinite(end) || end < 0) return toastr.warning('끝 번호를 확인해 주세요.');
    const check = checkAppend(m, add, last);
    if (check.issues.length && !check.soft) {
        if (!await confirm('번호 확인', `${check.issues.join('\n')}\n\n그래도 추가할까요?`)) return;
    } else if (m.boundary >= 0 && end <= m.boundary) {
        if (!await confirm('경계선 확인', `끝 번호 #${end}가 기존 경계선 #${m.boundary}보다 앞이에요. 그래도 저장할까요?`)) return;
    }

    await commitText(m.text.replace(/\s+$/, '') + (m.text.trim() ? '\n\n' : '') + add + '\n', '추가 전', { boundary: end });
    if ($root.find('.na_do_hide').prop('checked')) await applyHide({ silent: true });
    toastr.success(`아카이브에 추가됨 · 경계선 #${end}`);
}

// ---------------------------------------------------------------- boot

function onChatChanged() {
    editorDirty = false;
    carryOffer = hasChat() && lastSeen && lastSeen.chatId !== currentChatId() && !getMeta().text.trim() ? lastSeen : null;
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
    for (const ev of [et.MESSAGE_RECEIVED, et.MESSAGE_SENT, et.MESSAGE_DELETED]) {
        if (ev) es.on(ev, refreshStatusSoon);
    }
    if (document.getElementById('extensions_settings2')) start();
})();
