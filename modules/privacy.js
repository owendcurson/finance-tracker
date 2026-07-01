import { state } from './state.js';
import { $, toast } from './utils.js';
import { CONTACT_ENDPOINT } from './constants.js';

export function openPrivacy() {
  $('privacy-panel')?.classList.add('open');
}

export function closePrivacy() {
  $('privacy-panel')?.classList.remove('open');
}

export function initContactForm() {
  const form = $('contact-form'); if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name    = ($('cf-name')?.value||'').trim();
    const email   = ($('cf-email')?.value||'').trim();
    const message = ($('cf-message')?.value||'').trim();
    const errEl   = $('cf-error');
    const succEl  = $('cf-success');
    const submitBtn=$('cf-submit');
    if (errEl)  errEl.style.display='none';
    if (succEl) succEl.style.display='none';
    if (!name)    { showCfError(errEl,'Please enter your name.'); return; }
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) { showCfError(errEl,'Please enter a valid email.'); return; }
    if (!message) { showCfError(errEl,'Please enter a message.'); return; }
    if (submitBtn) { submitBtn.disabled=true; submitBtn.textContent='Sending…'; }
    try {
      const res = await fetch(CONTACT_ENDPOINT, {
        method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify({ name, email, message }),
      });
      if (res.ok) {
        form.reset();
        if (succEl) { succEl.textContent='Message sent — thanks!'; succEl.style.display='block'; }
      } else {
        showCfError(errEl,'Something went wrong. Please try again.');
      }
    } catch(e) {
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
