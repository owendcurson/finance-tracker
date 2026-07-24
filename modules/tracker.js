import { state } from './state.js';
import { $, fmt, esc, row, rowT, st, toast, debounce, loadScript, friendlyFsError } from './utils.js';
import { MF, MS, SL_PLANS } from './constants.js';
import { cTax, cNI, gPA, cStudentLoan, parseTaxCode, cTaxWithCode } from './tax.js';
import { getPD, getNextPD, movedReason, taxYearStart } from './payday.js';
import { os, fdl, fds, ds } from './utils.js';
import { db, doc, setDoc, deleteDoc, getDocs, collection } from './firebase.js';
import { renderPots, buildCatOpts, potProgressHTML, addPot as addPotToState } from './pots.js';
import { buildAccountsBreakdown } from './history.js';
import { addInboxItem } from './inbox.js';
import { screenEnter } from './ui.js';
import { MR } from './constants.js';

const XLSX_CDN  = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

const SCHEME_NOTES = {
  relief_at_source: 'Contributions taken from net pay. Your provider adds 20% basic rate tax relief automatically.',
  salary_sacrifice: 'Deducted from gross salary before tax and NI, reducing your taxable income.',
  net_pay: 'Deducted before income tax but after NI contributions.',
};

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

export function goStep(n, { pushUrl = true } = {}) {
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
  if (pushUrl) {
    const paths = { 1: '/new-month', 2: '/new-month/adjustments', 3: '/new-month/pots' };
    const p = paths[n] || '/new-month';
    const base = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? '' : '/finance-tracker';
    const full = base + p;
    if (location.pathname !== full) history.pushState({ path: p }, '', full);
    document.title = 'New Month — Finance Tracker';
  }
}

export function toggleSection(n) { $('sec-'+n)?.classList.toggle('open', $('tog-'+n)?.checked); }

// ── Student loan UI helpers ───────────────────────────────────────────────────
export function onSLPlan() {
  const plan = $('sl-plan')?.value;
  const row  = $('sl-pgl-row');
  if (row) row.style.display = plan === 'pgl' ? 'none' : 'flex';
}

// ── Pension UI helpers ────────────────────────────────────────────────────────
export function onPenType() {
  const type = document.querySelector('input[name="pen-contrib-type"]:checked')?.value || 'percentage_gross';
  const isFixed = type === 'fixed_monthly';
  const pctEl   = $('pen-pct-inputs');
  const fixedEl = $('pen-fixed-inputs');
  if (pctEl)   pctEl.style.display   = isFixed ? 'none' : '';
  if (fixedEl) fixedEl.style.display = isFixed ? ''     : 'none';
  if (!isFixed) {
    const note = $('pen-qe-note');
    if (note) note.style.display = type === 'percentage_qualifying' ? 'block' : 'none';
  }
}

export function onPenScheme() {
  const scheme = $('pen-scheme')?.value || 'relief_at_source';
  const note   = $('pen-scheme-note');
  if (note) note.textContent = SCHEME_NOTES[scheme] || '';
}

// ── Tax calculator ────────────────────────────────────────────────────────────
const debouncedCalc = debounce(_calc, 150);
export function calc() { debouncedCalc(); }

function _readSL() {
  const enabled = $('tog-sl')?.checked || false;
  if (!enabled) return { enabled: false, monthlyUG: 0, monthlyPGL: 0, planLabel: '', plan: 'plan2', hasPgl: false, overriding: false, overrideAmount: 0 };
  const plan        = $('sl-plan')?.value || 'plan2';
  const hasPgl      = ($('tog-sl-pgl')?.checked || false) && plan !== 'pgl';
  const overriding  = $('tog-sl-override')?.checked || false;
  const overrideAmt = parseFloat($('sl-override')?.value) || 0;

  const sal = parseFloat($('salary').value) || 0;
  let monthlyUG = 0, monthlyPGL = 0, planLabel = '';

  if (overriding && overrideAmt > 0) {
    monthlyUG  = overrideAmt;
    planLabel  = (plan === 'pgl' ? 'PGL' : `Plan ${plan.replace('plan','')}`) + ' (adjusted)';
  } else if (plan === 'pgl') {
    monthlyUG  = cStudentLoan(sal, 'pgl') / 12;
    planLabel  = 'Postgraduate Loan';
  } else {
    monthlyUG  = cStudentLoan(sal, plan) / 12;
    planLabel  = SL_PLANS[plan]?.label || `Plan ${plan.replace('plan','')}`;
    if (hasPgl) monthlyPGL = cStudentLoan(sal, 'pgl') / 12;
  }
  return { enabled, monthlyUG, monthlyPGL, planLabel, plan, hasPgl, overriding, overrideAmount: overrideAmt };
}

function _readPension(sal) {
  const enabled = $('tog-pension')?.checked || false;
  if (!enabled) return { enabled: false, monthlyContrib: 0, employeeCost: 0, employerMonthly: 0, scheme: 'relief_at_source', schemeLabel: 'Relief at source', taxableSal: sal, niSal: sal, contribType: 'percentage_gross' };
  const contribType = document.querySelector('input[name="pen-contrib-type"]:checked')?.value || 'percentage_gross';
  const penAmount   = parseFloat($('pen-amount')?.value) || 0;
  const scheme      = $('pen-scheme')?.value || 'relief_at_source';
  const monthlyGross = sal / 12;

  // Auto-enrolment qualifying earnings (April 2019 thresholds)
  const QE_LOWER = 520, QE_UPPER = 4189.17;
  const qualifying = Math.max(0, Math.min(monthlyGross, QE_UPPER) - QE_LOWER);

  let monthly = 0, employerMonthly = 0;

  if (contribType === 'fixed_monthly') {
    monthly = Math.max(0, parseFloat($('pen-fixed-employee')?.value) || 0);
    employerMonthly = Math.max(0, parseFloat($('pen-fixed-employer')?.value) || 0);
  } else {
    const base = contribType === 'percentage_qualifying' ? qualifying : monthlyGross;
    monthly = base * (penAmount / 100);
    monthly = Math.max(0, monthly);
    const empEnabled = $('tog-pen-employer')?.checked || false;
    const empPct = parseFloat($('pen-employer-pct')?.value) || 0;
    employerMonthly = empEnabled ? base * (empPct / 100) : 0;
  }

  const annual = monthly * 12;
  let taxableSal = sal, niSal = sal, employeeCost = monthly;
  let schemeLabel = 'Relief at source';
  if (scheme === 'salary_sacrifice') {
    taxableSal  = Math.max(0, sal - annual);
    niSal       = Math.max(0, sal - annual);
    schemeLabel = 'Salary sacrifice';
  } else if (scheme === 'net_pay') {
    taxableSal  = Math.max(0, sal - annual);
    schemeLabel = 'Net pay arrangement';
  } else {
    employeeCost = monthly * 0.80; // relief_at_source: employee pays 80%, provider tops up
  }

  // Legal minimum checker
  const empMin   = qualifying * 0.05;
  const erMin    = qualifying * 0.03;
  const totalMin = qualifying * 0.08;
  const empOk    = monthly >= empMin - 0.01;
  const erOk     = employerMonthly >= erMin - 0.01;
  const totalOk  = (monthly + employerMonthly) >= totalMin - 0.01;
  const legalMin = { qualifying, empMin, erMin, totalMin, empOk, erOk, totalOk };

  return { enabled, monthlyContrib: monthly, employeeCost, employerMonthly, scheme, schemeLabel, taxableSal, niSal, contribType, legalMin };
}

