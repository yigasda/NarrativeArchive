// Orbit의 번역 (마리나라의 번역 기능 그대로: src/marinara/translation.service.js · translation.store.js · use-translate.js ·
// translate-text.js · draft-translation.js · use-translator-defaults.js · translator-defaults.js). 이 파일은 그 코드를 우리 저장
// 모양에 잇기만 해요 (우리 것):
//   마리나라의 채팅 = 우리 방 하나 (id: phone2sched.js chatIdOf, `<세계 id>:<방 id>`). 메시지 = 방의 말 하나 (말풍선 하나).
//     답장 하나가 말풍선 여러 개면 마리나라의 "나뉜 답"처럼 앞 말부터 차례로 번역해요.
//   마리나라의 채팅 설정(번역 열쇠) = Orbit의 presence.meta (그림 설명 · 명령 스위치와 같은 자리, 마리나라의 열쇠 이름 그대로).
//   메시지의 extra = 말의 x.extra (translation · translationSource · translationHidden · automaticTranslationSource).
//   마리나라의 연결 = 우리 연결: 'tr' (번역 모델) · 'dr' (초안 모델) · 'ai' (AI 기능 모델) · 'profile:<id>' (실리 연결 프로필).
//   마리나라의 앱 설정 translator-defaults = 확장 설정의 같은 이름 칸.
// 브라우저와 서버 플러그인의 일꾼이 같은 파일을 써요. 일꾼에는 화면이 없어서 알림(toastr)은 아무것도 안 해요.
// DeepL · DeepLX는 없어요 (소망, 2026-11-23).

import { ctx, saveMeta, MODULE, globalSettings } from './core.js';
import { callConn, connSettings, aiProfiles, aiProfileFor, OWN_MODES } from './ai.js';
import { liveWorld, liveKey, setWorldSeed } from './phone2store.js';
import { presenceOf, chatIdOf } from './phone2sched.js';
import { translateText, translateGeneratedMessage } from './marinara/translation.service.js';
import { getChatTranslationConfig, normalizeTranslatorSettings, TRANSLATOR_DEFAULTS_SETTINGS_KEY, TRANSLATOR_SETTINGS_KEYS } from './marinara/translator-defaults.js';
import { DEFAULT_TRANSLATION_SYSTEM_PROMPT } from './marinara/translation-prompt.js';
import { useTranslationStore } from './marinara/translation.store.js';
import { setTranslateIO, useTranslate, invalidateTranslation } from './marinara/use-translate.js';
import { translateText as translateFromStore } from './marinara/translate-text.js';
import { translateDraftText } from './marinara/draft-translation.js';
import { setTranslatorDefaultsIO, useTranslatorDefaults, saveTranslatorDefaultsWithToast } from './marinara/use-translator-defaults.js';
import { formatTextQuotes } from './marinara/quote-format.js';

const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const toast = (kind, text) => { try { globalThis.toastr?.[kind]?.(text); } catch { /* no screen */ } };
// 이 채팅의 Orbit (열린 채팅의 것: 브라우저) — 서버의 일꾼은 부르는 쪽이 real을 줘요
const openReal = () => { try { const md = ctx().chatMetadata; return md && obj(md[MODULE]) ? md[MODULE] : null; } catch { return null; } };
// (whether `real` is the open chat's: as the reply loop tells it — no chat metadata at all counts as open)
const isOpen = real => { try { const md = ctx().chatMetadata; return !md || md[MODULE] === real; } catch { return false; } };
// (the Orbit the screen drew last: liveTranslationOpen)
let shownReal = null;
const metaOf = real => { const p = liveWorld(real)?.presence; return obj(p) && obj(p.meta) ? p.meta : {}; };
const roomIdOf = (real, chatId) => { const w = liveWorld(real), s = String(chatId || ''), at = s.indexOf(':'); return w && at > 0 && s.slice(0, at) === String(w.id) ? s.slice(at + 1) : null; };

