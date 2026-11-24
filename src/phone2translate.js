// Orbit의 번역 (마리나라의 번역 기능 그대로: src/marinara/translation.service.js · translation.store.js · use-translate.js ·
// translate-text.js · draft-translation.js · use-translator-defaults.js · translator-defaults.js). 이 파일은 그 코드를 우리 저장
// 모양에 잇기만 해요 (우리 것):
//   마리나라의 채팅 = 우리 방 하나 (id: phone2sched.js chatIdOf, `<세계 id>:<방 id>`). 메시지 = 방의 말 하나 (말풍선 하나).
//     답장 하나가 말풍선 여러 개면 마리나라의 "나뉜 답"처럼 앞 말부터 차례로 번역해요.
//   마리나라의 채팅 설정(번역 열쇠) = 그 방의 room.meta (마리나라처럼 채팅마다: phone2sched.js roomMeta, 마리나라의 열쇠 이름 그대로).
//     새 방은 번역 기본값부터 (마리나라 chats.storage.ts create: setRoomSeed).
//   메시지의 extra = 말의 x.extra (translation · translationSource · translationHidden · automaticTranslationSource).
//   마리나라의 연결 = 우리 연결: 'tr' (번역 모델) · 'dr' (초안 모델) · 'ai' (AI 기능 모델) · 'profile:<id>' (실리 연결 프로필).
//   마리나라의 앱 설정 translator-defaults = 확장 설정의 같은 이름 칸.
// 브라우저와 서버 플러그인의 일꾼이 같은 파일을 써요. 일꾼에는 화면이 없어서 알림(toastr)은 아무것도 안 해요.
// DeepL · DeepLX는 없어요 (소망, 2026-11-23).

import { ctx, saveMeta, MODULE, globalSettings } from './core.js';
import { callConn, connSettings, aiProfiles, aiProfileFor, OWN_MODES } from './ai.js';
import { liveWorld, liveKey, setRoomSeed } from './phone2store.js';
import { chatIdOf, roomMeta, roomMetaW } from './phone2sched.js';
import { translateText, translateGeneratedMessage } from './marinara/translation.service.js';
import { getChatTranslationConfig, normalizeTranslatorSettings, TRANSLATOR_DEFAULTS_SETTINGS_KEY, TRANSLATOR_SETTINGS_KEYS } from './marinara/translator-defaults.js';
import { DEFAULT_TRANSLATION_SYSTEM_PROMPT } from './marinara/translation-prompt.js';
import { useTranslationStore } from './marinara/translation.store.js';
import { setTranslateIO, useTranslate, invalidateTranslation } from './marinara/use-translate.js';
import { translateText as translateFromStore } from './marinara/translate-text.js';
import { translateDraftText } from './marinara/draft-translation.js';
import { setTranslatorDefaultsIO, useTranslatorDefaults, saveTranslatorDefaultsWithToast } from './marinara/use-translator-defaults.js';
import { formatTextQuotes } from './marinara/quote-format.js';
import { estimateTextTokens } from './marinara/token-estimator.js';

const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const toast = (kind, text) => { try { globalThis.toastr?.[kind]?.(text); } catch { /* no screen */ } };
// 이 채팅의 Orbit (열린 채팅의 것: 브라우저) — 서버의 일꾼은 부르는 쪽이 real을 줘요
const openReal = () => { try { const md = ctx().chatMetadata; return md && obj(md[MODULE]) ? md[MODULE] : null; } catch { return null; } };
// (whether `real` is the open chat's: as the reply loop tells it — no chat metadata at all counts as open)
const isOpen = real => { try { const md = ctx().chatMetadata; return !md || md[MODULE] === real; } catch { return false; } };
// (the Orbit the screen drew last: liveTranslationOpen)
let shownReal = null;
// 그 방의 채팅 메타 (마리나라의 chat.metadata)
const metaOf = (real, roomId) => roomMeta(real, roomId);
const roomIdOf = (real, chatId) => { const w = liveWorld(real), s = String(chatId || ''), at = s.indexOf(':'); return w && at > 0 && s.slice(0, at) === String(w.id) ? s.slice(at + 1) : null; };

// ---- 옛 한국어(ko) 옮기기: 답장 지시문이 한국어를 같이 받던 때(ko)의 것을 마리나라의 번역 칸으로. 하나도 버리지 않아요
//   x.ko → x.extra.translation, 그때의 원문 x.text → x.extra.translationSource (원문을 고치면 ko를 지웠어서, 남은 ko는 지금 원문의
//   번역이에요. 지금은 말을 고치기 전에 그 말부터 옮겨요: moveKo). 방의 말 · 받아 둔 답장 · 휴지통의 말, 지운 방
//   (w.messenger.trash: 되살리면 그대로 방이 돼요)의 것까지 모두 → 옮긴 수
//   세계마다 한 번만 훑어요(방을 그릴 때마다 · liveMeta마다 불려요): 다 옮긴 세계는 표시해 두고(메모리, 저장하지 않아요), 다른 쪽
//   (옛 페이지 · 옛 플러그인)의 것이 들어올 수 있는 때 — 플러그인에서 받아 맞출 때('na-live-change') — 표시를 지워 다시 훑어요.
//   서버의 일꾼은 저장이 바뀌면 세계를 새로 읽어서(새 객체) 다시 훑어요
let koMoved = new WeakSet();
export const forgetKoMoved = () => { koMoved = new WeakSet(); };
try { globalThis.document?.addEventListener?.('na-live-change', forgetKoMoved); } catch { /* no screen */ }
// 말 하나의 ko를 옮겨요 (그 말의 지금 글이 ko가 만들어진 글이어야 해요) → 옮겼거나 지웠으면 true
export function moveKo(x) {
    if (!obj(x) || !('ko' in x)) return false;
    const ko = typeof x.ko === 'string' ? x.ko : '';
    delete x.ko;
    if (ko.trim() && !(obj(x.extra) && typeof x.extra.translation === 'string' && x.extra.translation)) x.extra = { ...(obj(x.extra) ? x.extra : {}), translation: ko, translationSource: String(x.text ?? '') };
    return true;
}
export function migrateKo(real) {
    const w = liveWorld(real);
    if (!w || koMoved.has(w)) return 0;
    koMoved.add(w);
    let n = 0;
    const move = x => { if (moveKo(x)) n++; };
    const scan = room => {
        for (const x of room?.messages || []) move(x);
        for (const rec of Object.values(room?.swipes || {})) for (const v of Array.isArray(rec?.list) ? rec.list : []) for (const x of Array.isArray(v) ? v : []) move(x);
        for (const t of Array.isArray(room?.trash) ? room.trash : []) {
            move(t?.x);
            for (const rec of Array.isArray(t?.swipes) ? t.swipes : []) for (const x of Array.isArray(rec) ? rec : []) move(x);
            for (const v of Array.isArray(t?.swipes?.list) ? t.swipes.list : []) for (const x of Array.isArray(v) ? v : []) move(x);
        }
    };
    for (const room of Object.values(w.messenger?.rooms || {})) scan(room);
    for (const t of Array.isArray(w.messenger?.trash) ? w.messenger.trash : []) scan(t?.room);
    return n;
}

