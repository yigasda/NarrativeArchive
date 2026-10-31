// The side panel: tabs, the start card, refresh (syncPanel), history, restore points, the wand menu and the launcher.
// The markup is panelhtml.js, the wiring panelbind.js, the ⚙ settings page panelcfg.js.

import { draftReady, drLabel, fallbackOf } from './ai.js';
import { annivToday } from './anniv.js';
import { openAppend } from './append.js';
import { openAsk } from './ask.js';
import { branchState } from './branches.js';
import { mountSectionBrowser } from './browser.js';
import { openCalendar } from './calendar.js';
import { carryOffer, currentChatId, rememberArchive } from './chats.js';
import { commitText, ctx, getMeta, globalSettings, hasChat, saveGlobal, saveMeta } from './core.js';
import { openDiff } from './diff.js';
import { openDrift } from './drift.js';
import { guessEndNumber, openExtract } from './extract.js';
import { fadeCfg, fadeFilling, fadeForce, fadeMissing, fadePlan, fadeUse } from './fade.js';
import { guessMode, lastGuess } from './guess.js';
import { openHealth } from './health.js';
import { lastIndex } from './hide.js';
import { lastBuild } from './inject.js';
import { knowledgeRows, openKnowledge } from './knowledge.js';
import { activeBooks, loreCfg } from './lore.js';
import { cfgTab, cfgView, layoutCfg, layoutCp, renderAiSettings, setCfgView, syncEmbedRows } from './panelcfg.js';
import { openPeople } from './people.js';
import { openPhone } from './phone.js';
import { openPreview } from './preview.js';
import { auOf } from './prompts.js';
import { openQuotes } from './quotes.js';
import { openReader } from './reader.js';
import { OFF_KINDS, offKinds } from './recall.js';
import { routerCandidates, routerCfg, routerState } from './router.js';
import { recentTrackers, sceneSize, styleLabel } from './scenes.js';
import { cachedTokens, checkHeadings, filterMuted, linkedMap, mutedCount, parseSections, pinnedSet, RANGE_HEAD, sectionKey } from './sections.js';
import { refreshStatus } from './status.js';
import { studioLabel } from './studio.js';
import { ICO_A, svgA } from './theme.js';
import { confirm, esc, fmt, timeLabel } from './util.js';
import { compressMode, openWizard, quickCompress } from './wizard.js';
import { openWorlds, worldBooks, worldIsOn } from './world.js';

// index.js keeps importing this from here
export { renderPanel } from './panelhtml.js';

export let sectionPanel = null;
export let refreshReplace = () => {};
export let editorDirty = false;
export function setEditorDirty(v) { editorDirty = v; }
export let editorBase = null; // the archive text the editor was last loaded from
export function setEditorBase(v) { editorBase = v; }
export function setRefreshReplace(f) { refreshReplace = f; }

// Scroll the panel editor so [from, to) is visible and select it (wrapped lines measured with a mirror div).
export function revealInEditor(from, to, { keepFocus = false } = {}) {
    const el = document.getElementById('na_editor');
    if (!el) return;
    const cs = getComputedStyle(el);
    const mirror = document.createElement('div');
    for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth', 'boxSizing', 'tabSize']) mirror.style[k] = cs[k];
    Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'break-word', width: `${el.clientWidth}px`, top: '0', left: '-9999px' });
    mirror.textContent = el.value.slice(0, from);
    const mark = document.createElement('span');
    mark.textContent = '​';
    mirror.appendChild(mark);
    document.body.appendChild(mirror);
    const y = mark.offsetTop;
    mirror.remove();
    el.scrollTop = Math.max(0, y - el.clientHeight / 3);
    const active = document.activeElement;
    el.focus({ preventScroll: true });
    el.setSelectionRange(from, to);
    el.scrollTop = Math.max(0, y - el.clientHeight / 3);
    if (keepFocus && active && active !== el) active.focus({ preventScroll: true });
}

export async function markBackup(how) {
    const m = getMeta();
    m.backup = { at: Date.now(), how };
    m.sinceBackup = 0;
    await saveMeta();
    syncPanel();
}

export const needChat = fn => (...a) => hasChat() ? fn(...a) : toastr.info('채팅을 먼저 여세요.');

// tabs: home / archive / compress / tools, and the ⚙ settings page
export function showTab(tab) {
    const $p = $('#na_settings');
    const g = globalSettings();
    if (!$p.find(`[data-pane="${tab}"]`).length) tab = 'home';
    $p.find('.na_nav_btn').each(function () { $(this).toggleClass('active', $(this).data('tab') === tab); });
    $p.find('.na_tab_pane').each(function () { $(this).prop('hidden', $(this).data('pane') !== tab); });
    $('#na_gear').toggleClass('active', tab === 'config');
    if (tab !== 'config' && g.lastTab !== tab) { g.lastTab = tab; saveGlobal(); }
    if (tab === 'config') { setCfgView(''); renderAiSettings(); layoutCfg(); }
    if (tab === 'home' && hasChat()) { startPick = null; refreshStatus(); }
    if (tab === 'archive') showArchiveView(g.archView || 'cards');
}

