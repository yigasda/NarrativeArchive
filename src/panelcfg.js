// The ⚙ settings page: AI model connections, the group cards and tiles, embedding rows, and the 압축 tab's method rows.

import { aiLabel, aiProfiles, apiFormat, compressEffort, connSettings, draftReady, draftSettings, drLabel, trLabel, trSettings, vxModelList } from './ai.js';
import { ctx, getMeta, globalSettings, hasChat } from './core.js';
import { EMBED_DEFAULT_MODEL, EMBED_MODELS, embedCfg, embedError, embedLabel, embedState, routerUsesEmbed } from './embed.js';
import { guessMode } from './guess.js';
import { ICO_A, svgA } from './theme.js';
import { glossaryEntries } from './translate.js';
import { esc, timeLabel } from './util.js';
import { compressMode } from './wizard.js';

// custom-API / Vertex fields for one connection ('ai' = the AI 기능 model, 'tr' = the translation model)
export function connCfgHtml(p) {
    return `
                <div class="na_tr_cfg na_cc" id="na_${p}_custom" data-p="${p}" hidden>
                  <div class="na_cc_box">
                    <label class="na_cc_row"><span class="na_cc_lbl">주소</span><input type="text" class="text_pole" id="na_${p}_url" placeholder="https://api.example.com/v1" autocomplete="off" spellcheck="false" inputmode="url"></label>
                    <label class="na_cc_row"><span class="na_cc_lbl">API 키</span><input type="password" class="text_pole" id="na_${p}_key" placeholder="sk-…" autocomplete="off" spellcheck="false"><button type="button" class="na_cc_eye" aria-label="키 보기" title="키 보기">${svgA(ICO_A.eye, 17)}</button></label>
                    <label class="na_cc_row"><span class="na_cc_lbl">형식</span><select class="text_pole na_cc_sel" id="na_${p}_fmt"><option value="">주소 보고 자동</option><option value="openai">OpenAI 호환 (chat/completions)</option><option value="anthropic">Anthropic (Claude Messages API)</option></select></label>
                    <label class="na_cc_row"><span class="na_cc_lbl">생각</span><select class="text_pole na_cc_sel" id="na_${p}_effort"><option value="">작업마다 알아서</option><option value="low">낮게 (low) · 가장 싸요</option><option value="medium">보통 (medium)</option><option value="high">높게 (high)</option></select></label>
                    <div class="na_cc_row"><span class="na_cc_lbl">모델</span><input type="text" class="text_pole na_cc_model" id="na_${p}_model" placeholder="불러와서 고르거나 직접 입력" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="na_${p}_models"><button type="button" class="na_cc_load" id="na_${p}_load" title="주소와 키로 모델 목록 불러오기">${svgA(ICO_A.redo, 15)}<span>불러오기</span></button></div>
                  </div>
                  <div class="na_cc_models" id="na_${p}_models" role="listbox" hidden></div>
                  <small class="na_cc_hint" id="na_${p}_cchint" hidden></small>
                </div>
                <div class="na_tr_cfg na_cc" id="na_${p}_vertex" hidden>
                  <div class="na_cc_box">
                    <div class="na_cc_row"><span class="na_cc_lbl">키</span><span class="na_cc_note" id="na_${p}_vxinfo">실리태번에 저장한 서비스 계정 JSON</span></div>
                    <label class="na_cc_row"><span class="na_cc_lbl">지역</span><input type="text" class="text_pole" id="na_${p}_vxloc" placeholder="비우면 실리태번 설정 따라" autocomplete="off" spellcheck="false"></label>
                    <div class="na_cc_row"><span class="na_cc_lbl">모델</span><input type="text" class="text_pole na_cc_model" id="na_${p}_vxmodel" placeholder="불러와서 고르거나 직접 입력" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="na_${p}_vxmodels"><button type="button" class="na_cc_load" id="na_${p}_vxload" title="실리태번의 Vertex 모델 목록 불러오기">${svgA(ICO_A.redo, 15)}<span>불러오기</span></button></div>
                  </div>
                  <div class="na_cc_models" id="na_${p}_vxmodels" role="listbox" hidden></div>
                </div>
                <div class="na_tr_test_row" id="na_${p}_test_row" hidden>
                  <button type="button" class="na_btn na_small" id="na_${p}_test"><i class="fa-solid fa-plug"></i> 연결 테스트</button>
                </div>`;
}

