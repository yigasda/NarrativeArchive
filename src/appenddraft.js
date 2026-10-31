// Synchronous, chat-scoped recovery for the uncommitted append editor.
export function appendDraftKey(c) {
    const chat=c.getCurrentChatId?.() || c.chatId;
    if(chat===undefined || chat===null || chat==='') return null;
    const owner=c.groupId!=null && c.groupId!=='' ? ['group',c.groupId] : ['character',c.characters?.[c.characterId]?.avatar || c.characterId || ''];
    return `narrativearchive:append-drafts:${JSON.stringify([...owner,String(chat)])}`;
}
export function appendDraftStore(c,seed,storage=globalThis.localStorage) {
    const key=appendDraftKey(c);
    if(!key) throw new Error('채팅을 확인하지 못했어요');
    const read=()=>{const raw=storage.getItem(key);if(!raw)return [];const rows=JSON.parse(raw);if(!Array.isArray(rows))throw new Error('임시 저장 내용을 읽지 못했어요');return rows;};
    const rows=read(),saved=seed ? rows.findLast(r=>r.seed===seed || r.text===seed) : rows.at(-1);
    const id=saved?.id || globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,initial=saved?.seed ?? seed ?? '';
    let revision=saved?.revision || 0, exists=!!saved;
    return {
        saved,
        save(state) {
            const current=read(),previous=current.find(r=>r.id===id);
            if(exists && (!previous || (previous.revision || 0)!==revision)) throw new Error('다른 창에서 초안이 변경됐어요');
            const record={...state,id,seed:initial,revision:revision+1,at:Date.now(),steps:(state.steps || []).slice(-10),asked:(state.asked || []).slice(-10)};
            const rows=current.filter(r=>r.id!==id);rows.push(record);
            try {storage.setItem(key,JSON.stringify(rows));}
            catch {
                // Keep the latest text even when the undo history exceeds browser quota.
                rows[rows.length-1]={...record,steps:[],asked:[],original:null};
                storage.setItem(key,JSON.stringify(rows));
            }
            revision++;exists=true;
        },
        clear() {const current=read();if((current.find(r=>r.id===id)?.revision || 0)!==revision)return;const rows=current.filter(r=>r.id!==id);if(rows.length)storage.setItem(key,JSON.stringify(rows));else storage.removeItem(key);},
    };
}
