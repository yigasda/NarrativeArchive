// 폰 2의 투자 채우기 · 다시 만들기 · 시세 업데이트 · 평가 날짜 (phone2invest.js). 서랍은 진짜, 모델만 가짜예요.
// 옮기기 전의 실시간 갈림이 아직 phonedata.js에 있는 동안은, 똑같이 만든 두 실시간 폰에서 폰 2 것과 옮기기 전 것을
// 돌려 요청 글 · 결과 · 폰 · 장부 · 읽은 자리가 같은지 봐요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import { T, INV, I2, snapFor } from './phone2reflect.load.mjs';

const src = f => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
const phone = () => ({ owner: 'Mara', now: '11-12 21:30', year: 2026, country: 'DE', contacts: [], threads: [], calls: [], photos: [], notes: [], searches: [], events: [], posts: [], mails: [], diary: [], voice: [] });
const answer = amount => JSON.stringify({ base: 'EUR', cash: [{ currency: 'EUR', amount }], securities: [{ symbol: 'XETRA:SAP', name: 'SAP', currency: 'EUR' }], trades: [], watch: [], stakes: [], quotes: [], fx: [] });
function world() {
    T.chat = ['옛날 이야기 하나', '옛날 이야기 둘', '시작 직전 이야기', '시작 뒤 롤플 하나', '시작 뒤 롤플 둘'].map((mes, i) => ({ name: i % 2 ? 'Mara' : 'Ren', is_user: !(i % 2), mes, extra: {} }));
    T.recent = ['[#1] Mara: 옛날 이야기 둘', '[#2] Ren: 시작 직전 이야기', '[#3] Mara: 시작 뒤 롤플 하나', '[#4] Ren: 시작 뒤 롤플 둘'];
    // (채우기는 롤플 채팅의 줄을 읽어요: 반영 시험이 막아 둔 것을 여기서만 열어요)
    T.rows = T.chat.map((x, i) => ({ index: i, user: x.is_user, hidden: false, text: `[#${i}] ${x.name}: ${x.mes}` }));
    const real = { phones: { mara: phone() }, text: '' };
    L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test', now: 1763000000000 }).snap = snapFor(real, 2);
    const room = L.ensureRoom(real, ['Mara']);
    L.sendLive(real, room.id, '메신저로 한 말'); L.sendLive(real, room.id, '아직 반영 안 된 말');
    const d = L.liveMeta(real, { now: () => '11-14 16:05' }), p = d.phones.mara, first = room.messages[0].n;
    p.sync = { scope: 'x', marks: { base: { index: 2, user: -1, fp: '', tail: '' } }, done: [[first, first]], events: {} };
    return { real, d, p, first };
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
    return { asked, out: copy(out), phone: copy(c.p), finance: copy(c.d.finance), first: c.first, phone1Same: JSON.stringify(c.real.phones) === p1 };
}
// (옮기기 전의 갈림이 폰 1 파일에 있던 동안 두 쪽을 나란히 돌려 통째로 같은 걸 확인했고, 그 뒤 폰 1 쪽 줄을 지웠어요.
// 지금은 폰 2 것만 돌려요: 둘째 인자(옮기기 전 것)는 안 불러요)
const same = async (two, one, answers) => { const a = await run(two, answers); assert.equal(a.phone1Same, true); return a; };
const done = () => { delete T.ask; T.chat = []; delete T.recent; delete T.rows; };

test('투자 처음 채우기: 요청 글 · 결과 · 장부 · 읽은 자리가 옮기기 전과 같아요; 반영된 메신저 대화만 읽고, 자리는 메신저 번호', async () => {
    try {
        const r = await same(c => I2.liveFillInvestment(c.d, c.p, '2026-11-12'), c => INV.fillInvestment(c.d, c.p, '2026-11-12'), [answer(1000)]);
        assert.equal(r.out.error, undefined);
        const asked = r.asked.filter(([sys]) => sys === INV.INVEST_SYS);
        assert.equal(asked.length, 1);
        assert.ok(asked[0][1].includes('메신저로 한 말') && !asked[0][1].includes('아직 반영 안 된 말') && asked[0][1].includes('시작 직전 이야기') && !asked[0][1].includes('시작 뒤 롤플'));
        assert.equal(r.phone.investment.base, 'EUR'); assert.equal(r.phone.investment.date, '2026-11-12');
        assert.deepEqual(r.phone.sync.marks.invest, { index: r.first, user: -1, fp: '', tail: '' });
        // 이미 있으면 (다시 만들기가 아니면) 묻지 않고 같은 말로 멈춰요; 날짜가 틀려도
        const again = await same(async c => { await I2.liveFillInvestment(c.d, c.p, '2026-11-12'); return I2.liveFillInvestment(c.d, c.p, '2026-11-12'); }, async c => { await INV.fillInvestment(c.d, c.p, '2026-11-12'); return INV.fillInvestment(c.d, c.p, '2026-11-12'); }, [answer(1000), answer(5)]);
        assert.equal(again.out.error, '기존 투자 기록은 보존돼요. 시세 갱신을 사용해 주세요'); assert.equal(again.asked.filter(([sys]) => sys === INV.INVEST_SYS).length, 1);
        const bad = await same(c => I2.liveFillInvestment(c.d, c.p, 'x'), c => INV.fillInvestment(c.d, c.p, 'x'), [answer(1000)]);
        assert.equal(bad.out.error, '이야기 날짜를 YYYY-MM-DD로 입력해 주세요'); assert.equal(bad.asked.length, 0);
    } finally { done(); }
});

