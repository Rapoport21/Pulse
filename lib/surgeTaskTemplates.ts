/**
 * Surge urgent-task templates — state-aware pool.
 *
 * When surge activates, we don't want to produce the same five tasks
 * every time — a demo observer who runs surge twice should see a
 * different action list the second time. To get that variance without
 * it feeling random, each template declares:
 *
 *   • a `condition` over current hospital state (bedUnits + patients +
 *     admission queue) that decides whether the task is eligible, and
 *   • an optional dynamic `title` / `description` resolver so counts
 *     ("4 beds not staffed") reflect what's actually happening.
 *
 * `buildInitialUrgentTasks(ctx)` walks the pool, keeps the eligible
 * templates, picks up to 2 always-on baseline tasks plus 3–5 from the
 * eligible conditional pool, and returns them ordered critical-first.
 *
 * This is the ONLY place to change surge task content. Adapter for a
 * real Gemini-generated plan later would slot in here, swapping the
 * template pool for model output while keeping the same shape.
 */

import type { Bed, BedUnit } from '../data/bedMock';
import type { Patient } from '../types';
import type { AdmissionEntry } from '../components/clinical';

export type UrgentPriority = 'critical' | 'high';

export interface UrgentTask {
  id: string;
  title: string;
  description?: string;
  role?: string;
  priority: UrgentPriority;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: number | null;
}

export interface SurgeModeState {
  active: boolean;
  activatedAt: number | null;
}

// ───────────────────────────────────────────────────────────────────────
// Surge context — snapshot of the hospital state at the moment surge
// activates. Passed into each template's condition resolver so tasks
// can reflect real counts ("3 dirty beds awaiting EVS" rather than
// a vague "turn over dirty beds").
// ───────────────────────────────────────────────────────────────────────

export interface SurgeContext {
  bedUnits: BedUnit[];
  patients: Patient[];
  admissionQueue: AdmissionEntry[];
}

// Stats derived once per activation so each condition resolver doesn't
// re-flatten bedUnits.
interface SurgeStats {
  allBeds: Bed[];
  occupiedCount: number;
  readyCount: number;
  dirtyCount: number;
  notStaffedCount: number;
  blockedCount: number;
  reservedCount: number;
  totalCount: number;
  traumaBaysOpen: number;
  icuOccupiedCount: number;
  icuReadyCount: number;
  overflowBedsOpen: number;
  isolationCount: number;
  dcOrderWrittenCount: number;
  edHoldsCount: number;
  pendingAdmitsFromEd: number;
  pendingAdmitsToIcu: number;
  longestEdWaitMin: number;
}

function buildStats(ctx: SurgeContext): SurgeStats {
  const allBeds = ctx.bedUnits.flatMap((u) => u.beds);
  const traumaUnit = ctx.bedUnits.find((u) => u.id === 'ed-trauma');
  const icuUnit = ctx.bedUnits.find((u) => u.id === 'icu');
  const overflowUnit = ctx.bedUnits.find((u) => u.surgeOnly === true);
  const edAcute = ctx.bedUnits.find((u) => u.id === 'ed-acute');

  return {
    allBeds,
    occupiedCount: allBeds.filter((b) => b.state === 'occupied').length,
    readyCount: allBeds.filter((b) => b.state === 'ready').length,
    dirtyCount: allBeds.filter((b) => b.state === 'dirty').length,
    notStaffedCount: allBeds.filter((b) => b.state === 'not_staffed').length,
    blockedCount: allBeds.filter((b) => b.state === 'blocked').length,
    reservedCount: allBeds.filter((b) => b.state === 'reserved').length,
    totalCount: allBeds.length,
    traumaBaysOpen: traumaUnit
      ? traumaUnit.beds.filter((b) => b.state === 'ready').length
      : 0,
    icuOccupiedCount: icuUnit
      ? icuUnit.beds.filter((b) => b.state === 'occupied').length
      : 0,
    icuReadyCount: icuUnit
      ? icuUnit.beds.filter((b) => b.state === 'ready').length
      : 0,
    overflowBedsOpen: overflowUnit
      ? overflowUnit.beds.filter((b) => b.state === 'ready').length
      : 0,
    isolationCount: allBeds.filter(
      (b) => b.isolation && b.isolation !== 'NONE',
    ).length,
    dcOrderWrittenCount: allBeds.filter(
      (b) => b.dischargeMilestones?.dcOrderWritten === true,
    ).length,
    edHoldsCount: edAcute
      ? edAcute.beds.filter((b) => b.state === 'occupied').length
      : 0,
    pendingAdmitsFromEd: ctx.admissionQueue.filter((a) => a.source === 'ED').length,
    pendingAdmitsToIcu: ctx.admissionQueue.filter((a) => a.requestedUnit === 'ICU').length,
    longestEdWaitMin: ctx.admissionQueue.reduce(
      (max, a) => Math.max(max, a.waitMin ?? 0),
      0,
    ),
  };
}