export function showArchiveView(view) {
    const g = globalSettings();
    if (g.archView !== view) { g.archView = view; saveGlobal(); }
    $('#na_settings .na_seg_btn').each(function () { $(this).toggleClass('active', $(this).data('view') === view); });
    $('#na_view_cards').prop('hidden', view !== 'cards');
    $('#na_view_editor').prop('hidden', view !== 'editor');
    if (view === 'cards' && hasChat()) {
        if (!sectionPanel) sectionPanel = mountSectionBrowser($('#na_sec_host'));
        else sectionPanel.render();
    }
}

// 시작하기: three steps for a first-time user (four when 주입 is off), ticked by what the extension can see. Only a fresh install
// gets it (see globalSettings); gone once every step has been done in some chat, or with 숨기기
const START_STEPS = [
    { key: 'model', short: '모델', title: '초안 모델 연결', btn: '초안 모델 정하러 가기',
        desc: '압축을 써 줄 AI 모델을 정해요. 롤플에 쓰는 모델과 따로 정할 수 있어요.', done: () => draftReady() },
    { key: 'first', short: '첫 압축', title: '첫 압축으로 아카이브 만들기', btn: '압축하러 가기',
        desc: '지금까지의 대화를 섹션으로 정리해서 아카이브를 만들어요. 압축 탭에서 방법을 고르고 압축하기를 눌러요.',
        done: m => parseSections(m.text).some(x => !x.group && RANGE_HEAD.test(x.title)) },
    { key: 'line', short: '경계선', title: '경계선 확인', btn: '경계선 보러 가기',
        desc: '아카이브가 어디까지 담았는지 표시해요. 그 앞 메시지는 숨겨서 AI가 같은 내용을 두 번 읽지 않게 해요.',
        done: m => m.boundary >= 0 || !!m.track },
    { key: 'inject', short: '주입', title: '주입 켜기', btn: '주입 켜러 가기',
        desc: '아카이브를 롤플 모델에게 보여 줘요. 켜야 지난 이야기를 기억해요.', done: m => !!m.enabled },
];
let startPick = null; // a step the user tapped to read, else the first one not done
export function setStartPick(v) { startPick = v; }
export function goStart(key) {
    if (key === 'model' || key === 'inject') {
        showTab('config');
        setCfgView(key === 'model' ? 'aimodel' : 'inject');
        cfgTab[cfgView] = key === 'model' ? 'dr' : 'place';
        layoutCfg();
        $('#na_settings .na_tab_pane[data-pane="config"]').scrollTop(0);
        return;
    }
    showTab('compress');
    if (key === 'line') {
        $('#na_cp_more').prop('open', true);
        const row = document.getElementById(getMeta().track ? 'na_track' : 'na_boundary_row');
        row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (!getMeta().track) setTimeout(() => $('#na_boundary').trigger('focus'), 300);
    }
}
// true while the card is up
export function renderStart(m) {
    const g = globalSettings();
    // 주입 is on in a new chat, so its step only shows for someone who turned it off
    const steps = START_STEPS.filter(x => x.key !== 'inject' || !m.enabled);
    const done = steps.map(x => !!x.done(m));
    if (!g.startDone && done.every(Boolean)) { g.startDone = true; saveGlobal(); }
    const show = hasChat() && !g.startDone && !g.startHidden;
    $('#na_start').prop('hidden', !show);
    if (!show) return false;
    const first = done.indexOf(false);
    const cur = startPick !== null && startPick < steps.length ? startPick : first;
    const st = steps[cur];
    const n = done.filter(Boolean).length;
    const last = steps.length - 1;
    const fill = Math.max(0, Math.min(last, first)) / last; // the line is orange up to the step to do
    $('#na_start').html(`
      <div class="na_start_head"><b>시작하기</b><span class="na_start_n">${n} / ${steps.length}</span><button type="button" class="na_start_hide">숨기기</button></div>
      <div class="na_start_steps" style="--fill:${fill};--n:${steps.length}">${steps.map((x, i) => `<button type="button" class="na_start_step${done[i] ? ' done' : ''}${i === cur ? ' cur' : ''}" data-i="${i}" aria-label="${i + 1}단계 · ${x.title}${done[i] ? ' · 했어요' : ''}"><span class="na_start_dot">${done[i] ? svgA(ICO_A.check, 14, 3) : i + 1}</span><span class="na_start_lab">${x.short}</span></button>`).join('')}</div>
      <div class="na_start_body"><b>${st.title}${done[cur] ? ' <small>· 했어요</small>' : ''}</b><span>${st.desc}</span></div>
      <button type="button" class="na_start_go${done[cur] ? ' done' : ''}" data-key="${st.key}">${st.btn}</button>`);
    return true;
}

