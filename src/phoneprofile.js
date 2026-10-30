// Explicit per-phone profile bindings. Never infer a match from a character's name.
export function profileChoices(c) {
    return {
        characters: (c.characters || []).filter(x=>x?.avatar).map(x=>({id:x.avatar,label:x.name || x.data?.name || x.avatar})),
        personas: Object.entries(c.powerUserSettings?.personas || {}).map(([id,label])=>({id,label:String(label || id)})),
        books: c.getWorldInfoNames?.() || [],
    };
}
export async function profileEntries(c, book) {
    const data = await c.loadWorldInfo(book);
    if (!data?.entries) throw new Error('로어북을 찾을 수 없어요');
    return Object.entries(data.entries).filter(([,e])=>String(e?.content || '').trim()).map(([key,e])=>({id:String(e.uid ?? key),label:String(e.comment || (e.key || []).join(', ') || `항목 ${e.uid ?? key}`),text:String(e.content)}));
}
export async function resolvePhoneProfile(c, binding) {
    if (!binding || binding.type === 'none') return null;
    let label='', body='';
    if (binding.type === 'character') {
        const ch=(c.characters || []).find(x=>x.avatar === binding.id);
        if(!ch) throw new Error('연결한 캐릭터 카드를 찾을 수 없어요');
        label=ch.name || ch.data?.name || binding.id;
        body=['description','personality','scenario'].map(k=>{const v=ch.data?.[k] ?? ch[k];return v ? `[${k}]\n${v}` : '';}).filter(Boolean).join('\n\n');
    } else if (binding.type === 'persona') {
        const settings=c.powerUserSettings;
        if (!Object.hasOwn(settings?.personas || {},binding.id)) throw new Error('연결한 페르소나를 찾을 수 없어요');
        label=settings.personas[binding.id] || binding.id;
        body=String(settings.persona_descriptions?.[binding.id]?.description || '');
    } else if (binding.type === 'lore') {
        const e=(await profileEntries(c,binding.book)).find(x=>x.id === String(binding.id));
        if(!e) throw new Error('연결한 로어북 항목을 찾을 수 없어요');
        label=`${binding.book} · ${e.label}`;body=e.text;
    } else throw new Error('프로필 출처를 다시 선택해 주세요');
    if (!body.trim()) throw new Error('선택한 프로필 내용이 비어 있어요');
    return {label:String(label),text:body};
}
// Keep financeProfile as the saved binding key for backward compatibility.
export async function ownerProfileBlock(c,binding,owner) {
    const profile=await resolvePhoneProfile(c,binding);
    return profile ? `[OWNER PROFILE — explicitly selected by the user for ${owner}]\n${profile.label}\n${profile.text}\n[PROFILE USE]\nUse this as background for this owner's personality, voice, relationships, interests, occupation, personal resources and lifestyle. Do not invent past events from background traits. Explicit current amounts and later story changes take precedence over background. Company and family assets are not personal cash. Do not turn profile secrets into another character's knowledge.` : '';
}

// Empty arrays are valid generated app data; absent fields are not generated.
export function phoneDataInfo(p) {
    const apps=[['메시지','threads'],['전화','calls'],['연락처','contacts'],['사진','photos'],['메모','notes'],['검색','searches'],['캘린더','events'],['SNS','posts'],['메일','mails'],['일기','diary'],['음성 메모','voice']].map(([label,key])=>({label,ready:Array.isArray(p[key])}));
    apps.push({label:'은행',ready:!!p.money?.bank},{label:'지갑',ready:Array.isArray(p.money?.cards) || Array.isArray(p.money?.passes)},{label:'쇼핑',ready:Array.isArray(p.money?.orders)},{label:'투자',ready:!!p.investment});
    const timestamps=[p.at,p.generatedAt,p.money?.at,p.voiceAt,p.investment?.at].filter(t=>typeof t==='number' && Number.isFinite(t) && t>0);
    return {apps,count:apps.filter(x=>x.ready).length,last:timestamps.length?Math.max(...timestamps):null};
}
