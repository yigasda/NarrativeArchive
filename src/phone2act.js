// 폰 2(실시간)의 "앱 안에서 하나 만들기": 사진 · 메모(일기) · 초안 · 녹음.
// phoneai.js의 takePhoto · writeEntry · makeDraft · recordVoice를 줄 그대로 옮긴 것이고, 다른 곳은 둘뿐이에요.
//   지금(NOW · 찍힌 시각) = 실시간 서랍의 흐르는 시계 (없으면 폰에 저장된 시각). 롤플 상태창은 안 읽어요.
//   최근 대화(RECENT CHAT) = 메신저 대화, 자리가 남으면 그 앞에 실시간 폰을 시작하기 전 이야기. 시작 뒤 롤플은 안 읽어요.
// 지시문(AI_SYS_*)은 폰 1 것 그대로 써요. 폰 1 파일은 여기서 읽기만 해요.
import { ownerProfileBlock } from './phoneprofile.js';
import { askAI } from './ai.js';
import { parseJson } from './phoneparse.js';
import { ctx, saveMeta } from './core.js';
import { AI_SYS_SHOT, AI_SYS_WRITE, AI_SYS_DRAFT, AI_SYS_VOICE } from './phoneai.js';
import { recentPhoneText, CAP, ensureIds, secOf, ko, line, MOODS, namesBlock, pick, str } from './phonedata.js';
import { isLiveMeta, liveNowText } from './phone2store.js';

// 실시간 서랍이 아니면 여기 함수는 안 돌아요 (폰 1 것을 건드리지 않게)
const need = m => { if (!isLiveMeta(m)) throw new Error('실시간 폰의 서랍이 아니에요'); return m; };
// 최근 대화: 메신저 대화, 줄 수와 글자 수가 남으면 그 앞에 시작 전 이야기의 마지막 메시지
export function liveRecentText(m, owner, n, o = {}) {
    const talk = typeof m?.phoneRecent === 'function' ? m.phoneRecent(owner, n, o) : '', k = talk ? talk.split('\n').length : 0, room = (o.maxChars ?? Infinity) - talk.length;
    const before = k < n && room > 0 && Number.isInteger(m?.phoneUpto) && m.phoneUpto >= 0 ? recentPhoneText(n - k, { maxChars: room, upto: m.phoneUpto }) : '';
    return [before, talk].filter(Boolean).join('\n\n');
}

export async function liveTakePhoto(m, p) {
    need(m);
    const prompt = [
        `[OWNER]\n${p.owner}`, `[NOW]\n${liveNowText(m, p)}`,
        `[RECENT CHAT]\n${liveRecentText(m, p.owner, 12, { maxChars: 9000 })}`,
        `[PHOTOS SO FAR]\n${p.photos.slice(-3).map(x => `- ${x.caption}`).join('\n') || '(none)'}`,
        namesBlock(m),
    ].filter(Boolean).join('\n\n');
    const out = String(await askAI(prompt, { force: true, system: AI_SYS_SHOT, maxTokens: 1500 }) || '').replace(/```(?:json)?/gi, '');
    const a = out.indexOf('{'), b = out.lastIndexOf('}');
    let raw = null;
    try { raw = a >= 0 && b > a ? parseJson(out.slice(a, b + 1)) : null; } catch { raw = null; }
    const caption = line(raw?.caption, 200);
    if (!caption) throw new Error('모델 답에서 사진 설명을 찾지 못했어요');
    p.photos.push({ caption, ko: ko(raw?.ko), time: liveNowText(m, p), mood: pick(raw?.mood, MOODS, 'warm') });
    p.photos = p.photos.slice(-CAP.photos);
    ensureIds(p);
    p.generatedAt = Date.now();
    await saveMeta();
    return p.photos.length - 1;
}

export async function liveWriteEntry(m, p, kind) {
    need(m);
    const diary = kind === 'diary', list = diary ? (p.diary || []) : p.notes;
    const prompt = [
        await ownerProfileBlock(ctx(),p.financeProfile,p.owner),
        `[OWNER]\n${p.owner}${p.country ? ` (phone set to ${p.country})` : ''}`, `[NOW]\n${liveNowText(m, p)}`, `[WRITE]\n${diary ? 'a diary entry' : 'a note'}`,
        `[RECENT CHAT]\n${liveRecentText(m, p.owner, 12, { maxChars: 9000 })}`,
        `[SO FAR]\n${list.slice(-3).map(x => `- ${x.title ? `${x.title}: ` : ''}${x.text.slice(0, 300)}`).join('\n') || '(none)'}`,
        namesBlock(m),
    ].filter(Boolean).join('\n\n');
    const out = String(await askAI(prompt, { force: true, system: AI_SYS_WRITE, maxTokens: 2500 }) || '').replace(/```(?:json)?/gi, '');
    const a = out.indexOf('{'), b = out.lastIndexOf('}');
    let raw = null;
    try { raw = a >= 0 && b > a ? parseJson(out.slice(a, b + 1)) : null; } catch { raw = null; }
    const text = str(raw?.text, 2000);
    if (!text) throw new Error(`모델 답에서 ${diary ? '일기' : '메모'}를 찾지 못했어요`);
    const now = liveNowText(m, p);
    const x = { title: line(raw?.title, 80), kt: line(raw?.kt, 80), text, ko: str(raw?.ko, 2000) };
    if (diary) { p.diary = [...(p.diary || []), { date: now.slice(0, 5), ...x }].slice(-CAP.diary); }
    else { p.notes.push({ ...x, time: now }); p.notes = p.notes.slice(-CAP.notes); }
    ensureIds(p);
    p.generatedAt = Date.now();
    await saveMeta();
    return (diary ? p.diary : p.notes).length - 1;
}

