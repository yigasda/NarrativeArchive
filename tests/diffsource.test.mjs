import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.document={documentElement:{},addEventListener(){}};globalThis.MutationObserver=class{observe(){}};globalThis.$=()=>({on(){return this}});
const context={chatId:'current',chatMetadata:{},chat:Array.from({length:100},()=>({mes:'message'}))};globalThis.SillyTavern={getContext:()=>context};
await import('../src/phone.js');
const {getMeta}=await import('../src/core.js');
const {renderDiff,lineDiff}=await import('../src/diff.js');
const sections=['## #1–#2 — 첫 장면\nPLOT:\n- 첫 내용','## #3–#4 — 두 번째 장면\nPLOT:\n- 두 번째 내용','## #5–#6 — 세 번째 장면\nPLOT:\n- 세 번째 내용'];
test('consecutive appended sections each have their own source range',()=>{
 getMeta().text='';const html=renderDiff(lineDiff('',sections.join('\n\n')));
 assert.equal((html.match(/class="na_diff_src"/g)||[]).length,3);
 for(const [a,b] of [[1,2],[3,4],[5,6]])assert.match(html,new RegExp(`data-from="${a}" data-to="${b}"`));
});
test('a continuous edit in a single section does not add source links on every line',()=>{
 getMeta().text=sections[0];const html=renderDiff(lineDiff(sections[0],sections[0].replace('첫 내용','수정 내용\n- 추가 내용')));
 assert.equal((html.match(/class="na_diff_src"/g)||[]).length,1);
 assert.match(html,/data-from="1" data-to="2"/);
});
test('source-disabled previews remain source-free',()=>{
 assert.doesNotMatch(renderDiff(lineDiff('',sections.join('\n\n')),2,{src:false}),/na_src_btn/);
});
