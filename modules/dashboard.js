import { state } from './state.js';
import { $, esc, fmt, toast, emptyState } from './utils.js';
import { MF, MS, GREETINGS, DEFAULT_WIDGETS, DEFAULT_ORDER, WIDGET_LABELS } from './constants.js';
import { db, doc, setDoc } from './firebase.js';
import { getPD, getNextPD, movedReason, taxYearStart, inTaxYear, ytdMonths } from './payday.js';
import { renderCharts, renderSavingsChart, initChartObserver, attachChartTypeListeners } from './charts.js';
import { renderInsights } from './insights.js';
import { renderAchievements } from './achievements.js';
import { renderDashHistory, buildHistoryFilters, initHistoryControls } from './history.js';
import { hideSkeleton, showSkeleton, initBackToTop, setBottomNav } from './ui.js';

const SECTION_TITLES = {
  countdown:'Payday Countdown', overview:'Overview', takehome:'Monthly Take-Home Pay',
  breakdown:'Spending Breakdown', stacked:'Spending by Category', free:'Free Money Trend',
  savings:'Savings Rate', ytd:'Year-to-Date Summary', insights:'Spending Insights', achievements:'Achievements',
};

// ── Entry point ───────────────────────────────────────────────────────────────
export async function showDashboard() {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(s => s.style.display = 'none');
  const ds = $('dashboard-screen'); if (ds) ds.style.display = 'block';
  setBottomNav('dashboard');
  showSkeleton();
  if (state.currentUser && !state.fsSynced) {
    await import('./tracker.js').then(m => m.loadLocal());
  }
  renderDashboard();
  hideSkeleton();
}

// ── Full dashboard render ─────────────────────────────────────────────────────
export function renderDashboard() {
  const container = document.querySelector('#dashboard-screen > .container:not(#dash-skeleton)');
  if (!container) return;
  const widgets = state.dashWidgets || DEFAULT_WIDGETS;
  const order   = state.dashOrder   || DEFAULT_ORDER;
  const now = new Date();
  const greeting = GREETINGS[now.getHours() % GREETINGS.length] || GREETINGS[0];

  let html = `<div class="dash-header">
    <div>
      <div class="dash-greeting">${esc(greeting)}</div>
      <div class="dash-date">${now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
    </div>
    <div class="dash-header-actions">
      <a href="#" class="dash-collapseall-link" id="dash-collapseall-link" onclick="event.preventDefault();window._dashCollapseAll()">Collapse all</a>
      <button class="btn btn-sm btn-outline" onclick="window._openCustomise()"><i class="ti ti-layout-dashboard"></i> Customise</button>
    </div>
  </div>`;

  order.forEach(key => {
    if (!widgets[key]) return;
    html += buildSection(key);
  });

  // History section — always visible, non-collapsible widget
  html += `<div class="dash-section" data-section="history" id="ds-history">
    <div class="dash-section-hdr" onclick="window._toggleDsSection('history')">
      <span>${esc('Monthly History')}</span>
      <i class="ti ti-chevron-down ds-chevron"></i>
    </div>
    <div class="dash-section-body">
      <div class="hist-search-ctrl" id="hist-search-ctrl" style="display:none">
        <div class="hist-search-wrap">
          <i class="ti ti-search hist-search-icon"></i>
          <input type="search" id="hist-search" class="hist-search-input" placeholder="Search months, pots…" autocomplete="off">
          <button class="hist-search-clear" id="hist-search-clear" style="display:none" aria-label="Clear search">×</button>
        </div>
        <div class="hist-filter-row">
          <select id="hist-year-filter" class="input-field" style="max-width:140px;font-size:0.85rem"></select>
          <button class="btn btn-sm btn-outline" id="hist-sort-btn">Newest first</button>
          <span class="hist-results-count" id="hist-results-count"></span>
        </div>
      </div>
      <div id="dash-history"></div>
    </div>
  </div>`;

  html += `<div class="dash-customise-shortcut">
    <button class="btn btn-outline btn-sm" onclick="window._openCustomise()"><i class="ti ti-layout-dashboard"></i> Customise dashboard</button>
  </div>`;

  container.innerHTML = html;

  // Render dynamic content
  renderOverview();
  renderCountdown();
  renderYTD();
  renderCharts();
  renderSavingsChart();
  renderInsights();
  renderAchievements();
  renderDashHistory();
  buildHistoryFilters();
  initHistoryControls();
  initChartObserver();
  attachChartTypeListeners();
  restoreCollapsedState(order);
  updateCollapseAllLink();
  initBackToTop();
}

