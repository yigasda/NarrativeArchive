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
test('상황 글: 마리나라의 줄 그대로 답장 요청의 CONTEXT에 항상 들어가요', () => {
    const { m, a } = world();
    // 스케줄이 없어도 마리나라처럼 항상 들어가요: "online"
    assert.match(S.contextBlock(m, 'Mara', a.id, { now: NOW, tzOf: () => 'UTC' }), /^Your current status: online\.\nRen's status: online\.\nThe current time and date: 03:00, /);
    assert.equal(S.contextBlock(m, 'Nobody', a.id, { now: NOW }), '');
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
test('늦은 답 정하기(마리나라의 계산): 바쁘면 그만큼 뒤. 오프라인이면 답하지 않고 방에 적어 둬요', () => {
    const { m, w, a } = world(), t = NOW.getTime();
    let j = L.enqueueJob(m, { kind: 'reply', owner: 'Mara', room: a.id, at: t });
    assert.equal(G.holdReplies(m, t), 0);                       // 스케줄이 없으면 바로
    assert.equal(j.notBefore, undefined);
    delete j.timed;
    S.setSchedule(m, 'Mara', { ...all('dnd', 'working'), dndResponseDelayMinutes: 7 }, NOW);
    assert.equal(G.holdReplies(m, t), 1);
    assert.equal(j.notBefore, t + 7 * 60_000);
    assert.deepEqual(G.liveReplyWait(m, t), [{ owner: 'Mara', room: a.id, until: t + 7 * 60_000, away: false }]);
    assert.equal(G.holdReplies(m, t + 60_000), 0);              // (한 번 정한 때는 그대로)
    assert.equal(j.notBefore, t + 7 * 60_000);
    // 오프라인: 그 답장은 없어지고(마리나라는 답하지 않아요), 방에 누가 자리에 없었는지 남아요
    w.queue.jobs = [];
    j = L.enqueueJob(m, { kind: 'reply', owner: 'Mara', room: a.id, at: t });
    S.setSchedule(m, 'Mara', all('offline', 'sleeping'), NOW);
    assert.equal(G.holdReplies(m, t), 0);
    assert.equal(w.queue.jobs.length, 0);
    assert.deepEqual(G.liveAway(m, a.id), [{ owner: 'Mara', at: t }]);
    assert.deepEqual(G.liveReplyWait(m, t), []);
});
test('@으로 부르면(마리나라의 mention): 부른 사람만 답하고, 바빠도 빨리 와요. 상황 글에 그 줄이 들어가요', async () => {
    const SV = await at('marinara/schedule.service.js');
    const { m, w } = world(), g = L.ensureRoom(m, ['Mara', 'Ivo']), t = NOW.getTime();
    S.setSchedule(m, 'Mara', { ...all('dnd', 'working'), dndResponseDelayMinutes: 30 }, NOW);
    S.setSchedule(m, 'Ivo', all('online', 'free'), NOW);
    g.messages.push({ id: 'u1', n: 1, from: 'Ren', text: 'hey @mara are you there', at: t });
    assert.deepEqual(S.mentionsIn(m, g.id), ['Mara']);
    const jm = L.enqueueJob(m, { kind: 'reply', owner: 'Mara', room: g.id, at: t });
    L.enqueueJob(m, { kind: 'reply', owner: 'Ivo', room: g.id, at: t });
    G.holdReplies(m, t);
    assert.deepEqual(w.queue.jobs.map(j => j.owner), ['Mara']);
    // (마리나라의 부름 늦음에는 운이 섞여 있어요: 손으로 정한 30분보다 훨씬 짧기만 하면 돼요)
    assert.ok(jm.notBefore > t && jm.notBefore - t < 10 * 60_000 && SV.getMentionDelay('dnd') < 10 * 60_000);
    assert.match(S.contextBlock(m, 'Mara', g.id, { now: NOW, mentions: S.mentionsIn(m, g.id) }), /Ren @mentioned: Mara — this is an urgent ping/);
    // 안 불렀으면 모두 답해요
    g.messages.push({ id: 'u2', n: 2, from: 'Ren', text: 'never mind', at: t + 1 });
    assert.deepEqual(S.mentionsIn(m, g.id), []);
});
test('먼저 거는 말의 늦음은 마리나라의 getBusyDelay, 오프라인이면 안 걸어요. 손으로 다시 받은 답은 기다리지 않아요', async () => {
    const SV = await at('marinara/schedule.service.js');
    const { m, w, a } = world(), t = NOW.getTime(), sched = { ...all('dnd', 'working'), dndResponseDelayMinutes: 7 };
    S.setSchedule(m, 'Mara', sched, NOW);
    const j = L.enqueueJob(m, { kind: 'reply', owner: 'Mara', room: a.id, at: t, why: 'x' });
    j.auto = true;
    G.holdReplies(m, t);
    assert.equal(j.notBefore - t, 7 * 60_000);          // (getBusyDelay: 손으로 정한 바쁨 늦음 7분)
    assert.equal(SV.getBusyDelay('dnd', S.scheduleOf(m, 'Mara')), 7 * 60_000);
    w.queue.jobs = [];
    const k = L.enqueueJob(m, { kind: 'reply', owner: 'Mara', room: a.id, at: t, why: 'x' });
    k.auto = true;
    S.setSchedule(m, 'Mara', all('offline', 'sleeping'), NOW);
    G.holdReplies(m, t);
    assert.equal(w.queue.jobs.length, 0);
    assert.deepEqual(G.liveAway(m, a.id), []);                   // (먼저 거는 말은 "자리에 없었음"으로 안 남겨요)
    // 손으로 다시 받기(스와이프)로 줄 세운 답: 이미 때가 정해진 것으로 봐요
    const r = L.enqueueJob(m, { kind: 'reply', owner: 'Mara', room: a.id, at: t });
    r.timed = true;
    G.holdReplies(m, t);
    assert.deepEqual([w.queue.jobs.length, r.notBefore], [1, undefined]);
});
test('이 파일은 폰 2 저장 자리와 마리나라 파일만 불러요; 폰 1 파일은 이 파일을 안 불러요', async () => {
    const { readFile, readdir } = await import('node:fs/promises'), SRC = new URL('../src/', import.meta.url);
    const src = await readFile(new URL('phone2sched.js', SRC), 'utf8');
    for (const f of [...src.matchAll(/from '([^']+)'/g)].map(x => x[1])) assert.match(f, /^\.\/(phone2store\.js|marinara\/[a-z.-]+\.js)$/, f);
    assert.doesNotMatch(src, /saveMeta|ctx\(|askDraft|boundary/);
    for (const f of (await readdir(SRC)).filter(f => f.endsWith('.js') && !/^phone2/.test(f) && f !== 'phone.js')) assert.doesNotMatch(await readFile(new URL(f, SRC), 'utf8'), /phone2sched/, f);
});
test('장소: 블록마다 따로 두고(place), 하는 일 글은 그대로예요. 하는 일이 같으면 같은 장소', async () => {
    const { m } = world(), asked = [];
    S.setSchedule(m, 'Mara', week([{ time: '00:00-08:00', activity: 'sleeping', status: 'offline' }, { time: '08:00-18:00', activity: 'Working', status: 'dnd' }, { time: '18:00-00:00', activity: 'free time', status: 'online' }]), NOW);
    const ask = async messages => { asked.push(messages); return JSON.stringify({ places: { sleeping: 'home', working: "St. Mary's Hospital", 'free time': '' } }); };
    assert.equal(await S.fillPlaces(m, 'Mara', { ask, card: 'a nurse', places: ['home', 'home'] }), 14);
    assert.match(asked[0][0].content, /^GOAL\nMara has a weekly schedule\./);
    assert.equal(asked[0][1].content, "[ACTIVITIES]\n- sleeping\n- Working\n- free time\n\n[Mara's card]\na nurse\n\n[PLACES]\n- home");
    const mon = S.scheduleOf(m, 'Mara').days.Monday;
    assert.deepEqual(mon.map(b => [b.activity, b.place]), [['sleeping', 'home'], ['Working', "St. Mary's Hospital"], ['free time', undefined]]);
    await assert.rejects(S.fillPlaces(m, 'Mara', { ask: async () => '{"nope":1}' }), /장소 답/);
    await assert.rejects(S.fillPlaces(m, 'Ivo', { ask }), /먼저 스케줄/);
    // 마리나라의 상황 글에는 장소가 안 섞여요
    assert.doesNotMatch(S.contextBlock(m, 'Mara', L.ensureRoom(m, ['Mara']).id, { now: NOW }), /Hospital/);
});
test('지금 블록: 열쇠는 블록이 바뀌면 달라지고, 글은 "장소 · 하는 일 · ~끝"이에요. 손으로 준 상태가 있으면 없어요', () => {
    const { m } = world();
    S.setSchedule(m, 'Mara', week([{ time: '00:00-08:00', activity: 'sleeping', status: 'offline', place: 'home' }, { time: '08:00-00:00', activity: 'working', status: 'dnd' }]), NOW);
    const a = S.blockNow(m, 'Mara', { now: new Date('2026-11-23T03:00:00Z'), tz: 'UTC' }), b = S.blockNow(m, 'Mara', { now: new Date('2026-11-23T09:00:00Z'), tz: 'UTC' });
    assert.equal(a.text, 'home · sleeping · ~08:00');
    assert.equal(b.text, 'working · ~00:00');
    assert.notEqual(a.key, b.key);
    assert.equal(S.blockNow(m, 'Mara', { now: new Date('2026-11-23T04:00:00Z'), tz: 'UTC' }).key, a.key);
    assert.notEqual(S.blockNow(m, 'Mara', { now: new Date('2026-11-24T03:00:00Z'), tz: 'UTC' }).key, a.key);   // (다음 날의 같은 시간)
    S.setStatusOverride(m, 'Mara', { status: 'dnd', minutes: 60 }, new Date('2026-11-23T03:00:00Z'));
    assert.equal(S.blockNow(m, 'Mara', { now: new Date('2026-11-23T03:10:00Z'), tz: 'UTC' }), null);
    assert.equal(S.blockNow(m, 'Ivo', { now: NOW }), null);
});
test('스케줄 블록이 바뀌면 폰이 따라가요: 상태와 위치 정보의 주인 줄 (모델을 안 불러요)', () => {
    const { m, w } = world(), p = w.phones.mara, t1 = Date.parse('2026-11-23T03:00:00Z'), t2 = Date.parse('2026-11-23T09:00:00Z');
    p.where = { at: 1, people: [{ name: 'Mara', place: 'somewhere old', city: 'Seoul' }, { name: 'Ren', place: 'Gangseo' }] };
    S.setSchedule(m, 'Mara', week([{ time: '00:00-08:00', activity: 'sleeping', status: 'offline', place: 'home' }, { time: '08:00-18:00', activity: 'working', status: 'dnd', place: 'the hospital' }, { time: '18:00-00:00', activity: 'walk', status: 'online' }]), NOW);
    assert.equal(G.followSchedule(m, t1), 1);
    assert.deepEqual(p.schedState, { text: 'home · sleeping · ~08:00', at: t1 });
    assert.deepEqual(p.where.people, [{ name: 'Mara', place: 'home', city: 'Seoul' }, { name: 'Ren', place: 'Gangseo' }]);
    assert.equal(G.followSchedule(m, t1 + 60_000), 0);                       // 같은 블록이면 그대로
    assert.equal(G.followSchedule(m, t2), 1);
    assert.equal(p.where.people[0].place, 'the hospital');
    // 장소가 없는 블록: 상태만 바뀌고 장소는 그대로
    assert.equal(G.followSchedule(m, Date.parse('2026-11-23T19:00:00Z')), 1);
    assert.equal(p.schedState.text, 'walk · ~00:00');
    assert.equal(p.where.people[0].place, 'the hospital');
    // 위치 정보에 주인 줄이 없던 폰: 줄이 생겨요. 스케줄이 없는 폰은 안 건드려요
    delete p.where; delete p.schedAt;
    G.followSchedule(m, t1);
    assert.deepEqual(p.where.people, [{ name: 'Mara', place: 'home' }]);
    assert.equal(w.phones.ivo.schedState, undefined);
});
test('답장 요청의 NOW: 스케줄이 적은 상태가 마지막 답장의 상태보다 새것이면 그것을 써요', async () => {
    const { gatherReply } = await at('phone2live.js');
    const { m, w, a } = world(), p = w.phones.mara;
    a.messages.push({ id: 'x1', n: 1, from: 'Ren', text: 'hi', at: 1000 }, { id: 'x2', n: 2, from: 'Mara', text: 'hey', at: 2000, state: 'cafe · reading' });
    assert.equal(gatherReply(m, 'Mara', a.id, { now: 9000 }).now.last, 'cafe · reading');
    p.schedState = { text: 'the hospital · working · ~18:00', at: 3000 };
    assert.equal(gatherReply(m, 'Mara', a.id, { now: 9000 }).now.last, 'the hospital · working · ~18:00');
    a.messages.push({ id: 'x3', n: 3, from: 'Mara', text: 'on break', at: 4000, state: 'the hospital · break room' });
    assert.equal(gatherReply(m, 'Mara', a.id, { now: 9000 }).now.last, 'the hospital · break room');
});
test('스케줄이 있는 사람의 답장 지시문: state를 안 묻고, 마리나라의 상태 명령을 JSON 칸으로 물어요', async () => {
    const RP = await at('phone2reply.js'), CMD = await at('marinara/schedule-command.js');
    const plain = RP.phone2ReplySystem({ owner: 'Mara', persona: 'Ren' }), s = RP.phone2ReplySystem({ owner: 'Mara', persona: 'Ren', scheduled: true });
    assert.match(plain, /\nSTATE FIRST\n"state": /);
    assert.match(plain, /\n\{ "state": "HH:MM · place · doing · ~until",\n/);
    assert.doesNotMatch(plain, /"status":/);
    assert.doesNotMatch(s, /STATE FIRST|"state"/);
    const said = CMD.SCHEDULE_UPDATE_PROMPT_LINE.split('] - ')[1];
    assert.equal(said, "only if you change your own status/activity, for example, if the user asks you to stop what you're doing or if you decide to change them yourself.");
    assert.ok(s.includes(`\nSTATUS\n- "status": ${said} With "place": where that puts you. Else "".\n\nTEXTING\n`));
    assert.ok(s.includes('\n{ "status": "" or { "status": "online|idle|dnd|offline", "activity": "activity name", "duration": "number of hours (e.g., 1h)", "place": "where" },\n  "reply": '));
});
test('캐릭터가 스스로 상태를 바꾸면: 임시 상태가 되고(시간이 지나면 스케줄로), 장소도 따라가요. 손으로 준 상태는 못 바꿔요', () => {
    const { m, w } = world(), p = w.phones.mara, t = Date.parse('2026-11-23T03:00:00Z'), now = new Date(t);
    p.where = { at: 1, people: [{ name: 'Mara', place: 'home' }] };
    S.setSchedule(m, 'Mara', all('online', 'free time'), NOW);
    const o = S.takeStatus(m, 'Mara', { activity: 'driving over', duration: '2h', place: "Ren's street" }, { now });
    assert.deepEqual(o, { status: 'online', activity: 'driving over', createdAt: now.toISOString(), expiresAt: new Date(t + 120 * 60_000).toISOString(), place: "Ren's street" });
    assert.deepEqual(S.stateNow(m, 'Mara', { now }), { key: `o ${now.toISOString()}`, text: "Ren's street · driving over", place: "Ren's street" });
    assert.equal(G.followSchedule(m, t), 1);
    assert.equal(p.where.people[0].place, "Ren's street");
    assert.equal(p.schedState.text, "Ren's street · driving over");
    // 시간이 지나면 스케줄로 돌아가요
    assert.equal(S.stateNow(m, 'Mara', { now: new Date(t + 121 * 60_000), tz: 'UTC' }).text, 'free time · ~00:00');
    // 시간을 안 주면 한 시간, 못 읽는 상태 낱말은 지금 상태로
    const d = S.takeStatus(m, 'Mara', { status: 'asleep', activity: 'nap' }, { now });
    assert.equal(d.status, 'online');
    assert.equal(Date.parse(d.expiresAt) - t, 60 * 60_000);
    assert.equal(S.takeStatus(m, 'Mara', {}, { now }), null);
    assert.equal(S.takeStatus(m, 'Mara', '', { now }), null);
    // 내가 손으로 준 상태(끝 시간 없음)가 있으면 캐릭터가 못 바꿔요
    S.setStatusOverride(m, 'Mara', { status: 'dnd', activity: 'do not disturb her' }, now);
    assert.equal(S.takeStatus(m, 'Mara', { status: 'online', activity: 'x' }, { now }), null);
    assert.equal(S.statusNow(m, 'Mara', { now }).status, 'dnd');
});
test('답 넣기: 스케줄의 상태를 받으면 그걸 말에 적고, 답의 state는 안 읽어요. 말 없는 답은 메시지를 안 남겨요', async () => {
    const RUN = await at('phone2run.js');
    const { m, a } = world();
    a.messages.push({ id: 'x1', n: 1, from: 'Ren', text: 'hi', at: 1000 });
    const got = RUN.takeReply(m, 'Mara', a.id, { state: '09:00 · model wrote this', reply: ['hey'], status: { activity: 'on my way', place: 'bus' } }, { now: 5000, state: 'the hospital · working · ~18:00' });
    assert.equal(a.messages.at(-1).state, 'the hospital · working · ~18:00');
    assert.deepEqual(got.status, { activity: 'on my way', place: 'bus' });
    const n = a.messages.length;
    assert.equal(RUN.takeReply(m, 'Mara', a.id, { reply: [], status: '' }, { now: 6000, state: 'the hospital · working · ~18:00' }).status, undefined);
    assert.equal(a.messages.length, n);
    // 스케줄이 없는 사람은 지금 그대로: 답의 state를 읽어요
    const b = RUN.takeReply(m, 'Mara', a.id, { state: '09:00 · cafe · reading', reply: ['again'] }, { now: 7000 });
    assert.match(a.messages.at(-1).state, /cafe · reading/);
    assert.equal(b.status, undefined);
});
const weekAnswer = day => JSON.stringify({ talkativeness: 30, inactivityThresholdMinutes: 90, days: Object.fromEntries(DAYS.map(d => [d, day])) });
const DAY = [{ time: '00:00-07:00', activity: 'sleeping', status: 'offline' }, { time: '07:00-00:00', activity: 'reading', status: 'online' }];
test('초안 만들기(마리나라의 /schedule/draft): 저장하지 않고 결과만. 주 · 하루, 초안을 이어받고 손으로 정한 값은 남아요', async () => {
    const { m } = world(), asked = [], card = { name: 'Mara', description: 'a nurse', personality: '' };
    const ask = async messages => { asked.push(messages[0].content); return weekAnswer(DAY); };
    const got = await S.draftSchedule(m, { ask, charData: card, mode: 'week', guidance: 'nights', draftMode: 'rewrite', timeZone: 'Asia/Seoul' });
    assert.equal(S.scheduleOf(m, 'Mara'), null);                               // 저장 안 함
    assert.equal(got.schedule.days.Monday.length, 2);
    assert.ok(got.schedule.weekStart);
    assert.match(asked[0], /Schedule timezone: Asia\/Seoul/);
    // 초안을 주면: "Current draft schedule"로 이어받고, 손으로 정한 값은 초안의 것
    const draft = { ...got.schedule, talkativeness: 77, dndResponseDelayMinutes: 9, routineSummary: 'old' };
    const again = await S.draftSchedule(m, { ask, charData: card, mode: 'week', schedule: draft, draftMode: 'adjust' });
    assert.match(asked[1], /Draft action: Adjust current week\./);
    assert.match(asked[1], /Current draft schedule:\n- Monday: 00:00-07:00 sleeping \(offline\); 07:00-00:00 reading \(online\)/);
    assert.deepEqual([again.schedule.talkativeness, again.schedule.dndResponseDelayMinutes, again.schedule.routineSummary], [77, 9, null]);
    // 하루만
    const one = await S.draftSchedule(m, { ask: async () => JSON.stringify({ blocks: [{ time: '00:00-00:00', activity: 'day off', status: 'online' }] }), charData: card, mode: 'day', day: 'Sunday', schedule: draft });
    assert.deepEqual([one.day, one.blocks[0].activity], ['Sunday', 'day off']);
    await assert.rejects(S.draftSchedule(m, { ask, charData: card, mode: 'day', day: 'Funday', schedule: draft }), /Invalid schedule day/);
    // 실패: 오류에 모델의 답 원문이 실려요. 멈추라고 했으면 답을 버려요
    const bad = await S.draftSchedule(m, { ask: async () => 'not json at all', charData: card, mode: 'week' }).catch(e => e);
    assert.equal(bad.rawResponse, 'not json at all');
    const stop = new AbortController(); stop.abort();
    await assert.rejects(S.draftSchedule(m, { ask, charData: card, mode: 'week', signal: stop.signal }));
});
test('루틴 요약(마리나라의 /schedule/summary)과 고친 답 넣기(편집 창의 applyRepairedOutput)', async () => {
    const { m } = world(), sched = { ...week(DAY), weekStart: 'W' };
    const got = await S.summarizeSchedule(m, { ask: async messages => { assert.match(messages[0].content, /^You summarize a fictional character's weekly autonomous conversation routine\./); return ' Sleeps till seven, reads all day. '; }, charData: { name: 'Mara' }, schedule: sched });
    assert.equal(got.summary, 'Sleeps till seven, reads all day.');
    assert.ok(got.generatedAt);
    const fixed = S.repairSchedule(JSON.stringify({ blocks: [{ time: '00:00-00:00', activity: 'off', status: 'online', place: ' home ' }] }), sched, 'Monday');
    assert.deepEqual(fixed.days.Monday, [{ time: '00:00-00:00', activity: 'off', status: 'online', place: 'home' }]);
    assert.equal(fixed.days.Tuesday.length, 2);
    assert.equal(S.repairSchedule(JSON.stringify({ days: { Tuesday: [{ time: '00:00-00:00', activity: 'x', status: 'dnd' }] } }), sched).days.Tuesday[0].status, 'dnd');
    assert.throws(() => S.repairSchedule('{"days": []}', sched));
    assert.throws(() => S.repairSchedule(JSON.stringify({ blocks: [{ time: '00:00-00:00', activity: 'x', status: 'asleep' }] }), sched, 'Monday'));
    assert.throws(() => S.repairSchedule('nope', sched));
});
test('시간대는 마리나라처럼 스케줄 전체에 하나: 안 정하면 비어 있고, 틀린 것은 안 받아요. 끝 24:00은 00:00으로 둬요', () => {
    const { m } = world();
    assert.equal(S.scheduleZone(m), '');
    assert.equal(S.setScheduleZone(m, 'Europe/Berlin'), 'Europe/Berlin');
    assert.equal(S.scheduleZone(m), 'Europe/Berlin');
    assert.throws(() => S.setScheduleZone(m, 'Mars/Olympus'), /시간대/);
    assert.equal(S.setScheduleZone(m, ''), '');
    assert.equal(S.scheduleZone(m), '');
    S.setSchedule(m, 'Mara', week([{ time: '00:00-22:00', activity: 'day', status: 'online' }, { time: '22:00-24:00', activity: 'late', status: 'idle' }]), NOW);
    assert.equal(S.scheduleOf(m, 'Mara').days.Monday[1].time, '22:00-00:00');
    assert.equal(S.statusNow(m, 'Mara', { now: new Date('2026-11-23T23:00:00Z'), tz: 'UTC' }).activity, 'late');
});
test('매주 갱신(마리나라의 /schedule/generate): 켠 사람만, 주가 바뀌었을 때만. 지난 스케줄을 이어받고 손으로 정한 값은 남아요', async () => {
    const { m } = world(), asked = [], ask = async messages => { asked.push(messages[0].content); return weekAnswer(DAY); };
    const old = new Date('2026-11-16T03:00:00Z'), cards = { mara: { name: 'Mara', description: 'a nurse' }, ivo: { name: 'Ivo', description: 'a cook' } };
    S.setSchedule(m, 'Mara', { ...all('dnd', 'working'), dndResponseDelayMinutes: 4 }, old);
    S.setSchedule(m, 'Ivo', all('online', 'cooking'), old);
    assert.equal(S.needsRefresh(m, 'Mara', { now: NOW }), true);
    assert.equal(S.needsRefresh(m, 'Mara', { now: old }), false);
    let out = await S.renewSchedules(m, { ask, owners: ['Mara', 'Ivo'], cards, automatic: true, now: NOW });
    assert.deepEqual([out.results.mara.status, out.results.ivo.status, asked.length], ['renewal_disabled', 'renewal_disabled', 0]);
    S.setAutoRenew(m, 'Mara', true);
    assert.equal(S.autoRenewOf(m, 'Mara'), true);
    out = await S.renewSchedules(m, { ask, owners: ['Mara', 'Ivo'], cards, automatic: true, now: NOW });
    assert.deepEqual([out.results.mara.status, out.results.ivo.status, asked.length], ['generated', 'renewal_disabled', 1]);
    assert.match(asked[0], /<previous_schedule weekStart="[^"]+">\n- Monday: 00:00-00:00 working \(dnd\)/);
    const now = S.scheduleOf(m, 'Mara');
    assert.deepEqual([now.days.Monday[1].activity, now.dndResponseDelayMinutes, S.needsRefresh(m, 'Mara', { now: NOW })], ['reading', 4, false]);
    assert.equal(S.scheduleOf(m, 'Ivo').days.Monday[0].activity, 'cooking');
    // 이번 주 것이면 다시 안 만들어요; forceRefresh면 켜지 않은 사람도 만들어요
    out = await S.renewSchedules(m, { ask, owners: ['Mara'], cards, automatic: true, now: NOW });
    assert.deepEqual([out.results.mara.status, asked.length], ['fresh', 1]);
    out = await S.renewSchedules(m, { ask, owners: ['Ivo'], cards, forceRefresh: true, now: NOW });
    assert.equal(out.results.ivo.status, 'generated');
    S.setAutoRenew(m, 'Mara', false);
    assert.equal(S.autoRenewOf(m, 'Mara'), false);
});
test('지금 답장: 기다리던 늦은 답을 바로 돌릴 수 있게 풀어요', async () => {
    const { m, a } = world(), t = Date.now();
    globalThis.__dropTest.metadata = { narrative_archive: m };
    const j = L.enqueueJob(m, { kind: 'reply', owner: 'Mara', room: a.id, at: t });
    S.setSchedule(m, 'Mara', { ...all('dnd', 'working'), dndResponseDelayMinutes: 30 }, new Date(t));
    G.holdReplies(m, t);
    assert.equal(L.nextJob(m, t), null);
    assert.equal(await G.liveReplyNow(m, a.id, 'Ivo'), 0);
    assert.equal(await G.liveReplyNow(m, a.id, 'Mara'), 1);
    assert.equal(G.holdReplies(m, t), 0);                 // (다시 붙잡지 않아요)
    assert.equal(L.nextJob(m, t).id, j.id);
});
test('생성 연결(마리나라의 connectionId): 초안 모델 · AI 기능 모델 · 실리 연결 프로필 가운데 고르고, 고른 것이 남아요', async () => {
    const { m } = world(), T = globalThis.__dropTest;
    T.metadata = { narrative_archive: m };
    T.profiles = [{ id: 'p1', name: 'Gemini Pro' }];
    assert.deepEqual(G.liveConnections(), [{ id: '', name: '초안 모델' }, { id: 'ai', name: 'AI 기능 모델' }, { id: 'profile:p1', name: 'Gemini Pro' }]);
    assert.equal(G.liveScheduleConnection(m), '');
    assert.equal(await G.liveSetScheduleConnection(m, 'profile:p1'), 'profile:p1');
    assert.equal(G.liveScheduleConnection(m), 'profile:p1');
    assert.equal(S.presenceOf(m).meta.scheduleConnectionId, 'profile:p1');
    await assert.rejects(G.liveSetScheduleConnection(m, 'profile:gone'), /없는 연결/);
    // 프로필이 없어지면 기본으로 돌아가요
    T.profiles = [];
    assert.equal(G.liveScheduleConnection(m), '');
    await G.liveSetScheduleConnection(m, '');
    assert.equal('scheduleConnectionId' in S.presenceOf(m).meta, false);
});
test('먼저 말 걸기의 방 전체 설정: 마리나라의 열쇠 그대로 (하루 상한 · 단체방 상한 같이 쓰기 · 캐릭터끼리 주고받기)', async () => {
    const { m } = world(), A = await at('marinara/autonomous.service.js');
    assert.deepEqual(S.autonomousOptions(m), { on: false, schedulesEnabled: false, autonomousDailyCapOverride: null, groupChatMode: null, characterExchanges: false });
    S.setAutonomous(m, true);
    assert.deepEqual(S.setAutonomousOptions(m, { autonomousDailyCapOverride: 3.9, groupChatMode: 'individual', characterExchanges: true }), { on: true, schedulesEnabled: false, autonomousDailyCapOverride: 3, groupChatMode: 'individual', characterExchanges: true });
    const meta = S.presenceOf(m).meta;
    assert.equal(A.dailyCapForCharacter({ talkativeness: 90 }, meta), 3);            // (마리나라가 그 열쇠를 읽어요)
    assert.equal(A.sharesAutonomousDailyBudget(meta), true);
    assert.throws(() => S.setAutonomousOptions(m, { autonomousDailyCapOverride: 0 }), /1 이상/);
    assert.deepEqual(S.setAutonomousOptions(m, { autonomousDailyCapOverride: null, groupChatMode: null, characterExchanges: false }), { on: true, schedulesEnabled: false, autonomousDailyCapOverride: null, groupChatMode: null, characterExchanges: false });
    assert.deepEqual(Object.keys(meta).filter(k => /Cap|groupChat|Exchanges/.test(k)), []);
});
test('캐릭터끼리 주고받기(마리나라의 /autonomous/exchange): 켜야 하고, 단체방에서만. 하루 상한을 넘으면 안 해요', () => {
    const { m, a } = world(), g = L.ensureRoom(m, ['Mara', 'Ivo']), t = Date.now(), now = new Date(t);
    for (const r of [a, g]) r.messages.push({ id: `u${r.id}`, n: 1, from: 'Ren', text: 'hi', at: t - 120_000 }, { id: `c${r.id}`, n: 2, from: 'Mara', text: 'hey', at: t - 1000 });
    S.setSchedule(m, 'Mara', { ...all('online', 'free'), talkativeness: 100 }, now);
    S.setSchedule(m, 'Ivo', { ...all('online', 'free'), talkativeness: 100 }, now);
    assert.equal(S.checkExchangeFor(m, g.id, 'Mara', { now }).reason, 'exchanges_disabled');
    S.setAutonomousOptions(m, { characterExchanges: true });
    assert.equal(S.checkExchangeFor(m, a.id, 'Mara', { now }).reason, 'not_group');
    // (마리나라의 판단에는 운이 섞여 있어요: 여러 번 물으면 걸려요. 걸리면 말한 사람이 아닌 쪽이에요)
    const orig = Math.random; Math.random = () => 0;
    try {
        const r = S.checkExchangeFor(m, g.id, 'Mara', { now });
        assert.deepEqual([r.shouldTrigger, r.characterIds], [true, ['ivo']]);
        S.setSchedule(m, 'Ivo', { ...all('online', 'free'), talkativeness: 100, autonomousDailyCapOverride: 1 }, now);
        S.noteProactive(m, g.id, 'ivo', '', now);
        assert.equal(S.checkExchangeFor(m, g.id, 'Mara', { now }).reason, 'daily_budget_exhausted');
        S.setSchedule(m, 'Ivo', all('offline', 'sleeping'), now);
        assert.equal(S.checkExchangeFor(m, g.id, 'Mara', { now }).shouldTrigger, false);
    } finally { Math.random = orig; }
});
test('스케줄 쓰기 끄기(마리나라의 conversationSchedulesEnabled): 스케줄은 남고, 상태 · 늦음 · 먼저 말 걸기가 안 읽어요', () => {
    const { m, a } = world();
    assert.equal(S.schedulesOn(m), false);                     // 스케줄이 하나도 없으면 꺼진 것
    S.setSchedule(m, 'Mara', all('dnd', 'working'), NOW);
    assert.equal(S.schedulesOn(m), true);                      // 정한 적 없으면 스케줄이 있을 때 켜진 것
    S.setSchedulesOn(m, false);
    assert.equal(S.scheduleOf(m, 'Mara').days.Monday[0].activity, 'working');
    assert.deepEqual([S.activeSchedule(m, 'Mara'), S.statusNow(m, 'Mara', { now: NOW }), S.replyDelay(m, 'Mara', { now: NOW }), S.blockNow(m, 'Mara', { now: NOW })], [null, null, 0, null]);
    assert.match(S.contextBlock(m, 'Mara', a.id, { now: NOW }), /^Your current status: online\.\n/);   // (스케줄이 꺼져 있으면 "online")
    assert.equal(S.autonomousOptions(m).schedulesEnabled, false);
    S.setSchedulesOn(m, true);
    assert.equal(S.statusNow(m, 'Mara', { now: NOW }).status, 'dnd');
});
test('스케줄 내보내기 · 가져오기(마리나라의 파일 모양 그대로)', () => {
    const { m } = world();
    S.setSchedule(m, 'Mara', all('online', 'free'), NOW);
    const out = S.exportSchedule(m, 'Mara');
    assert.deepEqual([out.kind, out.version, out.characterName], ['marinara.character-schedule', 1, 'Mara']);
    const back = S.importSchedule(JSON.parse(JSON.stringify(out)));
    assert.equal(back.ok, true);
    assert.equal(back.schedule.days.Monday[0].activity, 'free');
    assert.deepEqual(S.importSchedule({ kind: 'marinara.character-schedule', version: 9, schedule: {} }), { ok: false, reason: 'unsupported-version' });
    assert.throws(() => S.exportSchedule(m, 'Ivo'), /스케줄이 없어요/);
});
test('따라 묻기는 마리나라처럼 점점 뜸해지고 세 번에서 멈춰요 (판단할 때마다 기억을 지우지 않아요)', () => {
    const { m, a } = world(), t = Date.now();
    a.messages.push({ id: 'x1', n: 1, from: 'Ren', text: 'hi', at: t - 20 * 60_000 }, { id: 'x2', n: 2, from: 'Mara', text: 'hey', at: t - 19 * 60_000 });
    S.setSchedule(m, 'Mara', { ...all('online', 'free'), inactivityThresholdMinutes: 15, talkativeness: 80 }, new Date(t));
    S.setAutonomous(m, true);
    const ask = () => S.checkProactive(m, a.id, { now: new Date() });
    const fire = r => { S.noteAssistant(m, a.id, 'Mara'); S.noteProactive(m, a.id, 'mara', r.autonomousIntentKey); };
    let r = ask();
    assert.equal(r.shouldTrigger, true);                        // 15분 넘게 조용함: 첫 번째
    fire(r);
    assert.equal(ask().shouldTrigger, false);                   // 방금 걸었어요: 다음은 30분 뒤 (두 배)
    // 내가 다시 말하면 수가 처음으로 돌아가요
    a.messages.push({ id: 'x3', n: 3, from: 'Ren', text: 'back', at: Date.now() - 1 });
    assert.equal(S.syncUser(m, a.id), true);
    assert.equal(S.syncUser(m, a.id), false);
    // (답이 없는 내 말이 마지막이면 마리나라는 바로 따라잡아요: 여기서는 캐릭터가 답한 것으로 해요)
    a.messages.push({ id: 'x4', n: 4, from: 'Mara', text: 'welcome back', at: Date.now() });
    S.noteAssistant(m, a.id);
    assert.equal(ask().shouldTrigger, false);                   // 방금 말했으니 아직 조용하지 않아요
    // 방의 말을 손으로 바꾸면 기억을 지우고 방에서 다시 읽어요
    S.forgetActivity(m, a.id);
    a.messages.length = 2;
    assert.equal(ask().shouldTrigger, true);
});
test('이모지만 달면 첫 번째 먼저 걸기가 빨라져요 (마리나라의 reaction gate)', () => {
    const { m, a } = world(), t = Date.now();
    a.messages.push({ id: 'x1', n: 1, from: 'Ren', text: 'hi', at: t - 6 * 60_000 }, { id: 'x2', n: 2, from: 'Mara', text: 'hey', at: t - 5.9 * 60_000 });
    S.setSchedule(m, 'Mara', { ...all('online', 'free'), inactivityThresholdMinutes: 15, talkativeness: 80 }, new Date(t));
    S.setAutonomous(m, true);
    assert.equal(S.checkProactive(m, a.id, { now: new Date() }).shouldTrigger, false);     // 6분: 15분이 안 됐어요
    S.noteReaction(m, a.id);
    assert.equal(S.checkProactive(m, a.id, { now: new Date() }).shouldTrigger, false);     // 반응한 지 얼마 안 됐어요
    const real = Date.now; Date.now = () => real() + 6 * 60_000;                           // (반응하고 6분 뒤: 15분의 34%가 지났어요)
    try {
        const r = S.checkProactive(m, a.id, { now: new Date() });
        assert.deepEqual([r.shouldTrigger, r.reason], [true, 'user_reaction']);
    } finally { Date.now = real; }
});
test('저절로 자리 비움(마리나라의 idle detection): 손으로 고른 게 active일 때만, 10분 가만히 있으면 idle · 움직이거나 말하면 active', async () => {
    const ID = await at('marinara/idle-detection.js');
    const { m, a } = world(), handlers = {}, timers = [];
    const win = { addEventListener: (e, f) => { handlers[e] = f; }, removeEventListener: e => { delete handlers[e]; } }, doc = { hidden: false, addEventListener() {}, removeEventListener() {} };
    const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
    globalThis.setTimeout = (f, ms) => { timers.push({ f, ms }); return timers.length; }; globalThis.clearTimeout = () => {};
    try {
        const stop = ID.startIdleDetection(S.userStore(m), win, doc);
        assert.equal(timers.at(-1).ms, 10 * 60 * 1000);
        timers.at(-1).f();                                              // 10분이 지났어요
        assert.deepEqual([S.presenceOf(m).user.status, S.presenceOf(m).user.manual], ['idle', 'active']);
        assert.match(S.contextBlock(m, 'Mara', a.id, { now: NOW }), /Ren's status: idle \/ away from the computer\./);
        handlers.keydown();                                             // 움직였어요
        assert.equal(S.presenceOf(m).user.status, 'active');
        // 손으로 방해 금지를 골랐으면 건드리지 않아요
        S.setUserStatus(m, { status: 'dnd' });
        timers.at(-1).f(); handlers.keydown();
        assert.deepEqual([S.presenceOf(m).user.status, S.presenceOf(m).user.manual], ['dnd', 'dnd']);
        stop();
        assert.deepEqual(Object.keys(handlers), []);
    } finally { globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear; }
    // 자리 비움으로 보이는 동안 말을 보내면 active로 (마리나라의 restoreAvailableAfterUserMessage)
    S.setUserStatus(m, { status: 'active' });
    S.userStore(m).getState().setUserStatus('idle');
    const t = Date.now();
    a.messages.push({ id: 'x1', n: 1, from: 'Ren', text: 'hi', at: t - 60_000 }, { id: 'x2', n: 2, from: 'Mara', text: 'hey', at: t - 50_000 });
    S.setAutonomous(m, true);
    S.checkProactive(m, a.id, { now: new Date() });                     // (방의 말에서 처음 읽어요)
    S.userStore(m).getState().setUserStatus('idle');
    a.messages.push({ id: 'x3', n: 3, from: 'Ren', text: 'back', at: Date.now() - 1 });
    assert.equal(S.syncUser(m, a.id), true);
    assert.equal(S.presenceOf(m).user.status, 'active');
});
