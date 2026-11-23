// 우리 것 (실리 파일 아님): 실리 브라우저가 백엔드에 "연결"할 때 받아 두는 것을 서버도 받아요.
//   연결 상태(script.js online_status) · 채팅 완성 모델 목록(openai.js model_list) · 글 완성 모델 목록(textgen-models.js) ·
//   Kobold 기능 표시(kai-settings.js kai_flags) · API 토크나이저 지원 표시(tokenizers.js sessionStorage), 그리고 고른 모델이 목록에 없을 때의 보정.
// 연결 확인 자체는 옮긴 실리 코드 그대로예요: openai.js onConnectButtonClick의 키 확인(__naConnectGate) · getStatusOpen · textgen-settings.js
// getStatusTextgen · kai-settings.js getStatusKobold (화면 줄 · 로그 줄만 빠짐, tools/st/gen.mjs). 여기서 하는 것은 넷이에요:
//   1. 그 함수가 부르는 실리 서버의 상태 길(다리)의 답을 캐시해요. 실리 브라우저는 연결할 때 한 번 받아 두고 페이지 내내 써요. 서버도 설정이 그대로면
//      다시 묻지 않아요(공급자 호출 · Azure의 돈이 설정을 바꿀 때만 나가게):
//      - 열쇠 = 사용자 폴더 + main_api + 길 + 실리 코드가 만든 몸통(custom_include_headers는 매크로를 풀기 전의 글 + 그때의 {{user}}) +
//        그 소스가 쓰는 키의 저장 상태(키 글 없이 id · 쓰는 것: 다리의 /api/secrets/read. 옛 다리면 secrets.json의 파일 번호 · 시각 · 크기)
//      - 다시 묻는 때: 로컬 백엔드(글 완성 · Kobold · 사용자 지정 주소 · 프록시)는 30분(설정 없이 모델을 바꿀 수 있어요), 클라우드 목록은 24시간
//        (수 MB예요. 브라우저는 페이지를 열 때 한 번). 실패는 1분 · 2분 · 4분 … 30분. Azure는 유료 확인까지 갔을 수 있는 답(2xx · 500
//        'Failed to connect to the Azure endpoint.')이면 다시 묻지 않아요: 실리의 Azure 상태 확인은 진짜 생성 요청이라 돈이 들어요(소망 결정 2026-11-23).
//        그 답은 사용자 폴더의 NarrativeArchive/status-azure.json에 둬서 다시 켜도 묻지 않아요. 그 앞에서 끝난 실패(설정 없음 · GET /models 실패 · 다리 오류)는 다른 실패처럼
//      - 다시 물을 때는 기다리지 않아요: 일은 둔 답으로 하고, 다리에는 뒤에서 물어요(다음 일부터 새 답). 처음 묻는 열쇠만 답을 기다려요(시간 제한 15초):
//        브라우저도 연결을 마친 뒤에 보내고, 답 없이 만든 요청은 브라우저 것과 달라서예요. 열쇠마다 처음 한 번뿐이에요.
//        Azure는 15초가 지나도 다리 요청을 끊지 않아요: 일은 연결 안 됨으로 하고, 실리의 답이 오면 그 답을 둬요(다음 일부터)
//      - 받은 원래 답을 둬요: 실리 코드(목록 · 거르기 · 정렬 · 모델 보정)는 일마다 그 답으로 다시 돌아요(naLoad가 일마다 설정을 새로 읽어요)
//      - 다시 물었는데 실패하면: 실리 브라우저처럼 상태는 no_connection, 목록은 그 열쇠로 전에 받은 것(브라우저는 전 목록을 버리지 않아요)
//      - 옛 다리(그 길이 404): 실패와 같아요. 요청은 지금처럼 보내요(막지 않아요). 실리 창에 열쇠마다 한 번만 알려요
//   2. 화면이 섞인 실리 openai.js saveModelList(2025~2407)의 값 부분을 따라 해요(saveModelListValues, 실리 줄 번호를 적어 둠).
//      고르기 칸의 change가 부르는 onModelChange(5472~)의 모델 값 줄과 가드도 같이. 가드를 지나면 그 뒷부분(문맥 · 온도 칸 고치기 5695~6011)은
//      옮긴 실리 코드 그대로(openai.js __naModelChangeRest). NanoGPT는 그 모델의 공급자 고르기(textgen-models.js syncNanoGptProvidersForModel)도
//   3. 연결 버튼의 키 확인(onConnectButtonClick 6074~6093): 그 소스의 키가 저장돼 있지 않으면 브라우저처럼 연결하지 않아요(상태는 페이지 그대로)
//   4. 실리 창 로그: 옮긴 함수의 로그 줄(일마다 캐시의 답으로 다시 돌아서 같은 줄이 계속 나와요) 대신, 열쇠마다 이유마다 한 번 한국어로.
//      실리가 이유를 주면(Azure의 message 등) 그 글을 옮겨서
// 부르는 곳: plugin/work.mjs withWorld (naLoad 뒤, 실리 연결을 쓰는 세계만). 실패해도 던지지 않아요: 상태가 없으면 지금처럼(no_connection · 빈 목록) 요청을 보내요.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
// (naload.js first: it loads power-user.js before script.js, SillyTavern's own order)
import { naPageName1 } from './naload.js';
import * as SCRIPT from './public/script.js';
import * as OAI from './public/scripts/openai.js';
import * as TG from './public/scripts/textgen-settings.js';
import * as TGM from './public/scripts/textgen-models.js';
import * as KAI from './public/scripts/kai-settings.js';
import * as GROUPS from './public/scripts/group-chats.js';
import * as SECRETS from './public/scripts/secrets.js';
import { TOKENIZER_SUPPORTED_KEY, __naSessionStorage } from './public/scripts/tokenizers.js';
import { COMETAPI_IGNORE_PATTERNS } from './public/scripts/constants.js';
import { __naSetFetch, naFetch } from './public/naFetch.js';

