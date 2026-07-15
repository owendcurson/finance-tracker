import { state } from './state.js';
import { $, fmt, esc, row, rowT, st, toast, debounce, loadScript } from './utils.js';
import { MF, MS } from './constants.js';
import { cTax, cNI, gPA } from './tax.js';
import { getPD, getNextPD, movedReason, taxYearStart } from './payday.js';
import { os, fdl, fds, ds } from './utils.js';
import { db, doc, setDoc, deleteDoc, getDocs, collection } from './firebase.js';
import { renderPots, buildCatOpts, potProgressHTML, addPot as addPotToState } from './pots.js';
import { buildAccountsBreakdown } from './history.js';
import { addInboxItem } from './inbox.js';
import { screenEnter } from './ui.js';
import { MR } from './constants.js';

const XLSX_CDN   = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const JSPDF_CDN  = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

// ── Navigation ────────────────────────────────────────────────────────────────
export function showTracker() {
  const ds2 = $('dashboard-screen'), ts = $('tracker-screen');
  if (ds2) ds2.style.display = 'none';
  if (ts) { ts.style.display = 'block'; screenEnter(ts); }
  const hb = $('header-back'); if (hb) hb.style.display = 'flex';
  const tb = $('template-banner'); if (tb) tb.style.display = 'none';
  initMP();
  goStep(state.currentStep || 1);
}

export function showDashboard() {
  import('./dashboard.js').then(m => m.showDashboard());
}

export function goStep(n) {
  const prev = state.currentStep || 1;
  state.currentStep = n;
  const dir = n > prev ? 'left' : 'right';
  for (let i=1;i<=3;i++) {
    const p=$('panel'+i);if(!p)continue;
    p.classList.remove('active','step-slide-left','step-slide-right');
    if(i===n){p.classList.add('active');void p.offsetWidth;p.classList.add(dir==='left'?'step-slide-left':'step-slide-right');}
  }
  for (let i=1;i<=3;i++) {
    const c=$('sc'+i);if(!c)continue;
    c.classList.toggle('active',i===n);c.classList.toggle('done',i<n);
    const ln=$('sl'+i);if(ln)ln.classList.toggle('done',i<n);
  }
  if (n===3) renderPots();
}

export function toggleSection(n) { $('sec-'+n)?.classList.toggle('open', $('tog-'+n)?.checked); }

// ── Tax calculator ────────────────────────────────────────────────────────────
const debouncedCalc = debounce(_calc, 150);
export function calc() { debouncedCalc(); }

function _calc() {
  const sal=parseFloat($('salary').value)||0,tE=$('tog-expenses').checked,tM=$('tog-mileage').checked,tO=$('tog-overtime').checked;
  const wE=tE?(parseFloat($('work-expenses').value)||0):0,mi=tM?(parseFloat($('miles').value)||0):0,ot=tO?(parseFloat($('overtime').value)||0):0,mA=mi*MR;
  if(tM) $('mileage-calc').innerHTML=mi.toLocaleString('en-GB')+' miles × 55p = '+fmt(mA);
  const aT=cTax(sal),aN=cNI(sal),aNet=sal-aT-aN,eff=sal>0?((aT+aN)/sal*100):0;
  const mG=sal/12,mT=aT/12,mN=aN/12,adjT=cTax(Math.max(0,sal-(wE*12)))/12,tS=mT-adjT;
  const oT=(cTax(sal+ot*12)-cTax(sal))/12,oN=(cNI(sal+ot*12)-cNI(sal))/12;
  const fT=adjT+oT,fN=mN+oN,th=mG+ot-fT-fN;
  state.lastTakeHome=th; state.lastMileage=mA;
  const sh=sal>0;
  $('tax-card').style.display=sh?'block':'none';
  $('annual-card').style.display=sh?'block':'none';
  let mh=row('Gross salary',mG);
  if(ot>0)mh+=row('Overtime / bonus',ot,'addition');
  mh+=row('Income tax',-fT,'deduction')+row('National Insurance',-fN,'deduction');
  if(wE>0)mh+=row('Tax relief on expenses',tS,'addition');
  mh+=rowT('Monthly take-home',th);
  $('monthly-table').innerHTML=mh;
  let ah=row('Gross salary',sal)+`<tr><td class="label-secondary">Personal allowance</td><td class="label-secondary" style="text-align:right">${fmt(gPA(sal))}</td></tr>`+row('Income tax',-aT,'deduction')+row('National Insurance',-aN,'deduction')+rowT('Annual net pay',aNet)+`<tr><td class="label-secondary">Effective deduction rate</td><td class="label-secondary" style="text-align:right">${eff.toFixed(1)}%</td></tr>`;
  $('annual-table').innerHTML=ah;
  renderSum(th,mA);
  saveLocal();
}

