// 폰 2 반영이 받는 메신저 대화 (단계 6)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import * as F from '../src/phone2feed.js';

const at = s => Date.parse(s);
// a 폰 2 with Ren's phone, a 1:1 room with Lio (the persona) and a group with Mara; dayShift 0, Seoul time
function world() {
    const m = { phones: {} };
    L.startFresh(m, { persona: 'Lio' });
    L.putLivePhone(m, { owner: 'Ren', contacts: [{ name: 'Mara' }], threads: [] });
    const one = L.ensureRoom(m, ['Ren']), group = L.ensureRoom(m, ['Ren', 'Mara']);
    L.nameRoom(m, group.id, 'Weekend');
    L.sendLive(m, one.id, '오늘 왜 그랬어?', at('2026-10-26T10:20:00Z'));
    one.messages.push({ id: 'r1', from: 'Ren', text: '…됐어. 나중에 얘기해.', at: at('2026-10-26T10:22:00Z'), state: '집 · 소파 · 저녁', does: [{ app: 'diary', what: '방금 들은 말 때문에 속상한 마음을 적음' }, { app: 'delivery', what: '혼자 먹으려고 치킨 주문' }] });
    L.sendLive(m, group.id, '토요일 몇 시?', at('2026-10-26T10:30:00Z'));
    group.messages.push({ id: 'g1', from: 'Mara', text: '세 시', at: at('2026-10-26T10:31:00Z') });
    one.messages.push({ id: 'c1', from: 'Ren', text: '', at: at('2026-10-26T11:00:00Z'), call: { min: 12, summary: '사과했다' } });
    return { m, one, group };
}

