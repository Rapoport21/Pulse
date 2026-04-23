import React from 'react';
import { motion } from 'motion/react';
import { COLORS, FONTS, SPACE, RADIUS, MOTION } from './design/tokens';
import {
  type ScenarioSeverity,
  SCENARIO_META,
  formatScenarioRemaining,
} from '../lib/scenario';

/**
 * Persistent HUD badge shown whenever a scenario is running.
 * - Lives in the top HUD strip (desktop) and mobile header.
 * - Live mm:ss countdown, updates every second.
 * - Tappable — surfaces Settings so the operator can stop / swap.
 * - Color tracks severity: ok / warn / crit.
 * - S3 gets a breathing pulse glow so it reads at a glance from
 *   across the room — this is the "something bad is happening" tell.
 *
 * This component is rendered on every screen when activeScenario !== null
 * so there's no way to forget you're mid-simulation.
 */

export interface ScenarioHudBadgeProps {
  severity: ScenarioSeverity;
  remainingMs: number;
  /** Where the operator lands when they tap the badge. */
  onClick?: () => void;
  /** Compact sizing for mobile headers. */
  compact?: boolean;
}

export const ScenarioHudBadge: React.FC<ScenarioHudBadgeProps> = ({
  severity,
  remainingMs,
  onClick,
  compact = false,
}) => {
  const meta = SCENARIO_META[severity];
  const color =
    meta.tone === 'ok' ? COLORS.ok : meta.tone === 'warn' ? COLORS.warn : COLORS.crit;

  const content = (
    <>
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          boxShadow: `0 0 8px ${color}`,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: compact ? 10 : 11,
          fontWeight: 600,
          letterSpacing: '0.12em',
          color: COLORS.textPrimary,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {meta.id} · {meta.label}
      </span>
      <span
        aria-hidden
        style={{ color: COLORS.textDim, fontSize: compact ? 10 : 11 }}
      >
        ·
      </span>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: compact ? 10 : 11,
          fontWeight: 500,
          letterSpacing: '0.08em',
          color: COLORS.textSecondary,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {formatScenarioRemaining(remainingMs)}
      </span>
    </>
  );

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: compact ? '3px 8px' : '4px 10px',
    background: COLORS.surface,
    border: `1px solid ${color}`,
    borderRadius: RADIUS.sm,
    lineHeight: 1,
    cursor: onClick ? 'pointer' : 'default',
    transition: `box-shadow ${MOTION.base}s ${MOTION.cssEase}`,
  };

  // S3 breathes. S2 pulses the dot only. S1 sits still so the eye
  // only picks up motion when something actually needs attention.
  if (severity === 3) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        animate={{ boxShadow: [
          `0 0 0 1px ${color}, 0 0 12px ${color}55`,
          `0 0 0 1px ${color}, 0 0 22px ${color}88`,
          `0 0 0 1px ${color}, 0 0 12px ${color}55`,
        ] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ ...baseStyle, border: 'none', boxShadow: `0 0 0 1px ${color}` }}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <button type="button" onClick={onClick} style={baseStyle}>
      {content}
    </button>
  );
};
