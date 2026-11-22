// 폰 2 반영(phone2reflect.js)을 화면 · 모델 없이 불러요: 폰 1 반영 파일은 실제 것, 그 이웃(채팅 · 모델 · 저장)은 가짜.
// 모델 답은 T.answers(core) · T.moneyAnswers(money)에 넣어 둔 걸 차례로 돌려줘요. T.ask(input, { system, maxTokens })를
// 넣으면 모든 요청이 그리로 가요(시험 세션의 실제 모델 시험). T.characters: 채팅의 캐릭터 카드([{ name, description }]). 시험과 tests/phone2replay.mjs가 써요.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { cleanMessageURL } from './cleanmessage.mjs';

// (the archive's scene request and its answer reader, as they are in scenes.js: the file itself needs the screen)
const scenesFile = await readFile(new URL('../src/scenes.js', import.meta.url), 'utf8');
const cutOut = (from, to) => { const a = scenesFile.indexOf(from), b = scenesFile.indexOf(to, a); if (a < 0 || b < 0) throw new Error(`scenes.js: ${from}`); return scenesFile.slice(a, b + to.length); };
const SCENES_SRC = `${cutOut('export const SCENES_SYS = `', '`;')}\n${cutOut('export function parseScenes(', '\n}\n')}`;
const encoded = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const href = f => pathToFileURL(new URL(`../src/${f}`, import.meta.url).pathname).href;
export const T = (globalThis.__dropTest = { chat: [], answers: [] });
// 이야기에서 시작한 실시간 폰의 요약본 (시험용): 이야기 글 · 시작 직전 메시지
export const snapOf = (upto, text = '', recent = []) => ({ v: 1, at: 0, upto, text, recent, made: { from: 0, to: upto, count: 0, parts: 0 } });
// (그 채팅의 것으로: 이야기 글은 채팅의 아카이브 글, 시작 직전 메시지는 T.recent에서 시작한 곳까지)
export const snapFor = (real, upto) => snapOf(upto, String(real?.text || ''), (T.recent || []).filter(t => !(Number(/^\[#(\d+)/.exec(t)?.[1]) > upto)));
const map = { './extract.js': cleanMessageURL,
    './phonesync.js': href('phonesync.js'), './phoneparse.js': href('phoneparse.js'), './phoneclock.js': href('phoneclock.js'), './phonemapcity.js': href('phonemapcity.js'), './placehoods.js': href('placehoods.js'), './phonesynclife.js': href('phonesynclife.js'), './phonesyncmoney.js': href('phonesyncmoney.js'), './finance.js': href('finance.js'),
    './phoneprofile.js': href('phoneprofile.js'), './phone2store.js': href('phone2store.js'), './phone2clock.js': href('phone2clock.js'), './phone2feed.js': href('phone2feed.js'), './phone2room.js': href('phone2room.js'), './phone2sched.js': href('phone2sched.js'),
    './phonestory.js': encoded(`export const phoneTarget=()=>({scope:phoneChatScope(),check(){}});export const phoneChatScope=()=>'test';`),
    './wealth.js': encoded(`export const ensureWealth=async()=>null;export const wealthBlock=()=>'';export const wealthDate=()=> '2026-10-26';export const wealthCheck=()=>null;export const addWealthFX=()=>{};`),
    './ai.js': encoded(`export const aiProfiles=()=>globalThis.__dropTest.profiles||[];export const OWN_MODES=['custom','vertex','source'];export const apiFormat=t=>t.fmt==='anthropic'?'anthropic':'openai';export const stSourceList=()=>globalThis.__dropTest.sources||[{id:'openrouter',name:'OpenRouter'},{id:'claude',name:'Claude'}];export const stSourceName=id=>stSourceList().find(x=>x.id===id)?.name||String(id||'');export const stSourceModels=async s=>[{id:s+'-a',name:s+' A'}];export const connSettings=w=>(globalThis.__dropTest.slots||{})[w]||{mode:'custom',fmt:'',model:w==='dr'?'draft-model':'ai-model'};export const callConn=async(t,system,prompt,max,effort,force,keep,signal,temp,topP,meta)=>{(globalThis.__dropTest.conn||=[]).push({t,system,prompt});if(meta)Object.assign(meta,{raw:'',model:t.model||t.vxModel,provider:'stub'});const a=(globalThis.__dropTest.replies||[]).shift();return typeof a==='string'?a:JSON.stringify(a||{reply:[]});};export const SECTION_GUARD=/^#{1,3} /m;export const isBlocked=e=>!!(e&&e.refused);export const stripThink=t=>String(t??'').replace(/<(think|thinking|reasoning|scenes)[^>]*>[\\s\\S]*?<\\/\\1>/gi,'').trim();export const askAI=async(p,o={})=>{const T=globalThis.__dropTest;if(String(o.system||'').startsWith('GOAL\\nFind where the story turns')){T.sceneInput=p;T.sceneSys=o.system;T.sceneCalls=(T.sceneCalls||0)+1;const a=(T.scenes||[]).shift();if(a instanceof Error)throw a;return a===undefined?'':String(a);}return askDraft(p,o);};export const askCompress=(p,o={})=>{(globalThis.__dropTest.compress||=[]).push({system:o.system||'',guard:!!o.guard});return askDraft(p,{system:o.system||''});};export const askDraft=async(input,o)=>{const T=globalThis.__dropTest;if(typeof T.ask==='function')return T.ask(input,o);if(String(o.system).startsWith('STAGE: money')){T.moneyInput=input;T.moneySys=o.system;const a=(T.moneyAnswers||[]).shift();return typeof a==='string'?a:JSON.stringify(a||{records:[]});}if(o.system==='FOLD SYS'){T.foldInput=input;T.foldCalls=(T.foldCalls||0)+1;const a=(T.folds||[]).shift();if(a instanceof Error)throw a;return a===undefined?'':String(a);}if(String(input).includes('<raw_log range=')||String(o.system||'').includes('long-term memory (the archive)')){T.digestInput=input;T.digestSys=o.system||'';T.digestCalls=(T.digestCalls||0)+1;const a=(T.digests||[]).shift();if(a instanceof Error)throw a;return a===undefined?'':String(a);}if(String(o.system).includes('"reply"')&&!String(o.system).startsWith('STAGE')&&T.replies){T.replySys=o.system;T.replyInput=input;T.replyCalls=(T.replyCalls||0)+1;const a=T.replies.shift();if(a instanceof Error)throw a;return typeof a==='string'?a:JSON.stringify(a);}T.sys=o.system;T.input=input;T.calls=(T.calls||0)+1;await T.beforeCore?.();const a=T.answers.shift();return typeof a==='string'?a:JSON.stringify(a);};`),
    './core.js': encoded(`export const MODULE='narrative_archive';export const ctx=()=>({chat:globalThis.__dropTest.chat,chatMetadata:globalThis.__dropTest.metadata,loadWorldInfo:async()=>null,characters:globalThis.__dropTest.characters||[],characterId:0,...(globalThis.__dropTest.st||{})});export const globalSettings=()=>globalThis.__dropTest.settings||{};export const newId=()=>'id';export const saveGlobal=()=>{};export const saveMeta=async()=>{const T=globalThis.__dropTest;T.saves=(T.saves||0)+1;if(T.saveHold)await T.saveHold;if(T.saveFail){const e=T.saveFail;T.saveFail=null;throw e;}};`),
    './calendar.js': encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
    './drift.js': encoded(`export const recentForCheck=()=>globalThis.__dropTest.recent||[];export const chatRows=()=>{if(globalThis.__dropTest.rows)return globalThis.__dropTest.rows;throw new Error('폰 2 반영은 채팅을 안 읽어요');};`),
    './inject.js': encoded(`export const applyInjection=()=>{};`),
    './knowledge.js': encoded(`export const knowledgeRows=()=>[];`),
    './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
    './recall.js': encoded(`export const estTok=s=>s.length/4;`), './scenes.js': encoded(`export const recentTrackers=()=>[];\n${SCENES_SRC}`),
    './sections.js': encoded(`export const parseSections=()=>[];export const RANGE_HEAD=/#(\\d+)–#(\\d+)/;export const sectionKey=()=>'';export const splitTail=s=>[s,''];export const lastRangedSection=()=>null;`),
    './util.js': encoded(`export const confirm=async()=>true;export const esc=s=>String(s);`),
    './translate.js': encoded(`export const glossaryEntries=m=>globalThis.__dropTest.gloss||[];export const glossaryPeople=()=>[];export const glossaryIn=(es,t)=>es.filter(e=>String(t).toLowerCase().includes(e.src.toLowerCase()));export const askTranslator=async(p,o={})=>{const T=globalThis.__dropTest;T.trCalls=(T.trCalls||0)+1;T.trInput=p;T.trSys=o.system;T.trMax=o.maxTokens;const a=(T.tr||[]).shift();if(a instanceof Error)throw a;return typeof a==='string'?a:JSON.stringify(a??{});};`), './world.js': encoded(`export const worldText=()=>'';`),
};
const swap = s => s.replace(/from '([^']+)'/g, (all, k) => `from '${map[k] || k}'`);
map['./phonedata.js'] = encoded(swap(await readFile(new URL('../src/phonedata.js', import.meta.url), 'utf8')));
map['./phone2reflect.js'] = encoded(swap(await readFile(new URL('../src/phone2reflect.js', import.meta.url), 'utf8')));
export const PD = await import(map['./phonedata.js']);
export const R = await import(map['./phone2reflect.js']);
// 답장 돌리기(phone2go.js)도 같은 가짜 이웃으로: 답장 답은 T.replies에 넣어 둔 걸 차례로
for (const f of ['phone2story.js', 'phone2live.js', 'phone2ask.js', 'phone2reply.js', 'phone2run.js', 'phone2digest.js', 'phone2back.js', 'phone2import.js', 'phone2edit.js', 'phone2react.js', 'phone2room.js', 'phone2merged.js', 'phone2attach.js']) map[`./${f}`] = href(f);
// (the phone's translator file: its instruction and its voice-table readers, as they are in phonetr.js — the file itself
// needs the translator's settings and the screen)
const trFile = await readFile(new URL('../src/phonetr.js', import.meta.url), 'utf8');
const trCut = (from, to) => { const a = trFile.indexOf(from), b = trFile.indexOf(to, a); if (a < 0 || b < 0) throw new Error(`phonetr.js: ${from}`); return trFile.slice(a, b + to.length); };
map['./phonetr.js'] = encoded(`${trCut('export const AI_SYS_PHONE_KO = `', '`;')}\n${trCut('export const who = ', '\n')}${trCut('export const voiceRows = ', '\n')}`);
map['./digest.js'] = encoded(`export const AI_SYS_DIGEST='FOLD SYS';`);
// (the archive's own prompts.js, whole: the short instruction and the way a compression request is put together)
map['./prompts.js'] = encoded(swap(await readFile(new URL('../src/prompts.js', import.meta.url), 'utf8')));
export const P = await import(map['./prompts.js']);
map['./phone2story.js'] = encoded(`export const liveStoryText=()=>globalThis.__dropTest.story||'';`);
// (the story snapshot's keep-up: T.tail is the role-play's end now, T.extend the lengthened snapshot and T.start a first one's
// { snap, … } (or an Error, or a function))
map['./phone2snap.js'] = encoded(`const T=globalThis.__dropTest;
export const liveChatTail=()=>T.tail||{lines:[],first:null,end:0};
export const liveSnapBehind=(snap,t)=>!!snap&&t.end>snap.upto&&(t.first===null||t.first>snap.upto+1);
export const liveSnapNow=async m=>{T.starts=(T.starts||0)+1;const a=T.start;if(a instanceof Error)throw a;return typeof a==='function'?a(m):a||null;};
export const liveSnapExtend=async(m,snap)=>{T.extends=(T.extends||0)+1;T.extendArgs=[m,snap];const a=T.extend;if(a instanceof Error)throw a;return typeof a==='function'?a(m,snap):a;};`);
export const G = await import(encoded(swap(await readFile(new URL('../src/phone2go.js', import.meta.url), 'utf8'))));
const store = new Map();
globalThis.localStorage ||= { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };

// 폰 2의 나머지 파일도 같은 가짜 이웃으로 (서로 부르는 순서대로: 연도 → 요청 뼈대 → 채우기 · 넣기 · 앱 안에서 만들기)
const load2 = async f => { map[`./${f}`] = encoded(swap(await readFile(new URL(`../src/${f}`, import.meta.url), 'utf8'))); return import(map[`./${f}`]); };
// 실시간 폰의 연도 (phone2year.js)
export const Y = await load2('phone2year.js');
// 요청 뼈대 (phone2req.js), 앱 채우기 (phone2fill.js), 롤플에 넣기 (phone2note.js)
export const Q = await load2('phone2req.js');
export const F = await load2('phone2fill.js');
// 생활 쪽 채우기 (phone2life.js; 폰 1의 phonelife.js도 같은 이웃으로)
map['./anniv.js'] = encoded(`export const datedRows=()=>[];`);
map['./phonefood.js'] = href('phonefood.js'); map['./phonescreen.js'] = href('phonescreen.js');
export const LIFE = await load2('phonelife.js');
export const L2 = await load2('phone2life.js');
// 위치 읽기 (phone2where.js)
export const W2 = await load2('phone2where.js');
// 폰 다시 만들기 (phone2make.js)
export const MK = await load2('phone2make.js');
// 은행 채우기 (phone2money.js)
export const M2 = await load2('phone2money.js');
export const N = await load2('phone2note.js');
// 투자 앱 요청 (phone2invest.js; 폰 1의 investdata.js도 같은 이웃으로, 자산 계산만 빈 것으로)
const mapINV = { ...map, './wealth.js': encoded(`export const wealthBlock=()=>'';export const wealthCheck=()=>null;export const investmentWealthRows=()=>[];`) };
map['./investdata.js'] = encoded((await readFile(new URL('../src/investdata.js', import.meta.url), 'utf8')).replace(/from '([^']+)'/g, (all, k) => `from '${mapINV[k] || k}'`));
export const INV = await import(map['./investdata.js']);
map['./phone2invest.js'] = encoded((await readFile(new URL('../src/phone2invest.js', import.meta.url), 'utf8')).replace(/from '([^']+)'/g, (all, k) => `from '${k === './investdata.js' ? map[k] : mapINV[k] || k}'`));
export const I2 = await import(map['./phone2invest.js']);
// 말투 읽기 (phone2voice.js; 폰 1의 phonetr.js도 같은 이웃으로)
// (phonetr.js asks the translator and the open chat too: stand-ins that do nothing, beside the same phonedata.js)
const mapTR = { ...map, './translate.js': encoded(`export const glossaryEntries=()=>[];export const glossaryPeople=()=>[];export const glossaryIn=()=>[];export const askTranslator=async()=>'';`),
    './core.js': encoded(`export const phoneMeta=()=>null;export const hasChat=()=>false;`) };
map['./phonetr.js'] = encoded((await readFile(new URL('../src/phonetr.js', import.meta.url), 'utf8')).replace(/from '([^']+)'/g, (all, k) => `from '${mapTR[k] || k}'`));
export const TR = await import(map['./phonetr.js']);
export const V = await load2('phone2voice.js');
// 사진 · 메모 · 초안 · 녹음: 폰 1 것(phoneai.js)과 폰 2 것(phone2act.js)
const mapAI = { ...map, './people.js': encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];export const peopleList=()=>[];`) };
map['./phoneai.js'] = encoded((await readFile(new URL('../src/phoneai.js', import.meta.url), 'utf8')).replace(/from '([^']+)'/g, (all, k) => `from '${mapAI[k] || k}'`));
export const AI = await import(map['./phoneai.js']);
export const ACT = await load2('phone2act.js');
