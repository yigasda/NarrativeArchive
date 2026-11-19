// 폰 2(실시간)의 폰 다시 만들기 (폰 전체 · 고른 앱). phonedata.js의 makePhone · makePhone0 · phoneRequest · keepPre · preClock을
// 줄 그대로 옮긴 것이고, 다른 곳은 이것뿐이에요.
//   읽는 범위 · 읽은 자리 · 두 번째 차례: 실시간 것 (phone2req.js). 롤플은 시작한 곳까지만, 읽은 자리는 메신저 번호
//   실시간 폰은 늘 읽은 자리를 지키며 다시 만들어요: 메신저 읽은 자리 · 폰 시각 · 고른 연도 · 상황(situations)이 그대로
//   복구 기록은 실시간 서랍의 것만 (폰 1의 기록은 안 건드려요)
//   위치 읽기 · 연도: 실시간 것 (phone2where.js · phone2year.js). 롤플 상태창의 연도 · 시각은 안 읽어요
//   요청의 OWNER'S CLOCK: 서랍의 흐르는 시계로, 롤플 상태창 · 롤플 메시지 없이
//   반영(update)은 여기서 안 해요: 실시간 폰의 반영은 메신저를 나갈 때 따로 돌아요
// 폰 1 파일은 여기서 읽기만 해요.
import { ownerProfileBlock } from './phoneprofile.js';
import { ctx, saveMeta } from './core.js';
import { applyInjection } from './inject.js';
import { nameKey } from './people.js';
import { parseSections, splitTail } from './sections.js';
import { worldText } from './world.js';
import { withDateOrder, withDateOrderSync } from './phoneparse.js';
import { busy, newSync, journalRead, journalWrite } from './phonesync.js';
import { askDraft, AI_SYS_PHONE, AI_SYS_PHONE_APPS, AI_SYS_PHONE_UPDATE, CHAT_TOKENS, CAP, COUNTRIES, LISTS, REMAKE, makingNow, dateOrderOf, ensureScreenHolder, storyRun, stillRun,
    markNow, markAfter, archiveEnd, chatEnd, nowAt, phoneAt, loreFor, glossAka, seedPre, carryEdits, phonePre, sameBinding, preEdited, stTime, storyDayOf, todayWall, parsePhone, validateReflectionClock,
    jsonOf, soFarHead, mergePhone, carryOver, secFirst, secEnd, lastEnd, fresh, ensureIds, turnsNote, readNote, isOwnerName, strictSame, hasRow, hm, recentPhoneText, archiveFor, archiveBlock, afterBlock,
    noArchive, phoneForModel, aroundBlock, blindBlock, namesBlock, onlyAsk } from './phonedata.js';
import { liveWindowOf, liveReadMark, liveSecondTurn, liveFillClock, liveYearBlock, needLive } from './phone2req.js';
import { liveTryWhere } from './phone2where.js';
import { liveEnsureYear } from './phone2year.js';
import { liveNowText } from './phone2store.js';

