import { state } from './state.js';
import { $ } from './utils.js';
import { getPD } from './payday.js';

export function isPaydayToday() {
  const now = new Date(); now.setHours(0,0,0,0);
  const pd  = getPD(now.getFullYear(), now.getMonth()).payDate; pd.setHours(0,0,0,0);
  return pd.getTime() === now.getTime();
}

export async function fireConfetti() {
  if (typeof window.confetti !== 'function') {
    try {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.browser.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    } catch(e) { return; }
  }
  if (typeof window.confetti !== 'function') return;
  const end = Date.now() + 4000;
  (function frame() {
    window.confetti({ particleCount: 4, angle: 60,  spread: 55, origin: { x: 0 } });
    window.confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function maybeShowPayday() {
  if (!isPaydayToday()) return;
  const key = 'payday_modal_'+new Date().toDateString();
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key,'1');
  const modal = $('payday-modal'); if (!modal) return;

  const predicted = state.lastTakeHome;
  const matchSection   = $('payday-match-section');
  const defaultSection = $('payday-default-section');
  if (predicted > 0 && matchSection && defaultSection) {
    const el = $('payday-predicted-th');
    if (el) el.textContent = '£' + predicted.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    matchSection.style.display   = '';
    defaultSection.style.display = 'none';
  }

  modal.classList.add('open');
  setTimeout(fireConfetti, 300);
}

export function closePaydayModal() {
  $('payday-modal')?.classList.remove('open');
  // Reset modal state for next time
  const matchSection   = $('payday-match-section');
  const defaultSection = $('payday-default-section');
  const actualSection  = $('payday-actual-section');
  const actualConfirm  = $('payday-actual-confirm');
  const matchBtns      = $('payday-match-btns');
  if (matchSection)   matchSection.style.display   = 'none';
  if (defaultSection) defaultSection.style.display = '';
  if (actualSection)  actualSection.style.display  = 'none';
  if (actualConfirm)  actualConfirm.style.display  = 'none';
  if (matchBtns)      matchBtns.style.display      = '';
  const inp = $('payday-actual-input'); if (inp) inp.value = '';
}

window._closePaydayModal = closePaydayModal;

window._paydayYes = () => {
  closePaydayModal();
  window._showTrackerNew?.();
};

window._paydayNo = () => {
  $('payday-actual-section').style.display = '';
  $('payday-match-btns').style.display     = 'none';
  $('payday-actual-confirm').style.display = '';
  $('payday-actual-input')?.focus();
};

window._paydayConfirmActual = () => {
  const actual = parseFloat($('payday-actual-input')?.value) || 0;
  if (actual <= 0) { import('./utils.js').then(m => m.toast('Please enter your actual take-home.')); return; }
  state.paydayActualTH = actual;
  closePaydayModal();
  window._showTrackerNew?.();
  setTimeout(() => import('./utils.js').then(m => m.toast(`Tracker loaded. Your actual take-home of £${actual.toFixed(2)} has been noted.`)), 500);
};
