// 폰 2의 위치 읽기 · 위치 정보 다시 연동 (phone2where.js). 서랍은 진짜, 모델만 가짜예요.
// 옮기기 전의 실시간 갈림이 아직 phonedata.js에 있는 동안은, 똑같이 만든 두 실시간 폰에서 폰 2 것과 옮기기 전 것을
// 돌려 요청 글 · 결과 · 폰이 같은지 봐요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import { T, PD, W2 } from './phone2reflect.load.mjs';

const src = f => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
const phone = () => ({ owner: 'Mara', now: '11-12 21:30', year: 2026, country: 'DE', contacts: [{ name: 'Ivo' }, { name: 'Ren' }], threads: [{ with: 'Ivo', messages: [] }], calls: [], photos: [], notes: [], searches: [], events: [], posts: [], mails: [], diary: [], voice: [],
    where: { at: 1, people: [{ name: 'Mara', city: 'Frankfurt', tz: 'Europe/Berlin', lives: 'DE' }, { name: 'Ivo', city: 'Berlin', tz: 'Europe/Berlin', lives: 'DE', manual: true }] } });
const answer = JSON.stringify({ people: [{ name: 'Mara', city: 'Frankfurt am Main', tz: 'Europe/Berlin', lives: 'DE' }, { name: 'Ivo', city: 'Seoul', tz: 'Asia/Seoul', lives: 'KR' }, { name: 'Ren', city: 'Seoul', tz: 'Asia/Seoul', lives: 'KR' }],
    around: [{ name: 'Ivo', about: 'Mara의 오랜 친구.' }], year: 2026 });
function world() {
    T.chat = ['옛날 이야기 하나', '옛날 이야기 둘', '시작 직전 이야기', '시작 뒤 롤플 하나', '시작 뒤 롤플 둘'].map((mes, i) => ({ name: i % 2 ? 'Mara' : 'Ren', is_user: !(i % 2), mes, extra: {} }));
    T.recent = ['[#1] Mara: 옛날 이야기 둘', '[#2] Ren: 시작 직전 이야기', '[#3] Mara: 시작 뒤 롤플 하나', '[#4] Ren: 시작 뒤 롤플 둘'];
    T.rows = T.chat.map((x, i) => ({ index: i, user: x.is_user, hidden: false, text: `[#${i}] ${x.name}: ${x.mes}` }));
    const real = { phones: { mara: phone() }, text: '' };
    L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test', now: 1763000000000, story: { ranges: {}, titles: [], rawFrom: 0, own: [''] } });
    const room = L.ensureRoom(real, ['Mara']);
    L.sendLive(real, room.id, '메신저로 한 말');
    const d = L.liveMeta(real, { now: () => '11-14 16:05' }), p = d.phones.mara;
    return { real, d, p };
}
async function run(fn, answers) {
    const c = world(), asked = [], p1 = JSON.stringify(c.real.phones), rnd = Math.random, uuid = globalThis.crypto.randomUUID, now = Date.now, warn = console.warn;
    let k = 0, u = 0;
    Math.random = () => ((++k * 7919) % 100003) / 100003; globalThis.crypto.randomUUID = () => `00000000-0000-4000-8000-${String(++u).padStart(12, '0')}`; Date.now = () => 1763100000000; console.warn = () => {};
    const queue = [...answers];
    T.ask = async (input, o) => { asked.push([o.system, input]); const a = queue.shift(); if (a instanceof Error) throw a; return typeof a === 'function' ? a(input) : a ?? '{}'; };
    let out;
    try { out = { value: await fn(c) }; } catch (err) { out = { error: String(err?.message || err) }; }
    finally { delete T.ask; Math.random = rnd; globalThis.crypto.randomUUID = uuid; Date.now = now; console.warn = warn; }
    const copy = v => JSON.parse(JSON.stringify(v ?? null));
    return { asked, out: copy(out), phone: copy(c.p), phone1Same: JSON.stringify(c.real.phones) === p1 };
}
const same = async (two, one, answers) => { const a = await run(two, answers), b = await run(one, answers); assert.deepEqual(a, b); assert.equal(a.phone1Same, true); return a; };
const done = () => { delete T.ask; T.chat = []; delete T.recent; delete T.rows; };

