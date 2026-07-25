// PayUnite v2.4.3 — ES module entry point
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

// ── PayUnite logo helpers ─────────────────────────────────────────────────────

/**
 * Returns the PayUnite icon mark as an SVG string.
 * @param {number} size - Width and height in pixels
 * @param {string} uid - Unique ID prefix for gradient/mask/clip defs (must be unique per page instance)
 * @param {'gradient'|'white'|'app-icon'} mode - Rendering mode
 * @param {boolean} rounded - Whether to clip to rounded rect (for app icons)
 * @returns {string} SVG markup string
 */
function payuniteIcon(size = 48, uid = 'pu', mode = 'gradient', rounded = false) {
  const OR = 46, R1 = 35, R2 = 65, RY = 50, RR = 14, SW = 7;
  const RO = RR + SW / 2;
  const RI = RR - SW / 2;
  const clipPath = rounded ? `clip-path="url(#${uid}c)"` : '';
  const defs = `
    <defs>
      <linearGradient id="${uid}g" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
        <stop offset="0%"   stop-color="#6366f1"/>
        <stop offset="50%"  stop-color="#60a5fa"/>
        <stop offset="100%" stop-color="#34d399"/>
      </linearGradient>
      ${rounded ? `<clipPath id="${uid}c"><rect width="100" height="100" rx="22"/></clipPath>` : ''}
      ${mode === 'white' ? `
        <mask id="${uid}m">
          <circle cx="50" cy="50" r="${OR}" fill="white"/>
          <circle cx="${R1}" cy="${RY}" r="${RO}" fill="black"/>
          <circle cx="${R1}" cy="${RY}" r="${RI}" fill="white"/>
          <circle cx="${R2}" cy="${RY}" r="${RO}" fill="black"/>
          <circle cx="${R2}" cy="${RY}" r="${RI}" fill="white"/>
        </mask>` : ''}
    </defs>`;
  const bg = mode === 'app-icon' ? `<rect width="100" height="100" fill="#080B14"/>` : '';
  const mark = mode === 'white'
    ? `<circle cx="50" cy="50" r="${OR}" fill="white" mask="url(#${uid}m)"/>`
    : `<circle cx="50" cy="50" r="${OR}" fill="url(#${uid}g)"/>
       <circle cx="${R1}" cy="${RY}" r="${RR}" fill="none" stroke="white" stroke-width="${SW}"/>
       <circle cx="${R2}" cy="${RY}" r="${RR}" fill="none" stroke="white" stroke-width="${SW}"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    ${defs}
    <g ${clipPath}>${bg}${mark}</g>
  </svg>`;
}

/**
 * Returns the PayUnite wordmark as an HTML string.
 * @param {number} size - Font size in pixels
 * @param {'dark'|'light'} mode - Colour mode
 * @returns {string} HTML markup string
 */
function payuniteWordmark(size = 28, mode = 'dark') {
  const payColor   = mode === 'dark' ? '#ffffff' : '#080B14';
  const uniteColor = mode === 'dark' ? '#a5b4fc' : '#4f46e5';
  return `<span style="font-family:'Inter',sans-serif;font-size:${size}px;line-height:1;display:inline-flex;align-items:baseline;user-select:none;">
    <span style="font-weight:700;color:${payColor};">Pay</span><span style="font-weight:300;color:${uniteColor};">Unite</span>
  </span>`;
}

/**
 * Returns the full horizontal logo (icon + wordmark) as an HTML string.
 * @param {'dark'|'light'} mode - Colour mode
 * @param {number} iconSize - Icon mark size in pixels
 * @param {string} uid - Unique ID prefix
 * @returns {string} HTML markup string
 */
function payuniteLogo(mode = 'dark', iconSize = 38, uid = 'logo') {
  return `<div style="display:flex;align-items:center;gap:10px;">
    ${payuniteIcon(iconSize, uid, 'gradient')}
    ${payuniteWordmark(Math.round(iconSize * 0.78), mode)}
  </div>`;
}

