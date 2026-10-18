import { state } from './state.js';
import { $ } from './utils.js';

const fmt = v => '£' + Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STORE_KEY = 'finance_col';

const CATS = ['Housing','Transport','Food','Utilities','Subscriptions','Insurance','Childcare','Other'];

function load() {
  try { const r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function save(items) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(items)); } catch {}
}

export function showCOL() {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  const screen = $('col-screen');
  if (!screen) return;
  screen.style.display = 'block';
  const hb = $('header-back'); if (hb) hb.style.display = 'inline-flex';
  import('./ui.js').then(m => m.setBottomNav('dashboard'));
  render();
}

function render() {
  const el = document.getElementById('col-content');
  if (!el) return;
  const items = load();

  const total = items.reduce((s, i) => s + (i.amount || 0), 0);
  const lastTH = state.financeHistory[0]?.takeHome || 0;
  const pct = lastTH > 0 ? (total / lastTH * 100) : 0;
  const breathing = lastTH - total;

  const byCategory = CATS.map(cat => {
    const catItems = items.filter(i => i.category === cat);
    const catTotal = catItems.reduce((s, i) => s + (i.amount || 0), 0);
    return catTotal > 0 ? { cat, total: catTotal } : null;
  }).filter(Boolean);

  const rows = items.map((item, i) => `
    <tr>
      <td>
        <input type="text" value="${item.name}" placeholder="Item name"
          onchange="window._colUpdateName(${i}, this.value)"
          style="width:100%;background:none;border:none;color:var(--text);font-family:inherit;font-size:0.9rem">
      </td>
      <td>
        <select onchange="window._colUpdateCat(${i}, this.value)"
          style="background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;font-size:0.82rem;padding:4px 6px">
          ${CATS.map(c => `<option ${c === item.category ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </td>
      <td>
        <div class="input-wrap" style="width:120px">
          <span class="prefix">£</span>
          <input type="number" class="has-prefix" value="${item.amount}" min="0" step="1"
            onchange="window._colUpdateAmt(${i}, this.value)" style="padding:5px 6px">
        </div>
      </td>
      <td>
        <button onclick="window._colRemove(${i})" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);font-size:1.1rem"><i class="ti ti-trash"></i></button>
      </td>
    </tr>
  `).join('');

  const catBreakdown = byCategory.map(({ cat, total: ct }) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--text-secondary)">${cat}</span>
      <strong>${fmt(ct)}</strong>
    </div>
  `).join('');

  const barWidth = Math.min(pct, 100).toFixed(1);
  const barColour = pct >= 80 ? 'var(--red)' : pct >= 60 ? 'var(--amber)' : 'var(--green)';

  el.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
        <div>
          <div style="font-size:0.85rem;color:var(--text-secondary)">Fixed monthly costs</div>
          <div style="font-size:2rem;font-weight:700">${fmt(total)}</div>
        </div>
        ${lastTH ? `<div style="text-align:right">
          <div style="font-size:0.85rem;color:var(--text-secondary)">Breathing room</div>
          <div style="font-size:1.4rem;font-weight:700;color:${breathing >= 0 ? 'var(--green)' : 'var(--red)'}">${breathing >= 0 ? '' : '−'}${fmt(Math.abs(breathing))}</div>
        </div>` : ''}
      </div>
      ${lastTH ? `
      <div style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px">
          <span>Committed spend</span><span>${pct.toFixed(0)}% of take-home</span>
        </div>
        <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden">
          <div style="width:${barWidth}%;background:${barColour};height:100%;border-radius:4px;transition:width 0.4s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-secondary);margin-top:4px">
          <span>vs last take-home ${fmt(lastTH)}</span>
        </div>
      </div>` : `<p style="font-size:0.82rem;color:var(--text-secondary);margin-top:8px">Save a month to compare against your take-home pay.</p>`}
    </div>

    ${byCategory.length ? `
    <div class="card" style="margin-bottom:12px">
      <h2 style="margin-bottom:12px">By Category</h2>
      ${catBreakdown}
    </div>` : ''}

    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <h2>Fixed Outgoings</h2>
        <button class="btn btn-primary btn-sm" onclick="window._colAdd()">+ Add item</button>
      </div>
      ${items.length ? `
      <div style="overflow-x:auto">
        <table class="ty-table">
          <thead><tr><th>Name</th><th>Category</th><th>Monthly</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="border-top:2px solid var(--border)">
            <td colspan="2" style="font-weight:700">Total</td>
            <td style="font-weight:700">${fmt(total)}</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>` : `<p style="color:var(--text-secondary);font-size:0.88rem">Add your regular fixed costs: rent, mortgage, subscriptions, utilities, to see how much of your pay is already committed each month.</p>`}
    </div>
  `;
}

window._colAdd = () => {
  const items = load();
  items.push({ name: '', category: 'Other', amount: 0 });
  save(items);
  render();
  setTimeout(() => {
    const inputs = document.querySelectorAll('#col-content table tbody tr td input[type="text"]');
    inputs[inputs.length - 1]?.focus();
  }, 50);
};
window._colRemove = (i) => { const d = load(); d.splice(i, 1); save(d); render(); };
window._colUpdateName = (i, v) => { const d = load(); if (d[i]) d[i].name = v; save(d); };
window._colUpdateCat  = (i, v) => { const d = load(); if (d[i]) d[i].category = v; save(d); render(); };
window._colUpdateAmt  = (i, v) => { const d = load(); if (d[i]) d[i].amount = parseFloat(v) || 0; save(d); render(); };