export function renderConn(p) {
    const t = connSettings(p);
    const own = t.mode === 'custom' || t.mode === 'vertex';
    $(`#na_${p}_custom`).prop('hidden', t.mode !== 'custom');
    $(`#na_${p}_vertex`).prop('hidden', t.mode !== 'vertex');
    $(`#na_${p}_test_row`).prop('hidden', !own);
    $(`#na_${p}_url`).val(t.url); $(`#na_${p}_key`).val(t.key); $(`#na_${p}_model`).val(t.model);
    $(`#na_${p}_fmt`).val(t.fmt || ''); $(`#na_${p}_effort`).val(t.effort || '');
    $(`#na_${p}_url`).attr('placeholder', apiFormat(t) === 'anthropic' ? '비우면 api.anthropic.com · 중계 주소도 돼요' : 'https://api.example.com/v1');
    // Claude thinks on every request (Opus 5.5 can't turn it off); effort only sticks through its own API format
    const claude = /claude|opus|sonnet|haiku/i.test(t.model || '');
    const hint = claude && apiFormat(t) !== 'anthropic' ? 'Claude 모델이에요. OpenAI 호환 주소는 생각 강도를 무시할 수 있어요 — 형식을 Anthropic으로 두면 생각 강도가 확실히 적용돼요.'
        : claude && !t.effort ? 'Claude는 생각을 끌 수 없어요(Opus 5.5). 생각 토큰도 출력 요금이라, 비용을 줄이려면 생각을 "낮게"로 두세요.'
        : t.noEffort && t.effort ? '이 주소는 생각 강도를 받지 않아서 빼고 보내고 있어요.' : '';
    $(`#na_${p}_cchint`).text(hint).prop('hidden', !hint);
    $(`#na_${p}_vxloc`).val(t.vxLocation).attr('placeholder', `비우면 실리태번 설정 따라 (${ctx().chatCompletionSettings?.vertexai_region || 'global'})`);
    $(`#na_${p}_vxmodel`).val(t.vxModel);
    return own;
}

// the model list under a custom API's model box: everything, or what matches the typed text
// vx: the Vertex model box, listing the models SillyTavern offers for Vertex
export function drawModels(p, open, vx = false) {
    const t = connSettings(p), $l = $(`#na_${p}_${vx ? 'vxmodels' : 'models'}`), $in = $(`#na_${p}_${vx ? 'vxmodel' : 'model'}`);
    const ids = vx ? vxModelList() : Array.isArray(t.models) ? t.models : [];
    if (!open || !ids.length) { $l.prop('hidden', true); $in.attr('aria-expanded', 'false'); return; }
    const q = String($in.val() || '').trim().toLowerCase(), cur = vx ? t.vxModel : t.model;
    const list = q && q !== cur.toLowerCase() ? ids.filter(x => x.toLowerCase().includes(q)) : ids;
    $l.html(list.length
        ? list.slice(0, 400).map(x => `<button type="button" role="option" class="na_cc_opt ${x === cur ? 'on' : ''}" data-id="${esc(x)}" aria-selected="${x === cur}"><span>${esc(x)}</span>${x === cur ? svgA(ICO_A.check, 15, 2.4) : ''}</button>`).join('')
        : '<div class="na_cc_none">맞는 모델이 없어요 · 그대로 두면 입력한 이름으로 써요</div>').prop('hidden', false);
    $in.attr('aria-expanded', 'true');
    const on = $l.find('.na_cc_opt.on')[0];
    if (on) $l.scrollTop(on.offsetTop - $l.height() / 2 + on.offsetHeight / 2);
}

