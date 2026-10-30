// Phone content and its financial ledger travel together, only by explicit choice.
import { ctx, getMeta, saveMeta } from './core.js';

export const PHONE_STORY_KEYS = ['phones','finance','lastPhoneOwner','phoneLore','phoneLoreOff','phoneStoryScope'];
export function phoneChatScope(c) {
    const chat=c.getCurrentChatId?.() || c.chatId;
    if(chat===undefined || chat===null || chat==='') return null;
    const scope=c.groupId!=null && c.groupId!=='' ? ['group',c.groupId] : ['character',c.characters?.[c.characterId]?.avatar || (c.characterId ?? '')];
    return `narrativearchive:phone-owner:${JSON.stringify([...scope,String(chat)])}`;
}
export function clearPhoneSelection(scope,storage) {
    try { if(scope) (storage || globalThis.localStorage)?.removeItem(scope); } catch { /* Metadata still works without browser storage. */ }
}
export function resetPhoneStory(m,scope) {
    m.phones={};delete m.finance;delete m.lastPhoneOwner;
    delete m.phoneLore;delete m.phoneLoreOff;
    m.phoneStoryScope=scope;
    clearPhoneSelection(scope);
}
export function adoptPhoneStory(m,scope) {
    // Detach copied metadata from its source even if the host supplied shared objects.
    for(const k of PHONE_STORY_KEYS) if(k!=='phoneStoryScope' && Object.hasOwn(m,k)) m[k]=structuredClone(m[k]);
    m.phoneStoryScope=scope;
}
export function phoneStoryChoiceHtml(importing=false,hasSource=true) {
    return `<div class="na_popup na_v2 na_confirm"><div class="na_v2_title"><b>${importing?'아카이브와 휴대폰':'이 이야기의 휴대폰'}</b></div>
      <div class="na_confirm_text">같은 이야기를 이어가면 기존 폰을 사용하고, 다른 이야기라면 새로 시작하세요. 새로 시작하면 이 방의 모든 인물의 폰과 금융 데이터가 초기화됩니다. 원래 방은 바뀌지 않아요.</div>
      <label><input type="radio" name="na_phone_story" value="keep" checked> ${importing&&hasSource?'휴대폰도 함께 가져오기':'기존 폰 이어받기'}</label><br>
      <label><input type="radio" name="na_phone_story" value="fresh"> 새 이야기로 시작</label></div>`;
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
    if(Object.keys(m.phones || {}).length || m.finance) {
        const choice=await choosePhoneStory();
        if(!choice || getMeta()!==m || phoneChatScope(ctx())!==scope) return false;
        if(choice==='fresh') resetPhoneStory(m,scope);else adoptPhoneStory(m,scope);
    } else m.phoneStoryScope=scope;
    await saveMeta();return true;
}