// ───────────────────────────────────────────────────────────────────────
// Template shape — condition decides eligibility, resolveTitle /
// resolveDescription can render dynamic counts once eligible.
// ───────────────────────────────────────────────────────────────────────

interface SurgeTaskTemplate {
  /** Stable template id, used for de-duplication and test hooks. */
  key: string;
  role?: string;
  priority: UrgentPriority;
  /** Static fallback title — used when resolveTitle is not provided. */
  title: string;
  /** Static fallback description — used when resolveDescription is not provided. */
  description?: string;
  /** If true, always eligible regardless of state. Used sparingly for baseline tasks. */
  alwaysEligible?: boolean;
  /** Returns true if this template should be considered for the activation. */
  isEligible?: (stats: SurgeStats, ctx: SurgeContext) => boolean;
  /** Optional dynamic title builder. Called only if eligible. */
  resolveTitle?: (stats: SurgeStats, ctx: SurgeContext) => string;
  /** Optional dynamic description builder. Called only if eligible. */
  resolveDescription?: (stats: SurgeStats, ctx: SurgeContext) => string | undefined;
}

// ───────────────────────────────────────────────────────────────────────
// The pool — a mix of always-on and conditional templates, organized
// by operational category. We overshoot with variety; the activator
// picks a subset.
// ───────────────────────────────────────────────────────────────────────

