// Finance Tracker v2.4.0 — ES module entry point
import { APP_VERSION } from './modules/constants.js';
import { state } from './modules/state.js';
import { initBH } from './modules/payday.js';
import { initTheme } from './modules/theme.js';
import { initAuth } from './modules/auth.js';
import { initOfflineListeners } from './modules/offline.js';
import { initDensity, renderSettingsScreen } from './modules/settings.js';
import { initContactForm } from './modules/privacy.js';
import { initSplashDemo } from './modules/demo.js';
import { attachChartTypeListeners } from './modules/charts.js';
import { initBackToTop } from './modules/ui.js';
import { checkPaydayNotifications } from './modules/notifications.js';
import { initSplash } from './modules/splash.js';
import { navigate, initRouter } from './modules/router.js';

// ── Global error handlers ─────────────────────────────────────────────────────
// Log details to console for debugging; show only a generic message to users.
window.onerror = (msg, src, line, col, err) => {
  console.error('Uncaught error:', msg, src, line, col, err);
  import('./modules/utils.js').then(m => m.toast('Something went wrong. Please refresh the page.'));
  return false; // allow default browser error handling
};

window.addEventListener('unhandledrejection', e => {
  console.error('Unhandled promise rejection:', e.reason);
  // Don't show a toast for every rejected promise (e.g. network, lazy imports)
  // — only when the rejection carries no message we'd want to surface.
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
function init() {
  initBH();
  initTheme();
  initDensity();
  initOfflineListeners();
  initSplash();
  initAuth();           // sets up onAuthStateChanged → triggers showDashboard or showAuth
  initContactForm();
  initSplashDemo();
  checkPaydayNotifications();

  // Version display
  const vEl = document.getElementById('app-version');
  if (vEl) vEl.textContent = APP_VERSION;

  // Bottom nav event delegation
  document.getElementById('bottom-nav')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-nav]');
    if (!btn) return;
    const tab = btn.dataset.nav;
    if (tab === 'dashboard')  navigate('/dashboard');
    else if (tab === 'tracker')  navigate('/new-month');
    else if (tab === 'history')  navigate('/history');
    else if (tab === 'settings') navigate('/settings');
  });

  // Modal close on backdrop click
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-backdrop') || e.target.classList.contains('modal-overlay')) {
      e.target.closest('.modal, .panel, .side-panel')?.classList.remove('open');
    }
  });

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }

  initRouter();
}

function showSettingsScreen() {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  const ss = document.getElementById('settings-screen'); if (ss) ss.style.display = 'block';
  const hb = document.getElementById('header-back'); if (hb) hb.style.display = 'flex';
  import('./modules/ui.js').then(m => m.setBottomNav('settings'));
  renderSettingsScreen();
}

window._showSettings  = () => navigate('/settings');
window._showDashboard = () => navigate('/dashboard');
window._showTracker   = () => navigate('/new-month');
window._showTrackerNew = () => {
  state.editingId = null;
  import('./modules/tracker.js').then(m => m.clearTracker?.());
  navigate('/new-month');
};

// ── Settings screen event wiring ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  init();

  document.querySelectorAll('.density-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      import('./modules/settings.js').then(m => m.setDensity(btn.dataset.density));
    });
  });

  const soBtn = document.getElementById('signout-btn');
  if (soBtn) soBtn.addEventListener('click', () => {
    import('./modules/auth.js').then(m => m.doSignOut());
  });
});
