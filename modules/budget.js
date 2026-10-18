import { state } from './state.js';
import { $ } from './utils.js';

const fmt = v => '£' + Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STORE_KEY = 'finance_budget';

function loadPlan() {
  try {
    const r = localStorage.getItem(STORE_KEY);
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}

function savePlan(plan) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(plan)); } catch {}
}

// Match a budget category against pot names from history
function getActuals(catName) {
  const recent = state.financeHistory.slice(0, 6);
  return recent.map(h => {
    const pot = h.pots?.find(p => p.name?.toLowerCase().trim() === catName.toLowerCase().trim());
    return { label: MONTHS[h.month] + ' ' + h.year, amount: pot ? pot.amount : null };
  });
}

export function showBudget() {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  const screen = $('budget-screen');
  if (!screen) return;
  screen.style.display = 'block';
  const hb = $('header-back'); if (hb) hb.style.display = 'inline-flex';
  import('./ui.js').then(m => m.setBottomNav('dashboard'));
  render();
}

function render() {
  const el = document.getElementById('budget-content');
  if (!el) return;
  const plan = loadPlan();

  const rows = plan.map((cat, i) => {
    const actuals = getActuals(cat.name);
    const recent = actuals.find(a => a.amount !== null);
    const diff = recent ? recent.amount - cat.target : null;
    const diffStr = diff === null ? '-'
      : diff > 0 ? `<span style="color:var(--red)">+${fmt(diff)} over</span>`
      : diff < 0 ? `<span style="color:var(--green)">${fmt(Math.abs(diff))} under</span>`
      : `<span style="color:var(--green)">On target</span>`;

    const actCols = actuals.slice(0, 3).map(a =>
      `<td style="text-align:right;font-size:0.82rem">${a.amount !== null ? fmt(a.amount) : '<span style="color:var(--border)">-</span>'}</td>`
    ).join('');

    return `<tr>
      <td style="font-weight:600">${cat.name}</td>
      <td style="text-align:right">
        <div class="input-wrap" style="width:110px;margin-left:auto">
          <span class="prefix">£</span>
          <input type="number" class="has-prefix" value="${cat.target}" min="0" step="10"
            onchange="window._budgetUpdateTarget(${i}, this.value)" style="padding:5px 6px">
        </div>
      </td>
      ${actCols}
      <td style="text-align:right;font-size:0.85rem">${diffStr}</td>
      <td style="text-align:right">
        <button class="btn-icon" onclick="window._budgetRemove(${i})" title="Remove" style="color:var(--text-secondary);background:none;border:none;cursor:pointer;font-size:1.1rem"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`;
  }).join('');

  const totalTarget = plan.reduce((s, c) => s + (c.target || 0), 0);
  const lastTH = state.financeHistory[0]?.takeHome || 0;
  const pctOfTH = lastTH > 0 ? ((totalTarget / lastTH) * 100).toFixed(0) : null;

  const recentMonths = state.financeHistory.slice(0, 3).map(h => MONTHS[h.month] + ' ' + h.year);
  const actHeaders = recentMonths.map(m => `<th style="text-align:right;font-size:0.8rem;color:var(--text-secondary)">${m}</th>`).join('');

  el.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:0.85rem;color:var(--text-secondary)">Total monthly budget</div>
          <div style="font-size:1.6rem;font-weight:700">${fmt(totalTarget)}</div>
          ${pctOfTH ? `<div style="font-size:0.82rem;color:var(--text-secondary)">${pctOfTH}% of last take-home</div>` : ''}
        </div>
        <button class="btn btn-primary" onclick="window._budgetAdd()">+ Add category</button>
      </div>
    </div>

    ${plan.length ? `
    <div class="card">
      <h2 style="margin-bottom:14px">Budget vs Actuals</h2>
      <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:14px">
        Actuals are matched to your pots by category name. Make sure pot names match your budget categories exactly.
      </p>
      <div style="overflow-x:auto">
        <table class="ty-table">
          <thead><tr>
            <th>Category</th><th style="text-align:right">Monthly Target</th>
            ${actHeaders}
            <th style="text-align:right">vs Last Month</th>
            <th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="border-top:2px solid var(--border)">
            <td style="font-weight:700">Total</td>
            <td style="text-align:right;font-weight:700">${fmt(totalTarget)}</td>
            <td colspan="${recentMonths.length + 2}"></td>
          </tr></tfoot>
        </table>
      </div>
    </div>` : `
    <div class="card" style="text-align:center;padding:36px 20px">
      <i class="ti ti-target" style="font-size:2.5rem;color:var(--border);display:block;margin-bottom:12px"></i>
      <p style="font-weight:600;margin-bottom:6px">No budget categories yet</p>
      <p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:20px">Add categories that match your pot names to track spending against targets.</p>
      <button class="btn btn-primary" onclick="window._budgetAdd()">+ Add your first category</button>
    </div>`}

    <div id="budget-add-form" style="display:none" class="card" style="margin-top:12px">
      <h2 style="margin-bottom:14px">New Category</h2>
      <div class="field">
        <label>Category name (match your pot name exactly)</label>
        <input type="text" id="budget-new-name" placeholder="e.g. Groceries">
      </div>
      <div class="field">
        <label>Monthly target</label>
        <div class="input-wrap"><span class="prefix">£</span><input type="number" id="budget-new-target" class="has-prefix" placeholder="0" min="0" step="10"></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <button class="btn btn-primary" onclick="window._budgetSaveNew()">Add category</button>
        <button class="btn btn-secondary" onclick="window._budgetCancelNew()">Cancel</button>
      </div>
    </div>
  `;

  if (plan.length) {
    const addBtn = el.querySelector('button[onclick="window._budgetAdd()"]');
    const form = document.getElementById('budget-add-form');
    if (form) form.style.marginTop = '12px';
  }
}

window._budgetAdd = () => {
  const form = document.getElementById('budget-add-form');
  if (form) { form.style.display = 'block'; form.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
};
window._budgetCancelNew = () => {
  const form = document.getElementById('budget-add-form');
  if (form) form.style.display = 'none';
};
window._budgetSaveNew = () => {
  const name = document.getElementById('budget-new-name')?.value?.trim();
  const target = parseFloat(document.getElementById('budget-new-target')?.value) || 0;
  if (!name) { alert('Enter a category name'); return; }
  const plan = loadPlan();
  plan.push({ name, target });
  savePlan(plan);
  render();
};
window._budgetRemove = (i) => {
  const plan = loadPlan();
  plan.splice(i, 1);
  savePlan(plan);
  render();
};
window._budgetUpdateTarget = (i, val) => {
  const plan = loadPlan();
  if (plan[i]) plan[i].target = parseFloat(val) || 0;
  savePlan(plan);
};