// the one thing worth doing next, on the home tab
export function renderNext(m, { afterTok, health }) {
    let html;
    // 이야기 속 기념일: one line when the story's date comes round to a remembered day
    const av = annivToday(m);
    $('#na_anniv_now').prop('hidden', !av).html(av ? `<button type="button" class="na_anniv_go"><span class="na_anniv_dot"><svg class="na_heart" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 20.5s-7.8-4.7-9.7-9.5C1 7.6 3.2 4.5 6.6 4.5c2.2 0 3.8 1.2 5.4 3.1 1.6-1.9 3.2-3.1 5.4-3.1 3.4 0 5.6 3.1 4.3 6.5-1.9 4.8-9.7 9.5-9.7 9.5z"/></svg></span><span>이야기 속 오늘은 <b>${esc(av.name)}</b> ${av.years}년째예요</span></button><button type="button" class="na_anniv_x" data-k="${esc(`${av.key}:${av.years}`)}" title="닫기" aria-label="닫기">✕</button>` : '');
    // while 시작하기 is up it is the thing to do next
    if (renderStart(m)) { $('#na_next').html(''); $('#na_ai_status').html('').attr('title', ''); return; }
    const card = (icon, title, desc, btns, tone = '') => `<div class="na_next_card ${tone}"><i class="fa-solid ${icon}"></i><div class="na_next_main"><b>${title}</b>${desc ? `<span>${desc}</span>` : ''}</div><div class="na_next_btns">${btns}</div></div>`;
    const btn = (act, label, primary = true) => `<button type="button" class="na_btn na_small ${primary ? 'na_primary' : ''}" data-act="${act}">${label}</button>`;
    const issues = health ? health.items.filter(x => x.level === 'bad' || x.level === 'warn') : [];
    if (!m.text.trim()) html = card('fa-seedling', '아카이브가 비어 있어요', '압축 마법사로 첫 섹션을 만들거나, 다른 채팅·파일에서 가져와요.', btn('wizard', '압축 마법사') + btn('import', '가져오기', false));
    else if (!m.enabled) html = card('fa-power-off', '주입이 꺼져 있어요', '아카이브가 RP 모델에 안 들어가고 있어요.', btn('enable', '켜기'), 'warn');
    else if (issues.length) html = card('fa-stethoscope', `확인할 것 ${issues.length}개`, esc(issues[0].title), btn('health', '건강 점검'), issues.some(x => x.level === 'bad') ? 'bad' : 'warn');
    // nothing to do: no card, just a quiet line next to the AI 도구 heading
    const ok = !html;
    $('#na_next').html(html || '');
    $('#na_ai_status').html(ok ? '<i></i>할 일 없어요' : '').attr('title', ok && m.boundary >= 0 ? `경계선 #${m.boundary} 뒤 원문 ${fmt(afterTok)} 토큰` : '');
}

export function nextAction(act) {
    if (!hasChat()) return;
    if (act === 'wizard') openWizard();
    else if (act === 'health') openHealth();
    else if (act === 'import') { showTab('tools'); $('#na_import_opts').prop('hidden', false); }
    else if (act === 'enable') $('#na_enabled').prop('checked', true).trigger('change');
}

