/**
 * PULSE Tactical Design Tokens
 *
 * Source of truth for every color, font, radius, duration, and easing
 * curve used by the Tactical visual direction. Import from here rather
 * than hard-coding — if we ever tune the palette, we tune it once.
 *
 * Aesthetic: Palantir / Anduril tactical HUD × PULSE boot-screen language.
 * - Near-black canvas, sharp corners, monospace data, rose-600 accent.
 * - Corner brackets, scanlines, status pills are the signature chrome.
 * - Accent is scarce — reserved for active, critical, and actionable moments.
 */

// ─────────────────────────────────────────────────────────────────────────
// Runtime overrides — Settings → Contrast check writes a textDim choice
// into localStorage under `pulse-text-dim`. Reading at module load lets the
// whole app pick up the override on refresh without touching every usage.
// ─────────────────────────────────────────────────────────────────────────
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
// WCAG AA on the #050505 canvas — 5.0:1 contrast. Picked after the
// Settings → Display → Contrast check review. Previous value #2E2E2E
// was at ~1.5:1 (FAIL). See docs/improvement-ideas.md T3.4.
const TEXT_DIM_DEFAULT = '#5A5A5A';
const readTextDimOverride = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem('pulse-text-dim');
    return v && HEX_RE.test(v) ? v : null;
  } catch {
    return null;
  }
};
export const TEXT_DIM_DEFAULT_HEX = TEXT_DIM_DEFAULT;

