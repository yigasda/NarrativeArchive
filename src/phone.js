// 캐릭터 휴대폰: one character's phone as the story stands — messages, calls, photos (captions, no pictures), notes,
// searches, a calendar and the places they have been. The draft model writes the content as JSON from the archive; the
// screens are drawn here, the same for everyone. Texts are in the language the writer would use, with Korean under them.
// m.phones = { [name key]: { owner, country, wall, accent, now, contacts, threads, calls, photos, notes, searches, events,
//   upto (the last message number the archive held), at, inject } }

import { phoneChatScope, phoneTarget, ensurePhoneStory, resetPhoneStory } from './phonestory.js';
import { prepareWealth, dateOrderOf, needsDateOrder, setDateOrder, setScreenHolder, ensureScreenHolder, screenHolderChoices, setOwnerLives, setPlaceCity, cityChoices, answerOwnerAsk, dropPlacePerson, rereadPlaces, placeInfo, countryOf, countryZones, phonePre, preparePhone, setPreYear, screenHolderLabel } from './phonedata.js';
import { profileEntries, resolvePhoneProfile, currentPersonaBinding } from './phoneprofile.js';
import { investmentScreen } from './investui.js';
import { collectInvestmentRecords, fillInvestment, fillChartHistory, refreshMarket, refreshBankFX, investmentDate, validDate } from './investdata.js';
import { migrateBank, selectPrice } from './finance.js';
import { askDraft, draftReady, draftSettings, drLabel, listModels, vxModelList, withSpinner } from './ai.js';
import { ctx, getMeta, globalSettings, phoneMeta, saveGlobal, saveMeta, setPhoneMeta } from './core.js';
import { applyInjection } from './inject.js';
import { faceHtml, nameKey, peopleList } from './people.js';
import { drafting, drawing, drawPhoto, drawPost, filling, makeDraft, paging, retranslate, retranslating, recording, recordVoice, searching, searchPage, shooting, takePhoto, webPage, writeEntry, writing } from './phoneai.js';
import { setDraft, setDraftModels, setLang, setVoice, setVoiceAdd, voiceList, voicePeople, ax, axFind, groupInfo, APPS, AXB, AXB_C, busyHtml, setDate, setScreenHolderView, callScreen, callWho, calOne, calScreen, camScreen, contactOne, contactsScreen, diaryOne, diaryScreen, draftView, ic, looksSheet, mailOne, mailScreen, mapScreen, mapTowns, msgList, noteOne, noteScreen, photoScreen, photoView, REMAKE_MORE, setLore, setRemake, setScreen, setTheme, setOwnerProfile, setWho, snsPost, snsScreen, statusBar, threadScreen, setPlace, prepScreen } from './phoneapps.js';
import { phoneMaking, dropStretch, settleBranch, chatStamp, koGaps, savedName, ensureIds, ensureYear, hasDatedRecords, noArchive, setStoryYear, storyYear, fillDevice, fillMoney, fillVoice, koOn, loreOff, makePhone, tidyKo, markAfter, phoneLore, REMAKE, restoreRounds, retryMoney, showNow, storyNow, syncLeft, syncRows, syncState, tidyJournal, undoRound } from './phonedata.js';
import { busy, watchBusy, exclusive, journalRead, journalWrite, syncOf } from './phonesync.js';
import { syncPick, syncSettings } from './phonesyncui.js';
import { CG_W, homeScreen, lastSig, lockScreen, threadNew } from './phonehome.js';
import { bankDisplayCurrency, bankAcct, bankHome, bankTx, fixedScreen, bankNotes, bankSend, bankStmt, txDoc, bankMore, cardView, orderView, passView, trackView, shopScreen, voiceOne, voiceScreen, walletScreen } from './phonemoney.js';
import { marksScreen, pageView, searchOne, searchScreen, tabsScreen } from './phoneweb.js';
import { fillDelivery, fillLife, fillScreen, fillShopMenus, menuWanted, refreshNearby } from './phonelife.js';
import { alarmScreen, setStory, cartScreen, cityList, cityScreen, clockScreen, compareScreen, dlvScreen, fileScreen, filesScreen, folderScreen, healthScreen, heartScreen, hereWidget, itemScreen, orderScreen, ordersScreen, payScreen, rateScreen, shopScreen2, sleepScreen, stepsScreen, timerScreen, waterScreen, weatherScreen, weightScreen, workScreen, worldScreen } from './phonelifeapps.js';
import { screenTimeScreen } from './phonestime.js';
import { mapCityScreen, mapEmptyScreen, mapResults, mapSearchScreen } from './phonemapsearch.js';
import { placeNames } from './phonemapfind.js';
import { FLAG_NAME, flagSvg } from './phoneflags.js';
import { mapZoom } from './phonemapzoom.js';
import { tileWatch } from './phonetilemap.js';
import { glossaryEntries, openGlossary } from './translate.js';
import { dropVoice, fillKo, koAppOf, koScopeOf, labelVoices, learnVoices, pickVoices, redoKo, roundScope, tickLang } from './phonetr.js';
// 을 / 를 after a word: by its last syllable's final consonant (a Latin ending, like SNS, reads as 를)
const josa = w => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? '을' : '를'; };
import { confirm, esc } from './util.js';
import { liveMode, liveWorld, livePhone, liveMeta, setLiveMode, resetLive, rememberLiveOwner, readLiveOwner, liveKey, liveRooms, ensureRoom, nameRoom, sendLive, readLive, unreadBy, enqueueReplies, seeFailure } from './phone2store.js';
import { shiftLabel, liveWall, viewerWall, startShift } from './phone2clock.js';
import { orbitList, orbitRoom, orbitNew, orbitHomeWidget, liveStart } from './phoneorbit.js';
import { liveStoryText, beginFromStory, liveBranched, adoptChat, rebeginFromStory, rebeginKeepingChats } from './phone2story.js';
import { liveGo, liveReflect, liveCanUndo, liveUndo, liveUnreflected, liveNowOf } from './phone2go.js';

// other files keep importing these from here (주입: 실시간 폰의 폰들도 같이, 주입이 꺼진 폰은 빼고)
import { phoneBlock as phoneBlock0, nowOn } from './phonedata.js';
export const phoneBlock = m => phoneBlock0(m, Object.values(liveWorld(m)?.phones || {}));

// what 초안 모델's screen shows (the key only by its last four)
const draftUi = () => { const t = draftSettings(); let host = ''; try { host = t.url ? new URL(t.url).host : ''; } catch { host = t.url; }
    return { mode: t.mode, label: drLabel(), model: t.model, url: t.url, host, keyTail: t.key ? `…${String(t.key).slice(-4)}` : '', fmt: t.fmt, effort: t.effort, vxModel: t.vxModel, vxLocation: t.vxLocation, okAt: t.okAt }; };
// 초안 모델 › 모델: which setting the list fills, and the list (the address's, loaded; or SillyTavern's Vertex models)
const draftKey = () => (draftSettings().mode === 'vertex' ? 'vxModel' : 'model');
const draftIds = () => (draftSettings().mode === 'vertex' ? vxModelList() : draftSettings().models || []);
// a make that ends tells every phone open now (one shut and opened again mid-make draws the phone it made)
const madeWatch = new Set();
function screen(p, view, m, roster, ui) {
    // (타임라인은 예전 그대로 storyNow(p), 실시간만 서랍의 흐르는 시계)
    const now = nowOn(p, phoneMeta());
    showNow(now);
    setStory(p);
    // "view:id": an id may hold colons itself (a reflection's records are "sync:event:m0")
    const cut = view.indexOf(':'), v = cut < 0 ? view : view.slice(0, cut), i = cut < 0 ? undefined : view.slice(cut + 1);
    const life = { clock: () => clockScreen(p, now), timer: () => timerScreen(p, now), wclock: () => worldScreen(p, now), alarm: () => alarmScreen(p, now, i), health: () => healthScreen(p, now, i || ''), hsteps: () => stepsScreen(p, now, i), hsleep: () => sleepScreen(p, now, i), hcmp: () => compareScreen(p, now), hwork: () => workScreen(p, now, i), hheart: () => heartScreen(p, now, i), hwater: () => waterScreen(p, now, i), hweight: () => weightScreen(p, now, i),
        files: () => filesScreen(p, now), folder: () => folderScreen(p, now, i || ''), file: () => fileScreen(p, now, i), weather: () => weatherScreen(p, now), wcity: () => cityScreen(p, now, i), wlist: () => cityList(p, now),
        // the home's delivery icon opens it by its app name
        dlv: () => dlvScreen(p, now), delivery: () => dlvScreen(p, now), dshop: () => shopScreen2(p, now, i), dcart: () => cartScreen(p, now), dorders: () => ordersScreen(p, now), dorder: () => orderScreen(p, now, i), ditem: () => itemScreen(p, now, i), dpay: () => payScreen(p, now), drate: () => rateScreen(p, now, i) }[v];
    const body = life ? life() : ['ivnotes', 'ivschedule', 'ivhistory', 'invest', 'stock', 'ivactivity', 'ivwatch', 'ivstakes', 'ivcash', 'ivprices'].includes(v) ? investmentScreen(m, p, now, v, decodeURIComponent(i || ''), ui.investing) : v === 'lock' ? lockScreen(p, now) : v === 'home' ? homeScreen(p, now, m, 1, '', ui.orbitHome || '') : v === 'home2' ? homeScreen(p, now, m, 2, hereWidget(p, now)) : v === 'bank' ? bankHome(p, now) : v === 'acct' ? bankAcct(p, now, i || '0') : v === 'tx' ? bankTx(p, now, i || '') : v === 'fixed' ? fixedScreen(p, now, i || '') : v === 'banknote' ? bankNotes(p, now) : v === 'banksend' ? bankSend(p, now, i || '') : v === 'stmt' ? bankStmt(p, now, i || '') : v === 'txdoc' ? txDoc(p, now, i || '') : v === 'bankmore' ? bankMore(p, now) : v === 'wallet' ? walletScreen(p, now, i || '') : v === 'card' ? cardView(p, now, i || '0') : v === 'pass' ? passView(p, now, i || '') : v === 'shop' ? shopScreen(p, now, i || 'all') : v === 'order' ? orderView(p, now, i || '') : v === 'track' ? trackView(p, now, i || '') : v === 'voice' ? voiceScreen(p, now, i || '') : v === 'voiceone' ? voiceOne(p, now, i || '0') : v === 'groupinfo' ? groupInfo(p, now, Number(i) || 0, roster) : v === 'msg' ? msgList(p, now, roster)
        : v === 'thread' ? threadScreen(p, now, Number(i), roster, ui) : v === 'draft' ? draftView(p, now, Number(i), roster) : v === 'call' || v === 'callmiss' ? callScreen(p, now, roster, v === 'callmiss') : v === 'callwho' ? callWho(p, now, Number(i), roster) : v === 'contacts' ? contactsScreen(p, now, roster) : v === 'contact' ? contactOne(p, now, decodeURIComponent(i || ''), roster, m, ui.contactBack)
        : v === 'photo' ? photoScreen(p, now) : v === 'photoone' ? photoView(p, now, Number(i))
        : v === 'note' ? noteScreen(p, now) : v === 'noteone' ? noteOne(p, now, Number(i)) : v === 'search' ? searchScreen(p, now) : v === 'page' ? pageView(p, now, i || '', paging.has(`${nameKey(p.owner)}:${i}`)) : v === 'tabs' ? tabsScreen(p, now) : v === 'marks' || v === 'history' ? marksScreen(p, now, v === 'history') : v === 'searchone' ? searchOne(p, now, Number(i), searching.has(`${nameKey(p.owner)}:${i}`))
        : v === 'cal' ? calScreen(p, now, m, i || '') : v === 'calone' ? calOne(p, now, Number(i), m) : v === 'map' ? (mapTowns(p, m).groups.length ? mapScreen(p, now, m, i || '') : mapEmptyScreen(p, now, m)) : v === 'mapq' ? mapSearchScreen(p, now, m, i || '', ui.mapQ || '') : v === 'mapc' ? mapCityScreen(p, now, m, i || '')
        : v === 'sns' ? snsScreen(p, now) : v === 'snspost' ? snsPost(p, now, Number(i)) : v === 'mail' ? mailScreen(p, now, i) : v === 'mailone' ? mailOne(p, now, Number(i))
        : v === 'diary' ? diaryScreen(p, now, i || '') : v === 'diaryone' ? diaryOne(p, now, Number(i)) : v === 'setsync' ? syncSettings(p, now, ui) : v === 'setsyncpick' ? syncPick(p, now, ui) : v === 'set' ? setScreen(p, now, m, ui) : v === 'stime' ? screenTimeScreen(p, now, i || '') : v === 'settheme' ? setTheme(p, now) : v === 'setscreenholder' ? setScreenHolderView(p, now, m, ui.holderBack) : v === 'setdate' ? setDate(p, now, m, ui) : v === 'setplace' ? setPlace(p, now, m, ui) : v === 'setdraft' ? setDraft(p, now, draftUi(), ui.draftBack || 'set') : v === 'setdraftmodel' ? setDraftModels(p, now, draftIds(), draftSettings()[draftKey()] || '', draftSettings().mode === 'custom') : v === 'setvoice' ? setVoice(p, now, ui.voicePick, ui.voiceBusy) : v === 'setlang' ? setLang(p, now, i) : v === 'setvoiceadd' ? setVoiceAdd(p, now, ui.voiceAdd, ui.voiceBusy) : v === 'prep' ? prepScreen(p, now, m, ui.prep) : v === 'setremake' ? setRemake(p, now, ui, m) : v === 'setprofile' ? setOwnerProfile(p,now,ui.profileState,!!ui.phones?.live) : v === 'setwho' ? setWho(p, now, m, ui) : v === 'setlore' ? setLore(p, now, m, ui)
        : v === 'cam' ? camScreen(p, now, i === undefined ? -1 : Number(i), shooting.has(nameKey(p.owner))) : v === 'livestart' ? liveStart(p, now, ui.start) : v === 'orbit' ? orbitList(p, now, ui.orbit) : v === 'orbitroom' ? orbitRoom(p, now, ui.orbit) : v === 'orbitnew' ? orbitNew(p, now, ui.orbit) : homeScreen(p, now, m, 1, '', ui.orbitHome || '');
    // the home is the design board itself, at its own size, scaled to the screen (--k)
    // every app: drawn at the boards' size too, each its own app look
    if (!['home', 'home2', 'lock'].includes(v)) { const c = AXB_C[AXB[v]]; return `<div class="na_ph_scr app ax${['card', 'tx'].includes(v) ? '' : ` ax_${v}`} v_${v}${c ? ' axb' : ''}" style="--ph-acc:var(--ph-${p.accent})${c ? `; --axd: ${c[0]}; --axc: ${c[1]}` : ''}"><div class="cg_canvas ax_canvas">${body}</div></div>`; }
    if (v === 'home' || v === 'home2' || v === 'lock') return `<div class="na_ph_scr cg ${p.theme === 'gray' ? 'cg_mono' : 'cg_gel'} v_${v}" style="--ph-acc:var(--ph-${p.accent})"><div class="cg_canvas">${body}</div></div>`;
    const glass = v === 'lock';
    return `<div class="na_ph_scr ${glass ? `glass w_${p.wall}` : 'app'} v_${v}" style="--ph-acc:var(--ph-${p.accent})">${statusBar(p, now)}<div class="na_ph_body">${body}</div><button type="button" class="na_ph_bar" data-go="home" aria-label="홈"></button></div>`;
}

// Selection belongs to this chat, not the order of the character list.
export function selectedPhoneOwner(m, names, who = null, saved = null) {
    const find = value => typeof value === 'string' && names.find(n => nameKey(n) === nameKey(value));
    return find(who) || find(saved) || find(m.lastPhoneOwner) || names.find(n => m.phones?.[nameKey(n)]) || names[0] || null;
}

// Save synchronously as well: a reload may precede the host's metadata write.
export const phoneSelectionKey = phoneChatScope;

export function readPhoneSelection(key, storage) {
    try { return key ? (storage || globalThis.localStorage)?.getItem(key) : null; } catch { return null; }
}
export function rememberPhoneSelection(m, owner, key, storage) {
    if (!owner) return;
    m.lastPhoneOwner = owner;
    try { if (key) (storage || globalThis.localStorage)?.setItem(key,owner); } catch { /* Metadata remains available when browser storage is disabled. */ }
}

