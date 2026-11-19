// 폰 2(실시간)의 생활 쪽 채우기: 시계 · 건강 · 파일 · 날씨, 배달, 스크린타임, 동네 가게 새로고침. phonelife.js의 같은 함수를
// 줄 그대로 옮긴 것이고, 다른 곳은 이것뿐이에요.
//   읽는 범위 · 읽은 자리 · 요청 뼈대 · 두 번째 차례: 실시간 것 (phone2req.js). 롤플은 시작한 곳까지만, 읽은 자리는 메신저 번호
//   폰의 지금: 폰에 저장된 시각 (롤플 상태창은 안 읽어요). 생활 요청의 OWNER'S CLOCK만 서랍의 흐르는 시계
//   날씨: 롤플 상태창의 날씨는 실시간 폰의 것이 아니라 안 실어요
// 폰 1 파일은 여기서 읽기만 해요.
import { datedRows } from './anniv.js';
import { calendars } from './calendar.js';
import { ctx, saveMeta } from './core.js';
import { headingPlaces } from './people.js';
import { cutShort } from './phoneparse.js';
import { phoneChatScope } from './phonestory.js';
import { exclusive, syncOf } from './phonesync.js';
import { dayGap, screenOf, usualScreenOf } from './phonesynclife.js';
import { shopStats, unpayOrders } from './phonesyncmoney.js';
import { askDraft, CHAT_TOKENS, COUNTRIES, arr, byStory, ensureIds, jsonOf, ko, line, markNow, nowAt, rowDay, sceneHome, soFarHead, turnsNote } from './phonedata.js';
import { AI_SYS_LIFE, AI_SYS_DELIVERY, AI_SYS_SCREEN, AI_SYS_NEARBY, NEARBY_DAYS, NEARBY_ROUNDS, NEARBY_MAX, livesIn, deliveryLook, homeCity, homeApps, homeDay, menuOf, md, shiftDay, daysBlock, later, said,
    parseLife, mergeLife, parseDelivery, mergeDelivery, nearbyShops, payDeliveries, fillShopMenus } from './phonelife.js';
import { liveSideRequest, liveWindowOf, liveReadMark, liveSecondTurn, liveSavedNow, liveFillClock, needLive } from './phone2req.js';
import { liveNowText } from './phone2store.js';

// 이야기의 날들 (최근 14일) · 폰이 지금 담고 있는 것: 지금은 폰에 저장된 시각
export function liveStoryDays(m, p, upto = null) {
    const now = String(liveSavedNow(p) || p.now || '').slice(0, 5);
    const rows = datedRows(m).filter(r => rowDay(r)), cals = calendars();
    const last = md(now) ? now : rows.map(rowDay).at(-1) || '';
    if (!last) return [];
    return Array.from({ length: 14 }, (_, k) => shiftDay(last, k - 13)).map(day => ({ day, places: [...new Set(rows.filter(r => rowDay(r) === day).flatMap(r => headingPlaces(r.s.title, cals)))].slice(0, 4) }));
}
const livePhoneNow = (p, upto = null) => JSON.stringify({
    now: liveSavedNow(p) || p.now,
    events: (p.events || []).slice(-10).map(x => ({ title: x.title, date: x.date, time: x.time, ...(x.ev ? { ev: x.ev } : {}) })),
    mails: (p.mails || []).slice(-8).map(x => ({ from: x.from, subject: x.subject, time: x.time, ...(x.ev ? { ev: x.ev } : {}) })),
    // (a ticket told of before its day was known: its date is only the day it was told on)
    tickets: (p.money?.passes || []).map(x => ({ kind: x.kind, by: x.by, from: x.from, to: x.to, date: x.date, ...(x.dayUnknown ? { dayUnknown: true } : {}), time: x.time, ...(x.ev ? { ev: x.ev } : {}) })),
    orders: (p.money?.orders || []).slice(-6).map(x => ({ shop: x.shop, item: x.item, time: x.time, ...(x.ev ? { ev: x.ev } : {}) })),
});

