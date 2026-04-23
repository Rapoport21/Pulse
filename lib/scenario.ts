/**
 * PULSE Scenario Engine
 * =====================
 *
 * 3-level severity simulation that drives the WHOLE UI for 3 minutes.
 *
 *   S1 · NORMAL    — quiet rhythm. Ambient discharges, routine EMS.
 *   S2 · MODERATE  — elevated load. ER wait climbs, staffing tightens,
 *                    one trauma + one stroke inbound. Surge NOT auto.
 *   S3 · DISASTER  — MCI event. Census +28, overflow opens, 3 active
 *                    codes, ambulance divert. Surge auto-activates.
 *
 * Architecture: OVERLAY on top of baseline values, not mutation.
 * - Consumers read metrics via `metricValue(key, scenario, now)`.
 * - When `scenario === null`, they get the baseline.
 * - Scenario evolves through six phases over 3 minutes; each phase has
 *   per-metric deltas that reshape what users see.
 * - Event timeline (ems-inject, alerts, codes, toasts) is fired by the
 *   AUTHORING device only (whichever one tapped the card in Settings) —
 *   so connected devices stay in sync without double-firing events.
 *
 * Wire points:
 * - `App.tsx` — owns `useRealtimeState<ScenarioState | null>('active-scenario', null)`
 *              plus `useScenarioEventRunner()` that publishes EMS/alerts/etc.
 * - `SettingsScreen.tsx` — card picker, countdown, stop button.
 * - Top HUD in App.tsx — persistent `● S3 · 02:43` badge when active.
 * - Every screen that reads a metric — passes through `metricValue()`.
 */

import { useEffect, useRef, useState } from 'react';

// ────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────

export type ScenarioSeverity = 1 | 2 | 3;

export interface ScenarioState {
  /** Severity level — 1/2/3. */
  severity: ScenarioSeverity;
  /** Epoch ms of activation. */
  startedAt: number;
  /** Epoch ms of expiry (startedAt + SCENARIO_DURATION_MS). */
  expiresAt: number;
  /**
   * Device id that authored this scenario. The event runner only fires
   * events on this device — prevents multi-device duplicates.
   */
  authorDevice: string;
}

export const SCENARIO_DURATION_MS = 180_000; // 3 minutes

// Six phases over 3 minutes. Duration per phase:
//   ramp     0–30s   warming up
//   climb    30–75s  building pressure
//   peak     75–120s the worst of it
//   hold     120–155s sustained — this is the "new normal" if you live here
//   windDown 155–175s things relaxing
//   closing  175–180s reverting toward baseline
export type ScenarioPhase =
  | 'ramp'
  | 'climb'
  | 'peak'
  | 'hold'
  | 'windDown'
  | 'closing';

export function scenarioPhase(elapsedMs: number): ScenarioPhase {
  if (elapsedMs < 30_000) return 'ramp';
  if (elapsedMs < 75_000) return 'climb';
  if (elapsedMs < 120_000) return 'peak';
  if (elapsedMs < 155_000) return 'hold';
  if (elapsedMs < 175_000) return 'windDown';
  return 'closing';
}

// ────────────────────────────────────────────────────────────────────────
// Metric keys — what the scenario can shift
// ────────────────────────────────────────────────────────────────────────

export type MetricKey =
  | 'census' // total admitted patients
  | 'erWaitMinutes' // average ED wait (mins)
  | 'ambulanceCount' // inbound ambulances <5m
  | 'icuOccupancyPct' // ICU occupancy %
  | 'staffingRatio' // patients per nurse (higher = worse)
  | 'activeAlerts' // count of active alerts
  | 'activeCodes' // count of active code blues/traumas
  | 'triageWaitMin' // ER triage wait (mins)
  | 'nedocsScore' // NEDOCS saturation score (0–200)
  | 'traumaBaysAvailable' // 0–3, higher is better
  | 'boardingAdmitted' // held admits waiting for floor bed
  | 'dischargesPending' // discharges awaiting transport
  | 'emsOffloadRiskMin' // EMS offload time (mins)
  | 'rnShortfall' // negative FTE
  | 'orAvailable'; // OR rooms available (of 4)

/**
 * Baseline — the "zero" that deltas apply to. These are the numbers the
 * app reads when NO scenario is active. Matches existing mock copy.
 */
export const METRIC_BASELINES: Record<MetricKey, number> = {
  census: 284,
  erWaitMinutes: 45,
  ambulanceCount: 1,
  icuOccupancyPct: 83,
  staffingRatio: 4.2,
  activeAlerts: 3,
  activeCodes: 0,
  triageWaitMin: 125,
  nedocsScore: 112,
  traumaBaysAvailable: 3,
  boardingAdmitted: 24,
  dischargesPending: 3,
  emsOffloadRiskMin: 45,
  rnShortfall: -2,
  orAvailable: 3,
};

// ────────────────────────────────────────────────────────────────────────
// Timeline — per-severity, per-phase metric deltas
// ────────────────────────────────────────────────────────────────────────

