// 캐릭터 휴대폰: cleaning what a model sends back (text cut short, times in one shape, numbers read loosely).
// No other imports, so the pure sync modules and the tests can use it alone.
// text from a model's answer: an object or list where text belongs is no text (never "[object Object]")
export const str = (v, n) => (v !== null && typeof v === 'object' ? '' : String(v ?? '')).replace(/[ \t]+/g, ' ').trim().slice(0, n);
export const line = (v, n) => str(v, n).replace(/\s*\n\s*/g, ' ');
export const pad = x => String(x).padStart(2, '0');
// a date written with its month's name or 월: "1월 20일 15:00", "Jan 20", "January 20, 2027", "20. Januar" (the clock after it, if any)
const MONS = { jan: 1, feb: 2, mar: 3, mär: 3, apr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dez: 12 };
const named = v => {
    const s = String(v || ''), ko = s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/), en = s.match(/\b([a-zä]{3})[a-zä]*\.?\s+(\d{1,2})(?!\d)/i), de = s.match(/(?<!\d)(\d{1,2})\.?\s+([a-zä]{3})[a-zä]*/i);
    const [mo, d] = ko ? [Number(ko[1]), Number(ko[2])] : en && MONS[en[1].toLowerCase()] ? [MONS[en[1].toLowerCase()], Number(en[2])] : de && MONS[de[2].toLowerCase()] ? [MONS[de[2].toLowerCase()], Number(de[1])] : [0, 0];
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return '';
    const hm = s.match(/(\d{1,2}):(\d{2})/), ok = hm && Number(hm[1]) < 24 && Number(hm[2]) < 60;
    return `${pad(mo)}-${pad(d)}${ok ? ` ${pad(hm[1])}:${hm[2]}` : ''}`;
};
export const when = v => {
    // "10-25 21:00", or with the year in front ("2026-10-25 21:00", "2026/10/25T21:00")
    const mt = String(v || '').match(/(?:^|\D)(?:\d{4}[-/.])?(\d{1,2})[-/.](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2}))?/);
    if (!mt || !(Number(mt[1]) >= 1 && Number(mt[1]) <= 12) || !(Number(mt[2]) >= 1 && Number(mt[2]) <= 31)) return named(v);
    // a clock that can't be ("25:99") is dropped, the day stays
    const ok = mt[3] && Number(mt[3]) < 24 && Number(mt[4]) < 60;
    return `${pad(mt[1])}-${pad(mt[2])}${ok ? ` ${pad(mt[3])}:${mt[4]}` : ''}`;
};
export const hhmm = v => { const mt = String(v || '').match(/(\d{1,2}):(\d{2})/); return mt && Number(mt[1]) < 24 && Number(mt[2]) < 60 ? `${pad(mt[1])}:${mt[2]}` : ''; };
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
export const parseJson = s => { try { return JSON.parse(s); } catch { return JSON.parse(mendJson(s)); } };
export const jsonOf = out => { const t = String(out || '').replace(/```(?:json)?/gi, ''), a = t.indexOf('{'), b = t.lastIndexOf('}'); try { return a >= 0 && b > a ? parseJson(t.slice(a, b + 1)) : null; } catch { return null; } };
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
