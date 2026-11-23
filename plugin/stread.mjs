// 실리 파일을 실리가 읽는 그대로 읽어요 (서버가 답장마다 새로: 실리에서 고친 것이 바로 따라와요).
// 실리 1.19.1의 코드를 옮긴 것이고, 고친 것은 "브라우저 메모리 대신 파일 · 화면 · 저장 없음"뿐이에요.
//   chatData    src/endpoints/chats.js getChatData 577~590
//   chatParts   public/script.js getChat 7652~7660 · public/scripts/group-chats.js getGroupChat 265~272
//   groupOf     public/scripts/group-chats.js getGroups 758~790 · validateGroup 218~232 (고친 것을 저장하지 않아요)
//   personaFor  public/scripts/personas.js loadPersonaForCurrentChat 1543~1640 · getConnectedPersonas 1674~1680 (읽기만)
//   personaOf   public/scripts/personas.js selectCurrentPersona 897~ · public/script.js setUserName 7873 · getSettings
import fs from 'node:fs/promises';

const obj = v => v && typeof v === 'object' && !Array.isArray(v);
// (src/util.js tryParse)
const tryParse = s => { try { return JSON.parse(s); } catch { return undefined; } };
const onlyUnique = (v, i, a) => a.indexOf(v) === i;

// 채팅 파일 → 줄마다 읽은 것 (못 읽는 줄은 빼요). 없거나 비었으면 []
export async function chatData(file) {
    let text = '';
    try { text = await fs.readFile(file, 'utf8'); } catch { text = ''; }
    if (!text.length) return [];
    return text.split('\n').map(line => tryParse(line)).filter(x => x);
}
// 줄들 → { metadata: 헤더의 chat_metadata, chat: 메시지들 }
export function chatParts(data, group) {
    const list = Array.isArray(data) ? data.slice() : [];
    if (group) {
        const metadata = list[0]?.chat_metadata ?? {};
        if (list.length && Object.hasOwn(list[0], 'chat_metadata')) list.shift();
        return { metadata, chat: list };
    }
    if (!list.length) return { metadata: {}, chat: [] };
    const header = list.shift();
    return { metadata: header?.chat_metadata ?? {}, chat: list };
}

// 그룹 파일의 것 → 실리 브라우저가 들고 있는 그룹 (characters: 실리의 캐릭터 목록 전체)
export function groupOf(raw, characters) {
    if (!obj(raw)) return null;
    const group = structuredClone(raw), list = Array.isArray(characters) ? characters : [];
    // (getGroups: old formats)
    if (typeof group.id === 'number') group.id = String(group.id);
    if (group.disabled_members == undefined) group.disabled_members = [];
    if (group.chat_id == undefined) {
        group.chat_id = group.id;
        group.chats = [group.id];
        group.members = (Array.isArray(group.members) ? group.members : []).map(x => list.find(y => y.name == x)?.avatar).filter(x => x).filter(onlyUnique);
    }
    if (typeof group.chat_id === 'number') group.chat_id = String(group.chat_id);
    if (Array.isArray(group.chats) && group.chats.some(x => typeof x === 'number')) group.chats = group.chats.map(x => String(x));
    // (validateGroup: members that are no character are left out; duplicate chat ids too)
    group.members = (Array.isArray(group.members) ? group.members : []).filter(member => list.find(x => x.avatar === member || x.name === member));
    if (Array.isArray(group.chats)) group.chats = group.chats.filter(onlyUnique);
    return group;
}

// 이 채팅을 열면 실리가 고를 페르소나 (아바타 파일 이름) | ''
//   settings: settings.json · lock: 채팅 헤더의 chat_metadata.persona · key: 그룹 id 또는 캐릭터 아바타 · avatars: User Avatars 목록
//   (여러 페르소나가 연결돼 있고 persona_allow_multi_connections가 켜져 있으면 실리는 묻는 창을 띄워요. 서버는 첫 번째)
export function personaFor(settings, { lock, key, avatars }) {
    const power = obj(settings?.power_user) ? settings.power_user : {}, list = Array.isArray(avatars) ? avatars : [];
    let user = typeof settings?.user_avatar === 'string' ? settings.user_avatar : '';
    if (list.length && !list.includes(user)) user = list[0];
    let chatPersona = '';
    if (lock) chatPersona = list.includes(lock) ? lock : '';
    if (!chatPersona) {
        const descriptors = obj(power.persona_descriptions) ? power.persona_descriptions : {};
        const connected = Object.entries(descriptors).filter(([, d]) => Array.isArray(d?.connections) && d.connections.some(conn => conn?.id === key)).map(([k]) => k);
        if (connected.length) chatPersona = connected[0];
    }
    if (!chatPersona && power.default_persona) chatPersona = power.default_persona;
    return chatPersona || user || '';
}
// 그 페르소나로 고르면 실리 브라우저의 name1 · power_user.persona_description → { name1, description }
export function personaOf(settings, avatar) {
    const power = obj(settings?.power_user) ? settings.power_user : {};
    const personas = obj(power.personas) ? power.personas : {}, descriptors = obj(power.persona_descriptions) ? power.persona_descriptions : {};
    const name = personas[avatar];
    if (name) {
        const descriptor = descriptors[avatar];
        return { name1: String(name), description: descriptor ? String(descriptor.description ?? '') : '' };
    }
    // (a persona SillyTavern has no name for: name1 and the description stay what they were)
    const was = typeof settings?.username === 'string' ? settings.username : '';
    return { name1: was === '' ? 'User' : was, description: String(power.persona_description ?? '') };
}
