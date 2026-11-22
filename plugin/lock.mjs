// 세계 자물쇠 (docs/SERVER-HANDOVER.md 3장): 한 Orbit(저장)에서 답장을 만드는 것은 한 번에 하나.
// 마리나라의 채팅마다 하나뿐인 생성 자물쇠(generate.routes.ts activeGenerations: 둘째 요청은 409)와
// 서버 스케줄러의 markGenerationInProgress(5분이 지나면 풀려요: GENERATION_TIMEOUT_MS)를 우리 모양으로.
// 쥐는 쪽은 일꾼('server')이나 브라우저 탭('browser:…'). 탭의 것은 ms 동안 소식이 없으면 풀려요(탭이 닫혔을 때),
// 일꾼의 것은 일이 끝나면 놓아요(일꾼이 멈추면 자물쇠도 같이 사라져요: 일꾼 안에 있어요).
export function makeLocks({ ms = 5 * 60_000, now = () => Date.now() } = {}) {
    const locks = new Map();
    return {
        // → { ok: true } | { ok: false, by (쥔 쪽), at }. 같은 쪽이 다시 잡으면 이어 잡아요(시각만 새로)
        claim(sid, by) {
            const had = locks.get(sid), t = now();
            if (had && had.by !== by && (had.by === 'server' || t - had.at < ms)) return { ok: false, by: had.by, at: had.at };
            locks.set(sid, { by, at: t });
            return { ok: true };
        },
        // (쥔 쪽만 놓을 수 있어요)
        release(sid, by) { if (locks.get(sid)?.by === by) locks.delete(sid); },
        holder: sid => locks.get(sid)?.by || '',
    };
}
