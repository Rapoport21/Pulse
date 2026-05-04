/**
 * Pulse Radiant — focused-detail overlay cards.
 *
 * Rendered as a 2D overlay (not 3D) so the card always reads at
 * a fixed, large size regardless of camera distance. Camera handles
 * the "zoom into" visual flavor; the card handles the data.
 */

import React from 'react';
import { COLORS, FONTS, SPACE, RADIUS } from '../design';
import {
  buildSeries,
  buildConnections,
  numericFromValue,
  formatNumber,
  formatSignedPercent,
  type WidgetSeries,
} from './mockData';
import { type FutureNode } from './data';
import {
  HalfGauge,
  RadarSweep,
  PulseWave,
  HeatStrip,
  Histogram,
  EventLog,
  Compass,
  RecentSamples,
  type VizType,
} from './Visualizations';

// ─────────────────────────────────────────────────────────────────────
// Sparkline — SVG line chart of the 48-point 24h series with a
// subtle gradient fill under the curve. ~360 × 80 by default.
// ─────────────────────────────────────────────────────────────────────

interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  /** Highlight the last point with a glowing dot */
  showCurrent?: boolean;
}

export const Sparkline: React.FC<SparklineProps> = ({
  points,
  width = 360,
  height = 80,
  stroke = COLORS.accent,
  fill = COLORS.accentDim,
  showCurrent = true,
}) => {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const padX = 2;
  const padY = 6;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const xAt = (i: number) => padX + (i / (points.length - 1)) * innerW;
  const yAt = (v: number) => padY + (1 - (v - min) / range) * innerH;

  const linePath = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)}`)
    .join(' ');

  const fillPath = `${linePath} L ${xAt(points.length - 1).toFixed(2)} ${height - padY} L ${xAt(0).toFixed(2)} ${height - padY} Z`;

  const lastX = xAt(points.length - 1);
  const lastY = yAt(points[points.length - 1]);

  const gradId = `spark-grad-${stroke.replace('#', '')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.45} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Filled area */}
      <path d={fillPath} fill={`url(#${gradId})`} stroke="none" />
      {/* Line */}
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* Baseline */}
      <line x1={padX} x2={width - padX} y1={height - padY} y2={height - padY} stroke={COLORS.border} strokeWidth={1} />
      {/* Current dot */}
      {showCurrent && (
        <>
          <circle cx={lastX} cy={lastY} r={4} fill={stroke} />
          <circle cx={lastX} cy={lastY} r={7} fill={stroke} fillOpacity={0.25} />
        </>
      )}
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Viz router — given a widget + its time series, render whichever
// visualization the widget was assigned. Plus a label so the user
// knows what kind of view they're looking at.
// ─────────────────────────────────────────────────────────────────────

const vizLabel = (v: VizType): string | null => {
  switch (v) {
    case 'none':      return 'RECENT SAMPLES';
    case 'sparkline': return '24-HOUR TREND';
    case 'gauge':     return 'CURRENT UTILIZATION';
    case 'radar':     return 'CORRELATION FIELD';
    case 'pulse':     return 'CYCLE WAVEFORM';
    case 'heatstrip': return '24-HOUR HEAT MAP';
    case 'histogram': return 'DISTRIBUTION';
    case 'eventlog':  return 'RECENT EVENT LOG';
    case 'compass':   return 'DIRECTIONAL READOUT';
  }
};

const renderViz = (widget: DetailWidget, series: WidgetSeries, accent: string): React.ReactNode => {
  switch (widget.vizType) {
    case 'none':
      return <RecentSamples widgetId={widget.id} currentValue={widget.value ?? '—'} stroke={accent} />;
    case 'gauge': {
      // Map the current value to a 0..1 gauge fill. If widget.value
      // parses as 0..100 use it directly; otherwise position inside
      // the 24h min/max range. The gauge dial alone is the viz —
      // the hero block above already shows the canonical number, so
      // we don't duplicate it inside the SVG. We do show a small
      // "% of max" readout when the fill maps cleanly to 0..100.
      const numericVal = numericFromValue(widget.value);
      const inRange01 = numericVal >= 0 && numericVal <= 100 ? numericVal / 100 : null;
      const v = inRange01 ?? Math.max(0.05, Math.min(0.95, (series.current - series.min) / (series.max - series.min || 1)));
      return <HalfGauge value={v} percent={inRange01 != null ? numericVal : v * 100} stroke={accent} />;
    }
    case 'radar':     return <RadarSweep points={series.points} stroke={accent} />;
    case 'pulse':     return <PulseWave points={series.points} stroke={accent} />;
    case 'heatstrip': return <HeatStrip points={series.points} stroke={accent} />;
    case 'histogram': return <Histogram points={series.points} stroke={accent} />;
    case 'eventlog':  return <EventLog widgetId={widget.id} stroke={accent} />;
    case 'compass':   return <Compass points={series.points} stroke={accent} />;
    case 'sparkline':
    default:
      return (
        <>
          <Sparkline points={series.points} width={560} height={96} stroke={accent} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: SPACE.xs, fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.20em', color: COLORS.textMuted, textTransform: 'uppercase' }}>
            <span>−24h</span>
            <span>−18h</span>
            <span>−12h</span>
            <span>−6h</span>
            <span>now</span>
          </div>
        </>
      );
  }
};

