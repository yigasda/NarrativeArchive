// 폰 2(실시간)의 은행 · 지갑 · 쇼핑 채우기. phonedata.js의 fillMoney · makeMoney를 줄 그대로 옮긴 것이고, 다른 곳은 이것뿐이에요.
//   읽는 범위 · 읽은 자리 · 요청 뼈대 · 두 번째 차례: 실시간 것 (phone2req.js). 롤플은 시작한 곳까지만, 읽은 자리는 메신저 번호
//   폰의 지금: 폰에 저장된 시각. OWNER'S CLOCK: 롤플 상태창 · 롤플 메시지 없이
//   자산 준비: 실시간 것 (phone2fill.js)
// 폰 1 파일은 여기서 읽기만 해요.
import { wealthBlock, wealthDate, wealthCheck, addWealthFX } from './wealth.js';
import { migrateBank, finance, finite, cash, reviseBaseline } from './finance.js';
import { ctx, saveMeta } from './core.js';
import { phoneChatScope } from './phonestory.js';
import { jsonOf, last4, num } from './phoneparse.js';
import { payOrders } from './phonesyncmoney.js';
import { exclusive, syncOf } from './phonesync.js';
import { askDraft, markNow, nowAt, AI_SYS_MONEY, MONEY_REBUILD, moneyContext, moneyMore, aroundBlock, parseMoney, homeCountry, ensureIds, soFarHead, turnsNote, readNote } from './phonedata.js';
import { liveSideRequest, liveWindowOf, liveReadMark, liveSecondTurn, liveSavedNow, liveFillClock, needLive } from './phone2req.js';
import { livePrepareWealth } from './phone2fill.js';

