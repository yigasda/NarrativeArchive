// 캐릭터 휴대폰: one character's phone as the story stands — messages, calls, photos (captions, no pictures), notes,
// searches, a calendar and the places they have been. The draft model writes the content as JSON from the archive; the
// screens are drawn here, the same for everyone. Texts are in the language the writer would use, with Korean under them.
// m.phones = { [name key]: { owner, country, wall, accent, now, contacts, threads, calls, photos, notes, searches, events,
//   upto (the last message number the archive held), at, inject } }

import { phoneChatScope, phoneTarget, ensurePhoneStory, resetPhoneStory } from './phonestory.js';
import { dateOrderOf, needsDateOrder, setDateOrder, setScreenHolder, ensureScreenHolder, screenHolderChoices, setOwnerLives, setPlaceCity, cityChoices, answerOwnerAsk, dropPlacePerson, placeInfo, countryOf, countryZones, phonePre, setPreYear, screenHolderLabel } from './phonedata.js';
import { profileEntries, resolvePhoneProfile, currentPersonaBinding } from './phoneprofile.js';
import { investmentScreen } from './investui.js';
import { validDate } from './investdata.js';
import { migrateBank, selectPrice } from './finance.js';
import { askDraft, draftReady, draftSettings, drLabel, listModels, vxModelList, withSpinner } from './ai.js';
import { ctx, getMeta, globalSettings, phoneMeta, saveGlobal, saveMeta, setPhoneMeta } from './core.js';
import { applyInjection } from './inject.js';
import { faceHtml, faceOf, stFace, nameKey, peopleList, shrinkFace } from './people.js';
import { drafting, drawing, drawPhoto, drawPost, filling, paging, retranslate, retranslating, recording, searching, searchPage, shooting, webPage, writing } from './phoneai.js';
import { setDraft, setDraftModels, setLang, setSnap, setVoice, setVoiceAdd, voiceList, voicePeople, ax, axFind, groupInfo, APPS, AXB, AXB_C, busyHtml, setDate, setScreenHolderView, callScreen, callWho, calOne, calScreen, camScreen, contactOne, contactsScreen, diaryOne, diaryScreen, draftView, ic, looksSheet, mailOne, mailScreen, mapScreen, mapTowns, msgList, noteOne, noteScreen, photoScreen, photoView, REMAKE_MORE, setLore, setRemake, setScreen, setTheme, setOwnerProfile, setWho, snsPost, snsScreen, statusBar, threadScreen, setPlace, prepScreen } from './phoneapps.js';
import { phoneMaking, dropStretch, chatStamp, koGaps, savedName, ensureIds, hasDatedRecords, noArchive, koOn, loreOff, tidyKo, markAfter, phoneLore, REMAKE, restoreRounds, showNow, syncLeft, syncRows, syncState, tidyJournal, undoRound } from './phonedata.js';
import { busy, watchBusy, exclusive, journalRead, journalWrite, syncOf } from './phonesync.js';
import { syncPick, syncSettings } from './phonesyncui.js';
import { CG_W, homeScreen, lastSig, lockScreen, threadNew } from './phonehome.js';
import { bankDisplayCurrency, bankAcct, bankHome, bankTx, fixedScreen, bankNotes, bankSend, bankStmt, txDoc, bankMore, cardView, orderView, passView, trackView, shopScreen, voiceOne, voiceScreen, walletScreen } from './phonemoney.js';
import { marksScreen, pageView, searchOne, searchScreen, tabsScreen } from './phoneweb.js';
import { fillShopMenus, menuWanted } from './phonelife.js';
import { alarmScreen, setStory, cartScreen, cityList, cityScreen, clockScreen, compareScreen, dlvScreen, fileScreen, filesScreen, folderScreen, healthScreen, heartScreen, hereWidget, itemScreen, orderScreen, ordersScreen, payScreen, rateScreen, shopScreen2, sleepScreen, stepsScreen, timerScreen, waterScreen, weatherScreen, weightScreen, workScreen, worldScreen } from './phonelifeapps.js';
import { screenTimeScreen } from './phonestime.js';
import { mapCityScreen, mapEmptyScreen, mapResults, mapSearchScreen } from './phonemapsearch.js';
import { placeNames } from './phonemapfind.js';
import { FLAG_NAME, flagSvg } from './phoneflags.js';
import { mapZoom } from './phonemapzoom.js';
import { tileWatch } from './phonetilemap.js';
import { glossaryEntries, openGlossary } from './translate.js';
import { dropVoice, fillKo, koAppOf, koScopeOf, labelVoices, redoKo, roundScope, tickLang } from './phonetr.js';
// 을 / 를 after a word: by its last syllable's final consonant (a Latin ending, like SNS, reads as 를)
const josa = w => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? '을' : '를'; };
import { confirm, esc } from './util.js';
import { emojiOf, reactOf } from './phone2react.js';
import { liveMode, liveWorld, livePhone, liveMeta, setLiveMode, resetLive, rememberLiveOwner, readLiveOwner, liveKey, liveRooms, ensureRoom, nameRoom, sendLive, readLive, unreadBy, enqueueReplies, seeFailure } from './phone2store.js';
import { shiftLabel, liveWall, viewerWall, startShift } from './phone2clock.js';
import { orbitList, orbitRoom, orbitNew, orbitHomeWidget, liveStart, whoScreen, orbitFace, dayIcon } from './phoneorbit.js';
import { beginFromStory, liveBranched, adoptChat, rebeginFromStory, rebeginKeepingChats } from './phone2story.js';
import { liveSnapNow, snapParts } from './phone2snap.js';
import { liveEditMessage, liveReact, liveReactQuick, liveGo, liveReflect, liveCanUndo, liveUndo, liveUnreflected, liveNowOf, liveSnapBusy, liveBackCount, liveBackDraft, liveBackPut, liveImportPlan, liveImportFilePlan, liveImportChat, liveImportFile, liveDropMessages, liveSwipeInfo, liveSwipe, liveSwipeDrop, liveRetranslate, liveSwipeList, liveSwipeDropMany, liveSwipeDropOthers } from './phone2go.js';
import { liveYearsNow } from './phone2year.js';
import { P } from './phone2api.js';
import { morph } from './morph.js';

// other files keep importing these from here (주입: 실시간 폰의 폰들도 같이, 주입이 꺼진 폰은 빼고)
export const phoneBlock = m => P.phoneBlock(m, Object.values(liveWorld(m)?.phones || {}));

// what 초안 모델's screen shows (the key only by its last four)
const draftUi = () => { const t = draftSettings(); let host = ''; try { host = t.url ? new URL(t.url).host : ''; } catch { host = t.url; }
    return { mode: t.mode, label: drLabel(), model: t.model, url: t.url, host, keyTail: t.key ? `…${String(t.key).slice(-4)}` : '', fmt: t.fmt, effort: t.effort, vxModel: t.vxModel, vxLocation: t.vxLocation, okAt: t.okAt }; };
