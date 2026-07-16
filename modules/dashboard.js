import { state } from './state.js';
import { $, esc, fmt, toast, emptyState } from './utils.js';
import { MF, MS, GREETINGS, DEFAULT_LAYOUT, WIDGET_LABELS, WIDGET_MIN, LAYOUT_PRESETS } from './constants.js';
import { db, doc, setDoc } from './firebase.js';
import { getPD, getNextPD, movedReason, taxYearStart, inTaxYear } from './payday.js';
import { renderCharts, renderSavingsChart, initChartObserver, attachChartTypeListeners } from './charts.js';
import { renderInsights } from './insights.js';
import { renderAchievements } from './achievements.js';
import { renderDashHistory, buildHistoryFilters, initHistoryControls } from './history.js';
import { hideSkeleton, showSkeleton, initBackToTop, setBottomNav } from './ui.js';

const SECTION_TITLES = {
  countdown:'Payday Countdown', overview:'Overview', takehome:'Monthly Take-Home Pay',
  breakdown:'Spending Breakdown', stacked:'Spending by Category', free:'Free Money Trend',
  savings:'Savings Goals', ytd:'Year-to-Date Summary', insights:'Spending Insights', achievements:'Achievements',
};

const COL_OPTIONS = [
  { cols:3, label:'¼ width' }, { cols:4, label:'⅓ width' }, { cols:6, label:'½ width' },
  { cols:8, label:'⅔ width' }, { cols:12, label:'Full width' },
];
const ROW_OPTIONS = [
  { rows:1, label:'Small' }, { rows:2, label:'Medium' }, { rows:3, label:'Large' }, { rows:4, label:'Extra large' },
];

let _cwDragSrc    = null;
let _ddSrc        = null;
let _rpKey        = null;
let _presetPending = null;

// ── Layout helpers ────────────────────────────────────────────────────────────
export function getLayout() {
  return (state.dashLayout && state.dashLayout.length)
    ? state.dashLayout.map(w => ({ ...w }))
    : DEFAULT_LAYOUT.map(w => ({ ...w }));
}

export function saveLayout() {
  const layout = state.dashLayout || DEFAULT_LAYOUT.map(w => ({ ...w }));
  try { localStorage.setItem('dashboard_layout', JSON.stringify(layout)); } catch(e) {}
  if (state.currentUser) {
    setDoc(doc(db,'users',state.currentUser.uid,'settings','dashboardLayout'),
      { version: 1, widgets: layout }, { merge: false }).catch(() => {});
  }
}

function resizeCharts() {
  setTimeout(() => {
    [state.chartTH, state.chartSpend, state.chartFree, state.chartStacked, state.chartSavings]
      .forEach(c => { try { c?.resize(); } catch(e) {} });
  }, 50);
}

// ── Entry point ───────────────────────────────────────────────────────────────
export async function showDashboard() {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(s => s.style.display = 'none');
  const ds = $('dashboard-screen'); if (ds) ds.style.display = 'block';
  const hb = $('header-back'); if (hb) hb.style.display = 'none';
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
  const container = document.getElementById('dash-container');
  if (!container) return;
  const layout = getLayout();
  const now = new Date();
  const greeting = GREETINGS[now.getHours() % GREETINGS.length] || GREETINGS[0];
  const isEdit = !!state.dashEditMode;

  const banner = $('dash-edit-banner');
  if (banner) banner.style.display = isEdit ? 'flex' : 'none';

  let html = `<div class="dash-header" style="grid-column:1/-1">
    <div>
      <div class="dash-greeting">${esc(greeting)}</div>
      <div class="dash-date">${now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
    </div>
    <div class="dash-header-actions">
      <button class="btn btn-primary btn-sm" onclick="window._showTrackerNew()">+ New month</button>
      <a href="#" class="dash-collapseall-link" id="dash-collapseall-link" onclick="event.preventDefault();window._dashCollapseAll()">Collapse all</a>
    </div>
  </div>`;

  layout.forEach(item => {
    if (!item.visible) return;
    html += buildSection(item, isEdit);
  });

  html += buildHistorySection(isEdit);


  container.innerHTML = html;
  container.classList.toggle('dash-edit-mode', isEdit);

  renderOverview();
  renderCountdown();
  renderYTD();
  renderCharts();
  renderSavingsChart();
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 0));
  idle(() => { renderInsights(); renderAchievements(); });
  idle(() => { renderDashHistory(); buildHistoryFilters(); initHistoryControls(); });
  initChartObserver();
  attachChartTypeListeners();
  restoreCollapsedState(layout.map(w => w.id));
  updateCollapseAllLink();
  initBackToTop();
  initDashDragDrop();
  closeResizePopover();
  initSideNav();
}

