// 스케줄 · 상태 · 먼저 말 걸기 · 늦은 답을 우리 방에 잇기 (src/phone2sched.js). 판단과 지시문은 마리나라의 것(src/marinara/)이에요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from './phone2reflect.load.mjs';

const at = f => import(new URL(`../src/${f}`, import.meta.url));
const L = await at('phone2store.js'), S = await at('phone2sched.js'), ASK = await at('phone2ask.js');
const DAYS = S.CONVERSATION_SCHEDULE_DAYS;
const week = blocks => ({ days: Object.fromEntries(DAYS.map(d => [d, blocks])), talkativeness: 80, inactivityThresholdMinutes: 15 });
const all = (status, activity = 'x') => week([{ time: '00:00-00:00', activity, status }]);
function world() {
    const m = { phones: {} };
    L.startFresh(m, { persona: 'Ren', scope: 'test' });
    const w = L.liveWorld(m);
    w.phones = { mara: { owner: 'Mara' }, ivo: { owner: 'Ivo' } };
    const a = L.ensureRoom(m, ['Mara']);
    return { m, w, a };
}
const NOW = new Date('2026-11-23T03:00:00Z');   // (월요일)

test('상태와 늦은 답: 스케줄이 없으면 바로, 바쁘면 늦게, 오프라인이면 지금은 안 해요', () => {
    const { m } = world();
    assert.equal(S.statusNow(m, 'Mara', { now: NOW }), null);
    assert.equal(S.replyDelay(m, 'Mara', { now: NOW }), 0);
    S.setSchedule(m, 'Mara', all('dnd', 'working'), NOW);
    assert.deepEqual(S.statusNow(m, 'Mara', { now: NOW }), { status: 'dnd', activity: 'working' });
    assert.ok(S.replyDelay(m, 'Mara', { now: NOW }) > 0);
    S.setSchedule(m, 'Mara', { ...all('dnd', 'working'), dndResponseDelayMinutes: 7 }, NOW);
    assert.equal(S.replyDelay(m, 'Mara', { now: NOW }), 7 * 60_000);
    S.setSchedule(m, 'Mara', all('offline', 'sleeping'), NOW);
    assert.equal(S.replyDelay(m, 'Mara', { now: NOW }), null);
    S.setSchedule(m, 'Mara', all('online'), NOW);
    assert.equal(S.replyDelay(m, 'Mara', { now: NOW }), 0);
    assert.ok(S.scheduleOf(m, 'mara').weekStart);
    S.setSchedule(m, 'Mara', null);
    assert.equal(S.scheduleOf(m, 'Mara'), null);
});
test('손으로 준 상태가 스케줄보다 앞서고, 시간이 지나면 풀려요', () => {
    const { m } = world();
    S.setSchedule(m, 'Mara', all('online', 'free'), NOW);
    S.setStatusOverride(m, 'Mara', { status: 'offline', activity: 'phone died', minutes: 30 }, NOW);
    assert.equal(S.statusNow(m, 'Mara', { now: NOW }).status, 'offline');
    assert.equal(S.statusNow(m, 'Mara', { now: NOW }).activity, 'phone died');
    assert.equal(S.statusNow(m, 'Mara', { now: new Date(NOW.getTime() + 31 * 60_000) }).status, 'online');
    S.setStatusOverride(m, 'Mara', {});
    assert.equal(S.statusNow(m, 'Mara', { now: NOW }).status, 'online');
    assert.throws(() => S.setStatusOverride(m, 'Mara', { status: 'asleep' }), /online/);
    assert.throws(() => S.setUserStatus(m, { status: 'gone' }), /active/);
});
test('시간대: 그 사람의 시간으로 스케줄을 읽어요', () => {
    const { m } = world();
    S.setSchedule(m, 'Mara', week([{ time: '00:00-09:00', activity: 'sleeping', status: 'offline' }, { time: '09:00-00:00', activity: 'up', status: 'online' }]), NOW);
    const t = new Date('2026-11-23T10:00:00Z');
    assert.equal(S.statusNow(m, 'Mara', { now: t, tz: 'Asia/Seoul' }).status, 'online');        // 서울 19:00
    assert.equal(S.statusNow(m, 'Mara', { now: t, tz: 'America/New_York' }).status, 'offline'); // 뉴욕 05:00
});
test('상황 글: 마리나라의 줄 그대로 답장 요청의 CONTEXT에 들어가요. 스케줄 · 상태가 없는 사람에게는 안 넣어요', () => {
    const { m, a } = world();
    assert.equal(S.contextBlock(m, 'Mara', a.id, { now: NOW }), '');
    S.setSchedule(m, 'Mara', all('dnd', 'working'), NOW);
    S.setUserStatus(m, { status: 'idle', activity: '  cooking   dinner ' });
    const t = S.contextBlock(m, 'Mara', a.id, { now: NOW, tzOf: () => 'Asia/Seoul', lastRole: 'user', said: true });
    assert.match(t, /^Your current status: busy \/ do not disturb \(working\)\.\nRen's status: idle \/ away from the computer - cooking dinner\.\nYour schedule today \(Monday\): /);
    assert.match(t, /\nThe current time and date: 12:00, /);
    assert.doesNotMatch(t, /proactive/);
    // 먼저 말 거는 차례: 마리나라의 그 줄과 이유
    const p = S.contextBlock(m, 'Mara', a.id, { now: NOW, lastRole: 'assistant', said: false, intentKey: 'after_busy' });
    assert.match(p, /No new message from Ren was sent in this request; this is a proactive\/autonomous turn\./);
    assert.match(p, /What prompted this message: You just wrapped up a busy stretch\./);
    S.setUserStatus(m, { status: 'invisible' });
    assert.doesNotMatch(S.contextBlock(m, 'Mara', a.id, { now: NOW }), /Ren's status/);
    assert.match(ASK.replyInput({ owner: 'Mara', persona: 'Ren', messenger: [], now: {}, context: t }), /\n\n\[CONTEXT\]\nYour current status: /);
    assert.doesNotMatch(ASK.replyInput({ owner: 'Mara', persona: 'Ren', messenger: [], now: {} }), /CONTEXT/);
});
test('스케줄 만들기: 마리나라의 지시문으로 묻고, 답을 넣어요. 손으로 정한 값은 남아요', async () => {
    const { m } = world(), asked = [];
    const day = [{ time: '00:00-07:00', activity: 'sleeping', status: 'offline' }, { time: '07:00-00:00', activity: 'reading' }];
    const ask = async (messages, o) => { asked.push({ messages, o }); return JSON.stringify({ talkativeness: 30, inactivityThresholdMinutes: 90, days: Object.fromEntries(DAYS.map(d => [d, day])) }); };
    const got = await S.makeSchedule(m, 'Mara', { ask, description: 'a night nurse', guidance: 'works nights', tz: 'Asia/Seoul', now: NOW });
    assert.equal(asked[0].messages[0].role, 'system');
    assert.match(asked[0].messages[0].content, /^You are a schedule generator\. Create a realistic weekly schedule/);
    assert.match(asked[0].messages[0].content, /Character: Mara\nDescription: a night nurse\n/);
    assert.match(asked[0].messages[0].content, /works nights/);
    assert.equal(asked[0].messages[1].content, 'Generate the schedule now.');
    assert.equal(got.talkativeness, 30);
    assert.equal(got.days.Monday[1].status, 'online');      // (상태가 없으면 마리나라가 활동으로 정해요)
    assert.equal(S.scheduleOf(m, 'Mara'), got);
    S.scheduleOf(m, 'Mara').dndResponseDelayMinutes = 3;
    await S.makeSchedule(m, 'Mara', { ask, mode: 'vary', now: NOW });
    assert.match(asked[1].messages[0].content, /Draft action: Vary current week\./);
    assert.equal(S.scheduleOf(m, 'Mara').dndResponseDelayMinutes, 3);
    // 하루만
    const one = async () => JSON.stringify({ blocks: [{ time: '00:00-00:00', activity: 'day off', status: 'online' }] });
    const d = await S.makeSchedule(m, 'Mara', { ask: one, day: 'Sunday', now: NOW }).catch(e => e);
    assert.ok(d instanceof Error || d.days.Sunday[0].activity === 'day off');
    await assert.rejects(S.makeSchedule(m, 'Mara', { ask: async () => 'not json', now: NOW }), S.ScheduleDraftError);
    await assert.rejects(S.makeSchedule(m, 'Ivo', { ask, day: 'Monday' }), /먼저 한 주/);
});
test('먼저 말 걸기: 꺼져 있으면 안 하고, 켜면 마리나라의 판단대로. 줄 세우면 오늘 수와 쉬는 시간을 적어요', () => {
    // (마리나라의 판단은 진짜 지금 시각으로 재요)
    const { m, w, a } = world(), t = Date.now(), NOW = new Date(t);
    a.messages.push({ id: 'x1', n: 1, from: 'Ren', text: 'hi', at: t - 3 * 3600e3 }, { id: 'x2', n: 2, from: 'Mara', text: 'hey', at: t - 2.9 * 3600e3 });
    S.setSchedule(m, 'Mara', all('online', 'free'), NOW);
    assert.equal(S.checkProactive(m, a.id, { now: NOW }).reason, 'disabled');
    S.setAutonomous(m, true);
    S.setUserStatus(m, { status: 'dnd' });
    assert.equal(S.checkProactive(m, a.id, { now: NOW }).reason, 'user_dnd');
    S.setUserStatus(m, { status: 'idle' });
    const r = S.checkProactive(m, a.id, { now: NOW });
    assert.equal(r.shouldTrigger, true);
    assert.deepEqual(r.characterIds, ['mara']);
    assert.ok(r.autonomousIntentKey && r.autonomousIntent);
    S.noteProactive(m, a.id, 'mara', r.autonomousIntentKey, NOW);
    assert.equal(Object.values(w.presence.meta.autonomousDailyBudget.counts)[0], 1);
    // 폰이 없는 사람만 있는 방은 안 해요
    const b = L.ensureRoom(m, ['Nobody']);
    assert.equal(S.checkProactive(m, b.id, { now: NOW }).shouldTrigger, false);
    // 오프라인인 사람은 안 걸어요
    S.setSchedule(m, 'Mara', all('offline', 'sleeping'), NOW);
    assert.equal(S.checkProactive(m, a.id, { now: NOW }).shouldTrigger, false);
});
test('줄: 때가 안 된 답장은 건너뛰고, 때가 되면 돌려요', () => {
    const { m, w, a } = world();
    const j = L.enqueueJob(m, { kind: 'reply', owner: 'Mara', room: a.id, at: 1000 });
    j.notBefore = 5000;
    assert.equal(L.nextJob(m, 4000), null);
    assert.equal(L.nextJob(m, 5000).id, j.id);
    assert.equal(w.queue.jobs[0].state, 'running');
});
test('늦은 답 정하기: 바쁘면 그만큼 뒤, 오프라인이면 돌아올 때까지 1분마다 다시 봐요', () => {
    const { m, w, a } = world(), t = NOW.getTime();
    const j = L.enqueueJob(m, { kind: 'reply', owner: 'Mara', room: a.id, at: t });
    assert.equal(G.holdReplies(m, t), 0);                       // 스케줄이 없으면 바로
    assert.equal(j.notBefore, undefined);
    delete j.timed;
    S.setSchedule(m, 'Mara', { ...all('dnd', 'working'), dndResponseDelayMinutes: 7 }, NOW);
    assert.equal(G.holdReplies(m, t), 1);
    assert.equal(j.notBefore, t + 7 * 60_000);
    assert.deepEqual(G.liveReplyWait(m, t), [{ owner: 'Mara', room: a.id, until: t + 7 * 60_000, away: false }]);
    assert.equal(G.holdReplies(m, t + 60_000), 0);              // (한 번 정한 때는 그대로)
    assert.equal(j.notBefore, t + 7 * 60_000);
    delete j.timed; delete j.notBefore;
    S.setSchedule(m, 'Mara', all('offline', 'sleeping'), NOW);
    assert.equal(G.holdReplies(m, t), 1);
    assert.deepEqual(G.liveReplyWait(m, t), [{ owner: 'Mara', room: a.id, until: null, away: true }]);
    S.setSchedule(m, 'Mara', all('online'), NOW);
    assert.equal(G.holdReplies(m, t + 120_000), 0);
    assert.equal(j.notBefore, undefined);
    assert.equal(w.queue.jobs[0].away, undefined);
});
test('이 파일은 폰 2 저장 자리와 마리나라 파일만 불러요; 폰 1 파일은 이 파일을 안 불러요', async () => {
    const { readFile, readdir } = await import('node:fs/promises'), SRC = new URL('../src/', import.meta.url);
    const src = await readFile(new URL('phone2sched.js', SRC), 'utf8');
    for (const f of [...src.matchAll(/from '([^']+)'/g)].map(x => x[1])) assert.match(f, /^\.\/(phone2store\.js|marinara\/[a-z.-]+\.js)$/, f);
    assert.doesNotMatch(src, /saveMeta|ctx\(|askDraft|boundary/);
    for (const f of (await readdir(SRC)).filter(f => f.endsWith('.js') && !/^phone2/.test(f) && f !== 'phone.js')) assert.doesNotMatch(await readFile(new URL(f, SRC), 'utf8'), /phone2sched/, f);
});
