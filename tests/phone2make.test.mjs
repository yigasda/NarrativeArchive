// 폰 2의 폰 다시 만들기 (phone2make.js): 고른 앱 · 폰 전체. 서랍은 진짜, 모델만 가짜예요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import { journalRead, journalWrite } from '../src/phonesync.js';
import { T, PD, MK, Y as YR, snapFor } from './phone2reflect.load.mjs';

const src = f => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
const phone = () => ({ owner: 'Mara', now: '11-12 21:30', year: 2026, country: 'DE', lives: 'DE', inject: false, wall: 'dusk', accent: 'blue', contacts: [{ name: 'Ivo' }], threads: [{ with: 'Ivo', messages: [{ from: 'Ivo', time: '11-12 20:00', text: 'hi' }] }],
    calls: [], photos: [], notes: [{ title: '옛 메모', text: 'x', time: '11-10 10:00' }], searches: [], events: [], posts: [], mails: [], diary: [], voice: [],
    where: { at: 1, people: [{ name: 'Mara', city: 'Frankfurt', tz: 'Europe/Berlin', lives: 'DE' }, { name: 'Ivo', city: 'Berlin', tz: 'Europe/Berlin', lives: 'DE' }] } });
const clock = at => ({ basis: 'Default used', finalViewpoint: 'Mara', elapsedTime: null, sceneTime: at, messageSender: null });
const whole = (now = '11-13 08:00') => JSON.stringify({ country: 'DE', now, clock: clock(now), contacts: [{ name: 'Ivo' }, { name: 'Ren' }], notes: [{ title: '새 메모', text: '다시 만든 것', time: '11-12 09:00' }], threads: [{ with: 'Ivo', messages: [{ from: 'Ivo', time: '11-12 20:00', text: 'hi' }] }] });
const notes = JSON.stringify({ notes: [{ title: '앱만 다시', text: '고른 앱', time: '11-12 09:30' }] });
function world({ where = true } = {}) {
    T.chat = ['옛날 이야기 하나', '옛날 이야기 둘', '시작 직전 이야기', '시작 뒤 롤플 하나', '시작 뒤 롤플 둘'].map((mes, i) => ({ name: i % 2 ? 'Mara' : 'Ren', is_user: !(i % 2), mes, extra: {} }));
    T.recent = ['[#1] Mara: 옛날 이야기 둘', '[#2] Ren: 시작 직전 이야기', '[#3] Mara: 시작 뒤 롤플 하나', '[#4] Ren: 시작 뒤 롤플 둘'];
    T.rows = T.chat.map((x, i) => ({ index: i, user: x.is_user, hidden: false, text: `[#${i}] ${x.name}: ${x.mes}` }));
    const real = { phones: { mara: phone() }, text: '' };
    L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test', now: 1763000000000 }).snap = snapFor(real, 2);
    const room = L.ensureRoom(real, ['Mara']);
    L.sendLive(real, room.id, '메신저로 한 말'); L.sendLive(real, room.id, '아직 반영 안 된 말');
    const d = L.liveMeta(real, { now: () => '11-14 16:05' }), p = d.phones.mara, first = room.messages[0].n;
    // (반영이 메신저 첫 마디까지 읽은 폰: 사용자가 연도를 3년 뒤로 골랐고, 상황이 하나 있어요)
    p.sync = { scope: 'x', marks: { base: { index: 2, user: -1, fp: '', tail: '' } }, done: [[first, first]], events: {} };
    Object.assign(p, { year: 2029, liveYearShift: 3, situations: [{ id: 's', what: 'w' }], liveHeld: { a: 1 } });
    if (!where) delete p.where;
    return { real, d, first };
}
async function run(fn, answers, opts) {
    const c = world(opts), asked = [], p1 = JSON.stringify(c.real.phones), rnd = Math.random, uuid = globalThis.crypto.randomUUID, now = Date.now, warn = console.warn;
    let k = 0, u = 0;
    Math.random = () => ((++k * 7919) % 100003) / 100003; globalThis.crypto.randomUUID = () => `00000000-0000-4000-8000-${String(++u).padStart(12, '0')}`; Date.now = () => 1763100000000; console.warn = () => {};
    // 복구 기록: 폰 1 것과 실시간 것에 Mara의 줄을 하나씩 둬요
    const liveKey = c.d.phoneJournal, round = () => [{ round: 'r1', owner: 'Mara', events: [], life: [] }];
    journalWrite('test', round()); journalWrite(liveKey, round());
    const queue = [...answers];
    T.ask = async (input, o) => { asked.push([o.system, input]); const a = queue.shift(); if (a instanceof Error) throw a; return typeof a === 'function' ? a(input) : a ?? '{}'; };
    let out;
    try { const v = await fn(c); out = { value: v === c.d.phones.mara ? 'the phone' : v }; } catch (err) { out = { error: String(err?.message || err) }; }
    finally { delete T.ask; Math.random = rnd; globalThis.crypto.randomUUID = uuid; Date.now = now; console.warn = warn; }
    const copy = v => JSON.parse(JSON.stringify(v ?? null));
    const r = { asked, out: copy(out), phone: copy(c.d.phones.mara), pre: copy(c.d.phonePre), first: c.first, journal1: journalRead('test').length, journal2: journalRead(liveKey).length, phone1Same: JSON.stringify(c.real.phones) === p1 };
    journalWrite('test', []); journalWrite(liveKey, []);
    return r;
}
const done = () => { delete T.ask; T.chat = []; delete T.recent; delete T.rows; };
// (옮기기 전의 갈림이 phonedata.js에 있던 동안 두 쪽을 나란히 돌려(same) 네 경우 모두 통째로 같은 걸 확인했고, 그 뒤 폰 1 쪽
// 줄을 지웠어요. 지금은 폰 2 것만 돌려서 기대하는 값과 비교해요)
const both = (two, one, answers, opts) => run(two, answers, opts);

