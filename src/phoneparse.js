// 캐릭터 휴대폰: cleaning what a model sends back (text cut short, times in one shape, numbers read loosely).
// No other imports, so the pure sync modules and the tests can use it alone.
export const str = (v, n) => String(v ?? '').replace(/[ \t]+/g, ' ').trim().slice(0, n);
export const line = (v, n) => str(v, n).replace(/\s*\n\s*/g, ' ');
export const pad = x => String(x).padStart(2, '0');
export const when = v => {
    // "10-25 21:00", or with the year in front ("2026-10-25 21:00", "2026/10/25T21:00")
    const mt = String(v || '').match(/(?:^|\D)(?:\d{4}[-/.])?(\d{1,2})[-/.](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2}))?/);
    if (!mt || Number(mt[1]) > 12 || Number(mt[2]) > 31) return '';
    return `${pad(mt[1])}-${pad(mt[2])}${mt[3] ? ` ${pad(mt[3])}:${mt[4]}` : ''}`;
};
export const hhmm = v => { const mt = String(v || '').match(/(\d{1,2}):(\d{2})/); return mt ? `${pad(mt[1])}:${mt[2]}` : ''; };
export const ko = v => line(v, 400);
export const arr = v => (Array.isArray(v) ? v : []);
export const pick = (v, list, dflt) => (list.includes(v) ? v : dflt);
// an event tag, kept only when given: items from the same story event share it (links between apps)
export const evOf = v => line(v, 40).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
// a bare number (a model counting its items) is no tag
export const withEv = (x, raw) => { const ev = evOf(raw?.ev); return ev && !/^\d+$/.test(ev) ? { ...x, ev } : x; };
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
export const num = v => { if (v === null || v === undefined || String(v).trim() === '') return null; const n = Number(String(v ?? '').replace(/[^\d.,-]/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
export const last4 = v => String(v ?? '').replace(/\D/g, '').slice(-4);
