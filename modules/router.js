/**
 * modules/router.js
 * Lightweight History API router for PayUnite.
 * Works on GitHub Pages via the 404.html redirect trick.
 */

import { state } from './state.js';

// Detect base path: /finance-tracker only on the GitHub Pages subdomain.
// The custom domain (payunite.co.uk) serves from root with no prefix.
const BASE = (() => {
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost')) return '';
  if (h === 'owendcurson.github.io') return '/finance-tracker';
  return '';
})();

const TITLES = {
  '/':                        'PayUnite',
  '/dashboard':               'Dashboard - PayUnite',
  '/new-month':               'New Month - PayUnite',
  '/new-month/adjustments':   'Adjustments - PayUnite',
  '/new-month/pots':          'Pots & Summary - PayUnite',
  '/edit-month':              'Edit Month - PayUnite',
  '/edit-month/adjustments':  'Edit Adjustments - PayUnite',
  '/edit-month/pots':         'Edit Pots & Summary - PayUnite',
  '/history':                 'History - PayUnite',
  '/settings':                'Settings - PayUnite',
  '/settings/privacy':        'Privacy - PayUnite',
  '/savings':                 'Savings Goals - PayUnite',
  '/insights':                'Insights - PayUnite',
  '/achievements':            'Achievements - PayUnite',
  '/salary-calculator':       'Salary Calculator - PayUnite',
  '/tax-year':                'Tax Year Summary - PayUnite',
  '/budget':                  'Budget Planner - PayUnite',
  '/cost-of-living':          'Cost of Living - PayUnite',
  '/benefits':                'Benefits & Perks - PayUnite',
};

// Paths that require auth (everything except the root auth screen)
const PROTECTED = new Set([
  '/dashboard', '/new-month', '/new-month/adjustments', '/new-month/pots',
  '/edit-month', '/edit-month/adjustments', '/edit-month/pots',
  '/history', '/settings', '/settings/privacy', '/savings',
  '/insights', '/achievements', '/salary-calculator',
  '/tax-year', '/budget', '/cost-of-living', '/benefits',
]);

// Navigation active tab for each path prefix
const NAV_TAB = {
  '/dashboard':      'dashboard',
  '/new-month':      'tracker',
  '/edit-month':     'tracker',
  '/history':        'history',
  '/settings':       'settings',
  '/savings':        'dashboard',
  '/insights':       'dashboard',
  '/achievements':   'dashboard',
  '/salary-calculator': 'salary',
  '/tax-year':       'dashboard',
  '/budget':         'dashboard',
  '/cost-of-living': 'dashboard',
  '/benefits':       'dashboard',
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
    document.title = TITLES[path] || 'PayUnite';
    import('./ui.js').then(m => m.setBottomNav(_navTab(path)));
  }

  switch (path) {
    case '/dashboard':
      (await import('./dashboard.js')).showDashboard();
      break;
    case '/new-month':
      (await import('./tracker.js')).showTracker();
      break;
    case '/new-month/adjustments': {
      const mt = await import('./tracker.js');
      mt.goStep(2, { pushUrl: false });
      break;
    }
    case '/new-month/pots': {
      const mt = await import('./tracker.js');
      mt.goStep(3, { pushUrl: false });
      break;
    }
    case '/edit-month':
      // editingId must already be set in state before navigating here
      (await import('./tracker.js')).showTracker();
      break;
    case '/edit-month/adjustments': {
      const mt = await import('./tracker.js');
      mt.goStep(2, { pushUrl: false });
      break;
    }
    case '/edit-month/pots': {
      const mt = await import('./tracker.js');
      mt.goStep(3, { pushUrl: false });
      break;
    }
    case '/history': {
      const d = await import('./dashboard.js');
      await d.showDashboard();
      setTimeout(() => document.getElementById('ds-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      break;
    }
    case '/savings': {
      const d = await import('./dashboard.js');
      await d.showDashboard();
      setTimeout(() => document.getElementById('dash-savings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      break;
    }
    case '/insights': {
      const d = await import('./dashboard.js');
      await d.showDashboard();
      setTimeout(() => document.querySelector('[data-widget="insights"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      break;
    }
    case '/achievements': {
      const d = await import('./dashboard.js');
      await d.showDashboard();
      setTimeout(() => document.querySelector('[data-widget="achievements"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      break;
    }
    case '/settings':
      window._renderSettings?.();
      break;
    case '/settings/privacy':
      import('./privacy.js').then(m => m.showPrivacy?.());
      break;
    case '/tax-year':
      (await import('./tax-year.js')).showTaxYear();
      break;
    case '/budget':
      (await import('./budget.js')).showBudget();
      break;
    case '/cost-of-living':
      (await import('./cost-of-living.js')).showCOL();
      break;
    case '/benefits':
      (await import('./benefits.js')).showBenefits();
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
  document.title = TITLES[path] || 'PayUnite';
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
    document.title = TITLES[path] || 'PayUnite';
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
