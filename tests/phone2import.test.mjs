// 메신저 모양으로 쓴 채팅을 실시간 폰의 메신저로 가져오기 (src/phone2import.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import * as I from '../src/phone2import.js';

const SRC = new URL('../src/', import.meta.url);
// 글의 시간이 적힌 시계: 한국 시간(UTC+9)으로 고정
const KST = 9 * 3600_000;
const clock = {
    wall: ms => { const d = new Date(ms + KST); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() }; },
    at: (y, mo, d, h, mi, s = 0) => Date.UTC(y, mo - 1, d, h, mi, s) - KST,
};
const div = t => `<div class="chat-timestamp" style="font-size:12px;opacity:.5;">${t}</div>`;
const me = (mes, sent) => ({ name: 'Ren', is_user: true, is_system: false, send_date: sent, mes });
const her = (mes, sent, extra = {}) => ({ name: 'Mara', is_user: false, send_date: sent, mes, extra });
const tr = pairs => pairs.map(([ko, en]) => `<span class="translated_text mode-unfolded">${ko}</span><br><span class="original_text mode-unfolded">${en}</span>`).join('\n\n');
const CHAT = [
    me('Mara\n\n', '2026-11-20T07:27:59.474Z'),
    her(`${div('11.20, 16:28')}\n\nYes?`, '2026-11-20T07:28:07.747Z', { display_text: tr([[div('11.20, 16:28'), div('11.20, 16:28')], ['응?', 'Yes?']]) }),
    me('What are you doing', '2026-11-20T07:28:27.587Z'),
    // (written 16:28, finished 16:29: the same moment)
    her(`${div('11.20, 16:28')}\n\nI am at the office\n\nAnd I am not &amp; never was <b>late</b>\n\nDid you just\nwake up`, '2026-11-20T07:29:06.350Z',
        { display_text: tr([[div('11.20, 16:28'), div('11.20, 16:28')], ['나 사무실이야.', 'I am at the office'], ['그리고 난 늦은 적 없어.', 'And I am not &amp; never was <b>late</b>'], ['방금 일어났어?', 'Did you just\nwake up']]) }),
    { name: 'System', is_user: false, is_system: false, send_date: '2026-11-20T07:30:00.000Z', mes: '*(그동안 메신저에서)*\n\nA note.', extra: { type: 'narrator' } },
    { name: 'Ren', is_user: true, is_system: true, send_date: '2026-11-20T07:30:10.000Z', mes: 'hidden' },
    her(`${div('11.20, 16:31')}`, '2026-11-20T07:31:00.000Z'),
];

test('채팅 → 말풍선: 빈 줄마다 하나, 시간 칸 · 태그는 떼고, 숨긴 메시지 · 해설 · 빈 메시지는 빼요', () => {
    const rows = I.importRows(CHAT, { clock });
    assert.deepEqual(rows.map(r => [r.i, r.user, r.name, r.bubbles.map(b => b.text)]), [
        [0, true, 'Ren', ['Mara']],
        [1, false, 'Mara', ['Yes?']],
        [2, true, 'Ren', ['What are you doing']],
        [3, false, 'Mara', ['I am at the office', 'And I am not & never was late', 'Did you just wake up']]]);
    // 저장된 번역: 말풍선마다
    assert.deepEqual(rows.map(r => r.bubbles.map(b => b.ko)), [[''], ['응?'], [''], ['나 사무실이야.', '그리고 난 늦은 적 없어.', '방금 일어났어?']]);
    // after: 그 번호 뒤만
    assert.deepEqual(I.importRows(CHAT, { clock, after: 1 }).map(r => r.i), [2, 3]);
    assert.deepEqual(I.importRows(null), []);
});

