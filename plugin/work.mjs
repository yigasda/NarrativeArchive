// 일꾼 스레드 안에서 도는 것 (docs/PHONE2-PLAN.md "서버 플러그인" 3-2b): 마리나라의 서버 스케줄러 + 진짜 답장 코드(src/).
// plugin/worker.mjs가 plugin/screen.mjs(아무것도 안 하는 화면)를 끼운 뒤에 이 파일을 불러요.
// 브라우저의 답장 코드를 그대로 돌려요: 다시 쓴 것은 없고, 실리의 것(getContext)만 서버 것으로 줘요.
//   - 이 채팅의 캐릭터 카드 · 그룹 · 페르소나 · 롤플 메시지 · 채팅에 저장된 값은 답장마다 실리 파일에서 새로 (stNow, plugin/stread.mjs)
//   - 브라우저만 아는 것(이 Orbit이 어느 채팅인지 · 실리 연결 방식의 요청 틀)은 브라우저가 남긴 묶음에서 (src/phone2kit.js)
//   - 설정은 사용자 폴더의 settings.json에서 그때그때 (키를 새로 저장하지 않아요)
//   - 저장은 플러그인 저장에 rev를 맞춰서 (그사이 브라우저가 저장했으면 쓰지 않아요)
//   - 실리 서버로 가는 요청(/api/…)은 다리(plugin/bridge.mjs)로 — worker.mjs의 fetch가 넘겨요
// 서버가 줄 수 없는 실리 값은 읽는 순간 오류예요: 모자란 채로 답장을 지어내지 않아요.
// 한 번에 한 세계만 돌려요 (실리의 것이 전역 하나라서).

import fs from 'node:fs/promises';
import path from 'node:path';
import { setContext } from './screen.mjs';
import { makeAutoApp } from './auto.mjs';
import { makeLocks, lockKey } from './lock.mjs';
import { startServerAutonomousScheduler } from './marinara/server-autonomous-scheduler.service.js';
import { logger } from './log.mjs';
import { chatData, chatParts, groupOf, personaFor, personaOf, readCards, readImages, writeExtensionField } from './stread.mjs';