test('고른 앱 다시 만들기: 반영된 메신저 대화를 읽고, 그 앱만 바뀌고, 읽은 자리 · 폰 시각 · 연도는 그대로', async () => {
    try {
        const r = await both(c => MK.liveMakePhone(c.d, 'Mara', { apps: ['note'] }), c => PD.makePhone(c.d, 'Mara', { apps: ['note'] }), [notes]);
        assert.equal(r.out.error, undefined); assert.equal(r.out.value, 'the phone');
        assert.equal(r.asked.length, 1); assert.equal(r.asked[0][0], PD.AI_SYS_PHONE_APPS);
        const input = r.asked[0][1];
        assert.ok(input.includes('메신저로 한 말') && !input.includes('아직 반영 안 된 말') && input.includes('시작 직전 이야기') && !input.includes('시작 뒤 롤플'));
        assert.ok(input.includes('[STORY YEAR]\n2029') && input.includes("[OWNER'S CLOCK]") && input.includes('[ONLY THESE]'));
        assert.deepEqual(r.phone.notes.map(n => n.title), ['앱만 다시']);
        assert.equal(r.phone.threads.length, 1); assert.equal(r.phone.now, '11-12 21:30');
        assert.deepEqual([r.phone.year, r.phone.liveYearShift], [2029, 3]);
        assert.deepEqual(r.phone.sync.done, [[r.first, r.first]]); assert.equal(r.phone.sync.marks.base.index, 2);
        assert.equal(r.phone1Same, true); assert.deepEqual([r.journal1, r.journal2], [1, 1]);
    } finally { done(); }
});

test('폰 전체 다시 만들기: 읽은 자리 · 폰 시각 · 고른 연도 · 상황이 그대로, 폰 1의 폰 · 복구 기록은 안 건드려요', async () => {
    try {
        const r = await both(c => MK.liveMakePhone(c.d, 'Mara'), c => PD.makePhone(c.d, 'Mara'), [whole()]);
        assert.equal(r.out.error, undefined); assert.equal(r.out.value, 'the phone');
        assert.equal(r.asked[0][0], PD.AI_SYS_PHONE);
        const input = r.asked[0][1];
        assert.ok(input.includes('메신저로 한 말') && !input.includes('아직 반영 안 된 말') && !input.includes('시작 뒤 롤플'));
        assert.deepEqual(r.phone.notes.map(n => n.title), ['새 메모']);
        // 모델이 준 시각(11-13 08:00)이 아니라 폰이 갖고 있던 시각
        assert.equal(r.phone.now, '11-12 21:30');
        assert.deepEqual([r.phone.year, r.phone.liveYearShift, r.phone.situations, r.phone.liveHeld], [2029, 3, [{ id: 's', what: 'w' }], { a: 1 }]);
        assert.deepEqual(r.phone.sync.done, [[r.first, r.first]]); assert.equal(r.phone.sync.scope, 'x');
        assert.equal(r.phone.where.people.length >= 2, true);
        assert.equal(r.phone1Same, true); assert.deepEqual([r.journal1, r.journal2], [1, 1]);
        // 답의 시각이 장면 시각과 안 맞으면 폰은 그대로 (같은 말로 멈춰요)
        const bad = JSON.stringify({ ...JSON.parse(whole()), clock: clock('11-13 03:00') });
        const off = await both(c => MK.liveMakePhone(c.d, 'Mara'), c => PD.makePhone(c.d, 'Mara'), [bad]);
        assert.match(off.out.error, /시간 판독 답이 맞지 않아요/); assert.deepEqual(off.phone.notes.map(n => n.title), ['옛 메모']);
    } finally { done(); }
});

