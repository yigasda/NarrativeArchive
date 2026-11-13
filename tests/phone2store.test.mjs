// 폰 2 저장 자리 (단계 1): m.live only, phone 1's m.phones never touched, nothing of phone 1 imports it
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as L from '../src/phone2store.js';

const src = f => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
const phone1 = () => ({ phones: { mara: { owner: 'Mara', now: '11-06 09:00', notes: [{ title: 'n', text: 't' }] } }, finance: { accounts: {} }, text: '## a', snapshots: [] });

test('폰 2 저장: the file imports nothing, and no file but the phone window and 폰 2\'s story reader imports it', async () => {
    assert.doesNotMatch(await src('phone2store.js'), /^\s*import\b/m);
    const may = new Set(['phone2store.js', 'phone.js', 'phonestory.js', 'phone2story.js', 'phone2feed.js', 'phone2live.js', 'phone2run.js', 'phone2reflect.js', 'phone2go.js', 'phone2digest.js']);   // 4-2: the phone's window; 5-1: phone2story.js (beginFromStory); 6: phone2feed.js (the messenger as the reflection reads it)
    for (const f of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.js') && !may.has(f)))
        assert.doesNotMatch(await src(f), /phone2store/, f);
});

test('폰 2 저장: its name key is people.js nameKey, letter for letter', async () => {
    const line = (await src('people.js')).match(/export const nameKey = (.+);\n/)[1];
    assert.equal(line, "n => String(n || '').trim().toLowerCase()");
    assert.equal(String(L.liveKey), line);
});

test('폰 2 저장: reading and going back to 폰 1 never add m.live', () => {
    const m = phone1(), before = structuredClone(m);
    assert.equal(L.liveOf(m), null);
    assert.equal(L.liveWorld(m), null);
    assert.equal(L.liveMode(m), 'story');
    assert.equal(L.setLiveMode(m, 'story'), 'story');
    assert.deepEqual(L.archivedWorlds(m), []);
    assert.equal(L.livePhone(m, 'Mara'), null);
    assert.deepEqual(L.liveRooms(m), []);
    assert.equal(L.nextJob(m), null);
    assert.equal(L.archiveWorld(m), null);
    assert.deepEqual(m, before);
    assert.throws(() => L.setLiveMode(m, 'live'), /아직 폰 2가 없어요/);
    assert.deepEqual(m, before);
});

test('폰 2 저장: a new world beside 폰 1, the old one archived, phone 1 left as it was', () => {
    const m = phone1(), keep = structuredClone({ phones: m.phones, finance: m.finance, text: m.text });
    assert.throws(() => L.newWorld(m, {}), /페르소나/);
    const w = L.newWorld(m, { from: 'story', persona: 'Ren', dayShift: 2, storyUpto: 40, now: 1000 });
    assert.deepEqual([w.from, w.persona, w.dayShift, w.startedAt], ['story', 'Ren', 2, 1000]);
    assert.equal(L.liveMode(m), 'story');
    assert.equal(L.setLiveMode(m, 'live'), 'live');
    assert.equal(L.liveMode(m), 'live');
    const job = L.enqueueJob(m, { kind: 'reply', owner: 'Mara' });
    const w2 = L.newWorld(m, { persona: 'Ren', now: 2000 });
    assert.notEqual(w2.id, w.id);
    assert.equal(L.liveMode(m), 'story');
    const old = L.archivedWorlds(m);
    assert.equal(old.length, 1);
    assert.equal(old[0].id, w.id);
    assert.equal(old[0].archivedAt, 2000);
    assert.equal(old[0].queue.jobs[0].state, 'dropped');
    // (the archived world's job, ending late, counts for nothing)
    assert.equal(L.finishJob(m, job), false);
    assert.deepEqual({ phones: m.phones, finance: m.finance, text: m.text }, keep);
});

test('폰 2 저장: its phones are its own; a phone of 폰 1 never goes in', () => {
    const m = phone1();
    L.newWorld(m, { persona: 'Ren' });
    assert.throws(() => L.putLivePhone(m, m.phones.mara), /폰 1의 폰/);
    const p = L.putLivePhone(m, { owner: 'Mara', notes: [] });
    assert.equal(L.livePhone(m, ' mara '), p);
    assert.notEqual(L.livePhone(m, 'Mara'), m.phones.mara);
    assert.equal(Object.keys(m.phones).length, 1);
});

test('폰 2 메신저: every room has the persona; the same people are the same room', () => {
    const m = phone1();
    L.newWorld(m, { persona: 'Ren' });
    assert.throws(() => L.ensureRoom(m, []), /한 사람 이상/);
    assert.throws(() => L.ensureRoom(m, ['ren']), /한 사람 이상/);
    const a = L.ensureRoom(m, ['Mara']);
    assert.deepEqual(a.members, ['Ren', 'Mara']);
    assert.equal(L.ensureRoom(m, ['mara', 'Ren']), a);
    const g = L.ensureRoom(m, ['Mara', 'Ivo']);
    assert.notEqual(g, a);
    assert.ok(L.liveRooms(m).every(r => r.members.some(n => L.liveKey(n) === 'ren')));
    assert.deepEqual(Object.keys(L.liveWorld(m).messenger.accounts).sort(), ['ivo', 'mara', 'ren']);
});

test('폰 2 일의 줄: one at a time, in order; a failure stops the line until it is seen; another world\'s job counts for nothing', () => {
    const m = phone1();
    L.newWorld(m, { persona: 'Ren' });
    assert.throws(() => L.enqueueJob(m, { kind: 'other' }), /일 종류/);
    const a = L.enqueueJob(m, { kind: 'reply', owner: 'Mara' }), b = L.enqueueJob(m, { kind: 'reflect', owner: 'Mara' });
    assert.deepEqual([a.round, b.round], [1, 2]);
    assert.equal(L.nextJob(m).id, a.id);
    assert.equal(L.nextJob(m), null);
    assert.equal(L.finishJob(m, a), true);
    assert.equal(L.finishJob(m, a), false);
    assert.equal(L.nextJob(m).id, b.id);
    assert.equal(L.finishJob(m, b, { error: '시간 초과' }), false);
    const c = L.enqueueJob(m, { kind: 'reply', owner: 'Mara' });
    assert.equal(L.queueStopped(m), true);
    assert.equal(L.nextJob(m), null);
    assert.equal(L.seeFailure(m, b.id), true);
    assert.equal(L.nextJob(m).id, c.id);
    assert.equal(L.finishJob(m, { ...c, world: 'other' }), false);
    assert.equal(L.finishJob(m, c), true);
});

test('폰 2 저장: an m.live it can\'t read is left alone, never written over', () => {
    const m = { ...phone1(), live: { v: 99, world: 'x' } };
    assert.equal(L.liveOf(m), null);
    assert.throws(() => L.newWorld(m, { persona: 'Ren' }), /읽을 수 없어요/);
    assert.deepEqual(m.live, { v: 99, world: 'x' });
});

// 단계 2: what a 폰 2 begun from the story copies, deep (no object of 폰 1 shared), and 폰 1 left letter for letter
const rich = () => ({ ...phone1(), phoneProfiles: { mara: { label: 'comfortable' } }, phonePre: { ivo: { owner: 'Ivo', year: 2026 } },
    phoneLore: ['World'], phoneLoreOff: { World: ['u1'] }, phoneScreenHolder: 'Mara', lastPhoneOwner: 'Mara', phoneStoryScope: 's1', phoneStoryRun: 3,
    glossary: 'Mara = 마라', dateOrder: 'md' });
const MARK0 = { ranges: { '': [[0, 100]] }, titles: [], rawFrom: 101 };
const objects = (v, out = new Set()) => { if (v && typeof v === 'object' && !out.has(v)) { out.add(v); for (const x of Object.values(v)) objects(x, out); } return out; };

test('폰 2 이야기에서 시작: a deep copy of 폰 1\'s story keys, none of its objects shared, 폰 1 unchanged', () => {
    const m = rich(), before = JSON.stringify(m), mine = objects(Object.fromEntries(Object.keys(m).filter(k => k !== 'live').map(k => [k, m[k]])));
    assert.throws(() => L.startFromStory(m, { persona: 'Ren', story: MARK0 }), /어느 메시지까지/);
    assert.throws(() => L.startFromStory(m, { persona: 'Ren', upto: 482 }), /이야기 표시/);
    assert.equal(JSON.stringify(m), before);
    const w = L.startFromStory(m, { persona: 'Ren', upto: 482, scope: 's1', now: 5, story: MARK0 });
    assert.deepEqual(w.story, MARK0);
    assert.notEqual(w.story, MARK0);
    assert.deepEqual([w.from, w.storyUpto, w.scope, w.lastOwner], ['story', 482, 's1', 'Mara']);
    assert.deepEqual(w.phones, m.phones);
    assert.deepEqual(w.finance, m.finance);
    assert.deepEqual([w.profiles, w.pre, w.lore, w.loreOff], [m.phoneProfiles, m.phonePre, m.phoneLore, m.phoneLoreOff]);
    for (const o of objects(w)) assert.ok(!mine.has(o), 'an object of 폰 1 in 폰 2');
    // (폰 1's own: never copied; the shared ones are read where they are)
    assert.doesNotMatch(JSON.stringify(w), /phoneScreenHolder|phoneStoryRun|Mara = 마라/);
    // (폰 1 as it was, but for the one key m.live)
    const { live, ...rest } = m;
    assert.equal(JSON.stringify(rest), before);
    // (what 폰 2 does to its copy never reaches 폰 1)
    w.phones.mara.notes.push({ title: 'x', text: 'y' }); w.finance.accounts.a = 1; w.lore.push('Other');
    assert.equal(JSON.stringify(rest), before);
});

test('폰 2 처음부터 시작: an empty world, nothing of 폰 1 in it', () => {
    const m = rich(), before = JSON.stringify(m);
    const w = L.startFresh(m, { persona: 'Ren', scope: 's1' });
    assert.deepEqual([w.from, w.storyUpto, w.story, w.phones, w.finance, w.profiles, w.pre, w.lore, w.loreOff, w.lastOwner], ['fresh', null, null, {}, null, {}, {}, [], {}, '']);
    const { live, ...rest } = m;
    assert.equal(JSON.stringify(rest), before);
});

test('폰 2 이야기에서 시작: a 폰 1 with only some keys copies those, the rest empty', () => {
    const m = { phones: {}, text: '' };
    const w = L.startFromStory(m, { persona: 'Ren', upto: 0, story: { ranges: {}, titles: [], rawFrom: 0 } });
    assert.deepEqual([w.phones, w.finance, w.profiles, w.lore, w.lastOwner], [{}, null, {}, [], '']);
});

// 폰 2 서랍 (liveMeta): 폰 1 full of a mark, beside a 폰 2; nothing of 폰 1 is reachable through the drawer, nothing written through it lands in 폰 1
const P1 = 'POISON1';
const poisoned1 = () => ({
    phones: { mara: { owner: 'Mara', notes: [{ title: P1, text: `${P1} note` }], money: { tx: [{ who: P1 }] } } },
    finance: { accounts: { [`chk:${P1}`]: { owner: 'Mara' } } }, phoneProfiles: { mara: { label: P1 } }, phonePre: { ren: { owner: P1 } },
    phoneLore: [`${P1}Book`], phoneLoreOff: { [P1]: true }, lastPhoneOwner: `${P1}Mara`, phoneScreenHolder: P1, phoneStoryScope: P1, phoneStoryRun: { [P1]: 1 },
    people: [`${P1}Ivo`], text: `## ${P1} section\n${P1} story`, snapshots: [{ text: P1 }], digests: [P1], knowledge: { [P1]: P1 }, lastEvents: [P1],
    glossary: { Seoul: '서울' }, glossaryPeople: { Ren: '렌' }, dateOrder: 'mdy',
});
test('폰 2 서랍: 폰 1의 것은 하나도 안 보여요 (같이 쓰는 용어집 · 날짜 순서만 복사로)', () => {
    const m = poisoned1();
    L.startFresh(m, { persona: 'Lio' });
    L.putLivePhone(m, { owner: 'Ren', notes: [{ title: 'live note' }] });
    const v = L.liveMeta(m);
    assert.ok(L.isLiveMeta(v));
    assert.equal(L.isLiveMeta(m), false);
    assert.doesNotMatch(JSON.stringify({ ...v, phoneScreenHolder: undefined }), /POISON1/);
    // (화면 주인 is the chat's one setting, the same for both phones: the drawer reads and writes the chat's own)
    for (const k of Object.keys(poisoned1()).filter(k => k !== 'phoneScreenHolder')) assert.doesNotMatch(JSON.stringify(v[k] ?? null), /POISON1/, k);
    assert.deepEqual(Object.keys(v.phones), ['ren']);
    assert.equal(v.text, '');
    assert.equal(v.people, undefined);
    assert.equal(v.phoneScreenHolder, m.phoneScreenHolder);
    assert.equal(v.live, undefined);
    assert.deepEqual(v.glossary, { Seoul: '서울' });
    assert.notEqual(v.glossary, m.glossary);
    assert.equal('phones' in v, true);
    assert.equal('phoneScreenHolder' in v, true);
    assert.deepEqual({ ...v }.phones, v.phones);
});
test('폰 2 서랍: 쓰면 폰 2에만 (폰 1은 글자 하나 안 바뀌어요)', () => {
    const m = poisoned1();
    L.startFresh(m, { persona: 'Lio' });
    const before = JSON.stringify({ ...m, live: undefined }), w = L.liveWorld(m), v = L.liveMeta(m);
    v.phones.ren = { owner: 'Ren' };
    v.finance = { version: 1, accounts: {} };
    v.phoneLoreOff.Book = true;
    v.phoneProfiles.ren = { label: 'r' };
    v.lastPhoneOwner = 'Ren';
    v.people = ['Ivo'];
    v.text = 'x';
    v.glossary.Seoul = 'SEOUL';
    v.dateOrder = 'dmy';
    Object.assign(v, { knowledge: {} });
    delete v.digests;
    assert.equal(JSON.stringify({ ...m, live: undefined }), before);
    assert.deepEqual(Object.keys(w.phones), ['ren']);
    assert.deepEqual(w.finance, { version: 1, accounts: {} });
    assert.equal(w.loreOff.Book, true);
    assert.equal(w.lastOwner, 'Ren');
    assert.equal(v.people[0], 'Ivo');
    assert.equal(v.glossary.Seoul, 'SEOUL');
    assert.equal(m.glossary.Seoul, '서울');
});
test('폰 2 서랍: 폰 2가 없으면 만들지 않아요', () => {
    assert.throws(() => L.liveMeta({ phones: {} }), /폰 2/);
});

test('폰 2 메신저: 보내기 · 읽음 · 안 읽음 · 단체방 이름', () => {
    const m = {};
    L.startFresh(m, { persona: 'Yuna' });
    const r = L.ensureRoom(m, ['Mara']), g = L.ensureRoom(m, ['Mara', 'Ivo']);
    assert.throws(() => L.sendLive(m, r.id, '  '), /보낼 말/);
    assert.throws(() => L.sendLive(m, 'nope', 'hi'), /없는 방/);
    const a = L.sendLive(m, r.id, ' 안녕 ', 1000);
    assert.deepEqual([a.from, a.text, a.at], ['Yuna', '안녕', 1000]);
    assert.equal(L.unreadFor(r, 'Yuna'), 0);
    assert.deepEqual(L.unreadBy(r, a), ['Mara']);
    r.messages.push({ id: 'x', from: 'Mara', text: 'Hallo', at: 2000 });
    assert.equal(L.unreadFor(r, 'Yuna'), 1);
    L.readLive(m, r.id, 'yuna', 2500); L.readLive(m, r.id, 'Mara', 1500);
    assert.equal(L.unreadFor(r, 'Yuna'), 0); assert.deepEqual(L.unreadBy(r, a), []);
    L.readLive(m, r.id, 'Mara', 1200);   // (only forward)
    assert.equal(r.read.mara, 1500);
    L.readLive(m, r.id, 'Ivo', 9999);    // (not in the room: nothing)
    assert.equal(r.read.ivo, undefined);
    const b = L.sendLive(m, g.id, '토요일에 갈게', 3000);
    L.readLive(m, g.id, 'Mara', 3100);
    assert.deepEqual(L.unreadBy(g, b), ['Ivo']);
    L.nameRoom(m, g.id, '  Varo Werkstatt '); assert.equal(g.name, 'Varo Werkstatt');
    L.nameRoom(m, g.id, ''); assert.equal(g.name, undefined);
    assert.equal(m.phones, undefined); assert.equal(m.finance, undefined);   // (폰 1 칸은 그대로)
});
// 5-2: 폰 1's story begins anew
const withLive = () => {
    const m = rich();
    L.startFromStory(m, { persona: 'Lio', upto: 150, story: MARK0, dayShift: 3 });
    L.archiveWorld(m);
    const w = L.startFromStory(m, { persona: 'Lio', upto: 150, story: MARK0, dayShift: 3 });
    const room = L.ensureRoom(m, ['Ren']);
    room.messages.push({ from: 'Lio', text: 'hello' }, { from: 'Ren', text: 'hi' });
    L.enqueueJob(m, { kind: 'reply', owner: 'Ren' });
    L.setLiveMode(m, 'live');
    return { m, w, room };
};
test('새 이야기로 비우기 · 대화만 남기기: 메신저만 남고, 폰 · 장부 · 이야기 표시 · 보관함 · 기다리던 일은 없어요', () => {
    const { m, w, room } = withLive(), p1 = JSON.stringify({ ...m, live: undefined });
    assert.equal(L.resetLive(m), 'chats');
    const n = L.liveWorld(m);
    assert.notEqual(n.id, w.id);
    assert.deepEqual([n.from, n.storyUpto, n.story, n.dayShift, n.persona, n.lastOwner], ['fresh', null, null, 0, 'Lio', '']);
    assert.deepEqual([n.phones, n.finance, n.profiles, n.pre, n.lore, n.loreOff], [{}, null, {}, {}, [], {}]);
    assert.deepEqual(L.liveRooms(m).map(r => r.messages.map(x => x.text)), [['hello', 'hi']]);
    assert.equal(L.liveRooms(m)[0].id, room.id);
    assert.deepEqual(Object.keys(n.messenger.accounts).sort(), ['lio', 'ren']);
    assert.deepEqual(n.queue.jobs, []);
    assert.equal(L.nextJob(m), null);
    assert.deepEqual(L.archivedWorlds(m), []);
    assert.equal(L.liveMode(m), 'story');
    assert.doesNotMatch(JSON.stringify(m.live), /"notes"|comfortable|World/);
    assert.equal(JSON.stringify({ ...m, live: undefined }), p1);
});
test('새 이야기로 비우기 · 싹 다: m.live가 없어져요 (폰 1은 그대로)', () => {
    const { m } = withLive(), p1 = JSON.stringify({ ...m, live: undefined });
    assert.equal(L.resetLive(m, 'all'), 'all');
    assert.equal(Object.hasOwn(m, 'live'), false);
    assert.equal(JSON.stringify(m), p1);
    assert.equal(L.liveMode(m), 'story');
});
test('새 이야기로 비우기: 폰 2가 없으면 아무것도 안 만들고, 대화가 없으면 통째로, 못 읽는 m.live는 그대로', () => {
    const m = rich(), before = JSON.stringify(m);
    assert.equal(L.resetLive(m), 'none');
    assert.equal(L.resetLive(m, 'all'), 'none');
    assert.equal(JSON.stringify(m), before);
    L.startFresh(m, { persona: 'Lio' });
    assert.equal(L.resetLive(m, 'chats'), 'all');
    assert.equal(Object.hasOwn(m, 'live'), false);
    const other = { ...rich(), live: { v: 2, something: 'newer' } }, was = JSON.stringify(other);
    assert.equal(L.resetLive(other, 'all'), 'none');
    assert.equal(JSON.stringify(other), was);
    assert.throws(() => L.resetLive(m, 'some'), /all 또는 chats/);
});

// 5-4: this browser's keys
const mem = () => { const d = new Map(); return { getItem: k => d.get(k) ?? null, setItem: (k, v) => d.set(k, String(v)), removeItem: k => d.delete(k), d }; };
test('브라우저 저장: 폰 2는 채팅 · 세계마다 따로 된 키 (폰 1 키 · 복구 기록 키와 안 겹쳐요)', () => {
    const m = rich(), st = mem(), scope = 'narrativearchive:phone-owner:["character","a.png","chat"]';
    assert.equal(L.liveScope(scope, m), null);
    const w = L.startFresh(m, { persona: 'Lio' });
    L.putLivePhone(m, { owner: 'Ren' }); L.putLivePhone(m, { owner: 'Mara' });
    const k = L.liveScope(scope, m);
    assert.equal(k, `${scope}:live:${w.id}`);
    assert.notEqual(k, scope);
    assert.notEqual(`narrativearchive:sync:${k}`, `narrativearchive:sync:${scope}`);
    assert.equal(L.liveScope('', m), null);
    st.setItem(scope, 'Mara');   // (폰 1's own last owner, kept as it is)
    L.rememberLiveOwner(m, 'Ren', scope, st);
    assert.equal(w.lastOwner, 'Ren');
    assert.equal(st.getItem(k), 'Ren');
    assert.equal(st.getItem(scope), 'Mara');
    assert.equal(m.lastPhoneOwner, 'Mara');
    assert.equal(L.readLiveOwner(m, scope, st), 'Ren');
    // (the browser's newer than the chat's save; one no 폰 2 phone has is not used; a new world reads none of the old one's)
    w.lastOwner = 'Mara';
    assert.equal(L.readLiveOwner(m, scope, st), 'Ren');
    st.setItem(k, 'Nobody');
    assert.equal(L.readLiveOwner(m, scope, st), 'Mara');
    L.startFresh(m, { persona: 'Lio' });
    assert.notEqual(L.liveScope(scope, m), k);
    assert.equal(L.readLiveOwner(m, scope, st), null);
    // (browser storage off: the chat's save still works)
    const off = { getItem() { throw new Error('off'); }, setItem() { throw new Error('off'); } };
    L.putLivePhone(m, { owner: 'Ivo' });
    L.rememberLiveOwner(m, 'Ivo', scope, off);
    assert.equal(L.readLiveOwner(m, scope, off), 'Ivo');
});

test('메신저 번호: 이야기에서 시작한 폰 2는 이야기의 마지막 번호 다음부터 (처음부터 시작한 폰 2는 1번부터)', () => {
    const m = rich();
    L.startFromStory(m, { persona: 'Lio', upto: 150, story: MARK0 });
    const r = L.ensureRoom(m, ['Ren']);
    assert.equal(L.sendLive(m, r.id, 'a').n, 151);
    r.messages.push({ id: 'x', from: 'Ren', text: 'b', at: Date.now() + 5 });
    assert.equal(L.sendLive(m, r.id, 'c', Date.now() + 9).n, 153);
    assert.deepEqual(r.messages.map(x => x.n), [151, 152, 153]);
    const f = rich();
    L.startFresh(f, { persona: 'Lio' });
    assert.equal(L.sendLive(f, L.ensureRoom(f, ['Ren']).id, 'a').n, 1);
});

test('용어집을 화면에서 고치면(채팅 메타에 써요) 열려 있는 실시간 서랍도 바로 새 용어집을 읽어요', () => {
    const m = { phones: {}, glossary: 'Mara = 마라', glossaryPeople: ['Mara'] };
    L.startFresh(m, { persona: 'Ren', scope: 'test' });
    const v = L.liveMeta(m);
    assert.equal(v.glossary, 'Mara = 마라'); assert.deepEqual(v.glossaryPeople, ['Mara']);
    m.glossary = 'Mara = 마라\nIvo = 이보'; m.glossaryPeople = ['Mara', 'Ivo'];
    assert.equal(v.glossary, 'Mara = 마라\nIvo = 이보'); assert.deepEqual(v.glossaryPeople, ['Mara', 'Ivo']);
    // (what a 폰 1 function writes through the drawer still never reaches the chat's own)
    v.glossaryPeople.push('Varo');
    assert.deepEqual(m.glossaryPeople, ['Mara', 'Ivo']);
});

test('실시간 폰의 폰 객체에는 표시가 붙어요 (저장 · 복사에는 안 따라가요)', () => {
    const m = { phones: { mara: { owner: 'Mara' } } };
    L.startFresh(m, { persona: 'Ren', scope: 'test' });
    const v = L.liveMeta(m), LIVE = Symbol.for('narrative-archive.live');
    v.phones = { mara: { owner: 'Mara', now: '11-12 10:00' } };
    assert.equal(v.phones.mara[LIVE], true);
    assert.equal(L.livePhone(m, 'Mara')[LIVE], true);
    v.phones.ivo = { owner: 'Ivo' };
    assert.equal(v.phones.ivo[LIVE], true);
    assert.equal(m.phones.mara[LIVE], undefined);
    assert.equal(JSON.stringify(v.phones.mara), '{"owner":"Mara","now":"11-12 10:00"}');
    assert.equal(structuredClone(v.phones.mara)[LIVE], undefined);
    assert.deepEqual(Object.keys(v.phones.mara), ['owner', 'now']);
});

test('화면 주인은 채팅에 하나: 실시간 서랍에서 읽고 고치면 채팅의 값이에요 (타임라인과 같은 값)', () => {
    const m = { phones: {}, phoneScreenHolder: 'Mara' };
    L.startFresh(m, { persona: 'Ren', scope: 'test' });
    const v = L.liveMeta(m);
    assert.equal(v.phoneScreenHolder, 'Mara'); assert.equal(Object.hasOwn(v, 'phoneScreenHolder'), true);
    v.phoneScreenHolder = 'Ivo';
    assert.equal(m.phoneScreenHolder, 'Ivo'); assert.equal(v.phoneScreenHolder, 'Ivo');
    assert.doesNotMatch(JSON.stringify(m.live), /Ivo/);
    // (a chat that never set it: not there, and set through the drawer it is the chat's)
    const n = { phones: {} };
    L.startFresh(n, { persona: 'Ren', scope: 'test' });
    const u = L.liveMeta(n);
    assert.equal(Object.hasOwn(u, 'phoneScreenHolder'), false);
    u.phoneScreenHolder = '';
    assert.equal(Object.hasOwn(n, 'phoneScreenHolder'), true);
});

test('보관함은 가장 최근 것 2개만: 폰 2를 여러 번 새로 시작해도 저장 데이터가 끝없이 커지지 않아요', () => {
    const m = { phones: {} };
    for (let i = 1; i <= 5; i++) L.startFresh(m, { persona: `P${i}`, scope: 'test', now: i * 1000 });
    assert.deepEqual(L.archivedWorlds(m).map(w => w.persona), ['P3', 'P4']);
    assert.equal(L.liveWorld(m).persona, 'P5');
});
