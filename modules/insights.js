import { state } from './state.js';
import { $, esc, emptyState, fmt } from './utils.js';
import { MS } from './constants.js';
import { ACCOUNT_GROUPS } from './constants.js';
import { taxYearStart, inTaxYear, getPD, movedReason } from './payday.js';
import { cTax } from './tax.js';
import { fdl } from './utils.js';
import { addInboxItem } from './inbox.js';

function subsGroupAccounts() { const g=ACCOUNT_GROUPS.find(x=>x[0]==='Subscriptions'); return g?g[1]:[]; }
function monthGroupTotal(h,accts) { let s=0; (h.pots||[]).forEach(p=>{if(accts.includes(p.account))s+=(parseFloat(p.amount)||0);}); return s; }
function monthSavings(h) {
  let s=0; (h.pots||[]).forEach(p=>{const n=(p.name||'').toLowerCase(),a=p.account||'';if(['Emergency Fund','Holiday Savings','House Deposit','Car Savings','General Savings','Stocks & Shares ISA','Cash ISA','Pension Top-Up','Christmas Fund'].includes(a)||n.includes('saving'))s+=(parseFloat(p.amount)||0);}); return s;
}

export function generateInsights() {
  const out = [];
  if (state.financeHistory.length < 2) return out;
  const sorted = state.financeHistory.slice().sort((a,b)=>new Date(a.year,a.month)-new Date(b.year,b.month));
  const newest=sorted[sorted.length-1], oldest=sorted[0];
  const subs=subsGroupAccounts(), subOld=monthGroupTotal(oldest,subs), subNew=monthGroupTotal(newest,subs), subDiff=subNew-subOld;
  if(subDiff>10) out.push({icon:'ti-trending-up',title:'Subscription creep',body:`Your subscriptions are up ${fmt(subDiff)} since ${MS[oldest.month]} ${oldest.year} (now ${fmt(subNew)}).`,type:'warning',key:'subs_creep'});
  else if(subDiff<0) out.push({icon:'ti-trending-down',title:'Subscriptions trimmed',body:`You've cut ${fmt(Math.abs(subDiff))} from subscriptions since ${MS[oldest.month]} ${oldest.year}. Nice.`,type:'positive',key:'subs_down'});
  const start=taxYearStart(new Date()), tyMonths=state.financeHistory.filter(h=>inTaxYear(h,start));
  let totMiles=0,totMileageVal=0; tyMonths.forEach(h=>{if(h.togMileage)totMiles+=(h.miles||0);totMileageVal+=(h.mileage||0);});
  if(totMiles>0) out.push({icon:'ti-car',title:'Mileage this tax year',body:`You've claimed ${totMiles.toLocaleString('en-GB')} miles, worth ${fmt(totMileageVal)} tax-free.`,type:'info',key:'mileage_'+start.getFullYear()});
  if(sorted.length>=3){const last3=sorted.slice(-3),srates=last3.map(h=>{const sv=monthSavings(h),th=h.takeHome||0;return th>0?(sv/th*100):0;});
    if(srates[0]>srates[1]&&srates[1]>srates[2]) out.push({icon:'ti-trending-down',title:'Savings rate is slipping',body:`Your savings rate has fallen three months running, now ${srates[2].toFixed(1)}%.`,type:'warning',key:'savings_down'});
    else if(srates[0]<srates[1]&&srates[1]<srates[2]) out.push({icon:'ti-trending-up',title:'Savings rate is climbing',body:`Three months of rising savings, now ${srates[2].toFixed(1)}%. Keep it up.`,type:'positive',key:'savings_up'});
  }
  if(sorted.length>=3){const f3=sorted.slice(-3).map(h=>h.freeMoney||0);
    if(f3[0]>f3[1]&&f3[1]>f3[2]) out.push({icon:'ti-arrow-down-right',title:'Free money is shrinking',body:`Your free money has dropped three months in a row, now ${f3[2]<0?'−':''}${fmt(f3[2])}.`,type:'warning',key:'free_down'});
    else if(f3[0]<f3[1]&&f3[1]<f3[2]) out.push({icon:'ti-arrow-up-right',title:'Free money is growing',body:`Free money has risen three months in a row, now ${fmt(f3[2])}.`,type:'positive',key:'free_up'});
  }
  if(newest.pots&&newest.pots.length){const big=newest.pots.slice().sort((a,b)=>(b.amount||0)-(a.amount||0))[0];if(big&&big.amount>0)out.push({icon:'ti-receipt',title:'Biggest outgoing this month',body:`${big.name} was your largest pot at ${fmt(big.amount)}.`,type:'info',key:'biggest_'+newest.year+'_'+newest.month});}
  const over=(newest.pots||[]).filter(p=>(p.target||0)>0&&p.amount>p.target);
  if(over.length) out.push({icon:'ti-alert-triangle',title:`${over.length} pot${over.length===1?'':'s'} over budget`,body:over.map(p=>p.name).join(', ')+' exceeded target this month.',type:'alert',key:'budget_'+newest.year+'_'+newest.month});
  let totTax=0; tyMonths.forEach(h=>totTax+=cTax(h.salary||0)/12);
  const milestones=[10000,5000,2000,1000];
  let shown=[]; try{shown=JSON.parse(localStorage.getItem('tax_milestones_'+start.getFullYear())||'[]');}catch(e){}
  for(const ms of milestones){if(totTax>=ms){out.push({icon:'ti-flag',title:'Tax milestone reached',body:`You've paid over ${fmt(ms)} in income tax this tax year (${fmt(totTax)} so far).`,type:'info',key:'tax_'+start.getFullYear()+'_'+ms});if(!shown.includes(ms)){shown.push(ms);localStorage.setItem('tax_milestones_'+start.getFullYear(),JSON.stringify(shown));}break;}}
  const now=new Date(), pr=getPD(now.getFullYear(),now.getMonth());
  if(pr.moved) out.push({icon:'ti-calendar-event',title:'Payday moved this month',body:movedReason(pr.original)+'. You\'ll be paid '+fdl(pr.payDate)+' instead.',type:'info',key:'payday_moved_'+now.getFullYear()+'_'+now.getMonth()});
  return out;
}

