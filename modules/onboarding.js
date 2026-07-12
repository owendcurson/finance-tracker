import { state } from './state.js';
import { $, fmt, toast } from './utils.js';
import { SAVINGS_CATS, ACCOUNT_GROUPS } from './constants.js';
import { cTax, cNI, gPA } from './tax.js';

// ── Onboarding wizard (new user flow) ────────────────────────────────────────
let obStep = 1;
const OB_STEPS = 4;

export function initOnboarding() {
  if (!state.isNewUser) return;
  state.isNewUser = false;
  obStep = 1;
  _populateObPayday();
  showObStep(1);
  $('onboarding-modal')?.classList.add('open');
}

function _populateObPayday() {
  const sel = $('ob-payday'); if (!sel || sel.options.length > 1) return;
  sel.innerHTML = '';
  for (let i = 1; i <= 28; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i + (i===1||i===21?'st':i===2||i===22?'nd':i===3||i===23?'rd':'th');
    if (i === (state.payDay || 23)) opt.selected = true;
    sel.appendChild(opt);
  }
}

export function closeOnboarding() {
  $('onboarding-modal')?.classList.remove('open');
  if (state.obSalary > 0) applyOnboardingData();
}

function showObStep(n) {
  obStep = n;
  for (let i=1;i<=OB_STEPS;i++) {
    const el=$('ob-step-'+i); if(el) el.style.display=(i===n?'block':'none');
  }
  const progEl=$('ob-progress'); if(progEl) progEl.textContent=`${n} / ${OB_STEPS}`;
  const prevBtn=$('ob-prev'); if(prevBtn) prevBtn.style.display=n>1?'inline-flex':'none';
  const nextBtn=$('ob-next'); if(nextBtn) nextBtn.textContent=n===OB_STEPS?'Finish':'Next';
}

export function obNext() {
  if (obStep === 1) {
    const sal = parseFloat($('ob-salary')?.value)||0;
    state.obSalary = sal;
    if (sal>0) {
      const th = (sal/12) - cTax(sal)/12 - cNI(sal)/12 + gPA(sal)/12 * 0 - 0;
      const takeHome = (sal - cTax(sal) - cNI(sal)) / 12;
      $('ob-takehome-preview').textContent = fmt(takeHome) + '/month estimated';
    }
  }
  if (obStep === 2) {
    const pd = parseInt($('ob-payday')?.value)||23;
    state.payDay = pd;
    localStorage.setItem('finance_payDay', pd);
    import('./payday.js').then(m => m.initBH());
  }
  if (obStep === OB_STEPS) { closeOnboarding(); return; }
  showObStep(obStep + 1);
}

export function obPrev() {
  if (obStep > 1) showObStep(obStep - 1);
}

function applyOnboardingData() {
  if (state.obSalary > 0) {
    const sal = $('salary'); if (sal) sal.value = state.obSalary;
    import('./tracker.js').then(m => m._calc?.());
  }
  if (state.obPots.length > 0) {
    state.pots = state.obPots.map((p,i) => ({ id:i+1, name:p.name, amount:p.amount, account:p.account, target:p.target||0 }));
    import('./pots.js').then(m => m.renderPots());
  }
}

export function obAddPot() {
  const name   = $('ob-pot-name')?.value.trim();
  const amount = parseFloat($('ob-pot-amount')?.value)||0;
  if (!name) return;
  state.obPots.push({ name, amount, account:'', target:0 });
  const nameEl=$('ob-pot-name'); if(nameEl)nameEl.value='';
  const amtEl=$('ob-pot-amount'); if(amtEl)amtEl.value='';
  renderObPotList();
}

function renderObPotList() {
  const el=$('ob-pot-list'); if(!el)return;
  el.innerHTML=state.obPots.map((p,i)=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)"><span>${p.name}</span><span style="display:flex;gap:8px;align-items:center">${fmt(p.amount)}<button class="btn btn-danger" onclick="window._obRemovePot(${i})">×</button></span></div>`).join('');
}

window._obNext      = obNext;
window._obPrev      = obPrev;
window._closeOnboarding = closeOnboarding;
window._obAddPot    = obAddPot;
window._obRemovePot = i => { state.obPots.splice(i,1); renderObPotList(); };
