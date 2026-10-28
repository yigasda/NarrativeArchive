// The side panel: markup, event wiring (bindPanel) and refresh (syncPanel).

import { activeBooks, loreCfg, setLore } from './lore.js';
import { fallbackOf, aiLabel, aiProfiles, apiFormat, askAI, askDraft, compressEffort, connSettings, drLabel, draftReady, draftSettings, listModels, trLabel, trSettings, vxModelList, withSpinner } from './ai.js';
import { openAppend } from './append.js';
import { openAsk } from './ask.js';
import { branchState, openBranches } from './branches.js';
import { mountSectionBrowser } from './browser.js';
import { openCalendar } from './calendar.js';
import { carryOffer, currentChatId, importArchive, openChatPicker, pickFromBundle, rememberArchive, setCarryOffer } from './chats.js';
import { MODULE, POSITIONS, POSITION_ORDER, ROLES, SETTING_KEYS, SNAPSHOT_MAX, VERSION, commitText, ctx, getMeta, globalSettings, hasChat, pushSnapshot, saveGlobal, saveMeta } from './core.js';
import { openCompare, openDiff } from './diff.js';
import { openDrift } from './drift.js';
import { guessEndNumber, openExtract } from './extract.js';
import { fadeCfg, fadeFilling, fadeForce, fadeMissing, fadePlan, fadeUse, fillFade, openFadePicker } from './fade.js';
import { openHealth } from './health.js';
import { applyHide, lastIndex, openUnhide, syncTrackedBoundary } from './hide.js';
import { applyInjection, lastBuild } from './inject.js';
import { keepsOf, openKeeps } from './keeps.js';
import { OFF_KINDS, offKinds, setOffKind } from './recall.js';
import { openKeywordTest } from './keywords.js';
import { knowledgeRows, openKnowledge } from './knowledge.js';
import { openPeople } from './people.js';
import { openPreview } from './preview.js';
import { auOf, bindPromptSettings } from './prompts.js';
import { openQuotes } from './quotes.js';
import { openReader } from './reader.js';
import { routerCandidates, routerCfg, routerState, runRouter } from './router.js';
import { GUESS_MODES, guessMode, lastGuess } from './guess.js';
import { EMBED_DEFAULT_MODEL, EMBED_MODELS, EMBED_SOURCES, embedCfg, embedError, embedLabel, embedState, setEmbed, syncEmbed } from './embed.js';
import { RANGE_HEAD, cachedTokens, checkHeadings, filterMuted, groupLabel, linkedMap, mutedCount, parseSections, pinnedSet, sectionKey } from './sections.js';
import { refreshStatus } from './status.js';
import { ICO_A, setUiTheme, svgA, uiTheme } from './theme.js';
import { AI_SYS_TRANSLATE, askTranslator, glossaryEntries, openGlossary } from './translate.js';
import { chatLabel, confirm, copyText, countTokens, download, esc, escRe, fmt, nowStamp, timeLabel } from './util.js';
import { NUDGE_CHOICES, COMPRESS_MODES, compressMode, openAuSettings, openWizard, quickCompress } from './wizard.js';
import { openStudio, studioLabel } from './studio.js';
import { SCENE_SIZES, openStyleSamples, openWorkNote, recentTrackers, styleLabel, sceneSize } from './scenes.js';
import { openWorlds, worldBooks, worldIsOn } from './world.js';
import { openXray } from './xray.js';

export let sectionPanel = null;
export let refreshReplace = () => {};
export let editorDirty = false;
export function setEditorDirty(v) { editorDirty = v; }
export let editorBase = null; // the archive text the editor was last loaded from

