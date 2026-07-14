import { state } from './state.js';
import { $, toast } from './utils.js';
import { auth, db, doc, getDoc, setDoc, collection, getDocs,
         onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
         signOut, sendPasswordResetEmail, deleteUser,
         signInWithPopup, googleProvider, microsoftProvider } from './firebase.js';
import { initBH } from './payday.js';
import { loadSettingsFS } from './settings.js';

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
    // months
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
    import('./tracker.js').then(m => m.loadLocal());
    state.fsSynced = true;
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
      import('./notifications.js').then(m => m.maybeShowNotifBanner?.());
      import('./payday_modal.js').then(m => m.maybeShowPayday?.());
    } else {
      state.currentUser = null;
      state.fsSynced = false;
      import('./tracker.js').then(m => m.loadLocal());
      showAuthScreen();
    }
  });
}

// ── Sign in / sign up ─────────────────────────────────────────────────────────
export async function signIn() {
  const email = $('signin-email')?.value.trim();
  const pass  = $('signin-pass')?.value;
  authErr('signin-error','');
  if (!email || !pass) { authErr('signin-error','Enter email and password.'); return; }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(e) {
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
    state.isNewUser = false;
    authErr('signup-error', friendlyAuthError(e.code));
  }
}

export async function signInGoogle() {
  try { await signInWithPopup(auth, googleProvider); }
  catch(e) { if (e.code !== 'auth/popup-closed-by-user') toast('Google sign-in failed: '+e.message); }
}

export async function signInMicrosoft() {
  try { await signInWithPopup(auth, microsoftProvider); }
  catch(e) { if (e.code !== 'auth/popup-closed-by-user') toast('Microsoft sign-in failed: '+e.message); }
}

export async function doSignOut() {
  if (!confirm('Sign out?')) return;
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
    toast('Could not send reset: '+friendlyAuthError(e.code));
  }
}

export async function deleteAccount() {
  if (!state.currentUser) return;
  if (!confirm('Delete your account and all data permanently? This cannot be undone.')) return;
  try {
    const uid = state.currentUser.uid;
    // Delete Firestore data (best effort)
    const mSnap = await getDocs(collection(db,'users',uid,'months'));
    await Promise.all(mSnap.docs.map(d => d.ref.delete?.())).catch(()=>{});
    await deleteUser(state.currentUser);
    state.currentUser = null;
    state.financeHistory = [];
    localStorage.clear();
    toast('Account deleted');
  } catch(e) {
    toast('Could not delete account: '+e.message);
  }
}

function friendlyAuthError(code) {
  const map = {
    'auth/user-not-found':   'No account found with this email.',
    'auth/wrong-password':   'Incorrect password.',
    'auth/invalid-email':    'Invalid email address.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/weak-password':    'Password is too weak.',
    'auth/too-many-requests':'Too many attempts. Please try again later.',
    'auth/network-request-failed':'Network error. Check your connection.',
    'auth/invalid-credential':'Invalid email or password.',
  };
  return map[code] || 'An error occurred. Please try again.';
}

// ── Window globals ────────────────────────────────────────────────────────────
window._signIn       = signIn;
window._signUp       = signUp;
window._signInGoogle    = signInGoogle;
window._signInMicrosoft = signInMicrosoft;
window._doSignOut    = doSignOut;
window._sendReset    = sendReset;
window._deleteAccount= deleteAccount;
