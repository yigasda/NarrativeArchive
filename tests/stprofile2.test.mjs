// 서버가 실리 연결 프로필 요청(ConnectionManagerRequestService.sendRequest)을 실리 브라우저와 글자 그대로 보내는지 (plugin/st: 실리 1.19.1
// extensions/shared.js · custom-request.js · textgen-settings.js · instruct-mode.js 등을 옮긴 것, plugin/st/naload.js naLoad · naLoadPresets · naSendRequest).
// 기대값(tests/fixtures/stprofile2-expected.json)은 실리 1.19.1 브라우저 자신의 sendRequest가 보낸 생성 요청과 돌려준 값이에요: tools/st/oracle-profile.mjs가
// 진짜 실리를 띄워 settings.json · 프리셋 파일로 페이지를 열고 만들어요. 토크나이저 · 로짓 바이어스 답(calls)도 그때 진짜 실리 서버가 준 것이에요. 지어낸 값이 아니에요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CASES, callKey } from './stprofile2.cases.mjs';
import { runCase, failures } from './stprofile2.run.mjs';

const EXPECTED = JSON.parse(readFileSync(new URL('./fixtures/stprofile2-expected.json', import.meta.url), 'utf8'));

for (const c of CASES) {
    test(`연결 프로필 요청 = 실리 브라우저: ${c.id}`, async () => {
        const want = EXPECTED.cases[c.id];
        assert.ok(want, `기대값이 없어요: ${c.id} (tools/st/oracle-profile.mjs를 다시 돌려요)`);
        const calls = EXPECTED.calls[c.id] || [];
        const used = [];
        const replay = async (url, init) => {
            const key = callKey(url, init?.body);
            const hit = calls.find(x => x.key === key);
            used.push(key);
            assert.ok(hit, `실리 서버 답이 기록에 없어요: ${key}`);
            return new Response(hit.text, { status: hit.status, headers: { 'Content-Type': 'application/json' } });
        };
        const got = await runCase(c, replay);
        assert.equal(JSON.stringify(got), JSON.stringify(want));
        assert.deepEqual(used, calls.map(x => x.key));
    });
}

test('토큰 답을 받는 길이 실패하면(옛 다리 404) 적어 두고, 실리처럼 그 토큰 없이 만들어요 (일꾼이 보내지 않게)', async () => {
    const c = CASES.find(x => x.id === 'tc-banned-global');
    const got = await runCase(c, async () => new Response('Not Found', { status: 404 }));
    // (SillyTavern's jQuery.ajax calls success only for a 2xx JSON answer: without it the tokens are just missing)
    assert.equal(got.gen.length, 1);
    assert.equal(got.gen[0].body.custom_token_bans, '7,8');
    assert.deepEqual(failures().map(f => [f.url, f.status]), [['/api/tokenizers/llama/encode', 404]]);
});

test('토큰 답을 기다리는 동안에는 생성 요청을 보내지 않아요 (naSendRequest 없이 실리 함수를 바로 부르면 오류)', async () => {
    const { ConnectionManagerRequestService } = await import('../plugin/st/naload.js');
    const { __naSetFetch, naAjaxPending } = await import('../plugin/st/public/naFetch.js');
    const c = CASES.find(x => x.id === 'tc-banned-global');
    await runCase(c, async () => new Response(JSON.stringify({ ids: [1] }), { status: 200 }));
    const sent = [];
    __naSetFetch(async (url) => { sent.push(url); return new Response('{}', { status: 200 }); });
    await assert.rejects(() => ConnectionManagerRequestService.sendRequest(c.profile, c.prompt, c.maxTokens, c.custom),
        err => err.message === 'API request failed' && err.cause?.name === 'NaAjaxWait');
    assert.deepEqual(sent, []);
    assert.deepEqual(naAjaxPending.map(p => p.url), ['/api/tokenizers/llama/encode']);
});
