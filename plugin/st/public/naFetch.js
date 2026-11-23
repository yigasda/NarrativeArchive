// 우리 것 (실리 파일 아님): 옮긴 실리 코드의 fetch('/api/...') 자리. 서버 플러그인 일꾼이 `__naSetFetch`로 실리 서버에 보내는 길을 줘요.
// /api/backends/chat-completions/bias는 실리 서버의 그 처리기를 옮긴 것으로 이 자리에서 답해요(../server/bias.js: 다리 없이).
let send = null;
export function __naSetFetch(fn) { send = typeof fn === 'function' ? fn : null; }
export async function naFetch(url, init = {}) {
    const u = String(url);
    if (u.startsWith('/api/backends/chat-completions/bias')) {
        const { bias } = await import('../server/bias.js');
        const model = new URLSearchParams(u.split('?')[1] || '').get('model') || '';
        const out = await bias(JSON.parse(init.body || 'null'), model);
        return new Response(JSON.stringify(out.body), { status: out.status, headers: { 'Content-Type': 'application/json' } });
    }
    if (!send) throw new Error('실리 서버에 연결할 수 없습니다.');
    return send(u, init);
}
