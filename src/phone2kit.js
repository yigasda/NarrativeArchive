// 서버 플러그인이 실리를 닫은 동안 답장을 만들 때 쓰는 묶음 (docs/PHONE2-PLAN.md "서버 플러그인" 3-2b).
// 서버는 브라우저와 같은 답장 코드를 돌리지만, 브라우저만 아는 것이 있어요: 이 채팅의 캐릭터 · 그룹, 지금 고른 페르소나,
// 롤플의 끝 메시지, 채팅의 용어집. 브라우저가 Orbit을 저장할 때 그것들을 m.live.kit에 같이 남기고, 서버가 그걸 읽어요.
// 여기 담는 것은 답장 코드가 실제로 읽는 칸만이에요 (카드 전체 · 채팅 전체를 담지 않아요). 키 · 비밀번호는 없어요.
//   kit = { v: 1,
//     name1                         페르소나 이름 (실리의 name1)
//     persona                       지금 고른 페르소나의 설명 (powerUserSettings.persona_description)
//     characters: [ … ]             필요한 캐릭터 카드만, 실리 목록의 순서 그대로 (이름으로 찾을 때 같은 카드가 먼저 나와요)
//     chat: { avatar | null, group: { id, members: [avatar…] } | null }   이 채팅이 누구의 것인지
//     tail: { lines, first, end }   롤플의 끝 메시지 (phone2snap.js liveChatTail이 그 순간 읽은 것)
//     meta: { glossary, glossaryPeople, dateOrder, phoneScreenHolder }  실시간 폰이 채팅에서 읽는 칸 (phone2store.js LIVE_SHARED + 화면 주인)
//   }
// 이 파일은 실리 · 화면을 몰라요: 실리의 것(c)과 롤플 끝(tail)을 받아서 묶음만 만들어요.

import { liveWorld, liveKey, LIVE_SHARED } from './phone2store.js';

export const KIT = { v: 1 };
// (the card fields the phone's requests read: phonedata.js cardText · phoneprofile.js resolvePhoneProfile · Marinara's schedule request)
const CARD_FIELDS = ['description', 'personality', 'scenario', 'first_mes', 'mes_example'];
// (the card's extension fields read: Marinara's talkativeness, and our schedule · status · weekly renewal)
const CARD_EXT = ['talkativeness', 'narrative_archive_convo'];
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const pick = (from, keys) => { const out = {}; for (const k of keys) if (obj(from) && Object.hasOwn(from, k) && from[k] !== undefined) out[k] = from[k]; return out; };
// one card, with only the fields read (a card with no `data` keeps none: the readers then fall back to its own fields, as in the browser)
function slim(ch) {
    const out = { ...pick(ch, ['name', 'avatar']), ...pick(ch, CARD_FIELDS) };
    if (obj(ch.extensions)) out.extensions = pick(ch.extensions, CARD_EXT);
    if (obj(ch.data)) { out.data = { ...pick(ch.data, ['name']), ...pick(ch.data, CARD_FIELDS) }; if (obj(ch.data.extensions)) out.data.extensions = pick(ch.data.extensions, CARD_EXT); }
    return out;
}

// c: 실리의 getContext() 것 · real: 이 채팅의 우리 메타 · tail: liveChatTail()의 답 → 묶음 | null (실시간 폰이 없으면)
export function buildKit(c, real, tail) {
    const w = liveWorld(real);
    if (!w || !obj(c)) return null;
    const list = Array.isArray(c.characters) ? c.characters : [];
    const group = c.groupId ? (Array.isArray(c.groups) ? c.groups : []).find(g => g?.id === c.groupId) || null : null;
    const own = group ? null : list[c.characterId] || null;
    // who is needed: this chat's characters, everyone with a phone or in a room (found by name), and a card chosen as a phone's profile
    const names = new Set(), avatars = new Set();
    for (const p of Object.values(w.phones || {})) {
        if (p?.owner) names.add(liveKey(p.owner));
        if (p?.financeProfile?.type === 'character' && p.financeProfile.id) avatars.add(p.financeProfile.id);
    }
    for (const room of Object.values(w.messenger?.rooms || {})) for (const n of room?.members || []) names.add(liveKey(n));
    for (const a of group?.members || []) avatars.add(a);
    if (own?.avatar) avatars.add(own.avatar);
    const characters = list.filter(ch => ch && (ch === own || avatars.has(ch.avatar) || names.has(liveKey(ch.name)))).map(slim);
    const meta = {};
    for (const k of [...LIVE_SHARED, 'phoneScreenHolder']) if (real[k] !== undefined) meta[k] = real[k];
    return {
        v: KIT.v,
        name1: String(c.name1 || ''),
        persona: String(c.powerUserSettings?.persona_description || ''),
        characters,
        chat: { avatar: own?.avatar || null, group: group ? { id: group.id, members: Array.isArray(group.members) ? [...group.members] : [] } : null },
        tail: { lines: Array.isArray(tail?.lines) ? tail.lines.map(String) : [], first: Number.isInteger(tail?.first) ? tail.first : null, end: Number.isInteger(tail?.end) ? tail.end : 0 },
        meta,
    };
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

// 서버가 묶음으로 실리의 것을 다시 세워요 → getContext()가 줄 칸들 (나머지 — 저장 · 설정 · 실리 요청 — 은 서버 쪽이 붙여요)
export function kitContext(kit) {
    const characters = (kit.characters || []).map(ch => JSON.parse(JSON.stringify(ch)));
    const group = kit.chat?.group || null, at = group ? -1 : characters.findIndex(ch => kit.chat?.avatar && ch.avatar === kit.chat.avatar);
    return {
        name1: kit.name1 || '',
        characters,
        characterId: at >= 0 ? at : undefined,
        groupId: group ? group.id : null,
        groups: group ? [{ id: group.id, members: [...group.members] }] : [],
        persona: kit.persona || '',
    };
}
