// 우리 것 (실리 파일 아님): 실리 브라우저가 백엔드에 "연결"할 때 받아 두는 것을 서버도 받아요.
//   연결 상태(script.js online_status) · 채팅 완성 모델 목록(openai.js model_list) · 글 완성 모델 목록(textgen-models.js) ·
//   Kobold 기능 표시(kai-settings.js kai_flags) · API 토크나이저 지원 표시(tokenizers.js sessionStorage), 그리고 고른 모델이 목록에 없을 때의 보정.
// 연결 확인 자체는 옮긴 실리 코드 그대로예요: openai.js getStatusOpen · textgen-settings.js getStatusTextgen · kai-settings.js getStatusKobold
// (화면 줄 · 로그 줄만 빠짐, tools/st/gen.mjs). 여기서 하는 것은 셋이에요:
//   1. 그 함수가 부르는 실리 서버의 상태 길(다리)의 답을 캐시해요. 실리 브라우저는 연결할 때 한 번 받아 두고 페이지 내내 써요. 서버도 설정이 그대로면
//      다시 묻지 않아요(공급자 호출 · Azure의 돈이 설정을 바꿀 때만 나가게):
//      - 열쇠 = 사용자 폴더 + main_api + 길 + 실리 코드가 만든 몸통 그대로 + 그 사용자 secrets.json의 파일 번호 · 시각 · 크기
//        (실리 브라우저는 키를 저장하며 다시 연결해요. 실리는 그 파일을 통째로 새로 써서 이름을 바꿔 넣어요: 파일 번호가 바뀌어요)
//      - 성공은 30분 뒤 다시 물어요(로컬 백엔드는 설정 없이 모델을 바꿀 수 있어요). Azure는 다시 묻지 않아요: 실리의 Azure 상태 확인은 진짜 생성
//        요청이라 돈이 들어요(소망 결정 2026-11-23). 실패 · 시간 초과는 1분 뒤 다시. 시간 제한 15초(실리의 상태 길에는 없어요)
//      - 받은 원래 답을 둬요: 실리 코드(목록 · 거르기 · 정렬 · 모델 보정)는 일마다 그 답으로 다시 돌아요(naLoad가 일마다 설정을 새로 읽어요)
//      - 다시 물었는데 실패하면: 실리 브라우저처럼 상태는 no_connection, 목록은 그 열쇠로 전에 받은 것(브라우저는 전 목록을 버리지 않아요)
//      - 옛 다리(그 길이 404): 실패와 같아요. 요청은 지금처럼 보내요(막지 않아요). 실리 창에 열쇠마다 한 번만 알려요
//   2. 화면이 섞인 실리 openai.js saveModelList(2025~2407)의 값 부분을 따라 해요(saveModelListValues, 실리 줄 번호를 적어 둠).
//      고르기 칸의 change가 부르는 onModelChange(5472~)의 모델 값 줄도 같이. 그 함수의 온도 · 문맥 깎기는 안 해요: 브라우저가 그 자리에서
//      settings.json에 저장해서, 서버는 그 저장된 값을 써요
//   3. 실리 창 로그: 옮긴 함수의 로그 줄(일마다 캐시의 답으로 다시 돌아서 같은 줄이 계속 나와요) 대신, 열쇠마다 한 번 한국어로.
// 부르는 곳: plugin/work.mjs withWorld (naLoad 바로 뒤). 실패해도 던지지 않아요: 상태가 없으면 지금처럼(no_connection · 빈 목록) 요청을 보내요.
import fs from 'node:fs/promises';
import path from 'node:path';
// (naload.js first: it loads power-user.js before script.js, SillyTavern's own order)
import './naload.js';
import * as SCRIPT from './public/script.js';
import * as OAI from './public/scripts/openai.js';
import * as TG from './public/scripts/textgen-settings.js';
import * as TGM from './public/scripts/textgen-models.js';
import * as KAI from './public/scripts/kai-settings.js';
import * as GROUPS from './public/scripts/group-chats.js';
import { TOKENIZER_SUPPORTED_KEY, __naSessionStorage } from './public/scripts/tokenizers.js';
import { COMETAPI_IGNORE_PATTERNS } from './public/scripts/constants.js';
import { __naSetFetch } from './public/naFetch.js';