function initSideNav() {
  const nav = document.getElementById('dash-sidenav');
  if (!nav || window.innerWidth < 1280) return;

  const defs = [
    { id:'ds-countdown',    label:'Payday' },
    { id:'ds-overview',     label:'Overview' },
    { id:'ds-takehome',     label:'Take-Home' },
    { id:'ds-breakdown',    label:'Spending' },
    { id:'ds-stacked',      label:'By Category' },
    { id:'ds-free',         label:'Free Money' },
    { id:'ds-savings',      label:'Savings Goals' },
    { id:'ds-ytd',          label:'Year-to-Date' },
    { id:'ds-insights',     label:'Insights' },
    { id:'ds-achievements', label:'Achievements' },
    { id:'ds-history',      label:'History' },
  ];

  const visible = defs.filter(s => document.getElementById(s.id));
  nav.innerHTML = visible.map(s =>
    `<a class="sidenav-item" href="#${s.id}" data-target="${s.id}">${s.label}</a>`
  ).join('');

  nav.querySelectorAll('.sidenav-item').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById(a.dataset.target)?.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  });

  const onScroll = () => nav.classList.toggle('sidenav-visible', window.scrollY > 160);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (!('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      nav.querySelectorAll('.sidenav-item').forEach(l => l.classList.remove('active'));
      nav.querySelector(`[data-target="${entry.target.id}"]`)?.classList.add('active');
    });
  }, { threshold: 0.25, rootMargin:'-10% 0px -50% 0px' });

  visible.forEach(s => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
}

// ── Widget HTML builders ──────────────────────────────────────────────────────
function buildSection(item, isEdit) {
  const { id, colSpan, rowSpan } = item;
  const collapsed = state.collapsedSections[id];
  const chevCls = collapsed ? ' rotated' : '';
  const bodyCls = collapsed ? ' collapsed' : '';
  const editCls = isEdit ? ' dash-edit-widget' : '';

  let inner = '';
  switch (id) {
    case 'countdown':    inner = `<div id="dash-countdown"></div>`; break;
    case 'overview':     inner = `<div id="dash-overview"></div>`; break;
    case 'takehome':     inner = `<div class="chart-card-full"><div class="chart-card-header"><h3>Monthly Take-Home Pay</h3><div class="chart-type-ctrl-wrap"></div></div><canvas id="chart-takehome"></canvas></div>`; break;
    case 'breakdown':    inner = `<div class="chart-card"><div class="chart-type-ctrl-wrap"></div><h3>Spending Breakdown</h3><canvas id="chart-spending"></canvas></div>`; break;
    case 'stacked':      inner = `<div id="chart-stacked-wrap"><div class="chart-card-header"><h3>Spending by Category</h3><div class="chart-type-ctrl-wrap"></div></div><canvas id="chart-stacked"></canvas></div>`; break;
    case 'free':         inner = `<div class="chart-card"><div class="chart-type-ctrl-wrap"></div><h3>Free Money Trend</h3><canvas id="chart-free"></canvas></div>`; break;
    case 'savings':      inner = `<div id="dash-savings"></div>`; break;
    case 'ytd':          inner = `<div id="dash-ytd"></div>`; break;
    case 'insights':     inner = `<div id="dash-insights"></div>`; break;
    case 'achievements': inner = `<div id="dash-achievements"></div>`; break;
    default: return '';
  }

  const dragH = isEdit ? `<span class="ds-drag-handle" title="Drag to reorder"><i class="ti ti-grip-vertical"></i></span>` : '';
  const resizeH = isEdit ? `<button class="ds-resize-handle" data-key="${id}" onclick="event.stopPropagation();window._openResizePopover('${id}',this)" title="Resize widget"><i class="ti ti-arrows-maximize"></i></button>` : '';

  return `<div class="dash-section${editCls}" data-section="${id}" id="ds-${id}"
      style="grid-column:span ${colSpan};grid-row:span ${rowSpan}"${isEdit?' draggable="true"':''}>
    <div class="dash-section-hdr" onclick="window._toggleDsSection('${id}')">
      <div class="dsh-left">${dragH}<span>${esc(SECTION_TITLES[id]||id)}</span></div>
      <i class="ti ti-chevron-down ds-chevron${chevCls}"></i>
    </div>
    <div class="dash-section-body${bodyCls}">${inner}</div>
    ${resizeH}
  </div>`;
}