export interface ScenarioMetricBeat {
  phase: ScenarioPhase;
  /** Additive delta per metric. Missing keys = 0. */
  delta: Partial<Record<MetricKey, number>>;
  /** Signature flags that flip on/off. */
  flags?: {
    overflowOpen?: boolean;
    ambulanceDivert?: boolean;
    mtpActive?: boolean;
  };
}

export const SCENARIO_TIMELINES: Record<ScenarioSeverity, ScenarioMetricBeat[]> = {
  // ── S1 · NORMAL ── A visibly CALM shift. Numbers drop below baseline
  // across the whole board so the operator sees green tone immediately.
  // Ramp-phase deltas are intentionally aggressive (not "0, -2") so the
  // screen reads "quiet day" the instant S1 is activated, not 30 seconds
  // later when the climb phase kicks in.
  1: [
    { phase: 'ramp', delta: { census: -4, erWaitMinutes: -12, nedocsScore: -18, staffingRatio: -0.4, boardingAdmitted: -6, dischargesPending: 4, emsOffloadRiskMin: -15, activeAlerts: -2, icuOccupancyPct: -3, triageWaitMin: -30, traumaBaysAvailable: 1 } },
    { phase: 'climb', delta: { census: -6, erWaitMinutes: -15, nedocsScore: -22, staffingRatio: -0.5, boardingAdmitted: -8, dischargesPending: 5, emsOffloadRiskMin: -20, activeAlerts: -2, icuOccupancyPct: -4, triageWaitMin: -40, traumaBaysAvailable: 1 } },
    { phase: 'peak', delta: { census: -8, erWaitMinutes: -18, nedocsScore: -25, staffingRatio: -0.6, boardingAdmitted: -10, dischargesPending: 6, emsOffloadRiskMin: -25, activeAlerts: -3, icuOccupancyPct: -5, triageWaitMin: -50, ambulanceCount: -1, traumaBaysAvailable: 1 } },
    { phase: 'hold', delta: { census: -6, erWaitMinutes: -14, nedocsScore: -20, staffingRatio: -0.4, boardingAdmitted: -7, dischargesPending: 4, emsOffloadRiskMin: -18, activeAlerts: -2, icuOccupancyPct: -4, triageWaitMin: -35, traumaBaysAvailable: 1 } },
    { phase: 'windDown', delta: { census: -3, erWaitMinutes: -8, nedocsScore: -12, staffingRatio: -0.2, boardingAdmitted: -3, dischargesPending: 2, emsOffloadRiskMin: -10, activeAlerts: -1, icuOccupancyPct: -2, triageWaitMin: -20 } },
    { phase: 'closing', delta: { census: -1, erWaitMinutes: -2, nedocsScore: -5, dischargesPending: 1, activeAlerts: -1 } },
  ],

  // ── S2 · MODERATE ── Elevated load from t=0. Screen reads clearly
  // "we're busy" immediately — boosted ramp-phase deltas so it doesn't
  // look like baseline for the first 30 seconds.
  2: [
    { phase: 'ramp', delta: { census: 8, erWaitMinutes: 22, ambulanceCount: 2, activeAlerts: 2, emsOffloadRiskMin: 18, triageWaitMin: 18, nedocsScore: 18, staffingRatio: 0.5, boardingAdmitted: 3, icuOccupancyPct: 3 } },
    { phase: 'climb', delta: { census: 12, erWaitMinutes: 32, ambulanceCount: 3, staffingRatio: 0.7, activeAlerts: 2, emsOffloadRiskMin: 25, triageWaitMin: 22, boardingAdmitted: 5, nedocsScore: 24, icuOccupancyPct: 4 } },
    { phase: 'peak', delta: { census: 14, erWaitMinutes: 42, ambulanceCount: 3, staffingRatio: 0.9, activeAlerts: 3, triageWaitMin: 30, boardingAdmitted: 6, emsOffloadRiskMin: 30, nedocsScore: 30, icuOccupancyPct: 5 } },
    { phase: 'hold', delta: { census: 12, erWaitMinutes: 38, ambulanceCount: 2, staffingRatio: 0.7, activeAlerts: 2, triageWaitMin: 25, boardingAdmitted: 5, emsOffloadRiskMin: 25, nedocsScore: 24, icuOccupancyPct: 4 } },
    { phase: 'windDown', delta: { census: 8, erWaitMinutes: 20, ambulanceCount: 1, staffingRatio: 0.3, activeAlerts: 1, triageWaitMin: 15, boardingAdmitted: 3, emsOffloadRiskMin: 12, nedocsScore: 12, icuOccupancyPct: 2 } },
    { phase: 'closing', delta: { census: 4, erWaitMinutes: 10, boardingAdmitted: 1, nedocsScore: 5 } },
  ],

  // ── S3 · DISASTER ── MCI event. Auto-activates surge at T+2s.
  // Ramp-phase numbers are already catastrophic — screen paints red
  // immediately, doesn't wait 30s for climb. Peak is the absolute worst.
  3: [
    { phase: 'ramp', delta: { census: 16, erWaitMinutes: 55, ambulanceCount: 4, activeAlerts: 5, activeCodes: 1, triageWaitMin: 40, boardingAdmitted: 8, emsOffloadRiskMin: 40, nedocsScore: 38, staffingRatio: 0.9, icuOccupancyPct: 6, traumaBaysAvailable: -1, rnShortfall: -2, orAvailable: -1 }, flags: { overflowOpen: true } },
    { phase: 'climb', delta: { census: 22, erWaitMinutes: 68, ambulanceCount: 5, staffingRatio: 1.3, activeAlerts: 6, activeCodes: 2, triageWaitMin: 50, traumaBaysAvailable: -2, boardingAdmitted: 11, emsOffloadRiskMin: 50, nedocsScore: 45, icuOccupancyPct: 9, rnShortfall: -3, orAvailable: -2 }, flags: { overflowOpen: true, ambulanceDivert: true } },
    { phase: 'peak', delta: { census: 28, erWaitMinutes: 80, ambulanceCount: 6, staffingRatio: 1.9, activeAlerts: 8, activeCodes: 3, triageWaitMin: 70, traumaBaysAvailable: -3, boardingAdmitted: 14, emsOffloadRiskMin: 65, nedocsScore: 55, icuOccupancyPct: 12, rnShortfall: -4, orAvailable: -3 }, flags: { overflowOpen: true, ambulanceDivert: true, mtpActive: true } },
    { phase: 'hold', delta: { census: 26, erWaitMinutes: 72, ambulanceCount: 5, staffingRatio: 1.7, activeAlerts: 7, activeCodes: 2, triageWaitMin: 65, traumaBaysAvailable: -3, boardingAdmitted: 13, emsOffloadRiskMin: 55, nedocsScore: 48, icuOccupancyPct: 11, rnShortfall: -4, orAvailable: -2 }, flags: { overflowOpen: true, ambulanceDivert: true, mtpActive: true } },
    { phase: 'windDown', delta: { census: 18, erWaitMinutes: 45, ambulanceCount: 3, staffingRatio: 1.0, activeAlerts: 4, activeCodes: 1, triageWaitMin: 45, traumaBaysAvailable: -2, boardingAdmitted: 9, emsOffloadRiskMin: 30, nedocsScore: 30, icuOccupancyPct: 6, rnShortfall: -3, orAvailable: -1 }, flags: { overflowOpen: true } },
    { phase: 'closing', delta: { census: 10, erWaitMinutes: 22, ambulanceCount: 2, staffingRatio: 0.4, activeAlerts: 2, activeCodes: 0, triageWaitMin: 25, traumaBaysAvailable: -1, boardingAdmitted: 4, emsOffloadRiskMin: 15, nedocsScore: 15, icuOccupancyPct: 3, rnShortfall: -2 } },
  ],
};

