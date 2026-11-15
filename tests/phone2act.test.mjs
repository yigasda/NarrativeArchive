// 폰 2의 사진 · 메모(일기) · 초안 · 녹음 (phone2act.js). 서랍은 진짜(phone2store.js liveMeta), 모델만 가짜예요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import { T, AI, ACT } from './phone2reflect.load.mjs';

const src = f => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
const phone = () => ({ owner: 'Mara', now: '11-12 21:30', year: 2026, contacts: [], threads: [{ with: 'Ivo', messages: [{ from: 'Ivo', time: '11-12 20:00', text: 'hi' }] }], calls: [], photos: [], notes: [], searches: [], events: [], posts: [], mails: [], diary: [], voice: [] });
const ANSWER = JSON.stringify({ caption: 'A room', title: 'Today', text: 'A quiet moment.', mood: 'warm' });
// 이야기에서 시작한 실시간 폰: 롤플 #0~#2까지가 시작 전, #3~#4는 시작 뒤
function world() {
    T.chat = ['옛날 이야기 하나', '옛날 이야기 둘', '시작 직전 이야기', '시작 뒤 롤플 하나', '시작 뒤 롤플 둘'].map((mes, i) => ({ name: i % 2 ? 'Mara' : 'Ren', is_user: !(i % 2), mes, extra: {} }));
    T.recent = ['[#1] Mara: 옛날 이야기 둘', '[#2] Ren: 시작 직전 이야기', '[#3] Mara: 시작 뒤 롤플 하나', '[#4] Ren: 시작 뒤 롤플 둘'];
    const real = { phones: { mara: phone() }, text: '' };
    L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test', story: { ranges: {}, titles: [], rawFrom: 0, own: [''] } });
    const room = L.ensureRoom(real, ['Mara']);
    L.sendLive(real, room.id, '메신저로 한 말');
    const d = L.liveMeta(real, { now: () => '11-14 16:05' });
    return { real, d, p: d.phones.mara };
}
const asked = [];
const fake = () => { asked.length = 0; T.ask = async (input, o) => { asked.push({ input, system: o.system }); return ANSWER; }; };
const done = () => { delete T.ask; T.chat = []; delete T.recent; };

test('실시간 사진 · 메모 · 일기 · 초안 · 녹음: 지금은 흐르는 시계, 최근 대화는 메신저 것 (시작 뒤 롤플은 안 읽어요)', async () => {
    const { real, d, p } = world(), p1 = JSON.stringify(real.phones);
    fake();
    try {
        const runs = [['photo', () => ACT.liveTakePhoto(d, p), AI.AI_SYS_SHOT], ['note', () => ACT.liveWriteEntry(d, p, 'note'), AI.AI_SYS_WRITE], ['diary', () => ACT.liveWriteEntry(d, p, 'diary'), AI.AI_SYS_WRITE],
            ['draft', () => ACT.liveMakeDraft(d, p, 0), AI.AI_SYS_DRAFT], ['voice', () => ACT.liveRecordVoice(d, p), AI.AI_SYS_VOICE]];
        for (const [name, run, sys] of runs) {
            await run();
            const { input, system } = asked.at(-1);
            assert.equal(system, sys, name); // 지시문은 폰 1 것 그대로
            assert.ok(input.includes('[RECENT CHAT]\n[#1] Mara: 옛날 이야기 둘\n\n[#2] Ren: 시작 직전 이야기\n\nRen: 메신저로 한 말'), name);
            assert.ok(!input.includes('시작 뒤 롤플'), name);
            if (name !== 'draft') assert.ok(input.includes('[NOW]\n11-14 16:05'), name);
        }
        assert.equal(asked.length, 5);
        // 찍힌 시각: 흐르는 시계
        assert.equal(p.photos.at(-1).time, '11-14 16:05'); assert.equal(p.notes.at(-1).time, '11-14 16:05'); assert.equal(p.diary.at(-1).date, '11-14');
        assert.equal(p.threads[0].draft.time, '11-14 16:05'); assert.equal(p.voice.at(-1).time, '11-14 16:05');
        // 폰 1의 폰은 그대로
        assert.equal(JSON.stringify(real.phones), p1);
    } finally { done(); }
});

