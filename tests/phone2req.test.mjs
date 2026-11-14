// 폰 2의 요청 뼈대(phone2req.js)와 작은 채우기(phone2fill.js). 서랍은 진짜(phone2store.js liveMeta), 모델만 가짜예요.
// 옮기기 전의 실시간 갈림이 아직 phonedata.js에 있는 동안은, 같은 서랍으로 두 쪽을 불러 글자 그대로 같은지도 봐요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import { T, PD, Q, F } from './phone2reflect.load.mjs';

const src = f => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
const phone = () => ({ owner: 'Mara', now: '11-12 21:30', year: 2026, country: 'KR', contacts: [], threads: [], calls: [], photos: [], notes: [], searches: [], events: [], posts: [], mails: [], diary: [], voice: [] });
// 이야기에서 시작한 실시간 폰: 롤플 #0~#2까지가 시작 전, #3~#4는 시작 뒤. 메신저에 두 마디(하나는 반영됨)
function world({ fresh = false } = {}) {
    T.chat = ['옛날 이야기 하나', '옛날 이야기 둘', '시작 직전 이야기', '시작 뒤 롤플 하나', '시작 뒤 롤플 둘'].map((mes, i) => ({ name: i % 2 ? 'Mara' : 'Ren', is_user: !(i % 2), mes, extra: {} }));
    T.recent = ['[#1] Mara: 옛날 이야기 둘', '[#2] Ren: 시작 직전 이야기', '[#3] Mara: 시작 뒤 롤플 하나', '[#4] Ren: 시작 뒤 롤플 둘'];
    const real = { phones: { mara: phone() }, text: '' };
    if (fresh) L.startFresh(real, { persona: 'Ren', scope: 'test' }); else L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test', story: { ranges: {}, titles: [], rawFrom: 0, own: [''] } });
    const d = L.liveMeta(real, { now: () => '11-14 16:05' });
    if (fresh) d.phones = { mara: phone() };
    const room = L.ensureRoom(real, ['Mara']);
    const first = L.sendLive(real, room.id, '메신저로 한 말');
    L.sendLive(real, room.id, '아직 반영 안 된 말');
    return { real, d, p: d.phones.mara, first: room.messages[0].n, room };
}
const done = () => { delete T.ask; T.chat = []; delete T.recent; };

test('읽는 범위 · 읽은 자리: 시작한 곳까지만, 뒤는 없음, 표시는 메신저 번호 (옮기기 전 것과 같은 답)', () => {
    try {
        const { d, p, first } = world();
        const g = Q.liveWindowOf(d, p);
        assert.deepEqual([g.upto, g.n, g.later, g.mark], [2, 0, false, 2]);
        assert.deepEqual(g, PD.windowOf(d, p));
        assert.deepEqual(Q.liveReadMark(g), { index: 2, user: -1, fp: '', tail: '' });
        // 반영이 메신저 첫 마디까지 읽은 폰: 표시는 그 번호
        p.sync = { scope: 'x', marks: { base: { index: 2, user: -1, fp: '', tail: '' } }, done: [[first, first]] };
        const g2 = Q.liveWindowOf(d, p);
        assert.equal(g2.mark, first); assert.deepEqual(g2, PD.windowOf(d, p));
        assert.deepEqual(Q.liveReadMark(g2), PD.readMark(g2));
        // 새로 시작한 실시간 폰: 롤플은 하나도 안 읽어요
        const f = world({ fresh: true });
        assert.equal(Q.liveWindowOf(f.d, f.p).upto, -1); assert.deepEqual(Q.liveWindowOf(f.d, f.p), PD.windowOf(f.d, f.p));
        // 서랍이 아니면 멈춰요 (서랍 흉내도)
        assert.throws(() => Q.liveWindowOf(f.real, f.p), /실시간 폰의 서랍이 아니에요/);
        assert.throws(() => Q.liveWindowOf({ ...f.real, phoneUpto: 2 }, f.p), /실시간 폰의 서랍이 아니에요/);
    } finally { done(); }
});

test('요청 글: 시작 전 이야기 + 메신저 대화, 시작 뒤 롤플은 없음; 읽은 자리를 적는 앱은 반영된 대화만 (옮기기 전 것과 글자 그대로 같음)', async () => {
    try {
        const { real, d, p, first } = world(), p1 = JSON.stringify(real.phones);
        const side = await Q.liveSideRequest(d, 'Mara', ['[TARGET]\nx']);
        assert.ok(side.includes('시작 직전 이야기') && side.includes('Ren: 메신저로 한 말') && side.includes('아직 반영 안 된 말'));
        assert.ok(side.indexOf('시작 직전 이야기') < side.indexOf('메신저로 한 말'));
        assert.ok(!side.includes('시작 뒤 롤플'));
        assert.ok(side.includes('[STORY YEAR]\n2026') && side.includes('[OWNER]\nMara') && side.includes('[TARGET]\nx'));
        assert.equal(side, await PD.sideRequest(d, 'Mara', ['[TARGET]\nx']));
        // 읽은 자리를 적는 앱 (투자 처음 채우기 등): 반영이 읽은 대화만 보여요
        p.sync = { scope: 'x', marks: { base: { index: 2, user: -1, fp: '', tail: '' } }, done: [[first, first]] };
        const read = {}, read1 = {};
        const fill = await Q.liveSideRequest(d, 'Mara', ['[TARGET]\nx'], { read });
        assert.ok(fill.includes('메신저로 한 말') && !fill.includes('아직 반영 안 된 말') && fill.includes('시작 직전 이야기') && !fill.includes('시작 뒤 롤플'));
        assert.equal(fill, await PD.sideRequest(d, 'Mara', ['[TARGET]\nx'], { read: read1 }));
        assert.deepEqual(read.gap, read1.gap);
        assert.deepEqual(Q.liveReadMark(read.gap), { index: first, user: -1, fp: '', tail: '' });
        // 돈 요청 · 아카이브 대신 채팅을 읽는 요청도 같은 글
        for (const o of [{ money: true }, { story: 5000 }, { profile: null, money: true, story: 2000 }]) assert.equal(await Q.liveSideRequest(d, 'Mara', ['[A]\n1', '[B]\n2'], o), await PD.sideRequest(d, 'Mara', ['[A]\n1', '[B]\n2'], o));
        // 새로 시작한 실시간 폰
        const f = world({ fresh: true });
        const fs = await Q.liveSideRequest(f.d, 'Mara', ['[TARGET]\nx']);
        assert.ok(fs.includes('메신저로 한 말') && !fs.includes('이야기'));
        assert.equal(fs, await PD.sideRequest(f.d, 'Mara', ['[TARGET]\nx']));
        // 폰 1의 폰은 그대로, 서랍이 아니면 멈춰요
        assert.equal(JSON.stringify(real.phones), p1);
        await assert.rejects(() => Q.liveSideRequest(real, 'Mara', []), /실시간 폰의 서랍이 아니에요/);
    } finally { done(); }
});

