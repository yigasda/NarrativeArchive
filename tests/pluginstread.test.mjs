// 실리 파일을 실리가 읽는 그대로 (plugin/stread.mjs: 실리 1.19.1 코드를 옮긴 것). 예시 캐릭터만 써요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chatData, chatParts, groupOf, personaFor, personaOf } from '../plugin/stread.mjs';

test('채팅 파일: 줄마다 읽고 못 읽는 줄은 빼요 (getChatData). 없거나 비었으면 []', async t => {
    const dir = await mkdtemp(path.join(tmpdir(), 'na-stread-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const f = path.join(dir, 'a.jsonl');
    await writeFile(f, '{"chat_metadata":{"x":1}}\n{"name":"Mara","mes":"hi"}\nnot json\n\n{"name":"Ren","is_user":true,"mes":"yo"}\n0\n');
    assert.deepEqual(await chatData(f), [{ chat_metadata: { x: 1 } }, { name: 'Mara', mes: 'hi' }, { name: 'Ren', is_user: true, mes: 'yo' }]);
    assert.deepEqual(await chatData(path.join(dir, 'none.jsonl')), []);
    await writeFile(f, '');
    assert.deepEqual(await chatData(f), []);
});

test('헤더와 메시지 나누기: 캐릭터 채팅은 첫 줄이 늘 헤더 (getChat), 그룹 채팅은 chat_metadata 칸이 있을 때만 (getGroupChat)', () => {
    const h = { chat_metadata: { persona: 'ren.png' }, user_name: 'unused' }, a = { name: 'Mara', mes: 'hi' };
    assert.deepEqual(chatParts([h, a], false), { metadata: { persona: 'ren.png' }, chat: [a] });
    assert.deepEqual(chatParts([a], false), { metadata: {}, chat: [] });
    assert.deepEqual(chatParts([], false), { metadata: {}, chat: [] });
    assert.deepEqual(chatParts([h, a], true), { metadata: { persona: 'ren.png' }, chat: [a] });
    assert.deepEqual(chatParts([a], true), { metadata: {}, chat: [a] });
    // (읽은 것은 안 건드려요)
    const data = [h, a]; chatParts(data, false); assert.equal(data.length, 2);
});

test('그룹: 옛 모양을 고치고(getGroups), 캐릭터가 없는 사람은 빼요(validateGroup). 파일의 것은 안 건드려요', () => {
    const chars = [{ name: 'Mara', avatar: 'mara.png' }, { name: 'Ivo', avatar: 'ivo.png' }];
    const raw = { id: 7, members: ['mara.png', 'gone.png', 'Ivo'], chat_id: 3, chats: [3, 3, 'b'] };
    const g = groupOf(raw, chars);
    assert.deepEqual([g.id, g.chat_id, g.chats, g.members, g.disabled_members], ['7', '3', ['3', 'b'], ['mara.png', 'Ivo'], []]);
    assert.deepEqual(raw.members, ['mara.png', 'gone.png', 'Ivo']);
    // (chat_id가 없는 아주 옛 그룹: 멤버가 이름이에요)
    const old = groupOf({ id: 'g', members: ['Mara', 'Nobody', 'Mara'] }, chars);
    assert.deepEqual([old.chat_id, old.chats, old.members], ['g', ['g'], ['mara.png']]);
    assert.equal(groupOf(null, chars), null);
});

test('페르소나 고르기 (loadPersonaForCurrentChat): 채팅 잠금 → 연결 → 기본 페르소나 → 지금 것', () => {
    const avatars = ['ren.png', 'varo.png', 'lio.png'];
    const settings = (power = {}, more = {}) => ({ user_avatar: 'ren.png', power_user: { personas: { 'ren.png': 'Ren', 'varo.png': 'Varo', 'lio.png': 'Lio' }, ...power }, ...more });
    assert.equal(personaFor(settings(), { avatars, key: 'mara.png' }), 'ren.png');
    assert.equal(personaFor(settings({ default_persona: 'lio.png' }), { avatars, key: 'mara.png' }), 'lio.png');
    const connected = { persona_descriptions: { 'ren.png': {}, 'varo.png': { connections: [{ type: 'character', id: 'mara.png' }] }, 'lio.png': { connections: [{ type: 'character', id: 'mara.png' }] } } };
    assert.equal(personaFor(settings({ default_persona: 'lio.png', ...connected }), { avatars, key: 'mara.png' }), 'varo.png');
    assert.equal(personaFor(settings({ default_persona: 'lio.png', ...connected }), { avatars, key: 'ivo.png' }), 'lio.png');
    assert.equal(personaFor(settings({ ...connected }), { avatars, key: 'mara.png', lock: 'lio.png' }), 'lio.png');
    // (잠근 페르소나의 그림이 없으면 잠금은 없는 것으로 · 지금 것의 그림이 없으면 목록의 첫 그림)
    assert.equal(personaFor(settings(), { avatars, key: 'mara.png', lock: 'gone.png' }), 'ren.png');
    assert.equal(personaFor(settings({}, { user_avatar: 'gone.png' }), { avatars, key: 'mara.png' }), 'ren.png');
    assert.equal(personaFor({}, { avatars: [], key: 'x' }), '');
});

test('그 페르소나의 이름과 설명 (selectCurrentPersona): 이름이 있으면 그 이름과 설명, 없으면 이름 · 설명은 전에 쓰던 것', () => {
    const s = { username: 'Old', power_user: { personas: { 'ren.png': 'Ren', 'varo.png': 'Varo' }, persona_descriptions: { 'ren.png': { description: 'Ren is a student.' } }, persona_description: 'kept' } };
    assert.deepEqual(personaOf(s, 'ren.png'), { name1: 'Ren', description: 'Ren is a student.' });
    assert.deepEqual(personaOf(s, 'varo.png'), { name1: 'Varo', description: '' });
    assert.deepEqual(personaOf(s, 'gone.png'), { name1: 'Old', description: 'kept' });
    assert.deepEqual(personaOf({}, ''), { name1: 'User', description: '' });
});

// ---- 다리가 없을 때: 카드 · 페르소나 그림을 실리 폴더에서 직접 (실리 서버의 /api/characters/all · /api/avatars/get을 옮긴 것)
import { mkdir } from 'node:fs/promises';
import { readCards, readImages, readCardText } from '../plugin/stread.mjs';
import { cardPng } from './stbridge.mjs';

test('카드 읽기 (다리 없을 때): PNG의 ccv3 먼저, 없으면 chara · v1 카드는 v2로 · 못 읽는 카드는 빠져요', async t => {
    const root = await mkdtemp(path.join(tmpdir(), 'na-cards-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(path.join(root, 'characters'));
    const v2 = { spec: 'chara_card_v2', spec_version: '2.0', name: 'old', data: { name: 'Mara', description: 'Mara is a baker.', personality: 'warm', scenario: '', first_mes: 'hi', mes_example: '', tags: ['a'], extensions: { talkativeness: 0.7, narrative_archive_convo: { x: 1 } } } };
    await writeFile(path.join(root, 'characters', 'mara.png'), cardPng({ chara: { ...v2, data: { ...v2.data, description: 'older' } }, ccv3: v2 }));
    await writeFile(path.join(root, 'characters', 'ivo.png'), cardPng({ chara: { name: 'Ivo', description: 'Ivo v1', talkativeness: '0.3', chat: 'Ivo - 1' } }));
    await writeFile(path.join(root, 'characters', 'bad.png'), Buffer.from('not a png'));
    await writeFile(path.join(root, 'characters', 'notes.txt'), 'x');
    const cards = await readCards(root), by = Object.fromEntries(cards.map(c => [c.avatar, c]));
    assert.deepEqual(Object.keys(by).sort(), ['ivo.png', 'mara.png']);
    // (readFromV2: data의 칸을 위로. 없는 talkativeness · fav는 실리처럼 결국 undefined)
    assert.deepEqual([by['mara.png'].name, by['mara.png'].description, by['mara.png'].talkativeness, by['mara.png'].fav, by['mara.png'].tags], ['Mara', 'Mara is a baker.', 0.7, undefined, ['a']]);
    assert.deepEqual(by['mara.png'].data.extensions.narrative_archive_convo, { x: 1 });
    assert.equal(JSON.parse(by['mara.png'].json_data).data.description, 'Mara is a baker.');
    // (convertToV2: v1 카드)
    const ivo = by['ivo.png'];
    assert.deepEqual([ivo.spec, ivo.name, ivo.description, ivo.data.description, ivo.data.extensions.talkativeness, ivo.chat, ivo.avatar], ['chara_card_v2', 'Ivo', 'Ivo v1', 'Ivo v1', '0.3', 'Ivo - 1', 'ivo.png']);
    assert.throws(() => readCardText(cardPng({ other: {} })), /No PNG metadata/);
    await assert.rejects(readCards(path.join(root, 'none')));
});

test('페르소나 그림 목록 (다리 없을 때): 파일만, 그림만, 이름 순', async t => {
    const root = await mkdtemp(path.join(tmpdir(), 'na-avatars-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(path.join(root, 'User Avatars', 'folder.png'), { recursive: true });
    for (const f of ['varo.png', 'Ren.jpg', 'lio.webp', 'notes.txt']) await writeFile(path.join(root, 'User Avatars', f), 'x');
    assert.deepEqual(await readImages(root), ['lio.webp', 'Ren.jpg', 'varo.png']);
    await assert.rejects(readImages(path.join(root, 'none')));
});