function renderSum(th, mi) {
  const tp=state.pots.reduce((s,p)=>s+(parseFloat(p.amount)||0),0), fr=th+mi-tp;
  let h=fr>=0?`<div class="banner banner-green">${fmt(fr)} free money this month</div>`:`<div class="banner banner-red">${fmt(Math.abs(fr))} over budget this month</div>`;
  h+=`<div class="summary-grid">${st('Take-Home Pay',fmt(th))}${st('Mileage Received',fmt(mi))}${st('Total Outgoings',fmt(tp))}${st('Free Money',(fr<0?'−':'')+fmt(Math.abs(fr)))}</div>`;
  h+=`<div class="action-row"><button class="btn btn-success" id="save-month-btn">Save Month</button><button class="btn btn-amber" id="form-accounts-btn">Form Accounts</button></div>`;
  h+=`<div class="card"><h3>Itemised Breakdown</h3><table class="breakdown">${row('Monthly take-home pay',th)}`;
  if(mi>0)h+=row('Mileage expenses (tax-free)',mi,'addition');
  h+='<tr class="divider"><td colspan="2" style="font-weight:600;padding-top:12px">Outgoings</td></tr>';
  state.pots.forEach(p=>{const a=parseFloat(p.amount)||0;if(p.name||a>0){let l=p.name||'Unnamed pot';if(p.account)l+=` <span class="label-secondary">(${esc(p.account)})</span>`;const pb=potProgressHTML(a,parseFloat(p.target)||0);if(pb)l+=`<div style="margin-top:4px">${pb}</div>`;h+=row(l,-a,'deduction');}});
  h+=rowT('Remaining',fr)+'</table></div>';
  $('summary-section').innerHTML=h;
  $('save-month-btn')?.addEventListener('click',saveMonth);
  $('form-accounts-btn')?.addEventListener('click',openAccounts);
}

// ── Month persistence ─────────────────────────────────────────────────────────
export function saveLocal() {
  try { localStorage.setItem('uk-finance-tracker',JSON.stringify({salary:$('salary').value,togExpenses:$('tog-expenses').checked,togMileage:$('tog-mileage').checked,togOvertime:$('tog-overtime').checked,workExpenses:$('work-expenses').value,miles:$('miles').value,overtime:$('overtime').value,pots:state.pots})); } catch(e){}
}
export function persistHL() { try { localStorage.setItem('finance_history',JSON.stringify(state.financeHistory)); } catch(e){} }
export function loadLocal() {
  try {
    const r=localStorage.getItem('uk-finance-tracker');
    if(r){const d=JSON.parse(r);if(d.salary)$('salary').value=d.salary;if(d.togExpenses){$('tog-expenses').checked=true;toggleSection('expenses');}if(d.togMileage){$('tog-mileage').checked=true;toggleSection('mileage');}if(d.togOvertime){$('tog-overtime').checked=true;toggleSection('overtime');}if(d.workExpenses)$('work-expenses').value=d.workExpenses;if(d.miles)$('miles').value=d.miles;if(d.overtime)$('overtime').value=d.overtime;if(d.pots&&d.pots.length){state.pots=d.pots.map(p=>({name:p.name||'',amount:p.amount||'',account:p.account||'',target:p.target||''}));renderPots();}}
  } catch(e){}
  try {
    const o=localStorage.getItem('uk-finance-history'),n=localStorage.getItem('finance_history');
    if(o&&!n){localStorage.setItem('finance_history',o);localStorage.removeItem('uk-finance-history');}
    const h=localStorage.getItem('finance_history');
    if(h) state.financeHistory=JSON.parse(h);
  } catch(e){}
}

