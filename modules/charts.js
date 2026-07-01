import { state } from './state.js';
import { $, fmt, esc, emptyState } from './utils.js';
import { MS } from './constants.js';
import { GROUP_COLORS, ACCOUNT_GROUPS, groupForPot } from './constants.js';
import { chartTextColor, chartGridColor, chartZeroColor } from './theme.js';

// ── Chart type segmented control (Part 3) ────────────────────────────────────
function chartTypeCtrl(key, options) {
  const cur = state.chartPrefs[key];
  const btns = options.map(([val, label, icon]) =>
    `<button class="chart-type-btn${cur===val?' active':''}" data-key="${key}" data-val="${val}" title="${label}">
      <i class="ti ${icon}"></i><span class="chart-type-label">${label}</span>
    </button>`
  ).join('');
  return `<div class="chart-type-ctrl">${btns}</div>`;
}

function setChartPref(key, val) {
  state.chartPrefs[key] = val;
  localStorage.setItem(`chart_pref_${key}`, val);
  renderCharts();
}

export function attachChartTypeListeners() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.chart-type-btn');
    if (!btn) return;
    setChartPref(btn.dataset.key, btn.dataset.val);
  });
}

// ── IntersectionObserver lazy init ────────────────────────────────────────────
let chartsRendered = false;
let chartObserver = null;

export function initChartObserver() {
  const wrap = document.querySelector('.chart-card-full');
  if (!wrap || chartsRendered) return;
  chartObserver = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) {
      renderCharts();
      chartObserver?.disconnect();
    }
  }, { threshold: 0.1 });
  chartObserver.observe(wrap);
}

