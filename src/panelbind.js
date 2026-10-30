// The side panel's event wiring (bindPanel).

import { aiLabel, askAI, askDraft, connSettings, draftReady, draftSettings, drLabel, listModels, trLabel, trSettings, vxModelList, withSpinner } from './ai.js';
import { openAppend } from './append.js';
import { openAsk } from './ask.js';
import { openBranches } from './branches.js';
import { openCalendar } from './calendar.js';
import { carryOffer, currentChatId, importArchive, openChatPicker, pickFromBundle, setCarryOffer } from './chats.js';
import { commitText, ctx, getMeta, globalSettings, hasChat, pushSnapshot, saveGlobal, saveMeta, SETTING_KEYS, SNAPSHOT_MAX, VERSION } from './core.js';
import { openCompare } from './diff.js';
import { openDrift } from './drift.js';
import { EMBED_DEFAULT_MODEL, embedCfg, setEmbed, syncEmbed } from './embed.js';
import { openExtract } from './extract.js';
import { fadeCfg, fadeFilling, fillFade, openFadePicker } from './fade.js';
import { openHealth } from './health.js';
import { applyHide, openUnhide, syncTrackedBoundary } from './hide.js';
import { applyInjection } from './inject.js';
import { openKeywordTest } from './keywords.js';
import { openKnowledge } from './knowledge.js';
import { setLore } from './lore.js';
import { cfgFadeOpen, editorBase, editorDirty, goStart, markBackup, needChat, nextAction, renderSnapshots, renderStart, revealInEditor, sectionPanel, setCfgFadeOpen, setEditorBase, setEditorDirty, setRefreshReplace, setStartPick, showArchiveView, showTab, syncPanel } from './panel.js';
import { applyCfgTab, cfgTab, cfgView, cpMethod, drawModels, embTyping, layoutCfg, layoutCp, renderAiSettings, renderCfgTiles, setCfgView, setEmbTyping, syncEmbedRows, tagCfgTabs } from './panelcfg.js';
import { openPeople } from './people.js';
import { openPhone } from './phone.js';
import { openPreview } from './preview.js';
import { bindPromptSettings } from './prompts.js';
import { openQuotes } from './quotes.js';
import { openReader } from './reader.js';
import { offKinds, setOffKind } from './recall.js';
import { routerCfg, routerState, runRouter } from './router.js';
import { openStyleSamples, openWorkNote, recentTrackers } from './scenes.js';
import { groupLabel, parseSections, sectionKey } from './sections.js';
import { refreshStatus } from './status.js';
import { openStudio } from './studio.js';
import { ICO_A, setUiTheme, svgA, uiTheme } from './theme.js';
import { AI_SYS_TRANSLATE, askTranslator, openGlossary } from './translate.js';
import { chatLabel, confirm, copyText, countTokens, download, esc, escRe, fmt, nowStamp } from './util.js';
import { openAuSettings, openWizard, quickCompress } from './wizard.js';
import { openWorlds } from './world.js';
import { openXray } from './xray.js';

