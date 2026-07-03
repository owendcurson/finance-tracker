import { state } from './state.js';
import { $, toast } from './utils.js';
import { APP_VERSION, EMAILJS_SERVICE, EMAILJS_TEMPLATE, EMAILJS_KEY } from './constants.js';
import { db, doc, getDoc, setDoc } from './firebase.js';
import { initBH } from './payday.js';

// ── Pay day setting ───────────────────────────────────────────────────────────
export function initPDS() {
  const sel = $('pay-day-select'); if (!sel) return;
  for (let i = 1; i <= 28; i++) {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = i + (i===1?'st':i===2?'nd':i===3?'rd':'th');
    if (i === state.payDay) opt.selected = true;
    sel.appendChild(opt);
  }
}

export async function onPDC() {
  const sel = $('pay-day-select'); if (!sel) return;
  state.payDay = parseInt(sel.value) || 23;
  localStorage.setItem('finance_payDay', state.payDay);
  initBH();
  if (state.currentUser) {
    try {
      await setDoc(doc(db,'users',state.currentUser.uid,'settings','payDay'),
        { payDay: state.payDay }, { merge: true });
    } catch(e) {}
  }
  import('./dashboard.js').then(m => m.renderCountdown?.());
  toast('Pay day updated');
}

// ── Email notifications ───────────────────────────────────────────────────────
export async function loadEmailPrefs() {
  if (!state.currentUser) return;
  try {
    const snap = await getDoc(doc(db,'users',state.currentUser.uid,'settings','emailPrefs'));
    if (snap.exists()) {
      const d = snap.data();
      state.emailPrefs.email   = d.email   || '';
      state.emailPrefs.enabled = d.enabled || false;
      syncEmailPrefsUI();
    }
  } catch(e) {}
}

function syncEmailPrefsUI() {
  const emailEl = $('email-notif-addr');
  const toggleEl= $('email-notif-toggle');
  if (emailEl)  emailEl.value   = state.emailPrefs.email;
  if (toggleEl) toggleEl.checked= state.emailPrefs.enabled;
}

export async function saveEmailPrefs() {
  const emailEl  = $('email-notif-addr');
  const toggleEl = $('email-notif-toggle');
  if (!emailEl || !toggleEl) return;
  const email   = emailEl.value.trim();
  const enabled = toggleEl.checked;
  if (enabled && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    toast('Please enter a valid email address');
    return;
  }
  state.emailPrefs = { email, enabled };
  if (state.currentUser) {
    try {
      await setDoc(doc(db,'users',state.currentUser.uid,'settings','emailPrefs'),
        { email, enabled }, { merge: true });
    } catch(e) {}
  }
  toast(enabled ? 'Email notifications enabled' : 'Email notifications disabled');
}

// ── Dashboard density (Part 4) ────────────────────────────────────────────────
export function applyDensity(val) {
  document.documentElement.setAttribute('data-density', val || 'default');
  const btns = document.querySelectorAll('.density-btn');
  btns.forEach(b => b.classList.toggle('active', b.dataset.density === val));
}

export async function setDensity(val) {
  applyDensity(val);
  localStorage.setItem('dash_density', val);
  if (state.currentUser) {
    try {
      await setDoc(doc(db,'users',state.currentUser.uid,'settings','density'),
        { density: val }, { merge: true });
    } catch(e) {}
  }
}

export function initDensity() {
  const saved = localStorage.getItem('dash_density') || 'default';
  applyDensity(saved);
}

// ── Settings screen ───────────────────────────────────────────────────────────
export function renderSettingsScreen() {
  const vEl = $('app-version'); if (vEl) vEl.textContent = APP_VERSION;
  initPDS();
  initDensity();
  loadEmailPrefs();
  initSalCalc();
}

function initSalCalc() {
  const cur = $('salcalc-current'), prop = $('salcalc-proposed');
  if (!cur || !prop) return;
  const calc = () => {
    import('./tracker.js').then(m => m.renderSalCalc());
  };
  cur.oninput = calc;
  prop.oninput = calc;
}

// ── Load all settings from Firestore ─────────────────────────────────────────
export async function loadSettingsFS() {
  if (!state.currentUser) return;
  try {
    const [pdSnap, densSnap, dashSnap] = await Promise.all([
      getDoc(doc(db,'users',state.currentUser.uid,'settings','payDay')),
      getDoc(doc(db,'users',state.currentUser.uid,'settings','density')),
      getDoc(doc(db,'users',state.currentUser.uid,'settings','dashboard')),
    ]);
    if (pdSnap.exists()) {
      state.payDay = pdSnap.data().payDay || 23;
      localStorage.setItem('finance_payDay', state.payDay);
      const sel = $('pay-day-select');
      if (sel) sel.value = state.payDay;
      initBH();
    }
    if (densSnap.exists()) {
      const d = densSnap.data().density || 'default';
      localStorage.setItem('dash_density', d);
      applyDensity(d);
    }
    if (dashSnap.exists()) {
      const d = dashSnap.data();
      if (d.widgets) state.dashWidgets = d.widgets;
      if (d.order)   state.dashOrder   = d.order;
      if (d.sizes)   { state.dashSizes = d.sizes; try { localStorage.setItem('dash_sizes', JSON.stringify(d.sizes)); } catch(e){} }
    }
  } catch(e) {}
}

// ── Salary calc in settings ───────────────────────────────────────────────────
export function initSettingsSalCalc() {
  // Salary calculator is embedded in tracker; settings just links to it
  const openBtn = $('settings-open-sal-calc');
  if (openBtn) openBtn.addEventListener('click', () => {
    import('./tracker.js').then(m => m.openSalCalc());
  });
}

// ── Window globals ────────────────────────────────────────────────────────────
window._onPDC       = onPDC;
window._setDensity  = setDensity;
window._saveEmailPrefs = saveEmailPrefs;