// 초안 모델 › 모델: which setting the list fills, and the list (the address's, loaded; or SillyTavern's Vertex models)
const draftKey = () => (draftSettings().mode === 'vertex' ? 'vxModel' : 'model');
const draftIds = () => (draftSettings().mode === 'vertex' ? vxModelList() : draftSettings().models || []);
// a make that ends tells every phone open now (one shut and opened again mid-make draws the phone it made)
const madeWatch = new Set();
function screen(p, view, m, roster, ui) {
    // (타임라인은 예전 그대로 P.storyNow(p), 실시간만 서랍의 흐르는 시계)
    const now = P.nowOn(p, phoneMeta());
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
        : v === 'diary' ? diaryScreen(p, now, i || '') : v === 'diaryone' ? diaryOne(p, now, Number(i)) : v === 'setsync' ? syncSettings(p, now, ui) : v === 'setsyncpick' ? syncPick(p, now, ui) : v === 'set' ? setScreen(p, now, m, ui) : v === 'stime' ? screenTimeScreen(p, now, i || '') : v === 'settheme' ? setTheme(p, now) : v === 'setscreenholder' ? setScreenHolderView(p, now, m, ui.holderBack) : v === 'setdate' ? setDate(p, now, m, ui) : v === 'setplace' ? setPlace(p, now, m, ui) : v === 'setdraft' ? setDraft(p, now, draftUi(), ui.draftBack || 'set') : v === 'setdraftmodel' ? setDraftModels(p, now, draftIds(), draftSettings()[draftKey()] || '', draftSettings().mode === 'custom') : v === 'setvoice' ? setVoice(p, now, ui.voicePick, ui.voiceBusy) : v === 'setsnap' ? setSnap(p, now, phoneMeta()?.phoneSnap, snapParts(phoneMeta()?.phoneSnap)) : v === 'setlang' ? setLang(p, now, i) : v === 'setvoiceadd' ? setVoiceAdd(p, now, ui.voiceAdd, ui.voiceBusy) : v === 'prep' ? prepScreen(p, now, m, ui.prep) : v === 'setremake' ? setRemake(p, now, ui, m) : v === 'setprofile' ? setOwnerProfile(p,now,ui.profileState,!!ui.phones?.live) : v === 'setwho' ? setWho(p, now, m, ui) : v === 'setlore' ? setLore(p, now, m, ui)
        : v === 'cam' ? camScreen(p, now, i === undefined ? -1 : Number(i), shooting.has(nameKey(p.owner))) : v === 'livestart' || v === 'liveimport' ? liveStart(p, now, ui.start) : v === 'orbit' ? orbitList(p, now, ui.orbit) : v === 'orbitroom' ? orbitRoom(p, now, ui.orbit) : v === 'orbitnew' ? orbitNew(p, now, ui.orbit) : v === 'orbitface' ? orbitFace(p, now, ui.orbit) : homeScreen(p, now, m, 1, '', ui.orbitHome || '');
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
        for (const p of Object.values(realM.phones || {})) if (p?.owner) { try { const r = await P.settleBranch(realM, p); if (r) done.push({ name: p.owner, p, ...r }); } catch (err) { console.error('[narrative-archive] branch', p?.owner, err); } }
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
    // (가져온 채팅뿐인 실시간 폰: 폰은 없고 방만 있어요. 그 방의 캐릭터가 폰 만들기 준비의 주인)
    const liveGuest = () => { const w = liveWorld(realM); if (!w) return ''; for (const r of liveRooms(realM)) { const n = r.members.find(x => liveKey(x) !== liveKey(w.persona)); if (n) return n; } return ''; };
    const liveOwner = () => { const ns = liveNames(), last = readLiveOwner(realM, selectionKey); return ns.find(n => nameKey(n) === nameKey(last)) || ns[0] || liveGuest() || null; };
    let owner = live() ? liveOwner() : selectedPhoneOwner(m, names, who, readPhoneSelection(selectionKey));
    if (owner && !live()) { rememberPhoneSelection(m,owner,selectionKey); await saveMeta(); }
    if (!stillHere()) return;
    // snapping: 실시간을 시작하기 전 이야기 요약본을 만드는 중 (그동안 다른 폰 작업은 기다려요); snapLabel: 시작 버튼 글
    let snapping = false, snapLabel = '';
    // 롤플에 전하기: backing = 글 받는 중(snapping도 같이 켜서 다른 폰 작업을 막아요), obBack = 미리 보기 { draft, text }
    let backing = false, obBack = null;
    // 채팅을 메신저로 가져오기 (시안 phone2-import S1): lsPick = 고른 줄('story' | 'chat' | 'file', null이면 알아서), lsFile = 고른 파일 { text, names, messages, bubbles, again }, whoName = 첫 화면에 적던 이름
    let lsPick = null, lsFile = null, whoName = '';
    const whoTint = Math.floor(Math.random() * 5);   // (첫 화면 타일 색: 열 때마다 다섯 중 하나, 소망이 정함)
    const wallNow = (sh = 0) => { const a = viewerWall(Date.now(), sh).at; return { at: a, local: a.slice(6), date: `${Number(a.slice(0, 2))}월 ${Number(a.slice(3, 5))}일` }; };
    // 시작 · 가져오기 화면의 글: story = 이야기에서 시작 줄이 있는지(타임라인 폰이 있고 실시간 폰이 없을 때)
    const startUi = p => {
        const w = liveWorld(realM), story = !w && !!p, chat = liveImportPlan(realM);
        const base = story ? startPlan(p) : { persona: w?.persona || ctx().name1 || 'Me', ...wallNow(w?.dayShift || 0), shift: shiftLabel(w?.dayShift || 0) };
        const ok = { story, chat: chat.messages > 0, file: !!lsFile }, pick = lsPick && ok[lsPick] ? lsPick : story ? 'story' : ok.chat ? 'chat' : ok.file ? 'file' : '';
        return { ...base, upto: story ? base.upto : null, pick, chat, file: lsFile, back: w ? 'orbitnew' : p ? 'set' : owner ? 'prep' : 'who', title: w ? '채팅 가져오기' : '실시간', busy: snapping ? snapLabel : '' };
    };
    const appWrap = (v, body) => `<div class="na_ph_scr app ax ax_${v} v_${v}"><div class="cg_canvas ax_canvas">${body}</div></div>`;
    let investing = false, making = false, busyMake = null, placeReading = false, prepLinking = false, prepOpen = false, prepFrom = false;  // 폰 만들기 준비: linking, 1~4 shown again, 인물 정보 opened from it
     // busyMake: 'sync' | 'make' while a reflection or a make runs
    for (const p of Object.values(m.phones)) migrateBank(m, p);
    // phones from before 날짜 및 시간 get their year (or none) once
    if (Object.values(m.phones).filter(p => p?.owner).map(p => P.ensureYear(m, p)).some(Boolean)) await saveMeta();
    if (!stillHere()) return;
    if (Object.values(m.phones).some(p => p.money)) await saveMeta();
    if (!stillHere()) return;
    // 실시간: the drawer is made once for its world and kept (a new one each time would copy the glossary again)
    let drawer = null;
    const useMode = () => { m = live() ? (drawer?.w === liveWorld(realM) ? drawer.d : (drawer = { w: liveWorld(realM), d: liveMeta(realM, { now: liveNowOf(realM) }) }).d) : realM; setPhoneMeta(m === realM ? null : m); };
    // 실시간: the phones' year by the running clock once the drawer is ready, before anything is drawn (a new year since
    // the last reflection shows at once); saved only when one changed
    const yearsNow = async () => { if (!live()) return; try { if (liveYearsNow(m)) await saveMeta(); } catch (err) { console.warn('[narrative-archive] live years', err); } };
    useMode();
    await yearsNow();
    const liveRoster = () => new Set(liveNames().map(nameKey));
    // Orbit (실시간 폰의 메신저, docs/design/orbit.md): 계정은 페르소나(쓰기)와 이 폰 주인(읽기만) 둘. 왼쪽 위 얼굴 → 아래 시트로 바꿔요
    let obTab = 'all', obPick = [], obGname = '', obWho = '', obSheet = false, obDraft = '';
    const obOpen = new Set();   // 한국어를 기본과 반대로 둔 말들
    // 말 고치기 (시안 phone2-edit M3 · W3): obHeld = 길게 눌린 말의 id, obPicks = 고르는 중인 말들(Set) 또는 null, obTr = 번역 중인 말들, obEditAt = 그 방
    // obFix: 고치는 중인 말 { id, t: 원문, k: 한국어, at: 'k'면 한국어 칸에 초점 } (시안 docs/mockups/shell-bars E2, 소망) 또는 null
    let obHeld = null, obPicks = null, obEditAt = '', obList = null, obFix = null;   // obList: 받아 둔 답장 창에서 고른 번호들(Set), 닫혀 있으면 null
    const obTr = new Set();
    // 방은 최근 말만 그려요(마리나라처럼): 처음엔 마지막 OB_PAGE개, 위쪽 끝 가까이(OB_NEAR px) 굴리면 OB_PAGE개씩 더. 말이 300개인 방을
    // 다 그리면 요소가 1300개가 넘어서, 뭘 누를 때마다 모양 · 자리 계산이 한참 걸렸어요(소망: 버벅임).
    // obFrom = 위에 안 그린 말 수(방을 열 때 정해요, null = 아직), obDrawn = 마지막으로 그린 방과 그때의 obFrom, obGrow = 방금 위로 늘렸어요(그린 뒤 자리 맞추기)
    const OB_PAGE = 60, OB_NEAR = 1200;
    let obFrom = null, obDrawn = null, obGrow = false;
    const obMore = el => {
        if (phoneClosed || !obFrom || obFix || !obDrawn || obDrawn.v !== view || obDrawn.from !== obFrom) return;   // (obDrawn.from !== obFrom: 늘린 게 아직 안 그려졌어요)
        el = el || $root.find('.ob_msgs')[0];
        if (!el || !el.clientHeight || el.scrollTop > OB_NEAR) return;
        obFrom = Math.max(0, obFrom - OB_PAGE); obGrow = true;
        drawPhone(true);
    };
    const roomNow = () => (view.startsWith('orbitroom:') ? liveWorld(realM)?.messenger?.rooms?.[view.slice(10)] || null : null);
    // 지금 계정: 폰 주인 계정은 주인이 페르소나가 아닐 때만, 그 폰을 보고 있을 때만
    const obAcct = () => { const w = liveWorld(realM), me = w?.persona || ''; return obWho && owner && liveKey(obWho) === liveKey(owner) && liveKey(owner) !== liveKey(me) ? owner : me; };
    // 실시간 폰 시작 (5단계): 이야기 날짜 + 현실 시각(startShift), 마지막 메시지까지
    function startPlanOf(p) {
        const at = String(P.storyNow(p) || p?.now || ''), tz = placeInfo(p).owner.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
        let dayShift = 0; try { dayShift = startShift({ storyAt: at.slice(0, 11), storyYear: Number(p?.year) || new Date().getFullYear(), tz }); } catch { dayShift = 0; }
        const w = viewerWall(Date.now(), dayShift).at, md = x => `${Number(x.slice(0, 2))}월 ${Number(x.slice(3, 5))}일`;
        return { dayShift, persona: ctx().name1 || 'Me', local: w.slice(6), date: md(w), shift: shiftLabel(dayShift), upto: /^\d{2}-\d{2} \d{2}:\d{2}/.test(at) ? `${md(at)} ${at.slice(6, 11)}까지` : '' };
    }
    const startPlan = startPlanOf;
    const orbitUi = () => {
        const w = liveWorld(realM);
        if (!live() || !w) return {};
        if (obEditAt !== view) { obHeld = null; obPicks = null; obList = null; obFix = null; obFrom = null; obEditAt = view; }
        const me = w.persona, who = obAcct(), ro = liveKey(who) !== liveKey(me), sh = w.dayShift || 0, vtz = Intl.DateTimeFormat().resolvedOptions().timeZone, vw = ms => viewerWall(ms, sh, vtz).at, today = vw(Date.now()).slice(0, 5), yday = vw(Date.now() - 864e5).slice(0, 5);
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
            out.orbit = { tab: obTab, back: ro ? null : { n: liveBackCount(realM), busy: backing, sheet: obBack ? { text: obBack.text, count: obBack.draft.count, more: obBack.draft.more } : null }, acct: { name: who, ro, sheet: obSheet && accts.length > 1, list: accts }, hero: hn ? { name: hn, city: cityOf(hn), local: liveWall(tzOf(hn), sh).at.slice(6) } : null, rooms: rooms.map(V.brief) };
        } else if (v === 'orbitnew') {
            if (ro) { view = 'orbit'; return orbitUi(); }
            const names = [...new Map([...Object.values(w.phones || {}).map(p => p?.owner), ...Object.values(w.messenger?.accounts || {}).map(a => a?.name)].filter(n => n && liveKey(n) !== liveKey(me)).map(n => [liveKey(n), n])).values()];
            out.orbit = { people: names.map(n => ({ name: n, sub: cityOf(n) })), picked: obPick, gname: obGname, imp: { messages: liveImportPlan(realM).messages } };
        } else if (v === 'orbitroom') {
            const r = roomNow();
            if (!r || !r.members.some(n => liveKey(n) === liveKey(who))) { view = 'orbit'; return orbitUi(); }
            const os = V.others(r), group = os.length > 1, chips = []; let thereAt = null;
            if (!group && tzOf(os[0])) { const there = liveWall(tzOf(os[0]), sh).at.slice(6), here = vw(Date.now()).slice(6); if (there !== here) thereAt = { icon: dayIcon(there), time: there }; }   // (머리줄 이름 바로 옆: 그 사람의 낮 · 저녁 · 밤 그림 + 현지 시각)
            const msgs = []; let day = '';
            // 맨 끝 답장 묶음: 내 마지막 말 뒤에 온 말들 (넘길 수 있을 때만 표시해요)
            const sw = ro ? null : liveSwipeInfo(realM, r.id), shown = r.messages.filter(seen), lastMine = shown.map(x => liveKey(x.from) === liveKey(me)).lastIndexOf(true);
            const reply = new Set(sw ? shown.slice(lastMine + 1).map(x => x.id) : []), lastReply = sw ? shown.at(-1)?.id : null;
            const reFresh = !OB_RE_SEEN.has(r.id);
            if (obFrom === null || obFrom >= shown.length) obFrom = Math.max(0, shown.length - OB_PAGE);
            for (let i = 0; i < obFrom; i++) if (shown[i].reacts?.length) obReacts(r.id, shown[i], true);   // (안 그린 옛 말의 반응은 본 것으로 쳐요: 나중에 위로 굴려 그릴 때 새 반응처럼 튀지 않게)
            for (const x of shown.slice(obFrom)) {
                const a = vw(x.at), d = dayOf(a);
                if (d !== day) { msgs.push({ day: d }); day = d; }
                const mine = liveKey(x.from) === liveKey(who);
                msgs.push({ id: x.id, mine, from: x.from, text: x.text, ko: x.ko || '', open: koOn() !== obOpen.has(x.id), time: mine ? a.slice(6) : '', tl: mine ? '' : a.slice(6), re: obReacts(r.id, x, reFresh), myre: reactOf(x, who)?.e || '', edited: !!x.edited, fix: !ro && obFix?.id === x.id ? { t: obFix.t, k: obFix.k } : null, unread: mine && !ro ? unreadBy(r, x).length : 0, held: !ro && obHeld === x.id, pick: !ro && obPicks ? obPicks.has(x.id) : undefined, wait: obTr.has(x.id), reply: reply.has(x.id), dots: reply.has(x.id) && x.id === lastReply });
            }
            // 답장을 기다리는 중이면 입력 중, 멈춘 실패가 있으면 그 줄(다시는 사람이 누를 때만). 1:1 머리 아래는 상대의 가장 최근 상태
            const jobs = w.queue?.jobs || [], typing = !ro && jobs.some(j => j.room === r.id && (j.state === 'waiting' || j.state === 'running'));
            const fail = ro ? null : jobs.find(j => j.room === r.id && j.state === 'failed' && !j.seen) || null;
            const state = group ? '' : [...r.messages].reverse().find(x => liveKey(x.from) === liveKey(os[0]) && String(x.state || '').trim())?.state || '';
            out.orbit = { id: r.id, fixing: !ro && !!obFix, quick: !ro && obHeld ? liveReactQuick(realM) : [], title: V.titleOf(r), group, there: thereAt, faceOf: !group && !ro ? os[0] : '', sub: group ? [...os, '나'].join(' · ') : state, chips, asOwner: ro, msgs, draft: obDraft, typing, snapBusy: typing && liveSnapBusy(realM), fail: fail ? { id: fail.id } : null, swipe: sw && !sw.coming ? { at: sw.at, count: sw.count } : null, picking: !ro && obPicks ? obPicks.size : null,
                list: !ro && obList ? (items => ({ items, picks: [...obList].filter(n => items.some(x => x.no === n)), busy: !!sw?.coming }))(liveSwipeList(realM, r.id)) : null };
        }
        if (v === 'orbitface') { if (!obFc) { view = 'orbit'; return orbitUi(); } out.orbit = { name: obFc.who, back: obFc.back, src: obFc.src, album: obFc.album.map((url, i) => ({ url, on: i === obFc.sel })), busy: obFc.busy }; }
        // 위쪽 시계: 내 계정으로 볼 때는 내 시간 (캐릭터 시간은 방 가운데 칩에만). 주인 계정으로 볼 때는 그 폰의 시간 그대로
        if (out.orbit && !ro) out.orbit.clock = vw(Date.now());
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
            try { await P.learnVoices(m, who, p); } catch (err) { console.warn('[narrative-archive] voices', err); }
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
        const base = placeInfo(p).owner.tz, a = zoneOff(tz), b = base ? zoneOff(base) : null, t = /(\d{2}):(\d{2})/.exec(String((live() ? P.storyNow(p, null, phoneMeta()) || p?.now : p?.now) || ''));
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
    // 손가락이 화면에 닿아 있는 동안에는 다시 그리지 않아요: 그리면 화면이 통째로 바뀌어서, 누르던 버튼이 사라지고 그 누름이 먹히지 않았어요
    // (답장이 오는 중 · 저장이 끝날 때 · 번역이 올 때처럼 뒤에서 그리는 일과 겹치면 "눌렀는데 안 됨", 소망). 손을 떼면 바로 그려요.
    // 길게 누르기처럼 닿은 채로 그려야 하는 곳은 ptrDown을 먼저 풀어요. 3초 넘게 닿아 있으면(떼는 신호를 놓쳤을 때) 그냥 그려요
    let ptrDown = false, ptrAt = 0, drawWait = null;
    const drawPhone = (keep = false) => {
        if (ptrDown && Date.now() - ptrAt < 3000) { drawWait = drawWait === null ? keep : drawWait && keep; return; }
        ptrDown = false; drawWait = null; drawNow(keep);
    };
    const ptrUp = () => { ptrDown = false; if (drawWait !== null) setTimeout(() => { if (drawWait !== null && !ptrDown && !phoneClosed) { const k = drawWait; drawWait = null; drawNow(k); } }, 60); };
    $root[0].addEventListener('pointerdown', () => { ptrDown = true; ptrAt = Date.now(); }, true);
    for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, ptrUp, true);
    // 통째로 가는 화면 (코드가 그린 뒤에 직접 채우는 것): 다녀간 곳 지도 · 날씨 도시 · 프사 자르기
    const MORPH_OFF = /^(map|mapq|mapc|wcity|weather|orbitface)(:|$)/;
    // 시험용(window.NA_MORPH_CHECK): 바뀐 부분만 고친 화면이 통째로 그린 화면과 같은지 견줘요. 다르면 콘솔 오류
    const morphCheck = (frameEl, html, morphed) => {
        if (!morphed) return;
        const t = document.createElement('template'); t.innerHTML = html; const $t = $(t.content);
        if (!live() && window.NAShell) $t.find('.na_ph_scr').first().append('<span class="na_ph_notch" aria-hidden="true"></span>');
        if (live()) { $t.find('.na_ph_scr').first().append('<span class="na_ph_notch" aria-label="실시간 폰"><i></i></span>'); $t.find(`:is(${LIVE_OFF})`).remove(); $t.find('.ax_card').filter((_, c) => !c.children.length && !c.textContent.trim()).remove(); }
        if (sheet && (view === 'photo' || view === 'set')) $t.find('.na_ph_scr').append(looksSheet(m));
        // (속성 순서만 다른 건 같은 화면이에요: 이름순으로 다시 적어서 견줘요)
        const norm = root => { for (const e of root.querySelectorAll('*')) { const at = [...e.attributes].map(x => [x.name, x.value]).sort((x, y) => (x[0] < y[0] ? -1 : 1)); for (const [n] of at) e.removeAttribute(n); for (const [n, v] of at) e.setAttribute(n, v); } return root.innerHTML; };
        const c = frameEl.cloneNode(true); c.querySelectorAll('.pcf').forEach(e => e.remove());
        const a = norm(c), b = (() => { const d = document.createElement('div'); d.append(t.content); return norm(d); })();
        window.NA_MORPH_N = (window.NA_MORPH_N || 0) + 1;
        if (a !== b) { let i = 0; while (i < a.length && a[i] === b[i]) i++; console.error(`[narrative-archive] MORPH MISMATCH ${view} @${i}\n got: ${a.slice(Math.max(0, i - 80), i + 120)}\n want: ${b.slice(Math.max(0, i - 80), i + 120)}`); }
    };
    const drawNow = (keep = false) => {
        queueMicrotask(placeAsk);  // every way out of a redraw (some return early) puts the open sheet back
        const p = phone();
        // 실시간 with nobody on it (대화만 남기기 keeps the talk, not the phones): a way back to 타임라인 and to 새로 시작,
        // never the 타임라인 picker (its name would be the 타임라인's choice)
        if (live() && !owner) { $root.find('.na_ph_frame').html(`<div class="na_ph_scr glass w_dusk"><div class="na_ph_body na_ph_make"><div class="na_ph_makecard"><b>이 실시간 폰엔 아직 인물이 없어요</b><button type="button" class="na_ph_cardbtn na_ph_pmode" data-v="story">타임라인으로</button><div class="na_ph_makelinks"><button type="button" class="na_ph_livereset">실시간 폰 새로 시작</button></div></div></div></div>`); return; }
        // nobody to show yet (no people in the archive, no phone in this chat): the picker opens instead of a blank phone
        if (!owner) {
            // (시안 phone2-import R3) 이름 적기, 또는 메신저 채팅 가져오기(S1 화면). 실시간 폰이 이미 있으면 그리로
            if (view === 'livestart' && !liveWorld(realM)) $root.find('.na_ph_frame').html(appWrap('livestart', liveStart({}, wallNow().at, startUi(null))));
            else { view = 'who'; $root.find('.na_ph_frame').html(appWrap('newph', whoScreen(wallNow().at, { name: whoName, tint: whoTint, live: !!liveWorld(realM) }))); }
            placeAsk();
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
        // 인물은 있는데 타임라인 폰이 없는 채팅: 준비 화면의 "메신저 채팅 가져오기" → 가져오기 화면
        if (!p && !live() && view === 'livestart' && !liveWorld(realM)) { $root.find('.na_ph_frame').html(appWrap('livestart', liveStart({}, wallNow().at, startUi(null)))); placeAsk(); return; }
        // no phone yet: always 폰 만들기 준비 (the old 폰 만들기 card is gone; reopening the phone lands here too)
        if (!p && view !== 'prep' && view !== 'setdraft' && view !== 'setdraftmodel') { view = 'prep'; ensureScreenHolder(m).then(() => { if (!phoneClosed && !phone() && view === 'prep') drawPhone(true); }).catch(() => {}); }
        if (!p && view === 'prep') {
            const pre = phonePre(m, owner), key = nameKey(owner), bound = m.phoneProfiles?.[key], n = phoneLore(m).length;
            const stale = !pre ? '' : JSON.stringify(pre.financeProfile ?? null) !== JSON.stringify(bound ?? null) ? 'profile' : (pre.lore ?? loreKey()) !== loreKey() ? 'lore' : '';
            const top = keep ? $root.find('.ax_scroll').scrollTop() : 0;
            $root.find('.na_ph_frame').html(screen(pre || pendingProfile(), 'prep', m, roster, { prep: { pre: !!pre, open: !pre || prepOpen, profile: bound?.label || '', lore: n ? `${n}권` : '없음', loreN: n, gloss: glossaryEntries(m).length, order: dateOrderOf(m), holder: screenHolderLabel(m), stale, linking: prepLinking, making: busyMake === 'make' || phoneMaking(m, owner), draft: draftReady(), draftName: drLabel(), noArch: noArchive(m), imp: live() ? '' : liveWorld(realM) ? 'live' : 'go' } }));
            if (keep) $root.find('.ax_scroll').scrollTop(top);
            return;
        }
        if (!view.startsWith('thread:') || view !== msgView) { msgHeld = null; msgPick = null; msgView = view; }
        if (view !== 'setvoice' && !voiceBusy) voicePick = null;
        if (view === 'setvoice') voiceFill(p);
        if (view !== 'setvoiceadd' && !voiceBusy) voiceAdd = new Set();
        const top = keep ? $root.find('.na_ph_body, .ax_scroll').scrollTop() : 0;
        // (Orbit 방에서 위로 옛 말을 더 그릴 때: 지금 맨 위 말풍선이 화면 어디 있는지 적어 둬요. 그린 뒤 그 말이 같은 자리에 오게 굴려요)
        const obAnc = keep && obGrow ? (b => (b ? { id: b.dataset.id, y: b.getBoundingClientRect().top } : null))($root.find('.ob_msgs .ob_b[data-id]')[0]) : null;
        obGrow = false;
        // a screen that can't be drawn says why (and in the console), instead of leaving the phone blank or on another screen
        let html;
        tidyKo(p);
        if (view === 'livestart' && (live() || liveWorld(realM))) view = 'set';
        if (view === 'liveimport' && !live()) view = 'set';
        try { html = screen(p, view, m, live() ? liveRoster() : roster, { ...orbitUi(), start: view === 'livestart' || view === 'liveimport' ? startUi(p) : null, phones: { live: live(), hasSnap: live() && !!m.phoneSnap, snap: snapping ? snapLabel : '', has: !!liveWorld(realM), shift: shiftLabel(liveWorld(realM)?.dayShift), canUndo: live() && !!p && liveCanUndo(realM, p.owner), held: live() && !!p && Number.isInteger(p.liveHeld) && liveUnreflected(realM, p.owner) > 0, err: live() && p?.liveReflectError?.at ? viewerWall(p.liveReflectError.at, liveWorld(realM)?.dayShift || 0).at.slice(6) : '', names: live() ? liveNames() : null }, syncN: view === 'set' && !live() ? syncLeft(p, m) : null, syncRows: view.startsWith('setsync') ? syncRows() : [], syncWhy, syncPending, pickMore, loreExp, loreEnts, remake, contactBack, investing, profileState:profileStates.get(nameKey(p.owner)), placeReading, mapQ, msgHeld, msgPick, retr: retrKs, voicePick: view === 'setvoice' ? voicePick : null, voiceAdd, voiceBusy }); }
        catch (err) {
            console.error('[narrative-archive] phone screen', view, err);
            toastr.error(`${view} 화면을 그리지 못했어요: ${err?.message || err}`, '캐릭터 휴대폰');
            html = `<div class="na_ph_scr glass w_dusk"><div class="na_ph_body na_ph_make"><div class="na_ph_makecard"><b>화면을 그리지 못했어요</b><p>${esc(`${view}: ${err?.message || err}`)}</p><button type="button" class="na_ph_cardbtn" data-go="home">홈으로</button></div></div></div>`;
        }
        // 새 화면은 먼저 따로 만들어요(tpl: 화면에 붙기 전이라 그림도 안 받아요). 아래 손질까지 끝낸 뒤에 화면에 올려요
        const tpl = document.createElement('template'); tpl.innerHTML = html;
        const $new = $(tpl.content), frameEl = $root.find('.na_ph_frame')[0];
        // 실시간: the notch says which phone this is on every screen; 타임라인's data rows go
        // (껍데기 앱 안에서는 타임라인 폰에도 노치가 있어요: 기기 카메라 구멍을 가려요. 초록 점은 실시간 폰만)
        if (!live() && window.NAShell) $new.find('.na_ph_scr').first().append('<span class="na_ph_notch" aria-hidden="true"></span>');
        if (live()) { $new.find('.na_ph_scr').first().append('<span class="na_ph_notch" aria-label="실시간 폰"><i></i></span>'); $new.find(`:is(${LIVE_OFF})`).remove(); $new.find('.ax_card').filter((_, c) => !c.children.length && !c.textContent.trim()).remove(); }
        if (sheet && (view === 'photo' || view === 'set')) $new.find('.na_ph_scr').append(looksSheet(m));
        // 같은 화면을 다시 그릴 때는 바뀐 부분만 고쳐요(morph.js): 통째로 갈면 폰에서 버벅이고 깜빡였어요(소망).
        // 다른 화면으로 갈 때 · 코드가 직접 그림을 그려 넣는 화면(지도 · 프사 자르기 · canvas가 있는 화면)은 예전처럼 통째로 갈아요.
        // 못 고치면(오류) 통째로 갈아요
        const was = frameEl.firstElementChild, now = tpl.content.firstElementChild;
        const same = !!was && !!now && tpl.content.childElementCount === 1 && frameEl.childElementCount === 1 && was.className === now.className
            && !MORPH_OFF.test(view) && !frameEl.querySelector('canvas, video, iframe, .maplibregl-map') && !tpl.content.querySelector('canvas, video, iframe');
        let morphed = false;
        if (same) {
            try {
                morph(frameEl, tpl.content, { keepNode: n => n.classList.contains('pcf') });
                morphed = true;
                // (통째로 갈 때처럼: 위치를 지키라는 말이 없으면 맨 위에서 시작해요)
                if (!keep) for (const e of frameEl.querySelectorAll('*')) { if (e.scrollTop) e.scrollTop = 0; if (e.scrollLeft) e.scrollLeft = 0; }
            } catch (err) { console.error('[narrative-archive] phone morph', view, err); }
        }
        if (!morphed) $(frameEl).empty().append(tpl.content);
        if (window.NA_MORPH_CHECK) morphCheck(frameEl, html, morphed);
        placeAsk();
        trPop();
        notchPasses();
        if (keep) $root.find('.na_ph_body, .ax_scroll').scrollTop(top);
        // (폰은 화면에 맞춰 조금 늘려 그려요: 화면 px ÷ 배율 = 굴림 px. 배율은 큰 요소(말 목록)로 재요 — 작은 말풍선으로 재면 반올림 탓에 1%쯤 틀려서,
        // 한 번에 3000px 넘게 맞추면 30px씩 튀었어요. 남은 차이가 없을 때까지 최대 3번 맞춰요)
        if (obAnc) { const b = [...$root.find('.ob_msgs .ob_b[data-id]')].find(e => e.dataset.id === obAnc.id), box = b?.closest('.ob_msgs'); if (box) { const k = box.offsetHeight ? box.getBoundingClientRect().height / box.offsetHeight : 1; for (let i = 0; i < 3; i++) { const d = b.getBoundingClientRect().top - obAnc.y; if (Math.abs(d) < 0.5) break; box.scrollTop += d / k; } } }
        // (방을 그렸으면 적어 둬요. 그린 말이 화면을 못 채우거나 이미 위쪽 끝 가까이면 바로 더 그려요: 부른 쪽이 맨 아래로 굴린 뒤에 봐요)
        obDrawn = view.startsWith('orbitroom:') ? { v: view, from: obFrom } : null;
        if (obDrawn && obFrom) setTimeout(obMore, 0);
        if (view === 'orbitface') fcPaint();
        requestAnimationFrame(() => barsPaint(document.getElementById('na_phl'), view));
        if (obFix && view.startsWith('orbitroom:')) obFixFocus();
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
        try { p = await withSpinner($btn, update ? '반영하는 중' : '폰 만드는 중', () => P.makePhone(m, owner, { update })); } finally { busyMake = null; if (!update) for (const fn of [...madeWatch]) fn(realM, owner, live()); if (!phoneClosed && stillHere()) drawPhone(true); }
        if (!p) return;
        if (!update) view = 'lock';
        draw();
        if (!update) return toastr.success(`${owner}의 폰을 만들었어요`, '캐릭터 휴대폰');
        const r = p.syncLast;
        // the shops nearby, every 3 story days and 3 reflections (or at once on a move to another saved city): on their own, after the reflection
        P.refreshNearby(m, p, { read: !!r?.checked }).then(n => { if (n && !phoneClosed && phone() === p && /^(dlv|delivery)/.test(view)) drawPhone(true); }).catch(err => toastr.warning(String(err?.message || err), '동네 가게'));
        if (!r?.checked) return toastr.info('새로 읽을 대화가 없어요', '캐릭터 휴대폰');
        koRun(p, false);
        const head = `${r.checked}개 확인 · 남은 ${r.remaining}개`;
        const owed = p.sync?.owed?.money?.length || 0;
        const tail = `${r.failed.length ? ` · 넣지 못한 일 ${r.failed.length}개` : ''}${owed ? ` · 메시지 ${owed}개의 결제는 다음 반영 때 다시` : ''}`;
        toastr[r.failed.length || owed ? 'warning' : r.apps.length ? 'success' : 'info'](`${r.apps.length ? `${r.apps.join(' · ')}에 넣었어요` : '새로 넣은 건 없어요'}${tail}`, head);
    };
    // Investment calls are explicit; navigation and unresolved quote conflicts never trigger them.
    const investRun = async checkStory => {
        if (making || snapping) return toastr.info('폰을 다시 만드는 중이에요');
        if (investing) return;
        const p = phone(), date = $root.find('.iv_date').val();
        investing = true; drawPhone(true);
        try { await (p.investment ? P.refreshMarket(m, p, date, checkStory) : P.fillInvestment(m, p, date)); }
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
        if (making || snapping) return toastr.info('폰을 다시 만드는 중이에요');
        if (investing) return;
        const p = phone(), date = $root.find('.bank_fxdate').val(), base = bankDisplayCurrency(p);
        investing = true;
        try { await withSpinner($(this),'',()=>P.refreshBankFX(m,p,date,base)); }
        catch (err) { toastr.error(String(err?.message || err),'환율'); }
        finally { investing = false; if (phone() === p) drawPhone(true); }
    });
    let chartAttempt = '', phoneClosed = false;
    // 동네 가게 메뉴: normally filled right after the delivery app; one that failed is asked once more when the app is opened
    const menuTried = new Set();
    const autoMenu = async () => {
        if (phoneClosed || making || snapping || !/^(dlv|delivery|dshop:)/.test(view)) return;
        const p = phone();
        if (!(p?.delivery?.shops || []).some(menuWanted) || menuTried.has(owner)) return;
        menuTried.add(owner);
        try { if (await fillShopMenus(m, p) && !phoneClosed && phone() === p) drawPhone(true); }
        catch (err) { if (!phoneClosed && phone() === p) toastr.error(String(err?.message || err), '배달 메뉴'); }
    };
    const autoChart = async () => {
        if (phoneClosed || making || snapping || investing || !view.startsWith('stock:')) return;
        const p = phone(); if (!p?.investment) return;
        const [symbol,range='1m'] = decodeURIComponent(view.slice(6)).split('~');
        const request = `${owner}|${p.investment.date}|${symbol}|${range}`;
        if (chartAttempt === request) return;
        chartAttempt = request; investing = true; drawPhone(true);
        try { await P.fillChartHistory(m,p,symbol,range); }
        catch(err) { if (!phoneClosed && phone() === p) toastr.error(String(err?.message || err),'차트'); }
        finally { investing=false; if (!phoneClosed) drawPhone(true); }
    };
    $root.on('click', '.iv_refresh', () => investRun(false));
    $root.on('click', '.iv_sync', () => investRun(true));
    $root.on('click', '.iv_records', async function () {
        if (making || snapping) return toastr.info('폰을 다시 만드는 중이에요');
        if (investing) return;
        const p = phone(), mode = 'records', target = this.dataset.target || '';
        investing = true; drawPhone(true);
        try {
            const got = await P.collectInvestmentRecords(m, p, mode, target);
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
        try {await P.fillDevice(m,p);} catch(err) {state.deviceError=String(err?.message || err);}
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
    // 실시간: 막 만든 폰의 주인과 나의 방을 열어요 (방이 없으면 그대로)
    const openOwnerRoom = () => {
        const w = liveWorld(realM), r = liveRooms(realM).find(x => x.members.some(n => liveKey(n) === liveKey(owner)) && x.members.some(n => liveKey(n) === liveKey(w?.persona)));
        if (r) { obWho = ''; obDraft = ''; view = `orbitroom:${r.id}`; draw(); obBottom(); }
        obGo();
        return !!r;
    };
    const obBottom = () => { const e = $root.find('.ob_msgs')[0]; if (e) e.scrollTop = e.scrollHeight; };
    // (굴리기는 위로 안 올라오는 이벤트라 잡는 단계에서 들어요) 방을 위쪽 끝 가까이 굴리면 옛 말을 더 그려요
    $root[0].addEventListener('scroll', e => { if (e.target.classList?.contains('ob_msgs')) obMore(e.target); }, true);
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
    $root.on('click', '.na_ob_ko', function (e) { if (obHeld || obPicks || obJustHeld()) return; e.stopPropagation(); const id = this.dataset.id; if (obOpen.has(id)) obOpen.delete(id); else obOpen.add(id); const top = $root.find('.ob_msgs').scrollTop(); drawPhone(); $root.find('.ob_msgs').scrollTop(top); });
    // 말 고치기 · 답장 넘기기 (시안 phone2-edit M3 · W3). 주인 계정(읽기만)에서는 아무것도 안 열려요
    let obHoldT = null, obDown = null, obHeldAt = 0;
    const obJustHeld = () => Date.now() - obHeldAt < 500;
    // 길게 누르면 알약이 말 위에 생기면서 말이 아래로 밀려, 손가락을 뗀 자리가 알약 단추가 돼요(재번역 · 선택 · 삭제가 저절로 눌렸어요).
    // 그래서 길게 누른 그 손짓의 클릭은 한 번 삼켜요. 새로 누르면 풀려요
    let obSwallow = false;
    $root[0].addEventListener('pointerdown', () => { obSwallow = false; }, true);
    $root[0].addEventListener('click', e => { if (!obSwallow) return; obSwallow = false; e.preventDefault(); e.stopPropagation(); }, true);
    const obRoomId = () => (view.startsWith('orbitroom:') ? view.slice(10) : '');
    const obCanEdit = () => live() && !!obRoomId() && obAcct() === liveWorld(realM)?.persona;
    const obWarn = err => { console.warn('[narrative-archive] live edit', err); toastr.info(String(err?.message || err), '캐릭터 휴대폰'); };
    const obHoldStop = () => { clearTimeout(obHoldT); obHoldT = null; };
    $root.on('pointerdown', '.na_ob_b', function (e) {
        // (번역 줄 위에서 눌러도 길게 누르기가 돼요: 길게 누른 뒤의 클릭은 번역 접기로 안 가요 — obJustHeld · obSwallow)
        if (!obCanEdit() || obPicks || obFix) return;
        const id = this.dataset.id; obDown = { id, x: e.clientX, y: e.clientY, sw: this.classList.contains('na_ob_sw') };
        obHoldStop(); obHoldT = setTimeout(() => { obHoldT = null; obDown = null; obHeldAt = Date.now(); obHeld = id; obSwallow = true; navigator.vibrate?.(10); ptrDown = false; drawPhone(true); }, 480);
    });
    // (손가락은 누르고 있는 동안 조금 굴러요: 12px까지는 그대로 기다려요. 폰이 글자 선택 메뉴를 띄우면 길게 누르기가 취소돼서 말풍선은 글자 선택을 꺼 뒀어요)
    $root.on('pointermove', '.na_ob_b', e => { if (obDown && Math.hypot(e.clientX - obDown.x, e.clientY - obDown.y) > 12) obHoldStop(); });
    $root.on('contextmenu', '.na_ob_b', e => e.preventDefault());
    $root.on('pointercancel', () => { obHoldStop(); obDown = null; });
    $root.on('pointerleave', '.na_ob_b', () => { obHoldStop(); });
    // (맨 끝 답장을 옆으로 밀면 넘겨요: 왼쪽으로 밀면 다음, 오른쪽으로 밀면 앞)
    $root.on('pointerup', e => { obHoldStop(); const d = obDown; obDown = null; if (!d?.sw) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.5) obSwipe(dx < 0 ? 1 : -1); });
    // 시간 보기 (시안 docs/mockups/shell-bars time_drag.mp4, 소망): 캐릭터 말 위에서 오른쪽으로 끌면 말풍선이 16px 밀리고 얼굴 칸이 시간 칸이 돼요(--obt 0 → 1).
    // 맨 끝 답장 묶음은 밀면 답장을 넘기니까 빼요. 끝에서 살짝 무겁게 넘치고, 놓으면 살짝 튕기며 돌아가요. 세로로 먼저 움직이면 스크롤이에요
    let obT = null;
    const obTSet = v => { const mi = obT?.mi; if (!mi) return; obT.v = v; if (!obT.raf) obT.raf = requestAnimationFrame(() => { if (obT) { obT.raf = 0; mi.style.setProperty('--obt', obT.v.toFixed(3)); } }); };
    const obTEnd = () => {
        const t = obT; obT = null; if (!t?.on) return;
        if (t.raf) cancelAnimationFrame(t.raf);
        const done = () => { t.mi.style.removeProperty('--obt'); t.mi.classList.remove('ob_tdrag'); };
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
        const v0 = t.v, t0 = performance.now(), D = 380;
        const step = now => { const k = Math.min(1, (now - t0) / D), v = v0 * Math.exp(-5.5 * k) * Math.cos(8 * k); if (k >= 1 || !t.mi.isConnected) return done(); t.mi.style.setProperty('--obt', Math.max(-0.04, v).toFixed(3)); requestAnimationFrame(step); };
        requestAnimationFrame(step);
    };
    $root.on('pointerdown', '.v_orbitroom .ob_msgs', function (e) {
        if (obHeld || obPicks || obFix || e.target.closest('.na_ob_sw, .na_ob_ko, .ob_pill, .na_ob_swd')) return;
        const mi = this.querySelector('.ob_mi'); if (!mi || !mi.querySelector('.ob_tl')) return;
        obT = { mi, x: e.clientX, y: e.clientY, on: false, v: 0, raf: 0 };
    });
    $root.on('pointermove', e => {
        const t = obT; if (!t) return; const dx = e.clientX - t.x, dy = e.clientY - t.y;
        if (!t.on) { if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { obT = null; return; } if (dx > 8 && dx > Math.abs(dy) * 1.3) { t.on = true; t.x = e.clientX; obHoldStop(); obDown = null; obSwallow = true; t.mi.classList.add('ob_tdrag'); } else return; }
        const u = Math.max(0, e.clientX - t.x) / 56; obTSet(u <= 1 ? u : 1 + 0.08 * (1 - 1 / (1 + (u - 1) * 2)));
    });
    $root.on('pointerup pointercancel', () => { if (obT) obTEnd(); });
    const obSwipe = async dir => {
        const id = obRoomId(); if (!id || !obCanEdit() || obHeld || obPicks) return;
        // (넘긴 답장은 바로 보여요: 저장은 폰에서 몇 초 걸려서 뒤에서 기다려요 — obSoon)
        const pr = liveSwipe(realM, id, dir), bad = await obSoon(pr); if (bad) return obWarn(bad);
        if (!phoneClosed && stillHere()) { drawPhone(true); obBottom(); }
        try { const r = await pr; if (r?.fresh) obGo(); } catch (err) { obWarn(err); }
    };
    // 점을 누르면 받아 둔 답장 창 (넘기기는 밀어서). 창 안: 줄을 눌러 고르기, 지금 것만 남기기, 고른 것 버리기 — 지우기 전에 한 번 물어요
    const obListDraw = () => { const top = $root.find('.ob_sls').scrollTop(); drawPhone(true); $root.find('.ob_sls').scrollTop(top); };
    $root.on('click', '.na_ob_swd', e => { e.stopPropagation(); if (!obCanEdit() || obHeld || obPicks) return; obList = new Set(); drawPhone(true); const now = $root.find('.ob_slr.now')[0]; if (now) now.scrollIntoView({ block: 'nearest' }); });
    $root.on('click', '.na_ob_slx', e => { e.stopPropagation(); obList = null; drawPhone(true); });
    $root.on('click', '.na_ob_slr', function (e) { e.stopPropagation(); if (!obList) return; const n = Number(this.dataset.n); if (obList.has(n)) obList.delete(n); else obList.add(n); obListDraw(); });
    const obListDrop = async (ask, run) => {
        const id = obRoomId(); if (!id || !obList) return;
        if (!await askSheet(ask, '', '버리기')) return;
        const pr = run(id), bad = await obSoon(pr); if (bad) return obWarn(bad);
        const left = liveSwipeInfo(realM, id)?.count || 0; obList = left > 1 ? new Set() : null;
        if (!phoneClosed && stillHere()) obListDraw();
        try { await pr; } catch (err) { obWarn(err); }
    };
    $root.on('click', '.na_ob_slkeep', e => { e.stopPropagation(); obListDrop('지금 것만 남기고 버릴까요?', id => liveSwipeDropOthers(realM, id)); });
    $root.on('click', '.na_ob_sldrop', e => { e.stopPropagation(); const ns = [...(obList || [])]; if (ns.length) obListDrop(`${ns.length}개를 버릴까요?`, id => liveSwipeDropMany(realM, id, ns)); });
    $root.on('click', '.na_ob_hold', e => { if (obJustHeld() || e.target.closest('.ob_pill')) return; e.stopPropagation(); obHeld = null; drawPhone(true); });
    // (고르는 중엔 줄 전체가 눌려요: 말풍선 · 동그라미 · 옆 빈 곳 어디든. 동그라미만 누르면 안 켜졌어요)
    $root.on('click', '.na_ob_prow', function (e) { if (!obPicks) return; e.stopPropagation(); const id = this.dataset.id; if (obPicks.has(id)) obPicks.delete(id); else obPicks.add(id); drawPhone(true); });
    $root.on('click', '.na_ob_mpick', function (e) { e.stopPropagation(); obPicks = new Set([this.dataset.id]); obHeld = null; drawPhone(true); });
    $root.on('click', '.na_ob_pquit', e => { e.stopPropagation(); obPicks = null; drawPhone(true); });
    const obRetr = async ids => {
        const id = obRoomId(); if (!id || !ids.length) return;
        if (obTr.size) return toastr.info('번역하는 중이에요. 끝나면 다시 눌러 주세요', '캐릭터 휴대폰');
        ids.forEach(x => obTr.add(x)); obHeld = null; obPicks = null; drawPhone(true);
        try { const r = await liveRetranslate(realM, id, ids); if (r?.left > 0) toastr.info(`${r.left}개는 한 번 더 눌러 주세요`, '캐릭터 휴대폰'); }
        catch (err) { console.warn('[narrative-archive] live retranslate', err); toastr.warning(String(err?.message || err), '캐릭터 휴대폰'); }
        finally { obTr.clear(); if (!phoneClosed && stillHere()) drawPhone(true); }
    };
    const obDrop = async ids => {
        const id = obRoomId(); if (!id || !ids.length) return;
        if (!await askSheet(`${ids.length}개를 지울까요?`, '', '지우기')) return;
        const pr = liveDropMessages(realM, id, ids), bad = await obSoon(pr); if (bad) obWarn(bad);
        obHeld = null; obPicks = null; if (!phoneClosed && stillHere()) drawPhone(true);
        if (!bad) try { await pr; } catch (err) { obWarn(err); }
    };
    // 이모지 반응 (시안 docs/mockups/shell-bars Q2): 길게 누른 카드 윗줄. 같은 걸 다시 누르면 지워져요(liveReact가 해요).
    // "+"는 숨은 칸에 초점을 줘서 폰 키보드를 띄우고, 이모지 하나가 들어오면 달아요(글자는 liveReact가 거절해요)
    // 바로 실패했는지만 보고(검사는 저장 전에 끝나요) 저장은 기다리지 않아요 → 실패면 그 오류, 아니면 null
    const obSoon = async pr => { let err = null; pr.catch(e => { err = e; }); await null; await null; await null; return err; };
    const obReact = async (msgId, e) => {
        const id = obRoomId(); if (!id || !obCanEdit()) return;
        const pr = liveReact(realM, id, msgId, liveWorld(realM)?.persona, e), bad = await obSoon(pr);
        if (bad) obWarn(bad);
        obHeld = null; if (!phoneClosed && stillHere()) drawPhone(true);
        if (!bad) try { await pr; } catch (err) { obWarn(err); }
    };
    $root.on('click', '.na_ob_re', function (e) { e.stopPropagation(); obReact(this.dataset.id, this.dataset.e); });
    $root.on('click', '.na_ob_reany', function (e) {
        e.stopPropagation(); const box = this.querySelector('.ob_rein'); if (!box) return;
        box.value = ''; box.focus({ preventScroll: true });
    });
    $root.on('input', '.ob_rein', function () { const v = this.value.trim(); if (!v) return; const msgId = this.dataset.id; this.value = ''; this.blur(); obReact(msgId, v); });
    // 말 고치기 (시안 E2): 그 말풍선 자리에서 바로 고치고 밑의 ✕ · ✓. 원문을 고치면 한국어는 liveEditMessage가 지우고, 한국어가 있던 말이면 바로 다시 번역해요
    // 고치는 말풍선 + ✕ · ✓가 늘 보이게: 말 목록 안에서 위쪽 40% 언저리로 굴려요. 키보드가 올라오면 목록이 줄어서(--obkb) 그때마다 다시 맞춰요
    // (안 그러면 고치는 말이 화면 밖에 있고 다른 말만 옅게 보였어요, 소망)
    const obFixShow = (first = false) => {
        if (!obFix) return; const b = $root.find('.ob_fix')[0], box = b?.closest('.ob_msgs'); if (!b || !box) return;
        const bar = b.nextElementSibling?.classList.contains('ob_fbar') ? b.nextElementSibling : b, bt = b.getBoundingClientRect(), bb = bar.getBoundingClientRect(), r = box.getBoundingClientRect();
        // (보이는 아래 끝: 목록 끝 · 입력칸 위 · 키보드 위 중 가장 위)
        const inp = $root.find('.ob_inp')[0], vv = window.visualViewport;
        // (처음엔 키보드가 아직 안 올라왔어요: 키보드가 가릴 아래 절반은 없는 셈 치고 위쪽에 놓아요. 그래야 키보드가 올라올 때 다시 안 튀어요)
        const top = r.top, bot0 = Math.min(r.bottom, inp ? inp.getBoundingClientRect().top : r.bottom, vv ? vv.offsetTop + vv.height : r.bottom), bot = first ? Math.min(bot0, top + r.height * 0.45) : bot0;
        const k = b.offsetHeight ? bt.height / b.offsetHeight : 1, h = bb.bottom - bt.top;
        if (bt.top >= top + 24 && bb.bottom <= bot - 16) return;
        box.scrollTop += (bt.top - (top + Math.max(24, Math.min(64, (bot - top) * 0.4 - h / 2)))) / k;
    };
    let obVv = false;
    const obFixFocus = () => {
        if (!obVv && window.visualViewport) { obVv = true; window.visualViewport.addEventListener('resize', () => setTimeout(obFixShow, 60)); }
        const e = $root.find(obFix?.at === 'k' ? '.na_ob_fk' : '.na_ob_ft')[0]; if (!e) return;
        if (document.activeElement === e) return obFixShow();
        obFixShow(true);
        e.focus({ preventScroll: true }); try { const r = document.createRange(); r.selectNodeContents(e); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch { /* (no caret) */ }
    };
    const obFixOk = async () => {
        const f = obFix, id = obRoomId(); if (!f || !id || !obCanEdit()) return;
        const r = liveRooms(realM).find(x => x.id === id), x = r?.messages.find(y => y.id === f.id); if (!x) { obFix = null; drawPhone(true); return; }
        const t = f.t.replace(/\u00a0/g, ' ').trim(), k = f.k.replace(/\u00a0/g, ' ').trim(), change = {};
        if (t !== String(x.text || '').trim()) change.text = t;
        if (f.hasK && k !== String(x.ko || '').trim() && !('text' in change)) change.ko = k;
        if (!Object.keys(change).length) { obFix = null; drawPhone(true); return; }
        // (저장은 느려요 — 폰에서 4초쯤: 말은 바로 바뀌어 있으니 칸을 먼저 닫고 그리고, 저장은 뒤에서 기다려요. 못 고치는 글이면 저장 전에 바로 알려 줘요)
        const pr = liveEditMessage(realM, id, f.id, change), bad = await obSoon(pr);
        if (bad) { obWarn(bad); return; }
        obFix = null; if (!phoneClosed && stillHere()) drawPhone(true);
        try { await pr; } catch (err) { obWarn(err); return; }
        // (원문을 고쳤고 한국어가 있던 말이면 바로 재번역: 칸은 닫고 "번역 중". 실패하면 알림만, 고친 원문은 그대로 — 반영 쪽 요청, 소망)
        if ('text' in change && f.hasK) return obRetr([f.id]);
        if (!phoneClosed && stillHere()) drawPhone(true);
    };
    $root.on('click', '.na_ob_medit', function (e) {
        e.stopPropagation(); if (!obCanEdit()) return;
        const r = liveRooms(realM).find(x => x.id === obRoomId()), x = r?.messages.find(y => y.id === this.dataset.id); if (!x) return;
        obFix = { id: x.id, t: String(x.text || ''), k: String(x.ko || ''), hasK: !!x.ko, at: 't' }; obHeld = null; drawPhone(true);
    });
    $root.on('input', '.na_ob_ft, .na_ob_fk', function () { if (!obFix) return; if (this.classList.contains('na_ob_fk')) obFix.k = this.innerText; else obFix.t = this.innerText; });
    $root.on('focus', '.na_ob_ft, .na_ob_fk', function () { if (obFix) obFix.at = this.classList.contains('na_ob_fk') ? 'k' : 't'; });
    $root.on('keydown', '.na_ob_ft, .na_ob_fk', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); obFixOk(); } else if (e.key === 'Escape') { obFix = null; drawPhone(true); } });
    // (✕ · ✓는 누르는 순간 받아요: 손을 뗄 때까지 기다리면 칸이 초점을 잃어 키보드가 내려가고, 화면이 밀려 버튼이 손가락 밑에서 달아났어요 — 두 번 눌러야 했어요, 소망 녹화)
    $root.on('pointerdown', '.na_ob_fok, .na_ob_fno', function (e) { e.preventDefault(); e.stopPropagation(); obSwallow = true; ptrDown = false; if (this.classList.contains('na_ob_fok')) obFixOk(); else { obFix = null; drawPhone(true); } });
    $root.on('click', '.na_ob_fok, .na_ob_fno', e => { e.stopPropagation(); });
    $root.on('click', '.na_ob_mtr', function (e) { e.stopPropagation(); obRetr([this.dataset.id]); });
    $root.on('click', '.na_ob_ptr', e => { e.stopPropagation(); obRetr([...(obPicks || [])]); });
    $root.on('click', '.na_ob_mdel', function (e) { e.stopPropagation(); obDrop([this.dataset.id]); });
    $root.on('click', '.na_ob_pdel', e => { e.stopPropagation(); obDrop([...(obPicks || [])]); });
    $root.on('click', '.na_ob_swdel', async e => {
        e.stopPropagation(); const id = obRoomId(); if (!id) return;
        if (!await askSheet('이 답장을 지울까요?', '', '지우기')) return;
        const pr = liveSwipeDrop(realM, id), bad = await obSoon(pr); if (bad) obWarn(bad);
        obHeld = null; if (!phoneClosed && stillHere()) drawPhone(true);
        if (!bad) try { await pr; } catch (err) { obWarn(err); }
    });
    // 프사 바꾸기 (시안 phone2-edit sheetCrop C1 + 두 칸 갤러리): 1:1 방 머리줄의 얼굴 → 그 사람 색 전체 화면.
    // 사진은 인물 도감과 같은 저장소(확장 설정 faces, 모든 채팅이 같이 써요)에 들어가고, 모아 둔 사진은 faceAlbum[이름]에 남아요(사람마다 FACE_KEEP장까지).
    // obFc: { who, back, album: [데이터 URL], sel (고른 칸, -1 = 새 사진), src (틀에 올린 사진의 주소), file (새로 고른 파일), W, H, scale, min, tx, ty, busy }
    const FACE_S = 190, FACE_M = 12, FACE_V = FACE_S - FACE_M * 2, FACE_KEEP = 12;   // (FACE_S: 네모 틀, FACE_M: 틀과 동그라미 사이, FACE_V: 동그라미 = 잘라 쓰는 네모. css의 .of_stage · .of_ring과 같아야 해요)
    let obFc = null;
    const fcK = () => Number(frame?.style.getPropertyValue('--k')) || 1;
    const fcClamp = () => { const f = obFc; f.tx = Math.min(FACE_M, Math.max(FACE_M + FACE_V - f.W * f.scale, f.tx)); f.ty = Math.min(FACE_M, Math.max(FACE_M + FACE_V - f.H * f.scale, f.ty)); };
    const fcPaint = () => { const f = obFc; if (!f?.W) return; fcClamp(); $root.find('.na_of_img').css({ width: `${f.W * f.scale}px`, height: `${f.H * f.scale}px`, transform: `translate(${f.tx}px, ${f.ty}px)` }); $root.find('.na_of_th').css('--z', String(Math.min(1, Math.max(0, (f.scale / f.min - 1) / 4)))); };
    const fcZoom = (next, px = FACE_S / 2, py = FACE_S / 2) => { const f = obFc; if (!f?.W) return; next = Math.min(f.min * 5, Math.max(f.min, next)); f.tx = px - (px - f.tx) * next / f.scale; f.ty = py - (py - f.ty) * next / f.scale; f.scale = next; fcPaint(); };
    // a picture onto the frame: its size is read first (a tall one starts nearer its top, where the face is)
    const fcLoad = async (src, file = null, sel = -1) => {
        const f = obFc; if (!f) return;
        const im = new Image(); im.src = src;
        try { await im.decode(); } catch { toastr.error('그림을 못 읽었어요', '캐릭터 휴대폰'); return; }
        if (obFc !== f) return;
        Object.assign(f, { src, file, sel, W: im.naturalWidth, H: im.naturalHeight });
        f.min = FACE_V / Math.min(f.W, f.H); f.scale = f.min; f.tx = FACE_M + (FACE_V - f.W * f.scale) / 2; f.ty = FACE_M + (FACE_V - f.H * f.scale) * 0.25;
        if (!phoneClosed && view === 'orbitface') { const top = $root.find('.of_scroll').scrollTop(); drawPhone(true); $root.find('.of_scroll').scrollTop(top); fcPaint(); }
    };
    // (지금 쓰는 프사는 늘 맨 앞 칸에 있어요. 실리태번 아바타면 주소 그대로 — 이번에 열어 둔 동안만, 저장은 안 해요)
    const fcAlbum = who => { const g = globalSettings(), k = nameKey(who), a = Array.isArray(g.faceAlbum?.[k]) ? g.faceAlbum[k].filter(x => typeof x === 'string' && x.startsWith('data:')) : [], cur = faceOf(who, true), st = stFace(who, true), out = cur && !a.includes(cur) ? [cur, ...a] : a; return st && !out.includes(st) ? [...out, st] : out; };   // (실리태번 아바타는 따로 정한 프사를 쓰는 중에도 맨 끝 칸에 남아요: 그걸로 되돌릴 수 있게)
    const fcKeep = (who, album) => { const g = globalSettings(); g.faceAlbum = g.faceAlbum || {}; g.faceAlbum[nameKey(who)] = album.filter(x => x.startsWith('data:')).slice(0, FACE_KEEP); saveGlobal(); };
    $root.on('click', '.na_ob_face', function (e) {
        e.stopPropagation(); const who = this.dataset.n; if (!who) return;
        const album = fcAlbum(who), sel = album.indexOf(faceOf(who, true));
        obFc = { who, back: view, album, sel, src: '', file: null, W: 0, H: 0, scale: 1, min: 1, tx: 0, ty: 0, busy: false };
        obSheet = false;
        view = 'orbitface'; drawPhone();
        if (sel >= 0) fcLoad(album[sel], null, sel);
    });
    $root.on('click', '.na_of_pic', function (e) { e.stopPropagation(); const i = Number(this.dataset.i), u = obFc?.album[i]; if (u) fcLoad(u, null, i); });
    // 모아 둔 사진 지우기 (고른 칸의 ×): 한 번 묻고, 모아 둔 곳에서만 빼요 (지금 쓰는 프사는 그대로)
    $root.on('click', '.na_of_del', async function (e) {
        e.stopPropagation(); const f = obFc, i = Number(this.dataset.i); if (!f || f.busy || !f.album[i]) return;
        if (!await askSheet('이 사진을 지울까요?', '', '지우기')) return;
        if (obFc !== f) return;
        f.album.splice(i, 1); fcKeep(f.who, f.album);
        if (f.sel === i) Object.assign(f, { sel: -1, src: '', file: null, W: 0, H: 0 }); else if (f.sel > i) f.sel--;
        const top = $root.find('.of_scroll').scrollTop(); drawPhone(true); $root.find('.of_scroll').scrollTop(top); fcPaint();
    });
    // 더하기: 여러 장을 한 번에. 고른 사진은 가운데를 잘라 모아 두고(남아요), 첫 장을 틀에 올려요
    $root.on('click', '.na_of_add', e => {
        e.stopPropagation(); const f = obFc; if (!f || f.busy) return;
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
        inp.addEventListener('change', async () => {
            const files = [...(inp.files || [])].slice(0, FACE_KEEP); if (!files.length || obFc !== f) return;
            f.busy = true; let first = null;
            try { for (const file of files.reverse()) { const url = await shrinkFace(file); f.album = [url, ...f.album.filter(x => x !== url)].slice(0, FACE_KEEP); first = file; } fcKeep(f.who, f.album); }
            catch (err) { toastr.error(`그림을 못 읽었어요: ${err?.message || err}`, '캐릭터 휴대폰'); }
            finally { f.busy = false; }
            if (obFc !== f) return;
            if (first) { if (f.blob) URL.revokeObjectURL(f.blob); f.blob = URL.createObjectURL(first); await fcLoad(f.blob, first, 0); }
            else if (!phoneClosed) drawPhone(true);
        });
        inp.click();
    });
    // 틀: 끌어서 옮기기 · 두 손가락으로 크기 · 휠, 막대: 끌어서 크기 (화면이 줄어든 만큼 손가락 거리를 나눠요)
    const fcPts = new Map(); let fcPinch = null, fcBar = false;
    $root.on('pointerdown', '.na_of_stage', function (e) { if (!obFc?.W) return; try { this.setPointerCapture(e.pointerId); } catch { /* (no capture) */ } fcPts.set(e.pointerId, { x: e.clientX, y: e.clientY }); fcPinch = null; });
    $root.on('pointermove', '.na_of_stage', function (e) {
        if (!fcPts.has(e.pointerId) || !obFc?.W) return;
        const prev = fcPts.get(e.pointerId), k = fcK(); fcPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (fcPts.size === 1) { obFc.tx += (e.clientX - prev.x) / k; obFc.ty += (e.clientY - prev.y) / k; fcPaint(); return; }
        const [a, b] = [...fcPts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), r = this.getBoundingClientRect();
        if (fcPinch) fcZoom(obFc.scale * d / fcPinch, ((a.x + b.x) / 2 - r.left) / k, ((a.y + b.y) / 2 - r.top) / k);
        fcPinch = d;
    });
    $root.on('pointerup pointercancel', '.na_of_stage', e => { fcPts.delete(e.pointerId); fcPinch = null; });
    $root.on('wheel', '.na_of_stage', function (e) { if (!obFc?.W) return; e.preventDefault(); const o = e.originalEvent, r = this.getBoundingClientRect(), k = fcK(); fcZoom(obFc.scale * (o.deltaY < 0 ? 1.08 : 1 / 1.08), (o.clientX - r.left) / k, (o.clientY - r.top) / k); });
    const fcBarTo = (el, x) => { const r = el.getBoundingClientRect(), pad = 12 * fcK(); fcZoom(obFc.min * (1 + 4 * Math.min(1, Math.max(0, (x - r.left - pad) / (r.width - pad * 2))))); };
    $root.on('pointerdown', '.na_of_tr', function (e) { if (!obFc?.W) return; fcBar = true; try { this.setPointerCapture(e.pointerId); } catch { /* (no capture) */ } fcBarTo(this, e.clientX); });
    $root.on('pointermove', '.na_of_tr', function (e) { if (fcBar && obFc?.W) fcBarTo(this, e.clientX); });
    $root.on('pointerup pointercancel', '.na_of_tr', () => { fcBar = false; });
    // 이대로 쓰기: 틀 안의 네모를 잘라 그 사람의 프사로 (새로 고른 사진이면 모아 둔 첫 칸도 그 모양으로)
    $root.on('click', '.na_of_ok', async e => {
        e.stopPropagation(); const f = obFc; if (!f?.W || f.busy) return;
        f.busy = true; drawPhone(true); fcPaint();
        try {
            const blob = f.file || await (await fetch(f.src)).blob();
            // (모아 둔 사진을 손대지 않고 그대로 쓰면 그 그림 그대로: 다시 줄여 새 칸을 만들지 않아요)
            const asIs = !f.file && f.sel >= 0 && Math.abs(f.scale - f.min) < 1e-6 && (f.W === f.H || !f.album[f.sel].startsWith('data:'));
            const url = asIs ? f.album[f.sel] : await shrinkFace(blob, { sx: (FACE_M - f.tx) / f.scale, sy: (FACE_M - f.ty) / f.scale, ss: FACE_V / f.scale });
            // (실리태번 아바타를 그대로 고르면: 따로 정한 프사를 지워서 그 아바타가 다시 나오게)
            const g = globalSettings(); g.faces = g.faces || {}; if (url.startsWith('data:')) g.faces[nameKey(f.who)] = url; else delete g.faces[nameKey(f.who)];
            if (f.file) f.album[0] = url; else if (!f.album.includes(url)) f.album = [url, ...f.album];
            fcKeep(f.who, f.album);
            if (f.blob) URL.revokeObjectURL(f.blob);
            if (obFc === f) { obFc = null; view = f.back; }
        } catch (err) { f.busy = false; toastr.error(`그림을 못 읽었어요: ${err?.message || err}`, '캐릭터 휴대폰'); }
        if (!phoneClosed && stillHere()) drawPhone();
    });
    // 답장 돌리기 (7-5): liveGo 하나가 다 해요(이미 돌면 그냥 돌아와요). 그리기는 이 채팅 · 실시간일 때만, 입력하던 칸은 그대로
    const obGo = () => liveGo(realM, { onChange: () => {
        if (phoneClosed || !stillHere() || !live() || bkEditing()) return;
        const typingNow = document.activeElement?.classList?.contains('na_ob_in'), atEnd = (e => !e || e.scrollHeight - e.scrollTop - e.clientHeight < 40)($root.find('.ob_msgs')[0]);
        drawPhone(true);
        if (view.startsWith('orbitroom') && atEnd) obBottom();
        if (typingNow) obFocus();
    } }).catch(err => console.error('[narrative-archive] live go', err));
    // 반영(소망 결정): 메신저를 나갈 때만 · 폰을 닫을 때 · 타임라인으로 바꿀 때. 실시간 폰의 인물마다 쌓인 대화를 한 번에(읽을 게 없으면 바로 끝)
    const obReflect = () => { const w = liveWorld(realM); if (!w || (snapping && !backing)) return; (async () => { for (const p of Object.values(w.phones || {})) if (p?.owner) { const r = await liveReflect(realM, p.owner, { onChange: () => { if (!phoneClosed && stillHere() && live()) drawPhone(true); } }); if (r?.rounds) { const q = livePhone(realM, p.owner); if (q) await koRun(q, false, p.owner); } } })().catch(err => console.error('[narrative-archive] live reflect', err)); };
    // 롤플에 전하기 (시안 phone2-back A): 누르면 글 받기(그동안 버튼은 정리 중, 다른 폰 작업은 막혀요) → 미리 보기(고칠 수 있음) → 넣기.
    // 취소하면 아무것도 안 바뀌어요. 다시 누르면 글을 새로 받아요
    const bkEditing = () => !!obBack && document.activeElement?.classList?.contains('na_ob_bktx');
    $root.on('click', '.na_ob_back', async function (e) {
        e.stopPropagation();
        if (backing) return;
        if (making || snapping || busyMake || investing || koBusy || filling.size || busy.fill || busy.sync) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요', '캐릭터 휴대폰');
        if (!live() || !liveBackCount(realM)) return toastr.info('롤플에 전할 새 메신저 대화가 없어요', '캐릭터 휴대폰');
        backing = snapping = true; obBack = null; obSheet = false; drawPhone(true);
        let d = null;
        try { d = await liveBackDraft(realM); }
        catch (err) { console.warn('[narrative-archive] live back', err); toastr.warning(String(err?.message || err), '캐릭터 휴대폰'); }
        finally { backing = snapping = false; }
        if (d && stillHere() && live()) obBack = { draft: d, text: d.text };
        if (!phoneClosed && stillHere()) drawPhone(true);
    });
    $root.on('input', '.na_ob_bktx', function () { if (obBack) obBack.text = this.innerText; });
    $root.on('keydown', '.na_ob_bktx', e => e.stopPropagation());
    $root.on('paste', '.na_ob_bktx', e => { e.preventDefault(); const t = (e.originalEvent?.clipboardData || window.clipboardData)?.getData('text') || ''; document.execCommand('insertText', false, t); });
    $root.on('click', '.na_ob_bkno', function (e) { e.stopPropagation(); obBack = null; drawPhone(true); });
    $root.on('click', '.na_ob_bkok', async function (e) {
        e.stopPropagation();
        if (!obBack || backing) return;
        const b = obBack, t = $root.find('.na_ob_bktx')[0];
        if (t) b.text = t.innerText;
        backing = snapping = true;
        try { await liveBackPut(realM, b.draft, b.text); obBack = null; toastr.success('롤플에 넣었어요', '캐릭터 휴대폰'); }
        catch (err) { console.warn('[narrative-archive] live back put', err); toastr.warning(String(err?.message || err), '캐릭터 휴대폰'); if (/바뀌었어요/.test(String(err?.message))) obBack = null; }
        finally { backing = snapping = false; }
        if (!phoneClosed) drawPhone(true);
    });
    // 실시간 폰 설정 › 지난 반영: 방금 반영 되돌리기 · 다시 반영 (다른 폰 작업 중엔 폰 1 되돌리기처럼 막아요)
    $root.on('click', '.na_live_undo', async e => {
        e.stopPropagation();
        if (!live()) return;
        if (making || snapping || busy.sync || busy.fill) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요');
        const p = phone(), n = p?.syncLast?.checked || 0;
        if (!p || !await askSheet('방금 반영을 되돌릴까요?', `대화 ${n}개를 다시 읽게 돼요.`, '되돌리기')) return;
        if (making || snapping || busy.sync || busy.fill || phone() !== p || !live()) return;
        try {
            const kept = await liveUndo(realM, p.owner, { onChange: () => { if (!phoneClosed && stillHere() && live()) drawPhone(true); } });
            if (!phoneClosed && stillHere()) drawPhone(true);
            kept.length ? toastr.warning(`되돌렸어요. ${kept.join(', ')}은(는) 그 사이 바뀌어서 남겨뒀어요`, '캐릭터 휴대폰') : toastr.success('반영을 되돌렸어요', '캐릭터 휴대폰');
        } catch (err) { toastr.warning(String(err?.message || err), '되돌리기'); }
    });
    $root.on('click', '.na_live_rerun', async e => {
        e.stopPropagation();
        if (!live()) return;
        if (making || snapping || busy.sync || busy.fill) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요');
        const p = phone();
        if (!p) return;
        try { await withSpinner($(e.currentTarget), '반영 중', () => liveReflect(realM, p.owner, { force: true, onChange: () => { if (!phoneClosed && stillHere() && live()) drawPhone(true); } })); }
        catch (err) { console.error('[narrative-archive] live reflect', err); }
        if (!phoneClosed && stillHere()) drawPhone(true);
    });
    // 임시 시험 화면: 같은 이모지를 조건만 바꿔서. 번호를 보고 어느 조건에서 기기 이모지가 아닌지 봐요
    const obEmojiTest = () => {
        const E = '😘😂❤️', K = '그게 뭐예요 ', rows = [
            ['1 div 15px', `<div style="font-size:15px">${E}</div>`], ['2 div 12px', `<div style="font-size:12px">${E}</div>`], ['3 div 20px', `<div style="font-size:20px">${E}</div>`],
            ['4 span 15px', `<span style="font-size:15px">${E}</span>`], ['5 span 12px', `<span style="font-size:12px">${E}</span>`], ['6 i 12px', `<i style="font-size:12px;font-style:normal">${E}</i>`],
            ['7 div 15px 흐린색', `<div style="font-size:15px;color:rgba(30,32,40,.62)">${E}</div>`], ['8 div 12px 흐린색', `<div style="font-size:12px;color:rgba(30,32,40,.62)">${E}</div>`], ['9 div 15px 회색', `<div style="font-size:15px;color:#555a63">${E}</div>`],
            ['10 한글 뒤 15px', `<div style="font-size:15px">${K}${E}</div>`], ['11 한글 뒤 12px', `<div style="font-size:12px">${K}${E}</div>`], ['12 영어 뒤 12px', `<div style="font-size:12px">What is that ${E}</div>`],
            ['13 굵게 12px', `<div style="font-size:12px;font-weight:600">${E}</div>`], ['14 굵게 15px', `<div style="font-size:15px;font-weight:600">${E}</div>`],
            ['15 글꼴: 기기만', `<div style="font-size:15px;font-family:NADeviceEmoji,sans-serif">${E}</div>`], ['16 글꼴: sans만', `<div style="font-size:15px;font-family:sans-serif">${E}</div>`], ['17 기기만 12px', `<div style="font-size:12px;font-family:NADeviceEmoji,sans-serif">${E}</div>`],
            ['18 번역 줄 그대로', `<div class="ob_b th ob_glass" style="margin:0">x<span class="ob_ko">${K}${E}</span></div>`], ['19 원문 줄 그대로', `<div class="ob_b th ob_glass" style="margin:0">What ${E}</div>`], ['20 배지 그대로', `<span class="ob_re" style="position:static"><span class="ob_ree">😂</span></span>`],
            ['21 button 20px', `<button type="button" style="font-size:20px">${E}</button>`], ['22 button 12px', `<button type="button" style="font-size:12px">${E}</button>`],
        ];
        const host = $root.find('.na_ph_frame .cg_canvas')[0]; if (!host) return;
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;inset:0;z-index:99;overflow-y:auto;background:#f4f1ea;color:#1b1d24;padding:56px 14px 80px;font-size:13px';
        el.innerHTML = `<div style="font-weight:700;margin-bottom:8px">이모지 시험 (누르면 닫혀요)</div>${rows.map(([l, h]) => `<div style="display:flex;align-items:center;gap:10px;min-height:30px;border-top:1px solid rgba(0,0,0,.08)"><span style="flex:none;width:118px;font-size:11px;color:#666">${l}</span>${h}</div>`).join('')}`;
        el.addEventListener('click', () => el.remove());
        host.append(el);
    };
    const obSend = async () => {
        const r = roomNow(), t = String($root.find('.na_ob_in').text() || '').trim();
        if (!live() || !r || !t || obAcct() !== liveWorld(realM)?.persona) return;
        if (t === '!emoji') return obEmojiTest(); // (임시: 기기 이모지가 어디서 바뀌는지 보는 시험 화면. 원인을 찾으면 지워요)
        sendLive(realM, r.id, t);
        enqueueReplies(realM, r.id);
        obDraft = ''; drawPhone(); obBottom(); obFocus();
        // (답장 요청은 저장을 기다리지 않고 바로 시작해요: 폰에서 저장이 몇 초 걸려서 답장이 그만큼 늦게 왔어요. 답장을 받으면 liveGo가 다시 저장해요)
        const sv = saveMeta(); obGo();
        await sv;
    };
    $root.on('click', '.na_ob_retry', async function (e) {
        e.stopPropagation();
        const w = liveWorld(realM), j = w?.queue?.jobs?.find(x => x.id === this.dataset.id);
        if (!live() || !j) return;
        seeFailure(realM, j.id);
        if (w.messenger?.rooms?.[j.room]) enqueueReplies(realM, j.room);
        drawPhone(); obBottom();
        const sv = saveMeta(); obGo();
        await sv;
    });
    $root.on('click', '.na_ob_send', e => { e.stopPropagation(); obSend(); });
    $root.on('keydown', '.na_ob_in', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.originalEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); obSend(); } });
    // 실시간 폰 시작: 이야기에서(마지막 메시지까지) → 실시간 홈
    // 이야기 요약본 (phone2snap.js liveSnapNow): 마지막 메시지까지. 아카이브가 최신이면 요청 없이 바로, 밀려 있으면
    // "이야기 정리 중"(나눠 보내면 k/total). 그동안 다른 폰 작업은 막아요. 실패하면 알림 한 줄, 아무것도 안 남겨요
    const snapNow = async () => {
        snapping = true; snapLabel = '이야기 정리 중'; if (!phoneClosed) drawPhone(true);
        try { return await liveSnapNow(realM, { onStep: (k, total) => { snapLabel = total > 1 ? `이야기 정리 중 ${k + 1}/${total}` : '이야기 정리 중'; if (!phoneClosed && stillHere()) drawPhone(true); } }); }
        catch (err) { console.warn('[narrative-archive] live snap', err); toastr.warning(String(err?.message || err), '캐릭터 휴대폰'); return null; }
        finally { snapping = false; snapLabel = ''; }
    };
    // 채팅을 메신저로 가져오기: 줄 고르기 · 파일 고르기(브라우저 안에서만 읽어요) · 가져오기. 모델은 안 불러요
    $root.on('click', '.na_ls_pick', async function (e) {
        e.stopPropagation();
        if (snapping) return;
        const v = this.dataset.v;
        // (흐린 줄: 왜 못 가져오는지 한 줄)
        if (this.classList.contains('off')) return toastr.info(liveImportPlan(realM).again ? '새로 가져올 메시지가 없어요' : '메신저 모양으로 쓴 메시지가 없어요', '캐릭터 휴대폰');
        if (v !== 'file') { lsPick = v; return drawPhone(true); }
        const go = await askChoice('파일에서 가져오기', '메신저 프롬프트로만 진행한 채팅방 파일을 가져와 주세요.', [{ v: 'go', label: '파일 고르기' }], '취소');
        if (go !== 'go') return;
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.jsonl,application/jsonl,text/plain';
        inp.addEventListener('change', async () => {
            const file = inp.files?.[0]; if (!file) return;
            try {
                const text = await file.text(), plan = liveImportFilePlan(realM, text);
                if (!stillHere()) return;
                if (!plan.messages) return toastr.info(plan.again ? '새로 가져올 메시지가 없어요' : '가져올 메시지가 없어요', '캐릭터 휴대폰');
                lsFile = { text, ...plan }; lsPick = 'file';
                if (!phoneClosed) drawPhone(true);
            } catch (err) { console.warn('[narrative-archive] live import file', err); toastr.warning(String(err?.message || err), '캐릭터 휴대폰'); }
        });
        inp.click();
    });
    const importNow = async pick => {
        if (making || snapping || busyMake || investing || koBusy || filling.size || busy.fill || busy.sync) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요', '캐릭터 휴대폰');
        const opts = { persona: ctx().name1 || '', scope: phoneChatScope(ctx()) };
        snapping = true; snapLabel = '가져오는 중'; if (!phoneClosed) drawPhone(true);
        let got = null;
        try { got = pick === 'file' ? await liveImportFile(realM, lsFile?.text || '', opts) : await liveImportChat(realM, opts); }
        catch (err) { console.warn('[narrative-archive] live import', err); toastr.warning(String(err?.message || err), '캐릭터 휴대폰'); }
        finally { snapping = false; snapLabel = ''; }
        if (!got || !stillHere()) { if (!phoneClosed && stillHere()) drawPhone(true); return; }
        lsFile = null; lsPick = null;
        // 실시간으로 바꾸고 그 방을 열어요. 폰이 하나도 없으면(이야기 없이 시작한 폰) 그 캐릭터의 폰 만들기 준비로
        if (!live()) { setLiveMode(realM, 'live'); useMode(); await yearsNow(); }
        owner = liveOwner(); obWho = ''; obDraft = ''; sheet = false;
        view = phone() ? `orbitroom:${got.room}` : 'prep';
        toastr.success(`말풍선 ${got.count}개를 가져왔어요`, '캐릭터 휴대폰');
        if (!phoneClosed) { draw(); if (phone()) obBottom(); }
        await saveMeta();
    };
    // 첫 화면 (폰도 인물도 없는 채팅): 이름 적고 폰 보기
    $root.on('input', '.na_who_in', function () { whoName = this.textContent; });
    $root.on('paste', '.na_who_in', e => { e.preventDefault(); const t = (e.originalEvent?.clipboardData || window.clipboardData)?.getData('text') || ''; document.execCommand('insertText', false, t.replace(/\s+/g, ' ')); });
    $root.on('keydown', '.na_who_in', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); if (!e.originalEvent?.isComposing && e.keyCode !== 229) addPerson(null, whoName); } });
    $root.on('click', '.na_who_ok', e => { e.stopPropagation(); addPerson(null, String($root.find('.na_who_in').text() || whoName)); });
    // 실시간 폰 시작: 요약본을 만든 뒤 이야기에서(마지막 메시지까지) → 실시간 홈. 창을 닫았어도 같은 채팅이면 시작하고 저장해요
    $root.on('click', '.na_ob_start', async function (e) {
        e.stopPropagation();
        const p = phone();
        const pick = startUi(p).pick;
        if (pick === 'chat' || pick === 'file') return importNow(pick);
        if (live() || liveWorld(realM) || !p) return;
        if (making || snapping || busyMake || investing || koBusy || filling.size || busy.fill || busy.sync) return toastr.info('다른 폰 작업이 끝난 뒤 시작해 주세요', '캐릭터 휴대폰');
        const got = await snapNow();
        if (!got) { if (!phoneClosed && stillHere()) drawPhone(true); return; }
        // (기다린 뒤 다시: 같은 채팅, 아직 실시간 폰이 없음, 타임라인 폰 그대로)
        if (!stillHere() || liveWorld(realM) || realM.phones?.[nameKey(p.owner)] !== p) { if (!phoneClosed && stillHere()) drawPhone(true); return; }
        const plan = startPlan(p);
        try { beginFromStory(realM, { persona: plan.persona, upto: got.upto, scope: phoneChatScope(ctx()), dayShift: plan.dayShift, chat: got.chat, fp: got.fp, snap: got.snap }); }
        catch (err) { console.error('[narrative-archive] live start', err); toastr.warning(String(err?.message || err), '캐릭터 휴대폰'); if (!phoneClosed) drawPhone(true); return; }
        setLiveMode(realM, 'live'); useMode(); await yearsNow(); owner = liveOwner(); view = 'home'; sheet = false;
        if (!phoneClosed) draw();
        await saveMeta();
    });
    // 실시간 폰 새로 시작 (5-2): 대화만 남기기 · 전부 지우기, 늘 사람이 골라요
    $root.on('click', '.na_ph_livereset', async function (e) {
        e.stopPropagation();
        if (!live()) return;
        if (making || snapping || busyMake || investing || koBusy || filling.size || busy.fill || busy.sync) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요', '캐릭터 휴대폰');
        const how = await askChoice('실시간 폰 새로 시작', '', [{ v: 'chats', label: '대화만 남기기' }, { v: 'all', label: '전부 지우기', danger: true }], '취소');
        if (how !== 'chats' && how !== 'all') return;
        // 대화만 남기기: the talk stays, the phones begin again from the 타임라인 phones as they are now (as 시작 does);
        // still 실시간. With no 타임라인 phone there is nothing to begin from: 폰 2 stays as it was
        if (how === 'chats') {
            const lw = liveWorld(realM), base = realM.phones?.[nameKey(lw?.lastOwner)] || Object.values(realM.phones || {}).find(p => p?.owner);
            if (!Object.values(realM.phones || {}).some(q => q?.owner)) return toastr.info('타임라인 폰을 먼저 만들어 주세요', '캐릭터 휴대폰');
            const got = await snapNow();
            if (!got || !stillHere() || !live() || liveWorld(realM) !== lw) { if (!phoneClosed && stillHere()) drawPhone(true); return; }
            let w = null;
            try { w = rebeginKeepingChats(realM, { upto: got.upto, scope: phoneChatScope(ctx()), dayShift: base ? startPlanOf(base).dayShift : 0, chat: got.chat, fp: got.fp, snap: got.snap }); }
            catch (err) { return toastr.error(String(err?.message || err), '캐릭터 휴대폰'); }
            if (!w) return toastr.info('타임라인 폰을 먼저 만들어 주세요', '캐릭터 휴대폰');
            obWho = ''; useMode(); await yearsNow();
            owner = liveOwner(); view = 'set'; sheet = false;
            if (!phoneClosed) draw();
            await saveMeta();
            if (!phoneClosed) obGo();
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
        if (making || snapping || busyMake || investing || koBusy || filling.size || busy.fill || busy.sync) return toastr.info('다른 폰 작업이 끝난 뒤 바꿔 주세요', '캐릭터 휴대폰');
        const fromLive = live();
        setLiveMode(realM, to);
        useMode();
        await yearsNow();
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
    const addPerson = async (el, typed) => {
        const v = String(typed ?? $(el).closest('.na_ph_addbox').find('.na_ph_addname').val() ?? '').replace(/\s+/g, ' ').trim();
        if (!v) return;
        const have = names.find(n => nameKey(n) === nameKey(v));
        if (!have) { m.people = [...(Array.isArray(m.people) ? m.people : []), v]; names.push(v); roster.add(nameKey(v)); }
        owner = have || v; if (!live()) rememberPhoneSelection(m,owner,selectionKey); adding = false; view = 'lock'; sheet = false; whoName = '';
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
        if (go === 'livestart' || go === 'liveimport') { lsPick = null; lsFile = null; }
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
        try { const k = await P.takePhoto(m, p); if (phone() === p) view = `cam:${k}`; toastr.success('사진을 찍었어요', '캐릭터 휴대폰'); }
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
            if (!p || making || snapping || koBusy) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요');
            // (this screen's lines only: one chat, one note, one page …; a list screen its app's newest 40; 설정 the whole phone, asked first)
            const scope = koScopeOf(p, view), only = koAppOf(view), pick = scope || (only ? g => only(g.app) : null);
            if (pick && !koGaps(p, { all: true }).some(pick)) return; // (nothing on this screen to translate again: quietly nothing)
            if (!pick && !await askSheet('폰 전체를 다시 번역할까요?', '지금 한국어가 전부 새 번역으로 바뀌어요.', '다시 번역')) return;
            let n = 0;
            koBusy = true;
            try { n = await withSpinner($b, '다시 번역 중', async () => { try { await P.learnVoices(m, owner, p, { all: true }); } catch (err) { console.warn('[narrative-archive] voices', err); } return redoKo(p, pick, !scope && only ? { max: 40, newest: true } : {}); }); if (p.syncLast?.trFailed) delete p.syncLast.trFailed; await saveMeta(); }
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
        if (p && koGaps(p).length && !making && !snapping) { if (koBusy) return; await withSpinner($(e.currentTarget), '번역 중', () => koRun(p, true)); const g = globalSettings(); g.phoneKo = true; saveGlobal(); return; }
        const g = globalSettings(); g.phoneKo = !koOn(); drawPhone(); if (view.startsWith('thread')) $root.find('.ax_scroll').scrollTop(1e6); saveGlobal();
    });
    $root.on('click keydown', '.na_ph_trok', async e => {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault(); e.stopPropagation();
        if (koBusy) return; if (making || snapping) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요');
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
        if (!p || making || snapping || koBusy) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요');
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
    $root.on('click', '.na_sync_tr', async e => { e.stopPropagation(); if (making || snapping) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요'); await withSpinner($(e.currentTarget), '번역 중', () => koRun(phone(), true)); });
    $root.on('click', '.na_ph_makebtn', function () { make($(this), false); });
    // 폰 만들기 준비
    const prepBusy = () => { if (!(making || snapping || busyMake || phoneMaking(m, owner) || investing || filling.size || busy.fill || busy.sync || placeReading || prepLinking)) return false; toastr.info('하던 일이 끝난 뒤 해 주세요', '캐릭터 휴대폰'); return true; };
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
        try { await P.preparePhone(m, owner, { again: !!phonePre(m, owner) }); prepOpen = false; }
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
        // 실시간(가져온 채팅의 캐릭터): 폰이 만들어지면 그 사람과의 방을 열어요
        if (live() && phone() && !phoneClosed && stillHere()) openOwnerRoom();
    });
    // the screen can change while it writes; the new entry opens if its app is still showing
    $root.on('click', '.na_ph_write', async function (e) {
        e.stopPropagation();
        const p = phone(), kind = this.dataset.k, id = `${nameKey(p.owner)}:${kind}`;
        if (writing.has(id)) return;
        writing.add(id); drawPhone(true);
        try {
            const k = await P.writeEntry(m, p, kind);
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
        if (making || snapping) return toastr.info('폰 반영이나 다시 만들기가 끝난 뒤 눌러 주세요');
        const p = phone(), k = this.dataset.k, id = `${nameKey(p.owner)}:${k}`;
        if (filling.has(id)) return;
        filling.add(id); drawPhone(true);
        try { await ({ money: P.fillMoney, life: P.fillLife, delivery: P.fillDelivery, screen: P.fillScreen }[k] || P.fillVoice)(m, p); toastr.success(`${{ money: '은행 · 지갑 · 쇼핑', life: '시계 · 건강 · 파일 · 날씨', delivery: '배달', screen: '스크린타임' }[k] || '음성 메모'}을 채웠어요`, '캐릭터 휴대폰'); }
        catch (err) { console.error('[narrative-archive] fill', err); toastr.error(String(err?.message || err), '채우기 실패'); }
        finally { filling.delete(id); if (phone() === p) drawPhone(true); }
    });
    $root.on('click', '.na_ph_rec', async function (e) {
        e.stopPropagation();
        const p = phone(), id = nameKey(p.owner);
        if (recording.has(id)) return;
        recording.add(id); drawPhone(true);
        try { const k = await P.recordVoice(m, p); if (phone() === p && view.startsWith('voice')) view = `voice:${p.voice[k].id}`; toastr.success('음성 메모를 떠올렸어요', '캐릭터 휴대폰'); }
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
        try { await P.makeDraft(m, p, i); toastr.success('보내지 않은 메시지를 떠올렸어요', '캐릭터 휴대폰'); }
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
        heldT = setTimeout(() => { heldT = null; heldWhen = Date.now(); holding = true; msgHeld = { i: threadNo(), k: Number(el.dataset.k) }; navigator.vibrate?.(10); ptrDown = false; drawPhone(true); }, 480);
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
    const makeFrom = async ($at, update) => { if (snapping) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요', '캐릭터 휴대폰'); if (koBusy) return toastr.info('번역하는 중이에요. 끝나면 다시 눌러 주세요', '캐릭터 휴대폰'); if (making || snapping || busy.sync) return toastr.info('폰 작업이 진행 중이에요. 끝나면 다시 눌러 주세요', '캐릭터 휴대폰'); if (investing || filling.size || busy.fill) return toastr.info('은행·투자를 만드는 중이에요. 끝난 뒤 눌러 주세요'); making = true; try { await make($at, update); } finally { making = false; } };
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
    $root.on('click', '.na_sync_restore', async e => { e.stopPropagation(); if (making || snapping || busy.sync || busy.fill) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요'); const n = await restoreRounds(m, phoneChatScope(ctx())); syncPending = 0; drawPhone(); if (n && phone()) koRun(phone(), false); /* (what came back has no Korean yet) */ if (m.phones && Object.values(m.phones).some(p => p.inject)) applyInjection(); toastr.success(`반영 ${n}번을 복구했어요`, '캐릭터 휴대폰'); });
    $root.on('click', '.na_sync_drop', async function (e) {
        e.stopPropagation();
        if (making || snapping || busy.sync || busy.fill) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요');
        const p = phone(), d = p.sync?.dropped?.[Number(this.dataset.k)];
        if (!d || !await askSheet(`대화 ${d.label}에서 넣은 일을 뺄까요?`, '문자 · 일정 · 돈 기록이 빠져요.', '빼기')) return;
        if (making || snapping || busy.sync || busy.fill) return;
        const r = await dropStretch(m, p, d.key);
        drawPhone();
        const did = [r.gone ? `일 ${r.gone}개` : '', r.items ? `앱 기록 ${r.items}개` : ''].filter(Boolean).join(' · ') || '뺄 것이 없어서 아무것도 안';
        if (r.kept.length) toastr.warning(`${did}를 뺐어요. ${r.kept.join(', ')}은(는) 뒤의 기록과 이어져 있어서 남겨뒀어요`, '캐릭터 휴대폰');
        else toastr.success(`${did}를 뺐어요`, '캐릭터 휴대폰');
    });
    $root.on('click', '.na_sync_undo', async e => {
        e.stopPropagation();
        // not while a reflection or a fill writes the same records
        if (making || snapping || busy.sync || busy.fill) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요');
        try {
            const p = phone(), target = phoneTarget(m, p), round = p.syncUndo;
            const n = p.syncLast?.checked || 0;
            if (!await askSheet('방금 반영을 되돌릴까요?', `대화 ${n}개를 다시 읽게 돼요.`, '되돌리기')) return;
            target.check();
            if (making || snapping || busy.sync || busy.fill || phone() !== p || p.syncUndo !== round) return;
            const kept = await exclusive('sync', () => undoRound(m, p));
            drawPhone();
            kept.length ? toastr.warning(`되돌렸어요. ${kept.join(', ')}은(는) 그 사이 바뀌어서 남겨뒀어요`, '캐릭터 휴대폰') : toastr.success('반영을 되돌렸어요', '캐릭터 휴대폰');
        }
        catch (err) { toastr.error(String(err?.message || err), '되돌리기'); }
    });
    // 결제 다시 읽기: the money the last round couldn't put in, asked again and put on that round
    $root.on('click', '.na_sync_money', async e => {
        e.stopPropagation();
        if (making || snapping || busy.sync || busy.fill) return toastr.info('다른 폰 작업이 끝난 뒤 눌러 주세요');
        const p = phone();
        try {
            const r = await withSpinner($(e.currentTarget), '결제 읽는 중', () => P.retryMoney(m, owner));
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
        if (!p || !(y >= 1900 && y <= 2100) || y === P.yearOn(p, m)) { drawPhone(true); return; }
        // the bank's and investments' dates move with it (the whole chat's), so their order holds
        if (p.year && hasDatedRecords(m) && !await askSheet(`${y}년으로 바꿀까요?`, '기록 날짜와 다른 폰도 같이 바뀌어요.', '바꾸기', true)) { drawPhone(true); return; }
        P.setStoryYear(m, p, y);
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
        yHold = { y: Number(P.yearOn(p, m)) || new Date().getFullYear(), t: 0, n: 0 };
        const tick = () => { if (!yHold) return; yHold.y = Math.max(1900, Math.min(2100, yHold.y + d)); yHold.n++; $v.text(String(yHold.y)); yHold.t = setTimeout(tick, yHold.n < 2 ? 420 : yHold.n < 12 ? 110 : 45); };
        tick();
        this.setPointerCapture?.(e.pointerId);
    });
    $root.on('pointerup pointercancel lostpointercapture', '.na_ph_ystep', e => { e.stopPropagation(); yStop(); });
    $root.on('keydown', '.na_ph_ystep', function (e) { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); const p = tgt(); if (p) commitYear((Number(P.yearOn(p, m)) || new Date().getFullYear()) + Number(this.dataset.d)); });
    // 설정 › 위치 정보: locked while the phone is being made, reflected or filled, like the date order
    const placeLocked = () => { if (!(making || snapping || busyMake || investing || filling.size || busy.fill || busy.sync || placeReading || prepLinking)) return false; toastr.info('반영이 끝난 뒤 바꿔 주세요', '캐릭터 휴대폰'); return true; };
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
        try { await P.rereadPlaces(m, p, { all: v === 'all' }); toastr.success('위치를 연동했어요', '위치 정보'); }
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
        try { got = await P.pickVoices(m, owner, p, names); await saveMeta(); }
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
        try { got = await P.pickVoices(m, owner, p, names); }
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
        if (making || snapping || busyMake || investing || filling.size || busy.fill || busy.sync) return toastr.info('반영이 끝난 뒤 바꿔 주세요', '캐릭터 휴대폰');
        const value = this.dataset.n;
        if (value !== '' && !screenHolderChoices(m).some(x => x.name === value)) return;
        if (getMeta() !== realM) return;
        await setScreenHolder(m, value);
        if (!phoneClosed && getMeta() === realM) { view = phone() ? 'setdate' : 'prep'; drawPhone(); }
    });
    $root.on('click', '.na_ph_dord', async function (e) { e.stopPropagation(); if (making || snapping || busyMake || investing || filling.size || busy.fill || busy.sync) return toastr.info('반영이 끝난 뒤 바꿔 주세요', '캐릭터 휴대폰'); const v = this.dataset.v; if (v !== 'md' && v !== 'dm' || dateOrderOf(m) === v && !needsDateOrder(m)) return; await setDateOrder(m, v); drawPhone(true); });
    $root.on('click', '.na_ph_yearshow', async e => {
        e.stopPropagation();
        const pre = !phone() && view === 'prep' ? phonePre(m, owner) : null;
        if (pre) { await setPreYear(m, owner, pre.noYear ? Number(P.storyYear(m, { ...pre, year: 0, noYear: false })) || new Date().getFullYear() : null); return drawPhone(true); }
        const p = phone(); if (!p) return; p.noYear = !p.noYear; if (!p.noYear && !p.year) p.year = Number(P.storyYear(m, { ...p, year: 0 })) || new Date().getFullYear(); drawPhone(true); await saveMeta();
        // (실시간: the year put in when turned on, set to the year of the phone's saved time)
        if (live()) { await yearsNow(); drawPhone(true); } });
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
        if (making || snapping) return toastr.info('폰을 다시 만드는 중이에요');
        if (investing) return toastr.info('시세·환율 작업이 진행 중이에요. 완료 후 다시 눌러 주세요');
        const apps = Object.keys(REMAKE).filter(k => remake.has(k)), more = REMAKE_MORE.filter(k => remake.has(k)), whole = apps.length === Object.keys(REMAKE).length;
        const date=more.includes('invest') ? ($root.find('.ax_investdate').val() || P.investmentDate(m,phone())) : '';
        if(more.includes('invest') && !validDate(date)) {toastr.warning('투자 기준일을 입력해 주세요');return;}
        const target = phone(), targetOwner = owner, keep = target.inject;
        making = true;
        try {
            if (!await askSheet(whole ? '폰 전체를 다시 만들까요?' : apps.length + more.length === 1 ? `${APPS[[...apps, ...more][0]]}${josa(APPS[[...apps, ...more][0]])} 다시 만들까요?` : `앱 ${apps.length + more.length}개를 다시 만들까요?`, whole || apps.length + more.length === 1 ? '' : [...apps, ...more].map(k => APPS[k]).join(' · '), '다시 만들기')) return;
            if (phone() !== target || investing) {toastr.info('폰이나 진행 중인 작업이 바뀌었어요. 다시 눌러 주세요');return;}
            if (apps.length) await askDateOrder();
            drawPhone(true);
            const p = apps.length ? await P.makePhone(m, targetOwner, whole ? {} : { apps }) : target;
            if (!p) throw new Error('생성 결과를 받지 못했어요. 다시 시도해 주세요');
            const wealthPlan = more.some(k=>k==='money'||k==='invest') ? await P.prepareWealth(m,p,true) : null;
            for (const k of more.filter(k => !(k === 'screen' && more.includes('life')))) await (k === 'money' ? P.fillMoney(m,p,{regenerateBalances:true,wealthPlan}) : k === 'invest' ? P.fillInvestment(m,p,date,{regenerate:true,wealthPlan}) : k === 'life' ? P.fillLife(m,p,{screenAgain:more.includes('screen')}) : k === 'delivery' ? P.fillDelivery(m,p) : k === 'screen' ? P.fillScreen(m,p,{again:true}) : P.fillVoice(m,p));
            if (whole && keep) { p.inject = true; await saveMeta(); applyInjection(); }
            if (phone() === p && !phoneClosed) {remake.clear(); view = whole ? 'lock' : 'set'; draw();}
            toastr.success(whole ? `${targetOwner}의 폰을 다시 만들었어요` : '고른 앱을 다시 만들었어요', '캐릭터 휴대폰');
        } catch (err) { toastr.error(String(err?.message || err), '다시 만들기'); }
        finally { making = false; if (!phoneClosed) drawPhone(true); }
    });
    $root.on('click', '.na_ph_storyreset', async e => {
        e.stopPropagation();
        if (making || snapping || busyMake || investing || filling.size || placeReading || prepLinking) return toastr.info('생성 중인 작업이 끝난 뒤 다시 시도해 주세요');
        const scope=phoneChatScope(ctx());
        if (!await askSheet('이 방의 폰을 새로 시작할까요?', '모든 인물의 폰이 지워져요.', '새로 시작')) return;
        if(getMeta()!==realM || phoneChatScope(ctx())!==scope || making || snapping || busyMake || investing || filling.size || placeReading || prepLinking) return toastr.info('생성 중인 작업이 끝난 뒤 다시 시도해 주세요');
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
    // (틀의 테두리 두께만큼 빼요: 화면을 통째로 채우는 폰에서는 0이에요)
    const fit = () => { const cs = getComputedStyle(frame), w = frame.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0); if (w > 0) frame.style.setProperty('--k', String(w / CG_W)); };
    const ro = new ResizeObserver(fit);
    ro.observe(frame);
    // the phone's own boxes never scroll (overflow: hidden): a focused field makes the browser roll them up to show it (a
    // phone's keyboard does too), and the frame keeps that across screens. Put back at once; the screens' own lists still scroll
    frame.addEventListener('scroll', e => { const t = e.target; if (t instanceof Element && t.matches('.na_ph_frame, .na_ph_scr, .cg_canvas, .ax_canvas') && t.scrollTop) t.scrollTop = 0; }, true);
    cgFonts();
    const dlg = document.createElement('dialog');
    dlg.className = 'popup na_phl';
    // (실리태번이 팝업에 주는 둥근 모서리는 여기서 직접 없애요: 화면을 통째로 덮는 창이라 모서리가 둥글면 진한 화면에서만 귀퉁이가 깎여 보여요.
    //  css의 border-radius: 0은 좁은 화면에서 실리태번 규칙에 밀렸어요)
    dlg.style.setProperty('border-radius', '0', 'important');
    dlg.id = 'na_phl';
    dlg.append($root[0]);
    // 껍데기 앱 안: 기기 바가 폰 화면 색이라 아이폰 비율 · 위아래 틈 없이 화면을 통째로 채워요 (css 예산 대신 인라인)
    if (window.NAShell) {
        // 앱에 폰을 열었다고 알려요: 기기 상단바를 숨기고 하단 버튼 줄 밑까지 깔아요(새 앱만 phone이 있어요)
        document.documentElement.classList.add('na-shell');
        try { window.NAShell.phone?.(true); } catch { /* 예전 앱 */ }
        $root[0].style.padding = '0';
        Object.assign(frame.style, { width: '100vw', height: 'var(--na-phh, 100dvh)', borderRadius: '0' });
        frame.style.setProperty('--axr', '0');
    }
    document.body.append(dlg);
    // toasts sit in the top layer with the phone, then go back
    let toasts = document.getElementById('toast-container');
    if (!toasts) { toasts = document.createElement('div'); toasts.id = 'toast-container'; if (toastr.options?.positionClass) toasts.classList.add(toastr.options.positionClass); }
    dlg.append(toasts);
    dlg.showModal();
    // (창을 열 때 브라우저가 첫 글 칸에 초점을 줘서 키보드가 따라 올라와요: 칸은 직접 눌렀을 때만)
    { const a = document.activeElement; if (a && dlg.contains(a) && (a.isContentEditable || a.matches('input, textarea'))) a.blur(); }
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
    // 키보드가 폰 아래쪽을 덮은 만큼(--obkb, 보드 px): 폰 크기는 그대로 두고, Orbit 방은 그만큼 입력칸을 위로 올려 말이 보이게 해요
    // (텔레그램처럼: 입력칸이 키보드 바로 위, 마지막 말이 그 위). 보이는 높이는 visualViewport가 알려 줘요
    const kbFix = () => {
        const scr = frame.querySelector('.na_ph_scr'), vv = window.visualViewport; if (!scr) return;
        const seen = vv ? vv.offsetTop + vv.height : window.innerHeight, k = Number(frame.style.getPropertyValue('--k')) || 1;
        // (키보드가 올라오는 도중 한순간 엉뚱하게 큰 값이 나오면 말 목록이 0으로 눌려 화면이 번쩍였어요: 화면의 60%까지만)
        const cover = typing() ? Math.min(Math.round(scr.offsetHeight * 0.6), Math.max(0, Math.round((scr.getBoundingClientRect().bottom - seen) / k))) : 0, was = frame.style.getPropertyValue('--obkb');
        if (was === `${cover}px`) return;
        frame.style.setProperty('--obkb', `${cover}px`); frame.classList.toggle('na_ph_kb', cover > 0);
        // (말을 고치는 중이면 맨 아래로 굴리지 않아요: 고치는 말풍선이 보이게만. 맨 아래로 갔다가 다시 올라오며 튀었어요)
        if (view.startsWith('orbitroom')) { if (obFix) obFixShow(); else obBottom(); }
    };
    const kbSoon = () => { kbFix(); setTimeout(kbFix, 120); setTimeout(kbFix, 400); };
    window.visualViewport?.addEventListener('resize', kbSoon); window.visualViewport?.addEventListener('scroll', kbSoon);
    window.addEventListener('resize', kbSoon); dlg.addEventListener('focusin', kbSoon); dlg.addEventListener('focusout', kbSoon);
    // a make of this phone that another opening started: its end shows the phone (the prep screen's views give way to the lock)
    // (채팅의 진짜 메타로 견줘요: 실시간 서랍은 창을 열 때마다 새로 생겨서, 닫았다 연 창에서는 같은 서랍이 아니에요)
    const onMade = (mm, who, wasLive = false) => {
        if (phoneClosed || mm !== realM || wasLive !== live() || nameKey(who) !== nameKey(owner) || !stillHere()) return;
        const fromPrep = phone() && ['prep', 'setdraft', 'setdraftmodel', 'setscreenholder', 'setprofile'].includes(view);
        // 실시간: 잠금 화면 말고 그 사람과의 방 (준비 화면에서 바로 만들었을 때처럼)
        if (fromPrep && live() && openOwnerRoom()) return;
        if (fromPrep) view = 'lock';
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
        // 껍데기 앱의 기기 뒤로가기 (앱이 window.__naBack을 불러요): 폰 안에서 한 단계씩 — 떠 있는 것(물음 창 · 시트 · 길게 누른 카드 · 고치는 중 · 고르는 중)
        // → 그 화면의 뒤로 버튼 → 홈 → (홈 · 잠금에서만) 폰 닫기. 홈 막대를 숨긴 뒤로 뒤로가기가 폰을 통째로 닫았어요(소망)
        const backWas = window.__naBack;
        if (window.NAShell) window.__naBack = () => {
            if (!dlg.open) return backWas ? backWas() : 0;
            const v = String(view || '').split(':')[0];
            if (ask) ask.done(false);
            else if (sheetOpen) setSheet(false);
            else if (obFix || obHeld || obPicks || obList) { obFix = null; obHeld = null; obPicks = null; obList = null; drawPhone(true); }
            else {
                const b = $root.find('.na_ph_frame [data-go]').filter('[aria-label="뒤로"], [aria-label="닫기"]')[0];
                if (b) b.click();
                else if (!['home', 'home2', 'lock'].includes(v) && $root.find('.na_ph_frame .na_ph_scr').length) { const x = document.createElement('button'); x.dataset.go = 'home'; x.hidden = true; $root.find('.na_ph_frame .na_ph_scr')[0].append(x); x.click(); }
                else close();
            }
            return 1;
        };
        dlg.addEventListener('close', () => { if (window.NAShell) window.__naBack = backWas; for (const ev of ['pointerup', 'pointercancel']) window.removeEventListener(ev, ptrUp, true); }, { once: true });
        dlg.addEventListener('close', () => { phoneClosed = true; setPhoneMeta(null); if (liveMode(realM) === 'live' && stillHere()) obReflect(); ask?.done(false); done(); }, { once: true });
    });
    window.visualViewport?.removeEventListener('resize', kbSoon); window.visualViewport?.removeEventListener('scroll', kbSoon); window.removeEventListener('resize', kbSoon);
    barsUndo(dlg);
    try { window.NAShell?.phone?.(false); } catch { /* 예전 앱 */ }
    stopBusy(); madeWatch.delete(onMade);
    window.removeEventListener('resize', setH);
    ro.disconnect();
    const t = dlg.querySelector('#toast-container');
    if (t) { if (t.childNodes.length) document.body.append(t); else t.remove(); }
    dlg.remove();
}
// 기기의 상단바 · 하단바를 폰 화면 색으로 (소망 폰에서 바가 끊어져 보였어요). 웹페이지는 바를 직접 못 그려서
//   상단바: <meta name="theme-color">를 화면 위쪽 색으로 (크롬은 주소창 · 상단바, 앱처럼 연 실리태번은 상단바)
//   바깥: 폰 창 바깥 바탕을 같은 한 색으로 (반으로 나눠 칠하면 띠 한가운데에 경계선이 생겼어요)
//   하단바: 페이지 맨 바깥 바탕(html · body)을 화면 아래쪽 색으로 — 크롬은 하단바 색을 여기서 가져오는 것 같아요(블루레몬에이드가 그렇게 칠해요)
// 위아래가 한 덩어리 색인 화면(BARS_ON: 잠금 · 홈 · 은행)에서만 해요. 흰 앱 화면은 둥근 모서리 · 띠가 오히려 드러나서 원래대로 둬요(소망).
// 폰을 닫거나 다른 화면으로 가면 원래대로 돌려요
// 이모지 반응 배지 (시안 docs/mockups/shell-bars U1C · U1C_motion.mp4): 같은 이모지는 하나로 모아 셋까지, 둘 이상이면 수.
// 방을 처음 그릴 땐 다 본 것으로 치고, 그 뒤에 처음 보는 반응만 모션(0.7초). 그사이 화면을 다시 그려도 모션이 처음부터 다시 시작하지 않게
// 지난 시간만큼 앞당겨 이어서 그려요(ago)
const OB_RE_SEEN = new Map(), OB_RE_MS = 700;
function obReacts(roomId, x, fresh) {
    const rs = (Array.isArray(x.reacts) ? x.reacts : []).filter(r => emojiOf(r?.e)), seen = OB_RE_SEEN.get(roomId) || new Map(), now = Date.now();
    let at = 0;
    for (const r of rs) { const k = `${x.id}|${liveKey(r.by)}|${r.e}`; if (!seen.has(k)) seen.set(k, fresh ? 0 : now); at = Math.max(at, seen.get(k)); }
    OB_RE_SEEN.set(roomId, seen);
    const ago = at ? now - at : OB_RE_MS;
    return rs.length ? { es: [...new Set(rs.map(r => r.e))].slice(0, 3), n: rs.length, isNew: ago < OB_RE_MS, ago } : null;
}
const BARS_ON = new Set(['lock', 'home', 'home2', 'bank']);
const BARS = { meta: null, had: undefined, root: null };
const barColor = (frame, y) => {
    const aura = frame.querySelector('.ob_bg .ob_blob'); if (aura) { const n = (getComputedStyle(aura).backgroundColor.match(/[\d.]+/g) || []).map(Number); if (n.length >= 3) return `rgb(${n[0]}, ${n[1]}, ${n[2]})`; }
    const r = frame.getBoundingClientRect(), x = r.left + r.width / 2;
    for (const e of document.elementsFromPoint(x, y)) {
        if (!frame.contains(e)) continue;
        const cs = getComputedStyle(e), all = `${cs.backgroundImage} ${cs.backgroundColor}`.match(/rgba?\([^)]+\)/g) || [];
        for (const c of all.reverse()) { const n = c.match(/[\d.]+/g).map(Number); if ((n[3] ?? 1) > 0.5) return `rgb(${n[0]}, ${n[1]}, ${n[2]})`; }
    }
    return '';
};
function barsUndo(dlg) {
    if (BARS.meta) { if (BARS.had === null) BARS.meta.remove(); else BARS.meta.content = BARS.had; }
    if (BARS.root) for (const [el, v] of BARS.root) { if (v) el.style.setProperty('background', v.value, v.prio); else el.style.removeProperty('background'); }
    dlg?.style.removeProperty('background');
    BARS.meta = BARS.root = null; BARS.had = undefined;
}
function barsPaint(dlg, view) {
    const frame = dlg?.querySelector('.na_ph_frame'); if (!frame) return;
    // (껍데기 앱(window.NAShell) 안에서는 폰이 화면을 통째로 채워서 모서리 · 띠가 없어요: 모든 화면에서 칠해요. 앱이 theme-color · 페이지 바탕을 읽어 기기 바에 칠해요)
    const v = String(view || '').split(':')[0], shell = !!window.NAShell, phone = shell || matchMedia('(max-width: 600px) and (pointer: coarse)').matches;
    if (!phone || (shell ? !frame.querySelector('.cg_canvas, .ax_canvas') : !BARS_ON.has(v) || !frame.querySelector(v === 'bank' ? '.ax_canvas' : '.cg_canvas'))) return barsUndo(dlg);
    const r = frame.getBoundingClientRect(), top = barColor(frame, r.top + 3), bot = barColor(frame, r.bottom - 3) || top;
    if (!top) return barsUndo(dlg);
    if (BARS.had === undefined) { BARS.meta = document.querySelector('meta[name="theme-color"]'); BARS.had = BARS.meta ? BARS.meta.content : null; if (!BARS.meta) { BARS.meta = document.createElement('meta'); BARS.meta.name = 'theme-color'; document.head.append(BARS.meta); } }
    BARS.meta.content = top;
    // (실리태번 팝업 · 테마 규칙이 !important라 인라인으로 덮어요)
    dlg.style.setProperty('background', top, 'important');
    if (!BARS.root) BARS.root = [document.documentElement, document.body].map(el => [el, el.style.getPropertyValue('background') ? { value: el.style.getPropertyValue('background'), prio: el.style.getPropertyPriority('background') } : null]);
    for (const el of [document.documentElement, document.body]) el.style.setProperty('background', bot, 'important');
}
// the board's fonts (Inter Tight for numbers, Noto Sans KR), once
function cgFonts() {
    if (document.getElementById('na_cg_fonts')) return;
    $('head').append('<link id="na_cg_fonts" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@100;200;300;400;500;600&family=Noto+Sans+KR:wght@300;400;500;600;700&family=Noto+Serif+KR:wght@400;500;600&display=swap">');
}