function _updatePenMinPanel(pen, sal) {
  const panel = $('pen-min-panel'); if (!panel) return;
  if (!pen.enabled || sal <= 0) { panel.style.display = 'none'; return; }
  const { qualifying, empMin, erMin, totalMin, empOk, erOk, totalOk } = pen.legalMin;
  if (qualifying <= 0) { panel.style.display = 'none'; return; }
  const fmtM = v => '£' + v.toFixed(2);
  const tick = ok => ok ? '<span class="pen-min-tick">&#10003;</span>' : '<span class="pen-min-cross">&#10007;</span>';
  const statusClass = totalOk ? (empOk && erOk ? 'pen-min-green' : 'pen-min-amber') : 'pen-min-red';
  const statusMsg   = totalOk
    ? (empOk && erOk ? 'Meets auto-enrolment minimums' : 'Total meets minimum but one contribution is below its individual threshold')
    : 'Below the auto-enrolment legal minimum — check with your employer';
  panel.innerHTML = `
    <div class="pen-min-header ${statusClass}">${statusMsg}</div>
    <div class="pen-min-row"><span>Qualifying earnings this month</span><span>${fmtM(qualifying)}</span></div>
    <div class="pen-min-row">${tick(empOk)}<span>Employee minimum (5%): ${fmtM(empMin)}</span><span>Yours: ${fmtM(pen.monthlyContrib)}</span></div>
    <div class="pen-min-row">${tick(erOk)}<span>Employer minimum (3%): ${fmtM(erMin)}</span><span>Yours: ${fmtM(pen.employerMonthly)}</span></div>
    <div class="pen-min-row pen-min-total">${tick(totalOk)}<span>Total minimum (8%): ${fmtM(totalMin)}</span><span>Total: ${fmtM(pen.monthlyContrib + pen.employerMonthly)}</span></div>
    <div class="pen-min-link"><a href="https://www.gov.uk/workplace-pensions/what-you-your-employer-and-the-government-pay" target="_blank" rel="noopener">Learn more at gov.uk/workplace-pensions</a></div>`;
  panel.style.display = 'block';
}

// ── Tax code ──────────────────────────────────────────────────────────────────
function _readTaxCode() {
  if (!$('tog-taxcode')?.checked) return null;
  const raw = ($('tc-input')?.value || '').trim();
  if (!raw) return null;
  return state.currentTaxCode || parseTaxCode(raw);
}

export function onTaxCode() {
  const raw = ($('tc-input')?.value || '').trim().toUpperCase();
  if ($('tc-input')) $('tc-input').value = raw;
  const expEl = $('tc-explanation');
  const warnEl = $('tc-warning');
  if (!raw) {
    state.currentTaxCode = null;
    if (expEl) { expEl.style.display = 'none'; expEl.textContent = ''; }
    if (warnEl) { warnEl.style.display = 'none'; warnEl.textContent = ''; }
    _calc();
    return;
  }
  const tc = parseTaxCode(raw);
  state.currentTaxCode = tc;
  if (expEl && tc.explanation) { expEl.textContent = tc.explanation; expEl.style.display = 'block'; }
  else if (expEl) expEl.style.display = 'none';
  if (warnEl && tc.warning) {
    warnEl.innerHTML = `<i class="ti ti-alert-triangle"></i> ${tc.warning}`;
    warnEl.style.display = 'block';
  } else if (warnEl) warnEl.style.display = 'none';
  _calc();
}

function _renderTCHistory() {
  const list = $('tc-history-list'); if (!list) return;
  const hist = state.tcHistory || [];
  if (!hist.length) { list.innerHTML = ''; return; }
  list.innerHTML = hist.slice(0, 6).map((h, i) =>
    `<div class="tc-history-row">
      <input class="tc-history-input" style="width:90px;text-transform:uppercase" type="text" maxlength="12" value="${esc(h.code)}" placeholder="Code" oninput="window._tcHistoryCodeChange(${i},this.value)">
      <input class="tc-history-input" style="width:78px" type="text" maxlength="7" value="${esc(h.monthYear)}" placeholder="MM/YYYY" oninput="window._tcHistoryDateChange(${i},this.value)">
      <button class="tc-history-remove" onclick="window._removeTCHistory(${i})" aria-label="Remove">&times;</button>
    </div>`
  ).join('');
}

window._onTaxCode = onTaxCode;

window._addTCHistory = () => {
  if ((state.tcHistory || []).length >= 6) { toast('Maximum 6 previous codes'); return; }
  state.tcHistory = state.tcHistory || [];
  state.tcHistory.unshift({ code: '', monthYear: '' });
  _renderTCHistory();
};

window._removeTCHistory = (i) => {
  state.tcHistory.splice(i, 1);
  _renderTCHistory();
};

window._tcHistoryCodeChange = (i, val) => {
  if (state.tcHistory[i]) state.tcHistory[i].code = val.toUpperCase();
};

window._tcHistoryDateChange = (i, val) => {
  if (state.tcHistory[i]) state.tcHistory[i].monthYear = val;
};

