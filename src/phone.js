// 캐릭터 휴대폰: one character's phone as the story stands — messages, calls, photos (captions, no pictures), notes,
// searches, a calendar and the places they have been. The draft model writes the content as JSON from the archive; the
// screens are drawn here, the same for everyone. Texts are in the language the writer would use, with Korean under them.
// m.phones = { [name key]: { owner, country, wall, accent, now, contacts, threads, calls, photos, notes, searches, events,
//   upto (the last message number the archive held), at, inject } }

import { profileEntries, resolvePhoneProfile } from './phoneprofile.js';
import { investmentScreen } from './investui.js';
import { collectInvestmentRecords, fillInvestment, fillChartHistory, refreshMarket, refreshBankFX, validDate } from './investdata.js';
import { finance, migrateBank, reviseBaseline, selectPrice, transfer } from './finance.js';
import { draftReady, withSpinner } from './ai.js';
import { ctx, getMeta, globalSettings, saveGlobal, saveMeta } from './core.js';
import { applyInjection } from './inject.js';
import { faceHtml, nameKey, peopleList } from './people.js';
import { drafting, drawing, drawPhoto, drawPost, filling, makeDraft, paging, recording, recordVoice, searching, searchPage, shooting, takePhoto, webPage, writeEntry, writing } from './phoneai.js';
import { APPS, AXB, AXB_C, busyHtml, callScreen, callWho, calOne, calScreen, camScreen, contactOne, contactsScreen, diaryOne, diaryScreen, draftView, ic, looksSheet, mailOne, mailScreen, mapScreen, msgList, noteOne, noteScreen, photoScreen, photoView, REMAKE_MORE, setLore, setRemake, setScreen, setTheme, setOwnerProfile, setWho, snsPost, snsScreen, statusBar, threadScreen } from './phoneapps.js';
import { ensureIds, fillMoney, fillVoice, koOn, loreOff, makePhone, newSections, phoneLore, REMAKE, showNow, storyNow } from './phonedata.js';
import { CG_W, homeScreen, lastSig, lockScreen, threadNew } from './phonehome.js';
import { bankDisplayCurrency, bankAcct, bankHome, bankTx, cardView, orderView, passView, shopScreen, voiceOne, voiceScreen, walletScreen } from './phonemoney.js';
import { marksScreen, pageView, searchOne, searchScreen, tabsScreen } from './phoneweb.js';
import { openGlossary } from './translate.js';
import { confirm, esc } from './util.js';

// other files keep importing these from here
export { phoneBlock } from './phonedata.js';

