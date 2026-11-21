// phone2keep.js를 실리에 잇기: 플러그인으로 가는 요청, 채팅이 바뀔 때 읽기, core.js saveMeta 앞에 끼우기.
// index.js가 keepStart()를 한 번 불러요.

import { ctx, getMeta, hasChat, setSaveHook } from './core.js';
import { makeKeep } from './phone2keep.js';

const PATH = '/api/plugins/narrative-archive';
const J = JSON.stringify;
async function http(path, body) {
    const headers = ctx().getRequestHeaders();
    const r = await fetch(PATH + path, body === undefined ? { headers } : { method: 'POST', headers, body });
    if (r.ok) return r.json();
    const err = new Error((await r.json().catch(() => ({})))?.error || `Orbit 저장 서버 오류 (${r.status})`);
    err.code = r.status;
    throw err;
}
const api = {
    ping: () => http('/ping'),
    load: id => http('/store/load', J({ id })).catch(err => { if (err.code === 404) return null; throw err; }),
    // (the parts are JSON texts already: they go into the body as they are)
    save: (id, { base, chat, parts }) => http('/store/save', `{"id":${J(id)},"base":${J(base ?? null)},"chat":${J(chat || '')},"parts":{${Object.entries(parts).map(([k, s]) => `${J(k)}:${s ?? 'null'}`).join(',')}}}`),
    fork: (from, to, { chat }) => http('/store/fork', J({ from, to, chat })),
    drop: id => http('/store/drop', J({ id })),
};
const now = () => (hasChat() ? { m: getMeta(), mark: ctx().chatMetadata?.integrity || '' } : null);

export const keep = makeKeep({ api, now });
// 지금 채팅의 Orbit 데이터를 다 읽었을 때 끝나는 약속 (플러그인이 없으면 바로)
export const liveReady = () => keep.ready();
export const keepState = () => keep.state();

let started = false;
export function keepStart() {
    if (started) return;
    started = true;
    setSaveHook(() => keep.onSave());
    const c = ctx(), et = c.eventTypes || c.event_types;
    const open = () => { const at = now(); if (at) keep.open(at.m, at.mark); };
    c.eventSource.on(et.CHAT_CHANGED, open);
    open();
}
