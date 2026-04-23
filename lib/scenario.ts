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
  // ── S1 · NORMAL ── Subtle breathing. Things feel alive, not urgent.
  // Numbers drift slightly below baseline then return.
  1: [
    { phase: 'ramp', delta: { census: 0, erWaitMinutes: -2 } },
    { phase: 'climb', delta: { census: -1, erWaitMinutes: -5, dischargesPending: 2 } },
    { phase: 'peak', delta: { census: -2, erWaitMinutes: -8, ambulanceCount: 1, dischargesPending: 3 } },
    { phase: 'hold', delta: { census: -1, erWaitMinutes: -3, dischargesPending: 1 } },
    { phase: 'windDown', delta: { census: 0, erWaitMinutes: 0 } },
    { phase: 'closing', delta: { census: 0, erWaitMinutes: 2 } },
  ],

  // ── S2 · MODERATE ── Elevated load. Nothing catastrophic, but
  // pressure builds. Does NOT auto-activate surge (user can manually).
  2: [
    { phase: 'ramp', delta: { census: 3, erWaitMinutes: 15, ambulanceCount: 1, activeAlerts: 1, emsOffloadRiskMin: 10, triageWaitMin: 10 } },
    { phase: 'climb', delta: { census: 8, erWaitMinutes: 28, ambulanceCount: 2, staffingRatio: 0.4, activeAlerts: 1, emsOffloadRiskMin: 20, triageWaitMin: 20, boardingAdmitted: 3 } },
    { phase: 'peak', delta: { census: 14, erWaitMinutes: 42, ambulanceCount: 3, staffingRatio: 0.9, activeAlerts: 2, triageWaitMin: 30, boardingAdmitted: 6, emsOffloadRiskMin: 30, nedocsScore: 20, icuOccupancyPct: 5 } },
    { phase: 'hold', delta: { census: 12, erWaitMinutes: 38, ambulanceCount: 2, staffingRatio: 0.7, activeAlerts: 2, triageWaitMin: 25, boardingAdmitted: 5, emsOffloadRiskMin: 25, nedocsScore: 16, icuOccupancyPct: 4 } },
    { phase: 'windDown', delta: { census: 8, erWaitMinutes: 20, ambulanceCount: 1, staffingRatio: 0.3, activeAlerts: 1, triageWaitMin: 15, boardingAdmitted: 3, emsOffloadRiskMin: 12, icuOccupancyPct: 2 } },
    { phase: 'closing', delta: { census: 4, erWaitMinutes: 10, boardingAdmitted: 1 } },
  ],

  // ── S3 · DISASTER ── MCI event. Auto-activates surge at T+2s.
  // Census +28 at peak, ambulance divert, overflow open, MTP active.
  3: [
    { phase: 'ramp', delta: { census: 8, erWaitMinutes: 40, ambulanceCount: 2, activeAlerts: 3, triageWaitMin: 20, boardingAdmitted: 4, emsOffloadRiskMin: 25, nedocsScore: 20 }, flags: { overflowOpen: true } },
    { phase: 'climb', delta: { census: 18, erWaitMinutes: 65, ambulanceCount: 4, staffingRatio: 1.2, activeAlerts: 5, activeCodes: 1, triageWaitMin: 45, traumaBaysAvailable: -2, boardingAdmitted: 9, emsOffloadRiskMin: 45, nedocsScore: 40, icuOccupancyPct: 8, rnShortfall: -2, orAvailable: -2 }, flags: { overflowOpen: true, ambulanceDivert: true } },
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