// ── Main chart renderer ───────────────────────────────────────────────────────
export function renderCharts() {
  chartsRendered = true;
  const C = window.Chart;
  if (!C || !state.financeHistory.length) {
    showChartEmptyStates(); return;
  }
  const tc = chartTextColor(), gc = chartGridColor();

  // Take-home chart
  const last12 = state.financeHistory.slice(0, 12).reverse();
  const thLabels = last12.map(h => MS[h.month]+' '+String(h.year).slice(2));
  const thData   = last12.map(h => h.takeHome);
  const barColors = last12.map(h => h.freeMoney>100?'#0d904f':h.freeMoney>=0?'#e37400':'#c5221f');

  if (state.chartTH) state.chartTH.destroy();
  const thEl = $('chart-takehome');
  if (thEl) {
    const pref = state.chartPrefs.takehome;
    const ctrl = chartTypeCtrl('takehome', [['bar','Bar','ti-chart-bar'],['line','Line','ti-chart-line']]);
    thEl.closest('.chart-card-full').querySelector('.chart-type-ctrl-wrap').innerHTML = ctrl;
    if (pref === 'line') {
      state.chartTH = new C(thEl, { type:'line', data:{ labels:thLabels, datasets:[{
        data:thData, borderColor:'#1a73e8', backgroundColor:'rgba(26,115,232,0.1)',
        fill:true, tension:0.3, pointRadius:4,
      }]}, options: axisOpts(tc,gc,'£',false)});
    } else {
      state.chartTH = new C(thEl, { type:'bar', data:{ labels:thLabels, datasets:[{
        data:thData, backgroundColor:barColors, borderRadius:4,
      }]}, options: axisOpts(tc,gc,'£',false)});
    }
  }

  // Spending breakdown
  const latest = state.financeHistory[0];
  if (state.chartSpend) state.chartSpend.destroy();
  const spEl = $('chart-spending');
  if (spEl) {
    const ctrl = chartTypeCtrl('breakdown', [['doughnut','Donut','ti-chart-donut'],['bar','Bar','ti-chart-bar-off']]);
    spEl.closest('.chart-card').querySelector('.chart-type-ctrl-wrap').innerHTML = ctrl;
    if (latest.pots && latest.pots.length) {
      const colors = ['#1a73e8','#0d904f','#e37400','#c5221f','#8430ce','#00897b','#d81b60','#546e7a','#ff6d00','#2962ff'];
      const sorted = [...latest.pots].sort((a,b) => (b.amount||0) - (a.amount||0));
      if (state.chartPrefs.breakdown === 'bar') {
        state.chartSpend = new C(spEl, { type:'bar', data:{ labels:sorted.map(p=>p.name), datasets:[{
          data:sorted.map(p=>p.amount), backgroundColor:colors.slice(0,sorted.length), borderRadius:4,
        }]}, options:{ ...axisOpts(tc,gc,'£',false), indexAxis:'y' }});
      } else {
        state.chartSpend = new C(spEl, { type:'doughnut', data:{ labels:latest.pots.map(p=>p.name), datasets:[{
          data:latest.pots.map(p=>p.amount), backgroundColor:colors.slice(0,latest.pots.length),
        }]}, options:{ responsive:true, plugins:{ legend:{position:'bottom',labels:{color:tc,boxWidth:12,font:{size:11}}},
          tooltip:{callbacks:{label:c=>{const total=c.dataset.data.reduce((a,b)=>a+b,0);const pct=total>0?Math.round(c.raw/total*100):0;return c.label+': £'+c.raw.toLocaleString('en-GB',{minimumFractionDigits:2})+' ('+pct+'%)';}}}}}});
      }
    } else {
      spEl.closest('.chart-card').innerHTML = '<div class="chart-type-ctrl-wrap"></div><h3>Spending Breakdown</h3>'+emptyState('ti-chart-donut','No spending data yet','Add pots to see where your money goes.','Open tracker →','window._showTrackerNew()');
    }
  }

  // Free money
  const all = state.financeHistory.slice().reverse();
  const fLabels = all.map(h => MS[h.month]+' '+String(h.year).slice(2));
  const fData   = all.map(h => h.freeMoney);
  if (state.chartFree) state.chartFree.destroy();
  const frEl = $('chart-free');
  if (frEl) {
    const ctrl = chartTypeCtrl('free', [['line','Line','ti-chart-line'],['bar','Bar','ti-chart-bar']]);
    frEl.closest('.chart-card').querySelector('.chart-type-ctrl-wrap').innerHTML = ctrl;
    if (state.chartPrefs.free === 'bar') {
      state.chartFree = new C(frEl, { type:'bar', data:{ labels:fLabels, datasets:[{
        data:fData, backgroundColor:fData.map(v=>v>=0?'#0d904f':'#c5221f'), borderRadius:4,
      }]}, options: axisOpts(tc,gc,'£',false,true) });
    } else {
      state.chartFree = new C(frEl, { type:'line', data:{ labels:fLabels, datasets:[{
        data:fData, borderColor:'#1a73e8', backgroundColor:'rgba(26,115,232,0.1)', fill:true, tension:0.3,
        pointRadius:4, pointBackgroundColor:fData.map(v=>v>=0?'#0d904f':'#c5221f'),
      }]}, options: axisOpts(tc,gc,'£',false,true) });
    }
  }

  renderStackedChart(tc, gc);
}

function axisOpts(tc, gc, prefix, showLegend, zeroLine) {
  return {
    responsive:true,
    plugins:{ legend:{display:!!showLegend}, tooltip:{callbacks:{label:c=>'£'+c.raw.toLocaleString('en-GB',{minimumFractionDigits:2})}} },
    scales:{
      y:{ beginAtZero:!zeroLine, ticks:{color:tc,callback:v=>prefix+v.toLocaleString()},
          grid:{ color: zeroLine ? c => c.tick.value===0?chartZeroColor():gc : gc,
                 lineWidth: zeroLine ? c => c.tick.value===0?2:1 : 1 }},
      x:{ grid:{display:false}, ticks:{color:tc} }
    },
  };
}

