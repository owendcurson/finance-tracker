import { state } from './state.js';
import { $, esc, emptyState } from './utils.js';
import { getPD } from './payday.js';

export const ACHIEVEMENTS = [
  {id:'first_step',    icon:'ti-rocket',         title:'First step',      desc:'Save your first month'},
  {id:'all_set_up',    icon:'ti-settings',        title:'All set up',      desc:'Salary, pay day &amp; 3+ pots set'},
  {id:'early_bird',    icon:'ti-sun',             title:'Early bird',      desc:'Opened the app on payday'},
  {id:'on_a_roll',     icon:'ti-calendar-check',  title:'On a roll',       desc:'3 months saved in a row'},
  {id:'committed',     icon:'ti-calendar-stats',  title:'Committed',       desc:'6 months saved in a row'},
  {id:'dedicated',     icon:'ti-trophy',          title:'Dedicated',       desc:'12 months saved in a row'},
  {id:'in_the_green',  icon:'ti-mood-smile',      title:'In the green',    desc:'First month with positive free money'},
  {id:'comfortable',   icon:'ti-mood-happy',      title:'Comfortable',     desc:'3 months positive in a row'},
  {id:'getting_better',icon:'ti-trending-up',     title:'Getting better',  desc:'Free money rising 3 months running'},
  {id:'saver',         icon:'ti-piggy-bank',      title:'Saver',           desc:'Savings rate above 10%'},
  {id:'strong_saver',  icon:'ti-star',            title:'Strong saver',    desc:'Savings rate above 20%'},
  {id:'on_fire',       icon:'ti-flame',           title:'On fire',         desc:'20%+ savings rate for 3 months'},
  {id:'first_thousand',icon:'ti-cash',            title:'First thousand',  desc:'Total take-home over £1,000'},
  {id:'ten_grand',     icon:'ti-building-bank',   title:'Ten grand',       desc:'Total take-home over £10,000'},
  {id:'road_warrior',  icon:'ti-car',             title:'Road warrior',    desc:'Mileage claimed in 3+ months'},
  {id:'miles_ahead',   icon:'ti-map-pin',         title:'Miles ahead',     desc:'500+ total miles claimed'},
  {id:'spot_on',       icon:'ti-target',          title:'Spot on',         desc:'All pots within budget for a month'},
  {id:'consistent',    icon:'ti-shield-check',    title:'Consistent',      desc:'All pots within budget 3 months'},
];

function monthSavings(h) {
  let s=0;
  (h.pots||[]).forEach(p => {
    const n=(p.name||'').toLowerCase(), a=p.account||'';
    if(['Emergency Fund','Holiday Savings','House Deposit','Car Savings','General Savings','Stocks & Shares ISA','Cash ISA','Pension Top-Up','Christmas Fund'].includes(a)||n.includes('saving')) s+=(parseFloat(p.amount)||0);
  });
  return s;
}

function isPaydayToday() {
  const now=new Date(); now.setHours(0,0,0,0);
  const pd=getPD(now.getFullYear(),now.getMonth()).payDate; pd.setHours(0,0,0,0);
  return pd.getTime()===now.getTime();
}