test('메신저 메시지만 가져와요: 캐릭터 메시지는 시간 칸이 있는 것, 내 메시지는 바로 뒤 답장(없으면 바로 앞 캐릭터 메시지)이 메신저 메시지인 것', () => {
    const scene = (name, mes, user = false) => ({ name, is_user: user, send_date: '2026-11-19T10:00:00.000Z', mes });
    const mixed = [
        scene('Ren', 'I walked into the cafe.', true),                                                 // 0 장면의 내 말 (뒤가 장면)
        scene('Mara', 'She looked up from her cup.\n\n"You are late," she said.'),                     // 1 장면
        me('Are you home yet', '2026-11-20T07:00:00.000Z'),                                            // 2 메신저 (뒤 답장이 메신저)
        me('Hello?', '2026-11-20T07:00:30.000Z'),                                                      // 3 메신저 (같은 답장)
        her(`${div('11.20, 16:01')}\n\nJust got in`, '2026-11-20T07:01:00.000Z'),                      // 4 메신저
        scene('Mara', 'She put the phone down and went to bed.'),                                      // 5 장면
        me('Good night', '2026-11-20T07:05:00.000Z'),                                                  // 6 메신저 (뒤 답장 없음, 앞 캐릭터 메시지가 장면) → 안 가져와요
    ];
    assert.deepEqual(I.importRows(mixed, { clock }).map(r => [r.i, r.bubbles.map(b => b.text)]), [[2, ['Are you home yet']], [3, ['Hello?']], [4, ['Just got in']]]);
    // 맨 끝의 내 말: 바로 앞 캐릭터 메시지가 메신저 메시지면 가져와요
    assert.deepEqual(I.importRows([...mixed.slice(0, 5), me('Good night', '2026-11-20T07:05:00.000Z')], { clock }).map(r => r.i), [2, 3, 4, 5]);
    // 보통 장면만 있는 채팅 · 내 말만 있는 채팅: 하나도 안 가져와요 (가리지 않으면 있긴 해요)
    assert.deepEqual(I.importRows(mixed.slice(0, 2), { clock }), []);
    assert.equal(I.importRows(mixed.slice(0, 2), { clock, gate: false }).length, 2);
    assert.deepEqual(I.importRows([me('only me', '2026-11-20T07:00:00.000Z')], { clock }), []);
    // 시간 칸에 읽을 수 있는 시간이 없어도 칸이 있으면 메신저 메시지예요
    assert.deepEqual(I.importRows([her(`${div('soon')}\n\nHi`, '2026-11-20T07:00:00.000Z')], { clock }).map(r => r.bubbles[0].text), ['Hi']);
});

test('시간: 글의 시간이 보낸 순간과 같으면(10분 안) 그 순간 그대로(초까지). 시간 칸이 없는 말은 기록된 순간', () => {
    const rows = I.importRows(CHAT, { clock });
    assert.deepEqual(rows.map(r => new Date(r.at).toISOString()), ['2026-11-20T07:27:59.474Z', '2026-11-20T07:28:07.747Z', '2026-11-20T07:28:27.587Z', '2026-11-20T07:29:06.350Z']);
    // 순서는 채팅 순서, 시간은 뒤로 가지 않아요
    assert.ok(rows.every((r, k) => k === 0 || r.at > rows[k - 1].at));
});

