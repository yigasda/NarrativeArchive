// 서버 쪽: 경우 하나를 옮긴 실리 코드로(plugin/st/naload.js naSendRequest = 실리 ConnectionManagerRequestService.sendRequest) →
// { gen: [잡은 생성 요청 { url, body }], ret: 돌려준 것 | { error, cause } } (tests/stprofile2.cases.mjs)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { naLoad, naLoadPresets, naSendRequest, ConnectionManagerRequestService } from '../plugin/st/naload.js';
import * as SCRIPT from '../plugin/st/public/script.js';
import { getStringHash } from '../plugin/st/public/scripts/utils.js';
import { extension_settings } from '../plugin/st/public/scripts/extensions.js';
import { __naSetFetch, naFetchFailures } from '../plugin/st/public/naFetch.js';
import { NAME1, NAME2, GENERATE, writePresets, withHash } from './stprofile2.cases.mjs';

let presetRoot = null;
async function presets() {
    if (!presetRoot) {
        presetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'na-stprofile2-'));
        writePresets(presetRoot);
        process.once('exit', () => fs.rmSync(presetRoot, { recursive: true, force: true }));
    }
    return await naLoadPresets(presetRoot);
}

export const settingsOf = c => withHash(c.settings, getStringHash);
const out = v => JSON.parse(JSON.stringify(v ?? null));

// send(url, init) → Response: 생성 요청이 아닌 것(토크나이저 · 로짓 바이어스)이 가는 실리 서버 길
export async function runCase(c, send = null) {
    naLoad(structuredClone(settingsOf(c)), await presets());
    SCRIPT.__naSet({ name1: NAME1, name2: NAME2 });
    const gen = [];
    __naSetFetch(async (url, init) => {
        if (GENERATE.includes(url)) {
            gen.push({ url, body: JSON.parse(init.body) });
            return new Response(JSON.stringify(c.reply), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (!send) return new Response('Not Found', { status: 404 });
        return await send(url, init);
    });
    const S = ConnectionManagerRequestService;
    let ret;
    try {
        if (c.kind === 'supported') {
            const profiles = extension_settings.connectionManager.profiles;
            ret = { allowed: S.getAllowedTypes(), map: SCRIPT.CONNECT_API_MAP, each: profiles.map(p => [p.id, S.isProfileSupported(p)]), supported: S.getSupportedProfiles().map(p => p.id) };
        } else if (c.kind === 'construct') {
            ret = S.constructPrompt(structuredClone(c.prompt), c.profile);
        } else {
            ret = await naSendRequest(c.profile, structuredClone(c.prompt), c.maxTokens, structuredClone(c.custom), structuredClone(c.override));
        }
        ret = out(ret);
    } catch (err) {
        ret = { error: String(err?.message || err), cause: err?.cause ? String(err.cause?.message || err.cause) : null };
    }
    return { gen, ret };
}
export const failures = () => [...naFetchFailures];