function buildSection(key) {
  const collapsed = state.collapsedSections[key];
  const chevCls = collapsed ? ' rotated' : '';
  const bodyCls = collapsed ? ' collapsed' : '';
  let inner = '';
  switch (key) {
    case 'countdown': inner = `<div id="dash-countdown"></div>`; break;
    case 'overview':  inner = `<div id="dash-overview"></div>`; break;
    case 'takehome':  inner = `<div class="chart-card-full"><div class="chart-card-header"><h3>Monthly Take-Home Pay</h3><div class="chart-type-ctrl-wrap"></div></div><canvas id="chart-takehome" style="max-height:240px"></canvas></div>`; break;
    case 'breakdown': inner = `<div class="chart-card"><div class="chart-type-ctrl-wrap"></div><h3>Spending Breakdown</h3><canvas id="chart-spending" style="max-height:240px"></canvas></div>`; break;
    case 'stacked':   inner = `<div id="chart-stacked-wrap"><div class="chart-card-header"><h3>Spending by Category</h3><div class="chart-type-ctrl-wrap"></div></div><canvas id="chart-stacked" style="max-height:240px"></canvas></div>`; break;
    case 'free':      inner = `<div class="chart-card"><div class="chart-type-ctrl-wrap"></div><h3>Free Money Trend</h3><canvas id="chart-free" style="max-height:240px"></canvas></div>`; break;
    case 'savings':   inner = `<div id="dash-savings"></div>`; break;
    case 'ytd':       inner = `<div id="dash-ytd"></div>`; break;
    case 'insights':  inner = `<div id="dash-insights"></div>`; break;
    case 'achievements': inner = `<div id="dash-achievements"></div>`; break;
    default: return '';
  }
  return `<div class="dash-section" data-section="${key}" id="ds-${key}">
    <div class="dash-section-hdr" onclick="window._toggleDsSection('${key}')">
      <span>${esc(SECTION_TITLES[key] || key)}</span>
      <i class="ti ti-chevron-down ds-chevron${chevCls}"></i>
    </div>
    <div class="dash-section-body${bodyCls}">${inner}</div>
  </div>`;
}

// ── Overview cards ────────────────────────────────────────────────────────────
export function renderOverview() {
  const el = $('dash-overview'); if (!el) return;
  if (!state.financeHistory.length) {
    el.innerHTML = emptyState('ti-layout-cards','No data yet','Save your first month to see your overview.','Open tracker →','window._showTrackerNew()');
    return;
  }
  const latest = state.financeHistory[0];
  const freeClass = (latest.freeMoney || 0) >= 0 ? 'positive' : 'negative';
  const freeFmt = (latest.freeMoney < 0 ? '−' : '') + fmt(Math.abs(latest.freeMoney || 0));
  const sorted = state.financeHistory.slice().reverse();
  const avgFree = sorted.length >= 2 ? sorted.reduce((s,h)=>s+(h.freeMoney||0),0)/sorted.length : null;
  el.innerHTML = `<div class="overview-grid">
    <div class="overview-card">
      <div class="ov-label">Latest Take-Home</div>
      <div class="ov-value">${fmt(latest.takeHome||0)}</div>
      <div class="ov-sub">${esc(MF[latest.month]+' '+latest.year)}</div>
    </div>
    <div class="overview-card">
      <div class="ov-label">Free Money</div>
      <div class="ov-value ${freeClass}">${freeFmt}</div>
      <div class="ov-sub">${(latest.freeMoney||0)>=0?'Under budget':'Over budget'}</div>
    </div>
    <div class="overview-card">
      <div class="ov-label">Outgoings</div>
      <div class="ov-value">${fmt(latest.outgoings||0)}</div>
      <div class="ov-sub">This month</div>
    </div>
    ${avgFree !== null ? `<div class="overview-card">
      <div class="ov-label">Avg Free Money</div>
      <div class="ov-value ${avgFree>=0?'positive':'negative'}">${(avgFree<0?'−':'')+fmt(Math.abs(avgFree))}</div>
      <div class="ov-sub">All time avg</div>
    </div>` : ''}
    ${(latest.mileage||0)>0?`<div class="overview-card">
      <div class="ov-label">Mileage This Month</div>
      <div class="ov-value">${fmt(latest.mileage)}</div>
      <div class="ov-sub">${latest.miles||0} miles @ 55p</div>
    </div>`:''}
  </div>`;
}