// ---- 설정 (마리나라 TranslationSection의 값: 채팅 메타의 번역 열쇠)
// 방의 번역 설정 (마리나라 getChatTranslationConfig: chatId는 그 방) → TranslationConfig
export const translationConfigOf = (real, roomId) => getChatTranslationConfig(chatIdOf(real, roomId), metaOf(real, roomId));
// (자동 번역: 마리나라 generate.routes.ts — chatMeta.autoTranslate === true일 때만. 그 방의 것)
export const autoTranslateOn = (real, roomId) => metaOf(real, roomId).autoTranslate === true;

// 번역에 쓸 연결 목록 (마리나라 ConnectionSelect: 이름은 모델 이름. 우리 칸 이름은 화면에 안 내요)
//   'tr' (번역 모델: 자기 연결이 있을 때. 'AI 기능 모델과 같음'이면 'ai'와 같아서 안 내요) · 'dr' · 'ai' · 'profile:<id>'
let listOf = () => [];
export const setTranslationConnectionList = fn => { listOf = typeof fn === 'function' ? fn : () => []; };
const slotName = t => String((t.mode === 'vertex' ? t.vxModel : t.mode === 'source' ? t.stModel : t.model) || '');
export function liveTranslationConnections() {
    const tr = connSettings('tr'), rows = [];
    if (OWN_MODES.includes(tr.mode)) rows.push({ id: 'tr', name: slotName(tr), model: slotName(tr), provider: tr.mode === 'custom' ? 'custom' : tr.mode === 'vertex' ? 'google_vertex' : String(tr.source || '') });
    for (const c of listOf()) if (c && c.id && !rows.some(r => r.id === c.id)) rows.push({ id: String(c.id), name: String(c.name || ''), model: String(c.model || ''), provider: String(c.provider || '') });
    return rows;
}
// 화면이 그릴 값 (마리나라 TranslationSection.tsx 83~98 · 101~103: 고르기 · 언어 칸 · 프롬프트 칸 · 스위치 넷)
//   → { provider ('google' | 'ai'), inputTargetLanguage, outputTargetLanguage, connectionId ('' = 연결 선택…), inputPrompt ·
//       outputPrompt ('' = 기본 지시문: 칸에는 defaultPrompt를 보여 줘요), autoTranslate, translateInput, showInputTranslateButton,
//       translationDisplayOnly, defaultPrompt, connections }
//   (그 방의 것: liveTranslationSettings(real, 방 id))
export function liveTranslationSettings(real, roomId) {
    const metadata = metaOf(real, roomId);
    const provider = metadata.translationProvider ?? 'google';
    const legacyTargetLanguage = metadata.translationTargetLang ?? 'en';
    const legacyPrompt = typeof metadata.translationPrompt === 'string' ? metadata.translationPrompt : '';
    const readDirectionalPrompt = key => { const value = metadata[key]; if (value === null) return ''; const stored = typeof value === 'string' ? value : legacyPrompt; return stored.trim().length > 0 ? stored : ''; };
    return {
        provider, inputTargetLanguage: metadata.translationInputTargetLang ?? legacyTargetLanguage, outputTargetLanguage: metadata.translationOutputTargetLang ?? legacyTargetLanguage,
        connectionId: metadata.translationConnectionId || '', inputPrompt: readDirectionalPrompt('translationInputPrompt'), outputPrompt: readDirectionalPrompt('translationOutputPrompt'),
        autoTranslate: metadata.autoTranslate === true, translateInput: metadata.translateInput === true, showInputTranslateButton: metadata.showInputTranslateButton === true, translationDisplayOnly: metadata.translationDisplayOnly === true,
        defaultPrompt: DEFAULT_TRANSLATION_SYSTEM_PROMPT, connections: liveTranslationConnections(),
    };
}
// 바꾸기 (마리나라 onMetadataChange: 준 열쇠만). 열쇠는 마리나라의 것 그대로:
//   translationProvider ('google' | 'ai') · translationInputTargetLang · translationOutputTargetLang · translationConnectionId ('' = 연결 선택…) ·
//   translationInputPrompt · translationOutputPrompt (마리나라 updatePrompt: 비었거나 기본 지시문과 같으면 null = 기본) ·
//   autoTranslate · translateInput · showInputTranslateButton · translationDisplayOnly (true | false)
//   save: 저장 (기본 saveMeta) → liveTranslationSettings (그 방의 것: liveSetTranslation(real, 방 id, patch))
export async function liveSetTranslation(real, roomId, patch = {}, { save = saveMeta } = {}) {
    if (!liveWorld(real)) throw new Error('폰 2가 없습니다.');
    const meta = roomMetaW(real, roomId), next = {};
    for (const [k, v] of Object.entries(obj(patch) ? patch : {})) {
        if (!TRANSLATOR_SETTINGS_KEYS.includes(k) || k === 'translationTargetLang' || k === 'translationPrompt') throw new Error(`알 수 없는 번역 설정입니다: ${k}`);
        if (k === 'translationProvider') { if (v !== 'google' && v !== 'ai') throw new Error('번역 서비스는 google 또는 ai여야 합니다.'); next[k] = v; continue; }
        if (k === 'translationInputPrompt' || k === 'translationOutputPrompt') { const value = String(v ?? ''); next[k] = !value.trim() || value.trim() === DEFAULT_TRANSLATION_SYSTEM_PROMPT.trim() ? null : value; continue; }
        if (['autoTranslate', 'translateInput', 'showInputTranslateButton', 'translationDisplayOnly'].includes(k)) { next[k] = v === true; continue; }
        if (k === 'translationConnectionId' && v && !liveTranslationConnections().some(c => c.id === String(v))) throw new Error('연결을 찾을 수 없습니다.');
        next[k] = String(v ?? '');
    }
    // (a connection that cannot translate — SillyTavern's own connection on an API with no way here —: refused now, with why)
    if ('translationProvider' in next || 'translationConnectionId' in next) {
        const after = { ...meta, ...next };
        if (after.translationProvider === 'ai' && after.translationConnectionId) { const c = await translationConnections.getWithKey(after.translationConnectionId); if (c?.cannot) throw new Error(c.cannot); }
    }
    Object.assign(meta, next);
    // (the open room's config follows: Marinara's ChatArea sets it again whenever the chat's metadata changes)
    const cur = useTranslationStore.getState().config.chatId, rid = roomIdOf(real, cur);
    if (rid === roomId) useTranslationStore.getState().setConfig(translationConfigOf(real, rid));
    await save();
    return liveTranslationSettings(real, roomId);
}

