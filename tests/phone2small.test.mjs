// 폰 2의 요청만 하는 작은 채우기: 투자 기록 모으기 · 차트 시세 · 은행 환율 (phone2invest.js), 말투 읽기 (phone2voice.js).
// 서랍은 진짜, 모델만 가짜예요. 옮기기 전의 실시간 갈림이 아직 폰 1 파일에 있는 동안은, 똑같이 만든 두 실시간 폰에서
// 폰 2 것과 옮기기 전 것을 돌려 요청 글 · 결과 · 남은 데이터가 같은지 봐요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import { T, INV, I2, TR, V, snapFor } from './phone2reflect.load.mjs';

const src = f => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
const phone = () => ({ owner: 'Mara', now: '11-12 21:30', year: 2026, country: 'KR', contacts: [{ name: 'Ivo' }], threads: [{ with: 'Ivo', messages: [{ from: 'Ivo', time: '11-12 20:00', text: 'hi' }] }], calls: [], photos: [], notes: [], searches: [], events: [], posts: [], mails: [], diary: [], voice: [],
    money: { currency: 'KRW', bank: { accounts: [{ id: 'a', currency: 'KRW', last4: '1111' }, { id: 'b', currency: 'EUR', last4: '2222' }] }, tx: [] },
    investment: { date: '2026-11-12', base: 'KRW', accounts: [{ id: 'x', currency: 'EUR' }], securities: [{ symbol: 'SAP', name: 'SAP SE', currency: 'EUR' }], trades: [{ symbol: 'SAP', date: '2026-11-03', qty: 2, price: 180 }], watch: [], stakes: [], schedules: [], notes: [], generatedDates: ['2026-11-12'] } });
function world() {
    T.chat = ['옛날 이야기 하나', '옛날 이야기 둘', '시작 직전 이야기', '시작 뒤 롤플 하나', '시작 뒤 롤플 둘'].map((mes, i) => ({ name: i % 2 ? 'Mara' : 'Ren', is_user: !(i % 2), mes, extra: {} }));
    T.recent = ['[#1] Mara: 옛날 이야기 둘', '[#2] Ren: 시작 직전 이야기', '[#3] Mara: 시작 뒤 롤플 하나', '[#4] Ren: 시작 뒤 롤플 둘'];
    const real = { phones: { mara: phone() }, text: '' };
    L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test', now: 1763000000000 }).snap = snapFor(real, 2);
    const room = L.ensureRoom(real, ['Mara']);
    L.sendLive(real, room.id, '메신저로 한 말');
    const d = L.liveMeta(real, { now: () => '11-14 16:05' });
    return { real, d, p: d.phones.mara };
}
// 한 번 돌리기: 물은 글들, 결과(또는 오류 글), 그 뒤 실시간 폰 · 장부 · 폰 1의 폰
async function run(fn, answer) {
    const c = world(), asked = [], p1 = JSON.stringify(c.real.phones);
    T.ask = async (input, o) => { asked.push([o.system, input]); return typeof answer === 'function' ? answer(input) : answer; };
    let out;
    try { out = { value: await fn(c) }; } catch (err) { out = { error: String(err?.message || err) }; }
    delete T.ask;
    const strip = v => JSON.parse(JSON.stringify(v ?? null, (k, x) => (k === 'at' || k === 'generatedAt' ? undefined : x)));
    return { asked, out: strip(out), phone: strip(c.p), finance: strip(c.d.finance), phone1Same: JSON.stringify(c.real.phones) === p1 };
}
// (옮기기 전의 갈림이 폰 1 파일에 있던 동안 두 쪽을 나란히 돌려 통째로 같은 걸 확인했고, 그 뒤 폰 1 쪽 줄을 지웠어요.
// 지금은 폰 2 것만 돌려요: 둘째 인자(옮기기 전 것)는 안 불러요)
const same = async (two, one, answer) => { const a = await run(two, answer); assert.equal(a.phone1Same, true); return a; };
const done = () => { delete T.ask; T.chat = []; delete T.recent; };
const talk = r => r.asked.every(([, input]) => input.includes('메신저로 한 말') && !input.includes('시작 뒤 롤플'));

