import { state } from './state.js';
import { $ } from './utils.js';

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function showSkeleton() {
  clearTimeout(state.skeletonTimer);
  state.skeletonTimer = setTimeout(() => {
    const sk = $('dash-skeleton');
    const ct = document.querySelector('#dashboard-screen > .container:not(#dash-skeleton)');
    if (sk) sk.style.display = 'block';
    if (ct) ct.style.display = 'none';
  }, 300);
}

export function hideSkeleton() {
  clearTimeout(state.skeletonTimer);
  const sk = $('dash-skeleton');
  const ct = document.querySelector('#dashboard-screen > .container:not(#dash-skeleton)');
  if (sk) sk.style.display = 'none';
  if (ct) {
    ct.style.display = 'block';
    ct.classList.remove('screen-enter'); void ct.offsetWidth; ct.classList.add('screen-enter');
  }
}

// ── Bottom nav ────────────────────────────────────────────────────────────────
export function setBottomNav(tab) {
  state.bottomNavActive = tab;
  ['dashboard','tracker','history','settings'].forEach(t => {
    $('bnav-'+t)?.classList.toggle('active', t === tab);
  });
}

// ── Screen transitions ────────────────────────────────────────────────────────
export function screenEnter(el) {
  if (!el) return;
  el.classList.remove('screen-enter'); void el.offsetWidth; el.classList.add('screen-enter');
}

// ── Offline banner ────────────────────────────────────────────────────────────
export function showOfflineBanner(mode) {
  const b = $('offline-banner'); if (!b) return;
  b.className = '';
  if (mode === 'offline') {
    b.innerHTML = '<i class="ti ti-wifi-off"></i> You\'re offline — changes are saved locally and will sync when you reconnect';
    void b.offsetWidth; b.className = 'offline-show';
  } else {
    b.innerHTML = '<i class="ti ti-wifi"></i> Back online — syncing your data...';
    void b.offsetWidth; b.className = 'online-show';
    setTimeout(() => { b.style.opacity='0'; setTimeout(() => { b.className=''; b.style.opacity=''; }, 400); }, 3000);
  }
}

// ── Back to top button (Part 6) ───────────────────────────────────────────────
let bttVisible = false;
export function initBackToTop() {
  const btn = $('back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    const onDash = $('dashboard-screen')?.style.display !== 'none';
    const shouldShow = onDash && window.scrollY > 300;
    if (shouldShow !== bttVisible) {
      bttVisible = shouldShow;
      btn.classList.toggle('visible', shouldShow);
    }
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

export function hideBackToTop() {
  $('back-to-top')?.classList.remove('visible');
  bttVisible = false;
}
