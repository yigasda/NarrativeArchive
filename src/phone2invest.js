// 폰 2(실시간)의 투자 앱 요청: 기록 · 노트 모으기, 차트 시세, 은행 환율. investdata.js의 같은 함수를 줄 그대로 옮긴 것이고,
// 다른 곳은 요청을 만드는 뼈대뿐이에요(sideRequest → liveSideRequest. phone2req.js). 폰 1 파일은 여기서 읽기만 해요.
import { saveMeta } from './core.js';
import { currency, finance, quoteKey } from './finance.js';
import { askDraft } from './phonedata.js';
import { json, list, CHART_SYS, MARKET_SYS, INVEST_NOTES_SYS, INVEST_RECORDS_SYS, investmentTargets, parseInvestmentRecords, mergeInvestmentRecords, chartDates, ingestQuotes, validDate } from './investdata.js';
import { liveSideRequest, needLive } from './phone2req.js';

export async function liveCollectInvestmentRecords(m, p, mode = 'records', target = '') {
    needLive(m);
    const inv = p.investment;
    if (!inv || !['notes','records'].includes(mode)) throw new Error('투자 계좌를 먼저 만들어 주세요');
    if (mode === 'notes' && !investmentTargets(inv).some(t => t.key === target)) throw new Error('노트를 쓸 종목이나 지분을 찾지 못했어요');
    // Capture sources BEFORE appending generated targets. Prior app text cannot serve as evidence for itself.
    const source = await liveSideRequest(m,p.owner,[], {profile:mode === 'notes' ? p.financeProfile : undefined});
    const targets = investmentTargets(inv).filter(t => mode !== 'notes' || t.key === target);
    const appContext = mode === 'notes' && target.startsWith('stock:') ? { trades: inv.trades.filter(t => `stock:${t.symbol}` === target).slice(-8), watch: inv.watch.filter(w => `stock:${w.symbol}` === target) } : null;
    const input = `${source}\n\n[AS OF]\n${inv.date}\n[TARGETS — identification only]\n${JSON.stringify(targets)}${mode === 'records' ? `\n[EXISTING SCHEDULES — app data, not evidence]\n${JSON.stringify(inv.schedules || [])}` : ''}${appContext ? `\n[APP CONTEXT — imagination, not evidence]\n${JSON.stringify(appContext)}` : ''}`;
    const raw = json(await askDraft(input,{force:true,system:mode === 'notes' ? INVEST_NOTES_SYS : INVEST_RECORDS_SYS,maxTokens:mode === 'notes' ? 2000 : 6500}));
    const got = parseInvestmentRecords(raw,inv,source,mode,target);
    if (mode === 'notes' && !got.notes.length) throw new Error('사용할 수 있는 투자 노트를 받지 못했어요');
    mergeInvestmentRecords(inv,got);
    inv.at=Date.now();
    if (mode === 'records') inv.recordsChecked = inv.date;
    await saveMeta();
    return got;
}
export async function liveFillChartHistory(m,p,symbol,range='1m') {
    needLive(m);
    const inv=p.investment, dates=chartDates(m,inv,symbol,range), key=`STOCK:${symbol}`, date=inv.date;
    const book=finance(m).prices[key] || {}, missing=dates.filter(d=>!book[d]?.rows?.length);
    if (!missing.length) return 0;
    const source=await liveSideRequest(m,p.owner,[]);
    const input=`${source}\n[SECURITY]\n${JSON.stringify(inv.securities.find(s=>s.symbol === symbol))}\n[REQUESTED DATES]\n${JSON.stringify(missing)}\n[EXISTING QUOTES — fixed anchors]\n${JSON.stringify(book)}`;
    const raw=json(await askDraft(input,{force:true,system:CHART_SYS,maxTokens:5000}));
    if(p.investment !== inv || inv.date !== date) throw new Error('시세 날짜가 변경됐어요. 다시 시도해 주세요');
    const wanted=new Set(missing);
    const rows=list(raw.quotes).filter(x=>x.symbol === symbol && wanted.has(x.date) && !finance(m).prices[key]?.[x.date]?.rows?.length);
    const staged={finance:structuredClone(finance(m))};
    // Evidence is checked against the source alone; generated anchors cannot cite themselves.
    ingestQuotes(staged,{quotes:rows},source,date,inv.securities);
    const added=missing.filter(d=>!finance(m).prices[key]?.[d]?.rows?.length && staged.finance.prices[key]?.[d]?.rows?.length).length;
    if(!added) throw new Error('추가할 시세를 받지 못했어요. 다시 시도해 주세요');
    m.finance=staged.finance;await saveMeta();return added;
}
export async function liveRefreshBankFX(m,p,date,base) {
    needLive(m);
    if (!p.money || !validDate(date) || !currency(base)) throw new Error('환산 날짜와 표시 통화를 확인해 주세요');
    const currencies = [...new Set(p.money.bank.accounts.map(a=>a.currency || p.money.currency))].filter(c=>currency(c) && c !== base);
    const keys = currencies.map(c=>quoteKey(`FX:${c}/${base}`));
    if (!keys.length) return;
    const quotes = Object.fromEntries(keys.map(k=>[k,finance(m).prices[k] || {}]));
    const input = await liveSideRequest(m,p.owner,[`[DATE]\n${date}`, '[PUBLIC SECURITIES]\n[]',`[EXISTING QUOTES]\n${JSON.stringify(quotes)}`,`[FX PAIRS]\n${currencies.map(c=>`${c}/${base}`).join(', ')}`]);
    const raw = json(await askDraft(input,{force:true,system:MARKET_SYS,maxTokens:3000}));
    // Only requested FX pairs on the selected day can be updated by this request.
    const allowed = new Set(keys);
    const rows = list(raw.fx).filter(x=>x.date === date && allowed.has(quoteKey(`FX:${x.from}/${x.to}`)));
    ingestQuotes(m,{fx:rows},input,date,[]);
    await saveMeta();
}
