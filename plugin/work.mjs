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
import { setZone, setLocale, atServer } from './zone.mjs';

// (Marinara's server scheduler reads the answer of its /api/generate as these events)
const SSE = {
    saved: 'data: {"type":"message_saved","data":{"role":"assistant"}}\n\ndata: {"type":"done"}\n\n',
    discarded: 'data: {"type":"generation_discarded"}\n\ndata: {"type":"done"}\n\n',
    error: text => `data: ${JSON.stringify({ type: 'error', data: String(text || 'Generation failed') })}\n\n`,
};
// 늦은 답장을 보는 주기 (브라우저의 phone2tick.js와 같아요). 기다리는 답장이 있으면 그 시각에 바로 봐요
export const DUE_MS = 30_000;
// 실리의 것 가운데 서버에 없어도 되는 칸 (읽으면 undefined: 읽는 쪽이 없을 때의 길을 가요)
//   generateRaw: 실리 자신의 연결로 보내는 함수 (브라우저 코드) · CONNECT_API_MAP · onlineStatus: 실리 연결의 이름표
//   extractMessageFromData: 실리의 답 읽기 (없으면 ai.js가 같은 모양을 손으로 읽어요)
const OPTIONAL = new Set(['generateRaw', 'CONNECT_API_MAP', 'onlineStatus', 'extractMessageFromData', 'getCurrentChatId', 'eventSource', 'eventTypes', 'event_types', 'saveMetadataDebounced']);
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const refuse = (statusCode, text) => Object.assign(new Error(text), { statusCode });
// root: 사용자 폴더 · store: 플러그인 저장 (plugin/store.mjs의 것, 또는 그것을 부르는 것)
// st(path, body) → { ok, status, json } : 실리 서버의 /api/… 처리기를 불러요 (없으면 null: 실리 연결로는 못 보내요)
// schedule: false면 스케줄러 · 늦은 답장 보기를 켜지 않아요 (테스트가 손으로 돌려요)
// from: 'extension' (실리의 확장 폴더의 코드: plugin/code.mjs) · 'plugin' (이 플러그인 폴더의 코드)
export async function startWork({ root, store, st = null, schedule = true, from = 'plugin' }) {
    const G = await import('../src/phone2go.js');
    const AI = await import('../src/ai.js');
    const { liveWorld, liveKey, enqueueJob, LIVE_SHARED, renamePersona } = await import('../src/phone2store.js');
    const { kitOf, cardsFor } = await import('../src/phone2kit.js');
    const { intentWhy, chatIdOf } = await import('../src/phone2sched.js');
    const { VERSION } = await import('../src/core.js');
    // 번역 (마리나라의 번역 기능: src/phone2translate.js). 답장 뒤의 자동 번역은 일꾼이 해요 (마리나라는 서버가 해요)
    const TR = await import('../src/phone2translate.js');
    // 실리 브라우저의 요청 코드를 옮긴 것 (plugin/st: 실리 1.19.1 그대로). naload.js가 먼저예요: power-user.js를 script.js보다 먼저 불러요(실리의 차례)
    const STL = await import('./st/naload.js');
    // (SillyTavern's connection check — online_status, the model lists, the chosen model's correction —, its replies kept while the
    //  settings stay the same: plugin/st/nastatus.js)
    const STS = await import('./st/nastatus.js');
    const STP = {
        script: await import('./st/public/script.js'), groups: await import('./st/public/scripts/group-chats.js'), power: await import('./st/public/scripts/power-user.js'),
        oai: await import('./st/public/scripts/openai.js'), context: await import('./st/public/scripts/st-context.js'), ext: await import('./st/public/scripts/extensions.js'), fetch: await import('./st/public/naFetch.js'),
        custom: await import('./st/public/scripts/custom-request.js'), textgen: await import('./st/public/scripts/textgen-settings.js'),
    };

    const readSettings = async () => { try { const v = JSON.parse(await fs.readFile(path.join(root, 'settings.json'), 'utf8')); return obj(v) ? v : {}; } catch (err) { if (err?.code === 'ENOENT') return {}; throw err; } };
    // ---- 브라우저의 시간대 · 언어 (src/phone2keepon.js keepDevice가 확장 설정에 적어요: { timeZone, locale, intl, isMobile })
    //   실리 브라우저 코드와 우리 코드는 그 페이지처럼 그 시간대 · 언어로 돌아요(plugin/zone.mjs: 이 스레드만). 아직 안 적었으면 서버 컴퓨터의 것(전과 같아요)
    //   timeZone: Intl의 시간대 · locale: 실리 i18n.js의 localeFile(getCurrentLocale) · intl: Intl의 기본 언어
    //   기기가 둘이면 마지막으로 설정을 저장한 브라우저의 것이에요(settings.json이 하나라서)
    //   규칙: 일마다 settings.json에서 다시 넣고(바뀌면 다음 일부터), 일이 끝나도 되돌리지 않아요 — 일과 일 사이(스케줄러 · 늦은 답장 보기)도 그 시간대예요.
    //   서버 컴퓨터의 시간대 · 언어는 실리 서버의 코드를 옮긴 것만, zone.mjs atServer 안에서 동기로(그사이 다른 코드가 끼어들지 않아요): withWorld
    const STI = await import('./st/public/scripts/i18n.js');
    const badZones = new Set();
    function useDevice(settings) {
        const d = settings.extension_settings?.narrative_archive?.device, dev = obj(d) ? d : {};
        // (Chrome writes Etc/Unknown when it cannot tell the computer's zone, and runs in UTC then)
        const raw = typeof dev.timeZone === 'string' ? dev.timeZone : '', tz = raw === 'Etc/Unknown' ? 'UTC' : raw;
        try { setZone(tz || null); } catch (err) {
            if (!(err instanceof RangeError)) throw err;
            setZone(null);
            if (!badZones.has(tz)) { if (badZones.size >= 100) badZones.clear(); badZones.add(tz); logger.warn('브라우저 시간대를 알 수 없어 서버 시간대를 사용합니다: %s', tz.slice(0, 64)); }
        }
        try { setLocale(typeof dev.intl === 'string' && dev.intl ? dev.intl : null); } catch (err) { if (!(err instanceof RangeError)) throw err; setLocale(null); }
        STI.__naSet({ localeFile: typeof dev.locale === 'string' && dev.locale ? dev.locale.toLowerCase() : 'en' });
    }
    const askSt = async (url, body) => {
        if (!st) throw new Error('실리 서버에 연결할 수 없습니다.');
        return st(url, body);
    };

    // ---- 실리에 보내는 요청: 실리 브라우저 코드를 옮긴 것으로 (plugin/st). settings.json · 프리셋 파일은 일마다 새로 읽어요 (withWorld)
    //   연결 프로필: 실리의 ConnectionManagerRequestService.sendRequest (extensions/shared.js 423~492) 그대로 · 실리 연결 방식: createGenerationParameters 그대로
    //   보내는 곳은 실리 서버 자신의 처리기예요(다리: worker.mjs의 fetch). 실리 코드가 실패를 삼키는 자리(로짓 바이어스 · 금지 토큰의 토큰 요청)는
    //   naFetchFailures에 적혀요: 그러면 바이어스 없이 보내지 않고 이유를 알려요(브라우저는 그 요청이 실패하지 않아요)
    const safeName = s => typeof s === 'string' && !!s && !/[\\/]|\.\./.test(s);
    const stFetch = (url, init = {}) => { const headers = {}; for (const [k, v] of Object.entries(init.headers || {})) if (v !== undefined) headers[k] = v; return globalThis.fetch(url, { ...init, headers }); };
    // (cause: SillyTavern's own error, when it threw one)
    function stFailed(cause) {
        // (a failed model request itself: SillyTavern's own error says why — the provider's message —, not ours)
        const f = STP.fetch.naFetchFailures.find(x => !GENERATE_ROUTES.some(g => String(x.url).startsWith(g)));
        if (!f) return;
        const where = String(f.url).split('?')[0], more = cause ? { cause } : undefined;
        if (f.status === 404) throw new Error(`실리 서버의 ${where}를 쓸 수 없습니다. 서버 플러그인을 업데이트하고 실리를 다시 시작하세요.`, more);
        if (!f.status) throw new Error('실리 서버에 연결할 수 없습니다.', more);
        throw new Error(`실리 서버 요청에 실패했습니다: ${where} (${f.status})`, more);
    }
    const GENERATE_ROUTES = ['/api/backends/chat-completions/generate', '/api/backends/text-completions/generate'];
    const stProfiles = {
        getSupportedProfiles: () => STL.ConnectionManagerRequestService.getSupportedProfiles(),
        async sendRequest(...args) {
            // (streaming: SillyTavern would send the model request and read it as it comes — the server reads whole answers only.
            //  Refused before anything is sent. Our callers never ask for it)
            if (args[3]?.stream) throw new Error('서버에서는 스트리밍을 지원하지 않습니다.');
            STP.fetch.naFetchFailures.length = 0;
            // (SillyTavern's sendRequest wraps any error as "API request failed": when a failure it swallowed stopped the model request,
            //  that failure is the reason — the screen and the window show it)
            let out;
            try { out = await STL.naSendRequest(...args); } catch (err) { stFailed(err); throw err; }
            stFailed();
            return out;
        },
    };
    // (src/ai.js reads SillyTavern's openai.js through globalThis.__naStOpenai: its oai_settings and createGenerationParameters)
    const stOpenai = {
        get oai_settings() { return STP.oai.oai_settings; },
        async createGenerationParameters(...args) {
            STP.fetch.naFetchFailures.length = 0;
            let out;
            try { out = await STP.oai.createGenerationParameters(...args); } catch (err) { stFailed(err); throw err; }
            stFailed();
            return out;
        },
    };

    // (src/phone2translate.js reads SillyTavern's text completion through globalThis.__naStTextgen: the ported TextCompletionService
    //  and the text-completion settings of this job — the page's /scripts/custom-request.js · textgen-settings.js · power-user.js)
    const stTextgen = {
        get TextCompletionService() { return STP.custom.TextCompletionService; },
        getTextGenModel: (...a) => STP.textgen.getTextGenModel(...a), getTextGenServer: (...a) => STP.textgen.getTextGenServer(...a),
        settings: () => STP.textgen.textgenerationwebui_settings, powerUser: () => STP.power.power_user,
    };

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
        // (SillyTavern's extension_settings as its browser holds it — defaults, the connection manager's own, its profiles sorted by
        //  name —: plugin/st/naload.js, read from settings.json for this job)
        const ext = STP.ext.extension_settings;
        // (the chat's own keys the live phone reads — phone2store.js LIVE_SHARED and 화면 주인 —, as the chat file has them now.
        //  Only real.live is saved)
        for (const key of [...LIVE_SHARED, 'phoneScreenHolder']) { if (k.shared[key] !== undefined) real[key] = structuredClone(k.shared[key]); else delete real[key]; }
        const base = {
            naServer: true,
            chat: k.chat,
            chatMetadata: k.chatMetadata, chatId: entry.sid,
            characters: k.characters, characterId: k.characterId, groupId: k.groupId, groups: k.groups, name1: k.name1,
            powerUserSettings: { personas: obj(power.personas) ? power.personas : {}, persona_descriptions: obj(power.persona_descriptions) ? power.persona_descriptions : {}, persona_description: k.persona },
            extensionSettings: ext,
            ConnectionManagerRequestService: stProfiles,
            chatCompletionSettings: STP.oai.oai_settings,
            // (SillyTavern's getContext().getChatCompletionModel — st-context.js 289, openai.js 1722: the chat-completion model of a source)
            getChatCompletionModel: (...a) => STP.oai.getChatCompletionModel(...a),
            mainApi: STP.script.main_api,
            // (SillyTavern's getContext().variables — st-context.js 258~277: the variable macros' {{.x}} · {{$x}} read them while running)
            variables: STP.context.variables,
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

    // ---- 답장 뒤의 자동 번역 (마리나라 generate.routes.ts dispatchAutomaticTranslations 1990~2029: 답이 저장된 뒤 서버가, 생성 자물쇠를
    // 쥐지 않고, 저장된 답의 말을 차례로. 실패는 경고 줄만). phone2go.js liveGo의 translate 자리에 줘요: 그 답의 방 · 말 id들 · 답을 만들기 시작할 때의
    // 번역 설정 → 다 끝나면 풀리는 약속. 그동안 /auto/status의 방마다 translating이 true예요 (마리나라 /generate/status의 translating)
    // 마리나라의 번역은 아무 자물쇠도 쥐지 않아요: 일꾼의 줄(withWorld)은 모델에 묻는 동안 쥐지 않아요.
    //   - Google · 우리 커스텀 API(실리의 것이 필요 없음): 줄 밖에서 번역만 받아 오고(말의 사본에: detached), 넣고 저장하는 것만 줄에서(onLine:
    //     실리의 것은 안 읽어요). 연결은 보낼 때(답장의 일 안: 그 세계의 설정) 찾아 둔 것
    //   - 실리의 것(연결 프로필 · 실리의 지금 연결 · 실리 연결 방식 · Vertex): 실리의 것을 끼운 자리여야 해서, 답 하나를 withWorld 한 번에
    // 넣을 때 저장이 브라우저와 부딪히면(409) 다시 읽고 받은 번역을 그대로 넣어요(두 번까지, 번역은 다시 묻지 않아요).
    // 다시 읽은 말의 글이 번역을 물을 때의 글과 다르면(그사이 고쳤어요) 아무것도 넣지 않아요 (마리나라 expectedContent)
    const onLine = fn => { const run = line.then(fn); line = run.catch(() => {}); return run; };
    const translateAfter = (sid, real) => (roomId, ids, config = TR.translationConfigOf(real, roomId)) => {
        const chatId = chatIdOf(real, roomId);
        // (found now, inside the reply's job: this world's settings. getWithKey reads them before its first await)
        const found = config.provider === 'ai' ? Promise.resolve(TR.translationConnections.getWithKey(config.connectionId)).catch(() => null) : Promise.resolve(null);
        // (→ { source: the text it was asked for, translation } | null)
        const ask = async (e, messageId, connections) => { let got = null; await TR.translateGenerated(e.real, chatId, messageId, config, { detached: true, connections, keep: (translation, source) => { got = { source, translation }; } }); return got; };
        // (the message read again: its text edited since the translation was asked — or on a 409, since the last read — writes
        //  nothing. Marinara's expectedContent: the text read first is the one the translation is saved against)
        const put = async (messageId, got) => {
            for (let attempt = 0; ; attempt++) {
                const e = await app.open(sid);
                if (!e) return null;
                const now = await TR.translationChats(e.real, { detached: true }).getMessage(messageId);
                if (!now || now.content !== got.source) return null;
                try { return await TR.translateGenerated(e.real, chatId, messageId, config, { save: () => app.write(e), cached: got.translation }); }
                catch (err) { if (err?.code === 409 && attempt < 2) continue; throw err; }
            }
        };
        // (which way is known once the connection is found: wrap waits for it, so the dispatch — and its translating count — starts now)
        let outside = true, conn = null, e = null;
        const wrap = async fn => {
            conn = await found;
            outside = config.provider === 'google' || !conn || conn.kind === 'custom';
            if (outside) return fn();
            e = await app.open(sid);
            if (e) await withWorld(e, fn);
        };
        const fixed = { getWithKey: async () => conn };
        const run = async messageId => {
            if (!outside) { const got = await ask(e, messageId, TR.translationConnections); if (got !== null) await put(messageId, got); return; }
            const now = await app.open(sid);
            if (!now) return;
            const got = await ask(now, messageId, fixed);
            if (got !== null) await onLine(() => put(messageId, got));
        };
        return TR.dispatchAutomaticTranslations({ chatId, ids, config, run, wrap, log: (fmt, id, err) => logger.warn(err instanceof Error ? err : {}, fmt, id) });
    };

    // 한 번에 하나: 그 세계의 실리 것을 끼우고 일을 해요
    let line = Promise.resolve(), app = null;
    function withWorld(entry, job) {
        const run = line.then(async () => {
            const no = await blocked(entry.real);
            if (no) throw refuse(400, no);
            const kit = kitOf(entry.real);
            const settings = await readSettings();
            // (the browser's zone and language, for this job and kept after it: SillyTavern's browser code and ours run in them. Only SillyTavern's
            //  server code ported here runs in the server's own, as its server does — inside zone.mjs atServer, synchronously, so no other code
            //  runs in the server's zone in between: stNow's folder reads — stread.mjs readCards' chat name, readImages' order — and naLoadPresets)
            useDevice(settings);
            const now = await stNow(entry.real, kit, settings);
            // (SillyTavern's browser state for this job, as its page would hold it with this chat open: settings.json and the preset
            //  files read now — plugin/st/naload.js, SillyTavern's own loading —, then this chat's names, cards, group, messages,
            //  metadata and persona. Set again for every job: nothing of the one before stays)
            // (SillyTavern's server code: the preset files' order by localeCompare, in the server's language. Its body is synchronous —
            //  readdirSync · readFileSync, no await —: all of it runs inside atServer)
            const presets = await atServer(() => STL.naLoadPresets(root));
            // (with the extensions SillyTavern's page finds — its /api/extensions/discover through the bridge —: the macros of the built-in ones it turns on)
            STL.naLoad(settings, presets, await STL.naDiscover({ root, send: st ? stFetch : null }));
            // (a copy: the chat file's read is frozen, and SillyTavern's code may write into its metadata — {{setvar}} — as the page's)
            now.chatMetadata = { ...structuredClone(now.metadata), narrative_archive: entry.real };
            setContext(contextOf(entry, kit, settings, app, now));
            globalThis.__naStOpenai = stOpenai; globalThis.__naStTextgen = stTextgen;
            try {
                // (the connection SillyTavern's page makes with these settings — its getStatusOpen · getStatusTextgen · getStatusKobold —, from the
                //  replies kept for them, asked again through the bridge when the settings, the keys or the time say so — behind the job, which
                //  uses what is kept. It never throws: without a status — an older bridge, a backend that is down — the request is built as before,
                //  with no connection. Only for a world whose jobs can go through SillyTavern's own request code: usesSt)
                let skip = false;
                try { skip = !usesSt(entry.real); } catch { skip = false; }
                try { await STS.naStatus({ root, send: stFetch, log: text => logger.warn('%s', text), skip }); } catch (err) { logger.warn(err instanceof Error ? err : {}, '상태를 가져오는 중 오류가 발생했습니다'); }
                // (this chat, as the page holds it once the chat is open: after the connection, which the page makes before)
                STP.script.__naSet({ name1: now.name1, name2: now.groupId ? '' : String(now.characters[now.characterId]?.name ?? ''), characters: now.characters, this_chid: now.characterId, chat: now.chat, chat_metadata: now.chatMetadata });
                STP.groups.__naSet({ groups: now.groups, selected_group: now.groupId });
                STP.power.power_user.persona_description = now.persona;
                // (what the page does when it opens the chat for the macros: the author's note's default into this job's metadata copy, no last
                //  expression yet, the expression list — plugin/st/namacros.js. A local classifier's list is asked of SillyTavern through the bridge,
                //  waited for at most 15 seconds and only for a world that uses SillyTavern's connection: skip. Before the bridge is given below)
                await STL.naMacrosJob({ root, send: st ? stFetch : null, skip });
                STP.fetch.__naSetFetch(stFetch);
                // (the persona's name changed in SillyTavern: the live phone's "me" follows before anything is judged — the
                //  browser does it when the phone opens, phone2go.js liveFollowPersona. Only in memory here: it goes into the
                //  store with the job's own save, a reply. A save of its own could meet the browser's — 409 — and fail a
                //  look that only reads; each reading of the Orbit renames it again the same way)
                renamePersona(entry.real, now.name1);
                return await job();
            }
            finally { setContext(null); delete globalThis.__naStOpenai; delete globalThis.__naStTextgen; STP.fetch.__naSetFetch(null); }
        });
        line = run.catch(() => {});
        return run;
    }

    // 이 세계의 일이 실리 자신의 요청 코드를 지날 수 있나 (연결 프로필: stProfiles.sendRequest · 실리 연결 방식: stOpenai.createGenerationParameters).
    // 연결 상태 · 모델 목록(naStatus)을 읽는 것은 그 코드뿐이에요: 커스텀 API · Vertex로만 보내는 세계는 연결 확인을 하지 않아요(공급자 호출 · Azure의 돈 · 기다림 없이).
    // withWorld 안에서(설정을 읽은 뒤) 불러요. 모르면 true
    //   - AI 기능 모델 · 초안 모델 (ai.js askAIOnce · askDraft → callConn: 요약 · 폰 채우기 · 답장의 기본 연결). 실리 연결 방식('source'),
    //     또는 AI 기능 모델이 실리 쪽('st')이고 보낼 프로필이 있을 때 (ai.js aiProfileFor. 없으면 서버는 보내지 않아요)
    //   - 방마다의 답장 (phone2go.js liveReplyPlan · replyRoute: 프로필, 또는 그 방의 연결이 실리 연결 방식)
    //   - 스케줄 · 그림 설명의 연결 (phone2go.js askVia: 프로필)
    //   - 자동 번역의 AI 연결 (phone2translate.js translationConnections): 프로필 · 실리의 지금 연결('ai' 칸이 실리 쪽) · 실리 연결 방식인 칸
    function usesSt(real) {
        const a = AI.connSettings('ai'), d = AI.connSettings('dr');
        if (a.mode === 'source' || d.mode === 'source') return true;
        if (!AI.OWN_MODES.includes(a.mode) && AI.aiProfileFor({ profileNow: true })) return true;
        const tr = TR.autoTranslationConnection(real);
        if (tr.startsWith('profile:') || (tr === 'ai' && !AI.OWN_MODES.includes(a.mode))) return true;
        if ((tr === 'tr' || tr === 'dr') && AI.connSettings(tr).mode === 'source') return true;
        for (const roomId of Object.keys(liveWorld(real)?.messenger?.rooms || {})) {
            const plan = G.liveReplyPlan(real, roomId);
            if (plan.profile || plan.t?.mode === 'source') return true;
        }
        for (const id of [G.liveScheduleConnection(real), G.liveCaptioning(real)?.connectionId]) if (String(id || '').startsWith('profile:')) return true;
        return false;
    }
    // (the profiles of the world being run: what its context lists — withWorld put it in)
    const ctxNow = () => { try { return globalThis.SillyTavern.getContext(); } catch { return null; } };
    // 이 방의 답장을 서버가 보낼 수 있나 → '' (돼요) | 안 되는 이유. withWorld 안에서 불러요
    async function cannot(real, roomId) {
        const plan = G.liveReplyPlan(real, roomId);
        if (plan.profile) {
            if (plan.profile.missing) return '선택한 연결을 사용할 수 없습니다. 다른 연결을 선택하세요.';
            if (!st) return '실리 서버에 연결할 수 없습니다.';
            // (the profile must be one SillyTavern can send — its getSupportedProfiles, with the connection manager on; it throws
            //  "Connection Manager is not available" when that extension is off)
            let all = [];
            try { all = stProfiles.getSupportedProfiles(); } catch (err) { return String(err?.message || err); }
            if (!all.some(p => p?.id === plan.profile.id)) return '선택한 연결을 사용할 수 없습니다. 다른 연결을 선택하세요.';
            return '';
        }
        if (!plan.t) return plan.raw ? '선택된 연결 프로필이 없습니다. 실리의 연결 관리자에서 프로필을 선택하세요.' : '연결이 설정되지 않았습니다.';
        if (plan.t.mode === 'custom') return '';
        if (!st) return '실리 서버에 연결할 수 없습니다.';
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
            try { out = await G.liveGo(real, { lock: serverLock(had.sid), server: true, translate: translateAfter(had.sid, real) }); }
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
    // (why a due reply was not sent, once per reply and reason: the room is then the browser's, and the window says why — 2026-11-23,
    //  a reply came only when the tab was looked at again, and nothing in the window told why)
    const told = new Map();
    const tell = (job, why) => {
        const k = `${job.id}\u0000${why}`;
        if (told.has(k)) return;
        told.set(k, true);
        if (told.size > 200) told.delete(told.keys().next().value);
        logger.warn('[due-replies] %s (%s): 늦은 답장을 보내지 않았습니다. %s', job.owner, job.room, why);
    };
    async function sweepDue() {
        let ran = 0, next = Infinity;
        const waiting = w => w.queue.jobs.filter(j => j.kind === 'reply' && j.state === 'waiting');
        for (const sid of await store.list()) {
            try {
                const e = await app.open(sid), w = e && liveWorld(e.real);
                if (!w) continue;
                const due = () => waiting(w).filter(j => !(j.notBefore > Date.now()));
                const no = await blocked(e.real);
                if (no) { for (const j of due()) tell(j, no); continue; }
                if (due().length) {
                    await withWorld(e, async () => {
                        const skip = new Map();
                        for (const roomId of new Set(due().map(j => j.room))) { const why = await cannot(e.real, roomId); if (why) skip.set(roomId, why); }
                        for (const j of due()) if (skip.has(j.room)) tell(j, skip.get(j.room));
                        if (due().every(j => skip.has(j.room))) return;
                        const lock = serverLock(sid);
                        const enter = async room => {
                            if (skip.has(room)) return null;
                            const out = await lock.enter(room);
                            if (!out) for (const j of due()) if (j.room === room) tell(j, '브라우저 탭이 이 방에서 답장을 만들고 있습니다.');
                            return out;
                        };
                        const before = new Set(due().map(j => j.id));
                        const out = await G.liveGo(e.real, { lock: { enter, renew: lock.renew }, server: true, translate: translateAfter(sid, e.real) });
                        if (out?.ran) ran += 1;
                        for (const j of liveWorld(e.real)?.queue.jobs || []) {
                            if (!before.has(j.id)) continue;
                            if (j.state === 'done') logger.info('[due-replies] %s (%s): 늦은 답장을 보냈습니다.', j.owner, j.room);
                            else if (j.state === 'failed') tell(j, String(j.error || '답장을 만들지 못했습니다.'));
                        }
                    });
                }
                const w2 = liveWorld(e.real);
                for (const j of w2 ? waiting(w2) : []) if (j.notBefore > Date.now()) next = Math.min(next, j.notBefore);
            } catch (err) {
                // (a refusal — the chat file cannot be read … — comes back every 30 seconds: written once)
                const why = String(err?.message || err), k = `${sid}\u0000${why}`;
                if (err?.statusCode === 400) { if (!told.has(k)) { told.set(k, true); logger.warn('[due-replies] %s: 늦은 답장을 보내지 않았습니다. %s', sid, why); } }
                else logger.warn(err instanceof Error ? err : {}, '[due-replies] %s: %s', sid, why);
            }
        }
        nextDue = next;
        return ran;
    }
    // 화면에 보여 줄 것: 이 저장의 방마다 서버가 돌릴 수 있나 → [{ id, room, can, why, translating, translateWhy }]
    //   translating: 그 방에서 일꾼의 자동 번역이 아직 도는 중 (마리나라 /generate/status의 translating: 브라우저는 그게 끝난 뒤 알려요 — phone2keepon.js)
    //   translateWhy: 서버가 그 방의 답장을 자동 번역할 수 없는 이유 ('' = 돼요 · 자동 번역 꺼짐: phone2translate.js translationCannot)
    //   (while a translation runs the worker's line is busy with it: the answer comes at once then, with what was last worked out for
    //    can · why — the browser asks every 1.5 seconds, as Marinara's status route answers at once)
    const lastStatus = new Map();
    async function status(sid) {
        const e = await app.open(String(sid)), w = e && liveWorld(e.real);
        if (!w) return [];
        const rooms = Object.keys(w.messenger?.rooms || {}), tr = room => TR.liveTranslating(e.real, room);
        if (rooms.some(tr)) { const had = lastStatus.get(String(sid)) || []; return rooms.map(room => ({ ...(had.find(r => r.room === room) || { id: chatIdOf(e.real, room), room, can: true, why: '', translateWhy: '' }), translating: tr(room) })); }
        const no = await blocked(e.real);
        const keep = rows => { lastStatus.set(String(sid), rows); if (lastStatus.size > 50) lastStatus.delete(lastStatus.keys().next().value); return rows; };
        if (no) return keep(rooms.map(room => ({ id: chatIdOf(e.real, room), room, can: false, why: no, translating: tr(room), translateWhy: '' })));
        try { return keep(await withWorld(e, async () => { const out = []; for (const room of rooms) { const why = await cannot(e.real, room); out.push({ id: chatIdOf(e.real, room), room, can: !why, why, translating: tr(room), translateWhy: await TR.translationCannot(e.real, room) }); } return out; })); }
        catch (err) { if (err?.statusCode === 400) return keep(rooms.map(room => ({ id: chatIdOf(e.real, room), room, can: false, why: String(err.message), translating: tr(room), translateWhy: '' }))); throw err; }
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
