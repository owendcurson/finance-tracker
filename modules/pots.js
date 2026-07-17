import { state } from './state.js';
import { $, esc, fmt } from './utils.js';
import { ACCOUNT_GROUPS, ALL_ACCOUNTS, SAVINGS_CATS } from './constants.js';

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

// ── Savings goal helpers ──────────────────────────────────────────────────────

function isSavingsPot(p) {
  if (SAVINGS_CATS.indexOf(p.account || '') !== -1) return true;
  return (p.name || '').toLowerCase().indexOf('saving') !== -1;
}

function goalSlug(name) {
  return 'sg_' + (name||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'') || 'unnamed';
}

function isoToDisplay(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function displayToIso(s) {
  const m = (s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
}

window._goalDateChange = (i, val) => {
  const iso = displayToIso(val);
  if (iso) window._updateGoal(i, 'targetDate', iso);
};

function monthsBetween(fromDate, toIso) {
  const to = new Date(toIso);
  return (to.getFullYear() - fromDate.getFullYear()) * 12 + (to.getMonth() - fromDate.getMonth());
}

function goalPanelHTML(p, i) {
  if (!isSavingsPot(p) || !p.name) return '';
  const slug = goalSlug(p.name);
  const goal = state.savingsGoals[slug];
  const potAmount = parseFloat(p.amount) || 0;

  if (!goal) {
    return `<div class="goal-panel">
      <label class="toggle-row goal-toggle-row"><input type="checkbox" onchange="window._goalToggle(${i},this.checked)"><span class="toggle-label" style="font-size:0.85rem;color:var(--text-secondary)">Set a savings goal for this pot</span></label>
    </div>`;
  }

  const saved      = parseFloat(goal.currentSaved) || 0;
  const target     = parseFloat(goal.targetAmount) || 0;
  const remaining  = Math.max(0, target - saved);
  const pct        = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  const now        = new Date();
  const hasEnd     = goal.targetDate && new Date(goal.targetDate) > now;
  const mLeft      = hasEnd ? Math.max(0, monthsBetween(now, goal.targetDate)) : null;
  const needed     = mLeft && mLeft > 0 ? remaining / mLeft : null;
  const onTrack    = needed !== null && potAmount >= needed;

  let calcLine = '';
  if (target > 0) {
    calcLine = `<div class="goal-calc-row">`;
    calcLine += `<span>Remaining: <strong>${fmt(remaining)}</strong></span>`;
    if (needed !== null) calcLine += `<span>Needed/month: <strong>${fmt(needed)}</strong></span>`;
    if (needed !== null) calcLine += `<span class="${onTrack?'goal-on-track':'goal-behind'}">${onTrack?'On track':'Below target'}</span>`;
    calcLine += `</div>`;
    const barCol = pct >= 100 ? 'var(--green)' : onTrack ? 'var(--primary)' : 'var(--amber)';
    calcLine += `<div class="goal-progress-bar-sm"><div style="width:${pct.toFixed(1)}%;background:${barCol}"></div></div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px">${pct.toFixed(0)}% of goal</div>`;
  }

  return `<div class="goal-panel open">
    <label class="toggle-row goal-toggle-row"><input type="checkbox" checked onchange="window._goalToggle(${i},this.checked)"><span class="toggle-label" style="font-size:0.85rem;color:var(--text-secondary)">Savings goal active</span></label>
    <div class="goal-fields">
      <div class="goal-field-grid">
        <div class="field" style="margin-bottom:8px"><label style="font-size:0.8rem">Goal name</label><input type="text" placeholder="e.g. Holiday to Japan" value="${esc(goal.goalName||goal.potName)}" oninput="window._updateGoal(${i},'goalName',this.value)" style="font-size:0.85rem"></div>
        <div class="field" style="margin-bottom:8px"><label style="font-size:0.8rem">Amount already saved</label><div class="input-wrap"><span class="prefix">&pound;</span><input type="number" class="has-prefix" placeholder="0" min="0" step="10" value="${goal.currentSaved||''}" oninput="window._updateGoal(${i},'currentSaved',parseFloat(this.value)||0)" style="font-size:0.85rem"></div></div>
        <div class="field" style="margin-bottom:8px"><label style="font-size:0.8rem">Target amount</label><div class="input-wrap"><span class="prefix">&pound;</span><input type="number" class="has-prefix" placeholder="0" min="0" step="100" value="${goal.targetAmount||''}" oninput="window._updateGoal(${i},'targetAmount',parseFloat(this.value)||0)" style="font-size:0.85rem"></div></div>
        <div class="field" style="margin-bottom:8px"><label style="font-size:0.8rem">Target date <span style="font-weight:400;color:var(--text-secondary)">(DD/MM/YYYY)</span></label><input type="text" inputmode="numeric" placeholder="DD/MM/YYYY" value="${isoToDisplay(goal.targetDate||'')}" onchange="window._goalDateChange(${i},this.value)" style="width:100%;font-size:0.85rem;background:var(--input);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;color:var(--text)"></div>
      </div>
      ${calcLine}
    </div>
  </div>`;
}

// ── Pot list render ───────────────────────────────────────────────────────────

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
    </div>
    ${goalPanelHTML(p, i)}`
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

window._goalToggle = (i, enabled) => {
  const pot = state.pots[i];
  if (!pot) return;
  const potName = pot.name;
  if (!potName) { import('./tracker.js').then(m => m.calc()); renderPots(); return; }
  const slug = goalSlug(potName);
  if (enabled) {
    if (!state.savingsGoals[slug]) {
      const today = new Date().toISOString().slice(0, 10);
      state.savingsGoals[slug] = { id: slug, potName, goalName: potName, targetAmount: 0, currentSaved: 0, startDate: today, targetDate: '' };
    }
    import('./goals.js').then(m => m.saveGoal(potName, state.savingsGoals[slug])).catch(() => {});
  } else {
    delete state.savingsGoals[slug];
    import('./goals.js').then(m => m.removeGoal(potName)).catch(() => {});
  }
  try { localStorage.setItem('finance_goals', JSON.stringify(state.savingsGoals)); } catch(e) {}
  renderPots();
};

window._updateGoal = (i, field, value) => {
  const pot = state.pots[i]; if (!pot?.name) return;
  const slug = goalSlug(pot.name);
  if (state.savingsGoals[slug]) {
    state.savingsGoals[slug][field] = value;
    import('./goals.js').then(m => m.saveGoal(pot.name, state.savingsGoals[slug])).catch(() => {});
    try { localStorage.setItem('finance_goals', JSON.stringify(state.savingsGoals)); } catch(e) {}
    renderPots();
  }
};
