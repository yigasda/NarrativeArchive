// 폰 2 실제 시간 시계 (docs/PHONE2-PLAN.md 단계 4-1). 아무것도 부르지 않는 순수 파일이고, 폰 1은 이걸 부르지 않아요.
// 폰 2의 "지금"은 현실의 지금이에요: 그 사람이 있는 곳의 현실 시각 그대로, 날짜만 dayShift일 옮겨요
// (이야기에서 시작: 날짜는 이야기, 시각은 현실). 시각을 ms로 더하지 않고 달력 날짜만 옮겨서, 서머타임이 달라도
// 시 · 분은 늘 그곳의 현실 시계와 같아요.

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const two = n => String(n).padStart(2, '0');
const DAY = 864e5;

// the wall clock in a time zone at a real instant: { y, mo, d, h, mi } (a zone that can't be read: UTC)
export function wallAt(tz, ms) {
    let parts;
    try { parts = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(ms)); }
    catch { return wallAt('UTC', ms); }
    const g = t => Number(parts.find(p => p.type === t)?.value);
    return { y: g('year'), mo: g('month'), d: g('day'), h: g('hour') % 24, mi: g('minute') };
}
// a calendar date moved by whole days (no clock involved): { y, mo, d }
const moveDate = (y, mo, d, days) => { const t = new Date(Date.UTC(y, mo - 1, d) + days * DAY); return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
const dayNo = (y, mo, d) => Math.round(Date.UTC(y, mo - 1, d) / DAY);
const show = w => ({ year: w.y, at: `${two(w.mo)}-${two(w.d)} ${two(w.h)}:${two(w.mi)}`, wd: WD[new Date(Date.UTC(w.y, w.mo - 1, w.d)).getUTCDay()] });

// 폰 2's now where someone is: { year, at: "MM-DD HH:MM", wd } — the real wall clock there, its date moved by dayShift
export function liveWall(tz, dayShift = 0, realMs = Date.now()) {
    const w = wallAt(tz, realMs), dt = moveDate(w.y, w.mo, w.d, Number(dayShift) || 0);
    return show({ ...dt, h: w.h, mi: w.mi });
}

// 이야기에서 시작할 때의 dayShift: the story's date, the real clock; a real clock earlier in the day than the
// story's moves to the next day (이야기 13일 15:00, 현실 09:00 → 14일 09:00), so 폰 2 never begins before the story.
// storyAt: "MM-DD HH:MM" on the owner's clock, storyYear: its year; tz: where the owner is
export function startShift({ storyAt, storyYear, tz, realMs = Date.now() } = {}) {
    const mt = /^(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(String(storyAt || ''));
    if (!mt || !Number.isInteger(Number(storyYear))) throw new Error('이야기 시각(MM-DD HH:MM)과 연도가 필요해요');
    const [, mo, d, h, mi] = mt.map(Number), y = Number(storyYear), w = wallAt(tz, realMs);
    const later = w.h * 60 + w.mi < h * 60 + mi ? 1 : 0;
    return dayNo(y, mo, d) + later - dayNo(w.y, w.mo, w.d);
}

// how far 폰 2's days are from the real ones, for the small label ("현실보다 +2일"); '' when none
export const shiftLabel = days => (Number(days) ? `현실보다 ${days > 0 ? '+' : '−'}${Math.abs(days)}일` : '');

// a real instant as the viewer sees it on the messenger (their browser's zone), with 폰 2's day shift: { year, at, wd }
export const viewerWall = (ms, dayShift = 0, viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone) => liveWall(viewerTz, dayShift, ms);
