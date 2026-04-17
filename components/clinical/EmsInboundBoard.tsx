/**
 * EmsInboundBoard — the live "what's coming through the door" surface
 * for ER personnel and trauma teams.
 *
 * Each row is a single inbound EMS run with:
 *   • Unit ID + ground/air mode
 *   • Count-down ring (mm:ss) to ETA
 *   • Activation level pill (TRAUMA 1/2 · STROKE · STEMI · SEPSIS)
 *   • Patient demographics + chief complaint
 *   • Field vitals strip (HR · BP · RR · SpO2 · GCS)
 *   • Field treatment narrative
 *   • Destination bay
 *   • ACK button to remove the row when the team has eyes-on
 *
 * The board taps `useEmsInbound()` for live state — ETAs decrement
 * once a second; rows transition to a green ARRIVED state at 0 and
 * auto-clear ~30s later. The board itself is dumb: it never mutates
 * the feed directly, only via the hook's handles. This keeps it
 * trivial to swap in a real Pulsara/HEAR-net adapter behind the
 * same hook contract.
 *
 * The component is `display="card"` by default (drops into a
 * dashboard tile) but accepts `display="full"` for a fullscreen
 * overlay variant we use as the dedicated EMS surface.
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Heart,
  Plane,
  Radio,
  Truck,
  X,
} from 'lucide-react';
import type { EmsInbound } from '../../types';
import {
  useEmsInbound,
  activationTone,
  formatEta,
  countActiveInbound,
  type EmsInboundLive,
} from '../../lib/emsLive';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  TYPE,
  MOTION,
  Mono,
  BracketLabel,
  CornerBracket,
  StatusPill,
  TacticalCard,
  TacticalButton,
  HudStrip,
  DotGridBg,
  Divider,
  EmptyState,
} from '../design';

// ─────────────────────────────────────────────────────────────────────────
// Public props
// ─────────────────────────────────────────────────────────────────────────

export interface EmsInboundBoardProps {
  /**
   * "card" → dashboard tile (header + scrolling stack inside).
   * "full" → fullscreen overlay (used as the dedicated EMS surface).
   */
  display?: 'card' | 'full';
  /** Only relevant in "full" mode. */
  open?: boolean;
  onClose?: () => void;
  /**
   * Optional shared instance — when omitted the board owns its own
   * useEmsInbound() hook. When the parent already has a hook
   * instance (e.g. for a tab-badge count) it can pass it down so
   * both surfaces stay in sync.
   */
  externalFeed?: ReturnType<typeof useEmsInbound>;
}

// ─────────────────────────────────────────────────────────────────────────
// Activation pill — color-coded by tone
// ─────────────────────────────────────────────────────────────────────────

const activationLabel = (level: EmsInbound['activationLevel']): string | null => {
  switch (level) {
    case 'TRAUMA_1':
      return 'TRAUMA 1';
    case 'TRAUMA_2':
      return 'TRAUMA 2';
    case 'STROKE':
      return 'STROKE';
    case 'STEMI':
      return 'STEMI';
    case 'SEPSIS':
      return 'SEPSIS';
    case 'NONE':
    case undefined:
    default:
      return null;
  }
};

const ActivationPill: React.FC<{ level: EmsInbound['activationLevel'] }> = ({ level }) => {
  const label = activationLabel(level);
  if (!label) return <Mono tone="muted" size="xs">ROUTINE</Mono>;
  const tone = activationTone(level);
  const color = tone === 'crit' ? COLORS.crit : tone === 'warn' ? COLORS.warn : COLORS.info;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        background: tone === 'crit' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.10)',
        border: `1px solid ${color}`,
        borderRadius: RADIUS.sm,
      }}
    >
      <AlertTriangle size={11} color={color} strokeWidth={2.5} />
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 11,
          fontWeight: 700,
          color,
          letterSpacing: '0.12em',
        }}
      >
        {label}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// EtaRing — circular count-down ring
// ─────────────────────────────────────────────────────────────────────────

