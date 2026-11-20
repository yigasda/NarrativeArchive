// 폰 2의 은행 · 지갑 · 쇼핑 채우기 (phone2money.js). 서랍은 진짜, 모델만 가짜예요.
// 옮기기 전의 실시간 갈림이 아직 phonedata.js에 있는 동안은, 똑같이 만든 두 실시간 폰에서 폰 2 것과 옮기기 전 것을
// 돌려 요청 글 · 결과 · 폰 · 장부 · 읽은 자리가 같은지 봐요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import { T, PD, M2, snapFor } from './phone2reflect.load.mjs';

const src = f => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
const phone = () => ({ owner: 'Mara', now: '11-12 21:30', year: 2026, country: 'DE', contacts: [], threads: [], calls: [], photos: [], notes: [], searches: [], events: [], posts: [], mails: [], diary: [], voice: [] });
const moneyAnswer = (who, balance, time) => JSON.stringify({ currency: 'EUR', bank: { name: 'Varo Bank', accounts: [{ id: '', kind: 'checking', name: 'Main', last4: '1111', currency: 'EUR', balance }] },
    cards: [{ account: '1111', exp: '09/29' }], tx: [{ account: '1111', who, amount: -12, time, kind: 'card' }], passes: [], orders: [{ shop: 'Ivo Books', item: who, price: 12, time, status: 'delivered' }] });
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
    // (the reflection has read the first messenger message)
    p.sync = { scope: 'x', marks: { base: { index: 2, user: -1, fp: '', tail: '' } }, done: [[first, first]], events: {} };
    return { real, d, p, first };
}
// 한 번 돌리기 (무작위 번호는 두 번이 똑같이 나오게): 물은 글들, 결과(또는 오류 글), 그 뒤 실시간 폰 · 장부 · 폰 1의 폰
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