export async function saveMonth() {
  const sal=parseFloat($('salary').value)||0;
  if(sal===0){toast('Enter a salary before saving');return;}
  const sm=parseInt($('pick-month').value),sy=parseInt($('pick-year').value),pr=getPD(sy,sm),tp=state.pots.reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
  const entryId=state.editingId||Date.now();
  const entry={id:entryId,month:sm,year:sy,label:MS[sm]+' '+sy,payDate:ds(pr.payDate),payDateLong:fdl(pr.payDate),payDateMoved:pr.moved,payDateReason:pr.moved?movedReason(pr.original):'',payDayUsed:state.payDay,salary:sal,togExpenses:$('tog-expenses').checked,workExpenses:parseFloat($('work-expenses').value)||0,togMileage:$('tog-mileage').checked,miles:parseFloat($('miles').value)||0,togOvertime:$('tog-overtime').checked,overtime:parseFloat($('overtime').value)||0,takeHome:Math.round(state.lastTakeHome*100)/100,mileage:Math.round(state.lastMileage*100)/100,outgoings:Math.round(tp*100)/100,freeMoney:Math.round((state.lastTakeHome+state.lastMileage-tp)*100)/100,pots:state.pots.filter(p=>p.name||(parseFloat(p.amount)||0)>0).map(p=>({name:p.name||'Unnamed',amount:parseFloat(p.amount)||0,account:p.account||'',target:parseFloat(p.target)||0}))};
  if(state.editingId) state.financeHistory=state.financeHistory.map(e=>e.id===state.editingId?entry:e);
  else state.financeHistory.unshift(entry);
  state.editingId=null;
  persistHL();
  if(state.currentUser){try{await setDoc(doc(db,'users',state.currentUser.uid,'months',String(entry.id)),entry);}catch(e){}}
  await addInboxItem('ti-circle-check',MF[entry.month]+' '+entry.year+' saved successfully',(entry.freeMoney<0?'Over budget by ':'Free money: ')+(entry.freeMoney<0?'−':'')+fmt(Math.abs(entry.freeMoney)));
  const overPots=entry.pots.filter(p=>(p.target||0)>0&&p.amount>p.target).map(p=>p.name);
  if(overPots.length) await addInboxItem('ti-alert-triangle',overPots.length+' pot'+(overPots.length===1?'':'s')+' went over budget this month',overPots.join(', '));
  clearTracker();
  import('./dashboard.js').then(m=>m.showDashboard());
  toast('Saved '+entry.label);
}

export function clearTracker() {
  state.pots=[];renderPots();
  $('salary').value='';$('work-expenses').value='';$('miles').value='';$('overtime').value='';
  $('tog-expenses').checked=false;$('tog-mileage').checked=false;$('tog-overtime').checked=false;
  $('sec-expenses').classList.remove('open');$('sec-mileage').classList.remove('open');$('sec-overtime').classList.remove('open');
  state.lastTakeHome=0;state.lastMileage=0;saveLocal();
  if (state.mpInit) {
    const n=new Date();$('pick-month').value=n.getMonth();$('pick-year').value=n.getFullYear();
    updPD();
  }
}