function buildHistorySection(isEdit) {
  const editCls = isEdit ? ' dash-edit-widget' : '';
  return `<div class="dash-section${editCls}" data-section="history" id="ds-history"
      style="grid-column:span 12;grid-row:span 2">
    <div class="dash-section-hdr" onclick="window._toggleDsSection('history')">
      <div class="dsh-left"><span>Monthly History</span></div>
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
}

// ── Count-up animation for overview values ───────────────────────────────────
function _animateOverviewValues(container) {
  container.querySelectorAll('.overview-card .ov-value').forEach(el => {
    const raw = el.textContent.trim();
    const isNeg = raw.startsWith('−');
    const num = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (isNaN(num) || num === 0) return;
    const dur = 800, t0 = performance.now();
    const savedClass = el.className;
    const update = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const v = num * ease;
      el.className = savedClass;
      el.textContent = (isNeg ? '−' : '') + '£' + v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (p < 1) requestAnimationFrame(update);
      else el.textContent = raw;
    };
    requestAnimationFrame(update);
  });
}

// ── Overview ──────────────────────────────────────────────────────────────────
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
  const freeNeg = (latest.freeMoney||0) < 0;
  el.innerHTML = `<div class="overview-grid">
    <div class="overview-card">
      <div class="ov-glow"></div>
      <i class="ti ti-wallet ov-ico"></i>
      <i class="ti ti-wallet ov-bg-ico"></i>
      <div class="ov-label">LATEST TAKE-HOME</div>
      <div class="ov-value">${fmt(latest.takeHome||0)}</div>
      <div class="ov-sub">${esc(MF[latest.month]+' '+latest.year)}</div>
    </div>
    <div class="overview-card${freeNeg?' ov-negative':''}">
      <div class="ov-glow"></div>
      <i class="ti ti-pig-money ov-ico"></i>
      <i class="ti ti-pig-money ov-bg-ico"></i>
      <div class="ov-label">FREE MONEY</div>
      <div class="ov-value ${freeClass}">${freeFmt}</div>
      <div class="ov-sub">${(latest.freeMoney||0)>=0?'Under budget':'Over budget'}</div>
    </div>
    <div class="overview-card">
      <div class="ov-glow"></div>
      <i class="ti ti-credit-card ov-ico"></i>
      <i class="ti ti-credit-card ov-bg-ico"></i>
      <div class="ov-label">OUTGOINGS</div>
      <div class="ov-value">${fmt(latest.outgoings||0)}</div>
      <div class="ov-sub">This month</div>
    </div>
    ${avgFree !== null ? `<div class="overview-card">
      <div class="ov-glow"></div>
      <i class="ti ti-trending-up ov-ico"></i>
      <i class="ti ti-trending-up ov-bg-ico"></i>
      <div class="ov-label">AVG FREE MONEY</div>
      <div class="ov-value ${avgFree>=0?'positive':'negative'}">${(avgFree<0?'−':'')+fmt(Math.abs(avgFree))}</div>
      <div class="ov-sub">All time avg</div>
    </div>` : ''}
    ${(latest.mileage||0)>0?`<div class="overview-card">
      <div class="ov-glow"></div>
      <i class="ti ti-car ov-ico"></i>
      <i class="ti ti-car ov-bg-ico"></i>
      <div class="ov-label">MILEAGE THIS MONTH</div>
      <div class="ov-value">${fmt(latest.mileage)}</div>
      <div class="ov-sub">${latest.miles||0} miles @ 55p</div>
    </div>`:''}
  </div>`;
  _animateOverviewValues(el);
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

  let countdownDays, countdownLabel, countdownSub;
  if (daysToThis > 0) {
    countdownDays = daysToThis;
    countdownLabel = daysToThis === 1 ? 'day until payday' : 'days until payday';
    countdownSub = thisPD.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  } else if (daysToThis === 0) {
    countdownDays = 0;
    countdownLabel = 'Payday today!'; countdownSub = 'Enjoy your pay day 🎉';
  } else {
    countdownDays = daysToNext;
    countdownLabel = daysToNext === 1 ? 'day until next payday' : 'days until next payday';
    countdownSub = nextPD.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  }

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
      <div class="period-labels"><span>Pay period progress</span><span>${Math.round(progress)}% through</span></div>
      <div class="progress-track"><div class="progress-fill ${progClass}" style="width:${progress}%"></div></div>
    </div>
  </div>`;
}

