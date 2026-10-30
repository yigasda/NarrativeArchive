import { axBar, axCb, axH1, axInd, axTop } from './phoneapps.js';
import { esc } from './util.js';
import { baseCosts, cash, finance, finite, fx, positions, price, total } from './finance.js';
import { investmentDate } from './investdata.js';
const money = (n, c) => finite(n) ? `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(n)} ${esc(c || '')}` : '미평가';
const nav = (go, label, i = '') => `<button type="button" class="iv_nav" data-go="${go}" data-i="${esc(i)}">${label}</button>`;
const row = (label, value) => `<div class="iv_row"><span>${label}</span><b>${value}</b></div>`;
const card = s => `<div class="iv_card">${s}</div>`;
function shell(p, now, title, body, back = 'invest') {
    return `${axBar(p, now)}${axTop(axCb(back))}<div class="ax_scroll iv_scroll">${axH1(title)}${body}<div class="iv_footer">은행 예금과 투자자산은 별도 · 가상 기록은 RP에 주입되지 않아요</div><i class="ax_pad"></i></div>${axInd()}`;
}
function controls(m, p, busy) {
    return `<div class="iv_tools"><label>평가 날짜 <input type="date" class="iv_date" value="${esc(investmentDate(m, p))}"></label><button type="button" class="iv_refresh" ${busy ? 'disabled' : ''}>${busy ? '불러오는 중…' : p.investment ? '시세 갱신' : '투자 앱 채우기'}</button>${p.investment ? '<button type="button" class="iv_sync">원문 시세 확인</button>' : ''}</div>`;
}
export function investmentScreen(m, p, now, view, key, busy) {
    const inv = p.investment;
    if (!inv) return shell(p, now, '투자', card('<h2>이 사람의 투자 방식</h2><p>아카이브와 선택한 로어북을 읽고 투자 계좌를 만들어요. 현금과 거래 기록을 함께 계산하고, 가문 지분은 근거가 있는 것만 보여줘요.</p>') + controls(m, p, busy), 'home2');
    const date = inv.date, f = finance(m), trades = inv.trades.filter(t => t.date <= inv.date), holdings = positions(trades), costs = baseCosts(trades, inv.base), lookup = s => inv.securities.find(x => x.symbol === s);
    if (view === 'stock') {
        const s = lookup(key); if (!s) return investmentScreen(m, p, now, 'invest', '', busy);
        const h = holdings.find(x => x.symbol === key), q = price(m, `STOCK:${key}`, date);
        const vals = Object.keys(f.prices[`STOCK:${key}`] || {}).filter(d => d <= date).sort().map(d => price(m, `STOCK:${key}`, d)).filter(Boolean);
        let chart = '<p>가격 기록이 아직 없어요</p>';
        if (vals.length) {
            const min = Math.min(...vals.map(v => v.value)), max = Math.max(...vals.map(v => v.value));
            const points = vals.map((v, i) => `${12 + i * 296 / Math.max(1, vals.length - 1)},${100 - (v.value - min) / (max - min || 1) * 80}`).join(' ');
            chart = `<svg class="iv_chart" viewBox="0 0 320 116" role="img" aria-label="저장된 날짜별 주가"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="3"/>${vals.map((v,i) => `<circle cx="${12+i*296/Math.max(1,vals.length-1)}" cy="${100-(v.value-min)/(max-min||1)*80}" r="3" fill="currentColor"/>`).join('')}</svg><small>${esc(vals[0].date)} — ${esc(vals.at(-1).date)}</small>`;
        }
        const value = q && h ? h.quantity * q.value : null, gain = finite(value) && h ? value - h.cost : null;
        const baseCost = costs[key]?.cost, rate = fx(m, s.currency, inv.base, date);
        const baseGain = finite(value) && finite(baseCost) && rate !== null ? value * rate - baseCost : null;
        const lastDay = Object.keys(f.prices[`STOCK:${key}`] || {}).filter(d => d < date).sort().pop();
        const previous = lastDay ? price(m, `STOCK:${key}`, lastDay) : null;
        const change = q && !q.stale && previous ? (q.value / previous.value - 1) * 100 : null;
        const own = h ? row('보유 수량', String(h.quantity)) + row('평균 매수가 · 수수료 포함', money(h.average, s.currency)) + row('평가액', money(value, s.currency)) + row('평가손익', money(gain, s.currency)) + row('수익률', finite(gain) && h.cost > 0 ? `${(gain / h.cost * 100).toFixed(2)}%` : '—') + row('실현손익', money(h.realized, s.currency)) + row('배당 수령', money(h.dividends, s.currency)) + row('기준 통화 평가손익', money(baseGain, inv.base)) + row('주가 변화 기여', money(finite(gain) && rate !== null && finite(baseGain) ? gain * rate : null, inv.base)) + row('환율 변화 기여', money(finite(baseGain) && finite(gain) && rate !== null ? baseGain - gain * rate : null, inv.base)) : '<p>관심 종목 · 보유 내역 없음</p>';
        return shell(p, now, s.ko || s.name, card(`<small>${esc(s.symbol)}</small><h2>${money(q?.value, s.currency)}</h2><p>${q ? `${esc(q.date)} ${q.time || '시각 미상'} · ${q.source === 'story' ? '원문 가격' : '가상 시세'}${q.stale ? ' · 이전 시세' : ''}` : '평가 미완료'}</p>${chart}${row(previous ? `${esc(lastDay)} 대비` : '이전 시세 대비', finite(change) ? `${change.toFixed(2)}%` : '—')}${q?.conflict ? nav('ivprices', '가격 확인 필요 · 나중에 확인 가능', `STOCK:${key}`) : ''}`) + card(own) + nav('ivprices', '가격 기록과 출처', `STOCK:${key}`) + `<button type="button" class="iv_news iv_nav" data-symbol="${esc(key)}">관련 뉴스 검색</button>` + card(inv.trades.filter(t => t.symbol === key).map(t => row(esc(t.date), `${esc(t.kind)} · ${t.kind === 'dividend' ? money(t.amount, t.currency) : `${t.quantity} × ${money(t.price, t.currency)}`}`)).join('') || '<p>거래 없음</p>'));
    }
    if (view === 'ivstakes') return shell(p, now, '소유 지분', `<p class="iv_hint">일반 투자 합계에 포함하지 않아요. 빈칸은 권리나 제한이 없다는 뜻이 아니에요.</p>` + (inv.stakes.map(s => card(`<h2>${esc(s.company)}</h2>${row('상장 여부', s.listed === null ? '—' : s.listed ? '상장' : '비상장')}${row('직접 보유자', esc(s.holder) || '—')}${row('지분율', s.percent === null ? '—' : `${s.percent}%`)}${row('의결권 행사자', esc(s.voter) || '—')}${row('배당 수익자', esc(s.beneficiary) || '—')}${row('매도 제한·조건', esc(s.restriction) || '—')}${row('설정상 평가액', money(s.value, s.currency))}<details><summary>설정 근거</summary><p>${esc(s.evidence)}</p></details>`)).join('') || card('<p>확인된 소유 지분 정보가 없어요</p>')));
    if (view === 'ivwatch') return shell(p, now, '관심 종목', inv.watch.map(w => card(nav('stock', esc(lookup(w.symbol)?.name || w.symbol), w.symbol) + `<p>${esc(w.note)}</p>${w.ko ? `<p>${esc(w.ko)}</p>` : ''}<small>상상한 관심 메모</small><button type="button" class="iv_news iv_nav" data-symbol="${esc(w.symbol)}">관련 뉴스</button>`)).join('') || card('<p>관심 종목 없음</p>'));
    if (view === 'ivprices') {
        const keys = key ? [key] : Object.keys(f.prices).filter(k => k.startsWith('FX:') || inv.securities.some(s => k === `STOCK:${s.symbol}`));
        return shell(p, now, '가격·환율 확인', keys.map(k => card(`<h3>${esc(k)}</h3>${Object.entries(f.prices[k] || {}).filter(([d]) => d <= date).sort(([a],[b])=>b.localeCompare(a)).map(([d,slot])=>`<div class="iv_quote"><b>${d}${slot.conflict ? ' · 가격 확인 필요' : ''}</b>${slot.rows.map(q=>`<div><span>${q.value} · ${q.time || '시각 미상'} · ${q.source === 'story' ? '원문' : '가상'}</span>${slot.selected === q.id ? '<small>평가에 사용 중</small>' : ''}<button type="button" class="iv_select" data-key="${esc(k)}" data-date="${d}" data-id="${q.id}">이 가격 사용</button>${q.ref ? `<details><summary>근거</summary>${esc(q.ref)}</details>` : ''}</div>`).join('')}</div>`).join('')}`)).join(''));
    }
    if (view === 'ivactivity') {
        const transfers = Object.values(f.transfers).filter(t => f.accounts[t.from]?.owner === p.owner || f.accounts[t.to]?.owner === p.owner);
        return shell(p, now, '거래 내역', card(inv.trades.slice().reverse().map(t => row(`${esc(t.date)} · ${esc(lookup(t.symbol)?.name || t.symbol)}`, `${esc(t.kind)} ${money(t.kind === 'dividend' ? t.amount : t.quantity * t.price, t.currency)}`)).join('') || '<p>매매 내역 없음</p>') + transfers.map(t=>card(`<h3>${esc(t.date)} · 이체</h3>${row('보내는 원금', money(t.sent, f.accounts[t.from].currency))}${row('받는 원금', money(t.received,f.accounts[t.to].currency))}${row('수수료', money(t.fee,t.feeCurrency || f.accounts[t.from].currency))}${f.accounts[t.from].currency !== f.accounts[t.to].currency ? row('적용 환율', String(t.rate)) : ''}<small>${t.feeSide === 'receiver' ? '수취액에서 수수료 차감' : '송금액에 수수료 별도'} · ${esc(t.id)}</small>`)).join(''));
    }
    if (view === 'ivcash') {
        const accounts = Object.entries(f.accounts).filter(([,a]) => a.owner === p.owner);
        return shell(p, now, '현금·이체', accounts.map(([k,a])=>card(`<h3>${inv.accounts.some(x=>x.key===k) ? '증권' : '은행'} · ${a.currency}</h3>${row('현재 잔액',money(cash(a),a.currency))}${row('기준 잔액',money(a.amount,a.currency))}<small>${esc(a.asOf)} · 과거 포함 거래 ${a.included.length}건</small><details><summary>기준 잔액 별도 수정</summary><input type="number" class="iv_balance" value="${a.amount}" step="any"><input class="iv_reason" placeholder="수정 이유"><button type="button" class="iv_baseline" data-key="${esc(k)}">기준점 수정</button></details>`)).join('') + card(`<h3>실제로 일어난 이체 연결</h3><p>새 사건을 생성하지 않아요. 기존 기록을 연결할 때 이미 잔액에 포함됐는지 각각 선택하세요.</p><label>거래 ID <input class="iv_tid" placeholder="같은 거래는 같은 ID"></label><label>출금 계좌 <select class="iv_from">${accounts.map(([k,a])=>`<option value="${esc(k)}">${inv.accounts.some(x=>x.key===k)?'증권':'은행'} · ${a.currency} · ${esc(a.id.slice(-6))}</option>`).join('')}</select></label><label>입금 계좌 <select class="iv_to">${accounts.map(([k,a])=>`<option value="${esc(k)}">${inv.accounts.some(x=>x.key===k)?'증권':'은행'} · ${a.currency} · ${esc(a.id.slice(-6))}</option>`).join('')}</select></label><label>보내는 원금 <input type="number" class="iv_sent" step="any"></label><label>받는 원금 <input type="number" class="iv_received" step="any"></label><label>수수료 <input type="number" class="iv_fee" step="any" placeholder="모르면 연결 보류"></label><label>수수료 차감 <select class="iv_feeSide"><option value="sender">출금 쪽에 별도</option><option value="receiver">입금 쪽에서 차감</option></select></label><label>적용 환율 · 다른 통화일 때 <input type="number" class="iv_rate" step="any"></label><label>거래 날짜 <input type="date" class="iv_tdate" value="${date}"></label><label><input type="checkbox" class="iv_incfrom"> 출금은 기준 잔액에 이미 반영됨</label><label><input type="checkbox" class="iv_incto"> 입금은 기준 잔액에 이미 반영됨</label><button type="button" class="iv_transfer">이체 연결</button>`));
    }
    const amounts = inv.accounts.map(a => ({ amount: cash(f.accounts[a.key]), currency: a.currency, label: '현금' }));
    for (const h of holdings.filter(h=>h.quantity>0)) { const q = price(m,`STOCK:${h.symbol}`,date); amounts.push({ amount:q && !q.stale ? h.quantity*q.value:null,currency:h.currency,label:lookup(h.symbol)?.name || h.symbol }); }
    const sum = total(m,amounts,inv.base,date);
    const yesterday = new Date(Date.parse(date) - 86400000).toISOString().slice(0,10);
    let prior = 0, today = 0, dayComplete = true;
    for (const h of holdings.filter(h=>h.quantity>0)) {
        const before = price(m, `STOCK:${h.symbol}`, yesterday), after = price(m, `STOCK:${h.symbol}`, date);
        const r0 = fx(m,h.currency,inv.base,yesterday), r1 = fx(m,h.currency,inv.base,date);
        if (!before || before.stale || !after || after.stale || r0 === null || r1 === null) dayComplete = false;
        else { prior += h.quantity*before.value*r0; today += h.quantity*after.value*r1; }
    }
    const daily = dayComplete && prior > 0 ? `${((today/prior-1)*100).toFixed(2)}%` : '미완료';
    let unrealized = 0, gainComplete = true;
    for (const h of holdings.filter(h => h.quantity > 0)) {
        const q = price(m, `STOCK:${h.symbol}`, date), rate = fx(m, h.currency, inv.base, date), cost = costs[h.symbol]?.cost;
        if (!q || q.stale || rate === null || !finite(cost)) gainComplete = false;
        else unrealized += h.quantity * q.value * rate - cost;
    }
    const holdingHtml = holdings.filter(h=>h.quantity>0).map(h=>{const s=lookup(h.symbol),q=price(m,`STOCK:${h.symbol}`,date); const gain=q ? h.quantity*q.value-h.cost:null; return `<button type="button" class="iv_holding" data-go="stock" data-i="${esc(h.symbol)}"><span><b>${esc(s?.ko || s?.name || h.symbol)}</b><small>${h.quantity}주 · ${esc(h.symbol)}</small></span><span><b>${money(q&&!q.stale?h.quantity*q.value:null,h.currency)}</b><small>${q?.stale?'이전 시세':finite(gain)?`손익 ${money(gain,h.currency)}`:'시세 없음'}</small></span></button>`;}).join('');
    return shell(p,now,'투자',controls(m,p,busy)+`<div class="iv_hero"><small>${sum.complete?'총 투자자산':'환산 가능한 소계 · 평가 미완료'}</small><h2>${money(sum.value,inv.base)}</h2><span>${esc(date)} 기준</span><p>보유종목 전일 대비 ${daily} · 현재 수량 기준</p><p>평가손익 ${gainComplete ? money(unrealized, inv.base) : '미완료 · 매수 당시 환율 또는 시세 확인 필요'}</p>${sum.missing.map(x=>`<p>${esc(x.label)} · ${money(x.amount,x.currency)} ${finite(x.amount)?'환산 대기':'가격 확인 필요'}</p>`).join('')}</div><div class="iv_navs">${nav('ivactivity','거래')}${nav('ivwatch','관심')}${nav('ivstakes','소유 지분')}${nav('ivcash','현금·이체')}${nav('ivprices','시세·환율')}</div>${card(holdingHtml || '<p>보유 종목 없음</p>')}${card(amounts.filter(a=>a.label==='현금').map(a=>row('증권 현금',money(a.amount,a.currency))).join(''))}<details class="iv_card"><summary>금융 구성 근거</summary><p>${esc(inv.basis)}</p><small>가상 구성은 확정 설정이 아니에요.</small></details>`, 'home2');
}
