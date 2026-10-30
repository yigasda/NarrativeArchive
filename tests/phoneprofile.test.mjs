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