test('은행 처음 채우기: 요청 글 · 결과 · 장부 · 읽은 자리가 옮기기 전과 같아요; 반영된 메신저 대화만 읽고, 자리는 메신저 번호', async () => {
    try {
        const r = await same(c => M2.liveFillMoney(c.d, c.p), c => PD.fillMoney(c.d, c.p), [moneyAnswer('Bakery', 500, '11-10 09:00')]);
        assert.equal(r.out.error, undefined);
        const money = r.asked.filter(([sys]) => sys === PD.AI_SYS_MONEY);
        assert.equal(money.length, 1);
        const input = money[0][1];
        assert.ok(input.includes('메신저로 한 말') && !input.includes('아직 반영 안 된 말') && input.includes('시작 직전 이야기') && !input.includes('시작 뒤 롤플'));
        // 폰의 지금은 폰에 저장된 시각, 시계 블록에 롤플 메시지 번호는 없어요
        assert.ok(input.includes('"now":"11-12 21:30"'));
        assert.ok(input.includes("[OWNER'S CLOCK]") && !/Clock reference time|#\d+ ·/.test(input.slice(input.indexOf("[OWNER'S CLOCK]"), input.indexOf("[OWNER'S CLOCK]") + 400)));
        assert.equal(r.phone.money.bank.accounts[0].last4, '1111');
        assert.deepEqual(r.phone.sync.marks.money, { index: r.first, user: -1, fp: '', tail: '' });
        assert.ok(r.finance && Object.keys(r.finance.accounts || {}).length === 1);
    } finally { done(); }
});

test('은행이 있을 때 다시 채우기 · 잔액까지 새로 만들기: 옮기기 전과 같아요', async () => {
    try {
        const first = moneyAnswer('Bakery', 500, '11-10 09:00');
        // 있는 은행에 채우기: 계좌 · 거래는 그대로, 이름 · 카드 · 주문만
        const again = await same(async c => { await M2.liveFillMoney(c.d, c.p); return M2.liveFillMoney(c.d, c.p); }, async c => { await PD.fillMoney(c.d, c.p); return PD.fillMoney(c.d, c.p); }, [first, moneyAnswer('Cafe', 900, '11-11 10:00')]);
        assert.equal(again.out.error, undefined);
        assert.equal(again.phone.money.tx[0].who, 'Bakery');
        // 잔액까지 새로 만들기: 답은 요청에 적힌 계좌 번호(id)를 그대로 돌려줘요
        const rebuild = input => { const acc = JSON.parse(/\[REBUILD ACCOUNTS\]\n(.*)\n/.exec(input)[1]); return JSON.stringify({ currency: 'EUR', bank: { name: 'Varo Bank', accounts: acc.map(a => ({ ...a, balance: 777 })) }, cards: [], tx: [{ account: '1111', who: 'Rent', amount: -300, time: '11-11 08:00', kind: 'transfer' }], passes: [], orders: [] }); };
        const re = await same(async c => { await M2.liveFillMoney(c.d, c.p); return M2.liveFillMoney(c.d, c.p, { regenerateBalances: true }); }, async c => { await PD.fillMoney(c.d, c.p); return PD.fillMoney(c.d, c.p, { regenerateBalances: true }); }, [first, rebuild]);
        assert.equal(re.out.error, undefined);
        assert.equal(re.phone.money.tx[0].who, 'Rent'); assert.equal(re.phone.money.bank.accounts[0].balance, 777);
        // 답이 JSON이 아니면 같은 말로 멈추고, 폰은 그대로
        const bad = await same(c => M2.liveFillMoney(c.d, c.p), c => PD.fillMoney(c.d, c.p), ['not json']);
        assert.ok(bad.out.error); assert.equal(bad.phone.money, undefined);
    } finally { done(); }
});

test('서랍이 아니면 모델을 부르기 전에 멈춰요; 사본은 폰 1 줄과 정해진 곳만 달라요', async () => {
    try {
        const c = world(); let asked = 0;
        T.ask = async () => { asked++; return '{}'; };
        for (const m of [c.real, { ...c.real, phoneUpto: 2, phoneRecent: () => 'x' }]) await assert.rejects(() => M2.liveFillMoney(m, c.real.phones.mara), /실시간 폰의 서랍이 아니에요/);
        assert.equal(asked, 0); assert.equal(c.real.phones.mara.money, undefined);
    } finally { done(); }
    const a = await src('phonedata.js'), b = await src('phone2money.js'), q = await src('phone2req.js'), api = await src('phone2api.js');
    const body = (s, start) => { const i = s.indexOf(start), j = s.indexOf('\n}\n', i); assert.ok(i >= 0 && j > i, start); return s.slice(i, j + 2); };
    // 실시간 폰은 채팅을 이어 읽지 않아요 (이야기는 요약본에 다 있어요): 폰 1의 두 번째 차례는 사본에 없어요.
    // 폰 1 쪽에서 그 부분만 빼면 같아요
    const cutOut = (t, from, to, put = '') => { const x = t.indexOf(from), y = t.indexOf(to, x); assert.ok(x >= 0 && y >= x, from); return t.slice(0, x) + put + t.slice(y + to.length); };
    const cutLine = (t, l) => { assert.ok(t.includes(l), l); return t.replace(l, ''); };
    assert.ok(!/[sS]econdTurn|liveTold/.test(b) && !/[sS]econdTurn|liveTold|atStart|chatBound/.test(q));
    const back = body(b, 'async function liveMakeMoney(').replace('async function liveMakeMoney(', 'async function makeMoney(').replace('    needLive(m);\n', '')
        .replace('liveWindowOf(m, p) }', 'windowOf(m, p) }').replace('liveSavedNow(p)', 'storyNow(p, nowAt(read.gap))')
        .replace('await livePrepareWealth(m,p,regenerateBalances)', 'await prepareWealth(m,p,regenerateBalances)')
        .replace('liveFillClock(m, p, at)', 'fillClock(m, p, at, statusAt(p, nowAt(read.gap), m), read.gap)')
        .replaceAll('liveReadMark(', 'readMark(').replaceAll('liveSideRequest(', 'sideRequest(');
    assert.equal(back, cutLine(cutOut(body(a, 'async function makeMoney('), "        // stopped short of the phone's clock: a second turn adds the history the rest of the story has", '        mark = readMark(last) || mark0;\n', '        mark = readMark(read.gap) || mark0;\n'), "        if (two) turnsNote(last, '은행', short); else readNote(read.gap);\n"));
    assert.ok(b.includes("export const liveFillMoney = (m, p, opts = {}) => exclusive('fill', () => liveMakeMoney(m, p, opts));") && a.includes("export const fillMoney = (m, p, opts = {}) => exclusive('fill', () => makeMoney(m, p, opts));"));
    assert.ok(api.includes('fillMoney: split(fillMoney, liveFillMoney)') && api.includes('retryMoney: retryMoneyP'));
});
