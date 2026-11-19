// 폰 2(실시간)의 위치 읽기: 누가 어디 있는지 (폰 다시 만들기 · 위치 정보 다시 연동이 써요). phonedata.js의 whereRequest ·
// readWhere · tryWhere · rereadPlaces를 줄 그대로 옮긴 것이고, 다른 곳은 이것뿐이에요.
//   롤플은 실시간 폰을 시작한 곳까지만 읽고, 최근 대화는 메신저 것 (phone2req.js)
//   연도는 실시간 폰의 것 (phone2year.js)
// 폰 1 파일은 여기서 읽기만 해요.
import { ctx, saveMeta } from './core.js';
import { nameKey } from './people.js';
import { resolvePhoneProfile } from './phoneprofile.js';
import { splitTail } from './sections.js';
import { glossaryPeople } from './translate.js';
import { COUNTRY_TZ } from './phonesynclife.js';
import { AI_SYS_WHERE, askDraft, arr, jsonOf, line, str, blindBlock, loreFor, glossAka, glossTwin, isOwnerName, sameName, withTwins, rowForms, personOf, whereOf, namesOf, akaOf, whereRow, cardText, pkey, placeInfo, screenHolderOf, syncLives } from './phonedata.js';
import { liveRecentText, needLive } from './phone2req.js';
import { liveEnsureYear } from './phone2year.js';

