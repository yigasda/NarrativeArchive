// 폰 2 답장 요청에 넣을 값을 실제 폰 2에서 모아요 (docs/PHONE2-PLAN.md 단계 7-1). 글로 바꾸는 건 phone2ask.js. 폰 1의
// 함수가 필요한 것(주인 시계, 주변 사람, 카드, 지금 있는 곳)은 부르는 쪽이 deps로 넘겨요: 이 파일은 폰 2 저장 자리와 날짜
// 계산만 불러서 시험하기 쉬워요. 메신저 · 폰은 읽기만 해요. 폰 1은 이 파일을 안 불러요.

import { liveKey, liveWorld, livePhone, numberLive } from './phone2store.js';
import { liveWall } from './phone2clock.js';
import { gapDays } from './phoneparse.js';

const one = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const same = (a, b) => !!liveKey(a) && liveKey(a) === liveKey(b);
const AT = /^\d{2}-\d{2} \d{2}:\d{2}$/, DAY = /^\d{2}-\d{2}$/;
// how late a phone time is, in minutes against today's 00:00 (yesterday 23:00 is -60): for sorting across New Year
const order = (at, today) => -gapDays(String(at).slice(0, 5), today) * 1440 + Number(String(at).slice(6, 8)) * 60 + Number(String(at).slice(9, 11));
// what the sky is called on the weather line (as the weather app says it)
const SKY = { clear: '맑음', partly: '구름 조금', cloudy: '흐림', drizzle: '이슬비', rain: '비', sleet: '진눈깨비', snow: '눈', fog: '안개', storm: '뇌우', wind: '강풍' };
// how many of the newest bubbles the request carries, days ahead the calendar looks, story characters at most
export const LIVE_ASK = { bubbles: 60, ahead: 14, aheadMax: 4, story: 8000 };

// the phone's lists as the apps the reply prompt names (phone2reply.js PHONE2_APPS, in small letters), each with what
// tells its time and one line saying what it is
const APPS = [
    ['diary', p => p.diary, null, null],
    ['voice memo', p => p.voice, x => x.time, x => `"${one(x.title)}"`],
    ['notes', p => p.notes, x => x.time, x => `"${one(x.title)}"`],
    ['search', p => p.searches, x => x.time, x => `"${one(x.q)}"`],
    ['photos', p => p.photos, x => x.time, x => `"${one(x.caption)}"`],
    ['calls', p => p.calls, x => x.time, x => `${one(x.type) || 'call'} ${one(x.with)}`.trim()],
    ['posts', p => p.posts, x => x.time, x => `"${one(x.text).slice(0, 80)}"`],
    ['mail', p => p.mails, x => x.time, x => `from ${one(x.from)}: "${one(x.subject)}"${x.unread ? ' (unread)' : ''}`],
    ['delivery', p => p.delivery?.orders, x => x.time, x => `order from ${one(x.shop)}`],
    ['shopping', p => p.money?.orders, x => x.time, x => `${one(x.shop)}: ${one(x.item)}`],
    ['bank, cards & wallet', p => p.money?.tx, x => x.time, x => `${one(x.who)} ${x.amount}`],
    ['places', p => p.visits, x => x.time, x => one(x.place)],
    ['files', p => p.life?.files?.items, x => x.time, x => one(x.name)],
];
// every dated record the phone holds, as { app, at, what } (texts to others too; the persona's are the messenger's)
function records(p, persona) {
    const out = [];
    for (const [app, get, time, what] of APPS) if (time) for (const x of get(p) || []) if (AT.test(one(time(x))) && x?.src !== 'guess') out.push({ app, at: one(time(x)), what: what(x) });
    for (const t of p.threads || []) if (!same(t.with, persona)) for (const x of t.messages || []) if (AT.test(one(x.time)) && !x.deleted && x?.src !== 'guess')
        out.push({ app: 'messages', at: one(x.time), what: `${one(x.from) === 'me' || same(x.from, p.owner) ? 'to' : 'from'} ${one(t.with)}: "${one(x.text).slice(0, 80)}"` });
    return out;
}

