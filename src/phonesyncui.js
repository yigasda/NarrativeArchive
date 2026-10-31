// 설정 › 대화 반영: how many messages a round reads and from which end, where reading starts, and the last round's result
import { ax, axBar, axCb, axChev, axH1, axInd, axTop } from './phoneapps.js';
import { esc } from './util.js';

const si = (c, k) => `<span class="ax_si" style="background: ${c}">${ax(k, 17, '#fff')}</span>`;
const radio = on => `<span class="ax_radio ${on ? 'on' : ''}">${on ? ax('check', 14, '#fff', 3.4) : ''}</span>`;
// "[#12 · USER] Mara: text" → who and the text
const split = t => { const mt = /^\[#\d+[^\]]*\]\s*([^:]{0,60}):\s*([\s\S]*)$/.exec(t); return mt ? [mt[1].trim(), mt[2]] : ['', t]; };
const money = (n, cur) => { try { return `${n > 0 ? '+' : ''}${new Intl.NumberFormat('ko-KR', { style: 'currency', currency: cur }).format(n)}`; } catch { return `${n > 0 ? '+' : ''}${n} ${cur}`; } };
const snip = (t, n = 70) => { const s = String(t).replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n)}…` : s; };

export function syncSettings(p, now, ui) {
    const s = p.sync || {}, last = p.syncLast, mk = s.marks?.base, rows = ui.syncRows || [];
    const at = mk ? rows.find(r => r.index === mk.index) : null;
    const startText = !mk ? '정하지 않음' : mk.index < 0 ? '첫 대화부터' : `#${mk.index} 다음부터`;
    const limit = s.limit || 12;
    const skipped = Object.entries(s.failed || {}).filter(([, f]) => f.tries >= 2 && !f.quiet);
    return `${axBar(p, now)}
      ${axTop(axCb('set'))}
      <div class="ax_scroll">
        ${axH1('대화 반영')}
        ${ui.syncPending ? `<div class="ax_sec">저장되지 않은 반영</div>
        <div class="ax_card">
          <div class="ax_rw"><span class="ax_tx"><span class="ax_n">반영 ${ui.syncPending}번이 저장되지 않았어요</span><span class="ax_p">이 브라우저에 기록이 남아 있어요. 복구하면 빠진 것만 다시 넣어요.</span></span></div>
          <button type="button" class="ax_rw ax_rwn na_sync_restore"><span class="ax_tx"><span class="ax_n ax_blue">복구</span></span></button>
          <button type="button" class="ax_rw ax_rwn na_sync_forget"><span class="ax_tx"><span class="ax_n ax_red">기록 지우기</span></span></button>
        </div>` : ''}
        ${(s.dropped || []).length ? `<div class="ax_sec">지운 대화</div>
        <div class="ax_card">${s.dropped.map((d, k) => `
          <div class="ax_rw"><span class="ax_tx"><span class="ax_n">대화 ${esc(d.label)}</span><span class="ax_p">거기서 넣은 일 ${d.events.length}개가 폰에 남아 있어요</span></span><button type="button" class="na_sync_drop" data-k="${k}">빼기</button></div>`).join('')}
        </div>
        <div class="ax_foot">빼면 그 일로 들어간 문자 · 일정 · 돈 기록이 같이 빠져요. 뒤의 기록과 이어진 건 남겨요.</div>` : ''}
        <div class="ax_sec">읽기</div>
        <div class="ax_card">
          <button type="button" class="ax_rw na_sync_order" data-v="oldest">${si('#8faed1', 'clock')}<span class="ax_tx"><span class="ax_n">오래된 대화부터</span></span>${radio(s.order !== 'newest')}</button>
          <button type="button" class="ax_rw na_sync_order" data-v="newest">${si('#a699c9', 'bolt')}<span class="ax_tx"><span class="ax_n">최신 대화부터</span></span>${radio(s.order === 'newest')}</button>
          <div class="ax_rw">${si('#89b892', 'cmt')}<span class="ax_tx"><span class="ax_n">한 번에 읽을 대화</span></span><span class="ax_step"><button type="button" class="na_sync_limit" data-d="-1" aria-label="줄이기" ${limit <= 1 ? 'disabled' : ''}>−</button><b class="cg_num">${limit}</b><button type="button" class="na_sync_limit" data-d="1" aria-label="늘리기" ${limit >= 100 ? 'disabled' : ''}>+</button></span></div>
        </div>
        <div class="ax_foot">한 번 누를 때 이만큼 읽어요. 최신부터 읽어도 앞쪽 대화는 남아 있다가 나중에 읽혀요.</div>
        <div class="ax_sec">시작 위치</div>
        <div class="ax_card">
          <button type="button" class="ax_rw" data-go="setsyncpick">${si('#dcc680', 'pen')}<span class="ax_tx"><span class="ax_n">${esc(startText)}</span>${at ? `<span class="ax_p">${esc(snip(split(at.text)[1], 60))}</span>` : ''}</span><span class="ax_v">바꾸기</span>${axChev}</button>
        </div>
        ${last ? `<div class="ax_sec">지난 반영</div>
        <div class="ax_card">
          <div class="ax_rw"><span class="ax_tx"><span class="ax_n">${last.checked}개 확인 · 남은 ${last.remaining}개</span><span class="ax_p">${esc(last.apps.length ? `${last.apps.join(' · ')}에 넣었어요` : '새로 넣은 건 없어요')}</span></span></div>
          ${(last.changes || []).map(c => `<div class="ax_rw"><span class="ax_tx"><span class="ax_n">${esc(c.label)}</span><span class="ax_p">${esc(c.what || c.app)}</span></span><span class="ax_v cg_num ${c.amount < 0 ? '' : 'ax_plus'}">${esc(money(c.amount, c.currency))}</span></div>`).join('')}
          ${(last.notes || []).map(n => `<div class="ax_rw"><span class="ax_tx"><span class="ax_p">${esc(n)}</span></span></div>`).join('')}
          ${last.failed.map(f => `<div class="ax_rw"><span class="ax_tx"><span class="ax_n ax_red">${f.at === null ? '넣지 못한 일' : `#${f.at} ${f.skipped ? '건너뜀' : '다음에 한 번 더'}`}</span><span class="ax_p">${esc(f.why)}</span></span></div>`).join('')}
          ${p.syncUndo && last.checked ? '<button type="button" class="ax_rw ax_rwn na_sync_undo"><span class="ax_tx"><span class="ax_n ax_red">이 반영 되돌리기</span></span></button>' : ''}
        </div>` : ''}
        ${skipped.length ? `<div class="ax_foot">건너뛴 대화: ${skipped.map(([i]) => `#${i}`).join(', ')}</div>` : ''}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}

// where reading starts: the newest messages first, a few at a time
export function syncPick(p, now, ui) {
    const rows = ui.syncRows || [], cur = p.sync?.marks?.base?.index, n = ui.pickMore || 30;
    const shown = rows.slice(-n).reverse();
    const lead = ui.syncWhy === 'lost' ? '시작 위치로 고른 대화를 찾지 못했어요. 다시 골라 주세요.' : '이 폰을 만들었던 무렵의 마지막 대화를 골라 주세요. 선택한 대화 다음부터 반영해요.';
    return `${axBar(p, now)}
      ${axTop(axCb('setsync'))}
      <div class="ax_scroll">
        ${axH1('어디서부터 반영할까요?')}
        <div class="ax_foot ax_foot_top">${esc(lead)}</div>
        <div class="ax_card">${shown.map(r => { const [who, text] = split(r.text); return `
          <button type="button" class="ax_rw na_sync_pick" data-i="${r.index}"><span class="ax_tx"><span class="ax_n">#${r.index}${who ? ` · ${esc(who)}` : ''}</span><span class="ax_p">${esc(snip(text))}</span></span>${radio(cur === r.index)}</button>`; }).join('')}
          ${rows.length > n ? '<button type="button" class="ax_rw ax_rwn na_sync_more"><span class="ax_tx"><span class="ax_n ax_blue">이전 대화 더 보기</span></span></button>' : `
          <button type="button" class="ax_rw na_sync_pick" data-i="-1"><span class="ax_tx"><span class="ax_n">첫 대화부터</span></span>${radio(cur === -1)}</button>`}
        </div>
        <div class="ax_foot">너무 앞을 고르면 이미 폰에 있는 일을 다시 만날 수 있고, 너무 뒤를 고르면 일부를 놓칠 수 있어요.</div>
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