export const STATUS_OK_MS = 30 * 60 * 1000;
export const STATUS_FAIL_MS = 60 * 1000;
export const STATUS_TIMEOUT_MS = 15 * 1000;
// 실리가 부르는 상태 길 (main_api마다)
export const STATUS_ROUTES = {
    openai: '/api/backends/chat-completions/status',
    textgenerationwebui: '/api/backends/text-completions/status',
    kobold: '/api/backends/kobold/status',
};
const TAG = '[narrative-archive plugin]';

// ---------- 2. saveModelList의 값 부분 ----------

// <option value>: jQuery $('<option>', { value }) → .val(value): null · undefined는 '', 그 밖은 글자
const optionValue = v => (v == null ? '' : String(v));
// new Option(text, value): value가 없으면(undefined) 글(text) — 여기서는 같은 값이라 '' (실리 2114 · 2353 · 2372 · 2397)
const newOptionValue = v => (v === undefined ? '' : String(v));
// jQuery 3 <select>.val(v).trigger('change') → onModelChange 5474 `String($(this).val() || '')`:
// v(숫자는 글자로, null · undefined는 '')와 같은 값의 옵션이 골라져요. 없으면 아무것도 안 골라져서 val()은 null
function changedValue(options, v) {
    const want = v == null ? '' : typeof v === 'number' ? v + '' : v;
    return String((options.includes(want) ? want : null) || '');
}
const setList = list => { OAI.__naSet({ model_list: list }); return list; };

/**
 * 실리 openai.js saveModelList 2025~2407의 값 부분. 실리처럼 model_list를 줄마다 바꿔요(중간에 오류가 나면 실리와 같은 자리에서 멈춰요).
 * 화면 칸을 만드는 줄은 빼고, 칸을 만들다 오류가 날 수 있는 줄(groupModelsByVendor · 2347 toLowerCase)은 같은 값으로 불러요.
 * `.val(x).trigger('change')`는 그 칸의 옵션(아래)으로 고른 값을 정하고, onModelChange의 그 칸 줄(guard와 모델 값)을 따라 해요.
 * @param {object[]} data 실리 서버 /api/backends/chat-completions/status의 답 data
 */
