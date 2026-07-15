import { state } from './state.js';
import { $, toast, friendlyFsError } from './utils.js';
import { auth, db, doc, getDoc, setDoc, collection, getDocs,
         onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
         signOut, sendPasswordResetEmail, deleteUser,
         signInWithPopup, googleProvider, microsoftProvider,
         setPersistence, browserLocalPersistence, browserSessionPersistence } from './firebase.js';
import { initBH } from './payday.js';
import { loadSettingsFS } from './settings.js';

// ── Session inactivity timeout (60 minutes) ───────────────────────────────────
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;
let _sessionTimer = null;

function resetSessionTimer() {
  clearTimeout(_sessionTimer);
  _sessionTimer = setTimeout(async () => {
    if (!state.currentUser) return;
    toast('Your session has expired. Please sign in again.');
    await confirmSignOut();
    showSessionExpiredModal();
  }, SESSION_TIMEOUT_MS);
}

function startSessionWatcher() {
  const events = ['click', 'keydown', 'touchstart', 'scroll'];
  const handler = () => resetSessionTimer();
  events.forEach(e => window.addEventListener(e, handler, { passive: true }));
  resetSessionTimer();
}

function stopSessionWatcher() {
  clearTimeout(_sessionTimer);
  _sessionTimer = null;
}