test('시간: 글의 시간이 기록과 다르면 글 쪽으로. 연도는 보낸 순간에서 제일 가까운 그 날짜 (새해 앞뒤), 시간 칸 없는 말은 답장과 같은 만큼 옮겨요', () => {
    // 한국 시간 12월 31일 23:59:30에 보낸 메시지에 "01.01, 00:10"이 적혀 있어요 → 다음 해 1월 1일
    const a = I.importRows([her(`${div('01.01, 00:10')}\n\nHappy new year`, '2026-12-31T14:59:30.000Z')], { clock });
    assert.equal(new Date(a[0].at).toISOString(), '2026-12-31T15:10:30.000Z');
    assert.deepEqual(clock.wall(a[0].at), { y: 2027, mo: 1, d: 1, h: 0, mi: 10, s: 30 });
    // 1월 2일에 보낸 메시지에 "12.31, 23:50" → 지난 해 12월 31일
    const b = I.importRows([her(`${div('12.31, 23:50')}\n\nStill the old year`, '2027-01-02T03:00:00.000Z')], { clock });
    assert.deepEqual(clock.wall(b[0].at), { y: 2026, mo: 12, d: 31, h: 23, mi: 50, s: 0 });
    // 이야기 시간으로 적은 채팅: 내 말(시간 칸 없음)은 그 답장과 같은 만큼 옮겨져서 답장 앞에 와요
    const c = I.importRows([me('Where are you', '2026-11-20T07:00:00.000Z'), her(`${div('03.05, 21:15')}\n\nAt home`, '2026-11-20T07:00:20.000Z')], { clock });
    assert.deepEqual(clock.wall(c[1].at), { y: 2027, mo: 3, d: 5, h: 21, mi: 15, s: 20 });
    assert.equal(c[1].at - c[0].at, 20_000);
    // 날짜 순서: 둘 다 날짜로 읽히면 설정대로, 한쪽만 되면 그쪽
    assert.deepEqual(I.stampOf('03.04, 09:00'), { mo: 3, d: 4, h: 9, mi: 0 });
    assert.deepEqual(I.stampOf('03.04, 09:00', 'dm'), { mo: 4, d: 3, h: 9, mi: 0 });
    assert.deepEqual(I.stampOf('20.11, 16:28'), { mo: 11, d: 20, h: 16, mi: 28 });
    for (const bad of ['', 'no time', '13.40, 09:00', '11.20, 25:00']) assert.equal(I.stampOf(bad), null);
});

test('글의 시간이 하나도 없는 묶음(내 말만 다시 가져올 때): 전에 옮긴 만큼 같이 옮겨요', () => {
    const first = I.importRows([me('Where are you', '2026-11-20T07:00:00.000Z'), her(`${div('03.05, 21:15')}\n\nAt home`, '2026-11-20T07:00:20.000Z')], { clock });
    assert.equal(first[0].off, first[1].off); assert.ok(first[1].off > 100 * 86400_000);
    const chat2 = [me('Where are you', '2026-11-20T07:00:00.000Z'), her(`${div('03.05, 21:15')}\n\nAt home`, '2026-11-20T07:00:20.000Z'), me('Still there?', '2026-11-20T07:05:00.000Z')];
    const later = I.importRows(chat2, { clock, after: 1, shift: first[1].off });
    assert.deepEqual(later.map(r => r.i), [2]);
    assert.equal(later[0].at - first[1].at, 280_000);
    // (옮긴 적이 없으면 기록된 순간 그대로)
    assert.equal(I.importRows(chat2, { clock, after: 1 })[0].at, Date.parse('2026-11-20T07:05:00.000Z'));
});

test('시간 기록이 없거나 예전 모양이어도 읽어요; 글의 시간이 앞 말보다 이르면 순서를 지켜요', () => {
    assert.equal(I.sentAt('2026-11-20T07:28:07.747Z'), Date.parse('2026-11-20T07:28:07.747Z'));
    assert.equal(I.sentAt('2026-11-20@16h28m07s'), new Date(2026, 10, 20, 16, 28, 7).getTime());
    assert.equal(I.sentAt('November 20, 2026 4:28pm'), new Date(2026, 10, 20, 16, 28).getTime());
    assert.equal(I.sentAt(1234), 1234);
    for (const bad of ['', null, 'soon', NaN]) assert.equal(I.sentAt(bad), null);
    // 기록 없는 메시지: 앞 말 바로 뒤
    const rows = I.importRows([me('one', '2026-11-20T07:00:00.000Z'), { name: 'Mara', is_user: false, mes: `${div('later')}\n\ntwo\n\nthree` }, me('four', '2026-11-20T06:00:00.000Z')], { clock });
    assert.equal(rows[1].at - rows[0].at, 1000);
    assert.ok(rows[2].at > rows[1].at + 1);   // (말풍선 둘의 자리 뒤)
});

