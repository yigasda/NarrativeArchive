// 폰 2 메신저의 오래된 대화 요약: 300개 쌓이면 오래된 260개를 요약, 나머지 40개는 원문 그대로. 요약이 길어지면 다시 줄여요
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import * as D from '../src/phone2digest.js';
import { G, T } from './phone2reflect.load.mjs';

const T0 = Date.parse('2026-11-11T01:00:00Z');
// a 폰 2 with Mara's phone and her room with Ren (the persona), `n` messages said in turn, a minute apart
function world(n) {
    const real = { phones: { mara: { owner: 'Mara', notes: [{ title: '폰 1' }] } }, text: 'STORY ARCHIVE' };
    L.startFresh(real, { persona: 'Ren', scope: 'test' });
    L.liveMeta(real).phones = { mara: { owner: 'Mara', contacts: [], threads: [], calls: [], photos: [], notes: [], searches: [], events: [], posts: [], mails: [], diary: [], voice: [] } };
    const room = L.ensureRoom(real, ['Mara']), w = L.liveWorld(real);
    const add = k => { for (let i = 0; i < k; i++) { const no = L.liveNo(w); room.messages.push({ id: `m${no}`, n: no, from: no % 2 ? 'Ren' : 'Mara', text: `말 ${no}`, at: T0 + no * 60_000 }); } };
    add(n);
    Object.assign(T, { answers: [], moneyAnswers: [], replies: [], digests: [], calls: 0, replyCalls: 0, digestCalls: 0, digestInput: '', saves: 0 });
    return { real, room, w, add, p: L.livePhone(real, 'Mara') };
}
const SECTIONS = (a, b) => `## #${a}–#${b} — 긴 수다\n- 둘이 이런저런 얘기를 했다 (#${a}).\n- 약속을 잡았다 (#${b}).`;

test('299개까지는 요약 안 해요. 300개가 되면 오래된 260개만, 나머지 40개는 원문으로 남아요', () => {
    const c = world(299);
    assert.equal(D.digestChunk(c.room), null);
    c.add(1);
    const chunk = D.digestChunk(c.room);
    assert.deepEqual([chunk.from, chunk.to, chunk.rows.length], [1, 260, 260]);
    assert.ok(D.takeDigest(c.room, chunk, SECTIONS(1, 260)));
    assert.equal(c.room.digest.upto, 260);
    assert.deepEqual(D.undigested(c.room).map(x => x.n), Array.from({ length: 40 }, (_, i) => 261 + i));
    // not again until 300 more wait
    assert.equal(D.digestChunk(c.room), null);
    c.add(259); assert.equal(D.digestChunk(c.room), null);
    c.add(1); assert.deepEqual([D.digestChunk(c.room).from, D.digestChunk(c.room).to], [261, 520]);
});

test('말 없이 폰으로만 한 일은 대화 수에 안 세요. 원문은 한 줄에 한 마디, 통화 · 폰으로 한 일도', () => {
    const c = world(4);
    c.room.messages.push({ id: 'act', n: L.liveNo(c.w), from: 'Mara', text: '', act: true, at: T0 + 9e5, does: [{ app: 'Search', what: '리옹 날씨' }] });
    c.room.messages.push({ id: 'call', n: L.liveNo(c.w), from: 'Ren', text: '', at: T0 + 96e4, call: { min: 12, summary: '사과했다' } });
    c.room.messages[1].does = [{ app: 'Bank', what: '32,000원 송금' }];
    assert.equal(D.undigested(c.room).length, 5);
    assert.equal(D.digestRaw(c.w, D.undigested(c.room), 'Asia/Seoul'), [
        '[1] Ren (11-11 10:01): 말 1', '[2] Mara (11-11 10:02): 말 2', '[2] Mara did on their phone (Bank): 32,000원 송금',
        '[3] Ren (11-11 10:03): 말 3', '[4] Mara (11-11 10:04): 말 4', '[6] Ren (11-11 10:16): (call, 12 min: 사과했다)'].join('\n'));
});

test('답에서 장면만 남겨요: 제목 줄 · --- 뒤의 상태 칸 · 코드 울타리는 버려요. 장면이 없으면 실패로 적어요', () => {
    assert.equal(D.digestText('# A × B — Context Archive\n_note_\n\n## #1–#5 — 하나\n- x\n\n---\n# STATE AT #5\n- y'), '## #1–#5 — 하나\n- x');
    assert.equal(D.digestText('```\n## #1–#5 — 하나\n- x\n```'), '## #1–#5 — 하나\n- x');
    assert.equal(D.digestText('죄송해요, 못 하겠어요'), '');
    const c = world(300), chunk = D.digestChunk(c.room);
    assert.equal(D.takeDigest(c.room, chunk, '거절', T0), null);
    assert.equal(c.room.digest.upto, -1); assert.ok(c.room.digest.failed.why);
    // a failed try waits for new talk (20 more) or an hour
    assert.equal(D.digestChunk(c.room, T0 + 1000), null);
    assert.ok(D.digestChunk(c.room, T0 + D.DIGEST.waitMs));
    c.add(20); assert.ok(D.digestChunk(c.room, T0 + 1000));
});