// (Marinara's server scheduler reads the answer of its /api/generate as these events)
const SSE = {
    saved: 'data: {"type":"message_saved","data":{"role":"assistant"}}\n\ndata: {"type":"done"}\n\n',
    discarded: 'data: {"type":"generation_discarded"}\n\ndata: {"type":"done"}\n\n',
    error: text => `data: ${JSON.stringify({ type: 'error', data: String(text || 'Generation failed') })}\n\n`,
};
// 늦은 답장을 보는 주기 (브라우저의 phone2tick.js와 같아요). 기다리는 답장이 있으면 그 시각에 바로 봐요
export const DUE_MS = 30_000;
// 실리의 것 가운데 서버에 없어도 되는 칸 (읽으면 undefined: 읽는 쪽이 없을 때의 길을 가요)
//   generateRaw: 실리 자신의 연결로 보내는 함수 (브라우저 코드) · CONNECT_API_MAP · getChatCompletionModel · onlineStatus: 실리 연결의 이름표
//   extractMessageFromData: 실리의 답 읽기 (없으면 ai.js가 같은 모양을 손으로 읽어요)
const OPTIONAL = new Set(['generateRaw', 'CONNECT_API_MAP', 'getChatCompletionModel', 'onlineStatus', 'extractMessageFromData', 'getCurrentChatId', 'eventSource', 'eventTypes', 'event_types', 'saveMetadataDebounced']);
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const refuse = (statusCode, text) => Object.assign(new Error(text), { statusCode });
// root: 사용자 폴더 · store: 플러그인 저장 (plugin/store.mjs의 것, 또는 그것을 부르는 것)
// st(path, body) → { ok, status, json } : 실리 서버의 /api/… 처리기를 불러요 (없으면 null: 실리 연결로는 못 보내요)
// schedule: false면 스케줄러 · 늦은 답장 보기를 켜지 않아요 (테스트가 손으로 돌려요)
// from: 'extension' (실리의 확장 폴더의 코드: plugin/code.mjs) · 'plugin' (이 플러그인 폴더의 코드)
export async function startWork({ root, store, st = null, schedule = true, from = 'plugin' }) {
    const G = await import('../src/phone2go.js');
    const { liveWorld, liveKey, enqueueJob, LIVE_SHARED, renamePersona } = await import('../src/phone2store.js');
    const { kitOf, cardsFor } = await import('../src/phone2kit.js');
    const { intentWhy, chatIdOf } = await import('../src/phone2sched.js');
    const AI = await import('../src/ai.js');
    const SP = await import('../src/stprofile.js');
    const { VERSION } = await import('../src/core.js');

    const readSettings = async () => { try { const v = JSON.parse(await fs.readFile(path.join(root, 'settings.json'), 'utf8')); return obj(v) ? v : {}; } catch (err) { if (err?.code === 'ENOENT') return {}; throw err; } };
    const askSt = async (url, body) => {
        if (!st) throw new Error('실리 서버에 연결할 수 없습니다.');
        return st(url, body);
    };

    // ---- 연결 프로필로 보내기: 실리의 ConnectionManagerRequestService.sendRequest (public/scripts/extensions/shared.js 423–492)를,
    // 브라우저가 실리 자신의 코드로 떠 둔 요청 틀(kit.pt: src/stprofile.js)로. 실리 서버 자신의 처리기로 보내요 (다리)
    const safeName = s => typeof s === 'string' && !!s && !/[\\/]|\.\./.test(s);
    // (a chat-completion preset as SillyTavern's browser has it: its file in the user's "OpenAI Settings" folder, named as the preset)
    const readPreset = async name => {
        if (!safeName(name)) throw new Error('잘못된 프리셋 이름입니다.');
        try { const v = JSON.parse(await fs.readFile(path.join(root, 'OpenAI Settings', `${name}.json`), 'utf8')); return obj(v) ? v : null; }
        catch (err) { if (err?.code === 'ENOENT') throw new Error(`프리셋을 찾을 수 없습니다: ${name}. 실리에서 이 채팅을 다시 여세요.`); throw err; }
    };
    // 이 프로필 요청의 틀 → 틀 | 오류 (이유)
    function profileTemplate(kit, profiles, profileId, over, messages) {
        const tpl = SP.ptFind(kit.pt, profileId, over, messages);
        if (!tpl) throw new Error(kit.ptWhy?.[SP.ptWhyKey(profileId, over)] || '이 연결 프로필의 요청 틀이 아직 없어요. 실리에서 이 채팅을 한 번 열어 두면 만들어져요');
        // (the profile changed in SillyTavern since the template was made: not sent with the old one)
        if (JSON.stringify(tpl.of) !== JSON.stringify(profiles.find(p => p.id === profileId) ?? null)) throw new Error('연결 프로필이 변경되었습니다. 실리에서 이 채팅을 다시 여세요.');
        return tpl;
    }
    function profileService(kit, settings, ext, all) {
        const disabled = () => Array.isArray(ext.disabledExtensions) && ext.disabledExtensions.includes('connection-manager');
        const oai = obj(settings.oai_settings) ? settings.oai_settings : {}, proxies = Array.isArray(settings.proxies) ? settings.proxies : [];
        return {
            getSupportedProfiles: () => { if (disabled()) throw new Error('Connection Manager is not available'); return all; },
            async sendRequest(profileId, prompt, maxTokens, custom = {}, overridePayload = {}) {
                const { stream, signal, extractData } = { stream: false, signal: null, extractData: true, ...custom };
                if (disabled()) throw new Error('Connection Manager is not available');
                // (SillyTavern's getProfile · validateProfile)
                const profile = all.find(p => p.id === profileId);
                if (!profile) throw new Error(`Profile not found (ID: ${profileId})`);
                if (!profile.api) throw new Error('Select a connection profile that has an API');
                if (stream) throw new Error('서버에서는 스트리밍을 지원하지 않습니다.');
                const messages = Array.isArray(prompt) ? prompt : [{ role: 'user', content: prompt }];
                const tpl = profileTemplate(kit, all, profileId, overridePayload, messages);
                const proxy = tpl.proxy ? proxies.find(p => obj(p) && p.name === tpl.proxy) || null : null, preset = tpl.preset && tpl.api === 'cc' ? await readPreset(tpl.preset) : null;
                const body = SP.fillProfileRequest(tpl, { messages, maxTokens, secret: key => SP.profileSecret(key, { proxy, preset, oai }) });
                try {
                    const r = await fetch(tpl.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-cache', body: JSON.stringify(body), signal: signal ?? new AbortController().signal });
                    const json = await r.json();
                    return SP.readProfileAnswer(tpl, body, json, { ok: r.ok, extractData, oaiSource: oai.chat_completion_source });
                } catch (error) {
                    throw new Error('API request failed', { cause: error });
                }
            },
        };
    }

    // ---- 실리의 것을 답장마다 새로 (실리 브라우저가 이 채팅을 열면 들고 있을 것을, 실리 파일과 실리 서버의 처리기에서)
    //   → { chat, metadata, characters, characterId, groupId, groups, name1, persona }
    const chatFileOf = f => (f.group ? path.join(root, 'group chats', `${f.id}.jsonl`) : path.join(root, 'chats', f.dir, `${f.id}.jsonl`));
    // (read again only when the file changed: the chat file by its time and size, the card list by its folder's — the names,
    //  times and sizes of the .png files, as SillyTavern's own card cache is keyed. The scheduler asks many times a minute,
    //  and SillyTavern's /api/characters/all reads every card and every chat folder)
    const chats = new Map();
    async function chatNow(file) {
        let st = null;
        try { st = await fs.stat(file); } catch (err) { if (err?.code !== 'ENOENT') throw err; }
        // (SillyTavern writes its files whole, to a new file renamed into place: the inode tells a save apart even where the
        //  file system's times are coarse)
        const sig = st ? `${st.ino}:${st.mtimeMs}:${st.size}` : '';
        const had = chats.get(file);
        if (had && had.sig === sig) return had.data;
        // (handed out to every look and reply that follows: frozen, so code that changed it would fail loudly instead of
        //  changing what the next one reads)
        const data = deepFreeze(await chatData(file));
        chats.set(file, { sig, data });
        if (chats.size > 32) chats.delete(chats.keys().next().value);
        return data;
    }
    const deepFreeze = v => { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); for (const x of Object.values(v)) deepFreeze(x); } return v; };
    let cardsHad = null;
    const whole = new Map();
    async function cardsSig() {
        const dir = path.join(root, 'characters');
        let names = [];
        try { names = (await fs.readdir(dir)).filter(n => n.endsWith('.png')).sort(); } catch { return ''; }
        const parts = await Promise.all(names.map(async n => { try { const s = await fs.stat(path.join(dir, n)); return `${n}:${s.ino}:${s.mtimeMs}:${s.size}`; } catch { return `${n}:?`; } }));
        return parts.join('|');
    }
    async function stNow(real, kit, settings) {
        const f = kit.chat.file;
        let data;
        try { data = await chatNow(chatFileOf(f)); } catch (err) { logger.warn(err instanceof Error ? err : {}, '채팅 파일을 읽지 못했습니다'); throw refuse(400, '채팅 파일을 읽을 수 없습니다.'); }
        const { metadata, chat } = chatParts(data, f.group);
        // (the card list, as SillyTavern's getCharacters reads it — /api/characters/all —, and a card that came shallow read whole
        //  as its unshallowCharacter does — /api/characters/get. With no bridge — SillyTavern's handlers could not be put
        //  on it —: the cards read from the characters folder the way that handler reads them, plugin/stread.mjs)
        // (a bridge of an older plugin that does not open these ways yet — 404: the plugin's own files are read once when
        //  SillyTavern starts, an extension update does not change them —: read from the folder too, so the extension's
        //  update is enough)
        // (a bridge that cannot be reached at all — its fetch throws —: the same as one answering an error, a reason on the screen)
        const reach = async (url, body) => { try { return await askSt(url, body); } catch (err) { logger.warn(err instanceof Error ? err : {}, '%s: 실리 서버에 연결할 수 없습니다', url); return { ok: false, status: 0 }; } };
        const viaSt = async (url, own) => {
            const r = st ? await reach(url, {}) : null;
            if (r && r.status !== 404) return r;
            try { return { ok: true, json: await own() }; } catch (err) { logger.warn(err instanceof Error ? err : {}, '%s: 실리 폴더를 읽지 못했습니다', url); return { ok: false }; }
        };
        const sig = await cardsSig();
        if (!cardsHad || cardsHad.sig !== sig || !sig) {
            const got = await viaSt('/api/characters/all', () => readCards(root));
            if (!got.ok || !Array.isArray(got.json)) throw refuse(400, '캐릭터 목록을 읽을 수 없습니다.');
            cardsHad = { sig, list: got.json };
            whole.clear();
        }
        const all = { json: cardsHad.list };
        let group = null;
        if (f.group) {
            let raw = null;
            try { raw = JSON.parse(await fs.readFile(path.join(root, 'groups', `${kit.chat.group.id}.json`), 'utf8')); } catch { raw = null; }
            group = groupOf(raw, all.json);
            if (!group) throw refuse(400, '채팅을 찾을 수 없습니다.');
        }
        const own = group ? null : kit.chat.avatar;
        const characters = cardsFor(all.json, real, { own, members: group?.members || [] }).map(ch => structuredClone(ch));
        // (a shallow card read whole, as SillyTavern does when the chat opens: this chat's character — getChat's
        //  unshallowCharacter — and a group's members — unshallowGroupMembers. Other cards stay as the list has them, as in
        //  the browser)
        const opened = new Set(group ? group.members : own ? [own] : []);
        for (const [i, ch] of characters.entries()) {
            if (!ch.shallow || !opened.has(ch.avatar)) continue;
            if (!whole.has(ch.avatar)) {
                const r = await reach('/api/characters/get', { avatar_url: ch.avatar });
                if (!r.ok || !obj(r.json)) throw refuse(400, '캐릭터 카드를 읽을 수 없습니다.');
                whole.set(ch.avatar, { ...r.json, chat: String(r.json.chat) });
            }
            characters[i] = structuredClone(whole.get(ch.avatar));
        }
        // (the persona: the one last used in this chat — the browser keeps it, phone2keepon.js —, else the one SillyTavern
        //  picks when it opens the chat)
        //  A persona deleted in SillyTavern since — no name for it any more —: picked as SillyTavern does)
        const na = obj(metadata.narrative_archive) ? metadata.narrative_archive : {};
        const named = obj(settings.power_user?.personas) ? settings.power_user.personas : {};
        let avatar = typeof na.stPersona === 'string' && Object.hasOwn(named, na.stPersona) ? na.stPersona : '';
        if (!avatar) {
            const list = await viaSt('/api/avatars/get', () => readImages(root));
            if (!list.ok || !Array.isArray(list.json)) throw refuse(400, '페르소나 목록을 읽을 수 없습니다.');
            avatar = personaFor(settings, { lock: metadata.persona, key: group ? group.id : own, avatars: list.json });
        }
        const { name1, description } = personaOf(settings, avatar);
        const at = own ? characters.findIndex(ch => ch.avatar === own) : -1;
        // (the chat's own card was deleted in SillyTavern — its chat files are kept by default —: SillyTavern cannot open this
        //  chat any more, and the server does not write as a character it has no card for)
        if (own && at < 0) throw refuse(400, '이 채팅의 캐릭터를 더 이상 사용할 수 없습니다.');
        return { chat, metadata, characters, characterId: at >= 0 ? at : undefined, groupId: group ? group.id : null, groups: group ? [group] : [], name1, persona: description, shared: na };
    }

    // ---- 실리의 것을 서버 것으로
    function contextOf(entry, kit, settings, app, k) {
        const real = entry.real, power = obj(settings.power_user) ? settings.power_user : {};
        const ext = obj(settings.extension_settings) ? settings.extension_settings : {};
        // (the connection profiles there are, so a room that picked one is known as such and is never taken for one with nothing
        //  picked. SillyTavern lists only the profiles of a kind it can send — getSupportedProfiles: the ones the browser listed,
        //  kit.profiles; a kit from before that list holds all of them)
        const listed = Array.isArray(kit.profiles) ? new Set(kit.profiles) : null;
        const profiles = Array.isArray(ext.connectionManager?.profiles) ? ext.connectionManager.profiles.filter(p => obj(p) && typeof p.id === 'string' && (!listed || listed.has(p.id))) : [];
        // (the chat's own keys the live phone reads — phone2store.js LIVE_SHARED and 화면 주인 —, as the chat file has them now.
        //  Only real.live is saved)
        for (const key of [...LIVE_SHARED, 'phoneScreenHolder']) { if (k.shared[key] !== undefined) real[key] = structuredClone(k.shared[key]); else delete real[key]; }
        const base = {
            naServer: true,
            chat: k.chat,
            chatMetadata: { ...k.metadata, narrative_archive: real }, chatId: entry.sid,
            characters: k.characters, characterId: k.characterId, groupId: k.groupId, groups: k.groups, name1: k.name1,
            powerUserSettings: { personas: obj(power.personas) ? power.personas : {}, persona_descriptions: obj(power.persona_descriptions) ? power.persona_descriptions : {}, persona_description: k.persona },
            extensionSettings: ext,
            ConnectionManagerRequestService: profileService(kit, settings, ext, profiles),
            chatCompletionSettings: obj(settings.oai_settings) ? settings.oai_settings : {},
            mainApi: typeof settings.main_api === 'string' ? settings.main_api : '',
            saveMetadata: () => app.write(entry),
            // (the browser owns settings.json: nothing the server changes in memory is written there)
            saveSettingsDebounced: () => {},
            setExtensionPrompt: () => {},
            getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
            // (SillyTavern's writeExtensionField — public/scripts/extensions.js 2070~2120 —: the card in memory, then its file
            //  through SillyTavern's own merge-attributes. A failed save is logged, not thrown, as there)
            writeExtensionField: (index, key, value) => writeExtensionField(k.characters, index, key, value, askSt, logger),
            loadWorldInfo: async name => { const r = await askSt('/api/worldinfo/get', { name }); return r.ok ? r.json : null; },
        };
        return new Proxy(base, {
            get(t, key) {
                if (typeof key !== 'string' || key in t) return t[key];
                if (OPTIONAL.has(key) || key === 'then') return undefined;
                throw new Error(`서버에서 사용할 수 없는 값입니다: ${key}`);
            },
        });
    }
    // 실리 연결 방식의 요청: 실리의 브라우저 코드 대신, 브라우저가 남긴 틀에 메시지와 비밀 칸을 채워요 (src/ai.js stSourceTemplate)
    function stStandIn(kit, settings) {
        const oai = obj(settings.oai_settings) ? settings.oai_settings : {};
        return {
            oai_settings: oai,
            createGenerationParameters: async (wanted, model, type, messages) => {
                const tpl = obj(kit.st) ? kit.st[AI.stTemplateKey(wanted, model)] : null;
                if (!obj(tpl) || !obj(tpl.data)) throw new Error('이 연결의 요청 템플릿이 없습니다. 실리에서 이 채팅을 다시 여세요.');
                const data = { ...structuredClone(tpl.data), messages };
                for (const key of Array.isArray(tpl.secrets) ? tpl.secrets : []) {
                    if (!AI.ST_TEMPLATE_SECRETS.includes(key)) continue;
                    const v = oai[key];
                    // (SillyTavern fills {{macros}} in this field in the browser: the server cannot)
                    if (typeof v === 'string' && v.includes('{{')) throw new Error(`${key}에 매크로가 있어 서버에서 보낼 수 없습니다.`);
                    data[key] = v;
                }
                return { generate_data: data };
            },
            // (ai.js stLevelPayload: a level on a profile's request, as the browser worked it out with SillyTavern's code — kit.levels)
            levelPayload: (source, model, effort) => {
                const v = obj(kit.levels) ? kit.levels[SP.levelKey(source, model, effort)] : null;
                if (!obj(v)) throw new Error('이 추론 레벨의 요청 값이 없습니다. 실리에서 이 채팅을 다시 여세요.');
                if (typeof v.why === 'string') throw new Error(v.why);
                return { ...v };
            },
        };
    }
    // 이 세계를 서버가 돌려도 되나 → '' | 안 되는 이유
    //   - 묶음이 있어야 해요
    //   - 일꾼이 플러그인 폴더의 코드로 돌 때만: 확장과 같은 버전이어야 해요 (그 코드는 확장보다 옛것일 수 있어요).
    //     확장 폴더의 코드로 돌 때는 그 코드가 지금 설치된 확장이에요: 페이지가 아직 옛것이어도 멈추지 않아요 (plugin/code.mjs)
    //   - 실리의 그 채팅 파일이 있어야 해요: 채팅을 지웠는데 Orbit에 계속 말을 걸지 않게
    async function blocked(real) {
        const kit = kitOf(real);
        if (!kit) return '서버 데이터가 없습니다. 실리에서 이 채팅을 다시 여세요.';
        // (the worker runs the extension's own code when it can — plugin/code.mjs —: that code is the installed extension, the newest
        //  there is, and a page not reloaded yet does not stop it. Only the plugin folder's own code may be older than the extension)
        if (from !== 'extension' && kit.ver !== VERSION) return `확장(${kit.ver || '?'})과 서버 플러그인(${VERSION}) 버전이 다릅니다. 서버 플러그인을 업데이트하고 실리를 다시 시작하세요.`;
        const f = kit.chat?.file;
        if (!obj(f) || !safeName(f.id) || (f.group ? !safeName(String(kit.chat.group?.id ?? '')) : !safeName(f.dir))) return '연결된 실리 채팅을 찾을 수 없습니다. 실리에서 이 채팅을 다시 여세요.';
        try { await fs.access(chatFileOf(f)); } catch { return '채팅을 찾을 수 없습니다.'; }
        if (f.group) { try { await fs.access(path.join(root, 'groups', `${kit.chat.group.id}.json`)); } catch { return '채팅을 찾을 수 없습니다.'; } }
        return '';
    }
    // ---- 방 자물쇠 (plugin/lock.mjs: 마리나라의 채팅마다 하나뿐인 생성 자물쇠). 일꾼은 그 방의 답장을 만드는 동안 쥐어요.
    // 브라우저 탭은 /auto/claim으로 잡아요: 탭이 쥐고 있는 방은 일꾼이 이번엔 건너뛰어요 (먼저 건 말은 409: 마리나라 스케줄러는 실패로 안 세요)
    const locks = makeLocks();
    const claim = (sid, room, by) => locks.claim(lockKey(sid, room), by), renew = (sid, room, by) => locks.renew(lockKey(sid, room), by), release = (sid, room, by) => locks.release(lockKey(sid, room), by);
    // phone2go.js liveGo의 lock: 일꾼이 그 방에 들어가요 → 놓기 | null (브라우저가 쥐고 있어요). 일꾼의 것은 시간 제한이 없어서 이어 잡지 않아요
    const serverLock = sid => ({ enter: async room => (claim(sid, room, 'server').ok ? () => release(sid, room, 'server') : null), renew: async () => {} });

    // 한 번에 하나: 그 세계의 실리 것을 끼우고 일을 해요
    let line = Promise.resolve(), app = null;
    function withWorld(entry, job) {
        const run = line.then(async () => {
            const no = await blocked(entry.real);
            if (no) throw refuse(400, no);
            const kit = kitOf(entry.real);
            const settings = await readSettings();
            const now = await stNow(entry.real, kit, settings);
            setContext(contextOf(entry, kit, settings, app, now));
            globalThis.__naStOpenai = stStandIn(kit, settings);
            try {
                // (the persona's name changed in SillyTavern: the live phone's "me" follows before anything is judged — the
                //  browser does it when the phone opens, phone2go.js liveFollowPersona. Only in memory here: it goes into the
                //  store with the job's own save, a reply. A save of its own could meet the browser's — 409 — and fail a
                //  look that only reads; each reading of the Orbit renames it again the same way)
                renamePersona(entry.real, now.name1);
                return await job();
            }
            finally { setContext(null); delete globalThis.__naStOpenai; }
        });
        line = run.catch(() => {});
        return run;
    }

    // (the profiles of the world being run: what its context lists — withWorld put it in)
    const ctxNow = () => { try { return globalThis.SillyTavern.getContext(); } catch { return null; } };
    const ctxProfiles = () => { try { return ctxNow().ConnectionManagerRequestService.getSupportedProfiles(); } catch { return []; } };
    // 이 방의 답장을 서버가 보낼 수 있나 → '' (돼요) | 안 되는 이유. withWorld 안에서 불러요
    async function cannot(real, roomId) {
        const plan = G.liveReplyPlan(real, roomId);
        if (plan.profile) {
            if (plan.profile.missing) return '선택한 연결을 사용할 수 없습니다. 다른 연결을 선택하세요.';
            if (!st) return '실리 서버에 연결할 수 없습니다.';
            const kit = kitOf(real), all = ctxProfiles();
            let over = null;
            if (plan.profile.level) { try { over = await AI.stLevelPayload(plan.profile.level.source, plan.profile.level.model, plan.profile.level.effort); } catch (err) { return String(err?.message || err); } }
            // (a reply's request: a system part and the texts)
            try { profileTemplate(kit, all, plan.profile.id, over, [{ role: 'system', content: '' }, { role: 'user', content: '' }]); } catch (err) { return String(err?.message || err); }
            return '';
        }
        if (!plan.t) return plan.raw ? '선택된 연결 프로필이 없습니다. 실리의 연결 관리자에서 프로필을 선택하세요.' : '연결이 설정되지 않았습니다.';
        if (plan.t.mode === 'custom') return '';
        if (!st) return '실리 서버에 연결할 수 없습니다.';
        if (plan.t.mode === 'source') {
            try { if (!await AI.stSourceTemplate(plan.t, plan)) return '이 모델은 서버에서 보낼 수 없습니다.'; }
            catch (err) { return String(err?.message || err); }
        }
        return '';
    }
    const charSaid = (w, room) => { const P = liveKey(w.persona); return (room.messages || []).filter(x => liveKey(x.from) !== P).length; };

    // 마리나라 스케줄러의 /api/generate: 그 캐릭터가 먼저 거는 말 하나 → { statusCode, payload (SSE 글) }
    async function generate({ payload, entry: had, roomId }) {
        // (the browser is writing in this room now: not now — Marinara's 409 for a chat with a generation running.
        //  Held, the Orbit is read again: what the browser saved before it let go is what this reply is judged on)
        if (!claim(had.sid, roomId, 'server').ok) return { statusCode: 409, payload: 'the browser is writing in this room now' };
        try {
            const entry = await app.open(had.sid);
            const real = entry?.real, w = real && liveWorld(real), room = w?.messenger?.rooms?.[roomId];
            const name = room?.members?.find(n => liveKey(n) === payload.forCharacterId);
            if (!room || !name || !w.phones?.[liveKey(name)]) return { statusCode: 200, payload: SSE.discarded };
            return await withWorld(entry, async () => {
                const no = await cannot(real, roomId);
                if (no) throw refuse(400, no);
                const now = Date.now();
                // (a reply already on its way in this room: Marinara's generation lock is held from the moment a reply is asked
                //  for, through its presence delay — generate.routes.ts 1514~1536, conversation-presence-runtime.ts 254~265 —, so
                //  a reply waiting here is a generation running there: 409)
                if (w.queue.jobs.some(j => j.room === roomId && j.kind === 'reply' && (j.state === 'waiting' || j.state === 'running'))) return { statusCode: 409, payload: 'a reply is already queued in this room' };
                return await writeFirst(real, w, room, name);
            });
        } catch (err) {
            return { statusCode: err?.statusCode || 500, payload: String(err?.message || err).slice(0, 300) };
        } finally { release(had.sid, roomId, 'server'); }
        async function writeFirst(real, w, room, name) {
            const chatId = chatIdOf(real, roomId);
            const now = Date.now();
            const job = enqueueJob(real, { kind: 'reply', owner: name, room: roomId, at: now, why: intentWhy(real, payload.autonomousIntentKey) || 'You have a free moment.' });
            // (Marinara's server: no presence delay — the scheduler waited it out already —, and the user is away)
            Object.assign(job, { auto: true, timed: true, user: { status: payload.userStatus === 'dnd' ? 'dnd' : payload.userStatus === 'active' ? 'active' : 'idle', activity: String(payload.userActivity || '') } });
            if (payload.autonomousIntentKey) job.intent = payload.autonomousIntentKey;
            room.turn = { spoke: [] };
            const before = charSaid(w, room);
            app.activeGenerations.set(chatId, true);
            let out;
            try { out = await G.liveGo(real, { lock: serverLock(had.sid), server: true }); }
            finally { app.activeGenerations.delete(chatId); }
            // (the scheduler pauses this chat itself on an error: server-autonomous-scheduler.service.ts recordFailureBackoff)
            if (out?.autoError) return { statusCode: 200, payload: SSE.error(out.autoError) };
            if (out?.saveError) return { statusCode: 200, payload: SSE.error(`저장하지 못했어요: ${out.saveError}`) };
            return { statusCode: 200, payload: charSaid(w, room) > before ? SSE.saved : SSE.discarded };
        }
    }

    app = makeAutoApp({
        store,
        // (the schedule's zone as the browser reads it: the one set for all schedules, else that person's phone's)
        tzOf: (real, name) => { try { return G.liveTimeZone(real, name) || ''; } catch { return ''; } },
        // (read inside around: the cards withWorld just read from SillyTavern)
        cardsOf: (real, room) => { const cards = {}, list = ctxNow()?.characters || []; for (const n of room.members || []) { const c = list.find(x => liveKey(x?.name) === liveKey(n)); if (c) cards[liveKey(n)] = c.data || c; } return cards; },
        generate,
        around: (entry, fn) => withWorld(entry, fn),
    });

    // 때가 된 늦은 답장 (마리나라: 서버가 그 요청 안에서 늦음을 기다렸다가 바로 만들어요. 브라우저가 보고 있는지는 안 봐요 —
    // conversation-presence-runtime.ts 254~321. 브라우저 연결이 끊겨도 계속해요 — generate.routes.ts 1924~1934).
    // 우리는 답장이 줄에 있어서, 때가 되면 일꾼이 그 줄을 돌려요. 브라우저가 쥔 방은 이번엔 건너뛰고(그 방은 브라우저가 쓰는 중),
    // 서버가 보낼 수 없는 방(cannot)도 건너뛰어요(그 방은 브라우저가 보내요). 다음에 볼 시각은 nextDue에
    let nextDue = Infinity;
    async function sweepDue() {
        let ran = 0, next = Infinity;
        const waiting = w => w.queue.jobs.filter(j => j.kind === 'reply' && j.state === 'waiting');
        for (const sid of await store.list()) {
            try {
                const e = await app.open(sid), w = e && liveWorld(e.real);
                if (!w || await blocked(e.real)) continue;
                const due = () => waiting(w).filter(j => !(j.notBefore > Date.now()));
                if (due().length) {
                    await withWorld(e, async () => {
                        const skip = new Set();
                        for (const roomId of new Set(due().map(j => j.room))) if (await cannot(e.real, roomId)) skip.add(roomId);
                        if (due().every(j => skip.has(j.room))) return;
                        const lock = serverLock(sid);
                        const out = await G.liveGo(e.real, { lock: { enter: async room => (skip.has(room) ? null : lock.enter(room)), renew: lock.renew }, server: true });
                        if (out?.ran) ran += 1;
                    });
                }
                const w2 = liveWorld(e.real);
                for (const j of w2 ? waiting(w2) : []) if (j.notBefore > Date.now()) next = Math.min(next, j.notBefore);
            } catch (err) { if (err?.statusCode !== 400) logger.warn(err instanceof Error ? err : {}, '[due-replies] %s: %s', sid, String(err?.message || err)); }
        }
        nextDue = next;
        return ran;
    }
    // 화면에 보여 줄 것: 이 저장의 방마다 서버가 돌릴 수 있나 → [{ id, room, can, why }]
    async function status(sid) {
        const e = await app.open(String(sid)), w = e && liveWorld(e.real);
        if (!w) return [];
        const rooms = Object.keys(w.messenger?.rooms || {});
        const no = await blocked(e.real);
        if (no) return rooms.map(room => ({ id: chatIdOf(e.real, room), room, can: false, why: no }));
        try { return await withWorld(e, async () => { const out = []; for (const room of rooms) { const why = await cannot(e.real, room); out.push({ id: chatIdOf(e.real, room), room, can: !why, why }); } return out; }); }
        catch (err) { if (err?.statusCode === 400) return rooms.map(room => ({ id: chatIdOf(e.real, room), room, can: false, why: String(err.message) })); throw err; }
    }
    // 브라우저가 이 저장을 열어 두고 있어요 (30초마다): 그 방들에는 스케줄러가 75초 동안 먼저 말을 걸지 않아요 (마리나라의 /activity/presence)
    async function presence(sid, state) {
        const e = await app.open(String(sid)), w = e && liveWorld(e.real);
        if (!w) return 0;
        const ids = Object.keys(w.messenger?.rooms || {});
        for (const id of ids) app.presence(chatIdOf(e.real, id), state);
        return ids.length;
    }

    let scheduler = null, dueTimer = null, stopped = false, sweeping = false;
    // (30초마다, 기다리는 답장이 그보다 먼저면 그 시각에)
    const dueLoop = (wait = Math.max(0, Math.min(DUE_MS, nextDue - Date.now()))) => {
        if (stopped) return;
        clearTimeout(dueTimer);
        dueTimer = setTimeout(() => { sweeping = true; sweepDue().catch(err => logger.warn(err instanceof Error ? err : {}, '[due-replies] 확인하지 못했습니다')).finally(() => { sweeping = false; dueLoop(); }); }, wait + 50);
        dueTimer.unref?.();
    };
    // 브라우저가 저장했어요: 새로 기다리는 답장이 있을 수 있어서 곧 다시 봐요
    const poke = () => { if (schedule && !stopped && !sweeping) dueLoop(1000); };
    if (schedule) { scheduler = startServerAutonomousScheduler(app); dueLoop(); }
    async function stop() {
        stopped = true;
        if (dueTimer) clearTimeout(dueTimer);
        scheduler?.stop();
        await app.close();
        await line.catch(() => {});
    }
    return { app, generate, sweepDue, status, presence, claim, renew, release, stop, poke };
}
