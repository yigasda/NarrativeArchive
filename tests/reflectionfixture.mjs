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
    return { ...answer, clock: { basis: 'App test fixture', finalViewpoint: owner, sceneTime: time, messageSender: null } };
}