test('투자 기록 모으기 · 노트: 메신저 대화를 읽고 시작 뒤 롤플은 안 읽어요, 결과는 실시간 폰에만 남아요', async () => {
    try {
        const records = JSON.stringify({ schedules: [], notes: [], records: [] });
        const r = await same(c => I2.liveCollectInvestmentRecords(c.d, c.p), c => INV.collectInvestmentRecords(c.d, c.p), records);
        assert.equal(r.asked.length, 1); assert.equal(r.asked[0][0], INV.INVEST_RECORDS_SYS); assert.ok(talk(r));
        assert.equal(r.out.error, undefined); assert.deepEqual(r.out.value.schedules, []); assert.equal(r.phone.investment.recordsChecked, '2026-11-12');
        const n = await same(c => I2.liveCollectInvestmentRecords(c.d, c.p, 'notes', 'stock:SAP'), c => INV.collectInvestmentRecords(c.d, c.p, 'notes', 'stock:SAP'), JSON.stringify({ notes: [] }));
        assert.equal(n.asked[0][0], INV.INVEST_NOTES_SYS); assert.ok(talk(n));
        // 투자 계좌가 없으면 묻지 않고 같은 말로 멈춰요
        const none = await same(c => { delete c.p.investment; return I2.liveCollectInvestmentRecords(c.d, c.p); }, c => { delete c.p.investment; return INV.collectInvestmentRecords(c.d, c.p); }, records);
        assert.equal(none.asked.length, 0); assert.equal(none.out.error, '투자 계좌를 먼저 만들어 주세요');
    } finally { done(); }
});

test('차트 시세 · 은행 환율: 메신저 대화를 읽고, 받은 시세 · 환율이 실시간 장부에만 들어가요', async () => {
    try {
        const c = await same(x => I2.liveFillChartHistory(x.d, x.p, 'SAP', '1w'), x => INV.fillChartHistory(x.d, x.p, 'SAP', '1w'), JSON.stringify({ quotes: [{ symbol: 'SAP', date: '2026-11-10', value: 181 }, { symbol: 'SAP', date: '2026-11-11', value: 183 }, { symbol: 'XXX', date: '2026-11-11', value: 5 }] }));
        assert.equal(c.asked.length, 1); assert.equal(c.asked[0][0], INV.CHART_SYS); assert.ok(talk(c));
        assert.equal(c.out.value, 2); assert.equal(c.finance.prices['STOCK:SAP']['2026-11-11'].rows[0].value, 183); assert.deepEqual(Object.keys(c.finance.prices), ['STOCK:SAP']);
        // 쓸 시세가 하나도 없으면 같은 말로 멈추고 장부는 그대로예요
        const empty = await same(x => I2.liveFillChartHistory(x.d, x.p, 'SAP', '1w'), null, JSON.stringify({ quotes: [] }));
        assert.equal(empty.out.error, '추가할 시세를 받지 못했어요. 다시 시도해 주세요'); assert.deepEqual(empty.finance.prices, {});
        const fx = await same(x => I2.liveRefreshBankFX(x.d, x.p, '2026-11-12', 'KRW'), x => INV.refreshBankFX(x.d, x.p, '2026-11-12', 'KRW'), JSON.stringify({ fx: [{ from: 'EUR', to: 'KRW', date: '2026-11-12', value: 1510 }, { from: 'USD', to: 'KRW', date: '2026-11-12', value: 1400 }] }));
        assert.equal(fx.asked.length, 1); assert.equal(fx.asked[0][0], INV.MARKET_SYS); assert.ok(talk(fx)); assert.ok(fx.asked[0][1].includes('[FX PAIRS]\nEUR/KRW'));
        assert.equal(fx.out.error, undefined); assert.equal(fx.finance.prices['FX:EUR/KRW']['2026-11-12'].rows[0].value, 1510); assert.deepEqual(Object.keys(fx.finance.prices), ['FX:EUR/KRW']);
        // 날짜가 틀리면 묻지 않고 같은 말로 멈춰요
        const bad = await same(x => I2.liveRefreshBankFX(x.d, x.p, 'x', 'KRW'), x => INV.refreshBankFX(x.d, x.p, 'x', 'KRW'), '{}');
        assert.equal(bad.asked.length, 0); assert.equal(bad.out.error, '환산 날짜와 표시 통화를 확인해 주세요');
    } finally { done(); }
});

