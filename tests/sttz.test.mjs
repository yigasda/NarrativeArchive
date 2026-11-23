// 시각 매크로 · 로컬 시각 · 기본 언어가 실리 브라우저와 같아요 (plugin/zone.mjs + i18n localeFile, 작업 스레드에서 브라우저가 적은 device로).
// 기대값(tests/fixtures/stmacros-tz-expected.json)은 실리 1.19.1을 Chrome에 시간대 · 언어 · 시계를 고정해 띄우고 실리 자신의 substituteParams로 만든 것이에요
// (tools/st/oracle-tz.mjs, 2026-11-23). 지어낸 값이 아니에요. 서버 컴퓨터의 시간대(TZ)가 무엇이든 같아야 해요.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runServer } from './sttz.run.mjs';
import { CONFIGS } from './sttz.cases.mjs';

const EXPECTED = JSON.parse(fs.readFileSync(new URL('./fixtures/stmacros-tz-expected.json', import.meta.url), 'utf8'));

test('기대값은 경우마다 하나씩 다 있어요', () => {
    assert.deepEqual(EXPECTED.configs.map(c => c.id), CONFIGS.map(c => c.id));
    for (const c of EXPECTED.configs) assert.ok(Object.keys(c.macros).length > 30, c.id);
});

for (const c of EXPECTED.configs) {
    test(`실리 브라우저와 같아요: ${c.id} (${c.timezoneId} · ${c.locale}${c.language ? ` · 화면 ${c.language}` : ''})`, async () => {
        const mine = await runServer(c.device, c.at);
        assert.deepEqual(mine.macros, c.macros);
        assert.deepEqual(mine.env, c.env);
    });
}

test('브라우저가 아직 안 적었으면 서버 컴퓨터의 시간대 · 언어(전과 같아요)', async () => {
    const c = EXPECTED.configs.find(x => x.id === 'en-newyork-before');
    const mine = await runServer(null, c.at);
    const d = new Date(c.at);
    assert.equal(mine.macros['new iso {{isotime}}'], `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    assert.equal(mine.macros.currentLocale, 'en');
    assert.equal(mine.env.zone, Intl.DateTimeFormat().resolvedOptions().timeZone);
});
