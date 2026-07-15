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
  modal.classList.add('open');
  setTimeout(fireConfetti, 300);
}

export function closePaydayModal() {
  $('payday-modal')?.classList.remove('open');
}

window._closePaydayModal = closePaydayModal;
