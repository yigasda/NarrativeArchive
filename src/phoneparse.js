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
    const s = String(v || ''), ko = s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/), en = s.match(/\b([a-zä]{3,9})\.?\s+(\d{1,2})(?!\d)/i), de = s.match(/(?<!\d)(\d{1,2})\.?\s+([a-zä]{3,9})\b/i);
    const [mo, d] = ko ? [Number(ko[1]), Number(ko[2])] : en && month(en[1]) ? [month(en[1]), Number(en[2])] : de && month(de[2]) ? [month(de[2]), Number(de[1])] : [0, 0];
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return '';
    const hm = s.match(/(\d{1,2}):(\d{2})/), ok = hm && Number(hm[1]) < 24 && Number(hm[2]) < 60;
    return `${pad(mo)}-${pad(d)}${ok ? ` ${pad(hm[1])}:${hm[2]}` : ''}`;
};
export const when = v => {
    // "10-25 21:00", or with the year in front ("2026-10-25 21:00", "2026/10/25T21:00") or after ("25.10.2026 21:00", "10/25/2026 9:00")
    const mt = String(v || '').match(/(?:^|\D)(?:\d{4}[-/.])?(\d{1,2})[-/.](\d{1,2})(?:[-/.]\s?\d{4})?(?:[ T]+(\d{1,2}):(\d{2}))?/);
    // the day first where the month can't come first ("26.10.", "26/10/2026"), unless a year led ("2026-10-26")
    if (mt && !/^\d{4}/.test(mt[0].replace(/^\D/, '')) && Number(mt[1]) > 12 && Number(mt[2]) <= 12) [mt[1], mt[2]] = [mt[2], mt[1]];
    if (!mt || !(Number(mt[1]) >= 1 && Number(mt[1]) <= 12) || !(Number(mt[2]) >= 1 && Number(mt[2]) <= 31)) return named(v);
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
const dnum = s => { const mt = /^(\d{2})-(\d{2})/.exec(String(s || '')); return mt ? Date.UTC(2001, mt[1] - 1, Number(mt[2])) / 864e5 : NaN; };
export const gapDays = (a, b) => { let g = dnum(b) - dnum(a); if (!Number.isFinite(g)) return 0; if (g < -180) g += 365; if (g > 180) g -= 365; return g; };
// a record's time ("MM-DD HH:MM") as minutes from the story's now, for sorting in story order across New Year. Records
// are mostly behind now: up to a month ahead stays ahead (an order due, a booking), the rest of the year is behind
export const storyMin = (t, now) => {
    const s = String(t || ''), d = dnum(s), n = dnum(String(now || ''));
    if (!Number.isFinite(d)) return -1e9;
    let g = Number.isFinite(n) ? d - n : d;
    if (Number.isFinite(n)) { if (g > 31) g -= 365; else if (g < -334) g += 365; }
    const hm = /(\d{2}):(\d{2})/.exec(s.slice(5));
    return g * 1440 + (hm ? hm[1] * 60 + Number(hm[2]) : 0);
};
// a sort comparator in story order (oldest first): byStory(p.now) or byStory(p.now, x => x.opened); flip a, b for newest
export const byStory = (now, get = x => x?.time) => (a, b) => storyMin(get(a), now) - storyMin(get(b), now) || String(get(a) ?? '').localeCompare(String(get(b) ?? ''));
// the story's year: only where it stands in a date ("2026-11-07", "2026.11.07", "2026년 11월", "Nov 7, 2026",
// "7. November 2026"), the last one written. A bare number is never a year: 2050원 is money, "2019년에 헤어졌다" is the past,
// a fantasy calendar's 1247 is its own
const MON = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|januar|februar|märz|maerz|mai|juni|juli|okt|dez';
const DATED = new RegExp(`(?<!\\d)((?:19|20)\\d{2})[-./](?:0?[1-9]|1[0-2])[-./](?:0?[1-9]|[12]\\d|3[01])(?!\\d)|(?<!\\d)((?:19|20)\\d{2})년\\s*(?:0?[1-9]|1[0-2])월|\\b(?:${MON})[a-zä]*\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+((?:19|20)\\d{2})(?!\\d)|(?<!\\d)\\d{1,2}\\.?\\s+(?:${MON})[a-zä]*\\.?,?\\s+((?:19|20)\\d{2})(?!\\d)`, 'gi');
export const yearIn = text => { let y = ''; for (const mt of String(text || '').matchAll(DATED)) y = mt[1] || mt[2] || mt[3] || mt[4]; return y; };
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
// screen time). Not for a reflection, whose answer is all or nothing
export function salvageJson(t) {
    const s = String(t);
    let i = 0, lost = 0;
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
    const list = piece => {
        i++;
        for (;;) {
            ws();
            if (i >= s.length) return;
            if (s[i] === '}' || s[i] === ']') { i++; return; }
            const from = i;
            try { piece(); ws(); if (i < s.length && !/[,}\]]/.test(s[i])) fail(); } catch { lost++; skip(from); }
            if (s[i] === ',') i++;
        }
    };
    const value = () => {
        ws();
        const ch = s[i];
        if (ch === '{') { const o = {}; list(() => { const k = string(); ws(); if (s[i] !== ':') fail(); i++; o[k] = value(); }); return o; }
        if (ch === '[') { const a = []; list(() => a.push(value())); return a; }
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
export const parseJson = (s, { salvage = false } = {}) => { let o; try { o = JSON.parse(s); } catch { try { o = JSON.parse(mendJson(s)); } catch (err) { if (!salvage) throw err; o = salvageJson(s); } } tidyKo(o); return o; };
export const jsonOf = (out, opt) => { const t = String(out || '').replace(/```(?:json)?/gi, ''), a = t.indexOf('{'), b = t.lastIndexOf('}'); try { return a >= 0 && b > a ? parseJson(t.slice(a, b + 1), opt) : null; } catch { return null; } };
// a number from a model's answer: "12,50", "€9.90", "1,200"; text with no digit in it ("lots", "free") is none, never 0
export const num = v => {
    if (v === null || v === undefined || typeof v === 'object' || typeof v === 'boolean') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
    // the first number written ("4.7/5" is 4.7, "25–35" is 25), never two run together
    const mt = String(v).replace(/[−–](?=\s*\d)/g, '-').match(/-?\d[\d.,]*/);
    if (!mt) return null;
    let t = mt[0].replace(/[.,]+$/, '');
    // "1.200,50" and "1,200.50": the last mark is the decimal one; "12,50" is 12.5; "1,200" and "1.200.000" are thousands
    if (t.includes('.') && t.includes(',')) { const d = Math.max(t.lastIndexOf('.'), t.lastIndexOf(',')); t = t.slice(0, d).replace(/[.,]/g, '') + '.' + t.slice(d + 1); }
    else if (t.includes(',')) t = /,\d{1,2}$/.test(t) && (t.match(/,/g) || []).length === 1 ? t.replace(',', '.') : t.replace(/,/g, '');
    else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
    const n = Number(t);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};
export const last4 = v => String(v ?? '').replace(/\D/g, '').slice(-4);