const EtaRing: React.FC<{ etaSeconds: number; arrived: boolean; size?: number }> = ({
  etaSeconds,
  arrived,
  size = 56,
}) => {
  // Ring fills proportional to "how long until arrival" — long away
  // = mostly empty, close in = mostly full. We use a 30-min reference
  // so a 30-min ETA renders as ~0% and a 1-min ETA as ~97%.
  const REFERENCE = 30 * 60;
  const pct = arrived ? 1 : 1 - Math.min(1, etaSeconds / REFERENCE);
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - pct);
  const color = arrived ? COLORS.ok : etaSeconds < 5 * 60 ? COLORS.crit : etaSeconds < 15 * 60 ? COLORS.warn : COLORS.info;

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={COLORS.border}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          style={{
            transition: 'stroke-dashoffset 600ms ease, stroke 600ms ease',
            filter: arrived || etaSeconds < 5 * 60 ? `drop-shadow(0 0 6px ${color}88)` : 'none',
          }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: arrived ? 11 : 13,
            fontWeight: 700,
            color,
            letterSpacing: arrived ? '0.1em' : '0',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatEta(etaSeconds)}
        </div>
        {!arrived && (
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 9,
              fontWeight: 500,
              color: COLORS.textMuted,
              letterSpacing: '0.1em',
              marginTop: 2,
            }}
          >
            ETA
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// FieldVitalsStrip — compact one-line vitals row
// ─────────────────────────────────────────────────────────────────────────

