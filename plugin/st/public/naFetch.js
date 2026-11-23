// 우리 것 (실리 파일 아님): 옮긴 실리 코드의 fetch('/api/...') 자리. 서버 플러그인 일꾼이 `__naSetFetch`로 실리 서버에 보내는 길(다리)을 줘요.
// 실리 브라우저가 그 길로 보내는 것과 같은 요청이 실리 서버 자신의 처리기로 가요(예: 로짓 바이어스의 /api/backends/chat-completions/bias).
// 실리 코드가 실패를 삼키는 자리가 있어서(openai.js calculateLogitBias는 실패하면 바이어스 없이 보내요) 실패한 길은 적어 둬요: 일꾼이 그 요청을 보내지 않고 이유를 알려요.
let send = null;
export const naFetchFailures = [];
export function __naSetFetch(fn) { send = typeof fn === 'function' ? fn : null; naFetchFailures.length = 0; }
export async function naFetch(url, init = {}) {
    const u = String(url);
    if (!send) { naFetchFailures.push({ url: u, status: 0 }); throw new Error('실리 서버에 연결할 수 없습니다.'); }
    const r = await send(u, init);
    if (!r.ok) naFetchFailures.push({ url: u, status: r.status });
    return r;
}