// 스크린타임
export const liveFillScreen = (m, p, { again = false } = {}) => exclusive('fill', async () => {
    needLive(m);
    const h = p.life?.health;
    if (!h) throw new Error('건강 앱을 먼저 채워 주세요');
    // the last week before today (today is counted as it goes, from their usual)
    // today: where it reads up to, or where the life app reached when that is a little later (its health days go on to
    // there; one filled long ago, months back in the story, is no today)
    const read = { gap: liveWindowOf(m, p) }, t0 = String(liveSavedNow(p) || p.now || '').slice(0, 5), la = String(p.life?.at || '').slice(0, 5);
    const today = /^\d{2}-\d{2}$/.test(la) && /^\d{2}-\d{2}$/.test(t0) && dayGap(t0, la) > 0 && dayGap(t0, la) <= 14 ? la : t0, told = d => String(d.id || '').startsWith('sync:') && !!d.screen;
    const days = (h.days || []).filter(d => d.date && d.date !== today && (again ? !told(d) : !d.screen) && (!today || dayGap(d.date, today) > 0 && dayGap(d.date, today) <= 7)).sort((a, b) => dayGap(b.date, a.date)).slice(-7);
    const input = await liveSideRequest(m, p.owner, [`[DAYS]\n${JSON.stringify(days.map(d => ({ date: d.date, sleep: d.sleep, wake: d.wake, steps: d.steps, ...(d.ev ? { ev: d.ev } : {}) })))}`,
        `[LIVES IN]\n${(c => COUNTRIES[c] || c || '(unknown)')((p.where?.people || []).find(x => String(x?.name || '').toLowerCase() === String(p.owner || '').toLowerCase())?.lives || livesIn(p))}`,
        p.country ? `[PHONE COUNTRY]\n${COUNTRIES[p.country] || p.country}` : ''], { profile: p.financeProfile, story: CHAT_TOKENS.apps, read });
    const out = await askDraft(input, { force: true, system: AI_SYS_SCREEN, maxTokens: 6000, effort: 'low' });
    const raw = jsonOf(out, { salvage: true }), usual = homeApps(p, usualScreenOf(raw?.usual));
    let n = 0;
    // a phone the reflection already gave a usual keeps it (unless made again); a day already told keeps its own
    if (usual && (again || !h.usual?.screen)) { (h.usual ||= {}).screen = usual; n++; }
    for (const x of arr(raw?.days)) {
        const d = days.find(y => y.date === String(x?.date || '').slice(0, 5)), sc = homeDay(p, screenOf(x), usual || h.usual?.screen);
        if (d && sc && (again || !d.screen)) { d.screen = sc; n++; }
    }
    if (!n) throw new Error('모델 답에서 스크린타임을 찾지 못했어요');
    // made again: an older week's screen the fill wrote goes too (the code works those days out from the new usual)
    if (again) for (const d of h.days || []) if (d.screen && !told(d) && !days.includes(d)) delete d.screen;
    await saveMeta();
    return n;
});

