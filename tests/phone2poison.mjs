// 폰 2 함정 시험 (docs/PHONE2-PLAN.md 단계 3): with PHONE2_POISON=1, every call a test makes into phonedata.js gets a
// 폰 2 full of marked records put beside its 폰 1 (m.live), and after it: m.live is exactly as it was, nothing marked
// is in 폰 1's data, in what the call gave back, or in anything the tests' fake model was sent (their globals).
// Without the variable it gives the module back as it is. tests/phone2isolation.test.mjs runs the files this way.
const MARK = 'POISON2';
const world = () => ({
    id: `w-${MARK}`, from: 'story', startedAt: 1, dayShift: 0, scope: `${MARK}-scope`, storyUpto: 1, persona: `${MARK}Persona`, lastOwner: `${MARK}Owner`,
    phones: { ren: { owner: 'Ren', now: '10-26 09:00', notes: [{ title: `${MARK} note`, text: `${MARK} secret plan` }], threads: [{ with: 'Mara', messages: [{ from: 'Mara', text: `${MARK} text`, time: '10-26 08:00' }] }],
        calls: [], photos: [{ caption: `${MARK} photo`, time: '10-26 08:30' }], searches: [{ q: `${MARK} search`, time: '10-26 08:40' }], events: [{ title: `${MARK} plan`, date: '10-27' }],
        mails: [{ from: `${MARK} sender`, subject: `${MARK} mail`, text: 'x', time: '10-26 07:00' }], diary: [{ date: '10-26', title: MARK, text: `${MARK} diary` }], contacts: [{ name: `${MARK}Friend` }], posts: [],
        money: { currency: 'KRW', bank: { name: `${MARK} Bank`, accounts: [{ id: 'chk', kind: 'checking', name: MARK, last4: '9999', currency: 'KRW', balance: 999999 }] }, tx: [{ amount: -1, who: MARK }] } } },
    finance: { version: 1, accounts: { [`chk:${MARK}`]: { owner: 'Ren', entries: {} } }, transfers: {}, prices: {}, revisions: [] },
    profiles: { ren: { label: MARK } }, pre: { ivo: { owner: `${MARK}Ivo` } }, lore: [`${MARK}Book`], loreOff: {},
    messenger: { accounts: { ren: { name: 'Ren' } }, rooms: { r1: { id: 'r1', members: [`${MARK}Persona`, 'Ren'], messages: [{ from: 'Ren', text: `${MARK} messenger` }] } } },
    queue: { round: 1, jobs: [{ id: 'j1', world: `w-${MARK}`, round: 1, kind: 'reply', owner: 'Ren', at: 1, state: 'waiting' }] },
});
const live = () => ({ v: 1, mode: 'live', world: world(), archive: [{ ...world(), id: `old-${MARK}`, archivedAt: 1 }] });
const LIVE = JSON.stringify(live());

const isMeta = v => v && typeof v === 'object' && !Array.isArray(v) && Object.hasOwn(v, 'phones');
// quick look first (native JSON); only a hit, or what JSON can't take (cycles), is walked to say where
function marked(v) {
    if (typeof v === 'string') return v.includes(MARK) ? '(value)' : '';
    try { const j = JSON.stringify(v); if (j === undefined || !j.includes(MARK)) return ''; } catch { /* cycles: walk */ }
    return walk(v);
}
// every string reachable (cycles and functions skipped): where a marked one was found, or ''
function walk(v, seen = new Set(), path = '') {
    if (typeof v === 'string') return v.includes(MARK) ? path || '(value)' : '';
    if (!v || typeof v !== 'object' || seen.has(v)) return '';
    seen.add(v);
    // (a 폰 1 meta found along the way: its 폰 2 is where it belongs; the rest is looked at)
    if (metas.has(v)) { const { live: _, ...rest } = v; v = rest; }
    if (v instanceof Map) v = Object.fromEntries(v);
    else if (v instanceof Set) v = [...v];
    for (const [k, x] of Object.entries(v)) {
        if (k.includes(MARK)) return `${path}.${k}`;
        const hit = walk(x, seen, `${path}.${k}`);
        if (hit) return hit;
    }
    return '';
}
const metas = new Set();
// the metas this call was given (each test makes its own), and every global the fake model writes to
function check(name, args) {
    for (const m of args.filter(a => metas.has(a))) {
        if (JSON.stringify(m.live) !== LIVE) throw new Error(`폰 2 함정: ${name} changed m.live`);
        const { live: _, ...rest } = m, hit = marked(rest);
        if (hit) throw new Error(`폰 2 함정: ${name} put 폰 2 into 폰 1 at m${hit}`);
    }
    for (const k of Object.keys(globalThis).filter(k => k.startsWith('__'))) {
        const hit = marked(globalThis[k]);
        if (hit) throw new Error(`폰 2 함정: ${name} sent 폰 2 out (globalThis.${k}${hit})`);
    }
}
function poison(args) {
    for (const a of args) if (isMeta(a)) {
        if (a.live === undefined) a.live = live();
        poisonCount.metas = metas.size + 1;
        metas.add(a);
    }
}
// how much was poisoned and checked, for the run's own report (stderr at exit)
export const poisonCount = { calls: 0, metas: 0 };
export function maybePoison(mod) {
    if (process.env.PHONE2_POISON !== '1') return mod;
    process.once('exit', () => process.stderr.write(`PHONE2_POISON calls=${poisonCount.calls} metas=${metas.size}\n`));
    const out = {};
    for (const [name, f] of Object.entries(mod)) {
        if (typeof f !== 'function' || /^[A-Z]/.test(name)) { out[name] = f; continue; }
        out[name] = function (...args) {
            poisonCount.calls++;
            poison(args);
            const after = r => { const hit = marked(r); if (hit) throw new Error(`폰 2 함정: ${name} gave back 폰 2 (${hit})`); check(name, args); return r; };
            const r = f.apply(this, args);
            return r && typeof r.then === 'function' ? r.then(after, e => { check(name, args); throw e; }) : after(r);
        };
    }
    return out;
}