// ── YTD ───────────────────────────────────────────────────────────────────────
export function renderYTD() {
  const el = $('dash-ytd'); if (!el) return;
  if (!state.financeHistory.length) { el.innerHTML=''; return; }
  const start = taxYearStart(new Date());
  const months = state.financeHistory.filter(h => inTaxYear(h, start));
  if (!months.length) { el.innerHTML=''; return; }
  const sorted = months.slice().sort((a,b)=>new Date(a.year,a.month)-new Date(b.year,b.month));
  const totTH  = sorted.reduce((s,h)=>s+(h.takeHome||0),0);
  const totOut = sorted.reduce((s,h)=>s+(h.outgoings||0),0);
  const totFree= sorted.reduce((s,h)=>s+(h.freeMoney||0),0);
  const totMi  = sorted.reduce((s,h)=>s+(h.togMileage?(h.miles||0):0),0);
  const totMileVal=sorted.reduce((s,h)=>s+(h.mileage||0),0);
  const year = start.getFullYear();
  const tyLabel = `${year}/${String(year+1).slice(2)} Tax Year`;

  const tableRows = sorted.map(h => {
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

// ── Collapse / expand ─────────────────────────────────────────────────────────
export function toggleDsSection(key) {
  const sec = $('ds-'+key); if (!sec) return;
  const body = sec.querySelector('.dash-section-body');
  const chev = sec.querySelector('.ds-chevron');
  const isCollapsed = body.classList.toggle('collapsed');
  chev?.classList.toggle('rotated', isCollapsed);
  state.collapsedSections[key] = isCollapsed;
  try { localStorage.setItem('section_collapsed', JSON.stringify(state.collapsedSections)); } catch(e) {}
  updateCollapseAllLink();
}

function restoreCollapsedState(order) {
  [...(order||[]), 'history'].forEach(key => {
    const sec  = $('ds-'+key); if (!sec) return;
    const body = sec.querySelector('.dash-section-body');
    const chev = sec.querySelector('.ds-chevron');
    if (state.collapsedSections[key]) {
      body?.classList.add('collapsed'); chev?.classList.add('rotated');
    }
  });
}

function updateCollapseAllLink() {
  const link = $('dash-collapseall-link'); if (!link) return;
  const allSecs = document.querySelectorAll('#dashboard-screen .dash-section-body');
  const anyExpanded = [...allSecs].some(b => !b.classList.contains('collapsed'));
  link.textContent = anyExpanded ? 'Collapse all' : 'Expand all';
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
      if (key) state.collapsedSections[key] = true;
    } else {
      body?.classList.remove('collapsed'); chev?.classList.remove('rotated');
      if (key) state.collapsedSections[key] = false;
    }
  });
  try { localStorage.setItem('section_collapsed', JSON.stringify(state.collapsedSections)); } catch(e) {}
  updateCollapseAllLink();
};

