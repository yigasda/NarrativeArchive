// 캐릭터 휴대폰: cleaning what a model sends back (text cut short, times in one shape, numbers read loosely).
// No other imports, so the pure sync modules and the tests can use it alone.
// text from a model's answer: an object or list where text belongs is no text (never "[object Object]")
export const str = (v, n) => (v !== null && typeof v === 'object' ? '' : String(v ?? '')).replace(/[ \t]+/g, ' ').trim().slice(0, n);
export const line = (v, n) => str(v, n).replace(/\s*\n\s*/g, ' ');
export const pad = x => String(x).padStart(2, '0');
// a date written with its month's name or 월: "1월 20일 15:00", "Jan 20", "January 20, 2027", "20. Januar" (the clock after it, if any)
const MONS = { jan: 1, feb: 2, mar: 3, mär: 3, apr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dez: 12 };
// the whole word must be a month's name or the start of one ("Mar", "March", "März"; not "Mara", "Marco")
const FULL = ['january', 'february', 'march', 'märz', 'april', 'may', 'mai', 'june', 'juni', 'july', 'juli', 'august', 'september', 'sept', 'october', 'oktober', 'november', 'december', 'dezember'];
const month = w => { const s = String(w || '').toLowerCase(); return s.length >= 3 && FULL.some(f => f.startsWith(s)) ? MONS[s.slice(0, 3)] || 0 : 0; };
const named = v => {
    const s = String(v || ''), ko = s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/), en = s.match(/\b([a-zä]{3,9})\.?\s+(\d{1,2})(?![\d:])/i), de = s.match(/(?<!\d)(\d{1,2})\.?\s+([a-zä]{3,9})\b/i);
    const [mo, d] = ko ? [Number(ko[1]), Number(ko[2])] : en && month(en[1]) ? [month(en[1]), Number(en[2])] : de && month(de[2]) ? [month(de[2]), Number(de[1])] : [0, 0];
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return '';
    const hm = s.match(/(\d{1,2}):(\d{2})/), ok = hm && Number(hm[1]) < 24 && Number(hm[2]) < 60;
    return `${pad(mo)}-${pad(d)}${ok ? ` ${pad(hm[1])}:${hm[2]}` : ''}`;
};
// an answer cut off before its JSON ends (the model ran out of room): a bracket still open, or a string, at the end
export const cutShort = out => {
    const t = String(out || '').replace(/```(?:json)?/gi, ''), a = t.indexOf('{');
    if (a < 0) return false;
    let d = 0, str = false, esc = false;
    for (const ch of t.slice(a)) {
        if (str) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') str = false; continue; }
        if (ch === '"') str = true; else if (ch === '{' || ch === '[') d++; else if (ch === '}' || ch === ']') d = Math.max(0, d - 1);
    }
    return str || d > 0;
};
// the order a chat's status lines write a date in when both numbers could be the month ("03.11."): month first unless
// the user said day first (상태창 날짜 순서, kept per chat). Only for dates written with "." or "/": "MM-DD" with dashes is
// always month first (the phone's own and the model's answers)
let orderOf = () => '', held = null;
export const dateOrderSource = f => { orderOf = f; };
export const dayFirstChat = () => { try { return (held ?? orderOf()) === 'dm'; } catch { return false; } };
// one 폰 만들기 or 반영 reads every date by the order it started with (the setting changed meanwhile counts from the next)
export async function withDateOrder(order, fn) { const was = held; held = order; try { return await fn(); } finally { held = was; } }
export const swapDate = (a, b, sep) => Number(b) <= 12 && (Number(a) > 12 || sep !== '-' && Number(a) <= 31 && dayFirstChat());
export const when = v => {
    // "10-25 21:00", or with the year in front ("2026-10-25 21:00", "2026/10/25T21:00") or after ("25.10.2026 21:00", "10/25/2026 9:00")
    const mt = String(v || '').match(/(?:^|\D)(?:\d{4}[-/.])?(\d{1,2})[-/.](\d{1,2})(?:[-/.]\s?\d{4})?(?:\.?,?[ T]+(\d{1,2}):(\d{2}))?/);
    // the day first where the month can't come first ("26.10.", "26/10/2026"), unless a year led ("2026-10-26")
    // and when the chat writes day first (its 상태창 날짜 순서), any date of two numbers with dots or slashes
    if (mt && !/^\d{4}/.test(mt[0].replace(/^\D/, '')) && swapDate(mt[1], mt[2], (/\d{1,2}([-/.])\d/.exec(mt[0]) || [])[1])) [mt[1], mt[2]] = [mt[2], mt[1]];
    if (!mt || !(Number(mt[1]) >= 1 && Number(mt[1]) <= 12) || !(Number(mt[2]) >= 1 && Number(mt[2]) <= 31)) return named(String(v || '').replace(/(\d)(?:st|nd|rd|th)\b/gi, '$1'));
    // a clock that can't be ("25:99") is dropped, the day stays
    const ok = mt[3] && Number(mt[3]) < 24 && Number(mt[4]) < 60;
    return `${pad(mt[1])}-${pad(mt[2])}${ok ? ` ${pad(mt[3])}:${mt[4]}` : ''}`;
};
// "HH:MM", and the ways a model or a status line may write a clock: "7:00 PM", "오후 7:00", "7pm", "19시", "19시 30분"
export const hhmm = v => {
    const s = String(v || ''), mt = s.match(/(\d{1,2})\s*:\s*(\d{2})/) || s.match(/(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/) || s.match(/(\d{1,2})\s*(?=[ap]\.?m\b)/i);
    if (!mt) return '';
    let h = Number(mt[1]);
    const m = Number(mt[2] || 0), pm = /(?<![a-z])[pP]\.?[mM]\b|오후|저녁|밤/.test(s), am = /(?<![a-z])[aA]\.?[mM]\b|오전|새벽|아침/.test(s);
    if (pm && h < 12) h += 12; else if (am && h === 12) h = 0;
    return h < 24 && m < 60 ? `${pad(h)}:${pad(m)}` : '';
};
// Dated clock spans for reflection hints: never borrow a bare hour from another line or sentence.
// Keep the exact span for the model; normalize only the separate date and clock captures.
const MONTH_WORD = [...new Set(FULL.flatMap(w => Array.from({ length: w.length - 2 }, (_, i) => w.slice(0, i + 3))))].sort((a, b) => b.length - a.length).join('|');
const CLOCK_DATE = String.raw`(?:\d{4}[-/.])?\d{1,2}[-/.]\d{1,2}(?:[-/.][ \t]?\d{4})?|(?:\d{4}년[ \t]*)?\d{1,2}[ \t]*월[ \t]*\d{1,2}[ \t]*일|(?:${MONTH_WORD})\.?[ \t]+\d{1,2}(?:st|nd|rd|th)?(?:,?[ \t]+\d{4})?|\d{1,2}(?:st|nd|rd|th)?\.?[ \t]+(?:${MONTH_WORD})\.?(?:,?[ \t]+\d{4})?`;
// Meridiem belongs to this clock on either side, never to another sentence or line.
const CLOCK_MERIDIEM = String.raw`(?:[ap](?:\.m\b\.?|m\b)|(?:오전|오후|새벽|아침|저녁|밤)(?!\p{L}))`;
const CLOCK_COLON = String.raw`\d{1,2}[ \t]*:[ \t]*\d{2}`;
// Require both units: 시 alone is not enough, and 시간 is a duration, never a clock.
const CLOCK_KOREAN = String.raw`\d{1,2}[ \t]*시[ \t]*\d{1,2}[ \t]*분`;
const CLOCK_SPAN = String.raw`(?:${CLOCK_MERIDIEM}[ \t]*)?(?:${CLOCK_COLON}|${CLOCK_KOREAN})(?:[ \t]*${CLOCK_MERIDIEM})?`;
// Korean particles belong to the sentence, not the copied time. Do not accept arbitrary word suffixes.
const CLOCK_END = String.raw`(?:(?![\p{L}\p{N}:])|(?<=분)(?=(?:(?:에|부터|까지|쯤|경)(?:는|도|야|였다|이었다|이다)?|이었다|이다|입니다)(?![\p{L}\p{N}])))(?![ \t]*\d+[ \t]*초)`;
// Preserve the existing colon reader verbatim; Korean clocks add a separate strict branch.
const DATED_CLOCK = new RegExp(String.raw`(?<![\p{L}\p{N}])(${CLOCK_DATE})\.?[,]?(?:[ \t]+|T)((?:${CLOCK_MERIDIEM}[ \t]*)?\d{1,2}[ \t]*:[ \t]*\d{2}(?:[ \t]*${CLOCK_MERIDIEM})?)(?![\p{L}\p{N}:])`, 'giu');
const HAS_MERIDIEM = new RegExp(CLOCK_MERIDIEM, 'iu');
const DATED_KOREAN_CLOCK = new RegExp(String.raw`(?<![\p{L}\p{N}])(${CLOCK_DATE})\.?[,]?(?:[ \t]+|T)((?:${CLOCK_MERIDIEM}[ \t]*)?${CLOCK_KOREAN}(?:[ \t]*${CLOCK_MERIDIEM})?)${CLOCK_END}`, 'giu');
// One strict normalizer for source evidence; leave the more permissive answer helper hhmm unchanged.
const SOURCE_CLOCK = new RegExp(String.raw`^(?:(${CLOCK_MERIDIEM})\s*)?(\d{1,2})[ \t]*(?::[ \t]*(\d{2})|시[ \t]*(\d{1,2})[ \t]*분)(?:\s*(${CLOCK_MERIDIEM}))?$`, 'iu');
const sourceClock = text => {
    const hit = SOURCE_CLOCK.exec(text.trim());
    if (!hit || hit[1] && hit[5]) return '';
    let h = Number(hit[2]);
    const m = Number(hit[3] ?? hit[4]), marker = hit[1] || hit[5];
    if (h > 23 || m > 59 || marker && !(h >= 1 && h <= 12)) return '';
    if (marker) { if (/^(?:p|오후|저녁|밤)/i.test(marker)) { if (h < 12) h += 12; } else if (h === 12) h = 0; }
    return `${pad(h)}:${pad(m)}`;
};
export function datedClocks(text, { positions = false } = {}) {
    const input = String(text || ''), out = [];
    const hits = [...input.matchAll(DATED_CLOCK), ...input.matchAll(DATED_KOREAN_CLOCK)].sort((a, b) => a.index - b.index);
    for (const hit of hits) {
        const korean = hit[2].includes('시');
        const hour = Number(/(\d{1,2})[ \t]*:/.exec(hit[2])?.[1]);
        if (!korean && HAS_MERIDIEM.test(hit[2]) && !(hour >= 1 && hour <= 12)) continue;
        const day = when(hit[1]).slice(0, 5), clock = korean ? sourceClock(hit[2]) : hhmm(hit[2]);
        if (day && clock) out.push({ sourceTime: hit[0], local: `${day} ${clock}`, ...(positions ? { position: hit.index } : {}) });
    }
    return out;
}
const KOREAN_CLOCK = new RegExp(String.raw`(?<![\p{L}\p{N}.+\-])(?:${CLOCK_MERIDIEM}[ \t]*)?${CLOCK_KOREAN}(?:[ \t]*${CLOCK_MERIDIEM})?${CLOCK_END}`, 'giu');
// Wider digit shapes are suppression only: an invalid written date must not donate a bare clock.
const KOREAN_DATED_SPAN = new RegExp(String.raw`(?:${CLOCK_DATE.replaceAll('\\d{1,2}', '\\d+')})\.?[,]?(?:[ \t]+|T)${CLOCK_SPAN}${CLOCK_END}`, 'giu');
export function koreanClocks(text, { positions = false } = {}) {
    const input = String(text || ''), out = [];
    // Even an invalid dated source owns its clock: never turn its rejected date into a bare reference.
    const dated = [...input.matchAll(KOREAN_DATED_SPAN)].map(hit => [hit.index, hit.index + hit[0].length]);
    for (const hit of input.matchAll(KOREAN_CLOCK)) {
        if (dated.some(([start, end]) => hit.index >= start && hit.index < end)) continue;
        const clock = sourceClock(hit[0]);
        if (clock) out.push({ sourceTime: hit[0], clock, narrative: true, ...(positions ? { position: hit.index } : {}) });
    }
    return out;
}
// Time-only HTML hints are read before the normal text cleaner removes the element names.
// This is an inert tokenizer, not a DOM: no scripts, styles, URL fetching, or HTML execution.
// Keep these boundaries aligned with cleanMessage in extract.js: time itself is a block there.
const HTML_INLINE = /^(?:b|i|u|s|em|strong|span|a|small|big|sub|sup|mark|font|code|kbd|del|ins|q|abbr|ruby|rt|rp)$/;
const HTML_REMOVED = /^(?:think|thinking|thought|reasoning|scene_plan)$/;
const HTML_VOID = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;
const HTML_RAW = /^(?:script|style|textarea|title|xmp|iframe|noembed|noframes|plaintext)$/;
const HTML_HIDDEN = /^(?:think|thinking|thought|reasoning|analysis|scene_plan|template|blockquote|q|pre|code)$/;
const HTML_DURATION = /(?:^|[\s:_-])(?:duration|elapsed|countdown|timer)(?=$|[\s:_-])/i;
const CLOCK_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', colon: ':', Tab: '\t', NewLine: '\n', ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009' };
const clockHtmlText = text => text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, key) => {
    if (key[0] !== '#') return CLOCK_ENTITIES[key] ?? all;
    const n = /^#x/i.test(key) ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : all;
});
// Adjacent dated spans must use only the entities the existing cleaner actually decodes.
const clockVisibleText = text => text.replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (_, key) => key === 'nbsp' ? ' ' : key === '#39' ? "'" : CLOCK_ENTITIES[key]);
const htmlClockOnly = sourceClock;
// Code spans may use any equal-length backtick runs, even across one paragraph's line breaks.
// Index the next same-sized run first, so unmatched backticks do not repeatedly scan the whole text.
// One barrier per omitted line keeps offsets without creating a tokenizer chunk for every hidden character.
const clockMask = text => text.replace(/[^\n]+/g, line => '\0' + ' '.repeat(line.length - 1));
const htmlClockCode = (text, preserve = false) => text.split(/(\0|\r?\n[ \t]*\r?\n)/).map(part => {
    const runs = [...part.matchAll(/`+/g)], next = new Map(), pieces = [];
    for (let i = runs.length - 1; i >= 0; i--) {
        runs[i].next = next.get(runs[i][0].length);
        next.set(runs[i][0].length, i);
    }
    let from = 0;
    for (let i = 0; i < runs.length; i++) {
        const run = runs[i], end = runs[run.next];
        let slash = run.index;
        while (slash > 0 && part[slash - 1] === '\\') slash--;
        if ((run.index - slash) % 2 || !end) continue;
        const omitted = part.slice(run.index, end.index + end[0].length);
        pieces.push(part.slice(from, run.index), preserve === 'offsets' ? clockMask(omitted) : preserve ? omitted.replace(/[^\n]/g, ' ') : '\0');
        from = end.index + end[0].length;
        i = run.next;
    }
    pieces.push(part.slice(from));
    return pieces.join('');
}).join('');
// Markdown quotes and sample code are not current-clock evidence. Keep a barrier at each omission.
const htmlClockMarkup = (raw, preserve = false) => {
    let fence = '';
    const visible = String(raw || '').split('\n').map(line => {
        const edge = /^[ \t]*(`{3,}|~{3,})([^\n]*)$/.exec(line), omitted = preserve === 'offsets' ? clockMask(line) : preserve ? ' '.repeat(line.length) : '\0';
        if (fence) {
            if (edge && edge[1][0] === fence[0] && edge[1].length >= fence.length && !edge[2].trim()) fence = '';
            return omitted;
        }
        if (/^[ \t]*>/.test(line)) return omitted;
        if (edge && (edge[1][0] !== '`' || !edge[2].includes('`'))) { fence = edge[1]; return omitted; }
        return line;
    }).join('\n');
    return htmlClockCode(visible, preserve);
};
export function htmlClocks(raw, { positions = false } = {}) {
    return readHtmlClocks(htmlClockMarkup(raw, positions ? 'offsets' : false), false, null, positions);
}
// Mask only the new plain-narrative path. Keep original UTF-16 offsets for source ordering.
// Marked HTML fields have their own reader; hidden, quoted and duration fields cannot leak through cleaning.
export function narrativeClockText(raw, { dated = false } = {}) {
    const input = htmlClockMarkup(raw, 'offsets'), excluded = [];
    readHtmlClocks(input, false, excluded, false, dated ? 'dated' : 'plain');
    const chars = input.split('');
    for (const [start, end] of excluded) for (let i = start; i < end; i++) if (chars[i] !== '\n') chars[i] = '\0';
    return chars.join('');
}
// Context fields retain their written meaning. They are not current-clock candidates or conversions.
const HTML_TIME_FIELD = new RegExp(String.raw`^(?:(?:${CLOCK_DATE})\.?[,]?[ \t]*[T ]?)?(${CLOCK_SPAN})(?:[ \t]+(?:(?!(?:AM|PM)\b)[A-Z]{2,5}|(?:UTC|GMT)[+-]\d{1,2}(?::\d{2})?))?$`, 'iu');
const htmlTimeField = text => {
    const hit = HTML_TIME_FIELD.exec(text.replace(/\s+/g, ' '));
    return !!hit && !!htmlClockOnly(hit[1]);
};
const htmlFieldLabel = (name, attrs) => {
    // Original names only: never style, title, event handlers, URLs, or entire HTML.
    const cls = String(attrs.class || '').trim().replace(/\s+/g, ' '), id = String(attrs.id || '').trim().replace(/\s+/g, ' ');
    return [cls && cls.slice(0, 96), id && `#${id.slice(0, 64)}`].filter(Boolean).join(' ') || '';
};
export function htmlTimeFields(raw) {
    const excluded = [], source = String(raw || '');
    // Preserve hidden/inert ancestry before separating fenced sources.
    readHtmlClocks(htmlClockMarkup(source, true), true, excluded);
    let at = 0;
    const pieces = [];
    for (const [start, end] of excluded.sort((a, b) => a[0] - b[0])) {
        if (end <= at) continue;
        pieces.push(source.slice(at, Math.max(at, start)), source.slice(Math.max(at, start), end).replace(/[^\n]/g, ' '));
        at = end;
    }
    pieces.push(source.slice(at));
    const input = pieces.join(''), groups = [], outside = [];
    let fence = '', body = [], language = '', number = 0;
    for (const line of input.split('\n')) {
        const edge = /^[ \t]*(`{3,}|~{3,})([^\n]*)$/.exec(line);
        if (fence) {
            if (edge && edge[1][0] === fence[0] && edge[1].length >= fence.length && !edge[2].trim()) {
                if (/^(?:html?|xhtml)?$/i.test(language)) {
                    const fields = readHtmlClocks(body.join('\n'), true);
                    if (fields.length) groups.push({ scope: 'fenced', block: ++number, fields });
                }
                fence = ''; body = [];
            } else body.push(line);
            outside.push('\0');
        } else if (edge && (edge[1][0] !== '`' || !edge[2].includes('`'))) {
            fence = edge[1]; language = edge[2].trim(); outside.push('\0');
        } else outside.push(line);
    }
    // A closed fence proves a separate embedded source, not what the displayed time means.
    const fields = readHtmlClocks(htmlClockMarkup(outside.join('\n')), true);
    if (fields.length) groups.unshift({ scope: groups.length ? 'outside' : 'html', fields });
    return groups;
}
export function htmlTimeContext(raw) {
    return htmlTimeFields(raw).map(group => {
        const heading = group.scope === 'outside' ? '바깥 메시지의 HTML' : group.scope === 'fenced'
            ? `메시지 안쪽 HTML (코드 블록 ${group.block})` : '메시지의 HTML';
        return `[${heading}]\n${group.fields.map(x => `${x.label}: ${x.sourceTime.replace(/\s+/g, ' ')}`).join('\n')}`;
    }).join('\n');
}
function readHtmlClocks(input, fields = false, excluded = null, positions = false, narrative = false) {
    const root = { name: '', text: '', hints: [], blocked: false, removed: false }, stack = [root];
    let visible = '';
    const append = (text, expose = true) => {
        const node = stack[stack.length - 1];
        node.text += text;
        if (expose && !node.removed) visible += text;
    };
    const finish = (complete, end = input.length) => {
        const node = stack.pop(), parent = stack[stack.length - 1];
        if (node.blocked || !complete) {
            if (excluded) excluded.push([node.start, end]);
            parent.text += '\0';
            if (!complete || !node.removed && !HTML_INLINE.test(node.name)) visible = '';
            return;
        }
        if (narrative === 'plain' && node.marked) excluded.push([node.start, end]);
        const sourceTime = clockHtmlText(node.text).trim();
        // New Korean candidates obey style visibility without changing legacy colon-clock behavior.
        if (!fields && node.hiddenStyle) node.hints = node.hints.filter(x => !x.sourceTime.includes('시'));
        const clock = node.marked && !(node.hiddenStyle && sourceTime.includes('시')) ? htmlClockOnly(sourceTime) : '';
        if (fields) {
            // Keep the smallest complete field; a parent can add an AM/PM marker or a date.
            if (htmlTimeField(sourceTime) && (!node.hints.length || node.hints.length === 1)) {
                parent.hints.push(node.hints[0]?.sourceTime === sourceTime ? node.hints[0] : { sourceTime, label: node.label || node.originalName });
            } else parent.hints.push(...node.hints);
            parent.text += node.text;
            return;
        }
        const datedText = sourceTime.replace(/\s+/g, ' ');
        const dated = node.marked && node.hints.length && datedClocks(datedText).some(x => x.sourceTime === datedText);
        const tail = clock ? clockVisibleText(visible).trimEnd() : '';
        // Only the dated span ending at this exact occurrence can own it. An earlier equal clock cannot.
        const adjacent = clock && tail.endsWith(sourceTime.replace(/\u00a0/g, ' '))
            && datedClocks(tail.slice(tail.lastIndexOf('\n') + 1)).some(x => tail.endsWith(x.sourceTime));
        // Prefer the complete labelled element to a nested duplicate ("PM <span>8:30</span>").
        // One dated stamp also owns its children; a timeline with separate date/time siblings does not.
        if (clock) { if (!adjacent) parent.hints.push({ sourceTime, clock, ...(positions ? { position: node.start } : {}) }); }
        else if (!dated) for (const hint of node.hints) parent.hints.push(hint);
        parent.text += node.text;
        if (!HTML_INLINE.test(node.name)) visible = '';
    };
    let pos = 0;
    while (pos < input.length) {
        const start = input.indexOf('<', pos);
        if (start < 0) { append(input.slice(pos)); break; }
        append(input.slice(pos, start));
        if (input.startsWith('<!--', start)) {
            const end = input.indexOf('-->', start + 4);
            pos = end < 0 ? input.length : end + 3;
            if (excluded) excluded.push([start, pos]);
            continue;
        }
        if (input.startsWith('<![CDATA[', start)) {
            const end = input.indexOf(']]>', start + 9);
            append('\0'); pos = end < 0 ? input.length : end + 3;
            if (excluded) excluded.push([start, pos]);
            continue;
        }
        const head = /^<(\/?)([a-z][\w:-]*)(?=[\s/>])/i.exec(input.slice(start));
        if (!head && !/^<[!?]/.test(input.slice(start, start + 2))) { append('<'); pos = start + 1; continue; }
        // A quoted > is an attribute value, never the end of its tag.
        let end = start + (head?.[0].length || 2), quote = '';
        for (; end < input.length; end++) {
            const ch = input[end];
            if (quote) { if (ch === quote) quote = ''; }
            else if (ch === '"' || ch === "'") quote = ch;
            else if (ch === '>') break;
        }
        if (end === input.length) { if (narrative) excluded.push([start, input.length]); break; }
        pos = end + 1;
        if (narrative) excluded.push([start, pos]);
        if (!head) { append('\0'); continue; }
        const name = head[2].toLowerCase();
        if (head[1]) {
            let at = stack.length - 1;
            while (at > 0 && stack[at].name !== name) at--;
            if (!at) {
                // A message can start with the tail of reasoning, whose opening tag was not retained.
                if (/^(?:think|thinking|thought|reasoning|analysis)$/.test(name)) { root.hints = []; root.text = ''; stack.splice(1); visible = ''; if (excluded) excluded.push([0, pos]); }
                continue;
            }
            while (stack.length - 1 > at) finish(false, pos);
            finish(true, pos);
            continue;
        }
        const attrs = {};
        for (const hit of input.slice(start + head[0].length, end).matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
            const key = hit[1].toLowerCase();
            if (!(key in attrs)) attrs[key] = clockHtmlText(hit[2] ?? hit[3] ?? hit[4] ?? '');
        }
        if (HTML_RAW.test(name)) {
            // Raw text can contain apparent tags and quotes, so do not tokenize its contents.
            const close = new RegExp(`</${name}\\s*>`, 'gi'); close.lastIndex = pos;
            const hit = name === 'plaintext' ? null : close.exec(input);
            append('\0', false);
            if (!stack[stack.length - 1].removed && !/^(?:script|style)$/.test(name)) visible = '';
            pos = hit ? close.lastIndex : input.length;
            if (excluded) excluded.push([start, pos]);
            continue;
        }
        if (HTML_VOID.test(name)) {
            append(!fields && (name === 'br' || name === 'hr') ? '\n' : '\0', false);
            if (!stack[stack.length - 1].removed) visible = '';
            continue;
        }
        const labels = `${name} ${attrs.class || ''} ${attrs.id || ''}`;
        const hiddenStyle = stack[stack.length - 1].hiddenStyle || /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))\s*(?:!important\s*)?(?:;|$)/i.test(attrs.style || '');
        const node = { name, start, hiddenStyle, originalName: head[2], label: htmlFieldLabel(head[2], attrs) || stack[stack.length - 1].label || '', text: '', hints: [], marked: /time/i.test(labels),
            removed: stack[stack.length - 1].removed || HTML_REMOVED.test(name),
            blocked: stack[stack.length - 1].blocked || HTML_HIDDEN.test(name)
                || attrs.hidden !== undefined || /^true$/i.test(attrs['aria-hidden'] || '')
                || (fields || narrative) && hiddenStyle
                || !fields && HTML_DURATION.test(labels.replace(/([a-z\d])([A-Z])/g, '$1 $2'))
                // Dated values and ISO durations belong to other readers, not bare-clock hints.
                || !fields && narrative !== 'dated' && attrs.datetime !== undefined && !htmlClockOnly(attrs.datetime) };
        if (!node.removed && !HTML_INLINE.test(name)) visible = '';
        stack.push(node);
        if (/\/\s*$/.test(input.slice(start, end))) finish(true, pos);
    }
    // An unclosed element is not enough evidence; do not leak its otherwise valid descendants.
    while (stack.length > 1) finish(false);
    return root.hints;
}
export const ko = v => line(v, 400);
// who a gift went to: true is just "a gift"; false, "no", "none" and the like are no gift (never a person called "false")
export const giftOf = v => (v === true ? '선물' : /^(false|true|no|none|null|nein|keine?|아니(요)?|없음|-)?$/i.test(line(v, 40)) ? '' : line(v, 40));
export const arr = v => (Array.isArray(v) ? v.filter(x => x !== null && x !== undefined) : []);
export const pick = (v, list, dflt) => (list.includes(v) ? v : dflt);
// an event tag, kept only when given: items from the same story event share it (links between apps)
export const evOf = v => line(v, 40).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
// a bare number (a model counting its items) is no tag
export const withEv = (x, raw) => { const ev = evOf(raw?.ev); return ev && !/^\d+$/.test(ev) ? { ...x, ev } : x; };
// story days ("MM-DD") carry no year: how many days from a to b, the short way round New Year (12-31 → 01-01 is 1, not
// -364). Compare and sort story days with this, never as text
// (02-29 half a day from 02-28 and 03-01: a leap day of its own)
const dnum = s => { const mt = /^(\d{2})-(\d{2})/.exec(String(s || '')); return !mt ? NaN : mt[1] === '02' && mt[2] === '29' ? Date.UTC(2001, 2, 1) / 864e5 - 0.5 : Date.UTC(2001, mt[1] - 1, Number(mt[2])) / 864e5; };
export const gapDays = (a, b) => { let g = dnum(b) - dnum(a); if (!Number.isFinite(g)) return 0; if (g < -180) g += 365; if (g > 180) g -= 365; return Math.sign(g) * Math.ceil(Math.abs(g)); };
// a record's time ("MM-DD HH:MM") as minutes from the story's now, for sorting in story order across New Year. Records
// are mostly behind now: up to a month ahead stays ahead (an order due, a booking), the rest of the year is behind
export const storyMin = (t, now) => {
    // (whole days on a 366-day round, 02-29 between 02-28 and 03-01: a year without it keeps its order)
    const day366 = v => { const mt = /^(\d{2})-(\d{2})/.exec(String(v || '')); return mt ? Date.UTC(2000, mt[1] - 1, Number(mt[2])) / 864e5 : NaN; };
    const s = String(t || ''), d = day366(s), n = day366(String(now || ''));
    if (!Number.isFinite(d)) return -1e9;
    let g = Number.isFinite(n) ? d - n : d;
    if (Number.isFinite(n)) { if (g > 31) g -= 366; else if (g < -335) g += 366; }
    const hm = /(\d{2}):(\d{2})/.exec(s.slice(5));
    return g * 1440 + (hm ? hm[1] * 60 + Number(hm[2]) : 0);
};
// a sort comparator in story order (oldest first): byStory(p.now) or byStory(p.now, x => x.opened); flip a, b for newest
export const byStory = (now, get = x => x?.time) => (a, b) => storyMin(get(a), now) - storyMin(get(b), now) || String(get(a) ?? '').localeCompare(String(get(b) ?? ''));
// the story's year: only where it stands in a date ("2026-11-07", "2026.11.07", "2026년 11월", "Nov 7, 2026",
// "7. November 2026", "31.03.2024"), the last one written. A bare number is never a year: 2050원 is money, "2019년에 헤어졌다" is the past,
// a fantasy calendar's 1247 is its own
const MON = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|januar|februar|märz|maerz|mai|juni|juli|okt|dez';
const DATED = new RegExp(`(?<!\\d)((?:19|20)\\d{2})[-./](?:0?[1-9]|1[0-2])[-./](?:0?[1-9]|[12]\\d|3[01])(?!\\d)|(?<!\\d)((?:19|20)\\d{2})년\\s*(?:0?[1-9]|1[0-2])월|\\b(?:${MON})[a-zä]*\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+((?:19|20)\\d{2})(?!\\d)|(?<!\\d)\\d{1,2}\\.?\\s+(?:${MON})[a-zä]*\\.?,?\\s+((?:19|20)\\d{2})(?!\\d)|(?<!\\d)(?:(?:0?[1-9]|1[0-2])[-./](?:0?[1-9]|[12]\\d|3[01])|(?:0?[1-9]|[12]\\d|3[01])[-./](?:0?[1-9]|1[0-2]))[-./]\\s?((?:19|20)\\d{2})(?!\\d)`, 'gi');
export const yearIn = text => { let y = ''; for (const mt of String(text || '').matchAll(DATED)) y = mt[1] || mt[2] || mt[3] || mt[4] || mt[5]; return y; };
// a model's JSON with a slip mended: a bracket closed with the wrong kind ("profile": { … ]), a comma before a closer,
// closers missing at the end. Strings are left as they are
export function mendJson(t) {
    let out = '', inStr = false, esc = false;
    const stack = [];
    for (const ch of String(t)) {
        if (inStr) { out += ch; if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
        if (ch === '"') { inStr = true; out += ch; continue; }
        if (ch === '{' || ch === '[') { stack.push(ch === '{' ? '}' : ']'); out += ch; continue; }
        if (ch === '}' || ch === ']') {
            if (!stack.length) continue;
            out = out.replace(/,\s*$/, '');
            out += stack.pop();
            continue;
        }
        out += ch;
    }
    if (inStr) out += '"';
    out = out.replace(/,\s*$/, '');
    while (stack.length) out += stack.pop();
    return out;
}
// the JSON in a model's answer; one that doesn't parse is mended once
// a Korean line that only says its original again ("케이크 흐트러지지 않게…" under the same words): no second line.
// Every translation field (ko, kt, pko, noteKo, optionKo…) is dropped when it matches any other text on the same record
// (spaces, marks and emoji aside), or when the words it translates are Korean already; the rest stay. Every model answer goes through it (parseJson), and the phone runs it again before it is drawn, for phones saved before
const KO_KEY = /^(ko|kt|pko|[a-z][A-Za-z]*Ko)$/, bare = v => String(v).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
// the words a translation is of, when the record says for sure: noteKo is note's, kt the title's, ko the one text the record has
const MAIN = ['text', 'caption', 'item', 'label', 'name', 'who', 'title'];
const origOf = (o, k) => { if (k === 'kt') return o.title; if (k !== 'ko' && k !== 'pko' && k.endsWith('Ko')) return o[k.slice(0, -2)]; if (k !== 'ko') return ''; const has = MAIN.filter(x => typeof o[x] === 'string' && o[x]); return has.length === 1 ? o[has[0]] : ''; };
// written in Korean already: most of its letters are Hangul
const korean = v => { const t = String(v || '').replace(/[^\p{L}]/gu, ''); return t.length > 0 && (t.match(/\p{Script=Hangul}/gu) || []).length / t.length > 0.5; };
export function tidyKo(o, seen = new Set()) {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    if (Array.isArray(o)) { for (const x of o) tidyKo(x, seen); return; }
    const own = Object.entries(o).filter(([k, v]) => typeof v === 'string' && v && !KO_KEY.test(k)).map(([, v]) => bare(v)).filter(Boolean);
    for (const [k, v] of Object.entries(o)) {
        if (KO_KEY.test(k) && typeof v === 'string') { if (v && (own.includes(bare(v)) || korean(origOf(o, k)))) o[k] = ''; }
        else if (v && typeof v === 'object') tidyKo(v, seen);
    }
}
// a long list a fill asked for, with a slip the mending can't undo (any kind: "app", 14 for "app": 14, a stray word, a
// broken string): read piece by piece, and only the piece with the slip is left out (one app of one day, not the whole
// screen time). whole: a record in a list with any slip in its own fields goes whole (a voice memo is its text: none
// with half of it). An order, a shop or a day keeps its other fields: each app's own check drops one missing what it
// needs. Not for a reflection, whose answer is all or nothing
export function salvageJson(t, { whole = false } = {}) {
    const s = String(t);
    let i = 0, lost = 0;
    const half = new WeakSet();
    const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
    const fail = () => { throw new SyntaxError(`salvage at ${i}`); };
    // past a broken piece: to the next comma or closer of the list it is in
    const skip = from => {
        let d = 0, str = false, esc = false;
        for (i = from; i < s.length; i++) {
            const ch = s[i];
            if (str) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"' && closes(i)) str = false; continue; }
            if (ch === '"') str = true;
            else if (ch === '{' || ch === '[') d++;
            else if (ch === '}' || ch === ']') { if (!d) return; d--; }
            else if (ch === ',' && !d) return;
        }
    };
    // a quote ends a string only when what follows can come after one (a comma, a colon, a closer): "said "no" twice"
    // keeps its inner quotes; a line break written as it is stays in it
    const closes = j => { let k = j + 1; while (k < s.length && /\s/.test(s[k])) k++; return k >= s.length || /[,:}\]]/.test(s[k]); };
    const string = () => {
        if (s[i] !== '"') fail();
        let j = i + 1;
        for (; j < s.length; j++) { if (s[j] === '\\') { j++; continue; } if (s[j] === '"' && closes(j)) break; }
        if (j >= s.length) fail();
        const v = JSON.parse(`"${s.slice(i + 1, j).replace(/(^|[^\\])"/g, '$1\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}"`);
        i = j + 1;
        return v;
    };
    // how many of its pieces broke (one cut off at the end, or closed with the wrong bracket, too)
    const list = (piece, close) => {
        let bad = 0;
        i++;
        for (;;) {
            ws();
            if (i >= s.length) return bad + 1;
            if (s[i] === close) { i++; return bad; }
            if (s[i] === '}' || s[i] === ']') { i++; lost++; return bad + 1; }
            const from = i;
            try { piece(); } catch { bad++; lost++; skip(from); }
            if (s[i] === ',') i++;
        }
    };
    // a value is whole only when what follows can come after it; a number cut in two ("price": 12,000 or 1 20) is broken,
    // not 12 or 1. Nothing is kept from a broken piece
    // (in a list, [58, 124] is two numbers: only three digits starting with 0, [12,000], are a number cut in two there)
    const done = (v, inList = false) => {
        ws();
        if (i < s.length && !/[,}\]]/.test(s[i])) fail();
        if (typeof v === 'number' && (inList ? /^,\s*0\d{2}(?!\d)\s*[,}\]]/ : /^,\s*\d{3}(?!\d)\s*[,}\]]/).test(s.slice(i, i + 20))) fail();
        return v;
    };
    const value = () => {
        ws();
        const ch = s[i];
        if (ch === '{') { const o = {}; if (list(() => { const k = string(); ws(); if (s[i] !== ':') fail(); i++; o[k] = done(value()); }, '}')) half.add(o); return o; }
        if (ch === '[') { const a = []; list(() => { const v = done(value(), true); if (whole && half.has(v)) { lost++; return; } a.push(v); }, ']'); return a; }
        if (ch === '"') return string();
        const lit = /^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(s.slice(i, i + 40));
        if (!lit) fail();
        i += lit[0].length;
        return JSON.parse(lit[0]);
    };
    const out = value();
    if (!out || typeof out !== 'object') fail();
    if (lost) console.warn(`[narrative-archive] ${lost} broken piece(s) left out of the answer`);
    return out;
}
export const parseJson = (s, { salvage = false } = {}) => { let o; try { o = JSON.parse(s); } catch { try { o = JSON.parse(mendJson(s)); } catch (err) { if (!salvage) throw err; o = salvageJson(s, { whole: salvage === 'whole' }); } } tidyKo(o); return o; };
export const jsonOf = (out, opt) => { const t = String(out || '').replace(/```(?:json)?/gi, ''), a = t.indexOf('{'), b = t.lastIndexOf('}'); try { return a >= 0 && b > a ? parseJson(t.slice(a, b + 1), opt) : null; } catch { return null; } };
// a number from a model's answer: "12,50", "€9.90", "1,200"; text with no digit in it ("lots", "free") is none, never 0
export const num = v => {
    if (v === null || v === undefined || typeof v === 'object' || typeof v === 'boolean') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
    // the first number written ("4.7/5" is 4.7, "25–35" is 25), never two run together
    // (a minus written before the currency sign or a space, "-₩12,000", "- € 12,50", is still the number's; a dash before
    // letters, "BTC-USD 65,000", is no minus)
    const mt = String(v).replace(/[−–](?=\s*(?:[^\p{L}\d\s.,−–-]{1,3}\s*)?\d)/gu, '-').replace(/-\s*(?:[^\p{L}\d\s.,-]{1,3}\s*)?(?=\d)/u, '-').match(/-?\d[\d.,]*/);
    if (!mt) return null;
    let t = mt[0].replace(/[.,]+$/, '');
    // "1.200,50" and "1,200.50": the last mark is the decimal one; "12,50" is 12.5; "1,200" and "1.200.000" are thousands
    if (t.includes('.') && t.includes(',')) { const d = Math.max(t.lastIndexOf('.'), t.lastIndexOf(',')); t = t.slice(0, d).replace(/[.,]/g, '') + '.' + t.slice(d + 1); }
    else if (t.includes(',')) t = /,\d{1,2}$/.test(t) && (t.match(/,/g) || []).length === 1 ? t.replace(',', '.') : t.replace(/,/g, '');
    else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
    // one dot with exactly three digits after it is thousands too ("1.200" euros is 1200, "12.50" is 12.5; "0.125" stays)
    else if (/^-?[1-9]\d{0,2}\.\d{3}$/.test(t)) t = t.replace('.', '');
    const n = Number(t);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};
export const last4 = v => String(v ?? '').replace(/\D/g, '').slice(-4);
