// Shared, private generation budget. Refreshed only by an explicit financial rebuild.
import { askDraft } from './ai.js';
import { saveMeta } from './core.js';
import { currency, finite, fx, price, positions, cash, addPrice, finance, quoteKey } from './finance.js';

export const WEALTH_SYS = `GOAL
Set a compact personal financial scale for this fictional phone owner before bank and investment generation.

YOU GET
Story, selected owner profile, country and account currencies. Old generated balances are not evidence of wealth.

RULES
- Infer the order of magnitude first from personal ownership, business reach, accumulated wealth, access and lifestyle; a job title alone is not ownership. Financial assets may be very large when supported. Do not default every owner to a retail savings portfolio.
- Set separate ranges for current bank deposits and ordinary investments INCLUDING brokerage cash. Exclude credit-card spending, company assets and family stakes; do not count them twice. Their exclusion does not imply small personal reserves.
- Explicit current personal amounts win; exact totals use min=max. Otherwise estimate plausible app-only ranges, not new RP facts. Explain evidence and inference briefly, including ownership/access uncertainty. Convert ranges to one currency; no prose analysis.

ANSWER — one JSON object, nothing else:
{"currency":"EUR","deposits":{"min":number,"max":number},"investments":{"min":number,"max":number},"basis":"short evidence and inferred scale"}`;
export function readWealth(out) {
    const s=String(out).replace(/```(?:json)?/gi,'');
    const x=JSON.parse(s.slice(s.indexOf('{'),s.lastIndexOf('}')+1));
    if (!currency(x.currency) || !['deposits','investments'].every(k=>finite(x[k]?.min)&&finite(x[k]?.max)&&x[k].min>=0&&x[k].max>=x[k].min) || !String(x.basis || '').trim()) throw new Error('재력 기준을 받지 못했어요');
    return {currency:x.currency,deposits:{min:x.deposits.min,max:x.deposits.max},investments:{min:x.investments.min,max:x.investments.max},basis:String(x.basis).slice(0,1200)};
}
const pending=new WeakMap();
export async function ensureWealth(m,p,request,{refresh=false}={}) {
    if (pending.has(p)) return pending.get(p);
    if (!refresh && p.wealthPlan) return p.wealthPlan;
    const snapshot=JSON.stringify([p.owner,p.financeProfile,m.text]);
    const run=(async()=>{
        const plan=readWealth(await askDraft(await request(),{system:WEALTH_SYS,maxTokens:1400}));
        if (JSON.stringify([p.owner,p.financeProfile,m.text])!==snapshot || m.phones && !Object.values(m.phones).includes(p)) throw new Error('판단 중 인물 정보가 변경됐어요. 다시 시도해 주세요');
        p.wealthPlan={...plan,at:Date.now()};await saveMeta();return p.wealthPlan;
    })();
    pending.set(p,run);
    try { return await run; } finally { pending.delete(p); }
}
export const wealthBlock = (plan,kind) => `[FINANCIAL SCALE]\n${JSON.stringify({currency:plan.currency,target:plan[kind],basis:plan.basis})}\nMeet this current ${kind} range. Use evidence-backed amounts first. This is a generation budget, not a bank transfer. Return required FX for the evaluation date; do not change existing quotes. Adjust quantities/cash, not public prices, to meet the investment range.`;
export function wealthDate(m,p) {
    const date=p.money?.fxDate || p.investment?.date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return date;
    const full=[...String(m.text || '').matchAll(/\b(\d{4})[-/]\d{2}[-/]\d{2}\b/g)].at(-1)?.[0]?.replaceAll('/','-');
    const year=full?.slice(0,4) || [...String(m.text || '').matchAll(/\b(20\d{2}|19\d{2})\b/g)].at(-1)?.[1];
    return year && /^\d{2}-\d{2}/.test(p.now || '') ? `${year}-${p.now.slice(0,5)}` : full || '';
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
