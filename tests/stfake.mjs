// 테스트용 실리 쪽 (기대값): 서버 일꾼이 쓰는 옮긴 실리 코드(plugin/st, 실리 1.19.1 브라우저 코드 그대로)를 이 프로세스에서 일꾼과 같은 상태로 돌려서,
// 실리 브라우저가 이 채팅을 열고 보낼 요청을 만들어요. 일꾼은 다른 스레드라 모듈이 따로예요: 여기서 채운 것이 일꾼에 새지 않아요.
//   상태: 사용자 폴더의 settings.json · 프리셋 폴더(실리처럼 그때 읽어요) + 이 채팅의 이름 · 채팅 값(chat_metadata) · 페르소나 설명
//   보내는 것은 잡기만 해요(다리 없음). 생성 요청이 아닌 길(로짓 바이어스 · 토크나이저)은 answer(url, init) → Response
// 실리 코드 자체가 실리 브라우저와 같은지는 tests/stprofile2.test.mjs · tests/stopenai.test.mjs가 진짜 실리 브라우저의 기록(tests/fixtures)으로 봐요.
// 예시 캐릭터만 써요.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
// (naload.js first: it loads power-user.js before script.js, SillyTavern's own order)
import { naLoad, naLoadPresets, naSendRequest } from '../plugin/st/naload.js';
import * as SCRIPT from '../plugin/st/public/script.js';
import * as GROUPS from '../plugin/st/public/scripts/group-chats.js';
import { power_user } from '../plugin/st/public/scripts/power-user.js';
import * as OAI from '../plugin/st/public/scripts/openai.js';
import { variables } from '../plugin/st/public/scripts/st-context.js';
import { __naSetFetch, naFetchFailures } from '../plugin/st/public/naFetch.js';

export const GENERATE = ['/api/backends/chat-completions/generate', '/api/backends/text-completions/generate'];
// (what a reply's request asks of a connection profile: phone2go.js askRoom → ConnectionManagerRequestService.sendRequest)
export const REPLY_CUSTOM = { stream: false, extractData: true, includePreset: true, includeInstruct: true };

// state: { name1, name2, chat_metadata, persona } — SillyTavern's page with this chat open (plugin/work.mjs withWorld sets the same)
async function load(root, { name1 = 'Ren', name2 = 'Mara', chat_metadata = {}, persona = '' } = {}) {
    const settings = JSON.parse(await readFile(path.join(root, 'settings.json'), 'utf8'));
    naLoad(settings, await naLoadPresets(root));
    SCRIPT.__naSet({ name1, name2, characters: [], this_chid: undefined, chat: [], chat_metadata: structuredClone(chat_metadata) });
    GROUPS.__naSet({ groups: [], selected_group: null });
    power_user.persona_description = persona;
}
// reply: the generate route's answer (a JSON object) · answer(url, init) → Response for the other routes (none: 404)
async function capture({ reply = null, answer = null } = {}, fn) {
    const sent = [];
    __naSetFetch(async (url, init = {}) => {
        let body = init.body;
        try { body = JSON.parse(init.body); } catch { /* not JSON */ }
        sent.push({ url, body });
        if (GENERATE.includes(url)) return new Response(JSON.stringify(reply ?? { choices: [{ message: { content: '' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        return answer ? answer(url, init) : new Response('{}', { status: 404 });
    });
    // (the variable macros {{.x}} · {{$x}} read SillyTavern.getContext().variables while running — in the worker, its context)
    const had = globalThis.SillyTavern;
    globalThis.SillyTavern = { getContext: () => ({ variables }) };
    try {
        const out = await fn();
        return { sent, generate: sent.filter(x => GENERATE.includes(x.url)), out, failures: naFetchFailures.map(f => ({ ...f })) };
    } finally { globalThis.SillyTavern = had; __naSetFetch(null); }
}

/** 연결 프로필 요청: 실리 ConnectionManagerRequestService.sendRequest (plugin/st/naload.js naSendRequest) → { sent, generate, out, failures } */
export async function stProfileRequest(root, state, { profileId, messages, maxTokens = 4000, custom = REPLY_CUSTOM, over = undefined, reply = null, answer = null }) {
    await load(root, state);
    return capture({ reply, answer }, () => naSendRequest(profileId, structuredClone(messages), maxTokens, { ...custom }, over === undefined ? undefined : structuredClone(over)));
}

/** 실리 연결 방식 요청: 실리 openai.js createGenerationParameters(settingsOf(oai_settings), model, 'quiet', messages) → { generate_data, … } */
export async function stGenerationParameters(root, state, { settingsOf, model, messages, answer = null }) {
    await load(root, state);
    return capture({ answer }, () => OAI.createGenerationParameters(settingsOf(structuredClone(OAI.oai_settings)), model, 'quiet', structuredClone(messages)));
}
