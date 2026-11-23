// 방 자물쇠 (plugin/lock.mjs): 마리나라의 채팅마다 하나뿐인 생성 자물쇠를 우리 모양으로 — 일꾼('server')과 브라우저 탭이 같이 써요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLocks, lockKey, LOCK_MS } from '../plugin/lock.mjs';

const clock = () => { const c = { t: 1_000_000, now: () => c.t }; return c; };

test('자물쇠: 한 방은 한쪽만. 다른 방은 따로. 저장(Orbit)이 다르면 같은 방 id도 따로', () => {
    const c = clock(), L = makeLocks({ now: c.now });
    assert.deepEqual(L.claim(lockKey('s1', 'r1'), 'server'), { ok: true });
    assert.deepEqual(L.claim(lockKey('s1', 'r1'), 'browser:a'), { ok: false, by: 'server', at: c.t });
    assert.deepEqual(L.claim(lockKey('s1', 'r2'), 'browser:a'), { ok: true });
    assert.deepEqual(L.claim(lockKey('s2', 'r1'), 'browser:a'), { ok: true });
    // (다른 탭도 못 잡아요)
    assert.equal(L.claim(lockKey('s1', 'r2'), 'browser:b').ok, false);
    assert.equal(lockKey('s1', 'r1'), 's1/r1');
});

test('자물쇠: 같은 쪽은 겹쳐 잡아요. 잡은 만큼 놓아야 풀려요. 쥐지 않은 쪽이 놓아도 그대로', () => {
    const L = makeLocks();
    L.claim('k', 'server'); L.claim('k', 'server');
    L.release('k', 'browser:a');
    assert.equal(L.holder('k'), 'server');
    L.release('k', 'server');
    assert.equal(L.holder('k'), 'server');
    assert.equal(L.claim('k', 'browser:a').ok, false);
    L.release('k', 'server');
    assert.equal(L.holder('k'), '');
    assert.equal(L.claim('k', 'browser:a').ok, true);
});

test('자물쇠: 일꾼의 것은 시간이 지나도 안 풀려요(마리나라 그대로). 탭의 것은 5분 동안 소식이 없으면 풀려요. 이어 잡으면 그만큼 늘어요', () => {
    const c = clock(), L = makeLocks({ now: c.now });
    assert.equal(LOCK_MS, 5 * 60_000);
    L.claim('a', 'server');
    c.t += 60 * 60_000;
    assert.equal(L.claim('a', 'browser:x').ok, false);
    // 탭
    L.claim('b', 'browser:x');
    c.t += LOCK_MS - 1;
    assert.equal(L.claim('b', 'server').ok, false);
    assert.equal(L.renew('b', 'browser:x'), true);
    c.t += LOCK_MS - 1;
    assert.equal(L.claim('b', 'server').ok, false);
    c.t += 1;
    // (5분 동안 아무 소식 없음: 일꾼이 잡아요. 늦게 온 탭의 이어 잡기 · 놓기는 일꾼의 것을 건드리지 못해요)
    assert.equal(L.holder('b'), '');
    assert.deepEqual(L.claim('b', 'server'), { ok: true });
    assert.equal(L.renew('b', 'browser:x'), false);
    L.release('b', 'browser:x');
    assert.equal(L.holder('b'), 'server');
    // (시간이 지난 탭이 다시 잡으면 처음부터: 한 번 놓으면 풀려요)
    L.claim('c', 'browser:y'); L.claim('c', 'browser:y');
    c.t += LOCK_MS;
    L.claim('c', 'browser:y');
    L.release('c', 'browser:y');
    assert.equal(L.holder('c'), '');
    // (쥐지 않은 것은 이어 잡을 수 없어요)
    assert.equal(L.renew('none', 'browser:y'), false);
});
