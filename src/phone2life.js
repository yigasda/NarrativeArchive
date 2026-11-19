// 폰 2(실시간)의 생활 쪽 채우기: 스크린타임, 동네 가게 새로고침. phonelife.js의 같은 함수를 줄 그대로 옮긴 것이고,
// 다른 곳은 이것뿐이에요.
//   읽는 범위 · 요청 뼈대: 실시간 것 (phone2req.js). 롤플은 시작한 곳까지만, 최근 대화는 메신저 것
//   폰의 지금: 폰에 저장된 시각 (롤플 상태창은 안 읽어요)
// 폰 1 파일은 여기서 읽기만 해요.
import { saveMeta } from './core.js';
import { exclusive } from './phonesync.js';
import { dayGap, screenOf, usualScreenOf } from './phonesynclife.js';
import { shopStats } from './phonesyncmoney.js';
import { askDraft, CHAT_TOKENS, COUNTRIES, arr, ensureIds, jsonOf, ko, line } from './phonedata.js';
import { AI_SYS_SCREEN, AI_SYS_NEARBY, NEARBY_DAYS, NEARBY_ROUNDS, NEARBY_MAX, livesIn, homeCity, homeApps, homeDay, menuOf } from './phonelife.js';
import { liveSideRequest, liveWindowOf, liveSavedNow, needLive } from './phone2req.js';

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
