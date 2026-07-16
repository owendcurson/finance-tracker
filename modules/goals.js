/**
 * modules/goals.js
 * Savings goals — CRUD, Firestore sync, and dashboard rendering.
 * Goals are keyed by a slug derived from the pot name and stored under
 * users/{uid}/savingsGoals/{slug} in Firestore.
 */

import { state } from './state.js';
import { $, fmt, esc } from './utils.js';
import { db, doc, setDoc, getDocs, collection, deleteDoc } from './firebase.js';

export function goalSlug(potName) {
  return 'sg_' + (potName || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unnamed';
}

export function getGoal(potName) {
  return state.savingsGoals[goalSlug(potName)] || null;
}

export async function saveGoal(potName, data) {
  const id = goalSlug(potName);
  state.savingsGoals[id] = { ...data, id, potName };
  try { localStorage.setItem('finance_goals', JSON.stringify(state.savingsGoals)); } catch(e) {}
  if (state.currentUser) {
    setDoc(doc(db, 'users', state.currentUser.uid, 'savingsGoals', id),
      { ...data, id, potName }).catch(e => console.error('saveGoal Firestore failed:', e));
  }
}

export async function removeGoal(potName) {
  const id = goalSlug(potName);
  delete state.savingsGoals[id];
  try { localStorage.setItem('finance_goals', JSON.stringify(state.savingsGoals)); } catch(e) {}
  if (state.currentUser) {
    deleteDoc(doc(db, 'users', state.currentUser.uid, 'savingsGoals', id)).catch(() => {});
  }
}

export async function loadGoalsFS(uid) {
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'savingsGoals'));
    const goals = {};
    snap.forEach(d => { goals[d.id] = d.data(); });
    if (Object.keys(goals).length > 0) {
      state.savingsGoals = goals;
      try { localStorage.setItem('finance_goals', JSON.stringify(goals)); } catch(e) {}
    }
  } catch(e) { console.error('loadGoalsFS failed:', e); }
}

// ── Dashboard render ──────────────────────────────────────────────────────────

function monthsApart(fromDate, toIso) {
  const to = new Date(toIso);
  return (to.getFullYear() - fromDate.getFullYear()) * 12
       + (to.getMonth() - fromDate.getMonth());
}

function relDate(toIso) {
  const now = new Date();
  const m = monthsApart(now, toIso);
  if (m < 0) return `Overdue by ${Math.abs(m)} month${Math.abs(m)!==1?'s':''}`;
  if (m === 0) return 'This month';
  return `${m} month${m!==1?'s':''} away`;
}

