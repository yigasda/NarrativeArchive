// 화면 창구(P): 이름이 빠지거나, 타임라인 쪽이 같은 이름의 폰 1 함수가 아니면 실패해요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const SRC = new URL('../src/', import.meta.url);
const NAMES = ['preparePhone', 'makePhone', 'rereadPlaces', 'fillMoney', 'retryMoney', 'fillVoice', 'fillDevice', 'fillLife', 'fillDelivery', 'fillScreen', 'refreshNearby',
    'learnVoices', 'pickVoices', 'takePhoto', 'writeEntry', 'makeDraft', 'recordVoice', 'prepareWealth', 'collectInvestmentRecords', 'fillInvestment', 'fillChartHistory',
    'refreshMarket', 'refreshBankFX', 'investmentDate', 'storyNow', 'nowOn', 'yearOn', 'statusAt', 'storyYear', 'setStoryYear', 'ensureYear', 'settleBranch', 'phoneBlock'];

test('P: 화면이 부르는 이름이 다 있고, 타임라인 쪽은 폰 1 파일에서 가져온 그 함수예요', async () => {
    const src = await readFile(new URL('phone2api.js', SRC), 'utf8');
    const imported = new Set([...src.matchAll(/import \{([^}]*)\} from '\.\/(?:phonedata|investdata|phoneai|phonelife|phonetr)\.js'/g)].flatMap(m => m[1].split(',').map(s => s.trim()).filter(Boolean)));
    const body = src.slice(src.indexOf('export const P = Object.freeze({'), src.lastIndexOf('});'));
    // (an entry is a name; name: split(name, live…) once its 실시간 side has moved to a phone2 file; or name: nameP, the
    // same for the ones that are not async; nowOn is the gateway's own: 타임라인 is storyNow(p))
    const entries = body.split('\n').filter(l => !/^\s*\/\//.test(l)).join(' ').replace(/^.*?\{/, '').replace(/split\((\w+), \w+(?:, \d)?\)/g, '=$1').split(',').map(s => s.trim()).filter(Boolean);
    const listed = new Set(entries.map(e => e.split(':')[0].trim()));
    assert.deepEqual([...listed].sort(), [...NAMES].sort());
    for (const e of entries.filter(e => e.includes(':'))) assert.match(e, /^(\w+): (=\1|\1P)$/, e);
    // (nowOn · yearOn은 창구의 것: 폰 1 파일에 그런 함수는 없어요)
    for (const n of NAMES.filter(n => n !== 'nowOn' && n !== 'yearOn')) assert.ok(imported.has(n), n);
    assert.ok(!imported.has('nowOn') && !imported.has('yearOn'));
    // 창구는 폰 1 파일을 읽기만 해요: 폰 1 파일이 창구를 부르면 안 돼요
    for (const f of ['phonedata.js', 'investdata.js', 'phoneai.js', 'phonelife.js', 'phonetr.js', 'phonesync.js']) assert.ok(!(await readFile(new URL(f, SRC), 'utf8')).includes('phone2api'), f);
});

