/**
 * PULSE marketing tokens — mirrors /Users/nickrapoport/Documents/PULSE/components/design/tokens.ts
 * Trimmed to the surface the marketing site actually uses.
 */

export const COLORS = {
  bg: '#050505',
  bgDeep: '#020202',
  surface: '#0A0A0A',
  surfaceElev: '#0F0F0F',
  surfaceHover: '#141414',
  border: '#1C1C1C',
  borderStrong: '#2A2A2A',
  borderHover: '#333333',
  textPrimary: '#FAFAFA',
  textSecondary: '#A3A3A3',
  textMuted: '#525252',
  textDim: '#5A5A5A',
  textFaint: '#1A1A1A',
  accent: '#E11D48',
  accentBright: '#F43F5E',
  accentDeep: '#9F1239',
  accentDim: 'rgba(225, 29, 72, 0.12)',
  accentGlow: 'rgba(225, 29, 72, 0.35)',
  ok: '#10B981',
  warn: '#F59E0B',
  crit: '#EF4444',
  info: '#3B82F6',
} as const;

export const FONTS = {
  sans: '"Geist", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif',
  mono: '"Geist Mono", ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
} as const;

export const EASE = {
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
  smooth: [0.22, 1, 0.36, 1] as [number, number, number, number],
};