test('위치 정보 다시 연동: 요청 글 · 결과 · 폰이 옮기기 전과 같아요; 메신저 대화를 읽고 시작 뒤 롤플은 안 읽어요', async () => {
    try {
        const r = await same(c => W2.liveRereadPlaces(c.d, c.p), c => PD.rereadPlaces(c.d, c.p), [answer]);
        assert.equal(r.out.error, undefined);
        assert.equal(r.asked.length, 1); assert.equal(r.asked[0][0], PD.AI_SYS_WHERE);
        const input = r.asked[0][1];
        assert.ok(input.includes('[RECENT CHAT]\n[#1] Mara: 옛날 이야기 둘\n\n[#2] Ren: 시작 직전 이야기\n\nRen: 메신저로 한 말'));
        assert.ok(!input.includes('시작 뒤 롤플') && input.includes('[OWNER]\nMara') && input.includes('[PEOPLE]\nIvo\nRen'));
        // 새로 읽은 사람(Ren)이 들어가요
        assert.equal(r.phone.where.people.find(x => x.name === 'Ren').city, 'Seoul');
        // 전부 다시 연동도 옮기기 전과 같아요
        await same(c => W2.liveRereadPlaces(c.d, c.p, { all: true }), c => PD.rereadPlaces(c.d, c.p, { all: true }), [answer]);
        // 읽기가 실패하면 같은 말로 멈추고 폰의 위치는 그대로
        const fail = await same(c => W2.liveRereadPlaces(c.d, c.p), c => PD.rereadPlaces(c.d, c.p), [new Error('끊겼어요')]);
        assert.equal(fail.out.error, '끊겼어요'); assert.equal(fail.phone.where.people.length, 2); assert.equal(fail.phone.where.people[0].city, 'Frankfurt');
    } finally { done(); }
});

test('위치 읽기 (다시 만들기가 쓰는 것): 옮기기 전과 같고, 실패하면 실패했다고만 적어요', async () => {
    try {
        const r = await same(c => W2.liveReadWhere(c.d, c.p, { known: true }), c => PD.readWhere(c.d, c.p, { known: true }), [answer]);
        assert.equal(r.out.error, undefined); assert.equal(r.asked.length, 1);
        const t = await same(c => W2.liveTryWhere(c.d, c.p), c => PD.tryWhere(c.d, c.p), [new Error('끊겼어요')]);
        assert.equal(t.out.error, undefined); assert.equal(t.phone.where.failed, true);
    } finally { done(); }
});

test('서랍이 아니면 모델을 부르기 전에 멈춰요; 사본은 폰 1 줄과 정해진 곳만 달라요', async () => {
    try {
        const c = world(); let asked = 0;
        T.ask = async () => { asked++; return '{}'; };
        const p = c.real.phones.mara, was = JSON.stringify(p);
        for (const m of [c.real, { ...c.real, phoneUpto: 2, phoneRecent: () => 'x' }]) {
            await assert.rejects(() => W2.liveRereadPlaces(m, p), /실시간 폰의 서랍이 아니에요/);
            await assert.rejects(() => W2.liveReadWhere(m, p), /실시간 폰의 서랍이 아니에요/);
        }
        assert.equal(asked, 0); assert.equal(JSON.stringify(p), was);
    } finally { done(); }
    const a = await src('phonedata.js'), b = await src('phone2where.js'), api = await src('phone2api.js');
    const cut = (s, start, end = '\n}\n') => { const i = s.indexOf(start), j = s.indexOf(end, i); assert.ok(i >= 0 && j > i, start); return s.slice(i, j + end.length - 1); };
    const line = (s, start) => { const l = s.split('\n').find(x => x.startsWith(start)); assert.ok(l, start); return l; };
    const need = '    needLive(m);\n';
    assert.equal(cut(b, 'function liveWhereRequest(').replace('function liveWhereRequest(', 'function whereRequest(').replace(need, '').replace('upto = m.phoneUpto;', 'upto = readUpto(m, p);').replace('liveRecentText(m, p.owner, 8,', 'recentOf(m, p.owner, 8,'), cut(a, 'function whereRequest('));
    assert.equal(cut(b, 'export async function liveReadWhere(').replace('function liveReadWhere(', 'function readWhere(').replace('liveWhereRequest(m, p, opts)', 'whereRequest(m, p, opts)'), cut(a, 'export async function readWhere('));
    assert.equal(line(b, 'export const liveTryWhere = ').replace('export const liveTryWhere = ', 'export const tryWhere = ').replace('await liveReadWhere(', 'await readWhere('), line(a, 'export const tryWhere = '));
    assert.equal(cut(b, 'export async function liveRereadPlaces(').replace('function liveRereadPlaces(', 'function rereadPlaces(').replace(need, '').replace('await liveReadWhere(', 'await readWhere(').replace('liveEnsureYear(m, p);', 'ensureYear(m, p, nowAt(windowOf(m, null)));'), cut(a, 'export async function rereadPlaces('));
    assert.ok(api.includes('rereadPlaces: split(rereadPlaces, liveRereadPlaces)') && api.includes('preparePhone: preparePhoneP'));
});