function _calc() {
  const sal = parseFloat($('salary').value) || 0;
  const tE  = $('tog-expenses')?.checked;
  const tM  = $('tog-mileage')?.checked;
  const tO  = $('tog-overtime')?.checked;
  const wE  = tE ? (parseFloat($('work-expenses').value) || 0) : 0;
  const mi  = tM ? (parseFloat($('miles').value) || 0) : 0;
  const ot  = tO ? (parseFloat($('overtime').value) || 0) : 0;
  const mA  = mi * MR;
  if (tM) $('mileage-calc').innerHTML = mi.toLocaleString('en-GB') + ' miles × 55p = ' + fmt(mA);

  const tc  = _readTaxCode();
  const pen = _readPension(sal);
  const sl  = _readSL();

  // Update pension live-calc display
  const penCalcEl = $('pen-calc');
  if (penCalcEl) {
    if (pen.enabled && pen.monthlyContrib > 0) {
      let h = `<div>Your monthly contribution: <strong>${fmt(pen.monthlyContrib)}</strong>`;
      if (pen.scheme === 'relief_at_source') h += ` (your cost: <strong>${fmt(pen.employeeCost)}</strong> + ${fmt(pen.monthlyContrib - pen.employeeCost)} provider tax relief)`;
      h += '</div>';
      if (pen.employerMonthly > 0) h += `<div>Employer adds: <strong>${fmt(pen.employerMonthly)}</strong></div>`;
      const total = pen.monthlyContrib + pen.employerMonthly;
      h += `<div>Total going in: <strong>${fmt(total)}/month</strong> (${fmt(total * 12)}/year est.)</div>`;
      if (pen.scheme === 'salary_sacrifice') {
        const saving = (cTax(sal) - cTax(pen.taxableSal)) / 12 + (cNI(sal) - cNI(pen.niSal)) / 12;
        if (saving > 0) h += `<div class="calc-note">Salary sacrifice saves approx <strong>${fmt(saving)}/month</strong> in tax and NI</div>`;
      }
      penCalcEl.innerHTML = h;
      penCalcEl.style.display = 'block';
    } else {
      penCalcEl.style.display = 'none';
    }
  }
  _updatePenMinPanel(pen, sal);

  // Update student loan live-calc display
  const slCalcEl = $('sl-calc');
  if (slCalcEl && sl.enabled) {
    slCalcEl.textContent = `Estimated monthly deduction: ${fmt(sl.monthlyUG + sl.monthlyPGL)}`;
  }

  // Update PGL row visibility
  onSLPlan();

  // ── Core calculations ─────────────────────────────────────────────
  const cTaxFn = tc ? (g) => cTaxWithCode(g, tc) : cTax;
  const aT = cTaxFn(pen.taxableSal);
  const aN = cNI(pen.niSal);
  const mG = sal / 12;
  const mT = aT / 12;
  const mN = aN / 12;

  // Work expenses reduce taxable income further (applied on top of pension)
  const adjT = cTaxFn(Math.max(0, pen.taxableSal - wE * 12)) / 12;
  const tS   = mT - adjT;

  // Overtime at marginal rates on effective salary
  const oT = (cTaxFn(pen.taxableSal + ot * 12) - cTaxFn(pen.taxableSal)) / 12;
  const oN = (cNI(pen.niSal  + ot * 12) - cNI(pen.niSal)) / 12;

  const fT = adjT + oT;
  const fN = mN + oN;

  const totalSL = sl.monthlyUG + sl.monthlyPGL;
  const th = mG + ot - fT - fN - pen.employeeCost - totalSL;

  state.lastTakeHome = th;
  state.lastMileage  = mA;
  // Cache for saveMonth
  state._pen = pen;
  state._sl  = sl;

  const sh = sal > 0;
  $('tax-card').style.display   = sh ? 'block' : 'none';
  $('annual-card').style.display = sh ? 'block' : 'none';

  // Monthly breakdown table
  let mh = row('Gross salary', mG);
  if (ot > 0) mh += row('Overtime / bonus', ot, 'addition');
  mh += row('Income tax', -fT, 'deduction') + row('National Insurance', -fN, 'deduction');
  if (pen.enabled && pen.employeeCost > 0) {
    mh += row(`Pension (${pen.schemeLabel.toLowerCase()})`, -pen.employeeCost, 'deduction');
    if (pen.scheme === 'relief_at_source' && pen.monthlyContrib > pen.employeeCost) {
      mh += `<tr><td class="label-secondary" style="padding-left:20px">Provider adds tax relief</td><td class="label-secondary" style="text-align:right">+${fmt(pen.monthlyContrib - pen.employeeCost)}</td></tr>`;
    }
  }
  if (sl.enabled && sl.monthlyUG > 0) mh += row(`Student loan (${sl.planLabel})`, -sl.monthlyUG, 'deduction');
  if (sl.enabled && sl.monthlyPGL > 0) mh += row('Postgraduate loan', -sl.monthlyPGL, 'deduction');
  if (wE > 0) mh += row('Tax relief on expenses', tS, 'addition');
  mh += rowT('Monthly take-home', th);
  $('monthly-table').innerHTML = mh;

  // Annual breakdown table — use pension-adjusted salaries so salary sacrifice / net pay reduce tax correctly
  const rawTax = cTaxFn(pen.taxableSal);
  const rawNI  = cNI(pen.niSal);
  const annPen = pen.enabled ? pen.employeeCost * 12 : 0;
  const annSL  = totalSL * 12;
  const eff    = sal > 0 ? ((rawTax + rawNI) / sal * 100) : 0;
  let ah = row('Gross salary', sal);
  const paDisplay = tc ? (tc.flatRate !== null ? `${(tc.flatRate*100).toFixed(0)}% flat rate (code: ${tc.raw})` : tc.noTax ? 'None (code: NT)' : `£${Math.max(0,tc.pa).toLocaleString('en-GB')} (code: ${tc.raw})`) : fmt(gPA(sal));
  ah += `<tr><td class="label-secondary">Personal allowance</td><td class="label-secondary" style="text-align:right">${paDisplay}</td></tr>`;
  ah += row('Income tax', -rawTax, 'deduction') + row('National Insurance', -rawNI, 'deduction');
  if (pen.enabled && annPen > 0) ah += row(`Pension (${pen.schemeLabel.toLowerCase()})`, -annPen, 'deduction');
  if (sl.enabled && annSL > 0)   ah += row('Student loan', -annSL, 'deduction');
  ah += rowT('Annual net pay', sal - rawTax - rawNI - annPen - annSL);
  ah += `<tr><td class="label-secondary">Effective deduction rate</td><td class="label-secondary" style="text-align:right">${eff.toFixed(1)}%</td></tr>`;
  $('annual-table').innerHTML = ah;

  renderSum(th, mA);
  saveLocal();
}