// ─────────────────────────────────────────────────────────────────────────
// Colors
// ─────────────────────────────────────────────────────────────────────────
export const COLORS = {
  // Canvas — pure near-black, warmer than absolute #000 to reduce eye strain
  bg: '#050505',
  bgDeep: '#020202',

  // Surfaces — zinc-adjacent grays for cards, panels, elevated layers
  surface: '#0A0A0A',
  surfaceElev: '#0F0F0F',
  surfaceHover: '#141414',

  // Borders — increasing strength
  border: '#1C1C1C',
  borderStrong: '#2A2A2A',
  borderHover: '#333333',

  // Text — warm off-whites and neutrals
  textPrimary: '#FAFAFA',
  textSecondary: '#A3A3A3',
  textMuted: '#525252',
  textDim: readTextDimOverride() ?? TEXT_DIM_DEFAULT,
  textFaint: '#1A1A1A',

  // Brand accent — rose-600 (matches boot screen + login)
  accent: '#E11D48',
  accentBright: '#F43F5E',
  accentDeep: '#9F1239', // rose-800 — darker variant used for gradients
  accentDim: 'rgba(225, 29, 72, 0.12)',
  accentGlow: 'rgba(225, 29, 72, 0.35)',

  // Status palette — used throughout metrics, alerts, and pills
  ok: '#10B981', // emerald-500
  okDim: 'rgba(16, 185, 129, 0.12)',
  warn: '#F59E0B', // amber-500
  warnDim: 'rgba(245, 158, 11, 0.12)',
  crit: '#EF4444', // red-500 (distinct from rose accent)
  critDim: 'rgba(239, 68, 68, 0.12)',
  info: '#3B82F6', // blue-500
  infoDim: 'rgba(59, 130, 246, 0.12)',
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────────────────────────────────
export const FONTS = {
  sans: '"Geist", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif',
  mono: '"Geist Mono", ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
} as const;

/** Consistent type scale — use these rather than arbitrary sizes
 *
 * 2026-04-17 · Back to baseline. The morning's ~10-12% bump and the
 * afternoon's +15% on top were both rejected ("still too tiny" and
 * "way too big"), and the revert-the-big-bump-only state was also
 * flagged as "too large — need to be closer to what it was before."
 * So we're back at pre-bump values. See docs/decisions.md.
 */
export const TYPE = {
  // Display — hero numerics and headlines
  display: { size: 64, weight: 600, tracking: '-0.05em', lineHeight: 0.9 },
  displaySm: { size: 48, weight: 600, tracking: '-0.04em', lineHeight: 0.95 },

  // Section titles
  h1: { size: 34, weight: 600, tracking: '-0.02em', lineHeight: 1.15 },
  h2: { size: 26, weight: 600, tracking: '-0.02em', lineHeight: 1.2 },
  h3: { size: 21, weight: 600, tracking: '-0.015em', lineHeight: 1.25 },
  h4: { size: 17, weight: 600, tracking: '-0.01em', lineHeight: 1.3 },

  // Body
  body: { size: 16, weight: 400, tracking: '-0.005em', lineHeight: 1.5 },
  bodySm: { size: 14, weight: 400, tracking: '-0.003em', lineHeight: 1.45 },

  // Mono (data, labels, metadata)
  mono: { size: 13, weight: 500, tracking: '0.12em', lineHeight: 1.25 },
  monoSm: { size: 12, weight: 500, tracking: '0.12em', lineHeight: 1.25 },
  monoXs: { size: 11, weight: 500, tracking: '0.14em', lineHeight: 1.25 },
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Layout — spacing scale, radii, z-index
// ─────────────────────────────────────────────────────────────────────────
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 56,
  '5xl': 72,
} as const;

/** Sharp by default — industrial-brutalist mandate: 90° corners.
 *  RADIUS.sm is kept at 2 for legacy compatibility with existing
 *  tactical surfaces, but new brutalist work uses RADIUS.none = 0
 *  and treats anything else as a deliberate exception. */
export const RADIUS = {
  none: 0,
  sm: 2,  // legacy — existing cards/buttons. New brutalist work uses 0.
  md: 4,  // legacy
  lg: 6,  // legacy
  full: 999, // for dots, status pills, avatars (the only exception)
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Macro typography clamps — for industrial-brutalist hero displays.
// These are intentionally enormous, sized fluidly via CSS clamp().
// Use sparingly — one per surface max. Text becomes structure.
// ─────────────────────────────────────────────────────────────────────────
export const MACRO = {
  /** Building-block hero — boot wordmark, login header.
   *  6rem floor at narrow viewports, ~14vw fluid, 12rem ceiling. */
  hero: 'clamp(6rem, 14vw, 12rem)',
  /** Section banner — large uppercase callouts. */
  banner: 'clamp(3rem, 7vw, 6rem)',
  /** Architectural number — large numerics that anchor a layout. */
  num: 'clamp(4rem, 10vw, 8rem)',
} as const;

// ─────────────────────────────────────────────────────────────────────────
// CRT scanline overlay — static repeating-linear-gradient
//
// Apply as a `background-image` on the page canvas (or a
// pointer-events:none overlay layer). Multiple presets for different
// substrates: subtle for app shell, stronger for hero/boot surfaces.
// ─────────────────────────────────────────────────────────────────────────
export const SCANLINES = {
  /** Subtle — for app shell. Barely visible, just enough texture. */
  subtle:
    'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.012) 2px, rgba(255, 255, 255, 0.012) 3px)',
  /** Medium — for boot, login. Reads as CRT-on. */
  medium:
    'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255, 255, 255, 0.025) 3px, rgba(255, 255, 255, 0.025) 4px)',
  /** Strong — for terminal frames within heroes. */
  strong:
    'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.04) 2px, rgba(255, 255, 255, 0.04) 3px)',
} as const;

export const Z = {
  base: 0,
  raised: 10,
  sticky: 20,
  overlay: 30,
  header: 40,
  modal: 50,
  toast: 100,
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Mobile layout constants
// ─────────────────────────────────────────────────────────────────────────

/**
 * Intrinsic height of the mobile bottom tab bar (padding + 48px button + border)
 * BEFORE the safe-area-inset-bottom is added. Kept in lockstep with MobileView's
 * <nav> element.
 */
export const MOBILE_NAV_BAR_HEIGHT_PX = 53;

/**
 * CSS value to use as `bottom` on a fullscreen mobile overlay so that the
 * bottom HUD tab bar in MobileView stays visible underneath it.
 *
 * Matches the rendered height of MobileView's <nav>:
 *   53px (padding + button + border) + max(env(safe-area-inset-bottom), 4px)
 *
 * Use in place of `inset: 0` / `bottom: 0` on any mobile-fullscreen overlay.
 */
export const MOBILE_NAV_OVERLAY_INSET_BOTTOM =
  `calc(${MOBILE_NAV_BAR_HEIGHT_PX}px + max(env(safe-area-inset-bottom), 4px))` as const;

// ─────────────────────────────────────────────────────────────────────────
// Motion — reserved, deliberate
// ─────────────────────────────────────────────────────────────────────────
export const MOTION = {
  /** Primary easing — decelerating out-expo curve */
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  /** Secondary easing — for ambient loops and subtle moves */
  easeSmooth: [0.22, 1, 0.36, 1] as [number, number, number, number],
  /** Linear easing for scanning lines */
  linear: 'linear' as const,

  /** CSS-string versions of the Motion ease tuples. The Framer Motion
   *  array tuples don't work in inline-style `transition:` strings —
   *  browsers need a cubic-bezier() expression. These mirror `ease` /
   *  `easeSmooth` / a drawer-style curve, so CSS transitions get the
   *  same custom feel Framer Motion gets, instead of falling back to
   *  the browser's weak default `ease` keyword. */
  cssEase: 'cubic-bezier(0.16, 1, 0.3, 1)' as const,
  cssEaseSmooth: 'cubic-bezier(0.22, 1, 0.36, 1)' as const,
  cssEaseInOut: 'cubic-bezier(0.77, 0, 0.175, 1)' as const,
  cssEaseDrawer: 'cubic-bezier(0.32, 0.72, 0, 1)' as const,

  // Durations in seconds (motion/react convention)
  fast: 0.18,
  base: 0.28,
  slow: 0.45,
  slower: 0.65,
  ambient: 14, // slow scanning horizontal line
} as const;

/**
 * Build a named-property CSS transition string with the custom ease
 * curve. Covers the standard interactive-surface properties we animate
 * on cards, tiles, buttons, and rows. Skips layout-triggering props
 * (width / height / padding / margin / font-size) that `transition: all`
 * would unnecessarily include and that force reflow.
 *
 * Use this in inline `style` objects:
 *
 *   transition: cssTransition()             // MOTION.fast, default
 *   transition: cssTransition(MOTION.base)  // slower for modals / cards
 *
 * Pass a specific properties array for non-standard cases:
 *
 *   transition: cssTransition(MOTION.fast, ['transform', 'opacity'])
 */
export const CSS_TRANSITION_INTERACTIVE_PROPS = [
  'background',
  'border-color',
  'color',
  'box-shadow',
  'transform',
  'opacity',
] as const;

export const cssTransition = (
  duration: number = MOTION.fast,
  properties: ReadonlyArray<string> = CSS_TRANSITION_INTERACTIVE_PROPS,
): string => {
  const d = `${duration}s`;
  const e = MOTION.cssEase;
  return properties.map((p) => `${p} ${d} ${e}`).join(', ');
};

// ─────────────────────────────────────────────────────────────────────────
// Chrome heights — ensures boot/login/shell align to the same grid
// ─────────────────────────────────────────────────────────────────────────
export const CHROME = {
  headerHeight: 56,    // top HUD strip / desktop header
  footerHeight: 36,    // bottom HUD ticker
  mobileNavHeight: 64, // mobile bottom tab bar
  sidebarWidth: 300,   // command sidebar
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Convenience: combined shadow presets
// ─────────────────────────────────────────────────────────────────────────
export const SHADOW = {
  accentGlow: `0 0 24px ${COLORS.accentGlow}`,
  accentGlowSm: `0 0 12px ${COLORS.accentGlow}`,
  okGlow: `0 0 12px ${COLORS.ok}`,
  warnGlow: `0 0 12px ${COLORS.warn}`,
  critGlow: `0 0 12px ${COLORS.crit}`,
  panel: '0 4px 24px rgba(0, 0, 0, 0.5)',
  modal: '0 16px 48px rgba(0, 0, 0, 0.8)',
} as const;