function screen(p, view, m, roster, ui) {
    const now = storyNow(p);
    showNow(now);
    const [v, i] = view.split(':');
    const body = ['ivnotes', 'ivschedule', 'ivhistory', 'invest', 'stock', 'ivactivity', 'ivwatch', 'ivstakes', 'ivcash', 'ivprices'].includes(v) ? investmentScreen(m, p, now, v, decodeURIComponent(i || ''), ui.investing) : v === 'lock' ? lockScreen(p, now) : v === 'home' ? homeScreen(p, now, m) : v === 'home2' ? homeScreen(p, now, m, 2) : v === 'bank' ? bankHome(p, now) : v === 'acct' ? bankAcct(p, now, i || '0') : v === 'tx' ? bankTx(p, now, i || '') : v === 'wallet' ? walletScreen(p, now) : v === 'card' ? cardView(p, now, i || '0') : v === 'pass' ? passView(p, now, i || '') : v === 'shop' ? shopScreen(p, now, i || 'all') : v === 'order' ? orderView(p, now, i || '') : v === 'voice' ? voiceScreen(p, now, i || '') : v === 'voiceone' ? voiceOne(p, now, i || '0') : v === 'msg' ? msgList(p, now, roster)
        : v === 'thread' ? threadScreen(p, now, Number(i), roster) : v === 'draft' ? draftView(p, now, Number(i), roster) : v === 'call' || v === 'callmiss' ? callScreen(p, now, roster, v === 'callmiss') : v === 'callwho' ? callWho(p, now, Number(i), roster) : v === 'contacts' ? contactsScreen(p, now, roster) : v === 'contact' ? contactOne(p, now, decodeURIComponent(i || ''), roster, m, ui.contactBack)
        : v === 'photo' ? photoScreen(p, now) : v === 'photoone' ? photoView(p, now, Number(i))
        : v === 'note' ? noteScreen(p, now) : v === 'noteone' ? noteOne(p, now, Number(i)) : v === 'search' ? searchScreen(p, now) : v === 'page' ? pageView(p, now, i || '', paging.has(`${nameKey(p.owner)}:${i}`)) : v === 'tabs' ? tabsScreen(p, now) : v === 'marks' || v === 'history' ? marksScreen(p, now, v === 'history') : v === 'searchone' ? searchOne(p, now, Number(i), searching.has(`${nameKey(p.owner)}:${i}`))
        : v === 'cal' ? calScreen(p, now, m, i || '') : v === 'calone' ? calOne(p, now, Number(i), m) : v === 'map' ? mapScreen(p, now, m)
        : v === 'sns' ? snsScreen(p, now) : v === 'snspost' ? snsPost(p, now, Number(i)) : v === 'mail' ? mailScreen(p, now) : v === 'mailone' ? mailOne(p, now, Number(i))
        : v === 'diary' ? diaryScreen(p, now, i || '') : v === 'diaryone' ? diaryOne(p, now, Number(i)) : v === 'set' ? setScreen(p, now, m, ui) : v === 'settheme' ? setTheme(p, now) : v === 'setremake' ? setRemake(p, now, ui) : v === 'setprofile' ? setOwnerProfile(p,now,ui.profileState) : v === 'setwho' ? setWho(p, now, m) : v === 'setlore' ? setLore(p, now, m, ui)
        : v === 'cam' ? camScreen(p, now, i === undefined ? -1 : Number(i), shooting.has(nameKey(p.owner))) : homeScreen(p, now, m);
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
export function phoneSelectionKey(c) {
    const chat = c.getCurrentChatId?.() || c.chatId;
    if (chat === undefined || chat === null || chat === '') return null;
    const scope = c.groupId != null && c.groupId !== '' ? ['group',c.groupId] : ['character',c.characters?.[c.characterId]?.avatar || (c.characterId ?? '')];
    return `narrativearchive:phone-owner:${JSON.stringify([...scope,String(chat)])}`;
}
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
    const m = getMeta();
    m.phones = m.phones && typeof m.phones === 'object' ? m.phones : {};
    // phones saved before records had ids get them now, once
    if (Object.values(m.phones).reduce((n, p) => n + ensureIds(p), 0)) saveMeta();
    const names = peopleList(m);
    for (const p of Object.values(m.phones)) if (p?.owner && !names.some(n=>nameKey(n) === nameKey(p.owner))) names.push(p.owner);
    const roster = new Set(names.map(nameKey));
    const selectionKey = phoneSelectionKey(c);
    let owner = selectedPhoneOwner(m, names, who, readPhoneSelection(selectionKey));
    if (owner) { rememberPhoneSelection(m,owner,selectionKey); await saveMeta(); }
    let investing = false;
    for (const p of Object.values(m.phones)) migrateBank(m, p);
    if (Object.values(m.phones).some(p => p.money)) await saveMeta();
    let view = 'lock', contactBack = '', sheet = false, adding = false, loreOpen = false;
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
    const phone = () => (owner ? m.phones[nameKey(owner)] : null);
    const drawOwners = () => {
        $root.find('.na_ph_owners').html(`${names.map(n => `
          <button type="button" class="na_ph_pick ${n === owner ? 'on' : ''}" data-n="${esc(n)}">${faceHtml(n, 40)}<span>${esc(n)}</span>${m.phones[nameKey(n)] ? '<i></i>' : ''}</button>`).join('')}
          <button type="button" class="na_ph_pick na_ph_addp" title="인물 넣기"><span class="na_ph_addic">${ic('plus', 18, 2)}</span><span>넣기</span></button>`);
        $root.find('.na_ph_addrow').prop('hidden', !adding);
    };
    const drawPhone = (keep = false) => {
        const p = phone();
        if (!owner) { $root.find('.na_ph_frame').html(''); return; }
        if (!p) {
            $root.find('.na_ph_frame').html(`
              <div class="na_ph_scr glass w_dusk"><div class="na_ph_sb"><span></span><i>${ic('sig', 15)}${ic('bat', 20, 1.6)}</i></div>
                <div class="na_ph_body na_ph_make">
                  <div class="na_ph_makecard">
                    <span class="na_ph_makeface">${faceHtml(owner, 64)}</span>
                    <b>${esc(owner)}의 폰</b>
                    <p>아카이브를 읽고 폰을 채워요</p>
                    <button type="button" class="na_ph_makebtn">폰 만들기</button>
                    <span class="na_ph_makelinks"><button type="button" class="na_ph_makewho">인물 바꾸기</button><i>·</i><button type="button" class="na_ph_makelore">로어북 ${(n => (n ? `${n}권` : '없음'))(phoneLore(m).length)}</button></span>
                    ${draftReady() ? '' : '<small>⚙ 설정 → AI 모델에서 초안 모델을 먼저 정해 주세요</small>'}
                  </div>
                </div></div>`);
            return;
        }
        const top = keep ? $root.find('.na_ph_body, .ax_scroll').scrollTop() : 0;
        $root.find('.na_ph_frame').html(screen(p, view, m, roster, { newN: newSections(m, p), loreExp, loreEnts, remake, contactBack, investing, profileState:profileStates.get(nameKey(p.owner)) }));
        if (sheet && (view === 'photo' || view === 'set')) $root.find('.na_ph_scr').append(looksSheet(m));
        if (keep) $root.find('.na_ph_body, .ax_scroll').scrollTop(top);
        queueMicrotask(() => autoChart());
    };
    // 참고 로어북: each book with its switch; › opens its entries, each with its own (a book with some left out shows −)
    const LCK = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path class="na_ck_v" d="M5 12.5l4.5 4.5L19 7.5"/><path class="na_ck_p" d="M6 12h12"/></svg>';
    const loreSum = () => { const on = phoneLore(m); return on.length ? on.map(b => (loreOff(m, b).size ? `${b} (일부)` : b)).join(', ') : '없음 · 아카이브만 읽어요'; };
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
    const make = async ($btn, update) => {
        const p = await withSpinner($btn, update ? '반영하는 중' : '폰 만드는 중', () => makePhone(m, owner, { update }));
        if (!p) return;
        if (!update) view = 'lock';
        draw();
        toastr.success(update ? '새로 일어난 일을 폰에 넣었어요' : `${owner}의 폰을 만들었어요`, '캐릭터 휴대폰');
    };
    // Investment calls are explicit; navigation and unresolved quote conflicts never trigger them.
    const investRun = async checkStory => {
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
    $root.on('click', '.bank_fxrefresh', async function () {
        if (investing) return;
        const p = phone(), date = $root.find('.bank_fxdate').val(), base = bankDisplayCurrency(p);
        investing = true;
        try { await withSpinner($(this),'확인 중',()=>refreshBankFX(m,p,date,base)); }
        catch (err) { toastr.error(String(err?.message || err),'환율'); }
        finally { investing = false; if (phone() === p) drawPhone(true); }
    });
    let chartAttempt = '', phoneClosed = false;
    const autoChart = async () => {
        if (phoneClosed || investing || !view.startsWith('stock:')) return;
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
    $root.on('click', '.iv_records, .iv_notemake', async function () {
        if (investing) return;
        const p = phone(), mode = this.classList.contains('iv_notemake') ? 'notes' : 'records', target = this.dataset.target || '';
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
    $root.on('click', '.iv_baseline', async function () {
        const box = $(this).closest('details'), value = box.find('.iv_balance').val(), reason = String(box.find('.iv_reason').val() || '');
        if (value === '' || !reason.trim()) return toastr.warning('금액과 수정 이유를 입력해 주세요');
        if (!await confirm('기준 잔액을 수정할까요?', '이미 기록된 이후 거래는 유지되고 현재 잔액이 다시 계산돼요.')) return;
        try { reviseBaseline(m, this.dataset.key, Number(value), reason); migrateBank(m, phone()); await saveMeta(); drawPhone(true); }
        catch (err) { toastr.error(err.message); }
    });
    $root.on('click', '.iv_transfer', async function () {
        const box = $(this).closest('.iv_card'), val = k => box.find('.iv_' + k).val();
        const n = k => val(k) === '' ? null : Number(val(k));
        const from = val('from'), to = val('to'), side = val('feeSide');
        if (!validDate(val('tdate'))) return toastr.warning('거래 날짜를 확인해 주세요');
        try {
            transfer(m, { id: String(val('tid') || '').trim(), from, to, sent: n('sent'), received: n('received'), fee: n('fee'), feeSide: side, feeCurrency: finance(m).accounts[side === 'sender' ? from : to]?.currency, rate: n('rate'), date: val('tdate'), includedFrom: box.find('.iv_incfrom').prop('checked'), includedTo: box.find('.iv_incto').prop('checked') });
            migrateBank(m, phone()); await saveMeta(); drawPhone(true); toastr.success('이체 기록을 연결했어요');
        } catch (err) { toastr.error(err.message, '이체 연결'); }
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
    const loadProfile = async (p,state) => {
        const version = state.version = (state.version || 0)+1;
        state.busy=true; state.error=''; state.resolved=null; drawPhone(true);
        try {
            const binding={...state.binding};
            const entries=binding.type === 'lore' && binding.book ? await profileEntries(ctx(),binding.book) : [];
            const resolved=binding.type !== 'none' && binding.id ? await resolvePhoneProfile(ctx(),binding) : null;
            if(state.version === version) { state.entries=entries; state.resolved=resolved; }
        } catch(err) { if(state.version === version) state.error=String(err?.message || err); }
        finally { if(state.version === version) { state.busy=false; if(phone()===p && view==='setprofile') drawPhone(true); } }
    };
    const editProfile = () => {
        const p=phone(); if(!p) return;
        const state={binding:structuredClone(p.financeProfile || {type:'none'}),entries:[]};
        profileStates.set(nameKey(p.owner),state); loadProfile(p,state);
    };
    $root.on('click','.fp_source',function(){
        const p=phone(),state=profileStates.get(nameKey(p.owner)); if(!state || state.binding.type === this.dataset.type) return;
        state.binding={type:this.dataset.type};state.entries=[];
        loadProfile(p,state);
    });
    $root.on('change','.fp_select',function(){
        const p=phone(),state=profileStates.get(nameKey(p.owner)); if(!state) return;
        const field=this.dataset.field;
        if(field==='type') state.binding={type:this.value};
        else if(field==='book') {state.binding.book=this.value; delete state.binding.id;state.entries=[];}
        else state.binding.id=this.value;
        loadProfile(p,state);
    });
    $root.on('click','.fp_save',async function(){
        const p=phone(),state=profileStates.get(nameKey(p.owner));
        if(!state || state.busy || state.binding.type !== 'none' && !state.resolved) return;
        if(state.binding.type === 'none') delete p.financeProfile;
        else p.financeProfile={...state.binding,label:state.resolved.label};
        await saveMeta();view='set';drawPhone();
    });
    $root.on('click', '.na_ph_pick:not(.na_ph_addp), .ax_whopick', async function (e) { e.stopPropagation(); const same = owner === this.dataset.n; owner = this.dataset.n; rememberPhoneSelection(m,owner,selectionKey); if (!same) { view = 'lock'; sheet = false; draw(); setSheet(false); } await saveMeta(); });
    $root.on('click', '.na_ph_makewho', () => { loreOpen = false; drawCtrl(); setSheet(true); });
    // a person only the lorebook knows: into the same list as 인물 도감's +
    $root.on('click', '.na_ph_addp', () => { adding = !adding; drawOwners(); if (adding) { setSheet(true); $root.find('.na_ph_addname').trigger('focus'); } });
    const addPerson = async el => {
        const v = String($(el).closest('.na_ph_addbox').find('.na_ph_addname').val() || '').trim();
        if (!v) return;
        const have = names.find(n => nameKey(n) === nameKey(v));
        if (!have) { m.people = [...(Array.isArray(m.people) ? m.people : []), v]; names.push(v); roster.add(nameKey(v)); }
        owner = have || v; rememberPhoneSelection(m,owner,selectionKey); adding = false; view = 'lock'; sheet = false;
        $root.find('.na_ph_addname').val('');
        draw();
        setSheet(false);
        await saveMeta();
    };
    $root.on('click', '.na_ph_addok', function (e) { e.stopPropagation(); addPerson(this); });
    $root.on('keydown', '.na_ph_addname', function (e) { if (e.key === 'Enter' && !e.originalEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); addPerson(this); } });
    $root.on('click', '.na_ph_makelore', () => { loreOpen = true; drawCtrl(); setSheet(true); showOpened('.na_ph_lorelist'); });
    $root.on('click', '.na_phl_shade', () => setSheet(false));
    // what opens in the sheet scrolls into sight, so the tap visibly does something
    const showOpened = sel => setTimeout(() => $root.find(sel)[0]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);
    $root.on('click', '.na_ph_lorebtn', () => { loreOpen = !loreOpen; drawCtrl(); if (loreOpen) setTimeout(() => $root.find('.na_ph_lorelist')[0]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0); });
    // the list is drawn again on every switch; where it was scrolled to stays
    const redrawLore = () => { const top = $root.find('.na_ph_lorescroll').scrollTop(); drawCtrl(); $root.find('.na_ph_lorescroll').scrollTop(top); if (view === 'setlore') drawPhone(true); };
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
        view = ['ivnotes', 'ivschedule', 'ivhistory', 'stock', 'ivprices', 'thread', 'draft', 'page', 'acct', 'tx', 'card', 'pass', 'order', 'voiceone', 'callwho', 'contact', 'noteone', 'photoone', 'searchone', 'calone', 'mailone', 'diaryone', 'snspost'].includes(go) || (['cal', 'diary', 'shop', 'voice', 'invest'].includes(go) && this.dataset.i) ? `${go}:${['ivnotes', 'ivschedule', 'ivhistory', 'stock', 'ivprices'].includes(go) ? encodeURIComponent(this.dataset.i || '') : this.dataset.i}` : go;
        const mail = go === 'mailone' ? phone()?.mails?.[Number(this.dataset.i)] : null;
        if (mail?.unread) { mail.unread = false; saveMeta(); }
        const p0 = phone();
        const th = go === 'thread' ? p0?.threads?.[Number(this.dataset.i)] : null;
        if (th && threadNew(th)) { th.seen = lastSig(th); saveMeta(); }
        const calls = go === 'call' || go === 'callmiss' ? (p0?.calls || []).filter(c => c.type === 'missed' && !c.seen) : [];
        if (calls.length) { calls.forEach(c => { c.seen = true; }); saveMeta(); }
        const posts = go === 'sns' ? (p0?.posts || []).filter(x => !x.seen) : [];
        if (posts.length) { posts.forEach(x => { x.seen = true; }); saveMeta(); }
        sheet = false;
        drawPhone();
        $root.find('.na_ph_body, .ax_scroll').scrollTop(view.startsWith('thread') ? 1e6 : 0);
        if (go === 'searchone' && !phone()?.searches?.[Number(this.dataset.i)]?.results?.length) loadSearch(Number(this.dataset.i));
        if (go === 'page') openWeb(String(this.dataset.i));
        if (go === 'setprofile') editProfile();
    });
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
    $root.on('click', '.na_ph_kochip:not(.na_ph_looksbtn)', e => { e.stopPropagation(); const g = globalSettings(); g.phoneKo = !koOn(); drawPhone(); if (view.startsWith('thread')) $root.find('.ax_scroll').scrollTop(1e6); saveGlobal(); });
    $root.on('click', '.na_ph_makebtn', function () { make($(this), false); });
    // the screen can change while it writes; the new entry opens if its app is still showing
    $root.on('click', '.na_ph_write', async function (e) {
        e.stopPropagation();
        const p = phone(), kind = this.dataset.k, id = `${nameKey(p.owner)}:${kind}`;
        if (writing.has(id)) return;
        writing.add(id); drawPhone(true);
        try {
            const k = await writeEntry(m, p, kind);
            if (phone() === p && view.split(':')[0] === kind) view = `${kind === 'diary' ? 'diaryone' : 'noteone'}:${k}`;
            toastr.success(kind === 'diary' ? '일기를 썼어요' : '메모를 썼어요', '캐릭터 휴대폰');
        } catch (err) { console.error('[narrative-archive] write', err); toastr.error(String(err?.message || err), kind === 'diary' ? '일기 쓰기 실패' : '메모 쓰기 실패'); }
        finally { writing.delete(id); if (phone() === p) drawPhone(); }
    });
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
        const p = phone(), k = this.dataset.k, id = `${nameKey(p.owner)}:${k}`;
        if (filling.has(id)) return;
        filling.add(id); drawPhone(true);
        try { await (k === 'money' ? fillMoney : fillVoice)(m, p); toastr.success(k === 'money' ? '은행 · 지갑 · 쇼핑을 채웠어요' : '음성 메모를 채웠어요', '캐릭터 휴대폰'); }
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
    $root.on('click', '.ax_postmore', function (e) {
        e.stopPropagation();
        const el = $root.find(`.na_ph_press[data-src="post"][data-k="${this.dataset.k}"]`)[0];
        if (!el) return;
        if ($(el).find('.ax_presssheet').length) { $(el).find('.ax_presssheet').remove(); return; }
        pressSheet(el); justPressed = false;
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
    let making = false;
    const makeFrom = async ($at, update) => { if (making) return; making = true; try { await make($at, update); } finally { making = false; } };
    $root.on('click', '.na_ph_setupd', function (e) { e.stopPropagation(); makeFrom($(this).find('.ax_v'), true); });
    $root.on('click', '.na_ph_setinj', async e => { e.stopPropagation(); const p = phone(); p.inject = !p.inject; drawPhone(true); await saveMeta(); applyInjection(); });
    // what opens under the phone scrolls into sight, so the tap visibly does something
    $root.on('change', '.na_ph_country', async function () { phone().country = this.value; drawPhone(); await saveMeta(); });
    $root.on('click', '.na_ph_theme', async function () { const p = phone(); if (this.dataset.v === 'gray') p.theme = 'gray'; else delete p.theme; drawPhone(); drawCtrl(); await saveMeta(); });
    $root.on('click', '.na_ph_wsw', async function () { phone().wall = this.dataset.w; drawPhone(); drawCtrl(); await saveMeta(); });
    $root.on('click', '.ax_rmpick', function (e) { e.stopPropagation(); const k = this.dataset.k; if (!remake.delete(k)) remake.add(k); drawPhone(true); });
    $root.on('click', '.ax_rmall', e => { e.stopPropagation(); const all = [...Object.keys(REMAKE), ...REMAKE_MORE]; if (remake.size === all.length) remake.clear(); else all.forEach(k => remake.add(k)); drawPhone(true); });
    $root.on('click', '.na_ph_setremake', async function (e) {
        e.stopPropagation();
        if (!remake.size || making) return;
        const apps = Object.keys(REMAKE).filter(k => remake.has(k)), more = REMAKE_MORE.filter(k => remake.has(k)), whole = apps.length === Object.keys(REMAKE).length;
        if (!await confirm(whole ? '폰 전체를 다시 만들까요?' : `고른 앱 ${apps.length + more.length}개를 다시 만들까요?`, `${[...apps, ...more].map(k => APPS[k]).join(' · ')} 다시 만들기${more.includes('money') ? ' · 잔액 재생성, 기존 거래 유지' : ''}`)) return;
        const keep = phone().inject, $at = $(this).find('.ax_n');
        making = true;
        try {
            const p = await withSpinner($at, '다시 만드는 중', async () => {
                const q = apps.length ? await makePhone(m, owner, whole ? {} : { apps }) : phone();
                for (const k of more) if (q) await (k === 'money' ? fillMoney(m,q,{regenerateBalances:true}) : fillVoice(m,q));
                return q;
            });
            if (!p) return;
            if (whole && keep) { p.inject = true; await saveMeta(); applyInjection(); }
            remake.clear(); view = whole ? 'lock' : 'set'; draw();
            toastr.success(whole ? `${owner}의 폰을 다시 만들었어요` : '고른 앱을 다시 만들었어요', '캐릭터 휴대폰');
        } catch (err) { toastr.error(String(err?.message || err), '다시 만들기'); }
        finally { making = false; }
    });
    $root.on('click', '.na_ph_setdel', async e => {
        e.stopPropagation();
        if (!await confirm('이 폰을 지울까요?', `${esc(owner)}의 폰 내용이 이 채팅에서 지워져요.`)) return;
        const was = phone()?.inject;
        delete m.phones[nameKey(owner)];
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
    await new Promise(done => {
        const close = () => { if (dlg.open) dlg.close(); };
        // ✕, Esc, or a tap on the dark around the phone (the sheet closes first)
        $root.on('click', '.na_ph_quit', e => { e.stopPropagation(); close(); });
        $root.on('click', '.na_ph_wrap', e => { if (e.target === e.currentTarget) { if (sheetOpen) setSheet(false); else close(); } });
        dlg.addEventListener('cancel', e => { e.preventDefault(); if (sheetOpen) setSheet(false); else close(); });
        dlg.addEventListener('close', () => { phoneClosed = true; done(); }, { once: true });
    });
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
