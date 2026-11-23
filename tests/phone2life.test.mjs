// 폰 2의 음성 메모 채우기 (phone2fill.js), 생활 · 배달 · 스크린타임 · 동네 가게 새로고침 (phone2life.js). 서랍은 진짜, 모델만 가짜예요.
// 옮기기 전의 실시간 갈림이 아직 phonedata.js에 있는 동안은, 똑같이 만든 두 실시간 폰에서 폰 2 것과 옮기기 전 것을
// 돌려 요청 글 · 결과 · 폰이 같은지 봐요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import { T, PD, F, LIFE, L2, snapFor } from './phone2reflect.load.mjs';

const src = f => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
const phone = () => ({ owner: 'Mara', now: '11-12 21:30', year: 2026, country: 'DE', lives: 'DE', contacts: [], threads: [], calls: [], photos: [], notes: [], searches: [], events: [], posts: [], mails: [], diary: [{ date: '11-10', title: '긴 하루', text: 'x' }], voice: [],
    money: { currency: 'EUR' },
    life: { at: '11-12 21:00', health: { usual: {}, days: ['11-09', '11-10', '11-11'].map(date => ({ date, sleep: '23:00', wake: '07:00', steps: 5000 })) }, weather: { here: { place: 'Frankfurt, Westend' }, cities: [{ name: 'Frankfurt' }, { name: 'Berlin' }] } },
    delivery: { nearbyAt: '11-08', nearbyRounds: 3, city: 'Frankfurt', orders: [{ shop: 'Pasta Nostra', time: '11-10 19:00' }, { shop: 'Old Diner', time: '08-01 19:00' }],
        shops: [{ id: 'a', name: 'Pasta Nostra', menu: [] }, { id: 'b', name: 'Old Diner', menu: [] }, { id: 'c', name: 'Sushi Ya', nearby: true, menu: [] }, { id: 'd', name: 'Döner Eck', nearby: true, menu: [] }] } });
function world() {
    T.chat = ['옛날 이야기 하나', '옛날 이야기 둘', '시작 직전 이야기', '시작 뒤 롤플 하나', '시작 뒤 롤플 둘'].map((mes, i) => ({ name: i % 2 ? 'Mara' : 'Ren', is_user: !(i % 2), mes, extra: {} }));
    T.recent = ['[#1] Mara: 옛날 이야기 둘', '[#2] Ren: 시작 직전 이야기', '[#3] Mara: 시작 뒤 롤플 하나', '[#4] Ren: 시작 뒤 롤플 둘'];
    // (채우기는 롤플 채팅의 줄을 읽어요: 반영 시험이 막아 둔 것을 여기서만 열어요)
    T.rows = T.chat.map((x, i) => ({ index: i, user: x.is_user, hidden: false, text: `[#${i}] ${x.name}: ${x.mes}` }));
    const real = { phones: { mara: phone() }, text: '' };
    L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test', now: 1763000000000 }).snap = snapFor(real, 2);
    const room = L.ensureRoom(real, ['Mara']);
    L.sendLive(real, room.id, '메신저로 한 말');
    const d = L.liveMeta(real, { now: () => '11-14 16:05' }), p = d.phones.mara;
    return { real, d, p };
}
async function run(fn, answers) {
    const c = world(), asked = [], p1 = JSON.stringify(c.real.phones), rnd = Math.random, uuid = globalThis.crypto.randomUUID, now = Date.now;
    let k = 0, u = 0;
    Math.random = () => ((++k * 7919) % 100003) / 100003; globalThis.crypto.randomUUID = () => `00000000-0000-4000-8000-${String(++u).padStart(12, '0')}`; Date.now = () => 1763100000000;
    const queue = [...answers];
    T.ask = async (input, o) => { asked.push([o.system, input]); const a = queue.shift(); return typeof a === 'function' ? a(input) : a ?? '{}'; };
    let out;
    try { out = { value: await fn(c) }; } catch (err) { out = { error: String(err?.message || err) }; }
    finally { delete T.ask; Math.random = rnd; globalThis.crypto.randomUUID = uuid; Date.now = now; }
    const copy = v => JSON.parse(JSON.stringify(v ?? null));
    return { asked, out: copy(out), phone: copy(c.p), finance: copy(c.d.finance), phone1Same: JSON.stringify(c.real.phones) === p1 };
}
// (옮기기 전의 갈림이 폰 1 파일에 있던 동안 두 쪽을 나란히 돌려 통째로 같은 걸 확인했고, 그 뒤 폰 1 쪽 줄을 지웠어요.
// 지금은 폰 2 것만 돌려요: 둘째 인자(옮기기 전 것)는 안 불러요)
const same = async (two, one, answers) => { const a = await run(two, answers); assert.equal(a.phone1Same, true); return a; };
const done = () => { delete T.ask; T.chat = []; delete T.recent; delete T.rows; };