// ────────────────────────────────────────────────────────────────────────
// Flags — the scenario's "boolean" state
// ────────────────────────────────────────────────────────────────────────

export interface ScenarioFlags {
  overflowOpen: boolean;
  ambulanceDivert: boolean;
  mtpActive: boolean;
}

export const DEFAULT_FLAGS: ScenarioFlags = {
  overflowOpen: false,
  ambulanceDivert: false,
  mtpActive: false,
};

export function scenarioFlags(
  scenario: ScenarioState | null,
  now: number = Date.now(),
): ScenarioFlags {
  if (!scenario) return { ...DEFAULT_FLAGS };
  const elapsed = Math.max(0, now - scenario.startedAt);
  if (elapsed > SCENARIO_DURATION_MS) return { ...DEFAULT_FLAGS };
  const phase = scenarioPhase(elapsed);
  const timeline = SCENARIO_TIMELINES[scenario.severity];
  const beat = timeline.find((b) => b.phase === phase);
  return { ...DEFAULT_FLAGS, ...(beat?.flags ?? {}) };
}

// ────────────────────────────────────────────────────────────────────────
// Event timeline — discrete things that happen at specific timestamps
// ────────────────────────────────────────────────────────────────────────

export type ScenarioEventKind =
  | 'ems-inject'
  | 'alert'
  | 'code'
  | 'overflow-open'
  | 'discharge'
  | 'surge-activate'
  | 'surge-deactivate'
  | 'toast';

export interface ScenarioEvent {
  /** T+ seconds from scenario activation. */
  atSec: number;
  kind: ScenarioEventKind;
  /** Event-specific payload, forwarded to the handler. */
  payload?: Record<string, unknown>;
}