export async function liveMakeDraft(m, p, i) {
    need(m);
    const t = p.threads[i];
    if (!t) return null;
    const said = x => (x.from === 'me' ? p.owner : x.from);
    const prompt = [
        await ownerProfileBlock(ctx(),p.financeProfile,p.owner),
        `[OWNER]\n${p.owner}`, `[TO]\n${t.with}`,
        `[THREAD]\n${t.messages.filter(x => x.src !== 'guess').slice(-12).map(x => `${said(x)} (${x.time}): ${x.text}`).join('\n')}`,
        `[RECENT CHAT]\n${liveRecentText(m, p.owner, 8, { maxChars: 7000 })}`,
        namesBlock(m),
    ].filter(Boolean).join('\n\n');
    const out = String(await askAI(prompt, { force: true, system: AI_SYS_DRAFT, maxTokens: 1200 }) || '').replace(/```(?:json)?/gi, '');
    const a = out.indexOf('{'), b = out.lastIndexOf('}');
    let raw = null;
    try { raw = a >= 0 && b > a ? parseJson(out.slice(a, b + 1)) : null; } catch { raw = null; }
    const text = str(raw?.text, 600);
    if (!text) throw new Error('모델 답에서 초안을 찾지 못했어요');
    t.draft = { text, ko: ko(raw?.ko), time: liveNowText(m, p), src: 'guess' };
    p.generatedAt = Date.now();
    await saveMeta();
    return t.draft;
}

export async function liveRecordVoice(m, p) {
    need(m);
    const prompt = [
        await ownerProfileBlock(ctx(),p.financeProfile,p.owner),
        `[OWNER]\n${p.owner}${p.country ? ` (phone set to ${p.country})` : ''}`, `[NOW]\n${liveNowText(m, p)}`,
        `[RECENT CHAT]\n${liveRecentText(m, p.owner, 12, { maxChars: 9000 })}`,
        `[SO FAR]\n${(p.voice || []).slice(-3).map(x => `- ${x.title}: ${x.text.slice(0, 200)}`).join('\n') || '(none)'}`,
        namesBlock(m),
    ].filter(Boolean).join('\n\n');
    const out = String(await askAI(prompt, { force: true, system: AI_SYS_VOICE, maxTokens: 2000 }) || '').replace(/```(?:json)?/gi, '');
    const a = out.indexOf('{'), b = out.lastIndexOf('}');
    let raw = null;
    try { raw = a >= 0 && b > a ? parseJson(out.slice(a, b + 1)) : null; } catch { raw = null; }
    const text = str(raw?.text, 2000);
    if (!text) throw new Error('모델 답에서 음성 메모를 찾지 못했어요');
    p.voice = [...(p.voice || []), { title: line(raw?.title, 80), kt: line(raw?.kt, 80), text, ko: str(raw?.ko, 2000), time: liveNowText(m, p), sec: secOf(raw?.sec), place: line(raw?.place, 60), src: 'guess', now: true }].slice(-CAP.voice);
    ensureIds(p);
    p.generatedAt = Date.now();
    await saveMeta();
    return p.voice.length - 1;
}
