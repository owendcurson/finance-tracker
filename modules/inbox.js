import { state } from './state.js';
import { $, esc, fds } from './utils.js';
import { db, collection, doc, setDoc, getDocs, deleteDoc } from './firebase.js';

export function relTime(iso) {
  const d = new Date(iso), now = new Date(), s = Math.round((now - d) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s/60); if (m < 60) return m+'m ago';
  const h = Math.round(m/60); if (h < 24) return h+'h ago';
  const dy = Math.round(h/24); if (dy < 7) return dy+'d ago';
  return fds(d);
}

export function unreadCount() {
  return state.inboxItems.filter(i => !i.read).length;
}

export function updateInboxBadge() {
  const b = $('inbox-badge'); if (!b) return;
  const c = unreadCount();
  if (c > 0) { b.textContent = c > 99 ? '99+' : c; b.style.display = 'flex'; }
  else b.style.display = 'none';
}

export async function loadInbox() {
  if (!state.currentUser) { state.inboxItems = []; updateInboxBadge(); return; }
  try {
    const snap = await getDocs(collection(db, 'users', state.currentUser.uid, 'inbox'));
    const items = []; snap.forEach(d => items.push(d.data()));
    state.inboxItems = items.sort((a, b) => b.id - a.id);
  } catch(e) { state.inboxItems = []; }
  updateInboxBadge();
}

export async function addInboxItem(icon, title, body, action) {
  if (!state.currentUser) return;
  const item = { id:Date.now(), icon, title, body, time:new Date().toISOString(), read:false, action:action||null };
  state.inboxItems.unshift(item);
  try { await setDoc(doc(db,'users',state.currentUser.uid,'inbox',String(item.id)), item); } catch(e){}
  while (state.inboxItems.length > 50) {
    const old = state.inboxItems.pop();
    try { await deleteDoc(doc(db,'users',state.currentUser.uid,'inbox',String(old.id))); } catch(e){}
  }
  updateInboxBadge();
  if ($('inbox-panel')?.classList.contains('open')) renderInbox();
  return item;
}

export function renderInbox() {
  const el = $('inbox-list'); if (!el) return;
  if (!state.inboxItems.length) {
    el.innerHTML = '<div class="empty-state" style="padding:48px 24px"><i class="ti ti-bell empty-state-icon"></i><div class="empty-state-title">Nothing here yet</div><p class="empty-state-text">We\'ll notify you about payday, budget alerts, and spending insights as they happen.</p></div>';
    return;
  }
  el.innerHTML = state.inboxItems.map(it =>
    `<div class="inbox-item${it.read?'':' unread'}" onclick="window._inboxClick(${it.id})">
      <i class="ti ${esc(it.icon||'ti-bell')}"></i>
      <div style="flex:1;min-width:0">
        <div class="inbox-item-title">${esc(it.title)}</div>
        <div class="inbox-item-body">${esc(it.body)}</div>
        <div class="inbox-item-time">${esc(relTime(it.time))}</div>
      </div>${it.read?'':`<span class="inbox-unread-dot"></span>`}
    </div>`
  ).join('');
}

export function openInbox() {
  $('inbox-panel').classList.add('open'); $('inbox-overlay').classList.add('open');
  renderInbox();
}
export function closeInbox() {
  $('inbox-panel').classList.remove('open'); $('inbox-overlay').classList.remove('open');
}

export async function inboxClick(id) {
  const it = state.inboxItems.find(x => x.id === id); if (!it) return;
  if (!it.read) {
    it.read = true; updateInboxBadge(); renderInbox();
    if (state.currentUser) { try { await setDoc(doc(db,'users',state.currentUser.uid,'inbox',String(id)), it); } catch(e){} }
  }
  if (it.action === 'tracker') { closeInbox(); import('./tracker.js').then(m => { m.clearTracker(); m.showTracker(); }); }
  else if (it.action === 'dashboard') { closeInbox(); import('./dashboard.js').then(m => m.showDashboard()); }
}

export async function markAllRead() {
  const changed = state.inboxItems.filter(i => !i.read);
  changed.forEach(i => i.read = true);
  updateInboxBadge(); renderInbox();
  if (state.currentUser) {
    for (const i of changed) { try { await setDoc(doc(db,'users',state.currentUser.uid,'inbox',String(i.id)), i); } catch(e){} }
  }
}

window._inboxClick = inboxClick;
