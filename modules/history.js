import { state } from './state.js';
import { $, esc, fmt, emptyState } from './utils.js';
import { MF, MS, ACCOUNT_GROUPS, ACCT_TO_GROUP, groupForPot } from './constants.js';
import { db, doc, deleteDoc } from './firebase.js';
import { fdl, fds, os } from './utils.js';
import { potProgressHTML } from './pots.js';
import { st } from './utils.js';

// ── Accounts breakdown ────────────────────────────────────────────────────────
export function buildAccountsBreakdown(potsList) {
  const g={},dp=[],un=[];
  potsList.forEach(p=>{const a=parseFloat(p.amount)||0;if(!p.name&&a===0)return;const n=p.name||'Unnamed pot';if(p.account==='Direct Payment')dp.push({name:n,amount:a});else if(p.account){if(!g[p.account])g[p.account]={items:[],total:0};g[p.account].items.push({name:n,amount:a});g[p.account].total+=a;}else un.push({name:n,amount:a});});
  let html='',gt=0;
  if(dp.length){const t=dp.reduce((s,i)=>s+i.amount,0);gt+=t;html+=`<div class="account-group" style="border-left:3px solid var(--red);background:var(--red-bg)"><div class="account-group-header"><span class="account-group-name" style="color:var(--red)">Pay Immediately</span><span class="account-group-total" style="color:var(--red)">${fmt(t)}</span></div><div class="account-group-items">${dp.map(i=>`<div><span>${esc(i.name)}</span><span>${fmt(i.amount)}</span></div>`).join('')}</div></div>`;}
  ACCOUNT_GROUPS.forEach(grp=>{const gn=grp[0];let groupTotal=0,groupHtml='';grp[1].forEach(ac=>{const x=g[ac];if(!x)return;groupTotal+=x.total;x.items.forEach(i=>{groupHtml+=`<div><span>${esc(i.name)}</span><span>${fmt(i.amount)}</span></div>`;});});if(groupTotal>0){gt+=groupTotal;html+=`<div class="account-group"><div class="account-group-header"><span class="account-group-name">${esc(gn)}</span><span class="account-group-total">${fmt(groupTotal)}</span></div><div class="account-group-items">${groupHtml}</div></div>`;}});
  const usedCats={};ACCOUNT_GROUPS.forEach(gr=>gr[1].forEach(a=>usedCats[a]=true));
  const otherPots=[];Object.keys(g).forEach(k=>{if(!usedCats[k]){otherPots.push(...g[k].items);gt+=g[k].total;}});
  if(otherPots.length){const ot=otherPots.reduce((s,i)=>s+i.amount,0);html+=`<div class="account-group"><div class="account-group-header"><span class="account-group-name">Other</span><span class="account-group-total">${fmt(ot)}</span></div><div class="account-group-items">${otherPots.map(i=>`<div><span>${esc(i.name)}</span><span>${fmt(i.amount)}</span></div>`).join('')}</div></div>`;}
  if(un.length){const t=un.reduce((s,i)=>s+i.amount,0);gt+=t;html+=`<div class="account-group"><div class="account-group-header"><span class="account-group-name" style="color:var(--text-secondary)">Main Account / Unassigned</span><span class="account-group-total">${fmt(t)}</span></div><div class="account-group-items">${un.map(i=>`<div><span>${esc(i.name)}</span><span>${fmt(i.amount)}</span></div>`).join('')}</div></div>`;}
  if(html) html+=`<div class="account-grand-total"><span>Total Outgoings</span><span>${fmt(gt)}</span></div>`;
  return html;
}