test('요약의 요약: 방의 요약이 5,000토큰을 넘으면 오래된 절반을 한 장면으로 줄여요. 가장 새 부분은 그대로, 줄인 것도 나중에 또 줄여요', () => {
    const c = world(0), part = (n, len) => `## #${n}–#${n + 259} — 구간\n- ${'가'.repeat(len)}`;
    const more = len => { c.add(300 - D.undigested(c.room).length); const ch = D.digestChunk(c.room); return D.takeDigest(c.room, ch, part(ch.from, len)); };
    more(2000); assert.equal(D.foldChunk(c.room), null);          // one part: nothing to fold
    more(2000); assert.equal(D.foldChunk(c.room), null);          // 4,000토큰쯤: not long yet
    more(2000);                                                   // 6,000토큰쯤: over 5,000
    const ch = D.foldChunk(c.room);
    assert.deepEqual([ch.parts.length, ch.from, ch.to], [2, 1, 520]);
    assert.equal(D.foldRequest(ch, '\n\n[LANG]'), `SECTIONS:\n${ch.src}\n\nTARGET: 1200\n\n[LANG]`);
    const newest = c.room.digest.parts.at(-1);
    assert.ok(D.takeFold(c.room, ch, '## #1–#520 — 줄인 것\nPLOT:\n- 짧게.'));
    assert.deepEqual(c.room.digest.parts.map(p => [p.from, p.to, !!p.folded]), [[1, 520, true], [521, 780, false]]);
    assert.equal(c.room.digest.parts.at(-1), newest); assert.equal(c.room.digest.upto, 780);
    assert.ok(D.digestOf(c.room).startsWith('## #1–#520 — 줄인 것'));
    // later, the fold itself is folded with what came after it
    more(3000); more(3000);
    const again = D.foldChunk(c.room);
    assert.equal(again.from, 1); assert.ok(again.parts[0].folded && again.parts.length >= 2);
    // an answer with no section, or no shorter: left as it was, tried again later
    const before = JSON.stringify(c.room.digest.parts);
    assert.equal(D.takeFold(c.room, again, '못 해요', T0), null);
    assert.equal(JSON.stringify(c.room.digest.parts), before);
    assert.equal(D.foldChunk(c.room, T0 + 1000), null);
    assert.ok(D.foldChunk(c.room, T0 + D.DIGEST.waitMs));
});