// ── Edit mode ─────────────────────────────────────────────────────────────────
export function toggleEditMode() {
  state.dashEditMode = !state.dashEditMode;
  renderDashboard();
}
window._toggleEditMode = toggleEditMode;

// ── Dashboard drag-and-drop (edit mode only) ──────────────────────────────────
function initDashDragDrop() {
  if (!state.dashEditMode) return;
  const container = document.getElementById('dash-container');
  if (!container) return;

  container.addEventListener('dragstart', e => {
    const sec = e.target.closest('.dash-section[draggable]');
    if (!sec) return;
    _ddSrc = sec;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sec.dataset.section || '');
    setTimeout(() => { if (_ddSrc) _ddSrc.style.opacity = '0.4'; }, 0);
  });

  container.addEventListener('dragend', () => {
    if (_ddSrc) { _ddSrc.style.opacity = ''; _ddSrc = null; }
    document.querySelectorAll('.ds-drag-over').forEach(el => el.classList.remove('ds-drag-over'));
    saveDashboardOrder();
  });

  container.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!_ddSrc) return;
    const sec = e.target.closest('.dash-section:not([style*="opacity: 0.4"])');
    if (!sec || sec === _ddSrc || !sec.dataset.section) return;
    document.querySelectorAll('.ds-drag-over').forEach(el => el.classList.remove('ds-drag-over'));
    sec.classList.add('ds-drag-over');
    const rect = sec.getBoundingClientRect();
    if (e.clientY < rect.top + rect.height / 2) {
      container.insertBefore(_ddSrc, sec);
    } else {
      container.insertBefore(_ddSrc, sec.nextSibling);
    }
  });

  container.addEventListener('drop', e => { e.preventDefault(); });
}

function saveDashboardOrder() {
  const secs = document.querySelectorAll('#dash-container .dash-section[data-section]');
  const layout = getLayout();
  const map = new Map(layout.map(w => [w.id, w]));
  const newLayout = [];
  secs.forEach(el => {
    const id = el.dataset.section;
    if (id && map.has(id)) newLayout.push(map.get(id));
  });
  layout.forEach(w => { if (!newLayout.find(x => x.id === w.id)) newLayout.push(w); });
  state.dashLayout = newLayout;
  saveLayout();
}

// ── Resize popover ────────────────────────────────────────────────────────────
function ensureResizePopover() {
  if ($('resize-popover')) return;
  const div = document.createElement('div');
  div.id = 'resize-popover';
  div.className = 'resize-popover';
  div.style.display = 'none';
  div.innerHTML = `
    <div class="rp-title">Resize widget</div>
    <div class="rp-group">
      <div class="rp-group-label">Width</div>
      <div class="rp-btns" id="rp-col-btns">
        ${COL_OPTIONS.map(o=>`<button data-cols="${o.cols}">${o.label}</button>`).join('')}
      </div>
    </div>
    <div class="rp-group">
      <div class="rp-group-label">Height</div>
      <div class="rp-btns" id="rp-row-btns">
        ${ROW_OPTIONS.map(o=>`<button data-rows="${o.rows}">${o.label}</button>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(div);
  document.addEventListener('click', e => {
    const pop = $('resize-popover');
    if (pop && pop.style.display !== 'none' &&
        !pop.contains(e.target) && !e.target.closest('.ds-resize-handle')) {
      closeResizePopover();
    }
  }, true);
}