test('음성 메모 채우기: 요청 글 · 결과가 옮기기 전과 같아요; 시작 뒤 롤플은 안 읽어요', async () => {
    try {
        const memos = JSON.stringify({ memos: [{ title: '밤 산책', text: '음… 오늘은 좀 길었어.', time: '11-11 23:10', sec: 40, place: '집 앞' }] });
        const r = await same(c => F.liveFillVoice(c.d, c.p), c => PD.fillVoice(c.d, c.p), [memos]);
        assert.equal(r.out.error, undefined);
        assert.equal(r.asked.length, 1); assert.equal(r.asked[0][0], PD.AI_SYS_VOICES);
        // (아카이브가 없는 채팅에서 이 요청은 시작 전 이야기를 통째로 싣고 최근 대화 칸은 안 실어요: 옮기기 전에도 그랬어요.
        // 그래서 메신저 대화가 안 들어가요 — 알려진 빈틈, 여기서는 옮기기 전과 같은지만 봐요)
        assert.ok(r.asked[0][1].includes('시작 직전 이야기') && !r.asked[0][1].includes('시작 뒤 롤플'));
        assert.ok(r.asked[0][1].includes('[DIARY]\n- 11-10 긴 하루') && r.asked[0][1].includes("[OWNER'S CLOCK]"));
        assert.equal(r.phone.voice[0].title, '밤 산책');
        const none = await same(c => F.liveFillVoice(c.d, c.p), c => PD.fillVoice(c.d, c.p), ['{"memos":[]}']);
        assert.equal(none.out.error, '모델 답에서 음성 메모를 찾지 못했어요');
    } finally { done(); }
});

test('스크린타임 채우기: 시작 뒤 롤플은 안 읽고, 결과가 실시간 폰의 건강 기록에 남아요; 오늘은 폰에 저장된 시각의 날', async () => {
    try {
        const answer = JSON.stringify({ usual: { daily: [{ app: 'YouTube', min: 60 }, { app: 'Messages', min: 30 }] }, days: [{ date: '11-10', apps: [{ app: 'YouTube', min: 90 }], pickups: 40 }, { date: '11-11', apps: [{ app: 'Messages', min: 45 }], pickups: 30 }] });
        const r = await same(c => L2.liveFillScreen(c.d, c.p), c => LIFE.fillScreen(c.d, c.p), [answer]);
        assert.equal(r.asked.length, 1); assert.equal(r.asked[0][0], LIFE.AI_SYS_SCREEN);
        assert.ok(r.asked[0][1].includes('시작 직전 이야기') && !r.asked[0][1].includes('시작 뒤 롤플'));
        // (오늘 11-12는 빼고 그 전 주의 날들)
        assert.ok(r.asked[0][1].includes('"date":"11-11"') && r.asked[0][1].includes('"date":"11-09"') && !r.asked[0][1].includes('"date":"11-12"'));
        assert.equal(r.out.value, 2); assert.deepEqual(r.phone.life.health.days.map(d => [d.date, d.screen?.pickups ?? null]), [['11-09', null], ['11-10', 40], ['11-11', 30]]); assert.deepEqual(r.phone.life.health.days[1].screen.apps, { YouTube: 90 });
        const ag = await same(c => L2.liveFillScreen(c.d, c.p, { again: true }), c => LIFE.fillScreen(c.d, c.p, { again: true }), [answer]);
        assert.equal(ag.out.value, 2); assert.equal(ag.asked.length, 1); assert.equal(ag.asked[0][0], LIFE.AI_SYS_SCREEN); assert.ok(!ag.asked[0][1].includes('시작 뒤 롤플'));
        // 건강 앱이 없으면 묻지 않고 같은 말로 멈춰요
        const none = await same(c => { delete c.p.life; return L2.liveFillScreen(c.d, c.p); }, c => { delete c.p.life; return LIFE.fillScreen(c.d, c.p); }, [answer]);
        assert.equal(none.out.error, '건강 앱을 먼저 채워 주세요'); assert.equal(none.asked.length, 0);
    } finally { done(); }
});

