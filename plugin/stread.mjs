// 실리 파일을 실리가 읽는 그대로 읽어요 (서버가 답장마다 새로: 실리에서 고친 것이 바로 따라와요).
// 실리 1.19.1의 코드를 옮긴 것이고, 고친 것은 "브라우저 메모리 대신 파일 · 화면 · 저장 없음"뿐이에요.
//   chatData    src/endpoints/chats.js getChatData 577~590
//   chatParts   public/script.js getChat 7652~7660 · public/scripts/group-chats.js getGroupChat 265~272
//   groupOf     public/scripts/group-chats.js getGroups 758~790 · validateGroup 218~232 (고친 것을 저장하지 않아요)
//   personaFor  public/scripts/personas.js loadPersonaForCurrentChat 1543~1640 · getConnectedPersonas 1674~1680 (읽기만)
//   personaOf   public/scripts/personas.js selectCurrentPersona 897~ · public/script.js setUserName 7873 · getSettings
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const obj = v => v && typeof v === 'object' && !Array.isArray(v);
// (src/util.js tryParse)
const tryParse = s => { try { return JSON.parse(s); } catch { return undefined; } };
const onlyUnique = (v, i, a) => a.indexOf(v) === i;

// 채팅 파일 → 줄마다 읽은 것 (못 읽는 줄은 빼요). 없거나 비었으면 []. 그 밖에 못 읽으면(권한 · 너무 큼) 오류: 실리는 빈 채팅으로
// 보지만(tryReadFileSync), 서버는 롤플 없이 답장을 지어내지 않아요
export async function chatData(file) {
    let text = '';
    try { text = await fs.readFile(file, 'utf8'); } catch (err) { if (err?.code !== 'ENOENT') throw err; text = ''; }
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

// ---- 다리가 없을 때(실리 버전이 달라 실리 서버의 처리기를 못 붙였을 때): 카드 · 페르소나 그림을 실리 폴더에서 직접
// 실리 서버가 /api/characters/all · /api/avatars/get에서 하는 것을 옮긴 것이에요:
//   readCards    src/endpoints/characters.js /all 1467~1479 · processCharacter 406~441 (통계 칸 — date_added · chat_size … — 은 빼요:
//                답장 코드가 안 읽어요) · getCharaCardV2 450 · convertToV2 469 · readFromV2 504 · charaFormatData 565
//                (src/character-card-parser.js read 54~78, png-chunks-extract 1.0.0 · png-chunk-text 1.0.0 decode: MIT, Hugh Kennedy)
//   readImages   src/util.js getImages 682~ (그림만, 이름 순)
// (crc-32 as png-chunks-extract checks it: the standard CRC-32, as a signed 32-bit number)
const CRC_TABLE = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = buf => { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return c ^ -1; };
// (png-chunks-extract)
function extractChunks(data) {
    const head = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < 8; i++) if (data[i] !== head[i]) throw new Error('Invalid .png file header');
    const uint8 = new Uint8Array(4), int32 = new Int32Array(uint8.buffer), uint32 = new Uint32Array(uint8.buffer);
    let ended = false, idx = 8;
    const chunks = [];
    while (idx < data.length) {
        uint8[3] = data[idx++]; uint8[2] = data[idx++]; uint8[1] = data[idx++]; uint8[0] = data[idx++];
        const length = uint32[0] + 4, chunk = new Uint8Array(length);
        chunk[0] = data[idx++]; chunk[1] = data[idx++]; chunk[2] = data[idx++]; chunk[3] = data[idx++];
        const name = String.fromCharCode(chunk[0], chunk[1], chunk[2], chunk[3]);
        if (!chunks.length && name !== 'IHDR') throw new Error('IHDR header missing');
        if (name === 'IEND') { ended = true; chunks.push({ name, data: new Uint8Array(0) }); break; }
        for (let i = 4; i < length; i++) chunk[i] = data[idx++];
        uint8[3] = data[idx++]; uint8[2] = data[idx++]; uint8[1] = data[idx++]; uint8[0] = data[idx++];
        if (crc32(chunk) !== int32[0]) throw new Error(`CRC values for ${name} header do not match, PNG file is likely corrupted`);
        chunks.push({ name, data: new Uint8Array(chunk.buffer.slice(4)) });
    }
    if (!ended) throw new Error('.png file ended prematurely: no IEND header was found');
    return chunks;
}
// (png-chunk-text decode)
function decodeText(data) {
    let naming = true, text = '', name = '';
    for (let i = 0; i < data.length; i++) {
        const code = data[i];
        if (naming) { if (code) name += String.fromCharCode(code); else naming = false; }
        else if (code) text += String.fromCharCode(code);
        else throw new Error('Invalid NULL character found. 0x00 character is not permitted in tEXt content');
    }
    return { keyword: name, text };
}
// (character-card-parser.js read: ccv3 first, then chara)
export function readCardText(image) {
    const textChunks = extractChunks(new Uint8Array(image)).filter(chunk => chunk.name === 'tEXt').map(chunk => decodeText(chunk.data));
    if (textChunks.length === 0) throw new Error('No PNG metadata.');
    const ccv3 = textChunks.find(chunk => chunk.keyword.toLowerCase() === 'ccv3');
    if (ccv3) return Buffer.from(ccv3.text, 'base64').toString('utf8');
    const chara = textChunks.find(chunk => chunk.keyword.toLowerCase() === 'chara');
    if (chara) return Buffer.from(chara.text, 'base64').toString('utf8');
    throw new Error('No PNG metadata.');
}

