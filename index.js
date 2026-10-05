// 서사 아카이브 (Narrative Archive)
// You write the archive. This extension stores it per chat, injects it,
// hides already-compressed messages, extracts raw ranges, and shows token counts.

const MODULE = 'narrative_archive';
const PROMPT_KEY = 'narrative_archive_injection';
const VERSION = '2.16.0';
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

const SETTING_KEYS = ['keep', 'enabled', 'position', 'depth', 'role', 'wrap', 'remindTok', 'muted', 'track', 'tokenCap', 'capMode', 'pinned', 'backupEvery', 'linked', 'linkDepth', 'glossary', 'logLinks', 'knowledge', 'knowInject', 'quotes', 'quoteInject', 'quoteMax'];
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
                const safe = pinned.has(sectionKey(s)) || stack.some(g => pinned.has(sectionKey(g)));
                if (!safe && RANGE_HEAD.test(s.title)) cands.push(s);
            }
            const drop = new Set();
            for (const s of cands) {
                if (total <= cap) break;
                total -= await cachedTokens(body.slice(s.start, s.end));
                drop.add(s.start);
                trimmed.push(sectionKey(s));
            }
            text = secs.filter(s => !drop.has(s.start)).map(s => body.slice(s.start, s.end)).join('');
        }
    }
    const extra = text.trim() ? extraBlocks(m) : '';
    const final = text.trim() ? wrapText(m, `${trimEnd(text)}${extra}`) : '';
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
    // how often each keyword-linked section actually went in, for the token report
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
function linkWaiting(m) {
    const entries = Object.entries(linkedMap(m)).filter(([, k]) => Array.isArray(k) && k.length);
    if (!entries.length) return new Set();
    const hay = recentChatText(m);
    return new Set(entries.filter(([, keys]) => !linkHits(keys, hay).length).map(([t]) => t));
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
    // folded groups are kept per chat, so they stay folded after a reload
    const collapsedSet = () => new Set(Array.isArray(getMeta()?.collapsed) ? getMeta().collapsed : []);
    const setCollapsed = set => { const m = getMeta(); if (!m) return; m.collapsed = [...set]; saveMeta(); };
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
        if (!await confirm('섹션 삭제', `<b>${esc(s.title)}</b><br>이 섹션을 지울까요? 지우기 전 상태는 보관 탭 복구 지점에 남아요.`)) return;
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
    const pinBtn = (on, what) => `<button type="button" class="na_icon na_icon_sm na_pin ${on ? 'on' : ''}" title="${on ? '고정 풀기' : `${what} 토큰 상한에 걸려도 안 빠지게 고정`}"><i class="fa-solid fa-thumbtack"></i></button>`;

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
                    ${s.note ? `<div class="na_group_note">${highlight(s.note, q)}</div>` : ''}
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
            shown++;
            const isOpen = !!q || openCards.has(sectionKey(s));
            const $card = $(`
              <div class="na_card ${off ? 'na_off' : ''} ${parentOff ? 'na_off_parent' : ''} ${waiting.has(sectionKey(s)) && !off ? 'na_waiting' : ''} ${trimmedSet.has(sectionKey(s)) && !off ? 'na_trimmed' : ''}" data-start="${s.start}">
                <div class="na_card_head">
                  <div class="na_head_main">
                  <span class="na_card_title">${highlight(s.title, q)}</span>
                  <span class="na_card_meta">${links[sectionKey(s)]?.length && !off ? `<span class="na_link_tag ${waiting.has(sectionKey(s)) ? '' : 'on'}" title="키워드: ${esc(links[sectionKey(s)].join(', '))}"><i class="fa-solid fa-key"></i> ${waiting.has(sectionKey(s)) ? '대기' : '켜짐'}</span>` : ''}${trimmedSet.has(sectionKey(s)) && !off ? '<span class="na_trim_tag">상한으로 빠짐</span>' : ''}${count ? `<span class="na_hit">${count}건</span>` : ''}<span class="na_tok">${fmt(body.length)}자</span></span>
                  </div>
                  <div class="na_head_ctrl">
                  ${pinBtn(pinned.has(sectionKey(s)), '이 섹션을')}
                  ${sw(!off, off ? '주입 켜기' : '이 섹션만 주입에서 빼기 (본문은 그대로)')}
                  </div>
                </div>
                <div class="na_card_body" ${isOpen ? '' : 'hidden'}>
                  <div class="na_card_text">${highlight(body.replace(/^#{1,2} [^\n]*\n?/, '').trim(), q) || '<span class="na_dim">(비어 있음)</span>'}</div>
                  <div class="na_card_actions">
                    <button type="button" class="na_icon na_up" title="위로"><i class="fa-solid fa-arrow-up"></i></button>
                    <button type="button" class="na_icon na_down" title="아래로"><i class="fa-solid fa-arrow-down"></i></button>
                    <button type="button" class="na_icon na_ins" title="아래에 새 섹션"><i class="fa-solid fa-plus"></i></button>
                    <span class="na_act_sep"></span>
                    <button type="button" class="na_icon na_keys ${links[sectionKey(s)]?.length ? 'active' : ''}" title="키워드 연동"><i class="fa-solid fa-key"></i></button>
                    <button type="button" class="na_icon na_towi" title="월드인포로 보내기"><i class="fa-solid fa-book-atlas"></i></button>
                    <button type="button" class="na_icon na_edit" title="편집"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" class="na_icon na_del na_danger" title="섹션 삭제"><i class="fa-solid fa-trash-can"></i></button>
                    <span class="na_spacer"></span>
                    ${srcButton(m, s.title, 'icon')}
                  </div>
                </div>
              </div>`);
            $card.find('.na_card_head').on('click', () => {
                const $b = $card.children('.na_card_body');
                const willOpen = $b.prop('hidden');
                $b.prop('hidden', !willOpen);
                willOpen ? openCards.add(sectionKey(s)) : openCards.delete(sectionKey(s));
            });
            $card.find('.na_card_head .na_sw').on('click', e => { e.stopPropagation(); setMuted(sectionKey(s), !off); });
            $card.find('.na_card_head .na_pin').on('click', e => { e.stopPropagation(); setPinned(sectionKey(s), !pinned.has(sectionKey(s))); });
            $card.find('.na_edit').on('click', e => { e.stopPropagation(); editSection($card, s); });
            $card.find('.na_up').on('click', () => move(s, -1));
            $card.find('.na_down').on('click', () => move(s, 1));
            $card.find('.na_ins').on('click', () => insertAfter(s));
            $card.find('.na_keys').on('click', async () => {
                const keys = await openKeywords(s, body, links[sectionKey(s)] || []);
                if (keys) await setLinked(sectionKey(s), keys);
            });
            $card.find('.na_towi').on('click', () => openSendToWI(s));
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
              </div>
              <div class="na_meter_bar"><span class="na_seg_arc"></span><span class="na_seg_raw"></span></div>
              <div class="na_meter_legend" id="na_meter_legend"></div>
              <div class="na_meter_tools">
                <button type="button" class="na_linkbtn" id="na_health"><i class="fa-solid fa-stethoscope"></i> <span>건강 점검</span></button>
                <button type="button" class="na_linkbtn" id="na_report"><i class="fa-solid fa-chart-column"></i> 토큰 리포트</button>
                <button type="button" class="na_linkbtn" id="na_branches"><i class="fa-solid fa-code-branch"></i> <span>분기</span></button>
              </div>
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
                  <button type="button" class="na_icon" id="na_ed_find" title="찾기"><i class="fa-solid fa-magnifying-glass"></i></button>
                  <button type="button" class="na_icon" id="na_ed_copy" title="전체 복사"><i class="fa-regular fa-copy"></i></button>
                  <button type="button" class="na_icon" id="na_ed_ask" title="아카이브에 질문 (AI)"><i class="fa-regular fa-comments"></i></button>
                  <button type="button" class="na_icon" id="na_ed_big" title="읽기 모드"><i class="fa-solid fa-book-open-reader"></i></button>
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
              <div class="na_block">
                <div class="na_block_head"><div><h4>AI 도구</h4><p>아카이브를 바탕으로 대화를 점검하고, 이야기를 정리해 같이 주입할 수 있어요.</p></div></div>
                <div class="na_tiles">
                  <button type="button" class="na_tile" id="na_drift"><i class="fa-solid fa-route"></i><span>이탈 감지</span><small id="na_drift_sub">최근 대화가 아카이브와 어긋나는지</small></button>
                  <button type="button" class="na_tile" id="na_know"><i class="fa-solid fa-user-secret"></i><span>누가 아는가</span><small id="na_know_sub">비밀마다 아는 사람·모르는 사람</small></button>
                  <button type="button" class="na_tile" id="na_quotes"><i class="fa-solid fa-quote-left"></i><span>대사 은행</span><small id="na_quotes_sub">말투 샘플로 주입</small></button>
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
                </div>
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
                  <button type="button" class="na_step" id="na_open_extract"><b>1</b><span><strong>원문 뽑기</strong><small>경계선 이후 메시지 · 지시문 붙여 복사</small></span><i class="fa-solid fa-chevron-right"></i></button>
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
                  <div class="na_set_row"><span><span>키워드 테스트</span><small>문장을 넣어 보면 어떤 섹션이 불려 오는지 보여 줘요</small></span><button type="button" class="na_btn na_small" id="na_kw_test"><i class="fa-solid fa-vial"></i> 테스트</button></div>
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
              <div class="na_block">
                <div class="na_block_head"><div><h4>AI 기능</h4><p>아카이브에 질문 · 키워드 제안 · 충돌 검사에 쓰는 모델이에요. AI는 답하고 검사만 하고, 아카이브는 직접 고쳐요.</p></div></div>
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
                  <label class="na_set_row"><span><span>이탈 자동 감지</span><small>AI 답이 이만큼 쌓일 때마다 조용히 검사하고, 어긋나면 알려 줘요 · 그때마다 토큰이 들어가요</small></span>
                    <select id="na_drift_auto" class="text_pole"><option value="0">끄기</option><option value="5">답 5개마다</option><option value="10">답 10개마다</option><option value="20">답 20개마다</option></select></label>
                  <div class="na_set_row"><span><span>번역 용어집</span><small>이름·장소의 한국어 표기를 정해 두면 번역이 늘 그대로 써요 · 이 채팅 <b id="na_gloss_n">0</b>개</small></span><button type="button" class="na_btn na_small" id="na_gloss_edit"><i class="fa-solid fa-spell-check"></i> 편집</button></div>
                </div>
                <small class="na_dim na_conn_note" id="na_conn_note" hidden>키와 JSON은 이 기기의 실리태번 설정에만 저장돼요. 아카이브 백업에는 안 들어가요.</small>
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
    const own = [renderConn('ai'), renderConn('tr')].some(Boolean);
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

function bindPanel() {
    const $p = $('#na_settings');

    $p.find('.na_nav_btn').on('click', function () {
        const tab = $(this).data('tab');
        $p.find('.na_nav_btn').removeClass('active');
        $(this).addClass('active');
        $p.find('.na_tab_pane').each(function () { $(this).prop('hidden', $(this).data('pane') !== tab); });
        if (tab === 'config') renderAiSettings();
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
    for (const p of ['ai', 'tr']) {
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
    $('#na_health').on('click', needChat(openHealth));
    $('#na_report').on('click', needChat(openTokenReport));
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
        if (editorDirty) return toastr.warning('개요 탭 편집칸에 저장 안 한 내용이 있어요. 먼저 저장하거나 되돌려 주세요.');
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
    $('#na_all_archives').on('click', needChat(openAllArchives));
    $('#na_compare').on('click', needChat(openCompare));
    $('#na_carry_go').on('click', needChat(async () => { if (carryOffer) await importArchive(carryOffer, '방금 있던 채팅', carryOffer.chatId); }));
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
    $('#na_kw_test').on('click', needChat(openKeywordTest));
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
    $('#na_hist_n').text(m.history.length);
    $('#na_cap').val(m.tokenCap || 0);
    $('#na_capmode').val(m.capMode === 'trim' ? 'trim' : 'warn');
    $('#na_capmode_row').toggleClass('na_disabled', !(m.tokenCap > 0));
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
        const kn = knowledgeRows(mm).length, qn = (mm.quotes || []).filter(q => q.on).length;
        $('#na_know_sub').text(kn ? `${kn}개${mm.knowInject ? ' · 주입 중' : ''}` : '비밀마다 아는 사람·모르는 사람');
        $('#na_quotes_sub').text((mm.quotes || []).length ? `${(mm.quotes || []).length}개 · 고른 ${qn}개${mm.quoteInject ? ' · 주입 중' : ''}` : '말투 샘플로 주입');
        $('#na_drift_sub').text(mm.driftLast ? `${timeLabel(mm.driftLast.at)} · ${mm.driftLast.none ? '어긋남 없음' : `${mm.driftLast.n}개 찾음`}` : '최근 대화가 아카이브와 어긋나는지');
    }
    const br = hasChat() ? branchState(getMeta()) : null;
    $('#na_branch_card').prop('hidden', !br?.ahead.length);
    if (br?.ahead.length) $('#na_branch_desc').text(`이 채팅은 #${br.last}까지인데 아카이브에 그 뒤(#${br.ahead[0].from}~) 섹션 ${br.ahead.length}개가 있어요. 분기하기 전 원본의 내용이에요.`);
    $('#na_branches span').text(br?.parent ? '분기 · 원본 있음' : '분기');
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

const AI_SYS_TRANSLATE = `You translate lines of a story archive into natural Korean.
- You get numbered lines. Reply with exactly one line per input line, as "N: translation", same numbers, same order, nothing else.
- Lines may be fragments, headings or list items. Keep markdown marks (#, -, **, _), "#number" references and quotation marks as they are.
- Write character and place names in Korean script. Keep words the archive deliberately leaves untranslated (coined terms, titles in another language) as they are.
- A line marked (OLD) followed by one marked (NEW) are two versions of the same line. Translate both, and in NEW reuse OLD's Korean word for word wherever the English is the same; change only the parts whose English differs. Do not repeat the (OLD)/(NEW) marks.
- Translate every line in full, never shortened, and keep each translation on one line.`;

// ---- own connections: an OpenAI-compatible URL, or Vertex AI with a service account.
// 'ai' is the AI 기능 model (mode 'st' = SillyTavern's connection or a profile); 'tr' is the translation model (mode 'same' = follow 'ai').

function connSettings(which) {
    const g = globalSettings();
    const k = which === 'tr' ? 'tr' : 'aiConn';
    g[k] ||= {};
    const t = g[k];
    t.mode ??= which === 'tr' ? 'same' : 'st';
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
    if (!endpoint || !model) throw new Error('커스텀 API의 URL과 모델 이름을 넣어 주세요 (설정 → AI 기능)');
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

const AI_SYS_GLOSSARY = `You fix the Korean spelling of names and terms for a story archive, so every translation writes them the same way.
You get English names or terms, each with a short context. Reply with one line per input, in the same order, as "English = 한국어", nothing else.
- Use the established Korean spelling when one exists (mythology, history, places). Otherwise transliterate naturally.
- Translate titles and ordinary nouns into natural Korean; keep coined words as a transliteration.`;

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
    if (m.text.trim()) {
        const h = await healthChecks(m, { build, afterTok, after });
        const n = h.items.filter(x => x.level !== 'ok').length;
        $('#na_health').toggleClass('na_health_warn', h.score < 80).find('span').text(`건강 ${h.score}점${n ? ` · 확인할 것 ${n}개` : ''}`);
    } else $('#na_health span').text('건강 점검');

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
        const newTitle = (anchor.match(/^#{1,2} (.*)$/m) || [])[1]?.trim();
        const trail = raw.match(/\s*$/)[0] || '\n\n';
        const next = cur.text.slice(0, s.start) + anchor + trail + cur.text.slice(s.end);
        const nk = newTitle && newTitle !== s.title ? keyAt(next, s.start) : null;
        if (nk) renameKeys(cur, sectionKey(s), nk);
        await commitText(next, `WI로 보내기 전: ${s.title.slice(0, 40)}`);
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

function renderReading(m, { show } = {}) {
    const muted = mutedSet(m);
    const waiting = linkWaiting(m);
    const trimmed = new Set(m.capMode === 'trim' ? lastBuild.trimmed : []);
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
        if (!linked.length) return $root.find('.na_kwt_out').html('<div class="na_empty">키워드 연동한 섹션이 없어요. 섹션 탭에서 카드를 펼쳐 🔑를 눌러 키워드를 정하세요.</div>');
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

function extraBlocks(m) {
    let out = '';
    const kr = m.knowInject ? knowledgeRows(m) : [];
    if (kr.length) out += `\n\n# WHO KNOWS WHAT\n_Characters act only on what they know. Do not let anyone reveal or use a fact they do not know._\n${kr.map(r =>
        `- ${r.fact} — knows: ${r.knows.join(', ') || 'no one'}${r.unaware.length ? `; does not know: ${r.unaware.join(', ')}` : ''}${r.suspects.length ? `; suspects: ${r.suspects.join(', ')}` : ''}`).join('\n')}`;
    const qs = m.quoteInject ? pickedQuotes(m) : [];
    if (qs.length) out += `\n\n# VOICE SAMPLES\n_How each character talks. Match the voice; do not repeat these lines verbatim._\n${qs.map(q => `${q.who}: "${q.text}"`).join('\n')}`;
    return out;
}

// ---------------------------------------------------------------- drift: does the recent chat contradict the archive?

const AI_SYS_DRIFT = `You check an ongoing role-play for continuity drift against its archive. The archive is the established canon; the recent chat is what the role-play model has been writing.
Report only clear problems in the RECENT CHAT:
- facts that contradict the archive (names, relationships, injuries, objects, places, who did what)
- threads the archive marks as resolved being reopened, or settled decisions being undone without cause
- a character knowing or using something they cannot know yet (see WHO KNOWS WHAT if given)
- timeline or time-of-day going backwards; a character in two places at once
- a character acting or talking clearly against how the archive describes them
Do not report style, pacing or things the archive simply does not cover. New events are not drift.
Answer in Korean, one bullet per problem: "- #메시지번호 이름: 무엇이 어긋나는지 — 근거 [[아카이브 섹션 제목 그대로]]". If there is nothing, answer exactly: 없음`;

function recentForCheck(n) {
    const chat = ctx().chat || [];
    const out = [];
    for (let i = chat.length - 1; i >= 0 && out.length < n; i--) {
        const x = chat[i];
        if (!x || (x.is_system && !x.is_user && !x.name)) continue;
        out.unshift(`[#${i}] ${x.name || (x.is_user ? 'User' : 'Char')}: ${cleanMessage(String(x.mes || ''), { stripTags: true })}`);
    }
    return out;
}

async function runDrift(m, n) {
    const recent = recentForCheck(n);
    if (!recent.length) throw new Error('검사할 메시지가 없어요');
    const kr = knowledgeRows(m);
    const prompt = `[ARCHIVE]\n${m.text}${kr.length ? `\n\n[WHO KNOWS WHAT]\n${extraBlocks({ ...m, knowInject: true, quoteInject: false }).trim()}` : ''}\n\n[RECENT CHAT]\n${recent.join('\n\n')}`;
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

async function openDrift() {
    const c = ctx();
    const m = getMeta();
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div><h4>이탈 감지</h4><p>최근 대화를 아카이브와 대조해서, RP 모델이 이미 정해진 사실과 어긋나게 쓴 곳을 찾아요. 참고용이고 아무것도 바꾸지 않아요.</p></div></div>
        <div class="na_row">
          <label>최근 메시지 <input type="number" class="text_pole na_num na_dr_n" min="2" max="60" value="12"> 개</label>
          <button type="button" class="na_btn na_small na_primary na_dr_go"><i class="fa-solid fa-route"></i> 검사</button>
        </div>
        <small class="na_dim na_dr_info"></small>
        <div class="na_ai_box na_dr_out" hidden></div>
      </div>`);
    const show = d => {
        if (!d) return;
        $root.find('.na_dr_out').prop('hidden', false).toggleClass('na_ai_ok', d.none)
            .html(d.none ? '<i class="fa-solid fa-circle-check"></i> 어긋난 곳이 없어요' : `<div class="na_ai_box_head"><i class="fa-solid fa-route"></i> ${esc(timeLabel(d.at))} · #${d.upto}까지 ${d.count}개 검사 <span class="na_dim">· 참고용</span></div>${driftHtml(d.text, m)}`);
    };
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

const AI_SYS_KNOW = `You build a "who knows what" table for a role-play story archive, so the role-play model never lets a character know something they should not.
List the facts whose knowledge differs between characters: secrets, hidden pasts, lies told, confessions, plans, things one character saw alone, misunderstandings. Skip facts every character knows.
For each fact name who knows it, who does not, and who only suspects, using the archive's own character names. Use the latest state in the archive (a secret later revealed is known).
10 to 30 facts, most plot-relevant first. One line per fact, nothing else, in this exact form (English):
fact in one short sentence | knows: A, B | unaware: C | suspects: D | src: the archive heading where this is established, copied exactly
Write "none" for an empty field.`;

async function openKnowledge() {
    const c = ctx();
    const m = getMeta();
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div><h4>누가 아는가</h4><p>비밀·사실마다 누가 알고 누가 모르는지 정리해요. 주입을 켜면 RP 모델이 모르는 걸 아는 척하지 않게 같이 보내요.</p></div></div>
        <div class="na_row na_kn_bar">
          <button type="button" class="na_btn na_small na_kn_ai"><i class="fa-solid fa-wand-magic-sparkles"></i> <span>AI로 만들기</span></button>
          <button type="button" class="na_btn na_small na_kn_edit"><i class="fa-solid fa-pen"></i> 직접 고치기</button>
          <button type="button" class="na_btn na_small na_kn_tr"><i class="fa-solid fa-language"></i> 한국어로 보기</button>
          <label class="checkbox_label na_kn_inject"><input type="checkbox"><span>주입하기</span></label>
          <small class="na_dim na_kn_tok"></small>
        </div>
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
        $root.find('.na_kn_ai span').text(rows.length ? 'AI로 다시 만들기' : 'AI로 만들기');
        $root.find('.na_kn_inject input').prop('checked', !!m.knowInject);
        $root.find('.na_kn_list').html(rows.length ? rows.map((r, i) => {
            const s = r.src ? findCited(secs(), r.src) : null;
            const chips = (xs, cls) => xs.map(x => `<span class="na_kn_who ${cls}">${esc(x)}</span>`).join('');
            return `<div class="na_kn_row">
              <div class="na_kn_fact">${esc(r.fact)}${tr?.[i] ? `<div class="na_kn_tr">${esc(tr[i])}</div>` : ''}</div>
              <div class="na_kn_people">${chips(r.knows, 'k')}${chips(r.suspects, 's')}${chips(r.unaware, 'u')}</div>
              ${s ? `<button type="button" class="na_cite" data-start="${s.start}" title="${esc(s.title)}"><i class="fa-solid fa-bookmark"></i> ${esc((s.title.match(/^(?:\S+\s+)?#\d+\s*[–—~-]\s*#?\d+/) || [s.title.slice(0, 24)])[0])}</button>` : ''}
            </div>`;
        }).join('') + '<div class="na_kn_legend na_dim"><span class="na_kn_who k">앎</span><span class="na_kn_who s">짐작</span><span class="na_kn_who u">모름</span></div>'
            : '<div class="na_empty">아직 없어요. AI로 만들거나 직접 적어 주세요.</div>');
        const blk = extraBlocks({ ...m, knowInject: true, quoteInject: false });
        if (blk) countTokens(blk).then(t => $root.find('.na_kn_tok').text(`약 ${fmt(t)} 토큰`)); else $root.find('.na_kn_tok').text('');
    };
    render();
    const save = async () => { await saveMeta(); applyInjection(); syncPanel(); render(); };
    $root.find('.na_kn_inject input').on('change', async function () { m.knowInject = this.checked; await save(); });
    $root.find('.na_kn_ai').on('click', async function () {
        if (knowledgeRows(m).length && !await confirm('다시 만들기', '지금 표를 AI가 새로 만든 걸로 바꿀까요?')) return;
        const old = String(m.knowledge || '').trim();
        const out = await withSpinner($(this), '정리하는 중…', () => askAI(`[ARCHIVE]\n${m.text}${old ? `\n\n[CURRENT TABLE — keep what is still right, fix what changed]\n${old}` : ''}`, { system: AI_SYS_KNOW, maxTokens: 4000 }));
        if (out === null) return;
        const lines = out.split('\n').map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(l => l.includes('|') && /knows:/i.test(l));
        if (!lines.length) return toastr.warning('AI 답을 표로 못 읽었어요. 다시 해 보세요.');
        m.knowledge = lines.join('\n'); tr = null;
        await save();
        toastr.success(`${lines.length}개 정리했어요. 틀린 건 직접 고쳐 주세요.`);
    });
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

function pickedQuotes(m) {
    const max = Math.max(1, Number(m.quoteMax) || 3);
    const per = new Map();
    return (m.quotes || []).filter(q => q.on && q.who && q.who !== '?').filter(q => { const n = (per.get(q.who) || 0) + 1; per.set(q.who, n); return n <= max; });
}

const AI_SYS_QUOTES = `You pick voice samples for a role-play: the lines that best show how each character talks (rhythm, word choice, attitude), not the most dramatic plot lines.
You get numbered quotes from a story archive, each with a guessed speaker that may be wrong. Fix the speaker using the context when needed.
For each main character pick up to 5 of their most characteristic lines. Skip lines that only make sense with heavy plot context.
One line per pick, nothing else: number | speaker`;

async function openQuotes() {
    const c = ctx();
    const m = getMeta();
    m.quotes = Array.isArray(m.quotes) ? m.quotes : [];
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div><h4>대사 은행</h4><p>아카이브에 남은 대사를 인물별로 모아요. 고른 대사를 "말투 샘플"로 같이 주입하면 RP 모델이 캐릭터 말투를 덜 잃어요.</p></div></div>
        <div class="na_row na_qb_bar">
          <button type="button" class="na_btn na_small na_qb_find"><i class="fa-solid fa-magnifying-glass"></i> 아카이브에서 모으기</button>
          <button type="button" class="na_btn na_small na_qb_ai"><i class="fa-solid fa-wand-magic-sparkles"></i> AI로 고르기</button>
          <label class="checkbox_label"><input type="checkbox" class="na_qb_inject"><span>주입하기</span></label>
          <label>인물마다 <input type="number" class="text_pole na_num na_qb_max" min="1" max="10"> 개</label>
          <small class="na_dim na_qb_tok"></small>
        </div>
        <input type="search" class="text_pole na_qb_q" placeholder="인물·대사로 찾기">
        <div class="na_qb_list"></div>
      </div>`);
    $root.find('.na_qb_inject').prop('checked', !!m.quoteInject);
    $root.find('.na_qb_max').val(m.quoteMax || 3);
    const render = () => {
        const q = $root.find('.na_qb_q').val().trim().toLowerCase();
        const by = new Map();
        m.quotes.forEach((x, i) => { if (q && !`${x.who} ${x.text}`.toLowerCase().includes(q)) return; if (!by.has(x.who)) by.set(x.who, []); by.get(x.who).push({ x, i }); });
        const picked = new Set(pickedQuotes(m));
        $root.find('.na_qb_list').html(m.quotes.length ? [...by].sort((a, b) => (a[0] === '?') - (b[0] === '?') || b[1].length - a[1].length).map(([who, xs]) => `
          <div class="na_qb_group"><div class="na_qb_who">${esc(who === '?' ? '말한 사람 모름' : who)} <span class="na_dim">${xs.length}개 · 고른 ${xs.filter(y => y.x.on).length}</span></div>
            ${xs.map(({ x, i }) => `<div class="na_qb_row ${x.on ? 'on' : ''} ${x.on && !picked.has(x) ? 'over' : ''}" data-i="${i}">
              <input type="checkbox" class="na_qb_on" ${x.on ? 'checked' : ''}>
              <div class="na_qb_text">“${esc(x.text)}”<div class="na_dim na_qb_src">${esc(String(x.src || '').slice(0, 50))}</div></div>
              <input type="text" class="text_pole na_qb_whoin" value="${esc(x.who)}" title="말한 사람">
              <button type="button" class="na_icon na_icon_sm na_qb_del" title="빼기"><i class="fa-solid fa-xmark"></i></button>
            </div>`).join('')}</div>`).join('') : '<div class="na_empty">아직 없어요. "아카이브에서 모으기"를 눌러 보세요.</div>');
        const blk = extraBlocks({ ...m, knowInject: false, quoteInject: true });
        if (blk) countTokens(blk).then(t => $root.find('.na_qb_tok').text(`주입하면 약 ${fmt(t)} 토큰`)); else $root.find('.na_qb_tok').text('');
    };
    render();
    const save = async () => { await saveMeta(); applyInjection(); syncPanel(); render(); };
    $root.find('.na_qb_q').on('input', render);
    $root.find('.na_qb_inject').on('change', async function () { m.quoteInject = this.checked; await save(); });
    $root.find('.na_qb_max').on('change', async function () { m.quoteMax = Math.min(10, Math.max(1, parseInt(this.value, 10) || 3)); this.value = m.quoteMax; await save(); });
    $root.on('change', '.na_qb_on', async function () { m.quotes[Number($(this).closest('.na_qb_row').data('i'))].on = this.checked; await save(); });
    $root.on('change', '.na_qb_whoin', async function () { m.quotes[Number($(this).closest('.na_qb_row').data('i'))].who = this.value.trim() || '?'; await save(); });
    $root.on('click', '.na_qb_del', async function () { m.quotes.splice(Number($(this).closest('.na_qb_row').data('i')), 1); await save(); });
    $root.find('.na_qb_find').on('click', async () => {
        const have = new Set(m.quotes.map(q => q.text));
        const found = archiveQuotes(m).filter(q => !have.has(q.text));
        if (!found.length) return toastr.info('새로 모을 대사가 없어요.');
        m.quotes.push(...found.map(q => ({ ...q, on: false })));
        await save();
        toastr.success(`${found.length}개 모았어요. 고르거나 "AI로 고르기"를 눌러 보세요.`);
    });
    $root.find('.na_qb_ai').on('click', async function () {
        if (!m.quotes.length) { $root.find('.na_qb_find').trigger('click'); if (!m.quotes.length) return; }
        const list = m.quotes.map((q, i) => `${i + 1}. [${q.who}] "${q.text}" (${q.src})`).join('\n');
        const out = await withSpinner($(this), '고르는 중…', () => askAI(list, { system: AI_SYS_QUOTES, maxTokens: 2000 }));
        if (out === null) return;
        const picks = out.split('\n').map(l => l.match(/^\s*(\d+)\s*[|:.)-]\s*(.+?)\s*$/)).filter(Boolean);
        if (!picks.length) return toastr.warning('AI 답을 못 읽었어요. 다시 해 보세요.');
        m.quotes.forEach(q => { q.on = false; });
        let n = 0;
        for (const [, num, who] of picks) { const q = m.quotes[Number(num) - 1]; if (q) { q.on = true; q.who = who.replace(/^\[|\]$/g, '').trim() || q.who; n++; } }
        await save();
        toastr.success(`${n}개 골랐어요.`);
    });
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
    if (hc.issues.length) add('warn', `제목 번호 문제 ${hc.issues.length}개`, hc.issues.slice(0, 5).map(x => `${x.title.slice(0, 40)} — ${x.msg}`).join('\n'), { label: '개요에서 보기', run: () => { $('.na_nav_btn[data-tab=overview]').trigger('click'); } });
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
    if (m.remindTok > 0 && afterTok >= m.remindTok) add('warn', `압축할 때예요 — 경계선 뒤 원문 ${fmt(afterTok)} 토큰`, `알림 기준 ${fmt(m.remindTok)}`, { label: '원문 뽑기', run: () => openExtract() });
    if (m.boundary >= 0) {
        const hideEnd = m.boundary - Math.max(0, Number(m.keep) || 0);
        const shown = chat.slice(0, Math.max(0, hideEnd + 1)).filter(x => x && !x.is_system).length;
        if (shown) add('warn', `압축한 메시지 중 ${shown}개가 아직 안 숨겨졌어요`, '아카이브와 원문이 같이 들어가 토큰이 두 번 쓰여요.', { label: '숨기기 적용', run: () => applyHide() });
        else add('ok', '압축한 메시지는 다 숨겨져 있어요');
    }

    // token cap
    if (build.over) add('bad', `토큰 상한 ${fmt(build.cap)}을 넘었어요 (${fmt(build.tokens)})`, m.capMode === 'trim' ? '고정한 섹션이 너무 많아 다 못 뺐어요.' : '"오래된 섹션부터 빼기"를 켜거나 섹션을 꺼 주세요.');
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

async function openHealth() {
    const c = ctx();
    const m = getMeta();
    const $root = $(`<div class="na_popup"><div class="na_health_body"><div class="na_empty">점검하는 중…</div></div></div>`);
    const render = async () => {
        const h = await healthChecks(m);
        const icon = { bad: 'fa-circle-xmark', warn: 'fa-triangle-exclamation', info: 'fa-circle-info', ok: 'fa-circle-check' };
        $root.find('.na_health_body').html(`
          <div class="na_health_top">
            <div class="na_health_score ${h.score >= 90 ? 'good' : h.score >= 70 ? 'mid' : 'low'}">${h.score}<small>점</small></div>
            <div><b>아카이브 건강 점검</b><div class="na_dim">AI 없이 번호·숨기기·키워드·백업 등을 살펴봐요. 고칠 수 있는 건 버튼으로 바로 고쳐요.</div></div>
          </div>
          <div class="na_health_list">${h.items.map((x, i) => `
            <div class="na_health_item na_h_${x.level}">
              <i class="fa-solid ${icon[x.level]}"></i>
              <div class="na_health_main"><div>${esc(x.title)}</div>${x.detail ? `<div class="na_health_detail">${esc(x.detail).replace(/\n/g, '<br>')}</div>` : ''}</div>
              ${x.fix ? `<button type="button" class="na_btn na_small na_health_fix" data-i="${i}">${esc(x.fix.label)}</button>` : ''}
            </div>`).join('')}</div>`);
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

// ---------------------------------------------------------------- token report
// Where the injected tokens go, and which sections could cost less.

async function openTokenReport() {
    const c = ctx();
    const m = getMeta();
    const $root = $(`<div class="na_popup"><div class="na_rep_body"><div class="na_empty">계산하는 중…</div></div></div>`);
    const render = async () => {
        const build = await currentInjection();
        const secs = parseSections(m.text);
        const muted = mutedSet(m), pinned = pinnedSet(m), lm = linkedMap(m);
        const waiting = linkWaiting(m);
        const trimmed = new Set(build.trimmed);
        const st = m.linkStats || { gens: 0, on: {} };
        const kstat = keywordStats(m);
        const ranged = secs.filter(x => !x.group && RANGE_HEAD.test(x.title));
        const recent = new Set(ranged.slice(-3).map(sectionKey));
        const rows = [];
        const stack = [];
        for (const s of secs) {
            while (stack.length && stack[stack.length - 1].level >= s.level) stack.pop();
            if (s.group) { stack.push(s); continue; }
            const key = sectionKey(s);
            const groupOff = stack.some(g => muted.has(sectionKey(g)));
            const tok = await cachedTokens(m.text.slice(s.start, s.end));
            const linked = Array.isArray(lm[key]) && lm[key].length;
            // share of generations it was in: measured when we have enough, else estimated from the chat so far
            const measured = linked && st.gens >= 10 ? (st.on?.[key] || 0) / st.gens : null;
            const rate = linked ? (measured ?? kstat.fireRate(lm[key])) : 1;
            const state = muted.has(key) || groupOff ? 'off' : trimmed.has(key) ? 'trim' : linked ? 'key' : 'on';
            rows.push({ s, key, tok, linked, rate, measured: measured !== null, state, pinned: pinned.has(key), group: stack[0] ? groupLabel(stack[0].title) : '', recent: recent.has(key) });
        }
        const sum = f => rows.filter(f).reduce((a, r) => a + r.tok, 0);
        const alwaysTok = sum(r => r.state === 'on');
        const keyAvg = rows.filter(r => r.state === 'key').reduce((a, r) => a + r.tok * r.rate, 0);
        const offTok = sum(r => r.state === 'off' || r.state === 'trim');
        const maxTok = Math.max(1, ...rows.map(r => r.tok));
        // suggestions
        const tips = [];
        for (const r of rows) {
            if (r.state === 'on' && !r.pinned && !r.recent && r.tok >= 600 && RANGE_HEAD.test(r.s.title)) tips.push({ r, kind: 'link', text: `항상 켜져 ${fmt(r.tok)} 토큰 — 키워드 연동하면 평소엔 아껴요` });
            if (r.state === 'key' && r.rate >= 0.6) tips.push({ r, kind: 'key', text: `키워드 연동인데 ${pct(r.rate)} 켜져요 — 키워드가 너무 넓어요` });
            if (r.state === 'key' && r.measured && st.gens >= 30 && r.rate === 0) tips.push({ r, kind: 'key', text: `생성 ${st.gens}번 동안 한 번도 안 켜졌어요 — 키워드가 맞는지 봐 주세요` });
            if (r.tok > 2500) tips.push({ r, kind: 'big', text: `${fmt(r.tok)} 토큰 — 아주 커요. 다시 압축하거나 나누면 좋아요` });
        }
        tips.sort((a, b) => b.r.tok - a.r.tok);
        const groups = new Map();
        for (const r of rows) { const g = r.group || '(묶음 밖)'; const o = groups.get(g) || { tok: 0, live: 0 }; o.tok += r.tok; if (r.state === 'on') o.live += r.tok; else if (r.state === 'key') o.live += r.tok * r.rate; groups.set(g, o); }
        const label = { on: '항상', key: '키워드', off: '꺼짐', trim: '상한으로 빠짐' };
        $root.find('.na_rep_body').html(`
          <div class="na_block_head"><div><h4>토큰 리포트</h4><p>지금 주입 <b>${fmt(build.tokens)}</b> 토큰 · 항상 켜진 섹션 ${fmt(alwaysTok)} · 키워드 섹션은 평균 ${fmt(Math.round(keyAvg))} · 꺼졌거나 빠진 ${fmt(offTok)}${st.gens ? ` · 생성 ${fmt(st.gens)}번 기록` : ''}</p></div></div>
          <div class="na_rep_groups">${[...groups].map(([g, o]) => `<div class="na_rep_group"><b>${esc(g)}</b><span>${fmt(o.tok)} 토큰</span><small class="na_dim">평소 약 ${fmt(Math.round(o.live))}</small></div>`).join('')}</div>
          ${tips.length ? `<div class="na_kw_label">아낄 수 있는 곳 ${tips.length}개</div><div class="na_rep_tips">${tips.slice(0, 12).map((t, i) => `
            <div class="na_rep_tip"><div class="na_rep_tip_main"><b>${esc(t.r.s.title.slice(0, 60))}</b><div class="na_dim">${esc(t.text)}</div></div>
              <button type="button" class="na_btn na_small na_rep_act" data-i="${i}">${t.kind === 'big' ? '섹션 보기' : '🔑 키워드'}</button></div>`).join('')}</div>` : '<div class="na_empty">크게 아낄 곳은 없어요 👍</div>'}
          <div class="na_kw_label">섹션별 <span class="na_dim">· 큰 것부터 · 누르면 섹션으로 가요</span></div>
          <div class="na_rep_rows">${[...rows].sort((a, b) => b.tok - a.tok).map(r => `
            <div class="na_rep_row na_rep_${r.state}" data-start="${r.s.start}">
              <div class="na_rep_line"><span class="na_rep_title">${esc(r.s.title)}</span><span class="na_rep_tok">${fmt(r.tok)}</span></div>
              <div class="na_rep_bar"><span style="width:${Math.max(2, Math.round(r.tok / maxTok * 100))}%"></span></div>
              <div class="na_rep_meta">${label[r.state]}${r.state === 'key' ? ` · ${r.measured ? '' : '추정 '}${pct(r.rate)} 켜짐${waiting.has(r.key) ? ' · 지금 대기' : ' · 지금 켜짐'}` : ''}${r.pinned ? ' · 📌' : ''}${r.group ? ` · ${esc(r.group)}` : ''}</div>
            </div>`).join('')}</div>`);
        const list = tips.slice(0, 12);
        $root.find('.na_rep_act').on('click', async function () {
            const t = list[Number(this.dataset.i)];
            if (t.kind === 'big') { $root.closest('dialog').find('.popup-button-ok').trigger('click'); return gotoSection(t.r.s.start); }
            const ks = await openKeywords(t.r.s, m.text.slice(t.r.s.start, t.r.s.end), lm[t.r.key] || []);
            if (ks) { await setLinked(t.r.key, ks); await currentInjection(); render(); }
        });
        $root.find('.na_rep_row').on('click', function () {
            $root.closest('dialog').find('.popup-button-ok').trigger('click');
            gotoSection(Number(this.dataset.start));
        });
    };
    render();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
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
        if (!p) throw new Error('고른 연결 프로필을 찾을 수 없어요. 설정 탭 → AI 기능에서 다시 골라 주세요.');
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


const AI_SYS_ASK = `You answer questions about an ongoing story using ONLY the archive the user gives you.
- If the archive does not say, reply that it is not in the archive. Never invent.
- After each claim, cite the section you used by copying its heading line exactly inside double brackets, e.g. [[## Y2 #48–#63 — The night ridge]].
- Always answer in Korean, whatever language the archive or the question is in. Keep names as the archive spells them. Be concise.`;

const AI_SYS_KEYWORDS = `You choose trigger keywords for ONE section of a role-play story archive. The section stays out of the prompt until one of its keywords appears in the recent chat, so a keyword must show up in chat exactly when this section's events become relevant again, and rarely otherwise.
Good keywords are the section's own subject matter: the topic, event, object, place, promise, wound or secret it records (for a section about a lost map: map, treasure, island). Think about the words a character would actually say when this comes up again.
Bad keywords: main cast names; anything under BROAD TERMS; everyday words found in most scenes (bed, night, kiss, room, love, eat); very short English words that hide inside other words ("Set" fires on "settle").
Matching is a plain case-insensitive substring search over raw chat text, which may be English or Korean. So:
- English: the shortest stem that is still specific (map also matches maps; treasur matches treasure and treasury; betray matches betrayal and betrayed).
- Korean: the forms a Korean chat would really use, as stems without particles (지도, 보물, 배신), with common synonyms. No one-syllable Korean stems.
Give 4 to 8 concepts, most important first. One line per concept, nothing else, in this exact form:
english stem | korean form, korean form | why it fits, in Korean, under 25 characters`;

const AI_SYS_CONFLICT = `You are a continuity checker for a role-play story archive. Compare the NEW text with the EXISTING archive and list contradictions only:
- the same name spelled differently
- dates or times of day going backwards
- facts that contradict facts already established
- threads the archive marks as resolved that the new text reopens, or the reverse
- a character in two places at once
The new text may replace the archive's STATE / OPEN blocks; an update there is not a contradiction unless it clashes with the new sections.
Do not judge style and do not suggest additions.
Answer in Korean, one bullet per issue: "- 무엇이 어긋나는지 — 근거 (기존 아카이브의 섹션 제목)". If there is nothing, answer exactly: 없음`;

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
        const $src = $(`<div class="na_ask_src"><div class="na_ask_src_head"><b></b><button type="button" class="na_linkbtn">섹션 탭에서 보기</button></div><div class="na_ask_src_body"></div></div>`).data('start', start);
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
    $p.find('.na_nav_btn[data-tab="sections"]').trigger('click');
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
    const defaults = { usePrompt: false, skipHidden: true, nameStyle: 'full', stripTags: false, aiProfile: '', aiMaxTokens: 8192 };
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

async function openAppend() {
    const c = ctx();
    const m = getMeta();
    const last = (c.chat?.length || 0) - 1;

    const $root = $(`
      <div class="na_popup">
        <div class="na_append_head">
          <span class="na_dim">새로 압축한 섹션을 붙여넣거나 파일로 불러오세요.</span>
          <span class="na_row_btns">
            <button type="button" class="na_btn na_small na_append_file_btn"><i class="fa-solid fa-file-arrow-up"></i> .txt 불러오기</button>
          </span>
          <input type="file" class="na_append_file" accept=".txt,.md,text/plain" hidden>
        </div>
        <textarea class="text_pole na_append_ta" spellcheck="false" placeholder="## Y2 #574–#600 — ..."></textarea>
        <div class="na_check na_numcheck" hidden></div>
        <div class="na_check na_check_warn na_cut" hidden></div>
        <div class="na_check na_whole" hidden><i class="fa-solid fa-file-circle-check"></i><div>
          <b>아카이브 전체본 같아요</b> — 이미 있는 섹션이 거의 다 들어 있어요. 새 섹션만 붙이려면 그대로 <b>추가</b>, 이 내용으로 아카이브를 바꾸려면:
          <div class="na_whole_row"><button type="button" class="na_btn na_small na_whole_btn"><i class="fa-solid fa-right-left"></i> 통째로 바꾸기</button></div>
        </div></div>
        <div class="na_check na_check_warn na_rw" hidden></div>
        <div class="na_check na_check_soft na_names" hidden></div>
        <div class="na_ai_row">
          <button type="button" class="na_btn na_small na_ai_conflict"><i class="fa-solid fa-wand-magic-sparkles"></i> AI로 충돌 검사</button>
          <small class="na_dim">기존 아카이브와 어긋나는 이름·날짜·사실을 찾아요</small>
        </div>
        <div class="na_ai_box na_conflict_out" hidden></div>
        <div class="na_row">
          <label>이번에 압축한 끝 번호 # <input type="number" class="text_pole na_num na_end" min="0" max="${last}" value="${Math.max(0, last)}"></label>
          <span class="na_end_hint na_dim"></span>
        </div>
        <label class="checkbox_label"><input type="checkbox" class="na_do_hide" checked><span>저장 후 숨기기 적용 (마지막 ${m.keep}개 남김)</span></label>
        <label class="checkbox_label na_renum_row"><input type="checkbox" class="na_do_renum" checked><span class="na_renum_label">제목·안내문의 끝 번호도 바꾸기</span></label>
        <div class="na_place na_dim"></div>
        <details class="na_block na_details na_ap_preview" hidden>
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
