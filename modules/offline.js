import { showOfflineBanner } from './ui.js';

export function initOfflineListeners() {
  window.addEventListener('offline', () => showOfflineBanner('offline'));
  window.addEventListener('online',  () => showOfflineBanner('online'));
  if (!navigator.onLine) showOfflineBanner('offline');
}
