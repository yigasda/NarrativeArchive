// 우리 것 (실리 파일 아님): 옮긴 실리 코드의 fetch('/api/...') 자리. 서버 플러그인 일꾼이 `__naSetFetch`로 실리 서버에 보내는 길(다리)을 줘요.
// 실리 브라우저가 그 길로 보내는 것과 같은 요청이 실리 서버 자신의 처리기로 가요(예: 로짓 바이어스의 /api/backends/chat-completions/bias).
// 실리 코드가 실패를 삼키는 자리가 있어서(openai.js calculateLogitBias는 실패하면 바이어스 없이 보내요) 실패한 길은 적어 둬요: 일꾼이 그 요청을 보내지 않고 이유를 알려요.
let send = null;
export const naFetchFailures = [];
export function __naSetFetch(fn) { send = typeof fn === 'function' ? fn : null; naFetchFailures.length = 0; ajaxAnswers.clear(); naAjaxPending.length = 0; }
// 실패는 모두 naFetchFailures에 적어요(실리 코드가 그 자리에서 삼켜도 일꾼이 보고 요청을 멈출 수 있게):
//  - 다리가 없음 · 다리가 던짐: status 0 · 답이 2xx가 아님: 그 status · 2xx인데 JSON으로 못 읽음(response.json()): reason 'json'
//  - 실리 브라우저가 동기로 받았을 답(naAjax)이 아직 없음: reason 'wait' (그때는 아무것도 보내지 않아요: 그 답 없이 만든 요청은 실리 것과 달라요)
export async function naFetch(url, init = {}) {
    const u = String(url);
    if (naAjaxPending.length) { naFetchFailures.push({ url: u, status: 0, reason: 'wait' }); throw new NaAjaxWait(); }
    if (!send) { naFetchFailures.push({ url: u, status: 0 }); throw new Error('실리 서버에 연결할 수 없습니다.'); }
    let r;
    try { r = await send(u, init); } catch (err) { naFetchFailures.push({ url: u, status: 0, reason: String(err?.message || err) }); throw err; }
    if (!r.ok) naFetchFailures.push({ url: u, status: r.status });
    const json = r.json.bind(r);
    r.json = async () => {
        try { return await json(); } catch (err) { if (r.ok) naFetchFailures.push({ url: u, status: r.status, reason: 'json' }); throw err; }
    };
    return r;
}

// 실리 tokenizers.js의 jQuery.ajax({ async: false, type, url, data, dataType: 'json', contentType, success }) 자리.
// 실리 브라우저는 그 자리에서 실리 서버에 동기 요청(XHR)을 보내고, 성공하면 success(답)를 그 자리에서 불러요(실패면 부르지 않아요).
// Node에는 동기 요청이 없어요: 처음에는 필요한 요청을 naAjaxPending에 적기만 하고(success를 부르지 않음), 그 뒤 naFetch는 NaAjaxWait로 멈춰요.
// 일꾼(plugin/st/naload.js naSendRequest)이 naAjaxFill()로 다리를 거쳐 실리 서버의 답을 받아 두고 같은 일을 다시 하면, 이번에는 받아 둔 답으로
// success를 그 자리에서 불러요. 실리 서버가 같은 요청에 주는 같은 답이라 결과가 실리 브라우저와 같아요.
export class NaAjaxWait extends Error {
    constructor() { super('실리 서버의 토큰 답을 기다립니다.'); this.name = 'NaAjaxWait'; }
}
const ajaxAnswers = new Map();
export const naAjaxPending = [];
const ajaxKey = (o) => JSON.stringify([String(o.type ?? 'GET'), String(o.url), o.data ?? null]);
export function naAjax(o) {
    const key = ajaxKey(o);
    if (ajaxAnswers.has(key)) {
        const a = ajaxAnswers.get(key);
        if (a.ok) o.success?.(a.data);
        return;
    }
    if (!naAjaxPending.some(p => p.key === key)) naAjaxPending.push({ key, type: String(o.type ?? 'GET'), url: String(o.url), data: o.data ?? null, contentType: o.contentType });
}
export async function naAjaxFill() {
    const todo = naAjaxPending.splice(0);
    for (const p of todo) {
        let ok = false, data = null;
        try {
            const r = await naFetch(p.url, { method: p.type, headers: { 'Content-Type': p.contentType || 'application/json' }, body: p.data });
            // (jQuery dataType 'json': 2xx이고 JSON으로 읽혀야 success. 2xx가 아니면 naFetch가 적었고, JSON이 아니면 r.json이 적어요)
            if (r.ok) { data = await r.json(); ok = true; }
        } catch { ok = false; }
        ajaxAnswers.set(p.key, { ok, data });
    }
}