export function saveModelListValues(data) {
    const { oai_settings, chat_completion_sources, default_settings } = OAI;
    // 2026~2027
    setList(data.map((model) => ({ ...model })));
    OAI.model_list.sort((a, b) => a?.id && b?.id && a.id.localeCompare(b.id));
    // onModelChange 5477 (칸의 change 때)
    const loaded = () => Array.isArray(OAI.model_list) && OAI.model_list.length > 0;
    const ids = () => OAI.model_list.map(model => optionValue(model.id));

    // 2029~2049
    if (oai_settings.chat_completion_source == chat_completion_sources.OPENROUTER) {
        setList(OAI.sortModelsBy(OAI.model_list, oai_settings.sort_models, chat_completion_sources.OPENROUTER));
        // 2034~2046: 칸 = 2033 'OR_Website'(openrouter_website_model) + 목록 (묶기는 2035 groupModelsByVendor로)
        if (oai_settings.group_models) OAI.groupModelsByVendor(OAI.model_list, chat_completion_sources.OPENROUTER);
        // 2048 → onModelChange 5495~5504
        const value = changedValue([OAI.openrouter_website_model, ...ids()], oai_settings.openrouter_model);
        if (value && loaded()) oai_settings.openrouter_model = value;
    }

    // 2051~2065
    if (oai_settings.chat_completion_source == chat_completion_sources.OPENAI) {
        // 2052~2059: 칸 = index.html의 고정 옵션 + #openai_external_category의 목록
        if (oai_settings.show_external_models) {
            const model = OAI.model_list.findIndex((model) => model.id == oai_settings.openai_model) !== -1 ? oai_settings.openai_model : default_settings.openai_model;
            // 2063 → onModelChange 5490~5493
            oai_settings.openai_model = changedValue([...OAI.__naOpenAISelectOptions, ...ids()], model);
        }
    }

    // 2067~2082
    if (oai_settings.chat_completion_source == chat_completion_sources.CUSTOM) {
        // 2068~2077: 칸 = 'None'('') + 목록
        if (!oai_settings.custom_model && OAI.model_list.length > 0) {
            // 2080 → onModelChange 5617~5621 (그리고 #custom_model_id의 input 7087~7090: 같은 값)
            const value = changedValue(['', ...ids()], OAI.model_list[0].id);
            if (value) oai_settings.custom_model = value;
        }
    }

    // 2084~2108
    if (oai_settings.chat_completion_source == chat_completion_sources.AIMLAPI) {
        setList(OAI.model_list.filter(m => m.type === 'chat-completion'));
        setList(OAI.sortModelsBy(OAI.model_list, oai_settings.sort_models, chat_completion_sources.AIMLAPI));
        if (oai_settings.group_models) OAI.groupModelsByVendor(OAI.model_list, chat_completion_sources.AIMLAPI);
        // 2103~2105
        if (!oai_settings.aimlapi_model && OAI.model_list.length > 0) {
            oai_settings.aimlapi_model = OAI.model_list[0].id;
        }
        // 2107 → onModelChange 5628~5635
        const value = changedValue(ids(), oai_settings.aimlapi_model);
        if (value && loaded()) oai_settings.aimlapi_model = value;
    }

    // 2110~2123
    if (oai_settings.chat_completion_source == chat_completion_sources.MISTRALAI) {
        // 2113~2115: 칸 = completion_chat이 있는 모델만
        const options = OAI.model_list.filter(model => model?.capabilities?.completion_chat).map(model => newOptionValue(model.id));
        // 2117~2120
        const selectedModel = OAI.model_list.find(model => model.id === oai_settings.mistralai_model);
        if (!selectedModel) {
            oai_settings.mistralai_model = OAI.model_list.find(model => model?.capabilities?.completion_chat)?.id;
        }
        // 2122 → onModelChange 5531~5539
        const value = changedValue(options, oai_settings.mistralai_model);
        if (value && loaded()) oai_settings.mistralai_model = value;
    }

    // 2125~2203: 거르기 · 정렬 · 목록에 없으면 첫 모델 (칸 = 목록. onModelChange 5578~5585 · 5587~5594 · 5596~5605)
    for (const [source, key, filter] of [
        // 2126
        [chat_completion_sources.ELECTRONHUB, 'electronhub_model', model => model?.endpoints?.includes('/v1/chat/completions')],
        // 2153
        [chat_completion_sources.CHUTES, 'chutes_model', model => typeof model.id === 'string' && !model.id.toLowerCase().includes('affine')],
        [chat_completion_sources.NANOGPT, 'nanogpt_model', null],
    ]) {
        if (oai_settings.chat_completion_source != source) continue;
        if (filter) setList(OAI.model_list.filter(filter));
        setList(OAI.sortModelsBy(OAI.model_list, oai_settings.sort_models, source));
        if (oai_settings.group_models) OAI.groupModelsByVendor(OAI.model_list, source);
        // 2144~2147 · 2171~2174 · 2197~2200
        const selectedModel = OAI.model_list.find(model => model.id === oai_settings[key]);
        if (OAI.model_list.length > 0 && (!selectedModel || !oai_settings[key])) {
            oai_settings[key] = OAI.model_list[0].id;
        }
        // 2149 · 2176 · 2202 → onModelChange
        const value = changedValue(ids(), oai_settings[key]);
        if (value && loaded()) oai_settings[key] = value;
    }

    // 2205~2231: 목록에 없으면 첫 모델 (칸 = 목록. onModelChange 5607~5615 DeepSeek: 값이 없으면 그대로 · 5623~5626 Pollinations: 값이 있을 때만)
    for (const [source, key] of [[chat_completion_sources.DEEPSEEK, 'deepseek_model'], [chat_completion_sources.POLLINATIONS, 'pollinations_model']]) {
        if (oai_settings.chat_completion_source != source) continue;
        const selectedModel = OAI.model_list.find(model => model.id === oai_settings[key]);
        if (OAI.model_list.length > 0 && (!selectedModel || !oai_settings[key])) {
            oai_settings[key] = OAI.model_list[0].id;
        }
        const value = changedValue(ids(), oai_settings[key]);
        if (value) oai_settings[key] = value;
    }

    // 2233~2268
    if (oai_settings.chat_completion_source === chat_completion_sources.MAKERSUITE) {
        // 2235~2241: 화면의 고정 옵션(index.html #model_google_select, 2235가 "Other"를 비운 뒤라 고정 옵션만)
        const staticModels = [...OAI.__naGoogleSelectOptions];
        // 2244~2253: 고정 목록에 없는 모델은 "Other"에
        const options = [...staticModels, ...OAI.model_list.filter(model => !staticModels.includes(model.id)).map(model => optionValue(model.id))];
        // 2256~2260
        staticModels.forEach(modelId => {
            if (!OAI.model_list.some(model => model.id === modelId)) {
                OAI.model_list.push({ id: modelId });
            }
        });
        // 2262~2265
        const selectedModel = OAI.model_list.find(model => model.id === oai_settings.google_model);
        if (OAI.model_list.length > 0 && (!selectedModel || !oai_settings.google_model)) {
            oai_settings.google_model = OAI.model_list[0].id;
        }
        // 2267 → onModelChange 5516~5524
        const value = changedValue(options, oai_settings.google_model);
        if (value) oai_settings.google_model = value;
    }

    // 2270~2341: 목록에 없으면 첫 모델 (칸 = 목록. Fireworks는 이름 차례로)
    // (onModelChange 5551~5558 Groq: 값 · 목록이 있어야 · 5560~5567 SiliconFlow: 값이 있어야 · 5655~5662 Fireworks · 5686~5693 Workers AI: 값 · 목록이 있어야)
    for (const [source, key, needList] of [
        [chat_completion_sources.GROQ, 'groq_model', true],
        [chat_completion_sources.SILICONFLOW, 'siliconflow_model', false],
        [chat_completion_sources.FIREWORKS, 'fireworks_model', true],
        [chat_completion_sources.WORKERS_AI, 'workers_ai_model', true],
    ]) {
        if (oai_settings.chat_completion_source !== source) continue;
        // 2308
        if (source === chat_completion_sources.FIREWORKS) OAI.model_list.sort((a, b) => (a?.name || a?.id || '').localeCompare(b?.name || b?.id || ''));
        const selectedModel = OAI.model_list.find(model => model.id === oai_settings[key]);
        if (OAI.model_list.length > 0 && (!selectedModel || !oai_settings[key])) {
            oai_settings[key] = OAI.model_list[0].id;
        }
        const value = changedValue(ids(), oai_settings[key]);
        if (value && (!needList || loaded())) oai_settings[key] = value;
    }

    // 2343~2364
    if (oai_settings.chat_completion_source === chat_completion_sources.COMETAPI) {
        // 2346~2355: 칸 = 무시할 이름(COMETAPI_IGNORE_PATTERNS)이 든 것을 뺀 목록
        const options = [];
        OAI.model_list.forEach((model) => {
            const modelId = model.id.toLowerCase();
            const isIgnoredModel = COMETAPI_IGNORE_PATTERNS.some(pattern => modelId.includes(pattern));

            if (isIgnoredModel) {
                return;
            }

            options.push(newOptionValue(model.id));
        });
        // 2357~2361 (2360 saveSettingsDebounced: 서버는 저장하지 않아요)
        const selectedModel = OAI.model_list.find(model => model.id === oai_settings.cometapi_model);
        if (OAI.model_list.length > 0 && (!selectedModel || !oai_settings.cometapi_model)) {
            oai_settings.cometapi_model = OAI.model_list[0].id;
        }
        // 2363 → onModelChange 5664~5671
        const value = changedValue(options, oai_settings.cometapi_model);
        if (value) oai_settings.cometapi_model = value;
    }

    // 2366~2374
    if (oai_settings.chat_completion_source == chat_completion_sources.AZURE_OPENAI) {
        const modelId = OAI.model_list?.[0]?.id || '';
        oai_settings.azure_openai_model = modelId;
        // 2370~2373: 칸 = 이 모델 하나(골라진 채로) → onModelChange 5673~5679
        const value = String(newOptionValue(modelId || '') || '');
        if (value) oai_settings.azure_openai_model = value;
    }

    // 2376~2406 (onModelChange 5637~5644 xAI: 값이 있어야 · 5646~5653 Moonshot: 값 · 목록이 있어야)
    for (const [source, key, needList, asOption] of [
        [chat_completion_sources.XAI, 'xai_model', false, optionValue],
        [chat_completion_sources.MOONSHOT, 'moonshot_model', true, newOptionValue],
    ]) {
        if (oai_settings.chat_completion_source != source) continue;
        const selectedModel = OAI.model_list.find(model => model.id === oai_settings[key]);
        if (OAI.model_list.length > 0 && (!selectedModel || !oai_settings[key])) {
            oai_settings[key] = OAI.model_list[0].id;
        }
        const value = changedValue(OAI.model_list.map(model => asOption(model.id)), oai_settings[key]);
        if (value && (!needList || loaded())) oai_settings[key] = value;
    }
}
OAI.__naSet({ saveModelList: saveModelListValues });

