/**
 * EMS live feed hook — useEmsInbound()
 *
 * Returns a stateful list of inbound EMS runs with ETAs that
 * decrement once per second. When a run hits ETA 0 it transitions
 * into the "ARRIVED" terminal state for ~30 seconds (so the board
 * shows the green "ARRIVED" pill long enough for the eye to catch
 * it) and is then removed from the active list.
 *
 * The hook also surfaces handles for the consumer to:
 *   • acknowledge a run (removes it immediately)
 *   • inject a new inbound (used by the demo "+ INBOUND" button)
 *
 * No real radio. This is a faithful UI surface that the eventual
 * Pulsara/HEAR-net adapter can plug into without changing the
 * component contract.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { EmsInbound } from '../types';
import { seedEmsInbound } from '../data/emsMock';
import { subscribe, publish } from './realtime';

export interface EmsInboundLive extends EmsInbound {
  /** ETA in whole minutes, decremented each tick (clamped at 0). */
  etaMinutes: number;
  /** Real wall-clock seconds remaining. Used by the count-up bar. */
  etaSeconds: number;
  /** Set true once etaSeconds hits 0; row stays for 30s then auto-clears. */
  arrived: boolean;
  /** Wall-clock ms when etaSeconds first reached 0. */
  arrivedAt?: number;
}

const ARRIVED_LINGER_MS = 30_000;

/**
 * Convert a seed EmsInbound (which only knows minutes) into a
 * live row with second-precision tracking. The starting offset is
 * randomized within the minute so the rows don't all tick down in
 * lockstep — gives the board a more realistic, breathing feel.
 */
const liftSeed = (seed: EmsInbound[]): EmsInboundLive[] =>
  seed.map((r) => ({
    ...r,
    etaMinutes: r.etaMinutes,
    etaSeconds: r.etaMinutes * 60 + Math.floor(Math.random() * 30),
    arrived: false,
  }));

export const useEmsInbound = (): {
  inbound: EmsInboundLive[];
  acknowledge: (id: string) => void;
  reset: () => void;
  inject: (run: Omit<EmsInbound, 'id' | 'createdAt'>) => void;
} => {
  const [inbound, setInbound] = useState<EmsInboundLive[]>(() => liftSeed(seedEmsInbound()));
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    tickRef.current = window.setInterval(() => {
      setInbound((prev) => {
        const now = Date.now();
        return prev
          .map((r) => {
            // Already arrived → leave it; sweeper below removes it.
            if (r.arrived) return r;
            const next = Math.max(0, r.etaSeconds - 1);
            if (next === 0) {
              return { ...r, etaSeconds: 0, etaMinutes: 0, arrived: true, arrivedAt: now };
            }
            return {
              ...r,
              etaSeconds: next,
              etaMinutes: Math.ceil(next / 60),
            };
          })
          // Drop arrived rows once they've lingered long enough
          .filter((r) => !r.arrived || (r.arrivedAt && now - r.arrivedAt < ARRIVED_LINGER_MS));
      });
    }, 1000);
    return () => {
      if (tickRef.current != null) window.clearInterval(tickRef.current);
    };
  }, []);

  // Listen for cross-device EMS commands via realtime broadcast
  useEffect(() => {
    const unsubInject = subscribe<Omit<EmsInbound, 'id' | 'createdAt'>>('ems-inject', (run) => {
      setInbound((prev) => [
        ...prev,
        {
          ...run,
          id: `EMS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          createdAt: new Date().toISOString(),
          etaSeconds: run.etaMinutes * 60,
          arrived: false,
        },
      ]);
    });
    const unsubReset = subscribe('ems-reset', () => {
      setInbound(liftSeed(seedEmsInbound()));
    });
    // Full-list replace — used by the scenario engine at activation time
    // to swap the baseline seed for a scenario-tuned set instantly (so
    // the inbound card doesn't look identical across S1/S2/S3 at t=0).
    const unsubReplace = subscribe<Omit<EmsInbound, 'id' | 'createdAt'>[]>(
      'ems-replace',
      (runs) => {
        setInbound(
          runs.map((r) => ({
            ...r,
            id: `EMS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            createdAt: new Date().toISOString(),
            etaSeconds: r.etaMinutes * 60,
            arrived: false,
          })),
        );
      },
    );
    return () => { unsubInject(); unsubReset(); unsubReplace(); };
  }, []);

  const acknowledge = (id: string) =>
    setInbound((prev) => prev.filter((r) => r.id !== id));

  const reset = () => {
    setInbound(liftSeed(seedEmsInbound()));
    publish('ems-reset');
  };

  const inject = (run: Omit<EmsInbound, 'id' | 'createdAt'>) => {
    setInbound((prev) => [
      ...prev,
      {
        ...run,
        id: `EMS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        etaSeconds: run.etaMinutes * 60,
        arrived: false,
      },
    ]);
    publish('ems-inject', run);
  };

  return useMemo(
    () => ({ inbound, acknowledge, reset, inject }),
    [inbound],
  );
};

/**
 * Helper for components that just want a count of un-arrived runs
 * (e.g. a tab badge). Pure function, no React state.
 */
export const countActiveInbound = (rows: EmsInboundLive[]): number =>
  rows.filter((r) => !r.arrived).length;

/**
 * Tone helper — maps activation level to a tactical accent so the
 * row can colour itself without the consumer caring about the
 * level taxonomy.
 */
export const activationTone = (
  level: EmsInbound['activationLevel'] | undefined,
): 'crit' | 'warn' | 'info' | 'neutral' => {
  switch (level) {
    case 'TRAUMA_1':
    case 'STEMI':
    case 'STROKE':
      return 'crit';
    case 'TRAUMA_2':
    case 'SEPSIS':
      return 'warn';
    case 'NONE':
    case undefined:
    default:
      return 'neutral';
  }
};

/**
 * Compact mm:ss formatter for the count-down ring.
 */
export const formatEta = (seconds: number): string => {
  if (seconds <= 0) return 'ARR';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};