// ---- 옛 한국어(ko) 옮기기: 답장 지시문이 한국어를 같이 받던 때(ko)의 것을 마리나라의 번역 칸으로. 하나도 버리지 않아요
//   x.ko → x.extra.translation, 그때의 원문 x.text → x.extra.translationSource (원문을 고치면 ko를 지웠어서, 남은 ko는 지금 원문의
//   번역이에요). 방의 말 · 받아 둔 답장 · 휴지통의 말 모두 → 옮긴 수
export function migrateKo(real) {
    const w = liveWorld(real);
    if (!w) return 0;
    let n = 0;
    const move = x => {
        if (!obj(x) || !('ko' in x)) return;
        const ko = typeof x.ko === 'string' ? x.ko : '';
        delete x.ko;
        if (ko.trim() && !(obj(x.extra) && typeof x.extra.translation === 'string' && x.extra.translation)) x.extra = { ...(obj(x.extra) ? x.extra : {}), translation: ko, translationSource: String(x.text ?? '') };
        n++;
    };
    for (const room of Object.values(w.messenger?.rooms || {})) {
        for (const x of room?.messages || []) move(x);
        for (const rec of Object.values(room?.swipes || {})) for (const v of Array.isArray(rec?.list) ? rec.list : []) for (const x of Array.isArray(v) ? v : []) move(x);
        for (const t of Array.isArray(room?.trash) ? room.trash : []) {
            move(t?.x);
            for (const rec of Array.isArray(t?.swipes) ? t.swipes : []) for (const x of Array.isArray(rec) ? rec : []) move(x);
            for (const v of Array.isArray(t?.swipes?.list) ? t.swipes.list : []) for (const x of Array.isArray(v) ? v : []) move(x);
        }
    }
    return n;
}

