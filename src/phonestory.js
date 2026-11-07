// Phone content and its financial ledger travel together, only by explicit choice.
import { ctx, getMeta, saveMeta } from './core.js';

export const PHONE_STORY_KEYS = ['phones','phoneProfiles','phoneScreenHolder','finance','lastPhoneOwner','phoneLore','phoneLoreOff','phonePre','phoneStoryScope'];
export function phoneChatScope(c) {
    const chat=c.getCurrentChatId?.() || c.chatId;
    if(chat===undefined || chat===null || chat==='') return null;
    const scope=c.groupId!=null && c.groupId!=='' ? ['group',c.groupId] : ['character',c.characters?.[c.characterId]?.avatar || (c.characterId ?? '')];
    return `narrativearchive:phone-owner:${JSON.stringify([...scope,String(chat)])}`;
}
// Capture the actual loaded room, not the provenance inherited from a branch.
// Re-check after a confirmation/save: a dialog can outlive its chat.
export function phoneTarget(m, p) {
    const c = ctx(), metadata = c.chatMetadata, scope = phoneChatScope(c), integrity = metadata?.integrity;
    const valid = () => {
        const current = ctx();
        return !!scope && phoneChatScope(current) === scope && current.chatMetadata === metadata
            && current.chatMetadata?.integrity === integrity && getMeta() === m
            && (!m.phoneStoryScope || m.phoneStoryScope === scope)
            && Object.values(m.phones || {}).includes(p);
    };
    const check = () => { if (!valid()) throw new Error('채팅이나 폰이 바뀌었어요. 현재 방에서 폰을 다시 열어 주세요'); };
    check();
    return { scope, check };
}
export function clearPhoneSelection(scope,storage) {
    try { if(scope) (storage || globalThis.localStorage)?.removeItem(scope); } catch { /* Metadata still works without browser storage. */ }
}
export function resetPhoneStory(m,scope) {
    m.phones={};delete m.phoneProfiles;delete m.finance;delete m.lastPhoneOwner;
    delete m.phoneLore;delete m.phoneLoreOff;delete m.phoneScreenHolder;
    // (what was read before a phone was made goes with the phones)
    delete m.phonePre;
    m.phoneStoryScope=scope;
    clearPhoneSelection(scope);
}
export function adoptPhoneStory(m,scope) {
    // Detach copied metadata from its source even if the host supplied shared objects.
    for(const k of PHONE_STORY_KEYS) if(k!=='phoneStoryScope' && Object.hasOwn(m,k)) m[k]=structuredClone(m[k]);
    m.phoneStoryScope=scope;
}
// two tiles answering one question (같은 이야기인가요?): keep the phone, or start this room's phone records afresh
const SC_SV=d=>`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const SC_KEEP='<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M9.5 9.5h5M9.5 12.5h5M9.5 15.5h3"/>';
const SC_NEW='<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>';
const SC_CHK='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
export function phoneStoryChoiceHtml(importing=false,hasSource=true) {
    const bring=importing&&hasSource;
    const tile=(v,on,ic,cls,name,sub)=>`<label class="na_sc_tile"><input type="radio" name="na_phone_story" value="${v}"${on?' checked':''}><span class="na_sc_rd">${SC_CHK}</span><span class="na_sc_ic ${cls}">${SC_SV(ic)}</span><b>${name}</b><small>${sub}</small></label>`;
    return `<div class="na_popup na_v2 na_confirm na_sc"><div class="na_v2_title"><b>${importing?'아카이브와 휴대폰':'이 이야기의 휴대폰'}</b></div>
      <div class="na_confirm_text">${bring?'휴대폰도 함께 가져올까요?':'같은 이야기인가요?'}</div>
      <div class="na_sc_tiles">${tile('keep',true,SC_KEEP,'keep',bring?'네, 가져오기':'네, 이어서','폰 기록 그대로')}${tile('fresh',false,SC_NEW,'new','아니요, 새 이야기','폰 기록 비우기')}</div>
      <div class="na_sc_note">원래 방은 바뀌지 않아요</div></div>`;
}
export async function choosePhoneStory({importing=false,hasSource=true}={}) {
    const c=ctx(),$body=$(phoneStoryChoiceHtml(importing,hasSource));
    const r=await c.callGenericPopup($body,c.POPUP_TYPE.CONFIRM,'',{okButton:'적용',cancelButton:'취소'});
    if(r!==true && r!==c.POPUP_RESULT.AFFIRMATIVE) return null;
    return $body.find('input:checked').val()==='fresh'?'fresh':'keep';
}
export async function ensurePhoneStory(m) {
    const scope=phoneChatScope(ctx());
    if(!scope || m.phoneStoryScope===scope) return true;
    // Older saves have no provenance: ask once rather than guess or erase them.
    if(Object.keys(m.phones || {}).length || Object.keys(m.phoneProfiles || {}).length || m.finance) {
        const choice=await choosePhoneStory();
        if(!choice || getMeta()!==m || phoneChatScope(ctx())!==scope) return false;
        if(choice==='fresh') resetPhoneStory(m,scope);else adoptPhoneStory(m,scope);
    } else m.phoneStoryScope=scope;
    await saveMeta();return true;
}