// 동네 가게: 최근에 시킨 가게인지, 새로 고칠 때가 됐는지, 새로 고치기
const liveLately = (p, d, name) => { const today = String(p.now || liveSavedNow(p) || '').slice(0, 5); return d.orders.some(o => o.shop === name && /^\d{2}-\d{2}$/.test(today) && dayGap(String(o.time || '').slice(0, 5), today) >= 0 && dayGap(String(o.time || '').slice(0, 5), today) <= 30); };
export function liveNearbyDue(p) {
    const d = p.delivery, today = String(p.now || liveSavedNow(p) || '').slice(0, 5);
    if (!d?.shops?.length || !/^\d{2}-\d{2}$/.test(today)) return '';
    const city = homeCity(p);
    if (city && d.city && city !== d.city) return 'moved';
    if (!/^\d{2}-\d{2}$/.test(d.nearbyAt || '')) return '';
    return dayGap(d.nearbyAt, today) >= NEARBY_DAYS && (d.nearbyRounds || 0) >= NEARBY_ROUNDS ? 'days' : '';
}
export async function liveRefreshNearby(m, p, { read = false } = {}) {
    needLive(m);
    const d = p.delivery, today = String(p.now || liveSavedNow(p) || '').slice(0, 5);
    if (d && read) d.nearbyRounds = (d.nearbyRounds || 0) + 1;
    const why = liveNearbyDue(p);
    // a phone filled before this kept no day: it starts counting now
    if (d && !d.nearbyAt && /^\d{2}-\d{2}$/.test(today)) { d.nearbyAt = today; d.city ||= homeCity(p); await saveMeta(); return 0; }
    if (!why) return 0;
    const moved = why === 'moved', near = d.shops.filter(s => !liveLately(p, d, s.name)), ordered = d.shops.filter(s => liveLately(p, d, s.name));
    const cur = p.money?.currency || p.money?.bank?.accounts?.[0]?.currency || (livesIn(p) === 'KR' ? 'KRW' : 'EUR');
    const input = [`[PLACE]\n${homeCity(p) || COUNTRIES[livesIn(p)] || livesIn(p) || '(unknown)'}${moved ? '\n[MOVED]\ntrue' : ''}`, `[CURRENCY]\n${cur}`,
        `[NEARBY]\n${JSON.stringify(near.map(s => ({ name: s.name, cuisine: s.cuisine })))}`, `[ORDERED]\n${JSON.stringify(ordered.map(s => s.name))}`].join('\n\n');
    const out = await askDraft(input, { force: true, system: AI_SYS_NEARBY, maxTokens: 9000, effort: 'low' });
    const raw = jsonOf(out, { salvage: 'whole' });
    if (!raw || typeof raw !== 'object') throw new Error('모델 답에서 동네 가게를 찾지 못했어요');
    // the phone may have changed while it was asked (the app made again)
    if (p.delivery !== d) return 0;
    const plain = v => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const gone = new Set(moved ? near.map(s => plain(s.name)) : arr(raw.gone).map(plain));
    const have = new Set(d.shops.map(s => plain(s.name)));
    const won = cur === 'KRW', fresh = arr(raw.new).map(x => {
        const name = line(x?.name, 60); if (!name || have.has(plain(name))) return null; have.add(plain(name));
        const st = shopStats(name, won), menu = menuOf(x?.menu, 6);
        return { name, ko: ko(x?.ko), cuisine: line(x?.cuisine, 30), rating: st.rating, reviews: st.reviews, fee: st.fee, minOrder: st.minOrder, eta: st.eta, fav: false, nearby: true, menu, ...(menu.length > 1 ? { menuAt: Date.now() } : {}) };
    }).filter(Boolean).slice(0, moved ? 7 : 2);
    // a shop nearby goes (never one ordered from lately); the rest reorder; the new ones come first, as the app shows what opened
    const kept = d.shops.filter(s => liveLately(p, d, s.name) || !gone.has(plain(s.name)));
    const mix = v => [...`${today}:${v}`].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
    const stay = kept.filter(s => !liveLately(p, d, s.name)).sort((a, b) => mix(a.name) - mix(b.name));
    const nearby = [...fresh, ...stay].slice(0, NEARBY_MAX);
    d.shops = [...kept.filter(s => liveLately(p, d, s.name)), ...nearby];
    d.nearbyAt = today; d.nearbyRounds = 0; d.city = homeCity(p) || d.city || '';
    ensureIds(p);
    await saveMeta();
    return fresh.length;
}