test('흐르는 시계를 못 읽으면 폰에 저장된 시각; 서랍이 아니면 안 돌아요', async () => {
    const { real, p } = world();
    fake();
    try {
        const d = L.liveMeta(real); // 시계 없이 만든 서랍
        await ACT.liveTakePhoto(d, d.phones.mara);
        assert.equal(d.phones.mara.photos.at(-1).time, '11-12 21:30');
        const broken = L.liveMeta(real, { now: () => { throw new Error('x'); } });
        assert.equal(L.liveNowText(broken, broken.phones.mara), '11-12 21:30');
        // 폰 1의 메타(서랍 아님), 서랍 흉내만 낸 것: 모델을 부르기 전에 멈춰요
        const n = asked.length;
        for (const m of [real, { ...real, phoneUpto: 2, phoneRecent: () => 'x', phoneNow: () => '01-01 00:00' }]) {
            for (const run of [() => ACT.liveTakePhoto(m, p), () => ACT.liveWriteEntry(m, p, 'note'), () => ACT.liveMakeDraft(m, p, 0), () => ACT.liveRecordVoice(m, p)]) await assert.rejects(run, /실시간 폰의 서랍이 아니에요/);
        }
        assert.equal(asked.length, n);
    } finally { done(); }
});

test('타임라인(폰 1) 쪽은 예전 그대로: 롤플 채팅을 읽고, 폰 2 것은 하나도 안 읽어요', async () => {
    const { real } = world(), p = real.phones.mara;
    fake();
    try {
        // 서랍 흉내를 낸 메타를 줘도 폰 1 함수는 폰 2 것을 안 봐요
        const m = { ...real, phoneUpto: 2, phoneRecent: () => '메신저 흉내', phoneNow: () => '01-01 00:00' };
        for (const run of [() => AI.takePhoto(m, p), () => AI.writeEntry(m, p, 'note'), () => AI.makeDraft(m, p, 0), () => AI.recordVoice(m, p)]) {
            await run();
            const { input } = asked.at(-1);
            assert.ok(input.includes('시작 뒤 롤플 둘')); assert.ok(!input.includes('메신저')); assert.ok(!input.includes('01-01 00:00'));
        }
        assert.equal(p.photos.at(-1).time, '11-12 21:30');
    } finally { done(); }
});

test('phoneai.js는 폰 2가 생기기 전 내용 그대로예요 (폰 2 낱말 없음), 폰 2 사본은 폰 1 줄과 두 군데만 달라요', async () => {
    const a = await src('phoneai.js'), b = await src('phone2act.js');
    assert.doesNotMatch(a, /nowOn|recentOf|phoneUpto|phoneRecent|phoneNow|isLivePhone|phone2/);
    const body = (s, name) => { const i = s.indexOf(`export async function ${name}(`), j = s.indexOf('\n}\n', i); assert.ok(i >= 0 && j > i, name); return s.slice(i, j + 2); };
    for (const [one, two] of [['takePhoto', 'liveTakePhoto'], ['writeEntry', 'liveWriteEntry'], ['makeDraft', 'liveMakeDraft'], ['recordVoice', 'liveRecordVoice']]) {
        const back = body(b, two).replace(`export async function ${two}(`, `export async function ${one}(`).replace('    need(m);\n', '')
            .replaceAll('liveNowText(m, p)', 'storyNow(p) || p.now || \'\'').replaceAll('liveRecentText(m, p.owner, ', 'recentPhoneText(');
        assert.equal(back, body(a, one), one);
    }
});

test('창구(P): 실시간 서랍이면 폰 2 것, 아니면 폰 1 것을 같은 인자로; 실시간 폰을 서랍 없이 부르면 멈춰요', async () => {
    const api = await src('phone2api.js');
    assert.match(api, /const split = \(one, two\) => async \(\.\.\.a\) => \{\n    if \(isLiveMeta\(a\[0\]\)\) return two\(\.\.\.a\);\n    if \(a\[1\]\?\.\[LIVE_PHONE\]\) throw new Error\('실시간 폰은 실시간 화면에서만 돼요'\);\n    return one\(\.\.\.a\);\n\};/);
    for (const [one, two] of [['takePhoto', 'liveTakePhoto'], ['writeEntry', 'liveWriteEntry'], ['makeDraft', 'liveMakeDraft'], ['recordVoice', 'liveRecordVoice']]) assert.ok(api.includes(`${one}: split(${one}, ${two})`), one);
});