// ─────────────────────────────────────────────────────────────────────
// Shared layout primitives
// ─────────────────────────────────────────────────────────────────────

const monoStat = (label: string, value: string) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <span style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.20em', color: COLORS.textMuted, textTransform: 'uppercase' }}>
      {label}
    </span>
    <span style={{ fontFamily: FONTS.mono, fontSize: 17, fontWeight: 600, color: COLORS.textPrimary, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>
      {value}
    </span>
  </div>
);

const SectionDivider: React.FC = () => (
  <div style={{ height: 1, background: COLORS.border, margin: `${SPACE.base}px 0` }} />
);

const CloseButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Close detail"
    style={{
      width: 32,
      height: 32,
      borderRadius: RADIUS.sm,
      background: 'rgba(255, 255, 255, 0.04)',
      border: `1px solid ${COLORS.borderStrong}`,
      color: COLORS.textSecondary,
      fontFamily: FONTS.mono,
      fontSize: 14,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    ✕
  </button>
);

// ─────────────────────────────────────────────────────────────────────
// WidgetDetailCard — the cluster widget, expanded to full detail
// ─────────────────────────────────────────────────────────────────────

export interface DetailWidget {
  id: number;
  label: string;
  value?: string;
  detail?: string;
  source?: string;
  status?: 'LIVE' | 'STALE' | 'HOLD';
  layer: number;
  priority: number;
  toneColor: string;
  isAccent: boolean;
  /** Which visualization to render in the body of the detail card. */
  vizType: VizType;
}

export const WidgetDetailCard: React.FC<{
  widget: DetailWidget;
  onClose: () => void;
}> = ({ widget, onClose }) => {
  const numeric = numericFromValue(widget.value);
  const series: WidgetSeries = React.useMemo(
    () => buildSeries(widget.id, numeric),
    [widget.id, numeric],
  );
  const connections = React.useMemo(() => buildConnections(widget.id), [widget.id]);

  const accent = widget.isAccent ? COLORS.accentBright : widget.toneColor;

  return (
    <div
      role="dialog"
      aria-label={`${widget.label} detail`}
      data-radiant-focused="true"
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 620,
        maxHeight: '88vh',
        overflowY: 'auto',
        background: 'rgba(8, 6, 10, 0.96)',
        border: `1px solid ${accent}`,
        borderRadius: RADIUS.md,
        boxShadow: `0 0 60px rgba(225, 29, 72, 0.30), 0 24px 80px rgba(0, 0, 0, 0.85)`,
        fontFamily: FONTS.sans,
        color: COLORS.textPrimary,
        animation: 'detail-pop 320ms cubic-bezier(0.16, 1, 0.32, 1) backwards',
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.md,
        padding: `${SPACE.lg}px ${SPACE.xl}px`,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: widget.toneColor, boxShadow: `0 0 8px ${widget.toneColor}` }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: COLORS.textPrimary,
            lineHeight: 1.1,
          }}>
            {widget.label}
          </span>
          <div style={{ display: 'flex', gap: SPACE.md, alignItems: 'center', fontFamily: FONTS.mono, fontSize: 10, letterSpacing: '0.18em', color: COLORS.textMuted, textTransform: 'uppercase' }}>
            {widget.status && (
              <span style={{ color: widget.status === 'LIVE' ? COLORS.ok : widget.status === 'STALE' ? COLORS.warn : COLORS.textMuted }}>
                ● {widget.status}
              </span>
            )}
            {widget.source && <span>· {widget.source}</span>}
            <span>· LAYER {widget.layer}</span>
            <span>· PRIO {widget.priority}</span>
          </div>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      {/* Hero metric */}
      <div style={{ padding: `${SPACE.xl}px ${SPACE.xl}px ${SPACE.base}px`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: SPACE.lg }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
          <span style={{
            fontFamily: FONTS.mono,
            fontSize: 56,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: accent,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {widget.value ?? '—'}
          </span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 10, letterSpacing: '0.20em', color: COLORS.textMuted, textTransform: 'uppercase' }}>
            current reading
          </span>
        </div>
        {widget.value && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <span style={{
              fontFamily: FONTS.mono,
              fontSize: 18,
              fontWeight: 600,
              color: series.deltaHour > 0 ? COLORS.warn : series.deltaHour < 0 ? COLORS.ok : COLORS.textSecondary,
              letterSpacing: '0.04em',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {series.deltaHour > 0 ? '↑ ' : series.deltaHour < 0 ? '↓ ' : ''}
              {formatSignedPercent(series.deltaHour)}
            </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 10, letterSpacing: '0.18em', color: COLORS.textMuted, textTransform: 'uppercase' }}>
              vs 1h ago
            </span>
          </div>
        )}
      </div>

      {/* Visualization — different per widget. The label above tells
          the user what kind of view they're looking at. */}
      <div style={{ padding: `${SPACE.md}px ${SPACE.xl}px ${SPACE.base}px` }}>
        <div style={{
          fontFamily: FONTS.mono,
          fontSize: 9,
          letterSpacing: '0.22em',
          color: COLORS.textMuted,
          textTransform: 'uppercase',
          marginBottom: SPACE.sm,
        }}>
          ▸ {vizLabel(widget.vizType)}
        </div>
        {renderViz(widget, series, accent)}
      </div>

      <SectionDivider />

      {/* Stats grid — only meaningful when there's a real time-series
          backing the widget. For 'none' (single-event facts, alerts,
          weather snapshots) stats over a 24h window would be invented
          numbers, so skip them entirely. */}
      {widget.vizType !== 'none' && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: SPACE.md,
            padding: `0 ${SPACE.xl}px`,
          }}>
            {monoStat('24h MIN', formatNumber(series.min))}
            {monoStat('24h MAX', formatNumber(series.max))}
            {monoStat('24h AVG', formatNumber(series.avg))}
            {monoStat('σ STDDEV', formatNumber(series.stddev))}
          </div>
          <SectionDivider />
        </>
      )}

      {/* Detail / source rows */}
      {(widget.detail || widget.source) && (
        <>
          <div style={{ padding: `0 ${SPACE.xl}px`, display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
            {widget.detail && (
              <div style={{ display: 'flex', gap: SPACE.md, fontFamily: FONTS.mono, fontSize: 12, letterSpacing: '0.04em', color: COLORS.textSecondary }}>
                <span style={{ minWidth: 60, fontSize: 9, letterSpacing: '0.20em', color: COLORS.textMuted, textTransform: 'uppercase' }}>DETAIL</span>
                <span>{widget.detail}</span>
              </div>
            )}
            {widget.source && (
              <div style={{ display: 'flex', gap: SPACE.md, fontFamily: FONTS.mono, fontSize: 12, letterSpacing: '0.04em', color: COLORS.textSecondary }}>
                <span style={{ minWidth: 60, fontSize: 9, letterSpacing: '0.20em', color: COLORS.textMuted, textTransform: 'uppercase' }}>SRC</span>
                <span>{widget.source}</span>
              </div>
            )}
          </div>
          <SectionDivider />
        </>
      )}

      {/* Connections */}
      <div style={{ padding: `0 ${SPACE.xl}px`, display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.22em', color: COLORS.textMuted, textTransform: 'uppercase' }}>
          ▸ FEEDS INTO
        </span>
        {connections.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
            <span style={{ flex: 1, fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textPrimary, letterSpacing: '0.04em' }}>
              {c.label}
            </span>
            <div style={{ width: 120, height: 4, background: COLORS.border, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                width: `${(c.correlation * 100).toFixed(0)}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${accent}, ${COLORS.accentBright})`,
              }} />
            </div>
            <span style={{ width: 36, textAlign: 'right', fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
              {(c.correlation * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: SPACE.lg,
        padding: `${SPACE.md}px ${SPACE.xl}px`,
        borderTop: `1px solid ${COLORS.border}`,
        fontFamily: FONTS.mono,
        fontSize: 10,
        letterSpacing: '0.18em',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>Last update {series.staleSeconds}s ago · poll 30s</span>
        <span>Press ESC to close</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// FutureDetailCard — for the rose prediction nodes
// ─────────────────────────────────────────────────────────────────────

const PROBABILITY_PATHS: Record<string, string[]> = {
  primary: [
    'Surge protocol HOT triggers',
    'Triage thinning · −14% wait time',
    'NEDOCS easing · −24 pts',
    'Capacity recovers · 88% nominal',
  ],
  apex: [
    'Surge protocol HOT triggers (T+15m)',
    'Triage thinning · −14% wait time (T+30m)',
    'NEDOCS easing · −24 pts (T+1h)',
    'Capacity recovers · 88% nominal (T+2h)',
    'Wait time normal · < 28 min (T+2h)',
    'NEDOCS easing 118 by 19:00 (T+4h)',
  ],
};

const ALT_SCENARIOS: Array<{ label: string; conf: number }> = [
  { label: 'Helo offload absorbs surge', conf: 0.31 },
  { label: 'Regional divert recovers ED', conf: 0.24 },
  { label: 'Storm bypass preserves throughput', conf: 0.18 },
];

const RULED_OUT_REASONS: Record<string, string> = {
  'Helo offload': 'Wind sustained 22kt, 8kt over flight ceiling. Anti-correlation with weather feed (σ=0.19) holds for next 4h.',
  'Storm bypass route': 'I-95 closed mile 142 northbound. Ground transport detour adds 38m, exceeding ED arrival deadline.',
  'INSUFFICIENT DATA': 'Pattern signature confidence below threshold (0.34 < 0.55). Insufficient historical priors to support inference.',
  'INCOMPATIBLE SIGNAL': 'Anti-correlation with primary path. Activating this branch invalidates Triage thinning forecast.',
};

const FUTURE_DEPS: Record<string, string[]> = {
  primary: ['I-95 traffic · 71%', 'Weather · 64%', 'Trauma OR open · 58%', 'Staff recall sent · 52%'],
  apex: ['NEDOCS easing · 81%', 'Capacity recovers · 76%', 'Wait time normal · 71%', 'Triage thinning · 68%'],
  alt: ['Bed cohort A · 49%', 'Imaging queue · 42%'],
  dead: ['Weather · −19%', 'Wind speed · −14%'],
};

export const FutureDetailCard: React.FC<{
  node: FutureNode;
  onClose: () => void;
}> = ({ node, onClose }) => {
  const isApex = node.kind === 'apex';
  const isPrimary = node.kind === 'primary';
  const isDead = node.kind === 'dead';

  const accent = isApex ? COLORS.accentBright : isPrimary ? COLORS.accent : isDead ? COLORS.textMuted : COLORS.textSecondary;
  const kindTag = isApex ? '◆ PREDICTION' : isPrimary ? '▲ PRIMARY' : isDead ? '× RULED OUT' : '· ALT';

  const path = isApex ? PROBABILITY_PATHS.apex : PROBABILITY_PATHS.primary;
  const deps = isApex ? FUTURE_DEPS.apex : isPrimary ? FUTURE_DEPS.primary : isDead ? FUTURE_DEPS.dead : FUTURE_DEPS.alt;
  const ruledOutReason = isDead ? RULED_OUT_REASONS[node.label] : undefined;

  // Tiny "confidence over time" bar series for primary/apex
  const confSeries = React.useMemo(() => {
    if (typeof node.conf !== 'number') return null;
    return buildSeries(node.id.charCodeAt(0) * 7 + node.id.length, node.conf * 100).points;
  }, [node.id, node.conf]);

  return (
    <div
      role="dialog"
      aria-label={`${node.label} detail`}
      data-radiant-focused="true"
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 620,
        maxHeight: '88vh',
        overflowY: 'auto',
        background: isApex ? 'rgba(28, 8, 16, 0.96)' : 'rgba(10, 8, 12, 0.96)',
        border: `${isApex ? 2 : 1}px solid ${accent}`,
        borderRadius: RADIUS.md,
        boxShadow: `0 0 60px rgba(225, 29, 72, 0.40), 0 24px 80px rgba(0, 0, 0, 0.85)`,
        fontFamily: FONTS.sans,
        color: COLORS.textPrimary,
        animation: 'detail-pop 320ms cubic-bezier(0.16, 1, 0.32, 1) backwards',
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.md,
        padding: `${SPACE.lg}px ${SPACE.xl}px`,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 11, letterSpacing: '0.22em', color: accent, textTransform: 'uppercase' }}>
            {kindTag} {node.time && `· ${node.time}`}
          </span>
          <span style={{
            fontSize: isApex ? 24 : 20,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
            color: isDead ? COLORS.textMuted : COLORS.textPrimary,
            textDecoration: isDead ? 'line-through' : 'none',
          }}>
            {node.label}
          </span>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      {/* Hero confidence */}
      {typeof node.conf === 'number' && (
        <div style={{ padding: `${SPACE.xl}px ${SPACE.xl}px ${SPACE.base}px`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: SPACE.lg }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
            <span style={{
              fontFamily: FONTS.mono,
              fontSize: 56,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: accent,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {(node.conf * 100).toFixed(0)}%
            </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 10, letterSpacing: '0.20em', color: COLORS.textMuted, textTransform: 'uppercase' }}>
              {isDead ? 'rejected confidence' : 'confidence'}
            </span>
          </div>
          {node.value && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
              <span style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 600, color: accent, letterSpacing: '0.04em' }}>
                {node.value}
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 10, letterSpacing: '0.18em', color: COLORS.textMuted, textTransform: 'uppercase' }}>
                projected outcome
              </span>
            </div>
          )}
        </div>
      )}

      {/* Confidence over time (primary + apex only) */}
      {confSeries && !isDead && (
        <div style={{ padding: `${SPACE.md}px ${SPACE.xl}px ${SPACE.base}px` }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.22em', color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: SPACE.xs }}>
            ▸ CONFIDENCE OVER 4-HOUR HORIZON
          </div>
          <Sparkline points={confSeries} width={560} height={68} stroke={accent} fill={COLORS.accentDim} />
        </div>
      )}

      <SectionDivider />

      {/* Probability path or ruled-out reason */}
      <div style={{ padding: `0 ${SPACE.xl}px`, display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.22em', color: COLORS.textMuted, textTransform: 'uppercase' }}>
          {isDead ? '× WHY RULED OUT' : '▸ PROBABILITY PATH'}
        </span>
        {isDead && ruledOutReason ? (
          <div style={{ fontFamily: FONTS.mono, fontSize: 13, letterSpacing: '0.02em', color: COLORS.textSecondary, lineHeight: 1.5 }}>
            {ruledOutReason}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
            {path.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
                <span style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: i === path.length - 1 ? accent : COLORS.border,
                  color: i === path.length - 1 ? '#020202' : COLORS.textSecondary,
                  fontFamily: FONTS.mono,
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textPrimary, letterSpacing: '0.02em' }}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <SectionDivider />

      {/* Alternative scenarios — only for primary/apex */}
      {!isDead && (isPrimary || isApex) && (
        <>
          <div style={{ padding: `0 ${SPACE.xl}px`, display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
            <span style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.22em', color: COLORS.textMuted, textTransform: 'uppercase' }}>
              ▸ ALTERNATIVE SCENARIOS
            </span>
            {ALT_SCENARIOS.map((alt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
                <span style={{ flex: 1, fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textSecondary, letterSpacing: '0.02em' }}>
                  {alt.label}
                </span>
                <div style={{ width: 100, height: 3, background: COLORS.border, borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(alt.conf * 100).toFixed(0)}%`,
                    height: '100%',
                    background: COLORS.textSecondary,
                  }} />
                </div>
                <span style={{ width: 36, textAlign: 'right', fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                  {(alt.conf * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
          <SectionDivider />
        </>
      )}

      {/* Key dependencies */}
      <div style={{ padding: `0 ${SPACE.xl}px`, display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.22em', color: COLORS.textMuted, textTransform: 'uppercase' }}>
          ▸ KEY DEPENDENCIES
        </span>
        {deps.map((dep, i) => (
          <div key={i} style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textSecondary, letterSpacing: '0.02em' }}>
            ▸ {dep}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: SPACE.lg,
        padding: `${SPACE.md}px ${SPACE.xl}px`,
        borderTop: `1px solid ${COLORS.border}`,
        fontFamily: FONTS.mono,
        fontSize: 10,
        letterSpacing: '0.18em',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>{node.kind.toUpperCase()} · {node.id.toUpperCase()}</span>
        <span>Press ESC to close</span>
      </div>
    </div>
  );
};
