// 서버 플러그인이 읽는 묶음 (src/phone2kit.js): 이 Orbit이 실리의 어느 채팅인지만. 카드 고르기는 실리 목록의 순서 그대로. 예시 캐릭터만 써요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKit, putKit, kitOf, cardsFor } from '../src/phone2kit.js';
import { startFresh, putLivePhone, ensureRoom } from '../src/phone2store.js';

const card = (name, avatar) => ({ name, avatar, description: `${name} top`, data: { name, description: `${name} desc` } });
function world() {
    const m = { glossary: [{ src: 'Mara', ko: '마라' }], dateOrder: 'mdy', text: 'ARCHIVE TEXT', phones: { old: {} } };
    startFresh(m, { persona: 'Ren' });
    putLivePhone(m, { owner: 'Mara' }); putLivePhone(m, { owner: 'Ivo', financeProfile: { type: 'character', id: 'lio.png' } });
    ensureRoom(m, ['Mara', 'Varo']);
    return m;
}
const LIST = () => [card('Zed', 'zed.png'), card('Mara', 'mara-old.png'), card('Mara', 'mara.png'), card('Lio', 'lio.png'), card('Varo', 'varo.png'), { name: 'Ivo', avatar: 'ivo.png' }, card('Kai', 'kai.png')];
const ctxOf = (more = {}) => ({ name1: 'Ren', characterId: 2, characters: LIST(), powerUserSettings: { persona_description: 'Ren is a student.' }, extensionSettings: { narrative_archive: { draftConn: { key: 'SECRET-KEY' } } }, ...more });

test('카드 고르기: 이 채팅의 캐릭터 · 그룹 사람 · 폰 주인과 방 사람(이름) · 프로필로 고른 카드, 실리 목록의 순서 그대로', () => {
    const m = world();
    assert.deepEqual(cardsFor(LIST(), m, { own: 'kai.png' }).map(c => c.avatar), ['mara-old.png', 'mara.png', 'lio.png', 'varo.png', 'ivo.png', 'kai.png']);
    assert.deepEqual(cardsFor(LIST(), m, { members: ['zed.png'] }).map(c => c.avatar), ['zed.png', 'mara-old.png', 'mara.png', 'lio.png', 'varo.png', 'ivo.png']);
    // (카드는 실리의 것 그대로: 고르기만 해요)
    const list = LIST();
    assert.equal(cardsFor(list, m)[0], list[1]);
    assert.deepEqual(cardsFor(list, {}), []);
});

test('묶음: 이 채팅이 누구의 것인지만 (카드 · 페르소나 · 롤플 · 채팅 값은 서버가 실리에서 새로 읽어요)', () => {
    const m = world(), kit = buildKit(ctxOf(), m);
    assert.deepEqual(kit, { v: 1, ver: '', chat: { avatar: 'mara.png', group: null, file: null } });   // (채팅 이름을 모르면 파일도 몰라요)
    const named = buildKit(ctxOf({ chatId: 'Mara - 2026-11-22' }), m, { version: '9.9.9' });
    assert.deepEqual(named.chat.file, { group: false, dir: 'mara', id: 'Mara - 2026-11-22' }); assert.equal(named.ver, '9.9.9');
    const text = JSON.stringify(named);
    for (const no of ['SECRET-KEY', 'ARCHIVE TEXT', 'Ren', 'desc', 'glossary']) assert.ok(!text.includes(no), no);
});

test('묶음: 그룹 채팅이면 그룹 id', () => {
    const m = world();
    assert.deepEqual(buildKit(ctxOf({ characterId: undefined, groupId: 'g1', groups: [{ id: 'g0', members: ['zed.png'] }, { id: 'g1', members: ['zed.png', 'mara.png'] }] }), m).chat, { avatar: null, group: { id: 'g1' }, file: null });
    assert.deepEqual(buildKit(ctxOf({ characterId: undefined, groupId: 'g1', getCurrentChatId: () => 'grp-1', groups: [{ id: 'g1', members: ['mara.png'] }] }), m).chat.file, { group: true, dir: null, id: 'grp-1' });
});

test('묶음: 달라졌을 때만 넣어요. 실시간 폰이 없으면 없어요', () => {
    const m = world(), c = ctxOf({ chatId: 'a' });
    assert.equal(putKit(m, buildKit(c, m)), true);
    assert.equal(putKit(m, buildKit(c, m)), false);
    assert.equal(putKit(m, buildKit({ ...c, chatId: 'b' }, m)), true);
    assert.equal(kitOf(m).chat.file.id, 'b');
    assert.equal(buildKit(c, {}), null);
    assert.equal(kitOf({ live: { kit: { v: 99 } } }), null);
});
