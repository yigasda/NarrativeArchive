// 서버 쪽: 경우 하나를 옮긴 실리 코드로 → { generate_data, stream, canMultiSwipe } | { error } (tests/stopenai.cases.mjs)
import { naLoad } from '../plugin/st/naload.js';
import * as SCRIPT from '../plugin/st/public/script.js';
import * as OAI from '../plugin/st/public/scripts/openai.js';
import { power_user } from '../plugin/st/public/scripts/power-user.js';
import { getStringHash } from '../plugin/st/public/scripts/utils.js';
import { __naSetFetch, naFetchFailures } from '../plugin/st/public/naFetch.js';
import { NAME1, NAME2, withHash } from './stopenai.cases.mjs';

export const hashed = c => withHash(c, getStringHash);
// → 서버가 채운 값(브라우저에도 그대로 넣어요)
export function loadCase(c) {
    naLoad(hashed(c).settings);
    SCRIPT.__naSet({ name1: NAME1, name2: NAME2 });
    return { oai: structuredClone(OAI.oai_settings), pu: structuredClone(power_user) };
}
// send(url, init) → Response: 실리 서버로 가는 길 (없으면 실리 서버에 못 가요: 로짓 바이어스 경우만 필요해요)
export async function runCase(c, send = null) {
    loadCase(c);
    __naSetFetch(send);
    try { return JSON.parse(JSON.stringify(await OAI.createGenerationParameters(structuredClone(OAI.oai_settings), c.model, c.type, structuredClone(c.messages)))); }
    catch (err) { return { error: String(err?.message || err) }; }
}
export const failures = () => [...naFetchFailures];