export function renderAiSettings() {
    syncEmbedRows();
    const g = globalSettings();
    $('#na_gloss_n').text(hasChat() ? glossaryEntries(getMeta()).length : 0);
    $('#na_drift_auto').val(String(g.driftAuto || 0));
    $('#na_drift_recheck').prop('checked', g.driftRecheck !== false);
    const a = connSettings('ai');
    const profiles = aiProfiles();
    const opts = [`<option value="">지금 연결된 모델</option>`, ...profiles.map(p => `<option value="${esc(p.id)}">프로필: ${esc(p.name)}</option>`)];
    if (g.aiProfile && !profiles.some(p => p.id === g.aiProfile)) opts.push(`<option value="${esc(g.aiProfile)}">(없어진 프로필)</option>`);
    opts.push('<option value="__custom">커스텀 API (OpenAI 호환)</option>', '<option value="__vertex">Gemini · Vertex AI</option>');
    $('#na_ai_profile').html(opts.join('')).val(a.mode === 'st' ? (g.aiProfile || '') : `__${a.mode}`);
    $('#na_ai_max').val(g.aiMaxTokens || 8192);
    const trm = trSettings().mode;
    $('#na_tr_own').prop('checked', trm !== 'same');
    $('#na_tr_mode_row').prop('hidden', trm === 'same');
    if (trm !== 'same') $('#na_tr_mode').val(trm);
    $('#na_dr_mode').val(draftSettings().mode);
    $('#na_dr_max_row').prop('hidden', !draftReady());
    $('#na_dr_ceffort').val(compressEffort());
    $('#na_dr_max').val(draftSettings().max || 16000);
    const own = [renderConn('ai'), renderConn('tr'), renderConn('dr')].some(Boolean);
    $('#na_conn_note').prop('hidden', !own);
}

