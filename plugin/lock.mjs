// 방 자물쇠 (docs/SERVER-HANDOVER.md 3장): 한 방에서 답장을 만드는 것은 한 번에 하나.
// 마리나라의 채팅마다 하나뿐인 생성 자물쇠(generate.routes.ts activeGenerations: 만들기 시작할 때 걸고, 끝나면 자기 것일 때만
// 풀어요. 걸려 있는 동안 같은 채팅에 또 만들라고 하면 409)를 우리 모양으로. 마리나라의 "채팅" 하나 = 우리 방 하나.
// 마리나라에서는 서버만 답장을 만들어서 서버 안의 Map 하나로 돼요. 우리는 브라우저 탭도 만들어서, 탭도 여기서 잡아요.
//   쥐는 쪽: 일꾼('server') · 브라우저 탭('browser:…'). 같은 쪽은 겹쳐 잡을 수 있고(센 만큼 놓아야 풀려요), 다른 쪽은 못 잡아요.
//   일꾼의 것은 시간 제한이 없어요(마리나라 그대로: 일이 끝나면 놓아요. 일꾼이 멈추면 자물쇠도 같이 사라져요: 일꾼 안에 있어요).
//   탭의 것은 ms 동안 소식(잡기 · 이어 잡기)이 없으면 풀려요: 탭은 일하다 닫힐 수 있어서예요(마리나라와 다른 점. 5분은 마리나라의
//   먼저 말 걸기 "만드는 중" 표시가 저절로 풀리는 시간 GENERATION_TIMEOUT_MS를 따랐어요)
export const LOCK_MS = 5 * 60_000;
export function makeLocks({ ms = LOCK_MS, now = () => Date.now() } = {}) {
    const locks = new Map();
    const stale = (had, t) => had.by !== 'server' && t - had.at >= ms;
    return {
        // → { ok: true } | { ok: false, by (쥔 쪽), at }
        claim(key, by) {
            const had = locks.get(key), t = now();
            if (had && had.by === by && !stale(had, t)) { had.n += 1; had.at = t; return { ok: true }; }
            if (had && had.by !== by && !stale(had, t)) return { ok: false, by: had.by, at: had.at };
            locks.set(key, { by, at: t, n: 1 });
            return { ok: true };
        },
        // 쥔 쪽이 이어 잡아요(시각만 새로) → 아직 쥐고 있나
        renew(key, by) {
            const had = locks.get(key), t = now();
            if (!had || had.by !== by || stale(had, t)) return false;
            had.at = t;
            return true;
        },
        // (쥔 쪽만 놓을 수 있어요: 시간이 지나 남이 잡은 뒤에 놓아도 남의 것은 그대로)
        release(key, by) {
            const had = locks.get(key);
            if (!had || had.by !== by) return;
            had.n -= 1;
            if (had.n <= 0) locks.delete(key);
        },
        holder(key) { const had = locks.get(key); return had && !stale(had, now()) ? had.by : ''; },
    };
}
// 자물쇠의 열쇠: 저장(Orbit) id + 방 id (같은 세계를 분기한 저장은 서로 다른 자물쇠)
export const lockKey = (sid, roomId) => `${sid}/${roomId}`;
