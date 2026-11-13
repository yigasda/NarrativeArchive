// 폰 2 반영 (docs/PHONE2-PLAN.md 단계 7-4): 메신저 대화와 주인이 답하며 폰으로 한 일을 주인의 폰 2에 반영해요.
//
// 폰 1 반영(phonedata.js updatePhone)의 지휘 부분을 옮긴 것이에요. 순서는 같고(core 요청 → 답을 폰에 → money 단계 → 읽음
// 표시 · 시계 · 되돌리기 · 복구 기록), 실제 일을 하는 함수(기록 합치기, 은행 장부, 생활 앱, 지시문)는 폰 1 것을 그대로
// 불러요. 다른 건 읽는 곳과 시계뿐이에요:
//   - 읽는 것: 롤플 채팅이 아니라 메신저(phone2feed.js). 메시지 번호는 메신저의 세계 번호(이야기의 마지막 번호 다음부터).
//     아카이브 · 상태창 · 이야기의 지금 상태는 안 읽어요. 메신저 메시지는 고치거나 지울 수 없어서, 바뀐 대화 다시 읽기도 없어요.
//   - 시계: 모델이 정하지 않아요. 그 구간 마지막 메시지의 실제 순간을 주인이 있는 곳의 폰 2 시각으로(phone2clock.js).
//     날씨도 반영이 쓰지 않아요(폰 2의 날씨는 코드가 채워요).
//   - 지시문: coreSystem · moneySystem의 live 옵션(페르소나 이름). 페르소나에게 가는 기본 문자 · 전화는 빼요.
//   - 복구 기록: 폰 2의 키(liveScope). 폰 1의 것과 안 섞여요.
// m: 폰 2 서랍(liveMeta: 폰 · 장부는 폰 2 것), real: 채팅의 진짜 메타(메신저 · 세계는 여기서 읽어요).
// 폰 1은 이 파일을 안 불러요. 폰 1 반영을 고치면 여기도 같이 봐요(순서가 같은 300줄).

import { askDraft, phoneForModel, coreSystem, moneyStage, daysPassed, aroundBlock, blindBlock, ownerClock, ordersBlock, parsePhone, recordsCore, recordCount, splitDays, homeScreens, cityIds,
    ITEM_KEYS, LISTS, APP_NAME, mergedState, everydayOn, everydayOnly, sizes, mergePhone, tagItems, phoneItems, byEvent, ensureIds, homeCountry, syncLives, glossAka, canUndo, restoreMerged, fxApp } from './phonedata.js';
import { exclusive, pickRound, unreadCount, settleRound, pruneDropped, srcOf, bodyMark, quoted, journalAdd, journalRead, journalWrite, newSync } from './phonesync.js';
import { jsonOf, evOf, when, hhmm, line, arr, pad } from './phoneparse.js';
import { applyMoney, moneyNow, investNow, orderClock, regularClock, revertEffects } from './phonesyncmoney.js';
import { applyLife, applyDays, fillDays, lifeClock, dlvClock, cardClock, lifeNow } from './phonesynclife.js';
import { migrateBank } from './finance.js';
import { nameKey } from './people.js';
import { liveWorld, liveScope, liveKey } from './phone2store.js';
import { liveWall } from './phone2clock.js';
import { feedRows, feedText, dropPersonaTalk } from './phone2feed.js';

const one = v => String(v ?? '').replace(/\s+/g, ' ').trim();
// how many messenger messages one round reads
export const LIVE_ROUND = 100;
// a messenger message as one row of the round: its number and its lines (what was said, then what the owner did)
const rowOf = (x, owner) => ({ index: x.n, text: [x.call ? `[#${x.n}] ${x.from} [Call]: ${Math.max(0, Math.round(Number(x.call.min) || 0))} min${one(x.call.summary) ? ` — ${one(x.call.summary)}` : ''}` : x.act && !one(x.text) ? '' : `[#${x.n}] ${x.from}: ${one(x.text)}`, ...(liveKey(x.from) === liveKey(owner) ? (x.does || []).filter(d => one(d?.what)).map(d => `[#${x.n}] ${owner} [${one(d.app)}]: ${one(d.what)}`) : [])].filter(Boolean).join('\n') });
// the situations the answer wrote (where things stand): kept on the phone for the next reply (its SITUATIONS), the
// newest state of each id
function keepSituations(p, list) {
    const by = new Map((Array.isArray(p.situations) ? p.situations : []).map(x => [x.id, x]));
    for (const x of arr(list)) { const id = one(x?.id); if (id && one(x.what)) by.set(id, { id, what: line(x.what, 240), state: line(x.state, 40), where: line(x.where, 80), when: line(x.when, 80), known: line(x.known, 240), open: line(x.open, 240) }); }
    p.situations = [...by.values()].slice(-30);
}