export const SCENARIO_EVENTS: Record<ScenarioSeverity, ScenarioEvent[]> = {
  // ── S1 — ambient events that feel routine ──────────────────────────
  1: [
    { atSec: 3, kind: 'toast', payload: { message: 'Quiet day — monitoring baseline ops', type: 'info' } },
    { atSec: 20, kind: 'discharge', payload: { room: '4W-12', patient: 'Chen, A.' } },
    {
      atSec: 40,
      kind: 'ems-inject',
      payload: {
        unit: 'Medic 17',
        mode: 'ground',
        etaMinutes: 12,
        age: 68,
        sex: 'F',
        chiefComplaint: 'Chest pressure, resolved, hx HTN',
        activationLevel: 'ROUTINE',
        fieldVitals: { heartRate: 72, systolic: 128, diastolic: 82, respRate: 16, spO2: 98, gcs: 15 },
        fieldTreatment: '18g IV · ASA 325 · NTG 0.4mg SL',
        destinationBay: 'Acute 3',
      },
    },
    { atSec: 75, kind: 'toast', payload: { message: 'Bed 4W-7 turned over — ready for admit', type: 'info' } },
    { atSec: 105, kind: 'discharge', payload: { room: '3E-05', patient: 'Rivera, J.' } },
    { atSec: 135, kind: 'toast', payload: { message: 'EMS standby · Medic 22 clear of scene', type: 'info' } },
    { atSec: 165, kind: 'toast', payload: { message: 'Shift rhythm steady — no interventions required', type: 'info' } },
  ],

  // ── S2 — elevated load, some interventions ────────────────────────
  2: [
    { atSec: 3, kind: 'toast', payload: { message: 'ER load climbing — monitoring', type: 'info' } },
    {
      atSec: 25,
      kind: 'ems-inject',
      payload: {
        unit: 'Medic 33',
        mode: 'ground',
        etaMinutes: 8,
        age: 54,
        sex: 'M',
        chiefComplaint: 'Crush injury, R arm, industrial press',
        activationLevel: 'TRAUMA_2',
        fieldVitals: { heartRate: 118, systolic: 102, diastolic: 64, respRate: 22, spO2: 96, gcs: 15 },
        fieldTreatment: 'TQ R upper arm · 18g IV NS · fentanyl 100mcg',
        destinationBay: 'Trauma 2',
      },
    },
    {
      atSec: 50,
      kind: 'alert',
      payload: {
        title: 'ER saturation 90%',
        message: 'Boarding pressure rising. 6 admissions pending floor bed.',
        type: 'warning',
      },
    },
    {
      atSec: 75,
      kind: 'ems-inject',
      payload: {
        unit: 'Medic 28',
        mode: 'ground',
        etaMinutes: 11,
        age: 71,
        sex: 'F',
        chiefComplaint: 'AMS, poss CVA, last known well 45m ago',
        activationLevel: 'STROKE',
        fieldVitals: { heartRate: 94, systolic: 168, diastolic: 94, respRate: 18, spO2: 97, gcs: 13 },
        fieldTreatment: 'O2 NC · IV NS · stroke scale: 6',
        destinationBay: 'Acute 1',
      },
    },
    { atSec: 100, kind: 'toast', payload: { message: 'Float pool — 2 RNs deployed to ER', type: 'info' } },
    {
      atSec: 130,
      kind: 'alert',
      payload: {
        title: 'Staffing gap — Med-Surg 4W',
        message: '1 RN short for 15:00 shift. Charge covering.',
        type: 'warning',
      },
    },
    { atSec: 160, kind: 'toast', payload: { message: 'Load stabilizing — monitor through shift change', type: 'info' } },
  ],

  // ── S3 — MCI disaster. Surge activates immediately ────────────────
  3: [
    { atSec: 2, kind: 'surge-activate' },
    { atSec: 4, kind: 'toast', payload: { message: 'MASS CASUALTY EVENT — Surge Protocol Level 2 ACTIVE', type: 'error' } },
    { atSec: 8, kind: 'overflow-open' },
    {
      atSec: 15,
      kind: 'ems-inject',
      payload: {
        unit: 'Medic 41',
        mode: 'ground',
        etaMinutes: 4,
        age: 22,
        sex: 'M',
        chiefComplaint: 'MCI bus rollover, ejected, multiple rib fx, pneumothorax',
        activationLevel: 'TRAUMA_1',
        fieldVitals: { heartRate: 138, systolic: 78, diastolic: 42, respRate: 32, spO2: 88, gcs: 11 },
        fieldTreatment: 'Bilateral 14g IV · TXA 1g · chest seal L · c-collar',
        destinationBay: 'Trauma 1',
      },
    },
    {
      atSec: 30,
      kind: 'ems-inject',
      payload: {
        unit: 'Medic 42',
        mode: 'ground',
        etaMinutes: 6,
        age: 34,
        sex: 'F',
        chiefComplaint: 'MCI bus rollover, restrained, GCS 14, open tib-fib',
        activationLevel: 'TRAUMA_2',
        fieldVitals: { heartRate: 112, systolic: 108, diastolic: 68, respRate: 22, spO2: 95, gcs: 14 },
        fieldTreatment: '18g IV NS · splint R leg · fentanyl 75mcg',
        destinationBay: 'Trauma 2',
      },
    },
    { atSec: 45, kind: 'code', payload: { room: 'Trauma 1', type: 'CODE TRAUMA' } },
    {
      atSec: 50,
      kind: 'alert',
      payload: {
        title: 'ED SATURATION 108%',
        message: 'All trauma bays occupied. Initiating ambulance divert.',
        type: 'critical',
      },
    },
    {
      atSec: 75,
      kind: 'ems-inject',
      payload: {
        unit: 'Air 5',
        mode: 'air',
        etaMinutes: 10,
        age: 8,
        sex: 'M',
        chiefComplaint: 'MCI bus rollover, peds unrestrained, AMS, scalp lac',
        activationLevel: 'TRAUMA_1',
        fieldVitals: { heartRate: 152, systolic: 82, diastolic: 50, respRate: 28, spO2: 93, gcs: 12 },
        fieldTreatment: 'IO access · NS 20mL/kg · c-collar · pressure to scalp',
        destinationBay: 'Trauma 1',
      },
    },
    {
      atSec: 95,
      kind: 'alert',
      payload: {
        title: 'BLOOD BANK — MTP ACTIVE',
        message: 'Mass Transfusion Protocol initiated. 6u O-neg on rapid infuser.',
        type: 'critical',
      },
    },
    { atSec: 120, kind: 'toast', payload: { message: 'PEAK — Census +28 · 3 active codes · overflow open', type: 'error' } },
    { atSec: 150, kind: 'toast', payload: { message: 'Stabilizing — ER wait dropping · 1 code cleared', type: 'info' } },
    { atSec: 170, kind: 'toast', payload: { message: 'Scenario winding down — metrics reverting', type: 'info' } },
    { atSec: 178, kind: 'surge-deactivate' },
  ],
};