export function updPD() {
  const m=parseInt($('pick-month').value),y=parseInt($('pick-year').value),r=getPD(y,m),nx=getNextPD(y,m),cs=new Date(r.payDate);
  cs.setDate(cs.getDate()+1);
  let h=`<div class="paydate-card"><div class="paydate-header"><span class="paydate-icon">&#128197;</span><span class="paydate-title">Pay Date for ${MF[m]} ${y}</span></div><div class="paydate-date">${fdl(r.payDate)}</div>`;
  if(r.moved)h+=`<div class="paydate-note">${movedReason(r.original)} — paid ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][r.payDate.getDay()]} ${r.payDate.getDate()}${os(r.payDate.getDate())} instead</div>`;
  h+=`<div class="paydate-coverage"><strong>Budget coverage:</strong> ${fds(cs)} — ${fds(nx.payDate)} <span style="color:var(--primary);font-weight:600">(${Math.round((nx.payDate-cs)/86400000)} days)</span></div></div>`;
  $('paydate-info').innerHTML=h;
}

export function initMP() {
  const msEl=$('pick-month'),ysEl=$('pick-year');
  if(!state.mpInit){
    const now=new Date();
    for(let m=0;m<12;m++){const o=document.createElement('option');o.value=m;o.textContent=MF[m];if(m===now.getMonth())o.selected=true;msEl.appendChild(o);}
    for(let y=2024;y<=2028;y++){const o=document.createElement('option');o.value=y;o.textContent=y;if(y===now.getFullYear())o.selected=true;ysEl.appendChild(o);}
    state.mpInit=true;
  }
  updPD();
}

export function shiftM(d) {
  const msEl=$('pick-month'),ysEl=$('pick-year');
  let m=parseInt(msEl.value)+d,y=parseInt(ysEl.value);
  if(m>11){m=0;y++;}if(m<0){m=11;y--;}
  if(y<2024)y=2024;if(y>2028)y=2028;
  msEl.value=m;ysEl.value=y;updPD();
}

// ── Accounts modal ────────────────────────────────────────────────────────────
export function openAccounts() {
  const h=buildAccountsBreakdown(state.pots);
  $('accounts-body').innerHTML=h||'<p class="history-empty">No pots to assign.</p>';
  $('accounts-modal').classList.add('open');
}
export function closeAccounts() { $('accounts-modal').classList.remove('open'); }

// ── Load / edit from history ──────────────────────────────────────────────────
export function loadTemplate(id) {
  const h=state.financeHistory.find(e=>e.id===id);if(!h)return;
  state.editingId=null;$('salary').value=h.salary;
  state.pots=h.pots.map(p=>({name:p.name||'',amount:p.amount||'',account:p.account||'',target:p.target||''}));
  renderPots();$('work-expenses').value='';$('miles').value='';$('overtime').value='';
  $('tog-expenses').checked=false;$('tog-mileage').checked=false;$('tog-overtime').checked=false;
  $('sec-expenses').classList.remove('open');$('sec-mileage').classList.remove('open');$('sec-overtime').classList.remove('open');
  const now=new Date();$('pick-month').value=now.getMonth();$('pick-year').value=now.getFullYear();updPD();
  $('detail-modal').classList.remove('open');showTracker();calc();
  const b=$('template-banner');b.textContent=`Template loaded from ${MF[h.month]} ${h.year} — salary and pots ready, fill in this month's adjustments`;b.style.display='block';
  setTimeout(()=>b.style.display='none',8000);
}

export function editEntry(id) {
  const h=state.financeHistory.find(e=>e.id===id);if(!h)return;
  state.editingId=id;
  $('detail-modal').classList.remove('open');
  showTracker(); // runs initMP() first, then we override with historical values below
  state.currentStep=1; goStep(1);
  $('salary').value=h.salary;
  $('pick-month').value=h.month;$('pick-year').value=h.year;updPD();
  state.pots=h.pots.map(p=>({name:p.name||'',amount:p.amount||'',account:p.account||'',target:p.target||''}));
  renderPots();
  if(h.togExpenses&&h.workExpenses>0){$('tog-expenses').checked=true;toggleSection('expenses');$('work-expenses').value=h.workExpenses;}else{$('tog-expenses').checked=false;$('sec-expenses').classList.remove('open');$('work-expenses').value='';}
  if(h.togMileage&&h.miles>0){$('tog-mileage').checked=true;toggleSection('mileage');$('miles').value=h.miles;}else{$('tog-mileage').checked=false;$('sec-mileage').classList.remove('open');$('miles').value='';}
  if(h.togOvertime&&h.overtime>0){$('tog-overtime').checked=true;toggleSection('overtime');$('overtime').value=h.overtime;}else{$('tog-overtime').checked=false;$('sec-overtime').classList.remove('open');$('overtime').value='';}
  calc();
  const b=$('template-banner');b.textContent=`Editing ${MF[h.month]} ${h.year} — make your changes then save`;b.style.display='block';
}