test('동네 가게 새로고침: 요청 글 · 결과가 옮기기 전과 같아요; 날짜는 폰에 저장된 시각', async () => {
    try {
        const shop = name => ({ name, cuisine: 'x', menu: [{ name: `${name} dish`, price: 9, top: true, pic: { base: 'pizza' } }, { name: `${name} 2`, price: 10 }] });
        const answer = JSON.stringify({ new: [shop('Bao Bar'), shop('Pasta Nostra')], gone: ['Sushi Ya', 'Pasta Nostra'] });
        const r = await same(c => L2.liveRefreshNearby(c.d, c.p), c => LIFE.refreshNearby(c.d, c.p), [answer]);
        assert.equal(r.out.value, 1); assert.equal(r.asked.length, 1); assert.equal(r.asked[0][0], LIFE.AI_SYS_NEARBY);
        const names = r.phone.delivery.shops.map(s => s.name);
        assert.ok(names.includes('Bao Bar') && names.includes('Pasta Nostra') && !names.includes('Sushi Ya'));
        assert.equal(r.phone.delivery.nearbyAt, '11-12');
        // 때가 안 됐으면 · 반영이 읽은 횟수만 세면: 묻지 않아요
        const early = await same(c => { c.p.delivery.nearbyRounds = 1; return L2.liveRefreshNearby(c.d, c.p, { read: true }); }, c => { c.p.delivery.nearbyRounds = 1; return LIFE.refreshNearby(c.d, c.p, { read: true }); }, [answer]);
        assert.equal(early.asked.length, 0); assert.equal(early.phone.delivery.nearbyRounds, 2);
        const first = await same(c => { delete c.p.delivery.nearbyAt; return L2.liveRefreshNearby(c.d, c.p); }, c => { delete c.p.delivery.nearbyAt; return LIFE.refreshNearby(c.d, c.p); }, [answer]);
        assert.equal(first.asked.length, 0); assert.equal(first.phone.delivery.nearbyAt, '11-12');
        // 새로 고칠 때가 됐는지: 폰 1 것과 같은 답
        const c = world();
        assert.equal(L2.liveNearbyDue(c.p), 'days'); assert.equal(L2.liveNearbyDue(c.p), LIFE.nearbyDue(c.p));
    } finally { done(); }
});

test('시계 · 건강 · 파일 · 날씨 채우기: 요청 글 · 결과 · 읽은 자리가 옮기기 전과 같아요; 롤플 상태창의 날씨는 안 실어요', async () => {
    try {
        const lifeAnswer = JSON.stringify({ clock: { alarms: [{ time: '07:00', label: 'A', days: ['mon'], on: true }] }, health: { usual: { height: 170, weight: 60 }, days: [{ date: '11-11', sleep: '23:30', wake: '07:10', steps: 6400 }] }, files: { items: [{ name: '여권 사본.pdf', kind: 'pdf', time: '11-10 09:00' }, { name: '내일 것.pdf', kind: 'pdf', time: '11-13 09:00' }] }, weather: null });
        const screen = JSON.stringify({ usual: { apps: [{ app: 'YouTube', kind: 'video', min: 60 }] }, days: [] });
        const r = await same(c => L2.liveFillLife(c.d, c.p), c => LIFE.fillLife(c.d, c.p), [lifeAnswer, screen]);
        assert.equal(r.out.error, undefined);
        const asked = r.asked.filter(([sys]) => sys === LIFE.AI_SYS_LIFE);
        assert.equal(asked.length, 1);
        const input = asked[0][1];
        assert.ok(input.includes('시작 직전 이야기') && !input.includes('시작 뒤 롤플') && !input.includes('[WEATHER NOW]'));
        // 폰의 지금은 폰에 저장된 시각; 그 뒤의 파일은 안 들어가요
        assert.ok(input.includes('"now":"11-12 21:30"'));
        assert.equal(r.phone.life.at, '11-12 21:30');
        assert.deepEqual(r.phone.life.files.items.map(x => x.name), ['여권 사본.pdf']);
        assert.equal(r.phone.life.clock.alarms[0].label, 'A');
        // 읽은 자리: 반영한 적 없는 폰은 시작한 곳 (메신저 번호 자리)
        assert.deepEqual(r.phone.sync.marks.life, { index: 2, user: -1, fp: '', tail: '' });
        // 스크린타임이 바로 뒤따라요 (같은 실시간 뼈대로)
        assert.equal(r.asked.at(-1)[0], LIFE.AI_SYS_SCREEN);
        // 답이 비었으면 같은 말로 멈추고 폰은 그대로
        const none = await same(c => L2.liveFillLife(c.d, c.p), c => LIFE.fillLife(c.d, c.p), ['{}']);
        assert.equal(none.out.error, '모델 답에서 시계 · 건강 · 파일 · 날씨 내용(JSON)을 찾지 못했어요');
        const sa = await same(c => L2.liveFillLife(c.d, c.p, { screenAgain: true }), c => LIFE.fillLife(c.d, c.p, { screenAgain: true }), [lifeAnswer, screen]);
        assert.equal(sa.out.error, undefined); assert.equal(sa.asked.at(-1)[0], LIFE.AI_SYS_SCREEN); assert.ok(sa.asked.every(([, input]) => !input.includes('시작 뒤 롤플')));
    } finally { done(); }
});

