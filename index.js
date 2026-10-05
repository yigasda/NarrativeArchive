// 서사 아카이브 (Narrative Archive)
// You write the archive. This extension stores it per chat, injects it,
// hides already-compressed messages, extracts raw ranges, and shows token counts.

const MODULE = 'narrative_archive';
const PROMPT_KEY = 'narrative_archive_injection';
const VERSION = '2.0.2';
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
    tokenCap: 0,    // 0 = no cap
    capMode: 'warn', // 'warn' | 'trim' (drop oldest numbered sections)
    pinned: [],     // section/group titles never dropped by the cap
    linked: {},     // { title: [keywords] } — injected only when a keyword is in recent messages
    linkDepth: 4,   // how many recent messages to scan for those keywords
    history: [],    // [{ at, reason, added, removed, changed, delta, snapAt }] newest first
    backup: null,   // { at, how } — last .txt/.json export
    sinceBackup: 0, // changes since that export
    backupEvery: 10, // remind after this many changes (0 = off)
    lastExport: null, // { from, to, at, how } — the latest extract copied or saved
});

const SETTING_KEYS = ['keep', 'enabled', 'position', 'depth', 'role', 'wrap', 'remindTok', 'muted', 'track', 'tokenCap', 'capMode', 'pinned', 'backupEvery', 'linked', 'linkDepth'];
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
    if (!Array.isArray(md[MODULE].pinned)) md[MODULE].pinned = [];
    if (!Array.isArray(md[MODULE].history)) md[MODULE].history = [];
    delete md[MODULE].once; // removed in 1.4.0
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
        if (m.backupEvery > 0 && m.sinceBackup === m.backupEvery) toastr.info(`백업 뒤로 ${m.sinceBackup}번 바뀌었어요. 보관 탭에서 .json 백업을 받아 두세요.`, '서사 아카이브');
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

function wrapText(m, text) {
    const tpl = String(m.wrap || '').trim();
    if (!tpl) return text;
    return tpl.includes('{{archive}}') ? tpl.split('{{archive}}').join(text) : `${tpl}\n${text}`;
}

const pinnedSet = m => new Set(Array.isArray(m.pinned) ? m.pinned : []);

// What actually gets injected: muted sections removed, then (if a cap is set to trim)
// the oldest numbered sections dropped until it fits. Pinned sections — or anything
// inside a pinned group — are never dropped.
async function buildInjection(m) {
    const body = filterMuted(m, m.text);
    const cap = Math.max(0, Number(m.tokenCap) || 0);
    let text = body;
    const trimmed = [];
    if (cap && m.capMode === 'trim' && body.trim()) {
        let total = await cachedTokens(wrapText(m, body));
        if (total > cap) {
            const secs = parseSections(body);
            const pinned = pinnedSet(m);
            const stack = [], cands = [];
            for (const s of secs) {
                while (stack.length && stack[stack.length - 1].level >= s.level) stack.pop();
                if (s.group) { stack.push(s); continue; }
                const safe = pinned.has(s.title) || stack.some(g => pinned.has(g.title));
                if (!safe && RANGE_HEAD.test(s.title)) cands.push(s);
            }
            const drop = new Set();
            for (const s of cands) {
                if (total <= cap) break;
                total -= await cachedTokens(body.slice(s.start, s.end));
                drop.add(s.start);
                trimmed.push(s.title);
            }
            text = secs.filter(s => !drop.has(s.start)).map(s => body.slice(s.start, s.end)).join('');
        }
    }
    const final = text.trim() ? wrapText(m, text) : '';
    const tokens = await cachedTokens(final);
    return { text: final, tokens, trimmed, cap, over: !!cap && tokens > cap };
}

let lastBuild = { text: '', tokens: 0, trimmed: [], cap: 0, over: false };
let injectSeq = 0;
let injectReady = Promise.resolve(lastBuild);