export function renderPanel() {
    const html = `
    <div id="na_settings" class="extension_settings">
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b class="na_title"><i class="fa-solid fa-feather-pointed"></i> 서사 아카이브 <span class="na_ver">v${VERSION}</span></b>
          <span class="na_head_badge" id="na_head_badge"></span>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <div class="na_body">

            <div class="na_carry na_branch_card" id="na_branch_card" hidden>
              <i class="fa-solid fa-code-branch"></i>
              <div class="na_carry_text"><b>분기 전 내용이 섞였어요</b><span id="na_branch_desc"></span></div>
              <div class="na_carry_btns"><button type="button" class="na_btn na_small na_primary" id="na_branch_fix">정리하기</button></div>
            </div>
            <div class="na_carry" id="na_carry" hidden>
              <i class="fa-solid fa-route"></i>
              <div class="na_carry_text"><b>이어서 쓸까요?</b><span id="na_carry_desc"></span></div>
              <div class="na_carry_btns">
                <button type="button" class="na_btn na_small na_primary" id="na_carry_go">가져오기</button>
                <button type="button" class="na_icon na_icon_sm" id="na_carry_x" title="닫기"><i class="fa-solid fa-xmark"></i></button>
              </div>
            </div>

            <div class="na_meter" id="na_meter">
              <div class="na_meter_top">
                <div class="na_meter_total" id="na_meter_total">-</div>
                <div class="na_meter_state" id="na_meter_state"></div>
                <span class="na_spacer"></span>
                <button type="button" class="na_hchip" id="na_health" title="건강 점검"><i class="fa-solid fa-stethoscope"></i> <span>-</span></button>
                <button type="button" class="na_icon" id="na_gear" title="설정"><i class="fa-solid fa-gear"></i></button>
              </div>
              <div class="na_meter_bar"><span class="na_seg_arc"></span><span class="na_seg_raw"></span></div>
              <div class="na_meter_stats" id="na_meter_stats"></div>
              <div class="na_meter_legend" id="na_meter_legend"></div>
            </div>

            <nav class="na_nav" role="tablist">
              <button type="button" class="na_nav_btn active" data-tab="home">${svgA(ICO_A.home, 19)}<span>홈</span></button>
              <button type="button" class="na_nav_btn" data-tab="archive">${svgA(ICO_A.archive, 19)}<span>아카이브</span></button>
              <button type="button" class="na_nav_btn" data-tab="compress">${svgA(ICO_A.compress, 19)}<span>압축</span></button>
              <button type="button" class="na_nav_btn" data-tab="tools">${svgA(ICO_A.grid, 19)}<span>도구</span></button>
            </nav>

            <!-- 홈 -->
            <section class="na_tab_pane" data-pane="home">
              <div class="na_start" id="na_start" hidden></div>
              <div class="na_next" id="na_next"></div>
              <div class="na_quick">
                <button type="button" class="na_qbtn" id="na_q_read">${svgA(ICO_A.book, 16)}<span>읽기</span></button>
                <button type="button" class="na_qbtn" id="na_q_ask">${svgA(ICO_A.chat, 16)}<span>질문</span></button>
                <button type="button" class="na_qbtn" id="na_q_wizard">${svgA(ICO_A.wand, 16)}<span>압축</span></button>
                <button type="button" class="na_qbtn" id="na_q_preview">${svgA(ICO_A.eye, 16)}<span>미리보기</span></button>
              </div>
              <div class="na_ai_row3">
                <div class="na_ai_head"><b>AI 도구</b><span class="na_ai_status" id="na_ai_status"></span></div>
                <button type="button" class="na_hrow" id="na_drift"><span class="na_hrow_ic drift">${svgA(ICO_A.route, 19)}</span><span class="na_hrow_txt"><b>이탈 감지</b><small id="na_drift_sub">최근 대화가 아카이브와 어긋나는지</small></span><span class="na_hrow_badge drift" id="na_drift_badge" hidden></span></button>
                <button type="button" class="na_hrow" id="na_know"><span class="na_hrow_ic know">${svgA(ICO_A.users, 19)}</span><span class="na_hrow_txt"><b>누가 아는가</b><small id="na_know_sub">비밀마다 아는 사람·모르는 사람</small></span><span class="na_hrow_badge know" id="na_know_badge" hidden></span></button>
                <button type="button" class="na_hrow" id="na_quotes"><span class="na_hrow_ic quote">${svgA(ICO_A.quote, 19)}</span><span class="na_hrow_txt"><b>대사 은행</b><small id="na_quotes_sub">대사를 모아 말투 지문으로</small></span><span class="na_hrow_badge quote" id="na_quotes_badge" hidden></span></button>
              </div>
            </section>

            <!-- 아카이브 -->
            <section class="na_tab_pane" data-pane="archive" hidden>
              <div class="na_seg">
                <button type="button" class="na_seg_btn active" data-view="cards">섹션 카드</button>
                <button type="button" class="na_seg_btn" data-view="editor">원문 편집</button>
              </div>
              <div class="na_block" id="na_view_cards">
                <details class="na_hcheck" id="na_replace">
                  <summary><i class="fa-solid fa-right-left"></i> 찾아 바꾸기 <span class="na_chip" id="na_rp_n"></span></summary>
                  <div class="na_rp_body">
                    <div class="na_rp_grid">
                      <input type="text" class="text_pole" id="na_rp_find" placeholder="찾을 말">
                      <input type="text" class="text_pole" id="na_rp_to" placeholder="바꿀 말 (비우면 지우기)">
                    </div>
                    <div class="na_rp_opts">
                      <label class="checkbox_label"><input type="checkbox" id="na_rp_case"><span>대소문자 구분</span></label>
                      <label class="checkbox_label"><input type="checkbox" id="na_rp_word"><span>낱말 단위</span></label>
                    </div>
                    <div class="na_rp_list" id="na_rp_list"></div>
                    <div class="na_row na_right">
                      <button type="button" class="na_btn na_primary na_small" id="na_rp_go" disabled><i class="fa-solid fa-right-left"></i> 모두 바꾸기</button>
                    </div>
                  </div>
                </details>
                <details class="na_hcheck" id="na_hcheck">
                  <summary><i class="fa-solid fa-spell-check"></i> 제목 검사 <span class="na_chip" id="na_hcheck_n">-</span></summary>
                  <div id="na_hcheck_list"></div>
                </details>
                <div id="na_sec_host"></div>
              </div>
              <div class="na_block" id="na_view_editor" hidden>
                <div class="na_editor_bar">
                  <span class="na_chip" id="na_ed_tok">-</span>
                  <span class="na_dirty" id="na_ed_dirty" hidden>● 저장 안 됨</span>
                  <span class="na_spacer"></span>
                  <button type="button" class="na_icon" id="na_ed_find" title="찾기"><i class="fa-solid fa-magnifying-glass"></i></button>
                  <button type="button" class="na_icon" id="na_ed_toc" title="목차"><i class="fa-solid fa-list-ul"></i></button>
                  <span class="na_more_wrap">
                    <button type="button" class="na_icon" id="na_ed_more" title="더 보기"><i class="fa-solid fa-ellipsis"></i></button>
                    <span class="na_more_menu" id="na_ed_menu" hidden>
                      <button type="button" id="na_ed_preview"><i class="fa-regular fa-eye"></i> 주입 미리보기</button>
                      <button type="button" id="na_ed_copy"><i class="fa-regular fa-copy"></i> 전체 복사</button>
                      <button type="button" id="na_ed_ask"><i class="fa-regular fa-comments"></i> 아카이브에 질문</button>
                      <button type="button" id="na_ed_big"><i class="fa-solid fa-book-open-reader"></i> 읽기 모드</button>
                    </span>
                  </span>
                </div>
                <div class="na_toc" id="na_toc" hidden></div>
                <div class="na_findbar" id="na_findbar" hidden>
                  <div class="na_find_field">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="search" class="text_pole" id="na_find_q" placeholder="본문에서 찾기">
                    <span class="na_find_info" id="na_find_info"></span>
                  </div>
                  <button type="button" class="na_icon" id="na_find_prev" title="이전 (Shift+Enter)"><i class="fa-solid fa-chevron-up"></i></button>
                  <button type="button" class="na_icon" id="na_find_next" title="다음 (Enter)"><i class="fa-solid fa-chevron-down"></i></button>
                  <button type="button" class="na_icon" id="na_find_close" title="닫기"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="na_editor_wrap">
                  <div class="na_editor_marks" aria-hidden="true"></div>
                <textarea id="na_editor" class="text_pole na_editor" spellcheck="false" placeholder="# 제목&#10;&#10;# ── Y1 ──&#10;&#10;## #0–#47 — ..."></textarea>
                </div>
                <div class="na_editor_actions">
                  <button type="button" class="na_btn" id="na_ed_revert"><i class="fa-solid fa-rotate-left"></i> 되돌리기</button>
                  <button type="button" class="na_btn na_primary" id="na_ed_save"><i class="fa-solid fa-floppy-disk"></i> 저장</button>
                </div>
              </div>
            </section>

            <!-- 압축 -->
            <section class="na_tab_pane" data-pane="compress" hidden>
              <div class="na_v2 na_cp">
                <div class="na_v2_card na_cp_hero">
                  <div id="na_since"></div>
                  <div class="na_cp_meth" role="radiogroup" aria-label="압축 방법">
                    <button type="button" class="na_cp_mbtn" data-m="quick" role="radio">한 번에</button>
                    <button type="button" class="na_cp_mbtn" data-m="studio" role="radio">작업실</button>
                    <button type="button" class="na_cp_mbtn" data-m="wizard" role="radio">마법사</button>
                  </div>
                  <div class="na_cp_desc"><span data-m="quick" id="na_quick_sub">초안 모델로 요약 → 확인하고 추가</span><span data-m="studio" id="na_studio_sub">장면마다 초안 모델과 대화하며 쓰기</span><span data-m="wizard">원문 뽑기 → 복사 → 붙여넣기 → 채점 → 추가</span></div>
                  <button type="button" class="na_cp_wiz na_cp_go" id="na_cp_go"><span><b id="na_cp_go_t">압축하기</b></span>${svgA(ICO_A.right, 18, 2.2)}</button>
                  <div class="na_cp_flags" data-m="quick">
                    <button type="button" class="na_cp_flag" id="na_flag_auto" aria-pressed="false" title="검사가 다 통과하면 추가 창 없이 넣고 숨겨요 · 알림에서 되돌리기 · 걸리는 게 있으면 추가 창">바로 넣기 <b></b></button>
                    <button type="button" class="na_cp_flag" id="na_flag_grade" aria-pressed="false" title="AI 기능 모델이 원문과 맞춰 봐요 · 비용 추가 · 확인 창에서도 바꿀 수 있어요">원문 대조 <b></b></button>
                  </div>
                </div>
                <div class="na_cp_tiles">
                  <button type="button" class="na_cp_tile" id="na_apply_hide"><span class="na_cp_ico">${svgA('M17.9 17.9A10 10 0 0 1 12 20c-7 0-10-8-10-8a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.2M1 1l22 22', 17)}</span><b>숨기기 다시 적용</b><small>경계선 앞만 숨기고 뒤는 보이게</small></button>
                  <button type="button" class="na_cp_tile" id="na_unhide"><span class="na_cp_ico">${svgA('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>', 17)}</span><b>숨김 해제</b><small id="na_hidden_n">숨긴 메시지 다시 보이게</small></button>
                </div>
                <div class="na_v2_label">따로 하기</div>
                <div class="na_v2_card na_v2_list">
                  <button type="button" class="na_cp_row" id="na_open_extract"><span class="na_cp_num">1</span><span class="na_cp_txt"><b>원문 뽑기</b><small>경계선 이후 메시지 · 지시문 붙여 복사</small></span>${svgA(ICO_A.right, 16, 2.2)}</button>
                  <button type="button" class="na_cp_row" id="na_open_append"><span class="na_cp_num">2</span><span class="na_cp_txt"><b>아카이브에 추가</b><small>압축본 붙여넣기 · 번호 검사 · 경계선 자동</small></span>${svgA(ICO_A.right, 16, 2.2)}</button>
                  <button type="button" class="na_cp_row" id="na_open_keeps"><span class="na_cp_num">3</span><span class="na_cp_txt"><b>꼭 남길 장면</b><small id="na_keeps_sub">압축할 때 자세히 남길 구간과 그 이유</small></span>${svgA(ICO_A.right, 16, 2.2)}</button>
                </div>
                <div class="na_v2_label"><span>설정 <span class="na_cp_for" id="na_cp_for"></span></span></div>
                <div class="na_v2_card na_v2_list na_cp_set">
                  <label class="na_cp_row" hidden title="검사가 다 통과하면 추가 창 없이 넣고 숨겨요 · 알림에서 되돌리기 · 걸리는 게 있으면 추가 창"><span class="na_cp_txt"><span>한 번에 압축 · 바로 넣기</span><small>검사 통과하면 바로 넣기</small></span><input type="checkbox" class="na_toggle" id="na_quick_auto"></label>
                  <label class="na_cp_row" data-m="quick"><span class="na_cp_txt"><span>압축 방식</span><small id="na_cmode_sub"></small></span><select class="text_pole na_cc_sel na_cp_sel" id="na_cmode">${Object.entries(COMPRESS_MODES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
                  <label class="na_cp_row na_cmode_sc" data-m="quick studio" title="장면마다 섹션 하나씩 따로 받아요"><span class="na_cp_txt"><span>장면 크기</span><small>클수록 싸고, 작을수록 꼼꼼해요</small></span><select class="text_pole na_cc_sel na_cp_sel" id="na_scsize">${Object.entries(SCENE_SIZES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
                  <button type="button" class="na_cp_row na_cmode_sc" data-m="quick studio" id="na_stylesample"><span class="na_cp_txt"><span>문체 견본</span><small id="na_style_sub"></small></span>${svgA(ICO_A.right, 16, 2.2)}</button>
                  <button type="button" class="na_cp_row na_cmode_sc" data-m="quick studio" id="na_worknote"><span class="na_cp_txt"><span>작업 노트</span><small id="na_worknote_sub">장면마다 같이 보내요</small></span>${svgA(ICO_A.right, 16, 2.2)}</button>
                  <label class="na_cp_row" data-m="quick" title="지시문의 규칙은 시스템 메시지에, 원문 · 메모 · 마지막 점검은 요청에"><span class="na_cp_txt"><span>규칙은 시스템 메시지로</span><small>중계 서버가 버리면 끄세요</small></span><input type="checkbox" class="na_toggle" id="na_rules_sys"></label>
                  <label class="na_cp_row" title="압축할 메시지가 이만큼 쌓이면 알림 · 누르면 압축"><span class="na_cp_txt"><span>쌓이면 알려 주기</span><small>이만큼 쌓이면 알림</small></span><select class="text_pole na_cc_sel na_cp_sel" id="na_nudge">${Object.entries(NUDGE_CHOICES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
                </div>
                <div class="na_v2_card na_v2_list na_cp_set">
                  <details class="na_cp_fold na_cp_more_fold" id="na_cp_more">
                    <summary class="na_cp_row"><span class="na_cp_txt"><span>원문 손질 · 지시문 · 경계선</span><small id="na_cp_more_sub">태그 · OOC 빼기 · 압축 지시문 · 아카이브 따라가기</small></span><span class="na_cp_more">더 보기</span><span class="na_cp_chev">${svgA(ICO_A.right, 16, 2.2)}</span></summary>
                  <label class="na_cp_row"><span class="na_cp_txt"><span>숨긴 메시지 빼고 뽑기</span></span><input type="checkbox" class="na_toggle" id="na_opt_hidden"></label>
                  <label class="na_cp_row" title="think · thinking · thought · reasoning · scene_plan · style · script와 주석은 통째로 빼고, 나머지 HTML 태그는 지우고 글자만 남겨요 · 끄면 메시지를 그대로 보내요"><span class="na_cp_txt"><span>태그 지우기</span><small>생각 · 계획 블록은 통째로 · 나머지는 글자만</small></span><input type="checkbox" class="na_toggle" id="na_opt_tags"></label>
                  <button type="button" class="na_cp_row na_trk_row" id="na_trk_row" title="원문의 상태창에서 날짜 · 장소를 섹션 제목에 쓰고, AI가 장면을 못 나누면 상태창이 바뀌는 곳에서 잘라요 · 누르면 최근에 찾은 상태창"><span class="na_cp_txt"><span>상태창</span><small id="na_trk_sub"></small></span><span class="na_cp_more">자동</span></button>
                  <div class="na_cp_row na_off_row" id="na_off_fold" title="켠 것은 압축 · 원문 뽑기 · 이탈 감지 · 말투 지문에서 빠져요"><span class="na_cp_txt"><span>OOC 빼기</span><small id="na_off_sub"></small></span>
                    <span class="na_off_chips">${Object.entries(OFF_KINDS).map(([k, [name, sub, chip]]) => `<button type="button" class="na_off_chip" data-k="${k}" title="${name} · ${sub}" aria-pressed="false">${chip}</button>`).join('')}</span></div>
                  <details class="na_cp_fold" id="na_cmp_settings">
                    <summary class="na_cp_row"><span class="na_cp_txt"><span>압축 지시문</span><small id="na_plib_sum">이 기기의 실리태번 설정에만 저장돼요</small></span><span class="na_cp_more">편집</span><span class="na_cp_chev">${svgA(ICO_A.right, 16, 2.2)}</span></summary>
                    <div class="na_cp_sub"><div class="na_plib" id="na_plib"></div></div>
                  </details>
                  <label class="na_cp_row"><span class="na_cp_txt"><span>아카이브 따라가기</span><small id="na_track_info">마지막 제목 번호가 곧 경계선</small></span><input type="checkbox" id="na_track" class="na_toggle"></label>
                  <label class="na_cp_row" id="na_boundary_row" title="여기까지 아카이브에 담겼어요"><span class="na_cp_txt"><span>경계선 번호</span></span><span class="na_cp_hash"><span>#</span><input type="number" id="na_boundary" class="text_pole na_cp_num_in" min="0" placeholder="-"></span></label>
                  <div class="na_cp_row na_cp_keep_row"><span class="na_cp_txt"><span>숨길 때 남길 메시지</span><small>경계선 바로 앞 몇 개는 보이게</small></span><span class="na_fd_step na_cp_step"><button type="button" class="na_fd_btn na_keep_btn" data-d="-1" aria-label="줄이기">−</button><input type="number" id="na_keep" class="text_pole" min="0" max="50"><button type="button" class="na_fd_btn na_keep_btn" data-d="1" aria-label="늘리기">+</button></span></div>
                  </details>
                </div>
              </div>
            </section>

            <!-- 도구 -->
            <section class="na_tab_pane" data-pane="tools" hidden>
              <div class="na_block">
                <div class="na_kw_label">이야기</div>
                <button type="button" class="na_toolrow" id="na_worlds"><i class="fa-solid fa-earth-asia"></i><span><b>세계관 공유</b><small id="na_worlds_sub">여러 채팅이 같이 쓰는 설정 · 고치면 모든 채팅에 반영</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_au"><i class="fa-solid fa-shuffle"></i><span><b>AU 채팅</b><small id="na_au_sub">본편 기억을 들고 온 채팅이면 켜요</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_people"><i class="fa-solid fa-address-book"></i><span><b>인물 도감 · 관계도</b><small>인물마다 얼굴·상태·관계 · 함께 나온 섹션으로 잇는 관계도</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_story_cal"><i class="fa-solid fa-calendar-days"></i><span><b>이야기 달력</b><small>섹션을 날짜 순서로 · 거꾸로 가는 날짜 찾기</small></span><i class="fa-solid fa-chevron-right"></i></button>
              </div>
              <div class="na_block">
                <div class="na_kw_label">점검</div>
                <button type="button" class="na_toolrow" id="na_tool_health"><i class="fa-solid fa-stethoscope"></i><span><b>건강 점검</b><small id="na_tool_health_sub">번호·숨기기·키워드·백업을 AI 없이 살펴봐요</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_tool_xray"><i class="fa-solid fa-x-ray"></i><span><b>프롬프트 X-ray</b><small id="na_tool_xray_sub">보낸 프롬프트의 구성 · 겹치는 내용 · 키워드가 켜지는 비율</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_branches"><i class="fa-solid fa-code-branch"></i><span><b>분기</b><small id="na_branches_sub">원본·갈라진 채팅과 비교, 분기 정리</small></span><i class="fa-solid fa-chevron-right"></i></button>
              </div>
              <div class="na_block">
                <div class="na_kw_label">백업 · 가져오기 <span class="na_dim" id="na_backup_info"></span></div>
                <div class="na_tiles na_tiles3">
                  <button type="button" class="na_tile" id="na_export_json"><i class="fa-solid fa-box-archive"></i><span>.json 백업</span><small>설정·복구 지점까지</small></button>
                  <button type="button" class="na_tile" id="na_export"><i class="fa-solid fa-file-lines"></i><span>.txt 내보내기</span><small>현재 아카이브</small></button>
                  <button type="button" class="na_tile" id="na_import_menu"><i class="fa-solid fa-file-import"></i><span>가져오기</span><small>파일 · 다른 채팅</small></button>
                </div>
                <div class="na_import_opts" id="na_import_opts" hidden>
                  <button type="button" class="na_btn na_small" id="na_import"><i class="fa-solid fa-file-arrow-up"></i> 파일에서 (.txt · .json)</button>
                  <button type="button" class="na_btn na_small" id="na_from_chat"><i class="fa-solid fa-comments"></i> 다른 채팅에서</button>
                </div>
                <div class="na_row na_right"><button type="button" class="na_linkbtn na_danger" id="na_clear"><i class="fa-solid fa-eraser"></i> 아카이브 비우기</button></div>
                <input type="file" id="na_file" accept=".txt,.md,.json,text/plain,application/json" hidden>
              </div>
              <details class="na_block na_details na_fold">
                <summary>복구 지점 · 변경 내역 <span class="na_chip" id="na_snap_n">0</span></summary>
                <div>
                  <p class="na_dim na_fold_desc">바꾸기 직전 상태를 자동으로 남기고(최근 ${SNAPSHOT_MAX}개), 그 뒤 어떤 섹션이 바뀌었는지 같이 보여 줘요.</p>
                  <div class="na_row">
                    <button type="button" class="na_btn na_small" id="na_snap_now"><i class="fa-solid fa-bookmark"></i> 지금 보관</button>
                    <button type="button" class="na_btn na_small" id="na_compare"><i class="fa-solid fa-code-compare"></i> 두 버전 비교</button>
                  </div>
                  <div id="na_snap_list" class="na_snap_list"></div>
                  <details class="na_hist_more" id="na_hist_more" hidden>
                    <summary>더 오래된 변경 <span id="na_hist_n"></span>개 <small class="na_dim">(복구 지점은 지워짐)</small></summary>
                    <div id="na_hist_list" class="na_hist_list"></div>
                  </details>
                </div>
              </details>
            </section>

            <!-- 설정 (⚙) -->
            <section class="na_tab_pane" data-pane="config" hidden>
              <div class="na_cfg_head"><button type="button" class="na_cfg_back" id="na_cfg_back" title="돌아가기" aria-label="돌아가기">${svgA(ICO_A.left, 18, 2.2)}</button><b id="na_cfg_title">설정</b><button type="button" class="na_cfg_pill" id="na_cfg_preview">주입 미리보기</button></div>
              <div class="na_search_wrap na_cfg_search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" class="text_pole na_search" id="na_cfg_q" placeholder="설정 찾기 · 예: 깊이, 로어북, OOC" aria-label="설정 찾기"></div>
              <div class="na_empty" id="na_cfg_none" hidden>맞는 설정이 없어요.</div>
              <div class="na_cfg_index" id="na_cfg_index">${CFG_GROUPS.map(([k, name, ico]) => `<button type="button" class="na_cfg_card" data-g="${k}"><span class="na_cfg_ico">${svgA(ico, 18)}</span><b>${name}</b><small id="na_cfg_sum_${k}"></small></button>`).join('')}</div>
              <div class="na_cfg_tiles" id="na_cfg_tiles" hidden></div>
              <div class="na_cfg_tabs" id="na_cfg_tabs" role="tablist" hidden></div>
              <div class="na_cfg_grp na_cfg_keeplab" data-g="inject">
                <div class="na_cfg_label"><i class="fa-solid fa-syringe"></i> 넣는 자리</div>
                <div class="na_cfg_box">
                <div class="na_set_list">
                  <label class="na_set_row"><span>아카이브 주입</span><input type="checkbox" id="na_enabled" class="na_toggle"></label>
                  <label class="na_set_row"><span>위치</span>
                    <span class="na_cfg_val"><select id="na_position" class="text_pole">${POSITION_ORDER.map(v => `<option value="${v}">${POSITIONS[v].replace(/\s*\(깊이\)$/, '')}</option>`).join('')}</select><span class="na_cfg_depth" id="na_depth_field">&nbsp;· 깊이&nbsp;<input type="number" id="na_depth" class="text_pole" min="0" max="999" title="채팅 끝에서 몇 번째 메시지 위에 넣을지"></span>${svgA(ICO_A.right, 15, 2.2)}</span>
                  </label>
                  <label class="na_set_row"><span>역할</span>
                    <span class="na_cfg_val"><select id="na_role" class="text_pole">${Object.entries(ROLES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>${svgA(ICO_A.right, 15, 2.2)}</span>
                  </label>
                </div>
                </div>
              </div>
              <div class="na_cfg_grp na_cfg_keeplab" data-g="inject">
                <div class="na_cfg_label"><i class="fa-solid fa-scale-balanced"></i> 분량</div>
                <div class="na_cfg_box">
                <div class="na_set_list">
                  <label class="na_set_row"><span><span>토큰 상한</span><small>넘으면 알려 줘요</small></span><span class="na_cfg_val"><input type="number" id="na_cap" class="text_pole" min="0" step="1000" placeholder="없음" title="0이나 빈칸이면 상한 없음"><span class="na_cfg_unit">&nbsp;토큰</span>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                  <label class="na_set_row" for="na_fade" title="오래된 섹션은 짧은 버전·한 줄로 넣어요. 버전이 없으면 원문 그대로 · 고정한 섹션과 지금 불려 온 섹션은 늘 원문"><span><span>망각 곡선</span><small id="na_fade_sub">오래된 섹션은 짧은 버전·한 줄로</small></span><button type="button" class="na_fd_more" id="na_fade_more" title="자세히" aria-label="자세히" hidden>${svgA(ICO_A.down, 15, 2.2)}</button><input type="checkbox" id="na_fade" class="na_toggle"></label>
                  <div id="na_fade_opts" class="na_v2 na_fd" hidden>
                    <div class="na_fd_save"><span><b id="na_fade_now">-</b><small>토큰</small><s id="na_fade_was"></s></span><span class="na_fd_pct" id="na_fade_pct"></span></div>
                    <div class="na_fd_strip" id="na_fade_strip" aria-hidden="true"></div>
                    <div class="na_fd_ends"><span>오래됨</span><span>최근</span></div>
                    <div class="na_fd_level"><i class="long"></i><span><span>원문 그대로</span><small>최근 섹션</small></span><span class="na_fd_step"><button type="button" class="na_fd_btn" data-f="full" data-d="-1" aria-label="줄이기">−</button><input type="number" id="na_fade_full" class="text_pole" min="0" max="200"><button type="button" class="na_fd_btn" data-f="full" data-d="1" aria-label="늘리기">+</button></span></div>
                    <div class="na_fd_level"><i class="short"></i><span><span>짧은 버전</span><small>그다음 섹션</small></span><span class="na_fd_step"><button type="button" class="na_fd_btn" data-f="short" data-d="-1" aria-label="줄이기">−</button><input type="number" id="na_fade_short" class="text_pole" min="0" max="500"><button type="button" class="na_fd_btn" data-f="short" data-d="1" aria-label="늘리기">+</button></span></div>
                    <div class="na_fd_level"><i class="line"></i><span><span>한 줄</span><small>더 오래된 섹션 전부</small></span><b id="na_fade_lines">-</b></div>
                    <div class="na_fd_fill"><span id="na_fade_info">-</span><button type="button" class="na_v2_btn primary" id="na_fade_fill"><i class="fa-solid fa-feather-pointed"></i> 초안 모델로 채우기</button></div>
                  </div>
                  <button type="button" class="na_set_row na_cfg_go" id="na_fade_pick"><span><span>섹션별 버전 고르기</span><small id="na_fade_pick_sub">여러 섹션을 골라 원문 · 짧게 · 한 줄로</small></span>${svgA(ICO_A.right, 15, 2.2)}</button>
                </div>
                </div>
              </div>
              <div class="na_cfg_grp na_cfg_keeplab" data-g="call" title="섹션 카드의 스위치 · 고정 · 키워드로 섹션마다 정하고, 여기선 한꺼번에 관리해요.">
                <div class="na_cfg_label"><i class="fa-solid fa-magnifying-glass"></i> 호출</div>
                <div class="na_cfg_box">
                <div class="na_set_list">
                  <label class="na_set_row" title="답하기 직전에 작은 모델이 지금 대화에 필요한 섹션을 골라 넣어요 · 따로 연결한 모델이 필요해요"><span><span>AI 라우터</span><small>답하기 직전에 필요한 섹션을 골라요</small></span>
                    <span class="na_cfg_val"><select id="na_router_mode" class="text_pole"><option value="off">끄기</option><option value="linked">키워드에 더해 AI도</option><option value="old">오래된 섹션 전부</option></select>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                  <div class="na_router_opts" id="na_router_opts" hidden>
                    <label class="na_set_row" title="고른 섹션 본문에 &quot;#217–#236&quot;처럼 적힌 섹션도 같이 넣어요"><span><span>가리키는 섹션도 같이</span><small>고른 섹션에 적힌 #번호의 섹션</small></span><input type="checkbox" id="na_router_follow" class="na_toggle"></label>
                    <label class="na_set_row"><span><span>한 번에 최대</span><small>AI가 고를 섹션 수</small></span><span class="na_cfg_val"><input type="number" id="na_router_max" class="text_pole" min="1" max="20"><span class="na_cfg_unit">개</span>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                    <label class="na_set_row" id="na_router_keep_row"><span><span>최근 섹션은 항상</span><small>마지막 몇 개는 AI가 안 고르고 늘 넣어요</small></span><span class="na_cfg_val"><input type="number" id="na_router_keep" class="text_pole" min="0" max="20"><span class="na_cfg_unit">개</span>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                    <button type="button" class="na_set_row na_cfg_go" id="na_router_test"><span><span>지금 해 보기</span><small id="na_router_info">최근 대화로 한 번 골라 봐요</small></span>${svgA(ICO_A.right, 15, 2.2)}</button>
                  </div>
                  <label class="na_set_row" title="&quot;그날 밤&quot;처럼 지난 일을 돌려 말하면, AI 기능 모델이 그때 장면을 짐작해 적고 그 말로 섹션 본문까지 찾아요 · 제목에 없는 장면도 찾게 · 답할 때마다 짧게 한 번 더 불러요"><span><span>지난 장면 짐작하기</span><small id="na_guess_sub">돌려 말한 지난 일도 찾게</small></span>
                    <span class="na_cfg_val"><select id="na_guess" class="text_pole">${Object.entries(GUESS_MODES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                  <label class="na_set_row" title="섹션을 뜻으로도 찾아요 · 라우터가 단어가 안 겹쳐도 비슷한 뜻이면 찾고, 한국어 채팅으로 영어 아카이브도 찾아요 · 실리태번 서버의 벡터 저장소를 써요"><span><span>임베딩</span><small>라우터가 비슷한 뜻도 찾게</small></span>
                    <span class="na_cfg_val"><select id="na_emb_src" class="text_pole">${Object.entries(EMBED_SOURCES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                  <label class="na_set_row" id="na_emb_pick_row" hidden><span><span>임베딩 모델</span><small id="na_emb_pick_sub"></small></span><span class="na_cfg_val"><select id="na_emb_pick" class="text_pole"></select>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                  <label class="na_set_row" id="na_emb_model_row" hidden><span><span>모델 이름</span><small>직접 입력</small></span><span class="na_cfg_val"><input type="text" id="na_emb_model" class="text_pole" spellcheck="false">${svgA(ICO_A.right, 15, 2.2)}</span></label>
                  <label class="na_set_row" id="na_emb_region_row" hidden title="Vertex 임베딩 모델은 지역마다 다르게 있어요 · global에서 500이 나면 us-central1"><span><span>임베딩 지역</span><small id="na_emb_region_sub">비우면 실리태번 Vertex 설정 지역</small></span><span class="na_cfg_val"><input type="text" id="na_emb_region" class="text_pole" spellcheck="false" placeholder="us-central1">${svgA(ICO_A.right, 15, 2.2)}</span></label>
                  <label class="na_set_row" id="na_emb_url_row" hidden><span><span>Ollama 주소</span></span><span class="na_cfg_val"><input type="text" id="na_emb_url" class="text_pole" spellcheck="false" placeholder="http://127.0.0.1:11434">${svgA(ICO_A.right, 15, 2.2)}</span></label>
                  <button type="button" class="na_set_row na_cfg_go" id="na_emb_build" hidden><span><span>임베딩 색인 만들기</span><small id="na_emb_sub">처음 한 번 · 이 채팅의 섹션</small></span>${svgA(ICO_A.right, 15, 2.2)}</button>
                  <label class="na_set_row"><span><span>키워드 연동</span><small>최근 메시지에서 찾을 범위 · 연동 <span id="na_linked_n">0</span>개</small></span><span class="na_cfg_val"><span>최근&nbsp;</span><input type="number" id="na_link_depth" class="text_pole" min="1" max="50"><span>개</span>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                  <button type="button" class="na_set_row na_cfg_go" id="na_kw_test"><span><span>키워드 테스트</span><small>문장을 넣어 어떤 섹션이 불려 오는지</small></span>${svgA(ICO_A.right, 15, 2.2)}</button>
                  <details class="na_cfg_fold" id="na_pm_fold">
                    <summary class="na_set_row"><span>고정 · 꺼 둔 섹션</span><span class="na_cfg_val"><span>고정 <span id="na_pinned_n">0</span> · 꺼짐 <span id="na_muted_n">0</span></span><span class="na_cfg_chev">${svgA(ICO_A.right, 15, 2.2)}</span></span></summary>
                    <div class="na_set_row na_cfg_sub"><span><span>고정 풀기</span><small>망각 곡선에서 늘 원문으로 둔 섹션</small></span><button type="button" class="na_btn na_small" id="na_unpin_all">모두 풀기</button></div>
                    <div class="na_set_row na_cfg_sub"><span><span>꺼 둔 섹션 켜기</span><small>주입에서 뺀 섹션</small></span><button type="button" class="na_btn na_small" id="na_unmute_all">모두 켜기</button></div>
                  </details>
                </div>
                </div>
              </div>
              <div class="na_cfg_grp" data-g="aimodel" title="질문 · 키워드 제안 · 점검 · 라우터에 쓰는 모델이에요. 임베딩은 호출에 있어요. AI는 답하고 검사만 하고, 아카이브는 직접 고쳐요.">
                <div class="na_cfg_label"><i class="fa-solid fa-robot"></i> AI 모델</div>
                <div class="na_cfg_box">
                <div class="na_set_list">
                  <label class="na_set_row" title="연결 프로필 · 커스텀 API · Vertex를 고르면 RP 모델과 따로 쓸 수 있어요"><span><span>AI 기능 모델</span><small>질문 · 점검 · 라우터 · 온도 · 지문</small></span><span class="na_cfg_val"><select id="na_ai_profile" class="text_pole"></select>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                </div>
                ${connCfgHtml('ai')}
                <div class="na_set_list">
                  <label class="na_set_row" title="번역(한국어로 보기 · 한국어로 읽기 · 용어집)은 보통 이 모델로 해요 · 양이 많아서 싸고 빠른 모델로 따로 돌리고 싶을 때만 켜요"><span><span>번역은 다른 모델로</span><small>끄면 위 AI 기능 모델로 번역해요</small></span><input type="checkbox" id="na_tr_own" class="na_toggle"></label>
                  <label class="na_set_row" id="na_tr_mode_row" hidden><span><span>번역 모델</span><small>한국어로 보기 · 읽기 · 용어집</small></span>
                    <span class="na_cfg_val"><select id="na_tr_mode" class="text_pole">
                      <option value="custom">커스텀 API</option>
                      <option value="vertex">Gemini · Vertex AI</option>
                    </select>${svgA(ICO_A.right, 15, 2.2)}</span>
                  </label>
                </div>
                ${connCfgHtml('tr')}
                <div class="na_set_list">
                  <label class="na_set_row" title="압축 초안처럼 아카이브에 들어갈 글을 써 주는 모델이에요 (예: Opus). 정하지 않으면 초안 버튼이 안 보여요"><span><span>초안 모델</span><small>압축 초안 · 섹션 짧은 버전</small></span>
                    <span class="na_cfg_val"><select id="na_dr_mode" class="text_pole">
                      <option value="same">쓰지 않음</option>
                      <option value="custom">커스텀 API</option>
                      <option value="vertex">Gemini · Vertex AI</option>
                    </select>${svgA(ICO_A.right, 15, 2.2)}</span>
                  </label>
                </div>
                ${connCfgHtml('dr')}
                <div class="na_set_list na_dr_max_row" id="na_dr_max_row" hidden>
                  <label class="na_set_row"><span><span>압축할 때 생각</span><small>압축 · 원문 보고 다시 쓰기만 · 답 한도 32,000</small></span><span class="na_cfg_val"><select class="text_pole na_cc_sel" id="na_dr_ceffort"><option value="high">높게 (high)</option><option value="medium">보통 (medium)</option><option value="low">낮게 (low)</option><option value="conn">위 연결의 생각 그대로</option></select></span></label>
                  <label class="na_set_row"><span><span>초안 최대 길이</span><small>초안이 끊기면 늘려 주세요</small></span><span class="na_cfg_val"><input type="number" id="na_dr_max" class="text_pole" min="1024" step="1024"><span class="na_cfg_unit">&nbsp;토큰</span>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                </div>
                <div class="na_set_list">
                  <label class="na_set_row" title="답이 잘리면 늘려 주세요"><span>답 최대 길이</span><span class="na_cfg_val"><input type="number" id="na_ai_max" class="text_pole" min="256" step="256"><span class="na_cfg_unit">&nbsp;토큰</span>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                </div>
                <small class="na_dim na_conn_note" id="na_conn_note" hidden>키는 이 기기의 실리태번 설정에만 저장돼요. Vertex는 실리태번에 저장한 서비스 계정 JSON을 써요. 아카이브 백업에는 안 들어가요.</small>
                </div>
              </div>
              <div class="na_cfg_grp" data-g="aitask" title="AI 기능 모델이 하는 일 · 막혔을 때 · 로어북 · 이탈 감지 · 용어집">
                <div class="na_cfg_label"><i class="fa-solid fa-wand-magic-sparkles"></i> AI가 하는 일</div>
                <div class="na_cfg_box">
                <div class="na_set_list">
                  <label class="na_set_row" title="모델이 거절하거나 안전 필터에 막히면 다른 모델로 한 번 더 보내요 · 거절한 답은 아카이브에 안 넣어요 · 압축은 막힌 구간을 반으로 나눠 다시 보내요"><span><span>막혔을 때</span><small>거절이나 차단이면 다른 모델로</small></span>
                    <span class="na_cfg_val"><select id="na_fallback" class="text_pole"><option value="">다시 안 보냄</option><option value="ai">AI 기능 모델로</option><option value="dr">초안 모델로</option></select>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                  <label class="na_set_row" title="이 채팅이 쓰는 로어북에서 키워드가 맞는 항목을 압축 · 이탈 감지 · 질문 · 말투 지문에 같이 보내요 · 그만큼 보낼 양이 늘어요"><span><span>로어북 곁들이기</span><small id="na_lore_sub">이름 · 장소 · 설정이 로어북과 맞게</small></span><input type="checkbox" id="na_lore" class="na_toggle"></label>
                  <label class="na_set_row" id="na_lore_budget_row"><span><span>로어북 한도</span><small>한 번에 보낼 항목 양</small></span><span class="na_cfg_val"><input type="number" id="na_lore_budget" class="text_pole" min="300" max="12000" step="500"><span class="na_cfg_unit">&nbsp;토큰</span>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                  <label class="na_set_row" title="AI 답이 이만큼 쌓일 때마다 조용히 검사하고, 어긋나면 알려 줘요 · 그때마다 토큰이 들어가요"><span><span>이탈 자동 감지</span><small>AI 답이 쌓이면 조용히 검사</small></span>
                    <span class="na_cfg_val"><select id="na_drift_auto" class="text_pole"><option value="0">끄기</option><option value="5">답 5개마다</option><option value="10">답 10개마다</option><option value="20">답 20개마다</option></select>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                  <label class="na_set_row" title="근거 글을 아카이브에서 못 찾은 경고만 AI 기능 모델에 한 번 더 물어봐요 · 그럴 때만 비용이 들어요"><span><span>못 찾은 근거 다시 묻기</span><small>이탈 감지 · 헛경고와 놓친 경고 줄이기</small></span><input type="checkbox" id="na_drift_recheck" class="na_toggle"></label>
                  <button type="button" class="na_set_row na_cfg_go" id="na_gloss_edit" title="이름·장소의 한국어 표기를 정해 두면 번역이 늘 그대로 써요"><span><span>번역 용어집</span><small>이름·장소 한국어 표기</small></span><span class="na_cfg_val"><span><span id="na_gloss_n">0</span>개</span>${svgA(ICO_A.right, 15, 2.2)}</span></button>
                </div>
                </div>
              </div>
              <div class="na_cfg_grp" data-g="theme">
                <div class="na_cfg_label"><i class="fa-solid fa-palette"></i> 테마</div>
                <div class="na_cfg_box na_theme_pick" role="radiogroup" aria-label="테마">
                  <label class="na_theme_opt" title="실리태번 테마와 상관없이 크림색 배색"><input type="radio" name="na_ui_theme" value="light"><span class="na_theme_sw light" aria-hidden="true"></span><span class="na_theme_txt"><b>라이트</b><small>크림 · 갈색 글씨</small></span></label>
                  <label class="na_theme_opt" title="실리태번 테마와 상관없이 짙은 밤색 배색"><input type="radio" name="na_ui_theme" value="dark"><span class="na_theme_sw dark" aria-hidden="true"></span><span class="na_theme_txt"><b>다크</b><small>밤색 · 크림 글씨</small></span></label>
                </div>
              </div>
              <div class="na_cfg_grp" data-g="alert">
                <div class="na_cfg_label"><i class="fa-solid fa-bell"></i> 알림</div>
                <div class="na_cfg_box">
                <div class="na_set_list">
                  <label class="na_set_row" title="0이나 빈칸이면 알리지 않아요"><span><span>백업 알림</span><small>백업 뒤 이만큼 바뀌면</small></span><span class="na_cfg_val"><input type="number" id="na_backup_every" class="text_pole" min="0" max="999" placeholder="끔"><span class="na_cfg_unit">번</span>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                </div>
                </div>
              </div>
            </section>

            <div class="na_nochat" id="na_nochat" hidden>채팅을 열면 이 채팅의 아카이브가 보여요.</div>
          </div>
        </div>
      </div>
    </div>`;
    $('#extensions_settings2').append(html);
    bindPanel();
    showTab(globalSettings().lastTab || 'home');
}

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