// 다시 묻는 때 (로컬 백엔드 · 클라우드 목록 · 실패의 처음과 끝) · 시간 제한
export const STATUS_OK_MS = 30 * 60 * 1000;
export const STATUS_CLOUD_MS = 24 * 60 * 60 * 1000;
export const STATUS_FAIL_MS = 60 * 1000;
export const STATUS_FAIL_MAX_MS = 30 * 60 * 1000;
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
// onModelChange의 가드를 지났을 때(실리가 return하지 않을 때): 고른 칸의 모델 값을 넣고, 뒷부분(문맥 · 온도 칸 고치기, openai.js 5695~6011)을 실리 그대로
const changed = (key, value) => { if (key) OAI.oai_settings[key] = value; OAI.__naModelChangeRest(value); };
// (onModelChange 5604 syncNanoGptProvidersForModel: 실리는 그 자리에서 기다리지 않고 공급자를 물어요. naStatus가 연결 확인 뒤에 해요)
let nanoAsked;

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
        if (value && loaded()) changed('openrouter_model', value);
    }

    // 2051~2065
    if (oai_settings.chat_completion_source == chat_completion_sources.OPENAI) {
        // 2052~2059: 칸 = index.html의 고정 옵션 + #openai_external_category의 목록
        if (oai_settings.show_external_models) {
            const model = OAI.model_list.findIndex((model) => model.id == oai_settings.openai_model) !== -1 ? oai_settings.openai_model : default_settings.openai_model;
            // 2063 → onModelChange 5490~5493 (가드 없음)
            changed('openai_model', changedValue([...OAI.__naOpenAISelectOptions, ...ids()], model));
        }
    }

    // 2067~2082
    if (oai_settings.chat_completion_source == chat_completion_sources.CUSTOM) {
        // 2068~2077: 칸 = 'None'('') + 목록
        if (!oai_settings.custom_model && OAI.model_list.length > 0) {
            // 2080 → onModelChange 5617~5621 (그리고 #custom_model_id의 input 7087~7090: 같은 값)
            const value = changedValue(['', ...ids()], OAI.model_list[0].id);
            // (5617: 값이 있을 때만 넣고, 없어도 return하지 않아요)
            changed(value ? 'custom_model' : '', value);
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
        if (value && loaded()) changed('aimlapi_model', value);
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
        if (value && loaded()) changed('mistralai_model', value);
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
        if (value && loaded()) {
            if (source === chat_completion_sources.NANOGPT) nanoAsked = value;
            changed(key, value);
        }
    }

    // 2205~2231: 목록에 없으면 첫 모델 (칸 = 목록. onModelChange 5607~5615 DeepSeek: 값이 없으면 그대로 · 5623~5626 Pollinations: 값이 있을 때만)
    for (const [source, key] of [[chat_completion_sources.DEEPSEEK, 'deepseek_model'], [chat_completion_sources.POLLINATIONS, 'pollinations_model']]) {
        if (oai_settings.chat_completion_source != source) continue;
        const selectedModel = OAI.model_list.find(model => model.id === oai_settings[key]);
        if (OAI.model_list.length > 0 && (!selectedModel || !oai_settings[key])) {
            oai_settings[key] = OAI.model_list[0].id;
        }
        const value = changedValue(ids(), oai_settings[key]);
        if (source === chat_completion_sources.POLLINATIONS) changed(value ? key : '', value);
        else if (value) changed(key, value);
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
        if (value) changed('google_model', value);
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
        if (value && (!needList || loaded())) changed(key, value);
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
        if (value) changed('cometapi_model', value);
    }

    // 2366~2374
    if (oai_settings.chat_completion_source == chat_completion_sources.AZURE_OPENAI) {
        const modelId = OAI.model_list?.[0]?.id || '';
        oai_settings.azure_openai_model = modelId;
        // 2370~2373: 칸 = 이 모델 하나(골라진 채로) → onModelChange 5673~5679
        const value = String(newOptionValue(modelId || '') || '');
        if (value) changed('azure_openai_model', value);
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
        if (value && (!needList || loaded())) changed(key, value);
    }
}
// (an error inside it: getStatusOpen catches it — 4565 — and the page stays no_connection. Kept for the window's line)
let saveThrew = null;
OAI.__naSet({ saveModelList: data => { try { return saveModelListValues(data); } catch (err) { saveThrew = err; throw err; } } });

