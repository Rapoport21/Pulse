/**
 * mockShiftMetrics
 *
 * Deterministic mock data for the Manager KPI cockpit.
 *
 * Why this exists
 * ---------------
 * Real shift-level KPIs (LWBS, door-to-doc, LOS, boarding hours,
 * bed capacity, staffing gap) would come from an HL7/FHIR/Epic
 * adapter plus a rolling window store. That adapter is T1.2 on
 * the backlog and not built. For the prototype/demo, we want
 * KPIs that:
 *
 *   1. Look plausible (real targets, real units, real ranges).
 *   2. Breathe — values and 24h series shift over the course of
 *      a demo so the screen doesn't feel static.
 *   3. Stay *deterministic within a 2-minute window* so tapping
 *      back and forth on a tile doesn't reshuffle numbers and
 *      feel broken.
 *
 * Determinism comes from a simple seeded PRNG keyed on
 * `Math.floor(Date.now() / 120_000)` — every 2 minutes the demo
 * ticks to a new "scenario" and numbers drift. Targets and unit
 * strings come from published CMS/ENA benchmarks so nothing on
 * screen contradicts a clinically-trained viewer.
 *
 * This file is mock-only — when real data lands, `getKpiSnapshot`
 * becomes the single swap point: replace its body with an adapter
 * call and the whole cockpit UI stays identical.
 */

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type KpiStatus = 'ok' | 'warn' | 'crit';
export type KpiTrend = 'up' | 'down' | 'flat';

/** "Better when higher" vs "better when lower" — drives the trend
 *  color semantics. Door-to-doc going up is bad; capacity going up
 *  toward target is good. */
export type KpiGoal = 'lower' | 'higher';

export interface KpiContributingFactor {
  label: string;
  detail: string;
  /** Optional severity tint. */
  tone?: 'ok' | 'warn' | 'crit' | 'info';
}

export interface KpiSnapshot {
  id: KpiId;
  /** Short label shown on the tile front ("Door-to-Doc"). */
  label: string;
  /** Units string shown next to the number ("min", "%", "hrs", "FTE"). */
  unit: string;
  /** Current value (already rounded to display precision). */
  value: number;
  /** Pretty-printed value for display ("48" → "48", "3.2" → "3.2"). */
  display: string;
  /** Target / benchmark — e.g. "< 30" or "85%" */
  target: string;
  /** Raw numeric target for comparison logic. */
  targetValue: number;
  /** Whether lower-is-better or higher-is-better. */
  goal: KpiGoal;
  /** Status derived from current value vs target. */
  status: KpiStatus;
  /** Trend vs prior window — arrow direction (not color). */
  trend: KpiTrend;
  /** Percent delta vs prior window — signed. */
  deltaPct: number;
  /** 24-hour sparkline, 24 points (1 per hour). */
  sparkline: number[];
  /** One-sentence description shown above the sparkline in the
   *  expanded view. */
  description: string;
  /** Top contributing factors — shown as a bullet list in the
   *  expanded view. 2-4 items. */
  factors: KpiContributingFactor[];
}

export type KpiId =
  | 'lwbs'
  | 'door-to-doc'
  | 'avg-los'
  | 'boarding-hours'
  | 'bed-capacity'
  | 'staffing-gap';

// ─────────────────────────────────────────────────────────────────────────
// Tiny seeded PRNG — mulberry32, deterministic from a number seed
// ─────────────────────────────────────────────────────────────────────────

const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ─────────────────────────────────────────────────────────────────────────
// Sparkline generator — smooth random walk, pinned so the last
// value equals the current KPI reading
// ─────────────────────────────────────────────────────────────────────────

const buildSpark = (
  rng: () => number,
  endValue: number,
  low: number,
  high: number,
  /** Jitter magnitude as fraction of range (0.05 = 5%). */
  jitter: number = 0.12,
): number[] => {
  const span = high - low;
  const points: number[] = [];
  let v = endValue + (rng() - 0.5) * span * 0.3;
  // Walk 24 steps, biased toward endValue at the tail.
  for (let i = 0; i < 24; i += 1) {
    // Bias factor — stronger as we approach the end.
    const pull = i / 23;
    const noise = (rng() - 0.5) * span * jitter;
    v = v + noise + (endValue - v) * pull * 0.4;
    v = Math.max(low, Math.min(high, v));
    points.push(v);
  }
  // Ensure the final point IS the end value (visually nicer).
  points[points.length - 1] = endValue;
  return points;
};

// ─────────────────────────────────────────────────────────────────────────
// Snapshot builder
// ─────────────────────────────────────────────────────────────────────────