const FieldVitalsStrip: React.FC<{ vitals: EmsInbound['fieldVitals'] }> = ({ vitals }) => {
  if (!vitals) return null;
  const items: { label: string; value: string | undefined; tone?: 'ok' | 'warn' | 'crit' }[] = [
    {
      label: 'HR',
      value: vitals.heartRate?.toString(),
      tone: vitals.heartRate != null && vitals.heartRate > 110 ? 'crit' : vitals.heartRate != null && vitals.heartRate > 100 ? 'warn' : undefined,
    },
    {
      label: 'BP',
      value: vitals.systolic != null && vitals.diastolic != null ? `${vitals.systolic}/${vitals.diastolic}` : undefined,
      tone: vitals.systolic != null && vitals.systolic < 90 ? 'crit' : vitals.systolic != null && vitals.systolic < 100 ? 'warn' : undefined,
    },
    {
      label: 'SpO2',
      value: vitals.spO2 != null ? `${vitals.spO2}%` : undefined,
      tone: vitals.spO2 != null && vitals.spO2 < 92 ? 'crit' : vitals.spO2 != null && vitals.spO2 < 95 ? 'warn' : undefined,
    },
    {
      label: 'RR',
      value: vitals.respRate != null ? vitals.respRate.toString() : undefined,
      tone: vitals.respRate != null && vitals.respRate > 24 ? 'crit' : vitals.respRate != null && vitals.respRate > 20 ? 'warn' : undefined,
    },
    {
      label: 'GCS',
      value: vitals.gcs != null ? vitals.gcs.toString() : undefined,
      tone: vitals.gcs != null && vitals.gcs < 13 ? 'crit' : vitals.gcs != null && vitals.gcs < 15 ? 'warn' : undefined,
    },
  ];
  return (
    <div
      style={{
        display: 'flex',
        gap: SPACE.sm,
        flexWrap: 'wrap',
        padding: `${SPACE.sm}px ${SPACE.md}px`,
        background: COLORS.bgDeep,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
      }}
    >
      {items
        .filter((it) => it.value != null)
        .map((it) => {
          const color = it.tone === 'crit' ? COLORS.crit : it.tone === 'warn' ? COLORS.warn : COLORS.textPrimary;
          return (
            <div key={it.label} style={{ display: 'flex', flexDirection: 'column', minWidth: 36 }}>
              <Mono tone="muted" size="xs">
                {it.label}
              </Mono>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 14,
                  fontWeight: 700,
                  color,
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: 1,
                }}
              >
                {it.value}
              </div>
            </div>
          );
        })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// EmsRow — single run row
// ─────────────────────────────────────────────────────────────────────────

const EmsRow: React.FC<{
  run: EmsInboundLive;
  onAcknowledge: (id: string) => void;
}> = ({ run, onAcknowledge }) => {
  const tone = activationTone(run.activationLevel);
  const accentColor =
    run.arrived ? COLORS.ok : tone === 'crit' ? COLORS.crit : tone === 'warn' ? COLORS.warn : COLORS.info;
  const ModeIcon = run.mode === 'air' ? Plane : Truck;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8, scale: 0.96 }}
      transition={{ duration: MOTION.fast, ease: MOTION.ease }}
    >
      <div
        style={{
          position: 'relative',
          padding: SPACE.md,
          background: run.arrived
            ? 'linear-gradient(90deg, rgba(16,185,129,0.10) 0%, rgba(16,185,129,0.02) 100%)'
            : tone === 'crit'
            ? 'linear-gradient(90deg, rgba(239,68,68,0.06) 0%, transparent 100%)'
            : COLORS.surface,
          border: `1px solid ${run.arrived ? COLORS.ok : tone === 'crit' ? COLORS.crit : COLORS.border}`,
          borderLeft: `3px solid ${accentColor}`,
          borderRadius: RADIUS.sm,
          overflow: 'hidden',
        }}
      >
        <CornerBracket position="tl" color={accentColor} size={6} thickness={1} inset={-1} />
        <CornerBracket position="br" color={accentColor} size={6} thickness={1} inset={-1} />

        {/* Header row — unit, mode, ETA ring, ACK */}
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
          <EtaRing etaSeconds={run.etaSeconds} arrived={run.arrived} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' }}>
              <ModeIcon size={13} strokeWidth={2} color={COLORS.textSecondary} />
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 13,
                  fontWeight: 700,
                  color: COLORS.textPrimary,
                  letterSpacing: '0.05em',
                }}
              >
                {run.unit}
              </span>
              <ActivationPill level={run.activationLevel} />
              {run.arrived && (
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 11,
                    fontWeight: 700,
                    color: COLORS.ok,
                    letterSpacing: '0.16em',
                    padding: '2px 6px',
                    background: 'rgba(16,185,129,0.18)',
                    border: `1px solid ${COLORS.ok}`,
                    borderRadius: RADIUS.sm,
                  }}
                >
                  ARRIVED
                </span>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
                color: COLORS.textSecondary,
                fontFamily: FONTS.sans,
                fontSize: 13,
              }}
            >
              {(run.age != null || run.sex) && (
                <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>
                  {run.age ?? '—'}
                  {run.sex ?? ''}
                </span>
              )}
              {run.destinationBay && (
                <>
                  <span style={{ color: COLORS.textMuted }}>→</span>
                  <span style={{ color: COLORS.textPrimary, fontWeight: 600 }}>{run.destinationBay}</span>
                </>
              )}
            </div>
          </div>
          <motion.button
            type="button"
            onClick={() => onAcknowledge(run.id)}
            whileTap={{ scale: 0.94 }}
            aria-label={`Acknowledge ${run.unit}`}
            style={{
              width: 36,
              height: 36,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.sm,
              color: COLORS.textSecondary,
              cursor: 'pointer',
            }}
          >
            <CheckCircle2 size={15} strokeWidth={2} />
          </motion.button>
        </div>

        {/* Chief complaint */}
        <div
          style={{
            marginTop: SPACE.md,
            fontFamily: FONTS.sans,
            fontSize: 14,
            fontWeight: 500,
            color: COLORS.textPrimary,
            lineHeight: 1.45,
          }}
        >
          {run.chiefComplaint}
        </div>

        {/* Field vitals */}
        {run.fieldVitals && (
          <div style={{ marginTop: SPACE.sm }}>
            <FieldVitalsStrip vitals={run.fieldVitals} />
          </div>
        )}

        {/* Field treatment narrative */}
        {run.fieldTreatment && (
          <div
            style={{
              marginTop: SPACE.sm,
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              background: 'transparent',
              border: `1px dashed ${COLORS.border}`,
              borderRadius: RADIUS.sm,
            }}
          >
            <Mono tone="muted" size="xs">
              FIELD RX
            </Mono>
            <div
              style={{
                marginTop: 3,
                fontFamily: FONTS.mono,
                fontSize: 12,
                fontWeight: 500,
                color: COLORS.textSecondary,
                lineHeight: 1.5,
              }}
            >
              {run.fieldTreatment}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Card-mode body — used by both display modes
// ─────────────────────────────────────────────────────────────────────────

const BoardBody: React.FC<{
  inbound: EmsInboundLive[];
  onAcknowledge: (id: string) => void;
}> = ({ inbound, onAcknowledge }) => {
  if (inbound.length === 0) {
    return (
      <div
        style={{
          border: `1px dashed ${COLORS.border}`,
          borderRadius: RADIUS.sm,
        }}
      >
        <EmptyState
          compact
          icon={<Radio size={20} strokeWidth={1.8} />}
          label="NO INBOUND TRAFFIC"
          description="Waiting on radio — new runs will appear here as EMS calls in."
        />
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      <AnimatePresence>
        {inbound.map((run) => (
          <EmsRow key={run.id} run={run} onAcknowledge={onAcknowledge} />
        ))}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Main component — switches between card and full display
// ─────────────────────────────────────────────────────────────────────────

export const EmsInboundBoard: React.FC<EmsInboundBoardProps> = ({
  display = 'card',
  open = true,
  onClose,
  externalFeed,
}) => {
  // Hooks must run unconditionally — always call useEmsInbound, then
  // pick which feed (own or external) to render against.
  const ownFeed = useEmsInbound();
  const feed = externalFeed ?? ownFeed;
  const { inbound, acknowledge } = feed;

  const counts = useMemo(() => {
    const active = countActiveInbound(inbound);
    const trauma = inbound.filter(
      (r) => !r.arrived && (r.activationLevel === 'TRAUMA_1' || r.activationLevel === 'TRAUMA_2'),
    ).length;
    const arrived = inbound.filter((r) => r.arrived).length;
    return { active, trauma, arrived };
  }, [inbound]);

  if (display === 'card') {
    return (
      <TacticalCard padding="none">
        <div style={{ padding: SPACE.base }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: SPACE.md,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
              <Radio size={15} color={COLORS.accent} strokeWidth={2} />
              <BracketLabel tone="accent" size="xs">
                EMS · INBOUND
              </BracketLabel>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
              <Mono tone="muted" size="xs">
                {counts.active} ACTIVE
              </Mono>
              {counts.trauma > 0 && (
                <StatusPill label={`${counts.trauma} TRAUMA`} tone="crit" size="xs" />
              )}
            </div>
          </div>
          <BoardBody inbound={inbound} onAcknowledge={acknowledge} />
        </div>
      </TacticalCard>
    );
  }

  // Full-screen overlay
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        key="ems-board"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: MOTION.base, ease: MOTION.ease }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: COLORS.bg,
          color: COLORS.textPrimary,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: FONTS.sans,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          overflow: 'hidden',
        }}
      >
        <DotGridBg />

        <HudStrip side="top" fixed={false} height={52}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, flex: 1, minWidth: 0 }}>
            {onClose && (
              <motion.button
                type="button"
                onClick={onClose}
                aria-label="Close"
                whileTap={{ scale: 0.9 }}
                style={{
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: COLORS.textSecondary,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={20} strokeWidth={2} />
              </motion.button>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <BracketLabel tone="accent" size="xs">
                RADIO · LIVE
              </BracketLabel>
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 15,
                  fontWeight: 700,
                  color: COLORS.textPrimary,
                  letterSpacing: '-0.003em',
                }}
              >
                EMS Inbound Board
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            <Mono tone="muted" size="xs">
              {counts.active} ACTIVE · {counts.arrived} ARR
            </Mono>
          </div>
        </HudStrip>

        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: `${SPACE.lg}px ${SPACE.lg}px ${SPACE['3xl']}px`,
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <BoardBody inbound={inbound} onAcknowledge={acknowledge} />
          </div>
        </main>
      </motion.div>
    </AnimatePresence>
  );
};

export default EmsInboundBoard;
