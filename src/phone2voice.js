// 폰 2(실시간)의 말투 읽기 (번역 전에 · 이야기에서 뽑기). phonetr.js의 askVoices · learnVoices · pickVoices를 줄 그대로
// 옮긴 것이고, 다른 곳은 요청을 만드는 뼈대뿐이에요(sideRequest → liveSideRequest. phone2req.js). 폰 1 파일은 읽기만 해요.
import { askDraft } from './ai.js';
import { parseJson } from './phoneparse.js';
import { cardBlocks } from './phonedata.js';
import { AI_SYS_PHONE_VOICE, langsOf, voicesWanted, voiceRows, whoKey } from './phonetr.js';
import { liveSideRequest, needLive } from './phone2req.js';

async function liveAskVoices(m, owner, p, names) {
    needLive(m);
    // (the cards and the persona whole; the owner's chosen profile only when it is a lorebook entry: a card or a persona is
    // in already)
    const binding = p.financeProfile || m?.phoneProfiles?.[String(owner || '').toLowerCase()] || null;
    const input = await liveSideRequest(m, owner, [...cardBlocks(), `[WHO]\n${names.map(n => `- ${n}`).join('\n')}`], { profile: binding?.type === 'lore' ? binding : undefined });
    const got = parseJson(String(await askDraft(input, { force: true, system: AI_SYS_PHONE_VOICE, maxTokens: 3000, effort: 'low' })).replace(/^[^{]*/, '').replace(/[^}]*$/, ''), { salvage: true }) || {};
    // (the owner's languages, read along with the voices: kept on the phone for 폰 2's replies; a reading that gives none
    // keeps what the phone had, and so does a line the user wrote themselves)
    const langs = langsOf(got.langs);
    if (langs && p.langs?.by !== 'user') p.langs = { ...langs, by: 'model' };
    const wanted = new Map(names.map(n => [n.toLowerCase(), n])), seen = new Set();
    return (Array.isArray(got.people) ? got.people : []).filter(v => v && wanted.has(whoKey(v)) && !seen.has(whoKey(v)) && String(v.style || '').trim()
        && (Array.isArray(v.evidence) ? v.evidence : []).some(e => String(e || '').trim()) && seen.add(whoKey(v)))
        .map(v => ({ who: wanted.get(whoKey(v)), style: String(v.style).trim().slice(0, 300), ...(String(v.label || '').trim() && String(v.label).trim().length <= 20 ? { label: String(v.label).trim() } : {}), evidence: v.evidence.map(e => String(e).trim()).filter(Boolean).slice(0, 2).map(e => e.slice(0, 160)), by: 'model' }));
}
export async function liveLearnVoices(m, owner, p, { all = false } = {}) {
    needLive(m);
    const want = voicesWanted(p, { all });
    if (!want.length) return 0;
    const rows = (await liveAskVoices(m, owner, p, want)).filter(r => !voiceRows(p).some(v => whoKey(v) === whoKey(r)));
    if (rows.length) p.koVoice = [...voiceRows(p), ...rows].slice(-80);
    const got1 = new Set(rows.map(r => r.who.toLowerCase()));
    p.koVoiceAsked = [...new Set([...(p.koVoiceAsked || []), ...want.filter(n => !got1.has(n.toLowerCase()))])].slice(-200);
    return rows.length;
}
export async function livePickVoices(m, owner, p, names) {
    needLive(m);
    const list = [...new Set((Array.isArray(names) ? names : [names]).map(n => String(n || '').trim()).filter(Boolean))].slice(0, 20);
    if (!list.length) return { found: [], missing: [] };
    const rows = await liveAskVoices(m, owner, p, list), keys = new Set(rows.map(r => whoKey(r)));
    const rest = (Array.isArray(p.koVoice) ? p.koVoice : []).filter(v => !keys.has(whoKey(v)));
    p.koVoice = [...rest, ...rows].slice(-80);
    p.koVoiceAsked = (p.koVoiceAsked || []).filter(x => !keys.has(String(x).toLowerCase()));
    return { found: rows.map(r => r.who), missing: list.filter(n => !keys.has(n.toLowerCase())) };
}