export function bindPanel() {
    const $p = $('#na_settings');

    $p.find('.na_nav_btn').on('click', function () { showTab($(this).data('tab')); });
    bindPromptSettings();
    $('#na_gear').on('click', () => showTab($('[data-pane="config"]').prop('hidden') ? 'config' : (globalSettings().lastTab || 'home')));
    $('#na_cfg_back').on('click', () => { if (cfgView && !$('#na_cfg_q').val()) { setCfgView(''); layoutCfg(); } else showTab(globalSettings().lastTab || 'home'); });
    tagCfgTabs();
    $('#na_cfg_tiles, #na_cfg_tabs').on('click', '[data-t]', function () { cfgTab[cfgView] = this.dataset.t; renderCfgTiles(); applyCfgTab(); });
    // tiles follow every change made below them
    $('#na_settings .na_tab_pane[data-pane="config"]').on('change click', '.na_cfg_grp', () => { if (cfgView) setTimeout(renderCfgTiles, 0); });
    $('#na_cfg_index').on('click', '.na_cfg_card', function () { setCfgView(this.dataset.g); layoutCfg(); $('#na_settings .na_tab_pane[data-pane="config"]').scrollTop(0); });
    $('input[name="na_ui_theme"]').prop('checked', function () { return this.value === uiTheme(); })
        .on('change', function () { if (this.checked) setUiTheme(this.value); });
    $p.find('.na_seg_btn').on('click', function () { showArchiveView($(this).data('view')); });
    // home quick actions
    $('#na_q_read').on('click', needChat(openReader));
    $('#na_q_ask').on('click', needChat(openAsk));
    // 홈의 압축: 초안 모델이 있으면 한 번에 압축, 없으면 압축 마법사
    $('#na_q_wizard').on('click', needChat(() => draftReady() ? quickCompress() : openWizard()));
    $('#na_q_preview').on('click', needChat(openPreview));
    $('#na_next').on('click', '[data-act]', function () { nextAction(this.dataset.act); });
    $('#na_anniv_now').on('click', '.na_anniv_go', needChat(openCalendar))
        .on('click', '.na_anniv_x', needChat(async e => { const m = getMeta(); m.annivSeen = { ...(m.annivSeen || {}), [e.currentTarget.dataset.k]: true }; await saveMeta(); refreshStatus(); }));
    $('#na_start').on('click', '.na_start_step', function () { setStartPick(Number(this.dataset.i)); renderStart(getMeta()); })
        .on('click', '.na_start_go', function () { setStartPick(null); goStart(this.dataset.key); })
        .on('click', '.na_start_hide', () => { globalSettings().startHidden = true; saveGlobal(); refreshStatus(); });
    // small menus
    $('#na_ed_more').on('click', e => { e.stopPropagation(); $('#na_ed_menu').prop('hidden', !$('#na_ed_menu').prop('hidden')); });
    $('#na_ed_menu').on('click', 'button', () => $('#na_ed_menu').prop('hidden', true));
    $(document).on('click', e => { if (!$(e.target).closest('.na_more_wrap').length) $('#na_ed_menu').prop('hidden', true); });
    $('#na_import_menu').on('click', () => $('#na_import_opts').prop('hidden', !$('#na_import_opts').prop('hidden')));
    $('#na_tool_health').on('click', needChat(openHealth));
    $('#na_tool_xray').on('click', needChat(openXray));
    $('#na_story_cal').on('click', needChat(openCalendar));
    $('#na_people').on('click', needChat(openPeople));
    $('#na_phone').on('click', needChat(() => openPhone()));
    $('#na_worlds').on('click', needChat(openWorlds));
    $('#na_au').on('click', needChat(async () => { await openAuSettings(); syncPanel(); }));

    // --- editor
    const $ed = $('#na_editor');
    let tokTimer;
    const updateEdTok = () => {
        clearTimeout(tokTimer);
        tokTimer = setTimeout(async () => $('#na_ed_tok').text(`${fmt(await countTokens($ed.val()))} 토큰`), 500);
    };
    const setDirty = v => { setEditorDirty(v); $('#na_ed_dirty').prop('hidden', !v); };
    $ed.on('input', () => { setDirty(hasChat() && $ed.val() !== getMeta().text); updateEdTok(); });
    $ed.on('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); $('#na_ed_save').trigger('click'); }
    });
    $('#na_ed_save').on('click', needChat(async () => {
        if (editorBase !== null && getMeta().text !== editorBase && !await confirm('다른 곳에서 바뀌었어요', '편집칸을 연 뒤에 아카이브가 다른 곳(추가·섹션 카드 편집·마법사 등)에서 바뀌었어요. 지금 편집칸 내용으로 저장하면 그 변경이 사라져요. 그래도 저장할까요? 지금 내용은 복구 지점에 남아요.')) return;
        setEditorDirty(false);
        const changed = await commitText($ed.val(), '본문 저장 전');
        setEditorBase(getMeta().text);
        setDirty(false);
        toastr.success(changed ? '아카이브 저장됨' : '바뀐 내용이 없어요');
    }));
    $('#na_ed_revert').on('click', needChat(() => {
        setEditorBase(getMeta().text); $ed.val(editorBase); setDirty(false); updateEdTok();
    }));
    $('#na_ed_copy').on('click', async () => {
        const ok = await copyText($ed.val(), $ed[0]);
        ok ? toastr.success('복사됨') : toastr.warning('복사가 막혀 있어요.');
    });
    $('#na_ed_big').on('click', needChat(openReader));
    $('#na_ed_ask').on('click', needChat(openAsk));
    $('#na_ai_profile').on('change', function () {
        const a = connSettings('ai');
        if (this.value === '__custom' || this.value === '__vertex') a.mode = this.value.slice(2);
        else { a.mode = 'st'; globalSettings().aiProfile = this.value; }
        saveGlobal(); renderAiSettings();
    });
    $('#na_ai_max').on('change', function () {
        const v = Math.max(256, parseInt(this.value, 10) || 4096);
        globalSettings().aiMaxTokens = v; globalSettings().aiMaxSet = true; this.value = v; saveGlobal();
    });
    $('#na_drift_recheck').on('change', function () { globalSettings().driftRecheck = this.checked; saveGlobal(); });
    $('#na_drift_auto').on('change', function () { globalSettings().driftAuto = Number(this.value) || 0; saveGlobal(); });
    $('#na_gloss_edit').on('click', needChat(async () => { await openGlossary(); renderAiSettings(); }));
    $('#na_tool_gloss').on('click', needChat(async () => { await openGlossary(); renderAiSettings(); }));
    $('#na_tr_mode').on('change', function () { trSettings().mode = this.value; saveGlobal(); renderAiSettings(); });
    // off = translate with the AI model; on = its own connection, back to whatever was set there before
    $('#na_tr_own').on('change', function () {
        const t = trSettings();
        if (this.checked) t.mode = ['custom', 'vertex'].includes(t.lastMode) ? t.lastMode : 'custom';
        else { if (t.mode !== 'same') t.lastMode = t.mode; t.mode = 'same'; }
        saveGlobal(); renderAiSettings();
    });
    $('#na_dr_mode').on('change', function () { draftSettings().mode = this.value; saveGlobal(); renderAiSettings(); });
    $('#na_dr_ceffort').on('change', function () { draftSettings().cEffort = this.value; saveGlobal(); });
    $('#na_dr_max').on('change', function () { const v = Math.max(1024, parseInt(this.value, 10) || 16000); draftSettings().max = v; this.value = v; saveGlobal(); });
    for (const p of ['ai', 'tr', 'dr']) {
        const field = (sel, key) => $(`#na_${p}_${sel}`).on('change', function () { connSettings(p)[key] = this.value.trim(); saveGlobal(); renderAiSettings(); });
        field('key', 'key'); field('model', 'model'); field('vxloc', 'vxLocation'); field('vxmodel', 'vxModel'); field('effort', 'effort');
        $(`#na_${p}_fmt`).on('change', function () { const t = connSettings(p); t.fmt = this.value; delete t.models; delete t.noEffort; delete t.leanHeaders; saveGlobal(); renderAiSettings(); });
        // another address has other models: the loaded list goes with the old one
        $(`#na_${p}_url`).on('change', function () { const t = connSettings(p), v = this.value.trim(); if (v !== t.url) { delete t.models; delete t.noEffort; delete t.leanHeaders; } t.url = v; saveGlobal(); renderAiSettings(); });
        $(`#na_${p}_custom .na_cc_eye`).on('click', function () {
            const $k = $(`#na_${p}_key`), show = $k.attr('type') === 'password';
            $k.attr('type', show ? 'text' : 'password');
            $(this).html(svgA(show ? ICO_A.eyeoff : ICO_A.eye, 17)).attr({ 'aria-label': show ? '키 가리기' : '키 보기', title: show ? '키 가리기' : '키 보기' });
        });
        $(`#na_${p}_load`).on('click', async function () {
            const t = connSettings(p);
            t.url = String($(`#na_${p}_url`).val() || '').trim();
            t.key = String($(`#na_${p}_key`).val() || '').trim();
            saveGlobal();
            const ids = await withSpinner($(this), '불러오는 중', () => listModels(t));
            if (!ids) return;
            t.models = ids;
            if (!t.model && ids.length === 1) t.model = ids[0];
            saveGlobal(); renderAiSettings();
            toastr.success(`모델 ${ids.length}개를 불러왔어요`);
            drawModels(p, true);
        });
        $(`#na_${p}_model`).on('focus click', () => drawModels(p, true))
            .on('input', () => drawModels(p, true))
            .on('blur', () => setTimeout(() => { if (!$(`#na_${p}_models`).is(':hover')) drawModels(p, false); }, 150))
            .on('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); drawModels(p, false); } });
        $(`#na_${p}_models`).on('mousedown', e => e.preventDefault()).on('click', '.na_cc_opt', function () {
            connSettings(p).model = this.dataset.id; saveGlobal();
            drawModels(p, false); renderAiSettings();
        });
        $(`#na_${p}_vxmodel`).on('focus click', () => drawModels(p, true, true))
            .on('input', () => drawModels(p, true, true))
            .on('blur', () => setTimeout(() => { if (!$(`#na_${p}_vxmodels`).is(':hover')) drawModels(p, false, true); }, 150))
            .on('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); drawModels(p, false, true); } });
        $(`#na_${p}_vxmodels`).on('mousedown', e => e.preventDefault()).on('click', '.na_cc_opt', function () {
            connSettings(p).vxModel = this.dataset.id; saveGlobal();
            drawModels(p, false, true); renderAiSettings();
        });
        $(`#na_${p}_vxload`).on('click', () => {
            const n = vxModelList().length;
            if (!n) return toastr.warning('실리태번의 Vertex 모델 목록을 못 찾았어요. 모델 이름을 직접 넣어 주세요.');
            toastr.success(`실리태번의 Vertex 모델 ${n}개`);
            $(`#na_${p}_vxmodel`).val('');
            drawModels(p, true, true);
            $(`#na_${p}_vxmodel`).val(connSettings(p).vxModel).trigger('focus');
        });
    }
    $('#na_ai_test').on('click', async function () {
        const out = await withSpinner($(this), '확인하는 중…', () => askAI('Reply with one short sentence: which model are you?', { maxTokens: 300 }));
        if (out) toastr.success(out.slice(0, 160), `${aiLabel()} 연결됨`);
    });
    $('#na_dr_test').on('click', async function () {
        const out = await withSpinner($(this), '확인하는 중…', () => askDraft('Reply with one short sentence: which model are you?', { maxTokens: 300 }));
        if (out) toastr.success(out.slice(0, 160), `${drLabel()} 연결됨`);
    });
    $('#na_tr_test').on('click', async function () {
        const out = await withSpinner($(this), '확인하는 중…', () => askTranslator('1: The three of them fell asleep together.', { system: AI_SYS_TRANSLATE, maxTokens: 200 }));
        if (out) toastr.success(out.replace(/^\s*1\s*[:.)]\s*/, '').slice(0, 120), `${trLabel()} 연결됨`);
    });
    renderAiSettings();
    $('#na_ed_preview').on('click', needChat(openPreview));
    $('#na_cfg_preview').on('click', needChat(openPreview));

    // --- editor tools: table of contents, find & replace
    const togglePanel = (id, focus) => {
        const $el = $(id);
        const show = $el.prop('hidden');
        $('#na_findbar, #na_toc').prop('hidden', true);
        $('#na_ed_find, #na_ed_toc').removeClass('active');
        $el.prop('hidden', !show);
        if (show) {
            $(id === '#na_toc' ? '#na_ed_toc' : '#na_ed_find').addClass('active');
            focus?.();
        }
    };
    $('#na_ed_find').on('click', () => { togglePanel('#na_findbar', () => $('#na_find_q').trigger('focus').trigger('input')); paintMarks(); });
    $('#na_ed_toc').on('click', () => { togglePanel('#na_toc', renderToc); paintMarks(); });

    function renderToc() {
        const text = $ed.val();
        const $toc = $('#na_toc').empty();
        const secs = parseSections(text).filter(s => s.title !== '(머리말)' && s.title !== '(제목 없음)');
        if (!secs.length) { $toc.html('<div class="na_empty">제목(#, ##)이 없어요.</div>'); return; }
        const listOf = t => parseSections(t).filter(s => s.title !== '(머리말)' && s.title !== '(제목 없음)');
        secs.forEach((s0, i) => {
            const $it = $(`<button type="button" class="na_toc_item na_toc_lv${s0.level} ${s0.group ? 'na_toc_group' : ''}">${esc(s0.group ? groupLabel(s0.title) : s0.title)}</button>`);
            $it.on('click', () => {
                const now = $ed.val(), list = listOf(now);
                const s = list[i]?.title === s0.title ? list[i] : list.find(x => sectionKey(x) === sectionKey(s0)) || list[i];
                if (!s) return;
                revealInEditor(s.start, s.start + (now.slice(s.start).indexOf('\n') + 1 || now.length - s.start) - 1);
            });
            $toc.append($it);
        });
    }

    // find only: highlight every match in a layer behind the (transparent) textarea
    const $marks = $('.na_editor_marks');
    let hits = [], cur = -1;
    const syncMarkBox = () => {
        const el = $ed[0], cs = getComputedStyle(el), mk = $marks[0];
        for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'fontVariant', 'fontKerning', 'fontFeatureSettings', 'fontVariationSettings',
            'lineHeight', 'letterSpacing', 'wordSpacing', 'textIndent', 'textTransform', 'textRendering', 'wordBreak', 'overflowWrap', 'lineBreak', 'hyphens',
            'paddingTop', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'tabSize']) mk.style[k] = cs[k];
        // the textarea's scrollbar takes width from the text; give the layer the same room so lines wrap at the same place
        const bar = el.offsetWidth - el.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
        mk.style.paddingRight = `${parseFloat(cs.paddingRight) + Math.max(0, bar)}px`;
        mk.style.boxSizing = 'border-box';
        // sit exactly on the textarea (it can have margins)
        mk.style.top = `${el.offsetTop}px`;
        mk.style.left = `${el.offsetLeft}px`;
        mk.style.width = `${el.offsetWidth}px`;
        mk.style.height = `${el.offsetHeight}px`;
        mk.scrollTop = el.scrollTop;
    };
    const paintMarks = () => {
        const q = $('#na_find_q').val();
        const on = !$('#na_findbar').prop('hidden') && !!q && hits.length;
        $('.na_editor_wrap').toggleClass('na_marking', !!on);
        if (!on) { $marks.empty(); return; }
        const text = $ed.val();
        let html = '', last = 0;
        hits.forEach((at, i) => {
            html += esc(text.slice(last, at)) + `<mark class="${i === cur ? 'na_cur' : ''}">${esc(text.slice(at, at + q.length))}</mark>`;
            last = at + q.length;
        });
        html += esc(text.slice(last)) + '\n';
        $marks.html(html);
        syncMarkBox();
    };
    const findAll = () => {
        const q = $('#na_find_q').val();
        hits = [];
        if (q) {
            const hay = $ed.val().toLowerCase(), needle = q.toLowerCase();
            for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + needle.length)) hits.push(at);
        }
        if (cur >= hits.length) cur = hits.length - 1;
    };
    const showInfo = () => {
        const q = $('#na_find_q').val();
        $('#na_find_info').text(!q ? '' : hits.length ? `${cur + 1}/${hits.length}` : '0/0').toggleClass('na_find_none', !!q && !hits.length);
        $('#na_find_prev, #na_find_next').prop('disabled', hits.length < 2 && !(hits.length === 1 && cur < 0));
    };
    const go = step => {
        if (!hits.length) { showInfo(); paintMarks(); return; }
        cur = cur < 0 ? (step < 0 ? hits.length - 1 : 0) : (cur + step + hits.length) % hits.length;
        const q = $('#na_find_q').val();
        revealInEditor(hits[cur], hits[cur] + q.length, { keepFocus: true });
        showInfo(); paintMarks();
    };
    $('#na_find_q').on('input', () => { cur = -1; findAll(); go(1); });
    $('#na_find_q').on('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); go(e.shiftKey ? -1 : 1); }
        if (e.key === 'Escape') { e.preventDefault(); $('#na_find_close').trigger('click'); }
    });
    $('#na_find_next').on('click', () => go(1));
    $('#na_find_prev').on('click', () => go(-1));
    $('#na_find_close').on('click', () => { $('#na_findbar').prop('hidden', true); $('#na_ed_find').removeClass('active'); paintMarks(); });
    $ed.on('scroll', () => { $marks[0].scrollTop = $ed[0].scrollTop; });
    $ed.on('input', () => { if (!$('#na_findbar').prop('hidden') && $('#na_find_q').val()) { findAll(); showInfo(); paintMarks(); } });
    if (window.ResizeObserver) new ResizeObserver(() => { if ($('.na_editor_wrap').hasClass('na_marking')) syncMarkBox(); }).observe($ed[0]);

    // --- sections

    // --- compress
    $('#na_boundary').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        const v = this.value === '' ? -1 : parseInt(this.value, 10);
        m.boundary = Number.isFinite(v) ? Math.max(-1, v) : -1;
        await saveMeta(); refreshStatus();
    });
    $('#na_keep').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.keep = Math.min(50, Math.max(0, parseInt(this.value, 10) || 0)); this.value = m.keep;
        await saveMeta(); refreshStatus();
    });
    $('.na_keep_btn').on('click', function () {
        if (!hasChat()) return;
        const $k = $('#na_keep');
        $k.val(Math.min(50, Math.max(0, (parseInt($k.val(), 10) || 0) + Number(this.dataset.d)))).trigger('change');
    });
    $('#na_open_extract').on('click', needChat(openExtract));
    // one 압축하기 button runs whichever method is picked above it
    $('#na_settings .na_cp_mbtn').on('click', function () { globalSettings().cpMethod = this.dataset.m; saveGlobal(); layoutCp(); });
    $('#na_cp_go').on('click', needChat(() => { const md = cpMethod(); return md === 'wizard' ? openWizard() : md === 'studio' ? openStudio() : quickCompress(); }));
    $('#na_flag_auto').on('click', () => $('#na_quick_auto').prop('checked', !$('#na_quick_auto').prop('checked')).trigger('change') && layoutCp());
    $(document).on('change', '.na_qc_auto, .na_qc_grade', () => setTimeout(() => { $('#na_quick_auto').prop('checked', !!globalSettings().quickAuto); layoutCp(); }));
    $('#na_flag_grade').on('click', () => { const g = globalSettings(); g.quickGrade = !g.quickGrade; saveGlobal(); layoutCp(); });
    $('#na_health').on('click', needChat(openHealth));
    $('#na_drift').on('click', needChat(openDrift));
    $('#na_know').on('click', needChat(openKnowledge));
    $('#na_quotes').on('click', needChat(openQuotes));
    $('#na_branches, #na_branch_fix').on('click', needChat(openBranches));
    $('#na_open_append').on('click', needChat(openAppend));
    $('#na_apply_hide').on('click', needChat(() => applyHide()));
    $('#na_unhide').on('click', needChat(openUnhide));

    // --- find & replace on the saved archive (sections tab)
    const rpRegex = () => {
        const q = $('#na_rp_find').val();
        if (!q) return null;
        const body = escRe(q);
        return new RegExp($('#na_rp_word').prop('checked') ? `(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])` : body, `g${$('#na_rp_case').prop('checked') ? '' : 'i'}u`);
    };
    const renderReplace = () => {
        const $l = $('#na_rp_list').empty();
        if (!hasChat()) return;
        const re = rpRegex();
        const text = getMeta().text;
        const to = $('#na_rp_to').val();
        if (!re) { $('#na_rp_n').text(''); $('#na_rp_go').prop('disabled', true); return; }
        const found = [...text.matchAll(re)];
        $('#na_rp_n').text(`${found.length}군데`).toggleClass('na_chip_warn', !!found.length);
        $('#na_rp_go').prop('disabled', !found.length);
        if (!found.length) { $l.html('<div class="na_empty">찾는 말이 없어요.</div>'); return; }
        const secs = parseSections(text);
        found.slice(0, 40).forEach(mt => {
            const at = mt.index, len = mt[0].length;
            const sec = [...secs].reverse().find(x => x.start <= at);
            const a = Math.max(0, at - 30), b = Math.min(text.length, at + len + 30);
            const before = text.slice(a, at).replace(/\n/g, ' '), after = text.slice(at + len, b).replace(/\n/g, ' ');
            $l.append(`<div class="na_rp_hit"><span class="na_rp_sec">${esc(sec ? (sec.group ? groupLabel(sec.title) : sec.title) : '')}</span>
                <span class="na_rp_ctx">${a > 0 ? '…' : ''}${esc(before)}<del>${esc(mt[0])}</del><ins>${esc(to)}</ins>${esc(after)}${b < text.length ? '…' : ''}</span></div>`);
        });
        if (found.length > 40) $l.append(`<div class="na_dim na_rp_more">그 밖에 ${found.length - 40}군데 더</div>`);
    };
    setRefreshReplace(renderReplace);
    let rpTimer;
    $('#na_rp_find, #na_rp_to').on('input', () => { clearTimeout(rpTimer); rpTimer = setTimeout(renderReplace, 250); });
    $('#na_rp_case, #na_rp_word').on('change', renderReplace);
    $('#na_rp_go').on('click', needChat(async () => {
        const re = rpRegex();
        if (!re) return;
        if (editorDirty) return toastr.warning('원문 편집칸에 저장 안 한 내용이 있어요. 먼저 저장하거나 되돌려 주세요.');
        const m = getMeta();
        const n = [...m.text.matchAll(re)].length;
        if (!n) return;
        const to = $('#na_rp_to').val();
        if (!await confirm('모두 바꾸기', `"${esc($('#na_rp_find').val())}" ${n}군데를 ${to ? `"${esc(to)}"(으)로 바꿀까요` : '지울까요'}? 지금 상태는 복구 지점에 남아요.`)) return;
        await commitText(m.text.replace(re, () => to), `찾아 바꾸기 전: ${$('#na_rp_find').val().slice(0, 30)}`);
        renderReplace();
        toastr.success(`${n}군데 바꿨어요`);
    }));
    $('#na_rules_sys').on('change', function () { globalSettings().rulesInSystem = this.checked; saveGlobal(); });
    $('#na_scsize').on('change', function () { globalSettings().sceneSize = Number(this.value); saveGlobal(); });
    $('#na_worknote').on('click', needChat(() => openWorkNote()));
    $('#na_stylesample').on('click', needChat(() => openStyleSamples()));
    $('#na_cmode').on('change', function () { globalSettings().compressMode = this.value; saveGlobal(); layoutCp(); });
    $('#na_track').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.track = this.checked;
        const problem = syncTrackedBoundary(m);
        await saveMeta(); syncPanel();
        if (problem) toastr.warning(problem);
        else if (m.track) toastr.success(`경계선을 #${m.boundary}로 맞췄어요`);
    });

    // --- vault
    $('#na_snap_now').on('click', needChat(async () => {
        const m = getMeta();
        if (!m.text.trim()) return toastr.info('아카이브가 비어 있어요.');
        if (!pushSnapshot(m, '직접 보관')) return toastr.info('마지막 복구 지점과 같아요.');
        await saveMeta(); renderSnapshots(); toastr.success('보관됨');
    }));
    $('#na_export').on('click', needChat(() => {
        const m = getMeta();
        if (!m.text.trim()) return toastr.info('아카이브가 비어 있습니다.');
        download(`아카이브_${chatLabel()}_${nowStamp()}.txt`, m.text);
        markBackup('txt');
    }));
    $('#na_export_json').on('click', needChat(() => {
        const { lastInject, ...rest } = getMeta();
        download(`아카이브_${chatLabel()}_${nowStamp()}.json`, JSON.stringify({ format: 'narrative-archive', version: VERSION, data: rest }, null, 2), 'application/json');
        markBackup('json');
    }));
    $('#na_clear').on('click', needChat(async () => {
        const m = getMeta();
        if (!m.text.trim()) return toastr.info('이미 비어 있어요.');
        if (!await confirm('아카이브 비우기', '본문을 비울까요? 지금 내용은 복구 지점에 남아요.')) return;
        setEditorDirty(false);
        await commitText('', '비우기 전', { boundary: -1 });
        toastr.success('비웠어요');
    }));
    $('#na_import').on('click', needChat(() => $('#na_file').val('').trigger('click')));
    $('#na_from_chat').on('click', needChat(openChatPicker));
    $('#na_compare').on('click', needChat(openCompare));
    $('#na_carry_go').on('click', needChat(async () => { if (carryOffer) await importArchive(carryOffer, '방금 있던 채팅', carryOffer.chatId); }));
    $('#na_carry_x').on('click', () => { setCarryOffer(null); $('#na_carry').prop('hidden', true); });
    $('#na_cap').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.tokenCap = Math.max(0, parseInt(this.value, 10) || 0); this.value = m.tokenCap;
        await saveMeta(); applyInjection(); syncPanel();
    });
    $('#na_unpin_all').on('click', needChat(async () => {
        const m = getMeta(); m.pinned = []; await saveMeta(); applyInjection(); syncPanel();
    }));
    $('#na_unmute_all').on('click', needChat(async () => {
        const m = getMeta(); m.muted = []; await saveMeta(); applyInjection(); syncPanel();
    }));
    $('#na_file').on('change', async function () {
        const file = this.files?.[0];
        if (!file || !hasChat()) return;
        const raw = await file.text();
        const m = getMeta();
        let json = null;
        if (/\.json$/i.test(file.name)) {
            try { json = JSON.parse(raw); } catch { return toastr.error('JSON을 읽지 못했어요.'); }
            if (json?.format === 'narrative-archive-bundle') {
                const it = await pickFromBundle(json);
                if (!it) return;
                json = { format: 'narrative-archive', data: it.data };
            }
            if (json?.format !== 'narrative-archive' || typeof json.data?.text !== 'string') return toastr.error('서사 아카이브 백업 파일이 아니에요.');
        }
        if (m.text.trim() && !await confirm('아카이브 덮어쓰기', '이 채팅의 기존 아카이브를 불러온 파일로 바꿀까요? 지금 내용은 복구 지점에 남아요.')) return;
        setEditorDirty(false);
        if (json) {
            const d = json.data;
            for (const k of SETTING_KEYS) if (Object.hasOwn(d, k)) m[k] = d[k];
            if (Object.hasOwn(d, 'phones') && !d.finance) delete m.finance;
            if (Array.isArray(d.snapshots)) {
                const seen = new Set(m.snapshots.map(s => s.at));
                m.snapshots = [...m.snapshots, ...d.snapshots.filter(s => s && typeof s.text === 'string' && !seen.has(s.at))]
                    .sort((a, b) => b.at - a.at).slice(0, SNAPSHOT_MAX);
            }
            // same text as now: commitText does nothing, but the settings and restore points above still need saving
            if (!await commitText(d.text, '불러오기 전', { boundary: Number.isFinite(d.boundary) ? d.boundary : -1 })) { await saveMeta(); applyInjection(); syncPanel(); }
        } else {
            await commitText(raw, '불러오기 전');
        }
        toastr.success(`불러옴: ${file.name}`);
    });

    // --- config
    $('#na_cache_save').on('change', function () { globalSettings().cacheSave = this.checked; saveGlobal(); applyInjection(); });
    $('#na_enabled').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.enabled = this.checked; await saveMeta(); applyInjection(); refreshStatus();
    });
    $('#na_position').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.position = parseInt(this.value, 10); await saveMeta(); applyInjection(); syncPanel();
    });
    $('#na_depth').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.depth = Math.max(0, parseInt(this.value, 10) || 0); this.value = m.depth;
        await saveMeta(); applyInjection(); syncPanel();
    });
    $('#na_role').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.role = parseInt(this.value, 10) || 0; await saveMeta(); applyInjection(); syncPanel();
    });
    $('#na_kw_test').on('click', needChat(openKeywordTest));
    const setRouter = async patch => { const m = getMeta(); m.router = { ...routerCfg(m), ...patch }; routerState.delete(currentChatId()); await saveMeta(); applyInjection(); syncPanel(); };
    $('#na_router_mode').on('change', needChat(e => setRouter({ mode: e.target.value })));
    $('#na_router_max').on('change', needChat(e => setRouter({ max: Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 4)) })));
    $('#na_router_keep').on('change', needChat(e => setRouter({ keep: Math.min(20, Math.max(0, parseInt(e.target.value, 10) || 0)) })));
    $('#na_router_follow').on('change', needChat(e => setRouter({ follow: e.target.checked })));
    const setFade = async patch => { const m = getMeta(); m.fade = { ...fadeCfg(m), ...patch }; await saveMeta(); applyInjection().then(() => { sectionPanel?.render(); syncPanel(); }); syncPanel(); };
    $('#na_fade').on('change', needChat(e => setFade({ on: e.target.checked })));
    // the fade details stay folded under the row until asked for
    $('#na_fade_more').on('click', e => { e.preventDefault(); e.stopPropagation(); setCfgFadeOpen(!cfgFadeOpen); syncPanel(); });
    $('#na_fade_full').on('change', needChat(e => setFade({ full: Math.max(0, parseInt(e.target.value, 10) || 0) })));
    $('#na_fade_short').on('change', needChat(e => setFade({ short: Math.max(0, parseInt(e.target.value, 10) || 0) })));
    $('#na_fade_opts').on('click', '.na_fd_btn', needChat(e => { const f = e.currentTarget.dataset.f; const cur = fadeCfg(getMeta())[f]; setFade({ [f]: Math.max(0, cur + Number(e.currentTarget.dataset.d)) }); }));
    $('#na_fade_pick').on('click', needChat(async () => { await openFadePicker(); syncPanel(); }));
    $('#na_fade_fill').on('click', needChat(e => { if (!draftReady() && !fadeFilling) return toastr.info('⚙ 설정 → AI 모델 → 초안 모델을 먼저 정해 주세요. 섹션 카드의 버전 버튼에서 직접 붙여넣을 수도 있어요.'); fillFade($(e.currentTarget)); }));
    // 원문으로 불러옴 on the home tab: each section called in, why, and for how many more replies it stays
    const liftList = st => [...st.picks].map((k, i) => {
        const t = st.titles[i] || k, why = st.whyBy?.[k], left = st.hold?.get?.(k);
        return `• ${esc(t.slice(0, 60))}${why ? `<br><small>${esc(why)}</small>` : ''}${!st.fresh?.has(k) && left ? `<small> · 이어서 ${left}답 더</small>` : ''}`;
    }).join('<br>');
    $('#na_meter_legend').on('click', '.na_router_more', () => {
        const st = routerState.get(currentChatId());
        if (st?.titles.length) toastr.info(liftList(st), `불러온 섹션 ${st.titles.length}개${st.via === 'ai' ? ' · AI가 고름' : st.via === 'index' ? ` · AI 대신 빠르게 (${esc(st.why || '')})` : ' · AI 없이'}`, { escapeHtml: false, timeOut: 10000 });
    });
    $('#na_router_test').on('click', needChat(async e => {
        const m = getMeta();
        const st = await withSpinner($(e.currentTarget), '고르는 중…', () => runRouter(m, { force: true }));
        if (!st) return;
        await applyInjection(); syncPanel();
        toastr.info(st.titles.length ? liftList(st) : '고른 섹션이 없어요', `라우터 · ${st.titles.length}개 · ${(st.ms / 1000).toFixed(1)}초${st.short && st.short < st.cands ? ` · 후보 ${st.cands}개 중 ${st.short}개 자세히` : ''}`, { escapeHtml: false, timeOut: 10000 });
    }));
    // OOC 빼기 (압축 → 설정)
    // 상태창: what the extension reads from the status windows, the last few as found
    $('#na_trk_row').on('click', async () => {
        if (!hasChat()) return toastr.info('채팅을 먼저 여세요.');
        const ts = recentTrackers(5);
        const body = ts.length
            ? `<div class="na_v2_title"><b>상태창</b><small>압축할 때 날짜 · 장소는 섹션 제목에, 장면 나누기는 이게 바뀌는 곳에서</small></div><div class="na_trk_list">${ts.map(t => `<div class="na_trk_item"><b>#${t.i}</b><span>${esc([t.date, t.time, t.place].filter(Boolean).join(' · '))}</span></div>`).join('')}</div>`
            : '<div class="na_v2_title"><b>상태창</b><small>이 채팅에서는 못 찾았어요</small></div><div class="na_dim">시간이나 날짜가 든 짧은 칸들로 된 줄(<code>[ 오후 8:15 · 12월 9일 · 성 → 병동 ]</code>), <code>날짜: … / 장소: …</code> 줄, <code>&lt;tracker&gt;</code>를 찾아요. 못 찾으면 장면은 메시지 수로 나누고, 날짜 · 장소는 AI가 원문에서 읽어요.</div>';
        await ctx().callGenericPopup($(`<div class="na_popup na_v2">${body}</div>`), ctx().POPUP_TYPE.TEXT, '', { okButton: '닫기' });
    });
    $('#na_off_fold').on('click', '.na_off_chip', function () { setOffKind(this.dataset.k, !offKinds()[this.dataset.k]); syncPanel(); refreshStatus(); });
    $('#na_fallback').on('change', function () { globalSettings().fallback = this.value; saveGlobal(); });
    $('#na_emb_src').on('change', function () { setEmbTyping(false); setEmbed({ source: this.value, model: '' }); syncEmbedRows(); if (this.value) $('#na_emb_build').trigger('click'); });
    $('#na_emb_model').on('change', function () { setEmbed({ model: this.value.trim() }); syncEmbedRows(); });
    $('#na_emb_pick').on('change', function () {
        setEmbTyping(!this.value);
        if (this.value) setEmbed({ model: this.value });
        syncEmbedRows();
        if (embTyping) $('#na_emb_model').val('').trigger('focus');
    });
    $('#na_emb_url').on('change', function () { setEmbed({ url: this.value.trim() }); syncEmbedRows(); });
    $('#na_emb_region').on('change', function () { setEmbed({ region: this.value.trim() }); syncEmbedRows(); });
    $('#na_emb_build').on('click', needChat(async e => {
        const $b = $(e.currentTarget);
        if ($b.hasClass('na_busy')) return;
        $b.addClass('na_busy');
        $('#na_emb_sub').text('목록 보는 중…');
        try {
            const st = await syncEmbed({ force: true, onProgress: (n, all, note) => $('#na_emb_sub').text(`만드는 중… ${n} / ${all}${note ? ` · ${note}` : ''}`) });
            if (st) toastr.success(`섹션 조각 ${st.secs}개${st.skipped ? ` · 못 넣은 ${st.skipped}개는 다음에 다시 해요` : ''}${st.regionMoved ? ' · 원래 지역에서 안 돼서 임베딩 지역을 us-central1로 정했어요' : ''}`, '임베딩 색인', { timeOut: st.regionMoved ? 12000 : 5000 });
        } catch (err) {
            // a 5xx that survived the retries is the service's quota or an outage; what went in so far is kept
            const e = embedCfg(), m = e.model || EMBED_DEFAULT_MODEL[e.source] || '';
            const hint = err.status >= 500 ? ` · 만든 데까지는 남아 있어서 다시 누르면 이어서 해요${e.source === 'vertexai' ? `. 계속 안 되면 ① 실리태번 API 연결 → Vertex AI에서 인증(Express 키 또는 서비스 계정)과 프로젝트가 맞는지 ② 임베딩 지역을 us-central1로${/^gemini-embedding/.test(m) ? ' ③ 모델을 text-multilingual-embedding-002로(한 번에 10개씩)' : ''} 확인해 보세요. 자세한 이유는 실리태번 서버 콘솔 창에 찍혀요` : ''}` : '';
            toastr.error(`${String(err.message || err)}${hint}`, '임베딩 색인을 못 만들었어요', { timeOut: 15000 });
        }
        finally { $b.removeClass('na_busy'); syncEmbedRows(); }
    }));
    $('#na_guess').on('change', function () { globalSettings().guess = this.value; saveGlobal(); syncPanel(); });
    $('#na_lore').on('change', function () { setLore({ on: this.checked }); syncPanel(); });
    $('#na_lore_budget').on('change', function () { setLore({ budget: Number(this.value) }); syncPanel(); });
    // settings search: rows whose words match stay, the rest of each group folds away
    $('#na_cfg_q').on('input', function () {
        const q = this.value.trim().toLowerCase();
        const $pane = $('#na_settings .na_tab_pane[data-pane="config"]');
        let any = false;
        $pane.find('.na_cfg_grp').each(function () {
            const $g = $(this);
            const label = $g.find('.na_cfg_label').text().toLowerCase();
            let hit = false;
            $g.find('.na_set_row').each(function () {
                const show = !q || label.includes(q) || `${this.textContent} ${this.title || ''}`.toLowerCase().includes(q);
                $(this).toggleClass('na_cfg_hide', !show);
                if (show) hit = true;
            });
            if (q && label.includes(q)) hit = true;
            $g.toggleClass('na_cfg_hide', !!q && !hit);
            // connection boxes and notes stay only next to a row that matched, or when the group's own name did
            $g.find('.na_cfg_box').children().each(function () {
                const rows = $(this).find('.na_set_row').addBack('.na_set_row');
                const keep = !q || label.includes(q) || (rows.length ? rows.filter(':not(.na_cfg_hide)').length > 0 : false);
                $(this).toggleClass('na_cfg_hide', !keep);
            });
            if (hit) any = true;
        });
        $('#na_cfg_none').prop('hidden', !q || any);
        layoutCfg();
    });
    $('#na_link_depth').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.linkDepth = Math.min(50, Math.max(1, parseInt(this.value, 10) || 4)); this.value = m.linkDepth;
        await saveMeta(); applyInjection(); syncPanel();
    });
    $('#na_backup_every').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.backupEvery = Math.max(0, parseInt(this.value, 10) || 0); this.value = m.backupEvery;
        await saveMeta(); syncPanel();
    });
}