// (util.js humanizedDateTime)
function humanizedDateTime(timestamp = Date.now()) {
    const date = new Date(timestamp);
    const dt = { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds(), millisecond: date.getMilliseconds() };
    for (const key in dt) dt[key] = dt[key].toString().padStart(key === 'millisecond' ? 3 : 2, '0');
    return `${dt.year}-${dt.month}-${dt.day}@${dt.hour}h${dt.minute}m${dt.second}s${dt.millisecond}ms`;
}
// (lodash _.get / _.set on a dotted path, as these functions use them)
const getPath = (o, p) => p.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);
const setPath = (o, p, value) => { const ks = p.split('.'); let cur = o; for (const k of ks.slice(0, -1)) { if (!obj(cur[k])) cur[k] = {}; cur = cur[k]; } cur[ks.at(-1)] = value; };
const splitTags = tags => (typeof tags == 'string' ? tags.split(',').map(x => x.trim()).filter(x => x) : tags || []);
// (characters.js charaFormatData: only what convertToV2 hands it — no world, no extensions JSON)
function charaFormatData(data) {
    const char = tryParse(data.json_data) || {};
    delete char.json_data;
    setPath(char, 'name', data.ch_name);
    for (const k of ['description', 'personality', 'scenario', 'first_mes', 'mes_example']) setPath(char, k, data[k] || '');
    setPath(char, 'creatorcomment', data.creator_notes || '');
    setPath(char, 'avatar', 'none');
    setPath(char, 'chat', `${data.ch_name} - ${humanizedDateTime()}`);
    setPath(char, 'talkativeness', data.talkativeness || 0.5);
    setPath(char, 'fav', data.fav == 'true');
    setPath(char, 'tags', splitTags(data.tags));
    setPath(char, 'spec', 'chara_card_v2');
    setPath(char, 'spec_version', '2.0');
    setPath(char, 'data.name', data.ch_name);
    for (const k of ['description', 'personality', 'scenario', 'first_mes', 'mes_example']) setPath(char, `data.${k}`, data[k] || '');
    setPath(char, 'data.creator_notes', data.creator_notes || '');
    setPath(char, 'data.system_prompt', data.system_prompt || '');
    setPath(char, 'data.post_history_instructions', data.post_history_instructions || '');
    setPath(char, 'data.tags', splitTags(data.tags));
    setPath(char, 'data.creator', data.creator || '');
    setPath(char, 'data.character_version', data.character_version || '');
    setPath(char, 'data.alternate_greetings', Array.isArray(data.alternate_greetings) ? data.alternate_greetings : typeof data.alternate_greetings === 'string' ? [data.alternate_greetings] : []);
    setPath(char, 'data.extensions.talkativeness', data.talkativeness || 0.5);
    setPath(char, 'data.extensions.fav', data.fav == 'true');
    setPath(char, 'data.extensions.world', data.world || '');
    setPath(char, 'data.extensions.depth_prompt.prompt', data.depth_prompt_prompt ?? '');
    setPath(char, 'data.extensions.depth_prompt.depth', !isNaN(Number(data.depth_prompt_depth)) ? Number(data.depth_prompt_depth) : 4);
    setPath(char, 'data.extensions.depth_prompt.role', data.depth_prompt_role ?? 'system');
    return char;
}
function convertToV2(char) {
    const result = charaFormatData({ json_data: JSON.stringify(char), ch_name: char.name, description: char.description, personality: char.personality, scenario: char.scenario, first_mes: char.first_mes, mes_example: char.mes_example,
        creator_notes: char.creatorcomment, talkativeness: char.talkativeness, fav: char.fav, creator: char.creator, tags: char.tags, depth_prompt_prompt: char.depth_prompt_prompt, depth_prompt_depth: char.depth_prompt_depth, depth_prompt_role: char.depth_prompt_role });
    result.chat = char.chat ?? `${char.name} - ${humanizedDateTime()}`;
    result.create_date = char.create_date;
    return result;
}
function readFromV2(char) {
    if (char.data === undefined) return char;
    delete char.json_data;
    const fieldMappings = { name: 'name', description: 'description', personality: 'personality', scenario: 'scenario', first_mes: 'first_mes', mes_example: 'mes_example', talkativeness: 'extensions.talkativeness', fav: 'extensions.fav', tags: 'tags' };
    for (const [charField, v2Path] of Object.entries(fieldMappings)) {
        const v2Value = getPath(char.data, v2Path);
        if (v2Value === undefined) {
            const defaultValue = v2Path === 'extensions.talkativeness' ? 0.5 : v2Path === 'extensions.fav' ? false : undefined;
            if (defaultValue === undefined) continue;
            char[charField] = defaultValue;
        }
        // (as SillyTavern has it: a default set just above is then overwritten with the missing value)
        char[charField] = v2Value;
    }
    char.chat = char.chat ?? `${char.name} - ${humanizedDateTime()}`;
    return char;
}
const getCharaCardV2 = json => (json.spec === undefined ? convertToV2(json) : readFromV2(json));