// ---- the window
export async function openPhone(who = null) {
    const c = ctx();
    // realM: the chat's own meta. m: what the screens, drawing and buttons are given: realM in 타임라인 (폰 1), 폰 2's
    // drawer (liveMeta) in 실시간, so nothing there reaches 폰 1. realM stays only for saveMeta · liveMode · setLiveMode · liveWorld
    const realM = getMeta(), openingScope = phoneChatScope(c);
    let m = realM;
    const stillHere = () => getMeta() === realM && phoneChatScope(ctx()) === openingScope;
    if (!await ensurePhoneStory(m) || !stillHere()) return;
    await ensureScreenHolder(m, c);
    if (!stillHere()) return;
    // 분기한 방 (docs/PHONE2-PLAN.md 5-3 · 7-4): 폰 1의 폰마다 그 방에 없는 뒷이야기를 한 번 빼요(settleBranch).
    // 실시간 폰은 settleBranch에 넣지 않아요(메신저 번호로 읽은 자리를 적어서). 대신 가려내요(liveBranched):
    // 'after' 이 방 것으로 삼기 · 'before' 되돌린 폰 1로 다시 시작 · 'none' 그대로. 분기가 아니면 아무것도 안 바뀌고 알림도 없어요
    {
        const done = [];
        for (const p of Object.values(realM.phones || {})) if (p?.owner) { try { const r = await settleBranch(realM, p); if (r) done.push({ name: p.owner, p, ...r }); } catch (err) { console.error('[narrative-archive] branch', p?.owner, err); } }
        let rebegun = false;
        const lw = liveWorld(realM);
        if (lw) {
            try {
                const pts = done.map(r => r.point).filter(Number.isInteger), st = chatStamp(lw.storyUpto);
                const how = liveBranched(lw, { ...st, point: pts.length ? Math.min(...pts) : null });
                if (how === 'after') { adoptChat(lw, st.chat); await saveMeta(); }
                if (how === 'before') {
                    // (폰 1은 위에서 이미 되돌려졌어요: 시작 버튼과 같은 값으로, 그 폰 1에서 다시 시작)
                    const base = realM.phones?.[nameKey(lw.lastOwner)] || Object.values(realM.phones || {}).find(p => p?.owner);
                    const upto = Math.max(0, (ctx().chat?.length || 1) - 1), now = chatStamp(upto);
                    rebeginFromStory(realM, { upto, scope: phoneChatScope(ctx()), dayShift: base ? startPlanOf(base).dayShift : 0, chat: now.chat, fp: now.fp });
                    rebegun = true;   // (null이면 폰 1에 폰이 없어서 실시간 폰을 내렸어요: 모드는 타임라인)
                    await saveMeta();
                }
            } catch (err) { console.error('[narrative-archive] live branch', err); }
        }
        if (!stillHere()) return;
        // 알림은 한 줄: 뺀 게 있거나 실시간 폰이 다시 시작했을 때만(시각을 몰랐던 건 콘솔에만)
        for (const r of done) if (!r.at) console.info('[narrative-archive] branch: story time at the branch point unknown, made records and clock kept', r.name);
        const shown = done.filter(r => (r.dropped || 0) + (r.items || 0) + (r.cut || 0) > 0);
        const n = shown.reduce((t, r) => t + (r.dropped || 0) + (r.items || 0) + (r.cut || 0), 0), kept = [...new Set(shown.flatMap(r => r.kept || []))];
        const lines = [...(n ? [`갈라진 뒤 기록 ${n}개 뺐어요${kept.length ? ` · ${esc(kept.join(', '))} 남김` : ''}`] : []), ...(rebegun ? [`${n ? '실시간 폰은 ' : ''}갈라진 곳부터 다시 시작해요`] : [])];
        if (lines.length) toastr.info(lines.join('<br>'), n ? `${esc([...new Set(shown.map(r => r.name))].join(' · '))} 폰` : '실시간 폰', { escapeHtml: false });
    }
    // a round this browser made that the saved chat doesn't have: kept, and offered in 설정 › 대화 반영; the phone opens anyway
    let syncPending = 0;
    try { syncPending = tidyJournal(m, phoneChatScope(c)); } catch (err) { console.error('[narrative-archive] sync journal', err); }
    if (syncPending && liveMode(realM) !== 'live') toastr.info('저장되지 않은 반영 기록이 있어요. 설정 › 대화 반영에서 복구할 수 있어요', '캐릭터 휴대폰');
    applyInjection();
    m.phones = m.phones && typeof m.phones === 'object' ? m.phones : {};
    // phones saved before records had ids get them now, once
    if (Object.values(m.phones).reduce((n, p) => n + ensureIds(p), 0)) saveMeta();
    const names = peopleList(m);
    for (const p of Object.values(m.phones)) if (p?.owner && !names.some(n=>nameKey(n) === nameKey(p.owner))) names.push(p.owner);
    const roster = new Set(names.map(nameKey));
    const selectionKey = phoneSelectionKey(c);
    // 실시간 (폰 2): its own people and its own last owner (m.live only); 타임라인 (폰 1) as before
    const live = () => liveMode(realM) === 'live';
    const liveNames = () => Object.values(liveWorld(realM)?.phones || {}).map(p => p?.owner).filter(Boolean);
    // (5-4: 이 브라우저에 저장한 실시간 폰의 마지막 주인, 없으면 세계의 것, 없으면 첫 인물)
    const liveOwner = () => { const ns = liveNames(), last = readLiveOwner(realM, selectionKey); return ns.find(n => nameKey(n) === nameKey(last)) || ns[0] || null; };
    let owner = live() ? liveOwner() : selectedPhoneOwner(m, names, who, readPhoneSelection(selectionKey));
    if (owner && !live()) { rememberPhoneSelection(m,owner,selectionKey); await saveMeta(); }
    if (!stillHere()) return;
    let investing = false, making = false, busyMake = null, placeReading = false, prepLinking = false, prepOpen = false, prepFrom = false;  // 폰 만들기 준비: linking, 1~4 shown again, 인물 정보 opened from it
     // busyMake: 'sync' | 'make' while a reflection or a make runs
    for (const p of Object.values(m.phones)) migrateBank(m, p);
    // phones from before 날짜 및 시간 get their year (or none) once
    if (Object.values(m.phones).filter(p => p?.owner).map(p => ensureYear(m, p)).some(Boolean)) await saveMeta();
    if (!stillHere()) return;
    if (Object.values(m.phones).some(p => p.money)) await saveMeta();
    if (!stillHere()) return;
    // 실시간: the drawer is made once for its world and kept (a new one each time would copy the glossary again)
    let drawer = null;
    const useMode = () => { m = live() ? (drawer?.w === liveWorld(realM) ? drawer.d : (drawer = { w: liveWorld(realM), d: liveMeta(realM, { text: () => liveStoryText(realM, liveWorld(realM)), now: liveNowOf(realM) }) }).d) : realM; setPhoneMeta(m === realM ? null : m); };
    useMode();
    const liveRoster = () => new Set(liveNames().map(nameKey));
    // Orbit (실시간 폰의 메신저, docs/design/orbit.md): 계정은 페르소나(쓰기)와 이 폰 주인(읽기만) 둘. 왼쪽 위 얼굴 → 아래 시트로 바꿔요
    let obTab = 'all', obPick = [], obGname = '', obWho = '', obSheet = false, obDraft = '';
    const obOpen = new Set();   // 한국어를 기본과 반대로 둔 말들
    const roomNow = () => (view.startsWith('orbitroom:') ? liveWorld(realM)?.messenger?.rooms?.[view.slice(10)] || null : null);
    // 지금 계정: 폰 주인 계정은 주인이 페르소나가 아닐 때만, 그 폰을 보고 있을 때만
    const obAcct = () => { const w = liveWorld(realM), me = w?.persona || ''; return obWho && owner && liveKey(obWho) === liveKey(owner) && liveKey(owner) !== liveKey(me) ? owner : me; };
    // 실시간 폰 시작 (5단계): 이야기 날짜 + 현실 시각(startShift), 마지막 메시지까지
    function startPlanOf(p) {
        const at = String(storyNow(p) || p?.now || ''), tz = placeInfo(p).owner.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
        let dayShift = 0; try { dayShift = startShift({ storyAt: at.slice(0, 11), storyYear: Number(p?.year) || new Date().getFullYear(), tz }); } catch { dayShift = 0; }
        const w = viewerWall(Date.now(), dayShift).at, md = x => `${Number(x.slice(0, 2))}월 ${Number(x.slice(3, 5))}일`;
        return { dayShift, persona: ctx().name1 || 'Me', local: w.slice(6), date: md(w), shift: shiftLabel(dayShift), upto: /^\d{2}-\d{2} \d{2}:\d{2}/.test(at) ? `${md(at)} ${at.slice(6, 11)}까지` : '' };
    }
    const startPlan = startPlanOf;
    const orbitUi = () => {
        const w = liveWorld(realM);
        if (!live() || !w) return {};
        const me = w.persona, who = obAcct(), ro = liveKey(who) !== liveKey(me), sh = w.dayShift || 0, vw = ms => viewerWall(ms, sh).at, today = vw(Date.now()).slice(0, 5), yday = vw(Date.now() - 864e5).slice(0, 5);
        const dayOf = a => (a.slice(0, 5) === today ? '오늘' : a.slice(0, 5) === yday ? '어제' : `${Number(a.slice(0, 2))}월 ${Number(a.slice(3, 5))}일`);
        const shortAt = ms => { const a = vw(ms), d = dayOf(a); return d === '오늘' ? a.slice(6) : d; };
        const tzOf = n => { const ph = livePhone(realM, n); return ph ? placeInfo(ph).owner.tz || '' : ''; };
        const cityOf = n => { const ph = livePhone(realM, n); return ph ? placeInfo(ph).owner.city || '' : ''; };
        const seen = x => !(x?.act && !String(x.text || '').trim());   // (말 없이 폰으로만 한 일: 그리지도 세지도 않아요)
        const unreadOf = (r, k) => { const t = r.read?.[liveKey(k)] || 0; return r.messages.filter(x => seen(x) && liveKey(x.from) !== liveKey(k) && x.at > t).length; };
        const roomsOf = k => liveRooms(realM).filter(r => r.members.some(n => liveKey(n) === liveKey(k))).map(r => ({ r, last: [...r.messages].reverse().find(seen) })).sort((a, b) => (b.last?.at || 0) - (a.last?.at || 0));
        const view4 = k => {
            const others = r => r.members.filter(n => liveKey(n) !== liveKey(k)), titleOf = r => r.name || others(r).join(', ');
            const brief = ({ r, last }) => ({ id: r.id, title: titleOf(r), group: others(r).length > 1, last: last?.text || '', lastWho: last ? (liveKey(last.from) === liveKey(k) ? '나' : others(r).length > 1 ? last.from : '') : '', time: last ? shortAt(last.at) : '', unread: liveKey(k) === liveKey(me) ? unreadOf(r, me) : 0 });
            return { others, titleOf, brief };
        };
        const mine4 = roomsOf(me), V = view4(who), rooms = ro ? roomsOf(who) : mine4;
        const out = { orbitHome: orbitHomeWidget(mine4.slice(0, 2).map(view4(me).brief), mine4.reduce((n, x) => n + unreadOf(x.r, me), 0)) };
        const v = view.split(':')[0];
        // 계정 시트: 페르소나 + (주인이 다르면) 이 폰 주인
        const accts = [me, ...(owner && liveKey(owner) !== liveKey(me) ? [owner] : [])].map(n => ({ name: n, sub: livePhone(realM, n)?.profile?.handle || liveKey(n), on: liveKey(n) === liveKey(who) }));
        if (v === 'orbit') {
            const hn = rooms.map(x => V.others(x.r).find(n => tzOf(n))).find(Boolean);
            out.orbit = { tab: obTab, acct: { name: who, ro, sheet: obSheet && accts.length > 1, list: accts }, hero: hn ? { name: hn, city: cityOf(hn), local: liveWall(tzOf(hn), sh).at.slice(6) } : null, rooms: rooms.map(V.brief) };
        } else if (v === 'orbitnew') {
            if (ro) { view = 'orbit'; return orbitUi(); }
            const names = [...new Map([...Object.values(w.phones || {}).map(p => p?.owner), ...Object.values(w.messenger?.accounts || {}).map(a => a?.name)].filter(n => n && liveKey(n) !== liveKey(me)).map(n => [liveKey(n), n])).values()];
            out.orbit = { people: names.map(n => ({ name: n, sub: cityOf(n) })), picked: obPick, gname: obGname };
        } else if (v === 'orbitroom') {
            const r = roomNow();
            if (!r || !r.members.some(n => liveKey(n) === liveKey(who))) { view = 'orbit'; return orbitUi(); }
            const os = V.others(r), group = os.length > 1, chips = [];
            if (!group && tzOf(os[0])) { const there = liveWall(tzOf(os[0]), sh).at.slice(6), here = vw(Date.now()).slice(6); if (there !== here) chips.push({ icon: 'clock', text: `${os[0]} 현지 ${there}` }); }
            const msgs = []; let day = '';
            for (const x of r.messages) {
                if (!seen(x)) continue;
                const a = vw(x.at), d = dayOf(a);
                if (d !== day) { msgs.push({ day: d }); day = d; }
                const mine = liveKey(x.from) === liveKey(who);
                msgs.push({ id: x.id, mine, from: x.from, text: x.text, ko: x.ko || '', open: koOn() !== obOpen.has(x.id), time: mine ? a.slice(6) : '', unread: mine && !ro ? unreadBy(r, x).length : 0 });
            }
            // 답장을 기다리는 중이면 입력 중, 멈춘 실패가 있으면 그 줄(다시는 사람이 누를 때만). 1:1 머리 아래는 상대의 가장 최근 상태
            const jobs = w.queue?.jobs || [], typing = !ro && jobs.some(j => j.room === r.id && (j.state === 'waiting' || j.state === 'running'));
            const fail = ro ? null : jobs.find(j => j.room === r.id && j.state === 'failed' && !j.seen) || null;
            const state = group ? '' : [...r.messages].reverse().find(x => liveKey(x.from) === liveKey(os[0]) && String(x.state || '').trim())?.state || '';
            out.orbit = { id: r.id, title: V.titleOf(r), group, sub: group ? [...os, '나'].join(' · ') : state, chips, asOwner: ro, msgs, draft: obDraft, typing, fail: fail ? { id: fail.id } : null };
        }
        return out;
    };
    let view = 'lock', mapQ = '', contactBack = '', sheet = false, adding = false, loreOpen = false;
    let syncWhy = '', pickMore = 30;
    const profileStates = new Map();
    const loreExp = new Set(), loreEnts = new Map(); // books opened to their entries, and their entries once read
    const remake = new Set(); // the apps ticked in 설정 › 다시 만들기
    // the phone has the screen to itself: one layer over everything (a dialog, so the extension's colours and
    // SillyTavern's top layer both hold); the bar at the bottom of the home and lock screens closes it, the controls are in its 설정
    let sheetOpen = false;
    const $root = $(`
      <div class="na_popup na_v2 na_phone na_phl_root">
        <div class="na_ph_wrap"><div class="na_ph_frame"></div></div>
        <div class="na_phl_shade" hidden></div>
        <div class="na_phl_sheet" hidden>
          <div class="na_phl_grab"></div>
          <div class="na_phl_sheethead"><b>캐릭터 휴대폰</b></div>
          <div class="na_ph_owners"></div>
          <div class="na_ph_addrow na_ph_addbox" hidden><input type="text" class="text_pole na_ph_addname" placeholder="로어북에만 있는 인물 이름" enterkeyhint="done"><button type="button" class="na_v2_pillbtn na_ph_addok">추가</button></div>
          <div class="na_ph_ctrl"></div>
        </div>
      </div>`);
    const setSheet = on => { sheetOpen = on; $root.find('.na_phl_sheet, .na_phl_shade').prop('hidden', !on); };
    const phone = () => (owner ? (live() ? livePhone(realM, owner) : m.phones[nameKey(owner)]) : null);

    // 실시간: 타임라인's 반영 · 반영 설정 · 되돌리기 · 복구 · 빼기 and 이 방의 폰 새로 시작 are off (소망: everything else is
    // on both phones; 폰 2 reflects on its own, has its own 되돌리기 and 실시간 폰 새로 시작); a tap on one that is left does nothing
    const LIVE_OFF = '.na_ph_setupd, [data-go=setsync], .na_ph_storyreset, .na_sync_restore, .na_sync_drop, .na_sync_undo';
    $root.on('click', LIVE_OFF, e => { if (live()) { e.preventDefault(); e.stopImmediatePropagation(); } });
    // the Korean of what the phone has in another language (phonetr.js): after a reflection, from its report, or when
    // 한국어 is pressed. A failure is marked on the report (번역 못 함 · 다시 하기); the reflection itself stays
    let koBusy = false;
    // 설정 › 말투's 이야기에서 뽑기: the names chosen (lower case) while choosing, null otherwise; busy while the story is asked
    let voicePick = null, voiceAdd = new Set(), voiceBusy = false;
    // (who: whose phone it is; the one open unless a 실시간 reflection names another)
    const koRun = async (p, loud, who = owner) => {
        if (koBusy || !p) return;
        koBusy = true;
        try {
            // (how the people who text sound, from the story, for anyone not in the table yet; a failure here only leaves it out)
            try { await learnVoices(m, who, p); } catch (err) { console.warn('[narrative-archive] voices', err); }
            const n = await fillKo(p);
            if (p.syncLast?.trFailed) delete p.syncLast.trFailed;
            if (n || loud) await saveMeta();
        } catch (err) {
            if (p.syncLast) p.syncLast.trFailed = true;
            await saveMeta();
            toastr.warning(`번역을 못 했어요 · 반영 기록에서 다시 할 수 있어요 (${String(err?.message || err)})`, '캐릭터 휴대폰');
        } finally { koBusy = false; }
        if (!phoneClosed && phone() === p) drawPhone(true);
    };
    // 번역 못 했어요 (docs/mockups/phone-trfail A): while the round's Korean failed (p.syncLast.trFailed), a glass card over
    // whatever screen the phone shows; 다시 하기 runs koRun again (its success clears the mark, and the card with it),
    // 닫기 keeps it away for that round (trSeen). The report's 번역 못 함 · 다시 하기 stays either way
    // the ticket's notches are cut where its marker sits, which depends on the ticket's own lines: read every place first, then set them
    const notchPasses = () => {
        const ns = [...$root.find('.na_ph_frame .ax_psnt')], ys = ns.map(n => n.offsetTop);
        ns.forEach((n, i) => n.closest('.ax_ps')?.style.setProperty('--ny', `${ys[i] + 15}px`));
    };
    const trPop = () => {
        const p = phone(), host = $root.find('.na_ph_frame .cg_canvas')[0] || $root.find('.na_ph_frame .na_ph_scr')[0];
        $root.find('.na_ph_trpop').remove();
        if (!p?.syncLast?.trFailed || p.syncLast.trSeen || ask || !host) return;
        host.insertAdjacentHTML('beforeend', `<div class="pcf na_ph_trpop" role="dialog" aria-modal="true" aria-label="한국어 번역을 못 했어요"><div class="pcf_box"><div class="pcf_card"><div class="pcf_msg"><i class="pcf_tr">${ax('mqtrans', 20, 'currentColor', 2)}</i><b>한국어 번역을 못 했어요</b><span>다시 하면 빈 것만 번역해요</span></div><div class="pcf_btns"><div role="button" tabindex="0" class="pcf_no na_ph_trno">닫기</div><div role="button" tabindex="0" class="pcf_ok safe na_ph_trok">${koBusy ? `${busyHtml} 번역 중` : '다시 하기'}</div></div></div></div></div>`);
    };
    const profileDrafts = new Map();
    const pendingProfile = () => {
        const key=nameKey(owner);
        if(!profileDrafts.has(key)) profileDrafts.set(key,{owner,country:'KR',profileDraft:true,financeProfile:structuredClone(m.phoneProfiles?.[key])});
        return profileDrafts.get(key);
    };
    const drawOwners = () => {
        if (live()) { $root.find('.na_ph_owners').html(liveNames().map(n => `
          <button type="button" class="na_ph_pick ${n === owner ? 'on' : ''}" data-n="${esc(n)}">${faceHtml(n, 40)}<span>${esc(n)}</span><i></i></button>`).join('')); $root.find('.na_ph_addrow').prop('hidden', true); return; }
        $root.find('.na_ph_owners').html(`${names.map(n => `
          <button type="button" class="na_ph_pick ${n === owner ? 'on' : ''}" data-n="${esc(n)}">${faceHtml(n, 40)}<span>${esc(n)}</span>${m.phones[nameKey(n)] ? '<i></i>' : ''}</button>`).join('')}
          <button type="button" class="na_ph_pick na_ph_addp" title="인물 넣기"><span class="na_ph_addic">${ic('plus', 18, 2)}</span><span>넣기</span></button>`);
        $root.find('.na_ph_addrow').prop('hidden', !adding);
    };
    // the phone's own confirm: an iOS action sheet inside the screen (message, the action, a separate 취소); it survives redraws
    let ask = null;
    // the open sheet goes back on after every redraw (the frame's html is replaced); with nowhere to sit it closes as 'no'
    const placeAsk = () => { if (!ask || ask.el.isConnected) return; const host = $root.find('.na_ph_frame .cg_canvas')[0] || $root.find('.na_ph_frame .na_ph_scr')[0]; if (host) host.append(ask.el); else ask.done(false); };
    const askSheet = (title, text = '', ok = '확인', safe = false) => {
        if (!$root.find('.na_ph_frame .cg_canvas').length) return confirm(title, text, ok, { danger: !safe });
        ask?.done(false);
        return new Promise(done => {
            const el = $(`<div class="pcf" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="pcf_box"><div class="pcf_card"><div class="pcf_msg"><b>${esc(title)}</b>${text ? `<span>${text}</span>` : ''}</div><div class="pcf_btns"><div role="button" tabindex="0" class="pcf_no">취소</div><div role="button" tabindex="0" class="pcf_ok${safe ? ' safe' : ''}">${esc(ok)}</div></div></div></div></div>`)[0];
            ask = { el, done: v => { ask = null; el.remove(); done(v); } };
            placeAsk();
            el.querySelector('.pcf_no').focus({ preventScroll: true });
        });
    };
    // the same sheet with a choice: one row per option (a name and a small example under it), 나중에 apart; resolves the option's value or false
    const askChoice = (title, text, opts, no = '나중에') => {
        ask?.done(false);
        return new Promise(done => {
            const el = $(`<div class="pcf" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="pcf_box"><div class="pcf_card"><div class="pcf_msg"><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}</div><div class="pcf_btns v">${opts.map(o => `<div role="button" tabindex="0" class="pcf_ok safe${o.danger ? ' pcf_bad' : ''}" data-v="${esc(o.v)}">${o.sub ? `<span class="pcf_sub">${esc(o.sub)}</span>` : ''}${esc(o.label)}</div>`).join('')}<div role="button" tabindex="0" class="pcf_no">${esc(no)}</div></div></div></div></div>`)[0];
            ask = { el, done: v => { ask = null; el.remove(); done(v); } };
            placeAsk();
            if (el.isConnected) el.querySelector('.pcf_no').focus({ preventScroll: true });
        });
    };
    // the same sheet with two answers side by side, same weight (the first one's colour leads): resolves 'a' or 'b', or false
    const askPair = (title, text, a, b) => {
        ask?.done(false);
        return new Promise(done => {
            const el = $(`<div class="pcf" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="pcf_box"><div class="pcf_card"><div class="pcf_msg"><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}</div><div class="pcf_btns even"><div role="button" tabindex="0" class="pcf_ok safe pcf_lead" data-v="a">${esc(a)}</div><div role="button" tabindex="0" class="pcf_ok safe" data-v="b">${esc(b)}</div></div></div></div></div>`)[0];
            ask = { el, done: v => { ask = null; el.remove(); done(v); } };
            placeAsk();
            if (el.isConnected) el.querySelector('.pcf_ok').focus({ preventScroll: true });
        });
    };
    // the same sheet with a line to type (a city): resolves the text, or false. area: a few lines that wrap (a 말투), an
    // editable div as 도시 찾기's (a theme that paints every textarea can't reach it); Enter still saves
    const fieldVal = f => String(f.value ?? f.innerText ?? '').replace(/\s+/g, ' ').trim();
    const askInput = (title, text, value = '', ok = '저장', { area = false, empty = false } = {}) => {
        ask?.done(false);
        return new Promise(done => {
            const el = $(`<div class="pcf" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="pcf_box"><div class="pcf_card"><div class="pcf_msg"><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}</div><div class="pcf_in">${area ? `<div class="pcf_field pcf_area"${empty ? ' data-empty="1"' : ''} contenteditable="true" role="textbox" aria-multiline="true" enterkeyhint="done" spellcheck="false">${esc(value)}</div>` : `<input type="text" class="pcf_field" value="${esc(value)}" enterkeyhint="done" autocomplete="off">`}</div><div class="pcf_btns"><div role="button" tabindex="0" class="pcf_no">취소</div><div role="button" tabindex="0" class="pcf_ok safe">${esc(ok)}</div></div></div></div></div>`)[0];
            ask = { el, done: v => { ask = null; el.remove(); done(v); } };
            placeAsk();
            // (a few lines with something written already (a 말투 to read): no keyboard and nothing selected until it is tapped)
            if (el.isConnected) { const f = el.querySelector('.pcf_field'); if (area && String(value).trim()) el.querySelector('.pcf_ok').focus({ preventScroll: true }); else { f.focus({ preventScroll: true }); if (f.select) f.select(); else { const r = document.createRange(); r.selectNodeContents(f); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } } }
        });
    };
    // the same sheet, a row a place: its flag, a name, a line under it (시안 B, docs/mockups/phone-place-ask); title may carry a flag
    const askPick = (title, text, opts, flag = '', no = '나중에') => {
        ask?.done(false);
        return new Promise(done => {
            const el = $(`<div class="pcf" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="pcf_box"><div class="pcf_card"><div class="pcf_msg"><b>${flag ? `${flagSvg(flag, 22)} ` : ''}${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}</div><div class="pcf_btns v">${opts.map(o => `<div role="button" tabindex="0" class="pcf_ok safe pcf_pick" data-v="${esc(o.v)}">${o.flag ? flagSvg(o.flag, 26) : ''}<span class="pcf_pt"><span>${esc(o.label)}</span>${o.sub || o.time ? `<small>${esc(o.sub || '')}${o.sub && o.time ? ' · ' : ''}${o.time ? `<span class="pcf_tm">${esc(o.time)}</span>` : ''}</small>` : ''}</span></div>`).join('')}<div role="button" tabindex="0" class="pcf_no">${esc(no)}</div></div></div></div></div>`)[0];
            ask = { el, done: v => { ask = null; el.remove(); done(v); } };
            placeAsk();
            if (el.isConnected) el.querySelector('.pcf_no').focus({ preventScroll: true });
        });
    };
    // which country: the twelve the stories go to most as flags, "다른 나라" to type one; resolves a code, 'other', or false
    const PLACE_FLAGS = ['kr', 'jp', 'cn', 'us', 'gb', 'de', 'fr', 'it', 'es', 'ca', 'au', 'ru'];
    const askCountry = (title, text) => {
        ask?.done(false);
        return new Promise(done => {
            const el = $(`<div class="pcf" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="pcf_box"><div class="pcf_card"><div class="pcf_msg"><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}</div><div class="pcf_grid">${PLACE_FLAGS.map(c => `<div role="button" tabindex="0" class="pcf_ok pcf_cty" data-v="${c.toUpperCase()}">${flagSvg(c, 26)}<span>${esc(FLAG_NAME[c])}</span></div>`).join('')}</div><div class="pcf_btns"><div role="button" tabindex="0" class="pcf_no">나중에</div><div role="button" tabindex="0" class="pcf_ok safe" data-v="other">다른 나라</div></div></div></div></div>`)[0];
            ask = { el, done: v => { ask = null; el.remove(); done(v); } };
            placeAsk();
            if (el.isConnected) el.querySelector('.pcf_no').focus({ preventScroll: true });
        });
    };
    // the clock in a zone now: the story's time where the owner is, moved by the zones' gap (today's)
    const zoneOff = tz => { try { const d = new Date(), q = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d).map(x => [x.type, x.value])); return Math.round((Date.UTC(q.year, q.month - 1, q.day, q.hour % 24, q.minute) - d.getTime()) / 6e4); } catch { return null; } };
    const clockIn = (p, tz) => {
        const base = placeInfo(p).owner.tz, a = zoneOff(tz), b = base ? zoneOff(base) : null, t = /(\d{2}):(\d{2})/.exec(String((live() ? storyNow(p, null, phoneMeta()) || p?.now : p?.now) || ''));
        if (a === null) return '';
        const mins = t && b !== null ? Number(t[1]) * 60 + Number(t[2]) + a - b : null;
        if (mins === null) { const d = new Date(Date.now() + a * 6e4); return `지금 ${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`; }
        const w = ((mins % 1440) + 1440) % 1440;
        return `지금 ${Math.floor(w / 60)}:${String(w % 60).padStart(2, '0')}`;
    };
    // a place's flag by the country its label starts with ("영국 케임브리지"), else by its zone's area
    // a long list of cities under a zone: its first three, so the line fits ("LA · 샌프란시스코 · 시애틀")
    const fewCities = t => { const xs = String(t || '').split(' · '); return xs.length > 3 && t.length > 18 ? xs.slice(0, 3).join(' · ') : t; };
    const flagOfLabel = label => Object.entries(FLAG_NAME).find(([, n]) => String(label).startsWith(`${n} `))?.[0] || '';
    // which zone a typed city is in, when the app can't tell: which of the places that name goes by, or which country (and
    // where in it, for a country with many clocks); resolves a zone, or '' (asked and answered nothing)
    const askZone = async (p, name, city, err) => {
        if (err.choices) {
            const v = await askPick(`어느 ${city}예요?`, `${name}의 도시`, err.choices.map(c => { const sp = /^(.*?) \((.*)\)$/.exec(c.label); return { v: c.tz, label: sp ? sp[1] : c.label, sub: fewCities(sp?.[2] || ''), time: clockIn(p, c.tz), flag: flagOfLabel(c.label) }; }));
            return v || '';
        }
        let code = await askCountry('어느 나라 도시예요?', `"${city}"는 모르는 도시예요`);
        if (!code) return '';
        if (code === 'other') { const t = await askInput('어느 나라예요?', '한국어 · 영어 · 두 글자 (독일, Germany, DE)'); if (!t) return ''; code = countryOf(t); }
        const zs = code ? countryZones(code) : [];
        if (!zs.length) { await askSheet('시간대를 찾지 못했어요', '다른 도시 이름이나 나라로 다시 적어 주세요.', '확인', true); return ''; }
        if (zs.length === 1) return zs[0].tz;
        const cc = code.toLowerCase(), country = FLAG_NAME[cc] || code;
        const v = await askPick(`${country} 어디쯤이에요?`, '시간대가 여러 개인 나라예요', zs.map(z => { const sp = /^(.*?) \((.*)\)$/.exec(z.label); return { v: z.tz, label: sp ? sp[1] : z.label, sub: fewCities(sp?.[2] || ''), time: clockIn(p, z.tz) }; }), FLAG_NAME[cc] ? cc : '');
        return v || '';
    };
    // 상태창 날짜 순서: asked once per chat before the first make or reflection (closing it reads 월.일 and asks again next time)
    const askDateOrder = async () => {
        if (!needsDateOrder(m)) return;
        const v = await askChoice('날짜를 어떻게 쓰세요?', '나중에 설정에서 바꿀 수 있어요.', [{ v: 'md', label: '월.일', sub: '11.03 = 11월 3일' }, { v: 'dm', label: '일.월', sub: '03.11. = 11월 3일' }]);
        if (v === 'md' || v === 'dm') await setDateOrder(m, v);
    };
    $root.on('click', '.pcf', function (e) { e.stopPropagation(); const b = e.target.closest('.pcf_ok, .pcf_no'); if (b) { const f = this.querySelector('.pcf_field'); ask?.done(b.classList.contains('pcf_ok') ? (f ? fieldVal(f) || (f.dataset.empty ? '' : false) : b.dataset.v || true) : false); } else if (e.target === this) ask?.done(false); });
    $root.on('paste', '.pcf_area', function (e) { e.preventDefault(); const t = (e.originalEvent?.clipboardData?.getData('text/plain') || '').replace(/\s+/g, ' '); document.execCommand('insertText', false, t); });
    $root.on('keydown', '.pcf_field', function (e) { e.stopPropagation(); if (e.key === 'Enter' && !e.originalEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); ask?.done(fieldVal(this) || false); } else if (e.key === 'Escape') ask?.done(false); });
    $root.on('keydown', '.pcf_ok, .pcf_no', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ask?.done(this.classList.contains('pcf_ok') ? (this.dataset.v || true) : false); } });
    const drawPhone = (keep = false) => {
        queueMicrotask(placeAsk);  // every way out of a redraw (some return early) puts the open sheet back
        const p = phone();
        // 실시간 with nobody on it (대화만 남기기 keeps the talk, not the phones): a way back to 타임라인 and to 새로 시작,
        // never the 타임라인 picker (its name would be the 타임라인's choice)
        if (live() && (!owner || !p)) { $root.find('.na_ph_frame').html(`<div class="na_ph_scr glass w_dusk"><div class="na_ph_body na_ph_make"><div class="na_ph_makecard"><b>이 실시간 폰엔 아직 인물이 없어요</b><button type="button" class="na_ph_cardbtn na_ph_pmode" data-v="story">타임라인으로</button><div class="na_ph_makelinks"><button type="button" class="na_ph_livereset">실시간 폰 새로 시작</button></div></div></div></div>`); return; }
        // nobody to show yet (no people in the archive, no phone in this chat): the picker opens instead of a blank phone
        if (!owner) {
            $root.find('.na_ph_frame').html(`
              <div class="na_ph_scr glass w_dusk"><div class="na_ph_sb"><span></span><i>${ic('sig', 15)}${ic('bat', 20, 1.6)}</i></div>
                <div class="na_ph_body na_ph_make">
                  <div class="na_ph_makecard na_ph_ownercard">
                    <span class="na_ph_noface">${ic('user', 30, 1.8)}</span>
                    <b>누구의 폰을 볼까요?</b>
                    <p>이 채팅엔 아직 인물이 없어요.<br>폰 주인의 이름을 적어 주세요</p>
                    <div class="na_ph_addbox na_ph_owneradd">
                      <input type="text" class="na_ph_addname" placeholder="인물 이름" enterkeyhint="done" autocomplete="off">
                      <button type="button" class="na_ph_makebtn na_ph_addok">이 인물의 폰 보기</button>
                    </div>
                  </div>
                </div></div>`);
            return;
        }
        // 메신저 시간대 opened from 폰 만들기 준비: the settings screen itself, back to the prep screen
        // 초안 모델 opened from 폰 만들기 준비: its screen, back to the prep screen
        if (!p && view === 'setdraftmodel') { $root.find('.na_ph_frame').html(screen(phonePre(m, owner) || pendingProfile(), view, m, roster, {})); return; }
        if (!p && view === 'setdraft') { $root.find('.na_ph_frame').html(screen(phonePre(m, owner) || pendingProfile(), view, m, roster, { draftBack: 'prep' })); return; }
        if (!p && view === 'setscreenholder') { $root.find('.na_ph_frame').html(screen(phonePre(m, owner) || pendingProfile(), view, m, roster, { holderBack: 'prep' })); return; }
        if (!p && view==='setprofile') {
            const draft=pendingProfile();
            $root.find('.na_ph_frame').html(screen(draft,view,m,roster,{profileState:profileStates.get(nameKey(owner))}));
            return;
        }
        // no phone yet: always 폰 만들기 준비 (the old 폰 만들기 card is gone; reopening the phone lands here too)
        if (!p && view !== 'prep' && view !== 'setdraft' && view !== 'setdraftmodel') { view = 'prep'; ensureScreenHolder(m).then(() => { if (!phoneClosed && !phone() && view === 'prep') drawPhone(true); }).catch(() => {}); }
        if (!p && view === 'prep') {
            const pre = phonePre(m, owner), key = nameKey(owner), bound = m.phoneProfiles?.[key], n = phoneLore(m).length;
            const stale = !pre ? '' : JSON.stringify(pre.financeProfile ?? null) !== JSON.stringify(bound ?? null) ? 'profile' : (pre.lore ?? loreKey()) !== loreKey() ? 'lore' : '';
            const top = keep ? $root.find('.ax_scroll').scrollTop() : 0;
            $root.find('.na_ph_frame').html(screen(pre || pendingProfile(), 'prep', m, roster, { prep: { pre: !!pre, open: !pre || prepOpen, profile: bound?.label || '', lore: n ? `${n}권` : '없음', loreN: n, gloss: glossaryEntries(m).length, order: dateOrderOf(m), holder: screenHolderLabel(m), stale, linking: prepLinking, making: busyMake === 'make' || phoneMaking(m, owner), draft: draftReady(), draftName: drLabel(), noArch: noArchive(m) } }));
            if (keep) $root.find('.ax_scroll').scrollTop(top);
            return;
        }
        if (!view.startsWith('thread:') || view !== msgView) { msgHeld = null; msgPick = null; msgView = view; }
        if (view !== 'setvoice' && !voiceBusy) voicePick = null;
        if (view === 'setvoice') voiceFill(p);
        if (view !== 'setvoiceadd' && !voiceBusy) voiceAdd = new Set();
        const top = keep ? $root.find('.na_ph_body, .ax_scroll').scrollTop() : 0;
        // a screen that can't be drawn says why (and in the console), instead of leaving the phone blank or on another screen
        let html;
        tidyKo(p);
        if (view === 'livestart' && (live() || liveWorld(realM))) view = 'set';
        try { html = screen(p, view, m, live() ? liveRoster() : roster, { ...orbitUi(), start: view === 'livestart' ? startPlan(p) : null, phones: { live: live(), has: !!liveWorld(realM), shift: shiftLabel(liveWorld(realM)?.dayShift), canUndo: live() && !!p && liveCanUndo(realM, p.owner), held: live() && !!p && Number.isInteger(p.liveHeld) && liveUnreflected(realM, p.owner) > 0, err: live() && p?.liveReflectError?.at ? viewerWall(p.liveReflectError.at, liveWorld(realM)?.dayShift || 0).at.slice(6) : '', names: live() ? liveNames() : null }, syncN: view === 'set' && !live() ? syncLeft(p, m) : null, syncRows: view.startsWith('setsync') ? syncRows() : [], syncWhy, syncPending, pickMore, loreExp, loreEnts, remake, contactBack, investing, profileState:profileStates.get(nameKey(p.owner)), placeReading, mapQ, msgHeld, msgPick, retr: retrKs, voicePick: view === 'setvoice' ? voicePick : null, voiceAdd, voiceBusy }); }
        catch (err) {
            console.error('[narrative-archive] phone screen', view, err);
            toastr.error(`${view} 화면을 그리지 못했어요: ${err?.message || err}`, '캐릭터 휴대폰');
            html = `<div class="na_ph_scr glass w_dusk"><div class="na_ph_body na_ph_make"><div class="na_ph_makecard"><b>화면을 그리지 못했어요</b><p>${esc(`${view}: ${err?.message || err}`)}</p><button type="button" class="na_ph_cardbtn" data-go="home">홈으로</button></div></div></div>`;
        }
        $root.find('.na_ph_frame').html(html);
        // 실시간: the notch says which phone this is on every screen; 타임라인's data rows go
        if (live()) { $root.find('.na_ph_frame .na_ph_scr').first().append('<span class="na_ph_notch" aria-label="실시간 폰"><i></i></span>'); $root.find(`.na_ph_frame :is(${LIVE_OFF})`).remove(); $root.find('.na_ph_frame .ax_card').filter((_, c) => !c.children.length && !c.textContent.trim()).remove(); }
        if (sheet && (view === 'photo' || view === 'set')) $root.find('.na_ph_scr').append(looksSheet(m));
        placeAsk();
        trPop();
        notchPasses();
        if (keep) $root.find('.na_ph_body, .ax_scroll').scrollTop(top);
        if (making && view === 'setremake') $root.find('.na_ph_setremake .ax_n').html(`${busyHtml} 다시 만드는 중`);
        // a redraw mid-reflection (or mid-make) keeps saying so: withSpinner only dressed the button that was there
        if (busyMake === 'sync' || busy.sync && busy.operation === 'reflect' && busy.scope === openingScope && nameKey(busy.owner) === nameKey(owner)) $root.find('.na_ph_setupd .ax_v').html(`${busyHtml} 반영하는 중`);
        if (busyMake === 'make' || phoneMaking(m, owner)) $root.find('.na_ph_makebtn:not(.na_ph_addok)').prop('disabled', true).html(`${busyHtml} 폰 만드는 중`);
        restoreFind();
        queueMicrotask(() => { autoChart(); autoMenu(); });
    };
    // 검색 in 메시지 · 메모 · 메일 · 음성 메모 · 일기: what is typed hides the rows (and the cards, and their titles) that don't
    // have it; kept while the screen is redrawn, gone when another screen opens
    let find = { v: '', q: '', open: false };
    const applyFind = () => {
        const sc = $root.find('.ax_scroll')[0], f = sc?.querySelector('.ax_find');
        if (!sc || !f) return;
        const q = find.q.trim().toLowerCase();
        f.querySelector('.ax_findx')?.classList.toggle('on', !!q);
        let shown = 0;
        for (const it of sc.querySelectorAll(':scope > .ax_card > *, :scope > .ax_dcard')) { const off = !!q && !it.textContent.toLowerCase().includes(q); it.style.display = off ? 'none' : ''; if (!off) shown++; }
        for (const c of sc.querySelectorAll(':scope > .ax_card')) if (!c.classList.contains('ax_mapart')) c.style.display = [...c.children].some(x => x.style.display !== 'none') ? '' : 'none';
        for (const s of sc.querySelectorAll(':scope > .ax_sec')) { const c = s.nextElementSibling; s.style.display = c?.classList.contains('ax_card') && c.style.display === 'none' ? 'none' : ''; }
        sc.querySelector('.ax_findnone')?.remove();
        if (q && !shown) f.insertAdjacentHTML('afterend', '<div class="ax_empty ax_findnone">찾는 게 없어요</div>');
    };
    const diaryFind = () => { const sc = $root.find('.ax_scroll')[0]; if (!sc || sc.querySelector('.ax_find')) return; const at = sc.querySelector('.ax_strip') || sc.querySelector('.ax_dymonth'); at?.insertAdjacentHTML('afterend', axFind('일기 검색')); };
    const restoreFind = () => {
        if (find.v !== view) find = { v: view, q: '', open: false };
        if (find.open && view === 'diary') diaryFind();
        const fq = $root.find('.ax_findq')[0];
        if (fq && find.q && fq.textContent !== find.q) fq.textContent = find.q;
        applyFind();
    };
    $root.on('input', '.ax_findq', function () { find = { ...find, v: view, q: this.textContent.replace(/\s+/g, ' ') }; applyFind(); });
    $root.on('keydown', '.ax_findq', function (e) { e.stopPropagation(); if (e.key === 'Enter' && !e.originalEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); this.blur(); } });
    $root.on('paste', '.ax_findq', function (e) { e.preventDefault(); const t = (e.originalEvent?.clipboardData?.getData('text/plain') || '').replace(/\s+/g, ' '); document.execCommand('insertText', false, t); });
    $root.on('click', '.ax_find', function (e) { if (e.target.closest('.ax_findx, .ax_findq')) return; e.stopPropagation(); this.querySelector('.ax_findq')?.focus(); });
    $root.on('click', '.ax_findx', function (e) { e.stopPropagation(); const f = $root.find('.ax_findq')[0]; if (!f) return; f.textContent = ''; find = { ...find, q: '' }; applyFind(); f.focus(); });
    $root.on('click', '.na_ph_dyfind', e => {
        e.stopPropagation();
        find = { v: view, q: '', open: !find.open };
        if (find.open) { diaryFind(); $root.find('.ax_findq').trigger('focus'); } else { $root.find('.ax_scroll .ax_find, .ax_findnone').remove(); applyFind(); }
        if (!find.open) for (const x of $root.find('.ax_scroll .ax_dcard')) x.style.display = '';
    });
    // 참고 로어북: each book with its switch; › opens its entries, each with its own (a book with some left out shows −)
    const LCK = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path class="na_ck_v" d="M5 12.5l4.5 4.5L19 7.5"/><path class="na_ck_p" d="M6 12h12"/></svg>';
    const loreSum = () => { const on = phoneLore(m); return on.length ? on.map(b => (loreOff(m, b).size ? `${b} (일부)` : b)).join(', ') : '없음 · 아카이브와 본문만 읽어요'; };
    // what 폰 만들기 준비's reading read of the lorebooks (phonedata's own key): a change asks for 위치 연동 again
    const loreKey = () => JSON.stringify(phoneLore(m).slice().sort().map(b => [b, [...loreOff(m, b)].sort()]));
    const loreRow = () => {
        const on = phoneLore(m);
        const all = loreOpen ? (ctx().getWorldInfoNames?.() || []) : [];
        const book = b => {
            const picked = on.includes(b), off = loreOff(m, b), ents = loreEnts.get(b), open = loreExp.has(b);
            const n = ents ? ents.length : 0, onN = picked ? (ents ? ents.filter(e => !off.has(e.uid)).length : null) : 0;
            return `
              <div class="na_ph_lorebook">
                <label class="na_ph_loreitem"><span class="na_ck ${picked && off.size ? 'part' : ''}"><input type="checkbox" class="na_ph_lorepick" value="${esc(b)}" ${picked ? 'checked' : ''}>${LCK}</span><span class="na_ph_lorename">${esc(b)}</span>${ents && picked && off.size ? `<small>${onN}/${n}</small>` : ''}</label>
                <button type="button" class="na_ph_loreexp ${open ? 'on' : ''}" data-b="${esc(b)}" aria-label="${open ? '항목 닫기' : '항목 보기'}" aria-expanded="${open}">${ic(open ? 'down' : 'right', 15, 2.2)}</button>
              </div>
              ${open ? `<div class="na_ph_loreents">${!ents ? `<small class="na_ph_lorewait">${busyHtml} 항목 읽는 중</small>` : ents.length ? ents.map(e => `
                <label class="na_ph_loreent"><span class="na_ck"><input type="checkbox" class="na_ph_loreentpick" data-b="${esc(b)}" data-u="${esc(e.uid)}" ${picked && !off.has(e.uid) ? 'checked' : ''}>${LCK}</span><span>${esc(e.title)}</span>${e.always ? '<em>항상</em>' : ''}</label>`).join('') : '<small class="na_ph_lorewait">쓸 수 있는 항목이 없어요</small>'}</div>` : ''}`;
        };
        return `
          <button type="button" class="na_ph_crow na_ph_lorebtn"><span><b>참고 로어북</b><small>${esc(loreSum())}</small></span>${ic(loreOpen ? 'down' : 'right', 16, 2.2)}</button>
          ${loreOpen ? `<div class="na_ph_lorelist">${all.length ? `<div class="na_ph_lorescroll">${all.map(book).join('')}</div>` : '<div class="na_empty">로어북이 없어요</div>'}<small>이 채팅의 모든 폰이 같이 읽어요 · 2만 토큰까지 통째로</small></div>` : ''}`;
    };
    // before there is a phone, the sheet has its lorebook (read when making it); after, all of it is in 설정
    const drawCtrl = () => {
        const p = phone();
        $root.find('.na_ph_ctrl').html(owner && !p ? loreRow() : '');
    };
    const draw = () => { drawOwners(); drawPhone(); drawCtrl(); };
    const make = async ($btn, update, prepared = false) => {
        // an older phone has no start yet, and a start whose message is gone is asked for again
        if (update) { const st = syncState(phone()); if (st !== 'ok') { syncWhy = st; pickMore = 30; view = 'setsyncpick'; drawPhone(); return; } }
        // a first phone is made from 폰 만들기 준비 (its date order is on it)
        if (!update && !phone() && !prepared) { prepOpen = false; view = 'prep'; await ensureScreenHolder(m); if (!phoneClosed && stillHere()) drawPhone(); return; }
        if (!prepared) await askDateOrder();
        busyMake = update ? 'sync' : 'make';
        let p;
        try { p = await withSpinner($btn, update ? '반영하는 중' : '폰 만드는 중', () => makePhone(m, owner, { update })); } finally { busyMake = null; if (!update) for (const fn of [...madeWatch]) fn(m, owner); if (!phoneClosed && stillHere()) drawPhone(true); }
        if (!p) return;
        if (!update) view = 'lock';
        draw();
        if (!update) return toastr.success(`${owner}의 폰을 만들었어요`, '캐릭터 휴대폰');
        const r = p.syncLast;
        // the shops nearby, every 3 story days and 3 reflections (or at once on a move to another saved city): on their own, after the reflection
        refreshNearby(m, p, { read: !!r?.checked }).then(n => { if (n && !phoneClosed && phone() === p && /^(dlv|delivery)/.test(view)) drawPhone(true); }).catch(err => toastr.warning(String(err?.message || err), '동네 가게'));
        if (!r?.checked) return toastr.info('새로 읽을 대화가 없어요', '캐릭터 휴대폰');
        koRun(p, false);
        const head = `${r.checked}개 확인 · 남은 ${r.remaining}개`;
        const owed = p.sync?.owed?.money?.length || 0;
        const tail = `${r.failed.length ? ` · 넣지 못한 일 ${r.failed.length}개` : ''}${owed ? ` · 메시지 ${owed}개의 결제는 다음 반영 때 다시` : ''}`;
        toastr[r.failed.length || owed ? 'warning' : r.apps.length ? 'success' : 'info'](`${r.apps.length ? `${r.apps.join(' · ')}에 넣었어요` : '새로 넣은 건 없어요'}${tail}`, head);
    };
    // Investment calls are explicit; navigation and unresolved quote conflicts never trigger them.
    const investRun = async checkStory => {
        if (making) return toastr.info('폰을 다시 만드는 중이에요');
        if (investing) return;
        const p = phone(), date = $root.find('.iv_date').val();
        investing = true; drawPhone(true);
        try { await (p.investment ? refreshMarket(m, p, date, checkStory) : fillInvestment(m, p, date)); }
        catch (err) { toastr.error(String(err?.message || err), '투자'); }
        finally { investing = false; if (phone() === p) drawPhone(true); }
    };
    $root.on('change', '.bank_display, .bank_fxdate', async function () {
        const p = phone(); if (!p?.money) return;
        if (this.classList.contains('bank_display')) p.money.displayCurrency = this.value;
        else { if (!validDate(this.value)) return toastr.warning('이야기 날짜를 입력해 주세요'); p.money.fxDate = this.value; }
        await saveMeta(); drawPhone(true);
    });
    // the date sits unseen over its strip: open its calendar on a tap anywhere there
    $root.on('click', '.bank_fxdate', function () { try { this.showPicker?.(); } catch { /* not allowed here */ } });
    $root.on('click', '.bank_fxrefresh', async function () {
        if (making) return toastr.info('폰을 다시 만드는 중이에요');
        if (investing) return;
        const p = phone(), date = $root.find('.bank_fxdate').val(), base = bankDisplayCurrency(p);
        investing = true;
        try { await withSpinner($(this),'',()=>refreshBankFX(m,p,date,base)); }
        catch (err) { toastr.error(String(err?.message || err),'환율'); }
        finally { investing = false; if (phone() === p) drawPhone(true); }
    });
    let chartAttempt = '', phoneClosed = false;
    // 동네 가게 메뉴: normally filled right after the delivery app; one that failed is asked once more when the app is opened
    const menuTried = new Set();
    const autoMenu = async () => {
        if (phoneClosed || making || !/^(dlv|delivery|dshop:)/.test(view)) return;
        const p = phone();
        if (!(p?.delivery?.shops || []).some(menuWanted) || menuTried.has(owner)) return;
        menuTried.add(owner);
        try { if (await fillShopMenus(m, p) && !phoneClosed && phone() === p) drawPhone(true); }
        catch (err) { if (!phoneClosed && phone() === p) toastr.error(String(err?.message || err), '배달 메뉴'); }
    };
    const autoChart = async () => {
        if (phoneClosed || making || investing || !view.startsWith('stock:')) return;
        const p = phone(); if (!p?.investment) return;
        const [symbol,range='1m'] = decodeURIComponent(view.slice(6)).split('~');
        const request = `${owner}|${p.investment.date}|${symbol}|${range}`;
        if (chartAttempt === request) return;
        chartAttempt = request; investing = true; drawPhone(true);
        try { await fillChartHistory(m,p,symbol,range); }
        catch(err) { if (!phoneClosed && phone() === p) toastr.error(String(err?.message || err),'차트'); }
        finally { investing=false; if (!phoneClosed) drawPhone(true); }
    };
    $root.on('click', '.iv_refresh', () => investRun(false));
    $root.on('click', '.iv_sync', () => investRun(true));
    $root.on('click', '.iv_records', async function () {
        if (making) return toastr.info('폰을 다시 만드는 중이에요');
        if (investing) return;
        const p = phone(), mode = 'records', target = this.dataset.target || '';
        investing = true; drawPhone(true);
        try {
            const got = await collectInvestmentRecords(m, p, mode, target);
            if (mode === 'records') toastr.info(got.schedules.length || got.history.length ? '투자 일정과 변경 기록을 확인했어요' : '새로 확인된 일정이나 변경 기록이 없어요');
        } catch (err) { toastr.error(String(err?.message || err), '투자 기록'); }
        finally { investing = false; if (phone() === p) drawPhone(true); }
    });
    $root.on('click', '.iv_select', async function () {
        try { selectPrice(m, this.dataset.key, this.dataset.date, this.dataset.id); await saveMeta(); drawPhone(true); }
        catch (err) { toastr.error(err.message); }
    });
    $root.on('click', '.iv_news', async function () {
        const p = phone(), inv = p.investment, symbol = this.dataset.symbol;
        const sec = inv?.securities.find(s => s.symbol === symbol); if (!sec) return;
        const query = inv.watch.find(w => w.symbol === symbol)?.query || `${sec.name} business news`;
        let k = p.searches.findIndex(x => x.investSymbol === symbol && x.investDate === inv.date);
        if (k < 0) { p.searches.push({ q: query, time: inv.date.slice(5), tab: true, src: 'guess', investSymbol: symbol, investDate: inv.date }); k = p.searches.length - 1; await saveMeta(); }
        view = `searchone:${k}`; drawPhone(); if (!p.searches[k].results?.length) loadSearch(k);
    });
    // the screen changes first; saving waits
    const profilePhone = () => phone() || pendingProfile();
    const profileRedraw = (p,state) => { if(!phoneClosed && profilePhone()===p && view==='setprofile' && profileStates.get(nameKey(p.owner))===state) drawPhone(true); };
    const loadProfile = async (p,state) => {
        const version = state.version = (state.version || 0)+1;
        state.busy=true; state.error=''; state.resolved=null; profileRedraw(p,state);
        try {
            const resolved=await resolvePhoneProfile(ctx(),{...state.binding});
            if(state.version === version) {state.resolved=resolved; if(!p.profileDraft && !p.device) loadDevice(p,state);}
        } catch(err) { if(state.version === version) state.error=String(err?.message || err); }
        finally { if(state.version === version) { state.busy=false; profileRedraw(p,state); } }
    };
    const loadProfileBook = async (p,state,book) => {
        if(state.books.has(book) && !state.books.get(book).error) return;
        state.books.set(book,{}); profileRedraw(p,state);
        try { state.books.set(book,{entries:await profileEntries(ctx(),book)}); }
        catch(err) { state.books.set(book,{error:String(err?.message || err)}); }
        profileRedraw(p,state);
    };
    const loadDevice = async (p,state) => {
        if(p.profileDraft || state.deviceBusy || p.device) return;
        state.deviceBusy=true;state.deviceError='';profileRedraw(p,state);
        try {await fillDevice(m,p);} catch(err) {state.deviceError=String(err?.message || err);}
        finally {state.deviceBusy=false;profileRedraw(p,state);}
    };
    $root.on('click','.fp_device',function(){const p=profilePhone(),state=profileStates.get(nameKey(p.owner));if(state) loadDevice(p,state);});
    $root.on('click','.fp_apps',function(){const p=profilePhone(),state=profileStates.get(nameKey(p.owner));if(state){state.pane='apps';drawPhone();}});
    const editProfile = () => {
        const p=profilePhone(); if(!p) return;
        const state={pane:p.profileDraft?'source':'about',binding:structuredClone(p.financeProfile || {type:'none'}),books:new Map(),openBooks:new Set(),openType:null};
        profileStates.set(nameKey(p.owner),state); loadProfile(p,state);
    };
    $root.on('click','.fp_open',function(){
        const p=profilePhone(),state=profileStates.get(nameKey(p.owner)); if(!state) return;
        state.pane='source';state.openType=state.binding.type==='none'?null:state.binding.type;
        if(state.binding.type==='lore') {state.openBooks.add(state.binding.book);loadProfileBook(p,state,state.binding.book);}
        drawPhone();
    });
    $root.on('click','.fp_back',()=>{if(profilePhone()?.profileDraft){view=prepFrom?'prep':'lock';prepFrom=false;drawPhone();}else editProfile();});
    $root.on('click','.fp_content',function(){
        const p=profilePhone(),state=profileStates.get(nameKey(p.owner)); if(!state) return;
        state.pane='content';drawPhone();
    });
    $root.on('click','.fp_source',async function(){
        const p=profilePhone(),state=profileStates.get(nameKey(p.owner)); if(!state) return;
        if(this.dataset.type==='persona') {
            const version=state.version=(state.version || 0)+1;
            state.binding={type:'none'};state.resolved=null;state.error='';state.busy=true;
            state.personaLoading=true;state.personaPicked=false;state.openType=null;state.openPreview=false;profileRedraw(p,state);
            try {
                const binding=await currentPersonaBinding(ctx());
                if(state.version!==version) return;
                state.binding=binding;state.personaPicked=true;state.personaLoading=false;
                await loadProfile(p,state);
            } catch(err) {
                if(state.version===version) {state.error=String(err?.message || err);state.busy=false;state.personaLoading=false;profileRedraw(p,state);}
            }
            return;
        }
        if(state.personaLoading) {state.version++;state.busy=false;state.personaLoading=false;}
        state.openType=state.openType===this.dataset.type?null:this.dataset.type;drawPhone(true);
    });
    $root.on('click','.fp_book',function(){
        const p=profilePhone(),state=profileStates.get(nameKey(p.owner)); if(!state) return;
        const book=this.dataset.book;
        if(state.openBooks.has(book)) state.openBooks.delete(book);
        else {state.openBooks.add(book);loadProfileBook(p,state,book);}
        drawPhone(true);
    });
    $root.on('click','.fp_pick',function(){
        const p=profilePhone(),state=profileStates.get(nameKey(p.owner)); if(!state) return;
        state.openPreview=false;state.personaPicked=false;
        state.binding={type:this.dataset.type,id:this.dataset.id,...(this.dataset.type==='lore'?{book:this.dataset.book}:{})};
        loadProfile(p,state);
    });
    $root.on('click','.fp_unlink',async function(){
        const p=profilePhone();if(!p) return;
        delete p.financeProfile;editProfile();await saveMeta();
    });
    $root.on('click','.fp_save',async function(){
        const p=profilePhone(),state=profileStates.get(nameKey(p.owner));
        if(!state || state.busy || !state.resolved || state.binding.type==='none') return;
        p.financeProfile={...state.binding,label:state.resolved.label};
        if(p.profileDraft) {(m.phoneProfiles ||= {})[nameKey(p.owner)]=structuredClone(p.financeProfile);view=prepFrom?'prep':'lock';prepFrom=false;}
        else state.pane='about';
        drawPhone();await saveMeta();
    });
    $root.on('click','.na_ph_makeprofile',()=>{prepFrom=false;view='setprofile';editProfile();drawPhone();});
    $root.on('click', '.na_ph_pick:not(.na_ph_addp), .ax_whopick', async function (e) { e.stopPropagation(); const same = owner === this.dataset.n; owner = this.dataset.n; if (live()) rememberLiveOwner(realM, owner, selectionKey); else rememberPhoneSelection(m,owner,selectionKey); if (!same) { view = 'lock'; sheet = false; draw(); setSheet(false); } await saveMeta(); });
    // Orbit: 목록 고르기 · 새 대화 사람 고르기 · 만들기 · 보내기 · 주인 보기 · 번역 접기
    const obDraw = () => { drawPhone(true); };
    const obBottom = () => { const e = $root.find('.ob_msgs')[0]; if (e) e.scrollTop = e.scrollHeight; };
    $root.on('click', '.na_ob_tab', function (e) { e.stopPropagation(); obTab = this.dataset.v || 'all'; obDraw(); });
    // (입력칸은 contenteditable: 테마가 <input>에 테두리를 칠해서. 지도 검색과 같은 방식) 초점은 화면을 밀지 않게, 글 끝에
    const obFocus = () => { const e = $root.find('.na_ob_in')[0]; if (!e) return; e.focus({ preventScroll: true }); try { const r = document.createRange(); r.selectNodeContents(e); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch { /* (no caret) */ } };
    $root.on('input', '.na_ob_gname', function () { obGname = this.textContent; });
    $root.on('input', '.na_ob_in', function () { obDraft = this.textContent; });
    $root.on('keydown', '.na_ob_gname', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); } });
    $root.on('paste', '.na_ob_in, .na_ob_gname', e => { e.preventDefault(); const t = (e.originalEvent?.clipboardData || window.clipboardData)?.getData('text') || ''; document.execCommand('insertText', false, t.replace(/\s+/g, ' ')); });
    $root.on('click', '.na_ob_pick', function (e) { e.stopPropagation(); const n = this.dataset.n, k = liveKey(n); obPick = obPick.some(x => liveKey(x) === k) ? obPick.filter(x => liveKey(x) !== k) : [...obPick, n]; obDraw(); });
    $root.on('click', '.na_ob_make', async function (e) {
        e.stopPropagation();
        if (!live() || !obPick.length) return;
        const r = ensureRoom(realM, obPick);
        if (obPick.length > 1 && obGname.trim()) nameRoom(realM, r.id, obGname);
        readLive(realM, r.id, liveWorld(realM).persona);
        obDraft = ''; view = `orbitroom:${r.id}`; draw(); obBottom();
        await saveMeta();
    });
    $root.on('click', '.na_ob_acct', function (e) { e.stopPropagation(); obSheet = !obSheet; drawPhone(true); });
    $root.on('click', '.na_ob_shade', function (e) { e.stopPropagation(); obSheet = false; drawPhone(true); });
    $root.on('click', '.na_ob_who', function (e) { e.stopPropagation(); obWho = this.dataset.n === liveWorld(realM)?.persona ? '' : this.dataset.n; obSheet = false; drawPhone(); });
    $root.on('click', '.na_ob_ko', function (e) { e.stopPropagation(); const id = this.dataset.id; if (obOpen.has(id)) obOpen.delete(id); else obOpen.add(id); const top = $root.find('.ob_msgs').scrollTop(); drawPhone(); $root.find('.ob_msgs').scrollTop(top); });
    // 답장 돌리기 (7-5): liveGo 하나가 다 해요(이미 돌면 그냥 돌아와요). 그리기는 이 채팅 · 실시간일 때만, 입력하던 칸은 그대로
    const obGo = () => liveGo(realM, { onChange: () => {
        if (phoneClosed || !stillHere() || !live()) return;
        const typingNow = document.activeElement?.classList?.contains('na_ob_in'), atEnd = (e => !e || e.scrollHeight - e.scrollTop - e.clientHeight < 40)($root.find('.ob_msgs')[0]);
        drawPhone(true);
        if (view.startsWith('orbitroom') && atEnd) obBottom();
        if (typingNow) obFocus();
    } }).catch(err => console.error('[narrative-archive] live go', err));
    // 반영(소망 결정): 메신저를 나갈 때만 · 폰을 닫을 때 · 타임라인으로 바꿀 때. 실시간 폰의 인물마다 쌓인 대화를 한 번에(읽을 게 없으면 바로 끝)
    const obReflect = () => { const w = liveWorld(realM); if (!w) return; (async () => { for (const p of Object.values(w.phones || {})) if (p?.owner) { const r = await liveReflect(realM, p.owner, { onChange: () => { if (!phoneClosed && stillHere() && live()) drawPhone(true); } }); if (r?.rounds) { const q = livePhone(realM, p.owner); if (q) await koRun(q, false, p.owner); } } })().catch(err => console.error('[narrative-archive] live reflect', err)); };
    // 실시간 폰 설정 › 지난 반영: 방금 반영 되돌리기 · 다시 반영 (다른 폰 작업 중엔 폰 1 되돌리기처럼 막아요)
    $root.on('click', '.na_live_undo', async e => {
        e.stopPropagation();
        if (!live()) return;
        if (making || busy.sync || busy.fill) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요');
        const p = phone(), n = p?.syncLast?.checked || 0;
        if (!p || !await askSheet('방금 반영을 되돌릴까요?', `대화 ${n}개를 다시 읽게 돼요.`, '되돌리기')) return;
        if (making || busy.sync || busy.fill || phone() !== p || !live()) return;
        try {
            const kept = await liveUndo(realM, p.owner, { onChange: () => { if (!phoneClosed && stillHere() && live()) drawPhone(true); } });
            if (!phoneClosed && stillHere()) drawPhone(true);
            kept.length ? toastr.warning(`되돌렸어요. ${kept.join(', ')}은(는) 그 사이 바뀌어서 남겨뒀어요`, '캐릭터 휴대폰') : toastr.success('반영을 되돌렸어요', '캐릭터 휴대폰');
        } catch (err) { toastr.warning(String(err?.message || err), '되돌리기'); }
    });
    $root.on('click', '.na_live_rerun', async e => {
        e.stopPropagation();
        if (!live()) return;
        if (making || busy.sync || busy.fill) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요');
        const p = phone();
        if (!p) return;
        try { await withSpinner($(e.currentTarget), '반영 중', () => liveReflect(realM, p.owner, { force: true, onChange: () => { if (!phoneClosed && stillHere() && live()) drawPhone(true); } })); }
        catch (err) { console.error('[narrative-archive] live reflect', err); }
        if (!phoneClosed && stillHere()) drawPhone(true);
    });
    const obSend = async () => {
        const r = roomNow(), t = String($root.find('.na_ob_in').text() || '').trim();
        if (!live() || !r || !t || obAcct() !== liveWorld(realM)?.persona) return;
        sendLive(realM, r.id, t);
        enqueueReplies(realM, r.id);
        obDraft = ''; drawPhone(); obBottom(); obFocus();
        await saveMeta();
        obGo();
    };
    $root.on('click', '.na_ob_retry', async function (e) {
        e.stopPropagation();
        const w = liveWorld(realM), j = w?.queue?.jobs?.find(x => x.id === this.dataset.id);
        if (!live() || !j) return;
        seeFailure(realM, j.id);
        if (w.messenger?.rooms?.[j.room]) enqueueReplies(realM, j.room);
        drawPhone(); obBottom();
        await saveMeta();
        obGo();
    });
    $root.on('click', '.na_ob_send', e => { e.stopPropagation(); obSend(); });
    $root.on('keydown', '.na_ob_in', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.originalEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); obSend(); } });
    // 실시간 폰 시작: 이야기에서(마지막 메시지까지) → 실시간 홈
    $root.on('click', '.na_ob_start', async function (e) {
        e.stopPropagation();
        const p = phone();
        if (live() || liveWorld(realM) || !p) return;
        if (making || busyMake || investing || koBusy || filling.size || busy.fill || busy.sync) return toastr.info('다른 폰 작업이 끝난 뒤 시작해 주세요', '캐릭터 휴대폰');
        const plan = startPlan(p), upto = Math.max(0, (ctx().chat?.length || 1) - 1);
        const st = chatStamp(upto);
        try { beginFromStory(realM, { persona: plan.persona, upto, scope: phoneChatScope(ctx()), dayShift: plan.dayShift, chat: st.chat, fp: st.fp }); }
        catch (err) { console.error('[narrative-archive] live start', err); return toastr.warning(String(err?.message || err), '캐릭터 휴대폰'); }
        setLiveMode(realM, 'live'); useMode(); owner = liveOwner(); view = 'home'; sheet = false;
        draw();
        await saveMeta();
    });
    // 실시간 폰 새로 시작 (5-2): 대화만 남기기 · 전부 지우기, 늘 사람이 골라요
    $root.on('click', '.na_ph_livereset', async function (e) {
        e.stopPropagation();
        if (!live()) return;
        if (making || busyMake || investing || koBusy || filling.size || busy.fill || busy.sync) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요', '캐릭터 휴대폰');
        const how = await askChoice('실시간 폰 새로 시작', '', [{ v: 'chats', label: '대화만 남기기' }, { v: 'all', label: '전부 지우기', danger: true }], '취소');
        if (how !== 'chats' && how !== 'all') return;
        // 대화만 남기기: the talk stays, the phones begin again from the 타임라인 phones as they are now (as 시작 does);
        // still 실시간. With no 타임라인 phone there is nothing to begin from: 폰 2 stays as it was
        if (how === 'chats') {
            const lw = liveWorld(realM), base = realM.phones?.[nameKey(lw?.lastOwner)] || Object.values(realM.phones || {}).find(p => p?.owner);
            const upto = Math.max(0, (ctx().chat?.length || 1) - 1), st = chatStamp(upto);
            let w = null;
            try { w = rebeginKeepingChats(realM, { upto, scope: phoneChatScope(ctx()), dayShift: base ? startPlanOf(base).dayShift : 0, chat: st.chat, fp: st.fp }); }
            catch (err) { return toastr.error(String(err?.message || err), '캐릭터 휴대폰'); }
            if (!w) return toastr.info('타임라인 폰을 먼저 만들어 주세요', '캐릭터 휴대폰');
            obWho = ''; useMode();
            owner = liveOwner(); view = 'set'; sheet = false;
            draw();
            await saveMeta();
            obGo();
            return;
        }
        resetLive(realM, how); obWho = ''; useMode();
        owner = selectedPhoneOwner(realM, names, null, readPhoneSelection(selectionKey)); view = 'set'; sheet = false;
        draw();
        await saveMeta();
    });
    // 설정 › 휴대폰: 타임라인 (폰 1) · 실시간 (폰 2); 실시간 only once there is one
    $root.on('click', '.na_ph_pmode', async function (e) {
        e.stopPropagation();
        const to = this.dataset.v === 'live' ? 'live' : 'story';
        if (to === liveMode(realM)) return;
        // (실시간 폰이 아직 없으면: 실시간을 고르면 시작 화면)
        if (to === 'live' && !liveWorld(realM)) { view = 'livestart'; sheet = false; draw(); return; }
        if (making || busyMake || investing || koBusy || filling.size || busy.fill || busy.sync) return toastr.info('다른 폰 작업이 끝난 뒤 바꿔 주세요', '캐릭터 휴대폰');
        const fromLive = live();
        setLiveMode(realM, to);
        useMode();
        if (fromLive && to === 'story') obReflect();
        owner = to === 'live' ? liveOwner() : selectedPhoneOwner(m, names, null, readPhoneSelection(selectionKey));
        view = 'set'; sheet = false;
        draw();
        await saveMeta();
        if (to === 'live') obGo();
    });
    $root.on('click', '.na_ph_makewho', () => { loreOpen = false; drawCtrl(); setSheet(true); });
    // a person only the lorebook knows: into the same list as 인물 도감's +
    $root.on('click', '.na_ph_addp', () => { adding = !adding; drawOwners(); if (adding) { setSheet(true); $root.find('.na_ph_addname').trigger('focus'); } });
    const addPerson = async el => {
        const v = String($(el).closest('.na_ph_addbox').find('.na_ph_addname').val() || '').trim();
        if (!v) return;
        const have = names.find(n => nameKey(n) === nameKey(v));
        if (!have) { m.people = [...(Array.isArray(m.people) ? m.people : []), v]; names.push(v); roster.add(nameKey(v)); }
        owner = have || v; if (!live()) rememberPhoneSelection(m,owner,selectionKey); adding = false; view = 'lock'; sheet = false;
        $root.find('.na_ph_addname').val('');
        draw();
        setSheet(false);
        await saveMeta();
    };
    $root.on('click', '.na_ph_gocompress', async e => {
        e.stopPropagation();
        document.getElementById('na_phl')?.close();
        try { const { showTab } = await import('./panel.js'); showTab('compress'); } catch (err) { console.error('[narrative-archive] compress tab', err); }
    });
    $root.on('click', '.na_ph_addok', function (e) { e.stopPropagation(); addPerson(this); });
    $root.on('keydown', '.na_ph_addname', function (e) { if (e.key === 'Enter' && !e.originalEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); addPerson(this); } });
    $root.on('click', '.na_ph_makelore', () => { loreOpen = true; drawCtrl(); setSheet(true); showOpened('.na_ph_lorelist'); });
    $root.on('click', '.na_phl_shade', () => setSheet(false));
    // what opens in the sheet scrolls into sight, so the tap visibly does something
    const showOpened = sel => setTimeout(() => $root.find(sel)[0]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);
    $root.on('click', '.na_ph_lorebtn', () => { loreOpen = !loreOpen; drawCtrl(); if (loreOpen) setTimeout(() => $root.find('.na_ph_lorelist')[0]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0); });
    // the list is drawn again on every switch; where it was scrolled to stays
    const redrawLore = () => { const top = $root.find('.na_ph_lorescroll').scrollTop(); drawCtrl(); $root.find('.na_ph_lorescroll').scrollTop(top); if (view === 'setlore' || view === 'prep') drawPhone(true); };
    const setOff = (b, uids) => { m.phoneLoreOff = m.phoneLoreOff && typeof m.phoneLoreOff === 'object' ? m.phoneLoreOff : {}; if (uids.size) m.phoneLoreOff[b] = [...uids]; else delete m.phoneLoreOff[b]; };
    const setOn = (b, yes) => { const set = new Set(phoneLore(m)); if (yes) set.add(b); else set.delete(b); m.phoneLore = [...set]; };
    // a whole book: on with every entry, or off
    const pickBook = async (b, yes) => { setOn(b, yes); setOff(b, new Set()); redrawLore(); await saveMeta(); };
    $root.on('change', '.na_ph_lorepick', function () { pickBook(this.value, this.checked); });
    $root.on('click', '.ax_lbon', function (e) { e.stopPropagation(); pickBook(this.dataset.b, !phoneLore(m).includes(this.dataset.b) || loreOff(m, this.dataset.b).size > 0); });
    $root.on('click', '.ax_lb .ax_tx', function (e) { e.stopPropagation(); $(this).siblings('.ax_lbx').trigger('click'); });
    $root.on('click', '.na_ph_loreexp, .ax_lbx', async function (e) {
        e.stopPropagation();
        const b = this.dataset.b;
        if (loreExp.has(b)) { loreExp.delete(b); return redrawLore(); }
        loreExp.add(b); redrawLore();
        if (loreEnts.has(b)) return;
        let data = null;
        try { data = await ctx().loadWorldInfo(b); } catch { /* a book that is gone */ }
        loreEnts.set(b, Object.entries(data?.entries || {})
            .filter(([, e]) => String(e?.content || '').trim() && !e.disable)
            .map(([uid, e]) => ({ uid: String(e.uid ?? uid), title: String(e.comment || (e.key || []).join(', ') || String(e.content).slice(0, 40)).trim(), always: !!e.constant })));
        redrawLore();
    });
    const pickEntry = async (b, u, yes) => {
        const ents = loreEnts.get(b) || [];
        const wasOn = phoneLore(m).includes(b);
        // an entry ticked in a book that was off: that book, with only this entry
        const off = wasOn ? loreOff(m, b) : new Set(ents.map(e => e.uid));
        if (yes) off.delete(u); else off.add(u);
        const left = ents.filter(e => !off.has(e.uid)).length;
        setOn(b, left > 0); setOff(b, left > 0 ? off : new Set());
        redrawLore();
        await saveMeta();
    };
    $root.on('change', '.na_ph_loreentpick', function () { pickEntry(this.dataset.b, this.dataset.u, this.checked); });
    $root.on('click', '.ax_le[data-u]', function (e) { e.stopPropagation(); const b = this.dataset.b, u = this.dataset.u; pickEntry(b, u, !(phoneLore(m).includes(b) && !loreOff(m, b).has(u))); });
    $root.on('click', '.na_ph_frame [data-go]', function (e) {
        const go = this.dataset.go;
        if (!go) return;
        if (go === 'stock') chartAttempt = '';
        e.stopPropagation();
        // a person's card goes back where it was opened from
        if (go === 'contact' && !view.startsWith('contact')) contactBack = view;
        // picking another payment on 고정 지출 keeps the list where it was
        const stay = ['fixed', 'banksend', 'stmt', 'wallet', 'stime', 'map'].includes(go) && view.split(':')[0] === go ? $root.find('.ax_scroll').scrollTop() : null;
        const wasOrbit = view.startsWith('orbit');
        if (go === 'orbitnew') { obPick = []; obGname = ''; }
        if (go === 'orbitroom' && this.dataset.i) { obDraft = ''; const w = liveWorld(realM); if (w?.messenger?.rooms?.[this.dataset.i] && obAcct() === w.persona) { readLive(realM, this.dataset.i, w.persona); saveMeta(); } }
        if (go === 'orbit') obSheet = false;
        if (this.closest('.ob_w')) obWho = '';   // (홈 위젯은 늘 페르소나의 방)
        view = ['setlang', 'orbitroom', 'ivnotes', 'ivschedule', 'ivhistory', 'stock', 'ivprices', 'thread', 'groupinfo', 'draft', 'page', 'acct', 'tx', 'txdoc', 'card', 'pass', 'order', 'track', 'voiceone', 'callwho', 'contact', 'noteone', 'photoone', 'searchone', 'calone', 'mailone', 'diaryone', 'snspost', 'alarm', 'hsteps', 'hsleep', 'hwork', 'hheart', 'hwater', 'hweight', 'folder', 'file', 'wcity', 'dshop', 'dorder', 'ditem', 'drate', 'mapc'].includes(go) || (['cal', 'diary', 'shop', 'voice', 'invest', 'health', 'fixed', 'banksend', 'stmt', 'wallet', 'stime', 'map', 'mapq', 'mail'].includes(go) && this.dataset.i) ? `${go}:${['ivnotes', 'ivschedule', 'ivhistory', 'stock', 'ivprices'].includes(go) ? encodeURIComponent(this.dataset.i || '') : this.dataset.i}` : go;
        const mail = go === 'mailone' ? phone()?.mails?.[Number(this.dataset.i)] : null;
        if (mail?.unread) { mail.unread = false; saveMeta(); }
        const p0 = phone();
        const th = go === 'thread' ? p0?.threads?.[Number(this.dataset.i)] : null;
        if (th && threadNew(th)) { th.seen = lastSig(th); saveMeta(); }
        const calls = go === 'call' || go === 'callmiss' ? (p0?.calls || []).filter(c => c.type === 'missed' && !c.seen) : [];
        if (calls.length) { calls.forEach(c => { c.seen = true; }); saveMeta(); }
        const posts = go === 'sns' ? (p0?.posts || []).filter(x => !x.seen) : [];
        if (posts.length) { posts.forEach(x => { x.seen = true; }); saveMeta(); }
        // 도시 찾기: a fresh search from the map; a town opened goes first among the recent ones
        if (go === 'mapq' && !view.startsWith('mapq:') && this.closest('.mq_wx') === null) mapQ = '';
        if (go === 'mapc' && p0) { const n = placeNames(Number(String(this.dataset.i).split('~')[0]))?.ko; if (n && p0.mapSeen?.[0] !== n) { p0.mapSeen = [n, ...(p0.mapSeen || []).filter(x => x !== n)].slice(0, 5); saveMeta(); } }
        sheet = false;
        drawPhone();
        if (wasOrbit && !view.startsWith('orbit') && live()) obReflect();
        $root.find('.na_ph_body, .ax_scroll').scrollTop(view.startsWith('thread') || view.startsWith('orbitroom') ? 1e6 : stay ?? 0);
        if (view === 'mapq' && !mapQ) $root.find('.mq_in').trigger('focus');
        if (go === 'searchone' && !phone()?.searches?.[Number(this.dataset.i)]?.results?.length) loadSearch(Number(this.dataset.i));
        if (go === 'page') openWeb(String(this.dataset.i));
        if (go === 'setprofile') editProfile();
    });
    // 도시 찾기: the results follow the typing (only the results are drawn again, so the field keeps its focus)
    const mapType = el => { mapQ = el.textContent.replace(/\s+/g, ' '); const p = phone(); if (!p) return; $root.find('.mq_res').html(mapResults(p, m, mapQ)).scrollTop(0); const land = !!$root.find('.mq_res .mq_land').length; $root.find('.mq_sheet').toggleClass('mq_cty', land).toggleClass('mq_full', !land && !!mapQ.trim()); $root.find('.mq_x').toggleClass('on', !!mapQ); };
    $root.on('input', '.mq_in', function () { mapType(this); });
    $root.on('keydown', '.mq_in', function (e) { e.stopPropagation(); if (e.key === 'Enter' && !e.originalEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); $root.find('.mq_res [data-go]').first().trigger('click'); } });
    $root.on('click', '.mq_x', function (e) { e.stopPropagation(); const f = $root.find('.mq_in')[0]; if (!f) return; f.textContent = ''; mapType(f); f.focus(); });
    // a paste is plain text on one line (the field is an editable div)
    $root.on('paste', '.mq_in', function (e) { e.preventDefault(); const t = (e.originalEvent?.clipboardData?.getData('text/plain') || '').replace(/\s+/g, ' '); document.execCommand('insertText', false, t); });
    // the page is made once, the first time a search is opened; the screen can change while it loads
    const loadSearch = async k => {
        const p = phone(), id = `${nameKey(p.owner)}:${k}`;
        if (searching.has(id)) return;
        searching.add(id); drawPhone(true);
        try { await searchPage(m, p, k); }
        catch (err) { console.error('[narrative-archive] search', err); toastr.error(String(err?.message || err), '검색 결과 실패'); }
        finally { searching.delete(id); if (phone() === p) drawPhone(true); }
    };
    $root.on('click', '.na_ph_sgo', e => { e.stopPropagation(); loadSearch(Number(view.split(':')[1])); });
    // a result opened: the tab remembers it, the history lists it, and its page is written the first time
    const openWeb = async key => {
        const p = phone(), [k, r] = key.split('.').map(Number), x = p?.searches?.[k], res = x?.results?.[r];
        if (!res) return;
        const seen = new Set(x.seen || []);
        if (x.at !== r || !seen.has(r)) { x.at = r; seen.add(r); x.seen = [...seen]; saveMeta(); }
        if (res.page) return;
        const id = `${nameKey(p.owner)}:${key}`;
        if (paging.has(id)) return;
        paging.add(id); drawPhone(true);
        try { await webPage(m, p, k, r); }
        catch (err) { console.error('[narrative-archive] web page', err); toastr.error(String(err?.message || err), '페이지 열기 실패'); }
        finally { paging.delete(id); if (phone() === p) drawPhone(true); }
    };
    // a line cut short: a tap lets it run left to its end, and back
    $root.on('click', '.lf_mq', function (e) {
        e.stopPropagation();
        const t = this.firstElementChild, over = t ? t.scrollWidth - this.clientWidth : 0;
        if (over <= 2) return;
        this.style.setProperty('--mq', `-${over + 6}px`);
        this.style.setProperty('--mqd', `${Math.max(2.5, over / 40)}s`);
        this.classList.remove('run'); void this.offsetWidth; this.classList.add('run');
    });
    $root.on('click', '.na_ph_pgo', e => { e.stopPropagation(); openWeb(view.split(':')[1]); });
    // a page scrolled down: the dock folds to its address; scrolling back up (or a tap on it) unfolds it
    $root[0].addEventListener('scroll', e => {
        const el = e.target;
        if (!el.classList?.contains('wb_pg')) return;
        const dock = el.parentElement?.querySelector('.wb_dock');
        const y = el.scrollTop, last = Number(el.dataset.y || 0);
        if (dock && Math.abs(y - last) > 8) { dock.classList.toggle('wb_fold', y > last && y > 80); el.dataset.y = String(y); }
    }, true);
    $root.on('click', '.wb_dock.wb_fold', function (e) { e.stopPropagation(); this.classList.remove('wb_fold'); });
    $root.on('click', '.na_ph_looksbtn, .na_ph_looksbtn2', e => { e.stopPropagation(); sheet = true; drawPhone(true); });
    $root.on('click', '.na_ph_shutter', async e => {
        e.stopPropagation();
        const p = phone(), id = nameKey(p.owner);
        if (shooting.has(id)) return;
        shooting.add(id); drawPhone();
        try { const k = await takePhoto(m, p); if (phone() === p) view = `cam:${k}`; toastr.success('사진을 찍었어요', '캐릭터 휴대폰'); }
        catch (err) { console.error('[narrative-archive] camera', err); toastr.error(String(err?.message || err), '사진 찍기 실패'); }
        finally { shooting.delete(id); drawPhone(); }
    });
    $root.on('click', '.na_ph_lclose', e => { e.stopPropagation(); sheet = false; drawPhone(true); });
    // each box is kept as it is left
    $root.on('change', '.na_ph_lta[data-n]', function () {
        const g = globalSettings(), v = String(this.value || '').replace(/\s+/g, ' ').trim();
        g.looks = g.looks && typeof g.looks === 'object' ? g.looks : {};
        if (v) g.looks[nameKey(this.dataset.n)] = v; else delete g.looks[nameKey(this.dataset.n)];
        saveGlobal();
    });
    // a long press on 한국어 translates the app on screen again, all of it (a short one turns it on or off, as before)
    let koHold = null, koHeld = false;
    $root.on('pointerdown', '.na_ph_kochip:not(.na_ph_looksbtn)', e => {
        koHeld = false; clearTimeout(koHold);
        const $b = $(e.currentTarget);
        koHold = setTimeout(async () => {
            koHeld = true;
            const p = phone();
            if (!p || making || koBusy) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요');
            // (this screen's lines only: one chat, one note, one page …; a list screen its app's newest 40; 설정 the whole phone, asked first)
            const scope = koScopeOf(p, view), only = koAppOf(view), pick = scope || (only ? g => only(g.app) : null);
            if (pick && !koGaps(p, { all: true }).some(pick)) return; // (nothing on this screen to translate again: quietly nothing)
            if (!pick && !await askSheet('폰 전체를 다시 번역할까요?', '지금 한국어가 전부 새 번역으로 바뀌어요.', '다시 번역')) return;
            let n = 0;
            koBusy = true;
            try { n = await withSpinner($b, '다시 번역 중', async () => { try { await learnVoices(m, owner, p, { all: true }); } catch (err) { console.warn('[narrative-archive] voices', err); } return redoKo(p, pick, !scope && only ? { max: 40, newest: true } : {}); }); if (p.syncLast?.trFailed) delete p.syncLast.trFailed; await saveMeta(); }
            catch (err) { toastr.warning(`다시 번역하지 못했어요 · 원래 한국어는 그대로예요 (${String(err?.message || err)})`, '캐릭터 휴대폰'); }
            finally { koBusy = false; }
            const g = globalSettings(); g.phoneKo = true; saveGlobal();
            if (!phoneClosed && phone() === p) drawPhone(true);
            if (n) toastr.success(`${n}개를 다시 번역했어요`, '캐릭터 휴대폰');
        }, 600);
    });
    $root.on('pointerup pointerleave pointercancel', '.na_ph_kochip:not(.na_ph_looksbtn)', () => clearTimeout(koHold));
    $root.on('contextmenu', '.na_ph_kochip:not(.na_ph_looksbtn)', e => e.preventDefault());
    $root.on('click', '.na_ph_kochip:not(.na_ph_looksbtn)', async e => {
        e.stopPropagation();
        // (the click a long press ends with does nothing more)
        if (koHeld) { koHeld = false; return; }
        // something still without its Korean: 한국어 fills it (and stays on) instead of turning off
        const p = phone();
        if (p && koGaps(p).length && !making) { if (koBusy) return; await withSpinner($(e.currentTarget), '번역 중', () => koRun(p, true)); const g = globalSettings(); g.phoneKo = true; saveGlobal(); return; }
        const g = globalSettings(); g.phoneKo = !koOn(); drawPhone(); if (view.startsWith('thread')) $root.find('.ax_scroll').scrollTop(1e6); saveGlobal();
    });
    $root.on('click keydown', '.na_ph_trok', async e => {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault(); e.stopPropagation();
        if (koBusy) return; if (making) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요');
        const p = phone(); if (!p) return;
        const run = koRun(p, true); $(e.currentTarget).html(`${busyHtml} 번역 중`); await run;
    });
    $root.on('click keydown', '.na_ph_trno', async e => {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault(); e.stopPropagation();
        const p = phone(); if (p?.syncLast) { p.syncLast.trSeen = true; await saveMeta(); }
        $root.find('.na_ph_trpop').remove();
    });
    // 이번 반영 다시 번역: only what the last reflection put in
    $root.on('click', '.na_sync_retr', async e => {
        e.stopPropagation();
        const p = phone();
        if (!p || making || koBusy) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요');
        const pick = roundScope(p);
        if (!pick || !koGaps(p, { all: true }).some(pick)) return toastr.info('이번 반영엔 다시 번역할 게 없어요', '캐릭터 휴대폰');
        let n = 0;
        koBusy = true;
        try { n = await withSpinner($(e.currentTarget), '다시 번역 중', () => redoKo(p, pick)); if (p.syncLast?.trFailed) delete p.syncLast.trFailed; await saveMeta(); }
        catch (err) { toastr.warning(`다시 번역하지 못했어요 · 원래 한국어는 그대로예요 (${String(err?.message || err)})`, '캐릭터 휴대폰'); }
        finally { koBusy = false; }
        if (!phoneClosed && phone() === p) drawPhone(true);
        if (n) toastr.success(`이번 반영 ${n}개를 다시 번역했어요`, '캐릭터 휴대폰');
    });
    $root.on('click', '.na_sync_tr', async e => { e.stopPropagation(); if (making) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요'); await withSpinner($(e.currentTarget), '번역 중', () => koRun(phone(), true)); });
    $root.on('click', '.na_ph_makebtn', function () { make($(this), false); });
    // 폰 만들기 준비
    const prepBusy = () => { if (!(making || busyMake || phoneMaking(m, owner) || investing || filling.size || busy.fill || busy.sync || placeReading || prepLinking)) return false; toastr.info('하던 일이 끝난 뒤 해 주세요', '캐릭터 휴대폰'); return true; };
    // 준비 화면's back: the phone picker (whose phone, or another person) — there is no screen behind it without a phone
    // 1 · 초안 모델: the extension's own setting (확장 설정 › AI 모델 › 초안 모델); the phone closes to show it
    $root.on('click', '.na_ph_prepdraft', e => { e.stopPropagation(); view = 'setdraft'; drawPhone(); });
    // 초안 모델's own screen (setDraft): each row asks in the phone's alert; a change clears the last test, saves the extension's
    // settings and redraws them in the panel too
    const draftDone = async () => {
        delete draftSettings().okAt; saveGlobal();
        try { (await import('./panelcfg.js')).renderAiSettings(); } catch { /* the panel isn't open */ }
        if (!phoneClosed) drawPhone(true);
    };
    $root.on('click', '.na_ph_drset', async function (e) {
        e.stopPropagation(); const t = draftSettings(), k = this.dataset.k;
        if (k === 'mode') {
            const v = await askChoice('방식', '', [{ v: 'same', label: '쓰지 않음' }, { v: 'custom', label: '커스텀 API' }, { v: 'vertex', label: 'Gemini · Vertex AI' }], '취소');
            if (!v || v === true) return; t.mode = v; return draftDone();
        }
        if (k === 'fmt') {
            const v = await askChoice('형식', '', [{ v: 'auto', label: '주소 보고 자동' }, { v: 'openai', label: 'OpenAI 호환' }, { v: 'anthropic', label: 'Anthropic' }], '취소');
            if (!v || v === true) return; t.fmt = v === 'auto' ? '' : v; delete t.models; delete t.noEffort; delete t.leanHeaders; return draftDone();
        }
        if (k === 'model' || k === 'vxModel') {
            if (k === 'model' && !(await draftLoad($(this).find('.ax_v')))) return;
            if (k === 'vxModel' && !vxModelList().length) return toastr.warning('실리태번의 Vertex 모델 목록을 못 찾았어요', '초안 모델');
            view = 'setdraftmodel'; return drawPhone();
        }
        const ask = { url: ['주소', 'https://api.example.com/v1 처럼 적어요.', t.url], key: ['API 키', t.key ? `지금 키는 …${String(t.key).slice(-4)}예요. 새 키를 적어요.` : 'API 키를 적어요.', ''], vxLocation: ['지역', '비우면 실리태번 설정을 따라요.', t.vxLocation] }[k];
        if (!ask) return;
        const v = await askInput(ask[0], ask[1], String(ask[2] || ''));
        if (!v) return;
        if (k === 'url' && v !== t.url) { delete t.models; delete t.noEffort; delete t.leanHeaders; }
        t[k] = v.trim(); return draftDone();
    });
    // the address's models, loaded (needs the address); false when there are none
    const draftLoad = async $at => {
        const t = draftSettings();
        if (!t.url) { toastr.warning('주소를 먼저 적어 주세요', '초안 모델'); return false; }
        const got = await withSpinner($at, '불러오는 중', () => listModels(t));
        if (!got?.length) { if (got) toastr.warning('이 주소에서 모델을 못 불러왔어요', '초안 모델'); return false; }
        t.models = got; saveGlobal(); return true;
    };
    $root.on('click', '.na_ph_drload', async function (e) { e.stopPropagation(); if (await draftLoad($(this).find('.ax_n'))) drawPhone(true); });
    $root.on('click', '.na_ph_drpick', async function (e) { e.stopPropagation(); draftSettings()[draftKey()] = this.dataset.id; view = 'setdraft'; await draftDone(); });
    $root.on('click', '.na_ph_drtest', async function (e) {
        e.stopPropagation();
        const out = await withSpinner($(this).find('.ax_n'), '확인하는 중', () => askDraft('Reply with one short sentence: which model are you?', { maxTokens: 300 }));
        if (!out) return;
        const d = new Date(), two = n => String(n).padStart(2, '0'), md = [two(d.getMonth() + 1), two(d.getDate())]; // (the date as the phone reads dates: 월.일 or 일.월)
        draftSettings().okAt = `${(dateOrderOf(m) === 'dm' ? md.reverse() : md).join('.')}. ${two(d.getHours())}:${two(d.getMinutes())}`;
        saveGlobal(); toastr.success(out.slice(0, 160), `${drLabel()} 연결됨`);
        if (!phoneClosed) drawPhone(true);
    });
    $root.on('click', '.na_ph_prepclose', e => { e.stopPropagation(); prepOpen = false; loreOpen = false; drawCtrl(); setSheet(true); });
    $root.on('click', '.na_ph_prepopen', e => { e.stopPropagation(); prepOpen = !prepOpen; drawPhone(true); });
    $root.on('click', '.na_ph_prepprofile', e => { e.stopPropagation(); if (prepBusy()) return; prepFrom = true; view = 'setprofile'; editProfile(); drawPhone(); });
    $root.on('click', '.na_ph_prepholder', e => { e.stopPropagation(); if (prepBusy()) return; view = 'setscreenholder'; drawPhone(); });
    // 위치 연동: the model once (the reading of where everyone is and the year), again when asked
    $root.on('click', '.na_ph_preplink', async e => {
        e.stopPropagation(); if (prepBusy()) return;
        if (needsDateOrder(m)) await setDateOrder(m, dateOrderOf(m));
        prepLinking = true; drawPhone(true);
        try { await preparePhone(m, owner, { again: !!phonePre(m, owner) }); prepOpen = false; }
        catch (err) { toastr.error(String(err?.message || err), '위치 연동'); }
        finally { prepLinking = false; if (!phoneClosed && stillHere()) drawPhone(true); }
    });
    $root.on('click', '.na_ph_prepmake', async function (e) {
        e.stopPropagation(); if (prepBusy()) return;
        const pre = phonePre(m, owner); if (!pre) return;
        const o = placeInfo(pre).owner;
        // no city or no zone: the phone would have no hours apart
        if (!o.city || !o.tz) {
            const v = await askPair('폰 주인 위치 없이 만들까요?', '시차 없이 만들어져요.', '위치 적기', '이대로 만들기');
            if (v === 'a') return placeCity(o.name || owner, '');
            if (v !== 'b') return;
        }
        if (needsDateOrder(m)) await setDateOrder(m, dateOrderOf(m));
        prepOpen = false;
        await make($(this), false, true);
    });
    // the screen can change while it writes; the new entry opens if its app is still showing
    $root.on('click', '.na_ph_write', async function (e) {
        e.stopPropagation();
        const p = phone(), kind = this.dataset.k, id = `${nameKey(p.owner)}:${kind}`;
        if (writing.has(id)) return;
        writing.add(id); drawPhone(true);
        try {
            const k = await writeEntry(m, p, kind);
            if (phone() === p && [kind, `${kind}one`].includes(view.split(':')[0])) view = `${kind === 'diary' ? 'diaryone' : 'noteone'}:${k}`;
            toastr.success(kind === 'diary' ? '일기를 썼어요' : '메모를 썼어요', '캐릭터 휴대폰');
        } catch (err) { console.error('[narrative-archive] write', err); toastr.error(String(err?.message || err), kind === 'diary' ? '일기 쓰기 실패' : '메모 쓰기 실패'); }
        finally { writing.delete(id); if (phone() === p) drawPhone(); }
    });
    // 지우기: what the user or the AI put on the phone, one item at a time; the screen goes back to its list
    const RM = {
        note: { list: p => p.notes, back: 'note', what: '메모' }, diary: { list: p => p.diary, back: 'diary', what: '일기' },
        photo: { list: p => p.photos, back: 'photo', what: '사진' }, search: { list: p => p.searches, back: 'search', what: '검색 기록' },
        thread: { list: p => p.threads, back: 'msg', what: '대화' }, event: { list: p => p.events, back: 'cal', what: '일정' },
        mail: { list: p => p.mails, back: 'mail', what: '메일' }, post: { list: p => p.posts, back: 'sns', what: '게시물' },
    };
    const OTHER = { voice: '음성 메모', draft: '보내지 않은 메시지', calls: '통화 기록', callrun: '통화 기록', contact: '연락처', place: '장소', kovoice: '말투' };
    $root.on('click', '.na_ph_rm', async function (e) {
        e.stopPropagation();
        const p = phone(), kind = this.dataset.kind, i = this.dataset.i;
        if (!p) return;
        if (kind === 'photo' && drawing.has(`${nameKey(p.owner)}:${i}`)) return toastr.info('그리는 중엔 지울 수 없어요', '캐릭터 휴대폰');
        const what = OTHER[kind] || RM[kind]?.what;
        if (!what || !await askSheet(`이 ${what}${josa(what)} 지울까요?`, '되돌릴 수 없어요.', '지우기')) return;
        if (phone() !== p) return;
        if (kind === 'voice') { p.voice = (p.voice || []).filter(x => x.id !== i); view = 'voice'; }
        else if (kind === 'draft') { const t = p.threads[Number(i)]; if (t) delete t.draft; view = `thread:${i}`; }
        else if (kind === 'calls') { p.calls = p.calls.filter(c => nameKey(c.with) !== i); view = 'call'; }
        else if (kind === 'callrun') { const ks = new Set(i.split(',').map(Number)); p.calls = p.calls.filter((c, k) => !ks.has(k)); }
        // a contact or a place can come back from the story's records, so it is hidden rather than only removed
        else if (kind === 'contact') { p.contacts = p.contacts.filter(c => nameKey(c.name) !== i); p.hiddenContacts = [...new Set([...(p.hiddenContacts || []), i])]; view = 'contacts'; }
        else if (kind === 'place') p.hiddenPlaces = [...new Set([...(p.hiddenPlaces || []), i])];
        else if (kind === 'kovoice') dropVoice(p, i);
        // from a list (메시지 · 메일 · 최근 검색 · 방문 기록) the list stays
        else { const xs = RM[kind].list(p); if (xs?.[Number(i)]) xs.splice(Number(i), 1); if (view.includes(':')) view = RM[kind].back; }
        drawPhone();
        await saveMeta();
        if (p.inject) applyInjection();
    });
    // 밀어서 삭제: a row slides left by a drag (touch or mouse); a tap on an open row only closes it
    let sw = null, swMoved = false;
    const swClose = keep => $root.find('.ax_swp.open').not(keep || []).removeClass('open');
    $root.on('pointerdown', '.ax_swp > .ax_rw', function (e) { swClose($(this).parent()); sw = { el: this, x: e.clientX, y: e.clientY, base: $(this).parent().hasClass('open') ? -86 : 0, dx: 0, on: false }; swMoved = false; });
    $root.on('pointermove', e => {
        if (!sw) return;
        const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
        if (!sw.on) { if (Math.abs(dy) > 10) { sw = null; return; } if (Math.abs(dx) < 8) return; sw.on = true; swMoved = true; sw.el.parentElement.classList.add('drag'); sw.el.style.transition = 'none'; sw.el.setPointerCapture?.(e.pointerId); }
        sw.dx = dx;
        sw.el.style.transform = `translateX(${Math.max(-120, Math.min(0, sw.base + dx))}px)`;
    });
    $root.on('pointerup pointercancel', () => {
        if (!sw) return;
        if (sw.on) { $(sw.el).parent().toggleClass('open', sw.base + sw.dx < -43).removeClass('drag'); sw.el.style.transition = ''; sw.el.style.transform = ''; }
        sw = null;
    });
    mapZoom($root[0]);
    tileWatch($root[0]);
    $root[0].addEventListener('click', e => {
        const r = e.target.closest?.('.ax_swp > .ax_rw');
        if (!r) { if (!e.target.closest?.('.ax_swdel')) swClose(); swMoved = false; return; }
        if (swMoved) { e.stopImmediatePropagation(); swMoved = false; return; }
        if (r.parentElement.classList.contains('open')) { e.stopImmediatePropagation(); $(r.parentElement).removeClass('open'); }
    }, true);
    $root.on('click', '.na_ph_gloss', async e => { e.stopPropagation(); await openGlossary(); drawPhone(true); });
    // one photo at a time; the screen can change while it draws
    $root.on('click', '.na_ph_draw', async function (e) {
        e.stopPropagation();
        const p = phone(), k = Number(this.dataset.k), id = `${nameKey(p.owner)}:${k}`;
        if (drawing.has(id)) return;
        drawing.add(id); drawPhone(true);
        try { await drawPhoto(m, p, k); toastr.success('사진을 그렸어요', '캐릭터 휴대폰'); }
        catch (err) { console.error('[narrative-archive] photo', err); toastr.error(String(err?.message || err), '사진 그리기 실패'); }
        finally { drawing.delete(id); drawPhone(true); }
    });
    // 은행 · 지갑 · 쇼핑 / 음성 메모 채우기, and 음성 메모 떠올리기 (the red button)
    $root.on('click', '.na_ph_fill', async function (e) {
        e.stopPropagation();
        if (making) return toastr.info('폰 반영이나 다시 만들기가 끝난 뒤 눌러 주세요');
        const p = phone(), k = this.dataset.k, id = `${nameKey(p.owner)}:${k}`;
        if (filling.has(id)) return;
        filling.add(id); drawPhone(true);
        try { await ({ money: fillMoney, life: fillLife, delivery: fillDelivery, screen: fillScreen }[k] || fillVoice)(m, p); toastr.success(`${{ money: '은행 · 지갑 · 쇼핑', life: '시계 · 건강 · 파일 · 날씨', delivery: '배달', screen: '스크린타임' }[k] || '음성 메모'}을 채웠어요`, '캐릭터 휴대폰'); }
        catch (err) { console.error('[narrative-archive] fill', err); toastr.error(String(err?.message || err), '채우기 실패'); }
        finally { filling.delete(id); if (phone() === p) drawPhone(true); }
    });
    $root.on('click', '.na_ph_rec', async function (e) {
        e.stopPropagation();
        const p = phone(), id = nameKey(p.owner);
        if (recording.has(id)) return;
        recording.add(id); drawPhone(true);
        try { const k = await recordVoice(m, p); if (phone() === p && view.startsWith('voice')) view = `voice:${p.voice[k].id}`; toastr.success('음성 메모를 떠올렸어요', '캐릭터 휴대폰'); }
        catch (err) { console.error('[narrative-archive] voice', err); toastr.error(String(err?.message || err), '떠올리기 실패'); }
        finally { recording.delete(id); if (phone() === p) drawPhone(true); }
    });
    // the home's two pages: swipe sideways, or tap a dot
    let swipeX = null, swipeY = 0;
    $root.on('pointerdown', '.v_home .cg_col, .v_home2 .cg_col', e => { swipeX = e.clientX; swipeY = e.clientY; });
    $root.on('pointerup', '.v_home .cg_col, .v_home2 .cg_col', e => {
        if (swipeX === null) return;
        const dx = e.clientX - swipeX, dy = e.clientY - swipeY;
        swipeX = null;
        if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
        const to = dx < 0 ? 'home2' : 'home';
        if (to !== view) { view = to; drawPhone(); }
    });
    // 미발송 초안 떠올리기: one thread at a time; the screen can change meanwhile
    $root.on('click', '.na_ph_draftmake', async function (e) {
        e.stopPropagation();
        const p = phone(), i = Number(this.dataset.i), t = p?.threads?.[i];
        if (!t) return;
        const id = `${nameKey(p.owner)}:${t.id || i}`;
        if (drafting.has(id)) return;
        drafting.add(id); drawPhone(true);
        try { await makeDraft(m, p, i); toastr.success('보내지 않은 메시지를 떠올렸어요', '캐릭터 휴대폰'); }
        catch (err) { console.error('[narrative-archive] draft', err); toastr.error(String(err?.message || err), '떠올리기 실패'); }
        finally { drafting.delete(id); if (phone() === p) drawPhone(true); }
    });
    // 브라우저: closing a tab, and bookmarks (the model's "mark" can be taken off; the user's are kept in marks)
    $root.on('click', '.na_ph_tabx', async function (e) {
        e.stopPropagation();
        const x = phone()?.searches?.[Number(this.dataset.i)];
        if (!x) return;
        x.closed = true; drawPhone(true); await saveMeta();
    });
    $root.on('click', '.na_ph_bmark', async function (e) {
        e.stopPropagation();
        const x = phone()?.searches?.[Number(this.dataset.i)], r = Number(this.dataset.r);
        if (!x) return;
        const marks = new Set(x.marks || []);
        const on = r < 0 ? (x.mark && !x.unmark) || marks.has(-1) : marks.has(r);
        if (on) { marks.delete(r); if (r < 0 && x.mark) x.unmark = true; } else { marks.add(r); if (r < 0) delete x.unmark; }
        x.marks = [...marks];
        drawPhone(true); await saveMeta();
    });
    $root.on('click', '.na_ph_postdraw', async function (e) {
        e.stopPropagation();
        const p = phone(), k = Number(this.dataset.k), album = this.dataset.src === 'photo', id = `${nameKey(p.owner)}:${album ? '' : 'post'}${k}`;
        if (drawing.has(id)) return;
        drawing.add(id); drawPhone(true);
        try { await (album ? drawPhoto : drawPost)(m, p, k); toastr.success('사진을 그렸어요', '캐릭터 휴대폰'); }
        catch (err) { console.error('[narrative-archive] post photo', err); toastr.error(String(err?.message || err), '사진 그리기 실패'); }
        finally { drawing.delete(id); drawPhone(true); }
    });
    // a drawn picture (사진 or SNS) shows only itself; a long press shows its tags, 다시 그리기 and 저장 (the phone's own image menu stays shut)
    let pressT = null, justPressed = false;
    // 메시지 › 꾹 누르기 (복사 · 재번역 · 선택 · 삭제) and 여러 개 고르기: which thread, which texts
    let msgHeld = null, msgPick = null, msgView = '', heldT = null, heldAt = null, heldWhen = 0, holding = false;
    const justHeld = () => Date.now() - heldWhen < 450; // the release of a hold is no tap (its element may be redrawn under the finger)
    const retrKs = new Set();
    const threadNo = () => (view.startsWith('thread:') ? Number(view.slice(7)) : -1);
    const msgKs = el => (msgPick ? [...msgPick.ks] : [Number(el.dataset.k)]).filter(Number.isInteger).sort((a, b) => a - b);
    $root.on('pointerdown', '.na_ph_bb', function (e) {
        if (msgPick) return;
        const el = this; heldAt = [e.clientX, e.clientY]; clearTimeout(heldT);
        heldT = setTimeout(() => { heldT = null; heldWhen = Date.now(); holding = true; msgHeld = { i: threadNo(), k: Number(el.dataset.k) }; navigator.vibrate?.(10); drawPhone(true); }, 480);
    });
    $root.on('pointermove', '.na_ph_bb', e => { if (heldT && heldAt && Math.hypot(e.clientX - heldAt[0], e.clientY - heldAt[1]) > 8) { clearTimeout(heldT); heldT = null; } });
    $root.on('pointerup pointercancel pointerleave', '.na_ph_bb', () => { clearTimeout(heldT); heldT = null; });
    // the finger lifting after a hold, wherever it lands now the bubble was redrawn
    $root.on('pointerup pointercancel', () => { if (holding) { holding = false; heldWhen = Date.now(); } });
    $root.on('contextmenu', '.na_ph_bb', e => e.preventDefault());
    $root.on('click', '.na_ph_bb', function (e) {
        if (justHeld()) { e.stopPropagation(); return; }
        if (msgPick) { e.stopPropagation(); const k = Number(this.dataset.k); msgPick.ks.has(k) ? msgPick.ks.delete(k) : msgPick.ks.add(k); drawPhone(true); return; }
        if (msgHeld) { e.stopPropagation(); msgHeld = null; drawPhone(true); }
    });
    $root.on('click', '.ax_mrow', function (e) { if (e.target.closest('.na_ph_bb')) return; e.stopPropagation(); $(this).find('.na_ph_bb').trigger('click'); });
    $root.on('click', '.ax_mholding', e => { if (justHeld()) return; if (e.target.closest('.ax_mbar, .ax_mheld .na_ph_bb')) return; msgHeld = null; drawPhone(true); });
    $root.on('click', '.na_ph_mpick', function (e) { e.stopPropagation(); msgPick = { i: threadNo(), ks: new Set([Number(this.dataset.k)]) }; msgHeld = null; drawPhone(true); });
    $root.on('click', '.na_ph_mquit', e => { e.stopPropagation(); msgPick = null; drawPhone(true); });
    // 복사: what the screen shows — the text, and its Korean when Korean is on; many are joined in order, each with who said it
    $root.on('click', '.na_ph_mcopy', async function (e) {
        e.stopPropagation();
        const p = phone(), t = p?.threads[threadNo()], ks = msgKs(this);
        if (!t || !ks.length) return;
        const who = x => (x.from === 'me' ? '나' : savedName(p, x.from));
        const txt = ks.map(k => t.messages[k]).filter(Boolean).map(x => `${ks.length > 1 ? `${who(x)}: ` : ''}${x.text}${koOn() && x.ko ? `\n${ks.length > 1 ? '    ' : ''}${x.ko}` : ''}`).join('\n');
        try { await navigator.clipboard.writeText(txt); } catch { const ta = document.createElement('textarea'); ta.value = txt; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
        toastr.success(ks.length > 1 ? `메시지 ${ks.length}개를 복사했어요` : '복사했어요', '캐릭터 휴대폰');
        msgHeld = null; msgPick = null; drawPhone(true);
    });
    // 재번역: only the Korean line, written again by the model; the text stays
    $root.on('click', '.na_ph_mretr', async function (e) {
        e.stopPropagation();
        const p = phone(), i = threadNo(), ks = msgKs(this), key = `${nameKey(p?.owner)}:${i}`;
        if (!p?.threads[i] || !ks.length || retranslating.has(key)) return;
        retranslating.add(key); ks.forEach(k => retrKs.add(k)); msgHeld = null; msgPick = null; drawPhone(true);
        try { const n = await retranslate(m, p, i, ks); toastr.success(`메시지 ${n}개를 다시 번역했어요`, '캐릭터 휴대폰'); }
        catch (err) { toastr.error(String(err?.message || err), '재번역'); }
        finally { retranslating.delete(key); ks.forEach(k => retrKs.delete(k)); if (!phoneClosed && phone() === p) drawPhone(true); }
    });
    // 삭제: off this phone (marked deleted, so the reflection never puts it back)
    $root.on('click', '.na_ph_mdel', async function (e) {
        e.stopPropagation();
        const p = phone(), t = p?.threads[threadNo()], ks = msgKs(this);
        if (!t || !ks.length) return;
        if (!await askSheet(ks.length > 1 ? `메시지 ${ks.length}개를 지울까요?` : '이 메시지를 지울까요?', '이 폰에서만 지워져요.', '지우기')) return;
        for (const k of ks) if (t.messages[k]) t.messages[k].deleted = true;
        await saveMeta(); msgHeld = null; msgPick = null; drawPhone(true);
    });
    const pressSheet = el => {
        const x = (el.dataset.src === 'photo' ? phone()?.photos : phone()?.posts)?.[Number(el.dataset.k)];
        if (!x) return;
        justPressed = true;
        $(el).find('.ax_presssheet').remove();
        $(el).append(`<div class="ax_presssheet"><small>그린 태그${x.via === 'autopic' ? ' · 오토픽' : ''}</small><code>${esc(x.tags || '')}</code><div class="ax_btns"><button type="button" class="na_ph_postdraw" data-src="${el.dataset.src}" data-k="${el.dataset.k}">다시 그리기</button><button type="button" class="ax_presssave" data-src="${el.dataset.src}" data-k="${el.dataset.k}">저장</button><button type="button" class="ax_pressx">닫기</button></div></div>`);
    };
    // 저장: the picture as a file (owner, 사진 or SNS, its time in the name)
    $root.on('click', '.ax_presssave', async function (e) {
        e.stopPropagation();
        const p = phone(), album = this.dataset.src === 'photo', x = (album ? p?.photos : p?.posts)?.[Number(this.dataset.k)];
        if (!x?.img) return;
        try {
            const blob = await (await fetch(x.img)).blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${p.owner}_${album ? 'Photo' : 'SNS'}_${String(x.time || '').replace(/\D/g, '') || 'photo'}.${(blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`;
            document.body.append(a); a.click(); a.remove();
            toastr.success('사진을 저장했어요', '캐릭터 휴대폰');
            setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        } catch (err) { console.error('[narrative-archive] save photo', err); toastr.error(String(err?.message || err), '사진 저장 실패'); }
    });
    // the same sheet from SNS's ⋯; 사진's 정보 opens the tags under the caption
    // SNS's ⋯: the app's own sheet (그린 태그 보기 · 다시 그리기 · 저장 · 삭제)
    $root.on('click', '.ax_postmore', e => { e.stopPropagation(); $root.find('.ax_igsheet').prop('hidden', false); });
    $root.on('click', '.ax_igsheet', function (e) { if (e.target === this) $(this).prop('hidden', true); });
    $root.on('click', '.ax_igsheet button', () => $root.find('.ax_igsheet').prop('hidden', true));
    $root.on('click', '.ax_igtags', function (e) {
        e.stopPropagation();
        $root.find('.ax_igsheet').prop('hidden', true);
        const el = $root.find(`.na_ph_press[data-src="post"][data-k="${this.dataset.k}"]`)[0];
        if (el) { pressSheet(el); justPressed = false; }
    });
    $root.on('click', '.ax_pvinfo', function (e) {
        e.stopPropagation();
        const open = this.getAttribute('aria-expanded') !== 'true';
        this.setAttribute('aria-expanded', String(open));
        $root.find('.ax_pvtags').prop('hidden', !open);
    });
    $root.on('pointerdown', '.na_ph_press', function () { const el = this; clearTimeout(pressT); pressT = setTimeout(() => { pressT = null; pressSheet(el); }, 500); });
    $root.on('pointerup pointerleave pointercancel', '.na_ph_press', () => { clearTimeout(pressT); pressT = null; });
    $root.on('contextmenu', '.na_ph_press', e => e.preventDefault());
    $root.on('click', '.na_ph_press', function (e) {
        if ($(e.target).closest('.ax_presssheet').length && !$(e.target).closest('.ax_pressx').length) return;
        if (justPressed) { justPressed = false; return; }
        $(this).find('.ax_presssheet').remove();
    });
    // 설정's rows: the busy text goes where the row's value is
    // one at a time: reflecting and making the bank or investment never overlap
    const makeFrom = async ($at, update) => { if (koBusy) return toastr.info('번역하는 중이에요. 끝나면 다시 눌러 주세요', '캐릭터 휴대폰'); if (making || busy.sync) return toastr.info('폰 작업이 진행 중이에요. 끝나면 다시 눌러 주세요', '캐릭터 휴대폰'); if (investing || filling.size || busy.fill) return toastr.info('은행·투자를 만드는 중이에요. 끝난 뒤 눌러 주세요'); making = true; try { await make($at, update); } finally { making = false; } };
    $root.on('click', '.na_ph_setupd', function (e) { e.stopPropagation(); makeFrom($(this).find('.ax_v'), true); });
    // 설정 › 대화 반영
    $root.on('click', '.na_sync_order', async function (e) { e.stopPropagation(); syncOf(phone(), phoneChatScope(ctx())).order = this.dataset.v; drawPhone(true); await saveMeta(); });
    $root.on('click', '.na_sync_limit', async function (e) { e.stopPropagation(); const s = syncOf(phone(), phoneChatScope(ctx())); s.limit = Math.max(1, Math.min(100, (s.limit || 12) + Number(this.dataset.d))); drawPhone(true); await saveMeta(); });
    $root.on('click', '.na_sync_more', e => { e.stopPropagation(); pickMore += 30; drawPhone(true); });
    // a new start keeps what was read and the events already on the phone
    $root.on('click', '.na_sync_pick', async function (e) {
        e.stopPropagation();
        const p = phone(), s = syncOf(p, phoneChatScope(ctx()));
        const mark = markAfter(Number(this.dataset.i));
        s.marks.base = mark; s.scope = phoneChatScope(ctx());
        for (const g of ['money', 'invest']) if (!s.marks[g] && (g === 'money' ? p.money : p.investment)) s.marks[g] = { ...mark };
        syncWhy = ''; view = 'setsync'; drawPhone(); await saveMeta();
        toastr.success(mark.index < 0 ? '첫 대화부터 반영해요' : `#${mark.index} 다음부터 반영해요`, '캐릭터 휴대폰');
    });
    $root.on('click', '.na_sync_restore', async e => { e.stopPropagation(); if (making || busy.sync || busy.fill) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요'); const n = await restoreRounds(m, phoneChatScope(ctx())); syncPending = 0; drawPhone(); if (n && phone()) koRun(phone(), false); /* (what came back has no Korean yet) */ if (m.phones && Object.values(m.phones).some(p => p.inject)) applyInjection(); toastr.success(`반영 ${n}번을 복구했어요`, '캐릭터 휴대폰'); });
    $root.on('click', '.na_sync_drop', async function (e) {
        e.stopPropagation();
        if (making || busy.sync || busy.fill) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요');
        const p = phone(), d = p.sync?.dropped?.[Number(this.dataset.k)];
        if (!d || !await askSheet(`대화 ${d.label}에서 넣은 일을 뺄까요?`, '문자 · 일정 · 돈 기록이 빠져요.', '빼기')) return;
        if (making || busy.sync || busy.fill) return;
        const r = await dropStretch(m, p, d.key);
        drawPhone();
        const did = [r.gone ? `일 ${r.gone}개` : '', r.items ? `앱 기록 ${r.items}개` : ''].filter(Boolean).join(' · ') || '뺄 것이 없어서 아무것도 안';
        if (r.kept.length) toastr.warning(`${did}를 뺐어요. ${r.kept.join(', ')}은(는) 뒤의 기록과 이어져 있어서 남겨뒀어요`, '캐릭터 휴대폰');
        else toastr.success(`${did}를 뺐어요`, '캐릭터 휴대폰');
    });
    $root.on('click', '.na_sync_undo', async e => {
        e.stopPropagation();
        // not while a reflection or a fill writes the same records
        if (making || busy.sync || busy.fill) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요');
        try {
            const p = phone(), target = phoneTarget(m, p), round = p.syncUndo;
            const n = p.syncLast?.checked || 0;
            if (!await askSheet('방금 반영을 되돌릴까요?', `대화 ${n}개를 다시 읽게 돼요.`, '되돌리기')) return;
            target.check();
            if (making || busy.sync || busy.fill || phone() !== p || p.syncUndo !== round) return;
            const kept = await exclusive('sync', () => undoRound(m, p));
            drawPhone();
            kept.length ? toastr.warning(`되돌렸어요. ${kept.join(', ')}은(는) 그 사이 바뀌어서 남겨뒀어요`, '캐릭터 휴대폰') : toastr.success('반영을 되돌렸어요', '캐릭터 휴대폰');
        }
        catch (err) { toastr.error(String(err?.message || err), '되돌리기'); }
    });
    // 결제 다시 읽기: the money the last round couldn't put in, asked again and put on that round
    $root.on('click', '.na_sync_money', async e => {
        e.stopPropagation();
        if (making || busy.sync || busy.fill) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요');
        const p = phone();
        try {
            const r = await withSpinner($(e.currentTarget), '결제 읽는 중', () => retryMoney(m, owner));
            if (phone() === p) drawPhone();
            r.owed ? toastr.warning(`메시지 ${r.paid}개의 결제를 넣었어요. ${r.owed}개는 다음 반영 때 다시 해요`, '캐릭터 휴대폰') : toastr.success(r.paid ? `메시지 ${r.paid}개의 결제를 넣었어요` : '넣을 결제가 없었어요', '캐릭터 휴대폰');
        } catch (err) { toastr.error(String(err?.message || err), '결제 다시 읽기'); }
    });
    $root.on('click', '.na_sync_forget', async e => {
        e.stopPropagation();
        if (!await askSheet('반영 기록을 지울까요?', '폰은 그대로예요.', '지우기')) return;
        const { journalWrite } = await import('./phonesync.js'); journalWrite(phoneChatScope(ctx()), []); syncPending = 0; drawPhone();
    });
    // 날짜 및 시간: the year this phone's dates are in, or none
    // the story's year: − / + a year at a time, held down it runs (faster after a moment), like a phone's own steppers;
    // the number changes in place while held, the year is set once on letting go
    const commitYear = async y => {
        const p = phone(), pre = !p && view === 'prep' ? phonePre(m, owner) : null;
        if (pre) { if (y >= 1900 && y <= 2100 && y !== pre.year) await setPreYear(m, owner, y); drawPhone(true); return; }
        if (!p || !(y >= 1900 && y <= 2100) || y === p.year) { drawPhone(true); return; }
        // the bank's and investments' dates move with it (the whole chat's), so their order holds
        if (p.year && hasDatedRecords(m) && !await askSheet(`${y}년으로 바꿀까요?`, '기록 날짜와 다른 폰도 같이 바뀌어요.', '바꾸기', true)) { drawPhone(true); return; }
        setStoryYear(m, p, y);
        drawPhone(true); await saveMeta();
    };
    let yHold = null;
    // the phone, or before it is made the one 폰 만들기 준비 is reading (위치 · 연도 are set on it the same way)
    const tgt = () => phone() || (view === 'prep' ? phonePre(m, owner) : null);
    const yStop = () => { if (!yHold) return; clearTimeout(yHold.t); const y = yHold.y; yHold = null; commitYear(y); };
    $root.on('pointerdown', '.na_ph_ystep', function (e) {
        e.preventDefault(); e.stopPropagation(); if (yHold) return;
        const p = tgt(); if (!p) return;
        const d = Number(this.dataset.d), $v = $root.find('.na_ph_yval');
        yHold = { y: Number(p.year) || new Date().getFullYear(), t: 0, n: 0 };
        const tick = () => { if (!yHold) return; yHold.y = Math.max(1900, Math.min(2100, yHold.y + d)); yHold.n++; $v.text(String(yHold.y)); yHold.t = setTimeout(tick, yHold.n < 2 ? 420 : yHold.n < 12 ? 110 : 45); };
        tick();
        this.setPointerCapture?.(e.pointerId);
    });
    $root.on('pointerup pointercancel lostpointercapture', '.na_ph_ystep', e => { e.stopPropagation(); yStop(); });
    $root.on('keydown', '.na_ph_ystep', function (e) { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); const p = tgt(); if (p) commitYear((Number(p.year) || new Date().getFullYear()) + Number(this.dataset.d)); });
    // 설정 › 위치 정보: locked while the phone is being made, reflected or filled, like the date order
    const placeLocked = () => { if (!(making || busyMake || investing || filling.size || busy.fill || busy.sync || placeReading || prepLinking)) return false; toastr.info('반영이 끝난 뒤 바꿔 주세요', '캐릭터 휴대폰'); return true; };
    const placeCity = async (name, now) => {
        const v = await askInput(`${name}의 도시`, '시간대는 도시 이름으로 찾아요.', now || '');
        // the same name again is done, unless two towns share it (Portland): then which one is asked again
        if (!v || v === now && !cityChoices(tgt(), v, name).choices) return;
        try { await setPlaceCity(m, tgt(), name, v); } catch (err) {
            if (!err?.choices && !err?.askCountry) { toastr.warning(String(err?.message || err), '위치 정보'); return drawPhone(true); }
            const tz = await askZone(tgt(), name, v, err);
            if (tz) { try { await setPlaceCity(m, tgt(), name, v, tz); } catch (e2) { toastr.warning(String(e2?.message || e2), '위치 정보'); } }
        }
        drawPhone(true);
    };
    $root.on('change', '.na_ph_plives', async function (e) { e.stopPropagation(); if (placeLocked()) return drawPhone(true); if (this.value) await setOwnerLives(m, tgt(), this.value); drawPhone(true); });
    $root.on('click', '.na_ph_plcity', async function (e) { e.stopPropagation(); if (placeLocked()) return; await placeCity(this.dataset.n, placeInfo(tgt()).owner.city); });
    $root.on('click', '.na_ph_plrow', async function (e) {
        e.stopPropagation(); if (placeLocked()) return;
        const name = this.dataset.n, x = placeInfo(tgt()).people.find(r => r.name === name); if (x) await placeCity(name, x.city);
    });
    // 이 사람이 주인인가요?: a name read both as the owner's and as someone else's (p.where.ask)
    $root.on('click', '.na_ph_plask', async function (e) {
        e.stopPropagation(); if (placeLocked()) return;
        const p = tgt(), name = this.dataset.n, own = placeInfo(p).owner.name || p.owner;
        const v = await askChoice(`${name}, ${own}인가요?`, `같은 이름을 ${own}의 다른 이름으로도, 다른 사람으로도 읽었어요.`, [{ v: 'yes', label: `네, ${own}예요` }, { v: 'no', label: '아니요, 다른 사람이에요' }], '나중에');
        if (v !== 'yes' && v !== 'no') return;
        await answerOwnerAsk(m, p, name, v === 'yes'); drawPhone(true);
    });
    // 밀어서 빼기, like a message or a mail: the row slid open shows 빼기
    $root.on('click', '.na_ph_pldrop', async function (e) { e.stopPropagation(); if (placeLocked()) return; await dropPlacePerson(m, tgt(), this.dataset.n); drawPhone(true); });
    $root.on('click', '.na_ph_plread', async function (e) {
        e.stopPropagation(); if (placeLocked()) return;
        const v = await askChoice('위치를 연동할까요?', '모델을 한 번 불러요.', [{ v: 'keep', label: '수동 위치 제외하고 연동' }, { v: 'all', label: '전부 새로 연동' }], '취소');
        if (v !== 'keep' && v !== 'all') return;
        if (v === 'all' && !await askSheet('위치가 모두 바뀌어요', '수동 위치 · 뺀 사람도 다시 연동해요.', '새로 연동')) return;
        const p = phone(); placeReading = true; drawPhone(true);
        try { await rereadPlaces(m, p, { all: v === 'all' }); toastr.success('위치를 연동했어요', '위치 정보'); }
        catch (err) { toastr.error(String(err?.message || err), '위치 정보'); }
        finally { placeReading = false; if (!phoneClosed) drawPhone(true); }
    });
    // 설정 › 말투: a row's style written anew (the row becomes 소망's: by 'user', an old from read as who); 사람 추가 asks the
    // name, then the style (a name already there is that row). Saved with saveMeta; translations already made stay
    // a row written by hand gets its short label afterwards (labelVoices, not waited for): put in only if the row is still
    // there with the same style; a failure leaves the list showing its first pieces, and isn't asked again
    const voiceLabel = (p, row) => {
        if (!row?.style) return;
        labelVoices([{ who: row.who, style: row.style }]).then(async ([l]) => {
            if (!l || !p.koVoice?.includes(row)) return; // (the row object itself: edited again, it is a new one)
            row.label = l; await saveMeta(); if (!phoneClosed && phone() === p) drawPhone(true);
        }).catch(err => console.warn('[narrative-archive] voice label', err));
    };
    // the first time 말투 opens (each phone, once a session): every row written by hand without a label asks for one, all
    // in one request; a failure leaves them as they are
    const voiceFilled = new WeakSet();
    const voiceFill = p => {
        if (!p || voiceFilled.has(p)) return; voiceFilled.add(p);
        const rows = (Array.isArray(p.koVoice) ? p.koVoice : []).filter(v => v && v.by !== 'model' && String(v.style || '').trim() && !v.label).slice(0, 40);
        if (!rows.length) return;
        const was = rows.map(v => v.style);
        labelVoices(rows.map(v => ({ who: String(v.who ?? v.from ?? '').trim(), style: v.style }))).then(async ls => {
            let n = 0;
            rows.forEach((v, i) => { if (ls[i] && p.koVoice?.includes(v) && v.style === was[i] && !v.label) { v.label = ls[i]; n++; } });
            if (n) { await saveMeta(); if (!phoneClosed && phone() === p) drawPhone(true); }
        }).catch(err => console.warn('[narrative-archive] voice labels', err));
    };
    const voiceSet = async (p, k, style) => {
        const v = p.koVoice[k], w = String(v?.who ?? v?.from ?? '').trim(), row = { who: w, style, by: 'user' };
        p.koVoice[k] = row;
        await saveMeta(); if (!phoneClosed) drawPhone(true);
        voiceLabel(p, row);
    };
    $root.on('click', '.na_ph_kvrow', async function (e) {
        e.stopPropagation(); const p = phone(), k = Number(this.dataset.i), v = p?.koVoice?.[k]; if (!v) return;
        const w = String(v.who ?? v.from ?? '').trim();
        const style = await askInput(`${w}의 말투`, '남에게 하는 말투를 짧게 적어요.', String(v.style || ''), '저장', { area: true });
        if (!style || phone() !== p || p.koVoice?.[k] !== v) return;
        await voiceSet(p, k, style.slice(0, 300));
    });
    // 말투 › 언어: a language ticked on or off, kept on the phone now open (타임라인 · 실시간 each their own)
    $root.on('click', '.na_ph_langtick', async function (e) {
        e.stopPropagation(); const p = phone();
        if (!tickLang(p, this.dataset.k, this.dataset.n)) return;
        await saveMeta(); if (!phoneClosed) drawPhone(true);
    });
    // 이야기에서 뽑기: the row starts choosing; with names chosen it asks the story about them (pickVoices: what it finds takes
    // the row, what it doesn't keeps the row it had). 취소 stops choosing
    const voiceDraw = () => { if (!phoneClosed) drawPhone(true); };
    $root.on('click', '.na_ph_kvpick', async function (e) {
        e.stopPropagation(); const p = phone(); if (!p || voiceBusy) return;
        if (!voicePick) { voicePick = new Set(); return voiceDraw(); }
        const names = voiceList(p).filter(v => voicePick.has(v.who.toLowerCase())).map(v => v.who);
        if (!names.length) return;
        voiceBusy = true; voiceDraw();
        let got = null;
        try { got = await pickVoices(m, owner, p, names); await saveMeta(); }
        catch (err) { console.warn('[narrative-archive] voices', err); toastr.warning(`말투를 못 뽑았어요 (${String(err?.message || err)})`, '캐릭터 휴대폰'); }
        finally { voiceBusy = false; }
        if (got) { voicePick = null; if (got.found.length) toastr.success(`${got.found.join(', ')} · 뽑았어요`, '말투'); if (got.missing.length) toastr.info(`${got.missing.join(', ')} · 이야기에서 말투를 못 찾았어요`, '말투'); }
        voiceDraw();
    });
    $root.on('click', '.na_ph_kvx', function (e) { e.stopPropagation(); if (voiceBusy) return; voicePick = null; voiceDraw(); });
    $root.on('click', '.na_ph_kvtick', function (e) {
        e.stopPropagation(); if (!voicePick || voiceBusy) return; const k = String(this.dataset.n || '').toLowerCase();
        if (voicePick.has(k)) voicePick.delete(k); else voicePick.add(k);
        voiceDraw();
    });
    $root.on('click', '.na_ph_kvall', function (e) {
        e.stopPropagation(); const p = phone(); if (!p || !voicePick || voiceBusy) return;
        const ks = voiceList(p).filter(v => (this.dataset.g === 'auto') === v.model).map(v => v.who.toLowerCase());
        if (ks.every(k => voicePick.has(k))) ks.forEach(k => voicePick.delete(k)); else ks.forEach(k => voicePick.add(k));
        voiceDraw();
    });
    // 사람 추가: the people chosen are added (a name only) and asked of the story at once; what it doesn't find stays a name
    // to write by hand. Back on the list after
    $root.on('click', '.na_ph_kvaddtick', function (e) {
        e.stopPropagation(); if (voiceBusy) return; const k = String(this.dataset.n || '').toLowerCase();
        if (voiceAdd.has(k)) voiceAdd.delete(k); else voiceAdd.add(k);
        voiceDraw();
    });
    $root.on('click', '.na_ph_kvaddall', function (e) {
        e.stopPropagation(); const p = phone(); if (!p || voiceBusy) return;
        const ks = voicePeople(p).map(x => x.name.toLowerCase());
        if (ks.every(k => voiceAdd.has(k))) voiceAdd.clear(); else ks.forEach(k => voiceAdd.add(k));
        voiceDraw();
    });
    $root.on('click', '.na_ph_kvaddgo', async function (e) {
        e.stopPropagation(); const p = phone(); if (!p || voiceBusy) return;
        const names = voicePeople(p).filter(x => voiceAdd.has(x.name.toLowerCase())).map(x => x.name).slice(0, 20);
        if (!names.length) return;
        if (!Array.isArray(p.koVoice)) p.koVoice = [];
        names.forEach(n => p.koVoice.push({ who: n.slice(0, 40), style: '', by: 'user' }));
        voiceBusy = true; voiceDraw();
        let got = null;
        try { got = await pickVoices(m, owner, p, names); }
        catch (err) { console.warn('[narrative-archive] voices', err); toastr.warning(`말투를 못 뽑았어요 (${String(err?.message || err)})`, '캐릭터 휴대폰'); }
        finally { voiceBusy = false; }
        await saveMeta();
        if (got) { if (got.found.length) toastr.success(`${got.found.join(', ')} · 뽑았어요`, '말투'); if (got.missing.length) toastr.info(`${got.missing.join(', ')} · 이야기에서 말투를 못 찾았어요`, '말투'); }
        voiceAdd = new Set(); if (view === 'setvoiceadd') view = 'setvoice';
        voiceDraw();
    });
    $root.on('click', '.na_ph_kvadd', async function (e) {
        e.stopPropagation(); const p = phone(); if (!p) return;
        const name = await askInput('사람 추가', '이름을 적어요.', '', '다음');
        if (!name || phone() !== p) return;
        if (!Array.isArray(p.koVoice)) p.koVoice = [];
        const have = p.koVoice.findIndex(v => String(v?.who ?? v?.from ?? '').trim().toLowerCase() === name.toLowerCase());
        const style = await askInput(`${name}의 말투`, '남에게 하는 말투를 짧게 적어요.', have >= 0 ? String(p.koVoice[have].style || '') : '', '저장', { area: true, empty: have < 0 });
        if (style === false || phone() !== p) return;
        if (have >= 0) return voiceSet(p, have, style.slice(0, 300));
        const row = { who: name.slice(0, 40), style: style.slice(0, 300), by: 'user' };
        p.koVoice.push(row);
        if (view === 'setvoiceadd') view = 'setvoice';
        await saveMeta(); if (!phoneClosed) drawPhone(true);
        voiceLabel(p, row);
    });
    $root.on('click', '.na_ph_screenholder', async function (e) {
        e.stopPropagation();
        if (making || busyMake || investing || filling.size || busy.fill || busy.sync) return toastr.info('반영이 끝난 뒤 바꿔 주세요', '캐릭터 휴대폰');
        const value = this.dataset.n;
        if (value !== '' && !screenHolderChoices(m).some(x => x.name === value)) return;
        if (getMeta() !== realM) return;
        await setScreenHolder(m, value);
        if (!phoneClosed && getMeta() === realM) { view = phone() ? 'setdate' : 'prep'; drawPhone(); }
    });
    $root.on('click', '.na_ph_dord', async function (e) { e.stopPropagation(); if (making || busyMake || investing || filling.size || busy.fill || busy.sync) return toastr.info('반영이 끝난 뒤 바꿔 주세요', '캐릭터 휴대폰'); const v = this.dataset.v; if (v !== 'md' && v !== 'dm' || dateOrderOf(m) === v && !needsDateOrder(m)) return; await setDateOrder(m, v); drawPhone(true); });
    $root.on('click', '.na_ph_yearshow', async e => {
        e.stopPropagation();
        const pre = !phone() && view === 'prep' ? phonePre(m, owner) : null;
        if (pre) { await setPreYear(m, owner, pre.noYear ? Number(storyYear(m, { ...pre, year: 0, noYear: false })) || new Date().getFullYear() : null); return drawPhone(true); }
        const p = phone(); if (!p) return; p.noYear = !p.noYear; if (!p.noYear && !p.year) p.year = Number(storyYear(m, { ...p, year: 0 })) || new Date().getFullYear(); drawPhone(true); await saveMeta(); });
    $root.on('click', '.na_ph_setinj', async e => { e.stopPropagation(); const p = phone(); p.inject = !p.inject; drawPhone(true); await saveMeta(); applyInjection(); });
    // what opens under the phone scrolls into sight, so the tap visibly does something
    $root.on('change', '.na_ph_country', async function () { phone().country = this.value; drawPhone(); await saveMeta(); });
    $root.on('click', '.na_ph_theme', async function () { const p = phone(); if (this.dataset.v === 'gray') p.theme = 'gray'; else delete p.theme; drawPhone(); drawCtrl(); await saveMeta(); });
    $root.on('click', '.na_ph_wsw', async function () { phone().wall = this.dataset.w; drawPhone(); drawCtrl(); await saveMeta(); });
    $root.on('click', '.ax_rmpick', function (e) { e.stopPropagation(); const k = this.dataset.k; if (!remake.delete(k)) remake.add(k); drawPhone(true); });
    $root.on('click', '.ax_rmall', e => { e.stopPropagation(); const all = [...Object.keys(REMAKE), ...REMAKE_MORE]; if (remake.size === all.length) remake.clear(); else all.forEach(k => remake.add(k)); drawPhone(true); });
    $root.on('click', '.na_ph_setremake', async function (e) {
        e.stopPropagation();
        if (!remake.size) return;
        if (making) return toastr.info('폰을 다시 만드는 중이에요');
        if (investing) return toastr.info('시세·환율 작업이 진행 중이에요. 완료 후 다시 눌러 주세요');
        const apps = Object.keys(REMAKE).filter(k => remake.has(k)), more = REMAKE_MORE.filter(k => remake.has(k)), whole = apps.length === Object.keys(REMAKE).length;
        const date=more.includes('invest') ? ($root.find('.ax_investdate').val() || investmentDate(m,phone())) : '';
        if(more.includes('invest') && !validDate(date)) {toastr.warning('투자 기준일을 입력해 주세요');return;}
        const target = phone(), targetOwner = owner, keep = target.inject;
        making = true;
        try {
            if (!await askSheet(whole ? '폰 전체를 다시 만들까요?' : apps.length + more.length === 1 ? `${APPS[[...apps, ...more][0]]}${josa(APPS[[...apps, ...more][0]])} 다시 만들까요?` : `앱 ${apps.length + more.length}개를 다시 만들까요?`, whole || apps.length + more.length === 1 ? '' : [...apps, ...more].map(k => APPS[k]).join(' · '), '다시 만들기')) return;
            if (phone() !== target || investing) {toastr.info('폰이나 진행 중인 작업이 바뀌었어요. 다시 눌러 주세요');return;}
            if (apps.length) await askDateOrder();
            drawPhone(true);
            const p = apps.length ? await makePhone(m, targetOwner, whole ? {} : { apps }) : target;
            if (!p) throw new Error('생성 결과를 받지 못했어요. 다시 시도해 주세요');
            const wealthPlan = more.some(k=>k==='money'||k==='invest') ? await prepareWealth(m,p,true) : null;
            for (const k of more.filter(k => !(k === 'screen' && more.includes('life')))) await (k === 'money' ? fillMoney(m,p,{regenerateBalances:true,wealthPlan}) : k === 'invest' ? fillInvestment(m,p,date,{regenerate:true,wealthPlan}) : k === 'life' ? fillLife(m,p,{screenAgain:more.includes('screen')}) : k === 'delivery' ? fillDelivery(m,p) : k === 'screen' ? fillScreen(m,p,{again:true}) : fillVoice(m,p));
            if (whole && keep) { p.inject = true; await saveMeta(); applyInjection(); }
            if (phone() === p && !phoneClosed) {remake.clear(); view = whole ? 'lock' : 'set'; draw();}
            toastr.success(whole ? `${targetOwner}의 폰을 다시 만들었어요` : '고른 앱을 다시 만들었어요', '캐릭터 휴대폰');
        } catch (err) { toastr.error(String(err?.message || err), '다시 만들기'); }
        finally { making = false; if (!phoneClosed) drawPhone(true); }
    });
    $root.on('click', '.na_ph_storyreset', async e => {
        e.stopPropagation();
        if (making || busyMake || investing || filling.size || placeReading || prepLinking) return toastr.info('생성 중인 작업이 끝난 뒤 다시 시도해 주세요');
        const scope=phoneChatScope(ctx());
        if (!await askSheet('이 방의 폰을 새로 시작할까요?', '모든 인물의 폰이 지워져요.', '새로 시작')) return;
        if(getMeta()!==realM || phoneChatScope(ctx())!==scope || making || busyMake || investing || filling.size || placeReading || prepLinking) return toastr.info('생성 중인 작업이 끝난 뒤 다시 시도해 주세요');
        resetPhoneStory(m,scope);profileStates.clear();profileDrafts.clear();remake.clear();view='lock';
        await saveMeta();applyInjection();draw();
    });
    $root.on('click', '.na_ph_setdel', async e => {
        e.stopPropagation();
        if (!await askSheet(`${owner}의 폰을 지울까요?`, '', '지우기')) return;
        const was = phone()?.inject;
        delete m.phones[nameKey(owner)];
        // its unsaved rounds (복구) go with it
        try { const sc = typeof m.phoneJournal === 'string' ? m.phoneJournal : phoneChatScope(ctx()); journalWrite(sc, journalRead(sc).filter(r => nameKey(r.owner) !== nameKey(owner))); } catch { /* no journal here */ }
        // (실시간: on to another 실시간 phone if there is one; none, the card that says so)
        if (live()) owner = liveOwner();
        view = 'lock'; draw();
        await saveMeta();
        if (was) applyInjection();
    });
    draw();
    // the home board is 390 px wide: --k scales it to whatever width the screen has now
    const frame = $root.find('.na_ph_frame')[0];
    const fit = () => { const w = frame.clientWidth - 14; if (w > 0) frame.style.setProperty('--k', String(w / CG_W)); };
    const ro = new ResizeObserver(fit);
    ro.observe(frame);
    // the phone's own boxes never scroll (overflow: hidden): a focused field makes the browser roll them up to show it (a
    // phone's keyboard does too), and the frame keeps that across screens. Put back at once; the screens' own lists still scroll
    frame.addEventListener('scroll', e => { const t = e.target; if (t instanceof Element && t.matches('.na_ph_frame, .na_ph_scr, .cg_canvas, .ax_canvas') && t.scrollTop) t.scrollTop = 0; }, true);
    cgFonts();
    const dlg = document.createElement('dialog');
    dlg.className = 'popup na_phl';
    dlg.id = 'na_phl';
    dlg.append($root[0]);
    document.body.append(dlg);
    // toasts sit in the top layer with the phone, then go back
    let toasts = document.getElementById('toast-container');
    if (!toasts) { toasts = document.createElement('div'); toasts.id = 'toast-container'; if (toastr.options?.positionClass) toasts.classList.add(toastr.options.positionClass); }
    dlg.append(toasts);
    dlg.showModal();
    // the phone's height is the screen's, but not while typing: a keyboard that shrinks the page (some phones' browsers)
    // would shrink the whole phone, so the height taken before the keyboard stays and the keyboard covers the bottom
    const typing = () => { const a = document.activeElement; return !!a && dlg.contains(a) && (a.matches('input, textarea, select') || a.isContentEditable); };
    // (a touch screen whose height drops a lot at the same width is a keyboard opening, even when the focus has moved for a
    // moment, as a screen redrawn while typing: the height stays; a turn of the phone changes the width and is taken)
    let lastW = window.innerWidth, lastH = window.innerHeight;
    const setH = () => {
        const w = window.innerWidth, h = window.innerHeight, kb = w === lastW && h < lastH - 120 && window.matchMedia?.('(pointer: coarse)').matches;
        if (typing() || kb) return;
        lastW = w; lastH = h; dlg.style.setProperty('--na-phh', `${h}px`);
    };
    const afterType = () => setTimeout(setH, 350);
    setH(); window.addEventListener('resize', setH); dlg.addEventListener('focusout', afterType);
    // a make of this phone that another opening started: its end shows the phone (the prep screen's views give way to the lock)
    const onMade = (mm, who) => {
        if (phoneClosed || mm !== m || nameKey(who) !== nameKey(owner) || !stillHere()) return;
        if (phone() && ['prep', 'setdraft', 'setdraftmodel', 'setscreenholder', 'setprofile'].includes(view)) view = 'lock';
        draw();
    };
    madeWatch.add(onMade);
    const stopBusy = watchBusy(() => { if (!phoneClosed && stillHere() && (view === 'set' || view === 'setsync')) drawPhone(true); });
    // (실시간으로 열면: 닫힌 사이 남은 답장 일을 이어서)
    if (live()) obGo();
    await new Promise(done => {
        const close = () => { if (dlg.open) dlg.close(); };
        // ✕, Esc, or a tap on the dark around the phone (the sheet closes first)
        $root.on('click', '.na_ph_quit', e => { e.stopPropagation(); close(); });
        $root.on('click', '.na_ph_wrap', e => { if (e.target === e.currentTarget) { if (sheetOpen) setSheet(false); else close(); } });
        dlg.addEventListener('cancel', e => { e.preventDefault(); if (ask) ask.done(false); else if (sheetOpen) setSheet(false); else close(); });
        dlg.addEventListener('close', () => { phoneClosed = true; setPhoneMeta(null); if (liveMode(realM) === 'live' && stillHere()) obReflect(); ask?.done(false); done(); }, { once: true });
    });
    stopBusy(); madeWatch.delete(onMade);
    window.removeEventListener('resize', setH);
    ro.disconnect();
    const t = dlg.querySelector('#toast-container');
    if (t) { if (t.childNodes.length) document.body.append(t); else t.remove(); }
    dlg.remove();
}
// the board's fonts (Inter Tight for numbers, Noto Sans KR), once
function cgFonts() {
    if (document.getElementById('na_cg_fonts')) return;
    $('head').append('<link id="na_cg_fonts" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@100;200;300;400;500;600&family=Noto+Sans+KR:wght@300;400;500;600;700&family=Noto+Serif+KR:wght@400;500;600&display=swap">');
}
