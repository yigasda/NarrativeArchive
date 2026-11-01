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
import { byStory, fmtDate, fmtTime, gapDays, koOn, listTime, storyNow } from './phonedata.js';
import { esc } from './util.js';
import { prodSvg } from './phoneprod.js';

Object.assign(AX, {
    plane: 'M2 13l20-6-3 4-8 3-3 6-2-5z', train: 'M6 4h12v11a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3zM6 10h12M9 21l1-3M15 21l-1-3', bed: 'M3 18v-9M3 13h18v5M7 13V9h6a4 4 0 0 1 4 4',
    ticket: 'M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 0 0-4V5H3z', card: 'M3 6h18v12H3zM3 10h18M7 15h4', send2: 'M5 12h14M13 6l6 6-6 6', down2: 'M12 5v14M6 13l6 6 6-6',
    swap: 'M7 7h12l-3-3M17 17H5l3 3', truck: 'M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-.1M17 19a2 2 0 1 0 0-.1', gift: 'M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0',
    bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0', doc: 'M6 3h9l4 4v14H6zM9 12h7M9 16h5', homeS: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    grid4: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', cart: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6M9 20h.01M17 20h.01', receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    play: 'M8 5v14l11-7z', rew: 'M11 19l-7-7 7-7M20 19l-7-7 7-7', ffw: 'M13 5l7 7-7 7M4 5l7 7-7 7', bag: 'M5 8h14l-1.2 11a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9zM9 8V6a3 3 0 0 1 6 0v2',
    box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10', link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1',
});