// ---------- 1. 상태 길의 답 캐시 ----------

const cache = new Map();
const CACHE_MAX = 32;
// 실리 창에 이미 알린 것 (열쇠마다): 옛 다리 404는 일꾼이 떠 있는 동안 한 번, 다른 실패는 다시 성공할 때까지 한 번, 주소 없음은 주소가 생길 때까지 한 번
const told404 = new Set();
const toldFail = new Map();
const toldNoUrl = new Set();

/** 테스트용: 캐시 · 알린 것 · API 토크나이저 지원 표시(탭의 sessionStorage)를 비워요 (일꾼을 새로 띄운 것과 같아요). */
export function __naStatusReset() {
    cache.clear();
    told404.clear();
    toldFail.clear();
    toldNoUrl.clear();
    __naSessionStorage.removeItem(TOKENIZER_SUPPORTED_KEY);
}

async function secretsSig(root) {
    if (!root) return '';
    try {
        const st = await fs.stat(path.join(root, 'secrets.json'));
        return `${st.ino}:${st.mtimeMs}:${st.size}`;
    } catch (err) {
        return err?.code === 'ENOENT' ? 'none' : `error:${err?.code || ''}`;
    }
}

// (the page's state before it connects: script.js 601 online_status, openai.js model_list, textgen-models.js 12~21, kai-settings.js 57~65.
//  Set before every check: nothing of the last job's connection stays)
// (the page connects before a chat is open: getStatusOpen 4511 resolves the macros of custom_include_headers then — the chat's own
//  names and messages are set after this, by the worker)
const PAGE_START = { name1: SCRIPT.name1, name2: SCRIPT.name2 };
function pageStart() {
    SCRIPT.__naSet({ online_status: 'no_connection', name1: PAGE_START.name1, name2: PAGE_START.name2, chat: [], characters: [], this_chid: undefined, chat_metadata: {} });
    GROUPS.__naSet({ groups: [], selected_group: null });
    OAI.__naSet({ model_list: [] });
    TGM.__naSet({ mancerModels: [], togetherModels: [], infermaticAIModels: [], dreamGenModels: [], vllmModels: [], aphroditeModels: [], featherlessModels: [], tabbyModels: [], llamacppModels: [], openRouterModels: [] });
    KAI.__naSet({ kai_flags: {} });
}
// (what a check can change besides those: the chosen models — saveModelList and the text completion loaders —, and the tab's
//  API tokenizer mark. Put back before a failed check is played again after the last good one, so the order is the browser's:
//  page → the good connect → the failed one)
function keep() {
    return { oai: structuredClone(OAI.oai_settings), tg: structuredClone(TG.textgenerationwebui_settings), tok: __naSessionStorage.getItem(TOKENIZER_SUPPORTED_KEY) };
}
function putBack(k) {
    for (const [now, was] of [[OAI.oai_settings, k.oai], [TG.textgenerationwebui_settings, k.tg]]) {
        for (const key of Object.keys(now)) delete now[key];
        Object.assign(now, structuredClone(was));
    }
    if (k.tok === null) __naSessionStorage.removeItem(TOKENIZER_SUPPORTED_KEY);
    else __naSessionStorage.setItem(TOKENIZER_SUPPORTED_KEY, k.tok);
}