// ---- 새 채팅의 번역 기본값 (마리나라 use-translator-defaults.ts: 확장 설정 'translator-defaults')
const settingsOf = () => { const es = ctx().extensionSettings; if (!es) return null; if (!obj(es[MODULE])) es[MODULE] = {}; return es[MODULE]; };
setTranslatorDefaultsIO({
    readSetting: key => { try { const v = settingsOf()?.[key]; return typeof v === 'string' ? v : ''; } catch { return ''; } },
    writeSetting: async (key, value) => { const s = settingsOf(); if (!s) throw new Error('확장 설정을 찾을 수 없습니다.'); if (value) s[key] = value; else delete s[key]; ctx().saveSettingsDebounced?.(); },
    // (the chat it is saved from: that room's settings — chatId is `<세계 id>:<방 id>`)
    readChatMetadata: async chatId => { const r = savingFrom, rid = r && roomIdOf(r, chatId); return rid ? metaOf(r, rid) : {}; },
    toastSuccess: text => toast('success', text), toastError: text => toast('error', text),
});
// 저장해 둔 기본값이 있나 (마리나라: "기본값 잊기" 단추는 있을 때만)
export const liveTranslatorDefaults = () => useTranslatorDefaults();
// 이 채팅(방)의 번역 설정을 새 채팅의 기본값으로 저장 (real, 방 id) · 잊기 (null). 알림까지 해요 (마리나라 화면의 알림 글) → 됐으면 true
let savingFrom = null;
export async function liveSaveTranslatorDefaults(real, roomId = '') {
    savingFrom = real || null;
    try { return await saveTranslatorDefaultsWithToast(real ? chatIdOf(real, roomId) : null); } finally { savingFrom = null; }
}
// (마리나라 chats.storage.ts 1645~1656 create: 새 채팅의 메타는 번역 기본값부터. 우리의 새 채팅 = 새 방: phone2store.js ensureRoom)
setRoomSeed(room => {
    let raw = '';
    try { raw = settingsOf()?.[TRANSLATOR_DEFAULTS_SETTINGS_KEY] || ''; } catch { raw = ''; }
    const defaults = normalizeTranslatorSettings(raw);
    if (Object.keys(defaults).length) room.meta = { ...defaults, ...(obj(room.meta) ? room.meta : {}) };
});
// 설정 프로필을 채팅에 얹을 때의 번역 설정 (마리나라 chat-presets.storage.ts 423~471 · chat-setup-draft.ts 49~59: 프로필의 번역 설정이
// 그대로, 기본값 위에. 채팅이 갖고 있던 번역 설정은 남지 않아요). 우리에게는 아직 프로필 얹기가 없어요: 그때 이걸 써요 → 번역 열쇠들
export function profileTranslatorSettings(profileMetadata, defaults = '') {
    return { ...normalizeTranslatorSettings(defaults), ...normalizeTranslatorSettings(profileMetadata) };
}