test('번역이 말풍선과 안 맞으면 번역만 빼요', () => {
    const T0 = `${div('11.20, 16:00')}\n\n`;
    const rows = I.importRows([her(`${T0}One\n\nTwo`, '2026-11-20T07:00:00.000Z', { display_text: tr([['하나', 'One']]) }), her(`${T0}One\n\nTwo`, '2026-11-20T07:01:00.000Z', { display_text: tr([['하나', 'One'], ['둘', 'Other words']]) }),
        her(`${T0}One`, '2026-11-20T07:02:00.000Z', { display_text: tr([['One', 'One']]) }), her(`${T0}One`, '2026-11-20T07:03:00.000Z', {})], { clock });
    assert.deepEqual(rows.map(r => r.bubbles.map(b => b.ko)), [['', ''], ['', ''], [''], ['']]);
});

function world() {
    const m = { phones: {} };
    L.startFresh(m, { persona: 'Ren', scope: 'test' });
    return { m, w: L.liveWorld(m) };
}

test('방에 넣기: 채팅 순서 · 원래 시간 · 번역까지, 전한 것으로 표시. 방이 없으면 만들어요', () => {
    const { m, w } = world(), rows = I.importRows(CHAT, { clock });
    const out = I.importInto(m, rows, { now: 777, chat: 'c1' });
    const room = w.messenger.rooms[out.room];
    assert.deepEqual([out.count, out.messages, out.from, out.to], [6, 4, 0, 3]);
    assert.deepEqual(room.members, ['Ren', 'Mara']);
    assert.deepEqual(room.messages.map(x => [x.from, x.text, x.ko || '']), [['Ren', 'Mara', ''], ['Mara', 'Yes?', '응?'], ['Ren', 'What are you doing', ''],
        ['Mara', 'I am at the office', '나 사무실이야.'], ['Mara', 'And I am not & never was late', '그리고 난 늦은 적 없어.'], ['Mara', 'Did you just wake up', '방금 일어났어?']]);
    assert.ok(room.messages.every((x, k) => x.told === 777 && Number.isInteger(x.n) && (k === 0 || (x.n === room.messages[k - 1].n + 1 && x.at >= room.messages[k - 1].at))));
    assert.equal(new Date(room.messages[3].at).toISOString(), '2026-11-20T07:29:06.350Z');
    assert.equal(room.messages[5].at - room.messages[3].at, 2);
    assert.deepEqual([w.importTop, w.imports], [room.messages[5].n, { c1: { room: room.id, upto: 3, at: 777, count: 6, shift: 0 } }]);
    assert.equal(I.importedOf(w, 'c1'), w.imports.c1); assert.equal(I.importedOf(w, 'c2'), null); assert.equal(I.importedOf(null, 'c1'), null);
    assert.equal(room.read.ren, room.messages[5].at);
    // 가져온 말은 방의 모두가 읽은 것: 내 말풍선에 안 읽음 숫자가 안 붙어요
    assert.equal(room.read.mara, room.messages[5].at);
    assert.ok(room.messages.every(x => L.unreadBy(room, x).length === 0));
    // 서랍: 나중에 만드는 폰은 가져온 말 뒤부터 읽어요
    assert.equal(L.liveMeta(m).phoneReadFrom, w.importTop);
    assert.equal(L.liveMeta(m).phoneUpto, -1);
    // 같은 채팅에서 다시: 내 말뿐이어도 그 방으로 들어가요. 다른 채팅의 내 말뿐인 묶음은 방을 몰라요
    const more = I.importInto(m, I.importRows([...CHAT, me('one more', '2026-11-20T09:00:00.000Z')], { clock, after: 6 }), { now: 888, chat: 'c1' });
    assert.equal(more.room, room.id); assert.equal(room.messages.at(-1).text, 'one more'); assert.equal(w.imports.c1.count, 7);
    assert.throws(() => I.importInto(m, I.importRows([me('elsewhere', '2026-11-20T10:00:00.000Z')], { clock, gate: false }), { chat: 'c2' }), /캐릭터가 한 말이 없어서/);
});

