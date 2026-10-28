// 이야기 속 기념일: days the characters would remember (first meeting, the confession, the first kiss), each tied to the
// section it happened in. The AI 기능 모델 finds them; they can be renamed, removed or added by hand. When the story's
// date comes round to one again, the home tab says so in one line.
// m.annivs = [{ key, name }] (key = section key); m.annivScan = how many dated sections have been read;
// m.annivSeen = { 'key:years': true } — lines already closed

import { askAI } from './ai.js';
import { calendars, headingDate, storyTimeline } from './calendar.js';
import { getMeta, saveMeta } from './core.js';
import { recentTrackers } from './scenes.js';
import { sectionKey } from './sections.js';

export const annivsOf = m => (Array.isArray(m?.annivs) ? m.annivs.filter(a => a?.key && String(a.name || '').trim()) : []);

// the dated sections of the newest log, in order, with the year the calendar counted for each
export function datedRows(m) {
    const tl = storyTimeline(m);
    const log = tl[tl.length - 1];
    return log ? log.rows.filter(r => r.date?.d) : [];
}

const AI_SYS_ANNIV = `GOAL
You read sections of a long role-play archive and find the days its characters would remember as anniversaries.

WHAT COUNTS
Turning points of the main relationship(s) only: the first meeting, a confession, a first kiss, becoming a couple, a first
fight that mattered, making up, a proposal, a wedding, a first trip together, a loss or a parting, a reunion.
Not ordinary days, not plot events that do not change how the characters stand with each other.
Few: at most 6 in this batch, often fewer. None is a fine answer.

OUTPUT
One line per day:
<number> | <short Korean name, 2 to 8 characters>
Names like: 첫 만남 · 고백한 날 · 첫 키스 · 연인이 된 날 · 처음 싸운 날 · 화해한 날 · 청혼한 날 · 첫 여행
Use a name only once; if the same kind of day happens again, keep the first.
If nothing counts: NONE`;

// read the dated sections not read yet (or all of them again) in batches; new days are added to m.annivs
export async function findAnnivs({ again = false, onProgress = null } = {}) {
    const m = getMeta();
    const rows = datedRows(m);
    const from = again ? 0 : Math.min(Number(m.annivScan) || 0, rows.length);
    if (again) m.annivs = [];
    const have = annivsOf(m);
    const todo = rows.slice(from);
    const found = [];
    const B = 40;
    for (let i = 0; i < todo.length; i += B) {
        const part = todo.slice(i, i + B);
        onProgress?.(i, todo.length);
        const list = part.map((r, n) => {
            const body = m.text.slice(r.s.start, r.s.end).replace(/^[^\n]*\n?/, '').replace(/\s+/g, ' ').trim();
            return `${n + 1}. ${r.s.title}\n   ${body.slice(0, 500)}${body.length > 500 ? '…' : ''}`;
        }).join('\n');
        const known = [...have, ...found].map(a => a.name);
        const out = await askAI(`${known.length ? `[ALREADY FOUND — do not repeat these names]\n${known.join(', ')}\n\n` : ''}[SECTIONS]\n${list}`, { system: AI_SYS_ANNIV, maxTokens: 600 });
        for (const line of String(out || '').split('\n')) {
            const mt = line.match(/^\s*(\d+)\s*[|:.)-]\s*(.{1,20}?)\s*$/);
            if (!mt) continue;
            const r = part[Number(mt[1]) - 1], name = mt[2].replace(/^[*"'「]+|[*"'」]+$/g, '').trim();
            if (!r || !name || [...have, ...found].some(a => a.name === name || a.key === sectionKey(r.s))) continue;
            found.push({ key: sectionKey(r.s), name });
        }
        m.annivs = [...have, ...found];
        m.annivScan = from + i + part.length;
        await saveMeta();
    }
    if (!todo.length) { m.annivScan = rows.length; await saveMeta(); }
    return found;
}

// today in the story: the newest status window's date, else the newest dated section; with the year the calendar counts
function storyToday(m, rows) {
    const last = rows[rows.length - 1];
    if (!last) return null;
    let t = null;
    try { t = recentTrackers(1)[0]; } catch { t = null; }
    const d = t?.date ? headingDate(`(${t.date})`, calendars()).date : null;
    if (d?.d && d.cal === last.date.cal) {
        // a date earlier in the year than the newest section means the year has turned since
        const back = d.m < last.date.m2 || (d.m === last.date.m2 && d.d < (last.date.d2 || last.date.d));
        return { cal: d.cal, m: d.m, d: d.d, year: last.year + (back ? 1 : 0) };
    }
    return { cal: last.date.cal, m: last.date.m2, d: last.date.d2 || last.date.d, year: last.year };
}

// the anniversary falling on the story's today, if any: { key, name, years, title }
export function annivToday(m) {
    const list = annivsOf(m);
    if (!list.length) return null;
    const rows = datedRows(m);
    const now = storyToday(m, rows);
    if (!now) return null;
    for (const a of list) {
        const r = rows.find(x => sectionKey(x.s) === a.key);
        if (!r || r.date.cal !== now.cal || r.date.m !== now.m || r.date.d !== now.d) continue;
        const years = now.year - r.year;
        if (years >= 1 && !m.annivSeen?.[`${a.key}:${years}`]) return { key: a.key, name: a.name, years, title: r.s.title };
    }
    return null;
}