// ---------- 1. 상태 길의 답 캐시 ----------

// 열쇠 → { url, init(다시 물을 때 보낼 것), at, reply, judged, ok, okLike, good, fails, ttl, azure, pending, told }
const cache = new Map();
const CACHE_MAX = 32;
// 실리 창에 이미 알린 것: 주소 없음(주소가 생길 때까지 한 번) · 키 없음(키가 생길 때까지 한 번). 열쇠마다의 것은 그 캐시 칸에(밀려나면 같이 사라져요)
const toldNoUrl = new Set();
const toldNoKey = new Set();
const TOLD_MAX = 64;
const tell = (set, k) => { if (set.has(k)) return false; if (set.size >= TOLD_MAX) set.delete(set.values().next().value); set.add(k); return true; };
// 사용자 폴더마다: secrets.json의 시각 → 그때 다리에서 읽은 키 저장 상태
const secretsHad = new Map();
// 사용자 폴더마다: 디스크에 둔 Azure 답 (NarrativeArchive/status-azure.json. 유료 확인까지 갔을 수 있는 답만)
const azureDisk = new Map();
const AZURE_FILE = path.join('NarrativeArchive', 'status-azure.json');
const AZURE_KEEP = 50;

/** 테스트용: 캐시 · 알린 것 · API 토크나이저 지원 표시(탭의 sessionStorage)를 비워요 (일꾼을 새로 띄운 것과 같아요. 디스크의 Azure 답은 남아요). */
export function __naStatusReset() {
    cache.clear();
    toldNoUrl.clear();
    toldNoKey.clear();
    secretsHad.clear();
    azureDisk.clear();
    TG.__naLooseReset();
    __naSessionStorage.removeItem(TOKENIZER_SUPPORTED_KEY);
}
/** 테스트용: 뒤에서 묻는 중인 것이 다 끝날 때까지 */
export async function __naStatusIdle() {
    for (;;) {
        const busy = [...cache.values()].map(e => e.pending).filter(Boolean);
        if (!busy.length) return;
        await Promise.allSettled(busy);
    }
}

