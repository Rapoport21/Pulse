/**
 * Global haptic feedback for every selection in the app.
 *
 * On iOS (Capacitor native) this drives the Taptic Engine via
 * @capacitor/haptics. On web it falls back to navigator.vibrate, which
 * works on Android Chrome but is a no-op on iOS Safari (Apple never
 * implemented the Vibration API).
 *
 * `installGlobalHapticListener` attaches a single capture-phase click
 * listener that fires a light tap whenever the user clicks anything
 * that looks interactive (button, [role=button], a[href], input of
 * type checkbox/radio/button/submit). This means you don't have to
 * touch every onClick handler — flipping this one switch in App.tsx
 * haptic-enables the whole app.
 */

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const isNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export type HapticStyle = 'light' | 'medium' | 'heavy';

const WEB_VIBRATE_MS: Record<HapticStyle, number> = {
  light: 8,
  medium: 15,
  heavy: 25,
};

/**
 * Fire a one-shot haptic tap. Safe to call from anywhere — errors are
 * swallowed because haptics must never break UI flow.
 */
export function triggerHaptic(style: HapticStyle = 'light'): void {
  if (isNative()) {
    const impactStyle =
      style === 'heavy'
        ? ImpactStyle.Heavy
        : style === 'medium'
          ? ImpactStyle.Medium
          : ImpactStyle.Light;
    Haptics.impact({ style: impactStyle }).catch(() => {});
    return;
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(WEB_VIBRATE_MS[style]);
    } catch {
      // ignore
    }
  }
}

// Matches anything the user would conceptually "tap" or "select".
// We deliberately exclude text inputs and textareas so typing doesn't
// buzz on every keystroke.
const INTERACTIVE_SELECTOR =
  'button, [role="button"], [role="tab"], [role="menuitem"], [role="option"], a[href], input[type="checkbox"], input[type="radio"], input[type="button"], input[type="submit"], select';

/**
 * Attach a global click listener that fires a light haptic tap on
 * every interactive element click. Returns an unsubscribe function.
 *
 * We use capture phase so we fire BEFORE any React handler that might
 * stopPropagation, and we check for `disabled` to skip disabled
 * controls.
 */
export function installGlobalHapticListener(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: Event) => {
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== 'function') return;

    const el = target.closest(INTERACTIVE_SELECTOR);
    if (!el) return;

    // Respect disabled state on form controls.
    if ((el as HTMLButtonElement).disabled) return;
    if (el.getAttribute('aria-disabled') === 'true') return;

    triggerHaptic('light');
  };

  window.addEventListener('click', handler, { capture: true });
  return () => window.removeEventListener('click', handler, { capture: true });
}