test('투자 다시 만들기 · 시세 업데이트: 옮기기 전과 같아요', async () => {
    try {
        const re = await same(async c => { await I2.liveFillInvestment(c.d, c.p, '2026-11-12'); return I2.liveFillInvestment(c.d, c.p, '2026-11-12', { regenerate: true }); },
            async c => { await INV.fillInvestment(c.d, c.p, '2026-11-12'); return INV.fillInvestment(c.d, c.p, '2026-11-12', { regenerate: true }); }, [answer(1000), answer(2500)]);
        assert.equal(re.out.error, undefined);
        assert.equal(re.asked.at(-1)[0], INV.INVEST_SYS + INV.INVEST_REBUILD);
        // 시세 업데이트: 투자가 없으면 투자 채우기로, 있으면 시세 요청으로
        const none = await same(c => I2.liveRefreshMarket(c.d, c.p, '2026-11-12'), c => INV.refreshMarket(c.d, c.p, '2026-11-12'), [answer(1000)]);
        assert.equal(none.out.error, undefined); assert.equal(none.phone.investment.base, 'EUR');
        const m = await same(async c => { await I2.liveFillInvestment(c.d, c.p, '2026-11-12'); return I2.liveRefreshMarket(c.d, c.p, '2026-11-13'); },
            async c => { await INV.fillInvestment(c.d, c.p, '2026-11-12'); return INV.refreshMarket(c.d, c.p, '2026-11-13'); }, [answer(1000), JSON.stringify({ quotes: [], fx: [] })]);
        assert.equal(m.asked.at(-1)[0], INV.MARKET_SYS); assert.ok(m.asked.at(-1)[1].includes('메신저로 한 말') && !m.asked.at(-1)[1].includes('시작 뒤 롤플'));
        // 과거 날짜로는 같은 말로 멈춰요
        const past = await same(async c => { await I2.liveFillInvestment(c.d, c.p, '2026-11-12'); return I2.liveRefreshMarket(c.d, c.p, '2026-11-01'); },
            async c => { await INV.fillInvestment(c.d, c.p, '2026-11-12'); return INV.refreshMarket(c.d, c.p, '2026-11-01'); }, [answer(1000)]);
        assert.match(past.out.error, /과거 날짜로 평가할 수 없어요/);
    } finally { done(); }
});

test('평가 날짜: 실시간은 흐르는 시계의 날 + 폰의 연도; 저장된 날짜가 있으면 그것; 폰 1 함수는 폰 2 전 줄 그대로', async () => {
    try {
        const { real, d, p } = world();
        assert.equal(I2.liveInvestmentDate(d, p), '2026-11-14');
        // 시계가 없는 서랍: 폰에 저장된 시각의 날
        assert.equal(I2.liveInvestmentDate(L.liveMeta(real), p), '2026-11-12');
        // 시계가 새해를 넘겼으면(저장된 시각 12-30, 폰의 연도 2026, 지금 01-02): 흐르는 시계의 날 + 그 다음 해
        const ny = L.liveMeta(real, { now: () => '01-02 10:00' }), was = [p.now, p.year];
        p.now = '12-30 21:00'; p.year = 2026;
        assert.equal(I2.liveInvestmentDate(ny, ny.phones.mara), '2027-01-02');
        assert.equal(p.year, 2026);
        [p.now, p.year] = was;
        // 저장된 평가 날짜가 있으면 그대로
        p.investment = { date: '2026-10-01' };
        assert.equal(I2.liveInvestmentDate(d, p), '2026-10-01');
        // 연도 표시를 끈 폰: 오늘 날짜로, 투자에 적어 둬요 (폰 1과 같은 규칙)
        p.investment = {}; p.noYear = true;
        const today = new Date().toISOString().slice(0, 10);
        assert.equal(I2.liveInvestmentDate(d, p), today); assert.equal(p.investment.date, today);
        // 연도가 없으면 날짜 없음
        delete p.investment; p.noYear = false; delete p.year;
        assert.equal(I2.liveInvestmentDate(d, p), '');
        assert.throws(() => I2.liveInvestmentDate(real, real.phones.mara), /실시간 폰의 서랍이 아닙니다/);
    } finally { done(); }
    const inv = await src('investdata.js');
    assert.doesNotMatch(inv, /phoneUpto|isLivePhone|phoneNow|live:/);
    assert.ok(inv.includes("    const day = storyNow(p, stopAt(m, p)).slice(0, 5), year = p.noYear ? '' : p.year ? String(p.year) : '';"));
});

