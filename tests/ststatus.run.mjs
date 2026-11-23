// 서버 쪽: 경우 하나를 옮긴 실리 코드로(plugin/st/nastatus.js naStatus → 연결한 뒤의 요청) →
// { phases: [연결할 때마다 페이지가 들고 있는 것], request: 만든 요청 | { error } } (tests/ststatus.cases.mjs)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { naLoad, naLoadPresets, naSendRequest } from '../plugin/st/naload.js';
import { naStatus, __naStatusReset, __naStatusIdle } from '../plugin/st/nastatus.js';
import * as SCRIPT from '../plugin/st/public/script.js';
import * as OAI from '../plugin/st/public/scripts/openai.js';
import * as TG from '../plugin/st/public/scripts/textgen-settings.js';
import * as TGM from '../plugin/st/public/scripts/textgen-models.js';
import * as KAI from '../plugin/st/public/scripts/kai-settings.js';
import { TOKENIZER_SUPPORTED_KEY, __naSessionStorage } from '../plugin/st/public/scripts/tokenizers.js';
import { getStringHash } from '../plugin/st/public/scripts/utils.js';
import { __naSetFetch } from '../plugin/st/public/naFetch.js';
import { writePresets } from './stprofile2.cases.mjs';
import { NAME1, NAME2, MESSAGES, TC_CUSTOM, TC_REPLY, GENERATE, settingsOf as settingsWith, pickModels, pickNums } from './ststatus.cases.mjs';

let presetRoot = null;
async function presets() {
    if (!presetRoot) {
        presetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'na-ststatus-'));
        writePresets(presetRoot);
        process.once('exit', () => fs.rmSync(presetRoot, { recursive: true, force: true }));
    }
    return await naLoadPresets(presetRoot);
}
export const settingsOf = c => settingsWith(c, getStringHash);
export const T0 = Date.UTC(2026, 10, 23, 3, 0, 0);
const out = v => JSON.parse(JSON.stringify(v ?? null));

// 페이지가 연결한 뒤 들고 있는 것 (oracle-status.mjs의 브라우저 쪽과 같은 칸)
export function snapshot() {
    return out({
        online_status: SCRIPT.online_status,
        model_list: OAI.model_list,
        oai: pickModels(OAI.oai_settings),
        nums: pickNums(OAI.oai_settings),
        tg: pickModels(TG.textgenerationwebui_settings),
        openRouterModels: TGM.openRouterModels,
        tok: __naSessionStorage.getItem(TOKENIZER_SUPPORTED_KEY),
        kai_flags: KAI.kai_flags,
        model: SCRIPT.substituteParams('{{model}}'),
    });
}

/**
 * @param {object} c 경우
 * @param {(url: string, init: object) => Promise<Response>} send 실리 서버로 가는 길 (상태 · 토크나이저 · 로짓 바이어스)
 * @param {{ root?: string, phase?: (i: number) => Promise<void>|void, logs?: string[] }} [o] root: secrets.json이 있는 사용자 폴더 · phase: 연결 i 전에(가짜 공급자를 바꿔요)
 */
export async function runCase(c, send, { root = '', phase = null, logs = [] } = {}) {
    __naStatusReset();
    // (a page that never connected with these settings: no Azure answer kept from another case — plugin/st/nastatus.js keeps it in the user folder)
    if (root) fs.rmSync(path.join(root, 'NarrativeArchive', 'status-azure.json'), { force: true });
    const phases = [];
    const data = await presets();
    for (const [i, ph] of c.phases.entries()) {
        await phase?.(i);
        // (the worker's job: settings.json read again, then the connection — plugin/work.mjs withWorld)
        const job = () => { naLoad(structuredClone(settingsOf(c)), data); return naStatus({ root, send, now: () => T0 + ph.at, log: t => logs.push(t) }); };
        const r = await job();
        // (asked again behind that job — it used the kept answer —: the job after it has the new one. The browser's connect, one job later)
        if (r.refreshed) { await __naStatusIdle(); await job(); }
        phases.push(snapshot());
    }
    SCRIPT.__naSet({ name1: NAME1, name2: NAME2 });
    const gen = [];
    __naSetFetch(async (url, init) => {
        if (GENERATE.includes(url)) {
            gen.push({ url, body: JSON.parse(init.body) });
            return new Response(JSON.stringify(TC_REPLY), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return await send(url, init);
    });
    let request;
    try {
        if (c.request === 'cc') request = out(await OAI.createGenerationParameters(structuredClone(OAI.oai_settings), OAI.getChatCompletionModel(), 'quiet', structuredClone(MESSAGES)));
        else if (c.request === 'tc') { await naSendRequest('tc-main', structuredClone(MESSAGES), 300, structuredClone(TC_CUSTOM)); request = out(gen); }
        else request = out({ model: SCRIPT.substituteParams('{{model}}') });
    } catch (err) {
        request = { error: String(err?.message || err) };
    } finally {
        __naSetFetch(null);
    }
    return { phases, request };
}