// 시계 · 건강 · 파일 · 날씨
export const liveFillLife = (m, p, { screenAgain = false } = {}) => exclusive('fill', async () => {
    needLive(m);
    const mark0 = markNow();
    // made again: the body the phone already shows stays, unless the story changed it (a child who grew, a diet)
    const was = p.life?.health?.usual || {}, body = Object.fromEntries(['height', 'weight'].filter(k => Number.isFinite(was[k])).map(k => [k, was[k]]));
    // a booking the wallet holds is drawn from it: its file needs no line of its own
    const booked = new Set((p.money?.passes || []).map(x => x.ev).filter(Boolean));
    // one turn: its window, and what the turn before wrote (none for the first); stopped short, its now is where it stopped
    const turn = async (gap, soFar = null, short = null) => {
        // a status line from a scene the owner isn't in (or may not be): its place and sky go along, never as the owner's weather
        const upto = nowAt(gap), w = null, home = !w || sceneHome(p, w.place, m) === true, now = home ? w : null, days = liveStoryDays(m, p, upto);
        const input = await liveSideRequest(m, p.owner, [`[PHONE NOW]\n${livePhoneNow(p, upto)}`, daysBlock(days),
            !soFar && Object.keys(body).length ? `[BODY ON THE PHONE NOW — keep it unless the story changed it]\n${JSON.stringify(body)}` : '',
            soFar ? `${soFarHead('LIFE', short)}\n${JSON.stringify(soFar)}` : '', short?.text || '',
            w ? `[WEATHER NOW]\n${JSON.stringify(home ? w : { place: w.place, weather: w.weather })}` : '', liveFillClock(m, p, liveNowText(m, p) || p.now, { story: true }), p.country ? `[PHONE COUNTRY]\n${COUNTRIES[p.country] || p.country}` : ''], { profile: p.financeProfile, story: CHAT_TOKENS.life, read: { gap } });
        // (an answer cut off before its end is not taken: what it read isn't all there, so the mark stays where it was)
        const ans = await askDraft(input, { force: true, system: AI_SYS_LIFE, maxTokens: 16000, effort: 'low' });
        if (cutShort(ans)) throw new Error('모델 답이 중간에 끊겼어요');
        const raw = jsonOf(ans, { salvage: true });
        // (a first turn with nothing in it is no life app: what the phone has stays)
        if (!soFar && raw && typeof raw === 'object' && !Object.keys(raw).length) throw new Error('모델 답에서 시계 · 건강 · 파일 · 날씨 내용(JSON)을 찾지 못했어요');
        const next = parseLife(raw, now, days.at(-1)?.day || '');
        said.set(next, { raw, now });
        const at = liveSavedNow(p) || p.now || '';
        if (/^\d{2}-\d{2}/.test(at)) next.files.items = next.files.items.filter(x => !later(x.time, at));
        for (const x of next.files.items) if (x.ev && booked.has(x.ev)) x.preview = '';
        return next;
    };
    const first = liveWindowOf(m, p);
    let life = await turn(first), last = first, short = null;
    // (실시간 폰: 시작한 곳까지 다 읽을 때까지 이어서 읽어요. 남은 이야기를 읽어 줄 반영이 없어요)
    for (let two = liveSecondTurn(m, p, first); two; two = liveSecondTurn(m, p, last)) {
        // a second turn that fails keeps what the first wrote
        try { life = mergeLife(life, await turn(two.cover, life, two.short)); last = two.cover; short = two.short; }
        catch (err) { console.warn('[narrative-archive] life, second turn', err); break; }
    }
    // what a reflection put in from messages past where this fill read (it reads newest first: a stretch read ahead of a
    // gap) stays: the fill never saw those messages, and they count as read
    const upTo = liveReadMark(last)?.index, old = p.life, s0 = p.sync;
    if (old && Number.isInteger(upTo)) {
        const ahead = x => String(x?.id || '').startsWith('sync:') && (Number.isInteger(x.sourceIndex) ? x.sourceIndex : s0?.events?.[x.ev]?.at ?? -1) > upTo;
        const add = (to, from, same = () => false) => [...(to || []), ...(from || []).filter(x => ahead(x) && !(to || []).some(y => y.id === x.id || same(x, y)))];
        life = { ...life, clock: { ...(life.clock || {}), alarms: add(life.clock?.alarms, old.clock?.alarms), timers: add(life.clock?.timers, old.clock?.timers) },
            health: { ...(life.health || {}), days: add(life.health?.days, old.health?.days, (x, y) => x.date === y.date) },
            files: { ...(life.files || {}), items: add(life.files?.items, old.files?.items) } };
    }
    p.life = { ...life, at: liveSavedNow(p) || p.now || '' };
    // the last round's 되돌리기 would take its records out of an app made again since: no more
    delete p.syncUndo; delete p.syncUndos;
    // a reflection reads on from here (a phone with no reading record yet gets one, so it isn't read twice); with no
    // clock, the last message there was when the fill began, not one that came while it wrote
    syncOf(p, phoneChatScope(ctx())).marks.life = liveReadMark(last) || mark0;
    ensureIds(p);
    await saveMeta();
    turnsNote(last, '생활', short);
    // the screen time is its own request right after (its long app list stays out of this one); one that failed leaves
    // 설정 › 스크린타임 with its 채우기 button
    // (다시 만들기 with 스크린타임 picked too: that one remade here, not asked twice)
    try { await liveFillScreen(m, p, { again: screenAgain }); } catch (err) { console.warn('[narrative-archive] screen time', err); }
    return p.life;
});