// ────────────────────────────────────────────────────────────────────────
// Derivation helpers
// ────────────────────────────────────────────────────────────────────────

/**
 * Read a single metric with scenario overlay applied.
 * When no scenario is active, returns the baseline value.
 */
export function metricValue(
  key: MetricKey,
  scenario: ScenarioState | null,
  now: number = Date.now(),
): number {
  const base = METRIC_BASELINES[key];
  if (!scenario) return base;
  const elapsed = Math.max(0, now - scenario.startedAt);
  if (elapsed > SCENARIO_DURATION_MS) return base;
  const phase = scenarioPhase(elapsed);
  const timeline = SCENARIO_TIMELINES[scenario.severity];
  const beat = timeline.find((b) => b.phase === phase);
  const delta = beat?.delta[key] ?? 0;
  return base + delta;
}

/** Convenience — all metrics at once, snapshot of current values. */
export function metricsSnapshot(
  scenario: ScenarioState | null,
  now: number = Date.now(),
): Record<MetricKey, number> {
  const out = {} as Record<MetricKey, number>;
  (Object.keys(METRIC_BASELINES) as MetricKey[]).forEach((k) => {
    out[k] = metricValue(k, scenario, now);
  });
  return out;
}

// ────────────────────────────────────────────────────────────────────────
// React hooks
// ────────────────────────────────────────────────────────────────────────

/**
 * Live-ticking snapshot of scenario progress. Re-renders every second
 * while a scenario is active so countdown / phase / deltas update.
 */
export function useScenarioTick(scenario: ScenarioState | null): {
  scenario: ScenarioState | null;
  elapsedMs: number;
  remainingMs: number;
  phase: ScenarioPhase | null;
  isExpired: boolean;
  flags: ScenarioFlags;
} {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!scenario) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [scenario?.severity, scenario?.startedAt]);

  if (!scenario) {
    return {
      scenario: null,
      elapsedMs: 0,
      remainingMs: 0,
      phase: null,
      isExpired: false,
      flags: { ...DEFAULT_FLAGS },
    };
  }
  const elapsed = Math.max(0, now - scenario.startedAt);
  const remaining = Math.max(0, scenario.expiresAt - now);
  const isExpired = remaining <= 0;
  return {
    scenario,
    elapsedMs: elapsed,
    remainingMs: remaining,
    phase: scenarioPhase(elapsed),
    isExpired,
    flags: scenarioFlags(scenario, now),
  };
}

/**
 * Hook a metric to the active scenario.
 * Returns the baseline+delta value, re-rendering when the phase shifts.
 * Skips the per-second re-render by memoizing on phase, not on seconds —
 * the value only changes at phase boundaries so there's no point firing
 * 60 renders per minute into a component that only renders once per
 * phase.
 */
export function useMetric(
  key: MetricKey,
  scenario: ScenarioState | null,
): number {
  const [phaseKey, setPhaseKey] = useState(() => {
    if (!scenario) return 'baseline';
    return `${scenario.severity}-${scenarioPhase(Math.max(0, Date.now() - scenario.startedAt))}`;
  });

  useEffect(() => {
    if (!scenario) {
      setPhaseKey('baseline');
      return;
    }
    const check = () => {
      const elapsed = Math.max(0, Date.now() - scenario.startedAt);
      const phase = scenarioPhase(elapsed);
      const next = `${scenario.severity}-${phase}`;
      setPhaseKey((prev) => (prev === next ? prev : next));
    };
    check();
    const id = window.setInterval(check, 1000);
    return () => window.clearInterval(id);
    // phaseKey intentionally absent from deps — it's a rendering key, not an input
  }, [scenario?.severity, scenario?.startedAt]);

  void phaseKey;
  return metricValue(key, scenario);
}