export function renderStackedChart(tc, gc) {
  const C = window.Chart;
  const wrap = $('chart-stacked-wrap'); if (!wrap) return;
  const last12 = state.financeHistory.slice(0, 12).reverse();
  if (state.chartStacked) { state.chartStacked.destroy(); state.chartStacked = null; }
  if (last12.length < 2) {
    wrap.innerHTML = '<div class="chart-card-header"><h3>Spending by Category</h3><div class="chart-type-ctrl-wrap"></div></div><p class="history-empty">Save at least 2 months to see spending by category over time.</p>';
    return;
  }
  if (!$('chart-stacked')) wrap.innerHTML = `<div class="chart-card-header"><h3>Spending by Category</h3><div class="chart-type-ctrl-wrap"></div></div><canvas id="chart-stacked"></canvas>`;
  const labels = last12.map(h => MS[h.month]+' '+String(h.year).slice(2));
  const groupOrder = ACCOUNT_GROUPS.map(g=>g[0]); groupOrder.push('Direct Payment','Unassigned');
  const datasets = [];
  groupOrder.forEach(gn => {
    const data = last12.map(h => { let s=0; (h.pots||[]).forEach(p=>{if(groupForPot(p)===gn)s+=(parseFloat(p.amount)||0);}); return s; });
    if (data.some(v=>v>0)) datasets.push({ label:gn, data, backgroundColor:GROUP_COLORS[gn]||'#9e9e9e' });
  });
  const pref = state.chartPrefs.stacked;
  const ctrl = chartTypeCtrl('stacked', [['stacked','Stacked','ti-stack'],['grouped','Grouped','ti-chart-bar'],['line','Lines','ti-chart-line']]);
  wrap.querySelector('.chart-type-ctrl-wrap').innerHTML = ctrl;
  const stackedDS = datasets.map(d => ({ ...d }));
  if (pref === 'line') {
    state.chartStacked = new C($('chart-stacked'), { type:'line', data:{ labels, datasets: stackedDS.map(d=>({...d,fill:false,tension:0.3,pointRadius:3,backgroundColor:undefined,borderColor:d.backgroundColor})) }, options:{ responsive:true, plugins:{ legend:{position:'bottom',labels:{color:tc,boxWidth:12,font:{size:11}}}}, scales:{ y:{ ticks:{color:tc,callback:v=>'£'+v.toLocaleString()}, grid:{color:gc} }, x:{grid:{display:false},ticks:{color:tc}} }} });
  } else {
    const stacked = pref !== 'grouped';
    state.chartStacked = new C($('chart-stacked'), { type:'bar', data:{ labels, datasets: stackedDS }, options:{ responsive:true, plugins:{ legend:{position:'bottom',labels:{color:tc,boxWidth:12,font:{size:11}}}}, scales:{ x:{stacked,grid:{display:false},ticks:{color:tc}}, y:{stacked,beginAtZero:true,ticks:{color:tc,callback:v=>'£'+v.toLocaleString()},grid:{color:gc}} }} });
  }
}