// ── Countdown ─────────────────────────────────────────────────────────────────
export function renderCountdown() {
  const el = $('dash-countdown'); if (!el) return;
  const now = new Date(); now.setHours(0,0,0,0);
  const pd  = getPD(now.getFullYear(), now.getMonth());
  const npd = getNextPD(now.getFullYear(), now.getMonth());
  const thisPD = pd.payDate; thisPD.setHours(0,0,0,0);
  const nextPD = npd.payDate; nextPD.setHours(0,0,0,0);
  const diffMs = thisPD - now;
  const daysToThis = Math.ceil(diffMs / 86400000);
  const diffNext = nextPD - now;
  const daysToNext = Math.ceil(diffNext / 86400000);

  let countdownDays, countdownLabel, countdownSub, isPast;
  if (daysToThis > 0) {
    countdownDays = daysToThis; isPast = false;
    countdownLabel = daysToThis === 1 ? 'day until payday' : 'days until payday';
    countdownSub = thisPD.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  } else if (daysToThis === 0) {
    countdownDays = 0; isPast = false;
    countdownLabel = 'Payday today!'; countdownSub = 'Enjoy your pay day 🎉';
  } else {
    countdownDays = daysToNext; isPast = false;
    countdownLabel = daysToNext === 1 ? 'day until next payday' : 'days until next payday';
    countdownSub = nextPD.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  }

  // Progress through pay period
  const periodStart = new Date(daysToThis <= 0 ? thisPD : getPD(now.getMonth()===0?now.getFullYear()-1:now.getFullYear(), now.getMonth()===0?11:now.getMonth()-1).payDate);
  periodStart.setHours(0,0,0,0);
  const periodEnd = daysToThis <= 0 ? nextPD : thisPD;
  const totalDays = Math.max(1, Math.ceil((periodEnd - periodStart) / 86400000));
  const elapsed   = Math.ceil((now - periodStart) / 86400000);
  const progress  = Math.max(0, Math.min(100, (elapsed / totalDays) * 100));
  const progClass = progress >= 80 ? 'danger' : progress >= 50 ? 'warning' : 'ok';

  el.innerHTML = `<div class="paydate-card">
    <div class="countdown-main">
      <div class="countdown-num${daysToThis===0?' payday':''}">${daysToThis===0?'🎉':countdownDays}</div>
      <div class="countdown-label">${esc(countdownLabel)}</div>
      <div class="countdown-sub">${esc(countdownSub)}</div>
    </div>
    ${pd.moved ? `<div class="paydate-note"><i class="ti ti-info-circle"></i> ${esc(movedReason(pd.original)||'Payday moved')}</div>` : ''}
    <div class="period-progress">
      <div class="period-labels">
        <span>Pay period progress</span>
        <span>${Math.round(progress)}% through</span>
      </div>
      <div class="progress-track"><div class="progress-fill ${progClass}" style="width:${progress}%"></div></div>
    </div>
  </div>`;
}