// 요청 글
function livePhoneRequest(m, owner, p = null, lore = '', only = null, profile = '', gap = null, extra = [], pre = null, { anew = false } = {}) {
    // (made again keeping its reading, a phone with no 위치 정보 read before it: its own time still)
    const cur0 = m.phones?.[nameKey(owner)], q0 = p || (pre ? (!anew && cur0?.now ? { ...pre, now: cur0.now } : pre) : cur0) || { owner }, q = anew && q0.now ? { ...q0, now: '' } : q0;
    const world = worldText(m), upto = nowAt(gap);
    const recent = recentPhoneText(6, { upto, maxChars: 6000 });
    const ar = archiveFor(m, p ? p.upto ?? -1 : -1, nowAt(gap), !gap?.cut);
    const now = p ? JSON.stringify(phoneForModel(p)) : '';
    return [
        p ? `[PHONE NOW]\n${now}` : '', ((at, st) => {
            // (a phone being made has no time yet: its newest status line's, as a reflection's; else today's, for the hours alone)
            // (no time, but a day the story is on: its hours that day, its summer-time changes near it; no day either:
            // today's hours, with every change in the year, so the hours the answer's own day has are there too)
            // (the newest status line's time on the owner's clock, as the reading up to a message has it)
            const t = at === undefined ? q.now : at, story = hm(t) ? t : stTime(st), day = story ? '' : storyDayOf(m, upto, st);
            return liveFillClock(m, q, story || (day ? `${day} 12:00` : todayWall()), { story: true, quiet: story ? false : day ? 'day' : true });
        })(upto == null ? undefined : liveNowText(m, q) || undefined, null),
        !p && m.phones?.[nameKey(owner)]?.device ? `[DEVICE — locked]\n${JSON.stringify(m.phones[nameKey(owner)].device)}` : '',
        archiveBlock(m, ar.text || '(nothing new)', `ARCHIVE${p ? ' — the sections since PHONE NOW' : ''}`, CHAT_TOKENS.phone, upto),
        world ? `[WORLD]\n${world}` : '',
        lore ? `[LOREBOOK]\n${lore}` : '',
        aroundBlock(q),
        // (폰 2: after the story it began from, the messenger's talk its reflection has read — the summaries of the old
        // talk, then the lines — so a phone or an app made again holds what was said there too)
        ((story, talk) => (talk ? (story ? `${story}\n\n${talk}` : `[RECENT CHAT]\n${talk}`) : story))(afterBlock(gap) || (recent && !noArchive(m) ? `[RECENT CHAT]\n${recent}` : ''),
            typeof m?.phoneRecent === 'function' && Number.isInteger(gap?.mark) ? m.phoneRecent(owner, 150, { maxChars: 12000, seen: gap.mark, summary: true }) : ''),
        liveYearBlock(m, q),
        `[OWNER]\n${owner}`,
        profile, blindBlock(m, owner),
        namesBlock(m),
        ...extra,
        only ? onlyAsk(only) : '',
    ].filter(Boolean).join('\n\n');
}
// 폰 만들기 준비 값 (위치 정보가 없던 폰을 통째로 다시 만들 때)
const livePreClock = (m, pre) => { const upto = nowAt(liveWindowOf(m, null)), st = null, t = stTime(st); if (t) return t; const day = storyDayOf(m, upto, st); return day ? `${day} 12:00` : ''; };
function liveKeepPre(m, owner, binding) {
    const kept = phonePre(m, owner), base = !!m?.phones?.[nameKey(owner)];
    if (!kept) return null;
    if (sameBinding(kept, binding, m)) return kept;
    if (!!kept.base !== base && preEdited(kept) && sameBinding({ ...kept, base }, binding, m)) {
        // (a year that came from the phone gone since, not the user's: worked out again for this one)
        if (kept.base && !kept.yearSet) { delete kept.year; delete kept.noYear; liveEnsureYear(m, kept); }
        kept.base = base;
        return kept;
    }
    return null;
}
// 다시 만들기: 같은 폰을 두 번 만들지 않게 (만드는 중 표시는 폰 1과 같은 곳에 적어요: 화면이 그걸 봐요)
export function liveMakePhone(m, owner, opts = {}) {
    if (opts.update && m?.phones?.[nameKey(owner)]) return withDateOrder(dateOrderOf(m), () => liveMakePhone0(m, owner, opts));
    const key = nameKey(owner), set = m && typeof m === 'object' ? (makingNow.get(m) || makingNow.set(m, new Set()).get(m)) : null;
    if (set?.has(key)) return Promise.reject(new Error('이 폰을 만드는 중이에요. 끝날 때까지 기다려 주세요'));
    set?.add(key);
    return Promise.resolve().then(() => withDateOrder(dateOrderOf(m), () => liveMakePhone0(m, owner, opts))).finally(() => set?.delete(key));
}
async function liveMakePhone0(m, owner, { update = false, apps = null } = {}) {
    needLive(m);
    const run = storyRun(m);
    await ensureScreenHolder(m);
    const key = nameKey(owner);
    if (update) throw new Error('실시간 폰은 메신저를 나갈 때 반영해요');
    if (busy.sync || busy.fill) throw new Error('다른 폰 작업이 끝난 뒤 다시 해 주세요');
    // reading starts after the last message there was when this was asked; what comes in while it writes stays unread
    // (or, with more after the archive than one request reads, after the last message it read: the reflection goes on from there)
    // made again with its reading kept (some apps, or a phone whose bank or life apps stay): up to the phone's clock, like
    // a fill; made anew: up to now, and that becomes its clock
    // (폰 2, a phone it already has: always with its reading kept — it is made again from the story it began from and the
    // messenger talk read so far)
    const cur = m.phones?.[key], keep = !!(apps && cur) || !!cur?.sync?.marks?.base;
    const gap = keep ? liveWindowOf(m, cur, null, CHAT_TOKENS.phone, false) : liveWindowOf(m, null);
    // nothing shown after the archive (all of it archived and hidden): it read up to the archive's end, not -1 (no further
    // than the chat's last message: an archive longer than the chat leaves the messages written after for the reflection)
    const mark = liveReadMark(gap) || (n => (a => (n.index < a ? markAfter(a) : n))(Math.min(archiveEnd(m), chatEnd())))(markNow());
    const old = update ? m.phones?.[key] : null;
    const part = apps && m.phones?.[key] ? apps.flatMap(a => REMAKE[a] || []) : null;
    const binding=structuredClone(m.phones?.[key]?.financeProfile || m.phoneProfiles?.[key]);
    const lore = await loreFor(m, owner, binding?.type === 'lore' ? binding : null), profile = await ownerProfileBlock(ctx(), binding, owner);
    // a phone made for the first time (no reading of where everyone is): that reading first, so its OWNER'S CLOCK has the
    // hours and the time choices and its check knows the places, as a reflection's does (and PEOPLE AROUND goes along):
    // the one the user checked in 위치 정보 (preparePhone), else read now; its year too, from the start
    const firstMade = !part && !old && !cur?.where, kept = firstMade ? liveKeepPre(m, owner, binding) : null, asked = {};
    let pre = null;
    if (cur) glossAka(m, cur);
    if (kept) {
        pre = structuredClone(kept); glossAka(m, pre); asked.asked = kept.asked || [];
        // (a year read before, not set by the user nor taken from an old phone: worked out again now, a status line that
        // has crossed New Year since goes)
        pre.clockAt = livePreClock(m, pre);
        if (!pre.yearSet && !pre.base) { delete pre.year; delete pre.noYear; liveEnsureYear(m, pre); }
        // (a reading that failed is read again: what the user set by hand, and who they took off, stay)
        if (pre.where?.failed) {
            delete pre.where.failed; asked.known = true; await liveTryWhere(m, pre, asked); pre.asked = asked.asked || [];
            // (a year guessed while the reading had failed is worked out again; one the user or the old phone set stays)
            pre.clockAt = livePreClock(m, pre);
            if (!pre.yearSet && !pre.base) { delete pre.year; delete pre.noYear; liveEnsureYear(m, pre); }
            stillRun(m, run); m.phonePre[key] = structuredClone(pre); await saveMeta();
        }
    } else if (firstMade) {
        pre = carryEdits(seedPre(m, owner, binding), phonePre(m, owner)); asked.known = true; await liveTryWhere(m, pre, asked); pre.clockAt = livePreClock(m, pre); liveEnsureYear(m, pre);
        // (kept as preparePhone keeps it: a make asked again, after a clock check it didn't pass, reads none of it again)
        stillRun(m, run); pre.asked = asked.asked || []; (m.phonePre ||= {})[key] = structuredClone(pre); await saveMeta();
    }
    // (made anew, up to now: an old phone's saved time is no time of the story's now; made again with its reading kept, it
    // reads up to that time and goes by it)
    const anew = !part && !old && !keep;
    const ask = (g, extra = []) => askDraft(livePhoneRequest(m, owner, old, lore, part, profile, g, extra, pre, { anew }), { force: true, system: old ? AI_SYS_PHONE_UPDATE : part ? AI_SYS_PHONE_APPS : AI_SYS_PHONE, maxTokens: 32000 });
    const out = await ask(gap), got = parsePhone(out, owner);
    // a phone made sets its clock as a reflection does, by the same check, and like a reflection is not saved when it
    // doesn't hold (never asked again on its own)
    if (!part && !old) {
        const q = pre ? (!anew && cur?.now ? { ...pre, now: cur.now } : pre) : cur || { owner };
        // (by what the request showed: an owner the reading placed nowhere is checked by no zone; the answer's country is
        // where they live, and they may be away, so 위치 정보 asks the user where they are)
        withDateOrderSync(dateOrderOf(m), () => validateReflectionClock(jsonOf(out, { salvage: true }) || {}, anew ? { ...q, now: '' } : q, m, got.now));
    }
    // made again up to the clock and stopped short: a second turn adds the rest (one that fails keeps the first)
    const two = keep && !old ? liveSecondTurn(m, cur, gap, false) : null;
    let got2 = null, last = gap, short = null;
    if (two) {
        try {
            const was = jsonOf(out, { salvage: true }), soFar = part && was ? Object.fromEntries(part.filter(k => was[k] !== undefined).map(k => [k, was[k]])) : was;
            const out2 = await ask(two.cover, [`${soFarHead('PHONE', two.short)}\n${JSON.stringify(soFar)}`, two.short?.text || '']), g2 = parsePhone(out2, owner);
            // (made again whole: its clock checked as the first turn's; one that doesn't hold is left out, the first kept)
            // (a second answer with no "now" leaves the clock as the first set it: nothing to check)
            if (!part && g2.now) { const q = pre ? (!anew && cur?.now ? { ...pre, now: cur.now } : pre) : cur || { owner }; withDateOrderSync(dateOrderOf(m), () => validateReflectionClock(jsonOf(out2, { salvage: true }) || {}, q, m, g2.now)); }
            got2 = g2; last = two.cover; short = two.short;
        } catch (err) { console.warn('[narrative-archive] phone, second turn', err); }
    }
    if(JSON.stringify(binding)!==JSON.stringify(m.phones?.[key]?.financeProfile || m.phoneProfiles?.[key])) throw new Error('생성 중 연결한 인물 정보가 변경됐어요. 다시 시도해 주세요');
    stillRun(m, run);
    m.phones = m.phones && typeof m.phones === 'object' ? m.phones : {};
    if (part) {
        const p = m.phones[key];
        const was = Object.fromEntries(part.map(k => [k, p[k]]));
        for (const k of part) p[k] = k === 'profile' ? (got.profile || p.profile) : [];
        const only = g => ({ ...g, ...Object.fromEntries([...LISTS, 'threads', 'contacts'].filter(k => !part.includes(k)).map(k => [k, []])), now: '' });
        mergePhone(p, { ...only(got), profile: null }, { m });
        if (got2) mergePhone(p, { ...only(got2), profile: part.includes('profile') ? got2.profile : null }, { m });
        for (const k of part) if (k !== 'profile') carryOver(k, was[k], p[k]);
        // an archive section that runs past the clock isn't sent (it would tell what comes after), and its messages are
        // hidden: what a reflection put in from them, up to the clock, the remake never saw, so it stays
        const clock = phoneAt(p), [body] = splitTail(String(m.text || ''));
        const unseen = Number.isInteger(clock) ? parseSections(body).filter(s => !s.group && secFirst(s) <= clock && secEnd(s) > clock).map(s => [secFirst(s), clock]) : [];
        const inUnseen = i => Number.isInteger(i) && unseen.some(([a, b]) => i >= a && i <= b);
        if (unseen.length) for (const k of part) if (LISTS.includes(k)) p[k] = [...p[k], ...fresh(k, p[k], (was[k] || []).filter(x => x.froms?.length ? x.froms.every(f => inUnseen(f.at)) : !!x.ev && inUnseen(p.sync?.events?.[x.ev]?.at)))].slice(-CAP[k]);
        // the last round's 되돌리기 would put back the old app's records: no more
        delete p.syncUndo; delete p.syncUndos;
        ensureIds(p);
        p.at = Date.now();
        await saveMeta();
        if (p.inject) applyInjection();
        turnsNote(last, '앱', short);
        return p;
    }
    if (old) mergePhone(old, got, { m });
    else {
        const was = m.phones[key];
        const base = { owner, inject: false, ...got, wall: got.wall || 'dusk', accent: got.accent || 'blue', country: got.country || 'KR', threads: [], contacts: [], ...Object.fromEntries(LISTS.map(k => [k, []])) };
        if (was?.device) base.device = structuredClone(was.device);
        if (was?.theme) base.theme = was.theme;
        if (was?.wealthPlan) base.wealthPlan = structuredClone(was.wealthPlan);
        if (was?.money) base.money = was.money;
        if (was?.investment) base.investment = was.investment;
        // the apps filled on their own (clock · health · files · weather, delivery) stay like the bank, and so does what the
        // owner set: the year, hidden contacts and places, where they live, the voice table and languages (말투)
        for (const k of ['life', 'delivery', 'voiceAt', 'year', 'noYear', 'yearSet', 'yearShift', 'hiddenContacts', 'hiddenPlaces', 'homeHoods', 'lives', 'livesManual', 'where', 'around', 'koVoice', 'koVoiceAsked', 'koVoiceV', 'langs']) if (was?.[k] !== undefined) base[k] = was[k];
        // (made for the first time: where everyone is and PEOPLE AROUND, as read before it)
        if (pre) for (const k of ['where', 'around', 'lives', 'livesManual', 'year', 'noYear', 'yearSet', 'yearShift']) if (pre[k] !== undefined) base[k] = structuredClone(pre[k]);
        // (the phone is set to the country its owner lives in, as read and checked, over the one the answer gave)
        if (pre?.lives && COUNTRIES[pre.lives]) base.country = pre.lives;
        if (binding) base.financeProfile = structuredClone(binding);
        // the phone's own apps start reading again from here. With a bank, investments or the everyday apps kept (they
        // weren't made again), the reading state stays as it was: messages they haven't read yet are still theirs to read
        // (the phone's own items from those messages are told apart by their words, so nothing doubles)
        // (폰 2, a phone it already has made again: its reading of the messenger goes on where it was — the request showed
        // the talk read so far — and its clock, the year the user picked and where things stand stay its own)
        const liveAgain = !!was?.sync?.marks?.base;
        // (the unsaved rounds are under the meta's own key: 폰 2's drawer names its own, so 폰 1's are never touched)
        const scope = m.phoneJournal;
        if (liveAgain) base.sync = was.sync;
        else {
            base.sync = newSync(scope); base.sync.marks.base = mark;
            // a reading started anew: the old one's unsaved rounds (복구) aren't this phone's
            try { journalWrite(scope, journalRead(scope).filter(r => nameKey(r.owner) !== key)); } catch { /* no journal here */ }
        }
        if (liveAgain) { for (const k of ['liveYearShift', 'situations', 'liveHeld']) if (was[k] !== undefined) base[k] = was[k]; if (was.now) { got.now = was.now; if (got2) got2.now = ''; } }
        m.phones[key] = mergePhone(base, got, { m });
        if (got2) mergePhone(m.phones[key], got2, { m });
    }
    const p = m.phones[key];
    // (made whole: what was read before it for this owner is done with, whichever way it was made)
    if (m.phonePre?.[key]) { delete m.phonePre[key]; if (!Object.keys(m.phonePre).length) delete m.phonePre; }
    liveEnsureYear(m, p);
    if(m.phoneProfiles) delete m.phoneProfiles[key];
    ensureIds(p);
    p.upto = lastEnd(m);
    p.at = Date.now();
    await saveMeta();
    if (p.inject) applyInjection();
    if (two) turnsNote(last, '폰', short); else readNote(gap);
    // made for the first time: read again only for someone on it the reading before didn't ask about; made again: as before
    // (a reading that failed before it is not asked again: the clock goes by the phones and the countries, as for a reflection)
    const later = pre?.where?.failed ? [] : pre ? [...p.threads.map(t => t.with), ...p.contacts.map(x => x.name)].filter(n => n && !isOwnerName(p, m, n) && !(asked.asked || []).some(a => strictSame(m, a, n)) && !hasRow(p, m, n)) : null;
    if (!later || later.length) await liveTryWhere(m, p);
    await saveMeta();
    return p;
}