test('메시지마다 세계 전체의 번호 (보낸 순서, 한 번 준 번호는 그대로)', () => {
    const { m } = world(), rows = F.feedRows(m, 'Ren');
    assert.deepEqual(rows.map(x => x.n), [1, 2, 3, 4, 5]);
    assert.deepEqual(rows.map(x => x.from), ['Lio', 'Ren', 'Lio', 'Mara', 'Ren']);
    const w = L.liveWorld(m), next = L.sendLive(m, Object.keys(w.messenger.rooms)[0], 'again', at('2026-10-26T12:00:00Z'));
    assert.equal(next.n, 6);
    assert.deepEqual(F.feedRows(m, 'Ren').map(x => x.n), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(F.feedRows(m, 'Ren', { after: 2, upto: 4 }).map(x => x.n), [3, 4]);
    // (a phone that is in none of the rooms reads none)
    assert.deepEqual(F.feedRows(m, 'Ivo'), []);
});

test('반영이 받는 모양: 방 줄 · 장면 줄(번호 · 주인 시각 · 상태) · [#번호] 이름: 말 · 주인이 폰으로 한 일 · 통화', () => {
    const { m } = world();
    const text = F.feedText(m, 'Ren', F.feedRows(m, 'Ren'), { tz: 'Asia/Seoul', state: '회사 · 퇴근길' });
    assert.equal(text, [
        '[Orbit · Lio]',
        '#1 · 10-26 19:20 · Ren — 집 · 소파 · 저녁',
        '[#1] Lio: 오늘 왜 그랬어?',
        '[#2] Ren: …됐어. 나중에 얘기해.',
        '[#2] Ren [Diary]: 방금 들은 말 때문에 속상한 마음을 적음',
        '[#2] Ren [Delivery]: 혼자 먹으려고 치킨 주문',
        '[Orbit · Weekend]',
        '#3 · 10-26 19:30 · Ren — 집 · 소파 · 저녁',
        '[#3] Lio: 토요일 몇 시?',
        '[#4] Mara: 세 시',
        '[Orbit · Lio]',
        '#5 · 10-26 20:00 · Ren — 집 · 소파 · 저녁',
        '[#5] Ren [Call]: 12 min — 사과했다',
    ].join('\n'));
    // (페르소나는 이름으로, "나"나 "me"는 없어요)
    assert.doesNotMatch(text, /\b(me|나):/);
    assert.equal(F.feedText(m, 'Ren', []), '');
});

test('장면 나누기: 30분 넘게 비면 새 장면, 주인이 아직 답 안 한 장면은 지난 상태로, 장면 안에서 상태가 바뀌면 그 자리에 한 줄', () => {
    const { m, one } = world();
    one.messages.push({ id: 'z1', from: 'Lio', text: '자?', at: at('2026-10-26T14:30:00Z') });
    let t = F.feedText(m, 'Ren', F.feedRows(m, 'Ren'), { tz: 'Asia/Seoul', state: '회사' });
    assert.match(t, /\[Orbit · Lio\]\n#5 · 10-26 20:00 · Ren — 집 · 소파 · 저녁\n\[#5\] Ren \[Call\]: 12 min — 사과했다\n#6 · 10-26 23:30 · Ren — 집 · 소파 · 저녁\n\[#6\] Lio: 자\?$/);
    one.messages.push({ id: 'z2', from: 'Ren', text: '아니 이제 누웠어', at: at('2026-10-26T14:31:00Z'), state: '집 · 침대' });
    t = F.feedText(m, 'Ren', F.feedRows(m, 'Ren'), { tz: 'Asia/Seoul' });
    assert.match(t, /#6 · 10-26 23:30 · Ren — 집 · 침대\n\[#6\] Lio: 자\?\n\[#7\] Ren: 아니 이제 누웠어$/);
    one.messages.push({ id: 'z3', from: 'Ren', text: '아 잠깐 편의점', at: at('2026-10-26T14:33:00Z'), state: '편의점' });
    t = F.feedText(m, 'Ren', F.feedRows(m, 'Ren'), { tz: 'Asia/Seoul' });
    assert.match(t, /\[#7\] Ren: 아니 이제 누웠어\n#8 · 10-26 23:33 · Ren — 편의점\n\[#8\] Ren: 아 잠깐 편의점$/);
});

test('날짜는 폰 2의 날짜 (현실보다 며칠 옮긴 만큼)', () => {
    const { m } = world();
    L.liveWorld(m).dayShift = 3;
    assert.match(F.feedText(m, 'Ren', F.feedRows(m, 'Ren', { upto: 1 }), { tz: 'Asia/Seoul' }), /#1 · 10-29 19:20 · Ren\n/);
});

test('PHONE NOW의 MESSENGER: 방마다 최근 말만, 시각과 함께 (읽기용)', () => {
    const { m } = world();
    assert.equal(F.messengerNow(m, 'Ren', { tz: 'Asia/Seoul', per: 2 }), [
        '[Orbit · Lio]', '10-26 19:22 Ren: …됐어. 나중에 얘기해.', '10-26 20:00 Ren: (call 12 min)',
        '[Orbit · Weekend]', '10-26 19:30 Lio: 토요일 몇 시?', '10-26 19:31 Mara: 세 시',
    ].join('\n'));
});

test('페르소나에게 가는 문자 · 전화는 기본 앱에 안 써요 (이름이 똑같은 것만, 단체방은 그대로)', () => {
    const answer = { events: [
        { phone: { threads: [{ with: 'Lio', messages: [{ from: 'me', text: 'x' }] }, { with: 'Mara', messages: [{ from: 'Mara', text: 'y' }] }, { with: 'Lio', group: true, members: ['Lio', 'Mara'], messages: [] }], calls: [{ with: 'lio ', type: 'out' }, { with: 'Lio Park', type: 'in' }] } },
        { phone: { notes: [{ title: 'n' }] } }, {},
    ] };
    assert.equal(F.dropPersonaTalk(answer, 'Lio'), 2);
    assert.deepEqual(answer.events[0].phone.threads.map(t => t.with), ['Mara', 'Lio']);
    assert.deepEqual(answer.events[0].phone.calls.map(c => c.with), ['Lio Park']);
    assert.equal(F.dropPersonaTalk({ phone: { threads: [{ with: 'Lio' }] } }, 'Lio'), 1);
    assert.equal(F.dropPersonaTalk(null, 'Lio'), 0);
});

test('연락처의 페르소나에 "메신저로만" 표시 (없으면 넣어요)', () => {
    const p = { contacts: [{ name: 'Mara' }] };
    F.markPersona(p, 'Lio');
    F.markPersona(p, 'lio');
    assert.deepEqual(p.contacts, [{ name: 'Mara' }, { name: 'Lio', messenger: true }]);
});

test('폰 1은 이 파일을 안 불러요', async () => {
    const src = f => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
    for (const f of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.js') && f !== 'phone2feed.js')) assert.doesNotMatch(await src(f), /phone2feed/, f);
});