function renderSum(th, mi) {
  const tp  = state.pots.reduce((s,p) => s + (parseFloat(p.amount)||0), 0);
  const fr  = th + mi - tp;
  const pen = state._pen || { enabled: false };
  const sl  = state._sl  || { enabled: false };
  const tc  = state.currentTaxCode;
  const cTaxFn = tc ? (g) => cTaxWithCode(g, tc) : cTax;

  let h = fr >= 0
    ? `<div class="banner banner-green">${fmt(fr)} free money this month</div>`
    : `<div class="banner banner-red">${fmt(Math.abs(fr))} over budget this month</div>`;
  h += `<div class="summary-grid">${st('Take-Home Pay',fmt(th))}${st('Mileage Received',fmt(mi))}${st('Total Outgoings',fmt(tp))}${st('Free Money',(fr<0?'−':'')+fmt(Math.abs(fr)))}</div>`;
  h += `<div class="action-row"><button class="btn btn-success" id="save-month-btn">Save Month</button><button class="btn btn-amber" id="form-accounts-btn">Form Accounts</button></div>`;
  h += `<div class="card"><h3>Itemised Breakdown</h3><table class="breakdown">`;

  // Tax code info line
  if (tc && tc.raw) {
    const paStr = tc.flatRate !== null ? `${(tc.flatRate*100).toFixed(0)}% flat rate` : tc.noTax ? 'No tax' : `Personal allowance £${Math.max(0,tc.pa).toLocaleString('en-GB')}`;
    const emergencyNote = tc.isEmergency ? ' <span class="label-secondary">(emergency code)</span>' : '';
    h += `<tr><td class="label-secondary" colspan="2" style="padding-bottom:4px">Tax code: <strong>${esc(tc.raw)}</strong>${emergencyNote} — ${paStr}</td></tr>`;
  }

  // Full deduction chain from gross to take-home
  const sal = parseFloat($('salary')?.value) || 0;
  h += row('Gross salary (monthly)', sal / 12);
  const ot  = parseFloat($('overtime')?.value) || 0;
  const tSal = pen.taxableSal ?? sal;
  const nSal = pen.niSal ?? sal;
  const fT = cTaxFn(tSal) / 12 + (cTaxFn(tSal + ot*12) - cTaxFn(tSal)) / 12;
  const fN = cNI(nSal) / 12 + (cNI(nSal + ot*12) - cNI(nSal)) / 12;
  h += row('Income tax', -fT, 'deduction') + row('National Insurance', -fN, 'deduction');
  if (pen.enabled && pen.monthlyContrib > 0) {
    h += row(`Pension (${pen.schemeLabel?.toLowerCase() || ''})`, -pen.employeeCost, 'deduction');
    const relief = pen.scheme === 'relief_at_source' ? pen.monthlyContrib - pen.employeeCost : 0;
    if (relief > 0) h += `<tr><td class="label-secondary" style="padding-left:20px">+ provider tax relief</td><td class="label-secondary" style="text-align:right">+${fmt(relief)}</td></tr>`;
    if (pen.employerMonthly > 0) h += `<tr><td class="label-secondary" style="padding-left:20px">+ employer contribution</td><td class="label-secondary" style="text-align:right">+${fmt(pen.employerMonthly)}</td></tr>`;
  }
  if (sl.enabled && sl.monthlyUG > 0)  h += row(`Student loan (${sl.planLabel})`, -sl.monthlyUG, 'deduction');
  if (sl.enabled && sl.monthlyPGL > 0) h += row('Postgraduate loan', -sl.monthlyPGL, 'deduction');
  h += rowT('Net take-home pay', th);
  if (mi > 0) h += row('Mileage expenses (tax-free)', mi, 'addition');

  h += '<tr class="divider"><td colspan="2" style="font-weight:600;padding-top:12px">Outgoings</td></tr>';
  state.pots.forEach(p => {
    const a = parseFloat(p.amount)||0;
    if (p.name || a > 0) {
      let l = p.name || 'Unnamed pot';
      if (p.account) l += ` <span class="label-secondary">(${esc(p.account)})</span>`;
      const pb = potProgressHTML(a, parseFloat(p.target)||0);
      if (pb) l += `<div style="margin-top:4px">${pb}</div>`;
      h += row(l, -a, 'deduction');
    }
  });
  h += rowT('Remaining', fr) + '</table></div>';
  $('summary-section').innerHTML = h;
  $('save-month-btn')?.addEventListener('click', saveMonth);
  $('form-accounts-btn')?.addEventListener('click', openAccounts);
}

// ── Month persistence ─────────────────────────────────────────────────────────
export function saveLocal() {
  const slEnabled  = $('tog-sl')?.checked || false;
  const penEnabled = $('tog-pension')?.checked || false;
  const slPrefs = slEnabled ? {
    enabled: true,
    plan:           $('sl-plan')?.value || 'plan2',
    hasPgl:         $('tog-sl-pgl')?.checked || false,
    overriding:     $('tog-sl-override')?.checked || false,
    overrideAmount: parseFloat($('sl-override')?.value) || 0,
  } : { enabled: false };
  const contribType = document.querySelector('input[name="pen-contrib-type"]:checked')?.value || 'percentage_gross';
  const penPrefs = penEnabled ? {
    enabled:         true,
    contribType,
    amount:          parseFloat($('pen-amount')?.value) || 0,
    schemeType:      $('pen-scheme')?.value || 'relief_at_source',
    employerEnabled: $('tog-pen-employer')?.checked || false,
    employerPct:     parseFloat($('pen-employer-pct')?.value) || 0,
    fixedEmployee:   parseFloat($('pen-fixed-employee')?.value) || 0,
    fixedEmployer:   parseFloat($('pen-fixed-employer')?.value) || 0,
  } : { enabled: false };

  const tcEnabled = $('tog-taxcode')?.checked || false;
  const tcPrefs = tcEnabled ? {
    enabled: true,
    code: $('tc-input')?.value || '',
    basis: document.querySelector('input[name="tc-basis"]:checked')?.value || 'cumulative',
    history: state.tcHistory || [],
  } : { enabled: false };

  try {
    localStorage.setItem('uk-finance-tracker', JSON.stringify({
      salary: $('salary')?.value,
      togExpenses: $('tog-expenses')?.checked,
      togMileage:  $('tog-mileage')?.checked,
      togOvertime: $('tog-overtime')?.checked,
      workExpenses:$('work-expenses')?.value,
      miles:       $('miles')?.value,
      overtime:    $('overtime')?.value,
      pots: state.pots,
    }));
    localStorage.setItem('finance_sl',      JSON.stringify(slPrefs));
    localStorage.setItem('finance_pension', JSON.stringify(penPrefs));
    localStorage.setItem('finance_taxcode', JSON.stringify(tcPrefs));
  } catch(e) {}
}

