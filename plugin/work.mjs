// 일꾼 스레드 안에서 도는 것 (docs/PHONE2-PLAN.md "서버 플러그인" 3-2b): 마리나라의 서버 스케줄러 + 진짜 답장 코드(src/).
// plugin/worker.mjs가 plugin/screen.mjs(아무것도 안 하는 화면)를 끼운 뒤에 이 파일을 불러요.
// 브라우저의 답장 코드를 그대로 돌려요: 다시 쓴 것은 없고, 실리의 것(getContext)만 서버 것으로 줘요.
//   - 브라우저만 아는 것(이 채팅의 캐릭터 · 페르소나 · 롤플 끝 메시지 · 실리 연결 방식의 요청 틀)은 브라우저가 남긴 묶음에서 (src/phone2kit.js)
//   - 설정은 사용자 폴더의 settings.json에서 그때그때 (키를 새로 저장하지 않아요)
//   - 저장은 플러그인 저장에 rev를 맞춰서 (그사이 브라우저가 저장했으면 쓰지 않아요)
//   - 실리 서버로 가는 요청(/api/…)은 다리(plugin/bridge.mjs)로 — worker.mjs의 fetch가 넘겨요
// 서버가 줄 수 없는 실리 값은 읽는 순간 오류예요: 모자란 채로 답장을 지어내지 않아요.
// 한 번에 한 세계만 돌려요 (실리의 것이 전역 하나라서).

import fs from 'node:fs/promises';
import path from 'node:path';
import { setContext } from './screen.mjs';
import { makeAutoApp } from './auto.mjs';
import { makeLocks } from './lock.mjs';
import { startServerAutonomousScheduler } from './marinara/server-autonomous-scheduler.service.js';
import { logger } from './log.mjs';