// ---- 연결 (마리나라의 connections storage + 제공자): getWithKey(id) → 연결 | null (translation.service.js 머리말)
// (the connection's own max tokens — Marinara's saved defaultParameters.maxTokens —: the draft model's and the translation
//  model's "최대 토큰" (t.max) when set, the AI 기능 모델's (aiMaxTokens). None: Marinara's 4096)
const savedMax = v => (Number(v) > 0 ? Math.floor(Number(v)) : undefined);
function slotConn(id, t, max = savedMax(t.max)) {
    return {
        id, kind: t.mode, baseUrl: t.mode === 'custom' ? String(t.url || '').trim() : '-', model: slotName(t),
        storedMaxTokens: max, maxTokensOverride: null,
        // (a SillyTavern way with no source or model yet: what its request would throw — ai.js stSourceData —, for /auto/status)
        missing: t.mode === 'source' ? (!String(t.source || '') ? '연결 종류를 선택하세요.' : !String(t.stModel || '').trim() ? '모델을 선택하세요.' : '') : '',
        // (Marinara's provider.chatComplete: the system message stays a system message, temperature 0.3, no reasoning level of the job)
        chatComplete: async (messages, o) => ({ content: await callConn(t, messages[0].content, messages[1].content, o.maxTokens, '', true, true, null, o.temperature, null, null) }),
    };
}
function profileConn(id, p, max = undefined) {
    return {
        id, kind: 'profile', baseUrl: '-', model: String(p.model || ''), storedMaxTokens: max, maxTokensOverride: null,
        chatComplete: async (messages, o) => {
            // (temperature 0.3 rides on the profile's request, over its preset's: SillyTavern's sendRequest overridePayload)
            const r = await ctx().ConnectionManagerRequestService.sendRequest(p.id, messages, o.maxTokens, { stream: false, extractData: true, includePreset: true, includeInstruct: true }, { temperature: o.temperature });
            return { content: typeof r === 'string' ? r : r?.content };
        },
    };
}
// SillyTavern's own connection as it is set now (no profile picked): the same request in the browser and on the server
// (SillyTavern's generateRaw is a browser function, and it takes no temperature):
//   chat completion (main_api 'openai') → its source and model (getChatCompletionModel), as a 'source' connection: SillyTavern's
//     createGenerationParameters with system + user, temperature 0.3 and the max tokens (ai.js stSourceData)
//   text completion (main_api 'textgenerationwebui') → SillyTavern's TextCompletionService.processRequest (custom-request.js 293~395,
//     the same its connection profiles send through — extensions/shared.js 465~484) with its type, server and model, the
//     instruct template when instruct mode is on (the messages formatted by it, its stop strings), temperature 0.3, the max tokens.
//     The max tokens also in the keys a backend reads them from, as SillyTavern's own quiet request puts them (textgen-settings.js
//     createTextGenGenerationData: n_predict — llama.cpp — and num_predict — Ollama — = the max tokens, for every type but vLLM ·
//     InfermaticAI · Aphrodite). No stop strings with instruct mode off: processRequest sends none then (custom-request.js 311~313)
//   any other (KoboldAI · NovelAI · Horde): refused — `cannot` says why (the settings screen and /auto/status)
// (SillyTavern's text-completion pieces: the server plugin's ported ones — plugin/work.mjs globalThis.__naStTextgen —, else the page's)
async function stTextgen() {
    if (globalThis.__naStTextgen) return globalThis.__naStTextgen;
    const [CR, TG, PU] = await Promise.all([import('/scripts/custom-request.js'), import('/scripts/textgen-settings.js'), import('/scripts/power-user.js')]);
    return { TextCompletionService: CR.TextCompletionService, getTextGenModel: TG.getTextGenModel, getTextGenServer: TG.getTextGenServer, settings: () => TG.textgenerationwebui_settings, powerUser: () => PU.power_user };
}
// (textgen-settings.js createTextGenGenerationData: the types whose request takes vllmParams · aphroditeParams, not nonAphroditeParams)
const PREDICT_OFF = new Set(['vllm', 'infermaticai', 'aphrodite']);
function stOwnConn(id, max) {
    const c = ctx(), api = String(c.mainApi || '');
    if (api === 'openai') {
        const o = c.chatCompletionSettings || {};
        return slotConn(id, { mode: 'source', source: String(o.chat_completion_source || ''), stModel: String(c.getChatCompletionModel?.(o) || '') }, max);
    }
    if (api === 'textgenerationwebui') {
        return { id, kind: 'textgen', baseUrl: '-', model: '', storedMaxTokens: max, maxTokensOverride: null, chatComplete: async (messages, o) => {
            const T = await stTextgen(), tg = T.settings(), instruct = T.powerUser()?.instruct;
            const r = await T.TextCompletionService.processRequest(
                { stream: false, prompt: messages, max_tokens: o.maxTokens, model: T.getTextGenModel(tg), api_type: tg.type, api_server: T.getTextGenServer(tg.type), temperature: o.temperature, ...(PREDICT_OFF.has(tg.type) ? {} : { n_predict: o.maxTokens, num_predict: o.maxTokens }) },
                { instructName: instruct?.enabled ? instruct.preset : undefined }, true, null);
            return { content: typeof r === 'string' ? r : r?.content };
        } };
    }
    const why = `실리의 지금 API(${api || '?'})로는 AI 번역을 할 수 없습니다. 다른 연결을 선택하세요.`;
    return { id, kind: 'ai', baseUrl: '-', model: '', storedMaxTokens: max, maxTokensOverride: null, cannot: why, chatComplete: async () => { throw new Error(why); } };
}
export const translationConnections = {
    async getWithKey(id) {
        id = String(id || '');
        if (id === 'tr' || id === 'dr') { const t = connSettings(id); return OWN_MODES.includes(t.mode) ? slotConn(id, t) : null; }
        if (id === 'ai') {
            const a = connSettings('ai'), max = savedMax(globalSettings().aiMaxTokens);
            if (OWN_MODES.includes(a.mode)) return slotConn(id, a, max);
            const via = aiProfileFor({ profileNow: true });
            if (via) return via.profile ? profileConn(id, via.profile, max) : null;
            return stOwnConn(id, max);
        }
        if (id.startsWith('profile:')) { const p = aiProfiles().find(x => `profile:${x.id}` === id); return p ? profileConn(id, p) : null; }
        return null;
    },
};

