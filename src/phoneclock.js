// Optional dates for bare HTML clocks. These are fallbacks, never evidence of a story's date.
// Full years stay inside the calculation so New Year and daylight-saving changes do not borrow another year's rules.
const pad = n => String(n).padStart(2, '0');
const short = d => `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
const formatter = tz => {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    return at => {
        const parts = f.formatToParts(new Date(at)), get = k => Number(parts.find(x => x.type === k)?.value);
        return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
    };
};
// A local wall clock may not exist (spring jump), or name two instants (autumn fold).
// Only one exact round trip is useful for a supplementary hint; omit the ambiguous cases.
const instant = (wall, local) => {
    const offsets = new Set([-36, 0, 36].map(h => { const at = wall + h * 36e5; return local(at) - at; }));
    const hits = [...offsets].map(offset => wall - offset).filter(at => local(at) === wall);
    return hits.length === 1 ? hits[0] : null;
};
export function clockFallback(p, ownerZone, screenZone, clock) {
    const year = Number(p?.year), saved = /^(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(String(p?.now || ''));
    const hm = /^(\d{2}):(\d{2})$/.exec(String(clock || ''));
    if (p?.noYear || !Number.isInteger(year) || year < 1900 || year > 2100 || !saved || !hm || !ownerZone || !screenZone) return null;
    const [mo, day, hour, min] = saved.slice(1).map(Number), [h, m] = hm.slice(1).map(Number);
    if (hour > 23 || min > 59 || h > 23 || m > 59) return null;
    const wall = Date.UTC(year, mo - 1, day, hour, min), date = new Date(wall);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== day) return null;
    try {
        const owner = formatter(ownerZone), screen = formatter(screenZone), at = instant(wall, owner);
        if (at === null) return null;
        const localNow = new Date(screen(at)), rolled = clock < short(localNow).slice(6);
        const local = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() + Number(rolled), h, m));
        const target = instant(local.getTime(), screen);
        if (target === null) return null;
        const out = new Date(owner(target));
        return { local: short(local), localYear: local.getUTCFullYear(), ownerTime: short(out), ownerYear: out.getUTCFullYear(),
            assumedDate: local.toISOString().slice(0, 10), rolled, anchor: `${year}-${p.now}`, localAnchor: `${localNow.getUTCFullYear()}-${short(localNow)}` };
    } catch { return null; }
}
