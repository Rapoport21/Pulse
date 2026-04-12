/**
 * useRealtimeSimulation — live-updating hospital metric simulation
 * ────────────────────────────────────────────────────────────────
 * Generates gently fluctuating values that mimic real telemetry feeds.
 * When surgeActive flips, baselines transition smoothly over 3–4 ticks
 * rather than jumping instantly.
 *
 * Usage:
 *   const liveMetrics = useRealtimeSimulation({ active: true, surgeActive });
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface RealtimeMetrics {
  erWaitMinutes: number;
  totalCensus: number;
  bedCapacityPct: number;
  activeCodes: number;
  pendingDischarges: number;
  pendingAdmits: number;
  avgMews: number;
  staffRatio: string;
  lastUpdated: Date;
}

interface SimulationParams {
  active: boolean;
  surgeActive: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Baselines & ranges
// ──────────────────────────────────────────────────────────────────────────────

interface Baseline {
  normal: number;
  surge: number;
}

const BASELINES: Record<string, Baseline> = {
  erWaitMinutes:    { normal: 45,   surge: 125  },
  totalCensus:      { normal: 284,  surge: 312  },
  bedCapacityPct:   { normal: 82,   surge: 98   },
  activeCodes:      { normal: 1,    surge: 2.5  },
  pendingDischarges:{ normal: 10,   surge: 10   },
  pendingAdmits:    { normal: 4.5,  surge: 4.5  },
  avgMewsNormal:    { normal: 2.45, surge: 3.65 },
  staffRatioVal:    { normal: 4.2,  surge: 5.8  },
};

// Jitter amplitude as fraction of the value (1-3% range)
const JITTER_FRACTION = 0.02;

// How many ticks to transition between normal ↔ surge baselines
const TRANSITION_TICKS = 4;

const TICK_INTERVAL_MS = 5_000;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Uniform random in [lo, hi] */
function randBetween(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

/** Jitter a current value toward a target baseline. */
function jitterToward(current: number, target: number, fraction: number): number {
  // Blend toward target (smooth transition)
  const blended = current + (target - current) * 0.3;
  // Then add small jitter
  const jitter = blended * fraction * (Math.random() * 2 - 1);
  return blended + jitter;
}

/** Clamp a value within bounds. */
function clamp(val: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, val));
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────

export function useRealtimeSimulation({ active, surgeActive }: SimulationParams): RealtimeMetrics {
  // Target baselines lerp between normal/surge over TRANSITION_TICKS
  const transitionProgress = useRef(surgeActive ? 1 : 0); // 0 = normal, 1 = surge
  const ticksSinceFlip = useRef(TRANSITION_TICKS); // start fully settled

  // Track surge flips
  const prevSurge = useRef(surgeActive);

  const targetBaseline = useCallback(
    (key: string): number => {
      const b = BASELINES[key];
      if (!b) return 0;
      const t = transitionProgress.current;
      return b.normal + (b.surge - b.normal) * t;
    },
    [],
  );

  // Seed initial values from the current surge state
  const initialMetrics = useCallback((): RealtimeMetrics => {
    const s = surgeActive;
    return {
      erWaitMinutes:    s ? 125 : 45,
      totalCensus:      s ? 312 : 284,
      bedCapacityPct:   s ? 98  : 82,
      activeCodes:      s ? 3   : 1,
      pendingDischarges: Math.round(randBetween(8, 12)),
      pendingAdmits:     Math.round(randBetween(3, 6)),
      avgMews:          s ? parseFloat(randBetween(3.2, 4.1).toFixed(1))
                          : parseFloat(randBetween(2.1, 2.8).toFixed(1)),
      staffRatio:       s ? '1:5.8' : '1:4.2',
      lastUpdated:      new Date(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [metrics, setMetrics] = useState<RealtimeMetrics>(initialMetrics);

  useEffect(() => {
    if (!active) return;

    // Detect surge flip
    if (prevSurge.current !== surgeActive) {
      prevSurge.current = surgeActive;
      ticksSinceFlip.current = 0;
    }

    const interval = setInterval(() => {
      // Advance transition progress
      if (ticksSinceFlip.current < TRANSITION_TICKS) {
        ticksSinceFlip.current += 1;
        const raw = ticksSinceFlip.current / TRANSITION_TICKS;
        transitionProgress.current = surgeActive ? raw : 1 - raw;
      } else {
        transitionProgress.current = surgeActive ? 1 : 0;
      }

      setMetrics((prev) => {
        const erWait = clamp(
          Math.round(jitterToward(prev.erWaitMinutes, targetBaseline('erWaitMinutes'), JITTER_FRACTION)),
          10, 200,
        );

        const census = clamp(
          Math.round(jitterToward(prev.totalCensus, targetBaseline('totalCensus'), JITTER_FRACTION)),
          200, 400,
        );

        const bedCap = clamp(
          Math.round(jitterToward(prev.bedCapacityPct, targetBaseline('bedCapacityPct'), JITTER_FRACTION)),
          50, 100,
        );

        const codes = clamp(
          Math.round(jitterToward(prev.activeCodes, targetBaseline('activeCodes'), JITTER_FRACTION * 2)),
          0, 6,
        );

        const discharges = clamp(
          Math.round(jitterToward(prev.pendingDischarges, targetBaseline('pendingDischarges'), JITTER_FRACTION)),
          5, 18,
        );

        const admits = clamp(
          Math.round(jitterToward(prev.pendingAdmits, targetBaseline('pendingAdmits'), JITTER_FRACTION)),
          1, 10,
        );

        const mewsTarget = targetBaseline('avgMewsNormal');
        const mews = clamp(
          parseFloat(jitterToward(prev.avgMews, mewsTarget, JITTER_FRACTION).toFixed(1)),
          1.0, 6.0,
        );

        const ratioTarget = targetBaseline('staffRatioVal');
        const ratioVal = clamp(
          parseFloat(jitterToward(
            parseFloat(prev.staffRatio.split(':')[1]),
            ratioTarget,
            JITTER_FRACTION,
          ).toFixed(1)),
          3.0, 8.0,
        );

        return {
          erWaitMinutes: erWait,
          totalCensus: census,
          bedCapacityPct: bedCap,
          activeCodes: codes,
          pendingDischarges: discharges,
          pendingAdmits: admits,
          avgMews: mews,
          staffRatio: `1:${ratioVal}`,
          lastUpdated: new Date(),
        };
      });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [active, surgeActive, targetBaseline]);

  return metrics;
}