// ---- 메시지 (마리나라 chats storage: getMessage · updateMessageExtraForSwipe). 말은 방의 말 · 받아 둔 답장 안에서 찾아요
function findMessage(real, roomId, messageId) {
    const w = liveWorld(real), room = w?.messenger?.rooms?.[roomId];
    if (!room) return null;
    const id = String(messageId);
    for (const x of room.messages || []) if (String(x?.id) === id) return x;
    for (const rec of Object.values(room.swipes || {})) for (const v of Array.isArray(rec?.list) ? rec.list : []) for (const x of Array.isArray(v) ? v : []) if (String(x?.id) === id) return x;
    return null;
}
// real의 방 하나의 메시지 저장소 (save: 바꾼 뒤 저장)
//   detached: 말의 사본에 써요 (real은 안 바뀌고 저장도 안 해요). 서버의 일꾼이 일꾼의 줄 밖에서 번역만 받아 올 때: plugin/work.mjs
export function translationChats(real, { save = saveMeta, detached = false } = {}) {
    const P = () => liveKey(liveWorld(real)?.persona);
    const view = (roomId, x) => ({ id: String(x.id), chatId: chatIdOf(real, roomId), role: liveKey(x.from) === P() ? 'user' : 'assistant', content: String(x.text ?? ''), extra: obj(x.extra) ? x.extra : {} });
    const copies = new Map();
    const copyOf = x => { if (!copies.has(x)) copies.set(x, { ...x, extra: obj(x.extra) ? { ...x.extra } : undefined }); return copies.get(x); };
    const where = messageId => { for (const room of Object.values(liveWorld(real)?.messenger?.rooms || {})) { const x = findMessage(real, room.id, messageId); if (x) return { roomId: room.id, x: detached ? copyOf(x) : x }; } return null; };
    return {
        async getMessage(messageId) { const f = where(messageId); return f ? view(f.roomId, f.x) : null; },
        // (a message is its own swipe here: swipeIndex is 0. expectedContent: Marinara's check — the text edited since, or the
        //  translation hidden since, writes nothing)
        async updateMessageExtraForSwipe(messageId, _swipeIndex, partial, expectedContent) {
            const f = where(messageId);
            if (!f) return null;
            const extra = obj(f.x.extra) ? f.x.extra : {};
            if (expectedContent !== undefined && (String(f.x.text ?? '') !== expectedContent || extra.translationHidden === true)) return null;
            const before = JSON.stringify(extra);
            f.x.extra = { ...extra, ...partial };
            if (JSON.stringify(f.x.extra) !== before && !detached) await save();
            return view(f.roomId, f.x);
        },
    };
}

