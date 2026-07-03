import { state } from './state.js';
import { MF } from './constants.js';
import { cTax, cNI } from './tax.js';

// ── Interactive demo / sample data ────────────────────────────────────────────
const DEMO_MONTHS = [
  { year:2025, month:2, salary:38000, takeHome:2480, outgoings:1850, freeMoney:630, mileage:0, pots:[{name:'Rent',amount:900,account:'Rent'},{name:'Groceries',amount:350,account:'Groceries'},{name:'Netflix',amount:18,account:'Netflix'},{name:'Savings',amount:300,account:'General Savings'},{name:'Fuel',amount:120,account:'Fuel'},{name:'Gym',amount:45,account:'Gym Membership'},{name:'Eating Out',amount:117,account:'Eating Out'}] },
  { year:2025, month:3, salary:38000, takeHome:2480, outgoings:1920, freeMoney:560, mileage:0, pots:[{name:'Rent',amount:900,account:'Rent'},{name:'Groceries',amount:380,account:'Groceries'},{name:'Netflix',amount:18,account:'Netflix'},{name:'Savings',amount:300,account:'General Savings'},{name:'Fuel',amount:150,account:'Fuel'},{name:'Gym',amount:45,account:'Gym Membership'},{name:'Eating Out',amount:127,account:'Eating Out'}] },
  { year:2025, month:4, salary:38000, takeHome:2480, outgoings:1800, freeMoney:680, mileage:0, pots:[{name:'Rent',amount:900,account:'Rent'},{name:'Groceries',amount:330,account:'Groceries'},{name:'Netflix',amount:18,account:'Netflix'},{name:'Savings',amount:300,account:'General Savings'},{name:'Fuel',amount:110,account:'Fuel'},{name:'Gym',amount:45,account:'Gym Membership'},{name:'Eating Out',amount:97,account:'Eating Out'}] },
];

export function loadDemo() {
  if (!confirm('Load sample data? This will replace your current data.')) return;
  state.financeHistory = DEMO_MONTHS.map((m,i) => ({ ...m, id: Date.now()+i, label: MF[m.month]+' '+m.year, payDate: new Date(m.year,m.month,23).toLocaleDateString('en-GB'), payDateLong: new Date(m.year,m.month,23).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) }));
  import('./tracker.js').then(m => m.saveLocal());
  import('./dashboard.js').then(m => m.renderDashboard());
}

export function clearDemo() {
  if (!confirm('Clear all data?')) return;
  state.financeHistory = [];
  import('./tracker.js').then(m => m.saveLocal());
  import('./dashboard.js').then(m => m.renderDashboard());
}

window._loadDemo  = loadDemo;
window._clearDemo = clearDemo;

// ── Splash screen interactive demo ───────────────────────────────────────────
let demoPots = [{ name:'Rent', amount:800 }, { name:'Food', amount:300 }, { name:'Subscriptions', amount:50 }];

