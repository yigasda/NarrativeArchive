// 폰 2 반영(phone2reflect.js)을 화면 · 모델 없이 불러요: 폰 1 반영 파일은 실제 것, 그 이웃(채팅 · 모델 · 저장)은 가짜.
// 모델 답은 T.answers(core) · T.moneyAnswers(money)에 넣어 둔 걸 차례로 돌려줘요. T.ask(input, { system, maxTokens })를
// 넣으면 모든 요청이 그리로 가요(시험 세션의 실제 모델 시험). T.characters: 채팅의 캐릭터 카드([{ name, description }]). 시험과 tests/phone2replay.mjs가 써요.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { cleanMessageURL } from './cleanmessage.mjs';

const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const href = f => pathToFileURL(new URL(`../src/${f}`, import.meta.url).pathname).href;
export const T = (globalThis.__dropTest = { chat: [], answers: [] });
const map = { './extract.js': cleanMessageURL,
    './phonesync.js': href('phonesync.js'), './phoneparse.js': href('phoneparse.js'), './phoneclock.js': href('phoneclock.js'), './phonemapcity.js': href('phonemapcity.js'), './placehoods.js': href('placehoods.js'), './phonesynclife.js': href('phonesynclife.js'), './phonesyncmoney.js': href('phonesyncmoney.js'), './finance.js': href('finance.js'),
    './phoneprofile.js': href('phoneprofile.js'), './phone2store.js': href('phone2store.js'), './phone2clock.js': href('phone2clock.js'), './phone2feed.js': href('phone2feed.js'),
    './phonestory.js': encoded(`export const phoneTarget=()=>({scope:phoneChatScope(),check(){}});export const phoneChatScope=()=>'test';`),
    './wealth.js': encoded(`export const ensureWealth=async()=>null;export const wealthBlock=()=>'';export const wealthDate=()=> '2026-10-26';export const wealthCheck=()=>null;export const addWealthFX=()=>{};`),
    './ai.js': encoded(`export const SECTION_GUARD=/^#{1,3} /m;export const stripThink=t=>String(t??'').replace(/<(think|thinking|reasoning|scenes)[^>]*>[\\s\\S]*?<\\/\\1>/gi,'').trim();export const askCompress=(p,o={})=>{(globalThis.__dropTest.compress||=[]).push({system:o.system||'',guard:!!o.guard});return askDraft(p,{system:o.system||''});};export const askDraft=async(input,o)=>{const T=globalThis.__dropTest;if(typeof T.ask==='function')return T.ask(input,o);if(String(o.system).startsWith('STAGE: money')){T.moneyInput=input;T.moneySys=o.system;const a=(T.moneyAnswers||[]).shift();return typeof a==='string'?a:JSON.stringify(a||{records:[]});}if(o.system==='FOLD SYS'){T.foldInput=input;T.foldCalls=(T.foldCalls||0)+1;const a=(T.folds||[]).shift();if(a instanceof Error)throw a;return a===undefined?'':String(a);}if(String(input).includes('DIGEST RULES')){T.digestInput=input;T.digestCalls=(T.digestCalls||0)+1;const a=(T.digests||[]).shift();if(a instanceof Error)throw a;return a===undefined?'':String(a);}if(String(o.system).includes('"reply"')&&!String(o.system).startsWith('STAGE')&&T.replies){T.replySys=o.system;T.replyInput=input;T.replyCalls=(T.replyCalls||0)+1;const a=T.replies.shift();if(a instanceof Error)throw a;return typeof a==='string'?a:JSON.stringify(a);}T.sys=o.system;T.input=input;T.calls=(T.calls||0)+1;await T.beforeCore?.();const a=T.answers.shift();return typeof a==='string'?a:JSON.stringify(a);};`),
    './core.js': encoded(`export const ctx=()=>({chat:globalThis.__dropTest.chat,chatMetadata:{},loadWorldInfo:async()=>null,characters:globalThis.__dropTest.characters||[],characterId:0});export const globalSettings=()=>({});export const saveMeta=async()=>{globalThis.__dropTest.saves=(globalThis.__dropTest.saves||0)+1;};`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=()=>[];export const chatRows=()=>{throw new Error('폰 2 반영은 채팅을 안 읽어요');};`),
    './inject.js': encoded(`export const applyInjection=()=>{};`),
    './knowledge.js': encoded(`export const knowledgeRows=()=>[];`),
    './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=()=>[];`),
    './sections.js': encoded(`export const parseSections=()=>[];export const RANGE_HEAD=/#(\\d+)–#(\\d+)/;export const sectionKey=()=>'';export const splitTail=s=>[s,''];`),
    './translate.js': encoded(`export const glossaryEntries=()=>[];export const glossaryPeople=()=>[];`), './world.js': encoded(`export const worldText=()=>'';`),
};
const swap = s => s.replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || k}'`);
map['./phonedata.js'] = encoded(swap(await readFile(new URL('../src/phonedata.js', import.meta.url), 'utf8')));
map['./phone2reflect.js'] = encoded(swap(await readFile(new URL('../src/phone2reflect.js', import.meta.url), 'utf8')));
export const R = await import(map['./phone2reflect.js']);
// 답장 돌리기(phone2go.js)도 같은 가짜 이웃으로: 답장 답은 T.replies에 넣어 둔 걸 차례로
for (const f of ['phone2story.js', 'phone2live.js', 'phone2ask.js', 'phone2reply.js', 'phone2run.js', 'phone2digest.js']) map[`./${f}`] = href(f);
// (the archive's short instruction: its four places, as the real one has them; tests/phone2digest.test.mjs checks the real one)
map['./digest.js'] = encoded(`export const AI_SYS_DIGEST='FOLD SYS';`);
map['./prompts.js'] = encoded(`export const SHORT_PROMPT='<raw_log range="#{{from}}–#{{to}}">\\n{{raw}}\\n</raw_log>\\n\\n<current_state>\\n{{state}}\\n</current_state>\\n\\nDIGEST RULES #{{from}}–#{{to}}';export const fillPrompt=(t,v)=>{let o=t;for(const [k,x] of Object.entries(v))o=o.split('{{'+k+'}}').join(x);return o;};export const langBlock=()=>'\\n\\n[ANSWER LANGUAGE — test]';`);
map['./phone2story.js'] = encoded(`export const liveStoryText=()=>globalThis.__dropTest.story||'';`);
export const G = await import(encoded(swap(await readFile(new URL('../src/phone2go.js', import.meta.url), 'utf8'))));
const store = new Map();
globalThis.localStorage ||= { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };

