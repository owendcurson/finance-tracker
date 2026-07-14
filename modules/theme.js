import { $ } from './utils.js';

export function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}
export function chartTextColor() { return isDark() ? '#a0a0b0' : '#5f6368'; }
export function chartGridColor()  { return isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; }
export function chartZeroColor()  { return isDark() ? 'rgba(255,255,255,0.3)'  : 'rgba(0,0,0,0.3)'; }

export function applyTheme(t) {
  if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0a0f1a');
}

export function initTheme() {
  applyTheme('dark');
}