export function persistHL() { try { localStorage.setItem('finance_history', JSON.stringify(state.financeHistory)); } catch(e) {} }

export function loadLocal() {
  try {
    const r = localStorage.getItem('uk-finance-tracker');
    if (r) {
      const d = JSON.parse(r);
      if (d.salary)       $('salary').value = d.salary;
      if (d.togExpenses)  { $('tog-expenses').checked = true;  toggleSection('expenses'); }
      if (d.togMileage)   { $('tog-mileage').checked  = true;  toggleSection('mileage');  }
      if (d.togOvertime)  { $('tog-overtime').checked = true;  toggleSection('overtime'); }
      if (d.workExpenses) $('work-expenses').value = d.workExpenses;
      if (d.miles)        $('miles').value = d.miles;
      if (d.overtime)     $('overtime').value = d.overtime;
      if (d.pots?.length) {
        state.pots = d.pots.map(p => ({ name:p.name||'', amount:p.amount||'', account:p.account||'', target:p.target||'' }));
        renderPots();
      }
    }
  } catch(e) {}
  // Load SL prefs
  try {
    const slRaw = localStorage.getItem('finance_sl');
    if (slRaw) { const sl = JSON.parse(slRaw); _applySLPrefs(sl); }
  } catch(e) {}
  // Load pension prefs
  try {
    const penRaw = localStorage.getItem('finance_pension');
    if (penRaw) { const pen = JSON.parse(penRaw); _applyPenPrefs(pen); }
  } catch(e) {}
  // Load tax code prefs
  try {
    const tcRaw = localStorage.getItem('finance_taxcode');
    if (tcRaw) { const tc = JSON.parse(tcRaw); _applyTCPrefs(tc); }
  } catch(e) {}
  // Load history
  try {
    const o = localStorage.getItem('uk-finance-history'), n = localStorage.getItem('finance_history');
    if (o && !n) { localStorage.setItem('finance_history', o); localStorage.removeItem('uk-finance-history'); }
    const h = localStorage.getItem('finance_history');
    if (h) state.financeHistory = JSON.parse(h);
  } catch(e) {}
}

function _applySLPrefs(sl) {
  if (!sl?.enabled) return;
  const tog = $('tog-sl'); if (!tog) return;
  tog.checked = true; toggleSection('sl');
  if ($('sl-plan') && sl.plan) $('sl-plan').value = sl.plan;
  if (sl.hasPgl && $('tog-sl-pgl')) { $('tog-sl-pgl').checked = true; }
  if (sl.overriding && $('tog-sl-override')) {
    $('tog-sl-override').checked = true; toggleSection('sl-override');
    if ($('sl-override') && sl.overrideAmount) $('sl-override').value = sl.overrideAmount;
  }
  onSLPlan();
}

function _applyPenPrefs(pen) {
  if (!pen?.enabled) return;
  const tog = $('tog-pension'); if (!tog) return;
  tog.checked = true; toggleSection('pension');
  // Backward compat: map old 'percentage' → 'percentage_gross', 'fixed' → 'fixed_monthly'
  let ct = pen.contribType || 'percentage_gross';
  if (ct === 'percentage') ct = 'percentage_gross';
  if (ct === 'fixed') ct = 'fixed_monthly';
  const radio = document.querySelector(`input[name="pen-contrib-type"][value="${ct}"]`);
  if (radio) radio.checked = true;
  onPenType();
  if ($('pen-amount') && pen.amount) $('pen-amount').value = pen.amount;
  if ($('pen-fixed-employee') && pen.fixedEmployee) $('pen-fixed-employee').value = pen.fixedEmployee;
  if ($('pen-fixed-employer') && pen.fixedEmployer) $('pen-fixed-employer').value = pen.fixedEmployer;
  if ($('pen-scheme') && pen.schemeType) { $('pen-scheme').value = pen.schemeType; onPenScheme(); }
  if (pen.employerEnabled && $('tog-pen-employer')) {
    $('tog-pen-employer').checked = true; toggleSection('pen-employer');
    if ($('pen-employer-pct') && pen.employerPct) $('pen-employer-pct').value = pen.employerPct;
  }
}

function _applyTCPrefs(tc) {
  if (!tc?.enabled) return;
  const tog = $('tog-taxcode'); if (!tog) return;
  tog.checked = true; toggleSection('taxcode');
  if (tc.code && $('tc-input')) { $('tc-input').value = tc.code; }
  if (tc.basis) {
    const rb = document.querySelector(`input[name="tc-basis"][value="${tc.basis}"]`);
    if (rb) rb.checked = true;
  }
  if (tc.history?.length) {
    state.tcHistory = tc.history;
    _renderTCHistory();
  }
  if (tc.code) onTaxCode();
}