test('서랍이 아니면 모델을 부르기 전에 멈춰요; 사본은 폰 1 줄과 정해진 곳만 달라요', async () => {
    try {
        const c = world(); let asked = 0;
        T.ask = async () => { asked++; return '{}'; };
        for (const m of [c.real, { ...c.real, phoneUpto: 2, phoneRecent: () => 'x' }]) for (const go of [() => I2.liveFillInvestment(m, c.real.phones.mara, '2026-11-12'), () => I2.liveRefreshMarket(m, c.real.phones.mara, '2026-11-12')]) await assert.rejects(go, /실시간 폰의 서랍이 아닙니다/);
        assert.equal(asked, 0); assert.equal(c.real.phones.mara.investment, undefined);
    } finally { done(); }
    const a = await src('investdata.js'), b = await src('phone2invest.js'), api = await src('phone2api.js');
    const body = (s, start) => { const i = s.indexOf(start), j = s.indexOf('\n}\n', i); assert.ok(i >= 0 && j > i, start); return s.slice(i, j + 2); };
    const need = '    needLive(m);\n';
    // 실시간 폰은 채팅을 이어 읽지 않아요 (이야기는 요약본에 다 있어요): 폰 1의 두 번째 차례는 사본에 없어요.
    // 폰 1 쪽에서 그 부분만 빼면 같아요
    const cutOut = (t, from, to, put = '') => { const x = t.indexOf(from), y = t.indexOf(to, x); assert.ok(x >= 0 && y >= x, from); return t.slice(0, x) + put + t.slice(y + to.length); };
    const cutLine = (t, l) => { assert.ok(t.includes(l), l); return t.replace(l, ''); };
    assert.ok(!b.includes('liveInvestMore') && !b.includes('liveLaterDate') && !/[sS]econdTurn/.test(b));
    assert.equal(body(b, 'async function liveMakeInvestment(').replace('async function liveMakeInvestment(', 'async function makeInvestment(').replace(need, '').replace('await livePrepareWealth(', 'await prepareWealth(').replace('liveSideRequest(', 'sideRequest(')
        .replaceAll('liveReadMark(', 'readMark('),
    cutLine(cutOut(body(a, 'async function makeInvestment('), "        // stopped short of the phone's clock: a second turn adds the rest", '        mark = readMark(last) || mark0;\n', '        mark = readMark(read.gap) || mark0;\n'), "        if (two) turnsNote(last, '투자', short); else readNote(read.gap);\n"));
    assert.equal(body(b, 'export async function liveRefreshMarket(').replace('function liveRefreshMarket(', 'function refreshMarket(').replace(need, '').replace('return liveFillInvestment(', 'return fillInvestment(').replace('liveSideRequest(', 'sideRequest('), body(a, 'export async function refreshMarket('));
    assert.equal(body(b, 'export function liveInvestmentDate(').replace('function liveInvestmentDate(', 'function investmentDate(').replace(need, '').replace("String(liveNowText(m, p) || '').slice(0, 5)", 'storyNow(p, stopAt(m, p)).slice(0, 5)').replace('String(liveYearFor(p, day))', 'String(p.year)'), body(a, 'export function investmentDate('));
    assert.ok(b.includes("export const liveFillInvestment = (m, p, date, opts = {}) => exclusive('fill', () => liveMakeInvestment(m, p, date, opts));") && a.includes("export const fillInvestment = (m, p, date, opts = {}) => exclusive('fill', () => makeInvestment(m, p, date, opts));"));
    assert.ok(api.includes('fillInvestment: split(fillInvestment, liveFillInvestment)') && api.includes('refreshMarket: split(refreshMarket, liveRefreshMarket)') && api.includes('investmentDate: investmentDateP'));
});