export function openResizePopover(id, triggerEl) {
  ensureResizePopover();
  const pop = $('resize-popover'); if (!pop) return;
  _rpKey = id;
  const layout = getLayout();
  const item = layout.find(w => w.id === id) || { colSpan: 12, rowSpan: 1 };
  const min = WIDGET_MIN[id] || { minCols: 3, minRows: 1 };

  pop.querySelectorAll('[data-cols]').forEach(btn => {
    const c = parseInt(btn.dataset.cols);
    btn.disabled = c < min.minCols;
    btn.classList.toggle('active', c === item.colSpan);
    btn.onclick = () => { setWidgetSize(id, c, null); closeResizePopover(); };
  });
  pop.querySelectorAll('[data-rows]').forEach(btn => {
    const r = parseInt(btn.dataset.rows);
    btn.disabled = r < min.minRows;
    btn.classList.toggle('active', r === item.rowSpan);
    btn.onclick = () => { setWidgetSize(id, null, r); closeResizePopover(); };
  });

  pop.style.display = 'block';
  const rect = triggerEl.getBoundingClientRect();
  const popW = pop.offsetWidth || 220;
  const popH = pop.offsetHeight || 180;
  let top  = rect.top - popH - 8;
  let left = rect.right - popW;
  if (top < 8) top = rect.bottom + 8;
  if (left < 8) left = 8;
  if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
  pop.style.top  = top  + 'px';
  pop.style.left = left + 'px';
}

function closeResizePopover() {
  const pop = $('resize-popover');
  if (pop) pop.style.display = 'none';
  _rpKey = null;
}

function setWidgetSize(id, colSpan, rowSpan) {
  const layout = getLayout();
  const item = layout.find(w => w.id === id);
  if (!item) return;
  if (colSpan !== null) item.colSpan = colSpan;
  if (rowSpan !== null) item.rowSpan = rowSpan;
  state.dashLayout = layout;
  const el = $('ds-' + id);
  if (el) {
    el.style.gridColumn = `span ${item.colSpan}`;
    el.style.gridRow    = `span ${item.rowSpan}`;
  }
  saveLayout();
  resizeCharts();
}

window._openResizePopover = openResizePopover;

// ── Presets panel ─────────────────────────────────────────────────────────────
export function openPresetsPanel() {
  const panel = $('presets-panel'); if (!panel) return;
  _presetPending = null;
  const listEl = $('pp-list');
  const confirmEl = $('pp-confirm');
  if (listEl) listEl.style.display = 'block';
  if (confirmEl) confirmEl.style.display = 'none';
  panel.style.display = 'flex';
}

export function closePresetsPanel() {
  const panel = $('presets-panel'); if (!panel) return;
  panel.style.display = 'none';
  _presetPending = null;
}

export function requestPreset(name) {
  _presetPending = name;
  const listEl = $('pp-list');
  const confirmEl = $('pp-confirm');
  if (listEl) listEl.style.display = 'none';
  if (confirmEl) {
    confirmEl.style.display = 'block';
    const msg = confirmEl.querySelector('.pp-confirm-msg');
    const preset = LAYOUT_PRESETS[name];
    if (msg && preset) msg.textContent = `Apply "${preset.label}" layout? This replaces your current layout.`;
  }
}

export function confirmPreset() {
  if (!_presetPending) return;
  const preset = LAYOUT_PRESETS[_presetPending];
  if (!preset) return;
  const newLayout = _presetPending === 'default'
    ? DEFAULT_LAYOUT.map(w => ({ ...w }))
    : preset.widgets.map(w => ({ ...w }));
  state.dashLayout = newLayout;
  saveLayout();
  closePresetsPanel();
  renderDashboard();
  toast(`${preset.label} layout applied`);
}

window._openPresetsPanel  = openPresetsPanel;
window._closePresetsPanel = closePresetsPanel;
window._requestPreset     = requestPreset;
window._confirmPreset     = confirmPreset;
window._cancelPreset      = () => {
  _presetPending = null;
  const listEl = $('pp-list');
  const confirmEl = $('pp-confirm');
  if (listEl) listEl.style.display = 'block';
  if (confirmEl) confirmEl.style.display = 'none';
};

