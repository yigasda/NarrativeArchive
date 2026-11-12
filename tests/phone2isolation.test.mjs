// 폰 2 함정 시험 (단계 3): the files that drive 폰 1 through the fake model (reflection rounds, 되돌리기 · 복구 ·
// 빼기, making phones, fills, clocks) run again with a marked 폰 2 beside every meta (tests/phone2poison.mjs). Each
// must pass as it does alone: 폰 1 never reads, sends, copies or changes 폰 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// (each file with about how many tests, calls into phonedata and metas it has, so a file that stopped running most of them is caught)
for (const [f, least, calls, metas] of [['phonesyncdrop', 50, 100, 10], ['archivedread', 50, 100, 10], ['afterarchive', 50, 100, 10], ['phonebranch', 7, 15, 5]]) {
    test(`폰 2 함정: ${f} passes with a 폰 2 beside every meta`, () => {
        const r = spawnSync(process.execPath, ['--test', fileURLToPath(new URL(`./${f}.test.mjs`, import.meta.url))], { env: { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_TEST_CONTEXT')), PHONE2_POISON: '1' }, encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 28 });
        const fail = /^# fail (\d+)/m.exec(r.stdout)?.[1], pass = /^# pass (\d+)/m.exec(r.stdout)?.[1], count = /PHONE2_POISON calls=(\d+) metas=(\d+)/.exec(r.stdout + r.stderr);
        const why = [...new Set(r.stdout.split('\n').filter(l => l.includes('폰 2 함정')).map(l => l.trim()))].slice(0, 3).join('\n');
        assert.equal(fail, '0', `${f}: ${fail} failed\n${why}`);
        assert.ok(Number(pass) >= least, `${f}: only ${pass} ran`);
        // (it really ran poisoned: calls into phonedata, metas given a 폰 2)
        assert.ok(count && Number(count[1]) > calls && Number(count[2]) > metas, `${f}: not poisoned (${count?.[0] || 'no report'})`);
    });
}