/**
 * Returns the current-window snapshot of all 6 manager KPIs.
 *
 * Seed rule: the scenario cycles every 2 minutes — `Math.floor(
 * Date.now() / 120_000)`. Within a 2-minute window every caller
 * sees identical numbers; across windows the numbers drift. For a
 * fully-static-in-demo build, pin the seed to a constant.
 */
export const getKpiSnapshot = (now: number = Date.now()): KpiSnapshot[] => {
  const seed = Math.floor(now / 120_000);
  const rng = mulberry32(seed);

  // Prior-window value for delta computation.
  const priorRng = mulberry32(seed - 1);

  // ── LWBS rate (left-without-being-seen) ────────────────────────────
  // CMS benchmark target ~ 2%. ENA reports median US ED runs
  // 2-5%, crisis-level EDs hit 8-10%. We drift 1.5-5%.
  const lwbs = +(1.5 + rng() * 3.5).toFixed(1);
  const lwbsPrior = +(1.5 + priorRng() * 3.5).toFixed(1);

  // ── Door-to-doc (median minutes) ───────────────────────────────────
  // CMS target < 30 min. Real EDs run 30-75. Drift 28-72.
  const dtd = Math.round(28 + rng() * 44);
  const dtdPrior = Math.round(28 + priorRng() * 44);

  // ── Average LOS (hours) ────────────────────────────────────────────
  // CMS target 4h for admits, 2.5h for discharges. Aggregate 3-6h.
  const los = +(3 + rng() * 3).toFixed(1);
  const losPrior = +(3 + priorRng() * 3).toFixed(1);

  // ── Boarding hours (total across all ED boarders) ──────────────────
  // Target < 10h aggregate. Realistic range 5-25h.
  const boarding = Math.round(5 + rng() * 20);
  const boardingPrior = Math.round(5 + priorRng() * 20);

  // ── Bed capacity (% of staffed beds occupied, house-wide) ──────────
  // Target < 85% (buffer for surges). Real hospitals run 70-95%.
  const cap = Math.round(70 + rng() * 25);
  const capPrior = Math.round(70 + priorRng() * 25);

  // ── Staffing gap (FTE delta from target; negative = understaffed) ──
  // Target 0. Demo drift -4 to +1.
  const gap = Math.round(-4 + rng() * 5);
  const gapPrior = Math.round(-4 + priorRng() * 5);

  const pctDelta = (cur: number, prev: number) =>
    prev === 0 ? 0 : +(((cur - prev) / prev) * 100).toFixed(1);

  const trendOf = (cur: number, prev: number): KpiTrend => {
    if (Math.abs(cur - prev) < 0.01) return 'flat';
    return cur > prev ? 'up' : 'down';
  };

  const statusLower = (v: number, t: number, critT: number): KpiStatus =>
    v <= t ? 'ok' : v <= critT ? 'warn' : 'crit';
  const statusHigher = (v: number, t: number, okT: number): KpiStatus =>
    v >= okT ? 'ok' : v >= t ? 'warn' : 'crit';

  return [
    {
      id: 'lwbs',
      label: 'LWBS Rate',
      unit: '%',
      value: lwbs,
      display: lwbs.toFixed(1),
      target: '< 2.0',
      targetValue: 2.0,
      goal: 'lower',
      status: statusLower(lwbs, 2.0, 4.0),
      trend: trendOf(lwbs, lwbsPrior),
      deltaPct: pctDelta(lwbs, lwbsPrior),
      sparkline: buildSpark(mulberry32(seed + 1), lwbs, 0.8, 6.0, 0.18),
      description:
        'Share of walk-in patients who leave before being seen by a provider. CMS benchmark is <2%.',
      factors: [
        {
          label: 'Triage queue depth',
          detail: '14 patients pending triage · avg wait 22m',
          tone: 'warn',
        },
        {
          label: 'Fast-track staffing',
          detail: 'Only 1 of 2 fast-track pods open this shift',
          tone: 'warn',
        },
        {
          label: 'Peak-hour correlation',
          detail: 'Spikes align with 14:00-18:00 walk-in burst',
          tone: 'info',
        },
      ],
    },
    {
      id: 'door-to-doc',
      label: 'Door-to-Doc',
      unit: 'min',
      value: dtd,
      display: `${dtd}`,
      target: '< 30',
      targetValue: 30,
      goal: 'lower',
      status: statusLower(dtd, 30, 60),
      trend: trendOf(dtd, dtdPrior),
      deltaPct: pctDelta(dtd, dtdPrior),
      sparkline: buildSpark(mulberry32(seed + 2), dtd, 18, 85, 0.15),
      description:
        'Median minutes from patient arrival to first provider contact. CMS OP-18 measure; target <30 min for ED.',
      factors: [
        {
          label: 'Provider coverage',
          detail: '2 attending, 1 resident on floor',
          tone: 'ok',
        },
        {
          label: 'Rooming delay',
          detail: '8 ESI-3s waiting on room assignment',
          tone: 'warn',
        },
        {
          label: 'Boarders blocking beds',
          detail: `${boarding} boarding hrs reducing bed turnover`,
          tone: 'crit',
        },
      ],
    },
    {
      id: 'avg-los',
      label: 'Avg LOS',
      unit: 'hrs',
      value: los,
      display: los.toFixed(1),
      target: '< 4.0',
      targetValue: 4.0,
      goal: 'lower',
      status: statusLower(los, 4.0, 5.5),
      trend: trendOf(los, losPrior),
      deltaPct: pctDelta(los, losPrior),
      sparkline: buildSpark(mulberry32(seed + 3), los, 2.2, 6.5, 0.15),
      description:
        'Average ED length of stay for all dispositions. CMS target 4h for admits, 2.5h for discharges.',
      factors: [
        {
          label: 'Admit LOS',
          detail: `${(los + 1.2).toFixed(1)}h avg · driven by bed placement`,
          tone: 'warn',
        },
        {
          label: 'Discharge LOS',
          detail: `${(los - 0.6).toFixed(1)}h avg · meeting target`,
          tone: 'ok',
        },
        {
          label: 'Imaging TAT',
          detail: 'CT 34m · XR 12m · MRI 58m',
          tone: 'info',
        },
      ],
    },
    {
      id: 'boarding-hours',
      label: 'Boarding Hrs',
      unit: 'hrs',
      value: boarding,
      display: `${boarding}`,
      target: '< 10',
      targetValue: 10,
      goal: 'lower',
      status: statusLower(boarding, 10, 18),
      trend: trendOf(boarding, boardingPrior),
      deltaPct: pctDelta(boarding, boardingPrior),
      sparkline: buildSpark(mulberry32(seed + 4), boarding, 2, 30, 0.18),
      description:
        'Cumulative hours admitted patients are holding in the ED awaiting inpatient beds. Drives LOS + LWBS + staff burnout.',
      factors: [
        {
          label: 'Upstream bed availability',
          detail: 'ICU 12/14 · Stepdown 8/12 · Med-Surg 44/54',
          tone: 'warn',
        },
        {
          label: 'Pending discharges',
          detail: '7 rounds approved · awaiting transport/paperwork',
          tone: 'info',
        },
        {
          label: 'EVS turnaround',
          detail: 'Avg 52m · target 30m',
          tone: 'crit',
        },
      ],
    },
    {
      id: 'bed-capacity',
      label: 'Bed Capacity',
      unit: '%',
      value: cap,
      display: `${cap}`,
      target: '< 85',
      targetValue: 85,
      goal: 'lower',
      status: statusLower(cap, 85, 92),
      trend: trendOf(cap, capPrior),
      deltaPct: pctDelta(cap, capPrior),
      sparkline: buildSpark(mulberry32(seed + 5), cap, 55, 99, 0.10),
      description:
        'House-wide occupancy as a share of staffed beds. Hospitals aim <85% to absorb admit surges without diversion.',
      factors: [
        {
          label: 'Clinical units',
          detail: '5 units · 2 at STRAINED, 1 at CRITICAL',
          tone: 'warn',
        },
        {
          label: 'Surge overflow',
          detail: 'Hall C not active · 4 beds available',
          tone: 'ok',
        },
        {
          label: 'Scheduled admits',
          detail: '6 OR cases posting for tonight',
          tone: 'info',
        },
      ],
    },
    {
      id: 'staffing-gap',
      label: 'Staffing Gap',
      unit: 'FTE',
      value: gap,
      display: gap > 0 ? `+${gap}` : `${gap}`,
      target: '0',
      targetValue: 0,
      goal: 'higher',
      status: statusHigher(gap, -1, 0),
      trend: trendOf(gap, gapPrior),
      deltaPct: pctDelta(Math.abs(gap), Math.abs(gapPrior) || 1),
      sparkline: buildSpark(mulberry32(seed + 6), gap, -5, 2, 0.22),
      description:
        'FTE delta vs shift-plan target. Negative = understaffed. Drives ratio compliance + patient-per-nurse load.',
      factors: [
        {
          label: 'Called out',
          detail: '2 RN · 1 CNA — no replacement found',
          tone: 'crit',
        },
        {
          label: 'Float pool',
          detail: '1 RN available · 0 ICU-qualified',
          tone: 'warn',
        },
        {
          label: 'Pending shift trades',
          detail: '3 swap requests open',
          tone: 'info',
        },
      ],
    },
  ];
};

// ─────────────────────────────────────────────────────────────────────────
// Convenience: map status to a color token name (avoid circular imports)
// ─────────────────────────────────────────────────────────────────────────

export const statusToToneKey = (s: KpiStatus): 'ok' | 'warn' | 'crit' => s;