const CW_SIZE_OPTIONS = [
  { cols: 3,  label: '¼' },
  { cols: 6,  label: '½' },
  { cols: 8,  label: '⅔' },
  { cols: 12, label: 'Full' },
];

// ── Customise panel (visibility + order + size) ────────────────────────────────
export function openCustomise() {
  const layout = getLayout();
  const panel = $('customise-panel'); if (!panel) return;

  const listItems = layout.map(item => {
    const sizeBtns = CW_SIZE_OPTIONS.map(o =>
      `<button class="cw-size-btn${item.colSpan===o.cols?' active':''}" data-cols="${o.cols}">${o.label}</button>`
    ).join('');
    return `<div class="cw-item" data-key="${item.id}" draggable="true">
      <i class="ti ti-grip-vertical cw-grip"></i>
      <label class="cw-label">
        <input type="checkbox" class="cw-check" data-key="${item.id}" ${item.visible?'checked':''}>
        <span>${esc(WIDGET_LABELS[item.id]||item.id)}</span>
      </label>
      <div class="cw-size-btns">${sizeBtns}</div>
    </div>`;
  }).join('');

  $('cw-list').innerHTML = listItems;
  panel.classList.add('open');
  initCustomiseDrag();
}

export function closeCustomise() {
  const panel = $('customise-panel'); if (!panel) return;
  panel.classList.remove('open');
}

export function saveWidgetSettings() {
  const items = document.querySelectorAll('#cw-list .cw-item');
  const layout = getLayout();
  const map = new Map(layout.map(w => [w.id, w]));
  const newLayout = [];
  items.forEach(el => {
    const id = el.dataset.key;
    const cb = el.querySelector('.cw-check');
    const activeSize = el.querySelector('.cw-size-btn.active');
    const colSpan = activeSize ? parseInt(activeSize.dataset.cols) : (map.get(id)?.colSpan || 12);
    const existing = map.get(id) || { id, colSpan: 12, rowSpan: 1, visible: true };
    newLayout.push({ ...existing, colSpan, visible: cb ? cb.checked : true });
  });
  layout.forEach(w => { if (!newLayout.find(x => x.id === w.id)) newLayout.push(w); });
  state.dashLayout = newLayout;
  saveLayout();
  closeCustomise();
  renderDashboard();
  toast('Dashboard updated');
}

export function resetLayout() {
  if (!confirm('Reset to default layout? Your current widget sizes and order will be lost.')) return;
  state.dashLayout = DEFAULT_LAYOUT.map(w => ({ ...w }));
  try { localStorage.removeItem('dashboard_layout'); } catch(e) {}
  saveLayout();
  closeCustomise();
  renderDashboard();
  toast('Layout reset to default');
}

function initCustomiseDrag() {
  const list = $('cw-list'); if (!list) return;
  list.addEventListener('click', e => {
    const btn = e.target.closest('.cw-size-btn');
    if (!btn) return;
    btn.closest('.cw-size-btns')?.querySelectorAll('.cw-size-btn')
      .forEach(b => b.classList.toggle('active', b === btn));
  });
  list.addEventListener('dragstart', e => {
    const item = e.target.closest('.cw-item'); if (!item) return;
    _cwDragSrc = item; item.classList.add('dragging');
  });
  list.addEventListener('dragend', e => {
    const item = e.target.closest('.cw-item'); if (!item) return;
    item.classList.remove('dragging'); _cwDragSrc = null;
  });
  list.addEventListener('dragover', e => {
    e.preventDefault();
    const item = e.target.closest('.cw-item');
    if (!item || item === _cwDragSrc) return;
    const rect = item.getBoundingClientRect();
    if (e.clientY < rect.top + rect.height / 2) list.insertBefore(_cwDragSrc, item);
    else list.insertBefore(_cwDragSrc, item.nextSibling);
  });
}

window._openCustomise  = openCustomise;
window._closeCustomise = closeCustomise;
window._saveCWSettings = saveWidgetSettings;
window._resetLayout    = resetLayout;