test('배달 채우기: 요청 글 · 결과 · 읽은 자리가 옮기기 전과 같아요', async () => {
    try {
        const dlv = JSON.stringify({ shops: [{ name: 'Uno', cuisine: 'pizza', menu: [{ name: 'Margherita', price: 9 }] }], orders: [{ shop: 'Uno', items: [{ name: 'Margherita', price: 9 }], time: '11-11 19:00', status: 'delivered' }, { shop: 'Uno', items: [{ name: 'Margherita', price: 9 }], time: '11-13 19:00', status: 'delivered' }], cart: null });
        // (은행이 없는 폰: 주문 값은 은행에 안 적어요)
        const r = await same(c => { delete c.p.money; return L2.liveFillDelivery(c.d, c.p); }, c => { delete c.p.money; return LIFE.fillDelivery(c.d, c.p); }, [dlv]);
        assert.equal(r.out.error, undefined);
        const asked = r.asked.filter(([sys]) => sys === LIFE.AI_SYS_DELIVERY);
        assert.equal(asked.length, 1);
        assert.ok(asked[0][1].includes('시작 직전 이야기') && !asked[0][1].includes('시작 뒤 롤플') && asked[0][1].includes('"now":"11-12 21:30"'));
        // 폰의 지금 뒤의 주문은 안 들어가요
        assert.deepEqual(r.phone.delivery.orders.map(o => o.time), ['11-11 19:00']);
        assert.equal(r.phone.delivery.at, '11-12 21:30'); assert.equal(r.phone.delivery.nearbyAt, '11-12');
        assert.deepEqual(r.phone.sync.marks.delivery, { index: 2, user: -1, fp: '', tail: '' });
        const none = await same(c => { delete c.p.money; return L2.liveFillDelivery(c.d, c.p); }, c => { delete c.p.money; return LIFE.fillDelivery(c.d, c.p); }, ['{}']);
        assert.equal(none.out.error, '모델 답에서 배달 내용(JSON)을 찾지 못했어요');
    } finally { done(); }
});

