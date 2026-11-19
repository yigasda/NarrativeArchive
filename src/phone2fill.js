// 폰 2(실시간)의 앱 채우기. phonedata.js 등의 채우기 함수를 줄 그대로 옮긴 것이고, 다른 곳은 요청을 만드는
// 뼈대뿐이에요(sideRequest → liveSideRequest: 롤플은 시작한 곳까지만, 최근 대화는 메신저 것. phone2req.js).
// 폰 1 파일은 여기서 읽기만 해요.
import { ensureWealth } from './wealth.js';
import { saveMeta } from './core.js';
import { nameKey } from './people.js';
import { askDraft, AI_SYS_DEVICE, AI_SYS_VOICES, readDeviceReply, homeCountry, aroundBlock, CHAT_TOKENS, CAP, arr, jsonOf, line, str, when, secOf, fresh, byStory, ensureIds } from './phonedata.js';
import { liveSideRequest, liveFillClock, needLive } from './phone2req.js';

// 자산 · 환율 계획 (은행 · 투자를 채우기 전에)
export const livePrepareWealth = (m,p,refresh=false) => ensureWealth(needLive(m),p,()=>liveSideRequest(m,p.owner,[`[OWNER COUNTRY]\n${homeCountry(p)}`,`[ACCOUNT CURRENCIES]\n${JSON.stringify((p.money?.bank?.accounts || []).map(a=>a.currency))}`],{profile:p.financeProfile,money:true}),{refresh});

// 기기 정보 (설정 앱)
const deviceRequests = new WeakMap();
export async function liveFillDevice(m,p) {
    needLive(m);
    if(p.device) return p.device;
    if(deviceRequests.has(p)) return deviceRequests.get(p);
    const request=(async()=>{
        const binding=JSON.stringify(p.financeProfile);
        const input=await liveSideRequest(m,p.owner,[`[COUNTRY]\n${p.country || ''}`],{profile:p.financeProfile});
        const out=await askDraft(input,{force:true,system:AI_SYS_DEVICE,maxTokens:4000,effort:'low'});
        const device=readDeviceReply(out);
        if(!device) throw new Error('모델 답에서 기기 정보(JSON)를 찾지 못했어요');
        if(JSON.stringify(p.financeProfile)!==binding) throw new Error('인물 정보가 변경됐어요. 다시 불러와 주세요');
        if(m.phones && m.phones[nameKey(p.owner)]!==p) return null;
        if(!p.device) {p.device=device;await saveMeta();}
        return p.device;
    })();
    deviceRequests.set(p,request);
    try {return await request;} finally {deviceRequests.delete(p);}
}

// 음성 메모 채우기
export async function liveFillVoice(m, p) {
    needLive(m);
    const diary = (p.diary || []).slice(-6).map(d => `- ${d.date} ${d.title}`).join('\n');
    const out = await askDraft(await liveSideRequest(m, p.owner, [`[DIARY]\n${diary || '(none)'}`, liveFillClock(m, p, p.now, { story: true }), aroundBlock(p)], {story:CHAT_TOKENS.apps,profile:p.financeProfile}), { force: true, system: AI_SYS_VOICES, maxTokens: 16000 });
    const memos = arr(jsonOf(out, { salvage: 'whole' })?.memos).map(x => ({ title: line(x?.title, 80), kt: line(x?.kt, 80), text: str(x?.text, 2000), ko: str(x?.ko, 2000), time: when(x?.time), sec: secOf(x?.sec), place: line(x?.place, 60), src: 'guess' })).filter(x => x.text);
    if (!memos.length) throw new Error('모델 답에서 음성 메모를 찾지 못했어요');
    // (one the story already put there, the same title at the same time, isn't written twice)
    const keptVoice = (p.voice || []).filter(x => x.src === 'story' || x.now);
    p.voice = [...keptVoice, ...fresh('voice', keptVoice, memos)].sort(byStory(p.now)).slice(-CAP.voice);
    p.voiceAt = Date.now();
    ensureIds(p);
    await saveMeta();
    return p.voice;
}