test('연도가 없는 실시간 폰의 요청: 연도는 실시간 시계의 것 (phone2year.js)', async () => {
    try {
        const { d, p } = world();
        delete p.year;
        const now = () => '04-11 08:15'; now.year = () => 2027;
        const d27 = L.liveMeta(world().real, { now }); delete d27.phones.mara.year;
        assert.ok((await Q.liveSideRequest(d27, 'Mara', [])).includes('[STORY YEAR]\n2027'));
        // 시계가 연도를 모르면 브라우저의 올해, 연도 표시를 끈 폰은 줄이 없어요
        assert.ok((await Q.liveSideRequest(d, 'Mara', [])).includes(`[STORY YEAR]\n${new Date().getFullYear()}`));
        p.noYear = true;
        assert.ok(!(await Q.liveSideRequest(d, 'Mara', [])).includes('[STORY YEAR]'));
    } finally { done(); }
});

test('기기 정보 채우기: 요청은 실시간 뼈대로, 답은 실시간 폰에만', async () => {
    try {
        const { real, d, p } = world(), p1 = JSON.stringify(real.phones);
        const asked = [];
        T.ask = async (input, o) => { asked.push({ input, system: o.system }); return JSON.stringify({ model: 'Phone X', os: 'OS 1', storage: { total: 128, used: 60 }, battery: 80 }); };
        const dev = await F.liveFillDevice(d, p);
        assert.equal(asked.length, 1);
        assert.equal(asked[0].system, PD.AI_SYS_DEVICE);
        assert.ok(asked[0].input.includes('메신저로 한 말') && !asked[0].input.includes('시작 뒤 롤플') && asked[0].input.includes('[COUNTRY]\nKR'));
        assert.ok(dev && p.device === dev);
        // 이미 있으면 다시 안 물어요
        assert.equal(await F.liveFillDevice(d, p), dev); assert.equal(asked.length, 1);
        assert.equal(JSON.stringify(real.phones), p1);
        await assert.rejects(() => F.liveFillDevice(real, real.phones.mara), /실시간 폰의 서랍이 아니에요/);
        assert.throws(() => F.livePrepareWealth(real, real.phones.mara), /실시간 폰의 서랍이 아니에요/);
        assert.equal(asked.length, 1);
    } finally { done(); }
});

test('폰 2 사본은 폰 1 줄과 정해진 곳만 달라요 (한쪽만 고치면 실패)', async () => {
    const a = await src('phonedata.js'), q = await src('phone2req.js'), f = await src('phone2fill.js');
    const body = (s, start) => { const i = s.indexOf(start), j = s.indexOf('\n}\n', i); assert.ok(i >= 0 && j > i, start); return s.slice(i, j + 2); };
    const line = (s, start) => { const l = s.split('\n').find(x => x.startsWith(start)); assert.ok(l, start); return l; };
    // sideRequest: 뼈대 셋(읽는 범위 · 최근 대화 · 연도)만
    assert.equal(body(q, 'export async function liveSideRequest(').replace('liveSideRequest(', 'sideRequest(').replace('    needLive(m);\n', '').replace('liveWindowOf(m, ph)', 'windowOf(m, ph)')
        .replace('liveRecentText(m, owner, ', 'recentOf(m, owner, ').replace('liveYearBlock(m, ph)', 'yearBlock(m, ph, upto)'), body(a, 'export async function sideRequest('));
    assert.equal(line(q, 'export const liveReadMark').replace('liveReadMark', 'readMark'), line(a, 'export const readMark'));
    // 기기 정보 · 자산 준비: 요청 뼈대만
    assert.equal(body(f, 'export async function liveFillDevice(').replace('liveFillDevice(', 'fillDevice(').replace('    needLive(m);\n', '').replace('liveSideRequest(', 'sideRequest('), body(a, 'export async function fillDevice('));
    assert.equal(line(f, 'export const livePrepareWealth').replace('livePrepareWealth', 'prepareWealth').replace('ensureWealth(needLive(m),', 'ensureWealth(m,').replace('liveSideRequest(', 'sideRequest('), line(a, 'export const prepareWealth'));
    const api = await src('phone2api.js');
    assert.ok(api.includes('fillDevice: split(fillDevice, liveFillDevice)') && api.includes('prepareWealth: split(prepareWealth, livePrepareWealth)'));
});
