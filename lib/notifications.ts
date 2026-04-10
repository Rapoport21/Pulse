/**
 * Notification + vibration helpers.
 *
 * - Permission is requested on the first user click anywhere in the app
 *   (browsers block requests at mount). We attach a one-shot listener.
 * - If denied, callers should fall back to an in-app toast.
 */

let permissionRequested = false;

export type NotificationOutcome = 'granted' | 'denied' | 'default' | 'unsupported';

export function getNotificationPermission(): NotificationOutcome {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotificationOutcome;
}

export function installFirstClickPermissionListener(): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    if (permissionRequested) return;
    permissionRequested = true;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };
  window.addEventListener('click', handler, { once: false });
  return () => window.removeEventListener('click', handler);
}

export function fireSurgeNotification(taskCount: number): NotificationOutcome {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  const perm = Notification.permission as NotificationOutcome;
  if (perm === 'granted') {
    try {
      new Notification('🚨 PULSE — Surge Mode Activated', {
        body: `${taskCount} urgent tasks assigned`,
        tag: 'pulse-surge',
        icon: './icon-192.png',
      });
    } catch (e) {
      console.warn('[notifications] failed to fire', e);
    }
  }
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      // ignore
    }
  }
  return perm;
}