export async function saveMonth() {
  const salRaw = parseFloat($('salary').value) || 0;
  if (salRaw === 0) { toast('Enter a salary before saving'); return; }
  if (salRaw < 0)   { toast('Salary must be a positive number'); return; }
  if (salRaw > 10_000_000) { toast('Salary looks too high — please check the value'); return; }
  const milesRaw = parseFloat($('miles').value) || 0;
  if ($('tog-mileage').checked && milesRaw > 10000) { toast('Mileage over 10,000 miles — please check the value'); return; }
  for (const pot of state.pots) {
    const a = parseFloat(pot.amount) || 0;
    if (a > 100_000) { toast(`Pot "${pot.name||'Unnamed'}" amount looks too high — please check`); return; }
    if ((parseFloat(pot.target)||0) > 100_000) { toast(`Pot "${pot.name||'Unnamed'}" target looks too high — please check`); return; }
  }

  const pen = state._pen || { enabled: false, monthlyContrib: 0, employeeCost: 0, employerMonthly: 0, scheme: 'relief_at_source', schemeLabel: '' };
  const sl  = state._sl  || { enabled: false, monthlyUG: 0, monthlyPGL: 0, planLabel: '', plan: 'plan2' };

  const sal = salRaw;
  const sm  = parseInt($('pick-month').value);
  const sy  = parseInt($('pick-year').value);
  const pr  = getPD(sy, sm);
  const tp  = state.pots.reduce((s,p) => s + (parseFloat(p.amount)||0), 0);
  const entryId = state.editingId || Date.now();
  // Use actual payday take-home if the user confirmed a different amount on payday
  const actualTH = state.paydayActualTH > 0 ? state.paydayActualTH : state.lastTakeHome;
  state.paydayActualTH = 0;

  const entry = {
    id: entryId, month: sm, year: sy,
    label: MS[sm] + ' ' + sy,
    payDate: ds(pr.payDate), payDateLong: fdl(pr.payDate),
    payDateMoved: pr.moved, payDateReason: pr.moved ? movedReason(pr.original) : '',
    payDayUsed: state.payDay, salary: sal,
    togExpenses: $('tog-expenses').checked,
    workExpenses: parseFloat($('work-expenses').value) || 0,
    togMileage: $('tog-mileage').checked,
    miles: parseFloat($('miles').value) || 0,
    togOvertime: $('tog-overtime').checked,
    overtime: parseFloat($('overtime').value) || 0,
    takeHome:  Math.round(actualTH * 100) / 100,
    mileage:   Math.round(state.lastMileage  * 100) / 100,
    outgoings: Math.round(tp * 100) / 100,
    freeMoney: Math.round((actualTH + state.lastMileage - tp) * 100) / 100,
    pots: state.pots.filter(p => p.name || (parseFloat(p.amount)||0) > 0).map(p => ({
      name: p.name || 'Unnamed', amount: parseFloat(p.amount) || 0,
      account: p.account || '', target: parseFloat(p.target) || 0,
    })),
    // Pension record
    pension: pen.enabled ? {
      enabled: true, scheme: pen.scheme, schemeLabel: pen.schemeLabel,
      monthlyContrib: Math.round(pen.monthlyContrib * 100) / 100,
      employeeCost:   Math.round(pen.employeeCost   * 100) / 100,
      employerMonthly:Math.round(pen.employerMonthly * 100) / 100,
    } : { enabled: false },
    // Student loan record
    studentLoan: sl.enabled ? {
      enabled: true, plan: sl.plan, planLabel: sl.planLabel,
      monthlyUG: Math.round(sl.monthlyUG * 100) / 100,
      monthlyPGL:Math.round(sl.monthlyPGL * 100) / 100,
    } : { enabled: false },
  };

  if (state.editingId) state.financeHistory = state.financeHistory.map(e => e.id === state.editingId ? entry : e);
  else state.financeHistory.unshift(entry);
  state.editingId = null;
  persistHL();

  // Save month to Firestore
  if (state.currentUser) {
    try { await setDoc(doc(db, 'users', state.currentUser.uid, 'months', String(entry.id)), entry); }
    catch(e) { console.error('saveMonth Firestore write failed:', e); toast(friendlyFsError(e)); }
    // Persist SL/pension/taxcode settings as preferences
    const slPrefs  = { enabled: sl.enabled, plan: sl.plan, hasPgl: sl.hasPgl, overriding: sl.overriding, overrideAmount: sl.overrideAmount };
    const ct = document.querySelector('input[name="pen-contrib-type"]:checked')?.value || 'percentage_gross';
    const penPrefs = {
      enabled: pen.enabled, contribType: ct, amount: parseFloat($('pen-amount')?.value)||0,
      schemeType: pen.scheme, employerEnabled: $('tog-pen-employer')?.checked||false,
      employerPct: parseFloat($('pen-employer-pct')?.value)||0,
      fixedEmployee: parseFloat($('pen-fixed-employee')?.value)||0,
      fixedEmployer: parseFloat($('pen-fixed-employer')?.value)||0,
    };
    const tcEnabled = $('tog-taxcode')?.checked || false;
    const tcPrefs = tcEnabled ? {
      enabled: true, code: $('tc-input')?.value || '',
      basis: document.querySelector('input[name="tc-basis"]:checked')?.value || 'cumulative',
      history: state.tcHistory || [],
    } : { enabled: false };
    setDoc(doc(db, 'users', state.currentUser.uid, 'settings', 'studentLoan'), slPrefs, { merge: true }).catch(() => {});
    setDoc(doc(db, 'users', state.currentUser.uid, 'settings', 'pension'),     penPrefs, { merge: true }).catch(() => {});
    setDoc(doc(db, 'users', state.currentUser.uid, 'settings', 'taxCode'),     tcPrefs,  { merge: true }).catch(() => {});
  }

  await addInboxItem('ti-circle-check', MF[entry.month] + ' ' + entry.year + ' saved successfully',
    (entry.freeMoney < 0 ? 'Over budget by ' : 'Free money: ') + (entry.freeMoney < 0 ? '−' : '') + fmt(Math.abs(entry.freeMoney)));
  const overPots = entry.pots.filter(p => (p.target||0) > 0 && p.amount > p.target).map(p => p.name);
  if (overPots.length) await addInboxItem('ti-alert-triangle', overPots.length + ' pot' + (overPots.length===1?'':'s') + ' went over budget this month', overPots.join(', '));

  clearTracker();
  import('./dashboard.js').then(m => m.showDashboard());
  toast('Saved ' + entry.label);

  // Prompt to update savings goal balances
  import('./goals.js').then(m => { setTimeout(() => m.maybeShowGoalBalancePrompt(), 600); });
}

export function clearTracker() {
  state.pots = []; renderPots();
  if ($('salary')) $('salary').value = '';
  if ($('work-expenses')) $('work-expenses').value = '';
  if ($('miles')) $('miles').value = '';
  if ($('overtime')) $('overtime').value = '';
  if ($('tog-expenses')) $('tog-expenses').checked = false;
  if ($('tog-mileage'))  $('tog-mileage').checked  = false;
  if ($('tog-overtime')) $('tog-overtime').checked = false;
  $('sec-expenses')?.classList.remove('open');
  $('sec-mileage')?.classList.remove('open');
  $('sec-overtime')?.classList.remove('open');
  // Student loan and pension settings are intentionally preserved between months
  state.lastTakeHome = 0; state.lastMileage = 0;
  saveLocal();
  if (state.mpInit) {
    const n = new Date(); $('pick-month').value = n.getMonth(); $('pick-year').value = n.getFullYear();
    updPD();
  }
}

export function updPD() {
  const m = parseInt($('pick-month').value), y = parseInt($('pick-year').value), r = getPD(y,m), nx = getNextPD(y,m);
  const cs = new Date(r.payDate); cs.setDate(cs.getDate()+1);
  let h = `<div class="paydate-card"><div class="paydate-header"><span class="paydate-icon">&#128197;</span><span class="paydate-title">Pay Date for ${MF[m]} ${y}</span></div><div class="paydate-date">${fdl(r.payDate)}</div>`;
  if (r.moved) h += `<div class="paydate-note">${movedReason(r.original)}. Paid ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][r.payDate.getDay()]} ${r.payDate.getDate()}${os(r.payDate.getDate())} instead</div>`;
  h += `<div class="paydate-coverage"><strong>Budget coverage:</strong> ${fds(cs)} to ${fds(nx.payDate)} <span style="color:var(--primary);font-weight:600">(${Math.round((nx.payDate-cs)/86400000)} days)</span></div></div>`;
  $('paydate-info').innerHTML = h;
}