// ── Salary calculator ─────────────────────────────────────────────────────────
export function openSalCalc() {
  const cur=state.financeHistory.length&&state.financeHistory[0].salary?state.financeHistory[0].salary:'';
  $('salcalc-current').value=cur;$('salcalc-proposed').value='';
  renderSalCalc();$('salcalc-modal').classList.add('open');
}
export function renderSalCalc() {
  const a=parseFloat($('salcalc-current').value)||0,b=parseFloat($('salcalc-proposed').value)||0;
  const ca=_salCol(a),cb=_salCol(b);
  const dm=cb.th-ca.th,da=cb.annualNet-ca.annualNet;
  $('salcalc-result').innerHTML=`<table class="salcalc-table"><thead><tr><th></th><th>Current</th><th>Proposed</th></tr></thead><tbody><tr><td>Monthly gross</td><td>${fmt(ca.gross)}</td><td>${fmt(cb.gross)}</td></tr><tr><td>Monthly tax</td><td>${fmt(ca.tax)}</td><td>${fmt(cb.tax)}</td></tr><tr><td>Monthly NI</td><td>${fmt(ca.ni)}</td><td>${fmt(cb.ni)}</td></tr><tr><td>Monthly take-home</td><td><strong>${fmt(ca.th)}</strong></td><td><strong>${fmt(cb.th)}</strong></td></tr><tr><td>Effective deduction rate</td><td>${ca.eff.toFixed(1)}%</td><td>${cb.eff.toFixed(1)}%</td></tr><tr class="salcalc-diff"><td>Extra take-home / month</td><td colspan="2" style="text-align:right">${dm>=0?'+':'−'}${fmt(Math.abs(dm))}</td></tr><tr class="salcalc-diff"><td>Extra take-home / year</td><td colspan="2" style="text-align:right">${da>=0?'+':'−'}${fmt(Math.abs(da))}</td></tr></tbody></table>`;
}
function _salCol(sal) { const tax=cTax(sal),ni=cNI(sal),net=sal-tax-ni; return{gross:sal/12,tax:tax/12,ni:ni/12,th:net/12,eff:sal>0?((tax+ni)/sal*100):0,annualNet:net}; }

// ── Exports ───────────────────────────────────────────────────────────────────
export async function exportMonthExcel(id) {
  const h=state.financeHistory.find(e=>e.id===id);if(!h)return;
  await loadScript(XLSX_CDN);
  if(!window.XLSX){toast('Export unavailable');return;}
  const wb=window.XLSX.utils.book_new();
  const summary=[['Month',MF[h.month]+' '+h.year],['Pay date',h.payDateLong||h.payDate],['Gross salary (annual)',h.salary],['Take-home',h.takeHome],['Mileage',h.mileage],['Outgoings',h.outgoings],['Free money',h.freeMoney]];
  window.XLSX.utils.book_append_sheet(wb,window.XLSX.utils.aoa_to_sheet(summary),'Summary');
  const potRows=[['Pot','Amount','Budget','Account']];(h.pots||[]).forEach(p=>potRows.push([p.name,p.amount,p.target||'',p.account||'']));
  window.XLSX.utils.book_append_sheet(wb,window.XLSX.utils.aoa_to_sheet(potRows),'Pots');
  window.XLSX.writeFile(wb,'finance-tracker-'+MS[h.month].toLowerCase()+'-'+h.year+'.xlsx');
}

