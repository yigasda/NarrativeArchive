// 일꾼 스레드에만 끼우는 "아무것도 안 하는 화면" (docs/PHONE2-PLAN.md "서버 플러그인" 3-2b).
// 서버는 브라우저와 같은 답장 코드(src/)를 그대로 돌려요. 그 파일들은 불러올 때 화면(document · $ · toastr …)을 찾아서,
// 그 자리에 "뭘 시켜도 아무 일도 안 하는 것"을 둬요. 화면에서 값을 읽어 계산하는 코드는 답장 길에 없어요
// (확인: 이 화면으로 답장 · 먼저 건 말이 브라우저와 같은 요청을 만들어요 — tests/pluginwork.test.mjs).
// 이 파일은 일꾼 스레드에서만 불러요: 실리 서버 자신의 전역은 건드리지 않아요.
// 실리의 것(SillyTavern.getContext())은 일꾼이 지금 돌리는 세계의 것으로 그때그때 바꿔 끼워요 (setContext).

import { isMainThread } from 'node:worker_threads';

if (isMainThread && !process.env.NA_SCREEN_ANYWHERE) throw new Error('plugin/screen.mjs는 일꾼 스레드에서만 불러요');

// anything asked of it gives itself back; awaited, it is not a promise; as text it is ''; looped over, it is empty
function nothing() {
    const f = function () {};
    const p = new Proxy(f, {
        get: (t, k) => (k === 'then' ? undefined : k === Symbol.toPrimitive ? () => '' : k === Symbol.iterator ? function* () {} : k === 'length' ? 0 : k === 'toString' || k === 'valueOf' ? () => '' : p),
        apply: () => p, construct: () => p, set: () => true, has: () => false, deleteProperty: () => true,
    });
    return p;
}
const N = nothing(), kept = new Map();
let current = null;
// 지금 돌리는 세계의 실리 것 (없으면 빈 것: 파일을 불러오는 동안 · 쉬는 동안)
export const setContext = c => { current = c || null; };
const idle = Object.freeze({});
class Watcher { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }

Object.assign(globalThis, {
    window: globalThis, document: N, $: N, jQuery: N, toastr: N,
    localStorage: { getItem: k => kept.get(String(k)) ?? null, setItem: (k, v) => { kept.set(String(k), String(v)); }, removeItem: k => { kept.delete(String(k)); }, clear: () => kept.clear() },
    SillyTavern: { getContext: () => current || idle },
    MutationObserver: Watcher, ResizeObserver: Watcher, IntersectionObserver: Watcher,
    requestAnimationFrame: fn => setTimeout(fn, 0), cancelAnimationFrame: id => clearTimeout(id),
    getComputedStyle: () => N, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    HTMLElement: class {}, Element: class {}, Node: class {}, Image: class {}, DOMParser: class { parseFromString() { return N; } },
    CustomEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init || {}); } },
});