// secrets.json의 시각 (옛 다리면 이것이 열쇠에 들어가요). 없는 파일과 빈 파일({})은 같아요: 실리는 처음 상태를 볼 때 빈 파일을 만들어요(secrets.js 127~130)
async function secretsSig(root) {
    if (!root) return '';
    try {
        const st = await fs.stat(path.join(root, 'secrets.json'));
        return st.size <= 2 ? 'none' : `${st.ino}:${st.mtimeMs}:${st.size}`;
    } catch (err) {
        return err?.code === 'ENOENT' ? 'none' : `error:${err?.code || ''}`;
    }
}
// (the key state without the key text: SillyTavern's /api/secrets/read gives masked text — the bridge gives none — and only presence and
//  which one is used matter here)
const plainState = json => Object.fromEntries(Object.entries(json).map(([k, v]) => [k, Array.isArray(v) && v.length ? v.map(x => ({ id: x?.id ?? null, active: x?.active ?? null })) : null]));
// 실리 secrets.js readSecretState 409~425의 값 부분 (/api/secrets/read → secret_state). → { sig, state | null }
//   state null: 옛 다리(404) · 읽지 못함 → 키 확인을 하지 않아요(지금까지처럼), 열쇠에는 secrets.json의 시각
async function secretsNow(root, send, now, timeoutMs) {
    const sig = await secretsSig(root);
    const had = secretsHad.get(root);
    if (had && had.sig === sig && (had.state || had.old || now() - had.at < STATUS_FAIL_MS)) return had;
    const r = await ask(send, '/api/secrets/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, timeoutMs);
    const json = r.error === undefined && r.status >= 200 && r.status <= 299 ? readJson(r) : { ok: false };
    const state = json.ok && json.json && typeof json.json === 'object' && !Array.isArray(json.json) ? plainState(json.json) : null;
    const out = { sig, state, old: r.status === 404, at: now() };
    secretsHad.set(root, out);
    if (secretsHad.size > TOLD_MAX) secretsHad.delete(secretsHad.keys().next().value);
    return out;
}
// 열쇠에 들어가는 키 상태: 그 소스가 쓰는 키만(알 때), 아니면 전부
const secretsPart = (s, keys) => (s.state ? JSON.stringify(keys ? keys.map(k => [k, s.state[k] ?? null]) : s.state) : `file:${s.sig}`);
// 글 완성의 상태 길이 읽는 키: 실리 서버 src/additional-headers.js setAdditionalHeadersByType 230~245의 표(몸통의 api_type → 그 함수가 읽는 SECRET_KEYS,
// 11~200. 몸통에 secret_id가 없어서 쓰는 키). 표에 없는 종류(ollama)는 키를 읽지 않아요. Kobold는 몸통에 api_type이 없어서(kai-settings.js 419~422) 읽지 않아요.
// (실리 브라우저 RossAscends-mods.js RA_autoconnect 374~382가 클라우드 종류에 보는 키도 이 표의 것과 같아요)
const TEXTGEN_SECRETS = {
    [TG.textgen_types.MANCER]: SECRETS.SECRET_KEYS.MANCER,
    [TG.textgen_types.VLLM]: SECRETS.SECRET_KEYS.VLLM,
    [TG.textgen_types.APHRODITE]: SECRETS.SECRET_KEYS.APHRODITE,
    [TG.textgen_types.TABBY]: SECRETS.SECRET_KEYS.TABBY,
    [TG.textgen_types.TOGETHERAI]: SECRETS.SECRET_KEYS.TOGETHERAI,
    [TG.textgen_types.OOBA]: SECRETS.SECRET_KEYS.OOBA,
    [TG.textgen_types.INFERMATICAI]: SECRETS.SECRET_KEYS.INFERMATICAI,
    [TG.textgen_types.DREAMGEN]: SECRETS.SECRET_KEYS.DREAMGEN,
    [TG.textgen_types.OPENROUTER]: SECRETS.SECRET_KEYS.OPENROUTER,
    [TG.textgen_types.KOBOLDCPP]: SECRETS.SECRET_KEYS.KOBOLDCPP,
    [TG.textgen_types.LLAMACPP]: SECRETS.SECRET_KEYS.LLAMACPP,
    [TG.textgen_types.FEATHERLESS]: SECRETS.SECRET_KEYS.FEATHERLESS,
    [TG.textgen_types.HUGGINGFACE]: SECRETS.SECRET_KEYS.HUGGINGFACE,
    [TG.textgen_types.GENERIC]: SECRETS.SECRET_KEYS.GENERIC,
};

// (the page's state before it connects: script.js 601 online_status, openai.js model_list, textgen-models.js 12~21, kai-settings.js 57~65.
//  Set before every check: nothing of the last job's connection stays)
// (the page connects before a chat is open: getStatusOpen 4511 resolves the macros of custom_include_headers then — with name1 from
//  settings.json, script.js 7929~7932 (naload.js naPageName1). The chat's own names and messages are set after this, by the worker)
const PAGE_START = { name2: SCRIPT.name2 };
function pageStart() {
    SCRIPT.__naSet({ online_status: 'no_connection', name1: naPageName1(), name2: PAGE_START.name2, chat: [], characters: [], this_chid: undefined, chat_metadata: {} });
    GROUPS.__naSet({ groups: [], selected_group: null });
    OAI.__naSet({ model_list: [] });
    TGM.__naSet({ mancerModels: [], togetherModels: [], infermaticAIModels: [], dreamGenModels: [], vllmModels: [], aphroditeModels: [], featherlessModels: [], tabbyModels: [], llamacppModels: [], openRouterModels: [] });
    KAI.__naSet({ kai_flags: {} });
}
// (what a check can change besides those: the chosen models — saveModelList and the text completion loaders —, the context · temperature
//  fields — onModelChange —, the NanoGPT provider and the tab's API tokenizer mark. Put back before a failed check is played again after the
//  last good one, so the order is the browser's: page → the good connect → the failed one)
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

const parse = body => { try { return JSON.parse(body); } catch { return null; } };
const readJson = reply => { try { return { ok: true, json: JSON.parse(reply.text) }; } catch { return { ok: false }; } };
// (the reply as the browser's fetch would have given it: the body, the status, and the one header SillyTavern reads — getStatusTextgen 740)
const KEEP_HEADERS = ['content-type', 'x-supports-tokenization'];
// 글 완성 중 클라우드 공급자 (그 밖은 집 · 내 컴퓨터의 백엔드)
const CLOUD_TEXTGEN = [TG.textgen_types.MANCER, TG.textgen_types.TOGETHERAI, TG.textgen_types.INFERMATICAI, TG.textgen_types.DREAMGEN, TG.textgen_types.OPENROUTER, TG.textgen_types.FEATHERLESS];
// 성공한 답을 다시 묻는 때: 로컬 백엔드는 30분, 클라우드 목록은 24시간
function okAge(api, body) {
    if (api === 'textgenerationwebui') return CLOUD_TEXTGEN.includes(body?.api_type) ? STATUS_CLOUD_MS : STATUS_OK_MS;
    if (api === 'openai') return body?.chat_completion_source === OAI.chat_completion_sources.CUSTOM || body?.reverse_proxy ? STATUS_OK_MS : STATUS_CLOUD_MS;
    return STATUS_OK_MS;
}
const backoff = fails => Math.min(STATUS_FAIL_MS * 2 ** Math.max(0, fails - 1), STATUS_FAIL_MAX_MS);
// (Azure: an answer that may have come from the paid check is never asked again for the same key. An answer that came behind the last job and
//  is not used yet: the next job uses it — and counts a failure — first)
const fresh = (e, t) => (e.azure && paid(e.reply)) || !e.judged || (e.ok || e.okLike ? t - e.at < e.ttl : t - e.at < backoff(e.fails));
// Azure의 답 중 유료 확인(chat-completions.js 1976~2003: 5토큰 생성)까지 갔을 수 있는 것: 2xx(2000 · 2004), 그 catch의 500(2008~2011. GET /models에
// 닿지 못했을 때도 같은 답이라 못 가려요). 나머지는 그 앞에서 끝나서 돈이 들지 않아요: 1939~1942 400 설정 없음 · 1965~1974 GET /models 실패(그 상태 그대로) ·
// 바깥 catch 2147~2154의 200 { error: true } · 다리 오류
function paid(reply) {
    if (!reply || reply.error !== undefined) return false;
    const json = readJson(reply);
    const body = json.ok && json.json && typeof json.json === 'object' ? json.json : null;
    if (reply.status >= 200 && reply.status <= 299) return !(body && 'error' in body);
    return reply.status === 500 && body?.message === 'Failed to connect to the Azure endpoint.';
}

// 다리로 한 번 (시간 제한. null이면 끊지 않아요: Azure) → { status, statusText, headers, text } | { error, timeout }
async function ask(send, url, init, timeoutMs) {
    if (typeof send !== 'function') return { error: '실리 서버에 연결할 수 없습니다.' };
    const ctl = new AbortController();
    const timer = timeoutMs == null ? null : setTimeout(() => ctl.abort(), timeoutMs);
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
        if (timer) clearTimeout(timer);
        init.signal?.removeEventListener?.('abort', stop);
    }
}
// 기다리기만 끝내요 (요청은 그대로): 시간 안에 오면 그 답, 아니면 null
function waitAtMost(p, ms) {
    let timer;
    return Promise.race([p, new Promise(ok => { timer = setTimeout(() => ok(null), ms); })]).finally(() => clearTimeout(timer));
}
const TIMED_OUT = () => ({ error: '시간이 초과되었습니다.', timeout: true });
// (a reply that could not be had at all: the browser's fetch rejects)
function answer(reply) {
    if (reply.error !== undefined) throw new Error(reply.error);
    return new Response(reply.text, { status: reply.status, statusText: reply.statusText, headers: reply.headers });
}
// (a reply SillyTavern's code would not take: no answer, not 2xx, not JSON — the browser writes "Error getting status" then)
const broken = reply => reply.error !== undefined || reply.status < 200 || reply.status > 299 || !readJson(reply).ok;