// ────────────────────────────────────────────────────────────────────────
// Event runner — fires ScenarioEvents at their atSec timestamps.
// Only runs on the authoring device (prevents multi-device duplicates).
// ────────────────────────────────────────────────────────────────────────

export interface ScenarioEventHandlers {
  onEmsInject?: (payload: Record<string, unknown>) => void;
  onAlert?: (payload: { title: string; message: string; type: 'warning' | 'critical' | 'info' }) => void;
  onCode?: (payload: { room: string; type: string }) => void;
  onOverflowOpen?: () => void;
  onDischarge?: (payload: { room: string; patient: string }) => void;
  onSurgeActivate?: () => void;
  onSurgeDeactivate?: () => void;
  onToast?: (payload: { message: string; type: 'info' | 'success' | 'error' }) => void;
  /** Called once when scenario expires past duration. */
  onExpire?: () => void;
}

export function useScenarioEventRunner(
  scenario: ScenarioState | null,
  deviceId: string,
  handlers: ScenarioEventHandlers,
): void {
  const firedRef = useRef<Set<string>>(new Set());
  const expiredRef = useRef(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    // Reset fired state on scenario change or clear
    firedRef.current = new Set();
    expiredRef.current = false;

    if (!scenario) return;
    if (scenario.authorDevice !== deviceId) return;

    const events = SCENARIO_EVENTS[scenario.severity];
    const scenarioKey = `${scenario.severity}-${scenario.startedAt}`;

    const fire = (event: ScenarioEvent) => {
      const h = handlersRef.current;
      switch (event.kind) {
        case 'ems-inject':
          h.onEmsInject?.(event.payload ?? {});
          break;
        case 'alert':
          h.onAlert?.(event.payload as { title: string; message: string; type: 'warning' | 'critical' | 'info' });
          break;
        case 'code':
          h.onCode?.(event.payload as { room: string; type: string });
          break;
        case 'overflow-open':
          h.onOverflowOpen?.();
          break;
        case 'discharge':
          h.onDischarge?.(event.payload as { room: string; patient: string });
          break;
        case 'surge-activate':
          h.onSurgeActivate?.();
          break;
        case 'surge-deactivate':
          h.onSurgeDeactivate?.();
          break;
        case 'toast':
          h.onToast?.(event.payload as { message: string; type: 'info' | 'success' | 'error' });
          break;
      }
    };

    const check = () => {
      const elapsedMs = Date.now() - scenario.startedAt;

      // Fire past-due events
      events.forEach((event) => {
        const id = `${scenarioKey}:${event.atSec}:${event.kind}`;
        if (elapsedMs >= event.atSec * 1000 && !firedRef.current.has(id)) {
          firedRef.current.add(id);
          try {
            fire(event);
          } catch (err) {
            console.warn('[scenario] event handler threw', err);
          }
        }
      });

      // Fire expiry once when we cross the duration boundary
      if (elapsedMs >= SCENARIO_DURATION_MS && !expiredRef.current) {
        expiredRef.current = true;
        try {
          handlersRef.current.onExpire?.();
        } catch (err) {
          console.warn('[scenario] onExpire handler threw', err);
        }
      }
    };

    check();
    const id = window.setInterval(check, 500);
    return () => {
      window.clearInterval(id);
    };
  }, [scenario?.severity, scenario?.startedAt, scenario?.authorDevice, deviceId]);
}

// ────────────────────────────────────────────────────────────────────────
// UI meta — labels, taglines, tones for the Settings cards + HUD badge
// ────────────────────────────────────────────────────────────────────────

export interface ScenarioMeta {
  id: string;
  label: string;
  tagline: string;
  description: string;
  tone: 'ok' | 'warn' | 'crit';
}

export const SCENARIO_META: Record<ScenarioSeverity, ScenarioMeta> = {
  1: {
    id: 'S1',
    label: 'NORMAL',
    tagline: 'Baseline operations — quiet rhythm',
    description: 'Routine discharges, ambient EMS traffic, steady throughput',
    tone: 'ok',
  },
  2: {
    id: 'S2',
    label: 'MODERATE',
    tagline: 'Elevated load — building pressure',
    description: 'ER +40m, multi-trauma inbound, staffing tight',
    tone: 'warn',
  },
  3: {
    id: 'S3',
    label: 'DISASTER',
    tagline: 'Mass casualty event — surge auto-activates',
    description: 'Overflow opens, codes running, MCI protocol live',
    tone: 'crit',
  },
};

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────
// EMS bootstrap — scenario-tuned initial inbound list
// ────────────────────────────────────────────────────────────────────────
//
// `seedEmsInbound()` gives every shift the same 6 baseline runs. That's
// fine for the default screen but makes S1/S2/S3 look identical for the
// first ~15 seconds of a scenario (until timeline ems-inject events fire).
// This helper returns a fresh, scenario-tuned inbound list so the board
// paints correctly the instant a scenario activates.
//
// Shape is `Omit<EmsInbound, 'id' | 'createdAt'>` — same contract as
// `emsLive.inject()`. IDs are generated by the consumer.

