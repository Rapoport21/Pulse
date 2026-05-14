/**
 * pulseAI — the proactive AI activity layer.
 *
 * PULSE.AI is the agentic layer that runs in the background of every
 * surface. Mode of operation (sprint plan §1.2):
 *
 *   • WATCH every signal stream (alerts, labs, vitals, capacity,
 *     inbound EMS, staff fatigue, calls)
 *   • ACT AUTONOMOUSLY on mechanical / well-bounded tasks (paging,
 *     scheduling lab redraws, dispatching EVS, posting status updates)
 *   • ESCALATE to a human via the HITL gate on clinical-judgment items
 *   • SURFACE a feed on every screen where it acted, plus a dedicated
 *     PULSE.AI activity surface
 *
 * This file is the runtime: a React provider + a mock activity stream
 * that fires representative events on a timer. Real backend wiring
 * replaces the mock loop later; the consumer API stays the same.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// ════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════

export type AiActionKind =
  | 'auto_executed'   // AI ran the action itself, no human needed
  | 'awaiting_review' // AI proposed, human must approve
  | 'escalated'       // AI flagged a critical signal for human action
  | 'monitoring';     // AI is watching, no action yet

export type AiConfidence = 'high' | 'med' | 'low';

export type AiSurface =
  | 'horizon'   // capacity / surge prediction
  | 'alerts'    // alarm consolidation
  | 'staffing'  // shift coverage / float
  | 'tasks'     // extracted from calls
  | 'beds'      // bed flow / EVS
  | 'labs'      // lab follow-up
  | 'ems';      // inbound EMS

export interface AiActivityEvent {
  id: string;
  kind: AiActionKind;
  confidence: AiConfidence;
  surface: AiSurface;
  /** Short headline of what the AI did. */
  title: string;
  /** Optional one-line justification surfaced in tooltips / detail. */
  reasoning?: string;
  /** When the action happened (ms epoch). */
  at: number;
}

// ════════════════════════════════════════════════════════════════
// Mock activity stream
// ════════════════════════════════════════════════════════════════

const MOCK_AUTOSEED: Omit<AiActivityEvent, 'id' | 'at'>[] = [
  {
    kind: 'auto_executed',
    confidence: 'high',
    surface: 'alerts',
    title: 'Silenced 4 false telemetry alarms · bed 7',
    reasoning: 'Lead disconnects matched known pattern, no clinical correlate',
  },
  {
    kind: 'auto_executed',
    confidence: 'high',
    surface: 'labs',
    title: 'Pre-scheduled vanco trough draw · bed 12',
    reasoning: 'Trough due at 18:00; pharm window confirmed',
  },
  {
    kind: 'auto_executed',
    confidence: 'high',
    surface: 'beds',
    title: 'Dispatched EVS · bed 14',
    reasoning: 'Discharge order signed 4m ago; standard cleaning protocol',
  },
  {
    kind: 'awaiting_review',
    confidence: 'med',
    surface: 'staffing',
    title: 'Float proposal · Nurse Diaz from Med-Surg → ED',
    reasoning: 'ED ratio 1:5.2 (above target); Med-Surg has spare capacity',
  },
  {
    kind: 'auto_executed',
    confidence: 'high',
    surface: 'tasks',
    title: 'Logged MTP cooler dispatch · Trauma 1',
    reasoning: 'Confirmed by Blood Bank on the call',
  },
  {
    kind: 'escalated',
    confidence: 'low',
    surface: 'horizon',
    title: 'Surge probability 64% next hour · review divert posture',
    reasoning: 'Inbound EMS volume + door-to-disposition trend',
  },
  {
    kind: 'monitoring',
    confidence: 'high',
    surface: 'ems',
    title: 'Watching: 3 inbound EMS, ETA 6-14m',
    reasoning: 'Auto-prep brief at ETA 2:00 per protocol',
  },
];

// ════════════════════════════════════════════════════════════════
// Context
// ════════════════════════════════════════════════════════════════

interface PulseAiContextValue {
  events: AiActivityEvent[];
  /** Filter helpers used by surface-specific badges. */
  forSurface: (s: AiSurface) => AiActivityEvent[];
  /** Counts surfaced by the global activity strip. */
  counts: {
    total: number;
    autoExecuted: number;
    awaitingReview: number;
    escalated: number;
    monitoring: number;
  };
  /** Drop an item from the feed (e.g. when its proposal is decided). */
  resolve: (id: string) => void;
}

const PulseAiContext = createContext<PulseAiContextValue | null>(null);

export function usePulseAi(): PulseAiContextValue {
  const ctx = useContext(PulseAiContext);
  if (!ctx) {
    throw new Error('usePulseAi must be used inside <PulseAiProvider>');
  }
  return ctx;
}

/** Convenience: just the events filtered by surface. */
export function useAiActivity(surface: AiSurface): AiActivityEvent[] {
  const { forSurface } = usePulseAi();
  return forSurface(surface);
}

let __nextId = 1;
const newId = () => `ai${__nextId++}_${Date.now().toString(36)}`;

export const PulseAiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<AiActivityEvent[]>(() =>
    MOCK_AUTOSEED.map((e, i) => ({
      ...e,
      id: newId(),
      // Pre-seeded events stagger 30s apart so the feed looks lived-in
      // immediately on first paint.
      at: Date.now() - (MOCK_AUTOSEED.length - i) * 30_000,
    })),
  );

  // Mock production stream: a new event lands every ~12s. Cycles
  // through the seed templates so the feed always feels alive.
  useEffect(() => {
    let idx = 0;
    const id = setInterval(() => {
      const template = MOCK_AUTOSEED[idx % MOCK_AUTOSEED.length];
      idx++;
      const evt: AiActivityEvent = {
        ...template,
        id: newId(),
        at: Date.now(),
      };
      // Prepend; cap the feed at 50 so memory stays bounded.
      setEvents((prev) => [evt, ...prev].slice(0, 50));
    }, 12_000);
    return () => clearInterval(id);
  }, []);

  const forSurface = useCallback(
    (s: AiSurface) => events.filter((e) => e.surface === s),
    [events],
  );

  const counts = {
    total: events.length,
    autoExecuted: events.filter((e) => e.kind === 'auto_executed').length,
    awaitingReview: events.filter((e) => e.kind === 'awaiting_review').length,
    escalated: events.filter((e) => e.kind === 'escalated').length,
    monitoring: events.filter((e) => e.kind === 'monitoring').length,
  };

  const resolve = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return (
    <PulseAiContext.Provider value={{ events, forSurface, counts, resolve }}>
      {children}
    </PulseAiContext.Provider>
  );
};

// ════════════════════════════════════════════════════════════════
// Helpers (exported)
// ════════════════════════════════════════════════════════════════

export const formatAge = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

export const kindLabel = (k: AiActionKind): string =>
  k === 'auto_executed' ? 'AUTO'
  : k === 'awaiting_review' ? 'NEEDS YOU'
  : k === 'escalated' ? 'ESCALATED'
  : 'WATCHING';
