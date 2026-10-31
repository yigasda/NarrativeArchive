// Pure input selection and evidence validation. Archive bounds are supplied by the existing section parser.
export function archiveWindow(sections,selected,allRows,{covered=[],done={},after=-1,lastChatIndex=allRows.at(-1)?.index??-1}={}){
 const picked=new Set([...selected.map(x=>x.index),...covered]),max=lastChatIndex;
 const evidence=sections.filter(x=>{
  const rows=allRows.filter(r=>r.index>=x.first&&r.index<=x.last&&r.index>after);
  return x.last>after&&x.last<=max&&(!Object.hasOwn(done,x.id)||done[x.id]!==x.hash)&&rows.length>0&&rows.every(r=>picked.has(r.index));
 }).map(x=>({...x,boundaryIndex:after,eligibleIndices:allRows.filter(r=>r.index>=x.first&&r.index<=x.last&&r.index>after).map(r=>r.index)}));
 const first=selected[0]?.index??(evidence.length?Math.min(...evidence.map(x=>x.first)):-1);
 return {background:sections.filter(x=>x.last<first&&!evidence.some(e=>e.id===x.id)),evidence};
}
export function decisionEvidence(e,context,indices){
 if(!indices.includes(e.sourceIndex))throw Error('선택한 본문 밖의 사건이에요');
 if(e.sourceType!=='archive'&&context.selectedChatIndices&&!context.selectedChatIndices.includes(e.sourceIndex))throw Error('선택한 원문 밖의 사건이에요');
 const record=e.sourceType==='archive'?context.archive?.find(x=>x.id===e.sourceId):context.rows.find(x=>x.index===e.sourceIndex);
 if(!record||e.sourceType==='archive'&&(e.sourceIndex<record.first||e.sourceIndex>record.last||record.eligibleIndices&&!record.eligibleIndices.includes(e.sourceIndex)))throw Error('사건의 출처를 확인하지 못했어요');
 if(!Array.isArray(e.refs)||!e.refs.length||e.refs.some(ref=>typeof ref!=='string'||!ref.trim()||typeof record.text==='string'&&!record.text.includes(ref)))throw Error('사건 근거와 출처가 맞지 않아요');
 return {type:e.sourceType==='archive'?'archive':'chat',id:e.sourceType==='archive'?e.sourceId:e.sourceIndex,hash:record.hash};
}
export function evidenceUnchanged(job,context){
 if(job.scope!==context.scope)return false;
 if(job.reviewOnly)return (job.sourceHashes||[]).every(([index,hash])=>context.rows.find(x=>x.index===index)?.hash===hash)&&(job.archiveHashes||[]).every(([id,hash])=>context.archive?.find(x=>x.id===id)?.hash===hash);
 const e=job.evidence||{type:'chat',id:job.e.sourceIndex,hash:job.sourceHash};
 const record=e.type==='archive'?context.archive?.find(x=>x.id===e.id):context.rows.find(x=>x.index===e.id);
 return !!e.hash&&record?.hash===e.hash;
}

export function inputLimitError(error){
 const message=String(error?.message||error);
 if(/context[_ ](?:length|window)|maximum context|prompt.{0,30}too long|input.{0,30}(?:too long|token limit)|too many (?:input )?tokens|exceed.{0,40}(?:context|token)|컨텍스트.{0,20}(?:초과|한도)|입력.{0,20}(?:초과|한도)/i.test(message)){
  const result=new Error('대화가 너무 길어요. 한 번에 읽을 개수를 줄여 주세요');result.code='PHONE_INPUT_LIMIT';result.cause=error;return result;
 }
 return error;
}
