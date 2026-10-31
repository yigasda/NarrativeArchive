import {axBar,axTop,axCb,axH1,axInd} from './phoneapps.js';
import {esc} from './util.js';
import {activeGroups,GROUPS,verifyBoundary} from './phoneread.js';
export function readSettings(p,now,ui={}){
 const rows=ui.readRows||[],r=p.readState,needs=!verifyBoundary(r,ui.readScope,rows)||activeGroups(p).some(g=>!r?.groups[g]);
 const options='<option value="-1">첫 대화부터</option>'+rows.map(x=>`<option value="${x.index}">#${x.index} · ${esc(x.text.replace(/^\[#\d+[^\]]*\]\s*/,'').slice(0,95))}</option>`).join('');
 return `${axBar(p,now)}${axTop(axCb('set'))}<div class="ax_scroll">${axH1('대화 반영')}
 <div class="ax_sec">읽을 범위</div><div class="ax_card">
 <label class="ax_rw"><span class="ax_tx"><span class="ax_n">읽는 순서</span></span><span class="ax_v">${r?.order==='newest'?'최신 대화부터':'오래된 대화부터'}</span><select class="ax_sel na_read_order"><option value="oldest">오래된 대화부터</option><option value="newest" ${r?.order==='newest'?'selected':''}>최신 대화부터</option></select></label>
 <label class="ax_rw"><span class="ax_tx"><span class="ax_n">한 번에 읽을 대화</span></span><input class="na_read_limit" aria-label="한 번에 읽을 대화" type="number" min="1" max="100" value="${r?.limit||12}" style="width:65px;border:0;background:transparent;color:inherit;font:inherit;text-align:right"><span class="ax_v">개</span></label></div>
 ${needs?`<div class="ax_sec">어디서부터 반영할까요?</div><div class="ax_card"><label class="ax_rw"><span class="ax_tx"><span class="ax_n">시작 위치</span></span><span class="ax_v na_read_caption">대화 선택</span><select class="ax_sel na_read_start"><option value="" selected disabled>대화 선택</option>${options}</select></label></div><div class="ax_foot">폰을 만들었던 무렵의 마지막 대화를 골라 주세요.</div>
 <details><summary class="ax_sec">따로 만든 앱이 있어요</summary><div class="ax_card">${activeGroups(p).map(g=>`<label class="ax_rw"><span class="ax_tx"><span class="ax_n">${GROUPS[g]}</span></span><span class="ax_v na_read_caption">${r?.groups[g]?'기존 위치 유지':'같은 위치'}</span><select class="ax_sel na_read_override" data-g="${g}" ${r?.groups[g]&&verifyBoundary(r,ui.readScope,rows)?'disabled':''}><option value="">같은 위치</option>${options}</select></label>`).join('')}</div></details><div class="ax_card"><button type="button" class="ax_rw na_read_save"><span class="ax_tx"><span class="ax_n ax_blue">시작 위치 저장</span></span></button></div>`:''}
 ${r&&!needs?`<div class="ax_foot">다음 반영부터 선택한 순서와 개수를 사용해요.</div>`:''}<i class="ax_pad"></i></div>${axInd()}`;
}
