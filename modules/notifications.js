import { state } from './state.js';
import { $, toast } from './utils.js';
import { getPD } from './payday.js';
import { MF } from './constants.js';

export function notifSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function maybeShowNotifBanner() {
  if (!notifSupported()) return;
  if (Notification.permission === 'granted') return;
  if (localStorage.getItem('notif_banner_dismissed')) return;
  const b = $('notif-banner'); if (!b) return;
  b.style.display = 'block';
}

export async function enableNotifications() {
  if (!notifSupported()) { toast('Notifications not supported on this device'); return; }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    toast('Notifications enabled');
    $('notif-banner')?.style.setProperty('display','none');
    localStorage.setItem('notif_banner_dismissed','1');
    fireNotification('Finance Tracker', 'Payday notifications are now enabled!');
  } else {
    toast('Notification permission denied');
  }
}

export function dismissNotifBanner() {
  $('notif-banner')?.style.setProperty('display','none');
  localStorage.setItem('notif_banner_dismissed','1');
}

export function fireNotification(title, body) {
  if (Notification.permission !== 'granted') return;
  try {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, { body, icon: '/finance-tracker/icons/icon-192.png', badge: '/finance-tracker/icons/icon-192.png' });
    }).catch(() => new Notification(title, { body }));
  } catch(e) {
    try { new Notification(title, { body }); } catch(e2) {}
  }
}

export function checkPaydayNotifications() {
  if (Notification.permission !== 'granted') return;
  const now = new Date(); now.setHours(0,0,0,0);
  const pd = getPD(now.getFullYear(), now.getMonth()).payDate; pd.setHours(0,0,0,0);
  const diffDays = Math.ceil((pd - now) / 86400000);
  const key = `notif_sent_${now.getFullYear()}_${now.getMonth()}`;
  const sent = JSON.parse(localStorage.getItem(key)||'{}');
  if (diffDays === 3 && !sent.d3) {
    fireNotification('Payday in 3 days 💰', `You get paid on ${pd.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}`);
    sent.d3=true; localStorage.setItem(key,JSON.stringify(sent));
  }
  if (diffDays === 1 && !sent.d1) {
    fireNotification('Payday tomorrow! 🎉', `Don\'t forget to track your spending.`);
    sent.d1=true; localStorage.setItem(key,JSON.stringify(sent));
  }
  if (diffDays === 0 && !sent.d0) {
    fireNotification('It\'s payday! 💸', `Time to update your finance tracker.`);
    sent.d0=true; localStorage.setItem(key,JSON.stringify(sent));
  }
}

window._enableNotifications  = enableNotifications;
window._dismissNotifBanner   = dismissNotifBanner;