export let cfgFadeOpen = false;
export function setCfgFadeOpen(v) { cfgFadeOpen = v; }
export function syncPanel() {
    if (!$('#na_settings').length) return;
    const on = hasChat();
    $('#na_settings .na_tab_pane, #na_settings .na_nav, #na_meter').toggleClass('na_disabled', !on);
    $('#na_nochat').prop('hidden', on);
    if (!on) { $('#na_carry').prop('hidden', true); refreshStatus(); return; }
    const m = getMeta();
    if (!sectionPanel && $('#na_view_cards').length && !$('#na_view_cards').prop('hidden')) sectionPanel = mountSectionBrowser($('#na_sec_host'));
    if (!editorDirty) { editorBase = m.text; $('#na_editor').val(m.text).trigger('input'); }
    $('#na_enabled').prop('checked', !!m.enabled);
    $('#na_cache_save').prop('checked', globalSettings().cacheSave !== false);
    $('#na_position').val(String(m.position));
    $('#na_depth').val(m.depth);
    $('#na_depth_field').prop('hidden', Number(m.position) !== 1);
    $('#na_role').val(String(m.role));
    $('#na_muted_n').text(mutedCount(m));
    $('#na_link_depth').val(m.linkDepth || 4);
    {
        { const t = hasChat() ? recentTrackers(1)[0] : null; $('#na_trk_sub').text(t ? `마지막 상태창: ${[t.date, t.time, t.place].filter(Boolean).join(' · ')} (#${t.i})` : '못 찾음 · 장면은 메시지 수로 나눠요'); }
        { const ok = offKinds(); $('#na_off_fold .na_off_chip').each(function () { $(this).toggleClass('on', !!ok[this.dataset.k]).attr('aria-pressed', String(!!ok[this.dataset.k])); }); const on = Object.keys(OFF_KINDS).filter(k => ok[k]); $('#na_off_sub').text(on.length ? `누르면 켜고 꺼요 · ${on.length}가지 빼는 중` : '누르면 켜고 꺼요 · 지금은 아무것도 안 빼요'); }
        $('#na_fallback').val(fallbackOf());
        const lc = loreCfg();
        $('#na_lore').prop('checked', lc.on); $('#na_lore_budget').val(lc.budget); $('#na_lore_budget_row').toggle(lc.on);
        activeBooks().then(bs => $('#na_lore_sub').text(bs.length ? `${lc.on ? '켬' : '꺼짐'} · 이 채팅의 로어북 ${bs.length}개` : '이 채팅이 쓰는 로어북이 없어요'));
    }
    const rc = routerCfg(m);
    $('#na_router_mode').val(rc.mode);
    $('#na_router_opts').prop('hidden', rc.mode === 'off');
    $('#na_router_keep_row').toggle(rc.mode === 'old' || rc.mode === 'lift');
    $('#na_router_sub').text(rc.mode === 'lift' ? (fadeCfg(m).on ? '임베딩 · 키워드로 골라 원문으로 · 나머지는 망각 곡선대로' : '망각 곡선을 켜야 효과가 있어요 · 지금은 전부 원문이에요') : '답하기 직전에 필요한 섹션을 골라요');
    $('#na_router_max').val(rc.max); $('#na_router_keep').val(rc.keep); $('#na_router_follow').prop('checked', rc.follow);
    {
        const fc = fadeCfg(m);
        $('#na_fade').prop('checked', fc.on); $('#na_fade_opts').prop('hidden', !fc.on || !cfgFadeOpen);
        $('#na_fade_more').prop('hidden', !fc.on).toggleClass('on', cfgFadeOpen);
        const fadeSub = pct => fc.on ? `원문 ${fc.full} · 짧게 ${fc.short} · 나머지 요점${pct ? ` · 지금 −${pct}%` : ''}` : '오래된 섹션은 짧은 버전·요점으로';
        $('#na_fade_sub').text(fadeSub(0));
        $('#na_fade_full').val(fc.full); $('#na_fade_short').val(fc.short);
        { const fn = Object.keys(fadeForce(m)).length; $('#na_fade_pick_sub').text(fn ? `직접 고른 섹션 ${fn}개 · 망각 곡선보다 먼저` : '여러 섹션을 골라 원문 · 짧게 · 요점으로'); }
        if (fc.on) {
            const plan = [...fadePlan(m).values()];
            const miss = fadeMissing(m).length, more = fadeMissing(m, true).length - miss;
            if (!fadeFilling) $('#na_fade_info').html(miss ? `버전 없는 섹션 <b>${miss}</b>개 · 지금은 원문으로 들어가요` : more ? `필요한 버전은 다 있어요 · 나머지 <b>${more}</b>개도 채울 수 있어요` : '모든 섹션에 버전이 있어요');
            $('#na_fade_lines').text(`${plan.filter(p => p.want === 'line').length}개`);
            // one bar per numbered section, oldest first: tall = whole, mid = short, low = one line
            $('#na_fade_strip').html(plan.map(p => { const use = fadeUse(m, m.text, p.s, p.want); const k = p.why === 'pin' ? 'pin' : use !== p.want && p.want !== 'long' ? 'miss' : use; return `<span class="${k}" title="${esc(p.s.title)}"></span>`; }).join(''));
            const was = filterMuted(m, m.text);
            cachedTokens(was).then(t => {
                const now = lastBuild.tokens || 0;
                $('#na_fade_now').text(fmt(now));
                $('#na_fade_was').text(t > now ? fmt(t) : '');
                $('#na_fade_pct').text(t > now ? `−${Math.round((1 - now / t) * 100)}%` : '').prop('hidden', !(t > now));
                if (fadeCfg(getMeta()).on) $('#na_fade_sub').text(fadeSub(t > now ? Math.round((1 - now / t) * 100) : 0));
            });
        }
    }
    const rs = routerState.get(currentChatId());
    $('#na_guess').val(guessMode());
    syncEmbedRows();
    { const gs = lastGuess(); $('#na_guess_sub').text(guessMode() === 'off' ? '돌려 말한 지난 일도 찾게' : gs ? `마지막 짐작: ${gs.length > 60 ? `${gs.slice(0, 59)}…` : gs}` : '돌려 말한 지난 일도 찾게 · 답마다 짧게 한 번 더').attr('title', gs); }
    $('#na_router_info').text(rs?.via === 'lift' ? `마지막: ${rs.titles.length}개 · AI 없이 · 후보 ${rs.cands}개` : rs ? `마지막: ${rs.titles.length}개 · ${rs.via === 'index' ? `색인으로 (${rs.why || 'AI 안 됨'})` : `${(rs.ms / 1000).toFixed(1)}초`} · 후보 ${rs.cands}개${rs.short && rs.short < rs.cands ? ` 중 ${rs.short}개 자세히` : ''}` : `후보 ${routerCandidates(m).length}개 · 최근 대화로 한 번 골라 봐요`);
    {
        const keys = new Set(parseSections(m.text).map(sectionKey));
        $('#na_linked_n').text(Object.keys(linkedMap(m)).filter(t => keys.has(t)).length);
    }
    $('#na_backup_every').val(m.backupEvery === 0 ? '' : (m.backupEvery ?? 10));
    {
        const due = m.backupEvery > 0 && m.sinceBackup >= m.backupEvery;
        $('#na_backup_info').html(m.backup
            ? `마지막 백업 ${esc(timeLabel(m.backup.at))} (${m.backup.how === 'json' ? '.json' : '.txt'}) · 그 뒤 <b class="${due ? 'na_warn_txt' : ''}">${m.sinceBackup || 0}번</b> 바뀜`
            : `아직 백업한 적 없어요${m.sinceBackup ? ` · <b class="${due ? 'na_warn_txt' : ''}">${m.sinceBackup}번</b> 바뀜` : ''}`);
    }
    renderHistory();
    $('#na_snap_n').text(m.snapshots.length);
    $('#na_cap').val(m.tokenCap || '');
    {
        const titles = new Set(parseSections(m.text).map(sectionKey));
        const n = [...pinnedSet(m)].filter(t => titles.has(t)).length;
        $('#na_pinned_n').text(n);
        $('#na_unpin_all').prop('disabled', !n);
    }
    $('#na_unmute_all').prop('disabled', !mutedCount(m));
    $('#na_carry').prop('hidden', !carryOffer);
    if (hasChat()) {
        const mm = getMeta();
        const kn = knowledgeRows(mm).length;
        $('#na_know_sub').text(kn ? `비밀마다 아는 사람${mm.knowInject ? ' · 주입 중' : ''}` : '비밀마다 아는 사람·모르는 사람');
        $('#na_know_badge').text(kn ? `${kn}개` : '').prop('hidden', !kn);
        const vn = Object.keys(mm.voice || {}).length;
        { const wb = worldBooks(), on = wb.filter(w => worldIsOn(mm, w)); $('#na_worlds_sub').text(wb.length ? `${wb.length}개 · 이 채팅에 ${on.length ? on.map(w => w.name).join(', ') : '없음'}` : '여러 채팅이 같이 쓰는 설정 · 고치면 모든 채팅에 반영'); }
        const qn = (mm.quotes || []).length;
        $('#na_quotes_sub').text(vn ? `말투 지문 ${vn}개${mm.voiceInject ? ' · 주입 중' : ''}` : qn ? '말투 지문은 아직 없어요' : '대사를 모아 말투 지문으로');
        $('#na_quotes_badge').text(qn ? `대사 ${qn}` : '').prop('hidden', !qn);
        const dl = mm.driftLast;
        $('#na_drift_sub').text(dl ? `${timeLabel(dl.at)}에 살펴봄` : '최근 대화가 아카이브와 어긋나는지');
        const dOk = !!dl && (dl.none || (dl.checked && !dl.n));
        $('#na_drift_badge').text(dl ? (dOk ? '어긋남 없음' : `${dl.n}개 어긋남`) : '').toggleClass('warn', !!dl && !dOk).prop('hidden', !dl);
    }
    const br = hasChat() ? branchState(getMeta()) : null;
    $('#na_branch_card').prop('hidden', !br?.ahead.length);
    if (br?.ahead.length) $('#na_branch_desc').text(`이 채팅은 #${br.last}까지인데 아카이브에 그 뒤(#${br.ahead[0].from}~) 섹션 ${br.ahead.length}개가 있어요. 분기하기 전 원본의 내용이에요.`);
    $('#na_branches_sub').text(br?.parent ? `이 채팅은 분기예요 · 원본: ${br.parent}` : '원본·갈라진 채팅과 비교, 분기 정리');
    if (carryOffer) $('#na_carry_desc').text(`방금 있던 채팅의 아카이브 (${fmt(carryOffer.text.length)}자)를 이 채팅에 가져와요.`);
    rememberArchive();
    $('#na_boundary').val(m.boundary >= 0 ? m.boundary : '');
    $('#na_track').prop('checked', !!m.track);
    $('#na_rules_sys').prop('checked', !!globalSettings().rulesInSystem);
    $('#na_cmode').val(compressMode()); layoutCp();
    $('#na_scsize').val(String(sceneSize()));
    $('#na_style_sub').text(styleLabel(getMeta()));
    { const wn = String(getMeta().workNote || '').trim(); $('#na_worknote_sub').text(wn ? `약 ${wn.length.toLocaleString()}자 · 장면마다 같이` : '장면마다 같이 보내요'); }
    {
        const au = auOf(m);
        $('#na_au_sub').text(au.on ? `요약이 본편 뒤 ${au.name} 묶음으로 이어져요` : '본편 기억을 들고 온 채팅이면 켜요');
        $('#na_au_on').prop('hidden', !au.on);
        $('#na_quick_sub').text(draftReady() ? `초안 모델(${drLabel()})로 요약 → 확인하고 추가${au.on ? ` · ${au.name}` : ''}` : '⚙ 설정 → AI 모델 → 초안 모델을 정하면 쓸 수 있어요');
        $('#na_studio_sub').text(draftReady() ? studioLabel() : '⚙ 설정 → AI 모델 → 초안 모델을 정하면 쓸 수 있어요');
    }
    $('#na_boundary_row').toggleClass('na_disabled', !!m.track);
    {
        const n = guessEndNumber(m.text);
        $('#na_track_info').html(n === null ? '제목에 #번호가 없어요'
            : `마지막 제목 번호가 곧 경계선${n > lastIndex() ? ` <span class="na_warn_txt">· 아카이브 #${n}이 채팅보다 커요</span>` : ''}`).attr('title', n === null ? '' : `아카이브 마지막 번호 #${n}`);
    }
    $('#na_keep').val(m.keep);
    sectionPanel?.render();
    renderHeadingCheck();
    if ($('#na_replace').prop('open')) refreshReplace();
    renderSnapshots();
    refreshStatus();
}

export function renderHeadingCheck() {
    const $l = $('#na_hcheck_list');
    if (!$l.length || !hasChat()) return;
    const { issues, ranged } = checkHeadings(getMeta().text);
    $('#na_hcheck_n').text(issues.length ? `${issues.length}곳` : (ranged ? '문제 없음' : '번호 제목 없음'))
        .toggleClass('na_chip_warn', !!issues.length).toggleClass('na_chip_on', !issues.length && !!ranged);
    $l.empty();
    if (!issues.length) {
        $l.html(`<div class="na_empty">${ranged ? `번호 제목 ${ranged}개 모두 형식·순서가 맞아요.` : '"## #시작–#끝 — 제목" 형식의 제목이 없어요.'}</div>`);
        return;
    }
    issues.forEach(it => {
        const $row = $(`<button type="button" class="na_hc_row"><span class="na_hc_title">${esc(it.title)}</span><span class="na_hc_msg">${esc(it.msg)}</span></button>`);
        $row.on('click', () => sectionPanel?.focus(it.start));
        $l.append($row);
    });
}

// "추가 · 수정 · 제목 · 삭제" lines for one history entry
export function histParts(h) {
    const names = arr => arr.map(t => `<span class="na_hist_sec">${esc(t)}</span>`).join('');
    const parts = [];
    if (h.added.length) parts.push(`<div><span class="na_hist_k na_hist_add">추가</span>${names(h.added)}</div>`);
    if (h.changed.length) parts.push(`<div><span class="na_hist_k">수정</span>${names(h.changed)}</div>`);
    if (h.renamed?.length) parts.push(`<div><span class="na_hist_k">제목</span>${names(h.renamed)}</div>`);
    if (h.removed.length) parts.push(`<div><span class="na_hist_k na_hist_del">삭제</span>${names(h.removed)}</div>`);
    if (!parts.length) parts.push('<div class="na_dim">섹션 밖 글자만 바뀜</div>');
    return parts.join('');
}

// changes whose restore point is gone; the rest show under their restore point
export function renderHistory() {
    const $l = $('#na_hist_list');
    if (!$l.length || !hasChat()) return;
    const m = getMeta();
    $l.empty();
    const snapAts = new Set(m.snapshots.map(x => x.at));
    const old = m.history.filter(h => !h.snapAt || !snapAts.has(h.snapAt));
    $('#na_hist_more').prop('hidden', !old.length);
    $('#na_hist_n').text(old.length);
    old.forEach(h => {
        $l.append(`
          <div class="na_hist">
            <div class="na_hist_top">
              <span class="na_snap_time">${esc(timeLabel(h.at))}</span>
              <span class="na_snap_reason">${esc(h.reason)}</span>
              <span class="na_hist_delta ${h.delta >= 0 ? 'na_hist_add' : 'na_hist_del'}">${h.delta >= 0 ? '+' : '−'}${fmt(Math.abs(h.delta))}자</span>
            </div>
            <div class="na_hist_body">${histParts(h)}</div>
          </div>`);
    });
}

export function renderSnapshots() {
    const $l = $('#na_snap_list');
    if (!$l.length || !hasChat()) return;
    renderHistory();
    const m = getMeta();
    $l.empty();
    if (!m.snapshots.length) {
        $l.html('<div class="na_empty">아직 복구 지점이 없어요.</div>');
        return;
    }
    m.snapshots.forEach((s, i) => {
        const diff = s.text.length - m.text.length;
        // the change made right after this point, and the state right after it (the next point, or now)
        const hi = m.history.findIndex(x => x.snapAt === s.at), h = m.history[hi];
        const after = h ? (hi === 0 ? { text: m.text, label: '바뀐 뒤 (지금)' } : (() => { const n = m.snapshots.find(x => x.at === m.history[hi - 1].snapAt); return n ? { text: n.text, label: '바뀐 뒤' } : null; })()) : null;
        const $row = $(`
          <div class="na_snap">
            <div class="na_snap_main">
              <span class="na_snap_time">${esc(timeLabel(s.at))}</span>
              <span class="na_snap_reason">${esc(s.reason)}</span>
              <span class="na_snap_meta">${fmt(s.text.length)}자 · 지금보다 ${diff === 0 ? '같음' : `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}자`}${s.boundary >= 0 ? ` · #${s.boundary}까지` : ''}</span>
              ${h ? `<div class="na_hist_body na_snap_hist"><small class="na_dim">그 뒤 바뀐 것</small>${histParts(h)}</div>` : ''}
            </div>
            <div class="na_snap_btns">
              ${after && hi > 0 ? '<button type="button" class="na_icon na_snap_then" title="그때 바뀐 내용"><i class="fa-solid fa-code-commit"></i></button>' : ''}
              <button type="button" class="na_icon na_snap_diff" title="지금과 비교"><i class="fa-solid fa-code-compare"></i></button>
              <button type="button" class="na_icon na_snap_view" title="내용 보기"><i class="fa-regular fa-eye"></i></button>
              <button type="button" class="na_icon na_snap_restore" title="이 지점으로 복원"><i class="fa-solid fa-clock-rotate-left"></i></button>
              <button type="button" class="na_icon na_snap_del" title="삭제"><i class="fa-regular fa-trash-can"></i></button>
            </div>
          </div>`);
        $row.find('.na_snap_diff').on('click', () => openDiff(s, undefined, { restore: () => $row.find('.na_snap_restore').trigger('click') }));
        $row.find('.na_snap_then').on('click', () => openDiff(s, after));
        $row.find('.na_snap_view').on('click', () => {
            const c = ctx();
            const $v = $('<div class="na_popup"><textarea class="text_pole na_full" readonly spellcheck="false"></textarea></div>');
            $v.find('textarea').val(s.text);
            c.callGenericPopup($v, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, okButton: '닫기' });
        });
        $row.find('.na_snap_restore').on('click', async () => {
            if (!await confirm('복원', `${timeLabel(s.at)} (${esc(s.reason)}) 상태로 되돌릴까요? 지금 내용도 복구 지점에 남아요.`)) return;
            editorDirty = false;
            await commitText(s.text, '복원 전', { boundary: s.boundary });
            toastr.success('복원됨');
        });
        $row.find('.na_snap_del').on('click', async () => {
            m.snapshots = m.snapshots.filter(x => x !== s); await saveMeta(); renderSnapshots();
        });
        $l.append($row);
    });
}

// magic-wand (extensions) menu entries
// the wand menu: one "서사 아카이브" entry that opens the tool launcher (the panel itself is one tap further).
// SillyTavern builds #extensionsMenu asynchronously, so wait for it if it isn't there yet.
export function addWandMenu() {
    const put = () => {
        const $menu = $('#extensionsMenu');
        if (!$menu.length) return false;
        if ($('#na_wand_container').length) return true;
        const $box = $('<div id="na_wand_container" class="extension_container"></div>');
        const $it = $(`<div id="na_wand_open" class="list-group-item flex-container flexGap5 interactable" tabindex="0" title="서사 아카이브">
            <div class="fa-solid fa-feather-pointed extensionsMenuExtensionButton"></div><span>서사 아카이브</span></div>`);
        $it.on('click', () => openLauncher());
        $it.on('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLauncher(); } });
        $menu.append($box.append($it));
        return true;
    };
    if (put()) return;
    const mo = new MutationObserver(() => { if (put()) mo.disconnect(); });
    mo.observe(document.body, { childList: true });
}

// the very same panel as in the extensions tab: #na_settings is moved into a popup while it is open
// (same elements, same handlers, same styles) and put back where it was when the popup closes
export async function openPanelPopup(tab = '') {
    const $set = $('#na_settings');
    if (!$set.length || $set.hasClass('na_in_popup')) return;
    if (tab) showTab(tab);
    const c = ctx();
    const $mark = $('<div id="na_settings_home" hidden></div>');
    $set.before($mark);
    const $wrap = $('<div class="na_panelpop"></div>').append($set.addClass('na_in_popup'));
    refreshStatus();
    try {
        await c.callGenericPopup($wrap, c.POPUP_TYPE.TEXT, '', { wide: false, large: false, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
    } finally {
        $set.removeClass('na_in_popup');
        $mark.replaceWith($set);
    }
}

// the wand menu's tool launcher: a tab row at the top (opens the extension panel itself, at that tab, in a popup),
// then every tool in four small groups. Whatever opens sits on top of the launcher.
export async function openLauncher() {
    const c = ctx();
    const groups = [
        ['아카이브', [
            ['read', ICO_A.book, '읽기', openReader, true],
            ['ask', ICO_A.chat, '질문', openAsk, true],
            ['preview', ICO_A.eye, '주입 미리보기', openPreview, true],
        ]],
        ['압축', [
            ['wizard', ICO_A.wand, '압축 마법사', openWizard, true],
            ['quick', ICO_A.bolt, '한 번에 압축', quickCompress, true],
            ['extract', ICO_A.scissors, '원문 뽑기', openExtract, true],
            ['append', ICO_A.fileplus, '아카이브에 추가', openAppend, true],
        ]],
        ['이야기', [
            ['people', ICO_A.users, '인물 도감', openPeople, true],
            ['calendar', ICO_A.calendar, '이야기 달력', openCalendar, true],
            ['phone', ICO_A.phone, '캐릭터 휴대폰', () => openPhone(), true],
            ['worlds', ICO_A.globe, '세계관 공유', openWorlds, false],
        ]],
        ['AI 도구 · 점검', [
            ['quotes', ICO_A.quote, '대사 은행', openQuotes, true],
            ['know', ICO_A.users, '누가 아는가', openKnowledge, true],
            ['drift', ICO_A.route, '이탈 감지', openDrift, true],
            ['health', ICO_A.steth, '건강 점검', openHealth, true],
        ]],
    ];
    const tabs = [['home', ICO_A.home, '홈'], ['archive', ICO_A.archive, '아카이브'], ['compress', ICO_A.compress, '압축'], ['tools', ICO_A.grid, '도구'], ['config', ICO_A.gear, '설정']];
    const fns = {};
    for (const [t] of tabs) fns[`tab_${t}`] = () => openPanelPopup(t);
    const $root = $(`
      <div class="na_popup na_v2 na_launch">
        <div class="na_v2_title"><b>서사 아카이브</b><small>${hasChat() ? '열 도구를 골라요' : '채팅을 열면 모든 도구를 쓸 수 있어요'}</small></div>
        <div class="na_launch_grp">
          <span class="na_launch_lbl">패널로 가기</span>
          <div class="na_launch_tabs">${tabs.map(([t, ico, label]) => `<button type="button" class="na_launch_go na_launch_tab" data-id="tab_${t}">${svgA(ico, 17)}<span>${label}</span></button>`).join('')}</div>
        </div>
        ${groups.map(([title, items]) => `
        <div class="na_launch_grp">
          <span class="na_launch_lbl">${title}</span>
          <div class="na_launch_grid" style="--n:${items.length}">${items.map(([id, ico, label, fn, chat]) => { fns[id] = chat ? needChat(fn) : fn; return `<button type="button" class="na_launch_go na_launch_btn" data-id="${id}" ${chat && !hasChat() ? 'disabled' : ''}><span class="na_launch_ic">${svgA(ico, 18)}</span><span>${label}</span></button>`; }).join('')}</div>
        </div>`).join('')}
      </div>`);
    // the tool opens on top; closing it comes back here
    $root.on('click', '.na_launch_go', function () { fns[this.dataset.id]?.(); });
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: false, large: false, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}
