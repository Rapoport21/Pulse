/**
 * lib/surgeDuration — how long Surge Mode stays active before
 * auto-standing-down.
 *
 * Why this exists
 * ---------------
 * Surge Mode was originally session-permanent — once activated it
 * stayed on until an operator explicitly stood it down. That's
 * the clinically correct default, but during demos it meant the
 * screen stayed screaming-red indefinitely after one tap and the
 * operator had to remember to reset before the next visitor.
 *
 * This module adds an opt-in "auto stand-down" timer. The
 * operator picks one of five options in Settings:
 *
 *   30s · 1m · 2m · 5m · Permanent (default)
 *
 * The choice lives in localStorage under `pulse-surge-duration`
 * and is read by `App.tsx`'s `activateSurge` to schedule a
 * `deactivateSurge` call once the window elapses. "Permanent"
 * maps to `null` — no timer is scheduled.
 *
 * Pattern mirrors `lib/uiScale.ts`:
 *   - read / write / apply (here: "apply" is a pure duration
 *     lookup — no DOM side effects)
 *   - silent fallback on storage failures (private mode, etc.)
 *   - safe on SSR
 */

export type SurgeDuration = '30s' | '1m' | '2m' | '5m' | 'permanent';

const STORAGE_KEY = 'pulse-surge-duration';

/** Duration in milliseconds for each choice. `permanent` → null,
 *  signalling "never auto-expire — operator controls dismissal." */
export const SURGE_DURATION_MS: Record<SurgeDuration, number | null> = {
  '30s': 30_000,
  '1m': 60_000,
  '2m': 120_000,
  '5m': 300_000,
  permanent: null,
};

/** Human-readable label used in Settings picker. Kept here so the
 *  Settings UI and any status-line readout agree. */
export const SURGE_DURATION_LABEL: Record<SurgeDuration, string> = {
  '30s': '30 s',
  '1m': '1 min',
  '2m': '2 min',
  '5m': '5 min',
  permanent: 'Permanent',
};

/** Ordered list for the picker — 30s first (fastest demo loop),
 *  Permanent last (the clinical default). */
export const SURGE_DURATION_ORDER: SurgeDuration[] = [
  '30s',
  '1m',
  '2m',
  '5m',
  'permanent',
];

/** Default — clinically correct: once activated, stays active until
 *  the operator explicitly stands down. */
export const DEFAULT_SURGE_DURATION: SurgeDuration = 'permanent';

const isSurgeDuration = (v: string): v is SurgeDuration =>
  v === '30s' || v === '1m' || v === '2m' || v === '5m' || v === 'permanent';

/** Read the persisted choice, defaulting to `permanent`. Safe on SSR. */
export const readSurgeDuration = (): SurgeDuration => {
  if (typeof window === 'undefined') return DEFAULT_SURGE_DURATION;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v && isSurgeDuration(v) ? v : DEFAULT_SURGE_DURATION;
  } catch {
    return DEFAULT_SURGE_DURATION;
  }
};

/** Persist the chosen duration. Swallow storage errors. */
export const writeSurgeDuration = (d: SurgeDuration): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, d);
  } catch {
    /* noop */
  }
};

/** Convenience: look up the current ms window (null = permanent). */
export const readSurgeDurationMs = (): number | null =>
  SURGE_DURATION_MS[readSurgeDuration()];
