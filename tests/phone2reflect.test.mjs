// 폰 2 반영 (단계 7-4): 메신저 대화 한 구간을 가짜 모델 답으로 반영해요. 폰 1의 반영 함수들을 그대로 불러요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { migrateBank, cash } from '../src/finance.js';
import { journalRead } from '../src/phonesync.js';
import * as L from '../src/phone2store.js';
import { R, T } from './phone2reflect.load.mjs';

const at = s => Date.parse(s);
const phone = () => ({ owner: 'Mara', now: '11-10 22:00', year: 2026, contacts: [{ name: 'Ren' }], threads: [], calls: [], photos: [], notes: [], searches: [], events: [], posts: [], mails: [], diary: [], voice: [],
    money: { currency: 'KRW', asOf: '2026-11-01', bank: { accounts: [{ id: 'chk', kind: 'checking', name: '입출금', last4: '1111', currency: 'KRW', balance: 100000 }] }, tx: [], orders: [], passes: [] } });
// a 폰 2 with Mara's phone (the persona is Ren), their room, and a short talk: Ren asks for the split, Mara sends it
function world({ story = null } = {}) {
    // (폰 1's own phone in the chat: must stay as it is)
    const real = { text: 'STORY TEXT', phones: { mara: { owner: 'Mara', now: '01-01 00:00', notes: [{ title: '폰 1 메모', text: 'x' }] } }, finance: { accounts: { 'p1:KRW': { amount: 5, entries: [] } } } };
    if (story) { real.phones.mara = phone(); migrateBank(real, real.phones.mara); L.startFromStory(real, { persona: 'Ren', upto: story, scope: 'test', story: { ranges: {}, titles: [], rawFrom: 0, own: [''] } }); }
    else { L.startFresh(real, { persona: 'Ren', scope: 'test' }); const m0 = L.liveMeta(real); m0.phones = { mara: phone() }; migrateBank(m0, m0.phones.mara); }
    const m = L.liveMeta(real), room = L.ensureRoom(real, ['Mara']);
    L.sendLive(real, room.id, '더치페이 일주일째 안 보내냐', at('2026-11-11T04:10:00Z'));
    const n0 = L.liveWorld(real).messenger.seq;
    room.messages.push({ id: 'a', n: L.liveNo(L.liveWorld(real)), from: 'Mara', text: '아 미안 바로 보낼게', at: at('2026-11-11T04:11:00Z'), state: '지사 근처 · 점심 먹고 자리',
        does: [{ app: 'Bank', what: '더치페이 몫 32,000원 Ren에게 송금' }, { app: 'Notes', what: '"갚을 것" 메모에서 Ren 줄 지움' }] });
    return { real, m, room, p: m.phones.mara, first: n0, bank: () => cash(m.finance.accounts['chk:KRW']) };
}
const answer = (n, extra = []) => ({ events: [
    { id: 'split', at: n, quote: '더치페이 몫 32,000원', summary: 'Ren에게 더치페이 몫을 보냈다', date: '11-11', time: '13:11', money: true,
        phone: { notes: [{ title: '갚을 것', text: '(없음)', time: '11-11 13:11' }], threads: [{ with: 'Ren', messages: [{ from: 'me', text: '보냈어', time: '11-11 13:11' }] }], ...Object.fromEntries(extra) } },
] });
const pay = n => [{ records: [{ type: 'payment', at: n, account: '1111', amount: -32000, who: 'Ren', kind: 'transfer', occurrence: 'new' }] }];