export function calcAchievements() {
  const u = {};
  const sorted = state.financeHistory.slice().sort((a,b) => new Date(a.year,a.month)-new Date(b.year,b.month));
  if (sorted.length >= 1) u.first_step = true;
  const latest = sorted[sorted.length-1];
  if (latest && latest.salary>0 && state.payDay>0 && (latest.pots||[]).length>=3) u.all_set_up = true;
  const ebKey = 'early_bird_'+new Date().getFullYear();
  if (isPaydayToday()) localStorage.setItem(ebKey,'1');
  if (localStorage.getItem(ebKey)) u.early_bird = true;
  function maxConsec(arr) {
    if (!arr.length) return 0;
    let max=1,cur=1;
    for (let i=1;i<arr.length;i++) {
      const exp=new Date(arr[i-1].year,arr[i-1].month+1), act=new Date(arr[i].year,arr[i].month);
      if (exp.getFullYear()===act.getFullYear()&&exp.getMonth()===act.getMonth()) { cur++; if(cur>max)max=cur; } else cur=1;
    }
    return max;
  }
  const mc = maxConsec(sorted);
  if (mc>=3) u.on_a_roll=true; if(mc>=6) u.committed=true; if(mc>=12) u.dedicated=true;
  if (sorted.some(h=>(h.freeMoney||0)>0)) u.in_the_green=true;
  for (let i=2;i<sorted.length;i++) { if((sorted[i].freeMoney||0)>0&&(sorted[i-1].freeMoney||0)>0&&(sorted[i-2].freeMoney||0)>0){u.comfortable=true;break;} }
  for (let i=2;i<sorted.length;i++) { if((sorted[i].freeMoney||0)>(sorted[i-1].freeMoney||0)&&(sorted[i-1].freeMoney||0)>(sorted[i-2].freeMoney||0)){u.getting_better=true;break;} }
  const rates = sorted.map(h=>{ const sv=monthSavings(h); return h.takeHome>0?(sv/h.takeHome*100):0; });
  if (rates.some(r=>r>=10)) u.saver=true;
  if (rates.some(r=>r>=20)) u.strong_saver=true;
  for (let i=2;i<rates.length;i++) { if(rates[i]>=20&&rates[i-1]>=20&&rates[i-2]>=20){u.on_fire=true;break;} }
  const totTH = sorted.reduce((s,h)=>s+(h.takeHome||0),0);
  if (totTH>=1000) u.first_thousand=true; if(totTH>=10000) u.ten_grand=true;
  const mileMo = sorted.filter(h=>h.togMileage&&(h.miles||0)>0).length;
  if (mileMo>=3) u.road_warrior=true;
  const totMi = sorted.reduce((s,h)=>s+(h.togMileage?(h.miles||0):0),0);
  if (totMi>=500) u.miles_ahead=true;
  const allOnBudget = h => { const wt=(h.pots||[]).filter(p=>(parseFloat(p.target)||0)>0); return wt.length>0&&wt.every(p=>(parseFloat(p.amount)||0)<=(parseFloat(p.target)||0)); };
  if (sorted.some(allOnBudget)) u.spot_on=true;
  for (let i=2;i<sorted.length;i++) { if(allOnBudget(sorted[i])&&allOnBudget(sorted[i-1])&&allOnBudget(sorted[i-2])){u.consistent=true;break;} }
  return u;
}

export function showAchievementToast(icon, title) {
  const el = document.createElement('div'); el.className = 'achievement-toast';
  el.innerHTML = `<i class="ti ${icon}"></i> Achievement unlocked — ${title}`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 50);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.parentNode?.removeChild(el), 400); }, 4500);
}

export function renderAchievements() {
  const el = $('dash-achievements'); if (!el) return;
  const unlocked = calcAchievements();
  const seen = JSON.parse(localStorage.getItem('finance_achievements_seen') || '{}');
  const newUnlocks = ACHIEVEMENTS.filter(a => unlocked[a.id] && !seen[a.id]);
  if (newUnlocks.length) { newUnlocks.forEach(a => seen[a.id]=true); localStorage.setItem('finance_achievements_seen',JSON.stringify(seen)); }
  newUnlocks.forEach((a,i) => setTimeout(() => showAchievementToast(a.icon,a.title), i*700));
  const anyUnlocked = ACHIEVEMENTS.some(a => unlocked[a.id]);
  let h = '<div class="card"><h2>Achievements</h2>';
  if (!anyUnlocked) {
    h += emptyState('ti-trophy','Your achievements will appear here','Save your first month to start earning badges.','Get started →','window._showTrackerNew()');
  } else {
    h += '<div class="achievements-grid">';
    ACHIEVEMENTS.forEach(a => {
      const isNew = newUnlocks.some(n=>n.id===a.id);
      h += `<div class="achievement-badge ${unlocked[a.id]?'unlocked':'locked'}${isNew?' new-unlock':''}"><i class="ti ${esc(a.icon)}"></i><div class="badge-title">${esc(a.title)}</div><div class="badge-desc">${esc(a.desc)}</div></div>`;
    });
    h += '</div>';
  }
  h += '</div>'; el.innerHTML = h;
}
