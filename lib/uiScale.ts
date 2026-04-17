/**
 * lib/uiScale — opt-in larger UI scale.
 *
 * Default sizing is the tactical-HUD baseline that ships in `tokens.ts`
 * and the 50-ish files that hardcode `fontSize: N` literals. Some
 * operators — particularly on scratched iPads or in bright-light
 * conditions — want a larger read without switching to native iOS
 * accessibility zoom. This module wires a single toggle in Settings
 * to a persistent localStorage flag and applies it via `zoom` on the
 * document element.
 *
 * Why `zoom` and not a token swap:
 *   - Tokens are absolute `px` and imported directly by ~50 files. A
 *     runtime token swap would require either a React context consumed
 *     by every `fontSize: TYPE.mono.size` call site, or a full rem
 *     refactor. Neither is worth shipping for an opt-in density toggle.
 *   - `zoom` on `<html>` scales every descendant uniformly (fonts,
 *     icons, borders, padding, spacing, chart axes). Identical visual
 *     effect to a global multiplier with no component-level edits.
 *   - Supported in WebKit (Safari, Capacitor iOS WebView), Blink
 *     (Chrome/Edge), and Gecko (Firefox ≥126, May 2024). All three
 *     surfaces PULSE ships on.
 *
 * Known trade-offs for the "large" state:
 *   - Layouts that budget against `100vh` (e.g., Horizon's
 *     single-viewport fit) may overflow. Users opting into large are
 *     accepting some scroll.
 *   - `window.innerWidth` reports the pre-zoom value, so breakpoint
 *     media queries keep their boundaries. Usually what we want.
 */

export type UiScale = 'default' | 'large';

const STORAGE_KEY = 'pulse-ui-scale';

/** Zoom factors per scale. Kept here so Settings and applyUiScale agree. */
export const UI_SCALE_FACTOR: Record<UiScale, number> = {
  default: 1,
  // +15% — same order of magnitude as the second-pass bump Nick called
  // "way too big" when shipped as the default, but appropriate as
  // opt-in for operators who genuinely want it larger.
  large: 1.15,
};

/** Read the persisted scale, defaulting to 'default'. Safe on SSR. */
export const readUiScale = (): UiScale => {
  if (typeof window === 'undefined') return 'default';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'large' ? 'large' : 'default';
  } catch {
    return 'default';
  }
};

/** Persist the chosen scale. Swallow storage errors (private mode, etc). */
export const writeUiScale = (scale: UiScale): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, scale);
  } catch {
    /* noop */
  }
};

/**
 * Apply a scale to the document element. Safe to call repeatedly; calling
 * with 'default' resets zoom to the unset state so no inline style lingers.
 */
export const applyUiScale = (scale: UiScale): void => {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  const factor = UI_SCALE_FACTOR[scale];
  // Setting zoom to '' (empty string) removes the inline style, letting the
  // page fall back to the browser default of 1. Setting to a string like
  // '1.15' is the supported cross-engine form.
  (el.style as unknown as Record<string, string>).zoom = factor === 1 ? '' : String(factor);
};

/** Read-and-apply in one call. Used once on app mount. */
export const initUiScale = (): void => {
  applyUiScale(readUiScale());
};