export function getDismissedInsights() { try{return JSON.parse(localStorage.getItem('dismissed_insights')||'[]');}catch(e){return[];} }
export function dismissInsight(key) { const d=getDismissedInsights(); if(!d.includes(key)){d.push(key);localStorage.setItem('dismissed_insights',JSON.stringify(d));} renderInsights(); }

export function renderInsights() {
  const el = $('dash-insights'); if (!el) return;
  if (state.financeHistory.length < 2) { el.innerHTML='<div class="card">'+emptyState('ti-bulb','Insights unlock after 2 months','Save one more month and we\'ll start surfacing personalised tips.','Save this month →','window._showTrackerNew()')+'</div>'; return; }
  const all=generateInsights(), dismissed=getDismissedInsights(), visible=all.filter(i=>!dismissed.includes(i.key));
  if (!visible.length) { el.innerHTML=''; return; }
  visible.forEach(i=>{if(!state.insightsInboxedThisSession.has(i.key)){state.insightsInboxedThisSession.add(i.key);addInboxItem(i.icon,i.title,i.body,'dashboard');}});
  const show = state.insightsExpanded ? visible : visible.slice(0,5);
  let h = '<div class="card"><h2>Spending Insights</h2>';
  show.forEach(i=>{ h+=`<div class="insight-card ${i.type}"><i class="ti ${esc(i.icon)}"></i><div style="flex:1;min-width:0"><div class="insight-title">${esc(i.title)}</div><div class="insight-body">${esc(i.body)}</div></div><button class="insight-dismiss" onclick="window._dismissInsight('${i.key}')" title="Dismiss">&times;</button></div>`; });
  if (visible.length>5) h+=`<button class="insight-seeall" onclick="window._toggleInsights()">${state.insightsExpanded?'Show fewer':'See all insights ('+visible.length+')'}</button>`;
  h += '</div>'; el.innerHTML=h;
}

window._dismissInsight = dismissInsight;
window._toggleInsights = () => { state.insightsExpanded = !state.insightsExpanded; renderInsights(); };
