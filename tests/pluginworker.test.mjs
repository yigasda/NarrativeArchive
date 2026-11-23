// 일꾼(plugin/worker.mjs)의 처리 안 된 오류: 일꾼은 멈추지 않고, 실리 창에는 첫 줄만 한 번 (오류에 답 몸통이 들어 있어도 찍지 않아요).
// 진짜 일꾼 파일을 작업 스레드로 띄우고, 그 스레드에서 아무도 기다리지 않는 Promise를 실패시켜요. 예시 이름만 써요.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import { stUserDirs } from './stbridge.mjs';

test('일꾼의 처리 안 된 오류: 멈추지 않고, 실리 창에 첫 줄만 한 번 (오류의 나머지 줄 · 붙은 답 몸통은 찍지 않아요)', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'na-worker-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    await stUserDirs(root);
    const entry = pathToFileURL(path.join(import.meta.dirname, '..', 'plugin', 'worker.mjs')).href;
    const code = `
        const { parentPort } = require('node:worker_threads');
        import(${JSON.stringify(entry)}).catch(() => {});
        const fail = n => Promise.reject(Object.assign(new Error('Ren reply failed\\nbody: {"said":"REPLY-BODY-' + n + '"}'), { body: 'ATTACHED-BODY-' + n }));
        setTimeout(() => { fail(1); fail(2); setTimeout(() => parentPort.postMessage({ done: true }), 300); }, 500);
    `;
    const w = new Worker(code, { eval: true, workerData: { root, bridge: null, schedule: false }, stderr: true, stdout: true });
    let err = '', exited = false;
    w.stderr.on('data', c => { err += c; });
    w.stdout.on('data', () => {});
    w.on('exit', () => { exited = true; });
    // (the store calls the worker makes: never answered here, the worker just waits)
    await new Promise((ok, no) => {
        const timer = setTimeout(() => no(new Error(`일꾼이 끝나지 않았어요: ${err}`)), 20000);
        w.on('message', m => { if (m?.done) { clearTimeout(timer); ok(); } });
        w.on('error', e => { clearTimeout(timer); no(e); });
    });
    await new Promise(r => setTimeout(r, 100));
    assert.equal(exited, false, '일꾼이 멈췄어요');
    const lines = err.split('\n').filter(l => l.includes('Ren reply failed'));
    assert.deepEqual(lines, ['[narrative-archive plugin] 처리되지 않은 오류가 발생했습니다: Error: Ren reply failed'], err);
    assert.ok(!err.includes('REPLY-BODY') && !err.includes('ATTACHED-BODY'), err);
    await w.terminate();
});