// ⚙ 설정: a card per group up top; tapping one shows that group alone
export const CFG_GROUPS = [
    ['inject', '주입', 'M12 3v12M7 10l5 5 5-5M5 21h14'],
    ['call', '호출', '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'],
    ['aimodel', 'AI 모델', '<rect x="4" y="6" width="16" height="12" rx="3"/><path d="M9 11h.01M15 11h.01M9 15h6"/>'],
    ['aitask', 'AI가 하는 일', 'M12 3l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z'],
    ['theme', '테마', '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/>'],
    ['alert', '알림', 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0'],
];
export let cfgView = '';
export function setCfgView(v) { cfgView = v; }
export const cfgTab = {}; // group → open tab

// inside a group: tiles show where things stand, tabs split the rows. Each marker starts a tab; the rows after it
// (in page order) belong to that tab until the next marker
const CFG_TABS = {
    inject: { tabs: [['place', '넣는 자리'], ['size', '분량']], marks: [['#na_enabled', 'place'], ['#na_cap', 'size']] },
    call: { tabs: [['router', 'AI 라우터'], ['emb', '임베딩'], ['kw', '키워드 · 고정']], marks: [['#na_router_mode', 'router'], ['#na_emb_src', 'emb'], ['#na_link_depth', 'kw']] },
    aimodel: { tabs: [['ai', 'AI 기능'], ['dr', '초안']], marks: [['#na_ai_profile', 'ai'], ['#na_dr_mode', 'dr'], ['#na_ai_max', 'ai'], ['#na_conn_note', 'all']] },
    aitask: { tabs: [['lore', '로어북'], ['check', '점검'], ['etc', '기타']], marks: [['#na_fallback', 'etc'], ['#na_lore', 'lore'], ['#na_drift_auto', 'check'], ['#na_gloss_edit', 'etc']] },
};
const onOff = v => (v ? '켬' : '끔');
const split2 = t => { const [a, ...b] = String(t || '').split(' · '); return [a, b.join(' · ')]; };
// [label, value, note, on, tab]
function cfgTiles(g) {
    const on = id => $(`#${id}`).prop('checked');
    const val = id => $(`#${id}`).val();
    if (g === 'inject') {
        const inChat = !$('#na_depth_field').prop('hidden');
        const follows = val('na_position') === '3';
        return [
            ['넣는 곳', on('na_enabled') ? `${optText('na_position').replace(/\s*\(.*$/, '')}${inChat ? ` · ${val('na_depth')}` : ''}` : '주입 끔', follows ? '숨긴 메시지 바로 뒤' : '', on('na_enabled'), 'place'],
            ['말하는 역할', optText('na_role'), '', true, 'place'],
            ['망각 곡선', onOff(on('na_fade')), on('na_fade') ? `원문 ${val('na_fade_full')} · 짧게 ${val('na_fade_short')}` : '원문 그대로', on('na_fade'), 'size'],
            ['토큰 상한', Number(val('na_cap')) > 0 ? `${Number(val('na_cap')).toLocaleString()}` : '없음', Number(val('na_cap')) > 0 ? '넘으면 알려 줘요' : '', Number(val('na_cap')) > 0, 'size'],
        ];
    }
    if (g === 'call') {
        const rm = val('na_router_mode');
        const e = embedCfg(), st = embedState();
        return [
            ['AI 라우터', rm === 'off' ? '끔' : rm === 'lift' ? '빠르게' : rm === 'old' ? 'AI가 전부' : '키워드 + AI', rm === 'off' ? '키워드만' : `한 번에 ${val('na_router_max')}개`, rm !== 'off', 'router'],
            ['장면 짐작', guessMode() === 'off' ? '끔' : '켬', '돌려 말한 지난 일', guessMode() !== 'off', 'router'],
            ['임베딩', e.source ? ({ st: '실리태번', vertexai: 'Vertex', palm: 'AI Studio', transformers: '로컬' }[e.source] || split2(embedLabel())[0]) : '끔', e.source ? (st?.synced ? `섹션 ${st.secs}` : '색인 아직') : '단어로만 찾아요', !!e.source, 'emb'],
            ['키워드 연동', `${$('#na_linked_n').text() || 0}개`, `고정 ${$('#na_pinned_n').text() || 0} · 꺼짐 ${$('#na_muted_n').text() || 0}`, Number($('#na_linked_n').text()) > 0, 'kw'],
        ];
    }
    if (g === 'aimodel') {
        const [a1, a2] = split2(aiLabel());
        const tr = trSettings().mode;
        return [
            ['AI 기능 모델', a1, a2 || '질문 · 점검 · 라우터', true, 'ai'],
            ['초안 모델', draftReady() ? (draftSettings().mode === 'vertex' ? 'Vertex' : '커스텀') : '없음', draftReady() ? drLabel() : '압축 초안 · 짧은 버전', draftReady(), 'dr'],
            ['번역 모델', tr === 'same' ? '같이' : split2(trLabel())[0], tr === 'same' ? 'AI 기능 모델' : split2(trLabel())[1], tr !== 'same', 'ai'],
            ['답 최대 길이', `${Number(val('na_ai_max') || 0).toLocaleString()}`, '토큰 · 잘리면 늘려요', true, 'ai'],
        ];
    }
    if (g === 'aitask') {
        return [
            ['막혔을 때', val('na_fallback') ? optText('na_fallback') : '안 함', '거절 · 차단이면 다른 모델로', !!val('na_fallback'), 'etc'],
            ['로어북', onOff(on('na_lore')), on('na_lore') ? `${val('na_lore_budget')} 토큰까지` : '같이 안 보내요', on('na_lore'), 'lore'],
            ['이탈 감지', val('na_drift_auto') === '0' ? '끔' : optText('na_drift_auto'), on('na_drift_recheck') ? '못 찾은 근거 다시 묻기' : '근거 확인만', val('na_drift_auto') !== '0', 'check'],
            ['번역 용어집', `${$('#na_gloss_n').text() || 0}개`, '이름 · 장소 한국어 표기', Number($('#na_gloss_n').text()) > 0, 'etc'],
        ];
    }
    return [];
}
// rows of a group, in page order: the children of each box, a settings list counting as its own rows
function cfgUnits(g) {
    const out = [];
    $(`#na_settings .na_cfg_grp[data-g="${g}"] .na_cfg_box`).each(function () {
        $(this).children().each(function () { if ($(this).is('.na_set_list')) out.push(...$(this).children().get()); else out.push(this); });
    });
    return out;
}
export function tagCfgTabs() {
    for (const [g, def] of Object.entries(CFG_TABS)) {
        let cur = def.tabs[0][0];
        for (const el of cfgUnits(g)) {
            const mark = def.marks.find(([sel]) => $(el).is(sel) || $(el).find(sel).length);
            if (mark) cur = mark[1];
            el.dataset.t = cur;
        }
    }
}
export function renderCfgTiles() {
    const def = CFG_TABS[cfgView];
    const q = String($('#na_cfg_q').val() || '').trim();
    $('#na_cfg_tiles, #na_cfg_tabs').prop('hidden', !def || !!q);
    if (!def || q) return;
    const tab = cfgTab[cfgView] || def.tabs[0][0];
    $('#na_cfg_tiles').html(cfgTiles(cfgView).map(([lab, v, note, on, t]) => `<button type="button" class="na_cfg_tile${on ? ' on' : ''}${t === tab ? ' cur' : ''}" data-t="${t}"><small>${esc(lab)}</small><b>${esc(v || '-')}</b><span>${esc(note || '')}</span></button>`).join(''));
    $('#na_cfg_tabs').html(def.tabs.map(([k, name]) => `<button type="button" class="na_cfg_tabbtn${k === tab ? ' on' : ''}" role="tab" aria-selected="${k === tab}" data-t="${k}">${name}</button>`).join(''));
}
export function applyCfgTab() {
    const def = CFG_TABS[cfgView];
    const q = String($('#na_cfg_q').val() || '').trim();
    const tab = def && !q ? cfgTab[cfgView] || def.tabs[0][0] : '';
    const $pane = $('#na_settings .na_tab_pane[data-pane="config"]');
    $pane.find('[data-t]').not('.na_cfg_tile, .na_cfg_tabbtn').each(function () { $(this).toggleClass('na_tab_off', !!tab && this.dataset.t !== tab && this.dataset.t !== 'all'); });
    // a list or box left with nothing in it goes too, so no empty card is drawn
    $pane.find('.na_cfg_grp .na_set_list, .na_cfg_grp .na_cfg_box, .na_cfg_grp').each(function () {
        const kids = $(this).find('[data-t]');
        $(this).toggleClass('na_tab_empty', !!tab && kids.length > 0 && kids.filter(':not(.na_tab_off)').length === 0);
    });
}
const clip = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const optText = id => $(`#${id} option:selected`).text().trim();
function cfgSummaries() {
    const on = id => $(`#${id}`).prop('checked');
    const pos = optText('na_position'), inChat = !$('#na_depth_field').prop('hidden');
    const sum = {
        inject: [on('na_enabled') ? pos.replace(/\s*\(.*$/, '') : '주입 끔', inChat ? `깊이 ${$('#na_depth').val()}` : '', `망각 곡선 ${on('na_fade') ? '켬' : '끔'}`],
        call: [$('#na_router_mode').val() === 'off' ? '라우터 끔' : '라우터 켬', `키워드 ${$('#na_linked_n').text() || 0}개`, guessMode() !== 'off' ? '짐작' : '', embedCfg().source ? '임베딩' : ''],
        aimodel: [clip(aiLabel() || '-', 18), `초안 ${draftReady() ? clip(drLabel(), 16) : '없음'}`],
        aitask: [`막혔을 때 ${optText('na_fallback')}`, `로어북 ${on('na_lore') ? '켬' : '끔'}`, `이탈 감지 ${optText('na_drift_auto')}`],
        theme: [$('input[name="na_ui_theme"]:checked').closest('label').find('b').text() || '-'],
        alert: [Number($('#na_backup_every').val()) > 0 ? `백업 ${$('#na_backup_every').val()}번마다` : '백업 알림 끔'],
    };
    for (const [k, parts] of Object.entries(sum)) $(`#na_cfg_sum_${k}`).text(parts.filter(Boolean).join(' · '));
}
export function layoutCfg() {
    const $pane = $('#na_settings .na_tab_pane[data-pane="config"]');
    const q = String($('#na_cfg_q').val() || '').trim();
    $('#na_cfg_index').prop('hidden', !!q || !!cfgView);
    $pane.find('.na_cfg_grp').each(function () { $(this).toggleClass('na_cfg_off', !q && this.dataset.g !== cfgView); });
    $pane.toggleClass('na_cfg_one', !q && !!cfgView);
    $('#na_cfg_title').text(!q && cfgView ? CFG_GROUPS.find(x => x[0] === cfgView)[1] : '설정');
    $('#na_cfg_back').attr({ title: cfgView ? '설정 목차로' : '돌아가기', 'aria-label': cfgView ? '설정 목차로' : '돌아가기' });
    if (!cfgView || q) cfgSummaries();
    renderCfgTiles();
    applyCfgTab();
}

// 뜻으로 찾기 rows: model and address only for a source of our own, the build row once it is on
export let embTyping = false; // 직접 입력 picked: keep the name box open
export function setEmbTyping(v) { embTyping = v; }
export function syncEmbedRows() {
    const e = embedCfg();
    $('#na_emb_src').val(e.source);
    const own = e.source && e.source !== 'st';
    // a list to pick from where we know the models, the name box for the rest or for "직접 입력"
    const picks = own ? EMBED_MODELS[e.source] || [] : [];
    const free = !own || ['transformers', 'mistral', 'nomicai'].includes(e.source);
    const cur = e.model || EMBED_DEFAULT_MODEL[e.source] || '';
    const known = embTyping ? null : picks.find(x => x[0] === cur);
    $('#na_emb_pick_row').prop('hidden', free || !picks.length);
    $('#na_emb_pick').html(picks.map(([v]) => `<option value="${esc(v)}">${esc(v)}</option>`).join('') + '<option value="">직접 입력…</option>').val(known ? cur : '');
    $('#na_emb_pick_sub').text(known ? known[1] : '아래에 모델 이름을 넣어요');
    $('#na_emb_model_row').prop('hidden', free || (picks.length > 0 && !!known && !embTyping));
    $('#na_emb_model').val(e.model).attr('placeholder', EMBED_DEFAULT_MODEL[e.source] || '');
    $('#na_emb_url_row').prop('hidden', e.source !== 'ollama');
    $('#na_emb_region_row').prop('hidden', e.source !== 'vertexai');
    $('#na_emb_region').val(e.region);
    const stRegion = String(ctx().chatCompletionSettings?.vertexai_region || '').trim();
    $('#na_emb_region_sub').text(e.region ? '임베딩만 이 지역으로' : `비우면 실리태번 Vertex 설정 지역${stRegion ? ` (${stRegion})` : ''}`);
    $('#na_emb_url').val(e.url);
    $('#na_emb_build').prop('hidden', !e.source);
    if ($('#na_emb_build').hasClass('na_busy')) return;
    const st = embedState(), err = embedError();
    $('#na_emb_sub').text(err ? `안 됨: ${err.slice(0, 80)} · 눌러서 다시` : st?.synced ? `${embedLabel()} · 섹션 조각 ${st.secs} · ${timeLabel(st.at)}` : (hasChat() && !routerUsesEmbed(getMeta()) ? `${embedLabel()} · AI 라우터를 켜면 만들어요` : `${embedLabel()} · 처음 한 번 만들어요 · 답할 때 알아서도 만들어요`));
}

// 압축 탭: picked method, and only the rows that method uses
const CP_METHODS = { quick: '한 번에', studio: '작업실', wizard: '마법사' };
export const cpMethod = () => (globalSettings().cpMethod in CP_METHODS ? globalSettings().cpMethod : 'quick');
export function layoutCp() {
    const md = cpMethod(), cm = compressMode(), g = globalSettings();
    const $cp = $('#na_settings .na_cp');
    $cp.find('.na_cp_mbtn').each(function () { const on = this.dataset.m === md; $(this).toggleClass('on', on).attr('aria-checked', String(on)); });
    $cp.find('.na_cp_desc > [data-m], .na_cp_flags').each(function () { this.hidden = this.dataset.m !== md; });
    $cp.find('.na_cp_set [data-m]').each(function () {
        const $r = $(this);
        let show = this.dataset.m.split(' ').includes(md);
        // in 한 번에 the scene rows follow 압축 방식; 작업실 always cuts scenes
        if (show && md === 'quick') show = !($r.hasClass('na_cmode_sc') && cm !== 'scenes');
        $r.toggle(show);
    });
    $('#na_cmode_sub').text({ raw: '결이 중요하면 장면별', scenes: '장면마다 섹션 하나씩' }[cm] || '');
    $('#na_cp_for').text(`· ${CP_METHODS[md]}`);
    const flag = (id, on) => $(id).attr('aria-pressed', String(on)).toggleClass('on', on).find('b').text(on ? '켬' : '끔');
    flag('#na_flag_auto', !!g.quickAuto);
    flag('#na_flag_grade', !!g.quickGrade);
}
