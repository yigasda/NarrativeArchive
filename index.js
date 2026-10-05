// 서사 아카이브 (Narrative Archive)
// You write the archive. This extension stores it per chat, injects it,
// hides already-compressed messages, extracts raw ranges, and shows token counts.

const MODULE = 'narrative_archive';
const PROMPT_KEY = 'narrative_archive_injection';
const VERSION = '3.20.0';
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
    track: false,   // boundary follows the last #number in the archive's headings
    snapshots: [],  // [{ at, reason, text, boundary }] newest first
    muted: [],      // section titles left out of the injection
    lastInject: null,
    tokenCap: 0,    // 0 = no cap
    pinned: [],     // section/group titles never dropped by the cap
    linked: {},     // { title: [keywords] } — injected only when a keyword is in recent messages
    linkDepth: 4,   // how many recent messages to scan for those keywords
    history: [],    // [{ at, reason, added, removed, changed, delta, snapAt }] newest first
    backup: null,   // { at, how } — last .txt/.json export
    sinceBackup: 0, // changes since that export
    backupEvery: 10, // remind after this many changes (0 = off)
    lastExport: null, // { from, to, at, how } — the latest extract copied or saved
});

const SETTING_KEYS = ['keep', 'enabled', 'position', 'depth', 'role', 'muted', 'track', 'tokenCap', 'pinned', 'backupEvery', 'linked', 'linkDepth', 'glossary', 'logLinks', 'knowledge', 'knowInject', 'quotes', 'router', 'people', 'temps', 'voice', 'voiceInject', 'layers', 'fade', 'worldOn'];
const POSITIONS = { 1: '채팅 안 (깊이)', 0: '메인 프롬프트 뒤', 2: '메인 프롬프트 앞' };
const ROLES = { 0: '시스템', 1: '유저', 2: '어시스턴트' };

const ctx = () => SillyTavern.getContext();

// Switches: the real checkbox is hidden and a <span> next to it draws the switch, so no theme's
// input[type=checkbox] rules (boxes, ticks, forced sizes) can reach the look.
function skinToggles(root = document) {
    const list = root.matches?.('input.na_toggle') ? [root] : root.querySelectorAll?.('input.na_toggle:not(.na_tgl)') || [];
    for (const el of list) {
        if (el.classList.contains('na_tgl')) continue;
        el.classList.add('na_tgl');
        const ui = document.createElement('span');
        ui.className = 'na_tgl_ui';
        ui.setAttribute('aria-hidden', 'true');
        el.after(ui);
        // outside a <label> the span would not toggle the box by itself
        if (!el.closest('label')) ui.addEventListener('click', () => el.click());
    }
}
new MutationObserver(muts => { for (const mu of muts) for (const n of mu.addedNodes) if (n.nodeType === 1) skinToggles(n); })
    .observe(document.documentElement, { childList: true, subtree: true });

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
    if (!Array.isArray(md[MODULE].pinned)) md[MODULE].pinned = [];
    if (!Array.isArray(md[MODULE].history)) md[MODULE].history = [];
    delete md[MODULE].once; // removed in 1.4.0
    delete md[MODULE].aiDraft; // AI compress removed in 2.4.0
    return md[MODULE];
}

async function saveMeta() {
    await ctx().saveMetadata();
}

const HISTORY_MAX = 30;

// Which "##" sections were added, removed or edited between two archive texts.
function sectionChanges(a, b) {
    const map = t => {
        const o = new Map();
        for (const s of parseSections(t)) if (!s.group) o.set(s.title, t.slice(s.start, s.end).trim());
        return o;
    };
    const A = map(a), B = map(b);
    let added = [...B.keys()].filter(k => !A.has(k));
    let removed = [...A.keys()].filter(k => !B.has(k));
    // same "#from–#to" on both sides = the title was edited, not a new section
    const rangeOf = t => (t.match(/#\d+\s*[–—~-]\s*#?\d+/) || [])[0];
    const renamed = [];
    for (const r of [...removed]) {
        const key = rangeOf(r);
        const hit = key && added.find(x => rangeOf(x) === key);
        if (hit) { renamed.push(`${r} → ${hit}`); removed = removed.filter(x => x !== r); added = added.filter(x => x !== hit); }
    }
    return { added, removed, renamed, changed: [...B.keys()].filter(k => A.has(k) && A.get(k) !== B.get(k)) };
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
    const snapped = pushSnapshot(m, reason);
    if (next !== m.text) {
        const ch = sectionChanges(m.text, next);
        m.history.unshift({ at: Date.now(), reason: reason.replace(/ 전(?=$|:)/, ''), ...ch, delta: next.length - m.text.length, snapAt: snapped ? m.snapshots[0].at : null });
        m.history.length = Math.min(m.history.length, HISTORY_MAX);
        m.sinceBackup = (Number(m.sinceBackup) || 0) + 1;
        if (m.backupEvery > 0 && m.sinceBackup === m.backupEvery) toastr.info(`백업 뒤로 ${m.sinceBackup}번 바뀌었어요. 도구 탭에서 .json 백업을 받아 두세요.`, '서사 아카이브');
    }
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


const pinnedSet = m => new Set(Array.isArray(m.pinned) ? m.pinned : []);

// What actually gets injected: muted sections removed, older sections shortened by the forgetting curve,
// the shared world first. The token cap only warns.
async function buildInjection(m) {
    const { text, faded } = applyFade(m, filterMuted(m, m.text));
    const cap = Math.max(0, Number(m.tokenCap) || 0);
    const trimmed = [];
    const extra = text.trim() ? extraBlocks(m) : '';
    const world = worldText(m);
    const core = text.trim() ? `${trimEnd(text)}${extra}` : '';
    const final = world || core ? [world, core].filter(Boolean).join('\n\n') : '';
    const tokens = await cachedTokens(final);
    return { text: final, tokens, trimmed, cap, over: !!cap && tokens > cap, faded };
}

// ---------------------------------------------------------------- shared world
// World-setting text (places, myths, rules) kept once in the global settings and switched on per chat.
// g.worlds = [{ id, name, text, chars: [avatar] }]; m.worldOn = { id: true|false } — unset means "on if bound to this character"
const worldBooks = () => { const g = globalSettings(); if (!Array.isArray(g.worlds)) g.worlds = []; return g.worlds; };
const charKey = () => { const c = ctx(); return c.groupId ? `group:${c.groupId}` : String(c.characters?.[c.characterId]?.avatar || ''); };
const charName = () => { const c = ctx(); return c.groupId ? ((c.groups || []).find(x => x.id === c.groupId)?.name || '그룹') : (c.characters?.[c.characterId]?.name || ''); };

function worldIsOn(m, w) {
    const v = m?.worldOn?.[w.id];
    if (v === true || v === false) return v;
    const k = charKey();
    return !!k && Array.isArray(w.chars) && w.chars.includes(k);
}

function worldText(m) {
    return worldBooks().filter(w => String(w.text || '').trim() && worldIsOn(m, w))
        .map(w => `# WORLD — ${w.name || '세계관'}\n_Shared setting reference: true in every story in this world._\n\n${String(w.text).trim()}`).join('\n\n');
}

async function openWorlds() {
    const c = ctx();
    const m = getMeta();
    const g = globalSettings();
    const open = new Set();
    let importing = false;
    const $root = $(`
      <div class="na_popup na_v2 na_worlds">
        <div class="na_v2_title"><b>세계관 공유</b><small>여러 채팅이 같이 쓰는 설정 · 고치면 켠 채팅 모두에 반영돼요. 캐릭터에 묶으면 그 캐릭터의 새 채팅에서 저절로 켜져요</small></div>
        <div class="na_v2_row2">
          <button type="button" class="na_v2_btn primary na_wd_new"><i class="fa-solid fa-plus"></i> 새 세계관</button>
          <button type="button" class="na_v2_btn na_wd_imp">아카이브에서 가져오기</button>
        </div>
        <div class="na_wd_sum"><span class="na_wd_on_n"></span><b class="na_wd_tok"></b></div>
        <div class="na_wd_import" hidden></div>
        <div class="na_wd_list"></div>
      </div>`);
    const save = async () => { saveGlobal(); await saveMeta(); applyInjection(); syncPanel(); };
    const draw = () => {
        const books = worldBooks(), ck = charKey(), cn = charName();
        $root.find('.na_wd_list').html(books.length ? books.map(w => {
            const on = worldIsOn(m, w), bound = Array.isArray(w.chars) && w.chars.includes(ck), others = (w.chars || []).length - (bound ? 1 : 0);
            const how = !on ? '꺼짐' : m.worldOn?.[w.id] === true ? '직접 켬' : `${esc(cn)} 채팅에 묶임`;
            return `
            <div class="na_v2_card na_wd ${on ? 'on' : ''} ${open.has(w.id) ? 'open' : ''}" data-id="${esc(w.id)}">
              <div class="na_wd_head">
                <button type="button" class="na_wd_fold" aria-expanded="${open.has(w.id)}">
                  <span class="na_wd_icon"><i class="fa-solid fa-earth-asia"></i></span>
                  <span class="na_wd_name"><b>${esc(w.name || '세계관')}</b><small><span class="na_wd_ttok" data-id="${esc(w.id)}"></span> · ${how}</small></span>
                </button>
                <input type="checkbox" class="na_toggle na_wd_on" ${on ? 'checked' : ''} aria-label="이 채팅에 넣기" title="이 채팅에 넣기">
              </div>
              ${open.has(w.id) ? `
              <div class="na_wd_body">
                <input type="text" class="text_pole na_wd_rename" value="${esc(w.name || '')}" placeholder="이름">
                <textarea class="text_pole na_wd_text" rows="10" spellcheck="false" placeholder="## 장소 이름&#10;- 설정…">${esc(w.text || '')}</textarea>
                <div class="na_wd_foot">
                  ${ck ? `<label class="na_wd_bindchip ${bound ? 'on' : ''}"><input type="checkbox" class="na_wd_bind" ${bound ? 'checked' : ''}>${faceHtml(cn, 20)}<span>${esc(cn)} 채팅에서 저절로 켜기</span></label>` : ''}
                  ${others > 0 ? `<small class="na_v2_note">다른 캐릭터 ${others}명에도 묶임</small>` : ''}
                  <span class="na_spacer"></span>
                  <button type="button" class="na_linkbtn na_danger na_wd_del">지우기</button>
                </div>
              </div>` : ''}
            </div>`; }).join('') : '<div class="na_empty">아직 없어요. "새 세계관"을 만들거나 아카이브의 설정 섹션을 가져오세요.</div>');
        Promise.all(books.map(w => countTokens(String(w.text || '')))).then(ts => {
            books.forEach((w, i) => $root.find(`.na_wd_ttok[data-id="${w.id}"]`).text(`${fmt(ts[i])} 토큰`));
            const onB = books.filter(w => worldIsOn(m, w));
            const t = books.reduce((a, w, i) => a + (worldIsOn(m, w) ? ts[i] : 0), 0);
            $root.find('.na_wd_on_n').text(books.length ? `이 채팅에 켜진 세계관 ${onB.length}개` : '');
            $root.find('.na_wd_tok').text(t ? `약 ${fmt(t)} 토큰` : '');
        });
    };
    const book = el => worldBooks().find(w => w.id === String($(el).closest('.na_wd').data('id')));
    $root.on('click', '.na_wd_fold', function () { const w = book(this); open.has(w.id) ? open.delete(w.id) : open.add(w.id); draw(); });
    $root.on('change', '.na_wd_rename', async function () { book(this).name = this.value.trim() || '세계관'; await save(); draw(); });
    $root.on('change', '.na_wd_text', async function () { book(this).text = this.value.replace(/\r\n/g, '\n'); await save(); draw(); });
    $root.on('change', '.na_wd_on', async function () { m.worldOn = { ...(m.worldOn || {}), [book(this).id]: this.checked }; await save(); draw(); });
    $root.on('change', '.na_wd_bind', async function () {
        const w = book(this), k = charKey();
        w.chars = Array.isArray(w.chars) ? w.chars.filter(x => x !== k) : [];
        if (this.checked) w.chars.push(k);
        await save(); draw();
    });
    $root.on('click', '.na_wd_del', async function () {
        const w = book(this);
        if (!await confirm('세계관 지우기', `"${w.name}"을 지울까요? 이 세계관을 켠 모든 채팅에서 빠져요. 되돌릴 수 없어요.`)) return;
        g.worlds = worldBooks().filter(x => x !== w);
        await save(); draw();
    });
    $root.find('.na_wd_new').on('click', async () => {
        const w = { id: newId(), name: `세계관 ${worldBooks().length + 1}`, text: '', chars: charKey() ? [charKey()] : [] };
        worldBooks().push(w);
        m.worldOn = { ...(m.worldOn || {}), [w.id]: true };
        open.add(w.id);
        await save(); draw();
        $root.find(`.na_wd[data-id="${w.id}"] .na_wd_text`).trigger('focus');
    });
    // copy or move archive sections (e.g. "## Ombos temple", "# WORLD") into a book
    $root.find('.na_wd_imp').on('click', function () {
        importing = !importing;
        $(this).toggleClass('active', importing);
        const $i = $root.find('.na_wd_import').prop('hidden', !importing);
        if (!importing) return;
        const secs = parseSections(m.text).filter(s => s.title !== '(머리말)');
        $i.html(`
          <div class="na_wd_secs">${secs.map((s, i) => `<label class="na_wd_sec ${s.group ? 'grp' : ''}"><input type="checkbox" data-i="${i}"><span>${esc(s.title)}</span><small class="na_dim">${fmt(s.end - s.start)}자</small></label>`).join('')}</div>
          <div class="na_wd_impfoot">
            <select class="text_pole na_wd_target"><option value="">새 세계관으로</option>${worldBooks().map(w => `<option value="${esc(w.id)}">${esc(w.name)}에 붙이기</option>`).join('')}</select>
            <label class="na_strip_item"><input type="checkbox" class="na_toggle na_wd_move"><span>아카이브에서 빼기</span></label>
            <button type="button" class="na_btn na_small na_primary na_wd_go"><i class="fa-solid fa-check"></i> 가져오기</button>
          </div>`);
        $i.find('.na_wd_go').on('click', async () => {
            const picked = $i.find('.na_wd_secs input:checked').map((_, el) => secs[Number(el.dataset.i)]).get();
            if (!picked.length) return toastr.info('섹션을 골라 주세요.');
            // a "#" heading becomes "##" inside the book so the book's own "# WORLD" stays the top level
            const text = picked.map(s => m.text.slice(s.start, s.end).replace(/^# /, '## ').trim()).join('\n\n');
            const tid = String($i.find('.na_wd_target').val() || '');
            let w = worldBooks().find(x => x.id === tid);
            if (!w) { w = { id: newId(), name: picked[0].title.replace(/^#+\s*/, '').slice(0, 30) || '세계관', text: '', chars: charKey() ? [charKey()] : [] }; worldBooks().push(w); }
            w.text = [String(w.text || '').trim(), text].filter(Boolean).join('\n\n');
            m.worldOn = { ...(m.worldOn || {}), [w.id]: true };
            if ($i.find('.na_wd_move').prop('checked')) {
                const drop = new Set(picked.map(s => s.start));
                await commitText(parseSections(m.text).filter(s => !drop.has(s.start)).map(s => m.text.slice(s.start, s.end)).join(''), '세계관으로 옮기기 전');
            }
            open.add(w.id);
            importing = false; $root.find('.na_wd_imp').removeClass('active'); $i.prop('hidden', true).empty();
            await save(); draw();
            sectionPanel?.render();
            toastr.success(`섹션 ${picked.length}개를 "${w.name}"에 넣었어요`);
        });
    });
    draw();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// ---------------------------------------------------------------- forgetting curve
// Each numbered section can keep a short version and a one-line version next to its full text (m.layers, keyed by section).
// With the curve on, the newest sections go in whole, older ones as their short version, the oldest as one line.
// Pinned sections, and sections a keyword or the AI router just called in, always go in whole.
const fadeCfg = m => { const f = m?.fade && typeof m.fade === 'object' ? m.fade : {}; return { on: !!f.on, full: Number.isFinite(+f.full) && f.full !== undefined ? Math.max(0, +f.full) : 8, short: Number.isFinite(+f.short) && f.short !== undefined ? Math.max(0, +f.short) : 20 }; };
const layersOf = m => (m.layers && typeof m.layers === 'object' ? m.layers : {});
const layerHash = (text, s) => textHash(text.slice(s.start, s.end).replace(/^[^\n]*\n?/, '').trim());

// what each numbered section should be: 'long' | 'short' | 'line' (before checking which versions exist)
function fadeWants(m, text = m.text) {
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
function fadeUse(m, text, s, want) {
    const L = layersOf(m)[sectionKey(s)];
    if (want === 'long' || !L) return 'long';
    if (L.h && L.h !== layerHash(text, s)) return 'long'; // the full text changed since the versions were made
    if (want === 'line' && String(L.line || '').trim()) return 'line';
    if (String(L.short || '').trim()) return 'short';
    return 'long';
}

function applyFade(m, text) {
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
        out += `${chunk.match(/^[^\n]*/)[0]}\n${String(use === 'line' ? L.line : L.short).trim()}\n\n`;
    }
    return { text: out, faded };
}

const AI_SYS_LAYERS = `GOAL
Make two shorter versions of ONE section of a story archive. The full section stays saved. Your versions are used when the section is old.

YOU GET
SECTION: its title line and its full text.

STEPS
1. Read the section. Mark what MUST survive:
   who did what · decisions · promises · secrets that came out · injuries · how a relationship changed ·
   facts later parts may depend on (names, places, objects, numbers like #346).
2. SHORT: rewrite the section in about one third of its length.
   Same form as the original (bullets stay bullets). Keep every fact from step 1.
   Cut mood, repeated feelings and exact dialogue. Keep a quote only if it is a line the story keeps coming back to.
3. LINE: one sentence, 30 words or fewer: the single most important thing that happened or changed.
4. Same language as the section. Add nothing that is not in the section. No comments.

EXAMPLE
SECTION:
## #12–#15 — The bridge (Spring 3, Varo)
- Ren and Mara cross the old bridge at dusk. Mara is afraid of heights; Ren holds her sleeve and talks about his sister to distract her.
- Halfway, a plank breaks. Ren falls to one knee and cuts his leg; Mara pulls him up. She says, "Now you owe me."
- On the far side Ivo waits with the horses. He tells them the duke has closed the south road, so they must go through Varo's market.
- That night Ren admits his sister is dead. Mara doesn't answer but sleeps next to him.
Answer:
SHORT:
- Crossing the old bridge at dusk, a plank broke; Ren cut his leg and Mara, afraid of heights, pulled him up: "Now you owe me."
- Ivo: the duke closed the south road, so they go through Varo's market.
- That night Ren admitted his sister is dead; Mara slept beside him without answering.
LINE:
Ren was hurt on the bridge and saved by Mara; that night he told her his sister is dead.

OUTPUT
Exactly this, nothing else:
SHORT:
<short version>
LINE:
<one sentence>`;

async function draftLayers(m, s) {
    const out = await askDraft(`SECTION:\n${m.text.slice(s.start, s.end).trim()}`, { system: AI_SYS_LAYERS, maxTokens: 4000 });
    const mt = stripThink(out).match(/SHORT:\s*\n?([\s\S]*?)\n\s*\**LINE:?\**\s*\n?([\s\S]+)$/i);
    if (!mt) throw new Error(`${s.title.slice(0, 30)}: 답 형식이 달라요 (SHORT:/LINE: 없음)`);
    return { short: mt[1].replace(/^\**\s*/, '').trim(), line: mt[2].trim().split('\n')[0].trim() };
}

async function saveLayers(m, s, short, line) {
    m.layers = layersOf(m);
    short = String(short || '').trim(); line = String(line || '').trim();
    if (!short && !line) delete m.layers[sectionKey(s)];
    else m.layers[sectionKey(s)] = { short, line, h: layerHash(m.text, s) };
    await saveMeta();
    applyInjection().then(() => sectionPanel?.render());
    syncPanel();
}

async function openLayers(s) {
    const c = ctx();
    const m = getMeta();
    const L = layersOf(m)[sectionKey(s)] || {};
    const full = m.text.slice(s.start, s.end).replace(/^[^\n]*\n?/, '').trim();
    const stale = L.h && L.h !== layerHash(m.text, s);
    const plan = fadeCfg(m).on ? fadeWants(m).get(sectionKey(s)) : null;
    const use = plan ? fadeUse(m, m.text, s, plan.want) : null;
    const name = { long: '원문', short: '짧게', line: '한 줄' };
    let tab = use && use !== 'long' ? use : (L.short ? 'short' : 'long');
    const $root = $(`
      <div class="na_popup na_v2 na_layers">
        <div class="na_v2_title"><small>섹션 버전</small><b>${esc(s.title)}</b></div>
        ${plan ? `<div class="na_v2_card na_v2_note">망각 곡선: 지금 <b>${name[use]}</b>으로 들어가요${plan.why === 'pin' ? ' (📌 고정)' : plan.why === 'called' ? ' (지금 불려 온 섹션)' : use !== plan.want ? ` · 원래는 ${name[plan.want]}인데 ${stale ? '원문이 바뀌어서' : '그 버전이 없어서'}` : ''}</div>` : ''}
        ${stale ? '<div class="na_xr_warn slim"><i class="fa-solid fa-triangle-exclamation"></i><div>버전을 만든 뒤에 원문이 바뀌었어요. 저장할 때까지 원문으로 들어가요.</div></div>' : ''}
        <div class="na_v2_seg na_ly_tabs">
          <button type="button" data-t="long"><span>원문</span><small class="na_ly_tok_long"></small></button>
          <button type="button" data-t="short"><span>짧게${use === 'short' ? ' · 지금' : ''}</span><small class="na_ly_tok_short"></small></button>
          <button type="button" data-t="line"><span>한 줄${use === 'line' ? ' · 지금' : ''}</span><small class="na_ly_tok_line"></small></button>
        </div>
        <div class="na_ly_pane" data-t="long"><div class="na_v2_card na_ly_full">${esc(full)}</div></div>
        <div class="na_ly_pane" data-t="short"><textarea class="text_pole na_ly_short" rows="8" spellcheck="false" placeholder="원문을 1/3쯤으로 줄인 것. 직접 붙여넣거나 초안 모델로 만들어요."></textarea></div>
        <div class="na_ly_pane" data-t="line"><textarea class="text_pole na_ly_line" rows="3" spellcheck="false" placeholder="가장 중요한 일 한 문장"></textarea></div>
        ${draftReady() ? `<div class="na_v2_row2"><button type="button" class="na_v2_btn na_ly_draft"><i class="fa-solid fa-feather-pointed"></i> 초안 모델로 ${L.short || L.line ? '다시' : '만들기'}</button></div><small class="na_v2_foot">${esc(drLabel())} · 짧게·한 줄을 같이 채워요. 저장해야 들어가요</small>` : '<small class="na_v2_foot">⚙ 설정 → AI · 번역 → 초안 모델을 정하면 여기서 바로 만들 수 있어요</small>'}
      </div>`);
    $root.find('.na_ly_short').val(L.short || '');
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
    $root.find('.na_ly_draft').on('click', async function () {
        const r = await withSpinner($(this), '만드는 중…', () => draftLayers(m, s));
        if (r) { $root.find('.na_ly_short').val(r.short); $root.find('.na_ly_line').val(r.line); tab = 'short'; show(); tok(); }
    });
    const res = await c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', { wide: true, large: false, allowVerticalScrolling: true, leftAlign: true, okButton: '저장', cancelButton: '닫기' });
    if (res !== c.POPUP_RESULT.AFFIRMATIVE && res !== true) return;
    await saveLayers(m, s, $root.find('.na_ly_short').val(), $root.find('.na_ly_line').val());
    toastr.success('섹션 버전을 저장했어요');
}

// sections that will want a shorter version and don't have one (or it is outdated)
function fadeMissing(m) {
    const out = [];
    for (const { s, want } of fadeWants(m).values()) {
        if (want === 'long') continue;
        const L = layersOf(m)[sectionKey(s)];
        const stale = L?.h && L.h !== layerHash(m.text, s);
        if (!L || stale || !String(L.short || '').trim() || (want === 'line' && !String(L.line || '').trim())) out.push(s);
    }
    return out;
}

let fadeFilling = null;
async function fillFade($btn) {
    if (fadeFilling) { fadeFilling.stop = true; $btn.prop('disabled', true); return; }
    const m = getMeta();
    const todo = fadeMissing(m);
    if (!todo.length) return toastr.info('채울 섹션이 없어요.');
    if (!await confirm('초안 모델로 채우기', `버전이 필요한 섹션 ${todo.length}개를 초안 모델(${drLabel()})로 하나씩 만들까요? 섹션마다 요청이 한 번씩 가요. 도중에 멈출 수 있어요.`)) return;
    fadeFilling = { stop: false };
    const html = $btn.html();
    let done = 0, failed = 0;
    try {
        for (const s of todo) {
            if (fadeFilling.stop) break;
            $btn.html(`<i class="fa-solid fa-stop"></i> 멈추기 (${done + failed + 1}/${todo.length})`);
            const cur = parseSections(m.text).find(x => sectionKey(x) === sectionKey(s));
            if (!cur) continue;
            try { const r = await draftLayers(m, cur); m.layers = layersOf(m); m.layers[sectionKey(cur)] = { ...r, h: layerHash(m.text, cur) }; done++; await saveMeta(); }
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

let lastBuild = { text: '', tokens: 0, trimmed: [], cap: 0, over: false, faded: new Map() };
let injectSeq = 0;
let injectReady = Promise.resolve(lastBuild);

function applyInjection() {
    const c = ctx();
    const m = hasChat() ? getMeta() : null;
    const seq = ++injectSeq;
    injectReady = (async () => {
        const b = m ? await buildInjection(m) : { text: '', tokens: 0, trimmed: [], cap: 0, over: false, faded: new Map() };
        if (seq !== injectSeq) return lastBuild;
        const fadeSig = f => [...(f || [])].map(e => e.join('=')).join('\n');
        const trimChanged = b.trimmed.join('\n') !== lastBuild.trimmed.join('\n') || fadeSig(b.faded) !== fadeSig(lastBuild.faded);
        lastBuild = b;
        if (trimChanged) sectionPanel?.render();
        if (!m || !m.enabled || !b.text) c.setExtensionPrompt(PROMPT_KEY, '', 1, 1);
        else {
            const pos = [0, 1, 2].includes(Number(m.position)) ? Number(m.position) : 1;
            c.setExtensionPrompt(PROMPT_KEY, b.text, pos, Math.max(0, Number(m.depth) || 0), false, Number(m.role) || 0);
        }
        return b;
    })();
    return injectReady;
}

// latest build, waiting for one in flight
const currentInjection = async () => { let p; do { p = injectReady; await p; } while (p !== injectReady); return lastBuild; };

async function onGenerationStarted(type, _opts, dryRun) {
    if (dryRun || type === 'quiet' || !hasChat()) return;
    const m = getMeta();
    if (routerCfg(m).mode !== 'off') {
        try { await runRouter(m); }
        catch (e) {
            console.warn('[narrative-archive] router', e);
            if (!routerWarned) { routerWarned = true; toastr.warning(`AI 라우터를 못 써서 키워드대로 넣었어요: ${e.message || e}`, '서사 아카이브'); }
        }
    }
    if (Object.keys(linkedMap(m)).length || routerCfg(m).mode !== 'off') { applyInjection(); refreshStatusSoon(); } // keyword links look at the latest messages
    await currentInjection();
    // how often each keyword-linked section actually went in, for the X-ray
    const links = Object.keys(linkedMap(m));
    if (m.enabled && links.length) {
        const st = (m.linkStats && typeof m.linkStats === 'object') ? m.linkStats : { gens: 0, on: {}, last: {} };
        st.gens = (st.gens || 0) + 1;
        st.on ||= {}; st.last ||= {};
        const waiting = linkWaiting(m);
        const muted = mutedSet(m);
        for (const k of links) if (!waiting.has(k) && !muted.has(k)) { st.on[k] = (st.on[k] || 0) + 1; st.last[k] = lastIndex(); }
        m.linkStats = st;
    }
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

const hiddenIndexes = () => (ctx().chat || []).flatMap((x, i) => x?.is_system ? [i] : []);

async function openUnhide() {
    const c = ctx();
    const last = lastIndex();
    const hidden = hiddenIndexes();
    if (!hidden.length) return toastr.info('숨긴 메시지가 없어요.');
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div>
          <h4>숨김 해제</h4>
          <p>숨긴 메시지 <b>${hidden.length}</b>개 (#${hidden[0]} ~ #${hidden[hidden.length - 1]}). 다시 보이게 할 범위를 고르세요.
          해제한 메시지는 다시 프롬프트에 들어가요.</p>
        </div></div>
        <div class="na_ex_range">
          <label># <input type="number" class="text_pole na_num na_uh_from" min="0" max="${last}" value="${hidden[0]}"></label>
          <span>~</span>
          <label># <input type="number" class="text_pole na_num na_uh_to" min="0" max="${last}" value="${hidden[hidden.length - 1]}"></label>
        </div>
        <div class="na_uh_info na_dim"></div>
      </div>`);
    const count = () => {
        const a = parseInt($root.find('.na_uh_from').val(), 10) || 0, b = parseInt($root.find('.na_uh_to').val(), 10);
        const n = hidden.filter(i => i >= a && i <= (Number.isFinite(b) ? b : last)).length;
        $root.find('.na_uh_info').text(`이 범위에서 ${n}개가 다시 보여요.`);
        return [a, Number.isFinite(b) ? b : last, n];
    };
    $root.find('input').on('input change', count);
    count();
    const r = await c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', { wide: false, okButton: '해제', cancelButton: '취소' });
    if (r !== c.POPUP_RESULT.AFFIRMATIVE && r !== true) return;
    const [a, b, n] = count();
    if (!n) return toastr.info('이 범위엔 숨긴 메시지가 없어요.');
    await c.executeSlashCommandsWithOptions(`/unhide ${Math.min(a, b)}-${Math.max(a, b)}`, { handleParserErrors: true, handleExecutionErrors: true });
    toastr.success(`#${Math.min(a, b)} ~ #${Math.max(a, b)} 숨김 해제 (${n}개)`);
    refreshStatus();
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
    const heads = headingLines(text).map(h => h.title);
    for (let i = heads.length - 1; i >= 0; i--) {
        const nums = [...heads[i].matchAll(/#(\d+)/g)].map(x => parseInt(x[1], 10));
        if (nums.length) return Math.max(...nums);
    }
    return null;
}

const extractToText = items => items.map(x => `[${x.i}] ${x.name}:\n${x.text}`).join('\n\n');

// ---------------------------------------------------------------- sections

// Section headings: "# " and "## " lines outside ``` / ~~~ code fences.
// "### " and deeper stay inside their section as sub-headings.
function headingLines(text) {
    const heads = [];
    let pos = 0, fence = null;
    for (const raw of String(text).split('\n')) {
        const line = raw.replace(/\r$/, '');
        const f = line.match(/^ {0,3}(`{3,}|~{3,})/);
        if (fence) {
            if (f && f[1][0] === fence[0] && f[1].length >= fence.length && !line.slice(f[0].length).trim()) fence = null;
        } else if (f) fence = f[1];
        else {
            const m = line.match(/^(#{1,2}) .*$/);
            if (m) heads.push({ start: pos, title: m[0], level: m[1].length });
        }
        pos += raw.length + 1;
    }
    return heads;
}

function parseSections(text) {
    const heads = headingLines(text);
    const sections = [];
    if (!heads.length) {
        if (text.trim()) sections.push({ title: '(제목 없음)', start: 0, end: text.length, level: 1, group: false });
        return sections;
    }
    if (text.slice(0, heads[0].start).trim()) sections.push({ title: '(머리말)', start: 0, end: heads[0].start, level: 1, group: false });
    heads.forEach((h, idx) => {
        const next = heads[idx + 1];
        const end = next ? next.start : text.length;
        // A "# " heading directly followed by "## " ("# ── Y1 ──" → "## #0–#47") is a group divider, not a card.
        const group = !!next && next.level > h.level;
        const note = text.slice(h.start + h.title.length, end).replace(/^\s*-{3,}\s*$/gm, '').trim();
        sections.push({ title: h.title.replace(/^#+\s*/, ''), start: h.start, end, level: h.level, group, note });
    });
    // key = title, plus "\u0001n" from the 2nd section with the same title on, so switches, pins and links
    // stay on one section. The first one keeps the bare title, so settings saved before still match.
    const seen = new Map();
    for (const s of sections) {
        const n = (seen.get(s.title) || 0) + 1;
        seen.set(s.title, n);
        s.key = n === 1 ? s.title : `${s.title}\u0001${n}`;
    }
    return sections;
}

// "회상\u00012" → "회상 (2번째)"
const keyLabel = k => { const [t, n] = String(k).split('\u0001'); return n ? `${t} (${n}번째)` : t; };

// key of the section at (or right after) `start` in `text`
const keyAt = (text, start) => { const x = parseSections(text).find(y => y.start >= start); return x ? sectionKey(x) : null; };

const groupLabel = title => title.replace(/^[\s─━—–=-]+|[\s─━—–=-]+$/g, '') || title;

function highlight(text, query) {
    const safe = esc(text);
    if (!query) return safe;
    return safe.replace(new RegExp(escRe(esc(query)), 'gi'), s => `<mark>${s}</mark>`);
}

// ---- muted sections: kept in the text, left out of the injection

const sectionKey = s => s.key ?? s.title;
const mutedSet = m => new Set(Array.isArray(m.muted) ? m.muted : []);

// ---- keyword-linked sections: left out until one of their keywords shows up in recent messages

const linkedMap = m => (m.linked && typeof m.linked === 'object' && !Array.isArray(m.linked)) ? m.linked : {};

function recentChatText(m, n = Math.max(1, Number(m.linkDepth) || 4)) {
    const chat = ctx().chat || [];
    const out = [];
    for (let i = chat.length - 1; i >= 0 && out.length < n; i--) {
        const x = chat[i];
        if (!x || x.is_system) continue;
        out.push(String(x.mes || ''));
    }
    return out.join('\n').toLowerCase();
}

// the keywords of `keys` that appear in `hay` (already lower-cased); plain substring match, any case
const linkHits = (keys, hay) => keys.filter(w => w && hay.includes(String(w).toLowerCase()));

// titles of linked sections whose keywords are not in the recent messages right now
function keywordWaiting(m) {
    const entries = Object.entries(linkedMap(m)).filter(([, k]) => Array.isArray(k) && k.length);
    if (!entries.length) return new Set();
    const hay = recentChatText(m);
    return new Set(entries.filter(([, keys]) => !linkHits(keys, hay).length).map(([t]) => t));
}

// ---- section links: "#217–#236", "(Y1 #346)", "since Y2 #506" inside a section's text point at the section holding that number.
// Unprefixed numbers belong to the unprefixed log if there is one (Y1 in "Y1 unprefixed" archives), else to the section's own log.
let linkCache = { text: null, links: null };
function sectionLinks(m) {
    const text = String(m?.text || '');
    if (linkCache.text === text) return linkCache.links;
    const secs = parseSections(text).filter(s => !s.group);
    const ranged = secs.map(s => { const r = s.title.match(RANGE_HEAD); return r ? { s, prefix: (r[1] || '').trim(), from: Math.min(+r[2], +r[4]), to: Math.max(+r[2], +r[4]) } : null; }).filter(Boolean);
    const hasBare = ranged.some(x => !x.prefix);
    const find = (prefix, n) => ranged.find(x => x.prefix === prefix && n >= x.from && n <= x.to)?.s;
    const out = new Map(), inn = new Map();
    for (const s of secs) {
        const own = (s.title.match(RANGE_HEAD)?.[1] || '').trim();
        const body = text.slice(s.start, s.end).replace(/^[^\n]*\n?/, '');
        const targets = new Set();
        // numbers the section's own heading already names ("STATE AT Y2 #604", "(Y1 #0–#590 · …)") are labels, not references
        const ownNums = new Set((s.title.match(/#\d+/g) || []).map(x => +x.slice(1)));
        for (const mt of body.matchAll(/(?:\b([A-Z]\w{0,10})\s+)?#(\d+)(?:\s*[–—~-]\s*#?(\d+))?/g)) {
            if (!RANGE_HEAD.test(s.title) && ownNums.has(+mt[2])) continue;
            const pre = mt[1] && ranged.some(x => x.prefix === mt[1]) ? mt[1] : (hasBare ? '' : own);
            const t = find(pre, +mt[2]);
            if (t && t !== s) targets.add(sectionKey(t));
        }
        if (targets.size) out.set(sectionKey(s), [...targets]);
        for (const t of targets) { if (!inn.has(t)) inn.set(t, []); inn.get(t).push(sectionKey(s)); }
    }
    const byKey = new Map(secs.map(s => [sectionKey(s), s]));
    linkCache = { text, links: { out, in: inn, byKey } };
    return linkCache.links;
}

// sections left out right now: keyword links that did not fire, and (with the AI router) the candidates it did not pick
function linkWaiting(m) {
    const out = keywordWaiting(m);
    const cfg = routerCfg(m);
    if (cfg.mode === 'off') return out;
    const picks = new Set(routerState.get(currentChatId())?.picks || []);
    // a picked section brings the sections it points at (its "see #217" background), unless switched off
    if (cfg.follow !== false) { const { out: lk } = sectionLinks(m); for (const k of [...picks]) for (const t of lk.get(k) || []) picks.add(t); }
    const lm = linkedMap(m);
    for (const s of routerCandidates(m)) {
        const k = sectionKey(s);
        if (picks.has(k)) out.delete(k);
        else if (cfg.mode === 'old' && !(Array.isArray(lm[k]) && lm[k].length)) out.add(k);
    }
    return out;
}

async function setLinked(title, keys) {
    const m = getMeta();
    const map = { ...linkedMap(m) };
    if (keys.length) map[title] = keys; else delete map[title];
    m.linked = map;
    await saveMeta();
    applyInjection();
    syncPanel();
}

function filterMuted(m, text) {
    const muted = new Set([...mutedSet(m), ...linkWaiting(m)]);
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

async function setPinned(key, on) {
    const m = getMeta();
    const set = pinnedSet(m);
    on ? set.add(key) : set.delete(key);
    m.pinned = [...set];
    await saveMeta();
    applyInjection();
    syncPanel();
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

// ---- heading format check: "## [prefix ]#from–#to — title", continuous numbering per prefix

const RANGE_HEAD = /^(?:(\S{1,12})\s)?#(\d+)\s*([–—~-])\s*#?(\d+)(.*)$/;

function checkHeadings(text) {
    const secs = parseSections(text).filter(s => !s.group && s.title !== '(머리말)' && s.title !== '(제목 없음)');
    const ranged = secs.map(s => ({ s, mt: s.title.match(RANGE_HEAD) })).filter(x => x.mt);
    const issues = [];
    const dashes = ranged.map(x => x.mt[3]);
    const mainDash = dashes.filter(d => d === '–').length >= dashes.length / 2 ? '–' : '-';
    const lastBy = new Map();
    const levelCount = {};
    ranged.forEach(x => { levelCount[x.s.level] = (levelCount[x.s.level] || 0) + 1; });
    const mainLevel = Number(Object.entries(levelCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 2);
    const span = (a, b) => a === b ? `#${a}` : `#${a}–#${b}`;
    for (const { s, mt } of ranged) {
        const prefix = (mt[1] || '').trim();
        const from = parseInt(mt[2], 10), to = parseInt(mt[4], 10);
        const rest = mt[5];
        const where = { start: s.start, title: s.title };
        if (from > to) issues.push({ ...where, msg: `시작 #${from}이 끝 #${to}보다 커요` });
        if (!/^\s+[—–-]\s+\S/.test(rest)) issues.push({ ...where, msg: '번호 뒤에 " — 제목"이 없어요' });
        if (mt[3] !== mainDash) issues.push({ ...where, msg: `번호 사이 대시가 "${mt[3]}"예요 (다른 제목은 "${mainDash}")` });
        const prev = lastBy.get(prefix);
        const lo = Math.min(from, to);
        if (prev) {
            if (lo > prev.to + 1) issues.push({ ...where, msg: `앞 섹션(#${prev.to}까지)과 사이 ${span(prev.to + 1, lo - 1)}가 빠졌어요` });
            else if (lo <= prev.to) issues.push({ ...where, msg: `앞 섹션(#${prev.from}–#${prev.to})과 번호가 겹쳐요` });
        }
        if (s.level !== mainLevel) issues.push({ ...where, msg: `제목 단계가 달라요 (${'#'.repeat(s.level)} — 다른 섹션은 ${'#'.repeat(mainLevel)})` });
        lastBy.set(prefix, { from: Math.min(from, to), to: Math.max(from, to) });
    }
    // duplicate titles are hard to tell apart (settings follow their order, not their text)
    const seen = new Map();
    for (const s of secs) {
        if (seen.has(s.title)) issues.push({ start: s.start, title: s.title, msg: '같은 제목이 또 있어요' });
        else seen.set(s.title, true);
    }
    return { issues: issues.sort((a, b) => a.start - b.start), ranged: ranged.length };
}

// Section browser shared by the panel tab and the large popup.
// Returns { render } — call render() after the archive changes.
function mountSectionBrowser($host) {
    const g0 = globalSettings();
    const $root = $(`
      <div class="na_browser ${g0.archLayout === 'tl' ? 'na_tl' : ''}">
        <div class="na_br_top">
          <div class="na_search_wrap">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="search" class="text_pole na_search" placeholder="이름, 장소, 대사로 찾기">
          </div>
          <div class="na_br_view" role="group" aria-label="보기">
            <button type="button" data-v="list" title="카드 목록" aria-label="카드 목록"><i class="fa-solid fa-list-ul"></i></button>
            <button type="button" data-v="tl" title="타임라인" aria-label="타임라인"><i class="fa-solid fa-timeline"></i></button>
          </div>
        </div>
        <div class="na_arch_tools"></div>
        <div class="na_br_filters"></div>
        <div class="na_tl_legend" aria-hidden="true"><span><i class="st-long"></i>원문</span><span><i class="st-short"></i>짧게</span><span><i class="st-line"></i>한 줄</span><span><i class="st-pin"></i>고정</span><span><i class="st-key"></i>키워드 대기</span><span><i class="st-off"></i>꺼짐</span></div>
        <div class="na_search_info"></div>
        <div class="na_list"></div>
      </div>`);
    $host.empty().append($root);
    // find & replace and the heading check sit as two pills under the search
    $root.find('.na_arch_tools').append($('#na_replace'), $('#na_hcheck'));
    const syncView = () => $root.find('.na_br_view button').each(function () { $(this).toggleClass('on', (this.dataset.v === 'tl') === $root.hasClass('na_tl')); });
    syncView();
    $root.on('click', '.na_br_view button', function () {
        const tl = this.dataset.v === 'tl';
        $root.toggleClass('na_tl', tl);
        const g = globalSettings(); g.archLayout = tl ? 'tl' : 'list'; saveGlobal();
        syncView();
    });
    let filter = 'all';
    $root.on('click', '.na_br_filters button', function () { filter = filter === this.dataset.f ? 'all' : this.dataset.f; render(); });
    const $list = $root.find('.na_list');
    const $search = $root.find('.na_search');
    const $info = $root.find('.na_search_info');
    // folded groups are kept per chat, so they stay folded after a reload
    const collapsedSet = () => new Set(Array.isArray(getMeta()?.collapsed) ? getMeta().collapsed : []);
    const setCollapsed = set => { const m = getMeta(); if (!m) return; m.collapsed = [...set]; saveMeta(); };
    const openCards = new Set();
    let pendingEdit = -1;
    let renderId = 0;

    const editSection = ($card, s) => {
        const m = getMeta();
        const original = m.text.slice(s.start, s.end);
        const $body = $card.find('.na_card_body').first().prop('hidden', false).empty();
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
            const newTitle = (edited.match(/^#{1,2} (.*)$/m) || [])[1];
            const next = cur.text.slice(0, s.start) + edited + trail + cur.text.slice(s.end);
            // keep switches, pins and keyword links attached when the title is renamed
            const nk = newTitle && newTitle.trim() !== s.title ? keyAt(next, s.start) : null;
            if (nk) {
                renameKeys(cur, sectionKey(s), nk);
                if (openCards.has(sectionKey(s))) openCards.add(nk);
            }
            await commitText(next, `섹션 편집 전: ${s.title.slice(0, 40)}`);
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

    const remove = async s => {
        if (!await confirm('섹션 삭제', `<b>${esc(s.title)}</b><br>이 섹션을 지울까요? 지우기 전 상태는 도구 탭 복구 지점에 남아요.`)) return;
        const cur = getMeta();
        if (!parseSections(cur.text).some(x => x.start === s.start && x.end === s.end && sectionKey(x) === sectionKey(s))) {
            toastr.warning('아카이브가 그사이 바뀌어서 지우지 않았어요. 다시 해 주세요.');
            return render();
        }
        const key = sectionKey(s);
        cur.muted = (cur.muted || []).filter(k => k !== key);
        cur.pinned = (cur.pinned || []).filter(k => k !== key);
        const lm = { ...linkedMap(cur) };
        if (lm[key]) { delete lm[key]; cur.linked = lm; }
        openCards.delete(key);
        const before = cur.text.slice(0, s.start), after = cur.text.slice(s.end);
        await commitText(after.trim() ? before + after : trimEnd(before) + (before.trim() ? '\n' : ''), `섹션 삭제 전: ${s.title.slice(0, 40)}`);
        render();
        toastr.success('섹션을 지웠어요');
    };

    const insertAfter = async s => {
        const m = getMeta();
        const r = insertAfterText(m.text, s);
        await commitText(r.text, '새 섹션 추가 전');
        pendingEdit = r.start; // set after commit so only this final render opens the editor
        render();
    };

    const sw = (on, title) => `<button type="button" class="na_sw ${on ? 'on' : ''}" title="${title}" aria-pressed="${on}"><span></span></button>`;
    const pinBtn = (on, what) => `<button type="button" class="na_icon na_icon_sm na_pin ${on ? 'on' : ''}" title="${on ? '고정 풀기' : `${what} 망각 곡선에서도 늘 원문으로 고정`}"><i class="fa-solid fa-thumbtack"></i></button>`;

    // "→ #217–#236 · ← Y2 #424" chips under a card: sections it points at, and sections that point at it
    const refChips = key => {
        const lk = sectionLinks(getMeta());
        const chip = k => { const t = lk.byKey.get(k); if (!t) return ''; const r = (t.title.match(/^(?:\S{1,12}\s)?#\d+\s*[–—~-]\s*#?\d+/) || [t.title.slice(0, 24)])[0]; return `<button type="button" class="na_ref_chip" data-start="${t.start}" title="${esc(t.title)}">${esc(r)}</button>`; };
        const o = (lk.out.get(key) || []).map(chip).join(''), i = (lk.in.get(key) || []).map(chip).join('');
        if (!o && !i) return '';
        return `<div class="na_card_refs">${o ? `<span class="na_ref_grp" title="이 섹션이 가리키는 섹션"><i class="fa-solid fa-arrow-right"></i>${o}</span>` : ''}${i ? `<span class="na_ref_grp" title="이 섹션을 가리키는 섹션"><i class="fa-solid fa-arrow-left"></i>${i}</span>` : ''}</div>`;
    };
    $list.on('click', '.na_ref_chip', function (e) { e.stopPropagation(); focus(Number(this.dataset.start)); });

    function render() {
        const m = getMeta();
        if (!m) return;
        const myId = ++renderId;
        // each group's card box scrolls on its own; keep where it was across re-renders
        const keepScroll = new Map();
        $list.find('.na_group').each((_, el) => keepScroll.set(el.dataset.key, el.querySelector(':scope > .na_group_items')?.scrollTop || 0));
        const q = $search.val().trim();
        const sections = parseSections(m.text);
        const muted = mutedSet(m);
        const pinned = pinnedSet(m);
        const trimmedSet = new Set();
        const links = linkedMap(m);
        const waiting = linkWaiting(m);
        const cardCount = sections.filter(x => !x.group).length;
        let shown = 0, hits = 0, editTarget = null;
        // filter chips: off / keyword / pinned / shortened, counted over cards
        const stateOf = s => {
            const k = sectionKey(s);
            return { off: muted.has(k), key: !!links[k]?.length, pin: pinned.has(k), fade: !!lastBuild.faded?.get(k) };
        };
        const cnt = { off: 0, key: 0, pin: 0, fade: 0 };
        for (const x of sections) if (!x.group) { const st = stateOf(x); for (const f in cnt) if (st[f]) cnt[f]++; }
        const fname = { off: '꺼짐', key: '키워드', pin: '고정', fade: '짧게 들어감' };
        $root.find('.na_br_filters').html(`<button type="button" data-f="all" class="${filter === 'all' ? 'on' : ''}">전체 ${cardCount}</button>${Object.keys(cnt).filter(f => cnt[f] || filter === f).map(f => `<button type="button" data-f="${f}" class="${filter === f ? 'on' : ''}">${fname[f]} ${cnt[f]}</button>`).join('')}`);
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
                const key = sectionKey(s);
                const isOpen = q || !collapsedSet().has(key);
                const $g = $(`
                  <div class="na_group na_lv${s.level} ${off ? 'na_off' : ''} ${parentOff ? 'na_off_parent' : ''}">
                    <div class="na_group_head">
                      <i class="fa-solid fa-chevron-${isOpen ? 'down' : 'right'} na_group_chev"></i>
                      <div class="na_head_main">
                        <span class="na_group_title">${highlight(groupLabel(s.title), q)}</span>
                        <span class="na_group_meta"></span>
                      </div>
                      <div class="na_head_ctrl">
                        ${s.note ? '<button type="button" class="na_icon na_icon_sm na_group_edit" title="머리글 편집"><i class="fa-solid fa-pen"></i></button>' : ''}
                        ${pinBtn(pinned.has(key), '이 묶음을')}
                        ${sw(!off, off ? '이 묶음 주입 켜기' : '이 묶음 통째로 주입에서 빼기')}
                      </div>
                    </div>
                    ${s.note ? `<div class="na_group_note">${q ? highlight(s.note, q) : s.note.split('\n').map(mdInline).join('<br>')}</div>` : ''}
                    <div class="na_card_body" hidden></div>
                    <div class="na_group_items" ${isOpen ? '' : 'hidden'}></div>
                  </div>`);
                $g.find('> .na_group_head').on('click', () => {
                    if (q) return;
                    const set = collapsedSet();
                    set.has(key) ? set.delete(key) : set.add(key);
                    setCollapsed(set);
                    render();
                });
                $g.find('> .na_group_head .na_sw').on('click', e => { e.stopPropagation(); setMuted(key, !off); });
                $g.find('> .na_group_head .na_pin').on('click', e => { e.stopPropagation(); setPinned(key, !pinned.has(key)); });
                $g.find('> .na_group_head .na_group_edit').on('click', e => {
                    e.stopPropagation();
                    $g.find('> .na_group_note').prop('hidden', true);
                    editSection($g, s);
                });
                $g[0].dataset.key = key;
                $parent.append($g);
                const g = { level: s.level, $items: $g.children('.na_group_items'), $el: $g, off: off || parentOff, tok: [] };
                groupStack.push(g);
                allGroups.push(g);
                return;
            }
            if (q && !count) return;
            if (filter !== 'all' && !stateOf(s)[filter]) return;
            shown++;
            const isOpen = !!q || openCards.has(sectionKey(s));
            const key = sectionKey(s);
            const rm = s.title.match(RANGE_HEAD);
            const rangeTxt = rm ? (s.title.match(/^(?:\S{1,12}\s)?#\d+\s*[–—~-]\s*#?\d+/) || [''])[0] : '';
            const rest = rm ? rm[5].replace(/^\s*[—–-]\s*/, '') : s.title;
            const paren = (rest.match(/\(([^()]*)\)\s*(?:\[[^\]]*\])?\s*$/) || [])[1] || '';
            const name = rest.replace(/\s*\([^()]*\)\s*(\[[^\]]*\])?\s*$/, '').replace(/\s*\[WI:[^\]]*\]\s*$/, '').trim() || rest;
            const fade = lastBuild.faded?.get(key);
            const isWait = waiting.has(key), isPin = pinned.has(key), hasKeys = !!links[key]?.length;
            const dot = off || parentOff ? 'off' : isPin ? 'pin' : hasKeys && isWait ? 'key' : fade || 'long';
            const tags = [
                fade && !off ? `<span class="na_tag fade" title="망각 곡선">${fade === 'line' ? '한 줄' : '짧게'}</span>` : '',
                hasKeys && !off ? `<span class="na_tag key" title="키워드: ${esc(links[key].join(', '))}">${isWait ? '키워드 대기' : '키워드 켜짐'}</span>` : '',
                isPin ? '<span class="na_tag pin">고정</span>' : '',
                count ? `<span class="na_tag hit">${count}건</span>` : '',
            ].join('');
            const $card = $(`
              <div class="na_card ${off ? 'na_off' : ''} ${parentOff ? 'na_off_parent' : ''} ${isWait && !off ? 'na_waiting' : ''}" data-start="${s.start}">
                <div class="na_rail" aria-hidden="true">${rm ? `<span>${esc(rm[1] ? `${rm[1]} ` : '')}#${rm[2]}</span><span>#${rm[4]}</span>` : ''}</div>
                <i class="na_dot st-${dot}" aria-hidden="true"></i>
                <div class="na_card_head">
                  <div class="na_head_main">
                    ${rangeTxt || paren ? `<span class="na_card_range">${rangeTxt ? `<span class="na_cr_range">${esc(rangeTxt)}</span>` : ''}${paren ? `<span class="na_cr_paren">${esc(paren)}</span>` : ''}</span>` : ''}
                    <span class="na_card_title" title="${esc(s.title)}">${highlight(name, q)}</span>
                  </div>
                  <span class="na_card_tags">${tags}</span>
                  <span class="na_tok">${fmt(body.length)}자</span>
                  ${sw(!off, off ? '주입 켜기' : '이 섹션만 주입에서 빼기 (본문은 그대로)')}
                </div>
                <div class="na_card_body" ${isOpen ? '' : 'hidden'}>
                  <div class="na_card_text">${highlight(body.replace(/^#{1,2} [^\n]*\n?/, '').trim(), q) || '<span class="na_dim">(비어 있음)</span>'}</div>
                  ${refChips(key)}
                  <div class="na_card_actions">
                    <button type="button" class="na_icon na_up" title="위로" aria-label="위로"><i class="fa-solid fa-arrow-up"></i></button>
                    <button type="button" class="na_icon na_down" title="아래로" aria-label="아래로"><i class="fa-solid fa-arrow-down"></i></button>
                    <button type="button" class="na_icon na_ins" title="아래에 새 섹션" aria-label="아래에 새 섹션"><i class="fa-solid fa-plus"></i></button>
                    <span class="na_act_sep"></span>
                    <button type="button" class="na_icon na_keys ${hasKeys ? 'active' : ''}" title="키워드 연동" aria-label="키워드 연동"><i class="fa-solid fa-key"></i></button>
                    ${RANGE_HEAD.test(s.title) ? `<button type="button" class="na_icon na_layers_btn ${layersOf(m)[key] ? 'active' : ''}" title="짧은 버전 · 한 줄 (망각 곡선)" aria-label="짧은 버전"><i class="fa-solid fa-layer-group"></i></button>` : ''}
                    <button type="button" class="na_icon na_pin_t ${isPin ? 'active' : ''}" title="${isPin ? '고정 풀기' : '망각 곡선에서도 늘 원문으로 고정'}" aria-label="고정"><i class="fa-solid fa-thumbtack"></i></button>
                    <button type="button" class="na_icon na_edit" title="편집" aria-label="편집"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" class="na_icon na_del na_danger" title="섹션 삭제" aria-label="섹션 삭제"><i class="fa-solid fa-trash-can"></i></button>
                    <span class="na_spacer"></span>
                    ${srcButton(m, s.title, 'icon')}
                  </div>
                </div>
              </div>`);
            $card.find('.na_card_head').on('click', () => {
                const $b = $card.children('.na_card_body');
                $card.toggleClass('open', !!$b.prop('hidden'));
                const willOpen = $b.prop('hidden');
                $b.prop('hidden', !willOpen);
                willOpen ? openCards.add(sectionKey(s)) : openCards.delete(sectionKey(s));
            });
            $card.find('.na_card_head .na_sw').on('click', e => { e.stopPropagation(); setMuted(sectionKey(s), !off); });
            $card.find('.na_pin_t').on('click', () => setPinned(key, !pinned.has(key)));
            if (isOpen) $card.addClass('open');
            $card.find('.na_edit').on('click', e => { e.stopPropagation(); editSection($card, s); });
            $card.find('.na_up').on('click', () => move(s, -1));
            $card.find('.na_down').on('click', () => move(s, 1));
            $card.find('.na_ins').on('click', () => insertAfter(s));
            $card.find('.na_keys').on('click', async () => {
                const keys = await openKeywords(s, body, links[sectionKey(s)] || []);
                if (keys) await setLinked(sectionKey(s), keys);
            });
            $card.find('.na_layers_btn').on('click', () => openLayers(s));
            $card.find('.na_del').on('click', () => remove(s));
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
            const $meta = g.$el.find('> .na_group_head .na_group_meta').text(`섹션 ${n}개`);
            if ((q || filter !== 'all') && !n && !(q && g.$el.find('> .na_group_head mark, > .na_group_note mark').length)) { g.$el.remove(); return; }
            Promise.all(g.tok).then(ns => {
                if (myId === renderId) $meta.text(`섹션 ${n}개 · ${shortNum(ns.reduce((x, y) => x + (y || 0), 0))} 토큰`);
            });
        });
        $info.html(q
            ? `"${esc(q)}" — 섹션 ${shown}개에서 ${hits}건`
            : filter !== 'all' ? `${fname[filter]} 섹션 ${shown}개` : '');
        if (!sections.length) $list.html('<div class="na_empty">아카이브가 비어 있어요.<br>원문 편집에 붙여넣거나 도구 탭에서 불러오세요.</div>');
        $list.find('.na_group').each((_, el) => {
            const box = el.querySelector(':scope > .na_group_items');
            if (box && keepScroll.has(el.dataset.key)) box.scrollTop = keepScroll.get(el.dataset.key);
        });
        if (editTarget) { pendingEdit = -1; editSection(...editTarget); editTarget[0][0].scrollIntoView({ block: 'center' }); }
    }

    function focus(start) {
        const s = parseSections(getMeta().text).find(x => x.start === start);
        if (!s) return;
        $search.val('');
        openCards.add(sectionKey(s));
        // open the groups on the way so the card is visible; other folded groups stay folded
        const set = collapsedSet();
        const stack = [];
        for (const x of parseSections(getMeta().text)) {
            if (x.start > start) break;
            while (stack.length && stack[stack.length - 1].level >= x.level) stack.pop();
            if (x.group) stack.push(x);
        }
        if (stack.some(g => set.delete(sectionKey(g)))) setCollapsed(set);
        render();
        const el = $list.find(`.na_card[data-start="${start}"]`)[0];
        if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('na_flash'); setTimeout(() => el.classList.remove('na_flash'), 1400); }
    }

    let t;
    $search.on('input', () => { clearTimeout(t); t = setTimeout(render, 200); });
    render();
    return { render, focus };
}

// Keyword-link editor: the keywords, candidates found in the section, and AI suggestions. Returns the list or null.
async function openKeywords(s, body, current) {
    const c = ctx();
    const m = getMeta();
    const split = v => [...new Set(String(v).split(/[,，\n]/).map(x => x.trim().replace(/^["'“”‘’\-*\s]+|["'“”‘’.\s]+$/g, '')).filter(Boolean))];
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div>
          <h4>키워드 연동</h4>
          <p>이 섹션을 평소엔 빼 두고, 최근 메시지에 키워드가 나올 때만 넣어요. 쉼표로 나눠 적고, 비우면 연동을 풀어요. 대화가 한국어면 한국어 키워드도 같이 넣어야 켜져요.</p>
        </div></div>
        <div class="na_dim na_kw_title"></div>
        <input type="text" class="text_pole na_kw_in" placeholder="map, 지도, treasur, 보물">
        <div class="na_kw_check"></div>
        <div class="na_kw_group na_kw_testbox">
          <div class="na_kw_label">키워드 테스트 <span class="na_dim">· 문장을 넣으면 위 키워드로 이 섹션이 불려 오는지 보여 줘요</span></div>
          <textarea class="text_pole na_kw_tin" rows="2" placeholder="예: 그 지도 아직 갖고 있어?"></textarea>
          <label class="checkbox_label na_kw_trecent"><input type="checkbox"><span>최근 메시지 ${Math.max(0, (Number(m.linkDepth) || 4) - 1)}개도 같이 (다음 메시지로 보낸다고 치기)</span></label>
          <div class="na_kw_tout"></div>
        </div>
        <div class="na_kw_group">
          <div class="na_kw_label">이 섹션에서 두드러지는 말 <span class="na_dim">· 다른 섹션엔 드물고 여기 자주 나와요</span></div>
          <div class="na_kw_chips na_kw_found"></div>
        </div>
        <div class="na_kw_group na_kw_broad_group">
          <div class="na_kw_label">너무 넓은 말 <span class="na_dim">· 넣으면 거의 항상 켜져요</span></div>
          <div class="na_kw_chips na_kw_broad"></div>
        </div>
        <div class="na_kw_group">
          <div class="na_ai_row">
            <button type="button" class="na_btn na_small na_kw_ai"><i class="fa-solid fa-wand-magic-sparkles"></i> AI로 제안</button>
            <small class="na_dim">주제·사건 중심으로, 한국어 표현까지</small>
          </div>
          <div class="na_kw_aiout"></div>
        </div>
      </div>`);
    const $in = $root.find('.na_kw_in').val(current.join(', '));
    $root.find('.na_kw_title').text(s.title);
    const an = keywordAnalysis(m, s, body);
    const stat = an.stat;
    const chipStat = w => {
        const ch = stat.chatPct(w), sc = stat.secCount(w);
        return `섹션 ${sc} · 채팅 ${pct(ch)}`;
    };
    const chip = (w, extra = '') => `<button type="button" class="na_pchip ${extra}" data-w="${esc(w)}" title="섹션 ${stat.secs}개 중 ${stat.secCount(w)}개, 채팅 메시지 ${stat.msgs}개 중 ${pct(stat.chatPct(w))}에 나와요">${esc(w)} <small>${chipStat(w)}</small></button>`;
    const mark = () => {
        const have = new Set(split($in.val()).map(x => x.toLowerCase()));
        $root.find('.na_pchip[data-w]').each(function () { $(this).toggleClass('on', have.has(String($(this).data('w')).toLowerCase())); });
        // what the chosen keywords would do
        const list = split($in.val());
        const lines = list.map(w => ({ w, warn: keywordWarn(w, stat) })).filter(x => x.warn.length);
        const any = list.some(w => stat.chatPct(w) > 0);
        const fire = stat.fireRate(list);
        $root.find('.na_kw_check').html(!list.length ? '' : `
            <div class="na_kw_sum ${fire > 0.3 ? 'warn' : ''}"><i class="fa-solid fa-chart-simple"></i> 지금 키워드면 지금까지 메시지의 <b>${pct(fire)}</b>에서 켜졌을 거예요${!any && stat.msgs ? ' · 이 채팅엔 아직 안 나온 말이에요' : ''}</div>
            ${lines.map(x => `<div class="na_kw_warn"><i class="fa-solid fa-triangle-exclamation"></i> <b>${esc(x.w)}</b> — ${x.warn.map(esc).join(' · ')}</div>`).join('')}`);
    };
    $root.find('.na_kw_found').html(an.distinct.length ? an.distinct.map(r => chip(r.show)).join('') : '<span class="na_dim">두드러지는 말이 없어요. AI로 제안을 눌러 보세요.</span>');
    if (an.broad.length) $root.find('.na_kw_broad').html(an.broad.map(r => chip(r.show, 'na_pchip_broad')).join(''));
    else $root.find('.na_kw_broad_group').hide();
    $root.on('click', '.na_pchip[data-w]', function () {
        const w = String($(this).data('w'));
        const list = split($in.val());
        const i = list.findIndex(x => x.toLowerCase() === w.toLowerCase());
        i >= 0 ? list.splice(i, 1) : list.push(w);
        $in.val(list.join(', '));
        mark();
    });
    $root.on('click', '.na_kw_addall', function () {
        const words = $(this).closest('.na_kw_concept').find('.na_pchip[data-w]').map((i, e) => String($(e).data('w'))).get();
        const list = split($in.val());
        for (const w of words) if (!list.some(x => x.toLowerCase() === w.toLowerCase())) list.push(w);
        $in.val(list.join(', '));
        mark();
    });
    const depth = Math.max(1, Number(m.linkDepth) || 4);
    const runTest = () => {
        const text = $root.find('.na_kw_tin').val();
        const withRecent = $root.find('.na_kw_trecent input').prop('checked');
        const $out = $root.find('.na_kw_tout');
        if (!text.trim() && !withRecent) return $out.empty();
        const list = split($in.val());
        if (!list.length) return $out.html('<div class="na_kwt_row na_kwt_wait"><i class="fa-solid fa-circle"></i><div class="na_kwt_main">위에 키워드를 먼저 넣어 주세요.</div></div>');
        const src = `${text}\n${withRecent && depth > 1 ? recentChatText(m, depth - 1) : ''}`;
        const hits = linkHits(list, src.toLowerCase());
        $out.html(`<div class="na_kwt_row ${hits.length ? 'na_kwt_on' : 'na_kwt_wait'}">
            <i class="fa-solid ${hits.length ? 'fa-circle-check' : 'fa-circle'}"></i>
            <div class="na_kwt_main">
              <div><b>${hits.length ? '호출됨' : '호출 안 됨'}</b>${hits.length ? ` · ${hits.map(esc).join(', ')}` : ' · 넣은 키워드가 문장에 없어요'}</div>
              ${hits.length ? `<div class="na_kwt_where">${hits.map(w => `<div>${kwSnippet(src, w)}</div>`).join('')}</div>` : ''}
            </div></div>`);
    };
    let tt;
    $root.find('.na_kw_tin').on('input', () => { clearTimeout(tt); tt = setTimeout(runTest, 150); });
    $root.find('.na_kw_trecent input').on('change', runTest);
    $in.on('input', mark);
    $in.on('input', runTest);
    $root.on('click', '.na_pchip[data-w], .na_kw_addall', () => setTimeout(runTest));
    $root.find('.na_kw_ai').on('click', async function () {
        const others = parseSections(m.text).filter(x => !x.group && x.start !== s.start && x.title !== '(머리말)').map(x => `- ${x.title}`).slice(-80).join('\n');
        const broad = [...new Set([...an.broad.map(r => r.show), ...an.distinct.filter(r => r.chat > 0.15).map(r => r.show)])].join(', ') || '(none)';
        const prompt = `[SECTION TITLE]\n${s.title}\n\n[SECTION]\n${body.trim()}\n\n[BROAD TERMS — appear in most sections or most chat messages; do not use]\n${broad}\n\n[OTHER SECTIONS — for contrast; prefer words that set this one apart]\n${others}`;
        const out = await withSpinner($(this), '고르는 중…', () => askAI(prompt, { system: AI_SYS_KEYWORDS, maxTokens: 2000 }));
        if (out === null) return;
        const concepts = out.split('\n').map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(l => l.includes('|')).map(l => {
            const [en, ko, why] = l.split('|').map(x => x.trim());
            return { words: [...split(en), ...split(ko || '')], why: why || '' };
        }).filter(x => x.words.length);
        // a model that ignored the format: take one comma line
        if (!concepts.length) { const w = split(out.split('\n').filter(l => l.trim()).pop() || out).slice(0, 16); if (w.length) concepts.push({ words: w, why: '' }); }
        $root.find('.na_kw_aiout').html(concepts.length ? concepts.map(x => `
            <div class="na_kw_concept">
              <div class="na_kw_chips">${x.words.map(w => chip(w, keywordWarn(w, stat).length ? 'na_pchip_risk' : '')).join('')}
                <button type="button" class="na_linkbtn na_kw_addall" title="이 줄 모두 넣기"><i class="fa-solid fa-plus"></i> 모두</button></div>
              ${x.why ? `<small class="na_dim">${esc(x.why)}</small>` : ''}
            </div>`).join('') : '<span class="na_dim">제안이 없어요.</span>');
        mark();
    });
    mark();
    const r = await c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', { wide: true, allowVerticalScrolling: true, okButton: '저장', cancelButton: '취소' });
    if (r !== c.POPUP_RESULT.AFFIRMATIVE && r !== true) return null;
    return split($in.val());
}

// ---------------------------------------------------------------- panel

let sectionPanel = null;
let refreshReplace = () => {};
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

            <div class="na_carry na_branch_card" id="na_branch_card" hidden>
              <i class="fa-solid fa-code-branch"></i>
              <div class="na_carry_text"><b>분기 전 내용이 섞였어요</b><span id="na_branch_desc"></span></div>
              <div class="na_carry_btns"><button type="button" class="na_btn na_small na_primary" id="na_branch_fix">정리하기</button></div>
            </div>
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
                <span class="na_spacer"></span>
                <button type="button" class="na_hchip" id="na_health" title="건강 점검"><i class="fa-solid fa-stethoscope"></i> <span>-</span></button>
                <button type="button" class="na_icon" id="na_gear" title="설정"><i class="fa-solid fa-gear"></i></button>
              </div>
              <div class="na_meter_bar"><span class="na_seg_arc"></span><span class="na_seg_raw"></span></div>
              <div class="na_meter_legend" id="na_meter_legend"></div>
            </div>

            <nav class="na_nav" role="tablist">
              <button type="button" class="na_nav_btn active" data-tab="home">홈</button>
              <button type="button" class="na_nav_btn" data-tab="archive">아카이브</button>
              <button type="button" class="na_nav_btn" data-tab="compress">압축</button>
              <button type="button" class="na_nav_btn" data-tab="tools">도구</button>
            </nav>

            <!-- 홈 -->
            <section class="na_tab_pane" data-pane="home">
              <div class="na_next" id="na_next"></div>
              <div class="na_quick">
                <button type="button" class="na_qbtn" id="na_q_read"><i class="fa-solid fa-book-open-reader"></i><span>읽기</span></button>
                <button type="button" class="na_qbtn" id="na_q_ask"><i class="fa-regular fa-comments"></i><span>질문</span></button>
                <button type="button" class="na_qbtn" id="na_q_wizard"><i class="fa-solid fa-wand-magic-sparkles"></i><span>압축</span></button>
                <button type="button" class="na_qbtn" id="na_q_preview"><i class="fa-regular fa-eye"></i><span>미리보기</span></button>
              </div>
              <div class="na_block na_ai_row3">
                <div class="na_kw_label">AI 도구</div>
                <button type="button" class="na_toolrow" id="na_drift"><i class="fa-solid fa-route"></i><span><b>이탈 감지</b><small id="na_drift_sub">최근 대화가 아카이브와 어긋나는지</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_know"><i class="fa-solid fa-user-secret"></i><span><b>누가 아는가</b><small id="na_know_sub">비밀마다 아는 사람·모르는 사람</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_quotes"><i class="fa-solid fa-quote-left"></i><span><b>대사 은행</b><small id="na_quotes_sub">대사를 모아 말투 지문으로</small></span><i class="fa-solid fa-chevron-right"></i></button>
              </div>
            </section>

            <!-- 아카이브 -->
            <section class="na_tab_pane" data-pane="archive" hidden>
              <div class="na_seg">
                <button type="button" class="na_seg_btn active" data-view="cards"><i class="fa-solid fa-layer-group"></i> 섹션 카드</button>
                <button type="button" class="na_seg_btn" data-view="editor"><i class="fa-solid fa-pen-to-square"></i> 원문 편집</button>
              </div>
              <div class="na_block" id="na_view_cards">
                <details class="na_hcheck" id="na_replace">
                  <summary><i class="fa-solid fa-right-left"></i> 찾아 바꾸기 <span class="na_chip" id="na_rp_n"></span></summary>
                  <div class="na_rp_body">
                    <div class="na_rp_grid">
                      <input type="text" class="text_pole" id="na_rp_find" placeholder="찾을 말">
                      <input type="text" class="text_pole" id="na_rp_to" placeholder="바꿀 말 (비우면 지우기)">
                    </div>
                    <div class="na_rp_opts">
                      <label class="checkbox_label"><input type="checkbox" id="na_rp_case"><span>대소문자 구분</span></label>
                      <label class="checkbox_label"><input type="checkbox" id="na_rp_word"><span>낱말 단위</span></label>
                    </div>
                    <div class="na_rp_list" id="na_rp_list"></div>
                    <div class="na_row na_right">
                      <button type="button" class="na_btn na_primary na_small" id="na_rp_go" disabled><i class="fa-solid fa-right-left"></i> 모두 바꾸기</button>
                    </div>
                  </div>
                </details>
                <details class="na_hcheck" id="na_hcheck">
                  <summary><i class="fa-solid fa-spell-check"></i> 제목 검사 <span class="na_chip" id="na_hcheck_n">-</span></summary>
                  <div id="na_hcheck_list"></div>
                </details>
                <div id="na_sec_host"></div>
              </div>
              <div class="na_block" id="na_view_editor" hidden>
                <div class="na_editor_bar">
                  <span class="na_chip" id="na_ed_tok">-</span>
                  <span class="na_dirty" id="na_ed_dirty" hidden>● 저장 안 됨</span>
                  <span class="na_spacer"></span>
                  <button type="button" class="na_icon" id="na_ed_find" title="찾기"><i class="fa-solid fa-magnifying-glass"></i></button>
                  <button type="button" class="na_icon" id="na_ed_toc" title="목차"><i class="fa-solid fa-list-ul"></i></button>
                  <span class="na_more_wrap">
                    <button type="button" class="na_icon" id="na_ed_more" title="더 보기"><i class="fa-solid fa-ellipsis"></i></button>
                    <span class="na_more_menu" id="na_ed_menu" hidden>
                      <button type="button" id="na_ed_preview"><i class="fa-regular fa-eye"></i> 주입 미리보기</button>
                      <button type="button" id="na_ed_copy"><i class="fa-regular fa-copy"></i> 전체 복사</button>
                      <button type="button" id="na_ed_ask"><i class="fa-regular fa-comments"></i> 아카이브에 질문</button>
                      <button type="button" id="na_ed_big"><i class="fa-solid fa-book-open-reader"></i> 읽기 모드</button>
                    </span>
                  </span>
                </div>
                <div class="na_toc" id="na_toc" hidden></div>
                <div class="na_findbar" id="na_findbar" hidden>
                  <div class="na_find_field">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="search" class="text_pole" id="na_find_q" placeholder="본문에서 찾기">
                    <span class="na_find_info" id="na_find_info"></span>
                  </div>
                  <button type="button" class="na_icon" id="na_find_prev" title="이전 (Shift+Enter)"><i class="fa-solid fa-chevron-up"></i></button>
                  <button type="button" class="na_icon" id="na_find_next" title="다음 (Enter)"><i class="fa-solid fa-chevron-down"></i></button>
                  <button type="button" class="na_icon" id="na_find_close" title="닫기"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="na_editor_wrap">
                  <div class="na_editor_marks" aria-hidden="true"></div>
                <textarea id="na_editor" class="text_pole na_editor" spellcheck="false" placeholder="# 제목&#10;&#10;# ── Y1 ──&#10;&#10;## #0–#47 — ..."></textarea>
                </div>
                <div class="na_editor_actions">
                  <button type="button" class="na_btn" id="na_ed_revert"><i class="fa-solid fa-rotate-left"></i> 되돌리기</button>
                  <button type="button" class="na_btn na_primary" id="na_ed_save"><i class="fa-solid fa-floppy-disk"></i> 저장</button>
                </div>
              </div>
            </section>

            <!-- 압축 -->
            <section class="na_tab_pane" data-pane="compress" hidden>
              <div class="na_v2 na_cp">
                <div class="na_v2_card na_cp_hero">
                  <div id="na_since"></div>
                  <button type="button" class="na_cp_wiz" id="na_open_wizard"><i class="fa-solid fa-wand-magic-sparkles"></i><span><b>압축 마법사</b><small>범위 → 복사 → 붙여넣기 → 채점 → 추가</small></span><i class="fa-solid fa-chevron-right"></i></button>
                </div>
                <div class="na_cp_tiles">
                  <button type="button" class="na_cp_tile" id="na_apply_hide"><i class="fa-solid fa-eye-slash"></i><b>숨기기 다시 적용</b><small>경계선 앞만 숨기고 뒤는 보이게</small></button>
                  <button type="button" class="na_cp_tile" id="na_unhide"><i class="fa-solid fa-eye"></i><b>숨김 해제</b><small id="na_hidden_n">숨긴 메시지 다시 보이게</small></button>
                </div>
                <div class="na_v2_label">따로 하기</div>
                <div class="na_v2_card na_v2_list">
                  <button type="button" class="na_cp_row" id="na_open_extract"><span class="na_cp_num">1</span><span class="na_cp_txt"><b>원문 뽑기</b><small>경계선 이후 메시지 · 지시문 붙여 복사</small></span><i class="fa-solid fa-chevron-right"></i></button>
                  <button type="button" class="na_cp_row" id="na_open_append"><span class="na_cp_num">2</span><span class="na_cp_txt"><b>아카이브에 추가</b><small>압축본 붙여넣기 · 번호 검사 · 경계선 자동</small></span><i class="fa-solid fa-chevron-right"></i></button>
                </div>
                <div class="na_v2_label">설정</div>
                <div class="na_v2_card na_v2_list na_cp_set">
                  <label class="na_cp_row"><span class="na_cp_txt"><span>숨긴 메시지 빼고 뽑기</span></span><input type="checkbox" class="na_toggle" id="na_opt_hidden"></label>
                  <div class="na_strip_box">
                    <label class="na_cp_row"><span class="na_cp_txt"><span>태그 지우기</span><small>&lt;think&gt; 블록 통째로 · HTML 태그는 글자만</small></span><input type="checkbox" class="na_toggle" id="na_opt_tags"></label>
                    <div class="na_cp_sub">
                      <textarea class="text_pole na_strip_ta" id="na_strip_custom" rows="2" spellcheck="false" placeholder="통째로 지울 태그나 /정규식/, 한 줄에 하나&#10;scene_plan"></textarea>
                      <small class="na_strip_info" id="na_strip_info"></small>
                    </div>
                  </div>
                  <details class="na_cp_fold" id="na_cmp_settings">
                    <summary class="na_cp_row"><span class="na_cp_txt"><span>압축 지시문</span><small id="na_plib_sum">이 기기의 실리태번 설정에만 저장돼요</small></span><i class="fa-solid fa-chevron-down"></i></summary>
                    <div class="na_cp_sub"><div class="na_plib" id="na_plib"></div></div>
                  </details>
                  <label class="na_cp_row"><span class="na_cp_txt"><span>아카이브 따라가기</span><small id="na_track_info">제목의 마지막 #번호를 경계선으로</small></span><input type="checkbox" id="na_track" class="na_toggle"></label>
                  <label class="na_cp_row" id="na_boundary_row"><span class="na_cp_txt"><span>경계선 번호</span><small>여기까지 아카이브에 담겼어요</small></span><input type="number" id="na_boundary" class="text_pole na_cp_num_in" min="0" placeholder="-"></label>
                  <label class="na_cp_row"><span class="na_cp_txt"><span>숨길 때 남길 메시지</span><small>경계선 바로 앞 몇 개는 보이게</small></span><input type="number" id="na_keep" class="text_pole na_cp_num_in" min="0" max="50"></label>
                </div>
              </div>
            </section>

            <!-- 도구 -->
            <section class="na_tab_pane" data-pane="tools" hidden>
              <div class="na_block">
                <div class="na_kw_label">이야기</div>
                <button type="button" class="na_toolrow" id="na_worlds"><i class="fa-solid fa-earth-asia"></i><span><b>세계관 공유</b><small id="na_worlds_sub">여러 채팅이 같이 쓰는 설정 · 고치면 모든 채팅에 반영</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_people"><i class="fa-solid fa-address-book"></i><span><b>인물 도감 · 관계도</b><small>인물마다 얼굴·상태·관계 · 함께 나온 섹션으로 잇는 관계도</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_story_cal"><i class="fa-solid fa-calendar-days"></i><span><b>이야기 달력</b><small>섹션을 날짜 순서로 · 거꾸로 가는 날짜 찾기</small></span><i class="fa-solid fa-chevron-right"></i></button>
              </div>
              <div class="na_block">
                <div class="na_kw_label">점검</div>
                <button type="button" class="na_toolrow" id="na_tool_health"><i class="fa-solid fa-stethoscope"></i><span><b>건강 점검</b><small id="na_tool_health_sub">번호·숨기기·키워드·백업을 AI 없이 살펴봐요</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_tool_xray"><i class="fa-solid fa-x-ray"></i><span><b>프롬프트 X-ray</b><small id="na_tool_xray_sub">보낸 프롬프트의 구성 · 겹치는 내용 · 키워드가 켜지는 비율</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_branches"><i class="fa-solid fa-code-branch"></i><span><b>분기</b><small id="na_branches_sub">원본·갈라진 채팅과 비교, 분기 정리</small></span><i class="fa-solid fa-chevron-right"></i></button>
              </div>
              <div class="na_block">
                <div class="na_kw_label">백업 · 가져오기 <span class="na_dim" id="na_backup_info"></span></div>
                <div class="na_tiles na_tiles3">
                  <button type="button" class="na_tile" id="na_export_json"><i class="fa-solid fa-box-archive"></i><span>.json 백업</span><small>설정·복구 지점까지</small></button>
                  <button type="button" class="na_tile" id="na_export"><i class="fa-solid fa-file-lines"></i><span>.txt 내보내기</span><small>본문만</small></button>
                  <button type="button" class="na_tile" id="na_import_menu"><i class="fa-solid fa-file-import"></i><span>가져오기</span><small>파일 · 다른 채팅</small></button>
                </div>
                <div class="na_import_opts" id="na_import_opts" hidden>
                  <button type="button" class="na_btn na_small" id="na_import"><i class="fa-solid fa-file-arrow-up"></i> 파일에서 (.txt · .json)</button>
                  <button type="button" class="na_btn na_small" id="na_from_chat"><i class="fa-solid fa-comments"></i> 다른 채팅에서</button>
                </div>
                <div class="na_row na_right"><button type="button" class="na_linkbtn na_danger" id="na_clear"><i class="fa-solid fa-eraser"></i> 아카이브 비우기</button></div>
                <input type="file" id="na_file" accept=".txt,.md,.json,text/plain,application/json" hidden>
              </div>
              <details class="na_block na_details na_fold">
                <summary>복구 지점 · 변경 내역 <span class="na_chip" id="na_snap_n">0</span></summary>
                <div>
                  <p class="na_dim na_fold_desc">바꾸기 직전 상태를 자동으로 남기고(최근 ${SNAPSHOT_MAX}개), 그 뒤 어떤 섹션이 바뀌었는지 같이 보여 줘요.</p>
                  <div class="na_row">
                    <button type="button" class="na_btn na_small" id="na_snap_now"><i class="fa-solid fa-bookmark"></i> 지금 보관</button>
                    <button type="button" class="na_btn na_small" id="na_compare"><i class="fa-solid fa-code-compare"></i> 두 버전 비교</button>
                  </div>
                  <div id="na_snap_list" class="na_snap_list"></div>
                  <details class="na_hist_more" id="na_hist_more" hidden>
                    <summary>더 오래된 변경 <span id="na_hist_n"></span>개 <small class="na_dim">(복구 지점은 지워짐)</small></summary>
                    <div id="na_hist_list" class="na_hist_list"></div>
                  </details>
                </div>
              </details>
            </section>

            <!-- 설정 (⚙) -->
            <section class="na_tab_pane" data-pane="config" hidden>
              <div class="na_cfg_head"><button type="button" class="na_linkbtn" id="na_cfg_back"><i class="fa-solid fa-arrow-left"></i> 돌아가기</button><b>설정</b><button type="button" class="na_btn na_small" id="na_cfg_preview"><i class="fa-regular fa-eye"></i> 주입 미리보기</button></div>
              <details class="na_block na_details na_fold" open>
                <summary><i class="fa-solid fa-syringe"></i> 주입</summary>
                <div>
                <div class="na_set_list">
                  <label class="na_set_row"><span>아카이브 주입</span><input type="checkbox" id="na_enabled" class="na_toggle"></label>
                  <label class="na_set_row"><span>위치</span>
                    <select id="na_position" class="text_pole">${Object.entries(POSITIONS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
                  </label>
                  <label class="na_set_row" id="na_depth_field"><span>깊이</span><input type="number" id="na_depth" class="text_pole" min="0" max="999"></label>
                  <label class="na_set_row"><span>역할</span>
                    <select id="na_role" class="text_pole">${Object.entries(ROLES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
                  </label>
                </div>
                </div>
              </details>
              <details class="na_block na_details na_fold">
                <summary><i class="fa-solid fa-scale-balanced"></i> 분량 · 키워드 · 라우터</summary>
                <div>
                  <p class="na_dim na_fold_desc">섹션 카드의 스위치 · 📌 · 🔑로 섹션마다 정하고, 여기선 한꺼번에 관리해요.</p>
                <div class="na_set_list">
                  <label class="na_set_row"><span><span>토큰 상한</span><small>넘으면 알려 줘요 · 0이면 없음</small></span><input type="number" id="na_cap" class="text_pole" min="0" step="1000"></label>
                  <label class="na_set_row"><span><span>망각 곡선</span><small>오래된 섹션은 짧은 버전·한 줄로 넣어요. 버전이 없으면 원문 그대로 · 📌 고정과 지금 불려 온 섹션은 늘 원문</small></span><input type="checkbox" id="na_fade" class="na_toggle"></label>
                  <div id="na_fade_opts" class="na_v2 na_fd" hidden>
                    <div class="na_fd_save"><span><b id="na_fade_now">-</b><small>토큰</small><s id="na_fade_was"></s></span><span class="na_fd_pct" id="na_fade_pct"></span></div>
                    <div class="na_fd_strip" id="na_fade_strip" aria-hidden="true"></div>
                    <div class="na_fd_ends"><span>오래됨</span><span>최근</span></div>
                    <div class="na_fd_level"><i class="long"></i><span><span>원문 그대로</span><small>최근 섹션</small></span><span class="na_fd_step"><button type="button" class="na_fd_btn" data-f="full" data-d="-1" aria-label="줄이기">−</button><input type="number" id="na_fade_full" class="text_pole" min="0" max="200"><button type="button" class="na_fd_btn" data-f="full" data-d="1" aria-label="늘리기">+</button></span></div>
                    <div class="na_fd_level"><i class="short"></i><span><span>짧은 버전</span><small>그다음 섹션</small></span><span class="na_fd_step"><button type="button" class="na_fd_btn" data-f="short" data-d="-1" aria-label="줄이기">−</button><input type="number" id="na_fade_short" class="text_pole" min="0" max="500"><button type="button" class="na_fd_btn" data-f="short" data-d="1" aria-label="늘리기">+</button></span></div>
                    <div class="na_fd_level"><i class="line"></i><span><span>한 줄</span><small>더 오래된 섹션 전부</small></span><b id="na_fade_lines">-</b></div>
                    <div class="na_fd_fill"><span id="na_fade_info">-</span><button type="button" class="na_v2_btn primary" id="na_fade_fill"><i class="fa-solid fa-feather-pointed"></i> 초안 모델로 채우기</button></div>
                  </div>
                  <label class="na_set_row"><span><span>키워드 연동 범위</span><small>최근 메시지 몇 개에서 찾을지 · 연동 <b id="na_linked_n">0</b>개</small></span><input type="number" id="na_link_depth" class="text_pole" min="1" max="50"></label>
                  <label class="na_set_row"><span><span>AI 라우터</span><small>답하기 직전에 작은 모델이 "지금 대화에 필요한 섹션"을 골라 넣어요 · 따로 연결한 모델이 필요해요</small></span>
                    <select id="na_router_mode" class="text_pole"><option value="off">끄기</option><option value="linked">키워드 섹션에 더해 AI도 고르기</option><option value="old">오래된 섹션 전부 AI가 고르기</option></select></label>
                  <div class="na_router_opts" id="na_router_opts" hidden>
                    <label class="na_set_row"><span><span>한 번에 최대</span><small>AI가 고를 섹션 수</small></span><input type="number" id="na_router_max" class="text_pole" min="1" max="20"></label>
                    <label class="na_set_row"><span><span>가리키는 섹션도 같이</span><small>고른 섹션 본문에 "#217–#236"처럼 적힌 섹션도 같이 넣어요</small></span><input type="checkbox" id="na_router_follow" class="na_toggle"></label>
                    <label class="na_set_row" id="na_router_keep_row"><span><span>최근 섹션은 항상</span><small>마지막 몇 개 섹션은 AI가 안 고르고 늘 넣어요</small></span><input type="number" id="na_router_keep" class="text_pole" min="0" max="20"></label>
                    <div class="na_set_row"><span><span>지금 해 보기</span><small id="na_router_info">최근 대화로 한 번 골라 봐요</small></span><button type="button" class="na_btn na_small" id="na_router_test"><i class="fa-solid fa-compass"></i> 해 보기</button></div>
                  </div>
                  <div class="na_set_row"><span><span>키워드 테스트</span><small>문장을 넣어 보면 어떤 섹션이 불려 오는지 보여 줘요</small></span><button type="button" class="na_btn na_small" id="na_kw_test"><i class="fa-solid fa-vial"></i> 테스트</button></div>
                  <div class="na_set_row"><span><span>고정한 섹션 <b id="na_pinned_n">0</b>개</span></span><button type="button" class="na_btn na_small" id="na_unpin_all">모두 풀기</button></div>
                  <div class="na_set_row"><span><span>꺼 둔 섹션 <b id="na_muted_n">0</b>개</span></span><button type="button" class="na_btn na_small" id="na_unmute_all">모두 켜기</button></div>
                </div>
                </div>
              </details>
              <details class="na_block na_details na_fold">
                <summary><i class="fa-solid fa-robot"></i> AI · 번역</summary>
                <div>
                  <p class="na_dim na_fold_desc">질문 · 키워드 제안 · 점검 · 라우터에 쓰는 모델이에요. AI는 답하고 검사만 하고, 아카이브는 직접 고쳐요.</p>
                <div class="na_set_list">
                  <label class="na_set_row"><span><span>모델</span><small>연결 프로필 · 커스텀 API · Vertex를 고르면 RP 모델과 따로 쓸 수 있어요</small></span><select id="na_ai_profile" class="text_pole"></select></label>
                </div>
                ${connCfgHtml('ai')}
                <div class="na_set_list">
                  <label class="na_set_row"><span><span>답 최대 길이</span><small>토큰 · 답이 잘리면 늘려 주세요</small></span><input type="number" id="na_ai_max" class="text_pole" min="256" step="256"></label>
                  <label class="na_set_row"><span><span>번역 모델</span><small>비교 화면의 "한국어로 보기"에 써요</small></span>
                    <select id="na_tr_mode" class="text_pole">
                      <option value="same">위 모델 그대로</option>
                      <option value="custom">커스텀 API (OpenAI 호환)</option>
                      <option value="vertex">Gemini · Vertex AI</option>
                    </select>
                  </label>
                </div>
                ${connCfgHtml('tr')}
                <div class="na_set_list">
                  <label class="na_set_row"><span><span>초안 모델</span><small>압축 초안처럼 아카이브에 들어갈 글을 써 주는 모델이에요 (예: Opus). 정하지 않으면 초안 버튼이 안 보여요</small></span>
                    <select id="na_dr_mode" class="text_pole">
                      <option value="same">쓰지 않음</option>
                      <option value="custom">커스텀 API (OpenAI 호환)</option>
                      <option value="vertex">Gemini · Vertex AI</option>
                    </select>
                  </label>
                </div>
                ${connCfgHtml('dr')}
                <div class="na_set_list na_dr_max_row" id="na_dr_max_row" hidden>
                  <label class="na_set_row"><span><span>초안 최대 길이</span><small>토큰 · 초안이 끊기면 늘려 주세요</small></span><input type="number" id="na_dr_max" class="text_pole" min="1024" step="1024"></label>
                </div>
                <div class="na_set_list">
                  <label class="na_set_row"><span><span>이탈 자동 감지</span><small>AI 답이 이만큼 쌓일 때마다 조용히 검사하고, 어긋나면 알려 줘요 · 그때마다 토큰이 들어가요</small></span>
                    <select id="na_drift_auto" class="text_pole"><option value="0">끄기</option><option value="5">답 5개마다</option><option value="10">답 10개마다</option><option value="20">답 20개마다</option></select></label>
                  <div class="na_set_row"><span><span>번역 용어집</span><small>이름·장소의 한국어 표기를 정해 두면 번역이 늘 그대로 써요 · 이 채팅 <b id="na_gloss_n">0</b>개</small></span><button type="button" class="na_btn na_small" id="na_gloss_edit"><i class="fa-solid fa-spell-check"></i> 편집</button></div>
                </div>
                <small class="na_dim na_conn_note" id="na_conn_note" hidden>키와 JSON은 이 기기의 실리태번 설정에만 저장돼요. 아카이브 백업에는 안 들어가요.</small>
                </div>
              </details>
              <details class="na_block na_details na_fold">
                <summary><i class="fa-solid fa-bell"></i> 알림</summary>
                <div>
                <div class="na_set_list">
                  <label class="na_set_row"><span><span>백업 알림</span><small>백업 뒤 이만큼 바뀌면 · 0은 끔</small></span><input type="number" id="na_backup_every" class="text_pole" min="0" max="999"></label>
                </div>
              </div>
              </details>
            </section>

            <div class="na_nochat" id="na_nochat" hidden>채팅을 열면 이 채팅의 아카이브가 보여요.</div>
          </div>
        </div>
      </div>
    </div>`;
    $('#extensions_settings2').append(html);
    bindPanel();
    showTab(globalSettings().lastTab || 'home');
}

// custom-API / Vertex fields for one connection ('ai' = the AI 기능 model, 'tr' = the translation model)
function connCfgHtml(p) {
    return `
                <div class="na_tr_cfg" id="na_${p}_custom" hidden>
                  <input type="text" class="text_pole" id="na_${p}_url" placeholder="URL (예: https://api.example.com/v1)" autocomplete="off" spellcheck="false">
                  <input type="password" class="text_pole" id="na_${p}_key" placeholder="API 키" autocomplete="off">
                  <input type="text" class="text_pole" id="na_${p}_model" placeholder="모델 이름 (예: gpt-4o-mini)" autocomplete="off" spellcheck="false">
                </div>
                <div class="na_tr_cfg" id="na_${p}_vertex" hidden>
                  <textarea class="text_pole" id="na_${p}_vxjson" rows="4" placeholder="서비스 계정 JSON (키 파일 내용을 통째로 붙여넣기)" spellcheck="false"></textarea>
                  <div class="na_tr_pair">
                    <input type="text" class="text_pole" id="na_${p}_vxloc" placeholder="리전 (예: global, us-central1)" autocomplete="off" spellcheck="false">
                    <input type="text" class="text_pole" id="na_${p}_vxmodel" placeholder="모델 (예: gemini-2.5-flash)" autocomplete="off" spellcheck="false">
                  </div>
                  <div class="na_tr_vxrow"><small class="na_dim" id="na_${p}_vxinfo"></small><button type="button" class="na_linkbtn na_danger" id="na_${p}_vxclear" hidden><i class="fa-solid fa-eraser"></i> JSON 지우기</button></div>
                </div>
                <div class="na_tr_test_row" id="na_${p}_test_row" hidden>
                  <button type="button" class="na_btn na_small" id="na_${p}_test"><i class="fa-solid fa-plug"></i> 연결 테스트</button>
                </div>`;
}

function renderConn(p) {
    const t = connSettings(p);
    const own = t.mode === 'custom' || t.mode === 'vertex';
    $(`#na_${p}_custom`).prop('hidden', t.mode !== 'custom');
    $(`#na_${p}_vertex`).prop('hidden', t.mode !== 'vertex');
    $(`#na_${p}_test_row`).prop('hidden', !own);
    $(`#na_${p}_url`).val(t.url); $(`#na_${p}_key`).val(t.key); $(`#na_${p}_model`).val(t.model);
    // a saved key is never shown again; the box only takes a replacement
    $(`#na_${p}_vxjson`).val('').attr('placeholder', t.vxJson.trim() ? '저장됨 · 바꾸려면 새 JSON을 붙여넣기' : '서비스 계정 JSON (키 파일 내용을 통째로 붙여넣기)');
    $(`#na_${p}_vxclear`).prop('hidden', !t.vxJson.trim());
    $(`#na_${p}_vxloc`).val(t.vxLocation); $(`#na_${p}_vxmodel`).val(t.vxModel);
    let info = '';
    if (t.vxJson.trim()) { try { const sa = parseServiceAccount(t.vxJson); info = `프로젝트 ${sa.project_id} · ${sa.client_email}`; } catch (e) { info = e.message; } }
    $(`#na_${p}_vxinfo`).text(info);
    return own;
}

function renderAiSettings() {
    const g = globalSettings();
    $('#na_gloss_n').text(hasChat() ? glossaryEntries(getMeta()).length : 0);
    $('#na_drift_auto').val(String(g.driftAuto || 0));
    const a = connSettings('ai');
    const profiles = aiProfiles();
    const opts = [`<option value="">지금 연결된 모델</option>`, ...profiles.map(p => `<option value="${esc(p.id)}">프로필: ${esc(p.name)}</option>`)];
    if (g.aiProfile && !profiles.some(p => p.id === g.aiProfile)) opts.push(`<option value="${esc(g.aiProfile)}">(없어진 프로필)</option>`);
    opts.push('<option value="__custom">커스텀 API (OpenAI 호환)</option>', '<option value="__vertex">Gemini · Vertex AI</option>');
    $('#na_ai_profile').html(opts.join('')).val(a.mode === 'st' ? (g.aiProfile || '') : `__${a.mode}`);
    $('#na_ai_max').val(g.aiMaxTokens || 8192);
    $('#na_tr_mode').val(trSettings().mode);
    $('#na_dr_mode').val(draftSettings().mode);
    $('#na_dr_max_row').prop('hidden', !draftReady());
    $('#na_dr_max').val(draftSettings().max || 16000);
    const own = [renderConn('ai'), renderConn('tr'), renderConn('dr')].some(Boolean);
    $('#na_conn_note').prop('hidden', !own);
}

// Scroll the panel editor so [from, to) is visible and select it (wrapped lines measured with a mirror div).
function revealInEditor(from, to, { keepFocus = false } = {}) {
    const el = document.getElementById('na_editor');
    if (!el) return;
    const cs = getComputedStyle(el);
    const mirror = document.createElement('div');
    for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth', 'boxSizing', 'tabSize']) mirror.style[k] = cs[k];
    Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'break-word', width: `${el.clientWidth}px`, top: '0', left: '-9999px' });
    mirror.textContent = el.value.slice(0, from);
    const mark = document.createElement('span');
    mark.textContent = '​';
    mirror.appendChild(mark);
    document.body.appendChild(mirror);
    const y = mark.offsetTop;
    mirror.remove();
    el.scrollTop = Math.max(0, y - el.clientHeight / 3);
    const active = document.activeElement;
    el.focus({ preventScroll: true });
    el.setSelectionRange(from, to);
    el.scrollTop = Math.max(0, y - el.clientHeight / 3);
    if (keepFocus && active && active !== el) active.focus({ preventScroll: true });
}

async function markBackup(how) {
    const m = getMeta();
    m.backup = { at: Date.now(), how };
    m.sinceBackup = 0;
    await saveMeta();
    syncPanel();
}

const needChat = fn => (...a) => hasChat() ? fn(...a) : toastr.info('채팅을 먼저 여세요.');

// tabs: home / archive / compress / tools, and the ⚙ settings page
function showTab(tab) {
    const $p = $('#na_settings');
    const g = globalSettings();
    if (!$p.find(`[data-pane="${tab}"]`).length) tab = 'home';
    $p.find('.na_nav_btn').each(function () { $(this).toggleClass('active', $(this).data('tab') === tab); });
    $p.find('.na_tab_pane').each(function () { $(this).prop('hidden', $(this).data('pane') !== tab); });
    $('#na_gear').toggleClass('active', tab === 'config');
    if (tab !== 'config' && g.lastTab !== tab) { g.lastTab = tab; saveGlobal(); }
    if (tab === 'config') renderAiSettings();
    if (tab === 'archive') showArchiveView(g.archView || 'cards');
}

function showArchiveView(view) {
    const g = globalSettings();
    if (g.archView !== view) { g.archView = view; saveGlobal(); }
    $('#na_settings .na_seg_btn').each(function () { $(this).toggleClass('active', $(this).data('view') === view); });
    $('#na_view_cards').prop('hidden', view !== 'cards');
    $('#na_view_editor').prop('hidden', view !== 'editor');
    if (view === 'cards' && hasChat()) {
        if (!sectionPanel) sectionPanel = mountSectionBrowser($('#na_sec_host'));
        else sectionPanel.render();
    }
}

// the one thing worth doing next, on the home tab
function renderNext(m, { afterTok, health }) {
    let html;
    const card = (icon, title, desc, btns, tone = '') => `<div class="na_next_card ${tone}"><i class="fa-solid ${icon}"></i><div class="na_next_main"><b>${title}</b>${desc ? `<span>${desc}</span>` : ''}</div><div class="na_next_btns">${btns}</div></div>`;
    const btn = (act, label, primary = true) => `<button type="button" class="na_btn na_small ${primary ? 'na_primary' : ''}" data-act="${act}">${label}</button>`;
    const issues = health ? health.items.filter(x => x.level === 'bad' || x.level === 'warn') : [];
    if (!m.text.trim()) html = card('fa-seedling', '아카이브가 비어 있어요', '압축 마법사로 첫 섹션을 만들거나, 다른 채팅·파일에서 가져와요.', btn('wizard', '압축 마법사') + btn('import', '가져오기', false));
    else if (!m.enabled) html = card('fa-power-off', '주입이 꺼져 있어요', '아카이브가 RP 모델에 안 들어가고 있어요.', btn('enable', '켜기'), 'warn');
    else if (issues.length) html = card('fa-stethoscope', `확인할 것 ${issues.length}개`, esc(issues[0].title), btn('health', '건강 점검'), issues.some(x => x.level === 'bad') ? 'bad' : 'warn');
    else html = card('fa-circle-check', '할 일 없어요', m.boundary >= 0 ? `경계선 #${m.boundary} 뒤 원문 ${fmt(afterTok)} 토큰` : '', '', 'ok');
    $('#na_next').html(html);
}

function nextAction(act) {
    if (!hasChat()) return;
    if (act === 'wizard') openWizard();
    else if (act === 'health') openHealth();
    else if (act === 'import') { showTab('tools'); $('#na_import_opts').prop('hidden', false); }
    else if (act === 'enable') $('#na_enabled').prop('checked', true).trigger('change');
}

function bindPanel() {
    const $p = $('#na_settings');

    $p.find('.na_nav_btn').on('click', function () { showTab($(this).data('tab')); });
    bindPromptSettings();
    $('#na_gear').on('click', () => showTab($('[data-pane="config"]').prop('hidden') ? 'config' : (globalSettings().lastTab || 'home')));
    $('#na_cfg_back').on('click', () => showTab(globalSettings().lastTab || 'home'));
    $p.find('.na_seg_btn').on('click', function () { showArchiveView($(this).data('view')); });
    // home quick actions
    $('#na_q_read').on('click', needChat(openReader));
    $('#na_q_ask').on('click', needChat(openAsk));
    $('#na_q_wizard').on('click', needChat(openWizard));
    $('#na_q_preview').on('click', needChat(openPreview));
    $('#na_next').on('click', '[data-act]', function () { nextAction(this.dataset.act); });
    // small menus
    $('#na_ed_more').on('click', e => { e.stopPropagation(); $('#na_ed_menu').prop('hidden', !$('#na_ed_menu').prop('hidden')); });
    $('#na_ed_menu').on('click', 'button', () => $('#na_ed_menu').prop('hidden', true));
    $(document).on('click', e => { if (!$(e.target).closest('.na_more_wrap').length) $('#na_ed_menu').prop('hidden', true); });
    $('#na_import_menu').on('click', () => $('#na_import_opts').prop('hidden', !$('#na_import_opts').prop('hidden')));
    $('#na_tool_health').on('click', needChat(openHealth));
    $('#na_tool_xray').on('click', needChat(openXray));
    $('#na_story_cal').on('click', needChat(openCalendar));
    $('#na_people').on('click', needChat(openPeople));
    $('#na_worlds').on('click', needChat(openWorlds));

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
    $('#na_ed_big').on('click', needChat(openReader));
    $('#na_ed_ask').on('click', needChat(openAsk));
    $('#na_ai_profile').on('change', function () {
        const a = connSettings('ai');
        if (this.value === '__custom' || this.value === '__vertex') a.mode = this.value.slice(2);
        else { a.mode = 'st'; globalSettings().aiProfile = this.value; }
        saveGlobal(); renderAiSettings();
    });
    $('#na_ai_max').on('change', function () {
        const v = Math.max(256, parseInt(this.value, 10) || 4096);
        globalSettings().aiMaxTokens = v; globalSettings().aiMaxSet = true; this.value = v; saveGlobal();
    });
    $('#na_drift_auto').on('change', function () { globalSettings().driftAuto = Number(this.value) || 0; saveGlobal(); });
    $('#na_gloss_edit').on('click', needChat(async () => { await openGlossary(); renderAiSettings(); }));
    $('#na_tr_mode').on('change', function () { trSettings().mode = this.value; saveGlobal(); renderAiSettings(); });
    $('#na_dr_mode').on('change', function () { draftSettings().mode = this.value; saveGlobal(); renderAiSettings(); });
    $('#na_dr_max').on('change', function () { const v = Math.max(1024, parseInt(this.value, 10) || 16000); draftSettings().max = v; this.value = v; saveGlobal(); });
    for (const p of ['ai', 'tr', 'dr']) {
        const field = (sel, key) => $(`#na_${p}_${sel}`).on('change', function () { connSettings(p)[key] = this.value.trim(); saveGlobal(); renderAiSettings(); });
        field('url', 'url'); field('key', 'key'); field('model', 'model'); field('vxloc', 'vxLocation'); field('vxmodel', 'vxModel');
        $(`#na_${p}_vxjson`).on('change', function () {
            if (!this.value.trim()) return;
            try { parseServiceAccount(this.value); } catch (e) { toastr.warning(e.message); return; }
            connSettings(p).vxJson = this.value.trim(); vxTokens.clear(); saveGlobal(); renderAiSettings();
        });
        $(`#na_${p}_vxclear`).on('click', () => { connSettings(p).vxJson = ''; vxTokens.clear(); saveGlobal(); renderAiSettings(); });
    }
    $('#na_ai_test').on('click', async function () {
        const out = await withSpinner($(this), '확인하는 중…', () => askAI('Reply with one short sentence: which model are you?', { maxTokens: 300 }));
        if (out) toastr.success(out.slice(0, 160), `${aiLabel()} 연결됨`);
    });
    $('#na_dr_test').on('click', async function () {
        const out = await withSpinner($(this), '확인하는 중…', () => askDraft('Reply with one short sentence: which model are you?', { maxTokens: 300 }));
        if (out) toastr.success(out.slice(0, 160), `${drLabel()} 연결됨`);
    });
    $('#na_tr_test').on('click', async function () {
        const out = await withSpinner($(this), '확인하는 중…', () => askTranslator('1: The three of them fell asleep together.', { system: AI_SYS_TRANSLATE, maxTokens: 200 }));
        if (out) toastr.success(out.replace(/^\s*1\s*[:.)]\s*/, '').slice(0, 120), `${trLabel()} 연결됨`);
    });
    renderAiSettings();
    $('#na_ed_preview').on('click', needChat(openPreview));
    $('#na_cfg_preview').on('click', needChat(openPreview));

    // --- editor tools: table of contents, find & replace
    const togglePanel = (id, focus) => {
        const $el = $(id);
        const show = $el.prop('hidden');
        $('#na_findbar, #na_toc').prop('hidden', true);
        $('#na_ed_find, #na_ed_toc').removeClass('active');
        $el.prop('hidden', !show);
        if (show) {
            $(id === '#na_toc' ? '#na_ed_toc' : '#na_ed_find').addClass('active');
            focus?.();
        }
    };
    $('#na_ed_find').on('click', () => { togglePanel('#na_findbar', () => $('#na_find_q').trigger('focus').trigger('input')); paintMarks(); });
    $('#na_ed_toc').on('click', () => { togglePanel('#na_toc', renderToc); paintMarks(); });

    function renderToc() {
        const text = $ed.val();
        const $toc = $('#na_toc').empty();
        const secs = parseSections(text).filter(s => s.title !== '(머리말)' && s.title !== '(제목 없음)');
        if (!secs.length) { $toc.html('<div class="na_empty">제목(#, ##)이 없어요.</div>'); return; }
        secs.forEach(s => {
            const $it = $(`<button type="button" class="na_toc_item na_toc_lv${s.level} ${s.group ? 'na_toc_group' : ''}">${esc(s.group ? groupLabel(s.title) : s.title)}</button>`);
            $it.on('click', () => {
                revealInEditor(s.start, s.start + (text.slice(s.start).indexOf('\n') + 1 || text.length - s.start) - 1);
            });
            $toc.append($it);
        });
    }

    // find only: highlight every match in a layer behind the (transparent) textarea
    const $marks = $('.na_editor_marks');
    let hits = [], cur = -1;
    const syncMarkBox = () => {
        const el = $ed[0], cs = getComputedStyle(el), mk = $marks[0];
        for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'fontVariant', 'fontKerning', 'fontFeatureSettings', 'fontVariationSettings',
            'lineHeight', 'letterSpacing', 'wordSpacing', 'textIndent', 'textTransform', 'textRendering', 'wordBreak', 'overflowWrap', 'lineBreak', 'hyphens',
            'paddingTop', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'tabSize']) mk.style[k] = cs[k];
        // the textarea's scrollbar takes width from the text; give the layer the same room so lines wrap at the same place
        const bar = el.offsetWidth - el.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
        mk.style.paddingRight = `${parseFloat(cs.paddingRight) + Math.max(0, bar)}px`;
        mk.style.boxSizing = 'border-box';
        // sit exactly on the textarea (it can have margins)
        mk.style.top = `${el.offsetTop}px`;
        mk.style.left = `${el.offsetLeft}px`;
        mk.style.width = `${el.offsetWidth}px`;
        mk.style.height = `${el.offsetHeight}px`;
        mk.scrollTop = el.scrollTop;
    };
    const paintMarks = () => {
        const q = $('#na_find_q').val();
        const on = !$('#na_findbar').prop('hidden') && !!q && hits.length;
        $('.na_editor_wrap').toggleClass('na_marking', !!on);
        if (!on) { $marks.empty(); return; }
        const text = $ed.val();
        let html = '', last = 0;
        hits.forEach((at, i) => {
            html += esc(text.slice(last, at)) + `<mark class="${i === cur ? 'na_cur' : ''}">${esc(text.slice(at, at + q.length))}</mark>`;
            last = at + q.length;
        });
        html += esc(text.slice(last)) + '\n';
        $marks.html(html);
        syncMarkBox();
    };
    const findAll = () => {
        const q = $('#na_find_q').val();
        hits = [];
        if (q) {
            const hay = $ed.val().toLowerCase(), needle = q.toLowerCase();
            for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + needle.length)) hits.push(at);
        }
        if (cur >= hits.length) cur = hits.length - 1;
    };
    const showInfo = () => {
        const q = $('#na_find_q').val();
        $('#na_find_info').text(!q ? '' : hits.length ? `${cur + 1}/${hits.length}` : '0/0').toggleClass('na_find_none', !!q && !hits.length);
        $('#na_find_prev, #na_find_next').prop('disabled', hits.length < 2 && !(hits.length === 1 && cur < 0));
    };
    const go = step => {
        if (!hits.length) { showInfo(); paintMarks(); return; }
        cur = cur < 0 ? (step < 0 ? hits.length - 1 : 0) : (cur + step + hits.length) % hits.length;
        const q = $('#na_find_q').val();
        revealInEditor(hits[cur], hits[cur] + q.length, { keepFocus: true });
        showInfo(); paintMarks();
    };
    $('#na_find_q').on('input', () => { cur = -1; findAll(); go(1); });
    $('#na_find_q').on('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); go(e.shiftKey ? -1 : 1); }
        if (e.key === 'Escape') { e.preventDefault(); $('#na_find_close').trigger('click'); }
    });
    $('#na_find_next').on('click', () => go(1));
    $('#na_find_prev').on('click', () => go(-1));
    $('#na_find_close').on('click', () => { $('#na_findbar').prop('hidden', true); $('#na_ed_find').removeClass('active'); paintMarks(); });
    $ed.on('scroll', () => { $marks[0].scrollTop = $ed[0].scrollTop; });
    $ed.on('input', () => { if (!$('#na_findbar').prop('hidden') && $('#na_find_q').val()) { findAll(); showInfo(); paintMarks(); } });
    if (window.ResizeObserver) new ResizeObserver(() => { if ($('.na_editor_wrap').hasClass('na_marking')) syncMarkBox(); }).observe($ed[0]);

    // --- sections

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
    $('#na_open_wizard').on('click', needChat(openWizard));
    $('#na_health').on('click', needChat(openHealth));
    $('#na_drift').on('click', needChat(openDrift));
    $('#na_know').on('click', needChat(openKnowledge));
    $('#na_quotes').on('click', needChat(openQuotes));
    $('#na_branches, #na_branch_fix').on('click', needChat(openBranches));
    $('#na_open_append').on('click', needChat(openAppend));
    $('#na_apply_hide').on('click', needChat(() => applyHide()));
    $('#na_unhide').on('click', needChat(openUnhide));

    // --- find & replace on the saved archive (sections tab)
    const rpRegex = () => {
        const q = $('#na_rp_find').val();
        if (!q) return null;
        const body = escRe(q);
        return new RegExp($('#na_rp_word').prop('checked') ? `(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])` : body, `g${$('#na_rp_case').prop('checked') ? '' : 'i'}u`);
    };
    const renderReplace = () => {
        const $l = $('#na_rp_list').empty();
        if (!hasChat()) return;
        const re = rpRegex();
        const text = getMeta().text;
        const to = $('#na_rp_to').val();
        if (!re) { $('#na_rp_n').text(''); $('#na_rp_go').prop('disabled', true); return; }
        const found = [...text.matchAll(re)];
        $('#na_rp_n').text(`${found.length}군데`).toggleClass('na_chip_warn', !!found.length);
        $('#na_rp_go').prop('disabled', !found.length);
        if (!found.length) { $l.html('<div class="na_empty">찾는 말이 없어요.</div>'); return; }
        const secs = parseSections(text);
        found.slice(0, 40).forEach(mt => {
            const at = mt.index, len = mt[0].length;
            const sec = [...secs].reverse().find(x => x.start <= at);
            const a = Math.max(0, at - 30), b = Math.min(text.length, at + len + 30);
            const before = text.slice(a, at).replace(/\n/g, ' '), after = text.slice(at + len, b).replace(/\n/g, ' ');
            $l.append(`<div class="na_rp_hit"><span class="na_rp_sec">${esc(sec ? (sec.group ? groupLabel(sec.title) : sec.title) : '')}</span>
                <span class="na_rp_ctx">${a > 0 ? '…' : ''}${esc(before)}<del>${esc(mt[0])}</del><ins>${esc(to)}</ins>${esc(after)}${b < text.length ? '…' : ''}</span></div>`);
        });
        if (found.length > 40) $l.append(`<div class="na_dim na_rp_more">그 밖에 ${found.length - 40}군데 더</div>`);
    };
    refreshReplace = renderReplace;
    let rpTimer;
    $('#na_rp_find, #na_rp_to').on('input', () => { clearTimeout(rpTimer); rpTimer = setTimeout(renderReplace, 250); });
    $('#na_rp_case, #na_rp_word').on('change', renderReplace);
    $('#na_rp_go').on('click', needChat(async () => {
        const re = rpRegex();
        if (!re) return;
        if (editorDirty) return toastr.warning('원문 편집칸에 저장 안 한 내용이 있어요. 먼저 저장하거나 되돌려 주세요.');
        const m = getMeta();
        const n = [...m.text.matchAll(re)].length;
        if (!n) return;
        const to = $('#na_rp_to').val();
        if (!await confirm('모두 바꾸기', `"${$('#na_rp_find').val()}" ${n}군데를 ${to ? `"${to}"(으)로 바꿀까요` : '지울까요'}? 지금 상태는 복구 지점에 남아요.`)) return;
        await commitText(m.text.replace(re, () => to), `찾아 바꾸기 전: ${$('#na_rp_find').val().slice(0, 30)}`);
        renderReplace();
        toastr.success(`${n}군데 바꿨어요`);
    }));
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
        markBackup('txt');
    }));
    $('#na_export_json').on('click', needChat(() => {
        const { lastInject, ...rest } = getMeta();
        download(`아카이브_${chatLabel()}_${nowStamp()}.json`, JSON.stringify({ format: 'narrative-archive', version: VERSION, data: rest }, null, 2), 'application/json');
        markBackup('json');
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
    $('#na_compare').on('click', needChat(openCompare));
    $('#na_carry_go').on('click', needChat(async () => { if (carryOffer) await importArchive(carryOffer, '방금 있던 채팅', carryOffer.chatId); }));
    $('#na_carry_x').on('click', () => { carryOffer = null; $('#na_carry').prop('hidden', true); });
    $('#na_cap').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.tokenCap = Math.max(0, parseInt(this.value, 10) || 0); this.value = m.tokenCap;
        await saveMeta(); applyInjection(); syncPanel();
    });
    $('#na_unpin_all').on('click', needChat(async () => {
        const m = getMeta(); m.pinned = []; await saveMeta(); applyInjection(); syncPanel();
    }));
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
            if (json?.format === 'narrative-archive-bundle') {
                const it = await pickFromBundle(json);
                if (!it) return;
                json = { format: 'narrative-archive', data: it.data };
            }
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
    $('#na_kw_test').on('click', needChat(openKeywordTest));
    const setRouter = async patch => { const m = getMeta(); m.router = { ...routerCfg(m), ...patch }; routerState.delete(currentChatId()); await saveMeta(); applyInjection(); syncPanel(); };
    $('#na_router_mode').on('change', needChat(e => setRouter({ mode: e.target.value })));
    $('#na_router_max').on('change', needChat(e => setRouter({ max: Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 4)) })));
    $('#na_router_keep').on('change', needChat(e => setRouter({ keep: Math.min(20, Math.max(0, parseInt(e.target.value, 10) || 0)) })));
    $('#na_router_follow').on('change', needChat(e => setRouter({ follow: e.target.checked })));
    const setFade = async patch => { const m = getMeta(); m.fade = { ...fadeCfg(m), ...patch }; await saveMeta(); applyInjection().then(() => { sectionPanel?.render(); syncPanel(); }); syncPanel(); };
    $('#na_fade').on('change', needChat(e => setFade({ on: e.target.checked })));
    $('#na_fade_full').on('change', needChat(e => setFade({ full: Math.max(0, parseInt(e.target.value, 10) || 0) })));
    $('#na_fade_short').on('change', needChat(e => setFade({ short: Math.max(0, parseInt(e.target.value, 10) || 0) })));
    $('#na_fade_opts').on('click', '.na_fd_btn', needChat(e => { const f = e.currentTarget.dataset.f; const cur = fadeCfg(getMeta())[f]; setFade({ [f]: Math.max(0, cur + Number(e.currentTarget.dataset.d)) }); }));
    $('#na_fade_fill').on('click', needChat(e => { if (!draftReady() && !fadeFilling) return toastr.info('⚙ 설정 → AI · 번역 → 초안 모델을 먼저 정해 주세요. 섹션 카드의 버전 버튼에서 직접 붙여넣을 수도 있어요.'); fillFade($(e.currentTarget)); }));
    $('#na_router_test').on('click', needChat(async e => {
        const m = getMeta();
        const st = await withSpinner($(e.currentTarget), '고르는 중…', () => runRouter(m, { force: true }));
        if (!st) return;
        await applyInjection(); syncPanel();
        toastr.info(st.titles.length ? st.titles.map(t => `• ${t.slice(0, 60)}`).join('<br>') : '고른 섹션이 없어요', `라우터 · ${st.titles.length}개 · ${(st.ms / 1000).toFixed(1)}초`, { escapeHtml: false, timeOut: 10000 });
    }));
    $('#na_link_depth').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.linkDepth = Math.min(50, Math.max(1, parseInt(this.value, 10) || 4)); this.value = m.linkDepth;
        await saveMeta(); applyInjection(); syncPanel();
    });
    $('#na_backup_every').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.backupEvery = Math.max(0, parseInt(this.value, 10) || 0); this.value = m.backupEvery;
        await saveMeta(); syncPanel();
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
    $('#na_muted_n').text(mutedCount(m));
    $('#na_link_depth').val(m.linkDepth || 4);
    const rc = routerCfg(m);
    $('#na_router_mode').val(rc.mode);
    $('#na_router_opts').prop('hidden', rc.mode === 'off');
    $('#na_router_keep_row').toggle(rc.mode === 'old');
    $('#na_router_max').val(rc.max); $('#na_router_keep').val(rc.keep); $('#na_router_follow').prop('checked', rc.follow);
    {
        const fc = fadeCfg(m);
        $('#na_fade').prop('checked', fc.on); $('#na_fade_opts').prop('hidden', !fc.on);
        $('#na_fade_full').val(fc.full); $('#na_fade_short').val(fc.short);
        if (fc.on) {
            const plan = [...fadeWants(m).values()];
            const miss = fadeMissing(m).length;
            if (!fadeFilling) $('#na_fade_info').html(miss ? `버전 없는 섹션 <b>${miss}</b>개 · 지금은 원문으로 들어가요` : '필요한 버전이 다 있어요');
            $('#na_fade_lines').text(`${plan.filter(p => p.want === 'line').length}개`);
            // one bar per numbered section, oldest first: tall = whole, mid = short, low = one line
            $('#na_fade_strip').html(plan.map(p => { const use = fadeUse(m, m.text, p.s, p.want); const k = p.why === 'pin' ? 'pin' : use !== p.want && p.want !== 'long' ? 'miss' : use; return `<span class="${k}" title="${esc(p.s.title)}"></span>`; }).join(''));
            const was = filterMuted(m, m.text);
            cachedTokens(was).then(t => {
                const now = lastBuild.tokens || 0;
                $('#na_fade_now').text(fmt(now));
                $('#na_fade_was').text(t > now ? fmt(t) : '');
                $('#na_fade_pct').text(t > now ? `−${Math.round((1 - now / t) * 100)}%` : '').prop('hidden', !(t > now));
            });
        }
    }
    const rs = routerState.get(currentChatId());
    $('#na_router_info').text(rs ? `마지막: ${rs.titles.length}개 · ${(rs.ms / 1000).toFixed(1)}초 · 후보 ${rs.cands}개` : `후보 ${routerCandidates(m).length}개 · 최근 대화로 한 번 골라 봐요`);
    {
        const keys = new Set(parseSections(m.text).map(sectionKey));
        $('#na_linked_n').text(Object.keys(linkedMap(m)).filter(t => keys.has(t)).length);
    }
    $('#na_backup_every').val(m.backupEvery ?? 10);
    {
        const due = m.backupEvery > 0 && m.sinceBackup >= m.backupEvery;
        $('#na_backup_info').html(m.backup
            ? `마지막 백업 ${esc(timeLabel(m.backup.at))} (${m.backup.how === 'json' ? '.json' : '.txt'}) · 그 뒤 <b class="${due ? 'na_warn_txt' : ''}">${m.sinceBackup || 0}번</b> 바뀜`
            : `아직 백업한 적 없어요${m.sinceBackup ? ` · <b class="${due ? 'na_warn_txt' : ''}">${m.sinceBackup}번</b> 바뀜` : ''}`);
    }
    renderHistory();
    $('#na_snap_n').text(m.snapshots.length);
    $('#na_cap').val(m.tokenCap || 0);
    {
        const titles = new Set(parseSections(m.text).map(sectionKey));
        const n = [...pinnedSet(m)].filter(t => titles.has(t)).length;
        $('#na_pinned_n').text(n);
        $('#na_unpin_all').prop('disabled', !n);
    }
    $('#na_unmute_all').prop('disabled', !mutedCount(m));
    $('#na_carry').prop('hidden', !carryOffer);
    if (hasChat()) {
        const mm = getMeta();
        const kn = knowledgeRows(mm).length;
        $('#na_know_sub').text(kn ? `${kn}개${mm.knowInject ? ' · 주입 중' : ''}` : '비밀마다 아는 사람·모르는 사람');
        const vn = Object.keys(mm.voice || {}).length;
        { const wb = worldBooks(), on = wb.filter(w => worldIsOn(mm, w)); $('#na_worlds_sub').text(wb.length ? `${wb.length}개 · 이 채팅에 ${on.length ? on.map(w => w.name).join(', ') : '없음'}` : '여러 채팅이 같이 쓰는 설정 · 고치면 모든 채팅에 반영'); }
        $('#na_quotes_sub').text((mm.quotes || []).length ? `대사 ${(mm.quotes || []).length}개${vn ? ` · 지문 ${vn}${mm.voiceInject ? ' 주입 중' : ''}` : ''}` : '대사를 모아 말투 지문으로');
        $('#na_drift_sub').text(mm.driftLast ? `${timeLabel(mm.driftLast.at)} · ${mm.driftLast.none ? '어긋남 없음' : `${mm.driftLast.n}개 찾음`}` : '최근 대화가 아카이브와 어긋나는지');
    }
    const br = hasChat() ? branchState(getMeta()) : null;
    $('#na_branch_card').prop('hidden', !br?.ahead.length);
    if (br?.ahead.length) $('#na_branch_desc').text(`이 채팅은 #${br.last}까지인데 아카이브에 그 뒤(#${br.ahead[0].from}~) 섹션 ${br.ahead.length}개가 있어요. 분기하기 전 원본의 내용이에요.`);
    $('#na_branches_sub').text(br?.parent ? `이 채팅은 분기예요 · 원본: ${br.parent}` : '원본·갈라진 채팅과 비교, 분기 정리');
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
    renderHeadingCheck();
    if ($('#na_replace').prop('open')) refreshReplace();
    renderSnapshots();
    refreshStatus();
}

function renderHeadingCheck() {
    const $l = $('#na_hcheck_list');
    if (!$l.length || !hasChat()) return;
    const { issues, ranged } = checkHeadings(getMeta().text);
    $('#na_hcheck_n').text(issues.length ? `${issues.length}곳` : (ranged ? '문제 없음' : '번호 제목 없음'))
        .toggleClass('na_chip_warn', !!issues.length).toggleClass('na_chip_on', !issues.length && !!ranged);
    $l.empty();
    if (!issues.length) {
        $l.html(`<div class="na_empty">${ranged ? `번호 제목 ${ranged}개 모두 형식·순서가 맞아요.` : '"## #시작–#끝 — 제목" 형식의 제목이 없어요.'}</div>`);
        return;
    }
    issues.forEach(it => {
        const $row = $(`<button type="button" class="na_hc_row"><span class="na_hc_title">${esc(it.title)}</span><span class="na_hc_msg">${esc(it.msg)}</span></button>`);
        $row.on('click', () => sectionPanel?.focus(it.start));
        $l.append($row);
    });
}

// "추가 · 수정 · 제목 · 삭제" lines for one history entry
function histParts(h) {
    const names = arr => arr.map(t => `<span class="na_hist_sec">${esc(t)}</span>`).join('');
    const parts = [];
    if (h.added.length) parts.push(`<div><span class="na_hist_k na_hist_add">추가</span>${names(h.added)}</div>`);
    if (h.changed.length) parts.push(`<div><span class="na_hist_k">수정</span>${names(h.changed)}</div>`);
    if (h.renamed?.length) parts.push(`<div><span class="na_hist_k">제목</span>${names(h.renamed)}</div>`);
    if (h.removed.length) parts.push(`<div><span class="na_hist_k na_hist_del">삭제</span>${names(h.removed)}</div>`);
    if (!parts.length) parts.push('<div class="na_dim">섹션 밖 글자만 바뀜</div>');
    return parts.join('');
}

// changes whose restore point is gone; the rest show under their restore point
function renderHistory() {
    const $l = $('#na_hist_list');
    if (!$l.length || !hasChat()) return;
    const m = getMeta();
    $l.empty();
    const snapAts = new Set(m.snapshots.map(x => x.at));
    const old = m.history.filter(h => !h.snapAt || !snapAts.has(h.snapAt));
    $('#na_hist_more').prop('hidden', !old.length);
    $('#na_hist_n').text(old.length);
    old.forEach(h => {
        $l.append(`
          <div class="na_hist">
            <div class="na_hist_top">
              <span class="na_snap_time">${esc(timeLabel(h.at))}</span>
              <span class="na_snap_reason">${esc(h.reason)}</span>
              <span class="na_hist_delta ${h.delta >= 0 ? 'na_hist_add' : 'na_hist_del'}">${h.delta >= 0 ? '+' : '−'}${fmt(Math.abs(h.delta))}자</span>
            </div>
            <div class="na_hist_body">${histParts(h)}</div>
          </div>`);
    });
}


function renderSnapshots() {
    const $l = $('#na_snap_list');
    if (!$l.length || !hasChat()) return;
    renderHistory();
    const m = getMeta();
    $l.empty();
    if (!m.snapshots.length) {
        $l.html('<div class="na_empty">아직 복구 지점이 없어요.</div>');
        return;
    }
    m.snapshots.forEach((s, i) => {
        const diff = s.text.length - m.text.length;
        // the change made right after this point, and the state right after it (the next point, or now)
        const hi = m.history.findIndex(x => x.snapAt === s.at), h = m.history[hi];
        const after = h ? (hi === 0 ? { text: m.text, label: '바뀐 뒤 (지금)' } : (() => { const n = m.snapshots.find(x => x.at === m.history[hi - 1].snapAt); return n ? { text: n.text, label: '바뀐 뒤' } : null; })()) : null;
        const $row = $(`
          <div class="na_snap">
            <div class="na_snap_main">
              <span class="na_snap_time">${esc(timeLabel(s.at))}</span>
              <span class="na_snap_reason">${esc(s.reason)}</span>
              <span class="na_snap_meta">${fmt(s.text.length)}자 · 지금보다 ${diff === 0 ? '같음' : `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}자`}${s.boundary >= 0 ? ` · #${s.boundary}까지` : ''}</span>
              ${h ? `<div class="na_hist_body na_snap_hist"><small class="na_dim">그 뒤 바뀐 것</small>${histParts(h)}</div>` : ''}
            </div>
            <div class="na_snap_btns">
              ${after && hi > 0 ? '<button type="button" class="na_icon na_snap_then" title="그때 바뀐 내용"><i class="fa-solid fa-code-commit"></i></button>' : ''}
              <button type="button" class="na_icon na_snap_diff" title="지금과 비교"><i class="fa-solid fa-code-compare"></i></button>
              <button type="button" class="na_icon na_snap_view" title="내용 보기"><i class="fa-regular fa-eye"></i></button>
              <button type="button" class="na_icon na_snap_restore" title="이 지점으로 복원"><i class="fa-solid fa-clock-rotate-left"></i></button>
              <button type="button" class="na_icon na_snap_del" title="삭제"><i class="fa-regular fa-trash-can"></i></button>
            </div>
          </div>`);
        $row.find('.na_snap_diff').on('click', () => openDiff(s));
        $row.find('.na_snap_then').on('click', () => openDiff(s, after));
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

async function importArchive(src, label, fromChat = null) {
    const m = getMeta();
    if (m.text.trim() && !await confirm('아카이브 가져오기', `이 채팅의 아카이브를 "${label}"의 것으로 바꿀까요? 지금 내용은 복구 지점에 남아요.`)) return false;
    for (const k of SETTING_KEYS) if (src.settings && Object.hasOwn(src.settings, k)) m[k] = structuredClone(src.settings[k]);
    // the numbers that chat's archive ended on live in that chat: "원문" on those sections opens it
    if (fromChat) {
        const r = headingRanges(src.text);
        if (r.length) m.logLinks = { ...(m.logLinks || {}), [r[r.length - 1].prefix]: fromChat };
    }
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

// the whole file of another chat of this character / group: { meta, messages }
const otherChatCache = new Map();
async function fetchOtherChat(id) {
    if (otherChatCache.has(id)) return otherChatCache.get(id);
    const c = ctx();
    let arr;
    if (c.groupId) arr = await fetchJson('/api/chats/group/get', { id });
    else {
        const ch = c.characters?.[c.characterId];
        if (!ch) throw new Error('캐릭터를 못 찾았어요');
        arr = await fetchJson('/api/chats/get', { ch_name: ch.name, file_name: id, avatar_url: ch.avatar });
    }
    arr = Array.isArray(arr) ? arr : [];
    const hasHeader = arr[0] && !('mes' in arr[0]);
    const out = { meta: hasHeader ? (arr[0].chat_metadata || {}) : {}, messages: hasHeader ? arr.slice(1) : arr };
    otherChatCache.set(id, out);
    return out;
}

// pick one of this character's other chats; resolves to its id or null
async function pickOtherChat(title, desc) {
    const c = ctx();
    let chosen = null;
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div><h4>${esc(title)}</h4><p>${desc}</p></div></div>
        <input type="search" class="text_pole na_pc_q" placeholder="채팅 이름으로 찾기">
        <div class="na_pick_list"><div class="na_empty">불러오는 중…</div></div>
      </div>`);
    const popup = c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
    try {
        const chats = await listOtherChats();
        const render = () => {
            const q = $root.find('.na_pc_q').val().trim().toLowerCase();
            const list = chats.filter(x => !q || x.label.toLowerCase().includes(q));
            $root.find('.na_pick_list').html(list.length ? list.map(x => `
              <div class="na_pick">
                <div class="na_pick_main"><span class="na_pick_name">${esc(x.label)}</span><span class="na_pick_meta">${x.when ? esc(String(x.when)) : ''}${x.count ? ` · 메시지 ${fmt(x.count)}개` : ''}</span></div>
                <button type="button" class="na_btn na_small na_pc_go" data-id="${esc(x.id)}">고르기</button>
              </div>`).join('') : '<div class="na_empty">다른 채팅이 없어요.</div>');
        };
        render();
        $root.find('.na_pc_q').on('input', render);
        $root.on('click', '.na_pc_go', function () { chosen = String(this.dataset.id); $root.closest('dialog').find('.popup-button-ok').trigger('click'); });
    } catch (e) {
        $root.find('.na_pick_list').html('<div class="na_empty">채팅 목록을 못 불러왔어요.</div>');
    }
    await popup;
    return chosen;
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
                    if (await importArchive({ text: meta.text, settings: meta }, chat.label, chat.id)) $st.html('<span class="na_chip na_chip_on">가져옴</span>');
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
    return interleaveChanges(out);
}

// Inside each run of changed lines, put every old line right above the new line it became
// (paired by shared words, in order), instead of all removed lines followed by all added ones.
function interleaveChanges(rows) {
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
function wordDiff(a, b) {
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
function markedPair(a, b) {
    const d = wordDiff(a, b);
    if (!d) return null;
    const same = d.filter(x => x.t === ' ' && /\S/.test(x.s)).length, all = d.filter(x => /\S/.test(x.s)).length;
    if (same < all * 0.3) return null;
    const side = t => d.filter(x => x.t === ' ' || x.t === t).map(x => x.t === ' ' ? esc(x.s) : `<mark class="na_diff_hl">${esc(x.s)}</mark>`).join('')
        .replace(/<\/mark>(\s*)<mark class="na_diff_hl">/g, '$1');
    return { old: side('-'), new: side('+') };
}

// pairs each run of '-' rows with the '+' run right after it, line by line
function diffPairs(rows) {
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

function renderDiff(rows, context = 2) {
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
    const m = hasChat() ? getMeta() : null;
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

// ---- "한국어로 보기" for any diff box: translates only the changed (+/−) lines, shown under each line

const AI_SYS_TRANSLATE = `GOAL
Translate numbered lines of a story archive into natural Korean.

YOU GET
Numbered lines, like "1: …", "2: …". They may be headings, list items, or half sentences.
Some lines are marked (OLD) and the next one (NEW): two versions of the same line.

RULES
1. One output line for each input line. Same numbers, same order. Never skip a number, never merge two lines.
2. Translate every line in full. Do not shorten or summarise.
3. Keep these exactly as they are: markdown marks (#, -, **, _), "#number" references like #512, quotation marks.
4. Names of people and places: write them in Korean script (Glossary spellings win if given).
   Words the archive leaves untranslated on purpose (made-up words, titles in another language): keep as they are.
5. (OLD) and (NEW): translate both. In NEW, copy OLD's Korean word for word wherever the English is the same, and change only the parts whose English changed. Do not write the (OLD)/(NEW) marks in your answer.
6. Each translation stays on ONE line.

OUTPUT: nothing else, exactly like this
1: <Korean>
2: <Korean>`;

// ---- own connections: an OpenAI-compatible URL, or Vertex AI with a service account.
// 'ai' is the AI 기능 model (mode 'st' = SillyTavern's connection or a profile); 'tr' is the translation model (mode 'same' = follow 'ai').

function connSettings(which) {
    const g = globalSettings();
    const k = which === 'tr' ? 'tr' : which === 'dr' ? 'draftConn' : 'aiConn';
    g[k] ||= {};
    const t = g[k];
    t.mode ??= which === 'ai' ? 'st' : 'same';
    t.url ??= ''; t.key ??= ''; t.model ??= '';
    t.vxJson ??= ''; t.vxLocation ??= 'global'; t.vxModel ??= 'gemini-2.5-flash';
    // the old default was us-central1; move untouched settings to global once
    if (!t.vxLocV2) { if (t.vxLocation === 'us-central1') t.vxLocation = 'global'; t.vxLocV2 = true; }
    return t;
}
const trSettings = () => connSettings('tr');

async function callConn(t, system, prompt, maxTokens) {
    return stripThink(t.mode === 'vertex' ? await callVertex(t, system, prompt, maxTokens) : await callOpenAICompat(t, system, prompt, maxTokens));
}

// accepts ".../v1" or a full ".../chat/completions"
function chatCompletionsUrl(raw) {
    const u = String(raw || '').trim().replace(/\/+$/, '');
    if (!u) return '';
    return /\/chat\/completions$/.test(u) ? u : `${u}/chat/completions`;
}

async function callOpenAICompat({ url, key, model }, system, prompt, maxTokens) {
    const endpoint = chatCompletionsUrl(url);
    if (!endpoint || !model) throw new Error('커스텀 API의 URL과 모델 이름을 넣어 주세요 (⚙ 설정 → AI · 번역)');
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers.Authorization = `Bearer ${key}`;
    let r;
    try {
        r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({
            model, max_tokens: maxTokens, temperature: 0.3, stream: false,
            messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
        }) });
    } catch (e) {
        throw new Error(`주소에 연결하지 못했어요. 브라우저에서 바로 부를 수 없는(CORS) API일 수 있어요. (${e.message || e})`);
    }
    const body = await r.text();
    if (!r.ok) throw new Error(`API 오류 ${r.status}: ${body.slice(0, 200)}`);
    let j; try { j = JSON.parse(body); } catch { throw new Error('API 답을 읽지 못했어요'); }
    const msg = j?.choices?.[0]?.message;
    const out = typeof msg?.content === 'string' ? msg.content
        : Array.isArray(msg?.content) ? msg.content.map(p => p?.text || '').join('') : (j?.choices?.[0]?.text || '');
    return out;
}

// --- Vertex AI: sign a JWT with the service account key in the browser, trade it for an access token

const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = s => b64url(new TextEncoder().encode(s));
const vxTokens = new Map(); // client_email → { token, exp }

function parseServiceAccount(raw) {
    let sa;
    try { sa = JSON.parse(String(raw || '')); } catch { throw new Error('서비스 계정 JSON을 읽지 못했어요. 파일 내용을 통째로 붙여넣어 주세요.'); }
    if (!sa?.private_key || !sa?.client_email || !sa?.project_id) throw new Error('서비스 계정 JSON에 private_key, client_email, project_id가 있어야 해요.');
    return sa;
}

async function vertexToken(sa) {
    const hit = vxTokens.get(sa.client_email);
    if (hit && hit.exp > Date.now() + 60_000) return hit.token;
    const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const der = Uint8Array.from(atob(pem), ch => ch.charCodeAt(0));
    const key = await crypto.subtle.importKey('pkcs8', der.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const now = Math.floor(Date.now() / 1000);
    const aud = sa.token_uri || 'https://oauth2.googleapis.com/token';
    const unsigned = `${b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64urlText(JSON.stringify({
        iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud, iat: now, exp: now + 3600,
    }))}`;
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
    const r = await fetch(aud, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(sig)}` }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(`Vertex 인증 실패 ${r.status}: ${j.error_description || j.error || '토큰을 못 받았어요'}`);
    vxTokens.set(sa.client_email, { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 });
    return j.access_token;
}

async function callVertex({ vxJson, vxLocation, vxModel }, system, prompt, maxTokens) {
    const sa = parseServiceAccount(vxJson);
    const loc = String(vxLocation || 'global').trim();
    const model = String(vxModel || '').trim();
    if (!model) throw new Error('Vertex 모델 이름을 넣어 주세요 (예: gemini-2.5-flash)');
    const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`;
    const url = `https://${host}/v1/projects/${encodeURIComponent(sa.project_id)}/locations/${encodeURIComponent(loc)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
    const token = await vertexToken(sa);
    const cats = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'];
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
            safetySettings: cats.map(category => ({ category, threshold: 'BLOCK_NONE' })),
        }),
    });
    const body = await r.text();
    if (!r.ok) throw new Error(`Vertex 오류 ${r.status}: ${body.slice(0, 200)}`);
    const j = JSON.parse(body);
    const cand = j?.candidates?.[0];
    const out = (cand?.content?.parts || []).map(p => p.text || '').join('');
    if (!out && cand?.finishReason) throw new Error(`Vertex가 답을 막았어요 (${cand.finishReason})`);
    if (!out && j?.promptFeedback?.blockReason) throw new Error(`Vertex가 요청을 막았어요 (${j.promptFeedback.blockReason})`);
    return out;
}

async function askTranslator(prompt, { system = '', maxTokens = 0 } = {}) {
    const t = trSettings();
    const max = Math.max(64, Number(maxTokens) || 4096);
    if (t.mode === 'same') return askAI(prompt, { system, maxTokens: max });
    const out = await callConn(t, system, prompt, max);
    if (!out) throw new Error('번역 모델이 빈 답을 돌려줬어요');
    return out;
}

// the draft model writes text that may go into the archive (compression drafts); 'same' = not set
const draftSettings = () => connSettings('dr');
const draftReady = () => ['custom', 'vertex'].includes(draftSettings().mode);
async function askDraft(prompt, { system = '', maxTokens = 0 } = {}) {
    const t = draftSettings();
    if (!draftReady()) throw new Error('초안 모델이 없어요. ⚙ 설정 → AI · 번역 → 초안 모델에서 정해 주세요.');
    const out = await callConn(t, system, prompt, Math.max(256, Number(maxTokens) || Number(t.max) || 16000));
    if (!out) throw new Error('초안 모델이 빈 답을 돌려줬어요');
    return out;
}
const drLabel = () => { const t = draftSettings(); return t.mode === 'custom' ? (t.model || '커스텀 API') : t.mode === 'vertex' ? (t.vxModel || 'Vertex') : '없음'; };

const trLabel = () => {
    const t = trSettings();
    return t.mode === 'custom' ? `커스텀 · ${t.model || '모델 없음'}` : t.mode === 'vertex' ? `Vertex · ${t.vxModel || '모델 없음'}` : aiLabel();
};

const trCache = new Map();

// ---- glossary: Korean spellings the translator must keep ("Horus = 호루스", one per line, kept per chat)

function glossaryEntries(m) {
    return String(m?.glossary || '').split('\n')
        .map(l => l.match(/^\s*([^=→]+?)\s*(?:=|→)\s*(.+?)\s*$/)).filter(Boolean)
        .map(x => ({ src: x[1], ko: x[2] }));
}
const glossaryIn = (entries, text) => { const low = String(text).toLowerCase(); return entries.filter(e => low.includes(e.src.toLowerCase())); };
const shortHash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

// translations survive a reload in the chat's metadata; oldest go first past the cap
const TR_MEM_MAX = 4000;
function trMem() {
    const m = hasChat() ? getMeta() : null;
    if (!m) return null;
    if (!m.trMem || typeof m.trMem !== 'object' || Array.isArray(m.trMem)) m.trMem = {};
    return m.trMem;
}
let trMemTimer;
function trMemSave() {
    const mem = trMem();
    if (!mem) return;
    const keys = Object.keys(mem);
    for (let i = 0; i < keys.length - TR_MEM_MAX; i++) delete mem[keys[i]];
    clearTimeout(trMemTimer);
    trMemTimer = setTimeout(() => saveMeta(), 800);
}
const trGet = k => trCache.get(k) ?? trMem()?.[k];

// items: { text, mark?: 'OLD'|'NEW', key? } — an OLD/NEW pair goes out together so the wording stays the same.
// The glossary entries a line mentions are part of its cache key, so a changed spelling gets a new translation.
async function translateLines(items, { fresh = false } = {}) {
    const gloss = hasChat() ? glossaryEntries(getMeta()) : [];
    items = items.map(x => typeof x === 'string' ? { text: x } : x);
    const keyOf = x => {
        const g = glossaryIn(gloss, x.mark ? (x.key ?? x.text) : x.text);
        return `${g.length ? `${shortHash(g.map(e => `${e.src}=${e.ko}`).join('|'))}\u0002` : ''}${x.key ?? x.text}`;
    };
    const seen = new Set();
    const need = items.filter(x => (fresh || trGet(keyOf(x)) === undefined) && !seen.has(keyOf(x)) && seen.add(keyOf(x)));
    for (let i = 0; i < need.length;) {
        // ~80 lines or ~12k characters a request, never splitting an OLD/NEW pair
        let j = i, size = 0;
        while (j < need.length && (j === i || (j - i < 80 && size + need[j].text.length < 12_000) || need[j].mark === 'NEW')) size += need[j++].text.length;
        const chunk = need.slice(i, j);
        i = j;
        const g = glossaryIn(gloss, chunk.map(x => x.text).join('\n'));
        const system = g.length ? `${AI_SYS_TRANSLATE}\n\nGlossary: always write these names and terms exactly this way:\n${g.map(e => `${e.src} = ${e.ko}`).join('\n')}` : AI_SYS_TRANSLATE;
        const out = await askTranslator(chunk.map((x, k) => `${k + 1}: ${x.mark ? `(${x.mark}) ` : ''}${x.text}`).join('\n'),
            { system, maxTokens: Math.min(16384, 1000 + size * 3) });
        const got = new Map();
        let cur = null;
        for (const row of out.split('\n')) {
            const mt = row.match(/^\s*(\d+)\s*[:.)]\s?(.*)$/);
            if (mt && chunk[Number(mt[1]) - 1] !== undefined) { cur = Number(mt[1]) - 1; got.set(cur, mt[2]); }
            else if (cur !== null && row.trim()) got.set(cur, `${got.get(cur)} ${row.trim()}`); // a translation the model broke onto two lines
        }
        for (const [k, v] of got) {
            const t = v.replace(/^\s*\((?:OLD|NEW)\)\s*/i, '').trim();
            if (t) { trCache.set(keyOf(chunk[k]), t); const mem = trMem(); if (mem) { delete mem[keyOf(chunk[k])]; mem[keyOf(chunk[k])] = t; } }
        }
        trMemSave();
    }
    return items.map(x => trGet(keyOf(x)) ?? null);
}

// ---- glossary editor

const AI_SYS_GLOSSARY = `GOAL
Decide one fixed Korean spelling for each name or term, so every translation of the story writes it the same way.

YOU GET
One English name or term per line, each with a short piece of context showing how it is used.

RULES
1. Real names with a usual Korean spelling (mythology, history, real places): use that spelling.
2. Other names: transliterate naturally, the way a Korean reader would say it.
3. Titles and ordinary nouns (e.g. "the Queen", "the well"): translate into natural Korean.
4. Made-up words: transliterate, do not translate.
5. Look at the context to tell a name from an ordinary word.

OUTPUT: one line per input, same order, nothing else, exactly like this
Avalon = 아발론
Lighthouse = 등대`;

async function openGlossary() {
    const c = ctx();
    const m = getMeta();
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div>
          <h4>번역 용어집</h4>
          <p>한 줄에 하나씩 <code>영어 = 한국어</code>로 적어요. 번역할 때 그 줄에 나오는 이름만 골라 모델에 같이 보내요. 이 채팅에만 저장되고, 다른 채팅에서 가져오기를 하면 같이 따라가요.</p>
        </div></div>
        <textarea class="text_pole na_gl_ta" rows="12" spellcheck="false" placeholder="Avalon = 아발론&#10;Lighthouse Keeper = 등대지기"></textarea>
        <div class="na_row_btns na_gl_btns">
          <button type="button" class="na_btn na_small na_gl_find"><i class="fa-solid fa-magnifying-glass"></i> 아카이브에서 이름 찾기</button>
          <button type="button" class="na_btn na_small na_gl_ai"><i class="fa-solid fa-wand-magic-sparkles"></i> AI로 한국어 채우기</button>
        </div>
        <small class="na_dim na_gl_info"></small>
      </div>`);
    const $ta = $root.find('.na_gl_ta').val(m.glossary || '');
    const info = () => {
        const lines = $ta.val().split('\n').filter(l => l.trim());
        const empty = lines.filter(l => !/(=|→)\s*\S/.test(l)).length;
        $root.find('.na_gl_info').text(`${lines.length - empty}개${empty ? ` · 한국어가 빈 줄 ${empty}개` : ''}`);
    };
    $ta.on('input', info);
    info();
    $root.find('.na_gl_find').on('click', () => {
        const have = new Set(glossaryEntries({ glossary: $ta.val() }).map(e => e.src.toLowerCase())
            .concat($ta.val().split('\n').map(l => l.split(/=|→/)[0].trim().toLowerCase())));
        const counts = new Map();
        capWords(m.text).forEach(w => counts.set(w, (counts.get(w) || 0) + 1));
        const found = [...counts].filter(([w, n]) => n >= 3 && !have.has(w.toLowerCase())).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([w]) => w);
        if (!found.length) return toastr.info('새로 넣을 이름이 없어요.');
        $ta.val(`${$ta.val().replace(/\s+$/, '')}${$ta.val().trim() ? '\n' : ''}${found.map(w => `${w} = `).join('\n')}`);
        info();
        toastr.success(`${found.length}개 넣었어요. 한국어는 직접 적거나 AI로 채우세요.`);
    });
    $root.find('.na_gl_ai').on('click', async function () {
        const lines = $ta.val().split('\n');
        const todo = lines.map((l, i) => ({ i, src: l.split(/=|→/)[0].trim(), empty: !/(=|→)\s*\S/.test(l) })).filter(x => x.src && x.empty);
        if (!todo.length) return toastr.info('한국어가 빈 줄이 없어요. "이름 = "처럼 적어 두면 채워요.');
        const ctxOf = w => { const i = m.text.indexOf(w); return i < 0 ? '' : m.text.slice(Math.max(0, i - 60), i + w.length + 60).replace(/\s+/g, ' '); };
        const prompt = todo.map(x => `${x.src} — context: ${ctxOf(x.src)}`).join('\n');
        const out = await withSpinner($(this), '채우는 중…', () => askTranslator(prompt, { system: AI_SYS_GLOSSARY, maxTokens: Math.min(8000, 400 + todo.length * 60) }));
        if (out === null) return;
        const got = new Map(out.split('\n').map(l => l.match(/^\s*(?:[-*]\s*)?([^=→]+?)\s*(?:=|→)\s*(.+?)\s*$/)).filter(Boolean).map(x => [x[1].toLowerCase(), x[2]]));
        let n = 0;
        for (const x of todo) { const ko = got.get(x.src.toLowerCase()); if (ko) { lines[x.i] = `${x.src} = ${ko}`; n++; } }
        $ta.val(lines.join('\n'));
        info();
        toastr.success(`${n}개 채웠어요. 틀린 건 고쳐 주세요.`);
    });
    const r = await c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', { wide: true, allowVerticalScrolling: true, okButton: '저장', cancelButton: '취소' });
    if (r !== c.POPUP_RESULT.AFFIRMATIVE && r !== true) return;
    m.glossary = $ta.val().split('\n').map(l => l.trimEnd()).filter(l => l.trim()).join('\n');
    await saveMeta();
    toastr.success(`용어집 저장 · ${glossaryEntries(m).length}개`);
}

const TR_LABEL = '<i class="fa-solid fa-language"></i> 한국어로 보기';
const TR_HIDE = '<i class="fa-solid fa-language"></i> 번역 숨기기';

// button that toggles Korean under the changed lines of $diff (any element holding renderDiff output)
function translateButton($diff) {
    const $btn = $(`<button type="button" class="na_btn na_small na_tr_btn">${TR_LABEL}</button>`);
    $btn.on('click', async () => {
        if ($diff.find('.na_diff_tr').length) { $diff.find('.na_diff_tr').remove(); $btn.html(TR_LABEL); return; }
        const all = $diff.children().toArray();
        const lineOf = el => (el.querySelector('.na_dl') || el).textContent.replace(/^[+−-]/, '').trim();
        const rows = all.filter(el => el.classList.contains('na_diff_add') || el.classList.contains('na_diff_del'))
            .map(el => ({ el, text: lineOf(el) }))
            .filter(r => /[\p{L}]{2,}/u.test(r.text));
        if (!rows.length) return toastr.info('번역할 바뀐 줄이 없어요.');
        // the same pairing renderDiff used: each '-' run against the '+' run right after it
        const shape = all.map(el => ({ t: el.classList.contains('na_diff_del') ? '-' : el.classList.contains('na_diff_add') ? '+' : ' ' }));
        const partner = new Map();
        for (const [d, a] of diffPairs(shape)) { partner.set(all[d], all[a]); partner.set(all[a], all[d]); }
        const items = rows.map(r => {
            const p = partner.get(r.el);
            if (!p || !/[\p{L}]{2,}/u.test(lineOf(p))) return { text: r.text };
            const del = r.el.classList.contains('na_diff_del');
            const [o, n] = del ? [r.text, lineOf(p)] : [lineOf(p), r.text];
            return { text: r.text, mark: del ? 'OLD' : 'NEW', key: `${del ? 'O' : 'N'}\u0000${o}\u0000${n}`, pairKey: `${o}\u0000${n}` };
        });
        // a pair must sit next to each other, OLD first
        const order = [];
        const placed = new Set();
        items.forEach((x, i) => {
            if (placed.has(i)) return;
            if (x.mark) {
                const j = items.findIndex((y, k) => k !== i && y.pairKey === x.pairKey && y.mark !== x.mark);
                if (j >= 0) { const [o, n] = x.mark === 'OLD' ? [i, j] : [j, i]; order.push(o, n); placed.add(o).add(n); return; }
                items[i] = { text: x.text };
            }
            order.push(i); placed.add(i);
        });
        const tr = await withSpinner($btn, `번역하는 중… (${rows.length}줄)`, () => translateLines(order.map(i => items[i])));
        if (!tr) { $btn.html(TR_LABEL); return; }
        const trOf = new Map(order.map((idx, k) => [rows[idx].el, tr[k]]));
        rows.forEach(r => {
            const t = trOf.get(r.el);
            if (!t) return;
            const del = r.el.classList.contains('na_diff_del');
            const p = partner.get(r.el), pt = p && trOf.get(p);
            const mk = pt ? markedPair(del ? t : pt, del ? pt : t) : null;
            const kind = del ? 'na_diff_tr_del' : 'na_diff_tr_add';
            $(r.el).after(`<div class="na_diff_tr ${kind}"><span></span><div class="na_dl">${mk ? (del ? mk.old : mk.new) : esc(t)}</div></div>`);
        });
        $btn.html(TR_HIDE);
        const miss = rows.filter(r => !trOf.get(r.el)).length;
        if (miss) toastr.info(`${miss}줄은 번역이 안 왔어요. 다시 누르면 그 줄만 다시 보내요.`);
    });
    // a re-render replaces the rows, so the button goes back to "show"
    $btn.reset = () => $btn.html(TR_LABEL);
    return $btn;
}

async function openDiff(snap, after = { text: getMeta().text, label: '지금' }) {
    const c = ctx();
    const rows = lineDiff(snap.text, after.text);
    const add = rows.filter(r => r.t === '+').length, del = rows.filter(r => r.t === '-').length;
    const $v = $(`
      <div class="na_popup na_popup_fill">
        <div class="na_diff_head">
          <b>${esc(timeLabel(snap.at))} · ${esc(snap.reason)}</b> → <b>${esc(after.label)}</b>
          <span class="na_chip na_chip_add">+${fmt(add)}줄</span><span class="na_chip na_chip_del">−${fmt(del)}줄</span>
        </div>
        <div class="na_diff">${add || del ? renderDiff(rows) : '<div class="na_empty">내용이 똑같아요.</div>'}</div>
      </div>`);
    if (add || del) $v.find('.na_diff_head').append(translateButton($v.find('.na_diff')));
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
    const build = await currentInjection();
    const archiveTok = m.enabled ? build.tokens : 0;
    const after = m.boundary >= 0 ? buildExtract(m.boundary + 1, last) : [];
    const afterTok = await countTokens(extractToText(after));
    const total = archiveTok + afterTok;

    $('#na_meter_total').html(`${fmt(total)}<small> 토큰 주입</small>`);
    let state = '';
    if (!m.enabled) state = '<span class="na_chip na_chip_off">주입 꺼짐</span>';
    else if (m.backupEvery > 0 && m.sinceBackup >= m.backupEvery) state = '<span class="na_chip na_chip_warn">백업할 때예요</span>';
    else if (m.text.trim()) state = '<span class="na_chip na_chip_on">주입 중</span>';
    $('#na_meter_state').html(state);

    const pct = total ? Math.round(archiveTok / total * 100) : 0;
    $('#na_meter .na_seg_arc').css('width', `${pct}%`);
    $('#na_meter .na_seg_raw').css('width', `${total ? 100 - pct : 0}%`).removeClass('na_over');
    $('#na_meter_legend').html(`
      <span><i class="na_dot na_dot_arc"></i>아카이브 ${fmt(archiveTok)}</span>
      <span><i class="na_dot na_dot_raw"></i>${m.boundary >= 0 ? `#${m.boundary} 이후 원문 ${fmt(afterTok)} · ${after.length}개` : '경계선 없음'}</span>
      ${mutedCount(m) ? `<span class="na_warn_txt"><i class="fa-solid fa-toggle-off"></i> 섹션 ${mutedCount(m)}개 꺼짐</span>` : ''}
      ${linkWaiting(m).size ? `<span class="na_dim"><i class="fa-solid fa-key"></i> 대기 ${linkWaiting(m).size}개</span>` : ''}
      ${routerCfg(m).mode !== 'off' ? `<span class="na_dim"><i class="fa-solid fa-compass"></i> 라우터 ${routerState.get(currentChatId()) ? `${routerState.get(currentChatId()).titles.length}개 고름` : '답할 때 골라요'}</span>` : ''}
      ${build.trimmed.length ? `<span class="na_warn_txt"><i class="fa-solid fa-scissors"></i> 상한 ${fmt(build.cap)}에 맞춰 ${build.trimmed.length}개 뺌</span>` : ''}
      ${build.over ? `<span class="na_warn_txt"><i class="fa-solid fa-triangle-exclamation"></i> 상한 ${fmt(build.cap)} 넘음</span>` : ''}`);
    $('#na_head_badge').text(m.text.trim() ? fmt(archiveTok) : '');
    let h = null;
    if (m.text.trim()) {
        h = await healthChecks(m, { build, afterTok, after });
        const n = h.items.filter(x => x.level === 'bad' || x.level === 'warn').length;
        $('#na_health').toggleClass('na_health_warn', h.score < 80).attr('title', `건강 ${h.score}점${n ? ` · 확인할 것 ${n}개` : ''}`).find('span').text(h.score);
        $('#na_tool_health_sub').text(`${h.score}점${n ? ` · 확인할 것 ${n}개` : ' · 괜찮아요'}`);
    } else { $('#na_health span').text('-'); $('#na_tool_health_sub').text('번호·숨기기·키워드·백업을 AI 없이 살펴봐요'); }
    renderNext(m, { afterTok, health: h });

    const lx = m.lastExport;
    const lxNote = lx ? `<small class="na_v2_note">최근 내보냄 #${lx.from}–#${lx.to} · ${esc(timeLabel(lx.at))}</small>` : '';
    const hn = hiddenIndexes().length;
    $('#na_hidden_n').text(hn ? `지금 숨긴 메시지 ${hn}개` : '숨긴 메시지 없음');
    { const gs = globalSettings(), ap = activePrompt(gs); $('#na_plib_sum').text(`${gs.prompts.length}개 · 지금 "${ap.name}"`); }
    $('#na_since').html(m.boundary >= 0 ? `
      <div class="na_cp_hhead"><span>경계선 #${m.boundary} 뒤에 쌓인 원문</span><span>마지막 #${last}</span></div>
      <div class="na_cp_big"><b>${fmt(afterTok)}</b><span>토큰 · 메시지 ${after.length}개</span></div>
      <div class="na_cp_bar"><span class="hid" style="flex:${Math.max(1, m.boundary + 1)}"></span><span class="raw" style="flex:${Math.max(1, last - m.boundary)}"></span></div>
      <div class="na_cp_hhead"><small>#0 – #${m.boundary} 압축됨</small><small>${last > m.boundary ? `#${m.boundary + 1} – #${last} 원문` : '원문 없음'}</small></div>
      ${lxNote}` : '<div class="na_cp_hhead"><span>경계선이 아직 없어요</span></div><small class="na_v2_note">직접 적거나 "아카이브에 추가"를 쓰면 자동으로 정해져요.</small>');
}

// muted / pinned / keyword links follow a renamed section
function renameKeys(m, from, to) {
    const ren = arr => (arr || []).map(k => k === from ? to : k);
    m.muted = ren(m.muted);
    m.pinned = ren(m.pinned);
    const lm = { ...linkedMap(m) };
    if (lm[from]) { lm[to] = lm[from]; delete lm[from]; m.linked = lm; }
}

// ---------------------------------------------------------------- every chat's archive

// pick one archive out of a "모두 백업" bundle file
async function pickFromBundle(bundle) {
    const c = ctx();
    const list = (bundle.items || []).filter(x => typeof x?.data?.text === 'string');
    if (!list.length) { toastr.error('묶음 파일에 아카이브가 없어요.'); return null; }
    const $root = $(`<div class="na_popup"><div class="na_block_head"><div><h4>묶음에서 고르기</h4><p>이 채팅에 넣을 아카이브를 고르고 닫기를 누르세요.</p></div></div><div class="na_pick_list"></div></div>`);
    let chosen = null;
    list.forEach(it => {
        const $row = $(`<div class="na_pick"><div class="na_pick_main"><span class="na_pick_name">${esc(it.owner)} · ${esc(it.chat)}</span><span class="na_pick_meta">${fmt(it.data.text.length)}자</span></div>
            <div class="na_pick_state"><button type="button" class="na_btn na_small">이걸로</button></div></div>`);
        $row.find('button').on('click', () => {
            chosen = it;
            $root.find('.na_pick button').removeClass('na_primary').text('이걸로');
            $row.find('button').addClass('na_primary').text('✓ 골랐어요');
        });
        $root.find('.na_pick_list').append($row);
    });
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
    return chosen;
}

// ---------------------------------------------------------------- compare two versions

async function openCompare() {
    const c = ctx();
    const m = getMeta();
    const sources = [
        { id: 'now', label: '지금 아카이브', text: m.text },
        ...m.snapshots.map((s, i) => ({ id: `s${i}`, label: `복구 지점 · ${timeLabel(s.at)} · ${s.reason}`, text: s.text })),
        { id: 'file', label: '파일 불러오기…', text: null },
    ];
    const opts = sel => sources.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.label)}</option>`).join('');
    const $root = $(`
      <div class="na_popup na_popup_fill">
        <div class="na_block_head"><div>
          <h4>두 버전 비교</h4>
          <p>A에서 B로 바뀐 줄만 보여줘요. 파일끼리도 비교할 수 있어요.</p>
        </div></div>
        <div class="na_cmp_pick">
          <label><span class="na_cmp_tag">A</span><select class="text_pole na_cmp_a">${opts(m.snapshots.length ? 's0' : 'file')}</select></label>
          <label><span class="na_cmp_tag">B</span><select class="text_pole na_cmp_b">${opts('now')}</select></label>
          <input type="file" class="na_cmp_file" accept=".txt,.md,.json,text/plain,application/json" hidden>
        </div>
        <div class="na_cmp_from">
          <input type="text" class="text_pole na_cmp_marker" placeholder="이 줄부터만 비교 (예: # ── Y2) — 비우면 전체">
        </div>
        <div class="na_diff_head na_cmp_head"></div>
        <div class="na_diff na_cmp_diff"><div class="na_empty">A와 B를 고르세요.</div></div>
      </div>`);
    const files = { a: null, b: null };
    let pickingFor = null;
    const cmpTr = translateButton($root.find('.na_cmp_diff'));
    const textOf = side => {
        const id = $root.find(`.na_cmp_${side}`).val();
        if (id === 'file') return files[side]?.text ?? null;
        return sources.find(x => x.id === id)?.text ?? null;
    };
    const labelOf = side => {
        const id = $root.find(`.na_cmp_${side}`).val();
        return id === 'file' ? (files[side]?.name || '파일') : sources.find(x => x.id === id)?.label;
    };
    const cut = (t, marker) => {
        if (!marker) return t;
        const at = t.indexOf(marker);
        return at < 0 ? null : t.slice(at);
    };
    const render = () => {
        const marker = $root.find('.na_cmp_marker').val().trim();
        const a0 = textOf('a'), b0 = textOf('b');
        if (a0 === null || b0 === null) { cmpTr.detach(); $root.find('.na_cmp_head').empty(); $root.find('.na_cmp_diff').html('<div class="na_empty">파일을 골라 주세요.</div>'); return; }
        const a = cut(a0, marker), b = cut(b0, marker);
        if (a === null || b === null) {
            cmpTr.detach(); $root.find('.na_cmp_head').empty();
            $root.find('.na_cmp_diff').html(`<div class="na_empty">"${esc(marker)}" 줄이 ${a === null && b === null ? '둘 다' : a === null ? 'A에' : 'B에'} 없어요.</div>`);
            return;
        }
        const rows = lineDiff(a, b);
        const add = rows.filter(r => r.t === '+').length, del = rows.filter(r => r.t === '-').length;
        cmpTr.reset();
        cmpTr.detach(); // keep its click handler; .html() below would drop it
        $root.find('.na_cmp_head').html(`<b>A</b> ${esc(labelOf('a'))} → <b>B</b> ${esc(labelOf('b'))}
            ${add || del ? `<span class="na_chip na_chip_add">+${fmt(add)}줄</span><span class="na_chip na_chip_del">−${fmt(del)}줄</span>` : '<span class="na_chip na_chip_on">똑같아요</span>'}`);
        $root.find('.na_cmp_diff').html(add || del ? renderDiff(rows) : `<div class="na_empty">${marker ? `"${esc(marker)}"부터 ` : ''}내용이 똑같아요.</div>`);
        if (add || del) $root.find('.na_cmp_head').append(cmpTr);
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
    let t;
    $root.find('.na_cmp_marker').on('input', () => { clearTimeout(t); t = setTimeout(render, 300); });
    render();
    if ($root.find('.na_cmp_a').val() === 'file') { pickingFor = 'a'; }
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// ---------------------------------------------------------------- injection preview

async function openPreview() {
    const c = ctx();
    const m = getMeta();
    const b = await currentInjection();
    const where = Number(m.position) === 1 ? `채팅 안 깊이 ${m.depth}` : POSITIONS[m.position];
    const titles = new Set(parseSections(m.text).map(sectionKey));
    const muted = [...mutedSet(m)].filter(t => titles.has(t));
    const waiting = [...linkWaiting(m)].filter(t => titles.has(t) && !muted.includes(t));
    const list = (arr, cls) => arr.map(t => `<li class="${cls}">${esc(keyLabel(t))}</li>`).join('');
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div>
          <h4>주입 미리보기</h4>
          <p>다음 응답 때 프롬프트에 실제로 들어가는 그대로예요. 꺼 둔 섹션, 키워드 연동, AI 라우터, 망각 곡선, 세계관이 다 반영돼 있어요.</p>
        </div></div>
        <div class="na_pv_stats">
          <span class="na_chip ${m.enabled && b.text ? 'na_chip_on' : 'na_chip_off'}">${m.enabled ? (b.text ? '주입 중' : '비어 있음') : '주입 꺼짐'}</span>
          <span class="na_chip">${fmt(b.tokens)} 토큰${b.cap ? ` / 상한 ${fmt(b.cap)}` : ''}</span>
          <span class="na_chip">${esc(where)} · ${esc(ROLES[m.role] || '')}</span>
          ${b.over ? '<span class="na_chip na_chip_warn">상한 넘음</span>' : ''}
        </div>
        ${muted.length || waiting.length || b.trimmed.length ? `
        <details class="na_block na_details">
          <summary>빠진 섹션 ${muted.length + waiting.length + b.trimmed.length}개</summary>
          <div><ul class="na_pv_out">${list(muted, 'na_pv_muted')}${list(waiting, 'na_pv_wait')}${list(b.trimmed, 'na_pv_trim')}</ul>
          <div class="na_dim na_pv_legend"><span class="na_pv_muted">스위치로 끔</span> · <span class="na_pv_wait">키워드 대기</span> · <span class="na_pv_trim">상한으로 뺌</span></div></div>
        </details>` : ''}
        <textarea class="text_pole na_full na_pv_text" readonly spellcheck="false"></textarea>
        <div class="na_row na_right">
          <button type="button" class="na_btn na_pv_copy"><i class="fa-regular fa-copy"></i> 복사</button>
        </div>
      </div>`);
    $root.find('.na_pv_text').val(m.enabled ? b.text : '');
    $root.find('.na_pv_copy').on('click', async () => {
        const ok = await copyText(b.text, $root.find('.na_pv_text')[0]);
        ok ? toastr.success('복사됨') : toastr.warning('복사가 막혀 있어요.');
    });
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// ---------------------------------------------------------------- reading mode

// Small markdown renderer for the archive's own format (headings, bullets, rules, emphasis). Escapes first.
function mdInline(t) {
    return esc(t)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>')
        .replace(/(^|[^\w])_(?!\s)(.+?)_(?!\w)/g, '$1<em>$2</em>');
}

function mdBlock(text) {
    const out = [];
    let list = null, para = [];
    const flushPara = () => { if (para.length) out.push(`<p>${para.map(mdInline).join('<br>')}</p>`); para = []; };
    const flushList = () => { if (list) out.push(`<ul>${list.map(x => `<li>${mdInline(x)}</li>`).join('')}</ul>`); list = null; };
    for (const line of text.split('\n')) {
        const t = line.trimEnd();
        let mt;
        if (!t.trim()) { flushPara(); flushList(); continue; }
        if ((mt = t.match(/^(#{1,3}) (.*)$/))) {
            flushPara(); flushList();
            const lv = mt[1].length;
            out.push(`<h${lv + 1} class="na_rd_h${lv}">${mdInline(lv === 1 ? groupLabel(mt[2]) : mt[2])}</h${lv + 1}>`);
        } else if (/^-{3,}$/.test(t.trim())) { flushPara(); flushList(); out.push('<hr>'); }
        else if ((mt = t.match(/^\s*[-*] (.*)$/))) { flushPara(); (list ||= []).push(mt[1]); }
        else if (list && /^\s{2,}\S/.test(t)) list[list.length - 1] += ` ${t.trim()}`;
        else { flushList(); para.push(t); }
    }
    flushPara(); flushList();
    return out.join('');
}

function renderReading(m, { show } = {}) {
    const muted = mutedSet(m);
    const waiting = linkWaiting(m);
    const trimmed = new Set();
    const secs = parseSections(m.text);
    const toc = [];
    let skipLevel = 0;
    const html = secs.map((s, i) => {
        if (skipLevel && s.level <= skipLevel) skipLevel = 0;
        const off = muted.has(sectionKey(s));
        if (off && s.group) skipLevel = s.level;
        const dim = off || skipLevel > 0;
        const wait = !dim && waiting.has(sectionKey(s));
        const cut = !dim && !wait && trimmed.has(sectionKey(s));
        const id = `na_rd_${i}`;
        if (s.title !== '(머리말)' && s.title !== '(제목 없음)') toc.push({ id, level: s.level, title: s.group ? groupLabel(s.title) : s.title });
        const tag = dim ? '<span class="na_rd_tag">주입 안 함</span>' : wait ? '<span class="na_rd_tag">키워드 대기</span>' : cut ? '<span class="na_rd_tag na_rd_tag_cut">상한으로 빠짐</span>' : '';
        const src = !s.group ? srcButton(m, s.title, 'chip') : '';
        const raw = m.text.slice(s.start, s.end);
        return `<section id="${id}" class="na_rd_sec ${dim || wait ? 'na_rd_off' : ''} ${cut ? 'na_rd_cut' : ''}">${tag}${src ? `<div class="na_rd_src">${src}</div>` : ''}${mdBlock(show ? show(raw) : raw)}</section>`;
    }).join('');
    return { html, toc };
}

// ---------------------------------------------------------------- source jump
// A section titled "Y2 #564–#567 — ..." opens messages #564–#567 of this chat. Only the newest log's prefix
// (the one the last numbered section uses) is this chat; older logs live in other chats.

function sourceRange(m, title) {
    const r = String(title || '').replace(/^#{1,3}\s+/, '').match(RANGE_HEAD); // "## " marks only, not "#0"
    if (!r) return null;
    const prefix = (r[1] || '').trim();
    const from = Math.min(+r[2], +r[4]), to = Math.max(+r[2], +r[4]);
    const ranges = headingRanges(m.text);
    const cur = ranges.length ? ranges[ranges.length - 1].prefix : '';
    const label = `${prefix ? `${prefix} ` : ''}#${from}–#${to}`;
    if (prefix !== cur) {
        // an older log: open it from the chat it was linked to, or ask which chat that is
        const chat = (m.logLinks || {})[prefix] || null;
        return { prefix, from, to, ok: true, chat, needLink: !chat, why: '', label };
    }
    const n = (ctx().chat || []).length;
    const why = from >= n ? '이 채팅에 아직 없는 번호예요' : '';
    return { prefix, from, to: Math.min(to, n - 1), ok: !why, why, label };
}

// 'icon' for card toolbars, 'chip' for the reader and diffs; '' when the title has no range
function srcButton(m, title, kind) {
    const r = sourceRange(m, title);
    if (!r) return '';
    const data = `data-from="${r.from}" data-to="${r.to}" data-label="${esc(r.label)}" data-prefix="${esc(r.prefix)}"${r.chat ? ` data-chat="${esc(r.chat)}"` : ''}${r.needLink ? ' data-link="1"' : ''}`;
    const tip = !r.ok ? r.why : r.needLink ? '이전 채팅의 번호예요 · 누르면 어느 채팅인지 골라서 열어요' : r.chat ? `이전 채팅에서 열어요: ${r.chat}` : '이 섹션의 원문 메시지 보기';
    const cls = r.needLink ? ' na_src_link' : '';
    if (kind === 'icon') return `<button type="button" class="na_btn na_small na_src_btn${cls}" ${data} ${r.ok ? '' : 'disabled'} title="${esc(tip)}"><i class="fa-solid fa-arrow-up-right-from-square"></i> 원문</button>`;
    return `<button type="button" class="na_src_chip na_src_btn${cls}" ${data} ${r.ok ? '' : 'disabled'} title="${esc(tip)}"><i class="fa-solid fa-arrow-up-right-from-square"></i> 원문 ${esc(r.label)}</button>`;
}

async function openSource(from, to, label, otherChat = null, prefix = '') {
    const c = ctx();
    let chat = c.chat || [];
    if (otherChat) {
        try { chat = (await fetchOtherChat(otherChat)).messages; }
        catch (e) { toastr.error(`이전 채팅을 못 열었어요: ${e.message || e}`); return; }
    }
    const items = [];
    for (let i = from; i <= to && i < chat.length; i++) {
        const x = chat[i];
        if (!x) continue;
        const text = cleanMessage(String(x.mes || ''), { stripTags: true });
        items.push(`<div class="na_src_msg ${x.is_user ? 'na_src_user' : ''}" data-id="${i}">
            <div class="na_src_head"><b>#${i}</b> <span>${esc(x.name || '')}</span>${x.is_system ? '<span class="na_chip">숨김</span>' : ''}
              ${otherChat ? '' : '<button type="button" class="na_linkbtn na_src_goto">채팅에서 보기</button>'}</div>
            <div class="na_src_body">${mdBlock(text) || '<span class="na_dim">(비어 있음)</span>'}</div>
          </div>`);
    }
    const $v = $(`
      <div class="na_popup na_popup_fill">
        <div class="na_diff_head"><b>원문 ${esc(label)}</b><span class="na_dim">메시지 ${items.length}개</span></div>
        ${otherChat ? `<div class="na_src_from na_dim"><i class="fa-solid fa-link"></i> ${esc(otherChat)} <button type="button" class="na_linkbtn na_src_relink">다른 채팅으로 바꾸기</button></div>` : ''}
        <div class="na_src_list">${items.join('') || `<div class="na_empty">${otherChat ? '그 채팅에 이 번호의 메시지가 없어요. 다른 채팅을 골라 보세요.' : '이 채팅에 그 번호의 메시지가 없어요.'}</div>`}</div>
      </div>`);
    $v.data('prefix', prefix).data('range', { from, to, label });
    $v.on('click', '.na_src_goto', function () {
        const id = $(this).closest('.na_src_msg').data('id');
        const $mes = $(`#chat .mes[mesid="${id}"]`);
        if (!$mes.length) return toastr.info('채팅 화면에 아직 불러오지 않은 메시지예요. 위로 스크롤해 더 불러온 뒤 다시 눌러 주세요.');
        // close this and any read-only popups under it (never one with a 취소 that would drop someone's input)
        $('dialog').filter((i, d) => d.open && $(d).find('.na_popup').length && !$(d).find('.popup-button-cancel').filter(':visible').length)
            .get().reverse().forEach(d => $(d).find('.popup-button-ok').first().trigger('click'));
        setTimeout(() => $mes[0].scrollIntoView({ block: 'start', behavior: 'smooth' }), 150);
    });
    await c.callGenericPopup($v, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// which chat holds an older log's numbers; saved in the archive's settings so it follows the archive
async function linkLog(prefix) {
    const id = await pickOtherChat(`${prefix || '앞 번호'} 로그는 어느 채팅이에요?`,
        `<b>${esc(prefix || '앞 번호(접두어 없음)')}</b> 섹션의 원문이 있는 채팅을 골라 주세요. 한 번 고르면 기억하고, 아카이브를 다음 채팅에 가져가도 따라가요.`);
    if (!id) return null;
    const m = getMeta();
    m.logLinks = { ...(m.logLinks || {}), [prefix]: id };
    await saveMeta();
    sectionPanel?.render();
    return id;
}

$(document).on('click', '.na_src_btn', async function (e) {
    e.stopPropagation();
    if (this.disabled || !hasChat()) return;
    const d = this.dataset;
    let chat = d.chat || null;
    if (d.link) { chat = await linkLog(d.prefix || ''); if (!chat) return; }
    openSource(Number(d.from), Number(d.to), d.label || '', chat, d.prefix || '');
});

$(document).on('click', '.na_src_relink', async function () {
    const $pop = $(this).closest('.na_popup');
    const prefix = String($pop.data('prefix') ?? '');
    const range = $pop.data('range');
    const id = await linkLog(prefix);
    if (!id || !range) return;
    $pop.closest('dialog').find('.popup-button-ok').trigger('click');
    openSource(range.from, range.to, range.label, id, prefix);
});

// ---------------------------------------------------------------- keyword test

// where a keyword hit in `src`, so "Set" matching inside "settle" is easy to spot
function kwSnippet(src, w) {
    const i = src.toLowerCase().indexOf(String(w).toLowerCase());
    if (i < 0) return '';
    const a = Math.max(0, i - 14), b = Math.min(src.length, i + w.length + 14);
    const inWord = /[A-Za-z]/.test(src[i - 1] || '') || /[A-Za-z]/.test(src[i + w.length] || '');
    return `${a ? '…' : ''}${esc(src.slice(a, i))}<mark>${esc(src.slice(i, i + w.length))}</mark>${esc(src.slice(i + w.length, b))}${b < src.length ? '…' : ''}`
        + (inWord ? ` <span class="na_kwt_warn"><i class="fa-solid fa-triangle-exclamation"></i> 다른 단어 속에서 걸렸어요</span>` : '');
}

async function openKeywordTest() {
    const c = ctx();
    const m = getMeta();
    const depth = Math.max(1, Number(m.linkDepth) || 4);
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div>
          <h4>키워드 테스트</h4>
          <p>문장을 넣으면 🔑 키워드 연동한 섹션 중 어떤 게 불려 오는지 보여 줘요. 실제 주입은 바뀌지 않아요.</p>
        </div></div>
        <textarea class="text_pole na_kwt_in" rows="3" placeholder="예: 그 지도 아직 갖고 있어?"></textarea>
        <label class="checkbox_label"><input type="checkbox" class="na_kwt_recent"><span>최근 메시지 ${depth - 1}개도 같이 (이 문장을 다음 메시지로 보낸다고 치기)</span></label>
        <div class="na_kwt_out"></div>
      </div>`);
    const linked = Object.entries(linkedMap(m)).filter(([, k]) => Array.isArray(k) && k.length);
    const keys = new Set(parseSections(m.text).map(sectionKey));
    const muted = mutedSet(m);
    const render = () => {
        if (!linked.length) return $root.find('.na_kwt_out').html('<div class="na_empty">키워드 연동한 섹션이 없어요. 아카이브 탭의 섹션 카드에서 카드를 펼쳐 🔑를 눌러 키워드를 정하세요.</div>');
        const text = $root.find('.na_kwt_in').val();
        const withRecent = $root.find('.na_kwt_recent').prop('checked');
        const hay = `${text}\n${withRecent && depth > 1 ? recentChatText(m, depth - 1) : ''}`.toLowerCase();
        const rows = linked.map(([key, ks]) => {
            const hits = text.trim() || withRecent ? linkHits(ks, hay) : [];
            const off = muted.has(key), gone = !keys.has(key);
            const state = gone ? 'gone' : off ? 'off' : hits.length ? 'on' : 'wait';
            return { key, ks, hits, state };
        }).sort((a, b) => ['on', 'wait', 'off', 'gone'].indexOf(a.state) - ['on', 'wait', 'off', 'gone'].indexOf(b.state));
        const label = { on: '호출됨', wait: '호출 안 됨', off: '스위치 꺼짐', gone: '섹션 없음' };
        const icon = { on: 'fa-circle-check', wait: 'fa-circle', off: 'fa-power-off', gone: 'fa-circle-question' };
        const where = w => kwSnippet(`${text}\n${withRecent && depth > 1 ? recentChatText(m, depth - 1) : ''}`, w);
        $root.find('.na_kwt_out').html(rows.map(r => `
            <div class="na_kwt_row na_kwt_${r.state}">
              <i class="fa-solid ${icon[r.state]}"></i>
              <div class="na_kwt_main">
                <div><b>${label[r.state]}</b> · ${esc(keyLabel(r.key))}</div>
                <div class="na_kwt_keys">${r.ks.map(w => `<span class="na_kwt_key ${r.hits.includes(w) ? 'hit' : ''}">${esc(w)}</span>`).join('')}</div>
                ${r.state === 'on' ? `<div class="na_kwt_where">${r.hits.map(w => `<div>${where(w)}</div>`).join('')}</div>` : ''}
              </div>
            </div>`).join(''));
    };
    let t;
    $root.find('.na_kwt_in').on('input', () => { clearTimeout(t); t = setTimeout(render, 150); });
    $root.find('.na_kwt_recent').on('change', render);
    render();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: false, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// ---------------------------------------------------------------- extra injected blocks

function knowledgeRows(m) {
    return String(m?.knowledge || '').split('\n').map(l => l.replace(/^\s*[-*]\s*/, '').trim()).filter(l => l.includes('|')).map(l => {
        const parts = l.split('|').map(x => x.trim());
        const field = name => { const p = parts.find(x => x.toLowerCase().startsWith(`${name}:`)); return p ? p.slice(name.length + 1).split(',').map(x => x.trim()).filter(x => x && !/^(none|-|없음)$/i.test(x)) : []; };
        return { fact: parts[0], knows: field('knows'), unaware: field('unaware'), suspects: field('suspects'), src: (parts.find(x => x.toLowerCase().startsWith('src:')) || '').slice(4).trim() };
    }).filter(r => r.fact);
}

const knowLine = r => `${r.fact} | knows: ${r.knows.join(', ') || 'none'} | unaware: ${r.unaware.join(', ') || 'none'} | suspects: ${r.suspects.join(', ') || 'none'}${r.src ? ` | src: ${r.src}` : ''}`;

// Who is in the story now: the STATE block's "## Name" headings and names in the last few numbered sections
// (not STATE's prose, which mentions old characters in passing). Used to keep "unaware / suspects" to people
// who could actually slip — not everyone who ever appeared.
function currentCast(m, recent = 4) {
    const text = String(m.text || '');
    const state = tailBlocks(splitTail(text)[1]).filter(b => b.key === 'STATE').map(b => (b.text.match(/^## .*$/gm) || []).join('\n')).join('\n');
    const secs = parseSections(text).filter(x => !x.group && RANGE_HEAD.test(x.title)).slice(-recent);
    const cast = new Set(capWords(state + '\n' + secs.map(x => text.slice(x.start, x.end)).join('\n')));
    return cast.size >= 2 ? cast : null; // too little to judge: don't filter
}
// STATE's "## Name" headings that look like people (for telling the model who is in the story now)
function castNames(m) {
    const state = tailBlocks(splitTail(String(m.text || ''))[1]).filter(b => b.key === 'STATE').map(b => b.text).join('\n');
    return (state.match(/^## (.+)$/gm) || []).map(h => h.slice(3).trim())
        .filter(h => h.split(/\s+/).length <= 3 && !/^(relationships?|current|household|world|setting|places?|open|notes?|misc|other|status|state)\b/i.test(h));
}

const inCast = (cast, name) => !cast || [...cast].some(w => name.split(/\s+/).includes(w));

// names in unaware/suspects that are no longer in the story
function staleUnaware(m, cast = currentCast(m)) {
    if (!cast) return [];
    const out = new Set();
    for (const r of knowledgeRows(m)) for (const n of [...r.unaware, ...r.suspects]) if (!inCast(cast, n)) out.add(n);
    return [...out];
}

// dropEmpty (AI output only): a row nobody in the story is kept from has nothing to protect
function trimUnaware(text, cast, { dropEmpty = false } = {}) {
    return knowledgeRows({ knowledge: text })
        .map(r => cast ? { ...r, unaware: r.unaware.filter(n => inCast(cast, n)), suspects: r.suspects.filter(n => inCast(cast, n)) } : r)
        .filter(r => !dropEmpty || r.unaware.length || r.suspects.length)
        .map(knowLine).join('\n');
}

function extraBlocks(m) {
    let out = '';
    const castNow = currentCast(m);
    const kr = (m.knowInject ? knowledgeRows(m) : []).map(r => ({ ...r, unaware: r.unaware.filter(n => inCast(castNow, n)), suspects: r.suspects.filter(n => inCast(castNow, n)) }));
    if (kr.length) out += `\n\n# WHO KNOWS WHAT\n_Characters act only on what they know. Do not let anyone reveal or use a fact they do not know._\n${kr.map(r =>
        `- ${r.fact} — knows: ${r.knows.join(', ') || 'no one'}${r.unaware.length ? `; does not know: ${r.unaware.join(', ')}` : ''}${r.suspects.length ? `; suspects: ${r.suspects.join(', ')}` : ''}`).join('\n')}`;
    const vs = m.voiceInject && m.voice ? Object.entries(m.voice).filter(([who, v]) => String(v?.text || '').trim() && inCast(castNow, who) && !isExcluded(m, who)) : [];
    if (vs.length) out += `\n\n# VOICE NOTES\n_Writing notes for dialogue only. Follow them silently: never mention, quote or refer to these notes in the story._\n${vs.map(([who, v]) => `## ${who}\n${String(v.text).trim().replace(/^-\s*\[[^\]\n]{1,10}\]\s*/gm, '- ')}`).join('\n')}`;
    return out;
}

// ---------------------------------------------------------------- drift: does the recent chat contradict the archive?

const AI_SYS_DRIFT = `GOAL
Find places where the role-play model broke the story's established facts. The ARCHIVE is the record of what already happened; the RECENT CHAT is what was written since.

YOU GET
- ARCHIVE: the story so far. Its END (the latest sections, STATE and OPEN) is what is true right now.
- CURRENT CAST: the characters in the story right now.
- WHO KNOWS WHAT (sometimes): secrets, and who does not know them.
- RECENT CHAT: numbered messages. Messages marked USER are written by the user.

WHO TO CHECK
- Check only messages WITHOUT the USER mark. USER messages are the user's own choices: they may add new facts and are never mistakes.
- Check only characters in the CURRENT CAST or who actually appear in the recent chat. Ignore everyone else.

REPORT ONLY THESE (a clear clash with something the archive actually says)
1. FACT: a name, relationship, injury, object, place, or who-did-what that contradicts the archive.
    e.g. the archive says Ren's left arm is broken; the chat has her lifting a crate with her left arm.
2. SECRET: a character says or uses something they do not know (see WHO KNOWS WHAT, or it is clear from the archive).
    e.g. Mara does not know about Ivo's deal, but in the chat she mentions it.
3. SETTLED: something the archive marks as decided or resolved is undone or reopened with no reason in the chat.
    e.g. STATE says the two have stopped fighting over the house; the chat restarts that fight as if new.
4. TIME/PLACE: time of day or the calendar goes backwards, or one character is in two places at once.
5. CHARACTER: a character clearly acts or talks against what the archive says about them.
    e.g. STATE says Ivo no longer gives Ren orders; in the chat he orders her around with no reason.

DO NOT REPORT
- New events, new places, new feelings: the story moving forward is not a mistake.
- Things the archive simply does not mention.
- Style, pacing, length, or "could be better".
- Anything you are not sure about. If unsure, leave it out.

OUTPUT: Korean, one bullet per problem, exactly like this
- #<message number> <character>: <what clashes> — 근거 [[<archive section heading, copied exactly>]]
Example:
- #612 Ivo: 렌에게 명령조로 말함. 더는 명령하지 않기로 했음 — 근거 [[STATE AT #600 (…)]]
If there is no problem, write exactly: 없음`;

function recentForCheck(n) {
    const chat = ctx().chat || [];
    const out = [];
    for (let i = chat.length - 1; i >= 0 && out.length < n; i--) {
        const x = chat[i];
        if (!x || (x.is_system && !x.is_user && !x.name)) continue;
        out.unshift(`[#${i}${x.is_user ? ' · USER' : ''}] ${x.name || (x.is_user ? 'User' : 'Char')}: ${cleanMessage(String(x.mes || ''), { stripTags: true })}`);
    }
    return out;
}

async function runDrift(m, n) {
    const recent = recentForCheck(n);
    if (!recent.length) throw new Error('검사할 메시지가 없어요');
    const kr = knowledgeRows(m);
    const cast = castNames(m);
    const prompt = `[ARCHIVE]\n${m.text}${cast.length ? `\n\n[CURRENT CAST]\n${cast.join(', ')}` : ''}${kr.length ? `\n\n[WHO KNOWS WHAT]\n${extraBlocks({ ...m, knowInject: true }).trim()}` : ''}\n\n[RECENT CHAT]\n${recent.join('\n\n')}`;
    const out = await askAI(prompt, { system: AI_SYS_DRIFT, maxTokens: 2500 });
    const none = /^\s*(없음|none)\.?\s*$/i.test(out);
    m.driftLast = { at: Date.now(), n: none ? 0 : out.split('\n').filter(l => /^\s*[-*•]/.test(l)).length || 1, none, text: out, upto: lastIndex(), count: recent.length };
    await saveMeta();
    syncPanel();
    return m.driftLast;
}

// "#123" in a drift answer opens that message; [[heading]] shows the section
function driftHtml(text, m) {
    const secs = parseSections(m.text);
    // mark message numbers outside [[citations]] first, so headings inside citations stay intact
    const marked = String(text).split(/(\[\[[^\]]+\]\])/).map((part, i) => i % 2 ? part : part.replace(/(^|[^\w&#])#(\d{1,6})\b/g, '$1\u0001$2\u0001')).join('');
    const { html } = renderAnswer(marked, secs);
    return html.replace(/\u0001(\d+)\u0001/g, (all, n) => `<button type="button" class="na_cite na_cite_msg" data-msg="${n}" title="메시지 #${n} 보기">#${n}</button>`);
}

// one card per "- #57 Set: … — 근거 [[…]]" line; anything else falls back to the plain rendering
function driftCards(text, m) {
    const secs = parseSections(m.text);
    const lines = String(text).split('\n').map(l => l.trim()).filter(l => /^[-*•]/.test(l));
    if (!lines.length) return `<div class="na_v2_card">${driftHtml(text, m)}</div>`;
    return lines.map(l => {
        const mt = l.match(/^[-*•]\s*#(\d+)\s+([^:：]{1,40})[:：]\s*(.+?)(?:\s*[—–-]\s*근거\s*((?:\[\[[^\]]+\]\][\s,]*)+))?\s*$/);
        if (!mt) return `<div class="na_v2_card na_dr2_item">${driftHtml(l, m)}</div>`;
        const ev = mt[4] ? renderAnswer(mt[4], secs).html : '';
        return `
          <div class="na_v2_card na_dr2_item">
            <div class="na_dr2_head"><button type="button" class="na_cite na_cite_msg na_dr2_msg" data-msg="${mt[1]}" title="메시지 #${mt[1]} 보기">#${mt[1]}</button><b>${esc(mt[2].trim())}</b></div>
            <div class="na_dr2_text">${esc(mt[3])}</div>
            ${ev ? `<div class="na_dr2_ev"><i class="fa-solid fa-bookmark"></i><div>${ev}</div></div>` : ''}
          </div>`;
    }).join('');
}

async function openDrift() {
    const c = ctx();
    const m = getMeta();
    const $root = $(`
      <div class="na_popup na_v2 na_dr2">
        <div class="na_v2_title"><b>이탈 감지</b><small>RP 모델이 정해진 사실과 어긋나게 쓴 곳 · 참고용이고 아무것도 바꾸지 않아요</small></div>
        <div class="na_v2_card na_dr2_ctl">
          <div class="na_dr2_row"><span>최근 메시지</span><span class="na_fd_step"><button type="button" class="na_fd_btn na_dr2_dec" aria-label="줄이기">−</button><input type="number" class="text_pole na_dr_n" min="2" max="60" value="12"><button type="button" class="na_fd_btn na_dr2_inc" aria-label="늘리기">+</button></span><span>개</span></div>
          <button type="button" class="na_v2_btn primary wide na_dr_go"><i class="fa-solid fa-route"></i> 검사하기</button>
          <small class="na_v2_note na_dr_info"></small>
        </div>
        <div class="na_dr_out na_dr2_out"></div>
      </div>`);
    const show = d => {
        if (!d) return;
        const n = d.none ? 0 : String(d.text).split('\n').filter(l => /^\s*[-*•]/.test(l)).length;
        $root.find('.na_dr_out').html(d.none
            ? `<div class="na_v2_label"><span>검사 결과</span><small>${esc(timeLabel(d.at))} · #${d.upto}까지 ${d.count}개</small></div><div class="na_v2_card na_dr2_ok"><i class="fa-solid fa-circle-check"></i> 어긋난 곳이 없어요</div>`
            : `<div class="na_v2_label"><span>어긋난 곳${n ? ` ${n}개` : ''}</span><small>${esc(timeLabel(d.at))} · #${d.upto}까지 ${d.count}개</small></div>${driftCards(d.text, m)}`);
    };
    $root.find('.na_dr2_dec, .na_dr2_inc').on('click', function () { const $n = $root.find('.na_dr_n'); $n.val(Math.min(60, Math.max(2, (parseInt($n.val(), 10) || 12) + ($(this).hasClass('na_dr2_inc') ? 2 : -2)))); });
    countTokens(m.text).then(t => $root.find('.na_dr_info').text(`검사할 때마다 아카이브 전체(약 ${fmt(t)} 토큰)와 최근 메시지를 ${aiLabel()}에 보내요`));
    show(m.driftLast);
    $root.find('.na_dr_go').on('click', async function () {
        const n = Math.min(60, Math.max(2, parseInt($root.find('.na_dr_n').val(), 10) || 12));
        const d = await withSpinner($(this), '검사하는 중…', () => runDrift(m, n));
        if (d) show(d);
    });
    $root.on('click', '.na_cite_msg', function () { const n = Number(this.dataset.msg); openSource(n, n, `#${n}`); });
    $root.on('click', '.na_cite[data-start]', function () {
        const start = Number(this.dataset.start);
        $root.closest('dialog').find('.popup-button-ok').trigger('click');
        gotoSection(start);
    });
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// every N AI replies, check quietly; only speak up when something is off
const driftCount = new Map();
let driftBusy = false;
async function driftTick() {
    const every = Number(globalSettings().driftAuto) || 0;
    if (!every || !hasChat() || driftBusy) return;
    const m = getMeta();
    if (!m.text.trim()) return;
    const id = currentChatId();
    const k = (driftCount.get(id) || 0) + 1;
    driftCount.set(id, k);
    if (k < every) return;
    driftCount.set(id, 0);
    driftBusy = true;
    try {
        const d = await runDrift(m, Math.min(60, every + 2));
        if (!d.none) toastr.warning(`최근 대화에서 아카이브와 어긋난 곳 ${d.n}개 · 눌러서 보기`, '이탈 감지', { timeOut: 12000, onclick: () => openDrift() });
    } catch (e) { console.warn('[narrative-archive] auto drift', e); }
    finally { driftBusy = false; }
}

// ---------------------------------------------------------------- who knows what

// ---------------------------------------------------------------- section picker for AI tools
// A checklist of the archive's sections (groups with tri-state boxes, quick picks, ✓ for ones already read)
// that sends the chosen ones to onGo a few thousand tokens at a time, so the model reads every part.

const PICK_CHUNK_TOK = 6000;
const estTok = t => Math.ceil(String(t).length / 3.6);

function mountSectionPicker($host, { m, title, doneKeys, doneLabel = '읽음', goLabel, extraFoot = '', onGo }) {
    const $p = $(`
      <div class="na_sp" hidden>
        <div class="na_sp_head">
          <b>${esc(title)}</b>
          <span class="na_sp_quick">
            <button type="button" class="na_pchip" data-sel="new">안 읽은 것</button>
            <button type="button" class="na_pchip" data-sel="all">전체</button>
            <button type="button" class="na_pchip" data-sel="none">비우기</button>
          </span>
        </div>
        <div class="na_sp_secs"></div>
        ${extraFoot}
        <div class="na_sp_foot">
          <small class="na_dim na_sp_info"></small>
          <button type="button" class="na_btn na_small na_primary na_sp_go"><i class="fa-solid fa-wand-magic-sparkles"></i> ${esc(goLabel)}</button>
        </div>
      </div>`);
    $host.append($p);
    const allSecs = () => parseSections(m.text).filter(x => !x.group && x.title !== '(머리말)');
    let chosen = null;
    const chunk = secs => {
        const out = [];
        let cur = [], tok = 0;
        for (const x of secs) {
            const t = estTok(m.text.slice(x.start, x.end));
            if (cur.length && tok + t > PICK_CHUNK_TOK) { out.push(cur); cur = []; tok = 0; }
            cur.push(x); tok += t;
        }
        if (cur.length) out.push(cur);
        return out;
    };
    const selected = () => allSecs().filter(x => chosen.has(sectionKey(x)));
    const info = () => {
        const secs = selected();
        const tok = secs.reduce((a, x) => a + estTok(m.text.slice(x.start, x.end)), 0);
        const parts = chunk(secs).length;
        $p.find('.na_sp_info').text(secs.length ? `섹션 ${secs.length}개 · 약 ${fmt(tok)} 토큰${parts > 1 ? ` · ${parts}번에 나눠 읽어요` : ''}` : '섹션을 골라 주세요');
        $p.find('.na_sp_go').prop('disabled', !secs.length || busy);
        $p.find('.na_sp_g input').each(function () {
            const keys = String($(this).data('keys')).split('\u0002');
            const n = keys.filter(k => chosen.has(k)).length;
            this.checked = n === keys.length; this.indeterminate = n > 0 && n < keys.length;
        });
    };
    const draw = () => {
        const done = doneKeys();
        // "# ── Y1 ──" groups with their cards; top-level cards (title, STATE, OPEN) go in unlabeled runs
        const rows = [];
        let grp = { label: '', items: [] };
        const flush = () => { if (grp.items.length) rows.push(grp); };
        for (const x of parseSections(m.text)) {
            if (x.title === '(머리말)') continue;
            if (x.group) { flush(); grp = { label: groupLabel(x.title), items: [] }; continue; }
            if (x.level === 1 && grp.label) { flush(); grp = { label: '', items: [] }; }
            grp.items.push(x);
        }
        flush();
        $p.find('.na_sp_secs').html(rows.map(g => `
          <div class="na_sp_sg">
            ${g.label ? `<label class="na_sp_g"><input type="checkbox" data-keys="${esc(g.items.map(sectionKey).join('\u0002'))}"><b>${esc(g.label)}</b><small class="na_dim">${g.items.length}개</small></label>` : ''}
            ${g.items.map(x => `<label class="na_sp_s ${g.label ? '' : 'na_sp_s_top'}"><input type="checkbox" data-k="${esc(sectionKey(x))}" ${chosen.has(sectionKey(x)) ? 'checked' : ''}>
              <span>${esc(x.title)}</span>${done.has(sectionKey(x)) ? `<small class="na_sp_done"><i class="fa-solid fa-check"></i> ${esc(doneLabel)}</small>` : ''}</label>`).join('')}
          </div>`).join(''));
        info();
    };
    const select = how => {
        const done = doneKeys();
        chosen = new Set(allSecs().map(sectionKey).filter(k => how === 'all' || (how === 'new' && !done.has(k))));
        draw();
    };
    $p.on('click', '.na_sp_quick .na_pchip', function () { select($(this).data('sel')); });
    $p.on('change', '.na_sp_s input', function () { const k = String($(this).data('k')); this.checked ? chosen.add(k) : chosen.delete(k); info(); });
    $p.on('change', '.na_sp_g input', function () {
        String($(this).data('keys')).split('\u0002').forEach(k => this.checked ? chosen.add(k) : chosen.delete(k));
        $(this).closest('.na_sp_sg').find('.na_sp_s input').prop('checked', this.checked);
        info();
    });
    let busy = false;
    $p.find('.na_sp_go').on('click', async function () {
        const secs = selected();
        if (!secs.length || busy) return;
        const parts = chunk(secs);
        const $b = $(this), html = $b.html();
        busy = true; $b.prop('disabled', true);
        let done = 0;
        try {
            await onGo(parts, async (part, i, label) => { $b.html(`<i class="fa-solid fa-spinner fa-spin"></i> ${esc(label || `읽는 중… ${i + 1}/${parts.length}`)}`); }, () => { done++; draw(); });
        } catch (e) {
            console.error('[NarrativeArchive] AI', e);
            toastr.error(`${done}/${parts.length}까지 하고 멈췄어요: ${String(e?.message || e)}`, 'AI 요청 실패');
        } finally { busy = false; $b.html(html); info(); }
    });
    return {
        $el: $p,
        toggle(open = $p.prop('hidden')) {
            $p.prop('hidden', !open);
            if (open) { if (!chosen) select(doneKeys().size ? 'new' : 'all'); else draw(); }
            return open;
        },
        text: part => part.map(x => trimEnd(m.text.slice(x.start, x.end))).join('\n\n'),
    };
}

const AI_SYS_KNOW = `GOAL
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

const AI_SYS_KNOW_TIDY = `GOAL
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
async function tidyKnowledge(m) {
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

async function openKnowledge() {
    const c = ctx();
    const m = getMeta();
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div><h4>누가 아는가</h4><p>비밀·사실마다 누가 알고 누가 모르는지 정리해요. 주입을 켜면 RP 모델이 모르는 걸 아는 척하지 않게 같이 보내요.</p></div></div>
        <div class="na_tool_actions">
          <button type="button" class="na_btn na_small na_kn_ai"><i class="fa-solid fa-wand-magic-sparkles"></i> <span>AI로 만들기</span></button>
          <button type="button" class="na_btn na_small na_kn_tidy" title="겹치는 줄 합치기 · 끝 시점 기준으로 고치기 · 필요 없는 줄 빼기"><i class="fa-solid fa-broom"></i> AI로 다듬기</button>
          <button type="button" class="na_btn na_small na_kn_edit"><i class="fa-solid fa-pen"></i> 직접 고치기</button>
          <button type="button" class="na_btn na_small na_kn_tr"><i class="fa-solid fa-language"></i> 한국어로 보기</button>
          <button type="button" class="na_linkbtn na_danger na_kn_clear"><i class="fa-regular fa-trash-can"></i> 전체 삭제</button>
        </div>
        <div class="na_inject_strip">
          <label class="na_strip_item na_kn_inject"><input type="checkbox" class="na_toggle"><span>주입하기</span></label>
          <small class="na_dim na_kn_tok"></small>
        </div>
        <div class="na_kn_pickhost"></div>
        <div class="na_check na_check_soft na_kn_stale" hidden></div>
        <div class="na_kn_list"></div>
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
        $root.find('.na_kn_ai span').text(rows.length ? 'AI로 더하기·고치기' : 'AI로 만들기');
        $root.find('.na_kn_clear, .na_kn_tidy').prop('hidden', !String(m.knowledge || '').trim());
        const stale = staleUnaware(m);
        $root.find('.na_kn_stale').prop('hidden', !stale.length).html(stale.length
            ? `<i class="fa-solid fa-user-slash"></i><div class="na_kn_stale_txt">지금 이야기에 안 나오는 인물이 '모름'·'짐작'에 있어요: <b>${stale.map(esc).join(', ')}</b><small class="na_dim">STATE의 인물 제목과 최근 섹션 4개에 나오는 인물만 남겨요</small></div><button type="button" class="na_btn na_small na_kn_trim">빼기</button>` : '');
        $root.find('.na_kn_inject input').prop('checked', !!m.knowInject);
        $root.find('.na_kn_list').html(rows.length ? rows.map((r, i) => {
            const s = r.src ? findCited(secs(), r.src) : null;
            const chips = (xs, cls) => xs.map(x => `<span class="na_kn_who ${cls}">${esc(x)}</span>`).join('');
            return `<div class="na_kn_row" data-i="${i}">
              <button type="button" class="na_icon na_icon_sm na_kn_del" title="이 줄 삭제"><i class="fa-solid fa-xmark"></i></button>
              <div class="na_kn_fact">${esc(r.fact)}${tr?.[i] ? `<div class="na_kn_tr">${esc(tr[i])}</div>` : ''}</div>
              <div class="na_kn_people">${chips(r.knows, 'k')}${chips(r.suspects, 's')}${chips(r.unaware, 'u')}</div>
              ${s ? `<button type="button" class="na_cite" data-start="${s.start}" title="${esc(s.title)}"><i class="fa-solid fa-bookmark"></i> ${esc((s.title.match(/^(?:\S+\s+)?#\d+\s*[–—~-]\s*#?\d+/) || [s.title.slice(0, 24)])[0])}</button>` : ''}
            </div>`;
        }).join('') + '<div class="na_kn_legend na_dim"><span class="na_kn_who k">앎</span><span class="na_kn_who s">짐작</span><span class="na_kn_who u">모름</span></div>'
            : '<div class="na_empty">아직 없어요. AI로 만들거나 직접 적어 주세요.</div>');
        const blk = extraBlocks({ ...m, knowInject: true });
        if (blk) countTokens(blk).then(t => $root.find('.na_kn_tok').text(`약 ${fmt(t)} 토큰`)); else $root.find('.na_kn_tok').text('');
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
    $root.find('.na_kn_tr').on('click', async function () {
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

// ---------------------------------------------------------------- quote bank

// who says the quote that follows `before`: "Name:" → Name; "Name said/told …" → Name;
// "He told Name" → the first name earlier on the line (not the one being spoken to); else the nearest name
const SPEECH = 'said|says|told|tells|asked|asks|answered|replied|whispered|murmured|snapped|added|called|warned|admitted|insisted|thought|wrote';
function guessSpeaker(before, names) {
    const isName = w => names.has(w) && !KW_STOP.has(w);
    const colon = before.match(/([A-Z][a-z][A-Za-z'’]*)['’]?s?\s*:\s*$/);
    if (colon && isName(colon[1])) return colon[1];
    const verbs = [...before.matchAll(new RegExp(`\\b([A-Z][a-z][A-Za-z'’]*)\\s+(?:\\w+ly\\s+)?(?:${SPEECH})\\b`, 'g'))];
    const lastVerb = verbs[verbs.length - 1];
    if (lastVerb && isName(lastVerb[1])) return lastVerb[1];
    const all = [...before.matchAll(/\b([A-Z][a-z][A-Za-z'’]*)\b/g)].map(x => x[1].replace(/['’]s$/, '')).filter(isName);
    if (lastVerb && /^(He|She|They|It)$/.test(lastVerb[1])) {
        const head = before.slice(0, lastVerb.index);
        const earlier = [...head.matchAll(/\b([A-Z][a-z][A-Za-z'’]*)\b/g)].map(x => x[1].replace(/['’]s$/, '')).filter(isName);
        if (earlier.length) return earlier[earlier.length - 1];
    }
    return all.length ? all[all.length - 1] : '?';
}

// quoted lines in the archive with a guessed speaker
function archiveQuotes(m) {
    const names = new Set([...m.text.matchAll(/[a-z,;]\s+([A-Z][a-z][A-Za-z'’]*)/g)].map(x => x[1].replace(/['’]s$/, '')));
    const out = [];
    const secs = parseSections(m.text).filter(x => !x.group);
    for (const s of secs) {
        const body = m.text.slice(s.start, s.end);
        for (const line of body.split('\n')) {
            for (const mt of line.matchAll(/["“]([^"“”]{15,400})["”]/g)) {
                out.push({ who: guessSpeaker(line.slice(0, mt.index), names), text: mt[1].trim(), src: s.title });
            }
        }
    }
    const seen = new Set();
    return out.filter(q => !seen.has(q.text) && seen.add(q.text));
}

// characters the user never wants in the bank (e.g. their own persona)
const quoteExcluded = m => new Set((Array.isArray(m.quoteExclude) ? m.quoteExclude : []).map(x => String(x).toLowerCase()));
const isExcluded = (m, who) => quoteExcluded(m).has(String(who).toLowerCase());

// ticked lines, up to N per speaker, only for people in the story now (an absent character's voice is wasted tokens)

const AI_SYS_QUOTES = `GOAL
Collect VOICE SAMPLES for a role-play: lines in quotation marks that show HOW a character talks (their rhythm, word choice, attitude).
The user will pick from your list, so list every good one. Do not cut the list short.

YOU GET
SECTIONS of a story archive, written in the third person. Lines people said are inside quotation marks.

STEP 1. Read every section, all the way to the last one. Do not stop early.

STEP 2. For each quoted line, find who SAID it. Be careful, the archive is third person:
- The speaker is the one doing the speaking verb (said, told, asked, answered, whispered, swore, warned, thought…), NOT the person spoken to.
    "Ivo told Ren, \"…\"" → Ivo
    "Ren asked him, \"…\"" → Ren
- "she" / "he" / "they": look at the sentences around it to find who that is.
    "Mara turned to Ivo. She said, \"…\"" → Mara
- A name followed by a colon owns the line after it.
    "Ren: \"…\"" → Ren
- One bullet can quote two different people. Decide for each quote separately.
    "Ivo refused, \"…\"; Ren laughed, \"…\"" → first Ivo, second Ren
- A line someone repeats, reads out, or remembers from another person belongs to the person who first said it, and only if the archive makes that clear.
- If you cannot tell who said it, skip it. Never guess.

STEP 3. Keep only lines that are good voice samples. If SKIP THESE SPEAKERS is given, leave out every line by those speakers.
KEEP: lines that sound like that person and still make sense on their own.
SKIP:
- one- or two-word lines ("Yes." "Go.")
- lines that only explain the plot
- lines that make no sense without the scene around them
- labels, titles, names of places or things in quotation marks (those are not speech)

STEP 4. Copy each kept line EXACTLY as written in the archive: same words, same punctuation. Leave out the quotation marks. Never write new lines or fix the wording.

OUTPUT: nothing else, one line each, exactly like this
<speaker> | <the line>
Example:
Ivo | You can hate me tomorrow. Tonight you eat.
Ren | I'm not afraid of you, I'm afraid of the quiet.
Use the archive's own spelling of names. If there are no good lines, write exactly: none`;

// normalise a quote for matching against the archive
const quoteKey = t => String(t).replace(/[“”„"]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

// ---- voice fingerprint: a few speech rules per character, drawn from that character's lines in the quote bank
const AI_SYS_VOICE = `GOAL
Describe HOW one character talks, as short rules a writer can follow. Use only the LINES you are given.

YOU GET
- NAME: the character.
- LINES: things this character said in the story, one per line.

STEPS
1. Read all the LINES.
2. Find patterns that repeat in 2 or more lines:
   sentence length · how they address people (names, titles, pet names) · questions or orders · formal or casual ·
   favorite words or images · humor or none · what they avoid saying · how feelings come out (or don't).
3. Write each pattern as one rule that starts with a verb. Add a tiny example in quotes ONLY if it is copied exactly from the LINES.
   Put a TAG in square brackets before the rule: ONE short Korean word for the kind of pattern
   (길이 · 명령 · 질문 · 호칭 · 존댓말 · 반말 · 감정 · 유머 · 반복 · 말버릇 · 비유 · 금기 · 침묵).
4. Keep only rules that make this voice different from other people. Drop generic ones like "speaks naturally" or "is emotional".
5. Write 4 to 7 rules.

DO NOT
- Do not describe personality, looks, or story events. Only how they speak.
- Do not invent catchphrases that are not in the LINES.

EXAMPLE
NAME: Ivo
LINES:
Sit. Eat. We talk after.
You think I'd let you walk there alone? Funny.
Mara. Look at me. Breathe.
I said I'd come back. I came back.
Answer:
- [길이] Uses very short sentences, often two or three words ("Sit. Eat.").
- [명령] Gives orders instead of asking.
- [호칭] Says the other person's name alone before an important line ("Mara. Look at me.").
- [유머] Hides worry behind dry one-word sarcasm ("Funny.").
- [반복] Repeats his own words back to make a point ("I said I'd come back. I came back.").
- [감정] Never names his feelings out loud.

OUTPUT
Only the rules, one per line, each like: - [TAG] rule. The rule in English, the TAG in Korean. Nothing else.`;

async function makeVoice(m, who) {
    const lines = [...new Set((m.quotes || []).filter(q => q.who === who).map(q => q.text))].slice(0, 150);
    if (lines.length < 3) throw new Error(`${who}: 대사가 3개는 있어야 말투를 볼 수 있어요`);
    const out = await askAI(`NAME: ${who}\n\nLINES:\n${lines.join('\n')}`, { system: AI_SYS_VOICE, maxTokens: 1500 });
    const rules = out.split('\n').map(l => l.trim()).filter(l => /^[-*•]\s+\S/.test(l)).map(l => `- ${l.replace(/^[-*•]\s+/, '')}`);
    if (!rules.length) throw new Error(`${who}: 모델 답에서 규칙을 못 찾았어요`);
    m.voice = m.voice && typeof m.voice === 'object' ? m.voice : {};
    m.voice[who] = { text: rules.slice(0, 8).join('\n'), n: lines.length, at: Date.now() };
}

async function openQuotes() {
    const c = ctx();
    const m = getMeta();
    m.quotes = Array.isArray(m.quotes) ? m.quotes : [];
    const $root = $(`
      <div class="na_popup na_qb_root">
        <div class="na_v2_title"><b>대사 은행</b><small>모은 대사로 인물마다 말버릇 규칙(말투 지문)을 뽑아 조용히 주입해요</small></div>
        <div class="na_v2_tabs na_qb_tabs" role="tablist"><button type="button" data-p="quotes" class="on">대사 <span class="na_qb_nq"></span></button><button type="button" data-p="voice">말투 지문 <span class="na_qb_nv"></span></button></div>
        <div class="na_qb_pane" data-pane="voice" hidden><div class="na_v2 na_vc_body"></div></div>
        <div class="na_qb_pane na_v2 na_qb2" data-pane="quotes">
        <div class="na_v2_row2">
          <button type="button" class="na_v2_btn primary na_qb_ai"><i class="fa-solid fa-wand-magic-sparkles"></i> AI로 모으기</button>
          <button type="button" class="na_v2_btn na_qb_find"><i class="fa-solid fa-magnifying-glass"></i> 아카이브에서 모으기</button>
        </div>
        <div class="na_qb_pickhost"></div>
        <div class="na_search_wrap na_qb2_search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" class="text_pole na_search na_qb_q" placeholder="인물 · 대사로 찾기"></div>
        <div class="na_qb_excl">
          <span class="na_qb_excl_label">빼는 인물</span>
          <span class="na_qb_excl_chips"></span>
          <input type="text" class="text_pole na_qb_excl_in" placeholder="+ 이름" enterkeyhint="done">
          <button type="button" class="na_v2_pillbtn na_qb_excl_add">추가</button>
        </div>
        <div class="na_qb_list"></div>
        <button type="button" class="na_linkbtn na_danger na_qb_clear"><i class="fa-regular fa-trash-can"></i> 모은 대사 전체 삭제</button>
        </div>
      </div>`);
    // ---- 말투 지문 pane: one open card, the rest as rows; characters with enough lines but no fingerprint as dashed rows
    let vOpen = null, vEdit = null;
    const parseRule = l => {
        let t = l.replace(/^[-*•]\s*/, '').trim();
        const tag = (t.match(/^\[([^\]\n]{1,10})\]\s*/) || [, ''])[1];
        t = t.replace(/^\[[^\]\n]{1,10}\]\s*/, '');
        const ex = t.match(/\s*\(\s*((?:["“][^"”]+["”][\s.,…]*)+)\)\s*\.?\s*$/);
        return { tag, rule: ex ? t.slice(0, ex.index).replace(/[\s,]+$/, '') + '.' : t, ex: ex ? ex[1].trim() : '' };
    };
    const renderVoice = () => {
        const voice = m.voice && typeof m.voice === 'object' ? m.voice : {};
        const counts = new Map();
        for (const x of m.quotes) if (x.who && x.who !== '?' && !isExcluded(m, x.who)) counts.set(x.who, (counts.get(x.who) || 0) + 1);
        const whos = Object.keys(voice).sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
        const missing = [...counts].filter(([who, n]) => n >= 3 && !voice[who]).map(([who]) => who);
        vOpen = whos.includes(vOpen) ? vOpen : whos[0] || null;
        const $b = $root.find('.na_vc_body');
        $b.html(`
          <label class="na_v2_card na_v2_switchrow"><span class="na_vc_sw"><b>조용히 주입</b><small>“본문에서 언급하지 말 것”을 붙여 보내요<span class="na_vc_tok"></span></small></span><input type="checkbox" class="na_toggle na_vc_inject" ${m.voiceInject ? 'checked' : ''}></label>
          ${whos.map(who => { const v = voice[who], n = counts.get(who) || 0, rules = String(v.text || '').split('\n').map(l => l.trim()).filter(Boolean);
            if (who !== vOpen) return `<button type="button" class="na_v2_card na_vc_row" data-who="${esc(who)}">${faceHtml(who, 32)}<span class="na_vc_who"><b>${esc(who)}</b><small>규칙 ${rules.length}개</small></span><i class="fa-solid fa-chevron-right"></i></button>`;
            return `
            <div class="na_v2_card na_vc_card" data-who="${esc(who)}">
              <div class="na_vc_head">${faceHtml(who, 40)}<span class="na_vc_who"><b>${esc(who)}</b><small>대사 ${v.n || '?'}개로 만듦${v.n && v.n !== Math.min(150, n) ? ` · 지금 ${n}개` : ''}</small></span><button type="button" class="na_v2_pillbtn na_vc_make" ${n >= 3 ? '' : 'disabled'}><i class="fa-solid fa-rotate"></i> 다시</button></div>
              ${vEdit === who
                ? `<textarea class="text_pole na_vc_text" rows="${Math.min(10, rules.length + 2)}" spellcheck="false">${esc(v.text)}</textarea><small class="na_v2_note">한 줄에 규칙 하나 · 앞의 [태그]는 화면에만 보이고 주입할 땐 빠져요</small>`
                : `<div class="na_vc_rules">${rules.map(l => { const r = parseRule(l); return `<div class="na_vc_rule">${r.tag ? `<span class="na_vc_tag">${esc(r.tag)}</span>` : ''}<span><span>${esc(r.rule)}</span>${r.ex ? `<i>${esc(r.ex)}</i>` : ''}</span></div>`; }).join('')}</div>`}
              <div class="na_vc_foot"><button type="button" class="na_linkbtn na_vc_edit">${vEdit === who ? '그만 고치기' : '직접 고치기'}</button><button type="button" class="na_linkbtn na_danger na_vc_del">지우기</button></div>
            </div>`; }).join('')}
          ${missing.map(who => `<div class="na_v2_card na_vc_row dashed" data-who="${esc(who)}">${faceHtml(who, 32)}<span class="na_vc_who"><b>${esc(who)}</b><small>아직 없음 · 대사 ${counts.get(who)}개</small></span><button type="button" class="na_linkbtn na_vc_make">만들기</button></div>`).join('')}
          ${!whos.length && !missing.length ? '<div class="na_empty">대사가 3개 이상인 인물이 없어요. "대사" 탭에서 먼저 대사를 모아 주세요.</div>' : ''}
          ${missing.length > 1 ? `<button type="button" class="na_v2_btn primary wide na_vc_all"><i class="fa-solid fa-fingerprint"></i> 없는 지문 ${missing.length}개 한꺼번에 만들기</button>` : ''}
          <small class="na_v2_foot">AI 기능 모델(${esc(aiLabel())})이 그 인물 대사만 읽고 말버릇 규칙을 뽑아요</small>`);
        const blk = extraBlocks({ ...m, knowInject: false, voiceInject: true });
        if (blk) countTokens(blk).then(t => $b.find('.na_vc_tok').text(` · 약 ${fmt(t)} 토큰`));
    };
    const render = () => {
        const q = $root.find('.na_qb_q').val().trim().toLowerCase();
        const by = new Map();
        m.quotes.forEach((x, i) => { if (q && !`${x.who} ${x.text}`.toLowerCase().includes(q)) return; if (!by.has(x.who)) by.set(x.who, []); by.get(x.who).push({ x, i }); });
        const cast = currentCast(m);
        $root.find('.na_qb_clear').prop('hidden', !m.quotes.length);
        const ex = Array.isArray(m.quoteExclude) ? m.quoteExclude : [];
        $root.find('.na_qb_excl_chips').html(ex.length ? ex.map(n => `<span class="na_pchip na_qb_exchip">${esc(n)}<button type="button" class="na_qb_unex" data-n="${esc(n)}" title="다시 모으기">×</button></span>`).join('') : '<small class="na_dim">없음</small>');
        $root.find('.na_qb_nq').text(m.quotes.length || '');
        $root.find('.na_qb_nv').text(Object.keys(m.voice || {}).length || '');
        renderVoice();
        $root.find('.na_qb_list').html(by.size ? [...by].sort((a, b) => (a[0] === '?') - (b[0] === '?') || b[1].length - a[1].length).map(([who, xs]) => `
          <div class="na_qb_group ${who !== '?' && !inCast(cast, who) ? 'na_qb_away' : ''} ${who === '?' ? 'na_qb_unknown' : ''}"><div class="na_qb_who">${who === '?' ? '<span class="na_qb_qmark">?</span>' : faceHtml(who, 26)}<b>${esc(who === '?' ? '말한 사람 모름' : who)}</b><span class="na_dim">${xs.length}개</span>${m.voice?.[who] ? '<span class="na_qb_fp">지문 있음</span>' : ''}${who !== '?' && !inCast(cast, who) ? '<span class="na_qb_awaytag" title="STATE의 인물 제목과 최근 섹션 4개에 안 나와요. 다시 나오면 말투 지문이 자동으로 들어가요">지금 안 나옴</span>' : ''}
            <span class="na_qb_gbtns" data-who="${esc(who)}">
              ${who !== '?' ? '<button type="button" class="na_icon na_icon_sm na_qb_gexcl" title="이 인물 빼기 (대사 지우고 앞으로도 안 모음)"><i class="fa-solid fa-user-slash"></i></button>' : ''}
              ${xs.length ? '<button type="button" class="na_icon na_icon_sm na_qb_gdel" title="이 인물 대사 모두 지우기"><i class="fa-regular fa-trash-can"></i></button>' : ''}
            </span></div>
            <div class="na_qb_rows">${xs.map(({ x, i }) => `<div class="na_qb_row" data-i="${i}">
              <div class="na_qb_text">“${esc(x.text)}”<div class="na_dim na_qb_src">${esc(String(x.src || '').slice(0, 50))}</div></div>
              <input type="text" class="text_pole na_qb_whoin" value="${esc(x.who === '?' ? '' : x.who)}" placeholder="누구?" title="말한 사람">
              <button type="button" class="na_icon na_icon_sm na_qb_del" title="빼기" aria-label="빼기"><i class="fa-solid fa-xmark"></i></button>
            </div>`).join('')}</div></div>`).join('') : '<div class="na_empty">아직 없어요. "아카이브에서 모으기"를 눌러 보세요.</div>');
    };
    render();
    const save = async () => { await saveMeta(); applyInjection(); syncPanel(); render(); };
    $root.find('.na_qb_q').on('input', render);
    $root.on('click', '.na_qb_tabs button', function () {
        const p = this.dataset.p;
        $root.find('.na_qb_tabs button').each(function () { $(this).toggleClass('on', this.dataset.p === p); });
        $root.find('.na_qb_pane').each(function () { this.hidden = this.dataset.pane !== p; });
    });
    $root.on('change', '.na_vc_inject', async function () { m.voiceInject = this.checked; await save(); });
    $root.on('click', '.na_vc_row', function () { vOpen = String($(this).data('who')); vEdit = null; renderVoice(); });
    $root.on('click', '.na_vc_edit', function () { const who = String($(this).closest('.na_vc_card').data('who')); vEdit = vEdit === who ? null : who; renderVoice(); });
    $root.on('change', '.na_vc_text', async function () {
        const who = String($(this).closest('.na_vc_card').data('who'));
        const v = this.value.trim();
        if (v) m.voice[who] = { ...m.voice[who], text: v }; else delete m.voice[who];
        vEdit = null;
        await save();
    });
    $root.on('click', '.na_vc_del', async function () {
        const who = String($(this).closest('.na_vc_card').data('who'));
        if (!await confirm('말투 지문 지우기', `${who}의 말투 지문을 지울까요?`)) return;
        delete m.voice[who]; await save();
    });
    $root.on('click', '.na_vc_make', async function () {
        const who = String($(this).closest('[data-who]').data('who'));
        const ok = await withSpinner($(this), '만드는 중…', async () => { await makeVoice(m, who); return true; });
        if (ok) { vOpen = who; await save(); toastr.success(`${who}: 말투 지문을 만들었어요${m.voiceInject ? '' : '. "조용히 주입"을 켜면 RP 모델에 들어가요'}`); }
    });
    $root.on('click', '.na_vc_all', async function () {
        const counts = new Map();
        for (const x of m.quotes) if (x.who && x.who !== '?' && !isExcluded(m, x.who)) counts.set(x.who, (counts.get(x.who) || 0) + 1);
        const voice = m.voice || {};
        // only the missing ones, and the ones whose lines changed since
        const todo = [...counts].filter(([who, n]) => n >= 3 && (!voice[who] || voice[who].n !== Math.min(150, n))).map(([who]) => who);
        if (!todo.length) return toastr.info(counts.size ? '새로 만들 지문이 없어요. 인물 카드의 "다시"로 하나씩 다시 만들 수 있어요.' : '대사가 3개 이상인 인물이 없어요.');
        const $b = $(this);
        let done = 0;
        await withSpinner($b, '만드는 중…', async () => {
            for (const who of todo) { $b.html(`<i class="fa-solid fa-spinner fa-spin"></i> ${esc(who)} (${done + 1}/${todo.length})`); await makeVoice(m, who); done++; await saveMeta(); }
        });
        await save();
        if (done) toastr.success(`말투 지문 ${done}개를 만들었어요${m.voiceInject ? '' : '. "조용히 주입"을 켜면 RP 모델에 들어가요'}`);
    });
    $root.on('change', '.na_qb_whoin', async function () { m.quotes[Number($(this).closest('.na_qb_row').data('i'))].who = this.value.trim() || '?'; await save(); });
    $root.on('click', '.na_qb_del', async function () { m.quotes.splice(Number($(this).closest('.na_qb_row').data('i')), 1); await save(); });
    $root.find('.na_qb_clear').on('click', async () => {
        if (!await confirm('전체 삭제', `모은 대사 ${m.quotes.length}개를 모두 지울까요? 되돌릴 수 없어요. (아카이브 본문은 그대로예요)`)) return;
        m.quotes = []; m.quoteMined = [];
        await save();
        toastr.success('대사 은행을 비웠어요');
    });
    $root.find('.na_qb_find').on('click', async () => {
        const have = new Set(m.quotes.map(q => q.text));
        const found = archiveQuotes(m).filter(q => !have.has(q.text) && !isExcluded(m, q.who));
        if (!found.length) return toastr.info('새로 모을 대사가 없어요.');
        m.quotes.push(...found.map(q => ({ ...q, on: false })));
        await save();
        toastr.success(`${found.length}개 모았어요. 말한 사람은 짐작이라 틀릴 수 있어요. 고치거나 "AI로 모으기"를 써 보세요.`);
    });
    // lines the model returned → verified candidates (must appear verbatim in one of the sections it read)
    const readPicks = (out, secs) => {
        const bodies = secs.map(x => quoteKey(m.text.slice(x.start, x.end)));
        const picks = [], made = [];
        for (const line of out.split('\n')) {
            const mt = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').match(/^\[?([^|\]]{1,40}?)\]?\s*\|\s*(.+)$/);
            if (!mt) continue;
            const who = mt[1].trim(), text = mt[2].trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim();
            const k = quoteKey(text);
            if (!who || k.length < 4) continue;
            const at = bodies.findIndex(b => b.includes(k));
            if (at < 0) { made.push(text); continue; } // not in what it read: made up or changed
            picks.push({ who, text, src: secs[at].title });
        }
        return { picks, made };
    };
    // excluded characters: their lines are removed and never gathered or injected
    const exclude = async name => {
        name = String(name).trim();
        if (!name || name === '?') return;
        m.quoteExclude = [...new Set([...(m.quoteExclude || []), name])];
        const before = m.quotes.length;
        m.quotes = m.quotes.filter(q => !isExcluded(m, q.who));
        if (m.voice) for (const who of Object.keys(m.voice)) if (isExcluded(m, who)) delete m.voice[who];
        await save();
        toastr.success(`${name}: 빼는 인물로 정했어요${before - m.quotes.length ? ` · 대사 ${before - m.quotes.length}개 지움` : ''}`);
    };
    // mobile keyboards often send no "Enter" key (IME composing / keyCode 229), so take the button, Enter and change
    const addExcluded = async () => {
        const $in = $root.find('.na_qb_excl_in');
        const v = String($in.val() || '').trim();
        if (!v) return;
        $in.val('');
        for (const n of v.split(/[,，]/)) await exclude(n);
    };
    $root.find('.na_qb_excl_add').on('click', addExcluded);
    $root.find('.na_qb_excl_in').on('keydown', function (e) {
        if ((e.key === 'Enter' || e.keyCode === 13) && !e.isComposing) { e.preventDefault(); addExcluded(); }
    }).on('change', addExcluded);
    $root.on('click', '.na_qb_unex', async function () {
        const n = String($(this).data('n'));
        m.quoteExclude = (m.quoteExclude || []).filter(x => x !== n);
        await save();
    });
    $root.on('click', '.na_qb_gexcl', async function () {
        const who = String($(this).closest('.na_qb_gbtns').data('who'));
        if (!await confirm('인물 빼기', `${who}의 대사를 모두 지우고, 앞으로 모으거나 주입하지 않을까요? (위 "뺄 인물"에서 되돌릴 수 있어요)`)) return;
        await exclude(who);
    });
    $root.on('click', '.na_qb_gdel', async function () {
        const who = String($(this).closest('.na_qb_gbtns').data('who'));
        const n = m.quotes.filter(q => q.who === who).length;
        if (!await confirm('대사 지우기', `${who === '?' ? '말한 사람 모름' : who} 대사 ${n}개를 모두 지울까요? 되돌릴 수 없어요.`)) return;
        m.quotes = m.quotes.filter(q => q.who !== who);
        await save();
    });

    // AI gather: chosen sections a few at a time (a whole archive in one go makes models stop early)
    m.quoteMined = Array.isArray(m.quoteMined) ? m.quoteMined : [];
    const picker = mountSectionPicker($root.find('.na_qb_pickhost'), {
        m, title: 'AI가 읽을 섹션', goLabel: '모으기 시작', doneLabel: '모음',
        doneKeys: () => new Set(m.quoteMined),
        onGo: async (parts, step, stepDone) => {
            let added = 0, fixed = 0, made = 0, found = 0;
            try {
                for (const [i, part] of parts.entries()) {
                    await step(part, i);
                    const ex = Array.isArray(m.quoteExclude) ? m.quoteExclude : [];
                    const out = await askAI(`${ex.length ? `[SKIP THESE SPEAKERS]\n${ex.join(', ')}\n\n` : ''}[ARCHIVE SECTIONS]\n${picker.text(part)}`, { system: AI_SYS_QUOTES, maxTokens: 6000 });
                    const r = readPicks(out, part);
                    made += r.made.length; found += r.picks.length;
                    // candidates only: nothing gets ticked; lines already here just get the AI's speaker
                    for (const p of r.picks.filter(x => !isExcluded(m, x.who))) {
                        const q = m.quotes.find(x => quoteKey(x.text) === quoteKey(p.text));
                        if (q) { if (q.who !== p.who) { q.who = p.who; fixed++; } }
                        else { m.quotes.push({ ...p, on: false }); added++; }
                    }
                    m.quoteMined = [...new Set([...m.quoteMined, ...part.map(sectionKey)])];
                    await save();
                    stepDone();
                }
            } finally {
                if (found || made) toastr.success(`후보 ${found}개 · 새로 ${added}개${fixed ? ` · 말한 사람 ${fixed}개 고침` : ''}${made ? ` · 아카이브에 없는 ${made}개는 뺐어요` : ''}. 틀린 건 빼고 "말투 지문" 탭에서 지문을 만들어 보세요.`);
            }
        },
    });
    $root.find('.na_qb_ai').on('click', function () { $(this).toggleClass('active', picker.toggle()); });
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// ---------------------------------------------------------------- AI router
// Right before a reply, a small model reads the recent chat and picks the sections it needs.

const AI_SYS_ROUTER = `GOAL
A role-play model is about to write its NEXT reply. It cannot see the whole story archive, only the sections you pick.
Pick the sections it needs so it does not forget or contradict something.

YOU GET
- MAIN CAST: characters who are in almost every section. Their names alone are NOT a reason to pick a section.
- RECENT CHAT: the last messages. The one marked LATEST is what the next reply answers.
- SECTIONS: numbered. Each has a title, the other names in it (people, places, things), its keywords, and how it begins.

PICK A SECTION IF ANY OF THESE IS TRUE
1. Something from it is named or clearly meant in the recent chat: a person who is not main cast, a place, an object, an event.
   Watch for hints, not only exact names: "that night", "the cliff", "what you promised me", "your old life", a nickname.
2. The chat is about a promise, secret, wound, fight, rule or wish that started or changed in that section.
3. The next reply has to stay consistent with it: the chat goes back to a place, a habit, or a relationship moment described there.

DO NOT PICK
- A section just because a main cast character is in it.
- Sections that are only loosely related.
- More than the limit you are given.

HOW TO WORK
Step 1. Read the LATEST message first, then the others. List for yourself the people, places, objects, past events and promises they mention or hint at.
Step 2. Go through the sections one by one and match them against that list.
Step 3. Put the most important first. Fewer is better than wrong.

OUTPUT: exactly one line, nothing else
PICK: 3, 12, 7
If no section is needed:
PICK: none`;

const routerState = new Map(); // chat id → { key, picks: Set, titles, at, ms, cands }
let routerWarned = false;

function routerCfg(m) {
    const r = m?.router && typeof m.router === 'object' ? m.router : {};
    return { mode: ['linked', 'old'].includes(r.mode) ? r.mode : 'off', max: Number(r.max) || 4, keep: Number.isFinite(Number(r.keep)) && r.keep !== undefined ? Number(r.keep) : 3, follow: r.follow !== false };
}

// sections the router may switch on: keyword-linked ones, and in 'old' mode every numbered section except the newest few and pinned ones
function routerCandidates(m) {
    const cfg = routerCfg(m);
    if (cfg.mode === 'off') return [];
    const secs = parseSections(m.text);
    const muted = mutedSet(m), pinned = pinnedSet(m), lm = linkedMap(m);
    const ranged = secs.filter(x => !x.group && RANGE_HEAD.test(x.title));
    const recent = new Set(ranged.slice(ranged.length - cfg.keep).map(sectionKey));
    const out = [], stack = [];
    for (const s of secs) {
        while (stack.length && stack[stack.length - 1].level >= s.level) stack.pop();
        if (s.group) { stack.push(s); continue; }
        const key = sectionKey(s);
        if (muted.has(key) || stack.some(g => muted.has(sectionKey(g)))) continue;
        const linked = Array.isArray(lm[key]) && lm[key].length;
        const safe = pinned.has(key) || stack.some(g => pinned.has(sectionKey(g)));
        if (linked || (cfg.mode === 'old' && RANGE_HEAD.test(s.title) && !recent.has(key) && !safe)) out.push(s);
    }
    return out;
}

function routerReady() {
    const a = connSettings('ai');
    return a.mode === 'custom' || a.mode === 'vertex' || !!globalSettings().aiProfile;
}

async function runRouter(m, { force = false } = {}) {
    const cfg = routerCfg(m);
    if (cfg.mode === 'off') return null;
    if (!routerReady()) throw new Error('라우터는 RP와 따로 연결한 모델이 필요해요 (⚙ 설정 → AI · 번역 → 모델에서 프로필·커스텀 API·Vertex)');
    const cands = routerCandidates(m);
    const id = currentChatId();
    const recent = recentForCheck(4).join('\n\n').slice(-6000);
    const key = shortHash(`${recent}|${cands.map(sectionKey).join('|')}|${cfg.max}`);
    const prev = routerState.get(id);
    if (!force && prev?.key === key) return prev; // a swipe or regenerate on the same chat
    if (!cands.length) { const st = { key, picks: new Set(), titles: [], at: Date.now(), ms: 0, cands: 0 }; routerState.set(id, st); return st; }
    // each candidate: title, the names in it other than the main cast, its keywords, and how it begins
    const main = castNames(m);
    const mainSet = new Set(main.flatMap(n => n.split(/\s+/)));
    const lm = linkedMap(m);
    const list = cands.map((s, i) => {
        const body = m.text.slice(s.start, s.end).replace(/^#{1,3} [^\n]*\n?/, '');
        const counts = new Map();
        // capitalised words in mid-sentence only, so sentence openers ("Inside", "Asked") don't pass as names
        [...body.matchAll(/[a-z0-9,;:]\s+([A-Z][a-z][A-Za-z'’]*)/g)].map(x => x[1].replace(/['’]s$/, ''))
            .filter(w => w.length > 2 && !KW_STOP.has(w) && !mainSet.has(w)).forEach(w => counts.set(w, (counts.get(w) || 0) + 1));
        const names = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0]);
        const keys = Array.isArray(lm[sectionKey(s)]) ? lm[sectionKey(s)] : [];
        const flat = body.replace(/\s+/g, ' ').trim();
        return `${i + 1}. ${s.title}${names.length ? `\n   names: ${names.join(', ')}` : ''}${keys.length ? `\n   keywords: ${keys.join(', ')}` : ''}\n   begins: ${flat.slice(0, 220)}${flat.length > 220 ? '…' : ''}`;
    }).join('\n');
    const recentLines = recent.split('\n\n');
    if (recentLines.length) recentLines[recentLines.length - 1] = recentLines[recentLines.length - 1].replace(/^\[#(\d+)/, '[#$1 · LATEST');
    const t0 = Date.now();
    const out = await Promise.race([
        askAI(`${main.length ? `[MAIN CAST]\n${main.join(', ')}\n\n` : ''}[RECENT CHAT]\n${recentLines.join('\n\n')}\n\n[SECTIONS]\n${list}\n\nPick at most ${cfg.max}.`, { system: AI_SYS_ROUTER, maxTokens: 1024 }),
        new Promise((_, no) => setTimeout(() => no(new Error('20초 안에 답이 없었어요')), 20_000)),
    ]);
    // read the "PICK:" line if there is one (so numbers in any reasoning are ignored), else the whole answer
    const pickLine = (out.match(/PICK\s*:\s*(.*)$/im) || [null, out])[1];
    const nums = /^\s*none\b/i.test(pickLine) ? [] : [...new Set((pickLine.match(/\d+/g) || []).map(Number))].filter(n => n >= 1 && n <= cands.length).slice(0, cfg.max);
    const picked = nums.map(n => cands[n - 1]);
    const st = { key, picks: new Set(picked.map(sectionKey)), titles: picked.map(s => s.title), at: Date.now(), ms: Date.now() - t0, cands: cands.length };
    routerState.set(id, st);
    return st;
}

// ---------------------------------------------------------------- compression wizard
// The whole routine in one place; the last step hands the pasted text to "아카이브에 추가" with its checks.

const AI_SYS_GRADE = `GOAL
Check a SUMMARY of a role-play log against the RAW LOG it was made from, so nothing wrong goes into the story archive.

YOU GET
- RAW LOG: the original messages. Each starts with its number in brackets, like [512], and the speaker's name.
- SUMMARY: section blocks ("## #from–#to — title" with bullet points). It may end with STATE and OPEN blocks.

HOW TO WORK
Step 1. Read the whole RAW LOG, to the last message.
Step 2. Go through the SUMMARY one bullet at a time. For each bullet, find the messages it is based on.
Step 3. Then go through the RAW LOG again and look for important things the SUMMARY never mentions.

REPORT ONLY THESE
1. 지어냄 (made up): a fact, event, line or detail in the SUMMARY that is not in the RAW LOG.
    e.g. the summary says Ren cried; in the log she only went quiet.
2. 틀림 (wrong): it is in the log but the summary gets it wrong: wrong person, wrong speaker of a quote, wrong order, wrong place or time, a quote with changed words, or a heading whose #from–#to does not match the messages.
    e.g. the summary says Ivo said "…", but in the log Mara said it.
3. 빠짐 (missing): an important event, decision, promise, confession, secret revealed, injury, or change in a relationship that the SUMMARY leaves out.
    Small talk, repeated actions and atmosphere are NOT important.

DO NOT REPORT
- wording, style, length, or how something could be phrased better
- the summary being shorter than the log: shortening is its job
- STATE and OPEN facts that come from before this log (they carry over from the archive); only check what they say about events in this log
- anything you are not sure about

OUTPUT: Korean, one bullet per problem, most serious first, exactly like this
- 지어냄: <what is wrong> (#<message number>)
- 틀림: <what is wrong, and what the log really says> (#<message number>)
- 빠짐: <what is missing> (#<message number>)
Always give the message number(s) you checked. If the summary is faithful, write exactly: 문제 없음`;

async function openWizard() {
    const c = ctx();
    const m = getMeta();
    const g = globalSettings();
    const last = (c.chat?.length || 0) - 1;
    const le = m.lastExport;
    const after = Math.max(m.boundary, le && le.to <= last ? le.to : -1);
    const defFrom = Math.min(after + 1, Math.max(0, last));
    const defTo = Math.max(defFrom, last - Math.max(0, Number(m.keep) || 0));
    const STEPS = [
        { name: '범위', title: '어디부터 어디까지<br>압축할까요?', sub: '경계선 다음부터 자동으로 채웠어요' },
        { name: '복사', title: '압축할 모델에<br>넘겨 주세요', sub: '지시문과 함께 복사하거나 .txt로 저장해요' },
        { name: '붙여넣기', title: '모델이 준 섹션을<br>붙여넣어 주세요', sub: '파일(.txt · .md)도 돼요' },
        { name: '채점', title: '원문과 맞는지<br>볼까요?', sub: '선택 · 지어낸 것·빠진 것·틀린 것을 찾아요' },
        { name: '추가', title: '검사하고<br>아카이브에 넣어요', sub: '번호 검사 · 미리보기를 거쳐 추가하고 끝 번호까지 숨겨요' },
    ];
    let step = 0;
    const $root = $(`
      <div class="na_popup na_v2 na_wiz2">
        <div class="na_wz2_top"><b>압축 마법사</b><span class="na_wz2_count"></span></div>
        <div class="na_wz2_progress">${STEPS.map((x, i) => `<button type="button" data-s="${i}"><i></i><span>${x.name}</span></button>`).join('')}</div>
        <div class="na_wz2_head"><b class="na_wz2_title"></b><small class="na_wz2_sub"></small></div>
        <div class="na_wz2_pane" data-s="0">
          <div class="na_wz2_range">
            <label><small>부터</small><span>#<input type="number" class="text_pole na_wz_from" min="0" max="${last}" value="${defFrom}"></span></label>
            <i class="fa-solid fa-arrow-right"></i>
            <label><small>까지</small><span>#<input type="number" class="text_pole na_wz_to" min="0" max="${last}" value="${defTo}"></span></label>
          </div>
          <label class="na_v2_card na_v2_switchrow"><span>숨긴 메시지 빼기</span><input type="checkbox" class="na_toggle na_wz_hidden"></label>
          <small class="na_v2_note na_wz_info"></small>
        </div>
        <div class="na_wz2_pane" data-s="1">
          <select class="text_pole na_wz_prompt"></select>
          <div class="na_v2_row2"><button type="button" class="na_v2_btn na_wz_save"><i class="fa-solid fa-download"></i> .txt 저장</button><button type="button" class="na_v2_btn primary na_wz_copy"><i class="fa-solid fa-copy"></i> <span>복사</span></button></div>
          <small class="na_v2_note na_wz_copied"></small>
        </div>
        <div class="na_wz2_pane" data-s="2">
          <textarea class="text_pole na_wz_out" rows="10" spellcheck="false" placeholder="## #시작–#끝 — 제목 (날짜, 장소)&#10;PLOT:&#10;- …"></textarea>
          <div class="na_wz2_chips na_wz_outinfo"></div>
          <div class="na_v2_row2">
            <button type="button" class="na_v2_btn na_wz_file_btn"><i class="fa-solid fa-file-arrow-up"></i> 파일 불러오기</button>
            ${draftReady() ? `<button type="button" class="na_v2_btn na_wz_draftbtn" title="${esc(drLabel())}"><i class="fa-solid fa-feather-pointed"></i> 초안 모델로 받기</button>` : ''}
          </div>
          <input type="file" class="na_wz_file" accept=".txt,.md,.markdown,text/plain,text/markdown" hidden>
        </div>
        <div class="na_wz2_pane" data-s="3">
          <button type="button" class="na_v2_btn wide na_wz_grade"><i class="fa-solid fa-clipboard-check"></i> AI로 채점</button>
          <div class="na_ai_box na_wz_gradeout" hidden></div>
        </div>
        <div class="na_wz2_pane" data-s="4">
          <div class="na_v2_card na_wz2_sum"></div>
        </div>
        <span class="na_wz2_fill"></span>
        <div class="na_wz2_nav">
          <button type="button" class="na_v2_btn na_wz2_prev">이전</button>
          <button type="button" class="na_v2_btn primary na_wz2_next"></button>
        </div>
        <button type="button" class="na_linkbtn na_wz2_skip">채점 건너뛰고 바로 추가</button>
      </div>`);
    const nextLabel = ['다음 · 복사', '다음 · 붙여넣기', '다음 · 채점', '다음 · 추가', '아카이브에 추가 창 열기'];
    const show = () => {
        $root.find('.na_wz2_count').text(`${step + 1} / ${STEPS.length}`);
        $root.find('.na_wz2_progress button').each(function () { const i = Number(this.dataset.s); $(this).toggleClass('done', i < step).toggleClass('on', i === step); });
        $root.find('.na_wz2_title').html(STEPS[step].title);
        $root.find('.na_wz2_sub').text(STEPS[step].sub);
        $root.find('.na_wz2_pane').each(function () { this.hidden = Number(this.dataset.s) !== step; });
        $root.find('.na_wz2_prev').prop('hidden', step === 0);
        $root.find('.na_wz2_next').text(nextLabel[step]);
        $root.find('.na_wz2_skip').prop('hidden', step !== 2 && step !== 3);
        if (step === 4) {
            const v = $root.find('.na_wz_out').val().trim(), n = guessEndNumber(v), r = range();
            $root.find('.na_wz2_sum').html(`<div class="na_wz2_sumrow"><span>범위</span><b>#${r.from} – #${r.to}</b></div><div class="na_wz2_sumrow"><span>새 섹션</span><b>${parseSections(v).filter(x => !x.group && !/^(?:STATE|OPEN)\b/.test(x.title)).length}개</b></div><div class="na_wz2_sumrow"><span>끝 번호</span><b>${n !== null ? `#${n}` : '추가 창에서 정해요'}</b></div>`);
        }
    };
    const go = to => {
        if (to > 2 && !$root.find('.na_wz_out').val().trim()) { step = 2; show(); return toastr.info('먼저 모델이 준 결과를 붙여넣어 주세요.'); }
        step = Math.max(0, Math.min(STEPS.length - 1, to)); show();
    };
    $root.on('click', '.na_wz2_progress button', function () { go(Number(this.dataset.s)); });
    $root.find('.na_wz2_prev').on('click', () => go(step - 1));
    $root.find('.na_wz2_next').on('click', () => { if (step === STEPS.length - 1) $root.find('.na_wz_add').trigger('click'); else go(step + 1); });
    $root.find('.na_wz2_skip').on('click', () => go(4));
    $root.append('<button type="button" class="na_wz_add" hidden></button>');
    // last choice is remembered; "__none" copies the raw log only
    $root.find('.na_wz_prompt').html(`<option value="__none">지시문 없이 (원문만)</option>${g.prompts.map(p => `<option value="${esc(p.id)}">지시문: ${esc(p.name)}${p.fav ? ' ★' : ''}</option>`).join('')}`)
        .val(g.prompts.some(p => p.id === g.wizPrompt) ? g.wizPrompt : '__none'); // default: raw only
    $root.find('.na_wz_prompt').on('change', function () { g.wizPrompt = this.value; saveGlobal(); });
    // shared with 압축 → 설정 → 원문 뽑기
    $root.find('.na_wz_hidden').prop('checked', !!g.skipHidden).on('change', function () { g.skipHidden = this.checked; saveGlobal(); renderPromptSettings(); build(); });
    const range = () => {
        const from = Math.max(0, parseInt($root.find('.na_wz_from').val(), 10) || 0);
        const to = Math.min(last, parseInt($root.find('.na_wz_to').val(), 10));
        return { from, to: Number.isFinite(to) ? to : last };
    };
    let raw = '', full = '';
    const build = async () => {
        const { from, to } = range();
        const all = buildExtract(from, to);
        const hiddenOut = g.skipHidden ? all.filter(x => c.chat[x.i]?.is_system).length : 0;
        const items = all.filter(x => !(g.skipHidden && c.chat[x.i]?.is_system)).map(x => ({ ...x, text: cleanMessage(x.text, g) })).filter(x => x.text);
        raw = formatExtract(items, g);
        const pid = $root.find('.na_wz_prompt').val();
        const p = pid === '__none' ? null : (g.prompts.find(x => x.id === pid) || activePrompt(g));
        full = p ? fillPrompt(p.text, { raw, from: String(from), to: String(to), last_section: referenceSection(m.text), state: splitTail(m.text)[1].trim() || '(없음)', archive: m.text }) : raw;
        $root.find('.na_wz_copy span').text(p ? '지시문과 함께 복사' : '원문만 복사');
        $root.find('.na_wz_info').text(items.length ? `메시지 ${items.length}개${hiddenOut ? ` (숨긴 ${hiddenOut}개 뺌)` : ''} · 원문 약 ${fmt(await countTokens(raw))} 토큰${p ? ` · 지시문까지 약 ${fmt(await countTokens(full))} 토큰` : ''}` : '이 범위에 메시지가 없어요.');
    };
    let t;
    $root.find('.na_wz_from, .na_wz_to, .na_wz_prompt').on('input change', () => { clearTimeout(t); t = setTimeout(build, 250); });
    const remember = async how => { const { from, to } = range(); m.lastExport = { from, to, at: Date.now(), how }; await saveMeta(); refreshStatus(); };
    $root.find('.na_wz_copy').on('click', async () => {
        await build();
        if (!raw) return toastr.info('범위에 메시지가 없어요.');
        const ok = await copyText(full, $root.find('.na_wz_out')[0]);
        if (ok) { await remember('copy'); $root.find('.na_wz_copied').text(`복사했어요 · ${timeLabel(Date.now())}`); toastr.success('복사됨 · 압축할 모델에 붙여넣으세요'); } else toastr.warning('복사가 막혀 있어요. .txt 저장을 써 주세요.');
    });
    $root.find('.na_wz_draftbtn').on('click', async function () {
        await build();
        if (!raw) return toastr.info('범위에 메시지가 없어요.');
        const $out = $root.find('.na_wz_out');
        if ($out.val().trim() && !await confirm('초안 모델로 받기', '붙여넣은 내용을 새 초안으로 바꿀까요?')) return;
        // the draft always carries an instruction: the chosen one, or the active one when "raw only" is picked
        const { from, to } = range();
        const pid = $root.find('.na_wz_prompt').val();
        const p = g.prompts.find(x => x.id === pid) || activePrompt(g);
        const prompt = fillPrompt(p.text, { raw, from: String(from), to: String(to), last_section: referenceSection(m.text), state: splitTail(m.text)[1].trim() || '(없음)', archive: m.text });
        const out = await withSpinner($(this), '쓰는 중… 창을 닫지 마세요', () => askDraft(prompt));
        if (out === null) return;
        $out.val(out.replace(/^```[a-z]*\n?|```\s*$/g, '').trim()).trigger('input');
        await remember('draft');
        toastr.success('초안을 채웠어요. 확인하고 다음으로 넘어가세요.');
    });
    $root.find('.na_wz_save').on('click', async () => { await build(); if (!raw) return; const { from, to } = range(); download(`원문_${chatLabel()}_${from}-${to}.txt`, full); remember('txt'); });
    $root.find('.na_wz_file_btn').on('click', () => $root.find('.na_wz_file').val('').trigger('click'));
    $root.find('.na_wz_file').on('change', async function () {
        const file = this.files?.[0];
        if (!file) return;
        const text = (await file.text()).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
        if (!text) return toastr.warning('빈 파일이에요.');
        const $out = $root.find('.na_wz_out');
        if ($out.val().trim() && !await confirm('불러오기', '붙여넣은 내용을 이 파일 내용으로 바꿀까요?')) return;
        $out.val(text).trigger('input');
        toastr.success(`불러옴: ${file.name}`);
    });
    $root.find('.na_wz_out').on('input', function () {
        const v = this.value.trim();
        const n = guessEndNumber(v);
        const secsN = parseSections(v).filter(x => !x.group && !/^(?:STATE|OPEN)\b/.test(x.title)).length, hasState = /^# STATE\b/m.test(v);
        countTokens(v).then(tk => $root.find('.na_wz_outinfo').html(v ? `<span class="${secsN ? 'ok' : ''}">${secsN ? '<i class="fa-solid fa-check"></i> ' : ''}섹션 ${secsN}개${n !== null ? ` · 끝 #${n}` : ''}</span>${hasState ? '<span class="ok"><i class="fa-solid fa-check"></i> STATE·OPEN</span>' : ''}<span>${fmt(tk)} 토큰</span>` : ''));
        $root.find('.na_wz_gradeout').prop('hidden', true);
    });
    $root.find('.na_wz_grade').on('click', async function () {
        const sum = $root.find('.na_wz_out').val().trim();
        if (!sum) return toastr.info('먼저 결과를 붙여넣어 주세요.');
        await build();
        const out = await withSpinner($(this), '채점하는 중…', () => askAI(`[RAW LOG]\n${raw}\n\n[SUMMARY]\n${sum}`, { system: AI_SYS_GRADE, maxTokens: 2500 }));
        if (out === null) return;
        const ok = /^\s*문제 없음\.?\s*$/.test(out);
        $root.find('.na_wz_gradeout').prop('hidden', false).toggleClass('na_ai_ok', ok)
            .html(ok ? '<i class="fa-solid fa-circle-check"></i> 원문과 잘 맞아요' : `<div class="na_ai_box_head"><i class="fa-solid fa-clipboard-check"></i> 채점 <span class="na_dim">· 참고용</span></div>${driftHtml(out, m)}`);
    });
    $root.on('click', '.na_cite_msg', function () { const n = Number(this.dataset.msg); openSource(n, n, `#${n}`); });
    $root.find('.na_wz_add').on('click', () => {
        const text = $root.find('.na_wz_out').val().trim();
        if (!text) { go(2); return toastr.info('먼저 결과를 붙여넣어 주세요.'); }
        const n = guessEndNumber(text);
        $root.closest('dialog').find('.popup-button-ok').trigger('click');
        setTimeout(() => openAppend({ text, end: n ?? range().to }), 50);
    });
    show();
    await build();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// ---------------------------------------------------------------- branches
// SillyTavern copies the chat metadata (and so the archive) into a branch. If the branch starts before the
// archive's last section, the copy carries sections of a future this branch no longer has.

function branchState(m) {
    const c = ctx();
    const parent = c.chatMetadata?.main_chat || null;
    const last = lastIndex();
    const ranges = headingRanges(m.text);
    const cur = ranges.length ? ranges[ranges.length - 1].prefix : '';
    const secs = parseSections(m.text).filter(x => !x.group);
    const ahead = !parent ? [] : secs.map(x => ({ s: x, r: x.title.match(RANGE_HEAD) }))
        .filter(x => x.r && (x.r[1] || '').trim() === cur && Math.min(+x.r[2], +x.r[4]) > last)
        .map(x => ({ s: x.s, from: Math.min(+x.r[2], +x.r[4]), to: Math.max(+x.r[2], +x.r[4]) }));
    // the newest restore point whose numbers stop inside this branch
    const fit = ahead.length ? (m.snapshots || []).find(sn => { const rr = headingRanges(sn.text).filter(x => x.prefix === cur); return rr.length && rr[rr.length - 1].to <= last; }) : null;
    return { parent, last, cur, ahead, fit };
}

async function openBranches() {
    const c = ctx();
    const m = getMeta();
    const here = currentChatId();
    const $root = $(`<div class="na_popup"><div class="na_br_body"></div></div>`);
    const render = () => {
        const b = branchState(m);
        $root.find('.na_br_body').html(`
          <div class="na_block_head"><div><h4>분기</h4><p>실리태번에서 분기를 만들면 아카이브도 같이 복사돼요. 여기서 원본과 비교하고, 분기 지점 뒤의 섹션을 정리해요.</p></div></div>
          ${b.parent ? `<div class="na_br_card"><div><b>원본 채팅</b><div class="na_dim">${esc(b.parent)}</div></div>
              <div class="na_row_btns"><button type="button" class="na_btn na_small na_br_cmp_parent"><i class="fa-solid fa-code-compare"></i> 원본 아카이브와 비교</button></div></div>`
            : '<div class="na_br_card na_dim">이 채팅은 분기가 아니에요 (원본 채팅 정보가 없어요).</div>'}
          ${b.ahead.length ? `<div class="na_br_card na_br_warn">
              <div><b>분기 지점 뒤의 섹션 ${b.ahead.length}개</b><div class="na_dim">이 채팅은 #${b.last}까지예요. 아래 섹션은 원본에서 그 뒤에 일어난 일이라 이 분기엔 없어요.</div>
                <ul>${b.ahead.map(x => `<li>${esc(x.s.title)}</li>`).join('')}</ul>
                <div class="na_dim">STATE·OPEN도 원본의 마지막 시점 기준일 수 있어요. 복구 지점이 있으면 그걸로 되돌리는 게 가장 깔끔해요.</div></div>
              <div class="na_row_btns">
                ${b.fit ? `<button type="button" class="na_btn na_small na_primary na_br_restore">복구 지점으로 (${esc(timeLabel(b.fit.at))} · ${esc(b.fit.reason)})</button>` : ''}
                <button type="button" class="na_btn na_small na_br_cut">이 섹션들만 빼기</button>
              </div></div>` : ''}
          <div class="na_br_card"><div><b>이 채팅에서 갈라진 분기</b><div class="na_dim">같은 캐릭터의 채팅을 열어 원본이 이 채팅인 걸 찾아요.</div></div>
            <div class="na_row_btns"><button type="button" class="na_btn na_small na_br_find"><i class="fa-solid fa-magnifying-glass"></i> 찾기</button></div>
            <div class="na_br_kids"></div></div>`);
    };
    render();
    const compareWith = async (id, label) => {
        try {
            const other = (await fetchOtherChat(id)).meta?.[MODULE];
            if (!other?.text?.trim()) return toastr.info('그 채팅엔 아카이브가 없어요.');
            await openDiff({ at: Date.now(), reason: label, text: other.text }, { text: m.text, label: '이 채팅' });
        } catch (e) { toastr.error(`못 열었어요: ${e.message || e}`); }
    };
    $root.on('click', '.na_br_cmp_parent', () => compareWith(branchState(m).parent, '원본 채팅'));
    $root.on('click', '.na_br_restore', async () => {
        const b = branchState(m);
        if (!b.fit || !await confirm('복구 지점으로', `${timeLabel(b.fit.at)} · ${esc(b.fit.reason)} 버전으로 되돌릴까요? 지금 내용은 복구 지점에 남아요.`)) return;
        await commitText(b.fit.text, '분기 정리 전', { boundary: Math.min(b.fit.boundary ?? -1, b.last) });
        toastr.success('되돌렸어요'); render();
    });
    $root.on('click', '.na_br_cut', async () => {
        const b = branchState(m);
        if (!await confirm('섹션 빼기', `분기 지점 뒤의 섹션 ${b.ahead.length}개를 뺄까요? 지금 내용은 복구 지점에 남아요.`)) return;
        const drop = new Set(b.ahead.map(x => x.s.start));
        const secs = parseSections(m.text);
        const next = secs.filter(x => !drop.has(x.start)).map(x => m.text.slice(x.start, x.end)).join('');
        const end = lastRangeEnd(next);
        await commitText(next, '분기 정리 전', { boundary: m.boundary >= 0 ? Math.min(m.boundary, end ?? b.last, b.last) : m.boundary });
        toastr.success(`${b.ahead.length}개 뺐어요. STATE·OPEN이 맞는지 확인해 주세요.`); render();
    });
    $root.on('click', '.na_br_find', async function () {
        const $kids = $root.find('.na_br_kids').html('<div class="na_dim">찾는 중…</div>');
        $(this).prop('disabled', true);
        try {
            const chats = await listOtherChats();
            const kids = [];
            for (const [i, x] of chats.entries()) {
                $kids.html(`<div class="na_dim">찾는 중… ${i + 1}/${chats.length}</div>`);
                try { const f = await fetchOtherChat(x.id); if (f.meta?.main_chat === here) kids.push({ ...x, arc: f.meta?.[MODULE], n: f.messages.length }); } catch { /* skip unreadable */ }
            }
            $kids.html(kids.length ? kids.map(k => `
              <div class="na_pick"><div class="na_pick_main"><span class="na_pick_name">${esc(k.label)}</span>
                <span class="na_pick_meta">메시지 ${fmt(k.n)}개${k.arc?.text?.trim() ? ` · 아카이브 #${lastRangeEnd(k.arc.text) ?? '?'}까지` : ' · 아카이브 없음'}</span></div>
                ${k.arc?.text?.trim() ? `<button type="button" class="na_btn na_small na_br_cmp" data-id="${esc(k.id)}">비교</button>` : ''}</div>`).join('') : '<div class="na_dim">이 채팅에서 갈라진 분기가 없어요.</div>');
        } catch (e) { $kids.html('<div class="na_dim">채팅 목록을 못 불러왔어요.</div>'); }
        $(this).prop('disabled', false);
    });
    $root.on('click', '.na_br_cmp', function () { compareWith(String(this.dataset.id), '분기'); });
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
    syncPanel();
}

// ---------------------------------------------------------------- health check
// Cheap, AI-free checks of the archive and its settings. Each item: { level: 'bad'|'warn'|'info'|'ok', title, detail?, fix? }

let nearMemo = { text: null, out: [] };
function selfNearMisses(text) {
    if (nearMemo.text === text) return nearMemo.out;
    const out = selfNearMissesRaw(text);
    nearMemo = { text, out };
    return out;
}

function selfNearMissesRaw(text) {
    const counts = new Map();
    // names only: a word that also shows up in lower case ("Sending" / "sending") is an ordinary word
    // and it must be capitalised mid-sentence at least once, so a sentence-opening "Seeing" does not count
    const lower = new Set((text.match(/\b[a-z][a-z'’]+\b/g) || []));
    const mid = new Set([...text.matchAll(/[a-z,;]\s+([A-Z][a-z][A-Za-z'’]*)/g)].map(x => x[1].replace(/['’]s$/, '')));
    capWords(text).filter(w => w.length >= 4 && mid.has(w) && !lower.has(w.toLowerCase())).forEach(w => counts.set(w, (counts.get(w) || 0) + 1));
    const words = [...counts.keys()];
    const out = [];
    for (const w of words) {
        const cap = w.length >= 7 ? 2 : 1;
        for (const o of words) {
            if (o === w || o[0] !== w[0] || counts.get(o) <= counts.get(w)) continue;
            // a plural or possessive is not a misspelling
            if (o + 's' === w || w + 's' === o || o.startsWith(w) || w.startsWith(o)) continue;
            const d = editDistance(w, o, cap);
            if (d > 0 && d <= cap) { out.push({ word: w, like: o, n: counts.get(w), m: counts.get(o) }); break; }
        }
    }
    return out.slice(0, 8);
}

async function healthChecks(m, { build, afterTok, after } = {}) {
    build ||= await currentInjection();
    const chat = ctx().chat || [];
    const last = chat.length - 1;
    if (afterTok === undefined) { after = m.boundary >= 0 ? buildExtract(m.boundary + 1, last) : []; afterTok = await countTokens(extractToText(after)); }
    const items = [];
    const add = (level, title, detail = '', fix = null) => items.push({ level, title, detail, fix });
    const secs = parseSections(m.text);
    const cards = secs.filter(x => !x.group && x.title !== '(머리말)' && x.title !== '(제목 없음)');
    const keys = new Set(secs.map(sectionKey));

    // numbering
    const hc = checkHeadings(m.text);
    if (hc.issues.length) add('warn', `제목 번호 문제 ${hc.issues.length}개`, hc.issues.slice(0, 5).map(x => `${x.title.slice(0, 40)} — ${x.msg}`).join('\n'), { label: '제목 검사 보기', run: () => { $('dialog .popup-button-ok').last().trigger('click'); showTab('archive'); showArchiveView('cards'); $('#na_hcheck').prop('open', true)[0]?.scrollIntoView({ block: 'center' }); } });
    else if (hc.ranged) add('ok', '제목 번호가 빈틈 없이 이어져요');

    // STATE / boundary agree with the last section
    const ranges = headingRanges(m.text);
    const lastR = ranges.length ? ranges[ranges.length - 1] : null;
    const [, tail] = splitTail(m.text);
    const stateN = (tail.match(/^# STATE\b[^\n]*#(\d+)/m) || [])[1];
    if (lastR && stateN !== undefined && Number(stateN) !== lastR.to) add('warn', `STATE 번호(#${stateN})가 마지막 섹션 끝(#${lastR.to})과 달라요`, '압축 결과에서 STATE를 새로 안 받았을 수 있어요.');
    if (lastR && m.boundary >= 0 && lastR.to <= last && m.boundary !== lastR.to) {
        add('warn', `경계선 #${m.boundary}이 마지막 섹션 끝 #${lastR.to}과 달라요`, '', { label: `경계선을 #${lastR.to}로`, run: async () => { m.boundary = lastR.to; await saveMeta(); syncPanel(); toastr.success(`경계선 #${lastR.to}`); } });
    }

    const br = branchState(m);
    if (br.ahead.length) add('bad', `분기 지점(#${br.last}) 뒤의 섹션 ${br.ahead.length}개가 섞여 있어요`, '원본 채팅에서 분기 뒤에 쓴 섹션이에요.', { label: '분기 정리', run: () => openBranches() });

    // compression due, hiding
    if (m.boundary >= 0) {
        const hideEnd = m.boundary - Math.max(0, Number(m.keep) || 0);
        const shown = chat.slice(0, Math.max(0, hideEnd + 1)).filter(x => x && !x.is_system).length;
        if (shown) add('warn', `압축한 메시지 중 ${shown}개가 아직 안 숨겨졌어요`, '아카이브와 원문이 같이 들어가 토큰이 두 번 쓰여요.', { label: '숨기기 적용', run: () => applyHide() });
        else add('ok', '압축한 메시지는 다 숨겨져 있어요');
    }

    // token cap
    if (build.over) add('bad', `토큰 상한 ${fmt(build.cap)}을 넘었어요 (${fmt(build.tokens)})`, '망각 곡선을 켜거나 섹션을 꺼 주세요.');
    else if (build.trimmed.length) add('info', `상한에 맞추느라 섹션 ${build.trimmed.length}개를 뺐어요`);

    // keyword links
    const lm = linkedMap(m);
    const stat = Object.keys(lm).length ? keywordStats(m) : null;
    for (const [k, ws] of Object.entries(lm)) {
        if (!keys.has(k)) { add('warn', `키워드 연동한 섹션이 없어졌어요: ${keyLabel(k).slice(0, 40)}`, '', { label: '연동 지우기', run: async () => { await setLinked(k, []); } }); continue; }
        const bad = (ws || []).map(w => ({ w, warn: keywordWarn(w, stat) })).filter(x => x.warn.length);
        if (bad.length) {
            const s = secs.find(x => sectionKey(x) === k);
            add('warn', `키워드 확인: ${keyLabel(k).slice(0, 40)}`, bad.map(x => `${x.w} — ${x.warn[0]}`).join('\n'),
                s ? { label: '키워드 고치기', run: async () => { const ks = await openKeywords(s, m.text.slice(s.start, s.end), lm[k] || []); if (ks) await setLinked(k, ks); } } : null);
        }
    }
    const dangling = [...mutedSet(m), ...pinnedSet(m)].filter(k => !keys.has(k));
    if (dangling.length) add('info', `없어진 섹션의 스위치·고정 설정 ${dangling.length}개가 남아 있어요`, '', { label: '정리', run: async () => { m.muted = m.muted.filter(k => keys.has(k)); m.pinned = m.pinned.filter(k => keys.has(k)); await saveMeta(); applyInjection(); syncPanel(); } });

    // sections
    const empty = cards.filter(x => !m.text.slice(x.start, x.end).replace(/^#{1,2} [^\n]*\n?/, '').trim());
    if (empty.length) add('warn', `빈 섹션 ${empty.length}개`, empty.slice(0, 5).map(x => x.title.slice(0, 50)).join('\n'));
    const big = [];
    for (const x of cards) { const t = await cachedTokens(m.text.slice(x.start, x.end)); if (t > 2500) big.push(`${x.title.slice(0, 40)} — ${fmt(t)} 토큰`); }
    if (big.length) add('info', `아주 큰 섹션 ${big.length}개`, `${big.slice(0, 5).join('\n')}\n나눠 쓰거나 다시 압축하면 키워드 연동·상한이 잘 맞아요.`);

    // spelling drift inside the archive
    const nm = selfNearMisses(m.text);
    if (nm.length) add('warn', `비슷한 이름 ${nm.length}쌍 — 철자가 흔들렸을 수 있어요`, nm.map(x => `${x.word} (${x.n}번) ↔ ${x.like} (${x.m}번)`).join('\n'));

    // backup
    if (!m.backup) add('warn', '아직 백업한 적이 없어요', '', { label: '.json 백업', run: () => $('#na_export_json').trigger('click') });
    else if (m.backupEvery > 0 && m.sinceBackup >= m.backupEvery) add('warn', `백업 뒤로 ${m.sinceBackup}번 바뀌었어요`, `마지막 백업 ${timeLabel(m.backup.at)}`, { label: '.json 백업', run: () => $('#na_export_json').trigger('click') });
    else add('ok', `백업 ${timeLabel(m.backup.at)}`);

    if (!glossaryEntries(m).length && Object.keys(m.trMem || {}).length) add('info', '번역 용어집이 비어 있어요', '이름 표기가 번역마다 달라질 수 있어요.', { label: '용어집 열기', run: () => openGlossary() });

    const pen = { bad: 15, warn: 6, info: 1, ok: 0 };
    const score = Math.max(0, 100 - items.reduce((a, x) => a + pen[x.level], 0));
    const order = { bad: 0, warn: 1, info: 2, ok: 3 };
    items.sort((a, b) => order[a.level] - order[b.level]);
    return { score, items };
}

// ---------------------------------------------------------------- story calendar
// Reads the date in each numbered heading ("(Mekhir 18, night, Ombos)", "(Phaophi 18 – Hathyr 4)", "(the next day)")
// and lays the sections out on a time line, per log (Y1, Y2…). No AI.

const CAL_DEFAULT = [
    'Thoth, Phaophi/Paophi, Hathyr/Athyr, Choiak/Khoiak/Koiak, Tybi/Tobi, Mekhir/Mechir/Meshir, Phamenoth/Paremhat, Pharmouthi/Paremoude, Pachons/Pashons, Payni/Paoni, Epiphi/Epip/Epep, Mesore',
    'January/Jan, February/Feb, March/Mar, April/Apr, May, June/Jun, July/Jul, August/Aug, September/Sep/Sept, October/Oct, November/Nov, December/Dec',
    '1월, 2월, 3월, 4월, 5월, 6월, 7월, 8월, 9월, 10월, 11월, 12월',
].join('\n');

function calendars() {
    const src = String(globalSettings().calendars || CAL_DEFAULT);
    return src.split('\n').map(l => l.split(',').map(x => x.split('/').map(a => a.trim()).filter(Boolean)).filter(x => x.length)).filter(c => c.length >= 2);
}

const TIME_WORDS = [
    [/before dawn|pre-?dawn/i, '동트기 전'], [/\bdawn\b|daybreak/i, '새벽'], [/\bmorning\b/i, '아침'], [/\bnoon\b|midday/i, '낮'],
    [/afternoon/i, '오후'], [/\bdusk\b|sunset/i, '해질녘'], [/\bevening\b/i, '저녁'], [/midnight/i, '자정'], [/\bnight\b/i, '밤'],
];
const NUM_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, several: 3, some: 0 };
const UNIT_KO = { day: '일', week: '주', month: '개월', year: '년' };

// date bits from one heading
function headingDate(title, cals = calendars()) {
    const paren = (title.match(/\(([^()]*)\)\s*(?:\[[^\]]*\])?\s*$/) || [, ''])[1];
    const text = paren || title;
    let date = null;
    for (const [ci, months] of cals.entries()) {
        const alt = months.map((names, mi) => names.map(n => [n, mi])).flat().sort((a, b) => b[0].length - a[0].length);
        const pat = alt.map(([n]) => escRe(n)).join('|');
        const korean = /월$/.test(months[0][0]);
        const re = korean
            ? new RegExp(`(${pat})\\s*(\\d{1,2})일?(?:\\s*[–—~-]\\s*(?:(${pat})\\s*)?(\\d{1,2})일?)?`)
            : new RegExp(`\\b(${pat})\\s+(\\d{1,2})(?:\\s*[–—~-]\\s*(?:(${pat})\\s+)?(\\d{1,2}))?`, 'i');
        const mt = text.match(re);
        if (!mt) continue;
        const idx = n => alt.find(([a]) => a.toLowerCase() === String(n).toLowerCase())?.[1];
        const m1 = idx(mt[1]), d1 = Number(mt[2]);
        const m2 = mt[3] ? idx(mt[3]) : m1, d2 = mt[4] ? Number(mt[4]) : d1;
        date = { cal: ci, m: m1, d: d1, m2, d2, label: mt[0].replace(/\s+/g, ' ') };
        break;
    }
    if (!date) {
        // a month alone: "(month of Tybi)"
        for (const [ci, months] of cals.entries()) {
            const mi = months.findIndex(names => names.some(n => new RegExp(`\\b${escRe(n)}\\b`, 'i').test(text)));
            if (mi >= 0) { date = { cal: ci, m: mi, d: 0, m2: mi, d2: 0, label: months[mi][0] }; break; }
        }
    }
    // time and "later" words only from the parenthesis, never from the title itself ("The night ridge")
    const time = paren ? (TIME_WORDS.find(([re]) => re.test(paren)) || [])[1] || '' : '';
    let rel = '', gap = null;
    const later = paren.match(/\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|several|some|\d+)\s+(day|week|month|year)s?\s+(?:later|on)\b/i);
    if (later) {
        const n = NUM_WORDS[later[1].toLowerCase()] ?? Number(later[1]);
        gap = { n, unit: later[2].toLowerCase() };
        rel = n === 1 ? { day: '하루', week: '일주일', month: '한 달', year: '1년' }[gap.unit] + ' 뒤' : `${n || '얼마'}${UNIT_KO[gap.unit]} 뒤`;
    } else if (/\b(the )?same (day|night)\b|later that day|that (night|evening)/i.test(paren)) rel = '같은 날';
    else if (/\b(the )?next (day|morning)\b|following day/i.test(paren)) rel = '다음 날';
    else if (/next (two|three|few) days/i.test(paren)) rel = '며칠에 걸쳐';
    return { date, time, rel, gap };
}

function storyTimeline(m) {
    const cals = calendars();
    const secs = parseSections(m.text).filter(s => !s.group && RANGE_HEAD.test(s.title));
    const logs = new Map();
    for (const s of secs) {
        const prefix = (s.title.match(RANGE_HEAD)[1] || '').trim() || '—';
        if (!logs.has(prefix)) logs.set(prefix, []);
        logs.get(prefix).push({ s, ...headingDate(s.title, cals) });
    }
    const out = [];
    for (const [prefix, rows] of logs) {
        let year = 1, prev = null, warnings = 0;
        for (const r of rows) {
            r.year = year; r.note = ''; r.warn = '';
            if (r.date) {
                if (prev && r.date.cal === prev.cal) {
                    const pm = prev.m2, pd = prev.d2;
                    if (r.date.m < pm) { year++; r.year = year; r.note = '해가 바뀐 걸로 봤어요'; }
                    else if (r.date.m === pm && r.date.d && pd && r.date.d < pd) {
                        if (r.gap?.unit === 'year') { year++; r.year = year; }
                        else { r.warn = `날짜가 거꾸로예요 (${prev.label} 다음에 ${r.date.label})`; warnings++; }
                    }
                }
                // months skipped since the previous dated section
                if (prev && r.date.cal === prev.cal && !r.warn) {
                    const months = cals[r.date.cal].length;
                    const diff = (r.year - (prev.year || r.year)) * months + (r.date.m - prev.m2);
                    if (diff >= 2) r.skip = `${diff}개월`;
                }
                prev = { ...r.date, year: r.year };
            }
            if (r.gap && !r.skip) r.skip = r.rel;
        }
        out.push({ prefix, rows, warnings });
    }
    return out;
}

async function openCalendar() {
    const c = ctx();
    const m = getMeta();
    let logSel = null;
    const $root = $(`
      <div class="na_popup na_v2 na_cal">
        <div class="na_v2_titlebar"><div class="na_v2_title"><b>이야기 달력</b><small class="na_cal_sum"></small></div><div class="na_v2_seg na_cal_logs"></div></div>
        <div class="na_cal_body"></div>
        <details class="na_v2_card na_v2_more na_cal_cfg">
          <summary><i class="fa-solid fa-calendar-days"></i> 달 이름 바꾸기</summary>
          <small class="na_v2_note">한 줄에 달력 하나, 달은 순서대로 쉼표로, 다른 표기는 / 로 (예: Mekhir/Mechir). 비우면 기본값(이집트·영어·한국어 달).</small>
          <textarea class="text_pole na_cal_ta" rows="4" spellcheck="false"></textarea>
        </details>
      </div>`);
    const g = globalSettings();
    $root.find('.na_cal_ta').val(g.calendars || CAL_DEFAULT).on('change', function () {
        const v = this.value.trim();
        g.calendars = v && v !== CAL_DEFAULT ? v : '';
        saveGlobal(); draw();
    });
    const strip = t => t.replace(/\s*\([^()]*\)\s*(\[[^\]]*\])?\s*$/, '').replace(RANGE_HEAD, (all, p, a, dash, b, rest) => rest.replace(/^\s*[—–-]\s*/, '')) || t;
    const draw = () => {
        const tl = storyTimeline(m);
        const cals = calendars();
        if (!tl.length) { $root.find('.na_cal_body').html('<div class="na_empty">"## #시작–#끝 — 제목 (날짜…)" 형식의 섹션이 없어요.</div>'); return; }
        const l = tl.find(x => x.prefix === logSel) || tl[tl.length - 1];
        logSel = l.prefix;
        const name = p => p === '—' ? '로그' : p;
        $root.find('.na_cal_logs').html(tl.length > 1 ? tl.map(x => `<button type="button" data-p="${esc(x.prefix)}" class="${x === l ? 'on' : ''}">${esc(name(x.prefix))}</button>`).join('') : '');
        const dated = l.rows.filter(r => r.date).length;
        $root.find('.na_cal_sum').text(`${tl.length > 1 ? `${name(l.prefix)} · ` : ''}섹션 ${l.rows.length}개 · 날짜 ${dated}개`);
        // month groups: a dated row opens a new group when its month changes; undated rows stay in the current one
        const groups = [];
        for (const r of l.rows) {
            const key = r.date ? `${r.date.cal}:${r.date.m}:${r.year}` : null;
            const cur = groups[groups.length - 1];
            if (!cur || (key && key !== cur.key)) groups.push({ key, name: r.date ? cals[r.date.cal][r.date.m][0] : '날짜 없음', year: r.year, gap: r.skip || '', rows: [r] });
            else cur.rows.push(r);
            if (!cur && !key) groups[0].key = null;
        }
        const day = r => r.date?.d ? (r.date.m2 !== r.date.m ? `${r.date.d}–` : r.date.d2 && r.date.d2 !== r.date.d ? `${r.date.d}–${r.date.d2}` : `${r.date.d}`) : (r.date ? '·' : '?');
        const sub = r => r.date?.d && r.date.m2 !== r.date.m ? `~${cals[r.date.cal][r.date.m2][0]} ${r.date.d2 || ''}`.trim() : (r.time || (r.date ? '' : r.rel || ''));
        const place = r => headingPlaces(r.s.title, cals).join(' → ');
        $root.find('.na_cal_body').html(`
          ${dated ? '' : '<div class="na_v2_card na_v2_note">제목에서 날짜를 못 찾았어요. 아래 "달 이름 바꾸기"에 이야기 속 달력을 적어 주세요.</div>'}
          ${l.warnings ? `<div class="na_xr_warn slim"><i class="fa-solid fa-triangle-exclamation"></i><div><b>날짜가 거꾸로 가는 곳 ${l.warnings}개</b></div><button type="button" class="na_linkbtn na_cal_jump">보기</button></div>` : ''}
          ${groups.map(gr => `
            ${gr.gap ? `<div class="na_cal_gap2"><span>${esc(/개월$/.test(gr.gap) ? `${gr.gap} 지남` : gr.gap)}</span></div>` : ''}
            <div class="na_cal_month"><b>${esc(gr.name)}</b><small>섹션 ${gr.rows.length}${gr.year > 1 ? ` · ${gr.year}년째` : ''}</small></div>
            <div class="na_v2_card na_v2_list">${gr.rows.map(r => `
              <button type="button" class="na_cal_item ${r.warn ? 'warn' : ''}" data-start="${r.s.start}">
                <span class="na_cal_day"><b>${esc(day(r))}</b><small>${esc(sub(r))}</small></span>
                <span class="na_cal_txt"><span>${esc(strip(r.s.title))}</span><small>${esc(r.warn || [(r.s.title.match(/^(?:\S{1,12}\s)?#\d+\s*[–—~-]\s*#?\d+/) || [''])[0], place(r), r.note].filter(Boolean).join(' · '))}</small></span>
              </button>`).join('')}
            </div>`).join('')}`);
    };
    $root.on('click', '.na_cal_logs button', function () { logSel = String($(this).data('p')); draw(); });
    $root.on('click', '.na_cal_jump', () => $root.find('.na_cal_item.warn')[0]?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    $root.on('click', '.na_cal_item', function () { const st = Number(this.dataset.start); $root.closest('dialog').find('.popup-button-ok').trigger('click'); gotoSection(st); });
    draw();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// ---------------------------------------------------------------- places in headings
// Places from heading parentheses ("(Phamenoth 9, Thebes palace, after midnight)", "(Ombos → Thebes)"), shown by the calendar.

const PLACE_SKIP = /^(?:the\s+)?(?:same|next|following|later|that|this|one|a|an|some|several|\d+)\b.*\b(?:day|days|night|week|weeks|month|months|year|years|later|on|in)\b|season\b|^(?:dawn|morning|noon|midday|afternoon|dusk|sunset|evening|night|midnight|before dawn|pre-?dawn|daybreak|into the night|later that day)$/i;

function headingPlaces(title, cals) {
    const paren = (title.match(/\(([^()]*)\)\s*(?:\[[^\]]*\])?\s*$/) || [, ''])[1];
    const d = headingDate(title, cals);
    let text = paren;
    if (d.date) text = text.replace(d.date.label, '');
    const parts = text.split(/,|;/).map(x => x.trim()).filter(Boolean)
        .filter(x => !PLACE_SKIP.test(x) && !TIME_WORDS.some(([re]) => re.test(x) && x.split(/\s+/).length <= 3))
        .filter(x => !/^(?:month of|after|before|until|during|into)\b/i.test(x));
    // "A → B" is a move inside one section
    return parts.flatMap(x => x.split(/\s*(?:→|->|⇒)\s*/)).map(x => x.replace(/^(?:the|a|an)\s+/i, '').trim()).filter(Boolean);
}




// ---------------------------------------------------------------- people: who's who, faces, and the relationship map
// The roster is the STATE character headings plus names added by hand (m.people). Faces are kept in the global settings by name,
// so they follow the story into the next chat: an uploaded picture shrunk to 96px, or the SillyTavern character/persona avatar.
const FACE_PX = 96;
const nameKey = n => String(n || '').trim().toLowerCase();
// case-sensitive on purpose: "Set" the god, not "set" the verb
const nameRe = n => new RegExp(`(?<![\\p{L}\\p{N}])${escRe(n)}(?![\\p{L}\\p{N}])`, 'u');

function peopleList(m) {
    const out = [], seen = new Set();
    for (const n of [...castNames(m), ...(Array.isArray(m.people) ? m.people : [])]) {
        const k = nameKey(n);
        if (k && !seen.has(k)) { seen.add(k); out.push(String(n).trim()); }
    }
    return out;
}

function stFace(name) {
    const c = ctx(), k = nameKey(name);
    const ch = (c.characters || []).find(x => nameKey(x?.name) === k);
    if (ch?.avatar && ch.avatar !== 'none') return `/thumbnail?type=avatar&file=${encodeURIComponent(ch.avatar)}`;
    const per = c.powerUserSettings?.personas || {};
    const f = Object.keys(per).find(f => nameKey(per[f]) === k);
    return f ? `/thumbnail?type=persona&file=${encodeURIComponent(f)}` : '';
}

// stored: a data URL, or 'none' for "letter only"; nothing stored means "the SillyTavern avatar if there is one"
function faceOf(name) {
    const f = globalSettings().faces?.[nameKey(name)];
    return f === 'none' ? '' : f || stFace(name);
}

function faceHtml(name, size = 40) {
    const url = faceOf(name);
    let h = 0; for (const ch of nameKey(name)) h = (h * 31 + ch.codePointAt(0)) % 360;
    return `<span class="na_face" style="--s:${size}px;--h:${h}" title="${esc(name)}">${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : esc([...String(name).trim()][0] || '?')}</span>`;
}

// an avatar that fails to load (renamed card, deleted persona) falls back to the letter, wherever a face is drawn
document.addEventListener('error', e => { const img = e.target; if (img?.tagName === 'IMG' && img.parentElement?.classList.contains('na_face')) img.replaceWith(img.parentElement.title.trim()[0] || '?'); }, true);

async function shrinkFace(file) {
    const bmp = await createImageBitmap(file);
    const s = Math.min(bmp.width, bmp.height);
    const cv = document.createElement('canvas');
    cv.width = cv.height = FACE_PX;
    const g = cv.getContext('2d');
    g.imageSmoothingQuality = 'high';
    // portraits keep the face in the upper part, so a tall picture is cropped nearer the top
    g.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) * 0.25, s, s, 0, 0, FACE_PX, FACE_PX);
    bmp.close?.();
    const webp = cv.toDataURL('image/webp', 0.86);
    return webp.startsWith('data:image/webp') ? webp : cv.toDataURL('image/jpeg', 0.86);
}

// STATE blocks: "## Name" bullets for each person, and the bullets of the other STATE headings (Relationships, household…)
function stateParts(m) {
    const state = tailBlocks(splitTail(String(m.text || ''))[1]).filter(b => b.key === 'STATE').map(b => b.text).join('\n');
    const per = new Map(), shared = [];
    for (const part of state.split(/^(?=## )/m)) {
        const head = part.match(/^## (.+)$/m)?.[1]?.trim();
        const lines = part.split('\n').slice(head ? 1 : 0).map(l => l.trim()).filter(l => /^[-*]\s/.test(l)).map(l => l.replace(/^[-*]\s+/, ''));
        if (head && castNames({ text: `# STATE\n## ${head}\n` }).length) per.set(nameKey(head), lines);
        else shared.push(...lines);
    }
    return { per, shared };
}

function peopleData(m) {
    const names = peopleList(m);
    const res = names.map(n => ({ n, re: nameRe(n), first: n.split(/\s+/)[0] }));
    const text = String(m.text || '');
    const secs = parseSections(text).filter(s => !s.group && RANGE_HEAD.test(s.title));
    const { per, shared } = stateParts(m);
    const people = new Map(names.map(n => [n, { name: n, secs: [], state: per.get(nameKey(n)) || [], rels: [], quotes: (m.quotes || []).filter(q => nameKey(q.who) === nameKey(n)) }]));
    const pairs = new Map();
    const pairKey = (a, b) => [a, b].sort().join('\u0001');
    for (const s of secs) {
        const body = text.slice(s.start, s.end);
        const here = res.filter(r => r.re.test(body)).map(r => r.n);
        for (const n of here) people.get(n).secs.push(s);
        for (let i = 0; i < here.length; i++) for (let j = i + 1; j < here.length; j++) {
            const k = pairKey(here[i], here[j]);
            if (!pairs.has(k)) pairs.set(k, { a: here[i], b: here[j], secs: [], lines: [], many: [] });
            pairs.get(k).secs.push(s);
        }
    }
    // relationship lines: shared STATE bullets, and a person's own bullets that name someone else
    const lines = [...shared.map(l => ({ l })), ...[...per].flatMap(([k, ls]) => ls.map(l => ({ l, owner: names.find(n => nameKey(n) === k) })))];
    for (const { l, owner } of lines) {
        const who = res.filter(r => r.re.test(l)).map(r => r.n);
        if (owner && !who.includes(owner)) who.push(owner);
        if (!owner) for (const n of who) people.get(n).rels.push(l);
        for (let i = 0; i < who.length; i++) for (let j = i + 1; j < who.length; j++) {
            const k = pairKey(who[i], who[j]);
            if (!pairs.has(k)) pairs.set(k, { a: who[i], b: who[j], secs: [], lines: [], many: [] });
            // a line about just these two describes them; one naming three or more is kept apart
            pairs.get(k)[who.length === 2 ? 'lines' : 'many'].push(l);
        }
    }
    return { names, people, pairs: [...pairs.values()], pairKey };
}

// ---- relationship temperature: the AI rates each section two people share from -5 (cold) to +5 (warm)
// m.temps = { "A\u0001B": { sectionKey: { s, why, h } } }; h is the section text's hash, so an edited section is rated again
const AI_SYS_TEMP = `GOAL
Rate how WARM or COLD the relationship between two people is in each section of a story archive.

YOU GET
- PAIR: the two names.
- SECTIONS: S1, S2, S3 … in story order. Each one is a summary of a part of the story.

SCALE (one whole number from -5 to 5)
 5  devoted, tender, complete trust
 3  warm, close, affectionate
 1  friendly but careful
 0  neutral, or they barely deal with each other
-1  tense, uneasy, cold politeness
-3  open quarrel, bitterness, betrayal
-5  hatred, violence, total break

STEPS
1. Take one section.
2. Look ONLY at how the two people in the PAIR treat and feel about each other in that section. Ignore everyone else.
3. If both are there but do not really deal with each other, the score is 0.
4. If the mood changes inside the section, the END of the section counts more than the start.
5. Pick the number from the SCALE.
6. Write the reason in Korean, 12 words or fewer.
7. Go to the next section. Do every section. Do not skip, do not merge.

EXAMPLE
PAIR: Ren & Mara
S1: Ren pulls Mara out of the river. She thanks him and they talk until dawn.
S2: Mara finds out Ren lied about the letter. She slaps him and leaves.
S3: Ivo and Mara go to the market. Ren is mentioned once.
S4: Ren apologizes. Mara does not forgive him yet but lets him walk her home.
Answer:
S1 | 4 | 렌이 마라를 구하고 밤새 이야기함
S2 | -3 | 편지 거짓말이 드러나 마라가 떠남
S3 | 0 | 둘이 거의 엮이지 않음
S4 | 1 | 사과를 받고 조심스레 곁을 허락함

OUTPUT
One line per section, in order, exactly like this:
S<number> | <score> | <reason>
Nothing else. No title, no notes, no summary.`;

async function rateTemps(m, pair, secs, onStep) {
    const k = [pair.a, pair.b].sort().join('\u0001');
    m.temps = m.temps && typeof m.temps === 'object' ? m.temps : {};
    const store = m.temps[k] ||= {};
    const parts = [];
    let cur = [], tok = 0;
    for (const s of secs) {
        const t = estTok(m.text.slice(s.start, s.end));
        if (cur.length && tok + t > PICK_CHUNK_TOK) { parts.push(cur); cur = []; tok = 0; }
        cur.push(s); tok += t;
    }
    if (cur.length) parts.push(cur);
    let got = 0;
    for (const [pi, part] of parts.entries()) {
        onStep?.(pi + 1, parts.length);
        const body = part.map((s, i) => `S${i + 1}: ${s.title}\n${m.text.slice(s.start, s.end).replace(/^[^\n]*\n?/, '').trim()}`).join('\n\n');
        const out = await askAI(`PAIR: ${pair.a} & ${pair.b}\n\nSECTIONS\n${body}`, { system: AI_SYS_TEMP, maxTokens: 3000 });
        for (const mt of out.matchAll(/^\s*\**S(\d+)\**\s*[|:]\s*([+\-−–]?\s*\d+)\s*[|:]\s*(.+)$/gm)) {
            const s = part[Number(mt[1]) - 1];
            if (!s) continue;
            const v = Math.max(-5, Math.min(5, parseInt(mt[2].replace(/[−–]/, '-').replace(/\s/g, ''), 10) || 0));
            store[sectionKey(s)] = { s: v, why: mt[3].trim().slice(0, 80), h: textHash(m.text.slice(s.start, s.end)) };
            got++;
        }
        await saveMeta();
    }
    return got;
}

function tempPoints(m, pair) {
    const store = m.temps?.[[pair.a, pair.b].sort().join('\u0001')] || {};
    return pair.secs.map(s => { const t = store[sectionKey(s)]; return { s, t: t || null, stale: !!t && t.h !== textHash(m.text.slice(s.start, s.end)) }; });
}

// smooth line graph, fixed 320×150 box scaled to the width: x = shared sections in story order, y = −5…5
const TEMP_W = 320, TEMP_H = 150, TEMP_Z = 75, TEMP_K = 13;
function tempChart(pts) {
    const on = pts.map((p, i) => ({ p, i })).filter(x => x.p.t);
    if (!on.length) return '';
    const n = pts.length;
    const X = i => n === 1 ? TEMP_W / 2 : 6 + i * (TEMP_W - 12) / (n - 1);
    const P = on.map(({ p, i }) => [X(i), TEMP_Z - p.t.s * TEMP_K]);
    let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
    for (let i = 0; i < P.length - 1; i++) {
        const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
        d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    const last = P[P.length - 1];
    const area = `${d} L${last[0].toFixed(1)},${TEMP_Z} L${P[0][0].toFixed(1)},${TEMP_Z} Z`;
    // log bands (Y1 / Y2 …): alternate ones get a faint background
    const logOf = s => (s.title.match(RANGE_HEAD)?.[1] || '').trim();
    const bands = [];
    pts.forEach((p, i) => { const l = logOf(p.s); if (!bands.length || bands[bands.length - 1].l !== l) bands.push({ l, a: i, b: i }); else bands[bands.length - 1].b = i; });
    const edge = i => i <= 0 ? 0 : i >= n ? TEMP_W : (X(i - 1) + X(i)) / 2;
    const minI = on.reduce((a, x) => x.p.t.s < a.p.t.s ? x : a, on[0]);
    const uid = `t${Math.random().toString(36).slice(2, 7)}`;
    return {
        svg: `<svg class="na_temp_svg" viewBox="0 0 ${TEMP_W} ${TEMP_H}" role="img" aria-label="관계 온도 그래프">
          <defs><clipPath id="${uid}w"><rect x="-6" y="-12" width="${TEMP_W + 12}" height="${TEMP_Z + 12}"/></clipPath><clipPath id="${uid}c"><rect x="-6" y="${TEMP_Z}" width="${TEMP_W + 12}" height="${TEMP_H}"/></clipPath></defs>
          ${bands.map((b, k) => k % 2 ? `<rect class="band" x="${edge(b.a)}" y="0" width="${edge(b.b + 1) - edge(b.a)}" height="${TEMP_H}"/>` : '').join('')}
          <line class="zero" x1="0" x2="${TEMP_W}" y1="${TEMP_Z}" y2="${TEMP_Z}"/>
          <path class="area warm" d="${area}" clip-path="url(#${uid}w)"/><path class="area cold" d="${area}" clip-path="url(#${uid}c)"/>
          <path class="line warm" d="${d}" clip-path="url(#${uid}w)"/><path class="line cold" d="${d}" clip-path="url(#${uid}c)"/>
          ${minI.p.t.s < 0 ? `<circle class="pt cold" cx="${X(minI.i)}" cy="${TEMP_Z - minI.p.t.s * TEMP_K}" r="4"/>` : ''}
          <circle class="halo" cx="${last[0]}" cy="${last[1]}" r="9"/><circle class="pt now" cx="${last[0]}" cy="${last[1]}" r="4.5"/>
        </svg>`,
        bands: `<div class="na_temp_bands">${bands.map(b => `<span style="flex:${b.b - b.a + 1}">${esc(b.l || (bands.length > 1 ? `#${pts[b.a].s.title.match(RANGE_HEAD)[2]}–` : ''))}</span>`).join('')}</div>`,
    };
}

const tempWord = v => v >= 3 ? '따뜻함' : v >= 1 ? '조금 따뜻함' : v === 0 ? '보통' : v >= -2 ? '조금 차가움' : '차가움';
const tempCls = v => v > 0 ? 'warm' : v < 0 ? 'cold' : 'mid';
const tempSign = v => v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0';

async function openPeople() {
    const c = ctx();
    const m = getMeta();
    const g = globalSettings();
    g.faces = g.faces && typeof g.faces === 'object' ? g.faces : {};
    const short = s => (s.title.match(/^(?:\S{1,12}\s)?#\d+\s*[–—~-]\s*#?\d+/) || [s.title.slice(0, 20)])[0];
    const label = s => s.title.replace(/\s*\([^()]*\)\s*(\[[^\]]*\])?\s*$/, '').replace(RANGE_HEAD, (all, p, a, d, b, rest) => rest.replace(/^\s*[—–-]\s*/, '')) || s.title;
    const chip = s => `<button type="button" class="na_ref_chip" data-start="${s.start}" title="${esc(s.title)}">${esc(short(s))}</button>`;
    const hue = n => { let h = 0; for (const ch of nameKey(n)) h = (h * 31 + ch.codePointAt(0)) % 360; return h; };
    let view = 'book', sel = null, tab = 'state', center = null, other = null, tpair = null, busy = false, adding = false, showAll = false, data = peopleData(m);
    const $root = $(`
      <div class="na_popup na_v2 na_people">
        <div class="na_v2_tabs na_people_tabs" role="tablist">
          <button type="button" data-v="book">도감</button><button type="button" data-v="map">관계도</button><button type="button" data-v="temp">온도</button>
        </div>
        <div class="na_people_body"></div>
        <input type="file" accept="image/*" class="na_face_file" hidden>
      </div>`);
    const pairOf = (a, b) => data.pairs.find(p => (p.a === a && p.b === b) || (p.a === b && p.b === a));
    const lastTemp = p => { if (!p) return null; const q = [...tempPoints(m, p)].reverse().find(x => x.t); return q ? q.t.s : null; };

    // ---- 도감: a strip of faces, the chosen one's profile
    const book = () => {
        const names = data.names;
        sel = names.includes(sel) ? sel : names[0] || null;
        const strip = `
          <div class="na_pb_strip">
            ${names.map(n => `<button type="button" class="na_pb_pick ${n === sel ? 'on' : ''}" data-n="${esc(n)}">${faceHtml(n, 52)}<span>${esc(n)}</span></button>`).join('')}
            <button type="button" class="na_pb_addbtn" aria-label="인물 넣기" title="인물 넣기"><i class="fa-solid fa-plus"></i></button>
          </div>
          <div class="na_people_add" ${adding ? '' : 'hidden'}><input type="text" class="text_pole na_people_name" placeholder="인물 이름 (예: Nephthys)" enterkeyhint="done"><button type="button" class="na_btn na_small na_people_addbtn">추가</button></div>`;
        if (!sel) return `${strip}<div class="na_empty">STATE에 "## 이름" 인물이 없어요. + 로 인물을 넣어 주세요.</div>`;
        const p = data.people.get(sel);
        const extra = (m.people || []).some(x => nameKey(x) === nameKey(sel)) && !castNames(m).some(x => nameKey(x) === nameKey(sel));
        const st = g.faces[nameKey(sel)];
        // the partner they share the most sections with, for the third tile
        const best = data.pairs.filter(q => (q.a === sel || q.b === sel) && q.secs.length).sort((x, y) => y.secs.length - x.secs.length)[0];
        const bestT = lastTemp(best), bestName = best ? (best.a === sel ? best.b : best.a) : '';
        const partners = data.pairs.filter(q => (q.a === sel || q.b === sel) && (q.secs.length || q.lines.length)).sort((x, y) => y.secs.length - x.secs.length);
        const body = tab === 'state'
            ? (p.state.length ? `<ol class="na_pb_list">${p.state.map(l => `<li>${esc(l)}</li>`).join('')}</ol>` : '<div class="na_empty">STATE에 이 인물의 상태가 없어요.</div>')
            : tab === 'rel'
                ? (partners.length ? partners.map(q => { const o = q.a === sel ? q.b : q.a, t = lastTemp(q); return `
                    <div class="na_v2_card na_pb_rel">
                      <div class="na_pb_relhead">${faceHtml(o, 30)}<b>${esc(o)}</b><small>함께 ${q.secs.length}섹션</small>${t !== null ? `<span class="na_temp_pill ${tempCls(t)}">${tempSign(t)}</span>` : ''}</div>
                      ${q.lines.length ? `<ul>${q.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
                      ${q.many.length ? `<details class="na_v2_more"><summary>다른 인물과 같이 나오는 줄 ${q.many.length}</summary><ul>${q.many.map(l => `<li>${esc(l)}</li>`).join('')}</ul></details>` : ''}
                    </div>`; }).join('') : '<div class="na_empty">다른 인물과 이어진 곳이 없어요.</div>')
                : (p.secs.length ? `<div class="na_pb_secs">${(showAll ? p.secs : p.secs.slice(-12)).slice().reverse().map(chip).join('')}</div>${p.secs.length > 12 && !showAll ? `<button type="button" class="na_linkbtn na_pb_more">${p.secs.length - 12}개 더 보기</button>` : ''}` : '<div class="na_empty">아카이브 섹션에 이름이 안 나와요.</div>');
        return `${strip}
          <div class="na_pb_card" data-n="${esc(sel)}">
            <div class="na_pb_cover" style="--h:${hue(sel)}"></div>
            <div class="na_pb_id">
              <button type="button" class="na_face_btn" aria-label="얼굴 바꾸기" title="그림 올리기">${faceHtml(sel, 88)}<i class="fa-solid fa-camera"></i></button>
              <b class="na_pb_name">${esc(sel)}</b>
              ${p.quotes.length ? `<span class="na_pb_quote">“${esc(p.quotes[0].text)}”</span>` : ''}
              <span class="na_pb_faceacts">
                ${stFace(sel) && st ? '<button type="button" class="na_linkbtn na_face_st">실리태번 아바타로</button>' : ''}
                ${st !== 'none' && faceOf(sel) ? '<button type="button" class="na_linkbtn na_face_none">얼굴 빼기</button>' : ''}
                ${extra ? '<button type="button" class="na_linkbtn na_person_del">목록에서 빼기</button>' : ''}
              </span>
              <div class="na_pb_stats">
                <div><b>${p.secs.length}</b><span>섹션</span></div>
                <div><b>${p.quotes.length}</b><span>대사</span></div>
                <div>${bestT !== null ? `<b class="${tempCls(bestT)}">${tempSign(bestT)}</b><span>${esc(bestName)}과</span>` : `<b>${partners.length}</b><span>이어진 사람</span>`}</div>
              </div>
            </div>
          </div>
          <div class="na_v2_under" role="tablist">
            <button type="button" data-t="state" class="${tab === 'state' ? 'on' : ''}">지금 상태</button>
            <button type="button" data-t="rel" class="${tab === 'rel' ? 'on' : ''}">관계 ${partners.length}</button>
            <button type="button" data-t="secs" class="${tab === 'secs' ? 'on' : ''}">나온 섹션</button>
          </div>
          <div class="na_pb_body">${body}</div>
          ${p.secs.length ? `<div class="na_v2_row2"><button type="button" class="na_v2_btn" data-start="${p.secs[0].start}">처음 ${esc(short(p.secs[0]))}</button><button type="button" class="na_v2_btn" data-start="${p.secs[p.secs.length - 1].start}">최근 ${esc(short(p.secs[p.secs.length - 1]))}</button></div>` : ''}`;
    };

    // ---- 관계도: one person in the middle, the others closer the warmer they are
    const map = () => {
        const names = data.names;
        if (!names.length) return '<div class="na_empty">인물이 없어요. 도감에서 인물을 넣어 주세요.</div>';
        center = names.includes(center) ? center : (names.includes(sel) ? sel : names[0]);
        const rows = names.filter(n => n !== center).map(n => { const q = pairOf(center, n); return { n, q, t: lastTemp(q), k: q ? q.secs.length : 0 }; })
            .filter(r => r.q && (r.k || r.q.lines.length || r.q.many.length));
        const away = names.filter(n => n !== center && !rows.some(r => r.n === n));
        const max = Math.max(1, ...rows.map(r => r.k));
        rows.sort((a, b) => (b.t ?? -9) - (a.t ?? -9) || b.k - a.k);
        other = rows.some(r => r.n === other) ? other : rows[0]?.n || null;
        const placed = rows.map((r, i) => {
            const rad = r.t === null ? 0.36 : 0.2 + (5 - r.t) / 10 * 0.27;
            const a = -Math.PI / 2 + Math.PI / 5 + i * 2 * Math.PI / Math.max(rows.length, 3);
            return { ...r, x: 50 + rad * 100 * Math.cos(a), y: 50 + rad * 100 * Math.sin(a), size: Math.round(30 + 20 * r.k / max) };
        });
        const o = rows.find(r => r.n === other);
        return `
          <div class="na_v2_title"><b>${esc(center)}의 거리</b><small>가까울수록 최근 온도가 따뜻해요 · 크기 = 함께 나온 섹션</small></div>
          <div class="na_ego">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle class="ring warm" cx="50" cy="50" r="20"/><circle class="ring" cx="50" cy="50" r="34"/><circle class="ring cold" cx="50" cy="50" r="48"/>
              ${placed.map(r => `<line class="${r.t === null ? 'mid' : tempCls(r.t)} ${r.n === other ? 'on' : ''}" x1="50" y1="50" x2="${r.x.toFixed(1)}" y2="${r.y.toFixed(1)}" style="stroke-width:${(0.3 + 0.9 * r.k / max).toFixed(2)}"/>`).join('')}
            </svg>
            <span class="na_ego_lbl warm" style="top:${50 - 20 - 4}%">따뜻</span><span class="na_ego_lbl" style="top:${50 - 34 - 4}%">보통</span><span class="na_ego_lbl cold" style="top:${50 - 48 - 3}%">차가움</span>
            <span class="na_ego_me" style="left:50%;top:50%">${faceHtml(center, 68)}</span>
            ${placed.map(r => `<button type="button" class="na_ego_node ${r.n === other ? 'on' : ''}" data-n="${esc(r.n)}" style="left:${r.x.toFixed(1)}%;top:${r.y.toFixed(1)}%">${faceHtml(r.n, r.size)}<span>${esc(r.n)}${r.t !== null ? ` <b class="${tempCls(r.t)}">${tempSign(r.t)}</b>` : ''}</span></button>`).join('')}
          </div>
          ${away.length ? `<small class="na_v2_note">같이 나온 적 없음: ${away.map(esc).join(', ')}</small>` : ''}
          <div class="na_v2_label">가운데 사람 바꾸기</div>
          <div class="na_v2_chips">${names.map(n => `<button type="button" class="na_ego_center ${n === center ? 'on' : ''}" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>
          ${o ? `
          <div class="na_v2_card na_ego_detail">
            <div class="na_pb_relhead">${faceHtml(o.n, 32)}<b>${esc(o.n)}</b><small>함께 ${o.k}섹션</small>${o.t !== null ? `<span class="na_temp_pill ${tempCls(o.t)}">${tempSign(o.t)}</span>` : ''}</div>
            ${o.q.lines.length ? `<ul>${o.q.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '<small class="na_v2_note">STATE에 둘만 나오는 관계 줄이 없어요.</small>'}
            ${o.q.many.length ? `<details class="na_v2_more"><summary>다른 인물과 같이 나오는 줄 ${o.q.many.length}</summary><ul>${o.q.many.map(l => `<li>${esc(l)}</li>`).join('')}</ul></details>` : ''}
            <div class="na_v2_row2">
              ${o.k ? `<button type="button" class="na_v2_btn primary na_temp_go" data-k="${esc(data.pairKey(center, o.n))}">온도 그래프</button>` : ''}
              ${o.k ? `<button type="button" class="na_v2_btn na_ego_secs">함께 나온 섹션</button>` : ''}
            </div>
            <div class="na_pb_secs na_ego_seclist" hidden>${o.q.secs.slice().reverse().map(chip).join('')}</div>
          </div>` : '<div class="na_empty">다른 인물과 같이 나온 섹션이 없어요.</div>'}`;
    };

    // ---- 온도: current temperature, the curve, the extremes, the big turns
    const temp = () => {
        const pairs = data.pairs.filter(p => p.secs.length).sort((x, y) => y.secs.length - x.secs.length);
        if (!pairs.length) return '<div class="na_empty">같은 섹션에 함께 나온 두 인물이 없어요.</div>';
        const pair = pairs.find(p => data.pairKey(p.a, p.b) === tpair) || pairs.find(p => p.a === sel || p.b === sel) || pairs[0];
        tpair = data.pairKey(pair.a, pair.b);
        const pts = tempPoints(m, pair);
        const todo = pts.filter(p => !p.t || p.stale).length, scored = pts.filter(p => p.t);
        const picker = `
          <label class="na_tp_pick">
            <span class="na_tp_faces">${faceHtml(pair.a, 38)}${faceHtml(pair.b, 38)}</span>
            <span class="na_tp_pickname"><b>${esc(pair.a)} · ${esc(pair.b)}</b><small>함께 나온 섹션 ${pts.length}개</small></span>
            <i class="fa-solid fa-chevron-down"></i>
            <select class="na_temp_sel" aria-label="짝 고르기">${pairs.map(p => `<option value="${esc(data.pairKey(p.a, p.b))}" ${p === pair ? 'selected' : ''}>${esc(p.a)} · ${esc(p.b)} (${p.secs.length})</option>`).join('')}</select>
          </label>`;
        const runBtns = `
          <div class="na_v2_row2">
            ${scored.length ? `<button type="button" class="na_v2_btn na_tp_listbtn">섹션별 점수 ${pts.length}개</button>` : ''}
            ${todo ? `<button type="button" class="na_v2_btn primary na_temp_run" data-all="0">${scored.length ? `안 잰 섹션 ${todo}개 재기` : `섹션 ${todo}개 재기`}</button>` : `<button type="button" class="na_v2_btn na_temp_run" data-all="1">전부 다시 재기</button>`}
          </div>
          <small class="na_v2_foot">AI 기능 모델(${esc(aiLabel())})이 섹션마다 −5(차가움) ~ +5(따뜻함)으로 매겨요</small>`;
        if (!scored.length) return `${picker}<div class="na_v2_card na_tp_empty"><i class="fa-solid fa-temperature-half"></i><b>아직 안 쟀어요</b><small>두 사람이 함께 나온 섹션 ${pts.length}개를 AI가 읽고 온도를 매겨요</small></div>${runBtns}`;
        const now = [...scored].pop().t.s;
        const vals = scored.map(p => p.t.s);
        const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10;
        const hi = scored.reduce((a, p) => p.t.s > a.t.s ? p : a, scored[0]), lo = scored.reduce((a, p) => p.t.s < a.t.s ? p : a, scored[0]);
        const ch = tempChart(pts);
        // the biggest jumps between one scored section and the next
        const turns = scored.slice(1).map((p, i) => ({ p, from: scored[i].t.s, d: p.t.s - scored[i].t.s })).filter(x => Math.abs(x.d) >= 3)
            .sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3);
        const tile = (p, kind, word) => `
          <button type="button" class="na_tp_tile ${kind}" data-start="${p.s.start}">
            <span class="na_tp_tlabel"><i></i>${word}</span>
            <b>${esc(short(p.s))}</b>
            <span class="na_tp_tval">${tempSign(p.t.s)} · ${esc(p.t.why)}</span>
          </button>`;
        return `${picker}
          <div class="na_v2_card na_tp_card">
            <div class="na_tp_head">
              <span class="na_tp_icon ${tempCls(now)}"><i class="fa-solid fa-temperature-${now >= 3 ? 'three-quarters' : now > 0 ? 'half' : now === 0 ? 'quarter' : 'empty'}"></i></span>
              <span class="na_tp_now"><small>지금 온도 · ${esc(short(scored[scored.length - 1].s))}</small><span class="${tempCls(now)}"><b>${tempSign(now)}</b>${tempWord(now)}</span></span>
              <span class="na_tp_stats">
                <span><small>평균</small><b>${avg > 0 ? '+' : avg < 0 ? '−' : ''}${Math.abs(avg)}</b></span>
                <span><small>최고</small><b class="warm">${tempSign(hi.t.s)}</b></span>
                <span><small>최저</small><b class="cold">${tempSign(lo.t.s)}</b></span>
              </span>
            </div>
            <div class="na_tp_chart">${ch.svg}${ch.bands}</div>
            ${todo ? `<small class="na_v2_note">안 잰 섹션 ${todo}개는 빼고 그렸어요</small>` : ''}
          </div>
          <div class="na_tp_tiles">${tile(hi, 'warm', '가장 따뜻했던 때')}${tile(lo, 'cold', '가장 차가웠던 때')}</div>
          ${turns.length ? `<div class="na_v2_label">크게 바뀐 순간</div>
          ${turns.map(x => `
            <button type="button" class="na_tp_turn" data-start="${x.p.s.start}">
              <span class="na_tp_jump ${x.d > 0 ? 'warm' : 'cold'}">${tempSign(x.from)} → ${tempSign(x.p.t.s)}</span>
              <span class="na_tp_turntxt"><b>${esc(x.p.t.why)}</b><small>${esc(short(x.p.s))} · ${esc(label(x.p.s))}</small></span>
            </button>`).join('')}` : ''}
          ${runBtns}
          <div class="na_tp_list" hidden>${pts.map(p => `
            <button type="button" class="na_tp_row" data-start="${p.s.start}">
              <b class="na_temp_pill ${p.t ? tempCls(p.t.s) : 'none'}">${p.t ? tempSign(p.t.s) : '–'}</b>
              <span class="na_tp_turntxt"><span>${p.t ? esc(p.t.why) : '안 잼'}${p.stale ? ' <small class="na_warn_txt">섹션이 바뀜</small>' : ''}</span><small>${esc(short(p.s))} · ${esc(label(p.s))}</small></span>
            </button>`).join('')}</div>`;
    };

    const draw = () => {
        data = peopleData(m);
        $root.find('.na_people_tabs button').each(function () { $(this).toggleClass('on', this.dataset.v === view).attr('aria-selected', this.dataset.v === view); });
        $root.find('.na_people_body').html(view === 'book' ? book() : view === 'map' ? map() : temp());
    };
    const go = st => { $root.closest('dialog').find('.popup-button-ok').trigger('click'); gotoSection(st); };
    $root.on('click', '.na_people_tabs button', function () { view = this.dataset.v; draw(); });
    // 도감
    $root.on('click', '.na_pb_pick', function () { sel = String($(this).data('n')); draw(); });
    $root.on('click', '.na_v2_under button', function () { tab = this.dataset.t; draw(); });
    $root.on('click', '.na_pb_more', () => { showAll = true; draw(); });
    $root.on('click', '.na_pb_addbtn', () => { adding = !adding; draw(); if (adding) $root.find('.na_people_name').trigger('focus'); });
    // 관계도
    $root.on('click', '.na_ego_node', function () { other = String($(this).data('n')); draw(); });
    $root.on('click', '.na_ego_center', function () { center = String($(this).data('n')); other = null; draw(); });
    $root.on('click', '.na_ego_secs', () => $root.find('.na_ego_seclist').prop('hidden', (i, h) => !h));
    // 온도
    $root.on('change', '.na_temp_sel', function () { tpair = this.value; draw(); });
    $root.on('click', '.na_temp_go', function () { tpair = String($(this).data('k')); view = 'temp'; draw(); });
    $root.on('click', '.na_tp_listbtn', () => $root.find('.na_tp_list').prop('hidden', (i, h) => !h));
    $root.on('click', '.na_tp_tile, .na_tp_turn, .na_tp_row, .na_v2_btn[data-start], .na_ref_chip', function () { go(Number(this.dataset.start)); });
    $root.on('click', '.na_temp_run', async function () {
        if (busy) return;
        const pair = data.pairs.find(p => data.pairKey(p.a, p.b) === tpair);
        if (!pair) return;
        const all = this.dataset.all === '1';
        const secs = tempPoints(m, pair).filter(p => all || !p.t || p.stale).map(p => p.s);
        if (all && !await confirm('전부 다시', `${pair.a} · ${pair.b}이 함께 나온 섹션 ${secs.length}개를 모두 다시 잴까요?`)) return;
        busy = true;
        const $b = $(this);
        const got = await withSpinner($b, '재는 중…', () => rateTemps(m, pair, secs, (i, n) => n > 1 && $b.html(`<i class="fa-solid fa-spinner fa-spin"></i> ${i}/${n}번째 읽는 중…`)));
        busy = false;
        if (got !== null) { if (got < secs.length) toastr.warning(`${secs.length}개 중 ${got}개만 점수가 왔어요. 남은 건 다시 눌러 주세요.`); draw(); }
    });
    // faces and the roster
    const save = async () => { saveGlobal(); draw(); };
    let target = null;
    $root.on('click', '.na_face_btn', function () { target = String($(this).closest('.na_pb_card').data('n')); $root.find('.na_face_file').val('').trigger('click'); });
    $root.find('.na_face_file').on('change', async function () {
        const f = this.files?.[0];
        if (!f || !target) return;
        try { g.faces[nameKey(target)] = await shrinkFace(f); await save(); }
        catch (e) { toastr.error(`그림을 못 읽었어요: ${e.message || e}`); }
    });
    $root.on('click', '.na_face_st', async () => { delete g.faces[nameKey(sel)]; await save(); });
    $root.on('click', '.na_face_none', async () => { g.faces[nameKey(sel)] = 'none'; await save(); });
    $root.on('click', '.na_person_del', async () => {
        const k = nameKey(sel);
        m.people = (m.people || []).filter(x => nameKey(x) !== k);
        sel = null;
        await saveMeta(); draw();
    });
    const add = async () => {
        const v = String($root.find('.na_people_name').val() || '').trim();
        if (!v) return;
        if (data.names.some(n => nameKey(n) === nameKey(v))) return toastr.info('이미 있는 인물이에요.');
        m.people = [...(Array.isArray(m.people) ? m.people : []), v];
        sel = v; adding = false;
        await saveMeta(); draw();
    };
    $root.on('click', '.na_people_addbtn', add);
    $root.on('keydown', '.na_people_name', e => { if (e.key === 'Enter' && !e.originalEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); add(); } });
    draw();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// ---------------------------------------------------------------- prompt x-ray
// The last prompt actually sent (chat completion messages or the text-completion string), split into what we can recognize:
// this archive, other extensions' injections, world info entries, character card, persona, chat messages. Kept in memory only.
let xrayArmed = false;
let xrayWI = [];
let xrayLast = null;

const XRAY_CATS = {
    archive: { name: '서사 아카이브', color: 'var(--na-accent)' },
    chat: { name: '대화 기록', color: '#a99c92' },
    dup: { name: '압축됐는데 원문도 들어간 대화', color: '#d23b2c' },
    wi: { name: '월드인포', color: '#7b5bc4' },
    card: { name: '캐릭터 카드', color: '#3d6fb6' },
    ext: { name: '다른 확장', color: '#c99a1e' },
    other: { name: '그 외 (시스템 프롬프트 등)', color: '#c9bcb1' },
    persona: { name: '페르소나', color: '#2e9a7a' },
};

function xrayArm(type, _opts, dryRun) {
    if (dryRun || type === 'quiet') return;
    xrayArmed = true; xrayWI = [];
}

function xrayWorldInfo(entries) {
    if (!xrayArmed) return;
    const list = Array.isArray(entries) ? entries : Object.values(entries || {});
    for (const e of list) {
        const content = String(e?.content || '').trim();
        if (content) xrayWI.push({ label: String(e.comment || (Array.isArray(e.key) ? e.key.join(', ') : e.key) || '항목'), text: content });
    }
}

function xrayCapture(data) {
    if (!xrayArmed || data?.dryRun) return;
    let messages;
    const flat = x => typeof x === 'string' ? x : Array.isArray(x) ? x.map(p => p?.text || '').join('\n') : '';
    if (Array.isArray(data?.chat)) messages = data.chat.map(x => ({ role: String(x?.role || ''), name: x?.name || '', content: flat(x?.content) }));
    else if (typeof data?.prompt === 'string') messages = [{ role: 'text', content: data.prompt }];
    else return;
    xrayArmed = false;
    const c = ctx();
    const m = getMeta();
    const sub = s => { try { return c.substituteParams ? c.substituteParams(String(s || '')) : String(s || ''); } catch { return String(s || ''); } };
    const ids = c.groupId ? (c.groups || []).find(g => g.id === c.groupId)?.members || [] : [];
    const chars = c.groupId ? (c.characters || []).filter(ch => ids.includes(ch.avatar)) : [c.characters?.[c.characterId]].filter(Boolean);
    const cards = [];
    for (const ch of chars) {
        for (const [f, label] of [['description', '설명'], ['personality', '성격'], ['scenario', '시나리오'], ['mes_example', '예시 대화']]) {
            const t = sub(ch[f] ?? ch.data?.[f]).trim();
            if (t) cards.push({ label: `${ch.name} ${label}`, text: t });
        }
        const sp = sub(ch.data?.system_prompt).trim(), ph = sub(ch.data?.post_history_instructions).trim();
        if (sp) cards.push({ label: `${ch.name} 카드 시스템 프롬프트`, text: sp });
        if (ph) cards.push({ label: `${ch.name} 카드 마지막 지시`, text: ph });
    }
    const ext = Object.entries(c.extensionPrompts || {}).filter(([k, v]) => k !== PROMPT_KEY && String(v?.value || '').trim()).map(([k, v]) => ({ label: k, text: String(v.value).trim() }));
    xrayLast = {
        at: Date.now(), chatId: currentChatId(), messages,
        archive: m?.enabled && lastBuild.text ? lastBuild.text.trim() : '',
        wi: xrayWI, ext, cards,
        persona: sub(c.powerUserSettings?.persona_description).trim(),
        chat: (c.chat || []).map((x, i) => ({ i, text: String(x?.mes || '').trim(), hidden: !!x?.is_system })),
        boundary: m?.boundary ?? -1, keep: Math.max(0, Number(m?.keep) || 0),
    };
    $('#na_tool_xray_sub').text(`마지막: ${timeLabel(xrayLast.at)} · 메시지 ${messages.length}개`);
}

const xrayNorm = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// spans [{msg, a, b, cat, label}] for every recognized piece, then sentences that appear more than once
function xrayAnalyze(x) {
    const spans = [];
    const free = (mi, a, b) => !spans.some(s => s.msg === mi && a < s.b && b > s.a);
    const place = (part, from = { msg: 0, pos: 0 }) => {
        const t = part.text;
        if (t.length < 12) return null;
        const head = t.length > 160 ? t.slice(0, 120) : t;
        for (let mi = from.msg; mi < x.messages.length; mi++) {
            const content = x.messages[mi].content;
            let p = content.indexOf(t, mi === from.msg ? from.pos : 0), len = t.length;
            if (p < 0 && head !== t) { p = content.indexOf(head, mi === from.msg ? from.pos : 0); len = Math.min(t.length, content.length - p); }
            if (p >= 0 && free(mi, p, p + len)) { const s = { msg: mi, a: p, b: p + len, cat: part.cat, label: part.label, i: part.i }; spans.push(s); return s; }
        }
        return null;
    };
    if (x.archive) place({ cat: 'archive', label: '서사 아카이브', text: x.archive });
    for (const p of x.ext) place({ cat: 'ext', label: `확장: ${p.label}`, text: p.text });
    for (const p of x.wi) place({ cat: 'wi', label: `월드인포: ${p.label}`, text: p.text });
    for (const p of x.cards) place({ cat: 'card', label: p.label, text: p.text });
    if (x.persona) place({ cat: 'persona', label: '페르소나', text: x.persona });
    // chat messages keep their order, so each search starts after the previous hit
    let cur = { msg: 0, pos: 0 };
    const dupEnd = x.boundary - x.keep;
    for (const ch of x.chat) {
        if (ch.hidden || !ch.text) continue;
        const s = place({ cat: x.boundary >= 0 && ch.i <= dupEnd ? 'dup' : 'chat', label: `대화 #${ch.i}`, text: ch.text, i: ch.i }, cur);
        if (s) cur = { msg: s.msg, pos: s.b };
    }
    spans.sort((p, q) => p.msg - q.msg || p.a - q.a);
    // sentences seen in two or more places
    const seen = new Map();
    x.messages.forEach((msg, mi) => {
        for (const mt of msg.content.matchAll(/[^\n.!?。]+[.!?。]?/g)) {
            const raw = mt[0].trim();
            const n = xrayNorm(raw);
            if (n.length < 30 || n.split(' ').length < 5) continue;
            const pos = mt.index;
            const sp = spans.find(s => s.msg === mi && pos >= s.a && pos < s.b);
            const where = sp ? sp.label : `메시지 ${mi + 1} (그 외)`;
            if (!seen.has(n)) seen.set(n, { text: raw, at: [] });
            seen.get(n).at.push({ where, cat: sp ? sp.cat : 'other', msg: mi });
        }
    });
    const groups = new Map();
    for (const d of seen.values()) {
        if (d.at.length < 2) continue;
        const places = [...new Set(d.at.map(a => a.where.replace(/^대화 #\d+$/, '대화 기록')))];
        if (places.length === 1 && places[0] === '대화 기록') continue; // the chat repeating itself is normal
        const key = places.sort().join(' ↔ ');
        if (!groups.has(key)) groups.set(key, { places, items: [], chars: 0 });
        const g = groups.get(key);
        g.items.push(d.text); g.chars += d.text.length * (d.at.length - 1);
    }
    return { spans, dups: [...groups.values()].sort((a, b) => b.chars - a.chars) };
}

// keyword-linked sections: how often each actually went in (measured per generation, or estimated from the chat), and what to look at
async function keywordBlock(m) {
    const lm = linkedMap(m);
    const keys = Object.keys(lm).filter(k => Array.isArray(lm[k]) && lm[k].length);
    const secs = parseSections(m.text).filter(x => !x.group);
    const byKey = new Map(secs.map(x => [sectionKey(x), x]));
    const big = [];
    for (const x of secs) { const t = await cachedTokens(m.text.slice(x.start, x.end)); if (t > 2500) big.push({ x, t }); }
    if (!keys.length && !big.length) return '';
    const st = m.linkStats || { gens: 0, on: {} };
    const kstat = keywordStats(m);
    const waiting = linkWaiting(m), muted = mutedSet(m);
    const rows = [];
    for (const k of keys) {
        const x = byKey.get(k);
        if (!x || muted.has(k)) continue;
        const measured = st.gens >= 10;
        const rate = measured ? (st.on?.[k] || 0) / st.gens : kstat.fireRate(lm[k]);
        const flag = rate >= 0.6 ? '너무 자주 켜져요 — 키워드가 넓어요' : measured && st.gens >= 30 && rate === 0 ? '한 번도 안 켜졌어요 — 키워드를 봐 주세요' : '';
        rows.push({ x, k, rate, measured, flag, tok: await cachedTokens(m.text.slice(x.start, x.end)), now: !waiting.has(k) });
    }
    rows.sort((a, b) => (!!b.flag - !!a.flag) || b.rate - a.rate);
    const short = x => (x.title.match(/^(?:\S{1,12}\s)?#\d+\s*[–—~-]\s*#?\d+/) || [x.title.slice(0, 30)])[0];
    return `
      ${rows.length ? `<div class="na_v2_label">키워드 섹션 <small>${st.gens >= 10 ? `생성 ${fmt(st.gens)}번 기록` : '채팅으로 추정'}</small></div>
      <div class="na_v2_card na_v2_list na_xr_kw">${rows.map(r => `
        <button type="button" class="na_xr_kwrow ${r.flag ? 'flag' : ''}" data-start="${r.x.start}" data-k="${esc(r.k)}">
          <span class="na_xr_kwtxt"><span>${esc(short(r.x))}</span><small>${r.flag ? esc(r.flag) : `${fmt(r.tok)} 토큰 · 지금 ${r.now ? '켜짐' : '대기'}`}</small></span>
          <span class="na_xr_kwbar"><i style="width:${Math.max(2, Math.round(r.rate * 100))}%"></i></span>
          <b>${pct(r.rate)}</b>
        </button>`).join('')}</div>` : ''}
      ${big.length ? `<div class="na_v2_label">아주 큰 섹션 <small>다시 압축하거나 나누면 좋아요</small></div>
      <div class="na_v2_card na_v2_list">${big.sort((a, b) => b.t - a.t).map(b => `<button type="button" class="na_cal_item" data-start="${b.x.start}"><span class="na_cal_txt"><span>${esc(b.x.title)}</span><small>${fmt(b.t)} 토큰</small></span></button>`).join('')}</div>` : ''}`;
}

async function openXray() {
    const c = ctx();
    const x = xrayLast && xrayLast.chatId === currentChatId() ? xrayLast : null;
    const $root = $(`
      <div class="na_popup na_v2 na_xray">
        <div class="na_v2_title"><b>프롬프트 X-ray</b><small>${x ? `마지막으로 보낸 프롬프트 · ${esc(timeLabel(x.at))}` : '마지막으로 보낸 프롬프트'}</small></div>
        <div class="na_xray_body">${x ? '<div class="na_empty">살펴보는 중…</div>' : '<div class="na_empty">아직 기록된 프롬프트가 없어요. 이 채팅에서 응답을 한 번 받으면 여기 보여요. (실리태번을 새로 고치면 기록이 지워져요)</div>'}</div>
      </div>`);
    const popup = c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
    const m = getMeta();
    $root.append('<div class="na_v2 na_xr_kwhost"></div>');
    keywordBlock(m).then(html => $root.find('.na_xr_kwhost').html(html));
    $root.on('click', '.na_xr_kwrow', async function () {
        const k = String($(this).data('k')), x0 = parseSections(m.text).find(y => sectionKey(y) === k);
        if (!x0) return;
        const ks = await openKeywords(x0, m.text.slice(x0.start, x0.end), linkedMap(m)[k] || []);
        if (ks) { await setLinked(k, ks); keywordBlock(m).then(html => $root.find('.na_xr_kwhost').html(html)); }
    });
    $root.on('click', '.na_xr_kwhost .na_cal_item', function () { const st = Number(this.dataset.start); $root.closest('dialog').find('.popup-button-ok').trigger('click'); gotoSection(st); });
    if (!x) return popup;
    const { spans, dups } = xrayAnalyze(x);
    // tokens per category: recognized spans, and the rest of each message as "other"
    const byCat = Object.fromEntries(Object.keys(XRAY_CATS).map(k => [k, []]));
    x.messages.forEach((msg, mi) => {
        let at = 0;
        for (const s of spans.filter(s => s.msg === mi)) { if (s.a > at) byCat.other.push(msg.content.slice(at, s.a)); byCat[s.cat].push(msg.content.slice(s.a, s.b)); at = s.b; }
        if (at < msg.content.length) byCat.other.push(msg.content.slice(at));
    });
    const tok = {};
    for (const [k, list] of Object.entries(byCat)) tok[k] = list.join('').trim() ? await countTokens(list.join('\n')) : 0;
    const total = Object.values(tok).reduce((a, b) => a + b, 0) || 1;
    const dupChats = spans.filter(s => s.cat === 'dup').map(s => s.i);
    const order = Object.keys(XRAY_CATS).filter(k => tok[k]).sort((a, b) => tok[b] - tok[a]);
    const pct = k => Math.max(1, Math.round(tok[k] / total * 100));
    $root.find('.na_xray_body').html(`
      <div class="na_v2_card na_xr_card">
        <div class="na_xr_total"><span><b>${fmt(total)}</b>토큰</span><small>메시지 ${x.messages.length}${x.wi.length ? ` · 월드인포 ${x.wi.length}` : ''}</small></div>
        <div class="na_xr_bar">${order.map(k => `<span style="flex:${tok[k]} 1 0;background:${XRAY_CATS[k].color}" title="${esc(XRAY_CATS[k].name)} ${fmt(tok[k])}"></span>`).join('')}</div>
        <div class="na_xr_rows">${order.map(k => `
          <div class="na_xr_row ${k === 'dup' ? 'bad' : ''}"><i style="background:${XRAY_CATS[k].color}"></i><span>${esc(XRAY_CATS[k].name)}</span><b>${fmt(tok[k])}</b><small>${pct(k)}%</small></div>`).join('')}
        </div>
      </div>
      ${dupChats.length ? `
      <div class="na_xr_warn">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div>
          <b>압축한 대화 ${dupChats.length}개가 원문으로도 들어갔어요</b>
          <span>#${Math.min(...dupChats)}–#${Math.max(...dupChats)} · 약 ${fmt(tok.dup)} 토큰이 아카이브와 겹쳐요</span>
          <button type="button" class="na_v2_btn danger na_xray_hide"><i class="fa-solid fa-eye-slash"></i> 경계선까지 숨기기</button>
        </div>
      </div>` : ''}
      <div class="na_v2_label">겹치는 문장 <small>${dups.length ? `${dups.length}묶음 · ${fmt(dups.reduce((a, d) => a + d.chars, 0))}자` : '없음'}</small></div>
      ${dups.length ? dups.slice(0, 12).map(d => `
        <div class="na_v2_card na_xr_dup">
          <div class="na_xr_places">${d.places.map(p => `<span class="na_xr_place ${/^월드인포/.test(p) ? 'wi' : /^서사 아카이브/.test(p) ? 'arc' : ''}">${esc(p)}</span>`).join('<i class="fa-solid fa-arrows-left-right"></i>')}</div>
          ${d.items.slice(0, 2).map(t => `<q>${esc(t.length > 220 ? t.slice(0, 220) + '…' : t)}</q>`).join('')}
          ${d.items.length > 2 ? `<details class="na_v2_more"><summary>${d.items.length - 2}문장 더</summary>${d.items.slice(2, 12).map(t => `<q>${esc(t.length > 220 ? t.slice(0, 220) + '…' : t)}</q>`).join('')}</details>` : ''}
        </div>`).join('') : '<small class="na_v2_note">두 군데 이상 들어간 문장이 없어요.</small>'}`);
    $root.on('click', '.na_xray_hide', async function () { await applyHide(); $(this).prop('disabled', true).text('숨겼어요 · 다음 응답부터 빠져요'); });
    return popup;
}

async function openHealth() {
    const c = ctx();
    const m = getMeta();
    const $root = $(`<div class="na_popup na_v2 na_hl2"><div class="na_health_body na_v2"><div class="na_empty">점검하는 중…</div></div></div>`);
    const render = async () => {
        const h = await healthChecks(m);
        const fix = h.items.map((x, i) => ({ x, i })).filter(({ x }) => x.level === 'bad' || x.level === 'warn');
        const info = h.items.map((x, i) => ({ x, i })).filter(({ x }) => x.level === 'info');
        const ok = h.items.filter(x => x.level === 'ok');
        const tone = h.score >= 90 ? 'good' : h.score >= 70 ? 'mid' : 'low';
        const word = h.score >= 90 ? '건강해요' : h.score >= 70 ? '거의 괜찮아요' : '손볼 곳이 있어요';
        const R = 38, C = 2 * Math.PI * R;
        const item = ({ x, i }) => `
          <div class="na_v2_card na_hl2_item ${x.level}">
            <span class="na_hl2_bar"></span>
            <div class="na_hl2_main">
              <b>${esc(x.title)}</b>
              ${x.detail ? `<small>${esc(x.detail).replace(/\n/g, '<br>')}</small>` : ''}
              ${x.fix ? `<button type="button" class="na_v2_btn ${x.level === 'bad' ? 'danger' : 'primary'} na_health_fix" data-i="${i}">${esc(x.fix.label)}</button>` : ''}
            </div>
          </div>`;
        $root.find('.na_health_body').html(`
          <div class="na_v2_card na_hl2_top">
            <div class="na_hl2_ring ${tone}">
              <svg viewBox="0 0 92 92" width="92" height="92"><circle cx="46" cy="46" r="${R}" class="bg"/><circle cx="46" cy="46" r="${R}" class="fg" stroke-dasharray="${(C * h.score / 100).toFixed(1)} 999" transform="rotate(-90 46 46)"/></svg>
              <span><b>${h.score}</b><small>점</small></span>
            </div>
            <div class="na_hl2_sum"><b>${word}</b><small>AI 없이 번호·숨기기·키워드·백업을 훑어봤어요.${fix.length ? ` 고칠 것 ${fix.length}개` : ''}${info.length ? `, 참고 ${info.length}개` : ''}</small></div>
          </div>
          ${fix.length ? `<div class="na_v2_label">고칠 것</div>${fix.map(item).join('')}` : ''}
          ${info.length ? `<div class="na_v2_label">참고</div>${info.map(item).join('')}` : ''}
          ${ok.length ? `<details class="na_v2_card na_v2_more na_hl2_ok"><summary><i class="fa-solid fa-check"></i> 괜찮은 것 <b>${ok.length}</b>개</summary><ul>${ok.map(x => `<li>${esc(x.title)}</li>`).join('')}</ul></details>` : ''}`);
        $root.find('.na_health_fix').on('click', async function () {
            const it = h.items[Number(this.dataset.i)];
            $(this).prop('disabled', true);
            try { await it.fix.run(); } finally { setTimeout(render, 300); }
        });
    };
    render();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
    refreshStatusSoon();
}


// ---------------------------------------------------------------- viewer popup

async function openReader() {
    const c = ctx();
    const $root = $(`
      <div class="na_popup">
        <div class="na_rd_bar">
          <select class="text_pole na_rd_toc"></select>
          <button type="button" class="na_icon na_rd_smaller" title="글자 작게"><i class="fa-solid fa-minus"></i></button>
          <button type="button" class="na_icon na_rd_bigger" title="글자 크게"><i class="fa-solid fa-plus"></i></button>
        </div>
        <div class="na_rd_trbar">
          <button type="button" class="na_btn na_small na_rd_tr"><i class="fa-solid fa-language"></i> 한국어로 읽기</button>
          <button type="button" class="na_linkbtn na_rd_gloss"><i class="fa-solid fa-spell-check"></i> 용어집</button>
          <small class="na_dim na_rd_trinfo"></small>
        </div>
        <article class="na_reader"></article>
      </div>`);
    const g = globalSettings();
    const applyFont = () => $root.find('.na_reader').css('font-size', `${g.readSize || 1}em`);
    const { html, toc } = renderReading(getMeta());
    $root.find('.na_reader').html(html || '<div class="na_empty">아카이브가 비어 있어요.</div>');
    $root.find('.na_rd_toc').html('<option value="">목차로 이동…</option>' + toc.map(t =>
        `<option value="${t.id}">${'\u00a0\u00a0'.repeat(Math.max(0, t.level - 1))}${esc(t.title)}</option>`).join(''));
    applyFont();
    $root.find('.na_rd_toc').on('change', function () {
        const el = this.value && $root.find(`#${this.value}`)[0];
        if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
        this.value = '';
    });
    // ---- whole-archive Korean: line by line, kept in the chat's translation memory
    const m = getMeta();
    const lineOk = l => /[\p{L}]{2,}/u.test(l) && !/^\s*-{3,}\s*$/.test(l);
    let korean = false, busy = false;
    const lineMap = new Map();
    const show = raw => raw.split('\n').map(l => {
        if (!lineOk(l)) return l;
        const t = lineMap.get(l.trim());
        if (!t) return l;
        // keep the line's markdown lead ("## ", "- ") if the model dropped it
        const lead = l.match(/^\s*(#{1,3} |[-*] )/)?.[1] || '';
        return lead ? `${lead}${t.replace(/^\s*(?:#{1,3}|[-*])\s+/, '')}` : t;
    }).join('\n');
    const rerender = () => {
        const top = $root.closest('.popup-content, dialog').scrollTop?.() ?? 0;
        $root.find('.na_reader').html(renderReading(m, korean ? { show } : {}).html);
        $root.closest('.popup-content, dialog').scrollTop?.(top);
    };
    const runTr = async (fresh = false) => {
        if (busy) return;
        busy = true;
        const $b = $root.find('.na_rd_tr').prop('disabled', true);
        const secs = parseSections(m.text);
        const all = [...new Set(m.text.split('\n').filter(lineOk).map(l => l.trim()))];
        // sections in groups of ~10k characters so the reader fills in as it goes
        const groups = [];
        let cur = [], size = 0;
        for (const s of secs) {
            const ls = m.text.slice(s.start, s.end).split('\n').filter(lineOk).map(l => l.trim());
            cur.push(...ls); size += ls.join('').length;
            if (size > 10_000) { groups.push(cur); cur = []; size = 0; }
        }
        if (cur.length) groups.push(cur);
        let failed = 0;
        try {
            for (let i = 0; i < groups.length; i++) {
                if (!$root.closest('body').length) return; // popup closed
                $b.html(`<i class="fa-solid fa-spinner fa-spin"></i> 번역하는 중… ${i + 1}/${groups.length}`);
                const uniq = [...new Set(groups[i])];
                const tr = await translateLines(uniq, { fresh });
                uniq.forEach((l, k) => tr[k] ? lineMap.set(l, tr[k]) : failed++);
                korean = true;
                rerender();
            }
        } catch (e) {
            toastr.error(String(e?.message || e), '번역 실패');
        } finally {
            busy = false;
            $b.prop('disabled', false).html(korean ? '<i class="fa-solid fa-language"></i> 원문으로 보기' : '<i class="fa-solid fa-language"></i> 한국어로 읽기');
            const done = all.filter(l => lineMap.has(l)).length;
            $root.find('.na_rd_trinfo').html(korean ? `${done}/${all.length}줄 번역됨 · <button type="button" class="na_linkbtn na_rd_retr">다시 번역</button>` : '');
            if (failed) toastr.info(`${failed}줄은 번역이 안 왔어요. 다시 누르면 그 줄만 보내요.`);
        }
    };
    $root.find('.na_rd_tr').on('click', () => {
        if (korean && !busy) { korean = false; rerender(); $root.find('.na_rd_tr').html('<i class="fa-solid fa-language"></i> 한국어로 읽기'); $root.find('.na_rd_trinfo').empty(); return; }
        runTr(false);
    });
    $root.on('click', '.na_rd_retr', async () => {
        if (!await confirm('다시 번역', '저장된 번역을 쓰지 않고 아카이브 전체를 새로 번역할까요? 토큰이 들어가요.')) return;
        runTr(true);
    });
    $root.find('.na_rd_gloss').on('click', async () => { await openGlossary(); if (korean) runTr(false); });
    $root.find('.na_rd_smaller, .na_rd_bigger').on('click', function () {
        const d = $(this).hasClass('na_rd_bigger') ? 0.1 : -0.1;
        g.readSize = Math.min(1.6, Math.max(0.8, Math.round(((g.readSize || 1) + d) * 10) / 10));
        saveGlobal(); applyFont();
    });
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// ---------------------------------------------------------------- AI helpers
// Everything AI here only drafts or checks: results land in a box or a form, never straight in the archive.

// Connection Manager profiles that can send a request (empty if the extension is off)
function aiProfiles() {
    try { return ctx().ConnectionManagerRequestService?.getSupportedProfiles?.() || []; } catch { return []; }
}

const stripThink = t => String(t ?? '').replace(/<(think|thinking|reasoning)[^>]*>[\s\S]*?<\/\1>/gi, '').trim();

// Sends one request: to the chosen Connection Manager profile, or to whatever is connected now.
async function askAI(prompt, { system = '', maxTokens = 0 } = {}) {
    const c = ctx();
    const g = globalSettings();
    const max = Math.max(64, Number(maxTokens) || Number(g.aiMaxTokens) || 8192);
    let out;
    const a = connSettings('ai');
    if (a.mode === 'custom' || a.mode === 'vertex') {
        out = await callConn(a, system, prompt, max);
    } else if (g.aiProfile) {
        const p = aiProfiles().find(x => x.id === g.aiProfile);
        if (!p) throw new Error('고른 연결 프로필을 찾을 수 없어요. ⚙ 설정 → AI · 번역에서 다시 골라 주세요.');
        const msgs = [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }];
        const r = await c.ConnectionManagerRequestService.sendRequest(p.id, msgs, max, { stream: false, extractData: true, includePreset: true, includeInstruct: true });
        out = typeof r === 'string' ? r : r?.content;
    } else {
        if (typeof c.generateRaw !== 'function') throw new Error('이 실리태번 버전에서는 AI 호출을 쓸 수 없어요');
        out = await c.generateRaw({ prompt, systemPrompt: system, responseLength: max });
    }
    out = stripThink(out);
    if (!out) throw new Error('모델이 빈 답을 돌려줬어요');
    return out;
}

const aiLabel = () => {
    const g = globalSettings();
    const a = connSettings('ai');
    if (a.mode === 'custom') return `커스텀 · ${a.model || '모델 없음'}`;
    if (a.mode === 'vertex') return `Vertex · ${a.vxModel || '모델 없음'}`;
    const p = g.aiProfile && aiProfiles().find(x => x.id === g.aiProfile);
    return p ? p.name : '지금 연결된 모델';
};

// Runs fn while the button shows a spinner; errors become a toast. Returns fn's result or null.
async function withSpinner($btn, busyText, fn) {
    const html = $btn.html();
    $btn.prop('disabled', true).html(`<i class="fa-solid fa-spinner fa-spin"></i> ${esc(busyText)}`);
    try { return await fn(); }
    catch (e) { console.error('[NarrativeArchive] AI', e); toastr.error(String(e?.message || e), 'AI 요청 실패'); return null; }
    finally { $btn.prop('disabled', false).html(html); }
}

// Plain text from the model → safe HTML with line breaks and **bold**
const aiHtml = t => String(t).split('\n').map(mdInline).join('<br>');

// ---- keyword candidates (no AI): capitalised words that keep coming back in a section

const KW_STOP = new Set(('The A An And But Or Nor If When Then After Before While As At In On Of To For From With Without Into Onto Upon By '
    + 'He She They It We I You His Her Hers Their Its Our My Your Him Them Us Me This That These Those There Here What Who Whom Whose Why How Where Which '
    + 'Not No Yes So Yet Once Still Even Only Also Both Each Every All Some Any None One Two Three Four Five First Second Last Next '
    + 'Day Night Morning Evening Afternoon Dawn Noon Midnight Today Tomorrow Yesterday Mr Mrs Ms Lord Lady Sir '
    + 'Was Were Is Are Be Been Had Has Have Did Does Do Will Would Could Should Can May Might Must Just Now Never Always Again').split(/\s+/));

const capWords = text => [...String(text).matchAll(/\b[A-Z][a-z][A-Za-z'’]*/g)].map(x => x[0].replace(/['’]s$/, '')).filter(w => w.length > 2 && !KW_STOP.has(w));

// Ranks words of one section by how much they belong to it: frequent here, rare in the other sections,
// and not in most chat messages (a keyword that is everywhere keeps the section always on).
const KW_STOP_LOW = new Set([...KW_STOP].map(w => w.toLowerCase()).concat(('about above across against along among around away back because being below beside '
    + 'between beyond could down during else ever every from further give gave given going gone have having into itself just keep kept know knew '
    + 'last left less like made make more most much must near need never only other others over own rather same said says seem seemed shall since '
    + 'some something still such than that their them then there these they thing things think thought those though through till under until upon '
    + 'very want wanted were what when where which while whom will with within without would your yours herself himself themselves '
    + 'asked told took take come came went look looked felt feel turned turn tell telling let used once both each even also only again '
    + 'plot state open note true never ever already '
    // everyday scene words: in almost any chat, so they would keep a section on
    + 'inside outside whole part bring brought held hold mind voice eyes face hand hands body head room night morning '
    + 'bed kiss kissed smile smiled laugh laughed looked moment time times today away side front behind word words '
    + 'answer answered someone anyone everyone nothing anything everything people place thing others while').split(/\s+/)));

const KW_DET = /^(?:a|an|the|his|her|their|my|your|our|its|this|that|these|those|no|any|some|one|two|three|four|five|first|second|every|each)$/;

function kwTerms(text) {
    const out = [];
    for (const chunk of String(text).split(/[.,;:!?()\[\]{}"“”—–→←·|\n]+/)) {
        const raw = chunk.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
        let prev = null, before = '';
        for (const r0 of raw) {
            const w = r0.replace(/['’]s$/i, '');
            const low = w.toLowerCase();
            const cap = /^[A-Z]/.test(w);
            const ok = !KW_STOP_LOW.has(low) && (low.length >= 4 || (cap && low.length >= 3));
            // after "a / the / her / god's / three ..." it is most likely a noun: a thing that gets talked about
            const noun = KW_DET.test(before) || /['’]s$/i.test(before);
            if (ok) out.push({ t: low, show: w, noun });
            before = r0.toLowerCase();
            if (ok && prev) out.push({ t: `${prev.t} ${low}`, show: `${prev.show} ${w}`, bi: true });
            prev = ok ? { t: low, show: w } : null;
        }
    }
    return out;
}

function keywordAnalysis(m, s, body) {
    const secs = parseSections(m.text).filter(x => !x.group && x.title !== '(머리말)' && x.title !== '(제목 없음)');
    const N = Math.max(1, secs.length);
    const df = new Map();
    for (const x of secs) for (const t of new Set(kwTerms(m.text.slice(x.start, x.end)).map(y => y.t))) df.set(t, (df.get(t) || 0) + 1);
    const tf = new Map(), shown = new Map(), nouns = new Set();
    for (const y of kwTerms(body)) {
        tf.set(y.t, (tf.get(y.t) || 0) + 1);
        if (y.noun) nouns.add(y.t);
        const sv = shown.get(y.t) || new Map();
        sv.set(y.show, (sv.get(y.show) || 0) + 1);
        shown.set(y.t, sv);
    }
    // the title's subject ("I want a child") counts; its range and the "(date, place)" note do not
    const subject = s.title.replace(RANGE_HEAD, '$5').replace(/^\s*[—–-]\s*/, '').replace(/\([^)]*\)/g, ' ');
    const inTitle = new Set(kwTerms(subject).map(y => y.t));
    const inNote = new Set(kwTerms((s.title.match(/\(([^)]*)\)/g) || []).join(' ')).map(y => y.t));
    const stat = keywordStats(m);
    const rows = [...tf.keys()].map(t => {
        const d = df.get(t) || 1;
        const chat = stat.chatPct(t);
        const bi = t.includes(' ');
        let score = tf.get(t) * Math.log((N + 1) / (d + 0.5)) * (inTitle.has(t) ? 2.5 : 1) * (bi ? 0.8 : 1);
        if (bi && tf.get(t) < 2 && !inTitle.has(t)) score *= 0.3;
        if (inNote.has(t) && !inTitle.has(t)) score *= 0.4; // a place or date from the title's note
        if (!bi && /(?:ed|ing)$/.test(t) && !inTitle.has(t)) score *= 0.35; // verbs make poor triggers
        if (!bi && /ly$/.test(t)) score *= 0.3;
        if (nouns.has(t)) score *= 1.8;
        const show = [...shown.get(t)].sort((x, y) => y[1] - x[1])[0][0];
        const broad = (N >= 4 && d / N > 0.3) || chat > 0.2;
        return { t, show, tf: tf.get(t), df: d, chat, score, broad, title: inTitle.has(t), noun: nouns.has(t) };
    });
    // "child" covers "children": keep the shorter stem when both are candidates
    const keep = rows.filter(r => !rows.some(o => o !== r && !o.t.includes(' ') && o.t.length >= 4 && r.t.startsWith(o.t) && r.t !== o.t && !r.t.includes(' ')));
    const distinct = keep.filter(r => !r.broad && (r.tf >= 2 || r.title || r.noun) && !(r.t.includes(' ') && r.tf < 2 && !r.title)).sort((a, b) => b.score - a.score).slice(0, 12);
    const broad = keep.filter(r => r.broad && !r.t.includes(' ')).sort((a, b) => b.tf - a.tf).slice(0, 8);
    return { distinct, broad, N, stat };
}

// how often a keyword would fire: share of chat messages containing it, sections mentioning it
function keywordStats(m) {
    const msgs = (ctx().chat || []).filter(Boolean).map(x => String(x.mes || '').toLowerCase());
    const secs = parseSections(m.text).filter(x => !x.group);
    const secTexts = secs.map(x => m.text.slice(x.start, x.end).toLowerCase());
    const cache = new Map();
    const chatPct = w => {
        const k = String(w).toLowerCase();
        if (!k || !msgs.length) return 0;
        if (!cache.has(k)) cache.set(k, msgs.filter(x => x.includes(k)).length / msgs.length);
        return cache.get(k);
    };
    const secCount = w => { const k = String(w).toLowerCase(); return secTexts.filter(x => x.includes(k)).length; };
    // share of messages where any of `list` shows up
    const fireRate = list => {
        const ks = list.map(w => String(w).toLowerCase()).filter(Boolean);
        return msgs.length && ks.length ? msgs.filter(x => ks.some(k => x.includes(k))).length / msgs.length : 0;
    };
    return { chatPct, secCount, fireRate, msgs: msgs.length, secs: secs.length };
}

const pct = x => x >= 0.995 ? '100%' : x > 0 && x < 0.01 ? '<1%' : `${Math.round(x * 100)}%`;

// warnings for one keyword as the matcher sees it
function keywordWarn(w, stat) {
    const k = String(w).trim();
    const out = [];
    const chat = stat.chatPct(k);
    if (chat > 0.3) out.push(`채팅 메시지 ${pct(chat)}에 나와요 — 거의 항상 켜져요`);
    else if (chat > 0.15) out.push(`채팅 메시지 ${pct(chat)}에 나와요 — 자주 켜져요`);
    if (/^[A-Za-z]{1,3}$/.test(k)) out.push('짧은 영어 단어라 다른 단어 속에서도 걸려요 (Set → settle)');
    if (/^[가-힣]$/.test(k)) out.push('한 글자라 다른 말 속에서도 걸려요');
    if (stat.secs >= 4 && stat.secCount(k) / stat.secs > 0.5) out.push(`섹션 ${stat.secs}개 중 ${stat.secCount(k)}개에 나오는 말이에요`);
    return out;
}

// ---- spelling near-misses (no AI): a name in the new text that is one or two letters off a name in the archive

function editDistance(a, b, cap) {
    if (Math.abs(a.length - b.length) > cap) return cap + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        let best = i;
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            if (cur[j] < best) best = cur[j];
        }
        if (best > cap) return cap + 1;
        prev = cur;
    }
    return prev[b.length];
}

function nameNearMisses(archive, add) {
    const old = new Set(capWords(archive).filter(w => w.length >= 4));
    const byFirst = new Map();
    old.forEach(w => { const k = w[0]; if (!byFirst.has(k)) byFirst.set(k, []); byFirst.get(k).push(w); });
    const out = [];
    for (const w of new Set(capWords(add).filter(x => x.length >= 4))) {
        if (old.has(w)) continue;
        const cap = w.length >= 7 ? 2 : 1;
        let hit = null, hd = cap + 1;
        for (const o of byFirst.get(w[0]) || []) {
            const d = editDistance(w, o, cap);
            if (d > 0 && d < hd) { hit = o; hd = d; }
        }
        if (hit) out.push({ word: w, like: hit });
    }
    return out;
}

// ---- prompts


const AI_SYS_ASK = `GOAL
Answer the user's question about their story using ONLY the ARCHIVE.

YOU GET
- ARCHIVE: the story so far, in sections. Each section starts with a heading line like "## Y2 #48–#63 — The night ridge". The END of the archive (latest sections, STATE, OPEN) is what is true now.
- QUESTION: what the user wants to know.

HOW TO WORK
Step 1. Find every section that is about the question. Read them fully.
Step 2. If something changed over time, give the latest state and say briefly how it got there.
Step 3. Write the answer.

RULES
- Use only what the ARCHIVE says. If it does not say, answer that it is not in the archive. Never guess or invent.
- After each claim, cite the section you used: copy its heading line exactly, inside double brackets.
    e.g. 둘은 그날 밤 약속을 했어요 [[## Y2 #48–#63 — The night ridge]]
- Always answer in Korean, whatever language the archive or the question is in.
- Write names the way the archive spells them.
- Be short and direct. No introduction.`;

const AI_SYS_KEYWORDS = `GOAL
Choose trigger keywords for ONE section of a role-play story archive.
This section stays out of the prompt until one of its keywords appears in the recent chat. So a good keyword shows up in chat exactly when this section's events matter again, and rarely at other times.

YOU GET
- SECTION TITLE and SECTION: the section to pick keywords for.
- BROAD TERMS: words that appear almost everywhere. Never use them.
- OTHER SECTIONS: titles of the rest of the archive. Prefer words that set THIS section apart from them.

GOOD KEYWORDS
The section's own subject: the topic, event, object, place, promise, wound or secret it records.
Think: what words would a character actually say when this comes up again?
    e.g. a section about a lost map → map, treasure, island

BAD KEYWORDS (never use)
- main cast names, and anything under BROAD TERMS
- everyday words that are in most scenes: bed, night, kiss, room, love, eat, hand, look
- very short English words that hide inside other words ("Set" also fires on "settle", "sunset")
- one-syllable Korean stems

HOW MATCHING WORKS
A plain, case-insensitive "contains" search over the raw chat text, which may be English or Korean.
- English: give the shortest stem that is still specific. "map" also matches "maps"; "treasur" matches "treasure" and "treasury"; "betray" matches "betrayal" and "betrayed".
- Korean: give the forms a Korean chat would really use, as stems without particles (지도, 보물, 배신), plus common synonyms.

OUTPUT: 4 to 8 lines, most important first, nothing else, exactly like this
<english stem> | <korean form>, <korean form> | <why it fits, in Korean, under 25 characters>
Example:
treasur | 보물, 금화 | 잃어버린 보물이 이 섹션의 중심`;

const AI_SYS_CONFLICT = `GOAL
Before NEW TEXT is added to the story archive, find places where it contradicts the EXISTING ARCHIVE.

YOU GET
- EXISTING ARCHIVE: the story so far. Its end (latest sections, STATE, OPEN) is what is true now.
- NEW TEXT: new section blocks to add. It may end with new STATE and OPEN blocks that will REPLACE the old ones.

HOW TO WORK
Step 1. Read the NEW TEXT one bullet at a time.
Step 2. For each bullet, check the EXISTING ARCHIVE for anything it clashes with.

REPORT ONLY THESE (each must clash with something the archive actually says)
1. NAME: the same person, place or thing spelled differently. e.g. "Mirabel" in the archive, "Mirabelle" in the new text.
2. TIME: dates or time of day going backwards compared with where the archive ended.
3. FACT: a fact that contradicts one already established (who did what, injuries, objects, relationships, places).
4. SETTLED: something the archive marks as resolved is reopened, or something open is treated as already resolved, with no reason given.
5. PLACE: a character in two places at once.

DO NOT REPORT
- New events, new people, new places: the story moving on is not a contradiction.
- The new STATE / OPEN being different from the old ones: they are meant to replace them. Only report it if they clash with the NEW sections themselves.
- Style, length, or anything that could be "added".
- Anything you are not sure about.

OUTPUT: Korean, one bullet per problem, exactly like this
- <무엇이 어긋나는지> — 근거 (<기존 아카이브의 섹션 제목>)
If there is no problem, write exactly: 없음`;

// "[[## Y2 #48–#63 — …]]" → the section it names (exact heading, then same range)
function findCited(secs, raw) {
    const n = raw.replace(/^#+\s*/, '').trim();
    const rangeOf = t => (t.match(/(?:\b[A-Za-z]+\d*\s+)?#\d+\s*[–—~-]\s*#?\d+/) || [''])[0].replace(/\s*[–—~-]\s*#?/, '–#').replace(/\s+/g, ' ');
    return secs.find(s => s.title === n)
        || secs.find(s => s.title.startsWith(n) || n.startsWith(s.title))
        || (rangeOf(n) && secs.find(s => rangeOf(s.title) === rangeOf(n)))
        || null;
}

// ---------------------------------------------------------------- ask the archive

const askLog = new Map(); // chat id → [{ q, a }], this session only

// Answer HTML: the model's text, with [[heading]] citations turned into chips that open that section's text
function renderAnswer(text, secs) {
    const cited = [];
    const html = aiHtml(text).replace(/\[\[([^\]]+?)\]\]/g, (all, raw) => {
        const plain = $('<i>').html(raw).text();
        const s = findCited(secs, plain);
        if (!s) return `<span class="na_cite na_cite_miss" title="아카이브에서 못 찾은 제목">${raw}</span>`;
        if (!cited.includes(s)) cited.push(s);
        const short = (s.title.match(/^(?:\S+\s+)?#\d+\s*[–—~-]\s*#?\d+/) || [s.title.slice(0, 30)])[0];
        return `<button type="button" class="na_cite" data-start="${s.start}" title="${esc(s.title)}"><i class="fa-solid fa-bookmark"></i> ${esc(short)}</button>`;
    });
    return { html, cited };
}

async function openAsk() {
    const c = ctx();
    const m = getMeta();
    if (!m.text.trim()) return toastr.info('아카이브가 비어 있어요.');
    const chatId = currentChatId();
    if (!askLog.has(chatId)) askLog.set(chatId, []);
    const log = askLog.get(chatId);
    const $root = $(`
      <div class="na_popup na_ask">
        <div class="na_block_head"><div>
          <h4>아카이브에 질문</h4>
          <p>아카이브에 적힌 내용만 근거로 답해요. 답 속 <i class="fa-solid fa-bookmark"></i> 표시를 누르면 근거 섹션이 펼쳐져요.</p>
        </div></div>
        <div class="na_ask_log"></div>
        <textarea class="text_pole na_ask_q" rows="2" placeholder="예: 둘이 처음 만난 곳이 어디였지?"></textarea>
        <div class="na_ai_row">
          <button type="button" class="na_btn na_primary na_ask_go"><i class="fa-regular fa-paper-plane"></i> 물어보기</button>
          <small class="na_dim na_ask_info"></small>
        </div>
      </div>`);
    const $log = $root.find('.na_ask_log');
    const secs = parseSections(m.text);
    const draw = () => {
        $log.html(log.length ? log.map(x => {
            const { html } = renderAnswer(x.a, secs);
            return `<div class="na_ask_item"><div class="na_ask_qq">${esc(x.q)}</div><div class="na_ask_a">${html}</div></div>`;
        }).join('') : '<div class="na_empty">물어본 게 아직 없어요.</div>');
        $log.scrollTop($log[0].scrollHeight);
    };
    $log.on('click', '.na_cite[data-start]', function () {
        const start = Number($(this).data('start'));
        const $next = $(this).closest('.na_ask_a').next('.na_ask_src');
        if ($next.length && $next.data('start') === start) return $next.remove();
        $(this).closest('.na_ask_item').find('.na_ask_src').remove();
        const sec = secs.find(x => x.start === start);
        if (!sec) return;
        const $src = $(`<div class="na_ask_src"><div class="na_ask_src_head"><b></b><button type="button" class="na_linkbtn">섹션 카드에서 보기</button></div><div class="na_ask_src_body"></div></div>`).data('start', start);
        $src.find('b').text(sec.title);
        $src.find('.na_ask_src_body').html(mdBlock(m.text.slice(sec.start, sec.end).replace(/^[^\n]*\n?/, '')));
        $src.find('.na_linkbtn').on('click', () => {
            $root.closest('dialog').find('.popup-button-ok').trigger('click');
            gotoSection(start);
        });
        $(this).closest('.na_ask_a').after($src);
    });
    countTokens(m.text).then(n => $root.find('.na_ask_info').text(`질문할 때마다 아카이브 전체(약 ${fmt(n)} 토큰)를 ${aiLabel()}에 보내요`));
    const $q = $root.find('.na_ask_q');
    const go = async () => {
        const q = $q.val().trim();
        if (!q) return;
        const a = await withSpinner($root.find('.na_ask_go'), '찾는 중…', () => askAI(`[ARCHIVE]\n${m.text}\n\n[QUESTION]\n${q}`, { system: AI_SYS_ASK, maxTokens: 1500 }));
        if (a === null) return;
        log.push({ q, a });
        if (log.length > 20) log.shift();
        $q.val('');
        draw();
    };
    $root.find('.na_ask_go').on('click', go);
    $q.on('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go(); } });
    draw();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// Open the sections tab on one section
function gotoSection(start) {
    const $p = $('#na_settings');
    const $drawer = $p.find('.inline-drawer-content');
    if ($drawer.length && !$drawer.is(':visible')) $p.find('.inline-drawer-toggle').trigger('click');
    showTab('archive');
    showArchiveView('cards');
    setTimeout(() => sectionPanel?.focus(start), 50);
}

// ---------------------------------------------------------------- extract popup

const BASIC_PROMPT = `Compress the raw log below (#{{from}}–#{{to}}) so it can be appended to the existing archive. Output only the format below, with no commentary.

# Archive structure
- Section blocks:
  \`## #start–#end — Title (date, place)\`
  PLOT:
  - one event per bullet
- After the section blocks: \`---\`, then STATE and OPEN.
- \`# STATE AT #end (date, time of day, place)\` — first line \`_True at #end._\`, then the current state per character (\`## Name\`), relationships, and household.
- \`# OPEN AT #end\` — first line \`_Unresolved at #end._\`, then unresolved threads as short bullets.
- Only if the archive spans several chat logs (e.g. year 1 / year 2): each log gets a divider heading such as \`# ── Y1 ──\`, section numbers restart at #0 per log and carry its prefix (\`## Y2 #start–#end — …\`, \`# STATE AT Y2 #end\`), and the archive title lists each range (\`(Y1 #0–#end · Y2 #0–#end)\`). A single chat uses none of this.

# Output
1. New section blocks, numbered from #{{from}} to #{{to}} with no gaps or overlaps
2. \`---\`
3. The full STATE and full OPEN, updated with the new events (omit if the archive has none)
Follow the existing archive for prefixes, date style and language.

[Format reference — last section of the archive]
{{last_section}}

[Current STATE · OPEN]
{{state}}

[Raw log]
{{raw}}`;
// earlier basic text, upgraded when untouched
const PREV_BASIC = `아래 원문(#{{from}}–#{{to}})을 기존 아카이브와 같은 형식으로 압축해 주세요.
- 섹션 제목은 "## #시작–#끝 — 짧은 제목" 형식
- 사건·관계 변화·약속·떡밥 위주로, 대사는 꼭 필요한 것만 원문 그대로
- 원문에 없는 내용은 쓰지 않기
- 아카이브에 STATE·OPEN이 있으면 새 내용을 반영해 고친 전체도 함께

[형식 참고 — 기존 아카이브의 마지막 섹션]
{{last_section}}

[지금의 STATE · OPEN]
{{state}}

[원문]
{{raw}}`;

// Defaults shipped by earlier versions, recognised by hash so their text isn't carried here.
const textHash = t => { let x = 5381; for (let i = 0; i < t.length; i++) x = ((x * 33) ^ t.charCodeAt(i)) >>> 0; return x.toString(36); };
const OLD_DEFAULTS = new Set(['1y2ik7n', '4nh49a']);
const OLD_BASIC_HASHES = new Set(['5uaca5']); // earlier built-in basics, upgraded when untouched
const OLD_BASIC = `아래 원문(#{{from}}–#{{to}})을 기존 아카이브와 같은 형식으로 압축해 주세요.
- 섹션 제목은 "## #시작–#끝 — 짧은 제목" 형식
- 사건·관계 변화·약속·떡밥 위주로, 대사는 꼭 필요한 것만 원문 그대로
- 원문에 없는 내용은 쓰지 않기

[형식 참고 — 기존 아카이브의 마지막 섹션]
{{last_section}}

[원문]
{{raw}}`;

const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function globalSettings() {
    const es = ctx().extensionSettings;
    if (!es[MODULE] || typeof es[MODULE] !== 'object') es[MODULE] = {};
    const g = es[MODULE];
    const defaults = { usePrompt: false, skipHidden: true, stripTags: false, aiProfile: '', aiMaxTokens: 8192 };
    for (const [k, v] of Object.entries(defaults)) if (!Object.hasOwn(g, k)) g[k] = v;
    // prompt library: [{ id, name, text, fav }], first entry is the built-in basic one
    if (g.aiMaxTokens === 4096 && !g.aiMaxSet) g.aiMaxTokens = 8192; // the old default, never changed by hand
    if (!Array.isArray(g.prompts)) {
        g.prompts = [{ id: 'basic', name: '기본', text: BASIC_PROMPT, fav: true }];
        const old = typeof g.prompt === 'string' ? g.prompt : '';
        if (old.trim() && old !== OLD_BASIC && old !== BASIC_PROMPT && !OLD_DEFAULTS.has(textHash(old))) {
            g.prompts.push({ id: newId(), name: '내 지시문', text: old, fav: true });
        }
        g.activePrompt = g.prompts[g.prompts.length - 1].id;
        delete g.prompt;
    }
    if (!g.prompts.some(p => p.id === 'basic')) g.prompts.unshift({ id: 'basic', name: '기본', text: BASIC_PROMPT, fav: true });
    const basic = g.prompts.find(p => p.id === 'basic');
    if (basic.text === PREV_BASIC || basic.text === OLD_BASIC || OLD_BASIC_HASHES.has(textHash(basic.text))) basic.text = BASIC_PROMPT;
    if (!g.prompts.some(p => p.id === g.activePrompt)) g.activePrompt = g.prompts[0].id;
    return g;
}
const saveGlobal = () => ctx().saveSettingsDebounced?.();
const activePrompt = g => g.prompts.find(p => p.id === g.activePrompt) || g.prompts[0];


// "## Y2 #574–#600 — ..." → { from: 574, to: 600 }
// "## Y2 #574–#600 — ..." → { prefix: 'Y2', from: 574, to: 600 }. A title line like
// "# Name — Archive (Y1 #0–#590 · Y2 #0–#573)" is not a section and is skipped.
function headingRanges(text) {
    return headingLines(text).map(h => h.title).flatMap(line => {
        const title = line.replace(/^#+\s*/, '');
        const r = title.match(RANGE_HEAD);
        return r ? [{ title, prefix: (r[1] || '').trim(), from: parseInt(r[2], 10), to: parseInt(r[4], 10) }] : [];
    });
}

function lastRangedSection(text) {
    const secs = parseSections(text).filter(s => !s.group && /#\d+\s*[–—~-]\s*#?\d+/.test(s.title));
    const s = secs[secs.length - 1];
    return s ? trimEnd(text.slice(s.start, s.end)) : '';
}

// "지울 것" lines → RegExps. A bare tag name (scene_plan or <scene_plan>) removes that whole block,
// /…/flags is a regular expression, anything else is removed as plain text.
function stripPatterns(src) {
    const out = [], bad = [];
    for (const raw of String(src || '').split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        const rx = line.match(/^\/(.+)\/([a-z]*)$/s);
        try {
            if (rx) out.push(new RegExp(rx[1], rx[2].includes('g') ? rx[2] : `${rx[2]}g`));
            else {
                const tag = line.match(/^<?\/?([A-Za-z][\w:.-]*)\/?>?$/);
                if (tag) {
                    const n = escRe(tag[1]);
                    out.push(new RegExp(`<${n}\\b[^>]*>[\\s\\S]*?<\\/${n}\\s*>|<${n}\\b[^>]*\\/>`, 'gi'));
                } else out.push(new RegExp(escRe(line), 'g'));
            }
        } catch { bad.push(line); }
    }
    return { list: out, bad };
}

function cleanMessage(text, g) {
    if (!g.stripTags) return text;
    for (const re of stripPatterns(globalSettings().stripCustom).list) text = text.replace(re, '');
    return text
        .replace(/<(think|thinking|details)[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<[^>\n]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function formatExtract(items, g) {
    return items.map(x => {
        const head = `[${x.i}] ${x.name}:`;
        return `${head}\n${x.text}`;
    }).join('\n\n');
}

// {{last_section}} is only a style sample. Models sometimes rewrite it as part of their answer,
// so it always goes in with a do-not-repeat label.
function referenceSection(text) {
    const sec = lastRangedSection(text);
    if (!sec) return '(없음)';
    return `(Format sample only. This section is ALREADY in the archive — do not output, repeat or rewrite it. Start from the new log.)\n${sec}`;
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
    // continue after whichever is further: the boundary or the last range exported
    const le = m.lastExport;
    const after = Math.max(m.boundary, le && le.to <= last ? le.to : -1);
    const defStart = Math.min(after + 1, Math.max(0, last));
    const fromLast = !!le && le.to <= last && le.to > m.boundary;

    const $root = $(`
      <div class="na_popup na_v2 na_ex2">
        <div class="na_v2_title"><b>원문 뽑기</b><small>압축할 메시지를 골라 복사하거나 .txt로 저장해요</small></div>
        <div class="na_v2_card na_ex2_card">
          <div class="na_wz2_range">
            <label><small>부터</small><span>#<input type="number" class="text_pole na_from" min="0" max="${last}" value="${Math.max(0, defStart)}"></span></label>
            <i class="fa-solid fa-arrow-right"></i>
            <label><small>까지</small><span>#<input type="number" class="text_pole na_to" min="0" max="${last}" value="${Math.max(0, last)}"></span></label>
          </div>
          <div class="na_v2_chips">
            ${m.boundary >= 0 ? `<button type="button" class="na_ex2_quick" data-a="${m.boundary + 1}" data-b="${last}">경계선 다음부터 끝까지</button>` : ''}
            <button type="button" class="na_lastex_again" ${le ? '' : 'hidden'}></button>
          </div>
          <div class="na_cp_bar"><span class="hid na_ex2_b1"></span><span class="raw na_ex2_b2"></span><span class="hid na_ex2_b3"></span></div>
          <div class="na_ex2_info na_ex_info"></div>
          <small class="na_v2_note na_lastex"><span class="na_lastex_text"></span></small>
        </div>
        <div class="na_v2_card na_v2_list">
          <label class="na_cp_row"><span class="na_cp_txt"><span>지시문 붙이기</span><small>다른 모델에 그대로 붙여넣기용</small></span><input type="checkbox" class="na_toggle na_opt_prompt"></label>
          <div class="na_cp_row na_ex_prow"><span class="na_cp_txt"><span>지시문</span></span><select class="text_pole na_psel_quick"></select></div>
          <button type="button" class="na_cp_row na_ex_toset"><span class="na_cp_txt"><span>뽑기 옵션</span><small class="na_ex_optsum"></small></span><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <pre class="na_ex2_preview"></pre>
        <div class="na_v2_row2 na_ex2_btns">
          <button type="button" class="na_v2_btn na_save_txt"><i class="fa-solid fa-download"></i> .txt 저장</button>
          <button type="button" class="na_v2_btn primary na_copy"><i class="fa-solid fa-copy"></i> <span class="na_copy_label">전체 복사</span></button>
        </div>
        <textarea class="na_ex_hidden" readonly></textarea>
      </div>`);
    $root.find('.na_opt_prompt').prop('checked', g.usePrompt);
    const fillQuick = () => $root.find('.na_psel_quick')
        .html([...g.prompts].sort((a, b) => b.fav - a.fav).map(p => `<option value="${esc(p.id)}">${p.fav ? '★ ' : ''}${esc(p.name)}</option>`).join(''))
        .val(activePrompt(g).id);
    const showProw = () => $root.find('.na_ex_prow').toggle(!!g.usePrompt);
    showProw();
    fillQuick();
    $root.find('.na_ex_optsum').text(`${[g.skipHidden ? '숨긴 메시지 뺌' : '숨긴 메시지 포함', g.stripTags ? `태그 지움${stripPatterns(g.stripCustom).list.length ? ` (+${stripPatterns(g.stripCustom).list.length})` : ''}` : ''].filter(Boolean).join(' · ')}`);
    $root.find('.na_ex_toset').on('click', () => { $root.closest('dialog').find('.popup-button-ok').trigger('click'); gotoCompressSettings(); });

    let current = '';
    let output = '';
    let withPrompt = '';
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
        withPrompt = fillPrompt(activePrompt(g).text, { raw: current, from: String(from), to: String(to), last_section: referenceSection(m.text), state: splitTail(m.text)[1].trim() || '(없음)', archive: m.text });
        output = g.usePrompt ? withPrompt : current;
        $root.find('.na_ex_hidden').val(output);
        $root.find('.na_prompt_state').text(g.usePrompt ? activePrompt(g).name : '안 붙임').toggleClass('na_chip_on', g.usePrompt);
        $root.find('.na_copy_label').text(g.usePrompt ? '지시문과 함께 복사' : '전체 복사');
        const skipped = all.length - items.length;
        const tk = items.length ? await countTokens(output) : 0;
        $root.find('.na_ex_info').html(items.length
            ? `<span>메시지 ${items.length}개${skipped ? ` · ${skipped}개 뺌` : ''}</span><b>약 ${fmt(tk)} 토큰</b>`
            : '<span>이 범위에 메시지가 없어요</span>');
        const tot = Math.max(1, last + 1), a0 = Math.max(0, Math.min(from, last)), b0 = Math.max(a0, Math.min(to, last));
        $root.find('.na_ex2_b1').css('flex', a0).toggle(a0 > 0); $root.find('.na_ex2_b2').css('flex', b0 - a0 + 1); $root.find('.na_ex2_b3').css('flex', tot - b0 - 1).toggle(tot - b0 - 1 > 0);
        $root.find('.na_ex2_preview').text(current ? current.split('\n').slice(0, 6).join('\n') + (current.split('\n').length > 6 ? '\n…' : '') : '').prop('hidden', !current);
    };

    $root.find('.na_from, .na_to').on('change', render);
    $root.find('.na_opt_prompt').on('change', function () { g.usePrompt = this.checked; saveGlobal(); fillQuick(); showProw(); render(); renderPromptSettings(); });
    $root.find('.na_psel_quick').on('change', function () { g.activePrompt = this.value; saveGlobal(); render(); renderPromptSettings(); });
    const showLast = () => {
        const x = getMeta().lastExport;
        $root.find('.na_lastex').prop('hidden', !x);
        if (x) {
            $root.find('.na_lastex_text').html(`최근 내보냄 #${x.from}–#${x.to} · ${esc(timeLabel(x.at))} · ${x.how === 'txt' ? '.txt 저장' : x.how === 'draft' ? 'AI 초안' : '복사'}${fromLast && x === le ? ' → 그 다음부터 채웠어요' : ''}`);
            $root.find('.na_lastex_again').prop('hidden', false).text(`지난번 범위 #${x.from}–#${x.to}`);
        }
    };
    const remember = async how => {
        const { from, to } = range();
        getMeta().lastExport = { from, to, at: Date.now(), how };
        await saveMeta();
        showLast();
        refreshStatus();
    };
    showLast();
    $root.find('.na_ex2_quick').on('click', function () { $root.find('.na_from').val(this.dataset.a); $root.find('.na_to').val(this.dataset.b); render(); });
    $root.find('.na_lastex_again').on('click', () => {
        const x = getMeta().lastExport;
        if (!x) return;
        $root.find('.na_from').val(x.from); $root.find('.na_to').val(Math.min(x.to, last));
        render();
    });
    $root.find('.na_copy').on('click', async () => {
        if (!current) return;
        const ok = await copyText(output, $root.find('.na_ex_hidden')[0]);
        if (ok) await remember('copy');
        ok ? toastr.success('복사됨') : toastr.warning('복사가 막혀 있어요. .txt 저장을 써 주세요.');
    });
    $root.find('.na_save_txt').on('click', () => {
        if (!current) return;
        const { from, to } = range();
        download(`원문_${chatLabel()}_${from}-${to}.txt`, output);
        remember('txt');
    });

    await render();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// ---- compress settings in the panel: extract options + prompt library

function renderPromptSettings() {
    const g = globalSettings();
    $('#na_opt_hidden').prop('checked', !!g.skipHidden);
    $('#na_opt_tags').prop('checked', !!g.stripTags);
    if (document.activeElement?.id !== 'na_strip_custom') $('#na_strip_custom').val(g.stripCustom || '');
    showStripInfo();
    const $h = $('#na_plib');
    if (!$h.length) return;
    const cur = activePrompt(g);
    const sorted = [...g.prompts].sort((a, b) => (b.fav - a.fav));
    $h.find('.na_psel').html(sorted.map(p => `<option value="${esc(p.id)}">${p.fav ? '★ ' : ''}${esc(p.name)}</option>`).join('')).val(cur.id);
    $h.find('.na_pfav').html(g.prompts.filter(p => p.fav).map(p =>
        `<button type="button" class="na_pchip ${p.id === cur.id ? 'on' : ''}" data-id="${esc(p.id)}">${esc(p.name)}</button>`).join(''));
    $h.find('.na_pstar i').attr('class', cur.fav ? 'fa-solid fa-star' : 'fa-regular fa-star');
    $h.find('.na_pstar').toggleClass('active', !!cur.fav);
    $h.find('.na_pdel, .na_pren').prop('disabled', cur.id === 'basic');
    $h.find('.na_prompt_reset').toggle(cur.id === 'basic' && cur.text !== BASIC_PROMPT);
    const $ta = $h.find('.na_prompt_ta');
    if ($ta.data('pid') !== cur.id) $ta.val(cur.text).data('pid', cur.id);
}

function bindPromptSettings() {
    const g = () => globalSettings();
    const $h = $('#na_plib').html(`
        <div class="na_pfav"></div>
        <div class="na_prow">
          <select class="text_pole na_psel"></select>
          <button type="button" class="na_icon na_pstar" title="즐겨찾기"><i class="fa-regular fa-star"></i></button>
          <button type="button" class="na_icon na_pnew" title="새 지시문"><i class="fa-solid fa-plus"></i></button>
          <button type="button" class="na_icon na_pdup" title="복제"><i class="fa-regular fa-clone"></i></button>
          <button type="button" class="na_icon na_pren" title="이름 바꾸기"><i class="fa-solid fa-i-cursor"></i></button>
          <button type="button" class="na_icon na_pdel" title="삭제"><i class="fa-regular fa-trash-can"></i></button>
        </div>
        <textarea class="text_pole na_prompt_ta" spellcheck="false" rows="9"></textarea>
        <div class="na_pfoot">
          <details class="na_phelp">
            <summary>쓸 수 있는 자리표시</summary>
            <dl>
              <dt>{{raw}}</dt><dd>원문 (안 쓰면 맨 끝에 붙어요)</dd>
              <dt>{{from}} {{to}}</dt><dd>번호 범위</dd>
              <dt>{{last_section}}</dt><dd>아카이브 마지막 섹션</dd>
              <dt>{{state}}</dt><dd>지금의 STATE · OPEN</dd>
              <dt>{{archive}}</dt><dd>아카이브 전체</dd>
            </dl>
          </details>
          <button type="button" class="na_linkbtn na_prompt_reset">기본 지시문 되돌리기</button>
        </div>`);
    $('#na_opt_hidden').on('change', function () { g().skipHidden = this.checked; saveGlobal(); });
    $('#na_opt_tags').on('change', function () { g().stripTags = this.checked; saveGlobal(); showStripInfo(); });
    $('#na_strip_custom').on('input', function () { g().stripCustom = this.value; saveGlobal(); showStripInfo(); });
    const pick = id => { g().activePrompt = id; saveGlobal(); renderPromptSettings(); };
    const askName = async (title, value) => {
        const v = await ctx().Popup.show.input(title, '', value);
        return typeof v === 'string' ? v.trim() : '';
    };
    $h.find('.na_psel').on('change', function () { pick(this.value); });
    $h.on('click', '.na_pchip', function () { pick($(this).data('id')); });
    $h.find('.na_pstar').on('click', () => { const p = activePrompt(g()); p.fav = !p.fav; saveGlobal(); renderPromptSettings(); });
    $h.find('.na_pnew').on('click', async () => {
        const name = await askName('새 지시문 이름', `지시문 ${g().prompts.length + 1}`);
        if (!name) return;
        const p = { id: newId(), name, text: '', fav: false };
        g().prompts.push(p); pick(p.id);
        $h.find('.na_prompt_ta').trigger('focus');
    });
    $h.find('.na_pdup').on('click', async () => {
        const src = activePrompt(g());
        const name = await askName('복제한 지시문 이름', `${src.name} 사본`);
        if (!name) return;
        const p = { id: newId(), name, text: src.text, fav: false };
        g().prompts.push(p); pick(p.id);
    });
    $h.find('.na_pren').on('click', async () => {
        const p = activePrompt(g());
        if (p.id === 'basic') return;
        const name = await askName('이름 바꾸기', p.name);
        if (!name) return;
        p.name = name; saveGlobal(); renderPromptSettings();
    });
    $h.find('.na_pdel').on('click', async () => {
        const p = activePrompt(g());
        if (p.id === 'basic') return;
        if (!await confirm('지시문 삭제', `"${p.name}"을(를) 지울까요? 되돌릴 수 없어요.`)) return;
        g().prompts = g().prompts.filter(x => x.id !== p.id);
        pick(g().prompts[0].id);
    });
    $h.find('.na_prompt_ta').on('input', function () { activePrompt(g()).text = this.value; saveGlobal(); });
    $h.find('.na_prompt_reset').on('click', () => {
        const p = g().prompts.find(x => x.id === 'basic');
        p.text = BASIC_PROMPT; $h.find('.na_prompt_ta').val(p.text).data('pid', null); saveGlobal(); renderPromptSettings();
    });
    $('#na_cmp_settings').on('toggle', function () { if (this.open) renderPromptSettings(); });
    renderPromptSettings();
}

function showStripInfo() {
    const { list, bad } = stripPatterns(globalSettings().stripCustom);
    $('.na_strip_box').toggleClass('na_off', !globalSettings().stripTags);
    $('#na_strip_info').toggleClass('na_warn_txt', !!bad.length)
        .text(bad.length ? `정규식이 잘못된 줄: ${bad.join(' / ')}` : list.length ? `${list.length}개 추가로 지워요` : '');
}

// Open the compress tab with its settings fold open
function gotoCompressSettings() {
    const $p = $('#na_settings');
    $p.find('.na_nav_btn[data-tab="compress"]').trigger('click');
    const d = document.getElementById('na_cmp_settings');
    if (!d) return;
    d.open = true;
    renderPromptSettings();
    setTimeout(() => d.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50);
}

// ---------------------------------------------------------------- append popup

// ---- placing appended text: new sections go before "# STATE AT", pasted STATE/OPEN replace the old ones

const TAIL_RE = /^# (STATE|OPEN)\b.*$/m;

// [body, tail] where tail starts at the first "# STATE…" / "# OPEN…" heading
function splitTail(text) {
    const mt = TAIL_RE.exec(text);
    return mt ? [text.slice(0, mt.index), text.slice(mt.index)] : [text, ''];
}

// level-1 blocks of the tail, keyed by their first word (STATE / OPEN / other title)
function tailBlocks(tail) {
    const out = [];
    const re = /^# .*$/gm;
    const heads = [];
    let mt;
    while ((mt = re.exec(tail)) !== null) heads.push({ at: mt.index, line: mt[0] });
    heads.forEach((h, i) => {
        const key = (h.line.match(/^# (STATE|OPEN)\b/) || [, h.line])[1];
        out.push({ key, text: trimEnd(tail.slice(h.at, heads[i + 1]?.at ?? tail.length)) });
    });
    return out;
}

function lastRangeEnd(text) {
    const r = headingRanges(text);
    return r.length ? r[r.length - 1].to : null;
}

// Returns { text, placed, replaced: [keys], renumbered }
// Pasted sections whose numbers the archive already covers (a model rewriting the format sample, say).
// 'skip' leaves them out; 'replace' swaps an exact match (same prefix and range) in place of the old one.
function findRewrites(eBody, pBody) {
    const existing = parseSections(eBody).filter(x => !x.group).map(x => ({ s: x, r: x.title.match(RANGE_HEAD) })).filter(x => x.r);
    const covered = new Map(); // prefix → highest number in the archive
    for (const { r } of existing) {
        const pre = (r[1] || '').trim(), to = Math.max(parseInt(r[2], 10), parseInt(r[4], 10));
        covered.set(pre, Math.max(covered.get(pre) ?? -1, to));
    }
    const groupTitles = new Set(parseSections(eBody).filter(x => x.group || x.level === 1).map(x => x.title.trim()));
    const out = [];
    for (const sec of parseSections(pBody)) {
        if (sec.title === '(머리말)' || sec.title === '(제목 없음)') continue;
        const r = sec.title.match(RANGE_HEAD);
        if (!r) {
            // a "# ── Y2 ──" divider (or the archive title) that the archive already has
            if (sec.level === 1 && groupTitles.has(sec.title.trim()) && !sec.note) out.push({ sec, kind: 'divider' });
            continue;
        }
        const pre = (r[1] || '').trim(), from = parseInt(r[2], 10), to = parseInt(r[4], 10);
        if (!covered.has(pre) || Math.min(from, to) > covered.get(pre)) continue;
        const same = existing.find(x => (x.r[1] || '').trim() === pre && parseInt(x.r[2], 10) === from && parseInt(x.r[4], 10) === to);
        out.push({ sec, kind: same ? 'exact' : 'overlap', old: same?.s });
    }
    return out;
}

// the pasted text minus sections the archive already has (what the number check should look at)
function stripRewrites(archive, add) {
    const [eBody] = splitTail(archive);
    const [pBody, pTail] = splitTail(add);
    const p = trimEnd(pBody).replace(/\n-{3,}\s*$/, '');
    const drop = new Set(findRewrites(trimEnd(eBody).replace(/\n-{3,}\s*$/, ''), p).map(f => f.sec.start));
    if (!drop.size) return add;
    return `${trimEnd(parseSections(p).filter(x => !drop.has(x.start)).map(x => p.slice(x.start, x.end)).join(''))}${pTail ? `\n\n${pTail}` : ''}`;
}

function placeAppend(archive, add, { renumber, rewrites = 'skip' } = {}) {
    const [eBody, eTail] = splitTail(archive);
    const [pBody, pTail] = splitTail(add);
    const sep = /\n-{3,}\s*$/.test(trimEnd(eBody));
    let body = trimEnd(eBody).replace(/\n-{3,}\s*$/, '');
    let pClean = trimEnd(pBody).replace(/\n-{3,}\s*$/, '');
    const found = findRewrites(body, pClean);
    const skipped = [], swapped = [];
    if (found.length) {
        const drop = new Set(found.map(f => f.sec.start));
        // replace exact matches in place (from the end so earlier offsets stay valid)
        if (rewrites === 'replace') {
            const exact = found.filter(f => f.kind === 'exact').sort((x, y) => y.old.start - x.old.start);
            for (const f of exact) {
                const oldTrail = body.slice(f.old.start, f.old.end).match(/\s*$/)[0] || '\n\n';
                body = body.slice(0, f.old.start) + trimEnd(pClean.slice(f.sec.start, f.sec.end)) + oldTrail + body.slice(f.old.end);
                swapped.push(f.sec.title);
            }
        }
        found.filter(f => !(rewrites === 'replace' && f.kind === 'exact') && f.kind !== 'divider').forEach(f => skipped.push(f.sec.title));
        pClean = trimEnd(parseSections(pClean).filter(x => !drop.has(x.start)).map(x => pClean.slice(x.start, x.end)).join(''));
        body = trimEnd(body);
    }
    if (pClean.trim()) body = `${trimEnd(body)}${body.trim() ? '\n\n' : ''}${pClean}`;

    const eBlocks = tailBlocks(eTail), pBlocks = tailBlocks(pTail);
    const replaced = [];
    const blocks = eBlocks.map(b => {
        const nb = pBlocks.find(x => x.key === b.key);
        if (nb) replaced.push(b.key);
        return nb || b;
    });
    pBlocks.filter(x => !eBlocks.some(b => b.key === x.key)).forEach(x => blocks.push(x));

    let renumbered = null;
    const oldEnd = lastRangeEnd(eBody), newEnd = lastRangeEnd(pBody);
    if (renumber && oldEnd !== null && newEnd !== null && newEnd > oldEnd) {
        const swap = line => line.replace(new RegExp(`#${oldEnd}(?!\\d)`, 'g'), `#${newEnd}`);
        // a top "# " title line and the intro lines under it, up to the next heading
        const lines = body.split('\n');
        if (/^# /.test(lines[0] || '')) {
            for (let i = 0; i < lines.length; i++) {
                if (i > 0 && /^#{1,3} /.test(lines[i])) break;
                lines[i] = swap(lines[i]);
            }
        }
        body = lines.join('\n');
        // STATE/OPEN headings + their first note line, unless just replaced
        blocks.forEach((b, i) => {
            if (replaced.includes(b.key) || pBlocks.includes(b)) return;
            const ls = b.text.split('\n');
            for (let k = 0; k < Math.min(ls.length, 4); k++) if (k === 0 || /^_.*_$/.test(ls[k].trim())) ls[k] = swap(ls[k]);
            blocks[i] = { ...b, text: ls.join('\n') };
        });
        renumbered = { from: oldEnd, to: newEnd };
    }

    let text = trimEnd(body);
    if (blocks.length) text += `${sep || eTail ? '\n\n---\n\n' : '\n\n'}${blocks.map(b => b.text).join('\n\n')}`;
    return { text: `${text}\n`, placed: !!eTail && !!pClean.trim(), replaced, renumbered, skipped, swapped, rewriteCount: found.filter(f => f.kind !== 'divider').length, exactCount: found.filter(f => f.kind === 'exact').length };
}

// Signs that a pasted (AI) answer stopped early. Display strings, empty if it looks complete.
function cutSigns(archive, add) {
    const out = [];
    const [, eTail] = splitTail(archive);
    const [, pTail] = splitTail(add);
    const hasBlocks = k => new RegExp(`^# ${k}\\b`, 'm');
    const missing = ['STATE', 'OPEN'].filter(k => hasBlocks(k).test(eTail) && !hasBlocks(k).test(pTail));
    if (missing.length) out.push(`${missing.join('·')} 블록이 없어요. 이대로 추가하면 예전 ${missing.join('·')} 블록이 그대로 남아요.`);
    const lastLine = (add.trim().split('\n').filter(l => l.trim()).pop() || '').trim();
    const ends = /[.!?。…"'”’)\]_*~」』>]$|[다요음함임됨짐]$|^#{1,3} |^-{3,}$/;
    if (lastLine && !ends.test(lastLine)) out.push(`마지막 줄이 문장 중간에서 끝나요: "…${lastLine.slice(-40)}"`);
    return out;
}

// Problems with the numbering of pasted sections, as display strings.
function checkAppend(m, add, last) {
    const ranges = headingRanges(add);
    const issues = [];
    if (!ranges.length) return { ranges, issues: ['제목에서 "#시작–#끝" 번호를 못 찾았어요. 번호 검사는 건너뛰어요.'], soft: true };
    const label = r => `${r.prefix ? `${r.prefix} ` : ''}#`;
    // continues the archive: compare with the archive's last numbered section of the same prefix
    const mine = headingRanges(m.text);
    const lastA = mine[mine.length - 1];
    if (lastA) {
        const first = ranges.find(r => r.prefix === lastA.prefix);
        const want = lastA.to + 1;
        if (first && first.from > want) issues.push(`첫 섹션이 ${label(first)}${first.from}부터예요. ${label(first)}${want}${first.from - 1 > want ? `–#${first.from - 1}` : ''} (${first.from - want}개)가 빠졌어요.`);
        else if (first && first.from < want) issues.push(`첫 섹션 ${label(first)}${first.from}가 아카이브에 이미 있는 ${label(lastA)}${lastA.to}까지와 겹쳐요.`);
    }
    // numbering restarts per prefix (Y1, Y2 …), so check continuity within each
    const lastBy = new Map();
    for (const r of ranges) {
        if (r.from > r.to) issues.push(`"${r.title}" — 시작 #${r.from}이 끝 #${r.to}보다 커요.`);
        const prev = lastBy.get(r.prefix);
        if (prev) {
            if (r.from > prev.to + 1) issues.push(`${label(r)}${prev.to}와 #${r.from} 사이 #${prev.to + 1}${r.from - 1 > prev.to + 1 ? `–#${r.from - 1}` : ''}가 빠졌어요.`);
            else if (r.from <= prev.to) issues.push(`"${r.title}"가 앞 섹션(${label(prev)}${prev.to}까지)과 겹쳐요.`);
        }
        lastBy.set(r.prefix, r);
    }
    const end = ranges[ranges.length - 1];
    if (end.to > last) issues.push(`끝 ${label(end)}${end.to}가 채팅 마지막 #${last}보다 커요.`);
    return { ranges, issues, soft: false };
}

// a paste that carries most of the archive's numbered sections is a whole new version, not new sections
function looksWhole(archive, add) {
    const [eBody] = splitTail(archive);
    const eb = trimEnd(eBody).replace(/\n-{3,}\s*$/, '');
    const n = parseSections(eb).filter(x => !x.group && RANGE_HEAD.test(x.title)).length;
    if (n < 3) return false;
    const pb = trimEnd(splitTail(add)[0]).replace(/\n-{3,}\s*$/, '');
    return findRewrites(eb, pb).filter(f => f.kind !== 'divider').length >= Math.ceil(n * 0.8);
}

// shows what a whole-archive swap changes; true once confirmed
async function confirmWhole(oldText, newText) {
    const c = ctx();
    const ch = sectionChanges(oldText, newText);
    const rows = lineDiff(oldText, newText);
    const add = rows.filter(r => r.t === '+').length, del = rows.filter(r => r.t === '-').length;
    const list = (label, xs) => xs.length ? `<div class="na_whole_sum"><b>${label} ${xs.length}개</b><ul>${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    const counts = [['새', ch.added], ['바뀜', ch.changed], ['제목', ch.renamed], ['없어짐', ch.removed]].filter(([, xs]) => xs.length).map(([k, xs]) => `${k} ${xs.length}`);
    const $v = $(`
      <div class="na_popup na_popup_fill">
        <div class="na_diff_head">
          <b>아카이브를 통째로 바꿔요</b>
          <span class="na_chip na_chip_add">+${fmt(add)}줄</span><span class="na_chip na_chip_del">−${fmt(del)}줄</span>
        </div>
        ${counts.length ? `<details class="na_whole_sums"><summary>섹션 변화 · ${counts.join(' · ')}</summary>
          ${list('새 섹션', ch.added)}${list('내용이 바뀐 섹션', ch.changed)}${list('제목이 바뀐 섹션', ch.renamed)}${list('없어지는 섹션', ch.removed)}
        </details>` : '<div class="na_empty">섹션은 그대로예요.</div>'}
        <small class="na_dim">지금 아카이브는 "통째로 바꾸기 전" 복구 지점으로 남아요.</small>
        <div class="na_diff">${add || del ? renderDiff(rows) : '<div class="na_empty">내용이 똑같아요.</div>'}</div>
      </div>`);
    if (add || del) $v.find('.na_diff_head').append(translateButton($v.find('.na_diff')));
    const r = await c.callGenericPopup($v, c.POPUP_TYPE.CONFIRM, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '통째로 바꾸기', cancelButton: '취소' });
    return r === c.POPUP_RESULT.AFFIRMATIVE || r === true;
}

async function openAppend(prefill = {}) {
    const c = ctx();
    const m = getMeta();
    const last = (c.chat?.length || 0) - 1;
    const pre = prefill && typeof prefill === 'object' && 'text' in prefill ? prefill : {};

    const $root = $(`
      <div class="na_popup na_v2 na_ap2">
        <div class="na_v2_titlebar">
          <div class="na_v2_title"><b>아카이브에 추가</b><small>STATE·OPEN 앞에 넣고, 새 STATE로 바꿔요</small></div>
          <button type="button" class="na_v2_pillbtn na_append_file_btn"><i class="fa-solid fa-file-arrow-up"></i> 파일</button>
          <input type="file" class="na_append_file" accept=".txt,.md,text/plain" hidden>
        </div>
        <textarea class="text_pole na_append_ta" spellcheck="false" placeholder="## Y2 #574–#600 — 제목 (날짜, 장소)&#10;PLOT:&#10;- …"></textarea>
        <div class="na_v2_card na_v2_list na_ap2_checks">
          <span class="na_ap2_label">붙여넣은 글 검사</span>
          <div class="na_check na_numcheck" hidden></div>
          <div class="na_check na_check_warn na_cut" hidden></div>
          <div class="na_check na_whole" hidden><i class="fa-solid fa-file-circle-check"></i><div>
            <b>아카이브 전체본 같아요</b> — 이미 있는 섹션이 거의 다 들어 있어요. 새 섹션만 붙이려면 그대로 <b>추가</b>, 이 내용으로 아카이브를 바꾸려면:
            <div class="na_whole_row"><button type="button" class="na_btn na_small na_whole_btn"><i class="fa-solid fa-right-left"></i> 통째로 바꾸기</button></div>
          </div></div>
          <div class="na_check na_check_warn na_rw" hidden></div>
          <div class="na_check na_check_soft na_names" hidden></div>
          <button type="button" class="na_cp_row na_ai_conflict"><span class="na_cp_txt"><span><i class="fa-solid fa-wand-magic-sparkles"></i> AI로 충돌 검사</span><small>기존 아카이브와 어긋나는 이름·날짜·사실·해결된 떡밥</small></span><i class="fa-solid fa-chevron-right"></i></button>
          <div class="na_ai_box na_conflict_out" hidden></div>
        </div>
        <div class="na_v2_card na_v2_list">
          <label class="na_cp_row"><span class="na_cp_txt"><span>이번에 압축한 끝 번호</span><small class="na_end_hint"></small></span><span class="na_ap2_end">#<input type="number" class="text_pole na_end" min="0" max="${last}" value="${Math.max(0, last)}"></span></label>
          <label class="na_cp_row"><span class="na_cp_txt"><span>추가한 뒤 숨기기</span><small>마지막 ${m.keep}개는 남겨요</small></span><input type="checkbox" class="na_toggle na_do_hide" checked></label>
          <label class="na_cp_row na_renum_row"><span class="na_cp_txt"><span class="na_renum_label">제목·안내문의 끝 번호도 바꾸기</span></span><input type="checkbox" class="na_toggle na_do_renum" checked></label>
        </div>
        <small class="na_v2_note na_place"></small>
        <details class="na_v2_card na_v2_more na_ap_preview" hidden>
          <summary>추가하면 바뀌는 부분 <span class="na_chip na_chip_add na_ap_add"></span><span class="na_chip na_chip_del na_ap_del"></span></summary>
          <div><div class="na_ap_tr_row"></div><div class="na_diff na_ap_diff"></div></div>
        </details>
        <div class="na_append_info na_dim"></div>
      </div>`);

    const $ta = $root.find('.na_append_ta');
    const $end = $root.find('.na_end');
    $root.find('.na_append_file_btn').on('click', () => $root.find('.na_append_file').val('').trigger('click'));
    $root.find('.na_append_file').on('change', async function () {
        const file = this.files?.[0];
        if (!file) return;
        const text = (await file.text()).replace(/\r\n/g, '\n').trim();
        if ($ta.val().trim() && !await confirm('불러오기', '붙여넣은 내용을 이 파일 내용으로 바꿀까요?')) return;
        $ta.val(text).trigger('input');
        toastr.success(`불러옴: ${file.name}`);
    });
    const $check = $root.find('.na_numcheck');
    $root.find('.na_renum_row').hide();
    let lastPlan = null;
    const $pv = $root.find('.na_ap_preview');
    const apTr = translateButton($root.find('.na_ap_diff'));
    $root.find('.na_ap_tr_row').append(apTr);
    function renderPreview(plan) {
        lastPlan = plan;
        if (!plan || !$ta.val().trim()) { $pv.prop('hidden', true); return; }
        const rows = lineDiff(m.text, plan.text);
        const add = rows.filter(r => r.t === '+').length, del = rows.filter(r => r.t === '-').length;
        $pv.prop('hidden', false);
        $root.find('.na_ap_add').text(`+${fmt(add)}줄`);
        $root.find('.na_ap_del').text(`−${fmt(del)}줄`).toggle(!!del);
        apTr.reset();
        if ($pv.prop('open')) $root.find('.na_ap_diff').html(add || del ? renderDiff(rows) : '<div class="na_empty">바뀌는 게 없어요.</div>');
        else $root.find('.na_ap_diff').empty();
    }
    $pv.on('toggle', () => renderPreview(lastPlan));
    $root.find('.na_do_renum').on('change', () => $ta.trigger('input'));
    let rwReplace = false;
    const rwMode = () => rwReplace ? 'replace' : 'skip';
    $root.on('change', '.na_rw_replace', function () { rwReplace = this.checked; $ta.trigger('input'); });
    let wantWhole = false;
    $root.find('.na_whole_btn').on('click', () => { wantWhole = true; $root.closest('dialog').find('.popup-button-cancel').trigger('click'); });
    let endTouched = false;
    let lastCheck = { issues: [] };
    $end.on('input', () => { endTouched = true; $root.find('.na_end_hint').text(''); });
    let t;
    $ta.on('input', () => {
        $root.find('.na_conflict_out').addClass('na_stale'); // checked text changed since
        clearTimeout(t);
        t = setTimeout(async () => {
            const val = $ta.val();
            const guess = guessEndNumber(val);
            if (guess !== null && !endTouched) {
                $end.val(guess);
                $root.find('.na_end_hint').html(`제목에서 <b>#${guess}</b>을 읽었어요`);
            }
            lastCheck = val.trim() ? checkAppend(m, stripRewrites(m.text, val), last) : { issues: [] };
            if (!val.trim()) $check.prop('hidden', true);
            else if (!lastCheck.issues.length) {
                const r = lastCheck.ranges;
                $check.prop('hidden', false).attr('class', 'na_check na_numcheck na_check_ok')
                    .html(`<i class="fa-solid fa-circle-check"></i> 번호 이어짐 확인 · #${r[0].from}–#${r[r.length - 1].to}, 섹션 ${r.length}개`);
            } else {
                $check.prop('hidden', false).attr('class', `na_check na_numcheck ${lastCheck.soft ? 'na_check_soft' : 'na_check_warn'}`)
                    .html(`<i class="fa-solid fa-triangle-exclamation"></i><ul>${lastCheck.issues.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
            }
            const near = val.trim() ? nameNearMisses(m.text, val) : [];
            $root.find('.na_names').prop('hidden', !near.length)
                .html(near.length ? `<i class="fa-solid fa-spell-check"></i><div>철자 확인 — 아카이브에 비슷한 이름이 있어요<ul>${near.map(x => `<li><b>${esc(x.word)}</b> ↔ 기존 <b>${esc(x.like)}</b></li>`).join('')}</ul></div>` : '');
            const plan = placeAppend(m.text, val, { renumber: $root.find('.na_do_renum').prop('checked'), rewrites: rwMode() });
            renderPreview(plan);
            const cut = val.trim() ? cutSigns(m.text, val) : [];
            $root.find('.na_cut').prop('hidden', !cut.length).html(cut.length
                ? `<i class="fa-solid fa-scissors"></i><div><b>답이 중간에 끊긴 것 같아요</b><ul>${cut.map(x => `<li>${esc(x)}</li>`).join('')}</ul><small>다른 모델로 압축했다면 그쪽 답 길이(최대 토큰)를 늘리고 다시 받아 보세요.</small></div>` : '');
            const whole = !!val.trim() && looksWhole(m.text, val);
            $root.find('.na_whole').prop('hidden', !whole);
            const rwN = plan.rewriteCount;
            const items = [...plan.skipped.map(x => `<li>${esc(x)} <span class="na_dim">→ 빼고 추가</span></li>`), ...plan.swapped.map(x => `<li>${esc(x)} <span class="na_dim">→ 기존 섹션을 이걸로 바꿈</span></li>`)];
            const rwOpen = $root.find('.na_rw details').prop('open');
            $root.find('.na_rw').attr('class', `na_check ${whole ? 'na_check_soft' : 'na_check_warn'} na_rw`).prop('hidden', !rwN).html(rwN ? `<i class="fa-solid fa-shield-halved"></i><div>
                ${whole ? `그대로 <b>추가</b>하면 이미 있는 섹션 ${rwN}개는 빼고 새 섹션만 붙여요.`
                    : `<b>이미 아카이브에 있는 섹션 ${rwN}개가 섞여 있어요</b> — 모델이 형식 참고용 섹션을 다시 쓴 것 같아요. 그건 빼고 추가해요.`}
                ${items.length > 3 ? `<details class="na_rw_list"${rwOpen ? ' open' : ''}><summary>섹션 ${items.length}개 보기</summary><ul>${items.join('')}</ul></details>` : items.length ? `<ul>${items.join('')}</ul>` : ''}
                ${plan.exactCount ? `<label class="checkbox_label na_rw_opt"><input type="checkbox" class="na_rw_replace" ${rwMode() === 'replace' ? 'checked' : ''}><span>번호가 똑같은 섹션은 기존 걸 붙여넣은 걸로 바꾸기 (일부러 고쳐 쓴 경우만)</span></label>` : ''}
            </div>` : '');
            const notes = [];
            if (plan.placed) notes.push('새 섹션은 <b>STATE 앞</b>에 들어가요');
            if (plan.replaced.length) notes.push(`<b>${plan.replaced.join('·')}</b> 블록은 붙여넣은 걸로 바뀌어요`);
            $root.find('.na_place').html(notes.join(' · '));
            $root.find('.na_renum_row').toggle(!!plan.renumbered);
            if (plan.renumbered) $root.find('.na_renum_label').html(`제목·안내문의 끝 번호도 바꾸기 (<b>#${plan.renumbered.from} → #${plan.renumbered.to}</b>)`);
            $root.find('.na_append_info').text(`약 ${fmt(await countTokens(val))} 토큰 · 섹션 ${parseSections(val).filter(x => !x.group).length}개`);
        }, 400);
    });

    $root.find('.na_ai_conflict').on('click', async function () {
        const add = $ta.val().trim();
        if (!add) return toastr.info('먼저 추가할 내용을 붙여넣어 주세요.');
        const out = await withSpinner($(this), '검사하는 중…', () => askAI(`[EXISTING ARCHIVE]\n${m.text}\n\n[NEW TEXT]\n${add}`, { system: AI_SYS_CONFLICT, maxTokens: 1500 }));
        if (out === null) return;
        const none = /^\s*(없음|none)\.?\s*$/i.test(out);
        $root.find('.na_conflict_out').prop('hidden', false).removeClass('na_stale').toggleClass('na_ai_ok', none)
            .html(none ? '<i class="fa-solid fa-circle-check"></i> AI가 찾은 충돌 없음' : `<div class="na_ai_box_head"><i class="fa-solid fa-wand-magic-sparkles"></i> AI 충돌 검사 <span class="na_dim">· 참고용이에요</span></div>${aiHtml(out)}`);
    });
    if (pre.text) {
        if (Number.isFinite(pre.end)) { $end.val(pre.end); endTouched = true; }
        $ta.val(pre.text).trigger('input');
    }
    const result = await c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', {
        wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '추가', cancelButton: '취소',
    });
    if (wantWhole) {
        const whole = String($ta.val() || '').replace(/\r\n/g, '\n').trim();
        const end = parseInt($end.val(), 10);
        const cut = cutSigns(m.text, whole);
        if (cut.length && !await confirm('답이 끊긴 것 같아요', `${cut.join('\n')}\n\n그래도 바꿀까요?`)) return;
        if (!await confirmWhole(m.text, whole)) return;
        await commitText(whole, '통째로 바꾸기 전', Number.isFinite(end) && end >= 0 ? { boundary: end } : {});
        if ($root.find('.na_do_hide').prop('checked')) await applyHide({ silent: true });
        return toastr.success(Number.isFinite(end) && end >= 0 ? `아카이브를 통째로 바꿨어요 · 경계선 #${end}` : '아카이브를 통째로 바꿨어요');
    }
    if (result !== c.POPUP_RESULT.AFFIRMATIVE && result !== true) return;

    const add = String($ta.val() || '').replace(/\r\n/g, '\n').trim();
    if (!add) return toastr.info('붙여넣은 내용이 없어요.');
    const end = parseInt($root.find('.na_end').val(), 10);
    if (!Number.isFinite(end) || end < 0) return toastr.warning('끝 번호를 확인해 주세요.');
    const cut = cutSigns(m.text, add);
    if (cut.length && !await confirm('답이 끊긴 것 같아요', `${cut.join('\n')}\n\n그래도 추가할까요?`)) return;
    const check = checkAppend(m, stripRewrites(m.text, add), last);
    if (check.issues.length && !check.soft) {
        if (!await confirm('번호 확인', `${check.issues.join('\n')}\n\n그래도 추가할까요?`)) return;
    } else if (m.boundary >= 0 && end <= m.boundary) {
        if (!await confirm('경계선 확인', `끝 번호 #${end}가 기존 경계선 #${m.boundary}보다 앞이에요. 그래도 저장할까요?`)) return;
    }

    const plan = placeAppend(m.text, add, { renumber: $root.find('.na_do_renum').prop('checked') && $root.find('.na_renum_row').is(':visible'), rewrites: rwMode() });
    if (!plan.text.trim() || plan.text === `${trimEnd(m.text)}\n`) return toastr.info('새로 추가할 섹션이 없어요.');
    await commitText(plan.text, '추가 전', { boundary: end });
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

// magic-wand (extensions) menu entries
function addWandMenu() {
    const $menu = $('#extensionsMenu');
    if (!$menu.length || $('#na_wand_read').length) return;
    const items = [
        ['na_wand_read', 'fa-book-open-reader', '아카이브 읽기', openReader],
        ['na_wand_extract', 'fa-scissors', '원문 뽑기', openExtract],
        ['na_wand_append', 'fa-file-circle-plus', '아카이브에 추가', openAppend],
        ['na_wand_wizard', 'fa-wand-magic-sparkles', '압축 마법사', openWizard],
        ['na_wand_preview', 'fa-eye', '주입 미리보기', openPreview],
    ];
    for (const [id, icon, label, fn] of items) {
        const $it = $(`<div id="${id}" class="list-group-item flex-container flexGap5 interactable na_wand_item" tabindex="0" title="서사 아카이브">
            <div class="fa-solid ${icon} extensionsMenuExtensionButton"></div><span>${label}</span></div>`);
        $it.on('click', needChat(fn));
        $menu.append($it);
    }
}

(function init() {
    const c = ctx();
    const es = c.eventSource;
    const et = c.eventTypes || c.event_types;

    const start = () => {
        if (!$('#na_settings').length) renderPanel();
        addWandMenu();
        onChatChanged();
    };

    es.on(et.APP_READY, start);
    es.on(et.CHAT_CHANGED, onChatChanged);
    if (et.GENERATION_STARTED) es.on(et.GENERATION_STARTED, xrayArm);
    if (et.GENERATION_STARTED) es.on(et.GENERATION_STARTED, onGenerationStarted);
    if (et.WORLD_INFO_ACTIVATED) es.on(et.WORLD_INFO_ACTIVATED, xrayWorldInfo);
    if (et.CHAT_COMPLETION_PROMPT_READY) es.on(et.CHAT_COMPLETION_PROMPT_READY, xrayCapture);
    if (et.GENERATE_AFTER_COMBINE_PROMPTS) es.on(et.GENERATE_AFTER_COMBINE_PROMPTS, xrayCapture);
    if (et.MESSAGE_RECEIVED) es.on(et.MESSAGE_RECEIVED, driftTick);
    for (const ev of [et.MESSAGE_RECEIVED, et.MESSAGE_SENT, et.MESSAGE_DELETED, et.MESSAGE_UPDATED]) {
        if (ev) es.on(ev, refreshStatusSoon);
    }
    // keyword-linked sections follow the conversation
    let linkTimer;
    const relink = () => {
        if (!hasChat() || !Object.keys(linkedMap(getMeta())).length) return;
        clearTimeout(linkTimer);
        linkTimer = setTimeout(() => { applyInjection().then(() => sectionPanel?.render()); }, 300);
    };
    for (const ev of [et.MESSAGE_RECEIVED, et.MESSAGE_SENT, et.MESSAGE_DELETED, et.MESSAGE_UPDATED, et.MESSAGE_SWIPED, et.MESSAGE_EDITED]) {
        if (ev) es.on(ev, relink);
    }
    if (document.getElementById('extensions_settings2')) start();
})();
