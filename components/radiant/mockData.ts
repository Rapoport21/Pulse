/**
 * Pulse Radiant — mock 24h time-series + connection graph per widget.
 *
 * Deterministic seed-from-id so every widget gets a stable, repeatable
 * history. Real data would come from the corresponding telemetry feed
 * — this file mocks the shape so the detail card can render.
 */

export interface WidgetSeries {
  /** 48 points, one per 30-min slot over the last 24h. */
  points: number[];
  /** Min over the 24h window. */
  min: number;
  /** Max over the 24h window. */
  max: number;
  /** Mean over the 24h window. */
  avg: number;
  /** Standard deviation over the 24h window. */
  stddev: number;
  /** Current value (last point). */
  current: number;
  /** Value 1 hour ago (point at index 46). */
  hourAgo: number;
  /** Percent delta vs 1 hour ago (0..1, signed). */
  deltaHour: number;
  /** Approximate freshness — seconds since last update. */
  staleSeconds: number;
}

export interface WidgetConnection {
  /** Display label of the downstream pattern widget */
  label: string;
  /** Correlation strength 0..1 */
  correlation: number;
}

const seedRand = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

/**
 * Build a 48-point series for a widget. Uses smoothed random walk so
 * the sparkline reads as a real signal, not pure noise. Bias the
 * shape so it plausibly trends toward the widget's "current" value.
 */
export const buildSeries = (widgetId: number, currentValue: number): WidgetSeries => {
  const rand = seedRand(widgetId * 31 + 7);
  const N = 48;
  const points: number[] = [];

  // Pick an amplitude relative to currentValue (or 1 if currentValue is
  // tiny). Walk from a starting value back to currentValue with
  // smoothed noise.
  const scale = Math.max(Math.abs(currentValue) * 0.4, 1);
  let value = currentValue + (rand() - 0.5) * scale * 2;
  let velocity = 0;
  for (let i = 0; i < N; i++) {
    // Mean-revert toward the target as we approach the end
    const targetPull = (currentValue - value) * 0.06;
    velocity += targetPull + (rand() - 0.5) * scale * 0.18;
    velocity *= 0.82; // damping
    value += velocity;
    points.push(value);
  }

  // Force the last point to be the canonical current value so the
  // hero number matches the sparkline endpoint.
  points[N - 1] = currentValue;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const avg = points.reduce((a, b) => a + b, 0) / N;
  const variance = points.reduce((a, b) => a + (b - avg) * (b - avg), 0) / N;
  const stddev = Math.sqrt(variance);
  const hourAgo = points[N - 3]; // 1h = 2 slots back
  const deltaHour = hourAgo === 0 ? 0 : (currentValue - hourAgo) / Math.abs(hourAgo);

  // Freshness — pseudo-random "seconds since update" for flavor
  const staleSeconds = Math.floor(rand() * 80) + 4;

  return { points, min, max, avg, stddev, current: currentValue, hourAgo, deltaHour, staleSeconds };
};

/**
 * Try to coerce a widget's "value" string into a number for plotting.
 * Strips currency, %, units, "+", "−" minus signs, etc. Returns 0 if
 * nothing numeric is found.
 */
export const numericFromValue = (raw: string | undefined): number => {
  if (!raw) return 0;
  // Replace unicode minus with ASCII minus, strip + sign
  const cleaned = raw.replace(/−/g, '-').replace(/\+/g, '');
  const m = cleaned.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
};

/**
 * For a focused widget, build a list of plausible downstream pattern
 * connections. Deterministic from id.
 */
const PATTERN_NAMES = [
  'Surge protocol HOT',
  'EMS rerouting',
  'Bed cohort A',
  'Trauma OR queue',
  'Triage thinning',
  'Capacity recovers',
  'Staff recall',
  'Helo flight risk',
  'Storm bypass route',
  'NEDOCS easing',
  'ICU at 88%',
  'Pediatric divert',
  'Imaging backlog',
  'Lab critical chain',
  'Sepsis bundle hit',
];

export const buildConnections = (widgetId: number): WidgetConnection[] => {
  const rand = seedRand(widgetId * 17 + 3);
  const count = 2 + Math.floor(rand() * 2); // 2 or 3
  const used = new Set<number>();
  const out: WidgetConnection[] = [];
  while (out.length < count) {
    const idx = Math.floor(rand() * PATTERN_NAMES.length);
    if (used.has(idx)) continue;
    used.add(idx);
    out.push({
      label: PATTERN_NAMES[idx],
      correlation: 0.45 + rand() * 0.50,
    });
  }
  // Sort highest corr first
  out.sort((a, b) => b.correlation - a.correlation);
  return out;
};

/**
 * Format a number for display in the detail card. Uses tabular figures
 * elsewhere; this just rounds + signs sanely.
 */
export const formatNumber = (n: number, digits = 1): string => {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toFixed(0);
  if (abs >= 100) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(1);
  return n.toFixed(digits);
};

export const formatSignedPercent = (n: number, digits = 0): string => {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  const pct = Math.abs(n * 100);
  if (pct >= 100) return `${sign}${pct.toFixed(0)}%`;
  if (pct >= 10) return `${sign}${pct.toFixed(0)}%`;
  return `${sign}${pct.toFixed(digits)}%`;
};
