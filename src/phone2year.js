// 폰 2(실시간)의 연도. phonedata.js의 storyYear · ensureYear · setStoryYear에서 실시간 쪽만 옮긴 거예요.
// 연도가 둘이에요.
//   화면에 보이는 연도 = 흐르는 시계의 연도 + 고른 차이 (liveShownYear, 화면은 창구의 P.yearOn으로 물어요). 저장 안 해요.
//   폰에 저장된 연도 p.year = 폰에 저장된 시각 p.now(마지막 반영 때)의 연도. 폰 1의 계산(은행 날짜 · 요일 등)이 p.year와
//   p.now를 붙여 쓰기 때문이에요. 시계가 그 뒤로 새해를 넘겼으면 화면의 연도보다 한 해 적어요 (liveCross).
//   예: 마지막 반영 12-30, 지금 01-02 → 화면 2027, p.year 2026, 은행 채우기 날짜 2026-12-30. 다음 반영이 둘을 맞춰요.
// 사용자가 고른 연도는 시계의 연도에서 몇 해 떨어졌는지(p.liveYearShift)로 남겨서, 반영 뒤에도 새해가 지나도 지켜져요.
// 롤플 상태창의 연도는 안 읽어요.
// 기록(은행 · 투자 · 장부)과 복구 기록은 실시간 서랍의 것만 옮겨요. 폰 1의 것은 건드리지 않아요.
import { shiftAll } from './phonedata.js';
import { journalRead, journalWrite } from './phonesync.js';
import { isLiveMeta, liveNowYear, liveNowText, liveYearAt, liveCross } from './phone2store.js';

const need = m => { if (!isLiveMeta(m)) throw new Error('실시간 폰의 서랍이 아니에요'); return m; };