const TEMPLATES: ReadonlyArray<SurgeTaskTemplate> = [
  // ── Always-on baseline: these frame the response regardless of state ──
  {
    key: 'page-trauma-lead',
    title: 'Page Dr. Kim — trauma lead',
    description: 'Confirm ETA for trauma response',
    role: 'Charge',
    priority: 'critical',
    alwaysEligible: true,
  },
  {
    key: 'open-surge-command',
    title: 'Open surge command post — conference room B',
    description: 'Charge + attending + EVS lead converge',
    role: 'Charge',
    priority: 'critical',
    alwaysEligible: true,
  },
  {
    key: 'brief-oncoming-shift',
    title: 'Brief oncoming shift — extend current shift 30 min if needed',
    description: 'Nurse manager confirms float pool availability',
    role: 'Charge',
    priority: 'high',
    alwaysEligible: true,
  },

  // ── Bed / capacity response ─────────────────────────────────────────
  {
    key: 'open-overflow-hall-c',
    title: 'Open overflow bay in Hall C',
    description: 'Stage gurneys and clear corridor',
    role: 'Charge',
    priority: 'critical',
    isEligible: (s) => s.overflowBedsOpen > 0 || s.readyCount <= 6,
    resolveTitle: (s) =>
      s.overflowBedsOpen > 0
        ? `Stand up Overflow Hall C — ${s.overflowBedsOpen} beds to activate`
        : 'Open overflow bay in Hall C',
  },
  {
    key: 'staff-unstaffed-beds',
    title: 'Deploy float pool to unstaffed beds',
    description: 'Activate float pool for coverage',
    role: 'Charge',
    priority: 'critical',
    isEligible: (s) => s.notStaffedCount > 0,
    resolveTitle: (s) => `Staff ${s.notStaffedCount} unstaffed bed${s.notStaffedCount > 1 ? 's' : ''} — deploy float pool`,
    resolveDescription: (s) =>
      `${s.notStaffedCount} bed${s.notStaffedCount > 1 ? 's' : ''} physically ready but no nurse assigned`,
  },
  {
    key: 'fast-turn-dirty',
    title: 'EVS rapid response — turn over dirty beds',
    description: 'Target 15-minute turnover for surge window',
    role: 'Charge',
    priority: 'high',
    isEligible: (s) => s.dirtyCount > 0,
    resolveTitle: (s) => `EVS rapid turn — ${s.dirtyCount} dirty bed${s.dirtyCount > 1 ? 's' : ''} waiting`,
  },
  {
    key: 'unblock-maintenance',
    title: 'Review blocked beds for rapid return-to-service',
    description: 'Facilities on-call paged — triage maintenance holds',
    role: 'Charge',
    priority: 'high',
    isEligible: (s) => s.blockedCount >= 2,
    resolveTitle: (s) => `Audit ${s.blockedCount} blocked beds — rush facilities`,
  },

  // ── Discharge / throughput ──────────────────────────────────────────
  {
    key: 'fast-track-discharges',
    title: 'Fast-track pending discharges',
    description: 'Confirm ride, meds, DC order for pending DCs',
    role: 'RN',
    priority: 'high',
    isEligible: (s) => s.dcOrderWrittenCount > 0,
    resolveTitle: (s) =>
      `Fast-track ${s.dcOrderWrittenCount} discharge${s.dcOrderWrittenCount > 1 ? 's' : ''} — order written, bed needed`,
  },
  {
    key: 'reassign-stable-to-medsurg',
    title: 'Reassign stable patients from Bay 3 to Med-Surg',
    description: 'Coordinate with Med-Surg for transfer',
    role: 'RN',
    priority: 'high',
    isEligible: (s) => s.edHoldsCount >= 4,
  },
  {
    key: 'move-ed-holds-upstairs',
    title: 'Move ED boarders to floor — coordinate with bed mgmt',
    description: 'Prioritize by LOS and acuity',
    role: 'Charge',
    priority: 'high',
    isEligible: (s) => s.edHoldsCount >= 3,
    resolveDescription: (s) => `${s.edHoldsCount} ED patients boarding · longest wait ${s.longestEdWaitMin || 90}+ min`,
  },

  // ── Pending admits / ICU ────────────────────────────────────────────
  {
    key: 'clear-icu-admits',
    title: 'Clear ICU admit queue — page hospitalist',
    description: 'Pending admits waiting on ICU bed',
    role: 'Charge',
    priority: 'critical',
    isEligible: (s) => s.pendingAdmitsToIcu > 0 && s.icuReadyCount === 0,
    resolveTitle: (s) => `Break ICU gridlock — ${s.pendingAdmitsToIcu} pending admit${s.pendingAdmitsToIcu > 1 ? 's' : ''}, 0 beds`,
  },
  {
    key: 'triage-pending-admits',
    title: 'Re-triage pending admit queue',
    description: 'Identify direct admits eligible for fast-track',
    role: 'Charge',
    priority: 'high',
    isEligible: (s) => s.pendingAdmitsFromEd >= 2,
    resolveTitle: (s) => `Re-triage ${s.pendingAdmitsFromEd} pending ED admits`,
  },

  // ── Trauma / imaging / equipment ────────────────────────────────────
  {
    key: 'prep-crash-carts',
    title: 'Prep 2 additional crash carts',
    description: 'Stock and verify O2 cylinders',
    role: 'RN',
    priority: 'high',
    isEligible: (s) => s.traumaBaysOpen <= 1,
  },
  {
    key: 'hold-non-urgent-cts',
    title: 'Call radiology — hold non-urgent CTs',
    description: 'Free CT 1 for trauma scans',
    role: 'Charge',
    priority: 'high',
    alwaysEligible: true,
  },
  {
    key: 'vent-inventory',
    title: 'Verify vent inventory — ICU + ED + transport',
    description: 'Confirm 3+ ICU-capable vents uncommitted',
    role: 'RT',
    priority: 'high',
    isEligible: (s) => s.icuOccupiedCount >= 4,
  },
  {
    key: 'stock-trauma-bay',
    title: 'Re-stock Trauma 1 & 2 — chest tubes, TXA, O-neg',
    description: 'Post-activation restock before next inbound',
    role: 'RN',
    priority: 'high',
    isEligible: (s) => s.traumaBaysOpen === 0,
  },

  // ── Isolation / infection control ───────────────────────────────────
  {
    key: 'audit-isolation',
    title: 'Audit isolation compliance — contact/droplet precautions',
    description: 'Signage + PPE stocked at every isolation door',
    role: 'IP',
    priority: 'high',
    isEligible: (s) => s.isolationCount >= 2,
    resolveTitle: (s) => `Audit ${s.isolationCount} isolation rooms — PPE + signage`,
  },

  // ── Coordination / comms ────────────────────────────────────────────
  {
    key: 'divert-ambulance',
    title: 'Eval ambulance divert status with EMS coordinator',
    description: 'Notify regional dispatch if capacity hits ceiling',
    role: 'Charge',
    priority: 'critical',
    isEligible: (s) => s.readyCount <= 2 && s.overflowBedsOpen === 0,
  },
  {
    key: 'redirect-fast-track',
    title: 'Redirect walk-ins to Fast Track',
    description: 'Triage screens ESI 4-5 away from main ED',
    role: 'RN',
    priority: 'high',
    alwaysEligible: true,
  },
  {
    key: 'lab-stat-queue',
    title: 'Lab — flag stat queue for trauma / stroke / STEMI',
    description: 'Confirm courier and result posting window',
    role: 'Charge',
    priority: 'high',
    isEligible: (s) => s.reservedCount >= 2,
  },
  {
    key: 'pharmacy-standby',
    title: 'Pharmacy standby — TNK, blood products, RSI kits',
    description: 'Confirm on-call pharmacist in ED satellite',
    role: 'Charge',
    priority: 'high',
    alwaysEligible: true,
  },

  // ── Administrative / severe capacity ────────────────────────────────
  {
    key: 'cmo-break-glass',
    title: 'Break glass — contact CMO on-call',
    description: 'Authorization for resource ceiling escalation',
    role: 'Admin',
    priority: 'critical',
    isEligible: (s) =>
      s.readyCount <= 1 && s.overflowBedsOpen === 0 && s.notStaffedCount >= 2,
  },
];

