// 서버 플러그인이 실리를 닫은 동안 답장을 만들 때 쓰는 묶음 (docs/PHONE2-PLAN.md "서버 플러그인" 3-2b).
// 서버는 브라우저와 같은 답장 코드를 돌리고, 실리의 것(카드 · 그룹 · 페르소나 · 롤플 메시지 · 채팅에 저장된 값)은 답장마다
// 실리 파일에서 새로 읽어요 (plugin/work.mjs · plugin/stread.mjs). 묶음에는 "이 Orbit이 실리의 어느 채팅인지"만 남겨요.
//   kit = { v: 1,
//     ver                           확장의 버전 (서버가 플러그인 폴더의 코드로 돌 때만, 같은 버전이어야 돌려요: plugin/code.mjs)
//     chat: { avatar | null, group: { id } | null, file }   이 채팅이 누구의 것인지
//       file: { group: 그룹 채팅인가, dir: 캐릭터 채팅 폴더 이름 | null, id: 채팅 파일 이름(확장자 없이) } | null
//             실리의 채팅 파일. 서버는 이 파일을 읽고, 이 파일이 있는 동안만 돌려요: 실리에서 채팅을 지웠는데 Orbit에 계속 말을 걸지 않게
//   }
// (실리 연결 방식 · 연결 프로필의 요청 틀 — st · pt · ptWhy · levels · profiles — 은 liveKitRefresh가 더해요)
// 이 파일은 실리 · 화면을 몰라요.

import { liveWorld, liveKey } from './phone2store.js';

export const KIT = { v: 1 };
const obj = v => v && typeof v === 'object' && !Array.isArray(v);

// 실시간 폰이 읽는 캐릭터 카드: 이 채팅의 캐릭터(own: 아바타) · 그룹의 사람들(members: 아바타), 폰이 있거나 방에 있는 사람(이름으로),
// 폰 프로필로 고른 카드 → 실리 목록에서 그 카드들, 목록의 순서 그대로 (이름으로 찾을 때 실리와 같은 카드가 먼저 나와요)
export function cardsFor(list, real, { own = null, members = [] } = {}) {
    const w = liveWorld(real), all = Array.isArray(list) ? list : [];
    const names = new Set(), avatars = new Set();
    for (const p of Object.values(w?.phones || {})) {
        if (p?.owner) names.add(liveKey(p.owner));
        if (p?.financeProfile?.type === 'character' && p.financeProfile.id) avatars.add(p.financeProfile.id);
    }
    for (const room of Object.values(w?.messenger?.rooms || {})) for (const n of room?.members || []) names.add(liveKey(n));
    for (const a of Array.isArray(members) ? members : []) avatars.add(a);
    if (own) avatars.add(own);
    return all.filter(ch => ch && (avatars.has(ch.avatar) || names.has(liveKey(ch.name))));
}

// c: 실리의 getContext() 것 · real: 이 채팅의 우리 메타 · version: 확장의 버전 → 묶음 | null (실시간 폰이 없으면)
export function buildKit(c, real, { version = '' } = {}) {
    if (!liveWorld(real) || !obj(c)) return null;
    const list = Array.isArray(c.characters) ? c.characters : [];
    const group = c.groupId ? (Array.isArray(c.groups) ? c.groups : []).find(g => g?.id === c.groupId) || null : null;
    const own = group ? null : list[c.characterId] || null;
    // (SillyTavern's chat file: <chats>/<avatar without .png>/<chat id>.jsonl, a group's <group chats>/<chat id>.jsonl)
    const chatId = String(c.chatId ?? c.getCurrentChatId?.() ?? '');
    const file = chatId && (group || own?.avatar) ? { group: !!group, dir: group ? null : String(own.avatar).replace(/\.png$/i, ''), id: chatId } : null;
    return { v: KIT.v, ver: String(version || ''), chat: { avatar: own?.avatar || null, group: group ? { id: group.id } : null, file } };
}
// 묶음이 달라졌으면 m.live.kit에 넣어요 → 넣었으면 true (저장은 부르는 쪽이)
export function putKit(real, kit) {
    if (!obj(real?.live) || !kit) return false;
    const was = real.live.kit;
    if (was && JSON.stringify(was) === JSON.stringify(kit)) return false;
    real.live.kit = JSON.parse(JSON.stringify(kit));
    return true;
}
export const kitOf = real => (obj(real?.live?.kit) && real.live.kit.v === KIT.v ? real.live.kit : null);
