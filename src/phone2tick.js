// 1분마다 (마리나라의 SERVER_AUTONOMOUS_POLL_MS와 같아요): 먼저 말 걸 때가 된 방이 있나 보고, 때가 된 늦은 답장을 돌려요.
// 실리 창이 열려 있는 동안만 돌아요. index.js가 tickStart()를 한 번 불러요.
// 화면은 document의 'na-live-change' 소식을 듣고 다시 그려요.

import { getMeta, hasChat } from './core.js';

export const TICK_MS = 60_000;
let timer = null, busy = false;
export async function tickOnce() {
    if (busy || !hasChat()) return 0;
    const m = getMeta(), w = m?.live?.world;
    if (!w) return 0;
    const waiting = !!w.queue?.jobs?.some(j => j.kind === 'reply' && j.state === 'waiting');
    if (!w.presence?.on && !waiting) return 0;
    busy = true;
    try {
        const G = await import('./phone2go.js'), tell = () => globalThis.document.dispatchEvent(new globalThis.CustomEvent('na-live-change'));
        const n = await G.liveAutonomous(m);
        if (n || waiting) await G.liveGo(m, { onChange: tell });
        return n;
    } finally { busy = false; }
}
export function tickStart() {
    if (timer) return;
    timer = globalThis.setInterval(() => { tickOnce().catch(err => console.warn('[narrative-archive] live tick', err)); }, TICK_MS);
}