function sparklineSVG(saved, target, startDate, targetDate) {
  const now = new Date();
  const start = startDate ? new Date(startDate) : now;
  const end   = targetDate ? new Date(targetDate) : null;
  if (!end || end <= start || target <= 0) return '';

  const totalMs  = end - start;
  const elapsedMs = Math.max(0, now - start);
  const progress = Math.min(1, elapsedMs / totalMs);
  const pctSaved = Math.min(1, saved / target);

  const w = 120, h = 36, pad = 4;
  const x1 = pad, y1 = h - pad;
  const x2 = w - pad, y2 = pad;
  const dotX = pad + progress * (w - 2 * pad);
  const dotY = h - pad - pctSaved * (h - 2 * pad);
  const midX = (x1 + x2) / 2;

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="goal-sparkline" aria-hidden="true">
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--border)" stroke-width="1.5" stroke-dasharray="3 3"/>
    <path d="M${x1},${y1} Q${midX},${y1} ${dotX},${dotY}" stroke="var(--primary)" stroke-width="1.5" fill="none"/>
    <circle cx="${dotX}" cy="${dotY}" r="3" fill="var(--primary)"/>
  </svg>`;
}

export function renderSavingsGoals() {
  const el = $('dash-savings'); if (!el) return;

  const goals = Object.values(state.savingsGoals);
  const active = goals.filter(g => (parseFloat(g.targetAmount) || 0) > 0);

  if (!active.length) {
    el.innerHTML = `<div class="card"><div class="card-header-row"><h2>Savings Goals</h2></div>
      <div class="goals-empty">
        <i class="ti ti-target" style="font-size:2rem;color:var(--text-secondary);margin-bottom:8px"></i>
        <p style="color:var(--text-secondary);margin-bottom:4px">No savings goals set.</p>
        <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:16px">Add a savings pot in the tracker and set a goal to track your progress here.</p>
        <button class="btn btn-primary btn-sm" onclick="window._showTrackerNew()">Add savings goal</button>
      </div></div>`;
    return;
  }

  const latestPots = (state.financeHistory[0]?.pots) || [];
  const potAmtByName = {};
  latestPots.forEach(p => { potAmtByName[p.name] = parseFloat(p.amount) || 0; });

  let totalMonthly = 0, totalTarget = 0;
  const now = new Date();

  const cards = active.map(g => {
    const saved   = parseFloat(g.currentSaved) || 0;
    const target  = parseFloat(g.targetAmount) || 0;
    const pct     = Math.min(100, target > 0 ? (saved / target) * 100 : 0);
    const remaining = Math.max(0, target - saved);
    const monthly = potAmtByName[g.potName] || 0;
    totalMonthly += monthly;
    totalTarget  += target;

    const hasEnd = g.targetDate && new Date(g.targetDate) > now;
    const mLeft  = hasEnd ? Math.max(0, monthsApart(now, g.targetDate)) : null;
    const needed = (mLeft && mLeft > 0) ? remaining / mLeft : null;

    let statusKey = 'on-track', statusLabel = 'On track';
    if (g.targetDate && new Date(g.targetDate) < now && pct < 100) {
      statusKey = 'overdue'; statusLabel = 'Overdue';
    } else if (pct >= 100) {
      statusKey = 'done'; statusLabel = 'Complete';
    } else if (needed !== null && monthly > 0) {
      if (monthly >= needed * 1.05)      { statusKey = 'ahead';  statusLabel = 'Ahead of schedule'; }
      else if (monthly < needed * 0.95)  { statusKey = 'behind'; statusLabel = 'Behind schedule'; }
    }

    const barColor = statusKey === 'overdue' || statusKey === 'behind'
      ? (statusKey === 'overdue' ? 'var(--red)' : 'var(--amber)')
      : 'var(--green)';

    const dateStr = g.targetDate
      ? new Date(g.targetDate).toLocaleDateString('en-GB', { month:'long', year:'numeric' }) : '';

    let projStr = '';
    if (monthly > 0 && remaining > 0) {
      const mToGo = Math.ceil(remaining / monthly);
      const proj  = new Date(now.getFullYear(), now.getMonth() + mToGo, 1);
      projStr = proj.toLocaleDateString('en-GB', { month:'long', year:'numeric' });
    }

    return `<div class="goal-card">
      <div class="goal-card-top">
        <div>
          <div class="goal-name">${esc(g.goalName || g.potName)}</div>
          ${dateStr ? `<div class="goal-date">Target: ${esc(dateStr)} <span class="goal-rel">(${esc(relDate(g.targetDate))})</span></div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <span class="goal-status goal-${statusKey}">${esc(statusLabel)}</span>
          ${sparklineSVG(saved, target, g.startDate, g.targetDate)}
        </div>
      </div>
      <div class="goal-progress-track">
        <div class="goal-progress-fill" style="width:${pct.toFixed(1)}%;background:${barColor}"></div>
      </div>
      <div class="goal-progress-labels">
        <span>${fmt(saved)} saved of ${fmt(target)}</span>
        <span>${fmt(remaining)} remaining</span>
      </div>
      <div class="goal-meta-row">
        ${monthly > 0 ? `<span>Contributing ${fmt(monthly)}/month</span>` : ''}
        ${needed !== null && monthly > 0 ? `<span>Need ${fmt(needed)}/month</span>` : ''}
        ${projStr ? `<span>Projected: ${esc(projStr)}</span>` : ''}
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="card">
    <div class="card-header-row">
      <h2>Savings Goals</h2>
    </div>
    <p class="goals-summary-line">${active.length} active goal${active.length!==1?'s':''} &middot; ${fmt(totalMonthly)}/month &middot; ${fmt(totalTarget)} total target</p>
    ${cards}
  </div>`;
}

// ── Update balances modal (shown after saving a month) ────────────────────────

export function maybeShowGoalBalancePrompt() {
  const goals = Object.values(state.savingsGoals).filter(g => (parseFloat(g.targetAmount) || 0) > 0);
  if (!goals.length) return;

  if (document.getElementById('goal-balance-modal')) return;

  const rows = goals.map(g =>
    `<div class="goal-balance-row">
      <div class="goal-balance-name">${esc(g.goalName || g.potName)}</div>
      <div class="input-wrap"><span class="prefix">&pound;</span>
        <input type="number" class="has-prefix" min="0" step="10" placeholder="0"
          value="${parseFloat(g.currentSaved) || ''}"
          data-slug="${esc(goalSlug(g.potName))}"
          style="width:120px">
      </div>
    </div>`
  ).join('');

  const modal = document.createElement('div');
  modal.id = 'goal-balance-modal';
  modal.className = 'confirm-modal-overlay';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55)';
  modal.innerHTML = `<div class="confirm-modal" style="max-width:420px;width:90%">
    <h3 style="margin-bottom:6px">Update savings balances</h3>
    <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:16px">How much have you saved in each pot so far?</p>
    <div id="goal-balance-rows" style="margin-bottom:16px">${rows}</div>
    <div class="confirm-modal-btns">
      <button class="btn btn-outline" id="goal-bal-skip">Skip</button>
      <button class="btn btn-primary" id="goal-bal-save">Save balances</button>
    </div>
  </div>`;
  document.body.appendChild(modal);

  modal.querySelector('#goal-bal-skip').addEventListener('click', () => modal.remove());
  modal.querySelector('#goal-bal-save').addEventListener('click', async () => {
    modal.querySelectorAll('input[data-slug]').forEach(inp => {
      const slug = inp.dataset.slug;
      if (state.savingsGoals[slug]) {
        state.savingsGoals[slug].currentSaved = parseFloat(inp.value) || 0;
        saveGoal(state.savingsGoals[slug].potName, state.savingsGoals[slug]).catch(() => {});
      }
    });
    try { localStorage.setItem('finance_goals', JSON.stringify(state.savingsGoals)); } catch(e) {}
    modal.remove();
    import('./dashboard.js').then(m => m.renderDashboard?.());
  });
}
