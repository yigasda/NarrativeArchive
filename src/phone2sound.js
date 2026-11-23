// 사용자 지정 알림음: 화면이 부르는 함수 (마리나라 client/src/hooks/use-custom-notification-sound.ts 46줄 + App.tsx 545 · 573~575).
// 소리 파일은 서버 플러그인이 사용자 폴더에 둬요(plugin/sound.mjs). 소리를 내는 곳은 src/marinara/notification-sound.js:
// 상태를 읽을 때 · 올릴 때 · 지울 때 setCustomNotificationSoundUrl을 불러서, 그다음 알림음부터 그 소리를 써요.
//   soundStatus() → { configured, url, updatedAt }   (플러그인이 없으면 configured: false)
//   soundUpload(file: File) → 같은 모양 (안 되면 오류: 그 이유)
//   soundRemove() → { configured: false, url: null, updatedAt: null }
//   soundStart() 앱을 켤 때 한 번 (index.js)
// 마리나라와 다른 것: 상태를 30초 동안 기억해 두는 react-query 대신, 부를 때마다 묻고 마지막 것을 soundLast()로 줘요.

import { ctx } from './core.js';
import { setCustomNotificationSoundUrl } from './marinara/notification-sound.js';

const PATH = '/api/plugins/narrative-archive/sound';
export const SOUND_MAX_BYTES = 10 * 1024 * 1024;
const NONE = Object.freeze({ configured: false, url: null, updatedAt: null });
const shape = s => (s && s.configured === true && typeof s.url === 'string' ? { configured: true, url: s.url, updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : null } : { ...NONE });
let last = { ...NONE };
const keep = s => { last = shape(s); setCustomNotificationSoundUrl(last.url); return { ...last }; };
const timeout = ms => (typeof globalThis.AbortSignal?.timeout === 'function' ? globalThis.AbortSignal.timeout(ms) : undefined);
async function answer(r) {
    if (r.ok) return r.json();
    const body = await r.json().catch(() => null);
    const err = new Error(body?.error || (r.status === 404 ? '서버 플러그인이 없습니다.' : `서버 오류 (${r.status})`));
    err.code = r.status;
    throw err;
}

// 지금 상태 (플러그인이 없거나 답하지 않으면 기본 소리: configured false)
export async function soundStatus() {
    try { return keep(await answer(await fetch(PATH, { headers: ctx().getRequestHeaders(), signal: timeout(15_000) }))); }
    catch { return keep(NONE); }
}
// 소리 파일 하나 올리기 → 상태. 실리의 업로드 칸 이름('avatar')으로 보내요(실리 src/server-main.js 269줄의 multer)
export async function soundUpload(file) {
    if (!file) throw new Error('업로드된 알림음이 없습니다.');
    if (file.size > SOUND_MAX_BYTES) throw new Error('알림음은 10MB 이하여야 합니다.');
    const form = new globalThis.FormData();
    form.append('avatar', file, file.name);
    const r = await fetch(`${PATH}/upload`, { method: 'POST', headers: ctx().getRequestHeaders({ omitContentType: true }), body: form, signal: timeout(120_000) });
    return keep(await answer(r));
}
// 지우기 → 기본 소리로
export async function soundRemove() {
    const r = await fetch(`${PATH}/delete`, { method: 'POST', headers: ctx().getRequestHeaders(), body: '{}', signal: timeout(15_000) });
    return keep(await answer(r));
}
// 마지막으로 안 상태 (묻지 않아요)
export const soundLast = () => ({ ...last });
// 앱을 켤 때: 올려 둔 소리가 있으면 그 소리로 (→ 그 상태. 기다리지 않아도 돼요: 오류는 기본 소리로)
export const soundStart = () => soundStatus();
