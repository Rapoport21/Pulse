/**
 * Notification + haptic helpers.
 *
 * Cross-platform: on iOS (Capacitor native) uses @capacitor/haptics and
 * @capacitor/local-notifications so the Taptic Engine + iOS notification
 * banner actually fire. On the web it falls back to the browser
 * Notification API and navigator.vibrate (both unsupported in iOS Safari
 * but work on desktop / Android Chrome).
 *
 * - Permission is requested on the first user click anywhere in the app
 *   (browsers and iOS both block requests at mount). We attach a
 *   one-shot listener.
 * - If denied, callers should fall back to an in-app toast.
 */

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';

let permissionRequested = false;

export type NotificationOutcome = 'granted' | 'denied' | 'default' | 'unsupported';

const isNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export function getNotificationPermission(): NotificationOutcome {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotificationOutcome;
}

export function installFirstClickPermissionListener(): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    if (permissionRequested) return;
    permissionRequested = true;

    if (isNative()) {
      // Ask iOS for local-notification permission on first tap.
      LocalNotifications.requestPermissions().catch((err) => {
        console.warn('[notifications] native permission request failed', err);
      });
      return;
    }

    // Web fallback
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };
  window.addEventListener('click', handler, { once: false });
  return () => window.removeEventListener('click', handler);
}

/**
 * Fires the "surge activated" alert flourish. On iOS this uses the Taptic
 * Engine + a local notification banner. On web it uses the Notification
 * API + navigator.vibrate. Always returns a best-effort outcome so callers
 * can fall back to an in-app toast.
 */
export function fireSurgeNotification(taskCount: number): NotificationOutcome {
  // Native iOS path (Capacitor)
  if (isNative()) {
    // Haptic: immediate, no permission needed.
    Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});

    // Local notification: requires permission, fire-and-forget.
    LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 2147483647),
          title: '🚨 PULSE — Surge Mode Activated',
          body: `${taskCount} urgent tasks assigned`,
          schedule: { at: new Date(Date.now() + 100) },
          sound: undefined,
        },
      ],
    }).catch((err) => {
      console.warn('[notifications] native schedule failed', err);
    });

    return 'granted';
  }

  // Web path
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
