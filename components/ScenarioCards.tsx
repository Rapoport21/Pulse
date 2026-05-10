/**
 * ScenarioCards — three tappable severity tiles (S1 · S2 · S3) for the
 * simulation controls. Used in two surfaces today:
 *   - Settings screen (the original home)
 *   - Pulse Horizon → What-If Sim panel
 *
 * The active scenario gets an accent border + breathing glow (S3 only),
 * a live countdown badge, and a "[ STOP ]" hint footer. Tapping another
 * mid-run hot-swaps immediately and restarts the 3-minute clock.
 *
 * Kept presentation-only — the parent owns scenarioTick + start/stop
 * callbacks so the same tile renders identically in both surfaces.
 */
import React from 'react';
import { motion } from 'motion/react';
import { COLORS, FONTS, SPACE, RADIUS, MOTION } from './design';
import { Mono } from './design';
import {
  type ScenarioState,
  type ScenarioSeverity,
  SCENARIO_META,
  formatScenarioRemaining,
  phaseLabel,
  type ScenarioPhase,
} from '../lib/scenario';

export interface ScenarioCardsProps {
  activeScenario: ScenarioState | null;
  tick?: {
    scenario: ScenarioState | null;
    elapsedMs: number;
    remainingMs: number;
    phase: ScenarioPhase | null;
    isExpired: boolean;
  };
  onStart: (severity: ScenarioSeverity) => void;
  onStop: () => void;
}

export const ScenarioCards: React.FC<ScenarioCardsProps> = ({
  activeScenario,
  tick,
  onStart,
  onStop,
}) => {
  const activeSeverity = activeScenario?.severity ?? null;
  const severities: ScenarioSeverity[] = [1, 2, 3];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
      {severities.map((sev) => {
        const meta = SCENARIO_META[sev];
        const isActive = activeSeverity === sev;
        const color =
          meta.tone === 'ok'
            ? COLORS.ok
            : meta.tone === 'warn'
            ? COLORS.warn
            : COLORS.crit;
        return (
          <motion.button
            key={sev}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => (isActive ? onStop() : onStart(sev))}
            whileTap={{ scale: 0.99 }}
            animate={
              isActive && sev === 3
                ? {
                    boxShadow: [
                      `0 0 0 1px ${color}, 0 0 14px ${color}44`,
                      `0 0 0 1px ${color}, 0 0 28px ${color}88`,
                      `0 0 0 1px ${color}, 0 0 14px ${color}44`,
                    ],
                  }
                : isActive
                ? { boxShadow: `0 0 0 1px ${color}, 0 0 16px ${color}55` }
                : { boxShadow: '0 0 0 1px transparent' }
            }
            transition={
              isActive && sev === 3
                ? { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }
                : { duration: MOTION.base, ease: MOTION.ease }
            }
            style={{
              width: '100%',
              textAlign: 'left',
              padding: SPACE.md,
              background: isActive ? COLORS.surfaceElev : COLORS.surface,
              border: `1px solid ${isActive ? color : COLORS.border}`,
              borderRadius: RADIUS.sm,
              cursor: 'pointer',
              fontFamily: FONTS.sans,
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.sm,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Header row: dot + id label + status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
                minHeight: 20,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: color,
                  boxShadow: isActive ? `0 0 10px ${color}` : undefined,
                  flexShrink: 0,
                }}
              />
              <Mono tone={isActive ? 'accent' : 'muted'} size="sm">
                [ {meta.id} · {meta.label} ]
              </Mono>
              <div style={{ flex: 1 }} />
              {isActive && tick?.scenario ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.sm,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      color: COLORS.textPrimary,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatScenarioRemaining(tick.remainingMs)}
                  </span>
                  <Mono tone="dim" size="xs">
                    {phaseLabel(tick.phase)}
                  </Mono>
                </div>
              ) : (
                <Mono tone="dim" size="xs">
                  3:00
                </Mono>
              )}
            </div>

            {/* Tagline */}
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: COLORS.textPrimary,
                lineHeight: 1.3,
              }}
            >
              {meta.tagline}
            </div>

            {/* Description */}
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 12,
                color: COLORS.textSecondary,
                lineHeight: 1.45,
              }}
            >
              {meta.description}
            </div>

            {/* Running footer — STOP hint */}
            {isActive && (
              <div
                style={{
                  marginTop: SPACE.xs,
                  paddingTop: SPACE.sm,
                  borderTop: `1px solid ${COLORS.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Mono tone="accent" size="xs">
                  ● RUNNING
                </Mono>
                <Mono tone="dim" size="xs">
                  TAP TO STOP
                </Mono>
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};
