// 폰 2 → 롤플: 메신저에서 나눈 이야기를 롤플에 전하는 글 (src/phone2back.js). 고르기 · 요청 글 · 넣을 글 · 표시만 봐요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import * as B from '../src/phone2back.js';

const SRC = new URL('../src/', import.meta.url);
function world() {
    const m = { phones: { mara: { owner: 'Mara' }, ivo: { owner: 'Ivo' } } };
    L.startFromStory(m, { persona: 'Ren', upto: 3 });
    const w = L.liveWorld(m), a = L.ensureRoom(m, ['Mara']), g = L.ensureRoom(m, ['Mara', 'Ivo']);
    L.sendLive(m, a.id, 'Are you coming Friday?', 1000);
    a.messages.push({ id: 'x1', from: 'Mara', text: 'I will. Bring the keys.', at: 2000, state: 'office · packing up · ~18:00' });
    a.messages.push({ id: 'x2', from: 'Mara', text: '', at: 2500, act: true, state: 'tram · going home', does: [{ app: 'Notes', what: 'writes a list' }] });
    L.sendLive(m, g.id, 'Dinner at mine on Saturday', 3000);
    g.messages.push({ id: 'x3', from: 'Ivo', text: 'I am in', at: 4000, state: 'garage' }, { id: 'x4', from: 'Mara', at: 5000, call: { min: 7.4 } });
    L.numberLive(w);
    return { m, w, a, g };
}
const wall = ms => `11-06 12:0${ms / 1000}`;

test('아직 안 전한 말: 방마다, 말한 순서대로. 말 없이 한 일은 빼고 통화는 넣어요', () => {
    const { w, a, g } = world(), left = B.backLeft(w);
    assert.deepEqual([left.count, left.more], [5, 0]);
    assert.deepEqual(left.rooms.map(r => [r.room, r.names, r.rows.map(x => x.text || 'call')]), [
        [a.id, ['Ren', 'Mara'], ['Are you coming Friday?', 'I will. Bring the keys.']],
        [g.id, ['Ren', 'Mara', 'Ivo'], ['Dinner at mine on Saturday', 'I am in', 'call']]]);
    // 전한 말이 없는 방은 안 나와요; 아무것도 없으면 빈 목록
    for (const x of a.messages) x.told = 1;
    assert.deepEqual(B.backLeft(w).rooms.map(r => r.room), [g.id]);
    assert.deepEqual(B.backLeft({ messenger: { rooms: {} } }), { rooms: [], count: 0, more: 0 });
    assert.deepEqual(B.backLeft(null), { rooms: [], count: 0, more: 0 });
});

test('한 번에 정한 수까지만, 오래된 것부터: 남은 건 다음에 이어서 (건너뛰는 말이 없어요)', () => {
    const { w, a } = world(), keep = B.BACK.lines;
    B.BACK.lines = 3;
    try {
        const first = B.backLeft(w);
        assert.deepEqual([first.count, first.more], [3, 2]);
        assert.deepEqual(first.rooms.flatMap(r => r.rows.map(x => x.at)), [1000, 2000, 3000]);
        assert.equal(B.markTold(first, 77), 3);
        assert.equal(a.messages[0].told, 77);
        const next = B.backLeft(w);
        assert.deepEqual([next.count, next.more, next.rooms.flatMap(r => r.rows.map(x => x.at))], [2, 0, [4000, 5000]]);
        assert.equal(B.markTold(next), 2);
        assert.equal(B.backLeft(w).count, 0);
        // (이미 표시한 말은 다시 표시하지 않아요; 말 없이 한 일은 표시도 안 해요)
        assert.equal(B.markTold(first), 0);
        assert.ok(!('told' in a.messages[2]));
    } finally { B.BACK.lines = keep; }
});

test('전하는 사이에 새로 온 말은 표시하지 않아요', () => {
    const { m, w, a } = world(), left = B.backLeft(w);
    L.sendLive(m, a.id, 'One more thing', 9000);
    assert.equal(B.markTold(left), 5);
    assert.deepEqual(B.backLeft(w).rooms.flatMap(r => r.rows.map(x => x.text)), ['One more thing']);
});