test('위치 정보가 없던 실시간 폰을 통째로 다시 만들기: 위치를 먼저 읽고(실시간 뼈대로) 만들어요', async () => {
    try {
        const where = JSON.stringify({ people: [{ name: 'Mara', city: 'Frankfurt am Main', tz: 'Europe/Berlin', lives: 'DE' }, { name: 'Ivo', city: 'Seoul', tz: 'Asia/Seoul', lives: 'KR' }], around: [{ name: 'Ivo', about: '친구' }], year: 2026 });
        const r = await both(c => MK.liveMakePhone(c.d, 'Mara'), c => PD.makePhone(c.d, 'Mara'), [where, whole(), where], { where: false });
        assert.equal(r.out.error, undefined);
        assert.equal(r.asked[0][0], PD.AI_SYS_WHERE); assert.equal(r.asked[1][0], PD.AI_SYS_PHONE);
        assert.ok(r.asked.every(([, input]) => !input.includes('시작 뒤 롤플')));
        assert.ok(r.asked[0][1].includes('메신저로 한 말'));
        assert.equal(r.phone.where.people.find(x => x.name === 'Ivo').city, 'Seoul');
        assert.deepEqual([r.phone.year, r.phone.liveYearShift, r.phone.now], [2029, 3, '11-12 21:30']);
        assert.equal(r.pre, null); assert.equal(r.phone1Same, true);
    } finally { done(); }
});

test('폰 만들기 준비 (가져온 채팅뿐이라 폰이 없는 실시간 폰): 위치 · 연도를 먼저 읽어 두고, 만들 때 그걸 그대로 써요', async () => {
    const asked = [], now = Date.now, warn = console.warn;
    try {
        Date.now = () => 1763100000000; console.warn = () => {};
        const real = { phones: {}, text: '' };
        L.startFresh(real, { persona: 'Ren', scope: 'test', now: 1763000000000 });
        const room = L.ensureRoom(real, ['Mara']);
        L.sendLive(real, room.id, '가져온 메신저 말');
        const d = L.liveMeta(real, { now: () => '11-14 16:05' });
        const where = city => JSON.stringify({ people: [{ name: 'Mara', city, tz: 'Europe/Berlin', lives: 'DE' }], around: [], year: 2026 });
        const queue = [where('Frankfurt am Main'), where('Berlin'), whole('11-14 16:05'), where('Berlin')];
        T.ask = async (input, o) => { asked.push([o.system, input]); return queue.shift() ?? '{}'; };
        // 처음: 위치를 한 번 읽어서 실시간 폰 자리에 둬요 (폰 1 자리에는 아무것도 안 생겨요)
        const pre = await MK.livePreparePhone(d, 'Mara');
        assert.deepEqual(asked.map(x => x[0]), [PD.AI_SYS_WHERE]);
        assert.ok(asked[0][1].includes('가져온 메신저 말'));
        assert.deepEqual([pre.owner, pre.making, pre.base, pre.where.people[0].city, pre.noYear], ['Mara', true, false, 'Frankfurt am Main', undefined]);
        // (연도는 실시간 것: 흐르는 시계의 해. 롤플 상태창은 안 읽어요)
        assert.equal(pre.year, Number(YR.liveStoryYear(d, { ...pre, year: 0 })));
        assert.equal(L.liveWorld(real).pre.mara, pre); assert.equal(real.phonePre, undefined); assert.deepEqual(real.phones, {});
        // 다시 열면 읽어 둔 그대로 (모델을 안 불러요); "다시 연동"은 다시 읽어요
        assert.equal(await MK.livePreparePhone(d, 'Mara'), pre); assert.equal(asked.length, 1);
        const again = await MK.livePreparePhone(d, 'Mara', { again: true });
        assert.equal(asked.length, 2); assert.equal(again.where.people[0].city, 'Berlin'); assert.equal(d.phonePre.mara, again);
        // 만들기: 준비에서 읽은 위치로 바로 만들어요 (만들기 앞에 위치를 다시 읽지 않아요; 만든 뒤의 읽기는 폰 만들기의 것)
        const p = await MK.liveMakePhone(d, 'Mara');
        assert.deepEqual(asked.map(x => x[0]).slice(0, 3), [PD.AI_SYS_WHERE, PD.AI_SYS_WHERE, PD.AI_SYS_PHONE]);
        assert.ok(asked.slice(3).every(x => x[0] === PD.AI_SYS_WHERE) && asked.length <= 4);
        assert.equal(p.where.people[0].city, 'Berlin'); assert.equal(d.phones.mara, p); assert.deepEqual(real.phones, {});
        // 인물 정보 연동이 바뀌면 읽어 둔 걸 안 쓰고 다시 읽어요
        const other = L.liveMeta(real, { now: () => '11-14 16:05' });
        await MK.livePreparePhone(other, 'Ivo'); const n = asked.length;
        other.phoneProfiles = { ivo: { type: 'card', id: 'ivo.png' } };
        assert.equal((await MK.livePreparePhone(other, 'Ivo')).financeProfile.id, 'ivo.png'); assert.equal(asked.length, n + 1);
        // 서랍이 아니면 멈춰요
        const was = JSON.stringify(real);
        await assert.rejects(() => MK.livePreparePhone(real, 'Mara'), /실시간 폰의 서랍이 아니에요/);
        assert.equal(asked.length, n + 1); assert.equal(JSON.stringify(real), was);
    } finally { Date.now = now; console.warn = warn; done(); }
});

