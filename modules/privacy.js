import { state } from './state.js';
import { $, toast } from './utils.js';
import { CONTACT_ENDPOINT } from './constants.js';

export function openPrivacy() {
  const p = $('privacy-panel'); if (!p) return;
  p.style.display = 'block'; void p.offsetWidth; p.style.opacity = '1';
}

export function closePrivacy() {
  const p = $('privacy-panel'); if (!p) return;
  p.style.opacity = '0'; setTimeout(() => p.style.display = 'none', 220);
}

// ── Contact form rate limiting ────────────────────────────────────────────────
const RATE_LIMIT_KEY   = 'cf_submissions';
const RATE_LIMIT_MAX   = 3;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function getRateLimitData() {
  try { return JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '{"count":0,"windowStart":0}'); }
  catch(e) { return { count: 0, windowStart: 0 }; }
}

function checkRateLimit() {
  const data = getRateLimitData();
  const now  = Date.now();
  if (now - data.windowStart > RATE_LIMIT_WINDOW) {
    // Window has expired — reset
    const reset = { count: 0, windowStart: now };
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(reset));
    return true;
  }
  return data.count < RATE_LIMIT_MAX;
}

function incrementRateLimit() {
  const data = getRateLimitData();
  const now  = Date.now();
  const windowStart = now - data.windowStart > RATE_LIMIT_WINDOW ? now : data.windowStart;
  const count = now - data.windowStart > RATE_LIMIT_WINDOW ? 1 : data.count + 1;
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ count, windowStart }));
}

// ── Contact form init ─────────────────────────────────────────────────────────
export function initContactForm() {
  const form = $('contact-form'); if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name    = ($('cf-name')?.value||'').trim();
    const email   = ($('cf-email')?.value||'').trim();
    const subject = ($('cf-subject')?.value||'').trim();
    const message = ($('cf-message')?.value||'').trim();
    const errEl   = $('cf-error');
    const succEl  = $('cf-success');
    const submitBtn=$('cf-submit');
    if (errEl)  errEl.style.display='none';
    if (succEl) succEl.style.display='none';

    // Rate limit check
    if (!checkRateLimit()) {
      showCfError(errEl, "You've sent too many messages. Please try again in an hour.");
      return;
    }

    // Field validation
    if (!name || name.length < 2 || name.length > 100) {
      showCfError(errEl, 'Please enter your name (2–100 characters).'); return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      showCfError(errEl, 'Please enter a valid email address.'); return;
    }
    if (!message || message.length < 10) {
      showCfError(errEl, 'Message must be at least 10 characters.'); return;
    }
    if (message.length > 2000) {
      showCfError(errEl, 'Message must be 2,000 characters or fewer.'); return;
    }

    if (submitBtn) { submitBtn.disabled=true; submitBtn.textContent='Sending…'; }
    try {
      const body = { name, email, message };
      if (subject) body.subject = subject; // only include if present in form
      const res = await fetch(CONTACT_ENDPOINT, {
        method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify(body),
      });
      if (res.ok) {
        incrementRateLimit();
        form.reset();
        if (succEl) { succEl.textContent='Message sent. Thanks!'; succEl.style.display='block'; }
      } else {
        showCfError(errEl,'Something went wrong. Please try again.');
      }
    } catch(e) {
      console.error('Contact form submission failed:', e);
      showCfError(errEl,'Network error. Please check your connection.');
    } finally {
      if (submitBtn) { submitBtn.disabled=false; submitBtn.textContent='Send Message'; }
    }
  });

  // Pre-fill from Firebase auth
  if (state.currentUser) {
    const nameEl  = $('cf-name');
    const emailEl = $('cf-email');
    if (nameEl  && !nameEl.value)  nameEl.value  = state.currentUser.displayName || '';
    if (emailEl && !emailEl.value) emailEl.value = state.currentUser.email || '';
  }
}

function showCfError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

window._openPrivacy  = openPrivacy;
window._closePrivacy = closePrivacy;

// ── Help FAB modal ────────────────────────────────────────────────────────────
export function openHelpModal() {
  const modal = $('help-modal'); if (!modal) return;
  modal.style.display = 'block';
  if (state.currentUser) {
    const n = $('hcf-name'), e = $('hcf-email');
    if (n && !n.value) n.value = state.currentUser.displayName || '';
    if (e && !e.value) e.value = state.currentUser.email || '';
  }
  const form = $('help-contact-form'); if (!form) return;
  if (form._helpBound) return;
  form._helpBound = true;
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const name    = ($('hcf-name')?.value||'').trim();
    const email   = ($('hcf-email')?.value||'').trim();
    const message = ($('hcf-message')?.value||'').trim();
    const errEl   = $('hcf-error');
    const succEl  = $('hcf-success');
    const btn     = $('hcf-submit');
    if (errEl) errEl.style.display = 'none';
    if (succEl) succEl.style.display = 'none';
    if (!checkRateLimit()) { if(errEl){errEl.textContent="Too many messages. Try again in an hour.";errEl.style.display='block';} return; }
    if (!name || name.length < 2) { if(errEl){errEl.textContent='Please enter your name.';errEl.style.display='block';} return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { if(errEl){errEl.textContent='Please enter a valid email.';errEl.style.display='block';} return; }
    if (!message || message.length < 10) { if(errEl){errEl.textContent='Message must be at least 10 characters.';errEl.style.display='block';} return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    try {
      const res = await fetch(CONTACT_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      if (res.ok) {
        incrementRateLimit();
        form.reset();
        if (succEl) { succEl.textContent = 'Message sent. Thanks!'; succEl.style.display = 'block'; }
        setTimeout(() => closeHelpModal(), 2000);
      } else {
        if (errEl) { errEl.textContent = 'Something went wrong. Please try again.'; errEl.style.display = 'block'; }
      }
    } catch(e) {
      if (errEl) { errEl.textContent = 'Network error. Check your connection.'; errEl.style.display = 'block'; }
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-send"></i> Send message'; }
    }
  });
}

export function closeHelpModal() {
  const modal = $('help-modal'); if (!modal) return;
  modal.style.display = 'none';
}

window._openHelpModal  = openHelpModal;
window._closeHelpModal = closeHelpModal;
