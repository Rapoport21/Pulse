/**
 * Pulse Radiant — distinct data visualizations per widget type.
 *
 * Each takes a 48-point 24h series + accent color and renders a unique
 * tactical-HUD-style visualization. Hash a widget into one of these so
 * the cluster reads as a constellation of different signals, not a
 * wall of identical sparklines.
 */

import React from 'react';
import { COLORS, FONTS, SPACE } from '../design';

const WIDTH = 560;

// Shared bottom-axis helper
const axisRow = (labels: readonly string[]) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: SPACE.xs,
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: '0.20em',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  }}>
    {labels.map((l, i) => <span key={i}>{l}</span>)}
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// 1) Sparkline — re-export of the existing line chart for default use
// ─────────────────────────────────────────────────────────────────────
export { Sparkline } from './DetailCards';

// ─────────────────────────────────────────────────────────────────────
// 2) Half-gauge — semicircular arc with needle + tick marks
// ─────────────────────────────────────────────────────────────────────

interface GaugeProps {
  /** 0..1 fill of the arc */
  value: number;
  /** Optional small percentage readout inside the dial. Does NOT
   *  duplicate the hero number above the chart — keep this short. */
  percent?: number;
  stroke?: string;
}

export const HalfGauge: React.FC<GaugeProps> = ({ value, percent, stroke = COLORS.accent }) => {
  const W = WIDTH;
  const H = 200;
  const cx = W / 2;
  // Bring the pivot down so the dial fills the SVG without overlapping
  // the hero metric block above it.
  const cy = 178;
  const r = 130;
  const v = Math.max(0, Math.min(1, value));
  const angleStart = Math.PI;
  const angleEnd = 0;
  const angleAt = (t: number) => angleStart + (angleEnd - angleStart) * t;

  const a = angleAt(v);
  const ax = cx + r * Math.cos(a);
  const ay = cy - r * Math.sin(a);
  const startX = cx - r;
  const startY = cy;

  const fgArc = `M ${startX} ${startY} A ${r} ${r} 0 ${v > 0.5 ? 1 : 0} 1 ${ax.toFixed(2)} ${ay.toFixed(2)}`;
  const bgArc = `M ${startX} ${startY} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`;

  const ticks = Array.from({ length: 11 }, (_, i) => i / 10);
  const needleLen = r - 6;
  const nx = cx + needleLen * Math.cos(a);
  const ny = cy - needleLen * Math.sin(a);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {/* Background arc */}
      <path d={bgArc} fill="none" stroke={COLORS.border} strokeWidth={14} strokeLinecap="round" />
      {/* Filled arc */}
      <path d={fgArc} fill="none" stroke={stroke} strokeWidth={14} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${stroke})` }} />
      {/* Tick marks */}
      {ticks.map((t, i) => {
        const ang = angleAt(t);
        const r1 = r + 12;
        const r2 = r + 22;
        const x1 = cx + r1 * Math.cos(ang);
        const y1 = cy - r1 * Math.sin(ang);
        const x2 = cx + r2 * Math.cos(ang);
        const y2 = cy - r2 * Math.sin(ang);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 5 === 0 ? COLORS.accent : COLORS.borderStrong} strokeWidth={i % 5 === 0 ? 2 : 1} />;
      })}
      {/* 0 / 100 endpoints labelled */}
      <text x={cx - r - 4} y={cy + 18} textAnchor="middle" fontSize={10} fill={COLORS.textMuted}
        fontFamily={FONTS.mono} style={{ letterSpacing: '0.18em' }}>0</text>
      <text x={cx + r + 4} y={cy + 18} textAnchor="middle" fontSize={10} fill={COLORS.textMuted}
        fontFamily={FONTS.mono} style={{ letterSpacing: '0.18em' }}>100</text>
      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={stroke} strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={6} fill={stroke} />
      <circle cx={cx} cy={cy} r={10} fill={stroke} fillOpacity={0.25} />
      {/* Optional small % readout above the pivot — short, doesn't
          conflict with the hero number above the chart. */}
      {percent != null && (
        <>
          <text x={cx} y={cy - 56} textAnchor="middle" fontSize={36} fontWeight={600} fill={stroke}
            fontFamily={FONTS.mono} style={{ letterSpacing: '-0.02em' }}>
            {percent.toFixed(0)}%
          </text>
          <text x={cx} y={cy - 38} textAnchor="middle" fontSize={9} fill={COLORS.textMuted}
            fontFamily={FONTS.mono} style={{ letterSpacing: '0.22em' }}>
            OF MAX
          </text>
        </>
      )}
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────
// 3) Radar sweep — circular detection grid with rotating sweep + blips
// ─────────────────────────────────────────────────────────────────────

export const RadarSweep: React.FC<{ points: number[]; stroke?: string }> = ({ points, stroke = COLORS.accent }) => {
  const W = WIDTH;
  const H = 240;
  const cx = W / 2;
  const cy = H / 2;
  const r = 100;

  // Use 6-12 of the points as "detection blips" placed around the radar
  const blips = points.slice(0, 8).map((v, i, arr) => {
    const ang = (i / arr.length) * Math.PI * 2;
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const range = max - min || 1;
    const radius = ((v - min) / range) * (r - 16) + 16;
    return { x: cx + radius * Math.cos(ang), y: cy + radius * Math.sin(ang), v };
  });

  const animId = `radar-sweep-${Math.random().toString(36).slice(2, 7)}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={animId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={stroke} stopOpacity={0} />
          <stop offset="80%" stopColor={stroke} stopOpacity={0} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0.55} />
        </linearGradient>
      </defs>
      {/* Concentric grid rings */}
      {[1, 2, 3, 4].map((n) => (
        <circle key={n} cx={cx} cy={cy} r={(r / 4) * n} fill="none"
          stroke={COLORS.border} strokeWidth={1} strokeDasharray={n === 4 ? '0' : '2 4'} />
      ))}
      {/* Cross axes */}
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={COLORS.border} strokeWidth={1} />
      <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={COLORS.border} strokeWidth={1} />
      {/* Diagonals */}
      <line x1={cx - r * 0.707} y1={cy - r * 0.707} x2={cx + r * 0.707} y2={cy + r * 0.707}
        stroke={COLORS.border} strokeWidth={1} strokeDasharray="2 4" />
      <line x1={cx - r * 0.707} y1={cy + r * 0.707} x2={cx + r * 0.707} y2={cy - r * 0.707}
        stroke={COLORS.border} strokeWidth={1} strokeDasharray="2 4" />
      {/* Blips */}
      {blips.map((b, i) => (
        <g key={i}>
          <circle cx={b.x} cy={b.y} r={3} fill={stroke}>
            <animate attributeName="opacity" values="1;0.3;1" dur="2.4s" repeatCount="indefinite"
              begin={`${(i * 0.2).toFixed(2)}s`} />
          </circle>
          <circle cx={b.x} cy={b.y} r={6} fill={stroke} fillOpacity={0.3}>
            <animate attributeName="r" values="3;9;3" dur="2.4s" repeatCount="indefinite"
              begin={`${(i * 0.2).toFixed(2)}s`} />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite"
              begin={`${(i * 0.2).toFixed(2)}s`} />
          </circle>
        </g>
      ))}
      {/* Rotating sweep arm — wedge filled with a gradient */}
      <g style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <path
          d={`M ${cx} ${cy} L ${cx + r} ${cy} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(-Math.PI / 3)} ${cy + r * Math.sin(-Math.PI / 3)} Z`}
          fill={`url(#${animId})`}
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${cx} ${cy}`}
            to={`360 ${cx} ${cy}`}
            dur="3.6s"
            repeatCount="indefinite"
          />
        </path>
      </g>
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={3} fill={stroke} />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────
// 4) Pulse wave — ECG-style heartbeat with peaks at intervals
// ─────────────────────────────────────────────────────────────────────

export const PulseWave: React.FC<{ points: number[]; stroke?: string }> = ({ points, stroke = COLORS.accent }) => {
  const W = WIDTH;
  const H = 120;
  const padX = 6;
  const padY = 12;
  const N = points.length;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  // Build a path that's mostly baseline with sharp ECG-style peaks at
  // each data point. The peak height is data-driven.
  let d = `M ${padX} ${padY + innerH / 2}`;
  for (let i = 0; i < N; i++) {
    const baseX = padX + (i / N) * innerW;
    const stepW = innerW / N;
    const peakHeight = ((points[i] - min) / range) * innerH * 0.9;
    const baselineY = padY + innerH / 2;
    // Quick downstroke
    const x0 = baseX + stepW * 0.20;
    const x1 = baseX + stepW * 0.30;
    const x2 = baseX + stepW * 0.40;
    const x3 = baseX + stepW * 0.50;
    const x4 = baseX + stepW * 0.60;
    const x5 = baseX + stepW;
    d += ` L ${x0} ${baselineY}`;
    d += ` L ${x1} ${baselineY + peakHeight * 0.15}`; // small Q
    d += ` L ${x2} ${baselineY - peakHeight}`;        // R peak
    d += ` L ${x3} ${baselineY + peakHeight * 0.30}`; // S
    d += ` L ${x4} ${baselineY}`;                     // back to baseline
    d += ` L ${x5} ${baselineY}`;
  }

  const gradId = `pulse-grad-${stroke.replace('#', '')}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.2} />
          <stop offset="100%" stopColor={stroke} stopOpacity={1} />
        </linearGradient>
      </defs>
      {/* Faint horizontal grid lines */}
      {[0.25, 0.5, 0.75].map((f, i) => (
        <line key={i} x1={padX} x2={W - padX} y1={padY + innerH * f} y2={padY + innerH * f}
          stroke={COLORS.border} strokeWidth={1} strokeDasharray="2 6" />
      ))}
      {/* Vertical tick marks every 6h */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <line key={i} x1={padX + innerW * f} x2={padX + innerW * f}
          y1={padY} y2={H - padY}
          stroke={COLORS.borderStrong} strokeWidth={1} strokeDasharray="1 5" opacity={0.5} />
      ))}
      <path d={d} fill="none" stroke={`url(#${gradId})`} strokeWidth={1.5} strokeLinejoin="miter"
        style={{ filter: `drop-shadow(0 0 3px ${stroke})` }} />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────
