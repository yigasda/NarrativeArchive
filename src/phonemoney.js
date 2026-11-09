// 캐릭터 휴대폰 · 은행 · 지갑 · 쇼핑 · 음성 메모 (v3.133): drawn like the real apps, in the phone's flat look.
// p.money = { currency, bank: { name, accounts }, cards, tx, passes, orders } (채우기, one request so the amounts agree);
// p.voice = memos (the story's, 채우기's from the archive, and 떠올리기's right now). Records with the same "ev" link to each other.

import { creditAmount, creditLabel } from './finance.js';
import { getMeta } from './core.js';
import { migrateBank, total, fx, price, finite, currency } from './finance.js';
import { investmentDate } from './investdata.js';
import { nameKey } from './people.js';
import { filling, recording } from './phoneai.js';
import { AX, ax, axBar, axCb, axDay, axFind, axH1, axInd, axKp, axLetter, axTint, axTop, busyHtml } from './phoneapps.js';
import { byStory, clockOf, fmtDate, fmtTime, fullDate, gapDays, homeCountry, koOn, listTime, localeOf, storyNow } from './phonedata.js';
import { esc } from './util.js';
import { prodSvg } from './phoneprod.js';
import { passMotif } from './phonepassart.js';
import { dlvApp, monthSoFar, PASS_OVER } from './phonesyncmoney.js';

Object.assign(AX, {
    plane: 'M2 13l20-6-3 4-8 3-3 6-2-5z', train: 'M6 4h12v11a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3zM6 10h12M9 21l1-3M15 21l-1-3', bed: 'M3 18v-9M3 13h18v5M7 13V9h6a4 4 0 0 1 4 4',
    ticket: 'M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 0 0-4V5H3z', card: 'M5.5 5.5h13A2.5 2.5 0 0 1 21 8v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16V8a2.5 2.5 0 0 1 2.5-2.5zM3 10h18', send2: 'M5 12h14M13 6l6 6-6 6', down2: 'M12 5v14M6 13l6 6 6-6',
    swap: 'M7 7h12l-3-3M17 17H5l3 3', truck: 'M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-.1M17 19a2 2 0 1 0 0-.1', gift: 'M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0',
    bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0', doc: 'M6 3h9l4 4v14H6zM9 12h7M9 16h5', homeS: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    grid4: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', cart: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6M9 20h.01M17 20h.01', receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    play: 'M8 5v14l11-7z', rew: 'M11 19l-7-7 7-7M20 19l-7-7 7-7', ffw: 'M13 5l7 7-7 7M4 5l7 7-7 7', bag: 'M5 8h14l-1.2 11a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9zM9 8V6a3 3 0 0 1 6 0v2',
    box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10', link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1',
});

