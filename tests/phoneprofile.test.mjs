import test from 'node:test';
import assert from 'node:assert/strict';
import {profileChoices,resolvePhoneProfile,ownerProfileBlock} from '../src/phoneprofile.js';
const context=()=>({characters:[{avatar:'one.png',name:'Alex',data:{description:'Owns a business.',personality:'Reserved',scenario:'Lives abroad.'}},{avatar:'two.png',name:'Alex',description:'A different Alex.'}],powerUserSettings:{personas:{'somang.png':'소망'},persona_descriptions:{'somang.png':{description:'Student in Korea.'}},persona_description:'Wrong current persona'},getWorldInfoNames:()=>['Family'],loadWorldInfo:async()=>({entries:{4:{uid:4,comment:'Mara',content:'Mara owns a shipping business.',disable:true},7:{uid:7,comment:'Other',content:'Unrelated secret.'}}})});
test('explicit stable IDs select only the requested profile, even with duplicate names',async()=>{
 const c=context();assert.equal(await resolvePhoneProfile(c,null),null);
 assert.match((await resolvePhoneProfile(c,{type:'character',id:'two.png'})).text,/different Alex/);
 assert.doesNotMatch((await resolvePhoneProfile(c,{type:'character',id:'two.png'})).text,/Owns a business/);
 assert.equal((await resolvePhoneProfile(c,{type:'persona',id:'somang.png'})).text,'Student in Korea.');
 assert.equal(profileChoices(c).characters.length,2);
});
test('explicit lore entry loads in isolation and rereads current source contents',async()=>{
 const c=context(), binding={type:'lore',book:'Family',id:'4'};
 let block=await ownerProfileBlock(c,binding,'Mara');assert.match(block,/shipping business/);assert.doesNotMatch(block,/Unrelated secret/);assert.match(block,/current amounts and later story changes take precedence/);
 c.loadWorldInfo=async()=>({entries:{4:{uid:4,content:'Updated occupation.'}}});block=await ownerProfileBlock(c,binding,'Mara');assert.match(block,/Updated occupation/);assert.doesNotMatch(block,/shipping business/);
});
test('missing or empty sources never fall back to another character or active persona',async()=>{
 const c=context();await assert.rejects(resolvePhoneProfile(c,{type:'character',id:'deleted.png'}));await assert.rejects(resolvePhoneProfile(c,{type:'persona',id:'deleted.png'}));await assert.rejects(resolvePhoneProfile(c,{type:'lore',book:'Family',id:'missing'}));
 c.powerUserSettings.persona_descriptions['somang.png'].description='';await assert.rejects(resolvePhoneProfile(c,{type:'persona',id:'somang.png'}),/비어/);
});

// Exercise the actual delegated UI handlers without requiring SillyTavern's dialog shell.
test('profile navigation preserves saved binding until connect and supports inline lore selection', async()=>{
 const {readFile}=await import('node:fs/promises');
 const src=await readFile(new URL('../src/phone.js',import.meta.url),'utf8');
 const handlers=new Map(), states=new Map(), saved={type:'character',id:'one.png',label:'Alex'};
 const p={owner:'Alex',financeProfile:{...saved}},c=context();let writes=0;
 const chunk=src.slice(src.indexOf('    const profileRedraw ='),src.indexOf("    $root.on('click', '.na_ph_pick"));
 const init=new Function('$root','profileStates','phone','ctx','resolvePhoneProfile','profileEntries','saveMeta',`
 const nameKey=s=>s.toLowerCase();let phoneClosed=false,view='setprofile';const drawPhone=()=>{};
 ${chunk}
 return editProfile;
 `);
 const {profileEntries}=await import('../src/phoneprofile.js');
 const edit=init({on:(event,selector,fn)=>handlers.set(selector,fn)},states,()=>p,()=>c,resolvePhoneProfile,profileEntries,async()=>{writes++});
 const settle=()=>new Promise(r=>setTimeout(r,0));
 const click=async(selector,dataset={})=>{await handlers.get(selector).call({dataset});await settle();};
 edit();await settle();assert.equal(states.get('alex').pane,'about');
 await click('.fp_open');assert.equal(states.get('alex').pane,'source');
 await click('.fp_source',{type:'lore'});await click('.fp_book',{book:'Family'});
 assert.equal(states.get('alex').pane,'source');assert.equal(states.get('alex').books.get('Family').entries.length,2);
 await click('.fp_pick',{type:'lore',book:'Family',id:'4'});assert.match(states.get('alex').resolved.text,/shipping/);
 assert.deepEqual(p.financeProfile,saved);
 await click('.fp_back');assert.deepEqual(states.get('alex').binding,saved);assert.equal(writes,0);
 await click('.fp_open');await click('.fp_source',{type:'lore'});await click('.fp_book',{book:'Family'});
 await click('.fp_pick',{type:'lore',book:'Family',id:'4'});await click('.fp_save');
 assert.deepEqual(p.financeProfile,{type:'lore',book:'Family',id:'4',label:'Family · Mara'});assert.equal(states.get('alex').pane,'about');assert.equal(writes,1);
 await click('.fp_content');assert.equal(states.get('alex').pane,'content');
 await click('.fp_back');await click('.fp_open');await click('.fp_pick',{type:'persona',id:'somang.png'});await click('.fp_save');
 assert.equal(p.financeProfile.id,'somang.png');assert.equal(p.financeProfile.type,'persona');
 await click('.fp_unlink');assert.equal(p.financeProfile,undefined);assert.equal(states.get('alex').pane,'about');
});
