// 폰 2(실시간)의 앱 채우기. phonedata.js 등의 채우기 함수를 줄 그대로 옮긴 것이고, 다른 곳은 요청을 만드는
// 뼈대뿐이에요(sideRequest → liveSideRequest: 롤플은 시작한 곳까지만, 최근 대화는 메신저 것. phone2req.js).
// 폰 1 파일은 여기서 읽기만 해요.
import { ensureWealth } from './wealth.js';
import { saveMeta } from './core.js';
import { nameKey } from './people.js';
import { askDraft, AI_SYS_DEVICE, readDeviceReply, homeCountry } from './phonedata.js';
import { liveSideRequest, needLive } from './phone2req.js';

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
