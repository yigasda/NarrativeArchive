// 서버 쪽: variant 하나를 옮긴 실리 코드로 (plugin/st: naLoad → 이 채팅 → naMacrosJob → substituteParams). plugin/work.mjs withWorld와 같은 차례예요.
// ext: naDiscover가 돌려준 것(실리 페이지가 찾는 확장) · send(url, init) → Response: 다리 (표정 목록 /api/extra/classify/labels)
// → { '<state>:<text>': 나온 글 }
import { naLoad, naMacrosJob } from '../plugin/st/naload.js';
import { __naMacrosReset } from '../plugin/st/namacros.js';
import * as SCRIPT from '../plugin/st/public/script.js';
import * as G from '../plugin/st/public/scripts/group-chats.js';
import { __naSetFetch } from '../plugin/st/public/naFetch.js';
import { NAME1, CHARACTERS, GROUP, STATES, TEXTS } from './stmacros2.cases.mjs';

export async function runVariant(v, { ext, send }) {
    // (a variant is a page opened afresh: the expression list it keeps is asked for again)
    __naMacrosReset();
    const out = {};
    for (const s of STATES) {
        // (one job: the settings read again, then this chat as the page holds it once it is open)
        naLoad(structuredClone(v.settings), undefined, ext);
        const chid = s.group ? undefined : s.character;
        SCRIPT.__naSet({ name1: NAME1, name2: s.group ? '' : CHARACTERS[chid].name, characters: structuredClone(CHARACTERS), this_chid: chid, chat: structuredClone(s.chat), chat_metadata: structuredClone(s.meta) });
        G.__naSet(s.group ? { groups: [structuredClone(GROUP)], selected_group: GROUP.id } : { groups: [], selected_group: null });
        __naSetFetch(send);
        await naMacrosJob();
        for (const t of TEXTS) out[`${s.id}:${t.id}`] = SCRIPT.substituteParams(t.text, {});
        __naSetFetch(null);
    }
    return out;
}

// 다리 흉내: 기대값 파일에 적은 답으로 (bridge 'old'면 표시 없는 404, labels가 없으면 실리의 진짜 답을 적어 둔 것)
export const bridgeOf = (v, answers = {}) => async (url, init) => {
    const u = String(url).split('?')[0];
    const a = answers[u] ?? (u === '/api/extra/classify/labels' ? v.labels : null);
    const headers = { 'Content-Type': 'application/json', ...(v.bridge === 'old' ? {} : { 'x-na-bridge': '1' }) };
    if (v.bridge === 'old' || !a) return new Response('Not Found', { status: 404, headers });
    return new Response(typeof a.body === 'string' ? a.body : JSON.stringify(a.body), { status: a.status, headers });
};