export const liveFillMoney = (m, p, opts = {}) => exclusive('fill', () => liveMakeMoney(m, p, opts));
async function liveMakeMoney(m, p, { regenerateBalances = false, wealthPlan = null } = {}) {
    needLive(m);
    const mark0 = markNow();
    let mark = mark0;
    // what it reads after the archive; its day is the story's where that stops (now, when it reads to the end), not
    // the phone's now from when it was made
    const read = { gap: liveWindowOf(m, p) }, at = liveSavedNow(p) || p.now;
    migrateBank(m, p);
    const old = p.money, rebuild = !!old && regenerateBalances;
    const plan = wealthPlan || await livePrepareWealth(m,p,regenerateBalances);
    const date = wealthDate(m,p,at);
    const accountState = () => JSON.stringify([p.money,p.financeProfile,finance(m)]);
    const before = accountState();
    const preserved = rebuild ? `[REBUILD ACCOUNTS]\n${JSON.stringify(old.bank.accounts.map(({id,kind,name,last4,currency})=>({id,kind,name,last4,currency})))}\n[MONEY ALREADY MOVED]\n${JSON.stringify(old.bank.accounts.map(a=>({id:a.id,currency:a.currency,entries:finance(m).accounts[`${a.id}:${a.currency}`]?.entries || {}})))}` : old ? `[EXISTING ACCOUNTS]\n${JSON.stringify(old.bank.accounts)}` : '';
    const system = AI_SYS_MONEY + (rebuild ? MONEY_REBUILD : '');
    const rates = () => `[SAVED RATES]\n${JSON.stringify(Object.fromEntries(Object.entries(finance(m).prices).filter(([k])=>k.startsWith('FX:')).map(([k,book])=>[k,book[date]])))}`;
    const input = await liveSideRequest(m,p.owner,[`[PHONE NOW]\n${moneyContext(p, at)}`,liveFillClock(m, p, at),aroundBlock(p),preserved,wealthBlock(plan,'deposits'),`[EVALUATION DATE]\n${date}`,rates()],{profile:p.financeProfile,money:true,read});
    mark = liveReadMark(read.gap) || mark;
    let correction='';
    for(let attempt=0;attempt<2;attempt++) {
        const out = await askDraft(input+'\n'+correction,{force:true,system,maxTokens:12000});
        const raw = jsonOf(out), next = parseMoney(raw, homeCountry(p));
        if (p.money !== old || accountState() !== before) throw new Error('생성 중 계좌가 변경됐어요. 다시 시도해 주세요');
        if (old) {
            if (rebuild) {
                const rows = raw?.bank?.accounts;
                if (!Array.isArray(rows) || rows.length !== old.bank.accounts.length || old.bank.accounts.some(a => {
                    const matches = rows.filter(b=>b.id === a.id);
                    return matches.length !== 1 || String(matches[0].currency || '').toUpperCase() !== a.currency || matches[0].kind !== a.kind || last4(matches[0].last4) !== a.last4 || a.kind!=='credit' && (!finite(num(matches[0].balance)) || num(matches[0].balance) < 0);
                })) throw new Error('새 계좌 잔액을 확인하지 못했어요. 기존 잔액은 유지돼요');
                if (['cards','tx','passes','orders'].some(k=>!Array.isArray(raw[k])) || next.tx.some(t=>!old.bank.accounts.some(a=>a.last4===t.account))) throw new Error('새 거래 내역을 확인하지 못했어요. 기존 데이터는 유지돼요');
                next.bank.accounts = old.bank.accounts.map(a => {
                    const b = rows.find(b=>b.id === a.id);
                    return {...a,name:next.bank.accounts.find(b=>b.id === a.id)?.name || a.name,balance:a.kind==='credit'?0:num(b.balance)};
                });
            } else next.bank.accounts = old.bank.accounts.map(a => ({ ...a, name: next.bank.accounts.find(b => b.id === a.id)?.name || a.name }));
            next.currency = old.currency;
            next.displayCurrency = old.displayCurrency;
            next.fxDate = old.fxDate;
            if (!rebuild) next.tx = old.tx;
            next.asOf = old.asOf;
            if (!rebuild) next.basis = old.basis || next.basis;
        }
        // Stage the whole result: malformed responses cannot partially rewrite a baseline.
        const staged = {finance:structuredClone(finance(m))};
        if (rebuild) for (const a of next.bank.accounts) {
            if (a.kind === 'credit') continue;
            const key = `${a.id}:${a.currency}`, ledger = staged.finance.accounts[key];
            if (ledger) {
                // The new amount is current cash. Retain all ledger entries and offset them once.
                const net = cash(ledger) - ledger.amount;
                reviseBaseline(staged,key,a.balance - net,'계좌 새로 만들기');
            }
        }
        const updated = {...p,money:{...next,at:Date.now()}};
        ensureIds(updated);
        if (rebuild) {
            const oldIds = new Set((old.tx || []).map(t=>t.id));
            for (const a of next.bank.accounts) {
                const ledger = staged.finance.accounts[`${a.id}:${a.currency}`];
                if (!ledger || a.kind === 'credit') continue;
                ledger.included = ledger.included.filter(id=>!oldIds.has(id) || staged.finance.transfers[id]);
                ledger.included = [...new Set([...ledger.included,...updated.money.tx.filter(t=>t.account===a.last4).map(t=>t.id)])];
            }
        }
        migrateBank(staged,updated);
        if (!old || rebuild) {
            addWealthFX(staged,raw.fx,date);
            correction=wealthCheck(staged,plan,'deposits',updated.money.bank.accounts.filter(a=>a.kind!=='credit').map(a=>({currency:a.currency,amount:a.balance})),date);
            if(correction) {if(attempt===0) {correction += '\n[PREVIOUS CANDIDATE]\n'+JSON.stringify(raw);continue;}throw new Error('예금 규모를 재력 기준에 맞추지 못했어요. 기존 금융 데이터는 유지돼요');}
        }
        p.money = updated.money; m.finance = staged.finance;
        // stopped short of the phone's clock: a second turn adds the history the rest of the story has (cards, payments,
        // passes, orders); the accounts and their balances stay the first's. One that fails keeps the first
        const two = liveSecondTurn(m, p, read.gap);
        let last = read.gap, short = null;
        if (two) {
            try {
                const at2 = liveSavedNow(p) || p.now, tx = !old || rebuild, soFar = { cards: raw.cards, ...(tx ? { tx: raw.tx } : {}), passes: raw.passes, orders: raw.orders };
                const only = `The bank, its accounts and their balances stay as they are: leave "bank" and "fx" out${tx ? '' : ', and "tx" too (the bank keeps its own)'}`;
                const input2 = await liveSideRequest(m, p.owner, [`[PHONE NOW]\n${moneyContext(p, at2)}`, liveFillClock(m, p, at2), aroundBlock(p), `[EXISTING ACCOUNTS]\n${JSON.stringify(p.money.bank.accounts)}`, `[EVALUATION DATE]\n${date}`, rates(),
                    `${soFarHead('MONEY', two.short, only)}\n${JSON.stringify(soFar)}`, two.short?.text || ''], { profile: p.financeProfile, money: true, read: { gap: two.cover } });
                const out2 = String(await askDraft(input2, { force: true, system: AI_SYS_MONEY, maxTokens: 12000 }) ?? ''), raw2 = jsonOf(out2);
                // an answer that isn't the JSON, or one cut off before its end: what it read isn't all there, so the mark
                // stays where the first turn stopped
                // (a line after the JSON is fine: it is the JSON itself that must be whole)
                const b2 = out2.lastIndexOf('}'), closed = (() => { try { JSON.parse(out2.slice(out2.indexOf('{'), b2 + 1)); return true; } catch { return false; } })();
                if (!raw2 || typeof raw2 !== 'object' || !closed) throw new Error('모델 답에서 은행 내용(JSON)을 끝까지 찾지 못했어요');
                if (p.money !== updated.money) throw new Error('생성 중 계좌가 변경됐어요');
                moneyMore(m, p, parseMoney({ ...raw2, currency: p.money.currency, bank: p.money.bank }, homeCountry(p)), tx);
                last = two.cover; short = two.short;
            } catch (err) { console.warn('[narrative-archive] money, second turn', err); }
        }
        mark = liveReadMark(last) || mark0;
        // the delivery app's orders are paid from the bank now there is one
        payOrders(m, p, String(date || p.money.asOf || '').slice(0, 4) || String(new Date().getFullYear()));
        syncOf(p, phoneChatScope(ctx())).marks.money = mark;
        await saveMeta();
        if (two) turnsNote(last, '은행', short); else readNote(read.gap);
        return p.money;
    }
}