// 실리 서버가 상태 길에서 주는 이유(message)를 한국어로 (chat-completions.js 1937~2011 Azure). 모르는 글은 그대로
const ST_MESSAGES = {
    'Azure configuration is incomplete.': 'Azure 설정이 완전하지 않습니다.',
    'API version may be invalid for this resource.': '이 리소스에 맞지 않는 API 버전일 수 있습니다.',
    'Invalid API key or insufficient permissions.': 'API 키가 올바르지 않거나 권한이 부족합니다.',
    'Endpoint URL appears incorrect (404).': '엔드포인트 URL이 잘못된 것 같습니다 (404).',
    'Failed to connect to the Azure endpoint.': 'Azure 엔드포인트에 연결하지 못했습니다.',
};
const stMessage = m => ST_MESSAGES[m] ?? (m.startsWith('Azure Models endpoint error: ') ? `Azure 모델 엔드포인트 오류: ${m.slice(29)}` : m);
// (chat-completions.js 2143~2145: the provider answered no — a wrong key, or it is down —, SillyTavern sends 200 { error: true } and writes this)
const CC_FAILED = '채팅 완성 상태 확인에 실패했습니다. 액세스 토큰이 올바르지 않거나 API 엔드포인트가 꺼져 있습니다.';
// 실패한 연결 확인의 이유 → 글 ('' = 실리가 이유를 주지 않았어요)
function reasonOf(api, route, reply, threw) {
    if (reply.error !== undefined) return reply.timeout ? '시간이 초과되었습니다.' : '실리 서버에 연결할 수 없습니다.';
    const json = readJson(reply);
    const body = json.ok && json.json && typeof json.json === 'object' ? json.json : null;
    const message = typeof body?.message === 'string' && body.message ? stMessage(body.message) : '';
    if (reply.status < 200 || reply.status > 299) return message || `${route} (${reply.status})`;
    if (!json.ok) return '응답을 읽을 수 없습니다.';
    if (body && 'error' in body) return message || (api === 'openai' ? CC_FAILED : '');
    return threw ? String(threw?.message || threw) : '';
}