// money as the owner's phone writes it (1.284,17 € in Germany, $1,284.17 in the US)
// the phone's number style comes from its notation (phonedata: 한국 · 일본 · 중국 · 미국 · 유럽); every app reads numbers through it
export { localeOf };
export const decimalOf = p => { try { return new Intl.NumberFormat(localeOf(p)).formatToParts(1.5).find(x => x.type === 'decimal')?.value || '.'; } catch { return '.'; } };
export function fmtMoney(p, n, signed = false) {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
    let s;
    try { s = new Intl.NumberFormat(localeOf(p), { style: 'currency', currency: p.money?.currency || 'EUR' }).format(Number(n)); } catch { s = `${Number(n).toFixed(2)} ${p.money?.currency || ''}`; }
    return signed && n > 0 ? `+${s}` : s;
}
// the same, in a currency of its own (the investment app holds several)
export const fmtIn = (p, n, cur, signed = false) => fmtMoney({ ...p, money: { currency: cur || p.money?.currency || 'EUR' } }, n, signed);
// Display currency never changes an account's denomination or its ledger.
const LOCAL_CURRENCY = {KR:'KRW',US:'USD',GB:'GBP',DE:'EUR',FR:'EUR',IT:'EUR',ES:'EUR',AT:'EUR',JP:'JPY',CN:'CNY',TW:'TWD',CA:'CAD',AU:'AUD',RU:'RUB',BR:'BRL',CH:'CHF'};
export const bankDisplayCurrency = p => currency(p.money?.displayCurrency) || LOCAL_CURRENCY[homeCountry(p)] || p.money?.currency || 'EUR';
const bankDate = p => p.money?.fxDate || investmentDate(getMeta(),p);
function converted(p, a, brief = false) {
    const from = a.currency || p.money.currency, to = bankDisplayCurrency(p), date = bankDate(p);
    if (from === to) return '';
    const meta = getMeta(), amount = a.kind === 'credit' ? creditAmount(a) : a.balance;
    const rate = fx(meta,from,to,date), q = price(meta,`FX:${from}/${to}`,date);
    if (!finite(amount) || rate === null) return `${esc(to)} 환산 대기`;
    if (brief) return `${esc(fmtIn(p,amount * rate,to))} 환산`;
    return `${esc(fmtIn(p,amount * rate,to))} 환산 · 1 ${esc(from)} = ${esc(fmtIn(p,rate,to))} · ${esc(date)}${q?.conflict ? ' · 환율 확인 필요' : ''}`;
}
function bankSum(p) {
    const meta = getMeta(); migrateBank(meta,p);
    return total(meta,p.money.bank.accounts.filter(a=>a.kind !== 'credit').map(a=>({amount:a.balance,currency:a.currency || p.money.currency})),bankDisplayCurrency(p),bankDate(p));
}
const missingSum = (p,sum) => sum.missing.length ? `<span class="ax_fxwait">${sum.missing.map(x=>`${esc(fmtIn(p,x.amount,x.currency))} 환산 대기`).join(' · ')}</span>` : '';
// 표시 통화 · 환산 날짜 · 환율 확인 in one white strip: each half shows its value, the real picker lies over it unseen
function displayTools(p) {
    const selected = bankDisplayCurrency(p), options = [...new Set([selected,...Object.values(LOCAL_CURRENCY),p.money.currency].filter(Boolean))];
    const d = String(bankDate(p) || '').match(/^(\d{4})-(\d{2})-(\d{2})/), day = d ? fmtDate(p, `${d[2]}-${d[3]}`) : '날짜 정하기';
    return `<div class="ax_fx_tools">
      <label class="ax_fxs">${ax('globe', 17, 'currentColor', 1.9)}<span><small>표시 통화</small><b>${esc(selected)}</b></span>${ax('chev', 12, '#a3aab4', 2.4)}<select class="bank_display" aria-label="표시 통화">${options.map(c=>`<option value="${esc(c)}" ${c === selected ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="ax_fxs">${ax('cal', 17, 'currentColor', 1.9)}<span><small>환산 날짜</small><b class="cg_num">${esc(day)}</b></span>${ax('chev', 12, '#a3aab4', 2.4)}<input type="date" class="bank_fxdate" aria-label="환산 날짜" value="${esc(bankDate(p))}"></label>
      <button type="button" class="bank_fxrefresh" aria-label="환율 확인">${ax('again', 17, 'currentColor', 2.1)}</button></div>`;
}
const busyOf = (p, k) => filling.has(`${nameKey(p.owner)}:${k}`);
const mo = p => { const M = p.money; if (!M) return null; M.tx ||= []; M.passes ||= []; M.orders ||= []; M.cards ||= []; (M.bank ||= {}).accounts ||= []; return M; };
const acctOf = (p, last4) => mo(p)?.bank?.accounts?.find(a => a.last4 === last4);
const txMoney = (p, x, signed = false) => fmtMoney({ ...p, money: { currency: x.currency || acctOf(p, x.account)?.currency || mo(p)?.currency } }, x.amount, signed);
// a memo as the bank shows it: a delivery payment written before the app's name was kept ("Delivery") names the app now,
// and Uber Eats reads 우버이츠 with Korean on
const OLD_DLV = { Delivery: '', Pickup: ' 픽업', Refund: ' 환불' };
const memoOf = (p, x) => {
    let m = String(x.memo || '');
    if (x.delivery && m in OLD_DLV) { const app = dlvApp(p); m = app + (m === 'Pickup' && app === '배달의민족' ? ' 포장' : OLD_DLV[m]); }
    return koOn() ? m.replace(/^Uber Eats\b/, '우버이츠') : m;
};
const kindName = { checking: '입출금', savings: '저축', credit: '신용카드' };
const fi = (t, z = 36, c = axTint(t), r = 12) => `<span class="ax_fi" style="width: ${z}px; height: ${z}px; border-radius: ${r}px; background: ${c}">${esc([...String(t || '?').trim()][0]?.toUpperCase() || '?')}</span>`;

// 관련 기록: every other record with the same story-event tag, opening in its own app
export function relatedRows(p, ev, skip = '') {
    if (!ev) return '';
    const rows = [];
    const add = (go, i, icon, color, title, sub) => { if (`${go}:${i}` !== skip) rows.push(`<button type="button" class="ax_rw" data-go="${go}" data-i="${i}"><span class="ax_fi" style="width: 30px; height: 30px; background: ${color}">${ax(icon, 15, '#fff')}</span><span class="ax_tx"><b>${esc(title)}</b><span class="ax_p">${esc(sub)}</span></span>${ax('chev', 15, '#b7bdc6', 2.4)}</button>`); };
    (p.mails || []).forEach((x, k) => { if (x.ev === ev) add('mailone', k, 'mail', '#8faed1', x.subject || x.from, `메일 · ${fmtDate(p, x.time, true)}`); });
    p.events.forEach((x, k) => { if (x.ev === ev) add('calone', k, 'cal', '#b0564e', x.title, `캘린더 · ${fmtDate(p, x.date, true)}${x.time ? ` ${x.time}` : ''}`); });
    for (const x of mo(p)?.passes || []) if (x.ev === ev) add('pass', x.id, 'ticket', '#3d4a66', passBy(x), `지갑 · ${passDate(p, x)}`);
    for (const x of mo(p)?.orders || []) if (x.ev === ev) add('order', x.id, 'bag', '#2f7d74', x.item, `쇼핑 · ${fmtDate(p, x.time, true)}`);
    for (const x of mo(p)?.tx || []) if (x.ev === ev) add('tx', x.id, 'card', '#2c4a80', `${txMoney(p, x, true)} ${x.amount < 0 ? '결제' : '입금'}`, `은행 · ${x.who}`);
    p.photos.forEach((x, k) => { if (x.ev === ev) add('photoone', k, 'photo', '#d89f98', x.caption, `사진 · ${fmtDate(p, x.time, true)}`); });
    return rows.length ? `<div class="ax_sec">관련 기록</div><div class="ax_card">${rows.join('')}</div>` : '';
}

// an app with nothing yet: one 채우기 for 은행 · 지갑 · 쇼핑 together, or for 음성 메모
function emptyApp(p, now, title, kind, what) {
    const busy = busyOf(p, kind);
    return `${axBar(p, now)}
      ${axTop(axCb('home2'))}
      <div class="ax_scroll">
        ${axH1(title)}
        <div class="ax_card ax_fillc"><p>${what}</p>
          <button type="button" class="ax_fillb na_ph_fill" data-k="${kind}" ${busy ? 'disabled' : ''}>${busy ? `${busyHtml} 채우는 중` : '채우기'}</button>
          </div>
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}

// ---- 은행
const tab = on => `<div class="ax_btab">${[['homeS', '홈', 'bank'], ['send2', '송금', 'banksend'], ['card2', '카드', 'wallet'], ['menu', '더보기', 'bankmore']].map(([k, l, go]) => (go ? `<button type="button" class="${k === on ? 'on' : ''}" data-go="${go}">${ax(k, 24, 'currentColor')}${l}</button>` : `<span>${ax(k, 24, 'currentColor')}${l}</span>`)).join('')}</div>`;
// how a record moved: a card bill (its two halves), a transfer, a card payment, cash, money in
// a balance adjustment has no payee: its name is 잔액 조정, the model's reason only in the record (사유)
// in the bank's own language, like every other record (a German bank: Saldokorrektur, the Korean as its ko line)
const ADJ = [[/^(DE|AT|CH|LI|LU)$/, 'Saldokorrektur'], [/^KR$/, '잔액 조정'], [/^JP$/, '残高調整'], [/^(CN|TW|HK|MO|SG)$/, '余额调整'], [/^(FR|BE|MC)$/, 'Correction de solde'],
    [/^(ES|MX|AR|CL|CO|PE|BO|CU|PR)$/, 'Ajuste de saldo'], [/^(PT|BR)$/, 'Ajuste de saldo'], [/^IT$/, 'Rettifica saldo'], [/^NL$/, 'Saldocorrectie'], [/^(SE)$/, 'Saldojustering'], [/^(NO|DK)$/, 'Saldojustering'], [/^PL$/, 'Korekta salda']];
let adjName = 'Balance adjustment';
const txName = x => (x.adjust ? adjName : x.who);
const adjFor = p => { const c = homeCountry(p); adjName = (ADJ.find(([re]) => re.test(c)) || [null, 'Balance adjustment'])[1]; };
const txWay = x => (x.cardBill ? '카드 대금' : x.adjust ? '' : x.kind === 'card' ? '카드' : x.kind === 'transfer' ? '송금' : x.kind === 'cash' ? '현금 인출' : '입금');
// a record the clock put in (a salary, a rent) says 자동; a line that only makes the balance what the story said says 추정
const txMarks = x => `${x.auto ? ' · 자동이체' : ''}`;
const txRow = (p, x) => `<button type="button" class="ax_rw" data-go="tx" data-i="${x.id}">${fi(txName(x), 38)}<span class="ax_tx"><b class="ax_n">${esc(txName(x))}${x.pending ? '<span class="ax_pend">대기</span>' : ''}${x.ev && (mo(p).orders.some(o => o.ev === x.ev) || mo(p).passes.some(o => o.ev === x.ev)) ? `<span class="ax_lnk">${ax('link', 10, 'currentColor', 2.4)} ${mo(p).orders.some(o => o.ev === x.ev) ? '쇼핑' : '지갑'}</span>` : ''}</b><span class="ax_p">${esc(fmtDate(p, x.time, true))}${txWay(x) ? ` · ${txWay(x)}` : ''}${txMarks(x)}${x.memo && !(x.adjust && x.memo === '잔액 맞춤') ? ` · ${esc(memoOf(p, x))}` : ''}</span></span><span class="ax_amt ${x.amount > 0 ? 'p' : ''} cg_num">${esc(txMoney(p, x, true))}</span></button>`;
const newestTx = p => [...(mo(p)?.tx || [])].sort(byStory(p.now)).reverse();
export function bankHome(p, now) {
    adjFor(p);
    const M = mo(p);
    if (!M) return emptyApp(p, now, '은행', 'money', '아직 계좌가 없어요. 채우면 은행 · 지갑 · 쇼핑이 함께 생겨요.');
    const sum = bankSum(p);
    return `<div class="ax_bk">
      <div class="ax_bkh">${axBar(p, now, '#fff')}
        <div class="ax_bkr"><button type="button" class="ax_bkc" data-go="home2" aria-label="뒤로">${ax('back', 18, '#fff', 2.3)}</button><span class="ax_bkhi"><small>${esc(M.bank.name)}</small><b>안녕하세요, ${esc(p.owner)}</b></span><button type="button" class="ax_bkc" data-go="banknote" aria-label="알림">${ax('bell', 18, '#fff')}</button></div>
        <div class="ax_bktot"><small>${sum.complete ? '예금 잔액 · ' + esc(bankDisplayCurrency(p)) + ' 기준' : '환산 가능한 소계 · 환산 미완료'}</small><b class="cg_num">${esc(fmtIn(p, sum.value, bankDisplayCurrency(p)))}</b>${missingSum(p,sum)}<span>계좌 ${M.bank.accounts.length}개 · 환산 기준 ${esc(bankDate(p) || '날짜 미확정')}</span></div>
        <div class="ax_bkacts"><button type="button" data-go="banksend"><b>${ax('send2', 20, '#fff', 2.2)}</b>송금</button><button type="button" data-go="fixed"><b>${ax('rep', 20, '#fff', 2.1)}</b>고정 지출</button><button type="button" data-go="stmt"><b>${ax('doc', 20, '#fff')}</b>명세서</button><button type="button" data-go="wallet"><b>${ax('card2', 20, '#fff', 1.9)}</b>카드</button></div>
      </div>
      <div class="ax_bks"><div class="ax_scroll">
        ${displayTools(p)}<div class="ax_shd">내 계좌</div>
        <div class="ax_card">${M.bank.accounts.map((a, i) => `<button type="button" class="ax_acc" data-go="acct" data-i="${i}"><span class="ax_accic ${a.kind}">${ax(a.kind === 'savings' ? 'star' : 'card2', 20, 'currentColor', 1.9)}</span><span class="ax_tx"><b>${kindName[a.kind]}${a.name ? ` · ${esc(a.name)}` : ''}</b><small class="cg_num">•••• ${esc(a.last4)}${a.closed ? ' · 해지' : a.blocked ? ' · 거래 정지' : ''}</small></span><span class="ax_accv"><b class="cg_num">${esc(fmtMoney({ ...p, money: { currency: a.currency || M.currency } }, a.kind === 'credit' ? creditAmount(a) : a.balance))}</b><small>${a.closed ? '해지' : a.kind === 'credit' ? creditLabel(a) : '사용 가능'}</small>${converted(p,a) ? `<small class="ax_fx_note">${converted(p,a,true)}</small>` : ''}</span></button>`).join('')}</div>
        ${wealthLine(p)}
        ${(ms => (ms.length ? `<div class="ax_shd">이번 달</div><div class="ax_card">${ms.map(x => `<div class="ax_rln"><span>${ms.length > 1 ? `${esc(x.currency)} · ` : ''}입금</span><b class="ax_amt p cg_num">${esc(fmtIn(p, x.in, x.currency, true))}</b></div><div class="ax_rln"><span>${ms.length > 1 ? `${esc(x.currency)} · ` : ''}출금</span><b class="ax_amt cg_num">${esc(fmtIn(p, -x.out, x.currency, true))}</b></div>`).join('')}</div>` : ''))(monthSoFar(p).filter(x => x.in || x.out))}
        <div class="iv_navs"><button type="button" class="iv_nav" data-go="invest">투자 계좌</button><button type="button" class="iv_nav" data-go="ivactivity">연결된 이체</button></div><div class="ax_shd">최근 거래</div>
        <div class="ax_card">${newestTx(p).slice(0, 4).map(x => txRow(p, x)).join('') || '<div class="ax_empty">거래가 없어요</div>'}</div>
        <i class="ax_pad"></i>
      </div></div>
      ${tab('homeS')}</div>${axInd()}`;
}
export function bankAcct(p, now, key) {
    adjFor(p);
    const [i, f = 'all'] = String(key).split('.'), a = mo(p)?.bank?.accounts?.[Number(i)];
    if (!a) return bankHome(p, now);
    migrateBank(getMeta(), p);
    const all = newestTx(p).filter(x => x.account === a.last4), xs = all.filter(x => f === 'in' ? x.amount > 0 : f === 'out' ? x.amount < 0 : true);
    const pend = xs.filter(x => x.pending), done = xs.filter(x => !x.pending), days = [...new Set(done.map(x => x.time.slice(0, 5)))];
    const pendSum = all.filter(x => x.pending).reduce((s, x) => s + x.amount, 0);
    const chip = (k, l) => `<button type="button" class="${f === k ? 'on' : ''}" data-go="acct" data-i="${i}.${k}">${l}</button>`;
    return `<div class="ax_bk">
      <div class="ax_bkh">${axBar(p, now, '#fff')}
        <div class="ax_bkr"><button type="button" class="ax_bkc" data-go="bank" aria-label="뒤로">${ax('back', 18, '#fff', 2.3)}</button><span class="ax_bkt">${kindName[a.kind]} · ${esc(a.last4)}</span><span class="ax_bkc ax_ghost"></span></div>
        <div class="ax_bktot ax_center"><small>${a.kind === 'credit' ? creditLabel(a) : '사용 가능 잔액'}</small><b class="cg_num">${esc(fmtMoney({ ...p, money: { currency: a.currency || mo(p).currency } }, a.kind === 'credit' ? creditAmount(a) : a.balance))}</b>${converted(p,a) ? `<span>${converted(p,a)}</span>` : ''}<span>${a.closed ? `해지된 계좌${a.closed.since ? ` · ${esc(fmtDate(p, a.closed.since, true))}` : ''}` : pendSum ? `대기 중 ${esc(fmtMoney({ ...p, money: { currency: a.currency || mo(p).currency } }, pendSum, true))}` : a.kind === 'credit' && (a.billDay || a.paidFrom) ? [a.billDay ? `결제일 매달 ${Number(a.billDay)}일` : '', a.paidFrom ? `출금 ${kindName[acctOf(p, a.paidFrom)?.kind] || '계좌'} ${esc(a.paidFrom)}` : ''].filter(Boolean).join(' · ') : esc(a.name || '')}</span></div>
        <div class="ax_bkacts ax_three"><button type="button" data-go="banksend" data-i="${i}~"><b>${ax('send2', 20, '#fff', 2.2)}</b>송금</button><button type="button" data-go="fixed" data-i="${i}~"><b>${ax('rep', 20, '#fff', 2.1)}</b>고정 지출</button><button type="button" data-go="stmt" data-i="${i}"><b>${ax('doc', 20, '#fff')}</b>명세서</button></div>
      </div>
      <div class="ax_bks"><div class="ax_scroll">
        <div class="ax_chips">${chip('all', '전체')}${chip('in', '입금')}${chip('out', '출금')}</div>
        ${pend.length ? `<div class="ax_sec">대기 중</div><div class="ax_card">${pend.map(x => txRow(p, x)).join('')}</div>` : ''}
        ${days.map(d => `<div class="ax_sec">${esc(axDay(p, now, d))}</div><div class="ax_card">${done.filter(x => x.time.slice(0, 5) === d).map(x => txRow(p, x)).join('')}</div>`).join('')}
        ${xs.length ? '' : '<div class="ax_empty">거래가 없어요</div>'}
        <i class="ax_pad"></i>
      </div></div>
      ${tab('homeS')}</div>${axInd()}`;
}
const reg = (p, x) => (mo(p)?.regulars || []).find(r => r.id === x.regular);
const regWhen = (p, r) => (r.frequency === 'weekly' ? `매주 ${'일월화수목금토'[Number(r.day)] ?? ''}요일` : r.frequency === 'yearly' ? `매년 ${fmtDate(p, String(r.day || ''), true)}` : `매달 ${Number(r.day) || ''}일`);
export function bankTx(p, now, id) {
    adjFor(p);
    const x = mo(p)?.tx?.find(t => t.id === id);
    if (!x) return bankHome(p, now);
    const a = acctOf(p, x.account), ai = mo(p).bank.accounts.indexOf(a);
    return `<div class="ax_bk">
      <div class="ax_bkh ax_bkhs">${axBar(p, now, '#fff')}
        <div class="ax_bkr"><button type="button" class="ax_bkc" data-go="${ai >= 0 ? `acct:${ai}` : 'bank'}" aria-label="뒤로">${ax('back', 18, '#fff', 2.3)}</button><span class="ax_bkt">거래 상세</span><button type="button" class="ax_bkc" data-go="txdoc" data-i="${x.id}" aria-label="확인증">${ax('share', 17, '#fff')}</button></div>
      </div>
      <div class="ax_bks ax_bkso"><div class="ax_scroll">
        <div class="ax_rcpt"><div class="ax_rch">${fi(txName(x), 56, axTint(txName(x)), 18)}<b>${esc(txName(x))}</b>${x.adjust ? (adjName !== '잔액 조정' && koOn() ? '<small>잔액 조정</small>' : '') : x.ko && koOn() ? `<small>${esc(x.ko)}</small>` : ''}<strong class="cg_num">${esc(txMoney(p, x, true))}</strong><span class="ax_rok ${x.pending ? 'pend' : ''}">${x.pending ? '대기 중' : '완료'}</span></div>
          <div class="ax_rln"><span>날짜</span><span class="cg_num">${esc(fmtDate(p, x.time))} ${esc(fmtTime(p, x.time))}</span></div>
          <div class="ax_rln"><span>계좌</span><span>${a ? `${kindName[a.kind]} •••• ${esc(a.last4)}` : '—'}</span></div>
          <div class="ax_rln"><span>방식</span><span>${x.adjust ? '잔액 조정' : x.kind === 'card' && !x.cardBill ? '카드 결제' : txWay(x)}${x.auto ? ' · 자동이체' : ''}</span></div>
          ${x.auto && reg(p, x) ? `<div class="ax_rln"><span>정기</span><span>${esc(reg(p, x).name)} · ${esc(regWhen(p, reg(p, x)))}</span></div>` : ''}
          ${x.adjust && x.who && x.who !== '잔액 조정' ? `<div class="ax_rln"><span>사유</span><span>${esc(x.who)}</span></div>` : ''}
          ${x.memo && !(x.adjust && x.memo === '잔액 맞춤') ? `<div class="ax_rln"><span>메모</span><span>${esc(memoOf(p, x))}</span></div>` : ''}</div>
        ${relatedRows(p, x.ev, `tx:${x.id}`)}
        <i class="ax_pad"></i>
      </div></div>
      ${tab('homeS')}</div>${axInd()}`;
}

// ---- 고정 지출: what leaves every month, found in the bank's own records (no field for the model): the same payee in two
// months for about the same money, or a payee or memo that names rent, a phone bill, a subscription, insurance, a gym
Object.assign(AX, {
    rep: 'M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3', house: 'M4 11l8-7 8 7v9H4zM10 20v-5h4v5',
    mobile: 'M7 3h10v18H7zM11 18h2', screen: 'M3 5h18v13H3zM10 9l5 2.5-5 2.5z', note8: 'M9 18V6l10-2v12M9 18a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 0 1 4.8 0zM19 16a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 0 1 4.8 0',
    // the bank's card: rounded, one stripe
    card2: 'M5.5 5.5h13A2.5 2.5 0 0 1 21 8v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16V8a2.5 2.5 0 0 1 2.5-2.5zM3 10h18',
    shield: 'M12 3L5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z', dumbbell: 'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10',
});
const FIXED = [
    [/\bmiete\b|\brent\b|월세|관리비|전세|nebenkosten|hausgeld|wohnung|家賃|房租|loyer|alquiler/i, 'house', '#e2e9f5', '#2c4a80', '집'],
    [/telekom|vodafone|\bo2\b|verizon|t-mobile|at&t|\bkt\b|lg ?u\+|sk ?텔레콤|통신|휴대폰|핸드폰|인터넷|internet|mobilfunk|handyvertrag|携帯|ドコモ|softbank|话费|中国移动|orange|free mobile/i, 'mobile', '#f6e7e1', '#b8573a', '통신'],
    [/netflix|disney|youtube|prime video|amazon prime|\bhbo\b|crunchyroll|wavve|티빙|tving|왓챠|watcha|쿠팡플레이|dazn|paramount|hulu|abema|爱奇艺|腾讯视频/i, 'screen', '#f3e1e3', '#b23a48', '구독'],
    [/spotify|apple music|melon|멜론|지니뮤직|플로|deezer|tidal|soundcloud|youtube music|line music|qq音乐|网易云/i, 'note8', '#e3f1e8', '#2f7d4f', '구독'],
    [/versicherung|insurance|보험|allianz|\baxa\b|krankenkasse|\btk\b|\baok\b|保険|保险|assurance|seguro/i, 'shield', '#e8e4f3', '#5a4a9a', '보험'],
    [/\bgym\b|fitness|mcfit|urban sports|헬스|필라테스|요가|yoga|クラブ|健身/i, 'dumbbell', '#e4eef3', '#2f6f8f', '운동'],
    [/\bstrom\b|stadtwerke|electric|energie|전기|가스요금|도시가스|수도|wasser|rundfunk|\bgez\b|utility|電気|电费/i, 'bolt', '#f5edd6', '#8a6a1f', '공과금'],
    [/icloud|google one|dropbox|chatgpt|openai|adobe|microsoft 365|office 365|notion|patreon|\babo\b|abonnement|subscription|구독|정기결제|サブスク|订阅|game pass|playstation plus|nintendo online/i, 'rep', '#eceef2', '#3f4a5a', '구독'],
    [/sparplan|적금|정기적금|savings plan|積立|定投/i, 'star', '#dcefdf', '#3f7d50', '저축'],
];
const PAYDAY = /\blohn\b|gehalt|salary|payroll|\bwage|월급|급여|給料|给料|工资|salaire|sueldo/i;
// one payee whatever language a record names it in: its Korean name when it has one ("Netflix" with ko "넷플릭스" is 넷플릭스)
const payee = x => String(x.ko || x.who || '').toLowerCase().replace(/[^\p{L}\p{N}&+]+/gu, ' ').trim().split(' ').slice(0, 2).join(' ');
// a record's year: the phone's, or the one before for a month past the story's now (December, read in January)
const yearOf = (p, mm) => { if (!p.year || p.noYear) return null; const n = Number(String(storyNow(p) || p.now || '').slice(0, 2)); return p.year - (n && Number(mm) > n ? 1 : 0); };
// a paper's day: with its year when the story has one (2026. 10. 30. · 10/30/2026 · 30.10.2026), else the short date
const paperDay = (p, mm, dd) => { const y = yearOf(p, mm), md = `${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`; return y ? fullDate(p, `${y}-${md}`) : fmtDate(p, md, true); };
const daysIn = (p, mm) => new Date(Date.UTC(Number(p.year) || 2025, Number(mm), 0)).getUTCDate();
export function fixedCosts(p) {
    const M = mo(p); if (!M) return [];
    const groups = new Map();
    for (const x of M.tx || []) if (x.amount < 0 && x.who) { const k = payee(x); if (k) groups.set(k, [...(groups.get(k) || []), x]); }
    const out = [];
    for (const [k, xs0] of groups) {
        const xs = [...xs0].sort(byStory(p.now)).reverse(), last = xs[0], words = xs.map(x => `${x.who} ${x.memo || ''} ${x.ko || ''}`).join(' ');
        const cat = FIXED.find(([re]) => re.test(words));
        const months = [...new Set(xs.map(x => String(x.time).slice(0, 2)))];
        // without a word: two months, the same amount (to within a few cents in a hundred) on about the same day, not a person
        const dd = (a, b) => { const d = Math.abs(Number(String(a.time).slice(3, 5)) - Number(String(b.time).slice(3, 5))); return Math.min(d, 31 - d); };
        // against the newest record of another month (two coffees this month are not a monthly charge)
        const prev = xs.find(x => String(x.time).slice(0, 2) !== String(last.time).slice(0, 2));
        const steady = !!prev && last.kind !== 'transfer' && Math.abs(prev.amount - last.amount) <= Math.abs(last.amount) * 0.03 && dd(prev, last) <= 3;
        if (!cat && !steady) continue;
        const [, icon, bg, fg, label] = cat || [null, 'rep', '#eceef2', '#3f4a5a', '매달'];
        out.push({ key: k, who: last.who, ko: last.ko, amount: last.amount, account: last.account, currency: last.currency, day: Number(String(last.time).slice(3, 5)) || 1, icon, bg, fg, label, xs });
    }
    // the regular ones the story told (p.money.regulars: salary, rent, a subscription) come first and take their payments
    const WK = '일월화수목금토';
    const regs = (M.regulars || []).filter(r => r && finite(r.amount) && r.amount < 0).map(r => {
        const xs = [...(M.tx || [])].filter(x => x.regular === r.id || !x.regular && payee(x) && payee(x) === payee({ who: r.name, ko: '' })).sort(byStory(p.now)).reverse();
        const words = `${r.name} ${(r.names || []).join(' ')} ${xs.map(x => `${x.who} ${x.memo || ''} ${x.ko || ''}`).join(' ')}`, cat = FIXED.find(([re]) => re.test(words));
        const [, icon, bg, fg, label] = cat || [null, 'rep', '#eceef2', '#3f4a5a', '정기'];
        const fq = r.frequency === 'weekly' ? 'weekly' : r.frequency === 'yearly' ? 'yearly' : 'monthly';
        const day = fq === 'monthly' ? Math.min(31, Math.max(1, Number(r.day) || Number(String(xs[0]?.time || '').slice(3, 5)) || 1)) : fq === 'weekly' ? 0 : Number(String(r.day || '').slice(3, 5)) || 1;
        const when = fq === 'weekly' ? `매주 ${WK[Number(r.day)] ?? ''}요일`.replace('매주 요일', '매주') : fq === 'yearly' ? `매년 ${Number(String(r.day || '').slice(0, 2)) || ''}월 ${day}일`.replace(' 0월', '') : `매달 ${day}일`;
        return { key: `r${r.id}`, who: r.name, ko: '', amount: r.amount, account: r.account, currency: r.currency, day, fq, when, stopped: r.status === 'stopped', icon, bg, fg, label, xs, regular: r };
    });
    const taken = new Set(regs.flatMap(r => r.xs));
    return [...regs, ...out.filter(f => !f.xs.some(x => taken.has(x)))].sort((a, b) => a.stopped - b.stopped || a.day - b.day);
}
// money that comes in on its own (p.money.regulars with + amounts: a salary, a rent paid to them)
const incoming = p => (mo(p)?.regulars || []).filter(r => r && finite(r.amount) && r.amount > 0 && r.status !== 'stopped');
export function fixedScreen(p, now, arg = '') {
    adjFor(p);
    const M = mo(p); if (!M) return bankHome(p, now);
    // 'a~key': a is the account (from its screen, only its payments), key the one opened
    const [af, key] = String(arg).includes('~') ? String(arg).split('~') : ['', String(arg)], fa = af !== '' ? M.bank.accounts[Number(af)] : null;
    const list = fixedCosts(p).filter(f => !fa || f.account === fa.last4), today = String(storyNow(p) || p.now || ''), mm = today.slice(0, 2), td = Number(today.slice(3, 5)) || 1, dim = daysIn(p, mm);
    const st = f => {
        if (f.stopped) return ['해지', 'g', ''];
        if (f.fq === 'weekly') return ['매주', 'g', ''];
        if (f.fq === 'yearly' && Number(String(f.regular?.day || '').slice(0, 2)) !== Number(mm)) return [`${Number(String(f.regular?.day || '').slice(0, 2)) || ''}월`, 'g', ''];
        if (f.xs.some(x => String(x.time).slice(0, 2) === mm)) return ['나감', 'ok', 'p'];
        if (f.day === td) return ['오늘', '', 'd'];
        if (f.day > td) return [`D-${f.day - td}`, f.day - td <= 7 ? '' : 'g', 'd'];
        return [`D-${dim - td + Math.min(f.day, daysIn(p, Number(mm) % 12 + 1))}`, 'g', ''];
    };
    const money = (f, n, signed) => fmtMoney({ ...p, money: { currency: f.currency || acctOf(p, f.account)?.currency || M.currency } }, n, signed);
    const live = list.filter(f => !f.stopped && f.fq !== 'yearly'), sum = live.reduce((s, f) => s + Math.abs(f.amount) * (f.fq === 'weekly' ? 4 : 1), 0), paid = list.filter(f => st(f)[1] === 'ok');
    const ins = incoming(p).filter(r => !fa || r.account === fa.last4), salary = ins.filter(r => r.frequency !== 'weekly' && r.frequency !== 'yearly').sort((a, b) => b.amount - a.amount)[0];
    const pay = salary ? { amount: salary.amount, currency: salary.currency, account: salary.account } : [...(M.tx || [])].filter(x => x.amount > 0 && PAYDAY.test(`${x.who} ${x.memo || ''} ${x.ko || ''}`)).sort(byStory(p.now)).pop();
    const sel = list.find(f => f.key === key) || list[0];
    const marks = new Map(); for (const f of list) { const s = st(f)[2]; if (s && f.day <= dim) marks.set(f.day, marks.get(f.day) === 'p' ? 'p' : s); }
    const acct = f => { const a = acctOf(p, f.account); return a ? `${kindName[a.kind]} ${a.last4}` : ''; };
    return `<div class="ax_bk">
      <div class="ax_bkh ax_bkhs">${axBar(p, now, '#fff')}
        <div class="ax_bkr"><button type="button" class="ax_bkc" data-go="${fa ? `acct:${af}` : 'bank'}" aria-label="뒤로">${ax('back', 18, '#fff', 2.3)}</button><span class="ax_bkt">고정 지출${fa ? ` · ${esc(fa.last4)}` : ''}</span><span class="ax_bkc ax_ghost"></span></div>
        <div class="ax_bktot ax_center"><small>월 고정 지출</small><b class="cg_num">${esc(fmtMoney(p, sum))}</b><span>${list.length ? pay ? `월급 ${esc(txMoney(p, pay))}의 ${Math.round(sum / pay.amount * 100)}%` : `${list.length}건 · 이번 달 ${paid.length}건 나감` : '아직 없어요'}</span></div>
      </div>
      <div class="ax_bks ax_bkso"><div class="ax_scroll">
        ${list.length ? `<div class="ax_fxcal">${Array.from({ length: dim }, (_, k) => `<i class="${[marks.get(k + 1) || '', k + 1 === td ? 't' : ''].join(' ').trim()}">${k + 1}</i>`).join('')}</div>
        <div class="ax_sec">${Number(mm) || ''}월</div>
        <div class="ax_card">${list.map(f => { const [t, c] = st(f); return `<button type="button" class="ax_rw${f === sel ? ' on' : ''}" data-go="fixed" data-i="${esc(`${af}~${f.key}`)}"><span class="ax_fi" style="width: 38px; height: 38px; background: ${f.bg}; color: ${f.fg}">${ax(f.icon, 20, 'currentColor', 1.9)}</span><span class="ax_tx"><b class="ax_n">${esc(f.who)}<span class="ax_dd ${c}">${t}</span></b><span class="ax_p">${esc(f.when || `매달 ${f.day}일`)}${acct(f) ? ` · ${esc(acct(f))}` : ''}</span></span><span class="ax_fxv"><b class="ax_amt cg_num">${esc(money(f, f.amount, true))}</b><small>${f.label}</small></span></button>`; }).join('')}</div>
        ${sel && sel.xs.length ? `<div class="ax_sec">지난 결제 · ${esc(sel.who)}</div><div class="ax_card">${sel.xs.map(x => txRow(p, x)).join('')}</div>` : ''}`
        : '<div class="ax_card ax_fillc"><p>고정 지출 내역이 없어요.<br>월세 · 통신비 · 구독 같은 결제가 생기면 여기 모여요.</p></div>'}
        ${ins.length ? `<div class="ax_sec">정기 입금</div><div class="ax_card">${ins.map(r => `<div class="ax_rw"><span class="ax_fi" style="width: 38px; height: 38px; background: #dcefdf; color: #3f7d50">${ax(PAYDAY.test(`${r.name} ${(r.names || []).join(' ')}`) ? 'star' : 'rep', 20, 'currentColor', 1.9)}</span><span class="ax_tx"><b class="ax_n">${esc(r.name)}</b><span class="ax_p">${r.frequency === 'weekly' ? `매주 ${'일월화수목금토'[Number(r.day)] ?? ''}요일` : r.frequency === 'yearly' ? `매년 ${esc(fmtDate(p, String(r.day || ''), true))}` : `매달 ${Number(r.day) || ''}일`}${r.who ? ` · ${esc(r.who)}` : ''}</span></span><span class="ax_fxv"><b class="ax_amt p cg_num">${esc(money({ currency: r.currency, account: r.account }, r.amount, true))}</b><small>정기 입금</small></span></div>`).join('')}</div>` : ''}
        <i class="ax_pad"></i>
      </div></div>
      ${tab('homeS')}</div>${axInd()}`;
}

// ---- 은행의 나머지 화면: 알림 · 송금 · 명세서 · 확인증 · 더보기. All read from the records the bank already has.
const bankHead = (p, now, back, title, tall = false, body = '', dark = false) => `<div class="ax_bkh${tall ? ' ax_bkhs' : ''}${dark ? ' ax_bkpv' : ''}">${axBar(p, now, '#fff')}
        <div class="ax_bkr"><button type="button" class="ax_bkc" data-go="${back}" aria-label="뒤로">${ax('back', 18, '#fff', 2.3)}</button><span class="ax_bkt">${title}</span><span class="ax_bkc ax_ghost"></span></div>${body}</div>`;
const acctMoney = (p, a, n, signed) => fmtMoney({ ...p, money: { currency: a?.currency || mo(p).currency } }, n, signed);
// each record's balance just after it, walking back from today's balance (pending ones leave it alone)
function balancesAfter(p) {
    const out = new Map(), M = mo(p);
    for (const a of M.bank.accounts) {
        if (a.kind === 'credit') continue;
        let bal = Number(a.balance) || 0;
        for (const x of newestTx(p).filter(x => x.account === a.last4)) { if (x.pending) continue; out.set(x.id, bal); bal -= x.amount; }
    }
    return out;
}
const txWhat = x => x.amount > 0 ? '입금' : x.kind === 'card' ? (x.pending ? '승인 대기' : '승인') : x.kind === 'transfer' ? '이체' : '출금';
// one look per kind of note: a soft tile with the line icon, like the accounts'
const NOTE_K = { in: ['down2', '#dcefdf', '#3f7d50', '입금'], card: ['card2', '#e2e9f5', '#2c4a80', '카드 승인'], wait: ['clock', '#f6ecd2', '#8a6a1f', '승인 대기'], send: ['send2', '#f6e7e1', '#b8573a', '이체'], out: ['send2', '#eceef2', '#4d5562', '출금'] };
export function bankNotes(p, now) {
    adjFor(p);
    const M = mo(p); if (!M) return bankHome(p, now);
    const bal = balancesAfter(p), xs = newestTx(p).slice(0, 24), today = String(storyNow(p) || p.now || ''), td = Number(today.slice(3, 5)) || 1;
    // within a week, the first days of next month too (the 2nd, read on the 28th)
    const dim = daysIn(p, today.slice(0, 2)), until = f => (f.day >= td ? f.day - td : dim - td + f.day);
    const soon = fixedCosts(p).filter(f => !f.stopped && (f.fq || 'monthly') === 'monthly' && !f.xs.some(x => String(x.time).slice(0, 2) === today.slice(0, 2)) && until(f) <= 7);
    const days = [...new Set(xs.map(x => String(x.time).slice(0, 5)))];
    const note = x => {
        const a = acctOf(p, x.account), b = bal.get(x.id), [ic, bg, fg, what] = NOTE_K[x.amount > 0 ? 'in' : x.pending ? 'wait' : x.kind === 'card' ? 'card' : x.kind === 'transfer' ? 'send' : 'out'];
        const way = x.adjust ? '' : x.cardBill ? '카드 대금' : what;
        return `<button type="button" class="ax_rw ax_bnr" data-go="tx" data-i="${x.id}"><span class="ax_fi" style="width: 40px; height: 40px; border-radius: 13px; background: ${bg}; color: ${fg}">${ax(ic, 19, 'currentColor', 2)}</span><span class="ax_tx"><b class="ax_n">${esc(txName(x))}</b><span class="ax_p">${[way, a ? esc(a.last4) : ''].filter(Boolean).join(' · ')} · <span class="cg_num">${esc(fmtTime(p, x.time))}</span></span></span><span class="ax_fxv"><b class="ax_amt cg_num${x.amount > 0 ? ' p' : ''}">${esc(txMoney(p, x, true))}</b><small class="cg_num">${b !== undefined ? `잔액 ${esc(acctMoney(p, a, b))}` : x.pending ? '대기 중' : ''}</small></span></button>`;
    };
    return `<div class="ax_bk">${bankHead(p, now, 'bank', '알림')}
      <div class="ax_bks"><div class="ax_scroll">
        ${soon.length ? `<div class="ax_sec">곧 나가요</div><div class="ax_card">${soon.map(f => `<button type="button" class="ax_rw ax_bnr" data-go="fixed" data-i="~${esc(f.key)}"><span class="ax_fi" style="width: 40px; height: 40px; border-radius: 13px; background: ${f.bg}; color: ${f.fg}">${ax(f.icon, 19, 'currentColor', 1.9)}</span><span class="ax_tx"><b class="ax_n">${esc(f.who)}<span class="ax_dd${until(f) <= 2 ? '' : ' g'}">${until(f) === 0 ? '오늘' : `D-${until(f)}`}</span></b><span class="ax_p">고정 지출 · 매달 ${f.day}일</span></span><span class="ax_fxv"><b class="ax_amt cg_num">${esc(fmtMoney({ ...p, money: { currency: f.currency || acctOf(p, f.account)?.currency || M.currency } }, f.amount, true))}</b><small>${esc(f.label)}</small></span></button>`).join('')}</div>` : ''}
        ${days.map(d => `<div class="ax_sec">${esc(axDay(p, now, d))}</div><div class="ax_card">${xs.filter(x => String(x.time).slice(0, 5) === d).map(note).join('')}</div>`).join('') || '<div class="ax_empty">알림이 없어요</div>'}
        <i class="ax_pad"></i>
      </div></div>
      ${tab('homeS')}</div>${axInd()}`;
}
// 송금: who the owner sends money to and gets it from (rent and the like stay on 고정 지출)
export function bankSend(p, now, arg = '') {
    adjFor(p);
    const M = mo(p); if (!M) return bankHome(p, now);
    const [af, key] = String(arg).includes('~') ? String(arg).split('~') : ['', String(arg)], fa = af !== '' ? M.bank.accounts[Number(af)] : null;
    const fixed = new Set(fixedCosts(p).flatMap(f => [f.key, payee({ who: f.who, ko: f.ko })])), groups = new Map();
    const mine = [M.bank.name, ...M.bank.accounts.map(a => a.name)].map(v => String(v || '').toLowerCase().replace(/\s+/g, '')).filter(v => v.length >= 2);
    const own = x => { const w = `${x.who || ''}${x.ko || ''}`.toLowerCase().replace(/\s+/g, ''); return mine.some(v => w.includes(v)) || /카드\s*대금|카드값|card (bill|payment)|kreditkarten?abrechnung/i.test(`${x.who} ${x.memo || ''}`); };
    for (const x of newestTx(p)) {
        if (fa && x.account !== fa.last4) continue;
        if (!(x.kind === 'transfer' || (x.amount > 0 && x.kind !== 'card' && x.kind !== 'cash'))) continue;
        // what the clock put in (a salary, a rent), a card bill and a balance adjustment are no person sent money
        if (x.auto || x.regular || x.cardBill || x.adjust) continue;
        // a salary, or money between the owner's own accounts (paying their card, into savings), is no person
        const k = payee(x); if (!k || fixed.has(k) || PAYDAY.test(`${x.who} ${x.memo || ''} ${x.ko || ''}`) || own(x)) continue;
        groups.set(k, [...(groups.get(k) || []), x]);
    }
    const ppl = [...groups].map(([k, xs]) => ({ k, xs, who: xs[0].who, out: xs.filter(x => x.amount < 0), in: xs.filter(x => x.amount > 0) })).sort((a, b) => b.xs.length - a.xs.length || byStory(p.now)(b.xs[0], a.xs[0]));
    const mm = String(storyNow(p) || p.now || '').slice(0, 2), month = [...groups.values()].flat().filter(x => String(x.time).slice(0, 2) === mm && !x.pending);
    const sent = Math.abs(month.filter(x => x.amount < 0).reduce((n, x) => n + x.amount, 0)), got = month.filter(x => x.amount > 0).reduce((n, x) => n + x.amount, 0);
    const sum = xs => xs.reduce((n, x) => n + Math.abs(x.amount), 0), sel = ppl.find(o => o.k === key);
    const cur = fa?.currency || M.currency, money = n => fmtIn(p, n, cur);
    return `<div class="ax_bk">${bankHead(p, now, fa ? `acct:${af}` : 'bank', `송금${fa ? ` · ${esc(fa.last4)}` : ''}`, false, `<div class="ax_bksp"><div><small>${Number(mm) || ''}월 송금</small><b class="cg_num">${esc(money(sent))}</b></div><div><small>${Number(mm) || ''}월 입금</small><b class="cg_num">${esc(money(got))}</b></div></div>`)}
      <div class="ax_bks"><div class="ax_scroll">
        ${ppl.length ? `<div class="ax_sec">자주 쓰는 계좌</div><div class="ax_ppl">${ppl.slice(0, 5).map(o => `<button type="button" data-go="banksend" data-i="${esc(`${af}~${o.k}`)}" class="${o === sel ? 'on' : ''}">${fi(o.who, 54, axTint(o.who), 27)}<span>${esc([...o.who].slice(0, 7).join(''))}</span></button>`).join('')}</div>
        <div class="ax_sec">받는 분별</div><div class="ax_card">${ppl.map(o => `<button type="button" class="ax_rw${o === sel ? ' on' : ''}" data-go="banksend" data-i="${esc(`${af}~${o.k}`)}">${fi(o.who, 38)}<span class="ax_tx"><b class="ax_n">${esc(o.who)}</b><span class="ax_ppm">${o.out.length ? `<em>송금 ${o.out.length}건 · ${esc(money(sum(o.out)))}</em>` : ''}${o.in.length ? `<u>입금 ${o.in.length}건 · ${esc(money(sum(o.in)))}</u>` : ''}</span></span><span class="ax_fxv"><b class="ax_amt cg_num ${o.xs[0].amount > 0 ? 'p' : ''}">${esc(txMoney(p, o.xs[0], true))}</b><small>${esc(fmtDate(p, o.xs[0].time, true))}${o.xs[0].memo ? ` ${esc(memoOf(p, o.xs[0]))}` : ''}</small></span></button>`).join('')}</div>
        ${sel ? `<div class="ax_sec">${esc(sel.who)}와 주고받은 돈</div><div class="ax_card">${sel.xs.map(x => txRow(p, x)).join('')}</div>` : ''}`
        : '<div class="ax_card ax_fillc"><p>아직 주고받은 돈이 없어요.</p></div>'}
        <i class="ax_pad"></i>
      </div></div>
      ${tab('send2')}</div>${axInd()}`;
}
// what kind of spending a record is, for the statement's bars
const kindOf = x => { const w = `${x.who} ${x.memo || ''} ${x.ko || ''}`; const f = FIXED.find(([re]) => re.test(w)); if (f) return f[4]; const s2 = SPEND.find(([, , re]) => re.test(w)); return s2 ? s2[0] : '그 밖'; };
// 명세서: one account, one month, on paper
export function bankStmt(p, now, arg = '') {
    adjFor(p);
    const M = mo(p); if (!M) return bankHome(p, now);
    const [ai0, m0] = String(arg).split('.'), from = ai0 !== '' && ai0 !== undefined;
    const ai = from ? Number(ai0) : Math.max(0, M.bank.accounts.findIndex(a => a.kind !== 'credit')), a = M.bank.accounts[ai];
    if (!a) return bankHome(p, now);
    // months in story order, across New Year too: how many months back from the story's now (December is 1 back in January)
    const today = String(storyNow(p) || p.now || ''), nowM = Number(today.slice(0, 2)) || 0, back = m => (nowM - Number(m) + 12) % 12;
    const all = newestTx(p).filter(x => x.account === a.last4 && !x.pending), months = [...new Set(all.map(x => String(x.time).slice(0, 2)))].sort((x, y) => back(y) - back(x));
    const mm = m0 || (months.includes(today.slice(0, 2)) ? today.slice(0, 2) : months[months.length - 1] || today.slice(0, 2));
    const xs = all.filter(x => String(x.time).slice(0, 2) === mm), later = all.filter(x => back(String(x.time).slice(0, 2)) < back(mm));
    const credit = a.kind === 'credit', end = credit ? null : (Number(a.balance) || 0) - later.reduce((n, x) => n + x.amount, 0), start = credit ? null : end - xs.reduce((n, x) => n + x.amount, 0);
    const inn = xs.filter(x => x.amount > 0).reduce((n, x) => n + x.amount, 0), out = -xs.filter(x => x.amount < 0).reduce((n, x) => n + x.amount, 0);
    const cats = new Map(); for (const x of xs) if (x.amount < 0) cats.set(kindOf(x), (cats.get(kindOf(x)) || 0) - x.amount);
    const bars = [...cats].sort((x, y) => y[1] - x[1]).slice(0, 5), top = Math.max(1, ...bars.map(b => b[1]));
    const last = xs.length ? Math.max(...xs.map(x => Number(String(x.time).slice(3, 5)) || 1)) : 1;
    const mon = n => esc(acctMoney(p, a, n)), sgn = n => esc(acctMoney(p, a, n, true));
    return `<div class="ax_bk">${bankHead(p, now, from ? `acct:${ai}` : 'bank', `명세서 · ${esc(a.last4)}`, true)}
      <div class="ax_bks ax_bkso"><div class="ax_scroll">
        ${months.length > 1 ? `<div class="ax_chips ax_mch">${months.map(m => `<button type="button" class="${m === mm ? 'on' : ''}" data-go="stmt" data-i="${ai}.${m}">${Number(m)}월</button>`).join('')}</div>` : ''}
        <div class="ax_stm">
          <div class="ax_stt"><div><b>${esc(M.bank.name)}</b><small>${esc(p.owner)} · ${kindName[a.kind]} •••• ${esc(a.last4)}</small></div><div class="r"><b>${credit ? '카드 이용대금 명세서' : '거래명세서'}</b><small class="cg_num">${esc(paperDay(p, mm, 1))} – ${esc(fmtDate(p, `${mm}-${String(last).padStart(2, '0')}`, true))}</small></div></div>
          <div class="ax_sts">${credit ? '' : `<div><small>시작 잔액</small><b class="cg_num">${mon(start)}</b></div><div><small>끝 잔액</small><b class="cg_num">${mon(end)}</b></div>`}<div><small>들어온 돈</small><b class="cg_num p">${sgn(inn)}</b></div><div><small>${credit ? '쓴 돈' : '나간 돈'}</small><b class="cg_num">${sgn(-out)}</b></div></div>
          ${bars.length ? `<div class="ax_stb">${bars.map(([n, v]) => `<div><span>${esc(n)}</span><i style="width: ${Math.max(3, Math.round(v / top * 100))}%"></i><em class="cg_num">${mon(v)}</em></div>`).join('')}</div>` : ''}
          <table class="ax_stl">${xs.map(x => `<tr data-go="tx" data-i="${x.id}"><td class="cg_num">${esc(fmtDate(p, x.time, true))}</td><td>${esc(txName(x))}</td><td class="cg_num${x.amount > 0 ? ' p' : ''}">${sgn(x.amount)}</td></tr>`).join('') || '<tr><td colspan="3">이 달 거래가 없어요</td></tr>'}</table>
        </div>
        <i class="ax_pad"></i>
      </div></div>
      ${tab('homeS')}</div>${axInd()}`;
}
// 공유: the paper that goes with a record (a transfer's confirmation, a card slip, a deposit note), with the bank's stamp
export function txDoc(p, now, id) {
    adjFor(p);
    const M = mo(p), x = M?.tx?.find(t => t.id === id); if (!x) return bankHome(p, now);
    const a = acctOf(p, x.account), card = x.kind === 'card' && x.amount < 0, inn = x.amount > 0, h = hashOf(`${x.id}${x.who}`);
    const title = card ? '카드 매출전표' : inn ? '입금확인증' : '이체확인증';
    const when = `${paperDay(p, String(x.time).slice(0, 2), String(x.time).slice(3, 5))} ${fmtTime(p, x.time)}`, mine = `${esc(p.owner)} · ${a ? `${kindName[a.kind]} •••• ${esc(a.last4)}` : ''}`;
    const ln = (k, v) => v ? `<div class="ax_dln"><span>${k}</span><span>${v}</span></div>` : '';
    const rows = card ? ln('가맹점', esc(txName(x))) + ln('카드', a ? `•••• •••• •••• ${esc(a.last4)}` : '') + ln('승인 번호', `<span class="cg_num">${String(h % 100000000).padStart(8, '0')}</span>`) + ln('승인 일시', `<span class="cg_num">${esc(when)}</span>`) + ln('결과', x.pending ? '승인 대기' : '승인')
        : inn ? ln('보낸 분', esc(txName(x))) + ln('받는 분', mine) + ln('받은 날', `<span class="cg_num">${esc(when)}</span>`) + ln('메모', esc(memoOf(p, x))) + ln('결과', '정상 입금')
        : ln('보낸 분', mine) + ln('받는 분', esc(txName(x))) + ln('보낸 날', `<span class="cg_num">${esc(when)}</span>`) + ln('메모', esc(memoOf(p, x))) + ln('결과', x.pending ? '처리 중' : '정상 처리');
    const bank = String(M.bank.name || 'BANK').toUpperCase().split(/\s+/).slice(0, 2);
    return `<div class="ax_bk">${bankHead(p, now, `tx:${x.id}`, title, true)}
      <div class="ax_bks ax_bkso"><div class="ax_scroll">
        <div class="ax_doc"><h3>${title}</h3><div class="no cg_num">No. ${esc(String(x.time).replace(/\D/g, ''))}-${esc(x.account || '0000')}-${h % 1000}</div>
          <div class="big cg_num">${esc(txMoney(p, x))}</div>${rows}
          <div class="ft">위 거래가 ${x.pending ? '접수' : '처리'}되었음을 확인합니다.<br>${esc(M.bank.name)}</div>
          <div class="stamp">${bank.map(esc).join('<br>')}<br>확인</div></div>
        <i class="ax_pad"></i>
      </div></div>
      ${tab('homeS')}</div>${axInd()}`;
}
// 더보기: who the owner is to the bank. The tier comes from what they hold (like the premium cards), or a name that says it
const TIERS = [
    { k: 'PRIVATE', at: 400000, re: /private|privat|프라이빗|\bpb\b|wealth|black|schwarz|블랙|centurion|infinite/i, sub: 'Private Banking', ben: [['star', '자산 관리', '분기마다 리포트'], ['user', '전담 프라이빗 뱅커', '24시간 컨시어지'], ['plane', '라운지 무제한', '동반 1인 포함'], ['globe', '환율 우대 90%', '모든 통화'], ['clock', '우선 창구', '기다리지 않아요']] },
    { k: 'PLATINUM', at: 120000, re: /platin|플래티넘|premier|prestige|프레스티지|premium|프리미엄/i, sub: '프리미엄 고객', ben: [['card2', 'ATM 수수료 면제', '전 세계 무제한'], ['globe', '환율 우대 70%', '해외 결제 수수료 없음'], ['plane', '공항 라운지', '연 6회'], ['user', '전담 상담', '평일 9–18시']] },
    { k: 'GOLD', at: 40000, re: /gold|골드/i, sub: '우수 고객', ben: [['card2', 'ATM 수수료 면제', '한 달 10회'], ['globe', '환율 우대 50%', '해외 결제 할인']] },
];
export function bankTier(p) {
    migrateBank(getMeta(), p); // the balances the ledger holds now (an update round may have moved them)
    const M = mo(p), names = [M.bank.name, ...M.bank.accounts.map(a => a.name)].join(' ');
    const has = M.bank.accounts.filter(x => x.kind !== 'credit').reduce((n, x) => n + Math.max(0, Number(x.balance) || 0) / (SCALE[x.currency] || 1), 0);
    const t = TIERS.find(t => t.re.test(names)) || TIERS.find(t => has >= t.at) || null;
    return { t, has, next: t ? null : TIERS[TIERS.length - 1] };
}
// an account number in the shape the owner's country uses, always the same for the same account, ending in its last four
function acctNo(p, a) {
    const c = homeCountry(p), h = String(hashOf(`${mo(p).bank.name}${a.last4}`)).padStart(10, '7'), h2 = String(hashOf(`${a.last4}${mo(p).bank.name}`)).padStart(10, '3'), l4 = String(a.last4 || '0000');
    const iban = (cc, n) => { const body = (h + h2).replace(/\D/g, '').slice(0, n - 4) + l4; return `${cc}${String(10 + hashOf(body) % 89)}${body}`.replace(/(.{4})/g, '$1 ').trim(); };
    if (c === 'KR') return `${h.slice(0, 3)}-${h.slice(3, 6)}-${h2.slice(0, 2)}${l4}`;
    if (c === 'JP') return `店番 ${h.slice(0, 3)} · 普通 ${h2.slice(0, 3)}${l4}`;
    if (c === 'US' || c === 'CA') return `${h.slice(0, 9)} · ${h2.slice(0, 6)}${l4}`;
    if (c === 'GB') return `${h.slice(0, 2)}-${h.slice(2, 4)}-${h.slice(4, 6)} · ${h2.slice(0, 4)}${l4}`;
    if (c === 'CN' || c === 'TW') return `${h}${h2.slice(0, 5)}${l4}`.replace(/(.{4})/g, '$1 ').trim();
    if (['DE', 'AT', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'PT', 'IE'].includes(c) || mo(p).currency === 'EUR') return iban(c && c.length === 2 ? c : 'DE', { DE: 18, AT: 16, CH: 17, NL: 14, BE: 12, FR: 23, IT: 23, ES: 20, PT: 21, IE: 18 }[c] || 18);
    return `${h.slice(0, 4)} ${h2.slice(0, 4)} ${l4}`;
}
// the member card of a GOLD, PLATINUM or PRIVATE owner (더보기, and the wallet keeps the PRIVATE one)
function memberCard(p, t, cls = '') {
    const M = mo(p), pv = t.k === 'PRIVATE', sum = bankSum(p), cur = bankDisplayCurrency(p);
    const no = `${t.k[0] + (pv ? 'X' : 'P')} · ${String(hashOf(`${M.bank.name}${p.owner}`)).padStart(8, '0').slice(0, 4)} ${String(M.bank.accounts[0]?.last4 || '0000')}`;
    return `<div class="ax_mcard ${t.k.toLowerCase()}${cls}">${pv ? '<svg viewBox="0 0 358 150" preserveAspectRatio="none"><rect x="7" y="7" width="344" height="136" rx="12" fill="none" stroke="#c9a961" stroke-opacity=".6" stroke-width=".8"/><g fill="none" stroke="#c9a961" stroke-opacity=".18" stroke-width=".7">' + [0, 18, 36, 54, 72].map((r, k) => `<ellipse cx="290" cy="75" rx="${40 + k * 18}" ry="${90 - k * 10}" transform="rotate(${r} 290 75)"/>`).join('') + '</g></svg>' : t.k === 'PLATINUM' ? PAT.platinum.replace(/^/, '<svg viewBox="0 0 330 200" preserveAspectRatio="none">') + '</svg>' : `<svg viewBox="0 0 330 200" preserveAspectRatio="none">${PAT.guilloche}</svg>`}
          <span class="nm">${esc(String(M.bank.name || '').split(/\s+/)[0].toUpperCase())} ${t.k}</span><span class="mb">MEMBER</span><span class="tl">고객 번호<b class="cg_num">${esc(no)}</b></span><span class="rt">예금 합계<b class="cg_num">${esc(fmtIn(p, sum.value, cur))}</b></span></div>`;
}
// ---- 자산 · 부채 (p.money.assets / debts, docs/mockups/phone-wealth D): what the owner has besides the accounts and what
// they owe, in the bank's currency. Counted: their own, half of what is shared. Left out (grey, named): what is only
// expected, blocked, the family's or the company's. Gone ones (sold, lost, settled, paid, forgiven) are not shown.
Object.assign(AX, { wcar: 'M5 16l1.5-5h11L19 16M4 16h16v3H4zM7 19v1M17 19v1', wgem: 'M6 4h12l3 5-9 11L3 9zM3 9h18M9 4l3 16 3-16', whand: 'M4 13l4-1 5 2 6-3v2l-6 4-5-1-4 1zM12 4v6M9 7h6',
    wchart: 'M4 19V5M4 19h16M8 15l3-4 3 2 5-6', wpeople: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M21 20a6 6 0 0 0-4-5.7', wbldg: 'M4 20V8l8-4 8 4v12M9 20v-5h6v5M8 11h.01M12 11h.01M16 11h.01' });
const W_AS = { property: ['house', '부동산'], vehicle: ['wcar', '차량'], business: ['wbldg', '사업 지분'], valuable: ['wgem', '귀중품'], deposit: ['star', '예치금'], receivable: ['whand', '대여금'], investment: ['wchart', '투자'], other: ['box', '기타'] };
const W_DB = { loan: ['doc', '대출'], mortgage: ['house', '주택담보대출'], personal: ['user', '개인 차입'], tax: ['doc', '세금'], other: ['doc', '부채'] };
const W_WHOSE = { shared: '공동 명의 · 50%', family: '가족 명의', company: '법인 명의' };
function wealthOf(p) {
    const M = mo(p), cur = M.currency, conv = (v, c) => (Number(v) || 0) / (SCALE[c || cur] || 1) * (SCALE[cur] || 1);
    const words = x => String(x.names?.[0] || x.name || x.lender || '').trim();
    const assets = (M.assets || []).filter(x => !['sold', 'lost', 'settled'].includes(x.status) && finite(Number(x.value))).map(x => {
        const [icon, kind] = W_AS[x.kind] || W_AS.other, out = x.status === 'expected' ? '수령 예정' : x.status === 'blocked' ? '동결' : x.whose === 'family' ? '가족 명의' : x.whose === 'company' ? '법인 명의' : '';
        const v = conv(x.value, x.currency) * (x.whose === 'shared' ? 0.5 : 1);
        return { x, name: words(x) || kind, icon, sub: [kind, W_WHOSE[x.whose] || '', x.status === 'expected' ? '수령 예정' : x.status === 'blocked' ? '동결' : ''].filter(Boolean).join(' · '), v, out };
    });
    const today = String(storyNow(p) || p.now || '').slice(0, 5);
    const debts = (M.debts || []).filter(x => !['paid', 'forgiven'].includes(x.status) && finite(Number(x.amount))).map(x => {
        const [icon, kind] = W_DB[x.kind] || W_DB.other, out = x.whose === 'family' ? '가족 부채' : x.whose === 'company' ? '법인 부채' : '';
        const v = -Math.abs(conv(x.amount, x.currency)) * (x.whose === 'shared' ? 0.5 : 1), gap = /^\d{2}-\d{2}/.test(String(x.due || '')) ? gapDays(today, String(x.due).slice(0, 5)) : null;
        const due = x.status === 'overdue' || gap !== null && gap < 0 ? ['연체', ''] : gap === 0 ? ['오늘', ''] : gap !== null ? [`D-${gap}`, gap <= 7 ? '' : 'g'] : null;
        return { x, name: words(x) || kind, icon, sub: [kind, x.whose === 'shared' ? '공동 · 50%' : '', x.lender && !words(x).toLowerCase().includes(String(x.lender).toLowerCase()) ? x.lender : ''].filter(Boolean).join(' · '), v, out, due };
    });
    const has = assets.filter(a => !a.out).reduce((n, a) => n + a.v, 0), owe = debts.filter(d => !d.out).reduce((n, d) => n + d.v, 0);
    return { assets, debts, has, owe, cur };
}
const W_ROW = (p, w, a, debt) => `<div class="ax_rw ax_wrw"><span class="ax_fi" style="width: 38px; height: 38px; background: ${debt ? '#f6e7e1' : '#e2e9f5'}; color: ${debt ? '#b8573a' : '#2c4a80'}">${ax(a.icon, 19, 'currentColor', 1.9)}</span><span class="ax_tx"><b class="ax_n">${esc(a.name)}</b><span class="ax_p">${a.due ? `<span class="ax_dd ${a.due[1]}" style="margin: 0 6px 0 0">${a.due[0]}</span>` : ''}${esc(a.sub)}</span></span><span class="ax_amt ${debt ? '' : 'p'} cg_num">${esc(fmtIn(p, a.v, w.cur, true))}</span></div>`;
// 더보기's 자산 · 부채: the four lines, what they have, what they owe, what is left out of it
function wealthPart(p) {
    const w = wealthOf(p);
    if (!w.assets.length && !w.debts.length) return '';
    const dep = bankSum(p).value, mine = w.assets.filter(a => !a.out), owed = w.debts.filter(d => !d.out), left = [...w.assets, ...w.debts].filter(a => a.out);
    const ln = (k, v, cls = '') => `<div class="ax_rln"><span>${k}</span><b class="cg_num ${cls}">${esc(fmtIn(p, v, w.cur))}</b></div>`;
    return `<div class="ax_sec">자산 · 부채</div>
        <div class="ax_card">${ln('예금', dep)}${ln('기타 자산', w.has)}${w.debts.length ? ln('부채', w.owe, 'ax_wneg') : ''}<div class="ax_rln ax_wtot"><span>순자산</span><b class="cg_num">${esc(fmtIn(p, dep + w.has + w.owe, w.cur))}</b></div></div>
        ${mine.length ? `<div class="ax_sec">자산</div><div class="ax_card">${mine.map(a => W_ROW(p, w, a, false)).join('')}</div>` : ''}
        ${owed.length ? `<div class="ax_sec">대출 · 부채</div><div class="ax_card">${owed.map(d => W_ROW(p, w, d, true)).join('')}</div>` : ''}
        ${left.length ? `<div class="ax_sec">합계 제외</div><div class="ax_wpl">${left.map(a => `<span>${esc(a.out)} · ${esc(a.name)}</span>`).join('')}</div>` : ''}`;
}
// 은행 첫 화면: what they have besides the accounts, one line under 내 계좌 (never the debts)
function wealthLine(p) {
    const w = wealthOf(p), mine = w.assets.filter(a => !a.out);
    if (!mine.length) return '';
    return `<div class="ax_card"><button type="button" class="ax_rw" data-go="bankmore"><span class="ax_fi" style="width: 38px; height: 38px; background: #e2e9f5; color: #2c4a80">${ax('house', 19, 'currentColor', 1.9)}</span><span class="ax_tx"><b class="ax_n">자산</b><span class="ax_p">${mine.length}건</span></span><span class="ax_fxv"><b class="ax_amt cg_num">${esc(fmtIn(p, w.has, w.cur))}</b></span>${ax('chev', 16, '#c2c7cf', 2.4)}</button></div>`;
}
export function bankMore(p, now) {
    const M = mo(p); if (!M) return bankHome(p, now);
    const { t, has, next } = bankTier(p), sum = bankSum(p), cur = bankDisplayCurrency(p), owner = esc(p.owner), init = esc([...String(p.owner || '?')][0].toUpperCase());
    const pv = t?.k === 'PRIVATE', no = `${t ? t.k[0] + (pv ? 'X' : 'P') : 'C'} · ${String(hashOf(`${M.bank.name}${p.owner}`)).padStart(8, '0').slice(0, 4)} ${String(M.bank.accounts[0]?.last4 || '0000')}`;
    const parts = M.bank.accounts.filter(a => a.kind !== 'credit' && Number(a.balance) > 0), tot = parts.reduce((n, a) => n + Number(a.balance) / (SCALE[a.currency] || 1), 0) || 1;
    const PC = { checking: '#1d3461', savings: '#7fae8a' };
    const head = `<div class="ax_bkpr"><span class="ax_bkav">${init}</span><span><b>${owner}${t ? `<i class="ax_tier ${t.k.toLowerCase()}">${t.k}</i>` : ''}</b><small>${esc(M.bank.name)} · ${t ? esc(t.sub) : '개인 고객'}</small></span></div>`;
    const card = t ? memberCard(p, t) : '';
    const ben = t ? `<div class="ax_sec">${t.k} 혜택</div>${pv ? `<div class="ax_card"><div class="ax_rw"><span class="ax_fi" style="width: 38px; height: 38px; background: #2a2c31; color: #c9a961">${ax('user', 19, 'currentColor', 1.9)}</span><span class="ax_tx"><b>전담 프라이빗 뱅커 배정됨</b><span class="ax_p">언제든 연락할 수 있어요</span></span></div></div>` : ''}<div class="ax_ben">${t.ben.filter((_, k) => !pv || k !== 1).map(([ic, b, s2], k) => `<div><i class="c${k}">${ax(ic, 17, 'currentColor', 1.9)}</i><b>${b}</b><small>${s2}</small></div>`).join('')}</div>` : '';
    const prog = next ? (() => { const need = (next.at - has) * (SCALE[M.currency] || 1); return `<div class="ax_prog">${next.k}까지 <b class="cg_num">${esc(fmtIn(p, need, M.currency))}</b> 남았어요<div class="bar"><i style="width: ${Math.max(3, Math.min(100, Math.round(has / next.at * 100)))}%"></i></div>예금 ${esc(fmtIn(p, next.at * (SCALE[M.currency] || 1), M.currency))} 이상이면 ${next.k} 고객</div>`; })() : '';
    return `<div class="ax_bk">${bankHead(p, now, 'bank', '더보기', false, head, pv)}
      <div class="ax_bks"><div class="ax_scroll">
        ${card}
        ${t ? '' : `<div class="ax_sec">예금 합계</div><div class="ax_card ax_tot"><div class="h"><b class="cg_num">${esc(fmtIn(p, sum.value, cur))}</b><small>계좌 ${parts.length}개</small></div>${parts.length ? `<div class="bar">${parts.map(a => `<i style="flex: ${Number(a.balance) / (SCALE[a.currency] || 1)}; background: ${PC[a.kind] || '#9aa3ae'}"></i>`).join('')}</div><div class="lg">${parts.map(a => `<span style="color: ${PC[a.kind] || '#9aa3ae'}">● ${kindName[a.kind]} ${Math.round(Number(a.balance) / (SCALE[a.currency] || 1) / tot * 100)}%</span>`).join('')}</div>` : ''}</div>`}
        ${wealthPart(p)}${prog}${ben}
        <div class="ax_sec">계좌 정보</div>
        <div class="ax_card ax_info">${M.bank.accounts.map(a => `<div class="ax_rw"><span class="ax_tx"><span class="k">${kindName[a.kind]}${a.name ? ` · ${esc(a.name)}` : ''}</span><b class="cg_num">${a.kind === 'credit' ? `•••• •••• •••• ${esc(a.last4)}` : esc(acctNo(p, a))}</b></span></div>`).join('')}</div>
        <i class="ax_pad"></i>
      </div></div>
      ${tab('menu')}</div>${axInd()}`;
}

// ---- 지갑: the bank's cards on top, then the passes, stacked like a real wallet
const chip = '<span class="ax_ccchip"><i style="left: 0; right: 0; top: 11px; height: 1px"></i><i style="left: 0; right: 0; top: 21px; height: 1px"></i><i style="top: 0; bottom: 0; left: 15px; width: 1px"></i><i style="top: 0; bottom: 0; left: 29px; width: 1px"></i></span>';
const nfc = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".85"><path d="M8.5 8a6 6 0 0 1 0 8M12 5.5a10 10 0 0 1 0 13M15.5 3a14 14 0 0 1 0 18"/></svg>';
const CC_BG = { checking: '#1d3461', credit: '#25272e', savings: '#2f5d50' };
// each bank has its colour family (two shades) and each card a pattern; premium credit cards by how much the owner has
const BANK_C = [['#2c4a80', '#1d2f55'], ['#b8323a', '#8e2730'], ['#2f6a5a', '#224f43'], ['#24505c', '#1a3c46'], ['#2f6f8f', '#225369'], ['#8a5a2e', '#6a431f'], ['#3f4a5a', '#2b333f']];
const PAT = {
    waves: Array.from({ length: 6 }, (_, k) => `<path d="M-20 ${120 + k * 14} q80 -40 160 0 t160 0" stroke="#fff" stroke-opacity=".08" stroke-width="8" fill="none"/>`).join(''),
    circles: '<circle cx="250" cy="40" r="90" fill="#fff" fill-opacity=".07"/><circle cx="290" cy="150" r="70" fill="#fff" fill-opacity=".06"/>',
    lines: Array.from({ length: 10 }, (_, k) => `<path d="M${60 + k * 40} 0 L${-60 + k * 40} 200" stroke="#fff" stroke-opacity=".07" stroke-width="10"/>`).join(''),
    dots: Array.from({ length: 11 * 14 }, (_, k) => `<circle cx="${180 + (k % 11) * 14}" cy="${10 + Math.floor(k / 11) * 14}" r="2" fill="#fff" fill-opacity=".12"/>`).join(''),
    grid: Array.from({ length: 20 }, (_, k) => `<rect x="${200 + (k % 4) * 30}" y="${20 + Math.floor(k / 4) * 30}" width="24" height="24" rx="6" fill="#fff" fill-opacity="${(0.04 + (k % 3) * 0.03).toFixed(2)}"/>`).join(''),
    stripe: '<path d="M230 0 L330 0 L330 200 L150 200z" fill="#1d2f55" fill-opacity=".06"/><path d="M250 0 L262 0 L182 200 L170 200z" fill="#1d2f55" fill-opacity=".08"/>',
    brushed: Array.from({ length: 100 }, (_, k) => `<path d="M0 ${k * 2} H330" stroke="${k % 2 ? '#fff' : '#000'}" stroke-opacity="${k % 2 ? 0.05 : 0.03}" stroke-width=".7"/>`).join(''),
    guilloche: Array.from({ length: 10 }, (_, k) => `<ellipse cx="260" cy="100" rx="${40 + k * 9}" ry="${90 - k * 4}" transform="rotate(${k * 12} 260 100)" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width=".8"/>`).join(''),
    platinum: Array.from({ length: 100 }, (_, k) => `<path d="M0 ${k * 2} H330" stroke="${k % 2 ? '#fff' : '#000'}" stroke-opacity="${k % 2 ? 0.1 : 0.035}" stroke-width=".7"/>`).join('')
        + '<defs><linearGradient id="axplsh" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".48" stop-color="#fff" stop-opacity=".45"/><stop offset=".56" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="330" height="200" fill="url(#axplsh)"/><rect x="7" y="7" width="316" height="186" rx="12" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".8"/>',
};
// no diagonal stripes: its place goes to the waves, so every other card keeps its pattern
const PATS = ['waves', 'circles', 'waves', 'dots', 'grid'];
const hashOf = s => [...String(s || '')].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 2147483647, 7);
// "how much they have" in the bank's money, scaled so the tiers mean about the same in won, yen or euros
const SCALE = { KRW: 1300, JPY: 150, CNY: 7, TWD: 32, INR: 83, RUB: 90, BRL: 5, CAD: 1.35, AUD: 1.5, GBP: 0.8 };
function cardLook(p, a, k) {
    const name = String(a?.name || ''), bank = mo(p).bank.name || '', [c1, c2] = BANK_C[hashOf(bank) % BANK_C.length];
    if (a?.kind === 'credit') {
        const has = mo(p).bank.accounts.filter(x => x.kind !== 'credit').reduce((n, x) => n + Math.max(0, Number(x.balance) || 0) / (SCALE[x.currency || mo(p).currency] || 1), 0);
        // the card's own name or what the owner holds, and never below the owner's tier at the bank (더보기)
        const own = /black|schwarz|블랙|infinite|centurion/i.test(name) || has >= 400000 ? 3 : /platin|플래티넘/i.test(name) || has >= 120000 ? 2 : /gold|골드/i.test(name) || has >= 40000 ? 1 : 0;
        const lv = Math.max(own, { PRIVATE: 3, PLATINUM: 2, GOLD: 1 }[bankTier(p).t?.k] || 0);
        if (lv === 3) return { tier: 'BLACK', bg: '#17181b', ink: '#d9dbe0', pat: 'brushed', chipc: '#b8bcc4', mono: true };
        if (lv === 2) return { tier: 'PLATINUM', bg: '#c9ccd2', ink: '#23272e', pat: 'platinum', chipc: '#dcd6c4' };
        if (lv === 1) return { tier: 'GOLD', bg: '#b8913a', ink: '#2b2210', pat: 'guilloche', chipc: '#efe0b0' };
    }
    if (/student|studi|jugend|youth|junior|학생|청소년|대학/i.test(name)) return { tier: '', bg: '#e9eef6', ink: '#1d2f55', pat: 'stripe', chipc: '#d8b45a' };
    return { tier: '', bg: a?.kind === 'credit' ? c2 : c1, ink: '#fff', pat: PATS[(hashOf(`${bank}${a?.last4 || ''}`) + k) % PATS.length], chipc: '' };
}
function cardArt(p, c) {
    const a = acctOf(p, c.account), kind = a?.kind || 'checking', bank = String(mo(p).bank.name), [b1, ...b2] = bank.split(' '), L = cardLook(p, a, mo(p).cards.indexOf(c));
    const prem = !!L.tier;
    return `<span class="ax_cc${prem ? ' ax_ccpr' : ''}" style="background: ${L.bg}; color: ${L.ink}${L.chipc ? `; --chipc: ${L.chipc}` : ''}"><svg class="ax_ccdeco" viewBox="0 0 330 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${PAT[L.pat]}</svg>`
        + `<span class="ax_cctop"><span class="ax_cclg">${prem ? `<b>${esc(bank.toUpperCase())}</b><small>${L.tier}</small>` : `<b>${esc(b1)}</b> ${esc(b2.join(' '))}`}</span><span class="ax_cckd">${kind === 'credit' ? 'credit' : 'debit'}</span></span>`
        + `<span class="ax_ccmid">${chip}${nfc}</span><span class="ax_ccno cg_num">${L.mono ? '••••' : '•••• •••• ••••'} ${esc(c.account)}</span><span class="ax_ccbot"><span><small>CARD HOLDER</small><b>${esc(String(p.owner).toUpperCase())}</b></span><span class="ax_r"><small>VALID THRU</small><b>${esc(c.exp || '—')}</b></span></span></span>`;
}
// passes: the kind the bank gave (flight, train, hotel, event, other), and for an event or other ticket what its venue's name
// says it is (a cinema, a theme park, a match, a museum, a ferry, a bus, a stage, else a concert); empty fields are left out.
// The first wallet's layout, each kind in its colour with one of its own drawings behind (src/phonepassart.js)
const PASS = { flight: ['#2c4a80', 'plane', '탑승'], train: ['#8e3a33', 'train', '열차'], hotel: ['#efe2cf', 'bed', '체크인'], concert: ['#26304f', 'ticket', '입장'],
    movie: ['#1d1d22', 'film', '상영'], match: ['#2f6a3a', 'ball', '킥오프'], museum: ['#f3ede4', 'museum', '관람'], bus: ['#2f6f8f', 'bus', '출발'], ferry: ['#24505c', 'ship', '출항'], theater: ['#6a2a3e', 'mask', '개막'], park: ['#8a5a2e', 'wheel', '개장'], membership: ['#2e5e57', 'card', '유효'], other: ['#3d4a66', 'ticket', '시간'] };
const LIGHT = new Set(['hotel', 'museum']);
// a tear-off ticket gets the notches; a booking (the hotel), a card (the membership), the dark cinema ticket and the opera do not
const NOTCHED = new Set(['flight', 'train', 'bus', 'ferry', 'concert', 'match', 'museum', 'park', 'other']);
// one accent per kind for the light and the single bright touch in its drawing
const PASS_ACC = { flight: '#a9c4f0', train: '#f2b6a6', bus: '#a8e0f2', ferry: '#9fe0dc', hotel: '#8a5a2a', concert: '#c9b8ff', theater: '#f2b8c8', movie: '#f0c96a', match: '#bfe6a0', museum: '#7a5a3a', park: '#ffd28a', membership: '#a8dccc', other: '#c3cde0' };
Object.assign(AX, { film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4', ball: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7l4 3-1.5 5h-5L8 10z', museum: 'M3 9l9-5 9 5M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18', bus: 'M6 4h12a2 2 0 0 1 2 2v10H4V6a2 2 0 0 1 2-2zM4 11h16M7 19v-3M17 19v-3M8 14h.01M16 14h.01',
    ship: 'M4 14l2 5h12l2-5zM6 14V9h12v5M9 9V5h6v4', mask: 'M4 5h16v6a8 8 0 0 1-16 0zM8 10h2M14 10h2M9 15c2 1.5 4 1.5 6 0', wheel: 'M12 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 3v16M4 11h16M6.3 5.3l11.4 11.4M17.7 5.3L6.3 16.7M8 22l4-11 4 11' });
const passKind = x => {
    if (['flight', 'train', 'hotel', 'membership'].includes(x.kind)) return x.kind;
    const w = `${x.by || ''} ${x.to || ''} ${x.from || ''}`;
    if (/kino|cine|movie|film|영화|cgv|megabox|롯데시네마|映画|电影/i.test(w)) return 'movie';
    if (/europa-park|freizeitpark|theme ?park|amusement|disney|universal studios|phantasialand|legoland|heide park|에버랜드|롯데월드|놀이공원|遊園地|游乐园/i.test(w)) return 'park';
    if (/stadion|stadium|arena|park\b|match|spiel|fc\b|sv\b|경기|구장|스타디움|球場|体育/i.test(w)) return 'match';
    if (/museum|galerie|gallery|ausstellung|exhibit|미술관|박물관|전시|美術館|博物馆/i.test(w)) return 'museum';
    if (/fähre|ferry|ship|schiff|페리|여객선|フェリー|轮渡|transtejo/i.test(w)) return 'ferry';
    if (/bus|flixbus|fernbus|버스|巴士/i.test(w)) return 'bus';
    if (/theat|oper\b|opera|musical|ballet|schauspiel|극장|뮤지컬|오페라|연극|발레|劇場|剧院/i.test(w)) return 'theater';
    return x.kind === 'event' ? 'concert' : 'other';
};
// check-in to check-out, across New Year too (12-30 → 01-02 is 3 nights)
const nights = (a, b) => { const m = s => /^\d{2}-\d{2}/.test(String(s || '')); if (!m(a) || !m(b)) return null; const d = gapDays(a, b); return d > 0 && d < 60 ? d : null; };
const passBy = x => String(x.by || x.to || '');
const passDate = (p, x) => (x.dayUnknown || !x.date ? '날짜 미정' : fmtDate(p, x.date, true));
const passSpan = (p, x) => (x.until && /^\d{2}-\d{2}/.test(String(x.until)) ? `${passDate(p, x)} ~ ${fmtDate(p, x.until, true)}` : '');
function passArt(p, x, full) {
    const k = passKind(x), [bg, icon, lab] = PASS[k], light = LIGHT.has(k);
    const f = (label, v) => (v === null || v === undefined || String(v).trim() === '' || v === '—' ? '' : `<span><small>${label}</small><b>${esc(String(v))}</b></span>`);
    // the drawing behind (none on the open ticket); on the globe the plane icon gives way to a plain line between the two places,
    // and the train without a drawing has its icon between the two stations, as the plain boarding pass does
    const drawn = passMotif(k, light ? '#3a2e1e' : '#fff', light ? 0.26 : 0.2, x.id, PASS_ACC[k]), art = full ? '' : drawn, globe = k === 'flight' && drawn, plainTrain = k === 'train' && drawn === null;
    const route = (a, b, big, sm = String(a).length > 4 || String(b).length > 4) => `<span class="ax_psrt ${big && !globe ? '' : 'ln'}${big && sm ? ' sm' : ''}"><span><b class="${big && !sm ? '' : 'ax_pbsm'}">${esc(a)}</b></span><span class="ax_pspl">${big && !globe ? ax(k === 'train' ? 'train' : 'plane', 22, 'currentColor', 1.6) : `<i${globe ? ' class="sl"' : ''}></i>`}</span><span class="ax_r"><b class="${big && !sm ? '' : 'ax_pbsm'}">${esc(b)}</b></span></span>`;
    const title = t => `<span class="ax_psti">${esc(t)}</span>`;
    const date = passDate(p, x), out = x.until && /^\d{2}-\d{2}/.test(String(x.until)) ? x.until : x.to && /^\d{2}-\d{2}/.test(x.to) ? x.to : '';
    let mid = '', fields = '';
    if (k === 'flight') { mid = x.from && x.to ? route(x.from, x.to, true) : title(x.to || x.from || ''); fields = f('날짜', date) + f('탑승구', x.gate) + f('좌석', x.seat) + f('편명', x.no); }
    else if (k === 'train' || k === 'bus' || k === 'ferry') { mid = x.from && x.to ? route(x.from, x.to, plainTrain) : title(x.to || x.from || ''); fields = f('날짜', date) + f('좌석', x.seat) + f(k === 'bus' ? '예약' : '번호', x.no) + f('소유자', String(p.owner).toUpperCase()); }
    else if (k === 'hotel') { const n = nights(x.date, out); mid = title(x.to && !/^\d{2}-\d{2}/.test(x.to) ? x.to : x.from || ''); fields = f('체크인', date) + f('체크아웃', out ? fmtDate(p, out, true) : '') + f('숙박', n ? `${n}박` : '') + f('예약', x.no) + f('객실', x.seat); }
    else if (k === 'membership') { mid = title(x.to || x.from || x.by || ''); fields = f('기간', passSpan(p, x) || date) + f('번호', x.no) + f('회원', String(p.owner).toUpperCase()); }
    else if (k === 'match') { const m = String(x.to || x.from || '').split(/\s+(?:vs\.?|gegen|대|–|-)\s+/i); mid = m.length === 2 ? `<span class="ax_psvs"><b>${esc(m[0])}</b><small>vs</small><b>${esc(m[1])}</b></span>` : title(x.to || x.from || ''); fields = f('날짜', date) + f('블록', x.gate) + f('좌석', x.seat) + f('번호', x.no); }
    else { mid = title(x.to || x.from || ''); fields = f(passSpan(p, x) ? '기간' : '날짜', passSpan(p, x) || date) + f(k === 'movie' ? '관' : k === 'museum' ? '입장권' : '구역', x.gate) + f('좌석', x.seat) + f('번호', x.no); }
    // the open ticket with its QR stays plain: the drawing is only for the wallet
    return `<span class="ax_ps ax_ps_${k} ${light ? 'cream' : ''}" style="--psbg: ${bg}"><span class="ax_pstop">${art ? `<svg class="ax_psmo" viewBox="0 0 340 200" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">${art}</svg>` : ''}
      <span class="ax_psh"><span class="ax_pslg">${ax(icon, 16, 'currentColor')}</span><span class="ax_psn">${esc(passBy(x).toUpperCase())}</span><span class="ax_pshr">${k === 'membership' && out ? '까지' : lab}<b class="cg_num">${esc(k === 'membership' && out ? fmtDate(p, out, true) : x.time ? clockOf(p, x.time) : date || '')}</b></span></span>
      ${mid}${NOTCHED.has(k) ? '<span class="ax_psnt"></span>' : ''}<span class="ax_psfl">${fields}</span></span>
      ${full ? `<span class="ax_psperf"></span>${x.status ? `<span class="ax_psst">${esc(x.status)}</span>` : ''}<span class="ax_psqr">${qr(x.id)}</span>` : ''}</span>`;
}
// a QR-looking square (drawn, not a code)
function qr(seed) {
    let x = [...String(seed || 'x')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 2147483647, 7), o = '';
    for (let k = 0; k < 441; k++) {
        x = (x * 1103515245 + 12345) % 2147483648;
        const r = Math.floor(k / 21), c = k % 21, fr = (r < 7 && (c < 7 || c > 13)) || (r > 13 && c < 7);
        const rr = r < 7 ? r : r - 14, cc = c < 7 ? c : c - 14;
        const on = fr ? (rr === 0 || rr === 6 || cc === 0 || cc === 6 || (rr > 1 && rr < 5 && cc > 1 && cc < 5)) : (x >> 16) % 2;
        o += `<i style="background: ${on ? '#111' : '#fff'}"></i>`;
    }
    return o;
}
// the wallet as one deck: the member card, the cards, then the coming passes, the nearest in front and open; each one
// behind shows its top edge. Past passes keep their own grey deck below, so a wallet with nothing coming still has something
export function walletScreen(p, now, sel = '') {
    const M = mo(p);
    if (!M) return emptyApp(p, now, '지갑', 'money', '아직 지갑이 비어 있어요. 채우면 은행 · 지갑 · 쇼핑이 함께 생겨요.');
    migrateBank(getMeta(),p);
    const today = String(storyNow(p) || p.now || '').slice(0, 5), past = x => (!x.dayUnknown && x.date && gapDays(today, String(x.until && /^\d{2}-\d{2}/.test(String(x.until)) ? x.until : x.date)) < 0) || PASS_OVER(x.status);
    const when = x => (x.dayUnknown || !x.date ? 9999 : gapDays(today, x.date)), ps = [...M.passes].sort((a, b) => when(a) - when(b)), up = ps.filter(x => !past(x)), old = ps.filter(past);
    const t = bankTier(p).t, mc = t?.k === 'PRIVATE';
    // a tap on one lying behind brings it out whole; a tap on the open one opens it
    // those after the open one sit in a tail that cuts off whatever reaches past the last edge
    const deck = list => {
        const n = Math.max(0, list.findIndex(o => o.k === sel)), at = list.some(o => o.k === sel) ? n : list.length - 1;
        const one = (o, k) => k === at ? `<button type="button" class="ax_wlb on" data-go="${o.go}" data-i="${o.i}">${o.art}</button>` : `<button type="button" class="ax_wlb sh" data-go="wallet" data-i="${o.k}">${o.art}</button>`;
        const head = list.slice(0, at + 1).map(one).join(''), tail = list.slice(at + 1).map((o, k) => one(o, at + 1 + k)).join('');
        return head + (tail ? `<div class="ax_dtail">${tail}</div>` : '');
    };
    const items = [...(mc ? [{ k: 'm', go: 'bankmore', i: '', art: memberCard(p, t, ' ax_mcw') }] : []),
        ...M.cards.map((c, i) => ({ k: `c${i}`, go: 'card', i, art: cardArt(p, c) })),
        ...[...up].reverse().map(x => ({ k: `p${x.id}`, go: 'pass', i: x.id, art: passArt(p, x, false) }))];
    const next = up[0], gap = next && !next.dayUnknown && next.date ? gapDays(today, next.date) : null, where = next ? (next.to || next.title || next.by || '') : '';
    const sub = next && gap !== null && gap >= 0 ? `다음 일정 · ${esc(where)}${gap === 0 ? ' 오늘' : gap === 1 ? ' 내일' : ` ${gap}일 뒤`}` : [M.cards.length ? `카드 ${M.cards.length}` : '', mc ? '멤버십 1' : '', ps.length ? `패스 ${ps.length}` : ''].filter(Boolean).join(' · ');
    return `${axBar(p, now)}
      ${axTop(axCb('home2'))}
      <div class="ax_scroll">
        ${axH1('지갑', sub)}
        ${items.length ? `<div class="ax_wl ax_deck">${deck(items)}</div>` : '<div class="ax_empty">지갑이 비어 있어요</div>'}
        ${old.length ? `<div class="ax_shd ax_oldh">지난 패스<span>${old.length}개</span></div><div class="ax_wl ax_deck ax_psold">${deck(old.map(x => ({ k: `o${x.id}`, go: 'pass', i: x.id, art: passArt(p, x, false) })))}</div>` : ''}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
// this month on the card: a bar per day and where the money went, sorted by the merchants' own words
const SPEND = [['식비 · 카페', '#e0904a', /café|cafe|kaffee|coffee|bäck|bakery|restaurant|trattoria|osteria|ristorante|pizzeria|brasserie|taverna|grill|kitchen|küche|mensa|kantine|pizza|burger|imbiss|döner|sushi|ramen|bistro|bar\b|lieferando|wolt|uber ?eats|delivery|deliveroo|배달|카페|커피|식당|베이커리|치킨|분식|레스토랑|스타벅스|투썸/i],
    ['장보기', '#6fae6f', /rewe|edeka|aldi|lidl|netto|penny|kaufland|supermarkt|supermarket|grocery|tesco|sainsbury|walmart|costco|마트|이마트|홈플러스|롯데마트|편의점|gs25|cu\b|세븐일레븐|コンビニ|スーパー|超市/i],
    ['교통', '#5a8ac8', /bahn|\bdb\b|bvg|hvv|mvg|ubahn|u-bahn|metro|transit|uber\b|taxi|bolt|tank|shell|aral|esso|fuel|parking|parken|교통|지하철|버스|택시|주유|티머니|ktx|코레일|주차|suica|pasmo/i],
    ['쇼핑', '#2f9a8a', /amazon|zalando|otto|ebay|shop|store|markt\b|buch|book|apple|ikea|h&m|zara|uniqlo|쿠팡|무신사|올리브영|쇼핑|다이소|11번가|g마켓|楽天|淘宝/i]];
function spendMonth(p, all) {
    const mm = String(storyNow(p) || p.now || '').slice(0, 2), xs = all.filter(x => String(x.time).slice(0, 2) === mm && x.amount < 0 && !x.pending);
    if (xs.length < 2) return '';
    const tot = xs.reduce((n, x) => n - x.amount, 0), cats = SPEND.map(([n, c, re]) => [n, c, xs.filter(x => re.test(`${x.who} ${x.ko || ''} ${x.memo || ''}`))]);
    const other = xs.filter(x => !cats.some(([, , ys]) => ys.includes(x))), rows = [...cats, ['그 밖', '#9aa3ae', other]].map(([n, c, ys]) => [n, c, ys.reduce((m, x) => m - x.amount, 0)]).filter(r => r[2] > 0).sort((a, b) => b[2] - a[2]);
    const last = Math.max(...xs.map(x => Number(String(x.time).slice(3, 5)) || 1)), days = Array.from({ length: last }, (_, d) => xs.filter(x => Number(String(x.time).slice(3, 5)) === d + 1).reduce((n, x) => n - x.amount, 0)), top = Math.max(...days, 1);
    const cur = xs[0].currency || mo(p).currency;
    return `<section class="cd_month"><div class="cd_mh"><span>${Number(mm)}월 결제</span><b class="cg_num">${esc(fmtIn(p, tot, cur))}</b></div>
      <div class="cd_days">${days.map((v, d) => `<i style="height: ${Math.max(2, Math.round(v / top * 44))}px${d === last - 1 ? '; background: var(--cdk, #1d2f55)' : ''}"></i>`).join('')}</div>
      <div class="cd_dx cg_num"><span>1일</span><span>${last}일</span></div>
      <div class="cd_bar">${rows.map(([, c, v]) => `<i style="flex: ${v}; background: ${c}"></i>`).join('')}</div>
      ${rows.map(([n, c, v]) => `<div class="cd_cat"><i style="background: ${c}"></i><span>${n}</span><b class="cg_num">${esc(fmtIn(p, v, cur))}</b><small>${Math.round(v / tot * 100)}%</small></div>`).join('')}</section>`;
}
export function cardView(p, now, i) {
    const c = mo(p)?.cards?.[Number(i)];
    if (!c) return walletScreen(p, now);
    migrateBank(getMeta(),p);
    const a = acctOf(p, c.account), ai = mo(p).bank.accounts.indexOf(a), credit = a?.kind === 'credit';
    const all = newestTx(p).filter(x => x.account === c.account && x.kind === 'card'), xs = all.slice(0,5);
    const pending = all.filter(x=>x.pending).length, cur = a?.currency || mo(p).currency;
    const amount = a ? credit ? creditAmount(a) : a.balance : null;
    const conversion = a ? converted(p,a,true) : '';
    const payment = x => `<button type="button" class="cd_payment" data-go="tx" data-i="${esc(x.id)}">${fi(x.who,38,axTint(x.who),12)}<span class="cd_merchant"><b>${esc(x.who)}</b><small>${esc(fmtDate(p,x.time,true))}${x.pending ? ' · 승인 대기' : x.amount > 0 ? ' · 입금·환급 기록' : ' · 결제'}</small></span><span class="cd_payment_amount ${x.amount > 0 ? 'incoming' : ''}">${esc(txMoney(p,x,true))}${ax('chev',13)}</span></button>`;
    return `<div class="cd_app">${axBar(p,now)}
      <div class="cd_top"><button type="button" class="cd_back" data-go="wallet" aria-label="지갑으로 돌아가기">${ax('back',20)}</button><b>내 카드</b><span>${esc(mo(p).bank.name)}</span></div>
      <div class="ax_scroll cd_scroll">
        <div class="cd_card">${cardArt(p,c)}</div>
        <div class="cd_identity"><b>${esc(a?.name || mo(p).bank.name)}</b><span>${credit ? '신용카드' : '체크카드'} · ${esc(c.account)}</span></div>
        <section class="cd_summary"><div class="cd_summary_label"><span>${credit ? creditLabel(a,'이번 달 이용 금액') : '연결 계좌 잔액'}</span>${pending ? `<span class="cd_pending">승인 대기 ${pending}</span>` : ''}</div><strong class="cg_num">${esc(fmtIn(p,amount,cur))}</strong>
          ${conversion ? `<details class="cd_fx"><summary>${conversion}</summary><p>${converted(p,a)}</p></details>` : ''}
          ${ai >= 0 ? `<button type="button" class="cd_account" data-go="acct" data-i="${ai}"><span>${ax('card',16)} ${credit ? '카드 이용 내역' : '연결 계좌 보기'}</span><span>•••• ${esc(a.last4)} ${ax('chev',14)}</span></button>` : ''}
        </section>
        ${spendMonth(p, all)}
        <div class="cd_section"><h2>최근 결제</h2>${ai >= 0 ? `<button type="button" data-go="acct" data-i="${ai}">전체 보기 ${ax('chev',12)}</button>` : ''}</div>
        <div class="cd_payments">${xs.map(payment).join('') || `<div class="cd_empty">${ax('receipt',25)}<b>아직 결제 내역이 없어요</b><span>이 카드의 결제 기록이 여기에 표시돼요.</span></div>`}</div>
        <i class="ax_pad"></i>
      </div></div>${axInd()}`;
}
export function passView(p, now, id) {
    const x = mo(p)?.passes?.find(t => t.id === id);
    if (!x) return walletScreen(p, now);
    return `${axBar(p, now)}
      ${axTop(axCb('wallet'))}
      <div class="ax_scroll">
        <div class="ax_wl">${passArt(p, x, true)}</div>
        ${x.status ? `<div class="ax_pstat"><span>${ax('check', 13, 'currentColor', 3)} ${esc(x.status)}</span></div>` : ''}
        ${relatedRows(p, x.ev, `pass:${x.id}`)}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}

// ---- 쇼핑: a shop app's own face (its colour band, search, tab bar), the orders tab inside
const ORDER_STATE={cancelled:'주문 취소',returning:'반품 진행',returned:'반품 완료',refunded:'환불 완료'};
const STEP = { ordered: 0, shipped: 1, 'on the way': 2, delivered: 3 };
const itemIc = x => (/buch|book|책|livre|libro/i.test(`${x.item} ${x.ko}`) ? 'book' : 'box');
function statusPill(p, x) {
    if(ORDER_STATE[x.status])return `<span class="ax_pill2 unk">${esc(ORDER_STATE[x.status])}</span>`;
    if (x.status === 'delivered') return `<span class="ax_pill2 ok">${ax('check', 12, 'currentColor', 2.8)} ${x.arrived ? `${esc(fmtDate(p, x.arrived, true))} 도착` : '배송 완료'}</span>`;
    if (x.status === 'unknown') return `<span class="ax_pill2 unk">${ax('info', 13, 'currentColor')} 배송 상태 모름</span>`;
    return `<span class="ax_pill2 go">${ax('truck', 13, 'currentColor')} ${x.eta ? `${esc(fmtDate(p, x.eta, true))} 도착 예정` : x.status === 'ordered' ? '주문 완료' : '배송 중'}</span>`;
}
const shopTab = () => `<div class="ax_btab">${[['homeS', '홈'], ['grid4', '카테고리'], ['receipt', '주문'], ['user', '내 정보']].map(([k, l]) => `<span class="${k === 'receipt' ? 'on' : ''}">${ax(k, 24, 'currentColor')}${l}</span>`).join('')}</div>`;
const prodImg = x => `<span class="ax_pimg">${prodSvg(x) || ax(itemIc(x), 30, '#7d8796', 1.7)}${x.gift || x.sender ? `<i>${ax('gift', 11, '#a2526b', 2.2)}</i>` : ''}</span>`;
export function shopScreen(p, now, f = 'all') {
    const M = mo(p);
    if (!M) return emptyApp(p, now, '쇼핑', 'money', '아직 주문이 없어요. 채우면 은행 · 지갑 · 쇼핑이 함께 생겨요.');
    const os = [...M.orders].sort(byStory(p.now)).reverse();
    // a cancelled or returned order is neither on its way nor delivered: the 전체 tab alone shows it
    const go = os.filter(x => x.status !== 'delivered' && x.status !== 'unknown' && !ORDER_STATE[x.status]), ok = os.filter(x => x.status === 'delivered');
    const xs = f === 'go' ? go : f === 'ok' ? ok : os;
    const tb = (k, l, n) => `<button type="button" class="${f === k ? 'on' : ''}" data-go="shop" data-i="${k}">${l}<small>${n}</small></button>`;
    return `<div class="ax_shopv">
      <div class="ax_sph">${axBar(p, now, '#fff')}
        <div class="ax_spr"><button type="button" class="ax_bkc" data-go="home2" aria-label="뒤로">${ax('back', 18, '#fff', 2.3)}</button><span class="ax_splogo">markt<i>.</i></span><span class="ax_bkc">${ax('bell', 18, '#fff')}</span><span class="ax_bkc">${ax('cart', 19, '#fff')}</span></div>
        <div class="ax_spsr">${ax('search', 16, '#8a929d', 2.2)}상품, 브랜드 검색</div>
      </div>
      <div class="ax_sps"><div class="ax_scroll">
        <div class="ax_sphd"><b>주문 내역</b><span>${os.length}건</span></div>
        <div class="ax_sptabs">${tb('all', '전체', os.length)}${tb('go', '배송 중', go.length)}${tb('ok', '배송 완료', ok.length)}</div>
        ${xs.map(x => `<div class="ax_card ax_oc"><div class="ax_och">${statusPill(p, x)}<small>${esc(fmtDate(p, x.time, true))} 주문</small></div>
          <div class="ax_ocr">${prodImg(x)}<span class="ax_tx"><small class="ax_ocsl">${esc(String(x.shop || '').toUpperCase())}</small><b>${esc(x.item)}</b>${x.ko && koOn() ? `<span class="ax_p">${esc(x.ko)}</span>` : ''}<span class="ax_ocpr cg_num">${esc(fmtMoney(p, x.price === null ? null : x.price * (x.qty || 1)))}<small>${x.qty || 1}개${x.gift ? ' · 선물' : ''}</small></span></span></div>
          <div class="ax_ocb"><button type="button" data-go="order" data-i="${x.id}">주문 상세</button><button type="button" class="p" data-go="${STEP[x.status] === undefined ? 'order' : 'track'}" data-i="${x.id}">${x.status === 'delivered' ? '배송 기록' : STEP[x.status] === undefined ? '다시 보기' : '배송 조회'}</button></div></div>`).join('') || '<div class="ax_empty">주문이 없어요</div>'}
        <i class="ax_pad"></i>
      </div></div>
      ${shopTab()}</div>${axInd()}`;
}
export function orderView(p, now, id) {
    const x = mo(p)?.orders?.find(o => o.id === id);
    if (!x) return shopScreen(p, now);
    // the payment, not its refund row, when both carry the order's tag
    const st = STEP[x.status], tx = x.ev ? mo(p).tx.find(t => t.ev === x.ev && t.amount < 0) || mo(p).tx.find(t => t.ev === x.ev) : null, ai = tx ? mo(p).bank.accounts.findIndex(a => a.last4 === tx.account) : -1;
    const head = ORDER_STATE[x.status] ? [ORDER_STATE[x.status], x.status==='refunded'?'환불됐어요':x.status==='returned'?'반품이 완료됐어요':x.status==='returning'?'반품 처리 중이에요':'주문이 취소됐어요'] : x.status === 'delivered' ? ['배송 완료', x.arrived ? `${fmtDate(p, x.arrived)} 도착` : '도착했어요'] : x.status === 'unknown' ? ['배송 상태', '확인되지 않았어요'] : [x.status === 'ordered' ? '주문 완료' : '배송 중', x.eta ? `${fmtDate(p, x.eta)} 도착 예정` : '도착일 미정'];
    const total = x.price === null ? null : x.price * (x.qty || 1);
    return `<div class="ax_shopv">
      <div class="ax_sph ax_sphs">${axBar(p, now, '#fff')}
        <div class="ax_spr"><button type="button" class="ax_bkc" data-go="shop" aria-label="뒤로">${ax('back', 18, '#fff', 2.3)}</button><span class="ax_bkt">주문 상세</span><span class="ax_bkc">${ax('cart', 18, '#fff')}</span></div>
      </div>
      <div class="ax_sps ax_spso"><div class="ax_scroll">
        <div class="ax_dhero"><small>${esc(head[0])}</small><b>${esc(head[1])}</b><span>${esc(x.shop)}${x.sender ? ` · 받은 선물` : x.gift ? ` · 선물로 ${esc(x.gift)}에게` : ''}</span>
          ${st === undefined ? '' : `<span class="ax_steps" style="--done: ${[0, 34, 67, 100][st]}%">${['주문', '발송', '배송 중', '도착'].map((l, k) => `<span class="${k < st || (k === st && st === 3) ? 'd' : k === st ? 'c' : ''}"><i>${k < st || (k === st && st === 3) ? ax('check', 11, '#fff', 3) : ''}</i>${l}</span>`).join('')}</span>`}</div>
        <div class="ax_card ax_oc"><div class="ax_ocr">${prodImg(x)}<span class="ax_tx"><small class="ax_ocsl">${esc(String(x.shop || '').toUpperCase())}</small><b>${esc(x.item)}</b>${x.ko && koOn() ? `<span class="ax_p">${esc(x.ko)}</span>` : ''}<span class="ax_ocpr cg_num">${esc(fmtMoney(p, x.price))}<small>${esc([x.option, `${x.qty || 1}개`].filter(Boolean).join(' · '))}</small></span></span></div></div>
        <div class="ax_sec">결제</div><div class="ax_card">${x.sender ? `<div class="ax_lr"><span>보낸 사람</span><span>${esc(x.sender)}</span></div><div class="ax_lr"><span><b>결제</b></span><span><b>받은 선물 · 결제 없음</b></span></div>` : `<div class="ax_lr"><span>상품 금액</span><span class="cg_num">${esc(fmtMoney(p, total))}</span></div><div class="ax_lr"><span><b>${x.payer === 'someone else' ? '다른 사람이 결제' : x.payer === 'on delivery' ? '받을 때 결제' : x.paid === false ? '결제 예정' : '총 결제'}</b></span><span class="cg_num"><b>${esc(fmtMoney(p, total))}</b></span></div>`}
          ${tx ? `<button type="button" class="ax_more" data-go="tx" data-i="${tx.id}">${ai >= 0 ? `${kindName[mo(p).bank.accounts[ai].kind]} •••• ${esc(tx.account)} · ` : ''}은행에서 보기 ${ax('chev', 14, 'currentColor', 2.4)}</button>` : ''}</div>
        <div class="ax_sec">주문 정보</div><div class="ax_card"><div class="ax_lr"><span>주문일</span><span class="cg_num">${esc(fmtDate(p, x.time))}</span></div>${x.gift ? `<div class="ax_lr"><span>받는 사람</span><span>${esc(x.gift)}</span></div>` : ''}</div>
        ${relatedRows(p, x.ev, `order:${x.id}`)}
        <i class="ax_pad"></i>
      </div></div>
      ${shopTab()}</div>${axInd()}`;
}

// ---- 배송 조회: the carrier, a tracking number and the scans, all worked out from the order's dates and status
const CARRIER = { KR: ['CJ대한통운', '한진택배', '롯데택배'], DE: ['DHL', 'Hermes', 'DPD'], AT: ['Post.at', 'DPD'], CH: ['Post CH', 'DPD'], US: ['UPS', 'USPS', 'FedEx'], GB: ['Royal Mail', 'Evri', 'DPD'], FR: ['Colissimo', 'Chronopost'], IT: ['Poste Italiane', 'BRT'], ES: ['Correos', 'SEUR'], JP: ['ヤマト運輸', '佐川急便'], CA: ['Canada Post', 'Purolator'], AU: ['Australia Post'] };
const seedNum = s => [...String(s)].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 2147483647, 7);
const addDay = (md, n) => { const m = String(md || '').match(/^(\d{2})-(\d{2})/); if (!m) return ''; const d = new Date(Date.UTC(2025, Number(m[1]) - 1, Number(m[2]) + n)); return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };
function trackEvents(p, x) {
    const st = STEP[x.status] ?? 0, t0 = String(x.time || ''), d0 = t0.slice(0, 5), h0 = t0.slice(6, 11) || '10:00', r = seedNum(x.id || x.item);
    const end = String(x.arrived || x.eta || addDay(d0, 2)).slice(0, 5), mm = n => String(n).padStart(2, '0'), at = (d, h, m) => `${d} ${mm(h)}:${mm(m)}`;
    const ev = [{ t: `${d0} ${h0}`, what: '주문 접수', where: '' }];
    if (st >= 1) ev.push({ t: at(d0, 17 + r % 3, (r >> 3) % 60), what: '집하', where: x.shop || '' }, { t: at(addDay(d0, 1), 2 + r % 3, (r >> 5) % 60), what: '간선 상차', where: '물류 허브' });
    if (st >= 2) ev.push({ t: at(addDay(end, -1), 21 + r % 2, (r >> 7) % 60), what: '배송센터 도착', where: '배송센터' }, { t: at(end, 7 + r % 2, (r >> 9) % 60), what: '배송 출발', where: '배송센터' });
    if (st >= 3) ev.push({ t: x.arrived && String(x.arrived).length > 6 ? String(x.arrived) : at(end, 11 + r % 6, (r >> 11) % 60), what: '배송 완료', where: x.gift ? `${x.gift}에게` : '문 앞' });
    return ev.reverse();
}
export function trackView(p, now, id) {
    const x = mo(p)?.orders?.find(o => o.id === id);
    if (!x || STEP[x.status] === undefined) return orderView(p, now, id);
    const r = seedNum(x.id || x.item), cs = CARRIER[homeCountry(p)] || ['DHL', 'UPS'], car = cs[r % cs.length];
    const no = homeCountry(p) === 'KR' ? `${5000 + r % 4000}${String(r).padStart(8, '0').slice(-8)}` : `00${String(r * 7919).padStart(12, '0').slice(-12)}`;
    const ev = trackEvents(p, x), head = x.status === 'delivered' ? `${x.arrived ? `${fmtDate(p, x.arrived, true)} ` : ''}배송 완료` : x.eta ? `${fmtDate(p, x.eta, true)} 도착 예정` : '배송 준비 중';
    return `<div class="ax_shopv">
      <div class="ax_sph ax_sphs">${axBar(p, now, '#fff')}
        <div class="ax_spr"><button type="button" class="ax_bkc" data-go="shop" aria-label="뒤로">${ax('back', 18, '#fff', 2.3)}</button><span class="ax_bkt">배송 조회</span><span class="ax_bkc">${ax('truck', 18, '#fff')}</span></div>
      </div>
      <div class="ax_sps ax_spso"><div class="ax_scroll">
        <div class="ax_card ax_oc"><div class="ax_ocr">${prodImg(x)}<span class="ax_tx"><small class="ax_trh">${esc(head)}</small><b>${esc(x.item)}</b>${x.ko && koOn() ? `<span class="ax_p">${esc(x.ko)}</span>` : ''}<span class="ax_trn cg_num">${esc(car)} · ${esc(no.replace(/(\d{4})(?=\d)/g, '$1 '))}</span></span></div></div>
        <div class="ax_card ax_trk">${ev.map((e, k) => `<div class="${k ? '' : 'on'}"><i></i><span><b>${esc(e.what)}</b><small class="cg_num">${esc(fmtDate(p, e.t, true))} ${esc(clockOf(p, e.t.slice(6, 11)))}${e.where ? ` · ${esc(e.where)}` : ''}</small></span></div>`).join('')}</div>
        <button type="button" class="ax_more ax_trd" data-go="order" data-i="${x.id}">주문 상세 보기 ${ax('chev', 14, 'currentColor', 2.4)}</button>
        <i class="ax_pad"></i>
      </div></div>
      ${shopTab()}</div>${axInd()}`;
}

// ---- 음성 메모: a tapped memo opens in place; the wave is drawn, there is no sound
const secs = n => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
function wave(id, n, played) {
    let x = [...String(id || 'v')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 233280, 3), o = '';
    for (let k = 0; k < n; k++) { x = (x * 9301 + 49297) % 233280; o += `<i class="${k < played ? 'p' : ''}" style="height: ${18 + Math.round(70 * Math.abs(Math.sin(k / 3.1 + (x % 7))) * (0.45 + (x / 233280) * 0.55))}%"></i>`; }
    return o;
}
const player = (x, n) => `<span class="ax_wave">${wave(x.id, n, Math.round(n * 0.33))}<i class="ax_wph" style="left: 33%"></i></span><span class="ax_wt cg_num"><span>${secs(Math.round(x.sec * 0.33))}</span><span>-${secs(x.sec - Math.round(x.sec * 0.33))}</span></span>
  <span class="ax_wctl"><span>${ax('rew', 22, 'currentColor')}</span><span class="ax_wpp">${ax('play', 22, 'currentColor', 2, 'currentColor')}</span><span>${ax('ffw', 22, 'currentColor')}</span></span>
  <span class="ax_wmute">${ax('lock', 11, 'currentColor')} 소리 없음 · 글로 옮긴 기록이에요</span>`;
export function voiceScreen(p, now, open = '') {
    const c = byStory(p.now), vs = (p.voice || []).map((x, k) => [x, k]).sort((a, b) => c(b[0], a[0]));
    const rec = recording.has(nameKey(p.owner));
    if (!vs.length && !p.voiceAt) return `${emptyApp(p, now, '음성 메모', 'voice', '아직 녹음이 없어요. 채우면 지난 순간들의 메모가 생겨요.').replace(`${axInd()}`, '')}${recBtn(rec)}${axInd()}`;
    return `${axBar(p, now)}
      ${axTop(axCb('home2'), axKp(p))}
      <div class="ax_scroll">
        ${axH1('음성 메모', vs.length ? `${vs.length}개` : '')}
        ${axFind()}
        <div class="ax_card ax_vm">${vs.map(([x, k]) => x.id === open ? `
          <div class="ax_rw ax_vmo"><button type="button" class="ax_vmh" data-go="voice" data-i=""><span class="ax_vmt"><b>${esc(x.title || '새로운 녹음')}</b><span class="cg_num">${secs(x.sec)}</span></span><span class="ax_vms"><span>${esc(fmtDate(p, x.time, true))} ${esc(fmtTime(p, x.time))}</span><span>${esc(x.place || '')}</span></span></button>
            ${player(x, 64)}<span class="ax_vmfoot"><button type="button" class="na_ph_rm ax_vmdel" data-kind="voice" data-i="${esc(x.id)}" aria-label="지우기">${ax('trash2', 21, 'currentColor', 1.9)}</button><button type="button" class="ax_vmmore" data-go="voiceone" data-i="${k}">글로 옮긴 내용 ›</button></span></div>` : `
          <button type="button" class="ax_rw ax_vmr" data-go="voice" data-i="${x.id}"><span class="ax_vmt"><b>${esc(x.title || '새로운 녹음')}</b><span class="cg_num">${secs(x.sec)}</span></span><span class="ax_vms"><span>${esc(fmtDate(p, x.time, true))}</span><span>${esc(x.place || '')}</span></span></button>`).join('') || '<div class="ax_empty">녹음이 없어요</div>'}</div>
        <i class="ax_pad big"></i><i class="ax_pad big"></i>
      </div>
      ${recBtn(rec)}
      ${axInd()}`;
}
const recBtn = busy => `<div class="ax_rec"><button type="button" class="ax_recb na_ph_rec" ${busy ? 'disabled' : ''} aria-label="떠올리기">${busy ? busyHtml : ''}</button><small>${busy ? '떠올리는 중' : '떠올리기'}</small></div>`;
export function voiceOne(p, now, k) {
    const x = (p.voice || [])[Number(k)];
    if (!x) return voiceScreen(p, now);
    return `${axBar(p, now)}
      ${axTop(axCb(`voice:${x.id}`), axKp(p))}
      <div class="ax_scroll">
        <div class="ax_vhd"><b>${esc(x.title || '새로운 녹음')}</b>${x.kt && koOn() ? `<small>${esc(x.kt)}</small>` : ''}<span class="cg_num">${esc(fmtDate(p, x.time))} ${esc(fmtTime(p, x.time))}${x.place ? ` · ${esc(x.place)}` : ''} · ${secs(x.sec)}</span></div>
        <div class="ax_card ax_vbig">${player(x, 72)}</div>
        <div class="ax_sec">글로 옮긴 내용</div>
        <div class="ax_card ax_vtr">${esc(x.text)}${x.ko && koOn() ? `<span class="ax_k">${esc(x.ko)}</span>` : ''}</div>
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
