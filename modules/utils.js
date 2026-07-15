// Pure utility functions — no state, no Firebase imports

export const $ = id => document.getElementById(id);

export function ds(d) {
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
export function os(d) {
  if (d===1||d===21||d===31) return 'st';
  if (d===2||d===22) return 'nd';
  if (d===3||d===23) return 'rd';
  return 'th';
}
export function fdl(d) {
  const DN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MF = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return DN[d.getDay()]+' '+d.getDate()+os(d.getDate())+' '+MF[d.getMonth()]+' '+d.getFullYear();
}
export function fds(d) {
  const MS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getDate()+' '+MS[d.getMonth()]+' '+d.getFullYear();
}
export function fmt(n) {
  return '£'+Math.abs(n).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
}
export function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
export function row(l, v, c) {
  return `<tr><td>${l}</td><td class="${c||''}">${v<0?'−'+fmt(v):fmt(v)}</td></tr>`;
}
export function rowT(l, v) {
  return `<tr class="total"><td>${l}</td><td>${fmt(v)}</td></tr>`;
}
export function st(l, v) {
  return `<div class="summary-stat"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`;
}
export function emptyState(icon, title, text, btnLabel, btnAction) {
  const btn = btnLabel ? `<button class="btn btn-primary" style="margin-top:4px" onclick="${btnAction}">${btnLabel}</button>` : '';
  return `<div class="empty-state"><i class="ti ${icon} empty-state-icon"></i><div class="empty-state-title">${title}</div><p class="empty-state-text">${text}</p>${btn}</div>`;
}

/**
 * Shows a toast notification. The toast element carries role="alert" so
 * screen readers announce it automatically.
 * @param {string} m - Message to display
 */
export function toast(m) {
  const t = $('toast'); if (!t) return;
  t.textContent = m; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

export function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

/**
 * Strips HTML tags and trims whitespace from a user-supplied string.
 * Use this before displaying any content that came from user input or Firestore.
 * @param {string} str - Raw input
 * @returns {string} Safe plain text
 */
export function sanitise(str) {
  const tmp = document.createElement('div');
  tmp.textContent = String(str);
  return tmp.textContent.trim();
}

/**
 * Maps Firebase Firestore error codes to user-friendly messages.
 * Never expose raw Firebase codes or messages to the UI.
 * @param {Error} err - Firebase error object (has .code property)
 * @returns {string} User-friendly error message
 */
export function friendlyFsError(err) {
  const code = err?.code || '';
  if (code.includes('permission-denied')) return "You don't have permission to access this data. Please sign out and sign back in.";
  if (code.includes('unavailable'))       return 'You appear to be offline. Changes will sync when you reconnect.';
  if (code.includes('quota-exceeded'))    return 'Storage limit reached. Please contact support.';
  return 'Something went wrong. Please try again.';
}
