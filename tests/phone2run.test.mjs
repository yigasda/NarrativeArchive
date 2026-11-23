// 폰 2 답장: 답을 메신저에 넣기(7-2), 일의 줄(7-3)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import * as R from '../src/phone2run.js';
import { feedText, feedRows } from '../src/phone2feed.js';

const T0 = Date.parse('2026-11-06T13:00:00Z');
function world() {
    const m = { phones: {} };
    L.startFresh(m, { persona: 'Ren' });
    L.putLivePhone(m, { owner: 'Mara' }); L.putLivePhone(m, { owner: 'Ivo' });
    const r = L.ensureRoom(m, ['Mara']);
    L.sendLive(m, r.id, '점심 먹었어?', T0);
    return { m, r, w: L.liveWorld(m) };
}
const ANSWER = { state: '14:02 · office · canteen · ~14:30', reply: ['Oui maman.', '방금 먹었어', ' '], ko: ['응 엄마.', ''], does: [{ app: 'bank, cards & wallet', what: 'pays 6 EUR at the canteen' }, { app: 'Wallet', what: 'x' }, { app: 'Smart fridge', what: 'looks inside' }, { app: 'Notes' }] };

test('답을 말풍선으로: 번호 · 실제 시각 · 한국어 · 상태(시각 뺀 것), 한 일은 마지막 말풍선에', () => {
    const { m, r } = world();
    assert.deepEqual(R.takeReply(m, 'mara', r.id, ANSWER, { now: T0 + 60_000 }), { said: 2, does: 3, state: 'office · canteen · ~14:30', react: '' });
    const [, a, b] = r.messages;
    assert.deepEqual([a.n, a.from, a.text, a.ko, a.state, a.at, a.does], [2, 'Mara', 'Oui maman.', '응 엄마.', 'office · canteen · ~14:30', T0 + 60_000, undefined]);
    assert.deepEqual([b.n, b.text, b.ko, b.at], [3, '방금 먹었어', undefined, T0 + 60_001]);
    assert.deepEqual(b.does, [{ app: 'Bank, cards & wallet', what: 'pays 6 EUR at the canteen' }, { app: 'Bank, cards & wallet', what: 'x' }, { app: 'Smart fridge', what: 'looks inside' }]);
    assert.notEqual(a.id, b.id);
    // (the owner has read the room; the persona has not read the answer yet)
    assert.equal(L.unreadFor(r, 'Mara'), 0);
    assert.equal(L.unreadFor(r, 'Ren'), 2);
    // (the reflection reads it as a scene with its action lines)
    assert.match(feedText(m, 'Mara', feedRows(m, 'Mara'), { tz: 'UTC' }), /\[#3\] Mara: 방금 먹었어\n\[#3\] Mara \[Bank, cards & wallet\]: pays 6 EUR at the canteen\n/);
});

test('글로 온 답도 읽어요(앞뒤 말 · 코드 울타리), 못 읽으면 아무것도 안 넣어요', () => {
    const { m, r } = world();
    R.takeReply(m, 'Mara', r.id, 'Here you go:\n```json\n{ "state": "home", "reply": ["ok"], "ko": ["응"], "does": [] }\n```', { now: T0 + 1 });
    assert.deepEqual(r.messages.slice(1).map(x => [x.text, x.ko, x.state]), [['ok', '응', 'home']]);
    const was = JSON.stringify(m);
    for (const bad of ['no json here', '{ "reply": "not a list" }', '{ broken', null, [1]]) assert.throws(() => R.takeReply(m, 'Mara', r.id, bad, { now: T0 + 2 }), /답장을 읽지 못했어요/);
    assert.throws(() => R.takeReply(m, 'Lio', r.id, ANSWER), /방이 없어요/);
    assert.equal(JSON.stringify(m), was);
});

test('읽고 답 안 함: 말풍선 없이 한 일 · 상태만 남아요(act); 아무것도 없으면 읽음 표시만; 이미 한 말은 또 안 해요', () => {
    const { m, r } = world();
    assert.deepEqual(R.takeReply(m, 'Mara', r.id, { state: 'tram', reply: [], does: [{ app: 'Diary', what: 'writes it down' }] }, { now: T0 + 5 }), { said: 0, does: 1, state: 'tram', react: '' });
    assert.deepEqual([r.messages[1].act, r.messages[1].text, r.messages[1].does.length, r.messages[1].state], [true, '', 1, 'tram']);
    assert.match(feedText(m, 'Mara', feedRows(m, 'Mara'), { tz: 'UTC' }), /— tram\n\[#1\] Ren: 점심 먹었어\?\n\[#2\] Mara \[Diary\]: writes it down$/);
    const n = r.messages.length;
    R.takeReply(m, 'Mara', r.id, { reply: [] }, { now: T0 + 9 });
    assert.equal(r.messages.length, n);
    assert.equal(r.read.mara, T0 + 9);
    R.takeReply(m, 'Mara', r.id, { reply: ['salut'] }, { now: T0 + 10 });
    R.takeReply(m, 'Mara', r.id, { reply: ['salut', 'encore'] }, { now: T0 + 20 });
    assert.deepEqual(r.messages.filter(x => x.text).map(x => x.text), ['점심 먹었어?', 'salut', 'encore']);
});

test('보내면 방의 다른 사람마다 답장 일이 하나씩 (같은 방 · 같은 사람은 기다리는 게 있으면 또 안 서요)', () => {
    const { m, r } = world();
    const g = L.ensureRoom(m, ['Mara', 'Ivo', 'Lio']);   // (Lio has no phone: no job)
    assert.deepEqual(L.enqueueReplies(m, r.id).map(j => [j.kind, j.owner, j.room]), [['reply', 'Mara', r.id]]);
    assert.deepEqual(L.enqueueReplies(m, r.id), []);
    assert.deepEqual(L.enqueueReplies(m, g.id).map(j => j.owner), ['Mara', 'Ivo']);
    assert.throws(() => L.enqueueReplies(m, 'nope'), /없는 방/);
});

const runner = (x, answers, log = []) => ({ gather: async job => ({ system: `SYS ${job.owner}`, input: `IN ${job.owner} ${job.room}` }), ask: async (input, o) => { log.push([input, o.system]); const a = answers.shift(); if (a instanceof Error) throw a; return a; }, save: async () => { log.push('save'); }, now: () => T0 + 1000 + log.length });

test('일의 줄: 하나씩 차례로, 끝나면 저장, 답은 그 방에', async () => {
    const x = world(), g = L.ensureRoom(x.m, ['Mara', 'Ivo']), log = [];
    L.enqueueReplies(x.m, x.r.id); L.enqueueReplies(x.m, g.id);
    const res = await R.runLive(x.m, runner(x, [{ reply: ['a'] }, { reply: ['b'] }, { reply: ['c'] }], log));
    assert.deepEqual(res, { ran: 3, failed: null });
    assert.deepEqual(log.filter(l => l !== 'save').map(l => l[1]), ['SYS Mara', 'SYS Mara', 'SYS Ivo']);
    assert.equal(log.filter(l => l === 'save').length, 3);
    assert.deepEqual(x.r.messages.map(y => y.text), ['점심 먹었어?', 'a']);
    assert.deepEqual(g.messages.map(y => [y.from, y.text]), [['Mara', 'b'], ['Ivo', 'c']]);
    assert.deepEqual(x.w.queue.jobs.map(j => j.state), ['done', 'done', 'done']);
    assert.deepEqual(await R.runLive(x.m, runner(x, [])), { ran: 0, failed: null });
});

test('일의 줄: 실패하면 거기서 멈추고, 본 뒤에야 다음 것이 돌아요; 실패한 답은 안 들어가요', async () => {
    const x = world(), g = L.ensureRoom(x.m, ['Ivo']);
    L.enqueueReplies(x.m, x.r.id); L.enqueueReplies(x.m, g.id);
    const res = await R.runLive(x.m, runner(x, [new Error('모델이 답하지 않았어요'), { reply: ['later'] }]));
    assert.equal(res.ran, 0);
    assert.equal(res.failed.error, '모델이 답하지 않았어요');
    assert.deepEqual(x.w.queue.jobs.map(j => j.state), ['failed', 'waiting']);
    assert.equal(x.r.messages.length, 1);
    assert.equal(L.queueStopped(x.m), true);
    assert.deepEqual(await R.runLive(x.m, runner(x, [{ reply: ['later'] }])), { ran: 0, failed: null });
    L.seeFailure(x.m, x.w.queue.jobs[0].id);
    assert.deepEqual(await R.runLive(x.m, runner(x, [{ reply: ['later'] }])), { ran: 1, failed: null });
    assert.deepEqual(g.messages.map(y => y.text), ['later']);
    // (an answer that can't be read is a failure too, nothing put in)
    L.enqueueReplies(x.m, x.r.id);
    const bad = await R.runLive(x.m, runner(x, ['not json']));
    assert.match(bad.failed.error, /답장을 읽지 못했어요/);
    assert.equal(x.r.messages.length, 1);
});

test('일의 줄: 답을 기다리는 사이 폰 2가 바뀌면 그 답은 버려요; 한 번에 하나만 돌아요; 닫힌 창이 남긴 일은 다시 기다려요', async () => {
    const x = world();
    L.enqueueReplies(x.m, x.r.id);
    const slow = { ...runner(x, []), ask: async () => { L.startFresh(x.m, { persona: 'Ren' }); return { reply: ['from the old world'] }; } };
    assert.deepEqual(await R.runLive(x.m, slow), { ran: 0, failed: null });
    assert.deepEqual(L.liveRooms(x.m), []);
    // one runner at a time
    const y = world(); L.enqueueReplies(y.m, y.r.id);
    let second = null;
    const one = { ...runner(y, []), ask: async () => { second = await R.runLive(y.m, runner(y, [{ reply: ['twice'] }])); return { reply: ['once'] }; } };
    assert.deepEqual(await R.runLive(y.m, one), { ran: 1, failed: null });
    assert.deepEqual(second, { ran: 0, failed: null, busy: true });
    assert.deepEqual(y.r.messages.map(z => z.text), ['점심 먹었어?', 'once']);
    // a job a closed page left running
    const z = world(); L.enqueueReplies(z.m, z.r.id);
    L.nextJob(z.m);
    assert.equal(L.nextJob(z.m), null);
    assert.deepEqual(await R.runLive(z.m, runner(z, [{ reply: ['back'] }])), { ran: 1, failed: null });
    // nothing to answer any more (gather gives null): the job is done, the model isn't asked
    const q = world(); L.enqueueReplies(q.m, q.r.id);
    let asked = 0;
    assert.deepEqual(await R.runLive(q.m, { gather: async () => null, ask: async () => { asked++; } }), { ran: 1, failed: null });
    assert.equal(asked, 0);
});

test('일의 줄 · 방 자물쇠(enter): 방마다 처음 한 번 들어가요. 다른 쪽이 쓰고 있는 방은 이번엔 건너뛰고(일은 기다려요), 다른 방은 돌아요. 끝나면 다 놓아요', async () => {
    const x = world(), g = L.ensureRoom(x.m, ['Mara', 'Ivo']), log = [];
    L.enqueueReplies(x.m, x.r.id); L.enqueueReplies(x.m, g.id);
    const entered = [], let_go = [];
    const enter = async room => { entered.push(room); return room === x.r.id ? null : () => let_go.push(room); };
    const res = await R.runLive(x.m, { ...runner(x, [{ reply: ['b'] }, { reply: ['c'] }], log), enter });
    assert.deepEqual(res, { ran: 2, failed: null, skipped: [x.r.id] });
    assert.deepEqual(entered, [x.r.id, g.id]);
    assert.deepEqual(let_go, [g.id]);
    assert.deepEqual(x.w.queue.jobs.map(j => [j.room, j.state]), [[x.r.id, 'waiting'], [g.id, 'done'], [g.id, 'done']]);
    assert.deepEqual(g.messages.map(y => [y.from, y.text]), [['Mara', 'b'], ['Ivo', 'c']]);
    assert.equal(x.r.messages.length, 1);
    // 다음에 들어갈 수 있으면 그 방도 돌아요
    entered.length = 0;
    assert.deepEqual(await R.runLive(x.m, { ...runner(x, [{ reply: ['a'] }]), enter: async room => { entered.push(room); return () => {}; } }), { ran: 1, failed: null });
    assert.deepEqual(entered, [x.r.id]);
    assert.deepEqual(x.r.messages.map(y => y.text), ['점심 먹었어?', 'a']);
});

test('일의 줄 · 방 자물쇠: 들어가면서 받은 것(다른 쪽이 그사이 끝낸 일)을 보고 다시 골라요 — 이미 끝난 일은 또 안 해요. 실패해도 놓아요', async () => {
    const x = world(), log = [];
    const [job] = L.enqueueReplies(x.m, x.r.id);
    // (들어가는 사이에: 다른 쪽이 그 답장을 이미 했어요 — phone2keepon.js keepSync가 들여오는 것)
    const enter = async () => { job.state = 'done'; x.r.messages.push({ id: 's1', n: 2, from: 'Mara', text: 'from the server', at: T0 + 5 }); return () => log.push('let go'); };
    assert.deepEqual(await R.runLive(x.m, { ...runner(x, [{ reply: ['twice'] }], log), enter }), { ran: 0, failed: null });
    assert.deepEqual(x.r.messages.map(y => y.text), ['점심 먹었어?', 'from the server']);
    assert.deepEqual(log, ['let go']);
    // 실패: 그래도 놓아요
    const y = world(), out = [];
    L.enqueueReplies(y.m, y.r.id);
    const res = await R.runLive(y.m, { ...runner(y, [new Error('boom')]), enter: async () => () => out.push('let go') });
    assert.equal(res.failed.error, 'boom');
    assert.deepEqual(out, ['let go']);
    // (enter가 없으면 전과 같아요)
    const z = world(); L.enqueueReplies(z.m, z.r.id);
    assert.deepEqual(await R.runLive(z.m, runner(z, [{ reply: ['ok'] }])), { ran: 1, failed: null });
});

test('끝난 일은 최근 것만 남겨요 (기다리는 것 · 실패한 것은 늘 남아요)', () => {
    const { m, w } = world();
    for (let i = 0; i < 30; i++) { const j = L.enqueueJob(m, { kind: 'reply', owner: 'Mara', room: 'r' }); j.state = i === 3 ? 'failed' : 'done'; }
    L.enqueueJob(m, { kind: 'reply', owner: 'Mara', room: 'r' });
    assert.equal(w.queue.jobs.filter(j => j.state === 'done').length, L.JOBS_KEPT);
    assert.equal(w.queue.jobs.filter(j => j.state === 'failed').length, 1);
    assert.equal(w.queue.jobs.at(-1).state, 'waiting');
});

test('폰 1은 이 파일을 안 불러요', async () => {
    const src = f => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
    for (const f of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.js') && f !== 'phone2run.js' && f !== 'phone2go.js')) assert.doesNotMatch(await src(f), /from '\.\/phone2run\.js'/, f);
});

test('답장의 한국어는 원문과 같은 모양으로: 원문에 없는 마침표 · 쉼표는 떼고, 있으면 둬요', () => {
    const m = { phones: {} };
    L.startFresh(m, { persona: 'Ren', scope: 'test' });
    L.liveWorld(m).phones = { mara: { owner: 'Mara' } };
    const r = L.ensureRoom(m, ['Mara']);
    L.sendLive(m, r.id, 'hi', 1);
    R.takeReply(m, 'Mara', r.id, { state: 'home', reply: ['I was thinking maybe we should go', 'Fine.', 'ok'], ko: ['생각해 봤는데, 우리 가는 게 좋겠어.', '알았어.', '응.'] }, { now: 5 });
    assert.deepEqual(r.messages.slice(1).map(x => x.ko), ['생각해 봤는데 우리 가는 게 좋겠어', '알았어.', '응']);
});
