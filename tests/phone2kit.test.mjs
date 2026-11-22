// 서버 플러그인이 읽는 묶음 (src/phone2kit.js): 답장 코드가 읽는 칸만, 실리 목록의 순서 그대로. 예시 캐릭터만 써요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKit, putKit, kitOf, kitContext } from '../src/phone2kit.js';
import { startFresh, putLivePhone, ensureRoom, liveWorld } from '../src/phone2store.js';

const card = (name, avatar, more = {}) => ({ name, avatar, description: `${name} top`, chat: 'x.jsonl', json_data: '{"big":1}', data: { name, description: `${name} desc`, personality: 'calm', scenario: '', first_mes: 'hi', mes_example: 'ex', creator_notes: 'secret notes', character_book: { entries: [1, 2, 3] }, extensions: { talkativeness: 0.7, narrative_archive_convo: { conversationSchedule: { days: {} } }, depth_prompt: { prompt: 'x' } } }, ...more });
function world() {
    const m = { glossary: [{ src: 'Mara', ko: '마라' }], dateOrder: 'mdy', text: 'ARCHIVE TEXT', phones: { old: {} } };
    startFresh(m, { persona: 'Ren' });
    putLivePhone(m, { owner: 'Mara' }); putLivePhone(m, { owner: 'Ivo', financeProfile: { type: 'character', id: 'lio.png' } });
    ensureRoom(m, ['Mara', 'Varo']);
    return m;
}
const ctxOf = (more = {}) => ({ name1: 'Ren', characterId: 2, characters: [card('Zed', 'zed.png'), card('Mara', 'mara-old.png'), card('Mara', 'mara.png'), card('Lio', 'lio.png'), card('Varo', 'varo.png'), { name: 'Ivo', avatar: 'ivo.png', description: 'v1 card', extensions: { talkativeness: 30, other: 1 } }],
    powerUserSettings: { persona_description: 'Ren is a student.', personas: { 'a.png': 'Ren' }, persona_descriptions: { 'a.png': { description: 'x' } } }, extensionSettings: { narrative_archive: { draftConn: { key: 'SECRET-KEY' } } }, ...more });
const TAIL = { lines: ['[#7] Mara: later', '[#8 · USER] Ren: ok'], first: 7, end: 8 };

test('묶음: 필요한 카드만, 실리 목록의 순서 그대로. 읽는 칸만 담아요', () => {
    const m = world(), kit = buildKit(ctxOf(), m, TAIL);
    // 이 채팅의 캐릭터(mara.png) · 폰 주인과 방 사람(이름으로: Mara 둘 다, Varo, Ivo) · 프로필로 고른 카드(lio.png). Zed는 아니에요
    assert.deepEqual(kit.characters.map(c => c.avatar), ['mara-old.png', 'mara.png', 'lio.png', 'varo.png', 'ivo.png']);
    const mara = kit.characters[1];
    assert.deepEqual(Object.keys(mara).sort(), ['avatar', 'data', 'description', 'name']);
    assert.deepEqual(Object.keys(mara.data).sort(), ['description', 'extensions', 'first_mes', 'mes_example', 'name', 'personality', 'scenario']);
    assert.deepEqual(mara.data.extensions, { talkativeness: 0.7, narrative_archive_convo: { conversationSchedule: { days: {} } } });
    // data가 없는 카드는 data 없이 (읽는 쪽이 카드 자신의 칸으로 내려가요)
    assert.deepEqual(kit.characters[4], { name: 'Ivo', avatar: 'ivo.png', description: 'v1 card', extensions: { talkativeness: 30 } });
    assert.deepEqual(kit.chat, { avatar: 'mara.png', group: null, file: null });   // (채팅 이름을 모르면 파일도 몰라요)
    const named = buildKit(ctxOf({ chatId: 'Mara - 2026-11-22' }), m, TAIL, { version: '9.9.9' });
    assert.deepEqual(named.chat.file, { group: false, dir: 'mara', id: 'Mara - 2026-11-22' }); assert.equal(named.ver, '9.9.9');
    assert.equal(kit.name1, 'Ren'); assert.equal(kit.persona, 'Ren is a student.');
    assert.deepEqual(kit.tail, TAIL);
    assert.deepEqual(kit.meta, { glossary: [{ src: 'Mara', ko: '마라' }], dateOrder: 'mdy' });
    // 키 · 아카이브 글 · 폰 1의 것은 안 담겨요
    const text = JSON.stringify(kit);
    for (const no of ['SECRET-KEY', 'ARCHIVE TEXT', 'secret notes', 'character_book', 'json_data', 'depth_prompt', 'persona_descriptions']) assert.ok(!text.includes(no), no);
});

test('묶음: 그룹 채팅이면 그룹의 사람들을 담아요', () => {
    const m = world(), kit = buildKit(ctxOf({ characterId: undefined, groupId: 'g1', groups: [{ id: 'g0', members: ['zed.png'] }, { id: 'g1', members: ['zed.png', 'mara.png'] }] }), m, TAIL);
    assert.deepEqual(kit.chat, { avatar: null, group: { id: 'g1', members: ['zed.png', 'mara.png'] }, file: null });
    assert.deepEqual(buildKit(ctxOf({ characterId: undefined, groupId: 'g1', getCurrentChatId: () => 'grp-1', groups: [{ id: 'g1', members: ['mara.png'] }] }), m, TAIL).chat.file, { group: true, dir: null, id: 'grp-1' });
    assert.ok(kit.characters.some(c => c.avatar === 'zed.png'));
});

test('묶음: 달라졌을 때만 넣어요. 실시간 폰이 없으면 없어요', () => {
    const m = world(), c = ctxOf();
    assert.equal(putKit(m, buildKit(c, m, TAIL)), true);
    assert.equal(putKit(m, buildKit(c, m, TAIL)), false);
    assert.equal(putKit(m, buildKit(c, m, { ...TAIL, end: 9 })), true);
    assert.equal(kitOf(m).tail.end, 9);
    // (넣은 것은 사본: 실리의 카드를 고쳐도 묶음은 그대로)
    c.characters[2].data.description = 'changed';
    assert.equal(kitOf(m).characters[1].data.description, 'Mara desc');
    assert.equal(buildKit(c, {}, TAIL), null);
    assert.equal(kitOf({ live: { kit: { v: 99 } } }), null);
});

test('묶음 → 서버의 실리 것: 같은 카드가 같은 자리에서 찾아져요', () => {
    const m = world(), c = ctxOf(), k = kitContext(buildKit(c, m, TAIL));
    // 이름으로 찾기: 브라우저와 같은 카드가 먼저
    const byName = (list, n) => list.find(x => String(x.name).toLowerCase() === n)?.avatar;
    for (const n of ['mara', 'varo', 'ivo']) assert.equal(byName(k.characters, n), byName(c.characters, n));
    // 이 채팅의 캐릭터
    assert.equal(k.characters[k.characterId].avatar, c.characters[c.characterId].avatar);
    assert.equal(k.groupId, null); assert.deepEqual(k.groups, []);
    assert.equal(k.name1, 'Ren'); assert.equal(k.persona, 'Ren is a student.');
    const g = kitContext(buildKit(ctxOf({ characterId: undefined, groupId: 'g1', groups: [{ id: 'g1', members: ['zed.png', 'mara.png'] }] }), m, TAIL));
    assert.equal(g.characterId, undefined); assert.equal(g.groupId, 'g1');
    assert.deepEqual(g.groups[0].members.map(a => g.characters.find(x => x.avatar === a)?.name), ['Zed', 'Mara']);
});
