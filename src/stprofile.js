// 실리 연결 프로필로 보내는 요청을, 실리를 닫은 동안 서버 플러그인이 똑같이 보내게 (docs/PHONE2-PLAN.md "서버 플러그인" 3-2c).
// 연결 프로필의 요청은 실리의 브라우저 코드가 만들어요: public/scripts/extensions/shared.js ConnectionManagerRequestService.sendRequest
//   → custom-request.js ChatCompletionService · TextCompletionService processRequest (→ presetToGeneratePayload →
//   openai.js createGenerationParameters · textgen-settings.js createTextGenGenerationData · instruct-mode.js의 지시 형식).
// 서버에는 그 코드가 없어요. 그래서:
//   1) 브라우저 (profileTemplates): 실리 자신의 sendRequest를 자리표시 글로 불러요. 실리가 보내려는 순간(fetch) 그 요청만 받아 두고
//      보내지 않아요. 그 요청은 자리표시 글에 든 표시로 알아봐요: 실리의 다른 요청은 그대로 나가요.
//      두 번 떠요(자리표시 글 · 그 길이 · 답 길이를 바꿔서). 그 셋 말고 다른 것이 바뀌면(요청마다 달라지는 값, 글에 따라 바뀌는 값)
//      틀을 만들지 않아요: 서버가 브라우저와 다른 요청을 보내게 되니까요.
//   2) 서버 (fillProfileRequest · readProfileAnswer): 틀에 메시지(채팅 완성) · 글(글 완성)과 답 길이를 넣고, 비밀 칸은 실리의 설정
//      파일에서 채워서 실리 서버 자신의 처리기로 보내요. 답은 실리 코드를 그대로 옮긴 것으로 읽어요.
// 키는 담지 않아요: 키는 실리 서버가 프로필의 secret_id로 붙이고, 프록시 비밀번호 · 사용자 헤더(PT_SECRETS)는 틀에서 빼서
// 서버가 보낼 때 실리의 설정 파일에서 읽어요 (profileSecret: 실리가 그 칸을 채우는 순서 그대로).
// 이 파일은 실리 · 화면을 몰라요(필요한 것은 받아요). 실리 1.19.1 기준이에요: 실리가 바뀌면 아래 줄 번호의 코드와 다시 대 봐요.
//   실리에서 옮긴 것: extractMessageFromData (public/script.js 6276–6300) · extractReasoningFromData (public/scripts/reasoning.js 112–168) ·
//   글 완성의 멈춤 글 자르기 (public/scripts/custom-request.js 331–382). SillyTavern, AGPL-3.0 (NOTICE.md).

const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const PT = { v: 1 };
// 실리 서버의 처리기 (실리의 sendRequest가 보내는 곳)
export const PT_URL = { cc: '/api/backends/chat-completions/generate', tc: '/api/backends/text-completions/generate' };
// 틀에 담지 않는 칸 (비밀번호가 들 수 있어요)
export const PT_SECRETS = ['proxy_password', 'custom_include_headers'];
// 글 완성 틀의 글 속 자리
export const PT_TOKEN = { system: '\u0001NA_SYSTEM\u0001', user: '\u0001NA_USER\u0001' };

// 요청의 모양: 채팅 완성은 메시지를 통째로 바꿔 넣어서 모양이 상관없어요('*'). 글 완성은 메시지마다 지시 형식이 감싸서 역할 차례가 같아야 해요
//   → 's' · 'u' · 'a'의 줄 ('su' = 시스템 + 사용자) | '!' (글 완성 틀로 못 만드는 모양: 이름이 있거나 글이 아닌 내용)
export const ptShape = messages => (Array.isArray(messages) && messages.every(m => obj(m) && typeof m.content === 'string' && m.name === undefined && ['system', 'user', 'assistant'].includes(m.role)) ? messages.map(m => m.role[0]).join('') : '!');
// 어떤 요청의 틀인지: 프로필 · 프로필 요청에 얹는 값(추론 레벨) · 모양
export const ptKey = (profileId, over, shape) => JSON.stringify([String(profileId || ''), JSON.stringify(obj(over) ? over : {}), String(shape || '')]);
// 그 요청의 틀 (채팅 완성 것이 먼저, 없으면 그 모양의 글 완성 것) | null
export const ptFind = (pt, profileId, over, messages) => (obj(pt) ? pt[ptKey(profileId, over, '*')] || pt[ptKey(profileId, over, ptShape(messages))] || null : null);
// 틀을 못 만든 이유의 열쇠 (kit.ptWhy) · 프로필 요청에 얹는 추론 레벨 값의 열쇠 (kit.levels: ai.js stLevelPayload의 답)
export const ptWhyKey = (profileId, over) => JSON.stringify([String(profileId || ''), JSON.stringify(obj(over) ? over : {})]);
export const levelKey = (source, model, effort) => JSON.stringify([String(source || ''), String(model || ''), String(effort || '')]);