// ---- 자동 번역 (마리나라 generate.routes.ts 1990~2029 · 11862~11873 · 12265 · 16238 · 16278: 답이 저장된 뒤 서버가)
// 답장 하나가 넣은 말들 (그 답의 말풍선, 차례대로)에 "자동 번역이 맡았다"는 표시를 답과 같은 저장에 남겨요 → 표시한 말의 id들
//   (마리나라: 나뉜 답의 앞 조각은 만들 때 extra에, 마지막 조각은 message_saved 전에 updateMessageExtraForSwipe로)
//   config: 답을 만들기 시작할 때 잡아 둔 번역 설정 (마리나라 generate.routes.ts 1991 outputTranslationConfig: 표시와 보내기가 같은 값).
//   null이면 자동 번역이 꺼져 있었어요. 글이 없는 말(한 일만)은 표시하지 않아요 (번역할 것이 없어요)
export function markAutomaticTranslation(real, roomId, ids, config = autoTranslateOn(real, roomId) ? translationConfigOf(real, roomId) : null) {
    if (!config) return [];
    const out = [];
    for (const id of ids || []) {
        const x = findMessage(real, roomId, id);
        if (!x || !String(x.text ?? '').trim()) continue;
        x.extra = { ...(obj(x.extra) ? x.extra : {}), automaticTranslationSource: String(x.text ?? '') };
        out.push(String(x.id));
    }
    return out;
}
// 방마다 지금 돌고 있는 자동 번역 수 (마리나라 pendingTranslations: /generate/status의 translating)
const pending = new Map();
export const liveTranslating = (real, roomId) => (pending.get(chatIdOf(real, roomId)) || 0) > 0;
// 자동 번역 보내기 (마리나라 dispatchAutomaticTranslations): 차례대로, 실패는 경고 줄만. 생성 자물쇠를 쥐지 않아요 → 다 끝나면 풀리는 약속
//   real · roomId · ids (markAutomaticTranslation이 준 것) · config (답을 만들 때의 번역 설정) · run(일): 일 하나를 돌리는 자리
//   (브라우저는 그대로, 서버 일꾼은 그 세계를 다시 읽은 자리에서: plugin/work.mjs) · log: 경고 줄
//   wrap(fn): 말들을 다 도는 일을 감싸는 자리 (우리 것. 서버 일꾼이 실리의 연결로 번역할 때 답 하나를 일꾼의 줄 한 번에: plugin/work.mjs).
//     감싸기가 실패하면 남은 말마다 같은 경고 줄
export function dispatchAutomaticTranslations({ chatId, ids, config, run, wrap = fn => fn(), log = (...a) => console.warn(...a) }) {
    if (!config || !ids?.length) return Promise.resolve();
    pending.set(chatId, (pending.get(chatId) ?? 0) + 1);
    return (async () => {
        let next = 0;
        try {
            await wrap(async () => {
                for (; next < ids.length; next++) {
                    const messageId = ids[next];
                    try { await run(messageId, config); }
                    catch (error) { log('[translate] 메시지 %s의 자동 번역에 실패했습니다', messageId, error); }
                }
            });
        } catch (error) {
            for (; next < ids.length; next++) log('[translate] 메시지 %s의 자동 번역에 실패했습니다', ids[next], error);
        } finally {
            const remaining = (pending.get(chatId) ?? 1) - 1;
            if (remaining > 0) pending.set(chatId, remaining);
            else pending.delete(chatId);
        }
    })();
}
// 말 하나의 자동 번역 (마리나라 translateGeneratedMessage): 저장된 말을 그 설정으로 → 바뀐 말 | null
//   cached: 앞서 받은 번역 (그것을 넣기만 해요: 다시 묻지 않아요) · keep(번역, 원문): 받은 번역과 그때 번역한 글을 알려 줘요
//   detached: 말의 사본에만 (real은 그대로, 저장 없음: 번역을 받아 오기만) · connections: 연결 찾기 (빼면 지금 설정에서)
export async function translateGenerated(real, chatId, messageId, config, { save = saveMeta, cached = null, keep = null, detached = false, connections = translationConnections } = {}) {
    const store = { connections, chats: translationChats(real, { save, detached }) };
    if (cached !== null) store.translateText = async () => ({ translatedText: cached });
    else if (keep) store.translateText = async (s, body, f) => { const out = await translateText(s, body, f); keep(out.translatedText, body.text); return out; };
    return translateGeneratedMessage(store, { chatId, messageId, swipeIndex: 0, mode: 'conversation', config });
}
// 브라우저의 자동 번역: 답장 일(liveGo)이 끝난 뒤 → 다 끝나면 풀리는 약속. config: 답을 만들기 시작할 때 잡아 둔 것
//   마리나라는 서버가 번역해서 채팅을 바꾸거나 브라우저를 닫아도 끝까지 해요 ("closing the browser cannot skip translation").
//   브라우저 길은 그러지 못해서, 묻기 전에 "도는 중"을 적어 두고(localStorage) 끝나면(됐든 실패했든) 지워요. 채팅을 바꾸거나 탭을
//   닫아 끊긴 것만 남아서, 그 Orbit이 다시 돌 때 이어서 해요(resumeAutomaticTranslations)
export function browserAutoTranslate(real, roomId, ids, config = translationConfigOf(real, roomId)) {
    const chatId = chatIdOf(real, roomId);
    for (const id of ids || []) { flightPut(chatId, String(id), String(findMessage(real, roomId, id)?.text ?? ''), config); running.add(flightKey(chatId, id)); }
    // (the chat it was for is no longer open: nothing can be saved into it here — not asked either. Cut off, not failed: left in
    //  flight, and asked when that chat's Orbit runs again)
    const closed = () => Object.assign(new Error('이 채팅이 열려 있지 않습니다.'), { cutOff: true });
    const save = async () => { if (!isOpen(real)) throw closed(); await saveMeta(); };
    const run = async id => {
        try {
            if (!isOpen(real)) throw closed();
            const out = await translateGenerated(real, chatId, id, config, { save });
            flightDrop(chatId, id);
            return out;
        } catch (err) { if (!err?.cutOff) flightDrop(chatId, id); throw err; }
        finally { running.delete(flightKey(chatId, id)); }
    };
    return dispatchAutomaticTranslations({ chatId, ids, config, run, log: (fmt, ...a) => console.warn('[narrative-archive] ' + fmt, ...a) });
}
// ---- 브라우저 길의 "도는 중" (localStorage: 페이지를 다시 열어도 남아요. 못 읽고 못 쓰면 없는 것처럼)
//   { [채팅 id]: { [말 id]: { text (물을 때의 글), config (그 답의 번역 설정), tab, at } } }
//   tab: 그 탭 (sessionStorage: 새로 고침해도 같아요) — 다른 탭이 아직 돌리고 있을 수 있어서, 다른 탭의 것은 5분이 지나야 이어서 해요
const FLIGHT = { key: 'narrative_archive:translation-in-flight', otherTabMs: 5 * 60_000, max: 200 };
const flightKey = (chatId, id) => `${chatId}\u0000${id}`;
// (this page's own, running now)
const running = new Set();
const tabId = (() => {
    let id = '';
    try { id = globalThis.sessionStorage?.getItem(FLIGHT.key) || ''; } catch { id = ''; }
    if (!id) { id = Math.random().toString(36).slice(2, 12); try { globalThis.sessionStorage?.setItem(FLIGHT.key, id); } catch { /* no storage */ } }
    return id;
})();
function flightRead() {
    try { const v = JSON.parse(globalThis.localStorage?.getItem(FLIGHT.key) || '{}'); return obj(v) ? v : {}; } catch { return {}; }
}
function flightWrite(all) {
    try {
        const ls = globalThis.localStorage;
        if (!ls) return;
        // (the oldest go first past the cap: a chat deleted while one was cut off keeps nothing for long)
        const rows = Object.entries(all).flatMap(([c, m]) => (obj(m) ? Object.entries(m).map(([id, r]) => [c, id, r]) : []));
        if (rows.length > FLIGHT.max) for (const [c, id] of rows.sort((x, y) => (Number(x[2]?.at) || 0) - (Number(y[2]?.at) || 0)).slice(0, rows.length - FLIGHT.max)) { delete all[c][id]; if (!Object.keys(all[c]).length) delete all[c]; }
        if (Object.keys(all).length) ls.setItem(FLIGHT.key, JSON.stringify(all)); else ls.removeItem(FLIGHT.key);
    } catch { /* no storage */ }
}
function flightPut(chatId, id, text, config) {
    const all = flightRead();
    all[chatId] = { ...(obj(all[chatId]) ? all[chatId] : {}), [id]: { text, config, tab: tabId, at: Date.now() } };
    flightWrite(all);
}
function flightDrop(chatId, id) {
    const all = flightRead(), m = all[chatId];
    if (!obj(m) || !(String(id) in m)) return;
    delete m[String(id)];
    if (!Object.keys(m).length) delete all[chatId];
    flightWrite(all);
}
// 이어서 하기 (우리 것: 마리나라에서는 서버가 끝까지 해서 필요 없어요): 이 브라우저가 맡았다가 끊긴 것만, 그때의 번역 설정으로,
// 방마다 차례로 (마리나라 dispatchAutomaticTranslations처럼 하나씩). 실패한 번역은 다시 묻지 않아요(마리나라: "a failed translation stays
// manually retryable" — 번역 단추로). 서버가 맡은 표시는 서버 몫이에요(적혀 있지 않아요). 자동 번역이 꺼져 있으면 하지 않아요
//   그 말이 없어졌거나 · 글이 바뀌었거나 · 이미 번역됐거나 · 숨겼으면 적힌 것만 지워요
//   translate(방 id, 말 id들, 설정) → 약속 (빼면 browserAutoTranslate) → 하나라도 보냈으면 true
export async function resumeAutomaticTranslations(real, { translate = (roomId, ids, config) => browserAutoTranslate(real, roomId, ids, config) } = {}) {
    const w = liveWorld(real);
    if (!w) return false;
    const all = flightRead(), runs = [];
    for (const room of Object.values(w.messenger?.rooms || {})) {
        const chatId = chatIdOf(real, room.id), rec = all[chatId];
        // (that room's switch: the translation settings are each chat's)
        if (!obj(rec) || !autoTranslateOn(real, room.id)) continue;
        for (const [id, r] of Object.entries(rec)) {
            if (running.has(flightKey(chatId, id))) continue;
            if (r?.tab !== tabId && Date.now() - (Number(r?.at) || 0) < FLIGHT.otherTabMs) continue;
            const x = (room.messages || []).find(y => String(y?.id) === id), e = obj(x?.extra) ? x.extra : {}, text = String(x?.text ?? '');
            const owed = !!x && !!text.trim() && text === r?.text && e.automaticTranslationSource === text && obj(r?.config) && e.translationHidden !== true && e.hiddenFromUser !== true && e.commandOnly !== true
                && !(e.translationSource === text && typeof e.translation === 'string' && e.translation);
            if (!owed) { flightDrop(chatId, id); continue; }
            // (the messages of one reply, in the room's order, go together: one dispatch, as when it was saved)
            const config = r.config, last = runs.at(-1);
            if (last && last.roomId === room.id && sameConfig(last.config, config)) last.ids.push(id); else runs.push({ roomId: room.id, ids: [id], config });
        }
        const order = new Map((room.messages || []).map((y, k) => [String(y?.id), k]));
        for (const r of runs) if (r.roomId === room.id) r.ids.sort((p, q) => order.get(p) - order.get(q));
    }
    for (const r of runs) {
        try { await translate(r.roomId, r.ids, r.config); } catch (err) { console.warn('[narrative-archive] live translate again', err); }
    }
    return runs.length > 0;
}
// 서버가 이 방의 답장을 자동 번역할 수 없는 이유 → '' | 이유 (plugin/work.mjs /auto/status). 자동 번역이 꺼져 있거나 Google이면 ''
export async function translationCannot(real, roomId) {
    if (!autoTranslateOn(real, roomId)) return '';
    const config = translationConfigOf(real, roomId);
    if (config.provider !== 'ai') return '';
    if (!config.connectionId) return 'AI 번역에는 연결 ID가 필요합니다';
    const c = await translationConnections.getWithKey(config.connectionId);
    return !c ? 'API 연결을 찾을 수 없습니다' : c.cannot || c.missing || '';
}
// 그 방의 자동 번역이 쓰는 AI 연결 id ('' = 꺼짐 · Google): 서버가 실리의 연결을 확인해야 하나 (plugin/work.mjs usesSt)
export const autoTranslationConnection = (real, roomId) => { if (!autoTranslateOn(real, roomId)) return ''; const c = getChatTranslationConfig('', metaOf(real, roomId)); return c.provider === 'ai' ? String(c.connectionId || '') : ''; };

