// NarrativeArchive's stand-in for the "zod" package (not Marinara code): only the calls schedule.service.js makes.
// z.string().trim().regex(re).min(n).max(n).optional() · z.number().int().min(n) · z.object({ … }) · z.array(item).min(n).refine(fn) · schema.safeParse(value)
const make = (run, optional = false) => ({
    run: v => (v === undefined && optional ? { ok: true, value: undefined } : run(v)),
    trim() { return make(v => { const r = run(v); return r.ok && typeof r.value === 'string' ? { ok: true, value: r.value.trim() } : r; }, optional); },
    regex(re) { return make(v => { const r = run(v); return r.ok && re.test(r.value) ? r : { ok: false }; }, optional); },
    min(n) { return make(v => { const r = run(v); return r.ok && (typeof r.value === 'number' ? r.value : r.value.length) >= n ? r : { ok: false }; }, optional); },
    int() { return make(v => { const r = run(v); return r.ok && Number.isInteger(r.value) ? r : { ok: false }; }, optional); },
    max(n) { return make(v => { const r = run(v); return r.ok && r.value.length <= n ? r : { ok: false }; }, optional); },
    optional() { return make(run, true); },
    refine(fn) { return make(v => { const r = run(v); return r.ok && fn(r.value) ? r : { ok: false }; }, optional); },
    safeParse(v) { const r = this.run(v); return r.ok ? { success: true, data: r.value } : { success: false }; },
});
export const z = {
    string: () => make(v => (typeof v === 'string' ? { ok: true, value: v } : { ok: false })),
    number: () => make(v => (typeof v === 'number' && !Number.isNaN(v) ? { ok: true, value: v } : { ok: false })),
    object: shape => make(v => {
        if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false };
        const out = {};
        for (const [k, s] of Object.entries(shape)) { const r = s.run(v[k]); if (!r.ok) return { ok: false }; if (r.value !== undefined) out[k] = r.value; }
        return { ok: true, value: out };
    }),
    array: item => make(v => {
        if (!Array.isArray(v)) return { ok: false };
        const out = [];
        for (const x of v) { const r = item.run(x); if (!r.ok) return { ok: false }; out.push(r.value); }
        return { ok: true, value: out };
    }),
};
