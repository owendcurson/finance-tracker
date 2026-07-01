import { $ } from './utils.js';

export function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}
export function chartTextColor() { return isDark() ? '#a0a0b0' : '#5f6368'; }
export function chartGridColor()  { return isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; }
export function chartZeroColor()  { return isDark() ? 'rgba(255,255,255,0.3)'  : 'rgba(0,0,0,0.3)'; }

export function updThemeIcons() {
  const ic = isDark() ? 'ti ti-sun' : 'ti ti-moon';
  const tb = $('theme-btn'), sb = $('splash-theme-btn');
  if (tb) tb.innerHTML = `<i class="${ic}"></i>`;
  if (sb) sb.innerHTML = `<i class="${ic}"></i>`;
}

export function applyTheme(t) {
  if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0a0f1a' : '#0d1b2a');
  updThemeIcons();
}

export function initTheme() {
  const saved = localStorage.getItem('finance_theme');
  const t = saved || ((window.matchMedia?.('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
  applyTheme(t);
}

export function toggleTheme() {
  const t = isDark() ? 'light' : 'dark';
  localStorage.setItem('finance_theme', t);
  applyTheme(t);
  // re-render charts for new colour scheme
  if ($('app-container')?.style.display !== 'none') {
    import('./charts.js').then(m => m.renderCharts());
  }
}