// 5) Heatstrip — 24-cell horizontal heat row, intensity per hour
// ─────────────────────────────────────────────────────────────────────

export const HeatStrip: React.FC<{ points: number[]; stroke?: string }> = ({ points, stroke = COLORS.accent }) => {
  // Reduce 48 points to 24 by averaging adjacent pairs (1 cell per hour)
  const cells: number[] = [];
  for (let i = 0; i < 24; i++) {
    cells.push((points[i * 2] + points[i * 2 + 1]) / 2);
  }
  const min = Math.min(...cells);
  const max = Math.max(...cells);
  const range = max - min || 1;
  const cellW = (WIDTH - 4) / 24;
  const cellH = 70;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
      <svg width={WIDTH} height={cellH + 4} viewBox={`0 0 ${WIDTH} ${cellH + 4}`} style={{ display: 'block' }}>
        {cells.map((v, i) => {
          const t = (v - min) / range;
          // Heat: dim → bright accent. Use opacity for the gradient,
          // not literal color shift, so it reads as one signal.
          const opacity = 0.18 + t * 0.78;
          const x = 2 + i * cellW;
          return (
            <g key={i}>
              <rect x={x + 1} y={2} width={cellW - 2} height={cellH} rx={1} fill={stroke} fillOpacity={opacity} />
              {i === 23 && (
                <rect x={x + 1} y={2} width={cellW - 2} height={cellH} rx={1}
                  fill="none" stroke={stroke} strokeWidth={1.5}
                  style={{ filter: `drop-shadow(0 0 6px ${stroke})` }} />
              )}
            </g>
          );
        })}
      </svg>
      {axisRow(['00', '06', '12', '18', 'NOW'])}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// 6) Histogram — vertical bars
// ─────────────────────────────────────────────────────────────────────

export const Histogram: React.FC<{ points: number[]; stroke?: string }> = ({ points, stroke = COLORS.accent }) => {
  // 12 buckets from 48 points
  const buckets: number[] = [];
  for (let i = 0; i < 12; i++) {
    let sum = 0;
    for (let j = i * 4; j < (i + 1) * 4; j++) sum += points[j] ?? 0;
    buckets.push(sum / 4);
  }
  const min = Math.min(...buckets);
  const max = Math.max(...buckets);
  const range = max - min || 1;

  const W = WIDTH;
  const H = 110;
  const padX = 4;
  const padY = 6;
  const inner = H - padY * 2;
  const colW = (W - padX * 2) / buckets.length;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {/* Baseline */}
      <line x1={padX} x2={W - padX} y1={H - padY} y2={H - padY} stroke={COLORS.border} strokeWidth={1} />
      {buckets.map((v, i) => {
        const t = (v - min) / range;
        const h = inner * (0.15 + t * 0.85);
        const x = padX + i * colW + 4;
        const y = H - padY - h;
        const w = colW - 8;
        const isLast = i === buckets.length - 1;
        return (
          <rect key={i} x={x} y={y} width={w} height={h} rx={1}
            fill={stroke} fillOpacity={isLast ? 1 : 0.6}
            style={isLast ? { filter: `drop-shadow(0 0 6px ${stroke})` } : undefined} />
        );
      })}
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────
// 7) Event log — vertical list of recent timestamped events
// ─────────────────────────────────────────────────────────────────────

const EVENT_PHRASES = [
  'pattern signature', 'threshold crossed', 'corr peak detected',
  'ingestion spike', 'baseline drift', 'σ regime shift',
  'heuristic match', 'decay accelerated', 'feed reconnected',
  'anomaly cleared', 'amplitude spike', 'phase lock acquired',
];

export const EventLog: React.FC<{ widgetId: number; stroke?: string }> = ({ widgetId, stroke = COLORS.accent }) => {
  // Deterministic event list from id
  const events = React.useMemo(() => {
    let s = widgetId * 31 + 7;
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const out = [] as Array<{ t: number; label: string; level: 'info' | 'ok' | 'warn' }>;
    let elapsed = 0;
    for (let i = 0; i < 7; i++) {
      elapsed += Math.floor(r() * 14) + 2;
      out.push({
        t: elapsed,
        label: EVENT_PHRASES[Math.floor(r() * EVENT_PHRASES.length)],
        level: r() < 0.15 ? 'warn' : r() < 0.5 ? 'ok' : 'info',
      });
    }
    return out;
  }, [widgetId]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: WIDTH,
      gap: 6,
      borderLeft: `1px solid ${COLORS.border}`,
      paddingLeft: SPACE.md,
    }}>
      {events.map((e, i) => {
        const dotColor = e.level === 'warn' ? COLORS.warn : e.level === 'ok' ? COLORS.ok : stroke;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: -SPACE.md - 5,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: dotColor,
              boxShadow: `0 0 6px ${dotColor}`,
            }} />
            <span style={{
              fontFamily: FONTS.mono,
              fontSize: 10,
              letterSpacing: '0.18em',
              color: COLORS.textMuted,
              textTransform: 'uppercase',
              minWidth: 56,
            }}>
              T−{String(e.t).padStart(2, '0')}m
            </span>
            <span style={{
              fontFamily: FONTS.mono,
              fontSize: 12,
              color: COLORS.textPrimary,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              {e.label}
            </span>
            {i === 0 && (
              <span style={{
                marginLeft: 'auto',
                fontFamily: FONTS.mono,
                fontSize: 9,
                letterSpacing: '0.20em',
                color: COLORS.ok,
                textTransform: 'uppercase',
              }}>
                ● LIVE
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// 8) Compass — full circle with directional needle
// ─────────────────────────────────────────────────────────────────────

export const Compass: React.FC<{ points: number[]; bearing?: number; stroke?: string }> = ({ points, bearing, stroke = COLORS.accent }) => {
  const W = WIDTH;
  const H = 260;
  const cx = W / 2;
  // Drop the dial so the bearing readout above it sits inside the
  // SVG bounds. Previously cy = H/2 + bearing label at cy - r - 28
  // worked out to y = -8, which clipped above the viewBox.
  const cy = 150;
  const r = 100;

  // Bearing — derive from points if not provided. Use last point modulo 360.
  const last = points[points.length - 1] ?? 0;
  const b = bearing ?? ((Math.abs(last) * 31) % 360);
  const ang = (b - 90) * (Math.PI / 180); // 0° = up

  const tipX = cx + (r - 8) * Math.cos(ang);
  const tipY = cy + (r - 8) * Math.sin(ang);

  // Cardinal points
  const cardinals = [
    { l: 'N', a: -90 },
    { l: 'E', a: 0 },
    { l: 'S', a: 90 },
    { l: 'W', a: 180 },
  ];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {/* Outer rings */}
      <circle cx={cx} cy={cy} r={r + 12} fill="none" stroke={COLORS.borderStrong} strokeWidth={1} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.border} strokeWidth={1} />
      <circle cx={cx} cy={cy} r={r * 0.66} fill="none" stroke={COLORS.border} strokeWidth={1} strokeDasharray="2 4" />
      <circle cx={cx} cy={cy} r={r * 0.33} fill="none" stroke={COLORS.border} strokeWidth={1} strokeDasharray="2 4" />
      {/* Tick marks every 30° */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 - 90) * (Math.PI / 180);
        const x1 = cx + r * Math.cos(a);
        const y1 = cy + r * Math.sin(a);
        const x2 = cx + (r + 10) * Math.cos(a);
        const y2 = cy + (r + 10) * Math.sin(a);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 3 === 0 ? COLORS.accent : COLORS.borderStrong} strokeWidth={i % 3 === 0 ? 2 : 1} />;
      })}
      {/* Cardinal labels */}
      {cardinals.map(({ l, a }) => {
        const rad = (a * Math.PI) / 180;
        const x = cx + (r + 26) * Math.cos(rad);
        const y = cy + (r + 26) * Math.sin(rad);
        return <text key={l} x={x} y={y + 4} textAnchor="middle" fontSize={12} fill={COLORS.accent}
          fontFamily={FONTS.mono} style={{ letterSpacing: '0.20em' }}>{l}</text>;
      })}
      {/* Needle */}
      <line x1={cx} y1={cy} x2={tipX} y2={tipY} stroke={stroke} strokeWidth={3} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${stroke})` }} />
      {/* Tail */}
      <line x1={cx} y1={cy}
        x2={cx - (r - 30) * Math.cos(ang)}
        y2={cy - (r - 30) * Math.sin(ang)}
        stroke={COLORS.textMuted} strokeWidth={2} />
      {/* Pivot */}
      <circle cx={cx} cy={cy} r={6} fill={stroke} />
      <circle cx={cx} cy={cy} r={10} fill={stroke} fillOpacity={0.25} />
      {/* Bearing readout — placed at top of SVG */}
      <text x={cx} y={28} textAnchor="middle" fontSize={26} fontWeight={600} fill={stroke}
        fontFamily={FONTS.mono} style={{ letterSpacing: '0.04em' }}>
        {b.toFixed(0).padStart(3, '0')}°
      </text>
      <text x={cx} y={44} textAnchor="middle" fontSize={9} fill={COLORS.textMuted}
        fontFamily={FONTS.mono} style={{ letterSpacing: '0.22em' }}>
        BEARING
      </text>
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────
// 9) Recent samples — text-only data block for widgets that don't
// have a meaningful graph. 4 timestamped readings, mono-aligned.
// ─────────────────────────────────────────────────────────────────────

export const RecentSamples: React.FC<{ widgetId: number; currentValue: string; stroke?: string }> = ({
  widgetId,
  currentValue,
  stroke = COLORS.accent,
}) => {
  // Generate 3 plausible "previous readings" deterministically from id.
  // Each is the current value with a small variant — text mutations
  // rather than numbers, so it works for non-numeric values like
  // "I-95 west" or "Bay 3" too.
  const samples = React.useMemo(() => {
    let s = widgetId * 17 + 11;
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const ts = [4, 14, 38].map((minutes) => Math.floor(minutes + r() * 6));
    return ts.map((t) => ({
      t,
      // Display the current value; in real life this'd be the actual
      // historical reading. For now, identical reads = "stable".
      v: currentValue,
      stable: true,
    }));
  }, [widgetId, currentValue]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      borderLeft: `1px solid ${COLORS.border}`,
      paddingLeft: SPACE.md,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 80px', gap: 6, alignItems: 'center', padding: '4px 0' }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 10, letterSpacing: '0.20em', color: COLORS.textMuted, textTransform: 'uppercase' }}>NOW</span>
        <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textPrimary, letterSpacing: '0.02em' }}>{currentValue}</span>
        <span style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.18em', color: stroke, textTransform: 'uppercase', textAlign: 'right' }}>● LIVE</span>
      </div>
      {samples.map((s, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 80px', gap: 6, alignItems: 'center', padding: '4px 0', borderTop: `1px dashed ${COLORS.border}` }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 10, letterSpacing: '0.20em', color: COLORS.textMuted, textTransform: 'uppercase' }}>
            T−{String(s.t).padStart(2, '0')}m
          </span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textSecondary, letterSpacing: '0.02em' }}>{s.v}</span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.18em', color: COLORS.textMuted, textTransform: 'uppercase', textAlign: 'right' }}>
            {s.stable ? 'stable' : 'shifted'}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Type registry + selector
//
// Each widget gets a viz type that MATCHES its data shape — not a
// random hash. Some widgets (single-event facts, state alerts, weather
// snapshots) get 'none', which means: just show the hero number and
// detail rows, no chart. A graph on every widget would be fake noise;
// graphs only when the data actually has a shape worth drawing.
// ─────────────────────────────────────────────────────────────────────

export type VizType =
  | 'none'        // no chart — just hero metric + context
  | 'sparkline'   // continuous trend over time
  | 'gauge'       // utilization / capacity %
  | 'radar'       // correlation across signals (Layer 2 patterns)
  | 'pulse'       // rhythmic/cyclic signal
  | 'heatstrip'   // intensity per hour
  | 'histogram'   // distribution across labeled buckets
  | 'eventlog'    // discrete recent events
  | 'compass';    // direction + magnitude (wind only)

/**
 * Route a widget to the right visualization based on its label
 * keywords + layer. Returns 'none' when no chart makes sense — those
 * widgets render with a richer text body instead.
 */
export const vizTypeFor = (label: string, layer: number): VizType => {
  // Higher layers have semantic types regardless of label
  if (layer === 2) return 'radar';
  if (layer === 3) return 'gauge';
  if (layer === 4) return 'eventlog';

  const l = label.toLowerCase();

  // Direction-bearing widgets — wind only. Other "direction-ish"
  // labels (e.g., "northbound traffic") aren't meaningful as a compass.
  if (l.startsWith('wind') || l.includes('wind speed') || l.includes('bearing')) return 'compass';

  // Counts / rates of discrete events
  if (l.includes('lightning') || l.includes('strike') || l.includes('911 call') || l.includes('alert') || l.includes('callout')) return 'eventlog';

  // Capacity / utilization / % readings
  if (l.includes('capacity') || l.includes('icu') || l.includes('occupancy') || l.includes('utilization')) return 'gauge';

  // Hour-of-day patterns — explicitly heatstrip-able
  if (l.includes('arrivals') || l.includes('admits') || l.includes('throughput')) return 'heatstrip';

  // Vital-signs / cardiac / cyclic
  if (l.includes('heart') || l.includes('vitals') || l.includes('pulse') || l.includes('cycle')) return 'pulse';

  // Trend-over-time keywords
  if (l.includes('traffic') || l.includes('congestion') || l.includes('volume')
    || l.includes('time') || l.includes('delay') || l.includes('wait')
    || l.includes('queue') || l.includes('pressure') || l.includes('speed')
    || l.includes('drift') || l.includes('ratio') || l.includes('avg') || l.includes('rate'))
    return 'sparkline';

  // Distribution-style data
  if (l.includes('distribution') || l.includes('mix') || l.includes('breakdown') || l.includes('cohort')) return 'histogram';

  // Everything else — single-event facts, state changes, weather snapshots,
  // ad-hoc alerts: no chart. The hero number IS the story.
  return 'none';
};