// ── View entry modal ──────────────────────────────────────────────────────────
export function viewEntry(id) {
  const h=state.financeHistory.find(e=>e.id===id);if(!h)return;
  const b=$('detail-modal-body');
  let html=`<h2>${esc(MF[h.month]+' '+h.year)}</h2>`;
  html+=`<div class="paydate-card" style="margin:12px 0 16px;box-shadow:none"><div class="paydate-date" style="font-size:1.1rem;margin:0">${esc(h.payDateLong||h.payDate)}</div>${h.payDateMoved&&h.payDateReason?`<div class="paydate-note">${esc(h.payDateReason)}</div>`:''}</div>`;
  html+=h.freeMoney>=0?`<div class="banner banner-green" style="font-size:1rem;padding:12px">${fmt(h.freeMoney)} free money</div>`:`<div class="banner banner-red" style="font-size:1rem;padding:12px">${fmt(Math.abs(h.freeMoney))} over budget</div>`;
  html+=`<div class="summary-grid" style="margin-bottom:12px">${st('Salary',fmt(h.salary)+'/yr')}${st('Take-Home',fmt(h.takeHome))}${st('Mileage',fmt(h.mileage))}${st('Outgoings',fmt(h.outgoings))}</div>`;
  if(h.togExpenses||h.togMileage||h.togOvertime){html+=`<div class="account-group" style="margin-bottom:12px"><div style="font-weight:600;margin-bottom:6px">Adjustments</div><div class="account-group-items">`;if(h.togExpenses&&h.workExpenses>0)html+=`<div><span>Work expenses</span><span>${fmt(h.workExpenses)}</span></div>`;if(h.togMileage&&h.miles>0)html+=`<div><span>Mileage (${h.miles} miles × 55p)</span><span>${fmt(h.mileage)}</span></div>`;if(h.togOvertime&&h.overtime>0)html+=`<div><span>Overtime / bonus (gross)</span><span>${fmt(h.overtime)}</span></div>`;html+='</div></div>';}
  if(h.pots&&h.pots.length){const wt=h.pots.filter(p=>(parseFloat(p.target)||0)>0);if(wt.length){html+=`<div style="font-weight:700;font-size:0.95rem;margin:14px 0 8px">Budget Targets</div><div class="account-group"><div class="account-group-items">`;wt.forEach(p=>{const a=parseFloat(p.amount)||0,t=parseFloat(p.target)||0;html+=`<div style="display:block;padding:6px 0"><div style="display:flex;justify-content:space-between"><span>${esc(p.name)}</span><span>${fmt(a)} / ${fmt(t)}</span></div>${potProgressHTML(a,t)}</div>`;});html+='</div></div>';}const acctHtml=buildAccountsBreakdown(h.pots);if(acctHtml)html+=`<div style="font-weight:700;font-size:0.95rem;margin:14px 0 8px">Account Breakdown</div>${acctHtml}`;}
  html+=`<div class="action-row" style="margin-top:16px"><button class="btn btn-primary" onclick="window._editE(${h.id})">Edit Month</button><button class="btn btn-outline" onclick="window._loadT(${h.id})">Use as Template</button><button class="btn btn-danger-solid" onclick="window._delE(${h.id})">Delete</button></div><div class="action-row"><button class="btn btn-outline" onclick="window._xlMonth(${h.id})"><i class="ti ti-file-spreadsheet"></i> Excel</button><button class="btn btn-outline" onclick="window._pdfMonth(${h.id})"><i class="ti ti-file-type-pdf"></i> PDF</button></div>`;
  b.innerHTML=html; $('detail-modal').classList.add('open');
}

export async function deleteEntry(id) {
  const h=state.financeHistory.find(e=>e.id===id);if(!h)return;
  if(!confirm('Delete '+MF[h.month]+' '+h.year+'?'))return;
  state.financeHistory=state.financeHistory.filter(e=>e.id!==id);
  import('./tracker.js').then(m=>m.persistHL());
  if(state.currentUser){try{await deleteDoc(doc(db,'users',state.currentUser.uid,'months',String(id)));}catch(e){}}
  $('detail-modal').classList.remove('open');
  import('./dashboard.js').then(m=>m.renderDashboard());
  import('./utils.js').then(m=>m.toast('Deleted '+h.label));
}