// ───────────────────────────────────────────────────────────────────────
// Selection — given a context, pick a varied task mix.
//
// Strategy:
//   1. Collect eligible templates (alwaysEligible OR condition passed).
//   2. Always include up to 2 alwaysEligible templates at the top.
//   3. Shuffle the remaining conditional pool and take 3-5 so the list
//      has variance across activations.
//   4. Order the final list critical-first so the UI highlight order
//      matches clinical priority.
// ───────────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  // Fisher-Yates (non-crypto — fine for demo randomness).
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function materializeTask(
  template: SurgeTaskTemplate,
  idx: number,
  stats: SurgeStats,
  ctx: SurgeContext,
): UrgentTask {
  const title = template.resolveTitle
    ? template.resolveTitle(stats, ctx)
    : template.title;
  const description = template.resolveDescription
    ? template.resolveDescription(stats, ctx)
    : template.description;
  return {
    id: `surge-task-${Date.now().toString(36)}-${idx}`,
    title,
    description,
    role: template.role,
    priority: template.priority,
    acknowledged: false,
    acknowledgedBy: null,
    acknowledgedAt: null,
  };
}

/**
 * Build the urgent-task list for a surge activation.
 *
 * If `ctx` is omitted (for test harnesses or when activating without a
 * real snapshot), falls back to the alwaysEligible templates only so
 * the list is still coherent.
 */
export function buildInitialUrgentTasks(ctx?: SurgeContext): UrgentTask[] {
  // Fallback path: no context → alwaysEligible templates only, in order.
  if (!ctx) {
    const baseline = TEMPLATES.filter((t) => t.alwaysEligible);
    const emptyStats = {} as SurgeStats;
    const emptyCtx = {} as SurgeContext;
    return baseline.map((t, i) => materializeTask(t, i, emptyStats, emptyCtx));
  }

  const stats = buildStats(ctx);

  const alwaysOn = TEMPLATES.filter((t) => t.alwaysEligible);
  const conditional = TEMPLATES.filter(
    (t) => !t.alwaysEligible && t.isEligible?.(stats, ctx),
  );

  // Pick 2 always-on baseline items (prefer the critical ones) +
  // 3-5 conditional items for variance.
  const shuffledAlways = shuffle(alwaysOn).sort((a, b) =>
    a.priority === b.priority ? 0 : a.priority === 'critical' ? -1 : 1,
  );
  const baseline = shuffledAlways.slice(0, 2);

  const shuffledConditional = shuffle(conditional);
  const conditionalPickCount = Math.min(
    5,
    Math.max(3, shuffledConditional.length),
  );
  const picks = shuffledConditional.slice(0, conditionalPickCount);

  const chosen = [...baseline, ...picks];

  // Order critical first, keep original pick order within each priority.
  const ordered = chosen.sort((a, b) =>
    a.priority === b.priority ? 0 : a.priority === 'critical' ? -1 : 1,
  );

  return ordered.map((template, idx) => materializeTask(template, idx, stats, ctx));
}

export const INITIAL_SURGE_STATE: SurgeModeState = {
  active: false,
  activatedAt: null,
};