test('같은 폰을 만드는 중이면 기다리라고 해요; 반영(update)은 여기서 안 해요; 서랍이 아니면 멈춰요', async () => {
    try {
        const c = world(); let asked = 0, go;
        T.ask = () => new Promise(res => { asked++; go = () => res(notes); });
        const first = MK.liveMakePhone(c.d, 'Mara', { apps: ['note'] });
        await new Promise(r => setTimeout(r, 20));
        assert.equal(PD.phoneMaking(c.d, 'Mara'), true);
        await assert.rejects(() => MK.liveMakePhone(c.d, 'Mara', { apps: ['note'] }), /이 폰을 만드는 중이에요/);
        go(); await first;
        assert.equal(PD.phoneMaking(c.d, 'Mara'), false); assert.equal(asked, 1);
        await assert.rejects(() => MK.liveMakePhone(c.d, 'Mara', { update: true }), /실시간 폰은 메신저를 나갈 때 반영해요/);
        const p1 = c.real.phones.mara, was = JSON.stringify(p1);
        for (const m of [c.real, { ...c.real, phoneUpto: 2, phoneRecent: () => 'x', phoneJournal: 'test' }]) await assert.rejects(() => MK.liveMakePhone(m, 'Mara'), /실시간 폰의 서랍이 아니에요/);
        assert.equal(asked, 1); assert.equal(JSON.stringify(p1), was);
        // 요약본이 아직 없는 폰(요약본 방식 전에 시작해 둔 폰): 요약본을 못 받으면 모델을 부르지 않아요
        const n = world(); delete L.liveWorld(n.real).snap; L.setStoryKeeper(null);
        await assert.rejects(() => MK.liveMakePhone(n.d, 'Mara', { apps: ['note'] }), /이야기 요약본을 만들지 못했어요/);
        assert.equal(asked, 1);
    } finally { done(); }
});

