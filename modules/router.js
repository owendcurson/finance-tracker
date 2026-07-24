/**
 * modules/router.js
 * Lightweight History API router for Finance Tracker.
 * Works on GitHub Pages via the 404.html redirect trick.
 */

import { state } from './state.js';

// Base path for GitHub Pages deployment. Empty string for local dev.
const BASE = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  ? ''
  : '/finance-tracker';

const TITLES = {
  '/':                       'Finance Tracker',
  '/dashboard':              'Dashboard — Finance Tracker',
  '/new-month':              'New Month — Finance Tracker',
  '/new-month/adjustments':  'Adjustments — Finance Tracker',
  '/new-month/pots':         'Pots — Finance Tracker',
  '/history':                'History — Finance Tracker',
  '/settings':               'Settings — Finance Tracker',
  '/settings/privacy':       'Privacy — Finance Tracker',
  '/savings':                'Savings Goals — Finance Tracker',
  '/insights':               'Insights — Finance Tracker',
  '/achievements':           'Achievements — Finance Tracker',
  '/salary-calculator':      'Salary Calculator — Finance Tracker',
};

// Paths that require auth (everything except the root auth screen)
const PROTECTED = new Set([
  '/dashboard', '/new-month', '/new-month/adjustments', '/new-month/pots',
  '/history', '/settings', '/settings/privacy', '/savings',
  '/insights', '/achievements', '/salary-calculator',
]);

// Navigation active tab for each path prefix
const NAV_TAB = {
  '/dashboard': 'dashboard',
  '/new-month': 'tracker',
  '/history':   'history',
  '/settings':  'settings',
  '/savings':   'dashboard',
  '/insights':  'dashboard',
  '/achievements': 'dashboard',
};

function _getPath() {
  const p = location.pathname;
  return p.startsWith(BASE) ? (p.slice(BASE.length) || '/') : '/';
}

function _navTab(path) {
  for (const [prefix, tab] of Object.entries(NAV_TAB)) {
    if (path.startsWith(prefix)) return tab;
  }
  return 'dashboard';
}

async function _render(path, { silent = false } = {}) {
  // Auth guard for protected routes
  if (PROTECTED.has(path) && !state.currentUser) {
    navigate('/', { replace: true });
    return;
  }

  if (!silent) {
    document.title = TITLES[path] || 'Finance Tracker';
    import('./ui.js').then(m => m.setBottomNav(_navTab(path)));
  }

  switch (path) {
    case '/dashboard':
      (await import('./dashboard.js')).showDashboard();
      break;
    case '/new-month':
      (await import('./tracker.js')).showTracker();
      break;
    case '/new-month/adjustments':
      (await import('./tracker.js')).then(m => m.goStep(2, { pushUrl: false }));
      break;
    case '/new-month/pots':
      (await import('./tracker.js')).then(m => m.goStep(3, { pushUrl: false }));
      break;
    case '/history': {
      const d = await import('./dashboard.js');
      d.showDashboard().then?.(() => {
        setTimeout(() => document.getElementById('ds-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      });
      break;
    }
    case '/settings':
      window._showSettings?.();
      break;
    case '/settings/privacy':
      import('./privacy.js').then(m => m.showPrivacy?.());
      break;
    default:
      if (path.startsWith('/history/')) {
        // History detail — go to history and highlight
        navigate('/history', { replace: true });
      } else if (path !== '/') {
        navigate(state.currentUser ? '/dashboard' : '/', { replace: true });
      }
  }
}

/**
 * Navigate to a path, updating the browser URL and rendering the screen.
 * @param {string} path - Route path e.g. '/dashboard'
 * @param {{ replace?: boolean }} opts
 */
export function navigate(path, { replace = false } = {}) {
  const url = BASE + (path === '/' ? '/' : path);
  if (replace) history.replaceState({ path }, '', url);
  else history.pushState({ path }, '', url);
  document.title = TITLES[path] || 'Finance Tracker';
  _render(path);
}

/**
 * Initialise the router. Call once at app startup.
 * Handles initial URL (from 404.html redirect or direct navigation) and popstate.
 */
export function initRouter() {
  // Handle browser back/forward
  window.addEventListener('popstate', () => {
    const path = _getPath();
    document.title = TITLES[path] || 'Finance Tracker';
    _render(path);
  });

  // If we landed on a specific path (e.g. via 404.html redirect),
  // store it so auth can pick it up after sign-in
  const initialPath = _getPath();
  if (initialPath !== '/' && PROTECTED.has(initialPath)) {
    state._pendingRoute = initialPath;
  }
}

/**
 * Call after successful sign-in to navigate to any pending deep-link route.
 * Falls back to /dashboard.
 */
export function resolvePendingRoute() {
  const target = state._pendingRoute || '/dashboard';
  state._pendingRoute = null;
  navigate(target, { replace: true });
}

export function getCurrentPath() {
  return _getPath();
}