export function initMP() {
  const msEl = $('pick-month'), ysEl = $('pick-year');
  if (!state.mpInit) {
    const now = new Date();
    for (let m=0;m<12;m++) { const o=document.createElement('option');o.value=m;o.textContent=MF[m];if(m===now.getMonth())o.selected=true;msEl.appendChild(o); }
    for (let y=2024;y<=2028;y++) { const o=document.createElement('option');o.value=y;o.textContent=y;if(y===now.getFullYear())o.selected=true;ysEl.appendChild(o); }
    state.mpInit = true;
  }
  updPD();
}

export function shiftM(d) {
  const msEl = $('pick-month'), ysEl = $('pick-year');
  let m = parseInt(msEl.value)+d, y = parseInt(ysEl.value);
  if (m>11){m=0;y++;}if(m<0){m=11;y--;}
  if(y<2024)y=2024;if(y>2028)y=2028;
  msEl.value=m; ysEl.value=y; updPD();
}

// ── Accounts modal ────────────────────────────────────────────────────────────
export function openAccounts() {
  const h = buildAccountsBreakdown(state.pots);
  $('accounts-body').innerHTML = h || '<p class="history-empty">No pots to assign.</p>';
  $('accounts-modal').classList.add('open');
}
export function closeAccounts() { $('accounts-modal').classList.remove('open'); }

// ── Load / edit from history ──────────────────────────────────────────────────
export function loadTemplate(id) {
  const h = state.financeHistory.find(e => e.id === id); if (!h) return;
  state.editingId = null; $('salary').value = h.salary;
  state.pots = h.pots.map(p => ({ name:p.name||'', amount:p.amount||'', account:p.account||'', target:p.target||'' }));
  renderPots();
  $('work-expenses').value=''; $('miles').value=''; $('overtime').value='';
  $('tog-expenses').checked=false; $('tog-mileage').checked=false; $('tog-overtime').checked=false;
  $('sec-expenses')?.classList.remove('open'); $('sec-mileage')?.classList.remove('open'); $('sec-overtime')?.classList.remove('open');
  // Restore SL/pension from template if present
  if (h.studentLoan?.enabled) _applySLPrefs({ enabled:true, plan:h.studentLoan.plan, hasPgl:false, overriding:false });
  if (h.pension?.enabled) _applyPenPrefs({ enabled:true, schemeType:h.pension.scheme });
  const now = new Date(); $('pick-month').value = now.getMonth(); $('pick-year').value = now.getFullYear(); updPD();
  $('detail-modal').classList.remove('open'); showTracker(); calc();
  const b = $('template-banner');
  b.textContent = `Template loaded from ${MF[h.month]} ${h.year}. Salary and pots ready, fill in this month's adjustments`;
  b.style.display = 'block';
  setTimeout(() => b.style.display = 'none', 8000);
}

export function editEntry(id) {
  const h = state.financeHistory.find(e => e.id === id); if (!h) return;
  state.editingId = id;
  $('detail-modal').classList.remove('open');
  showTracker();
  state.currentStep = 1; goStep(1);
  $('salary').value = h.salary;
  $('pick-month').value = h.month; $('pick-year').value = h.year; updPD();
  state.pots = h.pots.map(p => ({ name:p.name||'', amount:p.amount||'', account:p.account||'', target:p.target||'' }));
  renderPots();
  if (h.togExpenses && h.workExpenses > 0) { $('tog-expenses').checked=true; toggleSection('expenses'); $('work-expenses').value=h.workExpenses; }
  else { $('tog-expenses').checked=false; $('sec-expenses')?.classList.remove('open'); $('work-expenses').value=''; }
  if (h.togMileage && h.miles > 0) { $('tog-mileage').checked=true; toggleSection('mileage'); $('miles').value=h.miles; }
  else { $('tog-mileage').checked=false; $('sec-mileage')?.classList.remove('open'); $('miles').value=''; }
  if (h.togOvertime && h.overtime > 0) { $('tog-overtime').checked=true; toggleSection('overtime'); $('overtime').value=h.overtime; }
  else { $('tog-overtime').checked=false; $('sec-overtime')?.classList.remove('open'); $('overtime').value=''; }
  // Restore SL/pension from saved entry
  if (h.studentLoan?.enabled) _applySLPrefs({ enabled:true, plan:h.studentLoan.plan, hasPgl:false, overriding:false });
  else { if($('tog-sl')){$('tog-sl').checked=false;} $('sec-sl')?.classList.remove('open'); }
  if (h.pension?.enabled) _applyPenPrefs({ enabled:true, schemeType:h.pension.scheme });
  else { if($('tog-pension')){$('tog-pension').checked=false;} $('sec-pension')?.classList.remove('open'); }
  calc();
  const b = $('template-banner');
  b.textContent = `Editing ${MF[h.month]} ${h.year}. Make your changes then save`;
  b.style.display = 'block';
}

// ── Salary calculator ─────────────────────────────────────────────────────────
export function openSalCalc() {
  const cur = state.financeHistory.length && state.financeHistory[0].salary ? state.financeHistory[0].salary : '';
  $('salcalc-current').value = cur; $('salcalc-proposed').value = '';
  renderSalCalc(); $('salcalc-modal')?.classList.add('open');
}
export function renderSalCalc() {
  const a = parseFloat($('salcalc-current').value)||0, b = parseFloat($('salcalc-proposed').value)||0;
  const ca = _salCol(a), cb = _salCol(b);
  const dm = cb.th - ca.th, da = cb.annualNet - ca.annualNet;
  $('salcalc-result').innerHTML = `<table class="salcalc-table"><thead><tr><th></th><th>Current</th><th>Proposed</th></tr></thead><tbody><tr><td>Monthly gross</td><td>${fmt(ca.gross)}</td><td>${fmt(cb.gross)}</td></tr><tr><td>Monthly tax</td><td>${fmt(ca.tax)}</td><td>${fmt(cb.tax)}</td></tr><tr><td>Monthly NI</td><td>${fmt(ca.ni)}</td><td>${fmt(cb.ni)}</td></tr><tr><td>Monthly take-home</td><td><strong>${fmt(ca.th)}</strong></td><td><strong>${fmt(cb.th)}</strong></td></tr><tr><td>Effective deduction rate</td><td>${ca.eff.toFixed(1)}%</td><td>${cb.eff.toFixed(1)}%</td></tr><tr class="salcalc-diff"><td>Extra take-home / month</td><td colspan="2" style="text-align:right">${dm>=0?'+':'−'}${fmt(Math.abs(dm))}</td></tr><tr class="salcalc-diff"><td>Extra take-home / year</td><td colspan="2" style="text-align:right">${da>=0?'+':'−'}${fmt(Math.abs(da))}</td></tr></tbody></table>`;
}
function _salCol(sal) {
  const tax=cTax(sal),ni=cNI(sal),net=sal-tax-ni;
  return { gross:sal/12, tax:tax/12, ni:ni/12, th:net/12, eff:sal>0?((tax+ni)/sal*100):0, annualNet:net };
}