test('메신저를 나갈 때: 요약 요청은 짧은 압축 지시문 + 메신저 원문, 이야기 아카이브는 안 건드려요. 답장 요청은 요약 + 남은 원문', async () => {
    const c = world(300), story = c.real.text, p1 = JSON.stringify(c.real.phones);
    T.digests = [SECTIONS(1, 260)]; T.answers = [{ events: [] }, { events: [] }, { events: [] }];
    assert.equal((await G.liveReflect(c.real, 'Mara')).error, '');
    assert.equal(T.digestCalls, 1);
    assert.match(T.digestInput, /^<raw_log range="#1–#260">\n\[1\] Ren \(\d\d-\d\d \d\d:\d\d\): 말 1\n/);
    assert.ok(T.digestInput.includes('[260] Mara') && !T.digestInput.includes('[261]'));
    assert.ok(T.digestInput.includes(D.DIGEST_STATE) && T.digestInput.includes('DIGEST RULES #1–#260'));
    assert.equal(c.room.digest.upto, 260);
    assert.equal(c.real.text, story); assert.equal(c.real.boundary, undefined); assert.equal(JSON.stringify(c.real.phones), p1);
    // leaving again: nothing due, no call
    await G.liveReflect(c.real, 'Mara');
    assert.equal(T.digestCalls, 1);
    // the reply request: the summary, then the 40 left as they were said (and the new one)
    L.sendLive(c.real, c.room.id, '새 말'); L.enqueueReplies(c.real, c.room.id);
    T.replies = [{ state: '집', reply: ['응'], does: [] }];
    await G.liveGo(c.real);
    assert.match(T.replyInput, /\[CHAT SUMMARY\]\n## #1–#260 — 긴 수다\n/);
    const talk = T.replyInput.split('[MESSENGER]\n')[1].split('\n\n')[0].split('\n');
    assert.equal(talk.length, 41);
    assert.ok(talk[0].endsWith(': 말 261') && talk.at(-1).endsWith('Ren: 새 말'));
});

test('토큰은 아카이브 압축이 세는 대로: 한글 한 글자 1, 나머지는 3.6자에 1', () => {
    assert.equal(D.digestTok('가나다'), 3); assert.equal(D.digestTok('abcdefg'), 2); assert.equal(D.digestTok(''), 0);
});

test('메신저를 나갈 때 길어진 요약도 줄여요 (다이제스트 지시문, 한 번에 한 방)', async () => {
    const c = world(300);
    c.room.digest = { upto: 0, parts: [{ from: -520, to: -261, at: 1, text: `## 옛 것 하나\n- ${'가'.repeat(3000)}` }, { from: -260, to: 0, at: 2, text: `## 옛 것 둘\n- ${'나'.repeat(3000)}` }] };
    T.compress = [];
    T.digests = [`<scenes>\n## not a section\n</scenes>\n${SECTIONS(1, 260)}`]; T.folds = ['<think>hm</think>## 옛 것 — 줄임\nPLOT:\n- 짧게.']; T.answers = [{ events: [] }, { events: [] }, { events: [] }];
    await G.liveReflect(c.real, 'Mara');
    assert.equal(T.digestCalls, 1); assert.equal(T.foldCalls, 1);
    // (both asked the way the archive's compression is asked; the answer's thinking and scene list are taken off)
    assert.deepEqual(T.compress, [{ system: '', guard: true }, { system: 'FOLD SYS', guard: false }]);
    assert.ok(T.foldInput.startsWith('SECTIONS:\n## 옛 것 하나') && T.foldInput.includes('TARGET: 1200'));
    assert.deepEqual(c.room.digest.parts.map(p => [p.from, p.to, !!p.folded]), [[-520, 0, true], [1, 260, false]]);
    assert.equal(c.room.digest.parts.at(-1).to, 260);
    assert.ok(c.room.digest.parts.at(-1).text.startsWith('## #1–#260') && c.room.digest.parts[0].text.startsWith('## 옛 것 — 줄임'));
});

test('요약이 실패해도 답장 · 반영은 그대로예요. 다음에 다시 해요', async () => {
    const c = world(300);
    T.digests = [new Error('모델이 막았어요')]; T.answers = [{ events: [] }, { events: [] }, { events: [] }];
    const r = await G.liveReflect(c.real, 'Mara');
    assert.equal(r.error, ''); assert.equal(r.rounds, 3); assert.equal(r.left, 0);
    assert.match(c.room.digest.failed.why, /모델이 막았어요/); assert.equal(c.room.digest.upto, -1);
    // (no summary yet: the request carries the talk itself)
    L.sendLive(c.real, c.room.id, '새 말'); L.enqueueReplies(c.real, c.room.id);
    T.replies = [{ state: '집', reply: ['응'], does: [] }];
    await G.liveGo(c.real);
    assert.ok(!T.replyInput.includes('[CHAT SUMMARY]'));
    assert.ok(T.replyInput.includes(': 말 1\n'));
});

test('실제 짧은 압축 지시문에 네 자리가 그대로 있어요. 폰 1은 이 파일을 안 불러요', async () => {
    const src = await readFile(new URL('../src/prompts.js', import.meta.url), 'utf8'), a = src.indexOf('export const SHORT_PROMPT = `'), tpl = src.slice(a, src.indexOf('`;', a));
    for (const k of ['{{from}}', '{{to}}', '{{raw}}', '{{state}}']) assert.ok(tpl.includes(k), k);
    assert.ok(tpl.includes('<current_state>') && /If <current_state> is empty/.test(tpl));
    const dg = await readFile(new URL('../src/digest.js', import.meta.url), 'utf8');
    assert.ok(dg.includes('export const AI_SYS_DIGEST = `') && dg.includes('- SECTIONS: the sections in order') && dg.includes('- TARGET: the most tokens the digest may use'));
    for (const f of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.js') && !['phone2digest.js', 'phone2live.js', 'phone2go.js'].includes(f))) assert.doesNotMatch(await readFile(new URL(`../src/${f}`, import.meta.url), 'utf8'), /phone2digest/, f);
    assert.doesNotMatch(await readFile(new URL('../src/phone2digest.js', import.meta.url), 'utf8'), /from '\.\/(?!phone2store\.js|phone2clock\.js)/);
});

test('실제 지시문 꺼내기(시험용): 짧은 압축 지시문 · 다이제스트 지시문이 글자 그대로 나와요', async () => {
    const R = await import('./phone2digest.real.mjs'), s = await R.shortPrompt(), d = await R.digestSystem();
    assert.ok(s.startsWith('<raw_log range="#{{from}}–#{{to}}">\n{{raw}}\n</raw_log>') && s.includes('`---`') && !s.includes('\\`'));
    assert.ok(d.startsWith('GOAL\nCondense a run of story-archive sections') && d.endsWith('no comments.'));
    assert.equal(R.fillPrompt('a {{from}} {{raw}}', { from: '1', raw: 'x' }), 'a 1 x');
});