test('있던 폰은 가져온 말을 이미 읽은 것으로: 읽던 폰은 읽은 구간으로, 한 번도 안 읽은 폰은 그 뒤부터', () => {
    const { m, w } = world();
    w.phones = { mara: { owner: 'Mara', sync: { marks: { base: { index: -1, user: -1, fp: '', tail: '' } }, done: [] } }, ivo: { owner: 'Ivo' } };
    const rows = I.importRows(CHAT, { clock }), out = I.importInto(m, rows), room = w.messenger.rooms[out.room], first = room.messages[0].n, top = room.messages.at(-1).n;
    assert.deepEqual(w.phones.mara.sync.done, [[first, top]]);
    assert.deepEqual(w.phones.ivo.sync.marks.base, { index: top, user: -1, fp: '', tail: '' });
});

test('이미 대화가 있는 방: 시간 자리에 끼워 넣고, 있던 말은 그대로', () => {
    const { m, w } = world(), room = L.ensureRoom(m, ['Mara']);
    L.sendLive(m, room.id, 'said here before', Date.parse('2026-11-20T07:28:20.000Z'));
    L.sendLive(m, room.id, 'said here later', Date.parse('2026-11-21T00:00:00.000Z'));
    const had = room.messages.map(x => ({ ...x }));
    I.importInto(m, I.importRows(CHAT, { clock }));
    assert.deepEqual(room.messages.map(x => x.text), ['Mara', 'Yes?', 'said here before', 'What are you doing', 'I am at the office', 'And I am not & never was late', 'Did you just wake up', 'said here later']);
    assert.deepEqual(room.messages.filter(x => !x.imp && x.imp !== 0).map(x => ({ ...x })), had);
    assert.ok(!room.messages[2].told && !room.messages[7].told);
    // (가져온 말 뒤에 내가 보낸 말은 아직 안 읽은 것 그대로)
    assert.deepEqual(room.messages.map(x => L.unreadBy(room, x).length), [0, 0, 0, 0, 0, 0, 0, 1]);
    assert.equal(w.messenger.seq, Math.max(...room.messages.map(x => x.n)));
});

test('단체 채팅은 단체방으로; 캐릭터 말이 없거나 가져올 게 없거나 실시간 폰이 없으면 아무것도 안 바꿔요', () => {
    const { m, w } = world();
    const out = I.importInto(m, I.importRows([me('hi all', '2026-11-20T07:00:00.000Z'), her(`${div('11.20, 16:00')}\n\nhello`, '2026-11-20T07:00:10.000Z'), { name: 'Ivo', is_user: false, send_date: '2026-11-20T07:00:20.000Z', mes: `${div('11.20, 16:00')}\n\nhey` }], { clock }));
    assert.deepEqual(w.messenger.rooms[out.room].members, ['Ren', 'Mara', 'Ivo']);
    assert.deepEqual(w.messenger.rooms[out.room].messages.map(x => L.unreadBy(w.messenger.rooms[out.room], x)), [[], [], []]);
    const was = JSON.stringify(m);
    assert.throws(() => I.importInto(m, I.importRows([me('only me', '2026-11-20T08:00:00.000Z')], { clock, gate: false }), { chat: 'another chat' }), /캐릭터가 한 말이 없어서/);
    assert.throws(() => I.importInto(m, []), /가져올 메시지가 없어요/);
    assert.equal(JSON.stringify(m), was);
    assert.throws(() => I.importInto({ phones: {} }, I.importRows(CHAT, { clock })), /아직 폰 2가 없어요/);
});

test('이 파일은 폰 2 저장 자리만 불러요; 폰 1 파일은 이 파일을 안 불러요', async () => {
    const src = await readFile(new URL('phone2import.js', SRC), 'utf8');
    assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map(x => x[1]), ['./phone2store.js']);
    assert.doesNotMatch(src, /saveMeta|ctx\(|askDraft|askAI|boundary/);
    for (const f of (await readdir(SRC)).filter(f => f.endsWith('.js') && !/^phone2/.test(f) && f !== 'phone.js')) assert.doesNotMatch(await readFile(new URL(f, SRC), 'utf8'), /phone2import/, f);
});