// 캐시 (열쇠로 읽으면 맨 뒤로: 오래 안 쓴 것부터 밀려나요. Azure 칸 · 묻는 중인 칸은 밀려나지 않아요)
function cacheGet(key) {
    const e = cache.get(key);
    if (e) { cache.delete(key); cache.set(key, e); }
    return e;
}
function cachePut(key, e) {
    cache.delete(key);
    cache.set(key, e);
    for (const [k, x] of cache) {
        if (cache.size <= CACHE_MAX) break;
        if (!x.azure && !x.pending && k !== key) cache.delete(k);
    }
    return e;
}
// Azure 답을 디스크에 (일꾼을 다시 띄워도 다시 묻지 않게). 열쇠는 해시로: 다리 주소 · 키 글은 들어 있지 않아요
const azureId = key => crypto.createHash('sha256').update(key).digest('hex');
// (the file as it is now. Only answers that may have come from the paid check: an older file may hold free failures too)
async function azureRead(root) {
    try {
        const x = JSON.parse(await fs.readFile(path.join(root, AZURE_FILE), 'utf8'));
        if (x && typeof x === 'object' && x.v === 1 && x.entries && typeof x.entries === 'object') return Object.fromEntries(Object.entries(x.entries).filter(([, v]) => paid(v?.reply)));
    } catch { /* none, or broken: asked again and written anew */ }
    return {};
}
async function azureLoad(root) {
    if (!root) return {};
    if (!azureDisk.has(root)) azureDisk.set(root, await azureRead(root));
    return azureDisk.get(root);
}
async function azureSave(root, key, reply) {
    if (!root || !paid(reply)) return;
    // (read again first: another worker of this SillyTavern — the next one starts while the last one stops — may have put its own)
    const all = { ...(await azureLoad(root)), ...(await azureRead(root)) };
    delete all[azureId(key)];
    all[azureId(key)] = { reply };
    for (const k of Object.keys(all)) { if (Object.keys(all).length <= AZURE_KEEP) break; delete all[k]; }
    azureDisk.set(root, all);
    const file = path.join(root, AZURE_FILE), tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(tmp, JSON.stringify({ v: 1, entries: all }));
        await fs.rename(tmp, file);
    } catch { await fs.rm(tmp, { force: true }).catch(() => {}); }
}

// 실리 textgen-models.js syncNanoGptProvidersForModel 417~460의 값 부분과 그 칸의 change(openai.js 7290~7291).
// 공급자를 고를 수 없는 모델이면 값이 있는 옵션을 모두 끄고 change → 고른 옵션이 꺼져 있으면 jQuery val()은 null → ''. 고를 수 있으면
// 'change.select2'만이라 값은 그대로. 답이 2xx가 아니거나 실패하면 그대로(439~442 · 459~462)
async function nanoProviders(modelId) {
    if (!modelId) return;
    let data;
    try {
        const response = await naFetch('/api/nanogpt/models/providers', { method: 'POST', headers: SCRIPT.getRequestHeaders(), body: JSON.stringify({ model: modelId }) });
        if (!response.ok) return;
        data = await response.json();
    } catch { return; }
    const providerIds = Array.isArray(data?.providers) ? data.providers : [];
    if (!data?.supportsProviderSelection || providerIds.length === 0) OAI.oai_settings.nanogpt_provider = '';
}