function demoFmt(n) {
  return '£' + Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function demoCalcTax() {
  const salEl = document.getElementById('demo-salary');
  const el    = document.getElementById('demo-tax-breakdown');
  if (!salEl || !el) return;
  const sal = parseFloat(salEl.value) || 0;
  const mG  = sal / 12;
  const mT  = cTax(sal) / 12;
  const mN  = cNI(sal)  / 12;
  const th  = mG - mT - mN;
  el.innerHTML =
    `<div><span>Monthly gross</span><span>${demoFmt(mG)}</span></div>` +
    `<div class="demo-deduct"><span>Income tax</span><span>−${demoFmt(mT)}</span></div>` +
    `<div class="demo-deduct"><span>National Insurance</span><span>−${demoFmt(mN)}</span></div>` +
    `<div class="demo-total"><span>Monthly take-home</span><span>${demoFmt(th)}</span></div>`;
}

function demoCalcPots() {
  const salEl = document.getElementById('demo-salary');
  const el    = document.getElementById('demo-pots-summary');
  if (!salEl || !el) return;
  const sal = parseFloat(salEl.value) || 0;
  const th  = (sal - cTax(sal) - cNI(sal)) / 12;
  const tp  = demoPots.reduce((s, p) => s + (p.amount || 0), 0);
  const fr  = th - tp;
  el.innerHTML =
    `<div><span>Total outgoings</span><span>${demoFmt(tp)}</span></div>` +
    `<div class="demo-total ${fr >= 0 ? 'demo-green' : 'demo-red'}"><span>Free money</span><span>${fr < 0 ? '−' : ''}${demoFmt(fr)}</span></div>`;
}

function demoRenderPots() {
  const el = document.getElementById('demo-pots-list');
  if (!el) return;
  el.innerHTML = demoPots.map((p, i) =>
    `<div class="demo-pot-row">` +
    `<input class="demo-input" type="text" value="${p.name.replace(/"/g,'&quot;')}" placeholder="Pot name" oninput="window._demoUpdPot(${i},'name',this.value)">` +
    `<input class="demo-input" type="number" value="${p.amount}" placeholder="£" oninput="window._demoUpdPot(${i},'amount',parseFloat(this.value)||0)">` +
    `</div>`
  ).join('');
  demoCalcPots();
}

function demoShowSummary() {
  const salEl = document.getElementById('demo-salary');
  const el    = document.getElementById('demo-summary');
  if (!salEl || !el) return;
  const sal = parseFloat(salEl.value) || 0;
  const th  = (sal - cTax(sal) - cNI(sal)) / 12;
  const tp  = demoPots.reduce((s, p) => s + (p.amount || 0), 0);
  const fr  = th - tp;
  el.innerHTML =
    `<div><span>Monthly take-home</span><span>${demoFmt(th)}</span></div>` +
    `<div><span>Total outgoings</span><span>${demoFmt(tp)}</span></div>` +
    `<div class="demo-total ${fr >= 0 ? 'demo-green' : 'demo-red'}"><span>Free money</span><span>${fr < 0 ? '−' : ''}${demoFmt(fr)}</span></div>`;
}

function demoGoStep(n) {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById(`demo-step-${i}`);
    if (el) el.classList.toggle('active', i === n);
  }
  if (n === 2) demoRenderPots();
  if (n === 3) demoShowSummary();
}

window._demoUpdPot = (i, f, v) => { demoPots[i][f] = v; demoCalcPots(); };

export function initSplashDemo() {
  const scrollBtn   = document.getElementById('demo-scroll-btn');
  const salaryEl    = document.getElementById('demo-salary');
  const next1       = document.getElementById('demo-next-1');
  const back2       = document.getElementById('demo-back-2');
  const next2       = document.getElementById('demo-next-2');
  const addPot      = document.getElementById('demo-add-pot');
  const signupBtn   = document.getElementById('demo-signup-btn');
  const restartBtn  = document.getElementById('demo-restart-btn');

  if (!scrollBtn) return;

  scrollBtn.addEventListener('click', () => {
    document.getElementById('demo-section')?.scrollIntoView({ behavior:'smooth' });
  });
  if (salaryEl)   salaryEl.addEventListener('input', demoCalcTax);
  if (next1)      next1.addEventListener('click', () => demoGoStep(2));
  if (back2)      back2.addEventListener('click', () => demoGoStep(1));
  if (next2)      next2.addEventListener('click', () => demoGoStep(3));
  if (addPot)     addPot.addEventListener('click', () => {
    if (demoPots.length < 6) { demoPots.push({ name:'', amount:0 }); demoRenderPots(); }
  });
  if (signupBtn)  signupBtn.addEventListener('click', () => {
    window.scrollTo({ top:0, behavior:'smooth' });
    setTimeout(() => document.getElementById('tab-signup')?.click(), 400);
  });
  if (restartBtn) restartBtn.addEventListener('click', () => {
    demoPots = [{ name:'Rent', amount:800 }, { name:'Food', amount:300 }, { name:'Subscriptions', amount:50 }];
    if (salaryEl) salaryEl.value = 32000;
    demoGoStep(1);
    demoCalcTax();
  });

  demoCalcTax();
}
