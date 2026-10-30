import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const enc=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const core=enc(`export const ctx=()=>globalThis.storyTest.context;export const getMeta=()=>globalThis.storyTest.meta;export const saveMeta=async()=>{globalThis.storyTest.saves++};`);
const src=await readFile(new URL('../src/phonestory.js',import.meta.url),'utf8');
const story=await import(enc(src.replace("'./core.js'",JSON.stringify(core))));
function setup(){
 const m={text:'Story archive',phones:{oscar:{owner:'Oscar',wealthPlan:{currency:'EUR'}}},finance:{accounts:{a:{amount:42}},prices:{},transfers:{}},lastPhoneOwner:'Oscar',phoneLore:['old'],phoneLoreOff:{old:[1]}};
 const state=globalThis.storyTest={meta:m,saves:0,prompts:0,choice:'keep',confirmed:true};
 state.context={characterId:0,characters:[{avatar:'oscar.png'}],getCurrentChatId:()=>state.chat || 'branch',POPUP_TYPE:{CONFIRM:1},POPUP_RESULT:{AFFIRMATIVE:1},callGenericPopup:async()=>{state.prompts++;return state.confirmed}};
 globalThis.$=()=>({find:()=>({val:()=>state.choice})});
 return {m,state};
}
test('branched phones ask once, keep a detached copy, and preserve the source',async()=>{
 const {m,state}=setup();m.phoneStoryScope='parent';const source=structuredClone(m),oldPhone=m.phones.oscar;
 assert.equal(await story.ensurePhoneStory(m),true);assert.equal(state.prompts,1);assert.notEqual(m.phones.oscar,oldPhone);
 m.phones.oscar.owner='Changed';assert.equal(source.phones.oscar.owner,'Oscar');assert.equal(oldPhone.owner,'Oscar');
 await story.ensurePhoneStory(m);assert.equal(state.prompts,1);
});
test('fresh story clears phones and financial records together, not the archive or source',async()=>{
 const {m,state}=setup();const source=structuredClone(m);m.phoneStoryScope='parent';state.choice='fresh';
 await story.ensurePhoneStory(m);
 assert.deepEqual(m.phones,{});for(const key of ['finance','lastPhoneOwner','phoneLore','phoneLoreOff'])assert.equal(m[key],undefined);
 assert.equal(m.text,'Story archive');assert.equal(source.finance.accounts.a.amount,42);assert.equal(m.phoneStoryScope,story.phoneChatScope(state.context));
});
test('cancel and switching chats during choice leave saved phone data untouched',async()=>{
 const {m,state}=setup();const before=JSON.stringify(m);state.confirmed=false;
 assert.equal(await story.ensurePhoneStory(m),false);assert.equal(JSON.stringify(m),before);assert.equal(state.saves,0);
 state.context.callGenericPopup=async()=>{state.chat='another';return true};
 assert.equal(await story.ensurePhoneStory(m),false);assert.equal(JSON.stringify(m),before);
});
test('empty new chat starts independently without prompting; legacy phones ask once',async()=>{
 const {state}=setup();const m=state.meta={text:'New story'};
 await story.ensurePhoneStory(m);assert.equal(state.prompts,0);assert.equal(m.phones,undefined);
 const legacy={phones:{oscar:{owner:'Oscar'}}};state.meta=legacy;await story.ensurePhoneStory(legacy);await story.ensurePhoneStory(legacy);assert.equal(state.prompts,1);
});
test('selection keys distinguish characters, groups and chats; reset only removes current key',()=>{
 const {m,state}=setup(),key=story.phoneChatScope(state.context);
 assert.notEqual(key,story.phoneChatScope({...state.context,getCurrentChatId:()=> 'other'}));assert.notEqual(key,story.phoneChatScope({...state.context,groupId:'g'}));
 const keys=new Map([[key,'Oscar'],['another','Somang']]);story.clearPhoneSelection(key,{removeItem:k=>keys.delete(k)});assert.deepEqual([...keys],[['another','Somang']]);
});
const chats=await readFile(new URL('../src/chats.js',import.meta.url),'utf8');
const importer=chats.slice(chats.indexOf('export async function importArchive'),chats.indexOf('export async function fetchJson')).replace('export ','');
function importHarness(m,state){
 const factory=new Function('helpers','m','context',`
 const {PHONE_STORY_KEYS,phoneChatScope,choosePhoneStory,resetPhoneStory,adoptPhoneStory,clearPhoneSelection}=helpers;
 const SETTING_KEYS=[...PHONE_STORY_KEYS,'worldOn'];let carryOffer=null;
 const getMeta=()=>m,ctx=()=>context,confirm=async()=>true,esc=s=>s,setEditorDirty=()=>{},commitText=async text=>{m.text=text;return true},toastr={success(){}},headingRanges=()=>[];
 ${importer}
 return importArchive;
 `);return factory(story,m,state.context);
}
test('archive import offers a fresh story without copying phones or finance',async()=>{
 const {m,state}=setup();state.choice='fresh';const source={text:'Imported story',settings:{phones:{other:{owner:'Other'}},finance:{accounts:{foreign:1}},worldOn:true}};
 assert.equal(await importHarness(m,state)(source,'Other story'),true);
 assert.equal(m.text,'Imported story');assert.equal(m.worldOn,true);assert.deepEqual(m.phones,{});assert.equal(m.finance,undefined);assert.ok(source.settings.phones.other);
});
test('archive continuation copies phones and ledger together and never retains unrelated target cash',async()=>{
 const {m,state}=setup();const source={text:'Continuation',settings:{phones:{other:{owner:'Other',wealthPlan:{currency:'USD'}}},finance:{accounts:{foreign:{amount:99}}},lastPhoneOwner:'Other'}};
 await importHarness(m,state)(source,'Other story');assert.equal(m.finance.accounts.foreign.amount,99);assert.equal(m.finance.accounts.a,undefined);assert.notEqual(m.phones,source.settings.phones);assert.equal(m.phoneStoryScope,story.phoneChatScope(state.context));
 delete source.settings.finance;await importHarness(m,state)(source,'Legacy');assert.equal(m.finance,undefined);
});
test('cancelled archive phone choice leaves both archive and phone data intact',async()=>{
 const {m,state}=setup();state.confirmed=false;const before=JSON.stringify(m);
 assert.equal(await importHarness(m,state)({text:'New',settings:{phones:{new:{}}}},'New'),false);assert.equal(JSON.stringify(m),before);
});
