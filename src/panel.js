// The side panel: markup, event wiring (bindPanel) and refresh (syncPanel).

import { aiLabel, aiProfiles, askAI, askDraft, connSettings, drLabel, draftReady, draftSettings, parseServiceAccount, trLabel, trSettings, vxTokens, withSpinner } from './ai.js';
import { openAppend } from './append.js';
import { openAsk } from './ask.js';
import { branchState, openBranches } from './branches.js';
import { mountSectionBrowser } from './browser.js';
import { openCalendar } from './calendar.js';
import { carryOffer, currentChatId, importArchive, openChatPicker, pickFromBundle, rememberArchive, setCarryOffer } from './chats.js';
import { POSITIONS, ROLES, SETTING_KEYS, SNAPSHOT_MAX, VERSION, commitText, ctx, getMeta, globalSettings, hasChat, pushSnapshot, saveGlobal, saveMeta } from './core.js';
import { openCompare, openDiff } from './diff.js';
import { openDrift } from './drift.js';
import { guessEndNumber, openExtract } from './extract.js';
import { fadeCfg, fadeFilling, fadeMissing, fadePlan, fadeUse, fillFade } from './fade.js';
import { openHealth } from './health.js';
import { applyHide, lastIndex, openUnhide, syncTrackedBoundary } from './hide.js';
import { applyInjection, lastBuild } from './inject.js';
import { openKeywordTest } from './keywords.js';
import { knowledgeRows, openKnowledge } from './knowledge.js';
import { openPeople } from './people.js';
import { openPreview } from './preview.js';
import { bindPromptSettings } from './prompts.js';
import { openQuotes } from './quotes.js';
import { openReader } from './reader.js';
import { routerCandidates, routerCfg, routerState, runRouter } from './router.js';
import { cachedTokens, checkHeadings, filterMuted, groupLabel, linkedMap, mutedCount, parseSections, pinnedSet, sectionKey } from './sections.js';
import { refreshStatus } from './status.js';
import { ICO_A, setUiTheme, svgA, uiTheme } from './theme.js';
import { AI_SYS_TRANSLATE, askTranslator, glossaryEntries, openGlossary } from './translate.js';
import { chatLabel, confirm, copyText, countTokens, download, esc, escRe, fmt, nowStamp, timeLabel } from './util.js';
import { openWizard } from './wizard.js';
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
                <span class="na_meter_total" id="na_meter_total">-</span>
                <span class="na_meter_state" id="na_meter_state"></span>
                <span class="na_spacer"></span>
                <button type="button" class="na_hchip" id="na_health" title="건강 점검"><i class="fa-solid fa-stethoscope"></i> <span>-</span></button>
                <button type="button" class="na_icon" id="na_gear" title="설정"><i class="fa-solid fa-gear"></i></button>
              </div>
              <div class="na_meter_bar"><span class="na_seg_arc"></span><span class="na_seg_raw"></span></div>
              <div class="na_meter_legend" id="na_meter_legend"></div>
            </div>

            <nav class="na_nav" role="tablist">
              <button type="button" class="na_nav_btn active" data-tab="home">홈</button>
              <button type="button" class="na_nav_btn" data-tab="archive">아카이브</button>
              <button type="button" class="na_nav_btn" data-tab="compress">압축</button>
              <button type="button" class="na_nav_btn" data-tab="tools">도구</button>
            </nav>

            <!-- 홈 -->
            <section class="na_tab_pane" data-pane="home">
              <div class="na_next" id="na_next"></div>
              <div class="na_quick">
                <button type="button" class="na_qbtn" id="na_q_read"><i class="fa-solid fa-book-open-reader"></i><span>읽기</span></button>
                <button type="button" class="na_qbtn" id="na_q_ask"><i class="fa-regular fa-comments"></i><span>질문</span></button>
                <button type="button" class="na_qbtn" id="na_q_wizard"><i class="fa-solid fa-wand-magic-sparkles"></i><span>압축</span></button>
                <button type="button" class="na_qbtn" id="na_q_preview"><i class="fa-regular fa-eye"></i><span>미리보기</span></button>
              </div>
              <div class="na_block na_ai_row3">
                <div class="na_kw_label">AI 도구</div>
                <button type="button" class="na_toolrow" id="na_drift"><i class="fa-solid fa-route"></i><span><b>이탈 감지</b><small id="na_drift_sub">최근 대화가 아카이브와 어긋나는지</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_know"><i class="fa-solid fa-user-secret"></i><span><b>누가 아는가</b><small id="na_know_sub">비밀마다 아는 사람·모르는 사람</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_quotes"><i class="fa-solid fa-quote-left"></i><span><b>대사 은행</b><small id="na_quotes_sub">대사를 모아 말투 지문으로</small></span><i class="fa-solid fa-chevron-right"></i></button>
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
                  <button type="button" class="na_cp_wiz" id="na_open_wizard">${svgA('M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M15 9h0M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5', 22)}<span><b>압축 마법사</b><small>뽑기 → 복사 → 붙여넣기 → 채점 → 추가</small></span>${svgA(ICO_A.right, 18, 2.2)}</button>
                </div>
                <div class="na_cp_tiles">
                  <button type="button" class="na_cp_tile" id="na_apply_hide"><span class="na_cp_ico">${svgA('M17.9 17.9A10 10 0 0 1 12 20c-7 0-10-8-10-8a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.2M1 1l22 22', 17)}</span><b>숨기기 다시 적용</b><small>경계선 앞만 숨기고 뒤는 보이게</small></button>
                  <button type="button" class="na_cp_tile" id="na_unhide"><span class="na_cp_ico">${svgA('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>', 17)}</span><b>숨김 해제</b><small id="na_hidden_n">숨긴 메시지 다시 보이게</small></button>
                </div>
                <div class="na_v2_label">따로 하기</div>
                <div class="na_v2_card na_v2_list">
                  <button type="button" class="na_cp_row" id="na_open_extract"><span class="na_cp_num">1</span><span class="na_cp_txt"><b>원문 뽑기</b><small>경계선 이후 메시지 · 지시문 붙여 복사</small></span>${svgA(ICO_A.right, 16, 2.2)}</button>
                  <button type="button" class="na_cp_row" id="na_open_append"><span class="na_cp_num">2</span><span class="na_cp_txt"><b>아카이브에 추가</b><small>압축본 붙여넣기 · 번호 검사 · 경계선 자동</small></span>${svgA(ICO_A.right, 16, 2.2)}</button>
                </div>
                <div class="na_v2_label">설정</div>
                <div class="na_v2_card na_v2_list na_cp_set">
                  <label class="na_cp_row"><span class="na_cp_txt"><span>숨긴 메시지 빼고 뽑기</span></span><input type="checkbox" class="na_toggle" id="na_opt_hidden"></label>
                  <div class="na_strip_box">
                    <label class="na_cp_row"><span class="na_cp_txt"><span>태그 지우기</span><small id="na_strip_sub">&lt;think&gt; 통째로 · 나머지 태그는 글자만</small></span><input type="checkbox" class="na_toggle" id="na_opt_tags"></label>
                    <div class="na_cp_sub">
                      <textarea class="text_pole na_strip_ta" id="na_strip_custom" rows="2" spellcheck="false" placeholder="통째로 지울 태그나 /정규식/, 한 줄에 하나&#10;scene_plan"></textarea>
                      <small class="na_strip_info" id="na_strip_info"></small>
                    </div>
                  </div>
                  <details class="na_cp_fold" id="na_cmp_settings">
                    <summary class="na_cp_row"><span class="na_cp_txt"><span>압축 지시문</span><small id="na_plib_sum">이 기기의 실리태번 설정에만 저장돼요</small></span><span class="na_cp_more">편집</span><span class="na_cp_chev">${svgA(ICO_A.right, 16, 2.2)}</span></summary>
                    <div class="na_cp_sub"><div class="na_plib" id="na_plib"></div></div>
                  </details>
                  <label class="na_cp_row"><span class="na_cp_txt"><span>아카이브 따라가기</span><small id="na_track_info">마지막 제목 번호가 곧 경계선</small></span><input type="checkbox" id="na_track" class="na_toggle"></label>
                  <label class="na_cp_row" id="na_boundary_row" title="여기까지 아카이브에 담겼어요"><span class="na_cp_txt"><span>경계선 번호</span></span><span class="na_cp_hash"><span>#</span><input type="number" id="na_boundary" class="text_pole na_cp_num_in" min="0" placeholder="-"></span></label>
                  <div class="na_cp_row na_cp_keep_row"><span class="na_cp_txt"><span>숨길 때 남길 메시지</span><small>경계선 바로 앞 몇 개는 보이게</small></span><span class="na_fd_step na_cp_step"><button type="button" class="na_fd_btn na_keep_btn" data-d="-1" aria-label="줄이기">−</button><input type="number" id="na_keep" class="text_pole" min="0" max="50"><button type="button" class="na_fd_btn na_keep_btn" data-d="1" aria-label="늘리기">+</button></span></div>
                </div>
              </div>
            </section>

            <!-- 도구 -->
            <section class="na_tab_pane" data-pane="tools" hidden>
              <div class="na_block">
                <div class="na_kw_label">이야기</div>
                <button type="button" class="na_toolrow" id="na_worlds"><i class="fa-solid fa-earth-asia"></i><span><b>세계관 공유</b><small id="na_worlds_sub">여러 채팅이 같이 쓰는 설정 · 고치면 모든 채팅에 반영</small></span><i class="fa-solid fa-chevron-right"></i></button>
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
                  <button type="button" class="na_tile" id="na_export"><i class="fa-solid fa-file-lines"></i><span>.txt 내보내기</span><small>본문만</small></button>
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
              <div class="na_cfg_head"><button type="button" class="na_cfg_back" id="na_cfg_back" title="돌아가기" aria-label="돌아가기">${svgA(ICO_A.left, 18, 2.2)}</button><b>설정</b><button type="button" class="na_cfg_pill" id="na_cfg_preview">주입 미리보기</button></div>
              <div class="na_cfg_grp">
                <div class="na_cfg_label"><i class="fa-solid fa-palette"></i> 테마</div>
                <div class="na_cfg_box na_theme_pick" role="radiogroup" aria-label="테마">
                  <label class="na_theme_opt" title="실리태번 테마와 상관없이 크림색 배색"><input type="radio" name="na_ui_theme" value="light"><span class="na_theme_sw light" aria-hidden="true"></span><span class="na_theme_txt"><b>라이트</b><small>크림 · 갈색 글씨</small></span></label>
                  <label class="na_theme_opt" title="실리태번 테마와 상관없이 짙은 밤색 배색"><input type="radio" name="na_ui_theme" value="dark"><span class="na_theme_sw dark" aria-hidden="true"></span><span class="na_theme_txt"><b>다크</b><small>밤색 · 크림 글씨</small></span></label>
                </div>
              </div>
              <div class="na_cfg_grp">
                <div class="na_cfg_label"><i class="fa-solid fa-syringe"></i> 주입</div>
                <div class="na_cfg_box">
                <div class="na_set_list">
                  <label class="na_set_row"><span>아카이브 주입</span><input type="checkbox" id="na_enabled" class="na_toggle"></label>
                  <label class="na_set_row"><span>위치</span>
                    <span class="na_cfg_val"><select id="na_position" class="text_pole">${Object.entries(POSITIONS).map(([v, l]) => `<option value="${v}">${l.replace(/\s*\(깊이\)$/, '')}</option>`).join('')}</select><span class="na_cfg_depth" id="na_depth_field">&nbsp;· 깊이&nbsp;<input type="number" id="na_depth" class="text_pole" min="0" max="999" title="채팅 끝에서 몇 번째 메시지 위에 넣을지"></span>${svgA(ICO_A.right, 15, 2.2)}</span>
                  </label>
                  <label class="na_set_row"><span>역할</span>
                    <span class="na_cfg_val"><select id="na_role" class="text_pole">${Object.entries(ROLES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>${svgA(ICO_A.right, 15, 2.2)}</span>
                  </label>
                </div>
                </div>
              </div>
              <div class="na_cfg_grp" title="섹션 카드의 스위치 · 고정 · 키워드로 섹션마다 정하고, 여기선 한꺼번에 관리해요.">
                <div class="na_cfg_label"><i class="fa-solid fa-scale-balanced"></i> 분량 · 라우터</div>
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
                  <label class="na_set_row" title="답하기 직전에 작은 모델이 지금 대화에 필요한 섹션을 골라 넣어요 · 따로 연결한 모델이 필요해요"><span><span>AI 라우터</span><small>답하기 직전에 필요한 섹션을 골라요</small></span>
                    <span class="na_cfg_val"><select id="na_router_mode" class="text_pole"><option value="off">끄기</option><option value="linked">키워드에 더해 AI도</option><option value="old">오래된 섹션 전부</option></select>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                  <div class="na_router_opts" id="na_router_opts" hidden>
                    <label class="na_set_row" title="고른 섹션 본문에 &quot;#217–#236&quot;처럼 적힌 섹션도 같이 넣어요"><span><span>가리키는 섹션도 같이</span><small>고른 섹션에 적힌 #번호의 섹션</small></span><input type="checkbox" id="na_router_follow" class="na_toggle"></label>
                    <label class="na_set_row"><span><span>한 번에 최대</span><small>AI가 고를 섹션 수</small></span><span class="na_cfg_val"><input type="number" id="na_router_max" class="text_pole" min="1" max="20"><span class="na_cfg_unit">개</span>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                    <label class="na_set_row" id="na_router_keep_row"><span><span>최근 섹션은 항상</span><small>마지막 몇 개는 AI가 안 고르고 늘 넣어요</small></span><span class="na_cfg_val"><input type="number" id="na_router_keep" class="text_pole" min="0" max="20"><span class="na_cfg_unit">개</span>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                    <button type="button" class="na_set_row na_cfg_go" id="na_router_test"><span><span>지금 해 보기</span><small id="na_router_info">최근 대화로 한 번 골라 봐요</small></span>${svgA(ICO_A.right, 15, 2.2)}</button>
                  </div>
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
              <div class="na_cfg_grp" title="질문 · 키워드 제안 · 점검 · 라우터에 쓰는 모델이에요. AI는 답하고 검사만 하고, 아카이브는 직접 고쳐요.">
                <div class="na_cfg_label"><i class="fa-solid fa-robot"></i> AI · 번역</div>
                <div class="na_cfg_box">
                <div class="na_set_list">
                  <label class="na_set_row" title="연결 프로필 · 커스텀 API · Vertex를 고르면 RP 모델과 따로 쓸 수 있어요"><span><span>AI 기능 모델</span><small>질문 · 점검 · 라우터 · 온도 · 지문</small></span><span class="na_cfg_val"><select id="na_ai_profile" class="text_pole"></select>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                </div>
                ${connCfgHtml('ai')}
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
                  <label class="na_set_row"><span><span>초안 최대 길이</span><small>초안이 끊기면 늘려 주세요</small></span><span class="na_cfg_val"><input type="number" id="na_dr_max" class="text_pole" min="1024" step="1024"><span class="na_cfg_unit">&nbsp;토큰</span>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                </div>
                <div class="na_set_list">
                  <label class="na_set_row" title="비교 화면의 &quot;한국어로 보기&quot;에 써요"><span>번역 모델</span>
                    <span class="na_cfg_val"><select id="na_tr_mode" class="text_pole">
                      <option value="same">AI 기능 모델과 같이</option>
                      <option value="custom">커스텀 API</option>
                      <option value="vertex">Gemini · Vertex AI</option>
                    </select>${svgA(ICO_A.right, 15, 2.2)}</span>
                  </label>
                </div>
                ${connCfgHtml('tr')}
                <div class="na_set_list">
                  <label class="na_set_row" title="답이 잘리면 늘려 주세요"><span>답 최대 길이</span><span class="na_cfg_val"><input type="number" id="na_ai_max" class="text_pole" min="256" step="256"><span class="na_cfg_unit">&nbsp;토큰</span>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                  <label class="na_set_row" title="AI 답이 이만큼 쌓일 때마다 조용히 검사하고, 어긋나면 알려 줘요 · 그때마다 토큰이 들어가요"><span><span>이탈 자동 감지</span><small>AI 답이 쌓이면 조용히 검사</small></span>
                    <span class="na_cfg_val"><select id="na_drift_auto" class="text_pole"><option value="0">끄기</option><option value="5">답 5개마다</option><option value="10">답 10개마다</option><option value="20">답 20개마다</option></select>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                  <button type="button" class="na_set_row na_cfg_go" id="na_gloss_edit" title="이름·장소의 한국어 표기를 정해 두면 번역이 늘 그대로 써요"><span><span>번역 용어집</span><small>이름·장소 한국어 표기</small></span><span class="na_cfg_val"><span><span id="na_gloss_n">0</span>개</span>${svgA(ICO_A.right, 15, 2.2)}</span></button>
                </div>
                <small class="na_dim na_conn_note" id="na_conn_note" hidden>키와 JSON은 이 기기의 실리태번 설정에만 저장돼요. 아카이브 백업에는 안 들어가요.</small>
                </div>
              </div>
              <div class="na_cfg_grp">
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
                <div class="na_tr_cfg" id="na_${p}_custom" hidden>
                  <input type="text" class="text_pole" id="na_${p}_url" placeholder="URL (예: https://api.example.com/v1)" autocomplete="off" spellcheck="false">
                  <input type="password" class="text_pole" id="na_${p}_key" placeholder="API 키" autocomplete="off">
                  <input type="text" class="text_pole" id="na_${p}_model" placeholder="모델 이름 (예: gpt-4o-mini)" autocomplete="off" spellcheck="false">
                </div>
                <div class="na_tr_cfg" id="na_${p}_vertex" hidden>
                  <textarea class="text_pole" id="na_${p}_vxjson" rows="4" placeholder="서비스 계정 JSON (키 파일 내용을 통째로 붙여넣기)" spellcheck="false"></textarea>
                  <div class="na_tr_pair">
                    <input type="text" class="text_pole" id="na_${p}_vxloc" placeholder="리전 (예: global, us-central1)" autocomplete="off" spellcheck="false">
                    <input type="text" class="text_pole" id="na_${p}_vxmodel" placeholder="모델 (예: gemini-2.5-flash)" autocomplete="off" spellcheck="false">
                  </div>
                  <div class="na_tr_vxrow"><small class="na_dim" id="na_${p}_vxinfo"></small><button type="button" class="na_linkbtn na_danger" id="na_${p}_vxclear" hidden><i class="fa-solid fa-eraser"></i> JSON 지우기</button></div>
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
    // a saved key is never shown again; the box only takes a replacement
    $(`#na_${p}_vxjson`).val('').attr('placeholder', t.vxJson.trim() ? '저장됨 · 바꾸려면 새 JSON을 붙여넣기' : '서비스 계정 JSON (키 파일 내용을 통째로 붙여넣기)');
    $(`#na_${p}_vxclear`).prop('hidden', !t.vxJson.trim());
    $(`#na_${p}_vxloc`).val(t.vxLocation); $(`#na_${p}_vxmodel`).val(t.vxModel);
    let info = '';
    if (t.vxJson.trim()) { try { const sa = parseServiceAccount(t.vxJson); info = `프로젝트 ${sa.project_id} · ${sa.client_email}`; } catch (e) { info = e.message; } }
    $(`#na_${p}_vxinfo`).text(info);
    return own;
}

export function renderAiSettings() {
    const g = globalSettings();
    $('#na_gloss_n').text(hasChat() ? glossaryEntries(getMeta()).length : 0);
    $('#na_drift_auto').val(String(g.driftAuto || 0));
    const a = connSettings('ai');
    const profiles = aiProfiles();
    const opts = [`<option value="">지금 연결된 모델</option>`, ...profiles.map(p => `<option value="${esc(p.id)}">프로필: ${esc(p.name)}</option>`)];
    if (g.aiProfile && !profiles.some(p => p.id === g.aiProfile)) opts.push(`<option value="${esc(g.aiProfile)}">(없어진 프로필)</option>`);
    opts.push('<option value="__custom">커스텀 API (OpenAI 호환)</option>', '<option value="__vertex">Gemini · Vertex AI</option>');
    $('#na_ai_profile').html(opts.join('')).val(a.mode === 'st' ? (g.aiProfile || '') : `__${a.mode}`);
    $('#na_ai_max').val(g.aiMaxTokens || 8192);
    $('#na_tr_mode').val(trSettings().mode);
    $('#na_dr_mode').val(draftSettings().mode);
    $('#na_dr_max_row').prop('hidden', !draftReady());
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
    if (tab === 'config') renderAiSettings();
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

// the one thing worth doing next, on the home tab
export function renderNext(m, { afterTok, health }) {
    let html;
    const card = (icon, title, desc, btns, tone = '') => `<div class="na_next_card ${tone}"><i class="fa-solid ${icon}"></i><div class="na_next_main"><b>${title}</b>${desc ? `<span>${desc}</span>` : ''}</div><div class="na_next_btns">${btns}</div></div>`;
    const btn = (act, label, primary = true) => `<button type="button" class="na_btn na_small ${primary ? 'na_primary' : ''}" data-act="${act}">${label}</button>`;
    const issues = health ? health.items.filter(x => x.level === 'bad' || x.level === 'warn') : [];
    if (!m.text.trim()) html = card('fa-seedling', '아카이브가 비어 있어요', '압축 마법사로 첫 섹션을 만들거나, 다른 채팅·파일에서 가져와요.', btn('wizard', '압축 마법사') + btn('import', '가져오기', false));
    else if (!m.enabled) html = card('fa-power-off', '주입이 꺼져 있어요', '아카이브가 RP 모델에 안 들어가고 있어요.', btn('enable', '켜기'), 'warn');
    else if (issues.length) html = card('fa-stethoscope', `확인할 것 ${issues.length}개`, esc(issues[0].title), btn('health', '건강 점검'), issues.some(x => x.level === 'bad') ? 'bad' : 'warn');
    else html = card('fa-circle-check', '할 일 없어요', m.boundary >= 0 ? `경계선 #${m.boundary} 뒤 원문 ${fmt(afterTok)} 토큰` : '', '', 'ok');
    $('#na_next').html(html);
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
    $('#na_cfg_back').on('click', () => showTab(globalSettings().lastTab || 'home'));
    $('input[name="na_ui_theme"]').prop('checked', function () { return this.value === uiTheme(); })
        .on('change', function () { if (this.checked) setUiTheme(this.value); });
    $p.find('.na_seg_btn').on('click', function () { showArchiveView($(this).data('view')); });
    // home quick actions
    $('#na_q_read').on('click', needChat(openReader));
    $('#na_q_ask').on('click', needChat(openAsk));
    $('#na_q_wizard').on('click', needChat(openWizard));
    $('#na_q_preview').on('click', needChat(openPreview));
    $('#na_next').on('click', '[data-act]', function () { nextAction(this.dataset.act); });
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
    $('#na_drift_auto').on('change', function () { globalSettings().driftAuto = Number(this.value) || 0; saveGlobal(); });
    $('#na_gloss_edit').on('click', needChat(async () => { await openGlossary(); renderAiSettings(); }));
    $('#na_tr_mode').on('change', function () { trSettings().mode = this.value; saveGlobal(); renderAiSettings(); });
    $('#na_dr_mode').on('change', function () { draftSettings().mode = this.value; saveGlobal(); renderAiSettings(); });
    $('#na_dr_max').on('change', function () { const v = Math.max(1024, parseInt(this.value, 10) || 16000); draftSettings().max = v; this.value = v; saveGlobal(); });
    for (const p of ['ai', 'tr', 'dr']) {
        const field = (sel, key) => $(`#na_${p}_${sel}`).on('change', function () { connSettings(p)[key] = this.value.trim(); saveGlobal(); renderAiSettings(); });
        field('url', 'url'); field('key', 'key'); field('model', 'model'); field('vxloc', 'vxLocation'); field('vxmodel', 'vxModel');
        $(`#na_${p}_vxjson`).on('change', function () {
            if (!this.value.trim()) return;
            try { parseServiceAccount(this.value); } catch (e) { toastr.warning(e.message); return; }
            connSettings(p).vxJson = this.value.trim(); vxTokens.clear(); saveGlobal(); renderAiSettings();
        });
        $(`#na_${p}_vxclear`).on('click', () => { connSettings(p).vxJson = ''; vxTokens.clear(); saveGlobal(); renderAiSettings(); });
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
    $('#na_open_wizard').on('click', needChat(openWizard));
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
        await saveMeta(); applyInjection();
    });
    $('#na_role').on('change', async function () {
        if (!hasChat()) return;
        const m = getMeta();
        m.role = parseInt(this.value, 10) || 0; await saveMeta(); applyInjection();
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
    $('#na_fade_fill').on('click', needChat(e => { if (!draftReady() && !fadeFilling) return toastr.info('⚙ 설정 → AI · 번역 → 초안 모델을 먼저 정해 주세요. 섹션 카드의 버전 버튼에서 직접 붙여넣을 수도 있어요.'); fillFade($(e.currentTarget)); }));
    $('#na_router_test').on('click', needChat(async e => {
        const m = getMeta();
        const st = await withSpinner($(e.currentTarget), '고르는 중…', () => runRouter(m, { force: true }));
        if (!st) return;
        await applyInjection(); syncPanel();
        toastr.info(st.titles.length ? st.titles.map(t => `• ${esc(t.slice(0, 60))}`).join('<br>') : '고른 섹션이 없어요', `라우터 · ${st.titles.length}개 · ${(st.ms / 1000).toFixed(1)}초`, { escapeHtml: false, timeOut: 10000 });
    }));
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
    $('#na_router_info').text(rs ? `마지막: ${rs.titles.length}개 · ${(rs.ms / 1000).toFixed(1)}초 · 후보 ${rs.cands}개` : `후보 ${routerCandidates(m).length}개 · 최근 대화로 한 번 골라 봐요`);
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
        $('#na_know_sub').text(kn ? `${kn}개${mm.knowInject ? ' · 주입 중' : ''}` : '비밀마다 아는 사람·모르는 사람');
        const vn = Object.keys(mm.voice || {}).length;
        { const wb = worldBooks(), on = wb.filter(w => worldIsOn(mm, w)); $('#na_worlds_sub').text(wb.length ? `${wb.length}개 · 이 채팅에 ${on.length ? on.map(w => w.name).join(', ') : '없음'}` : '여러 채팅이 같이 쓰는 설정 · 고치면 모든 채팅에 반영'); }
        $('#na_quotes_sub').text((mm.quotes || []).length ? `대사 ${(mm.quotes || []).length}개${vn ? ` · 지문 ${vn}${mm.voiceInject ? ' 주입 중' : ''}` : ''}` : '대사를 모아 말투 지문으로');
        $('#na_drift_sub').text(mm.driftLast ? `${timeLabel(mm.driftLast.at)} · ${mm.driftLast.none ? '어긋남 없음' : `${mm.driftLast.n}개 찾음`}` : '최근 대화가 아카이브와 어긋나는지');
    }
    const br = hasChat() ? branchState(getMeta()) : null;
    $('#na_branch_card').prop('hidden', !br?.ahead.length);
    if (br?.ahead.length) $('#na_branch_desc').text(`이 채팅은 #${br.last}까지인데 아카이브에 그 뒤(#${br.ahead[0].from}~) 섹션 ${br.ahead.length}개가 있어요. 분기하기 전 원본의 내용이에요.`);
    $('#na_branches_sub').text(br?.parent ? `이 채팅은 분기예요 · 원본: ${br.parent}` : '원본·갈라진 채팅과 비교, 분기 정리');
    if (carryOffer) $('#na_carry_desc').text(`방금 있던 채팅의 아카이브 (${fmt(carryOffer.text.length)}자)를 이 채팅에 가져와요.`);
    rememberArchive();
    $('#na_boundary').val(m.boundary >= 0 ? m.boundary : '');
    $('#na_track').prop('checked', !!m.track);
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
export function addWandMenu() {
    const $menu = $('#extensionsMenu');
    if (!$menu.length || $('#na_wand_read').length) return;
    const items = [
        ['na_wand_read', 'fa-book-open-reader', '아카이브 읽기', openReader],
        ['na_wand_extract', 'fa-scissors', '원문 뽑기', openExtract],
        ['na_wand_append', 'fa-file-circle-plus', '아카이브에 추가', openAppend],
        ['na_wand_wizard', 'fa-wand-magic-sparkles', '압축 마법사', openWizard],
        ['na_wand_preview', 'fa-eye', '주입 미리보기', openPreview],
    ];
    for (const [id, icon, label, fn] of items) {
        const $it = $(`<div id="${id}" class="list-group-item flex-container flexGap5 interactable na_wand_item" tabindex="0" title="서사 아카이브">
            <div class="fa-solid ${icon} extensionsMenuExtensionButton"></div><span>${label}</span></div>`);
        $it.on('click', needChat(fn));
        $menu.append($it);
    }
}
