// 폰 2 답장 요청에 넣을 값을 실제 폰 2에서 모으기 (7-1)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import * as G from '../src/phone2live.js';
import { replyInput } from '../src/phone2ask.js';

const at = s => Date.parse(s);   // Lyon is UTC+1 in November
const deps = { clock: (p, t) => `[OWNER'S CLOCK]\nPhone owner: ${p.owner}\nTime now: ${t}`, around: () => '[PEOPLE AROUND]\n- Ren: your mother, in Seoul.', card: o => `${o} is careful with money.`, place: () => 'Lyon · home' };
function world() {
    const m = { phones: {} };
    L.startFromStory(m, { persona: 'Ren', upto: 3, story: { ranges: {}, titles: [], rawFrom: 0 } });
    const w = L.liveWorld(m);
    L.putLivePhone(m, { owner: 'Mara', year: 2026, contacts: [{ name: 'Ren' }, { name: 'Ivo' }], threads: [
        { with: 'Ivo', messages: [{ from: 'Ivo', text: 'call me', time: '11-06 08:15' }] }, { with: 'Ren', messages: [{ from: 'Ren', text: 'old story text', time: '11-06 13:59' }] }],
        calls: [], photos: [{ caption: 'grey sky', time: '11-06 11:10' }], notes: [{ title: 'scarf', time: '11-05 21:00' }], searches: [], posts: [], voice: [], diary: [{ date: '11-05', title: 'd' }],
        mails: [{ from: 'Air Lumen', subject: 'AL 208 upgrade', time: '11-06 06:10', unread: true }, { from: 'Later', subject: 'not yet', time: '11-06 18:00' }, { from: 'Guess', subject: 'made up', time: '11-06 13:00', src: 'guess' }],
        events: [{ title: 'dentist', date: '11-06', time: '16:30' }, { title: 'flight to Seoul', date: '11-09', time: '17:45' }, { title: 'called off', date: '11-07', cancelled: true }, { title: 'far away', date: '12-20' }],
        money: { tx: [{ who: 'canteen', amount: -6, time: '11-06 12:40' }], orders: [] },
        life: { weather: { here: { place: 'Lyon', date: '11-06', cond: 'cloudy', temp: 7, hi: 9, lo: 3, hours: [{ rain: 20 }] } } },
        koVoice: [{ who: 'Mara → Ren', style: '다정한 존댓말' }], situations: [{ id: 'Flight to Seoul', what: 'Mon 11-09 17:45', state: 'planned', known: 'booked' }, { id: 'old', what: 'done thing', state: 'done' }] });
    const r = L.ensureRoom(m, ['Mara']);
    L.sendLive(m, r.id, '점심 먹었어?', at('2026-11-06T11:40:00Z'));
    r.messages.push({ id: 'a', from: 'Mara', text: 'Juste une quiche.', at: at('2026-11-06T11:41:00Z'), state: 'office · canteen · ~13:15', does: [{ app: 'Bank, cards & wallet', what: 'pays 6 EUR' }] });
    L.sendLive(m, r.id, '치과 다녀왔어', at('2026-11-06T13:00:00Z'));
    return { m, w, r };
}
const ask = (x, o = {}) => G.gatherReply(x.m, 'Mara', x.r.id, { now: at('2026-11-06T13:00:30Z'), tz: 'Europe/Paris', deps, ...o });

test('메신저 대화: 주인이 있는 곳의 시각, 주인 말엔 그때 상태', () => {
    const d = ask(world());
    assert.deepEqual(d.messenger, [{ at: '11-06 12:40', from: 'Ren', text: '점심 먹었어?', state: undefined }, { at: '11-06 12:41', from: 'Mara', text: 'Juste une quiche.', state: 'office · canteen · ~13:15' }, { at: '11-06 14:00', from: 'Ren', text: '치과 다녀왔어', state: undefined }]);
    assert.equal(d.owner, 'Mara');
    assert.equal(d.persona, 'Ren');
});