// one round of 폰 2's reflection for `owner`: the messenger messages not read yet (as many as a round takes). Returns
// the phone, or null when nothing is left to read. tz: where the owner is; save: saves the chat; profile · world: as
// 폰 1's reflection sends them (the caller's)
export async function updateLive(real, m, owner, { tz = 'UTC', save = async () => {}, profile = '', world = '' } = {}) {
    return exclusive('sync', async () => {
        const w = liveWorld(real), key = nameKey(owner), p = m.phones?.[key], scope = liveScope(w?.scope || 'live', real), P = w?.persona;
        if (!w || !p || !scope) throw new Error('실시간 폰이 없어요');
        const worldId = w.id;
        // (a phone that never read anything: its reading begins where the story ended)
        const s = (p.sync ||= newSync(scope));
        s.marks ||= {}; s.marks.base ||= { index: Number.isInteger(w.storyUpto) ? w.storyUpto : 0, user: -1, fp: '', tail: '' };
        s.done ||= []; s.failed ||= {}; s.arch ||= {}; s.events ||= {};
        glossAka(m, p);
        syncLives(p);
        const feed = feedRows(real, p.owner), byNo = new Map(feed.map(x => [x.n, x]));
        // (a payment 폰 1 still owed a story message, copied with the phone: not 폰 2's to work out)
        if (Array.isArray(s.owed?.money)) s.owed.money = s.owed.money.filter(o => byNo.has(o?.at));
        // (messenger messages are short and read oldest first, whatever 폰 1's reading was set to)
        const rows = feed.map(x => rowOf(x, p.owner)).filter(r => r.text), round = pickRound({ ...s, order: 'oldest', limit: LIVE_ROUND }, rows);
        if (!round.rows.length) return null;
        const inRound = new Set(round.rows.map(r => r.index)), last = byNo.get(Math.max(...inRound));
        // the clock: the real moment of the round's last message, on the owner's wall
        const wall = liveWall(tz, w.dayShift, last.at), nowAt = wall.at;
        const events = Object.entries(s.events).slice(-15).map(([id, e]) => `- ${id}: ${e.summary}${e.at === null || e.at === undefined ? '' : ` (#${e.at})`}`).join('\n');
        if (p.money) migrateBank(m, p);
        const money = moneyNow(p), invest = investNow(m, p), life = lifeNow(p);
        const split = !!(money || invest);
        // (the year is the wall's, for everything this round works out; a round that doesn't go in puts back the one the
        // phone had, and 되돌리기 goes back to it too)
        const yearWas = p.year;
        let went = false;
        if (!p.noYear) p.year = wall.year;
        try {
        const known = p.year && !p.noYear ? String(p.year) : '', year = known || String(new Date().getFullYear());
        const anchor = `${year}-${nowAt.slice(0, 5)}`;
        const today = nowAt.slice(0, 5), dayList = known ? Array.from({ length: 14 }, (_, k) => {
            const d = new Date(Date.UTC(Number(known), Number(today.slice(0, 2)) - 1, Number(today.slice(3, 5)) + k));
            return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]}`;
        }) : [];
        // (the owner's state before this round: the last one they wrote before its first message)
        const before = [...feed].reverse().find(x => x.n < Math.min(...inRound) && liveKey(x.from) === liveKey(p.owner) && one(x.state))?.state || '';
        const talk = ns => feedText(real, p.owner, feed.filter(x => ns.has(x.n)), { tz, state: before });
        // (a message's words as the request shows them: its own lines there, and the scene line it opens. The answer quotes
        // the request, so the quote is looked for in these)
        const shown = new Map();
        for (const l of talk(inRound).split('\n')) { const n = Number(/^\[?#(\d+)\b/.exec(l)?.[1]); if (Number.isInteger(n) && inRound.has(n)) shown.set(n, [...(shown.get(n) || []), l]); }
        for (const r of round.rows) if (shown.has(r.index)) r.text = shown.get(r.index).join('\n');
        const input = [
            `[NEW MESSAGES]\n${talk(inRound)}`,
            `[EVENTS ON THE PHONE]\n${events || '(none yet)'}`,
            known ? `[STORY YEAR]\n${known}` : '', dayList.length ? `[DAYS]\n${dayList.join('\n')}` : '',
            `[PHONE NOW]\n${JSON.stringify(phoneForModel(p))}`,
            !split && money ? `[MONEY NOW]\n${JSON.stringify(money)}` : '', !split && invest ? `[INVESTMENTS NOW]\n${JSON.stringify(invest)}` : '',
            split && money ? ordersBlock(money, p) : '',
            !split && money && p.delivery ? `[DELIVERY SHOPS]\n${(p.delivery.shops || []).map(x => x.name).join('\n') || '(none yet)'}${p.delivery.cart?.items?.length ? `\nCART (in the basket, not ordered): ${p.delivery.cart.shop}: ${p.delivery.cart.items.map(x => `${x.name} ×${x.qty}`).join(', ')}` : ''}` : '',
            life ? `[LIFE NOW]\n${JSON.stringify(life)}` : '', ownerClock(p, nowAt, m, null, []),
            !split && (money || invest) && p.wealthPlan ? `[WEALTH]\n${JSON.stringify({ currency: p.wealthPlan.currency, deposits: p.wealthPlan.deposits, investments: p.wealthPlan.investments, basis: p.wealthPlan.basis })}` : '',
            world ? `[WORLD]\n${world}` : '', aroundBlock(p),
            `[OWNER]\n${p.owner}`, profile, blindBlock(m, p.owner),
        ].filter(Boolean).join('\n\n');
        const made = { money: p.money?.at, invest: p.investment?.at, life: p.life, delivery: p.delivery };
        const out = await askDraft(input, { force: true, system: coreSystem({ life: !!life, weather: false, tracker: false, zone: false, archiveOnly: false, wallet: !!money, split, live: P }), maxTokens: 16000, effort: 'low' });
        const coreText = new Map(round.rows.map(r => [r.index, r.text]));
        const answer0 = jsonOf(out), core0 = recordsCore(answer0, i => coreText.get(i));
        const advanced = arr(core0?._advanced);
        if (core0 && typeof core0 === 'object') delete core0._advanced;
        const recCount = Array.isArray(answer0?.records) || Array.isArray(answer0?.scenes) ? (sp => recordCount([...arr(answer0.scenes).filter(x => x && typeof x === 'object').map(x => ({ ...x, type: 'scene' })), ...arr(sp.recs)], sp.own))(splitDays(answer0.records, answer0.everyday)) : null;
        homeScreens(core0, !!homeCountry(p) && homeCountry(p) !== 'KR', p.life?.health?.usual?.screen);
        // the answer is for the 폰 2 and the messages it was asked about
        const check = () => (liveWorld(real)?.id !== worldId || m.phones?.[key] !== p ? '반영하는 사이 실시간 폰이 바뀌었어요' : p.money?.at !== made.money || p.investment?.at !== made.invest ? '반영하는 사이 은행이나 투자가 새로 만들어졌어요' : '');
        if (check()) throw new Error(`${check()}. 다시 해 주세요`);
        if (p.life !== made.life || p.delivery !== made.delivery) throw new Error('반영하는 사이 생활 앱이나 배달 앱이 새로 만들어졌어요. 다시 해 주세요');
        if (!core0 || !Array.isArray(core0.events)) throw new Error('모델 답에서 반영할 내용을 찾지 못했어요. 다시 해 주세요');
        // (the owner reaches the persona on the messenger only: a text or call to them in the phone's own apps goes)
        const dropped = dropPersonaTalk(core0, P);
        const raw = { ...core0, now: nowAt };
        if (!raw.everyday || typeof raw.everyday !== 'object' || Array.isArray(raw.everyday)) delete raw.everyday;
        const textAt = new Map(round.rows.map(r => [r.index, r.text])), start = s.marks.base.index;
        const rid = Math.random().toString(36).slice(2, 10), rowText = new Map(rows.map(r => [r.index, r.text]));
        const failed = {}, loose = [], added = [], apps = new Set(), changes = [], notes = dropped ? [`${P}에게 가는 문자 · 전화 ${dropped}개는 메신저가 맡아서 넣지 않았어요`] : [];
        const msgSig = x => JSON.stringify([x.from, x.text, x.time]);
        ensureIds(p);
        const had = new Set(ITEM_KEYS.flatMap(k => (p[k] || []).map(x => x.id)).filter(Boolean)), msgs = new Map((p.threads || []).map(t => [t.id, new Set(t.messages.map(msgSig))]));
        const undo = { sync: structuredClone({ done: s.done, failed: s.failed, arch: s.arch, events: s.events, seen: s.seen, hiddenRead: s.hiddenRead || {}, owed: s.owed || { money: [] }, dropped: s.dropped || [] }), now: p.now, year: yearWas ?? null, where: structuredClone(p.where ?? null), moneyAt: p.money?.at, investAt: p.investment?.at,
            comments: (p.posts || []).filter(x => x.id).map(x => [x.id, x.comments?.length || 0]), before: structuredClone(mergedState(p)), situations: structuredClone(p.situations ?? null) };
        let lastDay = when(raw.now).slice(0, 5);
        everydayOn(raw, round.rows, textAt);
        const used = new Set(), wants = new Map(), daily = new Map();
        const over = arr(raw.events).slice(40), firstAt = new Set(arr(raw.events).slice(0, 40).map(e => Number(String(e?.at ?? '').replace(/^\s*#/, ''))));
        for (const e of over) { const at = Number(String(e?.at ?? '').replace(/^\s*#/, '')); if (inRound.has(at) && !firstAt.has(at)) failed[at] ||= '한 번에 일이 너무 많아서 다음에 다시 읽어요'; }
        for (const e of arr(raw.events).slice(0, 40)) {
            if (!e || typeof e !== 'object') continue;
            const nums = (String(e.at ?? '').match(/\d+/g) || []).map(Number);
            let at = Number(String(e.at ?? '').replace(/^\s*#/, ''));
            if (!Number.isInteger(at)) at = nums[0] ?? NaN;
            if (e.quote && !(inRound.has(at) && quoted(e.quote, textAt.get(at) || ''))) { const hit = [...nums, at - 1, at + 1, ...inRound].find(i => inRound.has(i) && quoted(e.quote, textAt.get(i) || '')); if (hit !== undefined) at = hit; }
            const fail = why => (inRound.has(at) ? (failed[at] ||= why) : loose.push(why));
            if (!Number.isInteger(at) || at <= start || !inRound.has(at)) { fail('읽는 범위 밖의 일이에요'); continue; }
            if (!quoted(e.quote, textAt.get(at) || '')) { fail('원문에서 근거를 찾지 못했어요'); continue; }
            let add;
            const day = when(e.date).slice(0, 5) || lastDay, phone = e.phone && typeof e.phone === 'object' ? structuredClone(e.phone) : {};
            const dated = x => { if (x && typeof x === 'object' && /^\s*\d{1,2}:\d{2}\s*$/.test(String(x.time || '')) && day) x.time = `${day} ${hhmm(x.time)}`; };
            for (const x of arr(phone.visits)) if (x && typeof x === 'object' && !String(x.time || '').trim() && day) x.time = day;
            for (const k of [...LISTS, 'threads']) for (const x of arr(phone[k])) { dated(x); for (const msg of arr(x?.messages)) dated(msg); if (x?.draft) dated(x.draft); }
            try { add = parsePhone(JSON.stringify(phone), p.owner); } catch { fail('앱 내용 형식이 잘못됐어요'); continue; }
            everydayOnly(p, add, day, daily, when(raw.now));
            const tagOf = v => { const t = evOf(v); return /^\d+$/.test(t) ? '' : t; };
            const id0 = tagOf(e.id) || tagOf(e.summary) || `ev-${at}`, id = used.has(id0) && added.some(x => x.id === id0 && x.at !== at) ? `${id0}-${at}` : id0;
            used.add(id);
            if (split) { wants.set(id, { id, at, date: day, time: hhmm(e.time), summary: line(e.summary, 160), quote: line(e.quote, 200), changed: false }); delete e.money; }
            const stage = structuredClone({ money: p.money, investment: p.investment, finance: m.finance, delivery: p.delivery });
            let paid;
            if (day) lastDay = day;
            try { paid = applyMoney(m, p, { id, at, date: day, time: hhmm(e.time), summary: line(e.summary, 160), money: e.money }, { placeCity: cityIds, year, anchor, marks: s.marks, legs: s.events[id]?.legs || [], span: s.failed[at]?.span || null, edited: false }); }
            catch (err) { p.money = stage.money; p.investment = stage.investment; m.finance = stage.finance; if (p.delivery) p.delivery = Object.assign(p.delivery, stage.delivery); fail(String(err?.message || err)); continue; }
            for (const c of paid.changes) { apps.add(c.app); if (c.amount !== null) changes.push({ ...c, what: c.what || line(e.summary, 60) }); }
            notes.push(...paid.notes);
            const lived = applyLife(p, { id, at, date: day, time: hhmm(e.time) }, phone, !!p.life && at > (s.marks.life?.index ?? -1));
            for (const a of lived.apps) apps.add(a);
            const fx = [...paid.effects, ...lived.effects];
            for (const k of LISTS) for (const x of add[k]) x.ev ||= id;
            for (const t of add.threads) for (const x of t.messages) x.ev ||= id;
            const was = sizes(p), told = structuredClone(add);
            mergePhone(p, { ...add, device: null, now: '' }, { keepAll: true, m });
            tagItems(p, add, srcOf(at, bodyMark(rowText.get(at) || ''), rid));
            const got = sizes(p);
            for (const k of ITEM_KEYS) if (got[k] !== was[k]) apps.add(APP_NAME[k]);
            if (add.profile?.handle || add.profile?.bio) apps.add('SNS');
            const at0 = s.events[id]?.at, home = Number.isInteger(at0) && inRound.has(at0) === false && rowText.has(at0) ? at0 : at;
            if (home !== at) for (const f of fx) f.src = at;
            s.events[id] = { at: home, quote: line(e.quote, 200), summary: line(e.summary, 160), effects: [...(s.events[id]?.effects || []), ...fx], ...(paid.legs.length || s.events[id]?.legs ? { legs: [...(s.events[id]?.legs || []), ...paid.legs.filter(l => !(s.events[id]?.legs || []).some(o => o.key === l.key))] } : {}) };
            added.push({ id, at, add: told, effects: fx, quote: line(e.quote, 200), summary: line(e.summary, 160), legs: paid.legs });
        }
        // 2단계 돈: this round's messages and the ones earlier rounds still owe, as the messenger's lines
        let late = [];
        if (split) {
            const targets = [...wants.values()];
            const owed = arr(s.owed?.money).map(o => o?.at).filter(i => Number.isInteger(i) && byNo.has(i));
            const st = await moneyStage(m, p, p.owner, { targets, rows, raw: new Map(), sections: [], evidence: [], reread: new Map(), year, known, anchor, profile, check, inRound, nowDay: today,
                passed: daysPassed(p.now, nowAt, known, targets, Math.max(-1, ...inRound)), live: P, messages: talk(new Set([...inRound, ...owed])) });
            s.owed = { ...(s.owed || {}), money: st.owed };
            late = st.late;
            for (const a of st.apps) apps.add(a);
            changes.push(...st.changes); notes.push(...st.notes);
        }
        settleRound(s, round.rows, failed, new Set(added.map(x => x.at)));
        // the clock: the round's last message, as the owner's wall showed it
        p.now = nowAt;
        const days = [...applyDays(p, raw.days, rid), ...fillDays(p, p.now, rid)];
        if (days.length) apps.add('건강');
        const roundFx = [...days, ...lifeClock(p, p.now), ...dlvClock(p, p.now), ...cardClock(p, p.now), ...orderClock(p, p.now), ...(p.money ? regularClock(m, p, p.now, p.year && !p.noYear ? String(p.year) : year) : [])];
        if (p.money) migrateBank(m, p);
        keepSituations(p, answer0?.situations);
        s.rounds = [...(s.rounds || []).slice(-19), rid];
        p.syncLast = { checked: inRound.size, remaining: unreadCount(s, rows), apps: [...apps], failed: [...Object.entries(failed).map(([at, why]) => ({ at: Number(at), why, skipped: s.failed[at]?.tries >= 2 })), ...loose.map(why => ({ at: null, why }))], changes, notes, ...(recCount ? { records: { ...recCount, ...(advanced.length ? { advanced: advanced.length } : {}) }, ...(advanced.length ? { advanced } : {}) } : {}), at: Date.now() };
        ensureIds(p);
        p.at = Date.now();
        pruneDropped(s, phoneItems(p));
        delete p.clockHold; delete p.liveHeld;
        // (only 폰 2's own rounds line up to be undone: one copied from 폰 1 is not this phone's to take back)
        const below = p.syncUndo?.live && s.rounds.at(-2) === p.syncUndo.round && p.money?.at === p.syncUndo.moneyAt && p.investment?.at === p.syncUndo.investAt;
        p.syncUndos = below ? [...(p.syncUndos || []), p.syncUndo].slice(-4) : [];
        if (!p.syncUndos.length) delete p.syncUndos;
        p.syncUndo = { ...undo, live: true, round: rid, last: structuredClone(p.syncLast), read: [...inRound], readFp: round.rows.map(r => bodyMark(r.text)), comments: undo.comments, whereAfter: JSON.stringify(p.where ?? null),
            items: ITEM_KEYS.flatMap(k => (p[k] || []).filter(x => x.id && !had.has(x.id)).map(x => [k, x.id])),
            msgs: (p.threads || []).filter(t => msgs.has(t.id)).map(t => [t.id, t.messages.map(msgSig).filter(sg => !msgs.get(t.id).has(sg))]).filter(([, xs]) => xs.length),
            effects: [...added.flatMap(x => x.effects || []), ...late.flatMap(x => x.effects || []), ...roundFx], byEvent: byEvent([...added, ...late]), after: structuredClone(mergedState(p)) };
        journalAdd(scope, { round: rid, owner: p.owner, at: Date.now(), now: p.now, year: p.year, back: false, where: structuredClone(p.where ?? null), events: [...added, ...late], ...(split ? { owed: s.owed } : {}), done: [...inRound], seen: round.rows.map(r => [r.index, bodyMark(r.text)]), failed: Object.fromEntries([...inRound].filter(i => s.failed[i]).map(i => [i, s.failed[i]])), arch: [], hidden: [], life: roundFx });
        await save();
        went = true;
        return p;
        } finally { if (!went) { if (yearWas === undefined) delete p.year; else p.year = yearWas; } }
    }, { operation: 'reflect', owner, scope: liveScope(liveWorld(real)?.scope || 'live', real) });
}

// 방금 반영 되돌리기 (폰 2): the last round of 폰 2's reflection is taken back, as 폰 1's 되돌리기 does it (phonedata.js
// undoRound, the same steps and the same helpers): the items it added go, what it merged is as it was, the money and the
// everyday apps go back, the messages are unread again, the phone's clock and situations are as before. What can't go back
// (changed by hand since, or built on) stays and is named. The round before comes up to be undone next (up to 4 back).
// The messages wait: they are read again with the next talk, or when the user asks (liveReflect with force).
// Returns the names of what stayed. Throws when there is nothing to undo
export async function undoLive(real, m, owner, { save = async () => {} } = {}) {
    return exclusive('sync', async () => {
        const w = liveWorld(real), p = m.phones?.[nameKey(owner)], scope = liveScope(w?.scope || 'live', real);
        if (!w || !p) throw new Error('실시간 폰이 없어요');
        const u = p.syncUndo, s = p.sync;
        if (!u || !u.live || s?.rounds?.[s.rounds.length - 1] !== u.round) throw new Error('되돌릴 반영이 없어요');
        if (!canUndo(p)) throw new Error('그 뒤에 은행이나 투자를 다시 만들어서 되돌릴 수 없어요');
        const ledger = m.finance;
        const gone = new Set(u.items.map(([, id]) => id));
        for (const k of ITEM_KEYS) if (Array.isArray(p[k])) p[k] = p[k].filter(x => !gone.has(x.id));
        for (const [tid, sigs] of u.msgs) {
            const t = (p.threads || []).find(x => x.id === tid);
            if (t) { const drop = new Set(sigs); t.messages = t.messages.filter(x => !drop.delete(JSON.stringify([x.from, x.text, x.time]))); }
        }
        p.threads = (p.threads || []).filter(t => t.messages.length);
        if (u.before && u.after) restoreMerged(p, u.before, u.after);
        for (const { x } of phoneItems(p)) if (x.froms) x.froms = x.froms.filter(f => f.r !== u.round);
        const now = structuredClone(s.events), kept = [], droppedNow = structuredClone(s.dropped || []);
        const left = new Set(revertEffects(m, p, u.effects).map(x => JSON.stringify(x)));
        Object.assign(s, structuredClone(u.sync));
        s.dropped = droppedNow;
        for (const [id, e] of Object.entries(s.events)) if (now[id]) { const still = new Set((now[id].effects || []).map(x => JSON.stringify(x))); e.effects = (e.effects || []).filter(x => still.has(JSON.stringify(x))); }
        for (const id of Object.keys(s.events)) if (!(id in now)) delete s.events[id];
        for (const [id, effects] of u.byEvent || []) {
            const rest = effects.filter(x => left.has(JSON.stringify(x)));
            if (rest.length && now[id]) { s.events[id] = { ...now[id], effects: [...(s.events[id]?.effects || []), ...rest] }; kept.push(now[id].summary || id); }
        }
        const evFx = new Set((u.byEvent || []).flatMap(([, fx]) => fx.map(x => JSON.stringify(x))));
        for (const x of u.effects) { const j = JSON.stringify(x); if (left.has(j) && !evFx.has(j)) { const app = fxApp(x.path); if (app && !kept.includes(app)) kept.push(app); } }
        s.rounds.pop();
        pruneDropped(s, phoneItems(p));
        p.now = u.now;
        if (u.year === null) delete p.year; else if (u.year !== undefined) p.year = u.year;
        if (u.situations !== undefined) { if (u.situations) p.situations = u.situations; else delete p.situations; }
        // (the messages it read wait for the next talk: leaving the messenger again doesn't read them straight back)
        p.liveHeld = Math.max(0, ...(u.read || []));
        const prev = (p.syncUndos || []).pop();
        if (!p.syncUndos?.length) delete p.syncUndos;
        if (prev) { p.syncUndo = prev; if (prev.last) p.syncLast = structuredClone(prev.last); else delete p.syncLast; } else { delete p.syncLast; delete p.syncUndo; }
        if (p.money) migrateBank(m, p);
        // (a 폰 2 with no ledger stays without one: taking the money back only looked into it)
        if (!ledger && m.finance && ![m.finance.accounts, m.finance.transfers, m.finance.prices].some(o => Object.keys(o || {}).length) && !(m.finance.revisions || []).length) m.finance = ledger;
        if (scope) journalWrite(scope, journalRead(scope).filter(r => r.round !== u.round));
        await save();
        return kept;
    }, { operation: 'undo', owner, scope: liveScope(liveWorld(real)?.scope || 'live', real) });
}