// ── Logo injection ─────────────────────────────────────────────────────────────

function _logoMode() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

// ── Mobile avatar dropdown ────────────────────────────────────────────────────

window._setMobileAvatarUser = function(name, email) {
  const btn = document.getElementById('mobile-avatar-btn');
  const madName  = document.getElementById('mad-name');
  const madEmail = document.getElementById('mad-email');
  if (btn)      btn.textContent  = (name || '?')[0].toUpperCase();
  if (madName)  madName.textContent  = name  || '';
  if (madEmail) madEmail.textContent = email || '';
};

window._toggleAvatarDropdown = function(forceOpen) {
  const btn      = document.getElementById('mobile-avatar-btn');
  const dropdown = document.getElementById('mobile-avatar-dropdown');
  if (!dropdown) return;
  const isOpen = dropdown.classList.contains('mad-open');
  const open   = forceOpen !== undefined ? forceOpen : !isOpen;
  if (open) {
    dropdown.style.display = 'block';
    void dropdown.offsetWidth;
    dropdown.classList.add('mad-open');
    btn?.setAttribute('aria-expanded', 'true');
  } else {
    dropdown.classList.remove('mad-open');
    btn?.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (!dropdown.classList.contains('mad-open')) dropdown.style.display = 'none'; }, 160);
  }
};

document.addEventListener('click', e => {
  const dropdown = document.getElementById('mobile-avatar-dropdown');
  const btn      = document.getElementById('mobile-avatar-btn');
  if (dropdown?.classList.contains('mad-open') && !btn?.contains(e.target) && !dropdown.contains(e.target)) {
    window._toggleAvatarDropdown(false);
  }
}, true);

function _initLogos() {
  // Header logo
  const hdrEl = document.getElementById('header-logo');
  if (hdrEl) {
    hdrEl.innerHTML = payuniteLogo(_logoMode(), 32, 'hdr');
    // Re-render on theme change
    new MutationObserver(() => {
      hdrEl.innerHTML = payuniteLogo(_logoMode(), 32, _logoMode() === 'dark' ? 'hdr' : 'hdr2');
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // Auth overlay logo mark
  const authLogo = document.getElementById('auth-logo-mark');
  if (authLogo) authLogo.innerHTML = payuniteIcon(48, 'auth', 'gradient');

  // Onboarding logo mark
  const obLogo = document.getElementById('ob-logo');
  if (obLogo) obLogo.innerHTML = payuniteIcon(40, 'ob', 'gradient');

  // Splash page logo mark — animate in before title words
  const splashLogo = document.getElementById('splash-logo-icon');
  if (splashLogo) {
    const sz = window.innerWidth <= 768 ? 48 : 64;
    splashLogo.style.cssText = 'opacity:0;transform:scale(0.8);display:flex;justify-content:center;margin-bottom:20px;filter:drop-shadow(0 0 24px rgba(99,102,241,0.5))';
    splashLogo.innerHTML = payuniteIcon(sz, 'splash', 'gradient');
    requestAnimationFrame(() => {
      splashLogo.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
      splashLogo.style.opacity = '1';
      splashLogo.style.transform = 'scale(1)';
    });
  }
}

// ── Global error handlers ─────────────────────────────────────────────────────
window.onerror = (msg, src, line, col, err) => {
  console.error('Uncaught error:', msg, src, line, col, err);
  import('./modules/utils.js').then(m => m.toast('Something went wrong. Please refresh the page.'));
  return false;
};

window.addEventListener('unhandledrejection', e => {
  console.error('Unhandled promise rejection:', e.reason);
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
function init() {
  initBH();
  initTheme();
  initDensity();
  initOfflineListeners();
  initSplash();
  _initLogos();
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

  // Service worker — always fetch fresh SW script, auto-reload when new version activates
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' }).catch(() => {});
    let _swReloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!_swReloading) { _swReloading = true; location.reload(); }
    });
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
window._renderSettings = showSettingsScreen;
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
