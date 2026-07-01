import { state } from './state.js';
import { $, esc, fmt } from './utils.js';
import { ACCOUNT_GROUPS, ALL_ACCOUNTS, ACCT_TO_GROUP } from './constants.js';

export function buildCatOpts(sel) {
  let o = `<option value="">No account</option><option value="Direct Payment"${sel==='Direct Payment'?' selected':''}>Direct Payment</option>`;
  ACCOUNT_GROUPS.forEach(g => {
    o += `<optgroup label="${esc(g[0])}">`;
    g[1].forEach(a => { o += `<option value="${esc(a)}"${sel===a?' selected':''}>${esc(a)}</option>`; });
    o += '</optgroup>';
  });
  if (sel && sel !== 'Direct Payment' && ALL_ACCOUNTS.indexOf(sel) === -1) {
    o += `<optgroup label="Other"><option value="${esc(sel)}" selected>${esc(sel)}</option></optgroup>`;
  }
  return o;
}

export function potProgressHTML(amount, target) {
  if (!target || target <= 0) return '';
  const pct = amount / target * 100, w = Math.min(100, pct);
  const color = amount > target ? 'var(--red)' : pct >= 90 ? 'var(--amber)' : 'var(--green)';
  let h = `<div class="pot-progress"><div class="pot-progress-fill" style="width:${w}%;background:${color}"></div></div>`;
  if (amount > target) h += `<div class="pot-over-note">+${fmt(amount-target)} over</div>`;
  return h;
}

export function renderPots() {
  const h = state.pots.map((p, i) =>
    `<div class="pot-row">
      <input type="text" placeholder="Pot name" value="${esc(p.name)}" oninput="window._uP(${i},'name',this.value)">
      <div class="input-wrap"><span class="prefix">£</span>
        <input type="number" class="has-prefix" placeholder="0" min="0" step="10" value="${p.amount}" oninput="window._uP(${i},'amount',this.value)">
      </div>
      <div class="input-wrap target-wrap"><span class="prefix">£</span>
        <input type="number" class="has-prefix" placeholder="Budget" min="0" step="10" value="${p.target||''}" oninput="window._uP(${i},'target',this.value)">
      </div>
      <select onchange="window._uP(${i},'account',this.value)">${buildCatOpts(p.account)}</select>
      <button class="btn btn-danger" onclick="window._rP(${i})" title="Remove">×</button>
    </div>`
  ).join('');
  $('pots-list').innerHTML = h;
}

export function addPot(n, a, ac, tg) {
  state.pots.push({ name:n||'', amount:a||'', account:ac||'', target:tg||'' });
}
export function removePot(i) { state.pots.splice(i, 1); }
export function updatePot(i, f, v) { state.pots[i][f] = v; }

// window globals for inline event handlers
window._uP = (i, f, v) => { updatePot(i, f, v); import('./tracker.js').then(m => m.calc()); };
window._rP = (i) => { removePot(i); renderPots(); import('./tracker.js').then(m => m.calc()); };
