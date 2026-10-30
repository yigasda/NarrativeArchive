// 캐릭터 휴대폰 · 은행 · 지갑 · 쇼핑 · 음성 메모 (v3.133): drawn like the real apps, in the phone's flat look.
// p.money = { currency, bank: { name, accounts }, cards, tx, passes, orders } (채우기, one request so the amounts agree);
// p.voice = memos (the story's, 채우기's from the archive, and 떠올리기's right now). Records with the same "ev" link to each other.

import { getMeta } from './core.js';
import { migrateBank, total, fx, price, finite, currency } from './finance.js';
import { investmentDate } from './investdata.js';
import { nameKey } from './people.js';
import { filling, recording } from './phoneai.js';
import { AX, ax, axBar, axCb, axDay, axFind, axH1, axInd, axKp, axLetter, axTint, axTop, busyHtml } from './phoneapps.js';
import { fmtDate, fmtTime, koOn, listTime } from './phonedata.js';
import { esc } from './util.js';

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
    const meta = getMeta(), amount = a.kind === 'credit' ? a.spent ?? a.balance : a.balance;
    const rate = fx(meta,from,to,date), q = price(meta,`FX:${from}/${to}`,date);
    if (!finite(amount) || rate === null) return `${esc(to)} 환산 대기`;
    if (brief) return `${esc(fmtIn(p,amount * rate,to))} 환산`;
    return `${esc(fmtIn(p,amount * rate,to))} 환산 · 1 ${esc(from)} = ${esc(fmtIn(p,rate,to))} · ${esc(date)} · ${q?.source === 'story' ? '원문 환율' : '가상 환율'}${q?.conflict ? ' · 환율 확인 필요' : ''}`;
}
function bankSum(p) {
    const meta = getMeta(); migrateBank(meta,p);
    return total(meta,p.money.bank.accounts.filter(a=>a.kind !== 'credit').map(a=>({amount:a.balance,currency:a.currency || p.money.currency})),bankDisplayCurrency(p),bankDate(p));
}
const missingSum = (p,sum) => sum.missing.map(x=>`<span>${esc(fmtIn(p,x.amount,x.currency))} · ${esc(x.currency)} 환산 대기</span>`).join('');
function displayTools(p) {
    const selected = bankDisplayCurrency(p), options = [...new Set([selected,...Object.values(LOCAL_CURRENCY),p.money.currency].filter(Boolean))];
    return `<div class="ax_fx_tools"><label>표시 통화<select class="bank_display">${options.map(c=>`<option value="${esc(c)}" ${c === selected ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label><label>환산 날짜<input type="date" class="bank_fxdate" value="${esc(bankDate(p))}"></label><button type="button" class="bank_fxrefresh">환율 확인</button></div>`;
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
const newestTx = p => [...(mo(p)?.tx || [])].sort((a, b) => String(b.time).localeCompare(String(a.time)));
export function bankHome(p, now) {
    const M = mo(p);
    if (!M) return emptyApp(p, now, '은행', 'money', '아직 계좌가 없어요. 채우면 은행 · 지갑 · 쇼핑이 함께 생겨요.');
    const sum = bankSum(p);
    return `<div class="ax_bk">
      <div class="ax_bkh">${axBar(p, now, '#fff')}
        <div class="ax_bkr"><button type="button" class="ax_bkc" data-go="home2" aria-label="뒤로">${ax('back', 18, '#fff', 2.3)}</button><span class="ax_bkhi"><small>${esc(M.bank.name)}</small><b>안녕하세요, ${esc(p.owner)}</b></span><span class="ax_bkc">${ax('bell', 18, '#fff')}</span></div>
        <div class="ax_bktot"><small>${sum.complete ? '예금 잔액 · ' + esc(bankDisplayCurrency(p)) + ' 기준' : '환산 가능한 소계 · 환산 미완료'}</small><b class="cg_num">${esc(fmtIn(p, sum.value, bankDisplayCurrency(p)))}</b>${missingSum(p,sum)}<span>계좌 ${M.bank.accounts.length}개 · 환산 기준 ${esc(bankDate(p) || '날짜 미확정')}</span></div>
        <div class="ax_bkacts"><span><b>${ax('send2', 20, '#fff', 2.2)}</b>송금</span><span><b>${ax('down2', 20, '#fff', 2.2)}</b>입금</span><span><b>${ax('swap', 20, '#fff', 2.2)}</b>이체</span><button type="button" data-go="wallet"><b>${ax('card', 20, '#fff')}</b>카드</button></div>
      </div>
      <div class="ax_bks"><div class="ax_scroll">
        ${displayTools(p)}<div class="ax_shd">내 계좌</div>
        <div class="ax_card">${M.bank.accounts.map((a, i) => `<button type="button" class="ax_acc" data-go="acct" data-i="${i}"><span class="ax_accic ${a.kind}">${ax(a.kind === 'savings' ? 'star' : 'card', 20, 'currentColor')}</span><span class="ax_tx"><b>${kindName[a.kind]}${a.name ? ` · ${esc(a.name)}` : ''}</b><small class="cg_num">•••• ${esc(a.last4)}</small></span><span class="ax_accv"><b class="cg_num">${esc(fmtMoney({ ...p, money: { currency: a.currency || M.currency } }, a.kind === 'credit' ? a.spent ?? a.balance : a.balance))}</b><small>${a.kind === 'credit' ? '이번 달 사용' : '사용 가능'}</small>${converted(p,a) ? `<small class="ax_fx_note">${converted(p,a,true)}</small>` : ''}</span></button>`).join('')}</div>
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
        <div class="ax_bktot ax_center"><small>${a.kind === 'credit' ? '이번 달 사용' : '사용 가능 잔액'}</small><b class="cg_num">${esc(fmtMoney({ ...p, money: { currency: a.currency || mo(p).currency } }, a.kind === 'credit' ? a.spent ?? a.balance : a.balance))}</b>${converted(p,a) ? `<span>${converted(p,a)}</span>` : ''}<span>${pendSum ? `대기 중 ${esc(fmtMoney({ ...p, money: { currency: a.currency || mo(p).currency } }, pendSum, true))}` : esc(a.name || '')}</span></div>
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

// ---- 지갑: the bank's cards on top, then the passes, stacked like a real wallet
const chip = '<span class="ax_ccchip"><i style="left: 0; right: 0; top: 11px; height: 1px"></i><i style="left: 0; right: 0; top: 21px; height: 1px"></i><i style="top: 0; bottom: 0; left: 15px; width: 1px"></i><i style="top: 0; bottom: 0; left: 29px; width: 1px"></i></span>';
const nfc = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"><path d="M8.5 8a6 6 0 0 1 0 8M12 5.5a10 10 0 0 1 0 13M15.5 3a14 14 0 0 1 0 18"/></svg>';
const DECO = {
    checking: '<svg class="ax_ccdeco" viewBox="0 0 358 226" preserveAspectRatio="none" aria-hidden="true"><path d="M0 128 C70 92 150 168 230 132 S330 96 358 112 V226 H0Z" fill="#fff" opacity=".07"/><path d="M0 170 C90 132 170 206 260 168 S340 150 358 160 V226 H0Z" fill="#fff" opacity=".07"/><circle cx="318" cy="18" r="86" fill="#fff" opacity=".05"/></svg>',
    credit: '<svg class="ax_ccdeco" viewBox="0 0 358 226" preserveAspectRatio="none" aria-hidden="true"><circle cx="300" cy="190" r="120" fill="#fff" opacity=".05"/><circle cx="340" cy="120" r="70" fill="#fff" opacity=".05"/><path d="M0 0 H150 C110 60 60 90 0 96Z" fill="#fff" opacity=".04"/></svg>',
};
const CC_BG = { checking: '#1d3461', credit: '#25272e', savings: '#2f5d50' };
function cardArt(p, c) {
    const a = acctOf(p, c.account), kind = a?.kind || 'checking', [b1, ...b2] = String(mo(p).bank.name).split(' ');
    return `<span class="ax_cc" style="background: ${CC_BG[kind]}">${DECO[kind] || DECO.checking}<span class="ax_cctop"><span class="ax_cclg"><b>${esc(b1)}</b> ${esc(b2.join(' '))}</span><span class="ax_cckd">${kind === 'credit' ? 'credit' : 'debit'}</span></span><span class="ax_ccmid">${chip}${nfc}</span><span class="ax_ccno cg_num">•••• •••• •••• ${esc(c.account)}</span><span class="ax_ccbot"><span><small>CARD HOLDER</small><b>${esc(String(p.owner).toUpperCase())}</b></span><span class="ax_r"><small>VALID THRU</small><b>${esc(c.exp || '—')}</b></span></span></span>`;
}
const PASS = { flight: ['#1f2f4d', 'plane', '탑승'], train: ['#8f3a32', 'train', '열차'], hotel: ['#efe3cf', 'bed', '체크인'], event: ['#4b3a6b', 'ticket', '입장'], other: ['#3d4a66', 'ticket', '시간'] };
const code = s => { const t = String(s || '').trim(); return /^[A-Z]{3}$/.test(t) ? t : t; };
function passArt(p, x, full) {
    const [bg, icon, lab] = PASS[x.kind] || PASS.other, cream = x.kind === 'hotel';
    const big = x.from && x.to && x.kind !== 'hotel' && x.kind !== 'event';
    const small = s => (String(s).length > 4 ? ' ax_pbsm' : '');
    return `<span class="ax_ps ${cream ? 'cream' : ''}" style="background: ${bg}">
      <span class="ax_psh"><span class="ax_pslg">${ax(icon, 16, 'currentColor')}</span><span class="ax_psn">${esc(String(x.by || '').toUpperCase())}</span><span class="ax_pshr">${lab}<b class="cg_num">${esc(x.time || fmtDate(p, x.date, true) || '—')}</b></span></span>
      ${big ? `<span class="ax_psrt"><span><b class="${small(x.from)}">${esc(code(x.from))}</b></span><span class="ax_pspl">${ax(x.kind === 'flight' ? 'plane' : 'chev', 24, 'currentColor', 1.6)}</span><span class="ax_r"><b class="${small(x.to)}">${esc(code(x.to))}</b></span></span>` : `<span class="ax_psrt"><span><b class="ax_pbsm">${esc(x.to || x.from || x.by)}</b></span></span>`}
      <span class="ax_psfl"><span><small>날짜</small><b>${esc(fmtDate(p, x.date, true) || '—')}</b></span><span><small>${x.kind === 'flight' ? '좌석' : x.kind === 'hotel' ? '예약' : '좌석'}</small><b>${esc(x.kind === 'hotel' ? (x.no || '—') : (x.seat || '—'))}</b></span><span class="ax_r"><small>${x.kind === 'flight' ? '게이트' : '번호'}</small><b>${esc(x.kind === 'flight' ? (x.gate || '—') : (x.no || '—'))}</b></span>
        <span><small>소유자</small><b>${esc(String(p.owner).toUpperCase())}</b></span><span><small>시간</small><b class="cg_num">${esc(x.time || '—')}</b></span><span class="ax_r"><small>${x.kind === 'flight' ? '편명' : '상태'}</small><b>${esc(x.kind === 'flight' ? (x.no || '—') : (x.status || '—'))}</b></span></span>
      ${full ? `<span class="ax_psperf"></span><span class="ax_psqr">${qr(x.id)}</span>` : ''}</span>`;
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
    const ps = [...M.passes].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return `${axBar(p, now)}
      ${axTop(axCb('home2'))}
      <div class="ax_scroll">
        ${axH1('지갑', `카드 ${M.cards.length} · 패스 ${ps.length}`)}
        ${M.cards.length ? `<div class="ax_wl ax_ccstack">${M.cards.map((c, i) => `<button type="button" class="ax_wlb" data-go="card" data-i="${i}">${cardArt(p, c)}</button>`).join('')}</div>` : ''}
        ${ps.length ? `<div class="ax_shd">패스<span>${ps.length}개</span></div><div class="ax_wl ax_psstack">${ps.map(x => `<button type="button" class="ax_wlb" data-go="pass" data-i="${x.id}">${passArt(p, x, false)}</button>`).join('')}</div>` : ''}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
export function cardView(p, now, i) {
    const c = mo(p)?.cards?.[Number(i)];
    if (!c) return walletScreen(p, now);
    migrateBank(getMeta(),p);
    const a = acctOf(p, c.account), ai = mo(p).bank.accounts.indexOf(a), credit = a?.kind === 'credit';
    const all = newestTx(p).filter(x => x.account === c.account && x.kind === 'card'), xs = all.slice(0,5);
    const pending = all.filter(x=>x.pending).length, cur = a?.currency || mo(p).currency;
    const amount = a ? credit ? a.spent ?? a.balance : a.balance : null;
    const conversion = a ? converted(p,a,true) : '';
    const payment = x => `<button type="button" class="cd_payment" data-go="tx" data-i="${esc(x.id)}">${fi(x.who,38,axTint(x.who),12)}<span class="cd_merchant"><b>${esc(x.who)}</b><small>${esc(fmtDate(p,x.time,true))}${x.pending ? ' · 승인 대기' : x.amount > 0 ? ' · 입금·환급 기록' : ' · 결제'}</small></span><span class="cd_payment_amount ${x.amount > 0 ? 'incoming' : ''}">${esc(txMoney(p,x,true))}${ax('chev',13)}</span></button>`;
    return `<div class="cd_app">${axBar(p,now)}
      <div class="cd_top"><button type="button" class="cd_back" data-go="wallet" aria-label="지갑으로 돌아가기">${ax('back',20)}</button><b>내 카드</b><span>${esc(mo(p).bank.name)}</span></div>
      <div class="ax_scroll cd_scroll">
        <div class="cd_card">${cardArt(p,c)}</div>
        <div class="cd_identity"><b>${esc(a?.name || mo(p).bank.name)}</b><span>${credit ? '신용카드' : '체크카드'} · ${esc(c.account)}</span></div>
        <section class="cd_summary"><div class="cd_summary_label"><span>${credit ? '이번 달 이용 금액' : '연결 계좌 잔액'}</span>${pending ? `<span class="cd_pending">승인 대기 ${pending}</span>` : ''}</div><strong class="cg_num">${esc(fmtIn(p,amount,cur))}</strong>
          ${conversion ? `<details class="cd_fx"><summary>${conversion}${ax('down',12)}</summary><p>${converted(p,a)}</p></details>` : ''}
          ${ai >= 0 ? `<button type="button" class="cd_account" data-go="acct" data-i="${ai}"><span>${ax('card',16)} ${credit ? '카드 이용 내역' : '연결 계좌 보기'}</span><span>•••• ${esc(a.last4)} ${ax('chev',14)}</span></button>` : ''}
        </section>
        <div class="cd_section"><h2>최근 결제</h2>${ai >= 0 ? `<button type="button" data-go="acct" data-i="${ai}">전체 보기 ${ax('chev',12)}</button>` : ''}</div>
        <div class="cd_payments">${xs.map(payment).join('') || `<div class="cd_empty">${ax('receipt',25)}<b>아직 결제 내역이 없어요</b><span>이 카드의 결제 기록이 여기에 표시돼요.</span></div>`}</div>
        <details class="cd_info"><summary>${ax('info',17)} 카드 정보<span>상세 보기 ${ax('down',13)}</span></summary><dl><div><dt>카드 소유자</dt><dd>${esc(p.owner)}</dd></div><div><dt>카드 번호</dt><dd>•••• •••• •••• ${esc(c.account)}</dd></div><div><dt>유효 기간</dt><dd>${esc(c.exp || '—')}</dd></div><div><dt>계좌 통화</dt><dd>${esc(cur)}</dd></div></dl></details>
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
const STEP = { ordered: 0, shipped: 1, 'on the way': 2, delivered: 3 };
const itemIc = x => (/buch|book|책|livre|libro/i.test(`${x.item} ${x.ko}`) ? 'book' : 'box');
function statusPill(p, x) {
    if (x.status === 'delivered') return `<span class="ax_pill2 ok">${ax('check', 12, 'currentColor', 2.8)} ${x.arrived ? `${esc(fmtDate(p, x.arrived, true))} 도착` : '배송 완료'}</span>`;
    if (x.status === 'unknown') return `<span class="ax_pill2 unk">${ax('info', 13, 'currentColor')} 배송 상태 모름</span>`;
    return `<span class="ax_pill2 go">${ax('truck', 13, 'currentColor')} ${x.eta ? `${esc(fmtDate(p, x.eta, true))} 도착 예정` : x.status === 'ordered' ? '주문 완료' : '배송 중'}</span>`;
}
const shopTab = () => `<div class="ax_btab">${[['homeS', '홈'], ['grid4', '카테고리'], ['receipt', '주문'], ['user', '내 정보']].map(([k, l]) => `<span class="${k === 'receipt' ? 'on' : ''}">${ax(k, 24, 'currentColor')}${l}</span>`).join('')}</div>`;
const prodImg = x => `<span class="ax_pimg">${ax(itemIc(x), 30, '#7d8796', 1.7)}${x.gift ? `<i>${ax('gift', 11, '#a2526b', 2.2)}</i>` : ''}</span>`;
export function shopScreen(p, now, f = 'all') {
    const M = mo(p);
    if (!M) return emptyApp(p, now, '쇼핑', 'money', '아직 주문이 없어요. 채우면 은행 · 지갑 · 쇼핑이 함께 생겨요.');
    const os = [...M.orders].sort((a, b) => String(b.time).localeCompare(String(a.time)));
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
          <div class="ax_ocb"><button type="button" data-go="order" data-i="${x.id}">주문 상세</button><button type="button" class="p" data-go="order" data-i="${x.id}">${x.status === 'delivered' ? '다시 보기' : '배송 조회'}</button></div></div>`).join('') || '<div class="ax_empty">주문이 없어요</div>'}
        <i class="ax_pad"></i>
      </div></div>
      ${shopTab()}</div>${axInd()}`;
}
export function orderView(p, now, id) {
    const x = mo(p)?.orders?.find(o => o.id === id);
    if (!x) return shopScreen(p, now);
    const st = STEP[x.status], tx = x.ev ? mo(p).tx.find(t => t.ev === x.ev) : null, ai = tx ? mo(p).bank.accounts.findIndex(a => a.last4 === tx.account) : -1;
    const head = x.status === 'delivered' ? ['배송 완료', x.arrived ? `${fmtDate(p, x.arrived)} 도착` : '도착했어요'] : x.status === 'unknown' ? ['배송 상태', '확인되지 않았어요'] : [x.status === 'ordered' ? '주문 완료' : '배송 중', x.eta ? `${fmtDate(p, x.eta)} 도착 예정` : '도착일 미정'];
    const total = x.price === null ? null : x.price * (x.qty || 1);
    return `<div class="ax_shopv">
      <div class="ax_sph ax_sphs">${axBar(p, now, '#fff')}
        <div class="ax_spr"><button type="button" class="ax_bkc" data-go="shop" aria-label="뒤로">${ax('back', 18, '#fff', 2.3)}</button><span class="ax_bkt">주문 상세</span><span class="ax_bkc">${ax('cart', 18, '#fff')}</span></div>
      </div>
      <div class="ax_sps ax_spso"><div class="ax_scroll">
        <div class="ax_dhero"><small>${esc(head[0])}</small><b>${esc(head[1])}</b><span>${esc(x.shop)}${x.gift ? ` · 선물로 ${esc(x.gift)}에게` : ''}</span>
          ${st === undefined ? '' : `<span class="ax_steps" style="--done: ${[0, 34, 67, 100][st]}%">${['주문', '발송', '배송 중', '도착'].map((l, k) => `<span class="${k < st || (k === st && st === 3) ? 'd' : k === st ? 'c' : ''}"><i>${k < st || (k === st && st === 3) ? ax('check', 11, '#fff', 3) : ''}</i>${l}</span>`).join('')}</span>`}</div>
        <div class="ax_card ax_oc"><div class="ax_ocr">${prodImg(x)}<span class="ax_tx"><small class="ax_ocsl">${esc(String(x.shop || '').toUpperCase())}</small><b>${esc(x.item)}</b>${x.ko && koOn() ? `<span class="ax_p">${esc(x.ko)}</span>` : ''}<span class="ax_ocpr cg_num">${esc(fmtMoney(p, x.price))}<small>${esc([x.option, `${x.qty || 1}개`].filter(Boolean).join(' · '))}</small></span></span></div></div>
        <div class="ax_sec">결제</div><div class="ax_card"><div class="ax_lr"><span>상품 금액</span><span class="cg_num">${esc(fmtMoney(p, total))}</span></div><div class="ax_lr"><span><b>총 결제</b></span><span class="cg_num"><b>${esc(fmtMoney(p, total))}</b></span></div>
          ${tx ? `<button type="button" class="ax_more" data-go="tx" data-i="${tx.id}">${ai >= 0 ? `${kindName[mo(p).bank.accounts[ai].kind]} •••• ${esc(tx.account)} · ` : ''}은행에서 보기 ${ax('chev', 14, 'currentColor', 2.4)}</button>` : ''}</div>
        <div class="ax_sec">주문 정보</div><div class="ax_card"><div class="ax_lr"><span>주문일</span><span class="cg_num">${esc(fmtDate(p, x.time))}</span></div>${x.gift ? `<div class="ax_lr"><span>받는 사람</span><span>${esc(x.gift)}</span></div>` : ''}</div>
        ${relatedRows(p, x.ev, `order:${x.id}`)}
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
    const vs = (p.voice || []).map((x, k) => [x, k]).sort((a, b) => String(b[0].time).localeCompare(String(a[0].time)));
    const rec = recording.has(nameKey(p.owner));
    if (!vs.length && !p.voiceAt) return `${emptyApp(p, now, '음성 메모', 'voice', '아직 녹음이 없어요. 채우면 지난 순간들의 메모가 생겨요.').replace(`${axInd()}`, '')}${recBtn(rec)}${axInd()}`;
    return `${axBar(p, now)}
      ${axTop(axCb('home2'), axKp(p))}
      <div class="ax_scroll">
        ${axH1('음성 메모', vs.length ? `${vs.length}개` : '')}
        ${axFind()}
        <div class="ax_card ax_vm">${vs.map(([x, k]) => x.id === open ? `
          <div class="ax_rw ax_vmo"><button type="button" class="ax_vmh" data-go="voice" data-i=""><span class="ax_vmt"><b>${esc(x.title || '새로운 녹음')}</b><span class="cg_num">${secs(x.sec)}</span></span><span class="ax_vms"><span>${esc(fmtDate(p, x.time, true))} ${esc(fmtTime(p, x.time))}</span><span>${esc(x.place || '')}</span></span></button>
            ${player(x, 64)}<button type="button" class="ax_vmmore" data-go="voiceone" data-i="${k}">글로 옮긴 내용 ›</button></div>` : `
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