test('서랍이 아니면 모델을 부르기 전에 멈춰요; 사본은 폰 1 줄과 정해진 곳만 달라요', async () => {
    try {
        const c = world(); let asked = 0;
        T.ask = async () => { asked++; return '{}'; };
        const p = c.real.phones.mara, was = JSON.stringify(p);
        for (const m of [c.real, { ...c.real, phoneUpto: 2, phoneRecent: () => 'x' }]) for (const go of [() => F.liveFillVoice(m, p), () => L2.liveFillScreen(m, p), () => L2.liveRefreshNearby(m, p), () => L2.liveFillLife(m, p), () => L2.liveFillDelivery(m, p)]) await assert.rejects(go, /실시간 폰의 서랍이 아닙니다/);
        assert.equal(asked, 0); assert.equal(JSON.stringify(p), was);
    } finally { done(); }
    const a = await src('phonedata.js'), lf = await src('phonelife.js'), f = await src('phone2fill.js'), l2 = await src('phone2life.js'), api = await src('phone2api.js');
    const cut = (s, start, end = '\n}\n') => { const i = s.indexOf(start), j = s.indexOf(end, i); assert.ok(i >= 0 && j > i, start); return s.slice(i, j + end.length - 1); };
    const line = (s, start) => { const l = s.split('\n').find(x => x.startsWith(start)); assert.ok(l, start); return l; };
    const need = '    needLive(m);\n';
    assert.equal(cut(f, 'export async function liveFillVoice(').replace('function liveFillVoice(', 'function fillVoice(').replace(need, '').replace('liveSideRequest(', 'sideRequest(')
        .replace('liveFillClock(m, p, p.now, { story: true })', 'fillClock(m, p, p.now, null, windowOf(m, p), null, { story: true })'), cut(a, 'export async function fillVoice('));
    assert.equal(cut(l2, 'export const liveFillScreen = ', '\n});\n').replace('export const liveFillScreen = ', 'export const fillScreen = ').replace(`\n${need.slice(0, -1)}`, '').replace('liveWindowOf(m, p) }', 'windowOf(m, p) }')
        .replace('liveSavedNow(p)', 'storyNow(p, nowAt(read.gap))').replace('liveSideRequest(', 'sideRequest('), cut(lf, 'export const fillScreen = ', '\n});\n'));
    assert.equal(line(l2, 'const liveLately = ').replace('const liveLately = ', 'const lately = ').replace('liveSavedNow(p)', 'storyNow(p)'), line(lf, 'const lately = '));
    assert.equal(cut(l2, 'export function liveNearbyDue(').replace('function liveNearbyDue(', 'function nearbyDue(').replace('liveSavedNow(p)', 'storyNow(p)'), cut(lf, 'export function nearbyDue('));
    assert.equal(cut(l2, 'export async function liveRefreshNearby(').replace('function liveRefreshNearby(', 'function refreshNearby(').replace(need, '').replace('liveSavedNow(p)', 'storyNow(p)').replace('liveNearbyDue(p)', 'nearbyDue(p)')
        .replaceAll('liveLately(p, d, s.name)', 'lately(p, d, s.name)'), cut(lf, 'export async function refreshNearby('));
    // 생활 · 배달: 폰 1 줄과 정해진 곳만. 실시간 폰은 채팅을 이어 읽지 않아요(이야기는 요약본에 다 있어요): 폰 1의
    // 두 번째 차례와 그 차례만 쓰는 줄(soFar · short · said)은 사본에 없어요. 폰 1 쪽에서 그 부분만 빼면 같아요
    const cutOut = (t, from, to, put = '') => { const x = t.indexOf(from), y = t.indexOf(to, x); assert.ok(x >= 0 && y >= x, from); return t.slice(0, x) + put + t.slice(y + to.length); };
    const swap = (t, pairs) => pairs.reduce((r, [a, b]) => { assert.ok(r.includes(a), a); return r.replace(a, b); }, t);
    assert.ok(!/[sS]econdTurn|soFar|said\.|mergeLife|mergeDelivery/.test(l2));
    assert.equal(cut(l2, 'export function liveStoryDays(').replace('function liveStoryDays(', 'function storyDays(').replace('liveSavedNow(p)', 'storyNow(p, upto)'), cut(lf, 'export function storyDays('));
    assert.equal(cut(l2, 'const livePhoneNow = ', '\n});\n').replace('const livePhoneNow = ', 'const phoneNow = ').replace('liveSavedNow(p)', 'storyNow(p, upto)'), cut(lf, 'const phoneNow = ', '\n});\n'));
    assert.equal(cut(l2, 'export const liveFillLife = ', '\n});\n').replace('export const liveFillLife = ', 'export const fillLife = ').replace(`\n${need.slice(0, -1)}`, '')
        .replace('w = null,', 'w = weatherNow(upto),').replace('days = liveStoryDays(m, p, upto)', 'days = storyDays(m, p, upto)').replace('livePhoneNow(p, upto)', 'phoneNow(p, upto)').replace('liveSideRequest(', 'sideRequest(')
        .replace('liveFillClock(m, p, liveNowText(m, p) || p.now, { story: true })', 'fillClock(m, p, storyNow(p, upto, m) || p.now, statusAt(p, upto, m), gap, short, { story: true })')
        .replace("const at = liveSavedNow(p) || p.now || '';", "const at = storyNow(p, upto) || p.now || '';").replace('const first = liveWindowOf(m, p);', 'const first = windowOf(m, p);')
        .replaceAll('liveReadMark(', 'readMark(').replace('liveSavedNow(p)', 'storyNow(p, nowAt(first))').replace('await liveFillScreen(m, p,', 'await fillScreen(m, p,'),
    swap(cutOut(cut(lf, 'export const fillLife = ', '\n});\n'), '    let life = await turn(first), last = first, short = null;\n', "        catch (err) { console.warn('[narrative-archive] life, second turn', err); }\n    }\n", '    let life = await turn(first);\n'), [
        ['    // one turn: its window, and what the turn before wrote (none for the first); stopped short, its now is where it stopped\n    const turn = async (gap, soFar = null, short = null) => {', '    // the one request (실시간 폰은 채팅을 이어 읽지 않아요: 이야기는 요약본에 다 있어요)\n    const turn = async gap => {'],
        ['            !soFar && Object.keys(body).length ?', '            Object.keys(body).length ?'],
        ["            soFar ? `${soFarHead('LIFE', short)}\\n${JSON.stringify(soFar)}` : '', short?.text || '',\n", ''],
        ["        if (!soFar && raw && typeof raw === 'object'", "        if (raw && typeof raw === 'object'"],
        ['        said.set(next, { raw, now });\n', ''],
        ['readMark(last)?.index', 'readMark(first)?.index'], ['storyNow(p, nowAt(last))', 'storyNow(p, nowAt(first))'], ['marks.life = readMark(last) || mark0;', 'marks.life = readMark(first) || mark0;'],
        ["    turnsNote(last, '생활', short);\n", ''],
    ]));
    assert.equal(cut(l2, 'export const liveFillDelivery = ', '\n});\n').replace('export const liveFillDelivery = ', 'export const fillDelivery = ').replace(`\n${need.slice(0, -1)}`, '')
        .replace("at = liveSavedNow(p) || p.now || '';", "at = storyNow(p, upto) || p.now || '';").replace('livePhoneNow(p, upto)', 'phoneNow(p, upto)').replace('liveStoryDays(m, p, upto)', 'storyDays(m, p, upto)')
        .replace('liveFillClock(m, p, at, { story: true })', 'fillClock(m, p, at, statusAt(p, upto, m), gap, short, { story: true })').replace('liveSideRequest(', 'sideRequest(').replace('const first = liveWindowOf(m, p);', 'const first = windowOf(m, p);')
        .replace('liveSavedNow(p)', 'storyNow(p, nowAt(first))').replace('liveReadMark(', 'readMark('),
    swap(cutOut(cut(lf, 'export const fillDelivery = ', '\n});\n'), '    let d = await turn(first), last = first, short = null;\n', "        catch (err) { console.warn('[narrative-archive] delivery, second turn', err); }\n    }\n", '    const d = await turn(first);\n'), [
        ['    // two turns at most, like the life fill (secondTurn)\n    const turn = async (gap, soFar = null, short = null) => {', '    // the one request, like the life fill\n    const turn = async gap => {'],
        [" money,\n            soFar ? `${soFarHead('DELIVERY', short)}\\n${JSON.stringify(soFar)}` : '', short?.text || ''], {", ' money], {'],
        ["        if (!soFar && got && typeof got === 'object'", "        if (got && typeof got === 'object'"],
        ['        said.set(next, { raw: got });\n', ''],
        ["        // the shops nearby go after the ones they order from (the app's 동네 인기 가게); the first turn sets them\n        if (!soFar) next.shops =", "        // the shops nearby go after the ones they order from (the app's 동네 인기 가게)\n        next.shops ="],
        ['storyNow(p, nowAt(last))', 'storyNow(p, nowAt(first))'], ['marks.delivery = readMark(last) || mark0;', 'marks.delivery = readMark(first) || mark0;'],
        ["    turnsNote(last, '배달', short);\n", ''],
    ]));
    assert.doesNotMatch(lf, /isLivePhone|phoneUpto|phoneNow\(p\)|phone2/);
    for (const x of ['fillLife: split(fillLife, liveFillLife)', 'fillDelivery: split(fillDelivery, liveFillDelivery)']) assert.ok(api.includes(x), x);
    for (const x of ['fillVoice: split(fillVoice, liveFillVoice)', 'fillScreen: split(fillScreen, liveFillScreen)', 'refreshNearby: split(refreshNearby, liveRefreshNearby)']) assert.ok(api.includes(x), x);
});
