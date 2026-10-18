import { state } from './state.js';
import { $ } from './utils.js';
import { cTax, cNI } from './tax.js';

const fmt = v => '£' + Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = v => '£' + (Math.abs(v) / 1000).toFixed(1) + 'k';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// UK tax year runs Apr 6 – Apr 5. We approximate with Apr (month 3) boundary.
function taxYearLabel(y) { return `${y}/${String(y + 1).slice(2)}`; }

function getEntryTaxYear(h) {
  // month is 0-based in the data (0=Jan, 11=Dec)
  return h.month >= 3 ? h.year : h.year - 1;
}

function getAllTaxYears() {
  const ys = new Set(state.financeHistory.map(getEntryTaxYear));
  return [...ys].sort((a, b) => b - a);
}

function getMonthsForYear(ty) {
  return state.financeHistory
    .filter(h => getEntryTaxYear(h) === ty)
    .sort((a, b) => {
      const ao = a.month >= 3 ? a.month - 3 : a.month + 9;
      const bo = b.month >= 3 ? b.month - 3 : b.month + 9;
      return ao - bo;
    });
}

// Re-derive monthly tax & NI from stored salary (annual)
function deriveMonthly(h) {
  const annual = h.salary || 0;
  const monthlyGross = annual / 12;
  const tax = cTax(annual) / 12;
  const ni  = cNI(annual)  / 12;
  const pension = h.pension?.enabled ? (h.pension.employeeCost || 0) : 0;
  const sl  = h.studentLoan?.enabled ? ((h.studentLoan.monthlyUG || 0) + (h.studentLoan.monthlyPGL || 0)) : 0;
  return { monthlyGross, tax, ni, pension, sl, takeHome: h.takeHome || 0 };
}

let _year = null;

export function showTaxYear() {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  const screen = $('tax-year-screen');
  if (!screen) return;
  screen.style.display = 'block';
  const hb = $('header-back'); if (hb) hb.style.display = 'inline-flex';
  import('./ui.js').then(m => m.setBottomNav('dashboard'));
  const years = getAllTaxYears();
  if (_year === null && years.length) _year = years[0];
  render();
}

function render() {
  const el = document.getElementById('ty-content');
  if (!el) return;
  const years = getAllTaxYears();

  if (!years.length) {
    el.innerHTML = `<div class="card" style="text-align:center;padding:40px 20px">
      <i class="ti ti-calendar-off" style="font-size:2.5rem;color:var(--border);display:block;margin-bottom:12px"></i>
      <p style="color:var(--text-secondary)">No months saved yet. Add your first month to see your tax year summary.</p>
    </div>`;
    return;
  }

  const months = getMonthsForYear(_year);
  const rows = months.map(deriveMonthly);
  const tot = rows.reduce((a, r) => ({
    gross: a.gross + r.monthlyGross,
    tax:   a.tax   + r.tax,
    ni:    a.ni    + r.ni,
    pension: a.pension + r.pension,
    sl:    a.sl    + r.sl,
    takeHome: a.takeHome + r.takeHome,
  }), { gross: 0, tax: 0, ni: 0, pension: 0, sl: 0, takeHome: 0 });

  const effectiveRate = tot.gross > 0 ? ((tot.tax + tot.ni) / tot.gross * 100).toFixed(1) : '0.0';
  const totalDeductions = tot.tax + tot.ni + tot.pension + tot.sl;

  const yearOpts = years.map(y => `<option value="${y}" ${y === _year ? 'selected' : ''}>Tax year ${taxYearLabel(y)}</option>`).join('');

  const tableRows = months.map((h, i) => {
    const r = rows[i];
    return `<tr>
      <td>${MONTHS[h.month]} ${h.year}</td>
      <td>${fmt(r.monthlyGross)}</td>
      <td style="color:var(--red)">${fmt(r.tax)}</td>
      <td style="color:var(--amber)">${fmt(r.ni)}</td>
      ${tot.pension > 0 ? `<td style="color:var(--primary)">${fmt(r.pension)}</td>` : ''}
      <td style="font-weight:700;color:var(--green)">${fmt(r.takeHome)}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <select id="ty-year-sel" onchange="window._tyYearChange(this.value)" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-family:inherit;font-size:0.9rem;cursor:pointer">
          ${yearOpts}
        </select>
        <span style="color:var(--text-secondary);font-size:0.85rem">${months.length} month${months.length !== 1 ? 's' : ''} recorded</span>
      </div>
    </div>

    <div class="metric-grid cols-4" style="margin-bottom:12px">
      <div class="metric-stat">
        <div class="stat-label">Total Gross</div>
        <div class="stat-value">${fmtK(tot.gross)}</div>
      </div>
      <div class="metric-stat">
        <div class="stat-label">Income Tax</div>
        <div class="stat-value negative">${fmtK(tot.tax)}</div>
      </div>
      <div class="metric-stat">
        <div class="stat-label">National Insurance</div>
        <div class="stat-value negative">${fmtK(tot.ni)}</div>
      </div>
      <div class="metric-stat">
        <div class="stat-label">Take-Home</div>
        <div class="stat-value positive">${fmtK(tot.takeHome)}</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <h2 style="margin-bottom:14px">Year Summary</h2>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="ty-row"><span>Total gross earned</span><strong>${fmt(tot.gross)}</strong></div>
        <div class="ty-row"><span>Income tax paid (est.)</span><strong style="color:var(--red)">−${fmt(tot.tax)}</strong></div>
        <div class="ty-row"><span>National Insurance (est.)</span><strong style="color:var(--red)">−${fmt(tot.ni)}</strong></div>
        ${tot.pension > 0 ? `<div class="ty-row"><span>Pension contributions</span><strong style="color:var(--primary)">−${fmt(tot.pension)}</strong></div>` : ''}
        ${tot.sl > 0 ? `<div class="ty-row"><span>Student loan repaid</span><strong style="color:var(--amber)">−${fmt(tot.sl)}</strong></div>` : ''}
        <div class="ty-row ty-row-total"><span>Total take-home received</span><strong style="color:var(--green)">${fmt(tot.takeHome)}</strong></div>
        <div class="ty-row" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
          <span>Effective tax + NI rate</span>
          <strong>${effectiveRate}%</strong>
        </div>
        <div class="ty-row">
          <span>Total deductions</span>
          <strong style="color:var(--text-secondary)">${fmt(totalDeductions)}</strong>
        </div>
      </div>
    </div>

    ${months.length ? `
    <div class="card">
      <h2 style="margin-bottom:14px">Monthly Breakdown</h2>
      <div style="overflow-x:auto">
        <table class="ty-table">
          <thead><tr>
            <th>Month</th><th>Gross</th><th>Tax</th><th>NI</th>
            ${tot.pension > 0 ? '<th>Pension</th>' : ''}
            <th>Take-Home</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>` : ''}
  `;
}

window._tyYearChange = (val) => {
  _year = parseInt(val);
  render();
};