test('한 구간: 메신저 줄이 요청에 가고, 메모 · 송금이 폰 2에만 들어가요', async () => {
    const c = world(), before = JSON.stringify(c.real.phones), fin = JSON.stringify(c.real.finance);
    T.answers = [answer(c.first + 1)]; T.moneyAnswers = pay(c.first + 1); T.calls = 0;
    const p = await R.updateLive(c.real, c.m, 'Mara', { tz: 'Asia/Seoul' });
    assert.equal(p, c.p);
    // the request: the messenger's lines, no archive, no story state, the persona named in the system
    assert.match(T.input, /^\[NEW MESSAGES\]\n\[Orbit · Ren\]\n#\d+ · 11-11 13:10 · Mara — 지사 근처 · 점심 먹고 자리\n\[#\d+\] Ren: 더치페이 일주일째 안 보내냐\n\[#\d+\] Mara: 아 미안 바로 보낼게\n\[#\d+\] Mara \[Bank\]: 더치페이 몫 32,000원 Ren에게 송금/);
    for (const gone of ['[ARCHIVE', '[STORY NOW]', '[TRACKER', 'STORY TEXT', '[WEATHER']) assert.ok(!T.input.includes(gone), gone);
    assert.match(T.moneyInput, /\[Orbit · Ren\]/);
    assert.ok(T.sys.includes('Ren') && T.moneySys.includes('Ren'));
    // the phone: the note, the transfer; the text to the persona is the messenger's
    assert.deepEqual(p.notes.map(x => x.title), ['갚을 것']);
    assert.equal(c.bank(), 68000);
    assert.equal(p.threads.length, 0);
    assert.match(p.syncLast.notes.join(' '), /메신저가 맡아서/);
    // the clock is the round's last message on the owner's wall, whatever the model would say
    assert.equal(p.now, '11-11 13:11');
    assert.equal(p.year, 2026);
    // the item says which messenger message it came from
    assert.equal(p.notes[0].froms[0].at, c.first + 1);
    // 폰 1's phone and ledger are untouched
    assert.equal(JSON.stringify(c.real.phones), before);
    assert.equal(JSON.stringify(c.real.finance), fin);
    // 복구 기록 is under 폰 2's key only
    assert.equal(journalRead('test').length, 0);
    assert.equal(journalRead(L.liveScope('test', c.real)).length, 1);
    // nothing left: no model call
    assert.equal(await R.updateLive(c.real, c.m, 'Mara', { tz: 'Asia/Seoul' }), null);
    assert.equal(T.calls, 1);
});

test('다음 구간은 새 메시지만 읽어요', async () => {
    const c = world();
    T.answers = [answer(c.first + 1)]; T.moneyAnswers = pay(c.first + 1);
    await R.updateLive(c.real, c.m, 'Mara', { tz: 'Asia/Seoul' });
    L.sendLive(c.real, c.room.id, '받았어 ㄳ', at('2026-11-11T05:00:00Z'));
    T.answers = [{ events: [] }]; T.moneyAnswers = [];
    await R.updateLive(c.real, c.m, 'Mara', { tz: 'Asia/Seoul' });
    assert.ok(T.input.includes('받았어 ㄳ') && !T.input.split('[EVENTS ON THE PHONE]')[0].includes('더치페이 일주일째'));
    assert.equal(c.bank(), 68000);
    assert.equal(c.p.now, '11-11 14:00');
});

test('이야기에서 시작한 폰 2: 번호는 이야기 다음부터, 폰 1에서 읽던 자리는 그대로', async () => {
    const c = world({ story: 130 });
    assert.equal(c.first, 131);
    c.p.sync = { v: 1, scope: 'test', order: 'newest', limit: 3, marks: { base: { index: 10, user: -1, fp: '', tail: '' } }, done: [[11, 130]], failed: {}, arch: {}, events: {} };
    const p1 = JSON.stringify(c.real.phones);
    T.answers = [answer(132)]; T.moneyAnswers = pay(132);
    await R.updateLive(c.real, c.m, 'Mara', { tz: 'Asia/Seoul' });
    assert.match(T.input, /\[#131\] Ren: /);
    assert.equal(c.bank(), 68000);
    assert.deepEqual(c.p.sync.done, [[11, 132]]);
    assert.equal(c.p.sync.order, 'newest');
    assert.equal(JSON.stringify(c.real.phones), p1);
});

test('반영하는 사이 폰 2가 바뀌면 아무것도 안 넣어요', async () => {
    const c = world();
    T.answers = [answer(c.first + 1)]; T.moneyAnswers = pay(c.first + 1);
    T.beforeCore = () => { L.resetLive(c.real, 'all'); };
    try { await assert.rejects(R.updateLive(c.real, c.m, 'Mara', { tz: 'Asia/Seoul' }), /실시간 폰이 바뀌었어요/); } finally { delete T.beforeCore; }
    assert.equal(c.p.notes.length, 0);
});

test('주인이 말없이 폰으로만 한 일도 읽어요 (act)', async () => {
    const c = world(), w = L.liveWorld(c.real);
    c.room.messages.push({ id: 'b', n: L.liveNo(w), from: 'Mara', text: '', act: true, at: at('2026-11-11T06:00:00Z'), state: '지사 · 자리', does: [{ app: 'Search', what: '파워포인트 저장 안 한 파일 복구' }] });
    const n = c.first + 2;
    T.answers = [{ events: [{ id: 'find', at: n, quote: '파워포인트 저장 안 한 파일 복구', summary: '복구 방법을 찾았다', date: '11-11', time: '15:00', phone: { searches: [{ q: '파워포인트 저장 안 한 파일 복구', time: '11-11 15:00' }] } }] }]; T.moneyAnswers = [];
    await R.updateLive(c.real, c.m, 'Mara', { tz: 'Asia/Seoul' });
    assert.ok(!T.input.includes(`[#${n}] Mara: `));
    assert.deepEqual(c.p.searches.map(x => x.q), ['파워포인트 저장 안 한 파일 복구']);
    assert.equal(c.p.now, '11-11 15:00');
});

test('답이 적은 상황(situations)은 다음 답장을 위해 폰에 남겨요', async () => {
    const c = world();
    T.answers = [{ ...answer(c.first + 1), situations: [{ id: 'split', what: 'Ren에게 더치페이 몫을 보냈다', state: 'done', known: 'Ren도 안다' }] }]; T.moneyAnswers = pay(c.first + 1);
    await R.updateLive(c.real, c.m, 'Mara', { tz: 'Asia/Seoul' });
    assert.equal(c.p.situations[0].id, 'split');
});

test('폰 1은 이 파일을 안 불러요', async () => {
    const { readdir } = await import('node:fs/promises');
    for (const f of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.js') && f !== 'phone2reflect.js' && f !== 'phone2go.js')) assert.doesNotMatch(await readFile(new URL(`../src/${f}`, import.meta.url), 'utf8'), /phone2reflect/, f);
});

test('장면 줄(번호 · 시각 · 상태)을 인용한 답도 그 메시지의 근거로 받아요', async () => {
    const c = world();
    T.answers = [{ events: [{ id: 'lunch', at: c.first, quote: `#${c.first} · 11-11 13:10 · Mara — 지사 근처 · 점심 먹고 자리`, summary: '점심 뒤 자리에 있었다', date: '11-11', time: '13:10',
        phone: { notes: [{ title: '점심', text: '지사 근처', time: '11-11 13:10' }] } }] }]; T.moneyAnswers = [];
    await R.updateLive(c.real, c.m, 'Mara', { tz: 'Asia/Seoul' });
    assert.deepEqual(c.p.syncLast.failed, []);
    assert.deepEqual(c.p.notes.map(x => x.title), ['점심']);
});
