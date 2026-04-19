/**
 * MobileManagerKpiCockpit
 *
 * Floor Manager's shift-level KPI cockpit — the "am I running
 * this ED well?" dashboard. Six canonical KPIs (LWBS, Door-to-
 * Doc, Avg LOS, Boarding Hrs, Bed Capacity, Staffing Gap) with
 * sparklines, traffic-light status, and click-to-expand
 * contributing-factor drill-down.
 *
 * Why this exists
 * ---------------
 * Nurses and ER personnel care about the patient in front of
 * them. Managers care about throughput, boarding, LWBS, and
 * staffing — aggregate metrics that only make sense at
 * shift / department scale. There was no first-class surface
 * for those numbers until this one.
 *
 * Data comes from `lib/mockShiftMetrics.ts`, a deterministic
 * mock source that drifts on a 2-minute window. When a real
 * backend lands, swap `getKpiSnapshot`'s body and the cockpit
 * UI stays identical.
 *
 * Interactions
 * ------------
 * - Tapping a tile expands it in place. One expanded tile at a
 *   time — the expanded tile spans both grid columns so its
 *   description + contributing-factor list stay readable.
 * - The snapshot re-pulls every 60s so the demo breathes
 *   without user interaction. Within a 2-minute window the
 *   values are stable (see mockShiftMetrics).
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserMinus, Stethoscope, Clock, Hourglass, Bed, Users,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  COLORS, FONTS, SPACE, RADIUS, MOTION, TYPE,
  Mono, BracketLabel, StatusPill, TacticalCard, Divider,
} from './design';
import {
  getKpiSnapshot,
  type KpiSnapshot,
  type KpiId,
  type KpiStatus,
  type KpiTrend,
  type KpiGoal,
} from '../lib/mockShiftMetrics';

// ─────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────

export interface MobileManagerKpiCockpitProps {
  /** Toast handler — reserved for future action buttons (escalate,
   *  page, etc.) inside expanded tiles. Currently unused but kept in
   *  the prop shape so consumers can wire it up without a breaking
   *  change later. */
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Icon map — one per KpiId. Kept here so the tile component doesn't
// need to know KPI semantics; it just gets an icon element.
// ─────────────────────────────────────────────────────────────────────────

const ICON: Record<KpiId, React.ComponentType<{ size?: number; color?: string }>> = {
  'lwbs': UserMinus,
  'door-to-doc': Stethoscope,
  'avg-los': Clock,
  'boarding-hours': Hourglass,
  'bed-capacity': Bed,
  'staffing-gap': Users,
};

// ─────────────────────────────────────────────────────────────────────────
// Tone helpers
// ─────────────────────────────────────────────────────────────────────────

const statusColor = (s: KpiStatus): string =>
  s === 'ok' ? COLORS.ok : s === 'warn' ? COLORS.warn : COLORS.crit;

/** Trend arrow color follows goal semantics. For a lower-is-better
 *  KPI (e.g. door-to-doc), an upward trend is bad, so the arrow is
 *  red. For higher-is-better (staffing gap closing toward zero),
 *  upward is good. Flat is muted regardless. */
const trendColor = (t: KpiTrend, g: KpiGoal): string => {
  if (t === 'flat') return COLORS.textMuted;
  if (g === 'lower') return t === 'up' ? COLORS.crit : COLORS.ok;
  return t === 'up' ? COLORS.ok : COLORS.crit;
};

const trendIcon = (t: KpiTrend, color: string) => {
  if (t === 'up') return <TrendingUp size={11} color={color} />;
  if (t === 'down') return <TrendingDown size={11} color={color} />;
  return <Minus size={11} color={color} />;
};

// ─────────────────────────────────────────────────────────────────────────
// Sparkline — tiny SVG polyline + optional dashed target line
// ─────────────────────────────────────────────────────────────────────────

/** Y bounds for the line, padded so it doesn't kiss the SVG edge.
 *  If a target value is supplied, it's included in the domain so
 *  the target dashline always renders within the viewBox. */