export function renderSavingsChart() {
  const el = $('dash-savings'); if (!el) return;
  const monthSavings = h => { let s=0; (h.pots||[]).forEach(p=>{ if(isSavingsPot(p)) s+=(parseFloat(p.amount)||0); }); return s; };
  const any = state.financeHistory.some(h=>monthSavings(h)>0);
  if (!state.financeHistory.length || !any) {
    el.innerHTML = '<div class="card"><h2>Savings Rate</h2>'+emptyState('ti-pig-money','No savings pots found','Add a savings pot to track your savings rate over time.','Open tracker →','window._showTrackerNew()')+'</div>';
    if (state.chartSavings) { state.chartSavings.destroy(); state.chartSavings = null; } return;
  }
  const all = state.financeHistory.slice().reverse();
  const rates = all.map(h=>{ const sv=monthSavings(h),th=h.takeHome||0; return th>0?(sv/th*100):0; });
  const nonZero = rates.filter(r=>r>0);
  const cur=rates[rates.length-1]||0, avg=nonZero.length?nonZero.reduce((a,b)=>a+b,0)/nonZero.length:0, high=rates.length?Math.max(...rates):0;
  const ctrl = chartTypeCtrl('savings', [['line','Line','ti-chart-line'],['bar','Bar','ti-chart-bar']]);
  el.innerHTML = `<div class="card">
    <div class="card-header-row"><h2>Savings Rate</h2>${ctrl}</div>
    <div class="metric-grid">
      <div class="metric-stat"><div class="stat-label">Current Rate</div><div class="stat-value positive">${cur.toFixed(1)}%</div></div>
      <div class="metric-stat"><div class="stat-label">Average Rate</div><div class="stat-value">${avg.toFixed(1)}%</div></div>
      <div class="metric-stat"><div class="stat-label">Highest Rate</div><div class="stat-value positive">${high.toFixed(1)}%</div></div>
    </div>
    <canvas id="chart-savings" style="max-height:220px"></canvas></div>`;
  const C = window.Chart; if (!C) return;
  const tc=chartTextColor(), gc=chartGridColor();
  const labels = all.map(h=>MS[h.month]+' '+String(h.year).slice(2));
  if (state.chartSavings) state.chartSavings.destroy();
  const pref = state.chartPrefs.savings;
  if (pref === 'bar') {
    state.chartSavings = new C($('chart-savings'),{type:'bar',data:{labels,datasets:[{label:'Savings rate',data:rates,backgroundColor:'#0d904f',borderRadius:4},{label:'20% target',data:labels.map(()=>20),type:'line',borderColor:'#e37400',borderDash:[6,4],pointRadius:0,fill:false}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{color:tc,boxWidth:12,font:{size:11}}}},scales:{y:{beginAtZero:true,ticks:{color:tc,callback:v=>v+'%'},grid:{color:gc}},x:{grid:{display:false},ticks:{color:tc}}}}});
  } else {
    state.chartSavings = new C($('chart-savings'),{type:'line',data:{labels,datasets:[{label:'Savings rate',data:rates,borderColor:'#0d904f',backgroundColor:'rgba(13,144,79,0.1)',fill:true,tension:0.3,pointRadius:3},{label:'20% target',data:labels.map(()=>20),borderColor:'#e37400',borderDash:[6,4],pointRadius:0,fill:false}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{color:tc,boxWidth:12,font:{size:11}}}},scales:{y:{beginAtZero:true,ticks:{color:tc,callback:v=>v+'%'},grid:{color:gc}},x:{grid:{display:false},ticks:{color:tc}}}}});
  }
}

function isSavingsPot(p) {
  const SAVINGS = ['Emergency Fund','Holiday Savings','House Deposit','Car Savings','General Savings','Stocks & Shares ISA','Cash ISA','Pension Top-Up','Christmas Fund'];
  if (SAVINGS.indexOf(p.account || '') !== -1) return true;
  return (p.name || '').toLowerCase().indexOf('saving') !== -1;
}

function showChartEmptyStates() {
  const thEl = $('chart-takehome');
  if (thEl) thEl.closest('.chart-card-full').innerHTML = '<div class="chart-card-header"><h3>Monthly Take-Home Pay</h3><div class="chart-type-ctrl-wrap"></div></div>'+emptyState('ti-chart-bar','No data yet','Save your first month to see charts.','Save a month →','window._showTrackerNew()');
  const spEl = $('chart-spending');
  if (spEl) spEl.closest('.chart-card').innerHTML = '<div class="chart-type-ctrl-wrap"></div><h3>Spending Breakdown</h3>'+emptyState('ti-chart-donut','No spending data yet','Add pots to see where your money goes.','Open tracker →','window._showTrackerNew()');
  const frEl = $('chart-free');
  if (frEl) frEl.closest('.chart-card').innerHTML = '<div class="chart-type-ctrl-wrap"></div><h3>Free Money Trend</h3>'+emptyState('ti-chart-bar','No data yet','Save your first month to see your free money trend.','Save a month →','window._showTrackerNew()');
}