// ── History list with search / filter / sort (Part 2) ────────────────────────
export function renderDashHistory() {
  const el = $('dash-history'); if (!el) return;
  const allEntries = state.financeHistory;
  if (!allEntries.length) {
    // search bar hidden if no data
    const ctrl = $('hist-search-ctrl'); if (ctrl) ctrl.style.display = 'none';
    el.innerHTML = emptyState('ti-history','No history yet','Every month you save will appear here so you can review, compare, and load as a template.','Save my first month →','window._showTrackerNew()');
    return;
  }
  const ctrl = $('hist-search-ctrl'); if (ctrl) ctrl.style.display = 'block';
  // apply search
  let entries = allEntries.slice();
  const q = (state.histSearch||'').toLowerCase().trim();
  if (q) {
    entries = entries.filter(e => {
      if ((MF[e.month]+' '+e.year).toLowerCase().includes(q)) return true;
      if (String(e.year).includes(q)) return true;
      if ((e.pots||[]).some(p=>(p.name||'').toLowerCase().includes(q)||(String(p.amount)||'').includes(q))) return true;
      return false;
    });
  }
  // apply tax year filter
  const filter = state.histFilter || 'all';
  if (filter !== 'all') {
    const [startY] = filter.split('/').map(Number);
    entries = entries.filter(e => {
      const hd = new Date(e.year, e.month, 15);
      const start = new Date(startY, 3, 6), end = new Date(startY+1, 3, 5);
      return hd >= start && hd <= end;
    });
  }
  // sort
  if (!state.histSortNewest) entries = entries.slice().reverse();
  // results count
  const countEl = $('hist-results-count');
  if (countEl) countEl.textContent = `Showing ${entries.length} of ${allEntries.length} month${allEntries.length===1?'':'s'}`;
  if (!entries.length) {
    el.innerHTML = emptyState('ti-search-off','No results','Try a different search term or clear the filter.','Clear search','window._histClearSearch()');
    return;
  }
  el.innerHTML = entries.map(e => {
    const cls=e.freeMoney>=0?'positive':'negative', fs=(e.freeMoney<0?'−':'')+fmt(Math.abs(e.freeMoney));
    return `<div class="dash-history-row" onclick="window._viewE(${e.id})">
      <div class="dh-main">
        <div class="dh-month">${esc(MF[e.month]+' '+e.year)}</div>
        <div class="dh-paydate">Paid: ${esc(e.payDateLong||e.payDate)}</div>
        <div class="dh-stats"><span>Take-home: ${fmt(e.takeHome)}</span><span>Out: ${fmt(e.outgoings)}</span>${e.mileage>0?`<span>Mileage: ${fmt(e.mileage)}</span>`:''}</div>
      </div>
      <div class="dh-free ${cls}">${fs}</div>
      <div class="dh-actions">
        <button class="btn btn-outline" onclick="event.stopPropagation();window._editE(${e.id})" title="Edit month">Edit</button>
        <button class="btn btn-danger" onclick="event.stopPropagation();window._delE(${e.id})" title="Delete">×</button>
      </div>
    </div>`;
  }).join('');
}

export function buildHistoryFilters() {
  // generate tax year options from data
  const years = new Set();
  state.financeHistory.forEach(h => {
    const hd = new Date(h.year, h.month, 15);
    for (let y=hd.getFullYear()-1; y<=hd.getFullYear(); y++) {
      const start=new Date(y,3,6), end=new Date(y+1,3,5);
      if (hd>=start&&hd<=end) { years.add(y); break; }
    }
  });
  const opts = [`<option value="all">All time</option>`];
  [...years].sort((a,b)=>b-a).forEach(y => {
    const label=`${y}/${String(y+1).slice(2)}`;
    opts.push(`<option value="${y}/${y+1}" ${state.histFilter===`${y}/${y+1}`?'selected':''}>${label}</option>`);
  });
  const sel = $('hist-year-filter'); if (sel) sel.innerHTML = opts.join('');
}

export function initHistoryControls() {
  const search = $('hist-search');
  const clear  = $('hist-search-clear');
  const filter = $('hist-year-filter');
  const sortBtn= $('hist-sort-btn');
  if (search) {
    search.addEventListener('input', () => {
      state.histSearch = search.value;
      if (clear) clear.style.display = search.value ? 'flex' : 'none';
      renderDashHistory();
    });
  }
  if (clear) {
    clear.addEventListener('click', () => {
      state.histSearch=''; if(search)search.value=''; clear.style.display='none'; renderDashHistory();
    });
  }
  if (filter) {
    filter.addEventListener('change', () => { state.histFilter=filter.value; renderDashHistory(); });
  }
  if (sortBtn) {
    sortBtn.textContent = state.histSortNewest ? 'Newest first' : 'Oldest first';
    sortBtn.addEventListener('click', () => {
      state.histSortNewest = !state.histSortNewest;
      localStorage.setItem('hist_sort', state.histSortNewest ? 'newest' : 'oldest');
      sortBtn.textContent = state.histSortNewest ? 'Newest first' : 'Oldest first';
      renderDashHistory();
    });
  }
}

// window globals
window._viewE = viewEntry;
window._delE  = deleteEntry;
window._editE = id => import('./tracker.js').then(m => m.editEntry(id));
window._loadT = id => import('./tracker.js').then(m => m.loadTemplate(id));
window._histClearSearch = () => {
  state.histSearch='';
  const s=$('hist-search'); if(s)s.value='';
  const c=$('hist-search-clear'); if(c)c.style.display='none';
  renderDashHistory();
};