test('사본은 폰 1 줄과 정해진 곳만 달라요 (한쪽만 고치면 실패); 폰 1의 만들기는 폰 2를 몰라요', async () => {
    const a = await src('phonedata.js'), b = await src('phone2make.js'), api = await src('phone2api.js');
    const cut = (s, start, end = '\n}\n') => { const i = s.indexOf(start), j = s.indexOf(end, i); assert.ok(i >= 0 && j > i, start); return s.slice(i, j + end.length - 1); };
    const line = (s, start) => { const l = s.split('\n').find(x => x.startsWith(start)); assert.ok(l, start); return l; };
    // 다시 만들기 본체
    // 실시간 폰은 채팅을 이어 읽지 않아요 (이야기는 요약본에 다 있어요): 폰 1의 두 번째 차례는 사본에 없어요.
    // 폰 1 쪽에서 그 부분만 빼면 같아요
    const cutOut = (t, from, to, put = '') => { const x = t.indexOf(from), y = t.indexOf(to, x); assert.ok(x >= 0 && y >= x, from); return t.slice(0, x) + put + t.slice(y + to.length); };
    const cutLine = (t, l) => { assert.ok(t.includes(l), l); return t.replace(l, ''); };
    assert.ok(!/[sS]econdTurn|liveTold|soFarHead/.test(b));
    const back = cut(b, '\nasync function liveMakePhone0(').replace('async function liveMakePhone0(', 'async function makePhone0(').replace('    await liveStoryReady(m);\n', '')
        .replace("    if (update) throw new Error('실시간 폰은 메신저를 나갈 때 반영해요');", '    if (update && m.phones?.[key]) return updatePhone(m, owner);')
        .replace('    // (폰 2, a phone it already has: always with its reading kept — it is made again from the story it began from and the\n    // messenger talk read so far)\n', '')
        .replace('keep = !!(apps && cur) || !!cur?.sync?.marks?.base;', "keep = !!(apps && cur) || !!(cur?.sync?.marks?.base && ['money', 'invest', 'life', 'delivery'].some(g => cur.sync.marks[g]));")
        .replace('const gap = liveWindowOf(m, keep ? cur : null);', 'const gap = keep ? windowOf(m, cur, null, CHAT_TOKENS.phone, false) : windowOf(m, null);').replace('liveReadMark(gap)', 'readMark(gap)')
        .replace('liveKeepPre(m, owner, binding)', 'keepPre(m, owner, binding)').replaceAll('livePreClock(m, pre)', 'preClock(m, pre)').replaceAll('liveEnsureYear(m, pre)', 'ensureYear(m, pre, nowAt(gap))')
        .replaceAll('await liveTryWhere(', 'await tryWhere(').replace('askDraft(livePhoneRequest(', 'askDraft(phoneRequest(')
        .replace(`        // (폰 2, a phone it already has made again: its reading of the messenger goes on where it was — the request showed
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
        if (liveAgain) { for (const k of ['liveYearShift', 'situations', 'liveHeld']) if (was[k] !== undefined) base[k] = was[k]; if (was.now) got.now = was.now; }
`, `        if (was?.sync?.marks?.base && ['money', 'invest', 'life', 'delivery'].some(g => was.sync.marks[g])) base.sync = was.sync;
        else {
            base.sync = newSync(phoneChatScope(ctx())); base.sync.marks.base = mark;
            // a reading started anew: the old one's unsaved rounds (복구) aren't this phone's
            try { const scope = phoneChatScope(ctx()); journalWrite(scope, journalRead(scope).filter(r => nameKey(r.owner) !== key)); } catch { /* no journal here */ }
        }
`).replace('    liveEnsureYear(m, p);\n', `    ensureYear(m, p, nowAt(gap));
    // (a year from the newest status line, read before the phone had its clock: on the owner's clock across New Year)
    if (!pre?.yearSet && !p.yearSet && p.year && !p.noYear) { const st = trackerYear(nowAt(gap)), sh = Number(p.yearShift) || 0; if (st && st.y + sh === p.year) p.year = acrossNewYear(st.y, st.day, p.now) + sh; }
`);
    assert.equal(back, ["        if (got2) mergePhone(p, { ...only(got2), profile: part.includes('profile') ? got2.profile : null }, { m });\n", "        turnsNote(last, '앱', short);\n", '        if (got2) mergePhone(m.phones[key], got2, { m });\n', "    if (two) turnsNote(last, '폰', short); else readNote(gap);\n"]
        .reduce(cutLine, cutOut(cut(a, '\nasync function makePhone0('), '    // made again up to the clock and stopped short: a second turn adds the rest (one that fails keeps the first)\n', "        } catch (err) { console.warn('[narrative-archive] phone, second turn', err); }\n    }\n")).replaceAll('nowAt(last)', 'nowAt(gap)'));
    assert.equal(cut(b, '\nexport function liveMakePhone(').replace('export function liveMakePhone(', 'export function makePhone(').replaceAll('liveMakePhone0(m, owner, opts)', 'makePhone0(m, owner, opts)'), cut(a, '\nexport function makePhone('));
    assert.equal(cut(b, '\nfunction liveKeepPre(').replace('function liveKeepPre(', 'function keepPre(').replace('liveEnsureYear(m, kept);', 'ensureYear(m, kept, nowAt(windowOf(m, null)));'), cut(a, '\nfunction keepPre('));
    assert.equal(cutLine(cut(b, '\nexport async function livePreparePhone('), '    needLive(m);\n').replace('export async function livePreparePhone(', 'export async function preparePhone(')
        .replace('liveKeepPre(m, owner, binding)', 'keepPre(m, owner, binding)').replaceAll('livePreClock(m, ', 'preClock(m, ').replace('await liveTryWhere(m, pre, asked);', 'await tryWhere(m, pre, asked);')
        .replace('liveEnsureYear(m, pre);', 'ensureYear(m, pre, nowAt(windowOf(m, null)));'), cut(a, '\nexport async function preparePhone('));
    assert.equal(line(b, 'const livePreClock = ').replace('const livePreClock = ', 'const preClock = ').replace('nowAt(liveWindowOf(m, null))', 'nowAt(windowOf(m, null))').replace('st = null', 'st = statusAt(pre, upto, m)'), line(a, 'const preClock = '));
    // 요청 글: 시계 블록 · 연도 · 메신저 대화
    assert.equal(cut(b, '\nfunction livePhoneRequest(').replace('function livePhoneRequest(', 'function phoneRequest(')
        // (실시간 폰: 최근 대화는 요약본에 든 이야기의 마지막 메시지, 이야기 글은 요약본 전부. 채팅이 이야기 자리에 들어가는 일은 없어요)
        .replace('const recent = liveBefore(m, 6, 6000);', 'const recent = recentPhoneText(6, { upto, maxChars: 6000 });').replace('const ar = liveArchiveFor(m, p ? p.upto ?? -1 : -1);', 'const ar = archiveFor(m, p ? p.upto ?? -1 : -1, nowAt(gap), !gap?.cut);')
        .replace("        // (폰 2: the story is its snapshot's text and nothing else; the role-play chat never stands in for it)\n        `[ARCHIVE${p ? ' — the sections since PHONE NOW' : ''}]\\n${ar.text || '(nothing new)'}`,", "        archiveBlock(m, ar.text || '(nothing new)', `ARCHIVE${p ? ' — the sections since PHONE NOW' : ''}`, CHAT_TOKENS.phone, upto),")
        .replace("return liveFillClock(m, q, story || (day ? `${day} 12:00` : todayWall()), { story: true, quiet: story ? false : day ? 'day' : true });", "return fillClock(m, q, story || (day ? `${day} 12:00` : todayWall()), st, gap, { text: extra.find(x => String(x).startsWith('[TOLD SHORT')) || '' }, { story: true, quiet: story ? false : day ? 'day' : true });")
        .replace('})(upto == null ? undefined : liveNowText(m, q) || undefined, null),', '})(upto == null ? undefined : storyNow(q, upto, m) || undefined, statusAt(q, upto, m)),').replace('liveYearBlock(m, q)', 'yearBlock(m, q, upto)')
        .replace(`        // (폰 2: after the story it began from, the messenger's talk its reflection has read — the summaries of the old
        // talk, then the lines — so a phone or an app made again holds what was said there too)
        ((story, talk) => (talk ? (story ? \`\${story}\\n\\n\${talk}\` : \`[RECENT CHAT]\\n\${talk}\`) : story))(recent ? \`[RECENT CHAT]\\n\${recent}\` : '',
            typeof m?.phoneRecent === 'function' && Number.isInteger(gap?.mark) ? m.phoneRecent(owner, 150, { maxChars: 12000, seen: gap.mark, summary: true }) : ''),
`, "        afterBlock(gap) || (recent && !noArchive(m) ? `[RECENT CHAT]\\n${recent}` : ''),\n"), cut(a, '\nfunction phoneRequest('));
    // 폰 1의 만들기 · 요청 · 위치 요청에는 폰 2 낱말이 없어요
    for (const f of ['\nasync function makePhone0(', '\nfunction phoneRequest(', '\nfunction whereRequest(', '\nfunction keepPre(', '\nexport async function preparePhone(']) assert.doesNotMatch(cut(a, f), /phoneUpto|phoneRecent|phoneJournal|liveAgain|liveYearShift|isLivePhone/, f.trim());
    assert.ok(api.includes('const makePhoneP = (...a) => (isLiveMeta(a[0]) ? liveMakePhone(...a) : makePhone(...a));') && api.includes('makePhone: makePhoneP'));
});