function liveWhereRequest(m, p, { known = false } = {}) {
    needLive(m);
    const c = ctx(), g = c.groupId ? (c.groups || []).find(x => x.id === c.groupId) : null;
    const chars = g ? (g.members || []).map(a => (c.characters || []).find(x => x.avatar === a)).filter(Boolean) : [c.characters?.[c.characterId]].filter(Boolean);
    const persona = String(c.powerUserSettings?.persona_description || '').trim(), upto = m.phoneUpto;
    const more = known || p.making ? [...chars.map(ch => ch.name || ch.data?.name), c.name1, screenHolderOf(m), ...glossaryPeople(m)] : [];
    // (each person once: two forms of one name in 용어집, "Ivo" and "이보", are one)
    const seen = [], people = [...(p.threads || []).map(t => t.with), ...(p.contacts || []).map(x => x.name), ...Object.values(m.phones || {}).map(q => q?.owner), ...more]
        .map(n => line(n, 60)).filter(n => n && !isOwnerName(p, m, n) && !seen.some(x => nameKey(x) === nameKey(n) || nameKey(glossTwin(m, x)) === nameKey(n)) && seen.push(n)).slice(0, 16);
    const [, tail] = splitTail(String(m.text || ''));
    return { chars, persona, people, blocks: [
        ...chars.map(ch => `[CHARACTER CARD — ${ch.name || ch.data?.name || ''}]\n${cardText(ch) || '(empty)'}`),
        persona ? `[PERSONA — ${c.name1 || 'user'}]\n${persona}` : '',
        tail.trim() ? `[STORY NOW]\n${tail.trim()}` : '',
        `[RECENT CHAT]\n${liveRecentText(m, p.owner, 8, { upto, maxChars: 8000 }) || '(none yet)'}`,
        `[OWNER]\n${p.owner}`, `[PEOPLE]\n${people.join('\n') || '(none)'}`, blindBlock(m, p.owner),
    ] };
}
export async function liveReadWhere(m, p, opts = {}) {
    const r = liveWhereRequest(m, p, opts), binding = p.financeProfile;
    opts.asked = r.people;
    if (p.making) p.asked = r.people;
    // a profile that is a lorebook entry is the one thing the cards and the persona don't already hold
    const lore = binding?.type === 'lore' ? await resolvePhoneProfile(ctx(), binding).catch(() => null) : null;
    const book = await loreFor(m, p.owner, lore ? binding : null).catch(() => '');
    const input = [...r.blocks.slice(0, -3), lore ? `[OWNER PROFILE — chosen by the user for ${p.owner}]\n${lore.text}` : '', book ? `[LOREBOOK]\n${book}` : '', ...r.blocks.slice(-3)].filter(Boolean).join('\n\n');
    const raw = jsonOf(await askDraft(input, { force: true, system: AI_SYS_WHERE, maxTokens: 4500, effort: 'low' }));
    // the people closest to the owner, as the cards, the persona, the profile and the lorebook tell them (반영 reads these,
    // never the texts themselves); a reading that gives none keeps the ones there
    // (the owner by a name of theirs, as before, or as this reading gives it: their full name in the contacts, "Ren Park",
    // is the owner's aka here, never a person of its own)
    // (never the name of someone else's row there before: "Mara" given as the owner's aka while Mara has a row of her own is
    // hers, and her row and the city set for her stay)
    // (a name the reading gives both as the owner's aka and as a row of its own, "Ren Park": the code doesn't pick one; it stays
    // its own row and the user is asked in 위치 정보 (p.where.ask), unless they answered it before)
    const said = new Set(arr(p.where?.ownerSaid).map(nameKey)), notOwner = new Set(arr(p.where?.notOwner).map(nameKey));
    const oldOthers = new Set((p.where?.people || []).map(r => r?.name).filter(n => n && !isOwnerName(p, m, n)).map(nameKey));
    const ownRead = arr(raw?.people).find(x => nameKey(x?.name) === nameKey(p.owner));
    const readOthers = new Set(arr(raw?.people).map(x => line(x?.name, 60)).filter(n => n && nameKey(n) !== nameKey(p.owner)).map(nameKey));
    const both = akaOf(ownRead || {}).filter(a => readOthers.has(nameKey(a)) && !said.has(nameKey(a)) && !notOwner.has(nameKey(a)) && !oldOthers.has(nameKey(a)));
    const ownAka = new Set([...withTwins(m, akaOf(ownRead || {})).map(nameKey).filter(k => !oldOthers.has(k) && !notOwner.has(k) && (!readOthers.has(k) || said.has(k))), ...said]);
    const isOwn = n => isOwnerName(p, m, n) || withTwins(m, [n]).some(x => ownAka.has(nameKey(x)));
    const around = arr(raw?.around).map(x => ({ name: line(x?.name, 60), aka: akaOf(x), about: str(x?.about, 1600) })).filter(x => x.name && x.about && !isOwn(x.name)).slice(0, 5);
    if (around.length) p.around = { at: Date.now(), people: around };
    // (a phone being made: the story's year as the reading tells it, for its year before a guess from the dates)
    const y = Number(raw?.year);
    if (p.making) { if (Number.isInteger(y) && y >= 1900 && y <= 2100) p.readYear = y; else delete p.readYear; }
    const known = [p.owner, ...r.people];
    // (someone the user took off stays off; what the user set by hand stays as they set it)
    // (by any form of their name: one taken off as "Ivo" stays off as "이보"; one set by hand as "Ivo" stays so as "이보")
    const removed = new Set(p.where?.removed || []), formsOf = x => withTwins(m, [x.name, ...arr(x.aka)]).map(nameKey), gone = x => formsOf(x).some(k => removed.has(k));
    const olds = p.where?.people || [], strong = x => withTwins(m, [x.name]).map(nameKey);
    const shared = x => !olds.some(o => strong(o).some(k => strong(x).includes(k))) && olds.filter(o => formsOf(o).some(k => strong(x).includes(k))).length > 1;
    // (the owner's row is only the owner's: never someone else's old row, nor theirs the owner's)
    // (nor the row of someone this reading reads apart: "Mara Kim" is never Mara's old row while Mara is read too)
    const oldRow = x => {
        const ks = formsOf(x), mine = r => isOwn(r.name) === isOwn(x.name) && !(readNames.has(nameKey(r.name)) && nameKey(r.name) !== nameKey(x.name));
        const rows = (p.where?.people || []).filter(mine);
        return rows.find(r => nameKey(r.name) === nameKey(x.name)) || (hits => (hits.length === 1 ? hits[0] : null))(rows.filter(r => rowForms(m, r).some(k => ks.includes(k)))) || (r => (r && mine(r) ? r : null))(whereOf(p, x.name));
    };
    // (a row by the other form of a name asked about, "이보" for "Ivo", is that person's; and it keeps that form as a name of theirs)
    // (an aka the reading gives that is the owner's name, on someone else ("Ren" for Ren Kim), or the name of another row it
    // reads ("Mara" for Mara Kim, with a Mara of her own), is no name of theirs: never a way to someone else's row)
    const readNames = new Set(arr(raw?.people).map(x => nameKey(line(x?.name, 60))).filter(Boolean));
    // (the owner's own aka as the reading gives it stays theirs: "Ren Park" read as a row too is the owner's)
    const ownAkaOnly = x => ({ ...x, ...(arr(x.aka).length ? { aka: arr(x.aka).filter(a => isOwn(x.name) && ownAka.has(nameKey(a)) || !readNames.has(nameKey(a)) && (isOwn(x.name) || !isOwn(a))) } : {}) });
    const used = new Set();
    const read = arr(raw?.people).map(whereRow).map(ownAkaOnly).filter(x => x.name && !said.has(nameKey(x.name)) && known.some(k => nameKey(k) === nameKey(x.name) || nameKey(glossTwin(m, k)) === nameKey(x.name)) && !gone(x) && (x.tz || COUNTRY_TZ[x.lives]))
        // (the owner read by another name of theirs, "렌" for Ren: their row, by the owner's name, that one kept as an aka)
        .map(x => (nameKey(x.name) !== nameKey(p.owner) && isOwn(x.name) ? { ...x, name: p.owner, aka: [...new Set([x.name, ...arr(x.aka)])].filter(a => nameKey(a) !== nameKey(p.owner)).slice(0, 6), byOther: true } : x))
        // (the row read by the owner's own name first: one by another name of theirs only when there is none)
        .sort((a, b) => Number(!!a.byOther) - Number(!!b.byOther))
        .filter((x, i, all) => all.findIndex(y => nameKey(y.name) === nameKey(x.name)) === i)
        .map(({ byOther, ...x }) => x)
        // (one set by hand, "Mara Lee", read now by a shorter name of hers, "Mara": her row, by the name it had, the shorter one an
        // aka; never a second row of her)
        .map(x => { const o = oldRow(x); if (!o?.manual) return x; used.add(o); const longer = !isOwn(x.name) && nameKey(o.name) !== nameKey(x.name) && String(o.name).length > String(x.name).length;
            return { ...x, ...(longer ? { name: o.name, aka: [...new Set([x.name, ...arr(x.aka)])].filter(a => nameKey(a) !== nameKey(o.name)).slice(0, 6) } : {}), ...(o.manual.city ? { city: o.city, names: namesOf(o), tz: o.tz, in: o.in } : {}), ...(o.manual.lives ? { lives: o.lives } : {}), manual: o.manual }; })
        // (a name that is only an aka two rows share, "Ivo" of Ivo Kim and Ivo Park, is neither of them: left out)
        .filter(x => !shared(x));
    // one person by two names ("Somang Park" in the contacts, "Somang" in a thread) in the same city: once, by the longer
    // name. In two cities they are two people (two named alike) and both stay
    const here = (a, b) => sameName(m, a.name, b.name) && nameKey(a.name) !== nameKey(b.name) && isOwn(a.name) === isOwn(b.name) && pkey(a.city) === pkey(b.city) && (a.tz || '') === (b.tz || '');
    // (two forms the same length, "Yu" and "유우": the one first in order stays)
    const longer = (y, x) => String(y.name).length > String(x.name).length || String(y.name).length === String(x.name).length && nameKey(y.name) < nameKey(x.name);
    const twin = x => read.some(y => here(x, y) && longer(y, x));
    const got = read.filter(x => !twin(x)).slice(0, 16).map(x => { const more = read.filter(y => here(y, x) && twin(y)).flatMap(y => [y.name, ...arr(y.aka)]).filter(n => nameKey(n) !== nameKey(x.name)); return more.length ? { ...x, aka: [...new Set([...arr(x.aka), ...more])].slice(0, 6) } : x; }),
        merged = read.filter(twin).map(x => nameKey(x.name));
    // (an old row of a person read now by another form of their name is that person's: one row, its names kept)
    // (by a row's own name or its 용어집 form, never an aka alone: "Ivo" an aka of both Ivo Kim and Ivo Park is neither)
    const samePersonRow = (o, x) => isOwn(o.name) === isOwn(x.name) && (strong(o).some(k => formsOf(x).includes(k)) || strong(x).some(k => formsOf(o).includes(k)) && olds.filter(r => formsOf(r).some(k => strong(x).includes(k))).length === 1);
    // (read again: the names a person's row had before stay theirs, by the same name too, "Ren Park" the owner's; never a
    // name that is now another row's own, nor the owner's on someone else)
    const gotNames = new Set(got.map(x => nameKey(x.name)));
    // (전부 새로: none of them, the reading's names only)
    for (const x of opts.all ? [] : got) for (const o of p.where?.people || []) {
        const same = nameKey(o.name) === nameKey(x.name);
        if (!same && !samePersonRow(o, x)) continue;
        const more = [...(same ? [] : [o.name]), ...arr(o.aka)].filter(n => nameKey(n) !== nameKey(x.name) && !(gotNames.has(nameKey(n)) && nameKey(n) !== nameKey(o.name)) && (isOwn(x.name) || !isOwn(n)));
        if (more.length) x.aka = [...new Set([...arr(x.aka), ...more])].filter(n => nameKey(n) !== nameKey(x.name)).slice(0, 8);
        if (same && arr(o.glossAka).length) x.glossAka = [...new Set([...arr(x.glossAka), ...arr(o.glossAka)])];
    }
    // read again: someone it leaves out keeps what was read before
    const people = [...got, ...(p.where?.people || []).filter(o => !used.has(o) && !got.some(x => nameKey(x.name) === nameKey(o.name) || samePersonRow(o, x)) && !merged.includes(nameKey(o.name)) && !got.some(x => here(o, x) && longer(x, o))).map(o => ({ ...o, names: namesOf(o) }))].slice(0, 16);
    // (the user's answers to "is this the owner?" stay; a name still unanswered is asked once)
    const ask = [...new Set([...arr(p.where?.ask), ...both])].filter(n => !said.has(nameKey(n)) && !notOwner.has(nameKey(n)) && people.some(r => nameKey(r.name) === nameKey(n)));
    p.where = { at: Date.now(), people, ...(removed.size ? { removed: [...removed] } : {}), ...(said.size ? { ownerSaid: arr(p.where?.ownerSaid) } : {}), ...(notOwner.size ? { notOwner: arr(p.where?.notOwner) } : {}), ...(ask.length ? { ask } : {}) };
    glossAka(m, p);
    // (PEOPLE AROUND by the name 위치 정보 has for them: one person, one name, on the map and in the texts alike)
    // (two entries that turn out one person: the first, with the other's names)
    if (p.around?.people) {
        const out = [];
        for (const x0 of p.around.people) {
            const who = personOf(p, m, x0.name), x = !who || nameKey(who.name) === nameKey(x0.name) ? x0 : { ...x0, name: who.name, aka: [...new Set([...arr(x0.aka), x0.name])].filter(a => nameKey(a) !== nameKey(who.name)).slice(0, 6) };
            const had = out.find(y => nameKey(y.name) === nameKey(x.name));
            if (had) had.aka = [...new Set([...arr(had.aka), ...arr(x.aka)])].filter(a => nameKey(a) !== nameKey(had.name)).slice(0, 6); else out.push(x);
        }
        p.around.people = out;
    }
    syncLives(p);
    return people;
}
export const liveTryWhere = async (m, p, opts = {}) => { try { await liveReadWhere(m, p, opts); } catch (err) { console.warn('[narrative-archive] where', err); p.where = { ...(p.where || { at: Date.now(), people: [] }), failed: true }; } };
export async function liveRereadPlaces(m, p, { all = false } = {}) {
    needLive(m);
    const was = structuredClone({ where: p.where ?? null, lives: p.lives, livesManual: p.livesManual });
    if (all && p.where) { p.where = { ...p.where, people: (p.where.people || []).map(({ manual, ...x }) => x) }; delete p.where.removed; delete p.where.ownerSaid; delete p.where.notOwner; delete p.where.ask; delete p.livesManual; }
    try { await liveReadWhere(m, p, { all }); }
    catch (err) { p.where = was.where ?? undefined; if (!was.where) delete p.where; p.lives = was.lives; if (was.livesManual) p.livesManual = true; throw err; }
    // (a phone not made yet: its year read again with it, unless the user or the old phone set it)
    if (p.making && !p.yearSet && !p.base) { delete p.year; delete p.noYear; liveEnsureYear(m, p); }
    await saveMeta();
    return placeInfo(p);
}
