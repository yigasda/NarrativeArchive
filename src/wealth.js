// Shared, private generation budget. Refreshed only by an explicit financial rebuild.
import { askDraft as askDraftAny } from './ai.js';
// (gives up after 5 minutes, like the phone's other requests)
const askDraft = (input, o = {}) => askDraftAny(input, { timeout: 300000, ...o });
import { num, parseJson, yearIn } from './phoneparse.js';
import { saveMeta } from './core.js';
import { currency, finite, fx, price, positions, cash, addPrice, finance, quoteKey } from './finance.js';

export const WEALTH_SYS = `GOAL
Decide how much money this fictional phone owner has in their own bank accounts and investments, before the bank and investment apps are written.

YOU GET
- ARCHIVE, RECENT CHAT, OWNER, and sometimes STORY YEAR, WORLD, LOREBOOK, PERSONA, OWNER PROFILE and OWNER DOESN'T KNOW. Nothing on the phone may show what the owner doesn't know.
- OWNER COUNTRY: where the owner lives.
- ACCOUNT CURRENCIES: the currencies of the owner's bank accounts so far (sometimes empty).

BASIS FIRST
Write basis before the numbers: who the owner is (work, level, years in it, where and how they live), where their money comes from (pay, a business they own, family money, an inheritance), and any amount the story gives.

SCALE
- deposits: the money in the owner's own bank accounts now. investments: the owner's own shares, funds and bonds, with the cash in their brokerage accounts.
- Not counted: homes and other property, company accounts, family holdings the owner doesn't control, credit-card spending.
- Counted: money the family gives the owner (an allowance, trust payouts, gifts, an inheritance received). It is the owner's own.
- Judge the amounts a real person in that country and role would hold after their years of income, in their way of life. A high earner or a rich family's child holds a lot; an ordinary worker holds an ordinary amount.
- Examples (deposits / investments):
  - a junior office worker in Seoul, three years in: 10–30 million KRW / 0–20 million KRW
  - a senior doctor in Oslo, fifteen years in, living in Frogner: 1.5–3 million NOK / 2–5 million NOK
  - the heir of a global conglomerate, living on family money: 2–10 billion KRW / 5–30 billion KRW
- An amount the story states wins; an exact total gives min = max.
- Balances an earlier phone showed are not evidence.
- Each range: max at most three times min. Both ranges in one currency, the owner's main account currency.

JSON (one object, nothing before or after it)
{"basis":"short evidence and the scale it gives","currency":"NOK","deposits":{"min":number,"max":number},"investments":{"min":number,"max":number}}
Numbers are plain JSON numbers.`;
export function readWealth(out) {
    const s=String(out).replace(/```(?:json)?/gi,'');
    const x=parseJson(s.slice(s.indexOf('{'),s.lastIndexOf('}')+1));
    // "50,000" or "eur" as the model may write them
    if (typeof x?.currency === 'string') x.currency = x.currency.trim().toUpperCase();
    for (const k of ['deposits','investments']) for (const e of ['min','max']) if (x?.[k] && typeof x[k][e] === 'string' && num(x[k][e]) !== null) x[k][e] = num(x[k][e]);
    if (!currency(x.currency) || !['deposits','investments'].every(k=>finite(x[k]?.min)&&finite(x[k]?.max)&&x[k].min>=0&&x[k].max>=x[k].min) || !String(x.basis || '').trim()) throw new Error('재력 기준을 받지 못했어요');
    return {currency:x.currency,deposits:{min:x.deposits.min,max:x.deposits.max},investments:{min:x.investments.min,max:x.investments.max},basis:String(x.basis).slice(0,1200)};
}
const pending=new WeakMap();
export async function ensureWealth(m,p,request,{refresh=false}={}) {
    if (pending.has(p)) return pending.get(p);
    if (!refresh && p.wealthPlan) return p.wealthPlan;
    const snapshot=JSON.stringify([p.owner,p.financeProfile,m.text]);
    const run=(async()=>{
        const plan=readWealth(await askDraft(await request(),{force:true,system:WEALTH_SYS,maxTokens:1400}));
        if (JSON.stringify([p.owner,p.financeProfile,m.text])!==snapshot || m.phones && !Object.values(m.phones).includes(p)) throw new Error('판단 중 인물 정보가 변경됐어요. 다시 시도해 주세요');
        p.wealthPlan={...plan,at:Date.now()};await saveMeta();return p.wealthPlan;
    })();
    pending.set(p,run);
    try { return await run; } finally { pending.delete(p); }
}
export const wealthBlock = (plan,kind) => `[FINANCIAL SCALE]\n${JSON.stringify({currency:plan.currency,target:plan[kind],basis:plan.basis})}\nMeet this current ${kind} range. Use evidence-backed amounts first. This is a generation budget, not a bank transfer. Return required FX for the evaluation date; do not change existing quotes. Adjust quantities/cash, not public prices, to meet the investment range.`;
// now: the story's moment the request stands at (default the phone's now)
export function wealthDate(m,p,now=p?.now) {
    const date=p.money?.fxDate || p.investment?.date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return date;
    // (the phone's year: set when it was made, from a status line or the reading of the story, or by the user; never a
    // guess from the dates the archive writes)
    const year=p.noYear ? '' : p.year ? String(p.year) : '';
    // (a story with no year of its own, by the user's choice: its money is valued at the rates of the day it was first valued,
    // that day kept on the bank, so tomorrow's look finds the same rates)
    if (p.noYear) { const d=new Date().toISOString().slice(0,10); if (p.money) p.money.fxDate=d; return d; }
    return year && /^\d{2}-\d{2}/.test(now || '') ? `${year}-${now.slice(0,5)}` : '';
}
export function addWealthFX(m,rows,date) {
    for(const x of (Array.isArray(rows)?rows:[]).slice(0,30)) {
        if(!currency(x.from)||!currency(x.to)||x.from===x.to||!finite(x.value)||x.value<=0||x.date!==date||!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const key=`FX:${x.from}/${x.to}`;
        if(finance(m).prices[quoteKey(key)]?.[date]?.rows.length) continue;
        addPrice(m,key,date,{value:x.value,source:'guess'});
    }
}
export function wealthCheck(m,plan,kind,rows,date) {
    let total=0;const missing=[];
    for(const row of rows) {
        if(!finite(row.amount)) { missing.push(row.label || row.currency);continue; }
        if(row.amount===0) continue;
        const rate=fx(m,row.currency,plan.currency,date);
        if(rate===null) missing.push(`FX:${row.currency}/${plan.currency} ${date}`);
        else total+=row.amount*rate;
    }
    const target=plan[kind];
    if(!missing.length&&finite(total)&&total>=target.min-0.01&&total<=target.max+0.01) return '';
    return `[SCALE CORRECTION]\n${JSON.stringify({kind,currency:plan.currency,target,computedTotal:total,missing})}\nReturn the complete corrected app JSON. Fix only the scale/valuation problem; retain explicit facts and account/transfer constraints. Supply missing quotes/FX. Do not invent company ownership or alter fixed public prices.`;
}
export function investmentWealthRows(m,accounts,trades,securities,date) {
    const rows=accounts.map(a=>({currency:a.currency,amount:cash(finance(m).accounts[a.key])}));
    for(const h of positions(trades)) {
        if(h.quantity<=0) continue;
        const s=securities.find(s=>s.symbol===h.symbol),q=price(m,`STOCK:${h.symbol}`,date);
        rows.push({currency:s?.currency,amount:q ? h.quantity*q.value : null,label:`STOCK:${h.symbol}`});
    }
    return rows;
}