// ---- 화면 (마리나라 ChatArea · ConversationMessage · useTranslate)
setTranslateIO({
    translate: body => translateText({ connections: translationConnections }, body),
    // (Marinara's PATCH /chats/:chatId/messages/:messageId/extra: the message's extra, saved — only into the chat that is open)
    patchExtra: async (chatId, messageId, extra) => {
        const real = [openReal(), shownReal].find(r => r && isOpen(r) && roomIdOf(r, chatId)), rid = real && roomIdOf(real, chatId), x = rid && findMessage(real, rid, messageId);
        if (!x) throw new Error('메시지를 찾을 수 없습니다.');
        x.extra = { ...(obj(x.extra) ? x.extra : {}), ...extra };
        await saveMeta();
    },
    // (cacheExtra — Marinara's second step, the query cache's copy of the message — is not given: our message is both the saved
    //  one and the one drawn, the write above is that too)
    toastError: text => toast('error', text),
    logError: (...a) => console.error('[narrative-archive]', ...a),
});
// 방을 그릴 때 (마리나라 ChatArea 2118~2142): 그 방의 번역 설정을 넣고, 다른 방에서 왔으면 비우고, 말의 extra에서 채워요.
// 마리나라는 이걸 그리는 중이 아니라 useEffect에서, 값이 바뀔 때만 해요: 여기서도 바뀐 것이 있을 때만 store에 써요
// (store에 쓰면 구독한 화면이 다시 그리고, 다시 그리면 또 여기로 와요)
const sameConfig = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function liveTranslationOpen(real, roomId) {
    const room = liveWorld(real)?.messenger?.rooms?.[roomId];
    if (!room) return;
    shownReal = real;
    migrateKo(real);
    const s = useTranslationStore.getState(), chatId = chatIdOf(real, roomId), config = translationConfigOf(real, roomId);
    if (s.config.chatId !== chatId) s.clearAll();
    if (!sameConfig(useTranslationStore.getState().config, config)) useTranslationStore.getState().setConfig(config);
    const messages = (room.messages || []).map(x => ({ id: String(x.id), content: String(x.text ?? ''), extra: x.extra || null }));
    // (seeded only when a message has a translation the store does not show yet: what seedFromMessages would change)
    const now = useTranslationStore.getState();
    const fresh = messages.some(m => {
        const e = m.extra;
        if (!obj(e) || now.translating[m.id] || typeof e.translation !== 'string' || !e.translation || e.translationHidden === true || now.hiddenTranslationIds[m.id]) return false;
        return now.translations[m.id] !== e.translation || now.translationSources[m.id] !== (typeof e.translationSource === 'string' ? e.translationSource : m.content);
    });
    if (fresh) now.seedFromMessages(messages);
}
// 말 하나를 그릴 값 (마리나라 ConversationMessage 217~221 · 489~495 · ConversationMessageTranslation · 번역 단추)
//   → { translatedText (번역 | null), isTranslating, showTranslationOnly (원문 자리에 번역만), displayedContent (말풍선 글),
//       translationBlock: { text, translating } | null (원문 아래 줄 위 테두리 칸: 번역 중이면 '번역 중…'), buttonTitle }
export function liveTranslationView(real, roomId, x) {
    const s = useTranslationStore.getState(), id = String(x?.id ?? ''), content = String(x?.text ?? '');
    const translatedText = s.translations[id] || null, translationSource = s.translationSources[id], isTranslating = !!s.translating[id];
    const translationDisplayOnly = metaOf(real, roomId).translationDisplayOnly === true;
    const showTranslationOnly = translationDisplayOnly && !!translatedText && !isTranslating && translationSource === content;
    const shown = showTranslationOnly ? null : translatedText;
    return {
        translatedText, isTranslating, showTranslationOnly, displayedContent: showTranslationOnly ? translatedText : content,
        translationBlock: shown || isTranslating ? { text: isTranslating ? '' : shown, translating: isTranslating } : null,
        buttonTitle: translatedText ? '번역 숨기기' : '번역',
    };
}
// 번역 단추 (마리나라 handleTranslate → useTranslate().translate): 번역이 있고 원문이 그대로면 숨기기(숨김을 저장, 번역은 남겨요),
// 아니면 번역해서 저장. 실패하면 알림만. onChange: 그리기 (번역 중 · 끝)
//   (onChange는 store가 바뀐 그 틱이 끝난 뒤 한 번: 한 틱에 여러 번 바뀌어도, 같은 onChange로 여러 말을 번역해도 한 번 그려요.
//    그리는 중에 store에 쓰는 일이 있어도 거기서 다시 그리지 않아요)
export async function liveTranslate(real, roomId, messageId, { onChange = () => {} } = {}) {
    const x = findMessage(real, roomId, messageId);
    if (!x) throw new Error('메시지를 찾을 수 없습니다.');
    liveTranslationOpen(real, roomId);
    const off = watchDraws(onChange);
    try { await useTranslate().translate(String(x.id), String(x.text ?? ''), chatIdOf(real, roomId), [String(x.text ?? '')]); }
    finally { off(); }
}
// (the draws of the translate buttons pressed now, all of them: one store subscription, and each draw once a tick however many
//  translations share it — 40 picked at once draw once per change, not 40 times)
const draws = new Map();
const drawsDue = new Set();
let drawsOff = null, drawsQueued = false;
function watchDraws(fn) {
    draws.set(fn, (draws.get(fn) || 0) + 1);
    if (!drawsOff) {
        drawsOff = useTranslationStore.subscribe(() => {
            for (const f of draws.keys()) drawsDue.add(f);
            if (drawsQueued) return;
            drawsQueued = true;
            globalThis.queueMicrotask(() => {
                drawsQueued = false;
                const due = [...drawsDue];
                drawsDue.clear();
                for (const f of due) { try { f(); } catch { /* the screen's own */ } }
            });
        });
    }
    return () => {
        const n = (draws.get(fn) || 1) - 1;
        if (n > 0) draws.set(fn, n); else draws.delete(fn);
        if (!draws.size && drawsOff) { drawsOff(); drawsOff = null; }
    };
}
// 번역 상태가 바뀔 때마다 (다시 그리기) → 끊기
export const liveTranslationSubscribe = fn => useTranslationStore.subscribe(() => { try { fn(); } catch { /* the screen's own */ } });
// 프롬프트 칸 아래의 토큰 어림 (마리나라 TranslationSection.tsx 392~397: estimateTextTokens(지금 칸의 글, 비었으면 기본 지시문) →
// client/lib/character-token-count.ts formatEstimatedTokens: en.json "chat.summary.tokenEstimate" "~{{tokens}} tokens", 숫자는 toLocaleString)
export const liveTokenEstimate = text => `~${estimateTextTokens(String(text ?? '')).toLocaleString()} 토큰`;
// 원문을 고친 말의 아직 안 돌아온 번역을 버려요 (마리나라 invalidateTranslation: 대화 모드는 부르지 않아요. 게임 모드만)
export const liveInvalidateTranslation = messageId => invalidateTranslation(String(messageId));