test('NOW: 마지막 상태, 오늘 · 앞으로의 일정(취소 · 먼 일정 빼고), 폰이 마지막에 남긴 것(지금보다 뒤 · 지어낸 것 · 페르소나 문자 빼고)', () => {
    const d = ask(world());
    assert.deepEqual(d.now, { last: 'office · canteen · ~13:15', today: ['16:30 dentist'], ahead: ['11-09 17:45 flight to Seoul'], recorded: 'bank, cards & wallet 11-06 12:40 canteen -6', story: true, first: false });
    // (no answer from the owner yet: where the phone last had them; the first chat)
    const x = world(); x.r.messages.splice(1, 1);
    const f = ask(x).now;
    assert.equal(f.last, 'Lyon · home');
    assert.equal(f.first, true);
});

test('앱마다 마지막 쓴 때: 폰 기록과 답하며 한 일(does)을 합쳐서', () => {
    const d = ask(world()), text = replyInput(d);
    assert.match(text, /\[RECENT ON THE PHONE\]\nbank, cards & wallet 12:41 · photos 11:10 · messages 08:15 · mail 06:10 · notes 11-05 21:00\n/);
    assert.match(text, /\[WEATHER NOW\]\nLyon · 흐림 · 7° \(최고 9° · 최저 3°\) · 비 확률 20%\n/);
    assert.match(text, /\[SITUATIONS\]\n- Flight to Seoul: Mon 11-09 17:45\. state: planned\. known: booked\.\n\n\[Mara's card\]\nMara is careful with money\.\n\n\[VOICES\]\n- Mara → Ren: 다정한 존댓말\n\n\[PEOPLE AROUND\]/);
    assert.match(text, /\[OWNER'S CLOCK\]\nPhone owner: Mara\nTime now: 11-06 14:00\n/);
    assert.doesNotMatch(text, /old story text|not yet|made up|done thing/);
});

test('날씨가 오늘 것이 아니면 안 보내요; 언어 설정 · 지운 말 · 먼저 연락하는 이유는 있을 때만', () => {
    const x = world();
    x.m.live.world.phones.mara.life.weather.here.date = '11-05';
    x.w.langs = { mara: { texts: ['French'], knows: ['Korean'] } };
    const text = replyInput(ask(x, { typed: ['보고 싶'], why: 'just woke up' }));
    assert.doesNotMatch(text, /WEATHER NOW/);
    assert.match(text, /^\[LANGUAGES\]\nMara\n- texts in: French\n- knows but seldom uses: Korean\n\n\[MESSENGER\]/);
    assert.match(text, /\[TYPED AND DELETED\]\n- 보고 싶\n\n\[WHY NOW\]\njust woke up$/);
});

test('이야기: 끝에서부터 통째 장면만, 정한 길이 안에서', () => {
    const long = Array.from({ length: 60 }, (_, i) => `## #${i * 10}–#${i * 10 + 9} — scene ${i}\n- ${'x'.repeat(300)}`).join('\n\n');
    const d = ask(world(), { deps: { ...deps, story: () => long } });
    assert.ok(d.story.length <= G.LIVE_ASK.story);
    assert.match(d.story, /^## #\d+–#\d+ — scene \d+\n/);
    assert.match(d.story, /scene 59\n- x+$/);
    assert.equal(ask(world(), { deps: { ...deps, story: () => '## #0–#3 — short\n- a' } }).story, '## #0–#3 — short\n- a');
});

test('없는 폰 · 없는 방 · 그 방에 없는 사람이면 아무것도 안 만들고, 폰 1 · 폰 2는 그대로', () => {
    const x = world(), was = JSON.stringify({ ...x.m, live: { ...x.m.live, world: { ...x.w, messenger: { ...x.w.messenger, seq: 0 } } } });
    assert.equal(G.gatherReply(x.m, 'Ivo', x.r.id, { deps }), null);
    assert.equal(G.gatherReply(x.m, 'Mara', 'nope', { deps }), null);
    ask(x);
    assert.equal(JSON.stringify({ ...x.m, live: { ...x.m.live, world: { ...x.w, messenger: { ...x.w.messenger, seq: 0 } } } }), was);
});

test('폰 1은 이 파일을 안 불러요', async () => {
    const src = f => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
    for (const f of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.js') && f !== 'phone2live.js')) assert.doesNotMatch(await src(f), /from '\.\/phone2live\.js'/, f);
});