// ── YTD summary ───────────────────────────────────────────────────────────────
export function renderYTD() {
  const el = $('dash-ytd'); if (!el) return;
  if (!state.financeHistory.length) { el.innerHTML=''; return; }
  const start = taxYearStart(new Date());
  const months = state.financeHistory.filter(h => inTaxYear(h, start));
  if (!months.length) { el.innerHTML=''; return; }
  const sorted = months.slice().sort((a,b)=>new Date(a.year,a.month)-new Date(b.year,b.month));
  const totTH = sorted.reduce((s,h)=>s+(h.takeHome||0),0);
  const totOut= sorted.reduce((s,h)=>s+(h.outgoings||0),0);
  const totFree=sorted.reduce((s,h)=>s+(h.freeMoney||0),0);
  const totMi = sorted.reduce((s,h)=>s+(h.togMileage?(h.miles||0):0),0);
  const totMileVal=sorted.reduce((s,h)=>s+(h.mileage||0),0);
  const year = start.getFullYear(), nextYear = year+1;
  const tyLabel = `${year}/${String(nextYear).slice(2)} Tax Year`;

  let tableRows = sorted.map(h => {
    const cls = (h.freeMoney||0)>=0?'positive':'negative';
    return `<tr onclick="window._viewE(${h.id})" style="cursor:pointer">
      <td>${esc(MS[h.month]+' '+String(h.year).slice(2))}</td>
      <td>${fmt(h.takeHome||0)}</td>
      <td>${fmt(h.outgoings||0)}</td>
      <td class="${cls}">${(h.freeMoney<0?'−':'')+fmt(Math.abs(h.freeMoney||0))}</td>
      ${totMi>0?`<td>${h.miles||0}</td>`:''}
    </tr>`;
  }).join('');

  el.innerHTML = `<div class="card">
    <h2>${esc(tyLabel)}</h2>
    <div class="ytd-stats">
      <div class="ytd-stat"><div class="ov-label">Total Take-Home</div><div class="ov-value">${fmt(totTH)}</div></div>
      <div class="ytd-stat"><div class="ov-label">Total Outgoings</div><div class="ov-value">${fmt(totOut)}</div></div>
      <div class="ytd-stat"><div class="ov-label">Total Free Money</div><div class="ov-value ${totFree>=0?'positive':'negative'}">${(totFree<0?'−':'')+fmt(Math.abs(totFree))}</div></div>
      ${totMi>0?`<div class="ytd-stat"><div class="ov-label">Total Mileage</div><div class="ov-value">${totMi.toLocaleString('en-GB')} mi</div><div class="ov-sub">${fmt(totMileVal)} claimed</div></div>`:''}
    </div>
    <div class="ytd-table-wrap"><table class="ytd-table">
      <thead><tr><th>Month</th><th>Take-Home</th><th>Outgoings</th><th>Free Money</th>${totMi>0?'<th>Miles</th>':''}</tr></thead>
      <tbody>${tableRows}</tbody>
      <tfoot><tr><td>Total</td><td>${fmt(totTH)}</td><td>${fmt(totOut)}</td><td class="${totFree>=0?'positive':'negative'}">${(totFree<0?'−':'')+fmt(Math.abs(totFree))}</td>${totMi>0?`<td>${totMi}</td>`:''}</tr></tfoot>
    </table></div>
  </div>`;
}

// ── Collapsible sections (Part 7) ─────────────────────────────────────────────
export function toggleDsSection(key) {
  const sec = $('ds-'+key); if (!sec) return;
  const body  = sec.querySelector('.dash-section-body');
  const chev  = sec.querySelector('.ds-chevron');
  const isCollapsed = body.classList.toggle('collapsed');
  chev?.classList.toggle('rotated', isCollapsed);
  state.collapsedSections[key] = isCollapsed;
  try { localStorage.setItem('section_collapsed', JSON.stringify(state.collapsedSections)); } catch(e) {}
  updateCollapseAllLink();
}

function restoreCollapsedState(order) {
  [...(order||DEFAULT_ORDER), 'history'].forEach(key => {
    const sec  = $('ds-'+key); if (!sec) return;
    const body = sec.querySelector('.dash-section-body');
    const chev = sec.querySelector('.ds-chevron');
    if (state.collapsedSections[key]) {
      body?.classList.add('collapsed');
      chev?.classList.add('rotated');
    }
  });
}