export interface ScenarioEmsSeed {
  unit: string;
  mode: 'ground' | 'air';
  etaMinutes: number;
  age: number;
  sex: 'M' | 'F';
  chiefComplaint: string;
  activationLevel:
    | 'TRAUMA_1'
    | 'TRAUMA_2'
    | 'STROKE'
    | 'STEMI'
    | 'SEPSIS'
    | 'NONE';
  fieldVitals?: {
    heartRate?: number;
    systolic?: number;
    diastolic?: number;
    respRate?: number;
    spO2?: number;
    gcs?: number;
  };
  fieldTreatment?: string;
  destinationBay?: string;
}

export const SCENARIO_EMS_BOOTSTRAP: Record<ScenarioSeverity, ScenarioEmsSeed[]> = {
  // S1 · NORMAL — 2 routine runs. Board should read "quiet shift".
  1: [
    {
      unit: 'Medic 9',
      mode: 'ground',
      etaMinutes: 11,
      age: 62,
      sex: 'M',
      chiefComplaint: 'Fall from standing, no LOC, R hip pain',
      activationLevel: 'NONE',
      fieldVitals: { heartRate: 82, systolic: 136, diastolic: 78, respRate: 16, spO2: 97, gcs: 15 },
      fieldTreatment: 'IV NS KVO · fentanyl 50mcg',
      destinationBay: 'Acute 4',
    },
    {
      unit: 'Medic 22',
      mode: 'ground',
      etaMinutes: 14,
      age: 29,
      sex: 'F',
      chiefComplaint: 'Migraine, nausea, hx chronic',
      activationLevel: 'NONE',
      fieldVitals: { heartRate: 78, systolic: 118, diastolic: 72, respRate: 16, spO2: 99, gcs: 15 },
      fieldTreatment: 'O2 2L · ondansetron 4mg',
      destinationBay: 'Fast Track 2',
    },
  ],

  // S2 · MODERATE — 5 mixed runs, 1 trauma-2 + 1 stroke up front.
  2: [
    {
      unit: 'Medic 33',
      mode: 'ground',
      etaMinutes: 3,
      age: 54,
      sex: 'M',
      chiefComplaint: 'Crush injury, R arm, industrial press',
      activationLevel: 'TRAUMA_2',
      fieldVitals: { heartRate: 118, systolic: 102, diastolic: 64, respRate: 22, spO2: 96, gcs: 15 },
      fieldTreatment: 'TQ R upper arm · 18g IV NS · fentanyl 100mcg',
      destinationBay: 'Trauma 2',
    },
    {
      unit: 'Medic 28',
      mode: 'ground',
      etaMinutes: 6,
      age: 71,
      sex: 'F',
      chiefComplaint: 'AMS, poss CVA, last known well 45m ago',
      activationLevel: 'STROKE',
      fieldVitals: { heartRate: 94, systolic: 168, diastolic: 94, respRate: 18, spO2: 97, gcs: 13 },
      fieldTreatment: 'O2 NC · IV NS · stroke scale: 6',
      destinationBay: 'Acute 1',
    },
    {
      unit: 'Medic 14',
      mode: 'ground',
      etaMinutes: 9,
      age: 45,
      sex: 'M',
      chiefComplaint: 'Chest pain, diaphoretic, hx HTN',
      activationLevel: 'NONE',
      fieldVitals: { heartRate: 96, systolic: 142, diastolic: 88, respRate: 18, spO2: 97, gcs: 15 },
      fieldTreatment: 'ASA 325 · IV NS · 12-lead pending',
      destinationBay: 'Acute 2',
    },
    {
      unit: 'Medic 41',
      mode: 'ground',
      etaMinutes: 12,
      age: 81,
      sex: 'F',
      chiefComplaint: 'SOB, CHF exacerbation, LE edema',
      activationLevel: 'NONE',
      fieldVitals: { heartRate: 104, systolic: 158, diastolic: 92, respRate: 24, spO2: 91, gcs: 15 },
      fieldTreatment: 'O2 4L NC · IV access',
      destinationBay: 'Acute 5',
    },
    {
      unit: 'Medic 17',
      mode: 'ground',
      etaMinutes: 16,
      age: 33,
      sex: 'M',
      chiefComplaint: 'Lac R forearm, glass, bleeding controlled',
      activationLevel: 'NONE',
      fieldVitals: { heartRate: 88, systolic: 128, diastolic: 78, respRate: 16, spO2: 98, gcs: 15 },
      fieldTreatment: 'Pressure dressing · IV access',
      destinationBay: 'Fast Track 1',
    },
  ],

  // S3 · DISASTER — 8 runs, heavy trauma load. MCI bus rollover set.
  3: [
    {
      unit: 'Medic 41',
      mode: 'ground',
      etaMinutes: 2,
      age: 22,
      sex: 'M',
      chiefComplaint: 'MCI bus rollover, ejected, multiple rib fx, pneumothorax',
      activationLevel: 'TRAUMA_1',
      fieldVitals: { heartRate: 138, systolic: 78, diastolic: 42, respRate: 32, spO2: 88, gcs: 11 },
      fieldTreatment: 'Bilateral 14g IV · TXA 1g · chest seal L · c-collar',
      destinationBay: 'Trauma 1',
    },
    {
      unit: 'Medic 42',
      mode: 'ground',
      etaMinutes: 4,
      age: 34,
      sex: 'F',
      chiefComplaint: 'MCI bus rollover, restrained, GCS 14, open tib-fib',
      activationLevel: 'TRAUMA_2',
      fieldVitals: { heartRate: 112, systolic: 108, diastolic: 68, respRate: 22, spO2: 95, gcs: 14 },
      fieldTreatment: '18g IV NS · splint R leg · fentanyl 75mcg',
      destinationBay: 'Trauma 2',
    },
    {
      unit: 'Air 5',
      mode: 'air',
      etaMinutes: 6,
      age: 8,
      sex: 'M',
      chiefComplaint: 'MCI peds, unrestrained, AMS, scalp lac',
      activationLevel: 'TRAUMA_1',
      fieldVitals: { heartRate: 152, systolic: 82, diastolic: 50, respRate: 28, spO2: 93, gcs: 12 },
      fieldTreatment: 'IO access · NS 20mL/kg · c-collar · pressure to scalp',
      destinationBay: 'Trauma 1',
    },
    {
      unit: 'Medic 51',
      mode: 'ground',
      etaMinutes: 8,
      age: 47,
      sex: 'F',
      chiefComplaint: 'MCI, seatbelt sign, abd pain, +FAST LUQ',
      activationLevel: 'TRAUMA_1',
      fieldVitals: { heartRate: 124, systolic: 94, diastolic: 58, respRate: 24, spO2: 96, gcs: 14 },
      fieldTreatment: '2x 18g IV NS WO · TXA 1g',
      destinationBay: 'Trauma 2',
    },
    {
      unit: 'Medic 12',
      mode: 'ground',
      etaMinutes: 10,
      age: 58,
      sex: 'M',
      chiefComplaint: 'Substernal CP 1h, diaphoretic, ST elev II/III/aVF',
      activationLevel: 'STEMI',
      fieldVitals: { heartRate: 102, systolic: 142, diastolic: 88, respRate: 18, spO2: 97, gcs: 15 },
      fieldTreatment: 'ASA 325 · NTG 0.4 SL · heparin 4000u · cath lab paged',
      destinationBay: 'Cath Lab',
    },
    {
      unit: 'Medic 38',
      mode: 'ground',
      etaMinutes: 12,
      age: 19,
      sex: 'M',
      chiefComplaint: 'MCI, lower extremity crush, R leg mangled',
      activationLevel: 'TRAUMA_2',
      fieldVitals: { heartRate: 128, systolic: 98, diastolic: 62, respRate: 22, spO2: 96, gcs: 15 },
      fieldTreatment: 'TQ R thigh · 18g IV NS · fentanyl 150mcg',
      destinationBay: 'Trauma 3',
    },
    {
      unit: 'Air 2',
      mode: 'air',
      etaMinutes: 14,
      age: 63,
      sex: 'F',
      chiefComplaint: 'MCI, chest/back pain, +chest wall tenderness',
      activationLevel: 'TRAUMA_2',
      fieldVitals: { heartRate: 104, systolic: 116, diastolic: 72, respRate: 20, spO2: 94, gcs: 15 },
      fieldTreatment: 'IV NS · c-collar · O2 NRB',
      destinationBay: 'Trauma 3',
    },
    {
      unit: 'Medic 6',
      mode: 'ground',
      etaMinutes: 17,
      age: 71,
      sex: 'F',
      chiefComplaint: 'MCI bystander, CP + SOB, hx CAD',
      activationLevel: 'NONE',
      fieldVitals: { heartRate: 94, systolic: 158, diastolic: 88, respRate: 20, spO2: 95, gcs: 15 },
      fieldTreatment: 'O2 NC · ASA 325 · IV NS',
      destinationBay: 'Acute 3',
    },
  ],
};

/** Lookup helper — returns the scenario-tuned inbound seed. */
export function scenarioEmsBootstrap(severity: ScenarioSeverity): ScenarioEmsSeed[] {
  return SCENARIO_EMS_BOOTSTRAP[severity];
}

export function buildScenarioState(
  severity: ScenarioSeverity,
  deviceId: string,
): ScenarioState {
  const now = Date.now();
  return {
    severity,
    startedAt: now,
    expiresAt: now + SCENARIO_DURATION_MS,
    authorDevice: deviceId,
  };
}

export function formatScenarioRemaining(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Phase label for UI (all caps) — used in HUD badge and Settings countdown. */
export function phaseLabel(phase: ScenarioPhase | null): string {
  if (!phase) return '';
  switch (phase) {
    case 'ramp': return 'RAMP';
    case 'climb': return 'CLIMB';
    case 'peak': return 'PEAK';
    case 'hold': return 'HOLD';
    case 'windDown': return 'WIND DOWN';
    case 'closing': return 'CLOSING';
  }
}