test('요청 글: 방마다 이름 줄 아래 시각 · 이름 · 말, 캐릭터 말에는 그때 상태; 롤플의 끝 메시지는 번호를 떼고', () => {
    const { w } = world(), left = B.backLeft(w);
    const input = B.backInput(w, left, { wall, tail: ['[#8] Mara: The door was open.\n\nShe went in.', '[#9 · USER] Ren: "Hello?"', '  '] });
    assert.equal(input, `[MESSENGER]
— Ren · Mara —
11-06 12:01 · Ren: Are you coming Friday?
11-06 12:02 · Mara (office · packing up · ~18:00): I will. Bring the keys.

— Ren · Mara · Ivo —
11-06 12:03 · Ren: Dinner at mine on Saturday
11-06 12:04 · Ivo (garage): I am in
11-06 12:05 · Mara: (call 7 min)

[LAST MESSAGES]
Mara: The door was open.

She went in.

Ren: "Hello?"`);
    // 롤플의 끝 메시지가 없으면 그 칸이 없어요
    assert.ok(!B.backInput(w, left, { wall }).includes('[LAST MESSAGES]'));
    assert.ok(!input.includes('writes a list') && !input.includes('tram'));
});

test('지시문: 받는 것에 실제로 보내는 칸 이름 그대로, 페르소나는 이름으로', () => {
    const sys = B.phone2BackSystem({ persona: 'Ren' }), get = sys.slice(sys.indexOf('YOU GET'), sys.indexOf('THE NOTE'));
    for (const b of ['MESSENGER', 'LAST MESSAGES']) assert.ok(get.includes(b), b);
    assert.ok(sys.startsWith('GOAL\n') && sys.includes('\nJSON (one object, nothing before or after it)\n{ "note": "…" }'));
    assert.ok(sys.includes('Ren is a person in the story like the others.') && !/the user/i.test(sys));
    assert.ok(sys.includes(`${B.BACK.words} words at most`));
});

test('답에서 글 꺼내기: 없거나 비었으면 오류; 넣을 글은 첫 줄에 어디서 온 글인지', () => {
    assert.equal(B.takeBack('{ "note": "  Mara agreed to come on Friday.\\r\\nShe asked for the keys.  " }'), 'Mara agreed to come on Friday.\nShe asked for the keys.');
    assert.equal(B.takeBack('{"x":1}', () => ({ note: 'ok' })), 'ok');
    // (실험 2에서 나온 답 모양: 코드 틀 안에, 앞뒤에 말이 붙어서)
    assert.equal(B.takeBack('```json\n{ "note": "Mara agreed to come." }\n```'), 'Mara agreed to come.');
    assert.equal(B.takeBack('Here is the note:\n```\n{ "note": "Mara agreed {once} to come." }\n```\nDone.'), 'Mara agreed {once} to come.');
    for (const bad of ['', '{}', '{ "note": "  " }', 'not json', null, '```json\n```', '} {']) assert.throws(() => B.takeBack(bad), /전할 글을 찾지 못했어요/);
    assert.equal(B.backMessage(' Mara agreed to come on Friday. '), '*(Meanwhile, on the messenger)*\n\nMara agreed to come on Friday.');
    assert.equal(B.backMessage('마라는 금요일에 오기로 했다. Ren에게 열쇠를 부탁했다.'), '*(그동안 메신저에서)*\n\n마라는 금요일에 오기로 했다. Ren에게 열쇠를 부탁했다.');
});

test('이 파일은 폰 2 저장 자리만 불러요; 폰 1 파일은 이 파일을 안 불러요', async () => {
    const src = await readFile(new URL('phone2back.js', SRC), 'utf8');
    assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map(x => x[1]), ['./phone2store.js']);
    assert.doesNotMatch(src, /saveMeta|ctx\(|askDraft|\.text\s*=[^=]|boundary/);
    for (const f of (await readdir(SRC)).filter(f => f.endsWith('.js') && !/^phone2/.test(f) && f !== 'phone.js')) assert.doesNotMatch(await readFile(new URL(f, SRC), 'utf8'), /phone2back/, f);
});
