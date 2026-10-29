// The side panel's markup (renderPanel).

import { globalSettings, POSITION_ORDER, POSITIONS, ROLES, SNAPSHOT_MAX, VERSION } from './core.js';
import { EMBED_SOURCES } from './embed.js';
import { GUESS_MODES } from './guess.js';
import { showTab } from './panel.js';
import { bindPanel } from './panelbind.js';
import { CFG_GROUPS, connCfgHtml } from './panelcfg.js';
import { OFF_KINDS } from './recall.js';
import { SCENE_SIZES } from './scenes.js';
import { ICO_A, svgA } from './theme.js';
import { COMPRESS_MODES, NUDGE_CHOICES } from './wizard.js';

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
              <div class="na_anniv_now" id="na_anniv_now" hidden></div>
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
                </div>
                <div class="na_v2_label"><span>설정 <span class="na_cp_for" id="na_cp_for"></span></span></div>
                <div class="na_v2_card na_v2_list na_cp_set">
                  <label class="na_cp_row" hidden title="검사가 다 통과하면 추가 창 없이 넣고 숨겨요 · 알림에서 되돌리기 · 걸리는 게 있으면 추가 창"><span class="na_cp_txt"><span>한 번에 압축 · 바로 넣기</span><small>검사 통과하면 바로 넣기</small></span><input type="checkbox" class="na_toggle" id="na_quick_auto"></label>
                  <label class="na_cp_row" data-m="quick"><span class="na_cp_txt"><span>압축 방식</span><small id="na_cmode_sub"></small></span><select class="text_pole na_cc_sel na_cp_sel" id="na_cmode">${Object.entries(COMPRESS_MODES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
                  <label class="na_cp_row na_cmode_sc" data-m="quick studio" title="장면마다 섹션 하나씩 따로 받아요"><span class="na_cp_txt"><span>장면 크기</span><small>클수록 싸고, 작을수록 꼼꼼해요</small></span><select class="text_pole na_cc_sel na_cp_sel" id="na_scsize">${Object.entries(SCENE_SIZES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
                  <button type="button" class="na_cp_row na_cmode_sc" data-m="quick studio" id="na_stylesample"><span class="na_cp_txt"><span>문체 견본</span><small id="na_style_sub"></small></span>${svgA(ICO_A.right, 16, 2.2)}</button>
                  <button type="button" class="na_cp_row na_cmode_sc" data-m="quick studio" id="na_worknote"><span class="na_cp_txt"><span>작업 노트</span><small id="na_worknote_sub">장면마다 같이 보내요</small></span>${svgA(ICO_A.right, 16, 2.2)}</button>
                  <label class="na_cp_row" title="압축할 메시지가 이만큼 쌓이면 알림 · 누르면 압축"><span class="na_cp_txt"><span>쌓이면 알려 주기</span><small>이만큼 쌓이면 알림</small></span><select class="text_pole na_cc_sel na_cp_sel" id="na_nudge">${Object.entries(NUDGE_CHOICES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
                  <button type="button" class="na_cp_row" id="na_au" title="본편 아카이브를 들고 새 채팅에서 AU를 할 때 켜요 · 압축할 때 AU 안내가 붙어요"><span class="na_cp_txt"><span>AU 채팅</span><small id="na_au_sub">본편 기억을 들고 온 채팅이면 켜요</small></span><span class="na_cp_more" id="na_au_on" hidden>켜짐</span>${svgA(ICO_A.right, 16, 2.2)}</button>
                </div>
                <div class="na_v2_card na_v2_list na_cp_set">
                  <details class="na_cp_fold na_cp_more_fold" id="na_cp_more">
                    <summary class="na_cp_row"><span class="na_cp_txt"><span>원문 손질 · 지시문 · 경계선</span><small id="na_cp_more_sub">태그 · OOC 빼기 · 압축 지시문 · 아카이브 따라가기</small></span><span class="na_cp_more">더 보기</span><span class="na_cp_chev">${svgA(ICO_A.right, 16, 2.2)}</span></summary>
                  <label class="na_cp_row"><span class="na_cp_txt"><span>숨긴 메시지 빼고 뽑기</span></span><input type="checkbox" class="na_toggle" id="na_opt_hidden"></label>
                  <label class="na_cp_row" title="think · thinking · thought · reasoning · scene_plan · style · script와 주석은 통째로 빼고, 나머지 HTML 태그는 지우고 글자만 남겨요 · 끄면 메시지를 그대로 보내요"><span class="na_cp_txt"><span>태그 지우기</span><small>태그는 지우고 글만 남겨요</small></span><input type="checkbox" class="na_toggle" id="na_opt_tags"></label>
                  <button type="button" class="na_cp_row na_trk_row" id="na_trk_row" title="원문의 상태창에서 날짜 · 장소를 섹션 제목에 쓰고, AI가 장면을 못 나누면 상태창이 바뀌는 곳에서 잘라요 · 누르면 최근에 찾은 상태창"><span class="na_cp_txt"><span>상태창</span><small id="na_trk_sub"></small></span><span class="na_cp_more">자동</span></button>
                  <div class="na_cp_row na_off_row" id="na_off_fold" title="켠 것은 압축 · 원문 뽑기 · 이탈 감지 · 말투 지문에서 빠져요"><span class="na_cp_txt"><span>OOC 빼기</span><small id="na_off_sub"></small></span>
                    <span class="na_off_chips">${Object.entries(OFF_KINDS).map(([k, [name, sub, chip]]) => `<button type="button" class="na_off_chip" data-k="${k}" title="${name} · ${sub}" aria-pressed="false">${chip}</button>`).join('')}</span></div>
                  <details class="na_cp_fold" id="na_cmp_settings">
                    <summary class="na_cp_row"><span class="na_cp_txt"><span>압축 지시문</span><small id="na_plib_sum">이 기기의 실리태번 설정에만 저장돼요</small></span><span class="na_cp_more">편집</span><span class="na_cp_chev">${svgA(ICO_A.right, 16, 2.2)}</span></summary>
                    <div class="na_cp_sub"><div class="na_plib" id="na_plib"></div></div>
                  </details>
                  <label class="na_cp_row" data-m="quick" title="지시문의 규칙은 시스템 메시지에, 원문 · 메모 · 마지막 점검은 요청에"><span class="na_cp_txt"><span>규칙은 시스템 메시지로</span><small>중계 서버가 버리면 끄세요</small></span><input type="checkbox" class="na_toggle" id="na_rules_sys"></label>
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
                <button type="button" class="na_toolrow na_toolhero" id="na_phone"><span class="na_toolhero_ic"><i class="fa-solid fa-mobile-screen-button"></i></span><span><b>캐릭터 휴대폰</b><small>문자 · 통화 · 사진 · SNS · 일정을 아카이브만큼</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_people"><i class="fa-solid fa-address-book"></i><span><b>인물 도감</b><small>프로필 · 관계도 · 관계 온도</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_story_cal"><i class="fa-solid fa-calendar-days"></i><span><b>이야기 달력</b><small>섹션을 날짜 순서로 · 기념일 찾기</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_worlds"><i class="fa-solid fa-earth-asia"></i><span><b>세계관 공유</b><small id="na_worlds_sub">여러 채팅이 같이 쓰는 설정 · 고치면 모든 채팅에 반영</small></span><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="na_toolrow" id="na_tool_gloss"><i class="fa-solid fa-spell-check"></i><span><b>번역 용어집</b><small>이름 · 장소의 한국어 표기</small></span><i class="fa-solid fa-chevron-right"></i></button>
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
                  <label class="na_set_row" title="아카이브는 답마다 똑같이 두고, 그 답에만 필요한 것(키워드 · 라우터가 불러온 섹션, 지금 나오는 인물의 노트)은 마지막 메시지 두 개 바로 위에 따로 넣어요 · 앞부분이 늘 같아서 Claude · Gemini의 프롬프트 캐시가 덜 깨지고 싸져요 · Claude는 실리태번 config.yaml의 claude.cachingAtDepth를 켜야 해요"><span><span>캐시 아끼기</span><small>바뀌는 것만 대화 끝 가까이 따로</small></span><input type="checkbox" id="na_cache_save" class="na_toggle"></label>
                </div>
                </div>
              </div>
              <div class="na_cfg_grp na_cfg_keeplab" data-g="inject">
                <div class="na_cfg_label"><i class="fa-solid fa-scale-balanced"></i> 분량</div>
                <div class="na_cfg_box">
                <div class="na_set_list">
                  <label class="na_set_row"><span><span>토큰 상한</span><small>넘으면 알려 줘요</small></span><span class="na_cfg_val"><input type="number" id="na_cap" class="text_pole" min="0" step="1000" placeholder="없음" title="0이나 빈칸이면 상한 없음"><span class="na_cfg_unit">&nbsp;토큰</span>${svgA(ICO_A.right, 15, 2.2)}</span></label>
                  <label class="na_set_row" for="na_fade" title="오래된 섹션은 짧은 버전·요점으로 넣어요. 버전이 없으면 원문 그대로 · 고정한 섹션과 지금 불려 온 섹션은 늘 원문"><span><span>망각 곡선</span><small id="na_fade_sub">오래된 섹션은 짧은 버전·요점으로</small></span><button type="button" class="na_fd_more" id="na_fade_more" title="자세히" aria-label="자세히" hidden>${svgA(ICO_A.down, 15, 2.2)}</button><input type="checkbox" id="na_fade" class="na_toggle"></label>
                  <div id="na_fade_opts" class="na_v2 na_fd" hidden>
                    <div class="na_fd_save"><span><b id="na_fade_now">-</b><small>토큰</small><s id="na_fade_was"></s></span><span class="na_fd_pct" id="na_fade_pct"></span></div>
                    <div class="na_fd_strip" id="na_fade_strip" aria-hidden="true"></div>
                    <div class="na_fd_ends"><span>오래됨</span><span>최근</span></div>
                    <div class="na_fd_level"><i class="long"></i><span><span>원문 그대로</span><small>최근 섹션</small></span><span class="na_fd_step"><button type="button" class="na_fd_btn" data-f="full" data-d="-1" aria-label="줄이기">−</button><input type="number" id="na_fade_full" class="text_pole" min="0" max="200"><button type="button" class="na_fd_btn" data-f="full" data-d="1" aria-label="늘리기">+</button></span></div>
                    <div class="na_fd_level"><i class="short"></i><span><span>짧은 버전</span><small>그다음 섹션</small></span><span class="na_fd_step"><button type="button" class="na_fd_btn" data-f="short" data-d="-1" aria-label="줄이기">−</button><input type="number" id="na_fade_short" class="text_pole" min="0" max="500"><button type="button" class="na_fd_btn" data-f="short" data-d="1" aria-label="늘리기">+</button></span></div>
                    <div class="na_fd_level"><i class="line"></i><span><span>요점</span><small>더 오래된 섹션 전부</small></span><b id="na_fade_lines">-</b></div>
                    <div class="na_fd_fill"><span id="na_fade_info">-</span><button type="button" class="na_v2_btn primary" id="na_fade_fill"><i class="fa-solid fa-feather-pointed"></i> 초안 모델로 채우기</button></div>
                  </div>
                  <button type="button" class="na_set_row na_cfg_go" id="na_fade_pick"><span><span>섹션별 버전 고르기</span><small id="na_fade_pick_sub">여러 섹션을 골라 원문 · 짧게 · 요점으로</small></span>${svgA(ICO_A.right, 15, 2.2)}</button>
                </div>
                </div>
              </div>
              <div class="na_cfg_grp na_cfg_keeplab" data-g="call" title="섹션 카드의 스위치 · 고정 · 키워드로 섹션마다 정하고, 여기선 한꺼번에 관리해요.">
                <div class="na_cfg_label"><i class="fa-solid fa-magnifying-glass"></i> 호출</div>
                <div class="na_cfg_box">
                <div class="na_set_list">
                  <label class="na_set_row" title="답하기 직전에 지금 대화에 필요한 지난 섹션을 골라 원문으로 넣어요 · AI 없이 빠르게: 임베딩 · 키워드로 골라서 답마다 AI를 안 불러요, 나머지는 망각 곡선대로 · AI 모드는 따로 연결한 모델이 필요해요"><span><span>AI 라우터</span><small id="na_router_sub">답하기 직전에 필요한 섹션을 골라요</small></span>
                    <span class="na_cfg_val"><select id="na_router_mode" class="text_pole"><option value="off">끄기</option><option value="lift">AI 없이 빠르게</option><option value="linked">키워드에 더해 AI도</option><option value="old">오래된 섹션 전부</option></select>${svgA(ICO_A.right, 15, 2.2)}</span></label>
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