const sparkBounds = (points: number[], extra: number[] = []) => {
  const all = [...points, ...extra];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || Math.max(Math.abs(max), 1) * 0.1;
  const pad = span * 0.15;
  return { lo: min - pad, hi: max + pad };
};

const sparkPath = (
  points: number[],
  w: number, h: number, lo: number, hi: number,
): string => {
  if (points.length === 0) return '';
  const span = hi - lo || 1;
  const step = points.length === 1 ? w : w / (points.length - 1);
  const xy = (v: number, i: number) => ({
    x: i * step,
    y: h - ((v - lo) / span) * h,
  });
  const first = xy(points[0], 0);
  let d = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (let i = 1; i < points.length; i += 1) {
    const p = xy(points[i], i);
    d += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  return d;
};

const Sparkline: React.FC<{
  points: number[];
  color: string;
  width: number;
  height: number;
  /** Optional target value — rendered as a dashed horizontal rule. */
  target?: number;
  fill?: boolean;
}> = ({ points, color, width, height, target, fill = true }) => {
  const extra = target != null ? [target] : [];
  const { lo, hi } = sparkBounds(points, extra);
  const d = sparkPath(points, width, height, lo, hi);
  const span = hi - lo || 1;
  const targetY = target != null ? height - ((target - lo) / span) * height : null;
  const lastY = points.length > 0
    ? height - ((points[points.length - 1] - lo) / span) * height
    : height / 2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {fill && (
        <path
          d={`${d} L ${width} ${height} L 0 ${height} Z`}
          fill={color}
          opacity={0.12}
        />
      )}
      {targetY != null && (
        <line
          x1={0}
          y1={targetY}
          x2={width}
          y2={targetY}
          stroke={COLORS.textMuted}
          strokeWidth={0.8}
          strokeDasharray="3 3"
          opacity={0.7}
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={width}
        cy={lastY}
        r={2.5}
        fill={color}
      />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Tile — compact by default, accordion-expanded when `expanded` is true.
// One component renders both modes so layout shifts are animated cleanly
// via motion/react's `layout` prop.
// ─────────────────────────────────────────────────────────────────────────

const KpiTile: React.FC<{
  snap: KpiSnapshot;
  expanded: boolean;
  onToggle: () => void;
}> = ({ snap, expanded, onToggle }) => {
  const Icon = ICON[snap.id];
  const statusCol = statusColor(snap.status);
  const trendCol = trendColor(snap.trend, snap.goal);
  const deltaLabel = `${snap.deltaPct > 0 ? '+' : ''}${snap.deltaPct.toFixed(1)}%`;

  const rangeLo = Math.min(...snap.sparkline);
  const rangeHi = Math.max(...snap.sparkline);
  const fmtRange = (v: number) =>
    Math.abs(v) < 10 && !Number.isInteger(v) ? v.toFixed(1) : `${Math.round(v)}`;

  return (
    <motion.div
      layout
      transition={{ layout: { duration: MOTION.fast, ease: MOTION.ease } }}
      style={{ gridColumn: expanded ? '1 / -1' : 'span 1' }}
    >
      <TacticalCard
        padding="sm"
        interactive
        onClick={onToggle}
        style={{
          position: 'relative',
          borderLeft: `3px solid ${statusCol}`,
          cursor: 'pointer',
          minHeight: 44,
        }}
      >
        {/* ── Top row: icon + label + status pill ───────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: SPACE.xs,
          marginBottom: SPACE.sm,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, minWidth: 0 }}>
            <Icon size={13} color={statusCol} />
            <Mono tone="secondary" size="xs" style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {snap.label}
            </Mono>
          </div>
          <StatusPill label={snap.status.toUpperCase()} tone={snap.status} size="xs" />
        </div>

        {/* ── Big value + trend chip ─────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'baseline',
          gap: SPACE.xs, marginBottom: 4,
        }}>
          <span style={{
            fontFamily: FONTS.sans,
            fontSize: expanded ? 42 : 28,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            color: COLORS.textPrimary,
          }}>
            {snap.display}
          </span>
          <Mono tone="muted" size="xs">{snap.unit}</Mono>
          <div style={{ flex: 1 }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3,
            padding: `1px ${SPACE.xs}px`,
            background: `${trendCol}18`,
            border: `1px solid ${trendCol}40`,
            borderRadius: RADIUS.sm,
          }}>
            {trendIcon(snap.trend, trendCol)}
            <span style={{
              fontFamily: FONTS.mono, fontSize: 10, fontWeight: 600,
              color: trendCol, letterSpacing: '0.05em',
            }}>{deltaLabel}</span>
          </div>
        </div>

        {/* ── Compact footer: target + mini sparkline ─────────────────
            Only shown when collapsed. In the expanded view the
            spark moves into the detail panel below at full width. */}
        {!expanded && (
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            gap: SPACE.sm, marginTop: SPACE.xs,
          }}>
            <Mono tone="dim" size="xs" style={{ whiteSpace: 'nowrap' }}>
              TGT {snap.target}
            </Mono>
            <Sparkline
              points={snap.sparkline}
              color={statusCol}
              width={72}
              height={18}
            />
          </div>
        )}

        {/* ── Collapsed chevron affordance ───────────────────────────── */}
        {!expanded && (
          <ChevronDown
            size={12}
            color={COLORS.textMuted}
            style={{
              position: 'absolute', bottom: 4, right: 4,
              opacity: 0.5,
            }}
          />
        )}

        {/* ── Expanded detail ────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: MOTION.fast }}
              style={{ overflow: 'hidden' }}
            >
              <Divider style={{ margin: `${SPACE.md}px 0` }} />

              {/* ── Quick-stats row ──────────────────────────────────── */}
              <div style={{
                display: 'flex', alignItems: 'flex-start',
                gap: SPACE.md, marginBottom: SPACE.md,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Mono tone="dim" size="xs" style={{ display: 'block', marginBottom: 2 }}>
                    TARGET
                  </Mono>
                  <span style={{
                    fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600,
                    color: COLORS.textSecondary,
                  }}>
                    {snap.target} {snap.unit}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Mono tone="dim" size="xs" style={{ display: 'block', marginBottom: 2 }}>
                    VS PRIOR
                  </Mono>
                  <span style={{
                    fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600,
                    color: trendCol,
                  }}>
                    {deltaLabel}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Mono tone="dim" size="xs" style={{ display: 'block', marginBottom: 2 }}>
                    24H RANGE
                  </Mono>
                  <span style={{
                    fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600,
                    color: COLORS.textSecondary,
                  }}>
                    {fmtRange(rangeLo)}–{fmtRange(rangeHi)}
                  </span>
                </div>
              </div>

              {/* ── Full-width sparkline with target rule ────────────── */}
              <div style={{
                background: COLORS.bgDeep,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                padding: SPACE.sm,
                marginBottom: SPACE.md,
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: SPACE.xs,
                }}>
                  <Mono tone="dim" size="xs">24H TREND</Mono>
                  <Mono tone="dim" size="xs">— — TARGET {snap.target}</Mono>
                </div>
                <Sparkline
                  points={snap.sparkline}
                  color={statusCol}
                  width={300}
                  height={60}
                  target={snap.targetValue}
                />
              </div>

              {/* ── Description ──────────────────────────────────────── */}
              <div style={{
                fontFamily: FONTS.sans,
                fontSize: TYPE.bodySm.size,
                color: COLORS.textSecondary,
                lineHeight: 1.45,
                marginBottom: SPACE.md,
              }}>
                {snap.description}
              </div>

              {/* ── Contributing factors ─────────────────────────────── */}
              <Mono tone="dim" size="xs" style={{ display: 'block', marginBottom: SPACE.sm }}>
                // CONTRIBUTING FACTORS
              </Mono>
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                {snap.factors.map((f, i) => {
                  const tone = f.tone ?? 'info';
                  const toneCol =
                    tone === 'ok' ? COLORS.ok :
                    tone === 'warn' ? COLORS.warn :
                    tone === 'crit' ? COLORS.crit :
                    COLORS.info;
                  return (
                    <div
                      key={i}
                      style={{
                        padding: `${SPACE.sm}px ${SPACE.md}px`,
                        background: `${toneCol}10`,
                        border: `1px solid ${toneCol}30`,
                        borderRadius: RADIUS.sm,
                        borderLeft: `2px solid ${toneCol}`,
                      }}
                    >
                      <div style={{
                        fontFamily: FONTS.sans,
                        fontSize: TYPE.bodySm.size,
                        fontWeight: 600,
                        color: COLORS.textPrimary,
                        marginBottom: 2,
                      }}>
                        {f.label}
                      </div>
                      <Mono tone="secondary" size="xs">{f.detail}</Mono>
                    </div>
                  );
                })}
              </div>

              {/* ── Collapse hint ────────────────────────────────────── */}
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 4,
                marginTop: SPACE.md, padding: `${SPACE.xs}px 0`,
              }}>
                <ChevronUp size={12} color={COLORS.textMuted} />
                <Mono tone="dim" size="xs">TAP TO COLLAPSE</Mono>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </TacticalCard>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Cockpit — the whole KPI screen (summary ribbon + 2-col grid)
// ─────────────────────────────────────────────────────────────────────────

export const MobileManagerKpiCockpit: React.FC<MobileManagerKpiCockpitProps> = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  showToast,
}) => {
  // 60s refresh so the screen breathes without user interaction.
  // The snapshot is deterministic within a 2-min window, so
  // mid-window refreshes are effectively no-ops — we just want
  // the demo to tick when the window advances.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const snapshots = getKpiSnapshot();
  const [expandedId, setExpandedId] = useState<KpiId | null>(null);

  const okCount = snapshots.filter((s) => s.status === 'ok').length;
  const warnCount = snapshots.filter((s) => s.status === 'warn').length;
  const critCount = snapshots.filter((s) => s.status === 'crit').length;

  return (
    <div style={{
      padding: `0 ${SPACE.base}px ${SPACE.base}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: SPACE.md,
    }}>
      {/* ── Summary ribbon ─────────────────────────────────────────── */}
      <TacticalCard padding="md">
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: SPACE.xs,
        }}>
          <BracketLabel tone="accent" size="xs">SHIFT METRICS</BracketLabel>
          <Mono tone="dim" size="xs">LIVE · DEMO DATA</Mono>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: SPACE.lg, marginTop: SPACE.sm, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
            <div style={{
              width: 6, height: 6, borderRadius: RADIUS.full,
              background: COLORS.ok, boxShadow: `0 0 4px ${COLORS.ok}`,
            }} />
            <Mono tone="ok" size="xs">{okCount} ON TARGET</Mono>
          </div>
          {warnCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
              <div style={{
                width: 6, height: 6, borderRadius: RADIUS.full,
                background: COLORS.warn, boxShadow: `0 0 4px ${COLORS.warn}`,
              }} />
              <Mono tone="warn" size="xs">{warnCount} STRAINED</Mono>
            </div>
          )}
          {critCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
              <div style={{
                width: 6, height: 6, borderRadius: RADIUS.full,
                background: COLORS.crit, boxShadow: `0 0 4px ${COLORS.crit}`,
              }} />
              <Mono tone="crit" size="xs">{critCount} CRITICAL</Mono>
            </div>
          )}
        </div>
      </TacticalCard>

      {/* ── KPI grid ────────────────────────────────────────────────
          2 columns. Expanded tile spans both with `gridColumn:
          '1 / -1'`. motion/react's `layout` on each tile smooths
          the reflow when a neighbor expands. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: SPACE.sm,
      }}>
        {snapshots.map((snap) => (
          <KpiTile
            key={snap.id}
            snap={snap}
            expanded={expandedId === snap.id}
            onToggle={() => setExpandedId((prev) => (prev === snap.id ? null : snap.id))}
          />
        ))}
      </div>
    </div>
  );
};

export default MobileManagerKpiCockpit;
