// Per-app source boundaries. Message positions select input; they never prove an event is new.
import {digest} from './phoneupdate.js';
export const GROUPS={msg:'문자·연락처',call:'통화',photo:'사진',note:'메모',search:'검색',cal:'캘린더',sns:'SNS',mail:'메일',diary:'일기',voice:'음성 메모',money:'은행·지갑·쇼핑',invest:'투자'};
export const BASE_GROUPS=['msg','call','photo','note','search','cal','sns','mail','diary'];
export const fieldGroup={threads:'msg',contacts:'msg',calls:'call',photos:'photo',notes:'note',searches:'search',events:'cal',profile:'sns',posts:'sns',mails:'mail',diary:'diary',voice:'voice'};
export const activeGroups=p=>[...BASE_GROUPS,...(p.voice?.length||p.readState?.groups?.voice?['voice']:[]),...(p.money?['money']:[]),...(p.investment?['invest']:[])];
export async function sourceRows(rows){return Promise.all(rows.map(async text=>({index:Number(/^\[#(\d+)/.exec(text)?.[1]),hash:await digest(text),text})));}
export async function captureSource(scope,rows){const entries=await sourceRows(rows),last=entries.at(-1);return {scope,index:last?.index??-1,hash:last?.hash??'',rows:entries};}
export function setBoundary(p,capture,groups,origin='generated'){
    const r=p.readState||={version:1,scope:capture.scope,groups:{},done:{},order:'oldest',limit:12};
    if(r.scope!==capture.scope)throw Error('폰과 채팅의 시작 위치가 달라요');
    for(const group of groups){r.groups[group]={index:capture.index,hash:capture.hash,origin};r.done[group]={};}
}
export function verifyBoundary(r,scope,rows){
    if(!r||r.scope!==scope)return false;
    return Object.values(r.groups).every(b=>b.index<0||rows.some(x=>x.index===b.index&&x.hash===b.hash));
}
export function selectWindow(p,scope,rows){
    const r=p.readState;if(!verifyBoundary(r,scope,rows)||activeGroups(p).some(g=>!r.groups[g]))throw Error('먼저 반영 시작 위치를 선택해 주세요');
    const pending=rows.filter(x=>activeGroups(p).some(g=>x.index>r.groups[g].index&&r.done[g]?.[x.index]!==x.hash));
    const limit=Math.max(1,Math.min(100,Math.floor(Number(r.limit)||12)));
    const selected=r.order==='newest'?pending.slice(-limit):pending.slice(0,limit);
    return {rows:selected,text:selected.map(x=>x.text).join('\n\n'),remaining:pending.length-selected.length};
}
export function markRead(p,rows){for(const g of activeGroups(p)){const done=p.readState.done[g]||={};for(const x of rows)if(x.index>p.readState.groups[g].index)done[x.index]=x.hash;}}
export const afterBoundary=(p,group,index)=>!p.readState?.groups?.[group]||index>p.readState.groups[group].index;
export async function validateCapture(capture,scope,rows){
 if(capture.scope!==scope)throw Error('생성 중 채팅이 바뀌었어요');
 const current=await sourceRows(rows),map=new Map(current.map(x=>[x.index,x.hash]));
 if(capture.rows.some(x=>map.get(x.index)!==x.hash))throw Error('생성에 사용한 대화가 수정됐어요. 다시 시도해 주세요');
}

export function reconnectState(p,scope){
 if(p.readState)(p.readHistory||=[]).push({savedAt:Date.now(),state:structuredClone(p.readState)});
 p.readState={version:1,scope,groups:{},done:{},order:p.readState?.order||'oldest',limit:p.readState?.limit||12};
 return p.readState;
}
export function coveredRows(p,rows){
 return rows.filter(x=>activeGroups(p).every(g=>x.index<=p.readState.groups[g].index||p.readState.done[g]?.[x.index]===x.hash)).map(x=>x.index);
}
