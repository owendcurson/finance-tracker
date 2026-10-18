import { state } from './state.js';
import { $ } from './utils.js';

const fmt = v => '£' + Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = v => '£' + (Math.abs(v) / 1000).toFixed(1) + 'k';
const STORE_KEY = 'finance_benefits';

const PRESET_BENEFITS = [
  { name: 'Employer Pension Match', category: 'Pension', value: 0, note: 'Annual employer pension contribution' },
  { name: 'Private Health Insurance', category: 'Health', value: 0, note: 'Estimated annual cost to employer' },
  { name: 'Life Insurance', category: 'Insurance', value: 0, note: 'Death-in-service benefit value' },
  { name: 'Car Allowance', category: 'Transport', value: 0, note: 'Annual car allowance' },
  { name: 'Cycle to Work', category: 'Transport', value: 0, note: 'Annual savings via salary sacrifice' },
  { name: 'Remote Work Stipend', category: 'Other', value: 0, note: 'Annual home-working allowance' },
];

const CATS = ['Pension','Health','Insurance','Transport','Leave','Equity','Other'];

function load() {
  try {
    const r = localStorage.getItem(STORE_KEY);
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}
function save(items) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(items)); } catch {}
}

export function showBenefits() {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  const screen = $('benefits-screen');
  if (!screen) return;
  screen.style.display = 'block';
  const hb = $('header-back'); if (hb) hb.style.display = 'inline-flex';
  import('./ui.js').then(m => m.setBottomNav('dashboard'));
  render();
}

function render() {
  const el = document.getElementById('benefits-content');
  if (!el) return;
  const items = load().filter(i => i.value > 0);
  const allItems = load();
  const baseSalary = state.financeHistory[0]?.salary || 0;
  const totalBenefits = items.reduce((s, i) => s + (i.value || 0), 0);
  const totalComp = baseSalary + totalBenefits;

  const byCat = CATS.map(cat => {
    const catItems = items.filter(i => i.category === cat);
    return catItems.length ? {
      cat,
      items: catItems,
      total: catItems.reduce((s, i) => s + i.value, 0)
    } : null;
  }).filter(Boolean);

  const rows = allItems.map((item, i) => `
    <tr>
      <td>
        <input type="text" value="${item.name}" placeholder="Benefit name"
          onchange="window._benUpdateName(${i}, this.value)"
          style="width:100%;background:none;border:none;color:var(--text);font-family:inherit;font-size:0.9rem">
        ${item.note ? `<div style="font-size:0.75rem;color:var(--text-secondary)">${item.note}</div>` : ''}
      </td>
      <td>
        <select onchange="window._benUpdateCat(${i}, this.value)"
          style="background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;font-size:0.82rem;padding:4px 6px">
          ${CATS.map(c => `<option ${c === item.category ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </td>
      <td>
        <div class="input-wrap" style="width:130px">
          <span class="prefix">£</span>
          <input type="number" class="has-prefix" value="${item.value || ''}" min="0" step="100" placeholder="0"
            onchange="window._benUpdateVal(${i}, this.value)" style="padding:5px 6px">
          <span class="suffix">/yr</span>
        </div>
      </td>
      <td>
        <button onclick="window._benRemove(${i})" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);font-size:1.1rem"><i class="ti ti-trash"></i></button>
      </td>
    </tr>
  `).join('');

  const catCards = byCat.map(({ cat, items: cItems, total }) => `
    <div class="metric-stat">
      <div class="stat-label">${cat}</div>
      <div class="stat-value">${fmt(total)}/yr</div>
      ${cItems.map(i => `<div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px">${i.name}</div>`).join('')}
    </div>
  `).join('');

  el.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div class="metric-grid cols-4" style="margin-bottom:0">
        ${baseSalary ? `<div class="metric-stat">
          <div class="stat-label">Base Salary</div>
          <div class="stat-value">${fmtK(baseSalary)}/yr</div>
        </div>` : ''}
        <div class="metric-stat">
          <div class="stat-label">Benefits Value</div>
          <div class="stat-value positive">${fmtK(totalBenefits)}/yr</div>
        </div>
        ${baseSalary ? `<div class="metric-stat" style="grid-column:span 2">
          <div class="stat-label">Total Package</div>
          <div class="stat-value" style="font-size:1.4rem">${fmtK(totalComp)}/yr</div>
          ${totalBenefits > 0 ? `<div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px">Benefits add ${((totalBenefits/baseSalary)*100).toFixed(0)}% on top of salary</div>` : ''}
        </div>` : ''}
      </div>
    </div>

    ${byCat.length ? `
    <div class="card" style="margin-bottom:12px">
      <h2 style="margin-bottom:14px">By Category</h2>
      <div class="metric-grid">${catCards}</div>
    </div>` : ''}

    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <h2>Benefits &amp; Perks</h2>
        <div style="display:flex;gap:8px">
          ${allItems.length === 0 ? `<button class="btn btn-secondary btn-sm" onclick="window._benLoadPresets()">Load presets</button>` : ''}
          <button class="btn btn-primary btn-sm" onclick="window._benAdd()">+ Add</button>
        </div>
      </div>
      ${allItems.length ? `
      <div style="overflow-x:auto">
        <table class="ty-table">
          <thead><tr><th>Benefit</th><th>Category</th><th>Annual value</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
          ${totalBenefits > 0 ? `<tfoot><tr style="border-top:2px solid var(--border)">
            <td colspan="2" style="font-weight:700">Total</td>
            <td style="font-weight:700">${fmt(totalBenefits)}/yr</td>
            <td></td>
          </tr></tfoot>` : ''}
        </table>
      </div>` : `
      <p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:16px">Track the value of your employer benefits: pension contributions, health insurance, car allowance, to see your true total compensation.</p>
      <button class="btn btn-secondary" onclick="window._benLoadPresets()" style="margin-right:8px">Load common benefits</button>
      <button class="btn btn-primary" onclick="window._benAdd()">Add custom benefit</button>`}
    </div>
    ${!baseSalary ? `<p style="font-size:0.82rem;color:var(--text-secondary);text-align:center">Save a month to see total compensation vs salary.</p>` : ''}
  `;
}

window._benAdd = () => {
  const d = load();
  d.push({ name: '', category: 'Other', value: 0, note: '' });
  save(d);
  render();
  setTimeout(() => {
    const inputs = document.querySelectorAll('#benefits-content table tbody tr td input[type="text"]');
    inputs[inputs.length - 1]?.focus();
  }, 50);
};
window._benLoadPresets = () => {
  save(PRESET_BENEFITS.map(p => ({ ...p })));
  render();
};
window._benRemove = (i) => { const d = load(); d.splice(i, 1); save(d); render(); };
window._benUpdateName = (i, v) => { const d = load(); if (d[i]) d[i].name = v; save(d); };
window._benUpdateCat  = (i, v) => { const d = load(); if (d[i]) d[i].category = v; save(d); render(); };
window._benUpdateVal  = (i, v) => { const d = load(); if (d[i]) d[i].value = parseFloat(v) || 0; save(d); render(); };