function showSessionExpiredModal() {
  const existing = document.getElementById('session-expired-modal');
  if (existing) { existing.style.display = 'flex'; return; }
  const modal = document.createElement('div');
  modal.id = 'session-expired-modal';
  modal.className = 'confirm-modal-overlay';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6)';
  modal.innerHTML = `<div class="confirm-modal">
    <div class="confirm-modal-icon"><i class="ti ti-lock"></i></div>
    <h3>Session expired</h3>
    <p>Your session has expired for security. Please sign in again.</p>
    <div class="confirm-modal-btns">
      <button class="btn btn-primary" onclick="document.getElementById('session-expired-modal').remove();window._openAuth?.('signin')">Sign in again</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

// ── UI helpers ─────────────────────────────────────────────────────────────────
function authErr(id, msg) {
  const el = $(id); if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
}

function hideLoading() {
  const l = $('loading-screen'); if (l) l.style.display = 'none';
}

function showAuthScreen() {
  hideLoading();
  const a = $('auth-screen'); if (a) a.style.display = 'block';
  const c = $('app-container'); if (c) c.style.display = 'none';
  const ov = $('auth-overlay'); if (ov) ov.style.display = 'none';
  import('./splash.js').then(m => m.resumeSplash?.());
}

function showApp() {
  hideLoading();
  const a = $('auth-screen'); if (a) a.style.display = 'none';
  const c = $('app-container'); if (c) c.style.display = '';
  window._closeAuth?.();
  import('./splash.js').then(m => m.pauseSplash?.());
  import('./dashboard.js').then(m => m.showDashboard());
}

// ── Load user data from Firestore ─────────────────────────────────────────────
async function loadUserData(uid) {
  try {
    const mSnap = await getDocs(collection(db,'users',uid,'months'));
    const months = [];
    mSnap.forEach(d => months.push({ ...d.data(), id: parseInt(d.id) }));
    if (months.length) {
      state.financeHistory = months.sort((a,b)=>b.id-a.id);
      import('./tracker.js').then(m => m.saveLocal());
    } else {
      import('./tracker.js').then(m => m.loadLocal());
    }
    state.fsSynced = true;
  } catch(e) {
    console.error('loadUserData failed:', e);
    import('./tracker.js').then(m => m.loadLocal());
    state.fsSynced = true;
    // Show cached-data notice only if we actually have local data
    if (localStorage.getItem('finance_history')) {
      toast('Showing cached data. Could not connect to sync.');
    }
  }
  await loadSettingsFS();
}

// ── Auth state listener ───────────────────────────────────────────────────────
export function initAuth() {
  onAuthStateChanged(auth, async user => {
    if (user) {
      state.currentUser = user;
      const nameEl = $('user-display-name');
      const emailEl= $('user-display-email');
      if (nameEl)  nameEl.textContent  = user.displayName || user.email || 'User';
      if (emailEl) emailEl.textContent = user.email || '';
      if (!state.fsSynced) await loadUserData(user.uid);
      showApp();
      startSessionWatcher();
      import('./notifications.js').then(m => m.maybeShowNotifBanner?.());
      import('./payday_modal.js').then(m => m.maybeShowPayday?.());
    } else {
      state.currentUser = null;
      state.fsSynced = false;
      stopSessionWatcher();
      import('./tracker.js').then(m => m.loadLocal());
      showAuthScreen();
    }
  });
}

// ── Sign in / sign up ─────────────────────────────────────────────────────────
export async function signIn() {
  const email = $('signin-email')?.value.trim();
  const pass  = $('signin-pass')?.value;
  const keepSignedIn = $('signin-remember')?.checked ?? true;
  authErr('signin-error','');
  if (!email || !pass) { authErr('signin-error','Enter email and password.'); return; }
  try {
    await setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(e) {
    console.error('signIn failed:', e);
    authErr('signin-error', friendlyAuthError(e.code));
  }
}

export async function signUp() {
  const email = $('signup-email')?.value.trim();
  const pass  = $('signup-pass')?.value;
  const pass2 = $('signup-pass2')?.value;
  authErr('signup-error','');
  if (!email || !pass) { authErr('signup-error','Enter email and password.'); return; }
  if (pass !== pass2)  { authErr('signup-error','Passwords do not match.'); return; }
  if (pass.length < 6) { authErr('signup-error','Password must be at least 6 characters.'); return; }
  try {
    state.isNewUser = true;
    await createUserWithEmailAndPassword(auth, email, pass);
  } catch(e) {
    console.error('signUp failed:', e);
    state.isNewUser = false;
    authErr('signup-error', friendlyAuthError(e.code));
  }
}

export async function signInGoogle() {
  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithPopup(auth, googleProvider);
  } catch(e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      console.error('Google sign-in failed:', e);
      toast('Google sign-in failed. Please try again.');
    }
  }
}

export async function signInMicrosoft() {
  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithPopup(auth, microsoftProvider);
  } catch(e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      console.error('Microsoft sign-in failed:', e);
      toast('Microsoft sign-in failed. Please try again.');
    }
  }
}

export async function doSignOut() {
  window._showSignOutConfirm?.();
}

export async function confirmSignOut() {
  stopSessionWatcher();
  state.fsSynced = false;
  state.currentUser = null;
  state.financeHistory = [];
  await signOut(auth);
}

export async function sendReset() {
  const email = $('signin-email')?.value.trim() || $('signup-email')?.value.trim();
  if (!email) { toast('Enter your email first'); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    toast('Reset email sent to '+email);
  } catch(e) {
    console.error('sendReset failed:', e);
    toast('Could not send reset email. Please try again.');
  }
}

export async function deleteAccount() {
  if (!state.currentUser) return;
  if (!confirm('Delete your account and all data permanently? This cannot be undone.')) return;
  try {
    const uid = state.currentUser.uid;
    const mSnap = await getDocs(collection(db,'users',uid,'months'));
    await Promise.all(mSnap.docs.map(d => d.ref.delete?.())).catch(()=>{});
    await deleteUser(state.currentUser);
    state.currentUser = null;
    state.financeHistory = [];
    localStorage.clear();
    toast('Account deleted');
  } catch(e) {
    console.error('deleteAccount failed:', e);
    toast('Could not delete account. Please sign out and sign back in, then try again.');
  }
}

/**
 * Maps Firebase Auth error codes to user-friendly messages.
 * Security note: user-not-found and wrong-password return the same message
 * so attackers cannot enumerate valid email addresses.
 * @param {string} code - Firebase Auth error code
 * @returns {string} User-friendly message
 */
function friendlyAuthError(code) {
  const map = {
    'auth/user-not-found':        'Incorrect email or password.',
    'auth/wrong-password':        'Incorrect email or password.',
    'auth/invalid-credential':    'Incorrect email or password.',
    'auth/invalid-email':         'Invalid email address.',
    'auth/email-already-in-use':  'An account with this email already exists. Try signing in instead.',
    'auth/weak-password':         'Password must be at least 6 characters.',
    'auth/too-many-requests':     'Too many attempts. Please wait a few minutes and try again.',
    'auth/network-request-failed':'Network error. Please check your connection.',
    'auth/user-disabled':         'This account has been disabled. Please contact support.',
  };
  return map[code] || 'Sign in failed. Please try again.';
}

// ── Window globals ────────────────────────────────────────────────────────────
window._signIn          = signIn;
window._signUp          = signUp;
window._signInGoogle    = signInGoogle;
window._signInMicrosoft = signInMicrosoft;
window._doSignOut       = doSignOut;
window._confirmSignOut  = confirmSignOut;
window._sendReset       = sendReset;
window._deleteAccount   = deleteAccount;