// 실리가 채팅 완성 프로필 요청의 비밀 칸에 넣는 값 (shared.js 441 · 457–458: 프로필의 프록시가 있으면 그 비밀번호가 이기고,
// custom-request.js 584–592: 아니면 프리셋 → 실리의 채팅 완성 설정. openai.js 2852 · 2926이 그 값을 요청에 넣어요)
//   proxy: 프로필의 프록시 { url, password } | null · preset: 쓴 프리셋 | null · oai: 실리의 oai_settings
export function profileSecret(key, { proxy = null, preset = null, oai = {} } = {}) {
    if (key === 'proxy_password' && obj(proxy) && proxy.password !== undefined) return proxy.password;
    if (obj(preset) && Object.hasOwn(preset, key)) return preset[key];
    return obj(oai) ? oai[key] : undefined;
}

// ---- 1) 브라우저: 실리가 보내려는 요청을 받아 두기
// 실리의 답 읽기가 읽는 빈 답 (채팅 완성 · 글 완성 둘 다)
const EMPTY = '{"choices":[{"index":0,"message":{"role":"assistant","content":""},"text":""}]}';
const catching = new Map();
let hooked = false;
// fetch를 한 번 감싸 두고 그대로 둬요 (풀지 않아요: 그사이 다른 확장이 감쌌으면 그걸 망가뜨리니까). 받아 둘 요청이 없으면 그냥 넘겨요
function hook() {
    if (hooked) return;
    hooked = true;
    const out = globalThis.fetch;
    globalThis.fetch = function (input, init) {
        const body = init?.body;
        if (catching.size && typeof body === 'string') {
            for (const [mark, got] of catching) {
                if (!body.includes(mark)) continue;
                got.push({ url: typeof input === 'string' ? input : String(input?.url || ''), body });
                return Promise.resolve(new globalThis.Response(EMPTY, { status: 200, headers: { 'Content-Type': 'application/json' } }));
            }
        }
        return out.apply(this, arguments);
    };
}
const markOf = () => `na${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
// (two different answer lengths, so where the length goes in the request can be told from everything else)
const MAX = [1999871, 2999873];
// 한 번 뜨기 → { req: { url, body }, messages (보낸 것의 사본), parts: { system, user } }
async function catchOnce(send, shape, n) {
    const mark = markOf(), pad = n ? '·'.repeat(37) : '';
    const parts = { system: `\u0001S${mark}${pad}\u0001`, user: `\u0001U${mark}${pad}\u0001` };
    const messages = [...(shape === 'su' ? [{ role: 'system', content: parts.system }] : []), { role: 'user', content: parts.user }];
    const got = [];
    hook();
    catching.set(mark, got);
    try { await send(JSON.parse(JSON.stringify(messages)), MAX[n]); }
    catch (err) { throw refusal(`연결 프로필로 요청을 만들지 못했습니다 (${String(err?.cause?.message || err?.message || err).slice(0, 160)})`); }
    finally { catching.delete(mark); }
    if (got.length !== 1) throw refusal(got.length ? '이 연결 프로필은 요청을 여러 번 보내 서버에서 보낼 수 없습니다.' : '이 연결 프로필의 요청을 만들지 못했습니다.');
    return { req: got[0], messages, parts, mark };
}
const refusal = why => Object.assign(new Error(why), { refusal: true });
// 두 번 뜬 것을 비교해요: 같은 칸은 그대로, 답 길이만 다른 칸은 그 자리를 적어요. 다른 것이 다르면 false
function compare(a, b, path, at) {
    if (a === b) return true;
    if (a === MAX[0] && b === MAX[1]) { at.push(path); return true; }
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => compare(x, b[i], [...path, i], at));
    if (obj(a) && obj(b)) { const ka = Object.keys(a); return ka.length === Object.keys(b).length && ka.every(k => Object.hasOwn(b, k) && compare(a[k], b[k], [...path, k], at)); }
    return false;
}
const once = (text, part) => typeof text === 'string' && text.split(part).length === 2;

// 연결 프로필 하나의 틀들 (실리 자신의 코드가 만든 요청) → { 틀의 열쇠: 틀 }. 못 만들면 refusal이 붙은 오류를 던져요 (이유는 화면에 가요)
//   send(messages, maxTokens) → 실리의 ConnectionManagerRequestService.sendRequest(프로필, messages, maxTokens, 답장 코드와 같은 값, over)
//   profile: 실리의 프로필 · over: 프로필 요청에 얹는 값 (없으면 null)
//   find: { proxy(이름) → { url, password } | null, preset(api, 이름) → 프리셋 | undefined, instruct(이름) → 지시 형식 | undefined, oai: oai_settings }
// 틀 = { v, api: 'cc' | 'tc', url, data (메시지 · 글 · 비밀 칸이 빠진 요청), max: [답 길이가 들어가는 자리], secrets: [빠진 비밀 칸],
//        proxy · preset (비밀 칸을 채울 곳: 실리가 쓴 프로필의 프록시 · 프리셋 이름 | null),
//        prompt (글 완성: PT_TOKEN 자리가 있는 글), instruct (글 완성의 지시 형식 순서들 | null), of (그때의 프로필) }
export async function profileTemplates({ send, profile, over = null, find = {} }) {
    const out = {}, shapes = ['su'];
    for (let i = 0; i < shapes.length; i++) {
        const shape = shapes[i], a = await catchOnce(send, shape, 0), b = await catchOnce(send, shape, 1);
        if (a.req.url !== b.req.url) throw refusal('이 연결 프로필은 요청 주소가 매번 달라 서버에서 보낼 수 없습니다.');
        const api = a.req.url === PT_URL.cc ? 'cc' : a.req.url === PT_URL.tc ? 'tc' : '';
        if (!api) throw refusal('이 연결 프로필의 요청 경로는 서버에서 보낼 수 없습니다.');
        const A = JSON.parse(a.req.body), B = JSON.parse(b.req.body);
        // (the order of SillyTavern's fields, so the server's request is the same text, not only the same fields)
        const tpl = { v: PT.v, api, url: a.req.url, keys: Object.keys(A) };
        if (api === 'cc') {
            // (the messages must go out as they were given: SillyTavern changes them for some models — o1: system → user)
            if (!same(A.messages, a.messages) || !same(B.messages, b.messages)) throw refusal('이 모델은 서버에서 보낼 수 없습니다.');
            delete A.messages; delete B.messages;
        } else {
            for (const [x, y] of [[A, a], [B, b]]) {
                if (!Object.values(y.parts).every(p => (y.messages.some(m => m.content === p) ? once(x.prompt, p) : !String(x.prompt).includes(p)))) throw refusal('이 텍스트 완성 프로필은 서버에서 보낼 수 없습니다.');
                x.prompt = String(x.prompt).split(y.parts.system).join(PT_TOKEN.system).split(y.parts.user).join(PT_TOKEN.user);
            }
            if (A.prompt !== B.prompt) throw refusal('이 텍스트 완성 프로필은 글 길이에 따라 요청이 달라 서버에서 보낼 수 없습니다.');
            tpl.prompt = A.prompt;
            delete A.prompt; delete B.prompt;
        }
        if (JSON.stringify(A).includes(a.mark) || JSON.stringify(B).includes(b.mark)) throw refusal('이 연결 프로필은 메시지를 다른 필드에도 넣어 서버에서 보낼 수 없습니다.');
        const max = [];
        if (!compare(A, B, [], max)) throw refusal('이 연결 프로필은 요청마다 값이 달라 서버에서 보낼 수 없습니다.');
        if (!max.length) throw refusal('이 연결 프로필의 요청에서 최대 토큰을 찾을 수 없습니다.');
        tpl.max = max;
        // (the secret fields: left out, and checked to be what SillyTavern's settings files hold — so the server, reading them, sends the same)
        const proxyName = typeof profile?.proxy === 'string' && profile.proxy ? profile.proxy : null, presetName = typeof profile?.preset === 'string' && profile.preset ? profile.preset : null;
        const proxy = proxyName ? find.proxy?.(proxyName) || null : null, preset = presetName ? find.preset?.(api === 'cc' ? 'openai' : 'textgenerationwebui', presetName) || null : null;
        tpl.proxy = proxy ? proxyName : null;
        tpl.preset = preset ? presetName : null;
        tpl.secrets = [];
        for (const key of PT_SECRETS) {
            if (!Object.hasOwn(A, key)) continue;
            const want = profileSecret(key, { proxy, preset: api === 'cc' ? preset : null, oai: find.oai });
            // (custom_include_headers: SillyTavern fills {{macros}} in it in the browser — the server cannot)
            if (A[key] !== (key === 'custom_include_headers' ? String(want ?? '') : want)) throw refusal(`${key}에 매크로가 있어 서버에서 보낼 수 없습니다.`);
            tpl.secrets.push(key);
            delete A[key];
        }
        if (api === 'tc') {
            const ins = typeof profile?.instruct === 'string' && profile.instruct ? find.instruct?.(profile.instruct) : undefined;
            tpl.instruct = obj(ins) ? Object.fromEntries(['stop_sequence', 'input_sequence', 'output_sequence', 'last_output_sequence'].map(k => [k, ins[k] ?? null])) : null;
            if (shape === 'su') shapes.push('u');
        }
        tpl.data = A;
        // (the profile as it was: the server sends only while the profile in SillyTavern's settings is still this one)
        tpl.of = JSON.parse(JSON.stringify(profile ?? null));
        out[ptKey(profile?.id, over, api === 'cc' ? '*' : shape)] = tpl;
    }
    return out;
}

// ---- 2) 서버: 틀로 요청 만들기 · 답 읽기
// → 실리 서버로 보낼 요청의 몸통. secret(key) → 그 비밀 칸의 값 (profileSecret으로)
export function fillProfileRequest(tpl, { messages, maxTokens, secret = () => undefined }) {
    if (!obj(tpl) || tpl.v !== PT.v || !obj(tpl.data)) throw new Error('연결 프로필의 요청 템플릿을 읽을 수 없습니다.');
    const data = JSON.parse(JSON.stringify(tpl.data));
    for (const path of tpl.max || []) {
        let at = data;
        for (const k of path.slice(0, -1)) at = at[k];
        at[path[path.length - 1]] = maxTokens;
    }
    for (const key of tpl.secrets || []) {
        if (!PT_SECRETS.includes(key)) continue;
        const v = secret(key);
        if (key === 'custom_include_headers') {
            const s = String(v ?? '');
            if (s.includes('{{')) throw new Error(`${key}에 매크로가 있어 서버에서 보낼 수 없습니다.`);
            data[key] = s;
        } else if (v !== undefined) data[key] = v;
    }
    if (tpl.api === 'cc') data.messages = messages;
    else {
        // (text completion: each message where SillyTavern's instruct formatting put the stand-in — custom-request.js constructPrompt)
        const fill = { [PT_TOKEN.system]: messages.find(m => m.role === 'system')?.content, [PT_TOKEN.user]: messages.find(m => m.role === 'user')?.content };
        let parts = [String(tpl.prompt)];
        for (const [tok, text] of Object.entries(fill)) {
            parts = parts.flatMap(p => (typeof p !== 'string' ? [p] : p.split(tok).flatMap((s, i) => (i ? [{ text: String(text ?? '') }, s] : [s]))));
        }
        data.prompt = parts.map(p => (typeof p === 'string' ? p : p.text)).join('');
    }
    // (in SillyTavern's order; anything not in it after)
    const out = {};
    for (const k of Array.isArray(tpl.keys) ? tpl.keys : []) if (Object.hasOwn(data, k)) out[k] = data[k];
    for (const k of Object.keys(data)) if (!Object.hasOwn(out, k)) out[k] = data[k];
    return out;
}

// 실리가 읽는 그대로 (custom-request.js ChatCompletionService.sendRequest 471–493 · TextCompletionService.sendRequest 127–144 · processRequest 331–382)
//   oaiSource: 실리의 지금 채팅 완성 연결 (실리가 채팅 완성의 생각 글을 그 연결의 모양으로 읽어요: reasoning.js 131)
export function readProfileAnswer(tpl, body, json, { ok = true, extractData = true, oaiSource = '' } = {}) {
    if (!ok || json.error) throw new Error(String(json.error?.message || 'Response not OK'));
    if (!extractData) return json;
    if (tpl.api === 'cc') return { content: extractMessageFromData(json, 'openai'), reasoning: extractReasoningFromData(json, { mainApi: 'openai', textGenType: body.chat_completion_source, chatCompletionSource: oaiSource, ignoreShowThoughts: true }) };
    const out = { content: extractMessageFromData(json, 'textgenerationwebui'), reasoning: extractReasoningFromData(json, { mainApi: 'textgenerationwebui', textGenType: body.api_type, ignoreShowThoughts: true }) };
    if (!body.stream) out.content = trimTextCompletion(out.content, body.stopping_strings, tpl.instruct);
    return out;
}

// ---- 실리에서 옮긴 것 (그대로)
// public/script.js extractMessageFromData (6276–6300): activeApi를 늘 줘요 (실리의 main_api 대신)
export function extractMessageFromData(data, activeApi) {
    function getResult() {
        if (typeof data === 'string') {
            return data;
        }

        switch (activeApi) {
            case 'kobold':
                return data.results[0].text;
            case 'koboldhorde':
                return data.text;
            case 'textgenerationwebui':
                return data.choices?.[0]?.text ?? data.choices?.[0]?.message?.content ?? data.content ?? data.response ?? data[0]?.content ?? '';
            case 'novel':
                return data.output;
            case 'openai':
                return data?.content?.filter(p => p.type === 'text')?.map(p => p.text)?.join('\n\n') ?? data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? data?.text ?? data?.message?.content?.[0]?.text ?? data?.message?.tool_plan ?? '';
            default:
                return '';
        }
    }

    const result = getResult();
    return Array.isArray(result) ? result.map(x => x.text).filter(x => x).join('') : result;
}
// public/scripts/reasoning.js extractReasoningFromData (112–168): 실리의 main_api · oai_settings · textgen 설정 대신 받은 값으로
//   (ignoreShowThoughts는 연결 프로필 요청이 늘 true로 줘요)
export function extractReasoningFromData(data, { mainApi = null, ignoreShowThoughts = false, textGenType = null, chatCompletionSource = null, showThoughts = false } = {}) {
    switch (mainApi) {
        case 'textgenerationwebui':
            switch (textGenType) {
                case 'openrouter':
                    return data?.choices?.[0]?.reasoning ?? '';
                case 'ollama':
                    return data?.thinking ?? '';
            }
            break;

        case 'openai':
            if (!ignoreShowThoughts && !showThoughts) break;

            switch (chatCompletionSource) {
                case 'deepseek':
                    return data?.choices?.[0]?.message?.reasoning_content ?? '';
                case 'xai':
                    return data?.choices?.[0]?.message?.reasoning_content ?? '';
                case 'openrouter':
                    return data?.choices?.[0]?.message?.reasoning
                        ?? data?.choices?.[0]?.message?.reasoning_content
                        ?? '';
                case 'makersuite':
                case 'vertexai':
                    return data?.responseContent?.parts?.filter(part => part.thought)?.map(part => part.text)?.join('\n\n') ?? '';
                case 'claude':
                    return data?.content?.filter(part => part.type === 'thinking')?.map(part => part.thinking)?.join('\n\n') ?? '';
                case 'mistralai':
                    return data?.choices?.[0]?.message?.content?.[0]?.thinking?.map(part => part.text)?.filter(x => x)?.join('\n\n') ?? '';
                case 'aimlapi':
                case 'pollinations':
                case 'moonshot':
                case 'cometapi':
                case 'chutes':
                case 'electronhub':
                case 'nanogpt':
                case 'siliconflow':
                case 'zai':
                case 'workers_ai':
                case 'fireworks':
                case 'custom': {
                    return data?.choices?.[0]?.message?.reasoning_content
                        ?? data?.choices?.[0]?.message?.reasoning
                        ?? '';
                }
            }
            break;
    }

    return '';
}
// public/scripts/custom-request.js TextCompletionService.processRequest의 "Remove stopping strings from the end" (331–382)
//   stoppingStrings: 보낸 요청의 stopping_strings · instructPreset: 지시 형식 (없으면 null)
export function trimTextCompletion(message, stoppingStrings, instructPreset) {
    message = message.replace(/[^\S\r\n]+$/gm, '');

    if (stoppingStrings) {
        for (const stoppingString of stoppingStrings) {
            if (stoppingString.length) {
                for (let j = stoppingString.length; j > 0; j--) {
                    if (message.slice(-j) === stoppingString.slice(0, j)) {
                        message = message.slice(0, -j);
                        break;
                    }
                }
            }
        }
    }

    if (instructPreset) {
        [
            instructPreset.stop_sequence,
            instructPreset.input_sequence,
        ].forEach(sequence => {
            if (sequence?.trim()) {
                const index = message.indexOf(sequence);
                if (index !== -1) {
                    message = message.substring(0, index);
                }
            }
        });

        [
            instructPreset.output_sequence,
            instructPreset.last_output_sequence,
        ].forEach(sequences => {
            if (sequences) {
                sequences.split('\n')
                    .filter(line => line.trim() !== '')
                    .forEach(line => {
                        message = message.replaceAll(line, '');
                    });
            }
        });
    }

    return message;
}