// money as the owner's phone writes it (1.284,17 € in Germany, $1,284.17 in the US)
const LOCALE = { KR: 'ko-KR', US: 'en-US', GB: 'en-GB', DE: 'de-DE', FR: 'fr-FR', IT: 'it-IT', ES: 'es-ES', JP: 'ja-JP', CN: 'zh-CN', TW: 'zh-TW', CA: 'en-CA', AU: 'en-AU', RU: 'ru-RU', BR: 'pt-BR', AT: 'de-AT', CH: 'de-CH' };
export function fmtMoney(p, n, signed = false) {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
    let s;
    try { s = new Intl.NumberFormat(LOCALE[p.country] || 'en-US', { style: 'currency', currency: p.money?.currency || 'EUR' }).format(Number(n)); } catch { s = `${Number(n).toFixed(2)} ${p.money?.currency || ''}`; }
    return signed && n > 0 ? `+${s}` : s;
}
// the same, in a currency of its own (the investment app holds several)
export const fmtIn = (p, n, cur, signed = false) => fmtMoney({ ...p, money: { currency: cur || p.money?.currency || 'EUR' } }, n, signed);
// Display currency never changes an account's denomination or its ledger.
const LOCAL_CURRENCY = {KR:'KRW',US:'USD',GB:'GBP',DE:'EUR',FR:'EUR',IT:'EUR',ES:'EUR',AT:'EUR',JP:'JPY',CN:'CNY',TW:'TWD',CA:'CAD',AU:'AUD',RU:'RUB',BR:'BRL',CH:'CHF'};
export const bankDisplayCurrency = p => currency(p.money?.displayCurrency) || LOCAL_CURRENCY[p.country] || p.money?.currency || 'EUR';
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
    const d = String(bankDate(p) || '').match(/^(\d{4})-(\d{2})-(\d{2})/), day = d ? `${Number(d[2])}월 ${Number(d[3])}일` : '날짜 정하기';
    return `<div class="ax_fx_tools">
      <label class="ax_fxs">${ax('globe', 17, 'currentColor', 1.9)}<span><small>표시 통화</small><b>${esc(selected)}</b></span>${ax('chev', 12, '#a3aab4', 2.4)}<select class="bank_display" aria-label="표시 통화">${options.map(c=>`<option value="${esc(c)}" ${c === selected ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="ax_fxs">${ax('cal', 17, 'currentColor', 1.9)}<span><small>환산 날짜</small><b class="cg_num">${esc(day)}</b></span>${ax('chev', 12, '#a3aab4', 2.4)}<input type="date" class="bank_fxdate" aria-label="환산 날짜" value="${esc(bankDate(p))}"></label>
      <button type="button" class="bank_fxrefresh" aria-label="환율 확인">${ax('again', 17, 'currentColor', 2.1)}</button></div>`;
}
const busyOf = (p, k) => filling.has(`${nameKey(p.owner)}:${k}`);
const mo = p => p.money || null;
const acctOf = (p, last4) => mo(p)?.bank?.accounts?.find(a => a.last4 === last4);
const txMoney = (p, x, signed = false) => fmtMoney({ ...p, money: { currency: x.currency || acctOf(p, x.account)?.currency || mo(p)?.currency } }, x.amount, signed);
const kindName = { checking: '입출금', savings: '저축', credit: '신용카드' };
const fi = (t, z = 36, c = axTint(t), r = 12) => `<span class="ax_fi" style="width: ${z}px; height: ${z}px; border-radius: ${r}px; background: ${c}">${esc([...String(t || '?').trim()][0]?.toUpperCase() || '?')}</span>`;

// 관련 기록: every other record with the same story-event tag, opening in its own app
export function relatedRows(p, ev, skip = '') {
    if (!ev) return '';
    const rows = [];
    const add = (go, i, icon, color, title, sub) => { if (`${go}:${i}` !== skip) rows.push(`<button type="button" class="ax_rw" data-go="${go}" data-i="${i}"><span class="ax_fi" style="width: 30px; height: 30px; background: ${color}">${ax(icon, 15, '#fff')}</span><span class="ax_tx"><b>${esc(title)}</b><span class="ax_p">${esc(sub)}</span></span>${ax('chev', 15, '#b7bdc6', 2.4)}</button>`); };
    (p.mails || []).forEach((x, k) => { if (x.ev === ev) add('mailone', k, 'mail', '#8faed1', x.subject || x.from, `메일 · ${fmtDate(p, x.time, true)}`); });
    p.events.forEach((x, k) => { if (x.ev === ev) add('calone', k, 'cal', '#b0564e', x.title, `캘린더 · ${fmtDate(p, x.date, true)}${x.time ? ` ${x.time}` : ''}`); });
    for (const x of mo(p)?.passes || []) if (x.ev === ev) add('pass', x.id, 'ticket', '#3d4a66', x.by, `지갑 · ${fmtDate(p, x.date, true)}`);
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
const tab = on => `<div class="ax_btab">${[['homeS', '홈', 'bank'], ['send2', '송금', ''], ['card', '카드', 'wallet'], ['menu', '더보기', '']].map(([k, l, go]) => (go ? `<button type="button" class="${k === on ? 'on' : ''}" data-go="${go}">${ax(k, 24, 'currentColor')}${l}</button>` : `<span>${ax(k, 24, 'currentColor')}${l}</span>`)).join('')}</div>`;
const txRow = (p, x) => `<button type="button" class="ax_rw" data-go="tx" data-i="${x.id}">${fi(x.who, 38)}<span class="ax_tx"><b class="ax_n">${esc(x.who)}${x.pending ? '<span class="ax_pend">대기</span>' : ''}${x.ev && (mo(p).orders.some(o => o.ev === x.ev) || mo(p).passes.some(o => o.ev === x.ev)) ? `<span class="ax_lnk">${ax('link', 10, 'currentColor', 2.4)} ${mo(p).orders.some(o => o.ev === x.ev) ? '쇼핑' : '지갑'}</span>` : ''}</b><span class="ax_p">${esc(fmtDate(p, x.time, true))} · ${x.kind === 'card' ? '카드' : x.kind === 'transfer' ? '송금' : '입금'}${x.memo ? ` · ${esc(x.memo)}` : ''}</span></span><span class="ax_amt ${x.amount > 0 ? 'p' : ''} cg_num">${esc(txMoney(p, x, true))}</span></button>`;
const newestTx = p => [...(mo(p)?.tx || [])].sort(byStory(p.now)).reverse();
export function bankHome(p, now) {
    const M = mo(p);
    if (!M) return emptyApp(p, now, '은행', 'money', '아직 계좌가 없어요. 채우면 은행 · 지갑 · 쇼핑이 함께 생겨요.');
    const sum = bankSum(p);
    return `<div class="ax_bk">
      <div class="ax_bkh">${axBar(p, now, '#fff')}
        <div class="ax_bkr"><button type="button" class="ax_bkc" data-go="home2" aria-label="뒤로">${ax('back', 18, '#fff', 2.3)}</button><span class="ax_bkhi"><small>${esc(M.bank.name)}</small><b>안녕하세요, ${esc(p.owner)}</b></span><span class="ax_bkc">${ax('bell', 18, '#fff')}</span></div>
        <div class="ax_bktot"><small>${sum.complete ? '예금 잔액 · ' + esc(bankDisplayCurrency(p)) + ' 기준' : '환산 가능한 소계 · 환산 미완료'}</small><b class="cg_num">${esc(fmtIn(p, sum.value, bankDisplayCurrency(p)))}</b>${missingSum(p,sum)}<span>계좌 ${M.bank.accounts.length}개 · 환산 기준 ${esc(bankDate(p) || '날짜 미확정')}</span></div>
        <div class="ax_bkacts"><span><b>${ax('send2', 20, '#fff', 2.2)}</b>송금</span><button type="button" data-go="fixed"><b>${ax('rep', 20, '#fff', 2.1)}</b>고정 지출</button><span><b>${ax('swap', 20, '#fff', 2.2)}</b>이체</span><button type="button" data-go="wallet"><b>${ax('card', 20, '#fff')}</b>카드</button></div>
      </div>
      <div class="ax_bks"><div class="ax_scroll">
        ${displayTools(p)}<div class="ax_shd">내 계좌</div>
        <div class="ax_card">${M.bank.accounts.map((a, i) => `<button type="button" class="ax_acc" data-go="acct" data-i="${i}"><span class="ax_accic ${a.kind}">${ax(a.kind === 'savings' ? 'star' : 'card', 20, 'currentColor')}</span><span class="ax_tx"><b>${kindName[a.kind]}${a.name ? ` · ${esc(a.name)}` : ''}</b><small class="cg_num">•••• ${esc(a.last4)}</small></span><span class="ax_accv"><b class="cg_num">${esc(fmtMoney({ ...p, money: { currency: a.currency || M.currency } }, a.kind === 'credit' ? creditAmount(a) : a.balance))}</b><small>${a.kind === 'credit' ? creditLabel(a) : '사용 가능'}</small>${converted(p,a) ? `<small class="ax_fx_note">${converted(p,a,true)}</small>` : ''}</span></button>`).join('')}</div>
        <div class="iv_navs"><button type="button" class="iv_nav" data-go="invest">투자 계좌</button><button type="button" class="iv_nav" data-go="ivactivity">연결된 이체</button></div><div class="ax_shd">최근 거래</div>
        <div class="ax_card">${newestTx(p).slice(0, 4).map(x => txRow(p, x)).join('') || '<div class="ax_empty">거래가 없어요</div>'}</div>
        <i class="ax_pad"></i>
      </div></div>
      ${tab('homeS')}</div>${axInd()}`;
}
export function bankAcct(p, now, key) {
    const [i, f = 'all'] = String(key).split('.'), a = mo(p)?.bank?.accounts?.[Number(i)];
    if (!a) return bankHome(p, now);
    migrateBank(getMeta(), p);
    const all = newestTx(p).filter(x => x.account === a.last4), xs = all.filter(x => f === 'in' ? x.amount > 0 : f === 'out' ? x.amount < 0 : true);
    const pend = xs.filter(x => x.pending), done = xs.filter(x => !x.pending), days = [...new Set(done.map(x => x.time.slice(0, 5)))];
    const pendSum = all.filter(x => x.pending).reduce((s, x) => s + x.amount, 0);
    const chip = (k, l) => `<button type="button" class="${f === k ? 'on' : ''}" data-go="acct" data-i="${i}.${k}">${l}</button>`;
    return `<div class="ax_bk">
      <div class="ax_bkh">${axBar(p, now, '#fff')}
        <div class="ax_bkr"><button type="button" class="ax_bkc" data-go="bank" aria-label="뒤로">${ax('back', 18, '#fff', 2.3)}</button><span class="ax_bkt">${kindName[a.kind]} · ${esc(a.last4)}</span><span class="ax_bkc">${ax('search', 17, '#fff', 2.3)}</span></div>
        <div class="ax_bktot ax_center"><small>${a.kind === 'credit' ? creditLabel(a) : '사용 가능 잔액'}</small><b class="cg_num">${esc(fmtMoney({ ...p, money: { currency: a.currency || mo(p).currency } }, a.kind === 'credit' ? creditAmount(a) : a.balance))}</b>${converted(p,a) ? `<span>${converted(p,a)}</span>` : ''}<span>${pendSum ? `대기 중 ${esc(fmtMoney({ ...p, money: { currency: a.currency || mo(p).currency } }, pendSum, true))}` : esc(a.name || '')}</span></div>
        <div class="ax_bkacts ax_three"><span><b>${ax('send2', 20, '#fff', 2.2)}</b>송금</span><span><b>${ax('swap', 20, '#fff', 2.2)}</b>이체</span><span><b>${ax('doc', 20, '#fff')}</b>명세서</span></div>
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
export function bankTx(p, now, id) {
    const x = mo(p)?.tx?.find(t => t.id === id);
    if (!x) return bankHome(p, now);
    const a = acctOf(p, x.account), ai = mo(p).bank.accounts.indexOf(a);
    return `<div class="ax_bk">
      <div class="ax_bkh ax_bkhs">${axBar(p, now, '#fff')}
        <div class="ax_bkr"><button type="button" class="ax_bkc" data-go="${ai >= 0 ? `acct:${ai}` : 'bank'}" aria-label="뒤로">${ax('back', 18, '#fff', 2.3)}</button><span class="ax_bkt">거래 상세</span><span class="ax_bkc">${ax('share', 17, '#fff')}</span></div>
      </div>
      <div class="ax_bks ax_bkso"><div class="ax_scroll">
        <div class="ax_rcpt"><div class="ax_rch">${fi(x.who, 56, axTint(x.who), 18)}<b>${esc(x.who)}</b>${x.ko && koOn() ? `<small>${esc(x.ko)}</small>` : ''}<strong class="cg_num">${esc(txMoney(p, x, true))}</strong><span class="ax_rok ${x.pending ? 'pend' : ''}">${x.pending ? '대기 중' : '완료'}</span></div>
          <div class="ax_rln"><span>날짜</span><span class="cg_num">${esc(fmtDate(p, x.time))} ${esc(fmtTime(p, x.time))}</span></div>
          <div class="ax_rln"><span>계좌</span><span>${a ? `${kindName[a.kind]} •••• ${esc(a.last4)}` : '—'}</span></div>
          <div class="ax_rln"><span>방식</span><span>${x.kind === 'card' ? '카드 결제' : x.kind === 'transfer' ? '송금' : '입금'}</span></div>
          ${x.memo ? `<div class="ax_rln"><span>메모</span><span>${esc(x.memo)}</span></div>` : ''}</div>
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
const payee = x => String(x.who || '').toLowerCase().replace(/[^\p{L}\p{N}&+]+/gu, ' ').trim().split(' ').slice(0, 2).join(' ');
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
        const steady = months.length >= 2 && last.kind !== 'transfer' && Math.abs(xs[1].amount - last.amount) <= Math.abs(last.amount) * 0.03 && dd(xs[1], last) <= 3;
        if (!cat && !steady) continue;
        const [, icon, bg, fg, label] = cat || [null, 'rep', '#eceef2', '#3f4a5a', '매달'];
        out.push({ key: k, who: last.who, ko: last.ko, amount: last.amount, account: last.account, currency: last.currency, day: Number(String(last.time).slice(3, 5)) || 1, icon, bg, fg, label, xs });
    }
    return out.sort((a, b) => a.day - b.day);
}
export function fixedScreen(p, now, key = '') {
    const M = mo(p); if (!M) return bankHome(p, now);
    const list = fixedCosts(p), today = String(storyNow(p) || p.now || ''), mm = today.slice(0, 2), td = Number(today.slice(3, 5)) || 1, dim = daysIn(p, mm);
    const st = f => {
        if (f.xs.some(x => String(x.time).slice(0, 2) === mm)) return ['나감', 'ok', 'p'];
        if (f.day === td) return ['오늘', '', 'd'];
        if (f.day > td) return [`D-${f.day - td}`, f.day - td <= 7 ? '' : 'g', 'd'];
        return [`D-${dim - td + Math.min(f.day, daysIn(p, Number(mm) % 12 + 1))}`, 'g', ''];
    };
    const money = (f, n, signed) => fmtMoney({ ...p, money: { currency: f.currency || acctOf(p, f.account)?.currency || M.currency } }, n, signed);
    const sum = list.reduce((s, f) => s + Math.abs(f.amount), 0), paid = list.filter(f => st(f)[1] === 'ok');
    const pay = [...(M.tx || [])].filter(x => x.amount > 0 && PAYDAY.test(`${x.who} ${x.memo || ''} ${x.ko || ''}`)).sort(byStory(p.now)).pop();
    const sel = list.find(f => f.key === key) || list[0];
    const marks = new Map(); for (const f of list) { const s = st(f)[2]; if (s && f.day <= dim) marks.set(f.day, marks.get(f.day) === 'p' ? 'p' : s); }
    const acct = f => { const a = acctOf(p, f.account); return a ? `${kindName[a.kind]} ${a.last4}` : ''; };
    return `<div class="ax_bk">
      <div class="ax_bkh ax_bkhs">${axBar(p, now, '#fff')}
        <div class="ax_bkr"><button type="button" class="ax_bkc" data-go="bank" aria-label="뒤로">${ax('back', 18, '#fff', 2.3)}</button><span class="ax_bkt">고정 지출</span><span class="ax_bkc ax_ghost"></span></div>
        <div class="ax_bktot ax_center"><small>매달 나가는 돈</small><b class="cg_num">${esc(fmtMoney(p, sum))}</b><span>${list.length ? pay ? `월급 ${esc(txMoney(p, pay))}의 ${Math.round(sum / pay.amount * 100)}%` : `${list.length}건 · 이번 달 ${paid.length}건 나감` : '아직 없어요'}</span></div>
      </div>
      <div class="ax_bks ax_bkso"><div class="ax_scroll">
        ${list.length ? `<div class="ax_fxcal">${Array.from({ length: dim }, (_, k) => `<i class="${[marks.get(k + 1) || '', k + 1 === td ? 't' : ''].join(' ').trim()}">${k + 1}</i>`).join('')}</div>
        <div class="ax_sec">${Number(mm) || ''}월</div>
        <div class="ax_card">${list.map(f => { const [t, c] = st(f); return `<button type="button" class="ax_rw${f === sel ? ' on' : ''}" data-go="fixed" data-i="${esc(f.key)}"><span class="ax_fi" style="width: 38px; height: 38px; background: ${f.bg}; color: ${f.fg}">${ax(f.icon, 20, 'currentColor', 1.9)}</span><span class="ax_tx"><b class="ax_n">${esc(f.who)}<span class="ax_dd ${c}">${t}</span></b><span class="ax_p">매달 ${f.day}일${acct(f) ? ` · ${esc(acct(f))}` : ''}</span></span><span class="ax_fxv"><b class="ax_amt cg_num">${esc(money(f, f.amount, true))}</b><small>${f.label}</small></span></button>`; }).join('')}</div>
        ${sel ? `<div class="ax_sec">지난 결제 · ${esc(sel.who)}</div><div class="ax_card">${sel.xs.map(x => txRow(p, x)).join('')}</div>` : ''}`
        : '<div class="ax_card ax_fillc"><p>매달 나가는 돈이 아직 안 보여요.<br>월세 · 통신비 · 구독 같은 결제가 생기면 여기 모여요.</p></div>'}
        <i class="ax_pad"></i>
      </div></div>
      ${tab('homeS')}</div>${axInd()}`;
}

// ---- 지갑: the bank's cards on top, then the passes, stacked like a real wallet
const chip = '<span class="ax_ccchip"><i style="left: 0; right: 0; top: 11px; height: 1px"></i><i style="left: 0; right: 0; top: 21px; height: 1px"></i><i style="top: 0; bottom: 0; left: 15px; width: 1px"></i><i style="top: 0; bottom: 0; left: 29px; width: 1px"></i></span>';
const nfc = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".85"><path d="M8.5 8a6 6 0 0 1 0 8M12 5.5a10 10 0 0 1 0 13M15.5 3a14 14 0 0 1 0 18"/></svg>';
const CC_BG = { checking: '#1d3461', credit: '#25272e', savings: '#2f5d50' };
// each bank has its colour family (two shades) and each card a pattern; premium credit cards by how much the owner has
const BANK_C = [['#2c4a80', '#1d2f55'], ['#b8323a', '#8e2730'], ['#2f6a5a', '#224f43'], ['#4a3f7a', '#352c5a'], ['#2f6f8f', '#225369'], ['#8a5a2e', '#6a431f'], ['#3f4a5a', '#2b333f']];
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
const PATS = ['waves', 'circles', 'lines', 'dots', 'grid'];
const hashOf = s => [...String(s || '')].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 2147483647, 7);
// "how much they have" in the bank's money, scaled so the tiers mean about the same in won, yen or euros
const SCALE = { KRW: 1300, JPY: 150, CNY: 7, TWD: 32, INR: 83, RUB: 90, BRL: 5, CAD: 1.35, AUD: 1.5, GBP: 0.8 };
function cardLook(p, a, k) {
    const name = String(a?.name || ''), bank = mo(p).bank.name || '', [c1, c2] = BANK_C[hashOf(bank) % BANK_C.length];
    if (a?.kind === 'credit') {
        const has = mo(p).bank.accounts.filter(x => x.kind !== 'credit').reduce((n, x) => n + Math.max(0, Number(x.balance) || 0) / (SCALE[x.currency] || 1), 0);
        if (/black|schwarz|블랙|infinite|centurion/i.test(name) || has >= 400000) return { tier: 'BLACK', bg: '#17181b', ink: '#d9dbe0', pat: 'brushed', chipc: '#b8bcc4', mono: true };
        if (/platin|플래티넘/i.test(name) || has >= 120000) return { tier: 'PLATINUM', bg: '#c9ccd2', ink: '#23272e', pat: 'platinum', chipc: '#dcd6c4' };
        if (/gold|골드/i.test(name) || has >= 40000) return { tier: 'GOLD', bg: '#b8913a', ink: '#2b2210', pat: 'guilloche', chipc: '#efe0b0' };
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
// says it is (a cinema, a match, a museum, a bus or ferry, else a concert or show); empty fields are left out
const PASS = { flight: ['#2c4a80', 'plane', '탑승'], train: ['#8e3a33', 'train', '열차'], hotel: ['#efe2cf', 'bed', '체크인'], concert: ['#26304f', 'ticket', '입장'],
    movie: ['#1d1d22', 'film', '상영'], match: ['#2f6a3a', 'ball', '킥오프'], museum: ['#f3ede4', 'museum', '관람'], bus: ['#2f6f8f', 'bus', '출발'], other: ['#3d4a66', 'ticket', '시간'] };
const LIGHT = new Set(['hotel', 'museum']);
Object.assign(AX, { film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4', ball: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7l4 3-1.5 5h-5L8 10z', museum: 'M3 9l9-5 9 5M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18', bus: 'M6 4h12a2 2 0 0 1 2 2v10H4V6a2 2 0 0 1 2-2zM4 11h16M7 19v-3M17 19v-3M8 14h.01M16 14h.01' });
const passKind = x => {
    if (['flight', 'train', 'hotel'].includes(x.kind)) return x.kind;
    const w = `${x.by || ''} ${x.to || ''} ${x.from || ''}`;
    if (/kino|cinema|movie|film|영화|cgv|megabox|롯데시네마|映画|电影/i.test(w)) return 'movie';
    if (/stadion|stadium|arena|park\b|match|spiel|fc\b|sv\b|경기|구장|스타디움|球場|体育/i.test(w)) return 'match';
    if (/museum|galerie|gallery|ausstellung|exhibit|미술관|박물관|전시|美術館|博物馆/i.test(w)) return 'museum';
    if (/bus|flixbus|fernbus|fähre|ferry|ship|schiff|버스|페리|여객선|フェリー|巴士|轮渡/i.test(w)) return 'bus';
    return x.kind === 'event' ? 'concert' : 'other';
};
const nights = (a, b) => { const m = s => String(s || '').match(/^(\d{2})-(\d{2})/); const x = m(a), y = m(b); if (!x || !y) return null; const d = (Date.UTC(2025, y[1] - 1, y[2]) - Date.UTC(2025, x[1] - 1, x[2])) / 864e5; return d > 0 && d < 60 ? d : null; };
function passArt(p, x, full) {
    const k = passKind(x), [bg, icon, lab] = PASS[k], light = LIGHT.has(k);
    const f = (label, v) => (v === null || v === undefined || String(v).trim() === '' || v === '—' ? '' : `<span><small>${label}</small><b>${esc(String(v))}</b></span>`);
    const route = (a, b, big) => `<span class="ax_psrt ${big ? '' : 'ln'}"><span><b class="${big && String(a).length <= 4 ? '' : 'ax_pbsm'}">${esc(a)}</b></span><span class="ax_pspl">${big ? ax('plane', 22, 'currentColor', 1.6) : '<i></i>'}</span><span class="ax_r"><b class="${big && String(b).length <= 4 ? '' : 'ax_pbsm'}">${esc(b)}</b></span></span>`;
    const title = t => `<span class="ax_psti">${esc(t)}</span>`;
    const date = fmtDate(p, x.date, true);
    let mid = '', fields = '';
    if (k === 'flight') { mid = x.from && x.to ? route(x.from, x.to, true) : title(x.to || x.from || ''); fields = f('날짜', date) + f('탑승구', x.gate) + f('좌석', x.seat) + f('편명', x.no); }
    else if (k === 'train' || k === 'bus') { mid = x.from && x.to ? route(x.from, x.to, false) : title(x.to || x.from || ''); fields = f('날짜', date) + f('좌석', x.seat) + f(k === 'bus' ? '예약' : '번호', x.no) + f('소유자', String(p.owner).toUpperCase()); }
    else if (k === 'hotel') { const n = nights(x.date, x.to && /^\d{2}-\d{2}/.test(x.to) ? x.to : ''); mid = title(x.to && !/^\d{2}-\d{2}/.test(x.to) ? x.to : x.from || ''); fields = f('체크인', date) + f('숙박', n ? `${n}박` : '') + f('예약', x.no) + f('객실', x.seat); }
    else if (k === 'match') { const m = String(x.to || x.from || '').split(/\s+(?:vs\.?|gegen|대|–|-)\s+/i); mid = m.length === 2 ? `<span class="ax_psvs"><b>${esc(m[0])}</b><small>vs</small><b>${esc(m[1])}</b></span>` : title(x.to || x.from || ''); fields = f('날짜', date) + f('블록', x.gate) + f('좌석', x.seat) + f('번호', x.no); }
    else { mid = title(x.to || x.from || ''); fields = f('날짜', date) + f(k === 'movie' ? '관' : k === 'museum' ? '입장권' : '구역', x.gate) + f('좌석', x.seat) + f('번호', x.no); }
    return `<span class="ax_ps ax_ps_${k} ${light ? 'cream' : ''}" style="background: ${bg}">
      <span class="ax_psh"><span class="ax_pslg">${ax(icon, 16, 'currentColor')}</span><span class="ax_psn">${esc(String(x.by || '').toUpperCase())}</span><span class="ax_pshr">${lab}<b class="cg_num">${esc(x.time || date || '')}</b></span></span>
      ${mid}<span class="ax_psfl">${fields}</span>
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
export function walletScreen(p, now) {
    const M = mo(p);
    if (!M) return emptyApp(p, now, '지갑', 'money', '아직 지갑이 비어 있어요. 채우면 은행 · 지갑 · 쇼핑이 함께 생겨요.');
    migrateBank(getMeta(),p);
    const ps = [...M.passes].sort((a, b) => gapDays(p.now, a.date) - gapDays(p.now, b.date));
    return `${axBar(p, now)}
      ${axTop(axCb('home2'))}
      <div class="ax_scroll">
        ${axH1('지갑', `카드 ${M.cards.length} · 패스 ${ps.length}`)}
        ${M.cards.length ? `<div class="ax_wl ax_ccstack">${M.cards.map((c, i) => `<button type="button" class="ax_wlb" data-go="card" data-i="${i}">${cardArt(p, c)}</button>`).join('')}</div>` : ''}
        ${(() => { const today = String(storyNow(p) || p.now || '').slice(0, 5), past = x => gapDays(today, x.date) < 0 || /used|benutzt|abgelaufen|expired|사용|지난/i.test(x.status || ''), up = ps.filter(x => !past(x)), old = ps.filter(past).reverse();
            const stack = (xs, cls) => `<div class="ax_wl ax_psstack ${cls}">${xs.map(x => `<button type="button" class="ax_wlb" data-go="pass" data-i="${x.id}">${passArt(p, x, false)}</button>`).join('')}</div>`;
            return `${up.length ? `<div class="ax_shd">패스<span>${up.length}개</span></div>${stack(up, '')}` : ''}${old.length ? `<div class="ax_shd">지난 패스<span>${old.length}개</span></div>${stack(old, 'ax_psold')}` : ''}`; })()}
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
const prodImg = x => `<span class="ax_pimg">${prodSvg(x) || ax(itemIc(x), 30, '#7d8796', 1.7)}${x.gift ? `<i>${ax('gift', 11, '#a2526b', 2.2)}</i>` : ''}</span>`;
export function shopScreen(p, now, f = 'all') {
    const M = mo(p);
    if (!M) return emptyApp(p, now, '쇼핑', 'money', '아직 주문이 없어요. 채우면 은행 · 지갑 · 쇼핑이 함께 생겨요.');
    const os = [...M.orders].sort(byStory(p.now)).reverse();
    const go = os.filter(x => x.status !== 'delivered' && x.status !== 'unknown'), ok = os.filter(x => x.status === 'delivered');
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
    const st = STEP[x.status], tx = x.ev ? mo(p).tx.find(t => t.ev === x.ev) : null, ai = tx ? mo(p).bank.accounts.findIndex(a => a.last4 === tx.account) : -1;
    const head = ORDER_STATE[x.status] ? [ORDER_STATE[x.status], x.status==='refunded'?'환불됐어요':x.status==='returned'?'반품이 완료됐어요':x.status==='returning'?'반품 처리 중이에요':'주문이 취소됐어요'] : x.status === 'delivered' ? ['배송 완료', x.arrived ? `${fmtDate(p, x.arrived)} 도착` : '도착했어요'] : x.status === 'unknown' ? ['배송 상태', '확인되지 않았어요'] : [x.status === 'ordered' ? '주문 완료' : '배송 중', x.eta ? `${fmtDate(p, x.eta)} 도착 예정` : '도착일 미정'];
    const total = x.price === null ? null : x.price * (x.qty || 1);
    return `<div class="ax_shopv">
      <div class="ax_sph ax_sphs">${axBar(p, now, '#fff')}
        <div class="ax_spr"><button type="button" class="ax_bkc" data-go="shop" aria-label="뒤로">${ax('back', 18, '#fff', 2.3)}</button><span class="ax_bkt">주문 상세</span><span class="ax_bkc">${ax('cart', 18, '#fff')}</span></div>
      </div>
      <div class="ax_sps ax_spso"><div class="ax_scroll">
        <div class="ax_dhero"><small>${esc(head[0])}</small><b>${esc(head[1])}</b><span>${esc(x.shop)}${x.gift ? ` · 선물로 ${esc(x.gift)}에게` : ''}</span>
          ${st === undefined ? '' : `<span class="ax_steps" style="--done: ${[0, 34, 67, 100][st]}%">${['주문', '발송', '배송 중', '도착'].map((l, k) => `<span class="${k < st || (k === st && st === 3) ? 'd' : k === st ? 'c' : ''}"><i>${k < st || (k === st && st === 3) ? ax('check', 11, '#fff', 3) : ''}</i>${l}</span>`).join('')}</span>`}</div>
        <div class="ax_card ax_oc"><div class="ax_ocr">${prodImg(x)}<span class="ax_tx"><small class="ax_ocsl">${esc(String(x.shop || '').toUpperCase())}</small><b>${esc(x.item)}</b>${x.ko && koOn() ? `<span class="ax_p">${esc(x.ko)}</span>` : ''}<span class="ax_ocpr cg_num">${esc(fmtMoney(p, x.price))}<small>${esc([x.option, `${x.qty || 1}개`].filter(Boolean).join(' · '))}</small></span></span></div></div>
        <div class="ax_sec">결제</div><div class="ax_card"><div class="ax_lr"><span>상품 금액</span><span class="cg_num">${esc(fmtMoney(p, total))}</span></div><div class="ax_lr"><span><b>${x.paid===false?'결제 예정':'총 결제'}</b></span><span class="cg_num"><b>${esc(fmtMoney(p, total))}</b></span></div>
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
    const r = seedNum(x.id || x.item), cs = CARRIER[p.country] || ['DHL', 'UPS'], car = cs[r % cs.length];
    const no = p.country === 'KR' ? `${5000 + r % 4000}${String(r).padStart(8, '0').slice(-8)}` : `00${String(r * 7919).padStart(12, '0').slice(-12)}`;
    const ev = trackEvents(p, x), head = x.status === 'delivered' ? `${x.arrived ? `${fmtDate(p, x.arrived, true)} ` : ''}배송 완료` : x.eta ? `${fmtDate(p, x.eta, true)} 도착 예정` : '배송 준비 중';
    return `<div class="ax_shopv">
      <div class="ax_sph ax_sphs">${axBar(p, now, '#fff')}
        <div class="ax_spr"><button type="button" class="ax_bkc" data-go="shop" aria-label="뒤로">${ax('back', 18, '#fff', 2.3)}</button><span class="ax_bkt">배송 조회</span><span class="ax_bkc">${ax('truck', 18, '#fff')}</span></div>
      </div>
      <div class="ax_sps ax_spso"><div class="ax_scroll">
        <div class="ax_card ax_oc"><div class="ax_ocr">${prodImg(x)}<span class="ax_tx"><small class="ax_trh">${esc(head)}</small><b>${esc(x.item)}</b>${x.ko && koOn() ? `<span class="ax_p">${esc(x.ko)}</span>` : ''}<span class="ax_trn cg_num">${esc(car)} · ${esc(no.replace(/(\d{4})(?=\d)/g, '$1 '))}</span></span></div></div>
        <div class="ax_card ax_trk">${ev.map((e, k) => `<div class="${k ? '' : 'on'}"><i></i><span><b>${esc(e.what)}</b><small class="cg_num">${esc(fmtDate(p, e.t, true))} ${esc(e.t.slice(6, 11))}${e.where ? ` · ${esc(e.where)}` : ''}</small></span></div>`).join('')}</div>
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
