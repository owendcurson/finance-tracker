import { state } from './state.js';
import { MF } from './constants.js';

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