export async function exportYTDExcel() {
  await loadScript(XLSX_CDN);
  if(!window.XLSX){toast('Export unavailable');return;}
  const { ytdMonths } = await import('./payday.js');
  const start=taxYearStart(new Date()), months=ytdMonths();
  if(!months.length){toast('No months in this tax year');return;}
  const wb=window.XLSX.utils.book_new();
  const sorted=months.slice().sort((a,b)=>new Date(a.year,a.month)-new Date(b.year,b.month));
  const rows=[['Month','Take-Home','Mileage','Outgoings','Free Money']];
  let t={th:0,mi:0,out:0,fr:0};
  sorted.forEach(h=>{rows.push([MF[h.month]+' '+h.year,h.takeHome,h.mileage,h.outgoings,h.freeMoney]);t.th+=h.takeHome||0;t.mi+=h.mileage||0;t.out+=h.outgoings||0;t.fr+=h.freeMoney||0;});
  rows.push(['TOTAL',t.th,t.mi,t.out,t.fr]);
  window.XLSX.utils.book_append_sheet(wb,window.XLSX.utils.aoa_to_sheet([['Tax Year',start.getFullYear()+'/'+String(start.getFullYear()+1).slice(2)]]),'Summary');
  window.XLSX.utils.book_append_sheet(wb,window.XLSX.utils.aoa_to_sheet(rows),'Months');
  window.XLSX.writeFile(wb,'finance-tracker-ytd-'+start.getFullYear()+'.xlsx');
}

export async function exportMonthPDF(id) {
  const h=state.financeHistory.find(e=>e.id===id);if(!h)return;
  await loadScript(JSPDF_CDN);
  if(!window.jspdf){toast('Export unavailable');return;}
  const jsPDF=window.jspdf.jsPDF; const d=new jsPDF(); let y=18;
  d.setFontSize(18);d.text('Finance Tracker — '+MF[h.month]+' '+h.year,14,y);y+=8;
  d.setFontSize(10);d.setTextColor(120);d.text('Pay date: '+(h.payDateLong||h.payDate),14,y);y+=10;d.setTextColor(0);
  const sec=t=>{d.setFontSize(12);d.setFont(undefined,'bold');d.text(t,14,y);d.setFont(undefined,'normal');y+=6;d.setFontSize(10);};
  const line=(l,v)=>{d.text(l,16,y);d.text(v,190,y,{align:'right'});y+=6;};
  sec('Pay Information');line('Gross salary (annual)',fmt(h.salary));line('Take-home pay',fmt(h.takeHome));if(h.mileage>0)line('Mileage (tax-free)',fmt(h.mileage));y+=2;
  sec('Income Breakdown');if(h.togExpenses&&h.workExpenses>0)line('Work expenses',fmt(h.workExpenses));if(h.togMileage&&h.miles>0)line('Business miles',h.miles+' miles');if(h.togOvertime&&h.overtime>0)line('Overtime / bonus',fmt(h.overtime));y+=2;
  sec('Pots');(h.pots||[]).forEach(p=>{const l=p.name+(p.target?' (budget '+fmt(p.target)+')':'');line(l,fmt(p.amount));if(y>270){d.addPage();y=18;}});y+=2;
  sec('Summary');line('Total outgoings',fmt(h.outgoings));line('Free money',(h.freeMoney<0?'−':'')+fmt(Math.abs(h.freeMoney)));
  d.save('finance-tracker-'+MS[h.month].toLowerCase()+'-'+h.year+'.pdf');
}

// window globals
window._showTrackerNew = () => { state.editingId=null; clearTracker(); showTracker(); };
window._xlMonth       = exportMonthExcel;
window._pdfMonth      = exportMonthPDF;
window._xlYTD         = exportYTDExcel;
window._showTracker   = showTracker;
window._goStep        = goStep;
window._updPD         = updPD;
window._shiftM        = shiftM;
window._togSection    = (n) => toggleSection(n);
window._addPot        = () => { addPotToState(); renderPots(); calc(); };
window._initMP        = initMP;
