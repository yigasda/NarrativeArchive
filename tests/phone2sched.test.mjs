// 스케줄 · 상태 · 먼저 말 걸기 · 늦은 답을 우리 방에 잇기 (src/phone2sched.js). 판단과 지시문은 마리나라의 것(src/marinara/)이에요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from './phone2reflect.load.mjs';

const at = f => import(new URL(`../src/${f}`, import.meta.url));
const L = await at('phone2store.js'), S = await at('phone2sched.js'), ASK = await at('phone2ask.js');
const DAYS = S.CONVERSATION_SCHEDULE_DAYS;
const week = blocks => ({ days: Object.fromEntries(DAYS.map(d => [d, blocks])), talkativeness: 80, inactivityThresholdMinutes: 15 });
const all = (status, activity = 'x') => week([{ time: '00:00-00:00', activity, status }]);
// (스케줄 · 상태 · 먼저 말 걸기의 동작을 보는 테스트: 새 방의 첫 값(설정 마법사의 Start, phone2sched.js NEW_ROOM_SETUP) 없이 정한 적이 없는 방으로.
//  새 방의 첫 값은 tests/phone2roommeta.test.mjs)
const plain = (m, names) => { const r = L.ensureRoom(m, names); delete r.meta; return r; };
function world() {
    const m = { phones: {} };
    L.startFresh(m, { persona: 'Ren', scope: 'test' });
    const w = L.liveWorld(m);
    w.phones = { mara: { owner: 'Mara' }, ivo: { owner: 'Ivo' } };
    const a = plain(m, ['Mara']);
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
    // 이 요청에서만 쓸 내 상태 (서버가 실리를 닫은 동안 만드는 답장)
    assert.match(S.contextBlock(m, 'Mara', a.id, { now: NOW, tzOf: () => 'UTC', user: { status: 'idle', activity: 'away or offline' } }), /\nRen's status: idle \/ away from the computer - away or offline\.\n/);
    assert.equal(S.intentWhy(m, 'after_busy'), 'You just wrapped up a busy stretch. You have some breathing room now.');
    assert.match(S.intentWhy(m, 'check_in'), /Ren has been quiet/);
    assert.equal(S.intentWhy(m, 'nope'), '');
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
    await assert.rejects(S.makeSchedule(m, 'Ivo', { ask, day: 'Monday' }), /먼저 주간 스케줄을 만드세요/);
});
test('먼저 말 걸기: 꺼져 있으면 안 하고, 켜면 마리나라의 판단대로. 줄 세우면 오늘 수와 쉬는 시간을 적어요', () => {
    // (마리나라의 판단은 진짜 지금 시각으로 재요)
    const { m, w, a } = world(), t = Date.now(), NOW = new Date(t);
    a.messages.push({ id: 'x1', n: 1, from: 'Ren', text: 'hi', at: t - 3 * 3600e3 }, { id: 'x2', n: 2, from: 'Mara', text: 'hey', at: t - 2.9 * 3600e3 });
    S.setSchedule(m, 'Mara', all('online', 'free'), NOW);
    assert.equal(S.checkProactive(m, a.id, { now: NOW }).reason, 'disabled');
    S.setAutonomous(m, a.id, true);
    S.setUserStatus(m, { status: 'dnd' });
    assert.equal(S.checkProactive(m, a.id, { now: NOW }).reason, 'user_dnd');
    S.setUserStatus(m, { status: 'idle' });
    const r = S.checkProactive(m, a.id, { now: NOW });
    assert.equal(r.shouldTrigger, true);
    assert.deepEqual(r.characterIds, ['mara']);
    assert.ok(r.autonomousIntentKey && r.autonomousIntent);
    S.noteProactive(m, a.id, 'mara', r.autonomousIntentKey, NOW);
    assert.equal(Object.values(a.meta.autonomousDailyBudget.counts)[0], 1);
    // 폰이 없는 사람만 있는 방은 안 해요
    const b = plain(m, ['Nobody']);
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
    const { m, w } = world(), g = plain(m, ['Mara', 'Ivo']), t = NOW.getTime();
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
    for (const f of [...src.matchAll(/from '([^']+)'/g)].map(x => x[1])) assert.match(f, /^\.\/(phone2store\.js|phone2room\.js|marinara\/[a-z.-]+\.js)$/, f);
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
    await assert.rejects(S.fillPlaces(m, 'Mara', { ask: async () => '{"nope":1}' }), /장소 응답을 읽을 수 없습니다/);
    await assert.rejects(S.fillPlaces(m, 'Ivo', { ask }), /먼저 스케줄/);
    // 마리나라의 상황 글에는 장소가 안 섞여요
    assert.doesNotMatch(S.contextBlock(m, 'Mara', plain(m, ['Mara']).id, { now: NOW }), /Hospital/);
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
    // (상태는 맨 끝 칸이고 기본이 "": 첫 칸에 채운 예시로 두면 모델이 답장마다 상태를 써서 스케줄이 가려져요)
    assert.ok(s.includes(`\nSTATUS\n- Your status and what you are doing come from your schedule in CONTEXT, by themselves. "status" stays "".\n- Write a new one ${said} Then "status": { "status": "online|idle|dnd|offline", "activity": "activity name", "duration": "number of hours (e.g., 1h)", "place": "where that puts you" }.\n\nTEXTING\n`));
    assert.ok(s.includes('\n{ "reply": the words you type now'));
    assert.ok(s.endsWith('}],\n  "status": "" }'));
    assert.equal(s.match(/"status"/g).length, 4);
    // (명령 스위치를 끄면 그 명령은 지시문에 아예 없어요: 스케줄 갱신 · 반응)
    const off = RP.phone2ReplySystem({ owner: 'Mara', persona: 'Ren', scheduled: true, statusCommand: false });
    assert.doesNotMatch(off, /STATUS|"status"|STATE FIRST|"state"/); assert.match(off, /\n\nTEXTING\n/); assert.ok(off.includes('\n{ "reply": the words you type now'));
    const quiet = RP.phone2ReplySystem({ owner: 'Mara', persona: 'Ren', react: false });
    assert.doesNotMatch(quiet, /"react"|An emoji on the last text/); assert.match(quiet, /\nSTATE FIRST\n/); assert.equal(plain.length - quiet.length > 100, true);
});
test('캐릭터가 하는 일을 바꾸면 스케줄 표의 지금 칸이 고쳐져요 (마리나라의 updateCurrentScheduleBlock 그대로): 시간을 주면 칸을 쪼개고, 표에 남아요', () => {
    const { m, w } = world(), p = w.phones.mara;
    // (2026-11-23은 월요일. 14:20 UTC)
    const t = Date.parse('2026-11-23T14:20:00Z'), now = new Date(t), opt = { now, tz: 'UTC' };
    const blocks = () => S.scheduleOf(m, 'Mara').days.Monday.map(b => [b.time, b.activity, b.status, b.place || '']);
    S.setSchedule(m, 'Mara', week([{ time: '09:00-13:00', activity: 'work', status: 'dnd' }, { time: '13:00-18:00', activity: 'desk work', status: 'dnd' }, { time: '18:00-23:00', activity: 'free time', status: 'online' }]), NOW);
    // (시간 없이: 지금 칸의 하는 일 · 상태만 바뀌어요)
    const a = S.takeStatus(m, 'Mara', { status: 'idle', activity: 'coffee break', place: 'the canteen' }, opt);
    assert.deepEqual(a, { block: true, status: 'idle', activity: 'coffee break', time: '13:00-18:00', place: 'the canteen' });
    assert.deepEqual(blocks()[1], ['13:00-18:00', 'coffee break', 'idle', 'the canteen']);
    assert.equal(S.statusNow(m, 'Mara', opt).override, undefined);                      // (임시 상태가 아니에요: 표가 바뀐 거예요)
    assert.deepEqual((({ status, activity }) => [status, activity])(S.statusNow(m, 'Mara', opt)), ['idle', 'coffee break']);
    // (시간을 주고 그게 칸이 끝나기 전이면: 칸을 쪼개요. 뒤는 free time · online)
    const b = S.takeStatus(m, 'Mara', { status: 'dnd', activity: 'call with the client', duration: '1h' }, opt);
    assert.equal(b.time, '13:00-15:20');
    assert.deepEqual(blocks(), [['09:00-13:00', 'work', 'dnd', ''], ['13:00-15:20', 'call with the client', 'dnd', ''], ['15:20-18:00', 'free time', 'online', ''], ['18:00-23:00', 'free time', 'online', '']]);
    // (칸이 끝난 뒤까지 가는 시간이면 쪼개지 않아요)
    S.takeStatus(m, 'Mara', { activity: 'long call', duration: '9h' }, opt);
    assert.deepEqual(blocks()[1], ['13:00-15:20', 'long call', 'dnd', '']);
    // (다른 요일 · 다른 칸은 그대로, 표에 남아요: 다음 주 같은 시간에도)
    assert.deepEqual(S.scheduleOf(m, 'Mara').days.Tuesday.map(x => x.activity), ['work', 'desk work', 'free time']);
    assert.equal(S.statusNow(m, 'Mara', { now: new Date(t + 7 * 86400_000), tz: 'UTC' }).activity, 'long call');
    // (전에 걸려 있던 임시 상태는 풀려요: 새로 적은 칸을 가리면 안 돼요)
    const late = { now: new Date(Date.parse('2026-11-23T23:30:00Z')), tz: 'UTC' };
    const o = S.takeStatus(m, 'Mara', { activity: 'night walk', duration: '30h' }, late);   // (지금 칸이 없는 시간: 마리나라의 캐릭터 방 그대로 임시 상태)
    assert.equal(o.block, undefined); assert.ok(o.expiresAt);
    const next = { now: new Date(Date.parse('2026-11-24T14:20:00Z')), tz: 'UTC' };
    assert.equal(S.statusNow(m, 'Mara', next).activity, 'night walk');
    assert.equal(S.takeStatus(m, 'Mara', { status: 'online', activity: 'lunch out' }, next).block, true);
    assert.deepEqual((({ activity, override }) => [activity, override])(S.statusNow(m, 'Mara', next)), ['lunch out', undefined]);
    // (내가 손으로 준 상태가 있으면 표도 안 고쳐요)
    S.setStatusOverride(m, 'Mara', { status: 'dnd', activity: 'do not disturb her' }, next.now);
    assert.equal(S.takeStatus(m, 'Mara', { activity: 'something else' }, next), null);
    assert.equal(S.scheduleOf(m, 'Mara').days.Tuesday[1].activity, 'lunch out');
    // (지금 칸과 같은 말을 되돌려 쓴 것은 아무것도 안 바꿔요)
    S.setStatusOverride(m, 'Mara', {});
    assert.equal(S.takeStatus(m, 'Mara', { status: 'online', activity: 'Lunch out', duration: '2h' }, next), null);
    assert.equal(S.scheduleOf(m, 'Mara').days.Tuesday.length, 3);
    assert.equal(G.followSchedule(m, next.now.getTime()) >= 0, true); assert.ok(p);
});
test('캐릭터가 방금 들은 자기 상태를 그대로 되돌려 쓴 것은 바꾼 게 아니에요: 임시 상태가 다시 걸리지 않고, 시간이 지나면 스케줄로 돌아가요', () => {
    const { m } = world(), t = Date.parse('2026-11-23T03:00:00Z'), now = new Date(t), later = ms => new Date(t + ms), H = 3600_000;
    S.setSchedule(m, 'Mara', all('online', 'free time'), NOW);
    // (스케줄대로인 상태를 그대로 적어 보낸 답: 임시 상태를 만들지 않아요)
    assert.equal(S.takeStatus(m, 'Mara', { status: 'online', activity: 'Free Time', duration: '8h' }, { now, tz: 'UTC' }), null);
    assert.equal(S.statusNow(m, 'Mara', { now, tz: 'UTC' }).override, undefined);
    // (밤에 스스로 바꿈: 2시간짜리)
    const o = S.takeStatus(m, 'Mara', { status: 'dnd', activity: 'prolonged classical piano playing into the night', duration: '2h' }, { now, tz: 'UTC' });
    assert.equal(Date.parse(o.expiresAt) - t, 2 * H);
    // (다음 답장들이 그 상태를 그대로 되돌려 써도 — 긴 시간을 붙여서도 — 끝나는 때는 그대로)
    assert.equal(S.takeStatus(m, 'Mara', { status: 'dnd', activity: 'prolonged classical piano playing into the night', duration: '12h' }, { now: later(H), tz: 'UTC' }), null);
    assert.equal(S.takeStatus(m, 'Mara', { activity: ' Prolonged classical piano playing into the night ' }, { now: later(H), tz: 'UTC' }), null);
    // (하는 일은 그대로인데 상태만 다르면: 상태만 바뀌고 끝나는 때는 안 늘어나요)
    const s2 = S.takeStatus(m, 'Mara', { status: 'online', activity: 'prolonged classical piano playing into the night', duration: '12h' }, { now: later(H), tz: 'UTC' });
    assert.deepEqual([s2.status, s2.expiresAt, s2.createdAt], ['online', o.expiresAt, o.createdAt]);
    // (끝나면 스케줄로)
    assert.deepEqual((({ status, activity, override }) => [status, activity, override])(S.statusNow(m, 'Mara', { now: later(2 * H + 1000), tz: 'UTC' })), ['online', 'free time', undefined]);
    // (진짜로 바꾼 것은 전처럼 받아요)
    const n = S.takeStatus(m, 'Mara', { status: 'idle', activity: 'taking a shower', duration: '30m' }, { now: later(H), tz: 'UTC' });
    assert.deepEqual([n.status, n.activity, Date.parse(n.expiresAt) - (t + H)], ['idle', 'taking a shower', 30 * 60_000]);
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
test('생성 연결(마리나라의 connectionId): 저장하지 않아요. 편집 창의 처음 값은 그 방의 연결, 없으면 기본 연결. 이름은 모델 이름', async () => {
    const { m, a } = world(), T = globalThis.__dropTest;
    T.metadata = { narrative_archive: m };
    T.profiles = [{ id: 'p1', name: 'Gemini Pro' }];
    assert.deepEqual(G.liveConnections(), [{ id: '', name: 'draft-model', model: 'draft-model', provider: 'custom' }, { id: 'ai', name: 'ai-model', model: 'ai-model', provider: 'custom' }, { id: 'profile:p1', name: 'Gemini Pro', model: '', provider: '' }]);
    assert.equal(G.liveSetScheduleConnection, undefined);                              // (마리나라: 저장하는 길이 없어요)
    assert.equal(G.liveScheduleConnection(m, a.id), '');                               // (방에 연결이 없으면 기본: 메인)
    assert.equal(G.liveScheduleConnection(m), '');                                     // (방 밖: 기본)
    a.connectionId = 'profile:p1';
    assert.equal(G.liveScheduleConnection(m, a.id), 'profile:p1');
    a.connectionId = 'dr';
    assert.equal(G.liveScheduleConnection(m, a.id), '');
    a.connectionId = 'ai';
    assert.equal(G.liveScheduleConnection(m, a.id), 'ai');
    // 그 방의 프로필이 없어지면 기본으로
    a.connectionId = 'profile:p1'; T.profiles = [];
    assert.equal(G.liveScheduleConnection(m, a.id), '');
    // 옛 저장의 Orbit 하나짜리 생성 연결은 옮기지 않고 버려요
    const old = { phones: {} };
    L.startFresh(old, { persona: 'Ren', scope: 'test' });
    const ow = L.liveWorld(old);
    delete ow[L.ROOM_META_MARK];                                                       // (2026-11-24 전의 세계: 표시가 없어요)
    ow.messenger.rooms.r1 = { id: 'r1', members: ['Ren', 'Mara'], messages: [] };
    ow.presence = { meta: { scheduleConnectionId: 'profile:p1' } };
    assert.equal(G.liveScheduleConnection(old, 'r1'), '');
    assert.equal(S.moveRoomMeta(old), 1);
    assert.equal(S.moveRoomMeta(old), 0);                                              // (한 번만)
    assert.equal(ow.presence.meta.scheduleConnectionId, 'profile:p1');                 // (Orbit의 옛 값은 남아요: 옛 탭 · 옛 일꾼이 읽어요. 새 코드는 안 읽어요)
    assert.equal(ow.messenger.rooms.r1.meta, undefined);
});
test('먼저 말 걸기의 방 전체 설정: 마리나라의 열쇠 그대로 (하루 상한 · 단체방 상한 같이 쓰기 · 캐릭터끼리 주고받기)', async () => {
    const { m, a } = world(), A = await at('marinara/autonomous.service.js');
    assert.deepEqual(S.autonomousOptions(m, a.id), { on: false, schedulesEnabled: false, autonomousDailyCapOverride: null, groupChatMode: null, characterExchanges: false, groupResponseOrder: 'sequential', groupTurnPromptEnabled: true });
    S.setAutonomous(m, a.id, true);
    assert.deepEqual(S.setAutonomousOptions(m, a.id, { autonomousDailyCapOverride: 3.9, groupChatMode: 'individual', characterExchanges: true }), { on: true, schedulesEnabled: false, autonomousDailyCapOverride: 3, groupChatMode: 'individual', characterExchanges: true, groupResponseOrder: 'sequential', groupTurnPromptEnabled: true });
    const meta = S.roomMeta(m, a.id);
    assert.equal(A.dailyCapForCharacter({ talkativeness: 90 }, meta), 3);            // (마리나라가 그 열쇠를 읽어요)
    assert.equal(A.sharesAutonomousDailyBudget(meta), true);
    assert.throws(() => S.setAutonomousOptions(m, a.id, { autonomousDailyCapOverride: 0 }), /1 이상/);
    assert.deepEqual(S.setAutonomousOptions(m, a.id, { autonomousDailyCapOverride: null, groupChatMode: null, characterExchanges: false }), { on: true, schedulesEnabled: false, autonomousDailyCapOverride: null, groupChatMode: null, characterExchanges: false, groupResponseOrder: 'sequential', groupTurnPromptEnabled: true });
    assert.equal(S.setAutonomousOptions(m, a.id, { groupResponseOrder: 'smart', groupTurnPromptEnabled: false }).groupResponseOrder, 'smart');
    assert.equal(S.autonomousOptions(m, a.id).groupTurnPromptEnabled, false);
    assert.throws(() => S.setAutonomousOptions(m, a.id, { groupResponseOrder: 'random' }), /sequential/);
    assert.deepEqual(Object.keys(meta).filter(k => /Cap|groupChat|Exchanges/.test(k)), []);
});
test('캐릭터끼리 주고받기(마리나라의 /autonomous/exchange): 켜야 하고, 단체방에서만. 하루 상한을 넘으면 안 해요', () => {
    const { m, a } = world(), g = plain(m, ['Mara', 'Ivo']), t = Date.now(), now = new Date(t);
    for (const r of [a, g]) r.messages.push({ id: `u${r.id}`, n: 1, from: 'Ren', text: 'hi', at: t - 120_000 }, { id: `c${r.id}`, n: 2, from: 'Mara', text: 'hey', at: t - 1000 });
    S.setSchedule(m, 'Mara', { ...all('online', 'free'), talkativeness: 100 }, now);
    S.setSchedule(m, 'Ivo', { ...all('online', 'free'), talkativeness: 100 }, now);
    assert.equal(S.checkExchangeFor(m, g.id, 'Mara', { now }).reason, 'exchanges_disabled');
    for (const r of [a, g]) S.setAutonomousOptions(m, r.id, { characterExchanges: true });
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
    assert.equal(S.schedulesOn(m, a.id), false);                     // 스케줄이 하나도 없으면 꺼진 것
    S.setSchedule(m, 'Mara', all('dnd', 'working'), NOW);
    assert.equal(S.schedulesOn(m, a.id), true);                      // 정한 적 없으면 스케줄이 있을 때 켜진 것
    S.setSchedulesOn(m, a.id, false);
    assert.equal(S.scheduleOf(m, 'Mara').days.Monday[0].activity, 'working');
    assert.deepEqual([S.activeSchedule(m, 'Mara'), S.statusNow(m, 'Mara', { now: NOW }), S.replyDelay(m, 'Mara', { now: NOW }), S.blockNow(m, 'Mara', { now: NOW })], [null, null, 0, null]);
    assert.match(S.contextBlock(m, 'Mara', a.id, { now: NOW }), /^Your current status: online\.\n/);   // (스케줄이 꺼져 있으면 "online")
    assert.equal(S.autonomousOptions(m, a.id).schedulesEnabled, false);
    S.setSchedulesOn(m, a.id, true);
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
    assert.throws(() => S.exportSchedule(m, 'Ivo'), /스케줄이 없습니다/);
});
test('따라 묻기는 마리나라처럼 점점 뜸해지고 세 번에서 멈춰요 (판단할 때마다 기억을 지우지 않아요)', () => {
    const { m, a } = world(), t = Date.now();
    a.messages.push({ id: 'x1', n: 1, from: 'Ren', text: 'hi', at: t - 20 * 60_000 }, { id: 'x2', n: 2, from: 'Mara', text: 'hey', at: t - 19 * 60_000 });
    S.setSchedule(m, 'Mara', { ...all('online', 'free'), inactivityThresholdMinutes: 15, talkativeness: 80 }, new Date(t));
    S.setAutonomous(m, a.id, true);
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
    S.setAutonomous(m, a.id, true);
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
    S.setAutonomous(m, a.id, true);
    S.checkProactive(m, a.id, { now: new Date() });                     // (방의 말에서 처음 읽어요)
    S.userStore(m).getState().setUserStatus('idle');
    a.messages.push({ id: 'x3', n: 3, from: 'Ren', text: 'back', at: Date.now() - 1 });
    assert.equal(S.syncUser(m, a.id), true);
    assert.equal(S.presenceOf(m).user.status, 'active');
});
test('스케줄의 주인은 캐릭터 카드예요(마리나라처럼): 한 채팅에서 만든 스케줄 · 상태 · 매주 갱신이 다른 채팅에서도 보여요', async () => {
    const card = { mara: {} }, wrote = [];
    S.setCardStore({ get: n => card[String(n).toLowerCase()] || null, set: async (n, patch) => { wrote.push([n, Object.keys(patch)[0]]); Object.assign(card[String(n).toLowerCase()], patch); } });
    try {
        const one = world(), two = world();
        S.setSchedule(one.m, 'Mara', all('dnd', 'working'), NOW);
        S.setStatusOverride(one.m, 'Mara', { status: 'idle', activity: 'coffee', minutes: 30 }, NOW);
        S.setAutoRenew(one.m, 'Mara', true);
        await S.flushCards();
        assert.deepEqual(wrote, [['Mara', 'conversationSchedule'], ['Mara', 'conversationStatusOverride'], ['Mara', 'conversationScheduleAutoRenew']]);
        // 다른 채팅: 카드의 것을 그대로 읽어요
        assert.equal(S.scheduleOf(two.m, 'Mara').days.Monday[0].activity, 'working');
        assert.equal(S.statusNow(two.m, 'Mara', { now: NOW }).activity, 'coffee');
        assert.equal(S.autoRenewOf(two.m, 'Mara'), true);
        // 다른 채팅에서 지우면 처음 채팅에서도 없어져요
        S.setSchedule(two.m, 'Mara', null);
        S.setStatusOverride(two.m, 'Mara', {});
        await S.flushCards();
        assert.equal(S.scheduleOf(one.m, 'Mara'), null);
        assert.equal(S.statusNow(one.m, 'Mara', { now: NOW }), null);
        // 카드가 없는 사람(Ivo)은 그 채팅의 것만 써요
        S.setSchedule(one.m, 'Ivo', all('online', 'free'), NOW);
        assert.equal(S.scheduleOf(one.m, 'Ivo').days.Monday[0].activity, 'free');
        assert.equal(S.scheduleOf(two.m, 'Ivo'), null);
        // 카드에 아직 없고 채팅에만 있던 예전 스케줄은 카드로 올라가요
        delete card.mara.conversationSchedule;
        const old = world();
        old.w.presence = { schedules: { mara: { ...all('online', 'legacy'), weekStart: 'W' } } };
        assert.equal(S.scheduleOf(old.m, 'Mara').days.Monday[0].activity, 'legacy');
        await S.flushCards();
        assert.equal(card.mara.conversationSchedule.days.Monday[0].activity, 'legacy');
    } finally { S.setCardStore(null); }
});
test('시간대는 모든 채팅에 하나(마리나라처럼)', () => {
    let zone = '';
    S.setZoneStore({ get: () => zone, set: z => { zone = z; } });
    try {
        const one = world(), two = world();
        S.setScheduleZone(one.m, 'Europe/Berlin');
        assert.equal(zone, 'Europe/Berlin');
        assert.equal(S.scheduleZone(two.m), 'Europe/Berlin');
        S.setScheduleZone(two.m, '');
        assert.equal(S.scheduleZone(two.m), '');
    } finally { S.setZoneStore(null); }
});
test('말 거는 이유의 "the user"는 페르소나 이름으로 들어가요', () => {
    const { m, a } = world(), t = Date.now();
    a.messages.push({ id: 'x1', n: 1, from: 'Ren', text: 'hi', at: t - 20 * 60_000 }, { id: 'x2', n: 2, from: 'Mara', text: 'hey', at: t - 19 * 60_000 });
    S.setSchedule(m, 'Mara', all('online', 'free'), new Date(t));
    S.setAutonomous(m, a.id, true);
    const r = S.checkProactive(m, a.id, { now: new Date() });
    assert.equal(r.autonomousIntent, 'You have a free moment and Ren has been quiet.');
    assert.equal(r.autonomousIntentPrompt, 'What prompted this message: You have a free moment and Ren has been quiet.');
    const c = S.contextBlock(m, 'Mara', a.id, { now: NOW, lastRole: 'assistant', said: false, intentKey: 'long_absence_check_in' });
    assert.match(c, /What prompted this message: Ren has been away for a long while\. Check in with them\./);
    assert.doesNotMatch(c, /the user/i);
});

// ---- 단체방에서 누가 답하나 (마리나라의 Individual 단체방: src/marinara/group-responders.js)
const GR = await at('marinara/group-responders.js');
function group() {
    const x = world(), g = plain(x.m, ['Mara', 'Ivo']), t = NOW.getTime();
    x.w.phones.varo = { owner: 'Varo' };
    g.members.push('Varo');
    g.messages.push({ id: 'u1', n: 1, from: 'Ren', text: 'anyone up for dinner', at: t });
    return { ...x, g, t };
}
test('단체방 순서: sequential은 있는 사람 모두, manual은 아무도, @으로 부르면 그 사람만, 오프라인은 빠져요', async () => {
    const { m, g } = group(), ask = async () => { throw new Error('안 불러야 해요'); };
    assert.deepEqual(await S.groupResponders(m, g.id, { ask, now: NOW }), ['mara', 'ivo', 'varo']);
    S.setSchedule(m, 'Ivo', all('offline', 'sleeping'), NOW);
    assert.deepEqual(await S.groupResponders(m, g.id, { ask, now: NOW }), ['mara', 'varo']);
    S.setAutonomousOptions(m, g.id, { groupResponseOrder: 'manual' });
    assert.deepEqual(await S.groupResponders(m, g.id, { ask, now: NOW }), []);
    g.messages.push({ id: 'u2', n: 2, from: 'Ren', text: '@Varo you in?', at: NOW.getTime() + 1 });
    assert.deepEqual(await S.groupResponders(m, g.id, { ask, now: NOW }), ['varo']);
    g.messages.push({ id: 'u3', n: 3, from: 'Ren', text: '@Ivo wake up', at: NOW.getTime() + 2 });
    assert.deepEqual(await S.groupResponders(m, g.id, { ask, now: NOW }), []);   // (부른 사람이 오프라인)
});
test('단체방 순서 smart: 마리나라의 고르기 요청을 그대로 보내고, 고른 사람만. 못 고르면 방금 말한 사람이 아닌 첫 사람', async () => {
    const { m, g } = group(), seen = [];
    S.setAutonomousOptions(m, g.id, { groupResponseOrder: 'smart' });
    S.setSchedule(m, 'Mara', { ...all('dnd', 'working'), talkativeness: 30 }, NOW);
    const cards = { ivo: { personality: 'dry', description: 'a mechanic' } };
    const got = await S.groupResponders(m, g.id, { now: NOW, cards, ask: async (messages, o) => { seen.push({ messages, o }); return '```json\n["varo", "Mara", "nobody"]\n```'; } });
    assert.deepEqual(got, ['varo', 'mara']);                                       // (id도 이름도 받아요, 없는 사람은 버려요)
    const [sys, user] = seen[0].messages;
    assert.match(sys.content, /^You are a hidden response orchestrator for a Conversation-mode group chat\./);
    assert.match(sys.content, /Return ONLY a valid JSON array of character IDs, such as \["character-id"\]\. No prose, no object wrapper, no markdown\.$/);
    assert.match(user.content, /^<persona>Ren<\/persona>\n<candidates>\n<candidate>\nid: mara\nname: Mara\ntalkativeness: 30%\ncurrent status: dnd\ncurrent activity: working\n<\/candidate>/);
    assert.match(user.content, /id: ivo\nname: Ivo\ntalkativeness: 50%\ncurrent status: online\npersonality: dry\ndescription: a mechanic/);
    assert.match(user.content, /<recent_transcript>\nRen: anyone up for dinner\n<\/recent_transcript>$/);
    assert.deepEqual(seen[0].o, { temperature: 0.2, topP: 1 });
    // (못 읽는 답 · 실패: 한 사람으로)
    g.messages.push({ id: 'c1', n: 2, from: 'Mara', text: 'busy', at: NOW.getTime() + 1 });
    assert.deepEqual(await S.groupResponders(m, g.id, { now: NOW, ask: async () => 'no idea' }), ['ivo']);
    assert.deepEqual(await S.groupResponders(m, g.id, { now: NOW, ask: async () => { throw new Error('x'); } }), ['ivo']);
});
test('단체방 부르기: 답에서 @이름으로 부른 사람이 다음 차례, 이번 차례에 말한 사람은 다시 안 불러요', () => {
    const { m, g } = group();
    S.setSchedule(m, 'Varo', all('idle', 'cooking'), NOW);
    const r = S.groupHandoff(m, g.id, { queue: ['mara', 'ivo'], index: 0, text: 'ask @Varo, he cooks. @Mara agrees', now: NOW });
    assert.deepEqual([r.changed, r.mentioned, r.queue], [true, ['varo'], ['mara', 'varo', 'ivo']]);
    assert.ok(r.delays.varo >= 5000 && r.delays.varo <= 15000);                    // (마리나라의 부름 늦음: idle 5~15초)
    assert.equal(S.groupHandoff(m, g.id, { queue: ['mara', 'ivo'], index: 0, text: 'email me at x@varo.com', now: NOW }).changed, false);   // (글자 뒤에 붙은 @는 부름이 아니에요)
    assert.equal(S.groupHandoff(m, g.id, { queue: ['mara', 'ivo'], index: 0, text: 'varo@home is my login', now: NOW }).changed, false);
    S.setSchedule(m, 'Varo', all('offline', 'asleep'), NOW);
    assert.equal(S.groupHandoff(m, g.id, { queue: ['mara', 'ivo'], index: 0, text: '@Varo?', now: NOW }).changed, false);
    // (먼저 건 말의 차례: 하루 상한이 찬 사람은 못 불러요)
    S.setSchedule(m, 'Varo', { ...all('online', 'free'), autonomousDailyCapOverride: 1 }, NOW);
    assert.deepEqual(S.groupHandoff(m, g.id, { queue: ['mara'], index: 0, text: '@Varo?', counted: true, now: NOW }).mentioned, ['varo']);
    S.noteProactive(m, g.id, 'varo', '', NOW);
    assert.equal(S.groupHandoff(m, g.id, { queue: ['mara'], index: 0, text: '@Varo?', counted: true, now: NOW }).changed, false);
});
test('마리나라의 단체방 함수: 늦음이 짧은 사람부터, 확률로 고르기, 차례 알림 글', () => {
    assert.deepEqual(GR.orderConversationRespondersByDelay(['a', 'b', 'c'], new Map([['a', { delayMs: 9 }], ['b', { delayMs: 0 }], ['c', { delayMs: 0 }]])), ['b', 'c', 'a']);
    const pick = (answers, lastSpeakerId, mode = 'conversation') => GR.chooseSmartResponders({ answers: new Map(Object.entries(answers)), candidateIds: ['a', 'b', 'c'], lastSpeakerId, threshold: 0.5, mode });
    assert.deepEqual(pick({ a: 0.9, b: 0.6, c: 0.1 }, null), ['a', 'b']);
    assert.deepEqual(pick({ a: 0.9, b: 0.6, c: 0.1 }, 'a'), ['b']);
    assert.deepEqual(pick({ a: 0.9, b: 0.6 }, null, 'roleplay'), ['a']);
    assert.deepEqual(pick({ a: 0.2, b: 0.1 }, 'a'), ['b']);
    assert.equal(pick({}, null), null);
    assert.equal(GR.GROUP_MENTION_INVITE_LINE, 'You may address another group member with @Name to invite their next reply. Each available character can reply once in this turn.');
    assert.equal(GR.normalizeGroupChatMode('x'), 'merged');
});
test('단체방 줄: 고르지 않은 사람의 답장은 빠지고, 늦음이 짧은 사람이 앞에 서요', async () => {
    const { m, w, g, t } = group();
    S.setSchedule(m, 'Mara', { ...all('dnd', 'working'), dndResponseDelayMinutes: 30 }, NOW);
    S.setAutonomousOptions(m, g.id, { groupChatMode: 'individual' });
    for (const n of ['Mara', 'Ivo', 'Varo']) L.enqueueJob(m, { kind: 'reply', owner: n, room: g.id, at: t });
    assert.equal(await G.pickResponders(m, t), 0);                                 // (sequential: 그대로)
    G.holdReplies(m, t);
    assert.deepEqual(w.queue.jobs.map(j => j.owner), ['Ivo', 'Varo', 'Mara']);
    assert.deepEqual(g.turn, { spoke: [] });
    // (manual: 새로 보낸 말에는 아무도 안 서요; @으로 부르면 그 사람만)
    S.setAutonomousOptions(m, g.id, { groupResponseOrder: 'manual' });
    w.queue.jobs = [];
    for (const n of ['Mara', 'Ivo', 'Varo']) L.enqueueJob(m, { kind: 'reply', owner: n, room: g.id, at: t });
    assert.equal(await G.pickResponders(m, t), 3);
    assert.deepEqual(w.queue.jobs, []);
    g.messages.push({ id: 'u2', n: 2, from: 'Ren', text: '@Ivo you?', at: t + 1 });
    for (const n of ['Mara', 'Ivo', 'Varo']) L.enqueueJob(m, { kind: 'reply', owner: n, room: g.id, at: t + 1 });
    await G.pickResponders(m, t + 1);
    assert.deepEqual(w.queue.jobs.map(j => j.owner), ['Ivo']);
});

// ---- Merged 단체방 (마리나라의 기본 단체방 방식: 한 요청이 여럿의 말을 한꺼번에 써요)
const RUN = await at('phone2run.js'), MC = await at('marinara/merged-conversation.js');
test('Merged: 방의 답장들이 하나로 묶이고, 오프라인은 빠지고, @으로 부르면 그 사람만. 늦음은 마리나라의 계산', async () => {
    const { m, w, g, t } = group();
    assert.equal(S.groupMode(m, g.id), 'merged');                                        // (마리나라: individual이 아니면 merged)
    S.setSchedule(m, 'Ivo', all('offline', 'asleep'), NOW);
    S.setSchedule(m, 'Mara', { ...all('dnd', 'working'), dndResponseDelayMinutes: 30 }, NOW);
    for (const n of ['Mara', 'Ivo', 'Varo']) L.enqueueJob(m, { kind: 'reply', owner: n, room: g.id, at: t });
    await G.pickResponders(m, t);
    assert.equal(w.queue.jobs.length, 1);
    const j = w.queue.jobs[0];
    assert.deepEqual([j.owner, j.merged, j.called, j.timed], ['Mara', ['mara', 'varo'], undefined, true]);
    assert.equal(j.notBefore, t + 30 * 60_000);                                    // (가장 늦는 사람의 늦음)
    G.holdReplies(m, t);
    assert.equal(w.queue.jobs.length, 1);
    // (@으로 부르면 그 사람만; 부른 사람이 오프라인이면 아무도 안 서고, 없었다고 남아요)
    w.queue.jobs = [];
    g.messages.push({ id: 'u2', n: 2, from: 'Ren', text: '@Varo you?', at: t + 1 });
    for (const n of ['Mara', 'Ivo', 'Varo']) L.enqueueJob(m, { kind: 'reply', owner: n, room: g.id, at: t + 1 });
    await G.pickResponders(m, t + 1);
    assert.deepEqual(w.queue.jobs.map(x => [x.owner, x.merged, x.called]), [['Varo', ['varo'], ['varo']]]);
    w.queue.jobs = [];
    g.messages.push({ id: 'u3', n: 3, from: 'Ren', text: '@Ivo?', at: t + 2 });
    for (const n of ['Mara', 'Ivo', 'Varo']) L.enqueueJob(m, { kind: 'reply', owner: n, room: g.id, at: t + 2 });
    await G.pickResponders(m, t + 2);
    assert.deepEqual(w.queue.jobs, []);
    assert.deepEqual(Object.keys(g.away), ['ivo']);
});
test('Merged: 한 답을 마리나라의 나누기로 사람마다의 말로 넣어요. 이름이 없는 줄은 첫 사람의 것', () => {
    const { m, g } = group(), before = g.messages.length;
    const r = RUN.takeMerged(m, g.id, '[21:04] Mara: hey whats up\nyou there\nIvo: not much lol\nVARO:\nlate again', { names: ['Mara', 'Ivo', 'Varo'], lead: 'Mara', now: 5000, stateOf: n => (n === 'Ivo' ? 'home' : '') });
    assert.deepEqual(g.messages.slice(before).map(x => [x.from, x.text, x.state]), [['Mara', 'hey whats up', undefined], ['Mara', 'you there', undefined], ['Ivo', 'not much lol', 'home'], ['Varo', 'late again', undefined]]);
    assert.deepEqual([r.said, r.speakers], [4, ['Mara', 'Ivo', 'Varo']]);
    const one = RUN.takeMerged(m, g.id, 'just one line with no name', { names: ['Mara', 'Ivo'], lead: 'Ivo', now: 6000 });
    assert.deepEqual([one.speakers, g.messages.at(-1).from], [['Ivo'], 'Ivo']);
    assert.throws(() => RUN.takeMerged(m, g.id, '  ', { names: ['Mara'], lead: 'Mara' }), /빈 응답입니다/);
});
test('Merged 지시문: 마리나라의 글 그대로 (기본 Conversation 지시문 + 단체방 줄 + 되풀이 금지 + Output Format)', () => {
    const sys = MC.buildMergedConversationSystemPrompt({ convoCharNames: ['Mara', 'Ivo'], personaName: 'Ren' });
    assert.match(sys, /^You are Mara, Ivo chatting with the user called Ren in a casual private DM conversation\. You are real and autonomous people\.\n/);
    assert.match(sys, /\nThis is a group DM\. Each character responds in their own voice and personality\. Not every character needs to respond every time; only those who would naturally react\.\nIMPORTANT: Prefix each character's line with their name\. Example:\nMara: hey whats up\nIvo: not much lol\nIf a character sends multiple lines in a row, only prefix the first line:\nMara: so anyway\ni was thinking about that\nIvo: yeah\?\nDo not repeat a message you already sent in the recent conversation\. If your first draft repeats one, write a genuinely different response\.$/);
    assert.equal(MC.formatConversationGroupOutputFormat({ wrapFormat: 'none', characterNames: ['Mara', 'Ivo'], userName: 'Ren' }), "Remember to prefix messages with `Name: message`!\nOnly respond for these characters: Mara, Ivo. Never respond for Ren or write Ren's messages.");
    assert.equal(MC.mergedRespondersLine(['Mara']), '- Only Mara may respond this turn. Other participants are unavailable; do not write their messages.');
    assert.equal(MC.mergedMentionLine(['Ivo']), "Respond ONLY as Ivo. The user's latest message explicitly @mentions Ivo, so no other character should reply to this turn.");
    assert.equal(MC.mergedMentionLine(['Ivo', 'Mara']), "The user's latest message explicitly @mentions Ivo, Mara. Only those mentioned characters may reply to this turn. Do not include any response lines from any other character.");
});

// ---- 브라우저와 서버 플러그인이 따로 기억해도 같은 판단을 하게: 먼저 건 말의 표시로 되살려요
test('먼저 건 말의 표시(extra.autonomous): 방을 처음 읽는 쪽도 "이미 걸었다"를 알아요. 표시가 없으면 한 번도 안 건 것으로 봐요', () => {
    const mk = marks => {
        const { m, w, a } = world(), t = Date.now();
        S.setAutonomous(m, a.id, true);
        L.sendLive(m, a.id, 'hey', t - 6 * 3600_000);
        a.messages.push({ id: 'r1', n: 2, from: 'Mara', text: 'hi', at: t - 6 * 3600_000 + 60_000 });
        marks.forEach((on, i) => a.messages.push({ id: `p${i}`, n: 3 + i, from: 'Mara', text: 'you there?', at: t - 120_000 + i * 1000, ...(on ? { extra: { autonomous: true } } : {}) }));
        return { m, a };
    };
    // 표시 없이(예전 말 · 그냥 답장): 6시간 조용했으니 걸 때예요
    const plain = mk([false]);
    assert.equal(S.checkProactive(plain.m, plain.a.id, {}).shouldTrigger, true);
    S.clearProgress(plain.m, plain.a.id);
    // 방금(2분 전) 먼저 건 말이 하나 있으면: 따라 묻기는 한참 뒤예요
    const one = mk([true]);
    assert.equal(S.checkProactive(one.m, one.a.id, {}).shouldTrigger, false);
    // 서버처럼 후속 2번까지: 이미 두 번 걸었으면, 다음 따라 묻기 때가 지났어도 더 안 걸어요 (브라우저처럼 3번까지면 걸어요)
    const long = cap => { const x = mk([true, true]), t = Date.now(); x.a.messages[0].at = t - 17 * 3600_000; x.a.messages[1].at = t - 17 * 3600_000 + 60_000; x.a.messages[2].at = t - 16.5 * 3600_000; x.a.messages[3].at = t - 16.5 * 3600_000 + 1000; return S.checkProactive(x.m, x.a.id, { maxFollowups: cap, source: 'server', userStatus: 'idle' }).shouldTrigger; };
    assert.equal(long(2), false);
    assert.equal(long(3), true);
    // 내가 그 뒤에 말했으면 표시는 지난 일이에요
    const back = mk([true]);
    L.sendLive(back.m, back.a.id, 'sorry, was out', Date.now() - 5 * 3600_000 + 1);
    back.a.messages.sort((x, y) => x.at - y.at);
    assert.equal(S.checkProactive(back.m, back.a.id, {}).shouldTrigger, false);   // (내 말이 마지막이고 캐릭터가 아직 답 안 함: 답장 줄의 일)
});

test('다른 쪽이 방을 바꾼 뒤(reseedActivity): 방에서 다시 읽어요. "브라우저가 보고 있음"은 남아요', async () => {
    const A = await at('marinara/autonomous.service.js');
    const { m, w, a } = world(), t = Date.now(), id = S.chatIdOf(m, a.id);
    S.setAutonomous(m, a.id, true);
    L.sendLive(m, a.id, 'hey', t - 6 * 3600_000);
    a.messages.push({ id: 'r1', n: 2, from: 'Mara', text: 'hi', at: t - 6 * 3600_000 + 60_000 });
    assert.equal(S.checkProactive(m, a.id, { source: 'server', userStatus: 'idle' }).shouldTrigger, true);
    A.recordAutonomousClientPresence(id, 'active');
    const seen = A.getActivityState(id).clientPresence.updatedAt;
    // 그사이 다른 쪽이 먼저 건 말을 넣었어요
    a.messages.push({ id: 'p1', n: 3, from: 'Mara', text: 'you there?', at: t - 60_000, extra: { autonomous: true } });
    S.clearProgress(m, a.id);
    assert.equal(S.checkProactive(m, a.id, { source: 'server', userStatus: 'idle' }).shouldTrigger, true);   // (아직 모름: 기억은 예전 것)
    S.clearProgress(m, a.id);
    S.reseedActivity(m, a.id);
    assert.equal(A.getActivityState(id).clientPresence.updatedAt, seen);
    assert.equal(S.checkProactive(m, a.id, { source: 'server', userStatus: 'idle' }).shouldTrigger, false);
    assert.equal(A.getActivityState(id).autonomousMessages.get('mara').count, 1);
    assert.equal(A.getActivityState(id).clientPresence.updatedAt, seen);
});
test('먼저 말 걸 때인지 볼 때 카드의 상태를 지금 스케줄의 상태로 맞춰요 (마리나라의 /autonomous/check 1040~1053). 카드가 없는 사람 · 스케줄이 없는 사람은 그대로', async () => {
    const card = { mara: { conversationStatus: 'online' } }, wrote = [];
    S.setCardStore({ get: n => card[String(n).toLowerCase()] || null, set: async (n, patch) => { wrote.push([n, patch]); Object.assign(card[String(n).toLowerCase()], patch); } });
    try {
        const { m } = world(), g = plain(m, ['Mara', 'Ivo']);
        S.setSchedule(m, 'Mara', all('dnd', 'working'), NOW);
        S.setSchedule(m, 'Ivo', all('idle', 'nap'), NOW);
        await S.flushCards(); wrote.length = 0;
        S.setAutonomous(m, g.id, true);
        S.checkProactive(m, g.id, { now: NOW });
        await S.flushCards();
        assert.deepEqual(wrote, [['Mara', { conversationStatus: 'dnd' }]]);
        // (같으면 안 써요)
        S.checkProactive(m, g.id, { now: NOW });
        await S.flushCards();
        assert.equal(wrote.length, 1);
    } finally { S.setCardStore(null); }
});