test('말투 읽기 (번역 전에 · 이야기에서 뽑기): 메신저 대화를 읽고, 읽은 말투가 실시간 폰에만 남아요', async () => {
    try {
        const answer = JSON.stringify({ people: [{ who: 'Ivo', style: '짧게, 반말', label: '친구', evidence: ['hi'] }], langs: { main: ['Korean'] } });
        const pick = await same(c => V.livePickVoices(c.d, 'Mara', c.p, ['Ivo', 'Nobody']), c => TR.pickVoices(c.d, 'Mara', c.p, ['Ivo', 'Nobody']), answer);
        assert.equal(pick.asked.length, 1); assert.equal(pick.asked[0][0], TR.AI_SYS_PHONE_VOICE); assert.ok(talk(pick));
        assert.deepEqual(pick.out.value, { found: ['Ivo'], missing: ['Nobody'] });
        assert.equal(pick.phone.koVoice[0].style, '짧게, 반말');
        const learn = await same(c => V.liveLearnVoices(c.d, 'Mara', c.p, { all: true }), c => TR.learnVoices(c.d, 'Mara', c.p, { all: true }), answer);
        assert.equal(learn.asked.length, 1); assert.equal(learn.asked[0][0], TR.AI_SYS_PHONE_VOICE); assert.ok(talk(learn)); assert.equal(learn.out.error, undefined);
        assert.equal(learn.phone.koVoice.find(v => v.who === 'Ivo').style, '짧게, 반말');
        // 뽑을 이름이 없으면 묻지 않아요
        const none = await same(c => V.livePickVoices(c.d, 'Mara', c.p, []), c => TR.pickVoices(c.d, 'Mara', c.p, []), answer);
        assert.equal(none.asked.length, 0);
    } finally { done(); }
});

test('서랍이 아니면 (폰 1의 메타, 서랍 흉내) 모델을 부르기 전에 멈춰요', async () => {
    try {
        const c = world(); let asked = 0;
        T.ask = async () => { asked++; return '{}'; };
        for (const m of [c.real, { ...c.real, phoneUpto: 2, phoneRecent: () => 'x' }]) {
            const p = c.real.phones.mara;
            for (const go of [() => I2.liveCollectInvestmentRecords(m, p), () => I2.liveFillChartHistory(m, p, 'SAP'), () => I2.liveRefreshBankFX(m, p, '2026-11-12', 'KRW'), () => V.liveLearnVoices(m, 'Mara', p, { all: true }), () => V.livePickVoices(m, 'Mara', p, ['Ivo'])])
                await assert.rejects(go, /실시간 폰의 서랍이 아니에요/);
        }
        assert.equal(asked, 0);
    } finally { done(); }
});

test('폰 2 사본은 폰 1 줄과 정해진 곳만 달라요 (한쪽만 고치면 실패)', async () => {
    const inv = await src('investdata.js'), tr = await src('phonetr.js'), i2 = await src('phone2invest.js'), v2 = await src('phone2voice.js'), api = await src('phone2api.js');
    const body = (s, start) => { const i = s.indexOf(start), j = s.indexOf('\n}\n', i); assert.ok(i >= 0 && j > i, start); return s.slice(i, j + 2); };
    const up = n => `live${n[0].toUpperCase()}${n.slice(1)}`;
    for (const n of ['collectInvestmentRecords', 'fillChartHistory', 'refreshBankFX'])
        assert.equal(body(i2, `export async function ${up(n)}(`).replace(`function ${up(n)}(`, `function ${n}(`).replace('    needLive(m);\n', '').replaceAll('liveSideRequest(', 'sideRequest('), body(inv, `export async function ${n}(`), n);
    assert.equal(body(v2, 'async function liveAskVoices(').replace('function liveAskVoices(', 'function askVoices(').replace('    needLive(m);\n', '').replaceAll('liveSideRequest(', 'sideRequest('), body(tr, 'async function askVoices('));
    for (const n of ['learnVoices', 'pickVoices'])
        assert.equal(body(v2, `export async function ${up(n)}(`).replace(`function ${up(n)}(`, `function ${n}(`).replace('    needLive(m);\n', '').replaceAll('liveAskVoices(', 'askVoices('), body(tr, `export async function ${n}(`), n);
    for (const n of ['collectInvestmentRecords', 'fillChartHistory', 'refreshBankFX']) assert.ok(api.includes(`${n}: split(${n}, ${up(n)})`), n);
    for (const n of ['learnVoices', 'pickVoices']) assert.ok(api.includes(`${n}: split(${n}, ${up(n)}, 2)`), n);
});