// 창구를 가짜 폰 1 함수(부른 이름과 인자를 돌려줌)와 진짜 서랍으로 불러 봐요
async function loadP() {
    const srcs = await readFile(new URL('phone2api.js', SRC), 'utf8'), enc = t => 'data:text/javascript;base64,' + Buffer.from(t).toString('base64');
    const fakes = {};
    for (const m of srcs.matchAll(/import \{([^}]*)\} from '(\.\/(?:phonedata|investdata|phoneai|phonelife|phonetr|phone2act|phone2year|phone2note|phone2fill|phone2invest|phone2voice|phone2money|phone2life|phone2where|phone2make)\.js)'/g))
        fakes[m[2]] = enc(m[1].split(',').map(x => x.trim()).filter(Boolean).map(n => `export const ${n}=(...a)=>({fn:'${n}',a});`).join(''));
    fakes['./phone2store.js'] = new URL('phone2store.js', SRC).href;
    return (await import(enc(srcs.replace(/from '([^']+)'/g, (all, k) => `from '${fakes[k] || k}'`)))).P;
}

test('P의 지금 · 상태창: 타임라인은 폰 1 함수를 받은 인자 그대로, 실시간은 흐르는 시계 · 상태창 없음', async () => {
    const P = await loadP(), L = await import('../src/phone2store.js');
    const real = { phones: { mara: { owner: 'Mara', now: '10-25 17:42' } }, text: '' };
    L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test', story: { ranges: {}, titles: [], rawFrom: 0, own: [''] } });
    const p1 = real.phones.mara, d = L.liveMeta(real, { now: () => '11-14 16:05' }), q = d.phones.mara, still = L.liveMeta(real);
    q.now = '11-12 21:30';
    // 타임라인: 폰 1 함수, 인자 그대로 (nowOn은 예전 화면처럼 storyNow(p)만)
    assert.deepEqual(P.nowOn(p1, real), { fn: 'storyNow', a: [p1] });
    assert.deepEqual(P.nowOn(p1), { fn: 'storyNow', a: [p1] });
    assert.deepEqual(P.storyNow(p1), { fn: 'storyNow', a: [p1] });
    assert.deepEqual(P.storyNow(p1, 7, real), { fn: 'storyNow', a: [p1, 7, real] });
    assert.deepEqual(P.statusAt(p1), { fn: 'statusAt', a: [p1] });
    assert.deepEqual(P.statusAt(p1, 3, real), { fn: 'statusAt', a: [p1, 3, real] });
    // (서랍 흉내만 낸 메타는 타임라인이에요)
    assert.deepEqual(P.nowOn(p1, { ...real, phoneUpto: 2, phoneNow: () => '01-01 00:00' }), { fn: 'storyNow', a: [p1] });
    // 실시간: 서랍의 흐르는 시계
    assert.equal(P.nowOn(q, d), '11-14 16:05'); assert.equal(P.storyNow(q, null, d), '11-14 16:05'); assert.equal(P.storyNow(q, 9, d), '11-14 16:05');
    // 실시간 폰인데 서랍을 안 줬거나 서랍에 시계가 없으면: 폰에 저장된 시각
    assert.equal(P.storyNow(q), '11-12 21:30'); assert.equal(P.nowOn(q), '11-12 21:30'); assert.equal(P.nowOn(still.phones.mara, still), '11-12 21:30');
    // 실시간 폰에는 롤플 상태창이 없어요
    assert.equal(P.statusAt(q), null); assert.equal(P.statusAt(q, null, d), null);
    // 폰 1의 폰은 그대로
    assert.equal(p1.now, '10-25 17:42');
});

test('P의 연도: 타임라인은 폰 1 함수를 받은 인자 그대로, 실시간 서랍이면 폰 2 것; 실시간 폰을 서랍 없이 주면 멈춰요', async () => {
    const P = await loadP(), L = await import('../src/phone2store.js');
    const real = { phones: { mara: { owner: 'Mara', now: '10-25 17:42', year: 2026 } }, text: '' };
    L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test', story: { ranges: {}, titles: [], rawFrom: 0, own: [''] } });
    const p1 = real.phones.mara, d = L.liveMeta(real), q = d.phones.mara, copy = { ...q, year: 0 };
    // 타임라인
    assert.deepEqual(P.storyYear(real, p1), { fn: 'storyYear', a: [real, p1] });
    assert.deepEqual(P.storyYear(real, p1, 4), { fn: 'storyYear', a: [real, p1, 4] });
    assert.deepEqual(P.ensureYear(real, p1), { fn: 'ensureYear', a: [real, p1] });
    assert.deepEqual(P.setStoryYear(real, p1, 2030), { fn: 'setStoryYear', a: [real, p1, 2030] });
    // 실시간 (화면이 폰을 복사해서 줘도 서랍으로 갈라요)
    assert.equal(P.storyYear(d, copy).fn, 'liveStoryYear'); assert.equal(P.storyYear(d, copy).a[1], copy);
    assert.equal(P.ensureYear(d, q).fn, 'liveEnsureYear'); assert.equal(P.ensureYear(d, q).a[1], q);
    const set = P.setStoryYear(d, q, 2030); assert.equal(set.fn, 'liveSetStoryYear'); assert.equal(set.a[0], d); assert.equal(set.a[1], q); assert.equal(set.a[2], 2030);
    // 화면에 보이는 연도: 타임라인은 폰의 연도 그대로(없으면 없는 대로), 실시간 서랍이면 폰 2의 것
    assert.equal(P.yearOn(p1, real), 2026); assert.equal(P.yearOn(p1), 2026); assert.equal(P.yearOn({ owner: 'X' }, real), undefined); assert.equal(P.yearOn(null, real), undefined);
    assert.equal(P.yearOn(q), q.year);
    assert.deepEqual(P.yearOn(q, d), { fn: 'liveShownYear', a: [d, q] });
    // 실시간 폰 + 폰 1의 메타: 폰 1 함수를 부르지 않고 멈춰요
    for (const run of [() => P.storyYear(real, q), () => P.ensureYear(real, q), () => P.setStoryYear(real, q, 2030), () => P.investmentDate(real, q)]) assert.throws(run, /실시간 폰은 실시간 화면에서만 사용할 수 있습니다/);
});

test('P: 실시간 서랍에 타임라인의 폰을 주면(화면을 바꾸는 틈에 걸린 요청) 폰 2 함수를 부르지 않고 멈춰요', async () => {
    const P = await loadP(), L = await import('../src/phone2store.js');
    const real = { phones: { mara: { owner: 'Mara', now: '10-25 17:42', year: 2026 } }, phonePre: { ivo: { owner: 'Ivo', making: true } }, text: '' };
    L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test', story: { ranges: {}, titles: [], rawFrom: 0, own: [''] } });
    const p1 = real.phones.mara, pre1 = real.phonePre.ivo, d = L.liveMeta(real), q = d.phones.mara, before = JSON.stringify(real.phones);
    assert.notEqual(q, p1);
    for (const p of [p1, pre1]) {
        for (const name of ['fillDevice', 'fillMoney', 'fillVoice', 'fillLife', 'fillDelivery', 'fillScreen', 'refreshNearby', 'rereadPlaces', 'takePhoto', 'writeEntry', 'makeDraft', 'recordVoice', 'prepareWealth', 'collectInvestmentRecords', 'fillInvestment', 'fillChartHistory', 'refreshMarket', 'refreshBankFX'])
            await assert.rejects(() => P[name](d, p), /타임라인 폰은 타임라인 화면에서만 사용할 수 있습니다/, name);
        for (const name of ['learnVoices', 'pickVoices']) await assert.rejects(() => P[name](d, 'Mara', p), /타임라인 폰은 타임라인 화면에서만 사용할 수 있습니다/, name);
        assert.throws(() => P.setStoryYear(d, p, 2030), /타임라인 폰은 타임라인 화면에서만 사용할 수 있습니다/);
    }
    assert.equal(JSON.stringify(real.phones), before);
    // 실시간의 폰, 화면이 만든 빈 초안(어느 쪽 것도 아닌 객체), 폰의 복사본은 전처럼 폰 2 함수로
    assert.equal((await P.fillDevice(d, q)).fn, 'liveFillDevice');
    assert.equal((await P.fillDevice(d, { owner: 'Mara', profileDraft: true })).fn, 'liveFillDevice');
    assert.equal((await P.fillDevice(d, { ...p1 })).fn, 'liveFillDevice');
    // 실시간에서 만드는 중인 폰(실시간 서랍의 것)도 전처럼
    d.phonePre = { lio: { owner: 'Lio', making: true } };
    assert.equal((await P.rereadPlaces(d, d.phonePre.lio)).fn, 'liveRereadPlaces');
    // 타임라인은 그대로
    assert.deepEqual(await P.fillDevice(real, p1), { fn: 'fillDevice', a: [real, p1] });
    // 서랍이 아닌 것에는 답하지 않아요
    assert.equal(L.isStoryPhone(real, p1), false); assert.equal(L.isStoryPhone(d, null), false); assert.equal(L.isStoryPhone(d, q), false); assert.equal(L.isStoryPhone(d, p1), true);
});

test('P의 롤플에 넣기: 폰 1의 글은 폰 1 함수에 메타만 줘서, 그 뒤에 실시간 폰의 글', async () => {
    const src = await readFile(new URL('phone2api.js', SRC), 'utf8');
    assert.ok(src.includes('const phoneBlockP = (m, live = null) => phoneBlock(m) + liveNote(live);'));
    assert.ok(src.includes('phoneBlock: phoneBlockP,'));
});

test('P의 분기 알아채기: 폰 1의 폰은 폰 1 함수를 받은 인자 그대로, 실시간 서랍 · 실시간 폰은 폰 1 함수를 안 불러요', async () => {
    const P = await loadP(), L = await import('../src/phone2store.js');
    const real = { phones: { mara: { owner: 'Mara', now: '10-25 17:42' } }, text: '' };
    L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test', story: { ranges: {}, titles: [], rawFrom: 0, own: [''] } });
    const p1 = real.phones.mara, d = L.liveMeta(real), q = d.phones.mara;
    assert.deepEqual(await P.settleBranch(real, p1), { fn: 'settleBranch', a: [real, p1] });
    assert.equal(await P.settleBranch(d, q), null); assert.equal(await P.settleBranch(real, q), null); assert.equal(await P.settleBranch(d, p1), null);
});

test('P의 결제 다시 읽기: 폰 1은 폰 1 함수 그대로, 실시간 서랍이면 폰 1 함수를 안 부르고 알려 줘요', async () => {
    const P = await loadP(), L = await import('../src/phone2store.js');
    const real = { phones: { mara: { owner: 'Mara', now: '10-25 17:42' } }, text: '' };
    L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test', story: { ranges: {}, titles: [], rawFrom: 0, own: [''] } });
    assert.deepEqual(await P.retryMoney(real, 'Mara'), { fn: 'retryMoney', a: [real, 'Mara'] });
    await assert.rejects(() => P.retryMoney(L.liveMeta(real), 'Mara'), /실시간 폰은 다음 반영 때 결제를 다시 읽습니다/);
});

test('P의 폰 만들기 준비: 폰 1은 폰 1 함수 그대로, 실시간 서랍이면 폰 2의 것 (폰 1 함수를 안 불러요)', async () => {
    const P = await loadP(), L = await import('../src/phone2store.js');
    const real = { phones: { mara: { owner: 'Mara', now: '10-25 17:42' } }, text: '' };
    L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test', story: { ranges: {}, titles: [], rawFrom: 0, own: [''] } });
    assert.deepEqual(await P.preparePhone(real, 'Ivo', { again: false }), { fn: 'preparePhone', a: [real, 'Ivo', { again: false }] });
    const d = L.liveMeta(real);
    assert.deepEqual(await P.preparePhone(d, 'Ivo', { again: true }), { fn: 'livePreparePhone', a: [d, 'Ivo', { again: true }] });
});
