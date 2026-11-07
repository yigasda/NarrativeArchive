// Unrelated app tests omit clock metadata. Give those fixtures a valid owner-local clock;
// explicit clock objects and raw JSON strings stay untouched so schema tests exercise real failures.
import { when, hhmm } from '../src/phoneparse.js';
export function reflectionFixture(answer, input) {
    if (!answer || typeof answer !== 'object' || !Array.isArray(answer.events) || Object.hasOwn(answer, 'clock')) return answer;
    const owner = /\[OWNER\]\n([^\n]+)/.exec(input)?.[1] || 'Ren';
    let time = when(answer.now);
    if (/^\d{2}-\d{2}$/.test(time)) {
        const events = answer.events.filter(e => when(e?.date).slice(0, 5) === time).map(e => hhmm(e?.time)).filter(Boolean).sort();
        const phone = /\[PHONE NOW\]\n([^\n]+)/.exec(input)?.[1];
        const saved = phone ? JSON.parse(phone).now : '';
        time += ' ' + (events.at(-1) || (String(saved).slice(0, 5) === time ? String(saved).slice(6) : '') || '12:00');
    }
    return { ...answer, clock: { basis: 'App test fixture', finalViewpoint: owner, elapsedTime: null, sceneTime: time, messageSender: null } };
}
// The same for making a phone (its prompt has CLOCK FIRST since 3.171.88): an answer with no "clock" gets the owner's
// own, at its "now" (or the test's usual moment). A raw answer that isn't JSON, or one with a clock, stays as it is.
export function phoneMadeFixture(out, input, system) {
    if (typeof out !== 'string' || !String(system || '').includes('CLOCK FIRST') || String(system).includes('STAGE: core') || !String(system).startsWith('GOAL\nShow what one character')) return out;
    let o; try { o = JSON.parse(out); } catch { return out; }
    if (!o || typeof o !== 'object' || Array.isArray(o) || Object.hasOwn(o, 'clock')) return out;
    const owner = /\[OWNER\]\n([^\n]+)/.exec(input)?.[1] || 'Ren', now = /^\d{2}-\d{2} \d{2}:\d{2}$/.test(when(o.now)) ? when(o.now) : '10-26 12:00';
    return JSON.stringify({ ...o, now, clock: { basis: 'App test fixture', finalViewpoint: owner, elapsedTime: null, sceneTime: now, messageSender: null } });
}