// ---- 설정 (마리나라 TranslationSection의 값: 채팅 메타의 번역 열쇠)
// 방의 번역 설정 (마리나라 getChatTranslationConfig: chatId는 그 방) → TranslationConfig
export const translationConfigOf = (real, roomId) => getChatTranslationConfig(chatIdOf(real, roomId), metaOf(real));
// (자동 번역: 마리나라 generate.routes.ts — chatMeta.autoTranslate === true일 때만)
export const autoTranslateOn = real => metaOf(real).autoTranslate === true;

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
export function liveTranslationSettings(real) {
    const metadata = metaOf(real);
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
//   save: 저장 (기본 saveMeta) → liveTranslationSettings
export async function liveSetTranslation(real, patch = {}, { save = saveMeta } = {}) {
    if (!liveWorld(real)) throw new Error('폰 2가 없습니다.');
    const meta = presenceOf(real).meta;
    for (const [k, v] of Object.entries(obj(patch) ? patch : {})) {
        if (!TRANSLATOR_SETTINGS_KEYS.includes(k) || k === 'translationTargetLang' || k === 'translationPrompt') throw new Error(`알 수 없는 번역 설정입니다: ${k}`);
        if (k === 'translationProvider') { if (v !== 'google' && v !== 'ai') throw new Error('번역 서비스는 google 또는 ai여야 합니다.'); meta[k] = v; continue; }
        if (k === 'translationInputPrompt' || k === 'translationOutputPrompt') { const value = String(v ?? ''); meta[k] = !value.trim() || value.trim() === DEFAULT_TRANSLATION_SYSTEM_PROMPT.trim() ? null : value; continue; }
        if (['autoTranslate', 'translateInput', 'showInputTranslateButton', 'translationDisplayOnly'].includes(k)) { meta[k] = v === true; continue; }
        if (k === 'translationConnectionId' && v && !liveTranslationConnections().some(c => c.id === String(v))) throw new Error('연결을 찾을 수 없습니다.');
        meta[k] = String(v ?? '');
    }
    // (the open room's config follows: Marinara's ChatArea sets it again whenever the chat's metadata changes)
    const cur = useTranslationStore.getState().config.chatId, rid = roomIdOf(real, cur);
    if (rid) useTranslationStore.getState().setConfig(translationConfigOf(real, rid));
    await save();
    return liveTranslationSettings(real);
}

// ---- 새 채팅의 번역 기본값 (마리나라 use-translator-defaults.ts: 확장 설정 'translator-defaults')
const settingsOf = () => { const es = ctx().extensionSettings; if (!es) return null; if (!obj(es[MODULE])) es[MODULE] = {}; return es[MODULE]; };
setTranslatorDefaultsIO({
    readSetting: key => { try { const v = settingsOf()?.[key]; return typeof v === 'string' ? v : ''; } catch { return ''; } },
    writeSetting: async (key, value) => { const s = settingsOf(); if (!s) throw new Error('확장 설정을 찾을 수 없습니다.'); if (value) s[key] = value; else delete s[key]; ctx().saveSettingsDebounced?.(); },
    readChatMetadata: async () => metaOf(savingFrom || openReal()),
    toastSuccess: text => toast('success', text), toastError: text => toast('error', text),
});
// 저장해 둔 기본값이 있나 (마리나라: "기본값 잊기" 단추는 있을 때만)
export const liveTranslatorDefaults = () => useTranslatorDefaults();
// 이 채팅의 번역 설정을 새 채팅의 기본값으로 저장 (real) · 잊기 (null). 알림까지 해요 (마리나라 화면의 알림 글) → 됐으면 true
let savingFrom = null;
export async function liveSaveTranslatorDefaults(real) {
    savingFrom = real || null;
    try { return await saveTranslatorDefaultsWithToast(real ? String(liveWorld(real)?.id || 'orbit') : null); } finally { savingFrom = null; }
}
// (마리나라 chats.storage.ts 1648: 새 채팅의 메타는 번역 기본값부터. 우리의 새 채팅 = 새 Orbit: phone2store.js newWorld)
setWorldSeed(w => {
    let raw = '';
    try { raw = settingsOf()?.[TRANSLATOR_DEFAULTS_SETTINGS_KEY] || ''; } catch { raw = ''; }
    const defaults = normalizeTranslatorSettings(raw);
    if (Object.keys(defaults).length) w.presence = { ...(obj(w.presence) ? w.presence : {}), meta: { ...(obj(w.presence?.meta) ? w.presence.meta : {}), ...defaults } };
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
export const translationConnections = {
    async getWithKey(id) {
        id = String(id || '');
        if (id === 'tr' || id === 'dr') { const t = connSettings(id); return OWN_MODES.includes(t.mode) ? slotConn(id, t) : null; }
        if (id === 'ai') {
            const a = connSettings('ai'), max = savedMax(globalSettings().aiMaxTokens);
            if (OWN_MODES.includes(a.mode)) return slotConn(id, a, max);
            const via = aiProfileFor({ profileNow: true });
            if (via) return via.profile ? profileConn(id, via.profile, max) : null;
            // (SillyTavern's own connection as it is now: its generateRaw — a browser function; the server cannot)
            return { id, kind: 'ai', baseUrl: '-', model: '', storedMaxTokens: max, maxTokensOverride: null, chatComplete: async (messages, o) => {
                const c = ctx();
                if (c.naServer || typeof c.generateRaw !== 'function') throw new Error('선택된 연결 프로필이 없습니다. 실리의 연결 관리자에서 프로필을 선택하세요.');
                return { content: await c.generateRaw({ prompt: messages[1].content, systemPrompt: messages[0].content, responseLength: o.maxTokens }) };
            } };
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
export function translationChats(real, { save = saveMeta } = {}) {
    const P = () => liveKey(liveWorld(real)?.persona);
    const view = (roomId, x) => ({ id: String(x.id), chatId: chatIdOf(real, roomId), role: liveKey(x.from) === P() ? 'user' : 'assistant', content: String(x.text ?? ''), extra: obj(x.extra) ? x.extra : {} });
    const where = messageId => { for (const room of Object.values(liveWorld(real)?.messenger?.rooms || {})) { const x = findMessage(real, room.id, messageId); if (x) return { roomId: room.id, x }; } return null; };
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
            if (JSON.stringify(f.x.extra) !== before) await save();
            return view(f.roomId, f.x);
        },
    };
}

// ---- 자동 번역 (마리나라 generate.routes.ts 1990~2029 · 11862~11873 · 12265 · 16238 · 16278: 답이 저장된 뒤 서버가)
// 답장 하나가 넣은 말들 (그 답의 말풍선, 차례대로)에 "자동 번역이 맡았다"는 표시를 답과 같은 저장에 남겨요 → 표시한 말의 id들
//   (마리나라: 나뉜 답의 앞 조각은 만들 때 extra에, 마지막 조각은 message_saved 전에 updateMessageExtraForSwipe로)
export function markAutomaticTranslation(real, roomId, ids) {
    if (!autoTranslateOn(real)) return [];
    const out = [];
    for (const id of ids || []) {
        const x = findMessage(real, roomId, id);
        if (!x) continue;
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
export function dispatchAutomaticTranslations({ chatId, ids, config, run, log = (...a) => console.warn(...a) }) {
    if (!config || !ids?.length) return Promise.resolve();
    pending.set(chatId, (pending.get(chatId) ?? 0) + 1);
    return (async () => {
        try {
            for (const messageId of ids) {
                try { await run(messageId, config); }
                catch (error) { log('[translate] 메시지 %s의 자동 번역에 실패했습니다', messageId, error); }
            }
        } finally {
            const remaining = (pending.get(chatId) ?? 1) - 1;
            if (remaining > 0) pending.set(chatId, remaining);
            else pending.delete(chatId);
        }
    })();
}
// 말 하나의 자동 번역 (마리나라 translateGeneratedMessage): 저장된 말을 그 설정으로 → 바뀐 말 | null
//   cached: 앞서 받은 번역 (서버 일꾼이 저장이 부딪혀 다시 할 때: 다시 묻지 않아요)
export async function translateGenerated(real, chatId, messageId, config, { save = saveMeta, cached = null, keep = null } = {}) {
    const store = { connections: translationConnections, chats: translationChats(real, { save }) };
    if (cached !== null) store.translateText = async () => ({ translatedText: cached });
    else if (keep) store.translateText = async (s, body, f) => { const out = await translateText(s, body, f); keep(out.translatedText); return out; };
    return translateGeneratedMessage(store, { chatId, messageId, swipeIndex: 0, mode: 'conversation', config });
}
// 브라우저의 자동 번역: 답장 일(liveGo)이 끝난 뒤 → 다 끝나면 풀리는 약속
export function browserAutoTranslate(real, roomId, ids) {
    const config = translationConfigOf(real, roomId), chatId = chatIdOf(real, roomId);
    // (the chat it was for is no longer open: nothing can be saved into it here)
    const save = async () => { if (!isOpen(real)) throw new Error('이 채팅이 열려 있지 않습니다.'); await saveMeta(); };
    return dispatchAutomaticTranslations({ chatId, ids, config, run: id => translateGenerated(real, chatId, id, config, { save }), log: (...a) => console.warn('[narrative-archive]', ...a) });
}

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
    toastError: text => toast('error', text),
    logError: (...a) => console.error('[narrative-archive]', ...a),
});
// 방을 그릴 때 (마리나라 ChatArea 2118~2142): 그 방의 번역 설정을 넣고, 다른 방에서 왔으면 비우고, 말의 extra에서 채워요
export function liveTranslationOpen(real, roomId) {
    const room = liveWorld(real)?.messenger?.rooms?.[roomId];
    if (!room) return;
    shownReal = real;
    migrateKo(real);
    const s = useTranslationStore.getState(), chatId = chatIdOf(real, roomId);
    if (s.config.chatId !== chatId) s.clearAll();
    s.setConfig(translationConfigOf(real, roomId));
    s.seedFromMessages((room.messages || []).map(x => ({ id: String(x.id), content: String(x.text ?? ''), extra: x.extra || null })));
}
// 말 하나를 그릴 값 (마리나라 ConversationMessage 217~221 · 489~495 · ConversationMessageTranslation · 번역 단추)
//   → { translatedText (번역 | null), isTranslating, showTranslationOnly (원문 자리에 번역만), displayedContent (말풍선 글),
//       translationBlock: { text, translating } | null (원문 아래 줄 위 테두리 칸: 번역 중이면 '번역 중…'), buttonTitle }
export function liveTranslationView(real, roomId, x) {
    const s = useTranslationStore.getState(), id = String(x?.id ?? ''), content = String(x?.text ?? '');
    const translatedText = s.translations[id] || null, translationSource = s.translationSources[id], isTranslating = !!s.translating[id];
    const translationDisplayOnly = metaOf(real).translationDisplayOnly === true;
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
export async function liveTranslate(real, roomId, messageId, { onChange = () => {} } = {}) {
    const x = findMessage(real, roomId, messageId);
    if (!x) throw new Error('메시지를 찾을 수 없습니다.');
    liveTranslationOpen(real, roomId);
    const off = useTranslationStore.subscribe(() => { try { onChange(); } catch { /* the screen's own */ } });
    try { await useTranslate().translate(String(x.id), String(x.text ?? ''), chatIdOf(real, roomId), [String(x.text ?? '')]); }
    finally { off(); }
}
// 번역 상태가 바뀔 때마다 (다시 그리기) → 끊기
export const liveTranslationSubscribe = fn => useTranslationStore.subscribe(() => { try { fn(); } catch { /* the screen's own */ } });
// 원문을 고친 말의 아직 안 돌아온 번역을 버려요 (마리나라 invalidateTranslation: 대화 모드는 부르지 않아요. 게임 모드만)
export const liveInvalidateTranslation = messageId => invalidateTranslation(String(messageId));

// ---- 보내는 말 (마리나라 chat-macros.ts prepareUserInputMessage 513~522: 정규식 · 매크로는 Orbit에 없어요)
// 내 메시지 번역이 켜져 있으면 모델 언어로 번역한 글, 실패하면 원문 + onTranslationError (기본: 마리나라의 알림)
export async function livePrepareInput(real, roomId, text, { onTranslationError = () => toast('error', '메시지를 번역하지 못했습니다 — 원문을 보냅니다') } = {}) {
    let message = String(text ?? '');
    const chatMeta = metaOf(real);
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