function applyInjection() {
    const c = ctx();
    const m = hasChat() ? getMeta() : null;
    const seq = ++injectSeq;
    injectReady = (async () => {
        const b = m ? await buildInjection(m) : { text: '', tokens: 0, trimmed: [], cap: 0, over: false };
        if (seq !== injectSeq) return lastBuild;
        const trimChanged = b.trimmed.join('\n') !== lastBuild.trimmed.join('\n');
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
    if (Object.keys(linkedMap(m)).length) applyInjection(); // keyword links look at the latest messages
    const b = await currentInjection();
    const text = m.enabled ? b.text : '';
    m.lastInject = {
        at: Date.now(),
        enabled: !!m.enabled,
        tokens: m.enabled ? b.tokens : 0,
        chars: text.length,
        position: m.position, depth: m.depth, role: m.role,
        sections: parseSections(filterMuted(m, m.text)).filter(x => !x.group).length - b.trimmed.length,
        muted: mutedCount(m),
        trimmed: b.trimmed.length,
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

// ---- keyword-linked sections: left out until one of their keywords shows up in recent messages

const linkedMap = m => (m.linked && typeof m.linked === 'object' && !Array.isArray(m.linked)) ? m.linked : {};

function recentChatText(m) {
    const chat = ctx().chat || [];
    const n = Math.max(1, Number(m.linkDepth) || 4);
    const out = [];
    for (let i = chat.length - 1; i >= 0 && out.length < n; i--) {
        const x = chat[i];
        if (!x || x.is_system) continue;
        out.push(String(x.mes || ''));
    }
    return out.join('\n').toLowerCase();
}

// titles of linked sections whose keywords are not in the recent messages right now
function linkWaiting(m) {
    const entries = Object.entries(linkedMap(m)).filter(([, k]) => Array.isArray(k) && k.length);
    if (!entries.length) return new Set();
    const hay = recentChatText(m);
    return new Set(entries.filter(([, keys]) => !keys.some(w => w && hay.includes(String(w).toLowerCase()))).map(([t]) => t));
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
    // duplicate titles break per-section switches and collapsing
    const seen = new Map();
    for (const s of secs) {
        if (seen.has(s.title)) issues.push({ start: s.start, title: s.title, msg: '같은 제목이 또 있어요 (스위치·펼치기가 같이 움직여요)' });
        else seen.set(s.title, true);
    }
    return { issues: issues.sort((a, b) => a.start - b.start), ranged: ranged.length };
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
            // keep switches, pins and keyword links attached when the title is renamed
            if (newTitle && newTitle.trim() !== s.title) {
                const nt = newTitle.trim();
                const ren = arr => (arr || []).map(k => k === s.title ? nt : k);
                cur.muted = ren(cur.muted);
                cur.pinned = ren(cur.pinned);
                const lm = { ...linkedMap(cur) };
                if (lm[s.title]) { lm[nt] = lm[s.title]; delete lm[s.title]; cur.linked = lm; }
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
    const pinBtn = (on, what) => `<button type="button" class="na_icon na_icon_sm na_pin ${on ? 'on' : ''}" title="${on ? '고정 풀기' : `${what} 토큰 상한에 걸려도 안 빠지게 고정`}"><i class="fa-solid fa-thumbtack"></i></button>`;

    function render() {
        const m = getMeta();
        if (!m) return;
        const myId = ++renderId;
        const q = $search.val().trim();
        const sections = parseSections(m.text);
        const muted = mutedSet(m);
        const pinned = pinnedSet(m);
        const trimmedSet = new Set(m.capMode === 'trim' ? lastBuild.trimmed : []);
        const links = linkedMap(m);
        const waiting = linkWaiting(m);
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
                $g.find('> .na_group_head .na_pin').on('click', e => { e.stopPropagation(); setPinned(key, !pinned.has(key)); });
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
              <div class="na_card ${off ? 'na_off' : ''} ${parentOff ? 'na_off_parent' : ''} ${waiting.has(s.title) && !off ? 'na_waiting' : ''} ${trimmedSet.has(s.title) && !off ? 'na_trimmed' : ''}" data-start="${s.start}">
                <div class="na_card_head">
                  <div class="na_head_main">
                  <span class="na_card_title">${highlight(s.title, q)}</span>
                  <span class="na_card_meta">${links[s.title]?.length && !off ? `<span class="na_link_tag ${waiting.has(s.title) ? '' : 'on'}" title="키워드: ${esc(links[s.title].join(', '))}"><i class="fa-solid fa-key"></i> ${waiting.has(s.title) ? '대기' : '켜짐'}</span>` : ''}${trimmedSet.has(s.title) && !off ? '<span class="na_trim_tag">상한으로 빠짐</span>' : ''}${count ? `<span class="na_hit">${count}건</span>` : ''}<span class="na_tok">${fmt(body.length)}자</span></span>
                  </div>
                  <div class="na_head_ctrl">
                  ${pinBtn(pinned.has(s.title), '이 섹션을')}
                  ${sw(!off, off ? '주입 켜기' : '이 섹션만 주입에서 빼기 (본문은 그대로)')}
                  </div>
                </div>
                <div class="na_card_body" ${isOpen ? '' : 'hidden'}>
                  <div class="na_card_text">${highlight(body.replace(/^#{1,3} [^\n]*\n?/, '').trim(), q) || '<span class="na_dim">(비어 있음)</span>'}</div>
                  <div class="na_card_actions">
                    <button type="button" class="na_icon na_up" title="위로"><i class="fa-solid fa-arrow-up"></i></button>
                    <button type="button" class="na_icon na_down" title="아래로"><i class="fa-solid fa-arrow-down"></i></button>
                    <button type="button" class="na_icon na_ins" title="아래에 새 섹션"><i class="fa-solid fa-plus"></i></button>
                    <span class="na_act_sep"></span>
                    <button type="button" class="na_icon na_keys ${links[s.title]?.length ? 'active' : ''}" title="키워드 연동"><i class="fa-solid fa-key"></i></button>
                    <button type="button" class="na_icon na_towi" title="월드인포로 보내기"><i class="fa-solid fa-book-atlas"></i></button>
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
            $card.find('.na_card_head .na_pin').on('click', e => { e.stopPropagation(); setPinned(s.title, !pinned.has(s.title)); });
            $card.find('.na_edit').on('click', e => { e.stopPropagation(); editSection($card, s); });
            $card.find('.na_up').on('click', () => move(s, -1));
            $card.find('.na_down').on('click', () => move(s, 1));
            $card.find('.na_ins').on('click', () => insertAfter(s));
            $card.find('.na_keys').on('click', async () => {
                const cur = (links[s.title] || []).join(', ');
                const v = await ctx().Popup.show.input('키워드 연동',
                    '이 섹션을 평소엔 빼 두고, 최근 메시지에 키워드가 나올 때만 넣어요. 쉼표로 나눠 적고, 비우면 연동을 풀어요. (한국어 키워드도 같이 넣어야 한국어 대화에서 켜져요)', cur);
                if (typeof v !== 'string') return;
                await setLinked(s.title, v.split(/[,，]/).map(x => x.trim()).filter(Boolean));
            });
            $card.find('.na_towi').on('click', () => openSendToWI(s));
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
            if (q && !n && !g.$el.find('> .na_group_head mark, > .na_group_note mark').length) { g.$el.remove(); return; }
            Promise.all(g.tok).then(ns => {
                if (myId === renderId) $meta.text(`섹션 ${n}개 · ${shortNum(ns.reduce((x, y) => x + (y || 0), 0))} 토큰`);
            });
        });
        const offN = mutedCount(m);
        $info.html(q
            ? `"${esc(q)}" — 섹션 ${shown}개에서 ${hits}건`
            : `섹션 ${cardCount}개${offN ? ` · <span class="na_warn_txt">${offN}개 꺼짐</span>` : ''} · 스위치로 주입에서 뺄 수 있어요`);
        if (!sections.length) $list.html('<div class="na_empty">아카이브가 비어 있어요.<br>개요 탭에 붙여넣거나 보관 탭에서 불러오세요.</div>');
        if (editTarget) { pendingEdit = -1; editSection(...editTarget); editTarget[0][0].scrollIntoView({ block: 'center' }); }
    }

    function focus(start) {
        const s = parseSections(getMeta().text).find(x => x.start === start);
        if (!s) return;
        $search.val('');
        openCards.add(s.title);
        // open every group on the way so the card is visible
        collapsed.clear();
        render();
        const el = $list.find(`.na_card[data-start="${start}"]`)[0];
        if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('na_flash'); setTimeout(() => el.classList.remove('na_flash'), 1400); }
    }

    let t;
    $search.on('input', () => { clearTimeout(t); t = setTimeout(render, 200); });
    render();
    return { render, focus };
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
                  <button type="button" class="na_icon" id="na_ed_preview" title="주입 미리보기"><i class="fa-regular fa-eye"></i></button>
                  <button type="button" class="na_icon" id="na_ed_toc" title="목차"><i class="fa-solid fa-list-ul"></i></button>
                  <button type="button" class="na_icon" id="na_ed_find" title="찾아 바꾸기"><i class="fa-solid fa-magnifying-glass"></i></button>
                  <button type="button" class="na_icon" id="na_ed_copy" title="전체 복사"><i class="fa-regular fa-copy"></i></button>
                  <button type="button" class="na_icon" id="na_ed_big" title="크게 보기"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></button>
                </div>
                <div class="na_toc" id="na_toc" hidden></div>
                <div class="na_findbar" id="na_findbar" hidden>
                  <div class="na_find_row">
                    <input type="search" class="text_pole" id="na_find_q" placeholder="찾기 (Enter: 다음)">
                    <span class="na_find_info" id="na_find_info"></span>
                    <button type="button" class="na_icon na_icon_sm" id="na_find_next" title="다음"><i class="fa-solid fa-arrow-down"></i></button>
                  </div>
                  <div class="na_find_row">
                    <input type="text" class="text_pole" id="na_rep_q" placeholder="바꿀 말">
                    <button type="button" class="na_btn na_small" id="na_rep_one">바꾸기</button>
                    <button type="button" class="na_btn na_small" id="na_rep_all" disabled>모두</button>
                  </div>
                  <label class="na_find_case"><input type="checkbox" id="na_find_case"> 대소문자 구분</label>
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
                <details class="na_hcheck" id="na_hcheck">
                  <summary><i class="fa-solid fa-spell-check"></i> 제목 검사 <span class="na_chip" id="na_hcheck_n">-</span></summary>
                  <div id="na_hcheck_list"></div>
                </details>
                <div id="na_sec_host"></div>
              </div>
            </section>

            <!-- 압축 -->
            <section class="na_tab_pane" data-pane="compress" hidden>
              <div class="na_block">
                <div class="na_block_head"><div><h4>경계선</h4><p>아카이브가 다루는 마지막 메시지 번호예요. 그 앞은 숨겨서 토큰을 아껴요.</p></div></div>
                <div class="na_set_list">
                  <label class="na_set_row"><span><span>아카이브 따라가기</span><small id="na_track_info">제목의 마지막 #번호를 경계선으로</small></span><input type="checkbox" id="na_track" class="na_toggle"></label>
                  <label class="na_set_row" id="na_boundary_row"><span><span>경계선 번호</span><small>여기까지 아카이브에 담겼어요</small></span><input type="number" id="na_boundary" class="text_pole" min="0" placeholder="-"></label>
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
                  <button type="button" class="na_step na_step_sub" id="na_unhide"><b><i class="fa-solid fa-eye"></i></b><span><strong>숨김 해제</strong><small id="na_hidden_n">숨긴 메시지 다시 보이게</small></span><i class="fa-solid fa-chevron-right"></i></button>
                </div>
              </div>
            </section>

            <!-- 보관 -->
            <section class="na_tab_pane" data-pane="vault" hidden>
              <div class="na_block">
                <div class="na_block_head"><div><h4>백업 · 가져오기</h4><p id="na_backup_info"></p></div></div>
                <div class="na_tiles">
                  <button type="button" class="na_tile" id="na_export_json"><i class="fa-solid fa-box-archive"></i><span>.json 백업</span><small>설정·복구 지점까지</small></button>
                  <button type="button" class="na_tile" id="na_export"><i class="fa-solid fa-file-lines"></i><span>.txt 내보내기</span><small>본문만</small></button>
                  <button type="button" class="na_tile" id="na_import"><i class="fa-solid fa-file-arrow-up"></i><span>파일에서</span><small>.txt · .json</small></button>
                  <button type="button" class="na_tile" id="na_from_chat"><i class="fa-solid fa-comments"></i><span>다른 채팅에서</span><small>같은 캐릭터</small></button>
                  <button type="button" class="na_tile" id="na_all_archives"><i class="fa-solid fa-layer-group"></i><span>전체 아카이브</span><small>모든 채팅 모아 보기</small></button>
                  <button type="button" class="na_tile" id="na_compare"><i class="fa-solid fa-code-compare"></i><span>두 버전 비교</span><small>복구 지점·파일</small></button>
                </div>
                <div class="na_row na_right"><button type="button" class="na_linkbtn na_danger" id="na_clear"><i class="fa-solid fa-eraser"></i> 아카이브 비우기</button></div>
                <input type="file" id="na_file" accept=".txt,.md,.json,text/plain,application/json" hidden>
              </div>
              <details class="na_block na_details na_fold" open>
                <summary>복구 지점 <span class="na_chip" id="na_snap_n">0</span></summary>
                <div>
                  <div class="na_fold_head">
                    <p class="na_dim">바꾸기 직전 상태를 자동으로 남겨요 (최근 ${SNAPSHOT_MAX}개).</p>
                    <button type="button" class="na_btn na_small" id="na_snap_now"><i class="fa-solid fa-bookmark"></i> 지금 보관</button>
                  </div>
                  <div id="na_snap_list" class="na_snap_list"></div>
                </div>
              </details>
              <details class="na_block na_details na_fold">
                <summary>변경 내역 <span class="na_chip" id="na_hist_n">0</span></summary>
                <div>
                  <p class="na_dim na_fold_desc">언제 어떤 섹션이 바뀌었는지 최근 ${HISTORY_MAX}번까지. 복구 지점이 남아 있으면 그때 바뀐 내용을 볼 수 있어요.</p>
                  <div id="na_hist_list" class="na_hist_list"></div>
                </div>
              </details>
            </section>

            <!-- 설정 -->
            <section class="na_tab_pane" data-pane="config" hidden>
              <div class="na_block">
                <div class="na_block_head"><div><h4>주입</h4></div><button type="button" class="na_btn na_small" id="na_cfg_preview"><i class="fa-regular fa-eye"></i> 미리보기</button></div>
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
              <div class="na_block">
                <div class="na_block_head"><div><h4>분량 조절</h4><p>섹션 탭의 스위치 · 📌 · 🔑로 섹션마다 정하고, 여기선 한꺼번에 관리해요.</p></div></div>
                <div class="na_set_list">
                  <label class="na_set_row"><span><span>토큰 상한</span><small>0이면 없음</small></span><input type="number" id="na_cap" class="text_pole" min="0" step="1000"></label>
                  <label class="na_set_row" id="na_capmode_row"><span><span>상한을 넘으면</span><small>📌 고정한 섹션은 안 빠져요</small></span>
                    <select id="na_capmode" class="text_pole"><option value="warn">경고만</option><option value="trim">오래된 섹션부터 빼기</option></select>
                  </label>
                  <label class="na_set_row"><span><span>키워드 연동 범위</span><small>최근 메시지 몇 개에서 찾을지 · 연동 <b id="na_linked_n">0</b>개</small></span><input type="number" id="na_link_depth" class="text_pole" min="1" max="50"></label>
                  <div class="na_set_row"><span><span>고정한 섹션 <b id="na_pinned_n">0</b>개</span></span><button type="button" class="na_btn na_small" id="na_unpin_all">모두 풀기</button></div>
                  <div class="na_set_row"><span><span>꺼 둔 섹션 <b id="na_muted_n">0</b>개</span></span><button type="button" class="na_btn na_small" id="na_unmute_all">모두 켜기</button></div>
                </div>
              </div>
              <div class="na_block">
                <div class="na_block_head"><div><h4>감싸기</h4><p><code>{{archive}}</code> 자리에 본문이 들어가요. 비워 두면 본문만.</p></div></div>
                <textarea id="na_wrap" class="text_pole na_wrap" rows="3" spellcheck="false" placeholder="<story_archive>&#10;{{archive}}&#10;</story_archive>"></textarea>
              </div>
              <div class="na_block">
                <div class="na_block_head"><div><h4>알림</h4></div></div>
                <div class="na_set_list">
                  <label class="na_set_row"><span><span>압축 알림</span><small>경계선 뒤 원문이 이 토큰을 넘으면 · 0은 끔</small></span><input type="number" id="na_remind" class="text_pole" min="0" step="1000"></label>
                  <label class="na_set_row"><span><span>백업 알림</span><small>백업 뒤 이만큼 바뀌면 · 0은 끔</small></span><input type="number" id="na_backup_every" class="text_pole" min="0" max="999"></label>
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
    $('#na_ed_find').on('click', () => togglePanel('#na_findbar', () => $('#na_find_q').trigger('focus').trigger('input')));
    $('#na_ed_toc').on('click', () => togglePanel('#na_toc', renderToc));

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

    let findFrom = 0;
    const findOpts = () => ({ q: $('#na_find_q').val(), cs: $('#na_find_case').prop('checked') });
    const matchesOf = (text, q, cs) => {
        if (!q) return [];
        const hay = cs ? text : text.toLowerCase(), needle = cs ? q : q.toLowerCase();
        const out = [];
        for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + needle.length)) out.push(at);
        return out;
    };
    const doFind = advance => {
        const { q, cs } = findOpts();
        const text = $ed.val();
        const hits = matchesOf(text, q, cs);
        $('#na_rep_all').prop('disabled', !hits.length);
        if (!q) { $('#na_find_info').text(''); return; }
        if (!hits.length) { $('#na_find_info').text('없음'); return; }
        let idx = hits.findIndex(at => at >= (advance ? findFrom : 0));
        if (idx < 0) idx = 0;
        const at = hits[idx];
        findFrom = at + q.length;
        $('#na_find_info').text(`${idx + 1}/${hits.length}`);
        revealInEditor(at, at + q.length, { keepFocus: true });
    };
    const replaceText = (text, from, len, rep) => text.slice(0, from) + rep + text.slice(from + len);
    $('#na_find_q').on('input', () => { findFrom = 0; doFind(false); });
    $('#na_find_case').on('change', () => { findFrom = 0; doFind(false); });
    $('#na_find_q').on('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doFind(true); } });
    $('#na_find_next').on('click', () => doFind(true));
    $('#na_rep_one').on('click', () => {
        const { q, cs } = findOpts();
        if (!q) return;
        const el = $ed[0];
        const sel = el.value.slice(el.selectionStart, el.selectionEnd);
        const same = cs ? sel === q : sel.toLowerCase() === q.toLowerCase();
        if (same) {
            const at = el.selectionStart;
            $ed.val(replaceText(el.value, at, q.length, $('#na_rep_q').val())).trigger('input');
            findFrom = at + $('#na_rep_q').val().length;
        }
        doFind(true);
    });
    $('#na_rep_all').on('click', async () => {
        const { q, cs } = findOpts();
        const rep = $('#na_rep_q').val();
        const hits = matchesOf($ed.val(), q, cs);
        if (!hits.length) return;
        if (!await confirm('모두 바꾸기', `"${q}" ${hits.length}군데를 "${rep}"(으)로 바꿀까요? 편집칸에만 바뀌고, 저장해야 반영돼요.`)) return;
        let text = $ed.val();
        for (let i = hits.length - 1; i >= 0; i--) text = replaceText(text, hits[i], q.length, rep);
        $ed.val(text).trigger('input');
        doFind(false);
        toastr.success(`${hits.length}군데 바꿈 · 저장을 눌러야 반영돼요`);
    });

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
    $('#na_unhide').on('click', needChat(openUnhide));
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
    $('#na_all_archives').on('click', needChat(openAllArchives));
    $('#na_compare').on('click', needChat(openCompare));
    $('#na_carry_go').on('click', needChat(async () => { if (carryOffer) await importArchive(carryOffer, '방금 있던 채팅'); }));
    $('#na_carry_x').on('click', () => { carryOffer = null; $('#na_carry').prop('hidden', true); });
    $('#na_cap').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.tokenCap = Math.max(0, parseInt(this.value, 10) || 0); this.value = m.tokenCap;
        await saveMeta(); applyInjection(); syncPanel();
    });
    $('#na_capmode').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.capMode = this.value === 'trim' ? 'trim' : 'warn';
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
    let wrapTimer;
    $('#na_wrap').on('input', function () {
        clearTimeout(wrapTimer);
        wrapTimer = setTimeout(async () => {
            if (!hasChat()) return;
            const m = getMeta();
            m.wrap = this.value; await saveMeta(); applyInjection(); refreshStatus();
        }, 500);
    });
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
    $('#na_link_depth').val(m.linkDepth || 4);
    $('#na_linked_n').text(Object.keys(linkedMap(m)).filter(t => m.text.includes(t)).length);
    $('#na_backup_every').val(m.backupEvery ?? 10);
    {
        const due = m.backupEvery > 0 && m.sinceBackup >= m.backupEvery;
        $('#na_backup_info').html(m.backup
            ? `마지막 백업 ${esc(timeLabel(m.backup.at))} (${m.backup.how === 'json' ? '.json' : '.txt'}) · 그 뒤 <b class="${due ? 'na_warn_txt' : ''}">${m.sinceBackup || 0}번</b> 바뀜`
            : `아직 백업한 적 없어요${m.sinceBackup ? ` · <b class="${due ? 'na_warn_txt' : ''}">${m.sinceBackup}번</b> 바뀜` : ''}`);
    }
    renderHistory();
    $('#na_snap_n').text(m.snapshots.length);
    $('#na_hist_n').text(m.history.length);
    $('#na_cap').val(m.tokenCap || 0);
    $('#na_capmode').val(m.capMode === 'trim' ? 'trim' : 'warn');
    $('#na_capmode_row').toggleClass('na_disabled', !(m.tokenCap > 0));
    {
        const titles = new Set(parseSections(m.text).map(x => x.title));
        const n = [...pinnedSet(m)].filter(t => titles.has(t)).length;
        $('#na_pinned_n').text(n);
        $('#na_unpin_all').prop('disabled', !n);
    }
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
    renderHeadingCheck();
    renderSnapshots();
    refreshInjectLog();
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

function renderHistory() {
    const $l = $('#na_hist_list');
    if (!$l.length || !hasChat()) return;
    const m = getMeta();
    $l.empty();
    if (!m.history.length) { $l.html('<div class="na_empty">아직 바뀐 기록이 없어요.</div>'); return; }
    const names = arr => arr.map(t => `<span class="na_hist_sec">${esc(t)}</span>`).join('');
    m.history.forEach((h, i) => {
        const si = h.snapAt ? m.snapshots.findIndex(x => x.at === h.snapAt) : -1;
        // state right after this change = state right before the next one (or now)
        const nextH = m.history[i - 1];
        const afterSnap = nextH ? m.snapshots.find(x => x.at === nextH.snapAt) : null;
        const canDiff = si >= 0 && (i === 0 || !!afterSnap);
        const parts = [];
        if (h.added.length) parts.push(`<div><span class="na_hist_k na_hist_add">추가</span>${names(h.added)}</div>`);
        if (h.changed.length) parts.push(`<div><span class="na_hist_k">수정</span>${names(h.changed)}</div>`);
        if (h.renamed?.length) parts.push(`<div><span class="na_hist_k">제목</span>${names(h.renamed)}</div>`);
        if (h.removed.length) parts.push(`<div><span class="na_hist_k na_hist_del">삭제</span>${names(h.removed)}</div>`);
        if (!parts.length) parts.push('<div class="na_dim">섹션 밖 글자만 바뀜</div>');
        const $row = $(`
          <div class="na_hist">
            <div class="na_hist_top">
              <span class="na_snap_time">${esc(timeLabel(h.at))}</span>
              <span class="na_snap_reason">${esc(h.reason)}</span>
              <span class="na_hist_delta ${h.delta >= 0 ? 'na_hist_add' : 'na_hist_del'}">${h.delta >= 0 ? '+' : '−'}${fmt(Math.abs(h.delta))}자</span>
              ${canDiff ? '<button type="button" class="na_icon na_icon_sm na_hist_diff" title="그때 바뀐 내용"><i class="fa-solid fa-code-compare"></i></button>' : ''}
            </div>
            <div class="na_hist_body">${parts.join('')}</div>
          </div>`);
        $row.find('.na_hist_diff').on('click', () => {
            openDiff(m.snapshots[si], afterSnap ? { text: afterSnap.text, label: '바뀐 뒤' } : { text: m.text, label: '바뀐 뒤 (지금)' });
        });
        $l.append($row);
    });
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
        <div class="na_log_row"><span>분량</span><b>${fmt(li.tokens)} 토큰</b><span class="na_dim">${fmt(li.chars)}자 · 섹션 ${li.sections}개${li.muted ? ` · ${li.muted}개 꺼짐` : ''}${li.trimmed ? ` · 상한으로 ${li.trimmed}개 뺌` : ''}</span></div>
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

async function openDiff(snap, after = { text: getMeta().text, label: '지금' }) {
    const c = ctx();
    const rows = lineDiff(snap.text, after.text);
    const add = rows.filter(r => r.t === '+').length, del = rows.filter(r => r.t === '-').length;
    const $v = $(`
      <div class="na_popup">
        <div class="na_diff_head">
          <b>${esc(timeLabel(snap.at))} · ${esc(snap.reason)}</b> → <b>${esc(after.label)}</b>
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
    const build = await currentInjection();
    const archiveTok = m.enabled ? build.tokens : 0;
    const after = m.boundary >= 0 ? buildExtract(m.boundary + 1, last) : [];
    const afterTok = await countTokens(extractToText(after));
    const total = archiveTok + afterTok;
    const over = m.remindTok > 0 && afterTok >= m.remindTok;

    $('#na_meter_total').html(`${fmt(total)}<small> 토큰 주입</small>`);
    let state = '';
    if (!m.enabled) state = '<span class="na_chip na_chip_off">주입 꺼짐</span>';
    else if (over) state = '<span class="na_chip na_chip_warn">압축할 때예요</span>';
    else if (m.backupEvery > 0 && m.sinceBackup >= m.backupEvery) state = '<span class="na_chip na_chip_warn">백업할 때예요</span>';
    else if (m.text.trim()) state = '<span class="na_chip na_chip_on">주입 중</span>';
    $('#na_meter_state').html(state);

    const pct = total ? Math.round(archiveTok / total * 100) : 0;
    $('#na_meter .na_seg_arc').css('width', `${pct}%`);
    $('#na_meter .na_seg_raw').css('width', `${total ? 100 - pct : 0}%`).toggleClass('na_over', over);
    $('#na_meter_legend').html(`
      <span><i class="na_dot na_dot_arc"></i>아카이브 ${fmt(archiveTok)}</span>
      <span><i class="na_dot na_dot_raw"></i>${m.boundary >= 0 ? `#${m.boundary} 이후 원문 ${fmt(afterTok)} · ${after.length}개` : '경계선 없음'}</span>
      ${mutedCount(m) ? `<span class="na_warn_txt"><i class="fa-solid fa-toggle-off"></i> 섹션 ${mutedCount(m)}개 꺼짐</span>` : ''}
      ${linkWaiting(m).size ? `<span class="na_dim"><i class="fa-solid fa-key"></i> 키워드 대기 ${linkWaiting(m).size}개</span>` : ''}
      ${build.trimmed.length ? `<span class="na_warn_txt"><i class="fa-solid fa-scissors"></i> 상한 ${fmt(build.cap)}에 맞춰 ${build.trimmed.length}개 뺌</span>` : ''}
      ${build.over ? `<span class="na_warn_txt"><i class="fa-solid fa-triangle-exclamation"></i> 상한 ${fmt(build.cap)} 넘음</span>` : ''}`);
    $('#na_head_badge').text(m.text.trim() ? fmt(archiveTok) : '');

    const lx = m.lastExport;
    const lxNote = lx ? `<div class="na_dim">최근 내보냄 #${lx.from}–#${lx.to} · ${esc(timeLabel(lx.at))}</div>` : '';
    const hn = hiddenIndexes().length;
    $('#na_hidden_n').text(hn ? `지금 숨긴 메시지 ${hn}개 · 범위 골라 다시 보이게` : '숨긴 메시지 없음');
    $('#na_since').html(lxNote + (m.boundary >= 0
        ? `현재 마지막 <b>#${last}</b> · 압축 이후 메시지 <b>${after.length}</b>개 · 원문 <b>${fmt(afterTok)}</b> 토큰${over ? ` <span class="na_chip na_chip_warn">알림 기준 ${fmt(m.remindTok)} 넘음</span>` : ''}`
        : '<span class="na_dim">경계선이 아직 없어요. 직접 적거나 "아카이브에 추가"를 쓰면 자동으로 정해져요.</span>'));
}

// ---------------------------------------------------------------- send a section to World Info

async function worldNames() {
    try {
        const d = await fetchJson('/api/settings/get', {});
        return Array.isArray(d?.world_names) ? d.world_names : [];
    } catch { return []; }
}

function renameKeys(m, from, to) {
    const ren = arr => (arr || []).map(k => k === from ? to : k);
    m.muted = ren(m.muted);
    m.pinned = ren(m.pinned);
    const lm = { ...linkedMap(m) };
    if (lm[from]) { lm[to] = lm[from]; delete lm[from]; m.linked = lm; }
}

// "#12–#30 — The harbor deal (…) [WI: x]" → "The harbor deal"
const shortTitle = title => (title.split(/\s[—–-]\s/).slice(1).join(' — ') || title).replace(/\s*[[(].*$/, '').trim() || title;

async function createWorldEntry(book, { keys, comment, content }) {
    const c = ctx();
    if (typeof c.loadWorldInfo !== 'function' || typeof c.saveWorldInfo !== 'function') throw new Error('이 실리태번 버전에서는 월드인포를 바로 쓸 수 없어요');
    let uid = null;
    // let ST build the entry with its own defaults, then fill it in directly (keeps "|" and "{{" in content safe)
    try {
        const q = v => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        const r = await c.executeSlashCommandsWithOptions(`/createentry file=${q(book)} key=${q(keys[0] || comment)} …`, { handleParserErrors: false, handleExecutionErrors: false });
        if (r && r.pipe !== undefined && r.pipe !== '' && !isNaN(Number(r.pipe))) uid = Number(r.pipe);
    } catch { /* fall back below */ }
    const data = (await c.loadWorldInfo(book)) || { entries: {} };
    data.entries ||= {};
    let entry = uid !== null ? data.entries[uid] : null;
    if (!entry) {
        uid = Math.max(-1, ...Object.keys(data.entries).map(Number).filter(Number.isFinite)) + 1;
        entry = data.entries[uid] = {
            uid, key: [], keysecondary: [], comment: '', content: '', constant: false, vectorized: false, selective: true,
            selectiveLogic: 0, addMemo: true, order: 100, position: 0, disable: false, excludeRecursion: false,
            preventRecursion: false, probability: 100, useProbability: true, depth: 4, group: '', groupOverride: false,
            groupWeight: 100, scanDepth: null, caseSensitive: null, matchWholeWords: null, useGroupScoring: null,
            automationId: '', role: null, sticky: 0, cooldown: 0, delay: 0, displayIndex: uid,
        };
    }
    entry.key = keys;
    entry.comment = comment;
    entry.content = content;
    await c.saveWorldInfo(book, data, true);
    try { c.reloadWorldInfoEditor?.(book, true); } catch { /* editor not open */ }
    return uid;
}

async function openSendToWI(s) {
    const c = ctx();
    const m = getMeta();
    const raw = m.text.slice(s.start, s.end);
    const headLine = raw.split('\n')[0];
    const body = trimEnd(raw.split('\n').slice(1).join('\n')).replace(/^\s+/, '').replace(/\n-{3,}\s*$/, '');
    const names = await worldNames();
    const charBook = c.characters?.[c.characterId]?.data?.extensions?.world || '';
    const chatBook = c.chatMetadata?.world_info || '';
    const def = charBook || chatBook || names[0] || '';
    const firstBullet = (body.match(/^\s*[-*] (.+)$/m) || [])[1] || '';
    const anchorFor = name => `${headLine.replace(/\s*\[WI:[^\]]*\]\s*$/, '')} [WI: ${name}]\n\nPLOT:\n- ${firstBullet.length > 220 ? `${firstBullet.slice(0, 220).trim()}…` : firstBullet}`;
    const existingWI = (s.title.match(/\[WI:\s*([^\]]+)\]/) || [])[1]?.trim();
    const nameDef = existingWI || shortTitle(s.title).split(/,|\s(?:and|&)\s/)[0].trim() || shortTitle(s.title);

    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div>
          <h4>월드인포로 보내기</h4>
          <p>이 섹션 본문을 로어북 항목으로 만들고, 아카이브에는 짧은 앵커만 남겨요. 키워드가 나올 때만 본문이 들어가서 토큰이 줄어요.</p>
        </div></div>
        <div class="na_set_list">
          <label class="na_set_row"><span>로어북</span>
            <select class="text_pole na_wi_book">
              ${names.map(n => `<option value="${esc(n)}" ${n === def ? 'selected' : ''}>${esc(n)}${n === charBook ? ' (캐릭터)' : n === chatBook ? ' (채팅)' : ''}</option>`).join('')}
              <option value="__new">＋ 새 로어북…</option>
            </select>
          </label>
          <label class="na_set_row na_wi_newrow" hidden><span>새 로어북 이름</span><input type="text" class="text_pole na_wi_newname" placeholder="이름"></label>
          <label class="na_set_row"><span>항목 이름</span><input type="text" class="text_pole na_wi_name"></label>
          <label class="na_set_row na_set_col"><span><span>키워드</span><small>쉼표로 나눠요. 대화가 한국어면 한국어 키워드도 꼭 넣어요. 너무 넓은 말(왕, 약, 언니 …)은 피해요.</small></span>
            <input type="text" class="text_pole na_wi_keys" placeholder="예: 항구, harbor, 선장"></label>
        </div>
        <div class="na_wi_label">항목 본문</div>
        <textarea class="text_pole na_wi_body na_sec_edit" spellcheck="false"></textarea>
        <label class="checkbox_label"><input type="checkbox" class="na_wi_anchor_on" checked><span>아카이브의 이 섹션을 앵커로 바꾸기</span></label>
        <textarea class="text_pole na_wi_anchor" spellcheck="false" rows="5"></textarea>
        <div class="na_dim na_wi_hint">아카이브가 월드인포 스캔 대상이면 앵커 속 단어 때문에 항목이 늘 켜질 수 있어요. 앵커에는 키워드를 되도록 빼 두세요.</div>
      </div>`);
    $root.find('.na_wi_name').val(nameDef);
    $root.find('.na_wi_body').val(body);
    const $anchor = $root.find('.na_wi_anchor').val(anchorFor(nameDef));
    let anchorTouched = false;
    $anchor.on('input', () => { anchorTouched = true; });
    $root.find('.na_wi_name').on('input', function () { if (!anchorTouched) $anchor.val(anchorFor(this.value.trim() || nameDef)); });
    $root.find('.na_wi_anchor_on').on('change', function () { $anchor.prop('hidden', !this.checked); });
    $root.find('.na_wi_book').on('change', function () { $root.find('.na_wi_newrow').prop('hidden', this.value !== '__new'); });
    if (!names.length) { $root.find('.na_wi_book').val('__new'); $root.find('.na_wi_newrow').prop('hidden', false); }

    const r = await c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '보내기', cancelButton: '취소' });
    if (r !== c.POPUP_RESULT.AFFIRMATIVE && r !== true) return;

    let book = $root.find('.na_wi_book').val();
    const isNew = book === '__new';
    if (isNew) book = $root.find('.na_wi_newname').val().trim();
    const comment = $root.find('.na_wi_name').val().trim() || nameDef;
    const keys = $root.find('.na_wi_keys').val().split(/[,，]/).map(x => x.trim()).filter(Boolean);
    const content = $root.find('.na_wi_body').val().trim();
    if (!book) return toastr.warning('로어북을 골라 주세요.');
    if (!keys.length) return toastr.warning('키워드를 하나 이상 넣어 주세요.');
    if (!content) return toastr.warning('항목 본문이 비어 있어요.');

    try {
        if (isNew && !names.includes(book)) {
            await c.saveWorldInfo(book, { entries: {} }, true);
            try { await c.updateWorldInfoList?.(); } catch { /* list refresh is cosmetic */ }
        }
        await createWorldEntry(book, { keys, comment, content });
    } catch (e) {
        console.warn('[narrative-archive] WI', e);
        return toastr.error(`월드인포에 못 넣었어요: ${e.message || e}`);
    }

    if ($root.find('.na_wi_anchor_on').prop('checked')) {
        const cur = getMeta();
        if (cur.text.slice(s.start, s.end) !== raw) {
            toastr.warning('월드인포 항목은 만들었는데, 아카이브가 그사이 바뀌어서 앵커로는 안 바꿨어요.');
            return;
        }
        const anchor = trimEnd($anchor.val());
        const newTitle = (anchor.match(/^#{1,3} (.*)$/m) || [])[1]?.trim();
        if (newTitle && newTitle !== s.title) renameKeys(cur, s.title, newTitle);
        const trail = raw.match(/\s*$/)[0] || '\n\n';
        await commitText(cur.text.slice(0, s.start) + anchor + trail + cur.text.slice(s.end), `WI로 보내기 전: ${s.title.slice(0, 40)}`);
    }
    toastr.success(`"${book}"에 "${comment}" 항목을 만들었어요`);
}

// ---------------------------------------------------------------- every chat's archive

let lastScan = null; // { at, items: [{ owner, kind, chat, meta }] } — this session only

async function scanAllArchives({ onProgress, stopped }) {
    const c = ctx();
    const owners = [
        ...(c.characters || []).filter(ch => ch?.avatar).map(ch => ({ kind: 'char', name: ch.name, avatar: ch.avatar })),
        ...(c.groups || []).map(g => ({ kind: 'group', name: g.name, id: g.id, chats: g.chats || [] })),
    ];
    const items = [];
    let done = 0, chatsSeen = 0;
    const queue = [...owners];
    const work = async () => {
        while (queue.length && !stopped()) {
            const o = queue.shift();
            try {
                let chats = [];
                if (o.kind === 'char') {
                    const data = await fetchJson('/api/characters/chats', { avatar_url: o.avatar });
                    chats = (Array.isArray(data) ? data : Object.values(data || {})).filter(x => x?.file_name).map(x => String(x.file_name).replace(/\.jsonl$/, ''));
                } else chats = o.chats;
                for (const chat of chats) {
                    if (stopped()) break;
                    chatsSeen++;
                    const arr = o.kind === 'char'
                        ? await fetchJson('/api/chats/get', { ch_name: o.name, file_name: chat, avatar_url: o.avatar })
                        : await fetchJson('/api/chats/group/get', { id: chat });
                    const meta = arr?.[0]?.chat_metadata?.[MODULE];
                    if (meta?.text?.trim()) items.push({ owner: o.name, kind: o.kind, chat, meta });
                    onProgress({ done, total: owners.length, chatsSeen, found: items.length });
                }
            } catch (e) { console.warn('[narrative-archive] scan', o.name, e); }
            done++;
            onProgress({ done, total: owners.length, chatsSeen, found: items.length });
        }
    };
    await Promise.all([work(), work(), work()]);
    return items;
}

async function openAllArchives() {
    const c = ctx();
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div>
          <h4>전체 아카이브</h4>
          <p>모든 캐릭터·그룹의 채팅을 열어 보고 아카이브가 있는 곳을 모아요. 채팅이 많으면 시간이 걸려요. 채팅 내용은 바꾸지 않아요.</p>
        </div></div>
        <div class="na_row">
          <button type="button" class="na_btn na_primary na_scan_go"><i class="fa-solid fa-magnifying-glass"></i> 검사</button>
          <button type="button" class="na_btn na_scan_stop" hidden><i class="fa-solid fa-stop"></i> 멈추기</button>
          <button type="button" class="na_btn na_scan_all" hidden><i class="fa-solid fa-box-archive"></i> 찾은 것 모두 백업</button>
          <span class="na_dim na_scan_info"></span>
        </div>
        <input type="search" class="text_pole na_scan_q" placeholder="캐릭터·채팅 이름으로 거르기" hidden>
        <div class="na_scan_list"></div>
      </div>`);
    let items = lastScan?.items || [];
    let stop = false;
    const fileName = it => `아카이브_${it.owner}_${it.chat}`.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
    const backupOne = it => {
        const { lastInject, ...data } = it.meta;
        download(`${fileName(it)}.json`, JSON.stringify({ format: 'narrative-archive', version: VERSION, data }, null, 2), 'application/json');
    };
    const render = () => {
        const q = $root.find('.na_scan_q').val().trim().toLowerCase();
        const shown = items.filter(it => !q || it.owner.toLowerCase().includes(q) || it.chat.toLowerCase().includes(q));
        const $l = $root.find('.na_scan_list').empty();
        $root.find('.na_scan_all, .na_scan_q').prop('hidden', !items.length);
        if (!items.length) { $l.html(`<div class="na_empty">${lastScan ? '아카이브가 있는 채팅을 못 찾았어요.' : '검사를 누르면 시작해요.'}</div>`); return; }
        const byOwner = new Map();
        shown.forEach(it => { if (!byOwner.has(it.owner)) byOwner.set(it.owner, []); byOwner.get(it.owner).push(it); });
        for (const [owner, list] of byOwner) {
            const $g = $(`<div class="na_scan_owner"><div class="na_scan_oname">${esc(owner)} <span class="na_chip">${list.length}</span></div></div>`);
            list.forEach(it => {
                const when = it.meta.history?.[0]?.at || it.meta.backup?.at;
                const here = it.chat === currentChatId();
                const $row = $(`
                  <div class="na_pick">
                    <div class="na_pick_main">
                      <span class="na_pick_name">${esc(it.chat)}${here ? ' <span class="na_chip na_chip_on">지금 채팅</span>' : ''}</span>
                      <span class="na_pick_meta">${fmt(it.meta.text.length)}자${it.meta.boundary >= 0 ? ` · #${it.meta.boundary}까지` : ''}${when ? ` · 최근 변경 ${esc(timeLabel(when))}` : ''}</span>
                    </div>
                    <div class="na_pick_state">
                      <button type="button" class="na_icon na_scan_bk" title=".json 백업"><i class="fa-solid fa-download"></i></button>
                      ${here ? '' : '<button type="button" class="na_btn na_small na_scan_take">가져오기</button>'}
                    </div>
                  </div>`);
                $row.find('.na_scan_bk').on('click', () => backupOne(it));
                $row.find('.na_scan_take').on('click', async () => {
                    if (await importArchive({ text: it.meta.text, settings: it.meta }, `${it.owner} · ${it.chat}`)) $row.find('.na_scan_take').replaceWith('<span class="na_chip na_chip_on">가져옴</span>');
                });
                $g.append($row);
            });
            $l.append($g);
        }
    };
    $root.find('.na_scan_go').on('click', async () => {
        stop = false;
        $root.find('.na_scan_go').prop('disabled', true);
        $root.find('.na_scan_stop').prop('hidden', false);
        items = await scanAllArchives({
            stopped: () => stop,
            onProgress: p => $root.find('.na_scan_info').text(`${p.done}/${p.total} · 채팅 ${fmt(p.chatsSeen)}개 확인 · 찾음 ${p.found}`),
        });
        lastScan = { at: Date.now(), items };
        $root.find('.na_scan_go').prop('disabled', false).html('<i class="fa-solid fa-rotate"></i> 다시 검사');
        $root.find('.na_scan_stop').prop('hidden', true);
        $root.find('.na_scan_info').text(`${stop ? '멈춤 · ' : ''}아카이브 ${items.length}개`);
        render();
    });
    $root.find('.na_scan_stop').on('click', () => { stop = true; });
    $root.find('.na_scan_all').on('click', () => {
        const bundle = { format: 'narrative-archive-bundle', version: VERSION, at: Date.now(),
            items: items.map(it => { const { lastInject, ...data } = it.meta; return { owner: it.owner, kind: it.kind, chat: it.chat, data }; }) };
        download(`아카이브_전체_${nowStamp()}.json`, JSON.stringify(bundle, null, 2), 'application/json');
    });
    let t;
    $root.find('.na_scan_q').on('input', () => { clearTimeout(t); t = setTimeout(render, 200); });
    if (lastScan) $root.find('.na_scan_go').html('<i class="fa-solid fa-rotate"></i> 다시 검사'), $root.find('.na_scan_info').text(`지난 검사 ${timeLabel(lastScan.at)} · 아카이브 ${items.length}개`);
    render();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

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
      <div class="na_popup">
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
        if (a0 === null || b0 === null) { $root.find('.na_cmp_head').empty(); $root.find('.na_cmp_diff').html('<div class="na_empty">파일을 골라 주세요.</div>'); return; }
        const a = cut(a0, marker), b = cut(b0, marker);
        if (a === null || b === null) {
            $root.find('.na_cmp_head').empty();
            $root.find('.na_cmp_diff').html(`<div class="na_empty">"${esc(marker)}" 줄이 ${a === null && b === null ? '둘 다' : a === null ? 'A에' : 'B에'} 없어요.</div>`);
            return;
        }
        const rows = lineDiff(a, b);
        const add = rows.filter(r => r.t === '+').length, del = rows.filter(r => r.t === '-').length;
        $root.find('.na_cmp_head').html(`<b>A</b> ${esc(labelOf('a'))} → <b>B</b> ${esc(labelOf('b'))}
            ${add || del ? `<span class="na_chip na_chip_add">+${fmt(add)}줄</span><span class="na_chip na_chip_del">−${fmt(del)}줄</span>` : '<span class="na_chip na_chip_on">똑같아요</span>'}`);
        $root.find('.na_cmp_diff').html(add || del ? renderDiff(rows) : `<div class="na_empty">${marker ? `"${esc(marker)}"부터 ` : ''}내용이 똑같아요.</div>`);
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
    const titles = new Set(parseSections(m.text).map(x => x.title));
    const muted = [...mutedSet(m)].filter(t => titles.has(t));
    const waiting = [...linkWaiting(m)].filter(t => titles.has(t) && !muted.includes(t));
    const list = (arr, cls) => arr.map(t => `<li class="${cls}">${esc(t)}</li>`).join('');
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div>
          <h4>주입 미리보기</h4>
          <p>다음 응답 때 프롬프트에 실제로 들어가는 그대로예요. 감싸기 문구, 꺼 둔 섹션, 키워드 연동, 토큰 상한이 다 반영돼 있어요.</p>
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

function renderReading(m) {
    const muted = mutedSet(m);
    const waiting = linkWaiting(m);
    const trimmed = new Set(m.capMode === 'trim' ? lastBuild.trimmed : []);
    const secs = parseSections(m.text);
    const toc = [];
    let skipLevel = 0;
    const html = secs.map((s, i) => {
        if (skipLevel && s.level <= skipLevel) skipLevel = 0;
        const off = muted.has(s.title);
        if (off && s.group) skipLevel = s.level;
        const dim = off || skipLevel > 0;
        const wait = !dim && waiting.has(s.title);
        const cut = !dim && !wait && trimmed.has(s.title);
        const id = `na_rd_${i}`;
        if (s.title !== '(머리말)' && s.title !== '(제목 없음)') toc.push({ id, level: s.level, title: s.group ? groupLabel(s.title) : s.title });
        const tag = dim ? '<span class="na_rd_tag">주입 안 함</span>' : wait ? '<span class="na_rd_tag">키워드 대기</span>' : cut ? '<span class="na_rd_tag na_rd_tag_cut">상한으로 빠짐</span>' : '';
        return `<section id="${id}" class="na_rd_sec ${dim || wait ? 'na_rd_off' : ''} ${cut ? 'na_rd_cut' : ''}">${tag}${mdBlock(m.text.slice(s.start, s.end))}</section>`;
    }).join('');
    return { html, toc };
}

// ---------------------------------------------------------------- viewer popup

async function openViewer(startTab = 'sections') {
    const c = ctx();
    const $root = $(`
      <div class="na_popup">
        <div class="na_nav">
          <button type="button" class="na_nav_btn active" data-tab="sections">섹션</button>
          <button type="button" class="na_nav_btn" data-tab="read">읽기</button>
          <button type="button" class="na_nav_btn" data-tab="full">전체 편집</button>
        </div>
        <div class="na_pane" data-pane="sections"></div>
        <div class="na_pane" data-pane="read" hidden>
          <div class="na_rd_bar">
            <select class="text_pole na_rd_toc"></select>
            <button type="button" class="na_icon na_rd_smaller" title="글자 작게"><i class="fa-solid fa-minus"></i></button>
            <button type="button" class="na_icon na_rd_bigger" title="글자 크게"><i class="fa-solid fa-plus"></i></button>
          </div>
          <article class="na_reader"></article>
        </div>
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
        else if (tab === 'read') renderRead();
        else browser.render();
    });

    const g = globalSettings();
    const applyFont = () => $root.find('.na_reader').css('font-size', `${g.readSize || 1}em`);
    function renderRead() {
        const { html, toc } = renderReading(getMeta());
        $root.find('.na_reader').html(html || '<div class="na_empty">아카이브가 비어 있어요.</div>');
        $root.find('.na_rd_toc').html('<option value="">목차로 이동…</option>' + toc.map(t =>
            `<option value="${t.id}">${'\u00a0\u00a0'.repeat(Math.max(0, t.level - 1))}${esc(t.title)}</option>`).join(''));
        applyFont();
    }
    $root.find('.na_rd_toc').on('change', function () {
        const el = this.value && $root.find(`#${this.value}`)[0];
        if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
        this.value = '';
    });
    $root.find('.na_rd_smaller, .na_rd_bigger').on('click', function () {
        const d = $(this).hasClass('na_rd_bigger') ? 0.1 : -0.1;
        g.readSize = Math.min(1.6, Math.max(0.8, Math.round(((g.readSize || 1) + d) * 10) / 10));
        saveGlobal(); applyFont();
    });
    if (startTab !== 'sections') setTimeout(() => $root.find(`.na_nav_btn[data-tab="${startTab}"]`).trigger('click'), 0);

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
    const defaults = { usePrompt: false, skipHidden: true, nameStyle: 'full', stripTags: false };
    for (const [k, v] of Object.entries(defaults)) if (!Object.hasOwn(g, k)) g[k] = v;
    // prompt library: [{ id, name, text, fav }], first entry is the built-in basic one
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
    return (String(text).match(/^#{1,3} .*$/gm) || []).flatMap(line => {
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
    // continue after whichever is further: the boundary or the last range exported
    const le = m.lastExport;
    const after = Math.max(m.boundary, le && le.to <= last ? le.to : -1);
    const defStart = Math.min(after + 1, Math.max(0, last));
    const fromLast = !!le && le.to <= last && le.to > m.boundary;

    const $root = $(`
      <div class="na_popup">
        <div class="na_ex_range">
          <span class="na_range_label">범위</span>
          <label># <input type="number" class="text_pole na_num na_from" min="0" max="${last}" value="${Math.max(0, defStart)}"></label>
          <span>~</span>
          <label># <input type="number" class="text_pole na_num na_to" min="0" max="${last}" value="${Math.max(0, last)}"></label>
        </div>
        <div class="na_lastex" ${le ? '' : 'hidden'}>
          <i class="fa-solid fa-clock-rotate-left"></i>
          <span class="na_lastex_text"></span>
          <button type="button" class="na_linkbtn na_lastex_again">이 범위 다시</button>
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
          <div class="na_prompt_help">
            <code>{{raw}}</code> 원문 · <code>{{from}}</code> <code>{{to}}</code> 번호 · <code>{{last_section}}</code> 마지막 섹션 · <code>{{state}}</code> 지금의 STATE·OPEN · <code>{{archive}}</code> 아카이브 전체.
            <code>{{raw}}</code>가 없으면 원문은 맨 끝에 붙어요. 지시문은 이 기기의 실리태번 설정에만 저장돼요.
            <button type="button" class="na_linkbtn na_prompt_reset">기본 지시문 되돌리기</button>
          </div>
        </details>
        <div class="na_ex_info na_dim"></div>
        <div class="na_ex_actions">
          <button type="button" class="na_btn na_save_txt"><i class="fa-solid fa-download"></i> .txt 저장</button>
          <button type="button" class="na_btn na_copy na_primary"><i class="fa-solid fa-copy"></i> <span class="na_copy_label">전체 복사</span></button>
        </div>
        <textarea class="na_ex_hidden" readonly></textarea>
      </div>`);

    $root.find('.na_opt_hidden').prop('checked', g.skipHidden);
    $root.find('.na_opt_tags').prop('checked', g.stripTags);
    $root.find('.na_opt_name').val(g.nameStyle);
    $root.find('.na_opt_prompt').prop('checked', g.usePrompt);

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
            ? fillPrompt(activePrompt(g).text, { raw: current, from: String(from), to: String(to), last_section: lastRangedSection(m.text), state: splitTail(m.text)[1].trim() || '(없음)', archive: m.text })
            : current;
        $root.find('.na_ex_hidden').val(output);
        $root.find('.na_prompt_state').text(g.usePrompt ? activePrompt(g).name : '안 붙임').toggleClass('na_chip_on', g.usePrompt);
        $root.find('.na_copy_label').text(g.usePrompt ? '지시문과 함께 복사' : '전체 복사');
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
    // --- prompt library
    const renderPrompts = () => {
        const cur = activePrompt(g);
        const sorted = [...g.prompts].sort((a, b) => (b.fav - a.fav));
        $root.find('.na_psel').html(sorted.map(p => `<option value="${esc(p.id)}">${p.fav ? '★ ' : ''}${esc(p.name)}</option>`).join('')).val(cur.id);
        $root.find('.na_pfav').html(g.prompts.filter(p => p.fav).map(p =>
            `<button type="button" class="na_pchip ${p.id === cur.id ? 'on' : ''}" data-id="${esc(p.id)}">${esc(p.name)}</button>`).join(''));
        $root.find('.na_pstar i').attr('class', cur.fav ? 'fa-solid fa-star' : 'fa-regular fa-star');
        $root.find('.na_pstar').toggleClass('active', !!cur.fav);
        $root.find('.na_pdel, .na_pren').prop('disabled', cur.id === 'basic');
        $root.find('.na_prompt_reset').toggle(cur.id === 'basic' && cur.text !== BASIC_PROMPT);
        const $ta = $root.find('.na_prompt_ta');
        if ($ta.data('pid') !== cur.id) $ta.val(cur.text).data('pid', cur.id);
    };
    const pick = id => { g.activePrompt = id; saveGlobal(); renderPrompts(); render(); };
    const askName = async (title, value) => {
        const c2 = ctx();
        const v = await c2.Popup.show.input(title, '', value);
        return typeof v === 'string' ? v.trim() : '';
    };
    $root.find('.na_psel').on('change', function () { pick(this.value); });
    $root.on('click', '.na_pchip', function () { pick($(this).data('id')); });
    $root.find('.na_pstar').on('click', () => { const p = activePrompt(g); p.fav = !p.fav; saveGlobal(); renderPrompts(); });
    $root.find('.na_pnew').on('click', async () => {
        const name = await askName('새 지시문 이름', `지시문 ${g.prompts.length + 1}`);
        if (!name) return;
        const p = { id: newId(), name, text: '', fav: false };
        g.prompts.push(p); pick(p.id);
        $root.find('.na_prompt_ta').trigger('focus');
    });
    $root.find('.na_pdup').on('click', async () => {
        const src = activePrompt(g);
        const name = await askName('복제한 지시문 이름', `${src.name} 사본`);
        if (!name) return;
        const p = { id: newId(), name, text: src.text, fav: false };
        g.prompts.push(p); pick(p.id);
    });
    $root.find('.na_pren').on('click', async () => {
        const p = activePrompt(g);
        if (p.id === 'basic') return;
        const name = await askName('이름 바꾸기', p.name);
        if (!name) return;
        p.name = name; saveGlobal(); renderPrompts(); render();
    });
    $root.find('.na_pdel').on('click', async () => {
        const p = activePrompt(g);
        if (p.id === 'basic') return;
        if (!await confirm('지시문 삭제', `"${p.name}"을(를) 지울까요? 되돌릴 수 없어요.`)) return;
        g.prompts = g.prompts.filter(x => x.id !== p.id);
        pick(g.prompts[0].id);
    });
    $root.find('.na_prompt_ta').on('input', function () { activePrompt(g).text = this.value; saveGlobal(); renderPrompts(); later(); });
    $root.find('.na_prompt_reset').on('click', () => {
        const p = g.prompts.find(x => x.id === 'basic');
        p.text = BASIC_PROMPT; $root.find('.na_prompt_ta').val(p.text); saveGlobal(); renderPrompts(); render();
    });
    renderPrompts();
    const showLast = () => {
        const x = getMeta().lastExport;
        $root.find('.na_lastex').prop('hidden', !x);
        if (x) $root.find('.na_lastex_text').html(`최근 내보냄 <b>#${x.from}–#${x.to}</b> · ${esc(timeLabel(x.at))} · ${x.how === 'txt' ? '.txt 저장' : '복사'}`
            + (fromLast && x === le ? ' <span class="na_dim">→ 그 다음부터 채웠어요</span>' : ''));
    };
    const remember = async how => {
        const { from, to } = range();
        getMeta().lastExport = { from, to, at: Date.now(), how };
        await saveMeta();
        showLast();
        refreshStatus();
    };
    showLast();
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
function placeAppend(archive, add, { renumber } = {}) {
    const [eBody, eTail] = splitTail(archive);
    const [pBody, pTail] = splitTail(add);
    const sep = /\n-{3,}\s*$/.test(trimEnd(eBody));
    let body = trimEnd(eBody).replace(/\n-{3,}\s*$/, '');
    const pClean = trimEnd(pBody).replace(/\n-{3,}\s*$/, '');
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
    return { text: `${text}\n`, placed: !!eTail && !!pBody.trim(), replaced, renumbered };
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

async function openAppend() {
    const c = ctx();
    const m = getMeta();
    const last = (c.chat?.length || 0) - 1;

    const $root = $(`
      <div class="na_popup">
        <div class="na_append_head">
          <span class="na_dim">새로 압축한 섹션을 붙여넣거나 파일로 불러오세요.</span>
          <button type="button" class="na_btn na_small na_append_file_btn"><i class="fa-solid fa-file-arrow-up"></i> .txt 불러오기</button>
          <input type="file" class="na_append_file" accept=".txt,.md,text/plain" hidden>
        </div>
        <textarea class="text_pole na_append_ta" spellcheck="false" placeholder="## Y2 #574–#600 — ..."></textarea>
        <div class="na_check" hidden></div>
        <div class="na_row">
          <label>이번에 압축한 끝 번호 # <input type="number" class="text_pole na_num na_end" min="0" max="${last}" value="${Math.max(0, last)}"></label>
          <span class="na_end_hint na_dim"></span>
        </div>
        <label class="checkbox_label"><input type="checkbox" class="na_do_hide" checked><span>저장 후 숨기기 적용 (마지막 ${m.keep}개 남김)</span></label>
        <label class="checkbox_label na_renum_row"><input type="checkbox" class="na_do_renum" checked><span class="na_renum_label">제목·안내문의 끝 번호도 바꾸기</span></label>
        <div class="na_place na_dim"></div>
        <details class="na_block na_details na_ap_preview" hidden>
          <summary>추가하면 바뀌는 부분 <span class="na_chip na_chip_add na_ap_add"></span><span class="na_chip na_chip_del na_ap_del"></span></summary>
          <div><div class="na_diff na_ap_diff"></div></div>
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
    const $check = $root.find('.na_check');
    $root.find('.na_renum_row').hide();
    let lastPlan = null;
    const $pv = $root.find('.na_ap_preview');
    function renderPreview(plan) {
        lastPlan = plan;
        if (!plan || !$ta.val().trim()) { $pv.prop('hidden', true); return; }
        const rows = lineDiff(m.text, plan.text);
        const add = rows.filter(r => r.t === '+').length, del = rows.filter(r => r.t === '-').length;
        $pv.prop('hidden', false);
        $root.find('.na_ap_add').text(`+${fmt(add)}줄`);
        $root.find('.na_ap_del').text(`−${fmt(del)}줄`).toggle(!!del);
        if ($pv.prop('open')) $root.find('.na_ap_diff').html(add || del ? renderDiff(rows) : '<div class="na_empty">바뀌는 게 없어요.</div>');
        else $root.find('.na_ap_diff').empty();
    }
    $pv.on('toggle', () => renderPreview(lastPlan));
    $root.find('.na_do_renum').on('change', () => $ta.trigger('input'));
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
            const plan = placeAppend(m.text, val, { renumber: $root.find('.na_do_renum').prop('checked') });
            renderPreview(plan);
            const notes = [];
            if (plan.placed) notes.push('새 섹션은 <b>STATE 앞</b>에 들어가요');
            if (plan.replaced.length) notes.push(`<b>${plan.replaced.join('·')}</b> 블록은 붙여넣은 걸로 바뀌어요`);
            $root.find('.na_place').html(notes.join(' · '));
            $root.find('.na_renum_row').toggle(!!plan.renumbered);
            if (plan.renumbered) $root.find('.na_renum_label').html(`제목·안내문의 끝 번호도 바꾸기 (<b>#${plan.renumbered.from} → #${plan.renumbered.to}</b>)`);
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

    const plan = placeAppend(m.text, add, { renumber: $root.find('.na_do_renum').prop('checked') && $root.find('.na_renum_row').is(':visible') });
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
        ['na_wand_read', 'fa-book-open-reader', '아카이브 읽기', () => openViewer('read')],
        ['na_wand_extract', 'fa-scissors', '원문 뽑기', openExtract],
        ['na_wand_append', 'fa-file-circle-plus', '아카이브에 추가', openAppend],
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
    if (et.GENERATION_STARTED) es.on(et.GENERATION_STARTED, onGenerationStarted);
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