function updateCollapseAllLink() {
  const link = $('dash-collapseall-link'); if (!link) return;
  const allSecs = document.querySelectorAll('#dashboard-screen .dash-section-body');
  const anyExpanded = [...allSecs].some(b => !b.classList.contains('collapsed'));
  link.textContent = anyExpanded ? 'Collapse all' : 'Expand all';
}

function initCollapseAll() {
  // Already wired via window._dashCollapseAll
}

window._toggleDsSection = toggleDsSection;
window._dashCollapseAll = () => {
  const allSecs = document.querySelectorAll('#dashboard-screen .dash-section-body');
  const anyExpanded = [...allSecs].some(b => !b.classList.contains('collapsed'));
  document.querySelectorAll('#dashboard-screen .dash-section').forEach(sec => {
    const key  = sec.dataset.section;
    const body = sec.querySelector('.dash-section-body');
    const chev = sec.querySelector('.ds-chevron');
    if (anyExpanded) {
      body?.classList.add('collapsed'); chev?.classList.add('rotated');
      if (key) { state.collapsedSections[key] = true; }
    } else {
      body?.classList.remove('collapsed'); chev?.classList.remove('rotated');
      if (key) { state.collapsedSections[key] = false; }
    }
  });
  try { localStorage.setItem('section_collapsed', JSON.stringify(state.collapsedSections)); } catch(e) {}
  updateCollapseAllLink();
};

// ── Widget customise panel (Part 5) ──────────────────────────────────────────
let _dragSrc = null;

export function openCustomise() {
  const widgets = state.dashWidgets || { ...DEFAULT_WIDGETS };
  const order   = state.dashOrder   || [...DEFAULT_ORDER];
  const panel = $('customise-panel'); if (!panel) return;

  const listItems = order.map((key, i) => {
    const on = widgets[key] !== false;
    return `<div class="cw-item" data-key="${key}" draggable="true">
      <i class="ti ti-grip-vertical cw-grip"></i>
      <label class="cw-label">
        <input type="checkbox" class="cw-check" data-key="${key}" ${on?'checked':''}>
        <span>${esc(WIDGET_LABELS[key]||key)}</span>
      </label>
    </div>`;
  }).join('');

  $('cw-list').innerHTML = listItems;
  panel.classList.add('open');
  initCustomiseDrag();
}

export function closeCustomise() {
  const panel = $('customise-panel'); if (!panel) return;
  panel.classList.remove('open');
  saveWidgetSettings();
}

export function saveWidgetSettings() {
  const items = document.querySelectorAll('#cw-list .cw-item');
  const newOrder = [...items].map(el => el.dataset.key);
  const newWidgets = {};
  items.forEach(el => {
    const key = el.dataset.key;
    const cb  = el.querySelector('.cw-check');
    newWidgets[key] = cb ? cb.checked : true;
  });
  state.dashWidgets = newWidgets;
  state.dashOrder   = newOrder;
  if (state.currentUser) {
    setDoc(doc(db,'users',state.currentUser.uid,'settings','dashboard'),
      { widgets: newWidgets, order: newOrder }, { merge: true }).catch(()=>{});
  }
  renderDashboard();
  toast('Dashboard updated');
}

function initCustomiseDrag() {
  const list = $('cw-list'); if (!list) return;
  list.addEventListener('dragstart', e => {
    const item = e.target.closest('.cw-item'); if (!item) return;
    _dragSrc = item; item.classList.add('dragging');
  });
  list.addEventListener('dragend', e => {
    const item = e.target.closest('.cw-item'); if (!item) return;
    item.classList.remove('dragging'); _dragSrc = null;
  });
  list.addEventListener('dragover', e => {
    e.preventDefault();
    const item = e.target.closest('.cw-item');
    if (!item || item === _dragSrc) return;
    const rect = item.getBoundingClientRect();
    const mid  = rect.top + rect.height / 2;
    if (e.clientY < mid) list.insertBefore(_dragSrc, item);
    else list.insertBefore(_dragSrc, item.nextSibling);
  });
}

// ── Window globals ────────────────────────────────────────────────────────────
window._openCustomise  = openCustomise;
window._closeCustomise = closeCustomise;
window._saveCWSettings = saveWidgetSettings;