// 실시간 시계의 연도: 서랍이 알려 주는 것, 서랍에 시계가 없으면 브라우저의 올해
const baseYear = (m, p) => liveNowYear(m, p) || new Date().getFullYear();
// 이 폰의 연도: 사용자가 끈 것(없음), 폰에 있는 것, 없으면 실시간 시계의 연도 + 고른 차이
export function liveStoryYear(m, p = null) {
    if (p?.noYear) return '';
    if (p?.year) return String(p.year);
    return String(baseYear(m, p) + (Number(p?.liveYearShift) || 0));
}
// 연도를 한 번 정해요 (이미 있거나 꺼져 있으면 그대로): 정했으면 true
export function liveEnsureYear(m, p) {
    if (!p || p.year || p.noYear) return false;
    const y = Number(liveStoryYear(m, p));
    // (the phone's own year is its saved time's: a clock past New Year since then stands one on)
    if (y) p.year = y + (Number(p.yearShift) || 0) - liveCross(p.now, liveNowText(m, p)); else p.noYear = true;
    return true;
}
// 연도를 바꿔요 (설정 › 날짜 및 시간): 실시간의 모든 폰이 같이 움직이고, 은행 · 투자 · 장부의 날짜도 같은 햇수만큼
export function liveSetStoryYear(m, p, year) {
    need(m);
    // (phones just copied from the story: the year they had there is set down first, so it is kept below)
    for (const q of Object.values(m.phones || {})) { const b = q && typeof q === 'object' && q.liveYearKeep ? liveNowYear(m, q) : 0; if (b) liveYearAt(q, b, liveNowText(m, q)); }
    // (year: the year the screen shows, the running clock's. The phone keeps the year of its saved time, one less when the
    // clock has passed New Year since)
    const cross = liveCross(p.now, liveNowText(m, p)), shown = p.year && !p.noYear ? p.year + cross : 0;
    const n = shown ? year - shown : 0;
    if (n) {
        if (m.finance) m.finance = shiftAll(m.finance, n);
        for (const q of Object.values(m.phones || {})) {
            if (!q || typeof q !== 'object') continue;
            for (const k of ['money', 'investment']) if (q[k]) q[k] = shiftAll(q[k], n);
            // (다른 실시간 폰: 연도와, 현실 연도에서 떨어진 햇수도 같이)
            if (q !== p && q.year && !q.noYear) { q.year += n; const off = (Number(q.liveYearShift) || 0) + n; if (off) q.liveYearShift = off; else delete q.liveYearShift; }
            // the copies 되돌리기 and 빼기 compare against move too (else a moved record reads as changed by hand and stays),
            // and 되돌리기 puts back the year it had moved to
            if (q.syncUndo) { q.syncUndo = shiftAll(q.syncUndo, n); if (q.syncUndo.year) q.syncUndo.year += n; }
            if (q.syncUndos) q.syncUndos = q.syncUndos.map(u => { const v = shiftAll(u, n); if (v.year) v.year += n; return v; });
            for (const e of Object.values(q.sync?.events || {})) if (e?.effects) e.effects = shiftAll(e.effects, n);
        }
        // (a phone being made, its year read before and not set by the user: it moves with the rest, and stays moved when its year
        // is worked out again as it is made)
        for (const q of Object.values(m.phonePre || {})) if (q?.year && !q.noYear && !q.yearSet) { q.year += n; q.yearShift = (Number(q.yearShift) || 0) + n; }
        // this browser's record of unsaved rounds (복구) too: 실시간 서랍이 알려 주는 자기 기록만 (폰 1의 기록은 절대 아님)
        try {
            const scope = m.phoneJournal, owners = new Set(Object.values(m.phones || {}).map(q => q?.owner));
            if (typeof scope === 'string' && scope) journalWrite(scope, journalRead(scope).map(r => (owners.has(r.owner) ? { ...r, events: shiftAll(r.events || [], n), life: shiftAll(r.life || [], n), ...(r.year ? { year: r.year + n } : {}) } : r)));
        } catch { /* no journal here */ }
    }
    // (고른 연도는 실시간 시계의 연도에서 떨어진 햇수로 남겨요: 반영이 연도를 다시 맞출 때 지켜지게)
    const real = shown ? shown - (Number(p.liveYearShift) || 0) : baseYear(m, p), off = year - real;
    if (off) p.liveYearShift = off; else delete p.liveYearShift;
    // (this phone's year is the user's now: never worked out again over it)
    p.year = year - cross; p.noYear = false; p.yearSet = true; delete p.yearShift;
    return n;
}
// 화면에 보이는 연도 (달력 · 날짜 표시가 흐르는 시계의 날짜 옆에 쓰는 연도): 흐르는 시계의 연도 + 고른 차이.
// 연도 표시를 끈 폰, 시계를 모르는 서랍, 이야기에서 막 가져와 아직 차이를 안 적은 폰은 폰에 있는 것 그대로
export function liveShownYear(m, p) {
    if (!p || typeof p !== 'object' || p.noYear) return p?.year;
    const base = liveNowYear(m, p);
    if (base && !p.liveYearKeep) return base + (Number(p.liveYearShift) || 0);
    return Number.isInteger(p.year) ? p.year + liveCross(p.now, liveNowText(m, p)) : p.year;
}
// 실시간 폰들의 저장된 연도를 맞춰요 (실시간 화면을 열 때): 연도가 아직 없는 폰, 이야기에서 막 가져온 폰, 전에 시계의
// 연도로 올려 둔 폰. 저장된 시각의 연도로 (시계의 연도 + 고른 차이, 시계가 새해를 넘겼으면 한 해 전).
// 연도 표시를 끈 폰, 시계를 모르는 서랍은 그대로. 바꿨으면 true
export function liveYearsNow(m) {
    need(m);
    let changed = false;
    for (const p of Object.values(m.phones || {})) {
        if (!p || typeof p !== 'object' || !p.owner || p.noYear) continue;
        const base = liveNowYear(m, p);
        if (!base) continue;
        // (the phone keeps the year of its saved time: the clock's year, one less when it has passed New Year since)
        const run = liveNowText(m, p), want = liveYearAt(p, base, run) - liveCross(p.now, run);
        if (p.year !== want) { p.year = want; changed = true; }
    }
    return changed;
}