// ── Exports ───────────────────────────────────────────────────────────────────
export async function exportMonthExcel(id) {
  const h = state.financeHistory.find(e => e.id === id); if (!h) return;
  await loadScript(XLSX_CDN);
  if (!window.XLSX) { toast('Export unavailable'); return; }
  const wb = window.XLSX.utils.book_new();
  const summary = [
    ['Month', MF[h.month]+' '+h.year],['Pay date', h.payDateLong||h.payDate],
    ['Gross salary (annual)', h.salary],['Take-home', h.takeHome],
    ['Mileage', h.mileage],['Outgoings', h.outgoings],['Free money', h.freeMoney],
  ];
  if (h.pension?.enabled) summary.push(['Pension (monthly)', h.pension.employeeCost]);
  if (h.studentLoan?.enabled) summary.push(['Student loan (monthly)', (h.studentLoan.monthlyUG||0)+(h.studentLoan.monthlyPGL||0)]);
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(summary), 'Summary');
  const potRows = [['Pot','Amount','Budget','Account']];
  (h.pots||[]).forEach(p => potRows.push([p.name, p.amount, p.target||'', p.account||'']));
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(potRows), 'Pots');
  window.XLSX.writeFile(wb, 'finance-tracker-'+MS[h.month].toLowerCase()+'-'+h.year+'.xlsx');
}

export async function exportYTDExcel() {
  await loadScript(XLSX_CDN);
  if (!window.XLSX) { toast('Export unavailable'); return; }
  const { ytdMonths } = await import('./payday.js');
  const start = taxYearStart(new Date()), months = ytdMonths();
  if (!months.length) { toast('No months in this tax year'); return; }
  const wb = window.XLSX.utils.book_new();
  const sorted = months.slice().sort((a,b) => new Date(a.year,a.month)-new Date(b.year,b.month));
  const rows = [['Month','Take-Home','Mileage','Outgoings','Free Money']];
  let t = { th:0, mi:0, out:0, fr:0 };
  sorted.forEach(h => { rows.push([MF[h.month]+' '+h.year,h.takeHome,h.mileage,h.outgoings,h.freeMoney]); t.th+=h.takeHome||0;t.mi+=h.mileage||0;t.out+=h.outgoings||0;t.fr+=h.freeMoney||0; });
  rows.push(['TOTAL', t.th, t.mi, t.out, t.fr]);
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet([['Tax Year', start.getFullYear()+'/'+String(start.getFullYear()+1).slice(2)]]), 'Summary');
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(rows), 'Months');
  window.XLSX.writeFile(wb, 'finance-tracker-ytd-'+start.getFullYear()+'.xlsx');
}

export async function exportMonthPDF(id) {
  const h = state.financeHistory.find(e => e.id === id); if (!h) return;
  await loadScript(JSPDF_CDN);
  if (!window.jspdf) { toast('Export unavailable'); return; }
  const jsPDF = window.jspdf.jsPDF; const d = new jsPDF(); let y = 18;
  d.setFontSize(18); d.text('Finance Tracker: '+MF[h.month]+' '+h.year, 14, y); y+=8;
  d.setFontSize(10); d.setTextColor(120); d.text('Pay date: '+(h.payDateLong||h.payDate), 14, y); y+=10; d.setTextColor(0);
  const sec = t => { d.setFontSize(12);d.setFont(undefined,'bold');d.text(t,14,y);d.setFont(undefined,'normal');y+=6;d.setFontSize(10); };
  const line = (l,v) => { d.text(l,16,y);d.text(v,190,y,{align:'right'});y+=6; };
  sec('Pay Information');
  line('Gross salary (annual)', fmt(h.salary));
  line('Take-home pay', fmt(h.takeHome));
  if (h.mileage>0) line('Mileage (tax-free)', fmt(h.mileage));
  if (h.pension?.enabled) line(`Pension (${h.pension.schemeLabel||''})`, fmt(h.pension.employeeCost));
  if (h.studentLoan?.enabled) line(`Student loan (${h.studentLoan.planLabel||''})`, fmt((h.studentLoan.monthlyUG||0)+(h.studentLoan.monthlyPGL||0)));
  y+=2;
  sec('Income Breakdown');
  if (h.togExpenses&&h.workExpenses>0) line('Work expenses', fmt(h.workExpenses));
  if (h.togMileage&&h.miles>0) line('Business miles', h.miles+' miles');
  if (h.togOvertime&&h.overtime>0) line('Overtime / bonus', fmt(h.overtime));
  y+=2;
  sec('Pots');
  (h.pots||[]).forEach(p => { const l=p.name+(p.target?' (budget '+fmt(p.target)+')':'');line(l,fmt(p.amount));if(y>270){d.addPage();y=18;} });
  y+=2;
  sec('Summary');
  line('Total outgoings', fmt(h.outgoings));
  line('Free money', (h.freeMoney<0?'−':'')+fmt(Math.abs(h.freeMoney)));
  d.save('finance-tracker-'+MS[h.month].toLowerCase()+'-'+h.year+'.pdf');
}

// window globals
window._showTrackerNew = () => { state.editingId=null; clearTracker(); showTracker(); };
window._xlMonth        = exportMonthExcel;
window._pdfMonth       = exportMonthPDF;
window._xlYTD          = exportYTDExcel;
window._showTracker    = showTracker;
window._goStep         = goStep;
window._updPD          = updPD;
window._shiftM         = shiftM;
window._togSection     = (n) => toggleSection(n);
window._addPot         = () => { addPotToState(); renderPots(); calc(); };
window._initMP         = initMP;
window._calc           = calc;
window._onSLPlan       = onSLPlan;
window._onPenType      = onPenType;
window._onPenScheme    = onPenScheme;