// ⚙ 설정: a card per group up top; tapping one shows that group alone
const CFG_GROUPS = [
    ['inject', '주입', 'M12 3v12M7 10l5 5 5-5M5 21h14'],
    ['call', '호출', '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'],
    ['aimodel', 'AI 모델', '<rect x="4" y="6" width="16" height="12" rx="3"/><path d="M9 11h.01M15 11h.01M9 15h6"/>'],
    ['aitask', 'AI가 하는 일', 'M12 3l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z'],
    ['theme', '테마', '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/>'],
    ['alert', '알림', 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0'],
];
let cfgView = '';
const cfgTab = {}; // group → open tab

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
            ['AI 라우터', rm === 'off' ? '끔' : rm === 'old' ? 'AI가 전부' : '키워드 + AI', rm === 'off' ? '키워드만' : `한 번에 ${val('na_router_max')}개`, rm !== 'off', 'router'],
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
function tagCfgTabs() {
    for (const [g, def] of Object.entries(CFG_TABS)) {
        let cur = def.tabs[0][0];
        for (const el of cfgUnits(g)) {
            const mark = def.marks.find(([sel]) => $(el).is(sel) || $(el).find(sel).length);
            if (mark) cur = mark[1];
            el.dataset.t = cur;
        }
    }
}
function renderCfgTiles() {
    const def = CFG_TABS[cfgView];
    const q = String($('#na_cfg_q').val() || '').trim();
    $('#na_cfg_tiles, #na_cfg_tabs').prop('hidden', !def || !!q);
    if (!def || q) return;
    const tab = cfgTab[cfgView] || def.tabs[0][0];
    $('#na_cfg_tiles').html(cfgTiles(cfgView).map(([lab, v, note, on, t]) => `<button type="button" class="na_cfg_tile${on ? ' on' : ''}${t === tab ? ' cur' : ''}" data-t="${t}"><small>${esc(lab)}</small><b>${esc(v || '-')}</b><span>${esc(note || '')}</span></button>`).join(''));
    $('#na_cfg_tabs').html(def.tabs.map(([k, name]) => `<button type="button" class="na_cfg_tabbtn${k === tab ? ' on' : ''}" role="tab" aria-selected="${k === tab}" data-t="${k}">${name}</button>`).join(''));
}
function applyCfgTab() {
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
function layoutCfg() {
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
let embTyping = false; // 직접 입력 picked: keep the name box open
function syncEmbedRows() {
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
    $('#na_emb_sub').text(err ? `안 됨: ${err.slice(0, 80)} · 눌러서 다시` : st?.synced ? `${embedLabel()} · 섹션 조각 ${st.secs} · ${timeLabel(st.at)}` : `${embedLabel()} · 처음 한 번 만들어요 · 답할 때 알아서도 만들어요`);
}

// 압축 탭: picked method, and only the rows that method uses
const CP_METHODS = { quick: '한 번에', studio: '작업실', wizard: '마법사' };
const cpMethod = () => (globalSettings().cpMethod in CP_METHODS ? globalSettings().cpMethod : 'quick');
function layoutCp() {
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
    if (tab === 'config') { cfgView = ''; renderAiSettings(); layoutCfg(); }
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

// 시작하기: three steps for a first-time user (four when 주입 is off), ticked by what the extension can see. Gone once all four have been
// done in some chat (or 숨기기), so people who already use it never see it again.
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
// once per install: if any character's chat already holds an archive, this person is no beginner. SillyTavern hands
// out each chat's first line (where the archive lives) without loading the chat; the scan stops at the first one found
let startScan = null;
let startScanFailed = false; // a scan that failed is not tried again until the next load; the card shows meanwhile
async function scanForArchive() {
    const g = globalSettings();
    // the open chat is judged only as it is now: a first compression made while the scan runs must not count
    const openChat = hasChat() ? `${currentChatId()}.jsonl` : '';
    const openChar = ctx().characters?.[ctx().characterId]?.avatar;
    try {
        if (hasChat() && getMeta().text.trim()) g.startDone = true;
        // six characters at a time, so a big library is looked through in a few seconds
        const chars = (ctx().characters || []).filter(ch => ch?.avatar);
        const holds = async ch => {
            const r = await fetch('/api/characters/chats', { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify({ avatar_url: ch.avatar, metadata: true }) });
            if (!r.ok) throw new Error(`chats ${r.status}`);
            const list = await r.json();
            return Array.isArray(list) && list.some(x => !(ch.avatar === openChar && x?.file_name === openChat) && String(x?.chat_metadata?.[MODULE]?.text || '').trim());
        };
        for (let i = 0; i < chars.length && !g.startDone; i += 6) {
            if ((await Promise.all(chars.slice(i, i + 6).map(holds))).some(Boolean)) g.startDone = true;
        }
        g.startScanned = true;
        saveGlobal();
    } catch (e) { console.warn('[narrative-archive] archive scan', e); startScanFailed = true; }
    startScan = null;
    refreshStatus();
}
function goStart(key) {
    if (key === 'model' || key === 'inject') {
        showTab('config');
        cfgView = key === 'model' ? 'aimodel' : 'inject';
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
function renderStart(m) {
    const g = globalSettings();
    // 주입 is on in a new chat, so its step only shows for someone who turned it off
    const steps = START_STEPS.filter(x => x.key !== 'inject' || !m.enabled);
    const done = steps.map(x => !!x.done(m));
    if (!g.startDone && done.every(Boolean)) { g.startDone = true; saveGlobal(); }
    // stay hidden until the one-time look through the other chats is over
    if (!g.startDone && !g.startScanned && !startScanFailed) { startScan ||= scanForArchive(); $('#na_start').prop('hidden', true); return false; }
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

export function bindPanel() {
    const $p = $('#na_settings');

    $p.find('.na_nav_btn').on('click', function () { showTab($(this).data('tab')); });
    bindPromptSettings();
    $('#na_gear').on('click', () => showTab($('[data-pane="config"]').prop('hidden') ? 'config' : (globalSettings().lastTab || 'home')));
    $('#na_cfg_back').on('click', () => { if (cfgView && !$('#na_cfg_q').val()) { cfgView = ''; layoutCfg(); } else showTab(globalSettings().lastTab || 'home'); });
    tagCfgTabs();
    $('#na_cfg_tiles, #na_cfg_tabs').on('click', '[data-t]', function () { cfgTab[cfgView] = this.dataset.t; renderCfgTiles(); applyCfgTab(); });
    // tiles follow every change made below them
    $('#na_settings .na_tab_pane[data-pane="config"]').on('change click', '.na_cfg_grp', () => { if (cfgView) setTimeout(renderCfgTiles, 0); });
    $('#na_cfg_index').on('click', '.na_cfg_card', function () { cfgView = this.dataset.g; layoutCfg(); $('#na_settings .na_tab_pane[data-pane="config"]').scrollTop(0); });
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
    $('#na_start').on('click', '.na_start_step', function () { startPick = Number(this.dataset.i); renderStart(getMeta()); })
        .on('click', '.na_start_go', function () { startPick = null; goStart(this.dataset.key); })
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
    $('#na_worlds').on('click', needChat(openWorlds));
    $('#na_au').on('click', needChat(async () => { await openAuSettings(); syncPanel(); }));

    // --- editor
    const $ed = $('#na_editor');
    let tokTimer;
    const updateEdTok = () => {
        clearTimeout(tokTimer);
        tokTimer = setTimeout(async () => $('#na_ed_tok').text(`${fmt(await countTokens($ed.val()))} 토큰`), 500);
    };
    const setDirty = v => { editorDirty = v; $('#na_ed_dirty').prop('hidden', !v); };
    $ed.on('input', () => { setDirty(hasChat() && $ed.val() !== getMeta().text); updateEdTok(); });
    $ed.on('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); $('#na_ed_save').trigger('click'); }
    });
    $('#na_ed_save').on('click', needChat(async () => {
        if (editorBase !== null && getMeta().text !== editorBase && !await confirm('다른 곳에서 바뀌었어요', '편집칸을 연 뒤에 아카이브가 다른 곳(추가·섹션 카드 편집·마법사 등)에서 바뀌었어요. 지금 편집칸 내용으로 저장하면 그 변경이 사라져요. 그래도 저장할까요? 지금 내용은 복구 지점에 남아요.')) return;
        editorDirty = false;
        const changed = await commitText($ed.val(), '본문 저장 전');
        editorBase = getMeta().text;
        setDirty(false);
        toastr.success(changed ? '아카이브 저장됨' : '바뀐 내용이 없어요');
    }));
    $('#na_ed_revert').on('click', needChat(() => {
        editorBase = getMeta().text; $ed.val(editorBase); setDirty(false); updateEdTok();
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
    $('#na_open_keeps').on('click', needChat(openKeeps));
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
    refreshReplace = renderReplace;
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
        editorDirty = false;
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
        editorDirty = false;
        if (json) {
            const d = json.data;
            for (const k of SETTING_KEYS) if (Object.hasOwn(d, k)) m[k] = d[k];
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
    $('#na_fade_more').on('click', e => { e.preventDefault(); e.stopPropagation(); cfgFadeOpen = !cfgFadeOpen; syncPanel(); });
    $('#na_fade_full').on('change', needChat(e => setFade({ full: Math.max(0, parseInt(e.target.value, 10) || 0) })));
    $('#na_fade_short').on('change', needChat(e => setFade({ short: Math.max(0, parseInt(e.target.value, 10) || 0) })));
    $('#na_fade_opts').on('click', '.na_fd_btn', needChat(e => { const f = e.currentTarget.dataset.f; const cur = fadeCfg(getMeta())[f]; setFade({ [f]: Math.max(0, cur + Number(e.currentTarget.dataset.d)) }); }));
    $('#na_fade_pick').on('click', needChat(async () => { await openFadePicker(); syncPanel(); }));
    $('#na_fade_fill').on('click', needChat(e => { if (!draftReady() && !fadeFilling) return toastr.info('⚙ 설정 → AI 모델 → 초안 모델을 먼저 정해 주세요. 섹션 카드의 버전 버튼에서 직접 붙여넣을 수도 있어요.'); fillFade($(e.currentTarget)); }));
    $('#na_router_test').on('click', needChat(async e => {
        const m = getMeta();
        const st = await withSpinner($(e.currentTarget), '고르는 중…', () => runRouter(m, { force: true }));
        if (!st) return;
        await applyInjection(); syncPanel();
        toastr.info(st.titles.length ? st.titles.map(t => `• ${esc(t.slice(0, 60))}`).join('<br>') : '고른 섹션이 없어요', `라우터 · ${st.titles.length}개 · ${(st.ms / 1000).toFixed(1)}초${st.short && st.short < st.cands ? ` · 후보 ${st.cands}개 중 ${st.short}개 자세히` : ''}`, { escapeHtml: false, timeOut: 10000 });
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
    $('#na_emb_src').on('change', function () { embTyping = false; setEmbed({ source: this.value, model: '' }); syncEmbedRows(); if (this.value) $('#na_emb_build').trigger('click'); });
    $('#na_emb_model').on('change', function () { setEmbed({ model: this.value.trim() }); syncEmbedRows(); });
    $('#na_emb_pick').on('change', function () {
        embTyping = !this.value;
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

export let cfgFadeOpen = false;
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
    $('#na_position').val(String(m.position));
    $('#na_depth').val(m.depth);
    $('#na_depth_field').prop('hidden', Number(m.position) !== 1);
    $('#na_role').val(String(m.role));
    $('#na_muted_n').text(mutedCount(m));
    $('#na_link_depth').val(m.linkDepth || 4);
    { const kn = keepsOf(m).length; $('#na_keeps_sub').text(kn ? `${kn}개 · 압축할 때 자세히, 망각 곡선은 그대로` : '압축할 때 자세히 남길 구간과 그 이유'); }
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
    $('#na_router_keep_row').toggle(rc.mode === 'old');
    $('#na_router_max').val(rc.max); $('#na_router_keep').val(rc.keep); $('#na_router_follow').prop('checked', rc.follow);
    {
        const fc = fadeCfg(m);
        $('#na_fade').prop('checked', fc.on); $('#na_fade_opts').prop('hidden', !fc.on || !cfgFadeOpen);
        $('#na_fade_more').prop('hidden', !fc.on).toggleClass('on', cfgFadeOpen);
        const fadeSub = pct => fc.on ? `원문 ${fc.full} · 짧게 ${fc.short} · 나머지 한 줄${pct ? ` · 지금 −${pct}%` : ''}` : '오래된 섹션은 짧은 버전·한 줄로';
        $('#na_fade_sub').text(fadeSub(0));
        $('#na_fade_full').val(fc.full); $('#na_fade_short').val(fc.short);
        { const fn = Object.keys(fadeForce(m)).length; $('#na_fade_pick_sub').text(fn ? `직접 고른 섹션 ${fn}개 · 망각 곡선보다 먼저` : '여러 섹션을 골라 원문 · 짧게 · 한 줄로'); }
        if (fc.on) {
            const plan = [...fadePlan(m).values()];
            const miss = fadeMissing(m).length, more = fadeMissing(m, true).length - miss;
            if (!fadeFilling) $('#na_fade_info').html(miss ? `버전 없는 섹션 <b>${miss}</b>개 · 지금은 원문으로 들어가요` : more ? `필요한 버전은 다 있어요 · 나머지 <b>${more}</b>개도 채울 수 있어요` : '모든 섹션에 버전이 있어요');
            $('#na_fade_lines').text(`${plan.filter(p => p.want === 'line').length}개`);
            // one bar per numbered section, oldest first: tall = whole, mid = short, low = one line
            $('#na_fade_strip').html(plan.map(p => { const use = fadeUse(m, m.text, p.s, p.want); const k = p.why === 'pin' || p.why === 'star' ? 'pin' : use !== p.want && p.want !== 'long' ? 'miss' : use; return `<span class="${k}" title="${esc(p.s.title)}"></span>`; }).join(''));
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
    $('#na_router_info').text(rs ? `마지막: ${rs.titles.length}개 · ${rs.via === 'index' ? `색인으로 (${rs.why || 'AI 안 됨'})` : `${(rs.ms / 1000).toFixed(1)}초`} · 후보 ${rs.cands}개${rs.short && rs.short < rs.cands ? ` 중 ${rs.short}개 자세히` : ''}` : `후보 ${routerCandidates(m).length}개 · 최근 대화로 한 번 골라 봐요`);
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
        $('#na_au_sub').text(au.on ? `켜짐 · 요약이 본편 뒤 ${au.name} 묶음으로 이어져요` : '본편 기억을 들고 온 채팅이면 켜요');
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

