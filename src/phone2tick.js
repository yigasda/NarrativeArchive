// 30초마다, 처음은 10초 뒤 (마리나라의 use-autonomous-messaging 폴링과 같아요): 먼저 말 걸 때가 된 방이 있나 보고, 때가 된 늦은 답장을 돌려요.
// 실리 창이 열려 있는 동안만 돌아요. index.js가 tickStart()를 한 번 불러요.
// 화면은 document의 'na-live-change' 소식을 듣고 다시 그려요.

import { getMeta, hasChat, saveMeta } from './core.js';
import { keepServes, keepKept, keepSync } from './phone2keepon.js';
import { startIdleDetection } from './marinara/idle-detection.js';
import { userStore } from './phone2sched.js';

export const TICK_MS = 30_000, TICK_FIRST_MS = 10_000;
let timer = null, busy = false;
export async function tickOnce() {
    if (busy || !hasChat()) return 0;
    const m = getMeta();
    if (!m?.live?.world) return 0;
    // (nobody is looking and the server plugin's worker is running: this chat is the worker's until the tab shows again —
    //  if both ran, a character would write first twice. Without the worker, as before: the browser does it all)
    if (globalThis.document?.hidden && keepServes()) return 0;
    busy = true;
    try {
        // (what the server plugin's worker wrote meanwhile comes in before anything is judged: never from an old copy — the
        //  screen woke up and the tick answered a message the worker had answered already, 2026-11-22. Each room's work then
        //  takes that room's lock and reads again: phone2go.js liveGo · liveAutonomous)
        if (keepKept()) await keepSync();
        const w = m.live?.world;
        if (!w) return 0;
        // (the role-play moved on, a card or the persona changed: what the server plugin reads while SillyTavern is closed follows)
        try { if (await (await import('./phone2go.js')).liveKitRefresh(m)) await saveMeta(); } catch (err) { console.warn('[narrative-archive] live kit', err); }
        const waiting = !!w.queue?.jobs?.some(j => j.kind === 'reply' && j.state === 'waiting');
        if (!w.presence?.on && !waiting && !Object.keys(w.presence?.schedules || {}).length) return 0;
        return await work(m, waiting);
    } finally { busy = false; }
}
async function work(m, waiting) {
    const G = await import('./phone2go.js'), tell = () => globalThis.document.dispatchEvent(new globalThis.CustomEvent('na-live-change'));
    // (the weekly renewal, for those who have it on and whose week has turned)
    try { await G.liveRenewSchedules(m, { automatic: true }); } catch (err) { console.warn('[narrative-archive] schedule renewal', err); }
    // (Marinara skips the check while the tab is hidden; replies already waiting still go when their time comes)
    const n = globalThis.document?.hidden ? 0 : await G.liveAutonomous(m);
    if (n || waiting) await G.liveGo(m, { onChange: tell });
    return n;
}
export function tickStart() {
    if (timer) return;
    const run = () => { tickOnce().catch(err => console.warn('[narrative-archive] live tick', err)); };
    timer = globalThis.setInterval(run, TICK_MS);
    globalThis.setTimeout(run, TICK_FIRST_MS);
    // (10 minutes without a touch: my status reads idle, until I move or send — Marinara's idle detection, on the open chat)
    startIdleDetection({ getState: () => (hasChat() && getMeta()?.live?.world ? userStore(getMeta()).getState() : { userStatus: 'active', userStatusManual: 'dnd', setUserStatus() {} }) });
}