const isAzure = body => { try { return JSON.parse(body)?.chat_completion_source === OAI.chat_completion_sources.AZURE_OPENAI; } catch { return false; } };
const fresh = (e, t) => !!e && (e.ok ? (e.azure || t - e.at < STATUS_OK_MS) : t - e.at < STATUS_FAIL_MS);
const readJson = reply => { try { return { ok: true, json: JSON.parse(reply.text) }; } catch { return { ok: false }; } };
// (the reply as the browser's fetch would have given it: the body, the status, and the one header SillyTavern reads — getStatusTextgen 740)
const KEEP_HEADERS = ['content-type', 'x-supports-tokenization'];

// 다리로 한 번 (시간 제한 15초) → { status, statusText, headers, text } | { error, timeout }
async function ask(send, url, init, timeoutMs) {
    if (typeof send !== 'function') return { error: '실리 서버에 연결할 수 없습니다.' };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    // (SillyTavern's own signal — abortStatusCheck — still stops it too)
    const stop = () => ctl.abort();
    init.signal?.addEventListener?.('abort', stop);
    try {
        const r = await send(url, { ...init, signal: ctl.signal });
        const headers = {};
        for (const h of KEEP_HEADERS) { const v = r.headers?.get?.(h); if (v != null) headers[h] = v; }
        return { status: r.status, statusText: r.statusText || '', headers, text: await r.text() };
    } catch (err) {
        return { error: String(err?.message || err), timeout: ctl.signal.aborted };
    } finally {
        clearTimeout(timer);
        init.signal?.removeEventListener?.('abort', stop);
    }
}
// (a reply that could not be had at all: the browser's fetch rejects)
function answer(reply) {
    if (reply.error !== undefined) throw new Error(reply.error);
    return new Response(reply.text, { status: reply.status, statusText: reply.statusText, headers: reply.headers });
}
// (a reply SillyTavern's code would not take: no answer, not 2xx, not JSON — the browser writes "Error getting status" then)
const broken = reply => reply.error !== undefined || reply.status < 200 || reply.status > 299 || !readJson(reply).ok;