/**
 * 지금 설정(naLoad로 채운 것)으로 실리 브라우저의 연결 확인을 해요. main_api가 openai · textgenerationwebui · kobold일 때만(실리처럼 지금 고른 것 하나).
 * @param {{ root?: string, send?: (url: string, init: object) => Promise<Response>, now?: () => number, timeoutMs?: number, log?: (text: string) => void, skip?: boolean }} [o]
 *   root: 사용자 폴더 (secrets.json · Azure 답) · send: 실리 서버로 가는 길(다리) · now: 시계(늘기만 하는 것) · log: 실리 창 한 줄 ·
 *   skip: 연결하지 않고 페이지를 연 그대로만 (실리 연결을 쓰지 않는 세계: plugin/work.mjs)
 * @returns {Promise<{ api: string, key: string|null, fetched: boolean, waited: boolean, refreshed: boolean, ok: boolean, replayed: boolean, skipped: boolean, noKey: boolean }>}
 *   fetched: 다리에 물었어요 · waited: 처음 묻는 열쇠라 답을 기다렸어요 · refreshed: 오래된 답이라 뒤에서 묻기 시작했어요(이 일은 둔 답으로)
 */
export async function naStatus({ root = '', send = null, now = () => performance.now(), timeoutMs = STATUS_TIMEOUT_MS, log = text => console.warn(TAG, text), skip = false } = {}) {
    const out = { api: '', key: null, fetched: false, waited: false, refreshed: false, ok: false, replayed: false, skipped: false, noKey: false };
    try {
        pageStart();
        if (skip) { out.skipped = true; return out; }
        const api = String(SCRIPT.main_api ?? '');
        out.api = api;
        const check = { openai: OAI.getStatusOpen, textgenerationwebui: TG.getStatusTextgen, kobold: KAI.getStatusKobold }[api];
        if (!check) return out;
        const route = STATUS_ROUTES[api];
        const secrets = await secretsNow(root, send, now, timeoutMs);
        let secretKeys = null;
        if (api === 'openai' && secrets.state) {
            // (onConnectButtonClick 6074~6093: no saved key for the source — the button does not connect, the page stays as it opened)
            SECRETS.__naSet({ secret_state: secrets.state });
            const gate = OAI.__naConnectGate();
            if (!gate) {
                out.noKey = true;
                const source = String(OAI.oai_settings.chat_completion_source);
                const full = source === OAI.chat_completion_sources.VERTEXAI && OAI.oai_settings.vertexai_auth_mode === 'full';
                if (tell(toldNoKey, JSON.stringify([root, source, full]))) log(full ? 'Vertex AI 전체 버전에는 서비스 계정 JSON이 필요합니다. 서비스 계정 JSON을 확인하고 저장하세요.' : `${source}에 저장된 키가 없습니다.`);
                return out;
            }
            for (const k of [...toldNoKey]) if (JSON.parse(k)[0] === root) toldNoKey.delete(k);
            if (gate.key) secretKeys = [gate.key];
        }
        if (api === 'textgenerationwebui') secretKeys = [TEXTGEN_SECRETS[TG.textgenerationwebui_settings.type]].filter(Boolean);
        if (api === 'kobold') secretKeys = [];
        const secretsKey = secretsPart(secrets, secretKeys);
        const keyOf = (url, body) => {
            let b = body ?? null;
            // (custom_include_headers: the template, not what its macros gave this time — the browser resolves it once, when it connects —,
            //  and the user name the page has then)
            if (api === 'openai' && url === route) {
                const p = parse(b);
                if (p && typeof p === 'object' && 'custom_include_headers' in p) b = JSON.stringify({ ...p, custom_include_headers: { template: String(OAI.oai_settings.custom_include_headers ?? ''), name1: SCRIPT.name1 } });
            }
            return JSON.stringify([root, api, url, b, secretsKey]);
        };
        const disk = await azureLoad(root);
        // (an answer that came behind a job: the next job uses it. Azure's, when it may have come from the paid check, also on disk)
        const took = (e, key, reply) => {
            Object.assign(e, { at: now(), reply, judged: false });
            if (e.url !== route) judgeSide(e);
            if (e.azure) return azureSave(root, key, reply);
        };
        const behind = (e, key, asking) => { e.pending = asking.then(reply => took(e, key, reply)).finally(() => { e.pending = null; }); };
        // (a refresh: asked behind the job — this job uses what is kept —, one at a time per key)
        const refresh = (e, key) => {
            if (e.pending) return;
            out.fetched = true;
            out.refreshed = true;
            behind(e, key, ask(send, e.url, e.init, e.azure ? null : timeoutMs));
        };
        // (a way the check calls besides the status route — the NanoGPT providers —: good when 2xx)
        const judgeSide = e => { e.judged = true; e.ok = !broken(e.reply); e.good = e.reply; e.fails = e.ok ? 0 : e.fails + 1; };
        let threw = null;
        saveThrew = null;
        // mode 'live': 열쇠의 답이 오래됐으면 다시 물어요 · 'good': 그 열쇠로 전에 받은 좋은 답 · 'held': 지금 둔 답 그대로
        const run = async (mode) => {
            let used = null;
            nanoAsked = undefined;
            __naSetFetch(async (url, init = {}) => {
                const u = String(url);
                const key = keyOf(u, init.body);
                if (u === route) used = key;
                let e = cacheGet(key);
                if (mode === 'live') {
                    // (SillyTavern's own signal stays with this job: a refresh behind it has its own time limit)
                    const plain = { ...init };
                    delete plain.signal;
                    const azure = isAzure(api, u, route, init.body);
                    if (!e && azure && paid(disk[azureId(key)]?.reply)) {
                        // (asked before this worker started: kept on disk)
                        e = cachePut(key, { url: u, init: plain, at: now(), reply: disk[azureId(key)].reply, judged: false, ok: false, okLike: false, fails: 0, ttl: okAge(api, parse(init.body)), azure: true, pending: null, told: null });
                    }
                    if (!e) {
                        // (the first time for this key: waited for, as the browser waits for its connect)
                        out.fetched = true;
                        out.waited = true;
                        // (Azure: not cut off at the time limit — SillyTavern may be in the paid check —: this job goes on without it, the answer is kept when it comes)
                        const asking = ask(send, u, plain, azure ? null : timeoutMs);
                        const reply = azure ? await waitAtMost(asking, timeoutMs) : await asking;
                        e = cachePut(key, { url: u, init: plain, at: now(), reply: reply ?? TIMED_OUT(), judged: false, ok: false, okLike: false, fails: 0, ttl: okAge(api, parse(init.body)), azure, pending: null, told: null });
                        if (u !== route) judgeSide(e);
                        if (azure && !reply) behind(e, key, asking);
                        else if (azure) await azureSave(root, key, reply);
                    } else {
                        e.init = plain;
                        if (!fresh(e, now())) refresh(e, key);
                    }
                }
                const reply = mode === 'good' && u === route ? e?.good : e?.reply;
                if (!reply) throw new Error('상태 답이 없습니다.');
                return answer(reply);
            });
            // (validateReverseProxy throws for a proxy not confirmed yet: the browser's connect stops there too. Its toastr already wrote why)
            try {
                await check();
                if (nanoAsked !== undefined) await nanoProviders(nanoAsked);
            } catch (err) { threw = err; /* as the browser */ }
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
            if (noUrl && tell(toldNoUrl, k)) log('상태를 확인할 주소가 없습니다.');
            if (!noUrl) toldNoUrl.delete(k);
            return out;
        }
        toldNoUrl.clear();
        const e = cache.get(key);
        if (!e) return out;
        const json = readJson(e.reply);
        const hasError = !!(json.ok && json.json && typeof json.json === 'object' && 'error' in json.json);
        e.ok = !broken(e.reply) && !hasError && SCRIPT.online_status !== 'no_connection';
        out.ok = e.ok;
        if (!e.judged) {
            e.judged = true;
            e.fails = e.ok ? 0 : e.fails + 1;
            // (a 2xx answer SillyTavern's code still did not take: the same answer would do the same — asked again when a good one would be)
            e.okLike = !e.ok && !broken(e.reply) && !hasError;
        }
        if (e.ok) {
            e.good = e.reply;
            e.told = null;
            return out;
        }
        const why = e.reply.status === 404 ? `실리 서버의 ${route}를 쓸 수 없습니다. 서버 플러그인을 업데이트하고 실리를 다시 시작하세요.` : (r => (r ? `상태를 가져오는 중 오류가 발생했습니다: ${r}` : '상태를 가져오는 중 오류가 발생했습니다.'))(reasonOf(api, route, e.reply, threw || saveThrew));
        if (e.told !== why) { e.told = why; log(why); }
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
const isAzure = (api, url, route, body) => api === 'openai' && url === route && parse(body)?.chat_completion_source === OAI.chat_completion_sources.AZURE_OPENAI;