// (Marinara's server scheduler reads the answer of its /api/generate as these events)
const SSE = {
    saved: 'data: {"type":"message_saved","data":{"role":"assistant"}}\n\ndata: {"type":"done"}\n\n',
    discarded: 'data: {"type":"generation_discarded"}\n\ndata: {"type":"done"}\n\n',
    error: text => `data: ${JSON.stringify({ type: 'error', data: String(text || 'Generation failed') })}\n\n`,
};
// (Marinara's server scheduler: a chat a browser reported on within this long is left to the browser)
const RECENT_CLIENT_PRESENCE_MS = 75_000;
// 늦은 답장을 보는 주기 (브라우저의 phone2tick.js와 같아요)
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
export async function startWork({ root, store, st = null, schedule = true }) {
    const G = await import('../src/phone2go.js');
    const { liveWorld, liveKey, enqueueJob } = await import('../src/phone2store.js');
    const { kitOf, kitContext } = await import('../src/phone2kit.js');
    const { intentWhy, chatIdOf } = await import('../src/phone2sched.js');
    const AI = await import('../src/ai.js');
    const SP = await import('../src/stprofile.js');
    const { VERSION } = await import('../src/core.js');
    const { getRecentAutonomousClientPresence } = await import('../src/marinara/autonomous.service.js');

    const readSettings = async () => { try { const v = JSON.parse(await fs.readFile(path.join(root, 'settings.json'), 'utf8')); return obj(v) ? v : {}; } catch (err) { if (err?.code === 'ENOENT') return {}; throw err; } };
    const askSt = async (url, body) => {
        if (!st) throw new Error('실리 서버에 요청을 넘길 길이 없어요');
        return st(url, body);
    };

    // ---- 연결 프로필로 보내기: 실리의 ConnectionManagerRequestService.sendRequest (public/scripts/extensions/shared.js 423–492)를,
    // 브라우저가 실리 자신의 코드로 떠 둔 요청 틀(kit.pt: src/stprofile.js)로. 실리 서버 자신의 처리기로 보내요 (다리)
    const safeName = s => typeof s === 'string' && !!s && !/[\\/]|\.\./.test(s);
    // (a chat-completion preset as SillyTavern's browser has it: its file in the user's "OpenAI Settings" folder, named as the preset)
    const readPreset = async name => {
        if (!safeName(name)) throw new Error('프리셋 이름을 읽을 수 없어요');
        try { const v = JSON.parse(await fs.readFile(path.join(root, 'OpenAI Settings', `${name}.json`), 'utf8')); return obj(v) ? v : null; }
        catch (err) { if (err?.code === 'ENOENT') throw new Error(`실리의 프리셋 "${name}"을 찾을 수 없어요. 실리에서 이 채팅을 한 번 열어 주세요`); throw err; }
    };
    // 이 프로필 요청의 틀 → 틀 | 오류 (이유)
    function profileTemplate(kit, profiles, profileId, over, messages) {
        const tpl = SP.ptFind(kit.pt, profileId, over, messages);
        if (!tpl) throw new Error(kit.ptWhy?.[SP.ptWhyKey(profileId, over)] || '이 연결 프로필의 요청 틀이 아직 없어요. 실리에서 이 채팅을 한 번 열어 두면 만들어져요');
        // (the profile changed in SillyTavern since the template was made: not sent with the old one)
        if (JSON.stringify(tpl.of) !== JSON.stringify(profiles.find(p => p.id === profileId) ?? null)) throw new Error('실리에서 이 연결 프로필이 바뀌었어요. 실리에서 이 채팅을 한 번 열어 두면 맞춰져요');
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
                if (stream) throw new Error('서버에서는 연결 프로필로 흘려 받지 않아요');
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

    // ---- 실리의 것을 서버 것으로
    function contextOf(entry, kit, settings, app) {
        const real = entry.real, k = kitContext(kit), power = obj(settings.power_user) ? settings.power_user : {};
        const ext = obj(settings.extension_settings) ? settings.extension_settings : {};
        // (the connection profiles there are, so a room that picked one is known as such and is never taken for one with nothing
        //  picked. SillyTavern lists only the profiles of a kind it can send — getSupportedProfiles: the ones the browser listed,
        //  kit.profiles; a kit from before that list holds all of them)
        const listed = Array.isArray(kit.profiles) ? new Set(kit.profiles) : null;
        const profiles = Array.isArray(ext.connectionManager?.profiles) ? ext.connectionManager.profiles.filter(p => obj(p) && typeof p.id === 'string' && (!listed || listed.has(p.id))) : [];
        // (the chat's own keys the live phone reads — phone2store.js LIVE_SHARED and 화면 주인 — as the browser left them. Only real.live is saved)
        for (const [key, v] of Object.entries(kit.meta || {})) real[key] = structuredClone(v);
        const base = {
            naServer: true, naTail: kit.tail,
            chatMetadata: { narrative_archive: real }, chatId: entry.sid,
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
            // (SillyTavern's writeExtensionField: the card in memory, then its file through SillyTavern's own merge-attributes)
            writeExtensionField: async (index, key, value) => {
                const ch = k.characters[index], kept = kit.characters?.[index];
                if (!ch) return;
                for (const c of [ch, kept]) if (c) { c.data = obj(c.data) ? c.data : {}; c.data.extensions = obj(c.data.extensions) ? c.data.extensions : {}; c.data.extensions[key] = structuredClone(value); }
                const r = await askSt('/api/characters/merge-attributes', { avatar: ch.avatar, data: { extensions: { [key]: value } } });
                if (!r.ok) throw new Error(`카드에 쓰지 못했어요 (${r.status})`);
            },
            loadWorldInfo: async name => { const r = await askSt('/api/worldinfo/get', { name }); return r.ok ? r.json : null; },
        };
        return new Proxy(base, {
            get(t, key) {
                if (typeof key !== 'string' || key in t) return t[key];
                if (OPTIONAL.has(key) || key === 'then') return undefined;
                throw new Error(`서버에서는 실리의 이 값을 못 써요: ${key}`);
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
                if (!obj(tpl) || !obj(tpl.data)) throw new Error('이 연결 · 모델의 요청 틀이 없어요. 실리에서 이 채팅을 한 번 열어 두면 만들어져요');
                const data = { ...structuredClone(tpl.data), messages };
                for (const key of Array.isArray(tpl.secrets) ? tpl.secrets : []) {
                    if (!AI.ST_TEMPLATE_SECRETS.includes(key)) continue;
                    const v = oai[key];
                    // (SillyTavern fills {{macros}} in this field in the browser: the server cannot)
                    if (typeof v === 'string' && v.includes('{{')) throw new Error(`실리 설정의 ${key}에 매크로({{…}})가 있어서 서버에서는 못 보내요`);
                    data[key] = v;
                }
                return { generate_data: data };
            },
            // (ai.js stLevelPayload: a level on a profile's request, as the browser worked it out with SillyTavern's code — kit.levels)
            levelPayload: (source, model, effort) => {
                const v = obj(kit.levels) ? kit.levels[SP.levelKey(source, model, effort)] : null;
                if (!obj(v)) throw new Error('이 추론 레벨의 요청 값이 아직 없어요. 실리에서 이 채팅을 한 번 열어 두면 만들어져요');
                if (typeof v.why === 'string') throw new Error(v.why);
                return { ...v };
            },
        };
    }
    // 이 세계를 서버가 돌려도 되나 → '' | 안 되는 이유
    //   - 묶음이 있어야 해요
    //   - 확장과 플러그인이 같은 버전이어야 해요: 플러그인은 실리 plugins 폴더의 것, 확장은 실리 확장 폴더의 것이라 따로 올라가요.
    //     다르면 서버가 브라우저와 다른 코드로 답하게 돼요 (실리를 다시 켜면 플러그인이 저절로 올라가요)
    //   - 실리의 그 채팅 파일이 있어야 해요: 채팅을 지웠는데 Orbit에 계속 말을 걸지 않게
    async function blocked(real) {
        const kit = kitOf(real);
        if (!kit) return '서버가 읽을 묶음이 없어요. 실리에서 이 채팅을 한 번 열어 두면 만들어져요';
        if (kit.ver !== VERSION) return `확장(${kit.ver || '?'})과 서버 플러그인(${VERSION})의 버전이 달라요. 실리를 다시 켜면 플러그인이 맞춰져요`;
        const f = kit.chat?.file;
        if (!obj(f) || !safeName(f.id) || (!f.group && !safeName(f.dir))) return '이 Orbit의 실리 채팅을 알 수 없어요. 실리에서 이 채팅을 한 번 열어 주세요';
        const file = f.group ? path.join(root, 'group chats', `${f.id}.jsonl`) : path.join(root, 'chats', f.dir, `${f.id}.jsonl`);
        try { await fs.access(file); } catch { return '실리에 이 채팅이 없어요 (지웠거나 이름을 바꿨어요). 실리에서 이 채팅을 열면 다시 돌아요'; }
        return '';
    }
    // ---- 세계 자물쇠 (plugin/lock.mjs: 마리나라의 채팅마다 하나뿐인 생성 자물쇠). 일꾼이 먼저 건 말 · 늦은 답장을 만드는 동안 쥐어요.
    // 브라우저 탭은 /auto/claim으로 잡아요: 탭이 쥐고 있으면 일꾼은 그 Orbit을 이번엔 건너뛰어요
    const locks = makeLocks(), claim = (sid, by) => locks.claim(sid, by), release = (sid, by) => locks.release(sid, by);

    // 한 번에 하나: 그 세계의 실리 것을 끼우고 일을 해요
    let line = Promise.resolve(), app = null;
    function withWorld(entry, job) {
        const run = line.then(async () => {
            const no = await blocked(entry.real);
            if (no) throw refuse(400, no);
            const kit = kitOf(entry.real);
            const settings = await readSettings();
            setContext(contextOf(entry, kit, settings, app));
            globalThis.__naStOpenai = stStandIn(kit, settings);
            try { return await job(); }
            finally { setContext(null); delete globalThis.__naStOpenai; }
        });
        line = run.catch(() => {});
        return run;
    }

    // (the profiles of the world being run: what its context lists — withWorld put it in)
    const ctxProfiles = () => { try { return globalThis.SillyTavern.getContext().ConnectionManagerRequestService.getSupportedProfiles(); } catch { return []; } };
    // 이 방의 답장을 서버가 보낼 수 있나 → '' (돼요) | 안 되는 이유. withWorld 안에서 불러요
    async function cannot(real, roomId) {
        const plan = G.liveReplyPlan(real, roomId);
        if (plan.profile) {
            if (plan.profile.missing) return '이 방에 고른 연결 프로필을 실리에서 찾을 수 없어요';
            if (!st) return '실리 서버에 요청을 넘길 길이 없어요';
            const kit = kitOf(real), all = ctxProfiles();
            let over = null;
            if (plan.profile.level) { try { over = await AI.stLevelPayload(plan.profile.level.source, plan.profile.level.model, plan.profile.level.effort); } catch (err) { return String(err?.message || err); } }
            // (a reply's request: a system part and the texts)
            try { profileTemplate(kit, all, plan.profile.id, over, [{ role: 'system', content: '' }, { role: 'user', content: '' }]); } catch (err) { return String(err?.message || err); }
            return '';
        }
        if (!plan.t) return plan.raw ? '실리에서 고른 연결 프로필이 없어요. 실리의 연결 관리자에서 프로필을 하나 골라 두면 실리를 닫아도 와요' : '초안 모델이 없어요 (⚙ 설정 → AI 모델 → 초안 모델)';
        if (plan.t.mode === 'custom') return '';
        if (!st) return '실리 서버에 요청을 넘길 길이 없어요';
        if (plan.t.mode === 'source') {
            try { if (!await AI.stSourceTemplate(plan.t, plan)) return '이 연결 · 모델은 실리가 메시지를 고쳐 보내서 서버에서는 못 보내요'; }
            catch (err) { return String(err?.message || err); }
        }
        return '';
    }
    const charSaid = (w, room) => { const P = liveKey(w.persona); return (room.messages || []).filter(x => liveKey(x.from) !== P).length; };
    const sleep = ms => new Promise(r => { const t = setTimeout(r, ms); t.unref?.(); });
    // 곧 나갈 답장(먼저 건 말에 다른 캐릭터가 이어 답하기: 2~5초 뒤)이 있으면 그때까지 기다렸다가 돌려요
    async function runSoon(real) {
        for (let i = 0; i < 6; i++) {
            const w = liveWorld(real), now = Date.now();
            const next = (w?.queue?.jobs || []).filter(j => j.kind === 'reply' && j.state === 'waiting' && j.notBefore > now && j.notBefore - now <= 6000).map(j => j.notBefore).sort((a, b) => a - b)[0];
            if (!next) return;
            await sleep(next - now + 50);
            await G.liveGo(real);
        }
    }

    // 마리나라 스케줄러의 /api/generate: 그 캐릭터가 먼저 거는 말 하나 → { statusCode, payload (SSE 글) }
    async function generate({ payload, entry: had, roomId }) {
        // (the browser is writing in this Orbit now: not now — Marinara's 409 for a chat with a generation running.
        //  Held, the Orbit is read again: what the browser saved before it let go is what this reply is judged on)
        if (!claim(had.sid, 'server').ok) return { statusCode: 409, payload: 'the browser is writing in this Orbit now' };
        try {
            const entry = await app.open(had.sid);
            const real = entry?.real, w = real && liveWorld(real), room = w?.messenger?.rooms?.[roomId];
            const name = room?.members?.find(n => liveKey(n) === payload.forCharacterId);
            if (!room || !name || !w.phones?.[liveKey(name)]) return { statusCode: 200, payload: SSE.discarded };
            return await withWorld(entry, async () => {
                const no = await cannot(real, roomId);
                if (no) throw refuse(400, no);
                const now = Date.now();
                // (a reply already on its way in this room, or the room resting after a failure: not now — as the browser's own check)
                if (w.queue.jobs.some(j => j.room === roomId && j.kind === 'reply' && (j.state === 'waiting' || j.state === 'running'))) return { statusCode: 409, payload: 'a reply is already queued in this room' };
                if (room.autoFail?.nextAllowedAt > now) return { statusCode: 409, payload: 'this room is resting after a failure' };
                return await writeFirst(real, w, room, name);
            });
        } catch (err) {
            return { statusCode: err?.statusCode || 500, payload: String(err?.message || err).slice(0, 300) };
        } finally { release(had.sid, 'server'); }
        async function writeFirst(real, w, room, name) {
            const chatId = chatIdOf(real, roomId);
            const now = Date.now();
            const job = enqueueJob(real, { kind: 'reply', owner: name, room: roomId, at: now, why: intentWhy(real, payload.autonomousIntentKey) || 'You have a free moment.' });
            // (Marinara's server: no presence delay — the scheduler waited it out already —, and the user is away)
            Object.assign(job, { auto: true, timed: true, user: { status: payload.userStatus === 'dnd' ? 'dnd' : payload.userStatus === 'active' ? 'active' : 'idle', activity: String(payload.userActivity || '') } });
            if (payload.autonomousIntentKey) job.intent = payload.autonomousIntentKey;
            room.turn = { spoke: [] };
            const before = charSaid(w, room), fails = room.autoFail?.attempts || 0;
            app.activeGenerations.set(chatId, true);
            let out;
            try { out = await G.liveGo(real); await runSoon(real); }
            finally { app.activeGenerations.delete(chatId); }
            if ((room.autoFail?.attempts || 0) > fails) return { statusCode: 200, payload: SSE.error(room.autoFail.lastError) };
            if (out?.saveError) return { statusCode: 200, payload: SSE.error(`저장하지 못했어요: ${out.saveError}`) };
            return { statusCode: 200, payload: charSaid(w, room) > before ? SSE.saved : SSE.discarded };
        }
    }

    app = makeAutoApp({
        store,
        // (the schedule's zone as the browser reads it: the one set for all schedules, else that person's phone's)
        tzOf: (real, name) => { try { return G.liveTimeZone(real, name) || ''; } catch { return ''; } },
        cardsOf: (real, room) => { const kit = kitOf(real), cards = {}; if (!kit) return cards; for (const n of room.members || []) { const c = (kit.characters || []).find(x => liveKey(x?.name) === liveKey(n)); if (c) cards[liveKey(n)] = c.data || c; } return cards; },
        generate,
        around: (entry, fn) => withWorld(entry, fn),
    });

    // 그 세계를 브라우저가 보고 있나 (어느 방이든 75초 안에 알렸으면)
    const watched = e => { const w = liveWorld(e.real); return Object.keys(w?.messenger?.rooms || {}).some(id => getRecentAutonomousClientPresence(chatIdOf(e.real, id), RECENT_CLIENT_PRESENCE_MS)); };
    // 때가 된 늦은 답장 (바빠서 미뤄 둔 답장: 브라우저의 30초 틱이 하던 일). 서버가 못 보내는 방의 것이 섞여 있으면 그 세계는 안 건드려요
    async function sweepDue() {
        let ran = 0;
        for (const sid of await store.list()) {
            // (the browser is writing in this Orbit now: the next sweep. Held, the Orbit is read after the hold — what the browser saved first)
            if (!claim(sid, 'server').ok) continue;
            try {
                const e = await app.open(sid), w = e && liveWorld(e.real);
                if (!w || watched(e) || await blocked(e.real)) continue;
                const due = () => w.queue.jobs.filter(j => j.kind === 'reply' && j.state === 'waiting' && !(j.notBefore > Date.now()));
                if (!due().length) continue;
                await withWorld(e, async () => {
                    for (const roomId of new Set(due().map(j => j.room))) { const no = await cannot(e.real, roomId); if (no) throw refuse(400, no); }
                    if (watched(e) || !due().length) return;
                    await G.liveGo(e.real);
                    await runSoon(e.real);
                    ran += 1;
                });
            } catch (err) { if (err?.statusCode !== 400) logger.warn(err instanceof Error ? err : {}, '[due-replies] %s: %s', sid, String(err?.message || err)); }
            finally { release(sid, 'server'); }
        }
        return ran;
    }
    // 화면에 보여 줄 것: 이 저장의 방마다 서버가 돌릴 수 있나 → [{ id, room, can, why }]
    async function status(sid) {
        const e = await app.open(String(sid)), w = e && liveWorld(e.real);
        if (!w) return [];
        const rooms = Object.keys(w.messenger?.rooms || {});
        const no = await blocked(e.real);
        if (no) return rooms.map(room => ({ id: chatIdOf(e.real, room), room, can: false, why: no }));
        return withWorld(e, async () => { const out = []; for (const room of rooms) { const why = await cannot(e.real, room); out.push({ id: chatIdOf(e.real, room), room, can: !why, why }); } return out; });
    }
    // 브라우저가 이 저장을 열어 두고 있어요 (30초마다): 그 방들은 서버가 75초 동안 안 건드려요
    async function presence(sid, state) {
        const e = await app.open(String(sid)), w = e && liveWorld(e.real);
        if (!w) return 0;
        const ids = Object.keys(w.messenger?.rooms || {});
        for (const id of ids) app.presence(chatIdOf(e.real, id), state);
        return ids.length;
    }

    let scheduler = null, dueTimer = null, stopped = false;
    const dueLoop = () => { if (stopped) return; dueTimer = setTimeout(() => { sweepDue().catch(err => logger.warn(err instanceof Error ? err : {}, '[due-replies] sweep failed')).finally(dueLoop); }, DUE_MS); dueTimer.unref?.(); };
    if (schedule) { scheduler = startServerAutonomousScheduler(app); dueLoop(); }
    async function stop() {
        stopped = true;
        if (dueTimer) clearTimeout(dueTimer);
        scheduler?.stop();
        await app.close();
        await line.catch(() => {});
    }
    return { app, generate, sweepDue, status, presence, claim, release, stop };
}