/**
 * 지금 설정(naLoad로 채운 것)으로 실리 브라우저의 연결 확인을 해요. main_api가 openai · textgenerationwebui · kobold일 때만(실리처럼 지금 고른 것 하나).
 * @param {{ root?: string, send?: (url: string, init: object) => Promise<Response>, now?: () => number, timeoutMs?: number, log?: (text: string) => void }} [o]
 *   root: 사용자 폴더 (secrets.json) · send: 실리 서버로 가는 길(다리) · now: 시계 · log: 실리 창 한 줄
 * @returns {Promise<{ api: string, key: string|null, fetched: boolean, ok: boolean, replayed: boolean }>}
 */
export async function naStatus({ root = '', send = null, now = Date.now, timeoutMs = STATUS_TIMEOUT_MS, log = text => console.warn(TAG, text) } = {}) {
    const out = { api: '', key: null, fetched: false, ok: false, replayed: false };
    try {
        pageStart();
        const api = String(SCRIPT.main_api ?? '');
        out.api = api;
        const check = { openai: OAI.getStatusOpen, textgenerationwebui: TG.getStatusTextgen, kobold: KAI.getStatusKobold }[api];
        if (!check) return out;
        const route = STATUS_ROUTES[api];
        const secrets = await secretsSig(root);
        // mode 'live': 열쇠의 답이 오래됐으면 다시 물어요 · 'good': 그 열쇠로 전에 받은 좋은 답 · 'held': 지금 둔 답 그대로
        const run = async (mode) => {
            let used = null;
            __naSetFetch(async (url, init = {}) => {
                const key = JSON.stringify([root, api, String(url), init.body ?? null, secrets]);
                used = key;
                let e = cache.get(key);
                if (mode === 'live' && !fresh(e, now())) {
                    const reply = await ask(send, String(url), init, timeoutMs);
                    e = { ...(e || {}), at: now(), reply, ok: false, azure: isAzure(init.body) };
                    cache.delete(key);
                    cache.set(key, e);
                    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
                    out.fetched = true;
                }
                const reply = mode === 'good' ? e?.good : e?.reply;
                if (!reply) throw new Error('상태 답이 없습니다.');
                return answer(reply);
            });
            // (validateReverseProxy throws for a proxy not confirmed yet: the browser's connect stops there too. Its toastr already wrote why)
            try { await check(); } catch { /* as the browser */ }
            finally { __naSetFetch(null); }
            return used;
        };
        const before = keep();
        const key = await run('live');
        out.key = key;
        if (!key) {
            // (getStatusTextgen 664~668 · getStatusKobold 409~413: no address to check)
            const noUrl = api === 'textgenerationwebui' ? !TG.getTextGenServer() : api === 'kobold' ? !KAI.kai_settings.api_server : false;
            const k = JSON.stringify([root, api, api === 'textgenerationwebui' ? TG.textgenerationwebui_settings.type : '']);
            if (noUrl && !toldNoUrl.has(k)) { toldNoUrl.add(k); log('상태를 확인할 주소가 없습니다.'); }
            if (!noUrl) toldNoUrl.delete(k);
            return out;
        }
        toldNoUrl.clear();
        const e = cache.get(key);
        const json = readJson(e.reply);
        e.ok = !broken(e.reply) && !(json.json && typeof json.json === 'object' && 'error' in json.json) && SCRIPT.online_status !== 'no_connection';
        out.ok = e.ok;
        if (e.ok) {
            e.good = e.reply;
            toldFail.delete(key);
            return out;
        }
        if (e.reply.status === 404) {
            if (!told404.has(key)) { told404.add(key); log(`실리 서버의 ${route}를 쓸 수 없습니다. 서버 플러그인을 업데이트하고 실리를 다시 시작하세요.`); }
        } else if (broken(e.reply)) {
            const why = e.reply.error !== undefined ? (e.reply.timeout ? '시간이 초과되었습니다.' : e.reply.error) : `${route} (${e.reply.status})`;
            if (toldFail.get(key) !== why) { toldFail.set(key, why); log(`상태를 가져오는 중 오류가 발생했습니다: ${why}`); }
        }
        // (the browser keeps the list it had: the same key's last good reply, then this failed one — page → good → failed)
        if (e.good) {
            putBack(before);
            pageStart();
            await run('good');
            await run('held');
            out.replayed = true;
        }
    } catch (err) {
        log(`상태를 가져오는 중 오류가 발생했습니다: ${String(err?.message || err)}`);
    } finally {
        __naSetFetch(null);
    }
    return out;
}