// ---- 보내는 말 (마리나라 chat-macros.ts prepareUserInputMessage 513~522: 정규식 · 매크로는 Orbit에 없어요)
// 내 메시지 번역이 켜져 있으면 모델 언어로 번역한 글, 실패하면 원문 + onTranslationError (기본: 마리나라의 알림)
export async function livePrepareInput(real, roomId, text, { onTranslationError = () => toast('error', '메시지를 번역하지 못했습니다 — 원문을 보냅니다') } = {}) {
    let message = String(text ?? '');
    const chatMeta = metaOf(real, roomId);
    if (chatMeta.translateInput && message.trim()) {
        useTranslationStore.getState().setConfig(translationConfigOf(real, roomId));
        try {
            const translated = await translateFromStore(message, 'input');
            if (translated.trim()) message = translated;
        } catch {
            onTranslationError();
        }
    }
    return message;
}
// 입력창의 번역 단추 (마리나라 ConversationInput handleTranslateDraft: 번역 → 따옴표 모양(마리나라 기본 'straight')) → 바꿀 글 | null
//   빈 결과 · 실패는 마리나라의 알림. 단추는 liveTranslationSettings().showInputTranslateButton일 때 입력칸 옆에
export async function liveTranslateDraft(real, roomId, text) {
    if (!String(text ?? '').trim()) return null;
    useTranslationStore.getState().setConfig(translationConfigOf(real, roomId));
    const translated = await translateDraftText(String(text));
    return translated ? formatTextQuotes(translated, 'straight') : null;
}