// <root>/characters의 카드들 → 실리 서버의 /api/characters/all과 같은 목록 (읽지 못한 카드는 빠져요)
export async function readCards(root) {
    const dir = path.join(root, 'characters');
    let files = [];
    try { files = await fs.readdir(dir); } catch { return []; }
    const out = await Promise.all(files.filter(file => file.endsWith('.png')).map(async item => {
        try {
            const imgData = readCardText(await fs.readFile(path.join(dir, item)));
            const character = getCharaCardV2(JSON.parse(imgData));
            character.avatar = item;
            character.json_data = imgData;
            return character;
        } catch { return {}; }
    }));
    return out.filter(c => c.name);
}

// (mime-types lookup, as SillyTavern's getImages asks it: SillyTavern's own package when it is there)
const IMAGE_EXT = new Set(['apng', 'avif', 'bmp', 'gif', 'heic', 'heif', 'ico', 'jfif', 'jpe', 'jpeg', 'jpg', 'jxl', 'png', 'svg', 'svgz', 'tif', 'tiff', 'webp']);
let mime = null;
try { mime = createRequire(path.join(process.cwd(), 'package.json'))('mime-types'); } catch { mime = null; }
const isImage = file => { const t = mime?.lookup?.(file); return t ? String(t).startsWith('image/') : !mime && IMAGE_EXT.has(path.extname(file).slice(1).toLowerCase()); };
// <root>/User Avatars의 그림들 → 실리 서버의 /api/avatars/get과 같은 목록
export async function readImages(root) {
    let entries = [];
    try { entries = await fs.readdir(path.join(root, 'User Avatars'), { withFileTypes: true }); } catch { return []; }
    return entries.filter(d => d.isFile()).map(d => d.name).filter(isImage).sort(new Intl.Collator().compare);
}