// the values of one reply request (phone2ask.js replyInput's d), or null when there is no such phone or room.
// now: the real moment (ms); tz: where the owner is; deps: { clock(p, at) → the [OWNER'S CLOCK] block, around(p) → the
// [PEOPLE AROUND] block, card(owner) → the card's text, place(p) → where the phone last had the owner, blind(owner) → the
// [OWNER DOESN'T KNOW] block, story() → the story 폰 2 may read (asked for the first chat only) }; why · typed: as the caller has them
export function gatherReply(m, owner, roomId, { now = Date.now(), tz = 'UTC', deps = {}, why = '', typed = [] } = {}) {
    const w = liveWorld(m), p = livePhone(m, owner), room = w?.messenger?.rooms?.[roomId];
    if (!w || !p || !room || !room.members.some(n => same(n, owner))) return null;
    numberLive(w);
    const P = w.persona, wall = ms => liveWall(tz, w.dayShift, ms).at, at = wall(now), today = at.slice(0, 5), nowOrder = order(at, today);
    const mine = Object.values(w.messenger.rooms).filter(r => r.members.some(n => same(n, owner))).flatMap(r => r.messages || []).filter(x => same(x.from, owner)).sort((a, b) => a.n - b.n);
    const lastState = one([...mine].reverse().find(x => one(x.state))?.state);
    // the calendar: today's, then the days ahead (called-off plans left out)
    const evs = (p.events || []).filter(e => DAY.test(one(e.date)) && !e.cancelled && e?.src !== 'guess' && one(e.title));
    const line = (e, day) => `${day ? `${one(e.date)} ` : ''}${/^\d{2}:\d{2}$/.test(one(e.time)) ? `${one(e.time)} ` : ''}${one(e.title)}`;
    const byTime = (a, b) => gapDays(today, one(a.date)) - gapDays(today, one(b.date)) || one(a.time).localeCompare(one(b.time));
    const ahead = evs.filter(e => { const g = gapDays(today, one(e.date)); return g > 0 && g <= LIVE_ASK.ahead; }).sort(byTime).slice(0, LIVE_ASK.aheadMax);
    // what the phone last recorded (nothing dated past now), and when each app was last used (the owner's "does" too)
    const recs = records(p, P).filter(r => order(r.at, today) <= nowOrder).map(r => ({ ...r, order: order(r.at, today) }));
    const newest = [...recs].sort((a, b) => b.order - a.order)[0];
    const did = mine.flatMap(x => (Array.isArray(x.does) ? x.does : []).filter(d => one(d?.app)).map(d => ({ app: one(d.app).toLowerCase(), at: wall(x.at) }))).map(r => ({ ...r, order: order(r.at, today) }));
    const here = p.life?.weather?.here;
    const rain = Number(here?.hours?.[0]?.rain);
    // (the story: with the first chat on the messenger only; after it the phone, the people around and the chat carry it)
    const first = !(room.messages || []).some(x => same(x.from, owner));
    const story = first ? String(deps.story?.() || '').trim() : '';
    return {
        owner: p.owner, persona: P, // (the owner's languages: read with the voices, or set by the user in 말투; on the phone)
        langs: p.langs?.texts?.length || p.langs?.knows?.length ? p.langs : null,
        messenger: (room.messages || []).slice(-LIVE_ASK.bubbles).map(x => ({ at: wall(x.at), from: x.from, text: x.call ? `(call ${Math.max(0, Math.round(Number(x.call.min) || 0))} min)` : x.text, state: x.state })),
        now: {
            last: lastState || one(deps.place?.(p)),
            today: evs.filter(e => one(e.date) === today).sort(byTime).map(e => line(e, false)), ahead: ahead.map(e => line(e, true)),
            recorded: newest ? `${newest.app} ${newest.at} ${newest.what}` : '',
            story: w.from === 'story' && ((p.contacts || []).some(c => same(c.name, P)) || (p.threads || []).some(t => same(t.with, P))),
            first,
        },
        clock: deps.clock?.(p, at) || '',
        weather: here && one(here.date) === today && one(here.place) && Number.isFinite(Number(here.temp))
            ? `${one(here.place)} · ${SKY[here.cond] || one(here.cond)} · ${Math.round(Number(here.temp))}°${Number.isFinite(Number(here.hi)) && Number.isFinite(Number(here.lo)) ? ` (최고 ${Math.round(Number(here.hi))}° · 최저 ${Math.round(Number(here.lo))}°)` : ''}${Number.isFinite(rain) && here.hours?.length ? ` · 비 확률 ${Math.round(rain)}%` : ''}` : '',
        recent: [...recs, ...did], today,
        situations: (Array.isArray(p.situations) ? p.situations : []).filter(s => one(s?.what) && (one(s.state) !== 'done' || one(s.open))).map(s => ({ title: one(s.id) || one(s.what).slice(0, 40), what: s.what, state: s.state, known: s.known, open: s.open })),
        card: deps.card?.(p.owner) || '',
        voices: (Array.isArray(p.koVoice) ? p.koVoice : []).map(v => ({ who: v?.who ?? v?.from, style: v?.style })),
        around: deps.around?.(p) || '', blind: deps.blind?.(p.owner) || '',
        // (the newest of the story: whole sections from the end, as many as fit)
        story: story.length <= LIVE_ASK.story ? story : (cut => cut.slice(Math.max(0, cut.search(/^## /m))))(story.slice(-LIVE_ASK.story)),
        typed, why,
    };
}