// 배달
export const liveFillDelivery = (m, p) => exclusive('fill', async () => {
    needLive(m);
    const mark0 = markNow();
    const accounts = p.money?.bank?.accounts || [];
    // the bank's own rows (not the ones this app put there): a meal already paid there is pointed at, not paid again
    const tx = (p.money?.tx || []).filter(t => !String(t.id).startsWith('dlv-') && !t.delivery);
    const money = accounts.length ? `[MONEY NOW]\n${JSON.stringify({ accounts: accounts.map(a => ({ last4: a.last4, kind: a.kind, name: a.name, currency: a.currency })), tx: tx.slice(-20).map(t => ({ id: t.id, account: t.account, time: t.time, who: t.who, amount: t.amount })) })}` : '';
    // two turns at most, like the life fill (secondTurn)
    const turn = async (gap, soFar = null, short = null) => {
        const upto = nowAt(gap), at = liveSavedNow(p) || p.now || '';
        const input = await liveSideRequest(m, p.owner, [`[PHONE NOW]\n${livePhoneNow(p, upto)}`, daysBlock(liveStoryDays(m, p, upto)), liveFillClock(m, p, at, { story: true }), `[LIVES IN]\n${COUNTRIES[livesIn(p)] || livesIn(p) || '(unknown)'}`, money,
            soFar ? `${soFarHead('DELIVERY', short)}\n${JSON.stringify(soFar)}` : '', short?.text || ''], { profile: p.financeProfile, story: CHAT_TOKENS.apps, read: { gap } });
        const ans = await askDraft(input, { force: true, system: AI_SYS_DELIVERY, maxTokens: 12000, effort: 'low' });
        if (cutShort(ans)) throw new Error('모델 답이 중간에 끊겼어요');
        const got = jsonOf(ans, { salvage: 'whole' });
        if (!soFar && got && typeof got === 'object' && !Object.keys(got).length) throw new Error('모델 답에서 배달 내용(JSON)을 찾지 못했어요');
        const next = parseDelivery(got, accounts, tx, at);
        said.set(next, { raw: got });
        // the shops nearby go after the ones they order from (the app's 동네 인기 가게); the first turn sets them
        if (!soFar) next.shops = [...next.shops, ...nearbyShops(got, next.shops, (p.money?.currency || accounts[0]?.currency) === 'KRW')];
        // nothing after the story's now
        if (/^\d{2}-\d{2}/.test(at)) next.orders = next.orders.filter(o => !later(o.time, at));
        return next;
    };
    const first = liveWindowOf(m, p);
    let d = await turn(first), last = first, short = null;
    // (실시간 폰: 시작한 곳까지 다 읽을 때까지 이어서 읽어요. 남은 이야기를 읽어 줄 반영이 없어요)
    for (let two = liveSecondTurn(m, p, first); two; two = liveSecondTurn(m, p, last)) {
        try { d = mergeDelivery(d, await turn(two.cover, { shops: d.shops, orders: d.orders, cart: d.cart || null }, two.short)); last = two.cover; short = two.short; }
        catch (err) { console.warn('[narrative-archive] delivery, second turn', err); break; }
    }
    const at = liveSavedNow(p) || p.now || '';
    if (p.delivery) unpayOrders(m, p);
    // orders a reflection put in stay (their payments are the bank's own rows); the fill's own telling of the same order
    // (the same shop on the same day, or the same story event) is that one, not a second
    const kept = (p.delivery?.orders || []).filter(o => o.sync), plain = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    // (two story events are two orders, whatever the shop and day; the same shop within the hour is the same one)
    const mins = t => { const mt = /(\d{2}):(\d{2})/.exec(String(t || '').slice(5)); return mt ? mt[1] * 60 + Number(mt[2]) : null; };
    const twin = o => kept.some(k => (o.ev && k.ev === o.ev) || !(o.ev && k.ev && o.ev !== k.ev) && plain(k.shop) === plain(o.shop) && dayGap(String(k.time).slice(0, 5), String(o.time).slice(0, 5)) === 0 && (mins(k.time) === null || mins(o.time) === null || Math.abs(mins(k.time) - mins(o.time)) <= 60));
    p.delivery = { ...d, orders: [...d.orders.filter(o => !twin(o)), ...kept].sort(byStory(p.now)), look: deliveryLook(p), at, nearbyAt: String(at).slice(0, 5), city: homeCity(p) };
    delete p.syncUndo; delete p.syncUndos;
    syncOf(p, phoneChatScope(ctx())).marks.delivery = liveReadMark(last) || mark0;
    ensureIds(p);
    payDeliveries(m, p);
    await saveMeta();
    turnsNote(last, '배달', short);
    // the shops nearby get their menus straight after, in a request of their own (a failure here leaves the app as filled)
    try { await fillShopMenus(m, p); } catch { /* asked again when the app is opened */ }
    return p.delivery;
});
