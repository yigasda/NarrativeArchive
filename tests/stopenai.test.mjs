// 서버가 실리 채팅 완성 요청 몸통을 실리 브라우저와 글자 그대로 만드는지 (plugin/st: 실리 1.19.1 openai.js createGenerationParameters 등을 옮긴 것).
// 기대값(tests/fixtures/stopenai-expected.json)은 실리 1.19.1 브라우저 자신의 createGenerationParameters가 낸 값이에요: tools/st/oracle-cc.mjs가
// 진짜 실리를 띄워서 만들고, 그 자리에서 서버 것과 대 봐요(로짓 바이어스 경우도). 지어낸 값이 아니에요. 예시 캐릭터만.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CASES } from './stopenai.cases.mjs';
import { runCase, failures } from './stopenai.run.mjs';

const EXPECTED = JSON.parse(readFileSync(new URL('./fixtures/stopenai-expected.json', import.meta.url), 'utf8'));

for (const c of CASES.filter(x => !x.bias)) {
    test(`채팅 완성 요청 몸통 = 실리 브라우저: ${c.id}`, async () => {
        const got = await runCase(c);
        const want = EXPECTED[c.id];
        assert.ok(want, `기대값이 없어요: ${c.id} (tools/st/oracle-cc.mjs를 다시 돌려요)`);
        // (an error the JavaScript engine words itself — new URL('not a url') — reads differently in Chrome and in Node: both throw)
        if (c.id === 'proxy-bad-url') { assert.ok(got.error && want.error, JSON.stringify(got)); return; }
        assert.equal(JSON.stringify(got), JSON.stringify(want));
    });
}

test('로짓 바이어스: 실리 서버의 처리기로 가는 길이 없거나(옛 다리 404) 실패하면 적어 둬요 (일꾼이 그 요청을 안 보내게)', async () => {
    const c = CASES.find(x => x.id === 'bias');
    const got = await runCase(c, async () => new Response('Not Found', { status: 404 }));
    // (SillyTavern's own calculateLogitBias swallows the failure and sends without bias: the record is what stops it here)
    assert.equal(got.generate_data.logit_bias, undefined);
    assert.deepEqual(failures().map(f => [f.url.split('?')[0], f.status]), [['/api/backends/chat-completions/bias', 404]]);
    const ok = await runCase(c, async () => new Response(JSON.stringify({ 5277: -50 }), { status: 200 }));
    assert.deepEqual(ok.generate_data.logit_bias, { 5277: -50 });
    assert.deepEqual(failures(), []);
});
