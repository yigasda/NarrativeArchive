// 폰 2 저장 자리 (단계 1): m.live only, phone 1's m.phones never touched, nothing of phone 1 imports it
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as L from '../src/phone2store.js';

const src = f => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
const phone1 = () => ({ phones: { mara: { owner: 'Mara', now: '11-06 09:00', notes: [{ title: 'n', text: 't' }] } }, finance: { accounts: {} }, text: '## a', snapshots: [] });

test('폰 2 저장: the file imports nothing, and no file but the phone window imports it', async () => {
    assert.doesNotMatch(await src('phone2store.js'), /^\s*import\b/m);
    for (const f of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.js') && f !== 'phone2store.js' && f !== 'phone.js'))   // 4-2: only the phone's window (switch, picker, phone()) may call it
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

test('폰 2 저장: a new world beside 폰 1, the old one archived (never thrown away), phone 1 left as it was', () => {
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
const objects = (v, out = new Set()) => { if (v && typeof v === 'object' && !out.has(v)) { out.add(v); for (const x of Object.values(v)) objects(x, out); } return out; };

test('폰 2 이야기에서 시작: a deep copy of 폰 1\'s story keys, none of its objects shared, 폰 1 unchanged', () => {
    const m = rich(), before = JSON.stringify(m), mine = objects(Object.fromEntries(Object.keys(m).filter(k => k !== 'live').map(k => [k, m[k]])));
    assert.throws(() => L.startFromStory(m, { persona: 'Ren' }), /어느 메시지까지/);
    assert.equal(JSON.stringify(m), before);
    const w = L.startFromStory(m, { persona: 'Ren', upto: 482, scope: 's1', now: 5 });
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
    assert.deepEqual([w.from, w.storyUpto, w.phones, w.finance, w.profiles, w.pre, w.lore, w.loreOff, w.lastOwner], ['fresh', null, {}, null, {}, {}, [], {}, '']);
    const { live, ...rest } = m;
    assert.equal(JSON.stringify(rest), before);
});

test('폰 2 이야기에서 시작: a 폰 1 with only some keys copies those, the rest empty', () => {
    const m = { phones: {}, text: '' };
    const w = L.startFromStory(m, { persona: 'Ren', upto: 0 });
    assert.deepEqual([w.phones, w.finance, w.profiles, w.lore, w.lastOwner], [{}, null, {}, [], '']);
});
